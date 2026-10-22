/* nova-files.js -- which files make up a game of EV Nova, and one lookup
   across all of them.
   =========================================================================

   The game is a folder of resource files, "Nova Files", read in order, and
   then a folder of plug-ins, "Nova Plug-ins", whose resources replace any of
   the same type and id (the Bible, Part II, third note). So a resource is
   looked up by type and id and comes from whichever file was added last
   that has it.

   WHERE THE FILES COME FROM. The Mac releases have their data in resource
   forks: 1.0.2, 1.0.8 and 1.0.10 as StuffIt archives, whose forks
   mac-stuffit.js extracts; 1.1.1 for Mac OS X as `.ndat` files whose DATA
   fork is a resource fork, so a browser can read them straight from a
   folder. A MacBinary or BinHex copy of one file has its fork too
   (mac-containers.js). A file picked bare from a Mac folder cannot: a
   browser only ever sees the data fork, and a classic `Nova Data 1` has
   none.

   Plug-ins and the community's builds are passed round as `.rez` files, the
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
   mac-stuffit.js, mac-vise.js, mac-zip.js, mac-compactpro.js and mac-rar.js. A classic script: no import, no export, globals. */

function novaTypeKey(name) {
  return String.fromCharCode(...encodeMacRoman(name));
}
function novaTypeName(key) {
  return decodeMacRoman(Uint8Array.from(key, ch => ch.charCodeAt(0)));
}

/* What part of the game a file is, from its name: the files in the program's
   folder are `Nova Data 1` .. `Nova Titles 4`, with `.ndat` added
   in 1.1.1 and `.rez` in the Windows builds; a total conversion's
   files (`EVGE Data.rez`) are named the same way. Null for a name that
   is none of these. */
function novaFileRole(name) {
  const m = /\b(Data|Graphics|Titles|Ships|Sounds)\b/i.exec(name);
  return m ? m[1].toLowerCase() : null;
}
// The part a file is by its Mac file type, as the shipped Nova Files have
// them (non-ASCII letters read as ?), for a file whose name does not show it.
const NOVA_TYPE_ROLE = { 'ND?t': 'data', 'NGr?': 'graphics', 'NT?t': 'titles', 'NSh?': 'ships', 'NS?d': 'sounds' };
const NOVA_BASE_NAME = /^Nova (Data|Graphics|Titles|Ships|Sounds) ?\d*(\.(ndat|rez))?$/i;

/* THE WINDOWS FORMAT, `.rez`, which is also how plug-ins are passed round
   today. Read as EVNEW's CPlugIn::Load reads it, and checked by
   utilities/rez_check.mjs against evnova-workbench's tools/rez.py, a reader written from that
   source separately, resource for resource: `BRGR`; five little-endian
   longs, the fourth the number of the first index entry and the fifth how
   many entries there are; that many entries of (offset, length, 0); the
   last entry is the map, big-endian: a long, the number of types, then per
   type its four bytes, the offset of its list from the map, and its count;
   and per resource the entry number, the type, the id and a 256-byte name.
   The result behaves as a resource fork from mac-resfork.js does, as far as
   novaGame needs.
   Four plug-ins on archive.org (rEV Escort Sell, Get Rich Quick!,
   PaintShop with HGA, Shiva's Bow) give the lists of the types after `DITL`
   (`DLOG`, `vers`, `TMPL`) as at the end of the map or past it, where no
   list can be. The lists lie end to end and each entry has its type, so
   a list past the map's end is read where the one before it ends, when the
   entry there is of that type. */
