/* nova-elder-fight.js -- ships fighting, as Escape Velocity 1.0.5 and
   EV Override 1.0.2 have them fight.
   =========================================================================

   The two older games' fight, read from their PowerPC programs. Each
   comment cites the routine it follows by its address in Escape Velocity
   1.0.5, and where Override 1.0.2 differs the comment gives the
   difference and Override's address.

   It is an arena and no more: ships of two sides in empty space. There is
   no player (slot 0 stays empty and the ships have slots 1 to 35), no
   planet, asteroid, mission, person or jump, the game speed is 1 and a
   second has 30 frames. Every branch about those is left out. Left out
   with them, because the arena has w.noRetreat always: fleeing and leaving
   (a trader shot at does nothing, and the test at 0x108fb4 that sends a
   warship after a fleeing ship is false for every ship here), and escape
   pods, which need a person aboard.

   The program's random numbers are not reproduced: the draws are made in
   the program's order from this site's generator. No run of the program
   was compared with this, so a fight here follows the rules and is no
   frame for frame copy.

   Places have x to the right and y down, and a heading is in whole degrees
   clockwise from up, as the program has them.

   GENERIC TO THE OLDER GAMES, NO DOM. LOAD ORDER: after nova-flight.js. */

const ELDER_SLOTS = 36, ELDER_SHOTS = 128, ELDER_BEAMS = 8, ELDER_BOOMS = 16, ELDER_POD = 63;
const ELDER_BOOM_FRAMES = [7, 14, 28];

/* ---- the records ---------------------------------------------------------- */

/* The records a fight reads, as the loader (0x123844) stores them: record
   128 + i at index i, a ship's Accel over 10000 and Speed over 100, a
   weapon's Speed over 100, a Shield below 0 times -5 and a Shield of 0 as
   1, and a government's Ally and Enemy minus 128. A ship's sprite is spïn
   128 + i and a weapon's is spïn 200 + Graphic. Override's loader
   (0x115e70) also stores a ship's Flags, ShotXOffset, FuelRegen and
   SkillVar (from 1 to 50, and 10 for a record without one), a
   weapon's Seeker and Decay and a government's InherentJam, and it turns
   a weapon of Guidance 2 into one of Guidance 1 with Seeker 0x30fe. */
function elderFightData(game) {
  const D = { kind: game.kind(), evo: game.kind() === 'evo', game, elder: true, ships: [], weaps: [], govts: [], classes: new Map(), framesPer: 36 };
  const size = id => { const r = novaGet(game, 'spïn', id); return r && r.xSize > 0 && r.ySize > 0 ? { w: r.xSize, h: r.ySize } : { w: 0, h: 0 }; };
  for (let i = 0; i < 64; i++) {
    const r = novaGet(game, 'shïp', 128 + i);
    if (!r) { D.ships.push(null); continue; }
    const s = size(128 + i), name = novaNameParts(r.name).name;
    const c = { index: i, id: r.id, name, rec: r, w: s.w, h: s.h,
                Shield: r.Shield < 0 ? r.Shield * -5 : r.Shield === 0 ? 1 : r.Shield, Armor: r.Armor,
                Accel: r.Accel / 10000, Speed: r.Speed / 100, Maneuver: r.Maneuver, Fuel: r.Fuel, ShieldRe: r.ShieldRe,
                WeapType: r.WeapType.map(t => t - 128), WeapCount: r.WeapCount.slice(), AmmoLoad: r.AmmoLoad.slice(),
                DeathDelay: r.DeathDelay, TurretYDisp: r.TurretYDisp.slice(), Mass: r.Mass, InherentAI: r.InherentAI,
                Flags: r.Flags | 0, ShotXOffset: r.ShotXOffset | 0, FuelRegen: r.FuelRegen | 0,
                SkillVar: r.SkillVar === undefined ? 10 : Math.max(1, Math.min(50, r.SkillVar)) };
    D.ships.push(c);
    D.classes.set(r.id, { id: r.id, index: i, name, rec: r, sprite: 128 + i, framesPer: 36, ai: r.InherentAI, speed: c.Speed, flags: 0, missing: !s.w, cls: c });
  }
  for (let i = 0; i < 64; i++) {
    const r = novaGet(game, 'wëap', 128 + i);
    if (!r) { D.weaps.push(null); continue; }
    const s = r.Graphic >= 0 ? size(200 + r.Graphic) : { w: 0, h: 0 };
    const missile = D.evo && r.Guidance === 2;
    D.weaps.push({ index: i, id: r.id, name: novaNameParts(r.name).name, rec: r, w: s.w, h: s.h,
                   Reload: r.Reload, Count: r.Count, MassDmg: r.MassDmg, EnergyDmg: r.EnergyDmg, Guidance: missile ? 1 : r.Guidance, Speed: r.Speed / 100,
                   Seeker: missile ? 0x30fe : r.Seeker & 0xffff, Decay: r.Decay | 0,
                   AmmoType: r.AmmoType, Graphic: r.Graphic, Inaccuracy: r.Inaccuracy, Impact: r.Impact, ExplodType: r.ExplodType,
                   ProxRadius: r.ProxRadius, BlastRadius: r.BlastRadius, MiscFlags: r.MiscFlags });
  }
  for (let i = 0; i < 128; i++) {
    const r = novaGet(game, 'gövt', 128 + i);
    D.govts.push(r ? { index: i, id: r.id, name: novaNameParts(r.name).name, rec: r, Flags: r.Flags, InherentJam: r.InherentJam & 0xffff, Ally: r.Ally < 0 ? -1 : r.Ally - 128, Enemy: r.Enemy < 0 ? -1 : r.Enemy - 128 } : null);
  }
  return D;
}

/* ---- the sums --------------------------------------------------------------- */

const elderSin = a => Math.sin(a * Math.PI / 180), elderCos = a => Math.cos(a * Math.PI / 180);
const elderWrap = a => ((a % 360) + 360) % 360;
const elderSign = v => (v > 0) - (v < 0);

/* The whole-degree heading from one place to another (0x1602a8): the
   shorter side over the longer as a whole hundredth, 1023 at most, its
   arc tangent cut to a whole degree and counted from the nearer axis. */
function elderAngle(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, adx = Math.abs(dx), ady = Math.abs(dy);
  if (adx === 0 && ady === 0) return 0;
  const steep = adx <= ady;
  const a = Math.trunc(Math.atan(Math.min(1023, Math.trunc(100 * (steep ? adx / ady : ady / adx))) / 100) * 180 / Math.PI);
  let h;
  if (dy < 0) h = dx >= 0 ? (steep ? a : 90 - a) : (steep ? 360 - a : 270 + a);
  else h = dx >= 0 ? (steep ? 180 - a : 90 + a) : (steep ? 180 + a : 270 - a);
  return elderWrap(h);
}
const elderAngleOf = (vx, vy) => elderAngle(0, 0, 100 * vx, 100 * vy);
const elderBearing = (a, b) => elderAngle(a.x, a.y, b.x, b.y);

/* A push on a velocity (0x160534): the push along the heading is added on
   each axis unless the velocity there is already at the limit's share of
   that axis and the push is the same way. */
function elderThrust(o, angle, accel, cap) {
  const s = elderSin(angle), c = elderCos(angle), ax = s * accel, ay = -c * accel;
  if (!(Math.abs(o.vx) >= Math.abs(s * cap) && elderSign(o.vx) === elderSign(ax))) o.vx += ax;
  if (!(Math.abs(o.vy) >= Math.abs(c * cap) && elderSign(o.vy) === elderSign(ay))) o.vy += ay;
}

/* What a ship can do. A computer's ship has its class's Speed and a
   quarter more, twice its Accel and a shield that gains every
   ShieldRe x 0.65 frames, and a ship in a tractor beam has a third of its
   turn and speed (TurnRate 0x165d80, TopSpeed 0x165e34, Accel 0x165f24,
   ShieldTicks 0x165fd4). In Override (0x15a27c, 0x15a59c, 0x15a40c) the
   Speed has no quarter more, Speed and Accel are times the ship's skill,
   a number drawn at its making within SkillVar hundredths of 1 (0x1616c8),
   a held ship has a third of its Accel too, and a class that turns at all
   turns 1 at least. */
