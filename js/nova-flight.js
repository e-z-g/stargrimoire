/* nova-flight.js -- ships in flight in the system you are in: who is there
   when you arrive, and how each one moves.
   =========================================================================

   Read from Mac 1.1.1's program, whose Intel half keeps its function names
   (an address below is in that half), with evnova-decomp's reconstruction
   of the Community Edition read beside it to find the way; where the two
   differ the program is kept, and ../evnova-workbench/doc/findings.md
   § *Ships in flight* says where.

   THE WORLD. A system's own units, x to the right and y down, as its
   stellars' xPos and yPos are; headings in degrees, 0 up and clockwise;
   numbers in single precision, as the program keeps them. The program
   moves everything by gSpeedMult, a running mean of the frame's length in
   30ths of a second (HandleTimeAdjustment 0x33332); here a step is always
   one 30th. It has 64 ship slots, the first the player's; the map has no
   player, so that slot stays empty and nothing that needs a player is here
   (escorts, mission ships, bounty hunters, what a ship does because of
   what the player did).

   WHO IS THERE when you arrive (SetupShipsInSystem 0x42b61): AvgShips
   times -- exactly, not the Bible's give or take half -- one in seven a
   person (SpawnPerson 0x408d5), else one in seven a fleet (SpawnFleet
   0x42704), else one of the system's düdes (RandomShipSpawn 0x3c0f3); then
   each of its eight persons by its PersonProb. A düde's ship is put at
   random within 750 of the middle, a warship that cannot move beside the
   first navigation default, facing anywhere, and set off at its class's
   top speed. A fleet arrives: by hyperspace, from about 2,100 units out at
   50 a step, slowing by 1.165 a step to its top speed, its escorts in
   formation (HyperSpawnFleet 0x41c8d); or out of a hypergate, after two
   seconds in it with the gate open, at 30 a step slowing by the same.

   HOW THEY MOVE (HandleShip 0x33581): position by velocity; turning toward
   the heading wanted at the class's turn rate; thrust along the heading
   held to the top speed axis by axis (AdjustedAccel 0x2ae4b), or, for an
   inertialess ship, a speed it steers its velocity to (0x3349c); the
   arrival's slowing. The AI, which sets the heading wanted and the thrust,
   is not here yet but for arriving: a ship holds its heading and coasts.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js,
   nova-ncb.js and nova-universe.js. */

const f32 = Math.fround;

/* The program's random numbers (Rand 0xa4c76): Park and Miller's step,
   done in 16-bit halves and left 0x7fffffff low, and from it a number
   below n taken from the low word. Rand(0) reseeds from the clock in the
   program; here it gives 0 and leaves the seed. */
function novaRandom(seed) {
  let s = seed >>> 0;
  return {
    get seed() { return s; },
    rand(n) {
      if (n === 0) return 0;
      const lo = Math.imul(s & 0xffff, 16807) >>> 0;
      const t = ((lo >>> 16) + Math.imul(s >>> 16, 16807)) >>> 0;
      const c = ((((t << 1) >>> 0) >>> 16) + (((t & 0x7fff) << 16) >>> 0)) >>> 0;
      s = ((lo & 0xffff) + c - 0x7fffffff) >>> 0;
      let w = s & 0xffff;
      if (w === 0x8000) w = 0;
      return ((Math.imul((n << 16) >> 16, w) >>> 16) << 16) >> 16;
    },
  };
}

/* The trig tables (BuildTrigTable 0x25828): a sine and a cosine for each
   whole degree, and arctangents of a ratio in hundredths, truncated to
   whole degrees. */
const NOVA_SIN = new Float32Array(360);
const NOVA_COS = new Float32Array(360);
const NOVA_ATAN = new Int16Array(1024);
for (let i = 0; i < 360; i++) { const a = f32(f32(i) * 0.01745329); NOVA_SIN[i] = Math.sin(a); NOVA_COS[i] = Math.cos(a); }
for (let i = 0; i < 1024; i++) NOVA_ATAN[i] = Math.trunc(Math.atan(i * 0.01) * 57.2957795);
const novaDeg = h => ((h % 360) + 360) % 360;

// Accel 0x2ade6: a speed along a heading added to a velocity.
function novaAccel(h, s, v) {
  h = novaDeg(h);
  v.x = f32(v.x + f32(s * NOVA_SIN[h]));
  v.y = f32(v.y - f32(s * NOVA_COS[h]));
}
/* AdjustedAccel 0x2ae4b: a step of thrust along a heading, each axis taken
   only while it is short of the cap's share on that axis, so that a ship
   turning at full thrust can run a little over its top speed. */
