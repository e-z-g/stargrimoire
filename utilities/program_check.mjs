// js/nova-program.js: the game's program read out of each Mac release's
// archive, its routines, its calls into the system, and the figures the
// pages read from it.
//
// Held to:
//   - the PEF loader's own list of imports: every transition vector the
//     program imports has its glue found and named, and no glue names
//     anything else;
//   - LLVM's PowerPC disassembler (llvm-mc --disassemble --triple=powerpc),
//     separate from mac-ppc.js: the word at each figure's address,
//     disassembled there, holds the figure's value;
//   - the workbench's own layout of 1.0.10's code (tools/pefreloc_nova.py,
//     written apart from this): the description loader it found at
//     0x12ce10 (js/nova-ships.js cites it) is where the reader finds it;
//   - each other: every figure is found in every release, the same value
//     at a different address, as code read by its shape should be.
// Then a word changed on purpose: the figure read from it must change or
// go. Needs llvm-mc (brew install llvm); without it that part skips.
//
// 1.1.1's Mach-O program, its PowerPC half, is held to llvm-nm (every
// routine its symbols name, by name and address) and llvm-objdump's
// indirect symbols (every stub named), and each of its figures to LLVM's
// reading of the word and to the value the site's own code uses; every
// routine a field note cites must be there by name. What the program loads
// by number (novaProgramUses), in 1.0.10 and 1.1.1: every number's word as
// LLVM reads it, and the dialogs' backgrounds each loaded by its dialog.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

const ARCHIVES = { '1.0.2': 'game/EV_Nova_1.0.2.sit', '1.0.8': 'game/EV_Nova_1.0.8.sit', '1.0.8 update': 'game/EV_Nova_1.0.8_Update.sit', '1.0.10': 'game/EV_Nova_1.0.10.sit' };
const LLVM = ['/opt/homebrew/opt/llvm/bin/llvm-mc', '/usr/local/opt/llvm/bin/llvm-mc'].find(p => fs.existsSync(p));
const llvm = words => execFileSync(LLVM, ['--disassemble', '--triple=powerpc'], { input: words.map(w => '0x' + [24, 16, 8, 0].map(k => ((w >>> k) & 255).toString(16).padStart(2, '0')).join(' 0x')).join('\n') + '\n' })
  .toString().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('.text'));

const figures = Object.keys(S.NOVA_FIGURES).filter(n => n !== 'descLoader');
const seen = new Map();
let read = 0;
for (const [v, rel] of Object.entries(ARCHIVES)) {
  const file = path.join(REF, rel);
  if (!fs.existsSync(file)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(file)));
  if (!src) { fail(`${v}: no program found in the archive`); continue; }
  const bytes = src.read(), rsrc = src.readRsrc();
  const t0 = Date.now(), prog = S.novaProgram(bytes, rsrc), ms = Date.now() - t0;
  if (!prog) { fail(`${v}: ${src.name} does not read as a PEF program`); continue; }
  read++;
  // the imports: every transition vector named, by its glue, and nothing else
  const tvs = new Set(prog.img.pef.loader.symbols.filter(s => s.classCode === 2).map(s => s.name));
  const glue = new Set(prog.routines.filter(r => r.glue).map(r => r.name));
  const missing = [...tvs].filter(n => !glue.has(n)), extra = [...glue].filter(n => !tvs.has(n));
  if (extra.length) fail(`${v}: glue naming what is not an imported transition vector: ${extra.slice(0, 5).join(', ')}`);
  const dialogs = S.novaDialogRoutines(prog);
  if (!dialogs.some(d => d.name === 'Outfit') || !dialogs.some(d => d.name === 'Shipyard')) fail(`${v}: the Outfit and Shipyard dialogs' routines not found`);
  const got = {};
  for (const name of [...figures, 'descLoader']) {
    const f = S.novaFigure(prog, name, null);
    if (!f) { fail(`${v}: ${name} not found`); continue; }
    got[name] = f;
    if (!seen.has(name)) seen.set(name, []);
    seen.get(name).push({ v, f });
    const r = prog.routineAt(f.addr);
    if (!r || r.start !== f.routine) fail(`${v}: ${name} at ${S.hex(f.addr)} is not in the routine it names`);
    if (name !== 'descLoader') figureHeld(v, prog, name, f);
  }
  if (v === '1.0.10') usesCheck(v, prog);
  if (v === '1.0.10' && got.descLoader && got.descLoader.routine !== 0x12ce10) fail(`1.0.10: the description loader at ${S.hex(got.descLoader.routine)}, where the workbench has 0x12ce10`);
  console.log(`${v}: ${src.name}, ${prog.routines.filter(r => !r.glue).length} routines and ${glue.size} calls into the system in ${ms} ms (${tvs.size - missing.length} of the ${tvs.size} imported routines called); ${dialogs.length} dialogs' routines named; ` +
    figures.filter(n => got[n]).map(n => `${n} ${got[n].value} at ${S.hex(got[n].addr)}`).join(', '));
  // a word changed on purpose: the figure must not survive it
  if (v === '1.0.10' && got.outfitDesc) {
    const off = got.outfitDesc.addr - S.NOVA_CODE_BASE, codeAt = prog.img.pef.sections.find(s => s.kind === 0).containerOffset;
    const broken = bytes.slice(); broken[codeAt + off + 3] ^= 0x01;   // the immediate one off
    const again = S.novaFigure(S.novaProgram(broken, rsrc), 'outfitDesc', null);
    if (again && again.value === got.outfitDesc.value) fail('1.0.10: outfitDesc read the same from a changed word');
    for (const name of ['landingPict', 'shotSpin', 'combatRatings', 'explodSnd', 'missionOffer']) {
      const f = got[name];
      if (!f) continue;
      const a = Array.isArray(f.value) ? f.addrs[3] : f.addr, b2 = bytes.slice();
      b2[codeAt + a - S.NOVA_CODE_BASE + 3] ^= 0x01;
      const g = S.novaFigure(S.novaProgram(b2, rsrc), name, null);
      if (g && JSON.stringify(g.value) === JSON.stringify(f.value)) fail(`1.0.10: ${name} read the same from a changed word`);
    }
  }
}
for (const [name, list] of seen) {
  const values = new Set(list.map(x => JSON.stringify(x.f.value)));
  if (name !== 'descLoader' && values.size !== 1) fail(`${name}: different values in different releases: ${list.map(x => `${x.v} ${x.f.value}`).join(', ')}`);
  if (name !== 'descLoader' && list.length !== read) fail(`${name}: found in ${list.length} of ${read} releases`);
}

