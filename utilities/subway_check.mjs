// js/nova-subway.js: the subway maps hold to what its header says, over
// every release in reference/. On the 45-degree map every link is drawn,
// from its place to its place, in steps of one grid step at a multiple of
// 45 degrees; no two links share a step; no link runs over a place other
// than its ends; no two places are nearer than the spacing. On the
// 22.5-degree map every piece of every link is within a quarter of a degree
// of a multiple of 22.5 degrees (those it holds straight by least squares;
// its bends are exact), none passes over a place or runs along another
// link, and no two
// places are nearer than its least distance. The map with room for names
// holds to the 45-degree map's tests, and no link passes a point a name
// takes, no other place is on or beside a name, no two names meet or sit
// side by side in a row, and every name's letters fit its room. The map
// that keeps each link's heading holds to the tests of the map it is made
// on, and every piece of every drawn link is within 45 degrees of the way
// the link truly runs (a 22.5-degree piece within that and its quarter of a
// degree) but for the links the layout counts in stats.astray, which are
// printed and must be fewer than one in fifty; a place whose links cannot
// all leave one point keeping it is a bar (subwayBars), its points in a row
// one step apart round its own, a link from it leaves from one of them, and
// no link runs over or cuts across one. With room for names too,
// its names are put where the lines leave room: none on a line, a place or
// another name, but for those the layout counts in stats.unnamed, fewer
// than one in fifty. On the map with 22.5 degrees only where needed, the
// links drawn with a piece between the 45-degree directions are the ones
// the layout counts (stats.odd), and no more than those it let go for it
// and those with no drawing without (stats.needy, stats.forced). The same
// files give the same
// map twice, and a stored map is used again only for the same galaxy. Each
// nebula, fitted to its picture's brightness, puts the places near it over
// as bright a part as they truly are at least as nearly as fitting to their
// positions alone does, summed over the nebulae; both are printed. The
// crossings, the bends and how many places keep the true order of their
// links round them are printed beside the true galaxy's figures, not
// asserted. Each property's test is first shown to fail on a map broken
// on purpose, so that a pass means something.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

// the stub canvas, for reading the nebulae's pictures
const S = site({ dom: true });
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// The properties, as a list of what is wrong with a laid-out galaxy.
// The points a place takes: its own, or its bar's, from one end to the other a step apart.
function barPoints(r, v) {
  const b = r.bars && r.bars[v];
  if (!b) return [r.at[v]];
  const n = Math.round(Math.max(Math.abs(b.b.x - b.a.x), Math.abs(b.b.y - b.a.y)) / r.step), out = [];
  for (let t = 0; t <= n; t++) out.push({ x: b.a.x + (b.b.x - b.a.x) * t / n, y: b.a.y + (b.b.y - b.a.y) * t / n });
  return out;
}
// What is wrong with the bars: each a row of an odd number of points one step apart along a
// multiple of 45 degrees, its place's own in the middle.
function barProblems(r) {
  const out = [], k = r.step;
  (r.bars || []).forEach((b, v) => {
    if (!b) return;
    const dx = (b.b.x - b.a.x) / k, dy = (b.b.y - b.a.y) / k, n = Math.max(Math.abs(dx), Math.abs(dy));
    if (Math.abs(n - Math.round(n)) > 1e-6 || Math.round(n) % 2 || !n || (Math.abs(dx) > 1e-6 && Math.abs(dy) > 1e-6 && Math.abs(Math.abs(dx) - Math.abs(dy)) > 1e-6)) out.push(`place ${v}'s bar is not a row of points along a multiple of 45 degrees`);
    if (Math.hypot((b.a.x + b.b.x) / 2 - r.at[v].x, (b.a.y + b.b.y) / 2 - r.at[v].y) > 1e-6 * k) out.push(`place ${v} is not in the middle of its bar`);
  });
  return out;
}
// Whether the piece p to q cuts across place w's bar: not one that starts or ends on it, to within
// a millionth of a step, as a link from one of its points does.
const acrossBar = (r, w, p, q) => {
  const c = barPoints(r, w), a = c[0], b = c[c.length - 1], tol = 1e-6 * r.step;
  return c.length > 1 && S.nearSegment(p, a, b) > tol && S.nearSegment(q, a, b) > tol && S.subwayCross(p.x, p.y, q.x, q.y, a.x, a.y, b.x, b.y);
};
function problems(m) {
  const out = barProblems(m.layout), { places, links, layout: r } = m, k = r.step, T = S.SUBWAY_TUNE;
  const onGrid = (a, b) => {
    const dx = (b.x - a.x) / k, dy = (b.y - a.y) / k, rx = Math.round(dx), ry = Math.round(dy);
    return Math.abs(dx - rx) < 1e-6 && Math.abs(dy - ry) < 1e-6 && Math.max(Math.abs(rx), Math.abs(ry)) === 1 ? [rx, ry] : null;
  };
  const key = p => Math.round(p.x / k * 2) + ',' + Math.round(p.y / k * 2);
  const at = new Map(), pts = r.at.map((_, v) => barPoints(r, v));
  pts.forEach((l, i) => { for (const p of l) at.set(key(p), i); });
  const bars = (r.bars || []).map((b, v) => b && v).filter(v => v !== null && v !== false);
  const steps = new Map();
  links.forEach(([a, b], e) => {
    const line = r.lines[e];
    if (!line) { out.push(`link ${e} is not drawn`); return; }
    if (at.get(key(line[0])) !== a || at.get(key(line[line.length - 1])) !== b) out.push(`link ${e} does not run from its place to its place`);
    for (let i = 0; i + 1 < line.length; i++) {
      if (!onGrid(line[i], line[i + 1])) { out.push(`link ${e}, step ${i}, is not one step at a multiple of 45 degrees`); break; }
      const s = [key(line[i]), key(line[i + 1])].sort().join('|');
      if (steps.has(s)) out.push(`links ${steps.get(s)} and ${e} share a step`);
      steps.set(s, e);
      if (i > 0 && at.has(key(line[i]))) out.push(`link ${e} runs over place ${at.get(key(line[i]))}`);
      for (const w of bars) if (acrossBar(r, w, line[i], line[i + 1])) out.push(`link ${e} cuts across place ${w}'s bar`);
    }
  });
  for (let i = 0; i < r.at.length; i++) for (let j = i + 1; j < r.at.length; j++) {
    const d = Math.min(...pts[i].flatMap(p => pts[j].map(q => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))))) / k;
    if (d < T.spacing - 1e-6) out.push(`places ${i} and ${j} are ${d.toFixed(2)} steps apart`);
  }
  if (places.length !== r.at.length) out.push('not every place is laid out');
  return out;
}

