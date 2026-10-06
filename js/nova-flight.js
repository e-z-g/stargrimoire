/* nova-flight.js -- ships in flight in the system you are in: who is there,
   who comes, where each goes, and how it moves.
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
   one 30th, and its clock in 60ths (TickCount) two a step. It has 64 ship
   slots, the first the player's; the map has no player, so that slot stays
   empty and nothing that needs a player is here (escorts, mission ships,
   bounty hunters, what a ship does because of what the player did).

   WHO IS THERE when you arrive (SetupShipsInSystem 0x42b61): AvgShips
   times -- exactly, not the Bible's give or take half -- one in seven a
   person (SpawnPerson 0x408d5), else one in seven a fleet (SpawnFleet
   0x42704), else one of the system's düdes (RandomShipSpawn 0x3c0f3); then
   each of its eight persons by its PersonProb. A düde's ship is put at
   random within 750 of the middle, facing anywhere, and set off at its
   class's top speed. A fleet arrives: by hyperspace, from about 2,100
   units out at 50 a step, slowing by 1.165 a step to its top speed, its
   escorts in formation (HyperSpawnFleet 0x41c8d); or out of a hypergate.
   WHO COMES after (EnterMoreShips 0x43459): while there are fewer than
   AvgShips, each step a chance in 250 of a ship arriving (HyperShipSpawn
   0x4291a) and one in 500 of one of the system's own fleets.

   WHERE EACH GOES (AIDispatch 0x8fb52 and the supervisors it calls, then
   HighLevelAIHandler 0x8d453 and LowLevelAIHandler 0x851da): a trader
   flies to a stellar it may land on, stops beside it for ten to sixteen
   seconds, then leaves; leaving is braking, getting 1,000 out from the
   middle if nearer, and jumping straight out from the middle through where
   it is. A warship wanders from stellar to stellar and an interceptor
   between stellars and the ships it goes to look at; an escort follows its
   lead and jumps when it jumps. A stellar that is a hypergate is gone into.
   Nothing here fights: the targets, attacks and the rest are stage 4.

   HOW THEY MOVE (HandleShip 0x33581): position by velocity; turning toward
   the heading wanted at the class's turn rate; thrust along the heading
   held to the top speed axis by axis (AdjustedAccel 0x2ae4b), or, for an
   inertialess ship, a speed it steers its velocity to (0x3349c); an
   arrival's slowing; a jump's run-up.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js,
   nova-ncb.js, nova-sprites.js and nova-universe.js. */

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
/* CalcInterceptAngle 0x2af60 through TableArcTan 0x259a0: the heading from
   p toward q, in whole degrees. */
