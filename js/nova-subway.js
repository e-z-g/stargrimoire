/* nova-subway.js -- the galaxy as a subway map: every hyperspace link drawn
   in straight runs at multiples of 45 degrees, the systems spread out
   evenly and each kept near where it really is.
   =========================================================================

   Three stages, each after published work.

   EVENING OUT. Links run from 8 to 134 map units in the stock galaxy, and
   the busiest regions are the most crowded. Each system is moved so that
   its distance to every other is its number of jumps times the typical
   link: stress majorization (Gansner, Koren and North, "Graph drawing by
   stress majorization", 2004), with a pull of every system towards its true
   position so that the galaxy keeps its shape.

   PLACING. Each system is put on a grid point, busiest first, at the free
   point nearest its evened position; no two share a point or a neighbouring
   one. Then each in turn moves to the nearby point that best balances what
   Stott, Rodgers, Martinez-Ovando and Walker weigh ("Automatic metro map
   layout using multicriteria optimization", 2011): links at a multiple of
   45 degrees, links of one length, a system with two links drawn straight
   through, each link keeping its direction, few crossings, no link over
   another system, and not far from where it was; and two of our own: a
   system with one link hangs off it at an angle rather than level, where
   its name would sit on the line (the maintainer's asking), and a system
   in a nebula stays within four fifths of the nebula's size of the others
   in it, so that the nebula's picture, not stretched, still holds them,
   and as far and the way from their middle as it truly is.
   A move that would change
   the order of the links round a system is not made: the order they have
   once evened out, which is nearly always the true galaxy's
   (utilities/subway_check.mjs prints how nearly).

   ROUTING. Each link is a path on the grid, found by a shortest-path
   search that charges a step, half a step more on the diagonal, and a bend
   by its angle: Bast, Brosi and Storandt's costs ("Metro maps on
   octilinear grid graphs", 2020), 1 for 45 degrees, 1.5 for 90 and 2 for
   135. Two links never share a step; they may cross, at a price, straight
   over each other. Round each system the links leave in that same order,
   the rule of that paper. A link that finds no
   way through takes the way through the fewest others, which are then
   routed again (rip-up and reroute, as circuit boards are routed). Last,
   that paper's local search: each link routed again alone, and each system
   tried at its eight neighbouring points with its links routed again,
   kept where the drawing costs less.

   THE 22.5-DEGREE MAP is the 45-degree one loosened off its grid
   (subwayFine, below). THE MAP WITH ROOM FOR NAMES keeps grid points for
   each system's name beside, above or below it, which no other system or
   name comes next to and no link crosses (subwayNameCells); its links are
   longer, to make the room. The two combine: the names are then boxes that
   move with their systems as the 22.5-degree stage moves them.

   THE MAP THAT KEEPS EACH LINK'S HEADING (the maintainer's asking, 28
   September 2026) draws every piece of every link within 45 degrees of the
   way the link really runs from one end to the other, so that no line
   sets off the wrong way or doubles back: the evening out pulls harder
   towards the true galaxy, a place is charged heavily for each of its
   links turned further than that, the router takes only the directions
   within it, and so does the 22.5-degree stage. A few links at crowded
   places cannot keep it: each is drawn as near it as the router finds,
   within twice that where it can, and counted (stats.astray). It combines
   with the other two, but room for names is then made another way. Room
   kept for each name before the links are routed, as the map with room for
   names keeps it, is a row of grid points no link crosses, and a link held
   within 45 degrees of its heading often cannot get round one (a twentieth
   of the stock galaxy's links could not, some turned right back). So room
   is kept for each name as on that map, but a link may pass through it at
   a price, and each name is put last: in its room where no line took it,
   and else where the lines left room, near its place and clear of others
   (subwayLabels).

   STATIONS AS BARS (the maintainer's asking, 28 September 2026). On the
   map that keeps each link's heading, a place whose links the eight
   directions of one point cannot all take, each in its true order and
   within 45 degrees of its heading, is drawn as metro maps draw a busy
   station: a bar of three or five grid points, across the way most of its
   lines leave, so that they leave it side by side (subwayBars). Each of its
   links is given a port, a point of the bar and a direction, which the
   placing measures it from and the router leaves by; the 22.5-degree stage
   leaves the bar and the places linked to it where they are.

   THE MAP WITH 22.5 DEGREES ONLY WHERE NEEDED (the maintainer's asking, 29
   September 2026) is the 22.5-degree map with a piece between the
   45-degree directions only in the links whose 45-degree drawing is
   awkward (subwayNeedy, which says why nearness to the true direction is
   not among the reasons).

   WHAT IS LAID OUT is every system and every link there is, all versions
   of a place at once (nova-universe.js), so that the map does not change
   when the control bits do; a link is drawn only when both its ends are
   shown. A place is a position in the galaxy, as the map's discs are.

   ONE FUNCTION, subwayModule: the page works a layout out in a background
   thread (a Web Worker) started from that function's own text, since a page
   opened from file:// cannot load a script file into one. It gives back
   its names, which are set as globals here, as the other scripts' are.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-universe.js. */