function novaAdjustedAccel(h, step, cap, v) {
  const m = { x: 0, y: 0 }, d = { x: 0, y: 0 };
  novaAccel(h, cap, m); novaAccel(h, step, d);
  for (const k of ['x', 'y']) {
    if (d[k] > 0 && m[k] > 0) { if (m[k] > v[k]) v[k] = f32(v[k] + d[k]); }
    else if (d[k] < 0 && m[k] < 0) { if (v[k] > m[k]) v[k] = f32(v[k] + d[k]); }
    else v[k] = f32(v[k] + d[k]);
  }
}
/* TableArcTan 0x259a0, as CalcInterceptAngle 0x2af60 asks it: the heading
   from b to a, in whole degrees. */
function novaHeadingFrom(ax, ay, bx, by) {
  const dx = f32(ax - bx), dy = f32(ay - by);
  if (dx === 0 && dy === 0) return 0;
  const x = Math.abs(dx), y = Math.abs(dy);
  const r = f32(y > x ? x / y : y / x);
  let a = NOVA_ATAN[Math.min(Math.max(Math.trunc(f32(r * 100)), 0), 1023)];
  if (y > x) a = 90 - a;
  if (dx < 0) { if (dy >= 0) a = 180 - a; if (dy < 0) a += 180; }
  else if (dy < 0) a = -a;
  let d = a - 90;
  if (d < 0) d = a + 270;
  if (d >= 360) d -= 360;
  return d;
}
// AngularDifference 0x649e: how far apart two whole headings are, 0 to 180.
function novaAngleApart(a, b) {
  let d = Math.abs(a - b);
  if ((a > 179) !== (b > 179)) d = 360 - d;
  if (d > 180) d = 360 - d;
  return d;
}

/* ---- the records, as the program holds them -------------------------- */

/* What the ships need from the game, once: each shïp with its shän, scaled
   as LoadObjectData (0x771b0) and LoadShipSprites (0x23e3e) keep them;
   the düdes, flëts, përs and gövts. Ids are the resources'. */
function novaFlightData(u) {
  const game = u.game, test = text => { try { return ncbParseTest(text || '').tree; } catch (e) { return { op: 'true' }; } };
  const classes = new Map();
  for (const s of novaAll(game, 'shïp')) {
    const shan = novaGet(game, 'shän', s.id) || {};
    classes.set(s.id, {
      id: s.id, name: novaNameParts(s.name).name, rec: s,
      accel: f32(s.Accel / 10000), speed: f32(s.Speed / 100), turn: f32(s.Maneuver * 0.1),
      holds: s.Holds, fuel: s.Fuel, shield: s.Shield, armor: s.Armor, ai: s.InherentAI,
      flags: s.Flags, flags2: s.Flags2, skillVar: s.SkillVar, missing: s.TechLevel === -9999,
      appearOn: test(s.AppearOn),
      sprite: shan.BaseImageID, width: shan.BaseXSize || 0, framesPer: shan.FramesPer || 36,
      sets: Math.max(1, shan.BaseSetCount || 1), animDelay: shan.AnimDelay || 0, shanFlags: shan.Flags || 0,
    });
  }
  const dudes = new Map(novaAll(game, 'düde').map(d => [d.id, d]));
  const fleets = new Map(novaAll(game, 'flët').map(f => [f.id, Object.assign(f, { activateOn: test(f.ActivateOn) })]));
  const persons = new Map(novaAll(game, 'përs').map(p => [p.id, Object.assign(p, { activateOn: test(p.ActivateOn) })]));
  const govts = new Map([...u.govts.values()].map(g => [g.id, { id: g.id, flags: g.Flags, flags2: g.Flags2,
    classes: g.Classes, allies: g.Allies, enemies: g.Enemies, skill: g.SkillMult > 0 ? f32(g.SkillMult * 0.01) : 1 }]));
  return { u, classes, dudes, fleets, persons, govts };
}

const novaGovtOk = id => id >= 128 && id <= 383;
const novaDerelict = (D, id) => { const g = D.govts.get(id); return !!g && !!(g.flags & 0x0800); };
/* GovtAllies 0x4e3d: the same government, or one whose class is among the
   other's allies, and neither derelict. */
function novaGovtAllies(D, a, b) {
  if (a === b) return true;
  const A = novaGovtOk(a) && D.govts.get(a), B = novaGovtOk(b) && D.govts.get(b);
  if (!A || !B || (A.flags & 0x0800) || (B.flags & 0x0800)) return false;
  const meets = (cls, list) => cls >= 0 && list.some(x => x >= 0 && x === cls);
  for (let i = 0; i < 4; i++) if (meets(A.classes[i], B.allies) || meets(B.classes[i], A.allies)) return true;
  return false;
}
/* GovtEnemies 0x4f22: one's class among the other's enemies, neither
   derelict; else, unless allies, either xenophobic (Flags 0x0001). */
