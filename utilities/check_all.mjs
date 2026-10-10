// Every check, one after another, and a table at the end.
//
//   node utilities/check_all.mjs            # all of them
//   node utilities/check_all.mjs records    # the ones whose names include a word
//   node utilities/check_all.mjs --quick    # all but the slow two, for while working
//   node utilities/check_all.mjs --fresh    # every check run, none taken as before
//
// --quick leaves out subway and page, about 11 of a full run's 13 minutes,
// and says so at the end. A front is landed on a full run, never a quick one.
//
// A check that passed is not run again while everything it read is as it
// was: check_trace.mjs notes, as it runs, every file it reads, every folder
// it lists, every path it asks about and every file it hands a program it
// starts, and the run is kept in ~/.cache/stargrimoire-checks against them
// (a file of up to 4 MB by its contents, a larger one by its size and
// time). A check that loads the site's scripts through load.mjs's site()
// still loads them all, but is taken to read only those it can reach: a
// script whose names (scriptGlobals) appear in the check, in a module of
// utilities/ it imports, or in a script it reaches; and of index.html only
// its list of scripts, not their stamps. The table says "same" for such a
// check. The last few passing
// runs of each are kept, so a front and the main checkout do not undo
// each other's. --fresh runs them all and keeps what they read.
//
// One at a time: the page check runs Chrome over a 96 MB release, and this
// machine has 8 GB. A check whose inputs are missing skips and says why;
// SKIP is not a failure, and the table shows it.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, pageScripts, scriptGlobals } from './load.mjs';

const CACHE = path.join(os.homedir(), '.cache', 'stargrimoire-checks');
const KEEP = 8;
// A path as kept: from the site's folder when within the workspace, so a
// front's run serves the main checkout's, else as it is.
const keyOf = p => { const r = path.relative(ROOT, p); return r.startsWith('../../') || path.isAbsolute(r) ? p : r; };
const pathOf = k => (path.isAbsolute(k) ? k : path.join(ROOT, k));
const SIGS = new Map();
function sig(k) {
  if (SIGS.has(k)) return SIGS.get(k);
  let v = null;
  if (k === 'index.html#scripts') { try { v = crypto.createHash('sha1').update(pageScripts().join('\0')).digest('hex'); } catch { v = null; } SIGS.set(k, v); return v; }
  try {
    const p = pathOf(k), st = fs.statSync(p);
    v = st.size <= 4 << 20 ? crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex') : `${st.size}:${st.mtimeMs}`;
  } catch { v = null; }
  SIGS.set(k, v);
  return v;
}
const listSig = k => { try { return crypto.createHash('sha1').update(fs.readdirSync(pathOf(k)).sort().join('\0')).digest('hex'); } catch { return null; } };
const there = k => fs.existsSync(pathOf(k));
// The scripts a check can reach, from the text of what it imported.
let SCRIPTS = null;
const words = t => new Set(t.match(/[A-Za-z_$][\w$]*/g) || []);
function reach(texts) {
  SCRIPTS = SCRIPTS || [...scriptGlobals()].map(([f, v]) => ({ f, names: v.names, words: words(v.src) }));
  const seen = new Set(), queue = [words(texts.join('\n'))];
  while (queue.length) {
    const w = queue.pop();
    for (const s of SCRIPTS) if (!seen.has(s.f) && [...s.names].some(n => w.has(n))) { seen.add(s.f); queue.push(s.words); }
  }
  return seen;
}
function inputsFrom(name, trace, usesSite) {
  const files = {}, lists = {}, asked = {};
  let keys = trace.files.map(keyOf);
  if (usesSite) {
    const mine = keys.filter(k => k.startsWith('utilities/') && k.endsWith('.mjs')).map(k => fs.readFileSync(pathOf(k), 'utf8'));
    const can = reach(mine), scripts = new Set(SCRIPTS.map(s => s.f));
    keys = keys.filter(k => !scripts.has(k) || can.has(k)).map(k => (k === 'index.html' ? 'index.html#scripts' : k));
  }
  for (const k of keys) files[k] = sig(k);
  for (const k of ALSO[name] || []) files[k] = sig(k);
  for (const p of Object.keys(trace.lists)) lists[keyOf(p)] = listSig(keyOf(p));
  for (const [p, v] of Object.entries(trace.asked)) asked[keyOf(p)] = v;
  return { node: process.version, files, lists, asked };
}
const unchanged = e => e.node === process.version &&
  Object.entries(e.files).every(([k, v]) => sig(k) === v) &&
  Object.entries(e.lists).every(([k, v]) => listSig(k) === v) &&
  Object.entries(e.asked).every(([k, v]) => there(k) === v);