function subwayModule() {
  const SUBWAY_DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // clockwise on the screen
  const subwayTurn = (a, b) => { const t = Math.abs(a - b) % 8; return Math.min(t, 8 - t); };

  /* The map with room for names: links nearly twice as long, so that the
     names fit between them; a name is charW grid steps a character, its letters
     0.72 of a step high where the page draws them. */
  const SUBWAY_NAMES = {
    len: 7, spacing: 2, evenIters: 100, evenPull: 1, charW: 0.42,
    place: { move: 0.5, oct: 4, length: 1, dir: 2, cross: 30, over: 30, straight: 2, radius: 4, sweeps: 12, flatLeaf: 1.5, nebula: 4, nebulaShape: 1.5, near: { reach: 2.5, count: 12, weight: 5 }, overName: 30, side: [0, 0.3, 0.5, 0.8, 20, 20.3] },
    route: { hop: 1, diag: 0.5, bend: [0, 1, 1.5, 2, Infinity], through: 1, port: 2, cross: 6, conflict: 30, hist: 1, rip: 10, maxRip: 20, margin: 3, improve: 3, move: 0.05, unrouted: 200, leaveStraight: true, nebulaShape: 5 },
  };

  /* The numbers. len is a typical link in grid steps and spacing the least
     distance between two systems; place and route are the weights of the
     placing and the costs of the routing. */
  const SUBWAY_TUNE = {
    len: 4, spacing: 2, evenIters: 100, evenPull: 1,
    place: { move: 0.5, oct: 4, length: 1, dir: 2, cross: 30, over: 30, straight: 2, radius: 4, sweeps: 12, flatLeaf: 1.5, nebula: 4, nebulaShape: 1.5 },
    route: { hop: 1, diag: 0.5, bend: [0, 1, 1.5, 2, Infinity], through: 1, port: 2, cross: 6, conflict: 30, hist: 1, rip: 10, maxRip: 20, margin: 3, improve: 3, move: 0.05, unrouted: 200, nebulaShape: 0 },
  };

  /* The map that keeps each link's heading: how far a piece may turn from
     the link's true direction, the evening out's pull to the true galaxy
     (8, where the other maps' 1 turns a fifth of the stock galaxy's links
     further than 45 degrees before the placing starts), and what the placing
     charges for a link turned past it, more the further past. tangle: a
     place whose links truly cross c others is pulled 1 / (1 + c / tangle) as
     hard, so that a tangle can come apart (the maintainer found the K-
     systems round the L-1551 nebula one, 29 September 2026: 31 links there
     truly cross 37 times). At 5 the stock galaxy's crossings in all fell
     from 39 to 28 with room for names, 34 to 25 without, 33 to 27 with 22.5
     degrees where needed, links off their heading 1 to 3 at most; 4 and 6
     did less, as the layout answers small changes unevenly, and 12 nothing.
     Most of the tangle is the galaxy's own: with no heading kept at all,
     the map with room for names still crosses 17 times there.
     ownName: what a link pays, as a share of nameStep, to cross the room kept
     for the name of a place it ends at. The names are put last, so that room
     is only a plan, and at the full price a line would bend round its own
     station's name rather than run straight on out of it (Starfleet
     Adventures' Chuch'Hov, whose line to Tak'lur bent three times for it, 30
     September 2026); at 0 the stock galaxy's lines ran straight through
     stations 196 times where they had 141, at a quarter of it no fewer. */
  const SUBWAY_HEADING = { cone: Math.PI / 4, evenPull: 8, place: 100, way: 100, nameStep: 12, ownName: 0, tangle: 5 };
  /* Lines through stations (the maintainer's asking, 30 September 2026: a line should run on
     through a station rather than set off another way). At each place its links are paired
     as a line runs through it: a place with two links, those two; a busier one, links whose
     true directions from it are at least `apart` apart, the most nearly opposite first. The
     placing charges the one pair at a place where only one line runs through, for the angle it
     makes, as it charged a place with two links alone before; the router charges a link for the turn from its partner's last step to its
     first, `through` times a bend's cost, so that of two ways equally short the one that runs
     on from its neighbour is taken. */
  const SUBWAY_LINES = { apart: 2 * Math.PI / 3, turn: [0, 1, 1.5, 2, 3] };
  // A kind of map is its switches joined by '-', in this order: names, fine, mixed, heading, dots, side;
  // '45' is none. side, on the map that keeps each link's heading with room for names, puts no name
  // across a line from its own place (subwayLabels). mixed is the 22.5-degree map with 22.5 degrees only where needed, and brings fine with it;
  // dots, on the map that keeps each link's heading, draws every place as a point, no bars (subwayBars).
  const subwayFlags = kind => { const f = String(kind || '45').split('-'); return { names: f.includes('names'), fine: f.includes('fine') || f.includes('mixed'), mixed: f.includes('mixed'), heading: f.includes('heading'), dots: f.includes('dots'), side: f.includes('side') }; };
  // How far apart two directions are, 0 to pi.
  const subwayAngDiff = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  // Whether (dx, dy), along link e from its first end towards its second, keeps the link's heading.
  const subwayHeadingOk = (heading, e, dx, dy, slack = 0) => subwayAngDiff(Math.atan2(dy, dx), heading[e]) <= SUBWAY_HEADING.cone + slack + 1e-9;
  /* How far the direction phi is outside what steps of 45 degrees that keep
     the heading th can reach: the two such directions either side of th, or
     three when th is one of them, and every direction between them. */
  function subwayGridStray(phi, th, cone = SUBWAY_HEADING.cone) {
    const rel = a => ((a - th) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    let lo = Infinity, hi = -Infinity;
    for (let d = 0; d < 8; d++) { const r = rel(d * Math.PI / 4); if (Math.abs(r) <= cone + 1e-9) { lo = Math.min(lo, r); hi = Math.max(hi, r); } }
    const r = rel(phi);
    return r < lo - 1e-9 ? lo - r : r > hi + 1e-9 ? r - hi : 0;
  }

  /* STATIONS AS BARS. A place is a grid point with a port in each of the
     eight directions. A bar is len points in a row along axis a (a
     SUBWAY_DIRS index, 0 to 3), the middle one the place's own: each end
     has the three directions outward and every point the two across, so
     that lines can leave one side side by side. Its ports, clockwise from
     the front end's first: [t, d], the point t steps along a from the
     middle, and the direction. */
  function subwayBarPorts(a, len) {
    if (len === 1) return SUBWAY_DIRS.map((_, d) => [0, d]);
    const h = (len - 1) / 2, out = [];
    for (const r of [7, 0, 1]) out.push([h, (a + r) % 8]);
    for (let t = h; t >= -h; t--) out.push([t, (a + 2) % 8]);
    for (const r of [3, 4, 5]) out.push([-h, (a + r) % 8]);
    for (let t = -h; t <= h; t++) out.push([t, (a + 6) % 8]);
    return out;
  }
  /* How the links at a place can leave by the ports, each in its turn
     clockwise at its true angle (angs, sorted), each by a port of its own
     in that order and within cone of its angle, turning least in all:
     {cost, port}, the sum of how far each port turns from its link and the
     port of each, or null if there is no such way. */
  function subwayPortFit(angs, ports, cone) {
    const n = angs.length, K = ports.length;
    if (!n || n > K) return n ? null : { cost: 0, port: [] };
    const off = angs.map(th => ports.map(([, d]) => subwayAngDiff(d * Math.PI / 4, th)));
    let best = null;
    // link 0 on port s, the rest on ports after it, round once: cost[i][q], and the port before it
    for (let s = 0; s < K; s++) {
      if (off[0][s] > cone + 1e-9) continue;
      const cost = [new Float64Array(K).fill(Infinity)], from = [new Int32Array(K).fill(-1)];
      cost[0][0] = off[0][s];
      for (let i = 1; i < n; i++) {
        const c = new Float64Array(K).fill(Infinity), f = new Int32Array(K).fill(-1);
        let run = Infinity, at = -1;
        for (let q = 1; q < K; q++) {
          if (cost[i - 1][q - 1] < run) { run = cost[i - 1][q - 1]; at = q - 1; }
          const x = off[i][(s + q) % K];
          if (x <= cone + 1e-9 && run < Infinity) { c[q] = run + x; f[q] = at; }
        }
        cost.push(c); from.push(f);
      }
      for (let q = 0; q < K; q++) if (cost[n - 1][q] < (best ? best.cost - 1e-9 : Infinity)) {
        const port = new Array(n);
        for (let i = n - 1, r = q; i >= 0; r = from[i][r], i--) port[i] = (s + r) % K;
        best = { cost: cost[n - 1][q], port };
      }
    }
    return best;
  }
  /* The places on the map that keeps each link's heading whose links the
     eight ports of a point cannot all take, each in its true order and
     within 45 degrees of the way it truly runs: each is made a bar, the
     shortest of 3 and 5 points and then the axis that turns its links
     least, and each of its links given the port that fit found for it,
     which the placing measures the link from and the router leaves by.
     (Moash Llima, five of whose six links truly head within 65 degrees of
     north-east, sent two of them out the wrong way to swing round; the
     maintainer asked for metro maps' long station, 28 September 2026.)
     Returns each place's bar, {a, len, port: link to port}, or null. */
  function subwayBars(n, links, heading) {
    const out = new Array(n).fill(null);
    if (!heading) return out;
    const at = Array.from({ length: n }, () => []);
    links.forEach(([a, b], e) => { at[a].push({ e, th: heading[e] }); at[b].push({ e, th: Math.atan2(-Math.sin(heading[e]), -Math.cos(heading[e])) }); });
    for (let v = 0; v < n; v++) {
      const L = at[v].sort((p, q) => p.th - q.th), A = L.map(x => x.th);
      if (A.length < 4 || subwayPortFit(A, subwayBarPorts(0, 1), SUBWAY_HEADING.cone)) continue;
      for (const len of [3, 5]) {
        let best = null;
        for (let a = 0; a < 4; a++) { const f = subwayPortFit(A, subwayBarPorts(a, len), SUBWAY_HEADING.cone); if (f && (!best || f.cost < best.f.cost - 1e-9)) best = { a, f }; }
        if (best) { out[v] = { a: best.a, len, port: new Map(L.map((x, i) => [x.e, best.f.port[i]])) }; break; }
      }
    }
    return out;
  }
  // Where link e leaves v's bar, as steps from v's own point: none but at a bar.
  const subwayBarOff = (bar, e) => {
    if (!bar || !bar.port.has(e)) return [0, 0];
    const t = subwayBarPorts(bar.a, bar.len)[bar.port.get(e)][0], [dx, dy] = SUBWAY_DIRS[bar.a];
    return [t * dx, t * dy];
  };
  // The grid points of v's bar, v at (i, j), from its back end to its front; [i, j] alone for none.
  const subwayBarCells = (bar, i, j) => {
    if (!bar) return [[i, j]];
    const h = (bar.len - 1) / 2, [dx, dy] = SUBWAY_DIRS[bar.a], out = [];
    for (let t = -h; t <= h; t++) out.push([i + t * dx, j + t * dy]);
    return out;
  };

  // each place's links paired as lines run through it (SUBWAY_LINES): a Map, link to link, a place
  function subwayPairs(pos, links) {
    const inc = pos.map(() => []);
    links.forEach(([a, b], e) => { inc[a].push(e); inc[b].push(e); });
    return inc.map((es, v) => {
      const out = new Map();
      const way = e => { const w = links[e][0] === v ? links[e][1] : links[e][0]; return Math.atan2(pos[w].y - pos[v].y, pos[w].x - pos[v].x); };
      if (es.length === 2) { out.set(es[0], es[1]); out.set(es[1], es[0]); return out; }
      const c = [];
      for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
        const t = subwayAngDiff(way(es[i]), way(es[j]));
        if (t >= SUBWAY_LINES.apart) c.push([t, es[i], es[j]]);
      }
      c.sort((a, b) => b[0] - a[0] || a[1] - b[1] || a[2] - b[2]);
      for (const [, e, f] of c) if (!out.has(e) && !out.has(f)) { out.set(e, f); out.set(f, e); }
      return out;
    });
  }

  function subwayAdjacency(n, links) {
    const adj = Array.from({ length: n }, () => []);
    links.forEach(([a, b], e) => { adj[a].push({ to: b, e }); adj[b].push({ to: a, e }); });
    return adj;
  }

  /* Stage 1. Every pair at its number of jumps times L, weighted by the
     inverse square of that; each system also pulled to where it was. */
  function subwayEven(pos, links, L, pull, iters) {
    const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
    const n = pos.length, adj = subwayAdjacency(n, links);
    const hops = new Int16Array(n * n).fill(-1), q = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      let h = 0, t = 0; q[t++] = s; hops[s * n + s] = 0;
      while (h < t) { const v = q[h++], d = hops[s * n + v]; for (const { to } of adj[v]) if (hops[s * n + to] < 0) { hops[s * n + to] = d + 1; q[t++] = to; } }
    }
    // the pull, one for all or one for each place
    const anchorOf = i => (typeof pull === 'number' ? pull : pull[i]) / (L * L);
    const x = pos.map(p => p.x), y = pos.map(p => p.y), x0 = x.slice(), y0 = y.slice();
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        const anchor = anchorOf(i);
        let sx = anchor * x0[i], sy = anchor * y0[i], sw = anchor;
        for (let j = 0; j < n; j++) {
          const h = hops[i * n + j];
          if (h <= 0) continue;
          const d = h * L, w = 1 / (d * d), dx = x[i] - x[j], dy = y[i] - y[j], r = Math.hypot(dx, dy) || 1e-6;
          sx += w * (x[j] + d * dx / r); sy += w * (y[j] + d * dy / r); sw += w;
        }
        x[i] = sx / sw; y[i] = sy / sw;
      }
    }
    return x.map((v, i) => ({ x: v, y: y[i] }));
  }

  // Whether segments ab and cd cross at a point inside both.
  const subwayCross = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
  };

  /* The grid points a place's name takes: w of them in the place's row, from
     one point beside it (side 1 or -1) or two (2 or -2), to the right for a
     positive side; or in the row above (3) or below (-3), centred on it. */
  function subwayNameCells(i, j, side, w) {
    if (!side || !w) return [];
    const out = [];
    if (Math.abs(side) === 3) { const row = side > 0 ? j - 1 : j + 1, from = i - Math.floor((w - 1) / 2); for (let t = 0; t < w; t++) out.push([from + t, row]); return out; }
    const off = Math.abs(side);
    for (let t = 0; t < w; t++) out.push([side > 0 ? i + off + t : i - off - t, j]);
    return out;
  }

  /* Stage 2. want: evened positions in grid steps; names, for the map with
     room for names, each place's name's length in grid steps, else null;
     heading, for the map that keeps them, each link's true direction;
     bars, each place's bar or null (subwayBars), which takes its points.
     Returns [{i, j}], and each place's side for its name. */
  function subwayPlace(want, links, P, spacing, len, names, groups, heading, neighbours, bars, pairs) {
    const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
    const n = want.length, adj = subwayAdjacency(n, links);
    const gi = new Int32Array(n), gj = new Int32Array(n), occ = new Map();
    const key = (i, j) => (i + 4096) * 8192 + j + 4096; // a number: a Map is far quicker with numbers than with strings
    // A name is a row of grid points beside its place (subwayNameCells): no
    // other place in it or next to it, no other name on it or next to it in
    // its row. sides: the name to the right (1) or the left (-1), above (3)
    // or below (-3), or one point further out to the side (2, -2), at a price
    // for a name that far from its place.
    const side = new Int8Array(n), lab = new Map(), SIDES = names ? [1, -1, 3, -3, 2, -2] : [0];
    const cells = (v, i, j, sd) => subwayNameCells(i, j, sd, names ? names[v] : 0);
    const nameFits = (v, i, j, sd) => {
      if (!names) return true;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const o = lab.get(key(i + di, j + dj)); if (o !== undefined && o !== v) return false; }
      const own = bars && bars[v] ? new Set(subwayBarCells(bars[v], i, j).map(([bi, bj]) => key(bi, bj))) : null;
      for (const [ci, cj] of cells(v, i, j, sd)) {
        if (own && own.has(key(ci, cj))) return false;
        if (lab.has(key(ci - 1, cj)) && lab.get(key(ci - 1, cj)) !== v) return false;
        if (lab.has(key(ci, cj)) && lab.get(key(ci, cj)) !== v) return false;
        if (lab.has(key(ci + 1, cj)) && lab.get(key(ci + 1, cj)) !== v) return false;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const o = occ.get(key(ci + di, cj + dj)); if (o !== undefined && o !== v) return false; }
      }
      return true;
    };
    // the points each link passes as a straight line, and the links over each point, kept as places move
    const linkCells = links.map(() => null), over = new Map();
    // on the map that keeps each link's heading, the grid steps a link at a multiple of 45 degrees
    // takes, where it may have no other way, and the links on each step
    const linkSteps = links.map(() => []), onStep = new Map();
    const track = (e, on) => {
      const [a, b] = links[e];
      if (on) { const [ai, aj] = endOf(e, a, gi[a], gj[a]), [bi, bj] = endOf(e, b, gi[b], gj[b]); linkCells[e] = passes(ai, aj, bi, bj); if (heading) linkSteps[e] = stepsOf(ai, aj, bi, bj); }
      for (const c of linkCells[e] || []) {
        if (!over.has(c)) over.set(c, new Set());
        if (on) over.get(c).add(e); else over.get(c).delete(e);
      }
      for (const c of linkSteps[e]) {
        if (!onStep.has(c)) onStep.set(c, new Set());
        if (on) onStep.get(c).add(e); else onStep.get(c).delete(e);
      }
    };
    // the grid steps of a line from (ai, aj) to (bi, bj) at a multiple of 45 degrees, each a number
    // the same both ways; none for a line at any other angle
    const stepsOf = (ai, aj, bi, bj) => {
      const dx = bi - ai, dy = bj - aj, l = Math.max(Math.abs(dx), Math.abs(dy));
      if (!l || dx % l || dy % l) return [];
      let ux = dx / l, uy = dy / l, x = ai, y = aj;
      if (uy < 0 || (uy === 0 && ux < 0)) { ux = -ux; uy = -uy; x = bi; y = bj; }
      const d = SUBWAY_DIRS.findIndex(([p, q]) => p === ux && q === uy), out = [];
      for (let t = 0; t < l; t++) out.push(key(x + t * ux, y + t * uy) * 4 + d);
      return out;
    };
    let tracking = false;
    const barOf = v => (bars ? bars[v] : null);
    // where link e leaves v, v at (i, j): v's point, or the point of its bar its port is on
    const endOf = (e, v, i, j) => { const [ox, oy] = subwayBarOff(barOf(v), e); return [i + ox, j + oy]; };
    // and where it must first go: a step out of its port, from a bar
    const outOf = (e, v, i, j) => {
      const b = barOf(v);
      if (!b) return [i, j];
      const [ox, oy] = subwayBarOff(b, e), [dx, dy] = SUBWAY_DIRS[subwayBarPorts(b.a, b.len)[b.port.get(e)][1]];
      return [i + ox + dx, j + oy + dy];
    };
    const setAt = (v, i, j, sd) => {
      if (tracking) for (const { e } of adj[v]) track(e, false);
      if (occ.get(key(gi[v], gj[v])) === v) {
        for (const [bi, bj] of subwayBarCells(barOf(v), gi[v], gj[v])) occ.delete(key(bi, bj));
        for (const [ci, cj] of cells(v, gi[v], gj[v], side[v])) lab.delete(key(ci, cj));
      }
      gi[v] = i; gj[v] = j; side[v] = sd;
      for (const [bi, bj] of subwayBarCells(barOf(v), i, j)) occ.set(key(bi, bj), v);
      for (const [ci, cj] of cells(v, i, j, sd)) lab.set(key(ci, cj), v);
      if (tracking) for (const { e } of adj[v]) track(e, true);
    };
    // the grid points a straight line from (ai, aj) to (bi, bj) passes over, its ends left out
    const passes = (ai, aj, bi, bj) => {
      const out = new Set(), L = Math.max(Math.abs(bi - ai), Math.abs(bj - aj)), k = Math.max(1, Math.ceil(L * 4));
      for (let t = 1; t < k; t++) { const x = Math.round(ai + (bi - ai) * t / k), y = Math.round(aj + (bj - aj) * t / k); if ((x !== ai || y !== aj) && (x !== bi || y !== bj)) out.add(key(x, y)); }
      return out;
    };
    // v, at (i, j), with every point of its bar that far from any other place
    const spaced = (v, i, j, self) => {
      for (const [bi, bj] of subwayBarCells(barOf(v), i, j)) for (let dj = 1 - spacing; dj < spacing; dj++) for (let di = 1 - spacing; di < spacing; di++) {
        const o = occ.get(key(bi + di, bj + dj));
        if (o !== undefined && o !== self) return false;
      }
      return true;
    };
    // the way each link should leave v: as evened out, or on the map that keeps each link's heading, as it truly does
    const ang0 = (v, w) => {
      if (!heading) return Math.atan2(want[w].y - want[v].y, want[w].x - want[v].x);
      const e = adj[v].find(x => x.to === w).e;
      const a = links[e][0] === v ? heading[e] : heading[e] + Math.PI;
      return Math.atan2(Math.sin(a), Math.cos(a));
    };
    const groupOf = want.map(() => []);
    for (const g of groups || []) for (const v of g.members) groupOf[v].push(g);
    const order0 = adj.map((l, v) => l.map(x => x.to).sort((a, b) => ang0(v, a) - ang0(v, b)));
    const byDeg = [...Array(n).keys()].sort((a, b) => adj[b].length - adj[a].length);
    for (const v of byDeg) {
      const ci = Math.round(want[v].x), cj = Math.round(want[v].y);
      let best = null;
      for (let r = 0; !best; r++) {
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !spaced(v, ci + di, cj + dj, -1)) continue;
          const sd = SIDES.find(x => nameFits(v, ci + di, cj + dj, x));
          if (sd === undefined) continue;
          const d = Math.hypot(ci + di - want[v].x, cj + dj - want[v].y);
          if (!best || d < best.d) best = { i: ci + di, j: cj + dj, d, sd };
        }
      }
      gi[v] = best.i; gj[v] = best.j; setAt(v, best.i, best.j, best.sd);
    }
    links.forEach((_, e) => track(e, true)); tracking = true;

    const angDiff = (a, b) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
    // v's neighbours, clockwise as placed, with one of them (mover) at (mi, mj), in their true order
    const orderKept = (v, i, j, mover, mi, mj) => {
      const l = adj[v];
      // a bar's links keep their order by their ports
      if (l.length < 3 || barOf(v)) return true;
      const at = w => (w === mover ? [mi, mj] : [gi[w], gj[w]]);
      const cur = l.map(x => x.to).sort((a, b) => { const [ai, aj] = at(a), [bi, bj] = at(b); return Math.atan2(aj - j, ai - i) - Math.atan2(bj - j, bi - i); });
      const k = cur.indexOf(order0[v][0]);
      for (let t = 0; t < cur.length; t++) if (cur[(k + t) % cur.length] !== order0[v][t]) return false;
      return true;
    };
    // the one line through c, where only one runs through it (subwayPairs), charged for the angle it
    // makes: a place with two links, or a line with a branch off it; where two or more lines cross,
    // holding each straight cost the stock galaxy more bends in all than it saved (30 September 2026)
    const straightness = (c, ci, cj, mover, mi, mj) => {
      if (pairs[c].size !== 2) return 0;
      const at = w => (w === mover ? [mi, mj] : [gi[w], gj[w]]), end = e => at(links[e][0] === c ? links[e][1] : links[e][0]);
      let s = 0;
      for (const [e, f] of pairs[c]) if (e < f) {
        const a = end(e), b = end(f);
        const t = angDiff(Math.atan2(a[1] - cj, a[0] - ci), Math.atan2(b[1] - cj, b[0] - ci));
        s += P.straight * ((Math.PI - t) / Math.PI) ** 2;
      }
      return s;
    };
    // the terms that change when v is at (i, j)
    // the links through the points within one of a candidate link's, the only ones it can cross
    const near = (cs, i, j, w) => {
      const out = new Set();
      for (const c of [...cs, key(i, j), key(gi[w], gj[w])]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) for (const e of over.get(c + di * 8192 + dj) || []) out.add(e);
      return out;
    };
    function score(v, i, j, pp) {
      let s = P.move * ((i - want[v].x) ** 2 + (j - want[v].y) ** 2) / (len * len);
      for (let q = 0; q < adj[v].length; q++) {
        const w = adj[v][q].to, e = adj[v][q].e;
        const [si, sj] = endOf(e, v, i, j), [ti, tj] = endOf(e, w, gi[w], gj[w]);
        const dx = ti - si, dy = tj - sj, l = Math.max(Math.abs(dx), Math.abs(dy));
        if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) s += P.oct;
        // on the map that keeps each link's heading, a link its steps could not draw keeping it, more
        // the further off
        if (heading) {
          // measured, where either end is a bar, from a step out of its port, where the link must first go
          const [pi, pj] = outOf(e, v, i, j), [qi, qj] = outOf(e, w, gi[w], gj[w]);
          const x = pi === qi && pj === qj ? 0 : subwayGridStray(Math.atan2(qj - pj, qi - pi), links[e][0] === v ? heading[e] : heading[e] + Math.PI);
          if (x > 0) s += SUBWAY_HEADING.place * (1 + x / SUBWAY_HEADING.cone);
        }
        s += P.length * ((l - len) / len) ** 2;
        s += P.dir * angDiff(Math.atan2(dy, dx), ang0(v, w)) ** 2;
        // a place with one link is free to hang off at any angle: not level, where its name would
        // sit on its line (the maintainer's asking, for Molliari)
        if (dy === 0 && (adj[v].length === 1 || adj[w].length === 1)) s += P.flatLeaf || 0;
        for (const f of near(pp[q], i, j, w)) {
          const [a, b] = links[f];
          if (a === v || b === v || a === w || b === w) continue;
          const [ai, aj] = endOf(f, a, gi[a], gj[a]), [bi, bj] = endOf(f, b, gi[b], gj[b]);
          if (subwayCross(si, sj, ti, tj, ai, aj, bi, bj)) s += P.cross;
        }
        // a place on a straight link's way; on the map that keeps each link's heading, the way may be
        // the only one it has
        if (l && dx % l === 0 && dy % l === 0) for (let t = 1; t < l; t++) {
          const o = occ.get(key(si + t * dx / l, sj + t * dy / l));
          if (o !== undefined && o !== v) s += heading ? SUBWAY_HEADING.way : P.over;
        }
      }
      // on the map that keeps each link's heading, a straight link's way taken by another link, or
      // v on another link's straight way: one of them could not keep its heading
      if (heading) {
        const mine = adj[v].map(({ to: w, e }) => stepsOf(...endOf(e, v, i, j), ...endOf(e, w, gi[w], gj[w])));
        for (let q = 0; q < mine.length; q++) for (const c of mine[q]) {
          for (const f of onStep.get(c) || []) if (!links[f].includes(v)) s += SUBWAY_HEADING.way;
          for (let r = q + 1; r < mine.length; r++) if (mine[r].includes(c)) s += SUBWAY_HEADING.way;
        }
        for (const [bi, bj] of subwayBarCells(barOf(v), i, j)) for (const f of over.get(key(bi, bj)) || []) if (linkSteps[f].length && !links[f].includes(v)) s += SUBWAY_HEADING.way;
      }
      // on the map that keeps each link's heading, a near place it is not linked to turned more than 45
      // degrees from the way it truly lies (the evening out had put Journey's End west of Kerella, its
      // neighbour two jumps away, where it truly lies south-east, 28 September 2026)
      if (neighbours) for (const { w, ang, linked } of neighbours[v]) {
        if (linked) continue;
        const x = angDiff(Math.atan2(gj[w] - j, gi[w] - i), ang) - SUBWAY_HEADING.cone;
        if (x > 0) s += P.near.weight * (x / SUBWAY_HEADING.cone) ** 2;
      }
      s += straightness(v, i, j, -1, 0, 0);
      for (const { to: w } of adj[v]) s += straightness(w, gi[w], gj[w], v, i, j);
      // a place in a nebula kept within a box four fifths the nebula's size, round the middle of its
      // places, and out of every other nebula's full size and a gap round it
      for (const g of groupOf[v]) {
        let sx = i, sy = j;
        for (const w of g.members) if (w !== v) { sx += gi[w]; sy += gj[w]; }
        const cx = sx / g.members.length, cy = sy / g.members.length;
        const ox = Math.max(0, Math.abs(i - cx) - g.w / 2), oy = Math.max(0, Math.abs(j - cy) - g.h / 2);
        s += P.nebula * (ox * ox + oy * oy);
        // and as far and the way from that middle as it truly is, in grid steps, so that the nebula
        // keeps its shape (the maintainer found SPC-050 north-east of Obatta in their nebula, not due
        // east, and then the two at its opposite edges, 28 September 2026)
        const iv = g.members.indexOf(v);
        s += P.nebulaShape * ((i - cx - g.off[iv].x) ** 2 + (j - cy - g.off[iv].y) ** 2);
        for (const h of groups || []) {
          if (h === g || h.members.includes(v)) continue;
          let hx = 0, hy = 0;
          for (const w of h.members) { hx += gi[w]; hy += gj[w]; }
          hx /= h.members.length; hy /= h.members.length;
          const ix = (h.w / 0.8 + h.gap) / 2 - Math.abs(i - hx), iy = (h.h / 0.8 + h.gap) / 2 - Math.abs(j - hy);
          if (ix > 0 && iy > 0) s += P.nebula * Math.min(ix, iy) ** 2;
        }
      }
      // its links over another place's name
      if (names) for (const cs of pp) for (const c of cs) { const o = lab.get(c); if (o !== undefined && o !== v) s += P.overName; }
      return s;
    }
    // what the side of v's name costs, v at (i, j): its own links or others over it, and a
    // link wanting to leave the way the name lies
    function nameScore(v, i, j, sd, pp) {
      if (!names) return 0;
      let s = P.side[SIDES.indexOf(sd)];
      const mine = new Set(cells(v, i, j, sd).map(([ci, cj]) => key(ci, cj)));
      for (let q = 0; q < adj[v].length; q++) {
        const w = adj[v][q].to;
        for (const c of pp[q]) if (mine.has(c)) s += P.overName;
        const d = Math.atan2(gj[w] - j, gi[w] - i);
        if (Math.abs(sd) === 1 && Math.abs(angDiff(d, sd > 0 ? 0 : Math.PI)) < Math.PI / 8) s += P.overName;
      }
      const others = new Set();
      for (const c of mine) for (const e of over.get(c) || []) if (!links[e].includes(v)) others.add(e);
      return s + others.size * P.overName;
    }
    let moves = 0;
    for (let sweep = 0; sweep < P.sweeps; sweep++) {
      const r = Math.max(1, Math.round(P.radius * (1 - sweep / P.sweeps)));
      let moved = 0;
      for (const v of byDeg) {
        const ppOf = (i, j) => adj[v].map(({ to: w, e }) => passes(...endOf(e, v, i, j), ...endOf(e, w, gi[w], gj[w])));
        const pp0 = ppOf(gi[v], gj[v]);
        const cur = score(v, gi[v], gj[v], pp0) + nameScore(v, gi[v], gj[v], side[v], pp0);
        let best = null;
        const tried = new Set();
        const consider = (i, j) => {
          const di = i - gi[v], dj = j - gj[v];
          if (tried.has(key(i, j))) return;
          tried.add(key(i, j));
          if (!spaced(v, i, j, v) || !orderKept(v, i, j, -1, 0, 0)) return;
          if (adj[v].some(({ to: w }) => !orderKept(w, gi[w], gj[w], v, i, j))) return;
          const sds = SIDES.filter(x => (di || dj || x !== side[v]) && nameFits(v, i, j, x));
          if (!sds.length) return;
          const pp = ppOf(i, j), base = score(v, i, j, pp);
          for (const sd of sds) {
            const s = base + nameScore(v, i, j, sd, pp);
            if (s < cur - 1e-9 && (!best || s < best.s)) best = { i, j, sd, s };
          }
        };
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) consider(gi[v] + di, gj[v] + dj);
        // on the map that keeps each link's heading, also where each of its neighbours says it truly is,
        // and round that: a place turned right round is too far from its true side for the steps above
        if (neighbours) for (const { w, dx, dy } of neighbours[v]) {
          const ci = Math.round(gi[w] - dx), cj = Math.round(gj[w] - dy);
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) consider(ci + di, cj + dj);
        }
        if (best) { setAt(v, best.i, best.j, best.sd); moved++; }
      }
      moves += moved;
      if (!moved && r === 1) break;
    }
    return { at: [...Array(n).keys()].map(v => ({ i: gi[v], j: gj[v] })), side: [...side], moves };
  }

  /* Stage 3. at: grid points from stage 2; want: evened positions, for the
     order of the links round each system; heading, for the map that keeps
     them, each link's true direction; bars, each place's bar or null. A
     link leaves a place by one of its ports (subwayBarPorts), from the
     point of its bar the port is on. Returns the paths, as grid points
     from each link's first end to its second, and where the systems ended. */
  function subwayRoute(at, want, links, C, names, heading, groups, shape, bars, pairs) {
    const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
    const n = at.length, M = C.margin;
    const mi = Math.min(...at.map(p => p.i)) - M, mj = Math.min(...at.map(p => p.j)) - M;
    const W = Math.max(...at.map(p => p.i)) - mi + M + 1, H = Math.max(...at.map(p => p.j)) - mj + M + 1, N = W * H;
    const id = (i, j) => j * W + i, inGrid = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
    const node = at.map(p => id(p.i - mi, p.j - mj));
    const stationAt = new Int32Array(N).fill(-1);
    const barOf = v => (bars ? bars[v] : null);
    // the step along v's bar, as a change of grid index, and the points it takes
    const barStep = v => (barOf(v) ? SUBWAY_DIRS[barOf(v).a][0] + SUBWAY_DIRS[barOf(v).a][1] * W : 0);
    const cellsOf = v => { const h = barOf(v) ? (barOf(v).len - 1) / 2 : 0, out = []; for (let t = -h; t <= h; t++) out.push(node[v] + t * barStep(v)); return out; };
    node.forEach((k, v) => { for (const c of cellsOf(v)) stationAt[c] = v; });
    // each place's ports, clockwise, the point each is on, and which port leaves point k in direction d
    const portsOf = at.map((_, v) => subwayBarPorts(barOf(v) ? barOf(v).a : 0, barOf(v) ? barOf(v).len : 1));
    const portCell = (v, q) => node[v] + portsOf[v][q][0] * barStep(v);
    // where link e leaves the place at its end side: its point, or the point of its port on its bar
    const endNode = (e, side) => { const v = links[e][side]; return barOf(v) ? portCell(v, barOf(v).port.get(e)) : node[v]; };
    const slotOf = (v, k, d) => { const P = portsOf[v]; for (let q = 0; q < P.length; q++) if (P[q][1] === d && portCell(v, q) === k) return q; return -1; };
    // the steps that would cut across a bar at a slant, between its points
    const barCross = new Set();
    at.forEach((_, v) => {
      const b = barOf(v);
      if (!b || !(b.a & 1)) return;
      const [dx, dy] = SUBWAY_DIRS[b.a], cs = cellsOf(v);
      for (let q = 0; q + 1 < cs.length; q++) {
        const x = cs[q] % W, y = (cs[q] / W) | 0, p1 = id(x + dx, y), p2 = id(x, y + dy);
        barCross.add(p1 * 8 + SUBWAY_DIRS.findIndex(([ex, ey]) => ex === -dx && ey === dy));
        barCross.add(p2 * 8 + SUBWAY_DIRS.findIndex(([ex, ey]) => ex === dx && ey === -dy));
      }
    });
    // the grid points names take, which no link may pass
    const labelAt = new Int32Array(N).fill(-1);
    const nameNodes = (v, k) => names ? subwayNameCells(k % W, (k / W) | 0, names.side[v], names.width[v]).map(([i, j]) => (inGrid(i, j) ? id(i, j) : -1)) : [];
    if (names) node.forEach((k, v) => { for (const c of nameNodes(v, k)) if (c >= 0) labelAt[c] = v; });
    // the links through a grid point: one (pathAt), straight along an axis (0-3) or bending (9), and
    // a second (crossAt) only where it crosses the first straight over, on another axis
    const pathAt = new Int32Array(N).fill(-1), axisAt = new Int8Array(N).fill(-1), crossAt = new Int32Array(N).fill(-1);
    const edgeUse = new Int32Array(N * 8).fill(-1);
    const hist = new Float32Array(N);
    const paths = new Array(links.length).fill(null);
    const dirOf = (k, nk) => SUBWAY_DIRS.findIndex(([x, y]) => x === (nk % W) - (k % W) && y === ((nk / W) | 0) - ((k / W) | 0));
    // the link on the other diagonal of the cell a diagonal step crosses
    const diagOwner = (i, j, d) => {
      const [dx, dy] = SUBWAY_DIRS[d];
      if (!dx || !dy || !inGrid(i + dx, j)) return -1;
      return edgeUse[id(i + dx, j) * 8 + SUBWAY_DIRS.findIndex(([x, y]) => x === -dx && y === dy)];
    };

    // the links round each system in their true clockwise order, and the port each leaves by
    const inc = Array.from({ length: n }, () => []);
    links.forEach(([a, b], e) => {
      inc[a].push({ e, side: 0, ang: Math.atan2(want[b].y - want[a].y, want[b].x - want[a].x) });
      inc[b].push({ e, side: 1, ang: Math.atan2(want[a].y - want[b].y, want[a].x - want[b].x) });
    });
    for (const l of inc) l.sort((p, q) => p.ang - q.ang);
    const port = links.map(() => [-1, -1]);
    // the ports a link may take at v: between the routed links before and after it, with a port
    // to spare for each unrouted link between (Bast, Brosi and Storandt, section 4.3)
    function allowed(v, e, side) {
      const K = portsOf[v].length, cw = (p, q) => (q - p + K) % K;
      // a bar's link leaves by the port its bar gave it
      if (barOf(v)) { const out = new Uint8Array(K); out[barOf(v).port.get(e)] = 1; return out; }
      const l = inc[v], i = l.findIndex(x => x.e === e && x.side === side), out = new Uint8Array(K);
      let a = -1, da = 0, b = -1, db = 0;
      for (let k = 1; k < l.length; k++) { const x = l[(i - k + l.length) % l.length]; if (port[x.e][x.side] >= 0) { a = port[x.e][x.side]; da = k; break; } }
      for (let k = 1; k < l.length; k++) { const x = l[(i + k) % l.length]; if (port[x.e][x.side] >= 0) { b = port[x.e][x.side]; db = k; break; } }
      // strictly inside the arc from a round to b, far enough from each end
      const arc = a === b ? K : cw(a, b);
      for (let p = 0; p < K; p++) out[p] = a < 0 || (p !== a && p !== b && cw(a, p) + cw(p, b) === arc && cw(a, p) >= da && cw(p, b) >= db) ? 1 : 0;
      return out;
    }

    // the search's arrays, kept between searches; a state is a grid point and the direction it was reached in
    const gArr = new Float64Array(N * 8), prev = new Int32Array(N * 8), seen = new Int32Array(N * 8);
    const hf = new Float64Array(N * 64), hs = new Int32Array(N * 64);
    let stamp = 0;
    const portCost = (d, want) => C.port * Math.abs(((d * Math.PI / 4 - want + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / (Math.PI / 4);

    /* The cheapest path for link e; soft lets it through other links at a price. The search
       keeps first to a box round the two ends, BOX points wide of them, and goes wider only
       when that finds nothing. On the map that keeps each link's heading, the path takes only
       the directions within it; with free 1, within twice that, and with free 2, any; and any
       where its ends are not where such steps reach. */
    // what link e pays at place x for each direction it may leave x in: the turn from the link a line
    // runs on through x by (subwayPairs), once that one is drawn; null where there is none, or x is a bar
    const throughAt = (e, x) => {
      const f = barOf(x) ? undefined : pairs[x].get(e);
      if (f === undefined || !paths[f]) return null;
      const s = paths[f], d = links[f][0] === x ? dirOf(s[0], s[1]) : dirOf(s[s.length - 1], s[s.length - 2]), out = new Float64Array(8);
      for (let q = 0; q < 8; q++) out[q] = C.through * SUBWAY_LINES.turn[subwayTurn(q, (d + 4) % 8)];
      return out;
    };
    const throughOf = (e, seq) => {
      const a = throughAt(e, links[e][0]), b = throughAt(e, links[e][1]);
      return (a ? a[dirOf(seq[0], seq[1])] : 0) + (b ? b[dirOf(seq[seq.length - 1], seq[seq.length - 2])] : 0);
    };

    const BOX = 12;
    function route(e, soft, free) {
      const [u, v] = links[e], a = node[u], b = node[v];
      const box = [Math.min(a % W, b % W) - BOX, Math.min((a / W) | 0, (b / W) | 0) - BOX, Math.max(a % W, b % W) + BOX, Math.max((a / W) | 0, (b / W) | 0) + BOX];
      return search(e, soft, box, free) || search(e, soft, null, free);
    }
    // whether steps that keep link e's heading, to within slack more, can reach grid point b from a
    const reachable = (e, a, b, slack = 0) => subwayGridStray(Math.atan2(((b / W) | 0) - ((a / W) | 0), b % W - a % W), heading[e], SUBWAY_HEADING.cone + slack) === 0;
    function search(e, soft, box, free) {
      const [u, v] = links[e], s = endNode(e, 0), t = endNode(e, 1);
      const okU = allowed(u, e, 0), okV = allowed(v, e, 1);
      const ti = t % W, tj = (t / W) | 0, ends = cellsOf(v).map(k => [k % W, (k / W) | 0]);
      const dirOk = new Uint8Array(8).fill(1), slack = free ? SUBWAY_HEADING.cone : 0;
      if (heading && free !== 2 && reachable(e, s, t, slack)) for (let d = 0; d < 8; d++) dirOk[d] = subwayHeadingOk(heading, e, SUBWAY_DIRS[d][0], SUBWAY_DIRS[d][1], slack) ? 1 : 0;
      const want = Math.atan2(tj - ((s / W) | 0), ti - (s % W));
      const thrU = throughAt(e, u), thrV = throughAt(e, v);
      // no step costs less than C.hop, and a diagonal C.diag more: a lower bound, so the path found is the cheapest
      const hcost = k => {
        let h = Infinity;
        for (const [ei, ej] of ends) { const dx = Math.abs(ei - k % W), dy = Math.abs(ej - ((k / W) | 0)); h = Math.min(h, C.hop * (Math.max(dx, dy) + C.diag * Math.min(dx, dy))); }
        return h;
      };
      const x0 = box ? box[0] : 0, y0 = box ? box[1] : 0, x1 = box ? box[2] : W - 1, y1 = box ? box[3] : H - 1;
      stamp++;
      const G = st => (seen[st] === stamp ? gArr[st] : Infinity);
      let hn = 0, popF = 0;
      const relax = (st, c, p, f) => {
        if (c >= G(st)) return;
        seen[st] = stamp; gArr[st] = c; prev[st] = p;
        let x = hn++; hf[x] = f; hs[x] = st;
        while (x > 0) { const q = (x - 1) >> 1; if (hf[q] <= hf[x]) break; const tf = hf[q]; hf[q] = hf[x]; hf[x] = tf; const ts = hs[q]; hs[q] = hs[x]; hs[x] = ts; x = q; }
      };
      const pop = () => {
        const f = hf[0], st = hs[0];
        if (--hn) {
          hf[0] = hf[hn]; hs[0] = hs[hn];
          for (let x = 0; ;) {
            const l = 2 * x + 1, r = l + 1; let m = x;
            if (l < hn && hf[l] < hf[m]) m = l;
            if (r < hn && hf[r] < hf[m]) m = r;
            if (m === x) break;
            const tf = hf[m]; hf[m] = hf[x]; hf[x] = tf; const ts = hs[m]; hs[m] = hs[x]; hs[x] = ts; x = m;
          }
        }
        popF = f;
        return st;
      };
      // the steps from k, reached in din (-1 at the start, leaving in direction first); a link
      // crossing at k goes straight on
      const expand = (k, din, c0, st, straightOnly, first) => {
        const i = k % W, j = (k / W) | 0;
        for (let d = 0; d < 8; d++) {
          if (!dirOk[d] || (din < 0 ? d !== first : straightOnly ? d !== din : subwayTurn(din, d) === 4)) continue;
          if (barCross.size && barCross.has(k * 8 + d)) continue;
          const ni = i + SUBWAY_DIRS[d][0], nj = j + SUBWAY_DIRS[d][1];
          if (ni < x0 || nj < y0 || ni > x1 || nj > y1 || !inGrid(ni, nj)) continue;
          const nk = id(ni, nj);
          let c = c0 + C.hop + (d & 1 ? C.diag : 0) + (din < 0 ? portCost(d, want) + (thrU ? thrU[d] : 0) : C.bend[subwayTurn(din, d)]);
          if (edgeUse[k * 8 + d] >= 0) { if (!soft) continue; c += C.conflict; }
          if (diagOwner(i, j, d) >= 0) c += C.cross;
          if (stationAt[nk] >= 0) {
            if (stationAt[nk] === v) { const q = slotOf(v, nk, (d + 4) % 8); if (q >= 0 && okV[q]) { const cv = c + (thrV ? thrV[(d + 4) % 8] : 0); relax(nk * 8 + d, cv, st, cv); } }
            continue;
          }
          // the room kept for a name: never passed, or on the map that keeps each link's heading, at a price
          if (labelAt[nk] >= 0) { if (!C.nameStep) continue; c += labelAt[nk] === u || labelAt[nk] === v ? C.nameStep * SUBWAY_HEADING.ownName : C.nameStep; }
          c += C.hist * hist[nk];
          if (pathAt[nk] >= 0) {
            if (crossAt[nk] >= 0 || axisAt[nk] === 9 || axisAt[nk] === d % 4) { if (!soft) continue; c += C.conflict; }
            else c += C.cross;
          }
          relax(nk * 8 + d, c, st, c + hcost(nk));
        }
      };
      // from each port it may take, the point the port is on marked in the step's prev as -2 less it
      for (let q = 0; q < okU.length; q++) if (okU[q]) { const k = portCell(u, q); expand(k, -1, 0, -2 - k, false, portsOf[u][q][1]); }
      let found = -1;
      while (hn) {
        const st = pop(), k = st >> 3;
        if (popF > G(st) + hcost(k) + 1e-9) continue;
        if (stationAt[k] === v) { found = st; break; }
        expand(k, st & 7, G(st), st, pathAt[k] >= 0, -1);
      }
      if (found < 0) return null;
      const seq = [];
      let st = found;
      for (; st >= 0; st = prev[st]) seq.push(st >> 3);
      seq.push(-2 - st);
      return seq.reverse();
    }

    function commit(e, seq) {
      for (let q = 0; q + 1 < seq.length; q++) {
        const d = dirOf(seq[q], seq[q + 1]);
        edgeUse[seq[q] * 8 + d] = e; edgeUse[seq[q + 1] * 8 + (d + 4) % 8] = e;
        if (q > 0) {
          if (pathAt[seq[q]] < 0) { pathAt[seq[q]] = e; axisAt[seq[q]] = dirOf(seq[q - 1], seq[q]) === d ? d % 4 : 9; }
          else crossAt[seq[q]] = e;
        }
      }
      paths[e] = seq;
      port[e][0] = slotOf(links[e][0], seq[0], dirOf(seq[0], seq[1])); port[e][1] = slotOf(links[e][1], seq[seq.length - 1], dirOf(seq[seq.length - 1], seq[seq.length - 2]));
    }
    function unroute(e) {
      const seq = paths[e];
      for (let q = 0; q + 1 < seq.length; q++) {
        const d = dirOf(seq[q], seq[q + 1]);
        edgeUse[seq[q] * 8 + d] = -1; edgeUse[seq[q + 1] * 8 + (d + 4) % 8] = -1;
        const k = seq[q];
        if (q > 0 && crossAt[k] === e) crossAt[k] = -1;
        else if (q > 0 && pathAt[k] === e) {
          // the crossing link, if any, is now the only one there, and runs straight
          pathAt[k] = crossAt[k]; crossAt[k] = -1;
          axisAt[k] = pathAt[k] < 0 ? -1 : dirOf(k, paths[pathAt[k]][paths[pathAt[k]].indexOf(k) + 1]) % 4;
        }
      }
      paths[e] = null; port[e][0] = port[e][1] = -1;
    }
    // the links a soft path runs through; the points fought over cost more from now on
    function conflicts(e, seq) {
      const out = new Set();
      for (let q = 0; q + 1 < seq.length; q++) {
        const k = seq[q], nk = seq[q + 1], d = dirOf(k, nk);
        let hit = false;
        if (edgeUse[k * 8 + d] >= 0) { out.add(edgeUse[k * 8 + d]); hit = true; }
        if (q + 2 < seq.length && pathAt[nk] >= 0) {
          const nd = dirOf(nk, seq[q + 2]);
          if (crossAt[nk] >= 0 || axisAt[nk] === 9 || axisAt[nk] === nd % 4 || d !== nd) {
            out.add(pathAt[nk]); if (crossAt[nk] >= 0) out.add(crossAt[nk]); hit = true;
          }
        }
        if (hit) { hist[k]++; hist[nk]++; }
      }
      out.delete(e);
      return [...out];
    }
    // a drawn link's cost as the search counts it, less the history
    function pathCost(e, seq) {
      const s0 = seq[0], t0 = seq[seq.length - 1];
      const want = Math.atan2(((t0 / W) | 0) - ((s0 / W) | 0), (t0 % W) - (s0 % W));
      let c = 0;
      for (let q = 0; q + 1 < seq.length; q++) {
        const k = seq[q], d = dirOf(k, seq[q + 1]);
        c += C.hop + (d & 1 ? C.diag : 0) + (q === 0 ? portCost(d, want) : C.bend[subwayTurn(dirOf(seq[q - 1], k), d)]);
        if (diagOwner(k % W, (k / W) | 0, d) >= 0) c += C.cross;
        if (q > 0 && ((pathAt[k] >= 0 && pathAt[k] !== e) || (crossAt[k] >= 0 && crossAt[k] !== e))) c += C.cross;
        if (q > 0 && C.nameStep && labelAt[k] >= 0) c += labelAt[k] === links[e][0] || labelAt[k] === links[e][1] ? C.nameStep * SUBWAY_HEADING.ownName : C.nameStep;
      }
      return c;
    }
    const span = e => { const a = node[links[e][0]], b = node[links[e][1]]; return Math.max(Math.abs(a % W - b % W), Math.abs(((a / W) | 0) - ((b / W) | 0))); };
    const shortestFirst = X => X.slice().sort((a, b) => span(a) - span(b));

    // Route the queue: a link with no way takes the way through the fewest others, which go
    // back on the queue, or takes up the links at its ends when their ports leave it none.
    const ripped = new Int32Array(links.length);
    function routeAll(queue, budget) {
      while (queue.length) {
        const e = queue.shift();
        if (paths[e]) continue;
        let seq = route(e, false);
        if (!seq && budget > 0 && ripped[e] < C.maxRip) {
          budget--;
          // keeping its heading if it can, through other links or not, and else as near it as it can
          const kept = route(e, true), soft = kept || (heading && (route(e, true, 1) || route(e, true, 2)));
          if (soft) {
            const X = conflicts(e, soft);
            for (const x of X) { unroute(x); ripped[x]++; }
            seq = route(e, false) || (!kept && heading && (route(e, false, 1) || route(e, false, 2))) || soft;
            queue.unshift(...X);
          } else {
            const [u, v] = links[e];
            const X = [...inc[u], ...inc[v]].map(x => x.e).filter(x => x !== e && paths[x]);
            for (const x of X) { unroute(x); ripped[x]++; }
            ripped[e]++;
            queue.unshift(e, ...X);
            continue;
          }
        }
        if (seq) commit(e, seq);
      }
    }
    // shortest links first, as they are the likeliest to be straight
    routeAll(shortestFirst(links.map((_, e) => e)), C.rip * links.length);

    let rerouted = 0, moved = 0;
    // a system moved costs for how far it goes, and for how far a nebula it is in then is from its
    // true shape, as the placing charges it (the router moved Obatta a step out of its nebula to
    // shorten its one link, 28 September 2026); C.nebulaShape is 0 on the maps without room for
    // names, where it cost the map that keeps headings more links off them
    const groupOf = at.map(() => []);
    for (const g of groups || []) for (const v of g.members) groupOf[v].push(g);
    const moveCost = (v, k) => {
      const x = (k % W) + mi, y = ((k / W) | 0) + mj;
      let c = C.move * ((x - at[v].i) ** 2 + (y - at[v].j) ** 2);
      for (const g of groupOf[v]) {
        let sx = x, sy = y;
        for (const w of g.members) if (w !== v) { sx += (node[w] % W) + mi; sy += ((node[w] / W) | 0) + mj; }
        const o = g.off[g.members.indexOf(v)];
        c += shape * ((x - sx / g.members.length - o.x) ** 2 + (y - sy / g.members.length - o.y) ** 2);
      }
      return c;
    };
    // a link with no way costs as much as many long ones, so a system moves if that opens one; on
    // the map that keeps each link's heading, one drawn off it a quarter as much again, or half
    // beyond twice it
    const keeps = (e, seq, slack = 0) => !heading || seq.every((k, q) => q + 1 === seq.length || subwayHeadingOk(heading, e, seq[q + 1] % W - k % W, ((seq[q + 1] / W) | 0) - ((k / W) | 0), slack));
    const cost = (e, seq) => (seq ? pathCost(e, seq) + throughOf(e, seq) + (keeps(e, seq) ? 0 : keeps(e, seq, SUBWAY_HEADING.cone) ? C.unrouted / 4 : C.unrouted / 2) : C.unrouted);
    const retry = () => { const stuck = links.map((_, e) => e).filter(e => !paths[e]); if (stuck.length) { ripped.fill(0); routeAll(stuck, C.rip * links.length / 4); } };
    for (let round = 0; round < C.improve; round++) {
      retry();
      // each link alone, the dearest first
      const dear = links.map((_, e) => e).filter(e => paths[e]).map(e => [cost(e, paths[e]), e]).sort((a, b) => b[0] - a[0]);
      for (const [c0, e] of dear) {
        const old = paths[e];
        unroute(e);
        const seq = route(e, false);
        if (seq && cost(e, seq) < c0 - 1e-9) { commit(e, seq); rerouted++; } else commit(e, old);
      }
      // each system at its eight neighbouring points, its links routed again
      for (let v = 0; v < n; v++) {
        const X = inc[v].map(x => x.e);
        if (!X.length || barOf(v)) continue;
        if (C.leaveStraight && X.every(e => paths[e] && pathCost(e, paths[e]) <= C.hop * (paths[e].length - 1) * (1 + C.diag) + 2 * C.port)) continue;
        const k = node[v], old = X.map(e => paths[e]);
        // on the map that keeps each link's heading, how many of v's links it would not keep, v at k2
        const astray = k2 => (heading ? X.filter(e => { const [a, b] = links[e]; return !reachable(e, a === v ? k2 : endNode(e, 0), b === v ? k2 : endNode(e, 1)); }).length : 0);
        const astray0 = astray(k);
        let best = { k, c: X.reduce((a, e, q) => a + cost(e, old[q]), 0) + moveCost(v, k) };
        for (const e of X) if (paths[e]) unroute(e);
        stationAt[k] = -1;
        for (const c of nameNodes(v, k)) if (c >= 0) labelAt[c] = -1;
        // may v and its name stand at k2: nothing on the name's points, no other place beside them,
        // no other name beside v
        const nameFree = k2 => {
          const ns = nameNodes(v, k2);
          if (ns.some(c => c < 0 || stationAt[c] >= 0 || labelAt[c] >= 0 || pathAt[c] >= 0 || crossAt[c] >= 0)) return false;
          for (const c of [...ns, k2]) {
            const ci = c % W, cj = (c / W) | 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
              if (!inGrid(ci + di, cj + dj)) continue;
              const q = id(ci + di, cj + dj);
              if (c !== k2 && stationAt[q] >= 0 && stationAt[q] !== v) return false;
              if (c === k2 && labelAt[q] >= 0) return false;
              if (c !== k2 && !dj && labelAt[q] >= 0) return false;
            }
          }
          return true;
        };
        const standAt = (k2, on) => { for (const c of nameNodes(v, k2)) labelAt[c] = on ? v : -1; };
        const i = k % W, j = (k / W) | 0;
        for (const [dx, dy] of SUBWAY_DIRS) {
          const ni = i + dx, nj = j + dy;
          if (!inGrid(ni, nj)) continue;
          const k2 = id(ni, nj);
          if (stationAt[k2] >= 0 || pathAt[k2] >= 0 || astray(k2) > astray0) continue;
          if (SUBWAY_DIRS.some(([ex, ey]) => inGrid(ni + ex, nj + ey) && stationAt[id(ni + ex, nj + ey)] >= 0)) continue;
          if (!nameFree(k2)) continue;
          node[v] = k2; stationAt[k2] = v; standAt(k2, true);
          let c = moveCost(v, k2);
          const done = [];
          for (const e of shortestFirst(X)) { const seq = route(e, false); if (seq) { commit(e, seq); done.push(e); } c += cost(e, seq); }
          for (const e of done) unroute(e);
          stationAt[k2] = -1; standAt(k2, false);
          if (c < best.c - 1e-9) best = { k: k2, c };
        }
        node[v] = best.k; stationAt[best.k] = v; standAt(best.k, true);
        if (best.k === k) { X.forEach((e, q) => { if (old[q]) commit(e, old[q]); }); continue; }
        for (const e of shortestFirst(X)) { const seq = route(e, false); if (seq) commit(e, seq); }
        moved++;
      }
    }
    retry();
    // on the map that keeps each link's heading, each link still off it routed again first, with the
    // other links at its ends, and any in its way, taken up and routed after it; kept where the
    // drawing costs less
    if (heading) for (let round = 0; round < C.improve; round++) {
      let mended = 0;
      for (let e = 0; e < links.length; e++) {
        if (!paths[e] || keeps(e, paths[e])) continue;
        const [u, v] = links[e];
        const all = [e, ...new Set([...inc[u], ...inc[v]].map(x => x.e).filter(x => x !== e && paths[x]))];
        const old = new Map(all.map(x => [x, paths[x]]));
        for (const x of all) unroute(x);
        let seq = route(e, false);
        if (!seq) {
          const soft = route(e, true);
          if (soft) for (const x of conflicts(e, soft)) if (!old.has(x)) { old.set(x, paths[x]); all.push(x); unroute(x); }
          seq = soft && route(e, false);
        }
        if (seq) commit(e, seq);
        for (const x of shortestFirst(all.slice(1))) { const q = route(x, false) || route(x, false, 1) || route(x, false, 2); if (q) commit(x, q); }
        const before = all.reduce((a, x) => a + cost(x, old.get(x)), 0), after = all.reduce((a, x) => a + cost(x, paths[x]), 0);
        if (seq && all.every(x => paths[x]) && after < before - 1e-9) { mended++; continue; }
        for (const x of all) if (paths[x]) unroute(x);
        for (const x of all) commit(x, old.get(x));
      }
      if (!mended) break;
    }
    const back = k => ({ i: (k % W) + mi, j: ((k / W) | 0) + mj });
    return { paths: paths.map(seq => seq && seq.map(back)), at: node.map(back), order: inc.map(l => l.map(x => x.e)), rerouted, moved };
  }

  /* THE 22.5-DEGREE MAP, from the finished 45-degree one: the links it
     draws straight are already at multiples of 22.5 degrees and stay so; each
     one it bends is given the multiple of 22.5 degrees nearest the line
     between its ends, if that keeps two links off one port and the links in
     order round both ends, and the systems are moved off the grid, by least
     squares, until as many as can be are straight to within a quarter of a
     degree, eps (a link that the rest will
     not let straighten, or that would bring a line over a system or two
     systems together, is let go). A link still not straight is drawn with
     one bend where two lines from its ends meet, at free ports, in order, the
     cheapest by its bend, how far its ports stray and, above all, the links
     it would cross; one that would run over a system or along another link
     is not drawn so. Where no such bend will do, two bends. */
  const SUBWAY_FINE = { minLen: 1.5, anchor: 0.02, iters: 400, rounds: 12, eps: 0.004, clear: 0.4, minSep: 1.4, minLeg: 0.5, bendCost: 1, crossCost: 8 };
  const FINE_STEP = Math.PI / 8;
  const fineUnit = k => [Math.cos(k * FINE_STEP), Math.sin(k * FINE_STEP)];
  const fineClass = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / FINE_STEP) % 16) + 16) % 16;
  const fineAngErr = (dx, dy, k) => { const d = Math.atan2(dy, dx) - k * FINE_STEP; return Math.abs(((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); };
  const nearSegment = (v, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1e-12, t = Math.max(0, Math.min(1, ((v.x - a.x) * vx + (v.y - a.y) * vy) / L2)); return Math.hypot(v.x - a.x - t * vx, v.y - a.y - t * vy); };
  // two segments on one line, overlapping by more than a tenth of a step
  const runAlong = (p, q, r, t) => {
    const ux = q.x - p.x, uy = q.y - p.y, L = Math.hypot(ux, uy);
    if (L < 1e-12) return false;
    const nx = -uy / L, ny = ux / L;
    if (Math.abs((r.x - p.x) * nx + (r.y - p.y) * ny) > 1e-6 || Math.abs((t.x - p.x) * nx + (t.y - p.y) * ny) > 1e-6) return false;
    const a = ((r.x - p.x) * ux + (r.y - p.y) * uy) / L, b = ((t.x - p.x) * ux + (t.y - p.y) * uy) / L;
    return Math.min(L, Math.max(a, b)) - Math.max(0, Math.min(a, b)) > 0.1;
  };

  /* THE MAP WITH 22.5 DEGREES ONLY WHERE NEEDED (the maintainer's asking,
     29 September 2026) is the 22.5-degree map made from the same 45-degree
     one, with a piece between the 45-degree directions only in the links
     whose 45-degree drawing is awkward: one turning through turn (135
     degrees) or more on its way, a swing round; one bends times bent or
     more; one detour times as long as the straight line between its ends;
     or, on the map that keeps each link's heading, one off it. Each of
     those is let go and drawn as on the 22.5-degree map, straightened where
     the places within reach (3) jumps of it, and only they, can move for
     it, and kept as it was where it is no less awkward (subwayAwkward);
     every other link keeps its 45-degree
     drawing, or is drawn in 45-degree pieces where a move has taken its
     ends, unless it has none (stats.forced). A move that turns another
     link's ends further from the way it should run than they were or than
     off (30 degrees), or past its heading, is not made.
     Nearer its true direction is not among the reasons, as the 22.5-degree
     stage cannot bring a link there: a straight link's direction is its
     places', and turning one that far moves its neighbours, whose links
     hold theirs, until they cannot all be straight. Tried on the map that
     keeps each link's heading, 29 September 2026, on the 59 of its 588 links
     more than 30 degrees off: let go together, one of sixty was kept, and
     one at a time, with only the places within three jumps moving, none;
     and the 22.5-degree map has them as far off as the 45-degree map does.
     paths: the router's; aim: each link's way, from its first end. Returns
     the links that need it. */
  const SUBWAY_NEEDY = { off: Math.PI / 6, turn: 3 * Math.PI / 4, bends: 3, detour: 1.25, reach: 3 };
  // How a drawing of link e, points {x, y}, turns, bends, how much longer than straight it is, and whether a piece is off its heading.
  function subwayShape(l, heading, e) {
    const a = l[0], b = l[l.length - 1], chord = Math.hypot(b.x - a.x, b.y - a.y) || 1e-9;
    let len = 0, turn = 0, bends = 0, prev = null, astray = false;
    for (let k = 0; k + 1 < l.length; k++) {
      const dx = l[k + 1].x - l[k].x, dy = l[k + 1].y - l[k].y, s = Math.hypot(dx, dy);
      if (s < 1e-9) continue;
      const ang = Math.atan2(dy, dx);
      len += s;
      if (prev !== null && subwayAngDiff(ang, prev) > 1e-6) { turn += subwayAngDiff(ang, prev); bends++; }
      prev = ang;
      if (heading && !subwayHeadingOk(heading, e, dx, dy, SUBWAY_FINE.eps)) astray = true;
    }
    return { turn, bends, detour: len / chord, astray };
  }
  // what makes a drawing awkward, as one number: off its heading most, then its turning, bends and detour
  const subwayAwkward = (l, heading, e) => { const s = subwayShape(l, heading, e); return (s.astray ? 100 : 0) + s.turn / (Math.PI / 4) + s.bends + 10 * (s.detour - 1); };
  function subwayNeedy(paths, aim, heading) {
    const out = new Set();
    paths.forEach((p, e) => {
      if (!p || p.length < 2) return;
      const s = subwayShape(p.map(q => ({ x: q.i, y: q.j })), heading, e);
      if (s.turn >= SUBWAY_NEEDY.turn - 1e-9 || s.bends >= SUBWAY_NEEDY.bends || s.detour > SUBWAY_NEEDY.detour + 1e-9 || s.astray) out.add(e);
    });
    return out;
  }

  /* at, paths, order: the router's. Returns positions and lines in grid steps. */
  /* THE NAMES ON THE MAP THAT KEEPS EACH LINK'S HEADING, placed after its
     lines are drawn. Each name may go in the room the placing kept for it,
     if no line took it, or out from its place in one of sixteen directions
     at one of six distances, at its size or at 0.8 or 0.65 of it. A spot
     must be clear of every line, every place and every other name (its own
     place's lines may come nearer it than others' do), and nearer its own
     place than any other; its price is how far out it is, then right, left,
     above, below, the corners and between, its kept room half a step less, and a
     smaller name costs more than any at its size. A name out to the side has its nearer end at
     its distance, one straight above or below its nearer edge, centred, and
     one out at a slant its nearer corner, so that it sits snug in the corner
     between its place's lines, or its middle (the maintainer found one a step out, on 28
     September 2026, that had room half a step in). The places with the
     fewest clear spots take the cheapest they can first; then, as long as
     it helps, a name not beside its place tries its cheaper spots, moving a
     single name in its way to another spot where the two then cost less,
     as a greedy start and moves that improve it are the practical way to
     place names (Christensen, Marks and Shieber, "An empirical study of
     algorithms for point-feature label placement", ACM TOG, 1995). A name
     with no clear spot is put clear but as near another place as its own
     (stats.unclear), or else where it meets least (stats.unnamed); those
     made smaller and those in their kept room are counted (stats.smaller,
     stats.kept). at: the places and lines: the links' points, in grid
     steps; textW: each name's letters, in grid steps, 0.84 of a step high
     with the room round them; side: the room kept for each, as
     subwayNameCells has it; links: the links' ends. Returns each name's
     anchor, alignment, size and box. */
  const SUBWAY_LABEL = { gap: 0.15, h: 0.42, place: 0.5, line: 0.15, ownLine: 0.03, near: 0.25, bar: 0.4 };
  const LABEL_TURNS = [0, 8, 12, 4, 14, 10, 2, 6, 15, 9, 1, 7, 13, 11, 3, 5]; // sixteenths of a turn, clockwise from the right
  const LABEL_TURN_COST = [0, 0.05, 0.1, 0.1, 0.25, 0.25, 0.25, 0.25, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4];
  const LABEL_SPOTS = [0.5, 0.75, 1, 1.5, 2.1, 2.8].flatMap(d => LABEL_TURNS.map((t, n) => {
    const a = t * Math.PI / 8, c = Math.cos(a), s = Math.sin(a), cost = d + LABEL_TURN_COST[n];
    if (Math.abs(c) < 0.3) return [[0, Math.sign(s) * d, 'center', s < 0 ? 'above' : 'below', cost]];
    if (Math.abs(s) < 1e-9) return [[Math.sign(c) * Math.max(d, 0.6), 0, c > 0 ? 'left' : 'right', 'middle', cost]];
    // at a slant, its nearer corner there, or its middle a little dearer
    return [[d * c, d * s, c > 0 ? 'left' : 'right', s < 0 ? 'above' : 'below', cost], [d * c, d * s, c > 0 ? 'left' : 'right', 'middle', cost + 0.1]];
  }).flat());
  // a spot whose name is aligned at (x + dx, y + dy), and above, below or level with it
  function subwayLabelSpot(x, y, dx, dy, align, level, cost, tw, size) {
    const w = tw * size, h = SUBWAY_LABEL.h * size, ax = x + dx, ay = y + dy + (level === 'above' ? -h : level === 'below' ? h : 0);
    const x0 = align === 'left' ? ax : align === 'right' ? ax - w : ax - w / 2;
    return { x: ax, y: ay, align, size, cost, box: { x0: x0 - SUBWAY_LABEL.gap, x1: x0 + w + SUBWAY_LABEL.gap, y0: ay - h, y1: ay + h } };
  }
  function subwayLabelSpots(x, y, tw, size = 1, side = 0) {
    const out = LABEL_SPOTS.map(([dx, dy, align, level, cost]) => subwayLabelSpot(x, y, dx, dy, align, level, cost, tw, size));
    // the room kept for it, where its letters sit on the map with room for names, priced as the spot
    // it is less half a step: kept room two steps out does not win over a free spot beside the place
    // (the maintainer found Unin a needless step from its dot, 28 September 2026)
    if (Math.abs(side) === 3) out.push({ ...subwayLabelSpot(x, y, 0, side > 0 ? -1 : 1, 'center', 'middle', 1 + 0.1 - 0.5, tw, size), kept: true });
    else if (side) out.push({ ...subwayLabelSpot(x, y, (Math.abs(side) - 0.4) * Math.sign(side), 0, side > 0 ? 'left' : 'right', 'middle', Math.abs(side) - 0.4 + (side > 0 ? 0 : 0.05) - 0.5, tw, size), kept: true });
    return out.sort((a, b) => a.cost - b.cost);
  }
  function subwayLabels(at, lines, textW, side, links, bars, keepSide) {
    const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
    const L = SUBWAY_LABEL, grow = (b, c) => ({ x0: b.x0 - c, x1: b.x1 + c, y0: b.y0 - c, y1: b.y1 + c });
    const hit = (a, o) => a.x0 < o.x1 && o.x0 < a.x1 && a.y0 < o.y1 && o.y0 < a.y1;
    // things kept by the two-step cells their boxes cover, to be looked for near a box
    const cellsOf = b => { const out = []; for (let i = Math.floor(b.x0 / 2); i <= Math.floor(b.x1 / 2); i++) for (let j = Math.floor(b.y0 / 2); j <= Math.floor(b.y1 / 2); j++) out.push(i * 100003 + j); return out; };
    const index = () => {
      const m = new Map();
      return {
        add(b, x) { for (const c of cellsOf(b)) { if (!m.has(c)) m.set(c, new Set()); m.get(c).add(x); } },
        drop(b, x) { for (const c of cellsOf(b)) m.get(c).delete(x); },
        near(b) { const out = new Set(); for (const c of cellsOf(b)) for (const x of m.get(c) || []) out.add(x); return out; },
      };
    };
    const segs = [], segAt = index(), placeAt = index(), nameAt = index();
    const addSeg = (p, q, ends, bar) => { segAt.add({ x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), y0: Math.min(p.y, q.y), y1: Math.max(p.y, q.y) }, segs.length); segs.push([p, q, ends, bar]); };
    lines.forEach((l, e) => { if (l) for (let k = 0; k + 1 < l.length; k++) addSeg(l[k], l[k + 1], links[e], false); });
    // a bar is a piece no name comes within SUBWAY_LABEL.bar of, its own place's either
    // (subwayBars), and its points are its place's for being nearer
    const ptsOf = v => (bars && bars[v] ? subwayBarCells(bars[v], at[v].x, at[v].y).map(([x, y]) => ({ x, y })) : [at[v]]);
    at.forEach((p, v) => { if (bars && bars[v]) { const c = ptsOf(v); addSeg(c[0], c[c.length - 1], [-1, -1], true); } });
    at.forEach((p, w) => placeAt.add({ x0: p.x, x1: p.x, y0: p.y, y1: p.y }, w));
    // how many lines and other places the box of v's name meets
    const fixed = (v, b, stop) => {
      let m = 0;
      const bl = grow(b, L.line), bo = grow(b, L.ownLine), bp = grow(b, L.place), bb = grow(b, L.bar);
      for (const i of segAt.near(bb)) { const [p, q, ends, bar] = segs[i]; if (subwaySegmentInBox(p, q, bar ? bb : ends[0] === v || ends[1] === v ? bo : bl) && ++m >= stop) return m; }
      for (const w of placeAt.near(bp)) { const p = at[w]; if (w !== v && p.x > bp.x0 && p.x < bp.x1 && p.y > bp.y0 && p.y < bp.y1 && ++m >= stop) return m; }
      return m;
    };
    // whether a line runs between v and its name's box, from v to the nearest point of the box: the
    // maintainer disliked Nova's Hannaford and Canopus with their names across a line (30 September
    // 2026), and with keepSide no name is put so where it can be put otherwise
    const across = (v, b) => {
      const p = at[v], q = { x: Math.max(b.x0, Math.min(b.x1, p.x)), y: Math.max(b.y0, Math.min(b.y1, p.y)) };
      if (q.x === p.x && q.y === p.y) return false;
      for (const i of segAt.near({ x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), y0: Math.min(p.y, q.y), y1: Math.max(p.y, q.y) })) {
        const [a, c] = segs[i];
        if (subwayCross(p.x, p.y, q.x, q.y, a.x, a.y, c.x, c.y)) return true;
      }
      return false;
    };
    // whether a name's box is as near another place as its own
    const toBox = (p, b) => Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1));
    const unclear = (v, b) => { const own = Math.min(...ptsOf(v).map(p => toBox(p, b))) + L.near; for (const w of placeAt.near(grow(b, own))) if (w !== v && Math.min(...ptsOf(w).map(p => toBox(p, b))) < own) return true; return false; };
    // every spot of every name, at each size, its price, and whether it is clear of lines and
    // places and nearer its own place than any other; a smaller name costs more
    const SIZE_PRICE = { 1: 0, 0.8: 4, 0.65: 8 };
    const spots = at.map((p, v) => [1, 0.8, 0.65].flatMap(size => subwayLabelSpots(p.x, p.y, textW[v], size, side ? side[v] : 0))
      .map(sp => ({ ...sp, price: sp.cost + SIZE_PRICE[sp.size], ok: !fixed(v, sp.box, 1) && !unclear(v, sp.box) })).sort((a, b) => a.price - b.price))
      .map((list, v) => { if (!keepSide) return list; const mine = list.filter(sp => !across(v, sp.box)); return mine.length ? mine : list; });
    // the names out: v's spot, and how it stands -- 'ok', 'unclear' (as near another place), or
    // 'meets' (a line, a place or a name), each dearer than the last
    const out = new Array(at.length).fill(null), how = new Array(at.length).fill(null);
    const price = v => out[v].price + (how[v] === 'unclear' ? 12 : how[v] === 'meets' ? 24 : 0);
    const namesIn = (b, but) => { const ws = []; for (const w of nameAt.near(b)) if (w !== but && hit(b, out[w].box)) ws.push(w); return ws; };
    const put = (v, sp, h) => { if (out[v]) nameAt.drop(out[v].box, v); out[v] = sp; how[v] = h; nameAt.add(sp.box, v); };
    const room = spots.map(list => list.filter(sp => sp.ok && sp.size === 1).length);
    for (const v of [...at.keys()].sort((a, b) => room[a] - room[b] || a - b)) {
      let sp = spots[v].find(o => o.ok && !namesIn(o.box, v).length), h = 'ok';
      if (!sp) { sp = spots[v].find(o => o.size === 1 && !fixed(v, o.box, 1) && !namesIn(o.box, v).length); h = 'unclear'; }
      if (!sp) {
        let bm = Infinity;
        for (const o of spots[v]) { if (o.size < 1) continue; const m = fixed(v, o.box, bm) + namesIn(o.box, v).length; if (m < bm) { bm = m; sp = o; } }
        h = 'meets';
      }
      put(v, sp, h);
    }
    // then, as long as it helps, each name not beside its place tries its cheaper spots
    for (let pass = 0; pass < 4; pass++) {
      let better = 0;
      for (let v = 0; v < at.length; v++) {
        const pv = price(v);
        if (pv <= 0.8) continue;
        for (const sp of spots[v]) {
          if (sp.price >= pv) break;
          if (!sp.ok) continue;
          const inIt = namesIn(sp.box, v);
          if (!inIt.length) { put(v, sp, 'ok'); better++; break; }
          if (inIt.length > 1) continue;
          const u = inIt[0], pu = price(u);
          const alt = spots[u].find(o => o.ok && o.price + sp.price < pv + pu && !hit(o.box, sp.box) && !namesIn(o.box, u).some(w => w !== v));
          if (alt) { put(u, alt, 'ok'); put(v, sp, 'ok'); better++; break; }
        }
      }
      if (!better) break;
    }
    const count = f => out.filter((o, v) => f(o, how[v])).length;
    return { labels: out, unnamed: count((o, h) => h === 'meets'), smaller: count(o => o.size < 1), unclear: count((o, h) => h === 'unclear'), kept: count(o => o.kept), across: out.filter((o, v) => across(v, o.box)).length };
  }

  /* The box a place's name takes, in grid steps, with the place at (x, y):
     its grid points' cells, a little short of full height (the letters are
     0.72 of a step). */
  function subwayNameBox(x, y, side, w) {
    const c = subwayNameCells(0, 0, side, w);
    if (!c.length) return null;
    const xs = c.map(p => p[0]);
    return { x0: x + Math.min(...xs) - 0.5, x1: x + Math.max(...xs) + 0.5, y0: y + c[0][1] - 0.42, y1: y + c[0][1] + 0.42 };
  }
  // Whether a segment reaches into a box (Liang and Barsky's clip).
  function subwaySegmentInBox(a, b, r) {
    let t0 = 0, t1 = 1;
    const dx = b.x - a.x, dy = b.y - a.y, p = [-dx, dx, -dy, dy], q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 1e-9;
  }

  function subwayFine(at, paths, links, order, o, names, heading, bars, mix) {
    // A link with no clear drawing pins to their grid points its two places and every place
    // within three steps of its 45-degree path, or whose name comes within two, which were
    // clear of it there; a name moved onto another, a place or a link pins its place and theirs;
    // and the whole is done again, a few times at most. A bar and the places it is linked to
    // are pinned from the start, so that its links keep the ports the 45-degree map gave them.
    const pinned = new Set();
    links.forEach(([a, b]) => { if (bars && (bars[a] || bars[b])) { pinned.add(a); pinned.add(b); } });
    let f = null;
    for (let tries = 0; tries < 4; tries++) {
      f = subwayFineOnce(at, paths, links, order, o, names, pinned, heading, bars, mix);
      if (!f.looseLinks.length && !f.clash.length) break;
      const more = f.clash.filter(v => !pinned.has(v));
      if (!f.looseLinks.length && !more.length) break; // pinning cannot mend it
      for (const v of more) pinned.add(v);
      for (const e of f.looseLinks) {
        pinned.add(links[e][0]); pinned.add(links[e][1]);
        for (const q of paths[e]) at.forEach((p, v) => {
          if (Math.max(Math.abs(p.i - q.i), Math.abs(p.j - q.j)) <= 3) pinned.add(v);
          const r = names && subwayNameBox(p.i, p.j, names.side[v], names.width[v]);
          if (r && q.i > r.x0 - 2 && q.i < r.x1 + 2 && q.j > r.y0 - 2 && q.j < r.y1 + 2) pinned.add(v);
        });
      }
    }
    return { at: f.at, lines: f.lines, loose: f.looseLinks.length + f.clash.length, pinned: pinned.size, forced: f.forced };
  }
  function subwayFineOnce(at, paths, links, order, o, names, pinned, heading, bars, mix) {
    const { Math, Infinity } = globalThis; // looked up once: in node:vm, where the checks run, a global is a slow lookup
    const n = at.length;
    const P = at.map(p => ({ x: p.i, y: p.j })), P0 = P.map(p => ({ ...p }));
    const bends = paths.map(p => { let b = 0; for (let k = 1; k + 1 < p.length; k++) if (p[k].i - p[k - 1].i !== p[k + 1].i - p[k].i || p[k].j - p[k - 1].j !== p[k + 1].j - p[k].j) b++; return b; });
    // where each link leaves its places, fixed from them: the place's point, or a point of its bar
    const off = links.map(([a, b], e) => { const p = paths[e], q = p[p.length - 1]; return [{ x: p[0].i - at[a].i, y: p[0].j - at[a].j }, { x: q.i - at[b].i, y: q.j - at[b].j }]; });
    const endA = e => ({ x: P[links[e][0]].x + off[e][0].x, y: P[links[e][0]].y + off[e][0].y });
    const endB = e => ({ x: P[links[e][1]].x + off[e][1].x, y: P[links[e][1]].y + off[e][1].y });
    // the points a place takes, and whether a piece from p to q comes within clear of them or cuts
    // across its bar; the piece's own end at the place is not counted
    const ptsOf = v => (bars && bars[v] ? subwayBarCells(bars[v], 0, 0).map(([x, y]) => ({ x: P[v].x + x, y: P[v].y + y })) : [P[v]]);
    const over = (w, p, q) => {
      const pts = ptsOf(w), mine = r => Math.hypot(r.x - p.x, r.y - p.y) < 1e-6 || Math.hypot(r.x - q.x, r.y - q.y) < 1e-6;
      for (const r of pts) if (!mine(r) && nearSegment(r, p, q) < o.clear) return true;
      for (let k = 0; k + 1 < pts.length; k++) if (nearSegment(p, pts[k], pts[k + 1]) > 1e-9 && nearSegment(q, pts[k], pts[k + 1]) > 1e-9 && subwayCross(p.x, p.y, q.x, q.y, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y)) return true;
      return false;
    };
    // on the map that keeps each link's heading, whether class k, from the link's first end, keeps it,
    // and whether a drawing of the link does; on the map with 22.5 degrees only where needed, a class
    // between the 45-degree ones only for the links that need it (subwayNeedy), or for one that has
    // no drawing without (forced)
    let keepHeading = !!heading, anyClass = false;
    const kOk = (e, k) => (!keepHeading || subwayHeadingOk(heading, e, ...fineUnit(k))) && (!mix || !(k & 1) || anyClass || mix.needy.has(e));
    const lineOk = (e, l) => !keepHeading || l.every((p, i) => i + 1 === l.length || subwayHeadingOk(heading, e, l[i + 1].x - p.x, l[i + 1].y - p.y));
    const needs = e => !!mix && mix.needy.has(e) && !pinned.has(links[e][0]) && !pinned.has(links[e][1]);
    // each link's class from its first end, or -1 while it is not held straight; on the map with
    // 22.5 degrees only where needed, one that needs it is let go
    const cls = links.map((_, e) => { if (bends[e] || needs(e)) return -1; const k = fineClass(paths[e][1].i - paths[e][0].i, paths[e][1].j - paths[e][0].j); return kOk(e, k) ? k : -1; });
    // the class nearest the line between a link's ends, of those that keep its heading
    const nearest = e => {
      const A = endA(e), B = endB(e), dx = B.x - A.x, dy = B.y - A.y;
      if (kOk(e, fineClass(dx, dy))) return fineClass(dx, dy);
      let best = -1;
      for (let k = 0; k < 16; k++) if (kOk(e, k) && (best < 0 || fineAngErr(dx, dy, k) < fineAngErr(dx, dy, best))) best = k;
      return best;
    };
    const want = links.map((_, e) => cls[e] >= 0 ? cls[e] : nearest(e));
    const portOf = (v, e, k) => (links[e][0] === v ? k : (k + 8) % 16);
    // the links at v with a port, in clockwise order of their ports, follow v's order, with a
    // port to spare between two of them for each link without one that comes between
    const inOrder = (v, portFor) => {
      // a bar's links, pinned, keep the ports along it that the 45-degree map gave them
      if (bars && bars[v]) return true;
      const all = order[v].map(f => ({ f, p: portFor(f) })), held = all.filter(x => x.p >= 0);
      if (new Set(held.map(x => x.p)).size !== held.length) return false;
      if (held.length >= 3) {
        const sorted = held.slice().sort((a, b) => a.p - b.p).map(x => x.f), first = sorted.indexOf(held[0].f);
        if (!held.every((x, t) => sorted[(first + t) % held.length] === x.f)) return false;
      }
      if (held.length < 2) return true;
      for (let i = 0; i < all.length; i++) {
        if (all[i].p < 0) continue;
        let between = 0, j = (i + 1) % all.length;
        while (all[j].p < 0) { between++; j = (j + 1) % all.length; }
        if (((all[j].p - all[i].p + 16) % 16 || 16) < between + 1) return false;
      }
      return true;
    };
    const fits = (e, k) => links[e].every(v => inOrder(v, f => (f === e ? portOf(v, e, k) : cls[f] >= 0 ? portOf(v, f, cls[f]) : -1)));
    // on the map with 22.5 degrees only where needed, only the links that need it
    const cand = links.map((_, e) => e).filter(e => cls[e] < 0 && (!mix || needs(e)))
      .map(e => { const A = endA(e), B = endB(e); return { e, err: fineAngErr(B.x - A.x, B.y - A.y, want[e]) }; })
      .sort((a, b) => a.err - b.err);
    // a pinned place keeps its links as the 45-degree map has them
    for (const { e } of cand) if (!pinned.has(links[e][0]) && !pinned.has(links[e][1]) && fits(e, want[e])) cls[e] = want[e];
    const L = links.map((_, e) => { const A = endA(e), B = endB(e); return Math.hypot(B.x - A.x, B.y - A.y); });
    // on the map with 22.5 degrees only where needed, only the places within SUBWAY_NEEDY.reach jumps
    // of a link that needs it may move, so that the rest stay on their grid points
    let active = null;
    if (mix) {
      active = new Uint8Array(n);
      const adj = Array.from({ length: n }, () => []);
      links.forEach(([a, b]) => { adj[a].push(b); adj[b].push(a); });
      let ring = [];
      links.forEach((l, e) => { if (needs(e)) for (const v of l) if (!active[v]) { active[v] = 1; ring.push(v); } });
      for (let r = 0; r < SUBWAY_NEEDY.reach; r++) { const next = []; for (const v of ring) for (const w of adj[v]) if (!active[w]) { active[w] = 1; next.push(w); } ring = next; }
    }
    function solve() {
      const nb = Array.from({ length: n }, () => []);
      links.forEach(([a, b], e) => { if (cls[e] >= 0) { nb[a].push(e); nb[b].push(e); } });
      for (let it = 0; it < o.iters; it++) {
        for (let e = 0; e < links.length; e++) if (cls[e] >= 0) {
          const A = endA(e), B = endB(e), [ux, uy] = fineUnit(cls[e]);
          L[e] = Math.max(o.minLen, (B.x - A.x) * ux + (B.y - A.y) * uy);
        }
        for (let v = 0; v < n; v++) {
          if (pinned.has(v) || (active && !active[v])) continue;
          let sx = o.anchor * P0[v].x, sy = o.anchor * P0[v].y, sw = o.anchor;
          for (const e of nb[v]) {
            const [a] = links[e], [ux, uy] = fineUnit(cls[e]);
            if (a === v) { const B = endB(e); sx += B.x - L[e] * ux - off[e][0].x; sy += B.y - L[e] * uy - off[e][0].y; } else { const A = endA(e); sx += A.x + L[e] * ux - off[e][1].x; sy += A.y + L[e] * uy - off[e][1].y; }
            sw += 1;
          }
          P[v].x = sx / sw; P[v].y = sy / sw;
        }
      }
    }
    const resid = e => { const A = endA(e), B = endB(e); return fineAngErr(B.x - A.x, B.y - A.y, cls[e]); };
    const isNew = new Set(cand.map(c => c.e));
    // on the map with room for names, each name a box that goes with its place
    const box = v => (names ? subwayNameBox(P[v].x, P[v].y, names.side[v], names.width[v]) : null);
    const boxes = () => P.map((_, v) => box(v));
    const inBox = (p, r) => r && p.x > r.x0 - o.clear && p.x < r.x1 + o.clear && p.y > r.y0 - o.clear && p.y < r.y1 + o.clear;
    const meet = (a, b) => a && b && a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    // on the map with 22.5 degrees only where needed, how far each link's ends lie from the way it should run
    const dev = f => { const A = endA(f), B = endB(f); return subwayAngDiff(Math.atan2(B.y - A.y, B.x - A.x), mix.aim[f]); };
    const dev0 = mix ? links.map((_, f) => dev(f)) : null;
    for (let round = 0; round < o.rounds; round++) {
      solve();
      const bad = new Set(cand.map(c => c.e).filter(e => cls[e] >= 0 && resid(e) > o.eps).sort((a, b) => resid(b) - resid(a)).slice(0, 12));
      const blame = v => { for (let e = 0; e < links.length; e++) if (isNew.has(e) && cls[e] >= 0 && links[e].includes(v)) bad.add(e); };
      // and there, a link not held whose ends the moves have turned further from its way than they
      // were or than SUBWAY_NEEDY.off, or past its heading, blames the links held at its ends
      if (mix) links.forEach(([a, b], f) => {
        if (cls[f] >= 0) return;
        const d = dev(f);
        if (d > Math.max(dev0[f], SUBWAY_NEEDY.off) + 1e-6 || (heading && d > SUBWAY_HEADING.cone + 1e-6)) { blame(a); blame(b); }
      });
      links.forEach(([a, b], e) => {
        if (cls[e] < 0) return;
        const A = endA(e), B = endB(e);
        for (let w = 0; w < n; w++) if ((w !== a && w !== b) || (bars && bars[w]) ? over(w, A, B) : false) { blame(w); blame(a); blame(b); }
      });
      for (let v = 0; v < n; v++) for (let w = v + 1; w < n; w++) if (ptsOf(v).some(p => ptsOf(w).some(q => Math.hypot(p.x - q.x, p.y - q.y) < o.minSep))) { blame(v); blame(w); }
      if (names) {
        const B = boxes();
        links.forEach(([a, b], e) => {
          if (cls[e] < 0) return;
          for (let w = 0; w < n; w++) if (B[w] && subwaySegmentInBox(endA(e), endB(e), B[w])) { blame(w); blame(a); blame(b); }
        });
        for (let v = 0; v < n; v++) for (let w = 0; w < n; w++) if (v !== w && (inBox(P[v], B[w]) || (v < w && meet(B[v], B[w])))) { blame(v); blame(w); }
      }
      if (!bad.size) break;
      for (const e of bad) cls[e] = -1;
      if (round === o.rounds - 1) { for (const e of isNew) cls[e] = -1; solve(); }
    }
    // on the map with 22.5 degrees only where needed, the places solved again from their grid points
    // with only the links kept, so that those the tries moved and left go back
    if (mix) {
      P.forEach((p, v) => { p.x = P0[v].x; p.y = P0[v].y; });
      for (let t = 0; t < o.rounds && (t === 0 || links.some((_, e) => cls[e] >= 0 && resid(e) > o.eps)); t++) solve();
    }
    const lines = links.map((_, e) => (cls[e] >= 0 && resid(e) <= o.eps ? [endA(e), endB(e)] : null));
    const port = links.map((_, e) => (lines[e] ? [cls[e], (cls[e] + 8) % 16] : [-1, -1]));
    const portAt = (v, f) => (port[f][links[f][0] === v ? 0 : 1]);
    const segs = [];
    const addSegs = (e, l) => { for (let k = 0; k + 1 < l.length; k++) segs.push({ e, a: l[k], b: l[k + 1] }); };
    links.forEach((_, e) => { if (lines[e]) addSegs(e, lines[e]); });
    // what a drawing of link e would cost in crossings, or null if it runs over a system or along a link
    const B = boxes();
    function hurt(e, l) {
      const [u, v] = links[e];
      let x = 0;
      for (let k = 0; k + 1 < l.length; k++) {
        for (let w = 0; w < n; w++) if (((w !== u && w !== v) || (bars && bars[w])) && over(w, l[k], l[k + 1])) return null;
        if (names) for (let w = 0; w < n; w++) if (B[w] && subwaySegmentInBox(l[k], l[k + 1], B[w])) return null;
        for (const s2 of segs) {
          if (runAlong(l[k], l[k + 1], s2.a, s2.b)) return null;
          const [c, d] = links[s2.e];
          if (c === u || c === v || d === u || d === v) continue;
          if (subwayCross(l[k].x, l[k].y, l[k + 1].x, l[k + 1].y, s2.a.x, s2.a.y, s2.b.x, s2.b.y)) x++;
        }
      }
      return x;
    }
    const portsFree = (e, ka, kb) => {
      const [a, b] = links[e];
      return inOrder(a, f => (f === e ? ka : portAt(a, f))) && inOrder(b, f => (f === e ? kb : portAt(b, f)));
    };
    const looseLinks = [];
    // first the links whose ends have not moved, each on its 45-degree path where that is still
    // clear; then the rest, fitted round them
    const unmoved = e => links[e].every(v => Math.hypot(P[v].x - P0[v].x, P[v].y - P0[v].y) < 1e-9);
    for (const e of links.map((_, e) => e).filter(e => !lines[e] && unmoved(e) && !needs(e))) {
      const [a, b] = links[e], l = paths[e].map(q => ({ x: q.i, y: q.j }));
      const ka = fineClass(l[1].x - l[0].x, l[1].y - l[0].y), kb = fineClass(l[l.length - 2].x - l[l.length - 1].x, l[l.length - 2].y - l[l.length - 1].y);
      if (lineOk(e, l) && portsFree(e, ka, kb) && hurt(e, l) !== null) { lines[e] = l; port[e] = [ka, kb]; addSegs(e, l); }
    }
    // the drawing of link e with one bend, or failing that two, the cheapest that is clear
    function drawLink(e) {
      const [a, b] = links[e], A = endA(e), B = endB(e), dx = B.x - A.x, dy = B.y - A.y;
      const cands = [];
      // the 45-degree path, where neither end moved
      if (Math.hypot(P[a].x - P0[a].x, P[a].y - P0[a].y) < 1e-9 && Math.hypot(P[b].x - P0[b].x, P[b].y - P0[b].y) < 1e-9) {
        const l = paths[e].map(q => ({ x: q.i, y: q.j }));
        if (lineOk(e, l)) cands.push({ l, ka: fineClass(l[1].x - l[0].x, l[1].y - l[0].y), kb: fineClass(l[l.length - 2].x - l[l.length - 1].x, l[l.length - 2].y - l[l.length - 1].y), base: bends[e] * o.bendCost });
      }
      for (let ka = 0; ka < 16; ka++) for (let kb = 0; kb < 16; kb++) {
        // out from a along ka, in to b against kb
        if (!kOk(e, ka) || !kOk(e, (kb + 8) % 16)) continue;
        const [ax, ay] = fineUnit(ka), [bx, by] = fineUnit(kb), den = -ax * by + ay * bx;
        if (Math.abs(den) < 1e-9) continue;
        const t = (-dx * by + dy * bx) / den, s = (ax * dy - ay * dx) / den;
        if (t < o.minLeg || s < o.minLeg) continue;
        const base = o.bendCost + fineAngErr(-bx, -by, ka) / FINE_STEP * 0.5 + (fineAngErr(dx, dy, ka) + fineAngErr(-dx, -dy, kb)) * 2 + Math.abs(t - s) / (t + s) * 0.5;
        cands.push({ l: [A, { x: A.x + t * ax, y: A.y + t * ay }, B], ka, kb, base });
      }
      const pick = list => {
        let best = null;
        for (const c of list.sort((p, q) => p.base - q.base)) {
          if (best && c.base >= best.cost) break;
          if (!portsFree(e, c.ka, c.kb)) continue;
          const x = hurt(e, c.l);
          if (x !== null && (!best || c.base + x * o.crossCost < best.cost)) best = { ...c, cost: c.base + x * o.crossCost };
        }
        return best;
      };
      let best = pick(cands);
      if (!best) {
        // two bends: out along ka, across along km, in along kb; the outer legs as long as each
        // other, or one of them short. No leg may head more than 67.5 degrees off the way from
        // one end to the other, and each turn and every step further than the straight way costs.
        const two = [], d = Math.hypot(dx, dy), off = FINE_STEP * 3 + 1e-9;
        for (let ka = 0; ka < 16; ka++) for (let kb = 0; kb < 16; kb++) for (let km = 0; km < 16; km++) {
          if (fineAngErr(dx, dy, ka) > off || fineAngErr(-dx, -dy, kb) > off || fineAngErr(dx, dy, km) > off) continue;
          if (!kOk(e, ka) || !kOk(e, km) || !kOk(e, (kb + 8) % 16)) continue;
          const [ax, ay] = fineUnit(ka), [bx, by] = fineUnit(kb), [mx, my] = fineUnit(km);
          for (const legs of ['same', 'shortA', 'shortB']) {
            // a*t + m*M - b*s = (dx, dy), with t = s, or t or s fixed at twice minLeg
            let t, m, s2;
            if (legs === 'same') { const sx = ax - bx, sy = ay - by, den = sx * my - sy * mx; if (Math.abs(den) < 1e-9) continue; t = s2 = (dx * my - dy * mx) / den; m = (sx * dy - sy * dx) / den; }
            else {
              const fixed = 2 * o.minLeg, [fx, fy] = legs === 'shortA' ? [ax, ay] : [-bx, -by], [ux, uy] = legs === 'shortA' ? [-bx, -by] : [ax, ay];
              const rx = dx - fixed * fx, ry = dy - fixed * fy, den = mx * uy - my * ux;
              if (Math.abs(den) < 1e-9) continue;
              m = (rx * uy - ry * ux) / den; const other = (mx * ry - my * rx) / den;
              if (legs === 'shortA') { t = fixed; s2 = other; } else { s2 = fixed; t = other; }
            }
            if (t < o.minLeg || s2 < o.minLeg || m < o.minLeg) continue;
            const p1 = { x: A.x + t * ax, y: A.y + t * ay }, p2 = { x: p1.x + m * mx, y: p1.y + m * my };
            const turns = fineAngErr(mx, my, ka) / FINE_STEP + fineAngErr(-bx, -by, km) / FINE_STEP;
            two.push({ l: [A, p1, p2, B], ka, kb, base: 2 * o.bendCost + turns * 0.5 + 2 * (t + m + s2 - d) / Math.max(d, 1) });
          }
        }
        best = pick(two);
      }
      return best;
    }
    let forced = 0;
    for (const e of links.map((_, e) => e).filter(e => !lines[e])) {
      // on the map with 22.5 degrees only where needed, one with no drawing in 45-degree pieces
      // takes any; on the map that keeps each link's heading, one that cannot keep it is drawn as
      // on the others
      let best = drawLink(e);
      if (!best && mix) { anyClass = true; best = drawLink(e); anyClass = false; if (best) forced++; }
      if (!best && heading) { keepHeading = false; anyClass = true; best = drawLink(e); keepHeading = true; anyClass = false; }
      // one that needs 22.5 degrees keeps its 45-degree drawing, where its ends are where they were
      // and it is clear, unless the new one is less awkward (subwayAwkward)
      if (needs(e) && links[e].every(v => Math.hypot(P[v].x - P0[v].x, P[v].y - P0[v].y) < 1e-6)) {
        const l = paths[e].map(q => ({ x: q.i, y: q.j })), ka = fineClass(l[1].x - l[0].x, l[1].y - l[0].y), kb = fineClass(l[l.length - 2].x - l[l.length - 1].x, l[l.length - 2].y - l[l.length - 1].y);
        if ((!best || subwayAwkward(best.l, heading, e) >= subwayAwkward(l, heading, e)) && portsFree(e, ka, kb) && hurt(e, l) !== null) best = { l, ka, kb };
      }
      if (best) { lines[e] = best.l; port[e] = [best.ka, best.kb]; }
      else { lines[e] = [endA(e), endB(e)]; looseLinks.push(e); }
      addSegs(e, lines[e]);
    }
    // names that the moves have brought onto another name, a place or a link: their places are
    // pinned next time
    const clash = new Set();
    if (names) {
      const B = boxes();
      for (let v = 0; v < n; v++) for (let w = 0; w < n; w++) {
        if (v === w || !B[w]) continue;
        if (inBox(P[v], B[w]) || (v < w && meet(B[v], B[w]))) { clash.add(v); clash.add(w); }
      }
      links.forEach(([a, b], e) => { for (let k = 0; k + 1 < lines[e].length; k++) for (let w = 0; w < n; w++) if (B[w] && subwaySegmentInBox(lines[e][k], lines[e][k + 1], B[w])) { clash.add(w); clash.add(a); clash.add(b); } });
    }
    return { at: P, lines, looseLinks, clash: [...clash], forced };
  }

  /* The whole layout. pos: true positions; links: pairs of indices into pos.
     Returns the positions and each link's points from its first end to its
     second (null for one that could not be routed), fitted into pos's
     bounding box. */
  function subwayLayout(pos, links, tune, kind, names, nebulae) {
    const T = tune || SUBWAY_TUNE, F = subwayFlags(kind);
    const lens = links.map(([a, b]) => Math.hypot(pos[a].x - pos[b].x, pos[a].y - pos[b].y)).sort((a, b) => a - b);
    const L = lens.length ? lens[lens.length >> 1] : 1;
    // each link's true direction, from its first end to its second, on the map that keeps them
    const heading = F.heading ? links.map(([a, b]) => Math.atan2(pos[b].y - pos[a].y, pos[b].x - pos[a].x)) : null;
    // on the map that keeps each link's heading, a place whose links truly cross many others is pulled
    // less hard to where it truly is, so that a tangle can come apart
    let pull = F.heading ? SUBWAY_HEADING.evenPull : T.evenPull;
    if (F.heading && SUBWAY_HEADING.tangle) {
      const c = new Float64Array(pos.length);
      for (let e = 0; e < links.length; e++) for (let f = e + 1; f < links.length; f++) {
        const [a, b] = links[e], [p, q] = links[f];
        if (a === p || a === q || b === p || b === q) continue;
        if (subwayCross(pos[a].x, pos[a].y, pos[b].x, pos[b].y, pos[p].x, pos[p].y, pos[q].x, pos[q].y)) { c[a]++; c[b]++; c[p]++; c[q]++; }
      }
      const base = pull;
      pull = pos.map((_, v) => base / (1 + c[v] / SUBWAY_HEADING.tangle));
    }
    const even = subwayEven(pos, links, L, pull, T.evenIters);
    const D = L / T.len;
    const want = even.map(p => ({ x: p.x / D, y: p.y / D }));
    // names: how many characters each place's name has, for the map with room for them
    const width = names ? names.map(c => Math.ceil(c * T.charW + 0.4)) : null;
    // on the map that keeps each link's heading, room is kept for the names as on the map with room for
    // names, but a link may pass through it at a price, and the names are put last, where the lines left
    // room, their kept room first (subwayLabels)
    const late = F.names && F.heading;
    // the places in each nebula (three or more), to be kept within its size
    const groups = (nebulae || []).map(r => { const members = pos.map((p, i) => i).filter(i => pos[i].x >= r.x && pos[i].x <= r.x + r.w && pos[i].y >= r.y && pos[i].y <= r.y + r.h); const mx = members.reduce((a, i) => a + pos[i].x, 0) / (members.length || 1), my = members.reduce((a, i) => a + pos[i].y, 0) / (members.length || 1); return { members, off: members.map(i => ({ x: (pos[i].x - mx) / D, y: (pos[i].y - my) / D })), w: 0.8 * r.w / D, h: 0.8 * r.h / D, gap: SUBWAY_NEBULA_GAP * Math.min(r.w, r.h) / D }; })
      .filter(g => g.members.length >= 3);
    // on the map with room for names that keeps each link's heading, each place's neighbours -- those
    // it is linked to, and its twelve nearest others within two and a half typical links, however many
    // jumps away (one and a half and eight turned 49 of the 3826 pairs that near past 45 degrees,
    // this 41) -- with the way each
    // truly lies from it and how far, in grid steps (on the maps without room for names they packed
    // the densest nebula so close that three links found no way)
    let neighbours = null;
    if (heading && T.place.near) {
      const linked = new Set(links.map(([a, b]) => a + ',' + b)), isLinked = (v, w) => linked.has(Math.min(v, w) + ',' + Math.max(v, w));
      neighbours = pos.map((p, v) => {
        const all = pos.map((q, w) => ({ w, d: Math.hypot(q.x - p.x, q.y - p.y), ang: Math.atan2(q.y - p.y, q.x - p.x), dx: (q.x - p.x) / D, dy: (q.y - p.y) / D, linked: isLinked(v, w) })).filter(o => o.w !== v && o.d > 0);
        return all.filter(o => o.linked).concat(all.filter(o => !o.linked && o.d < T.place.near.reach * L).sort((a, b) => a.d - b.d).slice(0, T.place.near.count));
      });
    }
    // on the map that keeps each link's heading, the places whose links cannot all leave one point keeping
    // it, unless the map is asked for points only (dots)
    const bars = subwayBars(pos.length, links, F.dots ? null : heading);
    const pairs = subwayPairs(pos, links);
    const placed = subwayPlace(want, links, T.place, T.spacing, T.len, width, groups, heading, neighbours, bars, pairs);
    // the links round each place leave it in the order they have evened out, or on the map that keeps
    // each link's heading, in their true order
    // the map with room for names leaves a place whose links run straight where it is, which keeps its
    // room; with the names put after the lines there is none to keep, and a move may bring a link back
    // within its heading
    const routed = subwayRoute(placed.at, heading ? pos : want, links, late ? { ...T.route, leaveStraight: false, nameStep: SUBWAY_HEADING.nameStep } : T.route, names ? { side: placed.side, width } : null, heading, groups, T.route.nebulaShape, bars, pairs);
    const stats = { moves: placed.moves, rerouted: routed.rerouted, moved: routed.moved, failed: routed.paths.filter(p => !p).length, bars: bars.filter(Boolean).length };
    let at = routed.at.map(p => ({ x: p.i, y: p.j })), lines = routed.paths.map(p => p && p.map(q => ({ x: q.i, y: q.j })));
    if (F.fine && !stats.failed) {
      const aim = heading || links.map(([a, b]) => Math.atan2(want[b].y - want[a].y, want[b].x - want[a].x));
      const mix = F.mixed ? { needy: subwayNeedy(routed.paths, aim, heading), aim } : null;
      const f = subwayFine(routed.at, routed.paths, links, routed.order, SUBWAY_FINE, names && !late ? { side: placed.side, width } : null, heading, bars, mix);
      at = f.at; lines = f.lines; stats.loose = f.loose; stats.pinned = f.pinned;
      // the links let go for 22.5 degrees, those with no drawing without them, and those drawn with a piece between the 45-degree directions
      if (mix) Object.assign(stats, { needy: mix.needy.size, forced: f.forced, odd: lines.filter(l => l && l.some((p, i) => i + 1 < l.length && fineClass(l[i + 1].x - p.x, l[i + 1].y - p.y) & 1)).length });
    }
    // the links drawn with a piece that does not keep their heading (a 22.5-degree piece is held
    // within eps of its angle)
    const labels = late ? subwayLabels(at, lines, names.map(c => c * T.charW), placed.side, links, bars, F.side) : null;
    if (labels) Object.assign(stats, { unnamed: labels.unnamed, smaller: labels.smaller, unclear: labels.unclear, kept: labels.kept, across: labels.across });
    if (heading) stats.astray = lines.filter((l, e) => l && l.some((p, i) => i + 1 < l.length && !subwayHeadingOk(heading, e, l[i + 1].x - p.x, l[i + 1].y - p.y, F.fine ? SUBWAY_FINE.eps : 0))).length;
    // into the true bounding box, one scale both ways so the angles stay
    const box = ps => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of ps) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } return { x0, y0, x1, y1 }; };
    const b0 = box(pos), b1 = box(at);
    const k = Math.min((b0.x1 - b0.x0) / Math.max(b1.x1 - b1.x0, 1), (b0.y1 - b0.y0) / Math.max(b1.y1 - b1.y0, 1));
    const ox = (b0.x0 + b0.x1) / 2 - k * (b1.x0 + b1.x1) / 2, oy = (b0.y0 + b0.y1) / 2 - k * (b1.y0 + b1.y1) / 2;
    const to = p => ({ x: ox + k * p.x, y: oy + k * p.y });
    const out = { at: at.map(to), lines: lines.map(l => l && l.map(to)), step: k, origin: { x: ox, y: oy }, kind: kind || '45', stats };
    // each bar's two ends, back and front, where the page draws it
    if (stats.bars) out.bars = bars.map((b, v) => { if (!b) return null; const c = subwayBarCells(b, at[v].x, at[v].y), [x0, y0] = c[0], [x1, y1] = c[c.length - 1]; return { a: to({ x: x0, y: y0 }), b: to({ x: x1, y: y1 }) }; });
    if (names) Object.assign(out, { width, textW: names.map(c => c * T.charW) }, labels
      ? { labels: labels.labels.map(l => ({ ...to(l), align: l.align, size: l.size, box: { x0: ox + k * l.box.x0, x1: ox + k * l.box.x1, y0: oy + k * l.box.y0, y1: oy + k * l.box.y1 } })) }
      : { side: placed.side });
    return out;
  }

  /* Where a rectangle of the true galaxy -- a nebula -- goes on the subway
     map: moved and scaled, one factor both ways, so that the places round
     it are, as nearly as can be, where they were within it: the factor the
     ratio of how far they spread about their weighted middle to how far
     they did (a least-squares factor comes out too small where the layout
     has shuffled them), and the middle where that factor puts their
     weighted middle. A nebula's picture is brightest in
     its middle, so the places there weigh most: a place's weight falls off
     with its distance from the middle, measured in the nebula's half-widths,
     as a normal curve of spread 0.6 (the maintainer found Obatta, alone in
     the middle of its nebula, put at the edge, and SPC-050, at the edge,
     in the middle, 28 September 2026). Given the picture's brightness
     (subwayBrightness), that is only the start: the rectangle is then
     moved, up to half its size, and made smaller, to where the places near
     it are over as bright or as dark a part of the picture as they truly
     are, which is what the eye takes for in or out (SPC-050, inside the
     Obatta Nebula's rectangle but over its dark edge, was still put over
     its brightest band). The factor is kept at 1 or less, since a nebula's
     pictures are made for set scales and blur when stretched (the
     maintainer's asking), and at 0.3 or more. places: true positions; at:
     their subway positions; bright: the picture's brightness, or null. */
  const SUBWAY_NEBULA_SPREAD = 0.6;
  function subwayRect(places, at, r, bright) {
    const hw = r.w / 2, hh = r.h / 2, cx = r.x + hw, cy = r.y + hh;
    const near = [];
    places.forEach((p, i) => {
      const ux = (p.x - cx) / hw, uy = (p.y - cy) / hh, u2 = ux * ux + uy * uy;
      if (u2 <= 9) near.push({ dx: p.x - cx, dy: p.y - cy, sx: at[i].x, sy: at[i].y, w: Math.exp(-u2 / (2 * SUBWAY_NEBULA_SPREAD ** 2)) });
    });
    // with no place within three half-widths, the four nearest, alike
    if (!near.length) for (const i of places.map((p, i) => i).sort((a, b) => Math.hypot(places[a].x - cx, places[a].y - cy) - Math.hypot(places[b].x - cx, places[b].y - cy)).slice(0, 4)) near.push({ dx: places[i].x - cx, dy: places[i].y - cy, sx: at[i].x, sy: at[i].y, w: 1 });
    let W = 0, mdx = 0, mdy = 0, msx = 0, msy = 0;
    for (const q of near) { W += q.w; mdx += q.w * q.dx; mdy += q.w * q.dy; msx += q.w * q.sx; msy += q.w * q.sy; }
    mdx /= W; mdy /= W; msx /= W; msy /= W;
    let tt = 0, ss = 0;
    for (const q of near) { tt += q.w * ((q.dx - mdx) ** 2 + (q.dy - mdy) ** 2); ss += q.w * ((q.sx - msx) ** 2 + (q.sy - msy) ** 2); }
    const k = Math.min(1, Math.max(0.3, tt > 1e-9 ? Math.sqrt(ss / tt) : 1));
    // the middle, for that factor: where the fit puts the true middle
    const x = msx - k * mdx, y = msy - k * mdy;
    if (!bright) return { x: x - k * hw, y: y - k * hh, w: k * r.w, h: k * r.h, scale: k };
    // the places that are or may come over the picture, and how bright it truly is under each
    const over = [];
    places.forEach((p, i) => {
      const tu = (p.x - r.x) / r.w, tv = (p.y - r.y) / r.h, su = (at[i].x - x) / (k * r.w) + 0.5, sv = (at[i].y - y) / (k * r.h) + 0.5;
      if ((tu > -0.25 && tu < 1.25 && tv > -0.25 && tv < 1.25) || (su > -1.25 && su < 2.25 && sv > -1.25 && sv < 2.25)) over.push({ s: at[i], b: subwayBrightAt(bright, tu, tv) });
    });
    let best = null;
    for (const f of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const kk = Math.max(0.3, k * f), w = kk * r.w, h = kk * r.h;
      for (let du = -0.5; du <= 0.5 + 1e-9; du += 0.05) for (let dv = -0.5; dv <= 0.5 + 1e-9; dv += 0.05) {
        const x0 = x + du * w - w / 2, y0 = y + dv * h - h / 2;
        // the brightness each is over, against its true; a little for going far from the fit
        let e = 0.3 * (du * du + dv * dv + Math.log(kk / k) ** 2);
        for (const o of over) e += (subwayBrightAt(bright, (o.s.x - x0) / w, (o.s.y - y0) / h) - o.b) ** 2;
        if (!best || e < best.e) best = { e, x: x0, y: y0, w, h, scale: kk };
      }
    }
    return { x: best.x, y: best.y, w: best.w, h: best.h, scale: best.scale };
  }
  /* A nebula picture's brightness: each pixel's brightest channel, averaged
     over an n by n grid and scaled so that the brightest cell is 1. pixels:
     RGBA, w by h. */
  function subwayBrightness(pixels, w, h, n = 24) {
    const v = new Float32Array(n * n), c = new Float32Array(n * n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4, g = Math.floor(y * n / h) * n + Math.floor(x * n / w);
      v[g] += Math.max(pixels[k], pixels[k + 1], pixels[k + 2]); c[g]++;
    }
    let top = 0;
    for (let i = 0; i < v.length; i++) { v[i] = c[i] ? v[i] / c[i] : 0; top = Math.max(top, v[i]); }
    if (top > 0) for (let i = 0; i < v.length; i++) v[i] /= top;
    return { n, v };
  }
  // the brightness at (u, v) across the picture, 0 to 1 each way; none off it
  const subwayBrightAt = (B, u, v) => (u < 0 || v < 0 || u >= 1 || v >= 1 ? 0 : B.v[Math.floor(v * B.n) * B.n + Math.floor(u * B.n)]);

  /* Every nebula's rectangle on the subway map (subwayRect), and then any two
     nearer than SUBWAY_NEBULA_GAP of the smaller's size shrunk, the larger
     first, a tenth at a time, until they are that far apart or at the least
     size, so that one nebula is not taken for part of another (the
     maintainer's asking). */
  const SUBWAY_NEBULA_GAP = 0.15;
  function subwayRects(places, at, nebulae, brights) {
    const rs = nebulae.map((r, i) => ({ ...subwayRect(places, at, r, brights && brights[i]), w0: r.w, h0: r.h }));
    const clear = (a, b) => {
      const need = SUBWAY_NEBULA_GAP * Math.min(a.w0, a.h0, b.w0, b.h0);
      return Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h)) >= need;
    };
    const shrink = r => { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; r.scale = Math.max(0.3, r.scale * 0.9); r.w = r.w0 * r.scale; r.h = r.h0 * r.scale; r.x = cx - r.w / 2; r.y = cy - r.h / 2; };
    for (let round = 0; round < 40; round++) {
      let moved = false;
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        if (clear(rs[i], rs[j])) continue;
        const big = rs[i].w * rs[i].h >= rs[j].w * rs[j].h ? rs[i] : rs[j], small = big === rs[i] ? rs[j] : rs[i];
        const r = big.scale > 0.3 ? big : small;
        if (r.scale > 0.3) { shrink(r); moved = true; }
      }
      if (!moved) break;
    }
    return rs.map(({ x, y, w, h, scale }) => ({ x, y, w, h, scale }));
  }

  /* The galaxy's places and links, laid out: at(x, y) is where the place at
     true (x, y) goes, and line(a, b) the points of the link between the
     systems a and b, from a's place to b's, or null when there is none.
     stored is a layout this returned before, used when its fingerprint is
     this galaxy's, since working one out takes seconds on a phone. */
  // The tune a kind of map is made with.
  function subwayTuneFor(kind) { return subwayFlags(kind).names ? SUBWAY_NAMES : SUBWAY_TUNE; }

  /* What a kind of map of the galaxy u is laid out from, as plain data (for a
     background thread): its places, links, names and nebulae, and a
     fingerprint of all of it, the numbers and this code, to know a stored
     layout by. */
  function subwayInput(u, kind) {
    kind = kind || '45';
    const key = (x, y) => x + ',' + y;
    const index = new Map(), pos = [];
    for (const s of u.systems) if (!index.has(key(s.x, s.y))) { index.set(key(s.x, s.y), pos.length); pos.push({ x: s.x, y: s.y }); }
    const links = [], seen = new Set();
    for (const s of u.systems) for (const l of s.links) {
      const t = u.byId.get(l);
      if (!t) continue;
      const a = index.get(key(s.x, s.y)), b = index.get(key(t.x, t.y)), k = Math.min(a, b) + ',' + Math.max(a, b);
      if (a !== b && !seen.has(k)) { seen.add(k); links.push([Math.min(a, b), Math.max(a, b)]); }
    }
    // for the map with room for them, each place's longest name, in characters
    const F = subwayFlags(kind), names = F.names ? pos.map(() => 0) : null;
    if (names) for (const s of u.systems) { const i = index.get(key(s.x, s.y)); names[i] = Math.max(names[i], s.name.length); }
    const nebulae = (u.nebulae || []).map(n => ({ x: n.x, y: n.y, w: n.w, h: n.h }));
    // FNV-1a over what the layout depends on, this code among it: a layout stored by an earlier
    // version of it is not used (one was, on 28 September 2026, and the maintainer saw no change)
    const text = JSON.stringify([pos, links, subwayTuneFor(kind), kind, F.fine ? SUBWAY_FINE : null, names, nebulae].concat(F.heading ? [SUBWAY_HEADING] : [])) + String(subwayModule);
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return { kind, pos, links, names, nebulae, fingerprint: h.toString(16).padStart(8, '0') + '-' + pos.length + '-' + links.length };
  }
  function subwayWorkOut(input) {
    return Object.assign(subwayLayout(input.pos, input.links, subwayTuneFor(input.kind), input.kind, input.names, input.nebulae), { fingerprint: input.fingerprint });
  }

  /* A layout, looked up: at(x, y) is where the place at true (x, y) goes,
     bar(x, y) its bar's ends if it is drawn as one, line(a, b) the points
     of the link between the systems a and b, from a's place to b's,
     name(x, y) where a place's name goes, rect(n) a nebula's rectangle. */
  function subwayResult(input, r) {
    const { pos, links, names, nebulae, kind, fingerprint } = input;
    const key = (x, y) => x + ',' + y, index = new Map(pos.map((p, i) => [key(p.x, p.y), i])), pairs = new Map(links.map(([a, b], e) => [a + ',' + b, e]));
    let rects = null;
    return {
      places: pos, links, names, layout: r, fingerprint, kind,
      // where a place's name goes: its side, and the start of its letters and their room, in map units
      name: (x, y) => {
        const i = index.get(key(x, y));
        if (i === undefined) return null;
        // put where the lines left room, on the map that keeps each link's heading
        if (r.labels) { const l = r.labels[i]; return { align: l.align, x: l.x, y: l.y, w: r.textW[i] * l.size * r.step, h: 0.72 * l.size * r.step, size: l.size }; }
        if (!r.side) return null;
        const sd = r.side[i], off = (Math.abs(sd) - 0.4) * r.step, w = r.textW[i] * r.step, h = 0.72 * r.step;
        if (Math.abs(sd) === 3) {
          // centred on the cells it takes, which for an even count sit half a step right of the place
          const mid = r.at[i].x + (((r.width[i] - 1) % 2) / 2) * r.step;
          return { side: sd, align: 'center', x: mid, y: r.at[i].y + (sd > 0 ? -r.step : r.step), w, h };
        }
        return { side: sd, align: sd > 0 ? 'left' : 'right', x: r.at[i].x + (sd > 0 ? off : -off), y: r.at[i].y, w, h };
      },
      at: (x, y) => { const i = index.get(key(x, y)); return i === undefined ? null : r.at[i]; },
      // a place drawn as a bar (subwayBars): its back and front ends, or null
      bar: (x, y) => { const i = index.get(key(x, y)); return i === undefined || !r.bars ? null : r.bars[i]; },
      // a nebula's rectangle, by its true one (as nova-universe.js has it)
      // brights: each nebula's picture's brightness (subwayBrightness), or null where it is not read yet
      rect: (rect, brights) => {
        const i = nebulae.findIndex(n => n.x === rect.x && n.y === rect.y && n.w === rect.w && n.h === rect.h);
        if (i < 0) return subwayRect(pos, r.at, rect);
        const key = brights ? brights.map(b => (b ? 1 : 0)).join('') : '';
        if (!rects || rects.key !== key) rects = { key, list: subwayRects(pos, r.at, nebulae, brights) };
        return rects.list[i];
      },
      line(a, b) {
        const i = index.get(key(a.x, a.y)), j = index.get(key(b.x, b.y));
        const e = pairs.get(Math.min(i, j) + ',' + Math.max(i, j));
        if (e === undefined || !r.lines[e]) return null;
        return i < j ? r.lines[e] : r.lines[e].slice().reverse();
      },
    };
  }

  /* The galaxy u laid out as a kind of map, at once: stored is a layout this
     gave before, used when its fingerprint is this galaxy's. */
  function novaSubway(u, stored, kind) {
    const input = subwayInput(u, kind);
    return subwayResult(input, stored && stored.fingerprint === input.fingerprint ? stored : subwayWorkOut(input));
  }

  return {
    SUBWAY_DIRS, subwayTurn, SUBWAY_NAMES, SUBWAY_TUNE, SUBWAY_HEADING, subwayFlags, subwayAngDiff, subwayHeadingOk, subwayGridStray,
    subwayBarPorts, subwayPortFit, subwayBars, subwayBarOff, subwayBarCells, subwayAdjacency, subwayEven, subwayCross,
    subwayNameCells, SUBWAY_NEEDY, subwayShape, subwayAwkward, subwayNeedy, SUBWAY_LABEL, subwayLabelSpots, subwayLabels, subwayPlace, subwayRoute, SUBWAY_FINE, FINE_STEP, fineUnit, fineClass,
    fineAngErr, nearSegment, runAlong, subwayNameBox, subwaySegmentInBox, subwayFine, subwayFineOnce,
    subwayLayout, subwayRect, subwayBrightness, subwayBrightAt, SUBWAY_NEBULA_GAP, subwayRects, subwayTuneFor, subwayInput,
    subwayWorkOut, subwayResult, novaSubway,
  };
}
Object.assign(globalThis, subwayModule());
