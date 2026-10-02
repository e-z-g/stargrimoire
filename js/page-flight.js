/* page-flight.js -- ships flying in the systems on the map.
   =========================================================================

   Each system whose stellars are drawn has a world of nova-flight.js's,
   set up as its stellars start to show, as the game sets one up when the
   player arrives, with a new seed each time, and dropped when they go, so
   its ships fade in and out with them. The game runs only the player's
   system; here each open one runs as if the player were there. Their
   ships come, go to the stellars and leave by their own AI, and only what
   is within a system's circle is drawn, but for the system you are in,
   whose ships just beyond it are drawn fading out with distance from its
   edge (OUTSIDE), off the other systems' circles, so a fight past the
   edge can be followed (the maintainer's asking, 1 October 2026). They are stepped thirty times a
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
// beyond the circle: as strong as `alpha` at its edge, and gone `reach` of its radius further out
const OUTSIDE = { alpha: 0.5, reach: 0.15 };
let OUTSIDE_CANVAS = null;
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
  const k = kOf(d.sys), at = (x, y) => toScreen(d.p.x + k * x, d.p.y + k * y);
  // the system you are in: what is just beyond its circle, fading out, and not over another open system's
  if (d.sys.id === FLIGHT.sys && ctx.canvas) drawOutside(ctx, d, w, at, k * CAM.s);
  // only what is within the system's circle
  ctx.save();
  ctx.beginPath(); ctx.arc(d.x, d.y, d.D / 2, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha = d.t;
  drawFlightThings(ctx, w, at, k * CAM.s, d.t);
  ctx.restore();
}
/* What is beyond a system's circle, drawn on a canvas of its own, then
   masked by a ring from OUTSIDE.alpha at the circle's edge to nothing
   OUTSIDE.reach of its radius further out, and laid on the map off every
   open system's circle. */
