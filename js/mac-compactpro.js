/* mac-compactpro.js -- Compact Pro (.cpt): the catalog, and each file's forks,
   decompressed.
   =========================================================================

   Compact Pro was the other Mac archiver of the 1990s, beside StuffIt. An
   archive opens with the byte 1 and, at byte 4, where its catalog is: a
   CRC-32, how many entries, a comment, then each entry, a folder (its name's
   length with the top bit set, and how many entries are in it, counted
   deep) or a file (its name, then 45 bytes: a volume, where its forks are,
   its Finder type and creator, dates, Finder flags, a CRC-32, flags, and
   each fork's length unpacked and packed). The resource fork comes first in
   the archive, the data fork after it. Each fork is run-length coded, and,
   when its flag is set (2 for the resource fork, 4 for the data fork),
   LZH-coded over that: blocks of about 128 KB, each with three Huffman codes
   (literals, lengths, the top bits of an offset) into an 8 KB
   window. A self-extracting Compact Pro archive (Finder type PACT, a .sea)
   is the same, in its data fork.

   PORTED, not written independently, from XADMaster, The Unarchiver's
   library ("Copyright (c) 2017-present, MacPaw Way Ltd.", LGPL-2.1-or-later,
   which section 3 lets be used under the GPL; github.com/MacPaw/XADMaster
   at commit 7cb9ee0a, 21 September 2026): XADCompactProParser.m,
   XADCompactProLZHHandle.m, XADCompactProRLEHandle.m, and the canonical
   codes of XADPrefixCode.m. A fork that is the only one its file has is
   held to the CRC-32 the catalog gives, as XADMaster checks it; a file with
   both forks has one CRC-32 over the two, which XADMaster does not check
   and neither does this. The catalog stores a CRC-32's complement.

   Returns the shape parseStuffItArchive does: { format, entries: [{ path,
   name, isFolder, type, creator, finderFlags, dataLen, rsrcLen }] }, and
   each entry's `read(which)` gives a fork, 'data' or 'rsrc'.

   LOAD ORDER: after mac-bytes.js (u16be, u32be, fourcc, decodeMacRoman,
   crc32). A classic script, like the rest of js/: no import, no export,
   globals. */

/* The byte 1, and at the offset byte 4 gives a catalog whose CRC-32 is right
   (XADCompactProParser's recognizer). */
function looksLikeCompactPro(bytes) {
  if (!bytes || bytes.length < 8 || bytes[0] !== 1) return false;
  try { cptCatalogEnd(bytes); return true; } catch (e) { return false; }
}

