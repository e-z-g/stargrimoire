/* page-library.js -- the Library view: the records as tables to sort, and
   every description, string list, picture and sound in the files.
   =========================================================================

   The bar's Library (#library=table.ship, =text, =pict, =snd). A table
   holds a record type's fields as the records have them, sorted by any
   column, each row a link to the record's panel. Text, pictures and sounds
   are listed by id and name; where the program says what one is for (an
   outfit's description in the outfitter, its picture ...), that is said,
   the base it adds to linked to the instruction it was read from
   (novaFigure, codeNum).

   PAGE SCRIPT. LOAD ORDER: after page-map.js, page-ships.js,
   page-battle.js, page-records.js and page-code.js. */

const LIB = { on: false, tab: 'table', type: 'shïp', sort: null, desc: false, q: '' };

// The tables: a type, its columns (fields as the record names them), and where a row links.
const LIB_TABLES = [
  ['shïp', 'Ships', ['Cost', 'TechLevel', 'Holds', 'Shield', 'Armor', 'Speed', 'Accel', 'Maneuver', 'Fuel', 'FreeMass', 'MaxGun', 'MaxTur', 'Crew', 'Strength', 'Mass', 'Length', 'BuyRandom']],
  ['oütf', 'Outfits', ['Cost', 'Mass', 'TechLevel', 'Max', 'ModType', 'ModVal', 'BuyRandom', 'DispWeight']],
  ['wëap', 'Weapons', ['MassDmg', 'EnergyDmg', 'Reload', 'Count', 'Speed', 'Guidance', 'AmmoType', 'Inaccuracy', 'ProxRadius', 'BlastRadius', 'Ionization']],
  ['ränk', 'Ranks', ['Weight', 'Govt', 'PriceMod', 'Salary', 'SalaryCap']],
  ['gövt', 'Governments', ['InitialRec', 'CrimeTol', 'SmugPenalty', 'DisabPenalty', 'BoardPenalty', 'KillPenalty', 'ShootPenalty', 'MaxOdds', 'SkillMult', 'ScanFine']],
  ['përs', 'People', ['ShipType', 'Govt', 'AIType', 'Aggress', 'Coward', 'Credits', 'ShieldMod', 'LinkSyst']],
  ['flët', 'Fleets', ['LeadShipType', 'Govt', 'LinkSyst']],
  ['jünk', 'Commodities', ['BasePrice']],
  ['sÿst', 'Systems', ['Govt', 'AvgShips', 'Asteroids', 'Interference', 'Murk']],
  ['spöb', 'Stellars', ['TechLevel', 'Govt', 'MinStatus', 'Tribute', 'DefCount', 'Gravity', 'Strength']],
];

function libLink(type, id, label) {
  const name = esc(label);
  if (type === 'shïp') return `<a data-ship="${id}">${name}</a>`;
  if (type === 'sÿst') return U.byId.has(id) ? `<a data-sys="${id}">${name}</a>` : name;
  if (type === 'spöb') return U.inSystems.has(id) ? `<a data-stellar="${id}">${name}</a>` : name;
  if (NOVA_REC_WORD.has(type)) return `<a data-rec="${NOVA_REC_WORD.get(type)}.${id}">${name}</a>`;
  return name;
}

/* What the program says a dësc or PICT is for: html, or ''. */
function libRole(res, id) {
  const roles = res === 'dësc' ? [['outfitDesc', 'oütf', "outfitter's description of"], ['shipDesc', 'shïp', "shipyard's description of"], ['escortDesc', 'shïp', 'description for hire of']]
    : res === 'PICT' ? [['outfitPict', 'oütf', "outfitter's picture of"]] : [];
  for (const [name, type, what] of roles) {
    const f = fig(name);
    if (!f) continue;
    const n = id - f.value, rec = id >= f.value && GAME.get(type, 128 + n);
    if (rec) return `the ${esc(what)} ${libLink(type, 128 + n, novaNameParts(rec.name).name)}: ${esc(res)} ${codeNum(f)} + ${n}`;
  }
  return '';
}

/* ---- in and out of the view -------------------------------------------- */

function libFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.has('library')) { if (LIB.on) libLeave(true); return false; }
  const [tab, type] = (p.get('library') || 'table').split('.');
  libShow(tab, type, { fromHash: true });
  return true;
}
// A type in an address, its letters plain: shïp is ship.
const libWord = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function libHash() { return '#library=' + LIB.tab + (LIB.tab === 'table' ? '.' + libWord(LIB.type) : ''); }
function libShow(tab, type, opts = {}) {
  if (SHIPS.on) shipsLeave(true);
  if (BATTLE.on) battleLeave(true);
  if (CODE.on) codeLeave(true);
  LIB.on = true;
  LIB.tab = ['table', 'text', 'pict', 'snd'].includes(tab) ? tab : 'table';
  const known = type && LIB_TABLES.find(t => t[0] === type || libWord(t[0]) === type);
  if (known && known[0] !== LIB.type) { LIB.type = known[0]; LIB.sort = null; }
  $('app').hidden = true;
  $('library').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'library'));
  $('crumbs').innerHTML = '';
  if (LIB.tab === 'snd' || LIB.tab === 'pict') wantShipFiles();
  renderLibrary();
  if (!opts.fromHash && location.hash !== libHash()) history.pushState(null, '', libHash());
}
function libLeave(fromHash) {
  LIB.on = false;
  $('library').hidden = true;
  $('app').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'map'));
  resizeCanvas();
  if (!fromHash) writeHash();
  renderCrumbs();
  renderPanel();
  redraw();
}

