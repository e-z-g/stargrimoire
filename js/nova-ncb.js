/* nova-ncb.js -- control-bit test expressions: read one, and say whether it
   holds for a given state.
   =========================================================================

   The Nova Bible ("A quick word about control bits") gives the terms and
   operators, capitalisation not mattering:

     Bxxx  control bit xxx, b0 to b9999
     Pxxx  registered, or unregistered for fewer than xxx days
     G     the player's gender, 1 male, 0 female
     Oxxx  the player has at least one of outfit id xxx
     Exxx  the player has explored system id xxx
     | & ! ( )

   and says an empty expression is true, and that the evaluator "may do
   unpredictable things" with `b1 & b2 | b3`. ncbParseTest reads a test as
   written, left to right where & and | mix (`mixed: true`); ncbTest,
   ncbGameTree and ncbCompile read it as Mac 1.1.1 does (ncbRead), which
   differs from the written reading for a run of three bare terms or more,
   a lone number and a few other things. No shipped test the parser reads
   is read otherwise by the game; seven malformed ones are, among them
   1.0.8 to 1.1.1's mïsn 428 (`ncbAsWritten`).

   A state is { bits: Set of numbers, registered, male, outfits: Set of ids,
   explored: Set of system ids }; any of them may be left out, and a term
   whose part is missing reads as 0 -- except P, which reads as 1, the game
   treated as registered.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: anywhere; it uses nothing. */

/* Parse into a tree: { op: 'or'|'and', args } | { op: 'not', arg } |
   { op: 'term', letter, n } | { op: 'true' }. Throws on anything else,
   with where. */
function ncbParseTest(text) {
  const s = String(text || '');
  let p = 0, mixed = false;
  const ws = () => { while (p < s.length && /\s/.test(s[p])) p++; };
  const fail = what => { throw new Error(`control-bit test "${s}": ${what} at character ${p + 1}`); };
  function primary() {
    ws();
    const c = s[p];
    if (c === '!') { p++; return { op: 'not', arg: primary() }; }
    if (c === '(') {
      p++;
      const e = expr();
      ws();
      if (s[p] !== ')') fail('expected )');
      p++;
      return e;
    }
    const m = /^([BbPpOoEe])\s*(\d+)|^([Gg])(?![A-Za-z0-9])/.exec(s.slice(p));
    if (!m) fail(c === undefined ? 'unexpected end' : `unexpected "${c}"`);
    p += m[0].length;
    return m[3] ? { op: 'term', letter: 'G', n: null } : { op: 'term', letter: m[1].toUpperCase(), n: +m[2] };
  }
  function expr() {
    const first = primary();
    const args = [first];
    let kind = null;
    for (;;) {
      ws();
      const c = s[p];
      if (c !== '&' && c !== '|') break;
      p++;
      const k = c === '&' ? 'and' : 'or';
      if (kind && kind !== k) mixed = true;
      if (kind && kind !== k) { const left = { op: kind, args: args.splice(0) }; args.push(left); }
      kind = k;
      args.push(primary());
    }
    return kind ? { op: kind, args } : first;
  }
  ws();
  if (p >= s.length) return { tree: { op: 'true' }, mixed: false };
  const tree = expr();
  ws();
  if (p < s.length) fail(`unexpected "${s[p]}"`);
  return { tree, mixed };
}

function ncbEval(tree, state) {
  const st = state || {};
  switch (tree.op) {
    case 'true': return true;
    case 'false': return false;
    case 'game': return ncbTest(tree.text, st);
    case 'not': return !ncbEval(tree.arg, st);
    case 'and': return tree.args.every(a => ncbEval(a, st));
    case 'or': return tree.args.some(a => ncbEval(a, st));
    case 'term':
      switch (tree.letter) {
        case 'B': return !!(st.bits && st.bits.has(tree.n));
        case 'P': return st.registered !== false;
        case 'G': return !!st.male;
        case 'O': return !!(st.outfits && st.outfits.has(tree.n));
        case 'E': return !!(st.explored && st.explored.has(tree.n));
      }
  }
  throw new Error('not a control-bit test tree');
}

/* Mac 1.1.1's reading of a test: EvalMissionBitTestString, EvalTestExp and
   GetToken, step for step, over values that `A` makes and combines -- 0 and
   1 for a state (ncbTest), or trees (ncbGameTree).

   The game keeps two values along a run of terms, the result so far and
   the last term's. At every & or | the result becomes the last term's, so
   in a run of bare terms only the last two count: `b1 & b2 & b3` holds
   whenever b2 and b3 do, whatever b1 is. A bracketed term instead folds
   into the last term's value, so `(b1 & b2) & b3` reads as written. A
   test that does not start with b, (, !, p, g, o or e (either case) is
   false; an empty one is true; a lone number, or a character the game does
   not know, is passed over; a second ! before a term is the first again.
   Two forms the Bible leaves out: `[t t ...]` counts the terms that hold
   (each closing bracket inside brackets ends the level, where the game
   then reads on from), and a count followed by <, > or = and a number
   compares the two. */
