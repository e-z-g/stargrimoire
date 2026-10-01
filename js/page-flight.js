/* page-flight.js -- ships flying in the systems on the map.
   =========================================================================

   Each system whose stellars are drawn has a world of nova-flight.js's,
   set up as its stellars start to show, as the game sets one up when the
   player arrives, with a new seed each time, and dropped when they go, so
   its ships fade in and out with them. The game runs only the player's
   system; here each open one runs as if the player were there. Their
   ships come, go to the stellars and leave by their own AI, and only what
   is within a system's circle is drawn. They are stepped thirty times a
   second, as the game counts its time, or faster or slower by the panel's
   speed, all together, and not while paused, on a landing page, or with
   the map hidden. Where the browser asks for reduced motion they start
   paused. A hypergate a ship is coming out of opens (flightEngaged).

   The asteroids are the player's in the game, kept on and just off the
   player's screen; the map's view stands in for it (flightView), so they
   gather round what you are looking at and come in at its corners.

   Each ship is its base sprite at its heading's frame, as small as the
   system's scale makes it but never under MIN_SHIP pixels across, as a
   stellar is never under MIN_STELLAR. The sprites are the ships view's
   (shipSprite, shipFrame); the ships and sounds files are read after the
   pictures in a background thread (page-open.js), or on arriving in a
   system where there is none (wantShipFiles), and the ships come once they
   are.

   The page's own script: DOM here. LOAD ORDER: after page-map.js and
   page-ships.js, whose drawing and sprites it uses; page-map.js calls
   drawFlight, flightEngaged and flightPanel. */

const MIN_SHIP = 12, MIN_SHOT = 3;
const FLIGHT_SPEEDS = [0.5, 1, 2, 4];
const FLIGHT = { on: true, data: null, worlds: new Map(), sys: null, paused: false, started: false, speed: 1, due: 0, last: 0, tick: null, engaged: new Set(),
                 // the world of the system you are in, whose ships the panel lists
                 get world() { return this.sys === null ? null : this.worlds.get(this.sys) || null; } };

// The ships' records, once the shäns are read (they are in the ships files).
function flightData() {
  if (FLIGHT.data && FLIGHT.data.u === U) return FLIGHT.data;
  const shipFile = f => f && (f.role === 'ships' || f.role === 'sounds');
  if (!GAME || SHIP_FILES.length || PENDING.some(shipFile) || shipFile(READING) || !GAME.list('shän').length) return null;
  return (FLIGHT.data = novaFlightData(U));
}

/* A world for each system whose stellars the last draw showed, and for
   the one you are in; none for the others. Called from the draw. On a
   landing page the map is not drawn, and the worlds are kept. */
function flightSync() {
  if (VIEW.mode === 'planet') return;
  FLIGHT.sys = FLIGHT.on && VIEW.sys !== null && VIEW.mode === 'system' ? VIEW.sys : null;
  const open = new Set();
  if (FLIGHT.on) {
    for (const d of DRAWN) if (d.t > 0) open.add(d.sys.id);
    if (FLIGHT.sys !== null) open.add(FLIGHT.sys);
  }
  for (const id of FLIGHT.worlds.keys()) if (!open.has(id)) FLIGHT.worlds.delete(id);
  if (!open.size) return;
  wantShipFiles();
  const D = flightData();
  if (!D) return;
  let made = false;
  for (const id of open) {
    if (FLIGHT.worlds.has(id)) continue;
    const w = novaFlightWorld(D, U.byId.get(id), STATE, Math.floor(Math.random() * 0x7fffffff), flightView(id));
    for (const s of w.ships) if (s) s.frame = novaShipFrame(s);
    FLIGHT.worlds.set(id, w);
    if (id === FLIGHT.sys) made = true;
  }
  if (!FLIGHT.started) { FLIGHT.started = true; FLIGHT.paused = FLIGHT.paused || reducedMotion(); }
  if (made) { FLIGHT.due = Math.min(FLIGHT.due, 1); renderPanel(); }
}

/* The player's screen, for the asteroids: the map's view in the system's
   own units, its middle and half its width and height. */
function flightView(id) {
  const sys = U.byId.get(id), p = placeOf(id), k = kOf(sys), z = CAM.s * k;
  return { x: (CAM.x - p.x) / k, y: (CAM.y - p.y) / k, hw: CW / 2 / z, hh: CH / 2 / z };
}