const elderTurnRate = s => {
  const r = s.held ? Math.trunc(s.c.Maneuver * 0.333) : s.c.Maneuver;
  return s.evo && s.c.Maneuver >= 1 && r < 1 ? 1 : r;
};
const elderTopSpeed = s => s.evo ? s.c.Speed * s.skill * (s.held ? 0.333 : 1) : s.c.Speed * 1.25 * (s.held ? 0.333 : 1);
const elderAccel = s => s.evo ? s.c.Accel * s.skill * (s.held ? 0.333 : 2) : s.c.Accel * 2;
const elderShieldTicks = s => Math.max(1, Math.trunc(s.c.ShieldRe * 0.65));
/* Disabled with over a third of the armor gone, and dead with all of it
   gone or its death begun (IsDisabled 0x165a2c, IsDead 0x165ad8). The one
   number sa is the shield left, and below 0 the armor lost. In Override
   (0x159c58) a class with flag 0x0010 is disabled with over nine tenths
   gone, and every ship of a government with flag 0x0800 is disabled. */
const elderDisabled = s => s.derelict || (s.sa < 0 && s.sa * 100 < (s.evo && (s.c.Flags & 0x10) ? -90 : -33.333) * s.c.Armor);
const elderDead = s => s.dying > 0 || (s.sa < 0 && s.sa < -s.c.Armor);
const elderShieldCap = (D, s) => s.c.Shield, elderArmorCap = (D, s) => s.c.Armor;
const elderShipFrame = s => Math.min(35, Math.max(0, Math.trunc(s.heading / 10)));

/* ---- the world -------------------------------------------------------------- */

function elderWorld(D, seed) {
  const gen = novaRandom(seed || 1);
  const w = { D, elder: true, slots: new Array(ELDER_SLOTS).fill(null), ships: [], shots: [], beams: [], booms: [], gone: [],
              frame: 0, cursor: 0, noRetreat: true, noArrivals: true, kills: 0, rng: gen,
              rand: n => n > 0 ? gen.rand(Math.trunc(n)) : 0 };
  for (let i = 0; i < ELDER_SHOTS; i++) w.shots.push({ life: -2 });
  for (let i = 0; i < ELDER_BEAMS; i++) w.beams.push({ life: D.evo ? -2 : -1 });
  return w;
}

const elderShip = (w, i) => i > 0 ? w.slots[i] : null;

/* A new ship (0x11a2ac): its class's weapons, the ammunition x 1.75 but a
   bay's fighters as the class has them, a full shield and full fuel. The
   government is its index, -1 for none. Gives null with every slot
   full. Override (0x165530) draws the ship's skill, and a class with flag
   0x0040 makes passes at its target (0x1610c0). */
function elderPlaceShip(w, cls, govt, x, y, ai, facing) {
  const c = cls.cls || cls, D = w.D;
  let slot = 0;
  for (let i = 1; i < ELDER_SLOTS && !slot; i++) if (!w.slots[i]) slot = i;
  if (!slot) return null;
  const s = {
    slot, cls: D.classes.get(c.id), c, x, y, vx: 0, vy: 0, heading: elderWrap(Math.trunc(facing || 0)), want: 0,
    ai: ai || c.InherentAI, govt, leader: -1, target: -1, other: -1, weapon: -1, turret: 0, board: -1,
    state: 0, act: 0, wait: 0, hurt: 0, dying: 0, sa: c.Shield, fuel: c.Fuel,
    wasDisabled: false, firing: false, held: false, incoming: 0, thrust: 0, cap: 0, weap: [],
    evo: D.evo, skill: 1, pass: D.evo && !!(c.Flags & 0x40), side: 0, dodge: 0,
    derelict: D.evo && !!(D.govts[govt] && D.govts[govt].Flags & 0x800),
    get primary() { return this.target; },
    get shield() { return Math.max(0, this.sa); },
    get armor() { return Math.max(0, this.c.Armor + Math.min(0, this.sa)); },
    get disabled() { return elderDisabled(this); },
    get frame() { return elderShipFrame(this); },
  };
  s.want = s.heading;
  for (let i = 0; i < 64; i++) s.weap.push({ i, count: 0, ammo: 0, reload: 0 });
  for (let k = 0; k < 4; k++) {
    const i = c.WeapType[k], wp = D.weaps[i];
    if (!wp || c.WeapCount[k] <= 0) continue;
    s.weap[i].count = c.WeapCount[k];
    s.weap[i].ammo = wp.Guidance !== 99 ? Math.trunc(1.75 * c.AmmoLoad[k]) : c.AmmoLoad[k];
  }
  if (D.evo) s.skill = 0.01 * (100 - c.SkillVar + w.rand(2 * c.SkillVar + 1));
  s.nerve = 1 << w.rand(3);
  w.slots[slot] = s;
  w.ships = w.slots.filter(Boolean);
  return s;
}

function elderRemove(w, s, how) {
  w.slots[s.slot] = null;
  w.ships = w.slots.filter(Boolean);
  s.leader = -1;
  w.gone.push({ ship: s, how });
}

/* ---- sides ------------------------------------------------------------------ */

/* Whether government a's ships attack government b's (0x107de8), by their
   indexes. The two are enemies when either has the other as its Enemy.
   Every ship is against a government whose flag 0x0001 is set, except an
   ally. And the enemies of a's allies are a's. */
function elderGovtHostile(D, a, b) {
  if (a < 0 || b < 0 || a === b) return false;
  const A = D.govts[a], B = D.govts[b];
  if (!A || !B) return false;
  if (A.Enemy === b || B.Enemy === a) return true;
  if ((B.Flags & 0x1) && A.Ally !== b && B.Ally !== a) return true;
  for (const R of D.govts) if (R && (R.Ally === a || R.index === A.Ally) && R.Enemy === b) return true;
  return false;
}
const elderHostile = (w, a, b) => !!a && !!b && a !== b && elderGovtHostile(w.D, a.govt, b.govt);

/* Picking a ship to attack (0x1063d0). A ship of a government with flag
   0x0001 draws slots at random until the slot drawn has an enemy that is
   neither disabled nor dying. Every other ship, and that one when no such
   enemy is there, attacks the first enemy in the slots that is not
   disabled. */
function elderPick(w, s) {
  if (elderShip(w, s.target)) return;
  const G = w.D.govts[s.govt];
  if (!G) return;
  if (G.Flags & 0x1) {
    const ok = o => o && o !== s && !elderDead(o) && o.c.index !== ELDER_POD && !elderDisabled(o) && o.leader !== s.slot && elderHostile(w, s, o);
    if (w.slots.some(ok)) {
      for (;;) { const o = w.slots[w.rand(ELDER_SLOTS)]; if (ok(o)) { s.target = o.slot; return; } }
    }
  }
  for (let i = 1; i < ELDER_SLOTS; i++) {
    const o = w.slots[i];
    if (o && o !== s && !elderDisabled(o) && elderHostile(w, s, o)) { s.target = i; return; }
  }
}

/* ---- the AI ------------------------------------------------------------------ */

const elderNear = (a, b, r) => Math.abs(a.x - b.x) <= r && Math.abs(a.y - b.y) <= r;

/* A ship beginning an attack (0x109728): one of a government with flag
   0x1000 goes to disable a ship of AI type 1 or 2 and stop beside it,
   once for each such ship. */
function elderAttack(w, s) {
  s.state = 4;
  const t = elderShip(w, s.target), G = w.D.govts[s.govt];
  if (t && G && (G.Flags & 0x1000) && t.ai < 3 && !t.wasDisabled) s.state = 13;
}

/* One ship's turn of the AI (0x10001c): its AI type's choice of a state,
   then the state's choice of a move, then the move. */
