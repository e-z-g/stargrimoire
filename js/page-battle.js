/* page-battle.js -- the battle simulator, a view of its own.
   =========================================================================

   An arena and a hangar (the maintainer's asking, 1 October 2026: the
   ships and the battle together, by drag and drop). The hangar lists every
   ship class that can fly, as the Ships view does, each with its picture;
   a ship is dragged from it onto the arena (with a finger, first
   sideways, so that the list still scrolls), or tapped and then the arena
   tapped where it goes, as many at a time as Drop says, each flying as
   Flies as says (its class's InherentAI, or one chosen). The arena's left
   half is side 1's and its right half side 2's; a ship dropped is that
   half's, facing the other. Until the fight, ships on the arena are
   dragged to move them -- across the middle to change sides -- and off it
   to take them away. Fight puts them in empty space with no other ship
   arriving, to fight by the game's rules as nova-flight.js and
   nova-fight.js have them; a ship dropped during the fight joins it at
   once. The two sides are enemies and never retreat or leave (the
   maintainer's asking, 6 October 2026): each side flies as a government
   that is the other's enemy (battleGovts), and the world's noRetreat
   turns off every retreat and departure. Set up again goes back to the
   arena as it was set. Ammunition never runs out, when ticked, tops each
   ship's ammunition and fuel back up to what it started with after every
   step (the maintainer's asking, 6 October 2026).

   The view follows the ships, zoomed to keep them all on the screen,
   until it is zoomed or dragged by hand; Follow takes it back. The bar's
   Battle, and the address #battle, which keeps the setup (battleHash).

   The page's own script: DOM here. LOAD ORDER: after page-flight.js and
   page-ships.js, whose flightData, drawFlightThings, shipSprite and
   shipFrame it uses. */

const BATTLE = {
  on: false, govt: [null, null], setup: [], w: null, placed: [],
  paused: false, speed: 1, due: 0, last: 0, tick: null,
  cam: { x: 0, y: 0, s: 0.6 }, follow: true, shown: '', cw: 0, ch: 0,
  q: '', many: 1, armed: null, hangar: null, pick: null, pickShown: 0, want: null, ai: 3, kills: 0, side: 10, ammo: false,
};
const BATTLE_COLOURS = ['#5fa8ff', '#ff7a5f'];
const BATTLE_FACING = [90, 270];   // side 1 faces right, side 2 left
const BATTLE_GAP = 120;            // between ships dropped together, in a column
// The least kills for each combat rating, whose names are STR# 138 (DrawCombatRatingString 0x57e5).
const BATTLE_RATINGS = [0, 1, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];

/* ---- in and out of the view -------------------------------------------- */

function battleFromHash() {
  if (!/(^#|&)battle\b/.test(location.hash)) { if (BATTLE.on) battleLeave(true); return false; }
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.has('in') || p.has('ships')) BATTLE.want = p;
  battleShow({ fromHash: true });
  return true;
}
// Other files: the battle goes with the records it was made of.
function battleReset() { BATTLE.pick = null; BATTLE.w = null; BATTLE.placed = []; BATTLE.setup = []; BATTLE.hangar = null; BATTLE.armed = null; if (BATTLE.on) battlePanel(); }
// More files read: the ships may have come.
function battleFilesChanged() { if (BATTLE.on) { battlePanel(); battleDraw(); } }
function battleShow(opts = {}) {
  if (SHIPS.on) shipsLeave(true);
  BATTLE.on = true;
  $('app').hidden = true;
  $('ships').hidden = true;
  $('battle').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'battle'));
  $('crumbs').innerHTML = '';
  wantShipFiles();
  battleResize();
  battlePanel();
  battleRun();
  if (!opts.fromHash && !/^#battle\b/.test(location.hash)) history.pushState(null, '', battleHash());
}
/* The setup in the address, so that a link opens it again:
   #battle[&ammo=1]&ships=<class>.<x>.<y>[.<ai>[.<side>]],…
   in the arena's units, the AI type given when it is not 3 (0 is the
   class's own); a ship's side is the half it is in, or given (0 left, 1
   right) when it is not, as a random battle's are. */
function battleHash() {
  const ships = BATTLE.setup.map(e => { const half = e.x < 0 ? 0 : 1, tail = e.side !== half ? `.${e.ai}.${e.side}` : e.ai !== 3 ? `.${e.ai}` : ''; return `${e.cls}.${Math.round(e.x)}.${Math.round(e.y)}${tail}`; }).join(',');
  return `#battle${BATTLE.ammo ? '&ammo=1' : ''}${BATTLE.kills ? '&kills=' + BATTLE.kills : ''}${ships ? '&ships=' + ships : ''}`;
}
function battleWriteHash() {
  const h = battleHash();
  if (BATTLE.on && location.hash !== h) history.replaceState(null, '', h);
}
// An address's setup, once the ships are read: what the files lack is left out.
function battleTakeHash(D) {
  const p = BATTLE.want;
  BATTLE.want = null;
  const n = k => p.has(k) && /^-?\d+$/.test(p.get(k)) ? +p.get(k) : null;
  BATTLE.kills = Math.max(0, Math.min(10000000, n('kills') || 0));
  BATTLE.ammo = n('ammo') === 1;
  BATTLE.setup = (p.get('ships') || '').split(',').map(t => t.split('.').map(Number))
    .filter(a => (a.length === 3 || (a.length >= 4 && a.length <= 5 && battleAiOk(a[3]) && (a.length === 4 || a[4] === 0 || a[4] === 1))) && a.every(Number.isFinite) && D.classes.has(a[0]))
    .map(([cls, x, y, ai = 3, side = x < 0 ? 0 : 1]) => ({ cls, side, x, y, ai }));
  BATTLE.w = null; BATTLE.placed = []; BATTLE.pick = null;
}
function battleLeave(fromHash) {
  BATTLE.on = false;
  $('battle').hidden = true;
  $('app').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'map'));
  resizeCanvas();
  if (!fromHash) writeHash();
  renderCrumbs();
  renderPanel();
  redraw();
}