function problemsFine(m) {
  const out = barProblems(m.layout), { places, links, layout: r } = m, k = r.step, F = S.SUBWAY_FINE;
  const at = r.at.map(p => ({ x: p.x / k, y: p.y / k }));
  const pts = r.at.map((_, v) => barPoints(r, v).map(p => ({ x: p.x / k, y: p.y / k }))), step = { ...r, step: 1, at, bars: r.bars && r.bars.map(b => b && { a: { x: b.a.x / k, y: b.a.y / k }, b: { x: b.b.x / k, y: b.b.y / k } }) };
  const onPlace = (p, v) => pts[v].some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-6);
  const segs = [];
  links.forEach(([a, b], e) => {
    const line = r.lines[e] && r.lines[e].map(p => ({ x: p.x / k, y: p.y / k }));
    if (!line) { out.push(`link ${e} is not drawn`); return; }
    if (!onPlace(line[0], a) || !onPlace(line[line.length - 1], b)) out.push(`link ${e} does not run from its place to its place`);
    for (let i = 0; i + 1 < line.length; i++) {
      const dx = line[i + 1].x - line[i].x, dy = line[i + 1].y - line[i].y;
      if (S.fineAngErr(dx, dy, S.fineClass(dx, dy)) > F.eps + 1e-9) { out.push(`link ${e}, piece ${i}, is not within a quarter of a degree of a multiple of 22.5`); break; }
      // over a place's points, but for the one the link ends on, or across a bar
      for (let w = 0; w < at.length; w++) if (pts[w].some(q => !(i === 0 && w === a && Math.hypot(q.x - line[0].x, q.y - line[0].y) < 1e-6) && !(i + 2 === line.length && w === b && Math.hypot(q.x - line[i + 1].x, q.y - line[i + 1].y) < 1e-6) && (w !== a && w !== b || pts[w].length > 1) && S.nearSegment(q, line[i], line[i + 1]) < F.clear - 1e-6) || acrossBar(step, w, line[i], line[i + 1])) { out.push(`link ${e} runs over place ${w}`); break; }
      for (const s2 of segs) if (S.runAlong(line[i], line[i + 1], s2.a, s2.b)) out.push(`links ${s2.e} and ${e} run along each other`);
    }
    for (let i = 0; i + 1 < line.length; i++) segs.push({ e, a: line[i], b: line[i + 1] });
  });
  for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
    const d = Math.min(...pts[i].flatMap(p => pts[j].map(q => Math.hypot(p.x - q.x, p.y - q.y))));
    if (d < F.minSep - 1e-6) out.push(`places ${i} and ${j} are ${d.toFixed(2)} steps apart`);
  }
  if (places.length !== r.at.length) out.push('not every place is laid out');
  return out;
}

function problemsNames(m) {
  const out = problems(m), { links, layout: r } = m, k = r.step;
  const g = p => [Math.round((p.x - r.origin.x) / k), Math.round((p.y - r.origin.y) / k)];
  const key = (i, j) => i + ',' + j;
  const at = r.at.map(g), place = new Map(at.map(([i, j], v) => [key(i, j), v]));
  const name = new Map();
  at.forEach(([i, j], v) => {
    if (r.textW[v] > r.width[v] - 0.4 + 1e-9) out.push(`place ${v}'s name does not fit its room`);
    for (const [ci, cj] of S.subwayNameCells(i, j, r.side[v], r.width[v])) {
      if (name.has(key(ci, cj))) out.push(`the names of places ${name.get(key(ci, cj))} and ${v} meet`);
      name.set(key(ci, cj), v);
    }
  });
  for (const [c, v] of name) {
    const [ci, cj] = c.split(',').map(Number);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const w = place.get(key(ci + di, cj + dj));
      if (w !== undefined && w !== v) out.push(`place ${w} is on or beside place ${v}'s name`);
    }
    for (const di of [-1, 1]) { const o = name.get(key(ci + di, cj)); if (o !== undefined && o !== v) out.push(`the names of places ${v} and ${o} sit side by side`); }
  }
  links.forEach((_, e) => { for (const p of r.lines[e] || []) { const [i, j] = g(p); if (name.has(key(i, j))) { out.push(`link ${e} passes place ${name.get(key(i, j))}'s name`); break; } } });
  return out;
}