function elderThink(w, s) {
  const dis = elderDisabled(s);
  if (s.ai === 2) {
    // 0x1005d4: AI type 2 fights the ship that hurt it while that ship is within 1250.
    const t = elderShip(w, s.target);
    if (!dis && s.state !== 9 && s.hurt > 0 && t && elderNear(s, t, 1250)) s.state = 4;
  } else if (s.ai === 3) {
    // 0x1007dc: AI type 3 picks an enemy and attacks it.
    if (!dis && s.state !== 9) {
      if (s.state === 0 && !elderShip(w, s.target)) elderPick(w, s);
      if (elderShip(w, s.target) && s.state !== 7) elderAttack(w, s);
    }
  } else if (s.ai === 4) {
    // 0x100f24: AI type 4 does as type 3 does, and with no enemy flies to a ship drawn at random.
    if (!dis && s.state !== 9) {
      if (s.hurt > 0 && elderShip(w, s.target) && s.state !== 7) s.state = 4;
      if (s.board !== -1 && !elderShip(w, s.board)) s.board = -1;
      if ((s.state === 0 || s.state === 1) && s.wait <= 0) {
        if (elderShip(w, s.target) && s.hurt > 0) s.state = 4;
        if (!elderShip(w, s.target)) {
          elderPick(w, s);
          if (elderShip(w, s.target)) s.state = 4;
        }
        if (!elderShip(w, s.target)) {
          const ok = o => o && o !== s && o.slot !== s.board && o.ai !== 4;
          if (w.slots.some(ok)) {
            for (;;) { const o = w.slots[w.rand(ELDER_SLOTS)]; if (ok(o)) { s.target = s.board = o.slot; s.state = 7; break; } }
          }
        }
        if (!elderShip(w, s.target) && s.state === 0) s.state = 6;
      }
    }
  } else if (s.ai === 5) {
    // 0x101584: a fighter attacks its target, or its carrier's, or flies home.
    if (dis) {
      if (s.leader !== -1) { s.state = 5; s.act = 0; s.other = s.leader; } else s.state = 6;
    } else {
      if (s.target >= 0 && s.target !== s.leader) s.state = 4;
      if (s.target === -1 && s.state !== 6 && s.state !== 5 && s.leader !== -1) {
        const L = elderShip(w, s.leader);
        if (!L || L.target === -1) { s.state = 5; s.other = s.leader; }
        else if (L.ai === 3 && L.target !== s.slot) { s.state = 4; s.target = L.target; }
      }
    }
  }
  elderState(w, s);
  elderAct(w, s);
}

/* The state's choice of a move (0x101d78). In Override (0x101d64) near is
   within 165 where it is 200 here, and a ship that is dodging or making a
   pass goes on with it. */
function elderState(w, s) {
  const near = w.D.evo ? 165 : 200;
  if (s.wait > 0 && s.state !== 10) return;
  if (s.target !== -1 && !elderShip(w, s.target)) s.target = -1;
  const t = elderShip(w, s.target);
  const kin = () => s.leader !== -1 && t && (s.target === s.leader || t.leader === s.leader);
  const drop = () => { s.state = 0; s.act = 0; s.target = -1; };
  if (s.state === 4) {
    if (!t || s.wait > 0) s.state = 0;
    else if (kin()) { drop(); return; }
    else if (elderDead(t)) { s.target = -1; s.hurt = 0; s.state = 0; }
    else {
      if (!elderNear(s, t, near)) { if (s.act !== 17) s.act = 7; }
      else if (s.act !== 16) s.act = 6;
      if (!elderDisabled(s)) elderLaunch(w, s);
    }
  } else if (s.state === 13) {
    if (kin()) { drop(); return; }
    if (!t) s.state = 0;
    else if (elderDisabled(t)) {
      if (t.wasDisabled && s.act !== 15) { drop(); s.other = -1; return; }
      s.other = s.target;
      const r = 300 - 30 * s.c.Maneuver;
      s.act = elderNear(s, t, r) ? 15 : elderNear(s, t, 2 * r) ? 11 : 9;
    } else {
      s.other = -1;
      if (!elderNear(s, t, near)) { if (s.act !== 17) s.act = 7; }
      else if (s.act !== 16 && s.act !== 17) s.act = 6;
    }
  } else if (s.state === 5) {
    if (s.leader !== -1) {
      s.other = s.leader;
      const L = elderShip(w, s.leader), r = 500 - 50 * s.c.Maneuver;
      s.act = L && elderNear(s, L, r) ? 8 : L ? 11 : 8;
    }
  } else if (s.state === 6) s.act = 1;
  else if (s.state === 7) {
    if (!t || s.wait > 0) { s.state = 0; s.target = -1; }
    else if (!elderNear(s, t, 180)) s.act = 9;
    else { s.state = 0; s.target = -1; }
  }
  if (s.state === 0) s.act = 0;
}

/* Whether a weapon has what a shot of it uses (0x165bf8): a round in its
   count of ammunition for an AmmoType of 0 or more, fuel for one of -1000
   or less. */
function elderHasAmmo(w, s, i) {
  const a = w.D.weaps[i].AmmoType;
  if (a >= 0) return s.weap[i].ammo > 0;
  if (a <= -1000) return s.fuel >= -a - 1000;
  return true;
}

/* The stronger of the ship's weapons that `ok` passes, against a shield
   (EnergyDmg) or armor (MassDmg), a damage of 0 or less counted as 1. */
function elderBest(w, s, t, ok) {
  let mass = -1, energy = -1, bm = 0, be = 0;
  for (let i = 0; i < 64; i++) {
    const wp = w.D.weaps[i];
    if (!wp || s.weap[i].count <= 0 || !ok(wp, s.weap[i])) continue;
    const m = wp.MassDmg <= 0 ? 1 : wp.MassDmg, e = wp.EnergyDmg <= 0 ? 1 : wp.EnergyDmg;
    if (m > bm) { bm = m; mass = i; }
    if (e > be) { be = e; energy = i; }
  }
  return t.sa >= 0 ? energy : mass;
}

/* The smaller angle between two headings (Override's 0x161064). */
const elderApart = (a, b) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d; };

/* Override's blind arcs (0x1611a4): whether a turret cannot fire at a
   target ahead (flag 0x1000 of the weapon's MiscFlags or the class's
   Flags), to the sides (0x2000) or behind (0x4000). */
function elderBlind(s, t, wp) {
  if (!s.evo) return false;
  const a = elderApart(s.heading, elderBearing(s, t)), f = wp.MiscFlags | s.c.Flags;
  return !!(f & (a <= 45 ? 0x1000 : a <= 135 ? 0x2000 : 0x4000));
}

/* The turret to fire (0x10559c). A swivel gun needs the target within 45
   degrees of ahead and a rear turret within 45 degrees of behind.
   Override (0x105c38) passes over a turret whose blind arc the target is
   in. */
function elderPickTurret(w, s) {
  const t = elderShip(w, s.target);
  if (!t) return;
  const b = elderBearing(s, t);
  const i = elderBest(w, s, t, wp => {
    const g = wp.Guidance;
    if (g !== 3 && g !== 4 && g !== 7 && g !== 8) return false;
    if (g === 7 && Math.abs(b - s.heading) % 360 > 45) return false;
    if (g === 8 && Math.abs(b - (s.heading - 180)) % 360 > 45) return false;
    if (elderBlind(s, t, wp)) return false;
    return elderHasAmmo(w, s, wp.index);
  });
  if (i >= 0) { s.weapon = i; s.firing = true; }
}

/* The forward gun to fire (0x105af4): unguided shots, forward beams and
   rockets, and a rocket with a ProxRadius only from 2.5 of it away on
   both axes. */
function elderPickForward(w, s) {
  const t = elderShip(w, s.target);
  if (!t) return;
  const i = elderBest(w, s, t, (wp, h) => {
    const g = wp.Guidance;
    if (g !== -1 && g !== 0 && g !== 6) return false;
    if (!(h.ammo > 0 || (wp.AmmoType <= -1000 && s.fuel >= -wp.AmmoType - 1000) || wp.AmmoType === -1)) return false;
    if (!elderHasAmmo(w, s, wp.index) || h.reload > 0) return false;
    if (g === 6 && wp.ProxRadius > 0 && !(Math.abs(t.x - s.x) >= 2.5 * wp.ProxRadius && Math.abs(t.y - s.y) >= 2.5 * wp.ProxRadius)) return false;
    return true;
  });
  if (i >= 0) s.weapon = i;
  if (s.weapon !== -1) s.firing = true;
}

/* Whether the shots already flying at a ship are enough (0x11fe38). */
const elderEnough = t => t.sa >= 0 ? t.incoming >= 1.05 * t.sa : t.incoming >= -1.05 * t.sa;

/* The guided weapon to fire (0x1058b8): none while enough is flying at the
   target, a torpedo only at a ship that turns 3 or less, and none from
   beyond its reach. The program compares the reach with the difference of
   the two ships' squared distances from the middle of the system, in
   whole numbers, and so does this. Override (0x105f70) has the true
   distance and a reach of 1.5 of the weapon's Speed x Count, fires no
   weapon at a ship that turns over 3 unless the weapon turns over 2 and
   has no flag 0x0008 (0x1613c0), and stops firing with none to fire. */
