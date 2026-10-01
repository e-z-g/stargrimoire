/* page-map.js -- the universe map: the galaxy, a system, a stellar.
   =========================================================================

   The galaxy and every system in it are one picture, as grimoire's World
   tab is one picture of Cythera. A system is a disc at its place in the
   galaxy, and its stellars are drawn inside the disc, scaled down to fit
   it: a system is not somewhere you go but a place that gets bigger as you
   zoom in. Which system you are in is read off the view -- the one whose
   disc holds the middle of the screen and fills a good part of it -- and
   the bar, the panel and the address follow. A stellar you land on is a
   page of its own over the map, the landing picture and the descriptions,
   reached by a fall onto the stellar as grimoire falls into a cave mouth.
   The panel beside says what is selected, read from the records, with
   every field of the record at its foot. The address bar keeps where you
   are (#system=130, #stellar=128&system=130), so Back works and a place
   can be linked.

   Everything drawn comes from nova-universe.js, and the subway map's
   places and paths from nova-subway.js; this file decides only how it
   looks. Choices of its own, said once here: a system is a dot in its
   government's Color with a light rim, so the governments whose colour is
   black still show on black; an independent system is grey; a system's
   disc reaches 0.42 of the way to its nearest neighbour, so no two discs
   meet; a stellar is never drawn smaller than MIN_STELLAR pixels once its
   system is open; a nebula's picture is laid over the map in screen
   blending, as ResForge's Galaxy Editor does.

   The page's own script: DOM here. LOAD ORDER: after page-open.js, before
   page-ships.js, whose SHIPS, shipsReset and shipsFromHash it uses at run
   time. */

let U = null;
let SHOWN = new Set();
let LINKS = [];
let GATES = { links: [], random: [], dead: [] }, GATE_SYS = new Map();
let SHOW_MODE = 'new';
let STATE = { bits: new Set(), male: true, registered: true };
const VIEW = { mode: 'galaxy', sys: null, stellar: null, sel: null, hover: null, govt: null, back: null };
// The view: the galaxy point at the middle of the screen, and pixels per
// galaxy unit. There is one, at every zoom.
const CAM = { x: 0, y: 0, s: 1 };
let GALAXY_HOME = null;
const PICT_CACHE = new Map();
const SPRITE_CACHE = new Map();
const MIN_STELLAR = 26;
/* The numbers that decide how the zoom feels, as grimoire's ATLAS_TUNE
   does there. A system's stellars begin to replace its dot when its disc
   is fadeFrom pixels across and have replaced it at fadeTo; when their
   names come in is namePlan's and stellarNamePlan's. animMs is grimoire's,
   settled on a real screen: the fall onto a stellar and the rise from it,
   and seven tenths of it a zoom into a system. The two sizes are not
   settled yet. They were 36 and 150 until the maintainer found the
   stellars came in too soon (28 September 2026). */
const TUNE = { fadeFrom: 100, fadeTo: 200, animMs: 1000, room: 0.42, roomCap: 30 };
/* Whether the stellars come in as you zoom in (a switch in Map options).
   Without them a system stays a dot at any zoom, and only the one you go to
   -- by a tap, a link, a search, the address -- opens, until you have
   zoomed out of it again: OPEN_SYS. */
let STELLARS = true, OPEN_SYS = null;
/* The subway map (nova-subway.js). mix runs from 0, every place at its true
   position, to 1, the subway map's, and the places and links are drawn
   between the two, so switching slides one into the other. The layout is
   worked out the first time it is wanted, and kept in the browser's
   storage for the next visit with the same files. */
// base: what LAYOUT.mix 0 is, the true positions (null) or, sliding from one subway map to another, the one left
const LAYOUT = { kind: null, want: null, mix: 0, sub: null, base: null, subs: {}, pending: {} };
// How much of a subway map is drawn, for the lines' width and their rounded corners: all of one
// the whole way from one to another.
const subMix = () => (LAYOUT.base ? 1 : LAYOUT.mix);
/* How the links are coloured (LINKS_BY: 'plain', 'govt' -- from one end's
   government colour to the other's -- or 'jumps', by how many jumps they
   are from the selected system), and whether the systems' names are drawn
   on the galaxy (the selected and pointed-at always are). The jumps run
   through the whole spectrum, as the maintainer asked (28 September
   2026), red at one jump to blue at the furthest: turbo (Mikhailov, 2019),
   d3-scale-chromatic's fit of it, between 0.1 and 0.9, where every colour
   is at least 3:1 against the black of the map. */