/* ---- the view ------------------------------------------------------------ */

function renderLibrary() {
  const tabs = [['table', 'Tables'], ['text', 'Text'], ['pict', 'Pictures'], ['snd', 'Sounds']]
    .map(([k, l]) => `<button data-lib-tab="${k}" class="${LIB.tab === k ? 'on' : ''}">${l}</button>`).join('');
  const q = LIB.q.trim().toLowerCase();
  let body = '';
  if (LIB.tab === 'table') body = libTable(q);
  else if (LIB.tab === 'text') body = libText(q);
  else if (LIB.tab === 'pict') body = libPictures(q);
  else body = libSounds(q);
  $('library').innerHTML = `<div class="libTop">${tabs}
      ${LIB.tab === 'table' ? `<select id="libType">${LIB_TABLES.map(([t, l]) => `<option value="${esc(t)}"${t === LIB.type ? ' selected' : ''}>${l}</option>`).join('')}</select>` : ''}
      <input type="search" id="libSearch" placeholder="Filter" value="${esc(LIB.q)}" autocomplete="off"></div>
    <div class="libBody">${body}</div>`;
  if (LIB.tab === 'pict') libFillPictures();
}

function libTable(q) {
  const [type, , cols] = LIB_TABLES.find(t => t[0] === LIB.type);
  let rows = novaAll(GAME, type).map(r => ({ r, name: novaNameParts(r.name).name || `${type} ${r.id}` }));
  if (q) rows = rows.filter(x => x.name.toLowerCase().includes(q));
  const key = LIB.sort;
  if (key) {
    const v = x => (key === 'id' ? x.r.id : key === 'name' ? x.name : x.r[key]);
    rows.sort((a, b) => { const A = v(a), B = v(b); const c = typeof A === 'string' ? A.localeCompare(B) : A - B; return LIB.desc ? -c : c; });
  }
  const head = [['id', 'id'], ['name', 'Name'], ...cols.map(c => [c, c])]
    .map(([k, l]) => `<th data-lib-sort="${k}" class="${key === k ? (LIB.desc ? 'down' : 'up') : ''}">${esc(l)}</th>`).join('');
  const cell = (r, c) => { const v = r[c]; return `<td>${esc(Array.isArray(v) ? v.join(', ') : novaFieldText(S_KIND(type, c), v))}</td>`; };
  return `<p class="note">${rows.length} ${esc(type)} records, their fields as the files have them; a field's meaning is its note in the record's Every field. Tap a column to sort by it.</p>
    <div class="libScroll"><table class="libTable"><thead><tr>${head}</tr></thead><tbody>${rows.map(({ r, name }) =>
      `<tr><td>${r.id}</td><td>${libLink(type, r.id, name)}</td>${cols.map(c => cell(r, c)).join('')}</tr>`).join('')}</tbody></table></div>`;
}
// A field's kind, for printing it as the Every field box does.
function S_KIND(type, field) { const f = NOVA_RECORDS[type].find(x => x[0] === field); return f ? f[1] : 'i16'; }

