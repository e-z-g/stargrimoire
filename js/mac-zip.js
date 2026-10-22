/* mac-zip.js -- read a zip archive: its central directory, each file stored or
   deflated, and the resource fork and Finder type a Mac stores beside a file.
   =========================================================================

   WHY A ZIP READER, IN A TREE ABOUT CLASSIC MAC FILES. Two reasons, and the
   second is the one that matters. One of the community's add-ons, Rocky the
   Flying Chicken, is a .zip holding two saved games. And a saved game shared
   today comes as one: the Finder's Compress and the Files app's Compress
   both make a zip, so a player on a phone who is sent a save receives a zip and
   has no way to take the file out of it before handing it to this page.

   WHAT IT READS. The end-of-central-directory record, found by scanning back
   from the end of the file past any comment; the central directory, which is
   the authority for every entry's sizes, CRC and method (a local header
   written before its data may hold zeroes and a data descriptor after it);
   and each entry's local header, only for where its data starts. Stored
   (method 0) and deflated (method 8) entries are read; every other method is
   named and rejected, as are encrypted entries, split archives and Zip64.
   Every entry read is held to the CRC-32 the directory has for it, which
   is the format's checksum and the only thing that distinguishes a correct
   inflate from a plausible one.

   THE MAC PART. A zip has nowhere to put a resource fork or a Finder type, so
   a Mac writes them as an AppleDouble file beside the real one: `._name` in
   the same folder, or, from the Finder and `ditto --sequesterRsrc`, the same
   path under a top-level `__MACOSX/`. Those entries are read here, joined to
   the file they describe, and taken out of the entry list, so a caller sees
   one file with `type`, `creator` and a resource fork, the way a StuffIt entry
   looks (js/mac-stuffit.js). An `._` entry that does not contain AppleDouble is
   left in the list as an ordinary file.

   NAMES. UTF-8 when the entry's flag is set, or when the bytes are
   valid UTF-8 without it, because the Finder writes UTF-8 names and does not
   set the flag. Otherwise Mac Roman: a zip made on a classic Mac is the case
   this page is for, and a name that is not valid UTF-8 is far likelier
   to be Mac Roman than the IBM code page the specification names.

   THE INFLATER is `inflateRaw` in js/mac-vise.js, the one the installer
   reader uses. Not repeated here: two classic scripts share one
   global scope, and a second DEFLATE decoder would be a second thing to be
   wrong. The browser player defines a different async `inflateRaw`, so this
   file cannot be vendored there as it stands.

   LOAD ORDER: after mac-bytes.js (crc32, decodeMacRoman),
   mac-containers.js (appleSingleForks) and mac-vise.js (inflateRaw). A classic
   script, like the rest of js/: no import, no export, globals.

   Checked by utilities/zip_check.mjs: against Node's zlib, against the zips
   Info-ZIP and Apple's `ditto` write, and against `unar` on the add-on. */

const ZIP_METHOD_NAMES = {
  0: 'stored', 1: 'shrunk', 6: 'imploded', 9: 'Deflate64', 12: 'bzip2',
  14: 'LZMA', 93: 'Zstandard', 95: 'xz', 98: 'PPMd', 99: 'AES encrypted'
};

const zipU16 = (b, o) => b[o] | (b[o + 1] << 8);
const zipU32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/* A local file header or an empty archive's end record at byte 0; or a ZipIt
   self-extracting archive's data fork, a PowerPC program ('Joy!', a PEF)
   with the zip after it, its offsets counted from the start of the fork, as
   XADMaster's XADZipItSEAParser reads it. ZipIt stores each file there as a
   MacBinary copy. Another program in front of a zip (a self-extracting .exe)
   is not something this page is handed. */
function looksLikeZip(bytes) {
  if (!bytes || bytes.length < 22) return false;
  const sig = zipU32(bytes, 0);
  // the first part of a zip split across files opens with the split marker, then its first entry
  if (sig === 0x04034b50 || sig === 0x06054b50 || (sig === 0x08074b50 && zipU32(bytes, 4) === 0x04034b50)) return true;
  // and its last part ends with the end record, naming a disk past the first (a middle part has neither)
  const floor = Math.max(0, bytes.length - 22 - 0xFFFF);
  const pef = sig === 0x21796f4a;   // 'Joy!'
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (zipU32(bytes, i) !== 0x06054b50) continue;
    if (i + 22 + zipU16(bytes, i + 20) === bytes.length && zipU16(bytes, i + 4) > 0) return true;
    // a ZipIt SEA: the directory ends where the end record begins, and eight bytes ('TIPZ', a version) may follow
    const dir = zipU32(bytes, i + 16);
    if (pef && dir + zipU32(bytes, i + 12) === i && dir + 4 <= i && zipU32(bytes, dir) === 0x02014b50) return true;
  }
  return false;
}