// SYS_STYLE: how a system is marked: 'dots', coloured as DOTS_BY says; 'metro', a white stop, or where
// three links or more meet a larger one ringed, as metro maps mark stations; 'none'
// PLAIN_NAMES: the systems' names as metro maps set them (the maintainer's asking, 30 September 2026):
// one size, never made smaller to fit, semibold, white, outlined in the background's colour
// NEB_STYLE: the nebulae as their pictures, as plain shapes (nebulaShape), or not at all; NEBULAE, drawn at all
let LINKS_BY = 'plain', NAMES = true, NEBULAE = true, NEB_STYLE = 'pictures', SYS_STYLE = 'dots', PLAIN_NAMES = false;
function turbo(t) {
  t = Math.max(0, Math.min(1, t));
  const c = v => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c(34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05)))))},` +
    `${c(23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56)))))},` +
    `${c(27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66)))))})`;
}
// one jump at the red end, the furthest at the blue
const jumpT = f => 0.9 - 0.8 * f;
const SUBWAY_STORE = 'stargrimoire-subway';
/* Which subway map, from its five switches (nova-subway.js: a kind is
   the switches' words joined by '-', '45' for none), and how the address
   names it: the words below joined by ',' (&subway=names,22.5). 22.5
   degrees only where needed (mixed) brings 22.5 degrees with it; busy
   stations as points, not bars (dots), means something only with
   headings kept, and is dropped without. */
const SUBWAY_WORDS = { names: 'names', fine: '22.5', mixed: 'mixed', heading: 'heading', dots: 'dots', side: 'side' };
function subwayKind(on) { return Object.keys(SUBWAY_WORDS).filter(k => (on[k] && (k !== 'dots' || on.heading) && (k !== 'side' || (on.heading && on.names))) || (k === 'fine' && on.mixed)).join('-') || '45'; }
function subwayAddress(kind) { const f = subwayFlags(kind); return Object.keys(SUBWAY_WORDS).filter(k => f[k]).map(k => SUBWAY_WORDS[k]).join(','); }
function subwayFromAddress(text) { const w = (text || '').split(','); return subwayKind(Object.fromEntries(Object.entries(SUBWAY_WORDS).map(([k, v]) => [k, w.includes(v)]))); }

const $ = id => document.getElementById(id);
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function clampNum(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---- names, from the records ------------------------------------------- */

function govtName(id) {
  if (id === -1) return 'Independent';
  const g = U.govts.get(id);
  return g ? g.name : `gövt ${id} (not in these files)`;
}
function govtFill(id) {
  if (id === -1 || !U.govts.has(id)) return '#8f98a3';
  return novaGovtColor(U, id);
}
function resName(type, id) { return (GAME && novaNameParts(GAME.name(type, id)).name) || `${type} ${id}`; }
function stellarTypeName(t) { return novaString(GAME, 1100, t, 7000); }
function commodityName(i) { return novaString(GAME, 4000, i, 9000) || `commodity ${i + 1}`; }
function descText(id) {
  const d = novaGet(GAME, 'dësc', id);
  return d ? d : null;
}

/* ---- pictures ---------------------------------------------------------- */

/* A PICT as something drawImage takes, or null while it is not there. A
   picture the files do not have is tried again when more files arrive. */
function pictImage(id) {
  if (PICT_CACHE.has(id)) { const v = PICT_CACHE.get(id); return v && v.width ? v : null; }
  const r = GAME.get('PICT', id);
  if (!r) return null;
  try {
    const p = decodePict(r.bytes);
    if (p.kind === 'canvas') { PICT_CACHE.set(id, p.canvas); return p.canvas; }
    PICT_CACHE.set(id, 'pending');
    const ready = () => document.dispatchEvent(new CustomEvent('pictready', { detail: id }));
    createImageBitmap(p.blob).then(b => { PICT_CACHE.set(id, b); redraw(); ready(); }, () => { PICT_CACHE.set(id, 'failed'); ready(); });
  } catch (e) {
    PICT_CACHE.set(id, 'failed');
  }
  return null;
}

/* A stellar's picture, the first frame of its sprite, as a canvas. */
function stellarSprite(sp) {
  const spinId = novaStellarSpin(sp);
  if (SPRITE_CACHE.has(spinId)) return SPRITE_CACHE.get(spinId);
  const spin = novaGet(GAME, 'spïn', spinId);
  if (!spin) return null;
  const r = GAME.get('rlëD', spin.SpritesID) || GAME.get('rlë8', spin.SpritesID);
  let c = null;
  if (r) {
    try {
      const d = novaDecodeRle(r.bytes, 1);
      c = document.createElement('canvas');
      c.width = d.width; c.height = d.height;
      c.getContext('2d').putImageData(new ImageData(d.frames[0], d.width, d.height), 0, 0);
    } catch (e) { c = null; }
  } else if (GAME.has('PICT', spin.SpritesID)) {
    // A sprite sheet in a PICT: the first tile, without its mask.
    const sheet = pictImage(spin.SpritesID);
    if (!sheet) return null;
    c = document.createElement('canvas');
    c.width = spin.xSize; c.height = spin.ySize;
    c.getContext('2d').drawImage(sheet, 0, 0, spin.xSize, spin.ySize, 0, 0, spin.xSize, spin.ySize);
    c.masked = false;
  } else return null;
  SPRITE_CACHE.set(spinId, c);
  return c;
}

/* Animated stellars (nova-universe.js, novaStellarAnimStep). A sprite's
   frames are drawn one at a time as each is first shown, and kept. The
   animations are stepped thirty times a second, as the game counts its
   time, while one is on the screen, and not at all where the browser asks
   for reduced motion. The map takes no stellar as destroyed, as everywhere
   else on it. A hypergate stays shut, as it does with no ship near; a
   sprite in a PICT sheet (none shipped) keeps its first frame. */
const FRAME_CACHE = new Map();    // spïn id -> { bytes, index, count, frames } or null
const STELLAR_ANIM = new Map();   // stellar id -> novaStellarAnimState()
let ANIM_SEEN = new Set(), ANIM_TICK = null, ANIM_LAST = 0, ANIM_DUE = 0;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function spriteFrames(sp) {
  const spinId = novaStellarSpin(sp);
  if (FRAME_CACHE.has(spinId)) return FRAME_CACHE.get(spinId);
  const spin = novaGet(GAME, 'spïn', spinId);
  const r = spin && (GAME.get('rlëD', spin.SpritesID) || GAME.get('rlë8', spin.SpritesID));
  let f = null;
  if (r) {
    try {
      const index = novaRleIndex(r.bytes);
      if (index.header.frames > 1) f = { bytes: r.bytes, index, count: index.header.frames, frames: [] };
    } catch (e) { f = null; }
  }
  FRAME_CACHE.set(spinId, f);
  return f;
}

// What to draw for a stellar now: the frame it is on, `img` (its first) if it does not animate.
function stellarImage(sp, img) {
  if (!img || reducedMotion() || !novaStellarAnimates(sp)) return img;
  const f = spriteFrames(sp);
  if (!f) return img;
  let a = STELLAR_ANIM.get(sp.id);
  if (!a) STELLAR_ANIM.set(sp.id, a = novaStellarAnimState());
  if ((sp.Flags2 & 0x1000) && a.cur === 0) return img;
  ANIM_SEEN.add(sp.id);
  const n = a.cur;
  if (n === 0) return img;
  if (!f.frames[n]) {
    const h = f.index.header, c = document.createElement('canvas');
    c.width = h.width; c.height = h.height;
    try { c.getContext('2d').putImageData(new ImageData(novaDecodeRleFrame(f.bytes, f.index, n), h.width, h.height), 0, 0); }
    catch (e) { return img; }
    f.frames[n] = c;
  }
  return f.frames[n];
}

function stellarAnimLoop(now) {
  ANIM_TICK = null;
  if (!ANIM_SEEN.size || $('app').hidden || reducedMotion()) { ANIM_LAST = 0; return; }
  if (ANIM_LAST) ANIM_DUE = Math.min(ANIM_DUE + (now - ANIM_LAST) * 0.03, 4);
  ANIM_LAST = now;
  const rand = n => Math.floor(Math.random() * n);
  let changed = false;
  for (; ANIM_DUE >= 1; ANIM_DUE--) {
    for (const id of ANIM_SEEN) {
      const sp = U.stellars.get(id), f = sp && spriteFrames(sp), a = STELLAR_ANIM.get(id);
      if (f && a && novaStellarAnimStep(sp, a, f.count, 1, false, rand)) changed = true;
    }
  }
  if (changed) redraw();
  ANIM_TICK = requestAnimationFrame(stellarAnimLoop);
}

/* ---- starting, and more files ------------------------------------------ */

function mapStart(fresh) {
  U = novaUniverse(GAME);
  PICT_CACHE.clear();
  SPRITE_CACHE.clear();
  FRAME_CACHE.clear();
  STELLAR_ANIM.clear();
  GEO.clear();
  STELLAR_NAMES.clear();
  NEB_BRIGHT.clear();
  BITS = null;
  MISSIONS = null;
  setTimeout(() => { if (!BITS && GAME) { bitCatalog(); renderPanel(); } }, 300);
  // other files: the subway map is worked out again, the true positions shown meanwhile
  const kind = LAYOUT.want;
  Object.assign(LAYOUT, { kind: null, mix: 0, sub: null, base: null, subs: {}, pending: {} });
  NEB_SUB.clear();
  if (kind) setLayoutNow(kind);
  shipsReset();
  $('start').hidden = true;
  $('views').hidden = false;
  if (!SHIPS.on) $('app').hidden = false;
  resizeCanvas();
  applyShowMode();
  if (fresh || !GALAXY_HOME) {
    Object.assign(CAM, galaxyView());
    GALAXY_HOME = { ...CAM };
  }
  // An address in the ships (#ship=128) opens them over the galaxy.
  if (/(^#|&)(ships|ship=)/.test(location.hash)) { show('galaxy', { fromHash: true }, true); shipsFromHash(); }
  else if (!applyHash()) show('galaxy', {}, true);
}

function mapFilesChanged() {
  for (const [k, v] of PICT_CACHE) if (!v || v === 'failed') PICT_CACHE.delete(k);
  for (const [k, v] of SPRITE_CACHE) if (!v) SPRITE_CACHE.delete(k);
  for (const [k, v] of FRAME_CACHE) if (!v) FRAME_CACHE.delete(k);
  STELLAR_NAMES.clear();
  redraw();
  if (VIEW.mode === 'planet') renderPlanet();
}

function applyShowMode() {
  SHOW_MODE = $('showSel').value;
  $('bitsIn').hidden = SHOW_MODE !== 'bits';
  STATE = { bits: SHOW_MODE === 'bits' ? ncbBitsFromText($('bitsIn').value) : new Set(), male: STATE.male, registered: true };
  SHOWN = novaShownSystems(U, SHOW_MODE === 'all' ? null : STATE);
  LINKS = novaShownLinks(U, SHOWN);
  GATES = novaShownGates(U, SHOWN);
  // each system's gates, and the kind each is marked with: one that leads somewhere over one that does not
  GATE_SYS = new Map();
  const mark = (id, spob, k) => {
    if (!GATE_SYS.has(id)) GATE_SYS.set(id, new Map());
    const m = GATE_SYS.get(id);
    if (!m.has(spob) || m.get(spob).endsWith('-dead')) m.set(spob, k);
  };
  for (const w of GATES.ways) mark(w.from.id, w.gate, novaGateKind(w.gate));
  for (const r of GATES.random) mark(r.sys.id, r.spob, r.enter ? 'wormhole' : 'wormhole-dead');
  for (const d of GATES.dead) mark(d.sys.id, d.spob, novaGateKind(d.spob) + '-dead');
  buildPlaces();
  redraw();
  renderPanel();
}

/* ---- places: where each system's disc is -------------------------------- */

/* One place for each position a shown system has; the versions of a
   system share one. A place's disc, rho galaxy units across its radius,
   reaches 0.42 of the way to the nearest other place (no further than
   0.42 of roomCap), and the system drawn there is scaled to fit it. A
   system you go to that is not shown gets a place of its own while you
   are there. */
let PLACES = [], PLACE_OF = new Map(), EXTRA_SYS = null, S_MAX = 40;
function buildPlaces() {
  const was = VIEW.sys !== null && PLACE_OF.has(VIEW.sys) ? { p: PLACE_OF.get(VIEW.sys), k: kOf(U.byId.get(VIEW.sys)) } : null;
  const by = new Map();
  const add = s => {
    const key = s.x + ',' + s.y;
    let p = by.get(key);
    if (!p) {
      const at = LAYOUT.sub && LAYOUT.sub.at(s.x, s.y), bt = LAYOUT.base && LAYOUT.base.at(s.x, s.y);
      by.set(key, p = { x: s.x, y: s.y, ids: [], rho: 0, tx: s.x, ty: s.y, sx: at ? at.x : s.x, sy: at ? at.y : s.y, bx: bt ? bt.x : s.x, by: bt ? bt.y : s.y });
    }
    if (!p.ids.includes(s.id)) p.ids.push(s.id);
  };
  for (const s of U.systems) if (SHOWN.has(s.id)) add(s);
  if (EXTRA_SYS !== null && U.byId.has(EXTRA_SYS)) add(U.byId.get(EXTRA_SYS));
  PLACES = [...by.values()];
  for (const p of PLACES) {
    let nt = TUNE.roomCap, ns = TUNE.roomCap, nb = TUNE.roomCap;
    for (const q of PLACES) if (q !== p) {
      nt = Math.min(nt, Math.hypot(p.tx - q.tx, p.ty - q.ty));
      ns = Math.min(ns, Math.hypot(p.sx - q.sx, p.sy - q.sy));
      nb = Math.min(nb, Math.hypot(p.bx - q.bx, p.by - q.by));
    }
    p.rhoT = TUNE.room * nt; p.rhoS = TUNE.room * ns; p.rhoB = TUNE.room * nb;
  }
  PLACE_OF = new Map();
  for (const p of PLACES) for (const id of p.ids) PLACE_OF.set(id, p);
  mixPlaces();
  // Inside a system whose disc has changed, the same view of it.
  if (was && PLACE_OF.has(VIEW.sys)) {
    const p = PLACE_OF.get(VIEW.sys), q = kOf(U.byId.get(VIEW.sys)) / was.k;
    if (Math.abs(q - 1) > 1e-9 || p.x !== was.p.x || p.y !== was.p.y) {
      CAM.x = p.x + (CAM.x - was.p.x) * q; CAM.y = p.y + (CAM.y - was.p.y) * q; CAM.s /= q;
    }
  }
}
// A nebula's rectangle where LAYOUT.mix puts it: on the subway map moved
// and scaled so that the systems near it are over as bright a part of its
// picture as they truly are (nova-subway.js), from its largest picture's
// brightness, once that is read; kept until then only as it stands.
const NEB_SUB = new Map(), NEB_BRIGHT = new Map();
function nebulaBrights() {
  return U.nebulae.map(n => {
    if (NEB_BRIGHT.has(n.id)) return NEB_BRIGHT.get(n.id);
    const id = novaNebulaPict(U, n, 1e3), img = id !== null && pictImage(id);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const b = subwayBrightness(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    NEB_BRIGHT.set(n.id, b);
    return b;
  });
}
const NEB_BASE = new Map();
function subRect(sub, cache, n) {
  let r = cache.get(n.id);
  if (!r) { const bs = nebulaBrights(); r = sub.rect(n, bs); if (bs.every(b => b)) cache.set(n.id, r); }
  return r;
}
function nebRect(n) {
  const from = LAYOUT.base ? subRect(LAYOUT.base, NEB_BASE, n) : n;
  if (!LAYOUT.mix || !LAYOUT.sub) return from;
  const r = subRect(LAYOUT.sub, NEB_SUB, n), m = LAYOUT.mix, at = (a, b) => a + (b - a) * m;
  return { x: at(from.x, r.x), y: at(from.y, r.y), w: at(from.w, r.w), h: at(from.h, r.h) };
}

// Each place where LAYOUT.mix puts it, and its disc's size there.
function mixPlaces() {
  const m = LAYOUT.mix;
  for (const p of PLACES) {
    p.x = p.bx + (p.sx - p.bx) * m; p.y = p.by + (p.sy - p.by) * m;
    p.rho = p.rhoB + (p.rhoS - p.rhoB) * m;
  }
  let kMin = Infinity;
  for (const p of PLACES) for (const id of p.ids) kMin = Math.min(kMin, p.rho / sysGeo(U.byId.get(id)).R);
  S_MAX = Math.max(40, 12 / kMin);
}
function placeOf(id) {
  if (!PLACE_OF.has(id)) { EXTRA_SYS = id; buildPlaces(); }
  return PLACE_OF.get(id);
}
// The system a place shows: the one you are in, if it is one of them.
function repOf(p) { return p.ids.includes(VIEW.sys) ? VIEW.sys : p.ids[0]; }
function curPlace() { return VIEW.sys !== null && VIEW.mode !== 'galaxy' ? PLACE_OF.get(VIEW.sys) || null : null; }

/* The stellars a system is fitted to. Wormholes and the like sit
   thousands of units out where the planets are hundreds apart, and a view
   fitted to them shows the planets as dots; so, walking outwards, a
   stellar more than three times as far out as the one before, or than
   1000 when the one before is nearer, ends the fit, and it and those
   beyond are drawn in pockets (stellarPos). */
function nearStellars(sys) {
  const list = sys.stellars.map(id => U.stellars.get(id)).map(sp => ({ sp, d: Math.hypot(sp.xPos, sp.yPos) })).sort((a, b) => a.d - b.d);
  let k = list.length;
  for (let i = 1; i < list.length; i++) if (list[i].d > 3 * Math.max(list[i - 1].d, 1000)) { k = i; break; }
  return list.slice(0, k).map(x => x.sp);
}
/* A system's size in its own units: the circle round (0, 0) that holds
   its near stellars with 80 units to spare for their sprites, and never
   less than 300, the half-width a system's first view has always had. */
const GEO = new Map();
function sysGeo(sys) {
  let g = GEO.get(sys.id);
  if (!g) {
    const near = nearStellars(sys);
    let R = 300;
    for (const sp of near) R = Math.max(R, Math.hypot(sp.xPos, sp.yPos) + 80);
    GEO.set(sys.id, g = { R, near: new Set(near.map(sp => sp.id)) });
  }
  return g;
}
// Galaxy units to one unit of the system's own.
function kOf(sys) { return placeOf(sys.id).rho / sysGeo(sys).R; }
/* Where a stellar is drawn, in its system's own units: where it is, or, for
   one beyond the near ones -- in the shipped game 18 wormholes, each 4,000
   to 12,000 units out, past the neighbouring systems -- in a pocket, a
   small circle on the rim of the disc in the stellar's own direction, the
   maintainer's idea (1 October 2026), so that it is on the screen with its
   system. The galaxy's mark for a gate is put the same way (drawGateMarks). */
const POCKET = { at: 1.16, r: 0.24 };   // the pocket's centre and radius, in the disc's radius
function stellarPos(sys, sp) {
  const g = sysGeo(sys);
  if (g.near.has(sp.id)) return [sp.xPos, sp.yPos];
  const a = Math.atan2(sp.yPos, sp.xPos);
  return [Math.cos(a) * POCKET.at * g.R, Math.sin(a) * POCKET.at * g.R];
}
function systemPockets(sys) {
  const g = sysGeo(sys);
  return sys.stellars.filter(id => !g.near.has(id)).map(id => stellarPos(sys, U.stellars.get(id)));
}
function stellarWorld(sys, sp) { const p = placeOf(sys.id), k = kOf(sys), [x, y] = stellarPos(sys, sp); return [p.x + k * x, p.y + k * y]; }

/* ---- the canvas and the view -------------------------------------------- */

let CTX = null, CW = 0, CH = 0, FONT = null;
function resizeCanvas() {
  const c = $('map'), dpr = window.devicePixelRatio || 1;
  CW = c.clientWidth; CH = c.clientHeight;
  c.width = Math.round(CW * dpr); c.height = Math.round(CH * dpr);
  CTX = c.getContext('2d');
  CTX.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}
function font() { return FONT || (FONT = getComputedStyle(document.body).fontFamily); }

function toScreen(x, y, c = CAM) { return [(x - c.x) * c.s + CW / 2, (y - c.y) * c.s + CH / 2]; }
function toWorld(sx, sy, c = CAM) { return [(sx - CW / 2) / c.s + c.x, (sy - CH / 2) / c.s + c.y]; }
function sMin() { return GALAXY_HOME ? GALAXY_HOME.s * 0.5 : 0.05; }

function boxView(x0, y0, x1, y1, pad) {
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s: Math.min(Math.max(CW - pad * 2, 20) / w, Math.max(CH - pad * 2, 20) / h) };
}
/* The whole map at once, framed as Fit frames it, drawn into ctx at w by h map pixels, for saving it
   large (the maintainer's asking, 30 September 2026). The stellars are left closed, so that every
   system is its mark however near; the screen's own context, size and view are put back after. */
function drawWholeMap(ctx, w, h) {
  const keep = { CTX, CW, CH, cam: { ...CAM }, STELLARS, OPEN_SYS, MOVING, hover: VIEW.hover, scale: $('scale').textContent };
  try {
    CTX = ctx; CW = w; CH = h; STELLARS = false; OPEN_SYS = null; MOVING = true; VIEW.hover = null;
    Object.assign(CAM, galaxyView());
    draw();
  } finally {
    CTX = keep.CTX; CW = keep.CW; CH = keep.CH; Object.assign(CAM, keep.cam);
    STELLARS = keep.STELLARS; OPEN_SYS = keep.OPEN_SYS; MOVING = keep.MOVING; VIEW.hover = keep.hover;
    draw();
    $('scale').textContent = keep.scale;
  }
}
// Its size: the galaxy's shape, 2000 map pixels along its longer side.
function wholeMapSize() {
  const xs = PLACES.map(p => p.x), ys = PLACES.map(p => p.y);
  const gw = Math.max(...xs) - Math.min(...xs) || 1, gh = Math.max(...ys) - Math.min(...ys) || 1, L = 2000, pad = 60;
  return gw >= gh ? [L, Math.round((L - pad) * gh / gw) + pad] : [Math.round((L - pad) * gw / gh) + pad, L];
}
function galaxyView() {
  const xs = PLACES.map(p => p.x), ys = PLACES.map(p => p.y);
  if (!xs.length) return { ...CAM };
  return boxView(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 30);
}
// A system's first view: its near stellars, its pockets and (0, 0), 300
// units each way at the least, fitted with 70 pixels to spare.
function systemView(sys) {
  const pts = nearStellars(sys).map(sp => [sp.xPos, sp.yPos]), pr = POCKET.r * sysGeo(sys).R;
  for (const [x, y] of systemPockets(sys)) pts.push([x - pr, y - pr], [x + pr, y + pr]);
  pts.push([0, 0]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), half = 300;
  const v = boxView(Math.min(...xs, -half), Math.min(...ys, -half), Math.max(...xs, half), Math.max(...ys, half), 70);
  const p = placeOf(sys.id), k = kOf(sys);
  return { x: p.x + k * v.x, y: p.y + k * v.y, s: v.s / k };
}

let DRAW_QUEUED = false;
function redraw() {
  if (DRAW_QUEUED || !CTX) return;
  DRAW_QUEUED = true;
  requestAnimationFrame(() => { DRAW_QUEUED = false; draw(); });
}

// How far a place's stellars have replaced its dot, 0 to 1.
function openness(p) {
  if (!STELLARS && !p.ids.includes(OPEN_SYS)) return 0;
  return clampNum((2 * p.rho * CAM.s - TUNE.fadeFrom) / (TUNE.fadeTo - TUNE.fadeFrom), 0, 1);
}

let DRAWN = [];   // the places on the screen at the last draw
let LABELS_DRAWN = { systems: 0, stellars: 0, boxes: [] };   // the names the last draw put on the screen, for page_check
let NAME_BOXES = [];   // every system name the last draw put on the screen, as { x0, y0, x1, y1 }: the nebulae's names keep off them
let NEB_NAMES = [];   // the nebulae drawn as plain shapes, whose names are put after the systems'
function draw() {
  if (!U) return;
  const ctx = CTX, cur = curPlace();
  DRAWN = [];
  LABELS_DRAWN = { systems: 0, stellars: 0, boxes: [] };
  ANIM_SEEN = new Set();
  NAME_BOXES = []; NEB_NAMES = [];
  for (const p of PLACES) {
    const [x, y] = toScreen(p.x, p.y), D = 2 * p.rho * CAM.s, r = Math.max(D / 2, 12);
    if (p !== cur && (x + r < -20 || y + r < -20 || x - r > CW + 20 || y - r > CH + 20)) continue;
    DRAWN.push({ p, x, y, D, t: openness(p), sys: U.byId.get(repOf(p)) });
  }
  ctx.save();
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CW, CH);
  drawNebulae(ctx);
  drawDiscs(ctx);
  drawLinks(ctx);
  drawGates(ctx);
  drawDots(ctx);
  for (const d of DRAWN) if (d.t > 0) drawStellars(ctx, d, d.p === cur);
  drawSystemLabels(ctx);
  drawNebulaNames(ctx);
  drawSelection(ctx);
  const cd = cur && DRAWN.find(d => d.p === cur);
  if (cd) drawEdgeMarks(ctx, cd);
  ctx.restore();
  if (ANIM_SEEN.size && !ANIM_TICK) { ANIM_LAST = 0; ANIM_TICK = requestAnimationFrame(stellarAnimLoop); }
  $('scale').textContent = cd ? `system at ${Math.round(CAM.s * kOf(cd.sys) * 100)}%` : `map at ${Math.round(CAM.s * 100)}%`;
  if (!MOVING) settle();
  // without the stellars, the system you went to closes for good once you have zoomed out of it
  if (!STELLARS && OPEN_SYS !== null && !MOVING && VIEW.sys !== OPEN_SYS) {
    const p = PLACE_OF.get(OPEN_SYS);
    if (!p || openness(p) <= 0) OPEN_SYS = null;
  }
}

/* Which system you are in, read off the view: the place whose disc holds
   the middle of the screen and is at least 0.4 of the screen's shorter
   side across, the nearest to the middle if more than one is. */
function settle() {
  if (VIEW.mode === 'planet') return;
  const m = Math.min(CW, CH);
  let best = null, bd = Infinity;
  for (const d of DRAWN) {
    if (d.D < 0.4 * m || (!STELLARS && !d.p.ids.includes(OPEN_SYS))) continue;
    const dd = Math.hypot(d.x - CW / 2, d.y - CH / 2);
    if (dd <= d.D / 2 && dd < bd) { bd = dd; best = d; }
  }
  const id = best ? best.sys.id : null;
  if (id === (VIEW.mode === 'system' ? VIEW.sys : null)) return;
  if (id === null) {
    VIEW.sel = { kind: 'system', id: VIEW.sys };
    VIEW.mode = 'galaxy'; VIEW.sys = null;
  } else {
    if (VIEW.sel && !(VIEW.sel.kind === 'stellar' && best.sys.stellars.includes(VIEW.sel.id))) VIEW.sel = null;
    VIEW.mode = 'system'; VIEW.sys = id;
  }
  VIEW.hover = null;
  writeHash(true);
  renderCrumbs();
  renderPanel();
}

/* ---- drawing ------------------------------------------------------------- */

function systemRadius() {
  const r = clampNum(1.6 + CAM.s * 1.9, 3, 8);
  // on the map with room for names, never out onto a name, which begins 0.6 of a step away
  return namesInRoom() ? Math.min(r, Math.max(2.5, 0.4 * LAYOUT.sub.layout.step * CAM.s)) : r;
}
// Whether the names are drawn in the room the subway map left them.
function namesInRoom() { return !!LAYOUT.kind && subwayFlags(LAYOUT.kind).names && LAYOUT.mix === 1 && !!LAYOUT.sub; }

// Nebulae thin out as the view closes on a system: their largest picture
// is for 237%, and far past it they are a blur behind the stellars.
function drawNebulae(ctx) {
  const a = (1 - 0.8 * clampNum(Math.log(CAM.s / 3) / Math.log(4), 0, 1)) * (VIEW.govt !== null ? 0.25 : 1);
  if (a <= 0 || !NEBULAE) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a;
  for (const n of U.nebulae) {
    if (SHOW_MODE !== 'all' && !safeTest(n.activeOn)) continue;
    const r = nebRect(n), [x, y] = toScreen(r.x, r.y), w = r.w * CAM.s, h = r.h * CAM.s;
    if (x > CW || y > CH || x + w < 0 || y + h < 0) continue;
    const id = novaNebulaPict(U, n, CAM.s * r.w / n.w);
    const img = id !== null && pictImage(id);
    if (NEB_STYLE === 'shapes') { ctx.globalCompositeOperation = 'source-over'; nebulaShape(ctx, n, img, x, y, w, h, a); ctx.globalCompositeOperation = 'screen'; }
    else if (img) ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}
/* A nebula as a plain shape (the maintainer's asking, 30 September 2026: the pictures were hard to
   see the lines over): a rounded patch in its picture's colour, the colour its pixels average to,
   each weighted by its brightness and brought up to a steady brightness, faint enough for the lines
   and stations over it to read, a lighter edge, and its name. */
const NEB_TINT = new Map();
function nebulaTint(n, img) {
  if (NEB_TINT.has(n.id)) return NEB_TINT.get(n.id);
  let t = [150, 160, 190];
  if (img) {
    const c = document.createElement('canvas'), k = 24;
    c.width = c.height = k;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, k, k);
    const px = g.getImageData(0, 0, k, k).data;
    let r = 0, gr = 0, b = 0, wt = 0;
    // weighted by how bright and how coloured each pixel is, so that black and white lettering count for nothing
    for (let i = 0; i < px.length; i += 4) { const mx = Math.max(px[i], px[i + 1], px[i + 2]), mn = Math.min(px[i], px[i + 1], px[i + 2]), l = mx * (mx ? (mx - mn) / mx : 0); r += px[i] * l; gr += px[i + 1] * l; b += px[i + 2] * l; wt += l; }
    if (wt > 0) { const m = Math.max(r, gr, b) / wt || 1; t = [r, gr, b].map(v => Math.round(v / wt * 220 / m)); }
    NEB_TINT.set(n.id, t);
  }
  return t;
}
// The part of a nebula's picture that is the nebula: its coloured pixels, bright as its coloured
// pixels go, so that the black of space and the nearly colourless name lettered on it are left out, each in its own colour
// brought up to full brightness (the maintainer found one colour for a nebula, its average, muddy),
// its alpha how much so; on a 48 by 48 grid, softened, drawn stretched. And the box, in fractions
// of the picture, of what is clearly cloud.
const NEB_MASK = new Map();
function nebulaMask(n, img) {
  if (NEB_MASK.has(n.id)) return NEB_MASK.get(n.id);
  if (!img) return null;
  const k = 48, c = document.createElement('canvas');
  c.width = c.height = k;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, k, k);
  const d = g.getImageData(0, 0, k, k), px = d.data;
  // each pixel its own colour brought up to full brightness, premultiplied by how much it is cloud
  const pm = new Float32Array(k * k * 4);
  // brightness judged against the picture's coloured pixels' own, their 90th centile: the lettering
  // is its brightest (up to 241 in the Rochak Dust Field, whose dust is 41 to 56), and is nearly
  // colourless (30 September 2026, measured over the four nebulae of the stock game)
  const sat = i => { const mx = Math.max(px[4 * i], px[4 * i + 1], px[4 * i + 2]), mn = Math.min(px[4 * i], px[4 * i + 1], px[4 * i + 2]); return mx ? (mx - mn) / mx : 0; };
  const coloured = []; for (let i = 0; i < k * k; i++) if (sat(i) >= 0.3) coloured.push(Math.max(px[4 * i], px[4 * i + 1], px[4 * i + 2]));
  coloured.sort((a, b) => a - b);
  const P = Math.max(30, coloured.length ? coloured[Math.floor(0.9 * (coloured.length - 1))] : 0);
  let x0 = k, y0 = k, x1 = -1, y1 = -1;
  for (let i = 0; i < k * k; i++) {
    const r = px[4 * i], gr = px[4 * i + 1], b = px[4 * i + 2], mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
    // cloud: coloured, and bright as the picture's coloured pixels go
    const wgt = clampNum((mx - 0.25 * P) / (0.6 * P), 0, 1) * clampNum((sat(i) - 0.15) / 0.2, 0, 1), up = mx ? 255 / mx : 0;
    pm[4 * i] = r * up * wgt; pm[4 * i + 1] = gr * up * wgt; pm[4 * i + 2] = b * up * wgt; pm[4 * i + 3] = 255 * wgt;
    if (wgt > 0.25) { const x = i % k, y = (i / k) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  // softened, a three by three average twice, so that the grid does not show when stretched
  for (let pass = 0; pass < 2; pass++) {
    const src = pm.slice();
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) for (let ch = 0; ch < 4; ch++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < k && yy < k) { sum += src[4 * (yy * k + xx) + ch]; cnt++; } }
      pm[4 * (y * k + x) + ch] = sum / cnt;
    }
  }
  for (let i = 0; i < k * k; i++) { const al = pm[4 * i + 3]; px[4 * i + 3] = Math.round(al); for (let ch = 0; ch < 3; ch++) px[4 * i + ch] = al > 0 ? Math.min(255, Math.round(pm[4 * i + ch] * 255 / al)) : 0; }
  g.putImageData(d, 0, 0);
  const out = { canvas: c, box: x1 < 0 ? null : { x0: x0 / k, y0: y0 / k, x1: (x1 + 1) / k, y1: (y1 + 1) / k } };
  NEB_MASK.set(n.id, out);
  return out;
}
function nebulaShape(ctx, n, img, x, y, w, h, a) {
  const [r, g, b] = nebulaTint(n, img), m = nebulaMask(n, img);
  if (m) {
    // the cloud the picture shows (the maintainer found systems caught in a whole rectangle)
    ctx.globalAlpha = 0.4 * a; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m.canvas, x, y, w, h);
  } else {
    const rad = 0.3 * Math.min(w, h);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
    ctx.globalAlpha = 0.16 * a; ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
  }
  ctx.globalAlpha = a;
  // its name goes by the cloud, where there is one
  const bx = m && m.box ? { x: x + w * m.box.x0, y: y + h * m.box.y0, w: w * (m.box.x1 - m.box.x0), h: h * (m.box.y1 - m.box.y0) } : { x, y, w, h };
  NEB_NAMES.push({ n, ...bx, a, colour: `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})` });
}
/* The names of the nebulae drawn as plain shapes, after the systems' (the maintainer's asking, 30
   September 2026: they ran into them): each at the first of its spots -- along the top of its
   cloud, in the middle, at the left, at the right, then along the bottom, then just outside it above
   and below, along what of it is on the screen, then beside it -- that is on the screen, comes
   within 5 pixels of no system's name, no system's mark and no nebula's name already put, and has
   the most room round it of those, the earlier a little preferred, at
   13 pixels or else 11; where none is clear it is left off, and is in the panel still. */
function drawNebulaNames(ctx) {
  if (!NEB_NAMES.length) return;
  const r = systemRadius() + 2, marks = DRAWN.filter(d => d.t < 1).map(d => ({ x0: d.x - r, x1: d.x + r, y0: d.y - r, y1: d.y + r }));
  // kept a little off them, not only clear of them (the maintainer found L-1551's crowding the
  // systems' names round it)
  const M = 5, hit = (a, b) => a.x0 < b.x1 + M && b.x0 < a.x1 + M && a.y0 < b.y1 + M && b.y0 < a.y1 + M;
  const placed = [];
  ctx.save();
  ctx.textBaseline = 'middle';
  for (const { n, x, y, w, h, a, colour } of NEB_NAMES) {
    let spot = null;
    for (const size of [13, 11]) {
      ctx.font = '600 ' + size + 'px ' + font();
      const tw = ctx.measureText(n.name).width, pad = 6, hh = size / 2 + 2;
      // where the shape runs off the screen, along what of it is on it
      const vx0 = Math.max(x, 0), vx1 = Math.min(x + w, CW), xs = [(vx0 + vx1) / 2 - tw / 2, vx0 + pad, vx1 - pad - tw];
      const vy0 = Math.max(y, 0), vy1 = Math.min(y + h, CH), ys = [vy0 + pad + hh, vy1 - pad - hh, y - hh - 2, y + h + hh + 2];
      // and beside it, left and right, half way down
      const cands = ys.flatMap(ty => xs.map(tx => [tx, ty])).concat([[x - tw - 8, (vy0 + vy1) / 2], [x + w + 8, (vy0 + vy1) / 2]]);
      // of the clear spots, the one with most room round it, the earlier a little preferred
      const gap = (a, b) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1));
      let best = -Infinity;
      cands.forEach(([tx, ty], q) => {
        const box = { x0: tx - 2, x1: tx + tw + 2, y0: ty - hh, y1: ty + hh };
        if (box.x0 < 0 || box.y0 < 0 || box.x1 > CW || box.y1 > CH) return;
        const others = NAME_BOXES.concat(marks, placed);
        if (others.some(b => hit(box, b))) return;
        const room = Math.min(40, ...others.map(b => gap(box, b))) - 2 * q;
        if (room > best) { best = room; spot = { tx, ty, box, size }; }
      });
      if (spot) break;
    }
    if (!spot) continue;
    placed.push(spot.box);
    ctx.font = '600 ' + spot.size + 'px ' + font();
    ctx.globalAlpha = 0.85 * a;
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#04060a'; ctx.strokeText(n.name, spot.tx, spot.ty);
    ctx.fillStyle = colour; ctx.fillText(n.name, spot.tx, spot.ty);
  }
  ctx.restore();
}

// An open system's disc, in its background colour, with a faint rim that
// goes as the disc outgrows the screen.
function drawDiscs(ctx) {
  const m = Math.min(CW, CH);
  ctx.lineWidth = 1;
  for (const d of DRAWN) {
    if (d.t <= 0) continue;
    const bg = d.sys.rec.BkgndColor & 0xFFFFFF, R = d.D / 2, q = R / sysGeo(d.sys).R, pr = POCKET.r * R;
    const pk = systemPockets(d.sys).map(([x, y]) => [d.x + x * q, d.y + y * q]);
    // the disc and its pockets as one shape, outlined round the outside of it
    const circle = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); };
    ctx.beginPath(); circle(d.x, d.y, R);
    for (const [x, y] of pk) circle(x, y, pr);
    if (bg) { ctx.globalAlpha = d.t; ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0'); ctx.fill(); }
    ctx.globalAlpha = d.t * 0.5 * clampNum((1.6 * m - d.D) / (0.8 * m), 0, 1);
    ctx.strokeStyle = 'rgba(120,135,160,0.35)';
    if (!pk.length) { ctx.beginPath(); circle(d.x, d.y, R); ctx.stroke(); continue; }
    const outside = holes => { ctx.beginPath(); ctx.rect(0, 0, CW, CH); for (const [x, y, r] of holes) circle(x, y, r); ctx.clip('evenodd'); };
    ctx.save(); outside(pk.map(([x, y]) => [x, y, pr])); ctx.beginPath(); circle(d.x, d.y, R); ctx.stroke(); ctx.restore();
    ctx.save(); outside([[d.x, d.y, R]]); ctx.beginPath(); for (const [x, y] of pk) circle(x, y, pr); ctx.stroke(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// A link's points in the galaxy: straight between its places, or its
// subway path, each bend on the way from the point as far along the
// straight line as it is along the path.
function linkPoints(l, pa, pb) {
  const m = LAYOUT.mix, line = m > 0 && LAYOUT.sub && LAYOUT.sub.line(l.from, l.to), base = LAYOUT.base && LAYOUT.base.line(l.from, l.to);
  if (!line && !base) return [{ x: pa.x, y: pa.y }, { x: pb.x, y: pb.y }];
  // the link at each end of the slide, the true one straight, matched by how far along it a point
  // is; drawn through the corners of both, so that each end is drawn as it is
  const A = base || [{ x: pa.tx, y: pa.ty }, { x: pb.tx, y: pb.ty }], B = line || A;
  const frac = L => { const c = [0]; for (let i = 1; i < L.length; i++) c.push(c[i - 1] + Math.hypot(L[i].x - L[i - 1].x, L[i].y - L[i - 1].y)); const t = c[c.length - 1] || 1; return c.map(x => x / t); };
  const along = (L, F, f) => {
    let i = 1;
    while (i < L.length - 1 && F[i] < f) i++;
    const t = F[i] > F[i - 1] ? Math.min(1, Math.max(0, (f - F[i - 1]) / (F[i] - F[i - 1]))) : 0;
    return { x: L[i - 1].x + (L[i].x - L[i - 1].x) * t, y: L[i - 1].y + (L[i].y - L[i - 1].y) * t };
  };
  const FA = frac(A), FB = frac(B), fs = [...new Set(FA.concat(FB))].sort((a, b) => a - b);
  const pts = fs.map(f => { const a = along(A, FA, f), b = along(B, FB, f); return { x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }; });
  // an end at a bar drawn as a dot (barKept) runs on into the dot
  const barred = q => ((m > 0 && LAYOUT.sub && LAYOUT.sub.bar(q.tx, q.ty)) || (LAYOUT.base && LAYOUT.base.bar(q.tx, q.ty))) && !barKept(q);
  if (barred(pa)) pts.unshift({ x: pa.x, y: pa.y });
  if (barred(pb)) pts.push({ x: pb.x, y: pb.y });
  return pts;
}
// A path with a length cut from each end, or null when nothing is left.
function trimPath(pts, a, b) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); total += d; }
  if (a + b >= total) return null;
  const at = s => {
    for (let i = 0; i < seg.length; i++) {
      if (s <= seg[i] || i === seg.length - 1) { const f = seg[i] ? s / seg[i] : 0; return { i, x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f }; }
      s -= seg[i];
    }
  };
  const p = at(a), q = at(total - b);
  return [{ x: p.x, y: p.y }, ...pts.slice(p.i + 1, q.i + 1), { x: q.x, y: q.y }];
}

// A government's colour for a link: a dark one lifted towards the plain
// link's grey, so that it still shows on black.
function linkColor(govt) {
  const hex = govtFill(govt), n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum < 0.3) { const t = (0.3 - lum) / 0.3; r += (140 - r) * t; g += (155 - g) * t; b += (185 - b) * t; }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.85)`;
}

