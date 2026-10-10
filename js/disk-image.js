/* disk-image.js -- the files inside a Mac disk image (.dmg).
   =========================================================================

   A UDIF image, as Mac OS X's Disk Utility writes one, holding an HFS Plus
   volume: EV Nova 1.1.1 ships as one. `udifFiles(bytes)` lists the files
   on the volume as `parseStuffItArchive` lists an archive's, and reads
   either fork of any of them, inflating only the parts of the image that
   fork lies in: the 1.1.1 image is a 512 MB volume in 94 MB, most of it
   empty.

   WHERE THE FORMAT CAME FROM

   HFS Plus: Apple's Technical Note TN1150, *HFS Plus Volume Format* (in
   cythera-reference's apple-documentation), for the volume header, the
   B-tree nodes, the catalog's and the extents file's records. UDIF has no
   document of Apple's; its layout here (the 512-byte `koly` trailer at the
   end, an XML property list whose `blkx` entries each hold a `mish` table
   of chunks) was read off EV Nova 1.1.1's image itself on 8 October 2026.
   `utilities/dmg_check.mjs` holds what this reads to the files macOS's own
   `hdiutil` copied out of the same image.

   Chunks read: zeros (0 and 2), stored (1) and zlib (0x80000005), which is
   all 1.1.1's image uses. Others (ADC, bzip2, LZFSE) are refused by name.

   No DOM. LOAD ORDER: after js/mac-vise.js, whose inflateRaw it uses. */

function looksLikeUdif(bytes) {
  const k = bytes.length - 512;
  return k >= 0 && bytes[k] === 0x6B && bytes[k + 1] === 0x6F && bytes[k + 2] === 0x6C && bytes[k + 3] === 0x79;   // 'koly'
}

function udifU64(b, at) { return u32be(b, at) * 4294967296 + u32be(b, at + 4); }

function udifBase64(s) {
  const t = s.replace(/[^A-Za-z0-9+/]/g, '');
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out = new Uint8Array(Math.floor(t.length * 3 / 4));
  let o = 0, acc = 0, n = 0;
  for (let i = 0; i < t.length; i++) {
    acc = (acc << 6) | A.indexOf(t[i]);
    if (++n === 4) { out[o++] = acc >> 16 & 255; out[o++] = acc >> 8 & 255; out[o++] = acc & 255; acc = 0; n = 0; }
  }
  if (n === 3) { out[o++] = acc >> 10 & 255; out[o++] = acc >> 2 & 255; }
  else if (n === 2) out[o++] = acc >> 4 & 255;
  return out.subarray(0, o);
}

const UDIF_CHUNK = { 0: 'zero', 1: 'raw', 2: 'zero', 0x80000004: 'ADC', 0x80000005: 'zlib', 0x80000006: 'bzip2', 0x80000007: 'LZFSE', 0x7FFFFFFE: 'comment', 0xFFFFFFFF: 'end' };

/* The image's partitions: [{ name, sector, sectors, chunks: [{ type, sector, sectors, off, len }] }],
   sectors 512 bytes, `off` from the start of the image's bytes. */
function udifPartitions(bytes) {
  if (!looksLikeUdif(bytes)) throw new Error('not a UDIF disk image');
  const k = bytes.length - 512;
  const dataFork = udifU64(bytes, k + 0x18);
  const xmlOff = udifU64(bytes, k + 0xD8), xmlLen = udifU64(bytes, k + 0xE0);
  const xml = decodeMacRoman(bytes.subarray(xmlOff, xmlOff + xmlLen));
  const blkx = /<key>blkx<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(xml);
  if (!blkx) throw new Error('the disk image has no blkx table');
  const out = [];
  for (const d of blkx[1].split(/<dict>/).slice(1)) {
    const data = /<key>Data<\/key>\s*<data>([\s\S]*?)<\/data>/.exec(d);
    if (!data) continue;
    const name = (/<key>(?:CFName|Name)<\/key>\s*<string>([\s\S]*?)<\/string>/.exec(d) || [, ''])[1];
    const m = udifBase64(data[1]);
    if (u32be(m, 0) !== 0x6D697368) continue;   // 'mish'
    const sector = udifU64(m, 8), sectors = udifU64(m, 16), base = udifU64(m, 24), n = u32be(m, 200);
    const chunks = [];
    for (let i = 0; i < n; i++) {
      const at = 204 + 40 * i, type = u32be(m, at);
      if (type === 0x7FFFFFFE || type === 0xFFFFFFFF) continue;
      chunks.push({ type, sector: sector + udifU64(m, at + 8), sectors: udifU64(m, at + 16), off: dataFork + base + udifU64(m, at + 24), len: udifU64(m, at + 32) });
    }
    out.push({ name, sector, sectors, chunks });
  }
  return out;
}

