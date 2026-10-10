/* nova-program.js -- the game's program, read: its PowerPC code as
   routines, each instruction with what it touches named.
   =========================================================================

   A classic Mac release's EV Nova is a PEF container (mac-pef.js) whose
   code section is PowerPC (mac-ppc.js). Its own routines carry no names
   -- only the 151 of the runtime library CodeWarrior linked in end with a
   named traceback table -- so a routine is found from the code itself: it
   starts where a `bl` lands, where a transition vector in the data points,
   or where a traceback table says. What a routine does shows in what it
   names:

     a call to glue, the six instructions that load a transition vector out
       of the TOC and jump through it, is a call to the import whose
       transition vector that TOC word is relocated to (GetPicture,
       Get1Resource ...);
     a load from the TOC (`lwz rN, d(r2)`) is the word the loader puts
       there: an import, or an address in the data section, often of a
       string, which is shown;
     `lis` then `addi` or `ori` of the same register makes a 32-bit
       constant, shown as four characters when they are a resource type.

   Addresses are the code section's offsets plus 0x100000, where the
   workbench's tools/pefreloc_nova.py lays it, so the site and the
   findings cite one number.

   novaProgram(bytes) -> the program, or null for what is not a PEF
   container; prog.routines, sorted by start; prog.routineAt(addr);
   prog.ops(routine) -> [{ addr, op, note, target }]; prog.callers(addr).

   Figures the site states from the program are read from it by the shape
   of the instructions around them (novaFigure), never by an address, and
   come back with the address of the instruction that holds them, which
   the page links to.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after mac-ppc.js, mac-pef.js,
   mac-resfork.js and mac-bytes.js. */

const NOVA_CODE_BASE = 0x100000;