/* Jumps from the selected system, or from the one you are in, along the
   shown links, a one-way link only the way it goes: a Map of system id to
   jumps, or null with none selected. Kept until the selection or the
   links change. */
let JUMPS = { from: null, links: null, map: null };
function jumpSource() {
  if (VIEW.sel && VIEW.sel.kind === 'system') return VIEW.sel.id;
  return VIEW.mode !== 'galaxy' ? VIEW.sys : null;
}
// Where each shown system's links go, a one-way link only the way it goes.
function linkNext() {
  const next = new Map();
  for (const l of LINKS) {
    const add = (a, b) => { if (!next.has(a)) next.set(a, []); next.get(a).push(b); };
    if (!l.oneWay || l.forward) add(l.from.id, l.to.id);
    if (!l.oneWay || !l.forward) add(l.to.id, l.from.id);
  }
  return next;
}
function jumpMap() {
  const from = jumpSource();
  if (from === null || !SHOWN.has(from)) return null;
  if (JUMPS.from === from && JUMPS.links === LINKS) return JUMPS.map;
  const out = new Map(), next = linkNext();
  out.set(from, 0);
  for (let q = [from], d = 1; q.length; d++) {
    const nq = [];
    for (const a of q) for (const b of next.get(a) || []) if (!out.has(b)) { out.set(b, d); nq.push(b); }
    q = nq;
  }
  JUMPS = { from, links: LINKS, map: out, max: Math.max(1, ...out.values()) };
  return out;
}
function jumpsTo(id) { const m = jumpMap(); return !m ? null : m.has(id) ? m.get(id) : Infinity; }
// The jump a link is on a shortest way out: one more than its nearer end, the way it can be flown.
function linkJumps(l, m) {
  const a = m.get(l.from.id), b = m.get(l.to.id);
  let j = Infinity;
  if (a !== undefined && (!l.oneWay || l.forward)) j = Math.min(j, a + 1);
  if (b !== undefined && (!l.oneWay || !l.forward)) j = Math.min(j, b + 1);
  return j;
}
/* The links each in one government's colour (the maintainer's asking, 30 September 2026), rather than
   a blend from one end's to the other's: a link within a government its colour; between two, the
   colour of the one with fewer systems shown; but where two parts of a government -- its systems
   joined by its own links -- are joined through one other system and only that one, the two links
   through it are the government's, so that it does not look split in two. Governments with more
   systems are seen to first. */
let GOVT_ONE = null;
function govtOneColours() {
  if (GOVT_ONE && GOVT_ONE.links === LINKS) return GOVT_ONE.map;
  const count = new Map();
  for (const s of U.systems) if (SHOWN.has(s.id)) count.set(s.govt, (count.get(s.govt) || 0) + 1);
  const lesser = (a, b) => { const ca = count.get(a) || 0, cb = count.get(b) || 0; return ca < cb || (ca === cb && a < b) ? a : b; };
  const of = new Map();
  for (const l of LINKS) of.set(l, l.from.govt === l.to.govt ? l.from.govt : lesser(l.from.govt, l.to.govt));
  // the parts of each government: its systems joined by links within it
  const up = new Map(), find = x => { while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); } return x; };
  for (const l of LINKS) for (const s of [l.from, l.to]) if (!up.has(s.id)) up.set(s.id, s.id);
  for (const l of LINKS) if (l.from.govt === l.to.govt) up.set(find(l.from.id), find(l.to.id));
  const at = new Map();
  for (const l of LINKS) for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) { if (!at.has(a.id)) at.set(a.id, { sys: a, list: [] }); at.get(a.id).list.push({ l, other: b }); }
  for (const g of [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || a - b)) {
    // each pair of g's parts, and the systems of others joining them, each with a link to either part
    const via = new Map();
    for (const { sys, list } of at.values()) {
      if (sys.govt === g) continue;
      const parts = new Map();
      for (const { l, other } of list) if (other.govt === g) { const p = find(other.id); if (!parts.has(p)) parts.set(p, l); }
      const ps = [...parts.keys()].sort((a, b) => a - b);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const k = ps[i] + ',' + ps[j];
        if (!via.has(k)) via.set(k, []);
        via.get(k).push([parts.get(ps[i]), parts.get(ps[j])]);
      }
    }
    for (const ways of via.values()) if (ways.length === 1) for (const l of ways[0]) of.set(l, g);
  }
  const map = new Map([...of].map(([l, g]) => [l, linkColor(g)]));
  GOVT_ONE = { links: LINKS, map };
  return map;
}
function jumpColor(j) {
  if (j === Infinity) return 'rgba(125,145,180,0.18)';
  return turbo(jumpT(JUMPS.max > 1 ? (j - 1) / (JUMPS.max - 1) : 0));
}
// The key for the jumps, over the map's corner.
// The key, over the map's corner: for the links by jumps, the dots by a figure, and what is lit.
function renderLegend() {
  const el = $('legend'), parts = [];
  const ramp = (title, t, lo, hi) => `<div>${title}</div><div class="ramp" style="background:linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(f => `${turbo(t(f))} ${f * 100}%`).join(', ')})"></div><div class="ends"><span>${lo}</span><span>${hi}</span></div>`;
  if (LINKS_BY === 'jumps') {
    if (!jumpMap()) parts.push('<div>Select a system to count the jumps from it</div>');
    else parts.push(ramp(`Jumps from ${esc(U.byId.get(jumpSource()).name)}`, jumpT, 1, JUMPS.max));
  }
  const f = DOT_FIGURES[DOTS_BY];
  if (f) { const max = figureMax(f.field); parts.push(ramp(`${f.what}; none in grey`, t => figureT(1 + t * (max - 1), max), 1 + f.unit, max + f.unit)); }
  if (REACH && !jumpMap()) parts.push(`<div>Select a system to light what is within ${REACH} jump${REACH === 1 ? '' : 's'} of it</div>`);
  if (LIGHT !== 'all' && U) {
    const shown = U.systems.filter(s => SHOWN.has(s.id));
    parts.push(`<div>${shown.filter(s => !sysUnlit(s)).length} of ${shown.length} systems lit: ${esc($('litSel').selectedOptions[0].textContent)}</div>`);
  }
  el.hidden = !parts.length;
  el.innerHTML = parts.join('<div class="gap"></div>');
}

/* How the systems' dots are coloured (DOTS_BY): by government (the
   panel's chips keep that whatever the map shows, as there they say which
   government it is), all in one colour, or by a figure of the system's
   record, on the turbo scale from 1 to the most any shown system has, and
   in a dark grey where it is 0 (the maintainer's asking, 29 September
   2026). */
let DOTS_BY = 'govt';
const PLAIN_DOT = '#aeb8c6', NONE_DOT = '#3d434c';
const DOT_FIGURES = {
  interference: { field: 'Interference', what: 'Radar interference', unit: '%' },
  asteroids: { field: 'Asteroids', what: 'Asteroids', unit: '' },
  traffic: { field: 'AvgShips', what: 'Ships on average', unit: '' },
};
let FIGURE_MAX = { links: null };
function figureMax(field) {
  if (FIGURE_MAX.links !== LINKS) FIGURE_MAX = { links: LINKS };
  if (!(field in FIGURE_MAX)) { let m = 0; for (const s of U.systems) if (SHOWN.has(s.id)) m = Math.max(m, s.rec[field] || 0); FIGURE_MAX[field] = m; }
  return FIGURE_MAX[field];
}
const figureT = (v, max) => 0.1 + 0.8 * (max > 1 ? (v - 1) / (max - 1) : 1);
function dotFill(sys) {
  if (DOTS_BY === 'govt') return govtFill(sys.govt);
  const f = DOT_FIGURES[DOTS_BY];
  if (!f) return PLAIN_DOT;
  const v = sys.rec[f.field] || 0;
  return v > 0 ? turbo(figureT(v, figureMax(f.field))) : NONE_DOT;
}

/* Only the systems that pass a test (LIGHT) lit, and the rest faint: what
   their stellars offer (novaSystemServices), or whether they have
   asteroids or radar interference; a link is lit when both its ends are. */
let LIGHT = 'all';
const SERVICES = new WeakMap();
const services = sys => { if (!SERVICES.has(sys)) SERVICES.set(sys, novaSystemServices(U, sys)); return SERVICES.get(sys); };
const LIGHT_TESTS = {
  inhabited: s => services(s).inhabited, uninhabited: s => !services(s).inhabited,
  land: s => services(s).land, commodity: s => services(s).commodity, outfit: s => services(s).outfit,
  shipyard: s => services(s).shipyard, bar: s => services(s).bar,
  asteroids: s => s.rec.Asteroids > 0, interference: s => s.rec.Interference > 0,
};
const sysUnlit = s => LIGHT !== 'all' && !LIGHT_TESTS[LIGHT](s);
const placeUnlit = p => LIGHT !== 'all' && p.ids.every(id => sysUnlit(U.byId.get(id)));

/* Only what is within REACH jumps of the selected system (jumpSource) lit,
   and the rest faint; REACH null lights everything. */
let REACH = null;
const FAINT = 0.15;
function reachMap() { return REACH ? jumpMap() : null; }
function beyond(id) { const m = reachMap(); return !!m && !(m.get(id) <= REACH); }
function linkBeyond(l) { const m = reachMap(); return !!m && !(linkJumps(l, m) <= REACH); }
const placeBeyond = p => p.ids.every(beyond);
// faint: beyond the reach chosen, or not passing the test chosen
const placeFaint = p => placeBeyond(p) || placeUnlit(p);
const linkFaint = l => linkBeyond(l) || sysUnlit(l.from) || sysUnlit(l.to);

/* The shortest way from ROUTE.from to ROUTE.to, in jumps along the shown
   links, as jumpMap counts them, and while the gates are drawn a hypergate's
   or a set wormhole's way as one step too (a random wormhole's is not a
   way to go somewhere; the maintainer's asking, 29 September 2026): the
   systems on it in order, or null where there is none. Kept until the
   route, the links or the gates change. */
let ROUTE = { from: null, to: null };
function routePath() {
  if (ROUTE.from === null || ROUTE.to === null) return null;
  const key = ROUTE.from + '-' + ROUTE.to;
  if (ROUTE.key === key && ROUTE.links === LINKS && ROUTE.gates === (GATE_LINES && GATES)) return ROUTE.path;
  const next = linkNext(), prev = new Map([[ROUTE.from, null]]);
  if (GATE_LINES) for (const w of GATES.ways) { if (!next.has(w.from.id)) next.set(w.from.id, []); next.get(w.from.id).push(w.to.id); }
  for (let q = [ROUTE.from]; q.length && !prev.has(ROUTE.to);) {
    const nq = [];
    for (const a of q) for (const b of next.get(a) || []) if (!prev.has(b)) { prev.set(b, a); nq.push(b); }
    q = nq;
  }
  let path = null;
  if (prev.has(ROUTE.to)) { path = []; for (let s = ROUTE.to; s !== null; s = prev.get(s)) path.push(s); path.reverse(); }
  Object.assign(ROUTE, { key, links: LINKS, gates: GATE_LINES && GATES, path });
  return path;
}
// the route's links, each as 'a-b' both ways round, and its systems
function routeLinks() { const p = routePath(), out = new Set(); if (p) for (let i = 0; i + 1 < p.length; i++) { out.add(p[i] + '-' + p[i + 1]); out.add(p[i + 1] + '-' + p[i]); } return out; }
const onRoute = pl => { const p = routePath(); return !!p && pl.ids.some(id => p.includes(id)); };
function setRoute(from, to) {
  ROUTE = { from, to };
  writeHash(true); renderPanel(); redraw();
}
// The route in the panel: where it goes, jump by jump, or how to finish choosing it.
function routeBlock() {
  if (ROUTE.from === null) return '';
  const clear = '<button data-route-clear>Clear the route</button>';
  if (ROUTE.to === null) return `<div class="route">Route from ${sysLink(ROUTE.from)}: select another system and choose Route here. ${clear}</div>`;
  const p = routePath();
  // a step no hyperspace link makes is a gate's, named by the gate
  const hyper = new Set(LINKS.flatMap(l => [(!l.oneWay || l.forward) && l.from.id + '-' + l.to.id, (!l.oneWay || !l.forward) && l.to.id + '-' + l.from.id]).filter(Boolean));
  const step = (a, b) => { if (hyper.has(a + '-' + b)) return ' › '; const w = GATES.ways.find(v => v.from.id === a && v.to.id === b); return ` › by ${w ? esc(w.gate.name) : 'gate'} › `; };
  const how = p ? `${p.length - 1} step${p.length === 2 ? '' : 's'}: ${p.map((id, i) => (i ? step(p[i - 1], id) : '') + sysLink(id)).join('')}` : `no way there along the links${GATE_LINES ? ' and gates' : ''} shown now`;
  return `<div class="route">Route from ${sysLink(ROUTE.from)} to ${sysLink(ROUTE.to)}, ${how}. ${clear}</div>`;
}

// A path onto the canvas with its corners rounded to radius R: the points
// where it runs straight on are left out first, so that a corner's arc can
// be as long as the pieces either side allow.
function roundedPath(ctx, pts, R) {
  const q = [pts[0]];
  for (let i = 1; i + 1 < pts.length; i++) {
    const a = q[q.length - 1], b = pts[i], c = pts[i + 1];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cr) > 1e-6 * Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y)) q.push(b);
  }
  q.push(pts[pts.length - 1]);
  ctx.moveTo(q[0].x, q[0].y);
  for (let i = 1; i + 1 < q.length; i++) {
    const r = Math.min(R, Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y) / 2, Math.hypot(q[i + 1].x - q[i].x, q[i + 1].y - q[i].y) / 2);
    if (r > 0.5) ctx.arcTo(q[i].x, q[i].y, q[i + 1].x, q[i + 1].y, r); else ctx.lineTo(q[i].x, q[i].y);
  }
  ctx.lineTo(q[q.length - 1].x, q[q.length - 1].y);
}

