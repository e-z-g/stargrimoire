// js/nova-universe.js and js/nova-ncb.js: the rules, on examples the Bible
// works through, and then every release in reference/ read through them, with
// what must hold for the map to draw -- every test parses, every link and
// navigation default names a record, every stellar has a sprite that decodes,
// every stellar you can land on has its landing picture, every nebula a
// picture, every gate is in a system and links only to gates in one. The
// figures are printed, not asserted.
import fs from 'node:fs';
import path from 'node:path';
import { site, openRelease, haveRelease, RELEASES, REF } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const eq = (what, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };

// ---- the rules -------------------------------------------------------------
// The Viper race (DoRaceDialog): a draw of the last winner drawn again until neither it nor the colour bet on;
// four times the bet; over many races a bet on the last winner never wins and any other wins about one in four.
{
  const seq = a => { let i = 0; return () => a[i++]; };
  const r1 = { credits: 5000, last: -1 }, o1 = S.novaRaceRun(r1, 2, 1000, seq([2]));
  const r2 = { credits: 5000, last: 2 }, o2 = S.novaRaceRun(r2, 1, 1000, seq([2, 1, 2, 3]));
  eq('the Viper race: a first race won, then the last winner and the colour bet on drawn again', [o1, r1.credits, o2, r2.credits, r2.last], [{ winner: 2, won: 4000 }, 8000, { winner: 3, won: 0 }, 4000, 3]);
  const rng = S.novaRandom(12345), race = { credits: 1e9, last: -1 };
  let onLast = 0, onLastWins = 0, other = 0, otherWins = 0;
  for (let i = 0; i < 20000; i++) {
    const last = race.last, c = i % 4, o = S.novaRaceRun(race, c, 1, n => rng.rand(n));
    if (last === c) { onLast++; if (o.won) onLastWins++; } else { other++; if (o.won) otherWins++; }
  }
  if (onLastWins || Math.abs(otherWins / other - 0.25) > 0.02) fail(`the Viper race's odds: ${onLastWins} of ${onLast} on the last winner won, ${otherWins} of ${other} on another`);
}
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
// The game's reading (ncbRead, Mac 1.1.1 EvalTestExp 0x15cd4): evnova-decomp's two examples of the
// Windows evaluator (docs/known_original_bugs.md), then cases worked by hand from the Mac code.
const gameReads = [
  ['b1 | b2 | b3', [1], false], ['b1 & b2 & b3', [2, 3], true],
  ['(b1 & b2) & b3', [2, 3], false], ['(b1 & b2 & b3)', [2, 3], true], ['b1 & (b2) & (b3)', [2, 3], false],
  ['b1 & b2 | b3', [2], true], ['b1 & b2 | b3', [1], false], ['b1 & (b2 | b3)', [1, 3], true],
  [' b1', [1], false], ['612', [], false], ['b611 & 612', [611], true], ['b611 & 612', [], false], ['!!b1', [1], false], ['b1 x', [1], true],
  // a count and a comparison; inside brackets the game reads on from the ]
  ['[b1 b2 b3] > 1', [1, 2], false], ['([b1 b2 b3] > 1)', [1, 2], false], ['([b1 b2 b3] < 2)', [1, 2], true],
];
for (const [t, bits, want] of gameReads) eq(`the game reads "${t}" with ${bits.join(',') || 'no bits'}`, S.ncbTest(t, st(bits)), want);
eq('the game\'s readings as text', ['b1 & b2 & b3', 'b1 & b2 | b3', '(b1 & b2) | b3', '!!b1', '612', '!(b511 | b515) & !((b50 | 467) | b6666)', '!((b6029 | b6030) | b333( & (b6005 | b6012)']
  .map(t => S.ncbTreeText(S.ncbGameTree(t))), ['b2 & b3', 'b2 | b3', '(b1 & b2) | b3', '!b1', 'never', '!(b511 | b515) & !(b50 | b6666)', '!b333']);