function novaProgram(bytes, rsrc) {
  const img = pefLoad(bytes);
  if (!img) return null;
  const secs = img.pef.sections;
  const codeIdx = secs.findIndex(s => s.kind === 0), dataIdx = img.toc ? img.toc.section : secs.findIndex(s => s.kind === 1 || s.kind === 2);
  if (codeIdx < 0 || !img.contents[codeIdx]) return null;
  const code = img.contents[codeIdx].bytes, data = dataIdx >= 0 && img.contents[dataIdx] ? img.contents[dataIdx].bytes : new Uint8Array(0);
  const W = code.length >>> 2;
  const word = i => ((code[4 * i] << 24) | (code[4 * i + 1] << 16) | (code[4 * i + 2] << 8) | code[4 * i + 3]) >>> 0;
  const A = off => off + NOVA_CODE_BASE;

  // where routines start: bl targets, transition vectors in the data, traceback tables, the entry point
  const starts = new Set(), calls = new Map();
  for (let i = 0; i < W; i++) {
    const w = word(i);
    if ((w >>> 26) !== 18 || (w & 3) !== 1) continue;            // bl, relative, linking
    let d = w & 0x03FFFFFC; if (d & 0x02000000) d -= 0x04000000;
    const t = 4 * i + d;
    if (t < 0 || t >= code.length) continue;
    starts.add(t);
    if (!calls.has(t)) calls.set(t, []);
    calls.get(t).push(4 * i);
  }
  const dataRel = img.relocs.bySection.get(dataIdx);
  if (dataRel) for (const [off, t] of dataRel) if (t.section === codeIdx) { const v = u32be(data, off); if (v < code.length) starts.add(v); }
  const named = new Map();
  for (const tb of pefTracebacks(img.pef, bytes)) {
    const off = tb.offset - secs[codeIdx].containerOffset;
    if (off >= 0 && off < code.length) { starts.add(off); named.set(off, tb.name); }
  }
  if (img.pef.loader && img.pef.loader.mainSection === dataIdx) { const v = u32be(data, img.pef.loader.mainOffset); if (v < code.length) starts.add(v); }

  // what a TOC word holds once loaded
  const toc = img.toc;
  const slot = d => (toc ? pefPointerAt(img, toc.section, toc.offset + d) : null);
  // glue: lwz r12,d(r2); stw r2,20(r1); lwz r0,0(r12); lwz r2,4(r12); mtctr r0; bctr
  const glueName = off => {
    if (off + 24 > code.length) return null;
    const w0 = word(off >> 2);
    if (((w0 & 0xFFFF0000) >>> 0) !== 0x81820000 || word((off >> 2) + 1) !== 0x90410014 || word((off >> 2) + 2) !== 0x800C0000 ||
        word((off >> 2) + 3) !== 0x804C0004 || word((off >> 2) + 4) !== 0x7C0903A6 || word((off >> 2) + 5) !== 0x4E800420) return null;
    const p = slot(ppcSext16(w0 & 0xFFFF));
    return p && p.name ? p.name : null;
  };

  const sorted = [...starts].sort((a, b) => a - b);
  const routines = sorted.map((s, i) => {
    const end = i + 1 < sorted.length ? sorted[i + 1] : code.length;
    const glue = glueName(s);
    return { start: A(s), end: A(end), off: s, len: end - s, name: glue || named.get(s) || null, glue: !!glue };
  });
  const byStart = new Map(routines.map(r => [r.start, r]));
  const routineAt = addr => {
    let lo = 0, hi = routines.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (routines[m].start <= addr) lo = m + 1; else hi = m - 1; }
    const r = routines[hi];
    return r && addr < r.end ? r : null;
  };
  const nameOf = r => r.name || 'routine ' + hex(r.start);

  // a string at a data offset: C, else Pascal; null for anything else
  const textAt = off => {
    if (off < 0 || off >= data.length) return null;
    const ok = c => (c >= 0x20 && c < 0x7f) || (c >= 0x80 && c !== 0xff) || c === 13;
    let e = off; while (e < data.length && ok(data[e])) e++;
    if (e - off >= 3 && data[e] === 0) return decodeMacRoman(data.subarray(off, e));
    const n = data[off];
    if (n >= 2 && off + 1 + n <= data.length) {
      const s = data.subarray(off + 1, off + 1 + n);
      if (s.every(c => c >= 0x20 && c !== 0x7f && c !== 0xff)) return decodeMacRoman(s);
    }
    return null;
  };
  const printable4 = v => [24, 16, 8, 0].every(k => { const c = (v >>> k) & 255; return c >= 0x20 && c !== 0x7f && c !== 0xff; });
  const four = v => decodeMacRoman(new Uint8Array([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]));

  // a routine's instructions, with what each names
  const opsCache = new Map();
  function ops(r) {
    if (opsCache.has(r.start)) return opsCache.get(r.start);
    const out = [], hiOf = new Map();
    for (let off = r.off; off < r.off + r.len; off += 4) {
      const w = word(off >> 2), op = ppcDecode(w);
      const o = { addr: A(off), word: w, op, note: null, target: null };
      if (op) {
        if (op.op === 18 && (w & 1)) {
          let d = w & 0x03FFFFFC; if (d & 0x02000000) d -= 0x04000000;
          const t = byStart.get(A(off + d));
          if (t) { o.target = t.start; o.note = nameOf(t); }
        } else if (op.mn === 'lwz' && op.ra === 2) {
          const p = slot(op.d);
          if (p && p.name) o.note = p.name;
          else if (p && p.section === dataIdx) {
            // a transition vector in the data: a pointer to a routine
            const tv = dataRel && dataRel.get(p.offset), t = tv && tv.section === codeIdx ? byStart.get(A(u32be(data, p.offset))) : null;
            if (t) { o.target = t.start; o.note = 'pointer to ' + nameOf(t); o.pointer = true; }
            else { const s = textAt(p.offset); o.note = s !== null ? JSON.stringify(s) : 'data ' + hex(p.offset); o.data = p.offset; o.text = s; }
          }
          else if (p && p.section === codeIdx) { const t = byStart.get(A(p.offset)); o.note = t ? nameOf(t) : 'code ' + hex(A(p.offset)); if (t) o.target = t.start; }
        } else if (op.mn === 'lis') hiOf.set(op.rd, (op.imm & 0xFFFF) << 16);
        else if ((op.mn === 'addi' && hiOf.has(op.ra)) || (op.mn === 'ori' && hiOf.has(op.rs))) {
          const src = op.mn === 'addi' ? op.ra : op.rs, h = hiOf.get(src);
          const v = (op.mn === 'addi' ? (h + op.imm) : (h | (op.imm & 0xFFFF))) >>> 0;
          o.value = v;
          o.note = printable4(v) ? `'${four(v)}'` : String(v | 0);
          hiOf.delete(src);
        }
      }
      out.push(o);
    }
    opsCache.set(r.start, out);
    return out;
  }
  const callers = addr => (calls.get(addr - NOVA_CODE_BASE) || []).map(o => A(o));

  let res = null;
  if (rsrc && rsrc.length) { try { res = openResourceFork(rsrc); } catch (e) { res = null; } }
  return { img, code, data, res, routines, routineAt, byStart, ops, callers, nameOf, textAt, glueName, base: NOVA_CODE_BASE, kind: 'pef' };
}

