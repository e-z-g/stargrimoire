/* png-stream.js -- a PNG written a band of rows at a time.
   =========================================================================

   The whole map with every name is larger than any canvas a browser will
   make (Starfleet Adventures' is 21,731 by 19,980 pixels, 434 million;
   Chrome's canvas stops at about 268 million), so on a computer it is
   drawn a band of rows at a time and written here as one PNG: RGBA, eight
   bits a channel, each row unfiltered, the rows deflated as they come by
   the browser's CompressionStream, whose 'deflate' is the zlib stream a
   PNG's IDAT contains (PNG specification, 2nd edition, §§ 5, 9, 10). A band's
   pixels are what getImageData gives, which is in PNG's order
   and alpha form. Its chunks are written by grimoire's pngChunk (mac-media.js).
   utilities/png_check.mjs checks the result against node's zlib.

   PURE: no DOM. LOAD ORDER: after js/mac-media.js; page-map.js uses it. */

/* An RGBA PNG of w by h pixels as the parts of a file, for a Blob. band(y,
   n) gives rows y to y + n - 1 as w * n * 4 bytes (a Promise or not), and
   is called for `rows` at a time from the top; done(y) is given each band's
   end, for a page's progress. */
async function pngWrite(w, h, rows, band, done) {
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 6;   // eight bits, RGBA; deflate, no filter but each row's, no interlace
  parts.push(pngChunk('IHDR', ihdr));
  const z = new CompressionStream('deflate'), writer = z.writable.getWriter(), reader = z.readable.getReader(), out = [];
  const reading = (async () => { for (;;) { const { done: end, value } = await reader.read(); if (end) return; out.push(value); } })();
  const line = w * 4 + 1;
  for (let y = 0; y < h; y += rows) {
    const n = Math.min(rows, h - y), px = await band(y, n), buf = new Uint8Array(n * line);
    // each row: its filter, 0 (None), and its pixels
    for (let r = 0; r < n; r++) buf.set(px.subarray(r * w * 4, (r + 1) * w * 4), r * line + 1);
    await writer.write(buf);
    if (done) done(y + n);
  }
  await writer.close();
  await reading;
  for (const piece of out) if (piece.length) parts.push(pngChunk('IDAT', piece));
  parts.push(pngChunk('IEND', new Uint8Array(0)));
  return parts;
}
