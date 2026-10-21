/* mac-rar.js -- RAR archives of the format RAR 1.5 to 4 wrote, and the
   compression RAR 2.9 and later used in them (the "v2.9" lsar names).
   =========================================================================

   Not a Mac format, but Mac files went round in it: EV Nova's plug-ins, as
   a Windows player's RAR of `.rez` files (three in archive.org's EV Nova
   collection: one named .rar, one named .zip, one inside a zip). It was
   StarGrimoire's until 14 October 2026. An archive opens with
   "Rar!" 1A 07 00 and is a run of blocks, each a CRC, a type, flags and a
   size: the archive's header (0x73), then a header per file (0x74)
   with its data after it. A file is stored (method 0x30) or compressed;
   files flagged solid continue the stream of the one before, so reading
   one means reading those before it.

   The compression: LZ77 over a 4 MB window, coded with four canonical
   Huffman codes (299 symbols for literals, lengths and the repeat codes; 60
   for offsets; 17 for an offset's low four bits; 28 for the lengths that go
   with a repeated offset), their lengths sent through a twenty-symbol code
   and kept from block to block as differences. A block may instead be
   PPMd, variant H, which this file reads too. And a stretch of output may
   be put through a filter, sent as a program for RAR's virtual machine:
   the ones WinRAR wrote are known by their programs' CRC-32, and are run
   here as native code, as XADMaster runs them: E8 and E8E9 (x86
   call addresses), delta and audio. Any other program throws.

   PORTED, not written independently, from XADMaster, The Unarchiver's
   library ("Copyright (c) 2017-present, MacPaw Way Ltd.", LGPL-2.1-or-later,
   which section 3 lets be used under the GPL; github.com/MacPaw/XADMaster
   at commit 7cb9ee0a, 21 September 2026): XADRARParser.m, XADRAR30Handle.m,
   XADRARFilters.m, RARAudioDecoder.c, the number reader of
   XADRARVirtualMachine.m, and PPMd's VariantH.c, Context.c, RangeCoder.c
   and SubAllocatorVariantH.c. Every file read is held to the CRC-32 its
   header gives.

   Returns the shape parseStuffItArchive does: { format, entries: [{ path,
   name, isFolder, type, creator, finderFlags, dataLen, rsrcLen }] }, and
   each entry's `read(which)` gives its data ('rsrc' is always empty).

   LOAD ORDER: after mac-bytes.js (crc32, CRC32_TABLE). A classic script,
   like the rest of js/: no import, no export, globals. */

function looksLikeRar(bytes) {
  return !!bytes && bytes.length >= 7 && bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21 &&
    bytes[4] === 0x1A && bytes[5] === 0x07 && (bytes[6] === 0x00 || bytes[6] === 0x01);
}

function parseRarArchive(bytes) {
  if (!looksLikeRar(bytes)) throw new Error('not a RAR archive');
  if (bytes[6] === 0x01) throw new Error('RAR 5, which this page does not read');
  const le16 = o => bytes[o] | (bytes[o + 1] << 8);
  const le32 = o => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  const entries = [];
  let p = 0, archiveFlags = 0, run = null;
  while (p + 7 <= bytes.length) {
    const type = bytes[p + 2], flags = le16(p + 3), headSize = le16(p + 5);
    if (headSize < 7) break;
    let dataSize = 0;
    if ((flags & 0x8000) || type === 0x74) dataSize = p + 11 <= bytes.length ? le32(p + 7) : 0;
    if (type === 0x73) {
      archiveFlags = flags;
      if (flags & 0x80) throw new Error('RAR: the archive\'s headers are encrypted');
    } else if (type === 0x74) {
      const h = p + 7;
      // the packed size, the size, the system, the CRC-32, the time, the version, the method, the name's length, attributes
      const size = le32(h + 4), crc = le32(h + 9), version = bytes[h + 17], method = bytes[h + 18];
      const nameLen = le16(h + 19);
      let at = h + 25;
      if (flags & 0x100) at += 8;   // the high halves of 64-bit sizes, which nothing here is big enough to need
      const raw = bytes.subarray(at, at + nameLen);
      const zero = raw.indexOf(0);
      // a Unicode name has a plain one before a zero byte; the plain one is what is read here
      const plain = (flags & 0x200) && zero >= 0 ? raw.subarray(0, zero) : raw;
      const path = rarDecodeName(plain).replace(/\\/g, '/');
      const isFolder = (flags & 0xE0) === 0xE0;
      const name = path.split('/').pop();
      const dataStart = p + headSize;
      const solid = version < 20 ? !!(archiveFlags & 8) && entries.length > 0 : !!(flags & 0x10);
      const part = { start: dataStart, packedLen: dataSize, size, crc, version, method, encrypted: !!(flags & 4), split: !!(flags & 3) };
      if (!isFolder && size > 0) {
        if (!solid || !run) run = { files: [], decoded: null };
        part.run = run; part.index = run.files.length;
        run.files.push(part);
      }
      const e = { path, name, isFolder, type: '', creator: '', finderFlags: 0, dataLen: isFolder ? 0 : size, rsrcLen: 0, method, version };
      e.read = which => (which === 'rsrc' || isFolder || !size ? new Uint8Array(0) : rarFile(bytes, part, path));
      entries.push(e);
    } else if (type === 0x7B) break;
    p += headSize + dataSize;
  }
  return { format: 'RAR', entries };
}

// A name as Windows wrote it: Windows-1252, which is Latin-1 for the letters a name has.
function rarDecodeName(raw) {
  try { return new TextDecoder('windows-1252').decode(raw); } catch (e) { return latin1(raw); }
}

/* One file's bytes, decompressed (with the files of its solid run before it)
   and held to its CRC-32. */
function rarFile(bytes, part, path) {
  const where = '"' + path + '"';
  if (part.encrypted) throw new Error(where + ' is encrypted');
  if (part.split) throw new Error(where + ' is split across volumes of the archive');
  let out;
  if (part.method === 0x30) {
    if (part.start + part.size > bytes.length) throw new Error(where + ' runs past the end of the archive');
    out = bytes.subarray(part.start, part.start + part.size);
  } else {
    if (part.version !== 29) throw new Error(where + ' is compressed as RAR ' + (part.version / 10).toFixed(1) + ' compressed, which this page does not read');
    const run = part.run;
    if (!run.decoded) run.decoded = rar30Decode(bytes, run.files);
    let at = 0;
    for (let i = 0; i < part.index; i++) at += run.files[i].size;
    out = run.decoded.subarray(at, at + part.size);
  }
  if (crc32(out) !== part.crc) throw new Error(where + ' fails its CRC-32');
  return out;
}

