// js/nova-universe.js and js/nova-ncb.js: the rules, on examples the Bible
// works through, and then every release in reference/ read through them, with
// what must hold for the map to draw -- every test parses, every link and
// navigation default names a record, every stellar has a sprite that decodes,
// every stellar you can land on has its landing picture, every nebula a
// picture, every gate is in a system and links only to gates in one. The
// figures are printed, not asserted.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

// ---- the rules -------------------------------------------------------------
// The Bible's examples of DefCount, and the two branches of Mac 0x124fb4.
eq('DefCount 1082', S.novaDefense({ DefenseDude: 128, DefCount: 1082 }), { dude: 128, total: 8, wave: 2 });
eq('DefCount 2005', S.novaDefense({ DefenseDude: 128, DefCount: 2005 }), { dude: 128, total: 100, wave: 5 });
eq('DefCount 12345', S.novaDefense({ DefenseDude: 128, DefCount: 12345 }), { dude: 128, total: 234, wave: 5 });
eq('DefCount 1000', S.novaDefense({ DefenseDude: 128, DefCount: 1000 }), { dude: 128, total: 1000, wave: null });
eq('no defence', S.novaDefense({ DefenseDude: -1, DefCount: 5 }), null);
// The Bible's test examples.
const st = bits => ({ bits: new Set(bits) });
eq('b13 & (b15 | !b72)', [st([13]), st([13, 72]), st([13, 15, 72])].map(s => S.ncbTest('b13 & (b15 | !b72)', s)), [true, false, true]);
eq('!(B42 | B53) & b103', [st([103]), st([42, 103])].map(s => S.ncbTest('!(B42 | B53) & b103', s)), [true, false]);
eq('empty test', S.ncbTest('', st([])), true);
eq('mixed flagged', S.ncbParseTest('b1 & b2 | b3').mixed, true);
eq('bits of a test', S.ncbTestBits('!(b147 | b305) | !b148'), [147, 148, 305]);
let threw = false; try { S.ncbParseTest('b1 &'); } catch (e) { threw = true; } eq('a broken test throws', threw, true);
// The Bible's dësc example, and a {G} choice.
const t = 'This is a {b001 "great and terrific" "lousy, terrible"} example.';
eq('dësc bit set', S.novaDescText(t, st([1])), 'This is a great and terrific example.');
eq('dësc bit clear', S.novaDescText(t, st([])), 'This is a lousy, terrible example.');
eq('dësc negated', S.novaDescText('{!b2 "yes"}', st([])), 'yes');
eq('dësc gender', [S.novaDescText('a {G "man" "woman"}', { male: true }), S.novaDescText('a {G "man" "woman"}', {})], ['a man', 'a woman']);
// Mac 0x1b4300: Flags 0x01, and destroyed exactly when Flags 0x80 is set.
eq('can land', [S.novaCanLand({ Flags: 1 }), S.novaCanLand({ Flags: 0x81 }), S.novaCanLand({ Flags: 0x81 }, true), S.novaCanLand({ Flags: 1 }, true), S.novaCanLand({ Flags: 0 })], [true, false, true, false, false]);
// Stellar animation, Mac 1.1.1 HandleStellarSprites (Intel 0x2e6f1): the frame shown after each 30th of a second.
const frames = (spob, count, n, engaged = false, script = [], a = S.novaStellarAnimState()) => {
  const rand = k => { const r = script.length ? script.shift() : 0; if (r >= k) throw new Error(`rand(${k}) scripted ${r}`); return r; };
  const out = [];
  for (let i = 0; i < n; i++) { S.novaStellarAnimStep(spob, a, count, 1, engaged, rand); out.push(a.cur); }
  return out;
};
const sp = (Flags2, AnimDelay, Frame0Bias = 0, CustPicID = 0) => ({ Flags2, AnimDelay, Frame0Bias, CustPicID });
eq('animates', [S.novaStellarAnimates(sp(0)), S.novaStellarAnimates(sp(0), true), S.novaStellarAnimates(sp(0x80)), S.novaStellarAnimates(sp(0x80), true)], [true, false, false, true]);
eq('in turn, AnimDelay 2', frames(sp(0, 2), 4, 10), [0, 0, 0, 1, 1, 2, 2, 3, 3, 0]);
eq('Frame0Bias 3', frames(sp(0, 1, 3), 3, 11), [0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 1]);
eq('first frame between', frames(sp(0x0001, 1), 4, 8), [0, 1, 0, 2, 0, 3, 0, 1]);
eq('at random, never twice', frames(sp(0x0002, 1), 4, 3, false, [0, 2, 2, 1, 3]), [0, 2, 1]);
eq('at random between, never the first', frames(sp(0x0003, 1), 4, 4, false, [0, 2, 3, 2]), [0, 2, 0, 3]);
eq('gate split', [S.novaGateTransition(sp(0x1000, 1, 0, 2), 6), S.novaGateTransition(sp(0x1000, 1, 0, 5), 6), S.novaGateTransition(sp(0x1000, 1, 0, -1), 6)], [2, 3, 3]);
eq('gate shut with no ship', frames(sp(0x1000, 1), 6, 4), [0, 0, 0, 0]);
const gate = S.novaStellarAnimState();
eq('gate opening and open', frames(sp(0x1000, 1), 6, 7, true, [], gate), [1, 2, 3, 3, 4, 5, 3]);
eq('gate open, the split between', frames(sp(0x1001, 1), 6, 10, true), [1, 2, 3, 3, 4, 3, 5, 3, 4, 3]);
eq('gate closing', frames(sp(0x1000, 1), 6, 6, false, [], gate), [4, 5, 2, 1, 0, 0]);
eq('landing picture',[S.novaLandingPict({ CustPicID: 11004, Type: 22 }), S.novaLandingPict({ CustPicID: -1, Type: 6 }), S.novaLandingPict({ CustPicID: 37, Type: 1 })], [11004, 10006, 10001]);

