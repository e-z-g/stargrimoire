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
  if (bytes && bytes.length >= 8 && (u32be(bytes, 0) === 0xCAFEBABE || u32be(bytes, 0) === 0xFEEDFACE)) return novaMachOProgram(bytes);
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

/* Mac 1.1.1's program is a Mach-O file with an Intel and a PowerPC half;
   the PowerPC half is read, with the names its symbol table keeps. Its
   code is GCC's, not CodeWarrior's: no TOC, a global or a string reached
   by `lis` and the low half added or used as a displacement, a call into
   the system through a stub the indirect symbol table names. Addresses
   are the program's own, as llvm-objdump --arch=ppc prints them. */
function novaMachOProgram(file) {
  let bytes = file;
  if (u32be(file, 0) === 0xCAFEBABE) {
    bytes = null;
    for (let i = 0, n = Math.min(u32be(file, 4), 16); i < n; i++) {
      const at = 8 + 20 * i;
      if (u32be(file, at) === 18) bytes = file.subarray(u32be(file, at + 8), u32be(file, at + 8) + u32be(file, at + 12));
    }
    if (!bytes) return null;
  }
  if (u32be(bytes, 0) !== 0xFEEDFACE || u32be(bytes, 4) !== 18) return null;
  const cstr = (at, max) => { let e = at; while (e < at + max && bytes[e]) e++; return decodeMacRoman(bytes.subarray(at, e)); };
  const segs = [], sects = [];
  let symtab = null, indirect = null;
  for (let i = 0, p = 28, n = u32be(bytes, 16); i < n; i++) {
    const cmd = u32be(bytes, p), size = u32be(bytes, p + 4);
    if (cmd === 1) {
      segs.push({ name: cstr(p + 8, 16), vmaddr: u32be(bytes, p + 24), fileoff: u32be(bytes, p + 32), filesize: u32be(bytes, p + 36) });
      for (let k = 0, ns = u32be(bytes, p + 48); k < ns; k++) {
        const q = p + 56 + 68 * k;
        sects.push({ name: cstr(q, 16), seg: cstr(q + 16, 16), addr: u32be(bytes, q + 32), size: u32be(bytes, q + 36), type: u32be(bytes, q + 56) & 0xFF, r1: u32be(bytes, q + 60), r2: u32be(bytes, q + 64) });
      }
    } else if (cmd === 2) symtab = { off: u32be(bytes, p + 8), n: u32be(bytes, p + 12), str: u32be(bytes, p + 16) };
    else if (cmd === 11) indirect = { off: u32be(bytes, p + 56), n: u32be(bytes, p + 60) };
    p += size;
  }
  // a byte at an address, from the file where a segment maps it; -1 where none does
  const at = addr => { for (const s of segs) if (addr >= s.vmaddr && addr < s.vmaddr + s.filesize) return s.fileoff + addr - s.vmaddr; return -1; };
  const word = addr => { const o = at(addr); return o < 0 ? 0 : u32be(bytes, o); };
  const sectOf = addr => sects.find(s => addr >= s.addr && addr < s.addr + s.size) || null;
  const text = sects.find(s => s.seg === '__TEXT' && s.name === '__text');
  if (!text) return null;

  // the symbols: routines in __text, globals elsewhere, and the undefined by index for the stubs
  const syms = [], fnName = new Map(), dataName = new Map();
  if (symtab) for (let i = 0; i < symtab.n; i++) {
    const q = symtab.off + 12 * i, strx = u32be(bytes, q), type = bytes[q + 4], sect = bytes[q + 5], value = u32be(bytes, q + 8);
    const name = cstr(symtab.str + strx, 256).replace(/^_/, '');
    syms.push(name);
    if ((type & 0xE0) || (type & 0x0E) !== 0x0E || !sect) continue;
    const s = sects[sect - 1];
    if (s === text) { if (!fnName.has(value)) fnName.set(value, name); } else if (!dataName.has(value)) dataName.set(value, name);
  }
  const ind = i => { const v = indirect && i < indirect.n ? u32be(bytes, indirect.off + 4 * i) : 0x80000000; return v & 0xC0000000 ? null : syms[v]; };
  const stubs = [], pointsTo = new Map();
  for (const s of sects) {
    if (s.type === 8 && s.r2) for (let k = 0; k < s.size / s.r2; k++) { const n = ind(s.r1 + k); if (n) stubs.push({ start: s.addr + k * s.r2, end: s.addr + (k + 1) * s.r2, name: n }); }
    if (s.type === 6 || s.type === 7) for (let k = 0; k < s.size / 4; k++) {
      const n = ind(s.r1 + k), slotAt = s.addr + 4 * k;
      if (n) { if (!dataName.has(slotAt)) dataName.set(slotAt, n); }
      else if (s.type === 6) pointsTo.set(slotAt, word(slotAt));      // a pointer to the program's own global
    }
  }

  // where routines start: the symbols, and bl targets in __text
  const starts = new Set(fnName.keys()), calls = new Map();
  for (let a = text.addr; a < text.addr + text.size; a += 4) {
    const w = word(a);
    if ((w >>> 26) !== 18 || (w & 3) !== 1) continue;
    let d = w & 0x03FFFFFC; if (d & 0x02000000) d -= 0x04000000;
    const t = a + d;
    if (!calls.has(t)) calls.set(t, []);
    calls.get(t).push(a);
    if (t >= text.addr && t < text.addr + text.size) starts.add(t);
  }
  const sorted = [...starts].sort((a, b) => a - b);
  const routines = sorted.map((s, i) => {
    const end = i + 1 < sorted.length ? sorted[i + 1] : text.addr + text.size;
    return { start: s, end, off: s, len: end - s, name: fnName.get(s) || null, glue: false };
  }).concat(stubs.map(s => ({ start: s.start, end: s.end, off: s.start, len: s.end - s.start, name: s.name, glue: true })));
  routines.sort((a, b) => a.start - b.start);
  const byStart = new Map(routines.map(r => [r.start, r]));
  const routineAt = addr => {
    let lo = 0, hi = routines.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (routines[m].start <= addr) lo = m + 1; else hi = m - 1; }
    const r = routines[hi];
    return r && addr < r.end ? r : null;
  };
  const nameOf = r => r.name || 'routine ' + hex(r.start);

  // a C string at an address; null for anything else
  const textAt = addr => {
    const o = at(addr);
    if (o < 0) return null;
    const ok = c => (c >= 0x20 && c < 0x7f) || (c >= 0x80 && c !== 0xff) || c === 13 || c === 10 || c === 9;
    let e = o; while (e < bytes.length && ok(bytes[e])) e++;
    if (e - o < 1 || bytes[e] !== 0) return null;
    // the strings are UTF-8 where they are not plain ASCII
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(o, e)); } catch (err) { return decodeMacRoman(bytes.subarray(o, e)); }
  };
  const printable4 = v => [24, 16, 8, 0].every(k => { const c = (v >>> k) & 255; return c >= 0x20 && c !== 0x7f && c !== 0xff; });
  const four = v => decodeMacRoman(new Uint8Array([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]));
  const f32 = addr => { const o = at(addr); return o < 0 ? null : new DataView(bytes.buffer, bytes.byteOffset + o, 4).getFloat32(0); };
  const f64 = addr => { const o = at(addr); return o < 0 ? null : new DataView(bytes.buffer, bytes.byteOffset + o, 8).getFloat64(0); };
  // a global by its address: its name where the symbols give one
  const globalAt = addr => dataName.get(addr) || null;
  const dataNote = v => { const s = sectOf(v), str = s && s.name === '__cstring' ? textAt(v) : null; return str !== null ? JSON.stringify(str) : globalAt(v) || (s ? `${/data|common|bss/.test(s.name) ? 'global' : s.name} ${hex(v)}` : null); };

  // a routine's instructions, with what each names
  const opsCache = new Map();
  function ops(r) {
    if (opsCache.has(r.start)) return opsCache.get(r.start);
    const out = [], hiOf = new Map();
    for (let a = r.start; a < r.end; a += 4) {
      const w = word(a), op = ppcDecode(w);
      const o = { addr: a, word: w, op, note: null, target: null };
      out.push(o);
      if (!op) continue;
      if (op.op === 18 && (w & 1)) {
        const t = byStart.get(a + op.disp);
        if (t) { o.target = t.start; o.note = nameOf(t); }
        for (const k of [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) hiOf.delete(k);
        continue;
      }
      if (op.mn === 'lis') { hiOf.set(op.rd, (op.imm & 0xFFFF) << 16); continue; }
      if ((op.mn === 'addi' && hiOf.has(op.ra)) || (op.mn === 'ori' && hiOf.has(op.rs))) {
        const src = op.mn === 'addi' ? op.ra : op.rs, h = hiOf.get(src);
        const v = (op.mn === 'addi' ? (h + op.imm) : (h | (op.imm & 0xFFFF))) >>> 0;
        o.value = v;
        const s = op.mn === 'addi' ? sectOf(v) : null, str = s && s.name === '__cstring' ? textAt(v) : null;
        if (str !== null) { o.note = JSON.stringify(str); o.text = str; o.data = v; }
        else if (s) { o.note = 'address of ' + dataNote(v); o.data = v; }
        else o.note = printable4(v) ? `'${four(v)}'` : String(v | 0);
        hiOf.delete(src);
        if (s) hiOf.set(op.rd, v);
        continue;
      }
      if (op.mn === 'mr' && hiOf.has(op.rs)) { hiOf.set(op.ra, hiOf.get(op.rs)); continue;
      }
      if (op.d !== undefined && op.rt !== undefined && op.ra && hiOf.has(op.ra) && op.mn !== 'lmw' && op.mn !== 'stmw') {
        const v = (hiOf.get(op.ra) + op.d) >>> 0, s = sectOf(v);
        o.data = v;
        const g = globalAt(v);
        if (op.mn === 'lfs' || op.mn === 'lfd') { const x = op.mn === 'lfs' ? f32(v) : f64(v); o.value = x; o.note = x === null ? (g || 'data ' + hex(v)) : `${+x.toPrecision(7)}${g ? ' (' + g + ')' : ''}`; }
        else if (op.mn === 'lwz' && pointsTo.has(v)) { const t = pointsTo.get(v); o.note = 'address of ' + (dataNote(t) || hex(t)); o.data = t; hiOf.set(op.rt, t); continue; }
        else o.note = dataNote(v) || 'data ' + hex(v);
        if (/^l(?!f)/.test(op.mn)) hiOf.delete(op.rt);
        continue;
      }
      // anything else that writes a register forgets what it held
      if (op.rd !== undefined) hiOf.delete(op.rd);
      if (op.rs !== undefined && op.ra !== undefined) hiOf.delete(op.ra);
      if (op.rt !== undefined && /^l(?!f)/.test(op.mn)) hiOf.delete(op.rt);
    }
    opsCache.set(r.start, out);
    return out;
  }
  const callers = addr => calls.get(addr) || [];
  return { kind: 'macho', bytes, sects, routines, routineAt, byStart, ops, callers, nameOf, textAt, globalAt, dataNote, glueName: () => null, base: 0, res: null };
}

