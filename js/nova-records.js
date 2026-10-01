/* nova-records.js -- EV Nova's record types, field by field.
   =========================================================================

   Every Nova record is a fixed run of big-endian fields, and a table here
   says what they are: a name, a kind, and for a repeated field how many.
   novaRecord(type, bytes) reads one; novaLayout(type) says where each field
   sits, which is what the check holds against the templates.

   WHERE THE TABLES CAME FROM. Written from the Nova Bible (Part II), with
   the field order and widths as Ambrosia's own ResEdit templates give them
   -- the `Templates` file in 1.0.10's Documentation folder. The names are
   the Bible's where it has one. utilities/records_check.mjs holds each table
   to that file's TMPL, offset for offset and width for width, and the values
   read from 1.1.1 to the ConText dump of 1.1.1 in evnova-utils, field for
   field. Two sources, neither of them this file.

   KINDS
     i16   signed word (the templates' DWRD)
     h16   word of flag bits (HWRD), kept as a number, shown in hex
     i32   signed long (DLNG)
     h32   long of flag bits (HLNG)
     rgb   long holding an HTML-style 0xRRGGBB colour (an HLNG)
     str   fixed-width C string, `n` bytes, NUL-padded (Cnnn)
     cstr  C string of any length, to its NUL (CSTR)
     pad   `n` bytes the templates call Unused
   A field with a count repeats; its value is an array.

   A record shorter than its table -- a plug-in written for an older
   version, say -- reads as far as its bytes go, and the fields past the end
   are left out rather than read as zero.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after mac-bytes.js. */

