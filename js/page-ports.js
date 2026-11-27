/* page-ports.js -- the Ports view: Escape Velocity or EV Override beside
   its Nova port.
   =========================================================================

   The bar's Ports (#ports, #ports=ship for a type). With an elder game
   open, it fetches that game's port from archive.org (EV Classic for Nova
   or EV Override for Nova, in EscapeVelocityPluginCollection's Extras),
   with the ports of the open plug-ins that a port's name pairs with
   (novaPortPairs, from the ev_20250301 and EVO_Ported listings). With
   Nova's files open it fetches the elder game's installer instead, with
   the elder plug-ins from EV.zip or EVO.zip. Either can be the visitor's
   own files. Every file of both is read, pictures and sounds with the
   records, and nova-ports.js compares them.

   The view has a row for each resource type: how many records of it each
   game has, how many are the same, and how many changed. A type opens to
   its fields, each with the Nova field it is read beside and how many
   records differ there, and then to every record that changed, the
   pictures drawn side by side and the sounds played.

   PAGE SCRIPT. LOAD ORDER: after page-library.js. */

const PORTS = { on: false, type: null, q: '', other: null, label: '', cmp: null };

const PORTS_EXTRAS = 'EscapeVelocityPluginCollection/Extras/EV_EVO on Nova/';
const PORTS_BASE = {
  ev: { port: PORTS_EXTRAS + 'EV_Classic_for_Nova_1.1.1.zip', portLabel: 'EV Classic for Nova 1.1.1', portSize: '7.5 MB',
        elder: 'EscapeVelocityPluginCollection/Installers/Escape_Velocity.bin', elderSize: '5.4 MB', ports: 'ev' },
  evo: { port: PORTS_EXTRAS + 'EV_Override_for_Nova_1.1.1.zip', portLabel: 'EV Override for Nova 1.1.1', portSize: '8.6 MB',
         elder: 'EscapeVelocityPluginCollection/Installers/EVOverride.bin', elderSize: '7.1 MB', ports: 'evo' },
};
// The elder plug-ins in the list Add plug-ins shows.
const PORTS_ELDER_SETS = { ev: NOVA_COLLECTIONS.find(c => c.key === 'ev-elder'), evo: NOVA_COLLECTIONS.find(c => c.key === 'evo-elder') };

// The two games, elder first: null when the game opened since is of the same kind as the other.
function portsGames() {
  if (!PORTS.other || (PORTS.other.kind() !== 'nova') === (GAME.kind() !== 'nova')) return null;
  return GAME.kind() === 'nova' ? { elder: PORTS.other, port: GAME } : { elder: GAME, port: PORTS.other };
}
const portsElderKind = () => GAME.kind() !== 'nova' ? GAME.kind() : PORTS.other ? PORTS.other.kind() : null;
const portsNames = () => {
  const k = portsElderKind();
  return { elder: NOVA_GAME_NAMES[k] || 'the elder game', port: GAME.kind() === 'nova' ? 'the open files' : PORTS.label };
};

/* ---- the files to compare with --------------------------------------- */