/* ---- Reading bits, high bit first, and whole bytes ----------------------
 * One position in bits; a byte read consumes the next whole byte. */
function rarReader(b, start, end) { return { b, pos: start * 8, end: end * 8 }; }
function rarBits(r, n) {
  if (r.pos + n > r.end) throw new Error('RAR: the compressed data ends early');
  let v = 0;
  for (let k = 0; k < n; k++, r.pos++) v = (v << 1) | ((r.b[r.pos >> 3] >> (7 - (r.pos & 7))) & 1);
  return v >>> 0;
}
function rarByte(r) {
  r.pos = (r.pos + 7) & ~7;
  if (r.pos + 8 > r.end) return -1;
  const v = r.b[r.pos >> 3];
  r.pos += 8;
  return v;
}

/* A canonical prefix code, the shortest code all zeros (XADPrefixCode),
   read a bit at a time against how many codes each length has. */
function rarCode(lengths) {
  const count = new Uint16Array(16), symbols = [];
  for (let len = 1; len <= 15; len++) for (let i = 0; i < lengths.length; i++) if (lengths[i] === len) { count[len]++; symbols.push(i); }
  return { count, symbols };
}
function rarSymbol(r, c) {
  let code = 0, first = 0, index = 0;
  for (let len = 1; len <= 15; len++) {
    if (r.pos >= r.end) throw new Error('RAR: the compressed data ends early');
    code |= (r.b[r.pos >> 3] >> (7 - (r.pos & 7))) & 1;
    r.pos++;
    const n = c.count[len];
    if (code - first < n) return c.symbols[index + code - first];
    index += n; first = (first + n) << 1; code <<= 1;
  }
  throw new Error('RAR: a code that is not in the table');
}

// The virtual machine's numbers (CSInputNextRARVMNumber).
function rarVmNumber(r) {
  switch (rarBits(r, 2)) {
    case 0: return rarBits(r, 4);
    case 1: { const v = rarBits(r, 8); return v >= 16 ? v : (0xFFFFFF00 | (v << 4) | rarBits(r, 4)) >>> 0; }
    case 2: return rarBits(r, 16);
    default: return rarBits(r, 32);
  }
}

/* ---- RAR 2.9's decompression (XADRAR30Handle) --------------------------- */
const RAR_LENGTH_BASES = [0,1,2,3,4,5,6,7,8,10,12,14,16,20,24,28,32,40,48,56,64,80,96,112,128,160,192,224];
const RAR_LENGTH_BITS = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5];
const RAR_OFFSET_BASES = [0,1,2,3,4,6,8,12,16,24,32,48,64,96,128,192,256,384,512,768,1024,1536,2048,3072,4096,6144,8192,12288,
  16384,24576,32768,49152,65536,98304,131072,196608,262144,327680,393216,458752,524288,589824,655360,720896,786432,851968,
  917504,983040,1048576,1310720,1572864,1835008,2097152,2359296,2621440,2883584,3145728,3407872,3670016,3932160];
const RAR_OFFSET_BITS = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16,16,16,16,16,16,
  16,16,16,16,16,16,16,16,18,18,18,18,18,18,18,18,18,18,18,18];
const RAR_SHORT_BASES = [0,4,8,16,32,64,128,192];
const RAR_SHORT_BITS = [2,2,3,4,5,6,6,6];
// the filters WinRAR's programs are, by the CRC-32 of a program and its length (XADRAR30Filter)
const RAR_FILTERS = { '1d:0e06077d': 'delta', 'd8:bc85e701': 'audio', '35:ad576887': 'e8', '39:3cd7e57e': 'e8e9' };

/* The files of one solid run, decompressed one after another into one
   array, each from its compressed data; the filters then run over the whole
   array. */