function drawOutside(ctx, d, w, at, z) {
  const c = OUTSIDE_CANVAS || (OUTSIDE_CANVAS = document.createElement('canvas'));
  if (c.width !== ctx.canvas.width || c.height !== ctx.canvas.height) { c.width = ctx.canvas.width; c.height = ctx.canvas.height; }
  const o = c.getContext('2d'), r = d.D / 2, far = r * (1 + OUTSIDE.reach);
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, c.width, c.height);
  o.setTransform(ctx.getTransform());
  drawFlightThings(o, w, at, z, 1);
  const g = o.createRadialGradient(d.x, d.y, r, d.x, d.y, far);
  g.addColorStop(0, `rgba(0,0,0,${OUTSIDE.alpha * d.t})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  o.globalCompositeOperation = 'destination-in';
  o.fillStyle = g;
  o.fillRect(0, 0, CW, CH);
  o.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, CW, CH);
  for (const p of DRAWN) if (p.t > 0) { ctx.moveTo(p.x + p.D / 2, p.y); ctx.arc(p.x, p.y, p.D / 2, 0, Math.PI * 2); }
  ctx.clip('evenodd');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
/* A world's asteroids, ships, shots, beams, particles and explosions, on
   the screen by `at` (system units to pixels) at `z` pixels to the unit,
   at `alpha`, on a canvas cw by ch; `mark`, if given, draws beneath
   each ship (the battle's sides). */
function drawFlightThings(ctx, w, at, z, alpha, mark, cw = CW, ch = CH) {
  for (const a of w.roids) {
    if (!a.active) continue;
    const t = w.D.roids[a.type], spr = shipSprite(t.sprite), img = spr && spr.kind === 'rle' ? shipFrame(spr, Math.trunc(a.frame) % spr.count) : null;
    if (!img) continue;
    const [x, y] = at(a.x, a.y);
    let wd = img.width * z, ht = img.height * z;
    const m = Math.max(wd, ht);
    if (m < MIN_SHIP) { wd *= MIN_SHIP / m; ht *= MIN_SHIP / m; }
    if (x + wd < 0 || y + ht < 0 || x - wd > cw || y - ht > ch) continue;
    ctx.imageSmoothingEnabled = wd < img.width;
    ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht);
  }
  for (const s of w.ships) {
    if (!s) continue;
    const [x, y] = at(s.x, s.y);
    const spr = shipSprite(s.cls.sprite), img = spr && spr.kind === 'rle' ? shipFrame(spr, s.frame % spr.count) : null;
    let wd = (img ? img.width : 32) * z, ht = (img ? img.height : 32) * z;
    const m = Math.max(wd, ht);
    if (m < MIN_SHIP) { wd *= MIN_SHIP / m; ht *= MIN_SHIP / m; }
    if (x + wd < 0 || y + ht < 0 || x - wd > cw || y - ht > ch) continue;
    if (mark) mark(ctx, s, x, y, Math.max(wd, ht));
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
    if (x + wd < 0 || y + ht < 0 || x - wd > cw || y - ht > ch) return;
    ctx.imageSmoothingEnabled = wd < img.width;
    ctx.drawImage(img, x - wd / 2, y - ht / 2, wd, ht);
  };
  if (w.shots) for (const sh of w.shots) {
    if (!sh || !(sh.life > 0)) continue;
    const W = w.D.fight.weaps[sh.w], id = W && novaSpinSprite(w.D, W.spin), info = id && novaFightSprite(w.D, id);
    if (!info) continue;
    const [x, y] = at(sh.x, sh.y);
    sprite(id, novaShotFrame(W, sh, info), x, y, MIN_SHOT);
  }
  // beams: a line in BeamColor over a wider one in CoronaColor, BeamWidth across, never under a pixel
  const hex = c => '#' + ((c >>> 0) & 0xffffff).toString(16).padStart(6, '0');
  if (w.beams) for (const b of w.beams) {
    if (!b || b.life < 0) continue;
    const W = w.D.fight.weaps[b.w];
    const [x0, y0] = at(b.x0, b.y0), [x1, y1] = at(b.x1, b.y1);
    const bw = Math.max(1, (W.beamWidth || 1) * z);
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.45; ctx.strokeStyle = hex(W.coronaColor); ctx.lineWidth = bw * 3;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha = alpha; ctx.strokeStyle = hex(W.beamColor); ctx.lineWidth = bw;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // particles: a dot each, a pixel of the system at least a screen pixel
  if (w.parts && w.parts.length) {
    const r = Math.max(1, z);
    for (const p of w.parts) {
      const [x, y] = at(p.x / 256, p.y / 256);
      if (x < 0 || y < 0 || x > cw || y > ch) continue;
      ctx.fillStyle = hex(p.color);
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
  if (w.booms) for (const b of w.booms) {
    const B = b && w.D.fight.booms[b.boom];
    if (!B || b.delay > 0) continue;
    const [x, y] = at(b.x, b.y);
    sprite(novaSpinSprite(w.D, B.spin), Math.trunc(b.frame), x, y, MIN_SHIP);
  }
}

// The panel's part: how many ships, and the clock.
function flightPanel(sys) {
  if (!FLIGHT.on || VIEW.mode !== 'system' || FLIGHT.sys !== sys.id) return '';
  const w = FLIGHT.world;
  if (!w) return flightData() ? '' : `<h3>Ships here now</h3><p class="note">${SHIP_FILES.length || PENDING.some(f => f.role === 'ships') ? 'Reading the ships…' : 'No ships files are open.'}</p>`;
  // only those within the system's circle (the maintainer's asking, 1 October 2026)
  const R = sysGeo(sys).R, ships = w.ships.filter(s => s && Math.hypot(s.x, s.y) <= R), kinds = new Map();
  for (const s of ships) kinds.set(s.cls.id, (kinds.get(s.cls.id) || 0) + 1);
  const list = [...kinds].map(([id, n]) => `<a data-ship="${id}">${esc(w.D.classes.get(id).name)}</a>${n > 1 ? ` <span class="note">× ${n}</span>` : ''}`).join(', ');
  const speeds = FLIGHT_SPEEDS.map(v => `<button data-flight="speed:${v}" aria-pressed="${FLIGHT.speed === v}">${v === 0.5 ? '½' : v}×</button>`).join('');
  return `<h3>Ships here now</h3>
    <p>${ships.length ? `${ships.length}: ${list}` : 'none'}</p>
    <div class="actions"><button data-flight="pause">${FLIGHT.paused ? 'Go on' : 'Pause'}</button>${speeds}<button data-flight="again" title="Arrive again, with other ships">Arrive again</button></div>`;
}

function flightControl(what) {
  if (what === 'pause') { FLIGHT.paused = !FLIGHT.paused; flightRun(); }
  else if (what === 'again') { FLIGHT.worlds.delete(FLIGHT.sys); flightSync(); redraw(); }
  else if (what.startsWith('speed:')) FLIGHT.speed = +what.slice(6);
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
