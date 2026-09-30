// js/nova-labels.js: names placed once for every zoom hold to what its header
// says. labelsMeetUntil, the greatest zoom at which two boxes overlap, agrees
// with trying a dense run of zooms, for names beside dots whose size is
// clamped and for names under sprites that grow with the zoom. labelRanges
// gives every name one side and one zoom from which it shows, and at every
// zoom tried no two names then shown overlap and no name covers another's
// dot -- on random maps and on every release's galaxy, whose names are
// printed as they come in. Each test is first shown to fail on a result
// spoilt on purpose: a name shown before its zoom.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// a random source that gives the same run every time (mulberry32)
function rand(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const meet = (A, B) => A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1;
const ZOOMS = Array.from({ length: 6000 }, (_, i) => 1e-3 * Math.pow(1e7, i / 5999));

// the page's names beside dots: a dot of radius clamped between 3 and 8, four sides
const dotRadius = s => Math.max(3, Math.min(8, 1.6 + s * 1.9)), DOT_BREAKS = [(3 - 1.6) / 1.9, (8 - 1.6) / 1.9];
const SIDES = (r, w) => [{ x: r + 3, y: -7 }, { x: -r - 5 - w, y: -7 }, { x: -w / 2, y: -r - 17 }, { x: -w / 2, y: r + 3 }];
const nameBox = (p, w, k) => s => { const o = SIDES(dotRadius(s), w)[k], x = p.x * s + o.x, y = p.y * s + o.y; return { x0: x, x1: x + w + 2, y0: y, y1: y + 14 }; };
const dotBox = p => s => { const r = dotRadius(s); return { x0: p.x * s - r, x1: p.x * s + r, y0: p.y * s - r, y1: p.y * s + r }; };
// a name under a sprite that grows with the zoom, at least 26 pixels
const spriteH = (h0, s) => Math.max(h0 * s, 26);
const underBox = (p, w, h0) => s => { const x = p.x * s, y = p.y * s + spriteH(h0, s) / 2 + 4; return { x0: x - w / 2, x1: x + w / 2, y0: y, y1: y + 14 }; };

// ---- the greatest zoom at which two boxes meet, against a dense run ------
{
  const R = rand(7);
  let worst = 0, n = 0;
  for (let t = 0; t < 400; t++) {
    const p = { x: R() * 100 - 50, y: R() * 100 - 50 }, q = { x: R() * 100 - 50, y: R() * 100 - 50 };
    const under = t % 2 === 1, wa = 20 + R() * 100, wb = 20 + R() * 100, h0 = 10 + R() * 60, h1 = 10 + R() * 60;
    const a = under ? underBox(p, wa, h0) : nameBox(p, wa, t % 4 === 0 ? 0 : Math.floor(R() * 4));
    const b = under ? underBox(q, wb, h1) : (t % 3 ? nameBox(q, wb, Math.floor(R() * 4)) : dotBox(q));
    const breaks = under ? [26 / h0, 26 / h1] : DOT_BREAKS;
    const got = S.labelsMeetUntil(a, b, breaks);
    let last = 0;
    for (const s of ZOOMS) if (meet(a(s), b(s))) last = s;
    // the dense run's last meeting is at or just below the answer, never past it
    const next = ZOOMS.find(s => s > last) || Infinity;
    if (last === 0 && got !== 0 && got > ZOOMS[0]) { fail(`boxes ${t}: never meet in the run, solved as meeting until ${got}`); continue; }
    if (last > 0 && !(got >= last - 1e-9 && got <= next + 1e-9)) fail(`boxes ${t}: last meet in the run ${last}, solved as ${got}`);
    if (last > 0) { worst = Math.max(worst, Math.abs(got - last) / last); n++; }
  }
  if (!fails) console.log(`labelsMeetUntil agrees with ${ZOOMS.length} zooms tried for 400 pairs (${n} that meet), within ${(worst * 100).toFixed(2)}% of a step`);
}

// ---- names placed once: none overlaps another shown, or another's dot -----
// the overlaps at the zooms tried, of names shown there
function overlaps(pts, widths, got, zooms) {
  const out = [];
  for (const s of zooms) {
    const shown = got.map((g, i) => (s >= g.from ? nameBox(pts[i], widths[i], g.side)(s) : null));
    for (let i = 0; i < pts.length; i++) {
      if (!shown[i]) continue;
      for (let j = 0; j < pts.length; j++) {
        if (j === i) continue;
        if (j > i && shown[j] && meet(shown[i], shown[j])) { out.push(`names ${i} and ${j} at ${s.toFixed(3)}`); break; }
        if (meet(shown[i], dotBox(pts[j])(s))) { out.push(`name ${i} over dot ${j} at ${s.toFixed(3)}`); break; }
      }
    }
    if (out.length > 5) break;
  }
  return out;
}
function place(pts, widths) {
  const items = pts.map((p, i) => ({ at: p, near: widths[i] + 25, breaks: DOT_BREAKS, sides: [0, 1, 2, 3].map(k => nameBox(p, widths[i], k)) }));
  const marks = pts.map((p, i) => ({ owner: i, at: p, near: 8, breaks: DOT_BREAKS, box: dotBox(p) }));
  return S.labelRanges(items, marks);
}
const TRY = Array.from({ length: 80 }, (_, i) => 0.05 * Math.pow(400, i / 79));
{
  const R = rand(11), pts = Array.from({ length: 150 }, () => ({ x: R() * 400, y: R() * 300 })), widths = pts.map(() => 25 + R() * 90);
  const got = place(pts, widths);
  const bad = overlaps(pts, widths, got, TRY);
  if (bad.length) fail(`150 random places: ${bad.slice(0, 4).join('; ')}`);
  // spoilt on purpose: the name that came in latest shown from the start
  const i = got.reduce((a, g, k) => (g.from > got[a].from && g.from < Infinity ? k : a), 0);
  const spoilt = got.map((g, k) => (k === i ? { ...g, from: 0 } : g));
  if (!overlaps(pts, widths, spoilt, TRY).length) fail('the overlap test misses a name shown before its zoom');
  else if (!bad.length) console.log(`150 random places: no name meets another or a dot at ${TRY.length} zooms, and a name shown before its zoom is caught`);
}

// ---- every release's galaxy ------------------------------------------------
const seen = new Set();
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const u = S.novaUniverse(openRelease(S, v)), shown = S.novaShownSystems(u, { bits: new Set(), male: true, registered: true });
  const by = new Map();
  for (const s of u.systems) if (shown.has(s.id)) { const k = s.x + ',' + s.y; if (!by.has(k)) by.set(k, { x: s.x, y: s.y, name: s.name, links: 0 }); }
  for (const s of u.systems) if (shown.has(s.id)) for (const l of s.links) if (shown.has(l)) by.get(s.x + ',' + s.y).links++;
  const places = [...by.values()].sort((a, b) => b.links - a.links || a.y - b.y || a.x - b.x);
  const key = JSON.stringify(places.map(p => [p.x, p.y, p.name]));
  if (seen.has(key)) { console.log(`${v}: the same places as a release before`); continue; }
  seen.add(key);
  // 11.5 px letters, about 6.2 px each: the page measures them
  const widths = places.map(p => p.name.length * 6.2);
  const t0 = Date.now(), got = place(places, widths), ms = Date.now() - t0;
  const bad = overlaps(places, widths, got, TRY);
  if (bad.length) fail(`${v}: ${bad.slice(0, 4).join('; ')}`);
  const at = s => got.filter(g => g.from <= s).length;
  console.log(`${v}: ${places.length} names placed in ${ms} ms, none meeting another or a dot at ${TRY.length} zooms; shown at 37% ${at(0.37)}, 90% ${at(0.9)}, 150% ${at(1.5)}, 200% ${at(2)}, 300% ${at(3)}, 500% ${at(5)}`);
}
process.exit(fails ? 1 : 0);
