/* nova-fight.js -- ships fighting, as Mac EV Nova 1.1.1 has them fight.
   =========================================================================

   The second half of nova-flight.js: who is whose enemy and who a warship
   picks (SelectWarshipTarget), the attack states and moves of the AI,
   guns and turrets choosing to fire and firing (AIFireGun, AIFireTurret,
   FireAIShipWeapon), shots (SpawnShot, HandleShot), hits by sprite mask
   or bounding circle and by proximity, damage to shields and armour and
   what a ship hit does about it (DamageShip), disabling, the death
   throes and the explosions. Each function names the routine it follows
   and its address in the Intel half of 1.1.1.

   Not here yet, each a later part of stage 4: guided missiles
   (HandleShotGuidance; AIFireMissile does not fire), beams (SpawnBeam,
   HandleBeams), rockets and bombs (guidance 5 and 6), submunitions,
   ionization, cloaking, fighters and their bays, boarding and plunder,
   escape pods, reinforcements, shots against asteroids and stellars,
   and the particles and smoke (which draw on the random numbers: a
   weapon with Particles or HitParticles makes the program draw more than
   this does).

   The player is in none of it: every branch about the player is left
   out, and the player's combat rating, which scales some of it, is taken
   as a new pilot's, 0.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-flight.js. */

/* ---- the records ---------------------------------------------------------- */

/* The weapons, explosions and sprites a fight needs, read once into D.fight:
   wëap 128 + i at index i as LoadObjectData (0x79285) keeps it, with its
   range worked out as the loader works it (0x79e80); bööm 128 + i with
   FrameAdvance x 0.01 (0x7d05d). */
function novaFightData(D) {
  if (D.fight) return D.fight;
  const game = D.u.game, F = { sprites: new Map(), weaps: [], booms: [] };
  D.fight = F;
  for (let i = 0; i < 256; i++) {
    const r = novaGet(game, 'wëap', 128 + i);
    if (!r) { F.weaps.push(null); continue; }
    F.weaps.push({
      i, id: r.id, name: novaNameParts(r.name).name, count: r.Count, mass: r.MassDmg, energy: r.EnergyDmg, guid: r.Guidance,
      speed: f32(r.Speed / 100), ammoType: r.AmmoType, graphic: r.Graphic, inacc: r.Inaccuracy === -1 ? 0 : r.Inaccuracy,
      impact: r.Impact, recoil: r.Recoil, explod: r.ExplodType, prox: r.ProxRadius, blast: r.BlastRadius, decay: r.Decay,
      proxSafety: r.ProxSafety, maxAmmo: r.MaxAmmo, flags: r.Flags & 0xffff, flags2: r.Flags2 & 0xffff, flags3: r.Flags3 & 0xffff,
      seeker: r.Seeker & 0xffff, reload: r.Reload, guidedTurn: f32(r.GuidedTurn * 0.1), particles: r.Particles,
      hitParticles: r.HitParticles, exitType: r.ExitType, durability: r.Durability,
      beamLength: r.BeamLength, animDelay: r.BeamWidth, beamWidth: r.BeamWidth, falloff: r.BeamLength > 0 && r.Falloff <= 0 ? 16 : r.Falloff,
      beamColor: r.BeamColor, coronaColor: r.CoronaColor, subCount: r.SubCount, subType: r.SubType, subLimit: r.SubLimit,
      burstCount: r.BurstCount > 0 ? r.BurstCount : -1, burstReload: r.BurstReload,
      jam: (r.JamVuln || [0, 0, 0, 0]).map(v => Math.min(100, Math.max(0, v))),
      spin: r.Graphic >= 0 ? 3000 + r.Graphic : 0, range: 0,
    });
  }
  for (const w of F.weaps) if (w) w.range = novaWeaponRange(F, w);
  for (let i = 0; i < 64; i++) {
    const r = novaGet(game, 'bööm', 128 + i);
    F.booms.push(r ? { adv: f32(f32(r.FrameAdvance) * 0.01), sound: r.SoundIndex, spin: 400 + r.GraphicIndex } : null);
  }
  for (const g of D.govts.values()) {
    const raw = D.u.govts.get(g.id);
    let odds = f32((raw ? raw.MaxOdds : 0) * 0.01);
    if (odds < f32(0.01)) odds = f32(0.01);
    g.maxOdds = odds;
  }
  return F;
}
/* A weapon's reach (LoadObjectData 0x79e80): Count x Speed, down its
   chain of submunitions, for shots; BeamLength for beams. */
function novaWeaponRange(F, w) {
  if ([0, 3, 10].includes(w.guid)) return f32(w.beamLength);
  if (![-1, 1, 4, 6, 7, 8, 9].includes(w.guid)) return 0;
  let r = 0, cur = w;
  for (let n = 0; cur && n < 256; n++) {
    r = f32(r + f32(cur.count * cur.speed));
    if (cur.subCount <= 0) break;
    if (cur.subType === cur.id) { if (cur.subLimit > 0) r = f32(r + f32(f32(cur.subLimit * cur.speed) * cur.count)); break; }
    if (cur.subType === -1) break;
    cur = F.weaps[cur.subType - 128];
  }
  return r;
}
/* The sprite a spïn names (a weapon's 3000 + Graphic, an explosion's 400 +
   GraphicIndex), looked up when wanted, since the graphics files may come
   after the rest. */
function novaSpinSprite(D, spinId) {
  const F = D.fight;
  if (!F.spins) F.spins = new Map();
  if (F.spins.has(spinId)) return F.spins.get(spinId);
  const spin = spinId ? novaGet(D.u.game, 'spïn', spinId) : null;
  if (spin) F.spins.set(spinId, spin.SpritesID);
  return spin ? spin.SpritesID : 0;
}
/* A sprite's size and frames, and each frame's opaque pixels when a hit is
   tested (the sprite world's RLE masks, SWRLECollision). */
function novaFightSprite(D, id) {
  const F = D.fight;
  if (F.sprites.has(id)) return F.sprites.get(id);
  const game = D.u.game, r = id ? (game.get('rlëD', id) || game.get('rlë8', id)) : null;
  if (!r) return null;
  let s = null;
  if (r) try {
    const ix = novaRleIndex(r.bytes);
    s = { w: ix.header.width, h: ix.header.height, frames: ix.header.frames, bytes: r.bytes, ix, masks: [] };
  } catch (e) { s = null; }
  F.sprites.set(id, s);
  return s;
}
// One frame's opaque pixels: 1 where the RLE draws (opcodes 2 and 4), 0 where it skips.
function novaSpriteMask(spr, f) {
  if (spr.masks[f]) return spr.masks[f];
  const b = spr.bytes, W = spr.w, px = spr.ix.header.depth / 8, m = new Uint8Array(W * spr.h);
  let p = spr.ix.starts[f], y = -1, x = 0;
  for (;;) {
    const op = b[p], n = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
    p += 4;
    if (op === 0) break;
    if (op === 1) { y++; x = 0; continue; }
    const count = n / px;
    if (op === 2 || op === 4) m.fill(1, y * W + x, y * W + x + count);
    x += count;
    if (op === 2) p += (n + 3) & ~3;
    else if (op === 4) p += 4;
  }
  return (spr.masks[f] = m);
}

/* What a class needs in a fight, read once: its weapons and their
   ammunition by wëap index from its eight slots (LoadObjectData 0x7aa25:
   a later slot of the same weapon replaces an earlier), its recharge
   rates (x 0.001 when above 0, 0x7a52c), and its shän's exit points and
   compression (LoadExtendedShipSprites 0x23988, a compression of 0 or
   less read as 1). */
function novaClassFight(D, cls) {
  if (cls.fight) return cls.fight;
  novaFightData(D);
  const r = cls.rec, shan = novaGet(D.u.game, 'shän', cls.id);
  const count = new Int16Array(256), ammo = new Int16Array(256);
  const types = [...(r.WeapType || []), ...(r.WeapType2 || [])], counts = [...(r.WeapCount || []), ...(r.WeapCount2 || [])];
  const loads = [...(r.AmmoLoad || []), ...(r.AmmoLoad2 || [])];
  for (let k = 0; k < 8; k++) {
    const t = types[k] - 128;
    if (t >= 0 && t <= 255) { count[t] = counts[k] || 0; ammo[t] = loads[k] || 0; }
  }
  const x = new Array(16).fill(0), y = new Array(16).fill(0), z = new Array(16).fill(0);
  let up = { x: 1, y: f32(0.71) }, dn = { x: 1, y: 1 };
  if (shan) {
    const sets = [['GunPosX', 'GunPosY', 'GunPosZ'], ['TurretPosX', 'TurretPosY', 'TurretPosZ'],
                  ['GuidedPosX', 'GuidedPosY', 'GuidedPosZ'], ['BeamPosX', 'BeamPosY', 'BeamPosZ']];
    sets.forEach(([X, Y, Z], et) => { for (let i = 0; i < 4; i++) { x[et * 4 + i] = (shan[X] || [])[i] || 0; y[et * 4 + i] = (shan[Y] || [])[i] || 0; z[et * 4 + i] = (shan[Z] || [])[i] || 0; } });
    const c = v => { const f = f32(v * 0.01); return f <= 0 ? 1 : f; };
    up = { x: c(shan.UpCompressX), y: c(shan.UpCompressY) }; dn = { x: c(shan.DnCompressX), y: c(shan.DnCompressY) };
  }
  const spr = novaFightSprite(D, cls.sprite);
  // EscortType, worked out when not 0 to 3 (0x7a45f): a freighter (3) for AI types up to 2, else by Mass
  let escortType = r.EscortType;
  if (escortType < 0 || escortType > 3) escortType = r.InherentAI <= 2 ? 3 : r.Mass <= 49 ? 0 : r.Mass <= 199 ? 1 : 2;
  return (cls.fight = {
    count, ammo, strength: r.Strength, mass: r.Mass, deathDelay: r.DeathDelay, explode1: r.Explode1, explode2: r.Explode2,
    podCount: r.PodCount, escortType, dodge: escortType === 0 ? 80 : escortType === 1 ? 90 : 100, inherentAI: r.InherentAI, keyCarried: r.KeyCarried,
    shieldRech: r.ShieldRech > 0 ? f32(f32(r.ShieldRech) * 0.001) : 0, armorRech: r.ArmorRech > 0 ? f32(f32(r.ArmorRech) * 0.001) : 0,
    flags: r.Flags & 0xffff, flags2: r.Flags2 & 0xffff, flags3: (r.Flags3 || 0) & 0xffff,
    framesPer: shan && shan.FramesPer > 0 ? shan.FramesPer : 36, x, y, z, up, dn,
    w: spr ? spr.w : 32, h: spr ? spr.h : 32,
  });
}

/* A ship ready to fight, as the spawners leave it (RandomShipSpawn
   0x3c0f3, SpawnPerson 0x408d5): shields, armour and fuel full, its
   class's weapons and ammunition, a person's added to them, its pods.
   Called on a ship's first step. */
function novaArm(w, s) {
  const D = w.D, F = novaFightData(D), c = novaClassFight(D, s.cls);
  const p = s.pers ? D.persons.get(s.pers) : null;
  s.weap = [];
  s.wi = new Map();
  const extra = new Int16Array(256), extraAmmo = new Int16Array(256);
  if (p) for (let k = 0; k < 4; k++) {
    const t = (p.WeapType || [])[k] - 128;
    if (t >= 0 && t <= 255) { extra[t] = (p.WeapCount || [])[k] || 0; extraAmmo[t] = (p.AmmoLoad || [])[k] || 0; }
  }
  for (let i = 0; i < 256; i++) {
    const n = c.count[i] + extra[i], a = c.ammo[i] + extraAmmo[i];
    if (!n && !a) continue;
    const rec = { i, count: n, ammo: a, reload: 0, burst: 0 };
    s.weap.push(rec); s.wi.set(i, rec);
  }
  s.shield = f32(s.cls.shield); s.armor = f32(s.cls.armor); s.fuel = f32(s.cls.fuel);
  if (p && (p.Flags2 & 1)) s.fuel = 0;
  if (p) s.aggr = p.Aggress;
  Object.assign(s, { armed: true, death: 0, anger: 0, odds: -1, lastW: -1, lastGun: -1, latch: false, boost: false,
                     patience: -1, targeted: 0, flash: 0, exits: [0, 0, 0, 0], podsLeft: c.podCount, mate: 0, harass: 0 });
  if (s.aggr === undefined) s.aggr = 2;
  if (!F) return;
  novaSetDisabled(D, s);
}