/* A zip's entries read from their local headers, one after another, for an
   archive whose central directory is not here to read: a part of a zip split
   across files (rEV_Windows001.zip to 003.zip in archive.org's EV Nova
   collection: 11 MB pieces, the directory in the last), or the parts joined
   end to end. The walk starts at the first header (past the split marker, or
   past the tail of an entry the part before held) and stops at the first
   that is not a header, or whose data runs past the end: an entry cut off by
   the end of its part. An entry that stores its lengths in a data descriptor
   after its data is found by the descriptor whose packed length is the
   distance walked. */
function zipLocalEntries(bytes) {
  const out = [];
  const header = p => p + 30 <= bytes.length && zipU32(bytes, p) === 0x04034b50;
  let p = 0;
  while (p + 30 <= bytes.length && !header(p)) p++;
  while (header(p)) {
    const flags = zipU16(bytes, p + 6), method = zipU16(bytes, p + 8);
    let crc = zipU32(bytes, p + 14), packedLen = zipU32(bytes, p + 18), len = zipU32(bytes, p + 22);
    const nameLen = zipU16(bytes, p + 26), extraLen = zipU16(bytes, p + 28);
    const start = p + 30 + nameLen + extraLen;
    if (start > bytes.length) break;
    let next = start + packedLen;
    if ((flags & 8) && !packedLen) {
      let q = start, found = false;
      for (; q + 16 <= bytes.length; q++) if (zipU32(bytes, q) === 0x08074b50 && zipU32(bytes, q + 8) === q - start) { found = true; break; }
      if (!found) break;
      crc = zipU32(bytes, q + 4); packedLen = q - start; len = zipU32(bytes, q + 12); next = q + 16;
    } else if (flags & 8) {
      next += zipU32(bytes, next) === 0x08074b50 ? 16 : 12;
    }
    if (start + packedLen > bytes.length) break;
    const path = zipDecodeName(bytes.subarray(p + 30, p + 30 + nameLen), !!(flags & 0x800));
    const isFolder = /\/$/.test(path);
    const parts = path.replace(/\/$/, '').split('/');
    out.push({ path, name: parts[parts.length - 1], isFolder, method, flags, crc, packedLen, len,
               headerOffset: p, type: '', creator: '', rsrc: new Uint8Array(0) });
    p = next;
  }
  return out;
}

function zipDecodeName(raw, utf8Flag) {
  if (!utf8Flag) {
    let ascii = true;
    for (let i = 0; i < raw.length; i++) if (raw[i] > 0x7F) { ascii = false; break; }
    if (ascii) return decodeMacRoman(raw);
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(raw); }
  catch (e) { return utf8Flag ? new TextDecoder('utf-8').decode(raw) : decodeMacRoman(raw); }
}

/* The catalog. Returns
 *
 *   { format: 'Zip', entries: [{ path, name, isFolder, method, flags, crc,
 *                                packedLen, len, headerOffset, type, creator,
 *                                rsrc }] }
 *
 * `rsrc` is the resource fork out of the entry's AppleDouble, already read,
 * or an empty array. Throws on anything that is not a readable zip. */
function parseZipArchive(bytes) {
  if (!bytes || bytes.length < 22) throw new Error('too short to be a zip archive');
  let end = -1;
  const floor = Math.max(0, bytes.length - 22 - 0xFFFF);
  for (let i = bytes.length - 22; i >= floor; i--) {
    if (zipU32(bytes, i) === 0x06054b50 && i + 22 + zipU16(bytes, i + 20) <= bytes.length) { end = i; break; }
  }
  // no directory, or one of a zip split across files: what the local headers hold
  if (end < 0 || zipU16(bytes, end + 4) !== 0 || zipU16(bytes, end + 6) !== 0) {
    const walked = zipLocalEntries(bytes);
    if (!walked.length) throw new Error(end < 0 ? 'no end-of-central-directory record, so not a whole zip archive' : 'a zip split across several files, and no whole entry in this part');
    return zipJoinAppleDoubles(bytes, walked);
  }
  const count = zipU16(bytes, end + 10);
  const cdLen = zipU32(bytes, end + 12), cdOff = zipU32(bytes, end + 16);
  if (count === 0xFFFF || cdLen === 0xFFFFFFFF || cdOff === 0xFFFFFFFF)
    throw new Error('a Zip64 archive, which this page does not read');
  if (cdOff + cdLen > end) throw new Error('the central directory runs past the end record');

  const all = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (p + 46 > end || zipU32(bytes, p) !== 0x02014b50)
      throw new Error('central directory entry ' + n + ' of ' + count + ' is not where the directory has it');
    const flags = zipU16(bytes, p + 8), method = zipU16(bytes, p + 10);
    const crc = zipU32(bytes, p + 16), packedLen = zipU32(bytes, p + 20), len = zipU32(bytes, p + 24);
    const nameLen = zipU16(bytes, p + 28), extraLen = zipU16(bytes, p + 30), commentLen = zipU16(bytes, p + 32);
    const headerOffset = zipU32(bytes, p + 42);
    if (packedLen === 0xFFFFFFFF || len === 0xFFFFFFFF || headerOffset === 0xFFFFFFFF)
      throw new Error('a Zip64 entry, which this page does not read');
    const path = zipDecodeName(bytes.subarray(p + 46, p + 46 + nameLen), !!(flags & 0x800));
    p += 46 + nameLen + extraLen + commentLen;
    const isFolder = /\/$/.test(path);
    const parts = path.replace(/\/$/, '').split('/');
    all.push({ path, name: parts[parts.length - 1], isFolder, method, flags, crc, packedLen, len,
               headerOffset, type: '', creator: '', rsrc: new Uint8Array(0) });
  }
  return zipJoinAppleDoubles(bytes, all);
}

