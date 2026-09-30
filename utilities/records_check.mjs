// The record tables in js/nova-records.js, held to two sources that are not
// this repository:
//
//   1. LAYOUT. Ambrosia's ResEdit templates, the `Templates` file in 1.0.10's
//      Documentation folder: every field's offset and width, and each table's
//      total, which must also be the size of every record of that type the
//      game ships.
//   2. VALUES. The ConText dump of 1.1.1 in evnova-utils
//      (Context/NovaConText.txt): every record of every type both have, read
//      from 1.1.1's own files by our tables, field for field.
//
// A field the dump does not have is listed, not failed; a column the dump has
// and the tables do not is a failure.
import fs from 'node:fs';
import path from 'node:path';
import { site, openRelease, haveRelease, releaseFiles, REF, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// ---- 1. layout against Ambrosia's TMPL ----------------------------------
function templates() {
  if (!haveRelease('1.0.10')) return null;
  const sit = new Uint8Array(fs.readFileSync(path.join(REF, RELEASES['1.0.10'].sit)));
  const cat = S.parseStuffItArchive(sit);
  const e = (cat.entries || cat).find(x => /\/Documentation\/Templates$/.test(x.path || ''));
  if (!e) return null;
  const fork = S.openResourceFork(S.stuffItFork(sit, e, 'rsrc'));
  const out = new Map();
  for (const r of fork.resourcesByType['TMPL'] || []) {
    const d = fork.dataOf('TMPL', r), fields = [];
    for (let p = 0; p < d.length;) {
      const label = S.decodeMacRoman(d.subarray(p + 1, p + 1 + d[p])); p += 1 + d[p];
      const code = S.decodeMacRoman(d.subarray(p, p + 4)); p += 4;
      fields.push({ label, code });
    }
    out.set(r.name, fields);
  }
  return out;
}

// Both sides as runs of { offset, size, cls }: word, long, str, cstr, pad,
// with the templates' consecutive Unused words merged into one pad.
function tmplRuns(fields) {
  const runs = [];
  let off = 0;
  for (const { label, code } of fields) {
    let size, cls;
    if (code === 'DWRD' || code === 'HWRD') { size = 2; cls = 'word'; }
    else if (code === 'DLNG' || code === 'HLNG') { size = 4; cls = 'long'; }
    else if (code === 'CSTR') { runs.push({ offset: off, size: null, cls: 'cstr', label }); off = null; break; }
    else if (code === 'RECT') { for (let i = 0; i < 4; i++, off += 2) runs.push({ offset: off, size: 2, cls: 'word', label: label + '[' + i + ']' }); continue; }
    else if (/^C[0-9A-F]{3}$/.test(code)) { size = parseInt(code.slice(1), 16); cls = 'str'; }
    else throw new Error(`template code ${code} (${label}) is not one this check reads`);
    if (/^Unused$/i.test(label)) {
      const last = runs[runs.length - 1];
      if (last && last.cls === 'pad') last.size += size; else runs.push({ offset: off, size, cls: 'pad', label });
    } else runs.push({ offset: off, size, cls, label });
    off += size;
  }
  return runs;
}
function ourRuns(type) {
  return S.novaLayout(type).map(f => ({
    offset: f.offset, size: f.size, label: f.name + (f.index === null ? '' : '[' + f.index + ']'),
    cls: f.kind === 'cstr' ? 'cstr' : f.kind === 'str' ? 'str' : f.kind === 'pad' ? 'pad' : f.size === 2 ? 'word' : 'long',
  }));
}

const tm = templates();
if (!tm) console.log('SKIP layout: no 1.0.10 release with its Templates file in reference/game');
else {
  let n = 0;
  for (const type of Object.keys(S.NOVA_RECORDS)) {
    const t = tm.get(type);
    if (!t) { fail(`${type}: Ambrosia's templates have no TMPL for it`); continue; }
    const a = ourRuns(type), b = tmplRuns(t);
    const len = Math.max(a.length, b.length);
    let bad = false;
    for (let i = 0; i < len; i++) {
      const x = a[i], y = b[i];
      if (!x || !y || x.offset !== y.offset || x.size !== y.size || x.cls !== y.cls) {
        fail(`${type}: field ${i} is ${x ? `${x.label} ${x.cls}${x.size ?? ''} at ${x.offset}` : 'missing'} here, ` +
             `${y ? `${y.label} ${y.cls}${y.size ?? ''} at ${y.offset}` : 'missing'} in the template`);
        bad = true; break;
      }
    }
    if (!bad) n++;
  }
  console.log(`layout: ${n} of ${Object.keys(S.NOVA_RECORDS).length} tables match Ambrosia's templates field for field`);
}

// Every shipped record of a fixed-size type is exactly its table's size.
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) continue;
  const game = openRelease(S, v, new Set(['data', 'graphics']));
  const off = [];
  for (const type of Object.keys(S.NOVA_RECORDS)) {
    const size = S.novaRecordSize(type);
    if (size === null) continue;
    for (const e of game.list(type)) {
      const n = game.get(type, e.id).bytes.length;
      if (n !== size) off.push(`${type} ${e.id} is ${n}`);
    }
  }
  if (off.length) fail(`${v}: records not the size of their table (${off.length}): ${off.slice(0, 6).join('; ')}`);
  else console.log(`sizes: every record in ${v} is the size of its table`);
}