/* ---- the state of a ship ------------------------------------------------- */

const novaWeapOf = (D, i) => D.fight.weaps[i];

/* ShipShieldCapacity 0x2995, ShipArmorCapacity 0x2bc0: the class's, times
   a person's ShieldMod / 100 when above 0, times 1.333 for a fighter
   (AI type 5). */
function novaShieldCap(D, s) {
  let v = f32(s.cls.shield);
  const p = s.pers ? D.persons.get(s.pers) : null;
  if (p && p.ShieldMod > 0) v = f32(v * f32(p.ShieldMod / 100));
  if (s.ai === 5) v = f32(v * 1.333);
  return v;
}
function novaArmorCap(D, s) {
  let v = f32(s.cls.armor);
  const p = s.pers ? D.persons.get(s.pers) : null;
  if (p && p.ShieldMod > 0) v = f32(v * f32(p.ShieldMod / 100));
  if (s.ai === 5) v = f32(v * 1.333);
  return v;
}
// ShipShieldRechargeRate 0x2abb, ShipArmorRechargeRate 0x2e0e (none while disabled).
function novaShieldRech(D, s) { const v = novaClassFight(D, s.cls).shieldRech; return s.ai === 5 ? f32(v * 1.333) : v; }
function novaArmorRech(D, s) { if (s.disabled) return 0; const v = novaClassFight(D, s.cls).armorRech; return s.ai === 5 ? f32(v * 1.333) : v; }

/* IsDisabled 0x2ce6: always for a derelict government (Flags 0x0800);
   else armour under a tenth of its capacity (class Flags 0x0010) or under
   a third. Kept in s.disabled whenever armour changes. */
function novaSetDisabled(D, s) {
  if (novaDerelict(D, s.govt)) { s.disabled = true; return; }
  const c = novaClassFight(D, s.cls), cap = novaArmorCap(D, s);
  s.disabled = f32(100 * s.armor) < cap * ((c.flags & 0x10) ? 10 : 33.333);
}
// IsDying 0x2540: the death throes begun, or no armour left.
const novaDying = s => s.death > 0 || s.armor <= 0;
const novaActive = (w, i) => i >= 0 && i < 64 && !!w.ships[i];
/* ShipVisibleToShip 0x9721, without cloaking: a ship coming out of a
   hypergate cannot be seen. */
const novaVisible = (a, b) => a.state !== 0x15 && !!b;

/* IsShipMyEnemy 0x8196c: two ships of two governments, either at war or
   the other xenophobic and not an ally. */
function novaIsEnemy(D, s, o) {
  if (s === o || s.govt === -1 || o.govt === -1 || s.govt === o.govt) return false;
  if (novaGovtEnemies(D, s.govt, o.govt)) return true;
  const g = D.govts.get(o.govt);
  return !!g && !!(g.flags & 1) && !novaGovtAllies(D, s.govt, o.govt);
}
// The states a ship is not fighting in, for the threat tests.
const NOVA_PEACEFUL = [7, 9, 0xf, 0xa, 0xb, 5, 0xc, 0x12];
/* ExtendedIsThreatToShip 0x81a2d: o attacks s, or attacks one of s's
   escorts. */
function novaThreatens(w, o, s) {
  if (!o || o.disabled || o.leader === s.slot) return false;
  if (o.primary === s.slot && !NOVA_PEACEFUL.includes(o.state)) return true;
  for (let j = 1; j < 64; j++) {
    const e = w.ships[j];
    if (e && e.leader === s.slot && o.primary === j && o.slot !== j && !NOVA_PEACEFUL.includes(o.state)) return true;
  }
  return false;
}
// IsShipThreatenedByMyEnemy 0x824f6: some enemy of s threatens o.
function novaThreatenedByMyEnemy(w, o, s) {
  for (let i = 1; i < 64; i++) {
    const e = w.ships[i];
    if (e && i !== s.slot && i !== o.slot && novaThreatens(w, e, o) && novaIsEnemy(w.D, s, e)) return true;
  }
  return false;
}
// ShipsShareParent 0x7923: the same ship at the top of their chains of leaders.
function novaRoot(w, s) {
  let i = s.slot;
  for (let n = 0; n < 64; n++) {
    const t = w.ships[i];
    if (!t || t.leader < 0 || t.leader > 63 || t.leader === i) break;
    i = t.leader;
  }
  return i;
}
const novaShareParent = (w, a, b) => novaRoot(w, a) === novaRoot(w, b);

/* AIShipFriendStrength 0x825a8: a ship's class Strength by its shields
   (between a quarter and all), and its escorts' and allies' in the system
   added, each doubled when an enemy of the ship threatens it. A ship with
   no shield capacity keeps the fraction of the ship before it, as the
   program does. */
function novaFriendStrength(w, s) {
  const D = w.D;
  let cap = novaShieldCap(D, s), frac = cap > 0 ? f32(s.shield / cap) : s.shield;
  frac = frac > 1 ? 1 : Math.max(0.25, frac);
  let str = Math.trunc(f32(novaClassFight(D, s.cls).strength * frac));
  for (let i = 0; i < 64; i++) {
    const o = w.ships[i];
    if (!o || i === s.slot || novaDying(o)) continue;
    let v = o.leader === s.slot ? novaClassFight(D, o.cls).strength : novaGovtAllies(D, s.govt, o.govt) ? novaClassFight(D, o.cls).strength : 0;
    cap = novaShieldCap(D, o);
    if (cap > 0) frac = f32(o.shield / cap);
    frac = frac > 1 ? 1 : Math.max(0.25, frac);
    if (v > 0 && novaThreatenedByMyEnemy(w, o, s)) v *= 2;
    str = (Math.trunc(f32(str + f32(v * frac))) << 16) >> 16;
  }
  return str;
}
/* AICalculateOddsAgainst 0x84a2e: the Strength of the ship's enemies in
   the system, and of those attacking it, over its own and its allies'. */
function novaCalcOdds(w, s) {
  const D = w.D;
  let own = novaClassFight(D, s.cls).strength, enemy = 0;
  for (let i = 1; i < 64; i++) {
    const o = w.ships[i];
    if (!o || i === s.slot || o.disabled) continue;
    const st = novaClassFight(D, o.cls).strength;
    if (novaGovtAllies(D, s.govt, o.govt)) own = ((own + st) << 16) >> 16;
    else if (novaGovtEnemies(D, s.govt, o.govt) || (o.primary === s.slot && o.state === 4)) enemy = ((enemy + st) << 16) >> 16;
  }
  s.odds = f32(enemy / (own || 1));
}
/* DoPlayGameWork's round of odds (0x442c1): one ship a step, the first
   waiting (odds below 0), passing the wait to the next. */
function novaOddsRound(w) {
  for (let i = 1; i < 64; i++) {
    const s = w.ships[i];
    if (!s || !(s.odds < 0)) continue;
    const n = w.ships[i < 63 ? i + 1 : 1];
    if (n) n.odds = -1;
    if (s.ai > 0) { novaCalcOdds(w, s); return; }
    s.odds = 0;
  }
}

/* ---- weapons ------------------------------------------------------------ */

const novaCloaked = () => false;
/* WeaponHasAmmo 0xb95a, for a ship not the player's: not one the player
   alone may fire (Flags2 0x0100); a fighter bay's own ammunition, or the
   weapon's own (an ammunition type 0 to 255), or fuel (-1000 and below). */
function novaHasAmmo(w, s, i) {
  const W = novaWeapOf(w.D, i), r = s.wi.get(i);
  if (!W || !r) return false;
  if (W.flags2 & 0x0100) return false;
  if (W.flags2 & 0x0080) {
    const key = novaClassFight(w.D, s.cls).keyCarried;
    if (key === -1) return false;
    return s.weap.some(q => { const B = novaWeapOf(w.D, q.i); return B && B.guid === 99 && q.count > 0 && q.ammo > 0 && B.ammoType - 128 === key; });
  }
  if (W.guid === 99) return r.ammo > 0;
  const A = W.ammoType;
  if (A >= 0 && A <= 255) return r.ammo > 0;
  if (A > -1000) return true;
  return f32((Math.abs(A) - 1000) * 0.1) <= s.fuel;
}
/* AIShipIsOutOfAmmo 0x7f724: 2 with no weapons or all out; 1 when every
   weapon that uses ammunition is out; else 0. */
function novaOutOfAmmo(w, s) {
  let total = 0, uses = 0, empty = 0;
  for (const r of s.weap) {
    if (r.count <= 0) continue;
    total++;
    const A = novaWeapOf(w.D, r.i).ammoType;
    if (A >= -1000 && A <= -1) continue;
    uses++;
    if (A >= 0) { if (r.ammo <= 0) empty++; }
    else if (Math.abs(A) - 1000 > s.fuel) empty++;
  }
  if (!total || (empty > 0 && empty === total)) return 2;
  return empty > 0 && empty === uses ? 1 : 0;
}
// AIHasDestroyingWeapons 0x7fc7c: a weapon that can destroy (not disable-only), armed.
function novaHasDestroying(w, s) {
  return s.weap.some(r => {
    const W = novaWeapOf(w.D, r.i);
    return r.count > 0 && W && W.mass > 0 && !(W.flags2 & 0x1000) && [-1, 0, 3, 4, 6, 7, 8].includes(W.guid) && novaHasAmmo(w, s, r.i);
  });
}
// ShipMaxWeaponRange 0xbafd.
function novaMaxRange(w, s) {
  let m = 0;
  for (const r of s.weap) {
    if (r.count <= 0 || !novaHasAmmo(w, s, r.i)) continue;
    const W = novaWeapOf(w.D, r.i), g = W.guid;
    const v = g === 0 || g === 3 ? W.beamLength : [-1, 4, 7].includes(g) ? Math.trunc(W.range) : g === 1 ? Math.trunc(W.range * 0.85) : g === 6 ? Math.trunc(W.range * 0.5) : 0;
    if (v > m) m = v;
  }
  return Math.min(m, 0x7fff);
}
// AIInGunRange 0x7f9d5: the square of the whole distances on each axis within the weapon's reach.
function novaInGunRange(s, t, W) {
  const dx = Math.trunc(f32(s.x - t.x)), dy = Math.trunc(f32(s.y - t.y)), d2 = dx * dx + dy * dy;
  const r = W.guid === 0 || W.guid === 3 ? W.beamLength + 32 : Math.trunc(f32(W.range + 32));
  return d2 <= r * r;
}
// TurretBlindSpot 0xb325: front, side or back of the ship by the angle, blind by the weapon's Flags or the class's.
function novaBlindSpot(D, s, ang, W) {
  const d = novaAngleApart(Math.trunc(s.heading), ang), zone = d <= 45 ? 0x1000 : d <= 135 ? 0x2000 : 0x4000;
  return !!(W.flags & zone) || !!(novaClassFight(D, s.cls).flags & zone);
}
// Whether the target can be hurt by the weapon: class Flags 0x0400 must match the weapon's Flags2 0x0400.
const novaSameHide = (D, t, W) => (novaClassFight(D, t.cls).flags & 0x400) === (W.flags2 & 0x400);
// WeaponMaxSimultShots 0x834d.
function novaMaxShots(w, s, W, r) {
  if (!(W.flags & 0x40)) return 1;
  if (!(W.flags3 & 1)) return r.count;
  if (W.guid === 99) return Math.min(r.count, r.ammo);
  const A = W.ammoType;
  if (A >= 0 && A <= 255) { const a = s.wi.get(A); return Math.min(r.count, a ? a.ammo : 0); }
  if (A >= -1000) return r.count;
  if (!(s.fuel > 0)) return 0;
  return Math.min(r.count, Math.trunc(s.fuel / ((Math.abs(A) - 1000) * 0.1)));
}

/* ---- who to fight ---------------------------------------------------------- */

// The program's distance for picking: the whole part of each axis, squared.
const novaPickDist = (a, b) => { const dx = Math.trunc(Math.abs(f32(a.x - b.x))), dy = Math.trunc(Math.abs(f32(a.y - b.y))); return dx * dx + dy * dy; };
// The nearest of the candidates, the first on a tie, as the program's strictly-less test leaves it.
function novaNearest(w, s, ok) {
  let best = -1, bd = -1;
  for (let i = 0; i < 64; i++) {
    if (!ok(i)) continue;
    const d = novaPickDist(w.ships[i], s);
    if (bd < 0 || d < bd) { bd = d; best = i; }
  }
  return best;
}

