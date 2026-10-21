/* page-collection.js -- the bar's Plug-ins: the community's, from archive.org.
   =========================================================================

   Four sets, as nova-collection.js reads archive.org's listings of them:
   each plug-in a row with its size and folder, and, for the Nova ones,
   its description, fetched when opened. The ticked ones, from any of the
   sets, are fetched whole and opened into the game together, as the
   visitor's files would be (openGameFiles), and remembered with it. A
   listing is fetched once a visit, when its set is first shown.

   The page's script: DOM here. LOAD ORDER: after js/page-open.js and
   js/nova-collection.js; page-map.js shows the button. */

const COLLECTION = { at: 'nova', lists: new Map(), ticked: new Map(), q: '', about: new Map() };

// A set's plug-ins, its listing fetched the first time.
async function collectionList(c) {
  if (COLLECTION.lists.has(c.key)) return COLLECTION.lists.get(c.key);
  const r = await fetch(c.zip ? `${NOVA_COLLECTION_BASE}${c.item}/${c.zip}/` : `https://archive.org/metadata/${c.item}`);
  if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
  const files = c.zip ? novaCollectionZip(await r.text()) : novaCollectionItem(await r.json());
  const list = novaCollectionEntries(c, files);
  COLLECTION.lists.set(c.key, list);
  return list;
}

function collectionAsk() {
  const el = document.getElementById('choose'), box = el.querySelector('.box');
  box.className = 'box coll';
  box.innerHTML = `<h2>Plug-ins on archive.org</h2>
    <div class="collSets">${NOVA_COLLECTIONS.map(c => `<button data-set="${c.key}">${esc(c.label)}</button>`).join('')}</div>
    <p class="note" id="collNote"></p>
    <input type="search" id="collSearch" placeholder="Find a plug-in" autocomplete="off" value="${esc(COLLECTION.q)}">
    <div id="collRows"></div>
    <div class="actions"><span class="note" id="collTicked"></span><button data-a="cancel">Close</button><button data-a="open">Open</button></div>`;
  el.hidden = false;
  const close = () => { el.hidden = true; box.className = 'box'; };
  box.querySelector('#collSearch').oninput = e => { COLLECTION.q = e.target.value; collectionRows(); };
  box.onchange = e => {
    const { i, g } = e.target.dataset;
    if (i === undefined && g === undefined) return;
    for (const f of i !== undefined ? [COLLECTION.shown[+i]] : COLLECTION.packages[+g].files)
      if (e.target.checked) COLLECTION.ticked.set(f.url, f); else COLLECTION.ticked.delete(f.url);
    collectionSync();
    collectionTicked();
  };
  // a details' toggle does not bubble: caught on its way down
  box.querySelector('#collRows').addEventListener('toggle', e => { if (e.target.open && e.target.dataset.about) collectionAbout(e.target); }, true);
  box.onclick = e => {
    const s = e.target.closest('[data-set]');
    if (s) { COLLECTION.at = s.dataset.set; collectionShow(); return; }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    close();
    if (a.dataset.a === 'open') collectionOpen([...COLLECTION.ticked.values()]);
  };
  collectionShow();
  collectionTicked();
}

async function collectionShow() {
  const c = NOVA_COLLECTIONS.find(x => x.key === COLLECTION.at), rows = document.getElementById('collRows');
  for (const b of document.querySelectorAll('#choose [data-set]')) b.classList.toggle('on', b.dataset.set === c.key);
  document.getElementById('collNote').textContent = c.note;
  if (!COLLECTION.lists.has(c.key)) {
    rows.innerHTML = '<p class="note">Fetching the list from archive.org…</p>';
    try { await collectionList(c); }
    catch (err) { if (COLLECTION.at === c.key) rows.innerHTML = `<p class="note warn">Could not fetch the list from archive.org: ${esc(err.message)}</p>`; return; }
    if (COLLECTION.at !== c.key) return;
  }
  collectionRows();
}

