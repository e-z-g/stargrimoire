// js/nova-ncb.js's readings of control-bit expressions and js/nova-bits.js's
// catalog, over every release.
//
// The set-expression reader (ncbReadSet) on worked cases, each worked by hand
// from Mac 1.1.1's EvalSetExp (0x150fc): its two jump tables (0xdd204 by
// character, 0xdd2fc by operation), the choice R(...) makes, the token a
// following B replaces, a ! with no B. The test needs (ncbTestNeeds) on cases
// the game reads otherwise than written. Then every test and set expression
// in every release is read; the set expressions the game reads otherwise than
// a reading of them as written would are printed, as universe_check prints the
// tests. Then the catalog: every bit named in the files is in it, and b147,
// which Sol's visibility rests on, is named after the mission that sets it.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

// ---- the set reader, worked by hand from EvalSetExp -------------------------
const ops = (text, draw) => S.ncbReadSet(text, () => draw).map(o => (o.letter === 'B' ? { set: '', clear: '!', toggle: '^' }[o.op] + 'b' : o.letter) + o.n).join(' ');
const CASES = [
  // [text, draw 0, draw 1]
  ['b5 !b6 ^b7', 'b5 !b6 ^b7', 'b5 !b6 ^b7'],
  ['B5 !B6', 'b5 !b6', 'b5 !b6'],                         // either case
  ['b10000 b9999', 'b9999', 'b9999'],                      // above 9999 passed over
  ['b1b2', 'b2', 'b2'],                                    // B replaces the unended token
  ['!123', '!b123', '!b123'],                              // ! alone clears
  ['123', '', ''],                                         // a bare number does nothing
  ['S801 b204 G147 K151', 'S801 b204 G147 K151', 'S801 b204 G147 K151'],
  ['R(b1 b2)', 'b2', 'b1'],                                // the draw's count is passed over
  ['R(!b1 b2)', 'b1 b2', '!b1'],                           // the skip passes one character, the !
  ['R(b1 b2 b3)', 'b2 b3', 'b1 b3'],                       // a third choice always happens
  ['b9 R(b1 b2) b4', 'b9 b2 b4', 'b9 b1 b4'],
];
for (const [t, d0, d1] of CASES) { eq(`${JSON.stringify(t)} drawing 0`, ops(t, 0), d0); eq(`${JSON.stringify(t)} drawing 1`, ops(t, 1), d1); }
eq('R(b1 b2) b4 as ops', S.ncbSetOps('R(b1 b2) b4').map(o => [o.n, o.random]).sort((a, b) => a[0] - b[0]), [[1, true], [2, true], [4, false]]);
// the test needs, as the game reads: mïsn 428's bare 467 passed over; a test starting with a digit needs nothing (never)
eq('mïsn 428 needs', S.ncbTestNeeds('!(b511 | b515) & !((b50 | 467) | b6666)'), [511, 515, 50, 6666].map(n => ({ n, on: false })));
eq('a test the game reads as never', S.ncbTestNeeds('612'), []);
eq('nested negation', S.ncbTestNeeds('!(b1 & !b2)'), [{ n: 1, on: false }, { n: 2, on: true }]);

// A set expression as written: R( ... ) a choice among its tokens, the rest each a token, !b and ^b as their signs.
function written(text) {
  const out = [], s = String(text || '');
  const tok = (t, random) => { const m = /^([!^]?)[Bb](\d+)$/.exec(t); if (m && +m[2] <= 9999) out.push({ op: m[1] === '!' ? 'clear' : m[1] === '^' ? 'toggle' : 'set', n: +m[2], random }); };
  const rest = s.replace(/[Rr]\(([^)]*)\)/g, (_, inner) => { for (const t of inner.split(/\s+/).filter(Boolean)) tok(t, true); return ' '; });
  for (const t of rest.split(/[\s()]+/).filter(Boolean)) tok(t, false);
  return out;
}
const key = list => list.map(o => `${o.op} ${o.n}${o.random ? ' r' : ''}`).sort().join(',');

for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v);
  const exprs = [];
  for (const [type, , fields] of S.NOVA_BIT_SOURCES) for (const rec of S.novaAll(game, type)) for (const [field, how] of fields) {
    if (how === 'desc' || !rec[field]) continue;
    exprs.push({ where: `${type} ${rec.id} ${field}`, kind: how, text: rec[field] });
  }
  const otherwise = [];
  let choices = 0;
  for (const e of exprs) {
    try {
      if (e.kind === 'test') S.ncbTestNeeds(e.text);
      else {
        const got = S.ncbSetOps(e.text).filter(o => o.letter === 'B');
        if (/[Rr]\(/.test(e.text)) choices++;
        if (key(got) !== key(written(e.text))) otherwise.push(`${e.where} ${JSON.stringify(e.text)}`);
      }
    } catch (err) { fail(`${v} ${e.where}: ${err.message}`); }
  }
  const sets = exprs.filter(e => e.kind === 'set').length;
  console.log(`${v}: ${exprs.length - sets} tests and ${sets} set expressions read, ${choices} with a choice; ${otherwise.length} set expressions the game reads otherwise than written${otherwise.length ? ': ' + otherwise.slice(0, 6).join('; ') : ''}`);
  // The catalog: every bit an expression names is in it, and b147 is named after Take Polaris Home.
  const cat = S.novaBitCatalog(game);
  const named = new Set();
  for (const e of exprs) {
    if (e.kind === 'test') for (const x of S.ncbTestNeeds(e.text)) named.add(x.n);
    else for (const o of S.ncbSetOps(e.text)) if (o.letter === 'B') named.add(o.n);
  }
  const missing = [...named].filter(n => !cat.has(n));
  if (missing.length) fail(`${v}: bits the files use and not in the catalog: ${missing.slice(0, 8).join(', ')}`);
  const b147 = cat.get(147);
  if (!b147 || !/Take Polaris Home/.test(b147.name || '') || !b147.refs.some(r => r.type === 'sÿst' && r.effect === 'on'))
    fail(`${v}: b147 is not named after Take Polaris Home with a system's visibility needing it: ${JSON.stringify(b147 && b147.name)}`);
  console.log(`${v}: ${cat.size} bits in use, ${[...cat.values()].filter(b => b.name).length} of them changed by something; b147 "${b147 && b147.name}"`);
}
process.exit(fails ? 1 : 0);
