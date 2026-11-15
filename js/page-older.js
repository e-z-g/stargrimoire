/* page-older.js -- Escape Velocity and EV Override on the map and in the
   ships.
   =========================================================================

   The map draws their systems, links, stellars and nebulae as it draws EV
   Nova's (nova-universe.js reads their numbered fields). The panels here
   take the place of Nova's: what each record links to, by the field names
   in the games' own templates, and the numbers the program adds to find a
   record's pictures and descriptions (NOVA_OLDER_FIGURES in
   nova-program.js), each linked to its instruction once the installer's
   program is open. What the other fields do in these games is not read yet,
   so a panel gives every field's value and no meanings. Nova's control
   bits, missions, ships in flight, hypergates and services stay off.

   The ships: each class's sprites are spïn n for shïp n, a PICT of frames
   in rows and a PICT mask beside it, and the list groups the classes whose
   spïn have the same picture. A ship steps through its frames in order ten
   times a second, since how fast it turns in the game is not read.

   PAGE SCRIPT. LOAD ORDER: after page-map.js, page-ships.js, page-records.js
   and page-code.js. */

const olderOn = () => !!(GAME && GAME.kind() !== 'nova');
const olderGameName = () => NOVA_GAME_NAMES[GAME.kind()] || '';

/* ---- a record's fields ----------------------------------------------------- */

// Every field of a record by its template, with no notes.
function olderFieldsTable(type, rec) {
  const table = GAME.table(type);
  if (!table || !rec) return '';
  const rows = table.filter(([name, kind]) => kind !== 'pad' && name in rec)
    .map(([name, kind]) => `<tr><td>${esc(name)}</td><td>${esc(novaFieldText(kind, rec[name]))}</td></tr>`).join('');
  return `<details class="fieldsBox"><summary>Every field of ${esc(type)} ${rec.id} in ${esc(rec.file)}</summary><table class="fields">${rows}</table></details>`;
}
// A record named by its type and number, or the number where the files have none.
function olderRecName(type, id) {
  const r = GAME.get(type, id);
  return r ? esc(novaNameParts(r.name).name || `${type} ${id}`) : esc(`${type} ${id}`);
}
// A list of the records a set of fields names, each with the matching value of a second set.
function olderListed(rec, field, type, beside, word) {
  const ids = [].concat(rec[field] ?? []), by = [].concat(rec[beside] ?? []);
  return ids.map((id, i) => (id >= 128 ? `${olderRecName(type, id)}${beside ? ` <span class="note">${esc(word)} ${by[i]}</span>` : ''}` : '')).filter(Boolean).join('<br>');
}
// A number the program adds, linked to its instruction where the program is open.
const olderBase = (name, own) => figText(name, own);
function olderProgramNote() {
  return program() ? '' : `<p class="note">Open the ${esc(olderGameName())} installer to link these numbers to where its program uses them.</p>`;
}

/* ---- the map's panels ------------------------------------------------------- */

function olderGalaxyPanel() {
  const byGovt = new Map();
  for (const s of U.systems) byGovt.set(s.govt, (byGovt.get(s.govt) || 0) + 1);
  const legend = [...byGovt].sort((a, b) => b[1] - a[1]).map(([g, n]) =>
    `<div data-govt="${g}" class="${VIEW.govt === g ? 'on' : ''}">${chip(govtFill(g))}${esc(govtName(g))}<small>${n}</small></div>`).join('');
  const places = new Set(U.systems.map(s => s.x + ',' + s.y)).size;
  const neb = U.nebulae.map(n => `<a data-nebula="${n.id}">${esc(n.name)}</a>`).join('');
  const files = GAME.files.map(f => `<tr><td>${esc(f.name)}</td><td>${f.plugin ? 'plug-in' : esc(f.role || '')}</td></tr>`).join('');
  const versions = places < U.systems.length
    ? ' Some places have two or more systems. The map draws them all. Which one the game shows depends on VisBit. The page does not read that field.' : '';
  return `<h2>The galaxy</h2>
    <div class="sub">${esc(olderGameName())} · ${U.systems.length} systems at ${places} places · ${LINKS.length} hyperspace links</div>
    <p class="note">The map shows every system in ${esc(olderGameName())}'s files.${versions} Tap a system to see it. Tap it again to go in.</p>
    <p class="note">The panels name each field as the game's templates do. The page colors each government differently. Every record is in the <a data-view-lib>Library</a>.</p>
    ${routeBlock()}
    <h3>Governments</h3><div class="legend">${legend}</div>
    <h3>Nebulae</h3><div class="list">${neb || '<span class="note">none</span>'}</div>
    <details><summary>Files open</summary><table class="kv">${files}</table></details>`;
}

