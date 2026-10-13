/* mac-stuffitx.js -- StuffIt X (.sitx): the catalog, and each file's forks,
   decompressed.
   =========================================================================

   StuffIt X opens with "StuffIt!" (mac-stuffit.js's looksLikeStuffItX) and
   is a different format from the two that file reads, with compressors of
   its own. The archive is a run of elements, each a bit-packed header (a
   type, attributes and the algorithms used) and data: files and folders,
   forks that say which file's data or resource fork is which stretch of a
   stream, a catalog of names and Finder information, and data elements,
   each a solid stream compressed whole, that the forks slice up. Each data
   element carries the CRC-32 of what it holds.

   PORTED, not written independently, from XADMaster, The Unarchiver's
   library ("Copyright (c) 2017-present, MacPaw Way Ltd.", LGPL-2.1-or-later,
   which section 3 lets be used under the GPL; github.com/MacPaw/XADMaster
   at commit 7cb9ee0a, 21 September 2026): XADStuffItXParser.m, StuffItXUtilities.m,
   XADStuffItXBlockHandle.m, XADStuffItXCyanideHandle.m,
   XADStuffItXIronHandle.m, XADStuffItXEnglishHandle.m, BWT.c,
   CarrylessRangeCoder.m, and PPMd's VariantG.c, Context.c, RangeCoder.c and
   SubAllocatorBrimstone.c. The Unarchiver is the only implementation known
   (stuffit-rs has none of these compressors), so a port is what there is;
   and because `unar` is the same code, holding this file to it shows the
   port faithful, not the format understood. utilities/sitx_check.mjs holds
   every fork to `unar` and every stream to the CRC-32 the archive stores
   for it, which is the archive's own word, and fails on a byte changed.

   READ: Brimstone (StuffIt's PPMd, variant G with an allocator of its
   own), Cyanide and Iron (two block-sorting compressors, each with its own
   coder), and the English preprocessing, which puts words back from a
   dictionary of 100,366 (mac-stuffitx-english.js, STUFFITX_ENGLISH_WORDS,
   loaded only for an archive that needs it). NOT READ, and refused by
   name: Darkhorse, Deflate, Blend, RC4 and the x86 filter, which none of
   the archives this was written for use, and encryption.

   Returns the shape parseStuffItArchive does, so that a caller can take
   either: { format, entries: [{ path, name, isFolder, type, creator,
   finderFlags, dataLen, rsrcLen }] }, the forks by stuffItXFork(bytes,
   entry, which).

   LOAD ORDER: after mac-bytes.js (crc32, fourcc, u16be, decodeMacRoman).
   A classic script, like the rest of js/: no import, no export, globals. */

const SITX_METHOD_NAMES = { 0: 'Brimstone', 1: 'Cyanide', 2: 'Darkhorse', 3: 'Deflate', 4: 'Blend', 5: 'RC4', 6: 'Iron' };
const SITX_PREPROCESS_NAMES = { 0: 'English', 1: 'Biff', 2: 'x86', 3: 'PEFF', 4: 'M68k', 5: 'Sparc', 6: 'TIFF', 7: 'WAV', 8: 'WRT' };

/* ---- Reading bits and bytes ----------------------------------------------
 * XADMaster's handles read bits least significant first from the byte at
 * hand, and a byte read takes the next whole byte, the rest of a byte
 * whose bits were begun being passed over. So one position in bits, `bp`,
 * serves both: a byte read starts at the next byte boundary. */
function sitxReader(bytes, start) { return { b: bytes, bp: (start || 0) * 8 }; }
function sitxAt(r) { return (r.bp + 7) >> 3; }
function sitxBit(r) {
  const i = r.bp >> 3;
  if (i >= r.b.length) throw new Error('StuffIt X: read past the end of the data');
  const v = (r.b[i] >> (r.bp & 7)) & 1;
  r.bp++;
  return v;
}
function sitxBitsLE(r, n) { let v = 0; for (let i = 0; i < n; i++) v |= sitxBit(r) << i; return v >>> 0; }
function sitxFlush(r) { r.bp = sitxAt(r) * 8; }
function sitxByte(r) {
  const i = sitxAt(r);
  if (i >= r.b.length) throw new Error('StuffIt X: read past the end of the data');
  r.bp = (i + 1) * 8;
  return r.b[i];
}
function sitxU32(r) { let v = 0; for (let i = 0; i < 4; i++) v = ((v << 8) | sitxByte(r)) >>> 0; return v; }
function sitxSkip(r, n) { r.bp = (sitxAt(r) + n) * 8; }
function sitxSeek(r, at) { r.bp = at * 8; }
// A number as StuffIt X writes it (ReadSitxP2): a count of ones in unary, then
// that many ones spread among the bits of the value, least significant first.
function sitxP2(r, limit) {
  let n = 1;
  while (sitxBit(r) === 1 && (!limit || n < 64)) n++;
  if (limit && n >= 64) throw new Error('StuffIt X: a number too long');
  let value = 0, bit = 1;
  while (n) {
    if (sitxBit(r) === 1) { n--; value += bit; }
    bit *= 2;
  }
  return value - 1;
}

/* ---- The archive -------------------------------------------------------- */
function sitxReadElement(r) {
  const el = { attribs: new Array(10).fill(-1), alglist: new Array(6).fill(-1), alglist3extra: -1, actualsize: 0, datacrc: null };
  el.something = sitxBit(r);
  el.type = sitxP2(r, true);
  for (;;) {
    const t = sitxP2(r, true);
    if (t === 0) break;
    const v = sitxP2(r, true);
    if (t <= 10) el.attribs[t - 1] = v;
  }
  for (;;) {
    const t = sitxP2(r, true);
    if (t === 0) break;
    const v = sitxP2(r, true);
    if (t <= 6) el.alglist[t - 1] = v;
    if (t === 4) el.alglist3extra = sitxP2(r, true);
  }
  el.dataoffset = sitxAt(r);
  return el;
}
// Past an element's data, keeping the CRC-32 it carries (ScanElementData).
function sitxScanData(r, el) {
  sitxSeek(r, el.dataoffset);
  for (;;) { const len = sitxP2(r, true); if (!len) break; sitxSkip(r, len); }
  sitxFlush(r);
  let len = sitxP2(r, true);
  if (len === 0) return;
  if (len === 4) { el.datacrc = sitxU32(r); len = sitxP2(r, true); }
  while (len) { sitxSkip(r, len); len = sitxP2(r, true); }
}

