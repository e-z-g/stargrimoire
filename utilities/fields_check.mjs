// The field notes in js/nova-fields.js, each held to the program they were
// read from: every field is one its type's table names, and every routine a
// note cites is a function Mac 1.1.1's Intel code names, at that address
// (`nm`, over reference/'s copy of the program). A routine named wrongly, or
// at another address, fails; that is first shown on a routine moved on purpose.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF, RELEASES, haveRelease, openRelease } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const PROG = path.join(REF, 'unpacked/game/EV_Nova_1.1.1_for_Mac_OS_X/EV Nova/EV Nova.app/Contents/MacOS/EV Nova');
if (!fs.existsSync(PROG)) { console.log('SKIP: no Mac 1.1.1 program in reference/unpacked'); process.exit(0); }
const syms = new Map();
for (const line of execFileSync('nm', ['-arch', 'i386', PROG], { maxBuffer: 1 << 26 }).toString().split('\n')) {
  const p = line.trim().split(/\s+/);
  if (p.length === 3 && /^[tT]$/.test(p[1])) syms.set(p[2].replace(/^_/, ''), parseInt(p[0], 16));
}
const held = (name, at) => syms.get(name) === at;
if (!held('ApplyGravity', 0x7c5a) || held('ApplyGravity', 0x7c5b) || held('NoSuchRoutine', 0x7c5a)) fail('the symbol test cannot tell a right routine from a wrong one');

let notes = 0, cites = 0;
for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) {
  const table = S.NOVA_RECORDS[type];
  if (!table) { fail(`${type}: no record table`); continue; }
  for (const [field, n] of Object.entries(fields)) {
    notes++;
    if (!table.some(f => f[0] === field)) fail(`${type} ${field}: not a field of its table`);
    if (!n.note || !n.code || !n.code.length) fail(`${type} ${field}: a note with no routine`);
    if ('bible' in n && (typeof n.bible !== 'string' || !n.bible)) fail(`${type} ${field}: a bible line with no words`);
    for (const [name, at] of n.code || []) {
      cites++;
      if (!held(name, at)) fail(`${type} ${field}: ${name} is ${syms.has(name) ? 'at 0x' + syms.get(name).toString(16) : 'not a routine'} in the program, not 0x${at.toString(16)}`);
    }
  }
}
console.log(`${notes} field notes, ${cites} routines cited, each a routine of Mac 1.1.1 at its address`);

// Each note has its few words (NOVA_FIELD_SHORT), and no few words stand for a note that is not there.
for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) for (const field of Object.keys(fields)) {
  const w = S.novaFieldShort(type, field);
  if (typeof w !== 'string' || !w) fail(`${type} ${field}: a note with no few words`);
  else if (w.split(/\s+/).length > 8) fail(`${type} ${field}: "${w}" is more than a few words`);
}
for (const [type, fields] of Object.entries(S.NOVA_FIELD_SHORT)) for (const field of Object.keys(fields))
  if (!S.novaFieldNote(type, field)) fail(`${type} ${field}: few words with no note`);

// The fields nova-bits.js reads are those whose note says they are a test of control bits or control bits set.
const bitFields = new Map();
for (const [type, , fields] of S.NOVA_BIT_SOURCES) for (const [field, how] of fields) if (how !== 'desc') bitFields.set(`${type} ${field}`, how);
for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) for (const [field, n] of Object.entries(fields)) {
  const how = /^A test of control bits/.test(n.note) ? 'test' : /^Control bits set/.test(n.note) ? 'set' : null, k = `${type} ${field}`;
  if (how && bitFields.get(k) !== how) fail(`${k}: its note says it is a ${how === 'test' ? 'test' : 'set expression'}, and nova-bits.js reads it ${bitFields.has(k) ? 'as a ' + bitFields.get(k) : 'not at all'}`);
  if (!how && bitFields.has(k)) fail(`${k}: nova-bits.js reads it as a ${bitFields.get(k)}, and its note does not say so`);
}
for (const k of bitFields.keys()) { const [type, field] = k.split(' '); if (!S.novaFieldNote(type, field)) fail(`${k}: nova-bits.js reads it, and it has no note`); }
console.log(`${bitFields.size} fields of control bits, each as its note says`);

// Every reading (NOVA_FIELD_READS) run over every record of its type in every
// release: each must give words, for a field its table names. What the shipped
// records come to is counted where it is worth knowing: codes the program reads
// as never offered or as where the mission is accepted, records named that are
// not in the files, flag bits no use of was found for.
const WATCH = /never offered|where it is accepted|not in the files|no use found|no landing finishes it|no such string|hangs the game|nothing reads it/;
let reads = 0;
for (const [type, fields] of Object.entries(S.NOVA_FIELD_READS)) for (const field of Object.keys(fields))
  if (!S.NOVA_RECORDS[type].some(f => f[0] === field)) fail(`${type} ${field}: a reading for a field not in its table`);
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v, null);
  const seen = new Map();
  for (const [type, fields] of Object.entries(S.NOVA_FIELD_READS)) for (const rec of S.novaAll(game, type)) for (const field of Object.keys(fields)) {
    let t;
    try { t = S.novaFieldRead(game, type, field, rec); } catch (e) { fail(`${v} ${type} ${rec.id} ${field}: ${e.message}`); continue; }
    reads++;
    if (typeof t !== 'string' || !t) { fail(`${v} ${type} ${rec.id} ${field}: no words for ${rec[field]}`); continue; }
    const m = WATCH.exec(t);
    if (m) { const k = `${type} ${field}: ${m[0]}`; if (!seen.has(k)) seen.set(k, []); seen.get(k).push(rec.id); }
  }
  for (const [k, ids] of [...seen].sort()) console.log(`  ${v}: ${k} in ${ids.length} (${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ', …' : ''})`);
}
console.log(`${reads} readings of the shipped records, each in words`);
process.exit(fails ? 1 : 0);