function ncbRead(text, A) {
  const src = String(text || '');
  if (!src.length) return A.T;
  if (!'bB(!PpGgOoEe'.includes(src[0])) return A.F;
  // the copy the game reads, a space put between two ('s
  let buf = '', prev = ' ';
  for (const ch of src) { if (ch === '(' && prev === '(') buf += ' '; buf += ch; prev = ch; }
  const len = buf.length, i16 = v => (v << 16) >> 16;
  let pos = 0, num = 0;
  const digits = () => { let n = 0; while (pos < len && buf[pos] >= '0' && buf[pos] <= '9') n = i16(n * 10 + (buf.charCodeAt(pos++) - 48)); return n; };
  // a token: a bracket, !, & or | (a run of them), <, > or =, a term's value, '#' for a number, '?' for anything else
  function token() {
    const c = buf[pos];
    if ('()[]!'.includes(c)) { pos++; return c; }
    if (c === '&' || c === '|') { while (buf[pos] === c) pos++; return c; }
    if (c === 'P' || c === 'p') { pos++; return { v: A.term('P', digits()) }; }
    if (c === 'G' || c === 'g') { pos++; return { v: A.term('G', null) }; }
    if (c === '<' || c === '>' || c === '=') { pos++; return c; }
    if (c === 'B' || c === 'b') { pos++; const n = digits(); return { v: n <= 9999 ? A.term('B', n) : A.F }; }
    if (c === 'O' || c === 'o') { pos++; const n = digits(); return { v: ((n - 128) & 0xffff) <= 0x1ff ? A.term('O', n) : A.F }; }
    if (c === 'E' || c === 'e') { pos++; const n = digits(); return { v: ((n - 128) & 0xffff) <= 0x7ff ? A.term('E', n) : A.F }; }
    if (c >= '0' && c <= '9') { num = digits(); return '#'; }
    pos++;
    return '?';
  }
  function exp() {
    const c = buf[pos];
    // where this level ends: before the bracket closing it, or the end
    let opens = c !== '(' && c !== '[' ? 1 : 0, closes = 0, i = pos, end = null;
    for (; i < len; i++) {
      const ch = buf[i];
      if (ch === '(' || ch === '[') opens++;
      else if (ch === ')' || ch === ']') closes++;
      if (closes === opens) { end = i === 0 ? 0 : i - 1; break; }
    }
    if (end === null) end = i;
    let result = A.T, cur = A.F, neg = false, count = 0, op = '?', counted = false;
    while (pos < len) {
      if (buf[pos] === ' ') { while (pos < len && buf[pos] === ' ') pos++; continue; }
      const tok = token();
      if (tok === '(' || tok === '[') {
        let v = exp();
        if (neg) { v = A.not(v); neg = false; }
        if (op === '&' || op === '|') [result, cur] = A.group(op, result, cur, v);
        else cur = v;
      } else if (tok === ']') { result = A.count(count); counted = true; break; }
      else if (tok === ')') break;
      else if (typeof tok === 'object') {
        const v = neg ? A.not(tok.v) : tok.v;
        neg = false;
        count = A.tally(count, v);
        if (op === '|') result = A.or(result, v);
        else if (op === '&') result = A.and(result, v);
        cur = v;
      }
      else if (tok === '|' || tok === '&') { result = cur; op = tok; }
      else if (tok === '<' || tok === '>' || tok === '=') { op = tok; result = A.F; }
      else if (tok === '#') { if (op === '<' || op === '>' || op === '=') result = A.compare(op, cur, num); }
      else if (tok === '!') neg = true;
    }
    if (!counted && op === '?') result = cur;
    pos = end + 2;
    return result;
  }
  return exp();
}

/* Whether a test holds for a state ({ bits, registered, days, male,
   outfits, explored }; a part left out reads as 0, but registered as
   true), as the game reads it (ncbRead). */
