/* page-open.js -- taking the game's files in.
   =========================================================================

   The picker, dropping files on the page, and `?src=` for a page served
   over HTTP. What is opened is sorted by nova-files.js into the data files,
   read at once because the map is made of their records, and the graphics
   and titles files, read one at a time afterwards so the galaxy is up
   before the pictures are. The ships files, a hundred megabytes of
   sprites and pictures, are held back until the ships are first looked at
   (wantShipFiles). The sounds file is not read: nothing shows it.

   Opening base data files starts a new game; opening only plug-ins adds
   them to the one that is open.

   The page's own script: DOM here. LOAD ORDER: after js/nova-*.js, before
   js/page-map.js and js/page-ships.js, whose mapStart, mapFilesChanged and
   shipsFilesChanged it calls. */

/* archive.org's copy: Macintosh Garden's EV_Nova_1.0.10.sit, which
   archive.org keeps in its item Macintosh_Garden_Games_2019_E, byte for byte
   the release (MD5 0fa71952..., compared 30 September 2026). Its /cors/
   address answers a page on another site. The page publishes no game file;
   this is where a visitor with no copy of their own reads one. */
const ARCHIVE_ORG = {
  item: 'https://archive.org/details/Macintosh_Garden_Games_2019_E',
  url: 'https://archive.org/cors/Macintosh_Garden_Games_2019_E/EV_Nova_1.0.10.sit',
};

/* Remembering what was opened between visits, as grimoire does: the files
   that started the game (archive.org's copy or the visitor's own) and any
   plug-ins opened after, kept in IndexedDB and opened again on the next
   visit with no download. ?src= and ?cache=skip pass it by; Forget clears
   it. IndexedDB is refused on some file:// pages, so every call gives up
   quietly and the page carries on without it. */
const KEEP_DB = 'stargrimoire', KEEP_STORE = 'opened', KEEP_KEY = 'current';
function keepTx(mode, fn) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(KEEP_DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(KEEP_STORE);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction(KEEP_STORE, mode), r = fn(tx.objectStore(KEEP_STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => db.close();
    };
  });
}
const keptGet = () => keepTx('readonly', st => st.get(KEEP_KEY));
const keptPut = rec => keepTx('readwrite', st => st.put(rec, KEEP_KEY));
const keptClear = () => keepTx('readwrite', st => st.delete(KEEP_KEY));
let KEPT = [];  // what is remembered now: [{ name, bytes }]
function showForget(on) { document.getElementById('forgetBtn').hidden = !on; }

let GAME = null;
const PENDING = [];
let PUMPING = false;
let OPENED_NAMES = [];
let SHIP_FILES = [];

function setStatus(text, bad) {
  const el = document.getElementById('status');
  el.textContent = text || '';
  el.title = text || '';
  el.classList.toggle('bad', !!bad);
}

/* Let the page paint before the next piece of synchronous work. */
function nextPaint() {
  return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
}

/* Each picked or dropped file as { name, bytes }. */
async function readPicked(files) {
  const out = [];
  for (const f of files) out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  return out;
}

async function openGameFiles(picked, opts = {}) {
  if (!picked.length) return;
  const found = [], refused = [];
  for (const { name, bytes } of picked) {
    setStatus('Looking inside ' + name);
    await nextPaint();
    try {
      if (looksLikeStuffIt(bytes) || looksLikeZip(bytes)) {
        const list = novaArchiveFiles(bytes);
        if (list.length) found.push(...list); else refused.push(name + ' holds no Nova files');
      } else {
        const one = novaLooseFile(name, bytes);
        if (one) found.push(one); else refused.push(name + ' has no resource fork');
      }
    } catch (e) {
      refused.push(name + ': ' + e.message);
    }
  }
  // Plug-ins that come as alternatives or extras -- in several folders, or
  // beside a game of their own outside a Nova Plug-ins folder -- are for
  // the person to choose; the rest are what the archive is.
  const loose = found.filter(f => f.plugin && !/(^|\/)Nova Plug-?ins(\/|$)/i.test(f.folder));
  const folders = new Set(loose.map(f => f.folder));
  if (loose.length && (folders.size > 1 || found.some(f => !f.plugin))) {
    const keep = await choosePlugins(loose);
    if (keep === null) { setStatus(''); return; }
    for (const f of loose) if (!keep.has(f)) found.splice(found.indexOf(f), 1);
  }
  const now = found.filter(f => f.role === 'data' || f.plugin);
  const later = found.filter(f => f.role === 'graphics' || f.role === 'titles');
  const ships = found.filter(f => f.role === 'ships');
  const fresh = found.some(f => f.role === 'data') || !GAME;
  if (!now.length && !later.length && !ships.length) {
    setStatus(refused.join('; ') || 'Nothing in those files is part of EV Nova', true);
    return;
  }
  const game = fresh ? novaGame() : GAME;
  for (const f of now) {
    setStatus('Reading ' + f.name);
    await nextPaint();
    try { game.add(f, f.read()); } catch (e) { refused.push(f.name + ': ' + e.message); }
  }
  if (!game.list('sÿst').length) {
    setStatus('No star systems in ' + (now.map(f => f.name).join(', ') || 'those files') +
              ' -- the Nova Data files hold them' + (refused.length ? '; ' + refused.join('; ') : ''), true);
    return;
  }
  if (fresh) { PENDING.length = 0; OPENED_NAMES = []; SHIP_FILES = []; }
  GAME = game;
  if (!opts.remembered) {
    KEPT = (fresh ? [] : KEPT).concat(picked.map(({ name, bytes }) => ({ name, bytes })));
    keptPut({ files: KEPT, savedAt: Date.now() }).then(() => showForget(true), () => {});
  }
  OPENED_NAMES.push(...picked.map(p => p.name));
  PENDING.push(...later);
  SHIP_FILES.push(...ships);
  mapStart(fresh);
  if (refused.length) setStatus(refused.join('; '), true);
  pumpPending(refused);
}

