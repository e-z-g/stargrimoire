/* nova-pilot.js -- save files: decrypted and read as the program reads them.
   =========================================================================

   A save file (what the game calls a pilot file, Finder type NpïL) is a
   resource fork with two records of type NpïL, read by Mac 1.1.1's
   LoadPilotData (0x750b5): 128, the pilot -- where you are, your ship and
   what is in it, the date, the systems you have explored, your legal
   standing in each, the missions under way, the control bits, the stellars
   you have dominated, your escorts and your combat rating -- and 129, the
   rest of the game as you left it: strict play, your gender, nickname and
   paint, the defence fleets the stellars have left, which persons are
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
function novaPilotCrypt(bytes) {
  const b = Uint8Array.from(bytes);
  let key = NOVA_PILOT_KEY, i = 0;
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
   named for its place (at0010). */
const NOVA_PILOT_LAYOUT = {
  128: [
    ['stellar', 0x0000, 's16'],          // the ship's last stellar (+0x92), its system yours
    ['shipClass', 0x0002, 's16'],
    ['cargo', 0x0004, 's16', 6],         // tons of each commodity
    ['at0010', 0x0010, 's16'],
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
    ['fighterBay', 0xe92e, 's16', 64],   // each fighter's +0xc922
    ['kills', 0xe9ae, 's32'],            // the combat rating (playerKills)
  ],
  129: [
    ['version', 0x0000, 's16'],
    ['strict', 0x0002, 's16'],           // 1: made for strict play
    ['gender', 0x0004, 's16'],           // 1: male
    ['defense', 0x0006, 's16', 2048],    // each stellar's defence ships left (+0x466)
    ['alive', 0x1006, 's16', 1024],      // each person: still to be met (+0x620)
    ['grudge', 0x1806, 's16', 1024],     // each person: a grudge against you (+0x621)
    ['at2006', 0x2006, 's16', 64],
    ['stellar2a', 0x2086, 's16', 2048],  // each stellar's +0x2a
    ['seenIntro', 0x3086, 'u8'],
    ['disasterDays', 0x3088, 's16', 256],
    ['disasterAt', 0x3288, 's16', 256],  // the stellar a disaster is at, -1 none
    ['junk', 0x3488, 's16', 128],        // tons of each jünk
    ['at3580', 0x3580, 'u8', 8],
    ['globalPriceFlux', 0x3588, 's16', 2],
    ['localPriceFlux', 0x358c, 's16', 2],
    ['cronDuration', 0x3590, 's16', 512],
    ['cronHoldoff', 0x3990, 's16', 512],
    ['system0c4', 0x3d90, 's16', 2048],  // each system's +0xc4
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

/* A mission under way (0x8ec bytes, copied whole into currentMissions) and
   its objectives (20 bytes, currentMissionObjectives), with DumpPilotLog's
   names. Stellars and dudes are kept as indexes, a mission as its index. */
const NOVA_PILOT_GROUPS = {
  objective: { size: 20, fields: [
    ['active', 0, 'u8'], ['travelObjComplete', 1, 'u8'], ['shipObjComplete', 2, 'u8'], ['missionFailed', 3, 'u8'],
    ['at4', 4, 's16'], ['deadline', 6, 's16', 7],   // a DateTimeRec: year, month, day, hour, minute, second, day of the week
  ] },
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
function novaHoldsPilot(fork) {
  const list = fork.resourcesByType[novaTypeKey('NpïL')];
  return !!list && list.some(e => e.id === 128) && list.some(e => e.id === 129);
}
function novaReadPilot(fork, name) {
  const key = novaTypeKey('NpïL'), list = fork.resourcesByType[key] || [];
  const rec = id => list.find(e => e.id === id);
  if (!rec(128) || !rec(129)) throw new Error(`${name} is not a save file: it has no NpïL 128 and 129`);
  const bytes = {};
  for (const id of [128, 129]) {
    bytes[id] = novaPilotCrypt(fork.dataOf(key, rec(id)));
    if (bytes[id].length < NOVA_PILOT_SIZE[id]) throw new Error(`${name}'s NpïL ${id} is ${bytes[id].length} bytes, not ${NOVA_PILOT_SIZE[id]}`);
  }
  const game = novaPilotFields(bytes[129], 0, NOVA_PILOT_LAYOUT[129]);
  // LoadPilotData stops with one error at 107 and with another at anything else up to 299
  if (game.version <= 299) throw new Error(`${name} is a save file of version ${game.version}, which the game does not open: it opens 300 and above`);
  return { name, shipName: rec(129).name.trim(), pilot: novaPilotFields(bytes[128], 0, NOVA_PILOT_LAYOUT[128]), game };
}

/* What the map needs of a save, with the game's ids (an index + 128):
   the bits on and the gender, for the visibility tests (STATE in
   page-map.js); where you are; and the systems and stellars as you left
   them. U is novaUniverse's, for the stellar's system. */
function novaPilotState(p, U) {
  const id = i => i + 128, P = p.pilot, G = p.game;
  const bits = new Set();
  P.bits.forEach((on, i) => { if (on) bits.add(i); });
  const stellar = P.stellar >= 0 ? id(P.stellar) : null, male = G.gender === 1;
  // of the systems the stellar is in, the one shown with the save's bits
  const inSys = stellar === null ? [] : U.inSystems.get(stellar) || [];
  const sys = inSys.find(s => { const v = U.byId.get(s).visibility; return !v || ncbTest(v, { bits, male, registered: true }); }) ?? inSys[0] ?? null;
  const byIndex = (list, keep) => { const m = new Map(); list.forEach((v, i) => { if (keep(v)) m.set(id(i), v); }); return m; };
  return {
    bits, male, registered: true, stellar, system: sys,
    explored: byIndex(P.explored, v => v > 0),
    legal: byIndex(P.legal, v => v !== 0),
    dominated: new Set([...byIndex(P.dominated, v => !!v).keys()]),
    destroyed: byIndex(G.destroyed, v => v > 0),
    ranks: [...byIndex(G.ranks, v => !!v).keys()],
    outfits: byIndex(P.outfits, v => v > 0),
    weapons: byIndex(P.weapons, v => v > 0),
    escorts: P.escorts.map((v, i) => v < 0 ? null : { cls: id(v % 1000), hired: v >= 1000, upgrade: !!P.upgrade[i], sale: v < 1000 && !!P.sale[i] }).filter(Boolean),
    fighters: P.fighters.filter(v => v >= 0).map(id),
    missions: P.missions.map((m, i) => (P.objectives[i].active ? Object.assign({ id: id(m.mission), objectives: P.objectives[i] }, m) : null)).filter(Boolean),
  };
}