function rar30Decode(bytes, files) {
  const total = files.reduce((a, f) => a + f.size, 0);
  const win = new Uint8Array(total);
  let pos = 0;
  const lengthTable = new Uint8Array(404);
  let maincode, offsetcode, lowoffsetcode, lengthcode;
  let lastOffset = 0, lastLength = 0, lastLowOffset = 0, numLowOffsetRepeats = 0;
  const oldOffset = [0, 0, 0, 0];
  let ppm = null, ppmBlock = false, ppmEscape = 2;
  const filters = [], filterCode = [], oldFilterLength = [], usageCount = [];
  let lastFilterNum = 0, fileStart = 0;
  let r = null;

  const literal = b => { if (pos < total) win[pos++] = b; };
  const match = (offs, len) => {
    for (let k = 0; k < len && pos < total; k++, pos++) win[pos] = pos - offs >= 0 ? win[pos - offs] : 0;
  };

  const parseCodes = () => {
    r.pos = (r.pos + 7) & ~7;
    ppmBlock = !!rarBits(r, 1);
    if (ppmBlock) {
      const flags = rarBits(r, 7);
      let maxAlloc = 0;
      if (flags & 0x20) maxAlloc = rarByte(r);
      if (flags & 0x40) ppmEscape = rarByte(r);
      if (flags & 0x20) {
        let maxOrder = (flags & 0x1F) + 1;
        if (maxOrder > 16) maxOrder = 16 + (maxOrder - 16) * 3;
        if (maxOrder === 1) throw new Error('RAR: a PPMd block of order 1');
        ppm = ppmdHStart(r, (maxAlloc + 1) << 20, maxOrder);
      } else {
        if (!ppm) throw new Error('RAR: a PPMd block with no model');
        ppmdHRestartCoder(ppm, r);
      }
      return;
    }
    lastLowOffset = 0; numLowOffsetRepeats = 0;
    if (!rarBits(r, 1)) lengthTable.fill(0);
    const pre = new Uint8Array(20);
    for (let i = 0; i < 20;) {
      const len = rarBits(r, 4);
      if (len === 15) {
        const count = rarBits(r, 4) + 2;
        if (count === 2) pre[i++] = 15;
        else for (let j = 0; j < count && i < 20; j++) pre[i++] = 0;
      } else pre[i++] = len;
    }
    const precode = rarCode(pre);
    for (let i = 0; i < 404;) {
      const v = rarSymbol(r, precode);
      if (v < 16) { lengthTable[i] = (lengthTable[i] + v) & 15; i++; }
      else if (v < 18) {
        if (i === 0) throw new Error('RAR: a repeated length with none before it');
        const n = v === 16 ? rarBits(r, 3) + 3 : rarBits(r, 7) + 11;
        for (let j = 0; j < n && i < 404; j++, i++) lengthTable[i] = lengthTable[i - 1];
      } else {
        const n = v === 18 ? rarBits(r, 3) + 3 : rarBits(r, 7) + 11;
        for (let j = 0; j < n && i < 404; j++) lengthTable[i++] = 0;
      }
    }
    maincode = rarCode(lengthTable.subarray(0, 299));
    offsetcode = rarCode(lengthTable.subarray(299, 359));
    lowoffsetcode = rarCode(lengthTable.subarray(359, 376));
    lengthcode = rarCode(lengthTable.subarray(376, 404));
  };

  const parseFilter = (code, flags) => {
    const fr = rarReader(code, 0, code.length);
    let num;
    let isNew = false;
    if (flags & 0x80) {
      num = rarVmNumber(fr) - 1;
      if (num === -1) { num = 0; filterCode.length = 0; filters.length = 0; }
      if (num > filterCode.length || num < 0 || num > 1024) throw new Error('RAR: a filter numbered out of turn');
      if (num === filterCode.length) { isNew = true; oldFilterLength[num] = 0; usageCount[num] = -1; }
      lastFilterNum = num;
    } else num = lastFilterNum;
    usageCount[num]++;
    let start = rarVmNumber(fr) + pos;
    if (flags & 0x40) start += 258;
    let length;
    if (flags & 0x20) length = oldFilterLength[num] = rarVmNumber(fr);
    else length = oldFilterLength[num];
    const registers = [0, 0, 0, 0x3C000, length, usageCount[num], 0, 0x40000];
    if (flags & 0x10) {
      const mask = rarBits(fr, 7);
      for (let i = 0; i < 7; i++) if (mask & (1 << i)) registers[i] = rarVmNumber(fr);
    }
    if (isNew) {
      const n = rarVmNumber(fr);
      if (n <= 0 || n > 0x10000) throw new Error('RAR: a filter program of a length past reason');
      const prog = new Uint8Array(n);
      for (let i = 0; i < n; i++) prog[i] = rarBits(fr, 8);
      const key = n.toString(16) + ':' + crc32(prog).toString(16).padStart(8, '0');
      filterCode.push(RAR_FILTERS[key] || key);
    }
    const kind = filterCode[num];
    filters.push({ kind, start, length, registers, fileStart });
  };

  const readFilterFromInput = () => {
    const flags = rarBits(r, 8);
    let length = (flags & 7) + 1;
    if (length === 7) length = rarBits(r, 8) + 7;
    else if (length === 8) length = rarBits(r, 16);
    const code = new Uint8Array(length);
    for (let i = 0; i < length; i++) code[i] = rarBits(r, 8);
    parseFilter(code, flags);
  };
  const ppmByte = () => { const v = ppmdHNextByte(ppm); if (v < 0) throw new Error('RAR: the PPMd data ends early'); return v; };
  const readFilterFromPpmd = () => {
    const flags = ppmByte();
    let length = (flags & 7) + 1;
    if (length === 7) length = ppmByte() + 7;
    else if (length === 8) length = (ppmByte() << 8) | ppmByte();
    const code = new Uint8Array(length);
    for (let i = 0; i < length; i++) code[i] = ppmByte();
    parseFilter(code, flags);
  };

  // until the run's end, or the mark that the next file's data begins
  const expand = () => {
    while (pos < total) {
      if (ppmBlock) {
        const b = ppmByte();
        if (b !== ppmEscape) { literal(b); continue; }
        const c = ppmByte();
        if (c === 0) parseCodes();
        else if (c === 2) return true;
        else if (c === 3) readFilterFromPpmd();
        else if (c === 4) {
          const offs = (ppmByte() << 16) | (ppmByte() << 8) | ppmByte();
          match(offs + 2, ppmByte() + 32);
        } else if (c === 5) match(1, ppmByte() + 4);
        else literal(b);
        continue;
      }
      const sym = rarSymbol(r, maincode);
      let offs, len;
      if (sym < 256) { literal(sym); continue; }
      if (sym === 256) {
        if (!rarBits(r, 1)) { newTable = !!rarBits(r, 1); return true; }
        parseCodes();
        continue;
      }
      if (sym === 257) { readFilterFromInput(); continue; }
      if (sym === 258) {
        if (lastLength === 0) continue;
        offs = lastOffset; len = lastLength;
      } else if (sym <= 262) {
        const k = sym - 259;
        offs = oldOffset[k];
        const ls = rarSymbol(r, lengthcode);
        len = RAR_LENGTH_BASES[ls] + 2 + (RAR_LENGTH_BITS[ls] ? rarBits(r, RAR_LENGTH_BITS[ls]) : 0);
        for (let i = k; i > 0; i--) oldOffset[i] = oldOffset[i - 1];
        oldOffset[0] = offs;
      } else if (sym <= 270) {
        offs = RAR_SHORT_BASES[sym - 263] + 1 + rarBits(r, RAR_SHORT_BITS[sym - 263]);
        len = 2;
        for (let i = 3; i > 0; i--) oldOffset[i] = oldOffset[i - 1];
        oldOffset[0] = offs;
      } else {
        len = RAR_LENGTH_BASES[sym - 271] + 3 + (RAR_LENGTH_BITS[sym - 271] ? rarBits(r, RAR_LENGTH_BITS[sym - 271]) : 0);
        const os = rarSymbol(r, offsetcode);
        offs = RAR_OFFSET_BASES[os] + 1;
        const ob = RAR_OFFSET_BITS[os];
        if (ob > 0) {
          if (os > 9) {
            if (ob > 4) offs += rarBits(r, ob - 4) << 4;
            if (numLowOffsetRepeats > 0) { numLowOffsetRepeats--; offs += lastLowOffset; }
            else {
              const lo = rarSymbol(r, lowoffsetcode);
              if (lo === 16) { numLowOffsetRepeats = 15; offs += lastLowOffset; }
              else { offs += lo; lastLowOffset = lo; }
            }
          } else offs += rarBits(r, ob);
        }
        if (offs >= 0x40000) len++;
        if (offs >= 0x2000) len++;
        for (let i = 3; i > 0; i--) oldOffset[i] = oldOffset[i - 1];
        oldOffset[0] = offs;
      }
      lastOffset = offs; lastLength = len;
      match(offs, len);
    }
    return false;
  };

  let newTable = true;
  for (let f = 0; f < files.length && pos < total; f++) {
    const file = files[f];
    if (file.start + file.packedLen > bytes.length) throw new Error('RAR: a file\'s data runs past the end of the archive');
    r = rarReader(bytes, file.start, file.start + file.packedLen);
    if (ppm) ppm.r = r;
    fileStart = pos;
    if (newTable) parseCodes();
    newTable = false;
    // to the mark that the next file's data begins, or the run's end
    expand();
  }
  if (pos < total) throw new Error('RAR: the data gave ' + pos + ' bytes of ' + total);
  return rarApplyFilters(win, filters);
}

