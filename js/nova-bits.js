/* nova-bits.js -- what each control bit is for, read from the files.
   =========================================================================

   EV Nova has no table of what its 10,000 control bits mean: a bit means
   what the records that set it and test it make of it. This reads every
   test and set expression in the records, as Mac 1.1.1 reads them
   (nova-ncb.js: ncbTestNeeds through the game's reading of a test,
   ncbSetOps through its reading of a set expression), and gives, for each
   bit, which records need it on or off and which turn it on, off or over,
   and names it after what turns it on. The fields read are those whose
   note in nova-fields.js calls them a test of control bits or control
   bits set (fields_check checks the two lists against each other), and the
   {bxxx "..." "..."} choices of descriptions.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js,
   nova-ncb.js and nova-universe.js. */

/* The records with a test or set expression, the Bible's fields for each,
   and what the record's kind and the event read as in a sentence. */
const NOVA_BIT_SOURCES = [
  ['mïsn', 'mission', [['AvailBits', 'test', 'to be offered'], ['OnAccept', 'set', 'accepted'], ['OnRefuse', 'set', 'refused'],
    ['OnSuccess', 'set', 'completed'], ['OnFailure', 'set', 'failed'], ['OnAbort', 'set', 'aborted'], ['OnShipDone', 'set', 'done with its ships']]],
  ['oütf', 'outfit', [['Availability', 'test', 'to be sold'], ['OnPurchase', 'set', 'bought'], ['OnSell', 'set', 'sold back']]],
  ['shïp', 'ship', [['Availability', 'test', 'to be sold'], ['AppearOn', 'test', 'to fly in the galaxy'], ['OnPurchase', 'set', 'bought'],
    ['OnCapture', 'set', 'captured'], ['OnRetire', 'set', 'traded in']]],
  ['crön', 'event', [['EnableOn', 'test', 'to happen'], ['OnStart', 'set', 'begun'], ['OnEnd', 'set', 'ended']]],
  ['öops', 'disaster', [['ActivateOn', 'test', 'to happen']]],
  ['përs', 'person', [['ActivateOn', 'test', 'to appear']]],
  ['flët', 'fleet', [['ActivateOn', 'test', 'to appear']]],
  ['jünk', 'commodity', [['BuyOn', 'test', 'to be bought'], ['SellOn', 'test', 'to be sold']]],
  ['sÿst', 'system', [['Visibility', 'test', 'to be on the map']]],
  ['spöb', 'stellar', [['OnDominate', 'set', 'dominated'], ['OnRelease', 'set', 'released'], ['OnDestroy', 'set', 'destroyed'], ['OnRegen', 'set', 'regenerated']]],
  ['nëbu', 'nebula', [['ActiveOn', 'test', 'to be on the map'], ['OnExplore', 'set', 'explored']]],
  ['chär', 'new game', [['onStart', 'set', 'started']]],
  ['dësc', 'description', [['Description', 'desc', 'to read one way']]],
];

/* Every bit the files use: a Map of bit to
     { n, name, refs: [{ effect, type, kind, id, name, field, event, random }] }
   effect 'on' or 'off' (a test needs it so), or 'set', 'clear', 'toggle';
   random where the change happens in only some of an R(...) choice's
   outcomes. `name` is what turns it on: the first record that does, in
   the order of NOVA_BIT_SOURCES and then by number, and how many others do;
   failing that, what turns it over, then what clears it; null for a bit
   nothing changes. */
function novaBitCatalog(game) {
  const bits = new Map();
  const add = (n, ref) => {
    if (!(n >= 0 && n < 10000)) return;
    if (!bits.has(n)) bits.set(n, { n, name: null, refs: [] });
    bits.get(n).refs.push(ref);
  };
  for (const [type, kind, fields] of NOVA_BIT_SOURCES) {
    for (const rec of novaAll(game, type)) {
      const name = novaNameParts(rec.name).name;
      for (const [field, how, event] of fields) {
        const text = rec[field];
        if (!text) continue;
        const base = { type, kind, id: rec.id, name, field, event };
        if (how === 'test') for (const x of ncbTestNeeds(text)) add(x.n, { ...base, effect: x.on ? 'on' : 'off', random: false });
        else if (how === 'desc') for (const n of novaDescBits(text)) add(n, { ...base, effect: 'on', random: false });
        else for (const o of ncbSetOps(text)) if (o.letter === 'B') add(o.n, { ...base, effect: o.op, random: o.random });
      }
    }
  }
  const order = { set: 0, toggle: 1, clear: 2, on: 3, off: 4 }, typeOrder = new Map(NOVA_BIT_SOURCES.map(([t], i) => [t, i]));
  for (const b of bits.values()) {
    b.refs.sort((x, y) => order[x.effect] - order[y.effect] || typeOrder.get(x.type) - typeOrder.get(y.type) || x.id - y.id || x.field.localeCompare(y.field));
    for (const effect of ['set', 'toggle', 'clear']) {
      const by = b.refs.filter(r => r.effect === effect);
      if (!by.length) continue;
      const first = by[0], others = new Set(by.map(r => r.type + r.id)).size - 1;
      b.name = `${effect === 'set' ? 'turned on' : effect === 'toggle' ? 'turned over' : 'turned off'} when the ${first.kind} ${first.name} is ${first.event}` +
               (others ? ` (and by ${others} other record${others === 1 ? '' : 's'})` : '');
      break;
    }
  }
  return bits;
}