// A hyperspace link stops at the edge of an open system's disc, which is
// the system's own.
function drawLinks(ctx) {
  const segs = [];
  for (const l of LINKS) {
    const pa = PLACE_OF.get(l.from.id), pb = PLACE_OF.get(l.to.id);
    if (!pa || !pb) continue;
    const pts = linkPoints(l, pa, pb).map(q => { const [x, y] = toScreen(q.x, q.y); return { x, y }; });
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    if (Math.max(...xs) < 0 || Math.min(...xs) > CW || Math.max(...ys) < 0 || Math.min(...ys) > CH) continue;
    // to the disc's edge, less how far out the line starts: from a bar's point, not its middle
    const out = (p, q) => { const [x, y] = toScreen(p.x, p.y); return Math.hypot(q.x - x, q.y - y); };
    const a = Math.max(0, pa.rho * CAM.s * openness(pa) - out(pa, pts[0])), b = Math.max(0, pb.rho * CAM.s * openness(pb) - out(pb, pts[pts.length - 1]));
    const cut = trimPath(pts, a, b);
    if (cut) segs.push({ l, pts: cut });
  }
  ctx.lineWidth = 1 + subMix() + (LINKS_BY === 'plain' ? 0 : 0.5);
  ctx.lineJoin = 'round';
  // corners rounded, as the maintainer asked: an arc of up to 0.7 of a grid step, never more
  // than half of either piece it joins, coming in as the subway map does
  const R = LAYOUT.sub ? 0.7 * (LAYOUT.base ? LAYOUT.base.layout.step + (LAYOUT.sub.layout.step - LAYOUT.base.layout.step) * LAYOUT.mix : LAYOUT.sub.layout.step * LAYOUT.mix) * CAM.s : 0;
  const trace = s => roundedPath(ctx, s.pts, R);
  const jumps = LINKS_BY === 'jumps' ? jumpMap() : null;
  const paint = segs => {
    if (LINKS_BY === 'govt') {
      for (const s of segs) {
        const a = s.pts[0], b = s.pts[s.pts.length - 1], g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, linkColor(s.l.from.govt)); g.addColorStop(1, linkColor(s.l.to.govt));
        ctx.strokeStyle = g; ctx.beginPath(); trace(s); ctx.stroke();
      }
    } else if (LINKS_BY === 'govtOne') {
      const cs = govtOneColours(), by = new Map();
      for (const s of segs) { const c = cs.get(s.l) || 'rgba(125,145,180,0.55)'; if (!by.has(c)) by.set(c, []); by.get(c).push(s); }
      for (const [c, list] of by) { ctx.strokeStyle = c; ctx.beginPath(); for (const s of list) trace(s); ctx.stroke(); }
    } else if (jumps) {
      const by = new Map();
      for (const s of segs) { const c = jumpColor(linkJumps(s.l, jumps)); if (!by.has(c)) by.set(c, []); by.get(c).push(s); }
      for (const [c, list] of by) { ctx.strokeStyle = c; ctx.beginPath(); for (const s of list) trace(s); ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(125,145,180,0.55)';
      ctx.beginPath();
      for (const s of segs) trace(s);
      ctx.stroke();
    }
  };
  // beyond the reach chosen, faint, under the rest
  const far = new Set(reachMap() || LIGHT !== 'all' ? segs.filter(s => linkFaint(s.l)) : []);
  if (far.size) { ctx.globalAlpha = FAINT; paint([...far]); ctx.globalAlpha = 1; }
  paint(segs.filter(s => !far.has(s)));
  // the route, over everything
  const route = routeLinks();
  if (route.size) {
    ctx.lineWidth = 3 + 1.5 * subMix(); ctx.strokeStyle = '#ffcf4a'; ctx.beginPath();
    for (const s of segs) if (route.has(s.l.from.id + '-' + s.l.to.id)) trace(s);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  // A link the other end does not return: an arrowhead half way, pointing where it arrives.
  ctx.fillStyle = 'rgba(125,145,180,0.9)';
  for (const s of segs) if (s.l.oneWay) {
    ctx.globalAlpha = far.has(s) ? FAINT : 1;
    arrowHalfway(ctx, s.l.forward ? s.pts : s.pts.slice().reverse());
  }
  ctx.globalAlpha = 1;
}
// An arrowhead half way along a path on the screen, pointing to its end.
function arrowHalfway(ctx, pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let half = total / 2, i = 1;
  for (; i < pts.length - 1; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (half <= d) break; half -= d; }
  const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y) || 1;
  const ang = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
  const mx = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * half / d, my = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * half / d;
  ctx.beginPath();
  ctx.moveTo(mx + 6 * Math.cos(ang), my + 6 * Math.sin(ang));
  ctx.lineTo(mx - 5 * Math.cos(ang - 0.5), my - 5 * Math.sin(ang - 0.5));
  ctx.lineTo(mx - 5 * Math.cos(ang + 0.5), my - 5 * Math.sin(ang + 0.5));
  ctx.fill();
}

/* Hypergates and wormholes (Gates in Map options, on at first; the
   maintainer's asking, 29 September 2026: anything leading from one system
   to another). A gate's way to another system is drawn straight and dashed
   over the hyperspace links, a hypergate's in teal and a wormhole's in
   violet, with an arrowhead where it runs one way. A random wormhole goes
   to any other (novaShownGates), which drawn at once would be a web over
   the galaxy, so its ways are drawn only from the selected system, or the
   one you are in, finer and fainter. Beside each system's dot, a mark for
   each kind of gate it has, hollow for a gate that leads nowhere. */
let GATE_LINES = true;
let GATES_DRAWN = { links: 0, random: 0 };   // the ways the last draw put on the screen, for page_check
const GATE_COLOR = { hypergate: '#4fd1c5', wormhole: '#c08cff' };
function randomGateWays() {
  const src = jumpSource(), p = src !== null ? PLACE_OF.get(src) : null;
  if (!p || !GATES.random.some(r => r.enter && PLACE_OF.get(r.sys.id) === p)) return [];
  const seen = new Set([p]), out = [];
  for (const r of GATES.random) { const q = PLACE_OF.get(r.sys.id); if (q && !seen.has(q)) { seen.add(q); out.push([p, q]); } }
  return out;
}
function drawGates(ctx) {
  GATES_DRAWN = { links: 0, random: 0 };
  if (!GATE_LINES) return;
  const way = (pa, pb) => {
    const [ax, ay] = toScreen(pa.x, pa.y), [bx, by] = toScreen(pb.x, pb.y);
    if (Math.max(ax, bx) < 0 || Math.min(ax, bx) > CW || Math.max(ay, by) < 0 || Math.min(ay, by) > CH) return null;
    return trimPath([{ x: ax, y: ay }, { x: bx, y: by }], pa.rho * CAM.s * openness(pa), pb.rho * CAM.s * openness(pb));
  };
  ctx.save();
  ctx.lineCap = 'round';
  // a random wormhole's ways, under the rest
  ctx.setLineDash([2, 4]); ctx.lineWidth = 1; ctx.strokeStyle = GATE_COLOR.wormhole;
  for (const [pa, pb] of randomGateWays()) {
    const pts = way(pa, pb);
    if (!pts) continue;
    ctx.globalAlpha = placeFaint(pb) ? FAINT : 0.7;
    GATES_DRAWN.random++;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
  }
  ctx.setLineDash([7, 4]); ctx.lineWidth = 1.5 + 0.5 * subMix();
  const route = routeLinks(), onRouteWays = [];
  for (const l of GATES.links) {
    const pa = PLACE_OF.get(l.from.id), pb = PLACE_OF.get(l.to.id);
    const pts = pa && pb && pa !== pb && way(pa, pb);
    if (!pts) continue;
    ctx.globalAlpha = placeFaint(pa) || placeFaint(pb) ? FAINT : 1;
    GATES_DRAWN.links++;
    ctx.strokeStyle = ctx.fillStyle = GATE_COLOR[l.kind];
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
    if (l.oneWay) arrowHalfway(ctx, l.forward ? pts : pts.slice().reverse());
    if (route.has(l.from.id + '-' + l.to.id)) { onRouteWays.push(pts); }
  }
  // the route's gate steps, in the route's gold
  if (onRouteWays.length) {
    ctx.setLineDash([7, 4]); ctx.globalAlpha = 1; ctx.lineWidth = 3 + 1.5 * subMix(); ctx.strokeStyle = '#ffcf4a';
    ctx.beginPath(); for (const pts of onRouteWays) { ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); } ctx.stroke();
  }
  ctx.restore();
}
// The marks beside a system's dot for the gates in it, above it to the left.
// A place's gates, each a small dot beside the system's in the gate's own
// direction within its system, as its pocket is (stellarPos): filled where
// it leads somewhere, a ring where it does not. Dots less than 0.45
// radians apart are spread.
function drawGateMarks(ctx, d, r) {
  const seen = new Map();
  for (const id of d.p.ids) {
    const sys = U.byId.get(id);
    for (const [spob, k] of GATE_SYS.get(id) || []) {
      if (seen.has(spob.id) && !seen.get(spob.id).k.endsWith('-dead')) continue;
      const [x, y] = stellarPos(sys, spob);
      seen.set(spob.id, { k, a: x || y ? Math.atan2(y, x) : -Math.PI / 2 });
    }
  }
  if (!seen.size) return;
  const marks = [...seen.values()].sort((m, n) => m.a - n.a), gap = 0.45;
  for (let i = 1; i < marks.length; i++) if (marks[i].a - marks[i - 1].a < gap) marks[i].a = marks[i - 1].a + gap;
  const R = r + 3.5;
  for (const { k, a } of marks) {
    const c = GATE_COLOR[k.replace('-dead', '')];
    ctx.beginPath(); ctx.arc(d.x + R * Math.cos(a), d.y + R * Math.sin(a), 2, 0, Math.PI * 2);
    if (k.endsWith('-dead')) { ctx.strokeStyle = c; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); }
  }
}

/* A place the subway map draws as a bar, where many of its lines leave one
   way (nova-subway.js, subwayBars): its two ends on the screen, slid out of
   its dot as LAYOUT.mix goes to 1, or from one map's bar to another's; null for a dot. */