// ---- 2. values against the ConText dump of 1.1.1 -------------------------
const DUMP = path.join(REF, 'evnova-utils/Context/NovaConText.txt');
const ALIAS = { Visiblility: 'Visibility', spobType: 'Type', MinCoolness: 'MinStatus', DefDude: 'DefenseDude', starMonth: 'startMonth',
                con: 'Con', nav: 'Nav',
                holds: 'Holds', freeMass: 'FreeMass', ShieldRegen: 'ShieldRech', SubTitle: 'Subtitle',
                WType: 'WeapType', WCount: 'WeapCount', Ammo: 'AmmoLoad', WType2: 'WeapType2', WCount2: 'WeapCount2', Ammo2: 'AmmoLoad2',
                DefaultItems2: 'DefaultItms2', AvailShipType: 'AvailShipTyp', HailPICT: 'HailPict',
                EscortShipType: 'EscortType', EscortMin: 'Min', EscortMax: 'Max' };
// Names the dump gives one type's field that another type uses for its own.
const TYPE_ALIAS = { oütf: { Require: 'Requires' }, përs: { ShipColor: 'Color' } };
// The dump writes a quotation mark as \q and CR and LF as \r and \n, and a
// backslash as itself, so a ShortName's own two characters \n (the Bible's
// line break in the shipyard) read back as LF. Our value is escaped the
// dump's way and compared, which has no such ambiguity.
const escape = s => s.replace(/["\r\n]/g, c => ({ '"': '\\q', '\r': '\\r', '\n': '\\n' })[c]);

function dumpSections() {
  const rows = fs.readFileSync(DUMP, 'utf8').split(/\r?\n/).map(l => l.split('\t'));
  const out = new Map();
  for (let i = 0; i < rows.length; i++) {
    const m = /^• Begin (.+)$/.exec(rows[i][0]);
    if (!m) continue;
    const head = rows[i + 1].map(h => h.replace(/^"|"$/g, ''));
    // A column named twice keeps its first place: the mïsn header names
    // RefuseButton twice and its rows are a column short of it, so the
    // second would read the end-of-record mark.
    const recs = [];
    for (let j = i + 2; j < rows.length && rows[j][0] === m[1]; j++) {
      const rec = {};
      head.forEach((h, k) => { if (!(h in rec)) rec[h] = rows[j][k]; });
      recs.push(rec);
    }
    out.set(m[1], { head, recs });
  }
  return out;
}
const unq = s => (s === undefined ? s : s.replace(/^"|"$/g, ''));

// Where a dump column lives in our record: [field, index or null].
function place(type, col, head) {
  const table = new Map(S.NOVA_RECORDS[type].map(([n, k, c]) => [n, { kind: k, count: c }]));
  const alias = x => (TYPE_ALIAS[type] || {})[x] || ALIAS[x] || x;
  const name = alias(col);
  if (table.has(name)) return [name, null];
  const m = /^(.*?)_?(\d+)$/.exec(name);
  if (!m) return null;
  const base = alias(m[1]), n = +m[2];
  const zero = head.includes(m[1] + '0') || head.includes(m[1] + '_0');
  if (type === 'spöb' && base === 'SpecialTech') return n <= 3 ? ['SpecialTech', n - 1] : ['SpecialTech4to8', n - 4];
  if (table.has(base) && table.get(base).count) return [base, zero ? n : n - 1];
  return null;
}

function same(kind, ours, theirs) {
  const t = unq(theirs);
  if (kind === 'str' || kind === 'cstr') return escape(ours) === t;
  if (kind === 'rgb') return /^#[0-9A-Fa-f]{6}$/.test(t) && (ours & 0xFFFFFF) === parseInt(t.slice(1), 16);
  const n = /^0x/i.test(t) ? parseInt(t, 16) : Number(t);
  if (kind === 'h16' || kind === 'h32') return ours === (n >>> 0) || ours === (n & 0xFFFF);
  return ours === n;
}

if (!fs.existsSync(DUMP)) console.log('SKIP values: no evnova-utils ConText dump in reference/');
else if (!haveRelease('1.1.1')) console.log('SKIP values: no 1.1.1 data files in reference/EV_Nova_1.1.1');
else {
  const sections = dumpSections();
  const game = openRelease(S, '1.1.1', new Set(['data', 'graphics']));
  for (const type of Object.keys(S.NOVA_RECORDS)) {
    const sec = sections.get(type);
    if (!sec || !sec.recs.length) { console.log(`values: ${type}: the dump has no records of it`); continue; }
    const kinds = new Map(S.NOVA_RECORDS[type].map(([n, k]) => [n, k]));
    const cols = sec.head.filter(h => !['Type', 'ID', 'Name', 'Res. Name', 'File', 'EOR'].includes(h));
    const where = new Map();
    for (const c of cols) { const p = place(type, c, sec.head); if (!p) fail(`${type}: the dump's column ${c} has no field here`); else where.set(c, p); }
    const covered = new Set([...where.values()].map(p => p[0]));
    const notInDump = S.NOVA_RECORDS[type].filter(([n, k]) => k !== 'pad' && !covered.has(n)).map(([n]) => n);
    let checked = 0, wrong = 0;
    const firstWrong = [];
    for (const row of sec.recs) {
      const id = +row.ID;
      const r = game.get(type, id);
      if (!r) { fail(`${type} ${id}: in the dump, not in 1.1.1`); continue; }
      if (unq(row.Name) !== escape(r.name || '')) { wrong++; if (firstWrong.length < 4) firstWrong.push(`${id} name ${JSON.stringify(r.name)} / ${row.Name}`); }
      if (unq(row.File) !== r.file) { wrong++; if (firstWrong.length < 4) firstWrong.push(`${id} file ${r.file} / ${row.File}`); }
      const rec = S.novaRecord(type, r.bytes);
      for (const [c, [f, i]] of where) {
        const v = i === null ? rec[f] : (rec[f] || [])[i];
        checked++;
        if (v === undefined || !same(kinds.get(f), v, row[c])) {
          wrong++;
          if (firstWrong.length < 4) firstWrong.push(`${id} ${c}: ${JSON.stringify(v)} here, ${row[c]} in the dump`);
        }
      }
    }
    if (wrong) fail(`${type}: ${wrong} of ${checked} values differ from the dump: ${firstWrong.join('; ')}`);
    else console.log(`values: ${type}: ${sec.recs.length} records, ${checked} values, all as the dump has them` +
                     (notInDump.length ? ` (not in the dump: ${notInDump.join(', ')})` : ''));
  }
}

process.exit(fails ? 1 : 0);