function looksLikeRez(b) {
  return b && b.length >= 24 && b[0] === 0x42 && b[1] === 0x52 && b[2] === 0x47 && b[3] === 0x52;
}
function novaOpenRez(b) {
  const le = o => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  const first = le(16), n = le(20);
  if (24 + 12 * n > b.length || !n) throw new Error('.rez index runs past the end of the file');
  const entry = i => ({ off: le(24 + 12 * i), len: le(28 + 12 * i) });
  const map = entry(n - 1).off, mapEnd = Math.min(b.length, map + entry(n - 1).len);
  if (map + 8 > b.length) throw new Error('.rez map is past the end of the file');
  const nTypes = u32be(b, map + 4);
  const typeList = [], resourcesByType = {};
  let p = map + 8, after = -1;
  for (let t = 0; t < nTypes; t++) {
    const key = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
    let at = map + u32be(b, p + 4);
    const count = u32be(b, p + 8);
    p += 12;
    if (at + 266 * count > mapEnd && after >= 0 && after + 266 * count <= mapEnd &&
        String.fromCharCode(b[after + 4], b[after + 5], b[after + 6], b[after + 7]) === key) at = after;
    after = at + 266 * count;
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

/* The files of a release or a plug-in archive, StuffIt, StuffIt X, zip, Compact Pro, RAR or disk image, from its
   catalog. What is in a `Nova Files` folder is the game itself; what is in
   a `Nova Plug-ins` folder, or is of Finder type Npïf (which fourcc shows
   as 'Np?f'), or is a `.rez` anywhere else, is a plug-in -- except beside
   the `Nova Files` folder, where the program has its resources (the
   Community Edition's `Nova.rez` is its dialogs and menus). A file counts
   when it has a resource fork, or is a `.rez` or `.ndat`, whose data fork
   is one; an archive in the archive, or a MacBinary or BinHex copy of one
   (a .sit.bin), is opened in its place. Each comes back with `folder`, the
   path it sits in, and
   `read()`, which decompresses it when called, and `unpack`, what a
   background thread needs to do the same (page-open.js; none for StuffIt
   X, read here). */
// An archive's bytes as an archive the page reads: itself, or the one in a MacBinary or BinHex copy's data fork; else null.
function novaArchiveIn(bytes) {
  const is = b => looksLikeStuffIt(b) || looksLikeStuffItX(b) || looksLikeZip(b) || looksLikeCompactPro(b) || looksLikeRar(b);
  if (is(bytes)) return bytes;
  let w = null;
  try { w = sniffMacContainer(bytes); } catch (e) { return null; }
  return w && w.data && w.data.length && is(w.data) ? w.data : null;
}
function novaArchiveFiles(bytes, depth = 0) {
  const zip = looksLikeZip(bytes), dmg = !zip && looksLikeUdif(bytes), sitx = !zip && !dmg && looksLikeStuffItX(bytes);
  // Compact Pro and RAR give entries that read themselves, as a disk image's do
  const cpt = !zip && !dmg && !sitx && looksLikeCompactPro(bytes), rar = !zip && !dmg && !sitx && !cpt && looksLikeRar(bytes);
  const own = dmg || cpt || rar;
  const cat = zip ? parseZipArchive(bytes) : dmg ? udifFiles(bytes) : sitx ? parseStuffItXArchive(bytes) :
    cpt ? parseCompactProArchive(bytes) : rar ? parseRarArchive(bytes) : parseStuffItArchive(bytes);
  const out = [];
  let all = Array.isArray(cat) ? cat : cat.entries;
  // an installer package on an image (1.1 beta 2.10.7's): the files of its payloads in its place
  if (dmg) all = all.flatMap(e => (!e.isFolder && /\.pkg$/i.test(e.name) && e.dataLen > 0 ? pkgFiles(e.read('data')) : [e]));
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
    // an archive in the archive, as EstarGuars' SAE_1of2.sit.bin is a MacBinary StuffIt in a
    // StuffIt: decompressed now, so as to see inside it, and its files in its place, in its folder
    if (depth < 3 && /\.(sit|sitx|zip|cpt|rar|sea)(\.(bin|hqx))?$/i.test(name)) {
      let inner = null;
      try { inner = novaArchiveIn(own ? e.read('data') : zip ? zipFork(bytes, e, 'data') : sitx ? stuffItXFork(bytes, e, 'data') : stuffItFork(bytes, e, 'data')); } catch (err) { inner = null; }
      if (inner) {
        const at = e.path || e.name;
        for (const f of novaArchiveFiles(inner, depth + 1)) out.push(Object.assign(f, { path: at + '/' + f.path, folder: at + (f.folder ? '/' + f.folder : ''), unpack: null }));
        continue;
      }
    }
    const hasRsrc = zip ? e.rsrc.length > 0 : e.rsrcLen > 0;   // (a StuffIt X entry is shaped as a StuffIt one)
    if (/\.app\/Contents\/(MacOS|Frameworks|PlugIns)\//.test(e.path || '')) continue;
    const forkOf = which => (own ? e.read(which) : zip ? zipFork(bytes, e, which) : sitx ? stuffItXFork(bytes, e, which) : stuffItFork(bytes, e, which));
    const parts = (e.path || e.name).split('/');
    const folders = parts.slice(0, -1);
    const inFiles = folders.some(f => /^Nova Files$/i.test(f));
    const inPlugins = folders.some(f => /^Nova Plug-?ins$/i.test(f));
    const besideGame = !inFiles && !inPlugins && gameDirs.has(folders.join('/'));
    // a plug-in by what is in it: a file with any name, of any Finder type, its resource fork
    // (or its data, as a .rez is) holding the game's records, as many of the plug-ins
    // on archive.org are (ResEdit's 'rsrc' files, a type the years garbled, a zip of bare forks)
    const dataLen = zip ? e.len : e.dataLen;
    const bareData = !hasRsrc && dataLen > 0 && !/\.(rez|ndat|bin|hqx)$/i.test(name);
    let byContent = false, bareCopy = false, pilot = false;
    if (!inFiles && !inPlugins && !besideGame && e.type !== 'Np?f' && !NOVA_BASE_NAME.test(name) && (hasRsrc || bareData)) {
      let fork = null;
      try { fork = forkOf(hasRsrc ? 'rsrc' : 'data'); byContent = novaHoldsRecords(fork); } catch (err) { byContent = false; }
      // a save file (nova-pilot.js), Finder type NpïL or not
      if (!byContent && fork && hasRsrc) { try { pilot = novaHoldsPilot(novaOpenFork(fork)); } catch (err) { pilot = false; } }
      if (pilot) {
        out.push({ name, path: e.path || e.name, folder: folders.join('/'), plugin: false, pilot: true, role: null, size: fork.length, read: () => fork, unpack: null });
        continue;
      }
      // a MacBinary or BinHex copy with any name (podpeople.zip's "podpeople")
      if (!byContent && bareData && fork) {
        try { const w = sniffMacContainer(fork); bareCopy = !!(w && w.rsrc && w.rsrc.length && novaHoldsRecords(w.rsrc)); } catch (err) { bareCopy = false; }
        byContent = bareCopy;
      }
    }
    const dataFile = /\.(rez|ndat)$/i.test(name) || (bareData && byContent && !bareCopy);
    // a MacBinary or BinHex copy, its resource fork inside its data
    const wrapped = !hasRsrc && (/\.(bin|hqx)$/i.test(name) || bareCopy);
    if (!hasRsrc && !dataFile && !wrapped) continue;
    const plugin = !inFiles && !besideGame && (inPlugins || e.type === 'Np?f' || byContent || ((dataFile || wrapped) && !NOVA_BASE_NAME.test(name)));
    if (!inFiles && !plugin && !NOVA_BASE_NAME.test(name)) continue;
    // In Nova Files, a file whose name matches no part of the game counts only
    // as a .rez, an .ndat or a MacBinary or BinHex copy: the race movies
    // have resource forks too. A total conversion's files, with
    // any names, are the part their Mac type marks them as, else, as Starfleet
    // Adventures' SFA Galaxy 1.bin, data.
    const role = novaFileRole(name) || NOVA_TYPE_ROLE[e.type];
    if (!plugin && !role && !dataFile && !wrapped) continue;
    const which = hasRsrc ? 'rsrc' : 'data';
    const raw = () => forkOf(which);
    out.push({ name: name.replace(/\.(ndat|rez|bin|hqx)$/i, ''), path: e.path || e.name, folder: folders.join('/'), plugin,
               role: plugin ? null : (role || 'data'), size: hasRsrc ? (zip ? e.rsrc.length : e.rsrcLen) : (zip ? e.len : e.dataLen),
               read: wrapped ? () => novaUnwrapFork(raw()) : raw,
               unpack: own || sitx ? null : { archive: bytes, entry: e, which, zip, wrapped } });
  }
  return out;
}

/* The game's program in a release's archive or disk image: a classic Mac
   application (Finder type APPL, its code a PEF container in the data
   fork) named EV Nova, as 1.0.2 to 1.0.10 ship it, or an EV Nova.app's
   Mach-O program, as 1.1.1 does. { name, path, size, read() } giving the
   data fork, or null. */
function novaArchiveProgram(bytes) {
  const zip = looksLikeZip(bytes), dmg = !zip && looksLikeUdif(bytes);
  if (zip || looksLikeStuffItX(bytes) || looksLikeCompactPro(bytes) || looksLikeRar(bytes)) return null;
  const cat = dmg ? udifFiles(bytes) : parseStuffItArchive(bytes);
  const all = Array.isArray(cat) ? cat : cat.entries;
  const e = all.find(x => !x.isFolder && x.type === 'APPL' && /^EV Nova/.test(x.name) && x.dataLen > 100000) ||
            all.find(x => !x.isFolder && /(^|\/)EV Nova\.app\/Contents\/MacOS\/[^/]+$/.test(x.path || '') && x.dataLen > 100000);
  if (!e) return null;
  const fork = which => (dmg ? e.read(which) : stuffItFork(bytes, e, which));
  return { name: e.name.replace(/\r$/, ''), path: e.path || e.name, size: e.dataLen, read: () => fork('data'), readRsrc: () => ((dmg ? e.rsrcLen : e.rsrcLen) > 0 ? fork('rsrc') : null) };
}

/* Files opened together that are the numbered pieces of one zip split across
   files -- rEV_Windows001.zip, 002.zip and 003.zip in archive.org's EV Nova
   collection -- joined end to end, in order, as one, which mac-zip.js reads
   by its local headers; the rest as they came. [{ name, bytes }] either way.
   Only a run from 001 with none missing is joined. */
function novaJoinParts(picked) {
  const sets = new Map(), rest = [];
  for (const f of picked) {
    const m = /^(.*?)(\d{3})\.zip$/i.exec(f.name);
    if (!m) { rest.push(f); continue; }
    if (!sets.has(m[1].toLowerCase())) sets.set(m[1].toLowerCase(), []);
    sets.get(m[1].toLowerCase()).push({ n: +m[2], base: m[1], f });
  }
  for (const list of sets.values()) {
    list.sort((a, b) => a.n - b.n);
    if (list.length < 2 || list.some((x, i) => x.n !== i + 1)) { rest.push(...list.map(x => x.f)); continue; }
    const bytes = new Uint8Array(list.reduce((t, x) => t + x.f.bytes.length, 0));
    let o = 0;
    for (const x of list) { bytes.set(x.f.bytes, o); o += x.f.bytes.length; }
    rest.push({ name: list[0].base.replace(/[_ -]+$/, '') + '.zip', bytes });
  }
  return rest;
}

// Whether a resource fork contains any of the game's records (a type of NOVA_RECORDS) or sprites.
function novaHoldsRecords(fork) {
  return Object.keys(novaOpenFork(fork).resourcesByType).some(k => { const t = novaTypeName(k); return !!NOVA_RECORDS[t] || t === 'rlëD' || t === 'rlë8'; });
}

// The resource fork inside a MacBinary or BinHex copy.
function novaUnwrapFork(bytes) {
  const w = sniffMacContainer(bytes);
  if (!w || !w.rsrc || !w.rsrc.length) throw new Error('not a MacBinary or BinHex copy with a resource fork');
  return w.rsrc;
}

/* One file handed over alone: a 1.1.1 `.ndat`, a `.rez`, a MacBinary
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
   front of plug-ins whatever order they come in, and each group in name
   order, which is a Mac folder's order. */
const novaFileOrder = (a, b) => (!!a.edits - !!b.edits) || (a.plugin - b.plugin) || a.name.localeCompare(b.name, 'en', { numeric: true });
function novaGame() {
  const files = [];
  const game = {
    files,
    add(file, forkBytes) {
      const fork = novaOpenFork(forkBytes);
      files.push({ name: file.name, plugin: !!file.plugin, role: file.role, fork });
      files.sort(novaFileOrder);
      memo.clear();
      return fork;
    },
    /* The records changed in the page, [{ type, id, name, data }], as a
       plug-in read after every other (nova-plugin.js); none removes it. */
    setEdits(resources) {
      const i = files.findIndex(f => f.edits);
      if (i >= 0) files.splice(i, 1);
      if (resources && resources.length)
        files.push({ name: 'Changed here', plugin: true, edits: true, role: null, fork: novaPluginFork(resources) });
      memo.clear();
    },
    /* The entry for (type, id): { type, id, name, file, bytes } or null.
       `{ under: true }` passes over the records changed in the page. */
    get(type, id, opts) {
      const key = novaTypeKey(type);
      for (let i = files.length - 1; i >= 0; i--) {
        if (files[i].edits && opts && opts.under) continue;
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
       the copy that has precedence. */
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

/* The records that two files or more both have, as plug-ins opened together
   can do: [{ files, records: [{ type, ids }] }], one entry for each set of files
   sharing any, the files in the order novaGame reads them, so that the last
   one's copy is the one read. files: [{ name, plugin, fork }]. */
function novaClashes(files) {
  const by = new Map();
  for (const f of [...files].sort(novaFileOrder)) for (const [key, list] of Object.entries(f.fork.resourcesByType)) {
    if (!by.has(key)) by.set(key, new Map());
    const ids = by.get(key);
    for (const r of list) { if (!ids.has(r.id)) ids.set(r.id, []); const n = ids.get(r.id); if (!n.includes(f.name)) n.push(f.name); }
  }
  const groups = new Map();
  for (const [key, ids] of by) for (const [id, names] of ids) {
    if (names.length < 2) continue;
    const g = names.join('\0');
    if (!groups.has(g)) groups.set(g, { files: names, records: new Map() });
    const recs = groups.get(g).records, t = novaTypeName(key);
    if (!recs.has(t)) recs.set(t, []);
    recs.get(t).push(id);
  }
  return [...groups.values()].map(g => ({ files: g.files,
    records: [...g.records].map(([type, ids]) => ({ type, ids: ids.sort((a, b) => a - b) })).sort((a, b) => a.type.localeCompare(b.type)) }));
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
