// js/nova-sprites.js held to ResForge's Sprite Editor, pixel for pixel, over
// every rlëD and rlë8 in the releases' graphics files.
//
// The oracle is ResForge's own decoder (reference/ResForge, andrews05/ResForge,
// MIT): SpriteWorld.swift and what it needs -- Sprite.swift, BinaryDataReader
// and BinaryDataWriter, ColorTable.swift -- copied unchanged to a build
// directory except for their `import RFSupport` / `import ImageEditor`
// lines, which name modules that do not exist when everything is compiled as
// one, plus the one declaration they need from ImageFormat.swift. A main
// below feeds it sprites and writes every frame out as RGBA. Needs swiftc
// (Xcode's command-line tools); without it this check skips.
//
// SPRITE_ROLES=ships widens it to the ship files, which is most of the
// sprites there are and takes minutes rather than seconds.
//
// The frame index (novaRleIndex), which lets the page draw one frame of a
// large sprite alone, is held to where novaDecodeRle found each frame, and
// the last frame drawn from it to the last frame drawn in sequence.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { site, openRelease, haveRelease, REF } from './load.mjs';

const SRC = path.join(REF, 'ResForge/Plugins/Sources');
const FILES = ['RFSupport/BinaryDataReader.swift', 'RFSupport/BinaryDataWriter.swift', 'ImageEditor/ColorTable.swift',
               'NovaTools/Sprite Editor/Sprite.swift', 'NovaTools/Sprite Editor/SpriteWorld.swift'];
const MAIN = `import AppKit
// Each argument is a sprite file; for each, write width, height and frame
// count as big-endian UInt32 and then every frame as RGBA, or a width of
// 0xFFFFFFFF when ResForge refuses the sprite.
var out = Data()
func be(_ v: Int) { var x = UInt32(truncatingIfNeeded: v).bigEndian; out.append(Data(bytes: &x, count: 4)) }
for arg in CommandLine.arguments.dropFirst() {
    let data = try! Data(contentsOf: URL(fileURLWithPath: arg))
    guard let rle = try? SpriteWorld(data) else { be(-1); be(0); be(0); continue }
    var frames = Data()
    var ok = true
    for _ in 0..<rle.frameCount {
        guard let rep = try? rle.readFrame() else { ok = false; break }
        frames.append(Data(bytes: rep.bitmapData!, count: rle.frameWidth * rle.frameHeight * 4))
    }
    if !ok { be(-1); be(0); be(0); continue }
    be(rle.frameWidth); be(rle.frameHeight); be(rle.frameCount); out.append(frames)
}
FileHandle.standardOutput.write(out)
`;

function buildOracle() {
  if (!fs.existsSync(SRC)) return { skip: 'no ResForge clone at reference/ResForge' };
  if (spawnSync('swiftc', ['--version']).status !== 0) return { skip: 'no swiftc' };
  const texts = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8').replace(/^import (RFSupport|ImageEditor)\n/gm, ''));
  const fmt = fs.readFileSync(path.join(SRC, 'ImageEditor/ImageFormat.swift'), 'utf8');
  const glue = /^enum ImageReaderError[\s\S]*?^}\n/m.exec(fmt)[0];
  const hash = crypto.createHash('sha1').update(texts.join('\0') + glue + MAIN).digest('hex').slice(0, 12);
  const dir = path.join(os.tmpdir(), 'stargrimoire-rlefeed-' + hash);
  const bin = path.join(dir, 'rlefeed');
  // The binary, not the directory, is what says it is built: macOS empties
  // $TMPDIR's files and keeps its folders.
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(dir, { recursive: true });
    const names = FILES.map(f => path.basename(f));
    names.forEach((n, i) => fs.writeFileSync(path.join(dir, n), texts[i]));
    fs.writeFileSync(path.join(dir, 'glue.swift'), glue);
    fs.writeFileSync(path.join(dir, 'main.swift'), MAIN);
    execFileSync('swiftc', ['-O', '-o', bin, 'main.swift', 'glue.swift', ...names], { cwd: dir, stdio: 'inherit' });
  }
  return { bin, dir };
}

