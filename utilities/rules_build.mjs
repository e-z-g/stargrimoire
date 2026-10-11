// Writes js/nova-rules.js: the numbers the flying and battle code uses, each
// found in the routine of Mac 1.1.1 its comments cite (utilities/rules.mjs).
// Needs 1.1.1's disk image in reference/game/.
import fs from 'node:fs';
import path from 'node:path';
import { site, ROOT, REF } from './load.mjs';
import { scanRules, rulesFile } from './rules.mjs';

const S = site();
const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(path.join(REF, 'game/EV_Nova_1.1.1_for_Mac_OS_X.dmg'))));
const prog = S.novaProgram(src.read(), null);
const rules = scanRules(S, prog);
fs.writeFileSync(path.join(ROOT, 'js/nova-rules.js'), rulesFile(rules));
console.log(`js/nova-rules.js: ${rules.length} numbers in ${new Set(rules.map(r => r[3])).size} routines`);