function novaBearing(px, py, qx, qy) {
  const dx = f32(px - qx), dy = f32(py - qy);
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
// Whether a heading wanted is within `slack` degrees past the turn rate (the modes' test before thrusting).
const novaLinedUp = (s, slack) => novaAngleApart(s.want, Math.trunc(s.heading)) < f32(novaShipTurn(s) + slack);

/* ---- the records, as the program holds them -------------------------- */

/* What the ships need from the game, once: each shïp with its shän, scaled
   as LoadObjectData (0x771b0) and LoadShipSprites (0x23e3e) keep them; the
   düdes, flëts, përs, gövts and oütfs; and the warp sound's length. Ids are
   the resources'. */
/* The boarding strength a class's default outfits add (AIPlunderShipContents
   0x83fab): for each outfit of ModType 25, the ModVal not of that outfit
   but of the oütf whose number is 128 plus the outfit's place among the
   class's eight (the program reads the outfit table by the place): `pos`
   where that value is above 0, `neg` where the outfit's own is below 0. */
function novaBoardingMods(items, counts, outfits) {
  const out = { pos: 0, neg: 0 };
  for (let i = 0; i < 8; i++) {
    if (!(counts[i] > 0)) continue;
    const o = outfits.get(items[i]), b = outfits.get(128 + i);
    if (!o) continue;
    const t = [o.ModType, o.ModType2, o.ModType3, o.ModType4], v = [o.ModVal, o.ModVal2, o.ModVal3, o.ModVal4];
    const bv = b ? [b.ModVal, b.ModVal2, b.ModVal3, b.ModVal4] : [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) if (t[k] === 25) {
      if (bv[k] > 0) out.pos += counts[i] * bv[k];
      if (v[k] < 0) out.neg += counts[i] * bv[k];
    }
  }
  return out;
}
function novaFlightData(u) {
  const game = u.game, test = text => { try { return ncbParseTest(text || '').tree; } catch (e) { return { op: 'true' }; } };
  const outfits = new Map(novaAll(game, 'oütf').map(o => [o.id, o]));
  const modTypes = o => o ? [o.ModType, o.ModType2, o.ModType3, o.ModType4] : [];
  const classes = new Map();
  for (const s of novaAll(game, 'shïp')) {
    const shan = novaGet(game, 'shän', s.id) || {};
    const items = [...(s.DefaultItems || []), ...(s.DefaultItms2 || [])], counts = [...(s.ItemCount || []), ...(s.ItemCount2 || [])];
    classes.set(s.id, {
      id: s.id, name: novaNameParts(s.name).name, rec: s,
      accel: f32(s.Accel / 10000), speed: f32(s.Speed / 100), turn: f32(s.Maneuver * 0.1),
      holds: s.Holds, fuel: s.Fuel, shield: s.Shield, armor: s.Armor, ai: s.InherentAI,
      flags: s.Flags, flags2: s.Flags2, flags3: s.Flags3 || 0, skillVar: s.SkillVar, missing: s.TechLevel === -9999,
      // the loader's (0x7aa25): Deionize a hundredth a step, 1 when 0 or less; IonizeMax 0 when under 1
      deion: s.Deionize > 0 ? f32(s.Deionize * 0.01) : 1, ionMax: s.IonizeMax < 1 ? 0 : s.IonizeMax,
      appearOn: test(s.AppearOn),
      // the jump's pace (LoadObjectData 0x7ae9d): Flags 0x0001 slow, 0x0002 semi-fast, 0x0004 fast
      jumpPace: s.Flags & 1 ? f32(0.7) : s.Flags & 2 ? f32(1.3) : s.Flags & 4 ? f32(1.6) : 1,
      // ShipCanExpiditeJumps 0x7872: Flags2 0x0020, or a default outfit of ModType 37
      quickJump: !!(s.Flags2 & 0x0020) || items.some((id, i) => counts[i] > 0 && modTypes(outfits.get(id)).includes(37)),
      // ShipCanSelfRepair 0x9134: a default outfit of ModType 49
      selfRepair: items.some((id, i) => counts[i] > 0 && modTypes(outfits.get(id)).includes(49)),
      // ShipCanScoop 0x?: a default outfit of ModType 31
      scoops: items.some((id, i) => counts[i] > 0 && modTypes(outfits.get(id)).includes(31)),
      board: novaBoardingMods(items, counts, outfits),
      // ShipCanTargetUntargetableShips 0x238f: a default outfit of ModType 30 whose ModVal has 0x0004
      // HasCloak 0x95f2: the first default outfit of ModType 17, its ModVal (fuel x 16, shields x 256, 0x0004 zeroes the shields); -1 for none
      cloak: (() => { for (let i = 0; i < items.length; i++) { const o = outfits.get(items[i]); if (counts[i] > 0 && o) for (const [t, v] of [[o.ModType, o.ModVal], [o.ModType2, o.ModVal2], [o.ModType3, o.ModVal3], [o.ModType4, o.ModVal4]]) if (t === 17) return v & 0xffff; } return -1; })(),
      targetsAll: items.some((id, i) => { const o = outfits.get(id); return counts[i] > 0 && !!o && [[o.ModType, o.ModVal], [o.ModType2, o.ModVal2], [o.ModType3, o.ModVal3], [o.ModType4, o.ModVal4]].some(([t, v]) => t === 30 && (v & 4)); }),
      sprite: shan.BaseImageID, width: shan.BaseXSize || 0, framesPer: shan.FramesPer || 36,
      sets: Math.max(1, shan.BaseSetCount || 1), animDelay: shan.AnimDelay || 0, shanFlags: shan.Flags || 0,
    });
  }
  const dudes = new Map(novaAll(game, 'düde').map(d => [d.id, d]));
  const fleets = new Map(novaAll(game, 'flët').map(f => [f.id, Object.assign(f, { activateOn: test(f.ActivateOn) })]));
  const persons = new Map(novaAll(game, 'përs').map(p => [p.id, Object.assign(p, { activateOn: test(p.ActivateOn) })]));
  const govts = new Map([...u.govts.values()].map(g => [g.id, { id: g.id, flags: g.Flags, flags2: g.Flags2,
    classes: g.Classes, allies: g.Allies, enemies: g.Enemies, skill: g.SkillMult > 0 ? f32(g.SkillMult * 0.01) : 1 }]));
  return { u, classes, dudes, fleets, persons, govts, roids: novaFlightRoids(game), jumpTicks: novaJumpTicks(game), systems: new Map(), widths: new Map() };
}
/* röid n (from 128) and its sprite, spïn 800 + (n - 128) (LoadSprites
   0x2097f): Strength at least 1, SpinRate / 100 frames a step. Read again
   when the graphics files arrive, as they may after the rest. */
function novaFlightRoids(game) {
  const roids = [];
  for (let t = 0; t < 16; t++) {
    const r = novaGet(game, 'röid', 128 + t), spin = novaGet(game, 'spïn', 800 + t);
    const spr = spin && (game.get('rlëD', spin.SpritesID) || game.get('rlë8', spin.SpritesID));
    let ix = null;
    if (spr) try { ix = novaRleIndex(spr.bytes).header; } catch (e) { ix = null; }
    // as LoadObjectData keeps them: a yield of a commodity (0 to 6) or junk (1000 to 1127), else none; fragments 128 to 143 as 0 to 15
    let yieldType = r ? r.YieldType : -1, yieldQty = r ? r.YieldQty : 0;
    if (yieldQty < 0) { yieldQty = 0; yieldType = -1; }
    if ((yieldType >= 7 && yieldType < 1000) || yieldType < 0 || yieldType > 1127) { yieldType = -1; yieldQty = 0; }
    const frag = v => (v >= 128 && v < 144 ? v - 128 : v >= 0 && v <= 15 ? v : -1);
    const ex = r ? r.ExplodType : -1;
    roids.push({ type: t, name: r ? novaNameParts(r.name).name : '', strength: r ? Math.max(1, r.Strength) : 1, spin: f32((r ? r.SpinRate : 0) * 0.01),
                 sprite: spin ? spin.SpritesID : 0, w: ix ? ix.width : 32, h: ix ? ix.height : 32, frames: ix ? ix.frames : 1,
                 yieldType, yieldQty, partCount: r ? Math.max(0, r.PartCount) : 0, partColor: r ? r.PartColor : 0,
                 frag1: r ? frag(r.FragType1) : -1, frag2: r ? frag(r.FragType2) : -1, fragCount: r ? Math.max(0, r.FragCount) : 0,
                 explod: (ex >= 64 && ex < 1000) || ex < 0 || ex > 1063 ? -1 : ex, mass: r ? r.Mass : 0 });
  }
  return roids;
}

/* How long a jump takes, in 60ths of a second (LoadSounds 0x1c03b): snd
   128, "Warp up", its sample frames (ParseSndHeader) x 60 / its whole
   sample rate; 350 without it. The stock sound is IMA 4:1, 2,094 packets
   of 64 samples at 22,050 a second: 364. (Double-time play uses snd 129;
   the map has none.) */
function novaJumpTicks(game) {
  const r = game.get('snd ', 128), b = r && r.bytes;
  try {
    const u16 = o => (b[o] << 8) | b[o + 1], u32 = o => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    let p = u16(0) === 1 ? 4 + u16(2) * 6 : 4, h = -1;
    for (let i = 0, n = u16(p); i < n; i++) { const c = u16(p + 2 + i * 8); if (c === 0x8050 || c === 0x8051) h = u32(p + 2 + i * 8 + 4); }
    const rate = u32(h + 8) >>> 16, enc = b[h + 20];
    let frames = enc === 0 ? u32(h + 4) : u32(h + 22);
    if (enc === 0xfe) frames *= { ima4: 64, MAC3: 6, MAC6: 6 }[String.fromCharCode(b[h + 40], b[h + 41], b[h + 42], b[h + 43])] || 1;
    if (rate > 0) return Math.trunc(frames * 60 / rate);
  } catch (e) { /* none */ }
  return 350;
}

/* A system as the loader keeps it (0x77f08): its eight DudeTypes with those
   from -128 to -383 taken out as fleets, the flët |id| at the same odds, and
   the düdes' odds scaled to sum to 100 when they do not; its sixteen
   navigation defaults. */
function novaSysInfo(D, sys) {
  let si = D.systems.get(sys.id);
  if (si) return si;
  const r = sys.rec, dudes = [], probs = [], fleets = [];
  let sum = 0, fleetSum = 0;
  for (let i = 0; i < 8; i++) {
    const d = r.DudeTypes[i];
    if (d >= 128 && d <= 639) { dudes.push(d); probs.push(r.Probs[i]); sum += r.Probs[i]; }
    else {
      if (d <= -128 && d >= -383) { fleets.push({ id: -d, w: r.Probs[i] }); fleetSum += r.Probs[i]; }
      dudes.push(-1); probs.push(0);
    }
  }
  if (sum !== 100 && sum > 0) { const k = 100 / sum; for (let i = 0; i < 8; i++) probs[i] = Math.trunc(probs[i] * k); }
  si = { dudes, probs, fleets, fleetSum, nav: (r.Nav || []).slice(0, 16).map(n => (n >= 128 && D.u.stellars.has(n) ? n : -1)) };
  D.systems.set(sys.id, si);
  return si;
}

// GetStellarSpriteXSize 0xac91: a stellar's sprite width, 32 without one.
function novaStellarWidth(D, sp) {
  if (D.widths.has(sp.id)) return D.widths.get(sp.id);
  let w = 32;
  const spin = novaGet(D.u.game, 'spïn', novaStellarSpin(sp)), r = spin && (D.u.game.get('rlëD', spin.SpritesID) || D.u.game.get('rlë8', spin.SpritesID));
  if (r) try { w = novaRleIndex(r.bytes).header.width; } catch (e) { /* 32 */ }
  D.widths.set(sp.id, w);
  return w;
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
  // doubled, but held by another ship's tractor beam a third
  const held = ship.tractor !== undefined && ship.tractor !== -1 && ship.tractor !== ship.slot;
  return Math.max(0, novaIonSlowed(ship, held ? f32(a * 0.333) : f32(a + a), 0.7));
}
/* ShipIonizationFactor 0x3225: the ship's ionization over its class's
   IonizeMax, 0 when that is 0. Ionized, a rate is less by it, at most
   by `most` (0.7, or 0.8 in AIMaintainFormation). */
function novaIonFactor(ship) { const m = ship.cls.ionMax; return m > 0 ? f32(ship.ion / m) : 0; }
function novaIonSlowed(ship, v, most) {
  if (!(ship.ion > 0)) return v;
  let f = novaIonFactor(ship);
  if (f > most) f = f32(most);
  return f32(v * (1 - f));
}
function novaShipMaxSpeed(D, ship) {
  const c = ship.cls;
  if (c.flags & 0x0400) return 0;
  const g = D.govts.get(ship.govt);
  let s = f32(c.speed * ship.skill);
  if (g) s = f32(s * g.skill);
  if (ship.tractor !== undefined && ship.tractor !== -1 && ship.tractor !== ship.slot) s = f32(s * 0.333);
  return Math.max(0, s);
}
function novaShipTurn(ship) {
  let t = ship.cls.turn;
  // held by another ship's tractor beam, a third as quick
  if (ship.tractor !== undefined && ship.tractor !== -1 && ship.tractor !== ship.slot) t = f32(t * 0.333);
  t = ship.cls.turn >= 1 ? Math.max(1, t) : t;
  if (!(ship.jump > 0)) t = novaIonSlowed(ship, t, 0.7);
  return Math.max(0, t);
}
const novaInertialess = ship => !!(ship.cls.flags2 & 0x0040);
// AIIsShipJumping 0x82bf9.
const novaJumping = s => (s.state === 2 || s.state === 0xb || s.state === 3) && (s.mode === 4 || s.mode === 0xd);

/* ---- who is there ------------------------------------------------------- */

/* A system's world after you arrive: { D, sys, state, random, ships, t }.
   `state` is the control bits the map holds (nova-ncb.js); `seed` starts
   the random numbers, so the same seed gives the same ships. */
function novaFlightWorld(D, sys, state, seed, view) {
  const w = { D, sys, si: novaSysInfo(D, sys), state: state || {}, random: novaRandom(seed), ships: new Array(64).fill(null), last: new Array(64).fill(null), t: 0, gone: [],
              roids: Array.from({ length: 16 }, () => ({ active: false })), view: view || { x: 0, y: 0, hw: 320, hh: 240 } };
  w.shots = new Array(128).fill(null);
  w.booms = new Array(32).fill(null);
  w.beams = new Array(64).fill(null);
  w.rand = n => w.random.rand(n);
  w.holds = tree => { try { return ncbEval(tree, w.state); } catch (e) { return true; } };
  novaSetupShips(w);
  for (const s of w.ships) if (s && !s.armed) novaArm(w, s);
  novaCreateAsteroids(w);
  return w;
}
const novaNow = w => 2 * w.t;   // TickCount, in 60ths
// frameCounter (PlayGame 0x457ba): a step at a time, after 1024 back to 0
const novaFrameCounter = w => w.t % 1025;
/* HandleShipDisplay 0x2b58f, a ship that folds (shän Flags 0x02, not
   banking): unfolding (fold 1) or folding (-1) a set every AnimDelay steps,
   between the first set and the last; one that folds to fire (0x80)
   unfolds again 45 ticks after it last fired. */
function novaFoldStep(w, s) {
  const c = s.cls;
  if ((c.shanFlags & 1) || !(c.shanFlags & 2)) return;
  if (s.fold >= 1) {
    s.bank = f32(s.bank + 1);
    if (c.animDelay < s.bank) { s.bank = 0; s.foldFrame++; if (c.sets <= s.foldFrame) { s.foldFrame = c.sets - 1; s.fold = 0; } }
  } else if (s.fold < 0) {
    s.bank = f32(s.bank + 1);
    if (c.animDelay < s.bank) { s.bank = 0; s.foldFrame--; if (s.foldFrame < 1) { s.foldFrame = 0; s.fold = 0; } }
  } else s.bank = 0;
  if ((c.shanFlags & 0x80) && s.fold < 1 && s.foldFrame < c.sets - 1 && novaNow(w) >= s.lastFire + 45) s.fold = 1;
}
// XYFloatSquaredDist 0x2afdb: the square of the distance, in single precision step by step.
const novaDist2 = (ax, ay, bx, by) => f32(f32(f32(ax - bx) ** 2) + f32(f32(ay - by) ** 2));

// An empty ship in a slot, keeping the heading its last ship left there (a person's is never set).
function novaFreshShip(w, slot) {
  const old = w.ships[slot] || w.last[slot];
  return { slot, cls: null, dude: null, pers: null, fleet: null, govt: -1, ai: 1, leader: -1, follows: -1, formLead: false, boost: false, ion: 0, ionColor: 0, ionTint: 0, cloak: 0, cloakDir: 0, jx: 0, jy: 0,
           hasEscorts: false, swarmLead: false, orders: -1, ordered: false, cargo: [0, 0, 0, 0, 0, 0], boarded: false, tractor: -1, tractorAt: 0,
           x: 0, y: 0, vx: 0, vy: 0, speed: 0, heading: old ? old.heading : 0, want: 0,
           thrust: 0, desired: 0, timer: 0, jump: 0, jumpStart: 0, skill: 1, state: 0, mode: 0, sec: -1, primary: -1,
           goal: -2, cached: -1, disabled: false, glow: 32, bank: 0, bankDir: 0, set: 0, animAcc: 0, fold: 0, foldFrame: 0, lastFire: 0 };
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

// A weighted draw from cumulative odds, as the selectors make it: the lowest whose sum reaches Rand(total) + 1.
function novaWeighted(w, ok, weights) {
  let total = 0;
  const cum = weights.map((x, i) => (ok(i) ? (total += x) : 0));
  if (total <= 0) return -1;
  for (;;) { const r = w.rand(total) + 1; for (let i = 0; i < cum.length; i++) if (ok(i) && r <= cum[i]) return i; }
}
// SelectDudeFieldFromSystem 0x674d: one of a system's eight düdes, by their odds.
function novaPickDude(w) {
  const si = w.si;
  return novaWeighted(w, i => si.dudes[i] >= 128 && w.D.dudes.has(si.dudes[i]), si.probs);
}
/* SelectShipFieldFromDude 0x65c2: one of a düde's sixteen ship types, by
   Probs, among those whose AppearOn holds. */
function novaPickShipType(w, dude) {
  const ok = i => { const c = w.D.classes.get(dude.ShipTypes[i]); return !!c && !c.missing && w.holds(c.appearOn); };
  return novaWeighted(w, ok, dude.Probs);
}

// RandomShipSpawn 0x3c0f3: a ship of one of the system's düdes, in slot order.
function novaSpawnDudeShip(w) {
  for (let slot = 1; slot < 64 - 8; slot++) {
    if (w.ships[slot]) continue;
    const f = novaPickDude(w);
    if (f < 0) continue;
    const dude = w.D.dudes.get(w.si.dudes[f]), t = novaPickShipType(w, dude);
    if (t < 0) return null;
    const s = novaFreshShip(w, slot), cls = w.D.classes.get(dude.ShipTypes[t]);
    Object.assign(s, { cls, dude: dude.id, govt: dude.Govt, ai: dude.AIType > 0 ? dude.AIType : cls.ai });
    const n0 = w.si.nav[0], spob = n0 >= 128 ? w.D.u.stellars.get(n0) : null;
    if (s.ai === 3 && spob && cls.speed === 0) {
      const v = { x: spob.xPos, y: spob.yPos }; novaAccel(w.rand(360), 100, v); s.x = v.x; s.y = v.y;
    } else { s.x = w.rand(1500) - 750; s.y = w.rand(1500) - 750; }
    s.heading = w.rand(360);
    s.skill = novaSkill(w, cls);
    s.aggr = w.rand(3) ^ 2;
    if (novaDerelict(w.D, s.govt)) s.glow = 0;
    s.boost = novaHasAfterburner(w, s);
    w.rand(2);
    novaSpriteDraws(w, s, cls);
    w.ships[slot] = s;
    return s;
  }
  return null;
}

/* AIHasAfterburner 0x64f5, asked as a ship is made (+0xbd): never when
   another ship swarms with it, nor for Flags 0x0400; always for Flags
   0x0040; for Flags 0x0020 when Rand(1344) + 256 is at most the player's
   kills (w.kills, 0 unless a battle sets them) over the Strength of the
   first ship class -- the first's, not the ship's own, as the program has
   it. A first class of Strength 0 would divide by 0; here it gives none. */
function novaHasAfterburner(w, s) {
  if (s.slot !== 0) for (let i = 1; i < 64; i++) { const o = w.ships[i]; if (i !== s.slot && o && o.mate === s.slot) return false; }
  const f = s.cls.flags;
  if (f & 0x0400) return false;
  if (f & 0x0040) return true;
  if (!(f & 0x0020)) return false;
  const first = w.D.classes.values().next().value, str = first ? first.rec.Strength : 0;
  return w.rand(0x540) + 256 <= (str ? Math.trunc((w.kills || 0) / str) : -1);
}

/* GenericRandomShipSpawn 0x3c89f: a ship of no kind yet, at random within
   750 of the middle. Its skill is drawn for the first class, whatever it
   becomes, as the program does. */
function novaSpawnBlank(w) {
  const slot = novaFreeSlot(w, 8);
  if (slot < 0) return null;
  const s = novaFreshShip(w, slot), first = w.D.classes.values().next().value;
  s.skill = novaSkill(w, first);
  s.aggr = w.rand(3) ^ 2;
  if (first) novaSpriteDraws(w, s, first);
  s.x = w.rand(1500) - 750; s.y = w.rand(1500) - 750;
  w.ships[slot] = s;
  return s;
}

/* SpawnPerson 0x408d5: a përs, `forced` or one at random among those whose
   LinkSyst takes them here and whose ActivateOn holds, but derelicts when
   `noDerelicts`; never one whose name a person in the system already has.
   A derelict is disabled and still, facing anywhere. */
function novaSpawnPerson(w, forced, noDerelicts) {
  const D = w.D, ok = new Set();
  if (forced) ok.add(forced);
  else for (const p of D.persons.values())
    if (p.id <= 1150 && p.AIType > 0 && D.classes.has(p.ShipType) && novaLinkSystOk(D, p.LinkSyst, w.sys, true) &&
        !(noDerelicts && novaDerelict(D, p.Govt)) && w.holds(p.activateOn)) ok.add(p.id);
  for (const s of w.ships) if (s && s.pers) for (const id of [...ok]) if (D.persons.get(id).name === D.persons.get(s.pers).name) ok.delete(id);
  if (!ok.size) return null;
  const id = forced || 128 + w.rand(0x3fe);
  if (!ok.has(id)) return null;
  const p = D.persons.get(id), cls = D.classes.get(p.ShipType);
  if (!cls) return null;
  const s = novaSpawnBlank(w);
  if (!s) return null;
  Object.assign(s, { cls, pers: id, govt: p.Govt, ai: p.AIType });
  s.boost = novaHasAfterburner(w, s) || !!(p.Flags & 0x0002);   // a përs's Flags 0x0002 gives it one besides
  if (novaDerelict(D, s.govt)) { s.vx = s.vy = s.speed = 0; s.heading = w.rand(360); s.glow = 0; s.disabled = true; }
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
// SelectFleetFromSystem 0x682c: one of the system's own fleets, by their odds, among those available.
function novaPickSystemFleet(w) {
  const list = w.si.fleets.filter(f => { const r = w.D.fleets.get(f.id); return r && w.D.classes.has(r.LeadShipType) && w.holds(r.activateOn); });
  const i = novaWeighted(w, () => true, list.map(f => f.w));
  return i < 0 ? null : w.D.fleets.get(list[i].id);
}

/* SelectRandomStellarDest 0x805de: a stellar for a ship to make for. Only
   one that can be landed on and lies within 999 of the middle to the right
   and down counts, as the program tests. `plainOnly`, a stellar neither
   gate nor wormhole; else a wormhole for a government that prefers them,
   a hypergate for one that prefers those (gövt Flags2 0x80, 0x40), and
   otherwise any inhabited stellar not hostile, gates as the government
   allows (0x20, no hypergates). `planets` is PickEmergeStellar's coin
   (0x7f9a, one in three). The stellar's id, or -1. */
function novaPickStellar(w, s, planets, plainOnly) {
  const D = w.D, u = D.u, g = D.govts.get(s.govt), gf = g ? g.flags2 : 0;
  const noGates = !!(gf & 0x20), likesGates = !!(gf & 0x40), likesHoles = !!(gf & 0x80);
  const info = w.si.nav.map(id => {
    const sp = id >= 128 && u.stellars.get(id);
    if (!sp) return null;
    const near = novaCanLand(sp) && sp.xPos <= 999 && sp.yPos <= 999;
    const empty = !!(sp.Flags & 0x20) && !(sp.Flags2 & 0x3000);
    const foe = s.govt !== -1 && sp.Govt !== -1 && novaGovtEnemies(D, s.govt, sp.Govt);
    return { id, near, empty, foe, gate: !!(sp.Flags2 & 0x1000), hole: !!(sp.Flags2 & 0x2000) };
  });
  let gates = 0, holes = 0, places = 0, plain = 0;
  for (const t of info) {
    if (!t) continue;
    if (t.gate && t.near && !t.foe) gates++;
    if (!t.near) continue;
    if (t.hole && !t.foe) holes++;
    if (t.empty || t.foe) continue;
    places++;
    if (!t.gate && !t.hole) plain++;
  }
  // drawn until one fits, as the program does; the counts say one does
  const draw = pred => { for (let n = 0; n < 1e5; n++) { const t = info[w.rand(16)]; if (t && t.near && pred(t)) return t.id; } return -1; };
  if (plainOnly) return plain > 0 ? draw(t => !t.hole && !t.gate && !t.foe) : -1;
  if (holes > 0 && likesHoles) return draw(t => t.hole && !t.foe);
  if (gates > 0 && likesGates) return draw(t => t.gate && !t.foe);
  if (places > 0 && planets && !noGates && (plain > 0 || gates > 0)) return draw(t => !t.empty && !t.foe && !t.hole);
  if (places > 0 && (plain > 0 || (gates > 0 && !noGates))) return draw(t => !t.empty && !t.foe && !(t.hole && !likesHoles) && !(t.gate && noGates));
  return -1;
}
// PickEmergeStellar 0x7f9a: the hypergate or wormhole an arrival comes out of, or null.
function novaPickEmerge(w, s) {
  const id = novaPickStellar(w, s, w.rand(3) === 0, false), sp = id >= 128 && w.D.u.stellars.get(id);
  return sp && (sp.Flags2 & 0x3000) ? sp : null;
}
/* SelectNearestAnyStellar 0x7fb00: the nearest stellar of the system that
   is neither gate nor wormhole, not hostile, and not `except`; or -1. */
function novaNearestStellar(w, s, except) {
  let best = -1, bd = 0;
  for (const id of w.si.nav) {
    const sp = id >= 128 && w.D.u.stellars.get(id);
    if (!sp || (sp.Flags2 & 0x3000) || id === except) continue;
    if (s.govt !== -1 && sp.Govt !== -1 && novaGovtEnemies(w.D, s.govt, sp.Govt)) continue;
    const d = novaDist2(sp.xPos, sp.yPos, s.x, s.y);
    if (best === -1 || bd > d) { best = id; bd = d; }
  }
  return best;
}

/* AIMakeShipEmergeFromHyperGate 0x89518: in the gate for two seconds,
   facing CustSndID if that is a heading (the Bible's spöb section) and
   anywhere else, then out at 30 a step. */
function novaEmergeFrom(w, s, gate) {
  Object.assign(s, { state: 0x15, mode: 0, gate: gate.id, timer: 60, jump: -1, thrust: -3, desired: s.leader === 0 ? -15 : -30 });
  s.goal = s.cls.fuel > 0 ? gate.id : -2;
  const h = gate.CustSndID & 0xffff;
  s.heading = h <= 359 ? h : w.rand(360);
}
// AIMakeShipJumpIn 0x82ebb.
function novaJumpIn(w, s) { Object.assign(s, { state: 8, jump: -999, fold: 1, foldFrame: 0 }); s.bank = -w.rand(10); }

// The distance an arrival covers slowing from 50 by 1.165 a step, and 1,000 more (HyperSpawnFleet 0x41f7f).
const NOVA_ARRIVAL_R = (() => { let r = 0, ramp = 50; for (let i = 0; i < 43; i++) { r = f32(r + ramp); ramp = f32(ramp - 1.165); } return f32(r + 1000); })();

// A ship put at the arrival distance in a random direction, facing the middle, at 50 a step.
function novaArriveFromHyperspace(w, s) {
  novaJumpIn(w, s);
  const p = { x: 0, y: 0 }; novaAccel(w.rand(360), NOVA_ARRIVAL_R, p);
  s.x = p.x; s.y = p.y;
  s.heading = novaBearing(s.x, s.y, 0, 0);
  const v = { x: 0, y: 0 }; novaAccel(Math.trunc(s.heading), 50, v); s.vx = v.x; s.vy = v.y;
}

// HyperSpawnFleet 0x41c8d: a flët's lead and escorts, arriving.
function novaHyperSpawnFleet(w, f) {
  const D = w.D, lc = D.classes.get(f.LeadShipType);
  const lead = novaSpawnBlank(w);
  if (!lead) return;
  Object.assign(lead, { cls: lc, fleet: f.id, govt: f.Govt, ai: lc.ai });
  lead.boost = novaHasAfterburner(w, lead);   // the lead only: the escorts are not asked
  if ((f.Flags & 1) && lc.ai <= 2) { const k = w.rand(6); lead.cargo[k] = w.rand(lc.holds) + 1; }
  lead.vx = lead.vy = lead.speed = 0;
  const gate = novaPickEmerge(w, lead);
  if (gate) { novaEmergeFrom(w, lead, gate); lead.x = gate.xPos; lead.y = gate.yPos; }
  else {
    novaJumpIn(w, lead);
    const p = { x: 0, y: 0 }; novaAccel(w.rand(360), NOVA_ARRIVAL_R, p);
    lead.x = p.x; lead.y = p.y;
    lead.heading = novaBearing(lead.x, lead.y, 0, 0);
    lead.jumpStart = novaNow(w);
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
      if ((f.Flags & 1) && cls.ai <= 2) { const k = w.rand(6); s.cargo[k] = w.rand(cls.holds) + 1; }
      if (gate) {
        novaEmergeFrom(w, s, gate); s.x = gate.xPos; s.y = gate.yPos;
        s.heading = lead.heading; s.timer = f32(s.timer + w.rand(15) + 5); s.goal = -2;
      } else { s.jump = -999; s.jumpStart = novaNow(w); novaJumpIn(w, s); }
    }
  }
  lead.formLead = true;
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
    if (snap && s.state !== 0x15) novaKeepFormation(w, s, true);
  });
}
/* AIMaintainFormation 0x84f04: an escort put on its place (`snap`), or
   moved toward it ten times its thrust a step on each axis while more
   than 8 off, unless it is jumping. */
