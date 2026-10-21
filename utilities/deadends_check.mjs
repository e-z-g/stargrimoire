// js/nova-deadends.js: where a storyline can be left with no way on, in
// every release.
//
// Held to what was found by reading the missions (findings.md, Dead ends):
// mïsn 266 "Heraan Warrior Initiation" turns b511 on when accepted from
// 1.0.8, and an escape pod during it leaves it on for good, closing the
// main storylines' openings; 1.0.2 turned it on only on success, which is
// not that. From 1.0.8, mïsn 160 starts hidden mïsn 600, whose success
// alone turns on b285, which step 12 needs; in every release the Polaris
// finale runs on hidden missions each started by the last, 887 its end;
// an escape pod loses any of them. Then each search is shown to fail where it should, on a copy
// of the game with one mission changed: Rebel I, which has no dead end,
// has one when mïsn 345 is made to turn a bit on when accepted that it
// needs off and its OnAbort leaves on, as 266 does b511; the b511 case goes with
// 266's OnAccept emptied in 1.0.10, and comes with it set to b511 in
// 1.0.2. Last, taking two of a storyline's missions at a time finds dead
// ends in the same storylines as one at a time, for every storyline small
// enough to search that way.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const t0 = Date.now();

// A copy of a game with one record's fields changed.
function changed(game, type, id, fields) {
  const w = Object.create(game);
  w.get = (t, i) => { const r = game.get(t, i); return r && t === type && i === id ? Object.assign({}, r, { bytes: S.novaRecordBytes(t, fields, r.bytes) }) : r; };
  return w;
}
// The highest bit no record's text mentions.
function unusedBit(game) {
  const seen = new Set();
  for (const type of ['mïsn', 'crön', 'oütf', 'shïp', 'nëbu', 'spöb', 'përs', 'chär', 'sÿst', 'düde', 'flët', 'ränk', 'öops', 'jünk'])
    for (const r of S.novaAll(game, type)) for (const v of Object.values(r)) if (typeof v === 'string') for (const m of v.matchAll(/\d+/g)) seen.add(+m[0]);
  let n = 9999;
  while (seen.has(n)) n--;
  return n;
}
const storyNamed = (game, name) => [...S.novaMissions(game).stories.values()].find(s => s.name === name);
const holds = (held, mission, bit) => held.some(h => h.mission === mission && h.bit === bit);

const games = new Map();
for (const v of ['1.0.2', '1.0.8', '1.0.10', '1.1.1']) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const g = openRelease(S, v, null), t = Date.now();
  games.set(v, g);
  const reach = S.novaReach(g), held = S.novaHeldBits(g, reach), pod = S.novaPodLosses(g, reach, S.novaMissions(g)), found = [];
  let states = 0;
  for (const s of S.novaMissions(g).stories.values()) {
    const r = S.novaStoryDeadEnds(g, s, reach);
    if (r.tooMany) { fail(`${v}: ${s.name} is past searching (${r.states} states)`); continue; }
    states += r.states;
    if (r.stuck) found.push(`${s.name} (${r.after.length})`);
  }
  console.log(`${v}: ${S.novaMissions(g).stories.size} storylines, ${states} states, dead ends in ${found.length}: ${found.join(', ')}; ` +
    `bits left on: ${held.map(h => `b${h.bit} by mïsn ${h.mission}`).join(', ')}; ${pod.length} missions an escape pod can lose (${Date.now() - t} ms)`);
  const lost = id => pod.find(o => o.mission === id);
  if (v === '1.0.2' ? lost(600) : !(lost(600) && lost(600).bits.some(b => b.bit === 285) && lost(600).by.includes(160))) fail(`${v}: mïsn 600 and b285 ${v === '1.0.2' ? 'found, though 1.0.2 has no mïsn 600 to lose' : 'not found'}: ${JSON.stringify(lost(600))}`);
  if (!(lost(887) && lost(887).end === 'polaris') || !(lost(882) && lost(882).starts.includes(885))) fail(`${v}: the Polaris finale's losses: ${JSON.stringify([lost(882), lost(887)])}`);
  if (v === '1.0.2' ? holds(held, 266, 511) : !holds(held, 266, 511)) fail(`${v}: mïsn 266 and b511 ${v === '1.0.2' ? 'found, though 1.0.2 turns it on only on success' : 'not found'}`);
}

// ---- each search fails where it should ----------------------------------
const g10 = games.get('1.0.10'), g2 = games.get('1.0.2');
if (g10) {
  const as = S.novaStoryDeadEnds(g10, storyNamed(g10, 'Rebel I'), S.novaReach(g10)), m345 = S.novaGet(g10, 'mïsn', 345), x = unusedBit(g10);
  const g = changed(g10, 'mïsn', 345, { AvailBits: `(${m345.AvailBits}) & !b${x}`, OnAccept: `b${x}` }), broken = S.novaStoryDeadEnds(g, storyNamed(g, 'Rebel I'), S.novaReach(g));
  if (as.stuck) fail(`1.0.10: Rebel I has ${as.stuck} stuck states as shipped`);
  if (!broken.after.some(a => a.what === 'abort' && a.mission === 345)) fail(`1.0.10: Rebel I has no dead end after aborting a mïsn 345 that turns on b${x}, which it needs off`);
  else console.log(`1.0.10: Rebel I with mïsn 345 turning on b${x}, which no record mentions and it needs off: ${broken.stuck} stuck states, after ${broken.after.map(a => a.what + ' ' + (a.mission ?? a.missions)).join(', ')}`);
  const g266 = changed(g10, 'mïsn', 266, { OnAccept: '' });
  if (holds(S.novaHeldBits(g266, S.novaReach(g266)), 266, 511)) fail('1.0.10: b511 still found with mïsn 266\'s OnAccept emptied');
}
if (g10) {
  const g = changed(g10, 'mïsn', 600, { OnAbort: 'b285' });
  if (S.novaPodLosses(g, S.novaReach(g), S.novaMissions(g)).some(o => o.mission === 600)) fail('1.0.10: mïsn 600 still lost to an escape pod with b285 in its OnAbort');
}
if (g2) {
  const g = changed(g2, 'mïsn', 266, { OnAccept: 'b511' });
  if (!holds(S.novaHeldBits(g, S.novaReach(g)), 266, 511)) fail('1.0.2: b511 not found with mïsn 266 turning it on when accepted');
}

// ---- one at a time against two ------------------------------------------
if (g10) {
  const reach = S.novaReach(g10), differ = [], past = [];
  let n = 0;
  for (const s of S.novaMissions(g10).stories.values()) {
    const two = S.novaStoryDeadEnds(g10, s, reach, { maxActive: 2, cap: 200000 });
    if (two.tooMany) { past.push(s.name); continue; }
    n++;
    if ((S.novaStoryDeadEnds(g10, s, reach).stuck > 0) !== (two.stuck > 0)) differ.push(s.name);
  }
  if (differ.length) fail(`1.0.10: two missions at a time finds otherwise in ${differ.join(', ')}`);
  console.log(`1.0.10: two missions at a time, ${n} storylines, dead ends in the same ones (past searching so: ${past.join(', ') || 'none'})`);
}

console.log(`deadends: ${fails ? fails + ' failures' : 'ok'} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
