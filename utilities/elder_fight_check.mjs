// The older games' fight (js/nova-elder-fight.js) against sums worked by
// hand from the rules its comments give, and whole fights run for what must
// be true of any of them.
//
//   1. Records made here, so the sums need no game file: damage to a shield
//      and to armor, disabling and death, a shot that may not kill, speed,
//      acceleration, the shield's regrowth, headings, turning, which
//      governments attack which, a new ship's ammunition and a new shot.
//      Escape Velocity's rule and Override's each have their number where
//      the two differ.
//   2. Fights between the made ships. Two enemies hurt each other and two
//      ships of one government fire nothing, which is the control: the test
//      for damage is one a fight can fail. A fight run twice from one seed
//      comes out the same.
//   3. With the installers in reference/, each game's records through the
//      loader, and random fights of its ships: every number stays a number,
//      the tables stay within the programs' sizes, no ship gains speed past
//      its top speed, no shield is over its
//      class's by more than the hundredth a gain adds, and ships are
//      destroyed or disabled.
import fs from 'node:fs';
import path from 'node:path';
import { site, REF } from './load.mjs';

const S = site();
let fails = 0, sums = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const is = (what, got, want) => { sums++; if (!(Math.abs(got - want) < 1e-9)) fail(`${what} is ${got}, and by hand ${want}`); };
const yes = (what, got) => { sums++; if (!got) fail(what); };

/* ---- 1. records made here ---------------------------------------------------- */

function made(evo) {
  const D = { kind: evo ? 'evo' : 'ev', evo, game: null, elder: true, ships: [], weaps: [], govts: [], classes: new Map(), framesPer: 36 };
  const ship = (i, o) => {
    const c = Object.assign({ index: i, id: 128 + i, name: 'ship ' + i, rec: {}, w: 32, h: 32, Shield: 100, Armor: 50, Accel: 0.5, Speed: 3, Maneuver: 5,
      Fuel: 300, ShieldRe: 10, WeapType: [0, -129, -129, -129], WeapCount: [2, 0, 0, 0], AmmoLoad: [0, 0, 0, 0], DeathDelay: 10,
      TurretYDisp: [0, 0, 0, 0], Mass: 50, InherentAI: 3, Flags: 0, ShotXOffset: 0, FuelRegen: 0, SkillVar: 1 }, o);
    D.ships[i] = c;
    D.classes.set(c.id, { id: c.id, index: i, name: c.name, rec: c.rec, sprite: c.id, framesPer: 36, ai: c.InherentAI, speed: c.Speed, flags: 0, missing: false, cls: c });
  };
  const weap = (i, o) => { D.weaps[i] = Object.assign({ index: i, id: 128 + i, name: 'weapon ' + i, rec: {}, w: 8, h: 8, Reload: 10, Count: 20, MassDmg: 10, EnergyDmg: 10,
    Guidance: -1, Speed: 10, Seeker: 0, Decay: 0, AmmoType: -1, Graphic: 0, Inaccuracy: 0, Impact: 0, ExplodType: -1, ProxRadius: 0, BlastRadius: 0, MiscFlags: 0 }, o); };
  const govt = (i, o) => { D.govts[i] = Object.assign({ index: i, id: 128 + i, name: 'government ' + i, rec: {}, Flags: 0, InherentJam: 0, Ally: -1, Enemy: -1 }, o); };
  ship(0, {});
  ship(1, { Flags: 0x10 });
  ship(2, { WeapType: [1, 2, -129, -129], WeapCount: [1, 1, 0, 0], AmmoLoad: [10, 10, 0, 0], ShieldRe: 1 });
  weap(0, {});
  weap(1, { Guidance: 1, AmmoType: 1 });
  weap(2, { Guidance: 99, AmmoType: 0 });
  ship(3, { WeapType: [3, -129, -129, -129] });
  weap(3, { Inaccuracy: 5 });
  govt(0, { Enemy: 1 });
  govt(1, {});
  govt(2, { Ally: 0 });
  govt(3, { Flags: 0x1 });
  return D;
}
const put = (w, i, govt, x, y, facing) => S.elderPlaceShip(w, w.D.ships[i], govt, x, y, 3, facing);