/* SelectWarshipTarget 0x89d5e, the parts about ships not the player: a
   target kept while fighting it; none when out of ammunition; for a
   xenophobic government the nearest enemy it can face (its strength
   within the ship's friends' strength x MaxOdds); else joining an ally's
   fight against a ship it can face (AI types up to 4); else the nearest
   enemy it can face, a fleet's lead preferring the heaviest; else the
   nearest ship threatening it or its escorts. */
function novaSelectTarget(w, s) {
  const D = w.D;
  if (s.primary !== -1 && (s.state === 3 || s.state === 4) && novaActive(w, s.primary)) return;
  if (novaOutOfAmmo(w, s) === 2) return;
  const destroying = novaHasDestroying(w, s), g = D.govts.get(s.govt);
  if (g) {
    const odds = g.maxOdds, cand = new Array(64).fill(false);
    if (g.flags & 1) {
      let n = 0;
      for (let i = 1; i < 64; i++) {
        const o = w.ships[i];
        if (!o || novaDying(o) || o.disabled || !novaVisible(o, s) || i === s.slot || o.leader === s.slot || novaGovtAllies(D, s.govt, o.govt) || !novaIsEnemy(D, s, o)) continue;
        cand[i] = true; n++;
      }
      if (n > 0) {
        const own = novaFriendStrength(w, s);
        for (let i = 0; i < 64; i++) if (cand[i] && novaFriendStrength(w, w.ships[i]) > f32(own * odds)) { cand[i] = false; n--; }
        if (n > 0) { s.primary = novaNearest(w, s, i => cand[i]); return; }
      }
    } else {
      if (s.ai <= 4) {
        let own = null;
        for (let i = 1; i < 64; i++) {
          const o = w.ships[i];
          if (!o || i === s.slot || o.govt === -1 || o.primary === -1 || (o.state !== 3 && o.state !== 4) || !novaGovtAllies(D, s.govt, o.govt)) continue;
          const t = w.ships[o.primary];
          if (!t || !novaVisible(t, s)) continue;
          if (own === null) own = novaFriendStrength(w, s);
          if (f32(own * odds) >= novaFriendStrength(w, t)) { s.primary = o.primary; s.state = 4; return; }
        }
      }
      let n = 0;
      for (let i = 1; i < 64; i++) {
        const o = w.ships[i];
        if (!o || i === s.slot || !novaVisible(o, s) || (!destroying && o.disabled) || !novaIsEnemy(D, s, o)) continue;
        cand[i] = true; n++;
      }
      if (n > 0) {
        const own = novaFriendStrength(w, s), leads = w.ships.some(o => o && o.leader === s.slot);
        let heaviest = -1;
        for (let i = 0; i < 64; i++) {
          if (!cand[i]) continue;
          if (novaFriendStrength(w, w.ships[i]) > f32(own * odds)) { cand[i] = false; n--; continue; }
          if (leads) { const m = novaClassFight(D, w.ships[i].cls).mass; if (heaviest === -1 || m > heaviest) heaviest = m; }
        }
        if (n > 0) s.primary = novaNearest(w, s, i => cand[i] && (heaviest === -1 || novaClassFight(D, w.ships[i].cls).mass === heaviest));
      }
      if (s.primary === -1) s.primary = novaNearest(w, s, i => i !== s.slot && novaActive(w, i) && novaVisible(w.ships[i], s) && novaThreatens(w, w.ships[i], s));
    }
  }
}

/* The leave-or-park test the supervisors share: fuel to jump (above 99),
   not matching velocity with another, and not a person who may not
   leave (përs Flags2 0x0001 with fuel under 100). */
function novaCanLeave(w, s) {
  if (!(s.cls.fuel > 99)) return false;
  const p = s.pers ? w.D.persons.get(s.pers) : null;
  return !(p && (p.Flags2 & 1) && s.fuel < 100);
}
// The supervisors' ladder: to a stellar if not at one, else leave or park.
function novaLadder(w, s) {
  const at = !w.si.nav.some(n => n !== -1) || (s.goal !== -1 && w.si.nav.includes(s.goal));
  if (!at) { s.sec = -1; s.sec = novaPickStellar(w, s, false, false); if (s.sec !== -1) { s.state = 1; return; } }
  if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6;
}
// The shield level under which a ship turns tail: a person's Coward, else by its aggression (1 30%, 2 15%).
function novaCowardice(D, s) {
  const cap = novaShieldCap(D, s), p = s.pers ? D.persons.get(s.pers) : null;
  if (p) return Math.trunc(f32(cap * (p.Coward * 0.01)));
  return s.aggr === 1 ? Math.trunc(cap * 0.3) : s.aggr === 2 ? Math.trunc(cap * 0.15) : -32767;
}
// The odds test of the retreating governments: shields under half, and the odds over MaxOdds, doubled in an allied system with reinforcements on the way.
function novaOddsRetreat(w, s, g) {
  if (!(s.shield < novaShieldCap(w.D, s) * 0.5) || !(s.odds >= 0)) return false;
  return s.odds > g.maxOdds;
}

/* WarshipAI 0x8b729 (PirateWarshipAI 0x8c2d2 is the same for this): pick
   a target when idle or travelling and attack it; turn back from a dead
   or disabled one without destroying weapons; retreat when the odds turn
   (government Flags 0x0010), when the shields fall under the ship's
   cowardice, or out of ammunition (class Flags2 0x0080). */
function novaWarshipAI(w, s) {
  const D = w.D;
  if (s.disabled || s.state === 9 || s.state === 0xf || s.state === 0x16) return;
  if (s.mode === 4 && s.state !== 2 && s.state !== 0xb) s.state = 2;
  if (s.state === 0) {
    if (s.primary !== -1) { if (s.jump <= 0) s.state = 4; }
    else if (s.jump <= 0) {
      novaSelectTarget(w, s);
      if (s.primary !== -1) s.state = 4;
      else { novaLadder(w, s); if (s.primary === -1) novaLadder(w, s); }
    }
  }
  if (s.anger > 0 && s.primary !== -1 && s.jump <= 0 && s.state !== 7 && s.state !== 3) s.state = 4;
  if (s.state === 1 || s.state === 0x14 || s.state === 2) {
    if (s.primary !== -1) { if (s.jump <= 0 && s.state !== 7) s.state = 4; }
    else if (s.state !== 3 && s.jump <= 0) { novaSelectTarget(w, s); if (s.primary !== -1) s.state = 4; }
  }
  if (s.state === 6) {
    s.primary = -1;
    novaSelectTarget(w, s);
    if (s.primary === -1 && !w.ships.some(o => o && o.leader === s.slot && o.ai === 5 && !o.disabled)) s.state = 0;
  }
  if (s.primary !== -1) {
    if (s.state === 4) {
      const t = w.ships[s.primary];
      if (!t || novaDying(t) || (t.disabled && !novaHasDestroying(w, s))) { s.state = 0; s.primary = -1; }
    }
    const g = D.govts.get(s.govt);
    if (s.primary !== -1 && g && s.state === 4 && (g.flags & 0x10) && novaOddsRetreat(w, s, g)) s.state = 3;
    if (s.primary !== -1 && s.state !== 7 && s.state !== 3) {
      if (s.jump <= 0) s.state = 4;
      if (novaCowardice(D, s) > s.shield && s.leader === -1 && g && (g.flags & 0x10) && ![2, 3, 0xb].includes(s.state)) s.state = 3;
      if ((novaClassFight(D, s.cls).flags2 & 0x80) && novaOutOfAmmo(w, s) && ![2, 3, 0xb].includes(s.state)) s.state = 3;
    }
  }
  if (s.state === 2 && !novaCanLeave(w, s)) {
    s.sec = -1; s.sec = novaPickStellar(w, s, false, false);
    if (s.sec !== -1) s.state = 1; else s.state = 6;
  }
  if (s.state === 4 && novaOutOfAmmo(w, s) === 2) Object.assign(s, { state: 0, mode: 0, primary: -1, sec: -1 });
}

/* InterceptorAI 0x8c895: idle or travelling, a target picked as a warship
   picks it, else a ship at random to go and look at; the rest as before
   (nova-flight.js), and retreat by the odds (government Flags 0x0100). */
function novaInterceptorFight(w, s) {
  const D = w.D, g = D.govts.get(s.govt);
  if (s.anger > 0 && s.primary !== -1 && ![3, 7, 9, 0xf].includes(s.state) && s.jump <= 0) s.state = 4;
  if ((s.state === 0 || s.state === 1 || s.state === 0x14) && s.timer <= 0) {
    if (s.primary !== -1) { if (s.jump <= 0 && novaActive(w, s.primary) && s.anger > 0) s.state = 4; }
    else { novaSelectTarget(w, s); if (s.primary !== -1 && s.jump <= 0) s.state = 4; }
  }
  return g;
}
function novaInterceptorTail(w, s, g) {
  const D = w.D;
  if (g && s.state === 4 && (g.flags & 0x0100) && novaOddsRetreat(w, s, g)) s.state = 3;
  if (s.primary !== -1 && s.state === 4) { const t = w.ships[s.primary]; if (t && t.disabled && !novaHasDestroying(w, s)) { s.primary = -1; s.state = 0; } }
  if ((novaClassFight(D, s.cls).flags2 & 0x80) && novaOutOfAmmo(w, s) && ![2, 3, 0xb].includes(s.state)) s.state = 3;
  if (s.primary !== -1 && s.state === 7) {
    const t = w.ships[s.primary];
    if (!t || !novaVisible(t, s)) Object.assign(s, { primary: -1, sec: -1, state: 0, mode: 0 });
    else if (g) { const old = s.primary; novaSelectTarget(w, s); if (s.primary === -1) { s.primary = old; s.state = 7; } }
  }
}
/* The traders hit back (WimpyTraderAI 0x8b029, BraveTraderAI 0x8b493):
   angered by a ship it can name, a wimpy trader flees (state 3); a brave
   one fights within 1,250, else flees. Their calls for help reach only
   the player. */
function novaTraderFight(w, s, brave) {
  if (!(s.anger > 0) || s.primary === -1) return;
  const t = w.ships[s.primary];
  if (brave && t && Math.abs(Math.trunc(f32(s.x - t.x))) <= 1250 && Math.abs(Math.trunc(f32(s.y - t.y))) <= 1250) { if (s.jump <= 0) s.state = 4; }
  else if (s.leader === 0) { s.state = 10; s.sec = 0; }
  else s.state = 3;
}

/* ---- the attack states and moves ---------------------------------------- */

/* HighLevelAIHandler 0x8d453, the parts about a target, before the travel
   states: a target that cannot be seen (one coming out of a gate) is
   given up by a trader, or waited for 100 to 199 steps, braking. Returns
   true when the handler stops there. */
function novaHighTarget(w, s) {
  const D = w.D;
  if (s.state === 0xb && !novaCanLeave(w, s)) { s.state = 5; s.primary = -1; s.sec = s.leader; }
  if (s.primary === -1 || (s.state !== 4 && s.state !== 0xd)) return false;
  const t = w.ships[s.primary];
  if (t && novaVisible(t, s)) { s.patience = -1; return false; }
  if (s.ai <= 2) { if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6; return false; }
  s.mode = 1; s.jump = 0; s.sec = -1;
  if (s.patience < 0) { s.patience = w.rand(100) + 100; return true; }
  s.patience = f32(s.patience - 1);
  if (s.patience <= 0) Object.assign(s, { primary: -1, state: 0, mode: 0, patience: -1 });
  void D;
  return true;
}
/* The attack states (HighLevelAIHandler 0x8d453, after the travel
   states): 3 retreating -- away from a target within 250, else out of the
   system and jumping; 4 attacking -- giving up squad-mates and the dead,
   standing off at weapon range (class Flags2 0x0002), chasing, giving up
   a hopeless chase, or closing to fight; 14 a timed coast. */
