/* nova-fieldsites.js -- where in the program a record's field is read.
   =========================================================================

   A field note (nova-fields.js) cites the routines a field was read from;
   this finds the instructions in them that touch it, so the note's link
   can ring the line that reads the field, not the routine's first.

   The program's LoadObjectData copies each record into an element of an
   array field by field, every copy the same shape:
       lha  r4, 20(r3)       the record's byte 20 (r3 the resource's bytes)
       lwz  r3, ...          the array's address
       add  r3, r0, r18      ... plus the element's
       sth  r4, 10(r3)       the element's byte 10
   and a text field by a call with the element's place in r3 and the
   record's in r4, so the copies give each field's place in the element
   (novaFieldPlaces). A routine then reads the field where an instruction
   loads or stores at that place off a register that contains the same
   array's address, plus whatever index, or hands that place to a call
   (novaFieldSites). A record not copied is read through its handle, from
   the call that requested it or from a global the handle was kept in
   (novaHandleGlobals). A routine every call to which hands it an
   element's place in an argument register starts out knowing it
   (novaHandedIn). Copies of another shape (lists in a loop, a value
   worked out first) give no place, and a routine that reaches the element
   through a pointer kept elsewhere (a ship's to its class) gives no site:
   the link then opens the routine with nothing ringed.

   An array is named by the global it is reached through and how many
   loads deep: in 1.0.x the TOC's word for a global (an `lwz rN, k(r2)` the
   reader shows as `data 0x…`) is a static array's address, and a word loaded
   from there an allocated one's; in 1.1.1 the same from the address the
   Mach-O gives (`address of stellarData`), a load the reader labels with
   its global, or a constant that contains a global's address (shipClass's
   is kept in __const as well as reached by name). The record itself is reached the same way, through the
   global its handle is kept in, which distinguishes it from a copy.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js and
   nova-program.js. */

// The records LoadObjectData copies into an array.
const NOVA_LOADED_TYPES = ['spöb', 'sÿst', 'shïp', 'oütf', 'gövt', 'wëap', 'përs', 'crön', 'ränk', 'flët', 'jünk', 'öops', 'düde', 'nëbu', 'röid', 'bööm'];
const NOVA_GET_RESOURCE = /^Get1?(Named|Ind)?Resource$/;
const NOVA_ACCESS_SIZE = { lwz: 4, stw: 4, lha: 2, lhz: 2, sth: 2, lbz: 1, stb: 1, lfs: 4, stfs: 4, lfd: 8, stfd: 8 };

/* Follows, through a routine as it is laid out, which registers hold an
   array's address, and calls each(o, i, access) for a load or store off
   one, access { g, off, size, load, fp, rt }, off the place in the
   element; and for a call, access { call: true, args: [r3, r4, r5, r6] },
   each { g, k } or undefined. A register is followed until it is written
   or a call may have changed it. */
