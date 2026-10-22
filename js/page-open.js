/* page-open.js -- taking the game's files in.
   =========================================================================

   The picker, dropping files on the page, and `?src=` for a page served
   over HTTP. What is opened is sorted by nova-files.js into the data files,
   read at once because the map is made of their records, and the graphics
   and titles files, read one at a time afterwards so the galaxy is up
   before the pictures are. The ships files, a hundred megabytes of
   sprites and pictures, are held back until the ships are first looked at
   (wantShipFiles), and with them the sounds file, for the length of the
   warp sound, which is how long a ship's jump out lasts (nova-flight.js).

   Opening base data files starts a new game; opening only plug-ins adds
   them to the one that is open.

   The page's script: DOM here. LOAD ORDER: after js/nova-*.js, before
   js/page-map.js and js/page-ships.js, whose mapStart, mapFilesChanged and
   shipsFilesChanged it calls. */

/* archive.org's copy: Macintosh Garden's EV_Nova_1.0.10.sit, which
   archive.org has in its item Macintosh_Garden_Games_2019_E, byte for byte
   the release (MD5 0fa71952..., compared 30 September 2026). Its /cors/
   address can be fetched by a page on another site. The page publishes no game file;
   this is where a visitor without a copy reads one. */
const ARCHIVE_ORG = {
  item: 'https://archive.org/details/Macintosh_Garden_Games_2019_E',
  url: 'https://archive.org/cors/Macintosh_Garden_Games_2019_E/EV_Nova_1.0.10.sit',
};

/* Remembering what was opened between visits, as grimoire does: the files
   that started the game (archive.org's copy or the visitor's) and any
   plug-ins opened after, kept in IndexedDB and opened again on the next
   visit with no download. ?src= and ?cache=skip skip it; the bar's Forget clears
   it. IndexedDB is not allowed on some file:// pages, so every call gives up
   quietly and the page goes on without it. */
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
let READING = null;   // the file being read now, out of PENDING
let OPENED_NAMES = [];
let SHIP_FILES = [];