// Whether a place the subway map lays out as a bar (subwayBars) is drawn as one: only while the
// links shown at it could not all leave one point within 45 degrees of their true directions. The
// layout decides it once for every link of every version, so that the bits do not change it; the
// maintainer found Age of the Council's Kelin a bar with two links shown, its other three hidden
// (30 September 2026). Drawn as a dot, its lines run on from the bar's points into the dot.
let BAR_KEPT = null;
// how many places the links shown at p go to
function placeLinks(p) { barKept(p); return BAR_KEPT.ways.has(p) ? BAR_KEPT.ways.get(p).size : 0; }
function barKept(p) {
  if (!BAR_KEPT || BAR_KEPT.places !== PLACES || BAR_KEPT.links !== LINKS) {
    const ways = new Map();
    const way = (a, b) => { if (!ways.has(a)) ways.set(a, new Map()); ways.get(a).set(b, Math.atan2(b.ty - a.ty, b.tx - a.tx)); };
    for (const l of LINKS) {
      const pa = PLACE_OF.get(l.from.id), pb = PLACE_OF.get(l.to.id);
      if (pa && pb && pa !== pb) { way(pa, pb); way(pb, pa); }
    }
    const kept = new Set();
    for (const [q, m] of ways) {
      const A = [...m.values()].sort((x, y) => x - y);
      if (A.length >= 4 && !subwayPortFit(A, subwayBarPorts(0, 1), Math.PI / 4)) kept.add(q);
    }
    BAR_KEPT = { places: PLACES, links: LINKS, kept, ways };
  }
  return BAR_KEPT.kept.has(p);
}
function barEnds(p) {
  if (!barKept(p)) return null;
  const m = LAYOUT.mix, b = m > 0 && LAYOUT.sub && LAYOUT.sub.bar(p.tx, p.ty), o = LAYOUT.base && LAYOUT.base.bar(p.tx, p.ty);
  if (!b && !o) return null;
  // each end as far from the place as the map sliding in has it, and the one sliding out
  const end = k => toScreen(p.x + (b ? (b[k].x - p.sx) * m : 0) + (o ? (o[k].x - p.bx) * (1 - m) : 0),
                            p.y + (b ? (b[k].y - p.sy) * m : 0) + (o ? (o[k].y - p.by) * (1 - m) : 0));
  const [x0, y0] = end('a'), [x1, y1] = end('b');
  return { x0, y0, x1, y1 };
}
// A place's mark as a path: a dot of radius r, or its bar as a capsule r across its half.
function markPath(ctx, d, r) {
  const e = barEnds(d.p);
  ctx.beginPath();
  if (!e) { ctx.arc(d.x, d.y, r, 0, Math.PI * 2); return; }
  const a = Math.atan2(e.y1 - e.y0, e.x1 - e.x0);
  ctx.arc(e.x1, e.y1, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.arc(e.x0, e.y0, r, a + Math.PI / 2, a + 3 * Math.PI / 2);
  ctx.closePath();
}
function drawDots(ctx) {
  const r = systemRadius(), dimOther = VIEW.govt !== null;
  ctx.lineWidth = 1;
  for (const d of DRAWN) {
    if (d.t >= 1) continue;
    ctx.globalAlpha = (1 - d.t) * (dimOther && d.sys.govt !== VIEW.govt ? 0.25 : 1) * (placeFaint(d.p) ? FAINT : 1);
    // the mark itself, unless the systems are drawn not at all (the maintainer found the dots in the
    // way of the lines on a big galaxy zoomed out, 30 September 2026); the rings round it are drawn
    // either way. As metro stations (the maintainer's asking, the same day): white, a small stop on a
    // line, and where three links or more meet a larger one in a ring the colour of the background,
    // so that the lines stop short of it
    if (SYS_STYLE === 'dots') {
      markPath(ctx, d, r);
      ctx.fillStyle = dotFill(d.sys);
      ctx.fill();
      ctx.strokeStyle = 'rgba(225,232,242,0.75)';
      ctx.stroke();
    } else if (SYS_STYLE === 'metro') {
      const busy = placeLinks(d.p) >= 3;
      markPath(ctx, d, busy ? r + 0.5 : Math.max(2, 0.6 * r));
      ctx.fillStyle = '#f2f4f8'; ctx.fill();
      ctx.strokeStyle = '#04060a'; ctx.lineWidth = busy ? 2.5 : 1.5; ctx.stroke(); ctx.lineWidth = 1;
    }
    // a system on the route ringed in the route's gold
    if (onRoute(d.p)) { markPath(ctx, d, r + 2.5); ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
    if (SHOW_MODE === 'all' && d.sys.versions.length > 1) {
      markPath(ctx, d, r + 3);
      ctx.strokeStyle = 'rgba(232,184,106,0.8)'; ctx.stroke();
    }
    if (GATE_LINES) drawGateMarks(ctx, d, r);
    const story = storyPlaces();
    if (story && story.has(d.p)) { ctx.globalAlpha = 1 - d.t; markPath(ctx, d, r + 5); ctx.strokeStyle = '#9fe870'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1; }
  }
  ctx.globalAlpha = 1;
}

// A place's stellars on the screen, those in pockets no wider than 1.7
// times the pocket's radius.
function stellarBoxes(d) {
  const sys = d.sys, k = kOf(sys), g = sysGeo(sys), min = Math.min(MIN_STELLAR, d.D / 6), out = [];
  for (const id of sys.stellars) {
    const sp = U.stellars.get(id), img = stellarSprite(sp);
    const w0 = img ? img.width : 80, h0 = img ? img.height : 80;
    let w = w0 * k * CAM.s, h = h0 * k * CAM.s;
    if (!g.near.has(id)) { const cap = 1.7 * POCKET.r * g.R * k * CAM.s; if (Math.max(w, h) > cap) { const q = cap / Math.max(w, h); w *= q; h *= q; } }
    if (Math.max(w, h) < min) { const q = min / Math.max(w, h); w *= q; h *= q; }
    const [px, py] = stellarPos(sys, sp), [x, y] = toScreen(d.p.x + k * px, d.p.y + k * py);
    out.push({ sp, img, x, y, w, h });
  }
  return out;
}

function drawStellars(ctx, d, cur) {
  const selId = VIEW.sel && VIEW.sel.kind === 'stellar' ? VIEW.sel.id : null;
  const hoverId = VIEW.hover && VIEW.hover.kind === 'stellar' ? VIEW.hover.id : null;
  const plan = stellarNamePlan(d.sys), z = kOf(d.sys) * CAM.s;
  ctx.font = '12px ' + font();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const b of stellarBoxes(d)) {
    if (b.x + b.w / 2 < -60 || b.y + b.h / 2 < -30 || b.x - b.w / 2 > CW + 60 || b.y - b.h / 2 > CH + 30) continue;
    ctx.globalAlpha = d.t;
    if (b.img) {
      ctx.imageSmoothingEnabled = b.w < b.img.width;
      ctx.drawImage(stellarImage(b.sp, b.img), b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    } else {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(160,175,200,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (b.sp.id === selId) {
      ctx.strokeStyle = '#86b6ff'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x - b.w / 2 - 4, b.y - b.h / 2 - 4, b.w + 8, b.h + 8);
      ctx.lineWidth = 1;
    }
    const special = b.sp.id === selId || b.sp.id === hoverId;
    const a = special ? d.t : z >= plan.get(b.sp.id) ? clampNum((d.t - 0.6) / 0.4, 0, 1) : 0;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = special ? '#fff' : 'rgba(210,218,230,0.85)';
    ctx.fillText(b.sp.name, b.x, b.y + b.h / 2 + 4);
    LABELS_DRAWN.stellars++;
  }
  ctx.textAlign = 'start';
  ctx.globalAlpha = 1;
}

/* The system names, placed once for the map as it stands (nova-labels.js):
   each name's side of its dot, right, left, above or below, and the zoom it
   is shown from, the systems with the most links first, two pixels clear of
   other names and three of other dots. So as you zoom in
   names come and stay, and none goes, moves or is drawn over another name
   or a dot; the maintainer wanted names not to come and go one by one (28
   September 2026), and the published way to that is this. On the map with
   room for names, every name from the zoom that makes its room 7 pixels.
   Worked out again when the places change, and on a subway map once it has
   slid all the way in or out. */
let NAME_PLAN = null;
const dotRadius = s => clampNum(1.6 + s * 1.9, 3, 8), DOT_BREAKS = [(3 - 1.6) / 1.9, (8 - 1.6) / 1.9];
const NAME_SIDES = (r, w) => [{ x: r + 3, y: -7 }, { x: -r - 5 - w, y: -7 }, { x: -w / 2, y: -r - 17 }, { x: -w / 2, y: r + 3 }];
function namePlan() {
  if (namesInRoom()) return { room: 7 / (0.72 * LAYOUT.sub.layout.step), side: new Map(), from: new Map() };
  if (NAME_PLAN && NAME_PLAN.places === PLACES && (NAME_PLAN.mix === LAYOUT.mix || (LAYOUT.mix > 0 && LAYOUT.mix < 1))) return NAME_PLAN;
  CTX.font = '11.5px ' + font();
  const links = new Map();
  for (const l of LINKS) for (const s of [l.from, l.to]) { const p = PLACE_OF.get(s.id); if (p) links.set(p, (links.get(p) || 0) + 1); }
  const list = PLACES.map(p => ({ p, w: CTX.measureText(U.byId.get(p.ids[0]).name).width, n: links.get(p) || 0 }))
    .sort((a, b) => b.n - a.n || a.p.y - b.p.y || a.p.x - b.p.x);
  const items = list.map(({ p, w }) => ({ at: { x: p.x, y: p.y }, near: w + 25, breaks: DOT_BREAKS,
    sides: [0, 1, 2, 3].map(k => s => { const o = NAME_SIDES(dotRadius(s), w)[k], x = p.x * s + o.x, y = p.y * s + o.y; return { x0: x - 1, x1: x + w + 3, y0: y - 1, y1: y + 15 }; }) }));
  const marks = list.map(({ p }, i) => ({ owner: i, at: { x: p.x, y: p.y }, near: 11, breaks: DOT_BREAKS,
    box: s => { const r = dotRadius(s) + 3; return { x0: p.x * s - r, x1: p.x * s + r, y0: p.y * s - r, y1: p.y * s + r }; } }));
  const got = labelRanges(items, marks), side = new Map(), from = new Map();
  list.forEach(({ p }, i) => { side.set(p, got[i].side); from.set(p, got[i].from); });
  return (NAME_PLAN = { places: PLACES, mix: LAYOUT.mix, side, from });
}
/* The stellars' names, placed the same way within each system: each under
   its stellar from one zoom of the system's own (the scale readout's
   "system at"), those that can be landed on first, then the larger, clear
   of every stellar and of the names shown before them, and drawn once the
   stellars are most of the way in. Kept per system until other files are
   opened. */
const STELLAR_NAMES = new Map();
function stellarNamePlan(sys) {
  if (STELLAR_NAMES.has(sys.id)) return STELLAR_NAMES.get(sys.id);
  CTX.font = '12px ' + font();
  const R = sysGeo(sys).R;
  const list = sys.stellars.map(id => U.stellars.get(id)).map(sp => { const img = stellarSprite(sp); return { sp, w0: img ? img.width : 80, h0: img ? img.height : 80, tw: CTX.measureText(sp.name).width }; })
    .sort((a, b) => (b.sp.Flags & 1) - (a.sp.Flags & 1) || b.w0 * b.h0 - a.w0 * a.h0 || a.sp.id - b.sp.id);
  // a stellar's size on the screen at system zoom z, as stellarBoxes draws it, and where that changes course
  const size = (it, z) => { const min = Math.min(MIN_STELLAR, R * z / 3); let w = it.w0 * z, h = it.h0 * z; if (Math.max(w, h) < min) { const q = min / Math.max(w, h); w *= q; h *= q; } return [w, h]; };
  const breaksOf = it => [3 * MIN_STELLAR / R, MIN_STELLAR / Math.max(it.w0, it.h0)];
  for (const it of list) [it.x, it.y] = stellarPos(sys, it.sp);
  const items = list.map(it => ({ at: { x: it.x, y: it.y }, near: Infinity, breaks: breaksOf(it),
    sides: [z => { const h = size(it, z)[1], x = it.x * z, y = it.y * z + h / 2 + 4; return { x0: x - it.tw / 2 - 1, x1: x + it.tw / 2 + 1, y0: y, y1: y + 14 }; }] }));
  const marks = list.map((it, i) => ({ owner: i, at: { x: it.x, y: it.y }, near: Infinity, breaks: breaksOf(it),
    box: z => { const [w, h] = size(it, z), x = it.x * z, y = it.y * z; return { x0: x - w / 2, x1: x + w / 2, y0: y - h / 2, y1: y + h / 2 }; } }));
  const got = labelRanges(items, marks), plan = new Map(list.map((it, i) => [it.sp.id, got[i].from]));
  STELLAR_NAMES.set(sys.id, plan);
  return plan;
}

// Names: each from the zoom namePlan gives it, on its side of the dot and
// pushed out with the disc as the system opens; the selected and hovered at
// any zoom; none for the system you are in, which the bar names.
// A system's name at (x, y), outlined first where names are in metro style.
function nameText(ctx, text, x, y, special) {
  if (PLAIN_NAMES) {
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#04060a';
    ctx.strokeText(text, x, y);
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = special || PLAIN_NAMES ? '#ffffff' : 'rgba(210,218,230,0.85)';
  ctx.fillText(text, x, y);
}
function drawSystemLabels(ctx) {
  const r = systemRadius(), dimOther = VIEW.govt !== null, cur = curPlace(), plan = namePlan();
  const weight = PLAIN_NAMES ? '600 ' : '';
  const selId = VIEW.sel && VIEW.sel.kind === 'system' ? VIEW.sel.id : null;
  const hoverId = VIEW.hover && VIEW.hover.kind === 'system' ? VIEW.hover.id : null;
  const isSel = d => d.p.ids.includes(selId), isHover = d => d.p.ids.includes(hoverId);
  ctx.font = weight + '11.5px ' + font();
  ctx.textBaseline = 'middle';
  const order = DRAWN.slice().sort((a, b) => isSel(b) - isSel(a) || isHover(b) - isHover(a));
  // On the map with room for names, each in its room, its letters 0.72 of a grid step high,
  // once that is 7 pixels, and narrowed if this screen's letters are wider than the room.
  const room = namesInRoom() ? 0.72 * LAYOUT.sub.layout.step * CAM.s : 0;
  for (const d of order) {
    if (d.p === cur) continue;
    const special = isSel(d) || isHover(d);
    const jumps = LINKS_BY === 'jumps' && isHover(d) && !isSel(d) ? jumpsTo(d.sys.id) : null;
    if (room >= 7 && d.t < 0.5 && jumps === null) {
      if (!special && !NAMES) continue;
      const nm = LAYOUT.sub.name(d.p.tx, d.p.ty);
      if (nm) {
        const [sx, sy] = toScreen(nm.x, nm.y), fit = nm.w * CAM.s;
        // a name the lines left little room is smaller (nova-subway.js, subwayLabels), but for names
        // in metro style, which are one size
        let size = room * (PLAIN_NAMES ? 1 : nm.size || 1);
        ctx.font = weight + size + 'px ' + font();
        const w = ctx.measureText(d.sys.name).width;
        if (w > fit && !PLAIN_NAMES) { size *= fit / w; ctx.font = size + 'px ' + font(); }
        ctx.textAlign = nm.align;
        ctx.globalAlpha = (dimOther && d.sys.govt !== VIEW.govt && !special ? 0.3 : 1) * (placeFaint(d.p) && !special ? FAINT : 1);
        // a name the lines put more than three quarters of a grid step from its system has a thin line
        // to it, as maps lead a name to its place (the maintainer found Arcturus's unreadable so far
        // off, 30 September 2026)
        {
          const tw = ctx.measureText(d.sys.name).width, x0 = nm.align === 'left' ? sx : nm.align === 'right' ? sx - tw : sx - tw / 2;
          const qx = clampNum(d.x, x0, x0 + tw), qy = clampNum(d.y, sy - size / 2, sy + size / 2), far = Math.hypot(qx - d.x, qy - d.y);
          if (far > 0.75 * room / 0.72) {
            const ux = (qx - d.x) / far, uy = (qy - d.y) / far, r0 = r + 2;
            ctx.beginPath(); ctx.moveTo(d.x + ux * r0, d.y + uy * r0); ctx.lineTo(qx - ux * 3, qy - uy * 3);
            ctx.strokeStyle = special ? 'rgba(255,255,255,0.7)' : 'rgba(210,218,230,0.5)'; ctx.lineWidth = 1; ctx.stroke();
          }
        }
        nameText(ctx, d.sys.name, sx, sy, special);
        { const tw = ctx.measureText(d.sys.name).width, x0 = nm.align === 'left' ? sx : nm.align === 'right' ? sx - tw : sx - tw / 2; NAME_BOXES.push({ x0, x1: x0 + tw, y0: sy - size / 2, y1: sy + size / 2 }); }
        LABELS_DRAWN.systems++;
        ctx.textAlign = 'start';
        ctx.font = weight + '11.5px ' + font();
        continue;
      }
    }
    const shown = NAMES && (plan.room !== undefined ? CAM.s >= plan.room && d.t >= 0.5 : CAM.s >= plan.from.get(d.p));
    if (!special && !shown) continue;
    const name = jumps === null ? d.sys.name : `${d.sys.name} · ${jumps === Infinity ? 'no way there' : jumps === 1 ? '1 jump' : jumps + ' jumps'}`;
    const w = ctx.measureText(name).width;
    const k = plan.side.get(d.p) || 0, o = NAME_SIDES(r, w)[k], out = Math.max(0, d.t * d.D / 2 - r);
    const x = d.x + o.x + (k === 0 ? out : k === 1 ? -out : 0), y = d.y + o.y + (k === 2 ? -out : k === 3 ? out : 0);
    ctx.globalAlpha = (dimOther && d.sys.govt !== VIEW.govt && !special ? 0.3 : 1) * (placeFaint(d.p) && !special ? FAINT : 1);
    nameText(ctx, name, x, y + 7, special);
    LABELS_DRAWN.systems++;
    LABELS_DRAWN.boxes.push({ id: d.sys.id, side: k, special, x, y, w: w + 2, h: 14 });
    NAME_BOXES.push({ x0: x, x1: x + w, y0: y, y1: y + 14 });
  }
  ctx.globalAlpha = 1;
}

function drawSelection(ctx) {
  const sel = VIEW.sel;
  if (sel && sel.kind === 'system' && PLACE_OF.has(sel.id)) {
    const p = PLACE_OF.get(sel.id), [x, y] = toScreen(p.x, p.y);
    if (openness(p) < 0.5) markPath(ctx, { p, x, y }, systemRadius() + 5);
    else { ctx.beginPath(); ctx.arc(x, y, p.rho * CAM.s + 3, 0, Math.PI * 2); }
    ctx.strokeStyle = '#86b6ff'; ctx.lineWidth = 2; ctx.stroke();
  }
  if (sel && sel.kind === 'nebula') {
    const n = nebRect(U.nebulae.find(v => v.id === sel.id)), [x, y] = toScreen(n.x, n.y);
    ctx.strokeStyle = '#86b6ff'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, n.w * CAM.s, n.h * CAM.s);
    ctx.setLineDash([]);
  }
}

function safeTest(text) { try { return ncbTest(text, STATE); } catch (e) { return true; } }

// Off the screen, in the system you are in: a mark at the edge, in the
// stellar's direction, with its distance in the system's units.
function edgeMarks(d) {
  const out = [], pad = 16, k = kOf(d.sys), vx = (CAM.x - d.p.x) / k, vy = (CAM.y - d.p.y) / k;
  for (const id of d.sys.stellars) {
    const sp = U.stellars.get(id), [px, py] = stellarPos(d.sys, sp), [x, y] = toScreen(d.p.x + k * px, d.p.y + k * py);
    if (x >= 0 && y >= 0 && x <= CW && y <= CH) continue;
    const cx = CW / 2, cy = CH / 2, dx = x - cx, dy = y - cy;
    const q = Math.min((cx - pad) / Math.abs(dx || 1e-9), (cy - pad) / Math.abs(dy || 1e-9));
    out.push({ id, name: sp.name, x: cx + dx * q, y: cy + dy * q, ang: Math.atan2(dy, dx), d: Math.hypot(sp.xPos - vx, sp.yPos - vy) });
  }
  return out;
}
function drawEdgeMarks(ctx, d) {
  const selId = VIEW.sel && VIEW.sel.kind === 'stellar' ? VIEW.sel.id : null;
  const hoverId = VIEW.hover && VIEW.hover.kind === 'stellar' ? VIEW.hover.id : null;
  ctx.font = '12px ' + font();
  ctx.textBaseline = 'middle';
  for (const m of edgeMarks(d)) {
    ctx.save();
    ctx.translate(m.x, m.y); ctx.rotate(m.ang);
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fillStyle = m.id === selId ? '#86b6ff' : 'rgba(200,210,225,0.8)'; ctx.fill();
    ctx.restore();
    ctx.textAlign = m.x > CW / 2 ? 'right' : 'left';
    ctx.fillStyle = m.id === hoverId || m.id === selId ? '#fff' : 'rgba(200,210,225,0.8)';
    const tx = m.x + (m.x > CW / 2 ? -12 : 12), ty = clampNum(m.y, 12, CH - 12);
    ctx.fillText(`${m.name} ${Math.round(m.d).toLocaleString()}`, tx, ty);
  }
  ctx.textAlign = 'start';
}

/* ---- what is under a point ---------------------------------------------- */

// A stellar, in a place open at least half way, or an edge mark.
function stellarAt(sx, sy) {
  const cur = curPlace(), cd = cur && DRAWN.find(d => d.p === cur);
  if (cd) for (const m of edgeMarks(cd)) if (Math.hypot(sx - m.x, sy - m.y) < 16) return { sp: U.stellars.get(m.id), sys: cd.sys };
  let best = null, bd = Infinity;
  for (const d of DRAWN) {
    if (d.t < 0.5) continue;
    for (const b of stellarBoxes(d)) {
      const rx = Math.max(b.w / 2, 12), ry = Math.max(b.h / 2, 12);
      if (Math.abs(sx - b.x) > rx || Math.abs(sy - b.y) > ry) continue;
      const dd = (sx - b.x) ** 2 + (sy - b.y) ** 2;
      if (dd < bd) { bd = dd; best = { sp: b.sp, sys: d.sys }; }
    }
  }
  return best;
}
// A system: its dot while it is mostly a dot, and failing that the disc of
// one mostly open, other than the one you are in.
function systemAt(sx, sy) {
  const cur = curPlace(), r = Math.max(systemRadius() + 4, 11);
  let best = null, bd = r * r;
  for (const d of DRAWN) {
    // to a bar, the nearest point of it
    const e = d.t < 0.5 && barEnds(d.p);
    let dd = (d.x - sx) ** 2 + (d.y - sy) ** 2;
    if (e) { const vx = e.x1 - e.x0, vy = e.y1 - e.y0, t = clampNum(((sx - e.x0) * vx + (sy - e.y0) * vy) / (vx * vx + vy * vy || 1), 0, 1); dd = (e.x0 + t * vx - sx) ** 2 + (e.y0 + t * vy - sy) ** 2; }
    if (d.t < 0.5 && dd <= bd) { bd = dd; best = d.sys; }
  }
  if (best) return best;
  bd = Infinity;
  for (const d of DRAWN) {
    const dd = (d.x - sx) ** 2 + (d.y - sy) ** 2;
    if (d.t >= 0.5 && d.p !== cur && dd <= (d.D / 2) ** 2 && dd < bd) { bd = dd; best = d.sys; }
  }
  return best;
}
function nebulaAt(sx, sy) {
  if (!NEBULAE) return null;
  const [x, y] = toWorld(sx, sy);
  return U.nebulae.find(n => { const r = nebRect(n); return (SHOW_MODE === 'all' || safeTest(n.activeOn)) && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h; }) || null;
}

/* ---- moving ---------------------------------------------------------------- */

// grimoire's curves: 'in' gathers speed all the way (a fall, still
// quickening as the black closes over), 'out' starts fast and settles (a
// place opening out of nothing), and the default eases both ends.
function ease(t, curve) {
  return curve === 'in' ? t * t * t : curve === 'out' ? 1 - (1 - t) ** 3 : t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
function animate(ms, step, curve) {
  return new Promise(res => {
    const t0 = performance.now();
    const f = now => {
      const t = clampNum((now - t0) / ms, 0, 1);
      step(ease(t, curve));
      draw();
      if (t < 1) requestAnimationFrame(f); else res();
    };
    requestAnimationFrame(f);
  });
}
function camTween(to) {
  const from = { ...CAM };
  return e => {
    CAM.x = from.x + (to.x - from.x) * e;
    CAM.y = from.y + (to.y - from.y) * e;
    CAM.s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e);
  };
}
/* grimoire's atlasZoomOnto, made general: the scale goes geometrically
   from where it is to `to`'s, while the galaxy point (hx, hy) slides in a
   straight line from where it is on the screen to where `to` has it. With
   the point in the middle of `to`, it is a zoom onto the point. */
function zoomVia(hx, hy, to, ms, curve, also) {
  const s0 = CAM.s, [px, py] = toScreen(hx, hy), [qx, qy] = toScreen(hx, hy, to);
  return animate(ms, e => {
    const s = s0 * Math.pow(to.s / s0, e), cx = px + (qx - px) * e, cy = py + (qy - py) * e;
    CAM.s = s; CAM.x = hx - (cx - CW / 2) / s; CAM.y = hy - (cy - CH / 2) / s;
    if (also) also(e);
  }, curve);
}
/* A long way at once -- a link to a system across the galaxy, a search --
   goes by van Wijk and Nuij's smooth zoom (2003), the path d3's
   interpolateZoom takes: out as far as the distance needs, across, and in
   again. A view is its middle and w, the shorter side in galaxy units. */
function zoomPath(a, b) {
  // where a is now: a is often CAM itself, which the flight moves
  const ax = a.x, ay = a.y;
  const m = Math.min(CW, CH), w0 = m / a.s, w1 = m / b.s, R = Math.SQRT2;
  const dx = b.x - ax, dy = b.y - ay, d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const S = Math.log(w1 / w0) / R;
    return { S, at: t => [ax, ay, w0 * Math.exp(R * t * S)] };
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1), b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / R;
  return { S, at: t => {
    const s = t * S, u = w0 / (2 * d1) * (Math.cosh(r0) * Math.tanh(R * s + r0) - Math.sinh(r0));
    return [ax + u * dx, ay + u * dy, w0 * Math.cosh(r0) / Math.cosh(R * s + r0)];
  } };
}
// To a view: a zoom onto it when its middle is on the screen, else the
// long way.
async function flyTo(to, quick) {
  to = { x: to.x, y: to.y, s: to.s };
  if (!quick) {
    const [px, py] = toScreen(to.x, to.y);
    if (px >= 0 && py >= 0 && px <= CW && py <= CH) await zoomVia(to.x, to.y, to, Math.round(TUNE.animMs * 0.7));
    else {
      const path = zoomPath(CAM, to), m = Math.min(CW, CH);
      await animate(clampNum(Math.abs(path.S) * 400, 700, 1600), e => { const [x, y, w] = path.at(e); CAM.x = x; CAM.y = y; CAM.s = m / w; });
    }
  }
  Object.assign(CAM, to);
  redraw();
}
// A move of its own, not part of going somewhere: the Fit button, a
// nebula from the panel, a stellar off the edge.
async function glide(to) {
  if (MOVING) return;
  MOVING = true;
  try { await flyTo(to, matchMedia('(prefers-reduced-motion: reduce)').matches); } finally { MOVING = false; }
  redraw();
}

/* Onto a stellar, as grimoire falls into a cave mouth: the view closes on
   it, gathering speed, until its sprite is wider than the screen and the
   screen has gone black, and the landing page comes up out of the black.
   The rise is the fall run backwards, opening out onto the view you left. */
function fallView(sys, sp) {
  const [x, y] = stellarWorld(sys, sp), img = stellarSprite(sp);
  const w0 = img ? Math.max(img.width, img.height) : 80;
  return { x, y, s: 1.3 * Math.max(CW, CH) / (w0 * kOf(sys)) };
}
function fadeTo(o) { $('fade').style.opacity = String(clampNum(o, 0, 1)); }
async function rise(quick) {
  const sys = U.byId.get(VIEW.sys), sp = U.stellars.get(VIEW.stellar);
  const back = VIEW.back || systemView(sys);
  $('planet').classList.remove('on');
  $('stage').classList.remove('landed');
  VIEW.mode = 'system'; VIEW.sel = { kind: 'stellar', id: sp.id }; VIEW.stellar = null;
  if (!quick) {
    const f = fallView(sys, sp);
    Object.assign(CAM, f);
    fadeTo(1);
    await zoomVia(f.x, f.y, back, TUNE.animMs, 'out', e => fadeTo(1 - e));
  }
  Object.assign(CAM, back);
  fadeTo(0);
}

let MOVING = false;
async function show(mode, opts, instant) {
  if (MOVING) return;
  const was = VIEW.mode, wasSys = VIEW.sys;
  const quick = instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
  MOVING = true;
  try {
    if (was === 'planet' && !(mode === 'planet' && opts.stellar === VIEW.stellar && opts.sys === VIEW.sys)) await rise(quick);
    if (mode === 'galaxy') {
      VIEW.mode = 'galaxy'; VIEW.stellar = null;
      VIEW.sel = opts.sel || (wasSys !== null ? { kind: 'system', id: wasSys } : null);
      VIEW.sys = null;
      if (was !== 'galaxy' && wasSys !== null) {
        const p = placeOf(wasSys);
        await flyTo({ x: p.x, y: p.y, s: Math.max(GALAXY_HOME.s, 1.2) }, quick);
      } else if (opts.center) {
        const p = placeOf(opts.center);
        await flyTo({ x: p.x, y: p.y, s: clampNum(CAM.s, 1.6, 4) }, quick);
      }
    } else if (mode === 'system') {
      const sys = U.byId.get(opts.sys);
      VIEW.sel = opts.sel || null;
      OPEN_SYS = sys.id;
      if (!(was === 'planet' && wasSys === sys.id)) {
        const to = systemView(sys);
        VIEW.sys = sys.id;
        await flyTo(to, quick);
      }
      VIEW.mode = 'system'; VIEW.sys = sys.id; VIEW.stellar = null;
    } else if (mode === 'planet' && VIEW.mode !== 'planet') {
      const sys = U.byId.get(opts.sys), sp = U.stellars.get(opts.stellar);
      OPEN_SYS = sys.id;
      if (VIEW.mode !== 'system' || VIEW.sys !== sys.id) {
        const to = systemView(sys);
        VIEW.sys = sys.id;
        await flyTo(to, quick);
      }
      VIEW.mode = 'system'; VIEW.sys = sys.id;
      const back = { ...CAM };
      if (!quick) { const f = fallView(sys, sp); await zoomVia(f.x, f.y, f, TUNE.animMs, 'in', fadeTo); }
      Object.assign(CAM, back);
      VIEW.back = back;
      VIEW.mode = 'planet'; VIEW.stellar = sp.id; VIEW.sel = { kind: 'stellar', id: sp.id };
      renderPlanet();
      $('planet').classList.add('on');
      $('stage').classList.add('landed');
      $('planet').scrollTop = 0;
      if (!quick) { fadeTo(1); await animate(Math.round(TUNE.animMs * 0.4), e => fadeTo(1 - e), 'out'); }
      fadeTo(0);
    }
  } finally {
    MOVING = false;
  }
  if (!opts.fromHash) writeHash(opts.replace);
  renderCrumbs();
  renderPanel();
  redraw();
}

/* ---- the subway map ------------------------------------------------------ */

// A subway map for these files, of a kind: from storage when it was worked
// out before, else worked out in a background thread while the page goes
// on, and kept in storage. A promise; the answer is in LAYOUT.subs.
function subwayGet(kind) {
  if (LAYOUT.subs[kind]) return Promise.resolve(LAYOUT.subs[kind]);
  if (LAYOUT.pending[kind]) return LAYOUT.pending[kind];
  const u = U, input = subwayInput(U, kind), key = SUBWAY_STORE + '-' + kind;
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(key)); } catch (e) { /* none, or storage is off */ }
  if (stored && stored.fingerprint === input.fingerprint) return Promise.resolve(LAYOUT.subs[kind] = subwayResult(input, stored));
  return (LAYOUT.pending[kind] = subwayWork(input).then(layout => {
    try { localStorage.setItem(key, JSON.stringify(layout)); } catch (e) { /* storage is off or full */ }
    if (U !== u) throw new Error('other files were opened meanwhile');
    delete LAYOUT.pending[kind];
    return (LAYOUT.subs[kind] = subwayResult(input, layout));
  }));
}
// Working a layout out: in a background thread made from nova-subway.js's
// own subwayModule, or here, a moment later, where there is none.
let SUBWAY_BUSY = 0;
function subwayWork(input) {
  // a note of its own over the map: the status line is the files'
  if (!SUBWAY_BUSY++) $('busy').hidden = false;
  return new Promise(resolve => {
    let w = null;
    try {
      const src = `${subwayModule.toString()}\nconst M = subwayModule();\nonmessage = e => postMessage(M.subwayWorkOut(e.data));\n`;
      w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    } catch (e) { w = null; }
    const here = () => setTimeout(() => resolve(subwayWorkOut(input)), 30);
    if (!w) { here(); return; }
    w.onmessage = e => { w.terminate(); resolve(e.data); };
    w.onerror = () => { w.terminate(); here(); };
    w.postMessage(input);
  }).finally(() => { if (!--SUBWAY_BUSY) $('busy').hidden = true; });
}
function useSub(sub) {
  if (LAYOUT.sub === sub) return;
  LAYOUT.sub = sub; NEB_SUB.clear(); buildPlaces();
}
// The switches as a kind of map says: the one wanted, which may be on its way.
function syncOpts(kind = LAYOUT.want) {
  $('optSubway').checked = !!kind;
  if (kind) { const f = subwayFlags(kind); $('optFine').checked = f.fine; $('optMixed').checked = f.mixed; $('optRoom').checked = f.names; $('optHeading').checked = f.heading; $('optBars').checked = !f.dots; $('optSide').checked = f.side; }
  $('optFine').disabled = $('optRoom').disabled = $('optHeading').disabled = !kind;
  $('optMixed').disabled = !kind || !$('optFine').checked;
  $('optBars').disabled = !kind || !$('optHeading').checked;
  $('optSide').disabled = !kind || !$('optHeading').checked || !$('optRoom').checked;
}
// At once, as when the address asks for a map, once it is ready; kind null
// is the true positions.
async function setLayoutNow(kind) {
  LAYOUT.want = kind;
  syncOpts();
  if (kind) { try { await subwayGet(kind); } catch (e) { return; } }
  while (MOVING) await new Promise(r => requestAnimationFrame(r));
  if (LAYOUT.want !== kind) return;
  LAYOUT.kind = kind; LAYOUT.mix = kind ? 1 : 0; LAYOUT.base = null;
  if (kind) useSub(LAYOUT.subs[kind]);
  buildPlaces();
  writeHash(true);
  redraw();
}
// Sliding from one to the other once it is ready, and from one subway map
// straight to another, so that the two can be compared (the maintainer's
// asking, 30 September 2026: by way of the true positions, the map lost its
// form between them). The system nearest the middle of
// the screen stays where it is on the screen, and in a system its disc stays
// the size it was. It waits for any move under way, and asked for another
// meanwhile, it goes on to that.
async function setLayout(kind) {
  LAYOUT.want = kind;
  syncOpts();
  if (kind) { try { await subwayGet(kind); } catch (e) { return; } }
  while (MOVING) await new Promise(r => requestAnimationFrame(r));
  if (LAYOUT.want !== kind || kind === LAYOUT.kind) return;
  const from = LAYOUT.kind;
  LAYOUT.kind = kind;
  const cur = curPlace();
  let anchor = cur;
  if (!anchor) { let bd = Infinity; for (const p of PLACES) { const [x, y] = toScreen(p.x, p.y), d = Math.hypot(x - CW / 2, y - CH / 2); if (d < bd) { bd = d; anchor = p; } } }
  const id = repOf(anchor), [ax, ay] = toScreen(anchor.x, anchor.y), s0 = CAM.s, r0 = anchor.rho;
  const legs = [];
  if (from && kind) legs.push({ sub: LAYOUT.subs[kind], m1: 1, base: LAYOUT.subs[from] });
  else if (from) legs.push({ sub: LAYOUT.subs[from], m1: 0 });
  else if (kind) legs.push({ sub: LAYOUT.subs[kind], m1: 1 });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  MOVING = true;
  try {
    for (const leg of legs) {
      if (leg.base) { LAYOUT.base = leg.base; NEB_BASE.clear(); LAYOUT.sub = null; LAYOUT.mix = 0; }
      useSub(leg.sub);
      const m0 = LAYOUT.mix;
      const step = e => {
        LAYOUT.mix = m0 + (leg.m1 - m0) * e;
        mixPlaces();
        const a = PLACE_OF.get(id);
        CAM.s = cur ? s0 * r0 / a.rho : s0;
        CAM.x = a.x - (ax - CW / 2) / CAM.s; CAM.y = a.y - (ay - CH / 2) / CAM.s;
      };
      if (reduced) { step(1); draw(); } else await animate(TUNE.animMs / legs.length, step);
    }
  } finally {
    MOVING = false;
    // the slide over, mix 1 is the map arrived at whatever it started from
    if (LAYOUT.base) { LAYOUT.base = null; NEB_BASE.clear(); buildPlaces(); }
  }
  writeHash(true);
  redraw();
  if (LAYOUT.want !== LAYOUT.kind) setLayout(LAYOUT.want);
}

