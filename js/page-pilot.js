/* page-pilot.js -- a save file on the map (nova-pilot.js reads it).
   =========================================================================

   A save file opened with the game is shown as "As in the save file", a
   choice of the bar's menu beside "As at a new game": the map's visibility
   tests are run with its bits and gender, and the system you are in is
   ringed. The galaxy's panel has the pilot, the ship and what is in it, the
   missions under way and the rest of the save; a system's has whether you
   have explored it and your legal standing there; a stellar's, whether you
   have dominated or destroyed it, and its defence ships left. The file is
   remembered with the others (KEPT), so it opens again on the next visit. */

let PILOT = null;   // { save, U, state }: the save as read, and what the map needs of it for U

function pilotOpen(save) {
  PILOT = { save, U: null, state: null };
  // the menu's choice, added with the first save opened
  if (!$('showSave')) $('showSel').insertAdjacentHTML('beforeend', '<option value="save" id="showSave">As in the save file</option>');
  $('showSel').value = 'save';
  applyShowMode();
  renderPanel();
}
// Another game opened: its save, if any, is another's.
function pilotClose() {
  PILOT = null;
  const o = $('showSave');
  if (o) { if ($('showSel').value === 'save') $('showSel').value = 'new'; o.remove(); }
}
// What the map needs of the save, worked out again when the universe changes.
function pilotState() {
  if (!PILOT) return null;
  if (PILOT.U !== U) { PILOT.state = novaPilotState(PILOT.save, U); PILOT.U = U; }
  return PILOT.state;
}
const pilotShown = () => SHOW_MODE === 'save' && !!PILOT;

// The system you are in, ringed in white outside any other ring.
function pilotRing(ctx, sysId, path) {
  const s = pilotShown() && pilotState();
  if (!s || s.system !== sysId) return;
  path(8);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1;
}

// DateToShortString 0x8b79: the prefix, month/day/year, the suffix.
function pilotDate(p) {
  const P = p.pilot, G = p.game;
  return `${G.datePrefix}${P.month}/${P.day}/${P.year}${G.dateSuffix}`;
}

// The galaxy panel's part.
function pilotBlock() {
  if (!pilotShown()) return '';
  const p = PILOT.save, P = p.pilot, G = p.game, s = pilotState();
  const cargo = P.cargo.map((n, i) => (n > 0 ? `${n} tons of ${esc(commodityName(i))}` : null)).filter(Boolean)
    .concat(G.junk.map((n, i) => (n > 0 ? `${n} tons of ${recLink('jünk', 128 + i)}` : null)).filter(Boolean));
  const escorts = s.escorts.map(e => `${recShipLink(e.cls)} <span class="note">${e.hired ? 'hired' : 'captured'}${e.upgrade ? ', marked for upgrade' : ''}${e.sale ? ', marked for sale' : ''}</span>`)
    .concat(s.fighters.map(c => `${recShipLink(c)} <span class="note">fighter</span>`));
  const missions = s.missions.map(m => {
    const o = m.objectives, done = [o.travelObjComplete && 'been to its destination', o.shipObjComplete && 'done with its ships', o.missionFailed && 'failed'].filter(Boolean);
    return `${missionData().byId.has(m.id) ? missionLink(m.id) : esc(m.name)}${done.length ? ` <span class="note">${done.join(', ')}</span>` : ''}`;
  });
  const explored = [...s.explored.values()], landed = explored.filter(v => v >= 2).length;
  const people = list => list.map((v, i) => (v && novaGet(GAME, 'përs', 128 + i) ? recLink('përs', 128 + i) : null)).filter(Boolean);
  const here = s.system !== null ? s.legal.get(s.system) || 0 : null;
  return `<h3>Save file</h3>
    <table class="kv">
      ${kvRow('Pilot', `${esc(p.name)}${G.nickname ? ` <span class="note">“${esc(G.nickname)}”</span>` : ''}${G.gender === 1 ? '' : ' <span class="note">female</span>'}${G.strict === 1 ? ' <span class="note">strict play</span>' : ''}`)}
      ${kvRow('Ship', `${esc(p.shipName)}, ${recShipLink(P.shipClass + 128)}`)}
      ${kvRow('At', s.stellar !== null ? `${stellarRef(s.stellar)}${s.system !== null ? ' in ' + sysLink(s.system) : ''}` : '')}
      ${kvRow('Date', esc(pilotDate(p)))}
      ${kvRow('Credits', P.cash.toLocaleString())}
      ${kvRow('Fuel', `${(P.fuel / 100).toLocaleString()} jumps`)}
      ${kvRow('Combat rating', P.kills.toLocaleString())}
      ${kvRow('Legal standing here', here !== null ? String(here) : '')}
      ${kvRow('Explored', `${explored.length} system${explored.length === 1 ? '' : 's'}, landed in ${landed}`)}
      ${kvRow('Cargo', listOr(cargo, 'none'))}
      ${kvRow('Outfits', many([...s.outfits].map(([id, n]) => counted(n, recLink('oütf', id))), 'outfits'))}
      ${kvRow('Escorts', listOr(escorts, 'none'))}
      ${kvRow('Missions under way', listOr(missions, 'none'))}
      ${kvRow('Ranks', listOr(s.ranks.map(id => recLink('ränk', id)), 'none'))}
      ${kvRow('Dominated', listOr([...s.dominated].map(stellarRef), 'none'))}
      ${kvRow('Destroyed', listOr([...s.destroyed.keys()].map(stellarRef), 'none'))}
      ${kvRow('People no longer met', many(people(G.alive.map(v => !v)), 'people'))}
      ${kvRow('With a grudge against you', listOr(people(G.grudge), 'none'))}
      ${kvRow('Bits on', many([...s.bits].sort((a, b) => a - b).map(n => `<a data-bit="${n}">b${n}</a>`), 'bits'))}
    </table>
    <p class="note">From its NpïL 128 and 129, as ${codeRoutine('LoadPilotData')} reads them.</p>`;
}

// A system's rows.
function pilotSystemRows(sys) {
  if (!pilotShown()) return '';
  const s = pilotState(), e = s.explored.get(sys.id) || 0;
  return kvRow('In the save', `${e >= 2 ? 'explored and landed in' : e >= 1 ? 'explored' : 'not explored'}${s.system === sys.id ? '; you are here' : ''}`) +
    kvRow('Legal standing', String(s.legal.get(sys.id) || 0));
}
// A stellar's rows.
function pilotStellarRows(sp) {
  if (!pilotShown()) return '';
  const s = pilotState(), G = PILOT.save.game, days = s.destroyed.get(sp.id);
  return kvRow('In the save', [s.dominated.has(sp.id) && 'dominated', days && `destroyed, rebuilt in ${days} day${days === 1 ? '' : 's'}`, s.stellar === sp.id && 'where you are'].filter(Boolean).join('; ')) +
    (novaDefense(sp) ? kvRow('Defence ships left', String(G.defense[sp.id - 128])) : '');
}