const NOVA_RECORDS = {
  'sÿst': [
    ['xPos', 'i16'], ['yPos', 'i16'],
    ['Con', 'i16', 16], ['Nav', 'i16', 16],
    ['DudeTypes', 'i16', 8], ['Probs', 'i16', 8],
    ['AvgShips', 'i16'], ['Govt', 'i16'], ['Message', 'i16'],
    ['Asteroids', 'i16'], ['Interference', 'i16'],
    ['Person', 'i16', 8], ['PersonProb', 'i16', 8],
    ['BkgndColor', 'rgb'], ['Murk', 'i16'], ['AstTypes', 'h16'],
    ['Visibility', 'str', 256],
    ['ReinfFleet', 'i16'], ['ReinfTime', 'i16'], ['ReinfIntrval', 'i16'],
    ['Unused', 'pad', 16],
  ],
  'spöb': [
    ['xPos', 'i16'], ['yPos', 'i16'], ['Type', 'i16'], ['Flags', 'h32'],
    ['Tribute', 'i16'], ['TechLevel', 'i16'], ['SpecialTech', 'i16', 3],
    ['Govt', 'i16'], ['MinStatus', 'i16'], ['CustPicID', 'i16'], ['CustSndID', 'i16'],
    ['DefenseDude', 'i16'], ['DefCount', 'i16'], ['Flags2', 'h16'],
    ['AnimDelay', 'i16'], ['Frame0Bias', 'i16'], ['HyperLink', 'i16', 8],
    ['OnDominate', 'str', 255], ['OnRelease', 'str', 255],
    ['Fee', 'i32'], ['Gravity', 'i16'], ['Weapon', 'i16'], ['Strength', 'i32'],
    ['DeadType', 'i16'], ['DeadTime', 'i16'], ['ExplodType', 'i16'],
    ['OnDestroy', 'str', 255], ['OnRegen', 'str', 255],
    ['SpecialTech4to8', 'i16', 5],
    ['Unused', 'pad', 16],
  ],
  'nëbu': [
    ['XPos', 'i16'], ['YPos', 'i16'], ['XSize', 'i16'], ['YSize', 'i16'],
    ['ActiveOn', 'str', 255], ['OnExplore', 'str', 255],
    ['Unused', 'pad', 16],
  ],
  'gövt': [
    ['VoiceType', 'i16'], ['Flags', 'h16'], ['Flags2', 'h16'],
    ['ScanFine', 'i16'], ['CrimeTol', 'i16'], ['SmugPenalty', 'i16'], ['DisabPenalty', 'i16'],
    ['BoardPenalty', 'i16'], ['KillPenalty', 'i16'], ['ShootPenalty', 'i16'],
    ['InitialRec', 'i16'], ['MaxOdds', 'i16'],
    ['Classes', 'i16', 4], ['Allies', 'i16', 4], ['Enemies', 'i16', 4],
    ['SkillMult', 'i16'], ['ScanMask', 'h16'],
    ['CommName', 'str', 16], ['TargetCode', 'str', 16],
    ['Require', 'h32', 2], ['InhJam', 'i16', 4],
    ['MediumName', 'str', 64], ['Color', 'rgb'], ['ShipColor', 'rgb'],
    ['Intf', 'i16'], ['NewsPic', 'i16'],
    ['Unused', 'pad', 16],
  ],
  'spïn': [
    ['SpritesID', 'i16'], ['MasksID', 'i16'], ['xSize', 'i16'], ['ySize', 'i16'],
    ['xTiles', 'i16'], ['yTiles', 'i16'],
  ],
  'dësc': [
    ['Description', 'cstr'], ['Graphic', 'i16'], ['Movie', 'str', 32], ['Flags', 'h16'],
  ],
  'düde': [
    ['AIType', 'i16'], ['Govt', 'i16'], ['Booty', 'h16'], ['InfoTypes', 'i16'],
    ['ShipTypes', 'i16', 16], ['Probs', 'i16', 16],
    ['Unused', 'pad', 16],
  ],
  'wëap': [
    ['Reload', 'i16'], ['Count', 'i16'], ['MassDmg', 'i16'], ['EnergyDmg', 'i16'],
    ['Guidance', 'i16'], ['Speed', 'i16'], ['AmmoType', 'i16'], ['Graphic', 'i16'],
    ['Inaccuracy', 'i16'], ['Sound', 'i16'], ['Impact', 'i16'], ['ExplodType', 'i16'],
    ['ProxRadius', 'i16'], ['BlastRadius', 'i16'], ['Flags', 'h16'], ['Seeker', 'h16'],
    ['SmokeSet', 'i16'], ['Decay', 'i16'], ['Particles', 'i16'], ['PartVel', 'i16'],
    ['PartLifeMin', 'i16'], ['PartLifeMax', 'i16'], ['PartColor', 'rgb'],
    ['BeamLength', 'i16'], ['BeamWidth', 'i16'], ['Falloff', 'i16'],
    ['BeamColor', 'rgb'], ['CoronaColor', 'rgb'],
    ['SubCount', 'i16'], ['SubType', 'i16'], ['SubTheta', 'i16'], ['SubLimit', 'i16'],
    ['ProxSafety', 'i16'], ['Flags2', 'h16'], ['Ionization', 'i16'],
    ['HitParticles', 'i16'], ['HitPartLife', 'i16'], ['HitPartVel', 'i16'], ['HitPartColor', 'rgb'],
    ['Recoil', 'i16'], ['ExitType', 'i16'], ['BurstCount', 'i16'], ['BurstReload', 'i16'],
    ['JamVuln', 'i16', 4], ['Flags3', 'h16'], ['Durability', 'i16'], ['GuidedTurn', 'i16'],
    ['MaxAmmo', 'i16'], ['LiDensity', 'i16'], ['LiAmplitude', 'i16'], ['IonizeColor', 'rgb'],
    ['Unused', 'pad', 16],
  ],
  // The templates write a run of four words as one RECT; each is a field
  // with a count of 4 here. They name two runs of four twice (ItemCount,
  // and the weapons' second halves); the second takes a 2 here.
  'shïp': [
    ['Holds', 'i16'], ['Shield', 'i16'], ['Accel', 'i16'], ['Speed', 'i16'], ['Maneuver', 'i16'],
    ['Fuel', 'i16'], ['FreeMass', 'i16'], ['Armor', 'i16'], ['ShieldRech', 'i16'],
    ['WeapType', 'i16', 4], ['WeapCount', 'i16', 4], ['AmmoLoad', 'i16', 4],
    ['MaxGun', 'i16'], ['MaxTur', 'i16'], ['TechLevel', 'i16'], ['Cost', 'i32'],
    ['DeathDelay', 'i16'], ['ArmorRech', 'i16'], ['Explode1', 'i16'], ['Explode2', 'i16'],
    ['DispWeight', 'i16'], ['Mass', 'i16'], ['Length', 'i16'], ['InherentAI', 'i16'],
    ['Crew', 'i16'], ['Strength', 'i16'], ['InherentGovt', 'i16'], ['Flags', 'h16'], ['PodCount', 'i16'],
    ['DefaultItems', 'i16', 4], ['ItemCount', 'i16', 4],
    ['FuelRegen', 'i16'], ['SkillVar', 'i16'], ['Flags2', 'h16'], ['Contributes', 'h32', 2],
    ['Availability', 'str', 255], ['AppearOn', 'str', 255], ['OnPurchase', 'str', 256],
    ['Deionize', 'i16'], ['IonizeMax', 'i16'], ['KeyCarried', 'i16'],
    ['DefaultItms2', 'i16', 4], ['ItemCount2', 'i16', 4], ['Require', 'h32', 2],
    ['BuyRandom', 'i16'], ['HireRandom', 'i16'],
    ['Unused', 'pad', 68],
    ['OnCapture', 'str', 255], ['OnRetire', 'str', 255],
    ['ShortName', 'str', 64], ['CommName', 'str', 32], ['LongName', 'str', 128], ['MovieFile', 'str', 32],
    ['WeapType2', 'i16', 4], ['WeapCount2', 'i16', 4], ['AmmoLoad2', 'i16', 4],
    ['Subtitle', 'str', 64], ['Flags3', 'h16'], ['UpgradeTo', 'i16'],
    ['EscUpgrdCost', 'i32'], ['EscSellValue', 'i32'], ['EscortType', 'i16'],
    ['Unused', 'pad', 16],
  ],
  'shän': [
    ['BaseImageID', 'i16'], ['BaseMaskID', 'i16'], ['BaseSetCount', 'i16'],
    ['BaseXSize', 'i16'], ['BaseYSize', 'i16'], ['BaseTransp', 'i16'],
    ['AltImageID', 'i16'], ['AltMaskID', 'i16'], ['AltSetCount', 'i16'], ['AltXSize', 'i16'], ['AltYSize', 'i16'],
    ['GlowImageID', 'i16'], ['GlowMaskID', 'i16'], ['GlowXSize', 'i16'], ['GlowYSize', 'i16'],
    ['LightImageID', 'i16'], ['LightMaskID', 'i16'], ['LightXSize', 'i16'], ['LightYSize', 'i16'],
    ['WeapImageID', 'i16'], ['WeapMaskID', 'i16'], ['WeapXSize', 'i16'], ['WeapYSize', 'i16'],
    ['Flags', 'h16'], ['AnimDelay', 'i16'], ['WeapDecay', 'i16'], ['FramesPer', 'i16'],
    ['BlinkMode', 'i16'], ['BlinkA', 'i16'], ['BlinkB', 'i16'], ['BlinkC', 'i16'], ['BlinkD', 'i16'],
    ['ShieldImgID', 'i16'], ['ShieldMaskID', 'i16'], ['ShieldXSize', 'i16'], ['ShieldYSize', 'i16'],
    ['GunPosX', 'i16', 4], ['GunPosY', 'i16', 4], ['TurretPosX', 'i16', 4], ['TurretPosY', 'i16', 4],
    ['GuidedPosX', 'i16', 4], ['GuidedPosY', 'i16', 4], ['BeamPosX', 'i16', 4], ['BeamPosY', 'i16', 4],
    ['UpCompressX', 'i16'], ['UpCompressY', 'i16'], ['DnCompressX', 'i16'], ['DnCompressY', 'i16'],
    ['GunPosZ', 'i16', 4], ['TurretPosZ', 'i16', 4], ['GuidedPosZ', 'i16', 4], ['BeamPosZ', 'i16', 4],
    ['Unused', 'pad', 16],
  ],
  'chär': [
    ['startCash', 'i32'], ['startShipType', 'i16'], ['startSystem', 'i16', 4],
    ['startGovt', 'i16', 4], ['startStatus', 'i16', 4], ['startKills', 'i16'],
    ['introPictID', 'i16', 4], ['introPictDelay', 'i16', 4], ['introTextID', 'i16'],
    ['onStart', 'str', 256], ['Flags', 'h16'],
    ['startDay', 'i16'], ['startMonth', 'i16'], ['startYear', 'i16'],
    ['DatePrefix', 'str', 16], ['DateSuffix', 'str', 16],
    ['Unused', 'pad', 16],
  ],
  // The types below are read for their control-bit tests and sets
  // (nova-bits.js); every field is here so that the offsets hold.
  'mïsn': [
    ['AvailStel', 'i16'], ['Unused', 'pad', 2], ['AvailLoc', 'i16'], ['AvailRecord', 'i16'],
    ['AvailRating', 'i16'], ['AvailRandom', 'i16'], ['TravelStel', 'i16'], ['ReturnStel', 'i16'],
    ['CargoType', 'i16'], ['CargoQty', 'i16'], ['PickupMode', 'i16'], ['DropoffMode', 'i16'],
    ['ScanMask', 'h16'], ['Unused', 'pad', 2], ['PayVal', 'i32'], ['ShipCount', 'i16'],
    ['ShipSyst', 'i16'], ['ShipDude', 'i16'], ['ShipGoal', 'i16'], ['ShipBehav', 'i16'],
    ['ShipNameID', 'i16'], ['ShipStart', 'i16'], ['CompGovt', 'i16'], ['CompReward', 'i16'],
    ['ShipSubtitle', 'i16'], ['BriefText', 'i16'], ['QuickBrief', 'i16'], ['LoadCargText', 'i16'],
    ['DropCargText', 'i16'], ['CompText', 'i16'], ['FailText', 'i16'], ['TimeLimit', 'i16'],
    ['CanAbort', 'i16'], ['ShipDoneText', 'i16'], ['Unused', 'pad', 2], ['AuxShipCount', 'i16'],
    ['AuxShipDude', 'i16'], ['AuxShipSyst', 'i16'], ['Unused', 'pad', 2], ['Flags', 'h16'],
    ['Flags2', 'h16'], ['Unused', 'pad', 4], ['RefuseText', 'i16'], ['AvailShipTyp', 'i16'],
    ['AvailBits', 'str', 255], ['OnAccept', 'str', 255], ['OnRefuse', 'str', 255],
    ['OnSuccess', 'str', 255], ['OnFailure', 'str', 255], ['OnAbort', 'str', 255],
    ['Require', 'h32', 2], ['DatePostInc', 'i16'], ['OnShipDone', 'str', 255],
    ['AcceptButton', 'str', 32], ['RefuseButton', 'str', 33], ['DispWeight', 'i16'],
    ['Unused', 'pad', 16],
  ],
  'oütf': [
    ['DispWeight', 'i16'], ['Mass', 'i16'], ['TechLevel', 'i16'], ['ModType', 'i16'], ['ModVal', 'i16'],
    ['Max', 'i16'], ['Flags', 'h16'], ['Cost', 'i32'], ['ModType2', 'i16'], ['ModVal2', 'i16'],
    ['ModType3', 'i16'], ['ModVal3', 'i16'], ['ModType4', 'i16'], ['ModVal4', 'i16'],
    ['Contributes', 'h32', 2], ['Requires', 'h32', 2],
    ['Availability', 'str', 255], ['OnPurchase', 'str', 255], ['OnSell', 'str', 255],
    ['ShortName', 'str', 64], ['LCName', 'str', 64], ['LCPlural', 'str', 65],
    ['ItemClass', 'i16'], ['ScanMask', 'h16'], ['BuyRandom', 'i16'], ['RequireGovt', 'i16'],
    ['Unused', 'pad', 16],
  ],
  'crön': [
    ['FirstDay', 'i16'], ['FirstMonth', 'i16'], ['FirstYear', 'i16'], ['LastDay', 'i16'],
    ['LastMonth', 'i16'], ['LastYear', 'i16'], ['Random', 'i16'], ['Duration', 'i16'],
    ['PreHoldoff', 'i16'], ['PostHoldoff', 'i16'], ['IndNewsStr', 'i16'], ['Flags', 'h16'],
    ['EnableOn', 'str', 255], ['OnStart', 'str', 255], ['OnEnd', 'str', 256],
    ['Contrib', 'h32', 2], ['Require', 'h32', 2], ['NewsGovt', 'i16', 4], ['GovtNewsStr', 'i16', 4],
  ],
  'öops': [
    ['Stellar', 'i16'], ['Commodity', 'i16'], ['PriceDelta', 'i16'], ['Duration', 'i16'],
    ['Freq', 'i16'], ['ActivateOn', 'str', 256], ['Unused', 'pad', 16],
  ],
  'përs': [
    ['LinkSyst', 'i16'], ['Govt', 'i16'], ['AIType', 'i16'], ['Aggress', 'i16'], ['Coward', 'i16'],
    ['ShipType', 'i16'], ['WeapType', 'i16', 4], ['WeapCount', 'i16', 4], ['AmmoLoad', 'i16', 4],
    ['Credits', 'i32'], ['ShieldMod', 'i16'], ['HailPict', 'i16'], ['CommQuote', 'i16'],
    ['HailQuote', 'i16'], ['LinkMission', 'i16'], ['Flags', 'h16'], ['ActivateOn', 'str', 256],
    ['GrantClass', 'i16'], ['GrantCount', 'i16'], ['GrantProb', 'i16'], ['Subtitle', 'str', 64],
    ['Color', 'rgb'], ['Flags2', 'h16'], ['Unused', 'pad', 16],
  ],
  'flët': [
    ['LeadShipType', 'i16'], ['EscortType', 'i16', 4], ['Min', 'i16', 4], ['Max', 'i16', 4],
    ['Govt', 'i16'], ['LinkSyst', 'i16'], ['ActivateOn', 'str', 256], ['Quote', 'i16'],
    ['Flags', 'h16'], ['Unused', 'pad', 16],
  ],
  'bööm': [['FrameAdvance', 'i16'], ['SoundIndex', 'i16'], ['GraphicIndex', 'i16']],
  'röid': [
    ['Strength', 'i16'], ['SpinRate', 'i16'], ['YieldType', 'i16'], ['YieldQty', 'i16'],
    ['PartCount', 'i16'], ['PartColor', 'rgb'], ['FragType1', 'i16'], ['FragType2', 'i16'],
    ['FragCount', 'i16'], ['ExplodType', 'i16'], ['Mass', 'i16'], ['Unused', 'pad', 16],
  ],
  'jünk': [
    ['SoldAt', 'i16', 8], ['BoughtAt', 'i16', 8], ['BasePrice', 'i16'], ['Flags', 'h16'],
    ['ScanMask', 'h16'], ['LCName', 'str', 64], ['Abbrev', 'str', 64],
    ['BuyOn', 'str', 255], ['SellOn', 'str', 255],
  ],
};