function flightLoop(now) {
  FLIGHT.tick = null;
  if (!FLIGHT.worlds.size || $('app').hidden || VIEW.mode === 'planet' || FLIGHT.paused) { FLIGHT.last = 0; return; }
  if (FLIGHT.last) FLIGHT.due = Math.min(FLIGHT.due + (now - FLIGHT.last) * 0.03 * FLIGHT.speed, 4 * FLIGHT.speed);
  FLIGHT.last = now;
  let stepped = false;
  for (; FLIGHT.due >= 1; FLIGHT.due--) {
    for (const [id, w] of FLIGHT.worlds) {
      w.view = flightView(id);
      novaFlightStep(w);
      for (const s of w.ships) if (s) s.frame = novaShipFrame(s);
    }
    stepped = true;
  }
  if (stepped) {
    FLIGHT.engaged = new Set();
    for (const w of FLIGHT.worlds.values()) for (const id of novaFlightEngaged(w, gateOpen)) FLIGHT.engaged.add(id);
    // a gate opening needs the stellars' clock running
    if (FLIGHT.engaged.size && !ANIM_TICK) { ANIM_LAST = 0; ANIM_TICK = requestAnimationFrame(stellarAnimLoop); }
    // the panel's list, when ships have come or gone
    const w = FLIGHT.world, here = w ? w.ships.map(s => (s ? s.cls.id : 0)).join() : '';
    if (here !== FLIGHT.here) { FLIGHT.here = here; renderPanel(); }
    redraw();
  }
  FLIGHT.tick = requestAnimationFrame(flightLoop);
}
function flightRun() { if (!FLIGHT.tick && FLIGHT.worlds.size && !FLIGHT.paused) { FLIGHT.last = 0; FLIGHT.tick = requestAnimationFrame(flightLoop); } }

function flightEngaged(id) { return FLIGHT.engaged.has(id); }
// Whether a hypergate's animation is past its opening frames (novaGateTransition), which widens the reach of a ship bound for it.
function gateOpen(id) {
  const sp = U.stellars.get(id), a = STELLAR_ANIM.get(id), f = sp && spriteFrames(sp);
  return !!(a && f && a.cur >= novaGateTransition(sp, f.count));
}

/* Each open system's asteroids and ships, within its circle and as faded
   as its stellars. */
