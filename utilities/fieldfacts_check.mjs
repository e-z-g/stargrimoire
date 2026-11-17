// js/nova-fieldfacts.js: what the program does with a field, worked out from
// its code; and the field notes' bits held to it.
//
// Held to:
//   - every bit a note gives for its field (not one written after another
//     field's name, "shïp Flags 0x0400") is tested by the program, unless
//     the note states that the program does not read it, and every bit the
//     program tests is in the note, in 1.0.10 and in 1.1.1, compiled apart.
//     A half word read signed and compared with 0 counts as 0x8000 in a field
//     of flags. The types in RECONCILED fail on any difference, and the rest
//     are listed until each is read again;
//   - a control: shïp Flags' note with 0x0020 taken out must fail.
import fs from 'node:fs';
import path from 'node:path';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

const RECONCILED = new Set(['shïp', 'shän', 'përs', 'crön', 'flët', 'jünk', 'chär']);
const read = (rel, rsrc) => {
  const file = path.join(REF, rel);
  if (!fs.existsSync(file)) return null;
  const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(file)));
  return S.novaProgram(src.read(), rsrc ? src.readRsrc() : null);
};
const P1010 = read('game/EV_Nova_1.0.10.sit', true), P111 = read('game/EV_Nova_1.1.1_for_Mac_OS_X.dmg', false);
if (!P1010 || !P111) { console.log('SKIP: 1.0.10 or 1.1.1 not in reference/'); process.exit(0); }

// every field name of every type, since a bit written after another field's name is that field's
const NAMES = new Set(Object.keys(S.NOVA_RECORDS).flatMap(t => (S.novaLayout(t) || []).map(f => f.name)));
function named(text, field) {
  const out = new Set();
  // the field a bit belongs to: the name before it, carried on through "and", "or", "to" and commas ("Flags 0x0001 and 0x0002")
  let owner = field;
  for (const m of text.matchAll(/(\S+)? ?0x([0-9a-f]{4})\b(?: to 0x([0-9a-f]{4}))?/gi)) {
    const before = m[1] ? m[1].replace(/[^A-Za-z0-9]/g, '') : '';
    if (before && NAMES.has(before)) owner = before;
    else if (!/^(and|or|to|,)$/.test(before) && !(m[1] || '').endsWith(',')) owner = field;
    if (owner !== field) continue;
    const a = parseInt(m[2], 16), b = m[3] ? parseInt(m[3], 16) : a;
    for (let v = a; v && v <= b; v <<= 1) out.add(v);
  }
  return out;
}
const unread = text => new Set([...text.matchAll(/reads neither (0x[0-9a-f]{4}) nor (0x[0-9a-f]{4})|does not read (0x[0-9a-f]{4})/gi)].flatMap(m => m.slice(1).filter(Boolean).map(h => parseInt(h, 16))));
const hex = v => '0x' + v.toString(16).padStart(4, '0');

// a note against the program: { missing, extra }, the bits in the note the program never tests, and the tested bits the note lacks
function differ(prog, type, field, text) {
  const want = named(text, field);
  if (!want.size) return null;
  const f = S.novaFieldFacts(prog, type, field);
  if (!f) return { missing: [...want], extra: [], none: true };
  const tested = new Set();
  for (const m of f.bits.keys()) for (let b = 1; b <= 0x8000; b <<= 1) if (m & b) tested.add(b);
  if (f.compares.has(0) && want.size > 2) tested.add(0x8000);
  const skip = unread(text);
  return { missing: [...want].filter(b => !tested.has(b) && !skip.has(b)), extra: [...tested].filter(b => !want.has(b)) };
}

let same = 0, held = 0;
const open = [];
for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) for (const [field, note] of Object.entries(fields)) {
  for (const [v, prog] of [['1.0.10', P1010], ['1.1.1', P111]]) {
    const d = differ(prog, type, field, note.note);
    if (!d) continue;
    if (!d.missing.length && !d.extra.length) { same++; if (RECONCILED.has(type)) held++; continue; }
    const say = `${v} ${type} ${field}${d.none ? ' (no place found)' : ''}${d.missing.length ? ` names ${d.missing.map(hex).join(' ')}, never tested` : ''}${d.extra.length ? ` leaves out ${d.extra.map(hex).join(' ')}, which the program tests` : ''}`;
    if (RECONCILED.has(type)) fail(say); else open.push(say);
  }
}

// the control: a bit taken out of shïp Flags' note
const flags = S.NOVA_FIELD_NOTES['shïp'].Flags.note, bent = flags.replace(/0x0020/g, '0x00ff');
const d = differ(P111, 'shïp', 'Flags', bent);
if (bent === flags || !d || !d.extra.includes(0x20)) fail('the control: shïp Flags\' note without 0x0020 passed');

console.log(`The field notes' bits against the program's tests. ${same} notes match in a release (${held} of the reconciled types), ${open.length} differences are open in the other types, and the control was found.`);
for (const o of open) console.log('  open: ' + o);
if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('ok');