function olderNebulaPanel(n) {
  const have = n.picts.filter(p => GAME.has('PICT', p.id));
  const pic = have.map(p => { const f = novaPictFrame(GAME, p.id); return `PICT ${p.id}${f ? ` (${f.w} × ${f.h})` : ''}`; }).join(', ');
  return `<h2>${esc(n.name)}</h2><div class="sub">nëbu ${n.id}</div>
    <table class="kv">
      ${kvRow('Place', `at ${n.x}, ${n.y} (${n.w} × ${n.h} map units)`)}
      ${kvRow('Pictures', esc(pic || 'none in these files') + `<br><span class="note">PICT ${olderBase('nebulaPict', NOVA_OLDER.nebulaPict)} + ${olderBase('nebulaPicts', NOVA_OLDER.nebulaPicts)} × ${n.id - 128} and the two pictures after it. The map draws the last of them that fits its rectangle. It draws the first when none fits.</span>`)}
    </table>
    ${olderProgramNote()}
    ${olderFieldsTable('nëbu', n.rec)}`;
}

function olderSystemPanel(sys) {
  const r = sys.rec;
  const inGalaxy = VIEW.mode === 'galaxy';
  const seen = new Set();
  const links = novaSystemLinks(U, sys, SHOWN).map(({ id, target }) => {
    if (!target) return `<span class="no">${esc('sÿst ' + id)}</span>`;
    if (seen.has(target.id)) return '';
    seen.add(target.id);
    return sysLink(target.id);
  }).join('');
  const stellars = sys.stellars.map(id => stellarLink(id, sys.id)).join('');
  const versions = sys.versions.length > 1 ? sys.versions.map(v =>
    `<tr><td>${v.id === sys.id ? esc(v.name) : sysLink(v.id, v.name)} <span class="note">${v.id}</span></td><td>VisBit ${v.rec.VisBit}</td></tr>`).join('') : '';
  return `<h2>${chip(govtFill(sys.govt))}${esc(sys.name)}</h2>
    <div class="sub">sÿst ${sys.id} · ${esc(govtName(sys.govt))} · at ${sys.x}, ${sys.y}</div>
    <div class="actions">${inGalaxy ? `<button data-open="${sys.id}">Go to ${esc(sys.name)}</button>` : '<button data-go="galaxy">Back to the galaxy</button>'}
      ${ROUTE.from !== null && ROUTE.from !== sys.id ? `<button data-route-to="${sys.id}">Route here from ${esc(U.byId.get(ROUTE.from).name)}</button>` : ''}
      ${ROUTE.from !== sys.id || ROUTE.to !== null ? `<button data-route-from="${sys.id}">Route from here</button>` : ''}</div>
    ${routeBlock()}
    <h3>Stellars</h3><div class="list">${stellars || '<span class="note">none</span>'}</div>
    <h3>Hyperspace links</h3><div class="list">${links || '<span class="note">none</span>'}</div>
    <h3>What its fields name</h3>
    <table class="kv">
      ${kvRow('Govt', esc(govtName(sys.govt)))}
      ${kvRow('DudeTypes', olderListed(r, 'DudeTypes', 'düde', '% Prob', '% Prob'))}
      ${kvRow('AlwaysPers', olderListed(r, 'AlwaysPers', 'përs'))}
    </table>
    ${versions ? `<h3>Systems at this place</h3><table class="kv">${versions}</table>` : ''}
    ${olderFieldsTable('sÿst', r)}`;
}

