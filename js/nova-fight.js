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

   Then guided missiles, beams, fighters and their bays, fleets' orders
   and leads, plundering and capture, submunitions, particles (their draws
   on the random numbers as the program makes them), asteroids broken and
   the boxes they leave, mining and scooping, and SpriteWorld's layers,
   whose order is the order hits are taken in.

   Not here yet: escape pods, reinforcements, shots against
   stellars, and the trail particles' preference (taken as on).

   The player is in none of it: every branch about the player is left
   out. The player's combat rating (kills) is w.kills, 0 unless a battle
   sets it: it decides some complex manoeuvres and, at a ship's making,
   some afterburners (novaHasAfterburner).

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
      hitParticles: r.HitParticles, exitType: r.ExitType, durability: r.Durability, ion: r.Ionization, ionColor: r.IonizeColor,
      beamLength: r.BeamLength, animDelay: r.BeamWidth, beamWidth: r.BeamWidth, falloff: r.BeamLength > 0 && r.Falloff <= 0 ? 16 : r.Falloff,
      beamColor: r.BeamColor, coronaColor: r.CoronaColor, subCount: r.SubCount, subType: r.SubType, subLimit: r.SubLimit,
      // the loader's (0x7aa25): the submunition as an index, -1 for none (no count, none of 128 to 383), SubTheta -1 as 0
      subIdx: r.SubCount > 0 && r.SubType >= 128 && r.SubType <= 383 ? r.SubType - 128 : -1, subTheta: r.SubTheta === -1 ? 0 : r.SubTheta,
      partLifeMin: r.PartLifeMin, partLifeMax: r.PartLifeMax, partColor: r.PartColor, partVel: f32(r.PartVel * 0.01),
      hitPartLife: r.HitPartLife, hitPartVel: f32(r.HitPartVel * 0.01), hitPartColor: r.HitPartColor,
      // and eight variants of the trail particles' speed and colour, each PartVel or PartColor x 0.6 to 1.4, drawn at loading (here from a fixed seed: they change no draws)
      partVels: [], partColors: [],
      burstCount: r.BurstCount > 0 ? r.BurstCount : -1, burstReload: r.BurstReload,
      jam: (r.JamVuln || [0, 0, 0, 0]).map(v => Math.min(100, Math.max(0, v))),
      spin: r.Graphic >= 0 ? 3000 + r.Graphic : 0, range: 0,
    });
  }
  for (const w of F.weaps) if (w) w.range = novaWeaponRange(F, w);
  const load = novaRandom(1);
  for (const w of F.weaps) if (w) for (let k = 0; k < 8; k++) {
    const f = f32((load.rand(0x51) + 60) * 0.01), c = w.partColor || 0;
    w.partVels.push(f32(f * w.partVel));
    w.partColors.push(((Math.min(255, Math.trunc(((c >> 16) & 255) * f)) << 16) | (Math.min(255, Math.trunc(((c >> 8) & 255) * f)) << 8) | Math.min(255, Math.trunc((c & 255) * f))));
  }
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
  Object.assign(s, { armed: true, death: 0, anger: 0, odds: -1, lastW: -1, lastGun: -1, latch: false,
                     patience: -1, targeted: 0, flash: 0, exits: [0, 0, 0, 0], podsLeft: c.podCount, mate: -1, harass: 0 });
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
/* ShipVisibleToShip 0x9721: a ship coming out of a hypergate cannot be
   seen, nor a cloaked one, but by its own escorts with cloaks and a
   person 1023 (0x3ff). */
const novaVisible = (a, b) => a.state !== 0x15 && !!b && (!novaCloaked(a) || (b.leader === a.slot && b.cls.cloak >= 0) || b.pers === 0x3ff);

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
/* IsShipThreatenedByMyEnemy 0x824f6, despite its name: o is attacking an
   enemy of s (the program asks whether that enemy is threatened by o). */