function problemsNamesFine(m) {
  const out = problemsFine(m), { links, layout: r } = m, k = r.step, F = S.SUBWAY_FINE;
  const g = p => ({ x: (p.x - r.origin.x) / k, y: (p.y - r.origin.y) / k });
  const at = r.at.map(g), box = at.map((p, v) => S.subwayNameBox(p.x, p.y, r.side[v], r.width[v]));
  at.forEach((p, v) => { if (r.textW[v] > r.width[v] - 0.4 + 1e-9) out.push(`place ${v}'s name does not fit its room`); });
  for (let v = 0; v < at.length; v++) for (let w = 0; w < at.length; w++) {
    if (v === w || !box[w]) continue;
    const b = box[w], p = at[v];
    if (p.x > b.x0 - F.clear && p.x < b.x1 + F.clear && p.y > b.y0 - F.clear && p.y < b.y1 + F.clear) out.push(`place ${v} is on or beside place ${w}'s name`);
    if (v < w && box[v] && box[v].x0 < b.x1 && b.x0 < box[v].x1 && box[v].y0 < b.y1 && b.y0 < box[v].y1) out.push(`the names of places ${v} and ${w} meet`);
  }
  links.forEach((_, e) => {
    const l = (r.lines[e] || []).map(g);
    for (let i = 0; i + 1 < l.length; i++) for (let w = 0; w < at.length; w++) if (box[w] && S.subwaySegmentInBox(l[i], l[i + 1], box[w])) { out.push(`link ${e} passes place ${w}'s name`); return; }
  });
  return out;
}

// The links with a piece more than 45 degrees off the way they truly run,
// slack more on a 22.5-degree map, as a list of indices.
function astray(m, slack) {
  const { places, links, layout: r } = m, out = [];
  links.forEach(([a, b], e) => {
    const th = Math.atan2(places[b].y - places[a].y, places[b].x - places[a].x), l = r.lines[e];
    if (l && l.some((p, i) => i + 1 < l.length && S.subwayAngDiff(Math.atan2(l[i + 1].y - p.y, l[i + 1].x - p.x), th) > Math.PI / 4 + slack + 1e-9)) out.push(e);
  });
  return out;
}
function problemsHeading(m, slack) {
  const off = astray(m, slack), n = m.layout.stats.astray, out = [];
  if (off.length !== n) out.push(`${off.length} links are off their heading and the layout counts ${n}`);
  if (off.length * 50 >= m.links.length) out.push(`${off.length} of ${m.links.length} links are off their heading`);
  return out;
}

// On the map with 22.5 degrees only where needed: the links drawn with a
// piece off the 45-degree directions, and whether the layout counts them.
function oddLinks(m) {
  const k = m.layout.step, out = [];
  m.layout.lines.forEach((l, e) => { if (l && l.some((p, i) => i + 1 < l.length && S.fineClass((l[i + 1].x - p.x) / k, (l[i + 1].y - p.y) / k) & 1)) out.push(e); });
  return out;
}
function problemsMixed(m) {
  const n = oddLinks(m).length, s = m.layout.stats, out = [];
  if (n !== s.odd) out.push(`${n} links have a piece off the 45-degree directions and the layout counts ${s.odd}`);
  if (n > s.needy + s.forced) out.push(`${n} links have a piece off the 45-degree directions, more than the ${s.needy} that needed it and ${s.forced} with no drawing without`);
  return out;
}