function elderSeekerTurn(wp) { return 1 + (wp.Seeker & 0x1000 ? 2 : 0) + (wp.Seeker & 0x2000 ? 4 : 0); }
function elderPickGuided(w, s) {
  const t = elderShip(w, s.target);
  if (w.D.evo) {
    if (!t) return;
    if (!elderEnough(t)) {
      const dx = t.x - s.x, dy = t.y - s.y, d = dx * dx + dy * dy;
      for (let i = 0; i < 64; i++) {
        const wp = w.D.weaps[i], h = s.weap[i];
        if (!wp || h.count <= 0 || !(h.ammo > 0 || h.ammo === -1) || wp.Guidance !== 1) continue;
        if (elderTurnRate(t) > 3 && ((wp.MiscFlags & 0x8) || elderSeekerTurn(wp) <= 2)) continue;
        if (!elderHasAmmo(w, s, i)) continue;
        const reach = 1.5 * wp.Speed * wp.Count;
        if (reach * reach >= 0.95 * d) { s.weapon = i; s.firing = true; return; }
      }
    }
    s.firing = false;
    return;
  }
  if (!t || elderEnough(t)) return;
  const sq = o => Math.trunc(o.x) * Math.trunc(o.x) + Math.trunc(o.y) * Math.trunc(o.y);
  const d = Math.abs(sq(s) - sq(t));
  for (let i = 0; i < 64; i++) {
    const wp = w.D.weaps[i], h = s.weap[i];
    if (!wp || h.count <= 0 || !(h.ammo > 0 || h.ammo === -1)) continue;
    if (!((wp.Guidance === 1 && elderTurnRate(t) <= 3) || wp.Guidance === 2)) continue;
    if (!elderHasAmmo(w, s, i)) continue;
    const reach = 1.75 * wp.Speed * wp.Count;
    if (reach * reach >= 0.95 * d) { s.weapon = i; s.firing = true; return; }
  }
}

/* Launching a fighter (0x105f18 and the fighter's making at 0x11c9c4): the
   first bay with a fighter left launches one when its reload is over. */
function elderLaunch(w, s) {
  if (!elderShip(w, s.target)) return;
  for (let i = 0; i < 64; i++) {
    const wp = w.D.weaps[i], h = s.weap[i];
    if (!wp || h.count <= 0 || h.ammo <= 0 || wp.Guidance !== 99) continue;
    if (h.reload > 0) return;
    s.weapon = i;
    const c = w.D.ships[wp.AmmoType - 128];
    if (!c) return;
    let facing = s.heading;
    if (wp.Inaccuracy > 0) facing += w.rand(2 * wp.Inaccuracy) - wp.Inaccuracy;
    const f = elderPlaceShip(w, c, s.govt, s.x, s.y, 5, elderWrap(facing));
    if (!f) return;
    f.vx = s.vx; f.vy = s.vy;
    f.target = s.target; f.leader = s.slot; f.wait = wp.Count;
    elderThrust(f, f.heading, wp.Speed, elderTopSpeed(f));
    const t = elderShip(w, f.target);
    if (t && (f.target === f.leader || t.leader === f.leader)) f.target = -1;
    h.reload = Math.trunc(wp.Reload / h.count);
    h.ammo -= 1;
    return;
  }
}

/* Where to point a gun so that its shot meets a moving target (0x162be4),
   for unguided shots and turrets, and for every other weapon the heading
   to the target. Override (0x15b208) aims at where the target will be,
   against the ship, after the time the shot needs for the distance now. */
function elderAim(w, s, t, i) {
  const wp = w.D.weaps[i], g = wp.Guidance;
  if (g !== -1 && g !== 4 && g !== 7 && g !== 8) return elderBearing(s, t);
  const dx = t.x - s.x, dy = t.y - s.y, vx = t.vx - s.vx, vy = t.vy - s.vy;
  if (w.D.evo) {
    const time = Math.sqrt(dx * dx + dy * dy) / wp.Speed;
    return isFinite(time) ? elderAngle(s.x, s.y, t.x + vx * time, t.y + vy * time) : elderBearing(s, t);
  }
  const a = wp.Speed * wp.Speed - vx * vx - vy * vy, b = -(dy * vy + dx * vx), c = -(dy * dy + dx * dx);
  const time = Math.abs((-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a));
  if (!isFinite(time)) return elderBearing(s, t);
  return elderAngle(s.x, s.y, t.x + t.vx * time, t.y + t.vy * time);
}

/* The move (0x103650): the heading to turn to and whether to thrust and
   fire. A ship is facing that heading when the two differ by no more than
   its turn. Override (0x10366c) adds two moves. A warship of Mass under
   200 that flies head on at a target flying head on at it, within 123,
   dodges on one draw in two: it turns 135 degrees aside, to the right in
   an even slot and the left in an odd one, at 1.5 of its Accel. And a ship
   whose class makes passes, over 82 from its target and within 30 degrees
   of facing it, flies at it at 2.75 of its Accel up to 1.8 of its speed
   until it is within 165. */
function elderAct(w, s) {
  s.thrust = 0; s.firing = false;
  if (!(s.cap < 0)) s.cap = elderTopSpeed(s);
  s.want = s.heading;
  const dis = elderDisabled(s), rate = elderTurnRate(s), accel = elderAccel(s), top = elderTopSpeed(s);
  const facing = () => Math.abs(s.want - s.heading) < rate + 1;
  const go = () => { if (facing()) { s.thrust = accel; s.cap = 0; } };
  const t = elderShip(w, s.target);
  if (s.act === 1) {
    // stopping: turn against the velocity and thrust
    if (dis) return;
    if (Math.abs(s.vx) >= 0.35 || Math.abs(s.vy) >= 0.35) {
      s.want = elderWrap(elderAngleOf(s.vx, s.vy) + 180);
      if (facing()) {
        if (Math.abs(s.vx) >= 1.75 || Math.abs(s.vy) >= 1.75) s.thrust = accel;
        else { s.thrust = 0.5 * accel; s.vx *= 0.94; s.vy *= 0.94; }
      }
    } else { s.vx *= 0.95; s.vy *= 0.95; s.act = 0; }
  } else if (s.act === 5) {
    if (!t || dis) return;
    s.want = elderBearing(t, s);
    go();
  } else if (s.act === 6) {
    // close in: aim, and fire turrets and forward guns
    if (!t || dis) return;
    s.want = s.weapon !== -1 && w.D.weaps[s.weapon].Guidance === -1 ? elderAim(w, s, t, s.weapon) : elderBearing(s, t);
    elderPickTurret(w, s);
    go();
    if (Math.abs(s.want - s.heading) < 3 * rate) elderPickForward(w, s);
    if (!s.evo) return;
    const dx = Math.abs(t.x - s.x), dy = Math.abs(t.y - s.y), b = elderBearing(s, t);
    if (w.rand(2) === 0 && s.c.InherentAI >= 3 && s.c.Mass < 200 && dx < 123 && dy < 123
        && elderApart(s.heading, b) <= 30 && elderApart(t.heading, elderWrap(b + 180)) <= 30) {
      s.act = 16;
      s.dodge = elderWrap(s.heading + (s.slot % 2 === 0 ? 135 : -135));
    }
    if (s.pass && dx > 82 && dy > 82 && elderApart(s.heading, b) <= 30) s.act = 17;
  } else if (s.act === 16) {
    if (!t || dis) return;
    s.want = s.dodge;
    s.thrust = 1.5 * accel; s.cap = 0;
    if (elderNear(s, t, 165)) elderPickTurret(w, s);
    if (elderApart(s.heading, s.dodge) < 3 * rate) s.act = 6;
  } else if (s.act === 17) {
    if (!t || dis) return;
    s.thrust = 2.75 * accel; s.cap = 1.8 * top;
    s.want = elderBearing(s, t);
    const aimed = Math.abs(s.want - s.heading) < 3 * rate;
    if (elderNear(s, t, 165)) {
      elderPickTurret(w, s);
      if (aimed) elderPickForward(w, s);
      s.act = 6;
    } else {
      if (aimed) elderPickGuided(w, s);
      if (w.rand(100) === 0) s.act = 6;
    }
  } else if (s.act === 7) {
    // far off: fly at the target and fire guided weapons
    if (!t || dis) return;
    s.want = elderBearing(s, t);
    go();
    elderPickGuided(w, s);
    if (s.pass && Math.abs(t.x - s.x) > 82 && Math.abs(t.y - s.y) > 82 && elderApart(s.heading, s.want) <= 30) s.act = 17;
  } else if (s.act === 9 || s.act === 11) {
    // flying to a ship, and within 360 turning the velocity toward it
    const o = t || elderShip(w, s.other);
    if (!o || dis) return;
    const b = elderBearing(s, o);
    s.want = b;
    if (elderNear(s, o, 360)) {
      s.want = s.heading;
      if (Math.abs(elderAngleOf(s.vx, s.vy) - b) > 15) {
        const wx = elderSin(b) * top - s.vx, wy = -elderCos(b) * top - s.vy;
        if (Math.abs(wx) > 0.35 || Math.abs(wy) > 0.35) s.want = elderAngleOf(wx, wy);
      }
    }
    if (facing()) { s.thrust = accel; s.cap = s.act === 11 && elderNear(s, o, 180) ? 0.5 * top : 0; }
  } else if (s.act === 15) {
    // matching a disabled ship's velocity, then waiting beside it
    const o = elderShip(w, s.other);
    if (!o || dis) return;
    let rx = s.vx - o.vx, ry = s.vy - o.vy;
    if (Math.abs(rx) >= 0.525 || Math.abs(ry) >= 0.525) {
      s.want = elderWrap(elderAngleOf(rx, ry) + 180);
      go();
      if (Math.abs(rx) <= 1.75 || Math.abs(ry) <= 1.75) { rx *= 0.95; ry *= 0.95; s.vx = rx + o.vx; s.vy = ry + o.vy; }
    } else {
      s.want = o.heading;
      if (elderNear(s, o, 3)) {
        if (!o.wasDisabled) { o.wasDisabled = true; s.wait = w.rand(150) + 300; s.vx = o.vx; s.vy = o.vy; }
        else if (s.wait <= 0) { s.target = -1; s.other = -1; s.state = 0; s.act = 0; }
        else if (s.wait <= 100) { s.vx += elderSin(s.heading) * accel; s.vy -= elderCos(s.heading) * accel; }
        else { s.vx = o.vx; s.vy = o.vy; }
      } else {
        const b = elderBearing(s, o);
        s.vx = o.vx + elderSin(b) * 0.1 * top; s.vy = o.vy - elderCos(b) * 0.1 * top;
      }
    }
  } else if (s.act === 8) {
    // a fighter going back into its bay
    if (s.other === -1 || elderDead(s)) { s.state = 0; s.act = 0; return; }
    const o = elderShip(w, s.other);
    if (!o) { s.ai = 3; s.state = 0; s.leader = -1; return; }
    if (dis) return;
    s.want = elderBearing(s, o);
    go();
    if (elderNear(s, o, o.c.w)) {
      for (let i = 0; i < 64; i++) {
        const wp = w.D.weaps[i];
        if (wp && wp.Guidance === 99 && wp.AmmoType === s.c.index + 128) { o.weap[i].ammo += 1; elderRemove(w, s, 'docked'); return; }
      }
    }
  }
}