/* The filters, in the order they were sent, each over its stretch of what was
   decompressed: those on one stretch one after another, each on what the one
   before gave (XADRAR30Handle's produceBlockAtOffset). */
function rarApplyFilters(win, filters) {
  if (!filters.length) return win;
  const out = win.slice();
  let prevStart = -1, prevLength = -1;
  for (const f of filters) {
    if (typeof f.kind !== 'string' || f.kind.indexOf(':') >= 0)
      throw new Error('RAR: a filter program this page does not recognise (' + f.kind + ')');
    const chained = f.start === prevStart && f.length === prevLength;
    const length = f.registers[4];   // XADMaster uses the register, not the block length
    const blockLen = f.length;
    if (f.start + blockLen > out.length) throw new Error('RAR: a filter runs past the end of the data');
    const mem = out.subarray(f.start, f.start + blockLen);
    const at = chained ? f.start : f.start - f.fileStart;   // the position XADMaster gives a filter
    if (f.kind === 'e8' || f.kind === 'e8e9') {
      if (length <= 0x3C000 && length >= 4) rarE8E9(mem.subarray(0, Math.min(length, blockLen)), at, f.kind === 'e8e9');
    } else if (f.kind === 'delta' || f.kind === 'audio') {
      if (length <= 0x3C000 / 2) {
        const src = mem.slice(0, length), dest = new Uint8Array(length);
        const channels = f.registers[0];
        if (f.kind === 'delta') {
          let s = 0;
          for (let c = 0; c < channels; c++) { let last = 0; for (let d = c; d < length; d += channels) { last = (last - src[s++]) & 255; dest[d] = last; } }
        } else {
          let s = 0;
          for (let c = 0; c < channels; c++) { const st = rarAudioState(); for (let d = c; d < length; d += channels) dest[d] = rarAudioByte(st, src[s++]); }
        }
        mem.set(dest.subarray(0, Math.min(length, blockLen)));
      }
    }
    prevStart = f.start; prevLength = f.length;
  }
  return out;
}

function rarE8E9(mem, filePos, e9) {
  const fileSize = 0x1000000;
  for (let i = 0; i <= mem.length - 5; i++) {
    if (mem[i] === 0xE8 || (e9 && mem[i] === 0xE9)) {
      const cur = (filePos + i + 1) | 0;
      const addr = mem[i + 1] | (mem[i + 2] << 8) | (mem[i + 3] << 16) | (mem[i + 4] << 24);
      let put = null;
      if (addr < 0) { if (addr + cur >= 0) put = addr + fileSize; }
      else if (addr < fileSize) put = addr - cur;
      if (put !== null) { mem[i + 1] = put & 255; mem[i + 2] = (put >> 8) & 255; mem[i + 3] = (put >> 16) & 255; mem[i + 4] = (put >> 24) & 255; }
      i += 4;
    }
  }
}

// RAR 2.9's audio filter (RARAudioDecoder.c, DecodeRAR30Audio).
function rarAudioState() { return { w1: 0, w2: 0, w3: 0, d1: 0, d2: 0, d3: 0, lastDelta: 0, error: new Int32Array(7), count: 0, lastByte: 0 }; }
function rarAudioByte(s, delta) {
  s.d3 = s.d2; s.d2 = s.lastDelta - s.d1; s.d1 = s.lastDelta;
  const pred = ((8 * s.lastByte + s.w1 * s.d1 + s.w2 * s.d2 + s.w3 * s.d3) >> 3) & 0xFF;
  const byte = (pred - delta) & 0xFF;
  const err = ((delta << 24) >> 24) << 3;
  s.error[0] += Math.abs(err);
  s.error[1] += Math.abs(err - s.d1); s.error[2] += Math.abs(err + s.d1);
  s.error[3] += Math.abs(err - s.d2); s.error[4] += Math.abs(err + s.d2);
  s.error[5] += Math.abs(err - s.d3); s.error[6] += Math.abs(err + s.d3);
  s.lastDelta = ((byte - s.lastByte) << 24) >> 24;
  s.lastByte = byte;
  if ((s.count & 0x1F) === 0) {
    let min = s.error[0], idx = 0;
    for (let i = 1; i < 7; i++) if (s.error[i] < min) { min = s.error[i]; idx = i; }
    s.error.fill(0);
    switch (idx) {
      case 1: if (s.w1 >= -16) s.w1--; break;
      case 2: if (s.w1 < 16) s.w1++; break;
      case 3: if (s.w2 >= -16) s.w2--; break;
      case 4: if (s.w2 < 16) s.w2++; break;
      case 5: if (s.w3 >= -16) s.w3--; break;
      case 6: if (s.w3 < 16) s.w3++; break;
    }
  }
  s.count++;
  return byte;
}

/* ---- PPMd variant H (VariantH.c, Context.c, RangeCoder.c,
 * SubAllocatorVariantH.c), as RAR uses it -----------------------------------
 * The model lives in one heap, as in the C: a context is 12 bytes (its last
 * state's index, flags, the sum of its frequencies, its states, its suffix),
 * a state 6 (symbol, frequency, successor), little-endian, and a context
 * with one state stores it in place of the sum and the pointer. A pointer is
 * an offset into the heap, 0 none. Variant H stores the text it has seen at
 * the foot of the heap, and a successor that points there, at or below
 * pText, is text and not yet a context. The heap starts 16 bytes in, the
 * allocator's sentinel block in those bytes. */
const PPMH = { UNIT: 12, HEAP: 16, SENTINEL: 4, MAX_FREQ: 124, PERIOD_BITS: 7, INTERVAL: 128, TOT_BITS: 14, BIN_SCALE: 1 << 14 };
const PPMH_EXP_ESCAPE = [25, 14, 9, 7, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2];
const PPMH_INIT_BIN_ESC = [0x3CDD, 0x1F3F, 0x59BF, 0x48F3, 0x64A1, 0x5ABC, 0x6632, 0x6051];

