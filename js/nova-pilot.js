/* nova-pilot.js -- save files: decrypted and read as the program reads them.
   =========================================================================

   A save file (what the game calls a pilot file, Finder type NpïL) is a
   resource fork with two records of type NpïL, read by Mac 1.1.1's
   LoadPilotData (0x750b5): 128, the pilot -- where you are, your ship and
   what is in it, the date, the systems you have explored, your legal
   standing in each, the missions under way, the control bits, the stellars
   you have dominated, your escorts and your combat rating -- and 129, the
   rest of the game as you left it: strict play, your gender, nickname and
   paint, the defense fleets the stellars have left, which persons are
   alive and which have a grudge against you, disasters, events under way,
   prices, stellars destroyed and the ranks you have. Your name is the
   file's, and your ship's name is record 129's resource name.

   Each record is encrypted by DoEncryption (0xa51cb) with the key
   0xB36A210F: each big-endian word of it is xored with the key, which then
   steps to (key - 0x21524111) xor 0xDEADBEEF; the last one to three bytes
   are xored with the key's first bytes. Being an xor, the same undoes it.
   1.0.2 to 1.0.10 have the same key.

   THE LAYOUT. FlipNpil (0xa6b27) turns each record from the PowerPC's
   order to Intel's field by field, so it lays out every 16- and 32-bit
   field; NOVA_PILOT_LAYOUT is that, and pilot_check compares the two.
   What each field is comes from where LoadPilotData puts it, and the names
   are the ones DumpPilotLog (0x739dc) prints in its report of a pilot
   (pilotlog.txt).

   Record 129 begins with a version, and LoadPilotData stops at 107 and at
   anything else up to 299, so only a save of version 300 or more opens.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after mac-resfork.js,
   nova-files.js and nova-ncb.js. */

const NOVA_PILOT_KEY = 0xB36A210F;

// DoEncryption 0xa51cb: the key stream xored over the record, which undoes itself.
function novaPilotCrypt(bytes, start = NOVA_PILOT_KEY) {
  const b = Uint8Array.from(bytes);
  let key = start, i = 0;
  for (; i + 4 <= b.length; i += 4) {
    b[i] ^= key >>> 24; b[i + 1] ^= (key >>> 16) & 255; b[i + 2] ^= (key >>> 8) & 255; b[i + 3] ^= key & 255;
    key = ((key - 0x21524111) ^ 0xDEADBEEF) >>> 0;
  }
  for (let j = 0; i < b.length; i++, j++) b[i] ^= (key >>> (24 - 8 * j)) & 255;
  return b;
}

/* Each record's fields: [name, offset, kind, count], kind s16, s32, u8, a
   C string or a Pascal one (cstr, pstr, count its room) or a group of repeated fields (count
   times NOVA_PILOT_GROUPS[kind]). A field LoadPilotData does not read is
   named for what WritePilotData puts there, or where that is 0 for its
   place (at2006). */
