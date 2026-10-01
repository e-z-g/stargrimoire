// js/nova-flight.js: ships in flight, held to figures worked by hand from
// Mac 1.1.1's code, and to the records' odds over many draws.
//
//   1. Rand (0xa4c76) against a second transcription of its instructions,
//      in BigInt; the trig tables; headings toward a point (TableArcTan);
//      how far apart two headings are (AngularDifference).
//   2. One ship stepped (HandleShip 0x33581): turning at its rate and
//      snapping to the heading; thrusting to its top speed, a step over at
//      most, and past it on a second axis; an inertialess ship steering its
//      velocity; an arrival from 50 a step, stopping where the sum says.
//   3. A fleet's escorts in formation behind the lead.
//   4. Odds: a system's düdes and a düde's ship types drawn 200,000 times
//      each, against Probs; a picker broken on purpose must fail the test.
//   5. Every release: every system set up with three seeds and run for
//      thirty seconds, no ship lost to a number that is not one; the counts
//      printed.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
const ROLES = new Set(['data', 'ships', 'sounds']);   // the records; the shäns are in the ships files, the warp sound in the sounds
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const near = (what, got, want, tol) => { if (!(Math.abs(got - want) <= tol)) fail(`${what}: ${got}, expected ${want} within ${tol}`); };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

// ---- 1. the program's arithmetic ----------------------------------------
// Rand, instruction by instruction in BigInt: lo = (s & 0xffff) * 0x41a7;
// t = (lo >> 16) + (s >> 16) * 0x41a7; s' = (lo & 0xffff) + ((t & 0x7fff)
// << 16) + ((2t mod 2^32) >> 16) - 0x7fffffff, mod 2^32; the number is
// n * (s' & 0xffff, 0x8000 taken as 0) >> 16.
{
  const M = 1n << 32n;
  let s = 12345n;
  const r = S.novaRandom(12345);
  let bad = 0;
  for (let i = 0; i < 100000; i++) {
    const n = [7, 100, 360, 1500, 0x3fe, 3, 2][i % 7];
    const lo = (s & 0xffffn) * 0x41a7n, t = (lo >> 16n) + (s >> 16n) * 0x41a7n;
    s = (((lo & 0xffffn) + ((t & 0x7fffn) << 16n) + (((2n * t) % M) >> 16n) - 0x7fffffffn) % M + M) % M;
    let w = s & 0xffffn; if (w === 0x8000n) w = 0n;
    const want = Number((BigInt(n) * w) >> 16n), got = r.rand(n);
    if (got !== want && bad++ < 3) fail(`Rand draw ${i}: ${got}, the second transcription ${want}`);
  }
  if (!bad) console.log('rand: 100,000 draws as the second transcription gives them');
}
near('sin 90', S.NOVA_SIN[90], 1, 1e-6); near('cos 180', S.NOVA_COS[180], -1, 1e-6); near('sin 30', S.NOVA_SIN[30], 0.5, 1e-6);
// The diagonals are a degree short: the table holds atan(1) x 57.2957795 = 44.99999..., truncated;
// and a ratio is read in whole hundredths, so 577/1000 as 0.57, 29.68 degrees, 29.
eq('headings toward the middle', [[0, 1000], [1000, 0], [-1000, 0], [0, -1000], [1000, 1000], [-1000, -1000], [1000, 577]].map(([x, y]) => S.novaBearing(x, y, 0, 0)), [0, 270, 90, 180, 314, 134, 299]);
eq('angles apart', [[10, 350], [350, 10], [90, 270], [0, 179], [0, 181], [170, 190]].map(([a, b]) => S.novaAngleApart(a, b)), [20, 20, 180, 179, 179, 20]);

// ---- 2. one ship, stepped ---------------------------------------------
const cls = (o = {}) => Object.assign({ id: 999, accel: Math.fround(0.05), speed: 3, turn: 3, flags: 0, flags2: 0, flags3: 0, shanFlags: 0, framesPer: 36, sets: 1, animDelay: 0, skillVar: 0, fuel: 0, jumpPace: 1, ai: 1 }, o);
const ship = (c, o = {}) => Object.assign({ slot: 1, cls: c, govt: -1, ai: 1, leader: -1, follows: -1, x: 0, y: 0, vx: 0, vy: 0, speed: 0, heading: 0, want: 0,
  thrust: 0, desired: 0, timer: 0, jump: 0, jumpStart: 0, skill: 1, state: 0, mode: 0, sec: -1, primary: -1, goal: -2, gate: -1, glow: 32, bank: 0, bankDir: 0, set: 0, animAcc: 0 }, o);