function novaGovtEnemies(D, a, b) {
  if (a === b) return false;
  const A = novaGovtOk(a) && D.govts.get(a), B = novaGovtOk(b) && D.govts.get(b);
  if (A && B) {
    if ((A.flags & 0x0800) || (B.flags & 0x0800)) return false;
    const meets = (cls, list) => cls >= 0 && list.some(x => x >= 0 && x === cls);
    for (let i = 0; i < 4; i++) if (meets(A.classes[i], B.enemies) || meets(B.classes[i], A.enemies)) return true;
  }
  if (novaGovtAllies(D, a, b)) return false;
  return !!(A && (A.flags & 0x0001)) || !!(B && (B.flags & 0x0001));
}

/* Whether a flët or përs may come to a system by its LinkSyst (SpawnFleet
   0x42704, SpawnPerson 0x408d5): -1 anywhere; the system; 10000 + n the
   systems of government 128 + n, 15000 + n those of its allies, 20000 + n
   all but its, 25000 + n those of its enemies. The program holds
   governments as 0 to 255 and compares n with that. A përs's government
   window starts at 9999, a flët's at 10000, so 9999 takes a përs to the
   independent systems; and a LinkSyst below 128 equal to the system's id
   less 128 takes either there. */
function novaLinkSystOk(D, link, sys, isPerson) {
  const g = novaGovtOk(sys.govt) ? sys.govt - 128 : -1;
  if (link === -1 || link === sys.id - 128 || link === sys.id) return true;
  if (link >= (isPerson ? 9999 : 10000) && link <= 14999 && link - 10000 === g) return true;
  if (link >= 15000 && link <= 19999 && g >= 0 && novaGovtAllies(D, link - 15000 + 128, g + 128)) return true;
  if (link >= 20000 && link <= 24999 && g >= 0 && link - 20000 !== g) return true;
  if (link >= 25000 && link <= 29999 && g >= 0 && novaGovtEnemies(D, link - 25000 + 128, g + 128)) return true;
  return false;
}

/* ---- a ship's rates ----------------------------------------------------- */

// ShipAccelRate 0x353b, ShipMaxSpeed 0x36f2, ShipTurnRate 0x32f7, for a ship not the player's.
function novaShipAccel(D, ship) {
  const c = ship.cls;
  if (c.flags & 0x0400) return 0;
  const g = D.govts.get(ship.govt);
  let a = f32(c.accel * ship.skill);
  if (g) a = f32(a * g.skill);
  return Math.max(0, f32(a + a));
}
function novaShipMaxSpeed(D, ship) {
  const c = ship.cls;
  if (c.flags & 0x0400) return 0;
  const g = D.govts.get(ship.govt);
  let s = f32(c.speed * ship.skill);
  if (g) s = f32(s * g.skill);
  return Math.max(0, s);
}
function novaShipTurn(ship) {
  const t = ship.cls.turn;
  return Math.max(0, ship.cls.turn >= 1 ? Math.max(1, t) : t);
}
const novaInertialess = ship => !!(ship.cls.flags2 & 0x0040);

/* ---- who is there ------------------------------------------------------- */

/* A system's world after you arrive: { D, sys, state, random, ships, t }.
   `state` is the control bits the map holds (nova-ncb.js); `seed` starts
   the random numbers, so the same seed gives the same ships. */
function novaFlightWorld(D, sys, state, seed) {
  const w = { D, sys, state: state || {}, random: novaRandom(seed), ships: new Array(64).fill(null), t: 0 };
  w.rand = n => w.random.rand(n);
  w.holds = tree => { try { return ncbEval(tree, w.state); } catch (e) { return true; } };
  novaSetupShips(w);
  return w;
}

