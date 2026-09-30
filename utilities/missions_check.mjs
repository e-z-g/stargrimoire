// js/nova-missions.js: the storylines read from Ambrosia's notes, the
// Bible's place codes, and which missions lead to which, over every release.
//
// The reading of a note is held to examples written out here. Every
// mission's place codes must be ones the Bible's mïsn section gives, and a
// stellar or system one must name a record. A LAST mission's storyline
// must go no further by its own links.
//
// Then the one outside source: the evnova.miraheze.org wiki's bit templates
// (reference/wiki, the maintainer's copy), which say of 348 bits "Done Fed
// 005" or "Accepted Tutorial 001" -- that the bit is turned on when that
// step of that storyline is completed or accepted. Nothing is taken from
// them; each is looked for among the missions that turn the bit on then,
// by storyline and step as the notes give them. They are people's notes and
// not all right (Vellos 24 to 29 are one step behind Ambrosia's numbers),
// so what is held is how many agree, not all of them, and those that do
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
  // a LAST mission leads nowhere further in its own storyline
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
  if (agree < AGREE) fail(`the wiki: ${agree} of ${tried} bit names agree with the notes, fewer than the ${AGREE} that did`);
  console.log(`the wiki: ${agree} of ${tried} bit names that give a storyline's step agree with the notes; the others:\n  ${differ.join('\n  ')}`);
}
process.exit(fails ? 1 : 0);