// ---- every release ---------------------------------------------------------
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v);
  const u = S.novaUniverse(game);
  const problems = [];
  for (const s of u.systems) {
    if (s.test.error) problems.push(`sÿst ${s.id} visibility: ${s.test.error}`);
    for (const l of s.links) if (!u.byId.has(l)) problems.push(`sÿst ${s.id} links to ${l}, which is no system`);
    for (const n of s.rec.Nav) if (n >= 128 && !u.stellars.has(n)) problems.push(`sÿst ${s.id} navigation default ${n} is no stellar`);
  }
  const mixed = u.systems.filter(s => s.test.mixed).length;
  let sprites = 0, pictures = 0, landable = 0, descs = 0;
  const tags = new Map();
  for (const sp of u.stellars.values()) {
    const spin = S.novaGet(game, 'spïn', S.novaStellarSpin(sp));
    if (!spin) { problems.push(`spöb ${sp.id} (${sp.name}): no spïn ${S.novaStellarSpin(sp)}`); continue; }
    const r = game.get('rlëD', spin.SpritesID) || game.get('rlë8', spin.SpritesID);
    if (!r) { problems.push(`spöb ${sp.id} (${sp.name}): no sprite ${spin.SpritesID}`); continue; }
    try { S.novaDecodeRle(r.bytes, 1); sprites++; } catch (e) { problems.push(`spöb ${sp.id} sprite: ${e.message}`); }
    // The program looks for a landing picture only where one can land and
    // the stellar is neither hypergate nor wormhole (Mac 0x125110-0x12512c).
    if ((sp.Flags & 1) && !(sp.Flags2 & 0x3000)) {
      landable++;
      if (game.has('PICT', S.novaLandingPict(sp))) pictures++;
      else problems.push(`spöb ${sp.id} (${sp.name}): no landing PICT ${S.novaLandingPict(sp)}`);
    }
    const d = S.novaGet(game, 'dësc', S.novaStellarDescId(sp));
    if (d) {
      descs++;
      for (const m of d.Description.matchAll(/\{[^}]*\}/g)) {
        const k = /^\{\s*!?\s*[bB]\d+\s*"/.test(m[0]) ? 'b' : /^\{\s*[Gg]\s*"/.test(m[0]) ? 'G' : m[0];
        tags.set(k, (tags.get(k) || 0) + 1);
      }
    }
  }
  const odd = [...tags.keys()].filter(k => k !== 'b' && k !== 'G');
  if (odd.length) problems.push(`stellar descriptions hold choices the page does not make: ${odd.slice(0, 4).join(' ')}`);
  for (const n of u.nebulae) if (!n.picts.some(p => game.has('PICT', p.id))) problems.push(`nëbu ${n.id} has no picture`);
  // Every gate is in a system, and every stellar a gate's HyperLink names is a gate in a system.
  for (const sp of u.stellars.values()) {
    if (!S.novaGateKind(sp)) continue;
    if (!(u.inSystems.get(sp.id) || []).length) problems.push(`gate spöb ${sp.id} (${sp.name}) is in no system`);
    for (const t of S.novaGateTargets(sp)) {
      const to = u.stellars.get(t);
      if (!to || !S.novaGateKind(to) || !(u.inSystems.get(t) || []).length) problems.push(`gate spöb ${sp.id} (${sp.name}) links to ${t}, which is no gate in a system`);
    }
  }
  if (problems.length) fail(`${v}: ${problems.length} problems: ${problems.slice(0, 6).join('; ')}`);
  const shown = S.novaShownSystems(u, { bits: new Set() });
  const links = S.novaShownLinks(u, shown);
  const places = new Set(u.systems.map(s => s.x + ',' + s.y));
  const gates = S.novaShownGates(u, shown), every = S.novaShownGates(u, S.novaShownSystems(u, null));
  console.log(`${v}: ${u.systems.length} systems at ${places.size} places, ${shown.size} shown at a new game with ${links.length} links` +
              ` (${links.filter(l => l.oneWay).length} one way); ${u.stellars.size} stellars, ${sprites} sprites decoded,` +
              ` ${pictures} of ${landable} landing pictures, ${descs} descriptions; ${u.nebulae.length} nebulae;` +
              ` ${mixed} tests mix & and |; ${[...u.stellars.values()].filter(S.novaCanHail).length} stellars can be hailed;` +
              ` ${S.novaPlanetWeapons(game).length} planet-type weapons; at a new game ${gates.links.length} ways by gate` +
              ` (${gates.links.filter(l => l.oneWay).length} one way), ${gates.random.length} random wormholes, ${gates.dead.length} gates leading nowhere,` +
              ` with every version ${every.links.length} (${every.links.filter(l => l.oneWay).length}), ${every.random.length} and ${every.dead.length}`);
}
process.exit(fails ? 1 : 0);
