/* mac-ppc.js -- PowerPC instructions, read.

   A PowerPC application's code is a run of 32-bit big-endian words, one
   instruction each, and this turns a word into what it does: a mnemonic,
   its operands, and the fields a reader wants to test (the register, the
   constant, the branch displacement). Nothing here knows Cythera exists;
   this is the mac-* tier, beside the PEF container reader it serves.

   ppcDecode(word)  -> { mn, args, text, word, and the fields } or null

   WHY IT EXISTS. The site states rules the game's executable decides -- the
   clock's hour, how often a fed character heals, how long a talk balloon
   stays up -- and until 11 September 2026 every one of those figures was
   typed into the page from a trace made outside it. A figure typed from a
   trace is a copy of the program's bytes that nobody can follow back, so
   the page reads the instruction that holds each one instead, and links to
   it. That needs instructions, and this is them.

   THE SPELLING IS LLVM'S. `utilities/ppc_check.mjs` hands the same words
   here and to LLVM's PowerPC disassembler (`llvm-mc --disassemble
   --triple=powerpc`, one word a line) -- every word of the application's
   code section, every combination of the branch fields, every
   special-purpose register, and 300,000 generated words -- and requires
   every word both read to read the same, so the text follows LLVM's
   choices: `li` for an addi from r0, `mr` for an or of a register with
   itself, `slwi`, `srwi`, `rotlwi` and `clrlwi` for the rotates that are
   those, `bt` and `bf` for a conditional branch on one bit with the later
   architecture's `-` and `+` hints, `sub` and `subc` for subf and subfc
   with the operands turned round, `crmove`, `crnot`, `crclr` and `crset`,
   the register names LLVM knows, `.+n` and `.-n` for a displacement. The
   two were written separately -- this one from the PowerPC architecture's
   field layouts, LLVM's from its own tables -- which is what makes the
   agreement evidence. The spellings were settled by failing the check, not
   by reading LLVM's source.

   WHAT IT READS. The 32-bit instructions a classic Mac application's
   compiler emits: the integer, branch, rotate, load and store and
   floating-point forms. A word it does not read answers null -- a word
   whose reserved bits are set, and every instruction of the 64-bit, vector
   and later architectures, which in Cythera's code section is data (a
   traceback table, a string). The check allows LLVM to read what this
   does not and counts it, and fails the other way round: this never reads
   a word LLVM refuses, and every word inside a routine is read. A few
   32-bit instructions no compiler of the period emitted for an
   application (the byte-reversed loads, the string moves, fmadd, fsel, the
   segment-register ones) are among the unread; add one here and the check
   will say whether it was spelt LLVM's way. */

function ppcSext16(v) { return (v & 0x8000) ? v - 0x10000 : v; }
function ppcRel(d) { return '.' + (d < 0 ? '-' + (-d) : '+' + d); }

// The special-purpose registers LLVM names in mfspr and mtspr, which are the
// 32-bit architecture's and some of its successors' and embedded cousins';
// the three a Mac application touches are the first three. Four more are
// named one way only, and the BATs take their number as an operand.
const PPC_SPR_NAMES = { 1: 'xer', 8: 'lr', 9: 'ctr', 3: 'udscr', 13: 'uamr', 17: 'dscr', 18: 'dsisr', 19: 'dar', 22: 'dec',
  25: 'sdr1', 26: 'srr0', 27: 'srr1', 28: 'cfar', 29: 'amr', 280: 'asr', 512: 'spefscr', 896: 'ppr', 980: 'esr', 981: 'dear',
  986: 'tcr', 988: 'tbhi', 989: 'tblo', 990: 'srr2', 991: 'srr3', 1018: 'dccr', 1019: 'iccr' };
const PPC_SPR_FROM_ONLY = { 4: 'rtcu', 5: 'rtcl', 287: 'pvr' }, PPC_SPR_TO_ONLY = { 284: 'tbl', 285: 'tbu' };
// The trap conditions LLVM names: tw and twi with these TO fields.
const PPC_TRAP = { 1: 'lgt', 2: 'llt', 4: 'eq', 8: 'gt', 16: 'lt', 24: 'ne', 31: 'u' };