/* ---- the panel: the sides and controls, then the hangar ------------------ */

function battlePanel() {
  const top = $('battleTop'), D = flightData();
  if (!D) {
    top.innerHTML = `<p class="note">${SHIP_FILES.length || PENDING.some(f => f.role === 'ships') ? 'Reading the ships…' : 'No ships files are open.'}</p>`;
    $('battleRows').innerHTML = '';
    BATTLE.hangar = null;
    return;
  }
  if (BATTLE.want) battleTakeHash(D);
  BATTLE.govt = battleGovts(D);
  if (!BATTLE.govt || !battleEmptySystem()) { top.innerHTML = '<p class="note">The files have no two governments that are enemies, so no ships to fight.</p>'; $('battleRows').innerHTML = ''; BATTLE.hangar = null; return; }
  const w = BATTLE.w;
  const side = i => `<div class="battle-side" style="--side:${BATTLE_COLOURS[i]}">
      <div class="battle-row"><b>${i ? 'Right' : 'Left'}</b></div>
      <div class="battle-left" id="battleLeft${i}"></div></div>`;
  const speeds = FLIGHT_SPEEDS.map(v => `<button data-battle-do="speed:${v}" aria-pressed="${BATTLE.speed === v}">${v === 0.5 ? '½' : v}×</button>`).join('');
  const sides = [0, 1].map(i => BATTLE.setup.filter(e => e.side === i).length);
  const names = novaStrings(GAME, 138), kills = BATTLE_RATINGS.includes(BATTLE.kills) ? BATTLE_RATINGS : [...BATTLE_RATINGS, BATTLE.kills].sort((a, b) => a - b);
  const rating = kills.map(k => { const lv = BATTLE_RATINGS.findLastIndex(v => v <= k);
    return `<option value="${k}"${k === BATTLE.kills ? ' selected' : ''}>${esc(names[lv] || `rating ${lv}`)} (${k.toLocaleString('en')} kills)</option>`; }).join('');
  top.innerHTML = `
    <div class="actions"><button data-battle-do="random">Random battle</button><label class="note"><select data-battle="side" aria-label="Ships a side in a random battle">${[5, 10, 20, 30].map(n => `<option${n === BATTLE.side ? ' selected' : ''}>${n}</option>`).join('')}</select> a side</label></div>
    <div class="battle-row"><span class="note">Your combat rating</span> <select data-battle="kills" aria-label="Your combat rating">${rating}</select></div>
    <label class="battle-row"><input type="checkbox" data-battle="ammo"${BATTLE.ammo ? ' checked' : ''}> Ammunition never runs out</label>
    ${side(0)}${side(1)}
    <div class="actions">${w ? '<button data-battle-do="setup">Set up again</button>' : `<button data-battle-do="fight"${sides[0] && sides[1] ? '' : ' disabled'}>Fight</button>`}<button data-battle-do="clear"${BATTLE.setup.length || w ? '' : ' disabled'}>Clear</button></div>
    ${w ? `<div class="actions"><button data-battle-do="pause">${BATTLE.paused ? 'Go on' : 'Pause'}</button>${speeds}<button data-battle-do="follow" aria-pressed="${BATTLE.follow}">Follow</button></div>` : ''}
    <p class="note" id="battleResult"></p>
    ${w ? '<div id="battleInspect"></div>' : ''}`;
  battleStatus(true);
  battleInspect(true);
  battleHangar(D);
  battleWriteHash();
}

/* The hangar: every class that can fly, heaviest first as a shipyard lists
   them, each a row with its picture, that drags, or taps to be the ship
   the arena's next tap puts down; its number links to it in the Ships
   view. Classes that share a look are one row, as in the Ships view,
   which drags the first of them and opens on a tap to list them all; a
   search opens every look with a match. */
