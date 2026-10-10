/* mac-pef.js -- the Preferred Executable Format, read.

   A PEF container is what a PowerPC classic Mac application's data fork is:
   a header, a table of sections (code, data, the loader), and inside the
   loader section the list of shared libraries the program imports and the
   symbols it takes from each, its exports, and its entry point. Nothing
   here knows Cythera exists; this is the mac-* tier, like the resource
   fork reader beside it.

   parsePEF(bytes)          -> { arch, version, sections, loader } or null
   pefTracebacks(pef, bytes) -> every routine the code section names for
                                itself, with its offset and length
   pefDemangle(name)        -> a CodeWarrior C++ symbol as Class::method(args)

   The routine names are the interesting half. CodeWarrior's PowerPC back
   end ends every routine with an AIX-style traceback table: a zero word,
   eight bytes of flags, then optional fields as the flags say, among them
   the routine's length (has_tboff) and its name (name_present, a 16-bit
   length and the bytes, with a leading '.'). So the code section carries
   its own map of where every routine starts and what it was called, and a
   walk over the section reads it back -- 1,877 of them in Cythera 1.0.4.
   The layout is the AIX traceback table as documented for the PowerPC
   ABI; the field order matters and is spelt out at pefTracebacks. The
   walk is checked against a list of the same routines recovered
   independently (utilities/pef_check.mjs), address for address.

   The mangling is CodeWarrior's cfront-style: name__<n>Class<F args>,
   __ct and __dt for constructors and destructors, Q2<n>A<n>B for a nested
   class, and one-letter type codes for the arguments. pefDemangle reads
   what it can and leaves the mangled text where it cannot, so a name is
   never invented. */

function pefU32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function pefU16(b, o) { return (b[o] << 8) | b[o + 1]; }
function pefI32(b, o) { return pefU32(b, o) | 0; }
function pefCStr(b, o) {
  let e = o; while (e < b.length && b[e]) e++;
  let s = ''; for (let i = o; i < e; i++) s += String.fromCharCode(b[i]);
  return s;
}

const PEF_SECTION_KINDS = { 0: 'code', 1: 'unpacked data', 2: 'pattern data', 3: 'constant', 4: 'loader', 5: 'debug', 6: 'executable data', 7: 'exception', 8: 'traceback' };
const PEF_SYMBOL_CLASSES = { 0: 'code', 1: 'data', 2: 'transition vector', 3: 'TOC', 4: 'glue' };

function parsePEF(bytes) {
  const b = bytes;
  if (!b || b.length < 40) return null;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]) + String.fromCharCode(b[4], b[5], b[6], b[7]);
  if (tag !== 'Joy!peff') return null;
  const arch = String.fromCharCode(b[8], b[9], b[10], b[11]);
  const formatVersion = pefU32(b, 12), dateTimeStamp = pefU32(b, 16);
  const oldDefVersion = pefU32(b, 20), oldImpVersion = pefU32(b, 24), currentVersion = pefU32(b, 28);
  const sectionCount = pefU16(b, 32), instSectionCount = pefU16(b, 34);
  const sections = [];
  for (let i = 0; i < sectionCount; i++) {
    const o = 40 + i * 28;
    if (o + 28 > b.length) return null;
    sections.push({
      index: i, nameOffset: pefI32(b, o), defaultAddress: pefU32(b, o + 4), totalSize: pefU32(b, o + 8),
      unpackedSize: pefU32(b, o + 12), packedSize: pefU32(b, o + 16), containerOffset: pefU32(b, o + 20),
      kind: b[o + 24], kindName: PEF_SECTION_KINDS[b[o + 24]] || ('kind ' + b[o + 24]),
      shareKind: b[o + 25], alignment: b[o + 26], name: ''
    });
  }
  // Section names, if any, follow the section table as C strings.
  const nameBase = 40 + sectionCount * 28;
  for (const s of sections) if (s.nameOffset >= 0 && nameBase + s.nameOffset < b.length) s.name = pefCStr(b, nameBase + s.nameOffset);
  const pef = { arch, formatVersion, dateTimeStamp, oldDefVersion, oldImpVersion, currentVersion, sectionCount, instSectionCount, sections, loader: null };
  const ld = sections.find(s => s.kind === 4);
  if (ld && ld.containerOffset + 56 <= b.length) pef.loader = parsePEFLoader(b, ld.containerOffset, ld.packedSize);
  return pef;
}

