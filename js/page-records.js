/* page-records.js -- a panel for each record of the types the map has no
   place for: outfits, weapons, people, fleets, governments, düdes, events,
   disasters, commodities and new-game starts; and a list of each type.
   The panel opens over the one beneath, as a bit's does, and the address
   keeps it (&rec=outf.128, &rec=outf for the list). What links to what is
   nova-refs.js's; every field, with its note, is the Every field box.

   PAGE SCRIPT. LOAD ORDER: after page-map.js and page-plugin.js. */

let REFS = null;
function recRefs() { return REFS || (REFS = novaRefs(GAME, U)); }

// A link to a record's panel, or its name where the files have no such record.
function recLink(type, id, label) {
  const word = NOVA_REC_WORD.get(type), r = novaGet(GAME, type, id);
  const name = esc(label ?? (r ? novaNameParts(r.name).name : `${type} ${id}`));
  return word && r ? `<a data-rec="${word}.${id}">${name}</a>` : name;
}
const recShipLink = id => (GAME.get('shïp', id) ? `<a data-ship="${id}">${esc(resName('shïp', id))}</a>` : esc(`shïp ${id}`));
const counted = (n, html) => (n > 1 ? `${n} × ` : '') + html;
const listOr = (items, none) => items.length ? items.join(', ') : `<span class="note">${none}</span>`;
// A list, folded behind its count past a dozen.
const many = (items, what, none) => {
  if (!items.length) return `<span class="note">${none || 'none'}</span>`;
  const list = `<div class="list">${items.map(x => `<span>${x}</span>`).join('')}</div>`;
  return items.length <= 12 ? list : `<details class="inline"><summary>${items.length} ${what}</summary>${list}</details>`;
};
// A stellar named by a record, with the first system shown that has it.
const stellarRef = id => (U.stellars.has(id) && U.inSystems.has(id) ? stellarLink(id) : esc(`spöb ${id}`));
const missionRef = id => (missionData().byId.has(id) ? missionLink(id) : esc(`mïsn ${id}`));

// What a record of a type is called in a sentence, from nova-bits' words where it has them.
const REC_KIND = { 'oütf': 'Outfits', 'wëap': 'Weapons', 'përs': 'People', 'flët': 'Fleets', 'gövt': 'Governments',
  'düde': 'Düdes', 'crön': 'Events', 'öops': 'Disasters', 'jünk': 'Commodities', 'chär': 'New-game starts' };

/* A record's panel opened over the map's, from elsewhere (the ships). */
function recOpen(key) {
  VIEW.sel = { kind: 'rec', id: key, back: VIEW.sel };
  writeHash(); renderPanel(); redraw();
  $('panel').scrollTop = 0;
}

/* The galaxy panel's list of the types, each a link to its list. */
function recTypesBlock() {
  const rows = NOVA_REC_TYPES.map(([t, w]) => {
    const n = GAME.list(t).length;
    return n ? `<a data-rec="${w}">${esc(REC_KIND[t])}</a> <span class="note">${n}</span>` : '';
  }).filter(Boolean);
  return rows.length ? `<h3>Records</h3><div class="list">${rows.join('')}</div>` : '';
}

