/* page-compare.js -- the open game compared with another release.
   =========================================================================

   The bar's Compare opens a second set of files beside the game: one of
   the releases archive.org keeps, or files of the visitor's own. Only
   their data files and plug-ins are read, as only those hold records
   (nova-compare.js). Then the map rings each system that changed, or is
   new, in pink; a system's, a stellar's, a ship's and a mission's panels
   say what changed in it, field by field; and the galaxy's panel lists
   every change of every type.

   The page's own script: DOM here. LOAD ORDER: after js/page-open.js and
   js/nova-compare.js; page-map.js calls compareRefresh, compareRing,
   compareBlock and compareList. */

/* The releases archive.org's item keeps, each byte for byte
   reference/game/'s copy (MD5 compared, 7 October 2026); 1.1.1 is its disk
   image (js/disk-image.js). */
const ARCHIVE_DIR = 'https://archive.org/cors/Macintosh_Garden_Games_2019_E/';
const COMPARE_RELEASES = [
  { label: '1.0.2', file: 'EV_Nova_1.0.2.sit', size: '80 MB' },
  { label: '1.0.8', file: 'EV_Nova_1.0.8.sit', size: '81 MB' },
  { label: '1.0.10', file: 'EV_Nova_1.0.10.sit', size: '96 MB' },
  { label: '1.1.1', file: 'EV_Nova_1.1.1_for_Mac_OS_X.dmg', size: '94 MB' },
];
let COMPARE = null;   // { label, game, cmp, systems } while comparing
const COMPARE_COLOR = '#ff7ad9';

function compareAsk() {
  const el = document.getElementById('choose'), box = el.querySelector('.box');
  box.innerHTML = `<h2>Compare with</h2>
    <p class="note">What changed from the files chosen here to the ones open: their data files and plug-ins, record by record. Changed systems are ringed in pink on the map, new ones in a dashed ring.</p>
    <div class="actions">${COMPARE_RELEASES.map((r, i) => `<button data-r="${i}">${esc(r.label)} <small>${r.size} from archive.org</small></button>`).join('')}</div>
    <div class="actions"><label class="btn">Files of your own…<input type="file" multiple hidden></label></div>
    <div class="actions">${COMPARE ? '<button data-a="stop">Stop comparing</button>' : ''}<button data-a="cancel">Cancel</button></div>`;
  el.hidden = false;
  box.querySelector('input').onchange = async e => {
    const files = [...e.target.files];
    el.hidden = true;
    const picked = await readPicked(files);
    compareWith(picked, picked.map(p => p.name).join(', '));
  };
  box.onclick = async e => {
    const b = e.target.closest('[data-r],[data-a]');
    if (!b) return;
    el.hidden = true;
    if (b.dataset.a === 'stop') compareStop();
    if (b.dataset.r === undefined) return;
    const r = COMPARE_RELEASES[+b.dataset.r];
    try { compareWith([await fetchBytes(ARCHIVE_DIR + r.file, ' from archive.org')], r.label); }
    catch (err) { setStatus(`Could not fetch ${r.file} from archive.org: ${err.message}`, true); }
  };
}

/* Opens the files as the game to compare with, its data files and plug-ins only. */
async function compareWith(picked, label) {
  const game = novaGame(), refused = [];
  for (const { name, bytes } of picked) {
    setStatus('Reading ' + name + ' to compare');
    await nextPaint();
    try {
      const list = looksLikeStuffIt(bytes) || looksLikeZip(bytes) || looksLikeUdif(bytes) ? novaArchiveFiles(bytes) : [novaLooseFile(name, bytes)].filter(Boolean);
      for (const f of list) if (f.role === 'data' || f.plugin) { await nextPaint(); game.add(f, f.read()); }
    } catch (e) { refused.push(name + ': ' + e.message); }
  }
  if (!game.list('sÿst').length) {
    setStatus('Nothing to compare with: no data files in ' + label + (refused.length ? '; ' + refused.join('; ') : ''), true);
    return;
  }
  COMPARE = { label, game };
  compareRefresh();
  setStatus(`Compared with ${label}: ${COMPARE.cmp.count.toLocaleString()} records differ`);
  renderPanel();
  redraw();
}

function compareStop() {
  COMPARE = null;
  setStatus('');
  renderPanel();
  redraw();
}

/* Worked out again when the open game changes. */
function compareRefresh() {
  if (!COMPARE || !GAME || !U) return;
  COMPARE.cmp = novaCompare(COMPARE.game, GAME);
  COMPARE.systems = novaCompareSystems(COMPARE.cmp, U);
}

/* The ring round a system's mark or a stellar, if it changed: `path` lays
   the shape, at the given extra size. */