// The names put where the lines left room (subwayLabels): the ones that
// meet a line, a place or another name, as a list of indices.
function crowded(m) {
  const { layout: r } = m, k = r.step, L = S.SUBWAY_LABEL, out = [];
  const g = p => ({ x: (p.x - r.origin.x) / k, y: (p.y - r.origin.y) / k });
  const at = r.at.map(g), boxes = r.labels.map(l => { const a = g({ x: l.box.x0, y: l.box.y0 }), b = g({ x: l.box.x1, y: l.box.y1 }); return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }; });
  const segs = [];
  r.lines.forEach((l, e) => { if (l) for (let i = 0; i + 1 < l.length; i++) segs.push([g(l[i]), g(l[i + 1]), m.links[e]]); });
  // a bar, its own place's too, no nearer than SUBWAY_LABEL.bar
  (r.bars || []).forEach(b => { if (b) segs.push([g(b.a), g(b.b), [], true]); });
  const grow = (b, c) => ({ x0: b.x0 - c, x1: b.x1 + c, y0: b.y0 - c, y1: b.y1 + c });
  boxes.forEach((b, v) => {
    // its own place's lines may come nearer than others', and its own place is beside it
    const bl = grow(b, L.line - 1e-6), bo = grow(b, L.ownLine - 1e-6), bp = grow(b, L.place - 1e-6), bb = grow(b, L.bar - 1e-6);
    if (segs.some(([p, q, ends, bar]) => S.subwaySegmentInBox(p, q, bar ? bb : ends.includes(v) ? bo : bl)) || at.some((p, w) => w !== v && p.x > bp.x0 && p.x < bp.x1 && p.y > bp.y0 && p.y < bp.y1) ||
        boxes.some((o, w) => w !== v && b.x0 < o.x1 - 1e-6 && o.x0 < b.x1 - 1e-6 && b.y0 < o.y1 - 1e-6 && o.y0 < b.y1 - 1e-6)) out.push(v);
  });
  return out;
}
function problemsLabels(m) {
  const out = [], c = crowded(m), n = m.layout.stats.unnamed, places = m.layout.at.length;
  if (m.layout.labels.length !== places || m.layout.labels.some(l => !l)) out.push('not every place has its name put');
  // two names that meet are both crowded, but only the later was counted
  if (c.length < n || c.length > 2 * n) out.push(`${c.length} names meet something and the layout counts ${n}`);
  if (n * 50 >= places) out.push(`${n} of ${places} names found no room`);
  return out;
}

// The nebulae on a subway map: each the same scale both ways and no larger
// than it is, and any two at least the gap apart.
function nebulaProblems(nebulae, rect) {
  const out = [], rs = nebulae.map(n => rect(n));
  rs.forEach((r, i) => {
    const n = nebulae[i];
    if (r.w > n.w + 1e-9 || r.h > n.h + 1e-9) out.push(`nebula ${i} is drawn larger than it is`);
    if (Math.abs(r.w / n.w - r.h / n.h) > 1e-9) out.push(`nebula ${i} is stretched`);
  });
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const a = rs[i], b = rs[j], need = S.SUBWAY_NEBULA_GAP * Math.min(nebulae[i].w, nebulae[i].h, nebulae[j].w, nebulae[j].h);
    if (Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h)) < need - 1e-9) out.push(`nebulae ${i} and ${j} are nearer than the gap`);
  }
  return out;
}
{
  const neb = [{ x: 0, y: 0, w: 100, h: 50 }, { x: 200, y: 0, w: 80, h: 80 }];
  const ok = nebulaProblems(neb, n => n);
  const big = nebulaProblems(neb, n => ({ ...n, w: n.w * 1.2, h: n.h * 1.2 }));
  const wide = nebulaProblems(neb, n => ({ ...n, w: n.w * 0.9, h: n.h * 0.6 }));
  const close = nebulaProblems(neb, n => (n.x ? { ...n, x: 101 } : n));
  if (ok.length || !big.some(p => /larger/.test(p)) || !wide.some(p => /stretched/.test(p)) || !close.some(p => /gap/.test(p))) fail(`the nebula tests: ${JSON.stringify({ ok, big, wide, close })}`);
  else console.log('the nebula tests catch a nebula made larger, one stretched and two too near');
}

// Proper crossings between two drawn paths, and between two straight links.
function crossings(pts, links) {
  let n = 0;
  const X = (p, q, s, t) => S.subwayCross(p.x, p.y, q.x, q.y, s.x, s.y, t.x, t.y);
  for (let e = 0; e < links.length; e++) for (let f = e + 1; f < links.length; f++) {
    const [a, b] = links[e], [c, d] = links[f];
    if (a === c || a === d || b === c || b === d) continue;
    const P = pts(e), Q = pts(f);
    let hit = false;
    for (let i = 0; i + 1 < P.length && !hit; i++) for (let j = 0; j + 1 < Q.length && !hit; j++) if (X(P[i], P[i + 1], Q[j], Q[j + 1])) hit = true;
    // straight over each other at a grid point
    if (!hit && P.length > 2 && Q.length > 2) {
      const inner = new Set(P.slice(1, -1).map(p => p.x + ',' + p.y));
      hit = Q.slice(1, -1).some(q => inner.has(q.x + ',' + q.y));
    }
    if (hit) n++;
  }
  return n;
}

function turnOrder(p, nbrs) { return nbrs.slice().sort((a, b) => Math.atan2(a.y - p.y, a.x - p.x) - Math.atan2(b.y - p.y, b.x - p.x)); }

