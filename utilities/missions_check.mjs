// js/nova-missions.js: the storylines read from Ambrosia's notes, the
// Bible's place codes, and which missions lead to which, over every release.
//
// The reading of a note is held to examples written out here. Every
// mission's place codes must be ones the Bible's mïsn section gives, and a
// stellar or system one must point at a record. A LAST mission's storyline
// must go no further by its links.
//
// Then the one outside source: the evnova.miraheze.org wiki's bit templates
// (reference/wiki, the maintainer's copy), which say of 348 bits "Done Fed
// 005" or "Accepted Tutorial 001" -- that the bit is turned on when that
// step of that storyline is completed or accepted. Nothing is taken from
// them; each is looked for among the missions that turn the bit on then,
// by storyline and step as the notes give them. They are people's notes and
// not all right (Vellos 24 to 29 are one step behind Ambrosia's numbers),
// so what is checked is how many match, not all of them, and those that do
// not are printed.
import fs from 'node:fs';
import path from 'node:path';
import { site, openRelease, haveRelease, REF, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

// ---- reading a note ----------------------------------------------------
const note = t => { const n = S.novaStoryNote(t); return n && [n.story, n.step, n.last, n.cutoff, n.rest]; };
eq('Polaris1', note('Polaris1'), ['Polaris', '1', false, false, '']);
eq('Rebel I22 LAST', note('Rebel I22 LAST'), ['Rebel I', '22', true, false, 'LAST']);
eq('Auroran 004 From B/Hunter', note('Auroran 004 From B/Hunter'), ['Auroran', '004', false, false, 'From B/Hunter']);
eq('Rebel II14 - Unregistered cutoff', note('Rebel II14 - Unregistered cutoff'), ['Rebel II', '14', false, true, '- Unregistered cutoff']);
eq('Pirate005Di', note('Pirate005Di'), ['Pirate', '005Di', false, false, '']);
eq('Wild Geese 7aI - link', note('Wild Geese 7aI - link to Pirate storyline'), ['Wild Geese', '7aI', false, false, '- link to Pirate storyline']);
eq('Fed46(if done GLi-tech)', note('Fed46(if done GLi-tech)'), ['Fed', '46', false, false, '(if done GLi-tech)']);
eq('no step', note('Polaris Spinoff'), ['Polaris Spinoff', null, false, false, '']);
eq('the same storyline however spelt', ['Vell-os', 'Vellos', 'Rebel  II'].map(t => S.novaStoryNote(t + '3').key), ['vellos', 'vellos', 'rebelii']);

// ---- every release ------------------------------------------------------
const WIKI = path.join(REF, 'wiki/evnova-miraheze/pages.jsonl');
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v);
  const u = S.novaUniverse(game), M = S.novaMissions(game);
  const problems = [];
  for (const m of M.byId.values()) {
    for (const [field, key] of [['avail', 'AvailStel'], ['travel', 'TravelStel'], ['return', 'ReturnStel']]) {
      const p = S.novaMissionPlace(u, field, m.rec[key]);
      if (/^code /.test(p.text)) problems.push(`mïsn ${m.id} ${key} ${m.rec[key]}`);
      if (p.stellar && !u.stellars.has(p.stellar)) problems.push(`mïsn ${m.id} ${key} names spöb ${p.stellar}, not in the files`);
      if (p.system && !u.byId.has(p.system)) problems.push(`mïsn ${m.id} ${key} names sÿst ${p.system}, not in the files`);
    }
    if (m.rec.ShipCount > 0 && /^code /.test(S.novaMissionPlace(u, 'ship', m.rec.ShipSyst).text)) problems.push(`mïsn ${m.id} ShipSyst ${m.rec.ShipSyst}`);
  }
  if (problems.length) fail(`${v}: ${problems.length} place codes the Bible does not give or that name nothing: ${problems.slice(0, 6).join('; ')}`);
  // a LAST mission leads nowhere further in its storyline
  const onward = [...M.byId.values()].filter(m => m.story && m.story.last).filter(m => m.next.some(id => { const o = M.byId.get(id); return o.story && o.story.key === m.story.key && (o.story.num ?? 0) > m.story.num; }));
  if (onward.length) fail(`${v}: LAST missions leading further on in their storyline: ${onward.map(m => m.id).join(', ')}`);
  const noted = [...M.byId.values()].filter(m => m.story).length;
  const links = [...M.byId.values()].reduce((a, m) => a + m.next.length, 0);
  console.log(`${v}: ${M.byId.size} missions, ${noted} with a note, in ${M.stories.size} storylines; ${links} links from one mission to the next; every place code read`);

  if (v !== '1.1.1') continue;
  if (!fs.existsSync(WIKI)) { console.log('SKIP the wiki: no reference/wiki'); continue; }
  const cat = S.novaBitCatalog(game), wiki = new Map();
  for (const l of fs.readFileSync(WIKI, 'utf8').split('\n')) {
    if (!l) continue;
    const p = JSON.parse(l), m = /^Template:B(\d+)$/.exec(p.title);
    if (!m) continue;
    const a = /title="([^"]*)"/.exec(p.text);
    wiki.set(+m[1], a ? a[1] : p.text);
  }
  const FIELD = { Done: 'OnSuccess', Accepted: 'OnAccept', Failed: 'OnFailure' };
  let tried = 0, agree = 0;
  const differ = [];
  for (const [n, t] of wiki) {
    const w = /^(Done|Accepted|Failed) (.+?)[ .](\d+)\b/.exec(t);
    if (!w) continue;
    tried++;
    const num = +w[3], word = w[2].toLowerCase().replace(/[^a-z ]/g, '').split(' ').find(x => x.length > 2) || '';
    const b = cat.get(n);
    const setters = (b ? b.refs : []).filter(r => r.type === 'mïsn' && r.effect === 'set' && r.field === FIELD[w[1]]).map(r => M.byId.get(r.id));
    if (setters.some(m => m.story && m.story.num === num && m.story.key.includes(word.slice(0, 4)))) agree++;
    else differ.push(`b${n} "${t.slice(0, 50)}": ${setters.map(m => `${m.id} "${m.note}"`).join(', ') || `no mission turns it on when ${w[1].toLowerCase()}`}`);
  }
  const AGREE = 320;
  if (agree < AGREE) fail(`the wiki: ${agree} of ${tried} bit names match the notes, fewer than the ${AGREE} that did`);
  console.log(`the wiki: ${agree} of ${tried} bit names that give a storyline's step match the notes; the others:\n  ${differ.join('\n  ')}`);
}
// The storyline charts (novaStoryLayout): every mission placed once, no two in one place, every line that is
// not marked back going down a row, and a line marked back only where following lines alone would loop.
for (const v of ['1.0.10', '1.1.1']) {
  if (!haveRelease(v)) continue;
  const data = S.novaMissions(openRelease(S, v));
  let charts = 0, backs = 0;
  for (const st of data.stories.values()) {
    if (st.missions.length < 2) continue;
    const L = S.novaStoryLayout(st.missions);
    charts++;
    const at = new Map(L.nodes.map(n => [n.id, n])), spots = new Set(L.nodes.map(n => n.layer + ',' + n.pos));
    if (at.size !== st.missions.length || spots.size !== L.nodes.length) fail(`${v} ${st.name}: missions placed ${at.size} of ${st.missions.length}, ${spots.size} places for ${L.nodes.length}`);
    for (const e of L.edges) {
      if (e.back) { backs++; continue; }
      if (!(at.get(e.to).layer > at.get(e.from).layer)) fail(`${v} ${st.name}: a line from ${e.from} to ${e.to} that does not go down`);
    }
    // the forward lines alone have no loop: a mission's row is above all it leads to, which the test above checks
  }
  console.log(`${v}: ${charts} storyline charts, ${backs} lines going back up a loop`);
}

