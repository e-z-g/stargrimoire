/* page-plugin.js -- records changed here, and the plug-in they make.
   =========================================================================

   Every record's panel has its fields in a table (fieldsTable); Change
   turns the table into boxes, and Apply writes what is typed into the
   record (novaRecordBytes). The records changed are a plug-in in memory,
   read after every file open (novaGame's setEdits), so the map, the ships
   and the battle show them as the game would. They are kept in the
   browser's storage, for the next visit, until undone.

   The bar's Plug-in lists them and saves them as a plug-in: a `.rez` for
   the Windows builds and the Community Edition, or a MacBinary `.bin`
   for the Mac (nova-plugin.js says why a .bin). A field the program has
   been read for has its note under it (nova-fields.js), the routines it was
   read from on hovering. While comparing, it also
   saves what differs from the files compared with.

   The page's own script: DOM here. LOAD ORDER: after js/page-compare.js
   and js/nova-plugin.js; page-map.js and page-ships.js call fieldsTable,
   mapStart calls pluginOnto. */

const EDITS = new Map();      // 'type id' -> { type, id, name, data }
let EDITING = null;           // the key of the record whose fields are boxes
let EDIT_OPEN = null;         // the key of the table to show open when drawn again
let PLUGIN_NAME = 'My plug-in';
const EDITS_STORE = 'stargrimoire-edits';
const editKey = (type, id) => type + ' ' + id;

function editsSave() {
  try {
    localStorage.setItem(EDITS_STORE, JSON.stringify({
      name: PLUGIN_NAME,
      records: [...EDITS.values()].map(r => ({ type: r.type, id: r.id, name: r.name, data: [...r.data] })),
    }));
  } catch (e) {}
}
function editsLoad() {
  try {
    const j = JSON.parse(localStorage.getItem(EDITS_STORE) || 'null');
    if (!j) return;
    PLUGIN_NAME = j.name || PLUGIN_NAME;
    for (const r of j.records) EDITS.set(editKey(r.type, r.id), { type: r.type, id: r.id, name: r.name, data: Uint8Array.from(r.data) });
  } catch (e) {}
}

/* The changes put into a game, before the map reads it. */
function pluginOnto(game) {
  game.setEdits([...EDITS.values()]);
  const b = document.getElementById('pluginBtn');
  b.hidden = false;
  b.textContent = EDITS.size ? `Plug-in (${EDITS.size})…` : 'Plug-in…';
}

/* After a change: everything read again from the game, as when a plug-in
   is opened, and the record just changed left open. */
function pluginChanged() {
  editsSave();
  mapStart(false);
  if (SHIPS.on) renderShip();
}

/* ---- a record's fields, shown or in boxes ---------------------------------- */

function fieldsTable(type, rec) {
  const key = editKey(type, rec.id), editing = EDITING === key;
  const rows = [];
  if (editing) rows.push(`<tr><td>name</td><td><input data-f="" value="${esc(rec.name || '')}" maxlength="255"></td></tr>`);
  for (const [name, kind, n] of NOVA_RECORDS[type]) {
    if (kind === 'pad' || !(name in rec)) continue;
    const text = novaFieldText(kind, rec[name]);
    const fn = novaFieldNote(type, name);
    const rd = editing ? null : novaFieldRead(GAME, type, name, rec);
    const note = (fn ? `<div class="fieldNote" title="${esc(fn.code.map(([f, a]) => f + ' 0x' + a.toString(16)).join(', '))}">${esc(fn.note)}</div>` : '') +
                 (fn && fn.bible ? `<div class="fieldNote">The Bible: ${esc(fn.bible)}</div>` : '') +
                 (rd ? `<div class="fieldNote fieldRead">This one: ${esc(rd)}</div>` : '');
    if (!editing) { rows.push(`<tr><td>${esc(name)}</td><td>${esc(text)}${note}</td></tr>`); continue; }
    const max = kind === 'str' ? ` maxlength="${n - 1}"` : '';
    rows.push(`<tr><td>${esc(name)}</td><td><input data-f="${esc(name)}" value="${esc(text)}"${max} spellcheck="false">${note}</td></tr>`);
  }
  const changed = EDITS.has(key);
  const buttons = editing
    ? `<button data-edit-apply>Apply</button> <button data-edit-cancel>Cancel</button> <span class="warn" data-edit-why></span>`
    : `<button data-edit>Change</button>${changed ? ' <button data-edit-undo>Undo the changes</button>' : ''}`;
  const open = editing || EDIT_OPEN === key ? ' open' : '';
  return `<details class="fieldsBox" data-type="${esc(type)}" data-id="${rec.id}"${open}><summary>Every field of ${esc(type)} ${rec.id}, from ${esc(rec.file)}</summary>` +
         `<div class="editBar">${buttons}</div><table class="fields${editing ? ' editing' : ''}">${rows.join('')}</table></details>`;
}