const world = (stellars = []) => {
  const st = new Map(stellars.map(sp => [sp.id, sp]));
  const w = { D: { govts: new Map(), jumpTicks: 364, u: { stellars: st }, widths: new Map() }, si: { nav: stellars.map(sp => sp.id) }, random: S.novaRandom(1), ships: new Array(64).fill(null), t: 0, gone: [] };
  w.rand = n => w.random.rand(n); return w;
};
// a step of one ship: its AI, then HandleShip, as novaFlightStep runs them
const step = (w, s) => { S.novaAI(w, s); if (w.ships[s.slot] === s || !w.ships[s.slot]) S.novaHandleShip(w, s); w.t++; };
{
  // Maneuver 30, 3 degrees a step: 0 to 90 in 30 steps, the last a snap; 10 to 350 the short way, left.
  const w = world(), s = ship(cls(), { want: 90 });
  const hs = [];
  for (let i = 0; i < 31; i++) { S.novaHandleShip(w, s); hs.push(s.heading); }
  eq('turning right', [hs[0], hs[28], hs[29], hs[30]], [3, 87, 90, 90]);
  const t = ship(cls(), { heading: 10, want: 350 });
  for (let i = 0; i < 7; i++) S.novaHandleShip(w, t);
  eq('turning left through 0', [t.heading], [350]);
}
{
  // Thrust 0.1 a step (Accel 500, doubled for a ship not the player's) facing right toward Speed 300:
  // short of 3 for 29 steps, then one step over at most, and no more.
  const w = world(), c = cls(), s = ship(c, { heading: 90, want: 90 });
  const rate = S.novaShipAccel(w.D, s);
  near('thrust doubled', rate, 0.1, 1e-6);
  for (let i = 0; i < 60; i++) { s.thrust = rate; s.desired = 0; S.novaHandleShip(w, s); }
  if (!(s.vx >= 3 && s.vx < 3.1)) fail(`thrust to top speed: vx ${s.vx}, expected 3 to 3.1`);
  near('no thrust across', s.vy, 0, 1e-4);
  // Then turned up: the second axis is taken to its own share, the first kept, and the ship runs past its top speed.
  s.heading = 0; s.want = 0;
  for (let i = 0; i < 60; i++) { s.thrust = rate; s.desired = 0; S.novaHandleShip(w, s); }
  if (!(Math.hypot(s.vx, s.vy) > 4)) fail(`the program's drift past top speed: ${Math.hypot(s.vx, s.vy)}`);
  // An inertialess ship (Flags2 0x0040) at speed 2 facing right: its velocity steered there 0.4 a step on each axis.
  const q = ship(cls({ flags2: 0x0040 }), { heading: 90, want: 90, speed: 2, vy: 1 });
  S.novaHandleShip(w, q);
  eq('inertialess, one step', [Math.round(q.vx * 1000) / 1000, Math.round(q.vy * 1000) / 1000], [0.4, 0.6]);
  for (let i = 0; i < 10; i++) S.novaHandleShip(w, q);
  eq('inertialess, steered', [Math.round(q.vx * 1000) / 1000, Math.round(q.vy * 1000) / 1000], [2, 0]);
}
{
  // An arrival: desired speed -50, less 1.165 a step, the velocity |desired| along the heading, until it is
  // the top speed (3): 41 steps, the last moving it 50 - 40 x 1.165 = 3.4; the ship then coasts at that.
  const w = world(), s = ship(cls(), { heading: 180, state: 8, jump: -1000 });
  w.ships[1] = s;
  let steps = 0, y = 0, speeds = [];
  for (let k = 1; k <= 41; k++) speeds.push(50 - 1.165 * (k - 1));
  while (s.state === 8 && steps < 100) { step(w, s); steps++; }
  eq('arrival steps', steps, 41);
  for (let k = 0; k < 40; k++) y += speeds[k];
  near('arrival distance', s.y, y, 0.05);
  near('arrival leaves it at', Math.hypot(s.vx, s.vy), speeds[40], 1e-4);
  if (!(s.timer >= 30 && s.timer < 60)) fail(`after arriving, a coast of 30 to 59 steps: ${s.timer}`);
}

