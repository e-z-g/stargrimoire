// js/nova-fieldsites.js: where in the program a record's field is read, the
// line a field note's link rings; and js/nova-program.js's novaOpText, the
// instruction as the Code view shows it.
//
// Held to:
//   - evnova-workbench's tools/fieldtrace.py, written apart from this over
//     Mac 1.1.1's Intel code (otool's disassembly, not mac-ppc.js): every
//     place in the element the two both give for a record's field, in 1.0.10
//     and in 1.1.1's PowerPC half, the same. A type where fieldtrace gives a
//     record offset past the record's end is left out, its reading there
//     not being whole (röid);
//   - fieldtrace's list of the functions that use each place: of the
//     routines a field note links to a line in, in 1.1.1, most are on it
//     (it does not see every use: a place reached by an indexed load, at an
//     element's first byte, or through a pointer handed on), and two bytes
//     off every place, almost none are;
//   - a copy made elsewhere than LoadObjectData (a mission into the
//     missions under way), which fieldtrace does not read: the same routine
//     in 1.0.10 and 1.1.1, compiled apart, copying to the same places;
//   - a record read through the global its handle was kept in: every such
//     global 1.1.1's symbols name, named as a handle (charFileHand), and
//     as many for each type in 1.0.10;
//   - what a routine is handed, a record's place every call to it hands in
//     a register: a register the routine takes as an argument in the other
//     release too, compiled apart;
//   - a copy broken on purpose: one store's displacement changed in 1.0.10's
//     code, the place read from it must change with it, and a check of the
//     places would fail.
// Every instruction of 1.0.10's code as novaOpText shows it must be mac-ppc's
// text (LLVM's) with only the registers named, and every field note link
// that finds no line is counted.
// Needs python3 and otool (Xcode's command-line tools) for fieldtrace;
// without them that part skips.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, ROOT, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

const read = (rel, rsrc) => {
  const file = path.join(REF, rel);
  if (!fs.existsSync(file)) return null;
  const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(file)));
  return { src, prog: S.novaProgram(src.read(), rsrc ? src.readRsrc() : null) };
};
const R1010 = read('game/EV_Nova_1.0.10.sit', true), R111 = read('game/EV_Nova_1.1.1_for_Mac_OS_X.dmg', false);
if (!R1010 || !R111) { console.log('SKIP: 1.0.10 or 1.1.1 not in reference/'); process.exit(0); }