/* ---- explosions --------------------------------------------------------------- */

/* A new explosion (0x11e3d8): 16 at most, of type 0, 1 or 2 lasting 7, 14
   or 28 frames after its delay. */
function elderBoom(w, x, y, type, delay) {
  if (w.booms.length >= ELDER_BOOMS) return;
  w.booms.push({ x, y, type, life: ELDER_BOOM_FRAMES[type] + (delay || 0) });
}

/* The explosions of a weapon's hit at a place (in 0x116420): one of the
   weapon's type, and with type 2 a scatter of small ones across the blast. */
function elderHitBooms(w, wp, x, y) {
  if (wp.ExplodType === 0) elderBoom(w, x, y, 0, 0);
  if (wp.ExplodType === 1) elderBoom(w, x, y, 1, 0);
  if (wp.ExplodType !== 2) return;
  elderBoom(w, x, y, 2, 0);
  const r = wp.BlastRadius, half = Math.trunc(0.5 * r);
  for (let k = Math.trunc(2 * (r / 50)); k > 0; k--) {
    const bx = x + w.rand(half) - (r >> 2), by = y + w.rand(half) - (r >> 2);
    elderBoom(w, bx, by, 1, w.rand(8) + 4);
  }
  for (let k = Math.trunc(8 * (r / 50)); k > 0; k--) {
    const bx = x + w.rand(half) - r, by = y + w.rand(half) - r;
    elderBoom(w, bx, by, 0, w.rand(16) + 8);
  }
}

/* ---- damage -------------------------------------------------------------------- */

/* Damage to a ship (0x117384). A shield loses the energy damage and a
   quarter of the mass damage, armor the mass damage and a quarter of the
   energy damage, and neither loses less than the greater of the two. A
   shot that may not kill leaves 0.4 of the armor, and a blast that spares
   the shield removes no more than the shield left. Then the ship hit
   turns on the shooter when the shooter is of another side and no kin.
   In Override (0x163984) the least a hit that has any damage removes is 1,
   and a shot that may not kill leaves 0.15 of the armor of a class with
   flag 0x0010. */
function elderDamage(w, v, x, y, impact, mass, energy, by, provoke, isTarget, noKill, keepShield) {
  if (v.c.index === ELDER_POD) return;
  if (impact > 0) {
    elderThrust(v, elderAngle(x, y, v.x, v.y), impact / v.c.Mass, v.c.Speed);
    const top = elderTopSpeed(v);
    v.vx = Math.max(-top, Math.min(top, v.vx)); v.vy = Math.max(-top, Math.min(top, v.vy));
  }
  const big = Math.max(mass, energy), up = v.sa >= 0;
  let d = up ? Math.trunc(0.25 * mass + energy) : Math.trunc(0.25 * energy + mass);
  if (v.evo) { if (d < 1 && (mass > 0 || energy > 0)) d = 1; }
  else if (d < big && (mass > 0 || energy > 0)) d = big;
  if (noKill && v.sa - d < -v.c.Armor) d = Math.trunc((v.evo && (v.c.Flags & 0x10) ? 0.85 : 0.6) * v.c.Armor + v.sa);
  if (keepShield && up && v.sa - d < 0) d = v.sa;
  if (d < 0) d = 0;
  v.sa -= d;
  if (!provoke || !by || v.ai <= 0 || by === v) return;
  let r = false;
  if (by.govt !== v.govt) r = true;
  if (v.leader !== -1 && v.leader !== by.slot) r = true;
  if (by.leader !== -1 && v.leader !== by.leader) r = true;
  if (v.govt !== -1 && v.govt === by.govt) r = false;
  if (!isTarget && r && by.target !== v.slot) r = false;
  if (v.leader !== -1 && v.leader === by.leader) r = false;
  const up1 = o => { const L = elderShip(w, o.leader); return L ? L.leader : -1; };
  if (up1(v) !== -1 && up1(v) === up1(by)) r = false;
  if (r) { v.hurt += mass + energy; v.target = by.slot; v.wait = Math.min(v.wait, 20); }
}

/* ---- shots ---------------------------------------------------------------------- */

/* A new shot (0x11d914). A turret's shot leaves from the next of the
   ship's four turret places and is aimed at the target, and a forward shot
   leaves from half the ship's sprite ahead. A computer's shot lasts 1.75
   of the weapon's Count and has the weapon's Speed alone. In Override
   (0x168b10) the shot lasts 1.5 of the Count and has the ship's velocity
   and the weapon's Speed, a forward shot of a class with a ShotXOffset
   leaves from that far to one side and the next from the other
   (0x1612fc), and a weapon with an AmmoType of -999 destroys the ship
   that fires it. */
