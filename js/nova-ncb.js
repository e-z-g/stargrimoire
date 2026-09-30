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
   unpredictable things" with `b1 & b2 | b3`. How the program reads that has
   not been looked at, and none of the 878 test expressions in 1.1.1's data
   mixes the two at one level without parentheses; an expression that does
   is read left to right here and comes back with `mixed: true`, so a page
   can say it is unsure rather than seem to know.

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

/* Whether an expression holds, from its text. */
function ncbTest(text, state) {
  return ncbEval(ncbParseTest(text).tree, state);
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