const NOVA_PILOT_LAYOUT = {
  128: [
    ['stellar', 0x0000, 's16'],          // the ship's last stellar (+0x92), its system yours
    ['shipClass', 0x0002, 's16'],
    ['cargo', 0x0004, 's16', 6],         // tons of each commodity
    ['shield', 0x0010, 's16'],           // the ship's shield (+0x54), written and never read
    ['fuel', 0x0012, 's16'],             // 100 a jump
    ['month', 0x0014, 's16'], ['day', 0x0016, 's16'], ['year', 0x0018, 's16'],
    ['explored', 0x001a, 's16', 2048],   // by system: 0 or less not, 1 seen, 2 landed in
    ['outfits', 0x101a, 's16', 512],     // how many of each outfit
    ['legal', 0x141a, 's16', 2048],      // your legal standing in each system (playerRecord)
    ['weapons', 0x241a, 's16', 256],
    ['ammo', 0x261a, 's16', 256],
    ['cash', 0x281a, 's32'],
    ['objectives', 0x281e, 'objective', 16],
    ['missions', 0x295e, 'mission', 16],
    ['bits', 0xb81e, 'u8', 10000],
    ['dominated', 0xdf2e, 'u8', 2048],
    ['escorts', 0xe72e, 's16', 64],      // -1 none; a class, captured; 1000 + a class, hired
    ['fighters', 0xe7ae, 's16', 64],     // -1 none, else a class
    ['upgrade', 0xe82e, 's16', 64],      // each escort: marked for upgrade
    ['sale', 0xe8ae, 's16', 64],         // each captured escort: marked for sale
    ['fighterVoice', 0xe92e, 's16', 64], // each fighter's voice, 0 or 1 (+0xc922, gövt VoiceType)
    ['kills', 0xe9ae, 's32'],            // the combat rating (playerKills)
  ],
  129: [
    ['version', 0x0000, 's16'],
    ['strict', 0x0002, 's16'],           // 1: made for strict play
    ['gender', 0x0004, 's16'],           // 1: male
    ['defense', 0x0006, 's16', 2048],    // each stellar's defense ships left (+0x466)
    ['alive', 0x1006, 's16', 1024],      // each person: still to be met (+0x620)
    ['grudge', 0x1806, 's16', 1024],     // each person: a grudge against you (+0x621)
    ['at2006', 0x2006, 's16', 64],
    ['daysDominated', 0x2086, 's16', 2048], // each stellar: days since the player dominated it (+0x2a), never read
    ['seenIntro', 0x3086, 'u8'],
    ['disasterDays', 0x3088, 's16', 256],
    ['disasterAt', 0x3288, 's16', 256],  // the stellar a disaster is at, -1 none
    ['junk', 0x3488, 's16', 128],        // tons of each jünk
    ['at3580', 0x3580, 'u8', 8],
    ['globalPriceFlux', 0x3588, 's16', 2], // 85 to 115, each landing and jump 1 up, 1 down or the same
    ['localPriceFlux', 0x358c, 's16', 2],  // 90 to 110 at random each jump. No price reads either
    ['cronDuration', 0x3590, 's16', 512],
    ['cronHoldoff', 0x3990, 's16', 512],
    ['reinforceDays', 0x3d90, 's16', 2048], // each system: days before it can call reinforcements again (+0xc4)
    ['destroyed', 0x4d90, 's16', 2048],  // each stellar: days until it is rebuilt, 0 or less not destroyed
    ['escortOrders', 0x5d90, 's16', 4],
    ['nickname', 0x5d98, 'pstr', 64],
    ['paint', 0x5dd8, 's16', 3],         // red, green, blue
    ['ranks', 0x5dde, 's16', 128],
    ['datePrefix', 0x5ede, 'cstr', 16],
    ['dateSuffix', 0x5eee, 'cstr', 16],
    ['at5efe', 0x5efe, 's16', 1024],
  ],
};
const NOVA_PILOT_SIZE = { 128: 0xe9b2, 129: 0x66fe };

/* ESCAPE VELOCITY AND EV OVERRIDE. Their saves are Finder type MpïL and
   OpïL, records 128 and 129 of that type, encrypted as Nova's are with the
   key 0xABCD1234 (EV's 0x167b0c and Override's 0x1617c4, called at 0x12878c
   and 0x11bcf4). Record 129 is read first (EV at 0x128360, Override at
   0x11b884), record 128 after it (0x12875c, 0x11bcc4), and each field's
   address below is where Override's loader reads it; EV's reads the same
   offsets up to the missions. Escape Velocity stops at version 105 alone and
   writes 106 (0x127a20). Override stops at every version except 107, which it writes
   (0x11af48). The two layouts differ in the size of a mission under way
   (382 and 382 + 8 bytes) and the number of control bits (256 and 512),
   which moves every field after the missions. */
