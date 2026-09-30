// js/nova-bits.js held to Drydock, the code it was ported from, over every
// control-bit test and set expression in every release.
//
// The oracle is Drydock's own two parsers (reference/drydock, geuis/drydock,
// MIT): NCBTestExpression.swift and NCBSetExpression.swift, compiled unchanged
// with a stub of the pilot state that the first names only for a function
// the check never calls, and a main that reads each test the way
// StoryFlagCatalog.collectRequirements does -- flipping on and off at every
// "!" -- and each set expression into its operations, a random choice's
// marked. Every expression goes to both, and what each bit is said to need
// or to have done to it must be the same, in the same order. A test the
// oracle cannot parse must be one ours cannot either. Needs swiftc; without
// it, or without the clone, this check skips.
//
// Then the catalog: every bit named in the files is in it, and a few bits
// the map's visibility rests on are named after the missions that set them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { site, openRelease, haveRelease, REF, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

const SRC = path.join(REF, 'drydock/Sources/Drydock');
const FILES = ['Diagnostics/NCBTestExpression.swift', 'GameData/NCBSetExpression.swift'];
const GLUE = `// What NCBTestExpression's explain() names of Drydock's pilot state, which
// the check never calls: enough for the parser to compile on its own.
public struct PilotStoryState {
    public let bits: [Bool]
    public let outfitCounts: [Int16]
    public let exploration: [Int16]
    public let isMale: Bool?
    public static let outfitIDBase = 128
    public static let systemIDBase = 128
}
`;
const MAIN = `import Foundation
// Each line is "t<TAB>test" or "s<TAB>set"; each answer is one line, the
// test's needs as "on N" / "off N" (StoryFlagCatalog.collectRequirements)
// or "unparsed", the set's bit operations as "set N" / "clear N" /
// "toggle N", " r" after one inside R(...).
func needs(_ node: NCBNode, _ neg: Bool, _ out: inout [String]) {
    switch node {
    case .bit(let id): out.append((neg ? "off" : "on") + " \\(id)")
    case .not(let inner): needs(inner, !neg, &out)
    case .and(let c), .or(let c): for x in c { needs(x, neg, &out) }
    case .registered, .male, .outfit, .explored: break
    }
}
while let line = readLine(strippingNewline: true) {
    let parts = line.split(separator: "\\t", maxSplits: 1, omittingEmptySubsequences: false)
    let expr = parts.count > 1 ? String(parts[1]) : ""
    var out: [String] = []
    if parts[0] == "t" {
        if let n = NCBTestExpression.parse(expr).node { needs(n, false, &out) } else { out.append("unparsed") }
    } else {
        for step in NCBSetExpression.parse(expr) {
            var random = false
            if case .randomChoice = step { random = true }
            for op in step.operations {
                switch op {
                case .set(let id): out.append("set \\(id)" + (random ? " r" : ""))
                case .clear(let id): out.append("clear \\(id)" + (random ? " r" : ""))
                case .toggle(let id): out.append("toggle \\(id)" + (random ? " r" : ""))
                case .other: break
                }
            }
        }
    }
    print(out.joined(separator: ","))
}
`;

function buildOracle() {
  if (!fs.existsSync(SRC)) return { skip: 'no Drydock clone at reference/drydock' };
  if (spawnSync('swiftc', ['--version']).status !== 0) return { skip: 'no swiftc' };
  const texts = FILES.map(f => fs.readFileSync(path.join(SRC, f), 'utf8'));
  const hash = crypto.createHash('sha1').update(texts.join('\0') + GLUE + MAIN).digest('hex').slice(0, 12);
  const dir = path.join(os.tmpdir(), 'stargrimoire-ddbits-' + hash);
  const bin = path.join(dir, 'ddbits');
  // The binary, not the directory, says it is built: macOS empties $TMPDIR's files and keeps its folders.
  if (!fs.existsSync(bin)) {
    fs.mkdirSync(dir, { recursive: true });
    const names = FILES.map(f => path.basename(f));
    names.forEach((n, i) => fs.writeFileSync(path.join(dir, n), texts[i]));
    fs.writeFileSync(path.join(dir, 'glue.swift'), GLUE);
    fs.writeFileSync(path.join(dir, 'main.swift'), MAIN);
    execFileSync('swiftc', ['-O', '-o', bin, 'main.swift', 'glue.swift', ...names], { cwd: dir, stdio: 'inherit' });
  }
  return { bin };
}

// Ours, in the oracle's words.
function ours(kind, text) {
  if (kind === 't') {
    try { S.ncbParseTest(text); } catch (e) { return 'unparsed'; }
    return S.ncbTestNeeds(text).map(x => (x.on ? 'on ' : 'off ') + x.n).join(',');
  }
  return S.ncbParseSet(text).flatMap(st => st.ops.filter(o => o.n !== null).map(o => `${o.op} ${o.n}${st.random ? ' r' : ''}`)).join(',');
}

const o = buildOracle();
if (o.skip) console.log('SKIP the oracle: ' + o.skip);
for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v);
  // every test and set expression the catalog reads, but for the descriptions' choices
  const exprs = [];
  for (const [type, , fields] of S.NOVA_BIT_SOURCES) for (const rec of S.novaAll(game, type)) for (const [field, how] of fields) {
    if (how === 'desc' || !rec[field]) continue;
    exprs.push({ where: `${type} ${rec.id} ${field}`, kind: how === 'test' ? 't' : 's', text: rec[field] });
  }
  if (!o.skip) {
    // a line the oracle reads is one line: a tab or line break in an expression would split it
    const clean = t => t.replace(/[\t\r\n]/g, ' ');
    const answers = execFileSync(o.bin, { input: exprs.map(e => e.kind + '\t' + clean(e.text)).join('\n') + '\n', maxBuffer: 1 << 28 }).toString().split('\n');
    let differ = 0, unparsed = 0;
    const first = [];
    exprs.forEach((e, i) => {
      const want = answers[i], got = ours(e.kind, clean(e.text));
      if (want === 'unparsed') unparsed++;
      if (want !== got) { differ++; if (first.length < 4) first.push(`${e.where} ${JSON.stringify(e.text)}: ${got} here, ${want} in Drydock`); }
    });
    if (differ) fail(`${v}: ${differ} of ${exprs.length} expressions read differently from Drydock: ${first.join('; ')}`);
    else console.log(`${v}: ${exprs.length} test and set expressions (${exprs.filter(e => e.kind === 't').length} tests), each read as Drydock reads it` +
                     (unparsed ? `; ${unparsed} tests neither parses` : ''));
  }
  // The catalog: every bit an expression names is in it, and what Sol's visibility rests on is named.
  const cat = S.novaBitCatalog(game);
  const named = new Set();
  for (const e of exprs) for (const m of e.text.matchAll(/(?:^|[^A-Za-z0-9])[Bb](\d+)/g)) if (+m[1] < 10000) named.add(+m[1]);
  const missing = [...named].filter(n => !cat.has(n));
  if (missing.length) fail(`${v}: bits named in the files and not in the catalog: ${missing.slice(0, 8).join(', ')}`);
  const b147 = cat.get(147);
  if (!b147 || !/Take Polaris Home/.test(b147.name || '') || !b147.refs.some(r => r.type === 'sÿst' && r.effect === 'on'))
    fail(`${v}: b147 is not named after Take Polaris Home with a system's visibility needing it: ${JSON.stringify(b147 && b147.name)}`);
  console.log(`${v}: ${cat.size} bits in use, ${[...cat.values()].filter(b => b.name).length} of them set by something; b147 "${b147 && b147.name}"`);
}
process.exit(fails ? 1 : 0);