const NOVA_KIND_SIZE = { i16: 2, h16: 2, i32: 4, h32: 4, rgb: 4 };

/* Where each field sits: [{ name, kind, index, offset, size }], one entry
   per repetition, `index` null for a field that does not repeat. A `cstr`
   has no fixed place, so a layout stops at the first one and says so with
   `variable: true` on it; what follows it is placed by novaRecord alone. */
function novaLayout(type) {
  const table = NOVA_RECORDS[type];
  if (!table) return null;
  const out = [];
  let off = 0;
  for (const [name, kind, n] of table) {
    if (kind === 'cstr') { out.push({ name, kind, index: null, offset: off, size: null, variable: true }); break; }
    const size = (kind === 'str' || kind === 'pad') ? n : NOVA_KIND_SIZE[kind];
    const reps = (kind === 'str' || kind === 'pad') ? 1 : (n || 1);
    for (let i = 0; i < reps; i++) {
      out.push({ name, kind, index: n && kind !== 'str' && kind !== 'pad' ? i : null, offset: off, size });
      off += size;
    }
  }
  return out;
}

/* The fixed size of a record type, or null when it has a C string of any
   length in it. */
function novaRecordSize(type) {
  const l = novaLayout(type);
  if (!l || l.some(f => f.variable)) return null;
  const last = l[l.length - 1];
  return last.offset + last.size;
}