async function portsChoose() {
  const el = $('choose'), box = el.querySelector('.box');
  const older = GAME.kind() !== 'nova';
  const kinds = older ? [GAME.kind()] : ['ev', 'evo'];
  const plugs = GAME.files.filter(f => f.plugin && !f.edits).map(f => f.name);
  box.className = 'box';
  box.innerHTML = `<h2>Compare with</h2>
    <p class="note">${older ? `This fetches ${esc(NOVA_GAME_NAMES[GAME.kind()])}'s port to Nova from archive.org and compares every file of it with the open game.`
      : 'This fetches Escape Velocity or EV Override from archive.org and compares every file of it with the open files.'}</p>
    <div class="actions">${kinds.map(k => `<button data-ports-base="${k}">${older ? esc(PORTS_BASE[k].portLabel) : esc(NOVA_GAME_NAMES[k])} <small>${older ? PORTS_BASE[k].portSize : PORTS_BASE[k].elderSize} from archive.org</small></button>`).join('')}</div>
    ${plugs.length ? `<p class="note" id="portsPairs">Looking for the plug-ins paired with ${plugs.length === 1 ? 'the open plug-in' : `the ${plugs.length} open plug-ins`}…</p>` : ''}
    <div class="actions"><label class="btn">Your files…<input type="file" multiple hidden></label></div>
    <div class="actions">${PORTS.other ? '<button data-a="stop">Stop comparing</button>' : ''}<button data-a="cancel">Cancel</button></div>`;
  el.hidden = false;
  let pairs = [];
  if (plugs.length) {
    try {
      pairs = await portsPairsFor(older ? GAME.kind() : null, plugs);
      $('portsPairs').innerHTML = pairs.length
        ? `Each plug-in below has a name that pairs with an open one. The ticked ones come with the game.${pairs.map((p, i) => `<label class="pair"><input type="checkbox" data-pair="${i}" checked> ${esc(p.open)} with ${esc(p.entry.name)}</label>`).join('')}`
        : 'No plug-in on archive.org has a name that pairs with an open one. Add them with Your files.';
    } catch (err) { $('portsPairs').textContent = `Could not list the plug-ins on archive.org (${err.message}).`; }
  }
  box.querySelector('input[type=file]').onchange = async e => {
    el.hidden = true;
    const picked = await readPicked([...e.target.files]);
    portsWith(picked, picked.map(p => p.name).join(', '));
  };
  box.onclick = async e => {
    const b = e.target.closest('[data-ports-base],[data-a]');
    if (!b) return;
    if (b.dataset.a === 'stop') { PORTS.other = null; PORTS.cmp = null; el.hidden = true; renderPorts(); return; }
    if (b.dataset.a === 'cancel') { el.hidden = true; return; }
    const k = b.dataset.portsBase, base = PORTS_BASE[k];
    const ticked = pairs.filter((p, i) => { const c = box.querySelector(`[data-pair="${i}"]`); return c && c.checked; });
    el.hidden = true;
    const urls = [novaCollectionUrl(older ? base.port : base.elder), ...ticked.map(p => p.entry.url)];
    const picked = [];
    for (const u of urls) {
      try { picked.push(await fetchBytes(u, ' from archive.org')); }
      catch (err) { setStatus(`Could not fetch ${decodeURIComponent(u.split('/').pop())} from archive.org (${err.message})`, true); return; }
    }
    portsWith(picked, older ? base.portLabel + (ticked.length ? ` with ${ticked.length} plug-in${ticked.length > 1 ? 's' : ''}` : '') : NOVA_GAME_NAMES[k]);
  };
}

/* The open plug-ins paired with archive.org's by name: [{ open, entry }].
   With an elder game open the other side is its ports' set; with Nova
   open, both elder sets, the one with more pairs taken. */
async function portsPairsFor(kind, plugs) {
  const sets = kind ? [NOVA_COLLECTIONS.find(c => c.key === PORTS_BASE[kind].ports)] : [PORTS_ELDER_SETS.ev, PORTS_ELDER_SETS.evo];
  let best = [];
  for (const c of sets) {
    const list = await collectionList(c);
    const pairs = novaPortPairs(plugs, list.map(x => x.name)).map(p => ({ open: p.elder, entry: list.find(x => x.name === p.port) }));
    if (pairs.length > best.length) best = pairs;
  }
  return best;
}

/* Opens the files as the other game, every file of them. */
async function portsWith(picked, label) {
  const game = novaGame(), refused = [];
  for (const { name, bytes } of picked) {
    setStatus('Reading ' + name + ' to compare');
    await nextPaint();
    try {
      const inner = unwrapArchive(bytes);
      if (isArchive(inner)) await archiveReady(inner);
      const list = isArchive(inner) ? novaArchiveFiles(inner) : [novaLooseFile(name, bytes)].filter(Boolean);
      for (const f of list) { await nextPaint(); game.add(f, f.read()); }
    } catch (e) { refused.push(name + ': ' + e.message); }
  }
  const older = GAME.kind() !== 'nova';
  if (!game.files.length || (game.kind() !== 'nova') === older) {
    const kind = older ? 'a Nova port' : 'Escape Velocity or EV Override';
    setStatus(`The page has nothing to compare against. ${label} is not ${kind}.` + (refused.length ? ' ' + refused.join('; ') : ''), true);
    return;
  }
  PORTS.other = game;
  PORTS.label = label;
  portsRefresh();
  if (!PORTS.on) portsShow(null); else renderPorts();
}

/* Worked out again when either game changes. */
function portsRefresh() {
  PORTS.cmp = null;
  const g = portsGames();
  if (!g) return;
  setStatus('Comparing every record of the two games');
  PORTS.cmp = novaPortCompare(g.elder, g.port, { pixels: portsPixels });
  const c = PORTS.cmp.counts;
  setStatus(`${c.same.toLocaleString()} records the same. ${c.differ.toLocaleString()} changed. ${c.onlyElder.toLocaleString()} only in ${portsNames().elder}. ${c.onlyPort.toLocaleString()} only in the port.`);
}
function portsFilesChanged() { if (PORTS.other) { portsRefresh(); if (PORTS.on) renderPorts(); } }

// A PICT's pixels, for nova-ports.js: null for one the page draws only as a QuickTime image.
function portsPixels(bytes) {
  const p = decodePict(bytes);
  if (p.kind !== 'canvas') return null;
  return { width: p.width, height: p.height, bits: p.pixelSize, data: p.canvas.getContext('2d').getImageData(0, 0, p.width, p.height).data };
}

/* ---- in and out of the view -------------------------------------------- */

function portsFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.has('ports')) {
    if (PORTS.on) portsLeave(true);
    return false;
  }
  portsShow(p.get('ports') || null, { fromHash: true });
  return true;
}
const portsHash = () => '#ports' + (PORTS.type ? '=' + libWord(PORTS.type) : '');
function portsShow(type, opts = {}) {
  if (SHIPS.on) shipsLeave(true);
  if (BATTLE.on) battleLeave(true);
  if (CODE.on) codeLeave(true);
  if (LIB.on) libLeave(true);
  PORTS.on = true;
  const t = PORTS.cmp && type && PORTS.cmp.types.find(x => x.type === type || libWord(x.type) === type);
  PORTS.type = t ? t.type : type && !PORTS.cmp ? type : null;
  $('app').hidden = true;
  $('ports').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'ports'));
  $('crumbs').innerHTML = '';
  wantShipFiles();
  renderPorts();
  if (!opts.fromHash && location.hash !== portsHash()) history.pushState(null, '', portsHash());
}
function portsLeave(fromHash) {
  PORTS.on = false;
  $('ports').hidden = true;
  $('app').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'map'));
  resizeCanvas();
  if (!fromHash) writeHash();
  renderCrumbs();
  renderPanel();
  redraw();
}

/* ---- the view ------------------------------------------------------------ */

function renderPorts() {
  const el = $('ports');
  if (!PORTS.cmp) {
    const older = GAME.kind() !== 'nova';
    el.innerHTML = `<h2>${older ? `${esc(NOVA_GAME_NAMES[GAME.kind()])} and its port to Nova` : 'The open files and their elder game'}</h2>
      <p class="note">The community ported Escape Velocity, EV Override, and many of their plug-ins to Nova's formats. This view compares every record, picture, and sound of a game with its port.</p>
      <div class="actions"><button data-ports-choose>Choose what to compare with…</button></div>`;
    return;
  }
  const n = portsNames(), t = PORTS.type && PORTS.cmp.types.find(x => x.type === PORTS.type);
  const top = `<div class="libTop"><button data-ports-type=""${t ? '' : ' class="on"'}>Every type</button>
      ${t ? `<b>${esc(t.type)}</b><input type="search" id="portsSearch" placeholder="Filter" value="${esc(PORTS.q)}" autocomplete="off">` : ''}
      <button data-ports-choose>Compare with…</button></div>`;
  el.innerHTML = top + `<div class="libBody">${t ? portsType(t, n) : portsSummary(n)}</div>`;
  if (t) portsFillPictures(t);
}

function portsSummary(n) {
  const c = PORTS.cmp.counts;
  const rows = PORTS.cmp.types.map(t => `<tr><td><a data-ports-type="${esc(t.type)}">${esc(t.type)}</a></td><td>${t.elder}</td><td>${t.port}</td><td>${t.same}</td><td>${t.differ.length || ''}</td><td>${t.onlyElder.length || ''}</td><td>${t.onlyPort.length || ''}</td><td class="how">${portsHow(t)}</td></tr>`).join('');
  return `<p class="note">${esc(n.elder)} beside ${esc(n.port)}. ${c.same.toLocaleString()} records are the same and ${c.differ.toLocaleString()} changed. ${c.onlyElder.toLocaleString()} ${c.onlyElder === 1 ? 'is' : 'are'} only in ${esc(n.elder)}. ${c.onlyPort.toLocaleString()} ${c.onlyPort === 1 ? 'is' : 'are'} only in the port. The page pairs each record with the port's record of the same type and number. Tap a type for its fields and records.</p>
    <div class="libScroll"><table class="libTable portsSum"><thead><tr><th>type</th><th>${esc(n.elder)}</th><th>port</th><th>same</th><th>changed</th><th>only in ${esc(n.elder)}</th><th>only in the port</th><th>compared by</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function portsHow(t) {
  if (t.how === 'fields') return 'fields';
  if (t.how === 'strings') return 'strings';
  if (t.type === 'PICT') return 'pixels';
  return 'bytes';
}

