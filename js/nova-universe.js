/* nova-universe.js -- the galaxy as the map shows it: systems, the links
   between them, nebulae, and the stellars in each system.
   =========================================================================

   Built from the records (nova-records.js) and nothing else. Every rule
   below is the Bible's unless it names an address in the program; those
   were read from the Mac 1.0.10 build's PowerPC code, laid out as
   evnova-workbench's tools/pefreloc_nova.py lays it out (code at 0x100000).

   SYSTEMS AND VISIBILITY. A sÿst's Visibility is a control-bit test; a
   system whose test fails is not on the map. Two systems at exactly the
   same coordinates are versions of one place, and a hyperspace link to a
   hidden one goes to whichever version is shown there ("that's how Nova
   knows to update the hyper links", the Bible's sÿst section). 271 of the
   545 systems in 1.1.1 have a test, and 128 places have more than one.

   STELLARS belong to a system by being one of its sixteen navigation
   defaults; the Bible says one that is not "won't show up on the radar".
   A stellar's picture is spïn 1000 + its Type. When landed, the game shows
   PICT CustPicID when that is 128 or more, and otherwise PICT 10000 + Type:
   Mac 0x1353d0 loads CustPicID, compares it with 128 and adds 10000 to the
   Type in the other branch (the copy from the resource into memory at
   0x124b00 is what says which memory field is which).

   DEFENCE FLEETS. DefCount above 1000 means waves; the program keeps the
   total as DefCount / 10 - 100, or DefCount / 10 - 1000 above 10000
   (0x124fb4), which is the Bible's "minus 1 from the first digit". The
   wave size, the last digit, is the Bible's.

   NEBULAE. nëbu n (from 128) owns PICT 9500 + 7(n - 128) and the six after,
   one for each of the map's seven scales, smallest first. The game picks
   the one made for the scale it is drawing and stretches it to the nëbu's
   rectangle, which is in map units at 100%.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-files.js,
   nova-records.js and nova-ncb.js. */

const NOVA_MAP_SCALES = [0.421, 0.562, 0.75, 1.0, 1.333, 1.777, 2.37];

/* The six commodities the Flags long prices, in the Bible's order, each a
   nibble of Low 1, Medium 2, High 4, not traded 0. */
const NOVA_COMMODITY_SHIFTS = [28, 24, 20, 16, 12, 8];
const NOVA_PRICE_WORDS = { 0: null, 1: 'Low', 2: 'Medium', 4: 'High' };

const NOVA_SPOB_FLAGS = [
  [0x01, 'Can land or dock'], [0x02, 'Commodity exchange'], [0x04, 'Outfitter'],
  [0x08, 'Shipyard'], [0x10, 'Station'], [0x20, 'Uninhabited'], [0x40, 'Bar'],
  [0x80, 'Can land only when destroyed'],
];
const NOVA_SPOB_FLAGS2 = [
  [0x0001, 'Shows its first frame between frames'], [0x0002, 'Picks frames at random'],
  [0x0010, 'Loops its sound'], [0x0020, 'Always dominated'], [0x0040, 'Starts destroyed'],
  [0x0080, 'Animates only when destroyed'], [0x0100, 'Destroys ships that touch it'],
  [0x0200, 'Fires only when provoked'], [0x0400, 'Buys any outfit'],
  [0x1000, 'Hypergate'], [0x2000, 'Wormhole'],
];