function elderSideOffset(s, wp) {
  const x = wp.MiscFlags & 0x80 ? 0 : s.c.ShotXOffset;
  return x > 0 && s.weap[wp.index].count > 1 ? (s.side >= 0 ? -x : x) : 0;
}
function elderFireShot(w, s, i) {
  const sh = w.shots.find(q => q.life < -1);
  if (!sh) return false;
  const wp = w.D.weaps[i], g = wp.Guidance, t = elderShip(w, s.target);
  let x = s.x, y = s.y, angle = s.heading;
  if (g === 4 || g === 7 || g === 8) {
    s.turret = (s.turret + 1) % 4;
    const d = s.c.TurretYDisp[s.turret];
    x += elderSin(s.heading) * d; y -= elderCos(s.heading) * d;
    if (t) angle = elderAim(w, s, t, i);
  } else if (g === -1 || g === 1 || g === 2) {
    const side = s.evo && g === -1 ? elderSideOffset(s, wp) : 0;
    if (side !== 0) { x += elderSin(angle + 90) * side; y -= elderCos(angle + 90) * side; }
    else { const d = Math.trunc(0.5 * s.c.w); x += elderSin(angle) * d; y -= elderCos(angle) * d; }
  }
  if (wp.Inaccuracy > 0 && g !== 5) angle += w.rand(2 * wp.Inaccuracy) - wp.Inaccuracy;
  const life = Math.trunc((s.evo ? 1.5 : 1.75) * Math.trunc(wp.Count));
  Object.assign(sh, { life, full: life, x, y, angle: elderWrap(angle), vx: elderSin(angle) * wp.Speed, vy: -elderCos(angle) * wp.Speed,
                      weap: i, wp, owner: s.slot, govt: s.govt, target: s.target, follow: 0, noKill: s.state === 13,
                      spin: wp.MiscFlags & 0x4 ? 0 : w.rand(36), decay: 0, decayWait: 0,
                      hw: wp.w / 2 + wp.ProxRadius, hh: wp.h / 2 + wp.ProxRadius });
  if (s.evo) {
    sh.vx += s.vx; sh.vy += s.vy;
    if (wp.AmmoType === -999) s.sa = -32000;
  }
  return true;
}

/* A shot's steering (0x130720). A torpedo turns 1 degree a frame and a
   missile 4 toward the target once 15 frames old. A missile now and then
   goes after a decoy near its path. A rocket gathers speed, and a bomb
   turns toward the way it drifts. Override's steering is elderSeek. */
function elderGuide(w, sh) {
  const wp = sh.wp, g = wp.Guidance;
  if (w.D.evo && (g === 1 || sh.follow === 2)) { elderSeek(w, sh); return; }
  const turn = (want, rate) => {
    if (Math.abs(want - sh.angle) > rate) {
      const d = elderWrap(want - sh.angle);
      sh.angle = elderWrap(sh.angle + (d <= 180 ? rate : -rate));
    }
    sh.vx = elderSin(sh.angle) * wp.Speed; sh.vy = -elderCos(sh.angle) * wp.Speed;
  };
  const old = sh.full - sh.life > 15;
  if ((g === 1 || g === 2) && sh.follow === 0) {
    const t = elderShip(w, sh.target);
    if (t) turn(elderAngle(sh.x, sh.y, t.x, t.y), old ? (g === 1 ? 1 : 4) : 0);
    if (g === 2 && w.rand(15) === 0) {
      for (let k = 0; k < ELDER_SHOTS; k++) {
        const o = w.shots[k];
        if (o === sh || o.life <= 0 || o.owner === sh.owner || !(o.wp.MiscFlags & 0x20)) continue;
        if (Math.abs(Math.trunc(o.x - sh.x)) > 200 || Math.abs(Math.trunc(o.y - sh.y)) > 200) continue;
        if (Math.abs(elderAngle(sh.x, sh.y, o.x, o.y) - sh.angle) > 10) continue;
        sh.follow = 2; sh.target = k;
        break;
      }
    }
  } else if (sh.follow === 2) {
    const o = w.shots[sh.target];
    if (!o || o.life <= 0) sh.target = -1;
    else if (old) turn(elderAngle(sh.x, sh.y, o.x, o.y), 5);
  } else if (g === 6) {
    sh.vx = 0.01 * (95 * sh.vx + 5 * elderSin(sh.angle) * wp.Speed);
    sh.vy = 0.01 * (95 * sh.vy - 5 * elderCos(sh.angle) * wp.Speed);
  } else if (g === 5) {
    const d = elderWrap(elderAngleOf(sh.vx, sh.vy) - sh.angle);
    if (d !== 0) sh.angle = elderWrap(sh.angle + (d <= 180 ? 1 : -1));
  }
}

/* Whether a ship jams a seeker of kind k, 0 to 3 (Override's 0x15a940).
   Its government's InherentJam has bit k for a weak jammer and bit 4 + k
   for a strong one, a ship of AI type 1 or 2 has one step less with bit
   0x100, and a weak jammer works on one draw in two. */
function elderJams(w, t, k) {
  const G = w.D.govts[t.govt];
  if (!G) return false;
  let n = G.InherentJam & (16 << k) ? 2 : G.InherentJam & (1 << k) ? 1 : 0;
  if ((t.ai === 1 || t.ai === 2) && (G.InherentJam & 0x100)) n -= 1;
  return n >= 2 || (n === 1 && w.rand(2) === 0);
}

/* A guided shot's steering in Override (0x1233bc). It turns toward its
   target once 15 frames old, by 1 degree a frame and 2 more with Seeker
   flag 0x1000 and 4 more with 0x2000 (0x1608a4). A jammed seeker turns
   away: flags 0x0010 to 0x0080 on one draw in two against a ship that
   jams that kind, and flags 0x0100 to 0x0800 on every frame. With flag
   0x8000 a jammed shot now and then turns on the ship that fired it. With
   flag 0x4000 a shot within 250 of a target over 45 degrees off its
   heading loses the target. With flag 0x0004 a shot now and then goes
   after a decoy near its path. */
function elderSeek(w, sh) {
  const wp = sh.wp, old = sh.full - sh.life > 15;
  const turn = (want, rate) => {
    if (Math.abs(want - sh.angle) > Math.abs(rate)) {
      const d = elderWrap(want - sh.angle);
      sh.angle = elderWrap(sh.angle + (d <= 180 ? rate : -rate));
    }
    sh.vx = elderSin(sh.angle) * wp.Speed; sh.vy = -elderCos(sh.angle) * wp.Speed;
  };
  if (sh.follow === 2) {
    const o = w.shots[sh.target];
    if (!o || o.life <= 0) sh.target = -1;
    else if (old) turn(elderAngle(sh.x, sh.y, o.x, o.y), elderSeekerTurn(wp));
    return;
  }
  let t = elderShip(w, sh.target), rate = 0;
  const want = t ? elderAngle(sh.x, sh.y, t.x, t.y) : sh.angle;
  if (old) {
    rate = elderSeekerTurn(wp);
    for (let k = 0; t && k < 4; k++) {
      const some = !!(wp.Seeker & (16 << k)), all = !!(wp.Seeker & (256 << k));
      if (!(some || all) || !elderJams(w, t, k) || (!all && w.rand(2) !== 0)) continue;
      rate = -Math.abs(rate);
      if ((wp.Seeker & 0x8000) && w.rand(all ? 500 : 1000) === 0 && elderShip(w, sh.owner)) { sh.target = sh.owner; sh.owner = -1; t = elderShip(w, sh.target); }
    }
    if ((wp.Seeker & 0x4000) && t && elderNear(sh, t, 250) && elderApart(elderAngle(sh.x, sh.y, t.x, t.y), sh.angle) > 45) sh.target = -1;
  }
  turn(want, rate);
  if ((wp.Seeker & 0x4) && w.rand(15) === 0) {
    for (let k = 0; k < ELDER_SHOTS; k++) {
      const o = w.shots[k];
      if (o === sh || o.life <= 0 || o.owner === sh.owner || !(o.wp.MiscFlags & 0x20)) continue;
      if (Math.abs(Math.trunc(o.x - sh.x)) > 200 || Math.abs(Math.trunc(o.y - sh.y)) > 200) continue;
      if (Math.abs(elderAngle(sh.x, sh.y, o.x, o.y) - sh.angle) > 10) continue;
      sh.follow = 2; sh.target = k;
      break;
    }
  }
}

/* A shot's frame (0x115e9c): it steers and moves while it has life left,
   and one whose life is over goes, with a small explosion when its weapon
   has an ExplodType of 1 or more. In Override (0x1269a4) a weapon with a
   Decay loses 1 from both its damages every Decay frames in flight, and a
   shot of a weapon with flag 0x8000 whose life is over explodes as one
   that hit, damaging the ships within its BlastRadius. */