{
  // A trader making for a stellar 2,000 to its right: turned, thrust to top speed, a quarter of it within 500,
  // braking at 0.98 a step within (9 - 3) x 8 + 32 = 80, stopped, and waiting 300 to 499 steps, the stellar its last visit.
  const sp = { id: 128, xPos: 2000, yPos: 0, Flags: 1, Flags2: 0, Govt: -1, Type: 0 };
  const w = world([sp]), s = ship(cls(), { state: 1, sec: 128, heading: 0 });
  w.ships[1] = s;
  let n = 0, top = 0;
  while (!(s.state === 0 && s.timer > 0) && n < 3000) { step(w, s); n++; top = Math.max(top, Math.hypot(s.vx, s.vy)); }
  if (!(Math.abs(s.x - 2000) <= 80 && Math.abs(s.y) <= 80 && s.vx === 0 && s.vy === 0)) fail(`stellar arrival: stopped at ${s.x}, ${s.y} moving ${s.vx}, ${s.vy}`);
  if (!(s.timer >= 299 && s.timer < 499) || s.goal !== 128) fail(`stellar arrival: timer ${s.timer}, last visit ${s.goal}`);
  near('stellar arrival, top speed', top, 3, 0.11);
  // Leaving, 3,000 out and still: the jump straight out, gone 364 sixtieths after it began, on the 183rd step; the run-up
  // starts when (elapsed x pace / 3.64) passes 35 and moves it up to 50 a step.
  const v = ship(cls({ fuel: 400 }), { x: 0, y: -3000, state: 2, heading: 0, want: 0, slot: 2 });
  const w2 = world(); w2.ships[2] = v;
  let k = 0;
  const ys = [];
  while (w2.ships[2] && k < 1000) { step(w2, v); ys.push(v.y); k++; }
  eq('jump: steps to gone', k, 183);
  const p = e => Math.min(50, e / 3.64 - 35);
  let want = -3000;
  // moved each step after the first, the clock at 2, 4 ... 362; at 364 it is gone before it moves
  for (let e = 2; e <= 362; e += 2) if (p(e) > 0) want -= p(e);
  near('jump: distance run', ys[ys.length - 2], want, 2);
}

// ---- 3. a fleet in formation ------------------------------------------
{
  // Three ships (odd): the first escort one step behind and to the left, the second behind and to the right.
  const w = world(), c = cls({ width: 40 }), lead = ship(c, { slot: 1, x: 100, y: 100, heading: 0 });
  const a = ship(c, { slot: 2, follows: 1 }), b = ship(c, { slot: 3, follows: 1 });
  w.ships[1] = lead; w.ships[2] = a; w.ships[3] = b;
  S.novaFormation(w, lead, true);
  eq('formation, three ships', [a.x, a.y, b.x, b.y].map(Math.round), [76, 124, 124, 124]);
}

// ---- 4. odds -------------------------------------------------------------
// A draw against weights: chi-square over the categories, failing above the
// 0.1% point for their number.
const CHI = [0, 10.83, 13.82, 16.27, 18.47, 20.52, 22.46, 24.32, 26.12, 27.88, 29.59, 31.26, 32.91, 34.53, 36.12, 37.70];
function oddsHold(counts, weights) {
  const total = counts.reduce((a, b) => a + b, 0), wsum = weights.reduce((a, b) => a + b, 0);
  let chi = 0, k = 0;
  counts.forEach((n, i) => { if (weights[i] > 0) { const e = total * weights[i] / wsum; chi += (n - e) ** 2 / e; k++; } else if (n) chi = Infinity; });
  return chi <= CHI[Math.max(1, k - 1)];
}
if (haveRelease('1.1.1')) {
  const game = openRelease(S, '1.1.1', ROLES), u = S.novaUniverse(game), D = S.novaFlightData(u);
  const sol = u.systems.find(s => s.name === 'Sol'), rec = sol.rec;
  const w = { D, sys: sol, si: S.novaSysInfo(D, sol), state: {}, random: S.novaRandom(7), ships: [] };
  w.rand = n => w.random.rand(n); w.holds = () => true;
  const N = 200000, valid = i => rec.DudeTypes[i] >= 128 && D.dudes.has(rec.DudeTypes[i]);
  const counts = new Array(8).fill(0);
  for (let i = 0; i < N; i++) counts[S.novaPickDude(w)]++;
  const weights = rec.DudeTypes.map((_, i) => valid(i) ? rec.Probs[i] : 0);
  if (!oddsHold(counts, weights)) fail(`Sol's düdes drawn ${counts.join(' ')} against Probs ${weights.join(' ')}`);
  const dude = D.dudes.get(rec.DudeTypes[counts.indexOf(Math.max(...counts))]);
  const tc = new Array(16).fill(0);
  for (let i = 0; i < N; i++) tc[S.novaPickShipType(w, dude)]++;
  const tw = dude.ShipTypes.map((id, i) => D.classes.has(id) && !D.classes.get(id).missing ? dude.Probs[i] : 0);
  if (!oddsHold(tc, tw)) fail(`düde ${dude.id}'s ship types drawn ${tc.join(' ')} against Probs ${tw.join(' ')}`);
  // The control: the same draws, but every düde as likely, must be caught.
  const flat = new Array(8).fill(0), live = weights.map((x, i) => x > 0 ? i : -1).filter(i => i >= 0);
  for (let i = 0; i < N; i++) flat[live[w.rand(live.length)]]++;
  if (new Set(weights.filter(x => x > 0)).size > 1 && oddsHold(flat, weights)) fail('the odds test did not notice düdes drawn as if all were as likely');
  if (!fails) console.log(`odds: Sol's düdes ${counts.filter(Boolean).join('/')} of ${N} for Probs ${weights.filter(Boolean).join('/')}; düde ${dude.id}'s ships by its Probs`);
}