/* A fixed-width C string: the bytes up to the first NUL, Mac Roman. */
function novaFixedString(b, off, n) {
  let end = off;
  const stop = Math.min(off + n, b.length);
  while (end < stop && b[end] !== 0) end++;
  return decodeMacRoman(b.subarray(off, end));
}

/* One record, read by its table: { field: value }. Fields the bytes do not
   reach are absent. `pad` fields are not returned. */
function novaRecord(type, b) {
  const table = NOVA_RECORDS[type];
  if (!table) throw new Error('no record table for ' + type);
  const rec = {};
  let off = 0;
  const one = kind => {
    const v = kind === 'i16' ? i16be(b, off)
            : kind === 'h16' ? u16be(b, off)
            : kind === 'i32' ? (u32be(b, off) | 0)
            : u32be(b, off);
    off += NOVA_KIND_SIZE[kind];
    return v;
  };
  for (const [name, kind, n] of table) {
    if (kind === 'cstr') {
      let end = off;
      while (end < b.length && b[end] !== 0) end++;
      rec[name] = decodeMacRoman(b.subarray(off, end));
      off = end + 1;
      continue;
    }
    if (kind === 'str' || kind === 'pad') {
      if (off + n > b.length) break;
      if (kind === 'str') rec[name] = novaFixedString(b, off, n);
      off += n;
      continue;
    }
    const size = NOVA_KIND_SIZE[kind];
    if (n) {
      const arr = [];
      for (let i = 0; i < n && off + size <= b.length; i++) arr.push(one(kind));
      if (!arr.length) break;
      rec[name] = arr;
      if (arr.length < n) break;
    } else {
      if (off + size > b.length) break;
      rec[name] = one(kind);
    }
  }
  return rec;
}