function novaUniverse(game) {
  // Names as the game shows them, cut at a semicolon (novaNameParts); what
  // followed is kept as `note`.
  const named = rec => { const p = novaNameParts(rec.name); rec.name = p.name; rec.note = p.note; return rec; };
  const govts = new Map();
  for (const g of novaAll(game, 'gövt')) govts.set(g.id, named(g));

  const stellars = new Map();
  for (const s of novaAll(game, 'spöb')) stellars.set(s.id, named(s));

  const systems = [];
  const byId = new Map();
  for (const r of novaAll(game, 'sÿst')) {
    let test;
    try { test = ncbParseTest(r.Visibility); } catch (e) { test = { tree: { op: 'true' }, mixed: false, error: e.message }; }
    const sys = {
      id: r.id, name: novaNameParts(r.name).name, note: novaNameParts(r.name).note, x: r.xPos, y: r.yPos, govt: r.Govt,
      links: (r.Con || []).filter(c => c >= 128),
      stellars: (r.Nav || []).filter(n => n >= 128 && stellars.has(n)),
      visibility: r.Visibility || '', test, rec: r,
    };
    systems.push(sys);
    byId.set(sys.id, sys);
  }

  const places = new Map();
  for (const s of systems) {
    const k = s.x + ',' + s.y;
    if (!places.has(k)) places.set(k, []);
    places.get(k).push(s);
  }
  for (const s of systems) s.versions = places.get(s.x + ',' + s.y);

  const inSystems = new Map();
  for (const s of systems) for (const n of s.stellars) {
    if (!inSystems.has(n)) inSystems.set(n, []);
    inSystems.get(n).push(s.id);
  }

  const nebulae = novaAll(game, 'nëbu').map(n => {
    const first = 9500 + (n.id - 128) * 7;
    return { id: n.id, name: n.name, x: n.XPos, y: n.YPos, w: n.XSize, h: n.YSize,
             activeOn: n.ActiveOn || '', picts: NOVA_MAP_SCALES.map((sc, i) => ({ id: first + i, scale: sc })), rec: n };
  });

  return { game, systems, byId, stellars, inSystems, govts, nebulae };
}

/* Which systems are on the map for a control-bit state; null for every
   system there is, every version at once. */
function novaShownSystems(u, state) {
  if (state === null) return new Set(u.systems.map(s => s.id));
  const out = new Set();
  for (const s of u.systems) if (ncbEval(s.test.tree, state)) out.add(s.id);
  return out;
}

/* Where a link from one system lands, given what is shown: the system
   itself, or the version shown at its coordinates, or null. */
function novaLinkTarget(u, id, shown) {
  const t = u.byId.get(id);
  if (!t) return null;
  if (shown.has(id)) return t;
  return t.versions.find(v => shown.has(v.id)) || null;
}

/* Every link as a pair of shown systems, once each, with whether it runs
   both ways. */
function novaShownLinks(u, shown) {
  const pairs = new Map();
  for (const s of u.systems) {
    if (!shown.has(s.id)) continue;
    for (const l of s.links) {
      const t = novaLinkTarget(u, l, shown);
      if (!t || t.id === s.id) continue;
      const a = Math.min(s.id, t.id), b = Math.max(s.id, t.id), k = a + ',' + b;
      const p = pairs.get(k) || { a: u.byId.get(a), b: u.byId.get(b), ab: false, ba: false };
      if (s.id === a) p.ab = true; else p.ba = true;
      pairs.set(k, p);
    }
  }
  return [...pairs.values()].map(p => ({ from: p.a, to: p.b, oneWay: !(p.ab && p.ba), forward: p.ab }));
}

/* A system's links as it shows them, resolved through versions. */
function novaSystemLinks(u, sys, shown) {
  const out = [];
  for (const l of sys.links) {
    const t = shown ? novaLinkTarget(u, l, shown) : u.byId.get(l);
    out.push({ id: l, target: t });
  }
  return out;
}

function novaGovtColor(u, id) {
  const g = u.govts.get(id);
  return g ? '#' + (g.Color & 0xFFFFFF).toString(16).padStart(6, '0') : null;
}

/* The nebula picture for a map scale: the id made for the closest scale
   that the game actually has, or null when it has none of the seven. */
function novaNebulaPict(u, neb, scale) {
  let best = null, bestD = Infinity;
  for (const p of neb.picts) {
    if (!u.game.has('PICT', p.id)) continue;
    const d = Math.abs(Math.log(scale / p.scale));
    if (d < bestD) { bestD = d; best = p.id; }
  }
  return best;
}