function novaHighAttack(w, s) {
  const D = w.D;
  if (s.state === 3) {
    if (s.jump > 0) { if (Math.abs(f32(f32(s.x * s.x) + f32(s.y * s.y))) > 1e6) s.mode = 4; else { s.jump = 0; s.mode = 3; } }
    else if (s.primary !== -1) {
      const t = w.ships[s.primary];
      const near = t && Math.abs((Math.trunc(f32(s.x - t.x)) << 16) >> 16) <= 250 && Math.abs((Math.trunc(f32(s.y - t.y)) << 16) >> 16) <= 250;
      if (near && s.mode !== 4) { if (s.jump <= 0) s.mode = 5; }
      else if (f32(f32(s.x * s.x) + f32(s.y * s.y)) > 1e6) {
        if (novaCanLeave(w, s)) s.mode = s.cls.quickJump || (Math.abs(s.vx) < 0.35 && Math.abs(s.vy) < 0.35) ? 4 : 1;
        else s.mode = 3;
      } else s.mode = 3;
    } else Object.assign(s, { state: 0, mode: 0, anger: 0 });
  }
  if (s.state === 4) {
    s.jump = 0;
    if (s.primary === -1 || s.timer > 0) { s.state = 0; }
    else {
      const t = w.ships[s.primary], stop = () => { Object.assign(s, { state: 0, mode: 0, primary: -1 }); return true; };
      const L = s.leader;
      if (t && s.govt !== -1 && L !== 0 && novaGovtAllies(D, s.govt, t.govt) && t.leader !== 0) { Object.assign(s, { state: 0, mode: 0 }); return; }
      if (L !== -1) {
        if (L === s.primary) { stop(); return; }
        const T = t ? t.leader : -1;
        if (T === L) { stop(); return; }
        if (T !== -1 && w.ships[T]) {
          const TT = w.ships[T].leader;
          if (TT !== -1) {
            if (TT === T) { stop(); return; }
            const LL = w.ships[L] ? w.ships[L].leader : -1;
            if (LL !== -1 && w.ships[LL] && w.ships[LL].leader === TT) { stop(); return; }
          }
        }
      }
      if (!t || novaDying(t)) { Object.assign(s, { primary: -1, anger: 0, state: 0 }); }
      else {
        const dx = Math.abs(f32(s.x - t.x)), dy = Math.abs(f32(s.y - t.y)), cf = novaClassFight(D, s.cls);
        if (dx > 165 || dy > 165) {
          if (cf.flags2 & 2) {
            let r = Math.trunc(novaMaxRange(w, s) * 0.85);
            if (t.disabled) r = Math.trunc(r * 0.5);
            s.mode = dx > r || dy > r ? 7 : 0xe;
          } else if (novaHopeless(w, s)) { if (s.ai > 2) s.mode = 0xe; else { s.state = 3; s.mode = 5; } }
          else if ((cf.flags2 & 1) && s.mate > 0 && s.mate !== s.leader) s.mode = 0x12;
          else if (s.mode !== 0x11) s.mode = 7;
        } else if (cf.flags2 & 2) s.mode = 5;
        else if (s.mode !== 0x10 && s.mode !== 0x11) s.mode = 6;
      }
    }
  }
  if (s.state === 0xe) {
    s.primary = -1; s.sec = -1; s.mode = 0;
    const p = { x: s.x, y: s.y }; novaAccel(Math.trunc(s.heading), f32(0.7), p); s.x = p.x; s.y = p.y;
    if (s.timer <= 0) s.state = 0;
  }
}
/* AIEvalHopelessChase 0x80ea9: a retreating target running away, from a
   ship of Mass 100 or more no faster than it, or a homing missile in reach
   and the ship slower. */
function novaHopeless(w, s) {
  const t = s.primary !== -1 ? w.ships[s.primary] : null;
  if (!t || t.state !== 3 || novaClassFight(w.D, s.cls).mass <= 99) return false;
  const rx = f32(t.vx - s.vx), ry = f32(t.vy - s.vy);
  if (Math.abs(rx) <= 0.35 && Math.abs(ry) < 0.35) return false;
  const d = novaBearing(0, 0, rx, ry) - novaBearing(t.x, t.y, s.x, s.y);
  if (d >= -89 && d <= 89) return false;
  const d2 = Math.abs(f32(f32((s.x - t.x) ** 2) + f32((s.y - t.y) ** 2))) * 0.8;
  for (const r of s.weap) {
    const W = novaWeapOf(w.D, r.i);
    if (r.count <= 0 || !(r.ammo > 0 || r.ammo === -1) || W.guid !== 1 || !novaSuitableMissile(W, t) || !novaHasAmmo(w, s, r.i)) continue;
    if (f32(W.range * W.range) >= d2) return s.cls.speed < t.cls.speed;
  }
  return !(s.cls.speed > t.cls.speed);
}

/* The attack moves (LowLevelAIHandler 0x851da): 5 heading away from the
   target, turrets firing; 6 at it, guns firing within three turns of
   lining up, breaking away head-on (10) or boosting (17) when the program
   says; 7 aiming as the guided weapons need; 14 braking while aiming; 16
   the break-away; 17 the boost. Returns nothing; nova-flight.js's modes
   take the rest. */
function novaLowAttack(w, s) {
  const D = w.D, ok = !s.disabled;
  if (!ok || s.primary === -1) return;
  const t = w.ships[s.primary];
  if (!t) return;
  const turn = novaShipTurn(s), apart = () => novaAngleApart(s.want, Math.trunc(s.heading));
  const dx = Math.abs(f32(s.x - t.x)), dy = Math.abs(f32(s.y - t.y));
  const ix = () => novaBearing(s.x, s.y, t.x, t.y);
  if (s.mode === 5) {
    s.want = novaBearing(t.x, t.y, s.x, s.y);
    if (apart() < turn + 20) { s.thrust = novaShipAccel(D, s); s.desired = 0; }
    if (s.state === 3 || s.state === 4) novaFireTurret(w, s);
    if (s.boost && (dx < 165 || dy < 165)) s.mode = 0x11;
  }
  if (s.mode === 6) {
    const W = s.lastW !== -1 ? novaWeapOf(D, s.lastW) : null;
    if (W && (W.guid === -1 || W.guid === 6)) s.want = novaLeadAngle(s, t, W, s);
    else if (s.lastGun !== -1) s.want = novaLeadAngle(s, t, novaWeapOf(D, s.lastGun), s);
    else s.want = ix();
    novaFireTurret(w, s);
    if (apart() < turn + 15) { s.thrust = novaShipAccel(D, s); s.desired = 0; }
    if (apart() < turn * 3) {
      novaFireGun(w, s, false);
      if (novaInertialess(s) && dx < 100 && dy < 100 && s.speed > t.speed) s.desired = t.speed;
    }
    if (!(dx >= 165 && dy >= 165 && novaInertialess(s))) {
      // AIPerformsComplexManeuvers draws Rand(1344) and asks the player's rating, 0 on the map
      const go = w.rand(2) === 0 || (w.rand(0x540) + 256 <= 0);
      const cf = novaClassFight(D, s.cls), tf = novaClassFight(D, t.cls);
      if (go && cf.inherentAI > 2 && cf.mass <= 199 && Math.abs(Math.trunc(f32(s.x - t.x))) <= 122 && Math.abs(Math.trunc(f32(s.y - t.y))) <= 122 &&
          (t.slot < s.slot || (t.slot > s.slot && cf.mass < tf.mass))) {
        const a = ix();
        if (novaAngleApart(Math.trunc(s.heading), a) <= 30 && novaAngleApart(Math.trunc(t.heading), (a + 180) % 360) <= 30) {
          s.mode = 0x10;
          s.evade = Math.trunc(f32(s.heading + (s.slot & 1 ? -135 : 135)));
          s.evade = ((s.evade % 360) + 360) % 360;
        }
      }
    }
    if (s.boost && Math.abs(Math.trunc(f32(s.x - t.x))) > 82 && Math.abs(Math.trunc(f32(s.y - t.y))) > 82 && novaAngleApart(Math.trunc(s.heading), ix()) <= 30) s.mode = 0x11;
  }
  if (s.mode === 0x10) {
    s.want = s.evade; s.thrust = f32(novaShipAccel(D, s) * 1.5); s.desired = 0;
    const ix2 = Math.trunc(f32(s.x - t.x)), iy2 = Math.trunc(f32(s.y - t.y));
    if (ix2 >= -164 && ix2 <= 164 && iy2 >= -164 && iy2 <= 164) novaFireTurret(w, s);
    if (novaInertialess(s)) { if (Math.abs(ix2) > 165 || Math.abs(iy2) > 165) s.mode = 6; }
    else if (novaAngleApart(Math.trunc(s.heading), s.evade) < turn * 3) s.mode = 6;
  }
  if (s.mode === 0x11) {
    s.thrust = f32(novaShipAccel(D, s) * 2.75); s.desired = f32(novaShipMaxSpeed(D, s) * 1.8); s.want = ix();
    const ix2 = Math.trunc(f32(s.x - t.x)), iy2 = Math.trunc(f32(s.y - t.y));
    if (ix2 >= -164 && ix2 <= 164 && iy2 >= -164 && iy2 <= 164) { novaFireTurret(w, s); if (apart() < turn * 3) novaFireGun(w, s, false); }
    else if (apart() < turn * 3) novaFireMissile(w, s);
    if (ix2 >= -165 && ix2 <= 165 && iy2 >= -165 && iy2 <= 165) s.mode = 6;
    else if (w.rand(100) === 0) s.mode = 6;
  }
  if (s.mode === 7) {
    s.want = s.lastGun !== -1 && s.lastW !== -1 ? novaLeadAngle(s, t, novaWeapOf(D, s.lastW), s) : ix();
    if (apart() < turn * 3) { novaFireGun(w, s, false); novaFireTurret(w, s); }
    if (apart() < turn * 4) { s.thrust = novaShipAccel(D, s); s.desired = 0; novaFireMissile(w, s); }
    if (s.boost && Math.abs(Math.trunc(f32(s.x - t.x))) > 82 && Math.abs(Math.trunc(f32(s.y - t.y))) > 82 && novaAngleApart(Math.trunc(s.heading), ix()) <= 30) s.mode = 0x11;
  }
  if (s.mode === 0xe) {
    if (Math.abs(s.vx) >= 0.35 || Math.abs(s.vy) >= 0.35) {
      if (novaInertialess(s)) s.thrust = -novaShipAccel(D, s);
      else {
        s.want = s.lastGun !== -1 ? novaLeadAngle(s, t, novaWeapOf(D, s.lastGun), s) : (novaBearing(0, 0, f32(s.vx * 100), f32(s.vy * 100)) + 180) % 360;
        if (apart() < turn + 1) s.thrust = novaShipAccel(D, s);
      }
    } else {
      s.vx = f32(s.vx * 0.95); s.vy = f32(s.vy * 0.95);
      s.want = ix();
      if (apart() < turn * 3) { novaFireGun(w, s, false); novaFireMissile(w, s); }
      novaFireTurret(w, s);
    }
  }
}
/* CalcLeadAngle 0x2b025: where to aim a gun so that its shot meets the
   target, from where the shot leaves (`from`), a rocket's flight by its
   own curve. */
function novaLeadAngle(s, t, W, from) {
  let a = novaBearing(from.x, from.y, t.x, t.y);
  if (!W || ![-1, 4, 6, 7, 8, 9].includes(W.guid)) return a;
  const d = f32(Math.sqrt(f32(f32(f32(t.x - from.x) ** 2) + f32(f32(t.y - from.y) ** 2)))), spd = W.speed;
  let tt;
  if (W.guid === 6) tt = spd * 19.59 >= d ? f32(d / (spd * 0.316)) : f32((d + spd * -19.59) / spd + 2.066666666666667);
  else tt = f32(d / spd);
  const px = f32(t.x + f32(f32(t.vx - s.vx) * tt)), py = f32(t.y + f32(f32(t.vy - s.vy) * tt));
  a = novaBearing(from.x, from.y, px, py);
  return a;
}

/* ---- choosing to fire -------------------------------------------------- */

/* AIFireGun 0x7feb6: the forward gun (guidance -1, 0 or 6, or homing when
   allowed) doing the most damage that is loaded, ready and in reach --
   energy damage while the target has any shield, mass damage after -- a
   rocket not fired inside two and a half times its proximity. */
function novaFireGun(w, s, homing) {
  const D = w.D, t = s.primary !== -1 ? w.ships[s.primary] : null;
  if (!t || !novaVisible(t, s)) return;
  const best = [0, 0], pick = [-1, -1];
  let nonHoming = false;
  for (const r of s.weap) {
    if (r.count <= 0) continue;
    const W = novaWeapOf(D, r.i), g = W.guid;
    if (!(g === -1 || g === 0 || g === 6 || (g === 1 && homing))) continue;
    if (!novaSameHide(D, t, W) || !novaHasAmmo(w, s, r.i)) continue;
    if (g !== 1) nonHoming = true;
    if (r.reload > 0 || !novaInGunRange(s, t, W)) continue;
    for (let k = 0; k < 2; k++) {
      const d = Math.max(1, k ? W.energy : W.mass);
      if (g === 6 && W.prox > 0 && !(Math.abs(f32(s.x - t.x)) >= W.prox * 2.5 && Math.abs(f32(s.y - t.y)) >= W.prox * 2.5)) continue;
      if (d > best[k]) { best[k] = d; pick[k] = r.i; }
    }
  }
  const c = t.shield >= 0 ? pick[1] : pick[0];
  if (c >= 0) s.lastW = c;
  if (s.lastW !== -1) s.latch = true;
  else if (!homing && !nonHoming) novaFireGun(w, s, true);
}
/* AIFireTurret 0x80ad3: the turret doing the most damage that is ready,
   bears on the target (a quadrant turret within 45 degrees of its side)
   and reaches it. */