{ const only = Object.keys(S.NOVA_MACHO_FIGURES).filter(n => !(n in S.NOVA_FIGURES)); if (only.length) fail(`read from 1.1.1 but not from 1.0.x: ${only.join(', ')}`); }

// ---- 1.1.1, the PowerPC half of its Mach-O program
const DMG = path.join(REF, 'game/EV_Nova_1.1.1_for_Mac_OS_X.dmg');
if (!fs.existsSync(DMG)) console.log('SKIP 1.1.1: not in reference/');
else {
  const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(DMG)));
  const bytes = src && src.read();
  const t0 = Date.now(), prog = bytes && S.novaProgram(bytes, null), ms = Date.now() - t0;
  if (!prog || prog.kind !== 'macho') fail('1.1.1: the program does not read as Mach-O');
  else {
    const BIN = path.dirname(LLVM || '');
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nova-macho-')), 'EV Nova');
    fs.writeFileSync(tmp, bytes);
    if (LLVM) {
      // llvm-nm: the routines' names and addresses
      const nm = execFileSync(path.join(BIN, 'llvm-nm'), ['--arch=ppc', '--defined-only', tmp]).toString().split('\n')
        .map(l => /^([0-9a-f]+) [tT] (.+)$/.exec(l)).filter(Boolean).map(m => [parseInt(m[1], 16), m[2].replace(/^_/, '')]);
      let bad = 0;
      for (const [a, n] of nm) { const r = prog.byStart.get(a); if (!r || r.glue || (r.name !== n && !nm.some(([b, m]) => b === a && m === r.name))) { if (bad++ < 5) fail(`1.1.1: llvm-nm has ${n} at ${S.hex(a)}, the page ${r ? r.name : 'nothing'}`); } }
      const ours = prog.routines.filter(r => r.name && !r.glue);
      if (ours.length !== new Set(nm.map(([a]) => a)).size) fail(`1.1.1: ${ours.length} named routines, llvm-nm ${new Set(nm.map(([a]) => a)).size} addresses`);
      // llvm-objdump: every stub's import
      const stubs = execFileSync(path.join(BIN, 'llvm-objdump'), ['--macho', '--indirect-symbols', '--arch=ppc', tmp]).toString();
      const sect = stubs.split(/Indirect symbols for /).find(x => x.startsWith('(__TEXT,__symbol_stub'));
      const want = sect ? sect.split('\n').map(l => /^0x([0-9a-f]+)\s+\d+\s+_(\S+)$/.exec(l.trim())).filter(Boolean) : [];
      let sb = 0;
      for (const m of want) { const r = prog.byStart.get(parseInt(m[1], 16)); if (!r || !r.glue || r.name !== m[2]) { if (sb++ < 5) fail(`1.1.1: the stub at 0x${m[1]} is ${m[2]}, the page ${r ? r.name : 'nothing'}`); } }
      if (!want.length) fail('1.1.1: llvm-objdump listed no stubs');
      console.log(`1.1.1: ${ours.length} routines named as llvm-nm names them, ${want.length} stubs as llvm-objdump names them, read in ${ms} ms`);
    }
    // every routine a field note cites
    const cited = new Set();
    for (const t of Object.values(S.NOVA_FIELD_NOTES)) for (const f of Object.values(t)) for (const [n] of f.code) cited.add(n);
    const missing = [...cited].filter(n => !S.novaRoutineNamed(prog, n));
    if (missing.length) fail(`1.1.1: field notes cite routines not in the PowerPC half: ${missing.join(', ')}`);
    // the figures
    const got = {};
    for (const name of Object.keys(S.NOVA_MACHO_FIGURES)) {
      const f = S.novaFigure(prog, name, null);
      if (!f) { fail(`1.1.1: ${name} not found`); continue; }
      got[name] = f;
      if (name === 'descLoader') continue;
      figureHeld('1.1.1', prog, name, f);
    }
    usesCheck('1.1.1', prog);
    console.log(`1.1.1: ${cited.size} routines the field notes cite, all there; ` + Object.entries(got).filter(([n]) => n !== 'descLoader').map(([n, f]) => `${n} ${f.value} in ${prog.nameOf(prog.routineAt(f.addr))}`).join(', '));
    // a word changed on purpose: the figure must not survive it
    for (const name of ['missionOffer', 'landingPict']) {
      if (!got[name]) continue;
      const broken = bytes.slice(), at = fileOffset(bytes, got[name].addr);
      broken[at + 3] ^= 0x01;
      const again = S.novaFigure(S.novaProgram(broken, null), name, null);
      if (again && again.value === got[name].value) fail(`1.1.1: ${name} read the same from a changed word`);
    }
  }
}
// A figure's word as LLVM reads it (a list's words are comparisons, each holding
// its number or one less; a rule's word is not a number), its words for the
// Code view, and the site's own value where it has one.
function figureHeld(v, prog, name, f) {
  const each = Array.isArray(f.value) ? f.value.map((x, i) => [f.addrs[i], x]).filter(([a]) => a !== null) : [[f.addr, f.value]];
  if (LLVM && typeof f.value !== 'string') for (const [a, x] of each) {
    const w = prog.ops(prog.routineAt(a)).find(o => o.addr === a).word, text = llvm([w])[0] || '';
    const holds = n => new RegExp(`(^|[ ,])${n}($|[ ,(])`).test(text);
    if (!holds(x) && !(Array.isArray(f.value) && holds(x - 1))) fail(`${v}: ${name}: LLVM reads the word at ${S.hex(a)} as "${text}", not holding ${x}`);
  }
  const words = S.NOVA_FIGURE_WORDS[name];
  if (!words) fail(`${v}: ${name} has no words for the Code view`);
  else if (words[1] && JSON.stringify(words[1]()) !== JSON.stringify(f.value)) fail(`${v}: ${name}: the program has ${f.value}, the site's own code ${words[1]()}`);
}