// An empty ship in a slot, keeping the heading its last ship left there (a person's is never set).
function novaFreshShip(w, slot) {
  const old = w.ships[slot];
  return { slot, cls: null, dude: null, pers: null, fleet: null, govt: -1, ai: 1, leader: -1, follows: -1,
           x: 0, y: 0, vx: 0, vy: 0, speed: 0, heading: old ? old.heading : 0, want: 0,
           thrust: 0, desired: 0, timer: 0, jump: 0, skill: 1, state: 0, mode: 0, gate: -1,
           glow: 32, bank: 0, bankDir: 0, set: 0, animAcc: 0 };
}
function novaFreeSlot(w, reserve) {
  for (let i = 1; i < 64 - reserve; i++) if (!w.ships[i]) return i;
  return -1;
}
// RandomSkillLevel 0x6922: (100 - SkillVar ... 100 + SkillVar) / 100.
function novaSkill(w, cls) { const v = cls ? cls.skillVar : 0; return f32((w.rand(2 * v + 1) - v + 100) * 0.01); }
// The set a ship's animation starts on, and how far into its first step.
function novaSpriteDraws(w, s, cls) {
  if (cls.sets > 0) s.set = w.rand(cls.sets);
  if (cls.animDelay > 0) s.animAcc = w.rand(cls.animDelay);
}

// SelectDudeFieldFromSystem 0x674d: one of a system's eight düdes, by Probs.
function novaPickDude(w, rec) {
  const ok = i => rec.DudeTypes[i] >= 128 && rec.DudeTypes[i] <= 639 && w.D.dudes.has(rec.DudeTypes[i]);
  let total = 0;
  const cum = rec.DudeTypes.map((_, i) => { if (!ok(i)) return 0; total += rec.Probs[i]; let s = 0; for (let j = 0; j <= i; j++) if (ok(j)) s += rec.Probs[j]; return s; });
  if (total <= 0) return -1;
  for (;;) { const r = w.rand(total) + 1; for (let i = 0; i < 8; i++) if (ok(i) && r <= cum[i]) return i; }
}
/* SelectShipFieldFromDude 0x65c2: one of a düde's sixteen ship types, by
   Probs, among those whose AppearOn holds. */
function novaPickShipType(w, dude) {
  const ok = i => { const c = w.D.classes.get(dude.ShipTypes[i]); return !!c && !c.missing && w.holds(c.appearOn); };
  let total = 0, n = 0;
  const cum = dude.ShipTypes.map((_, i) => { if (!ok(i)) return 0; total += dude.Probs[i]; n++; let s = 0; for (let j = 0; j <= i; j++) if (ok(j)) s += dude.Probs[j]; return s; });
  if (total <= 0 || n === 0) return -1;
  for (;;) { const r = w.rand(total) + 1; for (let i = 0; i < 16; i++) if (ok(i) && r <= cum[i]) return i; }
}

// RandomShipSpawn 0x3c0f3: a ship of one of the system's düdes.
function novaSpawnDudeShip(w) {
  const rec = w.sys.rec;
  for (let slot = 1; slot < 64 - 8; slot++) {
    if (w.ships[slot]) continue;
    const f = novaPickDude(w, rec);
    if (f < 0) continue;
    const dude = w.D.dudes.get(rec.DudeTypes[f]), t = novaPickShipType(w, dude);
    if (t < 0) return -1;
    const s = novaFreshShip(w, slot), cls = w.D.classes.get(dude.ShipTypes[t]);
    Object.assign(s, { cls, dude: dude.id, govt: dude.Govt, ai: dude.AIType > 0 ? dude.AIType : cls.ai });
    const n0 = (rec.Nav || [])[0], spob = n0 >= 128 ? w.D.u.stellars.get(n0) : null;
    if (s.ai === 3 && spob && cls.speed === 0) {
      s.x = spob.xPos; s.y = spob.yPos;
      const v = { x: s.x, y: s.y }; novaAccel(w.rand(360), 100, v); s.x = v.x; s.y = v.y;
    } else { s.x = w.rand(1500) - 750; s.y = w.rand(1500) - 750; }
    s.heading = w.rand(360);
    s.skill = novaSkill(w, cls);
    w.rand(3);
    if (novaDerelict(w.D, s.govt)) s.glow = 0;
    w.rand(2);
    novaSpriteDraws(w, s, cls);
    w.ships[slot] = s;
    return slot;
  }
  return -1;
}

/* GenericRandomShipSpawn 0x3c89f: a ship of no kind yet, at random within
   750 of the middle. Its skill is drawn for the first class, whatever it
   becomes, as the program does. */
function novaSpawnBlank(w) {
  const slot = novaFreeSlot(w, 8);
  if (slot < 0) return null;
  const s = novaFreshShip(w, slot), first = w.D.classes.values().next().value;
  s.skill = novaSkill(w, first);
  w.rand(3);
  if (first) novaSpriteDraws(w, s, first);
  s.x = w.rand(1500) - 750; s.y = w.rand(1500) - 750;
  w.ships[slot] = s;
  return s;
}

/* SpawnPerson 0x408d5: a përs, `forced` or one at random among those whose
   LinkSyst takes them here and whose ActivateOn holds; never one whose
   name a person in the system already has. */