/* One type's records, by name. */
function recListPanel(type) {
  const recs = novaAll(GAME, type).map(r => ({ id: r.id, name: novaNameParts(r.name).name || `${type} ${r.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
  return `<h2>${esc(REC_KIND[type])}</h2>
    <div class="sub">every ${esc(type)} in the files open, ${recs.length}</div>
    <div class="actions"><button data-bit-back>Back</button></div>
    <div class="list">${recs.map(r => `<a data-rec="${NOVA_REC_WORD.get(type)}.${r.id}">${esc(r.name)}</a> <span class="note">${r.id}</span>`).join('')}</div>`;
}

/* A record's panel. `key` is "outf.128" or "outf". */
function recPanel(key) {
  const [word, n] = String(key).split('.');
  const type = NOVA_REC_BY_WORD.get(word);
  if (!type) return `<p class="note">No such record type: ${esc(word)}.</p>`;
  if (n === undefined) return recListPanel(type);
  const id = +n, r = novaGet(GAME, type, id);
  if (!r) return `<h2>${esc(type)} ${id}</h2><div class="actions"><button data-bit-back>Back</button></div><p class="note">Not in the files open.</p>`;
  const refs = recRefs().of(type, id) || {};
  const name = novaNameParts(r.name).name || `${type} ${id}`;
  const body = (REC_BODY[type] || (() => ''))(r, refs, id);
  return `<h2>${esc(name)}</h2>
    <div class="sub">${esc(type)} ${id}${novaNameParts(r.name).note ? ' · ' + esc(novaNameParts(r.name).note) : ''}</div>
    <div class="actions"><button data-bit-back>Back</button> <button data-rec="${word}">All ${esc(REC_KIND[type].toLowerCase())}</button></div>
    ${recRingNote()}
    ${body}
    ${compareBlock(type, id)}
    ${fieldsTable(type, r)}`;
}

/* The places a record's panel names, ringed on the map as a storyline's
   are (storyPlaces): an outfit's outfitters, where a person, fleet or düde
   is met, a government's systems, a commodity's stellars. */
let REC_PLACES = { key: null, set: null };
function recPlaces() {
  const key = VIEW.sel.id;
  if (REC_PLACES.key === key && REC_PLACES.shown === SHOWN && REC_PLACES.game === GAME) return REC_PLACES.set;
  const [word, n] = String(key).split('.'), type = NOVA_REC_BY_WORD.get(word), id = +n;
  const refs = type && n !== undefined ? recRefs().of(type, id) : null, r = refs && novaGet(GAME, type, id);
  const sysIds = [], spobIds = [];
  if (refs) switch (type) {
    case 'oütf': spobIds.push(...refs.soldAt); break;
    case 'wëap': spobIds.push(...refs.stellars); break;
    case 'përs': sysIds.push(...refs.systems.map(s => s.id), ...(refs.linked || [])); break;
    case 'flët': sysIds.push(...(refs.linked || []), ...refs.reinforces); break;
    case 'düde': sysIds.push(...refs.systems.map(s => s.id)); spobIds.push(...refs.defends); break;
    case 'gövt': sysIds.push(...refs.systems); break;
    case 'jünk': spobIds.push(...refs.boughtAt, ...refs.soldAt); break;
    case 'öops': if (r.Stellar >= 128) spobIds.push(r.Stellar); break;
    case 'chär': sysIds.push(...(r.startSystem || []).filter(v => v >= 128)); break;
  }
  const set = new Set();
  for (const v of sysIds) { const p = PLACE_OF.get(v); if (p && (SHOWN.has(v) || SHOW_MODE === 'all')) set.add(p); }
  for (const v of spobIds) { const sys = novaStellarSystem(U, v, SHOWN), p = sys && PLACE_OF.get(sys.id); if (p) set.add(p); }
  REC_PLACES = { key, shown: SHOWN, game: GAME, set };
  return set;
}
// Under a panel that rings places: how many, and on what.
function recRingNote() {
  const n = recPlaces().size;
  return n ? `<p class="note">${n} place${n === 1 ? '' : 's'} ringed in green on the map.</p>` : '';
}

// A dësc's text as the bits set read it, or a note that the files have none.
function recDesc(id, what) {
  const d = descText(id);
  return d ? `<div class="desc">${esc(novaDescText(d.Description, STATE))}</div>` : `<p class="note">No ${what}: the files have no dësc ${id}.</p>`;
}
// A place for a PICT, filled in by recPictures once the panel is drawn.
const recPict = (id, label) => (GAME.has('PICT', id) ? `<figure class="recPict" data-pict="${id}"><div class="nopict wait">Reading PICT ${id}…</div><figcaption>${esc(label)}</figcaption></figure>` : '');
function recPictures() {
  for (const fig of document.querySelectorAll('#panel figure.recPict')) {
    const id = +fig.dataset.pict, img = pictImage(id), box = fig.querySelector('.nopict, canvas');
    if (img && box && box.tagName !== 'CANVAS') box.replaceWith(asCanvas(img, 'pict'));
    else if (!img && PICT_CACHE.get(id) === 'failed' && box) box.textContent = `PICT ${id} does not read.`;
  }
}
document.addEventListener('pictready', () => recPictures());

// A contribute or require bit as the field shows it: the two halves, only that bit set.
const maskText = b => novaFieldText('h32', [b < 32 ? (2 ** (31 - b)) : 0, b >= 32 ? (2 ** (63 - b)) : 0]);
const contribRef = c => (c.type === 'shïp' ? recShipLink(c.id) : recLink(c.type, c.id));
const govtRef = id => (id >= 128 && id <= 383 && GAME.get('gövt', id) ? recLink('gövt', id) : '<span class="note">none</span>');

const REC_BODY = {
  'oütf'(r, refs, id) {
    const does = [];
    for (let k = 1; k <= 4; k++) {
      const mt = r[k === 1 ? 'ModType' : 'ModType' + k], mv = r[k === 1 ? 'ModVal' : 'ModVal' + k];
      if (!(mt > 0)) continue;
      const what = NOVA_MOD_NAMES[mt] || `ModType ${mt}`;
      does.push(mt === 1 || mt === 3 ? `${esc(what)}: ${recLink('wëap', mv)}` : mt === 27 ? `${esc(what)}: ${recLink('oütf', mv)}` : `${esc(what)} <span class="note">${mv}</span>`);
    }
    const soldAt = refs.soldAt.filter(sp => U.inSystems.has(sp));
    const given = refs.given.map(g => `${g.op === 'give' ? 'given' : 'taken'} when ${bitRefLink(g)} is ${esc(g.event)}${g.random ? ' <span class="note">(one side of a random choice)</span>' : ''} <span class="note">${esc(g.field)}</span>`);
    return `${recPict(6000 + id - 128, `Outfitter, PICT ${6000 + id - 128}`)}
      ${recDesc(3000 + id - 128, 'description')}
      <table class="kv">
        ${kvRow('What it does', does.join('<br>') || '<span class="note">nothing</span>')}
        ${kvRow('Cost', r.Cost > 0 ? r.Cost.toLocaleString() + ' credits' : 'nothing')}
        ${kvRow('Mass', r.Mass + ' tons')}
        ${kvRow('Most you can carry', r.Max > 0 ? String(r.Max) : '')}
        ${kvRow('Tech level', String(r.TechLevel))}
        ${kvRow('Offered when', testLine(r.Availability))}
      </table>
      <h3>Sold at <span class="note">${soldAt.length}</span></h3>
      <p class="note">Outfitters whose tech level is the outfit's or more, or names it among their special techs; Offered when, its needs, and the day's draw (BuyRandom) then decide.</p>
      ${many(soldAt.map(stellarRef), 'outfitters')}
      ${refs.needs.length ? `<h3>Needs</h3><p class="note">Every one of these contribute bits, from the ship, an outfit carried, a rank held or an event running.</p><table class="kv">${refs.needs.map(nd => kvRow(maskText(nd.bit), many(nd.from.map(contribRef), 'ships, outfits and events', 'nothing in these files gives it'))).join('')}</table>` : ''}
      ${refs.carriedBy.length ? `<h3>Comes with the ships <span class="note">${refs.carriedBy.length}</span></h3><p class="note">Added to yours when you buy, capture or start in one (their DefaultItems).</p>${many(refs.carriedBy.map(c => counted(c.count, recShipLink(c.id))), 'ships')}` : ''}
      ${given.length ? `<h3>Given and taken</h3><table class="kv">${given.map(g => `<tr><td colspan="2">${g}</td></tr>`).join('')}</table>` : ''}
      ${refs.grantedBy.length ? `<h3>Found plundering</h3><p class="note">People whose GrantClass is this outfit's ItemClass, ${r.ItemClass}.</p><div class="list">${refs.grantedBy.map(p => recLink('përs', p)).join('')}</div>` : ''}
      ${refs.maxBy.length ? `<h3>More of it carried with</h3><div class="list">${refs.maxBy.map(o => recLink('oütf', o)).join('')}</div>` : ''}`;
  },
  'wëap'(r, refs) {
    const ammoW = r.AmmoType >= 0 && r.AmmoType <= 255 ? 128 + r.AmmoType : null;
    const ammo = ammoW === null ? [] : recRefs().of('wëap', ammoW) ? recRefs().of('wëap', ammoW).ammo : [];
    return `<table class="kv">
        ${kvRow('Fired by the outfits', listOr(refs.firedBy.map(o => recLink('oütf', o)), 'none'))}
        ${kvRow('Ammunition', ammoW === null ? '' : `${listOr(ammo.map(o => recLink('oütf', o)), 'no outfit')}${ammoW !== r.id ? ` <span class="note">(the ammunition of ${recLink('wëap', ammoW)})</span>` : ''}`)}
        ${kvRow('Submunitions', r.SubType >= 128 ? `${r.SubCount} × ${recLink('wëap', r.SubType)}` : '')}
        ${kvRow('A submunition of', refs.subOf.map(w => recLink('wëap', w)).join(', '))}
      </table>
      ${refs.builtIn.length ? `<h3>Built into every ship of <span class="note">${refs.builtIn.length}</span></h3>${many(refs.builtIn.map(c => counted(c.count, recShipLink(c.id))), 'ships')}` : ''}
      ${refs.persons.length ? `<h3>Carried by <span class="note">${refs.persons.length}</span></h3>${many(refs.persons.map(c => counted(c.count, recLink('përs', c.id))), 'people')}` : ''}
      ${refs.stellars.length ? `<h3>Fired by the stellars</h3><div class="list">${refs.stellars.map(stellarRef).join('')}</div>` : ''}`;
  },
  'përs'(r, refs) {
    const linked = refs.linked;
    return `<table class="kv">
        ${kvRow('Flies', recShipLink(r.ShipType))}
        ${kvRow('Government', govtRef(r.Govt))}
        ${kvRow('Appears when', testLine(r.ActivateOn))}
        ${kvRow('Offers', r.LinkMission >= 128 ? missionRef(r.LinkMission) : '')}
      </table>
      <h3>Met in</h3>
      <p class="note">Where its LinkSyst allows, among a system's traffic or ships jumping in, and in the systems that name it.</p>
      <table class="kv">
        ${kvRow('By LinkSyst', !refs.drawn ? 'never: the program draws only a person up to përs 1150 with an AIType above 0 and a ship class there is' : linked === null ? 'any system' : many(linked.map(s => sysLink(s)), 'systems', 'no system'))}
        ${kvRow('Named by', refs.systems.length ? many(refs.systems.map(s => `${sysLink(s.id)} <span class="note">${s.prob}%</span>`), 'systems') : '')}
      </table>`;
  },
  'flët'(r, refs) {
    const esc4 = (r.EscortType || []).map((t, i) => t >= 128 ? `${r.Min[i]}${r.Max[i] !== r.Min[i] ? ' to ' + r.Max[i] : ''} × ${recShipLink(t)}` : '').filter(Boolean);
    return `<table class="kv">
        ${kvRow('Led by', recShipLink(r.LeadShipType))}
        ${kvRow('Escorts', esc4.join('<br>'))}
        ${kvRow('Government', govtRef(r.Govt))}
        ${kvRow('Appears when', testLine(r.ActivateOn))}
        ${kvRow('Met in', !refs.drawn ? 'never: the program draws only a fleet below flët 384 whose lead ship class there is' : refs.linked === null ? 'any system' : many(refs.linked.map(s => sysLink(s)), 'systems', 'no system'))}
        ${kvRow('Reinforces', refs.reinforces.length ? many(refs.reinforces.map(s => sysLink(s)), 'systems') : '')}
      </table>`;
  },
  'düde'(r, refs) {
    const kinds = (r.ShipTypes || []).map((t, i) => t >= 128 ? `${recShipLink(t)} <span class="note">${r.Probs[i]}%</span>` : '').filter(Boolean);
    return `<table class="kv">
        ${kvRow('Ships', kinds.join('<br>'))}
        ${kvRow('Government', govtRef(r.Govt))}
        ${kvRow('Traffic in', refs.systems.length ? many(refs.systems.map(s => `${sysLink(s.id)} <span class="note">${s.prob}%</span>`), 'systems') : '')}
        ${kvRow('Defends', refs.defends.length ? many(refs.defends.map(stellarRef), 'stellars') : '')}
        ${kvRow('Missions', refs.missions.length ? many(refs.missions.map(m => `${missionRef(m.id)} <span class="note">${m.field}</span>`), 'missions') : '')}
      </table>`;
  },
  'gövt'(r, refs, id) {
    const c = r.Color & 0xFFFFFF;
    const short = (list, f, what) => list.length ? many(list.map(f), what) : '';
    return `<table class="kv">
        ${kvRow('Colour', `${chip('#' + c.toString(16).padStart(6, '0'))} #${c.toString(16).toUpperCase().padStart(6, '0')}`)}
        ${kvRow('Allied with', many(refs.allies.map(g => recLink('gövt', g)), 'governments'))}
        ${kvRow('Enemies', many(refs.enemies.map(g => recLink('gövt', g)), 'governments'))}
        ${kvRow('Systems', short(refs.systems, s => sysLink(s), 'systems'))}
        ${kvRow('Stellars', short(refs.stellars, stellarRef, 'stellars'))}
        ${kvRow('Düdes', short(refs.dudes, x => recLink('düde', x), 'düdes'))}
        ${kvRow('Fleets', short(refs.fleets, x => recLink('flët', x), 'fleets'))}
        ${kvRow('People', short(refs.persons, x => recLink('përs', x), 'people'))}
      </table>
      <p class="note">Allied and at war as the program reads the classes (GovtAllies, GovtEnemies).</p>`;
  },
  'crön'(r) {
    const news = id => (id > 0 ? novaStrings(GAME, id) : []);
    const govtNews = (r.NewsGovt || []).map((g, i) => g >= 128 && r.GovtNewsStr[i] > 0 ? { g, strs: news(r.GovtNewsStr[i]) } : null).filter(Boolean);
    const quote = strs => strs.map(s => `<div class="desc">${esc(s)}</div>`).join('');
    return `<table class="kv">
        ${kvRow('Happens when', testLine(r.EnableOn))}
        ${kvRow('Sets when it begins', r.OnStart ? `<span class="test">${bitText(r.OnStart)}</span>` : '')}
        ${kvRow('Sets when it ends', r.OnEnd ? `<span class="test">${bitText(r.OnEnd)}</span>` : '')}
      </table>
      ${news(r.IndNewsStr).length ? `<h3>News</h3>${quote(news(r.IndNewsStr))}` : ''}
      ${govtNews.map(n => `<h3>News for ${recLink('gövt', n.g)}</h3>${quote(n.strs)}`).join('')}`;
  },
  'öops'(r) {
    return `<table class="kv">
        ${kvRow('Where', r.Stellar >= 128 ? stellarRef(r.Stellar) : 'a stellar drawn at random')}
        ${kvRow('Happens when', testLine(r.ActivateOn))}
      </table>`;
  },
  'jünk'(r, refs) {
    return `<table class="kv">
        ${kvRow('Base price', String(r.BasePrice))}
      </table>
      <p class="note">Traded at these stellars, on the trade screen's seventh row (BoughtAt) or eighth (SoldAt), bought and sold at the one price; where a stellar names several, the highest-numbered.</p>
      <table class="kv">
        ${kvRow('At base price × 1.25', listOr(refs.boughtAt.map(stellarRef), 'nowhere'))}
        ${kvRow('while', testLine(r.BuyOn))}
        ${kvRow('At base price ÷ 1.25', listOr(refs.soldAt.map(stellarRef), 'nowhere'))}
        ${kvRow('while', testLine(r.SellOn))}
      </table>`;
  },
  'chär'(r) {
    const systems = (r.startSystem || []).filter(s => s >= 128).map(s => (U.byId.has(s) ? sysLink(s) : esc(`sÿst ${s}`)));
    return `<table class="kv">
        ${kvRow('Credits', r.startCash.toLocaleString())}
        ${kvRow('Ship', recShipLink(r.startShipType))}
        ${kvRow('Starting in one of', systems.join(', '))}
        ${kvRow('Sets', r.onStart ? `<span class="test">${bitText(r.onStart)}</span>` : '')}
      </table>`;
  },
};