function novaElderPilotLayout(evo) {
  const after = evo ? 320 : 0;   // eight missions 8 bytes longer, and 256 more bits
  return {
    128: [
      ['stellar', 0, 's16'],                // 0x11bd14: your stellar, its system yours
      ['shipClass', 2, 's16'],              // 0x11be20
      ['cargo', 4, 's16', 6],               // 0x11be54
      ['fuel', 18, 's16'],                  // 0x11bee4: 100 a jump
      ['month', 20, 's16'], ['day', 22, 's16'], ['year', 24, 's16'], // 0x11bef8 to 0x11bf20, kept as a DateTimeRec
      ['explored', 26, 's16', 1000],        // 0x11bf54: by system, 2 landed in (0x128be0)
      ['outfits', 2026, 's16', 128],        // 0x11be90: how many of each outfit
      ['legal', 2282, 's16', 1000],         // 0x11bf90: your standing in each system, against gövt CrimeTol
      ['weapons', 4282, 's16', 64],         // 0x11bfd4
      ['ammo', 4410, 's16', 64],            // 0x11c000
      ['cash', 4538, 's32'],                // 0x11c024
      ['objectives', 4542, 'elderObjective', 8], // 0x11c074
      ['missions', 4686, evo ? 'evoMission' : 'evMission', 8], // 0x11c0cc, copied whole
      ['bits', 4686 + 8 * 382 + (evo ? 64 : 0), 'u8', evo ? 512 : 256], // 0x11c2a0
      ['dominated', 7998 + after, 'u8', 1500],  // 0x11c2e0
      ['escorts', 9498 + after, 's16', 36],     // 0x11c328: -1 none; a class, captured; 1000 + a class, hired
      ['fighters', 9570 + after, 's16', 36],    // 0x11c3f0: -1 none, else a class
      ['kills', 9642 + after, 's32'],           // 0x11c038: the combat rating
    ],
    129: [
      ['version', 0, 's16'],                // 0x11b8d8
      ['strict', 2, 's16'],                 // 0x11b960: 1, strict play
      ['defense', 4, 's16', 1500],          // 0x11b9cc: each stellar's defense ships left
      ['present', 3004, 's16', 512],        // 0x11ba80: each person's flag (+414), set as the përs are loaded (0x118b9c)
      ['grudge', 4028, 's16', 512],         // 0x11bab8: each person's +415, which with përs Flags 0x1 sets them on you (0x106ba4)
      ['daysDominated', 5180, 's16', 1500], // 0x11b9f8: each stellar, days since you dominated it (0x16c0b8)
      ['disasterDays', 8182, 's16', 128],   // 0x11bb8c
      ['disasterAt', 8438, 's16', 128],     // 0x11bbb8: the stellar a disaster is at, -1 none
      ['junk', 8694, 's16', 128],           // 0x11bbfc: tons of each jünk
      ['at8950', 8950, 's16', 2], ['at8954', 8954, 's16', 2], // 0x11bc3c, 0x11bc64: 100 at a new game (0x153f38)
    ],
  };
}
const NOVA_ELDER_PILOT_KEY = 0xABCD1234;
const NOVA_PILOT_GAMES = {
  nova: { type: 'NpïL', key: NOVA_PILOT_KEY, layout: NOVA_PILOT_LAYOUT, size: NOVA_PILOT_SIZE },
  ev: { type: 'MpïL', key: NOVA_ELDER_PILOT_KEY, layout: novaElderPilotLayout(false), size: { 128: 9646, 129: 8958 } },
  evo: { type: 'OpïL', key: NOVA_ELDER_PILOT_KEY, layout: novaElderPilotLayout(true), size: { 128: 9966, 129: 8958 } },
};

/* A mission under way (0x8ec bytes, copied whole into currentMissions) and
   its objectives (20 bytes, currentMissionObjectives), with DumpPilotLog's
   names. Stellars and dudes are kept as indexes, a mission as its index. */
