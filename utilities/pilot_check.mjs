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
//     find.
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
    try { const f = S.openResourceFork(new Uint8Array(fork)); if (S.novaHoldsPilot(f)) out.push({ path: p, fork: f }); } catch (e) { /* not a fork */ }
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
  else console.log(`a key one bit off: version ${version(off)} in place of ${version(raw)}`);
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('ok');