function novaFireTurret(w, s) {
  const D = w.D;
  if (s.disabled || s.primary === -1) return;
  const t = w.ships[s.primary];
  if (!t || (novaClassFight(D, t.cls).flags2 & 4) || !novaVisible(t, s)) return;
  const best = [0, 0], pick = [-1, -1];
  // the angle a turret of guidance 3 or 4 is tested at is left over from the last quadrant turret, uninitialised before one; here the target's bearing
  let ang = novaBearing(s.x, s.y, t.x, t.y);
  for (const r of s.weap) {
    if (r.count <= 0 || r.reload > 0) continue;
    const W = novaWeapOf(D, r.i), g = W.guid;
    if (![3, 4, 7, 8].includes(g) || !novaSameHide(D, t, W)) continue;
    let inArc = true;
    if (g === 7 || g === 8) {
      ang = novaBearing(s.x, s.y, t.x, t.y);
      const d = g === 7 ? Math.trunc(f32(ang - s.heading)) : ang - (Math.trunc(s.heading) + 180) % 360;
      inArc = Math.abs(d) % 360 <= 45;
    }
    if (novaBlindSpot(D, s, ang, W) || !inArc || !novaInGunRange(s, t, W) || !novaHasAmmo(w, s, r.i)) continue;
    for (let k = 0; k < 2; k++) { const d = Math.max(1, k ? W.energy : W.mass); if (d > best[k]) { best[k] = d; pick[k] = r.i; } }
  }
  const c = t.shield >= 0 ? pick[1] : pick[0];
  if (c !== -1) { s.lastW = c; s.latch = true; }
}
/* AIFireMissile 0x8115d: the first homing missile suited to the target
   (SuitableMissileType) whose reach is more than the distance (less a
   twentieth), unless enough missiles are already on their way to it
   (SufficentTargetedDamage: their damage over 1.05 times its shields
   and armour). */
function novaFireMissile(w, s) {
  const D = w.D, t = s.primary !== -1 ? w.ships[s.primary] : null;
  if (!t || ((novaClassFight(D, t.cls).flags2 & 4))) return;
  if (t.targeted >= f32(t.shield + t.armor) * 1.05) return;
  const d2 = Math.abs(f32(f32((s.x - t.x) ** 2) + f32((s.y - t.y) ** 2))) * 0.95;
  for (const r of s.weap) {
    const W = novaWeapOf(D, r.i);
    if (r.count <= 0 || W.guid !== 1 || !novaSuitableMissile(W, t) || !novaSameHide(D, t, W) || !novaHasAmmo(w, s, r.i)) continue;
    if (f32(W.range * W.range) >= d2) { if (r.reload <= 0) { s.lastW = r.i; s.latch = true; } return; }
  }
}
// SuitableMissileType 0x34df: one for slow ships (Flags 0x0008) only at a target turning 3 or less; else one turning faster than 2, or any at such a target.
function novaSuitableMissile(W, t) {
  const turn = Math.trunc(novaShipTurn(t));
  if ((W.flags & 8) && turn > 3) return false;
  return W.guidedTurn > 2 || turn <= 3;
}
/* CalculateTargetedDamage 0x3a153, at the start of each step: the damage
   on its way to each ship in homing missiles locked on it. */
function novaTargetedDamage(w) {
  for (const s of w.ships) if (s) s.targeted = 0;
  for (const sh of w.shots) {
    if (!sh || !(sh.life > 0) || sh.lost || sh.target < 0 || sh.target > 63) continue;
    const t = w.ships[sh.target], W = novaWeapOf(w.D, sh.w);
    if (t) t.targeted = Math.trunc(t.targeted + (W.mass + W.energy) * 0.5);
  }
}
/* ShipECM 0x3b05: a ship's jamming of type k, kept once worked out: its
   class's government's InhJam, and the default outfits of ModType 33 to
   36, halved for a government with Flags 0x0080, between 0 and 100;
   none while disabled. */
function novaECM(w, s, k) {
  if (s.disabled) return 0;
  if (!s.ecm) s.ecm = [-1, -1, -1, -1];
  if (s.ecm[k] >= 0) return s.ecm[k];
  const D = w.D, r = s.cls.rec, g = D.u.govts.get(r.InherentGovt);
  let v = g && g.InhJam ? g.InhJam[k] || 0 : 0;
  const items = [...(r.DefaultItems || []), ...(r.DefaultItms2 || [])], counts = [...(r.ItemCount || []), ...(r.ItemCount2 || [])];
  items.forEach((id, i) => {
    if (!(counts[i] > 0)) return;
    const o = novaGet(D.u.game, 'oütf', id);
    if (!o) return;
    [[o.ModType, o.ModVal], [o.ModType2, o.ModVal2], [o.ModType3, o.ModVal3], [o.ModType4, o.ModVal4]].forEach(([t, val]) => { if (t === 33 + k) v += val || 0; });
  });
  const og = D.govts.get(s.govt);
  if (og && (og.flags & 0x80)) v = Math.trunc(v / 2);
  return (s.ecm[k] = Math.min(100, Math.max(0, v)));
}

/* HandleShotGuidance 0x320dd: a homing missile turned toward its target
   at GuidedTurn a step once 15 steps old -- jammed (turning not at all,
   or away, Seeker 0x0010) when the target's ECM beats the missile's roll,
   a target it cannot see given up, one passed by lost (Seeker 0x4000),
   an asteroid it passes taking it (Seeker 0x0002); a missile confused by
   the system's interference spiralling; its velocity its Speed along its
   heading. A rocket eases its velocity onto its heading; a bomb turns to
   its velocity. */
function novaShotGuidance(w, sh) {
  const D = w.D, W = novaWeapOf(D, sh.w), g = W.guid;
  if (g === 9) return;
  const age = W.count - sh.life, fresh = () => { const v = { x: 0, y: 0 }; novaAccel(Math.trunc(sh.heading), W.speed, v); sh.vx = Math.min(W.speed, Math.max(-W.speed, v.x)); sh.vy = Math.min(W.speed, Math.max(-W.speed, v.y)); };
  const wrap = () => { if (sh.heading >= 360) sh.heading = f32(sh.heading - 360); if (sh.heading < 0) sh.heading = f32(sh.heading + 360); };
  const turnTo = (a, rate) => {
    if (Math.abs(novaAngleApart(a, Math.trunc(sh.heading))) > Math.abs(Math.trunc(rate))) {
      let d = a - Math.trunc(sh.heading);
      if (d >= 360) d -= 360;
      if (d <= -1) d += 360;
      sh.heading = d > 180 ? f32(sh.heading - rate) : f32(sh.heading + rate);
    }
  };
  if (!sh.lost && g === 1) {
    const t = sh.target >= 0 && sh.target <= 63 ? w.ships[sh.target] : null;
    let a = Math.trunc(sh.heading), rate = W.guidedTurn;
    if (sh.target !== -1 && !t) { sh.target = -1; }
    if (t) a = novaBearing(sh.x, sh.y, t.x, t.y);
    if (age > 15) {
      if (t) for (let k = 0; k < 4; k++) {
        if (!(sh.jam[k] > 0) || novaECM(w, t, k) <= 100 - sh.jam[k]) continue;
        if (rate > 0) rate = (W.seeker & 0x10) ? -rate : 0;
        if ((W.seeker & 0x8000) && w.rand(500) === 0 && sh.owner >= 0 && sh.owner <= 63) { sh.target = sh.owner; sh.owner = -1; }
        break;
      }
      const o = sh.owner >= 0 && sh.owner <= 63 ? w.ships[sh.owner] : null;
      if (t && o && !novaVisible(t, o)) {
        if ((W.seeker & 0x8000) && w.rand(1000) === 0 && sh.owner !== -1) { sh.target = sh.owner; sh.owner = -1; }
        rate = 0;
      }
      if ((W.seeker & 0x4000) && t) {
        const dx = Math.trunc(f32(t.x - sh.x)), dy = Math.trunc(f32(t.y - sh.y));
        if (dx >= -249 && dx <= 249 && dy >= -249 && dy <= 249 && Math.abs(Math.trunc(f32(novaBearing(sh.x, sh.y, t.x, t.y) - sh.heading))) % 360 > 45) sh.target = -1;
      }
      turnTo(a, rate);
    }
    wrap(); fresh();
    if (W.seeker & 2) {
      if (w.rand(10) === 0) for (let i = 0; i < 16; i++) {
        const r = w.roids[i];
        if (!r.active) continue;
        const dx = Math.trunc(f32(r.x - sh.x)), dy = Math.trunc(f32(r.y - sh.y));
        if (dx < -199 || dx > 199 || dy < -199 || dy > 199) continue;
        if (Math.abs(Math.trunc(f32(novaBearing(sh.x, sh.y, r.x, r.y) - sh.heading))) % 360 <= 15) { sh.lost = 1; sh.target = i; break; }
      }
    }
  } else if (sh.lost === 999) {
    if (age > 15) sh.heading = (w.t * 2) % 300 <= 149 ? f32(sh.heading - W.guidedTurn) : f32(sh.heading + W.guidedTurn);
    wrap(); fresh();
    if ((W.seeker & 0x8000) && w.rand(1000) === 0 && sh.owner >= 0 && sh.owner <= 63) { sh.lost = 0; sh.target = sh.owner; sh.owner = -1; }
  } else if (sh.lost === 1) {
    const r = sh.target >= 0 && sh.target < 16 ? w.roids[sh.target] : null;
    let a = Math.trunc(sh.heading);
    if (r && r.active) a = novaBearing(sh.x, sh.y, r.x, r.y); else sh.target = -1;
    if (age > 15 && Math.abs(novaAngleApart(a, Math.trunc(sh.heading))) > W.guidedTurn) {
      let d = Math.trunc(f32(a - sh.heading));
      if (d >= 360) d -= 360;
      if (d <= -1) d += 360;
      sh.heading = d > 180 ? f32(sh.heading - W.guidedTurn) : f32(W.guidedTurn + sh.heading);
    }
    wrap(); fresh();
  }
  if (g === 6) {
    const v = { x: 0, y: 0 }; novaAccel(Math.trunc(sh.heading), W.speed, v);
    sh.vx = f32(f32(f32(sh.vx * 95) + f32(v.x * 5)) * 0.01); sh.vy = f32(f32(f32(sh.vy * 95) + f32(v.y * 5)) * 0.01);
  }
  if (g === 5) {
    const a = novaBearing(0, 0, f32(sh.vx * 1000), f32(sh.vy * 1000));
    if (novaAngleApart(a, Math.trunc(sh.heading)) > 0) {
      let d = Math.trunc(f32(a - sh.heading));
      if (d >= 360) d -= 360;
      if (d <= -1) d += 360;
      sh.heading = d > 180 ? f32(sh.heading - 1) : f32(sh.heading + 1);
    }
  }
}
// AIEscortFireUnprovoked 0x80e53: an escort's turrets at its target while it lives.
function novaEscortFireUnprovoked(w, s) {
  if (s.ai <= 4 || s.primary === -1) return;
  const t = w.ships[s.primary];
  if (t && !t.disabled) novaFireTurret(w, s); else s.primary = -1;
}

/* ---- firing ------------------------------------------------------------------ */

/* FireAIShipWeapon 0x8873d: the weapon chosen, ready and loaded, fired
   as many times as it fires at once -- a turret at a target in reach and
   not in a blind spot, a quadrant turret within 45 degrees of its side, a
   forward gun straight ahead -- its ammunition or fuel spent, its recoil
   pushing the ship back, then reloaded: Reload over its count for each
   shot (or whole, Flags 0x0040), or BurstReload at the end of a burst. */