eq('a count has no tree', S.ncbGameTree('([b1 b2] = 2)'), null);
// nova-refs.js: outfits given and taken by a set expression (EvalSetExp's G and D), contribute bits by number.
eq('outfits in a set expression', S.novaSetOutfits('b5 G128 d129 R(G130 b2) G700 Q128'), [{ op: 'give', id: 128, random: false }, { op: 'take', id: 129, random: false }, { op: 'give', id: 130, random: true }]);
eq('contribute bits', S.novaMaskBits([0x80000001, 0x00000002]), [0, 31, 62]);
eq('as written', ['b13 & (b15 | !b72)', 'b1 & b2 & b3', '467 | b1'].map(t => S.ncbAsWritten(t).same), [true, false, false]);
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

// Wormholes in 1.0.10 (Mac 0x192a10), with every system shown but those named.
if (haveRelease('1.0.10')) {
  const g = openRelease(S, '1.0.10'), u = S.novaUniverse(g), all = S.novaShownSystems(u, null);
  const at = (shown, id) => S.novaStellarSystem(u, id, shown);
  const newGame = S.novaShownSystems(u, { bits: new Set() });
  const randoms = [...u.stellars.values()].filter(S.novaRandomWormhole).filter(sp => at(newGame, sp.id) && at(newGame, sp.id).id !== 130);
  // Sol's (465) has no HyperLink: the n-th of the others, in stellar order
  const trip = S.novaWormholeTrip(u, newGame, u.stellars.get(465), u.byId.get(130), n => { eq('Sol\'s wormhole picks among', n, randoms.length); return 3; });
  eq('Sol\'s wormhole at a new game', trip.to && [trip.to.spob.id, trip.to.sys.id], [randoms[3].id, at(newGame, randoms[3].id).id]);
  // "Link" in S7evyn (514) names Obatta's (468), in Obatta (155)
  const s7 = at(all, 514), link = S.novaWormholeTrip(u, all, u.stellars.get(514), s7, () => 0);
  eq('Link to Obatta', link.to && [link.to.spob.id, link.to.sys.id], [468, 155]);
  // wormhole 466 is Spica's, so from K-005, which lists it too, it refuses
  const k005 = [...u.byId.values()].find(s => s.name === 'K-005' && s.stellars.includes(466));
  eq('466 from K-005', k005 && !!S.novaWormholeTrip(u, all, u.stellars.get(466), k005, () => 0).refused, true);
  // with no shown system listing a random wormhole but Sol's, nowhere to go
  const others = new Set([...u.stellars.values()].filter(S.novaRandomWormhole).map(sp => sp.id).filter(id => id !== 465));
  const alone = new Set([...newGame].filter(id => !u.byId.get(id).stellars.some(t => others.has(t))));
  eq('Sol\'s wormhole alone', !!S.novaWormholeTrip(u, alone, u.stellars.get(465), u.byId.get(130), () => 0).refused, true);
  // Hypergates (Mac 1.1.1 PlayerEnterHypergate): HG-Kania's links, each system once by its first slot; with
  // Koria's other version (533) shown, the link to HG-Koria arrives there; HG-Vega is offline
  const pick = (shown, gate, sys) => { const r = S.novaHypergateChoices(u, shown, u.stellars.get(gate), u.byId.get(sys)); return r.choices ? r.choices.map(c => [c.sys.id, c.spob.id]) : r; };
  eq('HG-Kania at a new game', pick(newGame, 1404, 128), [[129, 1405], [298, 1413], [483, 1418]]);
  const koria533 = new Set([...newGame].filter(id => id !== 483).concat([533]));
  eq('HG-Kania with Koria 533', pick(koria533, 1404, 128), [[129, 1405], [298, 1413], [533, 1418]]);
  eq('HG-Vega', pick(newGame, 131, 137), { refused: true });
  eq('HG-Kania from Tichel', pick(newGame, 1404, 129), { refused: true });
}
// A link to a gate no shown system lists arrives in the version shown at the place of the first system
// that lists it (Mac 0x1b4820, 0x1b16b0); no shipped link needs it, so a made-up galaxy of two places.
{
  const a = { id: 10, name: 'A', versions: [] }, b1 = { id: 20, name: 'B', versions: [] }, b2 = { id: 21, name: 'B2', versions: [] };
  b1.versions = [b1, b2]; b2.versions = [b1, b2]; a.versions = [a];
  const g1 = { id: 500, Flags: 1, Flags2: 0x1000, HyperLink: [501, -1, -1, -1, -1, -1, -1, -1] }, g2 = { id: 501, Flags: 1, Flags2: 0x1000, HyperLink: [500] };
  const u = { stellars: new Map([[500, g1], [501, g2]]), inSystems: new Map([[500, [10]], [501, [20]]]), byId: new Map([[10, a], [20, b1], [21, b2]]) };
  const r = S.novaHypergateChoices(u, new Set([10, 21]), g1, a);
  eq('a link into a hidden version', r.choices && r.choices.map(c => c.sys.id), [21]);
}

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
  // every test: the game's reading as a tree agrees with ncbTest in every state of its bits; those read otherwise than written
  const otherwise = [];
  for (const [type, , fields] of S.NOVA_BIT_SOURCES) for (const rec of S.novaAll(game, type)) for (const [field, how] of fields) {
    const text = rec[field];
    if (how !== 'test' || !text) continue;
    if (S.ncbAsWritten(text).same !== true) otherwise.push(`${type} ${rec.id} ${field}`);
    const tree = S.ncbGameTree(text), bits = [...new Set([...text.matchAll(/[Bb](\d+)/g)].map(m => +m[1]))];
    if (!tree || bits.length > 14) { fail(`${v} ${type} ${rec.id} ${field}: no game tree to hold to the game's reading`); continue; }
    for (let m = 0; m < 1 << bits.length; m++) {
      const state = st(bits.filter((b, i) => m >> i & 1));
      if (S.ncbEval(tree, state) !== S.ncbTest(text, state)) { fail(`${v} ${type} ${rec.id} ${field}: the game tree ${S.ncbTreeText(tree)} and the game's reading differ`); break; }
    }
  }
  // every record with a panel of its own followed to what names it: an outfit sold only at outfitters of its tech
  // level, a weapon fired only by outfits of ModType 1 naming it, every system named one there is
  const refs = S.novaRefs(game, u), refProblems = [];
  let soldSomewhere = 0;
  for (const [type] of S.NOVA_REC_TYPES) for (const rec of S.novaAll(game, type)) {
    const r = refs.of(type, rec.id);
    if (type === 'oütf') {
      if (r.soldAt.length) soldSomewhere++;
      for (const id of r.soldAt) { const sp = u.stellars.get(id), sp8 = [...sp.SpecialTech, ...(sp.SpecialTech4to8 || [])];
        if (!(sp.Flags & 0x04) || !(rec.TechLevel <= sp.TechLevel || sp8.includes(rec.TechLevel)) || rec.TechLevel < 0) refProblems.push(`oütf ${rec.id} sold at spöb ${id}`); }
    }
    if (type === 'wëap') for (const o of r.firedBy) { const out = S.novaGet(game, 'oütf', o); if (![1, 2, 3, 4].some(k => out[k === 1 ? 'ModType' : 'ModType' + k] === 1 && out[k === 1 ? 'ModVal' : 'ModVal' + k] === rec.id)) refProblems.push(`wëap ${rec.id} fired by oütf ${o}`); }
    for (const list of [r.linked, r.reinforces, r.systems && r.systems.map(x => x.id ?? x)]) for (const id of list || []) if (!u.byId.has(id)) refProblems.push(`${type} ${rec.id} names sÿst ${id}`);
  }
  if (refProblems.length) fail(`${v}: cross-references: ${refProblems.length}: ${refProblems.slice(0, 5).join('; ')}`);
  const shown = S.novaShownSystems(u, { bits: new Set() });
  const links = S.novaShownLinks(u, shown);
  const places = new Set(u.systems.map(s => s.x + ',' + s.y));
  const gates = S.novaShownGates(u, shown), every = S.novaShownGates(u, S.novaShownSystems(u, null));
  console.log(`${v}: ${u.systems.length} systems at ${places.size} places, ${shown.size} shown at a new game with ${links.length} links` +
              ` (${links.filter(l => l.oneWay).length} one way); ${u.stellars.size} stellars, ${sprites} sprites decoded,` +
              ` ${pictures} of ${landable} landing pictures, ${descs} descriptions; ${u.nebulae.length} nebulae;` +
              ` ${mixed} tests mix & and |; outfits sold somewhere ${soldSomewhere} of ${S.novaAll(game, 'oütf').length}; ${otherwise.length} tests the game reads otherwise than written${otherwise.length ? ` (${otherwise.join(', ')})` : ''}; ${[...u.stellars.values()].filter(S.novaCanHail).length} stellars can be hailed;` +
              ` ${S.novaPlanetWeapons(game).length} planet-type weapons; at a new game ${gates.links.length} ways by gate` +
              ` (${gates.links.filter(l => l.oneWay).length} one way), ${gates.random.length} random wormholes, ${gates.dead.length} gates leading nowhere,` +
              ` with every version ${every.links.length} (${every.links.filter(l => l.oneWay).length}), ${every.random.length} and ${every.dead.length}`);
}