function novaSpawnPerson(w, forced) {
  const D = w.D, ok = new Set();
  if (forced) ok.add(forced);
  else for (const p of D.persons.values())
    if (p.id <= 1150 && p.AIType > 0 && D.classes.has(p.ShipType) && novaLinkSystOk(D, p.LinkSyst, w.sys, true) && w.holds(p.activateOn)) ok.add(p.id);
  for (const s of w.ships) if (s && s.pers) for (const id of [...ok]) if (D.persons.get(id).name === D.persons.get(s.pers).name) ok.delete(id);
  if (!ok.size) return null;
  const id = forced || 128 + w.rand(0x3fe);
  if (!ok.has(id)) return null;
  const p = D.persons.get(id), cls = D.classes.get(p.ShipType);
  if (!cls) return null;
  const s = novaSpawnBlank(w);
  if (!s) return null;
  Object.assign(s, { cls, pers: id, govt: p.Govt, ai: p.AIType });
  if (novaDerelict(D, s.govt)) { s.vx = s.vy = s.speed = 0; s.heading = w.rand(360); s.glow = 0; }
  return s;
}

// SpawnFleet 0x42704: one of the 256 flët slots drawn at random, if it may come here.
function novaSpawnFleet(w) {
  const D = w.D, ok = new Set();
  for (const f of D.fleets.values())
    if (f.id < 384 && D.classes.has(f.LeadShipType) && w.holds(f.activateOn) && novaLinkSystOk(D, f.LinkSyst, w.sys, false)) ok.add(f.id);
  if (!ok.size) return;
  const id = 128 + w.rand(0x100);
  if (ok.has(id)) novaHyperSpawnFleet(w, D.fleets.get(id));
}

/* SelectRandomStellarDest 0x805de as PickEmergeStellar 0x7f9a asks it: a
   stellar a fleet's government would leave by. A hypergate it may emerge
   from; anything else, and it jumps in. Only stellars that can be landed
   on and lie within 999 of the middle to the right and down count, as the
   program tests. */
function novaPickEmerge(w, govt) {
  const D = w.D, u = D.u, g = D.govts.get(govt), gf = g ? g.flags2 : 0;
  const noGates = !!(gf & 0x20), likesGates = !!(gf & 0x40), likesHoles = !!(gf & 0x80);
  const planets = w.rand(3) === 0;
  const nav = (w.sys.rec.Nav || []).slice(0, 16);
  const info = nav.map(id => {
    const sp = id >= 128 && u.stellars.get(id);
    if (!sp) return null;
    const near = novaCanLand(sp) && sp.xPos <= 999 && sp.yPos <= 999;
    const empty = !!(sp.Flags & 0x20) && !(sp.Flags2 & 0x3000);
    const foe = govt !== -1 && sp.Govt !== -1 && novaGovtEnemies(D, govt, sp.Govt);
    return { id, near, empty, foe, gate: !!(sp.Flags2 & 0x1000), hole: !!(sp.Flags2 & 0x2000) };
  });
  let gates = 0, holes = 0, places = 0, plain = 0;
  for (const s of info) {
    if (!s) continue;
    if (s.gate && s.near && !s.foe) gates++;
    if (!s.near) continue;
    if (s.hole && !s.foe) holes++;
    if (s.empty || s.foe) continue;
    places++;
    if (!s.gate && !s.hole) plain++;
  }
  // drawn until one fits, as the program does; the counts say one does
  const draw = pred => { for (let n = 0; n < 1e5; n++) { const s = info[w.rand(16)]; if (s && s.near && pred(s)) return s; } return null; };
  let pick = null;
  if (holes > 0 && likesHoles) pick = draw(s => s.hole && !s.foe);
  else if (gates > 0 && likesGates) pick = draw(s => s.gate && !s.foe);
  else if (places > 0 && planets && !noGates && (plain > 0 || gates > 0)) pick = draw(s => !s.empty && !s.foe && !s.hole);
  else if (places > 0 && (plain > 0 || (gates > 0 && !noGates))) pick = draw(s => !s.empty && !s.foe && !(s.hole && !likesHoles) && !(s.gate && noGates));
  if (!pick) return null;
  return pick.gate || pick.hole ? u.stellars.get(pick.id) : null;
}

/* AIMakeShipEmergeFromHyperGate 0x89518: in the gate for two seconds,
   facing CustSndID if that is a heading (the Bible's spöb section) and
   anywhere else, then out at 30 a step. */
