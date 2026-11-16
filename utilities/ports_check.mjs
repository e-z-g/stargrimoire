// js/nova-ports.js: Escape Velocity and EV Override against their Nova ports.
//
//   1. Every record of both games in one place: for each type, the same,
//      the changed and those only in the elder add up to the elder's count,
//      and with those only in the port to the port's.
//   2. The types without a table, against a plain comparison here: STR# by
//      its strings, and every other type by its bytes, except the pictures
//      that are the same by their pixels.
//   3. The ships against older_check's reading. Every field older_check
//      finds equal to the port's is the same here, and every one it leaves
//      out as converted (Accel, Speed, Maneuver, DeathDelay) differs here.
//   4. Controls, on the port read again with bytes bent: a ship's Shield, a
//      description's first letter, a picture's pixel bent past 16-bit
//      color's steps, and an expression with its bit taken out. Each must
//      show as changed in that field or record.
//   5. Plug-ins paired by name: a pair known from the two folders on disk,
//      and a name with no match.
import fs from 'node:fs';
import path from 'node:path';
import { site, REF } from './load.mjs';

const S = site({ dom: true });
let fails = 0;
const fail = m => { console.log('FAIL ' + m); fails++; };
const INST = path.join(REF, 'game/collections/EscapeVelocityPluginCollection/Installers');
const GAMES = [
  { file: 'Escape_Velocity.bin', port: 'game/EV_Classic_for_Nova_1.1.1_1.zip' },
  { file: 'EVOverride.bin', port: 'game/extras/EV_Override_for_Nova.zip' },
];
if (!GAMES.every(g => fs.existsSync(path.join(INST, g.file)) && fs.existsSync(path.join(REF, g.port)))) { console.log('SKIP: the installers or their Nova ports are not in reference/'); process.exit(0); }