// A total conversion in a zip of MacBinary copies, named as it likes:
// Starfleet Adventures alpha 0.50 from the plug-in collection.
const SFA = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Extras/Starfleet Adventures/starfleetalpha050.zip');
if (!fs.existsSync(SFA)) console.log('SKIP Starfleet Adventures: not in reference/');
else {
  const files = S.novaArchiveFiles(new Uint8Array(fs.readFileSync(SFA)));
  const data = files.filter(f => f.role === 'data' && !f.plugin), plugins = files.filter(f => f.plugin);
  const game = S.novaGame();
  for (const f of data) game.add(f, f.read());
  const u = S.novaUniverse(game);
  if (data.length !== 19 || plugins.length !== 4 || u.systems.length < 1000) fail(`Starfleet Adventures' zip: ${data.length} data files, ${plugins.length} plug-ins, ${u.systems.length} systems`);
  console.log(`Starfleet Adventures' zip of MacBinary copies: ${files.length} files, ${data.length} of them data, ${plugins.length} plug-ins; ${u.systems.length} systems`);
}
// And one in Mac form: 1.0.10 with every file in its Nova Files renamed, so
// that only its Mac type says which part of the game it is.
if (haveRelease('1.0.10')) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(REF, RELEASES['1.0.10'].sit)));
  const roles = fs => fs.filter(f => !f.plugin).map(f => f.role).sort().join(' ');
  const want = roles(S.novaArchiveFiles(bytes)), parse = S.parseStuffItArchive;
  S.parseStuffItArchive = b => { const c = parse(b); for (const e of Array.isArray(c) ? c : c.entries) if (/Nova Files\//.test(e.path || '')) e.name = e.name.replace(/^Nova (Data|Graphics|Titles|Ships|Sounds)/, 'TC Part'); return c; };
  const got = roles(S.novaArchiveFiles(bytes));
  S.parseStuffItArchive = parse;
  if (got !== want) fail(`1.0.10 renamed: the parts ${got}, expected ${want}`);
  else console.log(`1.0.10 with its Nova Files renamed: each file the same part by its Mac type`);
}
process.exit(fails ? 1 : 0);