function libText(q) {
  const descs = GAME.list('dësc').map(e => ({ e, d: novaGet(GAME, 'dësc', e.id) })).filter(x => x.d);
  const hits = descs.filter(({ e, d }) => !q || String(e.id).includes(q) || (e.name || '').toLowerCase().includes(q) || (d.Description || '').toLowerCase().includes(q));
  const strs = GAME.list('STR#').map(e => ({ e, list: novaStrings(GAME, e.id) }))
    .filter(({ e, list }) => !q || String(e.id).includes(q) || (e.name || '').toLowerCase().includes(q) || list.some(s => s.toLowerCase().includes(q)));
  const shown = hits.slice(0, 300);
  return `<p class="note">${hits.length} descriptions${hits.length > shown.length ? `, the first ${shown.length} shown; filter to find more` : ''}, and ${strs.length} string lists. Each as the files have it.</p>
    <h3>Descriptions</h3>
    ${shown.map(({ e, d }) => { const role = libRole('dësc', e.id); return `<details class="libItem"><summary>dësc ${e.id}${e.name ? ' · ' + esc(e.name) : ''}<small>${esc((d.Description || '').slice(0, 90))}</small></summary>
      ${role ? `<p class="note">${role}</p>` : ''}<div class="desc">${esc(d.Description || '')}</div></details>`; }).join('')}
    <h3>String lists</h3>
    ${strs.slice(0, 200).map(({ e, list }) => `<details class="libItem"><summary>STR# ${e.id}${e.name ? ' · ' + esc(e.name) : ''}<small>${list.length} strings</small></summary>
      <ol class="libStrs">${list.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>`).join('')}`;
}

function libPictures(q) {
  const all = GAME.list('PICT').filter(e => !q || String(e.id).includes(q) || (e.name || '').toLowerCase().includes(q));
  const shown = all.slice(0, 400);
  return `<p class="note">${all.length} pictures${all.length > shown.length ? `, the first ${shown.length} shown; filter by id or name to find more` : ''}.</p>
    <div class="libPicts">${shown.map(e => { const role = libRole('PICT', e.id); return `<figure data-pict="${e.id}"><div class="nopict wait">PICT ${e.id}</div><figcaption>PICT ${e.id}${e.name ? ' · ' + esc(e.name) : ''}${role ? `<br>${role}` : ''}</figcaption></figure>`; }).join('')}</div>`;
}
// Pictures drawn as they come near the screen, a few at a time.
let LIB_OBSERVER = null;
function libFillPictures() {
  if (LIB_OBSERVER) LIB_OBSERVER.disconnect();
  const draw = fig => {
    const id = +fig.dataset.pict, img = pictImage(id), box = fig.querySelector('.nopict');
    if (img && box) { const c = asCanvas(img, 'pict'); box.replaceWith(c); }
    else if (!img && PICT_CACHE.get(id) === 'failed' && box) box.textContent = `PICT ${id} does not read`;
  };
  if (!('IntersectionObserver' in window)) { document.querySelectorAll('#library figure[data-pict]').forEach(draw); return; }
  LIB_OBSERVER = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) draw(e.target); }), { rootMargin: '400px' });
  document.querySelectorAll('#library figure[data-pict]').forEach(f => LIB_OBSERVER.observe(f));
}
document.addEventListener('pictready', () => { if (LIB.on && LIB.tab === 'pict') document.querySelectorAll('#library figure[data-pict]').forEach(f => { if (f.querySelector('.nopict')) { const id = +f.dataset.pict, img = pictImage(id); if (img) f.querySelector('.nopict').replaceWith(asCanvas(img, 'pict')); } }); });

function libSounds(q) {
  const all = GAME.list('snd ').filter(e => !q || String(e.id).includes(q) || (e.name || '').toLowerCase().includes(q));
  const waiting = !all.length && (PENDING.length || PUMPING || SHIP_FILES.length);
  return `<p class="note">${all.length ? `${all.length} sounds.` : waiting ? 'The sounds are in the sounds files, being read.' : 'No sounds in the files open.'}</p>
    <table class="kv libSnds">${all.map(e => `<tr><td>snd ${e.id}</td><td>${esc(e.name || '')}</td><td><button data-lib-play="${e.id}">Play</button></td></tr>`).join('')}</table>`;
}
let LIB_AUDIO = null;
function libPlay(id) {
  const r = GAME.get('snd ', id);
  if (!r) return;
  try {
    const w = novaSndToWav(r.bytes);
    if (LIB_AUDIO) { LIB_AUDIO.pause(); URL.revokeObjectURL(LIB_AUDIO.src); }
    LIB_AUDIO = new Audio(URL.createObjectURL(w.blob));
    LIB_AUDIO.play().catch(() => {});
  } catch (e) { setStatus(`snd ${id}: ${e.message}`, true); }
}

/* ---- wiring --------------------------------------------------------------- */

function wireLibrary() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    if (a.dataset.view === 'library') { e.preventDefault(); e.stopImmediatePropagation(); if (!LIB.on) libShow(LIB.tab, LIB.type); }
    else if (LIB.on) { e.preventDefault(); e.stopImmediatePropagation(); libLeave(); if (a.dataset.view === 'ships') shipsShow(SHIPS.id); else if (a.dataset.view === 'battle') battleShow(); else if (a.dataset.view === 'code') codeShow(null, null); }
  }, true);
  const el = $('library');
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-lib-tab],[data-lib-sort],[data-lib-play],[data-ship],[data-sys],[data-stellar],[data-rec]');
    if (!t) return;
    const d = t.dataset;
    if (d.libTab) { libShow(d.libTab, LIB.type); return; }
    if (d.libSort) { if (LIB.sort === d.libSort) LIB.desc = !LIB.desc; else { LIB.sort = d.libSort; LIB.desc = false; } renderLibrary(); return; }
    if (d.libPlay) { libPlay(+d.libPlay); return; }
    e.preventDefault();
    libLeave();
    if (d.ship) shipsShow(+d.ship);
    else if (d.sys) goSystem(+d.sys);
    else if (d.stellar) goStellar(+d.stellar);
    else if (d.rec) recOpen(d.rec);
  });
  el.addEventListener('change', e => { if (e.target.id === 'libType') libShow('table', e.target.value); });
  el.addEventListener('input', e => {
    if (e.target.id !== 'libSearch') return;
    LIB.q = e.target.value;
    const at = e.target.selectionStart;
    renderLibrary();
    const s = $('libSearch'); s.focus(); s.setSelectionRange(at, at);
  });
}
wireLibrary();