// ---- the tests fail where they should ---------------------------------------
{
  const pos = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }, { x: 20, y: 90 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]];
  const r = S.subwayLayout(pos, links);
  const m = { places: pos, links, layout: r };
  const clean = problems(m);
  if (clean.length) fail(`a small graph: ${clean.join('; ')}`);
  const broken = [
    ['a bend off the grid', lines => { const l = lines.find(x => x.length > 2) || lines[0]; l.splice(1, 0, { x: l[0].x + r.step / 2, y: l[0].y + r.step / 3 }); }],
    ['a link not drawn', lines => { lines[2] = null; }],
    ['two links on one step', lines => { lines[1] = lines[0].slice(); }],
    ['a link from the wrong place', lines => { lines[4] = lines[4].slice().reverse(); }],
  ];
  for (const [what, spoil] of broken) {
    const lines = r.lines.map(l => l && l.map(p => ({ ...p })));
    spoil(lines);
    if (!problems({ ...m, layout: { ...r, lines } }).length) fail(`the tests miss ${what}`);
  }
  const e = r.lines.findIndex(l => l.length > 2), c = pos.findIndex((_, i) => !links[e].includes(i));
  const over = r.at.map(p => ({ ...p }));
  over[c] = { ...r.lines[e][1] };
  if (!problems({ ...m, layout: { ...r, at: over } }).some(p => /runs over place/.test(p))) fail('the tests miss a link over a place');
  const near = r.at.map(p => ({ ...p }));
  near[1] = { x: near[0].x + r.step, y: near[0].y };
  if (!problems({ ...m, layout: { ...r, at: near } }).some(p => /apart/.test(p))) fail('the tests miss two places too near');
  if (!fails) console.log('the tests catch a bend off the grid, a link not drawn, two links on one step, a link from the wrong place, a link over a place and places too near');
}

{
  const pos = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }, { x: 20, y: 90 }, { x: 70, y: 70 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]];
  const r = S.subwayLayout(pos, links, S.SUBWAY_TUNE, 'fine');
  const m = { places: pos, links, layout: r };
  const clean = problemsFine(m);
  if (clean.length) fail(`a small graph at 22.5 degrees: ${clean.join('; ')}`);
  const k = r.step, e = 0, [a, b] = links[e];
  const broken = [
    ['a piece at 30 degrees', lines => { const p = lines[e][0], q = lines[e][lines[e].length - 1], L = Math.hypot(q.x - p.x, q.y - p.y) / 2; lines[e] = [p, { x: p.x + L * Math.cos(Math.PI / 6), y: p.y + L * Math.sin(Math.PI / 6) }, q]; }],
    ['a link over a place', lines => { const c = pos.findIndex((_, i) => i !== a && i !== b); lines[e] = [lines[e][0], { ...r.at[c] }, lines[e][lines[e].length - 1]]; }],
    ['two links along each other', lines => { lines[1] = lines[0].slice(); }],
    ['a link not drawn', lines => { lines[2] = null; }],
  ];
  for (const [what, spoil] of broken) {
    const lines = r.lines.map(l => l && l.map(p => ({ ...p })));
    spoil(lines);
    if (!problemsFine({ ...m, layout: { ...r, lines } }).length) fail(`the 22.5-degree tests miss ${what}`);
  }
  const near = r.at.map(p => ({ ...p }));
  near[1] = { x: near[0].x + k * 0.5, y: near[0].y };
  if (!problemsFine({ ...m, layout: { ...r, at: near } }).some(p => /apart/.test(p))) fail('the 22.5-degree tests miss two places too near');
  console.log('the 22.5-degree tests catch a piece at 30 degrees, a link over a place, two links along each other, a link not drawn and places too near');
}

{
  const pos = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }, { x: 30, y: 120 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]], chars = [5, 9, 3, 7, 11];
  const r = S.subwayLayout(pos, links, S.SUBWAY_NAMES, 'names', chars);
  const m = { places: pos, links, layout: r };
  const clean = problemsNames(m);
  if (clean.length) fail(`a small graph with room for names: ${clean.join('; ')}`);
  const k = r.step, cellAt = (v, t) => { const [ci, cj] = S.subwayNameCells(Math.round((r.at[v].x - r.origin.x) / k), Math.round((r.at[v].y - r.origin.y) / k), r.side[v], r.width[v])[t]; return { x: r.origin.x + ci * k, y: r.origin.y + cj * k }; };
  const e = 0, [a] = links[e], other = [1, 2, 3, 4].find(v => v !== links[e][1]);
  const broken = [
    ['a link through a name', l => { l.lines = l.lines.map(x => x && x.slice()); l.lines[e] = [l.lines[e][0], cellAt(other, 0), l.lines[e][l.lines[e].length - 1]]; }],
    ['a place beside a name', l => { l.at = l.at.map(p => ({ ...p })); const c = cellAt(0, r.width[0] - 1); l.at[other] = { x: c.x + (r.side[0] > 0 ? k : -k), y: c.y }; }],
    ['a name too long for its room', l => { l.textW = l.textW.slice(); l.textW[0] = r.width[0]; }],
  ];
  const before = fails;
  for (const [what, spoil] of broken) {
    const l = { ...r };
    spoil(l);
    if (!problemsNames({ ...m, layout: l }).length) fail(`the names tests miss ${what}`);
  }
  // two places in one row, their names meeting at one point
  const row = { step: 1, origin: { x: 0, y: 0 }, at: [{ x: 0, y: 0 }, { x: 6, y: 0 }], lines: [], side: [1, -1], width: [3, 3], textW: [2, 2] };
  if (!problemsNames({ places: row.at, links: [], layout: row }).some(p => /meet/.test(p))) fail('the names tests miss names that meet');
  if (fails === before) console.log('the names tests catch a link through a name, a place beside a name, names that meet and a name too long for its room');
}

