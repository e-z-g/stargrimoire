/* nova-files.js -- which files make up a game of EV Nova, and one lookup
   across all of them.
   =========================================================================

   The game is a folder of resource files, "Nova Files", read in order, and
   then a folder of plug-ins, "Nova Plug-ins", whose resources replace any of
   the same type and id (the Bible, Part II, third note). So a resource is
   asked for by type and id and comes from whichever file was added last
   that holds it.

   WHERE THE FILES COME FROM. The Mac releases carry their data in resource
   forks: 1.0.2, 1.0.8 and 1.0.10 as StuffIt archives, whose forks
   mac-stuffit.js takes out; 1.1.1 for Mac OS X as `.ndat` files whose DATA
   fork is a resource fork, so a browser can read them straight from a
   folder. A MacBinary or BinHex copy of one file carries its fork too
   (mac-containers.js). A file picked bare from a Mac folder cannot: a
   browser only ever sees the data fork, and a classic `Nova Data 1` has
   none.

   Plug-ins and the community's builds pass round as `.rez` files, the
   Windows format, whose layout is below; a zip of them is read with
   mac-zip.js.

   Resource type names are Mac Roman. mac-resfork.js keys a fork's types by
   their four raw bytes, one character each, so 'sÿst' is found under
   '\x73\xD8\x73\x74'. novaTypeKey and novaTypeName convert.

   GENERIC TO EV NOVA, NOT TO THE PAGE: no DOM here. Opening a StuffIt fork
   is synchronous and can take a second for a 14 MB file, so this file hands
   back each fork as a function to call and leaves when to call it to the
   page.

   LOAD ORDER: after mac-bytes.js, mac-containers.js, mac-resfork.js,
   mac-stuffit.js, mac-vise.js and mac-zip.js. A classic script: no import, no export, globals. */

function novaTypeKey(name) {
  return String.fromCharCode(...encodeMacRoman(name));
}
function novaTypeName(key) {
  return decodeMacRoman(Uint8Array.from(key, ch => ch.charCodeAt(0)));
}

/* What part of the game a file is, from its name: the program's own
   folder names them `Nova Data 1` .. `Nova Titles 4`, with `.ndat` added
   in 1.1.1 and `.rez` in the Windows builds; a total conversion's own
   files (`EVGE Data.rez`) are named the same way. Null for a name that
   says none of these. */
function novaFileRole(name) {
  const m = /\b(Data|Graphics|Titles|Ships|Sounds)\b/i.exec(name);
  return m ? m[1].toLowerCase() : null;
}
const NOVA_BASE_NAME = /^Nova (Data|Graphics|Titles|Ships|Sounds) ?\d*(\.(ndat|rez))?$/i;

/* THE WINDOWS FORMAT, `.rez`, which is also how plug-ins are passed round
   today. Read as EVNEW's CPlugIn::Load reads it, and held by
   utilities/rez_check.mjs to evnova-workbench's tools/rez.py, a reader written from that
   source separately, resource for resource: `BRGR`; five little-endian
   longs, the fourth the number of the first index entry and the fifth how
   many entries there are; that many entries of (offset, length, 0); the
   last entry is the map, big-endian: a long, the number of types, then per
   type its four bytes, the offset of its list from the map, and its count;
   and per resource the entry number, the type, the id and a 256-byte name.
   The result answers as a resource fork from mac-resfork.js does, as far as
   novaGame asks. */
