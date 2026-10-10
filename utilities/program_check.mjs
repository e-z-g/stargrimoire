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
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

const ARCHIVES = { '1.0.2': 'game/EV_Nova_1.0.2.sit', '1.0.8': 'game/EV_Nova_1.0.8.sit', '1.0.8 update': 'game/EV_Nova_1.0.8_Update.sit', '1.0.10': 'game/EV_Nova_1.0.10.sit' };
const LLVM = ['/opt/homebrew/opt/llvm/bin/llvm-mc', '/usr/local/opt/llvm/bin/llvm-mc'].find(p => fs.existsSync(p));
const llvm = words => execFileSync(LLVM, ['--disassemble', '--triple=powerpc'], { input: words.map(w => '0x' + [24, 16, 8, 0].map(k => ((w >>> k) & 255).toString(16).padStart(2, '0')).join(' 0x')).join('\n') + '\n' })
  .toString().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('.text'));

const figures = Object.keys(S.NOVA_FIGURE_WORDS);
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
    if (LLVM && name !== 'descLoader') {
      const w = prog.ops(r).find(o => o.addr === f.addr).word, text = llvm([w])[0] || '';
      if (!new RegExp(`(^|[ ,])${f.value}($|[ ,(])`).test(text)) fail(`${v}: ${name}: LLVM reads the word at ${S.hex(f.addr)} as "${text}", not holding ${f.value}`);
    }
  }
  if (v === '1.0.10' && got.descLoader && got.descLoader.routine !== 0x12ce10) fail(`1.0.10: the description loader at ${S.hex(got.descLoader.routine)}, where the workbench has 0x12ce10`);
  console.log(`${v}: ${src.name}, ${prog.routines.filter(r => !r.glue).length} routines and ${glue.size} calls into the system in ${ms} ms (${tvs.size - missing.length} of the ${tvs.size} imported routines called); ${dialogs.length} dialogs' routines named; ` +
    figures.filter(n => got[n]).map(n => `${n} ${got[n].value} at ${S.hex(got[n].addr)}`).join(', '));
  // a word changed on purpose: the figure must not survive it
  if (v === '1.0.10' && got.outfitDesc) {
    const off = got.outfitDesc.addr - S.NOVA_CODE_BASE, codeAt = prog.img.pef.sections.find(s => s.kind === 0).containerOffset;
    const broken = bytes.slice(); broken[codeAt + off + 3] ^= 0x01;   // the immediate one off
    const again = S.novaFigure(S.novaProgram(broken, rsrc), 'outfitDesc', null);
    if (again && again.value === got.outfitDesc.value) fail('1.0.10: outfitDesc read the same from a changed word');
  }
}
for (const [name, list] of seen) {
  const values = new Set(list.map(x => x.f.value));
  if (name !== 'descLoader' && values.size !== 1) fail(`${name}: different values in different releases: ${list.map(x => `${x.v} ${x.f.value}`).join(', ')}`);
  if (name !== 'descLoader' && list.length !== read) fail(`${name}: found in ${list.length} of ${read} releases`);
}
if (!LLVM) console.log('SKIP llvm-mc: not installed (brew install llvm)');
console.log(fails ? `${fails} failures` : 'program read: every figure in every release, as LLVM reads the words');
process.exit(fails ? 1 : 0);