const NOVA_PILOT_GROUPS = {
  objective: { size: 20, fields: [
    ['active', 0, 'u8'], ['travelObjComplete', 1, 'u8'], ['shipObjComplete', 2, 'u8'], ['missionFailed', 3, 'u8'],
    ['at4', 4, 's16'], ['deadline', 6, 's16', 7],   // a DateTimeRec: year, month, day, hour, minute, second, day of the week
  ] },
  // EV's and Override's: the mission slot (18 bytes, its deadline a DateTimeRec
  // at 4) and the mission under way, its name at 94 and 102 (0x128bb8, 0x11c154)
  elderObjective: { size: 18, fields: [['active', 0, 'u8'], ['deadline', 4, 's16', 7]] },
  evMission: { size: 382, fields: [['name', 94, 'pstr', 32]] },
  evoMission: { size: 390, fields: [['name', 102, 'pstr', 32]] },
  mission: { size: 0x8ec, fields: [
    ['destStellar', 0x00, 's16'], ['at02', 0x02, 's16'], ['returnStellar', 0x04, 's16'],
    ['specialShipCount', 0x06, 's16'], ['specialShipDude', 0x08, 's16'], ['specialShipGoal', 0x0a, 's16'],
    ['specialShipBehavior', 0x0c, 's16'], ['specialShipStart', 0x0e, 's16'], ['specialShipSyst', 0x10, 's16'],
    ['cargoType', 0x12, 's16'], ['cargoQty', 0x14, 's16'], ['pickupMode', 0x16, 's16'], ['dropoffMode', 0x18, 's16'],
    ['scanMask', 0x1a, 's16'], ['compGovt', 0x1c, 's16'], ['compReward', 0x1e, 's16'], ['datePostIncrement', 0x20, 's16'],
    ['at22', 0x22, 'u8', 2], ['pay', 0x24, 's32'],
    ['specialShipsKilled', 0x28, 's16'], ['specialShipsBoarded', 0x2a, 's16'], ['specialShipsDisabled', 0x2c, 's16'],
    ['specialShipsJumpedIn', 0x2e, 's16'], ['specialShipsJumpedOut', 0x30, 's16'], ['initialShipCount', 0x32, 's16'],
    ['canAbort', 0x34, 'u8'], ['cargoLoaded', 0x35, 'u8'], ['at36', 0x36, 'u8', 2],
    ['at38', 0x38, 's16', 8],
    ['timeLeft', 0x48, 's16'], ['nameList', 0x4a, 's16'], ['specialShipNameIndex', 0x4c, 's16'], ['at4e', 0x4e, 's16'],
    ['mission', 0x50, 's16'], ['subtitleList', 0x52, 's16'], ['specialShipSubtitleIndex', 0x54, 's16'],
    ['specialShipPreselectType', 0x56, 's16'], ['flags', 0x58, 's16'], ['flags2', 0x5a, 's16'], ['at5c', 0x5c, 's32', 2],
    ['auxShipCount', 0x64, 's16'], ['auxShipDude', 0x66, 's16'], ['auxShipSyst', 0x68, 's16'],
    ['at6a', 0x6a, 's16'], ['at6c', 0x6c, 's16'], ['auxShipsLeft', 0x6e, 's16'],
    ['name', 0x7e9, 'pstr', 256],
  ] },
};

function novaPilotFields(bytes, base, fields) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = {};
  for (const [name, off, kind, count] of fields) {
    const at = base + off, n = count || 1;
    const one = k => {
      if (kind === 's16') return v.getInt16(at + 2 * k);
      if (kind === 's32') return v.getInt32(at + 4 * k);
      if (kind === 'u8') return bytes[at + k];
      const g = NOVA_PILOT_GROUPS[kind];
      return novaPilotFields(bytes, at + g.size * k, g.fields);
    };
    if (kind === 'cstr') { const s = bytes.subarray(at, at + n), e = s.indexOf(0); out[name] = decodeMacRoman(e < 0 ? s : s.subarray(0, e)); }
    else if (kind === 'pstr') out[name] = decodeMacRoman(bytes.subarray(at + 1, at + 1 + Math.min(bytes[at], n - 1)));
    else out[name] = count ? Array.from({ length: n }, (_, k) => one(k)) : one(0);
  }
  return out;
}

/* A save file's resource fork, read: { name, shipName, pilot, game }, the
   two records' fields; or it throws an Error with the reason the program
   would not open it. `name` is the file's name, which is the pilot's. */
