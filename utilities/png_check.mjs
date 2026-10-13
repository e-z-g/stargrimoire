// The PNG writer the whole map uses on a computer (js/png-stream.js), held
// to node's zlib: images of random pixels written a band of rows at a time,
// every chunk's CRC-32 held to zlib.crc32, IHDR read back, the IDAT data
// inflated by zlib and every row's filter and pixels held to what was
// written; one image 20,000 pixels wide, wider than a 64 KB row. macOS's
// sips must read each one's size. Two controls: a byte changed in an IDAT
// chunk, and a pixel changed in what is compared, must each be found.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { site } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// What a PNG holds, or the first thing wrong with it.
function readPng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) return { bad: 'no PNG signature' };
  const idat = [];
  let ihdr = null, end = false;
  for (let p = 8; p < buf.length; ) {
    const n = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + n);
    if (zlib.crc32(buf.subarray(p + 4, p + 8 + n)) !== buf.readUInt32BE(p + 8 + n)) return { bad: `${type} chunk at ${p}: CRC wrong` };
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], rest: [data[10], data[11], data[12]] };
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') end = true;
    p += 12 + n;
  }
  if (!ihdr || !end) return { bad: 'no IHDR or no IEND' };
  return { ihdr, raw: zlib.inflateSync(Buffer.concat(idat)) };
}
// What is wrong with a read image against the pixels written, or null.
function against(png, w, h, px) {
  if (png.bad) return png.bad;
  const { ihdr, raw } = png;
  if (ihdr.w !== w || ihdr.h !== h || ihdr.depth !== 8 || ihdr.color !== 6 || ihdr.rest.some(Boolean)) return `IHDR ${JSON.stringify(ihdr)}`;
  if (raw.length !== h * (w * 4 + 1)) return `${raw.length} bytes inflated, not ${h * (w * 4 + 1)}`;
  for (let y = 0; y < h; y++) {
    const at = y * (w * 4 + 1);
    if (raw[at] !== 0) return `row ${y}: filter ${raw[at]}`;
    if (Buffer.compare(raw.subarray(at + 1, at + 1 + w * 4), Buffer.from(px.buffer, px.byteOffset + y * w * 4, w * 4))) return `row ${y}: pixels differ`;
  }
  return null;
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-png-'));
const sips = (() => { try { execFileSync('sips', ['--help'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
let made = 0, last = null;
for (const [w, h, rows] of [[301, 157, 40], [64, 64, 64], [1, 1, 1], [20000, 5, 2]]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i++) px[i] = (Math.random() * 256) | 0;
  // half of the first image black, as most of the map is
  if (w === 301) px.fill(0, 0, px.length >> 1);
  const asked = [];
  const parts = await S.pngWrite(w, h, rows, (y, n) => { asked.push([y, n]); return px.subarray(y * w * 4, (y + n) * w * 4); });
  const buf = Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.length)));
  if (asked.reduce((s, [, n]) => s + n, 0) !== h || asked.some(([y], i) => y !== i * rows)) fail(`${w} by ${h}: the bands asked for were ${JSON.stringify(asked)}`);
  const bad = against(readPng(buf), w, h, px);
  if (bad) { fail(`${w} by ${h}: ${bad}`); continue; }
  if (sips) {
    const f = path.join(TMP, `${w}x${h}.png`);
    fs.writeFileSync(f, buf);
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f], { encoding: 'utf8' });
    if (!out.includes(`pixelWidth: ${w}`) || !out.includes(`pixelHeight: ${h}`)) fail(`${w} by ${h}: sips read ${out.replace(/\s+/g, ' ')}`);
  }
  made++;
  last = { w, h, px, buf };
}
// controls, on the last image
let found = 0;
if (last) {
  const { w, h, px, buf } = last, copy = Buffer.from(buf), at = copy.indexOf('IDAT', 0, 'latin1') + 10;
  copy[at] ^= 0xff;
  if (against(readPng(copy), w, h, px)) found++; else fail('a byte changed in an IDAT chunk was not found');
  const other = new Uint8ClampedArray(px); other[other.length - 1] ^= 1;
  if (against(readPng(buf), w, h, other)) found++; else fail('a pixel changed was not found');
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`${fails ? fails + ' failed' : 'every PNG written reads back as written'}: ${made} of 4 images${sips ? ', each read by sips' : ''}; ${found} of 2 controls found`);
process.exit(fails ? 1 : 0);