// A value as the Every field box prints it, of the kind the table it came from gives.
function portsValue(table, field, v) {
  if (v === undefined) return '<span class="no">none</span>';
  if (typeof v === 'string') return v === '' ? '<span class="no">empty</span>' : esc(v);
  const f = (table || []).find(x => x[0] === field);
  return esc(novaFieldText(f ? f[1] : 'i16', v));
}

function portsType(t, n) {
  const q = PORTS.q.trim().toLowerCase();
  const g = portsGames();
  const hit = e => !q || String(e.id).includes(q) || (e.name || '').toLowerCase().includes(q) || (e.portName || '').toLowerCase().includes(q);
  const label = e => `${esc(t.type)} ${e.id}${e.name ? ' · ' + esc(novaNameParts(e.name).name) : ''}${e.portName !== undefined && e.portName !== e.name ? ` <span class="note">(in the port ${esc(e.portName || 'with no name')})</span>` : ''}`;
  const parts = [];
  const are = k => `${k} ${k === 1 ? 'is' : 'are'}`;
  parts.push(`<p class="note">${esc(n.elder)} has ${t.elder} and the port ${t.port}. ${are(t.same)} the same and ${t.differ.length} changed. ${are(t.onlyElder.length)} only in ${esc(n.elder)}. ${are(t.onlyPort.length)} only in the port.${t.pixels.length ? ` ${t.pixels.length} pictures have other bytes and the same pixels.` : ''}${t.rounded.length ? ` ${t.rounded.length} are the elder's picture saved again in 16-bit color. Every channel of every pixel in them is within 8 of the elder's. They count as the same.` : ''}</p>`);
  if (t.how === 'fields') parts.push(portsFieldTable(t, n));
  const differ = t.differ.filter(hit), shown = differ.slice(0, 300);
  if (differ.length) {
    parts.push(`<h3>Changed</h3>${differ.length > shown.length ? `<p class="note">The first ${shown.length} of ${differ.length}. Filter to find more.</p>` : ''}`);
    parts.push(shown.map(e => `<details class="libItem"><summary>${label(e)}</summary>${portsRecord(t, e, g, n)}</details>`).join(''));
  }
  const only = (list, where) => list.filter(hit).length ? `<h3>Only in ${where}</h3><div class="portsOnly">${list.filter(hit).slice(0, 500).map(e => `<span>${e.id}${e.name ? ' ' + esc(novaNameParts(e.name).name) : ''}</span>`).join('')}</div>` : '';
  parts.push(only(t.onlyElder, esc(n.elder)), only(t.onlyPort, 'the port'));
  return parts.join('');
}