function novaFireShipWeapon(w, s) {
  const D = w.D, i = s.lastW, r = s.wi.get(i), W = novaWeapOf(D, i);
  if (!r || !W || r.reload > 0 || r.count <= 0) return;
  const n = novaMaxShots(w, s, W, r);
  let fired = 0;
  for (let k = 0; k < n; k++) {
    if (!novaHasAmmo(w, s, i)) continue;
    const t = s.primary !== -1 ? w.ships[s.primary] : null, g = W.guid;
    if (t && (g === 3 || g === 4)) {
      const a = novaBearing(s.x, s.y, t.x, t.y);
      if (!novaBlindSpot(D, s, a, W)) {
        const R = g === 3 ? W.beamLength + 32 : Math.trunc(f32(W.range + 32));
        if (Math.abs(f32(s.x - t.x)) < R && Math.abs(f32(s.y - t.y)) < R) { if (g === 4) novaSpawnShot(w, s.slot, s.primary, i, false); else novaSpawnBeam(w, s.slot, s.primary, i, -1, -1); fired++; }
      }
    }
    if (t && (g === 7 || g === 8)) {
      const R = Math.trunc(f32(W.range + 32));
      if (Math.abs(f32(s.x - t.x)) < R && Math.abs(f32(s.y - t.y)) < R) {
        const a = novaBearing(s.x, s.y, t.x, t.y);
        const d = g === 7 ? Math.trunc(f32(a - s.heading)) : a - (Math.trunc(s.heading) + 180) % 360;
        if (Math.abs(d) % 360 <= 45) { novaSpawnShot(w, s.slot, s.primary, i, false); fired++; }
      }
    }
    if (!t && g === 7) { novaSpawnShot(w, s.slot, -1, i, false); fired++; }
    if (t && g === 1) { novaSpawnShot(w, s.slot, s.primary, i, false); fired++; }
    if (g === -1 || g === 6) { novaSpawnShot(w, s.slot, s.primary, i, false); fired++; }
    else if (g === 0) { novaSpawnBeam(w, s.slot, s.primary, i, -1, -1); fired++; }
    const A = W.ammoType;
    if (A === -1 || (W.flags3 & 1)) continue;
    if (g === 99 || (A >= 0 && A <= 255)) r.ammo--;
    else if (A <= -1000) { s.fuel = f32(s.fuel + f32((Math.abs(A) - 1000) * -0.1)); if (!(s.fuel >= 0)) s.fuel = 0; }
  }
  if (fired <= 0) return;
  if (W.flags2 & 0x0200) s.flash = 32;
  if (W.recoil !== -1 && W.recoil !== 0) {
    const v = { x: s.vx, y: s.vy }, c = novaClassFight(D, s.cls);
    novaAdjustedAccel(Math.trunc(f32(s.heading + 180)) % 360, f32(W.recoil / c.mass), s.cls.speed, v); s.vx = v.x; s.vy = v.y;
  }
  let rel = (W.flags & 0x40) ? f32(W.reload) : f32(fired * f32(W.reload / r.count));
  if (W.burstCount > 0) {
    r.burst++;
    if ((W.flags3 & 1) && r.burst % W.burstCount === 0) {
      const k = (W.flags & 0x40) ? fired : 1;
      if (W.guid === 99 || r.ammo > 0) { r.ammo -= k; if (r.ammo < 0) r.ammo = 0; }
      else if (W.ammoType <= -1000) { s.fuel = f32(s.fuel + f32((Math.abs(W.ammoType) - 1000) * -0.1 * k)); if (!(s.fuel >= 0)) s.fuel = 0; }
    }
    if (r.burst >= ((W.flags & 0x40) ? W.burstCount : W.burstCount * r.count)) { r.burst = 0; rel = f32(W.burstReload); }
  }
  r.reload = rel;
  if (W.flags3 & 0x20) for (const q of s.weap) if (q !== r && f32(rel + 2) > q.reload) q.reload = f32(rel + 2);
  if (W.guid === -1 || W.guid === 6) s.lastGun = i;
}

/* ModifyShotStartPosition 0x7348 and ModifyShotStartPosition2 0x706e:
   where a shot leaves the ship, at the next of the four exit points the
   shän gives for its kind of weapon (or the one nearest the target,
   Flags3 0x0010), turned with the ship's frame and squashed by the shän's
   compression. Returns the exit point used, or -1. */
function novaShotStart(w, s, pos, W, tpos) {
  const et = W.exitType;
  if (et < 0 || et > 3) return -1;
  const c = novaClassFight(w.D, s.cls), fp = c.framesPer;
  const rot = Math.trunc(((s.frame || 0) % fp) * (360 / fp));
  const place = (p, idx) => {
    const k = idx + 4 * et, off = { x: 0, y: 0 };
    novaAccel(rot, c.y[k], off); novaAccel((rot + 90) % 360, c.x[k], off);
    if (off.y < 0) { off.x = f32(off.x * c.up.x); off.y = f32(off.y * c.up.y); } else { off.x = f32(off.x * c.dn.x); off.y = f32(off.y * c.dn.y); }
    off.y = f32(off.y - c.z[k]);
    p.x = f32(p.x + off.x); p.y = f32(p.y + off.y);
  };
  if ((W.flags3 & 0x10) && tpos) {
    let best = -1, bd = 0;
    for (let idx = 0; idx < 4; idx++) {
      const p = { x: pos.x, y: pos.y }; place(p, idx);
      const d = f32(f32((p.x - tpos.x) ** 2) + f32((p.y - tpos.y) ** 2));
      if (best === -1 || d < bd) { best = idx; bd = d; }
    }
    s.exits[et] = best;
  }
  if (s.exits[et] > 3) s.exits[et] = w.rand(4);
  place(pos, s.exits[et]);
  const used = s.exits[et];
  s.exits[et] = (used + 1) % 4;
  return used;
}

/* SpawnShot 0x3e550: a shot in the first free place of 128, from the
   ship's exit point, at its heading (a turret's lead on the target) give
   or take its Inaccuracy, at the ship's velocity plus its Speed. */
function novaSpawnShot(w, owner, target, i, isSub) {
  const D = w.D, W = novaWeapOf(D, i);
  if (!W || W.graphic > 255) return -1;
  const slot = w.shots.findIndex(x => !x);
  if (slot < 0) return -1;
  const s = owner >= 0 && owner <= 63 ? w.ships[owner] : null, fromShip = !!s && !isSub, g = W.guid;
  const t = target >= 0 && target <= 63 ? w.ships[target] : null;
  const sh = { slot, w: i, owner, target, x: 0, y: 0, vx: 0, vy: 0, heading: 0, life: W.count, anim: 0, frame: 0, decayAcc: 0, decays: 0,
               lost: 0, dis: !!(W.flags2 & 0x1000), dodge: -1, dur: W.durability > 0 ? W.durability : 0 };
  let hd = 0, turret = false;
  if (fromShip) {
    sh.x = s.x; sh.y = s.y; sh.vx = s.vx; sh.vy = s.vy; hd = Math.trunc(s.heading);
    if ((g === 4 || g === 7 || g === 8) && t) { hd = novaBearing(s.x, s.y, t.x, t.y); turret = true; }
    if (g === 5) { sh.vx = f32(sh.vx * 0.8); sh.vy = f32(sh.vy * 0.8); }
  }
  if (s && owner > 0 && !sh.dis && t && !t.disabled && (s.state === 0xd || (s.state === 4 && s.mode === 0xf)) && s.primary === target) sh.dis = true;
  if (fromShip) sh.dodge = g === 4 || g === 9 ? w.rand(novaClassFight(D, s.cls).dodge) + 1 : -1;
  sh.frame = (W.flags & 4) ? 0 : w.rand(36);
  if (s && owner > 0 && s.state === 0xd) sh.dis = true;
  sh.heading = hd;
  if (g === 1 && (W.seeker & 8) && w.rand(100) + 1 <= (w.sys.rec.Interference || 0)) sh.lost = 999;
  let side = 0;
  if (fromShip) {
    const exit = novaShotStart(w, s, sh, W, t ? { x: t.x, y: t.y } : null);
    if (W.inacc < 0 && exit !== -1 && W.exitType >= 0 && W.exitType <= 3) { const x = novaClassFight(D, s.cls).x[exit + 4 * W.exitType]; side = x > 0 ? 1 : x < 0 ? -1 : 0; }
    if (turret) sh.heading = novaLeadAngle(s, t, W, sh);
  }
  const wrap = h => { while (h < 0) h = f32(h + 360); while (h >= 360) h = f32(h - 360); return h; };
  if (W.inacc > 0 && g !== 5) sh.heading = wrap(f32(sh.heading + (w.rand(2 * W.inacc) - W.inacc)));
  if (!(g === 5 || g === 6) || owner > 0) {
    const v = { x: sh.vx, y: sh.vy };
    if (fromShip && side !== 0) novaAccel(Math.trunc(wrap(f32(s.heading + side * Math.abs(W.inacc)))), W.speed, v);
    else novaAccel(Math.trunc(sh.heading), W.speed, v);
    sh.vx = v.x; sh.vy = v.y;
  }
  if (W.inacc > 0 && g === 5) sh.heading = wrap(f32(sh.heading + (w.rand(2 * W.inacc) - W.inacc)));
  if (W.ammoType === -999 && s && !isSub) { s.shield = 0; s.armor = 0; novaSetDisabled(D, s); }
  sh.jam = W.jam.map(v => (v > 0 ? w.rand(v + 1) : 0));
  w.shots[slot] = sh;
  return slot;
}

/* ---- shots ------------------------------------------------------------------- */

/* HandleShot 0x35586: a shot's target lost when it leaves; its life run
   down a step; moved; when its life is over, its explosion and blast
   (Flags 0x8000) or its explosion alone, and gone. */
function novaHandleShot(w, sh) {
  const D = w.D, W = novaWeapOf(D, sh.w);
  if (sh.life > 0) {
    if (sh.owner > 63) sh.owner = -1;
    if (W.guid === 9 || sh.target > 63 || sh.target < 0) sh.target = -1;
    else if (!sh.lost && !w.ships[sh.target]) { sh.lost = 998; sh.target = -1; }
    sh.life = f32(sh.life - 1);
    if (sh.life <= 0) sh.life = -1;
    novaShotGuidance(w, sh);
    sh.x = f32(sh.x + sh.vx); sh.y = f32(sh.y + sh.vy);
    // the frame: stepped (Flags 0x0001) or by heading
    if (W.flags & 1) {
      sh.anim = f32(sh.anim + 1);
      if (sh.anim >= W.animDelay || !(W.animDelay > 0)) { sh.frame++; sh.anim = 0; }
    }
    if ((W.flags3 & 4) && sh.owner !== -1 && w.ships[sh.owner]) { const r = w.ships[sh.owner].wi.get(sh.w); if (r) r.reload = f32(W.reload); }
    if (W.decay > 0) { sh.decayAcc = f32(sh.decayAcc + 1); if (sh.decayAcc > W.decay) { sh.decays++; sh.decayAcc = 0; } }
    return;
  }
  if (sh.life > -32000) {
    if (W.flags & 0x8000) {
      novaCreateExplosion(w, sh.x, sh.y, W.explod, W.blast, true);
      if (W.blast > 0 && !(W.flags2 & 0x0400)) for (let i = 0; i < 64; i++) {
        const o = w.ships[i];
        if (!o || (i === sh.owner && !(sh.owner === 0 && !(W.flags & 0x100)))) continue;
        if (novaClassFight(D, o.cls).flags & 0x400) continue;
        if (Math.abs(f32(o.x - sh.x)) <= W.blast && Math.abs(f32(o.y - sh.y)) <= W.blast)
          novaDamageShip(w, o, sh, W.impact, W.mass, W.energy, sh.owner, false, false, sh.dis, false, !!(W.flags & 0x20));
      }
    } else if (W.explod > 0) novaSpawnExplod(w, sh.x, sh.y, W.explod, 0);
  }
  w.shots[sh.slot] = null;
}

/* ShotCanHitShip 0x4477e: not its own ship or one of its squad or
   government; a homing shot only its target (unless Flags2 0x0800); a
   turret's shot past a small ship by its roll (dodge); the hidden-ship
   flags matching. */
