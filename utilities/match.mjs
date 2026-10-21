// Where the routines named in Mac 1.1.1 are in the programs of 1.0.2, 1.0.8
// and 1.0.10, which have no names: what utilities/routines_build.mjs writes into
// js/nova-routines.js and program_check compares that file with.
//
// 1.1.1 was built by GCC and 1.0.x by CodeWarrior, so no instruction is the
// same; what a routine does survives, and each is described by it, in order:
// the system calls it makes (by name), the routines it calls (GCC's jumps to
// one in place of a call too), the strings it loads, the numbers in its
// instructions (a pointer's step through a list among them, and a
// comparison's as either compiler writes it), the offsets of the record
// fields it reads and writes through a pointer, and what it hands back (a
// small number, a register, a call's result, or a value worked out).
// Each pair of routines is scored on all of that at once: how much of it the
// two share (each thing weighed by how rare it is in both programs), how
// alike their mix of instructions is, whether their sizes and numbers of
// calls are near enough (a call to a small routine that calls nothing not
// counted, since either compiler may have put its instructions in its place),
// how many of their callers and callees are matched to each other, and how
// often a matched pair's calls, aligned, put one beside the other. Pairs are
// accepted where each is the other's best by a margin, the clearest first,
// the bar lowered in steps, until none is left. A routine is kept only where
// the same match is made with the record fields, the strings or the system
// calls left out in turn, and with the numbers weighed half as much.
//
// 1.0.2 and 1.0.8 are CodeWarrior's too: their routines are matched to
// 1.0.10's first by being the same instructions once addresses are masked,
// then as above, and 1.1.1's names reach them through 1.0.10.

// A routine's description, in order: [{ k, v }], k one of I (a system call),
// C (a routine called), P (a routine's address taken), S (a string), N (a
// number), O (a record field reached through a pointer), R (what it hands back).
export function routineTokens(prog, r) {
  const out = [], os = prog.ops(r);
  // what is in r3 at os[i]: the last instruction before it that sets r3, or the
  // call whose result it is, and where that one is jumped over (CodeWarrior's
  // `b .+8; li r3, 0` before a shared return), the one before the jump as well
  const handed = i => {
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      const q = os[j].op;
      if (!q) return;
      const v = q.mn === 'li' && q.rd === 3 ? String(q.imm) : q.mn === 'mr' && q.ra === 3 ? 'reg' : null;
      if (v == null && (q.mn === 'lmw' || q.mn === 'mtlr' || (q.mn === 'addi' && q.rd === 1) || (q.mn === 'lwz' && q.ra === 1))) continue;
      if (v != null || q.rd === 3 || q.rt === 3) {
        out.push({ k: 'R', v: v ?? 'calc' });
        const b = j > 0 && os[j - 1].op;
        if (b && b.mn === 'b' && b.disp === 8) handed(j - 1);
        return;
      }
      if (q.lk && q.mn === 'bl') { out.push({ k: 'R', v: 'call' }); return; }
      if (/^b/.test(q.mn)) return;
    }
  };
  for (let i = 0; i < os.length; i++) if (os[i].op && os[i].op.mn === 'blr') handed(i);
  for (let i = 0; i < os.length; i++) {
    const o = os[i], op = o.op;
    if (!op) continue;
    // a jump to another routine's start in place of a call and a return (GCC's), as a call
    const tail = o.target == null && op.mn === 'b' && op.disp !== undefined && prog.byStart.get(o.addr + op.disp);
    if (o.target != null || (tail && tail.start !== r.start)) {
      const t = prog.byStart.get(o.target ?? tail.start);
      out.push(t.glue ? { k: 'I', v: t.name } : { k: o.pointer ? 'P' : 'C', v: t.start });
      continue;
    }
    if (o.text != null) { out.push({ k: 'S', v: o.text }); continue; }
    if (typeof o.value === 'number' && Number.isInteger(o.value) && o.data == null) { out.push({ k: 'N', v: o.value | 0 }); continue; }
    if (op.mn === 'cmpwi' || op.mn === 'cmplwi') { for (const v of testsGreater(os, i, op.crf) ? [op.imm, op.imm + 1] : [op.imm]) if (Math.abs(v) >= 3) out.push({ k: 'N', v }); continue; }
    if (op.mn === 'li' || (op.mn === 'addi' && op.ra === 0)) { if (Math.abs(op.imm) >= 3) out.push({ k: 'N', v: op.imm }); continue; }
    if (op.mn === 'addi' && op.rd === op.ra && op.ra > (prog.kind === 'pef' ? 2 : 1) && Math.abs(op.imm) >= 16) { out.push({ k: 'N', v: op.imm }); continue; }
    if (op.mn === 'mulli') { out.push({ k: 'N', v: op.imm }); continue; }
    if (o.data == null && op.d !== undefined && op.ra > 2 && op.d >= 8 && /^(l|st)[bhwf]/.test(op.mn) && !/mw$/.test(op.mn))
      out.push({ k: 'O', v: op.mn[0] + (op.mn.includes('f') ? 'f' : '') + op.d });
  }
  return out;
}

