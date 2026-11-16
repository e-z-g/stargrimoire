/* nova-ports.js -- Escape Velocity or EV Override against its Nova port.
   =========================================================================

   The community ported EV and EV Override, and their plug-ins, to Nova's
   formats (EV Classic for Nova, EV Override for Nova, and archive.org's
   ev_20250301 and EVO_Ported). Their records keep the elder games' type
   codes and ids, so a record is compared with the port's record of the same
   type and id. The two are read through different tables: the elder's
   through the templates in its files (novaTmplTable), the port's through
   nova-records.js's. A template field is paired with a Nova field

     - of the same name, or the same name numbered (Con3 is Con's third),
     - of a name in NOVA_PORT_RENAMED, the pairs whose names differ,
     - or, where its label has "Bit" and its value is a bit's number, with
       the port's text field that has that bit (b12) in most of the
       records, found from the two games' records and not typed in.

   Every resource of every file is compared, pictures and sounds with the
   records: a type with a table field by field, STR# and STR string by
   string, and any other by its bytes. A picture whose bytes differ is
   compared by its pixels where the caller gives a way to read them, since
   the ports wrote many pictures again: some with the same pixels, more in
   16-bit color, whose five bits a channel put every pixel within 8 of the
   elder's. Pictures and
   sounds that still differ are listed to be looked at and heard side by side.

   PURE: no DOM. LOAD ORDER: after js/nova-files.js and js/nova-records.js. */

// Template labels whose Nova field has another name.
const NOVA_PORT_RENAMED = { '% Prob': 'Probs', ShieldRe: 'ShieldRech', MiscFlags: 'Flags', MinCoolness: 'MinStatus', DefDude: 'DefenseDude', Ally: 'Allies', Enemy: 'Enemies', InherentJam: 'InhJam', AlwaysPers: 'Person' };

/* The Nova field a template field is read beside: { nova, index, how } or
   null. `index` is the place in Nova's list when the elder's field is one
   item of it, `how` 'name', 'numbered' or 'renamed'. `count` is the
   template field's, when it is a list. */
function novaPortField(type, label, count) {
  const table = NOVA_RECORDS[type] || [];
  const has = n => table.find(f => f[0] === n && f[1] !== 'pad');
  const one = (f, how) => ({ nova: f[0], index: f[2] && !count && f[1] !== 'str' && f[1] !== 'cstr' ? 0 : null, how });
  if (has(label)) return one(has(label), 'name');
  const m = /^(.*?) ?(\d+)$/.exec(label), f = m && has(m[1]);
  if (f && f[2]) return { nova: m[1], index: +m[2] - 1, how: 'numbered' };
  const r = NOVA_PORT_RENAMED[label] && has(NOVA_PORT_RENAMED[label]);
  if (r) return one(r, 'renamed');
  return null;
}

// Whether bit `v` is in a Nova expression.
const novaPortHasBit = (s, v) => typeof s === 'string' && new RegExp('(^|[^0-9a-z])b0*' + v + '(?![0-9])', 'i').test(s);

/* Each bit field of a type's template paired with the port's text field
   where the same bit is in most of the records with one set: a Map of
   label -> { nova, hits, of }. Pairs from fewer than half are left out. */
function novaPortBitFields(type, elderTable, pairs) {
  const out = new Map();
  const text = (NOVA_RECORDS[type] || []).filter(f => f[1] === 'cstr' || f[1] === 'str').map(f => f[0]);
  for (const [label, kind] of elderTable) {
    if (!/Bit/.test(label) || kind === 'pad' || kind === 'str' || kind === 'cstr') continue;
    const hits = new Map(text.map(t => [t, 0]));
    let of = 0;
    for (const [a, b] of pairs) {
      const vs = [].concat(a[label]).filter(v => typeof v === 'number' && v >= 0);
      if (!vs.length) continue;
      of++;
      for (const t of text) if (vs.every(v => novaPortHasBit(b[t], v))) hits.set(t, hits.get(t) + 1);
    }
    let best = null;
    for (const [t, h] of hits) if (h && (!best || h > best.hits)) best = { nova: t, hits: h, of };
    if (best && best.hits * 2 >= of) out.set(label, best);
  }
  return out;
}