function hex(v) { return '0x' + (v >>> 0).toString(16); }

/* A routine by its name, where the program keeps names (1.1.1), or null. */
function novaRoutineNamed(prog, name) {
  if (!prog.byName) { prog.byName = new Map(); for (const r of prog.routines) if (r.name && !r.glue && !prog.byName.has(r.name)) prog.byName.set(r.name, r); }
  return prog.byName.get(name) || null;
}

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
  const why = prog.kind === 'macho' ? "named in the program's symbol table" : 'named by its traceback table (the runtime library)';
  for (const r of prog.routines) if (r.name && !r.glue && !out.some(n => n.routine === r)) out.push({ routine: r, name: r.name, why });
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
   from, and the value the site's own code uses where it has one, which
   program_check holds to the program's. */
const NOVA_FIGURE_WORDS = {
  outfitDesc: [v => `an outfit's description in the outfitter: dësc ${v} + the oütf's number less 128`],
  outfitPict: [v => `an outfit's picture in the outfitter: PICT ${v} + the oütf's number less 128`],
  shipDesc: [v => `a ship's description in the shipyard: dësc ${v} + the shïp's number less 128`, () => novaShipDescId(128)],
  escortDesc: [v => `a ship's description as an escort for hire: dësc ${v} + the shïp's number less 128`, () => novaShipPilotDescId(128)],
  missionOffer: [v => `a mission's offer: dësc ${v} + the mïsn's number less 128`, () => 4000],
  stellarDesc: [v => `a stellar's description in its spaceport: dësc ${v} + the spöb's number less 128`, () => novaStellarDescId({ id: 128 })],
  barDesc: [v => `a stellar's bar: dësc ${v} + the spöb's number less 128`, () => novaStellarBarDescId({ id: 128 })],
  landingPict: [v => `a stellar's landing picture: PICT ${v} + its Type, where CustPicID is under 128`, () => novaLandingPict({ CustPicID: 0, Type: 0 })],
  nebulaPict: [v => `a nebula's pictures: PICT ${v} + 7 × the nëbu's number less 128, and the six after`, () => novaNebulaPictIds({ id: 128 })[0]],
  nebulaPicts: [v => `pictures to a nebula: ${v}`, () => novaNebulaPictIds({ id: 128 }).length],
};
// The figures read from a program, by the address of the instruction holding each.
function novaFiguresByAddr(prog, game) {
  const out = new Map();
  for (const name of Object.keys(NOVA_FIGURE_WORDS)) {
    const f = novaFigure(prog, name, game);
    if (f) out.set(f.addr, NOVA_FIGURE_WORDS[name][0](f.value));
  }
  return out;
}