function portsFieldTable(t, n) {
  const how = { name: 'the same name', numbered: 'numbered in a list', renamed: 'renamed', bits: 'the expression that has the bit' };
  const rows = t.fields.map(f => `<tr><td>${esc(f.label)}</td><td>${esc(f.nova)}</td><td class="how">${how[f.how]}</td><td>${f.differ ? `${f.differ} of ${f.of}` : ''}</td><td class="how">${f.ratio ? `the port's is ${f.ratio.r} × in ${f.ratio.n}` : ''}</td></tr>`).join('');
  return `<h3>Fields</h3><p class="note">The table pairs each field of ${esc(n.elder)}'s template with a Nova field and counts the records that differ there.${t.fields.some(f => f.how === 'bits') ? " A bit field counts as the same when the port's expression has its bit." : ''}</p>
    <div class="libScroll"><table class="libTable portsFields"><thead><tr><th>${esc(n.elder)}</th><th>Nova</th><th>paired by</th><th>differ</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${t.unpaired.length ? `<p class="note">${t.unpaired.map(esc).join(', ')} ${t.unpaired.length > 1 ? 'have' : 'has'} no Nova field.</p>` : ''}
    ${t.portOnly.length ? `<p class="note">${t.portOnly.map(esc).join(', ')} ${t.portOnly.length > 1 ? 'are' : 'is'} Nova's alone.</p>` : ''}`;
}

function portsRecord(t, e, g, n) {
  if (t.how === 'fields') {
    if (t.type === 'dësc') return portsTexts(e.rows[0].a, e.rows[0].b, n);
    const et = g.elder.table(t.type), nt = NOVA_RECORDS[t.type];
    const rows = e.rows.filter(r => !r.same).map(r => `<tr><td>${esc(r.label)}${r.nova !== r.label ? ` <span class="note">${esc(r.nova)}</span>` : ''}</td><td>${portsValue(et, r.label, r.a)}</td><td>${portsValue(nt, r.nova, r.b)}</td></tr>`);
    const extra = e.extra.map(([f, v]) => `<tr><td>${esc(f)}</td><td><span class="no">none</span></td><td>${portsValue(nt, f, v)}</td></tr>`);
    return `<table class="kv compare"><tr><th></th><th>${esc(n.elder)}</th><th>port</th></tr>${rows.join('')}${extra.length ? `<tr><th colspan="3">The port's fields alone</th></tr>${extra.join('')}` : ''}</table>`;
  }
  if (t.how === 'strings') {
    const a = novaPortStrings(g.elder, t.type, e.id), b = novaPortStrings(g.port, t.type, e.id);
    const rows = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) rows.push(`<tr><td>${i + 1}</td><td>${a[i] === undefined ? '<span class="no">none</span>' : esc(a[i])}</td><td>${b[i] === undefined ? '<span class="no">none</span>' : esc(b[i])}</td></tr>`);
    return `<table class="kv compare"><tr><th></th><th>${esc(n.elder)}</th><th>port</th></tr>${rows.join('')}</table>`;
  }
  if (t.type === 'PICT') return `<div class="portsPicts"><figure data-ports-pict="elder.${e.id}"><div class="nopict wait">PICT ${e.id}</div><figcaption>${esc(n.elder)}</figcaption></figure><figure data-ports-pict="port.${e.id}"><div class="nopict wait">PICT ${e.id}</div><figcaption>port</figcaption></figure></div>`;
  if (t.type === 'snd ') return `<div class="actions"><button data-ports-play="elder.${e.id}">Play ${esc(n.elder)}'s</button><button data-ports-play="port.${e.id}">Play the port's</button></div>`;
  const a = g.elder.get(t.type, e.id).bytes, b = g.port.get(t.type, e.id).bytes;
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  return `<p class="note">${esc(n.elder)}'s is ${a.length} bytes long and the port's ${b.length}. The first difference is at byte ${at}.</p>`;
}
function portsTexts(a, b, n) {
  return `<div class="portsTexts"><div><h4>${esc(n.elder)}</h4><div class="desc">${esc(a || '')}</div></div><div><h4>port</h4><div class="desc">${esc(b || '')}</div></div></div>`;
}

