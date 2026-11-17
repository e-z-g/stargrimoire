// js/nova-pilot.js: save files, decrypted and read.
//
// Held to:
//   - the layout Mac 1.1.1's FlipNpil gives, as evnova-workbench's
//     tools/flipnpil.py runs it over otool's disassembly: every place it
//     swaps two bytes at is a 16-bit field of NOVA_PILOT_LAYOUT, every place
//     it swaps four at a 32-bit one, and the layout has no other;
//   - evnova-utils' simpleCrypt (Scripts/lib/Nova/Old/pilot/read.pl),
//     a decryption written apart from this, in Perl: the same bytes from
//     every record of every save file in reference/;
//   - every save file there read: each of version 300 or more, its date a
//     date, and a count of those with 1.0.10's ships and stellars;
//   - a key changed by one bit, which must give another version, and a
//     layout with one field moved, which the comparison with FlipNpil must
//     find;
//   - Robert's ship copied as a ship class, against figures worked by hand
//     from his outfits, with a copy bent to fail;
//   - EV Override's saves in the collection's EVO.zip (EVOPilotFile and the
//     pilot editor's example), opened as the page opens them, with the game
//     from its installer: version 107, a date, every ship class, escort and
//     fighter a shïp of the game; each elder layout tiling its records with
//     no field over another; a key one bit off, and the escorts moved a
//     byte, each found.
// Needs python3 and otool for flipnpil.py, and perl for simpleCrypt;
// without them that part skips.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, openRelease, haveRelease, REF, ROOT } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// ---- the layout against FlipNpil's
// each place a field of `fields` is swapped at, two or four bytes
function swapsOf(fields, base = 0, out = new Map()) {
  for (const [, off, kind, count] of fields) {
    const n = count || 1, w = { s16: 2, s32: 4 }[kind], g = S.NOVA_PILOT_GROUPS[kind];
    for (let k = 0; k < n; k++) {
      if (w) out.set(base + off + w * k, w);
      else if (g) swapsOf(g.fields, base + off + g.size * k, out);
    }
  }
  return out;
}
// the places the two give differently, the first few reported
function compare(mine, theirs, label, quiet) {
  let same = 0, bad = 0;
  const report = m => { if (!quiet && bad <= 5) fail(m); };
  for (const [at, w] of theirs) { if (mine.get(at) === w) same++; else { bad++; report(`${label}: FlipNpil swaps ${w} bytes at ${at.toString(16)}, the layout ${mine.has(at) ? mine.get(at) : 'none'}`); } }
  for (const [at, w] of mine) if (!theirs.has(at)) { bad++; report(`${label}: the layout has ${w} bytes at ${at.toString(16)}, which FlipNpil does not swap`); }
  return { same, bad };
}
const FLIP = path.join(ROOT, '..', 'evnova-workbench', 'tools', 'flipnpil.py');
let flip = null;
try { flip = JSON.parse(execFileSync('python3', [FLIP, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
catch (e) { console.log(`SKIP flipnpil: ${String(e.message).split('\n')[0]}`); }
if (flip) {
  const theirs = id => { const m = new Map(); for (const [o, w, n] of flip[id]) for (let k = 0; k < n; k++) m.set(o + w * k, w); return m; };
  for (const id of [128, 129]) {
    const t = theirs(id), { same, bad } = compare(swapsOf(S.NOVA_PILOT_LAYOUT[id]), t, `NpïL ${id}`);
    console.log(`NpïL ${id}: ${same} fields where FlipNpil swaps them, to byte ${(Math.max(...t.keys()) + t.get(Math.max(...t.keys()))).toString(16)}${bad ? `, ${bad} not` : ''}`);
    if (same < 1000) fail(`NpïL ${id}: only ${same} fields compared`);
  }
  // a field moved by two bytes: the comparison must see it
  const bent = S.NOVA_PILOT_LAYOUT[128].map(f => (f[0] === 'cash' ? [f[0], f[1] + 2, f[2], f[3]] : f));
  const r = compare(swapsOf(bent), theirs(128), 'bent', true);
  if (!r.bad) fail('a layout with cash moved two bytes still matches FlipNpil');
  else console.log(`bent: cash moved two bytes, ${r.bad} places found wrong`);
}

// ---- the save files in reference/
function saves(dir, out = []) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) { saves(p, out); continue; }
    if (!n.isFile()) continue;
    let fork = null;
    try { fork = fs.readFileSync(p + '/..namedfork/rsrc'); } catch (e) { continue; }
    if (!fork.length) continue;
    try { const f = S.openResourceFork(new Uint8Array(fork)); if (S.novaPilotGameOf(f) === 'nova') out.push({ path: p, fork: f }); } catch (e) { /* not a fork */ }
  }
  return out;
}
const found = fs.existsSync(path.join(REF, 'unpacked')) ? saves(path.join(REF, 'unpacked')) : [];
if (!found.length) { console.log('SKIP: no save files in reference/unpacked'); process.exit(fails ? 1 : 0); }

const g1010 = haveRelease('1.0.10') ? openRelease(S, '1.0.10') : null;
const has = (type, id) => !!g1010 && g1010.list(type).some(r => r.id === id);
const key = S.novaTypeKey('NpïL');
let read = 0, stock = 0;
for (const { path: p, fork } of found) {
  const rel = path.relative(REF, p);
  let s;
  try { s = S.novaReadPilot(fork, path.basename(p)); } catch (e) { fail(`${rel}: ${e.message}`); continue; }
  read++;
  const P = s.pilot;
  if (!(P.month >= 1 && P.month <= 12 && P.day >= 1 && P.day <= 31)) fail(`${rel}: the date ${P.day}/${P.month}/${P.year}`);
  // a save made with the stock game has the stock ships and stellars
  if (has('shïp', P.shipClass + 128) && has('spöb', P.stellar + 128)) stock++;
  console.log(`  ${s.name}: ${s.shipName} (shïp ${P.shipClass + 128}), at spöb ${P.stellar + 128}, ${P.day}/${P.month}/${P.year}, ${P.cash} credits, rating ${P.kills}, version ${s.game.version}, ${P.bits.filter(Boolean).length} bits on`);
}
console.log(`${read} of ${found.length} save files read, ${stock} with 1.0.10's ships and stellars`);
if (read < found.length) fail(`${found.length - read} save files not read`);

// ---- the decryption against evnova-utils' simpleCrypt
const READ_PL = path.join(REF, 'evnova-utils', 'Scripts', 'lib', 'Nova', 'Old', 'pilot', 'read.pl');
let perl = false;
try { execFileSync('perl', ['-e', '1']); perl = fs.existsSync(READ_PL); } catch (e) { perl = false; }
if (!perl) console.log('SKIP simpleCrypt: no perl or no read.pl');
else {
  // simpleCrypt alone, taken out of read.pl, run on each record's bytes
  const m = /sub simpleCrypt \{[\s\S]*?\n\}\n/.exec(fs.readFileSync(READ_PL, 'utf8'));
  if (!m) fail('read.pl has no simpleCrypt');
  else {
    const pl = `use strict; use warnings; ${m[0]} local $/; binmode STDIN; binmode STDOUT; my $d = <STDIN>; print simpleCrypt(0xB36A210F, $d);`;
    let same = 0;
    for (const { path: p, fork } of found) for (const e of fork.resourcesByType[key]) {
      const raw = fork.dataOf(key, e);
      const theirs = execFileSync('perl', ['-e', pl], { input: Buffer.from(raw), maxBuffer: 1 << 24 });
      if (Buffer.compare(Buffer.from(S.novaPilotCrypt(raw)), theirs) === 0) same++;
      else fail(`${path.relative(REF, p)} NpïL ${e.id}: decrypted otherwise than simpleCrypt`);
    }
    console.log(`simpleCrypt: ${same} records decrypted the same`);
  }
}

// ---- a key one bit off gives another version
{
  const { fork } = found[0], e = fork.resourcesByType[key].find(r => r.id === 129);
  const raw = fork.dataOf(key, e), off = Uint8Array.from(raw);
  off[1] ^= 1;   // the first word xored as by the key 0xB36B210F
  const version = b => new DataView(S.novaPilotCrypt(b).buffer).getInt16(0);
  if (version(off) === version(raw)) fail('a key one bit off reads the same version');
  else console.log(`a key one bit off gives version ${version(off)} in place of ${version(raw)}`);
}

// ---- Robert's ship copied (novaPilotShip, novaShipCopy), against sums worked by hand from his outfits in
// 1.0.10: the Aurora Thunderforge (shïp 380) with Holds 75 - 15 - 4 x 12 (Mass Expansion, four Mass Retools) = 12;
// Shield 700 + 100 (Sigma Electrical Rewiring) = 800; Armor 1100 + 4 x 100 (TripHammers) = 1500; Accel 395 + 75
// (Port & Polish) - 2 (Storm Chaingun) + 60 (Sigma Engine Tune-up) + 4 x 20 = 608; Speed 340 - 6 - 2 - 8 + 25 - 2
// - 4 + 30 = 373; Maneuver 20 + (-2 - 4 + 10 + 125 + 75 + 20) / 10 = 42.4, kept as 42; Fuel 500 + 100 + 100 = 700;
// ShieldRech 50 + 50 = 100. His eight weapons in the slots, his ammunition for the IR and radar missiles, and
// wëap 155, of which he has ammunition alone, left out. The record written reads back with those fields and
// every other as the class's; its id is the first from 128 that no shïp has. A copy that adds Maneuver's
// ModVal without the ÷ 10 must fail.
const robert = found.find(f => f.path.endsWith(path.join('EVN', 'Plugins', 'Pilots', 'Pilots', 'Robert')));
if (robert && haveRelease('1.0.10')) {
  const g = openRelease(S, '1.0.10', null), save = S.novaReadPilot(robert.fork, 'Robert');
  const want = { Holds: 12, Shield: 800, Armor: 1500, Accel: 608, Speed: 373, Maneuver: 42, Fuel: 700, ShieldRech: 100,
    WeapType: [134, 135, 143, 144], WeapType2: [158, 161, 162, 232], WeapCount: [2, 2, 6, 1], WeapCount2: [4, 1, 4, 4], AmmoLoad: [200, 149, 0, 0], AmmoLoad2: [0, 0, 0, 0] };
  const differs = got => Object.keys(want).filter(k => JSON.stringify(got[k]) !== JSON.stringify(want[k]));
  const copy = S.novaPilotShip(g, save), res = S.novaShipCopy(g, copy.from, copy.name, copy.change);
  const back = S.novaRecord('shïp', res[0].data), cls = S.novaGet(g, 'shïp', 380);
  const bad = differs(back), others = Object.keys(back).filter(k => !(k in copy.change) && JSON.stringify(back[k]) !== JSON.stringify(cls[k]));
  if (copy.from !== 380 || copy.name !== 'Aurora Thunderforge') fail(`Robert's ship: shïp ${copy.from}, "${copy.name}"`);
  if (bad.length) fail(`Robert's ship copied: ${bad.map(k => `${k} ${JSON.stringify(back[k])}`).join('; ')}`);
  if (others.length) fail(`Robert's ship copied with fields not the class's (${others.join(', ')})`);
  let free = 128; while (g.list('shïp').some(e => e.id === free)) free++;
  if (res[0].id !== free || res[1].type !== 'shän' || res[1].id !== free) fail(`Robert's ship copied as ${res.map(r => r.type + ' ' + r.id).join(', ')}, not ${free}`);
  const m = S.NOVA_PILOT_SHIP_ADDS.find(a => a[0] === 'Maneuver');
  m[2] = 1; const bent = S.novaPilotShip(g, save); m[2] = 0.1;
  if (!differs(bent.change).includes('Maneuver')) fail('a copy adding Maneuver\'s ModVal whole passed');
  if (!bad.length && !others.length) console.log(`Robert's ship copied as shïp ${res[0].id}, ${Object.keys(want).length} fields as worked by hand and the rest the class's. Maneuver bent to ${bent.change.Maneuver} is found`);
}

// ---- Escape Velocity's and EV Override's saves
{
  // each layout's fields in order, none over the next, the last ending at the record's size (129 has two gaps it never reads)
  for (const kind of ['ev', 'evo']) {
    const G = S.NOVA_PILOT_GAMES[kind];
    for (const id of [128, 129]) {
      let end = 0, gaps = 0;
      for (const [name, off, k, count] of G.layout[id]) {
        const g = S.NOVA_PILOT_GROUPS[k], w = g ? g.size : k === 'pstr' || k === 'cstr' ? 1 : { s16: 2, s32: 4, u8: 1 }[k];
        if (off < end) fail(`${kind} ${id}: ${name} at ${off} is over the field before it, which ends at ${end}`);
        if (off > end) gaps++;
        end = off + w * (count || 1);
      }
      if (end !== G.size[id]) fail(`${kind} ${id}: the fields end at ${end}, not ${G.size[id]}`);
      if (id === 128 && gaps !== 1) fail(`${kind} 128 has ${gaps} gaps, not the one at the shield (16)`);
      if (id === 129 && gaps !== 2) fail(`${kind} 129 has ${gaps} gaps, not the two the loader skips`);
    }
  }
  const ZIP = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/EVO.zip');
  const INST = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Installers/EVOverride.bin');
  if (!fs.existsSync(ZIP) || !fs.existsSync(INST)) console.log('SKIP the elder saves, with no EVO.zip or EV Override installer in reference/');
  else {
    const game = S.novaGame();
    for (const f of S.novaArchiveFiles(S.novaArchiveIn(new Uint8Array(fs.readFileSync(INST))))) game.add(f, f.read());
    const classes = new Set(S.novaAll(game, 'shïp').map(r => r.id));
    const saves = [];
    for (const entry of ['EVO/Cheats/EVOPilotFile.sit', 'EVO/Utilities/PilotFileEditorV2.sit.hqx']) {
      const bytes = new Uint8Array(execFileSync('unzip', ['-p', ZIP, entry], { maxBuffer: 64 << 20 }));
      let arch = bytes;
      try { const w = S.sniffMacContainer(bytes); if (w && w.data && w.data.length) arch = w.data; } catch (e) { /* not BinHex */ }
      for (const f of S.novaArchiveFiles(arch).filter(x => x.pilot)) saves.push({ f, fork: S.novaOpenFork(f.read()) });
    }
    // what a save must be: EV Override's, version 107, a date, and ships of the game
    const wrong = (p, label) => {
      const bad = [];
      if (p.kind !== 'evo') bad.push(`reads as ${p.kind}`);
      if (p.game.version !== 107) bad.push(`version ${p.game.version}`);
      if (!(p.pilot.month >= 1 && p.pilot.month <= 12 && p.pilot.day >= 1 && p.pilot.day <= 31)) bad.push(`date ${p.pilot.month}/${p.pilot.day}`);
      if (!classes.has(p.pilot.shipClass + 128)) bad.push(`ship class ${p.pilot.shipClass}`);
      for (const v of p.pilot.escorts) if (v >= 0 && !classes.has(v % 1000 + 128)) bad.push(`escort ${v}`);
      for (const v of p.pilot.fighters) if (v >= 0 && !classes.has(v + 128)) bad.push(`fighter ${v}`);
      return bad.length ? `${label}: ${bad.slice(0, 4).join(', ')}` : null;
    };
    let read = 0;
    for (const { f, fork } of saves) {
      let p;
      try { p = S.novaReadPilot(fork, f.name); } catch (e) { fail(e.message); continue; }
      const bad = wrong(p, f.name);
      if (bad) fail(bad); else read++;
    }
    if (saves.length !== 2) fail(`${saves.length} EV Override saves found in EVO.zip, not 2`);
    // controls: the key one bit off, and the escorts a byte later
    const G = S.NOVA_PILOT_GAMES.evo, keep = { key: G.key, layout: G.layout[128] };
    let found = 0;
    const control = (what, bend) => {
      bend();
      const caught = saves.some(({ f, fork }) => { try { return !!wrong(S.novaReadPilot(fork, f.name), f.name); } catch (e) { return true; } });
      G.key = keep.key; G.layout[128] = keep.layout;
      if (caught) found++; else fail(`the control with ${what} was not found`);
    };
    control('the key one bit off', () => { G.key = keep.key ^ 0x10000; });   // a bit of the version's half
    control('the escorts a byte later', () => { G.layout[128] = keep.layout.map(f => f[0] === 'escorts' ? [f[0], f[1] + 1, f[2], f[3]] : f); });
    console.log(`EV Override: ${read} of ${saves.length} saves read as the program reads them, and ${found} of 2 controls found`);
  }
  // Escape Velocity's: the save made in SheepShaver on 17 November 2026, against what
  // the game showed as it was made (evnova-reference's README)
  const EV = path.join(REF, 'saves/sg test pilot.bin');
  if (!fs.existsSync(EV)) console.log('SKIP the Escape Velocity save, with no saves/sg test pilot.bin in reference/');
  else {
    const fork = S.novaOpenFork(S.sniffMacContainer(new Uint8Array(fs.readFileSync(EV))).rsrc);
    const shown = { kind: 'ev', version: 106, cash: 7600, food: 20, date: '11/19/2276', ship: 'Journeyman', missions: '["Ferry Passengers to <DST>"]' };
    const wrong = () => {
      const p = S.novaReadPilot(fork, 'sg test pilot'), P = p.pilot;
      const got = { kind: p.kind, version: p.game.version, cash: P.cash, food: P.cargo[0], date: `${P.month}/${P.day}/${P.year}`, ship: p.shipName,
        missions: JSON.stringify(P.missions.filter((m, i) => P.objectives[i].active).map(m => m.name)) };
      return Object.keys(shown).filter(k => got[k] !== shown[k]).map(k => `${k} ${got[k]}`);
    };
    const bad = wrong();
    if (bad.length) fail(`Escape Velocity's save: ${bad.join(', ')}`);
    // control: the mission's name read at 94, where the special ships' name is
    const g = S.NOVA_PILOT_GROUPS.evMission, keep = g.fields;
    g.fields = keep.map(f => (f[0] === 'name' ? ['name', 94, 'pstr', 32] : f));
    const caught = wrong().length > 0;
    g.fields = keep;
    if (!caught) fail('the control with the mission\'s name at 94 was not found');
    if (!bad.length && caught) console.log('Escape Velocity: the save reads as the game showed it, and the control with the mission\'s name at 94 found');
  }
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('ok');