function novaArrayAccesses(prog, ops, each, seed) {
  const at = new Map(seed || []);     // register -> { g: 'global:depth', k: place added }
  const plus = new Map();   // register not an array's -> a constant added to it
  const type = new Map();   // register -> a resource type it contains ('mïsn')
  const kept = new Map();   // a place in memory ('sp@56', or an array's) -> what was stored there
  const macho = prog.kind === 'macho';
  const volatile = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].concat(macho ? [2] : []);
  const forget = r => { at.delete(r); plus.delete(r); type.delete(r); };
  const placeOf = (ra, d) => ra === 1 ? 'sp@' + d : at.has(ra) ? at.get(ra).g + '@' + (at.get(ra).k + d) : null;
  ops.forEach((o, i) => {
    const op = o.op;
    if (!op) return;
    if (op.branch) {
      if (op.lk) {
        each(o, i, { call: true, args: [3, 4, 5, 6].map(r => at.get(r)) });
        // a resource requested by type, by number or by name: what comes back is its handle, and a load through that its record
        const t = NOVA_GET_RESOURCE.test(o.note || '') ? type.get(3) : undefined;
        for (const r of volatile) forget(r);
        if (t) at.set(3, { g: `'${t}':0`, k: 0 });
      }
      return;
    }
    if (op.mn === 'stmw' || op.mn === 'lmw') { if (op.mn === 'lmw') for (let r = op.rt; r < 32; r++) forget(r); return; }
    // a load or store at a constant place
    if (op.d !== undefined && op.rt !== undefined) {
      const load = op.mn[0] === 'l', fp = /^(l|st)f/.test(op.mn), size = NOVA_ACCESS_SIZE[op.mn.replace(/u$/, '')], b = at.get(op.ra);
      if (size && b && op.ra !== 1) each(o, i, { g: b.g, off: b.k + op.d, size, load, fp, rt: op.rt, val: load ? undefined : at.get(op.rt) });
      // a handle or an array's address put away and fetched again
      const place = op.mn === 'stw' || op.mn === 'lwz' ? placeOf(op.ra, op.d) : null;
      if (!load) { if (place) { if (at.has(op.rt)) kept.set(place, at.get(op.rt)); else kept.delete(place); } return; }
      if (fp) return;
      forget(op.rt);
      if (op.mn !== 'lwz') return;
      if (place && kept.has(place)) at.set(op.rt, kept.get(place));
      else if (macho && o.note && o.note.startsWith('address of ') && o.data !== undefined) at.set(op.rt, { g: hex(o.data) + ':0', k: 0 });
      else if (!macho && op.ra === 2 && o.data !== undefined && !o.pointer && o.text == null && o.target === null) at.set(op.rt, { g: hex(o.data) + ':0', k: 0 });
      else if (macho && !b && o.data !== undefined && o.value === undefined && o.target === null && o.text == null) {
        // a constant holding a named global's address is that global's address
        const w = prog.word(o.data);
        at.set(op.rt, w && prog.globalAt(w) ? { g: hex(w) + ':0', k: 0 } : { g: hex(o.data) + ':1', k: 0 });
      }
      else if (b && b.k === 0 && op.d === 0) { const [g, n] = b.g.split(':'); at.set(op.rt, { g: g + ':' + (+n + 1), k: 0 }); }
      return;
    }
    // a load or store at a register's place (lhax rT, rA, rB)
    if (op.rt !== undefined && op.rb !== undefined && /x$/.test(op.mn)) {
      const load = op.mn[0] === 'l', fp = /^(l|st)f/.test(op.mn), size = NOVA_ACCESS_SIZE[op.mn.replace(/u?x$/, '')];
      const a = at.get(op.ra), b = at.get(op.rb), base = a && !b ? a : b && !a ? b : null, other = a && !b ? op.rb : op.ra;
      if (size && base) each(o, i, { g: base.g, off: base.k + (plus.get(other) || 0), size, load, fp, rt: op.rt });
      if (load && !fp) forget(op.rt);
      return;
    }
    if (op.mn === 'mr') {
      const b = at.get(op.rs), c = plus.get(op.rs);
      forget(op.ra);
      if (b) at.set(op.ra, b); else if (c !== undefined) plus.set(op.ra, c);
      return;
    }
    if (op.mn === 'add') {
      const a = at.get(op.ra), b = at.get(op.rb), base = a && !b ? a : b && !a ? b : null, other = a && !b ? op.rb : op.ra;
      const k = base ? base.k + (plus.get(other) || 0) : 0;
      forget(op.rd);
      if (base) at.set(op.rd, { g: base.g, k });
      return;
    }
    // a four-character constant, a resource type
    const quoted = /^'(.{4})'$/.exec(o.note || '');
    if (quoted && (op.mn === 'addi' || op.mn === 'ori')) { const d = op.mn === 'ori' ? op.ra : op.rd; forget(d); type.set(d, quoted[1]); return; }
    if (op.mn === 'addi' && op.ra) {
      const b = at.get(op.ra), c = op.ra === 1 || op.ra === 2 ? undefined : (plus.get(op.ra) || 0) + op.imm;
      forget(op.rd);
      if (b) at.set(op.rd, { g: b.g, k: b.k + op.imm }); else if (c !== undefined) plus.set(op.rd, c);
      return;
    }
    // for anything else that writes a register, what it held is dropped
    if (op.rd !== undefined) forget(op.rd);
    else if (op.rs !== undefined && op.ra !== undefined) forget(op.ra);
    else if (op.rt !== undefined && op.mn[0] === 'l') forget(op.rt);
  });
}