const cacheFile = name => path.join(CACHE, name + '.json');
function cached(name) { try { return JSON.parse(fs.readFileSync(cacheFile(name), 'utf8')); } catch { return []; } }
function remember(name, entry) {
  const list = [entry, ...cached(name).filter(e => JSON.stringify(e) !== JSON.stringify(entry))].slice(0, KEEP);
  fs.mkdirSync(CACHE, { recursive: true });
  const tmp = cacheFile(name) + '.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(list));
  fs.renameSync(tmp, cacheFile(name));
}

const CHECKS = [
  ['copies', 'js/mac-*.js are grimoire\'s, byte for byte'],
  ['stamp', 'every script index.html loads tagged with its contents\' hash, so no visitor gets an old one'],
  ['records', 'record tables against Ambrosia\'s templates and the ConText dump'],
  ['dmg', 'the 1.1.1 disk image read here against the files hdiutil copied out of it'],
  ['rez', 'the .rez reader against the workbench\'s rez.py'],
  ['sprite', 'rlëD and rlë8 against ResForge, pixel for pixel'],
  ['universe', 'the map\'s rules, and every release through them'],
  ['bits', 'every control-bit test and set read as Drydock reads it'],
  ['missions', 'storylines from Ambrosia\'s notes, place codes, and the wiki as a check'],
  ['compare', 'what changed between releases, against the resources\' bytes'],
  ['fields', 'the field notes: every routine they cite is Mac 1.1.1\'s, at its address'],
  ['sound', 'every snd read, the IMA4-compressed ones sample for sample as macOS\'s afconvert decodes them'],
  ['program', 'the game\'s program: its system calls named from its loader, its figures as LLVM reads them, in every release'],
  ['plugin', 'plug-ins written: every record back as read, .rez byte for byte and against rez.py, the Mac file read back'],
  ['ships', 'the Bible\'s rules for ships, and every release\'s ships through them'],
  ['flight', 'ships in flight: worked figures from Mac 1.1.1\'s code, and the records\' odds'],
  ['subway', 'the subway maps: 45 and 22.5 degrees, room for names, the same map twice'],
  ['labels', 'names placed once for every zoom: none goes, moves or meets another'],
  ['page', 'index.html in headless Chrome'],
];
const SLOW = ['subway', 'page'];
// What a check reads that the tracing cannot see: a module Python imports.
const ALSO = { rez: ['../evnova-workbench/tools/rez.py'], plugin: ['../evnova-workbench/tools/rez.py'] };
const quick = process.argv.includes('--quick'), fresh = process.argv.includes('--fresh');
const want = process.argv.slice(2).filter(a => !a.startsWith('--'));
const run = CHECKS.filter(([n]) => (!want.length || want.some(w => n.includes(w))) && !(quick && SLOW.includes(n)));
const rows = [];
for (const [name, what] of run) {
  const t0 = Date.now();
  process.stdout.write(`${name} … `);
  if (!fresh && cached(name).some(unchanged)) {
    console.log('same (passed before, nothing it reads has changed)');
    rows.push({ name, what, status: 'same', secs: '-' });
    continue;
  }
  const trace = path.join(os.tmpdir(), `stargrimoire-trace-${process.pid}-${name}.json`);
  fs.rmSync(trace, { force: true });
  const r = spawnSync('node', ['--import', path.join(ROOT, 'utilities', 'check_trace.mjs'), path.join(ROOT, 'utilities', name + '_check.mjs')],
    { cwd: ROOT, encoding: 'utf8', timeout: 900000, env: { ...process.env, CHECK_TRACE: trace } });
  const out = (r.stdout || '') + (r.stderr || '');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = r.status === 0;
  const skipped = ok && /^SKIP/m.test(out) && !/^(?!SKIP|FAIL).+/m.test(out);
  const status = !ok ? 'FAIL' : skipped ? 'SKIP' : 'ok';
  console.log(`${status} (${secs} s)`);
  const usesSite = /\bsite\(/.test(fs.readFileSync(path.join(ROOT, 'utilities', name + '_check.mjs'), 'utf8'));
  if (status === 'ok' && fs.existsSync(trace)) remember(name, inputsFrom(name, JSON.parse(fs.readFileSync(trace, 'utf8')), usesSite));
  fs.rmSync(trace, { force: true });
  if (!ok) console.log(out.split('\n').filter(l => l.trim()).map(l => '    ' + l).join('\n'));
  rows.push({ name, what, status, secs });
}
console.log('');
for (const r of rows) console.log(`${r.status.padEnd(5)} ${r.name.padEnd(9)} ${String(r.secs).padStart(6)} s  ${r.what}`);
if (quick) console.log(`\n--quick: ${SLOW.join(' and ')} not run; run without it before landing.`);
process.exit(rows.some(r => r.status === 'FAIL') ? 1 : 0);
