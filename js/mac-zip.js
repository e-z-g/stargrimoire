/* mac-zip.js -- read a zip archive: its central directory, each file stored or
   deflated, and the resource fork and Finder type a Mac keeps beside a file.
   =========================================================================

   WHY A ZIP READER, IN A TREE ABOUT CLASSIC MAC FILES. Two reasons, and the
   second is the one that matters. One of the community's add-ons, Rocky the
   Flying Chicken, is a .zip holding two saved games. And a saved game shared
   today arrives as one: the Finder's Compress and the Files app's Compress
   both make a zip, so a player on a phone who is sent a save gets a zip and
   has no way to take the file out of it before handing it to this page.

   WHAT IT READS. The end-of-central-directory record, found by scanning back
   from the end of the file past any comment; the central directory, which is
   the authority for every entry's sizes, CRC and method (a local header
   written before its data may hold zeroes and a data descriptor after it);
   and each entry's local header, only for where its data starts. Stored
   (method 0) and deflated (method 8) entries are read; every other method is
   named and refused, as are encrypted entries, split archives and Zip64.
   Every entry read is held to the CRC-32 the directory carries for it, which
   is the format's own checksum and the only thing that tells a correct
   inflate from a plausible one.

   THE MAC PART. A zip has nowhere to put a resource fork or a Finder type, so
   a Mac writes them as an AppleDouble file beside the real one: `._name` in
   the same folder, or, from the Finder and `ditto --sequesterRsrc`, the same
   path under a top-level `__MACOSX/`. Those entries are read here, joined to
   the file they describe, and taken out of the entry list, so a caller sees
   one file with `type`, `creator` and a resource fork, the way a StuffIt entry
   looks (js/mac-stuffit.js). An `._` entry that does not hold AppleDouble is
   left in the list as an ordinary file.

   NAMES. UTF-8 when the entry's flag says so, and also when the bytes are
   valid UTF-8 without it, because the Finder writes UTF-8 names and does not
   set the flag. Otherwise Mac Roman: a zip made on a classic Mac is the case
   this page cares about, and a name that is not valid UTF-8 is far likelier
   to be Mac Roman than the IBM code page the specification names.

   THE INFLATER is `inflateRaw` in js/mac-vise.js, the one the installer
   reader uses. Not repeated here: two classic scripts share one
   global scope, and a second DEFLATE decoder would be a second thing to be
   wrong. The browser player defines an async `inflateRaw` of its own, so this
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

/* A local file header or an empty archive's end record at byte 0. A zip with
   a program in front of it (a self-extracting .exe) does not start this way
   and is not something this page is handed. */
function looksLikeZip(bytes) {
  if (!bytes || bytes.length < 22) return false;
  const sig = zipU32(bytes, 0);
  return sig === 0x04034b50 || sig === 0x06054b50;
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
  if (end < 0) throw new Error('no end-of-central-directory record, so not a whole zip archive');
  const disk = zipU16(bytes, end + 4), cdDisk = zipU16(bytes, end + 6);
  const count = zipU16(bytes, end + 10);
  const cdLen = zipU32(bytes, end + 12), cdOff = zipU32(bytes, end + 16);
  if (disk !== 0 || cdDisk !== 0) throw new Error('a zip split across several files');
  if (count === 0xFFFF || cdLen === 0xFFFFFFFF || cdOff === 0xFFFFFFFF)
    throw new Error('a Zip64 archive, which this page does not read');
  if (cdOff + cdLen > end) throw new Error('the central directory runs past its own end record');

  const all = [];
  let p = cdOff;
  for (let n = 0; n < count; n++) {
    if (p + 46 > end || zipU32(bytes, p) !== 0x02014b50)
      throw new Error('central directory entry ' + n + ' of ' + count + ' is not where the directory says');
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
    throw new Error(where + ' has no local header where the directory says');
  // The local header's own name and extra lengths, which need not match the
  // directory's: the extra field in particular is often different.
  const start = h + 30 + zipU16(bytes, h + 26) + zipU16(bytes, h + 28);
  if (start + entry.packedLen > bytes.length) throw new Error(where + ' runs past the end of the archive');
  const packed = bytes.subarray(start, start + entry.packedLen);
  let out;
  if (entry.method === 0) {
    if (entry.packedLen !== entry.len)
      throw new Error(where + ' says it is stored but is ' + entry.packedLen + ' bytes for a length of ' + entry.len);
    out = packed;
  } else if (entry.method === 8) {
    try { out = inflateRaw(packed, entry.len, 8); }
    catch (err) { throw new Error(where + ' would not inflate: ' + err.message); }
  } else {
    throw new Error(where + ' is compressed with zip method ' + entry.method +
      (ZIP_METHOD_NAMES[entry.method] ? ' (' + ZIP_METHOD_NAMES[entry.method] + ')' : '') +
      ', which this page does not decompress');
  }
  const got = crc32(out);
  if (got !== entry.crc)
    throw new Error(where + ' fails its CRC-32: ' + got.toString(16).padStart(8, '0') +
      ' where the archive says ' + entry.crc.toString(16).padStart(8, '0'));
  return out;
}
