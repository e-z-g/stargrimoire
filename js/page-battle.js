/* page-battle.js -- the battle simulator, a view of its own.
   =========================================================================

   Two sides, each a government and ships of any class, put in a system of
   the player's choosing (its asteroids and interference are the system's)
   with no other ship arriving, to fight by the game's rules as
   nova-flight.js and nova-fight.js have them. Ships fight only when their
   governments are enemies, as in the game. The view follows the fight,
   zooming to keep every ship on the screen, until it is zoomed or dragged
   by hand; Follow takes it back.

   The bar's Battle, and the address #battle (the maintainer's asking, 1
   October 2026: it was a part of a system's panel on the map).

   The page's own script: DOM here. LOAD ORDER: after page-flight.js, whose
   flightData and drawFlightThings it uses. */

const BATTLE = {
  on: false, sys: null, govt: [null, null], cls: [null, null], n: [1, 1], sides: [[], []],
  w: null, placed: [], paused: false, speed: 1, due: 0, last: 0, tick: null,
  cam: { x: 0, y: 0, s: 0.6 }, follow: true, shown: '', cw: 0, ch: 0,
};
const BATTLE_COLOURS = ['#5fa8ff', '#ff7a5f'];

/* ---- in and out of the view -------------------------------------------- */

function battleFromHash() {
  if (!/(^#|&)battle\b/.test(location.hash)) { if (BATTLE.on) battleLeave(true); return false; }
  battleShow({ fromHash: true });
  return true;
}
// Other files: the battle's world goes with the records it was made of.
function battleReset() { BATTLE.w = null; BATTLE.placed = []; if (BATTLE.on) battlePanel(); }
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
  if (!opts.fromHash && location.hash !== '#battle') history.pushState(null, '', '#battle');
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

/* ---- the sides ------------------------------------------------------------ */

function battlePanel() {
  const el = $('battleSide');
  const D = flightData();
  if (!D) {
    el.innerHTML = `<h3>Battle</h3><p class="note">${SHIP_FILES.length || PENDING.some(f => f.role === 'ships') ? 'Reading the ships…' : 'No ships files are open.'}</p>`;
    return;
  }
  const govts = [...U.govts.values()].filter(g => D.govts.has(g.id)).sort((a, b) => a.id - b.id);
  const classes = [...D.classes.values()].filter(c => !c.missing && c.sprite > 0).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  const systems = [...U.byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  if (!govts.length || !classes.length || !systems.length) { el.innerHTML = '<h3>Battle</h3><p class="note">The files have no ships to fight.</p>'; return; }
  if (BATTLE.sys === null || !U.byId.has(BATTLE.sys)) BATTLE.sys = VIEW.sys !== null && U.byId.has(VIEW.sys) ? VIEW.sys : U.byId.has(130) ? 130 : systems[0].id;
  const named = new Map();
  for (const c of classes) named.set(c.name, (named.get(c.name) || 0) + 1);
  for (let i = 0; i < 2; i++) {
    if (BATTLE.govt[i] === null || !D.govts.has(BATTLE.govt[i])) BATTLE.govt[i] = govts[Math.min(i, govts.length - 1)].id;
    if (BATTLE.cls[i] === null || !D.classes.has(BATTLE.cls[i])) BATTLE.cls[i] = classes[0].id;
  }
  const w = BATTLE.w;
  const side = i => {
    const g = govts.map(x => `<option value="${x.id}"${x.id === BATTLE.govt[i] ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    const c = classes.map(x => `<option value="${x.id}"${x.id === BATTLE.cls[i] ? ' selected' : ''}>${esc(x.name)}${named.get(x.name) > 1 ? ` (${x.id})` : ''}</option>`).join('');
    const n = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map(k => `<option${k === BATTLE.n[i] ? ' selected' : ''}>${k}</option>`).join('');
    const list = BATTLE.sides[i].map((e, j) => `<li>${esc(D.classes.get(e.cls).name)}${e.n > 1 ? ` × ${e.n}` : ''} <a data-battle-do="del:${i}:${j}" title="Take off">✕</a></li>`).join('');
    return `<div class="battle-side" style="--side:${BATTLE_COLOURS[i]}">
      <div class="battle-row"><b>Side ${i + 1}</b> <select data-battle="govt:${i}" aria-label="Side ${i + 1}'s government">${g}</select></div>
      <div class="battle-row"><select data-battle="cls:${i}" aria-label="Ship">${c}</select> <select data-battle="n:${i}" aria-label="How many">${n}</select> <button data-battle-do="add:${i}">Add</button></div>
      ${list ? `<ul>${list}</ul>` : '<p class="note">No ships yet.</p>'}
      <div class="battle-left" id="battleLeft${i}"></div></div>`;
  };
  const sysOpts = systems.map(x => `<option value="${x.id}"${x.id === BATTLE.sys ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const foes = novaGovtEnemies(D, BATTLE.govt[0], BATTLE.govt[1]) || [0, 1].some(i => { const g = D.govts.get(BATTLE.govt[i]); return g && (g.flags & 1) && !novaGovtAllies(D, BATTLE.govt[0], BATTLE.govt[1]); });
  const speeds = FLIGHT_SPEEDS.map(v => `<button data-battle-do="speed:${v}" aria-pressed="${BATTLE.speed === v}">${v === 0.5 ? '½' : v}×</button>`).join('');
  el.innerHTML = `<h3>Battle</h3>
    <div class="battle-row"><span class="note">In</span> <select data-battle="sys" aria-label="The system">${sysOpts}</select></div>
    ${side(0)}${side(1)}
    ${foes ? '' : '<p class="note">These governments are not enemies, so their ships will not fight.</p>'}
    <div class="actions"><button data-battle-do="fight"${BATTLE.sides[0].length && BATTLE.sides[1].length ? '' : ' disabled'}>${w ? 'Fight again' : 'Fight'}</button><button data-battle-do="clear">Clear</button></div>
    ${w ? `<div class="actions"><button data-battle-do="pause">${BATTLE.paused ? 'Go on' : 'Pause'}</button>${speeds}<button data-battle-do="follow" aria-pressed="${BATTLE.follow}">Follow</button></div>` : ''}
    <p class="note" id="battleResult"></p>`;
  battleStatus(true);
}
// How each side is doing: its ships left, disabled and gone; and who has won.
function battleStatus(force) {
  const w = BATTLE.w;
  if (!w) return;
  const rows = [0, 1].map(i => {
    const placed = BATTLE.placed.filter(p => p.side === i);
    const here = placed.filter(p => w.ships[p.slot] === p.ship), up = here.filter(p => !p.ship.disabled);
    const gone = placed.filter(p => w.ships[p.slot] !== p.ship), dead = gone.filter(p => w.gone.some(g => g.ship === p.ship && g.how === 'destroyed')).length;
    return { placed, here, up, dead, fled: gone.length - dead };
  });
  const key = rows.map(r => `${r.up.length}/${r.here.length}/${r.dead}`).join(' ');
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
  if (res) res.textContent = rows[0].up.length && !rows[1].up.length ? 'Side 1 has the field.' : rows[1].up.length && !rows[0].up.length ? 'Side 2 has the field.' : !rows[0].up.length && !rows[1].up.length ? 'Neither side has a ship left fighting.' : '';
}
function battleChange(e) {
  const t = e.target.closest('[data-battle]');
  if (!t || !BATTLE.on) return;
  const [k, i] = t.dataset.battle.split(':');
  if (k === 'sys') BATTLE.sys = +t.value;
  else BATTLE[k][+i] = +t.value;
  if (k === 'govt') battlePanel();
}
function battleDo(what) {
  if (what === 'pause') { BATTLE.paused = !BATTLE.paused; battleRun(); }
  else if (what === 'follow') BATTLE.follow = !BATTLE.follow;
  else if (what.startsWith('speed:')) BATTLE.speed = +what.slice(6);
  else if (what.startsWith('add:')) { const i = +what.slice(4); BATTLE.sides[i].push({ cls: BATTLE.cls[i], n: BATTLE.n[i] }); }
  else if (what.startsWith('del:')) { const [, i, j] = what.split(':'); BATTLE.sides[+i].splice(+j, 1); }
  else if (what === 'clear') { BATTLE.sides = [[], []]; BATTLE.placed = []; BATTLE.w = null; }
  else if (what === 'fight') battleFight();
  battlePanel();
  battleDraw();
}

/* Each side's ships put in the system, in a column 140 apart, 900 units
   from the other side, as warships, and nothing else there. */
function battleFight() {
  const D = flightData(), sys = U.byId.get(BATTLE.sys);
  if (!D || !sys) return;
  const w = novaFlightWorld(D, sys, STATE, Math.floor(Math.random() * 0x7fffffff), battleView());
  for (let i = 0; i < 64; i++) w.ships[i] = null;
  w.noArrivals = true;
  BATTLE.w = w; BATTLE.placed = []; BATTLE.shown = '';
  for (let i = 0; i < 2; i++) {
    const all = BATTLE.sides[i].flatMap(e => Array(e.n).fill(e.cls));
    all.forEach((cls, j) => {
      const s = novaPlaceShip(w, cls, BATTLE.govt[i], i ? 450 : -450, (j - (all.length - 1) / 2) * 140, 3);
      if (s) BATTLE.placed.push({ side: i, slot: s.slot, ship: s });
    });
  }
  for (const s of w.ships) if (s) s.frame = novaShipFrame(s);
  BATTLE.follow = true;
  BATTLE.paused = false;
  battleAim(true);
  battleRun();
}

/* ---- running and drawing ------------------------------------------------ */

// The battle's screen in system units, for the asteroids, which gather round it.
function battleView() {
  const c = BATTLE.cam;
  return { x: c.x, y: c.y, hw: (BATTLE.cw || 640) / 2 / c.s, hh: (BATTLE.ch || 480) / 2 / c.s };
}
function battleLoop(now) {
  BATTLE.tick = null;
  if (!BATTLE.on || !BATTLE.w || BATTLE.paused) { BATTLE.last = 0; battleDraw(); return; }
  if (BATTLE.last) BATTLE.due = Math.min(BATTLE.due + (now - BATTLE.last) * 0.03 * BATTLE.speed, 4 * BATTLE.speed);
  BATTLE.last = now;
  for (; BATTLE.due >= 1; BATTLE.due--) {
    BATTLE.w.view = battleView();
    novaFlightStep(BATTLE.w);
  }
  battleAim(false);
  battleDraw();
  battleStatus(false);
  BATTLE.tick = requestAnimationFrame(battleLoop);
}
function battleRun() { if (BATTLE.on && !BATTLE.tick) { BATTLE.last = 0; BATTLE.tick = requestAnimationFrame(battleLoop); } }

// Following: the middle of the ships, zoomed to keep them all on the screen, eased toward.
function battleAim(at) {
  const w = BATTLE.w;
  if (!w || !BATTLE.follow) return;
  const ships = w.ships.filter(Boolean);
  if (!ships.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of ships) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
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
  battleDraw();
}
function battleDraw() {
  const cv = $('battleCanvas');
  if (!cv || !BATTLE.on) return;
  const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, W = BATTLE.cw, H = BATTLE.ch, c = BATTLE.cam;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const at = (x, y) => [(x - c.x) * c.s + W / 2, (y - c.y) * c.s + H / 2];
  // a faint grid every 500 units, for a sense of motion
  const g = 500 * c.s;
  if (g > 24) {
    ctx.strokeStyle = '#0d1420'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = ((W / 2 - c.x * c.s) % g + g) % g; x < W; x += g) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
    for (let y = ((H / 2 - c.y * c.s) % g + g) % g; y < H; y += g) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
    ctx.stroke();
  }
  const w = BATTLE.w;
  if (!w) {
    ctx.fillStyle = '#5b6a82'; ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Give each side some ships, then Fight.', W / 2, H / 2);
    return;
  }
  const side = new Map(BATTLE.placed.map(p => [p.ship, p.side]));
  // each ship of a side ringed in its colour, faintly when disabled; a ship that joined (a fighter, a capture) ringed for its lead's side
  const mark = (ctx2, s, x, y, size) => {
    let i = side.get(s);
    if (i === undefined) { const l = s.leader >= 0 ? w.ships[s.leader] : null; i = l ? side.get(l) : undefined; }
    if (i === undefined) return;
    ctx2.save();
    ctx2.globalAlpha = s.disabled ? 0.3 : 0.75;
    ctx2.strokeStyle = BATTLE_COLOURS[i]; ctx2.lineWidth = 1.5;
    ctx2.beginPath(); ctx2.arc(x, y, size * 0.62 + 2, 0, Math.PI * 2); ctx2.stroke();
    ctx2.restore();
  };
  drawFlightThings(ctx, w, at, c.s, 1, mark, W, H);
}

/* ---- zoom and drag by hand ---------------------------------------------- */

function wireBattle() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    if (a.dataset.view === 'battle') { e.preventDefault(); e.stopImmediatePropagation(); if (!BATTLE.on) battleShow(); }
    else if (BATTLE.on) { e.preventDefault(); battleLeave(); }
  }, true);
  document.addEventListener('change', battleChange);
  $('battleSide').addEventListener('click', e => {
    const b = e.target.closest('[data-battle-do]');
    if (!b) return;
    e.preventDefault();
    battleDo(b.dataset.battleDo);
  });
  const cv = $('battleCanvas'), pts = new Map();
  let pinch = null;
  const hand = () => { if (BATTLE.follow) { BATTLE.follow = false; battlePanel(); } };
  const zoomAt = (px, py, f) => {
    const c = BATTLE.cam, r = cv.getBoundingClientRect(), x = px - r.left - BATTLE.cw / 2, y = py - r.top - BATTLE.ch / 2;
    const s = Math.min(4, Math.max(0.02, c.s * f));
    c.x += x / c.s - x / s; c.y += y / c.s - y / s; c.s = s;
    battleDraw();
  };
  cv.addEventListener('wheel', e => { e.preventDefault(); hand(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = null; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    if (pts.size === 1) {
      const c = BATTLE.cam;
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 0) hand();
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
  const up = e => { pts.delete(e.pointerId); pinch = null; };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  window.addEventListener('resize', () => { if (BATTLE.on) battleResize(); });
}
wireBattle();
