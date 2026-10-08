/* nova-plugin.js -- records changed in the browser, written as a plug-in.
   =========================================================================

   A plug-in is a file of resources the game reads after its own, each one
   replacing the game's resource of the same type and id. So the records a
   visitor changes are kept as exactly that, a plug-in in memory, put last
   in the game (novaGame's `setEdits`), and the page reads the game through
   it as it reads any other plug-in. Saving writes the same resources to a
   file, in two forms:

     .rez    the Windows builds' and the Community Edition's plug-ins, in
             the layout EVNEW's CPlugIn::Save writes (`novaWriteRez`).
             utilities/plugin_check.mjs holds it to every `.rez` in
             reference/game, rewritten byte for byte, and to
             evnova-workbench's tools/rez.py.
     .bin    a Mac plug-in, MacBinary II: a resource fork written by
             mac-resfork.js, and the Finder type `Npïf` that the Mac
             program's loader asks for (`../evnova-workbench/doc/findings.md`
             § *Formats and facts*). A browser cannot hand over a file with
             a resource fork; StuffIt Expander or The Unarchiver turns the
             .bin back into one.

   A changed record is written from its type's table in nova-records.js
   over the bytes it had, so a field the table does not name (an Unused
   run, the tail of a record longer than its table) keeps its bytes.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after mac-bytes.js,
   mac-containers.js, mac-resfork.js, nova-files.js and nova-records.js. */

/* A record's bytes from its fields: `rec` as novaRecord gives it, written
   over `base`, the bytes it was read from (a copy is returned; `base` is
   not changed). A field absent from `rec` keeps its bytes. A record
   shorter than its table stays as long as it was; a field past its end is
   not written. */
function novaRecordBytes(type, rec, base) {
  const table = NOVA_RECORDS[type];
  if (!table) throw new Error('no record table for ' + type);
  let b = Uint8Array.from(base);
  let off = 0;
  const put = (kind, v) => {
    if (kind === 'i16' || kind === 'h16') { b[off] = (v >> 8) & 0xFF; b[off + 1] = v & 0xFF; }
    else { b[off] = (v >>> 24) & 0xFF; b[off + 1] = (v >>> 16) & 0xFF; b[off + 2] = (v >>> 8) & 0xFF; b[off + 3] = v & 0xFF; }
  };
  for (const [name, kind, n] of table) {
    if (kind === 'cstr') {
      let end = off;
      while (end < b.length && b[end] !== 0) end++;
      if (name in rec) {
        const s = encodeMacRoman(rec[name]);
        const nb = new Uint8Array(off + s.length + 1 + Math.max(0, b.length - end - 1));
        nb.set(b.subarray(0, off)); nb.set(s, off);
        nb.set(b.subarray(end + 1), off + s.length + 1);
        b = nb; end = off + s.length;
      }
      off = end + 1;
      continue;
    }
    if (kind === 'str' || kind === 'pad') {
      if (off + n > b.length) break;
      if (kind === 'str' && name in rec) {
        const s = encodeMacRoman(rec[name]);
        if (s.length > n - 1) throw new Error(`${name} takes at most ${n - 1} characters`);
        // what was there past the old string's NUL is kept, as the game's
        // editors leave it; only the string and its NUL are written
        const old = novaFixedString(b, off, n);
        if (old !== rec[name]) { b.fill(0, off, off + n); b.set(s, off); }
      }
      off += n;
      continue;
    }
    const size = NOVA_KIND_SIZE[kind];
    const vals = n ? rec[name] : [rec[name]];
    for (let i = 0; i < (n || 1); i++) {
      if (off + size > b.length) return b;
      if (vals !== undefined && vals[i] !== undefined) put(kind, vals[i]);
      off += size;
    }
  }
  return b;
}

/* A field's value from what is typed for it: a number, hex for flags (with
   or without 0x), #RRGGBB for a colour. Throws with what is wrong. */
function novaFieldParse(kind, text) {
  const t = String(text).trim();
  const range = (v, lo, hi) => {
    if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`wants a whole number from ${lo} to ${hi}`);
    return v;
  };
  if (kind === 'str' || kind === 'cstr') return String(text);
  if (kind === 'h16' || kind === 'h32' || kind === 'rgb') {
    const m = /^(?:0x|#)?([0-9a-f]+)$/i.exec(t);
    if (!m) throw new Error(kind === 'rgb' ? 'wants a colour, #RRGGBB' : 'wants a hex number');
    return range(parseInt(m[1], 16), 0, kind === 'h16' ? 0xFFFF : 0xFFFFFFFF);
  }
  if (!/^[-+]?\d+$/.test(t)) throw new Error('wants a whole number');
  const v = Number(t);
  return kind === 'i16' ? range(v, -32768, 32767) : range(v, -2147483648, 2147483647);
}

/* A plug-in held in memory, from [{ type, id, name, data }] (`type` the
   type's name, as 'sÿst'), answering as a fork from mac-resfork.js does as
   far as novaGame asks. */
function novaPluginFork(resources) {
  const resourcesByType = {}, typeList = [];
  for (const r of resources) {
    const key = novaTypeKey(r.type);
    if (!resourcesByType[key]) { resourcesByType[key] = []; typeList.push({ type: key, count: 0 }); }
    resourcesByType[key].push({ id: r.id, name: r.name, data: r.data });
  }
  for (const t of typeList) t.count = resourcesByType[t.type].length;
  return {
    typeList, resourcesByType, format: 'edits',
    sizeOf(type, e) { return e.data.length; },
    dataOf(type, e) { return e.data; },
    total() { return resources.length; },
  };
}