const novaPortSame = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const novaPortBytesSame = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
// A Nova field's value with nothing set, left out of a record's comparison.
const novaPortEmpty = v => v === undefined || v === '' || v === 0 || v === -1 || (Array.isArray(v) && v.every(novaPortEmpty));

/* The two games compared:
     { types: [{ type, how: 'fields' | 'strings' | 'bytes', elder, port,
                 onlyElder: [{ id, name }], onlyPort: [{ id, name }], same,
                 differ: [{ id, name, portName, rows: [{ label, nova, a, b, same, how }], extra: [[field, value]] }],
                 fields: [{ label, nova, how, differ, of, ratio }],   (for 'fields')
                 unpaired: [labels], portOnly: [fields] }],
       counts: { same, differ, onlyElder, onlyPort } }
   `elder` and `port` are novaGame()s, every file in each. A row's `b` is
   the port's value; a bits row is the same when the port's expression has
   the elder's bit. A field's `ratio` is { r, n }: the port's value is r
   times the elder's in n of the records where it differs, given when that
   is most of them. `opts.pixels(bytes)` gives a PICT's { width, height,
   data } or null; a picture with the same pixels counts as the same, and
   `t.pixels` counts those. */
function novaPortCompare(elder, port, opts = {}) {
  const types = [...new Set([...elder.types(), ...port.types()])].filter(t => t !== 'TMPL').sort();
  const out = [], counts = { same: 0, differ: 0, onlyElder: 0, onlyPort: 0 };
  for (const type of types) {
    const la = new Map(elder.list(type).map(r => [r.id, r])), lb = new Map(port.list(type).map(r => [r.id, r]));
    const et = elder.table(type), pt = NOVA_RECORDS[type];
    const how = et && pt ? 'fields' : type === 'STR#' || type === 'STR ' ? 'strings' : 'bytes';
    const t = { type, how, elder: la.size, port: lb.size, onlyElder: [], onlyPort: [], same: 0, differ: [], fields: [], unpaired: [], portOnly: [], pixels: [], rounded: [] };
    for (const [id, r] of la) if (!lb.has(id)) t.onlyElder.push({ id, name: r.name });
    for (const [id, r] of lb) if (!la.has(id)) t.onlyPort.push({ id, name: r.name });
    const both = [...la.keys()].filter(id => lb.has(id));
    if (how === 'fields') novaPortFields(t, elder, port, both, et);
    else for (const id of both) {
      const ra = elder.get(type, id), rb = port.get(type, id);
      let same = how === 'strings' ? novaPortSame(novaPortStrings(elder, type, id), novaPortStrings(port, type, id)) : novaPortBytesSame(ra.bytes, rb.bytes);
      const px = !same && type === 'PICT' && opts.pixels ? novaPortPixels(opts.pixels, ra.bytes, rb.bytes) : null;
      if (px) { same = true; t[px].push(id); }
      if (same && ra.name === rb.name) t.same++;
      else t.differ.push({ id, name: ra.name, portName: rb.name, rows: null, extra: [] });
    }
    counts.same += t.same; counts.differ += t.differ.length; counts.onlyElder += t.onlyElder.length; counts.onlyPort += t.onlyPort.length;
    out.push(t);
  }
  return { types: out, counts };
}

// 'pixels' when two PICTs' pixels are the same, 'rounded' when one is in 16-bit color and within its steps, else null.
function novaPortPixels(read, a, b) {
  let x, y;
  try { x = read(a); y = read(b); } catch (e) { return null; }
  if (!x || !y || x.width !== y.width || x.height !== y.height) return null;
  if (novaPortBytesSame(x.data, y.data)) return 'pixels';
  if (x.bits !== 16 && y.bits !== 16) return null;
  for (let i = 0; i < x.data.length; i++) if (Math.abs(x.data[i] - y.data[i]) > 8) return null;
  return 'rounded';
}