/* A partition's bytes as `read(pos, n)`, each chunk inflated when first
   reached and the last few kept. */
function udifReader(bytes, part) {
  const cache = new Map();
  const chunkBytes = c => {
    if (cache.has(c)) return cache.get(c);
    const size = c.sectors * 512, kind = UDIF_CHUNK[c.type];
    let out;
    if (kind === 'zero') out = new Uint8Array(size);
    else if (kind === 'raw') out = bytes.subarray(c.off, c.off + size);
    else if (kind === 'zlib') out = inflateRaw(bytes.subarray(c.off + 2, c.off + c.len), size);
    else throw new Error(`the disk image's ${kind || 'type 0x' + c.type.toString(16)} chunks are not read here`);
    if (cache.size >= 8) cache.delete(cache.keys().next().value);
    cache.set(c, out);
    return out;
  };
  const chunks = part.chunks, start = part.sector * 512;
  const find = pos => {
    let lo = 0, hi = chunks.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (chunks[mid].sector * 512 - start <= pos) lo = mid; else hi = mid - 1; }
    return chunks[lo];
  };
  return {
    size: part.sectors * 512,
    read(pos, n) {
      const out = new Uint8Array(n);
      let got = 0;
      while (got < n) {
        const c = find(pos + got), cs = c.sector * 512 - start, b = chunkBytes(c);
        const from = pos + got - cs, take = Math.min(n - got, c.sectors * 512 - from);
        if (take <= 0) throw new Error('the disk image ends before ' + (pos + got));
        out.set(b.subarray(from, from + take), got);
        got += take;
      }
      return out;
    },
  };
}

/* ---- HFS Plus (TN1150) ---------------------------------------------------- */

function hfspExtents(b, at) {
  const out = [];
  for (let i = 0; i < 8; i++) { const s = u32be(b, at + 8 * i), n = u32be(b, at + 8 * i + 4); if (n) out.push([s, n]); }
  return out;
}
function hfspFork(b, at) { return { size: udifU64(b, at), blocks: u32be(b, at + 12), extents: hfspExtents(b, at + 16) }; }
function hfspName(b, at) {
  const n = u16be(b, at);
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(u16be(b, at + 2 + 2 * i));
  return s.normalize('NFC');
}