// What a program loads by number: each word holds its number as LLVM reads it;
// the outfitter's background is loaded where its dialog is opened.
function usesCheck(v, prog) {
  const u = S.novaProgramUses(prog, null);
  let n = 0, bad = 0;
  for (const [key, list] of u.fixed) for (const x of list) {
    n++;
    const num = Number(key.split(' ').pop()), w = prog.ops(prog.routineAt(x.addr)).find(o => o.addr === x.addr).word;
    if (LLVM) { const text = llvm([w])[0] || ''; if (!new RegExp(`(^|[ ,])${num}($|[ ,(])`).test(text) && bad++ < 5) fail(`${v}: ${key} read at ${S.hex(x.addr)}, where LLVM has "${text}"`); }
  }
  const outfit = u.fixed.get('PICT 8502') || [], named = S.novaNamedRoutines(prog, null);
  const by = outfit.map(x => (named.find(m => m.routine && m.routine.start === x.routine) || {}).name);
  if (!by.some(b => b === 'DoOutfitDialog' || b === 'Opens "Outfit"')) fail(`${v}: PICT 8502 not loaded where the outfitter opens: ${JSON.stringify(by)}`);
  if (u.fixed.size < 50) fail(`${v}: only ${u.fixed.size} resources loaded by number`);
  console.log(`${v}: ${u.fixed.size} resources the program loads by number, at ${n} places, each word as LLVM reads it, and ${u.bases.length} bases; PICT 8502 loaded by ${by.join(', ')}`);
}

// A Mach-O PowerPC half's file offset for an address, from its segments.
function fileOffset(b, addr) {
  const u = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  let base = 0;
  if (u(0) === 0xCAFEBABE) for (let i = 0; i < u(4); i++) if (u(8 + 20 * i) === 18) base = u(8 + 20 * i + 8);
  for (let i = 0, p = base + 28; i < u(base + 16); i++) {
    if (u(p) === 1) { const vm = u(p + 24), fo = u(p + 32), fs = u(p + 36); if (addr >= vm && addr < vm + fs) return base + fo + addr - vm; }
    p += u(p + 4);
  }
  return -1;
}

if (!LLVM) console.log('SKIP llvm-mc: not installed (brew install llvm)');
console.log(fails ? `${fails} failures` : 'program read: every figure in every release, as LLVM reads the words');
process.exit(fails ? 1 : 0);