function novaPilotGameOf(fork) {
  return Object.keys(NOVA_PILOT_GAMES).find(k => {
    const list = fork.resourcesByType[novaTypeKey(NOVA_PILOT_GAMES[k].type)];
    return !!list && list.some(e => e.id === 128) && list.some(e => e.id === 129);
  }) || null;
}
const novaHoldsPilot = fork => !!novaPilotGameOf(fork);
// `kind` is the save's game: 'nova', 'ev' or 'evo'.
function novaReadPilot(fork, name) {
  const kind = novaPilotGameOf(fork), G = NOVA_PILOT_GAMES[kind || 'nova'];
  const key = novaTypeKey(G.type), list = fork.resourcesByType[key] || [];
  const rec = id => list.find(e => e.id === id);
  if (!kind) throw new Error(`${name} is not a save file. It has no NpïL, MpïL or OpïL 128 and 129`);
  const bytes = {};
  for (const id of [128, 129]) {
    bytes[id] = novaPilotCrypt(fork.dataOf(key, rec(id)), G.key);
    if (bytes[id].length < G.size[id]) throw new Error(`${name}'s ${G.type} ${id} is ${bytes[id].length} bytes, not ${G.size[id]}`);
  }
  const game = novaPilotFields(bytes[129], 0, G.layout[129]);
  // LoadPilotData stops with one error at 107 and with another at anything else up to 299;
  // Escape Velocity at 105 alone, EV Override at every version except 107
  const v = game.version;
  if (kind === 'nova' && v <= 299) throw new Error(`${name} is a save file of version ${v}, which the game does not open. The game opens 300 and above`);
  if (kind === 'ev' && v === 105) throw new Error(`${name} is a save file of version 105, which Escape Velocity does not open`);
  if (kind === 'evo' && v !== 107) throw new Error(`${name} is a save file of version ${v}, which EV Override does not open. It opens 107`);
  return { name, kind, shipName: rec(129).name.trim(), pilot: novaPilotFields(bytes[128], 0, G.layout[128]), game };
}

/* What the map needs of a save, with the game's ids (an index + 128):
   the bits on and the gender, for the visibility tests (STATE in
   page-map.js); where you are; and the systems and stellars as you left
   them. U is novaUniverse's, for the stellar's system. */
function novaPilotState(p, U) {
  const id = i => i + 128, P = p.pilot, G = p.game;
  const bits = new Set();
  P.bits.forEach((on, i) => { if (on) bits.add(i); });
  const stellar = P.stellar >= 0 ? id(P.stellar) : null, male = G.gender === undefined || G.gender === 1;
  // of the systems the stellar is in, the one shown with the save's bits
  const inSys = stellar === null ? [] : U.inSystems.get(stellar) || [];
  const sys = inSys.find(s => { const v = U.byId.get(s).visibility; return !v || ncbTest(v, { bits, male, registered: true }); }) ?? inSys[0] ?? null;
  const byIndex = (list, keep) => { const m = new Map(); list.forEach((v, i) => { if (keep(v)) m.set(id(i), v); }); return m; };
  return {
    bits, male, registered: true, stellar, system: sys,
    explored: byIndex(P.explored, v => v > 0),
    legal: byIndex(P.legal, v => v !== 0),
    dominated: new Set([...byIndex(P.dominated, v => !!v).keys()]),
    destroyed: byIndex(G.destroyed || [], v => v > 0),
    ranks: [...byIndex(G.ranks || [], v => !!v).keys()],
    outfits: byIndex(P.outfits, v => v > 0),
    weapons: byIndex(P.weapons, v => v > 0),
    escorts: P.escorts.map((v, i) => v < 0 ? null : { cls: id(v % 1000), hired: v >= 1000, upgrade: !!(P.upgrade && P.upgrade[i]), sale: v < 1000 && !!(P.sale && P.sale[i]) }).filter(Boolean),
    fighters: P.fighters.filter(v => v >= 0).map(id),
    missions: P.missions.map((m, i) => (P.objectives[i].active ? Object.assign({ id: m.mission === undefined ? null : id(m.mission), objectives: P.objectives[i] }, m) : null)).filter(Boolean),
  };
}

/* The save's ship as the fields of a copy of its class (novaShipCopy):
   { from, name, change, left }. Its weapons and their ammunition are the
   save's, in the class's eight weapon slots; its outfits are added in as
   the program adds yours to your ship's figures (each field's note in
   nova-fields.js: Holds ModType 2, Shield 4, Armor 6, Accel 7, Speed 8,
   Maneuver 9, its ModVal ÷ 10 as Maneuver is kept in tenths, Fuel 12, 0
   to 32,000, ShieldRech 5, ArmorRech 29, Deionize 39, IonizeMax 40); and
   the eight stock outfit slots have the save's other outfits, first those
   whose kinds a ship not yours has from its stock outfits (cloaking 17,
   fuel 18, targeting 30, scooping 31, jamming 33 to 36, quicker jumps
   37, self-repair 49, boarding 25). Everything else is the class's.
   The weapons and the outfits of those kinds that had no slot are in `left`. */
