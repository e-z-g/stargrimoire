// js/nova-ships.js: the Bible's rules for ships, and every release's ships
// read through them.
//
//   1. Every shïp has a shän, and every sprite a shän names is in the files.
//   2. The frame counts the page relies on: the base is BaseSetCount sets of
//      FramesPer; the alternating image AltSetCount sets; the shield 1,
//      FramesPer or BaseSetCount x FramesPer. The engine glow and running
//      lights have one frame for each of the base's, which the Bible says
//      they must ("or Nova will choke", at the foot of the shän section), or
//      one set of FramesPer: fifteen stock ships have that, the Argosies
//      (Flags 0x02, folding) and Manticores (0x08, in sequence), with six
//      and three sets of base under one set of glow, in every release.
//   3. The pictures: how many ships have their own target picture (3000)
//      and picture beside the description (5000), how many take another's
//      by sharing sprites, and which have none.
//   4. The Bible's worked values: InherentGovt's ranges, Mass to jump days.
//
// A negative control proves the frame-count test can fail.
import { site, openRelease, haveRelease, RELEASES } from './load.mjs';

const S = site();
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };

// The frame-count rules, as one function the control can be run through.
function frameProblems(shan, count) {
  const out = [];
  const per = shan.FramesPer;
  for (const l of S.novaShanLayers(shan)) {
    const n = count(l.image);
    if (n === null) { out.push(`${l.label} ${l.image} is not in the files`); continue; }
    if (n === 'pict') continue;
    const want = l.layer === 'base' ? [shan.BaseSetCount * per]
               : l.layer === 'alt' ? [shan.AltSetCount * per]
               : l.layer === 'shield' ? [1, per, shan.BaseSetCount * per]
               : l.layer === 'weap' ? null
               : [shan.BaseSetCount * per, per];
    if (want && !want.includes(n)) out.push(`${l.label} ${l.image} has ${n} frames, not ${want.join(' or ')}`);
  }
  return out;
}

for (const v of Object.keys(RELEASES)) {
  if (!haveRelease(v)) { console.log(`SKIP ${v}: not in reference/`); continue; }
  const game = openRelease(S, v, new Set(['data', 'ships']));
  const count = id => {
    const r = game.get('rlëD', id) || game.get('rlë8', id);
    if (r) return S.novaRleHeader(r.bytes).frames;
    return game.has('PICT', id) ? 'pict' : null;
  };
  const ships = S.novaAll(game, 'shïp');
  const noShan = [], problems = [], kinds = new Map(), weapCounts = new Map();
  for (const ship of ships) {
    const shan = S.novaGet(game, 'shän', ship.id);
    if (!shan) { noShan.push(ship.id); continue; }
    for (const p of frameProblems(shan, count)) problems.push(`shän ${ship.id}: ${p}`);
    for (const l of S.novaShanLayers(shan)) {
      const k = game.has('rlëD', l.image) ? 'rlëD' : game.has('rlë8', l.image) ? 'rlë8' : game.has('PICT', l.image) ? 'PICT' : 'none';
      kinds.set(k, (kinds.get(k) || 0) + 1);
      if (l.layer === 'weap') {
        const n = count(l.image), k = n === shan.FramesPer * shan.BaseSetCount ? 'as many frames as the base' : n === shan.FramesPer ? 'FramesPer' : n + ' frames';
        weapCounts.set(k, (weapCounts.get(k) || 0) + 1);
      }
    }
  }
  if (noShan.length) fail(`${v}: ${noShan.length} ships have no shän: ${noShan.slice(0, 8).join(', ')}`);
  if (problems.length) fail(`${v}: ${problems.length} layers do not have the frames the Bible gives: ${problems.slice(0, 6).join('; ')}`);
  else console.log(`${v}: ${ships.length} ships, every shän's sprites there with the frames the Bible gives (${[...kinds].map(([k, n]) => `${n} ${k}`).join(', ')}; weapon glows: ${[...weapCounts].map(([k, n]) => `${n} ${k}`).join(', ') || 'none'})`);

  const tally = { 3000: { own: 0, shared: 0, none: [] }, 5000: { own: 0, shared: 0, none: [] } };
  for (const ship of ships) for (const base of [3000, 5000]) {
    const p = S.novaShipPict(game, ship.id, base);
    if (!p) tally[base].none.push(ship.id);
    else if (p.from === ship.id) tally[base].own++;
    else tally[base].shared++;
  }
  const line = b => `${tally[b].own} own, ${tally[b].shared} shared, ${tally[b].none.length} none`;
  console.log(`${v}: target pictures ${line(3000)}; pictures beside the description ${line(5000)}` +
              (tally[5000].none.length ? ` (none: ${tally[5000].none.slice(0, 12).join(', ')}${tally[5000].none.length > 12 ? ' …' : ''})` : ''));
}

// The Bible's ranges.
const govt = [[-1, -1, -1], [128, 128, 128], [383, 383, 383], [1150, -1, 150], [2150, 150, -1], [500, -1, -1]];
for (const [v, combat, attrs] of govt) {
  const g = S.novaShipGovts(v);
  if (g.combat !== combat || g.attrs !== attrs) fail(`InherentGovt ${v}: combat ${g.combat}, attributes ${g.attrs}; the Bible gives ${combat}, ${attrs}`);
}
const days = [[1, 1], [99, 1], [100, 2], [199, 2], [200, 3], [5000, 3], [0, null]];
for (const [m, d] of days) if (S.novaShipJumpDays(m) !== d) fail(`Mass ${m}: ${S.novaShipJumpDays(m)} days; the Bible gives ${d}`);
if (!fails) console.log(`rules: InherentGovt's ranges and Mass to jump days as the Bible gives them`);

// The negative control: a glow one frame short must be caught.
const control = frameProblems({ BaseImageID: 1, BaseSetCount: 3, FramesPer: 36, GlowImageID: 2, AltImageID: 0, LightImageID: 0, WeapImageID: 0, ShieldImgID: 0 },
  id => (id === 1 ? 108 : 107));
if (!control.length) fail('the frame-count test did not notice a glow one frame short');

process.exit(fails ? 1 : 0);