function novaEmergeFrom(w, s, gate) {
  Object.assign(s, { state: 0x15, mode: 0, gate: gate.id, timer: 60, jump: -1, thrust: -3, desired: s.leader === 0 ? -15 : -30 });
  const h = gate.CustSndID & 0xffff;
  s.heading = h <= 359 ? h : w.rand(360);
}
// AIMakeShipJumpIn 0x82ebb.
function novaJumpIn(w, s) { Object.assign(s, { state: 8, jump: -1000 }); s.bank = -w.rand(10); }

// The distance an arrival covers slowing from 50 by 1.165 a step, and 1,000 more (HyperSpawnFleet 0x41f7f).
const NOVA_ARRIVAL_R = (() => { let r = 0, ramp = 50; for (let i = 0; i < 43; i++) { r = f32(r + ramp); ramp = f32(ramp - 1.165); } return f32(r + 1000); })();

// HyperSpawnFleet 0x41c8d: a flët's lead and escorts, arriving.
function novaHyperSpawnFleet(w, f) {
  const D = w.D, lc = D.classes.get(f.LeadShipType);
  const lead = novaSpawnBlank(w);
  if (!lead) return;
  Object.assign(lead, { cls: lc, fleet: f.id, govt: f.Govt, ai: lc.ai });
  if ((f.Flags & 1) && lc.ai <= 2) { w.rand(6); w.rand(lc.holds); }
  lead.vx = lead.vy = lead.speed = 0;
  const gate = novaPickEmerge(w, lead.govt);
  if (gate) { novaEmergeFrom(w, lead, gate); lead.x = gate.xPos; lead.y = gate.yPos; }
  else {
    novaJumpIn(w, lead);
    const p = { x: 0, y: 0 }; novaAccel(w.rand(360), NOVA_ARRIVAL_R, p);
    lead.x = p.x; lead.y = p.y;
    lead.heading = novaHeadingFrom(lead.x, lead.y, 0, 0);
    const v = { x: 0, y: 0 }; novaAccel(Math.trunc(lead.heading), 50, v); lead.vx = v.x; lead.vy = v.y;
  }
  for (let k = 0; k < 4; k++) {
    const n = w.rand(f.Max[k] - f.Min[k] + 1) + f.Min[k], cls = D.classes.get(f.EscortType[k]);
    if (!cls || cls.missing || !w.holds(cls.appearOn) || n <= 0) continue;
    for (let i = 0; i < n; i++) {
      const s = novaSpawnBlank(w);
      if (!s) continue;
      Object.assign(s, { cls, fleet: f.id, govt: f.Govt, ai: 6, leader: lead.slot, follows: lead.slot, heading: lead.heading });
      s.x = f32(lead.x + w.rand(300) - 150); s.y = f32(lead.y + w.rand(300) - 150);
      s.vx = lead.vx; s.vy = lead.vy; s.speed = lead.speed;
      if ((f.Flags & 1) && cls.ai <= 2) { w.rand(6); w.rand(cls.holds); }
      if (gate) {
        novaEmergeFrom(w, s, gate); s.x = gate.xPos; s.y = gate.yPos;
        s.heading = lead.heading; s.timer = f32(s.timer + w.rand(15) + 5);
      } else { s.jump = -1000; novaJumpIn(w, s); }
    }
  }
  novaFormation(w, lead, true);
}

/* AICalcFormationPositions 0x85040 and AICalcShipFormPos 0x84cb8: the
   places behind a fleet's lead its escorts keep, in rows a little wider
   than the widest of them (six tenths of its sprite, 24 to 60 units); on
   arriving (`snap`) each escort is put there, but one in a hypergate. */
const NOVA_FORM = [[0, 0], [-1, -1], [-1, 1], [-2, -2], [-2, 2], [-3, -1], [-3, 1], [-2, 0],
  [-3, -3], [-3, 3], [-4, 0], [-4, -2], [-4, 2], [-4, -4], [-4, 4], [-5, -1], [-5, 1], [-5, -3], [-5, 3], [-5, -5], [-5, 5]];
function novaFormation(w, lead, snap) {
  const width = (c, none) => c && c.width > 0 ? c.width : none;
  const escorts = w.ships.filter(s => s && s !== lead && s.follows === lead.slot);
  if (!escorts.length) return;
  let wide = width(lead.cls, 64);
  for (const s of escorts) wide = Math.max(wide, width(s.cls, 75));
  const step = Math.min(60, Math.max(24, Math.trunc(wide * 0.6))), n = escorts.length + 1;
  escorts.forEach((s, i) => {
    const k = i + 2;
    // the first eight places come in another order when the fleet is even
    const at = NOVA_FORM[(k <= 8 && !(n & 1) ? [0, 1, 2, 3, 8, 4, 5, 6, 7][k] : k) - 1] || [0, 0];
    const p = { x: 0, y: 0 }, h = Math.trunc(lead.heading);
    novaAccel(h, at[0] * step, p); novaAccel(Math.trunc(f32(lead.heading + 90)) % 360, at[1] * step, p);
    s.formX = f32(p.x + lead.x); s.formY = f32(p.y + lead.y);
    if (snap && s.state !== 0x15) { s.x = s.formX; s.y = s.formY; }
  });
}

