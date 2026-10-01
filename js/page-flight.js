/* page-flight.js -- ships flying in the system you are in.
   =========================================================================

   The world is nova-flight.js's: set up as you arrive in a system, as the
   game sets one up when the player arrives, with a new seed each time, and
   dropped when you leave it, so that only the system you are in runs, as in
   the game. Its ships come, go to its stellars and leave by their own AI,
   and a ship's place is where the game has it, so one arriving, or leaving
   from 1,000 out, may be off a small system's disc. It is stepped thirty times a second, as the game counts its
   time, or faster or slower by the panel's speed, and not while paused, on
   a landing page, or with the map hidden. Where the browser asks for
   reduced motion it starts paused. A hypergate a ship is coming out of
   opens (flightEngaged).

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

const MIN_SHIP = 12;
const FLIGHT_SPEEDS = [0.5, 1, 2, 4];
const FLIGHT = { on: true, data: null, world: null, sys: null, paused: false, speed: 1, due: 0, last: 0, tick: null, engaged: new Set() };

// The ships' records, once the shäns are read (they are in the ships files).
function flightData() {
  if (FLIGHT.data && FLIGHT.data.u === U) return FLIGHT.data;
  const shipFile = f => f && (f.role === 'ships' || f.role === 'sounds');
  if (!GAME || SHIP_FILES.length || PENDING.some(shipFile) || shipFile(READING) || !GAME.list('shän').length) return null;
  return (FLIGHT.data = novaFlightData(U));
}

/* The world for the system you are in: a new one on arriving, none
   elsewhere. Called from the draw. */
function flightSync() {
  const here = FLIGHT.on && VIEW.sys !== null && (VIEW.mode === 'system' || VIEW.mode === 'planet') ? VIEW.sys : null;
  if (here === FLIGHT.sys && (FLIGHT.world || here === null)) return;
  if (here !== FLIGHT.sys) { FLIGHT.world = null; FLIGHT.engaged = new Set(); FLIGHT.sys = here; }
  if (here === null) return;
  wantShipFiles();
  const D = flightData();
  if (!D) return;
  FLIGHT.world = novaFlightWorld(D, U.byId.get(here), STATE, Math.floor(Math.random() * 0x7fffffff), flightView(here));
  for (const s of FLIGHT.world.ships) if (s) s.frame = novaShipFrame(s);
  FLIGHT.paused = FLIGHT.paused || reducedMotion();
  FLIGHT.due = 0;
  renderPanel();
}

/* The player's screen, for the asteroids: the map's view in the system's
   own units, its middle and half its width and height. */
function flightView(id) {
  const sys = U.byId.get(id), p = placeOf(id), k = kOf(sys), z = CAM.s * k;
  return { x: (CAM.x - p.x) / k, y: (CAM.y - p.y) / k, hw: CW / 2 / z, hh: CH / 2 / z };
}

function flightLoop(now) {
  FLIGHT.tick = null;
  const w = FLIGHT.world;
  if (!w || $('app').hidden || VIEW.mode !== 'system' || FLIGHT.paused) { FLIGHT.last = 0; return; }
  if (FLIGHT.last) FLIGHT.due = Math.min(FLIGHT.due + (now - FLIGHT.last) * 0.03 * FLIGHT.speed, 4 * FLIGHT.speed);
  FLIGHT.last = now;
  let stepped = false;
  for (; FLIGHT.due >= 1; FLIGHT.due--) {
    w.view = flightView(FLIGHT.sys);
    novaFlightStep(w);
    for (const s of w.ships) if (s) s.frame = novaShipFrame(s);
    stepped = true;
  }
  if (stepped) {
    FLIGHT.engaged = novaFlightEngaged(w, gateOpen);
    // a gate opening needs the stellars' clock running
    if (FLIGHT.engaged.size && !ANIM_TICK) { ANIM_LAST = 0; ANIM_TICK = requestAnimationFrame(stellarAnimLoop); }
    // the panel's list, when ships have come or gone
    const here = w.ships.map(s => (s ? s.cls.id : 0)).join();
    if (here !== FLIGHT.here) { FLIGHT.here = here; renderPanel(); }
    redraw();
  }
  FLIGHT.tick = requestAnimationFrame(flightLoop);
}
function flightRun() { if (!FLIGHT.tick && FLIGHT.world && !FLIGHT.paused) { FLIGHT.last = 0; FLIGHT.tick = requestAnimationFrame(flightLoop); } }

function flightEngaged(id) { return FLIGHT.engaged.has(id); }
// Whether a hypergate's animation is past its opening frames (novaGateTransition), which widens the reach of a ship bound for it.
function gateOpen(id) {
  const sp = U.stellars.get(id), a = STELLAR_ANIM.get(id), f = sp && spriteFrames(sp);
  return !!(a && f && a.cur >= novaGateTransition(sp, f.count));
}

function drawFlight(ctx, d) {
  flightSync();
  const w = FLIGHT.world;
  if (!d || !w || d.sys.id !== FLIGHT.sys || d.t <= 0) return;
  if (VIEW.mode === 'system') flightRun();
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
    <div class="actions"><button data-flight="pause">${FLIGHT.paused ? 'Go on' : 'Pause'}</button>${speeds}<button data-flight="again" title="Arrive again, with other ships">Arrive again</button></div>`;
}
function flightControl(what) {
  if (what === 'pause') { FLIGHT.paused = !FLIGHT.paused; flightRun(); }
  else if (what === 'again') { FLIGHT.world = null; FLIGHT.sys = null; flightSync(); redraw(); }
  else if (what.startsWith('speed:')) FLIGHT.speed = +what.slice(6);
  renderPanel();
}
function flightSwitch(on) {
  FLIGHT.on = on;
  if (!on) { FLIGHT.world = null; FLIGHT.sys = null; FLIGHT.engaged = new Set(); }
  renderPanel();
  redraw();
}
// More files read: the asteroids' sprites may be among them.
function flightFilesChanged() { if (FLIGHT.data) FLIGHT.data.roids = novaFlightRoids(GAME); }
// Other files: the records are read again, and the world set up again.
function flightReset() { FLIGHT.data = null; FLIGHT.world = null; FLIGHT.sys = null; FLIGHT.engaged = new Set(); }