/* ---- the address bar ---------------------------------------------------- */

function hashFor() {
  const words = LAYOUT.kind ? subwayAddress(LAYOUT.kind) : '';
  return viewHash() + (LAYOUT.kind ? '&subway' + (words ? '=' + words : '') : '') +
    (ROUTE.from !== null ? '&route=' + ROUTE.from + (ROUTE.to !== null ? '-' + ROUTE.to : '') : '');
}
function viewHash() {
  if (VIEW.mode === 'planet') return `#stellar=${VIEW.stellar}&system=${VIEW.sys}`;
  if (VIEW.mode === 'system') return `#system=${VIEW.sys}` + (VIEW.sel && VIEW.sel.kind === 'stellar' ? `&stellar=${VIEW.sel.id}&at=1` : '');
  if (VIEW.sel && VIEW.sel.kind === 'system') return `#galaxy&system=${VIEW.sel.id}`;
  return '#galaxy';
}
function writeHash(replace) {
  const h = hashFor();
  if (location.hash === h) return;
  if (replace) history.replaceState(null, '', h); else history.pushState(null, '', h);
}
function applyHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  // a route, from one system, or from one to another (&route=130-131)
  const [rf, rt] = (p.get('route') || '').split('-').map(v => (v === '' || v === undefined ? NaN : +v));
  ROUTE = U.byId.has(rf) ? { from: rf, to: U.byId.has(rt) && rt !== rf ? rt : null } : { from: null, to: null };
  const kind = p.has('subway') ? subwayFromAddress(p.get('subway')) : null;
  if (kind !== LAYOUT.want) setLayoutNow(kind);
  const sys = +p.get('system'), st = +p.get('stellar');
  if (p.has('stellar') && !p.has('at') && U.stellars.has(st)) {
    const where = (U.inSystems.get(st) || []);
    const s = where.includes(sys) ? sys : (where.find(id => SHOWN.has(id)) ?? where[0]);
    if (s !== undefined) { show('planet', { sys: s, stellar: st, fromHash: true }, true); return true; }
  }
  if (p.has('system') && !p.has('galaxy') && U.byId.has(sys)) {
    show('system', { sys, sel: p.has('stellar') && U.stellars.has(st) ? { kind: 'stellar', id: st } : null, fromHash: true }, true);
    return true;
  }
  if (p.has('galaxy')) {
    show('galaxy', { sel: U.byId.has(sys) ? { kind: 'system', id: sys } : null, fromHash: true }, true);
    return true;
  }
  return false;
}

/* ---- the breadcrumb ----------------------------------------------------- */

function renderCrumbs() {
  const el = $('crumbs'), parts = [];
  const sys = VIEW.sys !== null ? U.byId.get(VIEW.sys) : null;
  parts.push(VIEW.mode === 'galaxy' ? '<span class="here">Galaxy</span>' : '<a data-go="galaxy">Galaxy</a>');
  if (sys) parts.push(VIEW.mode === 'system' ? `<span class="here">${esc(sys.name)}</span>` : `<a data-go="system">${esc(sys.name)}</a>`);
  if (VIEW.mode === 'planet') parts.push(`<span class="here">${esc(U.stellars.get(VIEW.stellar).name)}</span>`);
  el.innerHTML = parts.join('<span class="sep">›</span>');
}

/* ---- the panel ---------------------------------------------------------- */

function renderPanel() {
  if (!U) return;
  const el = $('panel');
  const sel = VIEW.sel;
  let html;
  if (sel && sel.kind === 'bit') html = bitPanel(sel.id);
  else if (sel && sel.kind === 'mission') html = missionPanel(sel.id);
  else if (sel && sel.kind === 'story') html = storyPanel(sel.id);
  else if (VIEW.mode === 'planet') html = stellarPanel(U.stellars.get(VIEW.stellar));
  else if (sel && sel.kind === 'stellar') html = stellarPanel(U.stellars.get(sel.id));
  else if (sel && sel.kind === 'system') html = systemPanel(U.byId.get(sel.id));
  else if (sel && sel.kind === 'nebula') html = nebulaPanel(U.nebulae.find(n => n.id === sel.id));
  else if (VIEW.mode === 'system') html = systemPanel(U.byId.get(VIEW.sys));
  else html = galaxyPanel();
  el.innerHTML = html;
  renderLegend();
}

/* Where a gate leads, for the panels, as novaShownGates has it for what is
   shown now: its stellars and their systems, a random other wormhole, or
   nowhere and why. `sys` is the system whose panel it is. */
const GATE_WHY = {
  offline: () => 'nowhere: it cannot be landed on, and says "it is offline"',
  elsewhere: home => `nowhere from here: it belongs to ${home}, the first system shown now that lists it, and here says "the radiation levels are too extreme"`,
  unlinked: () => 'nowhere: it links to nothing, and landing on it does nothing',
  nowhere: () => 'nowhere: none of the stellars it names is in a system shown now',
};
function gateTo(sp, sys) {
  if (!novaGateKind(sp)) return '';
  const dead = GATES.dead.find(d => d.spob === sp && (!sys || d.sys.id === sys));
  if (dead) return GATE_WHY[dead.why](dead.why === 'elsewhere' ? sysLink(novaStellarSystem(U, sp.id, SHOWN).id) : '');
  const r = GATES.random.find(x => x.spob === sp);
  if (r) {
    const n = GATES.random.filter(x => x.sys.id !== r.sys.id).length;
    return `a random one of the ${n} other wormholes with no set destination in the systems shown now, drawn from this system when it is selected`;
  }
  const ways = GATES.ways.filter(w => w.gate === sp);
  if (!ways.length) return SHOWN.has(sys) || !sys ? '' : 'nowhere while its system is not shown';
  return ways.map(w => `${stellarLink(w.target.id, w.to.id)} in ${sysLink(w.to.id)}`).join('; ');
}
// A system's gates, and those elsewhere that lead into it one way, as rows of the panel.
function gateRows(sys) {
  const rows = [];
  for (const id of sys.stellars) {
    const sp = U.stellars.get(id), kind = novaGateKind(sp);
    if (!kind) continue;
    const dead = GATES.dead.some(d => d.spob === sp && d.sys.id === sys.id) || GATES.random.some(r => r.spob === sp && !r.enter);
    rows.push(kvRow(sp.name, `${dead ? '' : chip(GATE_COLOR[kind]) + ' '}${kind === 'wormhole' ? 'Wormhole' : 'Hypergate'} to ${gateTo(sp, sys.id)}`));
  }
  const into = GATES.ways.filter(w => w.to.id === sys.id && !GATES.ways.some(v => v.from.id === sys.id && v.to.id === w.from.id));
  if (into.length) rows.push(kvRow('One way in from', into.map(w => `${stellarLink(w.gate.id, w.from.id)} in ${sysLink(w.from.id)}`).join('; ')));
  return rows.join('');
}

const sysLink = (id, label) => `<a data-sys="${id}">${esc(label ?? (U.byId.get(id) || {}).name ?? 'sÿst ' + id)}</a>`;
const stellarLink = (id, sys) => `<a data-stellar="${id}"${sys !== undefined ? ` data-in="${sys}"` : ''}>${esc(U.stellars.get(id).name)}</a>`;
const chip = color => `<span class="chip" style="background:${color}"></span>`;
const kvRow = (k, v) => (v === null || v === undefined || v === '') ? '' : `<tr><td>${esc(k)}</td><td>${v}</td></tr>`;

function fieldsTable(type, rec) {
  const rows = [];
  for (const [name, kind, n] of NOVA_RECORDS[type]) {
    if (kind === 'pad' || !(name in rec)) continue;
    rows.push(`<tr><td>${esc(name)}</td><td>${esc(novaFieldText(kind, rec[name]))}</td></tr>`);
  }
  return `<details><summary>Every field of ${esc(type)} ${rec.id}, from ${esc(rec.file)}</summary><table class="fields">${rows.join('')}</table></details>`;
}

function testLine(text) {
  if (!text) return '<span class="note">none: always</span>';
  let holds, parse;
  try { parse = ncbParseTest(text); holds = ncbEval(parse.tree, STATE); } catch (e) { return `<span class="test">${bitText(text)}</span> <span class="warn">${esc(e.message)}</span>`; }
  const where = SHOW_MODE === 'bits' ? 'with the bits set' : 'at a new game';
  return `<span class="test">${bitText(text)}</span> — <span class="${holds ? 'yes' : 'no'}">${holds ? 'holds' : 'does not hold'} ${where}</span>` +
         (parse.mixed ? ' <span class="warn">(mixes &amp; and | without brackets; read left to right)</span>' : '');
}

/* ---- control bits: what each is for (nova-bits.js) --------------------- */

let BITS = null;
function bitCatalog() { return BITS || (BITS = novaBitCatalog(GAME)); }
// What a bit is for in a word, once the catalog is built ('' before).
function bitTitle(n) {
  if (!BITS) return '';
  const b = BITS.get(n);
  return b ? b.name || 'nothing in these files turns it on' : 'no record in these files uses it';
}
// A test or set expression, each bxxx in it a link to what the bit is for.
function bitText(text) {
  return esc(text).replace(/(^|[^A-Za-z0-9])([Bb])(\d+)/g, (m, pre, b, n) =>
    +n < 10000 ? `${pre}<a data-bit="${+n}" title="${esc(bitTitle(+n))}">${b}${n}</a>` : m);
}
// A record a bit's list names, as a link where the page has somewhere to show it.
function bitRefLink(r) {
  if (r.type === 'mïsn') return missionLink(r.id);
  if (r.type === 'sÿst' && U.byId.has(r.id)) return sysLink(r.id);
  if (r.type === 'spöb' && U.stellars.has(r.id)) return stellarLink(r.id);
  if (r.type === 'nëbu') return `<a data-nebula="${r.id}">${esc(r.name)}</a>`;
  if (r.type === 'shïp') return `<a data-ship="${r.id}">${esc(r.name)}</a>`;
  return esc(r.name);
}
/* The map with a bit set, or without it: the bits typed in, changed, and
   the map shown with them. */
function bitOnMap(n) {
  const bits = SHOW_MODE === 'bits' ? ncbBitsFromText($('bitsIn').value) : new Set();
  if (bits.has(n)) bits.delete(n); else bits.add(n);
  $('bitsIn').value = [...bits].sort((a, b) => a - b).map(x => 'b' + x).join(' ');
  $('showSel').value = 'bits';
  applyShowMode();
}
/* A bit's panel: what turns it on, off or over, and what needs it on or
   off, from every test and set expression in the files. */
function bitPanel(n) {
  const b = bitCatalog().get(n), refs = b ? b.refs : [];
  const set = SHOW_MODE === 'bits' && STATE.bits.has(n);
  const groups = [['set', 'Turned on'], ['clear', 'Turned off'], ['toggle', 'Turned over'], ['on', 'Needed on'], ['off', 'Needed off']];
  const sections = groups.map(([effect, title]) => {
    const rows = refs.filter(r => r.effect === effect);
    if (!rows.length) return '';
    return `<h3>${title} <span class="note">${rows.length}</span></h3><table class="kv">${rows.map(r =>
      `<tr><td>${esc(r.kind)} <span class="note">${r.id}</span></td><td>${bitRefLink(r)} ${effect === 'on' || effect === 'off' ? esc(r.event) : 'when ' + esc(r.event)}` +
      `${r.random ? ' <span class="note">(one side of a random choice)</span>' : ''} <span class="note">${esc(r.field)}</span></td></tr>`).join('')}</table>`;
  }).join('');
  return `<h2>b${n}</h2>
    <div class="sub">${esc(bitTitle(n))}</div>
    <div class="actions"><button data-bit-back>Back</button>
      <button data-bit-map="${n}">${set ? `Show the map without b${n}` : `Show the map with b${n} set`}</button></div>
    <p class="note">A control bit means what the records that turn it on and test it make of it; this is every test and set expression in the files open that names b${n}, the way Drydock reads them.</p>
    ${sections || '<p class="note">No record in these files tests or sets it.</p>'}`;
}

/* ---- missions and storylines (nova-missions.js) ------------------------ */

// Panels that open over the one beneath, with a Back to it.
const OVER_KINDS = new Set(['bit', 'mission', 'story']);
let MISSIONS = null;
function missionData() { return MISSIONS || (MISSIONS = novaMissions(GAME)); }
// A mission by name, with its storyline and step from Ambrosia's note.
function missionLink(id) {
  const m = missionData().byId.get(id);
  if (!m) return `mïsn ${id}`;
  return `<a data-mission="${id}">${esc(m.name)}</a>` + (m.story ? ` <span class="note">${esc(m.story.story)}${m.story.step ? ' ' + esc(m.story.step) : ''}</span>` : '');
}
const storyLink = key => `<a data-story="${esc(key)}">${esc(missionData().stories.get(key).name)}</a>`;
// A place code of a mission's in words, its stellar, system or government linked or named.
function placeText(field, v) {
  const p = novaMissionPlace(U, field, v);
  if (p.stellar) return U.stellars.has(p.stellar) ? stellarLink(p.stellar) : `spöb ${p.stellar}`;
  const sys = p.system !== undefined ? (U.byId.has(p.system) ? sysLink(p.system) : `sÿst ${p.system}`) : '';
  if (p.text === 'system') return sys;
  return esc(p.text) + (sys ? ' ' + sys : '') + (p.govt !== undefined ? ' ' + esc(govtName(p.govt < 128 ? -1 : p.govt)) : '');
}
// PayVal by the Bible's mïsn section.
function payText(v) {
  if (v > 0) return v.toLocaleString() + ' credits';
  if (v === 0 || v === -1) return 'none';
  const gv = off => esc(govtName(128 + (-v - off)));
  if (v <= -10128 && v >= -10383) return 'a clean record with ' + gv(10128 - 128);
  if (v <= -20128 && v >= -20383) return 'a clean record with ' + gv(20128 - 128) + ' and its allies';
  if (v <= -30128 && v >= -30383) return 'a clean record with ' + gv(30128 - 128) + ' and its class';
  if (v <= -40001 && v >= -40099) return `${-v - 40000}% of the player's cash taken`;
  if (v <= -50000) return `${(-v - 50000).toLocaleString()} credits taken at the start`;
  return 'code ' + v;
}
// Whether a mission's AvailBits hold for the bits shown.
function missionHolds(m) { try { return ncbTest(m.rec.AvailBits || '', STATE); } catch (e) { return false; } }

