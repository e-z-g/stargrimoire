/* nova-sound.js -- a snd resource as a WAV, the compressed ones too.
   =========================================================================

   grimoire's decodeSndToWav (mac-rsrc-types.js) reads a sound's plain
   samples; 178 of 1.0.10's 227 sounds are instead compressed, their
   header's encode 0xFE and its format 'ima4': Apple's IMA ADPCM, packets
   of 34 bytes for each channel, a 16-bit word (the predictor in its top
   nine bits, the step index in its low seven) and 32 bytes holding 64
   four-bit codes, the low nibble first, channels' packets in turn; a
   packet keeps the predictor carried over from the last where its header's
   step index is the same and its predictor within 127, as Apple's decoder
   does (afconvert differs from a plain restart at every packet). The
   step and index tables are the IMA's (IMA Recommended Practices for
   Enhancing Digital Audio Compatibility, 1992). utilities/sound_check.mjs
   holds every compressed sound, decoded here, to macOS's own decoder
   (afconvert) over the same packets.

   novaSndSamples(bytes) -> { samples: Int16Array (interleaved), rate,
                              channels, frames } or throws
   novaSndToWav(bytes)   -> { blob, rate, channels, frames }

   GENERIC TO MAC SOUND, NO DOM. LOAD ORDER: after mac-bytes.js,
   mac-media.js and mac-rsrc-types.js. */

const NOVA_IMA_STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411,
  1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
const NOVA_IMA_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

// Where a snd's sound header starts: after its format 1 or 2 preamble, at the bufferCmd's (or soundCmd's) offset.
function novaSndHeaderAt(b) {
  let p = 0;
  const format = u16be(b, p); p += 2;
  if (format === 1) { const n = u16be(b, p); p += 2 + n * 6; }
  else if (format === 2) p += 2;
  else throw new Error('snd format ' + format);
  const cmds = u16be(b, p); p += 2;
  for (let i = 0; i < cmds; i++, p += 8) {
    const cmd = u16be(b, p) & 0x7FFF;
    if (cmd === 0x51 || cmd === 0x50) return u32be(b, p + 4);
  }
  throw new Error('snd with no buffer command');
}

function novaSndSamples(b) {
  const h = novaSndHeaderAt(b);
  const encode = b[h + 20];
  if (encode !== 0xFE) {
    const w = decodeSndToWav(b);
    return { plain: w };
  }
  const channels = u32be(b, h + 4), rate = u32be(b, h + 8) / 65536, packets = u32be(b, h + 22);
  const format = String.fromCharCode(b[h + 40], b[h + 41], b[h + 42], b[h + 43]);
  if (format !== 'ima4') throw new Error(`a compressed sound in '${format}', which this page does not decompress`);
  const data = h + 64, frames = packets * 64, out = new Int16Array(frames * channels);
  for (let c = 0; c < channels; c++) {
    let pred = 0, idx = -1;
    for (let k = 0; k < packets; k++) {
      const at = data + (k * channels + c) * 34;
      if (at + 34 > b.length) throw new Error('a compressed sound shorter than its packets');
      // a packet's header restarts the state, but where its step index is the one carried over and its
      // predictor (nine bits) within 127 of the carried one, the carried predictor's finer value is kept
      const head = u16be(b, at), hp = (head & 0xFF80) << 16 >> 16, hi = Math.min(88, head & 0x7F);
      if (hi !== idx || Math.abs(hp - pred) > 0x7F) { pred = hp; idx = hi; }
      for (let j = 0; j < 64; j++) {
        const byte = b[at + 2 + (j >> 1)], n = j & 1 ? byte >> 4 : byte & 15;
        const step = NOVA_IMA_STEP[idx];
        let diff = step >> 3;
        if (n & 1) diff += step >> 2;
        if (n & 2) diff += step >> 1;
        if (n & 4) diff += step;
        pred = n & 8 ? pred - diff : pred + diff;
        if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
        idx += NOVA_IMA_INDEX[n];
        if (idx < 0) idx = 0; else if (idx > 88) idx = 88;
        out[(k * 64 + j) * channels + c] = pred;
      }
    }
  }
  return { samples: out, rate, channels, frames };
}

function novaSndToWav(b) {
  const s = novaSndSamples(b);
  if (s.plain) return s.plain;
  // as the resource would hold them, big-endian, which wavFromPcmBytes takes
  const bytes = new Uint8Array(s.samples.length * 2);
  s.samples.forEach((v, i) => { bytes[2 * i] = (v >> 8) & 255; bytes[2 * i + 1] = v & 255; });
  return { blob: new Blob([wavFromPcmBytes(bytes, Math.round(s.rate), 16, s.channels)], { type: 'audio/wav' }), rate: s.rate, channels: s.channels, frames: s.frames };
}