function ppmdHStart(r, size, maxOrder) {
  const heap = new Uint8Array(PPMH.HEAP + size + 64);
  const m = {
    r, heap, dv: new DataView(heap.buffer), size, maxOrder,
    Index2Units: new Uint8Array(38), Units2Index: new Uint8Array(128), FreeList: new Uint32Array(38), GlueCount: 0,
    pText: 0, UnitsStart: 0, LowUnit: 0, HighUnit: 0,
    low: 0, code: 0, range: 0,
    scale: 0, FoundState: 0, OrderFall: 0, InitEsc: 0, RunLength: 0, InitRL: 0, CharMask: new Uint8Array(256), LastMaskIndex: 0, EscCount: 1, PrevSuccess: 0,
    MinContext: 0, MaxContext: 0, HiBitsFlag: 0,
    SEE2: [], Dummy: { Summ: 0, Shift: PPMH.PERIOD_BITS, Count: 0 },
    NS2BSIndx: new Uint8Array(256), HB2Flag: new Uint8Array(256), NS2Indx: new Uint8Array(256), BinSumm: new Uint16Array(128 * 64),
  };
  ppmdHRestartCoder(m, r);
  m.NS2BSIndx[0] = 0; m.NS2BSIndx[1] = 2;
  for (let i = 2; i < 11; i++) m.NS2BSIndx[i] = 4;
  for (let i = 11; i < 256; i++) m.NS2BSIndx[i] = 6;
  for (let i = 0; i < 3; i++) m.NS2Indx[i] = i;
  for (let i = 3, n = 3, k = 1, step = 1; i < 256; i++) { m.NS2Indx[i] = n; if (!--k) { n++; step++; k = step; } }
  for (let i = 0x40; i < 0x100; i++) m.HB2Flag[i] = 8;
  ppmhRestartModel(m);
  return m;
}

// the range coder: RAR's, with the low end kept and a bottom of 0x8000, reading the RAR stream's bytes
function ppmdHRestartCoder(m, r) {
  m.r = r; m.low = 0; m.code = 0; m.range = 0xFFFFFFFF;
  for (let i = 0; i < 4; i++) m.code = ((m.code << 8) | ppmhIn(m)) >>> 0;
}
function ppmhIn(m) { const v = rarByte(m.r); return v < 0 ? 0 : v; }
function ppmhCount(m, scale) { m.range = (m.range / scale) >>> 0; return (((m.code - m.low) >>> 0) / m.range) >>> 0; }
function ppmhNormalize(m) {
  for (;;) {
    if (((m.low ^ ((m.low + m.range) >>> 0)) >>> 0) >= 0x1000000) {
      if (m.range >= 0x8000) break;
      m.range = ((-m.low) & 0x7FFF) >>> 0;
    }
    m.code = ((m.code << 8) | ppmhIn(m)) >>> 0;
    m.range = (m.range << 8) >>> 0;
    m.low = (m.low << 8) >>> 0;
  }
}
function ppmhRemove(m, lowcount, highcount) {
  m.low = (m.low + Math.imul(m.range, lowcount)) >>> 0;
  m.range = Math.imul(m.range, highcount - lowcount) >>> 0;
  ppmhNormalize(m);
}

// the heap, and a context's and a state's fields
const ph16 = (m, o) => m.dv.getUint16(o, true), ph32 = (m, o) => m.dv.getUint32(o, true);
const phS16 = (m, o, v) => m.dv.setUint16(o, v & 0xFFFF, true), phS32 = (m, o, v) => m.dv.setUint32(o, v >>> 0, true);
const phLast = (m, c) => m.heap[c], phSumm = (m, c) => ph16(m, c + 2), phStates = (m, c) => ph32(m, c + 4), phSuffix = (m, c) => ph32(m, c + 8);
const phSym = (m, s) => m.heap[s], phFreq = (m, s) => m.heap[s + 1], phSucc = (m, s) => ph32(m, s + 2);
const phSetFreq = (m, s, v) => { m.heap[s + 1] = v; };
function phSwap(m, a, b) { const t = m.heap.slice(a, a + 6); m.heap.copyWithin(a, b, b + 6); m.heap.set(t, b); }

// the allocator
const phI2B = (m, i) => PPMH.UNIT * m.Index2Units[i];
function phInsertNode(m, p, i) { phS32(m, p, m.FreeList[i]); m.FreeList[i] = p; }
function phRemoveNode(m, i) { const n = m.FreeList[i]; m.FreeList[i] = ph32(m, n); return n; }
function phSplitBlock(m, pv, oldi, newi) {
  let p = pv + phI2B(m, newi), diff = m.Index2Units[oldi] - m.Index2Units[newi];
  const i = m.Units2Index[diff - 1];
  if (m.Index2Units[i] !== diff) { phInsertNode(m, p, i - 1); p += phI2B(m, i - 1); diff -= m.Index2Units[i - 1]; }
  phInsertNode(m, p, m.Units2Index[diff - 1]);
}
function phAllocInit(m) {
  m.FreeList.fill(0);
  m.pText = PPMH.HEAP;
  m.HighUnit = PPMH.HEAP + m.size;
  const diff = PPMH.UNIT * (Math.floor(Math.floor(m.size / 8) / PPMH.UNIT) * 7);
  m.LowUnit = m.UnitsStart = m.HighUnit - diff;
  m.GlueCount = 0;
  const N1 = 4, N2 = 4, N3 = 4, N4 = (128 + 3 - 1 * N1 - 2 * N2 - 3 * N3) >> 2;
  for (let i = 0; i < N1; i++) m.Index2Units[i] = 1 + i;
  for (let i = 0; i < N2; i++) m.Index2Units[N1 + i] = 2 + N1 + i * 2;
  for (let i = 0; i < N3; i++) m.Index2Units[N1 + N2 + i] = 3 + N1 + 2 * N2 + i * 3;
  for (let i = 0; i < N4; i++) m.Index2Units[N1 + N2 + N3 + i] = 4 + N1 + 2 * N2 + 3 * N3 + i * 4;
  for (let k = 0, i = 0; k < 128; k++) { if (m.Index2Units[i] < k + 1) i++; m.Units2Index[k] = i; }
}
function phAllocContext(m) {
  if (m.HighUnit !== m.LowUnit) { m.HighUnit -= PPMH.UNIT; return m.HighUnit; }
  if (m.FreeList[0]) return phRemoveNode(m, 0);
  return phAllocMore(m, 0);
}
function phAllocUnits(m, num) {
  const index = m.Units2Index[num - 1];
  if (m.FreeList[index]) return phRemoveNode(m, index);
  const units = m.LowUnit;
  m.LowUnit += phI2B(m, index);
  if (m.LowUnit <= m.HighUnit) return units;
  m.LowUnit -= phI2B(m, index);
  return phAllocMore(m, index);
}
function phAllocMore(m, index) {
  if (m.GlueCount === 0) {
    m.GlueCount = 255;
    phGlueFreeBlocks(m);
    if (m.FreeList[index]) return phRemoveNode(m, index);
  }
  for (let i = index + 1; i < 38; i++) if (m.FreeList[i]) { const u = phRemoveNode(m, i); phSplitBlock(m, u, i, index); return u; }
  m.GlueCount--;
  const n = phI2B(m, index);
  if (m.UnitsStart - m.pText > n) { m.UnitsStart -= n; return m.UnitsStart; }
  return 0;
}
function phExpandUnits(m, oldoffs, oldnum) {
  const oldi = m.Units2Index[oldnum - 1], newi = m.Units2Index[oldnum];
  if (oldi === newi) return oldoffs;
  const offs = phAllocUnits(m, oldnum + 1);
  if (offs) { m.heap.copyWithin(offs, oldoffs, oldoffs + oldnum * PPMH.UNIT); phInsertNode(m, oldoffs, oldi); }
  return offs;
}
function phShrinkUnits(m, oldoffs, oldnum, newnum) {
  const oldi = m.Units2Index[oldnum - 1], newi = m.Units2Index[newnum - 1];
  if (oldi === newi) return oldoffs;
  if (m.FreeList[newi]) { const p = phRemoveNode(m, newi); m.heap.copyWithin(p, oldoffs, oldoffs + newnum * PPMH.UNIT); phInsertNode(m, oldoffs, oldi); return p; }
  phSplitBlock(m, oldoffs, oldi, newi);
  return oldoffs;
}
function phFreeUnits(m, offs, num) { phInsertNode(m, offs, m.Units2Index[num - 1]); }
// the free blocks joined where they meet: a block here is a stamp, its size in units, and the next and the one before
function phGlueFreeBlocks(m) {
  const S = PPMH.SENTINEL;
  const stamp = p => ph16(m, p), nu = p => ph16(m, p + 2), next = p => ph32(m, p + 4), prev = p => ph32(m, p + 8);
  const insertAfter = (b, after) => { const f = next(after); phS32(m, b + 8, after); phS32(m, b + 4, f); phS32(m, after + 4, b); phS32(m, f + 8, b); };
  const remove = b => { const pr = prev(b), f = next(b); phS32(m, pr + 4, f); phS32(m, f + 8, pr); };
  if (m.LowUnit !== m.HighUnit) m.heap[m.LowUnit] = 0;
  phS32(m, S + 4, S); phS32(m, S + 8, S);
  for (let i = 0; i < 38; i++) {
    while (m.FreeList[i]) {
      const p = phRemoveNode(m, i);
      insertAfter(p, S);
      phS16(m, p, 0xFFFF);
      phS16(m, p + 2, m.Index2Units[i]);
    }
  }
  for (let p = next(S); p !== S; p = next(p)) {
    for (;;) {
      const p1 = p + nu(p) * PPMH.UNIT;
      if (p1 + 4 > m.heap.length || stamp(p1) !== 0xFFFF) break;
      if (nu(p) + nu(p1) >= 0x10000) break;
      remove(p1);
      phS16(m, p + 2, nu(p) + nu(p1));
    }
  }
  for (;;) {
    let p = next(S);
    if (p === S) break;
    remove(p);
    let sz = nu(p);
    while (sz > 128) { phInsertNode(m, p, 37); sz -= 128; p += 128 * PPMH.UNIT; }
    let i = m.Units2Index[sz - 1];
    if (m.Index2Units[i] !== sz) {
      i--;
      const k = sz - m.Index2Units[i];
      phInsertNode(m, p + (sz - k) * PPMH.UNIT, k - 1);
    }
    phInsertNode(m, p, i);
  }
}

