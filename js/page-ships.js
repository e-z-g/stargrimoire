/* page-ships.js -- the ships: every ship class, and one turning in space.
   =========================================================================

   A list of the ship classes beside the one chosen: its sprites turning at
   its own turn rate, its pictures and description, and what its record
   says, in the Bible's units. The address bar keeps it (#ships, #ship=128),
   and the bar's Map and Ships switch between this and the map.

   The ships files, a hundred megabytes, are read only when the ships are
   first looked at; the list is there before them, from the shïp records in
   the data files, and the sprites and pictures arrive as the files do.

   HOW THE LAYERS ARE DRAWN is ResForge's Shan Editor's way, since the Bible
   does not say: the base and alternating images over black at the base's
   transparency, (32 - BaseTransp) / 32; the engine glow, running lights,
   weapon glow and shield added to what is under them. The rest is the
   Bible's: frames and sets from nova-ships.js, the alternating image and
   the extra sets that play in sequence changing every AnimDelay 30ths of a
   second, the lights' three blink modes with BlinkA to BlinkD read as the
   Bible's shän section lists them (ResForge reads A and B of the square
   wave the other way round), and the ship turning at 3 degrees a second
   for each point of Maneuver ("10 = 30°/sec").

   The page's own script: DOM here. LOAD ORDER: after js/page-map.js, whose
   helpers (esc, resName, govtName, pictImage, asCanvas, fieldsTable,
   testLine, goStellar) it uses; page-map calls shipsFromHash at run time. */

const SHIPS = { on: false, id: null, sort: 'yard', q: '', rows: null };
const SHIP_SPRITES = new Map();   // image id -> novaShipSprite
const SHIP_FRAMES = new Map();    // 'id:frame' -> canvas, the most recent few hundred
const SHIP_FRAME_LIMIT = 600;
let SHIP_LOOKS = null;            // BaseImageID -> [ship ids], built once the shän are read
let SHIP_ANIM = null;             // the ship being shown, and its state

/* ---- sprites, a frame at a time ------------------------------------------ */

function shipSprite(id) {
  if (!(id > 0)) return null;
  let s = SHIP_SPRITES.get(id);
  if (!s || s.kind === 'missing') { s = novaShipSprite(GAME, id); SHIP_SPRITES.set(id, s); }
  return s;
}
function shipFrame(spr, f) {
  const k = spr.id + ':' + f;
  let c = SHIP_FRAMES.get(k);
  if (c) { SHIP_FRAMES.delete(k); SHIP_FRAMES.set(k, c); return c; }
  c = document.createElement('canvas');
  c.width = spr.width; c.height = spr.height;
  try { c.getContext('2d').putImageData(new ImageData(spr.frame(f), spr.width, spr.height), 0, 0); } catch (e) { return null; }
  SHIP_FRAMES.set(k, c);
  if (SHIP_FRAMES.size > SHIP_FRAME_LIMIT) SHIP_FRAMES.delete(SHIP_FRAMES.keys().next().value);
  return c;
}

function shipLooks() {
  if (SHIP_LOOKS) return SHIP_LOOKS;
  SHIP_LOOKS = new Map();
  for (const e of GAME.list('shän')) {
    const b = GAME.get('shän', e.id).bytes;
    if (b.length < 2) continue;
    const img = i16be(b, 0);
    if (!SHIP_LOOKS.has(img)) SHIP_LOOKS.set(img, []);
    SHIP_LOOKS.get(img).push(e.id);
  }
  return SHIP_LOOKS;
}

/* ---- in and out of the view -------------------------------------------- */

/* Whether the address is a ships address; if it is, the view is shown. */
function shipsFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.has('ships') || p.has('ship')) {
    const id = +p.get('ship');
    shipsShow(p.has('ship') && GAME.has('shïp', id) ? id : null, { fromHash: true });
    return true;
  }
  if (SHIPS.on) shipsLeave(true);
  return false;
}

function shipsShow(id, opts = {}) {
  const first = !SHIPS.on;
  SHIPS.on = true;
  SHIPS.id = id;
  $('app').hidden = true;
  $('ships').hidden = false;
  $('ships').classList.toggle('picked', id !== null);
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'ships'));
  wantShipFiles();
  if (first || !SHIPS.rows) renderShipList();
  else markShipRow();
  renderShip();
  shipsCrumbs();
  if (!opts.fromHash) {
    const h = id === null ? '#ships' : '#ship=' + id;
    if (location.hash !== h) { if (opts.replace) history.replaceState(null, '', h); else history.pushState(null, '', h); }
  }
}