function hex(v) { return '0x' + (v >>> 0).toString(16); }

/* The routines that call an import, by its name. */
function novaCallersOfImport(prog, name) {
  const glue = prog.routines.filter(r => r.glue && r.name === name);
  const out = new Set();
  for (const g of glue) for (const a of prog.callers(g.start)) { const r = prog.routineAt(a); if (r) out.add(r); }
  return [...out].sort((a, b) => a.start - b.start);
}

/* Routines whose instructions name something matching a query: an import
   called, a string loaded, a resource type made, a constant. [{ routine,
   addr, note }], the first hit in each routine. */
function novaSearchProgram(prog, q, limit = 200) {
  const s = String(q || '').trim();
  if (!s) return [];
  const want = s.toLowerCase(), num = /^-?(0x[0-9a-f]+|\d+)$/i.test(s) ? Number(s) : null;
  const out = [];
  for (const r of prog.routines) {
    if (r.glue) continue;
    if (r.name && r.name.toLowerCase().includes(want)) { out.push({ routine: r, addr: r.start, note: r.name }); if (out.length >= limit) break; continue; }
    for (const o of prog.ops(r)) {
      const hit = (o.note && o.note.toLowerCase().includes(want)) || (num !== null && o.op && (o.op.imm === num || o.value === num));
      if (hit) { out.push({ routine: r, addr: o.addr, note: o.note || o.op.text }); break; }
    }
    if (out.length >= limit) break;
  }
  return out;
}

/* ---- what the site reads out of the program ------------------------------

   Each reader finds its figure by the shape of the code around it, from
   anchors the files give: a system call's name, a resource type the code
   makes, a dialog whose item list the program's resource fork names. A
   reader that does not find its shape gives null, and the page leaves the
   figure out. A figure is { value, addr, routine }: the instruction that
   holds it and the routine it is in. */

// The last instruction before `i` that sets register `reg`, within `back` instructions and no call between.
function novaSetterBefore(ops, i, reg, back = 12) {
  for (let k = i - 1; k >= 0 && k >= i - back; k--) {
    const o = ops[k], op = o.op;
    if (!op) return null;
    if (op.op === 18 && (o.word & 1)) return null;
    if (op.rd === reg || (op.rs !== undefined && op.ra === reg) || (op.rt === reg && /^l/.test(op.mn))) return { o, k };
  }
  return null;
}
// The calls in a routine to a routine or an import: [{ o, i }].
function novaCallsIn(prog, r, target) {
  const want = typeof target === 'string' ? new Set(prog.routines.filter(g => g.glue && g.name === target).map(g => g.start)) : new Set([target]);
  return prog.ops(r).map((o, i) => ({ o, i })).filter(x => x.o.target !== null && want.has(x.o.target));
}

/* Routines the readers recognise, named for what shows they are:
   [{ routine, name, why }]. */