/* The loader section: a 56-byte header, then the imported library table
   (24 bytes each), the imported symbol table (a u32 each: class in the
   high byte, string offset in the low 24), the relocation headers and
   instructions, the string table, and the export hash, key and symbol
   tables. */
function parsePEFLoader(b, base, size) {
  const h = {
    mainSection: pefI32(b, base), mainOffset: pefU32(b, base + 4),
    initSection: pefI32(b, base + 8), initOffset: pefU32(b, base + 12),
    termSection: pefI32(b, base + 16), termOffset: pefU32(b, base + 20),
    importedLibraryCount: pefU32(b, base + 24), totalImportedSymbolCount: pefU32(b, base + 28),
    relocSectionCount: pefU32(b, base + 32), relocInstrOffset: pefU32(b, base + 36),
    loaderStringsOffset: pefU32(b, base + 40), exportHashOffset: pefU32(b, base + 44),
    exportHashTablePower: pefU32(b, base + 48), exportedSymbolCount: pefU32(b, base + 52)
  };
  const strs = base + h.loaderStringsOffset;
  const symbols = [];
  const symBase = base + 56 + h.importedLibraryCount * 24;
  for (let i = 0; i < h.totalImportedSymbolCount; i++) {
    const v = pefU32(b, symBase + i * 4);
    const cls = (v >> 24) & 0x0F;
    symbols.push({ index: i, classCode: cls, className: PEF_SYMBOL_CLASSES[cls] || ('class ' + cls), weak: !!(v & 0x80000000), name: pefCStr(b, strs + (v & 0x00FFFFFF)) });
  }
  const libraries = [];
  for (let i = 0; i < h.importedLibraryCount; i++) {
    const o = base + 56 + i * 24;
    const nameOffset = pefU32(b, o), oldImpVersion = pefU32(b, o + 4), currentVersion = pefU32(b, o + 8);
    const count = pefU32(b, o + 12), first = pefU32(b, o + 16), options = b[o + 20];
    libraries.push({ index: i, name: pefCStr(b, strs + nameOffset), oldImpVersion, currentVersion, importedSymbolCount: count, firstImportedSymbol: first,
                     weak: !!(options & 0x40), initBefore: !!(options & 0x80), symbols: symbols.slice(first, first + count) });
  }
  // Relocation headers, one per section with relocations.
  const relocSections = [];
  const rhBase = symBase + h.totalImportedSymbolCount * 4;
  for (let i = 0; i < h.relocSectionCount; i++) {
    const o = rhBase + i * 12;
    relocSections.push({ sectionIndex: pefU16(b, o), relocCount: pefU32(b, o + 4), firstRelocOffset: pefU32(b, o + 8) });
  }
  // Exports: after the hash table and the export keys come the symbols,
  // 10 bytes each: class and name offset in a u32, value, section.
  const exports = [];
  const power = h.exportHashTablePower;
  const hashBase = base + h.exportHashOffset;
  const keyBase = hashBase + (1 << power) * 4;
  const expBase = keyBase + h.exportedSymbolCount * 4;
  for (let i = 0; i < h.exportedSymbolCount; i++) {
    const o = expBase + i * 10;
    if (o + 10 > b.length) break;
    const v = pefU32(b, o), cls = (v >> 24) & 0x0F;
    const nameOff = v & 0x00FFFFFF;
    const len = pefU16(b, keyBase + i * 4);   // the key holds the name's length
    let name = ''; for (let k = 0; k < len && strs + nameOff + k < b.length; k++) name += String.fromCharCode(b[strs + nameOff + k]);
    exports.push({ classCode: cls, className: PEF_SYMBOL_CLASSES[cls] || ('class ' + cls), name, value: pefU32(b, o + 4), sectionIndex: pefU16(b, o + 8) | 0 });
  }
  return Object.assign(h, { libraries, symbols, relocSections, exports, size });
}