/* The resources in the order a plug-in file holds them: by type, in the
   order of first appearance, and by id within a type. */
function novaPluginOrder(resources) {
  const types = [];
  for (const r of resources) if (!types.includes(r.type)) types.push(r.type);
  return types.flatMap(t => resources.filter(r => r.type === t).sort((a, b) => a.id - b.id));
}

/* A `.rez` file of [{ type, id, name, data }], as EVNEW's CPlugIn::Save
   lays one out: 'BRGR'; little-endian 1, 12R+37, 1, 1 (the first index),
   R+1; an index entry (offset, length, 0) per resource and one for the map,
   whose third field is 12R+24; "resource.map" and its NUL; the resources'
   bytes, in order; then the map, big-endian: 8, the number of types, per
   type its four bytes, the offset of its list from the map and its count,
   and per resource its index, type, id and a 256-byte name.
   The resources go in the order given, a type's kept together. `first`,
   1 unless given, is the first index: Ambrosia's own files number theirs
   on from the file before (Nova Titles 3's from 1,271), which is how the
   check rewrites them byte for byte. */
function novaWriteRez(resources, first = 1) {
  // a type's resources together, in the order given otherwise
  const order = [];
  for (const r of resources) if (!order.includes(r.type)) order.push(r.type);
  const list = order.flatMap(t => resources.filter(r => r.type === t));
  const R = list.length;
  const types = [];
  for (const r of list) {
    if (!types.length || types[types.length - 1].type !== r.type) types.push({ type: r.type, count: 0 });
    types[types.length - 1].count++;
  }
  const dataStart = 24 + 12 * (R + 1) + 13;
  const dataLen = list.reduce((a, r) => a + r.data.length, 0);
  const mapLen = 8 + 12 * types.length + 266 * R;
  const out = new Uint8Array(dataStart + dataLen + mapLen);
  const le = (v, at) => { out[at] = v & 0xFF; out[at + 1] = (v >>> 8) & 0xFF; out[at + 2] = (v >>> 16) & 0xFF; out[at + 3] = (v >>> 24) & 0xFF; };
  const be = (v, at) => { out[at] = (v >>> 24) & 0xFF; out[at + 1] = (v >>> 16) & 0xFF; out[at + 2] = (v >>> 8) & 0xFF; out[at + 3] = v & 0xFF; };
  out.set([0x42, 0x52, 0x47, 0x52]);
  le(1, 4); le(12 * R + 37, 8); le(1, 12); le(first, 16); le(R + 1, 20);
  let p = dataStart;
  list.forEach((r, i) => {
    le(p, 24 + 12 * i); le(r.data.length, 28 + 12 * i);
    out.set(r.data, p);
    p += r.data.length;
  });
  le(p, 24 + 12 * R); le(mapLen, 28 + 12 * R); le(12 * R + 24, 32 + 12 * R);
  out.set(encodeMacRoman('resource.map'), 24 + 12 * (R + 1));
  const map = p;
  be(8, map); be(types.length, map + 4);
  let q = map + 8, at = 8 + 12 * types.length;
  for (const t of types) {
    out.set(encodeMacRoman(t.type), q); be(at, q + 4); be(t.count, q + 8);
    q += 12; at += 266 * t.count;
  }
  list.forEach((r, i) => {
    be(i + first, q); out.set(encodeMacRoman(r.type), q + 4);
    out[q + 8] = (r.id >> 8) & 0xFF; out[q + 9] = r.id & 0xFF;
    out.set(encodeMacRoman(r.name || '').subarray(0, 255), q + 10);
    q += 266;
  });
  return out;
}

/* A Mac plug-in of [{ type, id, name, data }], as MacBinary II: the
   resources in a resource fork, Finder type Npïf. The loader wants any
   creator but zero; this is the game's own, Növä, which its data files
   carry, and the only Mac plug-ins in reference/game that kept their
   Finder type (Polycon's, in PolyconEV1.2Update.sit). */
const NOVA_PLUGIN_CREATOR = 'Növä';
function novaWriteMacPlugin(resources, name) {
  const rsrc = writeResourceFork(novaPluginOrder(resources).map(r => ({ type: r.type, id: r.id, name: r.name || '', data: r.data })));
  return writeMacBinary({ name, type: 'Npïf', creator: NOVA_PLUGIN_CREATOR, rsrc });
}

/* The records of `now` that are not as they are in `was` -- new, or with
   other bytes or another name -- as resources for a plug-in that turns
   `was` into `now`. Only the types with a table in nova-records.js, which
   are the ones the site reads; a record taken away cannot be said by a
   plug-in and is left out. */
function novaPluginFromGames(was, now) {
  const out = [];
  for (const type of Object.keys(NOVA_RECORDS)) {
    for (const e of now.list(type)) {
      const a = was.get(type, e.id), b = now.get(type, e.id);
      if (a && a.name === b.name && a.bytes.length === b.bytes.length && a.bytes.every((x, i) => x === b.bytes[i])) continue;
      out.push({ type, id: e.id, name: b.name || '', data: Uint8Array.from(b.bytes) });
    }
  }
  return out;
}