function zipJoinAppleDoubles(bytes, all) {
  /* Join each AppleDouble to its file. Read here rather than on demand, so the
     catalog can say what a file is -- its Finder type and creator -- before
     anything is decompressed, as a StuffIt catalog does. */
  const byPath = new Map();
  for (const e of all) if (!e.isFolder) byPath.set(e.path, e);
  const entries = [];
  for (const e of all) {
    const inMacosx = /^__MACOSX\//.test(e.path);
    const m = !e.isFolder && /^(.*\/)?\._([^/]+)$/.exec(inMacosx ? e.path.slice('__MACOSX/'.length) : e.path);
    if (m) {
      // A folder's AppleDouble (its custom icon) has no owner here and goes.
      const owner = byPath.get((m[1] || '') + m[2]);
      let ad = null;
      try { ad = appleSingleForks(zipFork(bytes, e, 'data')); } catch (err) { ad = null; }
      if (ad && ad.kind === 'AppleDouble') {
        if (owner) {
          owner.type = ad.type; owner.creator = ad.creator;
          owner.rsrc = ad.rsrc.slice();
        }
        continue;
      }
    }
    // A folder __MACOSX made only to hold AppleDoubles is not part of what was zipped.
    if (inMacosx && e.isFolder) continue;
    entries.push(e);
  }
  return { format: 'Zip', entries };
}

/* One fork of one entry. `which` is 'data' or 'rsrc'. The data fork is
 * decompressed and held to the directory's CRC-32; the resource fork is the
 * one parseZipArchive already took out of the entry's AppleDouble. Throws,
 * naming the method, for an entry this file cannot read. */
function zipFork(bytes, entry, which) {
  if (which === 'rsrc') return entry.rsrc || new Uint8Array(0);
  if (entry.isFolder) return new Uint8Array(0);
  const where = '"' + entry.path + '"';
  if (entry.flags & 1) throw new Error(where + ' is encrypted');
  const h = entry.headerOffset;
  if (h + 30 > bytes.length || zipU32(bytes, h) !== 0x04034b50)
    throw new Error(where + ' has no local header where the directory has it');
  // The local header's name and extra lengths, which need not match the
  // directory's: the extra field in particular is often different.
  const start = h + 30 + zipU16(bytes, h + 26) + zipU16(bytes, h + 28);
  if (start + entry.packedLen > bytes.length) throw new Error(where + ' runs past the end of the archive');
  const packed = bytes.subarray(start, start + entry.packedLen);
  let out;
  if (entry.method === 0) {
    if (entry.packedLen !== entry.len)
      throw new Error(where + ' is marked stored but is ' + entry.packedLen + ' bytes for a length of ' + entry.len);
    out = packed;
  } else if (entry.method === 8) {
    try { out = inflateRaw(packed, entry.len, 8); }
    catch (err) { throw new Error(where + ' would not inflate: ' + err.message); }
  } else {
    throw new Error(where + ' is compressed with zip method ' + entry.method +
      (ZIP_METHOD_NAMES[entry.method] ? ' (' + ZIP_METHOD_NAMES[entry.method] + ')' : '') +
      ', which this page does not decompress');
  }
  const actualCrc = crc32(out);
  if (actualCrc !== entry.crc)
    throw new Error(where + ' fails its CRC-32: ' + actualCrc.toString(16).padStart(8, '0') +
      ' where the archive has ' + entry.crc.toString(16).padStart(8, '0'));
  return out;
}
