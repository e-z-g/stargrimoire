/* nova-missions.js -- missions, and the storylines they make, from the files.
   =========================================================================

   STORYLINES. Nothing the player sees names a storyline, but Ambrosia's
   mission resources do: 578 of 1.1.1's 791 have a note after a semicolon
   in their name ("Pick up Mu'Randa;Polaris1", "Take Polaris Home;Rebel
   I22 LAST"), which the program cuts off before showing the name
   (novaNameParts). The note is a storyline's name and the mission's step
   in it, and sometimes more: LAST for its last mission, "Unregistered
   cutoff" where the unregistered game stops, "link to Pirate storyline",
   "(forced)". A storyline here is the missions whose notes share a name
   before the step, in any case and spacing; the notes are read as written,
   so "Rebel", "Rebel I" and "Rebel II" are three, as Ambrosia wrote them.
   The evnova.miraheze.org wiki names the same steps ("Done Rebel I.022"),
   and utilities/missions_check.mjs holds this reading to it.

   WHERE. AvailStel, TravelStel, ReturnStel and ShipSyst are the Bible's
   codes (its mïsn section): a stellar or system id, or a range that means
   a kind of place, a government's by index (id - 128) past an offset. One
   more is in the files: AvailStel 127, below every stellar id, on seven
   "Silent Mission"s that others start with Sxxx and nothing offers.

   LEADS TO. One mission leads to another when it turns on a bit the
   other's AvailBits needs on, or starts it (Sxxx in a set expression); on
   accepting, on success or with its ships dealt with. A bit many missions
   turn on (a storyline "in progress") joins everything, so a bit counts as
   a link only when at most three missions turn it on, as nova-bits.js
   names such a bit.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-bits.js. */

/* A mission's note as { story, key, step, num, rest, last, cutoff }, or
   null for none. `key` is the storyline's name folded for grouping. */