function novaShotCanHit(w, sh, t) {
  const D = w.D, W = novaWeapOf(D, sh.w);
  if (!(sh.life > 0) || sh.owner === t.slot || sh.lost === 998) return false;
  if (W.guid === 1 && sh.target !== t.slot && !(W.flags2 & 0x0800)) return false;
  const O = sh.owner >= 0 && sh.owner <= 63 ? w.ships[sh.owner] : null;
  if (O) {
    if (O.leader !== -1 && O.leader === t.leader) return false;
    if (O.govt !== -1 && O.govt === t.govt) return false;
    if (sh.dodge > novaClassFight(D, t.cls).dodge && !t.disabled) return false;
    if (O.state === 0x10) return false;
  } else if (sh.owner > 63 || sh.owner < 0) {
    if (sh.target >= 0 && sh.target <= 63 && sh.target !== t.slot) return false;
  }
  if (!novaSameHide(D, t, W)) return false;
  if (O && novaShareParent(w, t, O)) return false;
  return true;
}
/* The sprite test (ShipCollisionHandler 0x36f8a): the two sprites' boxes
   overlapping, then a bounding circle for a ship 32 pixels wide or less,
   else any pixel opaque in both frames. A ship's sprite sits half its
   size up and left of its place, a shot's half its width both ways, as
   the program places them. */
function novaSpriteHit(D, t, sh, W) {
  const ts = novaFightSprite(D, t.cls.sprite), ss = novaFightSprite(D, novaSpinSprite(D, W.spin));
  const tw = ts ? ts.w : 32, th = ts ? ts.h : 32, sw = ss ? ss.w : 8, shh = ss ? ss.h : 8;
  const tl = Math.trunc(t.x) - Math.ceil(tw / 2), tt = Math.trunc(t.y) - Math.ceil(th / 2);
  const sl = Math.trunc(sh.x) - Math.ceil(sw / 2), st = Math.trunc(sh.y) - Math.ceil(sw / 2);
  if (sl >= tl + tw || tl >= sl + sw || st >= tt + th || tt >= st + shh) return false;
  if (!ts || !ss || tw <= 32) {
    const ha = Math.trunc(tw / 2), hb = Math.trunc(sw / 2), dx = (sl + hb) - (tl + ha), dy = (st + hb) - (tt + ha);
    return dx * dx + dy * dy < (ha + hb) * (ha + hb);
  }
  const tf = Math.min(ts.frames - 1, Math.max(0, t.frame || 0)), sf = Math.min(ss.frames - 1, Math.max(0, novaShotFrame(W, sh, ss)));
  const tm = novaSpriteMask(ts, tf), sm = novaSpriteMask(ss, sf);
  const x0 = Math.max(tl, sl), x1 = Math.min(tl + tw, sl + sw), y0 = Math.max(tt, st), y1 = Math.min(tt + th, st + shh);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (tm[(y - tt) * tw + (x - tl)] && sm[(y - st) * sw + (x - sl)]) return true;
  return false;
}
// A shot's frame (HandleShot): stepped, or by its heading over the sprite's frames.
function novaShotFrame(W, sh, spr) {
  const n = spr ? spr.frames : 1;
  let f = (W.flags & 1) ? sh.frame : Math.trunc(f32(n * sh.heading) / 360);
  if (f >= n) f = (W.flags & 1) && (W.flags2 & 2) ? n - 1 : (W.flags & 1) ? (sh.frame = 0) : n - 1;
  return f < 0 ? 0 : f;
}

/* The start of each step (DoPlayGameWork 0x43e70, 0x44015): every shot
   tested against every ship (SWCollideSpriteLayer), and a hit taken
   unless the shot is not yet armed (ProxSafety); then the proximity
   fuses (CheckShotProximities 0x371bc). */
function novaShotHits(w) {
  const D = w.D;
  for (const sh of w.shots) {
    if (!sh || !(sh.life > 0)) continue;
    const W = novaWeapOf(D, sh.w);
    for (let i = 0; i < 64 && w.shots[sh.slot] === sh; i++) {
      const t = w.ships[i];
      if (!t || !novaShotCanHit(w, sh, t) || !novaSpriteHit(D, t, sh, W)) continue;
      if (W.proxSafety > 0 && sh.life > W.count - W.proxSafety) continue;
      novaShipHit(w, sh, t, false);
    }
  }
  for (const sh of w.shots) {
    if (!sh || !(sh.life >= 0)) continue;
    const W = novaWeapOf(D, sh.w);
    if (!(sh.life < W.count - W.proxSafety) || (W.flags2 & 0x0400) || !(W.prox > 0)) continue;
    for (let i = 0; i < 64; i++) {
      const t = w.ships[i];
      if (!t || !novaShotCanHit(w, sh, t)) continue;
      const ts = novaFightSprite(D, t.cls.sprite), r = Math.trunc(W.prox + (ts ? ts.w : 32) * 0.333);
      const dx = Math.trunc(t.x) - Math.trunc(sh.x), dy = Math.trunc(t.y) - Math.trunc(sh.y);
      if (r * r >= dx * dx + dy * dy) { novaShipHit(w, sh, t, true); break; }
    }
  }
}
/* HandleShipHit 0x36a45: the shot's explosion, its damage less what it
   has decayed, and its blast on every other ship in reach. */
function novaShipHit(w, sh, t, sub) {
  const D = w.D, W = novaWeapOf(D, sh.w);
  novaCreateExplosion(w, sh.x, sh.y, W.explod, W.blast, true);
  let mass = W.mass, energy = W.energy;
  if (sh.decays > 0) { mass = Math.max(0, mass - sh.decays); energy = Math.max(0, energy - sh.decays); }
  novaDamageShip(w, t, sh, W.impact, mass, energy, sh.owner, true, sh.target === t.slot, sh.dis, false, !!(W.flags & 0x20));
  if (W.blast > 0) for (let i = 0; i < 64; i++) {
    const o = w.ships[i];
    if (!o || o === t || (i === sh.owner && !(sh.owner === 0 && !(W.flags & 0x100)))) continue;
    if (Math.abs(f32(o.x - sh.x)) <= W.blast && Math.abs(f32(o.y - sh.y)) <= W.blast)
      novaDamageShip(w, o, sh, W.impact, W.mass, W.energy, sh.owner, false, false, sh.dis, false, !!(W.flags & 0x20));
  }
  void sub;
  sh.life = -1;
  w.shots[sh.slot] = null;
}

/* ---- damage ------------------------------------------------------------------ */

/* DamageShip 0x3a807: the ship pushed by the Impact (unless jumping);
   energy damage taken by the shields, mass damage by the armour once the
   shields are down (or always, Flags 0x0020), shields no lower than a
   tenth of their capacity below 0; a disable-only weapon never takes the
   last point of armour. Hit by a weapon, a ship with an AI turns on its
   attacker, and its fleet's lead with it, unless the attacker is of its
   own government or squad, the hit was harmless, or a stray shot from a
   ship aiming elsewhere; a ship busy fighting another, much nearer,
   keeps to it. `hit`, a weapon's hit (a20); `aimed`, the shot was aimed
   at this ship (a24); `noKill` (a28); `atThreshold` (a2c); `armorOnly`
   (a30). */
function novaDamageShip(w, t, src, impact, mass, energy, attacker, hit, aimed, noKill, atThreshold, armorOnly) {
  const D = w.D;
  if (!t) return;
  const A = attacker >= 1 && attacker <= 63 ? w.ships[attacker] : null;
  if (A && A.primary === t.slot && (A.state === 0xd || (A.leader >= 1 && A.leader <= 63 && w.ships[A.leader] && w.ships[A.leader].state === 0xd))) noKill = true;
  const wasDisabled = t.disabled, c = novaClassFight(D, t.cls);
  if (impact !== 0 && src && t.jump <= 0 && !(impact < 0 && hit && A && (Math.abs(f32(A.x - t.x)) < 50 || Math.abs(f32(A.y - t.y)) < 50))) {
    const a = novaBearing(src.x, src.y, t.x, t.y);
    if (c.mass > 0 && !(c.flags & 0x0400)) {
      const v = { x: t.vx, y: t.vy };
      novaAdjustedAccel(a, f32(impact / c.mass), t.cls.speed, v);
      const cap = novaShipMaxSpeed(D, t);
      v.x = Math.min(cap, Math.max(-cap, v.x)); v.y = Math.min(cap, Math.max(-cap, v.y));
      t.vx = v.x; t.vy = v.y;
    }
  }
  const takeArmor = () => {
    if (!(mass > 0)) return;
    if (noKill && t.armor > 0 && f32(t.armor - mass) <= 0) t.armor = 1;
    else t.armor = f32(t.armor - mass);
  };
  if (armorOnly) takeArmor();
  else {
    if (energy > 0) t.shield = f32(t.shield - energy);
    if (t.shield <= 0) {
      takeArmor();
      const floor = f32(-novaShieldCap(D, t) * 0.1);
      if (floor > t.shield) t.shield = floor;
    }
  }
  novaSetDisabled(D, t);
  if (atThreshold && t.disabled && !wasDisabled) {
    t.armor = f32(novaArmorCap(D, t) * ((c.flags & 0x10) ? 0.1 : 0.3333) + 1);
    novaSetDisabled(D, t);
  }
  if (hit && t.ai > 0 && t.jump <= 0) novaRetaliate(w, t, A, attacker, mass, energy, aimed);
  if (!armorOnly) t.hitFlash = 32;
}
// DamageShip's reactions (0x3b3f3 to 0x3bef9), for ships not the player's.
function novaRetaliate(w, t, A, attacker, mass, energy, aimed) {
  const D = w.D;
  if (attacker === t.slot) return;
  let ret = A ? A.govt !== t.govt : false;
  const L = t.leader;
  if (L >= 0 && L <= 63) {
    if (attacker !== L || attacker === -1) ret = true;
    if (A && A.leader !== -1 && A.leader !== L) ret = true;
  }
  if (t.govt !== -1 && A && A.govt === t.govt) ret = false;
  if (ret && energy <= 0 && mass <= 0 && energy > -32000 && mass >= -31999) ret = false;
  if (ret && !aimed && A && A.primary !== t.slot) ret = false;
  if (A && A.leader === t.leader && A.leader !== -1) ret = false;
  const grand = s => (s && s.leader >= 0 && s.leader <= 63 && w.ships[s.leader] ? w.ships[s.leader].leader : -1);
  const tl = L >= 0 && L <= 63 ? grand(t) : -1, al = A && A.leader >= 1 && A.leader <= 63 ? grand(A) : -1;
  if (al === tl && al >= 0 && al <= 63) ret = false;
  if (L >= 1 && L <= 63 && w.ships[L] && w.ships[L].jump > 0) return;
  if (!ret || !A) return;
  const af = novaClassFight(D, A.cls), tf = novaClassFight(D, t.cls);
  if (af.escortType === 0 && tf.escortType !== 0 && t.primary !== -1 && t.state === 4) return;
  t.harass = 0;
  if (t.primary !== -1 && t.state === 4 && novaAngleApart(Math.trunc(t.heading), t.want) <= 44) {
    const cur = w.ships[t.primary];
    if (cur && f32(f32((t.x - A.x) ** 2) + f32((t.y - A.y) ** 2)) > f32(f32(f32((t.x - cur.x) ** 2) + f32((t.y - cur.y) ** 2)) * 0.25)) return;
  }
  t.anger = ((t.anger + Math.max(0, mass) + Math.max(0, energy)) << 16) >> 16;
  t.primary = attacker;
  if (L >= 1 && L <= 63 && w.ships[L]) {
    const l = w.ships[L];
    l.anger = ((l.anger + Math.max(0, mass) + Math.max(0, energy)) << 16) >> 16;
    l.primary = attacker;
  }
  if (t.timer > 20) t.timer = 20;
}

/* ---- the death of a ship -------------------------------------------------------- */

/* HandleShipDisplay 0x2bfa5, dying (no armour left): the death throes
   begin, DeathDelay steps; small explosions over the ship, more often as
   the end nears; then the blast of a ship of Mass 100 or more (Mass x
   0.075 + 50 across, Mass x 0.0375 + 25 damage, which can disable but
   not kill), the last explosion, and gone. */