{
  const pos = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }, { x: 30, y: 120 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]], chars = [5, 9, 3, 7, 11];
  const r = S.subwayLayout(pos, links, S.SUBWAY_NAMES, 'names-fine', chars);
  const m = { places: pos, links, layout: r };
  const clean = problemsNamesFine(m);
  if (clean.length) fail(`a small graph at 22.5 degrees with room for names: ${clean.join('; ')}`);
  const k = r.step, v = 0, b = S.subwayNameBox((r.at[v].x - r.origin.x) / k, (r.at[v].y - r.origin.y) / k, r.side[v], r.width[v]);
  const mid = { x: r.origin.x + k * (b.x0 + b.x1) / 2, y: r.origin.y + k * (b.y0 + b.y1) / 2 };
  const e = links.findIndex(([a, c]) => a !== v && c !== v);
  const lines = r.lines.map(l => l && l.slice());
  lines[e] = [lines[e][0], mid, lines[e][lines[e].length - 1]];
  if (!problemsNamesFine({ ...m, layout: { ...r, lines } }).some(p => /passes place/.test(p))) fail('the 22.5-degree names tests miss a link through a name');
  const atMoved = r.at.map(p => ({ ...p })); atMoved[links[e][0]] = mid;
  if (!problemsNamesFine({ ...m, layout: { ...r, at: atMoved } }).some(p => /beside place/.test(p))) fail('the 22.5-degree names tests miss a place on a name');
  console.log('the 22.5-degree names tests catch a link through a name and a place on a name');
}

{
  // a small galaxy whose links all keep their heading, and a link turned back on itself
  const pos = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }, { x: 20, y: 90 }, { x: 70, y: 70 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]];
  const before = fails;
  for (const kind of ['heading', 'fine-heading']) {
    const r = S.subwayLayout(pos, links, S.SUBWAY_TUNE, kind), m = { places: pos, links, layout: r }, slack = kind === 'heading' ? 0 : S.SUBWAY_FINE.eps;
    const clean = (kind === 'heading' ? problems(m) : problemsFine(m)).concat(astray(m, slack).map(e => `link ${e} is off its heading`));
    if (clean.length) fail(`a small graph, ${kind}: ${clean.join('; ')}`);
    // link 0 runs east: a first piece north-west instead
    const lines = r.lines.map(l => l && l.map(p => ({ ...p }))), l = lines[0], k = r.step;
    lines[0] = [l[0], { x: l[0].x - k, y: l[0].y - k }, l[l.length - 1]];
    if (!astray({ ...m, layout: { ...r, lines } }, slack).includes(0)) fail(`the heading test, ${kind}, misses a piece turned back`);
    if (!problemsHeading({ ...m, layout: { ...r, lines } }, slack).length) fail(`the heading test, ${kind}, misses a link off its heading that the layout did not count`);
  }
  if (fails === before) console.log('the heading tests catch a piece turned back, and a link off its heading that the layout did not count');
}

{
  // a place five of whose six links truly head within 70 degrees of north-east: a bar on each map that
  // keeps headings, every link from a point of it and within its heading; then a link from beside
  // the bar, and a piece cut across it
  const deg = [-20, -40, -55, -75, -88, 150], R = [60, 50, 45, 55, 40, 50];
  const pos = [{ x: 0, y: 0 }, ...deg.map((d, i) => ({ x: R[i] * Math.cos(d * Math.PI / 180), y: R[i] * Math.sin(d * Math.PI / 180) }))];
  const links = deg.map((_, i) => [0, i + 1]);
  const before = fails;
  for (const kind of ['heading', 'fine-heading', 'mixed-heading']) {
    const F = S.subwayFlags(kind), r = S.subwayLayout(pos, links, S.SUBWAY_TUNE, kind), m = { places: pos, links, layout: r }, slack = F.fine ? S.SUBWAY_FINE.eps : 0;
    if (!r.bars || !r.bars[0] || r.stats.bars !== 1) { fail(`a crowded place, ${kind}, is not made a bar`); continue; }
    const clean = (F.fine ? problemsFine(m) : problems(m)).concat(astray(m, slack).map(e => `link ${e} is off its heading`), F.mixed ? problemsMixed(m) : []);
    if (clean.length) fail(`a crowded place, ${kind}: ${clean.join('; ')}`);
    const k = r.step, b = r.bars[0], c = barPoints(r, 0), n = c.length - 1, beyond = { x: b.a.x - (b.b.x - b.a.x) / n, y: b.a.y - (b.b.y - b.a.y) / n };
    const e = r.lines.findIndex(l => Math.hypot(l[0].x - b.a.x, l[0].y - b.a.y) < 1e-6 * k);
    const off = r.lines.map(l => l.slice()); off[e] = [beyond, ...off[e]];
    if (!(F.fine ? problemsFine : problems)({ ...m, layout: { ...r, lines: off } }).some(p => /from its place/.test(p))) fail(`the bar tests, ${kind}, miss a link from beside its bar`);
    if (c[0].x !== c[1].x && c[0].y !== c[1].y) {
      const across = r.lines.map(l => l.slice()); across[5] = [{ x: c[0].x, y: c[1].y }, { x: c[1].x, y: c[0].y }];
      if (!(F.fine ? problemsFine : problems)({ ...m, layout: { ...r, lines: across } }).some(p => /cuts across|runs over place 0/.test(p))) fail(`the bar tests, ${kind}, miss a piece cut across a bar`);
    } else fail(`the bar tests, ${kind}: the bar is not at a slant, so a piece across it is not tried`);
  }
  // asked for points only (dots), the same place is a point, every link from it
  const dots = S.subwayLayout(pos, links, S.SUBWAY_TUNE, 'heading-dots'), dp = problems({ places: pos, links, layout: dots });
  if (dots.bars || dots.stats.bars !== 0 || dp.length) fail(`a crowded place asked for as a point: ${JSON.stringify(dots.stats)}; ${dp.join('; ')}`);
  if (fails === before) console.log('a crowded place is a bar on each map that keeps headings, and a point when asked for points only; the bar tests catch a link from beside the bar and a piece cut across it');
}