/* ---- the sections as the loader leaves them -----------------------------
   Reading a figure out of a PowerPC program means following its pointers:
   a routine finds its globals through r2, the TOC, and a TOC slot holds an
   address that only exists once the Code Fragment Manager has laid the
   sections out and relocated them. So this does what the loader does, as
   far as reading needs: the sections' contents, the pattern-packed data
   expanded, and the relocations interpreted -- not to fill in addresses,
   since there is no memory to put them in, but to say of every relocated
   word which section or which import it points into. A stored word plus
   "relocated by section 1" is an offset into section 1, which is all a
   reader wants.

   Written from the PEF format as the Mac OS runtime architecture documents
   it (Apple, "Mac OS Runtime Architectures", chapter 8), not from a loader.
   `utilities/pef_check.mjs` holds it to the structure's own arithmetic --
   the pattern stream ends exactly at the declared size, each relocation
   stream is consumed exactly, and every relocated word lands inside the
   section or the import list it names -- and, with the workbench beside
   this repository, to that repository's separate loader simulator. */

// The pattern-initialised data a kind-2 section holds, expanded. Each
// opcode is a byte, the high three bits the operation and the low five a
// count, 0 meaning the count follows as an argument; arguments are seven
// bits a byte, high bit set to continue.
function pefExpandPattern(b, start, packedSize, size) {
  const out = new Uint8Array(size);
  const end = start + packedSize;
  let p = start, o = 0, bad = null;
  const arg = () => { let v = 0, byte; do { byte = b[p++]; v = (v * 128) + (byte & 0x7F); } while ((byte & 0x80) && p < end); return v; };
  const copy = n => { for (let k = 0; k < n; k++) { if (o < size) out[o] = b[p + k]; o++; } p += n; };
  while (p < end && !bad) {
    const byte = b[p++], opc = byte >> 5, cnt = byte & 0x1F;
    if (opc === 0) { o += cnt || arg(); }                                        // zero fill
    else if (opc === 1) { copy(cnt || arg()); }                                  // block copy
    else if (opc === 2) {                                                        // repeat a block
      const n = cnt || arg(), times = arg() + 1, at = p;
      for (let t = 0; t < times; t++) { p = at; copy(n); }
    } else if (opc === 3) {                                                      // common block, then (custom, common) x repeat
      const common = cnt || arg(), custom = arg(), times = arg(), c0 = p;
      copy(common);
      for (let t = 0; t < times; t++) { copy(custom); const save = p; p = c0; copy(common); p = save; }
    } else if (opc === 4) {                                                      // zeros, then (custom, zeros) x repeat
      const zeros = cnt || arg(), custom = arg(), times = arg();
      o += zeros;
      for (let t = 0; t < times; t++) { copy(custom); o += zeros; }
    } else bad = 'pattern opcode ' + opc + ' at ' + (p - 1);
  }
  return { bytes: out, produced: o, consumed: p - start, problem: bad };
}

/* The relocations of every section that has any: for each relocated word,
   what was added to it. The state is the specification's: a position in
   the section, sectionC and sectionD (instantiated sections 0 and 1 until
   set otherwise), and an import index. Instructions are 16-bit words, a
   few of them two words long; a repeat replays whole instructions. */