function drawFlight(ctx) {
  flightSync();
  if (!FLIGHT.worlds.size) return;
  flightRun();
  for (const d of DRAWN) {
    const w = d.t > 0 && FLIGHT.worlds.get(d.sys.id);
    if (w) drawWorld(ctx, d, w);
  }
}
function drawWorld(ctx, d, w) {
  const k = kOf(d.sys), z = k * CAM.s;
  // only what is within the system's circle
  ctx.save();
  ctx.beginPath(); ctx.arc(d.x, d.y, d.D / 2, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = d.t;
  for (const a of w.roids) {
    if (!a.active) continue;
    const t = w.D.roids[a.type], spr = shipSprite(t.sprite), img = spr && spr.kind === 'rle' ? shipFrame(spr, Math.trunc(a.frame) % spr.count) : null;
    if (!img) continue;
    const [x, y] = toScreen(d.p.x + k * a.x, d.p.y + k * a.y);
    let wd = img.width * z, ht = img.height * z;
    const m = Math.max(wd, ht);
    if (m < MIN_SHIP) { wd *= MIN_SHIP / m; ht *= MIN_SHIP / m; }
    if (x + wd < 0 || y + ht < 0 || x - wd > CW || y - ht > CH) continue;
    ctx.imageSmoothingEnabled = wd < img.width;
    ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht);
  }
  for (const s of w.ships) {
    if (!s) continue;
    const [x, y] = toScreen(d.p.x + k * s.x, d.p.y + k * s.y);
    const spr = shipSprite(s.cls.sprite), img = spr && spr.kind === 'rle' ? shipFrame(spr, s.frame % spr.count) : null;
    let wd = (img ? img.width : 32) * z, ht = (img ? img.height : 32) * z;
    const m = Math.max(wd, ht);
    if (m < MIN_SHIP) { wd *= MIN_SHIP / m; ht *= MIN_SHIP / m; }
    if (x + wd < 0 || y + ht < 0 || x - wd > CW || y - ht > CH) continue;
    if (img) {
      ctx.imageSmoothingEnabled = wd < img.width;
      ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht);
    } else {
      ctx.beginPath(); ctx.arc(x, y, wd / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(160,175,200,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  // shots, at their frame, never under MIN_SHOT pixels; explosions after their wait
  const sprite = (id, f, x, y, min) => {
    const spr = shipSprite(id), img = spr && spr.kind === 'rle' ? shipFrame(spr, Math.max(0, Math.min(spr.count - 1, f))) : null;
    if (!img) return;
    let wd = img.width * z, ht = img.height * z;
    const m = Math.max(wd, ht);
    if (m < min) { wd *= min / m; ht *= min / m; }
    if (x + wd < 0 || y + ht < 0 || x - wd > CW || y - ht > CH) return;
    ctx.imageSmoothingEnabled = wd < img.width;
    ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht);
  };
  if (w.shots) for (const sh of w.shots) {
    if (!sh || !(sh.life > 0)) continue;
    const W = w.D.fight.weaps[sh.w], id = W && novaSpinSprite(w.D, W.spin), info = id && novaFightSprite(w.D, id);
    if (!info) continue;
    const [x, y] = toScreen(d.p.x + k * sh.x, d.p.y + k * sh.y);
    sprite(id, novaShotFrame(W, sh, info), x, y, MIN_SHOT);
  }
  if (w.booms) for (const b of w.booms) {
    const B = b && w.D.fight.booms[b.boom];
    if (!B || b.delay > 0) continue;
    const [x, y] = toScreen(d.p.x + k * b.x, d.p.y + k * b.y);
    sprite(novaSpinSprite(w.D, B.spin), Math.trunc(b.frame), x, y, MIN_SHIP);
  }
  ctx.restore();
}

// The panel's part: how many ships, and the clock.
function flightPanel(sys) {
  if (!FLIGHT.on || VIEW.mode !== 'system' || FLIGHT.sys !== sys.id) return '';
  const w = FLIGHT.world;
  if (!w) return flightData() ? '' : `<h3>Ships here now</h3><p class="note">${SHIP_FILES.length || PENDING.some(f => f.role === 'ships') ? 'Reading the ships…' : 'No ships files are open.'}</p>`;
  const ships = w.ships.filter(Boolean), kinds = new Map();
  for (const s of ships) kinds.set(s.cls.id, (kinds.get(s.cls.id) || 0) + 1);
  const list = [...kinds].map(([id, n]) => `<a data-ship="${id}">${esc(w.D.classes.get(id).name)}</a>${n > 1 ? ` <span class="note">× ${n}</span>` : ''}`).join(', ');
  const speeds = FLIGHT_SPEEDS.map(v => `<button data-flight="speed:${v}" aria-pressed="${FLIGHT.speed === v}">${v === 0.5 ? '½' : v}×</button>`).join('');
  return `<h3>Ships here now</h3>
    <p>${ships.length ? `${ships.length}: ${list}` : 'none'}</p>
    <div class="actions"><button data-flight="pause">${FLIGHT.paused ? 'Go on' : 'Pause'}</button>${speeds}<button data-flight="again" title="Arrive again, with other ships">Arrive again</button></div>
    ${battlePanel(w)}`;
}

/* The battle simulator: two sides, each a government and ships of any
   class, put in the system you are in in place of its ships, with no
   more arriving, to fight by the game's rules. Ships fight only when
   their governments are enemies, as in the game. */
const BATTLE = { govt: [null, null], cls: [null, null], n: [1, 1], sides: [[], []], placed: [] };
function battlePanel(w) {
  const D = w.D, govts = [...U.govts.values()].filter(g => D.govts.has(g.id)).sort((a, b) => a.id - b.id);
  if (!govts.length) return '';
  const classes = [...D.classes.values()].filter(c => !c.missing && c.sprite > 0).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  const named = new Map();
  for (const c of classes) named.set(c.name, (named.get(c.name) || 0) + 1);
  for (let i = 0; i < 2; i++) {
    if (BATTLE.govt[i] === null || !D.govts.has(BATTLE.govt[i])) BATTLE.govt[i] = govts[Math.min(i, govts.length - 1)].id;
    if (BATTLE.cls[i] === null || !D.classes.has(BATTLE.cls[i])) BATTLE.cls[i] = classes[0].id;
  }
  const side = i => {
    const g = govts.map(x => `<option value="${x.id}"${x.id === BATTLE.govt[i] ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    const c = classes.map(x => `<option value="${x.id}"${x.id === BATTLE.cls[i] ? ' selected' : ''}>${esc(x.name)}${named.get(x.name) > 1 ? ` (${x.id})` : ''}</option>`).join('');
    const n = [1, 2, 3, 4, 5, 6, 7, 8].map(k => `<option${k === BATTLE.n[i] ? ' selected' : ''}>${k}</option>`).join('');
    const list = BATTLE.sides[i].map((e, j) => `${esc(D.classes.get(e.cls).name)}${e.n > 1 ? ` × ${e.n}` : ''} <a data-flight="del:${i}:${j}" title="Take off">✕</a>`).join(', ');
    const placed = BATTLE.placed.filter(p => p.side === i), left = placed.filter(p => w.ships[p.slot] === p.ship).length;
    return `<div class="battle-side"><div class="battle-row"><b>Side ${i + 1}</b> <select data-battle="govt:${i}" aria-label="Side ${i + 1}'s government">${g}</select></div>
      <div class="battle-row"><select data-battle="cls:${i}" aria-label="Ship">${c}</select> <select data-battle="n:${i}" aria-label="How many">${n}</select> <button data-flight="add:${i}">Add</button></div>
      <p>${list || '<span class="note">no ships yet</span>'}${placed.length && FLIGHT.sys === BATTLE.sys ? ` <span class="note">· ${left} of ${placed.length} left</span>` : ''}</p></div>`;
  };
  const foes = novaGovtEnemies(D, BATTLE.govt[0], BATTLE.govt[1]) || [0, 1].some(i => { const g = D.govts.get(BATTLE.govt[i]); return g && (g.flags & 1) && !novaGovtAllies(D, BATTLE.govt[0], BATTLE.govt[1]); });
  return `<h3>Battle</h3>${side(0)}${side(1)}
    ${foes ? '' : '<p class="note">These governments are not enemies, so their ships will not fight.</p>'}
    <div class="actions"><button data-flight="fight"${BATTLE.sides[0].length && BATTLE.sides[1].length ? '' : ' disabled'}>Fight</button><button data-flight="clearb">Clear</button></div>`;
}
function battleChange(e) {
  const t = e.target.closest('[data-battle]');
  if (!t) return;
  const [k, i] = t.dataset.battle.split(':');
  BATTLE[k][+i] = +t.value;
  if (k === 'govt') renderPanel();
}
document.addEventListener('change', battleChange);
// Each side's ships put in the system, in a column 900 units apart, facing anywhere, as warships.
function battleFight() {
  const w = FLIGHT.world;
  if (!w) return;
  for (let i = 0; i < 64; i++) w.ships[i] = null;
  w.shots.fill(null); w.booms.fill(null);
  w.noArrivals = true;
  BATTLE.placed = []; BATTLE.sys = FLIGHT.sys;
  for (let i = 0; i < 2; i++) {
    const all = BATTLE.sides[i].flatMap(e => Array(e.n).fill(e.cls));
    all.forEach((cls, j) => {
      const s = novaPlaceShip(w, cls, BATTLE.govt[i], i ? 450 : -450, (j - (all.length - 1) / 2) * 140, 3);
      if (s) BATTLE.placed.push({ side: i, slot: s.slot, ship: s });
    });
  }
  FLIGHT.paused = false;
  flightRun();
}
function flightControl(what) {
  if (what === 'pause') { FLIGHT.paused = !FLIGHT.paused; flightRun(); }
  else if (what === 'again') { FLIGHT.worlds.delete(FLIGHT.sys); flightSync(); redraw(); }
  else if (what.startsWith('speed:')) FLIGHT.speed = +what.slice(6);
  else if (what.startsWith('add:')) { const i = +what.slice(4); BATTLE.sides[i].push({ cls: BATTLE.cls[i], n: BATTLE.n[i] }); }
  else if (what.startsWith('del:')) { const [, i, j] = what.split(':'); BATTLE.sides[+i].splice(+j, 1); }
  else if (what === 'clearb') { BATTLE.sides = [[], []]; BATTLE.placed = []; }
  else if (what === 'fight') battleFight();
  renderPanel();
}
function flightSwitch(on) {
  FLIGHT.on = on;
  if (!on) { FLIGHT.worlds.clear(); FLIGHT.sys = null; FLIGHT.engaged = new Set(); }
  renderPanel();
  redraw();
}
// More files read: the asteroids' sprites may be among them.
function flightFilesChanged() { if (FLIGHT.data) FLIGHT.data.roids = novaFlightRoids(GAME); }
// Other files: the records are read again, and the world set up again.
function flightReset() { FLIGHT.data = null; FLIGHT.worlds.clear(); FLIGHT.sys = null; FLIGHT.engaged = new Set(); }