function olderStellarPanel(sp) {
  const inSys = U.inSystems.get(sp.id) || [];
  const sysHere = inSys.includes(VIEW.sys) ? VIEW.sys : inSys[0];
  const land = novaLandingPict(sp), n = sp.id - 128;
  const techs = [sp.SpecialTech1, sp.SpecialTech2, sp.SpecialTech3].filter(t => t > 0);
  return `<h2>${esc(sp.name)}</h2>
    <div class="sub">spöb ${sp.id} · Type ${sp.Type} · ${esc(govtName(sp.Govt))}</div>
    <div class="actions">
      ${VIEW.mode === 'planet' ? `<button data-go="system">Back to ${esc(U.byId.get(VIEW.sys).name)}</button>`
        : sysHere !== undefined ? `<button data-land="${sp.id}" data-in="${sysHere}">Look closer</button>` : ''}
    </div>
    <table class="kv">
      ${kvRow('Govt', esc(govtName(sp.Govt)))}
      ${kvRow('TechLevel', String(sp.TechLevel) + (techs.length ? ` <span class="note">SpecialTech ${techs.join(', ')}</span>` : ''))}
      ${kvRow('DefDude', sp.DefDude >= 128 ? `${olderRecName('düde', sp.DefDude)} <span class="note">DefCount ${sp.DefCount}</span>` : '')}
      ${kvRow('Landing picture', `PICT ${land}${sp.CustPicID >= 128 ? ' (its CustPicID)' : ` (${olderBase('landingPict', NOVA_OLDER.landingPict)} + its Type ${sp.Type})`}`)}
      ${kvRow('Description', `dësc ${novaStellarDescId(sp)} (${olderBase('stellarDesc', 128)} + ${n})`)}
      ${kvRow('Sprite', `spïn ${novaStellarSpin(sp)} (${olderBase('stellarSpin', NOVA_OLDER.stellarSpin)} + its Type ${sp.Type})`)}
    </table>
    ${olderProgramNote()}
    <h3>In ${inSys.length === 1 ? 'the system' : 'the systems'}</h3><div class="list">${inSys.map(id => sysLink(id)).join('') || '<span class="note">none: in no system\'s Nav fields</span>'}</div>
    ${olderFieldsTable('spöb', sp)}`;
}

/* The page over the map for a stellar: its landing picture and its
   descriptions, the spaceport's and the bar's, where the files have them. */
function olderRenderPlanet(sp, el) {
  const n = sp.id - 128, id = novaLandingPict(sp);
  const d = descText(novaStellarDescId(sp));
  const barBase = fig('barDesc'), bar = barBase ? descText(barBase.value + n) : null;
  const parts = ['<div class="land"><div id="landPict"></div>'];
  const did = `dësc ${novaStellarDescId(sp)} (${olderBase('stellarDesc', 128)} + ${n})`;
  if (d) parts.push(`<div class="desc">${esc(d.Description)}</div><p class="note">${did}.</p>`);
  else parts.push(`<div class="desc dim">No description: the files have no ${did}.</div>`);
  if (bar) parts.push(`<h3>The bar</h3><div class="desc">${esc(bar.Description)}</div><p class="note">The bar's dialog loads dësc ${barBase.value + n} (${codeNum(barBase)} + ${n}).</p>`);
  parts.push('</div>');
  el.innerHTML = parts.join('');
  const host = el.querySelector('#landPict'), img = pictImage(id);
  if (img) host.appendChild(asCanvas(img, 'pict'));
  else host.innerHTML = `<div class="nopict">${GAME.has('PICT', id) ? 'Reading PICT ' + id + '…' : PENDING.length || PUMPING ? 'Waiting for the titles files…' : 'PICT ' + id + ' is not in these files.'}</div>`;
}