function novaStellarSpin(spob) { return 1000 + spob.Type; }
function novaLandingPict(spob) { return spob.CustPicID >= 128 ? spob.CustPicID : 10000 + spob.Type; }

/* ANIMATION, read from Mac 1.1.1's HandleStellarSprites (the Intel half,
   0x2e6f1), which has its function names; the Bible's spöb section says
   the same in fewer words, and evnova-decomp's NovaStellar_AdvanceAnimationFrame
   is the Community Edition's. A stellar whose sprite has two frames or more
   animates while it is not destroyed, or, with Flags2 0x0080, only while it
   is. Otherwise it shows its first frame.
     Time is counted in 30ths of a second. Once AnimDelay of them have
   passed, or AnimDelay times Frame0Bias on the first frame when that is
   above 1, the count starts again and the frame moves on. The program
   keeps the frame shown and the one to show next (`cur`, `next`): the next
   becomes the shown one, and a new next is the one after it, or with Flags2
   0x0002 one at random that is not the one now shown. With 0x0001 the first
   frame comes between every two others, and the random pick is never it.
     A hypergate (Flags2 0x1000) has two parts, split at CustPicID when that
   is from 1 to two short of the frame count, and in half otherwise
   (novaGateTransition). It opens through the first part while a ship is near
   it or bound for it (`engaged`) and then loops the second as above, the
   frame at the split standing for the first frame; with no ship near it
   steps back to frame 0. `rand(n)` is a whole number from 0 to n - 1.
   Returns whether the frame shown changed. */
function novaStellarAnimates(spob, destroyed = false) { return destroyed === !!(spob.Flags2 & 0x0080); }
function novaGateTransition(spob, count) {
  const t = spob.CustPicID;
  return t >= 1 && t < count - 1 ? t : Math.trunc(count / 2);
}
function novaStellarAnimState() { return { cur: 0, next: 0, acc: 0 }; }
function novaStellarAnimStep(spob, a, count, ticks, engaged, rand) {
  if (count < 2) { const was = a.cur; a.cur = 0; return was !== 0; }
  const was = a.cur, delay = spob.AnimDelay, bias = spob.Frame0Bias;
  const once = spob.Flags2 & 0x0001, random = spob.Flags2 & 0x0002;
  a.acc += ticks;
  if (!(spob.Flags2 & 0x1000)) {
    if (a.acc < (a.cur === 0 && bias > 1 ? delay * bias : delay)) return false;
    a.acc = 0;
    if (!once) {
      a.cur = a.next;
      if (random) do a.next = rand(count); while (a.next === a.cur);
      else a.next = (a.next + 1) % count;
    } else if (a.cur === 0) {
      a.cur = a.next;
      if (random) do a.next = rand(count); while (a.next === 0 || a.next === a.cur);
      else { a.next = (a.next + 1) % count; if (a.next === 0) a.next = 1; }
    } else a.cur = 0;
    return a.cur !== was;
  }
  const t = novaGateTransition(spob, count);
  if (!engaged) {
    if (a.acc < delay) return false;
    a.acc = 0;
    if (a.cur < t) { if (a.cur > 0) a.cur--; }
    else if (!random && a.cur < count - 1) a.cur++;
    else a.cur = t - 1;
    return a.cur !== was;
  }
  if (a.acc < (a.cur === t && bias > 1 ? delay * bias : delay)) return false;
  a.acc = 0;
  if (a.cur < t) { a.cur++; a.next = a.cur; }
  else if (!once) {
    a.cur = a.next;
    if (random) do a.next = t + rand(count - t); while (a.next === a.cur);
    else { a.next = (a.next + 1) % count; if (a.next < t) a.next = t; }
  } else if (a.cur === t) {
    a.cur = a.next;
    if (random) do a.next = t + rand(count - t); while (a.next === t || a.next === a.cur);
    else { a.next = (a.next + 1) % count; if (a.next <= t) a.next = t + 1; }
  } else a.cur = t;
  return a.cur !== was;
}