const open = p => { const g = S.novaGame(); for (const f of S.novaArchiveFiles(S.novaArchiveIn(new Uint8Array(fs.readFileSync(p))))) g.add(f, f.read()); return g; };
const pixels = b => { const p = S.decodePict(b); return p.kind === 'canvas' ? { width: p.width, height: p.height, bits: p.pixelSize, data: p.canvas._pixels } : null; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

for (const g of GAMES) {
  const elder = open(path.join(INST, g.file)), port = open(path.join(REF, g.port));
  const c = S.novaPortCompare(elder, port, { pixels });
  // 1. every record in one place
  for (const t of c.types) {
    if (t.same + t.differ.length + t.onlyElder.length !== t.elder) fail(`${g.file} ${t.type}: ${t.same} + ${t.differ.length} + ${t.onlyElder.length} is not the elder's ${t.elder}`);
    if (t.same + t.differ.length + t.onlyPort.length !== t.port) fail(`${g.file} ${t.type}: ${t.same} + ${t.differ.length} + ${t.onlyPort.length} is not the port's ${t.port}`);
  }
  // 2. the types without a table, compared plainly
  let plain = 0;
  for (const t of c.types.filter(x => x.how !== 'fields')) {
    const ids = elder.list(t.type).map(r => r.id).filter(id => port.has(t.type, id));
    const differ = ids.filter(id => {
      const a = elder.get(t.type, id), b = port.get(t.type, id);
      if (a.name !== b.name) return true;
      if (t.type === 'STR#') return JSON.stringify(S.novaStrings(elder, id)) !== JSON.stringify(S.novaStrings(port, id));
      return !same(a.bytes, b.bytes) && !(t.type === 'PICT' && (t.pixels.includes(id) || t.rounded.includes(id)));
    });
    plain++;
    const actual = t.differ.map(e => e.id).sort((a, b) => a - b).join();
    if (differ.sort((a, b) => a - b).join() !== actual) fail(`${g.file} ${t.type}: changed ${actual}, compared plainly ${differ.join()}`);
  }
  // 3. the ships against older_check's reading
  const ship = c.types.find(t => t.type === 'shïp');
  const CONVERTED = ['Accel', 'Speed', 'Maneuver', 'DeathDelay'];
  for (const e of ship.differ) for (const r of e.rows) {
    if (r.how === 'name' && typeof r.a === 'number' && !['Armor', 'Flags', 'FuelRegen', ...CONVERTED].includes(r.label) && !r.same) fail(`${g.file} ship ${e.id}: ${r.label} differs, and older_check finds it equal to the port's`);
  }
  for (const f of CONVERTED) { const s = ship.fields.find(x => x.label === f); if (!s || !s.differ) fail(`${g.file}: the ships' ${f} is the same in the port, and older_check leaves it out as converted`); }
  // 4. controls on the port read again, with bytes bent
  const bent = open(path.join(REF, g.port));
  const sid = ship.differ[0].id;
  bent.get('shïp', sid).bytes[3] ^= 1;   // Shield, the second word
  const descs = c.types.find(t => t.type === 'dësc');
  const desc = elder.list('dësc').find(r => bent.has('dësc', r.id) && !descs.differ.some(e => e.id === r.id));
  bent.get('dësc', desc.id).bytes[0] ^= 0x20;
  const pict = c.types.find(t => t.type === 'PICT'), rid = pict.rounded[0];
  const bit = ship.differ.find(e => e.rows.some(r => r.how === 'bits' && r.same && typeof r.a === 'number' && r.a >= 0));
  let bitField = null;
  if (bit) {
    const row = bit.rows.find(r => r.how === 'bits' && r.same && r.a >= 0);
    const b = bent.get('shïp', bit.id).bytes, rec = S.novaRecord('shïp', b);
    let off = 0;
    for (const [name, kind, n] of S.NOVA_RECORDS['shïp']) { if (name === row.nova) break; off += kind === 'pad' || kind === 'str' ? n : S.NOVA_KIND_SIZE[kind] * (n || 1); }
    b[off + rec[row.nova].search(new RegExp('b0*' + row.a + '(?![0-9])', 'i'))] = 'x'.charCodeAt(0);
    bitField = row.label;
  } else fail(`${g.file}: no ship has a bit field the port's expression has, for the control`);
  // the bent picture known by its bytes, since a .rez file's resources are read again on each get
  const target = rid !== undefined && bent.get('PICT', rid).bytes;
  const bentPixels = b => {
    const p = pixels(b);
    if (p && target && same(b, target)) { p.data = new Uint8ClampedArray(p.data); p.data[0] = p.data[0] > 127 ? p.data[0] - 17 : p.data[0] + 17; }
    return p;
  };
  const cb = S.novaPortCompare(elder, bent, { pixels: bentPixels });
  const changed = (type, id) => cb.types.find(t => t.type === type).differ.find(e => e.id === id);
  const sh = changed('shïp', sid);
  if (!sh || !sh.rows.some(r => r.label === 'Shield' && !r.same)) fail(`${g.file}: ship ${sid} with its Shield bent does not show Shield as changed`);
  if (!changed('dësc', desc.id)) fail(`${g.file}: dësc ${desc.id} with a letter bent is not changed`);
  if (rid !== undefined && !changed('PICT', rid)) fail(`${g.file}: PICT ${rid} with a pixel bent past 16-bit color's steps is not changed`);
  if (bit && !(changed('shïp', bit.id) || { rows: [] }).rows.some(r => r.label === bitField && !r.same)) fail(`${g.file}: ship ${bit.id} with its bit taken out of the port's expression does not show ${bitField} as changed`);
  console.log(`${g.file}: ${c.counts.same} records the same, ${c.counts.differ} changed, ${c.counts.onlyElder} only in it and ${c.counts.onlyPort} only in the port. ${plain} types compared plainly. ${pict.pixels.length} pictures the same by pixels and ${pict.rounded.length} in 16-bit color. The bent ship ${sid}, dësc ${desc.id}, PICT ${rid} and ${bitField} of ship ${bit && bit.id} each show as changed.`);
}

// 5. plug-ins paired by name
const pairs = S.novaPortPairs(['AsteroidBeam.sit', 'tiefighter1.02.sit.hqx', 'Nothing Like It.sit'], ['Asteroid Beam.zip', 'TieFighter Plugin 1.0.2.zip', 'Arena.zip']);
if (pairs.map(p => p.elder + '>' + p.port).join() !== 'AsteroidBeam.sit>Asteroid Beam.zip,tiefighter1.02.sit.hqx>TieFighter Plugin 1.0.2.zip') fail(`plug-ins paired as ${JSON.stringify(pairs)}`);

console.log(fails ? `${fails} failed` : 'ports: all passed');
process.exit(fails ? 1 : 0);
