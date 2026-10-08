/* nova-compare.js -- what changed between two sets of game files.
   =========================================================================

   Two games compared record by record: their data files and plug-ins only,
   since the graphics, titles, ships and sounds files hold pictures and
   sounds, not records. A record of a type nova-records.js has a table for
   is compared field by field, its name with them; any other by its bytes.
   Fields only padding covers are not compared.

   No DOM. LOAD ORDER: after js/nova-files.js and js/nova-records.js. */

/* The game's data files and plug-ins, as a game of their own. */
function novaDataGame(game) {
  const g = novaGame();
  g.files.push(...game.files.filter(f => f.plugin || f.role === 'data'));
  return g;
}

/* What changed from `was` to `now`:
     { types: [{ type, added: [{ id, name }], removed: [{ id, name }],
                 changed: [{ id, name, fields: [[field, was, now]] | null }] }],
       get(type, id) -> 'added' | 'changed' | null, change(type, id) -> the entry or null,
       count }
   `fields` is null for a type with no table, whose bytes differ. Types in
   neither game's data files are left out; a type with no change is left out. */
function novaCompare(was, now) {
  const a = novaDataGame(was), b = novaDataGame(now);
  const types = [...new Set([...a.types(), ...b.types()])].sort();
  const out = [], index = new Map();
  let count = 0;
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  for (const type of types) {
    const la = new Map(a.list(type).map(r => [r.id, r])), lb = new Map(b.list(type).map(r => [r.id, r]));
    const t = { type, added: [], removed: [], changed: [] };
    for (const [id, r] of lb) if (!la.has(id)) t.added.push({ id, name: r.name });
    for (const [id, r] of la) if (!lb.has(id)) t.removed.push({ id, name: r.name });
    for (const [id, r] of lb) {
      if (!la.has(id)) continue;
      const ra = a.get(type, id), rb = b.get(type, id);
      let fields = null;
      if (NOVA_RECORDS[type]) {
        const fa = novaRecord(type, ra.bytes), fb = novaRecord(type, rb.bytes);
        fields = [];
        if (ra.name !== rb.name) fields.push(['name', ra.name, rb.name]);
        for (const [name] of NOVA_RECORDS[type]) {
          if (!(name in fa) && !(name in fb)) continue;
          if (JSON.stringify(fa[name]) !== JSON.stringify(fb[name])) fields.push([name, fa[name], fb[name]]);
        }
        if (!fields.length) continue;
      } else if (same(ra.bytes, rb.bytes) && ra.name === rb.name) continue;
      t.changed.push({ id, name: r.name, fields });
    }
    const n = t.added.length + t.removed.length + t.changed.length;
    if (!n) continue;
    count += n;
    out.push(t);
    for (const e of t.added) index.set(type + '\0' + e.id, { kind: 'added', ...e });
    for (const e of t.changed) index.set(type + '\0' + e.id, { kind: 'changed', ...e });
  }
  return {
    types: out, count,
    get(type, id) { const e = index.get(type + '\0' + id); return e ? e.kind : null; },
    change(type, id) { return index.get(type + '\0' + id) || null; },
  };
}

/* How each system of the universe `u` (novaUniverse of the newer game)
   changed: a Map of system id -> 'added' (its sÿst is new), or 'changed'
   (its sÿst, or a stellar in it, changed or is new). */
function novaCompareSystems(cmp, u) {
  const out = new Map();
  for (const s of u.systems) {
    const k = cmp.get('sÿst', s.id);
    if (k) { out.set(s.id, k); continue; }
    if (s.stellars.some(id => cmp.get('spöb', id))) out.set(s.id, 'changed');
  }
  return out;
}
