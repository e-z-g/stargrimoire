/* nova-deadends.js -- where a storyline can be left with no way forward.
   =========================================================================

   A storyline is stuck when it has begun, none of its missions is under
   way, none can ever be taken again, and none of its ends has been
   reached. Found in three passes, each reading control bits as the game
   does (ncbTest, ncbSetOutcomes).

   WHAT CAN HAPPEN (novaReach). A fixed point over what each bit may be:
   every bit starts off; a mission whose AvailBits some allowed bits make
   pass is offered, and then accepted, refused, completed, failed and
   aborted are all taken as possible (an escape pod aborts any mission);
   an event (crön) whose EnableOn may pass starts and ends; an outfit or
   ship that may be sold is bought and sold, a ship captured and retired;
   a nebula explored; a stellar dominated, released, destroyed and
   regenerated; the pilot's chär begins. Whatever any of those may turn on
   may be on. A mission started by an S is taken too. It over-reaches on
   purpose: what it finds cannot happen cannot.

   A STORYLINE'S STATES (novaStoryDeadEnds). Every state from a new game
   over the bits its missions' AvailBits read, which of its missions are
   under way, and whether it has begun or reached an end: a mission of
   it offered (its AvailBits passing) may be accepted or refused (not when
   Flags 0x0004 forbids refusing); one under way completed (unless no
   landing finishes it), failed (where it can: a TimeLimit, ships to
   destroy, disable or board without Flags 0x0400, Flags2 0x0004, a scan
   with Flags 0x0020, or an F in a set expression), aborted (CanAbort), or
   ended by itself (Flags 0x0001, running its OnAbort); an escape pod
   aborts every mission under way, each running its OnAbort (HandlePlayer
   0x68f0d); S starts a mission as accepted, A aborts it, F fails it. One
   of its missions is taken at a time (opts.maxActive; one started by an S
   comes as well), since every order in which several may be under way
   together is too many to search for the longest storylines; a mission
   that touches nothing in the storyline is taken as one step. A bit that
   something outside the storyline changes is taken as either, at any time, so
   a lock made by another storyline is not seen here; the next pass finds
   that kind. Its ends are those of its missions that no other mission of it follows
   and that can be finished (with none, a mission of it that can still be taken). A state
   from which no end can be reached, once the storyline has begun, is stuck; each is labelled by the last thing done in the
   storyline on the way there.

   A BIT LEFT ON FOR GOOD (novaHeldBits). A bit a mission turns on when
   accepted that its OnAbort does not turn off stays on after an escape
   pod during it; where nothing that can still happen with it on turns it
   off, every mission that needs it off is never offered again.

   A MISSION AN ESCAPE POD CAN LOSE (novaPodLosses). One never offered,
   only started by an S, cannot be taken again once lost; where its success
   alone turns on a bit others need, alone starts another such mission, or
   is its storyline's end, that goes with it. The storyline search does not
   see it where the storyline has an end before it on another branch.

   What is found is a reading of the files; the files cannot show whether
   it was meant (a storyline closed on purpose by refusing).

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-ncb.js,
   nova-missions.js and nova-fields.js. */

// A set expression's outcomes, one for each way its R choices may fall:
// [[{ op: set|clear|toggle|start|abort|fail, n }]] (S, A, F; the rest left out).
const NOVA_SET_STEPS = new Map();
function novaSetSteps(text) {
  const k = String(text || '');
  let v = NOVA_SET_STEPS.get(k);
  if (!v) {
    const verb = { S: 'start', A: 'abort', F: 'fail' };
    v = ncbSetOutcomes(k).map(o => o.map(x => (x.op === 'other' ? (verb[x.letter] ? { op: verb[x.letter], n: x.n } : null) : { op: x.op, n: x.n })).filter(Boolean));
    NOVA_SET_STEPS.set(k, v);
  }
  return v;
}
// Every operation in any outcome of a set expression.
const novaSetAny = text => novaSetSteps(text).flat();