// Whether the comparison at os[i] is tested by the greater-than bit: `x < 2048`
// is GCC's `cmpwi x, 2047` and a test of greater, CodeWarrior's `cmpwi x, 2048`
// and a test of less, so a number tested so is taken with the next one too
// (only the next one would lose a loop GCC ends by a test of equal).
function testsGreater(os, i, crf) {
  for (let j = i + 1; j < Math.min(os.length, i + 6); j++) {
    const q = os[j].op;
    if (q && q.conditional && q.bi !== undefined && q.bi >> 2 === crf) return (q.bi & 3) === 1;
  }
  return false;
}

// Each routine of a program described, with its calls both ways and its mix of instructions.
export function prepare(prog) {
  const rs = prog.routines.filter(r => !r.glue);
  const T = new Map(), callees = new Map(), callersOf = new Map(), mix = new Map();
  for (const r of rs) {
    const t = routineTokens(prog, r);
    T.set(r.start, t);
    const cs = t.filter(x => x.k === 'C' || x.k === 'P').map(x => x.v);
    callees.set(r.start, cs);
    for (const c of new Set(cs)) { if (!callersOf.has(c)) callersOf.set(c, []); callersOf.get(c).push(r.start); }
    const h = new Float64Array(8);
    for (const o of prog.ops(r)) {
      const mn = o.op ? o.op.mn : '';
      const c = /^(stmw|lmw|mflr|mtlr)$/.test(mn) ? -1 : /^l[bhw]/.test(mn) ? 0 : /^st[bhw]/.test(mn) ? 1 : /^(lf|stf)/.test(mn) ? 2 : /^f/.test(mn) ? 3
        : /^b/.test(mn) ? 4 : /^cmp/.test(mn) ? 5 : /^(rlw|sl|sr|and|or|xor|neg|ext)/.test(mn) ? 6 : 7;
      if (c >= 0) h[c]++;
    }
    mix.set(r.start, h);
  }
  return { prog, rs, T, callees, callersOf, mix };
}

const key = x => x.k === 'S' ? 'S' + x.v.replace(/\s+/g, ' ').trim() : 'IONR'.includes(x.k) ? x.k + x.v : null;