/* A record from the game by type and id, with its name and file:
   { id, name, file, ...fields }, or null. */
function novaGet(game, type, id) {
  const r = game.get(type, id);
  if (!r) return null;
  return Object.assign({ id, name: r.name, file: r.file }, novaRecord(type, r.bytes));
}

/* A record's name as the game shows it, and the note after it: the
   program cuts a resource name at its last semicolon and drops the spaces
   before it (Mac 0x131240, which each loader of records calls on the name
   GetResInfo gives it -- the stellars' at 0x124ad0, the ships' at
   0x1290a8, thirteen calls in all). A name with no semicolon is kept
   whole. { name, note }, the note null when there is none. */
function novaNameParts(name) {
  const s = name || '';
  const i = s.lastIndexOf(';');
  if (i < 0) return { name: s, note: null };
  return { name: s.slice(0, i).replace(/ +$/, ''), note: s.slice(i + 1) };
}

/* Every record of a type, ascending by id. */
function novaAll(game, type) {
  return game.list(type).map(e => novaGet(game, type, e.id));
}

/* How a field's value reads in a table of fields: flags in hex, colours as
   #RRGGBB, strings quoted only when empty. */
function novaFieldText(kind, v) {
  if (v === undefined) return '';
  if (Array.isArray(v)) return v.map(x => novaFieldText(kind, x)).join(', ');
  if (kind === 'h16') return '0x' + v.toString(16).toUpperCase().padStart(4, '0');
  if (kind === 'h32') return '0x' + v.toString(16).toUpperCase().padStart(8, '0');
  if (kind === 'rgb') return '#' + (v & 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
  return String(v);
}