function compareRing(ctx, kind, path) {
  if (!kind) return;
  path(kind === 'added' ? 6 : 4);
  ctx.strokeStyle = COMPARE_COLOR; ctx.lineWidth = 2;
  if (kind === 'added') ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}
function compareSystem(id) { return COMPARE && COMPARE.systems ? COMPARE.systems.get(id) || null : null; }
function compareStellar(id) { return COMPARE && COMPARE.cmp ? COMPARE.cmp.get('spöb', id) : null; }

function compareValue(type, field, v) {
  if (v === undefined) return '<span class="no">none</span>';
  if (field === 'name' || typeof v === 'string') return v === '' ? '<span class="no">empty</span>' : esc(v);
  const def = (NOVA_RECORDS[type] || []).find(f => f[0] === field);
  return esc(novaFieldText(def ? def[1] : 'i16', v));
}
function compareFields(type, e) {
  if (!e.fields) return '<p class="note">Its bytes differ.</p>';
  return `<table class="kv compare"><tr><th></th><th>${esc(COMPARE.label)}</th><th>open</th></tr>${e.fields.map(([k, a, b]) =>
    `<tr><td>${esc(k)}</td><td>${compareValue(type, k, a)}</td><td>${compareValue(type, k, b)}</td></tr>`).join('')}</table>`;
}

/* What changed in one record, for its panel: '' when nothing did. */
function compareBlock(type, id) {
  if (!COMPARE || !COMPARE.cmp) return '';
  const e = COMPARE.cmp.change(type, id);
  if (!e) return `<p class="note">The same in ${esc(COMPARE.label)}.</p>`;
  if (e.kind === 'added') return `<h3>Compared with ${esc(COMPARE.label)}</h3><p class="note">Not in ${esc(COMPARE.label)}: new.</p>`;
  return `<h3>Changed since ${esc(COMPARE.label)}</h3>${compareFields(type, e)}`;
}

const COMPARE_LINK = {
  'sÿst': id => `data-sys="${id}"`, 'spöb': id => `data-stellar="${id}"`,
  'shïp': id => `data-ship="${id}"`, 'mïsn': id => `data-mission="${id}"`,
};
function compareName(type, e, link) {
  const n = esc(novaNameParts(e.name).name || `${type} ${e.id}`);
  return link && COMPARE_LINK[type] ? `<a ${COMPARE_LINK[type](e.id)}>${n}</a>` : n;
}

/* Every change, for the galaxy's panel. */
function compareList() {
  if (!COMPARE || !COMPARE.cmp) return '';
  const c = COMPARE.cmp;
  const types = c.types.map(t => {
    const parts = [];
    if (t.changed.length) parts.push(`${t.changed.length} changed`);
    if (t.added.length) parts.push(`${t.added.length} new`);
    if (t.removed.length) parts.push(`${t.removed.length} gone`);
    const rows = [
      ...t.changed.map(e => `<details><summary>${compareName(t.type, e, true)} <span class="note">${e.id}</span></summary>${compareFields(t.type, e)}</details>`),
      ...t.added.map(e => `<div>${compareName(t.type, e, true)} <span class="note">${e.id}, new</span></div>`),
      ...t.removed.map(e => `<div>${compareName(t.type, e, false)} <span class="note">${e.id}, not in the open files</span></div>`),
    ];
    return `<details><summary>${esc(t.type)} <span class="note">${parts.join(', ')}</span></summary><div class="compareList">${rows.join('')}</div></details>`;
  }).join('');
  const sys = [...COMPARE.systems.values()];
  return `<h3>Compared with ${esc(COMPARE.label)}</h3>
    <p class="note">${c.count.toLocaleString()} records differ. On the map, ${sys.filter(k => k === 'changed').length} systems ringed in pink changed or have a stellar that did; ${sys.filter(k => k === 'added').length} in a dashed ring are new.</p>
    ${types || '<p class="note">Nothing differs.</p>'}`;
}

/* ?compare=1.0.2 (or 1.0.8, 1.0.10, 1.1.1, or any URL the page may fetch) compares
   the game the page opens first with that, once. */
let COMPARE_ADDRESS = new URLSearchParams(location.search).get('compare');
async function compareFromAddress() {
  const want = COMPARE_ADDRESS;
  COMPARE_ADDRESS = null;
  if (!want) return;
  const r = COMPARE_RELEASES.find(x => x.label === want);
  const url = r ? ARCHIVE_DIR + r.file : want;
  try { compareWith([await fetchBytes(url, r ? ' from archive.org' : '')], r ? r.label : decodeURIComponent(url.split('/').pop())); }
  catch (err) { setStatus(`Could not fetch ${url} to compare: ${err.message}`, true); }
}

function wireCompare() {
  document.getElementById('compareBtn').addEventListener('click', compareAsk);
}