function parseStuffItXArchive(bytes) {
  if (!bytes || bytes.length < 8 || latin1(bytes.subarray(0, 7)) !== 'StuffIt' || (bytes[7] !== 0x21 && bytes[7] !== 0x3F)) throw new Error('not a StuffIt X archive');
  if (bytes[7] === 0x3F) throw new Error('StuffIt X: this archive is in a text encoding, which this page does not read');
  const r = sitxReader(bytes, 8);
  const entries = [], byId = new Map(), streams = new Map(), elements = new Map();
  for (;;) {
    const el = sitxReadElement(r);
    if (el.type === 0) break;
    if (el.type === 1) {                         // data: a stream the forks slice
      const id = el.attribs[0];
      sitxScanData(r, el);
      const pos = sitxAt(r);
      for (const f of streams.get(id) || []) { if (!f) throw new Error('StuffIt X: a stream with a fork missing'); el.actualsize += f.length; }
      elements.set(id, el);
      sitxSeek(r, pos);
    } else if (el.type === 2 || el.type === 4) { // a file, a folder
      const e = { id: el.attribs[0], parent: el.attribs[1], isFolder: el.type === 4, name: '', type: '', creator: '', finderFlags: 0, forks: {} };
      entries.push(e); byId.set(e.id, e);
    } else if (el.type === 3) {                  // a fork: a file's stretch of a stream
      const entry = el.attribs[1], stream = el.attribs[2], index = el.attribs[3], length = el.attribs[4];
      const type = sitxP2(r, true);
      if (!streams.has(stream)) streams.set(stream, []);
      const list = streams.get(stream);
      if (index > list.length) while (list.length < index) list.push(null);
      if (index === list.length) list.push({ entries: [entry], type, length });
      else if (!list[index]) list[index] = { entries: [entry], type, length };
      else { if (list[index].length !== length) throw new Error('StuffIt X: two forks of one place differ'); list[index].entries.push(entry); }
    } else if (el.type === 5) {                  // the catalog: names and Finder information
      sitxScanData(r, el);
      el.actualsize = el.attribs[4];
      const pos = sitxAt(r);
      sitxCatalog(sitxElementBytes(bytes, el, false), entries, byId);
      sitxSeek(r, pos);
    } else if (el.type === 6) sitxSkip(r, el.attribs[4]);
    else if (el.type === 7) sitxP2(r, true);
    else if (el.type === 8 || el.type === 9) { /* boundary, and one not known */ }
    else if (el.type > 10) sitxScanData(r, el);
    else throw new Error('StuffIt X: an element of type ' + el.type + ', which this page does not read');
    sitxFlush(r);
  }
  // each file's data and resource forks, as stretches of the streams
  for (const [stream, list] of streams) {
    let offs = 0;
    for (const f of list) {
      if (f && (f.type === 0 || f.type === 1)) for (const id of f.entries) { const e = byId.get(id); if (e) e.forks[f.type === 0 ? 'data' : 'rsrc'] = { stream, offs, length: f.length }; }
      offs += f ? f.length : 0;
    }
  }
  const pathOf = e => { const p = []; for (let x = e, n = 0; x && n < 64; x = byId.get(x.parent), n++) p.unshift(x.name); return p.join('/'); };
  return {
    format: 'StuffIt X', elements,
    entries: entries.map(e => ({
      path: pathOf(e), name: e.name, isFolder: e.isFolder, type: e.type, creator: e.creator, finderFlags: e.finderFlags,
      dataLen: e.forks.data ? e.forks.data.length : 0, rsrcLen: e.forks.rsrc ? e.forks.rsrc.length : 0, sitx: { forks: e.forks, elements },
    })),
  };
}

// A name: UTF-8 when it reads as UTF-8, else Mac Roman, as mac-zip.js takes names.
function sitxName(raw) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); } catch (e) { return decodeMacRoman(raw); }
}
function sitxString(r) { const len = sitxP2(r, true), at = sitxAt(r); const out = r.b.subarray(at, at + len); sitxSeek(r, at + len); sitxFlush(r); return out; }

function sitxCatalog(bytes, entries, byId) {
  const r = sitxReader(bytes, 0);
  for (const e of entries) {
    for (;;) {
      const key = sitxP2(r, true);
      if (!key) break;
      if (key === 1) e.name = sitxName(sitxString(r));
      else if (key === 2 || key === 8) { for (let i = 0; i < 8; i++) sitxBitsLE(r, 8); }
      else if (key === 3) { for (let i = 0; i < 4; i++) sitxBitsLE(r, 8); }
      else if (key === 4 || key === 5) {
        const d = new Uint8Array(32);
        for (let i = 0; i < 32; i++) d[i] = sitxBitsLE(r, 8);
        if (latin1(d.subarray(0, 8)) !== 'slnkrhap') { e.type = fourcc(d, 0); e.creator = fourcc(d, 4); e.finderFlags = u16be(d, 8); }
      } else if (key === 6) {
        const hasowner = sitxBitsLE(r, 8);
        for (let i = 0; i < (hasowner ? 12 : 4); i++) sitxBitsLE(r, 8);
      } else if (key === 7) sitxP2(r, true);
      else if (key === 9 || key === 11 || key === 12) sitxString(r);
      else if (key === 10) { const n = sitxP2(r, true); for (let i = 0; i < n; i++) sitxString(r); }
      else throw new Error('StuffIt X: a catalog entry of kind ' + key + ', which this page does not read');
    }
    sitxFlush(r);
  }
  void byId;
}

/* A fork of an entry: its stretch of the stream it is in, the stream
   decompressed once and kept on the parse. */
function stuffItXFork(bytes, entry, which) {
  const f = entry.sitx && entry.sitx.forks[which];
  if (!f || !f.length) return new Uint8Array(0);
  const el = entry.sitx.elements.get(f.stream);
  if (!el) throw new Error('"' + entry.name + '" is in a StuffIt X stream the archive does not hold');
  if (!el.decoded) el.decoded = sitxElementBytes(bytes, el, true);
  if (f.offs + f.length > el.decoded.length) throw new Error('"' + entry.name + '" runs past the end of its StuffIt X stream');
  return el.decoded.subarray(f.offs, f.offs + f.length);
}

// An element's data, decompressed and held to its CRC-32 (HandleForElement).
function sitxElementBytes(bytes, el, check) {
  const method = el.alglist[0], sum = el.alglist[1], pre = el.alglist[2], crypto = el.alglist[3];
  if (crypto >= 0) throw new Error('StuffIt X: this archive is encrypted');
  // the stream: P2-sized blocks one after another (XADStuffItXBlockHandle)
  const r = sitxReader(bytes, el.dataoffset), parts = [];
  let total = 0;
  for (;;) {
    const size = sitxP2(r, true);
    if (!size) break;
    const at = sitxAt(r);
    parts.push(bytes.subarray(at, Math.min(bytes.length, at + size)));
    total += size;
    sitxSeek(r, at + size);
  }
  const packed = new Uint8Array(total);
  for (let i = 0, o = 0; i < parts.length; o += parts[i].length, i++) packed.set(parts[i], o);
  const length = pre === 0 ? Infinity : el.actualsize;
  let out;
  if (method === -1) out = packed;
  else if (method === 0) out = sitxBrimstone(packed, length);
  else if (method === 1) out = sitxCyanide(packed, length);
  else if (method === 6) out = sitxIron(packed, length);
  else throw new Error('StuffIt X: compressed with ' + (SITX_METHOD_NAMES[method] || 'method ' + method) + ', which this page does not decompress');
  if (pre === 0) out = sitxEnglish(out, el.actualsize);
  else if (pre !== -1) throw new Error('StuffIt X: preprocessed with ' + (SITX_PREPROCESS_NAMES[pre] || 'method ' + pre) + ', which this page does not undo');
  if (out.length > el.actualsize) out = out.subarray(0, el.actualsize);
  if (check && sum === 0 && el.datacrc !== null && crc32(out) !== el.datacrc)
    throw new Error('StuffIt X: a stream decompressed to bytes whose CRC-32 is not the one the archive gives');
  return out;
}

/* ---- The range coder (CarrylessRangeCoder.m), in unsigned 32 bits -------
 * It reads whole bytes, from the byte boundary at which a reader stands; it
 * reads the array itself, for speed, and sitxCoderDone puts the reader
 * after what it took. */
function sitxCoder(r, uselow, bottom) {
  const c = { b: r.b, p: sitxAt(r), low: 0, range: 0xFFFFFFFF, uselow, bottom, code: 0 };
  for (let i = 0; i < 4; i++) c.code = ((c.code << 8) | sitxCoderByte(c)) >>> 0;
  return c;
}
function sitxCoderByte(c) {
  if (c.p >= c.b.length) throw new Error('StuffIt X: read past the end of the data');
  return c.b[c.p++];
}
function sitxCoderDone(c, r) { r.bp = c.p * 8; }
// (a quotient of two unsigned 32-bit numbers is below 2^32, so >>> 0 truncates it as C's division does)
function sitxCoderCount(c, scale) { c.range = (c.range / scale) >>> 0; return (((c.code - c.low) >>> 0) / c.range) >>> 0; }
function sitxCoderNormalize(c) {
  for (;;) {
    if (((c.low ^ ((c.low + c.range) >>> 0)) >>> 0) >= 0x1000000) {
      if (c.range >= c.bottom) break;
      c.range = ((-c.low) & (c.bottom - 1)) >>> 0;
    }
    c.code = ((c.code << 8) | sitxCoderByte(c)) >>> 0;
    c.range = (c.range << 8) >>> 0;
    c.low = (c.low << 8) >>> 0;
  }
}
function sitxCoderRemove(c, lowcount, highcount) {
  if (c.uselow) c.low = (c.low + Math.imul(c.range, lowcount)) >>> 0;
  else c.code = (c.code - Math.imul(c.range, lowcount)) >>> 0;
  c.range = Math.imul(c.range, highcount - lowcount) >>> 0;
  sitxCoderNormalize(c);
}
function sitxCoderSymbol(c, freqs, n) {
  let total = 0;
  for (let i = 0; i < n; i++) total += freqs[i];
  const tmp = sitxCoderCount(c, total);
  let cum = 0, k = 0;
  while (k < n - 1 && cum + freqs[k] <= tmp) cum += freqs[k++];
  sitxCoderRemove(c, cum, cum + freqs[k]);
  return k;
}
function sitxCoderWeightedBit(c, weight, size) {
  const v = sitxCoderCount(c, size);
  if (v < weight) { sitxCoderRemove(c, 0, weight); return 0; }
  sitxCoderRemove(c, weight, size); return 1;
}