/* Where LoadObjectData puts each field of each type it loads:
   Map type -> { g, places: Map record offset -> { off, addr } }, addr the
   instruction that reads the field from the record (or the call that
   copies it). Cached on the program. */
function novaFieldPlaces(prog) {
  if (prog.fieldPlaces) return prog.fieldPlaces;
  const out = new Map();
  prog.fieldPlaces = out;
  const r = novaRoutineNamed(prog, 'LoadObjectData');
  if (!r) return out;
  const ops = prog.ops(r), quoted = new Map(NOVA_LOADED_TYPES.map(t => [`'${t}'`, t]));
  // each type's run: from its first four-character code to the next type's
  const runs = [];
  ops.forEach((o, i) => { const t = quoted.get(o.note); if (t && (!runs.length || runs[runs.length - 1].type !== t)) runs.push({ type: t, from: i }); });
  runs.forEach((run, k) => { run.to = k + 1 < runs.length ? runs[k + 1].from : ops.length; });
  // followed through the whole routine: a global's address kept in r30
  // early serves every type's run
  const access = new Map();
  novaArrayAccesses(prog, ops, (o, i, a) => access.set(i, a));
  for (const run of runs) {
    if (out.has(run.type)) continue;
    const byG = novaCopies(prog, ops, access, run.from, run.to, run.type, null);
    // the array is the one most fields went to
    let best = null;
    for (const [g, m] of byG) if (!best || m.size > best.places.size) best = { g, places: m };
    if (best) out.set(run.type, best);
  }
  return out;
}

/* The copies of a record's fields into arrays in ops[from, to): Map array
   -> Map record offset -> { off, addr }. With rec, the record's
   register name ("'mïsn':1"), only what is read through it; without, in
   LoadObjectData, a load from anything but the array stored to, the stack
   or 1.0.x's TOC. */
function novaCopies(prog, ops, access, from, to, type, rec) {
  const size = novaRecordSize(type) || 0x10000, byG = new Map();
  const put = (g, at, off, addr, call) => {
    if (g[0] === "'") return;                                   // a record, not an array
    if (!byG.has(g)) byG.set(g, new Map());
    if (!byG.get(g).has(at)) byG.get(g).set(at, { off, addr, call });
  };
  for (let i = from; i < to; i++) {
    const a = access.get(i);
    if (!a) continue;
    // text: a call with the element's place and the record's
    if (a.call) {
      const [d, s] = a.args;
      if (d && s && d.g !== s.g && (!rec || s.g === rec) && s.k > 0 && s.k < size) put(d.g, s.k, d.k, ops[i].addr, true);
      continue;
    }
    if (a.load || a.fp) continue;
    // a store: its value's last write, through extensions and moves, a
    // load at the record's offset
    let reg = a.rt;
    for (let k = i - 1; k >= Math.max(from, i - 12); k--) {
      const p = ops[k].op;
      if (!p) continue;
      const writes = p.rd !== undefined ? p.rd : (p.rs !== undefined && p.ra !== undefined && p.d === undefined) ? p.ra : (p.mn[0] === 'l' ? p.rt : undefined);
      if (writes !== reg) { if (p.branch) break; continue; }
      if (/^(extsh|extsb|mr|clrlwi)$/.test(p.mn)) { reg = p.rs; continue; }
      if (p.mn[0] !== 'l' || p.mn[1] === 'f' || !(NOVA_ACCESS_SIZE[p.mn.replace(/u?x$/, '')] <= a.size)) break;
      // a 2-byte field may be stored widened to 4; a list's entry is read
      // by index, at the place followed to
      const src = access.get(k), at = src && !src.call && src.load ? src.off : rec ? undefined : p.d;
      const fromRecord = rec ? src && src.g === rec : p.ra !== 1 && !(p.ra === 2 && prog.kind !== 'macho') && !(src && src.g === a.g);
      if (fromRecord && at !== undefined && at >= 0 && at < size) put(a.g, at, a.off, ops[k].addr);
      break;
    }
  }
  // a call's destination may be built from an index the registers do not
  // show the whole of: where it lands on a place a store gives another
  // field, the store's value is the one used
  for (const m of byG.values()) {
    const stored = new Set([...m.values()].filter(p => !p.call).map(p => p.off));
    for (const [at, p] of m) if (p.call && stored.has(p.off)) m.delete(at);
  }
  return byG;
}

