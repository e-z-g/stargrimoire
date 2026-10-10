// js/disk-image.js: EV Nova 1.1.1's disk image read here, held to the files
// macOS's own hdiutil copied out of it (reference/EV_Nova_1.1.1/Nova Files).
//
// Every .ndat novaArchiveFiles finds in the image must be byte for byte the
// one hdiutil gave, and none of those may be missing. Then the negative
// control: the image with a byte changed in every compressed chunk must not
// read back the same. And 1.1 beta 2.10.7's image, whose game is inside an
// installer package, held to macOS's xar, gzip and cpio.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const DMG = path.join(REF, 'game', 'EV_Nova_1.1.1_for_Mac_OS_X.dmg');
const DIR = path.join(REF, 'EV_Nova_1.1.1', 'Nova Files');
if (!fs.existsSync(DMG) || !fs.existsSync(DIR)) { console.log('SKIP: the 1.1.1 image or its files are not in reference/'); process.exit(0); }

const bytes = new Uint8Array(fs.readFileSync(DMG));
const t0 = Date.now();
const files = S.novaArchiveFiles(bytes);
const want = fs.readdirSync(DIR).filter(n => n.endsWith('.ndat')).sort();
let same = 0;
for (const n of want) {
  const f = files.find(x => x.name + '.ndat' === n);
  if (!f) { fail(`${n} is not found in the image`); continue; }
  if (Buffer.from(f.read()).equals(fs.readFileSync(path.join(DIR, n)))) same++;
  else fail(`${n} reads differently from hdiutil's copy`);
}
console.log(`${files.length} Nova files in the image; ${same} of ${want.length} .ndat byte for byte hdiutil's, in ${Date.now() - t0} ms`);

// the negative control
const part = S.udifPartitions(bytes).find(p => /Apple_HFS/.test(p.name));
const one = files.find(f => f.name === 'Nova Data 1'), good = one.read();
const zlib = part.chunks.filter(c => c.type === 0x80000005);
const bad = bytes.slice();
// a byte in the middle of every zlib chunk, so that the files read must meet one
for (const c of zlib) bad[c.off + Math.floor(c.len / 2)] ^= 0x55;
let changed = 0, refused = null;
try {
  for (const f of S.novaArchiveFiles(bad)) {
    let a, b;
    try { a = f.read(); } catch (e) { changed++; continue; }
    b = files.find(x => x.path === f.path).read();
    if (!Buffer.from(a).equals(Buffer.from(b))) changed++;
  }
} catch (e) { refused = e.message; }
if (refused) console.log(`a byte changed in each compressed chunk: the volume no longer reads (${refused})`);
else if (!changed) fail('a byte changed in every compressed chunk reads back as nothing changed');
else console.log(`a byte changed in each compressed chunk: ${changed} file${changed === 1 ? '' : 's'} read differently or not at all`);
if (good.length !== one.size) fail('Nova Data 1 is not its catalog length');

// 1.1 beta 2.10.7: its image holds an installer package (pkgFiles); each .rez read through the image, the package and
// its payload is byte for byte what macOS's xar, gzip and cpio give from the same package; and a byte changed in the
// payload's compressed stream does not read back the same
{
  const BETA = path.join(REF, 'game', 'EVNova_1.1_b2.10.7_Mac.dmg');
  const PKG = path.join(REF, 'unpacked', 'game', 'EVNova_1.1_b2.10.7_Mac', 'Install EV Nova 1.1_b2.10.7', 'EV Nova 1.1_b2.10.7.pkg');
  if (!fs.existsSync(BETA) || !fs.existsSync(PKG)) console.log('SKIP 1.1 beta 2.10.7: its image or its package is not in reference/');
  else {
    const t1 = Date.now(), beta = S.novaArchiveFiles(new Uint8Array(fs.readFileSync(BETA)));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stargrimoire-pkg-'));
    execFileSync('xar', ['-xf', PKG, '-C', tmp, 'Data.pkg/Payload']);
    execFileSync('sh', ['-c', 'gzip -dc Data.pkg/Payload | cpio -id --quiet 2>/dev/null'], { cwd: tmp });
    const dir = path.join(tmp, 'EV Nova', 'Nova Files'), theirs = fs.readdirSync(dir).filter(n => n.endsWith('.rez')).sort();
    let same = 0;
    for (const n of theirs) {
      const f = beta.find(x => x.name + '.rez' === n);
      if (!f) fail(`1.1 beta: ${n} is not found through the image`);
      else if (Buffer.from(f.read()).equals(fs.readFileSync(path.join(dir, n)))) same++;
      else fail(`1.1 beta: ${n} reads differently from cpio's copy`);
    }
    console.log(`1.1 beta 2.10.7: ${beta.length} Nova files through its image's package; ${same} of ${theirs.length} .rez byte for byte cpio's, in ${Date.now() - t1} ms`);
    fs.rmSync(tmp, { recursive: true, force: true });
    const pk = new Uint8Array(fs.readFileSync(PKG)), spoilt = pk.slice();
    spoilt[Math.floor(pk.length * 0.5)] ^= 0x55;
    let differs = false;
    try { const a = S.pkgFiles(pk).filter(e => /\.rez$/.test(e.name)), b = S.pkgFiles(spoilt).filter(e => /\.rez$/.test(e.name)); differs = a.length !== b.length || a.some((e, i) => !Buffer.from(e.read('data')).equals(Buffer.from(b[i].read('data')))); }
    catch (e) { differs = true; }
    if (!differs) fail('1.1 beta: a byte changed in the package reads back as nothing changed');
  }
}
process.exit(fails ? 1 : 0);