// STR# as its list, STR as one string.
function novaPortStrings(game, type, id) {
  if (type === 'STR#') return novaStrings(game, id);
  const b = game.get(type, id).bytes;
  return [decodeMacRoman(b.subarray(1, 1 + b[0]))];
}

function novaPortFields(t, elder, port, both, et) {
  const type = t.type;
  const recs = both.map(id => [id, novaRecord(type, elder.get(type, id).bytes, et), novaRecord(type, port.get(type, id).bytes)]);
  const bits = novaPortBitFields(type, et, recs.map(([, a, b]) => [a, b]));
  const pairs = [];
  for (const [label, kind, n] of et) {
    if (kind === 'pad') continue;
    const p = novaPortField(type, label, kind === 'str' || kind === 'cstr' ? 0 : n);
    if (p) pairs.push({ label, ...p });
    else if (bits.has(label)) pairs.push({ label, nova: bits.get(label).nova, index: null, how: 'bits' });
    else t.unpaired.push(label);
  }
  const used = new Set(pairs.map(p => p.nova));
  t.portOnly = NOVA_RECORDS[type].filter(f => f[1] !== 'pad' && !used.has(f[0])).map(f => f[0]);
  const stats = pairs.map(p => ({ label: p.label, nova: p.nova, how: p.how, differ: 0, of: 0, ratios: new Map() }));
  for (const [id, a, b] of recs) {
    const rows = [];
    pairs.forEach((p, i) => {
      if (!(p.label in a)) return;
      const av = a[p.label];
      let bv = b[p.nova], same;
      if (p.how === 'bits') same = [].concat(av).filter(v => typeof v === 'number' && v >= 0).every(v => novaPortHasBit(bv, v));
      else {
        if (p.index !== null && Array.isArray(bv)) bv = bv[p.index];
        else if (Array.isArray(av) && Array.isArray(bv)) bv = bv.slice(0, av.length);
        same = novaPortSame(av, bv);
      }
      const s = stats[i];
      s.of++;
      if (!same) {
        s.differ++;
        if (typeof av === 'number' && typeof bv === 'number' && av) { const r = +(bv / av).toPrecision(3); s.ratios.set(r, (s.ratios.get(r) || 0) + 1); }
      }
      rows.push({ label: p.label, nova: p.nova, a: av, b: bv, same, how: p.how });
    });
    const ra = elder.get(type, id), rb = port.get(type, id);
    if (rows.every(r => r.same) && ra.name === rb.name) { t.same++; continue; }
    t.differ.push({ id, name: ra.name, portName: rb.name, rows, extra: t.portOnly.filter(f => !novaPortEmpty(b[f])).map(f => [f, b[f]]) });
  }
  t.fields = stats.map(s => {
    let ratio = null;
    for (const [r, n] of s.ratios) if (r !== 1 && n * 2 > s.differ && (!ratio || n > ratio.n)) ratio = { r, n };
    return { label: s.label, nova: s.nova, how: s.how, differ: s.differ, of: s.of, ratio };
  });
}

/* The plug-ins of two lists paired by name: the elder plug-in's and a
   port's names alike once versions, "folder", "plug-in", "for Nova",
   archive extensions and everything but letters and digits are left out.
   [{ elder, port }] for each elder name with a match; names are strings. */
const novaPortKey = s => s.replace(/\.(sit|bin|hqx|zip|sea|cpt|rez|txt)\b/gi, '').toLowerCase()
  .replace(/folder|ƒ|plug-?ins?|for nova|nova|v?\d+(\.\d+)*[a-z]?|[^a-z0-9]/g, '');
function novaPortPairs(elders, ports) {
  const by = new Map();
  for (const p of ports) { const k = novaPortKey(p); if (k && !by.has(k)) by.set(k, p); }
  return elders.map(e => ({ elder: e, port: by.get(novaPortKey(e)) || null })).filter(x => x.port);
}
