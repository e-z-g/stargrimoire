// js/nova-sound.js: every snd resource of every Mac release read as a WAV,
// the IMA4-compressed ones held to macOS's own decoder.
//
// Each compressed sound's packets go unchanged into an AIFF-C file whose
// COMM chunk names 'ima4' and carries the sound header's own 80-bit sample
// rate; afconvert, Apple's decoder, turns that into 16-bit samples, and
// every sample must equal ours. Then a packet's byte changed on purpose
// must change ours, so the comparison can fail. The plain sounds go
// through grimoire's decodeSndToWav, as before. Needs afconvert (macOS);
// without it that part skips.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const AF = fs.existsSync('/usr/bin/afconvert') ? '/usr/bin/afconvert' : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'stargrimoire-snd-'));

const be32 = v => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const be16 = v => [(v >>> 8) & 255, v & 255];
const chunk = (id, body) => [...Buffer.from(id, 'latin1'), ...be32(body.length), ...body, ...(body.length & 1 ? [0] : [])];
function aifc(b) {
  const h = S.novaSndHeaderAt(b), ch = S.u32be(b, h + 4), packets = S.u32be(b, h + 22);
  const rate80 = [...b.subarray(h + 26, h + 36)], data = [...b.subarray(h + 64, h + 64 + packets * 34 * ch)];
  const comm = [...be16(ch), ...be32(packets * 64), ...be16(16), ...rate80, ...Buffer.from('ima4', 'latin1'), 0, 0];
  const body = [...Buffer.from('AIFC', 'latin1'), ...chunk('FVER', be32(0xA2805140)), ...chunk('COMM', comm), ...chunk('SSND', [...be32(0), ...be32(0), ...data])];
  return Buffer.from([...Buffer.from('FORM', 'latin1'), ...be32(body.length), ...body]);
}
function apple(b, n) {
  const src = path.join(TMP, n + '.aifc'), dst = path.join(TMP, n + '.wav');
  fs.writeFileSync(src, aifc(b));
  execFileSync(AF, ['-f', 'WAVE', '-d', 'LEI16', src, dst]);
  const w = fs.readFileSync(dst);
  let p = 12;
  while (p + 8 <= w.length && w.toString('latin1', p, p + 4) !== 'data') p += 8 + w.readUInt32LE(p + 4);
  const len = w.readUInt32LE(p + 4), out = new Int16Array(len / 2);
  for (let i = 0; i < out.length; i++) out[i] = w.readInt16LE(p + 8 + 2 * i);
  return out;
}
const differs = (a, b) => { if (a.length !== b.length) return `${a.length} samples, Apple's ${b.length}`; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `sample ${i}: ${a[i]}, Apple's ${b[i]}`; return null; };

for (const v of ['1.0.2', '1.0.8', '1.0.10', '1.1.1']) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v, new Set(['sounds']));
  const list = game.list('snd ');
  let plain = 0, ima = 0, held = 0, bad = 0;
  for (const e of list) {
    const b = game.get('snd ', e.id).bytes;
    let s;
    try { s = S.novaSndSamples(b); } catch (err) { bad++; if (bad <= 3) fail(`${v} snd ${e.id}: ${err.message}`); continue; }
    if (s.plain) { plain++; continue; }
    ima++;
    if (!AF) continue;
    const d = differs(s.samples, apple(b, `${v}-${e.id}`));
    if (d) { fail(`${v} snd ${e.id}: ${d}`); continue; }
    held++;
  }
  console.log(`${v}: ${list.length} sounds, ${plain} plain and ${ima} IMA4-compressed${AF ? `, ${held} of them sample for sample as afconvert decodes them` : ''}`);
  if (AF && v === '1.0.10') {
    const e = list.find(x => { try { return !S.novaSndSamples(game.get('snd ', x.id).bytes).plain; } catch { return false; } });
    const b = game.get('snd ', e.id).bytes.slice(), h = S.novaSndHeaderAt(b);
    const ours = S.novaSndSamples(b).samples;
    b[h + 64 + 2 + 5] ^= 0x33;
    if (!differs(S.novaSndSamples(b).samples, ours)) fail(`1.0.10 snd ${e.id}: a packet's byte changed, and the samples did not`);
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
if (!AF) console.log('SKIP afconvert: not on this machine');
console.log(fails ? `${fails} failures` : 'sounds: every compressed one as Apple decodes it');
process.exit(fails ? 1 : 0);
