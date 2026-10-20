// The bar's Add plug-ins: archive.org's listings of the three plug-in
// collections, read as the page reads them (js/nova-collection.js), held
// to the items themselves as reference/game/collections has them, each
// file there checked against the item's md5 when it was taken. The
// listings are reference/archive-org's, taken by its fetch.sh as the page
// fetches them.
//
// Every plug-in listed must be in the copy at the same path and size, the
// zip's from its central directory; the conversions' packages hold each
// file once, Polycon v2's Nova Files all eleven of its parts; every Nova plug-in must have the
// description beside it that the page fetches, and every description
// must read as the add-on page's, with its title, size and author, Created
// and Downloads (a few have no text under them, and are counted). Two controls on copies of the zip's listing: a row's size
// changed and a row renamed must each be found. Without the listings or
// the copies it skips.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
const LIST = path.join(REF, 'archive-org'), COLL = path.join(REF, 'game/collections');
const EVN = path.join(COLL, 'EscapeVelocityPluginCollection/EVN.zip');
if (!fs.existsSync(path.join(LIST, 'EVN.zip.html'))) { console.log('SKIP: no reference/archive-org (its fetch.sh fetches the listings)'); process.exit(0); }
if (!fs.existsSync(EVN)) { console.log('SKIP: no EVN.zip in reference/game/collections'); process.exit(0); }
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// The zip's files and sizes, from its central directory (no zip64: it is 1.1 GB).
function zipSizes(file) {
  const fd = fs.openSync(file, 'r'), size = fs.fstatSync(fd).size, tail = Buffer.alloc(Math.min(size, 66000));
  fs.readSync(fd, tail, 0, tail.length, size - tail.length);
  const e = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cdLen = tail.readUInt32LE(e + 12), cdAt = tail.readUInt32LE(e + 16), cd = Buffer.alloc(cdLen);
  fs.readSync(fd, cd, 0, cdLen, cdAt);
  fs.closeSync(fd);
  const out = new Map();
  for (let p = 0; p < cdLen; ) {
    const n = cd.readUInt16LE(p + 28), x = cd.readUInt16LE(p + 30), c = cd.readUInt16LE(p + 32);
    out.set(cd.toString('utf8', p + 46, p + 46 + n), cd.readUInt32LE(p + 24));
    p += 46 + n + x + c;
  }
  return out;
}
const inZip = zipSizes(EVN);
const html = fs.readFileSync(path.join(LIST, 'EVN.zip.html'), 'utf8');

// What of a set's listing is not in the copy as listed.
function against(c, entries, files) {
  const bad = [];
  for (const e of entries) {
    const at = c.zip ? e.path : path.join(COLL, c.item, e.path);
    const size = c.zip ? inZip.get(at) : (fs.existsSync(at) ? fs.statSync(at).size : undefined);
    if (size === undefined) bad.push(`${e.path} is not in the copy`);
    else if (size !== e.size) bad.push(`${e.path} is ${size} bytes in the copy, ${e.size} listed`);
  }
  return bad;
}

const said = [];
let nova = null;
for (const c of S.NOVA_COLLECTIONS) {
  const files = c.zip ? S.novaCollectionZip(html) : S.novaCollectionItem(JSON.parse(fs.readFileSync(path.join(LIST, c.item + '.json'), 'utf8')));
  const entries = S.novaCollectionEntries(c, files);
  if (!entries.length) { fail(`${c.label}: nothing listed`); continue; }
  if (!c.zip && !fs.existsSync(path.join(COLL, c.item))) { said.push(`${c.label}: ${entries.length}, no copy to hold them to`); continue; }
  for (const b of against(c, entries, files).slice(0, 5)) fail(`${c.label}: ${b}`);
  if (c.zip) nova = { c, entries, files };
  if (c.packages) {
    const packs = S.novaCollectionPackages(entries), n = packs.reduce((s, p) => s + p.files.length, 0), poly = packs.find(p => p.folder === 'Polycon v2/Nova Files');
    if (n !== entries.length || new Set(packs.flatMap(p => p.files)).size !== n) fail(`${c.label}: ${n} files in packages, ${entries.length} listed`);
    if (!poly || poly.files.length !== 11) fail(`${c.label}: Polycon v2's Nova Files is ${poly ? poly.files.length : 'no'} files, not 11`);
    said.push(`${c.label}: ${entries.length} in ${packs.length} packages`);
    continue;
  }
  said.push(`${c.label}: ${entries.length}`);
}

// Every Nova plug-in has its description, and each reads as the add-on page's.
if (nova) {
  const none = nova.entries.filter(e => !e.about);
  if (none.length) fail(`${none.length} Nova plug-ins with no description: ${none.slice(0, 3).map(e => e.path).join(', ')}`);
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-collection-'));
  execFileSync('unzip', ['-q', '-o', EVN, 'EVN/*.txt', '-d', TMP], { stdio: 'ignore' });
  let read = 0, bare = 0;
  for (const e of nova.entries) {
    if (!e.about) continue;
    const p = decodeURIComponent(e.about.slice(e.about.indexOf('/EVN.zip/') + 9));
    if (!fs.existsSync(path.join(TMP, p))) { fail(`${e.path}: its description ${p} is not in the zip`); continue; }
    const a = S.novaCollectionAbout(fs.readFileSync(path.join(TMP, p), 'utf8'));
    if (a.head.length < 4 || !/^Created: /.test(a.head[2]) || !/^Downloads: /.test(a.head[3])) fail(`${p} does not read as the add-on page's: ${JSON.stringify(a.head)}`);
    else { read++; if (!a.text) bare++; }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  said.push(`${read} descriptions read, ${bare} with no text`);
  // controls: a row's size changed, and a row renamed, each found
  const row = nova.entries.find(e => /Arbor II\.zip$/.test(e.path));
  const sized = html.replace(new RegExp(`(${row.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</a><td><td>[^<]*<td id="size">)(\\d+)`), (m, a, n) => a + (+n + 1));
  const named = html.replace(`>${row.path}<`, `>${row.path.replace('Arbor', 'Arbour')}<`);
  let found = 0;
  for (const [what, copy] of [['a size changed', sized], ['a name changed', named]]) {
    if (copy === html) { fail(`the control with ${what} changed nothing`); continue; }
    const bad = against(nova.c, S.novaCollectionEntries(nova.c, S.novaCollectionZip(copy)));
    if (bad.length !== 1) fail(`the control with ${what} found ${bad.length} differences, not 1`); else found++;
  }
  said.push(`${found} of 2 controls found`);
}
console.log(`${fails ? fails + ' failed' : 'every plug-in listed is in the copy as listed'}: ${said.join('; ')}`);
process.exit(fails ? 1 : 0);
