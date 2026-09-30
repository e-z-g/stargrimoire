/* nova-labels.js -- names on a map you zoom, placed once so that they behave
   as Been, Daiches and Yap ask of a map you zoom and pan ("Dynamic map
   labeling", IEEE TVCG 12(5), 2006): a name never goes as you zoom in or
   comes as you zoom out, never jumps, and what is shown depends on the zoom
   alone, not on how it was reached.
   =========================================================================

   Each name is given one of its sides and one zoom from which it is shown,
   its active range running from there up without end: the greedy order of
   Been, Nöllenburg, Poon and Wolff ("Optimizing active ranges for
   consistent dynamic map labeling", Computational Geometry 43(3), 2010),
   the names in order of importance, each at the least zoom past which it
   meets no mark on the map and no name before it that is shown there, on
   whichever of its sides makes that zoom least.

   A box is a function of the zoom s giving { x0, x1, y0, y1 } in screen
   pixels, straight in s between the zooms listed as its breaks (a name
   beside a dot whose size is clamped is such a box, its breaks where the
   clamp starts and stops).

   GENERIC, NO DOM. LOAD ORDER: anywhere before page-map.js. */

// Past this zoom a box is taken to go on as it was going.
const LABEL_FAR = 1e6;

/* The greatest zoom at which boxes a and b overlap: 0 if they never do,
   Infinity if they still do however far in. Each of the four ways two boxes
   are apart is straight in s between breaks, so it is solved piece by piece
   where it changes sign. */
function labelsMeetUntil(a, b, breaks) {
  const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
  const cuts = [0, ...breaks.filter(x => x > 0 && x < LABEL_FAR).sort((x, y) => x - y), LABEL_FAR];
  let top = 0;
  for (let i = 0; i + 1 < cuts.length; i++) {
    const s0 = cuts[i], s1 = cuts[i + 1], A0 = a(s0), A1 = a(s1), B0 = b(s0), B1 = b(s1);
    let lo = s0, hi = s1;
    // overlapping is each of these below 0
    for (const [f0, f1] of [[A0.x0 - B0.x1, A1.x0 - B1.x1], [B0.x0 - A0.x1, B1.x0 - A1.x1], [A0.y0 - B0.y1, A1.y0 - B1.y1], [B0.y0 - A0.y1, B1.y0 - A1.y1]]) {
      if (f0 >= 0 && f1 >= 0) { hi = lo; break; }
      if (f0 < 0 && f1 < 0) continue;
      const z = s0 + (s1 - s0) * f0 / (f0 - f1);
      if (f0 < 0) hi = Math.min(hi, z); else lo = Math.max(lo, z);
    }
    if (hi > lo) top = hi;
  }
  return top >= LABEL_FAR ? Infinity : top;
}

/* Every name's side and the zoom it is shown from. items: in order of
   importance, each { sides: [box, ...], breaks, at, near } -- at is its
   point in map units, near how many pixels out from where the point is
   drawn any of its sides reaches at any zoom (Infinity when that grows
   with the zoom); marks: boxes shown at every zoom (the dots), each { box,
   breaks, owner, at, near }, owner the item it belongs to or -1. floor: no
   name is given a zoom below it. Returns [{ side, from }]. */
function labelRanges(items, marks, floor = 0) {
  const { Math, Infinity } = globalThis; // as above
  const out = [];
  // two boxes whose points are d map units apart and reach r and q pixels out
  // are apart past (r + q) / d: a pair that cannot meet past z is not solved
  const apartPast = (p, q) => {
    if (p.near === Infinity || q.near === Infinity) return Infinity;
    const d = Math.max(Math.abs(p.at.x - q.at.x), Math.abs(p.at.y - q.at.y));
    return d > 0 ? (p.near + q.near) / d : Infinity;
  };
  const dist = (p, q) => Math.max(Math.abs(p.at.x - q.at.x), Math.abs(p.at.y - q.at.y));
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    // the marks and the names before it, nearest first: the zoom rises soonest, and the far ones
    // are then passed over
    const near = marks.filter(m => m.owner !== i).map(m => ({ m, d: dist(it, m) }))
      .concat(out.map((o, j) => ({ j, d: dist(it, items[j]) }))).sort((a, b) => a.d - b.d);
    let best = null;
    for (let k = 0; k < it.sides.length; k++) {
      const box = it.sides[k];
      let z = floor;
      for (const { m, j } of near) {
        if (z === Infinity) break;
        if (m) {
          if (apartPast(it, m) <= z) continue;
          z = Math.max(z, labelsMeetUntil(box, m.box, it.breaks.concat(m.breaks)));
        } else {
          const o = out[j];
          if (o.from === Infinity || apartPast(it, items[j]) <= Math.max(z, o.from)) continue;
          const c = labelsMeetUntil(box, items[j].sides[o.side], it.breaks.concat(items[j].breaks));
          if (o.from < c) z = Math.max(z, c);
        }
      }
      if (!best || z < best.from) best = { side: k, from: z };
    }
    out.push(best);
  }
  return out;
}