function novaNamedRoutines(prog, game) {
  if (prog.named) return prog.named;
  const out = [];
  const desc = novaFigure(prog, 'descLoader', game);
  if (desc) out.push({ routine: prog.byStart.get(desc.routine), name: 'Loads a description', why: "makes the resource type 'dësc', and is called most of the routines that do" });
  for (const d of novaDialogRoutines(prog)) out.push({ routine: d.routine, name: `Opens "${d.name}"`, why: `asks GetNewDialog for DLOG ${d.dlog}, whose items are DITL ${d.ditl}, named "${d.name}" in the program's resources` });
  for (const r of prog.routines) if (r.name && !r.glue) out.push({ routine: r, name: r.name, why: 'named by its traceback table (the runtime library)' });
  prog.named = out.filter(n => n.routine);
  return prog.named;
}

/* The routines that open a dialog: each call to GetNewDialog whose first
   argument is a constant DLOG id that the program's resource fork has,
   named by that DLOG's item list's name. */
function novaDialogRoutines(prog) {
  if (prog.dialogs) return prog.dialogs;
  const out = [], res = prog.res;
  if (res) {
    const get = (t, id) => { const list = res.resourcesByType[t] || []; return list.find(x => x.id === id); };
    const glue = new Set(prog.routines.filter(g => g.glue && g.name === 'GetNewDialog').map(g => g.start));
    const callers = new Set();
    for (const g of glue) for (const a of prog.callers(g)) { const r = prog.routineAt(a); if (r) callers.add(r); }
    for (const r of callers) {
      const ops = prog.ops(r);
      ops.forEach((o, i) => {
        if (!glue.has(o.target)) return;
        const s = novaSetterBefore(ops, i, 3);
        if (!s || s.o.op.mn !== 'li') return;
        const dlog = s.o.op.imm, d = get('DLOG', dlog);
        if (!d) return;
        const bytes = res.dataOf('DLOG', d), ditl = bytes.length >= 20 ? ((bytes[18] << 8) | bytes[19]) << 16 >> 16 : null;
        const items = ditl !== null ? get('DITL', ditl) : null;
        const name = (items && items.name) || (d.name) || '';
        if (name && !out.some(x => x.routine === r)) out.push({ routine: r, dlog, ditl, name, addr: s.o.addr });
      });
    }
  }
  prog.dialogs = out.sort((a, b) => a.routine.start - b.routine.start);
  return prog.dialogs;
}

/* What each figure is, for the Code view's note on the line it is read
   from: the record type it numbers, the resource type, and where. */
const NOVA_FIGURE_WORDS = {
  outfitDesc: ['oütf', 'dësc', "an outfit's description in the outfitter"],
  outfitPict: ['oütf', 'PICT', "an outfit's picture in the outfitter"],
  shipDesc: ['shïp', 'dësc', "a ship's description in the shipyard"],
  escortDesc: ['shïp', 'dësc', "a ship's description as an escort for hire"],
};
// The figures read from a program, by the address of the instruction holding each.
function novaFiguresByAddr(prog, game) {
  const out = new Map();
  for (const name of Object.keys(NOVA_FIGURE_WORDS)) {
    const f = novaFigure(prog, name, game);
    if (f) { const [rec, res, what] = NOVA_FIGURE_WORDS[name]; out.set(f.addr, `${what}: ${res} ${f.value} + the ${rec}'s number less 128`); }
  }
  return out;
}

/* A figure by name; see the readers below. */
function novaFigure(prog, name, game) {
  const f = NOVA_FIGURES[name];
  try { return f ? f(prog, game) : null; } catch (e) { return null; }
}
const NOVA_FIGURES = {
  // The description loader: of the routines that make 'dësc', the one called most.
  descLoader(prog) {
    const makers = novaSearchProgram(prog, "'dësc'", 50).filter(h => h.note === "'dësc'").map(h => h.routine);
    if (!makers.length) return null;
    const best = makers.reduce((a, b) => (prog.callers(b.start).length > prog.callers(a.start).length ? b : a));
    const o = prog.ops(best).find(x => x.note === "'dësc'");
    return { value: best.start, addr: o.addr, routine: best.start };
  },
  // dësc base for an outfit: added to the item's number before the outfitter calls the description loader.
  outfitDesc(prog, game) { return novaDialogDescBase(prog, game, /^Outfit$/); },
  // PICT base for an outfit: added to the item's number and handed, through a global, to GetPicture in the routines the outfitter calls.
  outfitPict(prog, game) { return novaDialogPictBase(prog, /^Outfit$/); },
  // dësc bases for a ship, in a routine the shipyard calls or points to: a flag tested against 0 picks
  // between two calls to the description loader; the base used when it is 0 is the shipyard's, the other an escort's for hire.
  shipDesc(prog) { const f = novaDescOnFlag(prog, /^Shipyard$/); return f && f.zero; },
  escortDesc(prog) { const f = novaDescOnFlag(prog, /^Shipyard$/); return f && f.set; },
};