function looksLikeRez(b) {
  return b && b.length >= 24 && b[0] === 0x42 && b[1] === 0x52 && b[2] === 0x47 && b[3] === 0x52;
}
function novaOpenRez(b) {
  const le = o => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const first = le(16), n = le(20);
  if (24 + 12 * n > b.length || !n) throw new Error('.rez index runs past the end of the file');
  const entry = i => ({ off: le(24 + 12 * i), len: le(28 + 12 * i) });
  const map = entry(n - 1).off;
  if (map + 8 > b.length) throw new Error('.rez map is past the end of the file');
  const nTypes = u32be(b, map + 4);
  const typeList = [], resourcesByType = {};
  let p = map + 8;
  for (let t = 0; t < nTypes; t++) {
    const key = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    const at = map + u32be(b, p + 4), count = u32be(b, p + 8);
    p += 12;
    const list = [];
    for (let k = 0, q = at; k < count; k++, q += 266) {
      if (q + 266 > b.length) throw new Error('.rez resource list runs past the end of the file');
      const idx = u32be(b, q) - first;
      if (idx < 0 || idx >= n) throw new Error('.rez resource names index entry ' + (idx + first) + ', which is not there');
      let e = q + 10;
      while (e < q + 266 && b[e]) e++;
      const name = decodeMacRoman(b.subarray(q + 10, e));
      const { off, len } = entry(idx);
      if (off + len > b.length) throw new Error('.rez resource data runs past the end of the file');
      list.push({ id: i16be(b, q + 8), name: name || null, off, len });
    }
    typeList.push({ type: key, count });
    resourcesByType[key] = list;
  }
  return {
    bytes: b, typeList, resourcesByType, format: 'rez',
    sizeOf(type, e) { return e.len; },
    dataOf(type, e) { return b.subarray(e.off, e.off + e.len); },
    total() { return typeList.reduce((a, t) => a + resourcesByType[t.type].length, 0); },
  };
}

/* A game file's bytes, opened: a `.rez`, or a resource fork. */
function novaOpenFork(bytes) {
  return looksLikeRez(bytes) ? novaOpenRez(bytes) : openResourceFork(bytes);
}

/* The files of a release or a plug-in archive, StuffIt, zip or disk image, from its
   catalog. What is in a `Nova Files` folder is the game itself; what is in
   a `Nova Plug-ins` folder, or is of Finder type Npïf (which fourcc shows
   as 'Np?f'), or is a `.rez` anywhere else, is a plug-in -- except beside
   the `Nova Files` folder, where the program keeps its own resources (the
   Community Edition's `Nova.rez` is its dialogs and menus). A file counts
   when it has a resource fork, or is a `.rez` or `.ndat`, whose data fork
   is one. Each comes back with `folder`, the path it sits in, and
   `read()`, which decompresses it when called, and `unpack`, what a
   background thread needs to do the same (page-open.js). */