// Each changed picture's two copies, drawn when its row is opened.
function portsFillPictures(t) {
  if (t.type !== 'PICT') return;
  $('ports').querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => {
    if (!d.open) return;
    const g = portsGames();
    d.querySelectorAll('[data-ports-pict]').forEach(f => {
      const [side, id] = f.dataset.portsPict.split('.'), r = g[side].get('PICT', +id), box = f.querySelector('.nopict');
      if (!r || !box) return;
      try {
        const p = decodePict(r.bytes);
        if (p.kind === 'canvas') {
          box.replaceWith(libCanvas(p.canvas));
          f.querySelector('figcaption').textContent += ` · ${p.width} × ${p.height}, ${p.colorSpace}`;
        } else createImageBitmap(p.blob).then(b => box.replaceWith(libCanvas(b)), () => { box.textContent = `PICT ${id} does not read`; });
      } catch (e) { box.textContent = `PICT ${id} does not read`; }
    });
  }, { once: true }));
}

function portsPlay(key) {
  const [side, id] = key.split('.'), r = portsGames()[side].get('snd ', +id);
  if (!r) return;
  try {
    const w = novaSndToWav(r.bytes);
    if (LIB_AUDIO) { LIB_AUDIO.pause(); URL.revokeObjectURL(LIB_AUDIO.src); }
    LIB_AUDIO = new Audio(URL.createObjectURL(w.blob));
    LIB_AUDIO.play().catch(() => {});
  } catch (e) { setStatus(`snd ${id}: ${e.message}`, true); }
}