// The routines of PA matched to PB's: Map(start in A -> start in B).
// opts.seed: pairs taken as matched; opts.weights: each kind's weight.
export function matchRoutines(PA, PB, opts = {}) {
  const W = Object.assign({ S: 1.5, I: 1, O: 0.6, N: 0.7, R: 1 }, opts.weights || {});
  const df = new Map(), bag = new Map();
  for (const P of [PA, PB]) for (const r of P.rs) {
    const m = new Map();
    for (const x of P.T.get(r.start)) { const k = key(x); if (k) m.set(k, (m.get(k) || 0) + 1); }
    bag.set((P === PA ? 'a' : 'b') + r.start, m);
    for (const k of m.keys()) df.set(k, (df.get(k) || 0) + 1);
  }
  const N = PA.rs.length + PB.rs.length;
  const w = k => Math.log(N / (df.get(k) || 1)) * W[k[0]];
  const vec = id => { const v = new Map(); let n = 0; for (const [k, c] of bag.get(id)) { const x = w(k) * (1 + Math.log(c)); v.set(k, x); n += x * x; } return { v, n: Math.sqrt(n) }; };
  const VA = new Map(PA.rs.map(r => [r.start, vec('a' + r.start)])), VB = new Map(PB.rs.map(r => [r.start, vec('b' + r.start)]));
  const inv = new Map();
  for (const [s, { v }] of VB) for (const k of v.keys()) { if (!inv.has(k)) inv.set(k, []); inv.get(k).push(s); }
  const sim = (a, b) => { const x = VA.get(a), y = VB.get(b); if (!x.n || !y.n) return 0; let d = 0; for (const [k, v] of x.v) { const u = y.v.get(k); if (u) d += v * u; } return d / (x.n * y.n); };
  const lenA = a => PA.prog.byStart.get(a).len, lenB = b => PB.prog.byStart.get(b).len;
  const sizeOk = (a, b) => { const x = lenA(a), y = lenB(b), q = Math.max(x, y) / Math.max(1, Math.min(x, y)); return q <= (Math.min(x, y) < 160 ? 2.5 : 1.8); };
  const mixSim = (a, b) => { const x = PA.mix.get(a), y = PB.mix.get(b); let d = 0, nx = 0, ny = 0; for (let i = 0; i < 8; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; } return nx && ny ? d / Math.sqrt(nx * ny) : 0; };
  // calls, except those to a small routine that calls nothing, which one compiler may have put in place of the call
  const inlined = (P, t) => { const r = P.prog.byStart.get(t); return r && r.len <= 64 && !(P.callees.get(t) || []).length; };
  const nCalls = (P, x) => P.T.get(x).filter(t => t.k === 'I' || (t.k === 'C' && !inlined(P, t.v))).length;
  const shared = new Map();
  for (const r of PA.rs) { const seen = new Set(); for (const k of VA.get(r.start).v.keys()) { const l = inv.get(k); if (l && l.length < 60) for (const b of l) seen.add(b); } shared.set(r.start, seen); }

  const M = new Map(), MB = new Map();
  const add = (a, b) => { if (M.has(a) || MB.has(b)) return false; M.set(a, b); MB.set(b, a); return true; };
  if (opts.seed) for (const [a, b] of opts.seed) add(a, b);

  // a matched pair's calls and strings aligned: an unmatched routine called by one beside one called by the other
  const same = (x, y) => {
    if (x.k === 'I' && y.k === 'I') return x.v === y.v ? 1 : 0;
    if ((x.k === 'C' || x.k === 'P') && (y.k === 'C' || y.k === 'P')) return M.has(x.v) ? (M.get(x.v) === y.v ? 1 : 0) : (!MB.has(y.v) ? 0.3 : 0);
    if (x.k === 'S' && y.k === 'S') return key(x) === key(y) ? 1 : 0;
    return 0;
  };
  const calls = t => t.filter(x => 'ICPS'.includes(x.k));
  function besides(a, b) {
    const xs = calls(PA.T.get(a)), ys = calls(PB.T.get(b)), n = xs.length, m = ys.length, out = [];
    if (!n || !m || n * m > 4e6) return out;
    const D = Array.from({ length: n + 1 }, () => new Float32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) { const e = same(xs[i], ys[j]); D[i][j] = Math.max(D[i + 1][j], D[i][j + 1], e ? D[i + 1][j + 1] + e : -1); }
    let i = 0, j = 0;
    while (i < n && j < m) {
      const e = same(xs[i], ys[j]);
      if (e && Math.abs(D[i][j] - (D[i + 1][j + 1] + e)) < 1e-4) { if (e < 1) out.push([xs[i].v, ys[j].v]); i++; j++; }
      else if (D[i + 1][j] >= D[i][j + 1]) i++; else j++;
    }
    return out;
  }

  for (const [bar, margin] of [[3.0, 1.0], [2.2, 0.8], [1.6, 0.6], [1.2, 0.5], [0.9, 0.4]]) {
    for (let round = 0; round < 20; round++) {
      const place = new Map();
      for (const [a, b] of M) for (const [x, y] of besides(a, b)) if (!M.has(x) && !MB.has(y)) { const k = x + ':' + y; place.set(k, (place.get(k) || 0) + 1); }
      const cands = new Map();
      const cand = (a, b) => { if (M.has(a) || MB.has(b)) return; if (!cands.has(a)) cands.set(a, new Set()); cands.get(a).add(b); };
      for (const r of PA.rs) if (!M.has(r.start)) for (const b of shared.get(r.start)) cand(r.start, b);
      for (const k of place.keys()) { const [x, y] = k.split(':').map(Number); cand(x, y); }
      for (const [a, b] of M) {
        const ca = (PA.callersOf.get(a) || []).filter(x => !M.has(x)), cb = (PB.callersOf.get(b) || []).filter(y => !MB.has(y));
        if (ca.length * cb.length <= 400) for (const x of ca) for (const y of cb) cand(x, y);
        const ea = [...new Set(PA.callees.get(a))].filter(x => !M.has(x)), eb = [...new Set(PB.callees.get(b))].filter(y => !MB.has(y));
        if (ea.length * eb.length <= 400) for (const x of ea) for (const y of eb) cand(x, y);
      }
      const score = (a, b) => {
        if (!sizeOk(a, b)) return -1;
        let s = 2 * sim(a, b) + 1.5 * (mixSim(a, b) - 0.85) + (place.get(a + ':' + b) || 0);
        s -= 0.8 * Math.abs(Math.log((nCalls(PA, a) + 1) / (nCalls(PB, b) + 1)));
        const cb = new Set(PB.callees.get(b)), rb = new Set(PB.callersOf.get(b) || []);
        let agree = 0, disagree = 0;
        for (const x of new Set(PA.callees.get(a))) if (M.has(x)) { if (cb.has(M.get(x))) agree++; else disagree++; }
        for (const x of PA.callersOf.get(a) || []) if (M.has(x)) { if (rb.has(M.get(x))) agree++; else disagree++; }
        return s + 0.8 * agree - 0.4 * disagree;
      };
      const bestA = new Map(), bestB = new Map();
      const keep = (m, k, o, s) => { const u = m.get(k) || { o: null, s: -1, s2: 0 }; if (s > u.s) { u.s2 = Math.max(u.s2, u.s); u.s = s; u.o = o; } else u.s2 = Math.max(u.s2, s); m.set(k, u); };
      for (const [a, bs] of cands) for (const b of bs) { const s = score(a, b); if (s > 0) { keep(bestA, a, b, s); keep(bestB, b, a, s); } }
      let added = 0;
      for (const [a, u] of bestA) { const v = bestB.get(u.o); if (v.o === a && u.s >= bar && u.s - Math.max(u.s2, v.s2) >= margin && add(a, u.o)) added++; }
      if (!added) break;
    }
  }
  return M;
}