function pefRelocations(pef, bytes) {
  const b = bytes, ld = pef.loader;
  const result = { bySection: new Map(), problems: [] };
  if (!ld) return result;
  const ldSec = pef.sections.find(s => s.kind === 4);
  const base = ldSec.containerOffset;
  const imports = ld.symbols.length;
  for (const rh of ld.relocSections) {
    const sec = pef.sections[rh.sectionIndex];
    const map = new Map();
    result.bySection.set(rh.sectionIndex, map);
    const start = base + ld.relocInstrOffset + rh.firstRelocOffset;
    const words = []; for (let j = 0; j < rh.relocCount; j++) words.push(pefU16(b, start + j * 2));
    // The instructions as units, so a repeat can replay them.
    const units = [];
    for (let j = 0; j < words.length;) {
      const x = words[j], two = (x >> 12) === 0xA || (x >> 12) === 0xB;
      units.push(two ? [x, words[j + 1]] : [x]);
      j += two ? 2 : 1;
    }
    let pos = 0, sectC = 0, sectD = 1, imp = 0;
    const mark = (target) => {
      if (pos + 4 > (sec ? sec.totalSize : 0)) result.problems.push('section ' + rh.sectionIndex + ': a relocation at ' + pos + ' past the end');
      if (target.import !== undefined && target.import >= imports) result.problems.push('section ' + rh.sectionIndex + ': import ' + target.import + ' of ' + imports);
      map.set(pos, target); pos += 4;
    };
    const run = (u) => {
      const x = u[0];
      if ((x >> 14) === 0) { pos += ((x >> 6) & 0xFF) * 4; for (let k = x & 0x3F; k > 0; k--) mark({ section: sectD }); return; }
      if ((x >> 13) === 2) {
        const sub = (x >> 9) & 0xF, n = (x & 0x1FF) + 1;
        for (let k = 0; k < n; k++) {
          if (sub === 0) mark({ section: sectC });
          else if (sub === 1) mark({ section: sectD });
          else if (sub === 2) { mark({ section: sectC }); mark({ section: sectD }); pos += 4; }
          else if (sub === 3) { mark({ section: sectC }); mark({ section: sectD }); }
          else if (sub === 4) { mark({ section: sectD }); pos += 4; }
          else if (sub === 5) mark({ import: imp++ });
          else { result.problems.push('relocation run subopcode ' + sub); return; }
        }
        return;
      }
      if ((x >> 13) === 3) {
        const sub = (x >> 9) & 0xF, idx = x & 0x1FF;
        if (sub === 0) { mark({ import: idx }); imp = idx + 1; }
        else if (sub === 1) sectC = idx;
        else if (sub === 2) sectD = idx;
        else if (sub === 3) mark({ section: idx });
        else result.problems.push('relocation index subopcode ' + sub);
        return;
      }
      if ((x >> 12) === 8) { pos += (x & 0x0FFF) + 1; return; }
      const hi6 = x >> 10, low26 = ((x & 0x3FF) << 16) | (u[1] || 0);
      if (hi6 === 0x28) { pos = low26; return; }
      if (hi6 === 0x29) { mark({ import: low26 }); imp = low26 + 1; return; }
      if (hi6 === 0x2D) {
        const sub = (x >> 6) & 0xF, idx = ((x & 0x3F) << 16) | (u[1] || 0);
        if (sub === 0) mark({ section: idx }); else if (sub === 1) sectC = idx; else if (sub === 2) sectD = idx;
        else result.problems.push('large set-or-by-section subopcode ' + sub);
        return;
      }
      result.problems.push('relocation opcode ' + (x >>> 0).toString(16) + ' in section ' + rh.sectionIndex);
    };
    for (let i = 0; i < units.length; i++) {
      const x = units[i][0];
      if ((x >> 12) === 9) {                                          // small repeat
        const chunk = ((x >> 8) & 0xF) + 1, times = (x & 0xFF) + 1;
        for (let t = 0; t < times; t++) for (let k = i - chunk; k < i; k++) run(units[k]);
      } else if ((x >> 10) === 0x2C) {                                // large repeat
        const chunk = ((x >> 6) & 0xF) + 1, times = ((x & 0x3F) << 16) | units[i][1];
        for (let t = 0; t < times; t++) for (let k = i - chunk; k < i; k++) run(units[k]);
      } else run(units[i]);
    }
    result.problems.length || (pos > (sec ? sec.totalSize : 0) && result.problems.push('section ' + rh.sectionIndex + ' position ended past the end'));
  }
  return result;
}

/* A program laid out for reading: every section's contents, the
   relocations, and the TOC. The TOC is the data word the entry point's
   transition vector holds second, which the loader relocates by the data
   section, so the stored word is the TOC's offset in that section. */
