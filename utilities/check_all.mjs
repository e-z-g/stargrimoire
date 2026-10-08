// Every check, one after another, and a table at the end.
//
//   node utilities/check_all.mjs            # all of them
//   node utilities/check_all.mjs records    # the ones whose names include a word
//   node utilities/check_all.mjs --quick    # all but the slow two, for while working
//
// --quick leaves out subway and page, about 11 of a full run's 13 minutes,
// and says so at the end. A front is landed on a full run, never a quick one.
//
// One at a time: the page check runs Chrome over a 96 MB release, and this
// machine has 8 GB. A check whose inputs are missing skips and says why;
// SKIP is not a failure, and the table shows it.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ROOT } from './load.mjs';

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
  ['plugin', 'plug-ins written: every record back as read, .rez byte for byte and against rez.py, the Mac file read back'],
  ['ships', 'the Bible\'s rules for ships, and every release\'s ships through them'],
  ['flight', 'ships in flight: worked figures from Mac 1.1.1\'s code, and the records\' odds'],
  ['subway', 'the subway maps: 45 and 22.5 degrees, room for names, the same map twice'],
  ['labels', 'names placed once for every zoom: none goes, moves or meets another'],
  ['page', 'index.html in headless Chrome'],
];
const SLOW = ['subway', 'page'];
const quick = process.argv.includes('--quick');
const want = process.argv.slice(2).filter(a => a !== '--quick');
const run = CHECKS.filter(([n]) => (!want.length || want.some(w => n.includes(w))) && !(quick && SLOW.includes(n)));
const rows = [];
for (const [name, what] of run) {
  const t0 = Date.now();
  process.stdout.write(`${name} … `);
  const r = spawnSync('node', [path.join(ROOT, 'utilities', name + '_check.mjs')], { cwd: ROOT, encoding: 'utf8', timeout: 900000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = r.status === 0;
  const skipped = ok && /^SKIP/m.test(out) && !/^(?!SKIP|FAIL).+/m.test(out);
  const status = !ok ? 'FAIL' : skipped ? 'SKIP' : 'ok';
  console.log(`${status} (${secs} s)`);
  if (!ok) console.log(out.split('\n').filter(l => l.trim()).map(l => '    ' + l).join('\n'));
  rows.push({ name, what, status, secs });
}
console.log('');
for (const r of rows) console.log(`${r.status.padEnd(5)} ${r.name.padEnd(9)} ${String(r.secs).padStart(6)} s  ${r.what}`);
if (quick) console.log(`\n--quick: ${SLOW.join(' and ')} not run; run without it before landing.`);
process.exit(rows.some(r => r.status === 'FAIL') ? 1 : 0);