/* Descriptions: dësc with the stellar's own id for the spaceport, the Bible's
   128-2175; and 9872 + id for the bar, as ResForge's spöb template has it. */
function novaStellarDescId(spob) { return spob.id; }
function novaStellarBarDescId(spob) { return spob.id + 9872; }

function novaFlagWords(value, table) {
  return table.filter(([bit]) => value & bit).map(([, w]) => w);
}

/* The six commodity prices: [{ index, level }] with level Low, Medium,
   High or null for not traded. */
function novaCommodityPrices(spob) {
  return NOVA_COMMODITY_SHIFTS.map((sh, i) => {
    const v = (spob.Flags >>> sh) & 0xF;
    return { index: i, level: v in NOVA_PRICE_WORDS ? NOVA_PRICE_WORDS[v] : 'value ' + v };
  });
}

/* The defence fleet: { dude, total, wave } or null. */
function novaDefense(spob) {
  if (spob.DefenseDude < 128) return null;
  const v = spob.DefCount;
  if (v <= 1000) return { dude: spob.DefenseDude, total: v, wave: null };
  const total = Math.trunc(v / 10) - (v > 10000 ? 1000 : 100);
  return { dude: spob.DefenseDude, total, wave: v % 10 };
}

/* Whether the player can land on a stellar now (Mac 1.0.10 0x1b4300): it
   has Flags 0x01, and it is destroyed exactly when Flags 0x80 ("can land
   only when destroyed") is set. Destroyed there is a Strength above 0 with
   the stellar's strength run below 0 or its dead time still counting; the
   map shows the game as it starts, when nothing is (no shipped stellar
   starts destroyed, Flags2 0x0040). Landing (0x1932c0) and hailing ask it. */
function novaCanLand(spob, destroyed = false) {
  return !!(spob.Flags & 0x01) && (destroyed ? !!(spob.Flags & 0x80) : !(spob.Flags & 0x80));
}

/* Whether the player can hail a stellar, and so ever ask it for tribute.
   Mac 1.0.10 0x1906b4-0x19070c: a stellar that is uninhabited (Flags 0x20),
   cannot be landed on now (novaCanLand), or is a hypergate or a wormhole
   (Flags2 0x1000, 0x2000) answers "No response." (STR# 2002, 53) and the
   hail window is not opened. The beta history in the Community Edition's
   documentation says the same of gates. */
function novaCanHail(spob) {
  return !(spob.Flags & 0x20) && novaCanLand(spob) && !(spob.Flags2 & 0x3000);
}

/* The system a stellar belongs to (Mac 0x173b40, run whenever visibility
   changes): the first shown system, in id order, whose navigation list
   holds it, or null. A stellar listed by two shown systems is drawn in
   both, but belongs to the first: it can be landed on only there, and a
   ship arriving at it arrives there. */
function novaStellarSystem(u, id, shown) {
  let best = null;
  for (const s of u.inSystems.get(id) || []) if (shown.has(s) && (best === null || s < best)) best = s;
  return best === null ? null : u.byId.get(best);
}

/* HYPERGATES AND WORMHOLES, spöb Flags2 0x1000 and 0x2000, read from the
   Mac 1.0.10 program. Landing (0x1932c0) on one needs what any landing
   needs: novaCanLand, the stellar in the system you are in (by
   novaStellarSystem), its fee if not dominated ("to pay the hypergate
   fee"; no shipped gate has one), the cloak off, and to be near and slow.
   A gate that fails novaCanLand or is not the system's own refuses: "Your
   ship is unable to enter this hypergate - it is offline." or "... this
   wormhole - the radiation levels are too extreme." (STR# 2002, 84-86).
     A hypergate (0x192220) with no HyperLink set does nothing; otherwise
   the player picks a system and the gate goes to the linked stellar whose
   system is it: the stellar's own system, or the first system listing it
   (0x1b4820), as the version shown at that place (0x1b16b0).
     A wormhole (0x192a10) with a HyperLink set goes to one of them at
   random, of those in a shown system. One with none set goes to a random
   one of the wormholes that have none set, belong to a shown system and
   are not in the system you are in; it need not be one that can itself be
   entered. With none to go to, the radiation message. A HyperLink below
   128, 0 or -1, is unset (0x124f7c). */