{
  // the map with 22.5 degrees only where needed, on a small galaxy: then a link bent at 22.5 degrees
  // that the layout did not count
  const pos = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }, { x: 20, y: 90 }, { x: 70, y: 70 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]];
  const r = S.subwayLayout(pos, links, S.SUBWAY_TUNE, 'mixed'), m = { places: pos, links, layout: r };
  const clean = problemsFine(m).concat(problemsMixed(m));
  if (clean.length) fail(`a small graph, 22.5 degrees only where needed: ${clean.join('; ')}`);
  const e = oddLinks(m).length ? r.lines.findIndex((_, f) => !oddLinks(m).includes(f)) : 0, l = r.lines[e], p = l[0], q = l[l.length - 1], L = Math.hypot(q.x - p.x, q.y - p.y) / 2, a = Math.atan2(q.y - p.y, q.x - p.x) + Math.PI / 8;
  const lines = r.lines.map(x => x.slice()); lines[e] = [p, { x: p.x + L * Math.cos(a), y: p.y + L * Math.sin(a) }, q];
  if (!problemsMixed({ ...m, layout: { ...r, lines } }).length) fail('the tests of 22.5 degrees only where needed miss a link bent at 22.5 degrees that the layout did not count');
  else console.log('the tests of 22.5 degrees only where needed catch a link bent at 22.5 degrees that the layout did not count');
}

{
  // names put where the lines left room, on a small galaxy: then one moved onto a line
  const pos = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }, { x: 30, y: 120 }];
  const links = [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4]], chars = [5, 9, 3, 7, 11];
  const r = S.subwayLayout(pos, links, S.SUBWAY_NAMES, 'names-heading', chars), m = { places: pos, links, layout: r };
  const clean = problems(m).concat(astray(m, 0).map(e => `link ${e} is off its heading`), problemsLabels(m), crowded(m).map(v => `place ${v}'s name meets something`));
  if (clean.length) fail(`a small graph, names put after the lines: ${clean.join('; ')}`);
  const l = r.lines[0], mid = { x: (l[0].x + l[l.length - 1].x) / 2, y: (l[0].y + l[l.length - 1].y) / 2 }, b = r.labels[4].box;
  const labels = r.labels.map(x => ({ ...x })), w = b.x1 - b.x0, h = b.y1 - b.y0;
  labels[4] = { ...labels[4], box: { x0: mid.x - w / 2, x1: mid.x + w / 2, y0: mid.y - h / 2, y1: mid.y + h / 2 } };
  const spoilt = { ...m, layout: { ...r, labels } };
  if (!crowded(spoilt).includes(4) || !problemsLabels(spoilt).length) fail('the names tests miss a name put on a line that the layout did not count');
  else console.log('the tests of names put after the lines catch a name on a line that the layout did not count');
}

// ---- a stored map is used again for the same galaxy and no other -------------
{
  const sys = [[128, 0, 0, [129, 130]], [129, 40, 0, [128, 130]], [130, 20, 40, [128, 129, 131]], [131, 20, 90, [130]]];
  const fake = list => { const systems = list.map(([id, x, y, links]) => ({ id, x, y, links })); return { systems, byId: new Map(systems.map(s => [s.id, s])) }; };
  const a = S.novaSubway(fake(sys));
  if (S.novaSubway(fake(sys), a.layout).layout !== a.layout) fail('a stored map for the same galaxy is not used');
  const moved = sys.map(r => r.slice()); moved[3][1] = 25;
  if (S.novaSubway(fake(moved), a.layout).layout === a.layout) fail('a stored map is used for another galaxy');
  if (!fails) console.log('a stored map is used for the same galaxy and not for one with a system moved');
}

