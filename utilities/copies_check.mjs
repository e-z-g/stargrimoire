// js/mac-*.js are copies of ratlizard/mac-files and must stay byte for byte what
// it has: a change goes to mac-files first and is copied here (its README,
// *Changing a file*). This finds mac-files where MAC_FILES says (a Cythera
// front's worktree, while a change is tried), else at
// ~/e-z-g-cythera/mac-files, and fails without it: a check that skips passes
// unseen.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './load.mjs';

const M = process.env.MAC_FILES || path.join(os.homedir(), 'e-z-g-cythera', 'mac-files');
const theirs = path.join(M, 'js');
if (!fs.existsSync(theirs)) { console.log(`FAIL: no mac-files checkout at ${M} (set MAC_FILES)`); process.exit(1); }

const ours = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^mac-.*\.js$/.test(f)).sort();
let bad = 0;
for (const f of ours) {
  const bPath = path.join(theirs, f);
  if (!fs.existsSync(bPath)) { console.log(`FAIL ${f}: mac-files has no such file`); bad++; continue; }
  if (!fs.readFileSync(path.join(ROOT, 'js', f)).equals(fs.readFileSync(bPath))) { console.log(`FAIL ${f}: differs from ${bPath}`); bad++; }
}
console.log(`${ours.length} mac-* files, ${ours.length - bad} identical to mac-files'`);
process.exit(bad ? 1 : 0);