/* Back to the map, as it was left. */
function shipsLeave(fromHash) {
  SHIPS.on = false;
  stopShipAnim();
  $('ships').hidden = true;
  $('app').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'map'));
  resizeCanvas();
  if (!fromHash) writeHash();
  renderCrumbs();
  renderPanel();
  redraw();
}

function shipsCrumbs() {
  $('crumbs').innerHTML = SHIPS.id !== null
    ? `<a data-ships="list">Ships</a><span class="sep">›</span><span class="here">${esc(shipName(SHIPS.id))}</span>` : '';
}

/* A ship's name as the game shows it (novaNameParts). */
function shipName(id) { return novaNameParts(GAME.name('shïp', id)).name || 'shïp ' + id; }

/* More files have been read: the ships files, or pictures. */
function shipsFilesChanged() {
  if (!GAME) return;
  SHIP_LOOKS = null;
  for (const [k, v] of SHIP_SPRITES) if (v.kind === 'missing' || v.kind === 'pict') SHIP_SPRITES.delete(k);
  if (!SHIPS.on) return;
  fillThumbs();
  if (SHIPS.id === null) { renderShip(); return; }
  // Drawn again whole only while its sprites were missing; otherwise the
  // pictures, so a ship being turned is not reset.
  const partial = SHIP_ANIM ? !SHIP_ANIM.layers.every(l => l.spr && l.spr.kind === 'rle') : GAME.has('shän', SHIPS.id);
  if (partial) renderShip(); else renderShipPictures();
}

/* A fresh game: forget the last one's ships. */
function shipsReset() {
  SHIP_SPRITES.clear();
  SHIP_FRAMES.clear();
  SHIP_LOOKS = null;
  SHIPS.rows = null;
  stopShipAnim();
}

/* ---- the list ----------------------------------------------------------- */

function shipRowsData() {
  const out = [];
  for (const e of GAME.list('shïp')) {
    const r = GAME.get('shïp', e.id);
    const rec = novaRecord('shïp', r.bytes), np = novaNameParts(e.name);
    out.push({ id: e.id, name: np.name || 'shïp ' + e.id, note: np.note, sub: rec.Subtitle || '', weight: rec.DispWeight || 0 });
  }
  return out;
}

function renderShipList() {
  SHIPS.rows = shipRowsData();
  const q = SHIPS.q.trim().toLowerCase();
  let rows = SHIPS.rows.filter(r => !q || String(r.id) === q || [r.name, r.sub, r.note || ''].some(t => t.toLowerCase().includes(q)));
  if (SHIPS.sort === 'yard') rows = rows.slice().sort((a, b) => b.weight - a.weight || a.id - b.id);
  $('shipCount').textContent = rows.length === SHIPS.rows.length ? `${rows.length} ship classes` : `${rows.length} of ${SHIPS.rows.length}`;
  $('shipRows').innerHTML = rows.map(r =>
    `<a class="shipRow" data-ship="${r.id}"><canvas class="thumb" width="44" height="44"></canvas>` +
    `<span class="nm">${esc(r.name)}${r.sub || r.note !== null ? `<small>${esc(r.sub)}${r.note !== null ? `<i>${r.sub ? ' ' : ''};${esc(r.note)}</i>` : ''}</small>` : ''}</span>` +
    `<span class="id">${r.id}</span></a>`).join('');
  markShipRow();
  fillThumbs();
}

function markShipRow() {
  for (const a of $('shipRows').querySelectorAll('.shipRow.on')) a.classList.remove('on');
  const a = SHIPS.id !== null && $('shipRows').querySelector(`[data-ship="${SHIPS.id}"]`);
  if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest' }); }
}

/* Each row's picture is the first frame of its base sprite, drawn a few
   rows at a time so the list stays responsive. */