const NOVA_PILOT_SHIP_ADDS = [['Holds', 2, 1], ['Shield', 4, 1], ['Armor', 6, 1], ['Accel', 7, 1], ['Speed', 8, 1], ['Maneuver', 9, 0.1],
  ['Fuel', 12, 1], ['ShieldRech', 5, 1], ['ArmorRech', 29, 1], ['Deionize', 39, 1], ['IonizeMax', 40, 1]];
const NOVA_STOCK_OUTFIT_KINDS = new Set([17, 18, 25, 30, 31, 33, 34, 35, 36, 37, 49]);
function novaPilotShip(game, save) {
  if (save.kind && save.kind !== 'nova') return null;   // Nova's ship fields alone
  const P = save.pilot, from = P.shipClass + 128, cls = novaGet(game, 'shïp', from);
  if (!cls) return null;
  const mods = o => [[o.ModType, o.ModVal], [o.ModType2, o.ModVal2], [o.ModType3, o.ModVal3], [o.ModType4, o.ModVal4]];
  const change = {}, left = { weapons: [], outfits: [] };
  // the outfits added in
  const sums = new Map(), kept = [];
  P.outfits.forEach((n, i) => {
    const o = n > 0 && novaGet(game, 'oütf', 128 + i);
    if (!o) return;
    for (const [t, v] of mods(o)) sums.set(t, (sums.get(t) || 0) + n * v);
    const kinds = mods(o).map(([t]) => t);
    if (!kinds.includes(1) && !kinds.includes(3)) kept.push({ id: o.id, n, stock: kinds.some(t => NOVA_STOCK_OUTFIT_KINDS.has(t)) });
  });
  const s16 = v => Math.max(-32768, Math.min(32767, Math.round(v)));
  for (const [f, t, k] of NOVA_PILOT_SHIP_ADDS) if (sums.has(t)) change[f] = s16(cls[f] + sums.get(t) * k);
  if ('Fuel' in change) change.Fuel = Math.max(0, Math.min(32000, change.Fuel));
  // the weapons, those you have before ammunition alone
  const weap = [];
  for (let i = 0; i < 256; i++) if ((P.weapons[i] > 0 || P.ammo[i] > 0) && novaGet(game, 'wëap', 128 + i)) weap.push({ id: 128 + i, n: Math.max(0, P.weapons[i]), ammo: Math.max(0, P.ammo[i]) });
  weap.sort((a, b) => (b.n > 0) - (a.n > 0));
  const slots = weap.slice(0, 8), none = { id: -1, n: 0, ammo: 0 };
  while (slots.length < 8) slots.push(none);
  change.WeapType = slots.slice(0, 4).map(w => w.id); change.WeapType2 = slots.slice(4).map(w => w.id);
  change.WeapCount = slots.slice(0, 4).map(w => w.n); change.WeapCount2 = slots.slice(4).map(w => w.n);
  change.AmmoLoad = slots.slice(0, 4).map(w => w.ammo); change.AmmoLoad2 = slots.slice(4).map(w => w.ammo);
  left.weapons = weap.slice(8).filter(w => w.n > 0).map(w => w.id);
  // the stock outfits
  kept.sort((a, b) => b.stock - a.stock);
  const items = kept.slice(0, 8), noItem = { id: -1, n: 0 };
  while (items.length < 8) items.push(noItem);
  change.DefaultItems = items.slice(0, 4).map(o => o.id); change.DefaultItms2 = items.slice(4).map(o => o.id);
  change.ItemCount = items.slice(0, 4).map(o => o.n); change.ItemCount2 = items.slice(4).map(o => o.n);
  left.outfits = kept.slice(8).filter(o => o.stock).map(o => o.id);
  return { from, name: save.shipName || novaNameParts(cls.name).name, change, left };
}