function novaKeepFormation(w, s, snap) {
  if ((s.jump > 0 && !snap) || s.follows < 0 || s.follows > 63 || s.formX === undefined) return;
  if (snap) { s.x = s.formX; s.y = s.formY; return; }
  const step = novaIonSlowed(s, f32(f32(novaShipAccel(w.D, s) * 10) * 1), 0.8);
  for (const [k, f] of [['x', s.formX], ['y', s.formY]]) {
    if (f32(f - 8) >= s[k]) s[k] = f32(s[k] + step);
    else if (s[k] >= f32(f + 8)) s[k] = f32(s[k] - step);
  }
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
    if (w.rand(7) === 0) setOff(novaSpawnPerson(w, 0, false));
    else if (w.rand(7) === 0) novaSpawnFleet(w);
    else setOff(novaSpawnDudeShip(w));
  }
  for (let i = 0; i < 8; i++) {
    const id = rec.Person[i], p = id >= 128 && id <= 1150 && D.persons.get(id);
    if (!p || !w.holds(p.activateOn)) continue;
    if (w.rand(100) + 1 > rec.PersonProb[i]) continue;
    setOff(novaSpawnPerson(w, id, false));
  }
}

/* EnterMoreShips 0x43459, without mission fleets, the player's escorts,
   the shareware nag and the pirates sent after a laden player: while the
   ships here, but those escorting the player, are fewer than AvgShips,
   Rand(500) gives 1 for one of the system's fleets, if it has any and
   Rand(100) falls within their odds, and otherwise 0 or 1 for a düde's
   ship. The defence fleets launch only once their stellar has been set
   off, which comes with fighting. */
