// Every Nova plug-in in archive.org's EscapeVelocityPluginCollection (EVN.zip's
// Plugins and Cheats, as Add plug-ins lists them), opened as the page opens it,
// and the StuffIt reader held to The Unarchiver's tools on them:
//
// 1. Opened: each file unwrapped and read as openGameFiles reads it
//    (novaArchiveFiles or novaLooseFile, then each Nova file's fork); a file
//    opens when any Nova file in it reads. OPENED is how many do: 905 on 13
//    October 2026; 944 with the StuffIt 5 walk, its names, methods 2, 3 and 5
//    and plug-ins found by their records; 949 with MacBinary copies named as
//    they like and a split zip's pieces read by their local headers. What stays shut is
//    printed by kind: StuffIt X, RAR, Compact Pro, a zip in parts, copies
//    damaged where they are kept, and files that are no plug-in.
// 1b. Joined: the three pieces of rEV_Windows, a zip split across files, opened
//    together, as Add plug-ins opens what is ticked (novaJoinParts): JOINED of
//    their Nova files read, "rEV Escort Sell" not, its .rez list running past
//    its end.
// 2. lsar: every StuffIt archive's files, as the page's reader lists them,
//    against `lsar -j`, ':' in lsar's names read as the '/' it stands for. The
//    three LSAR_DIFFERS are lsar's: two read a Mac Roman ƒ as Cyrillic, one
//    lists a single file where its folder holds four.
// 3. unar: every fork in StuffIt methods 2, 3 and 5, decompressed by the page
//    and by `unar -k visible` (its resource forks from the AppleDouble it
//    writes), byte for byte; and one of them with a byte bent must differ.
//
// Without EVN.zip it skips; without lsar or unar, parts 2 and 3 do. It takes
// some minutes, the files read one at a time out of a 1.1 GB zip.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const OPENED = 949;
const JOINED = 7;
const LSAR_DIFFERS = ['Plugins/AAC-PSP-103.sit.hqx', 'Plugins/Khamikazi Viper.sea.bin', 'Plugins/Khamikazi.sea.bin'];
const S = site();
const EVN = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/EVN.zip');
if (!fs.existsSync(EVN)) { console.log('SKIP: no EVN.zip in reference/game/collections'); process.exit(0); }
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const has = tool => { try { execFileSync('which', [tool], { stdio: 'pipe' }); return true; } catch (e) { return false; } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'unpack-check-'));