function pefLoad(bytes) {
  const pef = parsePEF(bytes);
  if (!pef) return null;
  const contents = pef.sections.map(s => {
    if (s.kind === 4 || s.kind === 5 || s.kind === 8) return null;
    if (s.kind === 2) return pefExpandPattern(bytes, s.containerOffset, s.packedSize, s.totalSize);
    const out = new Uint8Array(s.totalSize);
    out.set(bytes.subarray(s.containerOffset, s.containerOffset + Math.min(s.packedSize, s.totalSize)));
    return { bytes: out, produced: s.unpackedSize, consumed: s.packedSize, problem: null };
  });
  const relocs = pefRelocations(pef, bytes);
  let toc = null;
  const ld = pef.loader;
  if (ld && ld.mainSection >= 0 && contents[ld.mainSection]) {
    const m = contents[ld.mainSection].bytes;
    const tv = relocs.bySection.get(ld.mainSection);
    const target = tv && tv.get(ld.mainOffset + 4);
    if (target && target.section !== undefined) toc = { section: target.section, offset: pefU32(m, ld.mainOffset + 4) };
  }
  return { pef, contents, relocs, toc };
}

/* What a pointer-sized word of a section means once loaded: the section and
   offset it points at, or the import it names, or null for a word nothing
   relocates. */
function pefPointerAt(img, sectionIndex, offset) {
  const map = img.relocs.bySection.get(sectionIndex);
  const t = map && map.get(offset);
  if (!t) return null;
  if (t.import !== undefined) { const s = img.pef.loader.symbols[t.import]; return { import: t.import, name: s ? s.name : '' }; }
  const c = img.contents[sectionIndex];
  return { section: t.section, offset: c ? pefU32(c.bytes, offset) : 0 };
}

/* The traceback tables of a code section.

   Each is: a zero word; version (byte), language (byte), then six flag
   bytes:
     flags1  globallink 0x80, is_eprol 0x40, has_tboff 0x20, int_proc 0x10,
             has_ctl 0x08, tocless 0x04, fp_present 0x02, log_abort 0x01
     flags2  int_hndl 0x80, name_present 0x40, uses_alloca 0x20,
             cl_dis_inv 0x1C, saves_cr 0x02, saves_lr 0x01
     flags3  stores_bc 0x80, fpr_saved 0x7E
     flags4  gpr_saved 0x3F (the high bits are reserved)
     fixedparms (byte), floatparms 0xFE | parmsonstk 0x01 (byte)
   and then, in this order and only when the flag says so: parminfo (4,
   when either parm count is not 0), tb_offset (4, has_tboff: the distance
   back to the routine's start), hand_mask (4, int_hndl), ctl_info (4 for
   the count then 4 each, has_ctl), name (2 for the length then the bytes,
   name_present), alloca_reg (1, uses_alloca).

   A routine is taken only when the table says how long it is and what it
   is called, its start is at or after the previous routine's end, and the
   name is printable: a zero word followed by plausible flag bytes occurs
   in data too, and those three tests are what keep it out. */
function pefTracebacks(pef, bytes) {
  const out = [];
  if (!pef) return out;
  const code = pef.sections.find(s => s.kind === 0);
  if (!code) return out;
  const b = bytes, lo = code.containerOffset, hi = Math.min(b.length, lo + code.packedSize);
  let lastEnd = 0;
  for (let p = lo; p + 12 <= hi; p += 4) {
    if (pefU32(b, p) !== 0) continue;
    const version = b[p + 4], lang = b[p + 5], f1 = b[p + 6], f2 = b[p + 7];
    if (version !== 0 || lang > 0x0F) continue;
    if (!(f1 & 0x20) || !(f2 & 0x40)) continue;         // has_tboff and name_present
    const fixedparms = b[p + 10], floatparms = b[p + 11] >> 1;
    let q = p + 12;
    if (fixedparms || floatparms) q += 4;
    const tbOffset = pefU32(b, q); q += 4;
    if (f2 & 0x80) q += 4;                                // hand_mask
    if (f1 & 0x08) { const n = pefU32(b, q); if (n > 64) continue; q += 4 + n * 4; }
    if (q + 2 > hi) continue;
    const len = pefU16(b, q); q += 2;
    if (len < 2 || len > 512 || q + len > hi) continue;
    let name = ''; let ok = true;
    for (let i = 0; i < len; i++) { const c = b[q + i]; if (c < 0x20 || c > 0x7E) { ok = false; break; } name += String.fromCharCode(c); }
    if (!ok) continue;
    const start = (p - lo) - tbOffset;
    if (tbOffset === 0 || start < 0 || start < lastEnd || (start & 3)) continue;
    if (name[0] === '.') name = name.slice(1);
    out.push({ offset: start, length: tbOffset, tableOffset: p - lo, mangled: name, name: pefDemangle(name), lang });
    lastEnd = p - lo;
  }
  return out;
}

