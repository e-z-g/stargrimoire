// Writes js/nova-routines.js: where each routine the field notes and the
// rules cite, by the name Mac 1.1.1 gives it, is in 1.0.2, 1.0.8 and 1.0.10
// (how they are matched is in utilities/match.mjs). Needs those releases and
// 1.1.1's disk image in reference/game/.
import fs from 'node:fs';
import path from 'node:path';
import { site, ROOT, REF } from './load.mjs';
import { routinePlaces, citedRoutines, routinesFile } from './match.mjs';

const S = site();
const program = rel => { const src = S.novaArchiveProgram(new Uint8Array(fs.readFileSync(path.join(REF, 'game', rel)))); return S.novaProgram(src.read(), null); };
const t0 = Date.now();
const mac = program('EV_Nova_1.1.1_for_Mac_OS_X.dmg');
const pefs = [['1.0.10', program('EV_Nova_1.0.10.sit')], ['1.0.8', program('EV_Nova_1.0.8.sit')], ['1.0.2', program('EV_Nova_1.0.2.sit')]];
const names = citedRoutines(S), releases = routinePlaces(S, mac, pefs, names);
fs.writeFileSync(path.join(ROOT, 'js/nova-routines.js'), routinesFile(releases));
for (const [v, , at] of releases) console.log(`${v}: ${at.size} of the ${names.length} routines cited`);
console.log(`not matched in 1.0.10: ${names.filter(n => !releases[0][2].has(n)).join(', ')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