function elderMoveShot(w, sh) {
  const wp = sh.wp;
  if (sh.life > 0) {
    sh.life -= 1;
    elderGuide(w, sh);
    sh.x += sh.vx; sh.y += sh.vy;
    if (wp.MiscFlags & 0x1) sh.spin = (sh.spin + 1) % 37;
    if (w.D.evo && wp.Decay > 0 && ++sh.decayWait > wp.Decay) { sh.decayWait = 0; sh.decay += 1; }
  } else if (sh.life > -2) {
    if (w.D.evo && (wp.MiscFlags & 0x8000)) {
      elderHitBooms(w, wp, sh.x, sh.y);
      elderBlast(w, sh, null);
    } else if (wp.ExplodType >= 1) elderBoom(w, sh.x, sh.y, 0, 0);
    sh.life = -2;
  }
}

/* A shot's blast: every ship within the weapon's BlastRadius on both axes
   but the one hit, and the owner only with flag 0x0100. */
function elderBlast(w, sh, hit) {
  const wp = sh.wp;
  if (wp.BlastRadius <= 0) return;
  const own = elderShip(w, sh.owner);
  for (let k = 1; k < ELDER_SLOTS; k++) {
    const o = w.slots[k];
    if (!o || o === hit || (k === sh.owner && !(wp.MiscFlags & 0x100))) continue;
    if (Math.abs(o.x - sh.x) <= wp.BlastRadius && Math.abs(o.y - sh.y) <= wp.BlastRadius)
      elderDamage(w, o, sh.x, sh.y, wp.Impact, wp.MassDmg, wp.EnergyDmg, own, false, false, sh.noKill, false);
  }
}

/* A missile and the decoy it follows end each other when they touch
   (0x1162b4). */
function elderShotsMeet(w) {
  for (const a of w.shots) {
    if (a.life <= 0 || a.follow !== 2) continue;
    const b = w.shots[a.target];
    if (!b || b.life <= 0 || b.owner === a.owner) continue;
    if (!!(a.wp.MiscFlags & 0x20) === !!(b.wp.MiscFlags & 0x20)) continue;
    if (Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh) { elderBoom(w, a.x, a.y, 0, 0); a.life = b.life = -2; }
  }
}

/* A shot against the ships (0x116420). A ship's box is the middle half of
   its sprite and a shot's is its sprite and its ProxRadius around it. A
   shot passes its owner, the owner's government, the owner's leader and
   fighters and its fellow fighters, and a guided shot every ship but its
   target. The ship hit is damaged, and so is every other ship within the
   BlastRadius, the owner too with flag 0x0100. Override's (0x162960) is
   the same with the damage a Decay has left. */
function elderShotHits(w, sh) {
  const wp = sh.wp, own = elderShip(w, sh.owner);
  for (let i = 1; i < ELDER_SLOTS; i++) {
    const v = w.slots[i];
    if (!v || v.c.index === ELDER_POD || i === sh.owner) continue;
    if ((wp.Guidance === 1 || wp.Guidance === 2) && (sh.follow !== 0 || sh.target !== i)) continue;
    if (own && own.leader !== -1 && own.leader === v.leader) continue;
    if (sh.govt !== -1 && sh.govt === v.govt) continue;
    if (own && own.leader === i) continue;
    if (v.leader === sh.owner) continue;
    if (!(Math.abs(sh.x - v.x) < sh.hw + v.c.w / 4 && Math.abs(sh.y - v.y) < sh.hh + v.c.h / 4)) continue;
    elderHitBooms(w, wp, sh.x, sh.y);
    elderDamage(w, v, sh.x, sh.y, wp.Impact, Math.max(0, wp.MassDmg - sh.decay), Math.max(0, wp.EnergyDmg - sh.decay), own, true, sh.follow === 0 && sh.target === i, sh.noKill, false);
    elderBlast(w, sh, v);
    sh.life = -2;
    return;
  }
}

/* ---- beams ---------------------------------------------------------------------- */

/* A new beam (0x1302bc): eight at most, lasting the weapon's Count.
   Override's (0x122f44) has the side it leaves the ship from too. */
function elderFireBeam(w, s, i, forward, side) {
  const b = w.beams.find(q => q.life < (s.evo ? -1 : 0));
  if (!b) return false;
  const wp = w.D.weaps[i];
  Object.assign(b, { life: wp.Count, weap: i, wp, owner: s.slot, forward, side: side || 0, target: wp.Guidance === 3 ? s.target : -1, x: s.x, y: s.y, x2: s.x, y2: s.y });
  return true;
}

/* The beams' frame (0x12dd40). A beam runs from its ship along the ship's
   heading, or at its target, twice the weapon's Speed long. It hits every
   ship within that length whose heading from the owner is within a width
   of the beam's that grows with the ship's sprite, but the owner's leader,
   fighters and fellow fighters. A beam with an Impact below 0 is a
   tractor beam. Override's (0x120ffc) hits only the nearest such ship and
   ends there, spares the owner's leader and fighters, measures the length
   from where the beam leaves the ship with a third of the other ship's
   sprite added, and a ship that is waiting does not turn on the owner. */
function elderStepBeams(w) {
  const evo = w.D.evo;
  for (const b of w.beams) {
    b.shown = false;
    if (b.life < (evo ? -1 : 0)) continue;
    b.life -= 1;
    const own = elderShip(w, b.owner), wp = b.wp;
    if (!own) { b.life = evo ? -2 : -1; continue; }
    b.shown = true;
    const t = elderShip(w, b.target);
    let angle = own.heading;
    if (t) angle = elderBearing(own, t);
    if (t || (evo && wp.Inaccuracy > 0)) angle += w.rand(2 * wp.Inaccuracy) - wp.Inaccuracy;
    let x = own.x, y = own.y;
    if (b.side !== 0) { x += elderSin(angle + 90) * b.side; y -= elderCos(angle + 90) * b.side; }
    else if (b.forward) { const d = Math.trunc(0.5 * own.c.h); x += elderSin(angle) * d; y -= elderCos(angle) * d; }
    const L = Math.trunc(2 * wp.Speed);
    Object.assign(b, { x, y, x2: x + elderSin(angle) * L, y2: y - elderCos(angle) * L, angle });
    if (b.life < 0) continue;
    if (evo) {
      let v = null, best = Infinity;
      for (let i = 1; i < ELDER_SLOTS; i++) {
        const o = w.slots[i];
        if (!o || o === own || o.leader === own.slot || own.leader === i || o.c.index === ELDER_POD) continue;
        const h = Math.trunc(0.66 * o.c.h), reach = Math.trunc(2 * wp.Speed + h / 2);
        if ((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y) > reach * reach) continue;
        if (Math.abs(elderBearing(own, o) - angle) > (h * 10) >> 5) continue;
        const d = (o.x - own.x) * (o.x - own.x) + (o.y - own.y) * (o.y - own.y);
        if (d < best) { best = d; v = o; }
      }
      if (!v) continue;
      elderHitBooms(w, wp, v.x + w.rand(50) - 25, v.y + w.rand(50) - 25);
      elderDamage(w, v, own.x, own.y, wp.Impact, wp.MassDmg, wp.EnergyDmg, own, true, b.target !== -1 ? b.target === v.slot : own.target === v.slot, false, false);
      if (wp.Impact < 0) v.held = true;
      if (v.ai >= 1 && (v.govt !== own.govt || (v.govt === -1 && own.govt === -1)) && v.leader !== own.slot && v.wait <= 0) {
        v.target = own.slot;
        if (b.target === -1 || b.target === v.slot) v.hurt = 1;
      }
      const far = Math.max(0, Math.sqrt(best) - 0.3 * v.c.h);
      b.x2 = own.x + elderSin(angle) * far; b.y2 = own.y - elderCos(angle) * far;
      continue;
    }
    for (let i = 1; i < ELDER_SLOTS; i++) {
      const v = w.slots[i];
      if (!v || v === own || v.leader === own.slot || (own.leader !== -1 && v.leader === own.leader) || own.leader === i || v.c.index === ELDER_POD) continue;
      const dx = v.x - own.x, dy = v.y - own.y;
      if (dx * dx + dy * dy > L * L) continue;
      if (Math.abs(elderBearing(own, v) - angle) > (Math.trunc(0.66 * v.c.h) * 10) >> 5) continue;
      elderHitBooms(w, wp, v.x + w.rand(50) - 25, v.y + w.rand(50) - 25);
      elderDamage(w, v, own.x, own.y, wp.Impact, wp.MassDmg, wp.EnergyDmg, own, true, b.target !== -1 ? b.target === i : own.target === i, false, false);
      if (wp.Impact < 0) v.held = true;
      if (v.ai >= 1 && (v.govt !== own.govt || (v.govt === -1 && own.govt === -1)) && v.leader !== own.slot) {
        v.target = own.slot;
        if (b.target === -1 || b.target === i) v.hurt = 1;
      }
    }
  }
}