for (const evo of [false, true]) {
  const D = made(evo), g = evo ? 'In Override' : 'In Escape Velocity', w = S.elderWorld(D, 7);
  const a = put(w, 0, 0, 0, 0, 0), b = put(w, 1, 1, 5000, 0, 0);
  a.skill = 1; b.skill = 1;
  const hit = (v, sa, mass, energy, noKill) => { v.sa = sa; S.elderDamage(w, v, 0, 0, 0, mass, energy, null, false, false, !!noKill, false); return v.sa; };
  // a shield loses the energy damage and a quarter of the mass damage
  is(`${g} a shield of 100 after mass 20 and energy 40`, hit(a, 100, 20, 40), 55);
  // Escape Velocity removes no less than the greater damage, Override no less than 1
  is(`${g} a shield of 100 after mass 40`, hit(a, 100, 40, 0), evo ? 90 : 60);
  is(`${g} a shield of 100 after mass 2`, hit(a, 100, 2, 0), evo ? 99 : 98);
  // armor loses the mass damage and a quarter of the energy damage
  is(`${g} an armor with 10 gone after mass 8 and energy 8`, hit(a, -10, 8, 8), -20);
  // disabled with over a third of an armor of 50 gone, and in Override over nine tenths for flag 0x0010
  a.sa = -16; yes(`${g} a ship with 16 of 50 armor gone is disabled`, !S.elderDisabled(a));
  a.sa = -17; yes(`${g} a ship with 17 of 50 armor gone is not disabled`, S.elderDisabled(a));
  b.sa = -45; yes(`${g} a flag 0x0010 ship with 45 of 50 armor gone is ${evo ? '' : 'not '}disabled`, S.elderDisabled(b) === !evo);
  b.sa = -46; yes(`${g} a flag 0x0010 ship with 46 of 50 armor gone is not disabled`, S.elderDisabled(b));
  a.dying = 0; a.sa = -50; yes(`${g} a ship with all 50 armor gone and no more is dead`, !S.elderDead(a));
  a.sa = -51; yes(`${g} a ship with 51 of 50 armor gone is not dead`, S.elderDead(a));
  // a shot that may not kill leaves 0.4 of the armor, and 0.15 of a flag 0x0010 class's in Override
  is(`${g} a shield of 10 after mass 100 that may not kill`, hit(a, 10, 100, 0, true), evo ? -15 : -30);
  is(`${g} an armor with 10 gone after mass 100 that may not kill`, hit(a, -10, 100, 0, true), -30);
  is(`${g} an armor with 40 gone after mass 100 that may not kill`, hit(a, -40, 100, 0, true), -40);
  is(`${g} a flag 0x0010 ship's armor with 10 gone after mass 100 that may not kill`, hit(b, -10, 100, 0, true), evo ? -42 : -30);
  a.sa = 100; b.sa = 100;
  is(`${g} the top speed of a Speed of 3`, S.elderTopSpeed(a), evo ? 3 : 3.75);
  is(`${g} the acceleration of an Accel of 0.5`, S.elderAccel(a), 1);
  a.held = true;
  is(`${g} the top speed in a tractor beam`, S.elderTopSpeed(a), (evo ? 3 : 3.75) * 0.333);
  is(`${g} the acceleration in a tractor beam`, S.elderAccel(a), evo ? 0.5 * 0.333 : 1);
  is(`${g} the turn of a Maneuver of 5 in a tractor beam`, S.elderTurnRate(a), 1);
  a.held = false;
  is(`${g} the frames between a shield's gains with a ShieldRe of 10`, S.elderShieldTicks(a), 6);
  is(`${g} the frames between a shield's gains with a ShieldRe of 1`, S.elderShieldTicks(put(w, 2, 2, -5000, 0, 0)), 1);
  // headings clockwise from up, with y down
  for (const [x, y, h] of [[0, -10, 0], [10, 0, 90], [0, 10, 180], [-10, 0, 270], [10, -20, 26], [20, -10, 64], [-10, 20, 206]]) is(`${g} the heading to (${x}, ${y})`, S.elderAngle(0, 0, x, y), h);
  // a turn of the Maneuver a frame, the short way
  a.wait = 0; a.heading = 0; a.want = 90; a.thrust = 0; a.firing = false; S.elderStepShip(w, a); is(`${g} the heading after a frame's turn from 0 toward 90`, a.heading, 5);
  a.heading = 0; a.want = 3; S.elderStepShip(w, a); is(`${g} the heading after a frame's turn from 0 toward 3`, a.heading, 3);
  a.heading = 0; a.want = 300; S.elderStepShip(w, a); is(`${g} the heading after a frame's turn from 0 toward 300`, a.heading, 355);
  // governments: 0 has 1 as its enemy, 2 is 0's ally, 3 has flag 0x0001
  for (const [p, q, want] of [[0, 1, true], [1, 0, true], [2, 1, true], [1, 2, false], [0, 3, true], [3, 0, false], [0, 2, false], [0, 0, false], [-1, 1, false]])
    yes(`${g} government ${p} ${want ? 'attacks' : 'does not attack'} government ${q}`, S.elderGovtHostile(D, p, q) === want);
  // a new ship has 1.75 of its class's ammunition, and a bay's fighters as the class has them
  const c = w.slots[3];
  is(`${g} the ammunition of an AmmoLoad of 10`, c.weap[1].ammo, 17);
  is(`${g} the fighters of an AmmoLoad of 10`, c.weap[2].ammo, 10);
  // a new shot: 1.75 of the Count in frames at the weapon's Speed, and in Override 1.5 with the ship's velocity added
  a.heading = 90; a.vx = 2; a.vy = 0; a.target = -1;
  yes(`${g} a shot is fired`, S.elderFireShot(w, a, 0));
  const sh = w.shots.find(q => q.life > 0);
  is(`${g} a shot's life with a Count of 20`, sh.life, evo ? 30 : 35);
  is(`${g} a shot's speed across`, sh.vx, evo ? 12 : 10);
  is(`${g} a shot's speed down`, sh.vy, 0);
}