/* The volume in `read(pos, n)`: { files: [{ path, name, type, creator, dataLen, rsrcLen, read(which) }] }. */
function hfspVolume(read) {
  const vh = read(1024, 512);
  const sig = String.fromCharCode(vh[0], vh[1]);
  if (sig !== 'H+' && sig !== 'HX') throw new Error(sig === 'BD' ? 'the disk image holds an HFS volume, not HFS Plus' : 'the disk image holds no HFS Plus volume');
  const bs = u32be(vh, 40);
  const forkBytes = (fork, overflow) => {
    const ext = fork.extents.concat(overflow || []), out = new Uint8Array(fork.size);
    let got = 0;
    for (const [s, n] of ext) {
      if (got >= fork.size) break;
      const take = Math.min(n * bs, fork.size - got);
      out.set(read(s * bs, take), got);
      got += take;
    }
    if (got < fork.size) throw new Error('a fork runs past its extents');
    return out;
  };
  // every leaf record of a B-tree file, as [key bytes, record bytes]
  const leaves = tree => {
    const nodeSize = u16be(tree, 32), out = [];
    let node = u32be(tree, 24);
    for (let guard = 0; node && guard < tree.length / nodeSize; guard++) {
      const at = node * nodeSize, nd = tree.subarray(at, at + nodeSize), count = u16be(nd, 10);
      for (let i = 0; i < count; i++) {
        const r = u16be(nd, nodeSize - 2 * (i + 1)), end = u16be(nd, nodeSize - 2 * (i + 2));
        const kl = u16be(nd, r);
        out.push([nd.subarray(r, r + 2 + kl), nd.subarray(r + 2 + kl + (kl & 1), end)]);
      }
      node = u32be(nd, 0);
    }
    return out;
  };
  // forks in more than eight pieces: the rest in the extents overflow file
  const overflow = new Map();
  const extFork = hfspFork(vh, 192);
  if (extFork.size) for (const [k, r] of leaves(forkBytes(extFork))) {
    const key = k[2] + ':' + u32be(k, 4);
    if (!overflow.has(key)) overflow.set(key, []);
    overflow.get(key).push([u32be(k, 8), hfspExtents(r, 0)]);
  }
  const more = (id, which) => (overflow.get((which === 'rsrc' ? 0xFF : 0) + ':' + id) || []).sort((a, b) => a[0] - b[0]).flatMap(x => x[1]);
  const folders = new Map(), files = [];
  for (const [k, r] of leaves(forkBytes(hfspFork(vh, 272)))) {
    const type = i16be(r, 0), parent = u32be(k, 2), name = hfspName(k, 6);
    if (type === 1) folders.set(u32be(r, 8), { parent, name });
    else if (type === 2) files.push({ parent, name, id: u32be(r, 8), type: decodeMacRoman(r.subarray(48, 52)), creator: decodeMacRoman(r.subarray(52, 56)), data: hfspFork(r, 88), rsrc: hfspFork(r, 168) });
  }
  const pathOf = id => { const p = []; for (let f = folders.get(id), g = 0; f && f.parent !== 1 && g < 64; f = folders.get(f.parent), g++) p.unshift(f.name); return p; };
  return {
    volume: (folders.get(2) || {}).name || '',
    files: files.map(f => ({
      path: pathOf(f.parent).concat(f.name).join('/'), name: f.name, type: f.type, creator: f.creator,
      dataLen: f.data.size, rsrcLen: f.rsrc.size,
      read: which => forkBytes(which === 'rsrc' ? f.rsrc : f.data, more(f.id, which)),
    })),
  };
}

/* Every file on the image's HFS Plus volume, as hfspVolume gives them. */
function udifFiles(bytes) {
  const parts = udifPartitions(bytes);
  const part = parts.find(p => /Apple_HFS/.test(p.name)) || parts.find(p => p.sectors > 4);
  if (!part) throw new Error('the disk image has no volume in it');
  const r = udifReader(bytes, part);
  return hfspVolume((pos, n) => r.read(pos, n)).files;
}

/* ---- an installer package inside an image (.pkg) -------------------------

   EV Nova 1.1 beta 2.10.7 for the Mac ships as an image holding one
   installer package, whose payload holds the game's Windows files beside
   a wrapper that runs them. `pkgFiles(bytes)` lists the files of every
   payload in a package, in the shape `udifFiles` gives.

   A flat package is a xar archive: 'xar!', a header of its own length
   (28), the table of contents' compressed and uncompressed lengths (big
   endian, 8 bytes each), and the table of contents, zlib-compressed XML,
   followed by the heap that its <data> entries' offsets count from. Each
   part's Payload is a gzip stream of a cpio archive in the portable form
   ('070707': fields in octal, a 76-byte header, then the name with its
   NUL, then the file). Read off this package on 10 October 2026 and
   checked against macOS's `xar` and `cpio`; other payload encodings
   (pbzx, bzip2) are refused by name. */
