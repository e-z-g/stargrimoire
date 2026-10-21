/* page-code.js -- the Code view: the game's program, a routine at a time,
   and the links into it from figures the pages read out of it.
   =========================================================================

   The bar's Code (#code, #code=0x12ce10 for a routine, &at=0x12ce30 for
   one instruction, ringed): a search down the side over what routines
   refer to (an import called, a string, a resource type, a constant), and
   the routine listed, with each call, and each routine a TOC word points
   at, as a link.
   A figure a panel states from the program is printed with codeNum, a
   link to the instruction it was read from (novaFigure in
   nova-program.js), as grimoire's srcNum is. The program is the open
   release's (novaArchiveProgram); a figure is left out while there is
   none.

   PAGE SCRIPT. LOAD ORDER: after page-map.js, page-ships.js and
   page-battle.js, whose views it alternates with. */

const CODE = { on: false, addr: null, at: null, field: null, q: '' };   // field: 'spöb.Flags', the field a note's link came for
let PROGRAM_SRC = null;      // { name, read } from the archive opened, or null
let PROGRAM;                 // undefined until read; null when there is none to read
let FIGURES = null;

/* The program, read the first time it is needed. */
function program() {
  if (PROGRAM === undefined) {
    PROGRAM = null;
    if (PROGRAM_SRC) { try { PROGRAM = novaProgram(PROGRAM_SRC.read(), PROGRAM_SRC.readRsrc ? PROGRAM_SRC.readRsrc() : null); } catch (e) { PROGRAM = null; } }
  }
  return PROGRAM;
}
// Other files opened: their program, if they brought one, is the one read.
function programReset(src) { PROGRAM_SRC = src; PROGRAM = undefined; FIGURES = null; if (CODE.on) renderCode(); }

/* A figure read from the program, by name (novaFigure), or null. */
function fig(name) {
  const p = program();
  if (!p) return null;
  if (!FIGURES) FIGURES = new Map();
  if (!FIGURES.has(name)) FIGURES.set(name, novaFigure(p, name, GAME));
  return FIGURES.get(name);
}
/* A number the site uses, as a link to the instruction it was read from
   where the open program gives it; else the site's value, which
   program_check compares with the program. */
function figText(name, own) { const f = fig(name); return f ? codeNum(f) : esc(String(own)); }
/* Prose (already escaped) with each resource number in it that the open
   program gives -- a figure's base or a resource it loads by number --
   made a link to where the program uses it. */
function codeLinkProse(html) {
  const p = program();
  if (!p) return html;
  return html.replace(/(spïn|snd|PICT|dësc|STR#) (\d{3,5})/g, (m, res, num) => {
    const key = res === 'snd' ? 'snd ' : res, n = Number(num);
    const name = Object.keys(NOVA_FIGURE_RES).find(k => NOVA_FIGURE_RES[k] === key && fig(k) && fig(k).value === n);
    if (name) return `${res} ${codeNum(fig(name))}`;
    const u = novaProgramUses(p, GAME).fixed.get(`${key} ${n}`);
    return u ? `${res} <a class="codeNum" data-code="${hex(u[0].routine)}" data-at="${hex(u[0].addr)}" title="Read from the program at ${hex(u[0].addr)}">${num}</a>` : m;
  });
}
/* Entries of a string list the program loads by number, each a link to
   where it is loaded, from the one routine that loads them all where one
   does: html. */
function codeEntries(id, indexes) {
  const p = program(), uses = (p && novaProgramUses(p, GAME).fixed.get(`STR# ${id}`)) || [];
  const routines = [...new Set(uses.map(u => u.routine))];
  const home = routines.find(r => indexes.every(n => uses.some(u => u.routine === r && u.index === n)));
  return indexes.map(n => {
    const u = uses.find(x => x.index === n && (home === undefined || x.routine === home));
    return u ? `<a class="codeNum" data-code="${hex(u.routine)}" data-at="${hex(u.addr)}" title="${esc(p.nameOf(p.byStart.get(u.routine)))}, at ${hex(u.addr)}">${n}</a>` : String(n);
  });
}
/* A figure as text that links to the instruction holding it. */
function codeNum(f, text) {
  return `<a class="codeNum" data-code="${hex(f.routine)}" data-at="${hex(f.addr)}" title="Read from the program at ${hex(f.addr)}">${esc(text ?? String(f.value))}</a>`;
}