/* Which of these plug-ins to open: a Set of them, or null for none of it. */
function choosePlugins(list) {
  const el = document.getElementById('choose'), box = el.querySelector('.box');
  box.innerHTML = `<h2>Which plug-ins?</h2>
    <p class="note">These are in separate folders or set beside the game, so they may be alternatives. Tick the ones to open.</p>
    ${list.map((f, i) => `<label><input type="checkbox" data-i="${i}"><span>${esc(f.name)} <small>${esc(f.folder || 'the archive')}</small></span></label>`).join('')}
    <div class="actions"><button data-a="cancel">Cancel</button><button data-a="ok">Open</button></div>`;
  el.hidden = false;
  return new Promise(res => {
    box.onclick = e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      el.hidden = true;
      if (a.dataset.a === 'cancel') res(null);
      else res(new Set([...box.querySelectorAll('input:checked')].map(c => list[+c.dataset.i])));
    };
  });
}

/* The ships files, read now, ahead of any pictures still waiting. */
function wantShipFiles() {
  if (!SHIP_FILES.length) return;
  PENDING.unshift(...SHIP_FILES);
  SHIP_FILES = [];
  pumpPending();
}

async function pumpPending(refused) {
  if (PUMPING) return;
  PUMPING = true;
  let n = 0;
  while (PENDING.length) {
    const f = PENDING.shift();
    n++;
    setStatus(`Reading ${f.role === 'ships' ? 'ships' : 'pictures'}: ${f.name} (${n} of ${n + PENDING.length})`);
    await nextPaint();
    try { GAME.add(f, f.read()); } catch (e) { (refused || []).push(f.name + ': ' + e.message); }
    mapFilesChanged();
    shipsFilesChanged();
  }
  PUMPING = false;
  if (refused && refused.length) setStatus(refused.join('; '), true);
  else setStatus(GAME.files.length + ' files open');
}

function wireOpening() {
  for (const id of ['picker', 'picker2']) {
    const input = document.getElementById(id);
    input.addEventListener('change', async () => {
      const files = [...input.files];
      input.value = '';
      openGameFiles(await readPicked(files));
    });
  }
  const drop = document.getElementById('drop');
  let depth = 0;
  window.addEventListener('dragenter', e => { e.preventDefault(); depth++; drop.classList.add('over'); });
  window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('over'); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', async e => {
    e.preventDefault();
    depth = 0;
    drop.classList.remove('over');
    openGameFiles(await readPicked([...e.dataTransfer.files]));
  });
  // ?src=a.sit&src=b.rez: fetched, for a page served over HTTP. From
  // file:// the browser refuses the fetch, and the status says so.
  // ?src=archive.org is archive.org's copy, as the start page's button is.
  const params = new URLSearchParams(location.search);
  const srcs = params.getAll('src');
  document.getElementById('useRemote').addEventListener('click', () => fetchAndOpen([ARCHIVE_ORG.url]));
  document.getElementById('forgetBtn').addEventListener('click', () => {
    keptClear().then(() => { setStatus('Forgotten. Reloading…'); location.reload(); },
                     () => setStatus('Nothing was remembered to forget.'));
  });
  if (srcs.length) fetchAndOpen(srcs.map(s => s === 'archive.org' ? ARCHIVE_ORG.url : s));
  else if (params.get('cache') !== 'skip') keptGet().then(rec => {
    if (!rec || !rec.files || !rec.files.length || GAME) return;
    KEPT = rec.files;
    showForget(true);
    setStatus('Opening the copy remembered from ' + new Date(rec.savedAt).toLocaleDateString());
    openGameFiles(rec.files, { remembered: true });
  }, () => {});
}

/* Fetches each URL whole, counting as it comes (archive.org's copy is 96 MB),
   and opens them together. */
async function fetchAndOpen(urls) {
  const picked = [];
  for (const s of urls) {
    const name = decodeURIComponent(s.split('/').pop());
    const from = s === ARCHIVE_ORG.url ? ' from archive.org' : '';
    setStatus(`Fetching ${name}${from}`);
    try {
      const r = await fetch(s);
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      const total = +r.headers.get('content-length') || 0;
      const reader = r.body.getReader();
      const parts = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        got += value.length;
        setStatus(`Fetching ${name}${from}: ${fmtBytes(got)}${total ? ' of ' + fmtBytes(total) : ''}`);
      }
      const bytes = new Uint8Array(got);
      let at = 0;
      for (const p of parts) { bytes.set(p, at); at += p.length; }
      picked.push({ name, bytes });
    } catch (e) {
      setStatus(`Could not fetch ${name}${from}: ${e.message}`, true);
      return;
    }
  }
  openGameFiles(picked);
}