function oracle(o, sprites) {
  const files = sprites.map((s, i) => { const f = path.join(o.dir, `in${i}.rle`); fs.writeFileSync(f, s.bytes); return f; });
  const out = execFileSync(o.bin, files, { maxBuffer: 1 << 30 });
  const res = [];
  let p = 0;
  for (let i = 0; i < sprites.length; i++) {
    const w = out.readUInt32BE(p), h = out.readUInt32BE(p + 4), n = out.readUInt32BE(p + 8);
    p += 12;
    if (w === 0xFFFFFFFF) { res.push(null); continue; }
    const frames = [];
    for (let f = 0; f < n; f++) { frames.push(out.subarray(p, p + w * h * 4)); p += w * h * 4; }
    res.push({ w, h, frames });
  }
  files.forEach(f => fs.unlinkSync(f));
  return res;
}

// Where two frames first differ, or null. Pixels with alpha 0 are compared
// on alpha alone: what colour a transparent pixel holds is not the sprite.
function firstDiff(a, b) {
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] !== b[i + 3]) return i / 4;
    if (a[i + 3] && (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2])) return i / 4;
  }
  return null;
}

const o = buildOracle();
if (o.skip) { console.log('SKIP: ' + o.skip); process.exit(0); }
const S = site();
const roles = new Set(['graphics', ...(process.env.SPRITE_ROLES || '').split(',').filter(Boolean)]);
let fails = 0;
for (const v of ['1.0.10', '1.1.1']) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v, roles);
  const sprites = [];
  for (const type of ['rlëD', 'rlë8']) for (const e of game.list(type)) sprites.push({ type, id: e.id, bytes: game.get(type, e.id).bytes });
  // ResForge is fed in batches of about 150 MB drawn, so the ship files'
  // sprites, 1.3 GB drawn in 1.0.10, fit this machine and a pipe.
  let frames = 0, ok = 0, indexed = 0, control = null;
  const bad = [];
  for (let i = 0; i < sprites.length;) {
    const batch = [];
    for (let size = 0; i < sprites.length && (!batch.length || size < 150e6); i++) {
      batch.push(sprites[i]);
      try { const h = S.novaRleHeader(sprites[i].bytes); size += h.width * h.height * 4 * h.frames; } catch (e) { /* refused below */ }
    }
    const theirs = oracle(o, batch);
    batch.forEach((s, j) => {
      const t = theirs[j];
      let ours;
      try { ours = S.novaDecodeRle(s.bytes); } catch (e) { ours = { error: e.message }; }
      if (!t) { if (ours.error) ok++; else bad.push(`${s.type} ${s.id}: ResForge refuses it and this reads it`); return; }
      if (ours.error) { bad.push(`${s.type} ${s.id}: ${ours.error}`); return; }
      if (ours.width !== t.w || ours.height !== t.h || ours.frames.length !== t.frames.length) {
        bad.push(`${s.type} ${s.id}: ${ours.width}×${ours.height}×${ours.frames.length} here, ${t.w}×${t.h}×${t.frames.length} in ResForge`);
        return;
      }
      for (let f = 0; f < t.frames.length; f++) {
        frames++;
        const d = firstDiff(ours.frames[f], t.frames[f]);
        if (d !== null) { bad.push(`${s.type} ${s.id} frame ${f}: first differs at pixel (${d % t.w}, ${Math.floor(d / t.w)})`); return; }
      }
      const ix = S.novaRleIndex(s.bytes);
      if (ix.starts.join() !== ours.starts.join()) { bad.push(`${s.type} ${s.id}: the index puts a frame where the decoder does not`); return; }
      const last = t.frames.length - 1;
      if (last >= 0 && firstDiff(S.novaDecodeRleFrame(s.bytes, ix, last), t.frames[last]) !== null) { bad.push(`${s.type} ${s.id}: the last frame drawn alone differs`); return; }
      indexed++;
      ok++;
      if (!control && s.type === 'rlëD') control = { ours: ours.frames[0], theirs: Buffer.from(t.frames[0]) };
    });
  }
  if (bad.length) { fails++; console.log(`FAIL ${v}: ${bad.length} of ${sprites.length} sprites differ: ${bad.slice(0, 5).join('; ')}`); }
  else console.log(`${v}: ${sprites.length} sprites, ${frames} frames, every pixel as ResForge draws it; ${indexed} frame indexes as the decoder finds them`);

  // The negative control: one pixel changed must be caught.
  if (control) {
    const f = control.ours, k = f.findIndex((x, i) => i % 4 === 3 && x === 255) - 3;
    f[k] ^= 0x10;
    if (firstDiff(f, control.theirs) === null) { fails++; console.log('FAIL: the comparison did not notice a changed pixel'); }
  }
}
process.exit(fails ? 1 : 0);