// Drawn again in place, for Change and Cancel, which change nothing else.
function fieldsRedraw(box) {
  const type = box.dataset.type, id = +box.dataset.id;
  box.outerHTML = fieldsTable(type, novaGet(GAME, type, id));
}

/* What is typed, as the record's fields: { rec, name } or { why }. */
function fieldsRead(box, type) {
  const table = NOVA_RECORDS[type], rec = {};
  let name = '';
  for (const input of box.querySelectorAll('input[data-f]')) {
    const f = input.dataset.f;
    if (f === '') { name = input.value; continue; }
    const [, kind, n] = table.find(t => t[0] === f);
    try {
      if (n && kind !== 'str' && kind !== 'pad') {
        const parts = input.value.split(',');
        if (parts.length !== n) throw new Error(`wants ${n} values, with commas between`);
        rec[f] = parts.map(p => novaFieldParse(kind, p));
      } else rec[f] = novaFieldParse(kind, input.value);
      if (kind === 'str' && encodeMacRoman(rec[f]).length > n - 1) throw new Error(`takes at most ${n - 1} characters`);
    } catch (e) {
      input.focus();
      return { why: `${f} ${e.message}` };
    }
  }
  return { rec, name };
}

function fieldsApply(box) {
  const type = box.dataset.type, id = +box.dataset.id, key = editKey(type, id);
  const got = fieldsRead(box, type);
  if (got.why) { box.querySelector('[data-edit-why]').textContent = got.why; return; }
  const now = GAME.get(type, id), under = GAME.get(type, id, { under: true });
  let data;
  try { data = novaRecordBytes(type, got.rec, now.bytes); }
  catch (e) { box.querySelector('[data-edit-why]').textContent = e.message; return; }
  // back as the files have it: no longer a change
  if (under && under.name === got.name && under.bytes.length === data.length && under.bytes.every((x, i) => x === data[i])) EDITS.delete(key);
  else EDITS.set(key, { type, id, name: got.name, data });
  EDITING = null;
  EDIT_OPEN = key;
  pluginChanged();
}

function wireFields() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-edit],[data-edit-apply],[data-edit-cancel],[data-edit-undo]');
    const box = b && b.closest('.fieldsBox');
    if (!box) return;
    e.preventDefault();
    const key = editKey(box.dataset.type, +box.dataset.id);
    if (b.dataset.edit !== undefined) {
      if (EDITING) { const other = document.querySelector('.fieldsBox table.editing'); EDITING = null; if (other) fieldsRedraw(other.closest('.fieldsBox')); }
      EDITING = key;
      fieldsRedraw(box);
      const first = document.querySelector('.fieldsBox table.editing input');
      if (first) first.focus();
    } else if (b.dataset.editCancel !== undefined) { EDITING = null; fieldsRedraw(box); }
    else if (b.dataset.editApply !== undefined) fieldsApply(box);
    else if (b.dataset.editUndo !== undefined) { EDITS.delete(key); EDIT_OPEN = key; pluginChanged(); }
  });
  // Enter in a box applies; Escape puts the table back
  document.addEventListener('keydown', e => {
    const box = e.target.closest && e.target.closest('.fieldsBox');
    if (!box || e.target.tagName !== 'INPUT') return;
    if (e.key === 'Enter') { e.preventDefault(); fieldsApply(box); }
    else if (e.key === 'Escape') { EDITING = null; fieldsRedraw(box); }
    e.stopPropagation();
  }, true);
}