function novaThreatenedByMyEnemy(w, o, s) {
  for (let i = 1; i < 64; i++) {
    const e = w.ships[i];
    if (e && i !== s.slot && i !== o.slot && novaThreatens(w, o, e) && novaIsEnemy(w.D, s, e)) return true;
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
   target kept while fighting it; none when out of ammunition or with no
   government; for a xenophobic government first the nearest enemy it can
   face (its strength within the ship's friends' strength x MaxOdds), for
   another joining an ally's fight against a ship it can face (AI types up
   to 4); then the nearest enemy it can face, a lead with escorts taking
   the heaviest; else the nearest ship threatening it or its escorts. */
function novaSelectTarget(w, s) {
  const D = w.D;
  if (s.primary !== -1 && (s.state === 3 || s.state === 4) && novaActive(w, s.primary)) return;
  if (novaOutOfAmmo(w, s) === 2) return;
  const destroying = novaHasDestroying(w, s), g = D.govts.get(s.govt);
  if (!g) return;
  const odds = g.maxOdds, cand = new Array(64).fill(false);
  if (g.flags & 1) {
    // a xenophobe: the nearest ship of a government not its ally that it is at war with, not too strong for it
    let n = 0;
    for (let i = 1; i < 64; i++) {
      const o = w.ships[i];
      if (!o || novaDying(o) || o.disabled || !novaVisible(o, s) || i === s.slot || o.leader === s.slot || novaGovtAllies(D, s.govt, o.govt) || !novaIsEnemy(D, s, o)) continue;
      cand[i] = true; n++;
    }
    if (n > 0) {
      const own = novaFriendStrength(w, s);
      for (let i = 0; i < 64; i++) if (cand[i] && novaFriendStrength(w, w.ships[i]) > f32(own * odds)) { cand[i] = false; n--; }
      if (n > 0) s.primary = novaNearest(w, s, i => cand[i]);
    }
  } else if (s.ai <= 4) {
    // joining an ally's fight, against a target not too strong
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
  /* Then, for both (a xenophobe's choice standing only if nothing here is
     found): the nearest enemy seen, not too strong, disabled ones only with
     a weapon that destroys; a lead with escorts takes the heaviest. The
     xenophobe's candidates stay among those weighed. */
  let n = 0;
  for (let i = 1; i < 64; i++) {
    const o = w.ships[i];
    if (!o || i === s.slot || !novaVisible(o, s) || (!destroying && o.disabled) || !novaIsEnemy(D, s, o)) continue;
    cand[i] = true; n++;
  }
  if (n > 0) {
    const own = novaFriendStrength(w, s);
    let heaviest = -1;
    for (let i = 0; i < 64; i++) {
      if (!cand[i]) continue;
      if (novaFriendStrength(w, w.ships[i]) > f32(own * odds)) { cand[i] = false; n--; continue; }
      if (s.hasEscorts) { const m = novaClassFight(D, w.ships[i].cls).mass; if (heaviest === -1 || m > heaviest) heaviest = m; }
    }
    if (n > 0) {
      const p = novaNearest(w, s, i => cand[i] && (heaviest === -1 || novaClassFight(D, w.ships[i].cls).mass === heaviest));
      if (p !== -1) s.primary = p;
    }
  }
  if (s.primary === -1) s.primary = novaNearest(w, s, i => i !== s.slot && novaActive(w, i) && novaVisible(w.ships[i], s) && novaThreatens(w, w.ships[i], s));
}

/* The leave-or-park test the supervisors share: fuel to jump (above 99),
   not matching velocity with another, and not a person who may not
   leave (përs Flags2 0x0001 with fuel under 100). None leaves in the
   battle simulator's world (w.noRetreat), where every retreat (state 3)
   is turned off as well: it parks, and looks for a target again. */
function novaCanLeave(w, s) {
  if (w.noRetreat) return false;
  if (!(s.cls.fuel > 99)) return false;
  if (s.tractor !== undefined && s.tractor !== -1 && s.tractor !== s.slot) return false;
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
    if (s.primary !== -1 && g && s.state === 4 && (g.flags & 0x10) && !w.noRetreat && novaOddsRetreat(w, s, g)) s.state = 3;
    if (s.primary !== -1 && s.state !== 7 && s.state !== 3) {
      if (s.jump <= 0) s.state = 4;
      if (!w.noRetreat && novaCowardice(D, s) > s.shield && s.leader === -1 && g && (g.flags & 0x10) && ![2, 3, 0xb].includes(s.state)) s.state = 3;
      if ((novaClassFight(D, s.cls).flags2 & 0x80) && novaOutOfAmmo(w, s) && !w.noRetreat && ![2, 3, 0xb].includes(s.state)) s.state = 3;
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
  if (g && s.state === 4 && (g.flags & 0x0100) && !w.noRetreat && novaOddsRetreat(w, s, g)) s.state = 3;
  if (s.primary !== -1 && s.state === 4) { const t = w.ships[s.primary]; if (t && t.disabled && !novaHasDestroying(w, s)) { s.primary = -1; s.state = 0; } }
  if ((novaClassFight(D, s.cls).flags2 & 0x80) && novaOutOfAmmo(w, s) && !w.noRetreat && ![2, 3, 0xb].includes(s.state)) s.state = 3;
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
  const t = w.ships[s.primary] || w.last[s.primary];
  if ((brave || w.noRetreat) && t && (w.noRetreat || Math.abs(Math.trunc(f32(s.x - t.x))) <= 1250 && Math.abs(Math.trunc(f32(s.y - t.y))) <= 1250)) { if (s.jump <= 0) s.state = 4; }
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
  if (s.ai === 5 && s.state === 0xb && !novaCanLeave(w, s)) { s.state = 5; s.primary = -1; s.sec = s.leader; }
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
      if (near && s.mode !== 4) {
        s.mode = 5;
        if (s.govt !== -1 && s.leader !== 0 && novaGovtAllies(D, s.govt, t.govt) && t.leader !== 0) { Object.assign(s, { state: 0, mode: 0, primary: -1 }); return; }
      }
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
      if (novaFleetMateTarget(w, s)) return;
      if (!t || novaDying(t)) { Object.assign(s, { primary: -1, anger: 0, state: 0 }); }
      else {
        const dx = Math.abs(f32(s.x - t.x)), dy = Math.abs(f32(s.y - t.y)), cf = novaClassFight(D, s.cls);
        if (dx > 165 || dy > 165) {
          if (cf.flags2 & 2) {
            let r = Math.trunc(novaMaxRange(w, s) * 0.85);
            if (t.disabled) r = Math.trunc(r * 0.5);
            s.mode = dx > r || dy > r ? 7 : 0xe;
          } else if (novaHopeless(w, s)) { if (s.ai > 2 || w.noRetreat) s.mode = 0xe; else { s.state = 3; s.mode = 5; } }
          else if ((cf.flags2 & 1) && s.mate > 0 && s.mate !== s.leader) s.mode = 0x12;
          else if (s.mode !== 0x11) s.mode = 7;
        } else if (cf.flags2 & 2) s.mode = 5;
        else if (s.mode !== 0x10) s.mode = 6;
        if (!s.disabled) novaLaunchFighters(w, s);
      }
    }
  }
  if (s.state === 0xd) {
    s.jump = 0;
    if (s.primary === -1 || s.timer > 0) s.state = 0;
    else if (!novaFleetMateTarget(w, s)) {
      const t = w.ships[s.primary];
      if (!t) Object.assign(s, { primary: -1, sec: -1, anger: 0, state: 0 });
      else if (!t.disabled) {
        s.sec = -1;
        if (Math.abs(f32(s.x - t.x)) > 165 || Math.abs(f32(s.y - t.y)) > 165) {
          if (novaHopeless(w, s)) { if (s.ai < 3 && !w.noRetreat) { s.state = 3; s.mode = 5; } else s.mode = 0xe; }
          else if (s.mode !== 0x11) s.mode = 7;
        } else if (s.mode !== 0x10 && s.mode !== 0x11) s.mode = 6;
      } else if (!t.boarded || s.timer > 0) {
        // alongside to board: within (10 - turn) x 30 (four times that inertialess), else closing
        s.sec = s.primary;
        let r = (Math.trunc(f32((10 - s.cls.turn) * 30)) << 16) >> 16;
        if (novaInertialess(s)) r = (r * 4 << 16) >> 16;
        const ax = Math.abs(f32(s.x - t.x)), ay = Math.abs(f32(s.y - t.y));
        if (ax > r || ay > r) s.mode = ax > r * 2 || ay > r * 2 ? 9 : 0xb;
        else s.mode = 0xf;
      } else Object.assign(s, { state: 0, mode: 0, primary: -1, sec: -1 });
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
  if (Math.abs(rx) <= 0.35 && Math.abs(ry) <= 0.35) return false;
  const d = novaBearing(0, 0, rx, ry) - novaBearing(t.x, t.y, s.x, s.y);
  if (d >= -89 && d <= 89) return false;
  const d2 = Math.abs(novaDist2(s.x, s.y, t.x, t.y)) * 0.8;
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
  if (ok && s.mode === 0xf && s.sec !== -1 && w.ships[s.sec]) novaDocking(w, s, w.ships[s.sec]);
  if (!ok || s.primary === -1) return;
  const t = w.ships[s.primary];
  if (!t) return;
  const turn = novaShipTurn(s), apart = () => novaAngleApart(s.want, Math.trunc(s.heading));
  const dx = Math.abs(f32(s.x - t.x)), dy = Math.abs(f32(s.y - t.y));
  const ix = () => novaBearing(s.x, s.y, t.x, t.y);
  // a swarm's ships keep formation on its lead, with its engine glow
  const swarm = () => { if (s.mate > 0) { novaKeepFormation(w, s, false); const m = w.ships[s.mate] || w.last[s.mate]; if (m) s.glow = m.glow; } };
  if (s.mode === 5) {
    swarm();
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
      // AIPerformsComplexManeuvers 0x659a: Rand(1344) + 256 at most the player's kills, 0 on the map
      const go = w.rand(2) === 0 || (w.rand(0x540) + 256 <= (w.kills || 0));
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
    swarm();
    const ix2 = Math.trunc(f32(s.x - t.x)), iy2 = Math.trunc(f32(s.y - t.y));
    if (ix2 >= -164 && ix2 <= 164 && iy2 >= -164 && iy2 <= 164) { novaFireTurret(w, s); if (apart() < turn * 3) novaFireGun(w, s, false); }
    else if (apart() < turn * 3) novaFireMissile(w, s);
    if (ix2 >= -165 && ix2 <= 165 && iy2 >= -165 && iy2 <= 165) s.mode = 6;
    else if (w.rand(100) === 0) s.mode = 6;
  }
  if (s.mode === 7) {
    swarm();
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
    novaLaunchFighters(w, s);
  }
}
/* CalcLeadAngle 0x2b025: where to aim a gun so that its shot meets the
   target, from where the shot leaves (`from`), a rocket's flight by its
   own curve. */
function novaLeadAngle(s, t, W, from) {
  let a = novaBearing(from.x, from.y, t.x, t.y);
  if (!W || ![-1, 4, 6, 7, 8, 9].includes(W.guid)) return a;
  const d = f32(Math.sqrt(novaDist2(t.x, t.y, from.x, from.y))), spd = W.speed;
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
  if (s.disabled) return;
  novaPointDefense(w, s);
  if (s.primary === -1) return;
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
/* HandleShipPointDefense 0x392c4, for a ship not jumping: its first point
   defence weapon (guidance 9, a shot, or 10, a beam) that is loaded,
   ready and not hidden by a cloak (Flags2 0x4000 fires cloaked) fires at
   the nearest homing shot aimed at the ship or its lead (not one lost,
   nor of Flags 0x0080) within its reach and outside the ship's blind
   spots; with none, at the nearest ship of a class with Flags2 0x0008 that
   attacks the ship or its lead. The reach is 1.5 times a shot's range, a
   beam's BeamLength. A shot at a ship is moved among the ordinary shots,
   to hit ships; one at a shot stays among the point defence, to hit
   homing shots. Then the reload, the ammunition and the burst, as
   FireAIShipWeapon counts them. */
function novaPointDefense(w, s) {
  const D = w.D;
  if (s.jump > 0) return;
  let i = -1, W = null, r = null;
  for (let k = 0; k < 256; k++) {
    const q = s.wi.get(k), V = novaWeapOf(D, k);
    if (!q || !V || (V.guid !== 9 && V.guid !== 10) || q.count <= 0 || q.reload > 0) continue;
    if (!(V.flags2 & 0x4000) && novaCloaked(s)) continue;
    if (!novaHasAmmo(w, s, k)) continue;
    i = k; W = V; r = q; break;
  }
  if (i === -1) return;
  const R = W.guid === 9 ? Math.trunc(Math.trunc(W.range) * 1.5) : W.beamLength;
  let pick = -1, kind = -1, ang = 0, best = 0;
  for (let k = 0; k < 128; k++) {
    const sh = w.shots[k];
    if (!sh || !(sh.life > 0)) continue;
    const V = novaWeapOf(D, sh.w);
    if (V.guid !== 1 || sh.lost !== 0 || (V.flags & 0x0080)) continue;
    if (sh.target !== s.slot && (s.leader === -1 || sh.target !== s.leader)) continue;
    const d = Math.trunc(novaDist2(sh.x, sh.y, s.x, s.y));
    if (d > R * R || !(d < best || pick === -1)) continue;
    const a = novaBearing(s.x, s.y, sh.x, sh.y);
    if (!novaBlindSpot(D, s, a, W)) { pick = k; kind = 0; ang = a; best = d; }
  }
  // the player's ship, slot 0, is in none of it (ExtendedIsThreatToPlayer)
  if (pick === -1) {
    for (let j = 1; j < 64; j++) {
      const o = w.ships[j];
      if (!o || j === s.slot || !(novaClassFight(D, o.cls).flags2 & 8) || j === s.leader || o.disabled || !novaVisible(o, s)) continue;
      const d = Math.trunc(novaDist2(o.x, o.y, s.x, s.y));
      if (d > R * R || !(d < best || pick === -1)) continue;
      const a = novaBearing(s.x, s.y, o.x, o.y);
      if (novaBlindSpot(D, s, a, W)) continue;
      const fights = x => !!x && o.primary === x.slot && o.state === 4;
      if (fights(s) || (s.leader !== -1 && fights(w.ships[s.leader]))) { pick = j; kind = 1; ang = a; best = d; }
    }
    if (pick === -1) return;
  }
  if (W.guid === 9) {
    const k = novaSpawnShot(w, s.slot, -1, i, false);
    if (k === -1) return;
    const sh = w.shots[k];
    sh.x = s.x; sh.y = s.y; sh.vx = s.vx; sh.vy = s.vy;
    // where it leaves the ship is measured to the shot in the place of that number, even when the target is a ship
    const at = w.shots[pick];
    novaShotStart(w, s, sh, W, at ? { x: at.x, y: at.y } : null);
    let h = kind === 0 ? novaBearing(sh.x, sh.y, w.shots[pick].x, w.shots[pick].y) : novaLeadAngle(s, w.ships[pick], W, sh);
    if (W.inacc > 0) h = f32(h + (w.rand(2 * W.inacc) - W.inacc));
    if (h < 0) h = f32(h + 360);
    if (h >= 360) h = f32(h - 360);
    sh.heading = h;
    const v = { x: sh.vx, y: sh.vy };
    novaAccel(Math.trunc(h), W.speed, v);
    sh.vx = v.x; sh.vy = v.y;
    if (kind === 1) novaPutInLayer(w, 'h', k, 'shot');
  } else novaSpawnBeam(w, s.slot, pick, i, -1, kind === 0 ? 1 : -1);
  r.reload = f32(r.reload + f32(W.reload / r.count));
  const A = W.ammoType;
  if (A < -999) { s.fuel = f32(s.fuel + (Math.abs(A) - 1000) * -0.1); if (s.fuel < 0) s.fuel = 0; }
  else if (A >= 0 && !(W.flags3 & 1)) { r.ammo--; if (r.ammo < 0) r.ammo = 0; }
  if (W.burstCount < 1) return;
  r.burst++;
  if (r.burst < ((W.flags & 0x40) ? W.burstCount : W.burstCount * r.count)) return;
  r.burst = 0;
  r.reload = f32(W.burstReload);
  if ((W.flags3 & 1) && A >= 0 && A <= 255) r.ammo--;
}
/* What a point defence shot or beam does to a homing shot
   (PointDefenseCollisionHandler 0x37776, and HandleBeams): one of no
   Durability left is gone, and an explosion left where the point defence
   shot was or the homing shot is, of the type numbered as the firer's
   place among the ships (as written); else its Durability less the
   point defence's MassDmg and half its EnergyDmg. */
function novaPointDefenseHit(w, W, sh, x, y, owner) {
  if (sh.dur < 1) { sh.life = 0; sh.hit = true; novaSpawnExplod(w, x, y, owner, 0); }
  else sh.dur = ((sh.dur - (W.mass + Math.trunc(W.energy / 2))) << 16) >> 16;
}
/* AIFireMissile 0x8115d: the first homing missile suited to the target
   (SuitableMissileType) whose reach is more than the distance (less a
   twentieth), unless enough missiles are already on their way to it
   (SufficentTargetedDamage: their damage over 1.05 times its shields
   and armour). */
function novaFireMissile(w, s) {
  const D = w.D, t = s.primary !== -1 ? w.ships[s.primary] : null;
  if (!t || ((novaClassFight(D, t.cls).flags2 & 4) && !s.cls.targetsAll)) return;
  // a cloaked target, but by a ship that can target cloaked ships (ModType 30, ModVal 0x0008: in no release)
  if (novaCloaked(t)) return;
  if (f32(t.shield + t.armor) * 1.05 <= t.targeted) return;
  const d2 = Math.abs(novaDist2(s.x, s.y, t.x, t.y)) * 0.95;
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
    if (t) t.targeted = (Math.trunc(t.targeted + (W.mass + W.energy) * 0.5) << 16) >> 16;
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
  // the class's government for jamming and voices (+0x9f6): InherentGovt 128 to 383, or 1128 to 1383 (those count only for this), not 2128 and up
  const D = w.D, r = s.cls.rec, ig = r.InherentGovt, gi = ig >= 128 && ig < 384 ? ig : ig >= 1128 && ig < 1384 ? ig - 1000 : -1, g = gi >= 0 ? D.u.govts.get(gi) : null;
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
      const o = sh.owner >= 0 && sh.owner <= 63 ? w.ships[sh.owner] || w.last[sh.owner] : null;
      if (t && o && !novaVisible(t, o)) {
        if ((W.seeker & 0x8000) && w.rand(1000) === 0 && sh.owner !== -1) { sh.target = sh.owner; sh.owner = -1; }
        rate = 0;
      }
      const t2 = sh.target >= 0 && sh.target <= 63 ? w.ships[sh.target] || w.last[sh.target] : null;
      if ((W.seeker & 0x4000) && t2) {
        const dx = Math.trunc(f32(t2.x - sh.x)), dy = Math.trunc(f32(t2.y - sh.y));
        if (dx >= -249 && dx <= 249 && dy >= -249 && dy <= 249 && Math.abs(Math.trunc(f32(novaBearing(sh.x, sh.y, t2.x, t2.y) - sh.heading))) % 360 > 45) sh.target = -1;
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
    if (age > 15) sh.heading = novaFrameCounter(w) % 300 < 150 ? f32(sh.heading - W.guidedTurn) : f32(sh.heading + W.guidedTurn);
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
  s.lastFire = novaNow(w);
  // a ship that folds to fire (shän Flags 0x02 and 0x80) fires only folded, folding first
  if ((s.cls.shanFlags & 2) && (s.cls.shanFlags & 0x80) && s.foldFrame > 0 && s.cls.sets > 1) { s.fold = -1; return; }
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
      const d = novaDist2(p.x, p.y, tpos.x, tpos.y);
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
  }
  if (s && owner > 0 && !sh.dis && t && !t.disabled && (s.state === 0xd || (s.state === 4 && s.mode === 0xf)) && s.primary === target) sh.dis = true;
  if (fromShip) { const dg = novaClassFight(D, s.cls).dodge; sh.dodge = g === 4 || g === 9 ? (dg < 1 ? w.rand(100) : w.rand(dg)) + 1 : -1; }
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
  // its layer (SpawnShot): guided shots, point defence, a turret's of a class with Flags3 0x0040, and the rest
  novaPutInLayer(w, 'h', slot, g === 1 ? 'guided' : g === 9 ? 'pd' : g === 4 && s && (s.cls.flags3 & 0x40) ? 'turret' : 'shot');
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
    // the frame shown: by heading, or stepped (Flags 0x0001), the one before the step, back to the first or held at the last (Flags2 0x0002), the first while not yet armed (Flags2 0x0001)
    const spr = novaFightSprite(D, novaSpinSprite(D, W.spin)), n = spr ? spr.frames : 1;
    let shown;
    if (!(W.flags & 1)) shown = Math.trunc(f32(n * sh.heading) / 360);
    else {
      shown = sh.frame;
      sh.anim = f32(sh.anim + 1);
      if (W.animDelay <= sh.anim || W.animDelay < 1) { sh.frame++; sh.anim = 0; }
      if (n <= sh.frame) sh.frame = (W.flags2 & 2) ? n - 1 : 0;
      if ((W.flags2 & 1) && W.count - W.proxSafety < sh.life) { shown = 0; if (W.flags2 & 2) sh.frame = 0; }
    }
    if (n <= shown) shown = n - 1;
    sh.shown = shown < 0 ? 0 : shown;
    // a trail of particles (Particles), from its tail
    if (W.particles > 0) {
      const p = { x: sh.x, y: sh.y }, half = Math.trunc((spr ? spr.w : 0) / 2);
      novaAccel(Math.trunc(f32(180 + sh.heading)) % 360, half, p);
      const c = W.partColors[w.rand(8)], v = W.partVels[w.rand(8)];
      novaSpawnParticles(w, Math.trunc(p.x), Math.trunc(p.y), v, 0, W.partLifeMin, W.partLifeMax, c, 32, W.particles, 0);
    }
    if ((W.flags3 & 4) && sh.owner !== -1 && w.ships[sh.owner]) { const r = w.ships[sh.owner].wi.get(sh.w); if (r) r.reload = f32(W.reload); }
    if (W.decay > 0) { sh.decayAcc = f32(sh.decayAcc + 1); if (sh.decayAcc > W.decay) { sh.decays++; sh.decayAcc = 0; } }
    return;
  }
  // an end not by a hit (a hit shot is no longer seen): its submunitions, and its blast or explod
  if (sh.life > -32000 && !sh.hit) {
    if (!(W.flags2 & 0x20) && W.subCount > 0) novaSubmunitions(w, sh, sh.target);
    if (W.flags & 0x8000) {
      novaCreateExplosion(w, sh.x, sh.y, W.explod, W.blast, true);
      if (W.blast > 0 && !(W.flags2 & 0x0400)) for (let i = 0; i < 64; i++) {
        const o = w.ships[i];
        if (!o || (i === sh.owner && !(sh.owner === 0 && !(W.flags & 0x100)))) continue;
        if (novaClassFight(D, o.cls).flags & 0x400) continue;
        if (Math.abs(f32(o.x - sh.x)) <= W.blast && Math.abs(f32(o.y - sh.y)) <= W.blast) {
          novaDamageShip(w, o, sh, W.impact, W.mass, W.energy, sh.owner, false, false, sh.dis, false, !!(W.flags & 0x20));
          novaIonize(o, W, sh);
        }
      }
    } else if (W.explod > 0) novaSpawnExplod(w, sh.x, sh.y, 0, 0);
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
  if (W.guid === 1 && sh.target !== t.slot && !(W.flags2 & 0x0008)) return false;
  // the firer as it was, even gone
  const O = sh.owner >= 0 && sh.owner <= 63 ? w.ships[sh.owner] || w.last[sh.owner] : null;
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
  // placed as the program places sprites: the middle less half the width (the height for a ship's top, the width again for a shot's)
  const tl = Math.trunc(t.x) - Math.trunc(tw / 2), tt = Math.trunc(t.y) - Math.trunc(th / 2);
  const sl = Math.trunc(sh.x) - Math.trunc(sw / 2), st = Math.trunc(sh.y) - Math.trunc(sw / 2);
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
  if (sh.shown !== undefined) return Math.min(sh.shown, n - 1);
  let f = (W.flags & 1) ? sh.frame : Math.trunc(f32(n * sh.heading) / 360);
  if (f >= n) f = (W.flags & 1) && (W.flags2 & 2) ? n - 1 : (W.flags & 1) ? (sh.frame = 0) : n - 1;
  return f < 0 ? 0 : f;
}

/* The start of each step (DoPlayGameWork 0x43e70, 0x44015): SpriteWorld's
   collisions (SWCollideSpriteLayer), layer by layer in the program's
   order -- a scooping ship against the boxes while there are any; then
   for the plain shots, the guided and the turrets' in turn, every ship
   (the plain ships' layer, the escorts', the disabled) against every shot,
   then every asteroid against them -- each list walked in its order, a
   hit taken unless the shot is not yet armed (ProxSafety); then the
   proximity fuses (CheckShotProximities 0x371bc). */
function novaShotHits(w) {
  const D = w.D, L = w.layers || (w.layers = novaLayers());
  if (w.boxesActive) for (const tl of ['ship', 'escort', 'disabled']) for (const ti of L[tl].slice()) {
    const t = w.ships[ti];
    if (!t || t.state !== 0x11) continue;
    for (let bi = 0; bi < 64; bi++) { const x = w.boxes[bi]; if (x && !(x.life < 0) && x.on && novaBoxHit(D, t, x)) novaScoop(w, t, x); }
  }
  for (const sl of ['shot', 'guided', 'turret']) {
    for (const tl of ['ship', 'escort', 'disabled']) for (const ti of L[tl].slice()) {
      const t = w.ships[ti];
      if (!t) continue;
      for (const si of L[sl]) {
        const sh = w.shots[si];
        if (!sh || !(sh.life > 0)) continue;
        const W = novaWeapOf(D, sh.w);
        if (!novaShotCanHit(w, sh, t) || !novaSpriteHit(D, t, sh, W)) continue;
        if (W.proxSafety > 0 && sh.life > W.count - W.proxSafety) continue;
        novaShipHit(w, sh, t, false);
      }
    }
    for (let ai = 0; ai < 16; ai++) {
      const a = w.roids[ai];
      if (!a.active) continue;
      for (const si of L[sl]) {
        const sh = w.shots[si];
        if (!sh || !(sh.life > 0)) continue;
        const W = novaWeapOf(D, sh.w);
        if (!(W.seeker & 1) && novaRoidShotHit(D, a, sh, W)) novaAsteroidHit(w, sh, a);
        if (!a.active) break;
      }
    }
  }
  // the point defence shots: against the asteroids as any shot, then against the homing shots by their boxes alone
  for (let ai = 0; ai < 16; ai++) {
    const a = w.roids[ai];
    if (!a.active) continue;
    for (const si of L.pd) {
      const sh = w.shots[si];
      if (!sh || !(sh.life > 0)) continue;
      const W = novaWeapOf(D, sh.w);
      if (!(W.seeker & 1) && novaRoidShotHit(D, a, sh, W)) novaAsteroidHit(w, sh, a);
      if (!a.active) break;
    }
  }
  for (const pi of L.pd) {
    const p = w.shots[pi];
    // (a point defence shot hidden by a hit goes on through the homing shots it overlaps in the same pass, as the program's loop does)
    if (!p || p.hit) continue;
    const PW = novaWeapOf(D, p.w), ps = novaFightSprite(D, novaSpinSprite(D, PW.spin));
    if (!ps) continue;
    for (const gi of L.guided) {
      const g = w.shots[gi];
      if (!g || g.hit) continue;
      const gs = novaFightSprite(D, novaSpinSprite(D, novaWeapOf(D, g.w).spin));
      if (!gs) continue;
      const pl = Math.trunc(p.x) - Math.trunc(ps.w / 2), pt = Math.trunc(p.y) - Math.trunc(ps.w / 2);
      const gl = Math.trunc(g.x) - Math.trunc(gs.w / 2), gt = Math.trunc(g.y) - Math.trunc(gs.w / 2);
      if (!(pt < gt + gs.h && gt < pt + ps.h && pl < gl + gs.w && gl < pl + ps.w)) continue;
      p.life = 0; p.hit = true;
      novaPointDefenseHit(w, PW, g, p.x, p.y, p.owner);
    }
  }
  for (const sh of w.shots) {
    if (!sh || !(sh.life >= 0)) continue;
    const W = novaWeapOf(D, sh.w);
    if (!(sh.life < W.count - W.proxSafety) || !(W.prox > 0)) continue;
    let hit = false;
    for (let i = 0; i < 64; i++) {
      const t = w.ships[i];
      if (!t || !novaShotCanHit(w, sh, t)) continue;
      const ts = novaFightSprite(D, t.cls.sprite), r = Math.trunc((ts ? ts.w : 32) * 0.333 + W.prox);
      const dx = Math.trunc(t.x) - Math.trunc(sh.x), dy = Math.trunc(t.y) - Math.trunc(sh.y);
      if (dx * dx + dy * dy <= r * r) { novaShipHit(w, sh, t, true); hit = true; break; }
    }
    // the asteroids too, by the bare radius, but for a shot that passes them (Seeker 0x0001)
    if (!hit && !(W.seeker & 1)) for (let i = 0; i < 16; i++) {
      const a = w.roids[i];
      if (!a.active) continue;
      const dx = Math.trunc(f32(a.x - sh.x)), dy = Math.trunc(f32(a.y - sh.y));
      if (dx * dx + dy * dy <= W.prox * W.prox) { novaAsteroidHit(w, sh, a); break; }
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
  if (W.hitParticles > 0) novaSpawnParticles(w, Math.trunc(sh.x), Math.trunc(sh.y), W.hitPartVel, 20, W.hitPartLife, (Math.trunc(W.hitPartLife * 1.25) << 16) >> 16, W.hitPartColor, 32, W.hitParticles, 0);
  novaIonize(t, W, null);
  novaDamageShip(w, t, sh, W.impact, mass, energy, sh.owner, true, sh.target === t.slot, sh.dis, false, !!(W.flags & 0x20));
  if (W.blast > 0) for (let i = 0; i < 64; i++) {
    const o = w.ships[i];
    if (!o || o === t || (i === sh.owner && !(sh.owner === 0 && !(W.flags & 0x100)))) continue;
    if (Math.abs(f32(o.x - sh.x)) <= W.blast && Math.abs(f32(o.y - sh.y)) <= W.blast) {
      novaDamageShip(w, o, sh, W.impact, W.mass, W.energy, sh.owner, false, false, sh.dis, false, !!(W.flags & 0x20));
      novaIonize(o, W, sh);
    }
  }
  if (sub && W.subCount > 0) novaSubmunitions(w, sh, t.slot);
  // spent, and unseen: its slot stays taken till HandleShot frees it
  sh.life = -1; sh.hit = true;
}

/* ---- damage ------------------------------------------------------------------ */

/* IonizeShip 0x8409: a weapon's Ionization added to the ship's, for a blast
   from `at` less by the square of the distance over the square of the
   BlastRadius, none beyond it; its IonizeColor or'ed into the ship's. */
function novaIonize(s, W, at) {
  let v = W.ion;
  if (at) {
    const d = novaDist2(s.x, s.y, at.x, at.y), B = f32(W.blast * W.blast);
    if (B < d) return;
    if (d > 0) v = (Math.trunc(v * (1 - f32(d / B))) << 16) >> 16;
  }
  if (v > 0) { s.ion = f32(v + s.ion); s.ionColor = (s.ionColor | W.ionColor) >>> 0; }
}

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
  if (hit && A && A.primary === t.slot && (A.state === 0xd || (A.leader >= 1 && A.leader <= 63 && w.ships[A.leader] && w.ships[A.leader].state === 0xd))) noKill = true;
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
  if (t.mode === 0xf && attacker > 0 && t.slot > 0) return;
  const af = novaClassFight(D, A.cls), tf = novaClassFight(D, t.cls);
  if (af.escortType === 0 && tf.escortType !== 0 && t.primary !== -1 && t.state === 4) return;
  t.harass = 0;
  // Flags2 0x4000: attacked by a ship it is not fighting, a ship that can cloaks, its bursts' weapons put to their burst reload (AIForceBurstReload 0x84c37)
  if ((tf.flags2 & 0x4000) && novaCanCloak(t) && !(t.primary === attacker && t.state === 4)) {
    for (const r of t.weap) { const W = novaWeapOf(D, r.i); if (tf.count[r.i] > 0 && W && W.burstCount > 0 && W.burstReload > 0) { r.burst = 0; r.reload = f32(W.burstReload); } }
    novaCloak(t);
  }
  if (t.primary !== -1 && t.state === 4 && novaAngleApart(Math.trunc(t.heading), t.want) <= 44) {
    const cur = w.ships[t.primary];
    if (cur && novaDist2(t.x, t.y, A.x, A.y) > f32(novaDist2(t.x, t.y, cur.x, cur.y) * 0.25)) return;
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
    s.leader = -1;
    novaGone(w, s, 'destroyed');
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
  // fully ionized (ShipIonizationFactor 1 or more), a weapon of Seeker 0x0020 is held at a reload of 1
  const held = Math.trunc(novaIonFactor(s)) > 0;
  for (const r of s.weap) {
    if (r.count <= 0) continue;
    if (r.reload > 0) r.reload = f32(r.reload - 1); else r.reload = 0;
    if (held) { const W = novaWeapOf(D, r.i); if (W && (W.seeker & 0x20)) r.reload = 1; }
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
   the class's AI type or `ai`, facing `heading` if given. Null with no room. */
function novaPlaceShip(w, clsId, govt, x, y, ai, heading) {
  const cls = w.D.classes.get(clsId), slot = novaFreeSlot(w, 0);
  if (!cls || slot < 0) return null;
  const s = novaFreshShip(w, slot);
  Object.assign(s, { cls, govt, ai: ai > 0 ? ai : cls.ai > 0 ? cls.ai : 3, x: f32(x), y: f32(y) });
  s.heading = heading !== undefined ? heading : w.rand(360);
  s.skill = novaSkill(w, cls);
  s.aggr = w.rand(3) ^ 2;
  novaSpriteDraws(w, s, cls);
  s.boost = novaHasAfterburner(w, s);
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
      // (SpawnBeam measures them at the ship's heading, not its sprite's frame)
      b.exit = novaClosestExit(w, s, b.et, t, Math.trunc(s.heading));
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
function novaClosestExit(w, s, et, t, rot) {
  let best = -1, bd = 0;
  for (let idx = 0; idx < 4; idx++) {
    const p = novaExitPoint(w, s, et, idx, rot), d = novaDist2(p.x, p.y, t.x, t.y);
    if (best === -1 || d < bd) { best = idx; bd = d; }
  }
  return best;
}
// Where an exit point is, turned with the ship's frame and compressed (ModifyShotStartPosition2 0x706e).
function novaExitPoint(w, s, et, idx, at) {
  const c = novaClassFight(w.D, s.cls), fp = c.framesPer, rot = at !== undefined ? at : Math.trunc(((s.frame || 0) % fp) * (360 / fp));
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
    // a point defence beam at a homing shot: held on it while it lasts, wearing it down each step, and hitting nothing else
    if (W.guid === 10 && b.pd === 1) {
      const sh = b.target !== -1 ? w.shots[b.target] : null;
      if (!sh || sh.life < 0) { b.life = -1; b.target = -1; }
      else ang = novaBearing(o.x, o.y, sh.x, sh.y);
      b.x0 = o.x; b.y0 = o.y;
      if (b.life >= 0 && sh) { novaPointDefenseHit(w, W, sh, sh.x, sh.y, b.owner); b.x1 = sh.x; b.y1 = sh.y; }
      else { const e = { x: o.x, y: o.y }; novaAccel(ang, W.beamLength, e); b.x1 = e.x; b.y1 = e.y; }
      continue;
    }
    if (b.target !== -1 && W.guid !== 0) {
      const t = w.ships[b.target];
      if (t) ang = novaBearing(o.x, o.y, t.x, t.y); else b.life = -1;
    }
    if (W.inacc > 0 && W.guid !== 10) ang += w.rand(2 * W.inacc) - W.inacc;
    b.x0 = o.x; b.y0 = o.y;
    let len = W.beamLength;
    if (b.life >= 0) {
      if (W.flags2 & 0x0200) s.flash = 32;
      s.lastFire = novaNow(w);
      let hit = -1, hd = 0, hw = 0;
      for (let i = 0; i < 64; i++) {
        const t = w.ships[i];
        if (!t || i === b.owner || t.leader === b.owner || i === s.leader) continue;
        if (!novaSameHide(D, t, W)) continue;
        const ts = novaFightSprite(D, t.cls.sprite), tw = Math.trunc((ts ? ts.w : 32) * 0.66);
        const reach = W.beamLength + Math.trunc(tw / 2);
        const d2 = novaDist2(t.x, t.y, o.x, o.y);
        if (!(d2 <= reach * reach)) continue;
        const a = novaBearing(o.x, o.y, t.x, t.y), tol = Math.trunc(tw * 10 / 32);
        if (Math.abs(a - ang) > tol) continue;
        const di = Math.trunc(d2);
        if (hit === -1 || di < hd) { hit = i; hd = di; hw = ts ? ts.w : 32; }
      }
      // with no ship in the beam, or one mining, the asteroids: the one in the beam whose number's ship is nearest (the program measures the ship in that slot, not the asteroid)
      let ra = -1;
      if (hit === -1 || (b.owner > 0 && s.state === 0x10)) {
        if (!(W.seeker & 1)) {
          let bd = 0;
          for (let k = 0; k < 16; k++) {
            const a = w.roids[k];
            if (!a.active) continue;
            const rs = novaFightSprite(D, D.roids[a.type].sprite), yh = rs ? rs.h : 32, reach = W.beamLength + Math.trunc(yh / 2);
            if (!(novaDist2(a.x, a.y, o.x, o.y) <= reach * reach)) continue;
            if (Math.abs(novaBearing(o.x, o.y, a.x, a.y) - ang) > Math.trunc(yh * 10 / 32)) continue;
            const sk = w.ships[k] || w.last[k] || { x: 0, y: 0 }, di = Math.trunc(novaDist2(sk.x, sk.y, o.x, o.y));
            if (ra === -1 || di < bd) { ra = k; bd = di; }
          }
        }
        if (ra !== -1) {
          const a = w.roids[ra], t = D.roids[a.type], rs = novaFightSprite(D, t.sprite), p = { x: o.x, y: o.y };
          len = f32(Math.trunc((rs ? rs.h : 32) * -0.2 + Math.sqrt(novaDist2(o.x, o.y, a.x, a.y))));
          novaAccel(ang, len, p);
          novaCreateExplosion(w, p.x, p.y, W.explod, W.blast, true);
          if (W.hitParticles > 0) novaSpawnParticles(w, Math.trunc(p.x), Math.trunc(p.y), W.hitPartVel, 25, W.hitPartLife, (Math.trunc(W.hitPartLife * 1.25) << 16) >> 16, W.hitPartColor, 32, W.hitParticles, 0);
          const dmg = (W.flags2 & 0x8000) ? W.mass * 10 : W.mass;
          a.strength = ((a.strength - dmg) << 16) >> 16;
          if (a.strength < 0) novaDestroyAsteroid(w, a);
          else if (W.impact !== 0 && t.mass > 0) {
            const oc = novaClassFight(D, s.cls);
            if (W.impact < 0 && oc.mass < t.mass * 0.5 && oc.mass > 0 && !(oc.flags & 0x0400)) {
              // a tractor beam on an asteroid much heavier than the ship pulls the ship, and holds it
              if (Math.abs(f32(o.x - a.x)) >= 50 || Math.abs(f32(o.y - a.y)) >= 50) {
                const v = { x: s.vx, y: s.vy }; novaAdjustedAccel(novaBearing(a.x, a.y, o.x, o.y), f32(W.impact / oc.mass), s.cls.speed, v);
                const m = novaShipMaxSpeed(D, s); s.vx = Math.min(m, Math.max(-m, v.x)); s.vy = Math.min(m, Math.max(-m, v.y));
              }
              if (s.tractor === -1 || s.tractor === undefined) s.tractor = s.slot;
              s.tractorAt = novaNow(w);
            } else {
              const v = { x: a.vx, y: a.vy }; novaAdjustedAccel(ang, f32(W.impact / t.mass), 2, v);
              a.vx = Math.min(2, Math.max(-2, v.x)); a.vy = Math.min(2, Math.max(-2, v.y));
            }
          }
        } else len = W.beamLength;
      } else {
        const t = w.ships[hit], p = { x: o.x, y: o.y };
        len = f32(Math.trunc(hw * -0.2 + Math.sqrt(novaDist2(t.x, t.y, o.x, o.y))));
        novaAccel(ang, len, p);
        novaCreateExplosion(w, p.x, p.y, W.explod, W.blast, true);
        novaIonize(t, W, null);
        if (W.hitParticles > 0) novaSpawnParticles(w, Math.trunc(p.x), Math.trunc(p.y), W.hitPartVel, 25, W.hitPartLife, (Math.trunc(W.hitPartLife * 1.25) << 16) >> 16, W.hitPartColor, 32, W.hitParticles, 0);
        let impact = W.impact;
        if (impact < 0 && t.pers !== 0x3ff) {
          // a tractor beam: a ship no heavier than three quarters of the firer's is held to it (and pulled, by the hit); else the firer is pulled to it and held
          const tc = novaClassFight(D, t.cls), oc = novaClassFight(D, s.cls);
          if (tc.mass > 0 && !(tc.flags & 0x0400)) {
            if (tc.mass * 0.75 <= oc.mass) { t.tractor = b.owner; t.tractorAt = novaNow(w); }
            else {
              if (s.tractor === -1 || s.tractor === undefined) s.tractor = b.owner;
              s.tractorAt = novaNow(w);
              if ((Math.abs(f32(o.x - t.x)) >= 50 || Math.abs(f32(o.y - t.y)) >= 50) && oc.mass > 0 && !(oc.flags & 0x0400)) {
                const v = { x: s.vx, y: s.vy }; novaAdjustedAccel(novaBearing(t.x, t.y, o.x, o.y), f32(impact / oc.mass), s.cls.speed, v);
                const m = novaShipMaxSpeed(D, s); s.vx = Math.min(m, Math.max(-m, v.x)); s.vy = Math.min(m, Math.max(-m, v.y));
              }
              impact = 0;
            }
          }
        }
        const aimed = b.target === -1 ? s.primary === hit : b.target === hit;
        novaDamageShip(w, t, o, impact, W.mass, W.energy, b.owner, true, aimed, b.dis, false, !!(W.flags & 0x20));
      }
    }
    const e = { x: o.x, y: o.y }; novaAccel(ang, len, e);
    b.x1 = e.x; b.y1 = e.y;
  }
}

/* ---- fighters --------------------------------------------------------------- */

/* AIFightThreatToParent 0x81de6: a ship that threatens the escort's lead,
   drawn at random among them, attacked; none, no target. */
function novaFightThreatToParent(w, s) {
  const lead = w.ships[s.leader];
  const ok = i => i !== s.slot && i !== s.leader && w.ships[i] && !w.ships[i].disabled && lead && novaThreatens(w, w.ships[i], lead);
  let n = 0;
  for (let i = 0; i < 64; i++) if (ok(i)) n++;
  if (n < 1) { s.primary = -1; return; }
  for (;;) {
    const r = w.rand(0x40);
    if (r === s.slot || r === s.leader || !w.ships[r] || w.ships[r].disabled) continue;
    if (novaThreatens(w, w.ships[r], lead)) { s.sec = -1; s.primary = r; s.state = 4; return; }
  }
}
// AIInGunRange with no weapon named (0x7f9d5): any of the class's weapons up to guidance 8 reaching the target.
function novaInGunRangeAny(w, s, t) {
  if (!t) return false;
  const c = novaClassFight(w.D, s.cls);
  for (let i = 0; i < 256; i++) {
    const W = novaWeapOf(w.D, i);
    if (W && W.guid <= 8 && c.count[i] > 0 && novaInGunRange(s, t, W)) return true;
  }
  return false;
}
/* AILaunchFighter 0x81372: with a target in the system, the first loaded
   fighter bay (guidance 99) launches when ready, then reloads (Reload over
   its count). */
function novaLaunchFighters(w, s) {
  const D = w.D, t = s.primary !== -1 ? w.ships[s.primary] : null;
  if (!t) return;
  for (const r of s.weap) {
    const W = novaWeapOf(D, r.i);
    if (!(r.count > 0 && r.ammo > 0 && W.guid === 99 && !(W.flags2 & 0x0100))) continue;
    if (r.reload > 0) return;
    s.lastW = r.i;
    if (!novaLaunchFighter(w, s, r.i)) return;
    r.ammo--;
    r.reload = f32(W.reload / r.count);
    if (W.flags3 & 0x20) for (const q of s.weap) if (q !== r && f32(r.reload + 2) > q.reload) q.reload = f32(r.reload + 2);
    return;
  }
}
/* LaunchFighter 0x3d62d: a ship made as a spawner makes one, of the class
   the bay's AmmoType names, at the carrier, moving with it and pushed out
   along its heading (give or take the bay's Inaccuracy) at the bay's
   Speed; AI type 5, of the carrier's government, its escort, coasting
   the bay's Count steps, with the carrier's target unless that is a
   squad-mate. */
function novaLaunchFighter(w, s, i) {
  const D = w.D, W = novaWeapOf(D, i), cls = D.classes.get(W.ammoType);
  if (!cls) return false;
  const f = novaSpawnBlank(w);
  if (!f) return false;
  Object.assign(f, { cls, x: s.x, y: s.y, vx: s.vx, vy: s.vy, speed: s.speed, ai: 5, govt: s.govt, jump: 0, state: 0, mode: 0, anger: 0, goal: -2,
                     timer: f32(W.count), leader: s.slot, follows: -1, heading: s.heading, pers: null, dude: null });
  f.boost = novaHasAfterburner(w, f);
  w.rand(2);
  novaSpriteDraws(w, f, cls);
  f.primary = s.primary;
  if (W.inacc > 0) f.heading = f32(f.heading + (w.rand(2 * W.inacc) - W.inacc));
  const v = { x: f.vx, y: f.vy }; novaAdjustedAccel(Math.trunc(f.heading), W.speed, novaShipMaxSpeed(D, f), v); f.vx = v.x; f.vy = v.y;
  novaArm(w, f);
  f.shield = novaShieldCap(D, f); f.armor = novaArmorCap(D, f); novaSetDisabled(D, f);
  if (f.primary !== -1 && (f.primary === f.leader || (w.ships[f.primary] && w.ships[f.primary].leader === f.leader && f.leader !== -1))) f.primary = -1;
  Object.assign(f, { state: 0, mode: 0, goal: -2, cached: -1, mate: -1, tractor: -1 });
  return f;
}

/* ---- fleets ----------------------------------------------------------------- */

/* DoPlayGameWork 0x43e70, after the collisions: each escort whose lead is
   gone or disabled finds a new one (AICheckParentExists); a lead with
   escorts is marked to give them orders, a swarm's lead as one, and each
   ship the one whose formation it keeps -- its swarm's lead while it
   attacks, else its own lead. */
function novaFleetBookkeeping(w) {
  const prev = w.ships.map(s => s ? s.leader : -1);
  for (const s of w.ships) if (s) { s.hasEscorts = false; s.mateLead = false; s.formLead = false; }
  for (let i = 1; i < 64; i++) {
    const s = w.ships[i];
    if (!s || !(s.ai > 4)) continue;
    if (s.leader >= 1) {
      novaCheckParentExists(w, s, prev);
      if (s.leader !== -1 && w.ships[s.leader]) w.ships[s.leader].hasEscorts = true;
    }
    if (i < s.mate && s.mate < 64 && w.ships[s.mate]) w.ships[s.mate].swarmLead = true;
    if (s.ai < 5) s.follows = s.mate;
    else {
      s.follows = -1;
      if (s.primary !== -1 && s.state === 4) s.follows = s.mate;
      if (s.follows === -1) s.follows = s.leader;
    }
    if (s.follows >= 0 && s.follows < 64 && w.ships[s.follows]) w.ships[s.follows].formLead = true;
  }
}
/* AICheckParentExists 0x8926a: with its lead gone or disabled, the
   heaviest (class Mass) live ship that had the same lead, the first of
   equals, leads instead; a fighter becomes a plain escort, and waits
   (state 19) unless jumping. The new lead itself takes on its old lead's
   target and states if they share a government, and with none left the
   escort goes back to its own AI, waiting. */
function novaCheckParentExists(w, s, prev) {
  const D = w.D, L = s.leader;
  if (L < 0 || L > 63) return;
  if (w.ships[L] && !w.ships[L].disabled) return;
  let best = -1, mass = 0;
  for (let j = 1; j < 64; j++) {
    const o = w.ships[j];
    if (!o || prev[j] !== L || o.disabled) continue;
    const m = novaClassFight(D, o.cls).mass;
    if (best === -1 || m > mass) { best = j; mass = m; }
  }
  if (best === -1) { Object.assign(s, { leader: -1, state: 0x13, mode: 0, jump: -1, ai: s.cls.ai }); return; }
  if (best !== s.slot) {
    s.leader = best;
    if (s.ai === 5) s.ai = 6;
    if (s.jump < 0) s.state = 0x13;
    return;
  }
  s.jump = -1; s.ai = s.cls.ai;
  const old = w.ships[L] || w.last[L];
  if (s.govt !== -1 && old && s.govt === old.govt) Object.assign(s, { primary: old.primary, sec: old.sec, state: old.state, mode: old.mode });
  else if (s.state !== 5 && s.state !== 10 && s.state !== 0xc && s.state === 0xb) { s.state = 2; s.mode = 4; }
  else if (s.state !== 5 && s.state !== 10 && s.state !== 0xc && s.primary !== -1 && s.state !== 7 && s.state !== 9) { s.state = 4; s.mode = 0; }
  else { s.state = 0; s.mode = 0; }
  s.leader = -1;
}
/* AIIssueEscortOrders 0x8986d, every eighth frame for a lead with escorts
   (the frame's count modulo 8 against its slot over 8): an order for each
   kind of escort (the class's escort type, 0 to 3) -- 0 fight, 1 stay
   near and defend, 2 attack the nearest threat, 3 come back -- from its
   shields and its fight. A trader: its fighters defend under two thirds
   shields, else attack; its others defend. A warship: with shields at a
   third or more, at two thirds or more its fighters attack (defend if it
   can reach its target and that target is attacking it), its others
   attack, its warships fight unless it is losing and the odds are over
   half; under two thirds, or under a third, defend or attack as below.
   Plundering a disabled target, or neither fighting, retreating nor
   waiting, all come back; retreating while not jumping or braking,
   fighters and others defend. Freighters always fight. */
function novaIssueEscortOrders(w, s) {
  const D = w.D, o = [-1, -1, -1, -1];
  const sh = s.shield, cap = novaShieldCap(D, s);
  const W1 = novaWeapOf(D, 1);
  if (s.ai < 3) { o[0] = sh >= f32(cap) * 0.66 ? 2 : 1; o[1] = 1; o[2] = 1; }
  else {
    let hitsMe = false, canHit = false, dis = false, plunder = false;
    if (s.primary !== -1) {
      const T = w.ships[s.primary] || w.last[s.primary];
      if (T && T.primary === s.slot && T.state === 4) { hitsMe = !!W1 && novaInGunRange(T, s, W1); canHit = !!W1 && novaInGunRange(s, T, W1); }
      dis = !!T && T.disabled;
      plunder = dis && s.state === 0xd;
    }
    if (plunder) { o[0] = o[1] = o[2] = 3; }
    else if (sh >= f32(cap) * 0.33) {
      if (sh >= f32(cap) * 0.66) {
        o[0] = dis ? 2 : canHit ? 1 : 2; o[1] = 2;
        o[2] = s.odds < 0 || s.odds >= 0.5 ? 0 : 2;
      } else { o[0] = dis ? 2 : (!hitsMe || canHit) ? 1 : 2; o[1] = 2; o[2] = 1; }
    } else if (!dis && (canHit || !hitsMe)) { o[0] = 1; o[1] = 1; o[2] = 1; }
    else { o[0] = 2; o[1] = 2; o[2] = 1; }
  }
  o[3] = 0;
  const st = s.state;
  if (st !== 0xd && st !== 3 && st !== 4 && st !== 0x13) o.fill(3);
  if (st === 3) { if (s.mode !== 4 && s.mode !== 1) { o[0] = 1; o[1] = 1; } else o.fill(3); }
  else if (st === 2) o.fill(3);
  for (let j = 1; j < 64; j++) {
    const e = w.ships[j];
    if (j === s.slot || !e || e.leader !== s.slot || !(e.ai > 4)) continue;
    e.orders = o[novaClassFight(D, e.cls).escortType];
    e.ordered = true;
  }
}
/* IsShipANearbyThreatToParent 0x836a4: a live ship seen, not one of the
   fleet, threatening the escort's lead (disabled only when the order is
   to attack), within `range` of the lead if one is given: its square
   distance to the escort, plus to the lead if a range is given, halved
   for an escort of another type and halved again for a warship after a
   fighter; 0 for none. FindNearestThreatToParent 0x83861: the least. */
function novaNearbyThreat(w, c, s, range) {
  const L = s.leader, lead = w.ships[L];
  if (c === s || c.slot === c.leader || c.slot === L || c.leader === L || !novaVisible(c, s) || (c.disabled && s.orders !== 2)) return 0;
  if (!lead || !novaThreatens(w, c, lead)) return 0;
  const d2 = (a, b) => novaDist2(a.x, a.y, b.x, b.y);
  const dl = d2(lead, c);
  let f;
  if (range < 1) f = d2(s, c);
  else { if (range * range < Math.trunc(dl)) return 0; f = f32(Math.trunc(dl) + d2(s, c)); }
  let v = Math.trunc(f);
  const tc = novaClassFight(w.D, c.cls).escortType, ts = novaClassFight(w.D, s.cls).escortType;
  if (tc !== ts) { v = Math.trunc(v / 2); if (ts === 2 && tc === 0) v = Math.trunc(v / 2); }
  return v < 1 ? 1 : v;
}
function novaNearestThreatToParent(w, s, range) {
  let best = -1, at = -1;
  for (let i = 0; i < 64; i++) {
    const c = w.ships[i];
    if (!c) continue;
    const v = novaNearbyThreat(w, c, s, range);
    if (v > 0 && (v < best || best < 0)) { at = i; best = v; }
  }
  return at;
}
/* AIVerifySwarmLeader 0x7e2fe, AIFindSwarmLeader 0x7e39e: a ship of a
   class that swarms (Flags2 0x0001) follows the first live swarming ship
   in a slot below its own with the same target and the same government
   or lead. */
function novaSwarmMate(w, s, j) {
  const o = w.ships[j];
  return !!o && !!(o.cls.flags2 & 1) && o.primary === s.primary &&
    ((o.govt === s.govt && o.govt !== -1) || (o.leader === s.leader && o.leader !== -1));
}
function novaSwarmLeader(w, s) {
  if (!(s.cls.flags2 & 1) || (s.mate > 0 && s.mate < s.slot && novaSwarmMate(w, s, s.mate))) return;
  s.mate = -1;
  for (let j = 1; j < s.slot; j++) if (novaSwarmMate(w, s, j)) { s.mate = j; return; }
}

/* ---- plundering ------------------------------------------------------------- */

const novaCargo = s => s.cargo.reduce((a, b) => a + Math.max(0, b), 0);
/* PirateWarshipAI 0x8c2d2, for a government that plunders (Flags 0x1000),
   in place of WarshipAI: with no target, the nearest disabled ship it may
   board (novaFindShipToPlunder), else one to fight (SelectWarshipTarget),
   else it leaves, or makes for a stellar; a trader with a crew it boards
   (state 13), anything else it attacks (state 4). A ship already being
   boarded it attacks, and if another is boarding it, waits four seconds
   (state 22). No odds, no cowardice: a pirate retreats only with no
   ammunition left at all. */
function novaPirateWarshipAI(w, s) {
  const D = w.D;
  if (s.disabled || s.state === 0x16) return;
  if (s.primary !== -1) { const t = w.ships[s.primary]; if (!t || novaDying(t)) { s.primary = -1; s.state = 0; } }
  const crew = t => t.cls.rec.Crew;
  const boardable = t => t.cls.ai < 3;   // its class's InherentAI below 3 (a computer ship's +0xc8de is always -1)
  let go = true;
  if (s.state !== 0) {
    if (s.primary === -1) { if (s.state === 0xe) go = false; }
    else go = false;
  }
  if (go) {
    s.primary = -1;
    novaFindShipToPlunder(w, s);
    if (s.primary === -1) {
      novaSelectTarget(w, s);
      if (s.primary === -1) {
        const at = !w.si.nav.some(n => n !== -1) || (s.goal !== -1 && w.si.nav.includes(s.goal));
        if (at || s.sec !== -1) { if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6; }
        else {
          s.sec = novaPickStellar(w, s, false, false);
          if (s.sec === -1) { if (novaCanLeave(w, s)) novaLeave(w, s); else s.state = 6; }
          else s.state = 1;
        }
      }
    }
    if (s.primary !== -1) {
      const t = w.ships[s.primary];
      s.state = t && boardable(t) && crew(t) !== 0 ? 0xd : 4;
    }
  }
  if (s.primary !== -1 && (s.state === 0xd || s.state === 4)) {
    const t = w.ships[s.primary];
    if (t && boardable(t) && crew(t) > 0) {
      if (!t.boarded) s.state = 0xd;
      else {
        s.state = 4;
        for (let j = 1; j < 64; j++) {
          const o = w.ships[j];
          if (!o || j === s.slot || j === s.primary || o.leader === 0 || o.disabled) continue;
          if (o.primary === s.primary && (o.state === 0xd || o.mode === 0xe)) {
            Object.assign(s, { state: 0x16, mode: 0, primary: -1, sec: -1, anger: 0, timer: 120 });
            break;
          }
        }
      }
    } else s.state = 4;
  }
  // boarded and the count run out: plunder it, and pull away (state 14)
  if (s.state === 4 && s.mode === 0xf && s.sec !== -1 && s.timer <= 0) {
    Object.assign(s, { timer: 100, state: 0xe, mode: 0 });
    const t = w.ships[s.sec];
    if (t) novaPlunder(w, s, t);
    s.primary = -1; s.sec = -1;
  }
  if (s.state === 4 && s.primary !== -1) {
    const t = w.ships[s.primary];
    if (t && t.disabled && t.cls.ai > 2 && (!novaHasDestroying(w, s) || novaOutOfAmmo(w, s) === 2)) { s.state = 0; s.primary = -1; }
  }
  if ((s.state === 4 || s.state === 0xd) && novaOutOfAmmo(w, s) === 2) Object.assign(s, { state: 0, mode: 0, primary: -1, sec: -1 });
  void D;
}
/* AIFindShipToPlunder 0x7fd10: the nearest live disabled ship, not its own
   escort nor being boarded, with a crew, not of an allied government -- a
   warship (InherentAI 3 or more, and flying as one) only when it has no
   weapon that can destroy (the program's test). */
function novaFindShipToPlunder(w, s) {
  const D = w.D, destroys = novaHasDestroying(w, s);
  let best = -1, bd = 0;
  for (let j = 0; j < 64; j++) {
    const o = w.ships[j];
    if (j === s.slot || !o || o.leader === s.slot || o.boarded || !o.disabled) continue;
    if (!(o.ai < 3) && o.cls.ai > 2 && !destroys) continue;
    if (!(o.cls.rec.Crew > 0) || (o.leader !== 0 && novaGovtAllies(D, s.govt, o.govt))) continue;
    const d = Math.trunc(novaDist2(s.x, s.y, o.x, o.y));
    if (best === -1 || d < bd) { best = j; bd = d; }
  }
  if (best !== -1) { s.primary = best; s.state = 0xd; s.mode = 0; }
}
/* AIPlunderShipContents 0x83fab: as much of the boarded ship's cargo as the
   pirate has room for, a random kind of the six at a time; then the
   capture: with a chance of (pirate Strength x 100 / (2 x the ship's
   Strength), and the crew outfits, less 0 to 20, plus 10, held to 10 to
   100) over 40, that chance over 2 in 100 the ship becomes the pirate's
   escort, of its government, armour at two thirds. */
function novaPlunder(w, s, t) {
  const D = w.D;
  if (novaDying(t)) return;
  let room = s.cls.holds;
  for (const c of s.cargo) if (c > 0) room -= c;
  const tHolds = t.cls.holds;
  let left = Math.min(novaCargo(t), tHolds);
  const A = s.cls.board, T = t.cls.board;
  const att = s.cls.rec.Strength + A.pos;
  let def = t.cls.rec.Strength + T.pos;
  if (def < 1) def = 1;
  let ratio = (Math.trunc(f32(att) * 100 / f32(f32(def) + f32(def))) << 16) >> 16;
  ratio = ((ratio - A.neg + T.neg) << 16) >> 16;
  let chance = ratio - w.rand(0x15) + 10;
  chance = chance < 10 ? 10 : chance > 100 ? 100 : chance;
  let taken = 0;
  while (left > 0 && room > 0) {
    const k = w.rand(6), have = t.cargo[k];
    if (have > 0) {
      let n = Math.min(have, room);
      if (tHolds < n + taken) n = tHolds - taken;
      if (n < 0) n = 0;
      t.cargo[k] = have - n; s.cargo[k] += n;
      left -= n; room -= n; taken += n;
    }
  }
  if (t.leader === -1 && t.mission !== undefined && t.mission !== -1) return;
  if (chance > 40 && w.rand(0x65) <= chance * 0.5) {
    Object.assign(t, { pers: null, ai: 6, leader: s.slot, state: 0, mode: 0, boarded: false, govt: s.govt, timer: 150, shield: 0 });
    t.armor = f32(novaArmorCap(D, t) * 0.66);
    novaSetDisabled(D, t);
  }
}

/* The test HighLevelAIHandler makes of a target in states 4 and 13: one of
   the ship's own fleet -- its lead, a ship with the same lead, or a lead
   above the target's one shared with its own -- is let be (state 0). */
function novaFleetMateTarget(w, s) {
  const L = s.leader;
  if (L === -1) return false;
  const t = w.ships[s.primary] || w.last[s.primary];
  const stop = () => { Object.assign(s, { state: 0, mode: 0, primary: -1 }); return true; };
  if (L === s.primary) return stop();
  const T = t ? t.leader : -1;
  if (T === L) return stop();
  const at = i => w.ships[i] || w.last[i];
  if (T !== -1 && at(T)) {
    const TT = at(T).leader;
    if (TT !== -1) {
      if (TT === T) return stop();
      const LL = at(L) ? at(L).leader : -1;
      if (LL !== -1 && at(LL) && at(LL).leader === TT) return stop();
    }
  }
  return false;
}
/* LowLevelAIHandler, move 15: alongside a ship to board it -- the relative
   velocity braked to within 0.525, then velocity and heading matched and
   nudged a unit a step to within 3 of it; there the ship is marked as
   being boarded and the boarding counts 100 to 179 steps, plundered (a
   pirate in state 13) once under 100. */
function novaDocking(w, s, t) {
  const D = w.D;
  const rx = f32(s.vx - t.vx), ry = f32(s.vy - t.vy);
  if (Math.abs(rx) < 0.525 && Math.abs(ry) < 0.525) {
    s.want = Math.trunc(t.heading); s.vx = t.vx; s.vy = t.vy;
    if (Math.abs(f32(s.x - t.x)) > 3 || Math.abs(f32(s.y - t.y)) > 3) {
      s.speed = 0;
      const p = { x: s.x, y: s.y }; novaAccel(novaBearing(s.x, s.y, t.x, t.y), 1, p); s.x = p.x; s.y = p.y;
    } else if (s.timer > 100 || s.timer <= 0) {
      if (s.timer <= 0 && s.state !== 0xe) { t.boarded = true; s.timer = w.rand(0x50) + 100; s.vx = t.vx; s.vy = t.vy; }
    } else if (s.state === 0xd) {
      Object.assign(s, { timer: 100, state: 0xe, mode: 0 });
      novaPlunder(w, s, t);
      s.primary = -1; s.sec = -1;
    }
  } else if (!novaInertialess(s)) {
    s.want = (novaBearing(0, 0, f32(rx * 100), f32(ry * 100)) + 180) % 360;
    if (novaAngleApart(s.want, Math.trunc(s.heading)) < novaShipTurn(s) + 1) { s.thrust = novaShipAccel(D, s); s.desired = 0; }
    if (!(Math.abs(rx) > 1.75 && Math.abs(ry) > 1.75)) { s.vx = f32(t.vx + f32(rx * 0.95)); s.vy = f32(t.vy + f32(ry * 0.95)); }
  } else {
    s.thrust = 0; s.desired = 0;
    if (s.speed > 0) { s.speed = f32(s.speed - novaShipAccel(D, s)); if (s.speed < 0) s.speed = 0; }
  }
}

/* AIAddFighterToParent 0x802a5: a fighter landed is one more in its
   carrier's bay for its class (a bay empty till then starts its reload
   over), and is gone. */
function novaFighterAboard(w, f) {
  const D = w.D, c = w.ships[f.leader];
  if (c) for (const r of c.weap) {
    const W = novaWeapOf(D, r.i);
    if (!W || W.ammoType !== f.cls.id || W.guid !== 99 || !(r.count > 0)) continue;
    if (r.ammo === 0 && r.reload < W.reload) r.reload = f32(W.reload);
    r.ammo++;
    f.leader = -1; f.ai = -1;
    novaGone(w, f, 'landed');
    return;
  }
}

/* ---- particles and submunitions --------------------------------------------- */

/* SpawnParticles 0x44b70: `count` particles from (x, y), each at `speed`
   (give or take `spread` per cent, 1 to 99) in a direction drawn of 360,
   living lifeMin, or lifeMin to lifeMax, steps, scattered within `scatter`
   if given -- the draws as the program makes them, the particles kept
   (NewParticle, 8.8 fixed point) for the page to draw. */
function novaSpawnParticles(w, x, y, speed, spread, lifeMin, lifeMax, color, alpha, count, scatter) {
  if (!w.parts) w.parts = [];
  for (let k = 0; k < count; k++) {
    let v = speed;
    if (spread >= 1 && spread <= 99) v = f32((w.rand(spread * 2 + 1) - spread + 100) * 0.01 * speed);
    const d = { x: 0, y: 0 }; novaAccel(w.rand(360), v, d);
    let life = lifeMin;
    if (lifeMin < lifeMax) life = lifeMin + w.rand(lifeMax - lifeMin + 1);
    const p = { x: f32(x), y: f32(y) };
    if (scatter > 0) { const r = w.rand(scatter * 100); novaAccel(w.rand(360), f32(r * 0.01), p); }
    if (life > 0 && w.parts.length < 2000) w.parts.push({ x: Math.trunc(p.x) * 256, y: Math.trunc(p.y) * 256, vx: Math.trunc(d.x * 256), vy: Math.trunc(d.y * 256), life, color, alpha });
  }
}
// MoveParticles 0xc60c5: a step older, gone at 0, and moved.
function novaMoveParticles(w) {
  if (!w.parts || !w.parts.length) return;
  w.parts = w.parts.filter(p => { if (--p.life <= 0) return false; p.x += p.vx; p.y += p.vy; return true; });
}
/* SpawnShotSubmunitions 0x3f1d5: SubCount shots of the SubType, from the
   shot, a generation deeper (none past SubLimit); a point-defence shot's
   aimed at its target, one with Flags2 0x0010 at the nearest ship it can
   hit (else the ship hit, else straight on); SubTheta above 0 scatters
   each within that many degrees, below 0 fans them that far apart. */
function novaSubmunitions(w, sh, target) {
  const D = w.D, W = novaWeapOf(D, sh.w);
  if (W.subIdx === -1 || !(W.subCount > 0) || !(W.subLimit < 1 || (sh.depth || 0) < W.subLimit)) return;
  for (let k = 0; k < W.subCount; k++) {
    const j = novaSpawnShot(w, sh.owner, target, W.subIdx, true);
    if (j === -1) return;
    const n = w.shots[j];
    Object.assign(n, { x: sh.x, y: sh.y, vx: 0, vy: 0, depth: (sh.depth || 0) + 1, heading: sh.heading });
    if (W.guid === 9) n.target = sh.target;
    else if (W.flags2 & 0x10) {
      n.target = -1;
      n.target = novaNearestShotTarget(w, n);
      if (n.target === -1) n.target = target;
      if (n.target === -1) n.heading = sh.heading;
      else { const t = w.ships[n.target] || w.last[n.target]; n.heading = t ? novaBearing(sh.x, sh.y, t.x, t.y) : sh.heading; }
    }
    const th = W.subTheta;
    if (th > 0) n.heading = f32(f32(th - w.rand(th * 2 + 1)) + n.heading);
    else if (th < 0) {
      const a = Math.abs(th);
      n.heading = f32(n.heading - Math.trunc(a * (W.subCount - 1) / 2));
      n.heading = f32(a * k + n.heading);
    }
    if (n.heading < 0) n.heading = f32(n.heading + 360);
    if (n.heading >= 360) n.heading = f32(n.heading - 360);
    const NW = novaWeapOf(D, n.w);
    if (NW.guid === 6) { n.vx = sh.vx; n.vy = sh.vy; }
    else { const v = { x: n.vx, y: n.vy }; novaAccel(Math.trunc(n.heading), NW.speed, v); n.vx = v.x; n.vy = v.y; }
  }
}
/* FindNearestValidShotTarget 0x6a3a: the nearest ship the shot can hit, by
   whole distances squared in 16 bits (which wraps beyond 181 or so). */
function novaNearestShotTarget(w, sh) {
  let best = -1, bd = 0;
  for (let i = 0; i < 64; i++) {
    const t = w.ships[i];
    if (!t || !novaShotCanHit(w, sh, t)) continue;
    const dx = ((Math.abs(Math.trunc(t.x) - Math.trunc(sh.x))) << 16) >> 16, dy = ((Math.abs(Math.trunc(t.y) - Math.trunc(sh.y))) << 16) >> 16;
    const d = ((dx * dx + dy * dy) << 16) >> 16;
    if (best === -1 || d < bd) { best = i; bd = d; }
  }
  return best;
}

/* ---- layers ------------------------------------------------------------------ */

/* SpriteWorld's layers as lists in the order its collisions walk them:
   InitSprites 0x? adds the ships' sprites 63 down to 0 and the shots' 0 up
   to 127; a sprite put in another layer goes to its end (PutSpriteInLayer
   0x?), and one put in its own stays where it is. */
function novaLayers() {
  const L = { ship: [], escort: [], disabled: [], shot: [], guided: [], turret: [], pd: [], of: new Map() };
  for (let i = 63; i >= 0; i--) { L.ship.push(i); L.of.set('s' + i, 'ship'); }
  for (let i = 0; i < 128; i++) { L.shot.push(i); L.of.set('h' + i, 'shot'); }
  return L;
}
function novaPutInLayer(w, kind, id, layer) {
  const L = w.layers || (w.layers = novaLayers()), k = kind + id, cur = L.of.get(k);
  if (cur === layer) return;
  if (cur) { const a = L[cur], j = a.indexOf(id); if (j >= 0) a.splice(j, 1); }
  L[layer].push(id); L.of.set(k, layer);
}

/* ---- asteroids hit, and the boxes they leave ---------------------------------- */

// Whether two sprites' masks meet: each at its left and top, by its frame (SWRLECollision).
function novaMaskHit(a, af, al, at, b, bf, bl, bt) {
  if (bl >= al + a.w || al >= bl + b.w || bt >= at + a.h || at >= bt + b.h) return false;
  const am = novaSpriteMask(a, Math.min(a.frames - 1, Math.max(0, af))), bm = novaSpriteMask(b, Math.min(b.frames - 1, Math.max(0, bf)));
  const x0 = Math.max(al, bl), x1 = Math.min(al + a.w, bl + b.w), y0 = Math.max(at, bt), y1 = Math.min(at + a.h, bt + b.h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (am[(y - at) * a.w + (x - al)] && bm[(y - bt) * b.w + (x - bl)]) return true;
  return false;
}
// AsteroidCollisionHandler 0x369c8's test: always by the masks.
function novaRoidShotHit(D, a, sh, W) {
  const t = D.roids[a.type], ra = novaFightSprite(D, t.sprite), ss = novaFightSprite(D, novaSpinSprite(D, W.spin));
  if (!ra || !ss) return false;
  return novaMaskHit(ra, Math.trunc(a.frame), Math.trunc(a.x) - Math.trunc(ra.w / 2), Math.trunc(a.y) - Math.trunc(ra.h / 2),
                     ss, novaShotFrame(W, sh, ss), Math.trunc(sh.x) - Math.trunc(ss.w / 2), Math.trunc(sh.y) - Math.trunc(ss.w / 2));
}
/* HandleAsteroidHit 0x36637: the shot's explosion and hit particles; its
   blast only if the player fired it; the asteroid's strength less the
   shot's EnergyDmg (ten times that with Flags2 0x8000), destroyed below 0,
   else pushed by the Impact over the asteroid's Mass, to at most 2. */
function novaAsteroidHit(w, sh, a) {
  const D = w.D, W = novaWeapOf(D, sh.w), t = D.roids[a.type];
  novaCreateExplosion(w, sh.x, sh.y, W.explod, W.blast, true);
  if (W.hitParticles > 0) novaSpawnParticles(w, Math.trunc(sh.x), Math.trunc(sh.y), W.hitPartVel, 20, W.hitPartLife, (Math.trunc(W.hitPartLife * 1.25) << 16) >> 16, W.hitPartColor, 32, W.hitParticles, 0);
  a.strength = (W.flags2 & 0x8000) ? ((a.strength + W.energy * -10) << 16) >> 16 : ((a.strength - W.energy) << 16) >> 16;
  if (a.strength < 0) novaDestroyAsteroid(w, a);
  else if (W.impact !== 0 && t.mass > 0) {
    const v = { x: a.vx, y: a.vy };
    novaAdjustedAccel(Math.trunc(sh.heading), f32(W.impact / t.mass), 2, v);
    a.vx = Math.min(2, Math.max(-2, v.x)); a.vy = Math.min(2, Math.max(-2, v.y));
  }
  sh.life = -1; sh.hit = true;
}
/* DestroyAsteroid 0xadc9: its yield as boxes (YieldQty x 0.5 to 1.5 of
   them), a spray of particles, its explosion, and FragCount / 2 to
   FragCount x 1.5 fragments of its FragTypes. */
function novaDestroyAsteroid(w, a) {
  const D = w.D, t = D.roids[a.type];
  if (t.yieldQty > 0) {
    const n = (Math.trunc(t.yieldQty * (w.rand(0x65) + 50) * 0.01) << 16) >> 16;
    for (let k = 0; k < n; k++) novaSpawnBox(w, a.x, a.y, t.yieldType, (a.type >> 2) + 1);
  }
  if (t.partCount > 0) {
    const spr = novaFightSprite(D, t.sprite), wd = spr && spr.frames > 0 ? spr.w : 32;
    novaSpawnParticles(w, Math.trunc(a.x), Math.trunc(a.y), f32(0.2), 40, 240, 480, t.partColor, 32, t.partCount, Math.trunc(wd / 3));
  }
  if (t.explod !== -1) novaCreateExplosion(w, a.x, a.y, t.explod, 0, true);
  if (t.fragCount > 0) {
    const n = w.rand(t.fragCount) + (t.fragCount >> 1), f = [t.frag1, t.frag2];
    for (let k = 0; k < n; k++) {
      if (t.frag1 === -1) { if (t.frag2 !== -1) novaSpawnSubAsteroid(w, a, t.frag2); }
      else novaSpawnSubAsteroid(w, a, t.frag2 !== -1 ? f[w.rand(2)] : t.frag1);
    }
  }
  a.active = false;
}
// SpawnSubAsteroid 0x3fbc7: a fragment, where the asteroid was, drifting up to 1 a step, its frame and spin drawn.
function novaSpawnSubAsteroid(w, from, type) {
  const D = w.D, t = D.roids[type], a = w.roids.find(r => !r.active);
  if (!a) return;
  const spr = novaFightSprite(D, t.sprite);
  Object.assign(a, { active: true, type, x: from.x, y: from.y });
  a.vx = f32((w.rand(200) - 100) * 0.01); a.vy = f32((w.rand(200) - 100) * 0.01);
  a.frame = w.rand(spr ? spr.frames : t.frames);
  a.spin = f32(f32(t.spin * (w.rand(0x29) + 80)) * 0.01);
  if (w.rand(2) === 0) a.spin = -a.spin;
  a.strength = t.strength;
}
/* SpawnScoopableBox 0x3e3c5: a box of the yield, lasting 300 to 499 steps,
   turning one way, the other or not, pushed 0.12 to 0.28 a step. */
function novaSpawnBox(w, x, y, kind, sprite) {
  if (!w.boxes) w.boxes = new Array(64).fill(null);
  const i = w.boxes.findIndex(b => !b || b.life < -1);
  if (i < 0) return;
  const b = { x, y, vx: 0, vy: 0, life: f32(w.rand(200) + 300), frame: 0, kind, sprite, on: true, turn: 0 };
  b.frame = f32(w.rand(0x24));
  const r = w.rand(4);
  b.turn = r === 0 ? -1 : r === 3 ? 1 : 0;
  w.boxes[i] = b;
  const sp = w.rand(0x51), v = { x: 0, y: 0 };
  novaAccel(w.rand(0x168), f32((sp + 60) * 0.2 * 0.01), v);
  b.vx = v.x; b.vy = v.y;
}
// HandleBoxes 0x2df85: each box turns, ages and drifts; mining boxes are about while any is.
function novaHandleBoxes(w) {
  w.boxesActive = false;
  if (!w.boxes) return;
  for (let i = 0; i < 64; i++) {
    const b = w.boxes[i];
    if (!b) continue;
    if (b.life < 0) { b.life = -2; continue; }
    b.frame = f32(b.frame + b.turn);
    while (b.frame >= 36) b.frame = f32(b.frame - 36);
    while (b.frame < 0) b.frame = f32(b.frame + 36);
    b.life = f32(b.life - 1);
    b.x = f32(b.x + b.vx); b.y = f32(b.y + b.vy);
    if (b.on) w.boxesActive = true;
  }
}
// The boxes' sprites (spïn 500 + n), placed a whole width and height up and left of the box (HandleBoxes).
function novaBoxHit(D, t, x) {
  const ts = novaFightSprite(D, t.cls.sprite), bs = novaFightSprite(D, novaSpinSprite(D, 500 + x.sprite));
  if (!ts || !bs) return false;
  return novaMaskHit(ts, t.frame || 0, Math.trunc(t.x) - Math.trunc(ts.w / 2), Math.trunc(t.y) - Math.trunc(ts.h / 2),
                     bs, Math.trunc(x.frame), Math.trunc(x.x) - bs.w, Math.trunc(x.y) - bs.h);
}
// ShipCollisionHandler 0x36f87, a box: gone, and a ton of its commodity aboard.
function novaScoop(w, t, x) {
  x.life = -1;
  if (x.kind >= 0 && x.kind < 6) t.cargo[x.kind] = ((t.cargo[x.kind] + 1) << 16) >> 16;
}

/* AIFireGunUntargeted 0x80425, a miner at its asteroid: the loaded, ready
   weapon doing the most mass damage of its guns (unguided, beams -- not one
   that homes on asteroids, Seeker 0x0001, for a ship that destroys them --
   rockets, and front-quadrant turrets with no target), not one of Flags2
   0x0400. */
function novaFireGunUntargeted(w, s) {
  const D = w.D;
  let pick = -1, best = 0;
  for (const r of s.weap) {
    if (!(r.count > 0)) continue;
    const W = novaWeapOf(D, r.i), g = W.guid;
    if (g === 0) { if ((W.seeker & 1) && (s.cls.flags3 & 1)) continue; }
    else if (g === 7) { if (s.primary !== -1) continue; }
    else if (g !== -1 && g !== 6) continue;
    if (W.flags2 & 0x0400) continue;
    if (!novaHasAmmo(w, s, r.i) || r.reload > 0) continue;
    const d = Math.max(1, W.mass);
    if (best < d) { pick = r.i; best = d; }
  }
  if (pick >= 0) s.lastW = pick;
  if (s.lastW !== -1) s.latch = true;
}
// CalcObjectLeadAngle 0x2b18e: the lead on a moving object, for unguided shots, rockets of no guidance (4, 7, 8, 9) and the like.
function novaObjectLeadAngle(s, pos, vel, W) {
  let a = novaBearing(s.x, s.y, pos.x, pos.y);
  if (!W || ![-1, 4, 7, 8, 9].includes(W.guid)) return a;
  const d = f32(Math.sqrt(novaDist2(pos.x, pos.y, s.x, s.y))), tt = f32(d / W.speed);
  return novaBearing(s.x, s.y, f32(pos.x + f32(tt * f32(vel.x - s.vx))), f32(pos.y + f32(f32(vel.y - s.vy) * tt)));
}
