// js/nova-compare.js: what changed between releases, held to a plain
// comparison of the resources' bytes and to changes read by hand.
//
// For each pair of releases in turn, every record new, gone or with other
// bytes is found here straight from the data files; novaCompare must give
// the same new and gone, and every record it calls changed must be one
// whose bytes differ. Then a few changes read by hand, a game against
// itself, and one changed by a byte here, which must show.
import { site, openRelease, haveRelease } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

const V = ['1.0.2', '1.0.8', '1.0.10', '1.1.1'].filter(v => haveRelease(v) || (console.log(`SKIP ${v}: not in reference/`), false));
const G = Object.fromEntries(V.map(v => [v, openRelease(S, v, new Set(['data']))]));
const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
const C = {};
for (let i = 1; i < V.length; i++) {
  const was = G[V[i - 1]], now = G[V[i]], pair = `${V[i - 1]} -> ${V[i]}`;
  const c = C[pair] = S.novaCompare(was, now);
  const a = S.novaDataGame(was), b = S.novaDataGame(now);
  let differ = 0;
  for (const type of new Set([...a.types(), ...b.types()])) {
    const ia = new Set(a.list(type).map(r => r.id)), ib = new Set(b.list(type).map(r => r.id));
    const t = c.types.find(x => x.type === type) || { added: [], removed: [], changed: [] };
    eq(`${pair} ${type} new`, t.added.map(e => e.id), [...ib].filter(id => !ia.has(id)).sort((x, y) => x - y));
    eq(`${pair} ${type} gone`, t.removed.map(e => e.id).sort((x, y) => x - y), [...ia].filter(id => !ib.has(id)).sort((x, y) => x - y));
    const bytes = new Set([...ib].filter(id => ia.has(id) && !same(a.get(type, id).bytes, b.get(type, id).bytes)));
    differ += bytes.size;
    for (const e of t.changed) if (!bytes.has(e.id) && a.get(type, e.id).name === b.get(type, e.id).name) fail(`${pair} ${type} ${e.id} called changed, but its bytes and name are the same`);
  }
  console.log(`${pair}: ${c.count} records differ (${differ} with other bytes)`);
}

const field = (pair, type, id, name) => {
  const c = C[pair];
  if (!c) return undefined;
  const e = c.change(type, id);
  const f = e && e.fields && e.fields.find(x => x[0] === name);
  return f ? f.slice(1) : null;
};
if (C['1.0.2 -> 1.0.8']) {
  eq('Kipa\'s government, 1.0.2 to 1.0.8', field('1.0.2 -> 1.0.8', 'sÿst', 288, 'Govt'), [137, 170]);
  eq('Procyon\'s visibility, 1.0.2 to 1.0.8', field('1.0.2 -> 1.0.8', 'sÿst', 147, 'Visibility'), ['!b25', '!b36']);
  eq('the Federation\'s crime tolerance, 1.0.2 to 1.0.8', field('1.0.2 -> 1.0.8', 'gövt', 128, 'CrimeTol'), [10, 6]);
}
if (C['1.0.8 -> 1.0.10']) {
  eq('Mjolnir\'s visibility, 1.0.8 to 1.0.10', field('1.0.8 -> 1.0.10', 'sÿst', 206, 'Visibility'), ['!b88', '!(b88 | b3009)']);
  eq('Endurance\'s name, 1.0.8 to 1.0.10', field('1.0.8 -> 1.0.10', 'spöb', 323, 'name'), ['Endurance', 'Dani - Endurance']);
}
if (C['1.0.10 -> 1.1.1']) {
  const c = C['1.0.10 -> 1.1.1'];
  eq('systems changed, 1.0.10 to 1.1.1', S.novaCompareSystems(c, S.novaUniverse(G['1.1.1'])).size, 0);
}
if (V.length) {
  const g = G[V[0]];
  eq(`${V[0]} against itself`, S.novaCompare(g, g).count, 0);
  // the negative control: one byte of one system's government changed, here
  const sys = g.list('sÿst')[0].id, at = S.novaLayout('sÿst').find(f => f.name === 'Govt').offset + 1;
  const key = S.novaTypeKey('sÿst'), h = S.novaGame();
  for (const f of g.files) {
    const e = (f.fork.resourcesByType[key] || []).find(r => r.id === sys);
    if (!e) { h.files.push(f); continue; }
    const fork = Object.create(f.fork);
    fork.dataOf = (k, r) => { const d = f.fork.dataOf(k, r); if (r !== e) return d; const c = d.slice(); c[at] ^= 1; return c; };
    h.files.push({ ...f, fork });
  }
  const c = S.novaCompare(g, h), e = c.change('sÿst', sys);
  eq('one byte of a government changed', e && e.fields.map(x => x[0]), ['Govt']);
}
process.exit(fails ? 1 : 0);