// ---- 4b. asteroids ---------------------------------------------------------
// Round a screen 800 x 600 at (1000, -500) in a system with asteroids: as many as it has, from the start and
// after a minute; every one within the screen and its margins (half + 128 out, a corner's 0.7 x 1.5 at most,
// and gone 32 past an edge beyond its width); and moving the screen, all of them gone and come in again round it.
if (haveRelease('1.1.1')) {
  const game = openRelease(S, '1.1.1', new Set(['data', 'graphics', 'ships', 'sounds'])), u = S.novaUniverse(game), D = S.novaFlightData(u);
  const sys = u.systems.find(x => x.rec.Asteroids >= 5 && x.rec.AstTypes), view = { x: 1000, y: -500, hw: 400, hh: 300 };
  const w = S.novaFlightWorld(D, sys, {}, 11, view), n = sys.rec.Asteroids;
  const live = () => w.roids.filter(a => a.active);
  const inside = v => live().every(a => Math.abs(a.x - v.x) <= 1.05 * (v.hw + 128) + 100 && Math.abs(a.y - v.y) <= 1.05 * (v.hw + 128) + 100);
  if (live().length !== n) fail(`asteroids on arriving in ${sys.name}: ${live().length}, it has ${n}`);
  for (let i = 0; i < 1800; i++) S.novaFlightStep(w);
  if (live().length !== n || !inside(view)) fail(`asteroids after a minute: ${live().length} of ${n}, ${JSON.stringify(live().map(a => [Math.round(a.x), Math.round(a.y)]))}`);
  w.view = { x: 20000, y: 20000, hw: 400, hh: 300 };
  const before = new Set(live());
  for (let i = 0; i < 60; i++) S.novaFlightStep(w);
  if (live().some(a => before.has(a) && Math.abs(a.x) < 5000) || !inside(w.view)) fail('asteroids did not follow the screen');
  if (!fails) console.log(`asteroids: ${sys.name}'s ${n} round the screen, after a minute and after it moved`);
}

// ---- 5. every release ----------------------------------------------------
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v, ROLES), u = S.novaUniverse(game), D = S.novaFlightData(u);
  const t = { ships: 0, dude: 0, person: 0, fleet: 0, gate: 0, jump: 0, jumped: 0, gated: 0, later: 0 }, over = [];
  for (const sys of u.systems) for (let seed = 1; seed <= 3; seed++) {
    let w;
    try { w = S.novaFlightWorld(D, sys, { bits: new Set() }, seed * 7919 + sys.id); }
    catch (e) { fail(`${v} ${sys.name} (${sys.id}), seed ${seed}: ${e.message}`); continue; }
    let singles = 0;
    for (const s of w.ships) if (s) {
      t.ships++;
      if (s.dude) { t.dude++; singles++; } else if (s.pers) t.person++;
      else if (s.fleet && s.leader === -1) { t.fleet++; if (s.state === 0x15) t.gate++; else t.jump++; }
    }
    if (singles > sys.rec.AvgShips) over.push(sys.id);
    const before = new Set(w.ships.filter(Boolean));
    for (let i = 0; i < 900; i++) S.novaFlightStep(w);
    for (const g of w.gone) t[g.how === 'jump' ? 'jumped' : 'gated']++;
    t.later += w.ships.filter(x => x && !before.has(x)).length;
    for (const s of w.ships) if (s && ![s.x, s.y, s.vx, s.vy, s.heading].every(Number.isFinite)) { fail(`${v} ${sys.name}: ship ${s.slot} lost to ${[s.x, s.y, s.vx, s.vy, s.heading]}`); break; }
  }
  if (over.length) fail(`${v}: more düde ships than AvgShips in ${over.slice(0, 5).join(', ')}`);
  console.log(`${v}: ${u.systems.length} systems x 3 seeds: ${t.ships} ships, ${t.dude} of düdes, ${t.person} persons, ${t.fleet} fleets (${t.jump} by hyperspace, ${t.gate} out of a hypergate);` +
              ` in 30 seconds ${t.jumped} jumped out, ${t.gated} went into a gate, ${t.later} come since and still here`);
}

process.exit(fails ? 1 : 0);
