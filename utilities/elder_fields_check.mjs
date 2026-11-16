// The field notes for Escape Velocity and EV Override
// (js/nova-elder-fields.js) against the two installers in reference/.
//
//   1. Every address a note cites is a whole instruction inside a routine
//      of that game's program, and not in a routine that only calls the
//      system.
//   2. Every field of every template that has records has a note in that
//      game, and every note is of a field one of the templates has.
//   3. The controls: an address moved out of the code, one moved off an
//      instruction's start, a note taken away and a note of no field are
//      each counted as a failure by the same tests.
import fs from 'node:fs';
import path from 'node:path';
import { site, REF } from './load.mjs';

const S = site();
const INST = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Installers');
const GAMES = [['ev', 'Escape_Velocity.bin'], ['evo', 'EVOverride.bin']];
if (!GAMES.every(([, f]) => fs.existsSync(path.join(INST, f)))) { console.log('SKIP the EV and EV Override installers are not in reference/'); process.exit(0); }

const open = GAMES.map(([kind, file]) => {
  const inner = S.novaArchiveIn(new Uint8Array(fs.readFileSync(path.join(INST, file))));
  const game = S.novaGame();
  for (const f of S.novaArchiveFiles(inner)) game.add(f, f.read());
  const src = S.novaArchiveProgram(inner);
  return { kind, game, prog: S.novaProgram(src.read(), src.readRsrc()) };
});

// What is wrong with a set of notes, as a list of sentences.
function faults(NOTES) {
  const out = [];
  let cited = 0, fields = 0;
  for (const { kind, game, prog } of open) {
    const at = (where, q) => {
      for (const a of q[kind] || []) {
        cited++;
        const r = prog.routineAt(a);
        if (!r) out.push(`${kind} ${where}: ${S.hex(a)} is in no routine`);
        else if (r.glue) out.push(`${kind} ${where}: ${S.hex(a)} is in a routine that only calls the system`);
        else if ((a - r.start) % 4) out.push(`${kind} ${where}: ${S.hex(a)} is not the start of an instruction`);
      }
    };
    const had = new Set();
    for (const type of game.types()) {
      const table = type === 'TMPL' ? null : game.table(type);
      if (!table || !game.list(type).length) continue;
      for (const [name, k] of table) {
        if (k === 'pad') continue;
        fields++;
        const notes = NOTES[type] || {};
        const key = notes[name] ? name : name.replace(/\s*\d+$/, '');
        const o = notes[key];
        if (!o || !(o.unread || o[kind])) out.push(`${kind} ${type} ${name} has no note`);
        else had.add(type + ' ' + key);
      }
    }
    for (const [type, notes] of Object.entries(NOTES)) for (const [f, o] of Object.entries(notes)) {
      if (o[kind] && !had.has(type + ' ' + f)) out.push(`${kind} ${type} ${f} is a note of no field in the template`);
      at(`${type} ${f}`, o);
      for (const k of ['bits', 'values']) for (const [b, q] of Object.entries(o[k] || {})) {
        at(`${type} ${f} ${b}`, q);
        if (q[kind] && !q.note && !q[kind + 'Note']) out.push(`${kind} ${type} ${f} ${b} has addresses and no text`);
      }
      if (o[kind] && !o.note && !o[kind + 'Note']) out.push(`${kind} ${type} ${f} has addresses and no text`);
    }
  }
  return { out, cited, fields };
}

let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const real = faults(S.ELDER_FIELD_NOTES);
for (const m of real.out) fail(m);

// the page's lookup gives each game its text and addresses
const n = S.elderFieldNote('evo', 'sÿst', 'Con3'), m = S.elderFieldNote('ev', 'mïsn', 'Flags');
if (!n || !n.at.length || !/jump/.test(n.text)) fail('Override sÿst Con3 does not find the note of Con');
if (!m || !m.bits.some(([b]) => b === 0x1000) || m.bits.some(([b]) => b === 0x2000)) fail('EV mïsn Flags does not have its bits and only its bits');
if (S.elderFieldNote('ev', 'mïsn', 'StartBitSet')) fail('EV has a note for a field only Override has');

// the controls
const bent = change => { const c = JSON.parse(JSON.stringify(S.ELDER_FIELD_NOTES)); change(c); return faults(c).out.length; };
const controls = [
  ['an address outside the code', c => { c['mïsn'].PayVal.ev[0] = 0x10; }],
  ['an address two bytes into an instruction', c => { c['sÿst'].Con.evo[0] += 2; }],
  ['a note taken away', c => { delete c['spïn'].xTiles; }],
  ['a note of no field', c => { c['gövt'].Nonesuch = { note: 'x', ev: c['gövt'].Flags.ev }; }],
  ['a bit\'s address outside the code', c => { c['mïsn'].Flags.bits[1].evo[0] = 0x7fffff00; }],
];
for (const [what, change] of controls) if (bent(change) <= real.out.length) fail(`the control did not fail: ${what}`);

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log(`ok: ${real.cited} addresses and ${real.fields} template fields in the two games, and ${controls.length} controls that fail`);