function ncbTest(text, state) {
  const st = state || {};
  const i16 = v => (v << 16) >> 16;
  return ncbRead(text, {
    T: 1, F: 0,
    term(letter, n) {
      switch (letter) {
        case 'B': return st.bits && st.bits.has(n) ? 1 : 0;
        case 'P': return st.registered !== false || (st.days || 0) < n ? 1 : 0;
        case 'G': return st.male ? 1 : 0;
        case 'O': return st.outfits && st.outfits.has(n) ? 1 : 0;
        case 'E': return st.explored && st.explored.has(n) ? 1 : 0;
      }
    },
    not: v => (v === 0 ? 1 : 0),
    and: (a, b) => (b ? a : 0),
    or: (a, b) => (b ? 1 : a),
    // a bracketed value after & or |: [result, last]
    group: (op, result, cur, v) => (op === '&' ? (v !== 0 ? [cur, cur] : [0, 0]) : (v === 1 ? [1, 1] : [cur, cur])),
    tally: (count, v) => count + v,
    count: n => i16(n),
    compare: (op, cur, n) => ((op === '<' ? cur < n : op === '>' ? cur > n : cur === n) ? 1 : 0),
  }) === 1;
}

/* The game's reading of a test as a tree for ncbEval, or null where it
   counts or compares, which a tree cannot say. */
function ncbGameTree(text) {
  const T = { op: 'true' }, F = { op: 'false' };
  const join = (kind, unit, zero) => (a, b) => (a === zero || b === zero ? zero : a === unit ? b : b === unit ? a :
    { op: kind, args: [...(a.op === kind ? a.args : [a]), ...(b.op === kind ? b.args : [b])] });
  const and = join('and', T, F), or = join('or', F, T);
  const not = v => (v === T ? F : v === F ? T : v.op === 'not' ? v.arg : { op: 'not', arg: v });
  const none = () => { throw ncbGameTree; };
  try {
    return ncbRead(text, {
      T, F,
      term: (letter, n) => ({ op: 'term', letter, n }),
      not, and, or,
      group: (op, result, cur, v) => { const x = op === '&' ? and(cur, v) : or(cur, v); return [x, x]; },
      tally: count => count,
      count: none, compare: none,
    });
  } catch (e) { if (e === ncbGameTree) return null; throw e; }
}

/* A test made ready to evaluate often, as the game reads it: its game tree,
   or where that cannot be had, { op: 'game', text }, which ncbEval reads
   with ncbTest. */
function ncbCompile(text) {
  return ncbGameTree(text) || { op: 'game', text: String(text || '') };
}

/* Whether the game reads a test as it is written: { same, game, written },
   the trees, `written` null where the test does not parse, `game` null where
   ncbGameTree cannot say. Same is decided by every state of the test's terms,
   up to 14 of them. */
function ncbAsWritten(text) {
  let written = null;
  try { written = ncbParseTest(text).tree; } catch (e) { /* the game reads it anyway */ }
  const game = ncbGameTree(text);
  if (!written) return { same: false, game, written };
  const terms = [];
  const walk = t => { if (t.op === 'term' && !terms.some(u => u.letter === t.letter && u.n === t.n)) terms.push(t); if (t.arg) walk(t.arg); if (t.args) t.args.forEach(walk); };
  walk(written);
  if (terms.length > 14) return { same: null, game, written };
  for (let m = 0; m < 1 << terms.length; m++) {
    const st = { bits: new Set(), outfits: new Set(), explored: new Set(), male: false, registered: true };
    terms.forEach((t, i) => {
      if (!(m >> i & 1)) return;
      if (t.letter === 'G') st.male = true;
      else if (t.letter === 'P') st.registered = true;
      else ({ B: st.bits, O: st.outfits, E: st.explored })[t.letter].add(t.n);
    });
    // P reads as 1 here, registered; unregistered it is a count of days
    if (ncbTest(text, st) !== ncbEval(written, st)) return { same: false, game, written };
  }
  return { same: true, game, written };
}

/* A tree as text, brackets only where they are needed. */
function ncbTreeText(t, inside) {
  switch (t.op) {
    case 'true': return 'always';
    case 'false': return 'never';
    case 'term': return t.letter.toLowerCase() + (t.n === null ? '' : t.n);
    case 'not': return '!' + ncbTreeText(t.arg, true);
    default: { const s = t.args.map(a => ncbTreeText(a, true)).join(t.op === 'and' ? ' & ' : ' | '); return inside ? `(${s})` : s; }
  }
}

/* The bits a test mentions, ascending: what a page offers to toggle. */
function ncbTestBits(text) {
  const out = new Set();
  const walk = t => {
    if (t.op === 'term' && t.letter === 'B') out.add(t.n);
    if (t.arg) walk(t.arg);
    if (t.args) t.args.forEach(walk);
  };
  walk(ncbParseTest(text).tree);
  return [...out].sort((a, b) => a - b);
}

/* A set of bits from what a person types: "b147 b305", "147, 305". */
function ncbBitsFromText(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/\d+/g)) { const n = +m[0]; if (n < 10000) out.add(n); }
  return out;
}
