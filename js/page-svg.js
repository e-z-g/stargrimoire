/* page-svg.js -- a stand-in for a canvas's 2D context that writes SVG, so
   that the map can be saved as a drawing as well as a picture (the
   maintainer's asking, 30 September 2026). It takes the calls the map's
   drawing makes (page-map.js, draw) and no others: paths of lines, arcs and
   rounded corners, strokes and fills in plain colours or a linear gradient,
   dashes, text, pictures, the transform, save and restore. A path's points
   are transformed as they are added, as a canvas does; text and pictures
   carry the transform as it stands. Pictures are embedded as PNG.

   svgContext(w, h) gives the context; its toSVG() the document.

   The page's own script: DOM here. LOAD ORDER: before page-map.js. */

function svgContext(w, h) {
  const out = [], defs = [];
  const num = v => (Math.round(v * 100) / 100).toString();
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // a CSS colour as an SVG colour and an opacity, for readers that do not take rgba()
  const colour = c => {
    const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(String(c).trim());
    return m ? [`rgb(${m[1]},${m[2]},${m[3]})`, m[4] === undefined ? 1 : +m[4]] : [String(c), 1];
  };
  const measure = document.createElement('canvas').getContext('2d');
  const pngOf = new WeakMap();
  const png = img => {
    if (pngOf.has(img)) return pngOf.get(img);
    let c = img;
    if (!c.toDataURL) { c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); }
    const url = c.toDataURL('image/png');
    pngOf.set(img, url);
    return url;
  };
  let st = { m: [1, 0, 0, 1, 0, 0], strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '10px sans-serif',
             textAlign: 'start', textBaseline: 'alphabetic', lineJoin: 'miter', lineCap: 'butt', dash: [], comp: 'source-over' };
  const stack = [];
  let d = '', cur = null, start = null, grads = 0;
  const T = (x, y) => [st.m[0] * x + st.m[2] * y + st.m[4], st.m[1] * x + st.m[3] * y + st.m[5]];
  const scale = () => Math.sqrt(Math.abs(st.m[0] * st.m[3] - st.m[1] * st.m[2]));
  const pt = (x, y) => { const [a, b] = T(x, y); return num(a) + ' ' + num(b); };
  const paint = (style, kind) => {
    if (style && style.svgGradient) return [`url(#${style.svgGradient()})`, 1];
    return colour(style);
  };
  const common = () => (st.comp === 'screen' ? ' style="mix-blend-mode:screen"' : '');
  const ctx = {
    canvas: { width: w, height: h },
    save() { stack.push({ ...st, m: st.m.slice(), dash: st.dash.slice() }); },
    restore() { if (stack.length) st = stack.pop(); },
    setTransform(a, b, c, dd, e, f) { st.m = [a, b, c, dd, e, f]; },
    translate(x, y) { const m = st.m; st.m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; },
    rotate(a) { const m = st.m, c = Math.cos(a), s = Math.sin(a); st.m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]]; },
    scale(x, y) { const m = st.m; st.m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]; },
    setLineDash(a) { st.dash = a.slice(); },
    getLineDash() { return st.dash.slice(); },
    measureText(t) { measure.font = st.font; return measure.measureText(t); },
    createLinearGradient(x0, y0, x1, y1) {
      const [a, b] = T(x0, y0), [c, e] = T(x1, y1), stops = [];
      return {
        addColorStop(o, col) { stops.push([o, col]); },
        svgGradient() {
          const id = 'g' + grads++;
          defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(a)}" y1="${num(b)}" x2="${num(c)}" y2="${num(e)}">` +
            stops.map(([o, col]) => { const [cc, op] = colour(col); return `<stop offset="${o}" stop-color="${cc}"${op < 1 ? ` stop-opacity="${op}"` : ''}/>`; }).join('') + '</linearGradient>');
          return id;
        },
      };
    },
    beginPath() { d = ''; cur = start = null; },
    moveTo(x, y) { d += 'M' + pt(x, y); cur = start = [x, y]; },
    lineTo(x, y) { d += (cur ? 'L' : 'M') + pt(x, y); if (!cur) start = [x, y]; cur = [x, y]; },
    closePath() { if (cur) { d += 'Z'; cur = start; } },
    arc(cx, cy, r, a0, a1, ccw = false) {
      const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
      ctx.lineTo(p0[0], p0[1]);
      let delta = ccw ? a0 - a1 : a1 - a0;
      if (delta >= 2 * Math.PI - 1e-9) {
        // a whole circle: two halves
        const mid = [cx + r * Math.cos(a0 + Math.PI), cy + r * Math.sin(a0 + Math.PI)], R = num(r * scale()), sw = ccw ? 0 : 1;
        d += `A${R} ${R} 0 0 ${sw} ${pt(mid[0], mid[1])}A${R} ${R} 0 0 ${sw} ${pt(p0[0], p0[1])}`;
        cur = p0; return;
      }
      delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], R = num(r * scale());
      d += `A${R} ${R} 0 ${delta > Math.PI ? 1 : 0} ${ccw ? 0 : 1} ${pt(p1[0], p1[1])}`;
      cur = p1;
    },
    arcTo(x1, y1, x2, y2, r) {
      if (!cur) { ctx.moveTo(x1, y1); return; }
      const [x0, y0] = cur, ux = x0 - x1, uy = y0 - y1, vx = x2 - x1, vy = y2 - y1, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      const cross = ux * vy - uy * vx;
      if (!r || !lu || !lv || Math.abs(cross) < 1e-9) { ctx.lineTo(x1, y1); return; }
      const ang = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))), t = r / Math.tan(ang / 2);
      const a = [x1 + ux / lu * t, y1 + uy / lu * t], b = [x1 + vx / lv * t, y1 + vy / lv * t], R = num(r * scale());
      ctx.lineTo(a[0], a[1]);
      d += `A${R} ${R} 0 0 ${cross < 0 ? 1 : 0} ${pt(b[0], b[1])}`;
      cur = b;
    },
    stroke() {
      if (!d) return;
      const [c, op] = paint(st.strokeStyle), a = op * st.globalAlpha;
      out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${num(st.lineWidth * scale())}"` +
        (a < 1 ? ` stroke-opacity="${num(a)}"` : '') + (st.lineJoin !== 'miter' ? ` stroke-linejoin="${st.lineJoin}"` : '') +
        (st.lineCap !== 'butt' ? ` stroke-linecap="${st.lineCap}"` : '') +
        (st.dash.length ? ` stroke-dasharray="${st.dash.map(x => num(x * scale())).join(' ')}"` : '') + common() + '/>');
    },
    fill() {
      if (!d) return;
      const [c, op] = paint(st.fillStyle), a = op * st.globalAlpha;
      out.push(`<path d="${d}" fill="${c}"${a < 1 ? ` fill-opacity="${num(a)}"` : ''}${common()}/>`);
    },
    fillRect(x, y, rw, rh) { const save = d; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rw, y); ctx.lineTo(x + rw, y + rh); ctx.lineTo(x, y + rh); ctx.closePath(); ctx.fill(); d = save; },
    strokeRect(x, y, rw, rh) { const save = d; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rw, y); ctx.lineTo(x + rw, y + rh); ctx.lineTo(x, y + rh); ctx.closePath(); ctx.stroke(); d = save; },
    clearRect() {},
    fillText(text, x, y) {
      const [c, op] = paint(st.fillStyle), a = op * st.globalAlpha;
      const anchor = st.textAlign === 'center' ? 'middle' : st.textAlign === 'right' || st.textAlign === 'end' ? 'end' : 'start';
      const base = { top: 'hanging', middle: 'central', bottom: 'text-after-edge', hanging: 'hanging' }[st.textBaseline];
      out.push(`<text x="${num(x)}" y="${num(y)}" transform="matrix(${st.m.map(num).join(' ')})" style="font:${esc(st.font)}" fill="${c}"` +
        (a < 1 ? ` fill-opacity="${num(a)}"` : '') + ` text-anchor="${anchor}"` + (base ? ` dominant-baseline="${base}"` : '') + common() + `>${esc(text)}</text>`);
    },
    strokeText(text, x, y) {
      const [c, op] = paint(st.strokeStyle), a = op * st.globalAlpha;
      const anchor = st.textAlign === 'center' ? 'middle' : st.textAlign === 'right' || st.textAlign === 'end' ? 'end' : 'start';
      const base = { top: 'hanging', middle: 'central', bottom: 'text-after-edge', hanging: 'hanging' }[st.textBaseline];
      out.push(`<text x="${num(x)}" y="${num(y)}" transform="matrix(${st.m.map(num).join(' ')})" style="font:${esc(st.font)}" fill="none" stroke="${c}" stroke-width="${num(st.lineWidth)}" stroke-linejoin="round"` +
        (a < 1 ? ` stroke-opacity="${num(a)}"` : '') + ` text-anchor="${anchor}"` + (base ? ` dominant-baseline="${base}"` : '') + `>${esc(text)}</text>`);
    },
    drawImage(img, x, y, iw = img.width, ih = img.height) {
      out.push(`<image href="${png(img)}" x="${num(x)}" y="${num(y)}" width="${num(iw)}" height="${num(ih)}" preserveAspectRatio="none" transform="matrix(${st.m.map(num).join(' ')})"` +
        (st.globalAlpha < 1 ? ` opacity="${num(st.globalAlpha)}"` : '') + common() + '/>');
    },
    toSVG() {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        (defs.length ? `<defs>${defs.join('')}</defs>` : '') + out.join('\n') + '</svg>\n';
    },
  };
  // the properties a canvas context has, kept in the state so that save and restore keep them
  for (const k of ['strokeStyle', 'fillStyle', 'lineWidth', 'globalAlpha', 'font', 'textAlign', 'textBaseline', 'lineJoin', 'lineCap'])
    Object.defineProperty(ctx, k, { get: () => st[k], set: v => { st[k] = v; } });
  Object.defineProperty(ctx, 'globalCompositeOperation', { get: () => st.comp, set: v => { st.comp = v; } });
  Object.defineProperty(ctx, 'imageSmoothingEnabled', { get: () => true, set: () => {} });
  return ctx;
}