function collectionRows() {
  const rows = document.getElementById('collRows'), list = COLLECTION.lists.get(COLLECTION.at);
  if (!rows || !list) return;
  const q = COLLECTION.q.trim().toLowerCase();
  COLLECTION.shown = q ? list.filter(f => (f.name + ' ' + f.folder).toLowerCase().includes(q)) : list;
  const at = new Map(COLLECTION.shown.map((f, i) => [f, i]));
  const one = (f, folder = true) => `<div class="collRow"><label><input type="checkbox" data-i="${at.get(f)}"><span>${esc(f.name)} <small>${fmtBytes(f.size)}${folder && f.folder ? ' · ' + esc(f.folder) : ''}</small></span></label>` +
    (f.about ? `<details data-about="${esc(f.about)}"><summary>About</summary><div class="desc note"></div></details>` : '') + '</div>';
  // a set of packages: a folder of several files is one row, its files under it
  const c = NOVA_COLLECTIONS.find(x => x.key === COLLECTION.at);
  COLLECTION.packages = c.packages ? novaCollectionPackages(COLLECTION.shown) : null;
  rows.innerHTML = `<p class="note">${COLLECTION.shown.length === list.length ? list.length.toLocaleString() : `${COLLECTION.shown.length.toLocaleString()} of ${list.length.toLocaleString()}`}${c.packages ? ' files' : ''}</p>` +
    (COLLECTION.packages ? COLLECTION.packages.map((p, g) => p.files.length === 1 ? one(p.files[0]) :
      `<div class="collRow collPackage"><label><input type="checkbox" data-g="${g}"><span>${esc(p.folder)} <small>${p.files.length} files, ${fmtBytes(p.files.reduce((s, f) => s + f.size, 0))}</small></span></label>` +
      `<details><summary>The files</summary>${p.files.map(f => one(f, false)).join('')}</details></div>`).join('')
      : COLLECTION.shown.map(f => one(f)).join(''));
  collectionSync();
}

// Every box as COLLECTION.ticked has it, a package's half-ticked while only some of its files are.
function collectionSync() {
  for (const b of document.querySelectorAll('#collRows input[data-i]')) b.checked = COLLECTION.ticked.has(COLLECTION.shown[+b.dataset.i].url);
  for (const b of document.querySelectorAll('#collRows input[data-g]')) {
    const files = COLLECTION.packages[+b.dataset.g].files, n = files.filter(f => COLLECTION.ticked.has(f.url)).length;
    b.checked = n === files.length;
    b.indeterminate = n > 0 && n < files.length;
  }
}

function collectionTicked() {
  const t = [...COLLECTION.ticked.values()], el = document.getElementById('collTicked');
  if (el) el.textContent = t.length ? `${t.length} ticked, ${fmtBytes(t.reduce((s, f) => s + f.size, 0))}` : '';
  const open = document.querySelector('#choose [data-a="open"]');
  if (open) open.disabled = !t.length;
}

// A Nova plug-in's description, fetched the first time it is opened.
async function collectionAbout(det) {
  const url = det.dataset.about, out = det.querySelector('.desc');
  const show = s => {
    const a = novaCollectionAbout(s);
    out.innerHTML = a.head.map(l => `<small>${esc(l)}</small>`).join('<br>') + (a.head.length ? '<br><br>' : '') + esc(a.text);
  };
  if (COLLECTION.about.has(url)) { show(COLLECTION.about.get(url)); return; }
  out.textContent = 'Fetching…';
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    const s = await r.text();
    COLLECTION.about.set(url, s);
    show(s);
  } catch (err) { out.textContent = 'Could not fetch the description from archive.org: ' + err.message; }
}

// The ticked plug-ins, fetched one after another and opened together.
async function collectionOpen(list) {
  if (!list.length) return;
  const picked = [];
  for (const f of list) {
    try { picked.push(await fetchBytes(f.url, ' from archive.org')); }
    catch (err) { setStatus(`Could not fetch ${f.name} from archive.org: ${err.message}`, true); return; }
  }
  // kept ticked when the opening is cancelled, as with plug-ins that have the same records
  if (await openGameFiles(picked)) COLLECTION.ticked.clear();
}

function wireCollection() {
  document.getElementById('collectionBtn').addEventListener('click', collectionAsk);
}