function battleHangar(D) {
  if (BATTLE.hangar !== D) {
    BATTLE.hangar = D;
    BATTLE.open = new Set();
    BATTLE.classes = [...D.classes.values()].filter(c => !c.missing && c.sprite > 0)
      .sort((a, b) => (b.rec.DispWeight || 0) - (a.rec.DispWeight || 0) || a.id - b.id);
  }
  battleFilter();
}
function battleFilter() {
  const all = BATTLE.classes || [], q = BATTLE.q.trim().toLowerCase();
  const match = c => !q || String(c.id) === q || (c.name + ' ' + (c.rec.Subtitle || '')).toLowerCase().includes(q);
  const groups = new Map();
  for (const c of all) { if (!groups.has(c.sprite)) groups.set(c.sprite, []); groups.get(c.sprite).push(c); }
  const row = (c, sub) => `<div class="shipRow battleShip${sub ? ' sub' : ''}" data-bcls="${c.id}">${sub ? '' : '<canvas class="thumb" width="44" height="44"></canvas>'}` +
    `<span class="nm">${esc(c.name)}${c.rec.Subtitle ? `<small>${esc(c.rec.Subtitle)}</small>` : ''}</span>` +
    `<a class="id" data-binfo="${c.id}" title="In the Ships view">${c.id}</a></div>`;
  let html = '', n = 0;
  for (const [k, g] of groups) {
    const m = g.filter(match);
    if (!m.length) continue;
    n += m.length;
    if (g.length === 1) { html += row(g[0], false); continue; }
    const open = !!q || BATTLE.open.has(k), names = [...new Set(g.map(c => c.name))];
    html += `<div class="shipRow battleShip look" data-bcls="${g[0].id}" data-blook="${k}" aria-expanded="${open}"><canvas class="thumb" width="44" height="44"></canvas>` +
      `<span class="nm">${esc(names.join(' / '))}<small>${g.length} ship classes</small></span><span class="count">${open ? '▾' : '▸'}</span></div>`;
    if (open) html += m.map(c => row(c, true)).join('');
  }
  const el = $('battleRows'), top = el.scrollTop;
  el.innerHTML = html;
  el.scrollTop = top;
  $('battleCount').textContent = `${n} ship${n === 1 ? '' : 's'}`;
  battleArmMark();
  battleThumbs(BATTLE.hangar);
}
function battleArmMark() {
  for (const r of $('battleRows').children) r.classList.toggle('on', +r.dataset.bcls === BATTLE.armed && !r.dataset.blook);
}
// Each row's picture, the class's base sprite at the frame facing right, a few rows at a time.
let BATTLE_THUMBS = 0;
function battleThumbs(D) {
  const job = ++BATTLE_THUMBS, todo = [...$('battleRows').querySelectorAll('canvas.thumb')];
  const step = () => {
    if (job !== BATTLE_THUMBS) return;
    const t0 = performance.now();
    while (todo.length && performance.now() - t0 < 12) {
      const c = todo.shift(), cls = D.classes.get(+c.parentNode.dataset.bcls);
      const img = cls && battleShipImage(cls, 90);
      if (!img) continue;
      const k = Math.min(c.width / img.width, c.height / img.height, 1.5), ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = k < 1;
      ctx.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
    }
    if (todo.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
// A class's base sprite at a heading (its first set).
function battleShipImage(cls, heading) {
  const spr = shipSprite(cls.sprite);
  if (!spr || spr.kind !== 'rle') return null;
  return shipFrame(spr, Math.trunc(heading * cls.framesPer / 360) % spr.count);
}

// How each side is doing: before the fight its ships; in it, those fighting, disabled, destroyed and gone, and who has won.
function battleStatus(force) {
  const w = BATTLE.w;
  if (!w) {
    [0, 1].forEach(i => { const el = $('battleLeft' + i); if (el) { const n = BATTLE.setup.filter(e => e.side === i).length; el.textContent = n ? `${n} ship${n === 1 ? '' : 's'}` : `Drop ships on the ${i ? 'right' : 'left'}.`; } });
    return;
  }
  const rows = [0, 1].map(i => {
    const placed = BATTLE.placed.filter(p => p.side === i);
    const here = placed.filter(p => w.ships[p.slot] === p.ship), up = here.filter(p => !p.ship.disabled);
    const gone = placed.filter(p => w.ships[p.slot] !== p.ship), dead = gone.filter(p => w.gone.some(g => g.ship === p.ship && g.how === 'destroyed')).length;
    return { placed, here, up, dead, fled: gone.length - dead };
  });
  const key = rows.map(r => `${r.placed.length}/${r.up.length}/${r.here.length}/${r.dead}`).join(' ');
  if (!force && key === BATTLE.shown) return;
  BATTLE.shown = key;
  rows.forEach((r, i) => {
    const el = $('battleLeft' + i);
    if (!el) return;
    const bits = [`${r.up.length} of ${r.placed.length} fighting`];
    if (r.here.length > r.up.length) bits.push(`${r.here.length - r.up.length} disabled`);
    if (r.dead) bits.push(`${r.dead} destroyed`);
    if (r.fled) bits.push(`${r.fled} gone`);
    el.textContent = bits.join(', ');
  });
  const res = $('battleResult');
  if (res) res.textContent = rows[0].up.length && !rows[1].up.length ? 'The left side has the field.' : rows[1].up.length && !rows[0].up.length ? 'The right side has the field.' : !rows[0].up.length && !rows[1].up.length ? 'Neither side has a ship left fighting.' : '';
}
function battleChange(e) {
  const t = e.target.closest('[data-battle]');
  if (!t || !BATTLE.on) return;
  const [k, i] = t.dataset.battle.split(':');
  if (k === 'ammo') { BATTLE.ammo = t.checked; battleWriteHash(); }
  else if (k === 'many') BATTLE.many = +t.value;
  else if (k === 'ai') BATTLE.ai = +t.value;
  else if (k === 'side') BATTLE.side = +t.value;
  else if (k === 'kills') { BATTLE.kills = +t.value; if (BATTLE.w) BATTLE.w.kills = BATTLE.kills; battleWriteHash(); }
}
function battleDo(what) {
  if (what === 'pause') { BATTLE.paused = !BATTLE.paused; battleRun(); }
  else if (what === 'follow') BATTLE.follow = !BATTLE.follow;
  else if (what.startsWith('speed:')) BATTLE.speed = +what.slice(6);
  else if (what === 'unpick') BATTLE.pick = null;
  else if (what === 'clear') { BATTLE.pick = null; BATTLE.setup = []; BATTLE.placed = []; BATTLE.w = null; }
  else if (what === 'setup') { BATTLE.pick = null; BATTLE.w = null; BATTLE.placed = []; BATTLE.follow = true; }
  else if (what === 'fight') battleFight();
  else if (what === 'random') battleRandom();
  battlePanel();
  battleDraw();
}

/* ---- the arena ------------------------------------------------------------ */

// `n` ships of a class put down at (x, y) in the arena's units, in a column, flying as AI type `ai` (0 its class's): before the fight on the arena, in it into the fight.
function battleDrop(clsId, x, y, n, ai = 3) {
  const side = x < 0 ? 0 : 1;
  for (let k = 0; k < n; k++) {
    const yy = y + (k - (n - 1) / 2) * BATTLE_GAP;
    if (!BATTLE.w) BATTLE.setup.push({ cls: clsId, side, x, y: yy, ai });
    else {
      const s = novaPlaceShip(BATTLE.w, clsId, BATTLE.govt[side], x, yy, ai, BATTLE_FACING[side]);
      if (s) { s.frame = novaShipFrame(s); BATTLE.placed.push(battleStock({ side, slot: s.slot, ship: s })); }
    }
  }
  if (!BATTLE.w) battlePanel(); else battleStatus(true);
  battleDraw();
}
/* The two sides' governments: the Federation and the Auroran Empire, or
   in other files the first two (by number) each the other's enemy, as
   GovtEnemies has it both ways round; null when there are none. */
function battleGovts(D) {
  const ids = [...D.govts.keys()].filter(novaGovtOk).sort((a, b) => a - b);
  const named = name => ids.find(id => { const g = U.govts.get(id); return g && g.name === name; });
  const foes = (a, b) => a !== undefined && b !== undefined && novaGovtEnemies(D, a, b) && novaGovtEnemies(D, b, a);
  const fed = named('Federation'), aur = named('Auroran Empire');
  if (foes(fed, aur)) return [fed, aur];
  for (const a of ids) for (const b of ids) if (a < b && foes(a, b)) return [a, b];
  return null;
}
/* A random battle (the maintainer's asking): each `BATTLE.side` ships of any class that fights --
   Warship or Interceptor by its InherentAI, with a weapon that does
   damage or a fighter bay, able to move, not
   planet-type -- whoever flies it in the game. Twice as many are drawn,
   and dealt strongest first to the side with the less Strength so far,
   so the two come out about even. They are scattered over the arena, the
   sides mixed, flying as Flies as says. */
function battleRandom() {
  const D = flightData();
  if (!D) return;
  if (!battleGovts(D)) return;
  const fights = [...D.classes.values()].filter(c => {
    const f = novaClassFight(D, c);
    const armed = f.count.some((n, i) => { const W = n > 0 && novaWeapOf(D, i); return W && (W.mass > 0 || W.energy > 0 || W.guid === 99); });
    return !c.missing && c.ai >= 3 && c.speed > 0 && !(c.flags & 0x0400) && f.strength > 0 && armed;
  });
  if (!fights.length) return;
  const pick = l => l[Math.floor(Math.random() * l.length)];
  const drawn = Array.from({ length: 2 * BATTLE.side }, () => pick(fights)).sort((a, b) => novaClassFight(D, b).strength - novaClassFight(D, a).strength);
  const sides = [[], []], sum = [0, 0];
  for (const c of drawn) {
    const k = sides[0].length >= BATTLE.side ? 1 : sides[1].length >= BATTLE.side ? 0 : sum[0] <= sum[1] ? 0 : 1;
    sides[k].push(c); sum[k] += novaClassFight(D, c).strength;
  }
  BATTLE.w = null; BATTLE.placed = []; BATTLE.pick = null; BATTLE.follow = true;
  BATTLE.setup = [];
  const R = 250 + 45 * Math.sqrt(2 * BATTLE.side), at = [];
  for (const k of [0, 1]) for (const c of sides[k]) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 50; tries++) {
      const a = Math.random() * 2 * Math.PI, d = R * Math.sqrt(Math.random());
      x = Math.round(d * Math.cos(a)); y = Math.round(d * Math.sin(a));
      if (at.every(p => Math.hypot(p[0] - x, p[1] - y) >= 90)) break;
    }
    at.push([x, y]);
    BATTLE.setup.push({ cls: c.id, side: k, x, y, ai: BATTLE.ai });
  }
  BATTLE.strength = sum;
}
// Empty space: Sol's system with no stellars and no asteroids, a system of its own (-1).
function battleEmptySystem() {
  const base = U.byId.get(130) || U.byId.values().next().value;
  return base && { ...base, id: -1, name: 'Empty space', rec: { ...base.rec, Asteroids: 0, Nav: new Array(16).fill(-1) } };
}
/* The arena's ships put in empty space, each where it was set and facing
   the other side, and nothing else there; none retreats or leaves. */
function battleFight() {
  const D = flightData(), sys = battleEmptySystem();
  if (!D || !sys || !BATTLE.govt) return;
  const w = novaFlightWorld(D, sys, STATE, Math.floor(Math.random() * 0x7fffffff), battleView());
  w.kills = BATTLE.kills;
  for (let i = 0; i < 64; i++) w.ships[i] = null;
  w.noArrivals = true;
  w.noRetreat = true;
  BATTLE.w = w; BATTLE.placed = []; BATTLE.shown = '';
  for (const e of BATTLE.setup) {
    const s = novaPlaceShip(w, e.cls, BATTLE.govt[e.side], e.x, e.y, e.ai, BATTLE_FACING[e.side]);
    if (s) BATTLE.placed.push(battleStock({ side: e.side, slot: s.slot, ship: s }));
  }
  for (const s of w.ships) if (s) s.frame = novaShipFrame(s);
  BATTLE.follow = true;
  BATTLE.paused = false;
  battleRun();
}
// What a ship starts with, for Ammunition never runs out: each weapon's ammunition, and its fuel.
function battleStock(p) { p.ammo = p.ship.weap.map(r => r.ammo); p.fuel = p.ship.fuel; return p; }
function battleRefill(w) {
  for (const p of BATTLE.placed) {
    if (w.ships[p.slot] !== p.ship) continue;
    p.ship.weap.forEach((r, k) => { if (r.ammo < p.ammo[k]) r.ammo = p.ammo[k]; });
    if (p.ship.fuel < p.fuel) p.ship.fuel = p.fuel;
  }
}
const battleAiOk = ai => ai === 0 || ai in NOVA_AI_TYPES;
// The arena's ship at a point on the screen, before the fight.
function battleSetupAt(px, py) {
  const D = flightData();
  if (!D || BATTLE.w) return -1;
  const c = BATTLE.cam;
  for (let i = BATTLE.setup.length - 1; i >= 0; i--) {
    const e = BATTLE.setup[i], cls = D.classes.get(e.cls), img = cls && battleShipImage(cls, BATTLE_FACING[e.side]);
    const r = Math.max(MIN_SHIP, (img ? Math.max(img.width, img.height) : 32) * c.s) / 2 + 4;
    const [x, y] = battleToScreen(e.x, e.y);
    if (Math.abs(px - x) <= r && Math.abs(py - y) <= r) return i;
  }
  return -1;
}
const battleToScreen = (x, y) => [(x - BATTLE.cam.x) * BATTLE.cam.s + BATTLE.cw / 2, (y - BATTLE.cam.y) * BATTLE.cam.s + BATTLE.ch / 2];
const battleFromScreen = (px, py) => [(px - BATTLE.cw / 2) / BATTLE.cam.s + BATTLE.cam.x, (py - BATTLE.ch / 2) / BATTLE.cam.s + BATTLE.cam.y];

/* ---- the ship inspector ---------------------------------------------------- */

/* A ship tapped in the fight: its shields, armour, fuel, what it is doing
   and to whom, and each weapon's count, ammunition and reload, kept up to
   date about ten times a second. The states named are those the
   program's own routines name (IsShipAttacking, AIShipIsPlundering,
   AIShipIsAttackingAsteroid); the rest are given by number. */
const BATTLE_STATES = { 4: 'attacking', 0xd: 'plundering', 0x10: 'attacking an asteroid' };
// The fight's ship at a point on the screen, the nearest within its ring.
function battleShipAt(px, py) {
  const w = BATTLE.w, D = flightData();
  if (!w || !D) return null;
  let best = null, bd = Infinity;
  for (const s of w.ships) {
    if (!s) continue;
    const spr = shipSprite(s.cls.sprite), m = Math.max(MIN_SHIP, (spr && spr.width ? Math.max(spr.width, spr.height) : 32) * BATTLE.cam.s);
    const [x, y] = battleToScreen(s.x, s.y), d = Math.hypot(px - x, py - y);
    if (d <= m * 0.62 + 12 && d < bd) { best = s; bd = d; }
  }
  return best;
}
function battleInspect(force) {
  const el = $('battleInspect'), w = BATTLE.w;
  if (!el) return;
  const s = BATTLE.pick;
  if (!force && performance.now() - BATTLE.pickShown < 100) return;
  BATTLE.pickShown = performance.now();
  if (!s || !w) { el.innerHTML = w ? '<p class="note">Tap a ship to see inside it.</p>' : ''; return; }
  const D = w.D, here = w.ships[s.slot] === s;
  const name = x => `${esc(x.cls.name)} <span class="id">#${x.cls.id}</span>`;
  const bar = (v, cap) => cap > 0 ? `${Math.max(0, Math.round(v))} of ${cap}` : '—';
  const gone = here ? '' : (w.gone.find(g => g.ship === s) || {}).how || 'gone';
  const t = s.primary >= 0 ? w.ships[s.primary] : null;
  const doing = !here ? esc(gone) : s.disabled ? 'disabled' : (BATTLE_STATES[s.state] || `AI state ${s.state}`) + (t ? ` ${name(t)}` : '');
  const wr = s.weap.filter(r => r.count > 0).map(r => {
    const W = novaWeapOf(D, r.i);
    if (!W) return '';
    const A = W.ammoType, ammo = W.guid === 99 || (A >= 0 && A <= 255) ? r.ammo : '';
    return `<tr><td>${esc(W.name)}${r.count > 1 ? ` ×${r.count}` : ''}</td><td>${ammo}</td><td>${r.reload > 0 ? Math.ceil(r.reload) : 'ready'}</td></tr>`;
  }).join('');
  el.innerHTML = `<div class="battle-inspect"><div class="battle-row"><b>${name(s)}</b> <button data-battle-do="unpick" aria-label="Close">×</button></div>
    <table class="kv"><tr><td>Doing</td><td>${doing}</td></tr>
    <tr><td>Flies as</td><td>${esc(NOVA_AI_TYPES[s.ai] || `AI type ${s.ai}`)}</td></tr>
    <tr><td>Shields</td><td>${bar(s.shield, novaShieldCap(D, s))}</td></tr>
    <tr><td>Armour</td><td>${bar(s.armor, novaArmorCap(D, s))}</td></tr>
    ${s.cloak > 0 || s.cloakDir ? `<tr><td>Cloak</td><td>${novaCloaked(s) ? 'cloaked' : s.cloakDir > 0 ? 'cloaking' : 'uncloaking'} (${Math.round(s.cloak)} of 32)</td></tr>` : ''}
    ${s.ion > 0 ? `<tr><td>Ionization</td><td>${bar(s.ion, s.cls.ionMax)}</td></tr>` : ''}
    <tr><td>Fuel</td><td>${Math.round(s.fuel)}</td></tr></table>
    ${wr ? `<table class="kv"><tr><td>Weapon</td><td>Ammo</td><td>Reload</td></tr>${wr}</table>` : '<p class="note">No weapons.</p>'}</div>`;
}

/* ---- running and drawing ------------------------------------------------ */

// The battle's screen in system units, for the asteroids, which gather round it.
function battleView() {
  const c = BATTLE.cam;
  return { x: c.x, y: c.y, hw: (BATTLE.cw || 640) / 2 / c.s, hh: (BATTLE.ch || 480) / 2 / c.s };
}
function battleLoop(now) {
  BATTLE.tick = null;
  if (!BATTLE.on) return;
  if (BATTLE.w && !BATTLE.paused) {
    if (BATTLE.last) BATTLE.due = Math.min(BATTLE.due + (now - BATTLE.last) * 0.03 * BATTLE.speed, 4 * BATTLE.speed);
    BATTLE.last = now;
    for (; BATTLE.due >= 1; BATTLE.due--) {
      BATTLE.w.view = battleView();
      novaFlightStep(BATTLE.w);
      if (BATTLE.ammo) battleRefill(BATTLE.w);
    }
    battleStatus(false);
    battleInspect(false);
  } else BATTLE.last = 0;
  battleAim(false);
  battleDraw();
  BATTLE.tick = requestAnimationFrame(battleLoop);
}
function battleRun() { if (BATTLE.on && !BATTLE.tick) { BATTLE.last = 0; BATTLE.tick = requestAnimationFrame(battleLoop); } }

// Following: the middle of the ships (or the arena's, with fewer than two), zoomed to keep them on the screen, eased toward.
function battleAim(at) {
  if (!BATTLE.follow || BATTLE.drag) return;
  const pts = BATTLE.w ? BATTLE.w.ships.filter(Boolean) : BATTLE.setup;
  let x0 = -700, y0 = -450, x1 = 700, y1 = 450;
  if (pts.length > 1 || BATTLE.w) {
    if (!pts.length) return;
    x0 = Infinity; y0 = Infinity; x1 = -Infinity; y1 = -Infinity;
    for (const s of pts) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
    if (!BATTLE.w) { x0 = Math.min(x0, -700); x1 = Math.max(x1, 700); y0 = Math.min(y0, -450); y1 = Math.max(y1, 450); }
  }
  const pad = 160, s = Math.min(1.5, Math.max(0.05, Math.min(BATTLE.cw / (x1 - x0 + 2 * pad), BATTLE.ch / (y1 - y0 + 2 * pad))));
  const c = BATTLE.cam, k = at ? 1 : 0.08;
  c.x += ((x0 + x1) / 2 - c.x) * k; c.y += ((y0 + y1) / 2 - c.y) * k;
  c.s = Math.exp(Math.log(c.s) + (Math.log(s) - Math.log(c.s)) * k);
}
function battleResize() {
  const cv = $('battleCanvas'), r = $('battleStage').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  BATTLE.cw = Math.max(1, Math.round(r.width)); BATTLE.ch = Math.max(1, Math.round(r.height));
  cv.width = Math.round(BATTLE.cw * dpr); cv.height = Math.round(BATTLE.ch * dpr);
  cv.style.width = BATTLE.cw + 'px'; cv.style.height = BATTLE.ch + 'px';
  battleAim(true);
  battleDraw();
}
function battleDraw() {
  const cv = $('battleCanvas');
  if (!cv || !BATTLE.on) return;
  const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, W = BATTLE.cw, H = BATTLE.ch, c = BATTLE.cam, D = flightData();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const [mx] = battleToScreen(0, 0), w = BATTLE.w;
  // before the fight, each side's half faintly in its colour, and the middle
  if (!w) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = BATTLE_COLOURS[0]; ctx.fillRect(0, 0, Math.max(0, Math.min(W, mx)), H);
    ctx.fillStyle = BATTLE_COLOURS[1]; ctx.fillRect(Math.max(0, mx), 0, W, H);
    ctx.globalAlpha = 1;
  }
  // a faint grid every 500 units, for a sense of motion
  const g = 500 * c.s;
  if (g > 24) {
    ctx.strokeStyle = '#0d1420'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = ((W / 2 - c.x * c.s) % g + g) % g; x < W; x += g) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
    for (let y = ((H / 2 - c.y * c.s) % g + g) % g; y < H; y += g) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
    ctx.stroke();
  }
  const ring = (x, y, size, i, faint) => {
    ctx.save(); ctx.globalAlpha = faint ? 0.3 : 0.75; ctx.strokeStyle = BATTLE_COLOURS[i]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, size * 0.62 + 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };
  if (!w) {
    if (mx > 0 && mx < W) { ctx.strokeStyle = '#2a3446'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(Math.round(mx) + 0.5, 0); ctx.lineTo(Math.round(mx) + 0.5, H); ctx.stroke(); ctx.setLineDash([]); }
    if (D) for (const e of BATTLE.setup) {
      const cls = D.classes.get(e.cls), img = cls && battleShipImage(cls, BATTLE_FACING[e.side]);
      const [x, y] = battleToScreen(e.x, e.y);
      let wd = (img ? img.width : 32) * c.s, ht = (img ? img.height : 32) * c.s;
      const m = Math.max(wd, ht);
      if (m < MIN_SHIP) { wd *= MIN_SHIP / m; ht *= MIN_SHIP / m; }
      ring(x, y, Math.max(wd, ht), e.side, false);
      if (img) { ctx.imageSmoothingEnabled = wd < img.width; ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht); }
    }
    if (!BATTLE.setup.length) {
      ctx.fillStyle = '#5b6a82'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Drag ships here from the hangar: the left side, the right side.', W / 2, H / 2);
    }
    return;
  }
  const side = new Map(BATTLE.placed.map(p => [p.ship, p.side]));
  // each ship of a side ringed in its colour, faintly when disabled; one that joined (a fighter, a capture) its lead's
  const mark = (ctx2, s, x, y, size) => {
    let i = side.get(s);
    if (i === undefined) { const l = s.leader >= 0 ? w.ships[s.leader] : null; i = l ? side.get(l) : undefined; }
    if (i !== undefined) ring(x, y, size, i, s.disabled);
  };
  drawFlightThings(ctx, w, battleToScreen, c.s, 1, mark, W, H);
  // the inspected ship ringed in white, and a line to its target
  const p = BATTLE.pick;
  if (p && w.ships[p.slot] === p) {
    const [x, y] = battleToScreen(p.x, p.y), spr = shipSprite(p.cls.sprite), m = Math.max(MIN_SHIP, (spr && spr.width ? Math.max(spr.width, spr.height) : 32) * c.s);
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, m * 0.62 + 6, 0, Math.PI * 2); ctx.stroke();
    const t = p.primary >= 0 ? w.ships[p.primary] : null;
    if (t) { const [tx, ty] = battleToScreen(t.x, t.y); ctx.globalAlpha = 0.4; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); }
    ctx.restore();
  }
}

