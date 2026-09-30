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

/* A place code in words, by the Bible's mïsn section: { text, stellar,
   system, govt } with the ids a page can link, any of them null. `field`
   is 'avail', 'travel', 'return' or 'ship'. */
function novaMissionPlace(u, field, v) {
  const govt = off => ({ govt: 128 + v - off });
  const g = (off, what) => ({ text: what, ...govt(off) });
  if (field === 'ship') {
    const words = { '-1': 'the system where the mission begins', '-2': 'any system', '-3': "TravelStel's system", '-4': "ReturnStel's system",
      '-5': 'a system next to where it begins', '-6': 'whatever system the player is in' };
    if (words[v]) return { text: words[v] };
    if (v >= 128 && v <= 2175) return { text: 'system', system: v };
    if (v >= 9999 && v <= 10255) return g(10000, "a system of the government");
    if (v >= 15000 && v <= 15255) return g(15000, "a system of an ally of the government");
    if (v >= 20000 && v <= 20255) return g(20000, 'a system of any government but');
    if (v >= 25000 && v <= 25255) return g(25000, "a system of an enemy of the government");
    return { text: 'code ' + v };
  }
  if (v === -1) return { text: field === 'avail' ? 'any inhabited stellar' : 'none in particular' };
  // below the first stellar id: in the shipped files, the "Silent Mission"s
  // other missions start (Sxxx), which are offered nowhere
  if (field === 'avail' && v >= 0 && v < 128) return { text: 'nowhere (no stellar has id ' + v + '); it is only ever started by another' };
  if (v === -2 && field !== 'avail') return { text: 'a random inhabited stellar' };
  if (v === -3 && field !== 'avail') return { text: field === 'travel' ? 'a random uninhabited planet' : 'a random uninhabited stellar' };
  if (v === -4 && field === 'return') return { text: 'the stellar where it was accepted' };
  if (v >= 128 && v <= 2175) return { text: 'stellar', stellar: v };
  if (field === 'avail' && v >= 5000 && v <= 7047) return { text: 'a stellar in a system next to', system: 128 + v - 5000 };
  if (v >= 9999 && v <= 10255) return g(10000, 'a stellar of the government');
  if (v >= 15000 && v <= 15255) return g(15000, 'a stellar of an ally of the government');
  if (v >= 20000 && v <= 20255) return g(20000, 'a stellar of any government but');
  if (v >= 25000 && v <= 25255) return g(25000, 'a stellar of an enemy of the government');
  if (v >= 30000 && v <= 30255) return g(30000, 'a stellar of the government, or of one of its class');
  if (v >= 31000 && v <= 31255) return g(31000, 'a stellar of neither the government nor its class');
  return { text: 'code ' + v };
}
const NOVA_AVAIL_LOC = ['the mission computer', 'the bar', 'a ship (a përs offers it)', 'the spaceport', 'the trading dialog', 'the shipyard', 'the outfitter'];

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