function novaEnterMoreShips(w) {
  if (w.noArrivals) return;
  const here = w.ships.filter(s => s && s.leader !== 0).length;
  if (w.sys.rec.AvgShips <= here) return;
  const r = w.rand(500);
  if (r === 1 && w.si.fleets.length && w.rand(100) + 1 <= w.si.fleetSum) {
    const f = novaPickSystemFleet(w);
    if (f) { novaHyperSpawnFleet(w, f); return; }
  } else if (r !== 0 && r !== 1) return;
  if (novaPickDude(w) >= 0) novaHyperShipSpawn(w);
}
/* HyperShipSpawn 0x4291a: one in seven a person (no derelicts), else one
   in seven a fleet, else a düde's ship; arriving out of a gate or by
   hyperspace, as a fleet does. */
function novaHyperShipSpawn(w) {
  let s;
  if (w.rand(7) === 0) { s = novaSpawnPerson(w, 0, true); if (!s) return; }
  else if (w.rand(7) === 0) { novaSpawnFleet(w); return; }
  else {
    s = novaSpawnDudeShip(w);
    if (!s) return;
    if (!(s.cls.fuel > 0)) { w.ships[s.slot] = null; return; }
  }
  s.x = s.y = 0;
  const p = { x: 0, y: 0 }; novaAccel(w.rand(360), NOVA_ARRIVAL_R, p); s.x = p.x; s.y = p.y;
  s.heading = novaBearing(s.x, s.y, 0, 0);
  s.goal = -2; s.vx = s.vy = s.speed = 0;
  const gate = novaPickEmerge(w, s);
  if (gate) { novaEmergeFrom(w, s, gate); s.x = gate.xPos; s.y = gate.yPos; }
  else {
    s.jump = -999; s.jumpStart = novaNow(w);
    const v = { x: 0, y: 0 }; novaAccel(Math.trunc(s.heading), 50, v); s.vx = v.x; s.vy = v.y;
    novaJumpIn(w, s);
  }
}

/* ---- where each goes ---------------------------------------------------- */

/* One 30th of a second, in the program's order (DoPlayGameWork 0x44070):
   arrivals, each ship's AI, each ship's move. */
function novaFlightStep(w) {
  novaShotHits(w);
  novaFleetBookkeeping(w);
  novaTargetedDamage(w);
  novaEnterMoreShips(w);
  novaSpawnAsteroid(w, true);
  w.miners = false;
  for (const s of w.ships) if (s && !s.armed) novaArm(w, s);
  for (const s of w.ships) if (s && w.ships[s.slot] === s) novaAI(w, s);
  novaOddsRound(w);
  for (const sh of w.shots) if (sh && w.shots[sh.slot] === sh) novaHandleShot(w, sh);
  for (const s of w.ships) {
    if (!s || w.ships[s.slot] !== s) continue;
    novaShipUpkeep(w, s);
    novaHandleShip(w, s);
    if (w.ships[s.slot] !== s) continue;
    novaShipFire(w, s);
    novaFoldStep(w, s);
    novaPutInLayer(w, 's', s.slot, s.disabled ? 'disabled' : s.leader === 0 ? 'escort' : 'ship');
    novaIonTint(w, s);
    novaCloakFade(w, s);
    s.frame = novaShipFrame(s);
    novaDeathThroes(w, s);
  }
  novaHandleExplods(w);
  novaHandleBoxes(w);
  novaHandleAsteroids(w);
  novaHandleBeams(w);
  novaMoveParticles(w);
  w.t++;
}
/* HandleShipDisplay 0x2b58f, ionized: at a factor of 0.33 or more the
   ship is tinted its ionization's colour, 14 to 18 of 32 (a factor x 24
   x 0.01 held to 16 to 24, less 2, plus Rand(5)); not ionized, its colour
   is forgotten. The tint is put over the murk's, which is not done here
   (it is 0), so the ionization's always shows. */
function novaIonTint(w, s) {
  s.ionTint = 0;
  if (!(s.ion > 0)) { s.ionColor = 0; return; }
  const f = novaIonFactor(s);
  if (!(f >= 0.33)) return;
  let lv = (Math.trunc(f32(f * 24) * 0.01) << 16) >> 16;
  lv = lv > 24 ? 24 : lv < 16 ? 16 : lv;
  s.ionTint = lv - 2 + w.rand(5);
}
/* ---- cloaking ------------------------------------------------------------- */

/* A ship's cloak is a level, 0 to 32, and a way it is going (+0xc8d8): 1
   cloaking, -1 uncloaking, -2 dying, 0 neither. ShipIsCloaked 0x255f:
   over 24 and not uncloaking, over 8 uncloaking, or over 16. */
const novaCloaked = s => (s.cloak > 24 && s.cloakDir >= 0) || (s.cloak > 8 && s.cloakDir < 0) || s.cloak > 16;
/* ShipCanCloak 0x553c, for a ship not the player's: not disabled, with a
   cloak, and fuel -- the program reads the costs from the outfit's
   ModType (17) where it means its ModVal, so every cloak costs fuel (17 /
   16 & 15 is 1) and none shields. The area cloak HasCloak lends an escort
   (ModVal 0x1000) is in no release and is not done. */
const novaCanCloak = s => !s.disabled && s.cls.cloak >= 0 && s.fuel > 0;
// DoShipCloak 0xde73: not cloaked, cloaking (or, part faded out, no longer uncloaking); the shields gone with a cloak of ModVal 0x0004.
function novaCloak(s) {
  if (novaCloaked(s)) return;
  if (s.cloak > 0) { if (s.cloakDir < 0) s.cloakDir = 0; } else s.cloakDir = 1;
  if (s.shield > 0 && (s.cls.cloak & 4)) s.shield = 0;
}
// DoShipUncloak 0xdf55: cloaked, uncloaking (or, not yet faded in, no longer cloaking).
function novaUncloak(s) {
  if (!novaCloaked(s)) return;
  if (s.cloak <= 0) { if (s.cloakDir > 0) s.cloakDir = 0; } else s.cloakDir = -1;
}
/* AIHandleCloaking 0x833e1, while the ship's timer is out: with a cloak,
   not disabled, and the fuel and shields its cloak spends, a ship cloaks
   by its class's Flags2 -- 0x0100 with a weapon past its reload (a
   burst's), 0x0200 running (state 3, or 16 in move 19), 0x0400 jumping
   (move 4, state 8 or 11), 0x0800 going about (states 1, 6, 7, 10, 20),
   0x1000 staying cloaked attacking farther than 165 off on either axis or
   mining (state 16 but move 20), 0x2000 idle (state 0) -- or an escort
   (AI over 4) in formation (move 12) behind a cloaked lead; else it
   uncloaks. */
function novaHandleCloaking(w, s) {
  const c = s.cls;
  if (c.cloak < 0 || s.disabled) { if (s.cloak <= 0) return; novaUncloak(s); return; }
  if (((c.cloak >> 4) & 0xf) >= 1 && !(s.fuel > 0)) { novaUncloak(s); return; }
  if (((c.cloak >> 8) & 0xf) >= 1 && !(s.shield > 0)) { novaUncloak(s); return; }
  const f2 = c.flags2, st = s.state, mv = s.mode;
  let go = false;
  if (f2 & 0x0100) go = s.weap.some(r => { const W = novaWeapOf(w.D, r.i); return r.count > 0 && W && W.reload < r.reload; });
  if ((f2 & 0x0200) && (st === 3 || (st === 0x10 && mv === 0x13))) go = true;
  if ((f2 & 0x0400) && (mv === 4 || st === 8 || st === 0xb)) go = true;
  if ((f2 & 0x0800) && [1, 6, 0x14, 7, 10].includes(st)) go = true;
  if (f2 & 0x1000) {
    const t = s.primary !== -1 ? w.ships[s.primary] : null;
    if (novaCloaked(s) && t && st === 4 && (Math.abs(f32(s.x - t.x)) > 165 || Math.abs(f32(s.y - t.y)) > 165)) go = true;
    if (novaCloaked(s) && st === 0x10 && mv !== 0x14) go = true;
  }
  if ((f2 & 0x2000) && st === 0) go = true;
  const L = s.leader !== -1 ? w.ships[s.leader] : null;
  if (go || (s.ai > 4 && L && mv === 0xc && novaCloaked(L))) novaCloak(s); else novaUncloak(s);
}
/* HandleShipDisplay 0x2b58f, the cloak's fade: a level going nowhere and
   between 0 and 32 falls by 1 a step; else it moves by 0.75 a step in its
   way (1.5 for a class of Flags2 0x0001), stopping at 0 and 32. A dying
   ship's cloak goes out (-2). Part faded, the ship's picture shakes by
   up to a tenth of the level each way (two Rand draws). */