/* ---- The block sort's inverse, and the move-to-front (BWT.c) ------------- */
function sitxUnsortBWT(dest, src, len, first, transform) {
  const counts = new Int32Array(256), cum = new Int32Array(256);
  for (let i = 0; i < len; i++) counts[src[i]]++;
  let total = 0;
  for (let i = 0; i < 256; i++) { cum[i] = total; total += counts[i]; counts[i] = 0; }
  for (let i = 0; i < len; i++) { transform[cum[src[i]] + counts[src[i]]] = i; counts[src[i]]++; }
  let t = first;
  for (let i = 0; i < len; i++) { t = transform[t]; dest[i] = src[t]; }
}
function sitxUnsortST4(dest, src, len, first, transform) {
  const counts = new Int32Array(256), array2 = new Int32Array(65536);
  for (let i = 0; i < len; i++) counts[src[i]]++;
  let total = 0;
  for (let i = 0; i < 256; i++) { const count = counts[i]; counts[i] = total; for (let j = 0; j < count; j++) array2[(src[total + j] << 8) | i]++; total += count; }
  const bitvec = dest;
  bitvec.fill(0, 0, (len + 7) >> 3);
  const array3 = new Int32Array(256).fill(-1), counts2 = Uint32Array.from(counts);
  total = 0;
  for (let i = 0; i < 0x10000; i++) {
    const count = array2[i];
    for (let j = 0; j < count; j++) {
      const byte = src[total + j];
      if (array3[byte] !== total) { array3[byte] = total; const x = counts[byte]; bitvec[x >> 3] |= 1 << (x & 7); }
      counts[byte]++;
    }
    total += count;
  }
  array3.fill(0);
  let index = 0;
  for (let i = 0; i < len; i++) {
    if (bitvec[i >> 3] & (1 << (i & 7))) index = i;
    const byte = src[i];
    if (index < array3[byte]) transform[i] = ((array3[byte] - 1) | 0x800000) >>> 0;
    else { transform[i] = counts2[byte]; array3[byte] = i + 1; }
    counts2[byte]++;
    transform[i] = (transform[i] | (byte << 24)) >>> 0;
  }
  index = first;
  let tval = transform[first];
  for (let i = 0; i < len; i++) {
    if (tval & 0x800000) {
      const ni = tval & 0x7fffff;
      if (ni >= len) return false;
      index = transform[ni] & 0x7fffff;
      transform[ni]++;
    } else {
      if (index >= len) return false;
      transform[index]++;
      index = tval & 0x7fffff;
    }
    if (index >= len) return false;
    tval = transform[index];
    dest[i] = tval >>> 24;
  }
  return true;
}
function sitxDecodeM1FFN(block, len, order) {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = i;
  let lasthead = order - 1;
  for (let i = 0; i < len; i++) {
    const s = block[i];
    block[i] = t[s];
    if (s === 0) lasthead = 0;
    else if (s === 1) { if (lasthead >= order) { const v = t[1]; t[1] = t[0]; t[0] = v; } }
    else { const v = t[s]; for (let k = s; k > 1; k--) t[k] = t[k - 1]; t[1] = v; }
    lasthead++;
  }
}

// Output gathered from blocks, up to a length (CSBlockStreamHandle).
function sitxGather(length) {
  const chunks = [];
  let n = 0;
  return {
    full: () => n >= length,
    add: b => { const take = Math.min(b.length, length - n); chunks.push(b.slice(0, take)); n += take; },
    out: () => { const o = new Uint8Array(n); let p = 0; for (const c of chunks) { o.set(c, p); p += c.length; } return o; },
  };
}