function missionPanel(id) {
  const m = missionData().byId.get(id);
  if (!m) return `<h2>mïsn ${id}</h2><p class="note">Not in these files.</p>`;
  const r = m.rec, st = m.story;
  const text = (title, did) => { const d = did >= 128 ? descText(did) : null; return d ? `<h3>${title}</h3><div class="desc">${esc(novaDescText(d.Description, STATE))}</div>` : ''; };
  const sets = [['On accepting', 'OnAccept'], ['On refusing', 'OnRefuse'], ['On success', 'OnSuccess'], ['On failure', 'OnFailure'], ['On aborting', 'OnAbort'], ['With its ships dealt with', 'OnShipDone']]
    .filter(([, f]) => r[f]).map(([k, f]) => kvRow(k, `<span class="test">${bitText(r[f])}</span>`)).join('');
  return `<h2>${esc(m.name)}</h2>
    <div class="sub">mïsn ${id}${st ? ` · ${storyLink(st.key)}${st.step ? ', step ' + esc(st.step) : ''}` : ''}${st && st.last ? ' · its last' : ''}${st && st.cutoff ? ' · where the unregistered game stops' : ''}</div>
    <div class="actions"><button data-bit-back>Back</button></div>
    ${m.note ? `<p class="note">Ambrosia's note in its resource name: “${esc(m.note)}”</p>` : ''}
    <table class="kv">
      ${kvRow('Offered at', placeText('avail', r.AvailStel) + ', from ' + esc(NOVA_AVAIL_LOC[r.AvailLoc] || 'place ' + r.AvailLoc))}
      ${kvRow('Offered when', testLine(r.AvailBits))}
      ${kvRow('Chance', r.AvailRandom > 0 && r.AvailRandom < 100 ? r.AvailRandom + '% each time you arrive in the system' : '')}
      ${kvRow('Legal record', r.AvailRecord === -32000 ? 'the stellar dominated' : r.AvailRecord === -32001 ? 'a stellar dominated' : r.AvailRecord > 0 ? 'at least ' + r.AvailRecord : r.AvailRecord < 0 ? 'at most ' + r.AvailRecord : '')}
      ${kvRow('Combat rating', r.AvailRating > 0 ? 'at least ' + r.AvailRating : '')}
      ${kvRow('Goes to', r.TravelStel !== -1 ? placeText('travel', r.TravelStel) : '')}
      ${kvRow('Returns to', r.ReturnStel !== -1 ? placeText('return', r.ReturnStel) : '')}
      ${kvRow('Special ships', r.ShipCount > 0 ? `${r.ShipCount} × ${esc(resName('düde', r.ShipDude))}, in ${placeText('ship', r.ShipSyst)}` : '')}
      ${kvRow('Time limit', r.TimeLimit > 0 ? r.TimeLimit + ' days' : '')}
      ${kvRow('Pay', payText(r.PayVal))}
      ${sets}
      ${kvRow('Leads to', m.next.map(missionLink).join('<br>'))}
      ${kvRow('Started by', m.startedBy.map(missionLink).join('<br>'))}
      ${kvRow('Follows', m.prev.map(missionLink).join('<br>'))}
    </table>
    <p class="note">Leads to: the missions whose AvailBits need a bit this one turns on (a bit at most three missions turn on), or that it starts.</p>
    ${text('The offer', 4000 + id - 128)}${text('The briefing', r.BriefText)}${text('On success', r.CompText)}${text('On failure', r.FailText)}
    ${fieldsTable('mïsn', r)}`;
}

/* A storyline's missions in step order, each with where it is offered; the
   places its missions are offered at, go to or return to are ringed on the
   map while it is open (storyPlaces). */
function storyPanel(key) {
  const s = missionData().stories.get(key);
  if (!s) return '<h2>No such storyline</h2>';
  const rows = s.missions.map(m => `<tr><td>${esc(m.story.step || '')}</td><td>${missionLink(m.id).replace(/ <span class="note">.*<\/span>$/, '')}` +
    `${m.story.last ? ' <span class="note">last</span>' : ''}${m.story.cutoff ? ' <span class="note">unregistered cutoff</span>' : ''}` +
    ` <span class="${missionHolds(m) ? 'yes' : 'no'}" title="its AvailBits with the bits shown">●</span>` +
    `<br><span class="note">at ${placeText('avail', m.rec.AvailStel)}</span></td></tr>`).join('');
  return `<h2>${esc(s.name)}</h2>
    <div class="sub">a storyline of ${s.missions.length} mission${s.missions.length === 1 ? '' : 's'}, named in Ambrosia's notes</div>
    <div class="actions"><button data-bit-back>Back</button></div>
    <p class="note">The missions whose resource names end in a note beginning “${esc(s.name)}”, in the order of the step the note gives. ● is whether a mission's AvailBits hold ${SHOW_MODE === 'bits' ? 'with the bits set' : 'at a new game'}. The places they are offered at and send you to are ringed on the map.</p>
    <table class="kv">${rows}</table>`;
}
// The places the open storyline's missions are offered at, go to or return to.
let STORY_PLACES = { key: null, set: null };
function storyPlaces() {
  const key = VIEW.sel && VIEW.sel.kind === 'story' ? VIEW.sel.id : null;
  if (key === null) return null;
  if (STORY_PLACES.key === key && STORY_PLACES.shown === SHOWN) return STORY_PLACES.set;
  const set = new Set(), s = missionData().stories.get(key);
  for (const m of s ? s.missions : []) for (const v of [m.rec.AvailStel, m.rec.TravelStel, m.rec.ReturnStel]) {
    if (!(v >= 128 && v <= 2175)) continue;
    const sys = novaStellarSystem(U, v, SHOWN), p = sys && PLACE_OF.get(sys.id);
    if (p) set.add(p);
  }
  STORY_PLACES = { key, shown: SHOWN, set };
  return set;
}
// The storylines, longest first, for the galaxy's panel.
function storyList() {
  const list = [...missionData().stories.values()].sort((a, b) => b.missions.length - a.missions.length || a.name.localeCompare(b.name));
  return `<h3>Storylines <span class="note">${list.length}, from the notes in the missions' names</span></h3><div class="list">${list.map(s => `<a data-story="${esc(s.key)}">${esc(s.name)}</a> <span class="note">${s.missions.length}</span>`).join(' ')}</div>`;
}
// The missions offered at a stellar, and those that send you there, for its panel.
function stellarMissions(sp) {
  const all = [...missionData().byId.values()];
  const row = m => `${missionLink(m.id)} <span class="${missionHolds(m) ? 'yes' : 'no'}" title="its AvailBits with the bits shown">●</span>`;
  const here = all.filter(m => m.rec.AvailStel === sp.id), to = all.filter(m => m.rec.AvailStel !== sp.id && (m.rec.TravelStel === sp.id || m.rec.ReturnStel === sp.id));
  if (!here.length && !to.length) return '';
  return `<h3>Missions</h3><table class="kv">${kvRow('Offered here', here.map(row).join('<br>'))}${kvRow('Sending you here', to.map(row).join('<br>'))}</table>`;
}

function galaxyPanel() {
  const shown = U.systems.filter(s => SHOWN.has(s.id));
  const byGovt = new Map();
  for (const s of shown) byGovt.set(s.govt, (byGovt.get(s.govt) || 0) + 1);
  const legend = [...byGovt].sort((a, b) => b[1] - a[1]).map(([g, n]) =>
    `<div data-govt="${g}" class="${VIEW.govt === g ? 'on' : ''}">${chip(govtFill(g))}${esc(govtName(g))}<small>${n}</small></div>`).join('');
  const places = new Set(U.systems.map(s => s.x + ',' + s.y)).size;
  const neb = U.nebulae.map(n => `<a data-nebula="${n.id}">${esc(n.name)}</a>`).join('');
  const files = GAME.files.map(f => `<tr><td>${esc(f.name)}</td><td>${f.plugin ? 'plug-in' : esc(f.role || '')}</td></tr>`).join('');
  const mode = SHOW_MODE === 'all' ? 'every version of every system' : SHOW_MODE === 'bits' ? 'the systems whose visibility test holds with those bits set' : 'the systems whose visibility test holds at the start of a new game, when no control bit is set';
  return `<h2>The galaxy</h2>
    <div class="sub">${shown.length} of ${U.systems.length} systems shown, at ${places} places; ${LINKS.length} hyperspace links; ${GATES.links.length} ways by hypergate or wormhole, and ${new Set(GATES.random.map(r => r.sys.id)).size} systems with a wormhole to a random other</div>
    <p class="note">Shown: ${mode}. Tap a system to see it; tap it again to go in.</p>
    ${SHOW_MODE === 'bits' && STATE.bits.size ? `<h3>Bits set</h3><table class="kv">${[...STATE.bits].sort((a, b) => a - b).map(n => kvRow('b' + n, `<a data-bit="${n}">${esc(bitTitle(n) || 'what it is for')}</a>`)).join('')}</table>` : ''}
    ${routeBlock()}
    <h3>Governments</h3><div class="legend">${legend}</div>
    ${storyList()}
    <h3>Nebulae</h3><div class="list">${neb || '<span class="note">none</span>'}</div>
    <details><summary>Files open</summary><table class="kv">${files}</table></details>`;
}

function nebulaPanel(n) {
  const have = n.picts.filter(p => GAME.has('PICT', p.id));
  const pic = have.map(p => `PICT ${p.id} (for ${Math.round(p.scale * 1000) / 10}%)`).join(', ');
  return `<h2>${esc(n.name)}</h2><div class="sub">nëbu ${n.id}</div>
    <table class="kv">
      ${kvRow('Place', `${n.x}, ${n.y}, ${n.w} × ${n.h} map units`)}
      ${kvRow('Pictures', esc(pic || 'none in these files'))}
      ${kvRow('Shown when', testLine(n.activeOn))}
      ${kvRow('On exploring', n.rec.OnExplore ? `<span class="test">${bitText(n.rec.OnExplore)}</span>` : '')}
    </table>
    ${fieldsTable('nëbu', n.rec)}`;
}