function looksLikeXar(b) { return b && b.length > 28 && b[0] === 0x78 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21; }   // 'xar!'
function pkgFiles(bytes) {
  if (!looksLikeXar(bytes)) throw new Error('not an installer package (xar)');
  const be64 = o => ((bytes[o] << 24 | bytes[o + 1] << 16 | bytes[o + 2] << 8 | bytes[o + 3]) >>> 0) * 0x100000000 + ((bytes[o + 4] << 24 | bytes[o + 5] << 16 | bytes[o + 6] << 8 | bytes[o + 7]) >>> 0);
  const head = bytes[4] << 8 | bytes[5], packed = be64(8), size = be64(16), heap = head + packed;
  const toc = new TextDecoder().decode(inflateRaw(bytes.subarray(head + 2, head + packed), size));
  // the <file> elements, nested as folders hold files: each its name and, for a file, its data's place in the heap
  const files = [];
  const walk = (xml, prefix) => {
    const re = /<file\b[^>]*>/g;
    let m;
    while ((m = re.exec(xml))) {
      let depth = 1, i = re.lastIndex;
      const tag = /<(\/?)file\b[^>]*>/g;
      tag.lastIndex = i;
      let t;
      while (depth && (t = tag.exec(xml))) depth += t[1] ? -1 : 1;
      const body = xml.slice(i, t.index), own = body.replace(/<file\b[\s\S]*<\/file>/, '');
      const name = (/<name>([^<]*)<\/name>/.exec(own) || [])[1] || '';
      const data = /<data>([\s\S]*?)<\/data>/.exec(own);
      const path = prefix ? prefix + '/' + name : name;
      if (data) files.push({ path, offset: +(/<offset>(\d+)<\/offset>/.exec(data[1]) || [])[1], length: +(/<length>(\d+)<\/length>/.exec(data[1]) || [])[1],
                             style: (/<encoding\b[^>]*style="([^"]*)"/.exec(data[1]) || [])[1] || '' });
      walk(body, path);
      re.lastIndex = t.index + t[0].length;
    }
  };
  walk(toc, '');
  const out = [];
  for (const f of files.filter(f => /(^|\/)Payload$/.test(f.path))) {
    if (f.style && f.style !== 'application/octet-stream') throw new Error(`a package payload encoded as ${f.style}`);
    const gz = bytes.subarray(heap + f.offset, heap + f.offset + f.length);
    if (gz[0] !== 0x1f || gz[1] !== 0x8b) throw new Error('a package payload not gzip (pbzx or bzip2), not read here');
    // gzip: the flags' optional fields passed over to the DEFLATE stream; its length is the last four bytes
    const flg = gz[3];
    let p = 10;
    if (flg & 4) p += 2 + (gz[p] | gz[p + 1] << 8);
    if (flg & 8) while (gz[p++]);
    if (flg & 16) while (gz[p++]);
    if (flg & 2) p += 2;
    const n = (gz[gz.length - 4] | gz[gz.length - 3] << 8 | gz[gz.length - 2] << 16 | gz[gz.length - 1] << 24) >>> 0;
    const cpio = inflateRaw(gz.subarray(p, gz.length - 8), n);
    const oct = (o, len) => parseInt(String.fromCharCode(...cpio.subarray(o, o + len)), 8);
    for (let o = 0; o + 76 <= cpio.length;) {
      if (String.fromCharCode(...cpio.subarray(o, o + 6)) !== '070707') throw new Error('a package payload\'s cpio is not in the portable form');
      const mode = oct(o + 18, 6), nameLen = oct(o + 59, 6), fileLen = oct(o + 65, 11);
      const name = new TextDecoder().decode(cpio.subarray(o + 76, o + 76 + nameLen - 1));
      const at = o + 76 + nameLen;
      o = at + fileLen;
      if (name === 'TRAILER!!!') break;
      const path = name.replace(/^\.\//, '');
      if (!path || path === '.') continue;
      const folder = (mode & 0o170000) === 0o040000, data = cpio.subarray(at, at + fileLen);
      out.push({ path, name: path.replace(/^.*\//, ''), isFolder: folder, type: '', creator: '', dataLen: folder ? 0 : fileLen, rsrcLen: 0,
                 read: which => (which === 'data' ? data : new Uint8Array(0)) });
    }
  }
  return out;
}