function novaCloakFade(w, s) {
  s.jx = s.jy = 0;
  if (s.cloakDir === 0) {
    if (!(s.cloak < 32)) { /* held */ }
    else if (s.cloak > 0) s.cloak = f32(s.cloak - 1);
    else return;
  } else {
    const rate = (s.cls.flags2 & 1) ? 1.5 : 0.75;
    s.cloak = f32(s.cloak + rate * s.cloakDir);
    if (s.cloak <= 0 && s.cloakDir < 0) { s.cloak = 0; s.cloakDir = 0; }
    if (s.cloak >= 32 && s.cloakDir > 0) { s.cloakDir = 0; s.cloak = 32; }
  }
  if (!(s.cloak > 0)) return;
  if (novaDying(s)) s.cloakDir = -2;
  if (s.cloak < 32) {
    const k = (Math.trunc(f32(s.cloak / 10)) << 16) >> 16, n = 2 * k + 1;
    s.jx = k - w.rand(n); s.jy = k - w.rand(n);
  }
}

// A ship leaves the system (it jumped, or went into a gate).
function novaGone(w, s, how) { w.ships[s.slot] = null; w.last[s.slot] = s; w.gone.push({ slot: s.slot, cls: s.cls.id, how, t: w.t, ship: s }); }

/* AIDispatch 0x8fb52. At thirty frames a second every ship thinks every
   frame (aiComplexity 1, set by HandleTimeAdjustment); slower frames
   spread the thinking over two to sixteen. */
function novaAI(w, s) {
  const D = w.D;
  if (s.timer <= 0) novaHandleCloaking(w, s);
  if (s.formLead) novaFormation(w, s, false);
  if (s.disabled && s.jump > 0) s.jump = -1;
  let think = true;
  // a ship that folds (shän Flags 0x02) unfolds when idle, and folds to jump; one that folds to fire (0x80) only 45 ticks after it last fired
  const fold = (s.cls.shanFlags & 2) !== 0, rested = !(s.cls.shanFlags & 0x80) || novaNow(w) >= s.lastFire + 45;
  if (s.jump < -900) {
    s.state = 8; s.mode = 10;
    if (fold && s.foldFrame < s.cls.sets - 1 && s.fold === 0 && rested) s.fold = 1;
  } else if (s.mode === 0xd || s.mode === 4) {
    if (fold && s.foldFrame > 0 && s.fold === 0 && !(s.cls.shanFlags & 0x80)) s.fold = -1;
    // jumping out after a lead that has turned to fight: stop and stay
    if (s.state === 0xb && s.leader > 0 && s.jump <= 1) {
      const l = w.ships[s.leader];
      if (l && !l.disabled && l.state === 4) Object.assign(s, { state: 0, mode: 0, primary: -1, sec: -1, jump: -1 });
    }
  } else {
    if (s.state === 8) s.state = 0;
    if (s.hasEscorts && novaFrameCounter(w) % 8 === s.slot >> 3) novaIssueEscortOrders(w, s);
    // state 19, waiting: a 1 in 100 chance a frame of thinking again
    if (s.state === 0x13 && w.rand(100) !== 0) think = false;
    else {
      if (s.state === 0x13) s.state = 0;
      if (s.disabled) Object.assign(s, { leader: -1, primary: -1, sec: -1, anger: 0, state: 0, mode: 0 });
      else if (s.state !== 0x15) {
        novaSwarmLeader(w, s);
        if ((s.cls.flags3 & 3) && s.leader === -1) novaMinerAI(w, s);
        else if (s.ai === 1) novaWimpyTraderAI(w, s);
        else if (s.ai === 2) novaBraveTraderAI(w, s);
        else if (s.ai === 3) { const g = D.govts.get(s.govt); if (g && (g.flags & 0x1000)) novaPirateWarshipAI(w, s); else novaWarshipAI(w, s); }
        else if (s.ai === 4) novaInterceptorAI(w, s);
        else if (s.ai > 4) novaEscortAI(w, s);
      }
    }
    if ((s.cls.flags3 & 3) && s.leader === -1) w.miners = true;
    if (s.timer <= 0 && s.state !== 1 && s.fold === 0 && fold && s.foldFrame < s.cls.sets - 1 && rested) s.fold = 1;
  }
  if (think) novaHighLevel(w, s);
  if (w.ships[s.slot] === s) novaLowLevel(w, s);
}

// A ship sets out to leave: state 2, and its jump timer no longer below 0 (the supervisors' leave).
function novaLeave(w, s) {
  s.state = 2;
  if (s.jump < 0) s.jump = 0;
  s.primary = -1;
  s.jumpStart = novaNow(w);
}
/* The traders' ladder (WimpyTraderAI 0x8b029; BraveTraderAI 0x8b493 the
   same): idle, and not already at one of the system's stellars, make for
   one; else leave, or park where it cannot jump. */
function novaTravelOrLeave(w, s) {
  const at = !w.si.nav.some(n => n !== -1) || (s.goal !== -1 && w.si.nav.includes(s.goal));
  if (!at) {
    s.sec = -1;
    s.sec = novaPickStellar(w, s, false, false);
    if (s.sec !== -1) { s.state = 1; return; }
  }
  if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6;
}
function novaWimpyTraderAI(w, s) {
  if (s.state === 9 || s.state === 0xf || s.state === 0x16) return;
  if (s.state === 0) novaTravelOrLeave(w, s);
  novaTraderFight(w, s, false);
}
function novaBraveTraderAI(w, s) {
  if (s.state === 9 || s.state === 0xf || s.state === 0x16) return;
  if (s.state === 0) novaTravelOrLeave(w, s);
  novaTraderFight(w, s, true);
}
/* InterceptorAI 0x8c895 without its targets: idle, travelling or going
   into a gate, and not coasting, it picks a ship at random to go and look
   at (one not an interceptor, not just looked at, not coming out of a
   gate); with none, idle, it makes for a stellar neither gate nor wormhole
   (its visits forgotten each time), or leaves, or parks. */
function novaInterceptorAI(w, s) {
  if (s.disabled || s.state === 0x16 || s.state === 9 || s.state === 0xf) return;
  if (s.cached !== -1 && !w.ships[s.cached]) s.cached = -1;
  const g = novaInterceptorFight(w, s);
  if ((s.state === 0 || s.state === 1 || s.state === 0x14) && s.timer <= 0) {
    if (s.primary === -1) {
      const can = i => { const o = w.ships[i]; return o && i !== s.slot && i !== s.cached && o.ai !== 4 && o.state !== 0x15; };
      let n = 0;
      for (let i = 0; i < 64; i++) if (can(i)) n++;
      // drawn until one is found, as the program draws
      if (n > 0) while (s.primary === -1) {
        const i = w.rand(0x40);
        if (can(i)) { s.primary = i; s.cached = i; s.state = 7; }
      }
    }
    if (s.primary === -1 && s.state === 0) {
      s.goal = -2;
      const id = novaPickStellar(w, s, false, true);
      if (id === -1) { if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6; }
      else { s.sec = id; s.state = 1; }
    }
  }
  novaInterceptorTail(w, s, g);
}
/* MinerAI 0x8b202, for ships whose Flags3 says they destroy asteroids
   (0x0001) or scoop debris (0x0002), and lead no fleet: angered, it
   retreats; one that destroys mines the first asteroid of the system's
   (state 16), or parks with none; one that scoops, with a scoop and room,
   goes for the boxes a broken asteroid leaves (state 17) while there are
   any, and leaves when full; one that scoops without a scoop, or has
   nothing to do, wanders to the nearest stellar it did not last visit. */
function novaMinerAI(w, s) {
  if (s.disabled) { Object.assign(s, { state: 0, mode: 0, sec: -1, primary: -1 }); return; }
  if (s.state === 0x16) return;
  if (s.anger > 0 && s.primary !== -1) { s.state = w.noRetreat ? 4 : 3; return; }
  const f = s.cls.flags3;
  // destroying asteroids (Flags3 0x0001): at the first of them, or parked with none
  if ((f & 1) && s.state !== 2) {
    if (!w.roids[0].active) { s.primary = -1; s.sec = -1; s.state = 6; } else s.state = 0x10;
  }
  if (f & 2) {
    // scooping their yield (0x0002), with a scoop: the boxes while it has room, else the asteroids if it destroys them; full, it leaves
    if (s.cls.scoops) {
      if (novaTotalCargo(s) < s.cls.holds) {
        if (w.boxesActive) { s.state = 0x11; return; }
        if (f & 1) { s.state = 0x10; return; }
      } else { novaLeave(w, s); return; }
    }
  } else if (f & 1) return;
  // else wandering: to the nearest stellar not the one it was at, or away
  if (s.timer > 0) { s.sec = -1; s.state = 0; return; }
  if (s.sec === -1) s.sec = novaNearestStellar(w, s, s.goal);
  if (s.sec !== -1 && s.state !== 2 && s.state !== 3) { s.state = 1; s.goal = s.sec; return; }
  if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6;
}
// TotalCargo 0x4a0b: the six commodities' tons together.
const novaTotalCargo = s => (s.cargo.reduce((a, b) => a + b, 0) << 16) >> 16;
/* EscortAI 0x838d2, for a fleet's escorts and a carrier's fighters: with
   no lead, or a dying one, back to its class's own AI; with a lead leaving
   -- jumping (mode 4 or 13), braking to leave (state 2, mode 1) or with
   its jump timer running -- it makes ready to go with it (state 11), or,
   inertialess, leaves on its own. Otherwise it does as its lead's last
   order says (novaIssueEscortOrders): 1, defend, attacks the nearest ship
   threatening the lead within 550 of it; 2, attack, the nearest anywhere;
   3, for a fighter, comes back aboard (state 5); 4 holds (state 6); and
   with none, or 0, it keeps station (state 10), shooting at a ship that
   threatens its lead when it is in reach. A fighter out of ammunition
   (class Flags2 0x0080) told to defend or attack comes back instead. */
