// The numbers the flying and battle code uses, each found in the routine of
// Mac 1.1.1 that its comments cite: the scan that utilities/rules_build.mjs
// writes into js/nova-rules.js and program_check holds that file to.
//
// A routine is cited as its name and its Intel address ("HandleShip
// 0x33581", the address on the next line or not), on the line itself or in
// the comments since the last function ended (a comment opening a line
// outside any function, after code, starts afresh); a number is a decimal
// in the code (not in a comment, a string or a shift's count), negative
// where its minus is not a subtraction's, skipped when it is below 5 or an
// id or angle every routine has (128, 255, 256, 360), and below 10 unless
// the line itself cites the routine; once a line. It is kept when the cited
// routine, the nearest citation first, holds it (novaHeldValues: an li,
// addi, cmpwi, cmplwi, mulli or subfic of it or of its negative, an lis of
// it over 65536, or a float constant it rounds to in single precision).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './load.mjs';

export const RULE_FILES = ['js/nova-flight.js', 'js/nova-fight.js'];
const SKIP = new Set([128, 255, 256, 360]);

export function scanRules(S, prog) {
  const held = n => S.novaHeldValues(prog, n);
  const rules = [];
  for (const file of RULE_FILES) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    let cited = [], inBlock = false, depth = 0, codeSince = false, carry = null;
    lines.forEach((line, n) => {
      // a comment starting a line outside any function, after code, begins the next one's citations
      if (depth === 0 && !inBlock && /^(\/\*|\/\/)/.test(line) && codeSince) { cited = []; codeSince = false; }
      // the code on the line, and the comment
      let code = '', comment = '', rest = line;
      while (rest.length) {
        if (inBlock) { const e = rest.indexOf('*/'); if (e < 0) { comment += rest; rest = ''; } else { comment += rest.slice(0, e); rest = rest.slice(e + 2); inBlock = false; } continue; }
        const b = rest.indexOf('/*'), l = rest.indexOf('//');
        if (l >= 0 && (b < 0 || l < b)) { code += rest.slice(0, l); comment += rest.slice(l); rest = ''; }
        else if (b >= 0) { code += rest.slice(0, b); rest = rest.slice(b + 2); inBlock = true; }
        else { code += rest; rest = ''; }
      }
      const names = [...comment.matchAll(/\b([A-Z][A-Za-z0-9]+) 0x[0-9a-f]{3,6}\b/g)].map(m => m[1]);
      // a name ending one line whose address begins the next
      if (carry && /^[\s*\/]*0x[0-9a-f]{3,6}\b/.test(comment)) cited.push(carry);
      carry = (comment.match(/\b([A-Z][A-Za-z0-9]+)\s*$/) || [])[1] || null;
      cited = cited.concat(names);
      const bare = code.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '').replace(/(<<|>>>|>>)\s*\d+/g, '');
      for (const ch of bare) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (bare.trim()) codeSince = true;
      for (const m of bare.matchAll(/(?<![\w.$])(\d+\.\d+|\d+)(?![\w.])/g)) {
        const u = Number(m[1]);
        if ((Number.isInteger(u) && u < 5) || SKIP.has(u)) continue;
        // negative where its minus is not a subtraction's
        const v = /(^|[^\w$.)\]\s]|\b(return|case))\s*-\s*$/.test(bare.slice(0, m.index)) ? -u : u;
        // a small whole number only from a routine the line itself cites
        const order = Number.isInteger(u) && u < 10 ? names : [...names, ...cited.slice().reverse()];
        const hit = order.find(nm => held(nm).has(Math.fround(v)));
        if (hit && !rules.some(r => r[0] === file && r[1] === n + 1 && r[2] === v)) rules.push([file, n + 1, v, hit]);
      }
      if (/^\}/.test(line) && depth === 0) cited = [];
    });
  }
  return rules;
}

// js/nova-rules.js as it should be.
export function rulesFile(rules) {
  return `/* nova-rules.js -- written by utilities/rules_build.mjs from the code it
   lists; run that after changing js/nova-flight.js or js/nova-fight.js.
   =========================================================================

   Each number the flying and battle code uses that the routine of Mac 1.1.1
   its comments cite holds too: [file, line, number, routine]
   (utilities/rules.mjs says how they are found). The Code view lists them
   by routine, each linked to the instruction holding it and to the line of
   the site's code that uses it; program_check fails while this list is not
   the one the code gives.

   GENERIC TO EV NOVA, NO DOM. */

const NOVA_RULES = [
${rules.map(r => '  ' + JSON.stringify(r)).join(',\n')},
];
`;
}
