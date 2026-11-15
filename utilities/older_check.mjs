// Escape Velocity 1.0.5 and EV Override 1.0.2, Nova's elders, opened from
// their installers (archive.org's EscapeVelocityPluginCollection/Installers,
// MacBinary copies of Installer VISE applications) as the page opens them.
//
//   1. Every file in each installer read back whole: its stored CRC, which the
//      installer was built with, must match what mac-vise.js decompressed.
//   2. The page's list: the game's parts and plug-ins by their Mac types, which
//      game it is, and EV Override's templates file.
//   3. Records read through the templates in the files. No record may be
//      longer than its template. EV's are each exactly as long. EV Override's
//      templates end in fields and Unused words that most of its shipped
//      records stop short of, and those read as far as their bytes go, as a
//      Nova plug-in's do. The ships must read as the Nova ports of the two
//      games (EV Classic for Nova, EV Override for Nova) have them through
//      nova-records.js's tables, which records_check checks against Ambrosia's
//      Nova templates. The ports convert Accel, Speed, Maneuver, and DeathDelay to
//      Nova's units, and change a few Armor, Flags, and FuelRegen values,
//      so those are left out. Every other field must match, and with a
//      template shifted by one word most must differ.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const INST = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Installers');
const GAMES = [
  { file: 'Escape_Velocity.bin', kind: 'ev', port: ['game/EV_Classic_for_Nova_1.1.1_1.zip'] },
  { file: 'EVOverride.bin', kind: 'evo', port: ['game/extras/EV_Override_for_Nova.zip'] },
];
if (!GAMES.every(g => fs.existsSync(path.join(INST, g.file)))) { console.log('SKIP: the EV and EV Override installers are not in reference/'); process.exit(0); }

// the Nova port's ships, read through Nova's tables
function portShips(rel) {
  const p = path.join(REF, rel);
  if (!fs.existsSync(p)) return null;
  const files = S.novaArchiveFiles(new Uint8Array(fs.readFileSync(p)));
  const game = S.novaGame();
  for (const f of files) if (f.plugin || f.role === 'data') game.add(f, f.read());
  return new Map(S.novaAll(game, 'shïp').map(r => [r.id, r]));
}
// the fields a port converts or changes, left out of the comparison
const CONVERTED = new Set(['Accel', 'Speed', 'Maneuver', 'DeathDelay', 'Armor', 'Flags', 'FuelRegen']);

for (const g of GAMES) {
  const raw = new Uint8Array(fs.readFileSync(path.join(INST, g.file)));
  // 1. every file's CRC
  const vise = S.parseViseArchive(S.novaArchiveIn(raw));
  let crcs = 0;
  for (const e of vise.entries) { if (S.viseExtract(vise, e).crcOk) crcs++; else fail(`${g.file}: ${e.path} does not match its stored CRC`); }
  // 2. the page's list
  const files = S.novaArchiveFiles(S.novaArchiveIn(raw));
  const roles = files.map(f => `${f.name} ${f.plugin ? 'plug-in' : f.role}`).join(', ');
  if (files.some(f => f.kind !== g.kind)) fail(`${g.file} has files not marked ${g.kind} (${files.filter(f => f.kind !== g.kind).map(f => f.name).join(', ')})`);
  if (!files.some(f => f.role === 'data')) fail(`${g.file}: no data file in the list (${roles})`);
  const game = S.novaGame();
  for (const f of files) game.add(f, f.read());
  if (game.kind() !== g.kind) fail(`${g.file}: the game reads as ${game.kind()}, not ${g.kind}`);
  // 3. the records through the templates
  let types = 0, recs = 0, short = 0;
  for (const t of game.types()) {
    const table = game.table(t);
    if (!table || t === 'TMPL') continue;
    types++;
    const size = table.some(f => f[1] === 'cstr') ? null : table.reduce((n, [, k, c]) => n + (k === 'pad' || k === 'str' ? c : S.NOVA_KIND_SIZE[k] * (c || 1)), 0);
    for (const e of game.list(t)) {
      const r = game.get(t, e.id);
      if (size !== null && r.bytes.length > size) fail(`${g.file}: ${t} ${e.id} is ${r.bytes.length} bytes, its template ${size}`);
      if (size !== null && r.bytes.length < size) short++;
      if (g.kind === 'ev' && size !== null && r.bytes.length !== size) fail(`${g.file}: ${t} ${e.id} is ${r.bytes.length} bytes, its template ${size}`);
      recs++;
    }
  }
  const port = portShips(g.port[0]);
  let same = 0, all = 0, shifted = 0;
  if (port) {
    const table = game.table('shïp');
    // the negative control: the template with a word put in front
    const bent = [['Bent', 'i16'], ...table];
    for (const e of game.list('shïp')) {
      const p = port.get(e.id);
      if (!p) continue;
      const r = game.get('shïp', e.id), mine = S.novaRecord('shïp', r.bytes, table), off = S.novaRecord('shïp', r.bytes, bent);
      for (const f of Object.keys(mine)) if (!CONVERTED.has(f) && typeof mine[f] === 'number' && typeof p[f] === 'number') { all++; if (mine[f] === p[f]) same++; if (off[f] === p[f]) shifted++; }
    }
    if (!all) fail(`${g.file}: no ship of its port to compare`);
    else if (same < all) fail(`${g.file}: only ${same} of ${all} ship fields read as the Nova port has them`);
    if (all && shifted >= all * 0.5) fail(`${g.file}: a template shifted by a word still reads ${shifted} of ${all} as the port, so the comparison proves nothing`);
  } else console.log(`SKIP ${g.file}: its Nova port ${g.port[0]} is not in reference/`);
  console.log(`${g.file} has ${vise.entries.length} files and ${crcs} match their CRC. The page lists ${files.length} (${roles}). ${types} types and ${recs} records read through the templates, ${short} shorter than theirs. ${same} of ${all} ship fields read as the port has them, and ${shifted} with the template shifted a word.`);
}
console.log(fails ? `${fails} failed` : 'older games: all passed');
process.exit(fails ? 1 : 0);