/* ---- 2. fights between the made ships ------------------------------------------- */

function fight(D, govts, seed, frames) {
  const w = S.elderWorld(D, seed);
  const a = put(w, 3, govts[0], -300, 0, 90), b = put(w, 3, govts[1], 300, 0, 270);
  let shots = 0, where = 0;
  for (let f = 0; f < frames; f++) { S.elderStep(w); for (const q of w.shots) if (q.life > 0) { shots++; where += q.x + q.y; } }
  return { w, a, b, shots, text: JSON.stringify([a.x, a.y, a.sa, b.x, b.y, b.sa, w.gone.length, where]) };
}
for (const evo of [false, true]) {
  const g = evo ? 'In Override' : 'In Escape Velocity';
  const foes = fight(made(evo), [0, 1], 11, 900), kin = fight(made(evo), [0, 0], 11, 900);
  yes(`${g} two enemies fire at each other (${foes.shots} shot frames)`, foes.shots > 0);
  yes(`${g} two enemies hurt each other (${foes.a.sa}, ${foes.b.sa})`, foes.a.sa < 100 || foes.b.sa < 100 || foes.w.gone.length > 0);
  yes(`${g} two ships of one government fire nothing (${kin.shots} shot frames)`, kin.shots === 0);
  yes(`${g} two ships of one government are unhurt (${kin.a.sa}, ${kin.b.sa})`, kin.a.sa === 100 && kin.b.sa === 100 && !kin.w.gone.length);
  yes(`${g} a fight run twice from one seed comes out the same`, fight(made(evo), [0, 1], 11, 900).text === foes.text);
  yes(`${g} a fight from another seed comes out otherwise`, fight(made(evo), [0, 1], 12, 900).text !== foes.text);
}
console.log(`${sums} sums and made fights${fails ? '' : ', each as worked by hand'}`);

/* ---- 3. the games' ships -------------------------------------------------------- */

