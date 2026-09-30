/* nova-bits.js -- what each control bit is for, read from the files.
   =========================================================================

   EV Nova has no table of what its 10,000 control bits mean: a bit means
   what the records that set it and test it make of it. This reads every
   test and set expression in the records the Bible gives one, and says,
   for each bit, which records need it on or off and which turn it on, off
   or over, and names it after the one that sets it. It is a port of
   Drydock's StoryFlagCatalog and NCBSetExpression (geuis/drydock,
   Sources/Drydock/GameData/, MIT, taken at b265a79 on 29 September 2026;
   doc/credits.md): the same sources, the same reading of a test through
   its negations, the same set-expression steps, R(...) a random choice
   between its operations, and the same name for a bit that more than
   three missions set. Added here: nebulae (ActiveOn, OnExplore), the new
   game's chär OnStart, and the {bxxx "..." "..."} choices of descriptions.

   SET EXPRESSIONS, the Bible's set-expression section: operations
   separated by spaces, bxxx turns a bit on, !bxxx off, ^bxxx over, and
   R(op op) does one of the two at random. Everything else (Sxxx start a
   mission, Gxxx grant an outfit, Mxxx move the player ...) is kept as
   written and changes no bit.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js,
   nova-ncb.js and nova-universe.js. */

/* A set expression as its steps: [{ random, ops: [{ op, n, text }] }], op
   'set', 'clear', 'toggle' or 'other' (n null). A random step's ops are
   the choices, one of which happens. */
function ncbParseSet(text) {
  const s = String(text || ''), steps = [];
  const one = tok => {
    const m = /^([!^]?)[Bb](\d+)/.exec(tok);
    if (!m) return { op: 'other', n: null, text: tok };
    return { op: m[1] === '!' ? 'clear' : m[1] === '^' ? 'toggle' : 'set', n: +m[2], text: tok };
  };
  for (let i = 0; i < s.length;) {
    if (/\s/.test(s[i])) { i++; continue; }
    if ((s[i] === 'R' || s[i] === 'r') && s[i + 1] === '(') {
      let j = i + 2, depth = 1;
      while (j < s.length && depth > 0) { if (s[j] === '(') depth++; if (s[j] === ')') depth--; j++; }
      const inner = s.slice(i + 2, depth === 0 ? j - 1 : j);
      steps.push({ random: true, ops: inner.split(/\s+/).filter(Boolean).map(one) });
      i = j;
      continue;
    }
    let j = i;
    while (j < s.length && !/\s/.test(s[j])) j++;
    steps.push({ random: false, ops: [one(s.slice(i, j))] });
    i = j;
  }
  return steps;
}

/* What a test needs of each bit it names: [{ n, on }], on false where the
   bit is under an odd number of negations. A test that does not parse is
   read loosely, as Drydock does: each bxxx, off when a ! is just before. */
function ncbTestNeeds(text) {
  const out = [];
  let tree = null;
  try { tree = ncbParseTest(text).tree; } catch (e) { /* loose, below */ }
  if (tree) {
    const walk = (t, neg) => {
      if (t.op === 'term' && t.letter === 'B') out.push({ n: t.n, on: !neg });
      if (t.op === 'not') walk(t.arg, !neg);
      if (t.args) for (const a of t.args) walk(a, neg);
    };
    walk(tree, false);
    return out;
  }
  for (const m of String(text || '').matchAll(/(!?)\s*[Bb](\d+)/g)) out.push({ n: +m[2], on: !m[1] });
  return out;
}

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
   random where the change is one side of an R(...) choice. `name` is the
   record that sets it and when (Drydock's makeName), "set by N missions"
   past three, or null for a bit nothing sets. */
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
        else for (const st of ncbParseSet(text)) for (const o of st.ops) if (o.n !== null) add(o.n, { ...base, effect: o.op, random: st.random });
      }
    }
  }
  const order = { set: 0, toggle: 1, clear: 2, on: 3, off: 4 };
  for (const b of bits.values()) {
    b.refs.sort((x, y) => order[x.effect] - order[y.effect] || x.type.localeCompare(y.type) || x.id - y.id || x.field.localeCompare(y.field));
    const setters = new Set(b.refs.filter(r => r.type === 'mïsn' && (r.effect === 'set' || r.effect === 'toggle')).map(r => r.id));
    const first = b.refs.find(r => r.effect === 'set') || b.refs.find(r => r.effect === 'toggle') || b.refs.find(r => r.effect === 'clear');
    if (setters.size > 3) b.name = `set by ${setters.size} missions, such as ${first.name}`;
    else if (first) b.name = `${first.effect === 'set' ? 'set' : first.effect === 'toggle' ? 'turned over' : 'cleared'} when the ${first.kind} ${first.name} is ${first.event}`;
  }
  return bits;
}