function novaEscortAI(w, s) {
  if (s.state === 0x16) return;
  if (s.leader !== 0 && (s.state === 9 || s.state === 0xf)) return;
  const lead = s.leader >= 0 ? w.ships[s.leader] : null;
  if (!lead || novaDying(lead)) { Object.assign(s, { leader: -1, ai: s.cls.ai, state: 0, mode: 0, jump: -1 }); return; }
  const release = () => { Object.assign(s, { leader: -1, ai: s.cls.ai, state: 2, mode: 4, jump: 0 }); };
  if (lead.mode === 4 || lead.mode === 0xd || (lead.state === 2 && lead.mode === 1) || lead.jump > 0) {
    s.primary = -1; s.sec = lead.sec;
    if (novaInertialess(s)) { release(); return; }
    s.state = 0xb;
  }
  if (s.primary !== -1) { const t = w.ships[s.primary]; if (!t || (t.disabled && s.orders !== 2)) s.primary = -1; }
  if ((s.orders === 1 || s.orders === 2) && (s.cls.flags2 & 0x80)) {
    const out = novaOutOfAmmo(w, s);
    if (out) { if (s.ai === 5) s.orders = 3; else if (out === 2) s.orders = 0; }
  }
  if (s.state === 0xb) { s.primary = -1; if (novaInertialess(s)) release(); return; }
  const station = () => { s.state = 10; s.sec = lead.slot; };
  if (s.orders === 1) {
    s.jump = -1; s.timer = -1;
    if (s.primary !== -1) {
      const t = w.ships[s.primary];
      if (novaDist2(t.x, t.y, lead.x, lead.y) > 408375) s.primary = -1; else s.state = 4;
      if (s.primary !== -1) { s.state = 4; return; }
    }
    s.primary = novaNearestThreatToParent(w, s, 550);
    if (s.primary !== -1) { s.state = 4; return; }
    station(); return;
  }
  if (s.orders === 2) {
    s.jump = -1; s.timer = -1;
    if (s.primary !== -1) { s.state = 4; return; }
    s.primary = novaNearestThreatToParent(w, s, -1); s.sec = -1;
    if (s.primary === -1) station(); else s.state = 4;
    if (s.primary !== -1) { s.state = 4; return; }
    station(); return;
  }
  if (s.orders === 4) { s.primary = -1; s.sec = -1; s.state = 6; novaFireTurret(w, s); return; }
  if (s.ai === 5 && s.orders === 3) { s.state = 5; s.primary = -1; s.sec = lead.slot; return; }
  s.jump = -1; s.timer = -1;
  if (s.primary === -1) novaFightThreatToParent(w, s);
  else if (!novaInGunRangeAny(w, s, w.ships[s.primary])) { s.primary = -1; novaFightThreatToParent(w, s); }
  station();
  if (s.primary === s.leader) s.primary = -1;
  if (s.primary === -1) return;
  novaFireGun(w, s, false); novaFireTurret(w, s);
}

/* HighLevelAIHandler 0x8d453: the states that need no enemy, in the
   program's order, a state changed by one arm handled by the arms after
   it in the same pass. Coasting (the timer above 0) stops it but in
   states 10 and 14. */
function novaHighLevel(w, s) {
  const D = w.D;
  // 22, a count: done when the timer is; till then doing nothing
  if (s.state === 0x16) {
    if (s.timer <= 0) { s.state = 0; s.mode = 0; } else { s.latch = false; s.primary = -1; s.sec = -1; s.mode = 1; }
  }
  if (s.timer > 0 && s.state !== 10 && s.state !== 0xe) return;
  if (s.primary >= 0 && !w.ships[s.primary]) s.primary = -1;
  if (s.state !== 0xb && s.state !== 2 && s.state !== 3) s.jump = 0;
  if (s.jump > 0) s.state = s.leader === 0 ? 0xb : s.primary !== -1 ? 3 : 2;
  if (novaHighTarget(w, s)) return;
  // 1: to a stellar; a gate is gone into (0x14). Near it, braking at 0.98 a step, then stopped beside it and coasting 10 to 16 seconds.
  if (s.state === 1 && s.sec !== -1) {
    const sp = D.u.stellars.get(s.sec);
    if (!sp || (sp.Flags2 & 0x3000)) s.state = 0x14;
    else {
      s.jump = 0;
      const dx = Math.trunc(f32(sp.xPos - s.x)), dy = Math.trunc(f32(sp.yPos - s.y));
      const turn = novaShipTurn(s), range = turn >= 8 ? 40 : Math.trunc((9 - turn) * 8 + 32);
      if (Math.abs(dx) > range || Math.abs(dy) > range) s.mode = 2;
      else {
        if ((s.cls.shanFlags & 2) && s.foldFrame > 0) s.fold = -1;
        if (Math.abs(s.vx) >= 0.35 || Math.abs(s.vy) >= 0.35) {
          s.mode = 1; s.vx = f32(s.vx * 0.98); s.vy = f32(s.vy * 0.98); s.speed = f32(s.speed * 0.98);
        } else {
          Object.assign(s, { vx: 0, vy: 0, speed: 0, mode: 0, state: 0, goal: s.sec });
          s.timer = s.cls.flags3 & 2 ? w.rand(75) + 100 : w.rand(200) + 300;
        }
      }
    }
  }
  // 0x14: into a gate: to within a quarter of its sprite's width, then stopped, 16 steps going in, its escorts sent in after it.
  if (s.state === 0x14 && s.sec >= 128) {
    const sp = D.u.stellars.get(s.sec);
    s.jump = 0;
    const dx = Math.trunc(f32(sp.xPos - s.x)), dy = Math.trunc(f32(sp.yPos - s.y)), q = Math.trunc(novaStellarWidth(D, sp) / 4);
    if (Math.abs(dx) > q || Math.abs(dy) > q) { s.mode = 2; s.timer = -1; }
    else {
      s.vx = s.vy = 0; s.mode = 0x17;
      if (s.timer < 0 || s.timer > 16) s.timer = 16;
      for (const o of w.ships) if (o && o !== s && o.leader === s.slot)
        Object.assign(o, { leader: -1, follows: -1, ai: Math.min(s.ai, 3), anger: -1, primary: -1, sec: s.sec, state: 0x14, mode: 0 });
    }
  }
  // 0x15: in a gate, coming out once the timer runs down (then arriving, below)
  if (s.state === 0x15) { s.mode = 0; s.primary = -1; if (s.timer <= 0) { s.timer = -1; s.state = 8; s.sec = -1; s.gate = -1; } }
  // 2: leaving: within 1,000 of the middle, away from it (mode 3); else braking (1) until still, then the jump (4)
  if (s.state === 2) {
    if (f32(s.x * s.x + s.y * s.y) <= 1e6) s.mode = 3;
    else if (s.cls.quickJump || (Math.abs(s.vx) < 0.35 && Math.abs(s.vy) < 0.35)) s.mode = 4;
    else s.mode = 1;
  }
  // 11: going with a leaving lead: its jump followed once it is braking or jumping (13); the lead is set to leaving too, as the program does
  if (s.state === 0xb) {
    const lead = s.leader > 0 ? w.ships[s.leader] : null;
    if (s.leader === -1 || !lead) { Object.assign(s, { primary: -1, sec: -1, state: 2, mode: 4 }); }
    else {
      lead.state = 2;
      if (lead.mode === 1 || lead.mode === 4) { s.primary = -1; s.sec = lead.sec; s.mode = 0xd; }
      else Object.assign(s, { primary: -1, sec: -1, state: 0, mode: 0 });
    }
  }
  novaHighAttack(w, s);
  // 5: a fighter going back aboard: landing (move 8) within (10 - turn) x 50, at least 100, of its carrier; else closing (11); braking if it cannot see it
  if (s.state === 5 && s.leader !== -1) {
    s.sec = s.leader;
    const lead = w.ships[s.leader] || w.last[s.leader];
    let r = (Math.trunc(f32((10 - s.cls.turn) * 50)) << 16) >> 16;
    if (r < 100) r = 100;
    if (lead) s.mode = Math.abs(f32(s.x - lead.x)) > r || Math.abs(f32(s.y - lead.y)) > r ? 0xb : 8;
    if (!w.ships[s.leader] || !novaVisible(w.ships[s.leader], s)) s.mode = 1;
  }
  // 10: keeping station on the lead: velocity matched within 300 (mode 12), closing within 600 (11), else pursuing (9)
  if (s.state === 10 && s.leader !== -1) {
    const lead = w.ships[s.leader];
    if (lead) {
      s.sec = lead.slot;
      const dx = Math.abs(f32(s.x - lead.x)), dy = Math.abs(f32(s.y - lead.y));
      if (lead.state === 0x15) s.mode = dx <= 300 && dy <= 300 ? 1 : 9;
      else s.mode = dx <= 300 && dy <= 300 ? 0xc : dx <= 600 && dy <= 600 ? 0xb : 9;
    }
  }
  // 6: parked
  if (s.state === 6) { s.jump = 0; s.mode = 1; }
  // 16: mining the first asteroid: alongside it within (10 - turn) x 15 (move 20), else making for it (19); with none, braking
  if (s.state === 0x10) {
    const a = w.roids[0], r = (Math.trunc(f32((10 - s.cls.turn) * 15)) << 16) >> 16;
    if (!a.active) s.mode = 1;
    else s.mode = Math.abs(f32(s.x - a.x)) > r || Math.abs(f32(s.y - a.y)) > r ? 0x13 : 0x14;
  }
  // 17: scooping boxes (move 21)
  if (s.state === 0x11) s.mode = 0x15;
  // 7: an interceptor going to look at a ship: within 100, done
  if (s.state === 7) {
    const t = s.primary >= 0 ? w.ships[s.primary] : null;
    if (s.primary === -1 || s.timer > 0) s.state = 0;
    else if (!t) { s.primary = -1; s.state = 0; }
    else if (Math.abs(f32(s.x - t.x)) > 100 || Math.abs(f32(s.y - t.y)) > 100) s.mode = 9;
    else { s.state = 0; s.primary = -1; }
  }
  // 8: arriving
  if (s.state === 8) { s.jump = -999; s.mode = 10; }
  if (s.state === 0) s.mode = 0;
}

/* LowLevelAIHandler 0x851da: the heading wanted and the thrust, for the
   modes that need no target, in the program's order. Nothing is done by a
   disabled ship. */