const INST = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Installers');
const GAMES = [{ file: 'Escape_Velocity.bin', kind: 'ev' }, { file: 'EVOverride.bin', kind: 'evo' }];
if (!GAMES.every(g => fs.existsSync(path.join(INST, g.file)))) console.log('SKIP the games\' ships. The EV and EV Override installers are not in reference/');
else for (const g of GAMES) {
  const game = S.novaGame();
  for (const f of S.novaArchiveFiles(S.novaArchiveIn(new Uint8Array(fs.readFileSync(path.join(INST, g.file)))))) game.add(f, f.read());
  const D = S.elderFightData(game);
  // the loader's sums on every ship and weapon
  let n = 0;
  for (const c of D.ships) {
    if (!c) continue;
    n++;
    const r = c.rec, what = `${g.kind} shïp ${c.id}`;
    if (c.Accel !== r.Accel / 10000 || c.Speed !== r.Speed / 100) fail(`${what} has Accel ${c.Accel} and Speed ${c.Speed} from ${r.Accel} and ${r.Speed}`);
    if (c.Shield !== (r.Shield < 0 ? -5 * r.Shield : r.Shield || 1)) fail(`${what} has Shield ${c.Shield} from ${r.Shield}`);
    if (c.WeapType.some((t, i) => t !== r.WeapType[i] - 128)) fail(`${what} has weapons ${c.WeapType} from ${r.WeapType}`);
    if (D.evo && !(c.SkillVar >= 1 && c.SkillVar <= 50)) fail(`${what} has SkillVar ${c.SkillVar}`);
  }
  for (const wp of D.weaps) {
    if (!wp) continue;
    const what = `${g.kind} wëap ${wp.id}`;
    if (wp.Speed !== wp.rec.Speed / 100) fail(`${what} has Speed ${wp.Speed} from ${wp.rec.Speed}`);
    if (D.evo && wp.rec.Guidance === 2 && !(wp.Guidance === 1 && wp.Seeker === 0x30fe)) fail(`${what} of Guidance 2 reads as ${wp.Guidance} with Seeker ${wp.Seeker}`);
    if (!D.evo && wp.Guidance !== wp.rec.Guidance) fail(`${what} has Guidance ${wp.Guidance} from ${wp.rec.Guidance}`);
  }
  // two governments that attack each other, first by number
  let sides = null;
  for (const a of D.govts) for (const b of D.govts) if (!sides && a && b && a.index < b.index && !(D.evo && (a.Flags | b.Flags) & 0x800) && S.elderGovtHostile(D, a.index, b.index) && S.elderGovtHostile(D, b.index, a.index)) sides = [a.index, b.index];
  if (!sides) { fail(`${g.kind} has no two governments that attack each other`); continue; }
  const armed = [...D.classes.values()].filter(c => !c.missing && c.cls.InherentAI >= 3 && c.cls.Speed > 0 && c.cls.WeapType.some((t, i) => c.cls.WeapCount[i] > 0 && D.weaps[t] && (D.weaps[t].MassDmg > 0 || D.weaps[t].EnergyDmg > 0 || D.weaps[t].Guidance === 99)));
  if (armed.length < 4) fail(`${g.kind} has ${armed.length} classes that fight`);
  const gen = S.novaRandom(g.kind === 'ev' ? 101 : 202);
  let frames = 0, destroyed = 0, disabled = 0, fired = 0, beams = 0;
  for (let run = 0; run < 8 && fails < 20; run++) {
    const w = S.elderWorld(D, 1000 + run);
    for (let k = 0; k < 12; k++) S.elderPlaceShip(w, armed[gen.rand(armed.length)], sides[k % 2], (k % 2 ? 400 : -400) + gen.rand(200), gen.rand(800) - 400, 0, k % 2 ? 270 : 90);
    const num = v => typeof v === 'number' && Number.isFinite(v);
    for (let f = 0; f < 2400 && fails < 20; f++) {
      const before = new Map(w.ships.map(s => [s, Math.max(Math.abs(s.vx), Math.abs(s.vy))])), at = `${g.kind} run ${run} frame ${f} has`;
      S.elderStep(w);
      frames++;
      if (w.ships.length > 35 || w.slots[0]) fail(`${at} ${w.ships.length} ships and slot 0 ${w.slots[0] ? 'full' : 'empty'}`);
      if (w.shots.length !== 128 || w.beams.length !== 8 || w.booms.length > 16) fail(`${at} ${w.shots.length} shots, ${w.beams.length} beams and ${w.booms.length} explosions`);
      for (const s of w.ships) {
        if (![s.x, s.y, s.vx, s.vy, s.heading, s.sa, s.fuel].every(num)) { fail(`${at} a ${s.cls.name} with a number that is none, ${JSON.stringify([s.x, s.y, s.vx, s.vy, s.heading, s.sa, s.fuel])}`); break; }
        if (!(s.heading >= 0 && s.heading < 360)) fail(`${at} a ${s.cls.name} heading ${s.heading}`);
        if (s.sa > 1.01 * s.c.Shield) fail(`${at} a ${s.cls.name} with a shield of ${s.sa} over ${s.c.Shield}`);
        // Override's pass flies at 2.75 of the Accel up to 1.8 of the speed
        const top = (D.evo ? 1.8 : 1) * S.elderTopSpeed(s) + 2.75 * S.elderAccel(s) + 1e-6, now = Math.max(Math.abs(s.vx), Math.abs(s.vy));
        if (before.has(s) && !s.held && now > top && now > before.get(s) + 1e-9) fail(`${at} a ${s.cls.name} gaining speed to ${s.vx}, ${s.vy} with a top speed of ${S.elderTopSpeed(s)}`);
      }
      for (const sh of w.shots) if (sh.life > 0) { fired++; if (![sh.x, sh.y, sh.vx, sh.vy, sh.angle].every(num)) { fail(`${at} a shot of ${sh.wp.name} with a number that is none`); break; } }
      for (const b of w.beams) if (b.shown) beams++;
    }
    destroyed += w.gone.filter(x => x.how === 'destroyed').length;
    disabled += w.ships.filter(s => s.disabled).length;
  }
  if (!destroyed && !disabled) fail(`${g.kind} has no ship destroyed or disabled in ${frames} frames of fights`);
  if (!fired) fail(`${g.kind} has no shot in ${frames} frames of fights`);
  console.log(`${g.kind} has ${n} ship classes and ${D.weaps.filter(Boolean).length} weapons through the loader. ${frames} frames of fights between ${D.govts[sides[0]].name} and ${D.govts[sides[1]].name} have ${destroyed} ships destroyed, ${disabled} left disabled, ${fired} shot frames and ${beams} beam frames`);
}
if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('the older games\' fight is as worked by hand and within its rules');