// ---- every release ---------------------------------------------------------
const done = [];
const KINDS = [['45', '45-degree', problems], ['fine', '22.5-degree', problemsFine], ['fine-mixed', '22.5-degree only where needed', m => problemsFine(m).concat(problemsMixed(m))], ['names', 'room for names', problemsNames], ['names-fine', '22.5-degree with room for names', problemsNamesFine], ['names-fine-mixed', '22.5-degree only where needed with room for names', m => problemsNamesFine(m).concat(problemsMixed(m))]];
for (const [kind, name] of KINDS.slice()) {
  const F = S.subwayFlags(kind), slack = F.fine ? S.SUBWAY_FINE.eps : 0, test = F.fine ? problemsFine : problems;
  KINDS.push([kind === '45' ? 'heading' : kind + '-heading', name + ', keeping headings', m => test(m).concat(problemsHeading(m, slack), F.names ? problemsLabels(m) : [], F.mixed ? problemsMixed(m) : [])]);
}
// names never across a line from their place (side): the map with every switch on, and no name so
{
  const all = KINDS.find(([k]) => k === 'names-fine-mixed-heading');
  KINDS.push(['names-fine-mixed-heading-side', all[1] + ', no name across a line from its place', m => all[2](m).concat(m.layout.stats.across ? [`${m.layout.stats.across} names across a line from their places`] : [])]);
}
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const u = S.novaUniverse(openRelease(S, v));
  for (const [kind, name, test] of KINDS) {
    const same = done.find(d => d.kind === kind && S.novaSubway(u, d.layout, kind).layout === d.layout);
    if (same) { console.log(`${v}, ${name}: the same galaxy as ${same.v}, so the same map`); continue; }
    const t0 = Date.now();
    const m = S.novaSubway(u, null, kind);
    const ms = Date.now() - t0;
    const p = test(m).concat(nebulaProblems(u.nebulae, m.rect));
    if (p.length) fail(`${v}, ${name}: ${p.length} problems: ${p.slice(0, 6).join('; ')}`);
    const r = m.layout;
    // the brightness under the places near each nebula, against its true, fitted to the picture or not
    const game = u.game, brights = u.nebulae.map(n => { const id = S.novaNebulaPict(u, n, 1e3), c = id !== null && S.decodePict(game.get('PICT', id).bytes).canvas; return c && c._pixels ? S.subwayBrightness(c._pixels, c._w, c._h) : null; });
    const mismatch = bs => u.nebulae.map((n, j) => {
      if (!brights[j]) return 0;
      const q = m.rect(n, bs);
      let e = 0;
      m.places.forEach((p, i) => { e += Math.abs(S.subwayBrightAt(brights[j], (r.at[i].x - q.x) / q.w, (r.at[i].y - q.y) / q.h) - S.subwayBrightAt(brights[j], (p.x - n.x) / n.w, (p.y - n.y) / n.h)); });
      return e;
    });
    const byPlace = mismatch(null), byBright = mismatch(brights), sum = a => a.reduce((x, y) => x + y, 0);
    if (sum(byBright) > sum(byPlace) + 1e-9) fail(`${v}, ${name}: the nebulae fitted to their pictures match the brightness worse (${sum(byBright).toFixed(2)}) than fitted to the places (${sum(byPlace).toFixed(2)})`);
    let bends = 0, straight = 0;
    for (const l of r.lines) if (l) {
      let b = 0;
      for (let i = 1; i + 1 < l.length; i++) if (Math.abs(Math.atan2(l[i].y - l[i - 1].y, l[i].x - l[i - 1].x) - Math.atan2(l[i + 1].y - l[i].y, l[i + 1].x - l[i].x)) > 1e-9) b++;
      bends += b; if (!b) straight++;
    }
    const trueX = crossings(e => [m.places[m.links[e][0]], m.places[m.links[e][1]]], m.links);
    const subX = crossings(e => r.lines[e], m.links);
    const nbrs = m.places.map(() => []);
    m.links.forEach(([a, b]) => { nbrs[a].push(b); nbrs[b].push(a); });
    let kept = 0, busy = 0;
    nbrs.forEach((l, i) => {
      if (l.length < 3) return;
      busy++;
      const a = turnOrder(m.places[i], l.map(j => ({ ...m.places[j], j }))).map(q => q.j);
      const firstStep = j => { const e = m.links.findIndex(([x, y]) => (x === i && y === j) || (x === j && y === i)); const line = m.links[e][0] === i ? r.lines[e] : r.lines[e].slice().reverse(); return line[1]; };
      const b = turnOrder(r.at[i], l.map(j => ({ ...firstStep(j), j }))).map(q => q.j);
      const k = b.indexOf(a[0]);
      if (a.every((j, t) => b[(k + t) % b.length] === j)) kept++;
    });
    console.log(`${v}, ${name}: ${m.places.length} places and ${m.links.length} links laid out in ${(ms / 1000).toFixed(1)} s (in node:vm);` +
                ` ${straight} links straight, ${bends} bends in all; ${subX} crossings, ${trueX} in the true galaxy;` +
                ` ${kept} of ${busy} places with three links or more keep their true order; brightness under the places near each nebula off by ${byBright.map(x => x.toFixed(2)).join(', ')} (${byPlace.map(x => x.toFixed(2)).join(', ')} fitted to the places); ${JSON.stringify(r.stats)}`);
    const twice = S.subwayLayout(m.places, m.links, S.subwayTuneFor(kind), kind, m.names, u.nebulae);
    if (JSON.stringify(twice.lines) !== JSON.stringify(r.lines)) fail(`${v}, ${name}: two layouts of the same galaxy differ`);
    done.push({ v, kind, layout: r });
  }
}
process.exit(fails ? 1 : 0);