/* CodeWarrior's cfront-style mangling, read back. */
const PEF_TYPE_CODES = { v: 'void', c: 'char', s: 'short', i: 'int', l: 'long', x: 'long long', f: 'float', d: 'double', r: 'long double', b: 'bool', w: 'wchar_t', e: '...' };
function pefDemangleClass(s, pos) {
  // <n>Name, or Q<k><n>A<n>B... for a nested name. Returns [text, newPos] or null.
  let i = pos;
  let parts = 1;
  if (s[i] === 'Q') { parts = parseInt(s[i + 1], 10); if (!(parts > 0)) return null; i += 2; }
  const names = [];
  for (let k = 0; k < parts; k++) {
    let n = 0, digits = 0;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') { n = n * 10 + (s.charCodeAt(i) - 48); i++; digits++; }
    if (!digits || n === 0 || i + n > s.length) return null;
    names.push(s.slice(i, i + n)); i += n;
  }
  return [names.join('::'), i];
}
function pefDemangleArgs(s, pos) {
  const args = []; let i = pos; const seen = [];
  while (i < s.length) {
    let pre = '', post = '';
    let c = s[i];
    while (c === 'P' || c === 'R' || c === 'C' || c === 'U' || c === 'S' || c === 'V') {
      if (c === 'P') post = '*' + post; else if (c === 'R') post = '&' + post;
      else if (c === 'C') pre += 'const '; else if (c === 'U') pre += 'unsigned '; else if (c === 'S') pre += 'signed '; else if (c === 'V') pre += 'volatile ';
      i++; c = s[i];
    }
    if (c === undefined) return null;
    let t;
    if (PEF_TYPE_CODES[c]) { t = PEF_TYPE_CODES[c]; i++; }
    else if (c === 'T') { const n = parseInt(s[i + 1], 10); if (!(n >= 1 && n <= seen.length)) return null; t = seen[n - 1]; i += 2; }
    else if (c === 'N') { const n = parseInt(s[i + 1], 10), k = parseInt(s[i + 2], 10); if (!(n >= 1 && k >= 1 && k <= seen.length)) return null; for (let r = 0; r < n; r++) args.push(seen[k - 1]); i += 3; continue; }
    else if ((c >= '0' && c <= '9') || c === 'Q') { const r = pefDemangleClass(s, i); if (!r) return null; t = r[0]; i = r[1]; }
    else if (c === 'F') { return null; }                   // a function type: left mangled
    else return null;
    const full = pre + t + post;
    args.push(full); seen.push(full);
  }
  return args;
}
function pefDemangle(m) {
  if (!m) return '';
  let i = 0, base = '';
  const special = { __ct: '', __dt: '~', __pl: 'operator+', __mi: 'operator-', __ml: 'operator*', __dv: 'operator/', __as: 'operator=', __eq: 'operator==', __ne: 'operator!=', __lt: 'operator<', __gt: 'operator>', __apl: 'operator+=', __ami: 'operator-=', __cl: 'operator()', __vc: 'operator[]', __rf: 'operator->', __nw: 'operator new', __dl: 'operator delete', __ls: 'operator<<', __rs: 'operator>>', __aa: 'operator&&', __oo: 'operator||', __nt: 'operator!', __ad: 'operator&', __or: 'operator|', __er: 'operator^', __pp: 'operator++', __mm: 'operator--' };
  let kind = null;
  for (const k of Object.keys(special)) if (m.startsWith(k + '__')) { kind = k; i = k.length; break; }
  if (kind === null) {
    const sep = m.indexOf('__', 1);
    if (sep < 0) return m;
    base = m.slice(0, sep); i = sep;
  }
  if (m.slice(i, i + 2) !== '__') return m;
  i += 2;
  let cls = '';
  if (m[i] !== 'F') {
    const r = pefDemangleClass(m, i);
    if (!r) return m;
    cls = r[0]; i = r[1];
  }
  if (kind === '__ct') base = cls.split('::').pop();
  else if (kind === '__dt') base = '~' + cls.split('::').pop();
  else if (kind) base = special[kind];
  let args = null, isConst = false;
  if (m[i] === 'C') { isConst = true; i++; }
  if (m[i] === 'F') { args = pefDemangleArgs(m, i + 1); if (args === null) return (cls ? cls + '::' : '') + base + '(' + m.slice(i + 1) + ')'; }
  else if (i < m.length) return m;
  const argText = args ? (args.length === 1 && args[0] === 'void' ? '' : args.join(', ')) : '';
  return (cls ? cls + '::' : '') + base + '(' + argText + ')' + (isConst ? ' const' : '');
}