function novaLowLevel(w, s) {
  const D = w.D, ok = !s.disabled;
  s.thrust = 0;
  s.latch = false;
  if (s.desired >= 0) s.desired = novaShipMaxSpeed(D, s);
  s.want = Math.trunc(s.heading);
  if (s.mode === 0) novaEscortFireUnprovoked(w, s);
  const vel = () => novaDeg(novaBearing(0, 0, f32(s.vx * 100), f32(s.vy * 100)));
  // 1: braking: turned against the velocity, full thrust, then half thrust and 0.94 a step below 1.75, and still below 0.35
  if (s.mode === 1 && ok) {
    if (Math.abs(s.vx) < 0.35 && Math.abs(s.vy) < 0.35) {
      s.vx = f32(s.vx * 0.95); s.vy = f32(s.vy * 0.95); s.speed = f32(s.speed * 0.95); s.mode = 0;
    } else if (novaInertialess(s)) s.thrust = f32(novaShipAccel(D, s) * -0.5);
    else {
      s.want = (vel() + 180) % 360;
      if (novaLinedUp(s, 1)) {
        if (Math.abs(s.vx) >= 1.75 || Math.abs(s.vy) >= 1.75) s.thrust = novaShipAccel(D, s);
        else { s.thrust = f32(novaShipAccel(D, s) * 0.5); s.vx = f32(s.vx * 0.94); s.vy = f32(s.vy * 0.94); s.speed = f32(s.speed * 0.94); }
      } else if (s.state === 9) { s.vx = f32(s.vx * 0.94); s.vy = f32(s.vy * 0.94); s.speed = f32(s.speed * 0.94); }
    }
    novaEscortFireUnprovoked(w, s);
  }
  // 2: to a stellar: thrust once lined up within 5 degrees past the turn rate, at a quarter of top speed within 500
  if (s.mode === 2 && s.sec >= 128 && ok) {
    const sp = D.u.stellars.get(s.sec);
    s.want = novaBearing(s.x, s.y, sp.xPos, sp.yPos);
    if (novaLinedUp(s, 5)) {
      s.thrust = novaShipAccel(D, s);
      const near = Math.abs(f32(s.x - sp.xPos)) < 500 && Math.abs(f32(s.y - sp.yPos)) < 500;
      s.desired = near ? f32(novaShipMaxSpeed(D, s) * 0.25) : 0;
    }
  }
  // 3: away from the middle
  if (s.mode === 3 && ok) {
    s.want = novaBearing(0, 0, s.x, s.y);
    if (novaLinedUp(s, 3)) { s.thrust = novaShipAccel(D, s); s.desired = 0; }
  }
  // 4: the jump: straight out from the middle; gone once the warp sound's length over the class's pace has passed
  if (s.mode === 4 && ok) {
    s.want = novaBearing(0, 0, s.x, s.y);
    if (s.jump <= 0) { s.jump = 1; s.jumpStart = novaNow(w); }
    if (s.jump > 1 && s.jumpStart > novaNow(w)) s.jumpStart = novaNow(w);
    s.jump = f32(s.jump + 1);
    if (novaNow(w) - s.jumpStart >= f32(D.jumpTicks / s.cls.jumpPace)) { novaGone(w, s, 'jump'); return; }
  }
  // 13: going with the lead's jump: alongside it while it is not jumping; turned with it, then stopped and counting, and off on its own after 30
  if (s.mode === 0xd && ok) {
    const lead = w.ships[s.leader];
    if (lead) {
      s.want = Math.trunc(lead.heading);
      if (lead.jump <= 1) { s.vx = lead.vx; s.vy = lead.vy; novaKeepFormation(w, s, false); s.glow = lead.glow; }
      else {
        if (s.jump > 1 && s.jumpStart > novaNow(w)) s.jumpStart = novaNow(w);
        if (s.jump > 30 && s.leader !== 0) {
          Object.assign(s, { leader: -1, follows: -1, want: lead.want, state: 2, mode: 4, ai: s.cls.ai });
        }
        const d = novaAngleApart(Math.trunc(lead.heading), lead.want);
        if (d > 10) { if (d > novaShipTurn(s)) { s.jump = -1; s.want = lead.want; } else s.timer = 180; }
        else {
          s.sec = lead.sec;
          if (s.jump === 0) { s.jump = 1; s.jumpStart = novaNow(w); }
          s.vx = f32(s.vx * 0.95); s.vy = f32(s.vy * 0.95);
          s.thrust = 0; s.desired = -1; s.jump = f32(s.jump + 1);
        }
      }
    }
  }
  novaLowAttack(w, s);
  // 11 and 9: toward the lead (or the ship being looked at): straight at it beyond 200, else steering the velocity onto it; 11 at half speed within 100
  if ((s.mode === 0xb || s.mode === 9) && (s.primary !== -1 || s.sec !== -1) && ok) {
    const t = w.ships[s.primary >= 0 ? s.primary : s.sec];
    if (t) {
      const b = novaBearing(s.x, s.y, t.x, t.y);
      if (Math.abs(f32(s.x - t.x)) > 200 || Math.abs(f32(s.y - t.y)) > 200) s.want = b;
      else if (Math.abs(vel() - b) > 15) {
        const p = { x: 0, y: 0 }; novaAccel(b, novaShipMaxSpeed(D, s), p);
        const dvx = f32(p.x - s.vx), dvy = f32(p.y - s.vy);
        if (Math.abs(dvx) > 0.35 || Math.abs(dvy) > 0.35) s.want = novaBearing(0, 0, dvx, dvy);
      }
      if (novaLinedUp(s, 1)) {
        s.thrust = novaShipAccel(D, s);
        s.desired = s.mode === 0xb && Math.abs(f32(s.x - t.x)) <= 100 && Math.abs(f32(s.y - t.y)) <= 100 ? f32(novaShipMaxSpeed(D, s) * 0.5) : 0;
      }
    }
    novaEscortFireUnprovoked(w, s);
  }
  // 12: velocity matched to the lead, turning onto its heading a degree a step within 25 / skill, and keeping formation; else braking on the difference
  if (s.mode === 0xc && s.sec !== -1 && ok) {
    const t = w.ships[s.sec];
    if (t) {
      const rx = f32(s.vx - t.vx), ry = f32(s.vy - t.vy);
      if (novaInertialess(s) || (Math.abs(rx) < 0.525 && Math.abs(ry) < 0.525)) {
        s.vx = t.vx; s.vy = t.vy;
        const d = novaAngleApart(Math.trunc(s.heading), Math.trunc(t.heading)), win = s.skill > 0 ? Math.trunc(25 / s.skill) : 25;
        if (d > 0 && win > d) {
          let diff = Math.trunc(f32(s.heading - t.heading));
          if (diff >= 360) diff -= 360;
          if (diff <= -1) diff += 360;
          s.want = (Math.trunc(s.heading) + (diff > 180 ? 1 : -1) + 360) % 360;
        } else s.want = Math.trunc(t.heading);
        novaKeepFormation(w, s, false);
        s.glow = t.glow;
      } else {
        s.want = (novaBearing(0, 0, f32(rx * 100), f32(ry * 100)) + 180) % 360;
        if (novaLinedUp(s, 1)) { s.thrust = f32(novaShipAccel(D, s) * 0.66); s.desired = 0; }
        if (Math.abs(rx) <= 1.75 || Math.abs(ry) <= 1.75) { s.vx = f32(t.vx + f32(rx * 0.95)); s.vy = f32(t.vy + f32(ry * 0.95)); }
      }
    }
    novaEscortFireUnprovoked(w, s);
  }
  // 8: a fighter landing: at its carrier, aimed at it, and drawn ten times its thrust a step closer on each axis; aboard once within its sprite's width
  if (s.mode === 8) {
    const c = s.sec !== -1 ? w.ships[s.sec] : null;
    if (s.sec === -1 || novaDying(s) || s.disabled) { s.state = 0; s.mode = 0; }
    else if (!c) { s.state = 0; s.ai = s.cls.ai; }
    else {
      s.want = novaBearing(s.x, s.y, c.x, c.y);
      if (novaLinedUp(s, 1)) { s.thrust = novaShipAccel(D, s); s.desired = 0; }
      const r = c.cls.width > 0 ? c.cls.width : 0;
      if (Math.abs(f32(c.x - s.x)) <= r && Math.abs(f32(c.y - s.y)) <= r) { novaFighterAboard(w, s); return; }
      const step = f32(novaShipAccel(D, s) * 10), L = w.ships[s.leader] || c;
      if (!(f32(L.x - step) < s.x)) s.x = f32(s.x + step); else if (f32(L.x + step) <= s.x) s.x = f32(s.x - step);
      if (!(f32(L.y - step) < s.y)) s.y = f32(s.y + step); else if (f32(L.y + step) <= s.y) s.y = f32(s.y - step);
      s.desired = f32(s.desired - step);
    }
  }
  // 19: making for the first asteroid
  if (s.mode === 0x13) {
    const a = w.roids[0];
    s.want = novaBearing(s.x, s.y, a.x, a.y);
    if (novaLinedUp(s, 15)) s.thrust = novaShipAccel(D, s);
  }
  // 20: mining it: velocity matched to it 1.5 times the thrust a step on each axis, kept within 150 of it and out of 80, aimed with the lead its weapon needs, and firing when lined up
  if (s.mode === 0x14) {
    const a = w.roids[0], f = f32(novaShipAccel(D, s) * 1.5);
    const toward = (v, t) => (v < f32(f + t) ? (f32(t - f) < v ? t : f32(v + f)) : f32(v - f));
    s.vx = toward(s.vx, a.vx); s.vy = toward(s.vy, a.vy);
    const pull = (p, t) => (p <= f32(t + 150) ? (p < f32(t - 150) ? f32(f + p) : p) : f32(p - f));
    const x = pull(s.x, a.x), y = pull(s.y, a.y);
    s.x = x; s.y = y;
    if (x > a.x && x < f32(a.x + 80)) s.x = f32(x + f); else if (x < a.x && x > f32(a.x - 80)) s.x = f32(x - f);
    if (y > a.y && y < f32(a.y + 80)) s.y = f32(y + f); else if (y < a.y && y > f32(a.y - 80)) s.y = f32(y - f);
    s.want = novaObjectLeadAngle(s, a, { x: a.vx, y: a.vy }, s.lastW !== -1 ? novaWeapOf(D, s.lastW) : null);
    if (novaLinedUp(s, 10)) { s.primary = -1; novaFireGunUntargeted(w, s); }
  }
  // 21: to the nearest box, braking 1.75 times the thrust a step on each axis while turning onto it
  if (s.mode === 0x15) {
    let best = -1, bd = 0;
    if (w.boxes) for (let i = 0; i < 64; i++) {
      const b = w.boxes[i];
      if (!b || !(b.life > 0) || !b.on) continue;
      const d = Math.trunc(novaDist2(s.x, s.y, b.x, b.y));
      if (d < bd || best === -1) { best = i; bd = d; }
    }
    if (best === -1) s.mode = 0;
    else {
      const b = w.boxes[best];
      s.want = novaBearing(s.x, s.y, b.x, b.y);
      if (!novaLinedUp(s, 15)) {
        const f = f32(novaShipAccel(D, s) * 1.75), stop = v => (v < f ? (-f < v ? 0 : f32(v + f)) : f32(v - f));
        s.vx = stop(s.vx); s.vy = stop(s.vy);
      } else s.thrust = novaShipAccel(D, s);
    }
  }
  // 10: arriving
  if (s.mode === 10) { if (s.desired >= 0) s.desired = -50; s.thrust = f32(-1.165); }
}

/* ---- asteroids ------------------------------------------------------------ */

/* The asteroids are the player's: the program keeps up to the system's
   Asteroids of them, of the röid types its AstTypes names, in a pool of 16,
   on and just off the player's screen. Here the map's view stands in for
   that screen: w.view is its middle in the system's units and its half
   width and height (screenCenter), set by the page; a node check sets its
   own.

   CreateAsteroids 0x3fa05, on arriving: as many as the system has, then
   all 16 places scattered over the middle of the screen, (half + 128) wide
   and high, drifting up to 2 a step either way. */