function systemPanel(sys) {
  const r = sys.rec;
  const inGalaxy = VIEW.mode === 'galaxy';
  // A link names one version of a place; it goes to whichever version is
  // shown there, so two links to two versions are one way out.
  const seenT = new Set();
  const links = novaSystemLinks(U, sys, SHOW_MODE === 'all' ? null : SHOWN).map(({ id, target }) => {
    if (!target) return `<span class="no" title="sÿst ${id}, not shown now">${esc((U.byId.get(id) || {}).name || 'sÿst ' + id)}</span>`;
    if (seenT.has(target.id)) return '';
    seenT.add(target.id);
    return sysLink(target.id);
  }).join('');
  const stellars = sys.stellars.map(id => stellarLink(id, sys.id)).join('');
  const gates = gateRows(sys);
  const dudes = [];
  (r.DudeTypes || []).forEach((d, i) => { if (d >= 128) dudes.push(`${esc(resName('düde', d))} <span class="note">${r.Probs[i]}%</span>`); });
  const pers = [];
  (r.Person || []).forEach((p, i) => { if (p >= 128) pers.push(`${esc(resName('përs', p))} <span class="note">${r.PersonProb[i]}%</span>`); });
  const roids = [];
  for (let b = 0; b < 16; b++) if (r.AstTypes & (1 << b)) roids.push(esc(resName('röid', 128 + b)));
  const buoy = r.Message >= 1 ? novaStrings(GAME, 1000)[r.Message - 1] : null;
  const versions = sys.versions.length > 1 ? sys.versions.map(v =>
    `<tr><td>${v.id === sys.id ? esc(v.name) : sysLink(v.id, v.name)} <span class="note">${v.id}</span></td><td>${testLine(v.visibility)}</td></tr>`).join('') : '';
  const bg = r.BkgndColor & 0xFFFFFF;
  return `<h2>${chip(govtFill(sys.govt))}${esc(sys.name)}</h2>
    <div class="sub">sÿst ${sys.id} · ${esc(govtName(sys.govt))} · at ${sys.x}, ${sys.y}</div>
    <div class="actions">${inGalaxy ? `<button data-open="${sys.id}">Go to ${esc(sys.name)}</button>` : '<button data-go="galaxy">Back to the galaxy</button>'}
      ${ROUTE.from !== null && ROUTE.from !== sys.id ? `<button data-route-to="${sys.id}">Route here from ${esc(U.byId.get(ROUTE.from).name)}</button>` : ''}
      ${ROUTE.from !== sys.id || ROUTE.to !== null ? `<button data-route-from="${sys.id}">Route from here</button>` : ''}
      ${SHOWN.has(sys.id) || SHOW_MODE === 'all' ? '' : '<span class="warn">Not on the map as it is shown now</span>'}</div>
    ${routeBlock()}
    <h3>Stellars</h3><div class="list">${stellars || '<span class="note">none</span>'}</div>
    <h3>Hyperspace links</h3><div class="list">${links || '<span class="note">none</span>'}</div>
    ${gates ? `<h3>Hypergates and wormholes</h3><table class="kv gates">${gates}</table>` : ''}
    <h3>Traffic</h3>
    <table class="kv">
      ${kvRow('Ships', r.AvgShips ? `about ${r.AvgShips}, ± half` : 'none')}
      ${kvRow('Of these kinds', dudes.join('<br>'))}
      ${kvRow('People', pers.join('<br>'))}
      ${kvRow('Reinforcements', r.ReinfFleet >= 128 ? `${esc(resName('flët', r.ReinfFleet))}, after ${(r.ReinfTime / 30).toFixed(1)} s, again after ${r.ReinfIntrval} day${r.ReinfIntrval === 1 ? '' : 's'}` : '')}
    </table>
    <h3>Space</h3>
    <table class="kv">
      ${kvRow('Asteroids', r.Asteroids ? `${r.Asteroids}${roids.length ? ': ' + roids.join(', ') : ''}` : 'none')}
      ${kvRow('Interference', r.Interference ? r.Interference + '%' : 'none')}
      ${kvRow('Murk', r.Murk < 0 ? 'none, and no starfield' : r.Murk ? r.Murk : 'none')}
      ${kvRow('Background', bg ? `${chip('#' + bg.toString(16).padStart(6, '0'))} #${bg.toString(16).toUpperCase().padStart(6, '0')}` : 'black')}
      ${kvRow('Message buoy', buoy ? esc(buoy) : '')}
    </table>
    <h3>Visibility</h3><p>${testLine(sys.visibility)}</p>
    ${versions ? `<h3>Versions of this place</h3><table class="kv">${versions}</table>` : ''}
    ${fieldsTable('sÿst', r)}`;
}

function stellarPanel(sp) {
  const f = sp.Flags, gate = sp.Flags2 & 0x3000;
  const inSys = U.inSystems.get(sp.id) || [];
  const sysHere = inSys.includes(VIEW.sys) ? VIEW.sys : inSys.find(id => SHOWN.has(id)) ?? inSys[0];
  const services = novaFlagWords(f, NOVA_SPOB_FLAGS).join(', ');
  const flags2 = novaFlagWords(sp.Flags2, NOVA_SPOB_FLAGS2).join(', ');
  const techs = [...(sp.SpecialTech || []), ...(sp.SpecialTech4to8 || [])].filter(t => t > 0);
  const prices = (f & 2) ? novaCommodityPrices(sp).map(p => `<tr><td>${esc(commodityName(p.index))}</td><td>${p.level ? esc(p.level) : '<span class="no">not traded</span>'}</td></tr>`).join('') : '';
  const def = novaDefense(sp);
  // Only a stellar the player can hail is ever asked for tribute.
  const tribute = !novaCanHail(sp) ? '' : (sp.Tribute <= 0 ? `${(1000 * sp.TechLevel).toLocaleString()} credits a day (1000 × tech level)` : `${sp.Tribute.toLocaleString()} credits a day`) + ', once dominated';
  const dead = sp.DeadTime === 0 ? ', and regenerates at the end of the day' : sp.DeadTime < 0 ? ', and never regenerates' : `, and regenerates after DeadTime ${sp.DeadTime}`;
  const pw = planetWeapons();
  const destroyed = sp.Strength > 0 ? `${sp.Strength.toLocaleString()} damage from planet-type weapons${dead}. ` +
    (pw.length ? `Those in these files: ${pw.map(w => esc(resName('wëap', w.id))).join(', ')}.` : 'These files have none.') : 'nothing: it cannot be destroyed';
  const minStatus = sp.MinStatus === -32767 ? 'always allowed' : sp.MinStatus === 32767 ? 'never allowed' : sp.MinStatus;
  const typeName = stellarTypeName(sp.Type);
  const sets = [['On dominating', sp.OnDominate], ['On release', sp.OnRelease], ['On destruction', sp.OnDestroy], ['On regenerating', sp.OnRegen]]
    .filter(([, v]) => v).map(([k, v]) => kvRow(k, `<span class="test">${bitText(v)}</span>`)).join('');
  const land = novaLandingPict(sp);
  return `<h2>${esc(sp.name)}</h2>
    <div class="sub">spöb ${sp.id}${typeName ? ' · ' + esc(typeName) : ''} · ${esc(govtName(sp.Govt))}</div>
    <div class="actions">
      ${VIEW.mode === 'planet' ? `<button data-go="system">Back to ${esc(U.byId.get(VIEW.sys).name)}</button>`
        : sysHere !== undefined ? `<button data-land="${sp.id}" data-in="${sysHere}">${(f & 1) && !gate ? 'Land' : 'Look closer'}</button>` : ''}
    </div>
    <table class="kv">
      ${kvRow('Services', esc(services || 'none'))}
      ${kvRow('Tech level', sp.TechLevel + (techs.length ? `; also exactly ${techs.join(', ')}` : ''))}
      ${kvRow('Landing fee', sp.Fee ? sp.Fee.toLocaleString() + ' credits' : '')}
      ${kvRow('Landing', (f & 0x20) || !(f & 1) ? '' : typeof minStatus === 'number' ? `refused below a legal status of ${minStatus}` : esc(minStatus))}
      ${kvRow('Defence', def ? `${esc(resName('düde', def.dude))}: ${def.total} ship${def.total === 1 ? '' : 's'}${def.wave ? `, in waves of ${def.wave}` : ''}` : '')}
      ${kvRow('Tribute', tribute)}
      ${kvRow('Weapon', sp.Weapon > 0 ? esc(resName('wëap', sp.Weapon)) : '')}
      ${kvRow('Destroyed by', destroyed)}
      ${kvRow('Gravity', sp.Gravity ? sp.Gravity : '')}
      ${kvRow('Also', esc(flags2))}
      ${kvRow(gate & 0x2000 ? 'Wormhole to' : 'Hypergate to', gateTo(sp, sysHere))}
      ${kvRow('Landing picture', (f & 1) && !gate ? `PICT ${land}${sp.CustPicID >= 128 ? '' : ' (10000 + type)'}` : '')}
      ${kvRow('Sprite', `spïn ${novaStellarSpin(sp)}`)}
    </table>
    ${prices ? `<h3>Commodities</h3><table class="kv">${prices}</table>` : ''}
    <h3>In ${inSys.length === 1 ? 'the system' : 'the systems'}</h3><div class="list">${inSys.map(id => sysLink(id)).join('') || '<span class="note">none: in no system\'s navigation list</span>'}</div>
    ${sets ? `<h3>Control bits</h3><table class="kv">${sets}</table>` : ''}
    ${stellarMissions(sp)}
    ${fieldsTable('spöb', sp)}`;
}

// The open files' planet-type weapons, read again when files are added.
let PLANET_WEAPONS = null;
function planetWeapons() {
  if (!PLANET_WEAPONS || PLANET_WEAPONS.files !== GAME.files.length) PLANET_WEAPONS = { files: GAME.files.length, list: novaPlanetWeapons(GAME) };
  return PLANET_WEAPONS.list;
}

/* ---- landing ------------------------------------------------------------ */

function renderPlanet() {
  const sp = U.stellars.get(VIEW.stellar), el = $('planet');
  if (!sp) return;
  const gate = sp.Flags2 & 0x3000, canLand = (sp.Flags & 1) && !gate;
  const parts = [];
  const d = descText(novaStellarDescId(sp));
  const bar = (sp.Flags & 0x40) ? descText(novaStellarBarDescId(sp)) : null;
  parts.push('<div class="land">');
  parts.push('<div id="landPict"></div>');
  if (d) parts.push(`<div class="desc">${esc(novaDescText(d.Description, STATE))}</div>`);
  else parts.push(`<div class="desc dim">No description: the files have no dësc ${novaStellarDescId(sp)}.</div>`);
  if (bar) {
    parts.push(`<h3>The bar</h3><div id="barPict"></div><div class="desc">${esc(novaDescText(bar.Description, STATE))}</div>`);
  }
  if (d && novaDescBits(d.Description).length) parts.push(`<p class="note">This description changes with control bits ${novaDescBits(d.Description).map(b => 'b' + b).join(', ')}.</p>`);
  parts.push('</div>');
  el.innerHTML = parts.join('');
  const host = el.querySelector('#landPict');
  if (canLand) {
    const id = novaLandingPict(sp), img = pictImage(id);
    if (img) host.appendChild(asCanvas(img, 'pict'));
    else host.innerHTML = `<div class="nopict">${GAME.has('PICT', id) ? 'Reading PICT ' + id + '…' : PENDING.length || PUMPING ? 'Waiting for the titles files…' : 'PICT ' + id + ' is not in these files.'}</div>`;
  } else {
    const spr = stellarSprite(sp);
    host.innerHTML = `<div class="nopict">${gate ? (gate & 0x2000 ? 'A wormhole: landing sends a ship elsewhere, and there is no landing picture.' : 'A hypergate: landing chooses a destination, and there is no landing picture.') : 'Nothing to land on here.'}</div>`;
    if (spr) { const b = document.createElement('div'); b.className = 'spritebox'; b.appendChild(asCanvas(spr)); host.appendChild(b); }
  }
  if (bar && bar.Graphic >= 128) {
    const img = pictImage(bar.Graphic);
    if (img) el.querySelector('#barPict').appendChild(asCanvas(img, 'pict'));
  }
}

/* A copy to put in the page: the cached canvas stays where it is. */
function asCanvas(img, cls) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  if (cls) c.className = cls;
  if (cls === 'pict') c.style.maxWidth = img.width * 2 + 'px';
  return c;
}

/* ---- leaving a landing ---------------------------------------------------- */

/* Pinching in on the landing page rises back to the system, as zooming out
   of a place below ground is how grimoire leaves it. The page shrinks under
   the fingers as they close and springs back if they stop short of three
   quarters. A trackpad pinch, which arrives as a wheel with ctrlKey, does
   the same on a desktop. */
function wireLanding() {
  const el = $('planet');
  let d0 = 0, r = 1, wheel = 0, wheelTimer = null;
  const land = () => el.querySelector('.land');
  const spread = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const setR = (v, eased) => {
    r = v;
    const l = land();
    if (!l) return;
    l.style.transition = eased ? 'transform .2s, opacity .2s' : '';
    l.style.transform = r < 1 ? `scale(${r})` : '';
    l.style.opacity = r < 1 ? String(clampNum((r - 0.4) / 0.6, 0.2, 1)) : '';
  };
  const leave = () => {
    setR(1);
    if (VIEW.mode === 'planet' && !MOVING) show('system', { sys: VIEW.sys, sel: { kind: 'stellar', id: VIEW.stellar } });
  };
  el.addEventListener('touchstart', e => { if (e.touches.length === 2) { d0 = spread(e.touches); setR(1); } }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !d0) return;
    e.preventDefault();
    setR(clampNum(spread(e.touches) / d0, 0.4, 1));
  }, { passive: false });
  const end = e => {
    if (!d0 || e.touches.length >= 2) return;
    d0 = 0;
    if (r < 0.75) leave(); else setR(1, true);
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    wheel = Math.max(0, wheel + e.deltaY);
    setR(clampNum(1 - wheel / 200, 0.4, 1));
    clearTimeout(wheelTimer);
    if (r < 0.75) { wheel = 0; leave(); return; }
    wheelTimer = setTimeout(() => { wheel = 0; setR(1, true); }, 250);
  }, { passive: false });
}

/* ---- pointing ----------------------------------------------------------- */

function wireMap() {
  const cv = $('map');
  const pointers = new Map();
  let drag = null, pinch = null, moved = false, lastTap = 0;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    moved = false;
    if (pointers.size === 1) drag = { x: e.offsetX, y: e.offsetY, c: { ...CAM } };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: { ...CAM }, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      drag = null;
    }
  });
  cv.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (MOVING) return;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
      const [wx, wy] = toWorld(pinch.mx, pinch.my, pinch.c);
      CAM.s = clampNum(pinch.c.s * k, sMin(), S_MAX);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      CAM.x = wx - (mx - CW / 2) / CAM.s; CAM.y = wy - (my - CH / 2) / CAM.s;
      moved = true;
      redraw();
      return;
    }
    if (drag) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      cv.classList.add('dragging');
      CAM.x = drag.c.x - dx / CAM.s; CAM.y = drag.c.y - dy / CAM.s;
      redraw();
      return;
    }
    hoverAt(e.offsetX, e.offsetY);
  });
  const end = e => {
    pointers.delete(e.pointerId);
    cv.classList.remove('dragging');
    if (pointers.size < 2) pinch = null;
    if (drag && !moved && pointers.size === 0) {
      const now = performance.now(), dbl = now - lastTap < 350;
      lastTap = now;
      tapAt(e.offsetX, e.offsetY, dbl);
    }
    if (pointers.size === 0) drag = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (VIEW.hover) { VIEW.hover = null; redraw(); } });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)));
  }, { passive: false });
}

function zoomAt(sx, sy, k) {
  if (MOVING) return;
  const [wx, wy] = toWorld(sx, sy);
  CAM.s = clampNum(CAM.s * k, sMin(), S_MAX);
  CAM.x = wx - (sx - CW / 2) / CAM.s; CAM.y = wy - (sy - CH / 2) / CAM.s;
  redraw();
}

function hoverAt(sx, sy) {
  let h = null;
  if (VIEW.mode !== 'planet' && !MOVING) {
    const st = stellarAt(sx, sy);
    if (st) h = { kind: 'stellar', id: st.sp.id };
    else { const s = systemAt(sx, sy); if (s) h = { kind: 'system', id: s.id }; }
  }
  const same = JSON.stringify(h) === JSON.stringify(VIEW.hover);
  VIEW.hover = h;
  $('map').style.cursor = h ? 'pointer' : '';
  if (!same) redraw();
}

/* A tap selects; a second tap on the same thing, or a double tap, goes in:
   into a system, or down onto a stellar. */
function tapAt(sx, sy, dbl) {
  if (VIEW.mode === 'planet' || MOVING) return;
  const st = stellarAt(sx, sy);
  if (st) {
    if (dbl || (VIEW.sel && VIEW.sel.kind === 'stellar' && VIEW.sel.id === st.sp.id)) { show('planet', { sys: st.sys.id, stellar: st.sp.id }); return; }
    VIEW.sel = { kind: 'stellar', id: st.sp.id };
    const [wx, wy] = stellarWorld(st.sys, st.sp), [x, y] = toScreen(wx, wy);
    if (x < 0 || y < 0 || x > CW || y > CH) animate(450, camTween({ x: wx, y: wy, s: CAM.s }));
  } else {
    const s = systemAt(sx, sy);
    if (s) {
      if (dbl || (VIEW.sel && VIEW.sel.kind === 'system' && VIEW.sel.id === s.id)) { show('system', { sys: s.id }); return; }
      VIEW.sel = { kind: 'system', id: s.id };
    } else if (VIEW.mode === 'galaxy') {
      const n = nebulaAt(sx, sy);
      VIEW.sel = n ? { kind: 'nebula', id: n.id } : null;
    } else VIEW.sel = null;
  }
  writeHash(true);
  renderPanel();
  redraw();
}

/* ---- the panel's links, the tools, the keys ---------------------------- */

function wirePanel() {
  const onClick = e => {
    const a = e.target.closest('[data-sys],[data-stellar],[data-open],[data-land],[data-go],[data-govt],[data-nebula],[data-route-from],[data-route-to],[data-route-clear],[data-bit],[data-bit-back],[data-bit-map],[data-ship],[data-mission],[data-story]');
    if (!a) return;
    e.preventDefault();
    const d = a.dataset;
    // a bit, a mission or a storyline opens over the panel; Back goes to what was under it
    const over = (kind, id) => { VIEW.sel = { kind, id, back: VIEW.sel }; renderPanel(); redraw(); $('panel').scrollTop = 0; };
    if (d.bit !== undefined) return over('bit', +d.bit);
    if (d.mission !== undefined) return over('mission', +d.mission);
    if (d.story !== undefined) return over('story', d.story);
    if (d.bitBack !== undefined) { VIEW.sel = VIEW.sel.back || null; renderPanel(); redraw(); return; }
    if (d.bitMap !== undefined) { bitOnMap(+d.bitMap); return; }
    if (d.ship !== undefined) { shipsShow(+d.ship); return; }
    while (VIEW.sel && OVER_KINDS.has(VIEW.sel.kind)) VIEW.sel = VIEW.sel.back || null;
    if (d.routeFrom !== undefined) setRoute(+d.routeFrom, null);
    else if (d.routeTo !== undefined) setRoute(ROUTE.from, +d.routeTo);
    else if (d.routeClear !== undefined) setRoute(null, null);
    else if (d.go === 'galaxy') show('galaxy', {});
    else if (d.go === 'system') show('system', { sys: VIEW.sys, sel: VIEW.stellar !== null ? { kind: 'stellar', id: VIEW.stellar } : null });
    else if (d.open) show('system', { sys: +d.open });
    else if (d.land) show('planet', { sys: +d.in, stellar: +d.land });
    else if (d.sys) goSystem(+d.sys);
    else if (d.stellar) goStellar(+d.stellar, d.in !== undefined ? +d.in : undefined);
    else if (d.govt !== undefined) { const g = +d.govt; VIEW.govt = VIEW.govt === g ? null : g; renderPanel(); redraw(); }
    else if (d.nebula) {
      const n = U.nebulae.find(v => v.id === +d.nebula);
      VIEW.sel = { kind: 'nebula', id: n.id };
      const r = nebRect(n), box = boxView(r.x, r.y, r.x + r.w, r.y + r.h, 80);
      if (VIEW.mode !== 'galaxy') show('galaxy', { sel: VIEW.sel }).then(() => glide(box));
      else { renderPanel(); glide(box); }
    }
  };
  $('panel').addEventListener('click', onClick);
  $('crumbs').addEventListener('click', onClick);
}

/* A system from a link: in the galaxy it is selected and brought to the
   middle; from inside a system or on a stellar, you go to it. */
function goSystem(id) {
  if (VIEW.mode === 'galaxy') {
    VIEW.sel = { kind: 'system', id };
    show('galaxy', { sel: VIEW.sel, center: SHOWN.has(id) || SHOW_MODE === 'all' ? id : null, replace: true });
  } else show('system', { sys: id });
}
function goStellar(id, sys) {
  const where = U.inSystems.get(id) || [];
  const s = sys !== undefined && where.includes(sys) ? sys : (where.includes(VIEW.sys) ? VIEW.sys : (where.find(w => SHOWN.has(w)) ?? where[0]));
  if (s === undefined) return;
  if (VIEW.mode === 'system' && VIEW.sys === s) { VIEW.sel = { kind: 'stellar', id }; writeHash(true); renderPanel(); redraw(); }
  else show('system', { sys: s, sel: { kind: 'stellar', id } });
}

function wireTools() {
  $('zoomIn').onclick = () => zoomAt(CW / 2, CH / 2, 1.5);
  $('zoomOut').onclick = () => zoomAt(CW / 2, CH / 2, 1 / 1.5);
  $('fit').onclick = () => glide(VIEW.mode === 'system' ? systemView(U.byId.get(VIEW.sys)) : galaxyView());
  $('showSel').onchange = () => { applyShowMode(); if (VIEW.mode === 'planet') renderPlanet(); };
  $('bitsIn').oninput = () => { applyShowMode(); if (VIEW.mode === 'planet') renderPlanet(); };
  // Map options: the switches under Subway map make one kind of subway map between them.
  const opts = $('opts'), btn = $('optsBtn');
  const place = () => { const t = $('tools'); opts.style.top = (t.offsetTop + t.offsetHeight + 6) + 'px'; };
  btn.onclick = () => { opts.hidden = !opts.hidden; btn.setAttribute('aria-expanded', String(!opts.hidden)); if (!opts.hidden) place(); };
  document.addEventListener('pointerdown', e => { if (!opts.hidden && !opts.contains(e.target) && e.target !== btn) { opts.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !opts.hidden) { opts.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  // only where needed is a way of having 22.5 degrees, and goes with them
  const chosen = () => ($('optSubway').checked ? subwayKind({ names: $('optRoom').checked, fine: $('optFine').checked, mixed: $('optFine').checked && $('optMixed').checked, heading: $('optHeading').checked, dots: !$('optBars').checked, side: $('optSide').checked }) : null);
  for (const id of ['optSubway', 'optFine', 'optMixed', 'optRoom', 'optHeading', 'optBars', 'optSide']) $(id).onchange = () => setLayout(chosen());
  $('optStellars').onchange = () => {
    STELLARS = $('optStellars').checked;
    OPEN_SYS = VIEW.mode !== 'galaxy' ? VIEW.sys : null;
    redraw();
  };
  $('linkSel').onchange = () => { LINKS_BY = $('linkSel').value; JUMPS = { from: null }; renderLegend(); redraw(); };
  $('optNames').onchange = () => { NAMES = $('optNames').checked; redraw(); };
  // The corner: the details beside the map (below it on a phone) hidden or shown, and full screen
  // where the browser allows it for a page, which an iPhone's does not.
  const details = $('panelBtn');
  details.onclick = () => {
    const hide = !$('app').classList.contains('bare');
    $('app').classList.toggle('bare', hide);
    details.setAttribute('aria-pressed', String(!hide));
    details.title = hide ? 'Show the details' : 'Hide the details';
  };
  const full = $('fullBtn'), root = document.documentElement;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  full.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  full.onclick = () => {
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { /* refused */ }
  };
  const fullChanged = () => { const on = isFull(); full.classList.toggle('on', on); full.title = on ? 'Leave full screen' : 'Full screen'; full.setAttribute('aria-label', full.title); };
  document.addEventListener('fullscreenchange', fullChanged);
  document.addEventListener('webkitfullscreenchange', fullChanged);
  $('nebSel').onchange = () => { NEB_STYLE = $('nebSel').value; NEBULAE = NEB_STYLE !== 'none'; redraw(); };
  $('optPlainNames').onchange = () => { PLAIN_NAMES = $('optPlainNames').checked; redraw(); };
  $('sysSel').onchange = () => { SYS_STYLE = $('sysSel').value; redraw(); };
  $('optGates').onchange = () => { GATE_LINES = $('optGates').checked; renderPanel(); redraw(); };
  $('dotSel').onchange = () => { DOTS_BY = $('dotSel').value; renderLegend(); redraw(); };
  $('litSel').onchange = () => { LIGHT = $('litSel').value; renderLegend(); redraw(); };
  $('optReach').oninput = () => { const v = parseInt($('optReach').value, 10); REACH = v >= 1 ? v : null; renderLegend(); redraw(); };
  // the whole map, large: a PNG four times as sharp as the map's own pixels, kept within 32 million
  // of them so that a phone can make it, and the same as a drawing, an SVG (wholeMap)
  const wholeName = ext => `stargrimoire-whole-map${LAYOUT.kind ? '-subway' : ''}.${ext}`;
  $('saveWhole').onclick = () => {
    const [w, h] = wholeMapSize(), k = Math.min(4, Math.sqrt(32e6 / (w * h)));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const ctx = c.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawWholeMap(ctx, w, h);
    c.toBlob(b => { if (b) dlBlob(b, wholeName('png')); else alert('This browser could not make a picture that large.'); }, 'image/png');
  };
  $('saveSvg').onclick = () => {
    const [w, h] = wholeMapSize(), ctx = svgContext(w, h);
    drawWholeMap(ctx, w, h);
    dlBlob(new Blob([ctx.toSVG()], { type: 'image/svg+xml' }), wholeName('svg'));
  };
  // the map as it is on the screen, at the screen's own pixels, as a PNG
  $('saveImg').onclick = () => {
    draw();
    const where = VIEW.mode === 'galaxy' ? 'galaxy' : (U.byId.get(VIEW.sys) || {}).name || 'map';
    $('map').toBlob(b => { if (b) dlBlob(b, `stargrimoire-${where.replace(/[^\w'-]+/g, '-')}.png`); }, 'image/png');
  };
  const search = $('search'), found = $('found');
  let hits = [], on = 0;
  const paint = () => {
    found.innerHTML = hits.map((h, i) => `<div class="${i === on ? 'on' : ''}" data-i="${i}">${esc(h.name)}<small>${esc(h.what)}</small></div>`).join('');
    found.style.display = hits.length ? 'block' : 'none';
  };
  const pick = h => {
    search.value = ''; hits = []; paint(); search.blur();
    if (h.kind === 'system') goSystem(h.id); else goStellar(h.id);
  };
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    hits = [];
    if (q && U) {
      const seen = new Set();
      for (const s of U.systems) {
        if (!s.name.toLowerCase().includes(q)) continue;
        const k = s.name + '|' + s.x + ',' + s.y;
        if (seen.has(k)) continue;
        seen.add(k);
        const version = s.versions.find(v => SHOWN.has(v.id)) || s;
        hits.push({ kind: 'system', id: version.id, name: s.name, what: 'system' + (SHOWN.has(version.id) ? '' : ', not shown'), rank: s.name.toLowerCase().startsWith(q) ? 0 : 1 });
      }
      for (const sp of U.stellars.values()) {
        if (!sp.name.toLowerCase().includes(q) || !U.inSystems.has(sp.id)) continue;
        const sysName = U.byId.get(U.inSystems.get(sp.id)[0]).name;
        hits.push({ kind: 'stellar', id: sp.id, name: sp.name, what: 'in ' + sysName, rank: sp.name.toLowerCase().startsWith(q) ? 0 : 1 });
      }
      hits.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
      hits = hits.slice(0, 12);
    }
    on = 0;
    paint();
  });
  search.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { on = Math.min(on + 1, hits.length - 1); paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { on = Math.max(on - 1, 0); paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[on]) pick(hits[on]);
    else if (e.key === 'Escape') { search.value = ''; hits = []; paint(); }
  });
  found.addEventListener('pointerdown', e => { const d = e.target.closest('[data-i]'); if (d) { e.preventDefault(); pick(hits[+d.dataset.i]); } });
  search.addEventListener('blur', () => setTimeout(() => { found.style.display = 'none'; }, 150));
  search.addEventListener('focus', () => { if (hits.length) found.style.display = 'block'; });

  window.addEventListener('keydown', e => {
    if (!U || SHIPS.on || e.target.closest('input, select, textarea')) return;
    if (e.key === 'Escape') {
      if (VIEW.mode === 'planet') show('system', { sys: VIEW.sys, sel: { kind: 'stellar', id: VIEW.stellar } });
      else if (VIEW.mode === 'system') show('galaxy', {});
      else if (VIEW.sel) { VIEW.sel = null; writeHash(true); renderPanel(); redraw(); }
    } else if (e.key === '+' || e.key === '=') zoomAt(CW / 2, CH / 2, 1.5);
    else if (e.key === '-') zoomAt(CW / 2, CH / 2, 1 / 1.5);
    else if (e.key === 'Enter' && VIEW.sel) {
      if (VIEW.mode === 'galaxy' && VIEW.sel.kind === 'system') show('system', { sys: VIEW.sel.id });
      else if (VIEW.mode === 'system' && VIEW.sel.kind === 'stellar') show('planet', { sys: VIEW.sys, stellar: VIEW.sel.id });
    }
  });
  window.addEventListener('popstate', () => { if (U && !shipsFromHash()) { if (!applyHash()) show('galaxy', { fromHash: true }, true); } });
  new ResizeObserver(() => { if (!$('app').hidden) resizeCanvas(); }).observe($('stage'));
}

wireOpening();
wireMap();
wireLanding();
wirePanel();
wireTools();