/* ---- two applications against each other ----------------------------------
   A classic Mac application is a PEF data fork and a resource fork, and this
   compares both. Nothing here knows Cythera exists, which is the rule for
   this tier: it is two applications, and it would say the same things about
   any pair built by the same compiler.

   WHAT IT REPORTS AND WHAT IT SUPPRESSES. A routine's OFFSET moves whenever
   anything before it changes size, so between two builds of the same program
   most routines have moved and nothing follows from it -- 1,772 of 1,970 in
   one real pair. Moved-only is counted and not listed. What carries meaning
   is a routine that appeared, one that went, and one whose LENGTH changed,
   because the compiler emitted different code for it.

   NAMES COME FROM THE TRACEBACK TABLES, so this only works on a build that
   has them; `pefTracebacks` gives nothing for a program compiled without,
   and the routine half of the report is then empty while the fork half still
   works. Two routines can share a name -- overloads mangle differently, so in
   practice they do not -- and where they do, the first is taken and the count
   says so.

   THE RESOURCE FORK is compared by type and id, which is the identity the
   Resource Manager uses. A resource whose bytes differ is reported; a
   resource that moved in the map is not, because the map's order is not
   something a reader should have to care about. */
function describeApplicationDiff(a, b) {
  const out = { routines: null, fork: null, aRoutines: 0, bRoutines: 0 };
  const sameBytes = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

  if (a && a.data && b && b.data) {
    let ra = [], rb = [];
    try { ra = pefTracebacks(parsePEF(a.data), a.data) || []; } catch (e) { ra = []; }
    try { rb = pefTracebacks(parsePEF(b.data), b.data) || []; } catch (e) { rb = []; }
    out.aRoutines = ra.length; out.bRoutines = rb.length;
    if (ra.length || rb.length) {
      const first = list => { const m = new Map(); let dupes = 0;
        for (const r of list) { if (m.has(r.name)) { dupes++; continue; } m.set(r.name, r); } return { m, dupes }; };
      const A = first(ra), B = first(rb);
      const added = [], gone = [], resized = [];
      let moved = 0, identical = 0;
      for (const [name, r] of A.m) {
        const o = B.m.get(name);
        if (!o) { gone.push({ name, length: r.length, offset: r.offset }); continue; }
        if (o.length !== r.length) resized.push({ name, aLength: r.length, bLength: o.length, delta: o.length - r.length });
        else if (o.offset !== r.offset) moved++;
        else identical++;
      }
      for (const [name, r] of B.m) if (!A.m.has(name)) added.push({ name, length: r.length, offset: r.offset });
      /* WHAT KIND OF CHANGE, not just how big.
       *
       * A routine that grew by eight bytes might have gained a test, or the
       * code generator might have inserted a redundant register copy. Telling
       * those apart by eye cost a wrong conclusion once: five `TInterp`
       * overloads in Cythera 1.0.3 were read as an undocumented interpreter
       * change and are one `addi rX, rY, 0` each.
       *
       * The census is the multiset of OPCODES, operands ignored. A recompile
       * shuffles registers and operands and leaves the census alone; an edit
       * moves it, and which opcodes arrived says what kind of edit: a new `bl`
       * is a call, `mr.`+`bt` is a null check, `stb` with `ori` is a flag
       * being written.
       *
       * `compilerOnly` is set when the census moves by nothing but register
       * copies and padding -- `mr`, `nop`, and the `addi rX, rY, 0` form,
       * which is a copy wearing an arithmetic encoding and is what made the
       * TInterp reading go wrong.
       *
       * It can be fooled: an edit that swapped one opcode for another of the
       * same kind reads as a recompile, and so does a bit test re-emitted in a
       * different instruction form. So the census is reported, not just a
       * verdict. Needs js/mac-ppc.js, which loads after this file; the call
       * happens long after both are in, and the guard says so. */
      if (typeof ppcDecode === 'function') {
        const census = (data, r) => {
          const pef2 = parsePEF(data);
          const code = pef2.sections.find(s => s.kind === 0);
          if (!code) return null;
          const img = data.subarray(code.containerOffset, code.containerOffset + code.totalSize);
          const m = new Map();
          let copies = 0;
          for (let a = r.offset; a + 4 <= r.offset + r.length; a += 4) {
            const w = ((img[a] << 24) | (img[a + 1] << 16) | (img[a + 2] << 8) | img[a + 3]) >>> 0;
            const d = ppcDecode(w);
            const mn = d ? d.mn : '.long';
            // addi rX, rY, 0 is a move; count it as one so a census delta of
            // copies alone cannot read as an edit.
            const key = (mn === 'addi' && d && d.imm === 0) ? 'mr' : mn;
            if (key === 'mr' || key === 'nop') copies++;
            m.set(key, (m.get(key) || 0) + 1);
          }
          return m;
        };
        for (const r of resized) {
          const ca = census(a.data, A.m.get(r.name)), cb = census(b.data, B.m.get(r.name));
          if (!ca || !cb) continue;
          const up = [], down = [];
          for (const [k, v] of cb) { const n = v - (ca.get(k) || 0); if (n > 0) up.push({ op: k, n }); }
          for (const [k, v] of ca) { const n = v - (cb.get(k) || 0); if (n > 0) down.push({ op: k, n }); }
          r.added = up; r.removed = down;
          r.compilerOnly = up.concat(down).every(x => x.op === 'mr' || x.op === 'nop');
        }
      }
      out.routines = { added, gone, resized, moved, identical,
                       compilerOnly: resized.filter(r => r.compilerOnly).length,
                       aCount: A.m.size, bCount: B.m.size, duplicateNames: A.dupes + B.dupes,
                       // The only figure a reader should act on.
                       meaningful: added.length + gone.length + resized.length };
    }
  }

  if (a && a.rsrc && a.rsrc.length && b && b.rsrc && b.rsrc.length) {
    let la = null, lb = null;
    try { la = resourceForkSpec(openResourceFork(a.rsrc)).resources; } catch (e) { la = null; }
    try { lb = resourceForkSpec(openResourceFork(b.rsrc)).resources; } catch (e) { lb = null; }
    if (la && lb) {
      const key = r => r.type + ' ' + r.id;
      const ma = new Map(la.map(r => [key(r), r])), mb = new Map(lb.map(r => [key(r), r]));
      const changed = [], added = [], removed = [];
      let identical = 0;
      for (const [k, r] of ma) {
        const o = mb.get(k);
        if (!o) { removed.push({ key: k, type: r.type, id: r.id, name: r.name, length: r.data.length }); continue; }
        if (sameBytes(r.data, o.data)) { identical++; continue; }
        changed.push({ key: k, type: r.type, id: r.id, name: r.name || o.name,
                       aLength: r.data.length, bLength: o.data.length });
      }
      for (const [k, r] of mb) if (!ma.has(k)) added.push({ key: k, type: r.type, id: r.id, name: r.name, length: r.data.length });
      out.fork = { changed, added, removed, identical, aCount: ma.size, bCount: mb.size };
    }
  }
  return out;
}