// ---- fieldtrace's reading of the Intel code
const TRACE = path.join(ROOT, '..', 'evnova-workbench', 'tools', 'fieldtrace.py');
let intel = null;
try {
  intel = new Map(S.NOVA_LOADED_TYPES.map(t => {
    const j = JSON.parse(execFileSync('python3', [TRACE, t, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
    return [t, new Map(j.pairs.map(p => [p.record, p]))];
  }));
} catch (e) { console.log(`SKIP fieldtrace: ${String(e.message).split('\n')[0]}`); }

if (intel) {
  for (const [v, prog] of [['1.0.10', R1010.prog], ['1.1.1', R111.prog]]) {
    let same = 0, types = 0;
    for (const [type, mine] of S.novaFieldPlaces(prog)) {
      const theirs = intel.get(type), size = S.novaRecordSize(type) || Infinity;
      if (!theirs || [...theirs.keys()].some(rec => rec >= size)) continue;
      types++;
      for (const [rec, p] of mine.places) {
        if (!theirs.has(rec)) continue;
        if (theirs.get(rec).element === p.off) same++;
        else fail(`${v} ${type}: record byte ${rec} goes to element byte ${p.off} here, ${theirs.get(rec).element} by fieldtrace`);
      }
    }
    if (same < 150) fail(`${v}: only ${same} places both give`);
    console.log(`${v}: ${same} places of ${types} types as fieldtrace gives them`);
  }
  // the routines a note's link rings a line in, and as a control the same
  // routines read two bytes off each field's place: fieldtrace sees only
  // some of the routines that use a place (its header gives which it
  // misses), so the test is that many are listed against the control's few
  const listed = shift => {
    let on = 0, off = 0;
    for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) {
      const theirs = intel.get(type), t = S.novaFieldPlaces(R111.prog).get(type);
      if (!theirs || !t) continue;
      for (const [field, note] of Object.entries(fields)) {
        const recs = (S.novaLayout(type) || []).filter(f => f.name === field).map(f => f.offset);
        const used = new Set(recs.flatMap(rec => (theirs.get(rec) || { used: [] }).used));
        const places = new Set(recs.map(rec => t.places.get(rec)).filter(Boolean).map(p => p.off + shift));
        if (!used.size || !places.size) continue;
        for (const [name] of note.code) {
          const r = S.novaRoutineNamed(R111.prog, name);
          if (!r || name === 'LoadObjectData') continue;
          if (!S.novaRoutineAccesses(R111.prog, r).some(({ a }) => !a.call && a.g === t.g && places.has(a.off))) continue;
          if (used.has(name)) on++; else off++;
        }
      }
    }
    return { on, off };
  };
  const real = listed(0), control = listed(2);
  console.log(`1.1.1: of the routines a note's link rings a line in, ${real.on} fieldtrace lists and ${real.off} it does not; two bytes off the places, ${control.on} and ${control.off}`);
  if (real.on < 150 || real.on < 3 * real.off) fail(`1.1.1: too few of the lines found are in routines fieldtrace lists (${real.on} to ${real.off})`);
  if (control.on * 4 > real.on) fail(`1.1.1: two bytes off the places still finds ${control.on} listed routines, against ${real.on}: the agreement is not the places'`);
}

// ---- copies made elsewhere (a mission into the missions under way, a
// shän into its ship's element): fieldtrace does not read them, so each
// is checked against the other release, compiled apart from the same source: the
// same routine copying the same record must give the same places
{
  const byName = prog => {
    const m = new Map();
    for (const [type, list] of S.novaFieldCopies(prog)) for (const c of list) m.set(type + ' ' + prog.nameOf(prog.byStart.get(c.routine)), c);
    return m;
  };
  const a = byName(R1010.prog), b = byName(R111.prog);
  let same = 0, routines = 0;
  for (const [key, c] of b) {
    const old = a.get(key);
    if (!old) continue;
    routines++;
    for (const [rec, p] of c.places) {
      if (!old.places.has(rec)) continue;
      if (old.places.get(rec).off === p.off) same++;
      else fail(`${key}: record byte ${rec} copied to byte ${p.off} in 1.1.1, ${old.places.get(rec).off} in 1.0.10`);
    }
  }
  console.log(`copies elsewhere: ${same} places the same in 1.0.10 and 1.1.1, over ${routines} routines both name`);
  if (same < 30) fail(`copies elsewhere: only ${same} places compared`);
}

// ---- the globals a record's handle is kept in
{
  // 1.1.1 names its globals: each found must be a handle's (charFileHand),
  // not a value stored where a request found nothing (playerKills)
  const g111 = S.novaHandleGlobals(R111.prog), g1010 = S.novaHandleGlobals(R1010.prog);
  let named = 0;
  for (const [t, gs] of g111) for (const g of gs) {
    const name = R111.prog.globalAt(parseInt(g));
    if (name && /Hand(le)?$/.test(name)) named++;
    else fail(`1.1.1: ${t}'s handle kept in ${g}, named ${name}`);
  }
  for (const [t, gs] of g111) if (g1010.has(t) && g1010.get(t).size !== gs.size) fail(`${t}: ${gs.size} handle globals in 1.1.1, ${g1010.get(t).size} in 1.0.10`);
  if (!g111.has('chär') || !g1010.has('chär')) fail('chär: no handle global found');
  console.log(`handles kept: ${named} globals in 1.1.1, each named as a handle, for ${g111.size} types; ${g1010.size} types in 1.0.10`);
  if (named < 20) fail(`handles kept: only ${named} found`);
}

// ---- a store broken on purpose
{
  const prog = R1010.prog, t = S.novaFieldPlaces(prog).get('spöb'), p = t && t.places.get(6);
  if (!p) fail('1.0.10: spöb Flags (record byte 6) has no place');
  else {
    // the store after the read: the first stw within a few instructions
    const r = prog.routineAt(p.addr), ops = prog.ops(r), i = ops.findIndex(o => o.addr === p.addr);
    const st = ops.slice(i, i + 8).find(o => o.op && o.op.mn === 'stw' && o.op.d === p.off);
    const bytes = R1010.src.read(), want = st && st.word;
    let at = -1;
    for (let k = 0; want !== undefined && k + 4 <= bytes.length; k += 2) {
      if (((bytes[k] << 24) | (bytes[k + 1] << 16) | (bytes[k + 2] << 8) | bytes[k + 3]) >>> 0 !== want) continue;
      // the word, where it sits among the words read before it
      const prev = ops[ops.indexOf(st) - 1].word;
      if ((((bytes[k - 4] << 24) | (bytes[k - 3] << 16) | (bytes[k - 2] << 8) | bytes[k - 1]) >>> 0) === prev) { at = k; break; }
    }
    if (at < 0) fail('1.0.10: the store of spöb Flags not found in the bytes');
    else {
      const bent = bytes.slice();
      bent[at + 3] = (bent[at + 3] + 4) & 255;                    // stw r4, 48(r3) -> 52(r3)
      const prog2 = S.novaProgram(bent, R1010.src.readRsrc()), p2 = S.novaFieldPlaces(prog2).get('spöb').places.get(6);
      if (!p2 || p2.off === p.off) fail(`1.0.10 bent: spöb Flags still read at element byte ${p.off}`);
      else console.log(`1.0.10 bent: spöb Flags moved from element byte ${p.off} to ${p2.off}, as the changed store has it`);
    }
  }
}

// ---- the instruction as shown: LLVM's text with the registers named
{
  const prog = R1010.prog;
  let n = 0, bad = 0;
  for (const r of prog.routines) {
    if (r.glue) continue;
    for (const o of prog.ops(r)) {
      if (!o.op || o.op.branch) continue;
      n++;
      const plain = S.novaOpText(o).replace(/\b[rf](\d+)\b/g, '$1').replace(/\bcr(\d)\b/g, '$1');
      if (plain !== o.op.text && bad++ < 5) fail(`${S.hex(o.addr)}: shown as ${S.novaOpText(o)}, LLVM's ${o.op.text}`);
    }
  }
  console.log(`1.0.10: ${n} instructions shown as LLVM spells them, registers named`);
}

// ---- how many note links find their line
for (const [v, prog] of [['1.0.10', R1010.prog], ['1.1.1', R111.prog]]) {
  let links = 0, found = 0;
  for (const [type, fields] of Object.entries(S.NOVA_FIELD_NOTES)) for (const [field, note] of Object.entries(fields)) for (const [name] of note.code) {
    const r = S.novaRoutineNamed(prog, name);
    if (!r) continue;
    links++;
    if (S.novaFieldSites(prog, r, type, field).length) found++;
  }
  console.log(`${v}: ${found} of ${links} field note links ring the line that reads the field`);
}

// ---- what a routine is handed: the releases, compiled apart, agree on
// which registers of which routines a record's place is handed in
{
  const handed = prog => {
    const out = new Map();
    for (const fields of Object.values(S.NOVA_FIELD_NOTES)) for (const note of Object.values(fields)) for (const [name] of note.code) {
      const r = S.novaRoutineNamed(prog, name), h = r && S.novaHandedIn(prog, r);
      if (h) out.set(name, [...h.keys()].join(','));
    }
    return out;
  };
  const a = handed(R1010.prog), b = handed(R111.prog);
  let same = 0;
  for (const [name, regs] of b) if (a.has(name) && a.get(name) === regs) same++;
  // a register handed in, in either release, the routine takes as an argument in the other too
  for (const [mine, other, v, w] of [[a, R111.prog, '1.0.10', '1.1.1'], [b, R1010.prog, '1.1.1', '1.0.10']]) for (const [name, regs] of mine) {
    const r = S.novaRoutineNamed(other, name);
    if (!r) continue;
    const used = S.novaArgsRead(other, r);
    for (const reg of regs.split(',')) if (!used.has(+reg)) fail(`${name}: handed a record's place in r${reg} in ${v}, which it does not take in ${w}`);
  }
  console.log(`handed in: ${same} cited routines handed a record's place in the same registers in 1.0.10 and 1.1.1 (${a.size} and ${b.size} in all), each register an argument in both`);
  if (same < 10) fail(`handed in: only ${same} routines agree`);
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('ok');