function novaCreateAsteroids(w) {
  const n = w.sys.rec.Asteroids;
  w.noRoids = !(n > 0);
  if (w.noRoids) return;
  for (let i = 0; i < n; i++) novaSpawnAsteroid(w, false);
  const v = w.view, W = Math.trunc(v.hw) + 128, H = Math.trunc(v.hh) + 128;
  for (const a of w.roids) {
    a.x = f32(f32(v.x + w.rand(W)) + W * -0.5); a.y = f32(f32(v.y + w.rand(H)) + H * -0.5);
    a.vx = f32((w.rand(400) - 200) * 0.01); a.vy = f32((w.rand(400) - 200) * 0.01);
  }
}
/* SpawnAsteroid 0x3a233, each step (`edge`) and on arriving: while fewer
   are about than the system's Asteroids, one more in the first free
   place, off a corner of the screen -- 0.7 of the larger of (half + 128)
   out, and up to half that again, each way, drifting in at up to 2 a step
   -- or, on arriving, anywhere in the middle; of a type the system names,
   on a random frame, turning at 80 to 120% of its röid's SpinRate either
   way. */
function novaSpawnAsteroid(w, edge) {
  const rec = w.sys.rec, n = rec.Asteroids, types = rec.AstTypes & 0xffff;
  if (!(n > 0) || !types) return;
  if (n <= w.roids.filter(a => a.active).length) return;
  const a = w.roids.find(r => !r.active);
  if (!a) return;
  a.active = true;
  const v = w.view, W = Math.trunc(v.hw) + 128, H = Math.trunc(v.hh) + 128;
  if (edge) {
    const r = Math.max(2, f32(Math.max(W, H) * 0.7)), far = () => w.rand(Math.trunc(f32(r * 0.5)));
    if (w.rand(2) === 0) { a.x = f32(f32(r + v.x) + far()); a.vx = f32(w.rand(200) * -0.01); }
    else { a.x = f32(f32(v.x - r) - far()); a.vx = f32(w.rand(200) * 0.01); }
    if (w.rand(2) === 0) { a.y = f32(f32(r + v.y) + far()); a.vy = f32(w.rand(200) * -0.01); }
    else { a.y = f32(f32(v.y - r) - far()); a.vy = f32(w.rand(200) * 0.01); }
  } else {
    a.x = f32(f32(v.x + w.rand(W)) + W * -0.5); a.y = f32(f32(v.y + w.rand(H)) + H * -0.5);
    a.vx = f32((w.rand(400) - 200) * 0.01); a.vy = f32((w.rand(400) - 200) * 0.01);
  }
  do a.type = w.rand(16); while (!((types >> a.type) & 1));
  const t = w.D.roids[a.type];
  a.frame = w.rand(t.frames);
  a.spin = f32(f32(t.spin * (w.rand(41) + 80)) * 0.01);
  if (w.rand(2) === 0) a.spin = -a.spin;
  a.strength = t.strength;
}
/* HandleAsteroids 0x361ac: with a miner about, the first asteroid kept in
   the first place, its target; each moved and turned, and gone once more
   than 32 pixels off the screen past its own width -- the program puts it
   back on the far side first, but takes it away all the same, and one
   comes in again at a corner. */
function novaHandleAsteroids(w) {
  const R = w.roids, D = w.D;
  if (w.miners && !R[0].active) { const i = R.findIndex(a => a.active); if (i > 0) { Object.assign(R[0], R[i]); R[i] = { active: false }; } }
  if (w.noRoids) { for (const a of R) a.active = false; return; }
  const v = w.view;
  for (const a of R) {
    if (!a.active) continue;
    if (!(a.strength > -32000)) { a.active = false; continue; }
    const t = D.roids[a.type];
    a.x = f32(a.x + a.vx); a.y = f32(a.y + a.vy); a.frame = f32(a.frame + a.spin);
    if (a.frame < 0) a.frame = f32(a.frame + t.frames);
    if (a.frame >= t.frames) a.frame = f32(a.frame - t.frames);
    if (!(a.frame >= 0 && a.frame < t.frames)) a.frame = 0;   // the sprite arrived after the asteroid did
    const left = Math.trunc(f32(a.x - v.x)) + Math.trunc(v.hw) - Math.trunc(t.w / 2);
    const top = Math.trunc(f32(a.y - v.y)) + Math.trunc(v.hh) - Math.trunc(t.h / 2);
    if (left > 2 * Math.trunc(v.hw) + 32 || left < -2 * t.w - 32 || top > 2 * Math.trunc(v.hh) + 32 || top < -2 * t.h - 32) a.active = false;
  }
}

/* ---- how they move ------------------------------------------------------ */

// HandleShip 0x33581, for a ship nothing has hit.
function novaHandleShip(w, s) {
  const D = w.D, c = s.cls;
  if (s.disabled) {
    s.vx = f32(s.vx * 0.995); s.vy = f32(s.vy * 0.995); s.speed = f32(s.speed * 0.995);
    // ShipCanSelfRepair: a draw of 500 a step while disabled, and on 0 a ship not dying with a repairing outfit is back to just over its threshold
    if (s.leader !== 0 && w.rand(500) === 0 && !(s.death > 0 || s.armor <= 0) && c.selfRepair) {
      s.armor = f32(novaArmorCap(D, s) * ((c.flags & 0x10) ? 0.1 : 0.3333) + 1); novaSetDisabled(D, s);
    }
  }
  // cloaked: no longer able, uncloaking; the cloak's fuel and shields spent, a thirtieth of its rate a step
  if (novaCloaked(s)) {
    if (!novaCanCloak(s)) novaUncloak(s);
    const fuel = (c.cloak >> 4) & 0xf, sh = (c.cloak >> 8) & 0xf;
    if (fuel > 0) { s.fuel = f32(s.fuel + fuel * -0.03333); if (s.fuel <= 0) s.fuel = 0; }
    if (sh > 0 && sh <= s.shield) { s.shield = f32(s.shield + sh * -0.03333); if (s.shield <= 0) s.shield = 0; }
  }
  if (c.accel === 0 && c.speed === 0) s.vx = s.vy = 0;
  else {
    if (novaInertialess(s)) novaSteerInertialess(D, s);
    s.x = f32(s.x + s.vx); s.y = f32(s.y + s.vy);
  }
  // ionized: the ionization down by the class's Deionize, and each axis of the velocity over the top speed less by the factor (at most 0.7) eased back by 0.025
  if (!(s.ion > 0)) s.ion = 0;
  else {
    s.ion = f32(s.ion - c.deion);
    const f = novaIonFactor(s), cap = f32(novaShipMaxSpeed(D, s) * f32(1 - (f > 0.7 ? f32(0.7) : f))), neg = -cap;
    for (const k of ['vx', 'vy']) {
      if (cap < s[k]) s[k] = f32(s[k] - 0.025);
      if (s[k] < neg) s[k] = f32(s[k] + 0.025);
    }
  }
  let dir = 0;
  if (!s.disabled && s.timer <= 0) {
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
  // the jump's run-up, once lined up: pushed along the heading (elapsed x pace / (sound length x 0.01)) - 35 / pace a step, at most 50
  if (s.jump > 0 && !s.disabled) {
    if (novaShipTurn(s) >= novaAngleApart(Math.trunc(s.heading), s.want)) {
      if (novaJumping(s)) {
        s.vx = f32(s.vx * 0.95); s.vy = f32(s.vy * 0.95);
        if (s.leader !== -1 && w.ships[s.leader]) s.want = w.ships[s.leader].want;
        const pace = c.jumpPace;
        let p = f32((novaNow(w) - s.jumpStart) * pace / (D.jumpTicks * 0.01) + (-35 / pace));
        if (p > 50) p = 50;
        if (p > 0) {
          const v = { x: s.x, y: s.y }; novaAccel(Math.trunc(s.heading), f32(p), v); s.x = v.x; s.y = v.y;
          if (s.glow <= 31) s.glow = Math.min(32, s.glow + 3);
        }
      } else s.jump = 0;
    } else s.jumpStart = novaNow(w);
  }
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
  /* A tractor beam's hold lapses with its holder gone, disabled or dying, or
     30 ticks after it last held (the velocity matching while held is to
     the player's thrust, so is not done here). */
  if (s.tractor !== -1) {
    const h = w.ships[s.tractor];
    if (s.tractor !== s.slot && (!h || h.disabled || novaDying(h))) { s.tractor = -1; s.tractorAt = 0; }
    if (s.tractorAt + 30 <= novaNow(w)) s.tractor = -1;
  }
  /* A ship dying, half through its death throes, with an escape ship in a
     bay (a class of Flags 0x8000): one chance in three it gets away, with
     some of its shields and half its speed; then the bays are empty. */
  if (novaDying(s) && s.death <= f32(novaClassFight(D, c).deathDelay * 0.5)) {
    const bay = s.weap.find(r => { const W = novaWeapOf(D, r.i), e = W && W.guid === 99 && r.ammo > 0 && D.classes.get(W.ammoType); return e && (e.flags & 0x8000); });
    if (bay) {
      if (w.rand(3) === 0) {
        const f = novaLaunchFighter(w, s, bay.i);
        if (f) { if (f.shield > 1) f.shield = f32(w.rand(Math.trunc(f.shield))); f.vx = f32(f.vx * 0.5); f.vy = f32(f.vy * 0.5); }
      }
      for (const r of s.weap) { r.count = 0; r.ammo = 0; }
    }
  }
  // gone into a gate once its 16 steps are down to under one (HandleShipDisplay 0x2bfa5)
  if (s.mode === 0x17 && s.timer < 1) novaGone(w, s, 'gate');
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
    s.sec = -1; s.jump = 0; s.thrust = 0; s.desired = 0;
    if (inert) { s.vx = s.vy = 0; s.desired = m; }
    if (s.leader === -1) s.timer = w.rand(30) + 30;
  }
}

/* The hypergates a ship is coming out of or bound for (HandleStellarSprites
   0x2e6f1, AIShipIsShipGoingToStellar 0x895d6), which open as for a ship
   near: one bound for it within twice its sprite's width on both axes, 1.1
   times that once the gate is open (`isOpen`, the page's to say). */
function novaFlightEngaged(w, isOpen) {
  const out = new Set();
  for (const s of w.ships) if (s && !s.disabled) {
    if (s.state === 0x15 && s.gate >= 128) out.add(s.gate);
    if ((s.state === 0x14 || s.state === 1) && s.sec >= 128) {
      const sp = w.D.u.stellars.get(s.sec);
      if (sp && (sp.Flags2 & 0x1000)) {
        let r = 2 * novaStellarWidth(w.D, sp);
        if (isOpen && isOpen(sp.id)) r = Math.trunc(r * 1.1);
        if (r > Math.abs(f32(s.x - sp.xPos)) && r > Math.abs(f32(s.y - sp.yPos))) out.add(sp.id);
      }
    }
  }
  return out;
}

/* The sprite frame a ship shows (HandleShipDisplay 0x2b58f): its heading in
   FramesPer steps, in the set its shän's Flags say -- banking (0x01), the
   second set turning left and the third right; cycling every AnimDelay
   (0x08) -- and the first set otherwise; a ship that folds (0x02) shows the
   set its folding has reached (novaFoldStep). Called once a step. */
function novaShipFrame(s) {
  const c = s.cls;
  let set = 0;
  if (c.shanFlags & 0x01) set = s.bankDir > 0 ? 2 : s.bankDir < 0 ? 1 : 0;
  else if (c.shanFlags & 0x02) set = s.foldFrame;
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