// A CodeWarrior routine's instructions with branch targets and TOC offsets masked.
export function routineShape(prog, r) {
  return prog.ops(r).map(o => {
    const w = o.word, top = w >>> 26;
    if (top === 18) return (w & 0xFC000003) >>> 0;
    if (top === 16) return (w & 0xFFFF0003) >>> 0;
    if (o.op && o.op.ra === 2 && o.op.d !== undefined) return (w & 0xFFFF0000) >>> 0;
    return w;
  }).join(',');
}

// Two CodeWarrior builds: the same instructions first, then as above.
export function matchBuilds(PB, PC) {
  const hb = new Map(), hc = new Map();
  for (const r of PB.rs) { const h = routineShape(PB.prog, r); hb.set(h, hb.has(h) ? null : r.start); }
  for (const r of PC.rs) { const h = routineShape(PC.prog, r); hc.set(h, hc.has(h) ? null : r.start); }
  const seed = [];
  for (const [h, s] of hb) if (s != null && hc.get(h) != null) seed.push([s, hc.get(h)]);
  return matchRoutines(PB, PC, { seed });
}

export const MATCH_VARIANTS = [{}, { weights: { O: 0 } }, { weights: { S: 0 } }, { weights: { I: 0 } }, { weights: { N: 0.35 } }];

// The named routines' places: { names, releases: [[version, code length, Map(name -> address)]] }.
// mac: 1.1.1's program; pefs: [[version, program]], 1.0.10 first.
export function routinePlaces(S, mac, pefs, names) {
  const PA = prepare(mac), [[v10, p10], ...rest] = pefs, P10 = prepare(p10);
  const runs = MATCH_VARIANTS.map(o => matchRoutines(PA, P10, o));
  const at10 = new Map();
  for (const n of names) {
    const r = S.novaRoutineNamed(mac, n), b = r ? runs[0].get(r.start) : undefined;
    if (b !== undefined && runs.every(m => m.get(r.start) === b)) at10.set(n, b);
  }
  const releases = [[v10, p10.code.length, at10]];
  for (const [v, p] of rest) {
    const M = matchBuilds(P10, prepare(p)), at = new Map();
    for (const [n, b] of at10) if (M.has(b)) at.set(n, M.get(b));
    releases.push([v, p.code.length, at]);
  }
  return releases;
}

// The routine names cited on a page: the field notes' routines and the rules'.
export function citedRoutines(S) {
  const cited = new Set();
  for (const t of Object.values(S.NOVA_FIELD_NOTES)) for (const f of Object.values(t)) for (const [n] of f.code) cited.add(n);
  for (const r of S.NOVA_RULES) cited.add(r[3]);
  return [...cited].sort();
}

// js/nova-routines.js as it should be.
export function routinesFile(releases) {
  const order = [...releases].sort((a, b) => a[1] - b[1]);
  const names = [...new Set(order.flatMap(([, , at]) => [...at.keys()]))].sort();
  const hex = v => '0x' + v.toString(16);
  return `/* nova-routines.js -- written by utilities/routines_build.mjs, whose comments give
   how the routines were matched; run it after changing which routines the
   field notes (js/nova-fields.js) or the rules (js/nova-rules.js) cite.
   =========================================================================

   Where each routine the field notes and the rules cite, by the name Mac
   1.1.1 gives it, is in the programs of 1.0.2, 1.0.8 and 1.0.10, which have
   no names: NOVA_ROUTINES.releases is each release and the length of its
   program's code, by which the page identifies it; NOVA_ROUTINES.at[name] is the
   routine's address in each, in that order, 0 where it was not matched.
   program_check fails while this is not what the matcher gives. */

const NOVA_ROUTINES = {
  releases: [${order.map(([v, n]) => `['${v}', ${n}]`).join(', ')}],
  at: {
${names.map(n => `    ${/^[A-Za-z_$][\w$]*$/.test(n) ? n : JSON.stringify(n)}: [${order.map(([, , at]) => at.has(n) ? hex(at.get(n)) : '0').join(', ')}],`).join('\n')}
  },
};
`;
}