/* ---- sprites in a PICT, with their mask --------------------------------------- */

/* The frames of spïn id: { w, h, count, frame(i) } once its pictures are
   read, or null. The mask is a second PICT the same size, white where the
   sprite is and black around it in every sprite of the two games. A mask
   that decodes smaller than its sheet is left out: some are version 1
   pictures in bands of rows, one opcode each, and mac-rsrc-types.js's
   decodePict reads the first band alone. The sheet's ground is black, as
   the map's and the ship's box are, so a sprite without its mask looks the
   same there. */
const OLDER_SHEETS = new Map();
function olderSheet(spinId) {
  if (OLDER_SHEETS.has(spinId)) return OLDER_SHEETS.get(spinId);
  const spin = novaGet(GAME, 'spïn', spinId);
  if (!spin || !(spin.xSize > 0) || !(spin.ySize > 0)) return null;
  const hasMask = GAME.has('PICT', spin.MasksID);
  const pic = pictImage(spin.SpritesID), mask = hasMask ? pictImage(spin.MasksID) : null;
  if (!pic || (hasMask && !mask)) return null;
  const masked = mask && mask.width >= pic.width && mask.height >= pic.height;
  const w = spin.xSize, h = spin.ySize, cols = Math.max(1, spin.xTiles), rows = Math.max(1, spin.yTiles);
  const frames = [];
  const sheet = {
    w, h, count: cols * rows, spin,
    frame(i) {
      i = ((i % sheet.count) + sheet.count) % sheet.count;
      if (frames[i]) return frames[i];
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(pic, x, y, w, h, 0, 0, w, h);
      if (masked) {
        const px = ctx.getImageData(0, 0, w, h), m = document.createElement('canvas');
        m.width = w; m.height = h;
        const mc = m.getContext('2d');
        mc.drawImage(mask, x, y, w, h, 0, 0, w, h);
        const mp = mc.getImageData(0, 0, w, h).data;
        for (let k = 0; k < mp.length; k += 4) px.data[k + 3] = Math.round((mp[k] + mp[k + 1] + mp[k + 2]) / 3);
        ctx.putImageData(px, 0, 0);
      }
      return (frames[i] = c);
    },
  };
  OLDER_SHEETS.set(spinId, sheet);
  return sheet;
}

/* ---- the ships ---------------------------------------------------------------- */

// The classes whose sprites are the same picture are one look.
function olderShipLook(id) {
  const spin = novaGet(GAME, 'spïn', id);
  return spin ? spin.SpritesID : null;
}
function olderShipThumb(c, id) {
  const sheet = olderSheet(id);
  if (!sheet) return false;
  const f = sheet.frame(0), k = Math.min(c.width / sheet.w, c.height / sheet.h, 1.5);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = k < 1;
  ctx.drawImage(f, (c.width - sheet.w * k) / 2, (c.height - sheet.h * k) / 2, sheet.w * k, sheet.h * k);
  return true;
}