/* SetupShipsInSystem 0x42b61, without the player's escorts and mission
   ships: the AvgShips draws, then the system's own persons. A ship drawn
   singly is set going at its class's top speed (AdjustedAccel from rest);
   a derelict's is stopped again. */
function novaSetupShips(w) {
  const D = w.D, rec = w.sys.rec;
  const setOff = s => {
    if (!s) return;
    const v = { x: s.vx, y: s.vy }; novaAdjustedAccel(Math.trunc(s.heading), s.cls.speed, s.cls.speed, v); s.vx = v.x; s.vy = v.y;
    if (novaDerelict(D, s.govt)) { s.speed = 0; s.vx = s.vy = 0; }
  };
  for (let i = 0; i < rec.AvgShips; i++) {
    if (w.rand(7) === 0) setOff(novaSpawnPerson(w, 0));
    else if (w.rand(7) === 0) novaSpawnFleet(w);
    else { const slot = novaSpawnDudeShip(w); if (slot >= 0) setOff(w.ships[slot]); }
  }
  for (let i = 0; i < 8; i++) {
    const id = rec.Person[i], p = id >= 128 && id <= 1150 && D.persons.get(id);
    if (!p || !w.holds(p.activateOn)) continue;
    if (w.rand(100) + 1 > rec.PersonProb[i]) continue;
    setOff(novaSpawnPerson(w, id));
  }
}

/* ---- how they move ------------------------------------------------------ */

/* One 30th of a second: for each ship the part of the AI that arrivals
   need (AIDispatch 0x8fb52, HighLevelAIHandler 0x8d453, LowLevelAIHandler
   0x851da), then HandleShip. */
function novaFlightStep(w) {
  for (const s of w.ships) if (s) novaArriving(w, s);
  for (const s of w.ships) if (s) novaHandleShip(w, s);
  w.t++;
}

function novaArriving(w, s) {
  if (s.jump < -900) { s.state = 8; s.mode = 10; }
  else if (s.mode !== 4 && s.mode !== 13 && s.state === 8) s.state = 0;
  if (s.state === 0x15) { s.mode = 0; if (s.timer <= 0) { s.timer = -1; s.state = 8; s.gate = -1; } }
  if (s.state === 8) { s.jump = -1000; s.mode = 10; }
  s.thrust = 0;
  if (s.desired >= 0) s.desired = novaShipMaxSpeed(w.D, s);
  s.want = Math.trunc(s.heading);
  if (s.mode === 10) { if (s.desired >= 0) s.desired = -50; s.thrust = f32(-1.165); }
}

// HandleShip 0x33581, for a ship nothing has hit.
function novaHandleShip(w, s) {
  const D = w.D, c = s.cls;
  if (c.accel === 0 && c.speed === 0) s.vx = s.vy = 0;
  else {
    if (novaInertialess(s)) novaSteerInertialess(D, s);
    s.x = f32(s.x + s.vx); s.y = f32(s.y + s.vy);
  }
  let dir = 0;
  if (s.timer <= 0) {
    let diff = f32(s.want - s.heading);
    if (diff >= 360) diff = f32(diff - 360);
    if (diff < 0) diff = f32(diff + 360);
    const rate = novaShipTurn(s);
    if (novaAngleApart(s.want, Math.trunc(s.heading)) > rate) {
      if (diff > 180) { s.heading = f32(s.heading - rate); dir = -1; } else { s.heading = f32(s.heading + rate); dir = 1; }
    } else s.heading = s.want;
  }
  if (s.heading >= 360) s.heading = f32(s.heading - 360);
  if (s.heading < 0) s.heading = f32(s.heading + 360);
  if (s.timer <= 0 || c.id === 895) {
    if (s.thrust !== 0) novaThrust(D, w, s);
    if (c.shanFlags & 1) {
      if (dir === 1) { if (s.bank < 8) s.bank = f32(s.bank + 1); }
      else if (dir === -1) { if (s.bank > -8) s.bank = f32(s.bank - 1); }
      else if (s.bank >= 1) s.bank = f32(s.bank - 1);
      else if (s.bank <= -1) s.bank = f32(s.bank + 1);
      else s.bank = 0;
      s.bankDir = s.bank > 4 ? 1 : s.bank < -4 ? -1 : 0;
      if (s.bankDir && (c.shanFlags & 2) && s.glow <= 23) s.glow += 2;
    }
    if (s.thrust > 0) {
      if (c.shanFlags & 1) s.bankDir = dir;
      if (s.thrust >= f32(2 * novaShipAccel(D, s))) { if (s.glow <= 31) s.glow++; }
      else if (s.glow <= 23) s.glow++;
      else if (s.glow > 24) s.glow--;
    } else if (s.glow > 0) s.glow--;
  }
  if (s.timer > 0 && c.id !== 895) {
    s.timer = f32(s.timer - 1);
    if (s.glow > 0) s.glow--;
  }
}

