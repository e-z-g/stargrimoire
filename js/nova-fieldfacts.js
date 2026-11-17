/* nova-fieldfacts.js -- what the program does with a field, worked out
   from its code rather than typed.
   =========================================================================

   A field note (nova-fields.js) is English a session wrote after reading
   the code. These are the facts under it, found in the open release's
   program each time it is read, so they cannot go stale or be mistyped:
   every routine that reads or writes the field where it is kept
   (novaFieldHit, the places nova-fieldsites.js finds), and at each read
   the flag bits the value is tested for and the numbers it is compared
   with in the instructions after it.

   A read's value is followed through the few instructions after the load
   (NOVA_FACT_WINDOW), through moves, sign extensions and conditional
   branches, until its register is written again, a call or a jump:
       lhz   r0, 2536(r2)     shïp Flags
       andi. r2, r0, 1024     tests 0x0400
       cmpwi cr7, r0, 3       compared with 3
   A bit pulled out by a rotate and mask (rlwinm, clrlwi) is the mask turned
   back by the rotation. What the bits and numbers mean is left to the note.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-fieldsites.js. */

const NOVA_FACT_WINDOW = 80;

// Every access to an array or record place in the program, by its place
// ('g@off'): [{ routine, addr, i, load, rt }]. Cached on the program.
function novaAccessIndex(prog) {
  if (prog.accessIndex) return prog.accessIndex;
  const out = new Map();
  prog.accessIndex = out;
  for (const r of prog.routines) {
    if (r.glue) continue;
    const ops = prog.ops(r), at = new Map(ops.map((o, i) => [o.addr, i]));
    for (const { addr, a } of novaRoutineAccesses(prog, r)) {
      if (a.call || a.fp && !a.load) continue;
      const k = a.g + '@' + a.off;
      if (!out.has(k)) out.set(k, []);
      out.get(k).push({ routine: r, addr, i: at.get(addr), load: a.load, rt: a.rt, fp: a.fp });
    }
  }
  return out;
}

// The bits of the value before the rotation that a 32-bit rotate and mask
// lets through.
function novaRlwinmBits(sh, mb, me) {
  let mask = 0;
  for (let b = mb; ; b = (b + 1) % 32) { mask |= 1 << (31 - b); if (b === me) break; }
  mask >>>= 0;
  return ((mask >>> sh) | (mask << (32 - sh))) >>> 0;
}

/* What follows one read: { bits: [{ mask, addr }], compares: [{ value, addr }] }.
   Both ways out of a conditional branch are followed, each within the
   window, so a run of tests that branch past each other is read whole. */
function novaFactsAfter(prog, ops, i, rt) {
  const bits = [], compares = [], seen = new Set(), byAddr = new Map(ops.map((o, k) => [o.addr, k]));
  const work = [{ k: i + 1, regs: new Set([rt]), left: NOVA_FACT_WINDOW }];
  while (work.length) {
    let { k, regs, left } = work.pop();
    for (; k < ops.length && left > 0; k++, left--) {
      if (seen.has(k)) break;
      seen.add(k);
      const o = ops[k], op = o.op;
      if (!op) break;
      if (op.branch) {
        if (op.lk) break;
        const to = op.disp !== undefined && !op.aa ? byAddr.get(o.addr + op.disp) : undefined;
        if (to !== undefined && to > k) work.push({ k: to, regs: new Set(regs), left: left - 1 });
        if (!op.conditional || (op.bo & 0x14) === 0x14) break;
        continue;
      }
      if (op.mn === 'andi.' && regs.has(op.rs)) bits.push({ mask: op.imm & 0xffff, addr: o.addr });
      else if (op.mn === 'andis.' && regs.has(op.rs)) bits.push({ mask: ((op.imm & 0xffff) << 16) >>> 0, addr: o.addr });
      else if (/^(rlwinm|clrlwi|slwi|srwi|extrwi|rotlwi)\.?$/.test(op.mn) && regs.has(op.rs) && op.mb !== undefined) {
        const mask = novaRlwinmBits(op.sh || 0, op.mb, op.me);
        // a zero extension of a half word or a byte is the whole value, not a bit,
        // and a mask of more than eight bits passes the value on (clearing the top bit), not a test
        const n = mask.toString(2).replace(/0/g, '').length;
        if (mask === 0xffff || mask === 0xff || n > 8) regs.add(op.ra);
        else bits.push({ mask, addr: o.addr });
      }
      else if ((op.mn === 'cmpwi' || op.mn === 'cmplwi') && regs.has(op.ra)) compares.push({ value: op.imm, addr: o.addr });
      else if (/^(extsh|extsb|mr)\.?$/.test(op.mn) && regs.has(op.rs)) regs.add(op.ra);
      // the value's register written by anything else
      const w = op.rd !== undefined ? op.rd : op.rs !== undefined && op.ra !== undefined && op.d === undefined ? op.ra : op.mn[0] === 'l' ? op.rt : undefined;
      if (w !== undefined && regs.has(w) && !/^(extsh|extsb|mr|clrlwi|rlwinm)\.?$/.test(op.mn)) regs.delete(w);
      if (!regs.size) break;
    }
  }
  return { bits, compares };
}

/* A field's facts in the open program: { reads: [{ routine, addr }],
   writes: [{ routine, addr }], bits: Map mask -> [addr], compares: Map
   value -> [addr] }, or null for a field with no place found. */
function novaFieldFacts(prog, type, field) {
  const kept = novaFieldHit(prog, type, field);
  if (!kept) return null;
  const index = novaAccessIndex(prog), keys = [];
  for (const g of kept.direct) for (const off of kept.recs) keys.push(g + '@' + off);
  for (const t of kept.arrays) for (const off of t.offs) keys.push(t.g + '@' + off);
  const reads = [], writes = [], bits = new Map(), compares = new Map();
  const add = (m, k, addr) => { if (!m.has(k)) m.set(k, []); m.get(k).push(addr); };
  for (const k of new Set(keys)) for (const x of index.get(k) || []) {
    if (!x.load) { writes.push({ routine: x.routine, addr: x.addr }); continue; }
    reads.push({ routine: x.routine, addr: x.addr });
    if (x.fp || x.i === undefined) continue;
    const f = novaFactsAfter(prog, prog.ops(x.routine), x.i, x.rt);
    for (const b of f.bits) add(bits, b.mask, b.addr);
    for (const c of f.compares) add(compares, c.value, c.addr);
  }
  const order = (x, y) => x.addr - y.addr;
  return { reads: reads.sort(order), writes: writes.sort(order), bits, compares };
}
