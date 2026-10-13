// The EV Nova plug-ins that come as StuffIt X, opened as the page opens
// them: every .sitx among the Nova plug-ins of the archive.org collection
// in reference/game/collections (EscapeVelocityPluginCollection's EVN.zip),
// through novaArchiveFiles (and through the archive in a MacBinary copy,
// as unwrapArchive in page-open.js takes it), every fork held to what
// `unar` extracts, and every plug-in read as the page reads one, its
// resources counted. And an archive in an archive: reference/game's
// EstarGuars is a StuffIt whose files are MacBinary copies of StuffIt
// archives, and its 14 plug-ins must come out of them.
//
// js/mac-stuffitx.js is grimoire's (copies_check holds it so), a port of
// The Unarchiver's, and grimoire's sitx_check.mjs is where it is held to
// the CRC-32s each archive stores and its controls are; `unar` is the same
// code, so this shows the page's path faithful to it over the archives the
// site is for, the English preprocessing among them. Five of them `unar`
// cannot read either, and they are listed, not failed. Without the
// collection or `unar` it skips.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, REF } from './load.mjs';

const S = site();
const EVN = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/EVN.zip');
const have = cmd => { try { execFileSync(cmd, ['-h'], { stdio: 'ignore' }); return true; } catch (e) { return e.status !== undefined; } };
if (!fs.existsSync(EVN)) { console.log('SKIP: no EVN.zip in reference/game/collections'); process.exit(0); }
if (!have('unar')) { console.log('SKIP: no unar (brew install unar)'); process.exit(0); }
const t0 = Date.now();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-sitx-'));
execFileSync('unzip', ['-q', '-o', '-j', EVN, 'EVN/Plugins/*.sitx', '-d', TMP], { stdio: 'ignore' });
const files = fs.readdirSync(TMP).filter(f => /\.sitx$/i.test(f)).sort();
let fails = 0, forks = 0, plugins = 0, resources = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const unread = [];
// the archive, or the archive in a MacBinary or BinHex copy (page-open.js's unwrapArchive)
const unwrap = b => { if (S.looksLikeStuffItX(b)) return b; let w = null; try { w = S.sniffMacContainer(b); } catch (e) { return b; } return w && w.data && w.data.length && S.looksLikeStuffItX(w.data) ? w.data : b; };
for (const f of files) {
  const bytes = unwrap(new Uint8Array(fs.readFileSync(path.join(TMP, f))));
  let list;
  try { list = S.novaArchiveFiles(bytes); } catch (e) { unread.push(`${f} (${e.message.replace(/^StuffIt X: /, '')})`); continue; }
  const out = path.join(TMP, 'x-' + f.replace(/\W/g, '_')), inner = out + '.sitx';
  // unar is given the archive as the page reads it, out of its wrapper (unar takes off only the wrapper)
  fs.writeFileSync(inner, bytes);
  try { execFileSync('unar', ['-q', '-f', '-D', '-o', out, inner], { stdio: 'ignore' }); } catch (e) { /* compared as far as it got */ }
  for (const nf of list) {
    let fork;
    try { fork = nf.read(); } catch (e) { fail(`${f}: ${nf.path}: ${e.message}`); continue; }
    const p = path.join(out, nf.path);
    const want = fs.existsSync(p + '/..namedfork/rsrc') && fs.statSync(p + '/..namedfork/rsrc').size ? fs.readFileSync(p + '/..namedfork/rsrc') : fs.existsSync(p) ? fs.readFileSync(p) : null;
    if (!want) { fail(`${f}: ${nf.path}: unar has no copy`); continue; }
    if (Buffer.compare(Buffer.from(fork), want) !== 0) { fail(`${f}: ${nf.path}: ${fork.length} bytes, not what unar extracts (${want.length})`); continue; }
    forks++;
    if (nf.plugin) {
      try { const g = S.novaGame(); g.add(nf, fork); plugins++; resources += S.NOVA_REC_TYPES.reduce((a, [t]) => a + g.list(t).length, 0) + g.list('sÿst').length + g.list('shïp').length + g.list('mïsn').length + g.list('spöb').length; }
      catch (e) { fail(`${f}: ${nf.path}: not read as a plug-in: ${e.message}`); }
    }
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
// archives in an archive
const ESTAR = path.join(REF, 'game/EstarGuars_Nova_1.sit');
let nested = 'EstarGuars not here';
if (fs.existsSync(ESTAR)) {
  const list = S.novaArchiveFiles(new Uint8Array(fs.readFileSync(ESTAR))), inner = list.filter(f => /\.sit\.bin\//.test(f.path) && f.plugin);
  // read smallest first, until one holds star systems
  let g = null, which = null;
  for (const f of [...inner].sort((x, y) => x.size - y.size)) { const t = S.novaGame(); t.add(f, f.read()); if (t.list('sÿst').length) { g = t; which = f.path.split('/').pop(); break; } }
  const n = g ? g.list('sÿst').length : 0;
  if (inner.length !== 14 || !n) fail(`EstarGuars: ${inner.length} plug-ins out of its .sit.bin archives, none with star systems`);
  nested = `EstarGuars: ${inner.length} plug-ins out of its three .sit.bin archives, ${n} systems in ${which}`;
}
if (unread.length > 5) fail(`${unread.length} archives not read, where unar cannot read five: ${unread.join('; ')}`);
console.log(`${files.length} StuffIt X archives among the Nova plug-ins: ${forks} files byte identical to unar, ${plugins} read as plug-ins (${resources} records); not read, as unar does not read them: ${unread.join('; ')}; ${nested} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(fails ? 1 : 0);