function setStatus(text, bad) {
  const el = document.getElementById('status');
  el.textContent = text || '';
  el.title = text || '';
  el.classList.toggle('bad', !!bad);
  el.classList.remove('idle');
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

/* An archive the page opens as a set of files: StuffIt, StuffIt X, zip,
   Compact Pro, RAR or disk image. One of StuffIt X whose streams undo the English
   preprocessing needs its dictionary, 1 MB the page does not load
   otherwise: it comes from the address index.html has for it
   (#sitxEnglish), once, before the archive is read. */
const isArchive = bytes => looksLikeStuffIt(bytes) || looksLikeStuffItX(bytes) || looksLikeZip(bytes) || looksLikeCompactPro(bytes) || looksLikeRar(bytes) || looksLikeUdif(bytes);
// A BinHex or MacBinary copy of an archive (a .sit.hqx, a .sitx.bin): the archive in its data fork.
function unwrapArchive(bytes) {
  if (isArchive(bytes)) return bytes;
  let w = null;
  try { w = sniffMacContainer(bytes); } catch (e) { return bytes; }
  return w && w.data && w.data.length && isArchive(w.data) ? w.data : bytes;
}
async function archiveReady(bytes) {
  if (!looksLikeStuffItX(bytes) || typeof STUFFITX_ENGLISH_WORDS === 'string') return;
  let needs = false;
  try { needs = [...parseStuffItXArchive(bytes).elements.values()].some(el => el.alglist[2] === 0); }
  catch (e) { needs = !!e.needs; }
  if (!needs) return;
  setStatus('Fetching the English dictionary StuffIt X needs');
  await new Promise((yes, no) => {
    const s = document.createElement('script');
    s.src = document.getElementById('sitxEnglish').getAttribute('src');
    s.onload = yes; s.onerror = () => no(new Error('the English dictionary StuffIt X needs did not load'));
    document.head.appendChild(s);
  });
}

async function openGameFiles(picked, opts = {}) {
  if (!picked.length) return;
  // the pieces of a zip split across files, opened together, as one
  picked = novaJoinParts(picked);
  const found = [], refused = [];
  let program = null;
  for (const { name, bytes: given } of picked) {
    setStatus('Looking inside ' + name);
    await nextPaint();
    const bytes = unwrapArchive(given);
    try {
      if (isArchive(bytes)) {
        await archiveReady(bytes);
        const list = novaArchiveFiles(bytes);
        if (!program) { try { program = novaArchiveProgram(bytes); } catch (e) { program = null; } }
        if (list.length) found.push(...list); else refused.push(name + ' has no Nova files');
      } else {
        const one = novaLooseFile(name, bytes);
        // a save file (nova-pilot.js), shown on the map rather than read as a plug-in
        if (one) { try { one.pilot = novaHoldsPilot(novaOpenFork(one.read())); } catch (e) { one.pilot = false; } }
        if (one) found.push(one); else refused.push(name + ' has no resource fork');
      }
    } catch (e) {
      refused.push(name + ': ' + e.message);
    }
  }
  // save files, read now and shown once the game is open
  const saves = [];
  for (const f of found.filter(x => x.pilot)) {
    found.splice(found.indexOf(f), 1);
    try { saves.push(novaReadPilot(novaOpenFork(f.read()), f.name)); } catch (e) { refused.push(e.message); }
  }
  if (saves.length && !found.length) {
    if (!GAME) { setStatus('A save file is shown on the game\'s map: open the game first, then the save file', true); return; }
    if (!opts.remembered) {
      KEPT = KEPT.concat(picked.map(({ name, bytes }) => ({ name, bytes })));
      keptPut({ files: KEPT, savedAt: Date.now() }).then(() => showForget(true), () => {});
    }
    setStatus(refused.join('; '), !!refused.length);
    pilotOpen(saves[saves.length - 1]);
    return true;
  }
  // Plug-ins that come as alternatives or extras -- in several folders, or
  // beside a separate game outside a Nova Plug-ins folder -- are the
  // visitor's choice; the rest make up what the archive is.
  const loose = found.filter(f => f.plugin && !/(^|\/)Nova Plug-?ins(\/|$)/i.test(f.folder));
  const folders = new Set(loose.map(f => f.folder));
  if (loose.length && (folders.size > 1 || found.some(f => !f.plugin))) {
    const keep = await choosePlugins(loose);
    if (keep === null) { setStatus(''); return; }
    for (const f of loose) if (!keep.has(f)) found.splice(found.indexOf(f), 1);
  }
  const now = found.filter(f => f.role === 'data' || f.plugin);
  const later = found.filter(f => f.role === 'graphics' || f.role === 'titles');
  const ships = found.filter(f => f.role === 'ships' || f.role === 'sounds');
  const fresh = found.some(f => f.role === 'data') || !GAME;
  if (!now.length && !later.length && !ships.length) {
    setStatus(refused.join('; ') || 'Nothing in those files is part of EV Nova', true);
    return;
  }
  const read = [];
  for (const f of now) {
    setStatus('Reading ' + f.name);
    await nextPaint();
    try { const bytes = f.read(); read.push({ f, bytes, fork: novaOpenFork(bytes) }); } catch (e) { refused.push(f.name + ': ' + e.message); }
  }
  // plug-ins that have the same records as each other, or as those already open, brought up first
  const opening = read.filter(r => r.f.plugin).map(r => ({ name: r.f.name, plugin: true, fork: r.fork }));
  const open = fresh ? [] : GAME.files.filter(f => f.plugin && !f.edits);
  const names = new Set(opening.map(f => f.name));
  const clashes = opening.length + open.length > 1 ? novaClashes(opening.concat(open)).filter(g => g.files.some(n => names.has(n))) : [];
  if (clashes.length && !(await chooseClashes(clashes))) { setStatus(''); return false; }
  const game = fresh ? novaGame() : GAME;
  for (const { f, bytes } of read) game.add(f, bytes);
  if (!game.list('sÿst').length) {
    setStatus('No star systems in ' + (now.map(f => f.name).join(', ') || 'those files') +
              ' -- they are in the Nova Data files' + (refused.length ? '; ' + refused.join('; ') : ''), true);
    return;
  }
  if (fresh) { PENDING.length = 0; OPENED_NAMES = []; SHIP_FILES = []; }
  GAME = game;
  if (fresh || program) programReset(program);
  if (!opts.remembered) {
    KEPT = (fresh ? [] : KEPT).concat(picked.map(({ name, bytes }) => ({ name, bytes })));
    keptPut({ files: KEPT, savedAt: Date.now() }).then(() => showForget(true), () => {});
  }
  OPENED_NAMES.push(...picked.map(p => p.name));
  PENDING.push(...later);
  SHIP_FILES.push(...ships);
  if (fresh) pilotClose();
  mapStart(fresh);
  if (saves.length) pilotOpen(saves[saves.length - 1]);
  if (refused.length) setStatus(refused.join('; '), true);
  pumpPending(refused);
  return true;
}

/* Plug-ins that have records in common (novaClashes): whether to open them anyway. */
function chooseClashes(groups) {
  const el = document.getElementById('choose'), box = el.querySelector('.box');
  // ids in runs: 128-130, 145
  const runs = ids => {
    const out = [];
    for (let i = 0; i < ids.length; i++) { let j = i; while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++; out.push(j > i ? `${ids[i]}–${ids[j]}` : `${ids[i]}`); i = j; }
    return out.length > 12 ? out.slice(0, 12).join(', ') + ` and ${out.length - 12} more` : out.join(', ');
  };
  const and = list => list.length < 2 ? list[0] : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  box.innerHTML = `<h2>Plug-ins with the same records</h2>
    <p class="note">Where plug-ins have the same record, the page reads the copy in the one whose name comes last, in the order a Mac folder shows them; the others' copies are not used.</p>
    ${groups.map(g => { const n = g.records.reduce((s, r) => s + r.ids.length, 0);
      return `<p>${and(g.files.map(f => `<strong>${esc(f)}</strong>`))}: ${n} record${n === 1 ? '' : 's'}, ${esc(g.files[g.files.length - 1])}'s read<br><small>${g.records.map(r => `${esc(r.type)} ${runs(r.ids)}`).join('; ')}</small></p>`; }).join('')}
    <div class="actions"><button data-a="cancel">Cancel</button><button data-a="ok">Open anyway</button></div>`;
  el.hidden = false;
  return new Promise(res => {
    box.onclick = e => {
      const a = e.target.closest('[data-a]');
      if (!a) return;
      el.hidden = true;
      res(a.dataset.a === 'ok');
    };
  });
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

/* UNPACKING IN THE BACKGROUND. A file from an archive is decompressed when
   it is read, half a second for each ships file of 1.0.10, which on the
   page's thread stops the map that long each time. So the files read
   after the galaxy is up are decompressed in a background thread made of
   the page's mac-bytes, mac-containers, mac-vise, mac-stuffit and
   mac-zip, unchanged, which retains a copy of each archive until nothing is
   left to read. Where a thread cannot load them (a page opened from a
   file:// address) the page reads them on the main thread. */
let UNPACKER = null;   // { worker, ready: Promise<boolean>, sent: Map(archive -> id), waiting: Map(n -> callbacks), n }
function unpacker() {
  if (UNPACKER) return UNPACKER;
  const urls = [...document.scripts].map(s => s.src).filter(src => /\/js\/mac-(bytes|containers|vise|stuffit|zip)\.js/.test(src));
  const src = `try { importScripts(${urls.map(u => JSON.stringify(u)).join(', ')}); postMessage({ ready: true }); } catch (e) { postMessage({ ready: false }); }
const ARCHIVES = new Map();
onmessage = e => {
  const m = e.data;
  if (m.archive) { ARCHIVES.set(m.id, m.archive); return; }
  try {
    const a = ARCHIVES.get(m.id), raw = m.zip ? zipFork(a, m.entry, m.which) : stuffItFork(a, m.entry, m.which);
    const w = m.wrapped ? sniffMacContainer(raw) : null;
    if (m.wrapped && !(w && w.rsrc && w.rsrc.length)) throw new Error('not a MacBinary or BinHex copy with a resource fork');
    const f = m.wrapped ? w.rsrc : raw;
    const out = f.byteOffset || f.buffer.byteLength !== f.length ? f.slice() : f;
    postMessage({ n: m.n, fork: out }, [out.buffer]);
  } catch (err) { postMessage({ n: m.n, error: String(err && err.message || err) }); }
};`;
  const u = { worker: null, sent: new Map(), waiting: new Map(), n: 0 };
  u.ready = new Promise(res => {
    try { u.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); } catch (e) { res(false); return; }
    u.worker.onerror = () => res(false);
    u.worker.onmessage = e => {
      const m = e.data;
      if (m.ready !== undefined) { res(m.ready); return; }
      const w = u.waiting.get(m.n);
      u.waiting.delete(m.n);
      if (w) { if (m.error) w.no(new Error(m.error)); else w.yes(m.fork); }
    };
    setTimeout(() => res(false), 5000);
  });
  return (UNPACKER = u);
}
// A file's fork, decompressed in the background where that works, else here.
async function readFile(f) {
  if (!f.unpack) return f.read();
  const u = unpacker();
  if (!(await u.ready)) return f.read();
  const { archive, entry, which, zip, wrapped } = f.unpack;
  if (!u.sent.has(archive)) { u.sent.set(archive, u.sent.size + 1); u.worker.postMessage({ id: u.sent.get(archive), archive }); }
  const n = ++u.n;
  try { return await new Promise((yes, no) => { u.waiting.set(n, { yes, no }); u.worker.postMessage({ n, id: u.sent.get(archive), entry, which, zip, wrapped }); }); }
  catch (e) { return f.read(); }
}
// Nothing left to read: the thread and its copies of the archives are discarded.
function unpackerDone() {
  if (UNPACKER && UNPACKER.worker && !UNPACKER.waiting.size) UNPACKER.worker.terminate();
  UNPACKER = null;
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
    READING = f;
    n++;
    setStatus(`Reading ${f.role === 'ships' ? 'ships' : f.role === 'sounds' ? 'sounds' : 'pictures'}: ${f.name} (${n} of ${n + PENDING.length})`);
    await nextPaint();
    try { GAME.add(f, await readFile(f)); } catch (e) { (refused || []).push(f.name + ': ' + e.message); }
    READING = null;
    mapFilesChanged();
    shipsFilesChanged();
    battleFilesChanged();
    // the ships fly on the map, so their files follow the pictures, unless that would stop the page
    if (!PENDING.length && SHIP_FILES.length && UNPACKER && await UNPACKER.ready) wantShipFiles();
  }
  if (!SHIP_FILES.length) unpackerDone();
  PUMPING = false;
  if (refused && refused.length) setStatus(refused.join('; '), true);
  else { setStatus(GAME.files.length + ' files open'); document.getElementById('status').classList.add('idle'); }
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
  // file:// the browser blocks the fetch, and the status shows it.
  // ?src=archive.org is archive.org's copy, as the start page's button is.
  const params = new URLSearchParams(location.search);
  const srcs = params.getAll('src');
  document.getElementById('useRemote').addEventListener('click', () => fetchAndOpen([ARCHIVE_ORG.url]));
  // Credits: the panel under the bar, shut by the button again, Escape or a click elsewhere
  const credits = document.getElementById('creditsMenu'), creditsBtn = document.getElementById('creditsBtn');
  const creditsShow = on => {
    credits.hidden = !on; creditsBtn.setAttribute('aria-expanded', String(on));
    if (on) credits.style.top = Math.round(document.getElementById('bar').getBoundingClientRect().bottom + 4) + 'px';
  };
  creditsBtn.addEventListener('click', e => { e.stopPropagation(); creditsShow(credits.hidden); });
  document.addEventListener('click', e => { if (!credits.hidden && !credits.contains(e.target)) creditsShow(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !credits.hidden) creditsShow(false); });
  // On a phone the file buttons and Credits sit under More, which any choice or a tap elsewhere shuts.
  const bar = document.getElementById('bar'), more = document.getElementById('moreBtn'), menu = document.getElementById('fileMenu');
  const moreShow = on => {
    bar.classList.toggle('more', on); more.setAttribute('aria-expanded', String(on));
    if (on) menu.style.top = Math.round(bar.getBoundingClientRect().bottom + 4) + 'px';
  };
  more.addEventListener('click', e => { e.stopPropagation(); moreShow(!bar.classList.contains('more')); });
  menu.addEventListener('click', () => moreShow(false));
  document.addEventListener('click', e => { if (bar.classList.contains('more') && !menu.contains(e.target)) moreShow(false); });
  document.getElementById('creditsItem').addEventListener('click', e => { e.stopPropagation(); moreShow(false); creditsShow(credits.hidden); });
  document.getElementById('forgetBtn').addEventListener('click', () => {
    keptClear().then(() => { setStatus('Forgotten. Reloading…'); location.reload(); },
                     () => setStatus('Nothing was saved, so there is nothing to clear.'));
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

/* One URL's bytes, fetched whole, counting in the status as they come
   (archive.org's copy is 96 MB); `from` is shown after the name. */
async function fetchBytes(url, from = '') {
  const name = decodeURIComponent(url.split('/').pop());
  setStatus(`Fetching ${name}${from}`);
  const r = await fetch(url);
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
  return { name, bytes };
}

/* Fetches each URL whole and opens them together. */
async function fetchAndOpen(urls) {
  const picked = [];
  for (const s of urls) {
    const from = s === ARCHIVE_ORG.url ? ' from archive.org' : '';
    try { picked.push(await fetchBytes(s, from)); }
    catch (e) {
      setStatus(`Could not fetch ${decodeURIComponent(s.split('/').pop())}${from}: ${e.message}`, true);
      return;
    }
  }
  openGameFiles(picked);
}

// On a phone the map, or the battle, sits above its panel, and dragging the grip between them
// moves the line, which is kept for the next visit.
function wireGrip(grip, box, key) {
  const MIN = 0.15, MAX = 0.85;
  let id = null, f = null;
  const set = v => box.style.setProperty('--split', (v * 100).toFixed(1) + '%');
  try { const v = parseFloat(localStorage.getItem(key)); if (v >= MIN && v <= MAX) set(v); } catch (e) { /* no storage */ }
  grip.addEventListener('pointerdown', e => { id = e.pointerId; e.preventDefault(); try { grip.setPointerCapture(id); } catch (e2) { /* not a live pointer */ } });
  grip.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const r = box.getBoundingClientRect();
    f = Math.min(MAX, Math.max(MIN, (e.clientY - r.top) / r.height));
    set(f);
  });
  const up = e => {
    if (e.pointerId !== id) return;
    id = null;
    if (f != null) try { localStorage.setItem(key, String(f)); } catch (e2) { /* no storage */ }
  };
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
}