function olderShipHtml(ship) {
  const id = ship.id, n = id - 128;
  const sub = [`shïp ${id}`, ship.InherentGovt >= 128 ? govtName(ship.InherentGovt) : '', ship.file].filter(Boolean).map(esc).join(' · ');
  const fd = fig('shipDesc'), fe = fig('escortDesc');
  const d = fd ? descText(fd.value + n) : null, pd = fe ? descText(fe.value + n) : null;
  const yard = fig('shipyardPict'), other = fig('shipTargetPict');
  const pict = (f, what) => f && GAME.has('PICT', f.value + n)
    ? `<div class="shipPict" data-pict="${f.value + n}"><p class="note">${esc(what)}: PICT ${f.value + n} (${codeNum(f)} + ${n})</p></div>` : '';
  const weapons = olderListed(ship, 'WeapType', 'wëap', 'WeapCount', '×');
  const items = olderListed(ship, 'DefaultItems', 'oütf', 'ItemCount', '×');
  return `<h2>${esc(shipName(id))}</h2><div class="sub">${sub}</div>
    <div class="shipStage"><canvas id="olderShip" class="olderShip" width="160" height="160"></canvas>
      <p class="note">spïn ${id}. The page shows ten of its frames a second in order.</p></div>
    <div class="shipPicts">${pict(yard, 'In the shipyard')}${pict(other, 'The sprite loader\'s picture')}</div>
    ${d ? `<h3>In the shipyard</h3><div class="desc">${esc(d.Description)}</div><p class="note">dësc ${fd.value + n} (${codeNum(fd)} + ${n})</p>` : ''}
    ${pd ? `<h3>For hire</h3><div class="desc">${esc(pd.Description)}</div><p class="note">dësc ${fe.value + n} (${codeNum(fe)} + ${n})</p>` : ''}
    ${olderProgramNote()}
    <h3>What its fields name</h3>
    <table class="kv">
      ${kvRow('WeapType', weapons)}
      ${kvRow('DefaultItems', items)}
      ${kvRow('InherentGovt', ship.InherentGovt >= 128 ? esc(govtName(ship.InherentGovt)) : '')}
    </table>
    ${olderFieldsTable('shïp', ship)}`;
}

// The ship's pictures drawn as they are read, and its sprite turned.
function olderShipPictures() {
  for (const box of $('shipView').querySelectorAll('.shipPict[data-pict]')) {
    if (box.querySelector('canvas')) continue;
    const img = pictImage(+box.dataset.pict);
    if (img) box.insertBefore(asCanvas(img, 'pict'), box.firstChild);
  }
}
let OLDER_SHIP_ANIM = null;
function olderShipShown(ship) {
  const el = $('shipView');
  olderShipPictures();
  olderShipStop();
  const c = el.querySelector('#olderShip');
  if (!c) return;
  const A = { id: ship.id, frame: 0, last: 0, tick: null };
  const step = now => {
    A.tick = null;
    if (!SHIPS.on || !c.isConnected) return;
    const sheet = olderSheet(ship.id);
    if (sheet && now - A.last > 100) {
      A.last = now;
      const k = Math.min(c.width / sheet.w, c.height / sheet.h, 2);
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sheet.frame(A.frame), (c.width - sheet.w * k) / 2, (c.height - sheet.h * k) / 2, sheet.w * k, sheet.h * k);
      if (!reducedMotion()) A.frame++;
    }
    A.tick = requestAnimationFrame(step);
  };
  OLDER_SHIP_ANIM = A;
  A.tick = requestAnimationFrame(step);
}
function olderShipStop() {
  if (OLDER_SHIP_ANIM && OLDER_SHIP_ANIM.tick) cancelAnimationFrame(OLDER_SHIP_ANIM.tick);
  OLDER_SHIP_ANIM = null;
}

/* ---- Nova's switches, hidden for these games ------------------------------------- */

// The switches that depend on Nova's field meanings: which systems a control bit shows, the ships in flight, the gates, the services.
const OLDER_HIDDEN = ['showSel', 'bitsIn', 'optShips', 'optGates', 'litSel'];
const OLDER_DOTS = ['interference', 'asteroids', 'traffic'];
function olderControls(older) {
  for (const id of OLDER_HIDDEN) {
    const el = $(id), label = el && el.closest('label');
    (label || el).hidden = older || (id === 'bitsIn' && $('showSel').value !== 'bits');
  }
  for (const o of $('dotSel').options) if (OLDER_DOTS.includes(o.value)) o.hidden = older;
  if (older) {
    $('showSel').value = 'all';
    $('optGates').checked = false;
    if (OLDER_DOTS.includes($('dotSel').value)) $('dotSel').value = 'govt';
    $('litSel').value = 'all';
    for (const id of ['optGates', 'dotSel', 'litSel']) $(id).dispatchEvent(new Event('change'));
  }
}
