/* nova-refs.js -- which records name a record.
   =========================================================================

   An outfit's outfitters, the ships that carry it and the expressions that
   give or take it; a weapon's outfits, ships, people and stellars; where a
   person, a fleet or a düde is met; a government's places, ships and
   friends; a commodity's stellars. What each field means is its note in
   nova-fields.js, read from Mac 1.1.1's code; this follows the ids, by the
   rules those notes give:

     an outfitter (spöb Flags 0x04) lists an outfit of TechLevel 0 to 32766
       at most its own or equal to one of its eight SpecialTech
       (SetupPortAvailableItems 0xbedb);
     Gxxx in a set expression gives one of oütf xxx and Dxxx takes one,
       128 to 639, and Kxxx gives ränk xxx and Lxxx takes it (EvalSetExp
       0x150fc);
     a requirement is met when every bit of it is among the contribute bits
       of the ship, the outfits carried, the ranks held and the events
       running (PlayerMeetsRequirements 0x776f, GetPlayerContributeBits);
     a përs or flët is met where its LinkSyst allows (novaLinkSystOk), or
       a system's Person list names it.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js,
   nova-bits.js, nova-ships.js and nova-flight.js. */

// The record types with a page of their own, and the plain name each goes by in an address.
const NOVA_REC_TYPES = [
  ['oütf', 'outf'], ['wëap', 'weap'], ['përs', 'pers'], ['flët', 'flet'], ['gövt', 'govt'],
  ['düde', 'dude'], ['crön', 'cron'], ['öops', 'oops'], ['jünk', 'junk'], ['chär', 'char'], ['ränk', 'rank'],
];
const NOVA_REC_BY_WORD = new Map(NOVA_REC_TYPES.map(([t, w]) => [w, t]));
const NOVA_REC_WORD = new Map(NOVA_REC_TYPES);

// The outfits a set expression gives (G) and takes (D): [{ op: 'give'|'take', id }].
function novaSetOutfits(text) {
  const out = [];
  for (const st of ncbParseSet(text)) for (const o of st.ops) {
    const m = o.op === 'other' && /^([GgDd])(\d+)$/.exec(o.text);
    if (m && +m[2] >= 128 && +m[2] <= 639) out.push({ op: /g/i.test(m[1]) ? 'give' : 'take', id: +m[2], random: st.random });
  }
  return out;
}

// The ranks a set expression gives (K) and takes (L): [{ op: 'give'|'take', id }] (EvalSetExp, ActivateRank, DeactivateRank).
function novaSetRanks(text) {
  const out = [];
  for (const st of ncbParseSet(text)) for (const o of st.ops) {
    const m = o.op === 'other' && /^([KkLl])(\d+)$/.exec(o.text);
    if (m && +m[2] >= 128) out.push({ op: /k/i.test(m[1]) ? 'give' : 'take', id: +m[2], random: st.random });
  }
  return out;
}

// The two 32-bit halves of a contribute or require field as one list of bit numbers, 0 to 63.
function novaMaskBits(pair) {
  const out = [];
  (pair || []).forEach((w, half) => { for (let b = 0; b < 32; b++) if ((w >>> (31 - b)) & 1) out.push(half * 32 + b); });
  return out;
}

/* Every cross-reference, worked out once for a game and its universe:
   novaRefs(game, u).of(type, id) gives the record's lists. */