let THUMB_JOB = 0;
function fillThumbs() {
  const job = ++THUMB_JOB;
  const todo = [...$('shipRows').querySelectorAll('canvas.thumb:not(.done)')];
  const step = () => {
    if (job !== THUMB_JOB) return;
    const t0 = performance.now();
    while (todo.length && performance.now() - t0 < 12) {
      const c = todo.shift();
      const id = +c.parentNode.dataset.ship;
      const b = GAME.get('shän', id);
      if (!b) continue;
      const spr = shipSprite(i16be(b.bytes, 0));
      if (!spr || spr.kind !== 'rle') continue;
      const f = shipFrame(spr, 0);
      if (!f) continue;
      const k = Math.min(c.width / spr.width, c.height / spr.height, 1.5);
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = k < 1;
      ctx.drawImage(f, (c.width - spr.width * k) / 2, (c.height - spr.height * k) / 2, spr.width * k, spr.height * k);
      c.classList.add('done');
    }
    if (todo.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---- one ship ----------------------------------------------------------- */

const fmtNum = v => Number(v).toLocaleString('en');
// Many ship classes share a name, so a link says which by its number.
const shipLink = id => `<a data-ship="${id}">${esc(shipName(id))}</a> <span class="note">${id}</span>`;

function renderShip() {
  stopShipAnim();
  const el = $('shipView');
  if (SHIPS.id === null) {
    el.innerHTML = `<div class="shipNone"><p>Choose a ship.</p>${shipFilesNote()}</div>`;
    return;
  }
  const ship = novaGet(GAME, 'shïp', SHIPS.id);
  const shan = novaGet(GAME, 'shän', SHIPS.id);
  el.innerHTML = shipHtml(ship, shan);
  el.scrollTop = 0;
  renderShipPictures();
  if (shan) startShipAnim(ship, shan);
}

function shipFilesNote() {
  if (SHIP_FILES.length || PENDING.some(f => f.role === 'ships')) return '<p class="note">Reading the ships files…</p>';
  if (!GAME.files.some(f => f.role === 'ships') && !GAME.list('shän').length) return '<p class="note">No ships files are open, so there are no sprites or pictures: open the game\'s Nova Ships files with the rest.</p>';
  return '';
}

function shipHtml(ship, shan) {
  const id = ship.id;
  const govts = novaShipGovts(ship.InherentGovt);
  const govtLine = govts.combat === -1 && govts.attrs === -1 ? '' : govts.combat === govts.attrs ? esc(govtName(govts.combat))
    : govts.combat === -1 ? `${esc(govtName(govts.attrs))}'s attributes, of no government in combat` : `${esc(govtName(govts.combat))} in combat, with no government's attributes`;
  const sub = [`shïp ${id}`, ship.Subtitle, govtLine, ship.file].filter(Boolean).map(s => s === govtLine ? s : esc(s)).join(' · ');
  const d = descText(novaShipDescId(id)), pd = descText(novaShipPilotDescId(id));
  const perSec = v => fmtNum(Math.round(v * 30 / 10) / 100);
  const days = novaShipJumpDays(ship.Mass);
  const holds = ship.Holds < 0 ? `${fmtNum(-ship.Holds)} tons, and no mass expansions` : `${fmtNum(ship.Holds)} tons`;
  const weapons = novaShipWeapons(ship).map(w => `${w.count} × ${esc(resName('wëap', w.id))}${w.ammo ? ` <span class="note">with ${fmtNum(w.ammo)} rounds</span>` : ''}`);
  const items = novaShipItems(ship).map(it => `${it.count > 1 ? it.count + ' × ' : ''}${esc(resName('oütf', it.id))}`);
  const flags = [...novaFlagWords(ship.Flags, NOVA_SHIP_FLAGS), ...novaFlagWords(ship.Flags2, NOVA_SHIP_FLAGS2), ...novaFlagWords(ship.Flags3, NOVA_SHIP_FLAGS3)];
  const yards = ship.BuyRandom > 0 ? novaShipyards(U.stellars.values(), ship).filter(s => U.inSystems.has(s)) : [];
  const sale = ship.BuyRandom <= 0 ? 'Never: BuyRandom is 0'
    : `${ship.BuyRandom < 100 ? `On ${ship.BuyRandom}% of days, at` : 'At'} ${yards.length ? `<details class="inline"><summary>${yards.length} shipyard${yards.length === 1 ? '' : 's'}</summary><div class="list">${yards.map(s => stellarLink(s)).join('')}</div></details>` : 'no shipyard: none has its tech level'}`;
  const require = (ship.Require || []).some(v => v) ? (ship.Require || []).map(v => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0')).join(' ') : '';
  const contributes = (ship.Contributes || []).some(v => v) ? (ship.Contributes || []).map(v => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0')).join(' ') : '';
  const sell = ship.EscSellValue > 0 ? `${fmtNum(ship.EscSellValue)} credits` : `${fmtNum(Math.round(ship.Cost / 10))} credits (a tenth of its cost)`;
  const looks = shan ? (shipLooks().get(shan.BaseImageID) || []).filter(x => x !== id) : [];
  const sets = [['On purchase', ship.OnPurchase], ['On capture', ship.OnCapture], ['On retiring', ship.OnRetire]]
    .filter(([, v]) => v).map(([k, v]) => kvRow(k, `<span class="test">${esc(v)}</span>`)).join('');
  const np = novaNameParts(ship.name);
  return `<div class="shipHead"><h2>${esc(np.name || 'shïp ' + id)}</h2><div class="sub">${sub}</div>
    ${np.note !== null ? `<p class="note">Named "${esc(ship.name)}" in the file; the game shows only what comes before the semicolon.</p>` : ''}</div>
    <div class="shipTop">
      <div class="shipStage">${shan ? '<canvas id="shipCanvas"></canvas><div id="shipCtl" class="shipCtl"></div><div id="shipAt" class="note"></div>'
        : `<div class="nopict">${GAME.list('shän').length ? `No shän ${id} in these files, so no sprites.` : 'The sprites are in the ships files.'}</div>`}</div>
      <div id="shipPics" class="shipPics"></div>
    </div>
    ${d ? `<div class="desc">${esc(novaDescText(d.Description, STATE))}</div>` : `<p class="note">No description: the files have no dësc ${novaShipDescId(id)}.</p>`}
    ${pd ? `<h3>As an escort for hire</h3><div class="desc">${esc(novaDescText(pd.Description, STATE))}</div>` : ''}
    <div class="shipCols">
      <div><h3>Performance</h3><table class="kv">
        ${kvRow('Speed', fmtNum(ship.Speed))}
        ${kvRow('Acceleration', fmtNum(ship.Accel))}
        ${kvRow('Turning', `${fmtNum(ship.Maneuver)} <span class="note">(about ${fmtNum(ship.Maneuver * 3)}° a second)</span>`)}
        ${kvRow('Shield', `${fmtNum(ship.Shield)}${ship.ShieldRech ? ` <span class="note">recharging ${fmtNum(ship.ShieldRech)}: ${perSec(ship.ShieldRech)} a second in the Bible's unit</span>` : ''}`)}
        ${kvRow('Armour', `${fmtNum(ship.Armor)}${ship.ArmorRech ? ` <span class="note">recharging ${fmtNum(ship.ArmorRech)}: ${perSec(ship.ArmorRech)} a second in the Bible's unit</span>` : ''}`)}
        ${kvRow('Fuel', `${fmtNum(ship.Fuel)} <span class="note">(${Math.floor(ship.Fuel / 100)} jump${Math.floor(ship.Fuel / 100) === 1 ? '' : 's'})</span>`)}
        ${kvRow('Cargo', holds)}
        ${kvRow('Free space', `${fmtNum(ship.FreeMass)} tons`)}
        ${kvRow('Guns, turrets', `up to ${ship.MaxGun} and ${ship.MaxTur}`)}
        ${kvRow('Crew', ship.Crew ? fmtNum(ship.Crew) : '0: cannot be boarded, and cannot capture')}
        ${kvRow('Mass', `${fmtNum(ship.Mass)} tons${days ? ` <span class="note">(${days} day${days === 1 ? '' : 's'} a jump)</span>` : ''}`)}
        ${kvRow('Length', ship.Length ? `${fmtNum(ship.Length)} m` : '')}
        ${kvRow('Strength', fmtNum(ship.Strength))}
      </table>
      <h3>Stock weapons</h3>${weapons.length ? `<div>${weapons.join('<br>')}</div>` : '<p class="note">none</p>'}
      ${items.length ? `<h3>Outfits it comes with</h3><div>${items.join('<br>')}</div>` : ''}
      </div>
      <div><h3>Buying</h3><table class="kv">
        ${kvRow('Cost', `${fmtNum(ship.Cost)} credits`)}
        ${kvRow('Tech level', fmtNum(ship.TechLevel))}
        ${kvRow('For sale', sale)}
        ${kvRow('Available when', testLine(ship.Availability))}
        ${kvRow('Requires', require ? `<span class="test">${require}</span>` : '')}
        ${kvRow('Contributes', contributes ? `<span class="test">${contributes}</span>` : '')}
        ${kvRow('Shipyard name', ship.ShortName ? esc(ship.ShortName).replace(/\\n/g, '<br>') : '')}
        ${kvRow('Named when bought', esc(ship.LongName || ''))}
        ${kvRow('Named when hailed', esc(ship.CommName || ''))}
      </table>
      <h3>As an escort</h3><table class="kv">
        ${kvRow('Flies as', NOVA_AI_TYPES[ship.InherentAI] ? esc(NOVA_AI_TYPES[ship.InherentAI]) : '')}
        ${kvRow('Listed as', esc(NOVA_ESCORT_TYPES[ship.EscortType] || ''))}
        ${kvRow('For hire', ship.HireRandom > 0 ? `in the bar on ${ship.HireRandom}% of days` : 'never')}
        ${kvRow('Upgrades to', ship.UpgradeTo > 0 ? `${shipLink(ship.UpgradeTo)} <span class="note">for ${fmtNum(ship.EscUpgrdCost)} credits</span>` : '')}
        ${kvRow('Sold off for', sell)}
      </table>
      ${ship.AppearOn ? `<h3>Appears in fleets when</h3><p>${testLine(ship.AppearOn)}</p>` : ''}
      ${flags.length ? `<h3>Also</h3><div>${flags.map(esc).join('<br>')}</div>` : ''}
      ${sets ? `<h3>Control bits</h3><table class="kv">${sets}</table>` : ''}
      ${looks.length ? `<h3>With the same sprites</h3><div class="list">${looks.map(shipLink).join('')}</div>` : ''}
      </div>
    </div>
    ${shan ? shanHtml(shan) : ''}
    ${fieldsTable('shïp', ship)}
    ${shan ? fieldsTable('shän', shan) : ''}`;
}

function shanHtml(shan) {
  const rows = novaShanLayers(shan).map(l => {
    const s = shipSprite(l.image);
    const what = !s ? '' : s.kind === 'rle' ? `${s.type} ${l.image}: ${s.count} frames of ${s.width} × ${s.height}`
      : s.kind === 'pict' ? `PICT ${l.image}, a sheet, not drawn here yet` : s.kind === 'bad' ? `${l.image}: ${s.error}` : `${l.image}, not in these files`;
    return kvRow(l.label, esc(what));
  }).join('');
  const modes = novaFlagWords(shan.Flags, NOVA_SHAN_FLAGS);
  return `<details><summary>Sprites: ${shan.BaseSetCount} set${shan.BaseSetCount === 1 ? '' : 's'} of ${shan.FramesPer} frames</summary><table class="kv">${rows}
    ${kvRow('Frame delay', shan.AnimDelay > 0 ? `${shan.AnimDelay} 30ths of a second` : '')}
    ${kvRow('Base transparency', shan.BaseTransp > 0 ? `${shan.BaseTransp} of 32` : '')}
    ${kvRow('Lights', shan.LightImageID > 0 ? ({ 1: 'blink', 2: 'pulse', 3: 'flicker at random' }[shan.BlinkMode] || 'steady') : '')}
    ${kvRow('Modes', modes.map(esc).join('<br>'))}</table></details>`;
}

/* The ship's pictures: target, shipyard, and the one its description names. */
function renderShipPictures() {
  const host = $('shipPics');
  if (!host || SHIPS.id === null) return;
  const id = SHIPS.id, d = descText(novaShipDescId(id));
  const list = [];
  const t = novaShipPict(GAME, id, 3000), y = novaShipPict(GAME, id, 5000);
  const whose = p => p.from !== id ? `, shïp ${p.from}'s` : '';
  if (y) list.push({ pict: y.id, label: `Shipyard, PICT ${y.id}${whose(y)}` });
  if (t) list.push({ pict: t.id, label: `Target display, PICT ${t.id}${whose(t)}` });
  if (d && d.Graphic >= 128 && GAME.has('PICT', d.Graphic)) list.push({ pict: d.Graphic, label: `Named by its description, PICT ${d.Graphic}` });
  const key = list.map(p => p.pict).join(',');
  const done = host.dataset.key === key && !host.querySelector('.wait');
  if (done) return;
  host.dataset.key = key;
  host.innerHTML = '';
  if (!list.length) { host.innerHTML = `<p class="note">${GAME.list('shän').length ? 'No pictures for it in these files.' : 'Its pictures are in the ships files.'}</p>`; return; }
  for (const p of list) {
    const fig = document.createElement('figure');
    const img = pictImage(p.pict);
    if (img) fig.appendChild(asCanvas(img));
    else fig.innerHTML = PICT_CACHE.get(p.pict) === 'failed' ? `<div class="nopict">PICT ${p.pict} does not read.</div>` : '<div class="nopict wait">Reading…</div>';
    const cap = document.createElement('figcaption');
    cap.textContent = p.label;
    fig.appendChild(cap);
    host.appendChild(fig);
  }
}

/* ---- the ship turning ----------------------------------------------------- */

function stopShipAnim() {
  if (SHIP_ANIM) { cancelAnimationFrame(SHIP_ANIM.raf); SHIP_ANIM = null; }
}

function startShipAnim(ship, shan) {
  const layers = novaShanLayers(shan).map(l => Object.assign(l, { spr: shipSprite(l.image) }));
  const base = layers.find(l => l.layer === 'base');
  const per = Math.max(1, shan.FramesPer);
  const mode = shan.Flags & 0x0F;
  const A = {
    ship, shan, layers, per, mode,
    heading: 0, spin: true, turn: Math.max(ship.Maneuver, 1) * 3 / 360 * per / 30,   // frames a tick
    show: { alt: true, glow: false, light: true, weap: false, shield: false },
    bank: 0, fold: 0, foldTo: 0, carrying: true, seq: 0, altSet: 0, ticks: 0,
    blink: { alpha: 1, phase: 'on', t: 0, count: 0, up: true },
    last: performance.now(), acc: 0, raf: 0,
  };
  SHIP_ANIM = A;
  // The box is sized from the base sprite, with room round it for a glow
  // or a shield, which can be drawn on a sprite twice its size; the base is
  // shown some 170 pixels across, whole pixels when that is at least
  // double, and never shrunk.
  const drawn = layers.filter(l => l.spr && l.spr.kind === 'rle');
  const baseSize = base && base.spr && base.spr.kind === 'rle' ? Math.max(base.spr.width, base.spr.height) : 64;
  const most = Math.max(baseSize, ...drawn.map(l => Math.max(l.spr.width, l.spr.height)));
  const c = $('shipCanvas');
  c.width = c.height = Math.round(Math.min(most, baseSize * 1.6)) + 8;
  let k = Math.max(1, Math.min(4, 170 / baseSize));
  if (k >= 2) k = Math.floor(k);
  c.style.width = c.style.height = Math.round(c.width * k) + 'px';
  c.style.imageRendering = Number.isInteger(k) ? 'pixelated' : 'auto';
  shipControls(A);
  wireShipCanvas(A, c);
  if (!base || !base.spr || base.spr.kind !== 'rle') {
    $('shipAt').textContent = !base || !base.spr || base.spr.kind === 'missing' ? 'The base sprite is in the ships files.' : base.spr.kind === 'pict' ? 'This ship\'s sprites are a PICT sheet, not drawn here yet.' : base.spr.error;
  }
  const loop = now => {
    if (SHIP_ANIM !== A) return;
    A.acc += Math.min(now - A.last, 250);
    A.last = now;
    let n = 0;
    while (A.acc >= 1000 / 30) { A.acc -= 1000 / 30; shipTick(A); n++; }
    if (n) drawShip(A, c);
    A.raf = requestAnimationFrame(loop);
  };
  drawShip(A, c);
  A.raf = requestAnimationFrame(loop);
}

/* One 30th of a second. */
function shipTick(A) {
  const s = A.shan, delay = Math.max(1, s.AnimDelay);
  A.ticks++;
  if (A.spin) A.heading = (A.heading + A.turn) % A.per;
  if (A.ticks % delay === 0) {
    if (s.AltSetCount > 0) A.altSet = (A.altSet + 1) % s.AltSetCount;
    if (A.mode & 8 && !(A.mode & 3)) A.seq = (A.seq + 1) % Math.max(1, s.BaseSetCount);
    if (A.mode & 2 && !(A.mode & 1) && A.fold !== A.foldTo) A.fold += Math.sign(A.foldTo - A.fold);
  }
  const b = A.blink, a = s.BlinkA, bb = s.BlinkB, cc = s.BlinkC, dd = s.BlinkD;
  if (s.BlinkMode === 1) {
    // The Bible: A the on-time, B the delay between blinks, C the blinks in a group, D the delay between groups.
    if (b.phase === 'on') { b.alpha = 1; if (++b.t >= a) { b.phase = 'off'; b.t = 0; b.count++; } }
    else if (b.phase === 'off') { b.alpha = 0; if (b.count >= cc) { b.phase = 'gap'; b.t = 0; } else if (++b.t >= bb) { b.phase = 'on'; b.t = 0; } }
    else { b.alpha = 0; if (++b.t >= dd) { b.phase = 'on'; b.t = 0; b.count = 0; } }
  } else if (s.BlinkMode === 2) {
    const lo = clampNum(a, 0, 32) / 32, hi = clampNum(cc, 0, 32) / 32;
    if (b.up) { b.alpha += bb / 100 / 32; if (b.alpha >= hi) { b.alpha = hi; b.up = false; } }
    else { b.alpha -= dd / 100 / 32; if (b.alpha <= lo) { b.alpha = lo; b.up = true; } }
  } else if (s.BlinkMode === 3) {
    if (++b.t >= Math.max(1, cc)) { b.t = 0; const lo = Math.min(a, bb), hi = Math.max(a, bb); b.alpha = clampNum(lo + Math.floor(Math.random() * (hi - lo + 1)), 0, 32) / 32; }
  } else b.alpha = 1;
}

/* Which set of the base the ship is showing. */
function shipSet(A) {
  const sets = Math.max(1, A.shan.BaseSetCount);
  if (A.mode & 1) return Math.min(A.bank, sets - 1);
  if (A.mode & 2) return Math.min(A.fold, sets - 1);
  if (A.mode & 4) return A.carrying ? 0 : Math.min(1, sets - 1);
  if (A.mode & 8) return A.seq;
  return 0;
}

function drawShip(A, c) {
  const ctx = c.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  const h = Math.floor(A.heading), set = shipSet(A);
  const baseAlpha = clampNum(32 - A.shan.BaseTransp, 0, 32) / 32;
  for (const l of A.layers) {
    if (!l.spr || l.spr.kind !== 'rle') continue;
    if (l.layer !== 'base' && !A.show[l.layer]) continue;
    const f = novaShipFrameIndex(A.per, h, l.layer === 'alt' ? A.altSet : set, l.spr.count);
    const img = shipFrame(l.spr, f);
    if (!img) continue;
    const additive = l.layer === 'glow' || l.layer === 'light' || l.layer === 'weap' || l.layer === 'shield';
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
    ctx.globalAlpha = additive ? (l.layer === 'light' ? A.blink.alpha : 1) : baseAlpha;
    ctx.drawImage(img, Math.round((c.width - l.spr.width) / 2), Math.round((c.height - l.spr.height) / 2));
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const at = $('shipAt');
  if (at && A.layers[0] && A.layers[0].spr && A.layers[0].spr.kind === 'rle') {
    const sets = Math.max(1, A.shan.BaseSetCount);
    at.textContent = `Heading ${Math.round(h * 360 / A.per)}°, frame ${h + 1} of ${A.per}` + (sets > 1 ? `, set ${set + 1} of ${sets}` : '');
  }
}

function shipControls(A) {
  const has = k => A.layers.some(l => l.layer === k && l.spr && l.spr.kind === 'rle');
  const s = A.shan;
  const parts = [
    `<button data-c="spin" aria-pressed="true">Turning</button>`,
    `<button data-c="left" title="One frame anticlockwise">◀</button><button data-c="right" title="One frame clockwise">▶</button>`,
  ];
  const toggle = (k, label) => has(k) ? `<button data-c="${k}" aria-pressed="${A.show[k]}">${label}</button>` : '';
  parts.push(toggle('glow', 'Engines'), toggle('light', 'Lights'), toggle('alt', 'Alternating'), toggle('weap', 'Weapon glow'), toggle('shield', 'Shield'));
  if (A.mode & 1 && s.BaseSetCount > 1) parts.push(`<select data-c="bank"><option value="0">Level</option><option value="1">Banking left</option><option value="2">Banking right</option></select>`);
  else if (A.mode & 2 && s.BaseSetCount > 1) parts.push(`<button data-c="fold" aria-pressed="false">Fold / unfold</button>`);
  else if (A.mode & 4 && s.BaseSetCount > 1) parts.push(`<button data-c="carry" aria-pressed="true">Carrying ${A.ship.KeyCarried > 0 ? esc(shipName(A.ship.KeyCarried)) : 'its ships'}</button>`);
  const el = $('shipCtl');
  el.innerHTML = parts.join('');
  el.onclick = e => {
    const b = e.target.closest('button[data-c]');
    if (!b || SHIP_ANIM !== A) return;
    const k = b.dataset.c;
    if (k === 'spin') A.spin = !A.spin;
    else if (k === 'left' || k === 'right') { A.spin = false; A.heading = (Math.floor(A.heading) + (k === 'left' ? A.per - 1 : 1)) % A.per; }
    else if (k === 'fold') A.foldTo = A.foldTo ? 0 : Math.max(0, s.BaseSetCount - 1);
    else if (k === 'carry') A.carrying = !A.carrying;
    else A.show[k] = !A.show[k];
    el.querySelector('[data-c="spin"]').setAttribute('aria-pressed', String(A.spin));
    if (k in A.show) b.setAttribute('aria-pressed', String(A.show[k]));
    if (k === 'fold') b.setAttribute('aria-pressed', String(!!A.foldTo));
    if (k === 'carry') b.setAttribute('aria-pressed', String(A.carrying));
    drawShip(A, $('shipCanvas'));
  };
  el.onchange = e => { if (e.target.dataset.c === 'bank') { A.bank = +e.target.value; drawShip(A, $('shipCanvas')); } };
}

/* Dragging across the ship turns it, a frame for every few pixels. */
function wireShipCanvas(A, c) {
  let x0 = null, h0 = 0;
  c.onpointerdown = e => { x0 = e.clientX; h0 = A.heading; A.spin = false; c.setPointerCapture(e.pointerId); syncSpin(A); };
  c.onpointermove = e => {
    if (x0 === null || SHIP_ANIM !== A) return;
    const step = Math.max(2, 240 / A.per);
    A.heading = (((h0 + (e.clientX - x0) / step) % A.per) + A.per) % A.per;
    drawShip(A, c);
  };
  c.onpointerup = c.onpointercancel = () => { x0 = null; };
}
function syncSpin(A) {
  const b = document.querySelector('#shipCtl [data-c="spin"]');
  if (b) b.setAttribute('aria-pressed', String(A.spin));
}

/* ---- wiring --------------------------------------------------------------- */

function wireShips() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    e.preventDefault();
    if (a.dataset.view === 'ships' && !SHIPS.on) shipsShow(SHIPS.id);
    else if (a.dataset.view === 'map' && SHIPS.on) shipsLeave();
  });
  const onClick = e => {
    const a = e.target.closest('[data-ship],[data-ships],[data-stellar]');
    if (!a || !SHIPS.on) return;
    e.preventDefault();
    if (a.dataset.ships === 'list') shipsShow(null);
    else if (a.dataset.ship) shipsShow(+a.dataset.ship);
    else if (a.dataset.stellar) { shipsLeave(); goStellar(+a.dataset.stellar); }
  };
  $('ships').addEventListener('click', onClick);
  $('crumbs').addEventListener('click', onClick);
  $('shipSearch').addEventListener('input', () => { SHIPS.q = $('shipSearch').value; renderShipList(); });
  $('shipSort').addEventListener('change', () => { SHIPS.sort = $('shipSort').value; renderShipList(); });
  document.addEventListener('pictready', () => { if (SHIPS.on) renderShipPictures(); });
  window.addEventListener('keydown', e => {
    if (!SHIPS.on || e.target.closest('input, select, textarea')) return;
    const A = SHIP_ANIM;
    if (e.key === 'Escape' && SHIPS.id !== null) shipsShow(null);
    else if (A && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      A.spin = false; syncSpin(A);
      A.heading = (Math.floor(A.heading) + (e.key === 'ArrowLeft' ? A.per - 1 : 1)) % A.per;
      drawShip(A, $('shipCanvas'));
      e.preventDefault();
    } else if (A && e.key === ' ') { A.spin = !A.spin; syncSpin(A); e.preventDefault(); }
  });
}

wireShips();