function novaDescOnFlag(prog, nameRe) {
  const d = novaDialogRoutines(prog).find(x => nameRe.test(x.name)), desc = NOVA_FIGURES.descLoader(prog);
  if (!d || !desc) return null;
  const near = [d.routine, ...new Set(prog.ops(d.routine).filter(o => o.target !== null).map(o => prog.byStart.get(o.target)).filter(r => r && !r.glue))];
  for (const r of near) {
    const ops = prog.ops(r);
    const calls = novaCallsIn(prog, r, desc.routine).map(({ i }) => ({ i, s: novaSetterBefore(ops, i, 4, 3) })).filter(c => c.s && c.s.o.op.mn === 'addi' && c.s.o.op.imm > 0);
    for (const c of calls) {
      // the instruction before this call's set-up is `bt 2` (equal) past it to the other call, after `cmpwi rX, 0`
      for (let k = c.s.k - 1; k >= Math.max(0, c.s.k - 3); k--) {
        const b = ops[k].op;
        if (!b || !/^bt/.test(b.mn) || b.args[0] !== 2) continue;
        const cmp = ops[k - 1] && ops[k - 1].op;
        if (!cmp || cmp.mn !== 'cmpwi' || cmp.imm !== 0) break;
        const dest = ops[k].addr + Number(String(b.args[1]).replace('.', ''));
        const other = calls.find(x => x !== c && ops[x.s.k].addr >= dest && ops[x.s.k].addr < dest + 16);
        if (!other) break;
        const fig = x => ({ value: x.s.o.op.imm, addr: x.s.o.addr, routine: r.start });
        return { set: fig(c), zero: fig(other) };
      }
    }
  }
  return null;
}

function novaDialogDescBase(prog, game, nameRe) {
  const d = novaDialogRoutines(prog).find(x => nameRe.test(x.name)), desc = NOVA_FIGURES.descLoader(prog);
  if (!d || !desc) return null;
  const ops = prog.ops(d.routine);
  for (const { i } of novaCallsIn(prog, d.routine, desc.routine)) {
    const s = novaSetterBefore(ops, i, 4, 4);
    if (s && s.o.op.mn === 'addi' && s.o.op.imm > 0) return { value: s.o.op.imm, addr: s.o.addr, routine: d.routine.start };
  }
  return null;
}
function novaDialogPictBase(prog, nameRe) {
  const d = novaDialogRoutines(prog).find(x => nameRe.test(x.name));
  if (!d) return null;
  const near = [d.routine, ...new Set(prog.ops(d.routine).filter(o => o.target !== null).map(o => prog.byStart.get(o.target)).filter(r => r && !r.glue))];
  for (const r of near) {
    const ops = prog.ops(r);
    for (const { i } of novaCallsIn(prog, r, 'GetPicture')) {
      // r3 loaded (lha) from where an addi's result was just stored (sth), no call between
      const ld = novaSetterBefore(ops, i, 3, 8);
      if (!ld || ld.o.op.mn !== 'lha') continue;
      for (let k = ld.k - 1; k >= Math.max(0, ld.k - 6); k--) {
        const o = ops[k].op;
        if (!o || (o.op === 18 && (ops[k].word & 1))) break;
        if (o.mn === 'addi' && o.imm >= 128) return { value: o.imm, addr: ops[k].addr, routine: r.start };
      }
    }
  }
  return null;
}