function novaGateKind(spob) { return spob.Flags2 & 0x2000 ? 'wormhole' : spob.Flags2 & 0x1000 ? 'hypergate' : null; }
function novaGateTargets(spob) { return (spob.HyperLink || []).filter(h => h >= 128); }
function novaRandomWormhole(spob) { return !!(spob.Flags2 & 0x2000) && novaGateTargets(spob).length === 0; }

/* Going through a wormhole from the system you are in, `here`, with the
   systems `shown`, as the program does it: { to: { sys, spob } }, or
   { refused: true } where it gives the radiation message (STR# 2002, 84
   and 86). Landing's checks come first (0x1932c0): the wormhole can be
   landed on (novaCanLand) and is the system's own. Then 0x192a10: one with
   a HyperLink set tries its slots at random until one names a stellar in a
   shown system, which is a pick among those slots, a stellar named twice
   counting twice; one with none set picks among the wormholes with none
   set that belong to a shown system other than `here`, whether or not they
   can themselves be entered. `rand(n)` is a whole number from 0 to n - 1. */
function novaWormholeTrip(u, shown, spob, here, rand) {
  const own = id => novaStellarSystem(u, id, shown), home = own(spob.id);
  if (novaGateKind(spob) !== 'wormhole' || !novaCanLand(spob) || !home || home.id !== here.id) return { refused: true };
  const pool = novaGateTargets(spob).length
    ? (spob.HyperLink || []).filter(t => t >= 128 && u.stellars.has(t) && own(t)).map(t => ({ sys: own(t), spob: u.stellars.get(t) }))
    : [...u.stellars.values()].filter(novaRandomWormhole).map(sp => ({ sys: own(sp.id), spob: sp })).filter(x => x.sys && x.sys.id !== here.id);
  return pool.length ? { to: pool[rand(pool.length)] } : { refused: true };
}

/* The gates on the map for the shown systems: `links`, each pair of shown
   systems once, with its kind (that of the gate it leaves from), whether
   it runs both ways, as novaShownLinks has it, and `gates`, the stellars at
   either end one way it runs; `ways`, the same one way at a time, as
   { from, to, gate, target }, from system to system; `random`, every random wormhole with a shown
   system, as { sys, spob, enter } where enter is whether it can be entered;
   and `dead`, the gates in a shown system's list that lead nowhere from
   it, as { sys, spob, why }: 'offline' (novaCanLand fails), 'elsewhere'
   (it belongs to a system at another place), 'unlinked' (a hypergate with no
   HyperLink) or 'nowhere' (none it names is in a shown system). */
function novaShownGates(u, shown) {
  const own = id => novaStellarSystem(u, id, shown);
  // where a hypergate's or wormhole's link arrives
  const arrive = id => own(id) || (() => {
    const any = (u.inSystems.get(id) || [])[0];
    return any === undefined ? null : novaLinkTarget(u, any, shown);
  })();
  const pairs = new Map(), ways = [], random = [], dead = [];
  for (const sp of u.stellars.values()) {
    const kind = novaGateKind(sp);
    if (!kind) continue;
    const home = own(sp.id);
    // listed by a shown system at another place: drawn there, and of no use there
    for (const s of u.inSystems.get(sp.id) || []) {
      const at = u.byId.get(s);
      if (shown.has(s) && home && (at.x !== home.x || at.y !== home.y)) dead.push({ sys: at, spob: sp, why: 'elsewhere' });
    }
    if (!home) continue;
    if (novaRandomWormhole(sp)) { random.push({ sys: home, spob: sp, enter: novaCanLand(sp) }); continue; }
    if (!novaCanLand(sp)) { dead.push({ sys: home, spob: sp, why: 'offline' }); continue; }
    const to = novaGateTargets(sp).filter(t => u.stellars.has(t)).map(t => ({ t, sys: kind === 'wormhole' ? own(t) : arrive(t) })).filter(x => x.sys);
    if (!to.length) { dead.push({ sys: home, spob: sp, why: novaGateTargets(sp).length ? 'nowhere' : 'unlinked' }); continue; }
    for (const { t, sys: b } of to) {
      const a = home;
      if (a.id === b.id) continue;
      ways.push({ from: a, to: b, gate: sp, target: u.stellars.get(t) });
      const lo = a.id < b.id ? a : b, hi = lo === a ? b : a, k = lo.id + ',' + hi.id;
      const p = pairs.get(k) || { from: lo, to: hi, kind, ab: null, ba: null };
      const g = { from: sp, to: u.stellars.get(t) };
      if (lo === a) p.ab = p.ab || g; else p.ba = p.ba || g;
      pairs.set(k, p);
    }
  }
  const links = [...pairs.values()].map(p => ({ from: p.from, to: p.to, kind: p.kind, oneWay: !(p.ab && p.ba), forward: !!p.ab, gates: p.ab || p.ba }));
  return { links, ways, random, dead };
}