function novaArchiveFiles(bytes) {
  const zip = looksLikeZip(bytes), dmg = !zip && looksLikeUdif(bytes);
  const cat = zip ? parseZipArchive(bytes) : dmg ? udifFiles(bytes) : parseStuffItArchive(bytes);
  const out = [];
  const all = Array.isArray(cat) ? cat : cat.entries;
  const gameDirs = new Set();
  for (const e of all) {
    const parts = (e.path || e.name).replace(/\/$/, '').split('/');
    const i = parts.findIndex(f => /^Nova Files$/i.test(f));
    if (i >= 0) gameDirs.add(parts.slice(0, i).join('/'));
  }
  for (const e of all) {
    if (e.isFolder) continue;
    const name = e.name.replace(/\r$/, '');
    if (name === 'Icon' || name.startsWith('._') || name === '.DS_Store') continue;
    const hasRsrc = zip ? e.rsrc.length > 0 : e.rsrcLen > 0;
    if (/\.app\/Contents\/(MacOS|Frameworks|PlugIns)\//.test(e.path || '')) continue;
    const dataFile = /\.(rez|ndat)$/i.test(name);
    if (!hasRsrc && !dataFile) continue;
    const parts = (e.path || e.name).split('/');
    const folders = parts.slice(0, -1);
    const inFiles = folders.some(f => /^Nova Files$/i.test(f));
    const inPlugins = folders.some(f => /^Nova Plug-?ins$/i.test(f));
    const besideGame = !inFiles && !inPlugins && gameDirs.has(folders.join('/'));
    const plugin = !inFiles && !besideGame && (inPlugins || e.type === 'Np?f' || (dataFile && !NOVA_BASE_NAME.test(name)));
    if (!inFiles && !plugin && !NOVA_BASE_NAME.test(name)) continue;
    // In Nova Files, a file whose name says no part of the game counts only
    // as a .rez or .ndat: the race movies carry resource forks of their own.
    if (!plugin && !novaFileRole(name) && !dataFile) continue;
    const which = hasRsrc ? 'rsrc' : 'data';
    out.push({ name: name.replace(/\.(ndat|rez)$/i, ''), path: e.path || e.name, folder: folders.join('/'), plugin,
               role: plugin ? null : (novaFileRole(name) || 'data'), size: hasRsrc ? (zip ? e.rsrc.length : e.rsrcLen) : (zip ? e.len : e.dataLen),
               read: () => dmg ? e.read(which) : zip ? zipFork(bytes, e, which) : stuffItFork(bytes, e, which),
               unpack: dmg ? null : { archive: bytes, entry: e, which, zip } });
  }
  return out;
}

/* One file handed over on its own: a 1.1.1 `.ndat`, a `.rez`, a MacBinary
   or BinHex copy, or a bare resource fork. Returns the same shape as an
   archive entry, or null when the bytes hold no resource fork. */
function novaLooseFile(name, bytes) {
  const wrapped = looksLikeRez(bytes) ? null : sniffMacContainer(bytes);
  const fork = wrapped ? wrapped.rsrc : bytes;
  if (!fork || !fork.length) return null;
  try { novaOpenFork(fork); } catch (e) { return null; }
  const base = ((wrapped && wrapped.name) || name).replace(/\.(ndat|bin|hqx|rsrc|rez)$/i, '');
  const plugin = !NOVA_BASE_NAME.test(base);
  return { name: base, path: name, folder: '', plugin, role: plugin ? null : novaFileRole(base), size: fork.length, read: () => fork };
}

/* The game as it is read: forks added in order, looked up last first.

   `add(file, forkBytes)` opens a fork and appends it. Base files are kept in
   front of plug-ins whatever order they arrive in, and each group in name
   order, which is the order a Mac folder lists them in. */
function novaGame() {
  const files = [];
  const game = {
    files,
    add(file, forkBytes) {
      const fork = novaOpenFork(forkBytes);
      files.push({ name: file.name, plugin: !!file.plugin, role: file.role, fork });
      files.sort((a, b) => (a.plugin - b.plugin) || a.name.localeCompare(b.name, 'en', { numeric: true }));
      memo.clear();
      return fork;
    },
    /* The entry for (type, id): { type, id, name, file, bytes } or null. */
    get(type, id) {
      const key = novaTypeKey(type);
      for (let i = files.length - 1; i >= 0; i--) {
        const list = files[i].fork.resourcesByType[key];
        if (!list) continue;
        const e = list.find(r => r.id === id);
        if (e) return { type, id, name: e.name, file: files[i].name, bytes: files[i].fork.dataOf(key, e) };
      }
      return null;
    },
    has(type, id) {
      const key = novaTypeKey(type);
      return files.some(f => (f.fork.resourcesByType[key] || []).some(r => r.id === id));
    },
    /* Every id of a type, merged, ascending, each with the name and file of
       the copy that wins. */
    list(type) {
      const k = 'list\0' + type;
      if (memo.has(k)) return memo.get(k);
      const key = novaTypeKey(type), by = new Map();
      for (const f of files) for (const r of f.fork.resourcesByType[key] || []) by.set(r.id, { id: r.id, name: r.name, file: f.name });
      const out = [...by.values()].sort((a, b) => a.id - b.id);
      memo.set(k, out);
      return out;
    },
    name(type, id) {
      const e = game.list(type).find(r => r.id === id);
      return e ? e.name : null;
    },
    /* Every type present, as names. */
    types() {
      const s = new Set();
      for (const f of files) for (const k of Object.keys(f.fork.resourcesByType)) s.add(novaTypeName(k));
      return [...s].sort();
    },
  };
  const memo = new Map();
  return game;
}

/* A STR# resource as an array of strings, or [] when the game has none. */
function novaStrings(game, id) {
  const r = game.get('STR#', id);
  if (!r) return [];
  const d = r.bytes, n = u16be(d, 0), out = [];
  let p = 2;
  for (let i = 0; i < n && p < d.length; i++) { const l = d[p]; out.push(decodeMacRoman(d.subarray(p + 1, p + 1 + l))); p += 1 + l; }
  return out;
}

/* One string of a list, with the Bible's 'STR ' patching: an 'STR '
   resource numbered `patchBase + index` replaces entry `index` (Appendix
   III). Index is zero-based. */
function novaString(game, listId, index, patchBase) {
  if (patchBase !== undefined) {
    const p = game.get('STR ', patchBase + index);
    if (p) return decodeMacRoman(p.bytes.subarray(1, 1 + p.bytes[0]));
  }
  const list = novaStrings(game, listId);
  return index >= 0 && index < list.length ? list[index] : null;
}