// AdjustInertialessShipVelocity 0x3349c: the velocity steered toward the speed along the heading, four times the thrust a step on each axis.
function novaSteerInertialess(D, s) {
  const was = { x: s.vx, y: s.vy }, v = { x: 0, y: 0 };
  novaAccel(Math.trunc(s.heading), s.speed, v);
  const step = f32(f32(novaShipAccel(D, s) * 4));
  const toward = (now, old) => f32(now - step) >= old ? f32(old + step) : old >= f32(step + now) ? f32(old - step) : now;
  s.vx = toward(v.x, was.x); s.vy = toward(v.y, was.y);
}

/* The thrust block of HandleShip: toward the top speed, toward a speed
   wanted, or, with a negative speed wanted, that speed along the heading,
   wanted less by the thrust each step until it is the top speed -- the
   arrival -- when the ship stops arriving and coasts for one to two
   seconds unless it follows a lead. */
function novaThrust(D, w, s) {
  const h = Math.trunc(s.heading), step = s.thrust, inert = novaInertialess(s);
  if (s.desired === 0 || s.desired > 0) {
    if (s.desired === 0 && s.jump > 0) return;
    const cap = s.desired === 0 ? novaShipMaxSpeed(D, s) : s.desired;
    if (inert) s.speed = Math.max(0, Math.min(cap, f32(s.speed + step)));
    else { const v = { x: s.vx, y: s.vy }; novaAdjustedAccel(h, step, cap, v); s.vx = v.x; s.vy = v.y; }
    return;
  }
  if (inert) s.speed = Math.abs(s.desired);
  else { const v = { x: 0, y: 0 }; novaAccel(h, Math.abs(s.desired), v); s.vx = v.x; s.vy = v.y; }
  s.desired = f32(s.desired + Math.abs(s.thrust));
  const lead = s.leader >= 0 && s.leader <= 63 ? w.ships[s.leader] : null;
  let m = novaShipMaxSpeed(D, s);
  if (lead) m = Math.min(m, novaShipMaxSpeed(D, lead));
  m = Math.max(m, -1);
  if (s.desired >= -m || s.desired >= 0) {
    if (s.state !== 9 && s.state !== 15) { s.state = 0; s.mode = 0; }
    s.jump = 0; s.thrust = 0; s.desired = 0;
    if (inert) { s.vx = s.vy = 0; s.desired = m; }
    if (s.leader === -1) s.timer = w.rand(30) + 30;
  }
}

/* The hypergates a ship is emerging from (HandleStellarSprites 0x2e6f1),
   which open as for a ship near; ships bound for one come with travel. */
function novaFlightEngaged(w) {
  const out = new Set();
  for (const s of w.ships) if (s && s.state === 0x15 && s.gate >= 128) out.add(s.gate);
  return out;
}

/* The sprite frame a ship shows (HandleShipDisplay 0x2b58f): its heading in
   FramesPer steps, in the set its shän's Flags say -- banking (0x01), the
   second set turning left and the third right; cycling every AnimDelay
   (0x08) -- and the first set otherwise. Called once a step. */
function novaShipFrame(s) {
  const c = s.cls;
  let set = 0;
  if (c.shanFlags & 0x01) set = s.bankDir > 0 ? 2 : s.bankDir < 0 ? 1 : 0;
  else if (c.shanFlags & 0x08) {
    s.animAcc = f32(s.animAcc + 1);
    if (s.animAcc > c.animDelay) {
      if (c.animDelay > 0) while (s.animAcc > c.animDelay) s.animAcc = f32(s.animAcc - c.animDelay); else s.animAcc = 0;
      s.set = s.set + 1 >= c.sets ? 0 : s.set + 1;
    }
    set = s.set;
  }
  if (set >= c.sets) set = 0;
  return set * c.framesPer + Math.trunc(f32(s.heading * f32(c.framesPer / 360)));
}