/* Copies of records into arrays elsewhere than LoadObjectData: in each
   routine that requests a resource by type, what is stored into an array
   from the record. Map type -> [{ g, places, routine }]. Cached. */
function novaFieldCopies(prog) {
  if (prog.fieldCopies) return prog.fieldCopies;
  const out = new Map(), loader = novaRoutineNamed(prog, 'LoadObjectData');
  prog.fieldCopies = out;
  for (const r of prog.routines) {
    if (r.glue || (loader && r.start === loader.start)) continue;
    const ops = prog.ops(r);
    if (!ops.some(o => o.target !== null && NOVA_GET_RESOURCE.test(o.note || ''))) continue;
    const types = new Set(ops.map(o => /^'(.{4})'$/.exec(o.note || '')).filter(m => m && NOVA_RECORDS[m[1]]).map(m => m[1]));
    if (!types.size) continue;
    const access = new Map();
    novaArrayAccesses(prog, ops, (o, i, a) => access.set(i, a));
    for (const t of types) {
      for (const [g, places] of novaCopies(prog, ops, access, 0, ops.length, t, `'${t}':1`)) {
        if (places.size < 2) continue;
        if (!out.has(t)) out.set(t, []);
        out.get(t).push({ g, places, routine: r.start });
      }
    }
  }
  return out;
}

/* The globals a record's handle is kept in: where a routine that requests
   a resource by type stores the handle it gets back in a global's first
   word (ActivateCharResource keeps the chär it takes by name). A routine
   that loads the handle from there, and the record through it, reads the
   record as surely as the one that requested it. Map type -> Set of the
   globals' names, two loads deep ('0x330464:2'). Cached. */
function novaHandleGlobals(prog) {
  if (prog.handleGlobals) return prog.handleGlobals;
  const out = new Map();
  prog.handleGlobals = out;
  for (const r of prog.routines) {
    if (r.glue) continue;
    const ops = prog.ops(r);
    if (!ops.some(o => o.target !== null && NOVA_GET_RESOURCE.test(o.note || ''))) continue;
    // a handle stored, and read back after: a zero stored on the path
    // where the request found nothing is never read back as a handle
    const stored = new Map();
    for (const { a } of novaRoutineAccesses(prog, r)) {
      if (a.call || a.off !== 0 || !/^0x[0-9a-f]+:0$/.test(a.g)) continue;
      const m = a.val && /^'(.{4})':0$/.exec(a.val.g);
      if (m) { stored.set(a.g, m[1]); continue; }
      if (!a.load || !stored.has(a.g)) continue;
      const t = stored.get(a.g);
      if (!out.has(t)) out.set(t, new Set());
      out.get(t).add(a.g.replace(/:0$/, ':2'));
    }
  }
  return out;
}

/* The instructions in a routine that read or write a record's field, or
   hand its place to a call: [{ addr, load, call }], in order; empty where
   none is found. A field is read through the record's handle, at its
   offset, or out of an array a copy put it in (novaFieldPlaces,
   novaFieldCopies), at its place there. */