function novaDeathThroes(w, s) {
  const D = w.D, c = novaClassFight(D, s.cls);
  if (!novaDying(s)) return;
  if (!(s.death > 0)) { s.death = f32(c.deathDelay); return; }
  if (s.death <= 2) {
    let R = 0;
    if (!(c.flags & 0x0400) && c.mass > 99) {
      R = Math.trunc(c.mass * 0.075 + 50);
      const dmg = Math.trunc(c.mass * 0.0375 + 25);
      if (R > 0) for (let i = 0; i < 64; i++) {
        const o = w.ships[i];
        if (!o || o === s || Math.abs(f32(o.x - s.x)) > R || Math.abs(f32(o.y - s.y)) > R) continue;
        novaDamageShip(w, o, s, 750, dmg, dmg, s.slot, false, false, true, true, false);
      }
    }
    novaCreateExplosion(w, s.x, s.y, c.explode2, R, true);
    novaGone(w, s, 'destroyed');
    for (const o of w.ships) if (o && o.leader === s.slot) o.leader = -1;
    return;
  }
  const n = s.death < 20 ? 1 : s.death < 40 ? 2 : s.death >= 60 ? 8 : 4;
  if (w.rand(n) === 0) {
    const ts = novaFightSprite(D, s.cls.sprite), r = Math.max(1, Math.trunc((ts ? ts.w : 32) * 0.25));
    const px = f32(f32(s.x + w.rand(2 * r)) - r), py = f32(f32(s.y + w.rand(2 * r)) - r);
    if (n <= 2 && c.deathDelay > 59) w.rand(2);
    novaCreateExplosion(w, px, py, c.explode1, 0, w.rand(4) === 0);
  }
}

/* ---- explosions -------------------------------------------------------- */

/* CreateExplosion 0x3f698: a bööm (0 to 63), or a big one (1000 to 1063)
   with smaller ones round it, scattered over its blast. SpawnExplod
   0x3f5dc keeps up to 32; HandleExplods 0x2f5d2 plays each, after its
   wait, at FrameAdvance / 100 frames a step. */
function novaCreateExplosion(w, x, y, boom, blast, sound) {
  if (!(boom >= 0 && boom <= 63) && !(boom >= 1000 && boom <= 1063)) return;
  if (boom >= 1000) {
    boom -= 1000;
    const n1 = Math.trunc(blast * 0.04), r1 = Math.trunc(blast * 0.5), o1 = blast * -0.25;
    for (let i = 0; i < n1; i++) {
      const ex = f32(f32(x + w.rand(r1)) + o1), ey = f32(f32(y + w.rand(r1)) + o1);
      novaSpawnExplod(w, ex, ey, 1, w.rand(8) + 4);
    }
    const n2 = Math.trunc(blast * 0.16), o2 = blast * -0.5;
    for (let i = 0; i < n2; i++) {
      const ex = f32(f32(x + w.rand(blast)) + o2), ey = f32(f32(y + w.rand(blast)) + o2);
      novaSpawnExplod(w, ex, ey, 0, w.rand(16) + 8);
    }
  }
  novaSpawnExplod(w, x, y, boom, 0);
  void sound;
}
function novaSpawnExplod(w, x, y, boom, delay) {
  const i = w.booms.findIndex(b => !b);
  if (i < 0) return;
  w.booms[i] = { boom, x, y, frame: 0, delay: f32(delay) };
}
function novaHandleExplods(w) {
  const F = novaFightData(w.D);
  for (let i = 0; i < w.booms.length; i++) {
    const b = w.booms[i], B = b && F.booms[b.boom];
    if (!b) continue;
    if (!B) { w.booms[i] = null; continue; }
    if (b.delay > 0) { b.delay = f32(b.delay - B.adv); continue; }
    b.frame = f32(b.frame + B.adv);
    const spr = novaFightSprite(w.D, novaSpinSprite(w.D, B.spin));
    if (Math.trunc(b.frame) >= (spr ? spr.frames : 1)) w.booms[i] = null;
  }
}

/* ---- each step -------------------------------------------------------------------- */

/* HandleShip 0x33760, the parts about fighting, before the ship moves:
   reloading, a ship with no target resetting its fighter bays, an
   invulnerable person (ShieldMod below 0) kept whole, and the shields and
   armour recharging while not disabled. */
function novaShipUpkeep(w, s) {
  const D = w.D;
  if (s.primary !== -1 && !w.ships[s.primary]) s.primary = -1;
  for (const r of s.weap) {
    if (r.count <= 0) continue;
    if (r.reload > 0) r.reload = f32(r.reload - 1); else r.reload = 0;
  }
  if (s.primary === -1) for (const r of s.weap) { const W = novaWeapOf(D, r.i); if (W && W.guid === 99 && r.count > 0) r.reload = f32(W.reload); }
  const p = s.pers ? D.persons.get(s.pers) : null;
  if (p && p.ShieldMod < 0) { s.shield = novaShieldCap(D, s); s.armor = novaArmorCap(D, s); }
  if (!s.disabled) {
    if (s.shield < novaShieldCap(D, s)) s.shield = f32(s.shield + novaShieldRech(D, s));
    if (s.armor < novaArmorCap(D, s)) s.armor = f32(s.armor + novaArmorRech(D, s));
  }
  novaSetDisabled(D, s);
}
/* HandleShip, after the ship moves: the chosen weapon fired (and chosen
   again for one that keeps firing, Flags 0x0002), the death throes
   counted down, the hit flash fading. */
function novaShipFire(w, s) {
  if (s.latch && s.lastW !== -1) {
    const W = novaWeapOf(w.D, s.lastW);
    novaFireShipWeapon(w, s);
    if (!(W && (W.flags & 2))) { s.lastW = -1; s.latch = false; }
  }
  if (s.death > 0) s.death = f32(s.death - 1);
  if (s.hitFlash > 0) s.hitFlash--;
}

/* ---- the battle simulator --------------------------------------------------- */

/* A ship of class `clsId` for government `govt` put at (x, y), as a
   spawner would make it (its skill, aggression and sprite drawn), with
   the class's AI type or `ai`. Null with no room. */
function novaPlaceShip(w, clsId, govt, x, y, ai) {
  const cls = w.D.classes.get(clsId), slot = novaFreeSlot(w, 0);
  if (!cls || slot < 0) return null;
  const s = novaFreshShip(w, slot);
  Object.assign(s, { cls, govt, ai: ai > 0 ? ai : cls.ai > 0 ? cls.ai : 3, x: f32(x), y: f32(y) });
  s.heading = w.rand(360);
  s.skill = novaSkill(w, cls);
  s.aggr = w.rand(3) ^ 2;
  novaSpriteDraws(w, s, cls);
  w.ships[slot] = s;
  novaArm(w, s);
  return s;
}

/* ---- beams ------------------------------------------------------------------ */

/* SpawnBeam 0x44ff3: a beam in the first free place of 64, lasting its
   Count steps, from the next of the shän's beam exit points (or the one
   nearest the target, Flags3 0x0010). */
function novaSpawnBeam(w, owner, target, i, exit, pd) {
  const D = w.D, W = novaWeapOf(D, i), s = w.ships[owner];
  const slot = w.beams.findIndex(b => !b);
  if (slot < 0 || !W || !s) return;
  const b = { slot, w: i, owner, target, life: W.count, fade: 0, et: W.exitType, pd, exit: 0, dis: !!(W.flags2 & 0x1000), x0: s.x, y0: s.y, x1: s.x, y1: s.y };
  if (exit >= 0 && exit < 4) b.exit = exit;
  else if (b.et >= 0 && b.et < 4) {
    if (s.exits[b.et] > 3) s.exits[b.et] = w.rand(4);
    const t = target >= 0 ? w.ships[target] : null;
    if ((W.flags3 & 0x10) && t && pd !== 1) {
      b.exit = novaClosestExit(w, s, b.et, t);
      if (s.exits[b.et] > 3) s.exits[b.et] = w.rand(4);
    } else b.exit = s.exits[b.et];
    s.exits[b.et] = (s.exits[b.et] + 1) % 4;
  }
  if (owner >= 1 && !b.dis && target !== -1 && pd !== 1) {
    const t = w.ships[target];
    if (t && !t.disabled && (s.state === 0xd || (s.state === 4 && s.mode === 0xf)) && s.primary === target) b.dis = true;
  }
  w.beams[slot] = b;
}
// The exit point nearest a target (SelectClosestShotStartPosition 0x7254).
function novaClosestExit(w, s, et, t) {
  let best = -1, bd = 0;
  for (let idx = 0; idx < 4; idx++) {
    const p = novaExitPoint(w, s, et, idx), d = f32(f32((p.x - t.x) ** 2) + f32((p.y - t.y) ** 2));
    if (best === -1 || d < bd) { best = idx; bd = d; }
  }
  return best;
}
// Where an exit point is, turned with the ship's frame and compressed (ModifyShotStartPosition2 0x706e).
function novaExitPoint(w, s, et, idx) {
  const c = novaClassFight(w.D, s.cls), fp = c.framesPer, rot = Math.trunc(((s.frame || 0) % fp) * (360 / fp));
  const p = { x: s.x, y: s.y };
  if (et < 0 || et > 3 || idx < 0 || idx > 3) return p;
  const k = idx + 4 * et, off = { x: 0, y: 0 };
  novaAccel(rot, c.y[k], off); novaAccel((rot + 90) % 360, c.x[k], off);
  if (off.y < 0) { off.x = f32(off.x * c.up.x); off.y = f32(off.y * c.up.y); } else { off.x = f32(off.x * c.dn.x); off.y = f32(off.y * c.dn.y); }
  off.y = f32(off.y - c.z[k]);
  p.x = f32(p.x + off.x); p.y = f32(p.y + off.y);
  return p;
}
/* HandleBeams 0x30295, at the end of each step: each beam's life run down
   (one with a Decay fading over its Falloff); its line from the ship's
   exit point along the ship's facing (a turreted beam's at its target),
   give or take its Inaccuracy each step; the nearest ship whose middle is
   within the beam's length plus a third of its sprite and within a few
   degrees of the line (a tenth of two thirds of its width, in degrees,
   over 3.2) struck, every step: its explosion, and its damage. */
function novaHandleBeams(w) {
  const D = w.D;
  for (let k = 0; k < w.beams.length; k++) {
    const b = w.beams[k];
    if (!b) continue;
    if (b.life < 0) { w.beams[k] = null; continue; }
    const s = w.ships[b.owner], W = novaWeapOf(D, b.w);
    if (!s) { w.beams[k] = null; continue; }
    if (b.life !== 0 || W.decay < 1 || (++b.fade + W.falloff) > 15) { if (b.life > 0) b.life--; }
    const c = novaClassFight(D, s.cls), fp = c.framesPer, rot = Math.trunc(((s.frame || 0) % fp) * (360 / fp));
    let ang = rot;
    const o = novaExitPoint(w, s, b.et, b.exit);
    if (b.target !== -1 && W.guid !== 0) {
      const t = w.ships[b.target];
      if (t) ang = novaBearing(o.x, o.y, t.x, t.y); else b.life = -1;
    }
    if (W.inacc > 0 && W.guid !== 10) ang += w.rand(2 * W.inacc) - W.inacc;
    b.x0 = o.x; b.y0 = o.y;
    let len = W.beamLength;
    if (b.life >= 0) {
      if (W.flags2 & 0x0200) s.flash = 32;
      let hit = -1, hd = 0, hw = 0;
      for (let i = 0; i < 64; i++) {
        const t = w.ships[i];
        if (!t || i === b.owner || t.leader === b.owner || i === s.leader) continue;
        if (!novaSameHide(D, t, W)) continue;
        const ts = novaFightSprite(D, t.cls.sprite), tw = Math.trunc((ts ? ts.w : 32) * 0.66);
        const reach = W.beamLength + Math.trunc(tw / 2);
        const d2 = f32(f32((t.x - o.x) ** 2) + f32((t.y - o.y) ** 2));
        if (!(d2 <= reach * reach)) continue;
        const a = novaBearing(o.x, o.y, t.x, t.y), tol = Math.trunc(tw * 10 / 32);
        if (Math.abs(a - ang) > tol) continue;
        const di = Math.trunc(d2);
        if (hit === -1 || di < hd) { hit = i; hd = di; hw = ts ? ts.w : 32; }
      }
      if (hit !== -1) {
        const t = w.ships[hit], p = { x: o.x, y: o.y };
        len = f32(Math.trunc(hw * -0.2 + Math.sqrt(f32(f32((t.x - o.x) ** 2) + f32((t.y - o.y) ** 2)))));
        novaAccel(ang, len, p);
        novaCreateExplosion(w, p.x, p.y, W.explod, W.blast, true);
        let impact = W.impact;
        if (impact < 0) impact = 0;   // a tractor beam's pull comes later
        const aimed = b.target === -1 ? s.primary === hit : b.target === hit;
        novaDamageShip(w, t, o, impact, W.mass, W.energy, b.owner, true, aimed, b.dis, false, !!(W.flags & 0x20));
      }
    }
    const e = { x: o.x, y: o.y }; novaAccel(ang, len, e);
    b.x1 = e.x; b.y1 = e.y;
  }
}