// The terms a test reads: [{ L, n }], B n by number, G, P, O n and E n free.
function novaTestTerms(text) {
  const out = new Map();
  for (const m of String(text || '').matchAll(/([BbGgPpOoEe])\s*(\d*)/g)) {
    const L = m[1].toUpperCase();
    if ((L === 'B' || L === 'O' || L === 'E') && !m[2]) continue;
    out.set(L + (L === 'G' || L === 'P' ? '' : m[2]), { L, n: L === 'G' || L === 'P' ? 0 : +m[2] });
  }
  return [...out.values()];
}
// Whether some assignment, each bit within may(n, v), makes a test pass.
function novaTestCan(text, may) {
  if (!text || !String(text).trim()) return true;
  const vars = novaTestTerms(text);
  if (vars.length > 18) return true;
  const choices = vars.map(v => (v.L === 'B' ? [0, 1].filter(x => may(v.n, x)) : [0, 1]));
  if (choices.some(c => !c.length)) return false;
  const idx = new Array(vars.length).fill(0);
  for (;;) {
    const st = { bits: new Set(), outfits: new Set(), explored: new Set(), male: false, registered: true, days: 0 };
    vars.forEach((v, i) => {
      const x = choices[i][idx[i]];
      if (v.L === 'B') { if (x) st.bits.add(v.n); }
      else if (v.L === 'G') st.male = !!x;
      else if (v.L === 'P') { st.registered = !!x; st.days = x ? 0 : 1e9; }
      else if (v.L === 'O') { if (x) st.outfits.add(v.n); }
      else if (x) st.explored.add(v.n);
    });
    if (ncbTest(text, st)) return true;
    let i = 0;
    for (; i < vars.length; i++) { if (++idx[i] < choices[i].length) break; idx[i] = 0; }
    if (i === vars.length) return false;
  }
}

// Why a mission is never offered by its fields (not its bits), or null.
function novaMissionNever(game, m) {
  if (/never offered/.test(novaFieldRead(game, 'mïsn', 'AvailStel', m) || '')) return 'its AvailStel offers it nowhere';
  if (!(m.AvailLoc >= 0 && m.AvailLoc <= 6)) return `AvailLoc ${m.AvailLoc} offers it nowhere`;
  if (m.AvailRandom <= 0) return `AvailRandom ${m.AvailRandom}: never`;
  if (m.AvailRecord < -32001) return `AvailRecord ${m.AvailRecord}: never`;
  const t = m.AvailShipTyp;
  if (t >= 128 && t <= 896 && !novaGet(game, 'shïp', t)) return `AvailShipTyp ${t}: no such ship`;
  return null;
}
const novaMissionLands = (game, m) => !/no landing finishes it/.test(novaFieldRead(game, 'mïsn', 'ReturnStel', m) || '');
const NOVA_MISSION_SETS = ['OnAccept', 'OnRefuse', 'OnSuccess', 'OnFailure', 'OnAbort', 'OnShipDone'];
// The missions an F in some set expression fails.
function novaMissionsFailed(game) {
  const out = new Set();
  for (const [type, fields] of [['mïsn', NOVA_MISSION_SETS], ['crön', ['OnStart', 'OnEnd']], ['oütf', ['OnPurchase', 'OnSell']], ['shïp', ['OnPurchase', 'OnCapture', 'OnRetire']], ['nëbu', ['OnExplore']], ['spöb', ['OnDominate', 'OnRelease', 'OnDestroy', 'OnRegen']], ['chär', ['onStart']]])
    for (const r of novaAll(game, type)) for (const f of fields) for (const x of novaSetAny(r[f])) if (x.op === 'fail') out.add(x.n);
  return out;
}
// Whether a mission can fail (the field notes: a TimeLimit, ships to destroy, disable or board
// without Flags 0x0400, Flags2 0x0004, a scan with Flags 0x0020; or an F in a set expression).
const novaMissionCanFail = (m, failed) => m.TimeLimit > 0 || (m.ShipCount > 0 && [1, 2, 3, 5].includes(m.ShipGoal) && !(m.Flags & 0x400)) || !!(m.Flags2 & 4) || !!((m.Flags & 0x20) && m.ScanMask) || failed.has(m.id);
// The set expressions of a mission that can be carried out: OnSuccess and OnShipDone where a
// landing finishes it, OnFailure where it can fail, OnRefuse where it may be refused; OnAccept and
// OnAbort always (an escape pod aborts any mission).
function novaMissionSetsRun(game, m, failed) {
  const lands = novaMissionLands(game, m);
  return NOVA_MISSION_SETS.filter(f => f === 'OnAccept' || f === 'OnAbort' || (f === 'OnRefuse' && !(m.Flags & 4)) || (f === 'OnFailure' && novaMissionCanFail(m, failed)) || ((f === 'OnSuccess' || f === 'OnShipDone') && lands));
}