/* A figure by name; see the readers below. */
function novaFigure(prog, name, game) {
  const f = (prog.kind === 'macho' ? NOVA_MACHO_FIGURES : NOVA_FIGURES)[name];
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

/* ---- the same figures, read from 1.1.1's PowerPC half ---------------------

   There the routines keep their names, so a reader starts from the routine
   the figure is in and finds it by what the code does with it: the number
   added to an item's index before the call that loads its description or
   picture, a loop's first value, a value stored where a call then reads
   it. GCC's code passes the description loader its buffer in r3 and the
   number in r4. */

// The instruction that last set `reg` before ops[i], followed back through copies (mr, extsh, clrlwi): { o, k } or null.
function novaTraceReg(ops, i, reg, back = 16) {
  for (let hop = 0; hop < 6; hop++) {
    const s = novaSetterBefore(ops, i, reg, back);
    if (!s) return null;
    const op = s.o.op;
    if (/^(mr|extsh|extsb|clrlwi)$/.test(op.mn) && op.rs !== undefined) { reg = op.rs; i = s.k; continue; }
    return s;
  }
  return null;
}
// The calls in a named routine to a named routine or import: [{ o, i }], with the routine's ops.
function novaNamedCalls(prog, inName, toName) {
  const r = novaRoutineNamed(prog, inName);
  if (!r) return null;
  const want = new Set(prog.routines.filter(g => g.name === toName).map(g => g.start));
  const ops = prog.ops(r);
  return { r, ops, calls: ops.map((o, i) => ({ o, i })).filter(x => x.o.target !== null && want.has(x.o.target)) };
}
// What the register holds at a call, where an `addi` of a positive number or an `li` set it: a figure, or null.
function novaArgFigure(prog, inName, toName, reg, nth = 0, back = 16) {
  const c = novaNamedCalls(prog, inName, toName);
  if (!c || !c.calls[nth]) return null;
  const s = novaTraceReg(c.ops, c.calls[nth].i, reg, back);
  if (!s || !((s.o.op.mn === 'addi' && s.o.op.imm > 0) || s.o.op.mn === 'li')) return null;
  return { value: s.o.op.imm, addr: s.o.addr, routine: c.r.start, k: s.k, ops: c.ops };
}
const NOVA_MACHO_FIGURES = {
  descLoader(prog) {
    const r = novaRoutineNamed(prog, 'LoadDescription');
    const o = r && prog.ops(r).find(x => x.note === "'dësc'");
    return o ? { value: r.start, addr: o.addr, routine: r.start } : null;
  },
  outfitDesc(prog) { return novaArgFigure(prog, 'OutfitFilter', 'LoadDescription', 4); },
  outfitPict(prog) { return novaArgFigure(prog, 'OutfitDialogUpdate', 'GetPicture', 3); },
  // the shipyard's description, and an escort's for hire: a flag tested against 0 picks the number
  // added, the escort's falling through to a branch over the shipyard's
  shipDesc(prog) { return novaArgFigure(prog, 'ShipyardFilter', 'LoadDescription', 4); },
  escortDesc(prog) {
    const f = novaArgFigure(prog, 'ShipyardFilter', 'LoadDescription', 4);
    if (!f) return null;
    const b = f.ops[f.k - 1], a = f.ops[f.k - 2];
    if (!b || !b.op || b.op.mn !== 'b' || !a || !a.op || a.op.mn !== 'addi' || a.op.rd !== f.ops[f.k].op.rd || a.op.imm <= 0) return null;
    return { value: a.op.imm, addr: a.addr, routine: f.routine };
  },
  missionOffer(prog) { return novaArgFigure(prog, 'MissionFilter', 'LoadDescription', 4); },
  stellarDesc(prog) { return novaArgFigure(prog, 'DoPortDialog', 'LoadDescription', 4); },
  barDesc(prog) { return novaArgFigure(prog, 'DoBarDialog', 'LoadDescription', 4); },
  // a stellar's landing picture: its Type plus this, stored to a global the next instructions hand GetPicture
  landingPict(prog) {
    const c = novaNamedCalls(prog, 'PreloadPortDialog', 'GetPicture');
    if (!c) return null;
    for (const { i } of c.calls) {
      const ld = novaTraceReg(c.ops, i, 3);
      if (!ld || ld.o.op.mn !== 'lha') continue;
      const base = novaSetterBefore(c.ops, ld.k, ld.o.op.ra);
      if (!base || base.o.data === undefined) continue;
      for (let k = base.k - 1; k >= Math.max(0, base.k - 8); k--) {
        const st = c.ops[k].op;
        if (!st || st.mn !== 'sth') continue;
        const where = novaSetterBefore(c.ops, k, st.ra), what = novaSetterBefore(c.ops, k, st.rt);
        if (where && where.o.data === base.o.data && what && what.o.op.mn === 'addi' && what.o.op.imm > 0) return { value: what.o.op.imm, addr: what.o.addr, routine: c.r.start };
      }
    }
    return null;
  },
  // a nebula's pictures: a loop from this, counted down from nebulaPicts for each nebula
  nebulaPict(prog) { return novaArgFigure(prog, 'DoSystemMap', 'GetPicture', 3, 0, 32); },
  nebulaPicts(prog) {
    const c = novaNamedCalls(prog, 'DoSystemMap', 'GetPicture');
    if (!c || !c.calls[0]) return null;
    // the counter: a register `addi rX, rC, -1` after the call, rC set by `li` before it
    for (let k = c.calls[0].i + 1; k < c.calls[0].i + 8; k++) {
      const op = c.ops[k].op;
      if (!op || op.mn !== 'addi' || op.imm !== -1) continue;
      const s = novaSetterBefore(c.ops, c.calls[0].i, op.ra, 8);
      if (s && s.o.op.mn === 'li' && s.o.op.imm > 1) return { value: s.o.op.imm, addr: s.o.addr, routine: c.r.start };
    }
    return null;
  },
};

/* ---- what the program loads by number --------------------------------------

   Each call to a loader whose number was set by an `li` is a fixed
   resource the program loads there; an `addi` of 128 or more is a base an
   index is added to; an `li` whose register goes up by one after the call
   is the first of a run (a loop over sprites or sounds). The loaders: the
   description loader (its number in r4), GetPicture, GetCIcon and
   ST_LoadSndResource (r3), GetIndString and StrcatIndCString (the list in
   r4, the entry in r5) and DrawIndString (r3 and r4).
   novaProgramUses(prog, game) -> { fixed: Map('PICT 8502' -> [{ routine,
   addr, index, run }]), bases: [{ res, value, routine, addr }] }. */
const NOVA_LOADERS = [
  ['GetPicture', 'PICT', 3], ['GetCIcon', 'cicn', 3], ['ST_LoadSndResource', 'snd ', 3],
  ['GetIndString', 'STR#', 4, 5], ['StrcatIndCString', 'STR#', 4, 5], ['DrawIndString', 'STR#', 3, 4],
];
// As novaTraceReg, but on past a call for the registers a call keeps (r13 to r31).
function novaTraceArg(ops, i, reg, back = 40) {
  for (let hop = 0; hop < 6; hop++) {
    let found = null;
    for (let k = i - 1; k >= 0 && k >= i - back; k--) {
      const o = ops[k], op = o.op;
      if (!op) return null;
      if (op.op === 18 && (o.word & 1)) { if (reg < 13) return null; continue; }
      if (op.rd === reg || (op.rs !== undefined && op.ra === reg) || (op.rt === reg && /^l(?!f)/.test(op.mn))) { found = { o, k }; break; }
    }
    if (!found) return null;
    const op = found.o.op;
    if (/^(mr|extsh|extsb|clrlwi)$/.test(op.mn) && op.rs !== undefined) { reg = op.rs; i = found.k; continue; }
    return found;
  }
  return null;
}
function novaProgramUses(prog, game) {
  if (prog.uses) return prog.uses;
  const fixed = new Map(), bases = [];
  const desc = novaFigure(prog, 'descLoader', game);
  const loaders = NOVA_LOADERS.map(([name, res, reg, idx]) => ({ starts: new Set(prog.routines.filter(r => r.glue && r.name === name || (prog.kind === 'macho' && r.name === name)).map(r => r.start)), res, reg, idx }));
  if (desc) loaders.push({ starts: new Set([desc.routine]), res: 'dësc', reg: 4 });
  const add = (key, use) => {
    if (!fixed.has(key)) fixed.set(key, []);
    if (!fixed.get(key).some(u => u.routine === use.routine && u.index === use.index)) fixed.get(key).push(use);
  };
  for (const r of prog.routines) {
    if (r.glue) continue;
    const ops = prog.ops(r);
    for (let i = 0; i < ops.length; i++) {
      const L = ops[i].target !== null && loaders.find(l => l.starts.has(ops[i].target));
      if (!L) continue;
      const s = novaTraceArg(ops, i, L.reg);
      if (!s) continue;
      let index = null;
      if (L.idx) { const x = novaTraceArg(ops, i, L.idx); if (x && x.o.op.mn === 'li') index = x.o.op.imm; }
      const op = s.o.op;
      if (op.mn === 'addi' && op.imm >= 128 && op.ra !== 1) { bases.push({ res: L.res, value: op.imm, routine: r.start, addr: s.o.addr }); continue; }
      if (op.mn !== 'li' || op.imm < 128) continue;
      // the first of a run: its register one more after the call
      const run = ops.slice(i + 1, i + 16).some(o => o.op && o.op.mn === 'addi' && o.op.imm === 1 && o.op.ra === op.rd);
      add(`${L.res} ${op.imm}`, { routine: r.start, addr: s.o.addr, index, run });
      // the other of two numbers a test picks between: an `li` of the same register before a branch over this one
      const b = ops[s.k - 1] && ops[s.k - 1].op;
      if (b && b.op === 16) {
        const t = novaTraceArg(ops, s.k - 1, op.rd, 8);
        if (t && t.o.op.mn === 'li' && t.o.op.imm >= 128) add(`${L.res} ${t.o.op.imm}`, { routine: r.start, addr: t.o.addr, index, run: false });
      }
    }
  }
  prog.uses = { fixed, bases };
  return prog.uses;
}