/* ---- dragging, tapping, zooming ------------------------------------------ */

function wireBattle() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    if (a.dataset.view === 'battle') { e.preventDefault(); e.stopImmediatePropagation(); if (!BATTLE.on) battleShow(); }
    else if (BATTLE.on) { e.preventDefault(); battleLeave(); }
  }, true);
  document.addEventListener('change', battleChange);
  $('battleTop').addEventListener('click', e => {
    const b = e.target.closest('[data-battle-do]');
    if (b) { e.preventDefault(); battleDo(b.dataset.battleDo); }
  });
  $('battleSearch').addEventListener('input', e => { BATTLE.q = e.target.value; battleFilter(); });

  const cv = $('battleCanvas'), pts = new Map();
  let pinch = null, ghost = null, press = null;
  const hand = () => { if (BATTLE.follow) { BATTLE.follow = false; battlePanel(); } };
  const zoomAt = (px, py, f) => {
    const c = BATTLE.cam, r = cv.getBoundingClientRect(), x = px - r.left - BATTLE.cw / 2, y = py - r.top - BATTLE.ch / 2;
    const s = Math.min(4, Math.max(0.02, c.s * f));
    c.x += x / c.s - x / s; c.y += y / c.s - y / s; c.s = s;
    battleDraw();
  };
  const onArena = (cx, cy) => { const r = cv.getBoundingClientRect(); return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom ? [cx - r.left, cy - r.top] : null; };
  const showGhost = (clsId, cx, cy) => {
    if (!ghost) { ghost = document.createElement('canvas'); ghost.className = 'battleGhost'; document.body.appendChild(ghost); }
    const D = flightData(), cls = D && D.classes.get(clsId), img = cls && battleShipImage(cls, 90);
    if (img && ghost.dataset.cls !== String(clsId)) {
      const k = Math.min(1, 72 / Math.max(img.width, img.height));
      ghost.width = Math.max(1, Math.round(img.width * k)); ghost.height = Math.max(1, Math.round(img.height * k));
      ghost.getContext('2d').drawImage(img, 0, 0, ghost.width, ghost.height);
      ghost.dataset.cls = String(clsId);
    }
    ghost.style.left = (cx - ghost.width / 2) + 'px'; ghost.style.top = (cy - ghost.height / 2) + 'px';
  };
  const dropGhost = () => { if (ghost) { ghost.remove(); ghost = null; } };

  // From the hangar: a drag (any way with a mouse, sideways with a finger, so that the list still scrolls), or a tap to choose the ship for the arena's next tap.
  $('battleRows').addEventListener('pointerdown', e => {
    const row = e.target.closest('[data-bcls]');
    if (!row || e.target.closest('[data-binfo]')) return;
    press = { id: e.pointerId, cls: +row.dataset.bcls, look: row.dataset.blook !== undefined ? +row.dataset.blook : undefined, x: e.clientX, y: e.clientY, dragging: false, mouse: e.pointerType === 'mouse' };
  });
  window.addEventListener('pointermove', e => {
    if (!press || press.id !== e.pointerId) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.dragging) {
      if (Math.abs(dx) + Math.abs(dy) < 8) return;
      if (!press.mouse && Math.abs(dx) < Math.abs(dy)) { press = null; return; }   // a scroll of the list
      press.dragging = true;
      BATTLE.drag = true;
      try { $('battleRows').setPointerCapture(e.pointerId); } catch (_) { /* gone */ }
    }
    e.preventDefault();
    showGhost(press.cls, e.clientX, e.clientY);
  }, { passive: false });
  const endPress = e => {
    if (!press || press.id !== e.pointerId) return;
    const p = press;
    press = null; BATTLE.drag = false;
    dropGhost();
    if (!p.dragging) {
      if (e.type === 'pointerup') {
        if (p.look !== undefined) { if (!BATTLE.open.delete(p.look)) BATTLE.open.add(p.look); battleFilter(); }
        else { BATTLE.armed = BATTLE.armed === p.cls ? null : p.cls; battleArmMark(); }
      }
      return;
    }
    const at = e.type === 'pointerup' && onArena(e.clientX, e.clientY);
    if (at) { const [x, y] = battleFromScreen(at[0], at[1]); battleDrop(p.cls, x, y, BATTLE.many, BATTLE.ai); }
  };
  window.addEventListener('pointerup', endPress);
  window.addEventListener('pointercancel', endPress);
  $('battleRows').addEventListener('click', e => {
    const i = e.target.closest('[data-binfo]');
    if (i) { e.preventDefault(); battleLeave(); shipsShow(+i.dataset.binfo); }
  });

  // On the arena: before the fight a ship drags to move, off the arena to go; a tap puts down the chosen ship; else a drag pans and two fingers zoom.
  let moving = null, tapAt = null;
  cv.addEventListener('wheel', e => { e.preventDefault(); hand(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* a pointer the browser does not know */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch = null;
    const r = cv.getBoundingClientRect(), i = pts.size === 1 ? battleSetupAt(e.clientX - r.left, e.clientY - r.top) : -1;
    moving = i >= 0 ? { i, id: e.pointerId } : null;
    if (moving) BATTLE.drag = true;
    tapAt = pts.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (tapAt && Math.abs(e.clientX - tapAt.x) + Math.abs(e.clientY - tapAt.y) > 6) tapAt = null;
    if (moving && moving.id === e.pointerId) {
      const r = cv.getBoundingClientRect(), at = onArena(e.clientX, e.clientY), en = BATTLE.setup[moving.i];
      if (at) { const [x, y] = battleFromScreen(e.clientX - r.left, e.clientY - r.top); en.x = x; en.y = y; en.side = x < 0 ? 0 : 1; dropGhost(); }
      else showGhost(en.cls, e.clientX, e.clientY);
      battleDraw();
      return;
    }
    if (pts.size === 1) {
      const c = BATTLE.cam;
      if (!tapAt) hand();
      c.x -= (e.clientX - p.x) / c.s; c.y -= (e.clientY - p.y) / c.s;
      p.x = e.clientX; p.y = e.clientY;
      battleDraw();
    } else if (pts.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) { hand(); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch); }
      pinch = d;
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId); pinch = null;
    if (moving && moving.id === e.pointerId) {
      if (e.type !== 'pointerup' || !onArena(e.clientX, e.clientY)) BATTLE.setup.splice(moving.i, 1);
      moving = null; BATTLE.drag = false; dropGhost();
      battlePanel(); battleDraw();
      return;
    }
    if (tapAt && e.type === 'pointerup' && BATTLE.armed !== null) {
      const r = cv.getBoundingClientRect(), [x, y] = battleFromScreen(e.clientX - r.left, e.clientY - r.top);
      battleDrop(BATTLE.armed, x, y, BATTLE.many, BATTLE.ai);
    } else if (tapAt && e.type === 'pointerup' && BATTLE.w) {
      const r = cv.getBoundingClientRect();
      BATTLE.pick = battleShipAt(e.clientX - r.left, e.clientY - r.top);
      battleInspect(true); battleDraw();
    }
    tapAt = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => { if (BATTLE.on) battleResize(); });
}
wireBattle();