// The whole game (novaGameOverview): every join held by what it cites, read again from the records'
// own fields -- a lead by one mission's set expressions or the other's test, a shut by the bit turned on
// and the opening's test needing it off, a person by its ActivateOn, an event by its OnStart or OnEnd --
// and a storyline joining itself nowhere; Rebel I leads to Rebel II.
for (const v of ['1.0.10', '1.1.1']) {
  if (!haveRelease(v)) continue;
  const game = openRelease(S, v), data = S.novaMissions(game), O = S.novaGameOverview(game, data);
  const key = id => { const m = data.byId.get(id); return m && m.story && m.story.key; };
  const turns = (rec, fields, n) => fields.some(f => S.ncbSetOps(rec[f] || '').some(o => o.op === 'set' && o.n === n));
  const needs = (test, n, on) => S.ncbTestNeeds(test || '').some(x => x.n === n && x.on === on);
  let bad = 0;
  const no = m => { if (bad++ < 5) fail(`${v}: the whole game: ${m}`); };
  for (const j of [...O.leads, ...O.shuts]) if (j.from === j.to) no(`${j.from} joins itself`);
  for (const j of O.leads) for (const [a, b] of j.via) if (key(a) !== j.from || key(b) !== j.to || !data.byId.get(a).next.includes(b)) no(`lead ${a} to ${b}`);
  for (const j of O.shuts) for (const [a, o, n] of j.via) {
    const A = data.byId.get(a), B = data.byId.get(o);
    if (key(a) !== j.from || key(o) !== j.to || !turns(A.rec, ['OnAccept', 'OnSuccess', 'OnShipDone'], n) || !needs(B.rec.AvailBits, n, false)) no(`shut ${a} b${n} ${o}`);
    if (B.prev.some(p => key(p) === j.to)) no(`shut ${o} is not an opening of ${j.to}`);
  }
  for (const p of O.people) for (const [list, on] of [[p.appears, true], [p.goes, false]]) for (const x of list) for (const [m, n] of x.via) {
    if (key(m) !== x.story || !needs(S.novaGet(game, 'përs', p.pers).ActivateOn, n, on) || !data.byId.get(m).turnsOn.has(n)) no(`person ${p.pers} b${n}`);
  }
  for (const e of O.events) for (const [list, on] of [[e.opens, true], [e.shuts, false]]) for (const x of list) for (const [m, n] of x.via) {
    if (key(m) !== x.story || !turns(S.novaGet(game, 'crön', e.cron), ['OnStart', 'OnEnd'], n) || !needs(data.byId.get(m).rec.AvailBits, n, on)) no(`event ${e.cron} b${n}`);
  }
  const rebel = [...data.stories.values()], r1 = rebel.find(s => s.name === 'Rebel I'), r2 = rebel.find(s => s.name === 'Rebel II');
  if (!r1 || !r2 || !O.leads.some(j => j.from === r1.key && j.to === r2.key)) no('Rebel I does not lead to Rebel II');
  console.log(`${v}: the whole game: ${data.stories.size} storylines, ${O.leads.length} leads and ${O.shuts.length} shuts between them, ${O.people.length} people and ${O.events.length} events joining them, each held by its records`);
}

process.exit(fails ? 1 : 0);