function novaStoryNote(note) {
  const s = String(note || '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const m = /^(.*?)\s*(\d+)([A-Za-z]*)(?![0-9])\s*(.*)$/.exec(s);
  const story = (m && m[1].trim() ? m[1] : m ? 'untitled' : s).replace(/\s+/g, ' ').trim();
  return {
    story, key: story.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    step: m ? m[2] + m[3] : null, num: m ? +m[2] : null, rest: m ? m[4].trim() : '',
    last: /\bLAST\b/.test(s), cutoff: /unregistered cutoff/i.test(s),
  };
}

/* A place code in words, as Mac 1.1.1 reads it: { text, stellar, system,
   govt } with the ids a page can link, any of them absent. `field` is
   'avail' (AvailStel, IsMissionAvailable 0x9b152), 'travel' or 'return'
   (TravelStel and ReturnStel, RandomizeOneMission 0xa14d1 and
   SelectMissionStellar 0x9a26a), 'ship' (ShipSyst, LoadCurrentMissionData
   0xa0a38 and SelectMissionSystem 0x9b993) or 'aux' (AuxShipSyst,
   ValidAuxShipSystem 0x992b5). `{g}` in the text is where the government
   goes, kept as 128 + index; 9999 gives 127, no government. js/nova-fields.js says the same in its notes. */
function novaMissionPlace(u, field, v) {
  const g = (off, what) => ({ text: what, govt: 128 + v - off });
  const govts = where => {
    if (v >= 9999 && v <= 14999) return g(10000, `${where} of {g}`);
    if (v >= 15000 && v <= 19999) return g(15000, `${where} of an ally of {g}`);
    if (v >= 20000 && v <= 24999) return g(20000, `${where} of any government but {g}`);
    if (v >= 25000 && v <= 29999) return g(25000, `${where} of an enemy of {g}`);
    if (v >= 30000 && v <= 30999) return g(30000, `${where} of {g} or of one sharing a class with it`);
    if (v >= 31000 && v <= 31999) return g(31000, `${where} of neither {g} nor one sharing a class with it`);
    return null;
  };
  if (field === 'avail') {
    if (v <= -32000) return { text: 'nowhere: never offered' };
    if (v === -1) return { text: 'anywhere' };
    if (v >= 128 && v <= 4999) return { text: 'stellar', stellar: v };
    if (v >= 5000 && v <= 9998) return { text: 'a stellar in a system linked to', system: 128 + v - 5000 };
    return govts('a stellar') || { text: 'nowhere: never offered' };
  }
  if (field === 'travel' || field === 'return') {
    if (v === -1) return { text: field === 'travel' ? 'no destination' : "TravelStel's stellar" };
    if (v === -2) return { text: 'a random stellar without spöb Flags 0x20' };
    if (v === -3) return { text: 'a random stellar with spöb Flags 0x20 and without 0x10' };
    if (v >= 128 && v <= 2175) return { text: 'stellar', stellar: v };
    return govts('a random stellar') || { text: 'the stellar where it is accepted' };
  }
  if (field === 'ship') {
    const words = { '-1': 'the system you accept it in', '-2': 'a random system, not that one', '-3': "TravelStel's system, or ReturnStel's",
      '-4': "ReturnStel's system", '-5': 'a random system linked to the one you accept it in', '-6': 'whatever system you are in' };
    if (words[v]) return { text: words[v] };
    if (v >= 128 && v <= 9998) return { text: 'system', system: v };
    return govts('a random system') || { text: 'nowhere' };
  }
  if (field === 'aux') {
    const words = { '-1': 'any system', '-6': 'any system', '-2': "TravelStel's system", '-3': "ReturnStel's system" };
    if (words[v]) return { text: words[v] };
    if (v >= 128 && v <= 2175) return { text: 'system', system: v };
    if (v >= 5000 && v <= 9998) return { text: 'the system, or one linked to it:', system: 128 + v - 5000 };
    return govts('systems') || { text: 'nowhere' };
  }
  return { text: 'code ' + v };
}
/* PayVal in words, as ApplyMissionPay 0x98326 and DoMissionAccept 0xa1b11
   read it: { text, govt } with a government's id where one is named. */
function novaMissionPay(v) {
  if (v > 0) return { text: v.toLocaleString('en-US') + ' credits' };
  if (v <= -10000 && v >= -19999) return { text: 'records below 0 cleared in the systems of {g}', govt: -v - 10000 };
  if (v <= -20000 && v >= -29999) return { text: 'records below 0 cleared in the systems of an ally of {g}', govt: -v - 20000 };
  if (v <= -30000 && v >= -39999) return { text: 'records below 0 cleared in the systems of {g} or of one sharing a class with it', govt: -v - 30000 };
  if (v <= -40001 && v >= -40099) return { text: `${-v - 40000}% of your credits taken` };
  if (v < -50000) return { text: `${(-v - 50000).toLocaleString('en-US')} credits taken on accepting` };
  return { text: 'nothing' };
}
// AvailLoc's places, as OfferMissionFromPort 0xa369e and the port dialogs set them.
const NOVA_AVAIL_LOC = ['the Mission BBS', 'the bar', 'a ship (a përs offers it)', 'the spaceport, on landing', 'the Trade Center', 'the shipyard', 'the outfitter'];

/* Every mission, and the storylines: { byId: Map of id to mission, stories:
   Map of key to { key, name, missions } }. A mission is { id, name, note,
   story (novaStoryNote), rec, needs: [{ n, on }], turnsOn: Set of bits
   (accepted, completed, ships done), starts: [ids], next: [ids],
   prev: [ids], startedBy: [ids] }. A storyline's missions are in step order, then by id. */
function novaMissions(game) {
  const byId = new Map();
  for (const rec of novaAll(game, 'mïsn')) {
    const parts = novaNameParts(rec.name);
    const m = { id: rec.id, name: parts.name, note: parts.note, story: novaStoryNote(parts.note), rec,
                needs: ncbTestNeeds(rec.AvailBits || ''), turnsOn: new Set(), starts: [], next: [], prev: [], startedBy: [] };
    for (const f of ['OnAccept', 'OnSuccess', 'OnShipDone']) for (const st of ncbParseSet(rec[f] || '')) for (const o of st.ops) {
      if (o.op === 'set') m.turnsOn.add(o.n);
      const s = /^[Ss](\d+)$/.exec(o.text);
      if (s && !m.starts.includes(+s[1])) m.starts.push(+s[1]);
    }
    byId.set(rec.id, m);
  }
  // bits that at most three missions turn on make links; the rest join everything
  const setters = new Map();
  for (const m of byId.values()) for (const n of m.turnsOn) { if (!setters.has(n)) setters.set(n, []); setters.get(n).push(m.id); }
  for (const m of byId.values()) {
    const from = new Set(m.starts.filter(id => byId.has(id) && id !== m.id));
    for (const [n, ids] of setters) if (ids.length <= 3 && ids.includes(m.id))
      for (const o of byId.values()) if (o.id !== m.id && o.needs.some(x => x.n === n && x.on)) from.add(o.id);
    for (const id of m.starts) if (byId.has(id)) byId.get(id).startedBy.push(m.id);
    m.next = [...from].sort((a, b) => a - b);
    for (const id of m.next) byId.get(id).prev.push(m.id);
  }
  const stories = new Map();
  for (const m of byId.values()) {
    if (!m.story) continue;
    const k = m.story.key;
    if (!stories.has(k)) stories.set(k, { key: k, name: m.story.story, missions: [] });
    stories.get(k).missions.push(m);
  }
  for (const s of stories.values()) {
    s.missions.sort((a, b) => (a.story.num ?? Infinity) - (b.story.num ?? Infinity) || String(a.story.step).localeCompare(String(b.story.step)) || a.id - b.id);
    // the name as most of its notes spell it
    const count = new Map();
    for (const m of s.missions) count.set(m.story.story, (count.get(m.story.story) || 0) + 1);
    s.name = [...count].sort((a, b) => b[1] - a[1])[0][0];
  }
  return { byId, stories };
}
