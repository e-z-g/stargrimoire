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
//   4. The installer's program: every number the page states from it
//      (NOVA_OLDER_FIGURES) found by the shape of its code, equal to the
//      number in the page's code where it has one, and none found with the number bent.
//   5. The map: every system, every link to a system, and every stellar in
//      a system with the sprite and landing picture its numbers give, and a
//      picture for every nebula.
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

  // 4. the program's numbers: each found in the installer's program, and the site's where it has one
  const src = S.novaArchiveProgram(S.novaArchiveIn(raw));
  const prog = src && S.novaProgram(src.read(), src.readRsrc());
  if (!prog) { fail(`${g.file}: no program found in the installer`); continue; }
  const want = { ...S.NOVA_OLDER, stellarDesc: S.novaStellarDescId({ id: 128 }) };
  const found = [];
  for (const name of Object.keys(S.NOVA_OLDER_FIGURE_WORDS)) {
    const f = S.novaFigure(prog, name, game);
    if (!f) { fail(`${g.file}: ${name} is not found in the program`); continue; }
    if (name in want && f.value !== want[name]) fail(`${g.file}: ${name} is ${f.value} in the program and ${want[name]} on the page`);
    found.push(`${name} ${f.value} at 0x${f.addr.toString(16)}`);
  }
  // with the site's number bent, the readers that look for it find nothing
  const kept = S.NOVA_OLDER.stellarSpin;
  S.NOVA_OLDER.stellarSpin = kept + 1;
  if (S.novaFigure(prog, 'stellarSpin', game)) fail(`${g.file}: stellarSpin is found with the site's number bent`);
  S.NOVA_OLDER.stellarSpin = kept;

  // 5. the map's universe: every system and link, and the pictures the numbers give in the files
  const u = S.novaUniverse(game);
  const links = u.systems.reduce((n, sy) => n + sy.links.length, 0), stray = u.systems.flatMap(sy => sy.links.filter(l => !u.byId.has(l)));
  if (u.systems.length !== game.list('sÿst').length || !links || stray.length) fail(`${g.file}: ${u.systems.length} systems of ${game.list('sÿst').length}, ${links} links, ${stray.length} to no system`);
  const placed = [...u.stellars.values()].filter(sp => u.inSystems.has(sp.id));
  const noSpin = placed.filter(sp => !game.has('spïn', S.novaStellarSpin(sp))), noLand = placed.filter(sp => !game.has('PICT', S.novaLandingPict(sp)));
  const noDesc = placed.filter(sp => !game.has('dësc', S.novaStellarDescId(sp))), noNeb = u.nebulae.filter(n => !n.picts.some(p => game.has('PICT', p.id)));
  if (noSpin.length || noLand.length || noNeb.length) fail(`${g.file}: stellars with no sprite ${noSpin.map(x => x.id)}, no landing picture ${noLand.map(x => x.id)}, nebulae with no picture ${noNeb.map(x => x.id)}`);
  console.log(`${g.file}'s program: ${found.join(', ')}. Its map: ${u.systems.length} systems, ${links} links, ${placed.length} stellars in systems, each with its sprite and landing picture, ${placed.length - noDesc.length} with a description, and ${u.nebulae.length} nebulae with pictures.`);
}
console.log(fails ? `${fails} failed` : 'older games: all passed');
process.exit(fails ? 1 : 0);