/* A routine by the name Mac 1.1.1 gives it, as a link into its code when
   the open program has it (in 1.0.x, matched by js/nova-routines.js), else
   the name alone. Given the record type and field a note is for, the link
   opens at the first instruction that reads the field (novaFieldSites,
   found when it is followed, since a table of fields has dozens), and the
   view labels every one. */
function codeRoutine(name, type, field) {
  const p = program(), r = p ? novaRoutineNamed(p, name) : null;
  if (!r) return esc(name);
  const f = type ? ` data-field="${esc(type + '.' + field)}"` : '';
  return `<a class="codeNum" data-code="${hex(r.start)}"${f} title="${esc(type ? `Where ${name} reads ${type} ${field}` : `${name} in the program, at ${hex(r.start)}`)}">${esc(name)}</a>`;
}

// The site's code on GitHub, for a line that uses a number the program contains.
const SITE_SOURCE = 'https://github.com/e-z-g/stargrimoire/blob/main/';
const srcLink = (file, line) => `<a href="${SITE_SOURCE}${file}#L${line}" target="_blank" rel="noopener" title="The site's ${esc(file)}, line ${line}">${esc(file.replace(/^js\//, ''))} ${line}</a>`;

/* The rules the site's flying and battles use, by routine: each number a
   link to the instruction holding it, and to the line using it. */
function codeRules(p) {
  const sites = novaRuleSites(p);
  if (!sites.length) return '';
  const by = new Map();
  for (const s of sites) { if (!by.has(s.routine)) by.set(s.routine, []); by.get(s.routine).push(s); }
  const rows = [...by].map(([name, list]) => `<tr><td><a data-code="${hex(list[0].start)}">${esc(name)}</a></td><td>${list.map(s => `${codeNum({ routine: s.start, addr: s.addr, value: s.value })} <small>${srcLink(s.file, s.line)}</small>`).join(', ')}</td></tr>`);
  return `<h3>The rules the site flies by</h3>
    <p class="note">${sites.length} numbers the site's flying and battles use (js/nova-flight.js, js/nova-fight.js), each found in the routine its code cites${p.kind === 'pef' ? ' (in this release, the routine matched to 1.1.1\'s of that name by what both do)' : ''}: a number opens the instruction it is in, and a line opens the site's code that uses it.</p>
    <table class="kv codeRules">${rows.join('')}</table>`;
}

/* ---- in and out of the view -------------------------------------------- */

function codeFromHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.has('code')) { if (CODE.on) codeLeave(true); return false; }
  const n = v => (v && /^(0x[0-9a-f]+|\d+)$/i.test(v) ? Number(v) : null);
  codeShow(n(p.get('code')), n(p.get('at')), { fromHash: true, field: p.get('field') });
  return true;
}
function codeHash() {
  return '#code' + (CODE.addr !== null ? '=' + hex(CODE.addr) : '') + (CODE.at !== null ? '&at=' + hex(CODE.at) : '') + (CODE.field ? '&field=' + encodeURIComponent(CODE.field) : '');
}
function codeShow(addr, at, opts = {}) {
  if (SHIPS.on) shipsLeave(true);
  if (LIB.on) libLeave(true);
  if (BATTLE.on) battleLeave(true);
  const p = program();
  const r = p && addr !== null ? p.routineAt(addr) : null;
  CODE.on = true;
  CODE.addr = r ? r.start : null;
  CODE.at = r && at !== null && at >= r.start && at < r.end ? at : null;
  CODE.field = r && opts.field && /^[^.]+\.[^.]+$/.test(opts.field) ? opts.field : null;
  // a field's link opens at the first line that reads it
  if (CODE.field && CODE.at === null) { const s = novaFieldSites(p, r, ...CODE.field.split('.')); if (s.length) CODE.at = s[0].addr; }
  $('app').hidden = true;
  $('code').hidden = false;
  $('code').classList.toggle('picked', CODE.addr !== null);
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'code'));
  $('crumbs').innerHTML = '';
  renderCodeList();
  renderCode();
  if (!opts.fromHash && location.hash !== codeHash()) history.pushState(null, '', codeHash());
}
function codeLeave(fromHash) {
  CODE.on = false;
  $('code').hidden = true;
  $('app').hidden = false;
  document.querySelectorAll('#views [data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === 'map'));
  resizeCanvas();
  if (!fromHash) writeHash();
  renderCrumbs();
  renderPanel();
  redraw();
}

/* ---- the side: what to look for, and what was found --------------------- */

function renderCodeList() {
  const p = program(), el = $('codeRows');
  if (!p) { el.innerHTML = ''; $('codeCount').textContent = ''; return; }
  let rows;
  if (CODE.q.trim()) {
    const hits = novaSearchProgram(p, CODE.q, 300);
    $('codeCount').textContent = `${hits.length}${hits.length >= 300 ? '+' : ''} routines`;
    rows = hits.map(h => `<a data-code="${hex(h.routine.start)}" data-at="${hex(h.addr)}" class="${h.routine.start === CODE.addr ? 'on' : ''}">${esc(p.nameOf(h.routine))}<small>${esc(h.note)}</small></a>`);
  } else {
    const named = novaNamedRoutines(p, GAME);
    $('codeCount').textContent = `${p.routines.filter(r => !r.glue).length} routines`;
    rows = named.map(n => `<a data-code="${hex(n.routine.start)}" class="${n.routine.start === CODE.addr ? 'on' : ''}">${esc(n.name)}<small>${esc(n.why)}</small></a>`);
  }
  el.innerHTML = rows.join('') || '<p class="note">Nothing found.</p>';
}

/* ---- a routine listed --------------------------------------------------- */

function renderCode() {
  const el = $('codeView'), p = program();
  if (!p) {
    el.innerHTML = `<h2>The program</h2><p class="note">${PROGRAM_SRC ? `${esc(PROGRAM_SRC.name)} is not a program this page reads yet: it reads the PowerPC program of 1.0.2 to 1.1.1.` : 'The files open do not include the game\'s program. Open a release\'s archive or disk image (1.0.2 to 1.1.1) to read it.'}</p>`;
    return;
  }
  if (CODE.addr === null) {
    el.innerHTML = `<h2>The program</h2>
      <div class="sub">${esc(PROGRAM_SRC.name)}${p.kind === 'macho' ? ', its PowerPC half' : ''} · ${p.routines.filter(r => !r.glue).length} routines, ${p.routines.filter(r => r.glue).length} calls into the system</div>
      <p class="note">Search for anything a routine uses: a system call (GetPicture), a resource type (dësc), a string, or a number. A figure the other views read from the program links here, to the instruction it was read from.</p>
      ${codeRules(p)}`;
    return;
  }
  const r = p.routineAt(CODE.addr), ops = p.ops(r);
  const named = novaNamedRoutines(p, GAME).find(n => n.routine === r);
  const callers = [...new Set(p.callers(r.start).map(a => p.routineAt(a)).filter(Boolean))];
  // what each line is labelled with, and the text in it to pick out
  const labels = new Map(), marks = new Map();
  const label = (addr, html, mark) => { if (!labels.has(addr)) labels.set(addr, []); labels.get(addr).push(html); if (mark !== undefined && !marks.has(addr)) marks.set(addr, mark); };
  for (const [addr, what] of novaFiguresByAddr(p, GAME)) if (addr >= r.start && addr < r.end) label(addr, `the site reads ${esc(what)}`, 'imm');
  for (const s of novaRuleSites(p)) if (s.start === r.start) label(s.addr, `the site uses ${s.value}: ${srcLink(s.file, s.line)}`, 'imm');
  for (const [key, uses] of novaProgramUses(p, GAME).fixed) for (const u of uses) if (u.routine === r.start) label(u.addr, `loads ${esc(key.trim())}${u.index !== undefined ? `, entry ${u.index}` : ''}`, 'imm');
  const [ftype, fname] = CODE.field ? CODE.field.split('.') : [];
  const sites = CODE.field ? novaFieldSites(p, r, ftype, fname) : [];
  for (const s of sites) label(s.addr, `${s.call ? 'hands to the call' : s.load ? 'reads' : 'writes'} ${esc(ftype)} ${esc(fname)}`, 'place');
  const opsText = ops.map(novaOpText);
  // the number a figure was read from, or the place a field is read at
  const pick = (i, addr) => {
    const op = ops[i].op, h = esc(opsText[i]), m = marks.get(addr);
    if (m === 'place') return h.replace(/(-?\d+\(r\d+\))$/, '<mark>$1</mark>');
    if (m === 'imm' && op && op.imm !== undefined) return h.replace(new RegExp(`(, |^\\S+ )(${op.imm})$`), '$1<mark>$2</mark>');
    return h;
  };
  const glossHtml = i => esc(novaOpGloss(p, ops, i)).replace(/go to ([0-9a-f]+)$/, (m, t) => `go to <a data-code="${hex(r.start)}" data-at="0x${t}">${t}</a>`);
  const line = (o, i) => {
    let note = o.note === null ? '' : o.target !== null ? `<a data-code="${hex(o.target)}">${esc(o.note)}</a>` : esc(o.note);
    for (const l of labels.get(o.addr) || []) note += `<span class="codeRead">${l}</span>`;
    return `<tr${o.addr === CODE.at ? ' class="at"' : ''} data-addr="${hex(o.addr)}"><td>${o.addr.toString(16)}</td><td>${pick(i, o.addr)}</td><td class="gloss">${glossHtml(i)}</td><td>${note}</td></tr>`;
  };
  // why the view is here: the ringed line put in words, and for a field the other lines that read it
  let why = '';
  const atI = CODE.at !== null ? ops.findIndex(o => o.addr === CODE.at) : -1;
  if (CODE.field && !sites.length) why = `<p>According to the field note, this routine reads ${esc(ftype)} ${esc(fname)}; the line that reads it was not found here.</p>`;
  else if (atI >= 0) {
    const ls = labels.get(CODE.at), g = glossHtml(atI);
    why = `<p><b>Ringed, line ${CODE.at.toString(16)}:</b> ${ls ? ls.join('; ') : 'the line you asked for'}.</p>
      <p><code>${pick(atI, CODE.at)}</code>${g ? ` — ${g}` : ''}</p>`;
    if (sites.length > 1) why += `<p>${sites.length} lines here touch it: ${sites.map(s => `<a data-code="${hex(r.start)}" data-at="${hex(s.addr)}" data-field="${esc(CODE.field)}">${s.addr.toString(16)}</a>`).join(', ')}.</p>`;
  }
  el.innerHTML = `<h2>${esc(named ? named.name : p.nameOf(r))}</h2>
    <div class="sub">${hex(r.start)} to ${hex(r.end)}, ${r.len / 4} instructions${named ? ' · ' + esc(named.why) : ''}</div>
    <div class="actions"><button data-code-list>All routines</button></div>
    ${callers.length ? `<p class="note">Called from ${callers.map(c => `<a data-code="${hex(c.start)}">${esc(p.nameOf(c))}</a>`).join(', ')}.</p>` : ''}
    ${why ? `<div class="codeWhy">${why}</div>` : ''}
    <table class="code">${ops.map(line).join('')}</table>`;
  const at = el.querySelector('tr.at');
  if (at) at.scrollIntoView({ block: 'center' }); else el.scrollTop = 0;
  if (at && el.querySelector('.codeWhy')) el.scrollTop -= el.querySelector('.codeWhy').offsetHeight / 2;
}

/* ---- wiring --------------------------------------------------------------- */

function wireCode() {
  $('views').addEventListener('click', e => {
    const a = e.target.closest('[data-view]');
    if (!a || !GAME) return;
    if (a.dataset.view === 'code') { e.preventDefault(); e.stopImmediatePropagation(); if (!CODE.on) codeShow(null, null); }
    else if (CODE.on) { e.preventDefault(); e.stopImmediatePropagation(); codeLeave(); if (a.dataset.view === 'ships') shipsShow(SHIPS.id); else if (a.dataset.view === 'battle') battleShow(); else if (a.dataset.view === 'library') libShow(LIB.tab, LIB.type); }
  }, true);
  $('code').addEventListener('click', e => {
    const a = e.target.closest('[data-code],[data-code-list]');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.codeList !== undefined) codeShow(null, null);
    // a line in the same routine stays with the field its lines are labelled for
    else codeShow(Number(a.dataset.code), a.dataset.at ? Number(a.dataset.at) : null, { field: a.dataset.field || (Number(a.dataset.code) === CODE.addr ? CODE.field : null) });
  });
  // a figure's link anywhere else opens the view at its instruction
  document.addEventListener('click', e => {
    const a = e.target.closest('a.codeNum');
    if (!a || CODE.on) return;
    e.preventDefault(); e.stopImmediatePropagation();
    codeShow(Number(a.dataset.code), a.dataset.at ? Number(a.dataset.at) : null, { field: a.dataset.field });
  }, true);
  $('codeSearch').addEventListener('input', () => { CODE.q = $('codeSearch').value; renderCodeList(); });
}
wireCode();