function phNewChild(m, suffix, suffixState, sym, freq, succ) {
  const c = phAllocContext(m);
  if (c) {
    m.heap[c] = 0; m.heap[c + 1] = 0;
    phS32(m, c + 8, suffix);
    phS32(m, suffixState + 2, c);
    m.heap[c + 2] = sym; m.heap[c + 3] = freq; phS32(m, c + 4, succ);
  }
  return c;
}
const phMakeSEE2 = (init, count) => ({ Shift: PPMH.PERIOD_BITS - 4, Summ: (init << (PPMH.PERIOD_BITS - 4)) & 0xFFFF, Count: count });
function phSEE2Mean(s) { const r = s.Summ >>> s.Shift; s.Summ = (s.Summ - r) & 0xFFFF; return r === 0 ? 1 : r; }
function phUpdateSEE2(s) {
  if (s.Shift >= PPMH.PERIOD_BITS) return;
  s.Count = (s.Count - 1) & 0xFF;
  if (s.Count === 0) { s.Summ = (s.Summ * 2) & 0xFFFF; s.Count = (3 << s.Shift) & 0xFF; s.Shift++; }
}
const phMean = (summ, shift, round) => (summ + (1 << (shift - round))) >>> shift;

function ppmhRestartModel(m) {
  phAllocInit(m);
  m.CharMask.fill(0);
  m.PrevSuccess = 0;
  m.OrderFall = m.maxOrder;
  m.RunLength = m.InitRL = -(m.maxOrder < 12 ? m.maxOrder : 12) - 1;
  const c = phAllocContext(m);
  m.heap[c] = 255; m.heap[c + 1] = 0; phS32(m, c + 8, 0);
  m.MaxContext = m.MinContext = c;
  phS16(m, c + 2, 257);
  const states = phAllocUnits(m, 128);
  phS32(m, c + 4, states);
  for (let i = 0; i < 256; i++) { const s = states + 6 * i; m.heap[s] = i; m.heap[s + 1] = 1; phS32(m, s + 2, 0); }
  m.FoundState = states;
  for (let i = 0; i < 128; i++) for (let k = 0; k < 8; k++) for (let n = 0; n < 64; n += 8)
    m.BinSumm[i * 64 + k + n] = (PPMH.BIN_SCALE - Math.floor(PPMH_INIT_BIN_ESC[k] / (i + 2))) & 0xFFFF;
  m.SEE2 = [];
  for (let i = 0; i < 25; i++) { const row = []; for (let k = 0; k < 16; k++) row.push(phMakeSEE2(5 * i + 10, 4)); m.SEE2.push(row); }
}

function ppmdHNextByte(m) {
  if (!m.MinContext) return -1;
  if (phLast(m, m.MinContext) !== 0) ppmhDecodeSymbol1(m, m.MinContext);
  else ppmhDecodeBinSymbol(m, m.MinContext);
  while (!m.FoundState) {
    do {
      m.OrderFall++;
      m.MinContext = phSuffix(m, m.MinContext);
      if (!m.MinContext) return -1;
    } while (phLast(m, m.MinContext) === m.LastMaskIndex);
    ppmhDecodeSymbol2(m, m.MinContext);
  }
  const byte = phSym(m, m.FoundState);
  if (m.OrderFall === 0 && phSucc(m, m.FoundState) > m.pText) m.MinContext = m.MaxContext = phSucc(m, m.FoundState);
  else {
    ppmhUpdateModel(m);
    if (m.EscCount === 0) { m.EscCount = 1; m.CharMask.fill(0); }
  }
  return byte;
}