function novaFieldSites(prog, routine, type, field) {
  const recs = new Set((novaLayout(type) || []).filter(f => f.name === field && !f.variable).map(f => f.offset));
  if (!recs.size) return [];
  const arrays = [novaFieldPlaces(prog).get(type), ...(novaFieldCopies(prog).get(type) || [])].filter(Boolean)
    .map(t => ({ g: t.g, offs: new Set([...recs].map(rec => t.places.get(rec)).filter(Boolean).map(p => p.off)) })).filter(t => t.offs.size);
  const direct = new Set([`'${type}':1`, ...(novaHandleGlobals(prog).get(type) || [])]);
  const hit = (g, off) => (direct.has(g) && recs.has(off)) || arrays.some(t => t.g === g && t.offs.has(off));
  const out = [];
  for (const { addr, a } of novaRoutineAccesses(prog, routine)) {
    if (a.call) { if (a.args.some(x => x && hit(x.g, x.k))) out.push({ addr, call: true }); }
    else if (hit(a.g, a.off)) out.push({ addr, load: a.load });
  }
  // in LoadObjectData, where the copy reads the field, when the record's register was not followed there
  const loader = novaRoutineNamed(prog, 'LoadObjectData'), t = novaFieldPlaces(prog).get(type);
  if (loader && routine.start === loader.start && t && !out.some(s => s.load)) {
    for (const rec of recs) if (t.places.has(rec)) out.push({ addr: t.places.get(rec).addr, load: true });
    out.sort((x, y) => x.addr - y.addr);
  }
  return out;
}
// A routine's accesses, worked out once, since every field of a record's
// table needs them; with what its callers hand it (novaHandedIn), unless raw.
function novaRoutineAccesses(prog, routine, raw) {
  const key = raw ? 'rawAccesses' : 'accesses';
  if (!prog[key]) prog[key] = new Map();
  if (!prog[key].has(routine.start)) {
    const list = [];
    novaArrayAccesses(prog, prog.ops(routine), (o, i, a) => list.push({ addr: o.addr, a }), raw ? null : novaHandedIn(prog, routine));
    prog[key].set(routine.start, list);
  }
  return prog[key].get(routine.start);
}
/* What a routine is handed in r3 to r6: a place in an array (or a record)
   that every call to it hands in that register, at the same place, as its
   callers' own accesses show them. Map register -> { g, k }. One level
   only: the callers are read without what they are handed. */
function novaHandedIn(prog, routine) {
  const calls = prog.callers(routine.start);
  if (!calls.length) return null;
  const agreed = [3, 4, 5, 6].map(() => undefined);
  for (const addr of calls) {
    const r = prog.routineAt(addr), hit = r && novaRoutineAccesses(prog, r, true).find(x => x.addr === addr && x.a.call);
    const args = hit ? hit.a.args : [];
    agreed.forEach((v, j) => {
      const a = args[j], same = v === undefined ? a : v && a && v.g === a.g && v.k === a.k ? v : null;
      agreed[j] = same || null;
    });
  }
  // only a register the routine reads before it writes it is an argument:
  // another is a caller's own, left there
  const used = novaArgsRead(prog, routine), out = new Map();
  agreed.forEach((v, j) => { if (v && used.has(3 + j)) out.set(3 + j, v); });
  return out.size ? out : null;
}
// Of r3 to r6, those a routine reads before it writes them, as it is laid
// out up to its first branch or call.
function novaArgsRead(prog, routine) {
  const out = new Set(), written = new Set();
  for (const o of prog.ops(routine)) {
    const op = o.op;
    if (!op || op.branch) break;
    // in the forms with rS and no displacement (or, mr., ori) rA is the one written
    const store = /^st/.test(op.mn), rsForm = op.rs !== undefined && op.ra !== undefined && op.d === undefined;
    const reads = [rsForm ? undefined : op.ra, op.rb, op.rs, store ? op.rt : undefined].filter(r => r !== undefined && !(r === 0 && op.d !== undefined));
    for (const r of reads) if (r >= 3 && r <= 6 && !written.has(r)) out.add(r);
    const w = op.rd !== undefined ? op.rd : !store && op.rt !== undefined ? op.rt : rsForm ? op.ra : undefined;
    if (w !== undefined) written.add(w);
    if (op.mn === 'lmw') for (let r = op.rt; r < 32; r++) written.add(r);
  }
  return out;
}
