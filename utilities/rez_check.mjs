// The `.rez` reader in js/nova-files.js, held to evnova-workbench's tools/rez.py -- a reader of
// the same format written separately, in Python, from EVNEW's CPlugIn::Load
// -- over every `.rez` in the zips in reference/game: the Community Edition's
// data files and the plug-ins. Both must give the same resources: type, id,
// name and bytes. The zips are opened with the page's own mac-zip.js.
//
// Then, for the figures only: the Community Edition's records against
// 1.1.1's, type by type, as many the same and as many changed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { site, openRelease, haveRelease, REF, ROOT } from './load.mjs';

const S = site();
const sha = b => crypto.createHash('sha1').update(b).digest('hex');
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// rez.py is in the workbench, beside the site, with the other analysis tools.
const TOOLS = path.join(ROOT, '..', 'evnova-workbench', 'tools');
if (!fs.existsSync(path.join(TOOLS, 'rez.py'))) { console.log(`FAIL: no rez.py in ${TOOLS}`); process.exit(1); }
const zips = [];
for (const dir of ['game', 'game/extras']) {
  const d = path.join(REF, dir);
  if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) if (/\.zip$/i.test(n)) zips.push(path.join(d, n));
}
const PY = `
import sys, json, hashlib
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import rez
out = {}
for p in sys.argv[1:]:
    r = rez.read(p)
    out[p] = sorted([t, i, n, hashlib.sha1(d).hexdigest()] for (t, i), (n, d) in r.items())
print(json.dumps(out))
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stargrimoire-rez-'));
const rezes = [];
try {
  for (const z of zips) {
    const bytes = new Uint8Array(fs.readFileSync(z));
    let cat;
    try { cat = S.parseZipArchive(bytes); } catch (e) { console.log(`SKIP ${path.basename(z)}: ${e.message}`); continue; }
    for (const e of cat.entries) {
      // The ships, sounds and music are most of the Community Edition's
      // bytes and nothing the map reads; the format is the same.
      if (e.isFolder || !/\.rez$/i.test(e.name) || /Nova (Ships|Sounds)/.test(e.name)) continue;
      const data = S.zipFork(bytes, e, 'data');
      const file = path.join(tmp, rezes.length + '.rez');
      fs.writeFileSync(file, data);
      rezes.push({ zip: path.basename(z), path: e.path, file, data });
    }
  }
  if (!rezes.length) { console.log('SKIP: no .rez in any zip in reference/game'); process.exit(0); }
  const theirs = JSON.parse(execFileSync('python3', ['-c', PY, ...rezes.map(r => r.file)], { maxBuffer: 1 << 28 }).toString());
  let same = 0, resources = 0;
  for (const r of rezes) {
    let ours;
    try {
      const f = S.novaOpenRez(r.data);
      ours = [];
      for (const t of f.typeList) for (const e of f.resourcesByType[t.type])
        ours.push([S.novaTypeName(t.type), e.id, e.name || '', sha(f.dataOf(t.type, e))]);
      ours.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    } catch (e) { fail(`${r.zip}: ${r.path}: ${e.message}`); continue; }
    const py = theirs[r.file].map(x => [x[0], x[1], x[2], x[3]]);
    const key = x => x.join('\0');
    const a = new Set(ours.map(key)), b = new Set(py.map(key));
    const onlyOurs = ours.filter(x => !b.has(key(x))), onlyTheirs = py.filter(x => !a.has(key(x)));
    resources += ours.length;
    if (onlyOurs.length || onlyTheirs.length || ours.length !== py.length)
      fail(`${r.zip}: ${r.path}: ${onlyOurs.length} resources read only here, ${onlyTheirs.length} only by rez.py` +
           (onlyOurs[0] ? `; e.g. ${onlyOurs[0].slice(0, 3).join(' ')}` : ''));
    else same++;
  }
  console.log(`${same} of ${rezes.length} .rez files, ${resources} resources, read as rez.py reads them`);

  // The Community Edition beside 1.1.1, for the figures.
  const ce = rezes.filter(r => /Nova Files\/Nova (Data|Graphics|Titles)/.test(r.path));
  if (ce.length && haveRelease('1.1.1')) {
    const g = S.novaGame();
    for (const r of ce) g.add({ name: path.basename(r.path, '.rez'), plugin: false, role: S.novaFileRole(r.path) }, r.data);
    const m = openRelease(S, '1.1.1');
    const rows = [];
    for (const type of g.types()) {
      let eq = 0, diff = 0, only = 0;
      for (const e of g.list(type)) {
        const x = m.get(type, e.id);
        if (!x) { only++; continue; }
        if (Buffer.compare(Buffer.from(x.bytes), Buffer.from(g.get(type, e.id).bytes)) === 0) eq++; else diff++;
      }
      const gone = m.list(type).filter(e => !g.has(type, e.id)).length;
      if (diff || only || gone) rows.push(`${type} ${eq} same, ${diff} changed, ${only} new, ${gone} gone`);
    }
    console.log(`the Community Edition against 1.1.1, where they differ: ${rows.join('; ') || 'nowhere'}`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(fails ? 1 : 0);
