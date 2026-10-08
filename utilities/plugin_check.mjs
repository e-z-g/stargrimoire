// The plug-in writer, js/nova-plugin.js, four ways.
//
// 1. Records: every record of every type with a table, in every release
//    here, written back from its fields comes out as the bytes it was read
//    from; one field changed changes that field's bytes alone, and reads
//    back as what was written.
// 2. `.rez`: every `.rez` in the zips in reference/game (as rez_check takes
//    them), its resources written again in the file's order, is the file
//    byte for byte where EVNEW wrote it; and every file written here reads
//    the same through the page's reader and through evnova-workbench's
//    rez.py, written separately from EVNEW's CPlugIn::Load.
// 3. Mac: the MacBinary file reads back, through mac-containers.js and
//    mac-resfork.js, as the resources it was given, with Finder type Npïf
//    and the game's own creator, as the bytes of the 1.0.10 archive have it.
// 4. A plug-in made from two releases, put over the older, gives the newer's
//    records; and the page's in-memory plug-in (setEdits) wins and goes.
//
// Each comparison is first shown to fail on bytes changed on purpose.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { site, openRelease, haveRelease, RELEASES, REF, ROOT } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// The comparisons can fail.
{
  const a = Uint8Array.of(1, 2, 3), b = Uint8Array.of(1, 2, 4);
  if (same(a, b) || same(a, a.subarray(0, 2))) { console.log('FAIL the byte comparison cannot see a change'); process.exit(1); }
}

const versions = Object.keys(RELEASES).filter(haveRelease);
if (!versions.length) { console.log('SKIP: no release in reference/'); process.exit(0); }
const games = {};
for (const v of versions) games[v] = openRelease(S, v, new Set(['data']));

// ---- 1. records ---------------------------------------------------------
{
  let records = 0, edits = 0;
  const types = Object.keys(S.NOVA_RECORDS);
  for (const v of versions) {
    const g = games[v];
    for (const type of types) {
      const table = S.NOVA_RECORDS[type];
      for (const e of g.list(type)) {
        const b = g.get(type, e.id).bytes;
        const rec = S.novaRecord(type, b);
        records++;
        const back = S.novaRecordBytes(type, rec, b);
        if (!same(back, b)) { fail(`${v} ${type} ${e.id}: written back from its fields, ${back.length} bytes unlike the ${b.length} read`); continue; }
        if (!same(S.novaRecordBytes(type, {}, b), b)) fail(`${v} ${type} ${e.id}: written with no field given, not its own bytes`);
        // one field changed: each number field, and each string, in turn,
        // on the first record of each type in each release
        if (e.id !== g.list(type)[0].id) continue;
        const layout = S.novaLayout(type);
        for (const [name, kind, n] of table) {
          if (kind === 'pad' || kind === 'cstr' || !(name in rec)) continue;
          const want = { ...rec };
          let at;
          if (kind === 'str') {
            want[name] = (rec[name] === 'b1' ? 'b2' : 'b1');
            at = layout.filter(f => f.name === name);
          } else if (n) {
            want[name] = rec[name].slice(); want[name][n - 1] = (rec[name][n - 1] === 7 ? 9 : 7);
            at = layout.filter(f => f.name === name && f.index === n - 1);
          } else {
            want[name] = rec[name] === 7 ? 9 : 7;
            at = layout.filter(f => f.name === name);
          }
          if (!at.length || at[0].offset + at[0].size > b.length) continue;
          const nb = S.novaRecordBytes(type, want, b);
          const got = S.novaRecord(type, nb);
          edits++;
          if (JSON.stringify(got) !== JSON.stringify(want)) { fail(`${v} ${type} ${e.id} ${name}: reads back as ${JSON.stringify(got[name])}, not ${JSON.stringify(want[name])}`); continue; }
          const lo = at[0].offset, hi = lo + at[0].size;
          for (let i = 0; i < b.length; i++) if ((i < lo || i >= hi) && nb[i] !== b[i]) { fail(`${v} ${type} ${e.id} ${name}: byte ${i} changed, outside ${lo}..${hi}`); break; }
        }
      }
    }
  }
  // the writer can fail: a value out of range is refused, and a changed byte is seen
  let refused = 0;
  for (const [kind, text] of [['i16', '40000'], ['i16', 'x'], ['h16', '0x10000'], ['rgb', '#GGGGGG'], ['i32', '1.5']])
    try { S.novaFieldParse(kind, text); } catch (e) { refused++; }
  if (refused !== 5) fail(`novaFieldParse took ${5 - refused} of 5 values it should refuse`);
  const s1 = games[versions[0]].get('sÿst', 128).bytes;
  if (same(S.novaRecordBytes('sÿst', { xPos: S.novaRecord('sÿst', s1).xPos + 1 }, s1), s1)) fail('a changed xPos wrote the same bytes');
  console.log(`${records} records in ${versions.join(', ')} written back as read; ${edits} single fields changed alone`);
}