const names = execFileSync('unzip', ['-Z1', EVN], { maxBuffer: 1 << 26 }).toString().split('\n')
  .filter(n => /^EVN\/(Plugins|Cheats)\//.test(n) && !n.endsWith('/') && !/\.txt$/i.test(n));
const isArchive = b => S.looksLikeStuffIt(b) || S.looksLikeStuffItX(b) || S.looksLikeZip(b) || S.looksLikeUdif(b);
const unwrapped = b => {   // as unwrapArchive: a MacBinary or BinHex copy of an archive, the archive
  if (isArchive(b)) return b;
  try { const w = S.sniffMacContainer(b); if (w && w.data && w.data.length && isArchive(w.data)) return w.data; } catch (e) { /* as it is */ }
  return b;
};

// ---- 1. opened -------------------------------------------------------------
let opened = 0;
const shut = {}, stuffIts = [];
for (const name of names) {
  const b = unwrapped(new Uint8Array(execFileSync('unzip', ['-p', EVN, name], { maxBuffer: 1 << 28 })));
  if (S.looksLikeStuffIt(b)) stuffIts.push({ name, b });
  let why = '', read = 0;
  try {
    const files = isArchive(b) ? S.novaArchiveFiles(b) : [S.novaLooseFile(name.split('/').pop(), b)].filter(Boolean);
    const errs = [];
    for (const f of files) { try { S.novaOpenFork(f.read()); read++; } catch (e) { errs.push(e.message); } }
    why = !files.length ? (isArchive(b) ? 'an archive with no Nova file the page sees' : 'no archive the page reads, and no resource fork') : errs[0];
  } catch (e) { why = e.message; }
  if (read) opened++;
  else { const k = why.replace(/"[^"]*"/g, '"…"').replace(/\d{3,}/g, 'N').slice(0, 90); (shut[k] = shut[k] || []).push(name.slice(4)); }
}
if (opened !== OPENED) fail(`${opened} of the ${names.length} files open, where ${OPENED} did`);
console.log(`opened: ${opened} of ${names.length} files open as the page opens them; the rest, by why:`);
for (const [k, list] of Object.entries(shut).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(list.length).padStart(3)}  ${k}`);

// ---- 1b. joined ------------------------------------------------------------
{
  const pieces = names.filter(n => /\/rEV_Windows\d{3}\.zip$/.test(n)).map(n => ({ name: n.split('/').pop(), bytes: new Uint8Array(execFileSync('unzip', ['-p', EVN, n], { maxBuffer: 1 << 28 })) }));
  const joined = S.novaJoinParts(pieces);
  let read = 0, files = [];
  if (joined.length === 1) { files = S.novaArchiveFiles(joined[0].bytes); for (const f of files) { try { S.novaOpenFork(f.read()); read++; } catch (e) { /* counted */ } } }
  if (pieces.length !== 3 || joined.length !== 1 || read !== JOINED) fail(`rEV_Windows's ${pieces.length} pieces joined into ${joined.length}, ${read} of ${files.length} Nova files read, where ${JOINED} were`);
  else console.log(`joined: rEV_Windows's three pieces as one zip, ${read} of ${files.length} Nova files read`);
}

// ---- 2. lsar ---------------------------------------------------------------
if (!has('lsar')) console.log('lsar: SKIP, no lsar');
else {
  let same = 0;
  const differ = [];
  for (const { name, b } of stuffIts) {
    let ours;
    try { ours = [...new Set(S.parseStuffItArchive(b).entries.filter(e => !e.isFolder).map(e => e.path.replace(/\r/g, '')))].sort(); } catch (e) { ours = ['ERR ' + e.message]; }
    const f = path.join(TMP, 'a.sit');
    fs.writeFileSync(f, b);
    let theirs;
    try { theirs = [...new Set(JSON.parse(execFileSync('lsar', ['-j', f], { maxBuffer: 1 << 26 }).toString()).lsarContents.filter(e => !e.XADIsDirectory).map(e => e.XADFileName.replace(/\r/g, '').replace(/:/g, '/')))].sort(); } catch (e) { theirs = ['lsar failed']; }
    if (JSON.stringify(ours) === JSON.stringify(theirs)) same++; else differ.push(name.slice(4));
  }
  const unknown = differ.filter(n => !LSAR_DIFFERS.includes(n)), gone = LSAR_DIFFERS.filter(n => !differ.includes(n));
  if (unknown.length) fail(`StuffIt archives listed otherwise than lsar lists them: ${unknown.slice(0, 8).join(', ')}`);
  if (gone.length) console.log(`  (lsar now agrees on ${gone.join(', ')}: LSAR_DIFFERS can lose it)`);
  console.log(`lsar: ${same} of ${stuffIts.length} StuffIt archives list the same files; ${differ.length} do not, lsar's misreadings`);
}

// ---- 3. unar ---------------------------------------------------------------
if (!has('unar')) console.log('unar: SKIP, no unar');
else {
  const appleDouble = buf => { const n = buf.readUInt16BE(24); for (let i = 0; i < n; i++) { const e = 26 + i * 12; if (buf.readUInt32BE(e) === 2) return buf.subarray(buf.readUInt32BE(e + 4), buf.readUInt32BE(e + 4) + buf.readUInt32BE(e + 8)); } return null; };
  const find = (dir, base) => { for (const f of fs.readdirSync(dir, { recursive: true })) if (path.basename(f) === base) return path.join(dir, f); return null; };
  let forks = 0, sameForks = 0, bent = null;
  for (const { name, b } of stuffIts) {
    const entries = S.parseStuffItArchive(b).entries.filter(e => !e.isFolder);
    const wanted = entries.flatMap(e => ['rsrc', 'data'].filter(w => [2, 3, 5].includes(w === 'rsrc' ? e.rsrcMethod : e.dataMethod) && (w === 'rsrc' ? e.rsrcLen : e.dataLen)).map(w => [e, w]));
    if (!wanted.length) continue;
    const dir = fs.mkdtempSync(path.join(TMP, 'x-')), src = path.join(dir, 'a.sit');
    fs.writeFileSync(src, b);
    try { execFileSync('unar', ['-q', '-f', '-k', 'visible', '-o', path.join(dir, 'out'), src], { stdio: 'pipe' }); } catch (e) { /* what it could */ }
    for (const [e, which] of wanted) {
      forks++;
      const f = find(path.join(dir, 'out'), which === 'rsrc' ? e.name + '.rsrc' : e.name);
      const want = f && (which === 'rsrc' ? appleDouble(fs.readFileSync(f)) : fs.readFileSync(f));
      let got = null;
      try { got = S.stuffItFork(b, e, which); } catch (err) { fail(`${name.slice(4)}, ${e.name}'s ${which} fork: ${err.message}`); continue; }
      if (!want) { fail(`${name.slice(4)}: unar gave no ${which} fork for ${e.name}`); continue; }
      if (got.length === want.length && got.every((v, i) => v === want[i])) sameForks++;
      else fail(`${name.slice(4)}, ${e.name}'s ${which} fork (method ${which === 'rsrc' ? e.rsrcMethod : e.dataMethod}) is not unar's`);
      if (!bent && got.length > 1000) bent = { b, e, which, want };
    }
  }
  // the comparison can fail: a byte of the stream bent, the answer must change
  if (bent) {
    const copy = bent.b.slice(), at = (bent.which === 'rsrc' ? bent.e.rsrcOffset : bent.e.dataOffset) + 40;
    copy[at] ^= 0x5A;
    let out = null;
    try { out = S.stuffItFork(copy, bent.e, bent.which); } catch (e) { out = null; }
    if (out && out.length === bent.want.length && out.every((v, i) => v === bent.want[i])) fail('a bent stream decompressed to unar\'s bytes all the same: the comparison sees nothing');
  } else fail('no fork in methods 2, 3 or 5 to bend');
  console.log(`unar: ${sameForks} of ${forks} forks in StuffIt methods 2, 3 and 5 byte for byte unar's` + (bent ? '; a bent one is caught' : ''));
}
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fails ? 1 : 0);