/* ---- Cyanide (XADStuffItXCyanideHandle.m) -------------------------------- */
const SITX_MARKOV_GROUPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 3, 9, 10, 3, 4, 5, 11, 11, 8, 6, 2, 5, 6, 7, 8, 12, 12, 13];
function sitxModel(n) { const m = { num: n, freq: new Uint32Array(256), map: new Uint32Array(256) }; for (let i = 0; i < n; i++) { m.freq[i] = 1; m.map[i] = n - 1 - i; } return m; }
function sitxBump(index, m, maxtotal) {
  let total = 0;
  for (let i = 0; i < m.num; i++) total += m.freq[i];
  if (total >= maxtotal) for (let i = 0; i < m.num; i++) m.freq[i] = (m.freq[i] + 1) >>> 1;
  const f = m.freq[index];
  let last = index;
  while (last < m.num - 1 && m.freq[last + 1] === f) last++;
  if (last !== index) { const t = m.map[index]; m.map[index] = m.map[last]; m.map[last] = t; }
  m.freq[last]++;
  return last;
}
const SITX_TERNARY_ORDERS = [[0, 1, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [1, 0, 2], [2, 1, 0]];
function sitxTernaryFreqs(out, meanings, inf) {
  const a = inf[0], b = inf[1], c = inf[2];
  const m = SITX_TERNARY_ORDERS[a < b ? (a < c ? (b < c ? 0 : 1) : 2) : (b < c ? (c < a ? 3 : 4) : 5)];
  meanings[0] = m[0]; meanings[1] = m[1]; meanings[2] = m[2];
  out[0] = inf[m[0]] + 1; out[1] = inf[m[1]] + 1; out[2] = inf[m[2]] + 1;
}
function sitxCyanide(packed, length) {
  const r = sitxReader(packed, 0), g = sitxGather(length);
  sitxByte(r);
  while (!g.full()) {
    const marker = sitxByte(r);
    if (marker === 0xff) break;
    if (marker !== 0x77) throw new Error('StuffIt X: a Cyanide block begins wrongly');
    const blocksize = sitxU32(r), firstindex = sitxU32(r), numsymbols = sitxByte(r);
    const sorted = new Uint8Array(blocksize), block = new Uint8Array(blocksize), table = new Uint32Array(blocksize);
    // the ternary-coded block
    const coder = sitxCoder(r, true, 0x10000);
    const markov = Array.from({ length: 14 }, () => new Uint32Array(3));
    const low = [];
    let b = numsymbols, shift = 1;
    while (b) { let n = 1 << shift; if (b < (3 << shift)) n = b; low[shift - 1] = sitxModel(n); b -= n; shift++; }
    const high = sitxModel(shift);
    let prev = 0, prev2 = 0, prev3 = 0, someflag = 1;
    const freqs = new Uint32Array(3), meanings = new Uint32Array(3);
    for (let i = 0; i < blocksize; i++) {
      const mi = SITX_MARKOV_GROUPS[prev3 * 9 + prev2 * 3 + prev], mf = markov[mi];
      sitxTernaryFreqs(freqs, meanings, mf);
      const tresym = meanings[sitxCoderSymbol(coder, freqs, 3)];
      if (tresym === 0 && someflag === 0 && mi === 0) {
        someflag = 1;
        mf[0] >>>= 1; mf[1] >>>= 1; mf[2] >>>= 1; mf[0] += 3;
        sorted[i] = 0;
      } else {
        if (tresym !== 0) someflag = 0;
        const total = freqs[0] + freqs[1] + freqs[2];
        if (total > (someflag ? 4096 : 128)) { mf[0] >>>= 1; mf[1] >>>= 1; mf[2] >>>= 1; }
        mf[tresym] += 2;
        if (tresym <= 1) sorted[i] = tresym;
        else {
          const hi = sitxCoderSymbol(coder, high.freq, high.num), highbit = high.map[hi];
          const ni = sitxBump(hi, high, 0x100);
          sitxBump(ni, high, 0x10000);
          if (highbit === 0) sorted[i] = 2;
          else {
            const lm = low[highbit - 1], li = sitxCoderSymbol(coder, lm.freq, lm.num), lowbits = lm.map[li];
            sitxBump(li, lm, Math.min(lm.num * 128, 0x4000));
            sorted[i] = (1 << highbit) + lowbits + 1;
          }
        }
      }
      prev3 = prev2; prev2 = prev; prev = tresym;
    }
    sitxCoderDone(coder, r);
    sitxDecodeM1FFN(sorted, blocksize, 2);
    sitxUnsortBWT(block, sorted, blocksize, firstindex, table);
    g.add(block);
  }
  return g.out();
}

/* ---- Iron (XADStuffItXIronHandle.m) -------------------------------------- */
function sitxIron(packed, length) {
  const r = sitxReader(packed, 0), g = sitxGather(length);
  const st4 = sitxBit(r), fancymtf = sitxBit(r);
  const maxfreq1 = 2 ** sitxP2(r), maxfreq2 = 2 ** sitxP2(r), maxfreq3 = 2 ** sitxP2(r);
  const bs1 = sitxP2(r), bs2 = sitxP2(r), bs3 = sitxP2(r), cs1 = sitxP2(r), cs2 = sitxP2(r), cs3 = sitxP2(r);
  while (!g.full()) {
    sitxFlush(r);
    if (sitxBit(r) === 1) break;
    const blocksize = sitxP2(r);
    if (blocksize > 0x7fffffff) throw new Error('StuffIt X: an Iron block too long');
    const block = new Uint8Array(blocksize), sorted = new Uint8Array(blocksize), table = new Uint32Array(blocksize);
    if (sitxBit(r) === 0) {
      const firstindex = sitxP2(r);
      if (firstindex >= blocksize) throw new Error('StuffIt X: an Iron block starts outside itself');
      sitxFlush(r);
      sitxIronBlock(r, blocksize, block, sorted, fancymtf, [maxfreq1, maxfreq2, maxfreq3], [bs1, bs2, bs3, cs1, cs2, cs3]);
      if (st4) { if (!sitxUnsortST4(block, sorted, blocksize, firstindex, table)) throw new Error('StuffIt X: an Iron block does not unsort'); }
      else sitxUnsortBWT(block, sorted, blocksize, firstindex, table);
    } else {
      sitxFlush(r);
      for (let i = 0; i < blocksize; i++) block[i] = sitxByte(r);
    }
    g.add(block);
  }
  return g.out();
}
function sitxIronBlock(r, blocksize, block, sorted, fancymtf, maxf, sh) {
  const [byteshift1, byteshift2, byteshift3, countshift1, countshift2, countshift3] = sh;
  const main = new Uint32Array(4).fill(1), lastbyte = new Uint32Array(256 * 4), something = new Uint32Array(4 * 256 * 4);
  const blw = new Uint32Array(8).fill(0x800), blw2 = new Uint32Array(64).fill(0x800), bbw = new Uint32Array(8 * 128).fill(0x800);
  const clw = new Uint32Array(4 * 16 * 24).fill(0x800), clw2 = new Uint32Array(256 * 24).fill(0x800), cbw = new Uint32Array(24 * 24).fill(0x800);
  const mtf = new Uint8Array(256), ia1 = new Uint32Array(257), ia2 = new Uint32Array(257), ia3 = new Uint32Array(257);
  let numbytes = 0;
  if (fancymtf) { for (let i = 0; i < 257; i++) { ia1[i] = i; ia2[i] = i; ia3[i] = 0; } ia3[256] = 0xFFFFFFFF; }
  else for (let i = 0; i < 256; i++) mtf[i] = i;
  sitxByte(r);
  const coder = sitxCoder(r, false, 0);
  const wbit = (arr, i, shift) => {
    const w = arr[i], bit = sitxCoderWeightedBit(coder, w, 0x1000);
    arr[i] = bit === 0 ? w + ((0x1000 - w) >>> shift) : w - (w >>> shift);
    return bit;
  };
  const wbit2 = (a1, i1, s1, a2, i2, s2) => {
    const w1 = a1[i1], w2 = a2[i2], bit = sitxCoderWeightedBit(coder, (w1 + w2) >>> 1, 0x1000);
    if (bit === 0) { a1[i1] = w1 + ((0x1000 - w1) >>> s1); a2[i2] = w2 + ((0x1000 - w2) >>> s2); }
    else { a1[i1] = w1 - (w1 >>> s1); a2[i2] = w2 - (w2 >>> s2); }
    return bit;
  };
  let valuehistory = 0, lengthhistory = 0, lastbits = 0, lb = 0;
  const freqs = new Uint32Array(4);
  for (let i = 0; i < blocksize;) {
    const f2 = lb * 4, f3 = ((lengthhistory & 3) * 256 + valuehistory) * 4;
    for (let j = 0; j < 4; j++) freqs[j] = main[j] + lastbyte[f2 + j] + something[f3 + j];
    const symbol = sitxCoderSymbol(coder, freqs, 4);
    main[symbol] += 2; lastbyte[f2 + symbol] += 2; something[f3 + symbol] += 2;
    let t1 = 0, t2 = 0, t3 = 0;
    for (let j = 0; j < 4; j++) { t1 += main[j]; t2 += lastbyte[f2 + j]; t3 += something[f3 + j]; }
    if (t1 > maxf[0]) for (let j = 0; j < 4; j++) main[j] = (main[j] + 1) >>> 1;
    if (t2 > maxf[1]) for (let j = 0; j < 4; j++) lastbyte[f2 + j] >>>= 1;
    if (t3 > maxf[2]) for (let j = 0; j < 4; j++) something[f3 + j] >>>= 1;
    let value;
    if (symbol !== 3) value = symbol;
    else {
      let bits = 0;
      while (bits < 6) { if (wbit2(blw, bits, byteshift1, blw2, lastbits * 8 + bits, byteshift2) === 0) break; bits++; }
      value = 1;
      for (let j = 0; j <= bits; j++) value = (value << 1) | wbit(bbw, bits * 128 + value, byteshift3);
      value++;
      lastbits = bits;
    }
    let byte;
    if (fancymtf) {
      const index = (value + 1) & 0xff;
      byte = ia1[index] & 0xff;
      block[numbytes] = byte;
      ia3[byte] += 0x4000;
      for (let k = ia2[byte]; k > 0; k--) { ia1[k] = ia1[k - 1]; ia2[ia1[k - 1]] = k; }
      ia1[0] = byte; ia2[byte] = 0;
      for (let j = 0; j < 12; j++) {
        const n = 1 << j;
        if (n <= numbytes) {
          const b2 = block[numbytes - n];
          if (j === 0) ia3[b2] -= 0x3801; else ia3[b2] -= 0x800 >> j;
          if (b2 !== byte) {
            let v = ia2[b2];
            while (ia3[ia1[v + 1]] > ia3[b2]) { ia1[v] = ia1[v + 1]; ia2[ia1[v + 1]] = v; v++; }
            ia1[v] = b2; ia2[b2] = v;
          }
        }
      }
      numbytes++;
    } else {
      const index = (value + 1) & 0xff;
      byte = mtf[index];
      mtf.copyWithin(1, 0, index);
      mtf[0] = byte;
    }
    const shortvalue = value <= 3 ? value : 3;
    let bits = 0;
    for (;;) {
      if (wbit2(clw, (shortvalue * 16 + lengthhistory) * 24 + bits, countshift1, clw2, byte * 24 + bits, countshift2) === 0) break;
      bits++;
      if (bits >= 24) throw new Error('StuffIt X: an Iron run too long');
    }
    let count = 1;
    for (let j = 0; j < bits; j++) count = (count << 1) | wbit(cbw, bits * 24 + j, countshift3);
    for (let j = 0; j < count; j++) { if (i >= blocksize) throw new Error('StuffIt X: an Iron run past its block'); sorted[i++] = byte; }
    valuehistory = ((valuehistory << 2) | shortvalue) & 0xff;
    lengthhistory = (lengthhistory << 1) & 0x0e;
    if (bits > 1) lengthhistory |= 1;
    lb = byte;
  }
  sitxCoderDone(coder, r);
}

/* ---- Brimstone: PPMd variant G, StuffIt's (VariantG.c, Context.c,
 * RangeCoder.c, SubAllocatorBrimstone.c) --------------------------------------
 * The model lives in one heap, as in the C: a context is 12 bytes (its last
 * state's index, flags, the sum of its frequencies, its states, its suffix),
 * a state 6 (symbol, frequency, successor), all little-endian, and a
 * context with one state keeps it in place of the sum and the pointer. A
 * pointer is an offset into the heap, 0 none; the heap starts a little way
 * in so that no unit is at 0. */
const SITX_PPM = { MAX_O: 255, INT_BITS: 7, PERIOD_BITS: 7, TOT_BITS: 14, MAX_FREQ: 124, INTERVAL: 128, BIN_SCALE: 1 << 14, UNIT: 12, BASE: 16 };
const SITX_EXP_ESCAPE = [25, 14, 9, 7, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2];
const SITX_INIT_BIN_ESC = [0x3CDD, 0x1F3F, 0x59BF, 0x48F3, 0x5FFB, 0x5545, 0x63D1, 0x5D9D, 0x64A1, 0x5ABC, 0x6632, 0x6051, 0x68F6, 0x549B, 0x6BCA, 0x3AB0];

function sitxBrimstone(packed, length) {
  const r = sitxReader(packed, 0);
  const exponent = sitxByte(r);
  if (exponent > 31) throw new Error('StuffIt X: a Brimstone model too large');
  const order = sitxByte(r);
  const m = sitxPPMdStart(r, 2 ** exponent, order);
  const out = [];
  let n = 0;
  const cap = length === Infinity ? Infinity : length;
  let buf = new Uint8Array(Math.min(cap === Infinity ? 1 << 20 : cap, 1 << 24) || 1);
  while (n < cap) {
    let b;
    try { b = sitxPPMdNextByte(m); } catch (e) { if (e === SITX_PPM) b = -1; else throw e; }
    if (b < 0) break;
    if (n === buf.length) { const nb = new Uint8Array(buf.length * 2); nb.set(buf); buf = nb; }
    buf[n++] = b;
  }
  void out;
  return buf.subarray(0, n);
}

function sitxPPMdStart(r, size, maxorder) {
  const P = SITX_PPM, heap = new Uint8Array(P.BASE + size), dv = new DataView(heap.buffer);
  const m = {
    heap, dv, size, maxorder,
    // the allocator (SubAllocatorBrimstone.c)
    Index2Units: new Uint8Array(38), Units2Index: new Uint8Array(128), FreeList: new Uint32Array(38), LowUnit: 0, HighUnit: 0,
    // the coder
    coder: null,
    // the core model
    scale: 0, FoundState: 0, OrderFall: 0, InitEsc: 0, RunLength: 0, InitRL: 0, CharMask: new Uint8Array(256), LastMaskIndex: 0, EscCount: 1, PrevSuccess: 0,
    MinContext: 0, MedContext: 0, MaxContext: 0,
    SEE2: [], Dummy: { Summ: 0, Shift: P.PERIOD_BITS, Count: 0 }, NS2BSIndx: new Uint8Array(256), NS2Indx: new Uint8Array(256), BinSumm: new Uint16Array(128 * 16),
  };
  const N1 = 4, N2 = 4, N3 = 4, N4 = (128 + 3 - 1 * N1 - 2 * N2 - 3 * N3) >> 2;
  for (let i = 0; i < N1; i++) m.Index2Units[i] = 1 + i;
  for (let i = 0; i < N2; i++) m.Index2Units[N1 + i] = 2 + N1 + i * 2;
  for (let i = 0; i < N3; i++) m.Index2Units[N1 + N2 + i] = 3 + N1 + 2 * N2 + i * 3;
  for (let i = 0; i < N4; i++) m.Index2Units[N1 + N2 + N3 + i] = 4 + N1 + 2 * N2 + 3 * N3 + i * 4;
  for (let k = 0, i = 0; k < 128; k++) { if (m.Index2Units[i] < k + 1) i++; m.Units2Index[k] = i; }
  m.coder = sitxCoder(r, true, 0x10000);
  m.EscCount = 1;
  for (let i = 0; i < 6; i++) m.NS2BSIndx[i] = 2 * i;
  for (let i = 6; i < 50; i++) m.NS2BSIndx[i] = 12;
  for (let i = 50; i < 256; i++) m.NS2BSIndx[i] = 14;
  for (let i = 0; i < 4; i++) m.NS2Indx[i] = i;
  for (let i = 4; i < 12; i++) m.NS2Indx[i] = 4 + ((i - 4) >> 1);
  for (let i = 12; i < 44; i++) m.NS2Indx[i] = 8 + ((i - 12) >> 2);
  for (let i = 44; i < 256; i++) m.NS2Indx[i] = 16 + ((i - 44) >> 3);
  if (!sitxPPMdRestart(m)) throw new Error('StuffIt X: a Brimstone model does not fit its memory');
  return m;
}

// The heap: bytes, and 16- and 32-bit little-endian words at any offset.
const sitxH16 = (m, o) => m.dv.getUint16(o, true);
const sitxH32 = (m, o) => m.dv.getUint32(o, true);
const sitxS16 = (m, o, v) => m.dv.setUint16(o, v & 0xffff, true);
const sitxS32 = (m, o, v) => m.dv.setUint32(o, v >>> 0, true);
// a context's fields, and a state's
const cxLast = (m, c) => m.heap[c], cxFlags = (m, c) => m.heap[c + 1], cxSumm = (m, c) => sitxH16(m, c + 2), cxStates = (m, c) => sitxH32(m, c + 4), cxSuffix = (m, c) => sitxH32(m, c + 8);
const cxOneState = c => c + 2;
const stSym = (m, s) => m.heap[s], stFreq = (m, s) => m.heap[s + 1], stSucc = (m, s) => sitxH32(m, s + 2);
const stSetFreq = (m, s, v) => { m.heap[s + 1] = v; };
const sitxNumStates = (m, c) => (cxFlags(m, c) ? 0 : cxLast(m, c) + 1);
function sitxCopyState(m, to, from) { m.heap.copyWithin(to, from, from + 6); }
function sitxSwapStates(m, a, b) { const t = m.heap.slice(a, a + 6); m.heap.copyWithin(a, b, b + 6); m.heap.set(t, b); }

// the allocator
const sitxI2B = (m, i) => SITX_PPM.UNIT * m.Index2Units[i];
function sitxInsertNode(m, p, i) { sitxS32(m, p, m.FreeList[i]); m.FreeList[i] = p; }
function sitxRemoveNode(m, i) { const n = m.FreeList[i]; m.FreeList[i] = sitxH32(m, n); return n; }
function sitxSplitBlock(m, pv, oldi, newi) {
  let p = pv + sitxI2B(m, newi), diff = m.Index2Units[oldi] - m.Index2Units[newi];
  const i = m.Units2Index[diff - 1];
  if (m.Index2Units[i] !== diff) { sitxInsertNode(m, p, i - 1); p += sitxI2B(m, i - 1); diff -= m.Index2Units[i - 1]; }
  sitxInsertNode(m, p, m.Units2Index[diff - 1]);
}
function sitxAllocInit(m) { m.FreeList.fill(0); m.LowUnit = SITX_PPM.BASE; m.HighUnit = SITX_PPM.BASE + SITX_PPM.UNIT * Math.floor(m.size / SITX_PPM.UNIT); }
function sitxAllocUnits(m, num) {
  const index = m.Units2Index[num - 1];
  if (m.FreeList[index]) return sitxRemoveNode(m, index);
  const units = m.LowUnit;
  m.LowUnit += sitxI2B(m, index);
  if (m.LowUnit <= m.HighUnit) return units;
  m.LowUnit -= sitxI2B(m, index);
  for (let i = index + 1; i < 38; i++) if (m.FreeList[i]) { const u = sitxRemoveNode(m, i); sitxSplitBlock(m, u, i, index); return u; }
  return 0;
}
function sitxAllocContext(m) { if (m.HighUnit > m.LowUnit) { m.HighUnit -= SITX_PPM.UNIT; return m.HighUnit; } return sitxAllocUnits(m, 1); }
function sitxExpandUnits(m, oldoffs, oldnum) {
  const oldi = m.Units2Index[oldnum - 1], newi = m.Units2Index[oldnum];
  if (oldi === newi) return oldoffs;
  const offs = sitxAllocUnits(m, oldnum + 1);
  if (offs) { m.heap.copyWithin(offs, oldoffs, oldoffs + sitxI2B(m, oldi)); sitxInsertNode(m, oldoffs, oldi); }
  return offs;
}
function sitxShrinkUnits(m, oldoffs, oldnum, newnum) {
  const oldi = m.Units2Index[oldnum - 1], newi = m.Units2Index[newnum - 1];
  if (oldi === newi) return oldoffs;
  if (m.FreeList[newi]) { const p = sitxRemoveNode(m, newi); m.heap.copyWithin(p, oldoffs, oldoffs + sitxI2B(m, newi)); sitxInsertNode(m, oldoffs, oldi); return p; }
  sitxSplitBlock(m, oldoffs, oldi, newi);
  return oldoffs;
}
function sitxFreeUnits(m, offs, num) { sitxInsertNode(m, offs, m.Units2Index[num - 1]); }

// contexts (Context.c)
function sitxNewContext(m) {
  const c = sitxAllocContext(m);
  if (c) { m.heap[c] = 0; m.heap[c + 1] = 0; sitxS32(m, c + 8, 0); }
  return c;
}
function sitxNewChild(m, suffix, suffixstate, firststate) {
  const c = sitxAllocContext(m);
  if (c) {
    m.heap[c] = 0; m.heap[c + 1] = 0;
    sitxS32(m, c + 8, suffix);
    sitxS32(m, suffixstate + 2, c);
    if (firststate) sitxCopyState(m, cxOneState(c), firststate);
  }
  return c;
}
const sitxMakeSEE2 = (init, count) => ({ Shift: SITX_PPM.PERIOD_BITS - 4, Summ: (init << (SITX_PPM.PERIOD_BITS - 4)) & 0xffff, Count: count });
function sitxSEE2MeanMasked(s) { let r = s.Summ >>> s.Shift; s.Summ = (s.Summ - r) & 0xffff; r &= 0x03ff; return r === 0 ? 1 : r; }
function sitxUpdateSEE2(s) {
  if (s.Shift >= SITX_PPM.PERIOD_BITS) return;
  s.Count = (s.Count - 1) & 0xff;
  if (s.Count === 0) { s.Summ = (s.Summ * 2) & 0xffff; s.Count = (3 << s.Shift) & 0xff; s.Shift++; }
}
const sitxGetMean = (summ, shift, round) => (summ + (1 << (shift - round))) >>> shift;

function sitxDecodeBinSymbol(m, ctx, bsi) {
  const P = SITX_PPM, rs = cxOneState(ctx);
  const bs = m.BinSumm[bsi];
  const bit = sitxCoderWeightedBit(m.coder, bs, 1 << P.TOT_BITS);
  if (bit === 0) {
    m.PrevSuccess = 1; m.RunLength++; m.FoundState = rs;
    if (stFreq(m, rs) < 128) stSetFreq(m, rs, stFreq(m, rs) + 1);
    m.BinSumm[bsi] = (bs + P.INTERVAL - sitxGetMean(bs, P.PERIOD_BITS, 2)) & 0xffff;
  } else {
    m.PrevSuccess = 0; m.FoundState = 0; m.LastMaskIndex = 0;
    m.CharMask[stSym(m, rs)] = m.EscCount;
    const nb = (bs - sitxGetMean(bs, P.PERIOD_BITS, 2)) & 0xffff;
    m.BinSumm[bsi] = nb;
    m.InitEsc = SITX_EXP_ESCAPE[nb >>> 10];
  }
}
function sitxDecodeSymbol1(m, ctx) {
  m.scale = cxSumm(m, ctx);
  const states = cxStates(m, ctx), firstcount = stFreq(m, states);
  const count = sitxCoderCount(m.coder, m.scale);
  if (count < firstcount) {
    sitxCoderRemove(m.coder, 0, firstcount);
    if (2 * firstcount > m.scale) { m.PrevSuccess = 1; m.RunLength++; } else m.PrevSuccess = 0;
    m.FoundState = states;
    stSetFreq(m, states, firstcount + 4);
    sitxS16(m, ctx + 2, cxSumm(m, ctx) + 4);
    if (firstcount + 4 > SITX_PPM.MAX_FREQ) sitxRescale(m, ctx);
    return;
  }
  let high = firstcount;
  m.PrevSuccess = 0;
  for (let i = 1; i <= cxLast(m, ctx); i++) {
    const s = states + 6 * i;
    high += stFreq(m, s);
    if (high > count) { sitxCoderRemove(m.coder, high - stFreq(m, s), high); sitxUpdateContext1(m, ctx, s); return; }
  }
  if (!m.FoundState) return;
  sitxCoderRemove(m.coder, high, m.scale);
  m.LastMaskIndex = cxLast(m, ctx);
  m.FoundState = 0;
  for (let i = 0; i <= cxLast(m, ctx); i++) m.CharMask[stSym(m, states + 6 * i)] = m.EscCount;
}
function sitxUpdateContext1(m, ctx, s) {
  stSetFreq(m, s, stFreq(m, s) + 4);
  sitxS16(m, ctx + 2, cxSumm(m, ctx) + 4);
  if (stFreq(m, s) > stFreq(m, s - 6)) {
    sitxSwapStates(m, s, s - 6);
    m.FoundState = s - 6;
    if (stFreq(m, s - 6) > SITX_PPM.MAX_FREQ) sitxRescale(m, ctx);
  } else m.FoundState = s;
}
function sitxDecodeSymbol2(m, ctx, see) {
  const n = cxLast(m, ctx) - m.LastMaskIndex, ps = new Array(n);
  let total = 0, s = cxStates(m, ctx);
  for (let i = 0; i < n; i++) {
    while (m.CharMask[stSym(m, s)] === m.EscCount) s += 6;
    total += stFreq(m, s);
    ps[i] = s; s += 6;
  }
  m.scale = (m.scale + total) >>> 0;
  const count = sitxCoderCount(m.coder, m.scale);
  if (count < total) {
    let i = 0, high = stFreq(m, ps[0]);
    while (high <= count && i + 1 < n) high += stFreq(m, ps[++i]);
    sitxCoderRemove(m.coder, high - stFreq(m, ps[i]), high);
    sitxUpdateSEE2(see);
    sitxUpdateContext2(m, ctx, ps[i]);
  } else {
    sitxCoderRemove(m.coder, total, m.scale);
    m.LastMaskIndex = cxLast(m, ctx);
    see.Summ = (see.Summ + m.scale) & 0xffff;
    for (let i = 0; i < n; i++) m.CharMask[stSym(m, ps[i])] = m.EscCount;
  }
}
function sitxUpdateContext2(m, ctx, s) {
  m.FoundState = s;
  stSetFreq(m, s, stFreq(m, s) + 4);
  sitxS16(m, ctx + 2, cxSumm(m, ctx) + 4);
  if (stFreq(m, s) > SITX_PPM.MAX_FREQ) sitxRescale(m, ctx);
  m.EscCount = (m.EscCount + 1) & 0xff;
  m.RunLength = m.InitRL;
}
function sitxRescale(m, ctx) {
  const states = cxStates(m, ctx), n = cxLast(m, ctx) + 1;
  stSetFreq(m, m.FoundState, stFreq(m, m.FoundState) + 4);
  let escfreq = cxSumm(m, ctx) + 4;
  const adder = m.OrderFall === 0 ? 0 : 1;
  let summ = 0;
  for (let i = 0; i < n; i++) {
    const s = states + 6 * i;
    escfreq -= stFreq(m, s);
    stSetFreq(m, s, (stFreq(m, s) + adder) >> 1);
    summ += stFreq(m, s);
    if (i > 0 && stFreq(m, s) > stFreq(m, s - 6)) {
      const tmp = m.heap.slice(s, s + 6);
      let j = i - 1;
      while (j > 0 && tmp[1] > stFreq(m, states + 6 * (j - 1))) j--;
      m.heap.copyWithin(states + 6 * (j + 1), states + 6 * j, states + 6 * i);
      m.heap.set(tmp, states + 6 * j);
    }
  }
  sitxS16(m, ctx + 2, summ);
  if (stFreq(m, states + 6 * (n - 1)) === 0) {
    let numzeros = 1;
    while (numzeros < n && stFreq(m, states + 6 * (n - 1 - numzeros)) === 0) numzeros++;
    escfreq += numzeros;
    m.heap[ctx] = cxLast(m, ctx) - numzeros;
    if (cxLast(m, ctx) === 0) {
      const tmp = m.heap.slice(states, states + 6);
      do { tmp[1] = (tmp[1] + 1) >> 1; escfreq >>= 1; } while (escfreq > 1);
      sitxFreeUnits(m, states, (n + 1) >> 1);
      m.FoundState = cxOneState(ctx);
      m.heap.set(tmp, m.FoundState);
      return;
    }
    const n0 = (n + 1) >> 1, n1 = (cxLast(m, ctx) + 2) >> 1;
    if (n0 !== n1) sitxS32(m, ctx + 4, sitxShrinkUnits(m, states, n0, n1));
  }
  sitxS16(m, ctx + 2, cxSumm(m, ctx) + ((escfreq + 1) >> 1));
  m.FoundState = cxStates(m, ctx);
}
function sitxClearMask(m) { m.EscCount = 1; m.CharMask.fill(0); }

// variant G (VariantG.c)
function sitxPPMdRestart(m) {
  const P = SITX_PPM;
  sitxAllocInit(m);
  m.CharMask.fill(0);
  m.PrevSuccess = 0; m.OrderFall = 1;
  m.MaxContext = sitxNewContext(m);
  if (!m.MaxContext) return false;
  m.heap[m.MaxContext] = 255;
  sitxS16(m, m.MaxContext + 2, 385);
  const states = sitxAllocUnits(m, 128);
  if (!states) return false;
  sitxS32(m, m.MaxContext + 4, states);
  for (let i = 0; i < 256; i++) { const s = states + 6 * i; m.heap[s] = i; m.heap[s + 1] = i < 0x80 ? 2 : 1; sitxS32(m, s + 2, 0); }
  let state = states;
  for (let i = 1; ; i++) {
    m.MaxContext = sitxNewChild(m, m.MaxContext, state, 0);
    if (!m.MaxContext) return false;
    if (i === m.maxorder) break;
    state = cxOneState(m.MaxContext);
    m.heap[state] = 0; m.heap[state + 1] = 1;
  }
  m.heap[m.MaxContext + 1] = 1;
  m.MedContext = m.MinContext = cxSuffix(m, m.MaxContext);
  for (let i = 0; i < 128; i++) for (let k = 0; k < 16; k++) m.BinSumm[i * 16 + k] = (P.BIN_SCALE - Math.floor(SITX_INIT_BIN_ESC[k] / (i + 2))) & 0xffff;
  m.SEE2 = [];
  for (let i = 0; i < 43; i++) { const row = []; for (let k = 0; k < 8; k++) row.push(sitxMakeSEE2(4 * i + 10, 3)); m.SEE2.push(row); }
  return true;
}
function sitxPPMdNextByte(m) {
  if (!m.MinContext) return -1;
  if (sitxNumStates(m, m.MinContext) !== 1) sitxDecodeSymbol1(m, m.MinContext);
  else {
    const rs = cxOneState(m.MinContext);
    sitxDecodeBinSymbol(m, m.MinContext, (stFreq(m, rs) - 1) * 16 + m.PrevSuccess + m.NS2BSIndx[cxLast(m, cxSuffix(m, m.MinContext))]);
  }
  while (!m.FoundState) {
    do {
      m.OrderFall++;
      m.MinContext = cxSuffix(m, m.MinContext);
      if (!m.MinContext) return -1;
    } while (cxLast(m, m.MinContext) === m.LastMaskIndex);
    sitxDecodeSymbol2G(m, m.MinContext);
  }
  const byte = stSym(m, m.FoundState);
  if (m.OrderFall === 0 && cxFlags(m, stSucc(m, m.FoundState)) === 0) m.MinContext = m.MedContext = stSucc(m, m.FoundState);
  else { sitxUpdateModel(m); if (m.EscCount === 0) sitxClearMask(m); }
  return byte;
}
function sitxDecodeSymbol2G(m, ctx) {
  const diff = cxLast(m, ctx) - m.LastMaskIndex;
  let see;
  if (cxLast(m, ctx) !== 255) {
    see = m.SEE2[m.NS2Indx[diff - 1]][
      (diff < cxLast(m, cxSuffix(m, ctx)) - cxLast(m, ctx) ? 1 : 0) +
      (cxSumm(m, ctx) < 11 * sitxNumStates(m, ctx) ? 2 : 0) +
      (m.LastMaskIndex + 1 > diff ? 4 : 0)];
    m.scale = sitxSEE2MeanMasked(see);
  } else { m.scale = 1; see = m.Dummy; }
  sitxDecodeSymbol2(m, ctx, see);
}
function sitxUpdateModel(m) {
  const P = SITX_PPM;
  const fs = { at: m.FoundState, Symbol: stSym(m, m.FoundState), Freq: stFreq(m, m.FoundState), Successor: stSucc(m, m.FoundState) };
  let state = 0;
  if (fs.Freq < P.MAX_FREQ / 4 && cxSuffix(m, m.MinContext)) {
    const context = cxSuffix(m, m.MinContext);
    if (sitxNumStates(m, context) !== 1) {
      state = cxStates(m, context);
      if (stSym(m, state) !== fs.Symbol) {
        do state += 6; while (stSym(m, state) !== fs.Symbol);
        if (stFreq(m, state) >= stFreq(m, state - 6)) { sitxSwapStates(m, state, state - 6); state -= 6; }
      }
      if (stFreq(m, state) < Math.floor(7 * P.MAX_FREQ / 8)) { stSetFreq(m, state, stFreq(m, state) + 2); sitxS16(m, context + 2, cxSumm(m, context) + 2); }
    } else {
      state = cxOneState(context);
      if (stFreq(m, state) < 32) stSetFreq(m, state, stFreq(m, state) + 1);
    }
  }
  const restart = () => { sitxPPMdRestart(m); m.EscCount = 0; };
  let Successor, SkipCount = 0;
  if (m.OrderFall === 0) {
    if (!sitxMakeRoot(m, 2, 0)) return restart();
    m.MinContext = m.MedContext = fs.Successor;
    return;
  } else if (--m.OrderFall === 0) { Successor = fs.Successor; SkipCount = 1; }
  else {
    Successor = sitxNewContext(m);
    if (!Successor) return restart();
    m.heap[Successor + 1] = 1;
  }
  if (cxFlags(m, m.MaxContext) === 1) {
    const os = cxOneState(m.MaxContext);
    m.heap[os] = fs.Symbol;
    sitxS32(m, os + 2, Successor);
  }
  const minnum = sitxNumStates(m, m.MinContext);
  const s0 = cxSumm(m, m.MinContext) - minnum - (fs.Freq - 1);
  for (let cur = m.MedContext; cur !== m.MinContext; cur = cxSuffix(m, cur)) {
    const currnum = sitxNumStates(m, cur);
    if (currnum !== 1) {
      if ((currnum & 1) === 0) {
        const ns = sitxExpandUnits(m, cxStates(m, cur), currnum >> 1);
        sitxS32(m, cur + 4, ns);
        if (!ns) return restart();
      }
      if (4 * currnum <= minnum && cxSumm(m, cur) <= 8 * currnum) sitxS16(m, cur + 2, cxSumm(m, cur) + 2);
      if (2 * currnum < minnum) sitxS16(m, cur + 2, cxSumm(m, cur) + 1);
    } else {
      const states = sitxAllocUnits(m, 1);
      if (!states) return restart();
      sitxCopyState(m, states, cxOneState(cur));
      sitxS32(m, cur + 4, states);
      if (stFreq(m, states) < P.MAX_FREQ / 4 - 1) stSetFreq(m, states, stFreq(m, states) * 2);
      else stSetFreq(m, states, P.MAX_FREQ - 4);
      sitxS16(m, cur + 2, stFreq(m, states) + m.InitEsc + (minnum > 3 ? 1 : 0));
    }
    const cf = 2 * fs.Freq * (cxSumm(m, cur) + 6), sf = s0 + cxSumm(m, cur);
    let freq;
    if (cf < 6 * sf) {
      freq = cf >= 4 * sf ? 3 : cf > sf ? 2 : 1;
      sitxS16(m, cur + 2, cxSumm(m, cur) + 3);
    } else {
      freq = cf >= 15 * sf ? 7 : cf >= 12 * sf ? 6 : cf >= 9 * sf ? 5 : 4;
      sitxS16(m, cur + 2, cxSumm(m, cur) + freq);
    }
    const ns = cxStates(m, cur) + 6 * currnum;
    sitxS32(m, ns + 2, Successor);
    m.heap[ns] = fs.Symbol; m.heap[ns + 1] = freq;
    m.heap[cur] = currnum;
  }
  if (fs.Successor) {
    if (cxFlags(m, fs.Successor) === 1) { if (!sitxMakeRoot(m, SkipCount, state)) return restart(); }
    m.MinContext = stSucc(m, m.FoundState);
  } else {
    sitxS32(m, m.FoundState + 2, Successor);
    m.OrderFall++;
  }
  m.MedContext = m.MinContext;
  if (!Successor) throw SITX_PPM;
  m.MaxContext = Successor;
}
function sitxMakeRoot(m, SkipCount, state) {
  let context = m.MinContext;
  const upbranch = stSucc(m, m.FoundState), statelist = [];
  let skip = false;
  if (SkipCount === 0) { statelist.push(m.FoundState); if (!cxSuffix(m, context)) skip = true; }
  else if (SkipCount === 2) context = cxSuffix(m, context);
  if (!skip && state) {
    context = cxSuffix(m, context);
    if (stSucc(m, state) !== upbranch) { context = stSucc(m, state); skip = true; }
    else { statelist.push(state); if (!cxSuffix(m, context)) skip = true; }
  }
  if (!skip) {
    do {
      context = cxSuffix(m, context);
      if (!context) throw SITX_PPM;
      if (sitxNumStates(m, context) !== 1) { state = cxStates(m, context); while (stSym(m, state) !== stSym(m, m.FoundState)) state += 6; }
      else state = cxOneState(context);
      if (stSucc(m, state) !== upbranch) { context = stSucc(m, state); break; }
      statelist.push(state);
    } while (cxSuffix(m, context));
  }
  const upstate = cxOneState(upbranch);
  if (sitxNumStates(m, context) !== 1) {
    state = cxStates(m, context);
    while (stSym(m, state) !== stSym(m, upstate)) state += 6;
    const cf = stFreq(m, state) - 1, s0 = cxSumm(m, context) - cxLast(m, context) - 1 - cf;
    if (2 * cf <= s0) stSetFreq(m, upstate, 5 * cf > s0 ? 2 : 1);
    else stSetFreq(m, upstate, 1 + Math.floor((2 * cf + 3 * s0 - 1) / (2 * s0)));
  } else stSetFreq(m, upstate, stFreq(m, cxOneState(context)));
  for (let i = statelist.length - 1; i >= 0; i--) {
    context = sitxNewChild(m, context, statelist[i], upstate);
    if (!context) return false;
  }
  if (m.OrderFall === 0) { m.heap[upbranch] = 0; m.heap[upbranch + 1] = 0; sitxS32(m, upbranch + 8, context); }
  return true;
}

/* ---- English (XADStuffItXEnglishHandle.m) --------------------------------
 * Words back from the dictionary: an escape byte, three codes for a word
 * as it is, with a capital and in capitals, and the word's number spelled in
 * letters as base 52, 'a' to 'z' 1 to 26 and 'A' to 'Z' 27 to 52. The
 * dictionary is mac-stuffitx-english.js's STUFFITX_ENGLISH_WORDS, a word a
 * line, which a page loads only for an archive that needs it. */
const SITX_ENGLISH_WORD_COUNT = 100366;
let SITX_ENGLISH_TABLE = null;
function sitxEnglishTable() {
  if (SITX_ENGLISH_TABLE) return SITX_ENGLISH_TABLE;
  if (typeof STUFFITX_ENGLISH_WORDS !== 'string') { const e = new Error('StuffIt X: this archive needs the English dictionary, mac-stuffitx-english.js'); e.needs = 'mac-stuffitx-english.js'; throw e; }
  const words = STUFFITX_ENGLISH_WORDS.split('\n');
  if (words.length !== SITX_ENGLISH_WORD_COUNT + 1) throw new Error('StuffIt X: the English dictionary is not the one StuffIt uses');
  SITX_ENGLISH_TABLE = words.slice(0, SITX_ENGLISH_WORD_COUNT).map(w => Uint8Array.from(w, ch => ch.charCodeAt(0)));
  return SITX_ENGLISH_TABLE;
}
function sitxEnglish(input, length) {
  const out = new Uint8Array(length);
  let p = 0, n = 0;
  const atEOF = () => p >= input.length;
  const nextByte = () => { if (p >= input.length) throw new Error('StuffIt X: an English stream ends early'); return input[p++]; };
  let caseflag = true;
  const esccode = nextByte(), wordcode = nextByte(), firstcode = nextByte(), uppercode = nextByte();
  let word = new Uint8Array(33), wordlen = 0, wordoffs = 0;
  while (n < length) {
    if (wordoffs < wordlen) { out[n++] = word[wordoffs++]; continue; }
    if (atEOF()) break;
    let c = nextByte();
    if (c === esccode) { caseflag = false; out[n++] = nextByte(); continue; }
    if (c === wordcode || c === firstcode || c === uppercode) {
      let c2, index = 0;
      for (;;) {
        if (atEOF()) { c2 = -1; break; }
        c2 = nextByte();
        if ((c2 < 65 || c2 > 90) && (c2 < 97 || c2 > 122)) break;
        index *= 52;
        index += c2 <= 90 ? c2 - 65 + 26 + 1 : c2 - 97 + 1;
        if (index >= SITX_ENGLISH_WORD_COUNT) throw new Error('StuffIt X: an English word number past the dictionary');
      }
      const w = sitxEnglishTable()[index];
      wordlen = w.length;
      word.set(w, 0);
      wordoffs = 0;
      if (c === uppercode) for (let i = 0; i < wordlen; i++) word[i] = (word[i] - 32) & 0xff;
      else if (c === firstcode) word[0] = (word[0] - 32) & 0xff;
      if (caseflag) {
        if (word[0] >= 65 && word[0] <= 90) word[0] += 32;
        else if (word[0] >= 97 && word[0] <= 122) word[0] -= 32;
      }
      if (c2 === esccode) c2 = nextByte();
      if (c2 !== -1) word[wordlen++] = c2;
      caseflag = c2 === 46 || c2 === 63 || c2 === 33;
      out[n++] = word[wordoffs++];
      continue;
    }
    if (caseflag) {
      if (c >= 65 && c <= 90) { c += 32; caseflag = false; }
      else if (c >= 97 && c <= 122) { c -= 32; caseflag = false; }
      else caseflag = true;
    }
    if (c === 46 || c === 63 || c === 33) caseflag = true;
    else if (c !== 32 && c !== 10 && c !== 13 && c !== 9) caseflag = false;
    out[n++] = c;
  }
  return out.subarray(0, n);
}