// Where the catalog ends, having held it to its CRC-32; throws if it is not one.
function cptCatalogEnd(bytes) {
  const at = u32be(bytes, 4);
  if (at + 7 > bytes.length) throw new Error('Compact Pro: the catalog is past the end of the archive');
  const n = u16be(bytes, at + 4);
  let p = at + 7 + bytes[at + 6];
  for (let i = 0; i < n; i++) {
    if (p >= bytes.length) throw new Error('Compact Pro: the catalog runs past the end of the archive');
    const len = bytes[p];
    p += 1 + (len & 0x7f) + (len & 0x80 ? 2 : 45);
  }
  if (p > bytes.length) throw new Error('Compact Pro: the catalog runs past the end of the archive');
  let c = 0xFFFFFFFF;
  for (let i = at + 4; i < p; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  if ((c >>> 0) !== u32be(bytes, at)) throw new Error('Compact Pro: the catalog fails its CRC-32');
  return p;
}

function parseCompactProArchive(bytes) {
  if (bytes[0] !== 1) throw new Error('not a Compact Pro archive');
  cptCatalogEnd(bytes);
  const at = u32be(bytes, 4);
  const entries = [];
  let p = at + 7 + bytes[at + 6];
  const folder = (parent, count) => {
    while (count > 0) {
      const len = bytes[p];
      const name = decodeMacRoman(bytes.subarray(p + 1, p + 1 + (len & 0x7f)));
      p += 1 + (len & 0x7f);
      const path = parent ? parent + '/' + name : name;
      if (len & 0x80) {
        const inside = u16be(bytes, p);
        p += 2;
        entries.push({ path, name, isFolder: true, type: '', creator: '', finderFlags: 0, dataLen: 0, rsrcLen: 0 });
        folder(path, inside);
        count -= inside + 1;
        continue;
      }
      const e = {
        path, name, isFolder: false,
        volume: bytes[p], offset: u32be(bytes, p + 1), type: fourcc(bytes, p + 5), creator: fourcc(bytes, p + 9),
        finderFlags: u16be(bytes, p + 21), crc: u32be(bytes, p + 23), flags: u16be(bytes, p + 27),
        rsrcLen: u32be(bytes, p + 29), dataLen: u32be(bytes, p + 33), rsrcPackedLen: u32be(bytes, p + 37), dataPackedLen: u32be(bytes, p + 41),
      };
      e.read = which => cptFork(bytes, e, which);
      entries.push(e);
      p += 45;
      count--;
    }
  };
  folder('', u16be(bytes, at + 4));
  return { format: 'Compact Pro', entries };
}

/* One fork of one entry, 'data' or 'rsrc', decompressed. */
function cptFork(bytes, e, which) {
  const rsrc = which === 'rsrc';
  const len = rsrc ? e.rsrcLen : e.dataLen;
  if (!len) return new Uint8Array(0);
  if (e.flags & 1) throw new Error('"' + e.path + '" is encrypted');
  const start = e.offset + (rsrc ? 0 : e.rsrcPackedLen), packedLen = rsrc ? e.rsrcPackedLen : e.dataPackedLen;
  if (start + packedLen > bytes.length) throw new Error('"' + e.path + '" runs past the end of the archive');
  let packed = bytes.subarray(start, start + packedLen);
  if (e.flags & (rsrc ? 2 : 4)) packed = cptLzh(packed);
  const out = cptRle(packed, len);
  if (!(e.rsrcLen && e.dataLen) && crc32(out) !== (~e.crc >>> 0))
    throw new Error('"' + e.path + '" fails its CRC-32');
  return out;
}

/* The run-length coding (XADCompactProRLEHandle): 0x81 0x82 n repeats the
   byte before n-1 times more; 0x81 0x82 0 is 0x81 0x82 themselves; 0x81
   then anything else is 0x81 and that byte; 0x81 0x81 is a 0x81 whose
   second 0x81 begins the next code. */
function cptRle(input, length) {
  const out = new Uint8Array(length);
  let i = 0, o = 0, saved = 0, repeat = 0, halfEscaped = false;
  const next = () => { if (i >= input.length) throw new Error('Compact Pro: the data ends early'); return input[i++]; };
  while (o < length) {
    if (repeat) { repeat--; out[o++] = saved; continue; }
    let b;
    if (halfEscaped) { b = 0x81; halfEscaped = false; } else b = next();
    if (b !== 0x81) { out[o++] = saved = b; continue; }
    b = next();
    if (b === 0x82) {
      b = next();
      if (b !== 0) { repeat = b - 2; out[o++] = saved; }
      else { repeat = 1; saved = 0x82; out[o++] = 0x81; }
    } else if (b === 0x81) { halfEscaped = true; out[o++] = saved = 0x81; }
    else { repeat = 1; saved = b; out[o++] = 0x81; }
  }
  return out;
}

/* A canonical prefix code, high bit first, the shortest code all zeros
   (XADPrefixCode's initWithLengths). Returns a function that reads one
   symbol with `bit`. */
function cptPrefixCode(lengths) {
  const count = new Uint16Array(17), symbols = [];
  for (let len = 1; len <= 15; len++) for (let i = 0; i < lengths.length; i++) if (lengths[i] === len) { count[len]++; symbols.push(i); }
  return bit => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bit();
      const n = count[len];
      if (code - first < n) return symbols[index + code - first];
      index += n; first = (first + n) << 1; code <<= 1;
    }
    throw new Error('Compact Pro: a code that is not in the table');
  };
}

/* The LZH layer (XADCompactProLZHHandle): blocks, each opening with three
   code-length tables (256 literals, 64 lengths, 128 offset tops), each a
   byte count and four bits per length. Then a bit: 1, a literal; 0, a
   match of the length coded, its offset the code's six top bits and six
   plain ones, into an 8 KB window that starts as zeros. A literal counts two toward the block's 0x1fff0, a match
   three. A block ends at a byte boundary and then skips two bytes, or three
   when it took an odd number. Unpacked length is not known; it ends with
   the data. */
function cptLzh(input) {
  const BLOCK = 0x1fff0, out = [];
  let pos = 0;   // in bits, high bit first
  const bit = () => { const i = pos >> 3; if (i >= input.length) throw RangeError(); pos++; return (input[i] >> (7 - ((pos - 1) & 7))) & 1; };
  const bits = n => { let v = 0; for (let k = 0; k < n; k++) v = (v << 1) | bit(); return v; };
  const byte = () => { pos = (pos + 7) & ~7; if ((pos >> 3) >= input.length) throw RangeError(); const v = input[pos >> 3]; pos += 8; return v; };
  const table = size => {
    const n = byte();
    if (n * 2 > size) throw new Error('Compact Pro: a code table too long');
    const lengths = new Uint8Array(size);
    for (let k = 0; k < n; k++) { const v = byte(); lengths[2 * k] = v >> 4; lengths[2 * k + 1] = v & 15; }
    return cptPrefixCode(lengths);
  };
  let count = BLOCK, blockStart = -1, literal, length, offset;
  try {
    for (;;) {
      if (count >= BLOCK) {
        if (blockStart >= 0) {
          pos = (pos + 7) & ~7;
          pos += (((pos >> 3) - blockStart) & 1 ? 3 : 2) * 8;
        }
        literal = table(256); length = table(64); offset = table(128);
        count = 0;
        blockStart = pos >> 3;
      }
      if (bit()) { count += 2; out.push(literal(bit)); }
      else {
        count += 3;
        const n = length(bit);
        // an offset of 0 reaches the whole window back, to the byte still in the window's slot
        const back = ((offset(bit) << 6) | bits(6)) || 8192;
        const from = out.length - back;
        for (let k = 0; k < n; k++) out.push(from + k >= 0 ? out[from + k] : 0);
      }
    }
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
  }
  return Uint8Array.from(out);
}