/* ---- the bar's Plug-in -------------------------------------------------- */

const pluginFileName = s => (s.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim() || 'My plug-in');

function pluginSave(resources, how) {
  const name = pluginFileName(PLUGIN_NAME);
  if (how === 'rez') downloadBlob(novaWriteRez(novaPluginOrder(resources)), name + '.rez');
  else downloadBlob(novaWriteMacPlugin(resources, name.slice(0, 31)), name + '.bin');
}

function pluginAsk() {
  const el = document.getElementById('choose'), box = el.querySelector('.box');
  const list = novaPluginOrder([...EDITS.values()]);
  const rows = list.map(r => {
    const shown = esc(novaNameParts(r.name).name || `${r.type} ${r.id}`);
    const name = COMPARE_LINK[r.type] ? `<a ${COMPARE_LINK[r.type](r.id)}>${shown}</a>` : shown;
    return `<tr><td>${esc(r.type)} ${r.id}</td><td>${name}</td><td><button data-undo="${esc(editKey(r.type, r.id))}">Undo</button></td></tr>`;
  }).join('');
  const diff = COMPARE && COMPARE.game ? novaPluginFromGames(COMPARE.game, GAME) : null;
  box.innerHTML = `<h2>Plug-in</h2>
    <p class="note">The records changed here, which the page reads after every file open. Change a record from its panel: open Every field, then Change.</p>
    ${rows ? `<table class="kv plugin">${rows}</table>` : '<p class="note">Nothing is changed yet.</p>'}
    <label>Name <input id="pluginName" value="${esc(PLUGIN_NAME)}" maxlength="31"></label>
    <p class="note">Saved as a <b>.rez</b>, it is a plug-in for the Windows builds and the Community Edition. Saved for the Mac, it is a MacBinary <b>.bin</b>: StuffIt Expander or The Unarchiver turns it into the plug-in itself, a file with a resource fork.</p>
    <div class="actions">
      <button data-a="rez"${list.length ? '' : ' disabled'}>Save as .rez</button>
      <button data-a="bin"${list.length ? '' : ' disabled'}>Save for the Mac</button>
    </div>
    ${diff ? `<p class="note">Or every record that differs from ${esc(COMPARE.label)}, these changes among them: ${diff.length.toLocaleString()} records, a plug-in that makes ${esc(COMPARE.label)} into what is open now (a record taken away it cannot say).</p>
    <div class="actions"><button data-a="diff-rez"${diff.length ? '' : ' disabled'}>Save as .rez</button><button data-a="diff-bin"${diff.length ? '' : ' disabled'}>Save for the Mac</button></div>` : ''}
    <div class="actions">${list.length ? '<button data-a="clear">Undo every change</button>' : ''}<button data-a="close">Close</button></div>`;
  el.hidden = false;
  box.querySelector('#pluginName').oninput = e => { PLUGIN_NAME = e.target.value; editsSave(); };
  box.onclick = e => {
    const link = e.target.closest('[data-sys],[data-stellar],[data-ship],[data-mission]');
    if (link) {
      e.preventDefault();
      el.hidden = true;
      const d = link.dataset;
      if (d.ship !== undefined) shipsShow(+d.ship);
      else if (d.sys) goSystem(+d.sys);
      else if (d.stellar) goStellar(+d.stellar);
      else { VIEW.sel = { kind: 'mission', id: +d.mission, back: VIEW.sel }; renderPanel(); redraw(); }
      return;
    }
    const b = e.target.closest('[data-a],[data-undo]');
    if (!b) return;
    if (b.dataset.undo) { EDITS.delete(b.dataset.undo); pluginChanged(); pluginAsk(); return; }
    const a = b.dataset.a;
    if (a === 'close') el.hidden = true;
    else if (a === 'clear') { EDITS.clear(); pluginChanged(); el.hidden = true; }
    else if (a === 'rez' || a === 'bin') pluginSave(list, a);
    else if (a === 'diff-rez' || a === 'diff-bin') pluginSave(diff, a.slice(5));
  };
}

function wirePlugin() {
  editsLoad();
  wireFields();
  document.getElementById('pluginBtn').addEventListener('click', pluginAsk);
}