function ppmhDecodeBinSymbol(m, ctx) {
  const rs = ctx + 2;
  m.HiBitsFlag = m.HB2Flag[phSym(m, m.FoundState)];
  const bsi = (phFreq(m, rs) - 1) * 64 + m.PrevSuccess + m.NS2BSIndx[phLast(m, phSuffix(m, ctx))] +
    m.HiBitsFlag + 2 * m.HB2Flag[phSym(m, rs)] + ((m.RunLength >> 26) & 0x20);
  const bs = m.BinSumm[bsi];
  const v = ppmhCount(m, 1 << PPMH.TOT_BITS);
  if (v < bs) {
    ppmhRemove(m, 0, bs);
    m.PrevSuccess = 1; m.RunLength++; m.FoundState = rs;
    if (phFreq(m, rs) < 128) phSetFreq(m, rs, phFreq(m, rs) + 1);
    m.BinSumm[bsi] = (bs + PPMH.INTERVAL - phMean(bs, PPMH.PERIOD_BITS, 2)) & 0xFFFF;
  } else {
    ppmhRemove(m, bs, 1 << PPMH.TOT_BITS);
    m.PrevSuccess = 0; m.FoundState = 0; m.LastMaskIndex = 0;
    m.CharMask[phSym(m, rs)] = m.EscCount;
    const nb = (bs - phMean(bs, PPMH.PERIOD_BITS, 2)) & 0xFFFF;
    m.BinSumm[bsi] = nb;
    m.InitEsc = PPMH_EXP_ESCAPE[nb >>> 10];
  }
}
function ppmhDecodeSymbol1(m, ctx) {
  m.scale = phSumm(m, ctx);
  const states = phStates(m, ctx), first = phFreq(m, states);
  const count = ppmhCount(m, m.scale);
  if (count < first) {
    ppmhRemove(m, 0, first);
    if (2 * first > m.scale) { m.PrevSuccess = 1; m.RunLength++; } else m.PrevSuccess = 0;
    m.FoundState = states;
    phSetFreq(m, states, first + 4);
    phS16(m, ctx + 2, phSumm(m, ctx) + 4);
    if (first + 4 > PPMH.MAX_FREQ) ppmhRescale(m, ctx);
    return;
  }
  let high = first;
  m.PrevSuccess = 0;
  for (let i = 1; i <= phLast(m, ctx); i++) {
    const s = states + 6 * i;
    high += phFreq(m, s);
    if (high > count) {
      ppmhRemove(m, high - phFreq(m, s), high);
      phSetFreq(m, s, phFreq(m, s) + 4);
      phS16(m, ctx + 2, phSumm(m, ctx) + 4);
      if (phFreq(m, s) > phFreq(m, s - 6)) {
        phSwap(m, s, s - 6);
        m.FoundState = s - 6;
        if (phFreq(m, s - 6) > PPMH.MAX_FREQ) ppmhRescale(m, ctx);
      } else m.FoundState = s;
      return;
    }
  }
  if (!m.FoundState) return;
  const lastSym = phSym(m, m.FoundState);
  ppmhRemove(m, high, m.scale);
  m.LastMaskIndex = phLast(m, ctx);
  m.FoundState = 0;
  for (let i = 0; i <= phLast(m, ctx); i++) m.CharMask[phSym(m, states + 6 * i)] = m.EscCount;
  m.HiBitsFlag = m.HB2Flag[lastSym];
}
function ppmhDecodeSymbol2(m, ctx) {
  const last = phLast(m, ctx), diff = last - m.LastMaskIndex;
  let see;
  if (last !== 255) {
    see = m.SEE2[m.NS2Indx[diff - 1]][
      (diff < phLast(m, phSuffix(m, ctx)) - last ? 1 : 0) +
      (phSumm(m, ctx) < 11 * (last + 1) ? 2 : 0) +
      (m.LastMaskIndex + 1 > diff ? 4 : 0) +
      m.HiBitsFlag];
    m.scale = phSEE2Mean(see);
  } else { m.scale = 1; see = m.Dummy; }
  const ps = new Array(diff);
  let total = 0, s = phStates(m, ctx);
  for (let i = 0; i < diff; i++) {
    while (m.CharMask[phSym(m, s)] === m.EscCount) s += 6;
    total += phFreq(m, s);
    ps[i] = s; s += 6;
  }
  m.scale = (m.scale + total) >>> 0;
  const count = ppmhCount(m, m.scale);
  if (count < total) {
    let i = 0, high = phFreq(m, ps[0]);
    while (high <= count && i + 1 < diff) high += phFreq(m, ps[++i]);
    ppmhRemove(m, high - phFreq(m, ps[i]), high);
    phUpdateSEE2(see);
    const st = ps[i];
    m.FoundState = st;
    phSetFreq(m, st, phFreq(m, st) + 4);
    phS16(m, ctx + 2, phSumm(m, ctx) + 4);
    if (phFreq(m, st) > PPMH.MAX_FREQ) ppmhRescale(m, ctx);
    m.EscCount = (m.EscCount + 1) & 0xFF;
    m.RunLength = m.InitRL;
  } else {
    ppmhRemove(m, total, m.scale);
    m.LastMaskIndex = last;
    see.Summ = (see.Summ + m.scale) & 0xFFFF;
    for (let i = 0; i < diff; i++) m.CharMask[phSym(m, ps[i])] = m.EscCount;
  }
}
function ppmhRescale(m, ctx) {
  const states = phStates(m, ctx), n = phLast(m, ctx) + 1;
  phSetFreq(m, m.FoundState, phFreq(m, m.FoundState) + 4);
  let escfreq = phSumm(m, ctx) + 4;
  const adder = m.OrderFall === 0 ? 0 : 1;
  let summ = 0;
  for (let i = 0; i < n; i++) {
    const s = states + 6 * i;
    escfreq -= phFreq(m, s);
    phSetFreq(m, s, (phFreq(m, s) + adder) >> 1);
    summ += phFreq(m, s);
    if (i > 0 && phFreq(m, s) > phFreq(m, s - 6)) {
      const tmp = m.heap.slice(s, s + 6);
      let j = i - 1;
      while (j > 0 && tmp[1] > phFreq(m, states + 6 * (j - 1))) j--;
      m.heap.copyWithin(states + 6 * (j + 1), states + 6 * j, states + 6 * i);
      m.heap.set(tmp, states + 6 * j);
    }
  }
  phS16(m, ctx + 2, summ);
  if (phFreq(m, states + 6 * (n - 1)) === 0) {
    let numzeros = 1;
    while (numzeros < n && phFreq(m, states + 6 * (n - 1 - numzeros)) === 0) numzeros++;
    escfreq += numzeros;
    m.heap[ctx] = phLast(m, ctx) - numzeros;
    if (phLast(m, ctx) === 0) {
      const tmp = m.heap.slice(states, states + 6);
      do { tmp[1] = (tmp[1] + 1) >> 1; escfreq >>= 1; } while (escfreq > 1);
      phFreeUnits(m, states, (n + 1) >> 1);
      m.FoundState = ctx + 2;
      m.heap.set(tmp, m.FoundState);
      return;
    }
    const n0 = (n + 1) >> 1, n1 = (phLast(m, ctx) + 2) >> 1;
    if (n0 !== n1) phS32(m, ctx + 4, phShrinkUnits(m, states, n0, n1));
  }
  phS16(m, ctx + 2, phSumm(m, ctx) + ((escfreq + 1) >> 1));
  m.FoundState = phStates(m, ctx);
}