function novaRefs(game, u) {
  const all = t => novaAll(game, t);
  const ships = all('shïp'), outfits = all('oütf'), weapons = all('wëap'), persons = all('përs'), fleets = all('flët');
  const dudes = all('düde'), systems = all('sÿst'), crons = all('crön'), junks = all('jünk'), missions = all('mïsn');
  const stellars = [...u.stellars.values()];
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };

  // outfits given and taken by every set expression
  const given = new Map(), rankGiven = new Map();
  const ranks = all('ränk');
  for (const [type, kind, fields] of NOVA_BIT_SOURCES) for (const rec of all(type)) for (const [field, how, event] of fields) {
    if (how !== 'set' || !rec[field]) continue;
    for (const g of novaSetOutfits(rec[field])) push(given, g.id, { type, kind, id: rec.id, field, event, op: g.op, random: g.random });
    for (const g of novaSetRanks(rec[field])) push(rankGiven, g.id, { type, kind, id: rec.id, field, event, op: g.op, random: g.random });
  }
  // what carries or fires what
  const carriedBy = new Map(), firedBy = new Map(), ammoFor = new Map(), builtIn = new Map(), persWeap = new Map(), subOf = new Map(), maxBy = new Map();
  for (const s of ships) {
    for (const it of novaShipItems(s)) push(carriedBy, it.id, { id: s.id, count: it.count });
    for (const [t, c] of [['WeapType', 'WeapCount'], ['WeapType2', 'WeapCount2']]) (s[t] || []).forEach((w, i) => { if (w >= 128) push(builtIn, w, { id: s.id, count: s[c][i] }); });
  }
  for (const o of outfits) for (let k = 1; k <= 4; k++) {
    const mt = o[k === 1 ? 'ModType' : 'ModType' + k], mv = o[k === 1 ? 'ModVal' : 'ModVal' + k];
    if (mt === 1) push(firedBy, mv, o.id);
    if (mt === 3) push(ammoFor, mv, o.id);
    if (mt === 27) push(maxBy, mv, o.id);
  }
  for (const p of persons) (p.WeapType || []).forEach((w, i) => { if (w >= 128) push(persWeap, w, { id: p.id, count: p.WeapCount[i] }); });
  for (const w of weapons) if (w.SubType >= 128) push(subOf, w.SubType, w.id);
  // contribute bits: who gives each
  const contributors = new Map();
  for (const s of ships) for (const b of novaMaskBits(s.Contributes)) push(contributors, b, { type: 'shïp', id: s.id });
  for (const o of outfits) for (const b of novaMaskBits(o.Contributes)) push(contributors, b, { type: 'oütf', id: o.id });
  for (const c of crons) for (const b of novaMaskBits(c.Contrib)) push(contributors, b, { type: 'crön', id: c.id });
  for (const k of ranks) for (const b of novaMaskBits(k.Contrib)) push(contributors, b, { type: 'ränk', id: k.id });
  // where people, fleets and düdes are named by systems, stellars and missions
  const sysPers = new Map(), sysDude = new Map(), reinf = new Map(), defends = new Map(), missionDude = new Map(), linkMission = new Map();
  for (const s of systems) {
    (s.Person || []).forEach((p, i) => { if (p >= 128) push(sysPers, p, { id: s.id, prob: s.PersonProb[i] }); });
    (s.DudeTypes || []).forEach((d, i) => { if (d >= 128) push(sysDude, d, { id: s.id, prob: s.Probs[i] }); });
    if (s.ReinfFleet >= 128) push(reinf, s.ReinfFleet, s.id);
  }
  for (const sp of stellars) if (sp.DefenseDude >= 128) push(defends, sp.DefenseDude, sp.id);
  for (const m of missions) {
    if (m.ShipDude >= 128) push(missionDude, m.ShipDude, { id: m.id, field: 'ShipDude' });
    if (m.AuxShipDude >= 128) push(missionDude, m.AuxShipDude, { id: m.id, field: 'AuxShipDude' });
  }
  for (const p of persons) if (p.LinkMission >= 128) push(linkMission, p.LinkMission, p.id);
  // the governments as GovtAllies and GovtEnemies read them
  let D = null;
  const flight = () => D || (D = novaFlightData(u));
  const systemsAllowing = (link, isPerson) => {
    if (link === -1) return null;   // anywhere
    const d = flight();
    return u.systems.filter(s => novaLinkSystOk(d, link, s, isPerson)).map(s => s.id);
  };

  function of(type, id) {
    const r = novaGet(game, type, id);
    if (!r) return null;
    switch (type) {
      case 'oütf': {
        const tl = r.TechLevel;
        const soldAt = tl < 0 || tl === 32767 ? [] : stellars.filter(sp => (sp.Flags & 0x04) &&
          (tl <= sp.TechLevel || [...(sp.SpecialTech || []), ...(sp.SpecialTech4to8 || [])].includes(tl))).map(sp => sp.id);
        const needs = novaMaskBits(r.Requires).map(b => ({ bit: b, from: contributors.get(b) || [] }));
        return { soldAt, carriedBy: carriedBy.get(id) || [], given: given.get(id) || [], needs, maxBy: maxBy.get(id) || [],
          grantedBy: r.ItemClass > 0 ? persons.filter(p => p.GrantClass === r.ItemClass).map(p => p.id) : [] };
      }
      case 'wëap':
        return { firedBy: firedBy.get(id) || [], ammo: ammoFor.get(id) || [], builtIn: builtIn.get(id) || [], persons: persWeap.get(id) || [],
          stellars: stellars.filter(sp => sp.Weapon === id).map(sp => sp.id), subOf: subOf.get(id) || [] };
      // SpawnPerson draws only a përs up to 1150 with an AIType and a ship class; SpawnFleet a flët below 384
      case 'përs': {
        const drawn = id <= 1150 && r.AIType > 0 && !!novaGet(game, 'shïp', r.ShipType);
        return { systems: sysPers.get(id) || [], drawn, linked: drawn ? systemsAllowing(r.LinkSyst, true) : [] };
      }
      case 'flët': {
        const drawn = id < 384 && !!novaGet(game, 'shïp', r.LeadShipType);
        return { drawn, linked: drawn ? systemsAllowing(r.LinkSyst, false) : [], reinforces: reinf.get(id) || [] };
      }
      case 'düde':
        return { systems: sysDude.get(id) || [], defends: defends.get(id) || [], missions: missionDude.get(id) || [] };
      case 'gövt': {
        const d = flight();
        const others = all('gövt').filter(g => g.id !== id);
        return {
          systems: u.systems.filter(s => s.govt === id).map(s => s.id),
          stellars: stellars.filter(sp => sp.Govt === id).map(sp => sp.id),
          allies: others.filter(g => novaGovtAllies(d, id, g.id)).map(g => g.id),
          enemies: others.filter(g => novaGovtEnemies(d, id, g.id)).map(g => g.id),
          dudes: dudes.filter(x => x.Govt === id).map(x => x.id), fleets: fleets.filter(x => x.Govt === id).map(x => x.id),
          persons: persons.filter(x => x.Govt === id).map(x => x.id),
          ranks: ranks.filter(x => x.Govt === id).map(x => x.id),
        };
      }
      case 'ränk':
        return { given: rankGiven.get(id) || [], sameGovt: r.Govt >= 128 ? ranks.filter(x => x.Govt === r.Govt && x.id !== id).map(x => x.id) : [] };
      case 'jünk':
        return { boughtAt: (r.BoughtAt || []).filter(s => u.stellars.has(s)), soldAt: (r.SoldAt || []).filter(s => u.stellars.has(s)) };
      default:
        return {};
    }
  }
  return { of, missionsOf: id => linkMission.get(id) || [] };
}