/* What can ever happen: { may(n, v), on: Set, taken: Set, offered: Set,
   why: Map of mission to 'offered' or what starts it, happened: { crön,
   oütf, shïp } as Sets }. opts.held / opts.heldOff: bits held on or off
   throughout; opts.from: bits on at the start. */
function novaReach(game, opts = {}) {
  const it = novaReachSteps(game, opts);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
// The same, a step at a time: it yields between rounds, and returns what novaReach does.
function* novaReachSteps(game, opts = {}) {
  const on = new Set([...(opts.held || []), ...(opts.from || [])]);
  const held = new Set(opts.held || []), heldOff = new Set(opts.heldOff || []);
  const may = (n, v) => (held.has(n) ? !!v : heldOff.has(n) ? !v : v ? on.has(n) : true);
  const F = yield* novaReachFactsSteps(game);
  const taken = new Set(), offered = new Set(), why = new Map(), applied = new Set(), refused = new Set();
  const happened = { crön: new Set(), oütf: new Set(), shïp: new Set() };
  let changed = true;
  const apply = (text, from) => {
    for (const o of novaSetAny(text)) {
      if ((o.op === 'set' || o.op === 'toggle') && !heldOff.has(o.n) && !on.has(o.n)) { on.add(o.n); changed = true; }
      if (o.op === 'start' && F.byId.has(o.n) && !taken.has(o.n)) { taken.add(o.n); why.set(o.n, from); changed = true; }
    }
  };
  for (const c of F.chars) apply(c.onStart, `chär ${c.id}`);
  for (const p of F.spobs) for (const f of ['OnDominate', 'OnRelease', 'OnDestroy', 'OnRegen']) apply(p[f], `spöb ${p.id}`);
  while (changed) {
    changed = false;
    yield;
    for (const m of F.offerable) {
      if (offered.has(m.id) || !novaTestCan(m.AvailBits, may)) continue;
      if (m.AvailLoc === 2 && !F.pers.some(p => p.LinkMission === m.id && novaTestCan(p.ActivateOn, may))) continue;
      offered.add(m.id); changed = true;
      if (!taken.has(m.id)) { taken.add(m.id); why.set(m.id, 'offered'); }
    }
    for (const id of taken) {
      if (applied.has(id)) continue;
      applied.add(id); changed = true;
      const m = F.byId.get(id);
      for (const f of ['OnAccept', 'OnSuccess', 'OnFailure', 'OnAbort', 'OnShipDone']) apply(m[f], `mïsn ${id}`);
    }
    for (const id of offered) { const m = F.byId.get(id); if (!(m.Flags & 4) && !refused.has(id)) { refused.add(id); apply(m.OnRefuse, `mïsn ${id}`); } }
    for (const c of F.crons) if (!happened.crön.has(c.id) && novaTestCan(c.EnableOn, may)) { happened.crön.add(c.id); apply(c.OnStart, `crön ${c.id}`); apply(c.OnEnd, `crön ${c.id}`); }
    for (const o of F.outfits) if (!happened.oütf.has(o.id) && novaTestCan(o.Availability, may)) { happened.oütf.add(o.id); apply(o.OnPurchase, `oütf ${o.id}`); apply(o.OnSell, `oütf ${o.id}`); }
    for (const s of F.ships) if (!happened.shïp.has(s.id) && (novaTestCan(s.Availability, may) || novaTestCan(s.AppearOn, may))) { happened.shïp.add(s.id); for (const f of ['OnPurchase', 'OnCapture', 'OnRetire']) apply(s[f], `shïp ${s.id}`); }
    for (const n of F.nebulae) if (novaTestCan(n.ActiveOn, may)) apply(n.OnExplore, `nëbu ${n.id}`);
  }
  return { may, on, taken, offered, why, happened, failed: F.failed };
}
// What novaReach reads of a game, read once: the records with set expressions, the missions that may
// be offered by their fields, those an F fails.
const NOVA_REACH_FACTS = new WeakMap();
function novaReachFacts(game) {
  const it = novaReachFactsSteps(game);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
function* novaReachFactsSteps(game) {
  let F = NOVA_REACH_FACTS.get(game);
  if (F) return F;
  const missions = novaAll(game, 'mïsn'), offerable = [];
  yield;
  for (let i = 0; i < missions.length; i++) { if (!novaMissionNever(game, missions[i])) offerable.push(missions[i]); if (i % 100 === 99) yield; }
  F = { byId: new Map(missions.map(m => [m.id, m])), offerable };
  for (const [k, type] of [['pers', 'përs'], ['chars', 'chär'], ['spobs', 'spöb'], ['crons', 'crön'], ['outfits', 'oütf'], ['ships', 'shïp'], ['nebulae', 'nëbu']]) { F[k] = novaAll(game, type); yield; }
  F.crons = F.crons.filter(c => c.Random >= 0 && c.Duration >= 0);
  F.failed = novaMissionsFailed(game);
  NOVA_REACH_FACTS.set(game, F);
  return F;
}

/* Every source of a set expression in the game that can happen, except the
   missions in skip: [{ test, label, text }]. */
function novaSetSources(game, reach, skip) {
  if (!reach.sources) reach.sources = novaSetSourcesAll(game, reach);
  return skip.size ? reach.sources.filter(s => !skip.has(s.mission)) : reach.sources;
}
function novaSetSourcesAll(game, reach) {
  const out = [];
  for (const m of novaAll(game, 'mïsn')) {
    if (!reach.taken.has(m.id)) continue;
    const test = reach.why.get(m.id) === 'offered' ? m.AvailBits : '';
    for (const f of novaMissionSetsRun(game, m, reach.failed)) if (m[f]) out.push({ test, label: `${f} of mïsn ${m.id}`, text: m[f], mission: m.id });
  }
  for (const c of novaAll(game, 'crön')) if (reach.happened.crön.has(c.id)) for (const f of ['OnStart', 'OnEnd']) if (c[f]) out.push({ test: c.EnableOn, label: `${f} of crön ${c.id}`, text: c[f], kind: 'crön', id: c.id });
  for (const o of novaAll(game, 'oütf')) if (reach.happened.oütf.has(o.id)) for (const f of ['OnPurchase', 'OnSell']) if (o[f]) out.push({ test: o.Availability, label: `${f} of oütf ${o.id}`, text: o[f], kind: 'oütf', id: o.id });
  for (const s of novaAll(game, 'shïp')) if (reach.happened.shïp.has(s.id)) for (const f of ['OnPurchase', 'OnCapture', 'OnRetire']) if (s[f]) out.push({ test: '', label: `${f} of shïp ${s.id}`, text: s[f], kind: 'shïp', id: s.id });
  for (const n of novaAll(game, 'nëbu')) if (n.OnExplore) out.push({ test: n.ActiveOn, label: `OnExplore of nëbu ${n.id}`, text: n.OnExplore });
  for (const p of novaAll(game, 'spöb')) for (const f of ['OnDominate', 'OnRelease', 'OnDestroy', 'OnRegen']) if (p[f]) out.push({ test: '', label: `${f} of spöb ${p.id}`, text: p[f] });
  return out;
}

// A storyline's ends: its missions that nothing in it follows and that can be finished (a branch's last as well
// as the storyline's; Ambrosia's LAST notes mark a few, but not some storylines' other endings).
function novaStoryEnds(game, story) {
  const inS = new Set(story.missions.map(m => m.id));
  return story.missions.filter(m => !m.next.some(x => inS.has(x)) && (novaMissionLands(game, m.rec) || (m.rec.Flags & 1))).map(m => m.id);
}

/* A storyline's dead ends: { ends: [ids], bits: [n], free: [n], states,
   stuck, endReached, after: [{ what, mission, count, path }] } -- after,
   each last thing done in the storyline on the way to a stuck state
   (what: accept, refuse, complete, fail, abort, ends by itself, escape
   pod), with how many stuck states and one way there, as steps
   [{ what, mission }] or { what: 'other', label }. opts.cap: the most
   states searched (else { tooMany: true }). */
function novaStoryDeadEnds(game, story, reach, opts = {}) {
  const it = novaStoryDeadEndsSteps(game, story, reach, opts);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
// The same, a step at a time: it yields the states searched so far every few thousand, and returns the result.
function* novaStoryDeadEndsSteps(game, story, reach, opts = {}) {
  const L = new Map(story.missions.map(m => [m.id, m.rec]));
  const endList = novaStoryEnds(game, story), ends = new Set(endList);
  // the bits its missions read, and those something outside changes (free)
  const Rset = new Set();
  for (const m of L.values()) for (const v of novaTestTerms(m.AvailBits)) if (v.L === 'B') Rset.add(v.n);
  const free = new Set(), outsideRaw = [];
  for (const src of novaSetSources(game, reach, L)) {
    const ops = novaSetAny(src.text);
    for (const x of ops) if ((x.op === 'set' || x.op === 'clear' || x.op === 'toggle') && Rset.has(x.n)) free.add(x.n);
    const local = ops.filter(x => (x.op === 'start' || x.op === 'abort' || x.op === 'fail') && L.has(x.n));
    if (local.length) outsideRaw.push({ test: src.test, label: src.label, steps: [local] });
  }
  const R = [...Rset].filter(n => !free.has(n)).sort((x, y) => x - y), Ri = new Map(R.map((n, i) => [n, i]));
  // a set expression's outcomes as they touch this storyline: [[k, x]], k 0 set, 1 clear, 2 toggle (x an index
  // into R), 3 start, 4 abort, 5 fail (x a mission of it); the same outcome kept once
  const KIND = { set: 0, clear: 1, toggle: 2, start: 3, abort: 4, fail: 5 };
  const project = outs => {
    const seen = new Map();
    for (const o of outs) {
      const q = [];
      for (const x of o) { const k = KIND[x.op]; if (k <= 2 ? Ri.has(x.n) : L.has(x.n)) q.push([k, k <= 2 ? Ri.get(x.n) : x.n]); }
      const key = q.join(';');
      if (!seen.has(key)) seen.set(key, q);
    }
    return [...seen.values()];
  };
  const steps = new Map();
  const stepsOf = text => { const k = String(text || ''); let v = steps.get(k); if (!v) { v = project(novaSetSteps(k)); steps.set(k, v); } return v; };
  const outside = outsideRaw.map(o => ({ test: o.test, label: o.label, steps: project(o.steps) }));
  // a test with a state's bits: R exact, free either, the rest as can happen; cached by the R bits it reads
  const tests = new Map();
  const testIn = (text, bits) => {
    if (!text || !String(text).trim()) return true;
    let t = tests.get(text);
    if (!t) { t = { idx: novaTestTerms(text).filter(v => v.L === 'B' && Ri.has(v.n)).map(v => Ri.get(v.n)), memo: new Map() }; tests.set(text, t); }
    let k = '';
    for (const i of t.idx) k += bits[i];
    let v = t.memo.get(k);
    if (v === undefined) { v = novaTestCan(text, (n, x) => (Ri.has(n) ? (bits[Ri.get(n)] === (x ? '1' : '0')) : free.has(n) ? true : reach.may(n, x))); t.memo.set(k, v); }
    return v;
  };
  const byPers = new Set(novaAll(game, 'përs').map(p => p.LinkMission));
  // a mission none of whose set expressions touches the storyline (no bit it reads, none of its missions
  // started, aborted or failed) changes nothing by being under way: it is taken as one step, accepted and
  // then finished or lost to an escape pod, not kept among those under way
  const neutral = m => ['OnAccept', 'OnSuccess', 'OnShipDone', 'OnFailure', 'OnAbort'].every(f => stepsOf(m[f]).every(q => !q.length));
  const local = [...L].map(([id, m]) => ({ id, m, lands: novaMissionLands(game, m), fails: novaMissionCanFail(m, reach.failed), never: !!novaMissionNever(game, m) || (m.AvailLoc === 2 && !byPers.has(id)), neutral: neutral(m) }));
  // a state: its R bits ('0' and '1'), its missions under way (ascending), begun (0 not, 1 begun, 2 an end reached)
  const key = (bits, active, begun) => bits + '|' + active.join(',') + '|' + begun;
  const index = new Map(), keys = [], parent = [], via = [];
  let eFrom = new Int32Array(1 << 12), eTo = new Int32Array(1 << 12), eN = 0;
  const cap = opts.cap || 2000000, maxActive = opts.maxActive || 1;
  let tooMany = false;
  const push = (bits, active, begun, from, ev) => {
    const k = key(bits, active, begun);
    let i = index.get(k);
    if (i === undefined) {
      if (keys.length >= cap) { tooMany = true; return; }
      i = keys.length; index.set(k, i); keys.push(k); parent.push(from); via.push(ev);
    }
    if (from >= 0) {
      if (eN === eFrom.length) { const f = new Int32Array(eN * 2); f.set(eFrom); eFrom = f; const t = new Int32Array(eN * 2); t.set(eTo); eTo = t; }
      eFrom[eN] = from; eTo[eN] = i; eN++;
    }
  };
  const SETS = { 3: 'OnAccept', 4: 'OnAbort', 5: 'OnFailure' };
  // set expressions carried out in turn on (bits, active): every outcome, S, A and F of its missions followed
  const run = (texts, bits, active, depth = 0) => {
    let outs = [[bits, active]];
    for (const t of texts) {
      const alts = typeof t === 'string' || t == null ? stepsOf(t) : t;
      if (alts.length === 1 && !alts[0].length) continue;
      const next = [];
      for (const [b0, a0] of outs) for (const q of alts) {
        let cur = [[b0.split(''), a0.slice()]];
        for (const [k, x] of q) {
          const nx = [];
          for (const [b, a] of cur) {
            if (k === 0) b[x] = '1';
            else if (k === 1) b[x] = '0';
            else if (k === 2) b[x] = b[x] === '1' ? '0' : '1';
            else if (depth < 4 && (k === 3 ? !a.includes(x) : a.includes(x))) {
              const a2 = k === 3 ? [...a, x].sort((p, r) => p - r) : a.filter(y => y !== x);
              for (const [b2, a3] of run([L.get(x)[SETS[k]]], b.join(''), a2, depth + 1)) nx.push([b2.split(''), a3]);
              continue;
            }
            nx.push([b, a]);
          }
          cur = nx;
        }
        for (const [b, a] of cur) next.push([b.join(''), a]);
      }
      outs = next;
    }
    return outs;
  };
  const chars = novaAll(game, 'chär'), zero = '0'.repeat(R.length);
  for (const c of chars.length ? chars : [{ onStart: '' }]) for (const [b, a] of run([c.onStart], zero, [])) push(b, a, 0, -1, null);
  // with no end, the goal is a mission of it that can still be taken, or one under way
  const takable = [];
  for (let si = 0; si < keys.length && !tooMany; si++) {
    if (si % 2000 === 1999) yield si;
    const [bits, as, bg] = keys[si].split('|'), active = as ? as.split(',').map(Number) : [], begun0 = +bg, begun = begun0 || 1;
    if (begun0 === 2) continue;   // an end reached: what follows is not searched
    if (!ends.size && (active.length || local.some(x => !x.never && !active.includes(x.id) && testIn(x.m.AvailBits, bits)))) takable[si] = 1;
    const go = (texts, ev, bgn, without) => { for (const [b, a] of run(texts, bits, without ? active.filter(y => y !== without) : active)) push(b, a, bgn, si, ev); };
    for (const { id, m, lands, fails, never, neutral } of local) {
      if (neutral && !active.includes(id)) {
        if (never || !testIn(m.AvailBits, bits)) continue;
        if (lands) push(bits, active, ends.has(id) ? 2 : begun, si, { what: 'complete', mission: id });
        if (ends.has(id) && (m.Flags & 1)) push(bits, active, 2, si, { what: 'ends by itself', mission: id });
        push(bits, active, begun, si, { what: 'escape pod', missions: [id] });
        if (!(m.Flags & 4)) push(bits, active, begun0, si, { what: 'refuse', mission: id });
        continue;
      }
      if (active.includes(id)) {
        if (lands) go([m.OnShipDone, m.OnSuccess], { what: 'complete', mission: id }, ends.has(id) ? 2 : begun, id);
        if (fails) go([m.OnFailure], { what: 'fail', mission: id }, begun, id);
        if (m.CanAbort) go([m.OnAbort], { what: 'abort', mission: id }, begun, id);
        if (m.Flags & 1) go([m.OnAbort], { what: 'ends by itself', mission: id }, ends.has(id) ? 2 : begun, id);
      } else if (active.length < maxActive && !never && testIn(m.AvailBits, bits)) {
        for (const [b, a] of run([m.OnAccept], bits, [...active, id].sort((p, r) => p - r))) push(b, a, begun, si, { what: 'accept', mission: id });
        if (!(m.Flags & 4)) go([m.OnRefuse], { what: 'refuse', mission: id }, begun0, null);
      }
    }
    for (const o of outside) if (testIn(o.test, bits)) go([o.steps], { what: 'other', label: o.label }, begun0, null);
    // an escape pod: every mission under way aborted, each running its OnAbort
    if (active.length) {
      let outs = [[bits, []]];
      for (const id of active) outs = outs.flatMap(([b, a]) => run([L.get(id).OnAbort], b, a));
      for (const [b] of outs) push(b, [], begun, si, { what: 'escape pod', missions: active });
    }
  }
  if (tooMany) return { tooMany: true, states: keys.length, ends: endList };
  // from which states an end can still be reached (backwards over the steps)
  const n = keys.length, head = new Int32Array(n).fill(-1), nxt = new Int32Array(eN);
  for (let e = 0; e < eN; e++) { nxt[e] = head[eTo[e]]; head[eTo[e]] = e; }
  const can = new Uint8Array(n), work = [];
  for (let i = 0; i < n; i++) if (ends.size ? keys[i].endsWith('|2') : takable[i]) { can[i] = 1; work.push(i); }
  while (work.length) { const i = work.pop(); for (let e = head[i]; e >= 0; e = nxt[e]) { const f = eFrom[e]; if (!can[f]) { can[f] = 1; work.push(f); } } }
  const path = i => { const p = []; for (let x = i; parent[x] >= 0; x = parent[x]) p.unshift(via[x]); return p; };
  const after = new Map();
  let stuck = 0;
  for (let i = 0; i < n; i++) {
    if (can[i] || !keys[i].endsWith('|1')) continue;
    stuck++;
    const p = path(i), last = [...p].reverse().find(e => e.what !== 'other');
    const k = last ? last.what + ' ' + (last.mission ?? last.missions.join('+')) : '?';
    if (!after.has(k)) after.set(k, { what: last ? last.what : '?', mission: last ? last.mission ?? null : null, missions: last ? last.missions || null : null, count: 0, path: p });
    after.get(k).count++;
  }
  return { ends: endList, bits: R, free: [...free].sort((x, y) => x - y), states: n, stuck, endReached: ends.size ? keys.some(k => k.endsWith('|2')) : null, after: [...after.values()].sort((x, y) => y.count - x.count) };
}

/* Bits a mission turns on when accepted that an escape pod during it may
   leave on for good: [{ mission, bit, never: [missions needing it off] }].
   The bit is on and the mission's OnAbort leaves it on; from a new game
   with the bit held on, nothing that can come about turns it off (so in a
   game where what would turn it off had not come about before, it stays
   on); and missions that need it off are offered otherwise. opts.bits:
   only these bits looked at (what is worked out is kept on reach). */
function novaHeldBits(game, reach, opts = {}) {
  const out = [], heldReach = reach.heldReach || (reach.heldReach = new Map()), stays = reach.heldStays || (reach.heldStays = new Map());
  for (const { mission, bit: b, never } of novaHeldCandidates(game, reach)) {
    if (opts.bits && !opts.bits.has(b)) continue;
    if (!stays.has(b)) {
      if (!heldReach.has(b)) heldReach.set(b, novaReach(game, { held: [b] }));
      const r = heldReach.get(b);
      // what turns it off, of all that can happen at any time (reach), that can happen with it held on (r)
      const happens = x => (x.mission !== undefined ? r.taken.has(x.mission) : x.kind ? r.happened[x.kind].has(x.id) : true);
      const test = x => (x.mission !== undefined && r.why.get(x.mission) !== 'offered' ? '' : x.test);
      stays.set(b, !novaSetSources(game, reach, new Set()).some(x => novaSetAny(x.text).some(o => o.n === b && (o.op === 'clear' || o.op === 'toggle')) && happens(x) && novaTestCan(test(x), r.may)));
    }
    if (stays.get(b)) out.push({ mission, bit: b, never });
  }
  return out;
}
// What novaHeldBits looks at: [{ mission, bit, never }], a bit every outcome of a mission's OnAccept
// turns on, its OnAbort leaves on, and other missions that can be offered need off (kept on reach).
function novaHeldCandidates(game, reach) {
  if (reach.heldCandidates) return reach.heldCandidates;
  const out = [], missions = novaAll(game, 'mïsn'), needOff = new Map();
  for (const m of missions) if (reach.offered.has(m.id)) for (const x of ncbTestNeeds(m.AvailBits || '')) if (!x.on) { if (!needOff.has(x.n)) needOff.set(x.n, []); needOff.get(x.n).push(m.id); }
  for (const m of missions) {
    if (!reach.taken.has(m.id)) continue;
    const onAccept = novaSetSteps(m.OnAccept);
    const bits = new Set(onAccept[0].filter(x => x.op === 'set').map(x => x.n));
    for (const o of onAccept.slice(1)) for (const n of [...bits]) if (!o.some(x => x.op === 'set' && x.n === n)) bits.delete(n);
    for (const b of bits) {
      if (!needOff.has(b) || novaSetAny(m.OnAbort).some(x => x.n === b && (x.op === 'clear' || x.op === 'toggle'))) continue;
      const never = needOff.get(b).filter(id => id !== m.id);
      if (never.length) out.push({ mission: m.id, bit: b, never });
    }
  }
  return (reach.heldCandidates = out);
}

/* Missions an escape pod can lose, and what goes with them: [{ mission,
   by: [missions starting it], bits: [{ bit, needed }], starts: [missions],
   end: storyline key or null }]. The mission is never offered, only
   started by an S, does not end on accepting (Flags 0x0001 with no ships
   and no ReturnStel), and its OnAbort starts nothing and turns nothing on;
   what goes: a bit its success (or its ships dealt with) alone turns on
   that offered missions need on, a mission never offered that its success
   alone starts, or the end of its storyline (novaStoryEnds). Whether what
   started it can be taken again is a question for the mission that starts it. opts.missions:
   only these looked at (what is read of the game is kept on reach). */
function novaPodLosses(game, reach, M, opts = {}) {
  const out = [], sources = novaSetSources(game, reach, new Set());
  if (!reach.pod) {
    const needOn = new Map(), setters = new Map(), starters = new Map(), endOf = new Map();
    for (const m of novaAll(game, 'mïsn')) if (reach.offered.has(m.id)) for (const x of ncbTestNeeds(m.AvailBits || '')) if (x.on) { if (!needOn.has(x.n)) needOn.set(x.n, []); needOn.get(x.n).push(m.id); }
    const add = (map, n, label) => { if (!map.has(n)) map.set(n, new Set()); map.get(n).add(label); };
    for (const s of sources) for (const x of novaSetAny(s.text)) { if (x.op === 'set' || x.op === 'toggle') add(setters, x.n, s.label); if (x.op === 'start') add(starters, x.n, s.label); }
    if (M) for (const st of M.stories.values()) for (const id of novaStoryEnds(game, st)) endOf.set(id, st.key);
    reach.pod = { needOn, setters, starters, endOf };
  }
  const { needOn, setters, starters, endOf } = reach.pod;
  for (const m of novaAll(game, 'mïsn')) {
    if ((opts.missions && !opts.missions.has(m.id)) || !reach.taken.has(m.id) || reach.offered.has(m.id)) continue;
    if ((m.Flags & 1) && !(m.ShipCount > 0) && m.ReturnStel === -1) continue;   // it ends on accepting
    if (novaSetAny(m.OnAbort).some(x => x.op === 'set' || x.op === 'toggle' || x.op === 'start')) continue;
    const mine = new Set([`OnSuccess of mïsn ${m.id}`, `OnShipDone of mïsn ${m.id}`]), only = l => [...(l || [])].every(x => mine.has(x));
    const done = [...novaSetAny(m.OnSuccess), ...novaSetAny(m.OnShipDone)];
    const bits = [...new Set(done.filter(x => x.op === 'set' && needOn.has(x.n) && only(setters.get(x.n))).map(x => x.n))].map(bit => ({ bit, needed: needOn.get(bit).filter(id => id !== m.id) })).filter(b => b.needed.length);
    const starts = [...new Set(done.filter(x => x.op === 'start' && x.n !== m.id && reach.taken.has(x.n) && !reach.offered.has(x.n) && only(starters.get(x.n))).map(x => x.n))];
    const end = endOf.get(m.id) || null;
    if (!bits.length && !starts.length && !end) continue;
    const by = [...new Set(sources.filter(s => s.mission !== undefined && novaSetAny(s.text).some(x => x.op === 'start' && x.n === m.id)).map(s => s.mission))];
    out.push({ mission: m.id, by, bits, starts, end });
  }
  return out;
}