// ---- 2. .rez ------------------------------------------------------------
const TOOLS = path.join(ROOT, '..', 'evnova-workbench', 'tools');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stargrimoire-plugin-'));
try {
  const resourcesOf = f => {
    const out = [];
    // the file's own order, which is the index's
    for (const t of f.typeList) for (const e of f.resourcesByType[t.type])
      out.push({ type: S.novaTypeName(t.type), id: e.id, name: e.name || '', data: f.dataOf(t.type, e), at: e.off });
    return out.sort((a, b) => a.at - b.at);
  };
  const zips = [];
  for (const dir of ['game', 'game/extras']) {
    const d = path.join(REF, dir);
    if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) if (/\.zip$/i.test(n)) zips.push(path.join(d, n));
  }
  /* Laid out as EVNEW's CPlugIn::Save lays a file out: the resources'
     bytes in index order, flush from the end of the header, and nothing in
     a 256-byte name after its NUL, an index entry for each resource and
     the map and no more, and the map naming them in index order and no type with none. Other tools wrote some of the files
     here, which leave bytes after a name or put the data in another order;
     those are read back, not held byte for byte. */
  const evnewLaidOut = (b, res) => {
    const le = o => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    const n = le(20);
    let p = 24 + 12 * n + 13;
    for (let i = 0; i < n - 1; i++) { if (le(24 + 12 * i) !== p) return false; p += le(28 + 12 * i); }
    const map = le(24 + 12 * (n - 1)), types = (b[map + 6] << 8) | b[map + 7];
    if (n !== res.length + 1) return false;   // an index entry no resource names
    for (let t = 0; t < types; t++) if (!b[map + 19 + 12 * t] && !b[map + 18 + 12 * t] && !b[map + 17 + 12 * t] && !b[map + 16 + 12 * t]) return false;   // a type of none
    const first = le(16);
    for (let q = map + 8 + 12 * types, k = 0; q < b.length; q += 266, k++) {
      if (((b[q] << 24) | (b[q + 1] << 16) | (b[q + 2] << 8) | b[q + 3]) !== first + k) return false;
      let e = q + 10; while (e < q + 266 && b[e]) e++;
      for (; e < q + 266; e++) if (b[e]) return false;
    }
    return true;
  };
  let rezes = 0, identical = 0, other = 0;
  const written = [];
  for (const z of zips) {
    const bytes = new Uint8Array(fs.readFileSync(z));
    let cat;
    try { cat = S.parseZipArchive(bytes); } catch (e) { continue; }
    for (const e of cat.entries) {
      if (e.isFolder || !/\.rez$/i.test(e.name) || /(Ships|Sounds|Graphics|Titles)\b/.test(e.name)) continue;  // the big ones: the same layout, minutes more
      const data = S.zipFork(bytes, e, 'data');
      let res;
      try { res = resourcesOf(S.novaOpenRez(data)); } catch (err) { continue; }
      rezes++;
      const out = S.novaWriteRez(res, data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24));
      if (same(out, data)) identical++;
      else if (!evnewLaidOut(data, res)) other++;
      else {
        let i = 0; while (i < out.length && out[i] === data[i]) i++;
        console.log(`  not identical: ${path.basename(z)}: ${e.path}, first at byte ${i} of ${data.length} (${out.length} written)`);
      }
      const file = path.join(tmp, written.length + '.rez');
      fs.writeFileSync(file, out);
      written.push({ name: path.basename(z) + ': ' + e.path, file, res, out });
    }
  }
  if (!rezes) console.log('SKIP .rez: none in any zip in reference/game');
  else {
    // a small one of edited records, too
    const g = games[versions[versions.length - 1]];
    const small = [['sÿst', 128], ['spöb', 128], ['shïp', 128], ['mïsn', 128]].map(([type, id]) => {
      const r = g.get(type, id);
      return { type, id, name: r.name || '', data: S.novaRecordBytes(type, { ...S.novaRecord(type, r.bytes) }, r.bytes) };
    });
    const sf = path.join(tmp, 'small.rez'), sout = S.novaWriteRez(small);
    fs.writeFileSync(sf, sout);
    written.push({ name: 'four records', file: sf, res: small, out: sout });
    // the page's reader, and rez.py
    const PY = `
import sys, json, hashlib
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import rez
out = {}
for p in sys.argv[1:]:
    out[p] = sorted([t, i, n, hashlib.sha1(d).hexdigest()] for (t, i), (n, d) in rez.read(p).items())
print(json.dumps(out))
`;
    const sha = b => crypto.createHash('sha1').update(b).digest('hex');
    const theirs = fs.existsSync(path.join(TOOLS, 'rez.py'))
      ? JSON.parse(execFileSync('python3', ['-c', PY, ...written.map(w => w.file)], { maxBuffer: 1 << 28 }).toString()) : null;
    if (!theirs) fail(`no rez.py in ${TOOLS}`);
    let agree = 0;
    for (const w of written) {
      const back = resourcesOf(S.novaOpenRez(w.out));
      const key = r => [r.type, r.id, r.name].join('\0');
      const want = new Map(w.res.map(r => [key(r), r.data]));
      const bad = back.filter(r => !want.has(key(r)) || !same(want.get(key(r)), r.data)).length + Math.abs(back.length - w.res.length);
      if (bad) { fail(`${w.name}: written, ${bad} resources read back otherwise`); continue; }
      if (theirs) {
        const py = theirs[w.file];
        if (py.length !== w.res.length) { fail(`${w.name}: rez.py reads ${py.length} resources of ${w.res.length}`); continue; }
        const mine = new Set(w.res.map(r => [r.type, r.id, r.name, sha(r.data)].join('\0')));
        const off = py.filter(x => !mine.has(x.join('\0')));
        if (off.length) { fail(`${w.name}: rez.py reads ${off.length} resources otherwise than written, e.g. ${off[0].slice(0, 3).join(' ')}`); continue; }
      }
      agree++;
    }
    // the reading back can fail: a resource's byte changed after writing
    const probe = written[written.length - 1];
    const broken = Uint8Array.from(probe.out); broken[24 + 12 * (probe.res.length + 1) + 13] ^= 1;
    const r0 = resourcesOf(S.novaOpenRez(broken))[0];
    if (same(r0.data, probe.res[0].data)) fail('a byte changed in a written .rez was not seen');
    console.log(`${identical} of ${rezes} .rez files written again byte for byte, and the other ${other} laid out by other tools than EVNEW; ${agree} of ${written.length} written read back as given, by the page and by rez.py`);
    if (identical + other < rezes) fail(`${rezes - identical - other} .rez files laid out as EVNEW lays them did not come out byte for byte`);
    if (identical < 100) fail(`only ${identical} .rez files written again byte for byte`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ---- 3. Mac -------------------------------------------------------------
{
  const g = games[versions[versions.length - 1]];
  const res = ['sÿst', 'spöb', 'gövt'].flatMap(type => g.list(type).slice(0, 3).map(e => {
    const r = g.get(type, e.id);
    return { type, id: e.id, name: r.name || '', data: r.bytes };
  }));
  const bin = S.novaWriteMacPlugin(res, 'Test plug-in');
  const forks = S.macBinaryForks(bin);
  // the type and creator as the game's own archive has the bytes
  const sit = path.join(REF, 'game/EV_Nova_1.0.10.sit');
  if (!forks) fail('the MacBinary file is not read as MacBinary');
  else {
    if (!same(bin.subarray(65, 69), Uint8Array.of(0x4E, 0x70, 0x95, 0x66))) fail(`Finder type ${[...bin.subarray(65, 69)]}, not Npïf`);
    if (fs.existsSync(sit)) {
      const a = new Uint8Array(fs.readFileSync(sit));
      const i = Buffer.from(a).indexOf(Buffer.from('APPLN', 'latin1'));
      if (i < 0 || !same(bin.subarray(69, 73), a.subarray(i + 4, i + 8))) fail('the creator is not the EV Nova application\'s');
    }
    const fork = S.openResourceFork(forks.rsrc);
    let ok = 0;
    for (const r of res) {
      const e = (fork.resourcesByType[S.novaTypeKey(r.type)] || []).find(x => x.id === r.id);
      if (e && (e.name || '') === r.name && same(fork.dataOf(S.novaTypeKey(r.type), e), r.data)) ok++;
    }
    if (ok !== res.length || fork.total() !== res.length) fail(`Mac plug-in: ${ok} of ${res.length} resources read back as given (${fork.total()} in it)`);
    // as the page would open it: a loose .bin
    const loose = S.novaLooseFile('Test plug-in.bin', bin);
    if (!loose || !loose.plugin) fail('the page does not open the .bin as a plug-in');
    const broken = Uint8Array.from(bin); broken[bin.length - 300] ^= 1;
    if (same(S.macBinaryForks(broken).rsrc, forks.rsrc)) fail('a byte changed in the MacBinary file was not seen');
    console.log(`Mac plug-in: ${ok} resources read back, Finder type Npïf, the game's creator`);
  }
}

// ---- 4. a plug-in from two releases, and the page's edits ------------------
if (versions.length >= 2) {
  const [a, b] = versions.slice(-2);
  const res = S.novaPluginFromGames(games[a], games[b]);
  const over = openRelease(S, a, new Set(['data']));
  over.add({ name: 'diff', plugin: true }, S.novaWriteRez(res));
  let checked = 0, wrong = 0;
  for (const type of Object.keys(S.NOVA_RECORDS)) for (const e of games[b].list(type)) {
    const x = over.get(type, e.id), y = games[b].get(type, e.id);
    checked++;
    if (!x || x.name !== y.name || !same(x.bytes, y.bytes)) wrong++;
  }
  if (wrong) fail(`${a} with the plug-in made from ${a} to ${b}: ${wrong} of ${checked} records not ${b}'s`);
  if (!res.length) fail(`no record changed from ${a} to ${b}`);
  console.log(`${a} to ${b}: a plug-in of ${res.length} records makes all ${checked} records ${b}'s`);

  const g = games[b];
  const r = g.get('sÿst', 128);
  const changed = S.novaRecordBytes('sÿst', { xPos: S.novaRecord('sÿst', r.bytes).xPos + 5 }, r.bytes);
  g.setEdits([{ type: 'sÿst', id: 128, name: r.name, data: changed }, { type: 'sÿst', id: 9999, name: 'New', data: r.bytes }]);
  if (!same(g.get('sÿst', 128).bytes, changed) || g.get('sÿst', 128).file !== 'Changed here') fail('setEdits: the changed record does not win');
  if (!g.list('sÿst').some(e => e.id === 9999)) fail('setEdits: a new record is not listed');
  g.setEdits([]);
  if (!same(g.get('sÿst', 128).bytes, r.bytes) || g.list('sÿst').some(e => e.id === 9999)) fail('setEdits([]): the edits stay');
  if (g.files.some(f => f.edits)) fail('setEdits([]): the file stays');
}

process.exit(fails ? 1 : 0);