/* ---- a ship's frame --------------------------------------------------------------- */

/* A ship's frame (0x118054): reloads, the move, the turn, the shield's
   gain, the thrust and the weapon's firing. In Override (0x125074) a
   turret reaches 1.5 of its weapon's Speed x Count and does not fire into
   its blind arc, a reload is the weapon's Reload over the count with its
   fraction, a weapon with an AmmoType of 0 uses no round, each firing
   changes the side the next shot leaves from, and a class with a
   FuelRegen gains 1 fuel on one frame in that many. */
function elderStepShip(w, s) {
  const D = w.D;
  if (s.target !== -1 && !elderShip(w, s.target)) s.target = -1;
  for (const h of s.weap) if (h.reload > 0) h.reload = Math.max(0, h.reload - 1);
  const dis = elderDisabled(s);
  if (dis) { s.vx *= 0.995; s.vy *= 0.995; }
  s.x += s.vx; s.y += s.vy;
  if (!dis) {
    if (s.wait <= 0) {
      const rate = elderTurnRate(s);
      if (Math.abs(s.want - s.heading) <= rate) s.heading = s.want;
      else s.heading += elderWrap(s.want - s.heading) <= 180 ? rate : -rate;
    }
    if (s.sa < s.c.Shield && w.frame % elderShieldTicks(s) === 0) s.sa = Math.trunc(s.sa + 0.01 * s.c.Shield);
  }
  s.heading = elderWrap(s.heading);
  if (s.wait > 0 && s.c.index !== ELDER_POD) s.wait -= 1;
  else {
    if (s.thrust !== 0 && !dis) elderThrust(s, s.heading, s.thrust, s.cap > 0 ? s.cap : elderTopSpeed(s));
    const i = s.weapon, h = i !== -1 ? s.weap[i] : null;
    if (s.firing && h && !dis && h.reload <= 0 && h.count > 0) {
      const wp = D.weaps[i], g = wp.Guidance, t = elderShip(w, s.target);
      const n = wp.MiscFlags & 0x40 ? h.count : 1, reach = s.evo ? 1.5 : 1;
      let shots = 0;
      for (let k = 0; k < n; k++) {
        if (!elderHasAmmo(w, s, i)) continue;
        let fired = false;
        if (g === 3 || g === 4) {
          const r = Math.trunc(g === 3 ? wp.Speed : reach * wp.Speed * wp.Count);
          if (t && Math.abs(t.x - s.x) < r && Math.abs(t.y - s.y) < r && !elderBlind(s, t, wp)) fired = g === 3 ? elderFireBeam(w, s, i, false, 0) : elderFireShot(w, s, i);
        } else if (g === 7 || g === 8) {
          const r = Math.trunc(reach * wp.Speed * wp.Count);
          if (t && Math.abs(t.x - s.x) < r && Math.abs(t.y - s.y) < r
              && Math.abs(elderBearing(s, t) - (g === 8 ? s.heading - 180 : s.heading)) % 360 <= 45) fired = elderFireShot(w, s, i);
        } else if (g === 1 || g === 2) {
          if (t) fired = elderFireShot(w, s, i);
        } else if (g === 0) { const side = s.evo ? elderSideOffset(s, wp) : 0; fired = elderFireBeam(w, s, i, side === 0, side); }
        else if (g === -1 || g === 6 || g === 5) fired = elderFireShot(w, s, i);
        if (fired) shots += 1;
        if (s.evo ? wp.AmmoType > 0 : wp.AmmoType >= 0) h.ammo -= 1;
        else if (wp.AmmoType <= -1000) s.fuel -= -wp.AmmoType - 1000;
      }
      if (shots > 0) h.reload = shots * (s.evo ? wp.Reload / h.count : Math.trunc(wp.Reload / h.count));
      if (s.evo) s.side = s.side >= 0 ? -1 : 1;
    }
  }
  if (s.evo && s.c.FuelRegen > 0 && w.rand(s.c.FuelRegen) === 0) s.fuel = Math.min(s.c.Fuel, s.fuel + 1);
  if (s.dying > 0) s.dying -= 1;
  s.held = false;
}

/* A ship's death (in 0x12bbe8): it burns for its class's DeathDelay with
   explosions over it that come faster toward the end, and then goes. A
   ship of Mass 100 or more goes with a blast that pushes and hurts the
   ships around it and cannot kill them. */
function elderDying(w, s) {
  if (!elderDead(s)) return;
  const c = s.c;
  if (s.dying <= 0) s.dying = Math.max(1, c.DeathDelay);
  const n = s.dying < 20 ? 1 : s.dying < 40 ? 2 : s.dying < 60 ? 4 : 8;
  if (w.rand(n) === 0) {
    const r = Math.max(1, Math.trunc(0.25 * c.w));
    const x = s.x + w.rand(2 * r) - r, y = s.y + w.rand(2 * r) - r;
    elderBoom(w, x, y, n <= 2 && c.DeathDelay >= 60 ? w.rand(2) : 0, 0);
    w.rand(4);
  }
  if (s.dying > 2) return;
  if (c.Mass >= 100) {
    const r = Math.trunc(0.15 * c.Mass + 50), dmg = Math.trunc(0.075 * c.Mass + 25);
    for (let i = 1; i < ELDER_SLOTS; i++) {
      const o = w.slots[i];
      if (o && o !== s && Math.abs(o.x - s.x) <= r && Math.abs(o.y - s.y) <= r) elderDamage(w, o, s.x, s.y, 1000, dmg, dmg, s, false, false, true, true);
    }
    for (let k = Math.trunc(3 * r / 50); k > 0; k--) {
      const x = s.x + w.rand(r) - r / 2, y = s.y + w.rand(r) - r / 2;
      elderBoom(w, x, y, 1, w.rand(8) + 4);
    }
    for (let k = Math.trunc(10 * r / 50); k > 0; k--) {
      const ax = w.rand(Math.trunc(0.5 * r)), x = s.x + w.rand(r) - ax, ay = w.rand(Math.trunc(0.5 * r)), y = s.y + w.rand(r) - ay;
      elderBoom(w, x, y, 0, w.rand(16) + 8);
    }
  }
  elderBoom(w, s.x, s.y, 2, 0);
  elderRemove(w, s, 'destroyed');
}

/* ---- the frame --------------------------------------------------------------------- */

/* One frame (0x115bc4): the beams, the tally of what flies at each ship
   (0x11ff04), one ship's turn of the AI on every second frame, every
   ship's frame, the shots and the explosions. The turn passes from
   slot to slot, a disabled or dying ship's included. In Override
   (0x162638) every ship has its turn of the AI on every frame, and the
   beams come after the ships. */
function elderStep(w) {
  const evo = w.D.evo;
  w.frame += 1;
  if (!evo) elderStepBeams(w);
  for (const s of w.ships) s.incoming = 0;
  for (const sh of w.shots) {
    const t = sh.life > 0 && sh.follow === 0 ? elderShip(w, sh.target) : null;
    if (t) t.incoming = Math.trunc(t.incoming + 0.5 * (sh.wp.MassDmg + sh.wp.EnergyDmg));
  }
  if (evo) {
    for (let i = 1; i < ELDER_SLOTS; i++) if (w.slots[i] && w.slots[i].ai >= 1) elderThink(w, w.slots[i]);
  } else if (w.frame % 2 === 0 && w.ships.some(s => s.ai >= 1)) {
    do { w.cursor += 1; if (w.cursor >= ELDER_SLOTS || w.cursor < 1) w.cursor = 1; } while (!w.slots[w.cursor] || w.slots[w.cursor].ai < 1);
    elderThink(w, w.slots[w.cursor]);
  }
  for (let i = 1; i < ELDER_SLOTS; i++) if (w.slots[i]) elderStepShip(w, w.slots[i]);
  if (evo) elderStepBeams(w);
  for (const sh of w.shots) {
    if (sh.life < -1) continue;
    elderMoveShot(w, sh);
    if (sh.life > 0) elderShotHits(w, sh);
  }
  elderShotsMeet(w);
  for (let i = 1; i < ELDER_SLOTS; i++) if (w.slots[i]) elderDying(w, w.slots[i]);
  for (const b of w.booms) b.life -= 1;
  w.booms = w.booms.filter(b => b.life >= 0);
}