function ppmhUpdateModel(m) {
  const P = PPMH;
  const fsSym = phSym(m, m.FoundState), fsFreq = phFreq(m, m.FoundState);
  let fsSucc = phSucc(m, m.FoundState);
  let state = 0;
  if (fsFreq < P.MAX_FREQ / 4 && phSuffix(m, m.MinContext)) {
    const context = phSuffix(m, m.MinContext);
    if (phLast(m, context) !== 0) {
      state = phStates(m, context);
      if (phSym(m, state) !== fsSym) {
        do state += 6; while (phSym(m, state) !== fsSym);
        if (phFreq(m, state) >= phFreq(m, state - 6)) { phSwap(m, state, state - 6); state -= 6; }
      }
      if (phFreq(m, state) < P.MAX_FREQ - 9) { phSetFreq(m, state, phFreq(m, state) + 2); phS16(m, context + 2, phSumm(m, context) + 2); }
    } else {
      state = context + 2;
      if (phFreq(m, state) < 32) phSetFreq(m, state, phFreq(m, state) + 1);
    }
  }
  const restart = () => { ppmhRestartModel(m); m.EscCount = 0; };
  if (m.OrderFall === 0) {
    m.MinContext = m.MaxContext = ppmhCreateSuccessors(m, true, state);
    phS32(m, m.FoundState + 2, m.MinContext);
    if (!m.MinContext) restart();
    return;
  }
  m.heap[m.pText++] = fsSym;
  let Successor = m.pText;
  if (m.pText >= m.UnitsStart) return restart();
  if (fsSucc) {
    if (fsSucc <= m.pText) {
      fsSucc = ppmhCreateSuccessors(m, false, state);
      if (!fsSucc) return restart();
    }
    if (--m.OrderFall === 0) {
      Successor = fsSucc;
      if (m.MaxContext !== m.MinContext) m.pText--;
    }
  } else {
    phS32(m, m.FoundState + 2, Successor);
    fsSucc = m.MinContext;
  }
  const minnum = phLast(m, m.MinContext) + 1;
  const s0 = phSumm(m, m.MinContext) - minnum - (fsFreq - 1);
  for (let cur = m.MaxContext; cur !== m.MinContext; cur = phSuffix(m, cur)) {
    const currnum = phLast(m, cur) + 1;
    if (currnum !== 1) {
      if ((currnum & 1) === 0) {
        const ns = phExpandUnits(m, phStates(m, cur), currnum >> 1);
        phS32(m, cur + 4, ns);
        if (!ns) return restart();
      }
      if (4 * currnum <= minnum && phSumm(m, cur) <= 8 * currnum) phS16(m, cur + 2, phSumm(m, cur) + 2);
      if (2 * currnum < minnum) phS16(m, cur + 2, phSumm(m, cur) + 1);
    } else {
      const st = phAllocUnits(m, 1);
      if (!st) return restart();
      m.heap.copyWithin(st, cur + 2, cur + 8);
      phS32(m, cur + 4, st);
      if (phFreq(m, st) < P.MAX_FREQ / 4 - 1) phSetFreq(m, st, phFreq(m, st) * 2);
      else phSetFreq(m, st, P.MAX_FREQ - 4);
      phS16(m, cur + 2, phFreq(m, st) + m.InitEsc + (minnum > 3 ? 1 : 0));
    }
    const cf = (2 * fsFreq * (phSumm(m, cur) + 6)) >>> 0, sf = (s0 + phSumm(m, cur)) >>> 0;
    let freq;
    if (cf < 6 * sf) {
      freq = cf >= 4 * sf ? 3 : cf > sf ? 2 : 1;
      phS16(m, cur + 2, phSumm(m, cur) + 3);
    } else {
      freq = cf >= 15 * sf ? 7 : cf >= 12 * sf ? 6 : cf >= 9 * sf ? 5 : 4;
      phS16(m, cur + 2, phSumm(m, cur) + freq);
    }
    const ns = phStates(m, cur) + 6 * currnum;
    phS32(m, ns + 2, Successor);
    m.heap[ns] = fsSym; m.heap[ns + 1] = freq;
    m.heap[cur] = currnum;
  }
  m.MaxContext = m.MinContext = fsSucc;
}
function ppmhCreateSuccessors(m, skip, state) {
  let context = m.MinContext;
  const upbranch = phSucc(m, m.FoundState), list = [];
  let done = false;
  if (!skip) { list.push(m.FoundState); if (!phSuffix(m, context)) done = true; }
  if (!done && state) {
    context = phSuffix(m, context);
    if (phSucc(m, state) !== upbranch) { context = phSucc(m, state); done = true; }
    else { list.push(state); if (!phSuffix(m, context)) done = true; }
  }
  if (!done) {
    const want = phSym(m, m.FoundState);
    do {
      context = phSuffix(m, context);
      if (phLast(m, context) !== 0) { state = phStates(m, context); while (phSym(m, state) !== want) state += 6; }
      else state = context + 2;
      if (phSucc(m, state) !== upbranch) { context = phSucc(m, state); break; }
      list.push(state);
    } while (phSuffix(m, context));
  }
  if (!list.length) return context;
  const upSym = m.heap[upbranch], upSucc = upbranch + 1;
  let upFreq;
  if (phLast(m, context) !== 0) {
    state = phStates(m, context);
    while (phSym(m, state) !== upSym) state += 6;
    const cf = phFreq(m, state) - 1, s0 = phSumm(m, context) - phLast(m, context) - 1 - cf;
    if (2 * cf <= s0) upFreq = 5 * cf > s0 ? 2 : 1;
    else upFreq = 1 + Math.trunc((2 * cf + 3 * s0 - 1) / (2 * s0));
  } else upFreq = phFreq(m, context + 2);
  for (let i = list.length - 1; i >= 0; i--) {
    context = phNewChild(m, context, list[i], upSym, upFreq & 0xFF, upSucc);
    if (!context) return 0;
  }
  return context;
}
