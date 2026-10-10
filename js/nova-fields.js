/* nova-fields.js -- what record fields do, as the program does it.
   =========================================================================

   A note here says what the game does with a field, read from Mac 1.1.1's
   Intel code and nothing else: not the Bible, not the editors' templates,
   not the wiki. Each names the routines it was read from, by the names the
   program carries and their addresses, so it can be read again; a field
   with no note has not been traced. evnova-workbench's tools/fieldtrace.py
   finds where a loader puts each field and which routines use that place;
   where the Bible says otherwise, or leaves out what the code does, a note
   carries `bible`, what it says;
   utilities/fields_check.mjs holds every routine named here to the
   program's own symbols.

   The plug-in editor shows a note beside its field (page-plugin.js), and
   under it, where there is one, what the record's own value means.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js and
   nova-missions.js. */

const NOVA_FIELD_NOTES = {
  'nëbu': {
    XPos: { note: 'With YPos, the top left corner of its rectangle on the galaxy map, where its picture is drawn.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    YPos: { note: 'With XPos, the top left corner of its rectangle on the map.', code: [['MapDialogUpdate', 0xf5d1]] },
    XSize: { note: 'Its rectangle\'s width on the map. A system whose place lies inside it, 8 in from its edges, is in it.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    YSize: { note: 'Its rectangle\'s height on the map; see XSize.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    ActiveOn: { note: 'A test of control bits: while it fails, the nebula is not drawn and arriving in it does nothing. Empty: no test.', code: [['PropagateMissionBitEffects', 0x99676], ['ExploreNebulaeFromSystem', 0x508f], ['MapDialogUpdate', 0xf5d1]] },
    OnExplore: { note: 'Control bits set the first time you arrive in a system inside it while it is active. Empty: none.', code: [['ExploreNebulaeFromSystem', 0x508f], ['EvalMissionBitSetString', 0x99dc5]] },
  },
  'spïn': {
    SpritesID: { note: 'Its frames: an rlë of this id if there is one (rlëD in thousands of colours or more, rlë8 below), else PICT SpritesID cut into frames with MasksID as their mask.', code: [['GetSpriteInfo', 0x1bf80], ['LoadSprites', 0x20541], ['SWCreateSpriteFromRLEResource', 0xa9990], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    MasksID: { note: 'For a PICT sprite, the PICT that masks its frames; unused with an rlë.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    xSize: { note: 'For a PICT sprite, a frame\'s width.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    ySize: { note: 'For a PICT sprite, a frame\'s height.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    xTiles: { note: 'For a PICT sprite, frames across the picture.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    yTiles: { note: 'For a PICT sprite, frames down the picture.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
  },
  'dësc': {
    Description: { note: 'The text shown where the game describes the thing of its number (a ship, outfit, stellar, mission, the intro and the rest).', code: [['LoadDescription', 0x717fe]] },
  },
  'bööm': {
    FrameAdvance: { note: 'How fast it plays: FrameAdvance ÷ 100 frames a step (and as fast its wait runs down before it starts).', code: [['LoadObjectData', 0x771b0], ['HandleExplods', 0x2f5d2]] },
    SoundIndex: { note: 'The sound it makes, 0 to 63: snd 300 + n, heard by distance from you. Anything else: silent.', code: [['CreateExplosion', 0x3f698]] },
    GraphicIndex: { note: 'Its picture, spïn 400 + n.', code: [['SpawnExplod', 0x3f5dc], ['HandleExplods', 0x2f5d2]] },
  },
  'röid': {
    Strength: { note: 'Damage it takes before it breaks (a shot\'s EnergyDmg, a beam\'s MassDmg); at least 1.', code: [['LoadObjectData', 0x771b0], ['HandleAsteroidHit', 0x36637], ['HandleBeams', 0x30295]] },
    SpinRate: { note: 'SpinRate ÷ 100 frames a step, each asteroid turning at 80% to 120% of it, either way.', code: [['SpawnAsteroid', 0x3a233], ['HandleAsteroids', 0x361ac]] },
    YieldType: { note: 'What it leaves when broken: 0 to 6, a commodity; 1000 to 1127, a jünk; anything else, nothing. Scooped up, a box is a ton of it.', code: [['LoadObjectData', 0x771b0], ['DestroyAsteroid', 0xadc9], ['SpawnScoopableBox', 0x3e3c5]] },
    YieldQty: { note: 'How many boxes it leaves: YieldQty × 0.5 to 1.5. Below 0: none.', code: [['DestroyAsteroid', 0xadc9]] },
    PartCount: { note: 'Particles thrown out when it breaks. 0 or less: none.', code: [['DestroyAsteroid', 0xadc9], ['SpawnParticles', 0x44b70]] },
    PartColor: { note: 'Those particles\' colour.', code: [['DestroyAsteroid', 0xadc9]] },
    FragType1: { note: 'One kind of fragment it breaks into: 128 to 143, that röid (0 to 15 as 128 to 143). Anything else: none.', code: [['LoadObjectData', 0x771b0], ['DestroyAsteroid', 0xadc9], ['SpawnSubAsteroid', 0x3fbc7]] },
    FragType2: { note: 'The other kind; with both, each fragment is one or the other at random.', code: [['DestroyAsteroid', 0xadc9], ['SpawnSubAsteroid', 0x3fbc7]] },
    FragCount: { note: 'How many fragments: FragCount ÷ 2 up to just under 1.5 × FragCount.', code: [['DestroyAsteroid', 0xadc9]] },
    ExplodType: { note: 'The explosion when it breaks, as wëap ExplodType. Below 0: none.', code: [['DestroyAsteroid', 0xadc9], ['CreateExplosion', 0x3f698]] },
    Mass: { note: 'How hard it is to push: a hit pushes it by the weapon\'s Impact ÷ Mass, to at most 2 a step; a tractor beam on one of more than twice the firer\'s Mass pulls the ship to it instead.', code: [['HandleAsteroidHit', 0x36637], ['HandleBeams', 0x30295]] },
  },
  'shän': {
    BaseTransp: { note: 'How transparent the base picture is drawn.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    WeapDecay: { note: 'How fast the weapon flash fades once shown, kept × 0.333 a step.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    BlinkMode: { note: 'How its lights blink: 1, in groups (BlinkA steps between blinks, BlinkC blinks a group, BlinkD steps between groups, BlinkB as the lit time); 2, brightening by BlinkB ÷ 100 a step to BlinkC (at most 31) and dimming by BlinkD ÷ 100 to BlinkA; 3, flickering between BlinkA and BlinkB (at most 31); anything else, steady.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    BlinkA: { note: 'Read by BlinkMode: in groups, the steps between blinks; otherwise the dimmest.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkB: { note: 'Read by BlinkMode: in groups, the lit time; 2, the rise a step × 100; 3, the brightest.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkC: { note: 'Read by BlinkMode: in groups, the blinks a group; 2, the brightest.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkD: { note: 'Read by BlinkMode: in groups, the steps between groups; 2, the fall a step × 100.', code: [['HandleShipDisplay', 0x2b514]] },
    BaseImageID: { note: 'The sprite of its base picture: an rlë of this id, else PICT of this id with BaseMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseMaskID: { note: 'For a PICT base sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseXSize: { note: 'For a PICT base sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseYSize: { note: 'For a PICT base sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltImageID: { note: 'The sprite of its alternating picture: an rlë of this id, else PICT of this id with AltMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltMaskID: { note: 'For a PICT alt sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltXSize: { note: 'For a PICT alt sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltYSize: { note: 'For a PICT alt sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowImageID: { note: 'The sprite of its engine glow: an rlë of this id, else PICT of this id with GlowMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowMaskID: { note: 'For a PICT glow sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowXSize: { note: 'For a PICT glow sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowYSize: { note: 'For a PICT glow sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightImageID: { note: 'The sprite of its lights: an rlë of this id, else PICT of this id with LightMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightMaskID: { note: 'For a PICT light sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightXSize: { note: 'For a PICT light sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightYSize: { note: 'For a PICT light sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapImageID: { note: 'The sprite of its weapon flash: an rlë of this id, else PICT of this id with WeapMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapMaskID: { note: 'For a PICT weap sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapXSize: { note: 'For a PICT weap sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapYSize: { note: 'For a PICT weap sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldImgID: { note: 'The sprite of its shield flash: an rlë of this id, else PICT of this id with ShieldMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldMaskID: { note: 'For a PICT shield sprite, the PICT masking its frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldXSize: { note: 'For a PICT shield sprite, a frame\'s width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldYSize: { note: 'For a PICT shield sprite, a frame\'s height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseSetCount: { note: 'How many sets of FramesPer frames the base picture has: the banking, folding or cycling sets Flags uses.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    AltSetCount: { note: 'How many sets of frames the alternating picture has.', code: [['LoadExtendedShipSprites', 0x226af]] },
    Flags: { note: '0x0001: banking, the second set turning left, the third right. 0x0002: folding, a set every AnimDelay, unfolded when idle and folded to jump; 0x0080 with it, folded only to fire. 0x0004: the second set shows while one of its KeyCarried is aboard. 0x0008: the sets cycle every AnimDelay.', code: [['HandleShipDisplay', 0x2b514], ['KeyCarriedShipTypeOnboard', 0x399c]] },
    AnimDelay: { note: 'Steps between its sets as it folds or cycles (Flags).', code: [['HandleShipDisplay', 0x2b514]] },
    FramesPer: { note: 'Frames to a full turn in each set; its heading picks one. 0 or less: 36.', code: [['HandleShipDisplay', 0x2b514], ['LoadExtendedShipSprites', 0x226af]] },
    GunPosX: { note: 'Four exit points for its guns (wëap ExitType), across the ship as it faces up, taken in turn.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    GunPosY: { note: 'Four exit points for its guns, along the ship; turned with the frame shown and squashed by the compressions.', code: [['ModifyShotStartPosition', 0x7348]] },
    GunPosZ: { note: 'Four heights for its guns\' exit points, taken off the point\'s y on screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    TurretPosX: { note: 'Four exit points for its turrets (wëap ExitType), across the ship as it faces up, taken in turn.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    TurretPosY: { note: 'Four exit points for its turrets, along the ship; turned with the frame shown and squashed by the compressions.', code: [['ModifyShotStartPosition', 0x7348]] },
    TurretPosZ: { note: 'Four heights for its turrets\' exit points, taken off the point\'s y on screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    GuidedPosX: { note: 'Four exit points for its guided weapons (wëap ExitType), across the ship as it faces up, taken in turn.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    GuidedPosY: { note: 'Four exit points for its guided weapons, along the ship; turned with the frame shown and squashed by the compressions.', code: [['ModifyShotStartPosition', 0x7348]] },
    GuidedPosZ: { note: 'Four heights for its guided weapons\' exit points, taken off the point\'s y on screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    BeamPosX: { note: 'Four exit points for its beams (wëap ExitType), across the ship as it faces up, taken in turn.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    BeamPosY: { note: 'Four exit points for its beams, along the ship; turned with the frame shown and squashed by the compressions.', code: [['ModifyShotStartPosition', 0x7348]] },
    BeamPosZ: { note: 'Four heights for its beams\' exit points, taken off the point\'s y on screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    UpCompressX: { note: 'Percent the across part of an exit point is kept when the point lies toward the top of the screen; 0 or less, 100.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    UpCompressY: { note: 'Percent the up-down part is kept when the point lies toward the top; 0 or less, 100 (with no shän, 71).', code: [['ModifyShotStartPosition', 0x7348]] },
    DnCompressX: { note: 'As UpCompressX, toward the bottom.', code: [['ModifyShotStartPosition', 0x7348]] },
    DnCompressY: { note: 'As UpCompressY, toward the bottom.', code: [['ModifyShotStartPosition', 0x7348]] },
  },
  'chär': {
    startCash: { note: 'Your credits as a new pilot; below 0, none. With no chär at all: 10,000.', code: [['ActivateCharResource', 0x76cb6]] },
    startShipType: { note: 'Your first ship: 128 and up, that shïp; below, shïp 128.', code: [['ActivateCharResource', 0x76cb6]] },
    startSystem: { note: 'Up to four systems you may start in, one of those 128 and up picked at random; with none, sÿst 128.', code: [['ActivateCharResource', 0x76cb6], ['Rand', 0xa4c76]] },
    startGovt: { note: 'Up to four governments (128 and up): in every system of a government allied to one, your record starts at the startStatus beside it; in every system of one at war with it, at minus that. A later slot overwrites an earlier.', code: [['ActivateCharResource', 0x76cb6], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]] },
    startStatus: { note: 'Your starting record with the startGovt beside it, and minus it with that government\'s enemies.', code: [['ActivateCharResource', 0x76cb6]] },
    startKills: { note: 'Your combat rating as a new pilot.', code: [['ActivateCharResource', 0x76cb6]] },
    introPictID: { note: 'Up to four pictures shown in turn as the new pilot starts; below 128, none.', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1]] },
    introPictDelay: { note: 'Seconds the introPictID beside it is shown, 0 to 300.', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1]] },
    introTextID: { note: 'The dësc shown in a text dialog after the pictures.', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1], ['LoadDescription', 0x717fe]] },
    onStart: { note: 'Control bits set as the pilot starts. Empty: none.', code: [['ActivateCharResource', 0x76cb6], ['EvalMissionBitSetString', 0x99dc5]] },
    Flags: { note: '0x0001: the scenario offered first in the new pilot dialog (the first chär with it). No other bit is read.', code: [['GetDefaultCharResourceName', 0x77100], ['DoNewPilotNameDialog', 0x165cc]] },
    startDay: { note: 'The day of the month the game starts. With no chär: 1.', code: [['ActivateCharResource', 0x76cb6]] },
    startMonth: { note: 'The month the game starts. With no chär: 1.', code: [['ActivateCharResource', 0x76cb6]] },
    startYear: { note: 'The year the game starts. With no chär: 2250.', code: [['ActivateCharResource', 0x76cb6]] },
    DatePrefix: { note: 'Kept as the words written before the game\'s date.', code: [['ActivateCharResource', 0x76cb6]] },
    DateSuffix: { note: 'Kept as the words written after the game\'s date.', code: [['ActivateCharResource', 0x76cb6]] },
  },
  'jünk': {
    BoughtAt: {
      note: 'Up to eight stellars where it is traded at BasePrice × 1.25, or 1.1 where your record is below 0 under a government, or 1.5 where you have dominated the stellar, while BuyOn holds. Of the commodities a stellar so names, the highest-numbered is the one traded there. It takes the trade screen\'s seventh row, where you may buy it or sell it at that one price.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    SoldAt: {
      note: 'Up to eight stellars where it is traded at BasePrice ÷ 1.25, or 1.1 where your record is below 0 under a government, or 1.5 where you have dominated the stellar, while SellOn holds; the highest-numbered so named is the one. It takes the eighth row, where you may buy it or sell it at that one price.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    BasePrice: {
      note: 'Its price before the stellar\'s factor (see BoughtAt and SoldAt).',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    BuyOn: {
      note: 'A test of control bits: while it fails, it is not traded at its BoughtAt stellars. Empty: no test.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    SellOn: {
      note: 'A test of control bits: while it fails, it is not traded at its SoldAt stellars. Empty: no test.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    Flags: {
      note: '0x0001: what you carry of it grows by a ton every 250 frames while your fleet has room in its holds. 0x0002: what you carry of it shrinks by a ton every 250 frames; the room test beside it reads a value only worked out when you also carry 0x0001 cargo, and otherwise whatever was left in its place. With both bits set it grows, and shrinks only when another cargo you carry has 0x0002 alone.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['HandlePlayer', 0x68390], ['TotalFleetHolds', 0xc24d], ['TotalCargo', 0x4a0b]],
    },
    ScanMask: {
      note: 'When a ship of a government whose ScanMask shares a bit with this scans you while you carry it, it is smuggling: your record with that government suffers and you pay its ScanFine, and the ship tells you so, naming it by its LCName.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['ScanPlayer', 0x7e46e], ['SlapWithPenalty', 0x9bbc]],
    },
    LCName: {
      note: 'Its name in the middle of a sentence: in your ship\'s information and when you are caught with it (ScanMask). The trade screen shows the resource\'s own name.',
      code: [['LoadObjectData', 0x771b0], ['SetupPlayerInfoText', 0x53cb8], ['ScanPlayer', 0x7e46e], ['TradeDialogUpdate', 0x4ceea]],
    },
    Abbrev: {
      note: 'Its short name, in the list of your cargo on the status bar.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusCargo', 0x4c313]],
    },
  },
  'öops': {
    Commodity: {
      note: 'Which of the six standard commodities, 0 to 5, the disaster changes: while it lasts, at its stellar, that commodity\'s price is its base price plus PriceDelta, at least 5, whatever the stellar\'s demand.',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    PriceDelta: {
      note: 'Added to the Commodity\'s base price at the stricken stellar while the disaster lasts; the price is kept at 5 or more.',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    Freq: {
      note: 'The chance in 100 each day that the disaster starts, while it is not under way and its ActivateOn holds.',
      code: [['DisasterHandler', 0x41ab9], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    ActivateOn: {
      note: 'A test of control bits: while it fails, the disaster does not start. Empty: no test.',
      code: [['DisasterHandler', 0x41ab9], ['EvalMissionBitTestString', 0x9959e]],
    },
    Stellar: {
      note: 'Where the disaster strikes: 128 and up, that spöb; anything else, a stellar drawn at random when it starts, one that is there now and has Flags 0x20 clear.',
      code: [['DisasterHandler', 0x41ab9], ['Rand', 0xa4c76]],
    },
    Duration: {
      note: 'How many days it lasts once started. Below 0: it never ends.',
      code: [['DisasterHandler', 0x41ab9]],
    },
  },
  'düde': {
    AIType: {
      note: 'How its ships fly: above 0, that AI (1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI, 4 InterceptorAI, above 4 EscortAI); 0 or less, the InherentAI of the ship class drawn.',
      code: [['RandomShipSpawn', 0x3c0f3], ['AIDispatch', 0x8fb52]],
    },
    Govt: {
      note: 'The government of its ships: 128 to 383, that gövt; anything else, none.',
      code: [['LoadObjectData', 0x771b0], ['RandomShipSpawn', 0x3c0f3]],
    },
    ShipTypes: {
      note: 'Up to sixteen ship classes its ships are drawn from: 128 to 895, each with the Probs beside it as its weight. A class whose AppearOn fails is passed over, though a mission\'s ships take one anyway when none is left. Anything else: none.',
      code: [['LoadObjectData', 0x771b0], ['SelectShipFieldFromDude', 0x65c2], ['MissionDudeSpawn', 0x3cd3b]],
    },
    Probs: {
      note: 'The weight of the ShipTypes beside it: a class is drawn with the chance of its Probs over the total of those that may be drawn.',
      code: [['SelectShipFieldFromDude', 0x65c2], ['Rand', 0xa4c76]],
    },
    Booty: {
      note: 'What you find when you board one of its ships. 0x0001 to 0x0020: the six commodities, in order; one of those set is picked at random, and you find half its Holds to all of them in tons of it. 0x0040: credits, 2.5% of its class\'s Cost, or up to just under 5% for a class costing 81,000 or more, at least 1,000; without it, only a përs\'s ship has credits, half to all of the përs\'s Credits. A bit above 0x0040 set with none of 0x0001 to 0x0020 hangs the game when you board: the program draws a commodity forever.',
      code: [['SetPlunderValues', 0x92219], ['Rand', 0xa4c76]],
    },
    InfoTypes: {
      note: 'What its ships say when you hail them; one of the kinds set is picked at random. 0x1000: that a stellar is a good place to buy or sell one of the six commodities, where its price is low or high. 0x2000: the price of a commodity at a stellar where a disaster is under way. 0x4000: a string from STR# 7500 plus the low twelve bits; but the number that picks it is never drawn in this program, so it is the first string until you hail a stellar and almost never one after. 0x8000: one of strings 1 to 5 of STR# 7000 + (its gövt - 128) for a trading ship (an AI of 2 or less), 6 to 10 for others; a plug-in\'s \'STR \' 10010 + 10 × (gövt - 128) + 0 to 4, or 10015 + …, is taken first. None of these: STR# 2002\'s string 175.',
      code: [['LoadAdvice', 0x9133c], ['CalcPortDemand', 0x56b1], ['DoPlanetCommDialog', 0x96949], ['LoadPluginString', 0x71a8e]],
    },
  },
  'flët': {
    LinkSyst: {
      note: 'Where this fleet may be met, as a system\'s AvgShips ships are placed (1 time in 7 each, after the përs chance) or as ships jump in later: -1, anywhere; 128 to 9999, that sÿst (0 to 127 count as 128 to 255); 10000 + n, systems of gövt 128 + n; 15000 + n, of its allies; 20000 + n, of another government; 25000 + n, of its enemies. Each time, one of the 256 fleet places is drawn at random, and the fleet comes only if the place drawn is one that may be met here, so a fleet is likelier where more fleets may be.',
      code: [['SpawnFleet', 0x42704], ['SetupShipsInSystem', 0x42b61], ['HyperShipSpawn', 0x4291a], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['Rand', 0xa4c76]],
    },
    ActivateOn: {
      note: 'A test of control bits: while it fails, this fleet is not met. Empty: no test.',
      code: [['PropagateMissionBitEffects', 0x99676], ['SpawnFleet', 0x42704], ['HyperSpawnFleet', 0x41c8d]],
    },
    LeadShipType: {
      note: 'The class of the fleet\'s lead ship: 128 to 895. Below 128: shïp 128.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    EscortType: {
      note: 'Up to four classes of escort: 128 to 895, each coming Min to Max strong. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    Min: {
      note: 'The fewest of the EscortType beside it: Min plus a number from 0 to Max - Min drawn at random.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76]],
    },
    Max: {
      note: 'The most of the EscortType beside it.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76]],
    },
    Govt: {
      note: 'The government of every ship in the fleet: 128 and up, that gövt; below, none.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    Quote: {
      note: 'Above 0: when the fleet jumps in while you are there, a string picked at random from the STR# of this number, each # in it a random digit, is shown. 0 or less: none.',
      code: [['HyperSpawnFleet', 0x41c8d], ['GetRandomIndString', 0x72ef7], ['DisplayComm', 0x90201]],
    },
    Flags: {
      note: '0x0001: each ship of the fleet whose class has an InherentAI of 2 or less starts with cargo, 1 to Holds tons of one of the six commodities picked at random. No other bit is read.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76], ['DrawStatusCargo', 0x4c313]],
    },
  },
  'sÿst': {
    xPos: {
      note: 'With yPos, where the system is on the galaxy map. Systems at the same place are versions of one another: the lowest-numbered of them whose Visibility holds is the one used.',
      code: [['LoadObjectData', 0x771b0], ['FindFirstCoLocatedSystem', 0x4baa], ['FindActiveCoLocatedSystem', 0x4be0]],
    },
    yPos: {
      note: 'With xPos, where the system is on the galaxy map; see xPos for systems at the same place.',
      code: [['LoadObjectData', 0x771b0], ['FindActiveCoLocatedSystem', 0x4be0], ['DrawMap', 0xe568]],
    },
    Con: {
      note: 'Up to sixteen systems this one links to: 128 to 2175, that sÿst; anything else, none.',
      code: [['LoadObjectData', 0x771b0], ['StellarsAreDistant', 0x9cb9]],
    },
    Nav: {
      note: 'Up to sixteen stellars in the system: 128 to 2175, that spöb; anything else, none.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarSystemVisibility', 0x32aa5]],
    },
    Govt: {
      note: 'The government of the system: 128 to 383, that gövt; anything else, none. Your record here starts at its InitialRec, and the government ranges of LinkSyst, ShipSyst, AuxShipSyst, PayVal and CompReward count the system by it.',
      code: [['LoadObjectData', 0x771b0], ['ResetPlayer', 0x1d40d], ['SpawnPerson', 0x408d5], ['SelectMissionSystem', 0x9b993], ['ValidAuxShipSystem', 0x992b5], ['ApplyMissionPay', 0x98326], ['DoMissionSuccess', 0xa03fc]],
    },
    BkgndColor: {
      note: 'The colour of space while you are in the system.',
      code: [['LoadObjectData', 0x771b0], ['SetSystemBackgroundColor', 0x6af4]],
    },
    Visibility: {
      note: 'A test of control bits: while it fails, the system is not there, nor its stellars, and another version of it at the same place stands for it. Empty: always there.',
      code: [['PropagateMissionBitEffects', 0x99676], ['EvalMissionBitTestString', 0x9959e], ['FindActiveCoLocatedSystem', 0x4be0], ['HandleStellarSystemVisibility', 0x32aa5]],
    },
    Interference: {
      note: 'Less your ship\'s anti-interference, kept between 0 and 100: the chance in 100 each step that your status display is jammed. Also the chance in 100 that a guided shot with Seeker 0x0008 fired here is confused.',
      code: [['HandleStatus', 0x494d7], ['ShipAntiInterference', 0x5f2c], ['SpawnShot', 0x3e550]],
    },
    Murk: {
      note: 'How murky the system is: below 0 as 0, plus the ModVal of every outfit you carry with ModType 28, as many times as you have it, kept between 0 and 100; ships are shaded by it.',
      code: [['PlayerEffectiveMurk', 0x6f8f], ['HandleShipDisplay', 0x2b514], ['HandleSpriteMurkiness', 0x2b42f]],
    },
    Asteroids: {
      note: 'How many asteroids are kept about you: placed when you arrive, and one more at the edge of the screen whenever fewer are about, at most 16. 0 or less: none.',
      code: [['CreateAsteroids', 0x3fa05], ['SpawnAsteroid', 0x3a233]],
    },
    AstTypes: {
      note: 'Which röid types the asteroids are, drawn at random among those set: bit 0x0001 is röid 128, 0x0002 röid 129, and so on to 0x8000, röid 143. 0: no asteroids.',
      code: [['SpawnAsteroid', 0x3a233]],
    },
    DudeTypes: {
      note: 'The düdes the system\'s ships are drawn from: 128 to 639, each with the Probs beside it as its weight. Anything else: none.',
      code: [['SelectDudeFieldFromSystem', 0x674d], ['RandomShipSpawn', 0x3c0f3]],
    },
    Probs: {
      note: 'The weight of the DudeTypes beside it: a düde is drawn with the chance of its Probs over the total of them all, which need not be 100.',
      code: [['SelectDudeFieldFromSystem', 0x674d], ['Rand', 0xa4c76]],
    },
    AvgShips: {
      note: 'How many ships are placed when you enter the system: each is a përs 1 time in 7 (one picked from those that may be met here), else a flët 1 time in 7, else a ship from DudeTypes.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['SpawnFleet', 0x42704], ['RandomShipSpawn', 0x3c0f3], ['Rand', 0xa4c76]],
    },
    Person: {
      note: 'Up to eight përs that may be here as well as those AvgShips brings: each, while not destroyed or captured and its ActivateOn holds, comes when you enter with a chance of its PersonProb in 100.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['EvalMissionBitTestString', 0x9959e]],
    },
    PersonProb: {
      note: 'The chance in 100 that the Person beside it comes when you enter.',
      code: [['SetupShipsInSystem', 0x42b61], ['Rand', 0xa4c76]],
    },
    Message: {
      note: 'Shown when you arrive: entry Message of STR# 1000, or the STR resource numbered Message + 999 where there is one. -1: "Entering the", "Jumping into the" or "Arriving in the", at random, and the system\'s name.',
      code: [['HandlePlayer', 0x68390], ['DisplayMessage', 0x5289], ['LoadPluginString', 0x71a8e]],
    },
    ReinfFleet: {
      note: 'The flët that comes when a ship of a government allied with the fleet\'s calls for help in this system: when the odds against it are more than half the MaxOdds of the fleet\'s government, or, without that test, when a ship you hail comes to help you. While it is on its way, a warship of that side holds out to twice its MaxOdds before it runs, not once. Below 128: none.',
      bible: 'the fleet is called once the odds against ships allied with its government exceed that government\'s MaxOdds, not half of it.',
      code: [['AICallForReinforcements', 0x7f5a1], ['GovtAllies', 0x4e3d], ['WarshipAI', 0x8b729], ['DoCommDialog', 0x956d5], ['LoadObjectData', 0x771b0], ['HandleReinforcements', 0x39048]],
    },
    ReinfTime: {
      note: 'How long the fleet takes to come once called: counted down by the game speed each step, then it arrives from hyperspace. When less than a quarter is left: "Sensors detect" the government\'s name "reinforcement fleet approaching."',
      code: [['AICallForReinforcements', 0x7f5a1], ['HandleReinforcements', 0x39048]],
    },
    ReinfIntrval: {
      note: 'Days before the fleet can be called here again, from its warning or its arrival; at least 1.',
      code: [['HandleReinforcements', 0x39048], ['IncrementGameTime', 0xb516]],
    },
  },
  'shïp': {
    Holds: {
      note: 'Tons of cargo. Yours: plus each ModType 2 outfit\'s ModVal; what you can buy and carry adds the Holds of each ship flying with you under AI 6 whose class has an InherentAI of 2 or less, to 32,000 in all. Below 0: as many tons, but no outfit taking hold space (ModType 2 with a negative ModVal) can be bought for it; otherwise one needs that much room free.',
      code: [['LoadObjectData', 0x771b0], ['ShipTotalHolds', 0x5cb3], ['TotalFleetHolds', 0xc24d], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Shield: {
      note: 'Shield points. Yours: plus each ModType 4 outfit\'s ModVal. A përs\'s ship: × its ShieldMod, a percentage, when above 0. A ship under AI 5, the program\'s for launched fighters and ships you capture: × 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipShieldCapacity', 0x2995]],
    },
    Accel: {
      note: 'Accel ÷ 10,000 is its acceleration, each 30th of a second. Yours: plus each ModType 7 outfit\'s ModVal ÷ 10,000. Not yours: × its skill (SkillVar) × its government\'s SkillMult ÷ 100, then × 2; a third while another ship\'s tractor beam holds it; less by its ionization, at most 70% (IonizeMax); Flags 0x0400 makes it 0.',
      code: [['LoadObjectData', 0x771b0], ['ShipAccelRate', 0x353b]],
    },
    Speed: {
      note: 'Speed ÷ 100 is its top speed, each 30th of a second. Yours: plus each ModType 8 outfit\'s ModVal ÷ 100; then, for you and the ships flying with you, × 1.5 unless the pilot was made for strict play. Not yours: × its skill (SkillVar) × its government\'s SkillMult ÷ 100; a third while another ship\'s tractor beam holds it; Flags 0x0400 makes it 0.',
      code: [['LoadObjectData', 0x771b0], ['ShipMaxSpeed', 0x36f2], ['DoNewPilotNameDialog', 0x165cc]],
      bible: 'Top speed. 300 is also an average value here.',
    },
    Maneuver: {
      note: 'Maneuver ÷ 10 is its turn, in degrees each 30th of a second. Yours: plus each ModType 9 outfit\'s ModVal ÷ 100, at least 1 if the class turns at all. Not yours: a third while another ship\'s tractor beam holds it. A class turning 1 or more turns at least 1; then less by its ionization, at most 70%, unless it is jumping.',
      code: [['LoadObjectData', 0x771b0], ['ShipTurnRate', 0x32f7]],
    },
    Fuel: {
      note: 'Units of fuel; a jump takes 100. Yours: plus each ModType 12 outfit\'s ModVal, 0 to 32,000. A ship not yours jumps out of a system only if its class has 100 or more; a përs\'s ship with Flags2 0x0001 also needs 100 aboard.',
      code: [['ShipFuelCapacity', 0x2f21], ['HandlePlayer', 0x68390], ['AIShipHasFuelForJump', 0x7f48f]],
    },
    FreeMass: {
      note: 'Tons for outfits. Yours: less each outfit\'s Mass for each one carried, an outfit with Flags 0x0400 weighing that percentage of this class\'s Mass when that is more; below 0 counts as 0. Its stock weapons and their ammunition take none of it, their outfits\' Mass being added to it at loading (WeapType). An outfit is sold to you only while its Mass fits (or is 0 or less).',
      code: [['ShipFreeMass', 0xb462], ['LoadObjectData', 0x771b0], ['AdjustedItemMass', 0x2889], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Armor: {
      note: 'Armor points. Yours: plus each ModType 6 outfit\'s ModVal. A përs\'s ship: × its ShieldMod, a percentage, when above 0. A ship under AI 5 (as Shield): × 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipArmorCapacity', 0x2bc0]],
    },
    DispWeight: {
      note: 'The shipyard lists the classes on offer highest DispWeight first, classes of equal DispWeight by id (but see Flags3 0x4000).',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    DeathDelay: {
      note: 'Steps its ships break up for once their armor is gone, with small explosions (Explode1) over them, 1 in 8 a step while 60 or more are left, 1 in 4 from 40, 1 in 2 from 20, then every step. At the end a ship of Mass 100 or more, without Flags 0x0400, blasts every ship within Mass × 0.075 + 50 for Mass × 0.0375 + 25 damage, which can disable but not kill; then Explode2, and it is gone.',
      code: [['HandleShipDisplay', 0x2b514], ['DamageShip', 0x3a807], ['CreateExplosion', 0x3f698]],
      bible: '0 to 59: the ship disintegrates for this number of frames and then disappears in a single fireball. 60 and up: then a huge explosion, its size proportional to the ship\'s mass.',
    },
    Explode1: {
      note: 'The explosion shown over its ships as they break up (DeathDelay): 0 to 63, bööm 128 + n; 1000 to 1063, a big one with smaller ones round it; anything else, none.',
      code: [['HandleShipDisplay', 0x2b514], ['CreateExplosion', 0x3f698]],
    },
    Explode2: {
      note: 'The explosion when one of its ships is gone, after DeathDelay, or at once when it touches a deadly stellar: values as Explode1; the big kind spreads over the blast of a ship of Mass 100 or more.',
      code: [['HandleShipDisplay', 0x2b514], ['HandleDeadlyStellars', 0x39ccd], ['CreateExplosion', 0x3f698]],
    },
    Length: {
      note: 'Shown in the ship\'s description; nothing else reads it.',
      code: [['ShipDescDialogUpdate', 0x4f915]],
    },
    Flags: {
      note: '0x0001, 0x0002, 0x0004: its jumps run at 0.7, 1.3 or 1.6 times the usual pace, the first bit set counting. 0x0008: its FuelRegen works for you. 0x0010: it is disabled at a tenth of its armor, not a third. 0x0020: a ship not yours has an afterburner when your kills ÷ shïp 128\'s Strength reach 256 + a number to 1,343 drawn for it; 0x0040: always. 0x0100 and 0x0200 change what the target display shows of its shields and armor. 0x0400: a planet-type ship: only weapons with wëap Flags2 0x0400 hit it, and those hit nothing else; not yours, it does not move; a tractor beam cannot hold it; it leaves no blast. 0x1000, 0x2000, 0x4000: its turrets cannot fire within 45° of ahead, from 45° to 135° off, or beyond 135°. 0x8000: carried in your fighter bay, it is your escape ship: you eject into it.',
      code: [['LoadObjectData', 0x771b0], ['HandleShip', 0x33581], ['ShipFuelGenRate', 0x2ffb], ['IsDisabled', 0x2ce6], ['AIHasAfterburner', 0x64f5], ['DrawStatusTarg', 0x4ace1], ['ShotCanHitShip', 0x4477e], ['AIFireGun', 0x7feb6], ['ShipAccelRate', 0x353b], ['HandleBeams', 0x30295], ['TurretBlindSpot', 0xb325], ['EscapeShipType', 0x38d0]],
      bible: '0x0001, slow jumping (75% normal speed); 0x0002, semi-fast (125%); 0x0004, fast (150%).',
    },
    Flags2: {
      note: '0x0001: its ships swarm. 0x0002: they hold off at 0.85 of their longest reach. 0x0004: it cannot be targeted: your targeting keys and mouse pass it over, and AI ships fire no missiles or turrets at it. 0x0008: point defense fires on it. 0x0010: as your escort it speaks no reply to your orders. 0x0020: it jumps without slowing down. 0x0040: it is inertialess. 0x0080: the warship, interceptor and escort AIs change its orders when it is out of ammunition. 0x0100 to 0x0800: as an AI ship it cloaks while a weapon is in burst reload (0x0100), while running away (0x0200), while jumping (0x0400), while flying about (0x0800); 0x1000: it stays cloaked while attacking until within 165 of its target on both axes, or while mining. 0x2000: it cloaks while idle. 0x4000: attacked by a ship it is not fighting, it cloaks at once, its burst weapons put into their burst reload. An escort in formation behind a cloaked lead cloaks too.',
      code: [['AIDoSwarming', 0x80250], ['HighLevelAIHandler', 0x8d453], ['FindNearestShipToPlayer', 0x923f], ['HandleMouse', 0x37fba], ['AIFireMissile', 0x8115d], ['AIFireTurret', 0x80ad3], ['HandleShipPointDefense', 0x392c4], ['IssueNewEscortCommand', 0x660d5], ['SpeakVoiceMessage', 0x44558], ['ShipCanExpiditeJumps', 0x7872], ['ShipIsInertialess', 0x79c2], ['AIShipIsOutOfAmmo', 0x7f71f], ['AIHandleCloaking', 0x833e1], ['DamageShip', 0x3a807]],
    },
    PodCount: {
      note: 'How many escape pods its ships launch as they break up (DeathDelay): the first at once, then one every DeathDelay ÷ PodCount × 0.4 frames, at least 10 apart. 0 or less: none.',
      code: [['RandomShipSpawn', 0x3c0f3], ['HandleShip', 0x33581], ['SpawnEscapePod', 0x45547]],
      bible: 'At a rate of one per second.',
    },
    Mass: {
      note: 'Days a jump takes: 1 under 100, 2 from 100 to 199, 3 from 200; yours plus each ModType 22 outfit\'s ModVal, at least 1. From 100 it is a larger blip on the radar. A tractor beam takes hold of it only when the firing ship\'s Mass is at least ¾ of this; 0 or less, or Flags 0x0400, and it is never held. Only a ship of 100 or more is tested for giving up a hopeless chase.',
      code: [['ShipHyperTransitTime', 0x43d0], ['DrawStatusRadar', 0x496e0], ['HandleBeams', 0x30295], ['AIEvalHopelessChase', 0x80ea9]],
    },
    InherentAI: {
      note: 'The AI of its ships wherever a düde, mission or përs leaves it 0 or less (1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI, 4 InterceptorAI; 0 or less, none runs). 2 or less is a trading ship: as your escort it carries cargo for you (Holds), a fleet\'s ship starts with cargo (flët Flags), and missions and persons can ask for one in your ship (mïsn Flags, përs Flags); above 2, as your escort it adds to your capture odds (Crew).',
      code: [['RandomShipSpawn', 0x3c0f3], ['AIDispatch', 0x8fb52], ['TotalFleetHolds', 0xc24d], ['HyperSpawnFleet', 0x41c8d], ['SetPlunderValues', 0x92219]],
    },
    InherentGovt: {
      note: 'Two governments for every ship of the class: 128 to 383, that gövt as both; 1128 to 1383, less 1000, the attributes government only; 2128 to 2383, less 2000, the combat government only; anything else, neither. The combat government is what others take it for: a warship picks it as a target, and a stellar as a threat, when it is their enemy, and it counts among a ship\'s friends when it is an ally. The attributes government gives it that government\'s jamming and decides whether it calls for help, and is read where it hails, is captured or flies as an escort.',
      code: [['LoadObjectData', 0x771b0], ['SelectWarshipTarget', 0x89d5e], ['IsThreatToStellar', 0x9ef7], ['AIShipFriendStrength', 0x825a8], ['ShipECM', 0x3aff], ['AICallForHelp', 0x82ffb], ['DoCommDialog', 0x956d5], ['DoShipCapture', 0x41120], ['IssueNewEscortCommand', 0x660d5]],
    },
    Crew: {
      note: 'Your odds of capturing a ship you board, in percent: 10 × your crew ÷ its Crew, your crew being your class\'s Crew, plus each ModType 25 outfit\'s ModVal, plus a tenth of the Crew of each escort flying with you under AI 6 whose class has an InherentAI above 2. Then + 10 if your Strength, so counted, is more than 5 × its Strength; + each negative ModType 25 outfit\'s ModVal made positive; ± 5 at random; 1 to 75. 0 against a ship of a government with Flags 0x0800, while the game is unregistered, or when you cannot take on another escort.',
      code: [['SetPlunderValues', 0x92219], ['CanHireEscorts', 0x5795], ['Rand', 0xa4c76]],
    },
    Strength: {
      note: 'Its weight in the odds ships weigh before fighting or running: its Strength × the share of its shield left (¼ to 1), with its friends\', against the Strength of those against it (a warship runs when they pass its government\'s MaxOdds). Yours counts × your kills ÷ (6,400 × shïp 128\'s Strength), 1 to 2. In boarding, see Crew.',
      code: [['AIShipFriendStrength', 0x825a8], ['AICalculateOddsAgainst', 0x84a2e], ['SetPlunderValues', 0x92219]],
    },
    WeapType: {
      note: 'Four stock weapons, and four more in WeapType2: 128 to 383, that wëap; anything else, none. Every ship of the class carries them: yours when you buy, capture or start in one, and every ship spawned of it. A weapon named twice keeps the later count. At loading, the Mass of the first outfit of ModType 1 naming each weapon × its WeapCount, and of the first of ModType 3 naming its ammunition × its AmmoLoad, is added to FreeMass, so they take none of it.',
      code: [['LoadObjectData', 0x771b0], ['AdjustedItemMass', 0x2889], ['RandomShipSpawn', 0x3c0f3], ['DoShipyardDialog', 0x5e679], ['DoShipCapture', 0x41120]],
    },
    WeapCount: {
      note: 'How many of the WeapType beside it. 0 or less: none, though its AmmoLoad still counts.',
      code: [['LoadObjectData', 0x771b0]],
    },
    AmmoLoad: {
      note: 'Ammunition for the WeapType beside it, for a weapon that uses it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0]],
    },
    WeapType2: {
      note: 'Four more stock weapons, after WeapType\'s, read the same way.',
      code: [['LoadObjectData', 0x771b0]],
    },
    WeapCount2: {
      note: 'How many of the WeapType2 beside it, as WeapCount.',
      code: [['LoadObjectData', 0x771b0]],
    },
    AmmoLoad2: {
      note: 'Ammunition for the WeapType2 beside it, as AmmoLoad.',
      code: [['LoadObjectData', 0x771b0]],
    },
    MaxGun: {
      note: 'How many fixed guns, outfits with Flags 0x0001, you can carry. Yours: plus each ModType 45 outfit\'s ModVal. 0 or less: none.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    MaxTur: {
      note: 'How many turrets, outfits with Flags 0x0002, you can carry. Yours: plus each ModType 46 outfit\'s ModVal. 0 or less: none.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    ShieldRech: {
      note: 'ShieldRech ÷ 1,000 shield points come back each 30th of a second, so ShieldRech × 0.03 a second; 0 or less, none. Yours: plus each ModType 5 outfit\'s ModVal ÷ 1,000. A ship under AI 5: × 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipShieldRechargeRate', 0x2abb], ['HandleShip', 0x33581]],
    },
    ArmorRech: {
      note: 'ArmorRech ÷ 1,000 armor points come back each 30th of a second, so ArmorRech × 0.03 a second; 0 or less, none, and none while it is disabled. Yours: plus each ModType 29 outfit\'s ModVal ÷ 1,000, and × 50 while the cheats are on. A ship under AI 5: × 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipArmorRechargeRate', 0x2e0e], ['IsDisabled', 0x2ce6], ['HandleShip', 0x33581]],
    },
    SkillVar: {
      note: 'A ship\'s skill is (100 - SkillVar + a number from 0 to 2 × SkillVar drawn at random) ÷ 100; for a ship not yours it multiplies Accel and Speed. A fleet\'s or përs\'s ship draws it from shïp 128\'s SkillVar, before it is given its own class.',
      code: [['RandomSkillLevel', 0x6922], ['GenericRandomShipSpawn', 0x3c89f], ['Rand', 0xa4c76]],
      bible: 'This affects acceleration and turn rate for each ship. Values from 1 to 50% are valid.',
    },
    Deionize: {
      note: 'Deionize ÷ 100 of its ionization wears off each 30th of a second; 0 or less, 1. Yours: plus each ModType 39 outfit\'s ModVal ÷ 100.',
      code: [['LoadObjectData', 0x771b0], ['ShipDeionizationRate', 0x6ec3], ['HandleShip', 0x33581]],
    },
    IonizeMax: {
      note: 'Its ionization over IonizeMax is how far it is ionized, which slows its acceleration, top speed and turning by as much, at most 70%. Yours: plus each ModType 40 outfit\'s ModVal. 0 or less: never slowed.',
      code: [['LoadObjectData', 0x771b0], ['ShipIonizationFactor', 0x3225]],
    },
    Availability: {
      note: 'A test of control bits: while it fails, the class cannot be bought, and with Flags3 0x0100 it is not shown in the shipyard. Empty: no test.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['SetupPortAvailableShipTypes', 0xbbe3], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnPurchase: {
      note: 'Control bits set when you buy a ship of this class, and when it is the ship you are given after escaping in a pod. Empty: none.',
      code: [['DoShipyardDialog', 0x5e679], ['HandlePlayer', 0x68390], ['ResetPlayer', 0x1d40d], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnCapture: {
      note: 'Control bits set when you capture a ship of this class. Empty: none.',
      code: [['DoShipCapture', 0x41120], ['DoPlunderDialog', 0x9302b], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRetire: {
      note: 'Control bits set when you leave a ship of this class: trading it in at a shipyard, taking a ship you capture in its place, or escaping from it in a pod. Empty: none.',
      code: [['DoShipyardDialog', 0x5e679], ['DoShipCapture', 0x41120], ['HandlePlayer', 0x68390], ['HasEscapePod', 0xb83d], ['EvalMissionBitSetString', 0x99dc5]],
    },
    ShortName: {
      note: 'Its name in the shipyard\'s list; "\\n" in it splits it over two lines, and a line starting with a letter or digit is drawn white.',
      code: [['LoadObjectData', 0x771b0], ['ShipyardDialogUpdate', 0x58a10], ['SplitTwoLineString', 0x7dc1]],
    },
    CommName: {
      note: 'Its name in the hail and escort dialogs.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5], ['DoEscortDialog', 0x951ee]],
    },
    LongName: {
      note: 'Its full name: in the shipyard and the ship\'s description, in the message a new pilot starts with, and in messages about your ship in flight.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['ShipDescDialogUpdate', 0x4f915], ['DoNewPilot', 0x18b0a], ['HandlePlayer', 0x68390]],
    },
    MovieFile: {
      note: 'A movie played on a loop in the shipyard while the class is picked.',
      code: [['LoadObjectData', 0x771b0], ['ShipyardFilter', 0x60449], ['StartLoopingMovie', 0x60266]],
    },
    Subtitle: {
      note: 'Shown under its name in the target display, unless the ship is a përs\'s with a Subtitle of its own, and under your ship on the main screen.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1], ['MainScreenUpdate', 0x17c0d]],
    },
    KeyCarried: {
      note: 'A class (128 to 895) it carries as fighters, its key: aboard while one of its fighter bays holds one or more. Its shän with Flags 0x0004 shows its second set of frames, and its weapons with wëap Flags2 0x0080 fire, only then. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['KeyCarriedShipTypeOnboard', 0x399c], ['HandleShipDisplay', 0x2b514], ['WeaponHasAmmo', 0xb95a]],
    },
    EscortType: {
      note: 'Its group among your escorts: 0 fighter, 1 medium, 2 warship, 3 freighter. Anything else is worked out at loading: 3 for an InherentAI of 2 or less, else 0 below Mass 50, 1 below 200, 2 from 200. The group also gives the class 80 (fighter), 90 (medium) or 100: a turret\'s shot rolls 1 to its firer\'s, and misses a ship that is not disabled when the roll is over the target\'s.',
      code: [['LoadObjectData', 0x771b0], ['DrawEscortMenuInFrame', 0x56268], ['ShotCanHitShip', 0x4477e]],
    },
    AppearOn: {
      note: 'A test of control bits: while it fails, ships of this class are not drawn from a düde (a mission\'s ships aside, when no other class is left). Empty: no test.',
      code: [['PropagateMissionBitEffects', 0x99676], ['SelectShipFieldFromDude', 0x65c2]],
    },
    TechLevel: {
      note: 'Offered in a stellar\'s shipyard whose TechLevel is at least this, or one of whose SpecialTech is this. Below 0: in none.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    Cost: {
      note: 'What the shipyard asks is this less a trade-in, never below 0: a quarter of your own ship\'s Cost and half the Cost of each outfit you carry, some outfits aside. Each is multiplied by the PriceMod of every rank you hold with a government allied to the stellar\'s, the trade-in twice over; at a stellar of TechLevel 5 or less, a ship of lower TechLevel costs 3% less for each level between (from 100 credits), the trade-in again twice; and each is rounded down to 10 credits above 100, 100 above 10,000, 1,000 above 100,000.',
      bible: 'the price is the new ship\'s Cost less 25% of the original cost of your current ship and upgrades; it says nothing of outfits at half, nor of the PriceMods and TechLevel.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['PlayerShipTradeInPrice', 0xb079], ['ApplyPriceAndTechnologyFlux', 0x4e6cd], ['DoPortDialog', 0x5f911]],
    },
    BuyRandom: {
      note: 'The chance in 100 it is offered on a given day: it is offered while BuyRandom is at least a number from 1 to 100 drawn for its class each day. 0: never.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    HireRandom: {
      note: 'The chance in 100 it is offered for hire on a given day: it is offered while HireRandom is at least a number from 1 to 100 drawn for its class each day. 0: never. In an unregistered copy, the state in which the program sends its nag ship, Captain Hector, the draw is passed by and every class above 0 is offered every day.',
      bible: 'says nothing of the unregistered copy.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['SpawnNagShip', 0x5fdb]],
    },
    Require: {
      note: 'It can be bought only when the Contributes bits of your ship and outfits include every bit set here. With Flags3 0x0200 it is not shown in the shipyard either until then; without, it is shown and cannot be bought.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableShipTypes', 0xbbe3], ['GetPlayerContributeBits', 0x76b2]],
    },
    UpgradeTo: {
      note: 'The ship class an escort of this class that you own (not a hired one) becomes when you have marked it in the escort dialog ("Will be upgraded at next shipyard") and land at a shipyard with its EscUpgrdCost in hand. Below 128: it cannot be ("This ship class cannot be upgraded.").',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['LoadObjectData', 0x771b0]],
    },
    EscUpgrdCost: {
      note: 'Credits taken for that upgrade, at the shipyard; with fewer, it waits.',
      code: [['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    EscSellValue: {
      note: 'Credits paid to you when you land at a shipyard for an escort of this class marked "Will be sold off at next shipyard", and it leaves. Only escorts you own, not hired ones, and not while disabled. 0 or less: a tenth of its Cost.',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    DefaultItems: {
      note: 'An outfit a ship of this class comes with, ItemCount of it: 128 to 639 is that oütf; anything else, none. Added to yours when you buy one at a shipyard, start a new pilot in one, capture one, or a set expression gives you one. DefaultItms2 is four more of the same.',
      bible: '128 to 255.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['DoNewPilot', 0x18b0a], ['DoShipCapture', 0x41120], ['EvalSetExp', 0x150fc]],
    },
    ItemCount: {
      note: 'How many of the DefaultItems beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    DefaultItms2: {
      note: 'Four more DefaultItems, read the same way, with ItemCount2.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    ItemCount2: {
      note: 'How many of the DefaultItms2 beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    Contributes: {
      note: 'Added to your bits while you fly this class. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
    FuelRegen: {
      note: 'One unit of Fuel back every FuelRegen steps, times the game speed, up to what it can hold. 0 or less: none. Your own ship regains it only with Flags 0x0008.',
      code: [['ShipFuelGenRate', 0x2ffb], ['HandleShip', 0x33581]],
    },
    Flags3: {
      note: '0x0001 and 0x0002: a ship not following another flies as a miner: with 0x0001 it parks where there are no asteroids; with 0x0002 it goes between the nearest stellars, and coasts 100 to 174 steps, not 300 to 499, when idle. 0x0020: a planet\'s Gravity does not pull it, and deadly stellars do not harm it. 0x0040: its turrets\' shots are drawn above the ships. 0x0100: not shown in the shipyard while its Availability fails; 0x0200, while its Require is not met. 0x4000: while it is on offer, every higher-numbered class of the same DispWeight is not. 0x0010 is not read.',
      code: [['AIDispatch', 0x8fb52], ['MinerAI', 0x8b202], ['HighLevelAIHandler', 0x8d453], ['ShipResistsGravity', 0x7b10], ['ShipResistsDeadlyStellars', 0x7bbe], ['SpawnShot', 0x3e550], ['SetupPortAvailableShipTypes', 0xbbe3]],
      bible: '0x0010, the ship ignores gravity; 0x0020, it ignores deadly stellars.',
    },
  },
  'gövt': {
    VoiceType: {
      note: 'Its ships\' spoken messages: snd resources from 1000 + 100 × VoiceType, ten more for each kind of message, one of those there picked at random. -1: none.',
      code: [['HandleVoiceSound', 0x31e20]],
    },
    Flags: {
      note: '0x0001: every government not its ally, and every independent ship, is its enemy (Enemies). 0x0004: its warships go for you whenever they see you. 0x0008: your shots, and your fleet\'s, do not hit its ships. 0x0010: its warships run when their shields fall below 30% or 15% of full, by their aggression, or a përs\'s own share; without it they fight on. 0x0040: its warships leave you be, and your fleet\'s shots and its ships\' do not hit each other. 0x0080: the jamming of its ships not yours is halved (InhJam). 0x0100: a përs\'s ship of it launches no escape pod. 0x0200: its warships take bribes; 0x2000, its freighters; 0x4000, its stellars. 0x0400: its ships cannot be hailed. 0x0800: its ships are derelicts, always disabled, no one\'s ally or enemy, and no penalty follows from what you do to them. 0x1000: its warships fly the pirate warship AI, plundering before they destroy. 0x0002: its warships go for you in other governments\' and independent systems too, below -2 × CrimeTol there. 0x0020: other governments\' warships do not come to help its ships when they are attacked. 0x8000: its ships ask a bigger bribe, 10,000 + 1,000 × a number to your credits ÷ 10,000 (else 3,000 + 1,000 × one to your credits ÷ 2,000,000), and its stellars half as much again and always take one; a bribe is at most a third of your credits.',
      code: [['GovtEnemies', 0x4f22], ['WarshipAI', 0x8b729], ['AIMakeShipAttackPlayer', 0x89c3e], ['ShotCanHitShip', 0x4477e], ['ShipECM', 0x3aff], ['HandleShip', 0x33581], ['DoCommDialog', 0x956d5], ['DoPlanetCommDialog', 0x96949], ['HandlePlayerCommunication', 0x61f48], ['IsDisabled', 0x2ce6], ['GovtAllies', 0x4e3d], ['SlapWithPenalty', 0x9bbc], ['AIDispatch', 0x8fb52], ['PirateWarshipAI', 0x8c2d2], ['SelectWarshipTarget', 0x89d5e], ['DoGoodSamaritan', 0x82823]],
      bible: '0x0010: warships of this govt will retreat when their shields drop below 25%. 0x0080: freighters (AI types 1 and 2) have 50% of the standard InherentJam value for warships.',
    },
    Flags2: {
      note: '0x0001: the hail dialog\'s request for help is not offered with its ships. 0x0002 and 0x0004: how its systems count in drawing the political boundaries on the map. 0x0008: its ships do not call for help. 0x0010: its ships help you, repairing or refuelling, without asking payment (as does a ränk with Flags 0x0800 held with an ally). When its ships pick a stellar to go to: 0x0020, never a hypergate; 0x0040, a hypergate whenever the system has one; 0x0080, a wormhole whenever it has one (without it, never a wormhole). Mission ships of it arriving in your system come through a hypergate always with 0x0040 (half the time without, never with 0x0020), and through a wormhole always with 0x0080 (else one time in four).',
      code: [['CommFilter', 0x908ed], ['AddSystemInfluenceToMap', 0x11592], ['AICallForHelp', 0x82ffb], ['DoCommDialog', 0x956d5], ['DoShipCommPayment', 0x920f3], ['SelectRandomStellarDest', 0x805de], ['HandlePlayerDockRequest', 0x66691]],
    },
    CrimeTol: {
      note: 'Whether its warships go for you, by your record in the system you are in: in its own systems, below -CrimeTol; in an ally\'s, below -1.5 × CrimeTol; in an enemy\'s, above CrimeTol; elsewhere only with Flags 0x0002, below -2 × CrimeTol. Your legal status in its systems drops a step at -CrimeTol, -4, -16, -64, -256 and -1,024 × CrimeTol.',
      code: [['SelectWarshipTarget', 0x89d5e], ['DrawLegalStatusString', 0xd43f], ['DamageShip', 0x3a807]],
    },
    SmugPenalty: {
      note: 'How far your record with it falls when one of its ships catches you smuggling (ScanMask): half this where it happens, the change spreading to other systems from there; very small changes are dropped, and the record is kept between -32,000 and 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    DisabPenalty: {
      note: 'How far your record with it falls when you disable one of its ships: half this where it happens, the change spreading to other systems from there; very small changes are dropped, and the record is kept between -32,000 and 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    BoardPenalty: {
      note: 'How far your record with it falls when you board one of its ships: half this where it happens, the change spreading to other systems from there; very small changes are dropped, and the record is kept between -32,000 and 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    KillPenalty: {
      note: 'How far your record with it falls when you destroy one of its ships: half this where it happens, the change spreading to other systems from there; very small changes are dropped, and the record is kept between -32,000 and 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    ShootPenalty: {
      note: 'How far your record with it falls when you fire on one of its ships: half this where it happens, the change spreading to other systems from there; very small changes are dropped, and the record is kept between -32,000 and 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    Classes: {
      note: 'Up to four class numbers (0 and up; below 0, none), by which other governments\' Allies and Enemies, and missions and others, name it.',
      code: [['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48]],
    },
    Allies: {
      note: 'Up to four class numbers: a government with any of them among its Classes is its ally, and it theirs. Below 0: none. A government with Flags 0x0800 is no one\'s ally.',
      code: [['GovtAllies', 0x4e3d]],
    },
    Enemies: {
      note: 'Up to four class numbers: a government with any of them among its Classes is its enemy, and it theirs, even if they are also allies. Failing that, with Flags 0x0001 every government not its ally, and every independent ship, is its enemy. A government with Flags 0x0800 is no one\'s enemy.',
      code: [['GovtEnemies', 0x4f22], ['GovtAllies', 0x4e3d]],
    },
    SkillMult: {
      note: 'Multiplies the skill of its ships (shïp SkillVar), so their acceleration and top speed: SkillMult ÷ 100; 0 or less, 1.',
      code: [['LoadObjectData', 0x771b0], ['ShipAccelRate', 0x353b], ['ShipMaxSpeed', 0x36f2]],
    },
    ScanMask: {
      note: 'Its scans find a mission\'s cargo, a jünk or an outfit whose ScanMask shares a bit with this: smuggling, fined at ScanFine and SmugPenalty.',
      code: [['ScanPlayer', 0x7e46e]],
    },
    CommName: {
      note: 'Its name in the hail dialog.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5]],
    },
    TargetCode: {
      note: 'Its name in the target display.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1]],
    },
    Require: {
      note: 'You may land at its stellars only when the Contributes bits of your ship and outfits include every bit set here, unless one of your missions goes to or returns to that stellar.',
      code: [['HandlePlayerDockRequest', 0x66691], ['PlayerMeetsRequirements', 0x776f]],
    },
    InhJam: {
      note: 'Jamming of types 1 to 4 for every ship whose class\'s attributes government it is (shïp InherentGovt). A ship not yours adds the jamming outfits among its class\'s DefaultItems, and has it all halved when its own government has Flags 0x0080. Yours adds your jamming outfits. Below 0 counts as 0.',
      code: [['ShipECM', 0x3aff]],
    },
    MediumName: {
      note: 'Its name in the message when its reinforcements arrive.',
      code: [['LoadObjectData', 0x771b0], ['HandleReinforcements', 0x39048]],
    },
    Color: {
      note: 'The colour of its territory on the galaxy map.',
      code: [['LoadObjectData', 0x771b0], ['DrawMapInfluence', 0xe360]],
    },
    ShipColor: {
      note: 'The colour its ships are painted, kept to 5 bits a channel; black, unpainted. A përs\'s ship takes the përs\'s colour instead, and yours none of this.',
      code: [['LoadObjectData', 0x771b0], ['GetShipPaintColor', 0x7d0c]],
    },
    Intf: {
      note: 'The intf resource for the status display in its systems. Below 128: intf 128.',
      code: [['LoadObjectData', 0x771b0], ['LoadIntfResource', 0x735f2]],
    },
    NewsPic: {
      note: 'The picture in the news dialog at its stellars. Below 128: PICT 9000.',
      code: [['LoadObjectData', 0x771b0], ['DoNewsDialog', 0x47f0a]],
    },
    InitialRec: {
      note: 'Your record in each system whose Govt is this, when you start a new pilot; a system with no government starts at 0. When your escape pod is picked up (dësc 13999), every system\'s record goes back to this again.',
      bible: 'says nothing of the escape pod.',
      code: [['ResetPlayer', 0x1d40d], ['ResetPlayerRecord', 0x1db70], ['DoNewPilot', 0x18b0a], ['HandlePlayer', 0x68390]],
    },
    ScanFine: {
      note: 'The fine when one of its ships fines you after a scan: 1 and up, that many credits; 0, a warning only; below 0, that percentage of your credits, rounded down to the hundred (at least 1).',
      code: [['ScanPlayer', 0x7e46e]],
    },
    MaxOdds: {
      note: 'Kept as MaxOdds ÷ 100, at least 0.01. A warship of this government runs once the odds against it pass that, or twice that while a reinforcement fleet is on its way; a system\'s reinforcement fleet of this government is called at half of it.',
      code: [['LoadObjectData', 0x771b0], ['WarshipAI', 0x8b729], ['AICallForReinforcements', 0x7f5a1]],
    },
  },
  'mïsn': {
    Require: {
      note: 'It is offered only when the Contributes bits of your ship and outfits include every bit set here.',
      code: [['IsMissionAvailable', 0x9b152], ['PlayerMeetsRequirements', 0x776f]],
    },
    AvailStel: {
      note: 'Where it is offered. -1: anywhere. 128 to 4999: at that spöb. 5000 + n: in a system with a link to sÿst 128 + n. At a stellar whose government is: 9999, none; 10000 + n, gövt 128 + n; 15000 + n, an ally of it; 20000 + n, any but it, or none; 25000 + n, an enemy of it; 30000 + n, it, or one with the same class in the same one of the four Classes; 31000 + n, neither (not none). Anything else: never. Not tested when a ship offers it. Unless it names one spöb, it is not offered while its TravelStel or ReturnStel is a stellar in the system you are in.',
      code: [['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48], ['LoadObjectData', 0x771b0]],
    },
    AvailLoc: {
      note: 'Where it is offered. 0: listed in the Mission BBS. 1: in the bar. 2: by a ship whose përs has it as LinkMission, when you hail the ship, or, with that përs\'s Flags 0x0200, when you board it. 3: on landing, at the spaceport. 4: at the Trade Center. 5: at the shipyard. 6: at the outfitter. Anything else: nowhere.',
      code: [['IsMissionAvailable', 0x9b152], ['OfferMissionFromPort', 0xa369e], ['DoMissionDialog', 0xa37cf], ['DoBarDialog', 0x48ef5], ['DoPortDialog', 0x5f911], ['DoTradeDialog', 0x5dbe1], ['DoShipyardDialog', 0x5e679], ['DoOutfitDialog', 0x5bacf], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    AvailRecord: {
      note: '0: no test. Above 0: your record in this system must be at least this; below 0, at most this. -32000: the stellar you are at must be one you have dominated; -32001: you must have dominated some stellar; below that: never offered.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRating: {
      note: '0 or less: no test. Above 0: your combat rating must be at least this.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRandom: {
      note: 'The chance in 100 it is offered: each mission has a number from 1 to 100, drawn again from time to time as you play, and it is offered while AvailRandom is at least that. 100 or more: always. 0 or less: never. Accepting it sets its number to 0.',
      code: [['IsMissionAvailable', 0x9b152], ['InitObjects', 0x1c2e5], ['HandlePlayer', 0x68390], ['DoMissionAccept', 0xa1b11]],
    },
    AvailShipTyp: {
      note: '128 to 896: you must be flying that ship class; 1128 to 1896: you must not be. 2128 to 2384: your ship class\'s InherentGovt must name that government (as 128 and up or 1128 and up); 3128 to 3384: it must not. Anything else: no test.',
      code: [['IsMissionAvailable', 0x9b152], ['LoadObjectData', 0x771b0]],
    },
    TravelStel: {
      note: 'Where you must go, picked when the mission is made ready to offer. -1: nowhere. 128 to 2175: that spöb. -2: one picked at random from the stellars that qualify and have Flags 0x20 clear; -3: from those with Flags 0x20 set and 0x10 clear. 9999, 10000 + n, 15000 + n, 20000 + n, 25000 + n, 30000 + n and 31000 + n: from those, Flags 0x20 clear, of the governments AvailStel\'s same numbers name; for 10000 + n, Flags 0x20 set too when gövt 128 + n has Flags 0x0800. A stellar qualifies when its system is there now (its Visibility), it is in every version of that system, you can land on it and it is no hypergate or wormhole (Flags2 0x1000, 0x2000), and it is not where you are nor in your system or one linked to it. The mission is not offered while none qualifies, that last test aside. -4, anything else, or none qualifying: the stellar you are at (offered by a ship, the first in your system). Landing on it, or on a stellar of the same name at the same place, does this part of the mission.',
      bible: 'lists no -4, nor what other values do.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['StellarsAreDistant', 0x9cb9], ['StellarIsNormalLandable', 0xa9f8], ['StellarIsLandable', 0xa989], ['IsMissionAvailable', 0x9b152], ['HandleStellarSystemVisibility', 0x32aa5], ['PropagateMissionBitEffects', 0x99676], ['StellarsAreIdentical', 0xab35], ['MissionLandCargoCheck', 0x9edc5]],
    },
    ReturnStel: {
      note: 'Where you must land for the mission to be done, once the rest of it is: picked as TravelStel is, from where you are, and a random pick never the stellar TravelStel picked. -1: the stellar TravelStel picked, so it is done on landing there; with TravelStel -1 too, no landing does it. Landing on a stellar of the same name at the same place does as well.',
      bible: '-1 is no specific stellar destination.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['LoadCurrentMissionData', 0xa0a38], ['MissionLandCheck', 0xa19cc], ['StellarsAreIdentical', 0xab35]],
    },
    PickupMode: {
      note: 'When the cargo comes aboard. 0: when you accept, which is refused while the cargo is more than your holds or your free room. 1: on landing at TravelStel\'s stellar; while it will not fit, that stellar does not count as reached. 2: on boarding one of the mission\'s ships. Anything else: never. LoadCargText, if not -1, is shown as it comes aboard by landing or accepting.',
      code: [['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5], ['DoMissionCargoPickup', 0x98292], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    DropoffMode: {
      note: 'Where the cargo comes off, if it is aboard. 0: on landing at TravelStel\'s stellar. 1: on landing at ReturnStel\'s, once its ShipGoal is met or is -1 (with ShipGoal 3, also while a count the mission keeps, not yet read, is 0). Anything else: never. DropCargText, if not -1, is shown then.',
      code: [['MissionLandCargoCheck', 0x9edc5]],
    },
    PayVal: {
      note: 'Above 0: credits paid when the mission is done. -10000 - n: instead, in every system whose government is gövt n, a record below 0 goes to 0; -20000 - n: the same where the government is allied with gövt n; -30000 - n: where it shares a class with it. -40000 - p, p from 1 to 99: you lose p per cent of your credits. -50000 - c, below -50000: it costs c credits, taken when you accept (never leaving you below 0), and it is offered only while you have c. Paid as well when the mission ends by itself, with Flags2 0x0002. Anything else: nothing.',
      code: [['ApplyMissionPay', 0x98326], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['DoMissionAccept', 0xa1b11], ['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtSharedClass', 0x6e48]],
    },
    ShipSyst: {
      note: 'Where the mission\'s ships are, worked out when you accept. -1: the system you are in then. -2: a random system there now (its Visibility) other than yours. -3: TravelStel\'s stellar\'s system, or ReturnStel\'s if TravelStel has none. -4: ReturnStel\'s. -5: a random system linked to yours and there now, drawn until one is found. -6: whichever system you are in. 128 to 2175: that sÿst. 9999, 10000 + n and the other numbers AvailStel takes for governments: a random system there now, not yours, of those governments. Anything else: nowhere.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SelectMissionSystem', 0x9b993], ['SetupShipsInSystem', 0x42b61], ['MissionHandlePlayerEnteredNewSystem', 0x99f11]],
    },
    ShipGoal: {
      note: 'What you must do with the mission\'s ships before landing at ReturnStel\'s stellar finishes it. 0: destroy them all. 1: disable them all. 2 and 5: board them all (with 5 they start still and disabled, and stay disabled until boarded). 3: keep them; it is met while one of them is about. 4: see one of them, once all have come (if it can cloak, on your screen). 6: be rid of them, each destroyed or jumped out counting (jumping out does not count with ShipSyst -6). The mission fails at once, unless its Flags has 0x0400, when one is destroyed with goal 1 or 3, or with 2 or 5 before you have boarded it, and when one is disabled with goal 3.',
      code: [['MissionObjectivesCheck', 0x9e79e], ['HandleShipDisplay', 0x2b514], ['DamageShip', 0x3a807], ['HandlePlayerBoardAttempt', 0x65000], ['LowLevelAIHandler', 0x851da], ['QuickMissionFailure', 0x99d1b], ['ShipVisibleToShip', 0x971c], ['SetupShipsInSystem', 0x42b61], ['IsDisabled', 0x2ce6]],
    },
    ShipBehav: {
      note: 'How the mission\'s ships act. 0: each is set on you as it appears. 1: they fly with you as escorts do, while not disabled. 2: they go for stellars, not yet destroyed, of governments their own is an enemy of. Anything else: as their own AI has it.',
      code: [['MissionDudeSpawn', 0x3cd3b], ['AIMakeShipAttackPlayer', 0x89c3e], ['AIDispatch', 0x8fb52], ['DeathStarAI', 0x8c125], ['EscortAI', 0x838d2], ['IsDisabled', 0x2ce6]],
    },
    ShipCount: {
      note: 'How many ships the mission has, placed as ShipSyst and ShipStart say. 0 or less: none. With ShipSyst -6 and ShipBehav 1, those of them already with you are not placed again.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipDude: {
      note: 'The düde the mission\'s ships are drawn from, each ship\'s class drawn from it in turn; with the mission\'s Flags 0x0800, one class is drawn when you accept and serves for them all.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionDudeSpawn', 0x3cd3b], ['SelectShipFieldFromDude', 0x65c2]],
    },
    CompGovt: {
      note: 'The government whose regard CompReward changes: 128 to 383. Anything else: none, and CompReward is not used.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    CompReward: {
      note: 'When the mission is done, your record goes up by this in every system whose government is CompGovt, by half of it where the government is an ally of CompGovt\'s, and down by half where it is an enemy. When it fails, down by half in CompGovt\'s systems. When you abort it and its Flags has 0x0040, down by five times this there.',
      bible: 'speaks only of CompGovt: up by this on success, down by half on failure.',
      code: [['DoMissionSuccess', 0xa03fc], ['DoMissionFailure', 0xa0285], ['DoMissionInfoDialog', 0x9e19b], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    DatePostInc: {
      note: 'Days that pass when the mission is done, or when it ends by itself.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['IncrementGameTime', 0xb516]],
    },
    TimeLimit: {
      note: 'Days you have: one comes off each day, and when none are left the mission fails, as soon as you are not in a spaceport, with a message unless its Flags has 0x0400. 0 or less: no limit.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['IncrementGameTime', 0xb516], ['MissionObjectivesCheck', 0x9e79e], ['QuickMissionFailure', 0x99d1b]],
    },
    CanAbort: {
      note: 'Anything but 0: you can abort it from the mission list, and jettison its cargo, which fails it; when it fails, it is taken off your list at once. 0: neither, and a failed mission stays until you next land, when it ends as failed.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['PlayerHasJettisonableCargo', 0x825a], ['JettisonCargo', 0x3dffd], ['QuickMissionFailure', 0x99d1b], ['MissionLandCheck', 0xa19cc]],
    },
    BriefText: {
      note: 'The dësc shown when you accept the mission. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11]],
    },
    QuickBrief: {
      note: 'The dësc shown for the mission in your list of missions. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['MissionInfoFilter', 0x9d6e5]],
    },
    LoadCargText: {
      note: 'The dësc shown when the cargo comes aboard, on accepting or landing (PickupMode 0 or 1). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5]],
    },
    DropCargText: {
      note: 'The dësc shown when the cargo comes off (DropoffMode). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionLandCargoCheck', 0x9edc5]],
    },
    CompText: {
      note: 'The dësc shown when the mission is done. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    FailText: {
      note: 'The dësc shown when the mission fails. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285]],
    },
    RefuseText: {
      note: 'The dësc shown when you refuse the mission as it is offered. -1: none.',
      code: [['OfferOneMission', 0xa21ac]],
    },
    ShipDoneText: {
      note: 'The dësc shown when the mission\'s ShipGoal is first met. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipNameID: {
      note: '-1: the mission\'s ships have their usual names. Otherwise an STR#: one of its strings, picked at random when you accept, is the name of every one of them.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1], ['AICallForHelp', 0x82ffb]],
    },
    ShipSubtitle: {
      note: '-1: none. Otherwise an STR#: one of its strings, picked at random when you accept, is the subtitle of every one of the mission\'s ships.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1]],
    },
    ShipStart: {
      note: 'Where the mission\'s ships start. -1 to -16: on the stellar in that place of their system\'s list (-1 the first), there when you arrive. 0, or a place the list does not fill: brought in as the system\'s other ships are, there when you arrive. 1: they come in from hyperspace, making for you, 100 to 199 steps after you arrive (30 with ShipBehav 1 and ShipGoal 3), and so again each time you enter their system. 2: the first time, the same; after that they are there when you arrive, cloaked.',
      bible: '-1 to -4 for the first four stellars; 1, jump in after a short delay; 2, appear at random, cloaked.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['DoShipCloak', 0xde73], ['GenericRandomShipSpawn', 0x3c89f]],
    },
    AuxShipCount: {
      note: 'How many ships of AuxShipDude the mission sends after you, in the systems AuxShipSyst allows: 70 to 139 steps after you enter such a system (or take off), as many as are left come in from hyperspace, less those already there. Each that comes counts against what is left, unless the mission\'s Flags has 0x0010, when the number is whole again in each system. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipDude: {
      note: 'The düde the aux ships are drawn from: 128 to 639. Anything else: none, and AuxShipCount is not used.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipSyst: {
      note: 'Where the aux ships come. -1 or -6: any system. -2: TravelStel\'s stellar\'s system; -3: ReturnStel\'s. 128 to 2175: that sÿst. 5000 + n: sÿst 128 + n or a system linked to it. 9999, 10000 + n and the other numbers AvailStel takes for governments: systems of those governments, counting as an enemy of a government with Flags 0x0001 any not its ally. Anything else: none.',
      code: [['ValidAuxShipSystem', 0x992b5], ['EnterMoreShips', 0x43459], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48]],
    },
    ScanMask: {
      note: 'When a ship of a government whose ScanMask shares a bit with this scans you while the mission\'s cargo is aboard: with Flags 0x0020 the mission fails ("Your ship has been scanned - mission failed."); otherwise it is smuggling, and you are fined.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['ScanPlayer', 0x7e46e]],
    },
    Flags: {
      note: '0x0001: it ends by itself once its ships are placed or its ShipGoal is met, or on accepting if it has no ships and no ReturnStel. 0x0002: its systems are not marked on the map. 0x0004: it cannot be refused. 0x0008: offered only while you have 100 units of fuel, which are taken when it ends by itself. 0x0010: the aux ships never run out. 0x0020: it fails if you are scanned with its cargo aboard (ScanMask). 0x0040: aborting it costs five times CompReward. 0x0100: its destination is marked on the map while it is offered. 0x0200: ShipSyst\'s system is marked on the map too. 0x0400: it is left out of your list of missions, its failures show no message, and its ships being destroyed or disabled does not fail it. 0x0800: one class for all its ships (ShipDude). 0x2000: not offered while your ship class\'s InherentAI is 2 or less; 0x4000: while it is 3 or more.',
      bible: '0x0400 makes the mission invisible, kept out of the mission info dialog, and no more; it gives no 0x1000.',
      code: [['AutoAbortMission', 0x99bdc], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionObjectivesCheck', 0x9e79e], ['DoMissionAccept', 0xa1b11], ['RecalcMissionSystsForMap', 0xe1b5], ['OfferOneMission', 0xa21ac], ['IsMissionAvailable', 0x9b152], ['ScanPlayer', 0x7e46e], ['DoMissionInfoDialog', 0x9e19b], ['SetupMissionInfoList', 0x9de7a], ['DamageShip', 0x3a807], ['HandleShipDisplay', 0x2b514], ['JettisonCargo', 0x3dffd], ['MissionDudeSpawn', 0x3cd3b]],
    },
    Flags2: {
      note: '0x0001: offered only while your ship has room for its cargo. 0x0002: PayVal is paid when it ends by itself too. 0x0004: it fails if your ship is disabled.',
      code: [['IsMissionAvailable', 0x9b152], ['TotalMissionCargoSpace', 0xcffb], ['AutoAbortMission', 0x99bdc], ['ApplyMissionPay', 0x98326], ['DamageShip', 0x3a807]],
    },
    AvailBits: {
      note: 'A test of control bits: the mission is offered only while it holds. Empty: no test.',
      code: [['InitMissions', 0x97b97], ['IsMissionAvailable', 0x9b152], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnAccept: {
      note: 'Control bits set when you accept the mission.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnRefuse: {
      note: 'Control bits set when you refuse the mission as it is offered.',
      code: [['OfferOneMission', 0xa21ac], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnSuccess: {
      note: 'Control bits set when the mission is done.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnFailure: {
      note: 'Control bits set when the mission fails.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285], ['QuickMissionFailure', 0x99d1b], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnAbort: {
      note: 'Control bits set when you abort the mission, when a set expression aborts it, when your escape pod is picked up (every mission is aborted then), or when it ends by itself; not when a failed mission is taken off your list.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['AbortMission', 0x99a92], ['DoMissionInfoDialog', 0x9e19b], ['EvalSetExp', 0x150fc], ['HandlePlayer', 0x68390], ['AutoAbortMission', 0x99bdc], ['QuickMissionFailure', 0x99d1b]],
    },
    OnShipDone: {
      note: 'Control bits set when the mission\'s ShipGoal is first met (not with ShipGoal -1).',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    AcceptButton: {
      note: 'The label of the Accept button as the mission is offered. Empty, or not starting with a letter: "Yes" if it can be refused, else "Okay" (STR# 150).',
      bible: 'empty text gives Yes, or Okay when it cannot be refused; it says nothing of text not starting with a letter.',
      code: [['OfferOneMission', 0xa21ac]],
    },
    RefuseButton: {
      note: 'The label of the Refuse button as the mission is offered. Empty, or not starting with a letter: "No" (STR# 150).',
      code: [['OfferOneMission', 0xa21ac]],
    },
    DispWeight: {
      note: 'A port\'s missions are put in order of this, highest first: the order of the Mission BBS\'s list, and which is offered first elsewhere.',
      code: [['InitMissions', 0x97b97], ['RandomizeMissionData', 0xa1756], ['OfferMissionFromPort', 0xa369e]],
    },
    CargoType: {
      note: '0 to 999: that cargo. 1000: one of the first six, at random. Anything else: none.',
      code: [['SelectMissionCargoType', 0x981d8]],
    },
    CargoQty: {
      note: '0 and up: that many tons. -1: none. -2 and below: half its size, plus a number from 0 to one less than its size drawn at random, so from half to one and a half times it.',
      code: [['SelectMissionCargoQty', 0x98191]],
    },
  },
  'oütf': {
    ModType: {
      note: 'What it does, ModVal saying how much; ModType2 to ModType4 the same. 1: the weapon wëap ModVal. 2: tons of hold; below 0 it takes hold space. 3: ammunition for wëap ModVal. 4: shield points. 5: shield recharge, ModVal ÷ 1,000 a frame. 6: armor points. 7: acceleration, ÷ 10,000. 8: top speed, ÷ 100. 9: turn, ÷ 100 degrees a frame. 11: an escape pod. 12: fuel. 13: a density scanner. 14: IFF. 15: an afterburner burning ModVal fuel a second. 16: a map of the systems within ModVal jumps; -1, every inhabited system; -1000 - n, the systems of governments of class n. 17: a cloak; ModVal 0x0002 shows on radar, 0x0004 drops the shields at once, 0x0008 drops when hit, 0x00f0 ÷ 0x10 is its fuel use and 0x0f00 ÷ 0x100 its shield use, 0x1000 cloaks the ships in formation with it. 18: a fuel scoop, as FuelRegen. 19: auto-refuelling. 20: auto-eject. 21: your record below 0 set to 0 in the systems of gövt ModVal, or in every one for -1. 22: days a jump. 23: the distance from the middle you jump from, 1,000 + ModVal. 24: anti-interference, -100 to 100 in all. 25: your capture odds (shïp Crew). 27: the Max of oütf ModVal × how many of these you carry. 28: murk. 29: armor recharge, ÷ 1,000 a frame. 30: a cloak scanner. 31: a mining scoop. 32: ModVal more jumps a jump, once for each kind carried, not each one. 33 to 36: jamming of types 1 to 4. 37: jumping without slowing. 38: inertialess. 39: deionization, ÷ 100. 40: ionization capacity. 41: gravity does not pull you. 42: deadly stellars do not harm you. 43: paint. 44: a reinforcement inhibitor. 45 and 46: more guns and turrets. 47 and 50: bombs. 48: an IFF scrambler. 49: now and then (1 in 500 frames) a disabled ship carrying it repairs itself to just over the point of disabling. For a ship not yours, 32 and 49 count among its class\'s DefaultItems.',
      code: [['LoadObjectData', 0x771b0], ['ShipTotalHolds', 0x5cb3], ['ShipShieldCapacity', 0x2995], ['ShipShieldRechargeRate', 0x2abb], ['ShipAccelRate', 0x353b], ['ShipMaxSpeed', 0x36f2], ['ShipTurnRate', 0x32f7], ['HasEscapePod', 0xb83d], ['ShipFuelCapacity', 0x2f21], ['HasDensityScanner', 0x42c0], ['HasIFF', 0x4348], ['ShipAfterburnerFuelUsage', 0x7a82], ['GrantOutfitItem', 0x44d4f], ['AutoSetExploration', 0xdaba], ['HasAreaCloak', 0x3d49], ['ShipCloakVisibleOnRadar', 0x40f8], ['CloakZeroesShields', 0x3e9d], ['ShipDecloaksWhenHit', 0x3f68], ['CloakFuelUsage', 0x3e25], ['CloakShieldUsage', 0x4033], ['ShipFuelGenRate', 0x2ffb], ['DoAutoRefuel', 0x41bc5], ['HasAutoEject', 0x3a14], ['ShipHyperTransitTime', 0x43d0], ['ShipHyperSafeDist', 0x4485], ['ShipAntiInterference', 0x5f2c], ['SetPlunderValues', 0x92219], ['HasMaxOfItem', 0x4512], ['PlayerEffectiveMurk', 0x6f8f], ['ShipCanSeeCloakedShips', 0x41a9], ['ShipCanScoop', 0x75c7], ['ShipJumpsPerJump', 0x77b4], ['ShipECM', 0x3aff], ['ShipCanExpiditeJumps', 0x7872], ['ShipIsInertialess', 0x79c2], ['ShipDeionizationRate', 0x6ec3], ['ShipIonizationFactor', 0x3225], ['ShipResistsGravity', 0x7b10], ['ShipResistsDeadlyStellars', 0x7bbe], ['ResetPlayerPrecalcedValues', 0xc357], ['HandlePlayer', 0x68390], ['ShipCanSelfRepair', 0x9134], ['HandleShip', 0x33581]],
    },
    ModVal: {
      note: 'How much of what ModType says; see there. For ModType 1, 3 and 21, the id is kept less 128.',
      code: [['LoadObjectData', 0x771b0]],
    },
    ModType2: { note: 'A second effect, read as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal2: { note: 'How much of ModType2, as ModVal.', code: [['LoadObjectData', 0x771b0]] },
    ModType3: { note: 'A third effect, read as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal3: { note: 'How much of ModType3, as ModVal.', code: [['LoadObjectData', 0x771b0]] },
    ModType4: { note: 'A fourth effect, read as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal4: { note: 'How much of ModType4, as ModVal.', code: [['LoadObjectData', 0x771b0]] },
    DispWeight: {
      note: 'The outfitter lists the items on offer highest DispWeight first, those of equal DispWeight by id (but see Flags 0x1000).',
      code: [['SetupPortAvailableItems', 0xbedb]],
    },
    Mass: {
      note: 'Tons of your ship\'s FreeMass each one takes; with Flags 0x0400, that percentage of your ship class\'s Mass when that is more. 0 or less is always sold to you, whatever your free mass.',
      code: [['ShipFreeMass', 0xb462], ['AdjustedItemMass', 0x2889], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Max: {
      note: 'The most you can carry, times the number of ModType 27 outfits you carry that name this one (at least 1). Ammunition (ModType 3) for a weapon with a MaxAmmo is held instead to MaxAmmo × the launchers you carry.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Flags: {
      note: '0x0001: a fixed gun, and 0x0002 a turret, counted against your ship\'s MaxGun and MaxTur. 0x0004: it stays with you when you buy or capture another ship, and is left out of your ship\'s trade-in; with 0x0004 or 0x0020 it also stays when a mission changes your ship. 0x0008: it cannot be sold. 0x0010: what you carry of it is taken away when you leave the outfitter. 0x0100: not offered unless your bits meet its Requires, or you have one; 0x4000, unless its Availability holds, or you have one. 0x0200: its price is Cost × your ship class\'s Mass when that is more. 0x0400: its Mass is that percentage of your ship class\'s. 0x0800: any outfitter lists it while you have one. 0x1000: while it is on offer, every higher-numbered item of the same DispWeight is not. 0x2000: shown among your ranks in the player info, not among the rest.',
      code: [['HasMaxOfItem', 0x4512], ['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['PlayerShipTradeInPrice', 0xb079], ['EvalSetExp', 0x150fc], ['DoOutfitDialog', 0x5bacf], ['SetupPortAvailableItems', 0xbedb], ['AdjustedItemCost', 0x5869], ['AdjustedItemMass', 0x2889], ['SetupPlayerInfoText', 0x53cb8]],
    },
    Cost: {
      note: 'Its price; 0 or less, free; with Flags 0x0200, Cost × your ship class\'s Mass when that is more. It is sold only while you have the credits.',
      code: [['AdjustedItemCost', 0x5869], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Requires: {
      note: 'It is sold to you only when the Contributes bits of your ship and outfits include every bit set here, wherever RequireGovt says they apply; with Flags 0x0100 it is not even listed until then, unless you have one.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableItems', 0xbedb]],
    },
    Availability: {
      note: 'A test of control bits: while it fails, it is not sold, and with Flags 0x4000 not listed unless you have one. Empty: no test.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['SetupPortAvailableItems', 0xbedb], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnPurchase: {
      note: 'Control bits set when you buy one. Empty: none.',
      code: [['DoOutfitDialog', 0x5bacf], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnSell: {
      note: 'Control bits set when you sell one. Empty: none.',
      code: [['DoOutfitDialog', 0x5bacf], ['EvalMissionBitSetString', 0x99dc5]],
    },
    ShortName: {
      note: 'Its name in the outfitter\'s list.',
      code: [['LoadObjectData', 0x771b0], ['OutfitDialogUpdate', 0x572cb]],
    },
    LCName: {
      note: 'Its name in a sentence, for one: when you buy, sell or plunder it, are caught with it (ScanMask), and in the player info.',
      code: [['LoadObjectData', 0x771b0], ['DoOutfitDialog', 0x5bacf], ['DoPlunderDialog', 0x9302b], ['ScanPlayer', 0x7e46e], ['SetupPlayerInfoText', 0x53cb8]],
    },
    LCPlural: {
      note: 'Its name in a sentence for more than one, where LCName is for one.',
      code: [['LoadObjectData', 0x771b0], ['DoOutfitDialog', 0x5bacf], ['DoPlunderDialog', 0x9302b], ['ScanPlayer', 0x7e46e], ['SetupPlayerInfoText', 0x53cb8]],
    },
    ItemClass: {
      note: 'Its class for a përs\'s GrantClass: plundering that përs\'s ship may give you outfits of one item of this class.',
      code: [['DoPlunderDialog', 0x9302b]],
    },
    ScanMask: {
      note: 'When a ship of a government whose ScanMask shares a bit with this scans you while you carry one, it is smuggling: your record with that government suffers and you pay its ScanFine, and the ship tells you so, naming it.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['ScanPlayer', 0x7e46e], ['SlapWithPenalty', 0x9bbc]],
    },
    RequireGovt: {
      note: 'Where its Requires apply when you are landed: -1, everywhere; 128 to 383, at stellars of that gövt or its allies; 1128 to 1383, those and independent stellars; 2128 to 2383, everywhere but stellars of that gövt or its allies; 3128 to 3383, everywhere but those and independent stellars. Anything else: everywhere.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['GovtAllies', 0x4e3d]],
    },
    TechLevel: {
      note: 'Offered at an outfitter whose stellar\'s TechLevel is at least this, or one of whose SpecialTech is this. Below 0, or 32767: nowhere by its TechLevel.',
      code: [['SetupPortAvailableItems', 0xbedb]],
    },
    BuyRandom: {
      note: 'The chance in 100 it is offered on a given day: it is offered while BuyRandom is at least a number from 1 to 100 drawn for it each day. Above 100: 100. 0 or less: never, unless you already have one.',
      bible: 'values below 1 or above 100 are read as 100.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableItems', 0xbedb], ['IncrementGameTime', 0xb516]],
    },
    Contributes: {
      note: 'Added to your bits while you carry at least one. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableItems', 0xbedb], ['CanBuyOutfitItem', 0x4e7c4]],
    },
  },
  'wëap': {
    Sound: {
      note: 'The sound when it fires: 0 and up, snd 200 + Sound; with Flags 0x0010 it is not started again while still playing, so it loops. Below 0: silent.',
      code: [['LoadSounds', 0x1c036], ['FireAIShipWeapon', 0x8873d]],
    },
    SmokeSet: {
      note: 'Which set of smoke pictures its shots leave behind them, eight to a set: small with Flags 0x0200, big with 0x0400, lasting longer with 0x0800. Without those, no smoke.',
      code: [['HandleShot', 0x35586], ['SpawnSmoke', 0x3f927], ['HandleSmoke', 0x2e29f]],
    },
    BeamColor: {
      note: 'The colour of a beam\'s core as drawn.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    CoronaColor: {
      note: 'The colour of a beam\'s glow round its core, as drawn; a lightning beam has none.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    LiDensity: {
      note: 'Above 0, the beam is drawn as lightning, zig-zagging this often (1 counts as 2), with no glow (Falloff 0) and a BeamWidth of at least 1. It strikes as a straight beam would.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    LiAmplitude: {
      note: 'How far a lightning beam\'s zig-zags swing, as drawn (LiDensity).',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    MaxAmmo: {
      note: 'Above 0, the most ammunition you can carry for it is MaxAmmo × the launchers you carry, whatever the ammunition outfit\'s Max. 0 or less: the outfit\'s Max.',
      code: [['HasMaxOfItem', 0x4512]],
    },
    MassDmg: {
      note: 'Damage to the armor of a ship hit, once its shields are down (at once with Flags 0x0020); less one for each Decay passed. A beam takes it from an asteroid\'s strength too, ten times with Flags2 0x8000. Against a shot, with half its EnergyDmg, what point defence takes off its Durability.',
      code: [['DamageShip', 0x3a807], ['HandleShipHit', 0x36a45], ['HandleBeams', 0x30295], ['PointDefenseCollisionHandler', 0x37776]],
    },
    EnergyDmg: {
      note: 'Damage to the shields of a ship hit; less one for each Decay passed. The shields go no lower than a tenth of their capacity below 0. A shot (not a beam) takes it from an asteroid\'s strength, ten times with Flags2 0x8000.',
      code: [['DamageShip', 0x3a807], ['HandleShipHit', 0x36a45], ['HandleAsteroidHit', 0x36637]],
      bible: 'Flags2 0x8000: weapon does x10 mass damage to asteroids.',
    },
    Guidance: {
      note: 'How it flies and is fired: -1 a forward gun; 0 a beam; 1 homing (Seeker, GuidedTurn); 3 a turreted beam and 4 a turret, at the target in reach and out of the blind spots; 5 a bomb, turning a degree a step to its course; 6 a rocket, easing onto its heading; 7 and 8 front and rear quadrant turrets, within 45° of the bow or stern; 9 and 10 point defence, shot and beam, fired at homing shots coming at the ship or its lead and at ships of Flags2 0x0008 attacking them; 99 a fighter bay (AmmoType the ship class).',
      code: [['FireAIShipWeapon', 0x8873d], ['SpawnShot', 0x3e550], ['HandleShotGuidance', 0x320dc], ['HandleShipPointDefense', 0x392c4]],
    },
    AmmoType: {
      note: 'What a shot uses: -1 nothing; 0 to 255, the ammunition kept for weapon 128 + n; -999, the firing ship is wrecked, its shields and armor to 0; -1000 and below, (|AmmoType| - 1000) ÷ 10 fuel a shot, fired only with that much aboard. For a fighter bay, the ship class.',
      code: [['WeaponHasAmmo', 0xb95a], ['FireAIShipWeapon', 0x8873d], ['SpawnShot', 0x3e550]],
    },
    Graphic: {
      note: 'Its shots\' sprite, spïn 3000 + Graphic; above 255, no shot is made.',
      code: [['SpawnShot', 0x3e550], ['HandleShot', 0x35586]],
    },
    Inaccuracy: {
      note: 'Above 0, each shot leaves within that many degrees either side of its aim (a bomb\'s picture only). Below 0, it leaves that many degrees off the bow, to the side of the exit point it leaves from. 0: straight.',
      code: [['SpawnShot', 0x3e550], ['HandleShipPointDefense', 0x392c4]],
    },
    ExplodType: {
      note: 'The explosion where it hits, or where it ends with Flags 0x8000: 0 to 63, bööm 128 + n; 1000 to 1063, the big kind spread over BlastRadius. Anything else: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleShot', 0x35586], ['CreateExplosion', 0x3f698]],
    },
    ProxRadius: {
      note: 'The reach of its proximity fuse, plus a third of the target\'s sprite: a shot that comes that near, once armed (ProxSafety), goes off. 0: only a hit.',
      code: [['CheckShotProximities', 0x371bc]],
    },
    BlastRadius: {
      note: 'Every other ship within this, on each axis, of where it goes off takes its full damage, Impact and Ionization too; the firer is spared, but your own blast hurts you unless Flags 0x0100. 0: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleShot', 0x35586], ['IonizeShip', 0x8409]],
    },
    Flags: {
      note: '0x0001: its shots\' frames step on (BeamWidth steps a frame) rather than follow their heading; 0x0004: from the first frame. 0x0008: a homing one is chosen only against a target turning 3 or less. 0x0020: it goes through shields to the armor. 0x0040: all of them fire at once, reloading together. 0x0080: point defence passes its shots by. 0x0100: its blast does not hurt you. 0x1000, 0x2000, 0x4000: a turret blind ahead, abeam, astern. 0x8000: a shot goes off, blast and all, when its life ends. 0x0010: its Sound loops. 0x0200, 0x0400: small or big smoke (SmokeSet), 0x0800 lasting longer. 0x0002: yours, fired by the second trigger; a ship not yours, once it chooses one, keeps firing it step after step, where it chooses a primary weapon afresh each time.',
      code: [['SpawnShot', 0x3e550], ['HandleShot', 0x35586], ['HandleShip', 0x33581], ['SuitableMissileType', 0x34e1], ['DamageShip', 0x3a807], ['WeaponMaxSimultShots', 0x8350], ['HandleShipPointDefense', 0x392c4], ['HandleShipHit', 0x36a45], ['TurretBlindSpot', 0xb325]],
    },
    Seeker: {
      note: '0x0001: its shots and beams pass over asteroids. 0x0020: not fired while its ship is fully ionized. For a homing shot: 0x0002 decoyed onto an asteroid ahead; 0x0008 lost, spiralling, by the system\'s interference as it is fired; 0x0010 jammed, it turns away; 0x4000 its target lost once more than 45° off its nose within 250; 0x8000 jammed or lost, now and then it turns on its own ship.',
      code: [['HandleShotGuidance', 0x320dc], ['SpawnShot', 0x3e550], ['HandleBeams', 0x30295], ['HandleShip', 0x33581]],
    },
    Decay: {
      note: 'Each Decay steps a shot has flown takes one off its MassDmg and EnergyDmg; a beam fades over its Falloff. 0 or less: none.',
      code: [['HandleShot', 0x35586], ['HandleShipHit', 0x36a45], ['HandleBeams', 0x30295]],
    },
    Particles: {
      note: 'Trail particles each step from the shot\'s tail, PartVel, PartLifeMin to PartLifeMax and PartColor. 0: none.',
      code: [['HandleShot', 0x35586], ['SpawnParticles', 0x44b70]],
    },
    PartVel: {
      note: 'The trail particles\' speed, × 0.6 to 1.4, one of eight drawn at loading.',
      code: [['LoadObjectData', 0x771b0], ['SpawnParticles', 0x44b70]],
    },
    PartLifeMin: {
      note: 'The fewest steps a trail particle lasts.',
      code: [['SpawnParticles', 0x44b70]],
    },
    PartLifeMax: {
      note: 'The most steps a trail particle lasts.',
      code: [['SpawnParticles', 0x44b70]],
    },
    PartColor: {
      note: 'The trail particles\' colour, scaled 0.6 to 1.4 with their speed.',
      code: [['LoadObjectData', 0x771b0], ['SpawnParticles', 0x44b70]],
    },
    BeamLength: {
      note: 'A beam\'s reach: it strikes the nearest ship whose middle is within this plus a third of its sprite and within a few degrees of the line, every step it lasts; a turreted beam fires at one within this plus 32.',
      code: [['HandleBeams', 0x30295], ['FireAIShipWeapon', 0x8873d]],
    },
    BeamWidth: {
      note: 'A beam\'s width as drawn; for shots whose frames step on (Flags 0x0001), the steps a frame.',
      code: [['HandleShot', 0x35586], ['HandleBeams', 0x30295]],
    },
    Falloff: {
      note: 'How fast a decaying beam fades (Decay); 0 or less, with a BeamLength, 16.',
      code: [['LoadObjectData', 0x771b0], ['HandleBeams', 0x30295]],
    },
    SubType: {
      note: 'The weapon its submunitions are (SubCount): 128 to 383. Anything else: none. Its reach adds to this one\'s.',
      code: [['SpawnShotSubmunitions', 0x3f1d5], ['LoadObjectData', 0x771b0]],
    },
    ProxSafety: {
      note: 'Steps from firing before a shot is armed: before then it hits nothing and its fuse is off.',
      code: [['CheckShotProximities', 0x371bc], ['HandleShot', 0x35586]],
    },
    Flags2: {
      note: '0x0001: the first frame while not yet armed; 0x0002: frames held at the last. 0x0008: a homing shot hits ships besides its target. 0x0010: submunitions at the nearest ship they can hit. 0x0020: no submunitions when a shot\'s life ends. 0x0080: fired only with a ship of the class\'s KeyCarried aboard. 0x0100: ships not yours never fire it. 0x0200: the ship\'s weapon sprite shows as it fires. 0x0400: planet-type: it hits only planet-type ships (shïp Flags 0x0400), and they nothing else. 0x1000: it disables but never destroys. 0x4000: fired while cloaked (as point defence reads it). 0x8000: ten times the damage to asteroids. 0x0040: its ammunition is not shown on the status display. 0x0800: not offered as your secondary weapon while out of ammunition. 0x2000: a beam drawn beneath the ships. 0x0004 is read by nothing: an asteroid sets off its proximity fuse all the same.',
      code: [['HandleShot', 0x35586], ['ShotCanHitShip', 0x4477e], ['SpawnShotSubmunitions', 0x3f1d5], ['WeaponHasAmmo', 0xb95a], ['FireAIShipWeapon', 0x8873d], ['DamageShip', 0x3a807], ['HandleShipPointDefense', 0x392c4], ['HandleAsteroidHit', 0x36637], ['DrawStatusWeap', 0x4c00a], ['BeamDrawCallback', 0x37952], ['CheckShotProximities', 0x371bc], ['HandlePlayer', 0x68390]],
      bible: '0x0004: proximity detonator ignores asteroids.',
    },
    HitParticles: {
      note: 'Particles where a shot or beam hits a ship or asteroid, lasting HitPartLife to 1.25 × that, at HitPartVel, in HitPartColor. 0: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleAsteroidHit', 0x36637], ['SpawnParticles', 0x44b70]],
    },
    HitPartLife: {
      note: 'The fewest steps a hit particle lasts; the most, a quarter more.',
      code: [['HandleShipHit', 0x36a45]],
    },
    HitPartVel: {
      note: 'The hit particles\' speed.',
      code: [['HandleShipHit', 0x36a45]],
    },
    HitPartColor: {
      note: 'The hit particles\' colour.',
      code: [['HandleShipHit', 0x36a45]],
    },
    Recoil: {
      note: 'Pushes the firing ship back by Recoil ÷ its Mass each time it fires; below 0, forward. 0 or -1: none.',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    ExitType: {
      note: 'Which of the shän\'s four sets of exit points its shots leave from, taking them in turn (or the one nearest the target, Flags3 0x0010): 0 guns, 1 turrets, 2 guided, 3 beams. Anything else: the middle of the ship.',
      code: [['ModifyShotStartPosition', 0x7348], ['SelectClosestShotStartPosition', 0x7254], ['SpawnBeam', 0x44ff3]],
    },
    BurstCount: {
      note: 'Shots before a burst reload: this × the weapons carried, or this alone with Flags 0x0040. 0 or less: no bursts.',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    BurstReload: {
      note: 'The reload, in steps, after a burst (BurstCount).',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    JamVuln: {
      note: 'For a homing shot, each of the four jamming types: a number from 0 to this is drawn for the shot as fired, and from 16 steps old it is jammed while its target\'s jamming of that type is more than 100 less it. Kept to 0 to 100.',
      code: [['SpawnShot', 0x3e550], ['HandleShotGuidance', 0x320dc], ['ShipECM', 0x3aff]],
    },
    Flags3: {
      note: '0x0001: ammunition is used once a burst, not each shot. 0x0004: no second shot until the first is gone. 0x0010: from the exit point nearest the target. 0x0020: while it reloads, no other weapon of the ship fires. 0x0002: its shots are drawn translucent, in thousands of colours or more.',
      code: [['FireAIShipWeapon', 0x8873d], ['HandleShot', 0x35586], ['ModifyShotStartPosition', 0x7348]],
    },
    Durability: {
      note: 'For a homing shot, what point defence must wear down: each hit takes off its MassDmg and half its EnergyDmg, and a hit when nothing is left destroys it. 0 or less: the first hit does.',
      code: [['SpawnShot', 0x3e550], ['PointDefenseCollisionHandler', 0x37776]],
    },
    IonizeColor: {
      note: 'The colour added to a ship it ionizes.',
      code: [['IonizeShip', 0x8409]],
    },
    Reload: {
      note: 'Steps before it fires again, shared among however many of it the ship carries: Reload ÷ that many for each shot fired, or the whole Reload with Flags 0x0040. At the end of a burst, BurstReload instead.',
      code: [['FireAIShipWeapon', 0x8873d], ['FirePlayerWeapon', 0x62702]],
    },
    Count: {
      note: 'Steps a shot lasts. A shot reaches Count × Speed ÷ 100, and on through its submunitions.',
      code: [['LoadObjectData', 0x771b0], ['HandleShot', 0x35586]],
    },
    Speed: {
      note: 'A shot moves Speed ÷ 100 units a step along its heading; with Count, its reach.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    GuidedTurn: {
      note: 'A homing shot turns a tenth of this in degrees each step, from 15 steps old.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    Impact: {
      note: 'Pushes the ship it hits, unless that ship is jumping.',
      code: [['DamageShip', 0x3a807]],
    },
    Ionization: {
      note: 'Added to the ship it hits; from a blast, less by the square of the distance over the square of BlastRadius, and none beyond it.',
      code: [['IonizeShip', 0x8409]],
    },
    SubCount: {
      note: 'How many shots of SubType a shot breaks into.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubTheta: {
      note: 'Above 0: each submunition within this many degrees of the shot\'s heading, at random. Below 0: fanned out this far apart.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubLimit: {
      note: 'How many generations of submunitions there can be. Below 1: no limit.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
  },
  'përs': {
    Color: {
      note: 'The colour its ship is painted, in place of its government\'s ShipColor; black, unpainted.',
      code: [['LoadObjectData', 0x771b0], ['GetShipPaintColor', 0x7d0c]],
    },
    Coward: {
      note: 'As a warship of a government with Flags 0x0010 and with no leader, it turns tail once its shields fall below Coward per cent of their full; ships that are not persons go by their aggression instead.',
      code: [['WarshipAI', 0x8b729], ['ShipShieldCapacity', 0x2995]],
    },
    HailPict: {
      note: 'The picture shown when you hail its ship: 128 and up, that PICT; anything else, its ship class\'s.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5]],
    },
    CommQuote: {
      note: 'What its ship answers when you hail it: above 0, the STR resource numbered CommQuote + 15000 where there is one, else entry CommQuote of STR# 7100. -1 with Flags 0x8000: news of a disaster now under way. Otherwise the usual answer.',
      code: [['LoadAdvice', 0x9133c], ['LoadPluginString', 0x71a8e]],
    },
    Subtitle: {
      note: 'Shown for its ship in your target display.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1]],
    },
    Credits: {
      note: 'The credits you can take when you plunder this person\'s ship: Credits ÷ 1,000 rounded down and halved, plus, when that is above 2, a number from 0 to one less than it drawn at random; that many thousands. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['SetPlunderValues', 0x92219], ['Rand', 0xa4c76]],
    },
    GrantClass: {
      note: 'When you plunder this person\'s ship, with a chance of GrantProb in 100, you are given outfits of one oütf picked at random among those whose ItemClass is this and of which you do not have the most you can. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['HasMaxOfItem', 0x4512], ['GrantOutfitItem', 0x44d4f]],
    },
    GrantProb: {
      note: 'The chance in 100 of the GrantClass gift; kept between 0 and 100.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b]],
    },
    GrantCount: {
      note: 'How many of the GrantClass outfit are given: GrantCount × a number from 50 to 100 drawn at random ÷ 100, at least 1, and fewer while they would not fit your ship\'s free mass. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['ShipFreeMass', 0xb462], ['GrantOutfitItem', 0x44d4f]],
    },
    ShipType: {
      note: 'The class of this person\'s ship: 128 to 895. Anything else: shïp 128.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    Govt: {
      note: 'The government of this person\'s ship. If that gövt has Flags 0x0800, the ship starts disabled and is never one jumping in.',
      code: [['SpawnPerson', 0x408d5]],
    },
    AIType: {
      note: 'How this person\'s ship flies, by the program\'s routines: 1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI (PirateWarshipAI if its government has Flags 0x1000), 4 InterceptorAI, above 4 EscortAI. 0 or less: the person is never picked by LinkSyst.',
      code: [['SpawnPerson', 0x408d5], ['AIDispatch', 0x8fb52], ['WimpyTraderAI', 0x8b029], ['BraveTraderAI', 0x8b493], ['WarshipAI', 0x8b729], ['PirateWarshipAI', 0x8c2d2], ['InterceptorAI', 0x8c895], ['EscortAI', 0x838d2]],
    },
    Aggress: {
      note: 'Kept for the ship as 1 when below 1, as given when 1 or 2, and as 4 when above 2.',
      code: [['SpawnPerson', 0x408d5]],
    },
    WeapType: {
      note: 'Weapons added to those of the ship\'s class, each 128 and up a wëap, WeapCount of it and AmmoLoad of its ammunition; one listed twice takes the later of the two. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    WeapCount: {
      note: 'How many of the WeapType beside it are added to the ship.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    AmmoLoad: {
      note: 'Ammunition added for the WeapType beside it.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    ShieldMod: {
      note: 'Above 0: the ship\'s shields and armour are ShieldMod per cent of its class\'s. 0 or less: as its class\'s.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    HailQuote: {
      note: 'What this person\'s ship says when it hails you: the STR resource numbered HailQuote + 4999 where there is one, else entry HailQuote of STR# 7101. -1: it does not hail. It hails, while you can see it and it is not dying, jumping or leaving, 1 time in 140 each step and not within 2,700 ticks of its last, as Flags allows.',
      code: [['HandleShip', 0x33581], ['ShowPersonHailQuote', 0x4457e], ['LoadPluginString', 0x71a8e]],
    },
    LinkMission: {
      note: 'The mïsn this person offers: when you hail its ship, or with Flags 0x0200, when you board it, if the mission is available then (AvailLoc 2). -1: none.',
      code: [['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['IsMissionAvailable', 0x9b152], ['OfferOneMission', 0xa21ac]],
    },
    Flags: {
      note: '0x0001: damaging its ship gives it a grudge, and as a warship it then goes for you. 0x0002: its ship always has an afterburner; when its ship is destroyed, it is not gone for good; and as its ship\'s death throes reach half their length it launches an escape pod, unless its government has Flags 0x0100; the pod is only seen, nothing hits it. HailQuote only: 0x0004, while it has a grudge; 0x0008, while it likes you; 0x0010, as it turns on you (then at once); 0x0020, while its ship is disabled; 0x0080, once; 0x0400, while its LinkMission is available; not 0x1000 if your ship class\'s InherentAI is 1, 0x2000 if 2, 0x4000 if 3 or more. 0x0040: once you accept its LinkMission, if that mission has one ship, this ship becomes it. 0x0100: once you accept its LinkMission, it is not met again. 0x0200: its LinkMission is offered on boarding, not hailing. 0x0800: once you accept its LinkMission, its ship leaves. 0x8000: with CommQuote -1, hailing it gives news of a disaster.',
      bible: '0x1000, 0x2000 and 0x4000 keep the person from offering its mission to a player flying a wimpy freighter, beefy freighter or warship, not from hailing; 0x8000 shows disaster info when hailing, with no word of CommQuote.',
      code: [['DamageShip', 0x3a807], ['SelectWarshipTarget', 0x89d5e], ['SpawnPerson', 0x408d5], ['HandleShipDisplay', 0x2b514], ['HandleShip', 0x33581], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['LoadAdvice', 0x9133c], ['AIDoesShipLikePlayer', 0x82177], ['IsThreatToPlayer', 0x7f501], ['AIMakeShipLeave', 0x7e2b0], ['SpawnEscapePod', 0x45547]],
    },
    Flags2: {
      note: '0x0001: its ship starts with no fuel, and cannot jump out while it has less than 100 units.',
      code: [['SpawnPerson', 0x408d5], ['AIShipHasFuelForJump', 0x7f48f], ['WarshipAI', 0x8b729]],
    },
    LinkSyst: {
      note: 'Where this person may be met among the ships a system\'s AvgShips brings, or among those jumping in later (1 time in 7 each). -1: anywhere. 128 to 9998: that sÿst; 0 to 127 count as 128 to 255. 9999: systems of no government; 10000 + n, of gövt 128 + n; 15000 + n, of its allies; 20000 + n, of another government; 25000 + n, of its enemies. Not among those jumping in if its government has Flags 0x0800. It is never picked while its AIType is 0 or less, its ActivateOn fails, it has been destroyed or captured, or it is already there.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['HyperShipSpawn', 0x4291a], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    ActivateOn: {
      note: 'A test of control bits: while it fails, this person is not met, whether by LinkSyst or as a system\'s Person. Empty: no test.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['PropagateMissionBitEffects', 0x99676], ['EvalMissionBitTestString', 0x9959e]],
    },
  },
  'ränk': {
    Weight: {
      note: 'Of the ranks you hold that have a ConvName, the heaviest gives <PRK> in the game\'s texts, and of those with a ShortName, <SRK>. Flags 0x0010 sets it against the other ranks of the same government.',
      code: [['MungeBriefing', 0x9c11d], ['ActivateRank', 0x452f0], ['LoadObjectData', 0x771b0]],
    },
    Govt: {
      note: 'Its government: 128 and up, that gövt; below 128, none. Its PriceMod applies, and Flags 0x0004, 0x0040, 0x0100 and 0x0200 act, at the stellars and ships of every government allied with it (GovtAllies, so this one too); Flags 0x0001 and 0x0010 set it against the other ranks of this government.',
      code: [['LoadObjectData', 0x771b0], ['DoPortDialog', 0x5f911], ['SlapWithPenalty', 0x9bbc], ['ResetPlayerPrecalcedValues', 0xc357], ['GovtAllies', 0x4e3d]],
    },
    PriceMod: {
      note: 'A percentage: at a stellar whose government is allied with this rank\'s, prices are multiplied by it while you hold it, one rank\'s after another\'s. 0 or less: 100.',
      code: [['LoadObjectData', 0x771b0], ['DoPortDialog', 0x5f911], ['ApplyPriceAndTechnologyFlux', 0x4e6cd]],
    },
    Salary: {
      note: 'Credits added each day while you hold it, when your credits are below SalaryCap or SalaryCap is 0 or less; below 0, taken, but never below 0 credits in all.',
      code: [['IncrementGameTime', 0xb516]],
    },
    SalaryCap: {
      note: 'Salary is paid only while your credits are below this; 0 or less, always.',
      code: [['IncrementGameTime', 0xb516]],
    },
    Contrib: {
      note: 'Contribute bits it gives while you hold it, joined with your ship\'s, your outfits\' and running events\' for any Require.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
    Flags: {
      note: '0x0001: gaining it takes away every other rank you hold of its government, but those with 0x0008. 0x0010: gaining it takes away those of its government with less Weight, but those with 0x0008. 0x0008: never taken away so, nor for crimes. 0x0040: lost on any crime against a government allied with its own; 0x0004: lost only on disabling or destroying one of their ships. 0x0100: while held, the ships of a government allied with its own do not count you a threat (IsThreatToShip) and are asked whether you are, in choosing targets and in coming to help. 0x0200: while held, the stellars of a government allied with its own are asked whether you are, when you hail and land, and in their colours on the map. 0x0400 and 0x0800 are read when you hail a ship of an allied government (DoCommDialog), not traced.',
      code: [['ActivateRank', 0x452f0], ['SlapWithPenalty', 0x9bbc], ['ResetPlayerPrecalcedValues', 0xc357], ['PlayerBlessedByGovt', 0x2732], ['IsThreatToShip', 0x81faf], ['SelectWarshipTarget', 0x89d5e], ['HandlePlayerDockRequest', 0x66691], ['DoPlanetCommDialog', 0x96949], ['ColorCodeStellar', 0xaa26], ['DoCommDialog', 0x956d5]],
    },
    ConvName: {
      note: 'What <PRK> says in the game\'s texts while this is the heaviest rank you hold with one (Weight); with none, STR# 2002\'s 341st string.',
      code: [['MungeBriefing', 0x9c11d], ['LoadObjectData', 0x771b0]],
    },
    ShortName: {
      note: 'What <SRK> says in the game\'s texts while this is the heaviest rank you hold with one (Weight).',
      code: [['MungeBriefing', 0x9c11d], ['LoadObjectData', 0x771b0]],
    },
  },
  'crön': {
    FirstDay: {
      note: 'The day of the month from which it may start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    FirstMonth: {
      note: 'The month from which it may start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    FirstYear: {
      note: 'The year from which it may start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastDay: {
      note: 'The day of the month after which it may not start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastMonth: {
      note: 'The month after which it may not start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastYear: {
      note: 'The year after which it may not start. The program does not read the dates as one: the year must be from FirstYear to LastYear, and the day of the year from FirstMonth and FirstDay to LastMonth and LastDay, in every year; so a span across the new year never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    Random: {
      note: 'Each day it is not running, it starts if a number from 0 to 100 drawn for it is at most this, its dates hold (FirstYear), its Require is met and its EnableOn holds. 100 or more: always; below 0: never.',
      code: [['CronEventHandler', 0x3874f], ['Rand', 0xa4c76]],
    },
    Duration: {
      note: 'Days it runs once started (after PreHoldoff): OnStart is set as it starts, OnEnd as it ends. 0: both on the same day. Below 0: it never starts.',
      code: [['CronEventHandler', 0x3874f], ['ActivateCron', 0x385db], ['TerminateCron', 0x38467]],
    },
    PreHoldoff: {
      note: 'Days between its being drawn and its starting: OnStart is set only then. 0 or less: at once.',
      code: [['CronEventHandler', 0x3874f]],
    },
    PostHoldoff: {
      note: 'Days after it ends before it may be drawn again. 0 or less: from the next day.',
      code: [['CronEventHandler', 0x3874f]],
    },
    IndNewsStr: {
      note: 'While it runs, an STR# of news shown at any stellar where none of its NewsGovt applies; one string of it at random, the event drawn at random among those with news there. Government news (GovtNewsStr) from any running event comes first. 0 or less: none.',
      code: [['RandomizeNewsDialog', 0x48238], ['GetRandomIndString', 0x72ef7]],
    },
    Flags: {
      note: '0x0001: as it starts, OnStart is set over and over while its Require and EnableOn still hold. 0x0002: as it ends, OnEnd likewise. No other bit is read.',
      code: [['ActivateCron', 0x385db], ['TerminateCron', 0x38467]],
    },
    EnableOn: {
      note: 'A test of control bits: it starts only while this holds. Empty: no test.',
      code: [['CronEventHandler', 0x3874f], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnStart: {
      note: 'Control bits set when it starts (after PreHoldoff); see Flags 0x0001. Empty: none.',
      code: [['ActivateCron', 0x385db], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnEnd: {
      note: 'Control bits set when it ends; see Flags 0x0002. Empty: none.',
      code: [['TerminateCron', 0x38467], ['EvalMissionBitSetString', 0x99dc5]],
    },
    Require: {
      note: 'It starts only when the Contributes bits of your ship and outfits include every bit set here.',
      code: [['CronEventHandler', 0x3874f], ['PlayerMeetsRequirements', 0x776f]],
    },
    NewsGovt: {
      note: 'Up to four governments: while it runs, at a stellar of a government allied with one of them (or that one), the GovtNewsStr beside it is the event\'s news there, the last that applies. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['RandomizeNewsDialog', 0x48238], ['GovtAllies', 0x4e3d]],
    },
    GovtNewsStr: {
      note: 'The STR# of news for the NewsGovt beside it; one string of it at random. Below 1: none.',
      code: [['RandomizeNewsDialog', 0x48238], ['GetRandomIndString', 0x72ef7]],
    },
    Contrib: {
      note: 'Added to your bits while the event is running: from the end of its PreHoldoff until it ends, not in its PostHoldoff. Your bits are those of your ship class, of every outfit you carry, of every ränk you hold and of every crön event that is running; the Require of a shïp, mïsn, crön or gövt, and an oütf\'s Requires, is met when they include every bit it sets.',
      code: [['CronEventHandler', 0x3874f], ['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
  },
  'spöb': {
    xPos: {
      note: 'With yPos, where it is in its system, from the middle; what ships head for, land on and are drawn round.',
      code: [['LoadObjectData', 0x771b0], ['FindNearestStellar', 0x276c], ['DrawStatusRadar', 0x496e0]],
    },
    yPos: {
      note: 'With xPos, where it is in its system.',
      code: [['LoadObjectData', 0x771b0], ['FindNearestStellar', 0x276c]],
    },
    Type: {
      note: 'Its picture: spïn 1000 + Type for its sprite, and PICT 10000 + Type when you land, unless CustPicID is 128 or more.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarSprites', 0x2e6f1], ['PreloadPortDialog', 0x4e5c7]],
    },
    Flags: {
      note: '0x01: you can land or dock; 0x80: only while it is destroyed (and then only). 0x02, 0x04, 0x08, 0x40: a commodity exchange, an outfitter, a shipyard, a bar. 0x10: a station, which changes the words of hails, landing and advice. 0x20: uninhabited: it is not hailed, gives no missions and no services. The next 24 bits are the six commodities\' prices, a nibble each from the top: 1 low, 2 medium, 4 high, the first set counting; 0, not traded.',
      code: [['StellarIsLandable', 0xa989], ['SystemHasService', 0xd373], ['CalcPortDemand', 0x56b1], ['DoPlanetCommDialog', 0x96949], ['HandlePlayerDockApproach', 0x647a6], ['SystemIsInhabited', 0x4c4a]],
    },
    TechLevel: {
      note: 'Its shipyard offers the ship classes, and its outfitter the outfits, whose TechLevel is 0 or more and at most this, or equal to one of its SpecialTech.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['SetupPortAvailableItems', 0xbedb]],
    },
    SpecialTech: {
      note: 'Three of its eight special tech levels (SpecialTech4to8 the other five): ship classes and outfits of exactly one of these TechLevels are offered here too.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableShipTypes', 0xbbe3], ['SetupPortAvailableItems', 0xbedb]],
    },
    SpecialTech4to8: {
      note: 'The other five of its eight special tech levels; see SpecialTech.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    MinStatus: {
      note: 'In its hail dialog it treats you as hated while your record in its system is below this, or always at 32767; never at -32767. Releasing it once dominated puts your record there just below this.',
      code: [['DoPlanetCommDialog', 0x96949], ['PlanetCommFilter', 0x911a9]],
    },
    CustPicID: {
      note: 'The picture when you land: 128 and up, that PICT; below, PICT 10000 + Type. For a hypergate, where its frames split: the opening frames are those below it, when it is from 1 to two short of the count.',
      code: [['PreloadPortDialog', 0x4e5c7], ['HandleStellarSprites', 0x2e6f1]],
    },
    CustSndID: {
      note: 'Landed, a snd of 128 and up plays while the ambient sounds are on. For a hypergate or wormhole, the heading of a ship leaving it: 0 to 359, that; else at random.',
      code: [['DoPortDialog', 0x5f911], ['PlayerEnterHypergate', 0x637bf], ['PlayerEnterWormhole', 0x64005], ['AIMakeShipEmergeFromHyperGate', 0x89518]],
    },
    DefenseDude: {
      note: 'The düde its defence ships are drawn from, of its own government, flying as warships tied to it. Below 128: none.',
      code: [['SpawnStellarDefenseShip', 0x3d2c9], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    DefCount: {
      note: 'How many defence ships it has: up to 1000, that many, launched together; above, the last digit is how many are out at once, the total DefCount ÷ 10 - 100 (above 10,000, ÷ 10 - 1000), launched as those out are lost.',
      code: [['LoadObjectData', 0x771b0], ['EnterMoreShips', 0x43459], ['SpawnStellarDefenseShip', 0x3d2c9], ['DoPlanetCommDialog', 0x96949]],
    },
    Flags2: {
      note: '0x0001: frame 0 comes between every other; 0x0002: frames picked at random; 0x0080: it animates only while destroyed. 0x0020: always dominated. 0x0040: it starts destroyed. 0x0100: a ship that touches it is destroyed. 0x0400: its outfitter lists every outfit you carry that can be sold, to buy it back. 0x1000: a hypergate; 0x2000: a wormhole (HyperLink). 0x0010: its sound loops while you are landed. 0x0200: it fires only once provoked, and then only at you and ships flying with you.',
      code: [['HandleStellarSprites', 0x2e6f1], ['DoStellarTimePassage', 0x40867], ['DoNewPilot', 0x18b0a], ['HandleDeadlyStellars', 0x39ccd], ['SetupPortAvailableItems', 0xbedb], ['HandlePlayerDockRequest', 0x66691], ['PlayerEnterWormhole', 0x64005], ['PlanetSoundCallback', 0x55f5d], ['IsThreatToStellar', 0x9ef7]],
    },
    AnimDelay: {
      note: 'How many 30ths of a second each frame of its sprite shows.',
      code: [['HandleStellarSprites', 0x2e6f1]],
    },
    Frame0Bias: {
      note: 'Above 1, the first frame shows this many times as long as the others.',
      code: [['HandleStellarSprites', 0x2e6f1]],
    },
    HyperLink: {
      note: 'For a hypergate, the stellars you can go to, picking their systems on the map; for a wormhole, one of them at random, or, with none set, another such wormhole at random. Below 128: none.',
      code: [['PlayerEnterHypergate', 0x637bf], ['PlayerEnterWormhole', 0x64005], ['DoSystemMap', 0x121a3]],
    },
    OnDominate: {
      note: 'Control bits set when you dominate it. Empty: none.',
      code: [['DoPlanetCommDialog', 0x96949], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRelease: {
      note: 'Control bits set when you release it from domination. Empty: none.',
      code: [['DoPlanetCommDialog', 0x96949], ['EvalMissionBitSetString', 0x99dc5]],
    },
    DeadTime: {
      note: 'Days it stays destroyed: each day one is counted off, and at 0 it regenerates, its strength whole again, setting OnRegen. Below 0: it never regenerates.',
      code: [['IncrementGameTime', 0xb516], ['StellarIsDestroyed', 0x4e14]],
    },
    OnDestroy: {
      note: 'Control bits set when it is destroyed. Empty: none.',
      code: [['CheckShotProximities', 0x371bc], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRegen: {
      note: 'Control bits set when it regenerates (DeadTime). Empty: none.',
      code: [['IncrementGameTime', 0xb516], ['EvalMissionBitSetString', 0x99dc5]],
    },
    Govt: {
      note: '128 and up is that gövt; anything less is no government.',
      code: [['LoadObjectData', 0x771b0]],
    },
    Tribute: {
      note: 'Credits added to yours each day once you have dominated the stellar; the player-info screen adds them up. 0 or less: TechLevel × 1,000.',
      code: [['LoadObjectData', 0x771b0], ['DoStellarTimePassage', 0x40867], ['PlayerInfoDialogUpdate', 0x5244f]],
    },
    Fee: {
      note: 'Credits taken when you land. With fewer, landing is refused ("You don\'t have enough…"). Not charged once you have dominated it. Above 0, the landing clearance says "[Landing fee is …]", or "[Docking fee is …]" with Flags 0x10, or "[Hypergate fee is …]" with Flags2 0x1000.',
      code: [['HandlePlayerDockRequest', 0x66691], ['HandlePlayerDockApproach', 0x647a6], ['DoPlanetCommDialog', 0x96949]],
    },
    Gravity: {
      note: 'While you are in its system, pulls every ship in it toward the stellar, however far: each step by Gravity × the game speed ÷ the square of the distance in hundreds of units, the square taken as at least 30. Below 0, it pushes instead; 0, nothing. Inertialess ships do not feel it, nor ship classes with Flags3 0x0020, nor your ship if it carries an outfit with ModType 41.',
      code: [['HandleGravity', 0x39bc3], ['ApplyGravity', 0x7c5a], ['ShipResistsGravity', 0x7b10]],
    },
    Weapon: {
      note: 'Below 128: none. It does not fire once destroyed.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarWeapons', 0x2ef3a]],
    },
    Strength: {
      note: 'Its strength to start with and its most. 0 or less: it is never destroyed.',
      code: [['LoadObjectData', 0x771b0], ['StellarIsDestroyed', 0x4e14]],
    },
    DeadType: {
      note: 'Above 255, or below 0: its own Type.',
      code: [['LoadObjectData', 0x771b0]],
    },
    ExplodType: {
      note: 'Below 0: none.',
      code: [['LoadObjectData', 0x771b0]],
    },
  },
};

/* ---- what a record's own value means ---------------------------------------

   Beside each note, a reading of the value in the record at hand, by the same
   rules: (value, record, game) to words, the records it names named from the
   game's files (novaRefText). Only fields whose value is a code, a set of
   bits or another record's id have one; a plain quantity reads as itself.
   utilities/fields_check.mjs runs every reading over every record of every
   release. */

// A record named by type and id: "düde 130, Pirates", or "spöb 4000, not in the files".
function novaRefText(game, type, id) {
  const r = game && game.get(type, id);
  return r ? `${type} ${id}, ${novaNameParts(r.name).name}` : `${type} ${id}, not in the files`;
}
function novaGovtText(game, id) { return id >= 128 && id <= 383 ? novaRefText(game, 'gövt', id) : 'no government'; }
function novaPlaceRead(game, field, v) {
  const p = novaMissionPlace(null, field, v);
  if (p.stellar) return novaRefText(game, 'spöb', p.stellar);
  const sys = p.system !== undefined ? novaRefText(game, 'sÿst', p.system) : '';
  if (p.text === 'system') return sys;
  return p.text.replace('{g}', p.govt !== undefined ? novaGovtText(game, p.govt) : '') + (sys ? ' ' + sys : '');
}
// The bits set in a flags word, each by the words given for it, others as "0x… no use found".
function novaBitsRead(v, words) {
  const out = [];
  for (let b = 1; b <= 0x8000; b <<= 1) if (v & b) out.push('0x' + b.toString(16).padStart(4, '0') + ' ' + (words[b] || 'no use found'));
  return out.length ? out.join('; ') : 'none set';
}
const novaDescRead = (game, v) => v <= 0 ? 'none' : novaRefText(game, 'dësc', v);
const novaDudeRead = (game, v) => v >= 128 && v <= 639 ? novaRefText(game, 'düde', v) : 'none';

// A rate in words: up to four decimals, no trailing zeros.
const novaNum = x => (+x.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
// An explosion type: 0 to 63, a bööm; 1000 to 1063, the big kind (CreateExplosion).
const novaBoomRead = (game, v) => v >= 0 && v <= 63 ? novaRefText(game, 'bööm', 128 + v) : v >= 1000 && v <= 1063 ? novaRefText(game, 'bööm', 128 + v - 1000) + ', the big kind' : 'none';
// Stock weapons: wëap 128 to 383, each with its count and ammunition.
const novaStockRead = (game, ids, counts, ammo) => novaListRead(ids.map((id, i) => id >= 128 && id <= 383
  ? `${novaRefText(game, 'wëap', id)} ×${counts[i]}${ammo[i] > 0 ? `, ammunition ${ammo[i]}` : ''}` : null));
// An outfit's effect (ModType) and its amount (ModVal), as the program reads them.
const NOVA_MOD_NAMES = { 1: 'weapon', 2: 'hold', 3: 'ammunition', 4: 'shield', 5: 'shield recharge', 6: 'armor', 7: 'acceleration', 8: 'top speed', 9: 'turn',
  11: 'escape pod', 12: 'fuel', 13: 'density scanner', 14: 'IFF', 15: 'afterburner', 16: 'map', 17: 'cloak', 18: 'fuel scoop', 19: 'auto-refuel', 20: 'auto-eject',
  21: 'clean record', 22: 'days a jump', 23: 'jump distance', 24: 'anti-interference', 25: 'capture odds', 27: 'raises a Max', 28: 'murk', 29: 'armor recharge',
  30: 'cloak scanner', 31: 'mining scoop', 32: 'more jumps a jump', 33: 'jamming 1', 34: 'jamming 2', 35: 'jamming 3', 36: 'jamming 4', 37: 'jumps without slowing',
  38: 'inertialess', 39: 'deionization', 40: 'ionization capacity', 41: 'gravity resistance', 42: 'deadly stellar resistance', 43: 'paint',
  44: 'reinforcement inhibitor', 45: 'more guns', 46: 'more turrets', 47: 'bomb', 48: 'IFF scrambler', 49: 'self-repair', 50: 'bomb' };
const novaModTypeRead = v => v === -1 || v === 0 ? 'none' : NOVA_MOD_NAMES[v] || `${v}: nothing reads it`;
function novaModValRead(game, t, v) {
  if (t === 1 || t === 3) return novaRefText(game, 'wëap', v);
  if (t === 21) return v === -1 ? 'every system' : novaGovtText(game, v);
  if (t === 27) return novaRefText(game, 'oütf', v);
  if (t === 16) return v > 0 ? `${v} jump${v === 1 ? '' : 's'} around` : v === -1 ? 'every inhabited system' : v <= -1000 ? `governments of class ${-v - 1000}` : 'nothing';
  if (t === 5 || t === 29) return `${novaNum(v * 0.03)} points a second`;
  if (t === 7) return `${novaNum(v / 10000)} each 30th of a second`;
  if (t === 8) return `${novaNum(v / 100)} each 30th of a second`;
  if (t === 9) return `${novaNum(v * 0.3)}° a second`;
  if (t === 15) return `${v} fuel a second`;
  if (t === 23) return `${v > 0 ? '+' : ''}${v} on the 1,000 from the middle`;
  if (t === 39) return `${novaNum(v * 0.3)} a second`;
  if (t === 17) return novaBitsRead(v & 0x100e, { 2: 'on radar', 4: 'drops shields', 8: 'drops when hit', 0x1000: 'area' }) + `; fuel ${(v >> 4) & 15}, shield ${(v >> 8) & 15}`;
  return t === -1 || t === 0 ? 'not read' : `${v}`;
}
// Which governments' scans find a ScanMask, grouped by name.
const novaScanRead = (g, v) => !(v & 0xffff) ? 'never smuggling'
  : (by => by.size ? 'smuggling where scanned by ' + [...by].map(([n, ids]) => `${n} (gövt ${ids.join(', ')})`).join('; ')
    : 'never caught: no government\'s ScanMask shares a bit')(novaAll(g, 'gövt').filter(gv => gv.ScanMask & v)
    .reduce((by, gv) => by.set(novaNameParts(gv.name).name, [...(by.get(novaNameParts(gv.name).name) || []), gv.id]), new Map()));
// The governments whose Classes include any of these class numbers, grouped by name.
function novaGovtClassRead(game, self, classes) {
  const want = classes.filter(c => c >= 0);
  if (!want.length) return 'none';
  const by = new Map();
  for (const gv of novaAll(game, 'gövt')) if (gv.id !== self && gv.Classes.some(c => c >= 0 && want.includes(c))) {
    const n = novaNameParts(gv.name).name; by.set(n, [...(by.get(n) || []), gv.id]);
  }
  return by.size ? [...by].map(([n, ids]) => `${n} (gövt ${ids.join(', ')})`).join('; ') : 'no government has these classes';
}
const novaListRead = xs => (xs = xs.filter(x => x)).length ? xs.join('; ') : 'none';
// Up to eight ids with weights, as the share of the total each gets ("düde 130, Pirates 40%").
function novaWeightedRead(game, type, ids, weights, lo, hi, sharesOnly) {
  const ok = ids.map((id, i) => id >= lo && id <= hi ? i : -1).filter(i => i >= 0);
  const total = ok.reduce((t, i) => t + weights[i], 0);
  if (!(total > 0)) return 'none';
  return ok.map(i => (sharesOnly ? `${type} ${ids[i]}` : novaRefText(game, type, ids[i])) + ` ${Math.round(100 * weights[i] / total)}%`).join('; ');
}
// Outfits and counts ("oütf 130, Afterburner ×1"), as a ship comes with them.
const novaItemsRead = (game, ids, counts) => novaListRead(ids.map((id, i) => id >= 128 && id <= 639 && counts[i] > 0 ? `${novaRefText(game, 'oütf', id)} ×${counts[i]}` : null));

const NOVA_FIELD_READS = {
  'ränk': {
    Govt: (v, r, g) => novaGovtText(g, v),
    PriceMod: v => `${v > 0 ? v : 100}% of the price`,
    Salary: v => `${v.toLocaleString('en-US')} credits a day`,
    SalaryCap: v => (v > 0 ? `while you have under ${v.toLocaleString('en-US')} credits` : 'always'),
  },
  'bööm': {
    FrameAdvance: v => `${novaNum(v / 100)} frames a step`,
    SoundIndex: (v, r, g) => v >= 0 && v <= 63 ? novaRefText(g, 'snd ', 300 + v) : 'silent',
    GraphicIndex: (v, r, g) => novaRefText(g, 'spïn', 400 + v),
  },
  'röid': {
    Strength: v => `${Math.max(1, v)}`,
    YieldType: (v, r, g) => r.YieldQty < 0 ? 'nothing' : v >= 0 && v <= 5 ? novaString(g, 4000, v, 9000) ?? `commodity ${v}` : v === 6 ? 'commodity 6' : v >= 1000 && v <= 1127 ? novaRefText(g, 'jünk', 128 + v - 1000) : 'nothing',
    FragType1: (v, r, g) => v >= 128 && v <= 143 ? novaRefText(g, 'röid', v) : v >= 0 && v <= 15 ? novaRefText(g, 'röid', 128 + v) : 'none',
    FragType2: (v, r, g) => v >= 128 && v <= 143 ? novaRefText(g, 'röid', v) : v >= 0 && v <= 15 ? novaRefText(g, 'röid', 128 + v) : 'none',
    ExplodType: (v, r, g) => novaBoomRead(g, v),
  },
  'spïn': {
    SpritesID: (v, r, g) => g.get('rlëD', v) ? novaRefText(g, 'rlëD', v) : g.get('rlë8', v) ? novaRefText(g, 'rlë8', v) : `PICT ${v}`,
  },
  'chär': {
    startCash: v => `${Math.max(0, v).toLocaleString('en-US')} credits`,
    startShipType: (v, r, g) => novaRefText(g, 'shïp', v >= 128 ? v : 128),
    startSystem: (v, r, g) => novaListRead(v.map(id => id >= 128 ? novaRefText(g, 'sÿst', id) : null)).replace(/^none$/, novaRefText(g, 'sÿst', 128)),
    startGovt: (v, r, g) => novaListRead(v.map((id, i) => id >= 128 ? `${novaGovtText(g, id)}: ${r.startStatus[i]}` : null)),
    introPictID: (v, r) => novaListRead(v.map((id, i) => id >= 128 ? `PICT ${id}, ${Math.min(300, Math.max(0, r.introPictDelay[i]))} s` : null)),
    introTextID: (v, r, g) => v > 0 ? novaRefText(g, 'dësc', v) : 'none',
    Flags: v => novaBitsRead(v, { 1: 'offered first' }),
  },
  'mïsn': {
    AvailStel: (v, r, g) => novaPlaceRead(g, 'avail', v),
    AvailLoc: v => NOVA_AVAIL_LOC[v] || 'nowhere',
    AvailRecord: v => v === 0 ? 'no test' : v === -32000 ? 'a stellar you have dominated' : v === -32001 ? 'once you have dominated a stellar' : v < -32001 ? 'never offered' : v > 0 ? `a record of ${v} or more here` : `a record of ${v} or less here`,
    AvailRating: v => v <= 0 ? 'no test' : `a combat rating of ${v} or more`,
    AvailRandom: v => v >= 100 ? 'always' : v <= 0 ? 'never' : `${v} in 100`,
    AvailShipTyp: (v, r, g) => v >= 128 && v <= 896 ? 'flying ' + novaRefText(g, 'shïp', v) : v >= 1128 && v <= 1896 ? 'not flying ' + novaRefText(g, 'shïp', v - 1000)
      : v >= 2128 && v <= 2384 ? 'a ship class whose InherentGovt is ' + novaGovtText(g, v - 2000) : v >= 3128 && v <= 3384 ? 'a ship class whose InherentGovt is not ' + novaGovtText(g, v - 3000) : 'no test',
    TravelStel: (v, r, g) => novaPlaceRead(g, 'travel', v),
    ReturnStel: (v, r, g) => novaPlaceRead(g, 'return', v) + (v === -1 && r.TravelStel === -1 ? ': with TravelStel -1 too, no landing finishes it' : ''),
    CargoQty: v => v >= 0 ? `${v} tons` : v === -1 ? 'none' : `${Math.trunc(-v / 2)} to ${Math.trunc(-v / 2) - v - 1} tons, at random`,
    PickupMode: v => ['on accepting', 'at TravelStel', 'on boarding one of its ships'][v] || 'not picked up',
    DropoffMode: v => ['at TravelStel', 'at ReturnStel'][v] || 'not dropped off',
    PayVal: (v, r, g) => { const p = novaMissionPay(v); return p.text.replace('{g}', p.govt !== undefined ? novaGovtText(g, p.govt) : ''); },
    ShipCount: v => v > 0 ? `${v} ship${v === 1 ? '' : 's'}` : 'none',
    ShipSyst: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : novaPlaceRead(g, 'ship', v),
    ShipDude: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : novaDudeRead(g, v),
    ShipGoal: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (({ 0: 'destroy them all', 1: 'disable them all', 2: 'board them all', 3: 'keep them', 4: 'see one of them', 5: 'board them all, disabled from the start', 6: 'be rid of them' })[v] || 'none'),
    ShipBehav: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (({ 0: 'set on you', 1: 'fly with you as escorts', 2: 'go for stellars of their enemies' })[v] || 'as their own AI has it'),
    ShipStart: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v >= -16 && v <= -1 ? `on stellar ${-v} of their system's list` : v === 1 ? 'in from hyperspace after a while, each time' : v === 2 ? 'in from hyperspace the first time, cloaked after' : 'brought in as the system\'s other ships are'),
    ShipNameID: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v === -1 ? 'their usual names' : g.get('STR#', v) ? novaRefText(g, 'STR#', v) : `their usual names (no STR# ${v})`),
    ShipSubtitle: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v === -1 ? 'none' : g.get('STR#', v) ? novaRefText(g, 'STR#', v) : `none (no STR# ${v})`),
    CompGovt: (v, r, g) => v >= 128 && v <= 383 ? novaGovtText(g, v) : 'none',
    CompReward: (v, r) => r.CompGovt >= 128 && r.CompGovt <= 383 ? `${v} done, ${-Math.trunc(v / 2)} failed, ${-5 * v} aborted with Flags 0x0040` : 'not used',
    BriefText: (v, r, g) => novaDescRead(g, v), QuickBrief: (v, r, g) => novaDescRead(g, v),
    LoadCargText: (v, r, g) => novaDescRead(g, v), DropCargText: (v, r, g) => novaDescRead(g, v),
    CompText: (v, r, g) => novaDescRead(g, v), FailText: (v, r, g) => novaDescRead(g, v),
    ShipDoneText: (v, r, g) => novaDescRead(g, v),
    RefuseText: (v, r, g) => v === -1 ? 'none' : g.get('dësc', v) ? novaRefText(g, 'dësc', v) : `dësc ${v}, not in the files: an empty text`,
    TimeLimit: v => v > 0 ? `${v} days` : 'no limit',
    CanAbort: v => v ? 'can be aborted' : 'cannot be aborted',
    AuxShipCount: (v, r) => v > 0 && r.AuxShipDude >= 128 && r.AuxShipDude <= 639 ? `${v} ship${v === 1 ? '' : 's'}` : 'none',
    AuxShipDude: (v, r, g) => r.AuxShipCount > 0 ? novaDudeRead(g, v) : 'no aux ships',
    AuxShipSyst: (v, r, g) => r.AuxShipCount > 0 ? novaPlaceRead(g, 'aux', v) : 'no aux ships',
    DatePostInc: v => v > 0 ? `${v} days` : 'none',
    AcceptButton: (v, r) => /^[a-z]/i.test(v || '') ? `"${v}"` : (r.Flags & 4 ? '"Okay"' : '"Yes"'),
    RefuseButton: v => /^[a-z]/i.test(v || '') ? `"${v}"` : '"No"',
    Flags: v => novaBitsRead(v, { 1: 'ends by itself', 2: 'unmarked on the map', 4: 'cannot be refused', 8: 'needs 100 fuel', 0x10: 'aux ships without end',
      0x20: 'fails if scanned', 0x40: 'abort penalty', 0x100: 'marked while offered', 0x200: "ShipSyst's system marked", 0x400: 'invisible',
      0x800: 'one ship class', 0x2000: 'not for InherentAI 2 or less', 0x4000: 'not for InherentAI 3 or more' }),
    Flags2: v => novaBitsRead(v, { 1: 'needs cargo room', 2: 'pays when it ends by itself', 4: 'fails if you are disabled' }),
  },
  'jünk': {
    BoughtAt: (v, r, g) => novaListRead(v.map(id => id >= 128 ? novaRefText(g, 'spöb', id) : null)),
    SoldAt: (v, r, g) => novaListRead(v.map(id => id >= 128 ? novaRefText(g, 'spöb', id) : null)),
    BasePrice: v => `${Math.trunc(v / 1.25)} to ${Math.trunc(v * 1.25)} credits at most stellars (÷ or × 1.25)`,
    Flags: v => novaBitsRead(v, { 1: 'grows', 2: 'shrinks' }),
    ScanMask: (v, r, g) => novaScanRead(g, v),
  },
  'öops': {
    Commodity: (v, r, g) => v >= 0 && v <= 5 ? novaString(g, 4000, v, 9000) ?? `standard commodity ${v}` : 'none',
    Freq: v => v <= 0 ? 'never' : `${Math.min(v, 100)} in 100 a day`,
    Stellar: (v, r, g) => v >= 128 ? novaRefText(g, 'spöb', v) : 'a stellar drawn at random',
    Duration: v => v < 0 ? 'never ends' : `${v} day${v === 1 ? '' : 's'}`,
  },
  'düde': {
    AIType: v => ({ 1: 'WimpyTraderAI', 2: 'BraveTraderAI', 3: 'WarshipAI', 4: 'InterceptorAI' })[v] || (v > 4 ? 'EscortAI' : "the class's InherentAI"),
    Govt: (v, r, g) => novaGovtText(g, v),
    ShipTypes: (v, r, g) => novaWeightedRead(g, 'shïp', v, r.Probs, 128, 895),
    Probs: (v, r) => novaWeightedRead(null, 'shïp', r.ShipTypes, v, 128, 895, true),
    Booty: (v, r, g) => {
      const goods = [0, 1, 2, 3, 4, 5].filter(i => v & (1 << i)).map(i => novaString(g, 4000, i, 9000) ?? `commodity ${i}`);
      if (v & 0xff80 && !goods.length) return 'boarding hangs the game';
      return novaListRead([goods.length > 1 ? 'one of ' + goods.join(', ') : goods[0], v & 0x40 ? 'credits' : null, ...novaBitsRead(v & 0xff80, {}).split('; ').filter(t => t !== 'none set')]);
    },
    InfoTypes: (v, r, g) => novaListRead([v & 0x1000 ? 'where to trade' : null, v & 0x2000 ? 'a disaster\'s prices' : null,
      v & 0x4000 ? (g.get('STR#', 7500 + (v & 0xfff)) ? novaRefText(g, 'STR#', 7500 + (v & 0xfff)) : `no STR# ${7500 + (v & 0xfff)}`) : null,
      v & 0x8000 ? 'its government\'s greeting' : null]) .replace(/^none$/, 'a plain greeting'),
  },
  'flët': {
    LinkSyst: (v, r, g) => v === -1 ? 'anywhere' : v >= 0 && v <= 127 ? novaRefText(g, 'sÿst', v + 128) : v >= 10000 && v <= 14999 ? 'systems of ' + novaGovtText(g, v - 10000 + 128) : v >= 128 && v <= 9999 ? novaRefText(g, 'sÿst', v)
       : v >= 15000 && v <= 19999 ? 'systems of an ally of ' + novaGovtText(g, v - 15000 + 128)
      : v >= 20000 && v <= 24999 ? 'systems of a government other than ' + novaGovtText(g, v - 20000 + 128) : v >= 25000 && v <= 29999 ? 'systems of an enemy of ' + novaGovtText(g, v - 25000 + 128) : 'nowhere',
    LeadShipType: (v, r, g) => novaRefText(g, 'shïp', v >= 128 && v <= 895 ? v : 128),
    EscortType: (v, r, g) => novaListRead(v.map((id, i) => id >= 128 && id <= 895 ? `${novaRefText(g, 'shïp', id)} ×${r.Min[i]}${r.Max[i] > r.Min[i] ? ' to ' + r.Max[i] : ''}` : null)),
    Govt: (v, r, g) => novaGovtText(g, v),
    Quote: (v, r, g) => v > 0 ? (g.get('STR#', v) ? novaRefText(g, 'STR#', v) : `no STR# ${v}: none`) : 'none',
    Flags: v => novaBitsRead(v, { 1: 'trading ships carry cargo' }),
  },
  'sÿst': {
    Con: (v, r, g) => novaListRead(v.map(id => id >= 128 && id <= 2175 ? novaRefText(g, 'sÿst', id) : null)),
    Nav: (v, r, g) => novaListRead(v.map(id => id >= 128 && id <= 2175 ? novaRefText(g, 'spöb', id) : null)),
    Govt: (v, r, g) => novaGovtText(g, v),
    DudeTypes: (v, r, g) => novaWeightedRead(g, 'düde', v, r.Probs, 128, 639),
    Probs: (v, r) => novaWeightedRead(null, 'düde', r.DudeTypes, v, 128, 639, true),
    Person: (v, r, g) => novaListRead(v.map((id, i) => id >= 128 ? `${novaRefText(g, 'përs', id)} (${r.PersonProb[i]} in 100)` : null)),
    AstTypes: (v, r, g) => r.Asteroids > 0 && v & 0xffff ? novaListRead([...Array(16).keys()].filter(i => (v >> i) & 1).map(i => novaRefText(g, 'röid', 128 + i))) : 'no asteroids',
    Asteroids: v => v > 0 ? `${Math.min(v, 16)} kept about you` : 'none',
    Interference: v => `${Math.max(0, Math.min(100, v))} in 100, before your anti-interference`,
    Murk: v => `${Math.max(0, Math.min(100, v))}, before your outfits`,
    Message: (v, r, g) => v === -1 ? 'one of three greetings and the system\'s name, at random' : `"${novaString(g, 1000, v - 1, 1000) ?? '(no such string)'}"`,
    ReinfFleet: (v, r, g) => v >= 128 ? novaRefText(g, 'flët', v) : 'none',
    ReinfIntrval: v => `${Math.max(1, v)} day${Math.max(1, v) === 1 ? '' : 's'}`,
  },
  'shïp': {
    Holds: v => v < 0 ? `${-v} tons, and nothing taking hold space can be bought` : `${v} tons`,
    Shield: v => `${v} points`,
    Armor: v => `${v} points`,
    Accel: v => `${novaNum(v / 10000)} each 30th of a second, before skill`,
    Speed: v => `${novaNum(v / 100)} each 30th of a second, before skill and strict play`,
    Maneuver: v => `${novaNum(v / 10)}° each 30th of a second, ${novaNum(v * 3)}° a second`,
    Fuel: v => `${Math.max(0, Math.trunc(v / 100))} jump${Math.trunc(v / 100) === 1 ? '' : 's'}`,
    FreeMass: v => `${v} tons`,
    DispWeight: v => `listed by ${v}, highest first`,
    InherentGovt: (v, r, g) => v >= 128 && v <= 383 ? novaGovtText(g, v) + ', in combat and attributes' : v >= 1128 && v <= 1383 ? novaGovtText(g, v - 1000) + ', attributes only'
      : v >= 2128 && v <= 2383 ? novaGovtText(g, v - 2000) + ', in combat only' : 'none',
    DeathDelay: (v, r) => `${Math.max(0, v)} steps${r.Mass >= 100 && !(r.Flags & 0x0400) ? `, then a blast ${Math.trunc(r.Mass * 0.075 + 50)} across, ${Math.trunc(r.Mass * 0.0375 + 25)} damage` : ''}`,
    Explode1: (v, r, g) => novaBoomRead(g, v),
    Explode2: (v, r, g) => novaBoomRead(g, v),
    PodCount: v => v > 0 ? `${v} pod${v === 1 ? '' : 's'}` : 'none',
    EscortType: (v, r) => (t => ['fighter', 'medium', 'warship', 'freighter'][t] + (v >= 0 && v <= 3 ? '' : ', worked out'))(v >= 0 && v <= 3 ? v : r.InherentAI <= 2 ? 3 : r.Mass < 50 ? 0 : r.Mass < 200 ? 1 : 2),
    KeyCarried: (v, r, g) => v >= 128 && v <= 895 ? novaRefText(g, 'shïp', v) : 'none',
    Flags: v => novaBitsRead(v, { 1: 'jumps at 0.7', 2: 'jumps at 1.3', 4: 'jumps at 1.6', 8: 'FuelRegen yours too', 0x10: 'disabled at a tenth', 0x20: 'afterburner for good pilots', 0x40: 'afterburner always', 0x100: 'target display', 0x200: 'target display', 0x400: 'planet-type', 0x1000: 'no turret fire ahead', 0x2000: 'no turret fire abeam', 0x4000: 'no turret fire astern', 0x8000: 'escape ship' }),
    Flags2: v => novaBitsRead(v, { 1: 'swarms', 2: 'stands off', 4: 'cannot be targeted', 8: 'point defense fires on it', 0x10: 'no spoken replies', 0x20: 'jumps without slowing', 0x40: 'inertialess', 0x80: 'minds its ammunition', 0x100: 'cloaks in burst reload', 0x200: 'cloaks running away', 0x400: 'cloaks jumping', 0x800: 'cloaks flying about', 0x1000: 'cloaked until near', 0x2000: 'cloaks idle', 0x4000: 'cloaks when attacked' }),
    WeapType: (v, r, g) => novaStockRead(g, v, r.WeapCount, r.AmmoLoad),
    WeapType2: (v, r, g) => novaStockRead(g, v, r.WeapCount2, r.AmmoLoad2),
    Mass: v => (d => `${d} day${d === 1 ? '' : 's'} a jump${v >= 100 ? ', a larger radar blip' : ''}`)(v < 100 ? 1 : v < 200 ? 2 : 3),
    InherentAI: v => ({ 1: 'WimpyTraderAI, a trading ship', 2: 'BraveTraderAI, a trading ship', 3: 'WarshipAI', 4: 'InterceptorAI' })[v] || (v > 4 ? 'EscortAI' : 'none: its ships run no AI, and count as trading ships'),
    MaxGun: v => v > 0 ? `${v} fixed gun${v === 1 ? '' : 's'}, before outfits` : 'none, before outfits',
    MaxTur: v => v > 0 ? `${v} turret${v === 1 ? '' : 's'}, before outfits` : 'none, before outfits',
    ShieldRech: v => v > 0 ? `${novaNum(v * 0.03)} points a second` : 'none',
    ArmorRech: v => v > 0 ? `${novaNum(v * 0.03)} points a second` : 'none',
    SkillVar: v => v > 0 ? `skill ${100 - v}% to ${100 + v}%` : 'skill 100%',
    Deionize: v => `${novaNum(v > 0 ? v * 0.3 : 30)} a second`,
    IonizeMax: v => v > 0 ? `fully ionized at ${v}` : 'never slowed',
    TechLevel: v => v < 0 ? 'in no shipyard by it' : `shipyards of TechLevel ${v} or more`,
    BuyRandom: v => v <= 0 ? 'not sold' : `${Math.min(v, 100)} in 100 a day`,
    HireRandom: v => v <= 0 ? 'never for hire' : `${Math.min(v, 100)} in 100 a day`,
    UpgradeTo: (v, r, g) => v >= 128 ? novaRefText(g, 'shïp', v) : 'cannot be upgraded',
    EscSellValue: (v, r) => `${(v > 0 ? v : Math.trunc(r.Cost / 10)).toLocaleString('en-US')} credits`,
    DefaultItems: (v, r, g) => novaItemsRead(g, v, r.ItemCount),
    DefaultItms2: (v, r, g) => novaItemsRead(g, v, r.ItemCount2),
    FuelRegen: (v, r) => v > 0 ? `a unit every ${v} steps${r.Flags & 8 ? '' : ' (not yours: Flags 0x0008 clear)'}` : 'none',
    Flags3: v => novaBitsRead(v, { 1: 'a miner, parking', 2: 'a miner, going between stellars', 0x20: 'no gravity or deadly stellars', 0x40: 'turret shots above ships', 0x100: 'hidden while Availability fails', 0x200: 'hidden while Require is not met', 0x4000: 'hides later classes of its DispWeight' }),
  },
  'oütf': {
    DispWeight: v => `listed by ${v}, highest first`,
    Mass: (v, r) => r.Flags & 0x0400 && v > 0 ? `${v}% of the ship class's Mass, at least ${v} tons` : `${v} tons`,
    Max: v => `${v}, before ModType 27 outfits`,
    Cost: (v, r) => v <= 0 ? 'free' : `${v.toLocaleString('en-US')} credits${r.Flags & 0x0200 ? ', × the ship class\'s Mass' : ''}`,
    Flags: v => novaBitsRead(v, { 1: 'fixed gun', 2: 'turret', 4: 'kept on a new ship', 8: 'cannot be sold', 0x10: 'taken on leaving', 0x20: 'kept on a mission\'s new ship',
      0x100: 'hidden without Requires', 0x200: 'price by ship mass', 0x400: 'mass by ship mass', 0x800: 'sold anywhere', 0x1000: 'hides later items of its DispWeight',
      0x2000: 'shown among ranks', 0x4000: 'hidden without Availability' }),
    ScanMask: (v, r, g) => novaScanRead(g, v),
    RequireGovt: (v, r, g) => v >= 128 && v <= 383 ? 'at stellars of ' + novaGovtText(g, v) + ' or its allies' : v >= 1128 && v <= 1383 ? 'at independent stellars and those of ' + novaGovtText(g, v - 1000) + ' or its allies'
      : v >= 2128 && v <= 2383 ? 'except at stellars of ' + novaGovtText(g, v - 2000) + ' or its allies' : v >= 3128 && v <= 3383 ? 'except at independent stellars and those of ' + novaGovtText(g, v - 3000) + ' or its allies' : 'everywhere',
    ModType: v => novaModTypeRead(v),
    ModType2: v => novaModTypeRead(v),
    ModType3: v => novaModTypeRead(v),
    ModType4: v => novaModTypeRead(v),
    ModVal: (v, r, g) => novaModValRead(g, r.ModType, v),
    ModVal2: (v, r, g) => novaModValRead(g, r.ModType2, v),
    ModVal3: (v, r, g) => novaModValRead(g, r.ModType3, v),
    ModVal4: (v, r, g) => novaModValRead(g, r.ModType4, v),
    TechLevel: v => v < 0 || v === 32767 ? 'nowhere by it' : `outfitters of TechLevel ${v} or more`,
    BuyRandom: v => v <= 0 ? 'not sold, unless you have one' : `${Math.min(v, 100)} in 100 a day`,
  },
  'gövt': {
    VoiceType: v => v >= 0 ? `snd ${1000 + 100 * v} on` : 'silent',
    Flags: v => novaBitsRead(v, { 1: 'xenophobic', 2: 'hunts criminals anywhere', 4: 'always attacks you', 8: 'your shots miss it', 0x10: 'warships run when hurt', 0x20: 'its ships not helped',
      0x40: 'never attacks you', 0x80: 'jamming halved', 0x100: 'no escape pods', 0x200: 'warships take bribes', 0x400: 'cannot be hailed', 0x800: 'derelicts',
      0x1000: 'pirate warships', 0x2000: 'freighters take bribes', 0x4000: 'stellars take bribes', 0x8000: 'bigger bribes' }),
    Flags2: v => novaBitsRead(v, { 1: 'no request for help', 2: 'map boundaries', 4: 'map boundaries', 8: 'never calls for help', 0x10: 'free help', 0x20: 'no hypergates', 0x40: 'prefers hypergates', 0x80: 'prefers wormholes' }),
    CrimeTol: v => `attacks you below ${-v} in its systems`,
    SmugPenalty: v => `${novaNum(-v / 2)} where it happens`,
    DisabPenalty: v => `${novaNum(-v / 2)} where it happens`,
    BoardPenalty: v => `${novaNum(-v / 2)} where it happens`,
    KillPenalty: v => `${novaNum(-v / 2)} where it happens`,
    ShootPenalty: v => `${novaNum(-v / 2)} where it happens`,
    Classes: v => novaListRead(v.map(c => c >= 0 ? `class ${c}` : null)),
    Allies: (v, r, g) => novaGovtClassRead(g, r.id, v),
    Enemies: (v, r, g) => novaGovtClassRead(g, r.id, v),
    SkillMult: v => `skill × ${novaNum(v > 0 ? v / 100 : 1)}`,
    ScanMask: v => v & 0xffff ? `finds ScanMask bits 0x${(v & 0xffff).toString(16).padStart(4, '0')}` : 'finds nothing',
    Intf: (v, r, g) => novaRefText(g, 'ïntf', v >= 128 ? v : 128),
    NewsPic: (v, r, g) => novaRefText(g, 'PICT', v >= 128 ? v : 9000),
    ScanFine: v => v > 0 ? `${v.toLocaleString('en-US')} credits` : v === 0 ? 'a warning' : `${-v}% of your credits`,
    MaxOdds: v => `runs at odds over ${Math.max(0.01, v / 100)}`,
  },
  'spöb': {
    Type: (v, r, g) => `${novaRefText(g, 'spïn', 1000 + v)}; landed, ${r.CustPicID >= 128 ? `PICT ${r.CustPicID}` : `PICT ${10000 + v}`}`,
    Flags: (v, r, g) => novaListRead([v & 1 ? (v & 0x80 ? 'landable only destroyed' : 'landable') : 'not landable',
      ...[[2, 'commodity exchange'], [4, 'outfitter'], [8, 'shipyard'], [0x40, 'bar'], [0x10, 'station'], [0x20, 'uninhabited']].filter(([b]) => v & b).map(([, w]) => w),
      novaListRead([0, 1, 2, 3, 4, 5].map(i => { const n = (v >>> (28 - 4 * i)) & 15; const w = n & 1 ? 'low' : n & 2 ? 'medium' : n & 4 ? 'high' : null;
        return w && `${novaString(g, 4000, i, 9000) ?? `commodity ${i}`} ${w}`; })).replace(/^none$/, 'no trade')]),
    TechLevel: v => `ships and outfits of TechLevel 0 to ${v}`,
    MinStatus: v => v === -32767 ? 'never hated' : v === 32767 ? 'always hated' : `hated below ${v}`,
    CustSndID: v => v >= 128 ? `snd ${v} when landed` : v >= 0 && v <= 359 ? `leaving gates at ${v}°` : 'none',
    DefenseDude: (v, r, g) => novaDudeRead(g, v),
    DefCount: v => v <= 1000 ? `${v} ship${v === 1 ? '' : 's'}` : `${Math.trunc(v / 10) - (v > 10000 ? 1000 : 100)} ships, ${v % 10} at a time`,
    Flags2: v => novaBitsRead(v, { 1: 'frame 0 between', 2: 'frames at random', 0x10: 'sound loops', 0x20: 'always dominated', 0x40: 'starts destroyed', 0x80: 'animates destroyed',
      0x100: 'deadly', 0x200: 'fires when provoked', 0x400: 'buys back any outfit', 0x1000: 'hypergate', 0x2000: 'wormhole' }),
    AnimDelay: v => `${novaNum(Math.max(0, v) / 30)} s a frame`,
    HyperLink: (v, r, g) => novaListRead(v.map(id => id >= 128 ? novaRefText(g, 'spöb', id) : null)),
    DeadTime: v => v < 0 ? 'never regenerates' : `${v} day${v === 1 ? '' : 's'}`,
    Govt: (v, r, g) => novaGovtText(g, v),
    Tribute: (v, r) => `${(v > 0 ? v : r.TechLevel * 1000).toLocaleString('en-US')} credits a day once dominated`,
    Fee: v => v > 0 ? `${v.toLocaleString('en-US')} credits` : 'none',
    Gravity: v => v > 0 ? 'pulls' : v < 0 ? 'pushes' : 'none',
    Weapon: (v, r, g) => v >= 128 ? novaRefText(g, 'wëap', v) : 'none',
    Strength: v => v > 0 ? `${v}` : 'never destroyed',
    DeadType: (v, r) => v > 255 || v < 0 ? `its own Type, ${r.Type}` : `${v}`,
    ExplodType: v => v < 0 ? 'none' : `${v}`,
  },
  'wëap': {
    Sound: (v, r, g) => v >= 0 ? novaRefText(g, 'snd ', 200 + v) : 'silent',
    Guidance: v => ({ [-1]: 'forward gun', 0: 'beam', 1: 'homing', 3: 'turreted beam', 4: 'turret', 5: 'bomb', 6: 'rocket', 7: 'front quadrant turret', 8: 'rear quadrant turret', 9: 'point defence shot', 10: 'point defence beam', 99: 'fighter bay' })[v] || `${v}: not fired`,
    AmmoType: (v, r, g) => r.Guidance === 99 ? novaRefText(g, 'shïp', v) : v === -1 ? 'none' : v >= 0 && v <= 255 ? 'ammunition of ' + novaRefText(g, 'wëap', 128 + v) : v === -999 ? 'wrecks its own ship' : v <= -1000 ? `${novaNum((Math.abs(v) - 1000) / 10)} fuel a shot` : 'none',
    Graphic: (v, r, g) => v >= 0 && v <= 255 ? novaRefText(g, 'spïn', 3000 + v) : 'no shot',
    Inaccuracy: v => v > 0 ? `±${v}°` : v < 0 ? `${-v}° off the bow` : 'straight',
    ExplodType: (v, r, g) => novaBoomRead(g, v),
    ProxRadius: v => v > 0 ? `${v}, plus a third of the target` : 'hits only',
    BlastRadius: v => v > 0 ? `${v}` : 'none',
    Flags: v => novaBitsRead(v, { 1: 'frames step', 2: 'second trigger', 4: 'first frame first', 8: 'only at slow ships', 0x10: 'sound loops', 0x20: 'through shields', 0x40: 'all at once',
      0x80: 'point defence passes it', 0x100: 'blast spares you', 0x200: 'small smoke', 0x400: 'big smoke', 0x800: 'lasting smoke', 0x1000: 'blind ahead', 0x2000: 'blind abeam', 0x4000: 'blind astern', 0x8000: 'goes off at its end' }),
    Seeker: v => novaBitsRead(v, { 1: 'over asteroids', 2: 'decoyed by asteroids', 8: 'confused by interference', 0x10: 'turns away jammed', 0x20: 'not when ionized', 0x4000: 'loses lock off the nose', 0x8000: 'may turn on its ship' }),
    Flags2: v => novaBitsRead(v, { 1: 'first frame till armed', 2: 'holds last frame', 4: 'not read', 8: 'hits others than its target', 0x10: 'submunitions seek', 0x20: 'no submunitions at its end', 0x40: 'ammunition not shown',
      0x80: 'needs KeyCarried', 0x100: 'yours alone', 0x200: 'weapon sprite', 0x400: 'planet-type', 0x800: 'hidden when empty', 0x1000: 'disables only', 0x2000: 'beam under ships', 0x4000: 'fires cloaked', 0x8000: 'x10 on asteroids' }),
    Flags3: v => novaBitsRead(v, { 1: 'ammunition a burst', 2: 'translucent', 4: 'one shot at a time', 0x10: 'nearest exit', 0x20: 'exclusive' }),
    SubType: (v, r, g) => r.SubCount > 0 && v >= 128 && v <= 383 ? novaRefText(g, 'wëap', v) : 'none',
    Recoil: v => v > 0 ? `${v} back, over the ship's Mass` : v < -1 ? `${-v} forward, over the ship's Mass` : 'none',
    ExitType: v => ({ 0: 'gun points', 1: 'turret points', 2: 'guided points', 3: 'beam points' })[v] || 'the middle',
    BurstCount: (v, r) => v > 0 ? `${v} shots${r.Flags & 0x40 ? '' : ' a weapon'}, then ${r.BurstReload}` : 'no bursts',
    Durability: v => v > 0 ? `${v}` : 'none: the first hit',
    Decay: v => v > 0 ? `1 damage every ${v} steps` : 'none',
    Count: (v, r) => `${v} steps, reaching ${Math.trunc(v * r.Speed / 100)}`,
    GuidedTurn: v => `${v / 10}° a step`,
    SubTheta: v => v > 0 ? `within ${v}° at random` : v < 0 ? `fanned ${-v}° apart` : 'straight on',
    SubLimit: v => v < 1 ? 'no limit' : `${v} generations`,
  },
  'përs': {
    LinkSyst: (v, r, g) => v === -1 ? 'anywhere' : v >= 0 && v <= 127 ? novaRefText(g, 'sÿst', v + 128) : v <= 9998 && v >= 128 ? novaRefText(g, 'sÿst', v)
      : v === 9999 ? 'systems of no government' : v <= 14999 && v >= 10000 ? 'systems of ' + novaGovtText(g, v - 10000 + 128) : v >= 15000 && v <= 19999 ? 'systems of an ally of ' + novaGovtText(g, v - 15000 + 128)
      : v >= 20000 && v <= 24999 ? 'systems of a government other than ' + novaGovtText(g, v - 20000 + 128) : v >= 25000 && v <= 29999 ? 'systems of an enemy of ' + novaGovtText(g, v - 25000 + 128) : 'nowhere',
    Govt: (v, r, g) => novaGovtText(g, v),
    AIType: v => ({ 1: 'WimpyTraderAI', 2: 'BraveTraderAI', 3: 'WarshipAI', 4: 'InterceptorAI' })[v] || (v > 4 ? 'EscortAI' : 'never picked by LinkSyst'),
    Aggress: v => `kept as ${v < 1 ? 1 : v > 2 ? 4 : v}`,
    ShipType: (v, r, g) => novaRefText(g, 'shïp', v >= 128 && v <= 895 ? v : 128),
    WeapType: (v, r, g) => novaListRead(v.map((id, i) => id >= 128 ? `${novaRefText(g, 'wëap', id)} ×${r.WeapCount[i]}${r.AmmoLoad[i] ? `, ammunition ${r.AmmoLoad[i]}` : ''}` : null)),
    Credits: v => { const k = Math.trunc(v / 1000) * 0.5; return k <= 0 ? 'none' : k > 2 ? `${(k * 1000).toLocaleString('en-US')} to ${((k + Math.trunc(k) - 1) * 1000).toLocaleString('en-US')} credits` : `${(k * 1000).toLocaleString('en-US')} credits`; },
    ShieldMod: v => v > 0 ? `${v}% of its class's` : "its class's",
    HailPict: v => v >= 128 ? `PICT ${v}` : "its ship class's",
    CommQuote: (v, r, g) => v > 0 ? `"${novaString(g, 7100, v - 1, 15001) ?? '(no such string)'}"` : v === -1 && r.Flags & 0x8000 ? 'news of a disaster' : 'the usual answer',
    HailQuote: (v, r, g) => v === -1 ? 'it does not hail' : `"${novaString(g, 7101, v - 1, 5000) ?? '(no such string)'}"`,
    LinkMission: (v, r, g) => v >= 128 ? novaRefText(g, 'mïsn', v) : 'none',
    GrantClass: (v, r) => v > 0 && r.GrantProb > 0 && r.GrantCount > 0 ? `ItemClass ${v}, ${Math.min(r.GrantProb, 100)} in 100` : 'none',
    GrantCount: v => v > 0 ? `${Math.max(1, Math.trunc(v * 50 / 100))} to ${v}` : 'none',
    Flags: v => novaBitsRead(v, { 1: 'holds a grudge', 2: 'not gone for good when destroyed', 4: 'hails with a grudge only', 8: 'hails when it likes you only',
      0x10: 'hails as it turns on you', 0x20: 'hails while disabled only', 0x40: 'becomes the mission ship', 0x80: 'hails once', 0x100: 'gone after its mission',
      0x200: 'mission on boarding', 0x400: 'hails while its mission is available', 0x800: 'leaves after its mission', 0x1000: 'no hail for InherentAI 1',
      0x2000: 'no hail for InherentAI 2', 0x4000: 'no hail for InherentAI 3 and up', 0x8000: 'disaster news' }),
    Flags2: v => novaBitsRead(v, { 1: 'starts with no fuel' }),
  },
  'crön': {
    Random: v => v >= 100 ? 'every day it may' : v < 0 ? 'never' : `${v + 1} in 101 a day`,
    Duration: v => v < 0 ? 'never starts' : `${v} day${v === 1 ? '' : 's'}`,
    PreHoldoff: v => v > 0 ? `${v} day${v === 1 ? '' : 's'}` : 'none',
    PostHoldoff: v => v > 0 ? `${v} day${v === 1 ? '' : 's'}` : 'none',
    IndNewsStr: (v, r, g) => v > 0 ? novaRefText(g, 'STR#', v) : 'none',
    Flags: v => novaBitsRead(v, { 1: 'OnStart repeated', 2: 'OnEnd repeated' }),
    NewsGovt: (v, r, g) => novaListRead(v.map((id, i) => id >= 128 ? `${novaGovtText(g, id)}: ${r.GovtNewsStr[i] > 0 ? novaRefText(g, 'STR#', r.GovtNewsStr[i]) : 'no news'}` : null)),
  },
};

/* A record's own value of a field in words, or null where there is no reading. */
function novaFieldRead(game, type, field, rec) {
  const f = NOVA_FIELD_READS[type] && NOVA_FIELD_READS[type][field];
  return f ? f(rec[field], rec, game) : null;
}

/* A field's note, or null. */
function novaFieldNote(type, field) {
  const t = NOVA_FIELD_NOTES[type];
  return t && t[field] || null;
}