function ppcDecode(word) {
  const w = word >>> 0;
  const op = w >>> 26;
  const a = (w >>> 21) & 31, b = (w >>> 16) & 31, c = (w >>> 11) & 31;
  const uimm = w & 0xFFFF, simm = ppcSext16(uimm);
  const rc = w & 1;
  const R = (mn, args, fields) => Object.assign({ mn, args, text: mn + (args.length ? ' ' + args.join(', ') : ''), word: w, op }, fields || {});
  const mem = (mn) => R(mn, [a + '', simm + '(' + b + ')'], { rt: a, ra: b, d: simm });
  switch (op) {
    case 3: return PPC_TRAP[a] ? R('tw' + PPC_TRAP[a] + 'i', [b, simm], { ra: b, imm: simm }) : R('twi', [a, b, simm], { ra: b, imm: simm });
    case 7: return R('mulli', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 8: return R('subfic', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 10: case 11: {
      const crf = (w >>> 23) & 7, L = (w >>> 21) & 1;
      if (L || (w >>> 22) & 1) return null;                       // 64-bit compares, and a reserved bit
      const unsigned = op === 10, imm = unsigned ? uimm : simm;
      const mn = unsigned ? 'cmplwi' : 'cmpwi';
      return R(mn, crf ? [crf, b, imm] : [b, imm], { crf, ra: b, imm });
    }
    case 12: return R('addic', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 13: return R('addic.', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 14: return b === 0 ? R('li', [a, simm], { rd: a, ra: 0, imm: simm }) : R('addi', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 15: return b === 0 ? R('lis', [a, simm], { rd: a, ra: 0, imm: simm }) : R('addis', [a, b, simm], { rd: a, ra: b, imm: simm });
    case 16: return ppcDecodeBc(w, a, b);
    case 17: {
      if ((w & 0x03FFF01D) !== 0 || !(w & 2)) return null;           // reserved bits
      const lev = (w >>> 5) & 0x7F;
      return R('sc', lev ? [lev] : [], {});
    }
    case 18: {
      let li = w & 0x03FFFFFC; if (li & 0x02000000) li -= 0x04000000;
      const aa = (w >>> 1) & 1, lk = w & 1;
      const mn = 'b' + (lk ? 'l' : '') + (aa ? 'a' : '');
      return R(mn, [aa ? '0x' + (li >>> 0).toString(16) : ppcRel(li)], { disp: li, aa, lk, branch: true });
    }
    case 19: return ppcDecode19(w, a, b, c);
    case 20: {
      const sh = c, mb = (w >>> 6) & 31, me = (w >>> 1) & 31;
      return R('rlwimi' + (rc ? '.' : ''), [b, a, sh, mb, me], { ra: b, rs: a, sh, mb, me });
    }
    case 21: {
      const sh = c, mb = (w >>> 6) & 31, me = (w >>> 1) & 31, dot = rc ? '.' : '';
      const f = { ra: b, rs: a, sh, mb, me };
      // LLVM's order; slwi and srwi have no form that sets the flags.
      if (!rc && mb === 0 && me === 31 - sh) return R('slwi', [b, a, sh], f);
      if (!rc && me === 31 && sh === 32 - mb) return R('srwi', [b, a, mb], f);
      if (mb === 0 && me === 31) return R('rotlwi' + dot, [b, a, sh], f);
      if (sh === 0 && me === 31) return R('clrlwi' + dot, [b, a, mb], f);
      return R('rlwinm' + dot, [b, a, sh, mb, me], f);
    }
    case 23: {
      const mb = (w >>> 6) & 31, me = (w >>> 1) & 31, dot = rc ? '.' : '';
      if (mb === 0 && me === 31) return R('rotlw' + dot, [b, a, c], { ra: b, rs: a, rb: c, mb, me });
      return R('rlwnm' + dot, [b, a, c, mb, me], { ra: b, rs: a, rb: c, mb, me });
    }
    case 24: return (a | b | uimm) === 0 ? R('nop', [], {}) : R('ori', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 25: return R('oris', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 26: return (a | b | uimm) === 0 ? R('xnop', [], {}) : R('xori', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 27: return R('xoris', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 28: return R('andi.', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 29: return R('andis.', [b, a, uimm], { ra: b, rs: a, imm: uimm });
    case 31: return ppcDecode31(w, a, b, c, rc);
    case 32: return mem('lwz');   case 33: return mem('lwzu');
    case 34: return mem('lbz');   case 35: return mem('lbzu');
    case 36: return mem('stw');   case 37: return mem('stwu');
    case 38: return mem('stb');   case 39: return mem('stbu');
    case 40: return mem('lhz');   case 41: return mem('lhzu');
    case 42: return mem('lha');   case 43: return mem('lhau');
    case 44: return mem('sth');   case 45: return mem('sthu');
    case 46: return mem('lmw');   case 47: return mem('stmw');
    case 48: return mem('lfs');   case 49: return mem('lfsu');
    case 50: return mem('lfd');   case 51: return mem('lfdu');
    case 52: return mem('stfs');  case 53: return mem('stfsu');
    case 54: return mem('stfd');  case 55: return mem('stfdu');
    case 59: case 63: return ppcDecodeFloat(w, op, a, b, c, rc);
  }
  return null;
}

/* The conditional branch. BO says what is tested: bit 0x10 set means the
   condition bit is ignored, bit 0x04 set means the counter is not
   decremented; with both it always branches. bt and bf are the one-bit
   tests with the counter left alone. LLVM reads the two low bits of BO as
   the later architecture's "at" hint, so 6 and 7 are bf- and bf+, 14 and
   15 bt- and bt+, 24 to 27 bdnz-, bdnz+, bdz- and bdz+, and a BO whose
   hint is the reserved 01 (5, 13, 17...) keeps the plain bc. An absolute
   target is the displacement sign-extended to a full word. */
const PPC_AT_HINT = { 6: '-', 7: '+', 14: '-', 15: '+', 24: '-', 25: '+', 26: '-', 27: '+' };
function ppcDecodeBc(w, bo, bi) {
  let bd = w & 0xFFFC; if (bd & 0x8000) bd -= 0x10000;
  const aa = (w >>> 1) & 1, lk = w & 1;
  const tgt = aa ? '0x' + (bd >>> 0).toString(16) : ppcRel(bd);
  const f = { bo, bi, disp: bd, aa, lk, branch: true, conditional: true };
  const suffix = (lk ? 'l' : '') + (aa ? 'a' : ''), hint = PPC_AT_HINT[bo] || '';
  const mk = (mn, args) => Object.assign({ mn, args, text: mn + (args.length ? ' ' + args.join(', ') : ''), word: w >>> 0, op: 16 }, f);
  switch (bo) {
    case 12: case 14: case 15: return mk('bt' + suffix + hint, [bi, tgt]);
    case 4: case 6: case 7: return mk('bf' + suffix + hint, [bi, tgt]);
    case 16: case 24: case 25: return bi === 0 ? mk('bdnz' + suffix + hint, [tgt]) : mk('bc' + suffix, [bo, bi, tgt]);
    case 18: case 26: case 27: return bi === 0 ? mk('bdz' + suffix + hint, [tgt]) : mk('bc' + suffix, [bo, bi, tgt]);
    case 8: return mk('bdnzt' + suffix, [bi, tgt]);
    case 0: return mk('bdnzf' + suffix, [bi, tgt]);
    case 10: return mk('bdzt' + suffix, [bi, tgt]);
    case 2: return mk('bdzf' + suffix, [bi, tgt]);
  }
  return mk('bc' + suffix, [bo, bi, tgt]);
}

function ppcDecode19(w, bo, bi, c) {
  const xo = (w >>> 1) & 0x3FF, lk = w & 1;
  const mk = (mn, args, f) => Object.assign({ mn, args, text: mn + (args.length ? ' ' + args.join(', ') : ''), word: w >>> 0, op: 19 }, f || {});
  if (xo === 16 || xo === 528) {
    const to = xo === 16 ? 'lr' : 'ctr';
    const f = { bo, bi, lk, branch: true, indirect: to };
    const l = lk ? 'l' : '', bh = (w >>> 11) & 3;
    if (w & 0xE000) return null;                                   // reserved bits
    // The branch-hint field, which the later architecture added, is printed
    // as a third operand; the aliases are for BI 0 alone, and LLVM names
    // only the always-branch and, to the link register, the counter tests.
    if (bh) return mk('bc' + to + l, [bo, bi, bh], f);
    if (bi === 0 && bo === 20) return mk('b' + to + l, [], f);
    if (bi === 0 && xo === 16 && (bo === 16 || bo === 24 || bo === 25)) return mk('bdnzlr' + l + (PPC_AT_HINT[bo] || ''), [], f);
    if (bi === 0 && xo === 16 && (bo === 18 || bo === 26 || bo === 27)) return mk('bdzlr' + l + (PPC_AT_HINT[bo] || ''), [], f);
    return mk('bc' + to + l, [bo, bi], f);
  }
  if (xo === 0) return (w & 0x0063F801) ? null : mk('mcrf', [(w >>> 23) & 7, (w >>> 18) & 7]);
  const cr = { 33: 'crnor', 129: 'crandc', 193: 'crxor', 225: 'crnand', 257: 'crand', 289: 'creqv', 417: 'crorc', 449: 'cror' }[xo];
  if (cr) {
    if (w & 1) return null;
    // One operand repeated: LLVM's crclr, crset, crmove and crnot.
    if (xo === 193 && bo === bi && bi === c) return mk('crclr', [bo]);
    if (xo === 289 && bo === bi && bi === c) return mk('crset', [bo]);
    if (xo === 449 && bi === c) return mk('crmove', [bo, bi]);
    if (xo === 33 && bi === c) return mk('crnot', [bo, bi]);
    return mk(cr, [bo, bi, c]);
  }
  if (xo === 50) return (w & 0x03FFF801) ? null : mk('rfi', []);
  return null;
}

/* Opcode 31: the register-to-register forms. The arithmetic ones carry an
   overflow bit (OE) above a nine-bit extended opcode; the rest have ten. */
function ppcDecode31(w, a, b, c, rc) {
  const xo = (w >>> 1) & 0x3FF, xo9 = (w >>> 1) & 0x1FF, oe = (w >>> 10) & 1;
  const dot = rc ? '.' : '';
  const mk = (mn, args, f) => Object.assign({ mn, args, text: mn + (args.length ? ' ' + args.join(', ') : ''), word: w >>> 0, op: 31 }, f || {});
  // XO: rD = a, rA = b, rB = c.
  const arith = { 8: 'subfc', 10: 'addc', 11: 'mulhwu', 40: 'subf', 75: 'mulhw', 104: 'neg', 136: 'subfe', 138: 'adde',
                  200: 'subfze', 202: 'addze', 232: 'subfme', 234: 'addme', 235: 'mullw', 266: 'add', 459: 'divwu', 491: 'divw' }[xo9];
  if (arith) {
    const o = oe ? 'o' : '';
    if ((xo9 === 11 || xo9 === 75) && oe) return null;         // mulhw has no overflow form
    // LLVM's sub and subc turn the operands round; the overflow forms keep
    // their own names and order.
    if (arith === 'subf' && !oe) return mk('sub' + dot, [a, c, b], { rd: a, ra: b, rb: c });
    if (arith === 'subfc' && !oe) return mk('subc' + dot, [a, c, b], { rd: a, ra: b, rb: c });
    if (arith === 'neg' || arith === 'subfze' || arith === 'addze' || arith === 'subfme' || arith === 'addme') {
      if (c !== 0) return null;
      return mk(arith + o + dot, [a, b], { rd: a, ra: b });
    }
    return mk(arith + o + dot, [a, b, c], { rd: a, ra: b, rb: c });
  }
  // X: rS = a, rA = b, rB = c for the logical and shift forms; rT = a for
  // loads and stores, which have no form that sets the flags.
  const indexed = { 23: 'lwzx', 55: 'lwzux', 87: 'lbzx', 119: 'lbzux', 151: 'stwx', 183: 'stwux', 215: 'stbx', 247: 'stbux',
                    279: 'lhzx', 311: 'lhzux', 343: 'lhax', 375: 'lhaux', 407: 'sthx', 439: 'sthux',
                    535: 'lfsx', 567: 'lfsux', 599: 'lfdx', 631: 'lfdux', 663: 'stfsx', 695: 'stfsux', 727: 'stfdx', 759: 'stfdux' }[xo];
  if (indexed) return rc ? null : mk(indexed, [a, b, c], { rt: a, ra: b, rb: c });
  switch (xo) {
    case 0: case 32: {
      const crf = (w >>> 23) & 7, L = (w >>> 21) & 1;
      if (L || rc || ((w >>> 22) & 1)) return null;
      const mn = xo === 0 ? 'cmpw' : 'cmplw';
      return mk(mn, crf ? [crf, b, c] : [b, c], { crf, ra: b, rb: c });
    }
    case 4: {
      if (rc) return null;
      if (a === 31 && b === 0 && c === 0) return mk('trap', []);
      return PPC_TRAP[a] ? mk('tw' + PPC_TRAP[a], [b, c], { ra: b, rb: c }) : mk('tw', [a, b, c], { ra: b, rb: c });
    }
    case 19: return (b | c | rc) ? null : mk('mfcr', [a], { rd: a });
    case 144: return rc || ((w >>> 20) & 1) || (w & 0x800) ? null : (((w >>> 12) & 0xFF) === 0xFF ? mk('mtcr', [a]) : mk('mtcrf', [(w >>> 12) & 0xFF, a]));
    case 24: return mk('slw' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 536: return mk('srw' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 792: return mk('sraw' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 824: return mk('srawi' + dot, [b, a, c], { ra: b, rs: a, sh: c });
    case 26: return c ? null : mk('cntlzw' + dot, [b, a], { ra: b, rs: a });
    case 922: return c ? null : mk('extsh' + dot, [b, a], { ra: b, rs: a });
    case 954: return c ? null : mk('extsb' + dot, [b, a], { ra: b, rs: a });
    case 28: return mk('and' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 60: return mk('andc' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 124: return a === c ? mk('not' + dot, [b, a], { ra: b, rs: a }) : mk('nor' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 284: return mk('eqv' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 316: return mk('xor' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 412: return mk('orc' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 444: return a === c ? mk('mr' + dot, [b, a], { ra: b, rs: a }) : mk('or' + dot, [b, a, c], { ra: b, rs: a, rb: c });
    case 339: case 467: {
      if (rc) return null;
      const spr = (((w >>> 11) & 0x3FF) >>> 5) | ((((w >>> 11) & 0x3FF) & 31) << 5);
      const from = xo === 339;
      const name = PPC_SPR_NAMES[spr] || (from ? PPC_SPR_FROM_ONLY : PPC_SPR_TO_ONLY)[spr];
      if (name) return mk((from ? 'mf' : 'mt') + name, [a], { rd: a, spr });
      if (spr >= 528 && spr <= 543) {
        const bat = (spr < 536 ? 'ibat' : 'dbat') + (spr & 1 ? 'l' : 'u'), n = ((spr - 528) >> 1) & 3;
        return from ? mk('mf' + bat, [a, n], { rd: a, spr }) : mk('mt' + bat, [n, a], { rs: a, spr });
      }
      return from ? mk('mfspr', [a, spr], { rd: a, spr }) : mk('mtspr', [spr, a], { rs: a, spr });
    }
  }
  return null;
}

/* Floating point: opcode 63 for doubles and the compares, 59 for singles.
   The A forms (five-bit extended opcode) are the arithmetic; the X forms
   (ten bits) the rest. */
function ppcDecodeFloat(w, op, a, b, c, rc) {
  const dot = rc ? '.' : '', s = op === 59 ? 's' : '';
  const x5 = (w >>> 1) & 31, x10 = (w >>> 1) & 0x3FF, fc = (w >>> 6) & 31;
  const mk = (mn, args) => ({ mn, args, text: mn + (args.length ? ' ' + args.join(', ') : ''), word: w >>> 0, op });
  const arith = { 18: 'fdiv', 20: 'fsub', 21: 'fadd', 25: 'fmul' }[x5];
  if (arith) {
    if (x5 === 25) { if (c) return null; return mk(arith + s + dot, [a, b, fc]); }
    if (fc) return null;
    return mk(arith + s + dot, [a, b, c]);
  }
  if (op === 59) return null;
  switch (x10) {
    case 0: return ((w >>> 21) & 3) || rc ? null : mk('fcmpu', [(w >>> 23) & 7, b, c]);
    case 32: return ((w >>> 21) & 3) || rc ? null : mk('fcmpo', [(w >>> 23) & 7, b, c]);
    case 12: return b ? null : mk('frsp' + dot, [a, c]);
    case 14: return b ? null : mk('fctiw' + dot, [a, c]);
    case 15: return b ? null : mk('fctiwz' + dot, [a, c]);
    case 40: return b ? null : mk('fneg' + dot, [a, c]);
    case 72: return b ? null : mk('fmr' + dot, [a, c]);
    case 136: return b ? null : mk('fnabs' + dot, [a, c]);
    case 264: return b ? null : mk('fabs' + dot, [a, c]);
    case 583: return (b | c) ? null : mk('mffs' + dot, [a]);
  }
  return null;
}
