/* nova-sprites.js -- EV Nova's run-length sprites, rlëD and rlë8, to RGBA.
   =========================================================================

   A spïn record names a sprite by id; the sprite is a PICT pair (image and
   mask) or, in everything Ambrosia shipped for stellars, an rlëD (16-bit)
   or rlë8 (8-bit) resource of the same id. The Bible names the two types
   and says what spïn holds; it does not give their layout. This decoder was
   written from the bytes, and utilities/sprite_check.mjs holds it to
   ResForge's Sprite Editor (andrews05/ResForge, SpriteWorld.swift, MIT),
   compiled from its own source, pixel for pixel.

   THE LAYOUT, as read here. A 16-byte header: width, height, bit depth
   (8, 16 or 32), a palette word, the frame count, and six bytes unused.
   Then, frame after frame, 32-bit tokens: the top byte an opcode, the low
   24 bits a byte count.
     0  end of the frame
     1  start of the next row (the count is the row's encoded length)
     2  that many bytes of pixels follow, padded to a multiple of four
     3  skip that many bytes' worth of pixels, left transparent
     4  that many bytes' worth of one pixel, which follows in four bytes
   A 16-bit pixel is 1-5-5-5 with the top bit unused; each five-bit
   channel is widened to eight by repeating its high bits. An 8-bit pixel
   indexes the Mac OS system palette (MAC_8BIT_PAL, mac-rsrc-types.js). A
   32-bit pixel is 0RGB.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after mac-bytes.js and
   mac-rsrc-types.js. */

function novaRleHeader(b) {
  if (b.length < 16) throw new Error('too short for a sprite header');
  const h = { width: u16be(b, 0), height: u16be(b, 2), depth: u16be(b, 4), palette: u16be(b, 6), frames: u16be(b, 8) };
  if (!h.width || !h.height) throw new Error(`sprite is ${h.width}×${h.height}`);
  if (h.depth !== 8 && h.depth !== 16 && h.depth !== 32) throw new Error(`sprite depth ${h.depth} is not 8, 16 or 32`);
  return h;
}

/* One frame, decoded from byte `p`, where it starts: { pixels, end },
   `end` being where the next frame starts. */
function novaRleFrameAt(b, h, p, f) {
  const W = h.width, H = h.height, px = h.depth / 8;
  const put = (out, o, hi, lo, v8, v32) => {
    if (px === 2) {
      const r = (hi >> 2) & 31, g = ((hi & 3) << 3) | (lo >> 5), bl = lo & 31;
      out[o] = (r << 3) | (r >> 2); out[o + 1] = (g << 3) | (g >> 2); out[o + 2] = (bl << 3) | (bl >> 2);
    } else if (px === 1) {
      const c = MAC_8BIT_PAL[v8] || [0, 0, 0];
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
    } else {
      out[o] = v32[0]; out[o + 1] = v32[1]; out[o + 2] = v32[2];
    }
    out[o + 3] = 255;
  };
  const out = new Uint8ClampedArray(W * H * 4);
  let y = -1, x = 0;
  for (;;) {
    if (p + 4 > b.length) throw new Error(`frame ${f} runs past the end of the sprite`);
    const op = b[p], n = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
    p += 4;
    if (op === 0) break;
    if (op === 1) {
      y++; x = 0;
      if (y >= H) throw new Error(`frame ${f} has more than ${H} rows`);
      continue;
    }
    if (y < 0) throw new Error(`frame ${f} draws before its first row`);
    if (n % px) throw new Error(`frame ${f}: a count of ${n} bytes is not whole ${h.depth}-bit pixels`);
    const count = n / px;
    if (x + count > W) throw new Error(`frame ${f}, row ${y}: runs past the width`);
    if (op === 3) { x += count; continue; }
    if (op === 2) {
      if (p + n > b.length) throw new Error(`frame ${f} runs past the end of the sprite`);
      for (let i = 0; i < count; i++) {
        const q = p + i * px, o = ((y * W) + x + i) * 4;
        put(out, o, b[q], b[q + 1], b[q], [b[q + 1], b[q + 2], b[q + 3]]);
      }
      p += (n + 3) & ~3;
      x += count;
      continue;
    }
    if (op === 4) {
      const q = p;
      for (let i = 0; i < count; i++) put(out, ((y * W) + x + i) * 4, b[q], b[q + 1], b[q], [b[q + 1], b[q + 2], b[q + 3]]);
      p += 4;
      x += count;
      continue;
    }
    throw new Error(`frame ${f}: unknown sprite opcode ${op}`);
  }
  return { pixels: out, end: p };
}

/* Every frame of a sprite: { width, height, depth, count, frames:
   [Uint8ClampedArray RGBA, width*height*4 each], starts: [the byte each
   frame starts at] }. `limit` stops after that many frames. */
function novaDecodeRle(b, limit) {
  const h = novaRleHeader(b);
  const want = Math.min(h.frames, limit === undefined ? h.frames : limit);
  const frames = [], starts = [];
  let p = 16;
  for (let f = 0; f < want; f++) {
    starts.push(p);
    const r = novaRleFrameAt(b, h, p, f);
    frames.push(r.pixels);
    p = r.end;
  }
  return { width: h.width, height: h.height, depth: h.depth, count: h.frames, frames, starts };
}

/* Where each frame starts, found by stepping over the tokens without
   drawing them, so that one frame of a large sprite can be drawn alone: a
   ship's engine glow can be 384 frames of 240 by 240, 88 MB drawn whole.
   { header, starts }. utilities/sprite_check.mjs holds `starts` to
   novaDecodeRle's. */
function novaRleIndex(b) {
  const h = novaRleHeader(b), starts = [];
  let p = 16;
  for (let f = 0; f < h.frames; f++) {
    starts.push(p);
    for (;;) {
      if (p + 4 > b.length) throw new Error(`frame ${f} runs past the end of the sprite`);
      const op = b[p], n = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
      p += 4;
      if (op === 0) break;
      if (op === 2) p += (n + 3) & ~3;
      else if (op === 4) p += 4;
      else if (op !== 1 && op !== 3) throw new Error(`frame ${f}: unknown sprite opcode ${op}`);
    }
  }
  return { header: h, starts };
}

/* Frame `f` of a sprite, as RGBA, from its index. */
function novaDecodeRleFrame(b, index, f) {
  if (f < 0 || f >= index.starts.length) throw new Error(`the sprite has no frame ${f}`);
  return novaRleFrameAt(b, index.header, index.starts[f], f).pixels;
}