/* What a system's stellars offer, by their spöb Flags (the Bible's table):
   inhabited, a stellar that is neither marked uninhabited (0x20) nor a
   hypergate or wormhole; landing, novaCanLand on a stellar that is not a
   gate, and on one, a commodity exchange (0x02), an outfitter (0x04), a
   shipyard (0x08) and a bar (0x40). */
function novaSystemServices(u, sys) {
  const out = { inhabited: false, land: false, commodity: false, outfit: false, shipyard: false, bar: false };
  for (const id of sys.stellars) {
    const sp = u.stellars.get(id);
    if (!sp) continue;
    const f = sp.Flags, gate = sp.Flags2 & 0x3000;
    if (!(f & 0x20) && !gate) out.inhabited = true;
    if (!novaCanLand(sp) || gate) continue;
    out.land = true;
    if (f & 0x02) out.commodity = true;
    if (f & 0x04) out.outfit = true;
    if (f & 0x08) out.shipyard = true;
    if (f & 0x40) out.bar = true;
  }
  return out;
}

/* The weapons that can damage a stellar: the Bible's planet-type weapons,
   wëap Flags2 0x0400, which "can only hit planet-type ships or destroyable
   stellars". None of the four releases has one. */
function novaPlanetWeapons(game) {
  const out = [];
  for (const e of game.list('wëap')) {
    const w = novaGet(game, 'wëap', e.id);
    if (w && (w.Flags2 & 0x0400)) out.push(w);
  }
  return out;
}

/* dësc text with its choices made for a state. The Bible's dësc section:
   {bXXX "one" "two"} on a control bit, {G "one" "two"} on the player being
   male, {P "one" "two"} or {Pxxx ...} on the game being registered; `!`
   before the letter negates; a missing second string is nothing; \" is a
   quotation mark inside a string. The test is the same term as in a
   control-bit test, so it is read by nova-ncb.js. A choice that does not
   parse is left as written. */
const NOVA_DESC_CHOICE = /\{\s*(!?)\s*([bB]\s*\d+|[Gg]|[Pp]\s*\d*)\s*"((?:[^"\\]|\\.)*)"\s*(?:"((?:[^"\\]|\\.)*)")?\s*\}/g;
function novaDescText(text, state) {
  const unq = s => (s || '').replace(/\\(.)/g, '$1');
  return String(text || '').replace(NOVA_DESC_CHOICE, (m, not, term, a, b) => {
    const t = /^[Pp]\s*$/.test(term) ? 'P0' : term;
    const on = ncbTest(t, state);
    return (not ? !on : on) ? unq(a) : unq(b);
  });
}

/* The bits a descriptive text's choices read, for a page to offer. */
function novaDescBits(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(NOVA_DESC_CHOICE)) {
    const b = /^[bB]\s*(\d+)$/.exec(m[2]);
    if (b) out.add(+b[1]);
  }
  return [...out].sort((a, b) => a - b);
}