/* ---- wiring --------------------------------------------------------------- */

function wirePorts() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    if (a.dataset.view === 'ports') { e.preventDefault(); e.stopImmediatePropagation(); if (!PORTS.on) portsShow(PORTS.type); }
    else if (PORTS.on) {
      e.preventDefault(); e.stopImmediatePropagation(); portsLeave();
      if (a.dataset.view === 'ships') shipsShow(SHIPS.id); else if (a.dataset.view === 'battle') battleShow(); else if (a.dataset.view === 'code') codeShow(null, null); else if (a.dataset.view === 'library') libShow(LIB.tab, LIB.type);
    }
  }, true);
  const el = $('ports');
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-ports-type],[data-ports-choose],[data-ports-play]');
    if (!t) return;
    const d = t.dataset;
    if (d.portsChoose !== undefined) { portsChoose(); return; }
    if (d.portsPlay) { portsPlay(d.portsPlay); return; }
    PORTS.type = d.portsType || null;
    PORTS.q = '';
    renderPorts();
    el.scrollTop = 0;
    history.pushState(null, '', portsHash());
  });
  el.addEventListener('input', e => {
    if (e.target.id !== 'portsSearch') return;
    PORTS.q = e.target.value;
    const at = e.target.selectionStart;
    renderPorts();
    const s = $('portsSearch'); s.focus(); s.setSelectionRange(at, at);
  });
}
wirePorts();
