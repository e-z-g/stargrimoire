/* nova-fields.js -- what record fields do, as the program uses them.
   =========================================================================

   A note here is what the game does with a field, read from Mac 1.1.1's
   Intel code and nothing else: not the Bible, not the editors' templates,
   not the wiki. Each cites the routines it was read from, by their symbols
   in the program and their addresses, so it can be read again; a field
   with no note has not been traced. evnova-workbench's tools/fieldtrace.py
   finds where a loader puts each field and which routines use that place;
   where the Bible differs, or leaves out what the code does, a note has
   `bible`, the Bible's text;
   utilities/fields_check.mjs checks every routine cited here against the
   program's symbols.

   The plug-in editor shows a note beside its field (page-plugin.js), and
   under it, where there is one, what the value in the record means; until
   "Notes in full" is ticked, the few words of NOVA_FIELD_SHORT stand for
   each.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js and
   nova-missions.js. */

const NOVA_FIELD_NOTES = {
  'nëbu': {
    XPos: { note: 'With YPos it gives the top left corner of its rectangle on the galaxy map. The map draws its picture there.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    YPos: { note: 'With XPos it gives the top left corner of its rectangle on the map.', code: [['MapDialogUpdate', 0xf5d1]] },
    XSize: { note: 'Its rectangle\'s width on the map. A system is in the nebula when its place lies inside the rectangle at least 8 in from its edges.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    YSize: { note: 'Its rectangle\'s height on the map. See XSize.', code: [['MapDialogUpdate', 0xf5d1], ['ExploreNebulaeFromSystem', 0x508f]] },
    ActiveOn: { note: 'A test of control bits. While it fails the map does not draw the nebula and flying into it does nothing. Empty: no test.', code: [['PropagateMissionBitEffects', 0x99676], ['ExploreNebulaeFromSystem', 0x508f], ['MapDialogUpdate', 0xf5d1]] },
    OnExplore: { note: 'Control bits set the first time the player arrives in a system inside it while it is active. Empty: none.', code: [['ExploreNebulaeFromSystem', 0x508f], ['EvalMissionBitSetString', 0x99dc5]] },
  },
  'spïn': {
    SpritesID: { note: 'Its frames come from the rlë of this id if there is one (rlëD in thousands of colors or more and rlë8 below). Otherwise they come from PICT SpritesID cut into frames with MasksID as their mask.', code: [['GetSpriteInfo', 0x1bf80], ['LoadSprites', 0x20541], ['SWCreateSpriteFromRLEResource', 0xa9990], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    MasksID: { note: 'The PICT that masks a PICT sprite\'s frames. An rlë does not use it.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    xSize: { note: 'A PICT sprite\'s frame width.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    ySize: { note: 'A PICT sprite\'s frame height.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    xTiles: { note: 'How many frames go across a PICT sprite\'s picture.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
    yTiles: { note: 'How many frames go down a PICT sprite\'s picture.', code: [['GetSpriteInfo', 0x1bf80], ['SWCreateSpriteFromSinglePictXY', 0xa9bee]] },
  },
  'dësc': {
    Description: { note: 'The text shown where the game describes the thing of its number (a ship, outfit, stellar, mission, the intro, and the rest).', code: [['LoadDescription', 0x717fe]] },
    Graphic: {
      note: 'Above 127: the game shows PICT Graphic beside the text in the bar, the shipyard, the text dialogs, and the mission dialogs. Each of those dialogs then uses a layout with room for the picture. 127 or less: no picture. A record that ends after its text has no Graphic.',
      code: [['LoadDescription', 0x717fe], ['DoBarDialog', 0x48ef5], ['DoShipyardDescription', 0x5b6d2], ['ShipDescDialogUpdate', 0x4f915], ['ShowTextDialog', 0x5a752], ['TextDialogUpdate', 0x51b40], ['OfferOneMission', 0xa21ac], ['SingleMissionDialogUpdate', 0x98950]],
    },
    Movie: {
      note: 'The file name of a QuickTime movie. The game reads up to the first 0 or all 32 characters. A text dialog or a mission\'s offer plays it with the text. The game also plays the movie of a stellar\'s description when the player lands there or goes through it as a hypergate or a wormhole. Empty: no movie. No movie plays when the player turns off QuickTime Movies in the game\'s preferences. Keys.nib stores that box reversed as the preference QuickTimeMovies. The preference sets byte 7 of the settings (LoadPrefs). Every movie tests that byte. A key, the mouse button, or Return stops the movie.',
      code: [['LoadDescription', 0x717fe], ['ShowTextDialog', 0x5a752], ['OfferOneMission', 0xa21ac], ['PlayQTMovieFromDesc', 0x55f11], ['PlayerLandOnStellar', 0x631c4], ['PlayQTMovie', 0x55957], ['LoadPrefs', 0xce758]],
    },
    Flags: {
      note: 'How the Movie plays. 0x0001: in a text dialog or a mission\'s offer the movie plays after the text instead of before it. On landing and at a gate the movie always plays first. 0x0002: the movie plays at twice its size. 0x0004: the screen fades out before the movie. The movie then plays in a window over the whole game and shrinks to fit. The screen fades back in after it. The program reads only these three bits.',
      code: [['LoadDescription', 0x717fe], ['ShowTextDialog', 0x5a752], ['OfferOneMission', 0xa21ac], ['PlayQTMovieFromDesc', 0x55f11], ['PlayQTMovie', 0x55957]],
    },
  },
  'bööm': {
    FrameAdvance: { note: 'How fast it plays. It advances FrameAdvance ÷ 100 frames a step. Its wait before it starts runs down at the same rate.', code: [['LoadObjectData', 0x771b0], ['HandleExplods', 0x2f5d2]] },
    SoundIndex: { note: 'The sound it makes. 0 to 63: snd 300 + n. Its volume depends on its distance from the player. Anything else: silent.', code: [['CreateExplosion', 0x3f698]] },
    GraphicIndex: { note: 'Its picture is spïn 400 + n.', code: [['SpawnExplod', 0x3f5dc], ['HandleExplods', 0x2f5d2]] },
  },
  'röid': {
    Strength: { note: 'How much damage breaks it (a shot\'s EnergyDmg or a beam\'s MassDmg). At least 1.', code: [['LoadObjectData', 0x771b0], ['HandleAsteroidHit', 0x36637], ['HandleBeams', 0x30295]] },
    SpinRate: { note: 'It turns SpinRate ÷ 100 frames a step. Each asteroid turns at 80% to 120% of that in either direction.', code: [['SpawnAsteroid', 0x3a233], ['HandleAsteroids', 0x361ac]] },
    YieldType: { note: 'What it leaves when broken. 0 to 6: a commodity. 1000 to 1127: a jünk. Anything else: nothing. Each box the player scoops up is a ton of it.', code: [['LoadObjectData', 0x771b0], ['DestroyAsteroid', 0xadc9], ['SpawnScoopableBox', 0x3e3c5]] },
    YieldQty: { note: 'How many boxes it leaves (YieldQty × 0.5 to 1.5). Below 0: none.', code: [['DestroyAsteroid', 0xadc9]] },
    PartCount: { note: 'Particles thrown out when it breaks. 0 or less: none.', code: [['DestroyAsteroid', 0xadc9], ['SpawnParticles', 0x44b70]] },
    PartColor: { note: 'Those particles\' color.', code: [['DestroyAsteroid', 0xadc9]] },
    FragType1: { note: 'One kind of fragment left when it breaks. 128 to 143: that röid. 0 to 15 count as 128 to 143. Anything else: none.', code: [['LoadObjectData', 0x771b0], ['DestroyAsteroid', 0xadc9], ['SpawnSubAsteroid', 0x3fbc7]] },
    FragType2: { note: 'The other kind. With both set each fragment is one or the other at random.', code: [['DestroyAsteroid', 0xadc9], ['SpawnSubAsteroid', 0x3fbc7]] },
    FragCount: { note: 'How many fragments: FragCount ÷ 2 up to just under 1.5 × FragCount.', code: [['DestroyAsteroid', 0xadc9]] },
    ExplodType: { note: 'The explosion when it breaks (as wëap ExplodType). Below 0: none.', code: [['DestroyAsteroid', 0xadc9], ['CreateExplosion', 0x3f698]] },
    Mass: { note: 'How hard it is to push. A hit pushes it by the weapon\'s Impact ÷ Mass up to at most 2 a step. A tractor beam on an asteroid with more than twice the firer\'s Mass pulls the ship toward the asteroid instead.', code: [['HandleAsteroidHit', 0x36637], ['HandleBeams', 0x30295]] },
  },
  'shän': {
    BaseTransp: { note: 'How transparent the game draws the base picture.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    WeapDecay: { note: 'How fast the weapon flash fades once it shows. Each step multiplies its brightness by 0.333.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    BlinkMode: { note: 'How its lights blink. 1: in groups (BlinkA steps between blinks, BlinkC blinks a group, BlinkD steps between groups, and BlinkB as the lit time). 2: brightening by BlinkB ÷ 100 a step to BlinkC (at most 31) and dimming by BlinkD ÷ 100 to BlinkA. 3: flickering between BlinkA and BlinkB (at most 31). Anything else: steady.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    BlinkA: { note: 'Its meaning depends on BlinkMode. In groups: the steps between blinks. Otherwise: the dimmest level.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkB: { note: 'Its meaning depends on BlinkMode. In groups: the lit time. 2: the rise per step × 100. 3: the brightest level.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkC: { note: 'Its meaning depends on BlinkMode. In groups: the number of blinks in a group. 2: the brightest level.', code: [['HandleShipDisplay', 0x2b514]] },
    BlinkD: { note: 'Its meaning depends on BlinkMode. In groups: the steps between groups. 2: the fall per step × 100.', code: [['HandleShipDisplay', 0x2b514]] },
    BaseImageID: { note: 'The sprite of its base picture. It is the rlë of this id or else the PICT of this id with BaseMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseMaskID: { note: 'The PICT that masks a PICT base sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseXSize: { note: 'A PICT base sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseYSize: { note: 'A PICT base sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltImageID: { note: 'The sprite of its alternating picture. It is the rlë of this id or else the PICT of this id with AltMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltMaskID: { note: 'The PICT that masks a PICT alt sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltXSize: { note: 'A PICT alt sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    AltYSize: { note: 'A PICT alt sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowImageID: { note: 'The sprite of its engine glow. It is the rlë of this id or else the PICT of this id with GlowMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowMaskID: { note: 'The PICT that masks a PICT glow sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowXSize: { note: 'A PICT glow sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    GlowYSize: { note: 'A PICT glow sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightImageID: { note: 'The sprite of its lights. It is the rlë of this id or else the PICT of this id with LightMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightMaskID: { note: 'The PICT that masks a PICT light sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightXSize: { note: 'A PICT light sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    LightYSize: { note: 'A PICT light sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapImageID: { note: 'The sprite of its weapon flash. It is the rlë of this id or else the PICT of this id with WeapMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapMaskID: { note: 'The PICT that masks a PICT weap sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapXSize: { note: 'A PICT weap sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    WeapYSize: { note: 'A PICT weap sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldImgID: { note: 'The sprite of its shield flash. It is the rlë of this id or else the PICT of this id with ShieldMaskID as its mask. Below 128: none.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldMaskID: { note: 'The PICT that masks a PICT shield sprite\'s frames.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldXSize: { note: 'A PICT shield sprite\'s frame width.', code: [['LoadExtendedShipSprites', 0x226af]] },
    ShieldYSize: { note: 'A PICT shield sprite\'s frame height.', code: [['LoadExtendedShipSprites', 0x226af]] },
    BaseSetCount: { note: 'How many sets of FramesPer frames the base picture has. Flags uses them for banking, folding, or cycling.', code: [['LoadExtendedShipSprites', 0x226af], ['HandleShipDisplay', 0x2b514]] },
    AltSetCount: { note: 'How many sets of frames the alternating picture has.', code: [['LoadExtendedShipSprites', 0x226af]] },
    Flags: { note: '0x0001: banking. The second set turns left and the third turns right. 0x0002: folding. It shows a new set every AnimDelay. The ship unfolds when idle and folds to jump. With 0x0080 too it folds only to fire. 0x0004: the second set shows while one of its KeyCarried is aboard. 0x0008: the sets cycle every AnimDelay. 0x0010: a disabled ship\'s sets stop changing. 0x0020: a disabled ship shows no alternating image. 0x0040: a disabled ship\'s running lights go out. 0x0100: the frames suit a ship drawn in perspective. Each frame\'s heading is an even step squashed by UpCompress toward the top of the screen and by DnCompress toward the bottom (InitSprites). The program reads no other bit.', code: [['HandleShipDisplay', 0x2b514], ['KeyCarriedShipTypeOnboard', 0x399c], ['InitSprites', 0x1eda2]] },
    AnimDelay: { note: 'Steps between its sets as it folds or cycles (Flags).', code: [['HandleShipDisplay', 0x2b514]] },
    FramesPer: { note: 'Frames to a full turn in each set. The ship\'s heading selects the frame. 0 or less: 36.', code: [['HandleShipDisplay', 0x2b514], ['LoadExtendedShipSprites', 0x226af]] },
    GunPosX: { note: 'Four exit points for its guns (wëap ExitType) used in turn. Each gives how far across the ship the point is with the ship facing up.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    GunPosY: { note: 'Four exit points for its guns. Each gives how far along the ship the point is. The point turns with the frame shown and the compressions squash it.', code: [['ModifyShotStartPosition', 0x7348]] },
    GunPosZ: { note: 'Four heights for its guns\' exit points. The game subtracts each from the point\'s y on the screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    TurretPosX: { note: 'Four exit points for its turrets (wëap ExitType) used in turn. Each gives how far across the ship the point is with the ship facing up.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    TurretPosY: { note: 'Four exit points for its turrets. Each gives how far along the ship the point is. The point turns with the frame shown and the compressions squash it.', code: [['ModifyShotStartPosition', 0x7348]] },
    TurretPosZ: { note: 'Four heights for its turrets\' exit points. The game subtracts each from the point\'s y on the screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    GuidedPosX: { note: 'Four exit points for its guided weapons (wëap ExitType) used in turn. Each gives how far across the ship the point is with the ship facing up.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    GuidedPosY: { note: 'Four exit points for its guided weapons. Each gives how far along the ship the point is. The point turns with the frame shown and the compressions squash it.', code: [['ModifyShotStartPosition', 0x7348]] },
    GuidedPosZ: { note: 'Four heights for its guided weapons\' exit points. The game subtracts each from the point\'s y on the screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    BeamPosX: { note: 'Four exit points for its beams (wëap ExitType) used in turn. Each gives how far across the ship the point is with the ship facing up.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    BeamPosY: { note: 'Four exit points for its beams. Each gives how far along the ship the point is. The point turns with the frame shown and the compressions squash it.', code: [['ModifyShotStartPosition', 0x7348]] },
    BeamPosZ: { note: 'Four heights for its beams\' exit points. The game subtracts each from the point\'s y on the screen.', code: [['ModifyShotStartPosition', 0x7348]] },
    UpCompressX: { note: 'The percentage of an exit point\'s sideways offset kept when the point is toward the top of the screen. 0 or less counts as 100.', code: [['ModifyShotStartPosition', 0x7348], ['LoadExtendedShipSprites', 0x226af]] },
    UpCompressY: { note: 'The percentage of an exit point\'s up-down offset kept when the point is toward the top. 0 or less counts as 100 (or 71 with no shän).', code: [['ModifyShotStartPosition', 0x7348]] },
    DnCompressX: { note: 'As UpCompressX but toward the bottom.', code: [['ModifyShotStartPosition', 0x7348]] },
    DnCompressY: { note: 'As UpCompressY but toward the bottom.', code: [['ModifyShotStartPosition', 0x7348]] },
  },
  'chär': {
    startCash: { note: 'The player\'s credits as a new pilot. Below 0: none. Without any chär: 10,000.', code: [['ActivateCharResource', 0x76cb6]] },
    startShipType: { note: 'The player\'s first ship. 128 and up: that shïp. Below 128: shïp 128.', code: [['ActivateCharResource', 0x76cb6]] },
    startSystem: { note: 'Up to four systems the player may start in. The game picks one of those numbered 128 and up at random. With none: sÿst 128.', code: [['ActivateCharResource', 0x76cb6], ['Rand', 0xa4c76]] },
    startGovt: { note: 'Up to four governments (128 and up). In every system of a government allied to one the player\'s record starts at the startStatus beside it. In every system of a government at war with it the record starts at minus that. A later slot overrides an earlier one.', code: [['ActivateCharResource', 0x76cb6], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]] },
    startStatus: { note: 'The player\'s starting record with the startGovt beside it. The record starts at minus this with that government\'s enemies.', code: [['ActivateCharResource', 0x76cb6]] },
    startKills: { note: 'The player\'s combat rating as a new pilot.', code: [['ActivateCharResource', 0x76cb6]] },
    introPictID: { note: 'Up to four pictures shown in turn as the new pilot starts. Below 128: none.', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1]] },
    introPictDelay: { note: 'Seconds the introPictID beside it stays on the screen (0 to 300).', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1]] },
    introTextID: { note: 'The dësc shown in a text dialog after the pictures.', code: [['GetCharResourceIntroIDs', 0x76fa9], ['ShowIntroScreen', 0x16cf1], ['LoadDescription', 0x717fe]] },
    onStart: { note: 'Control bits set as the pilot starts. Empty: none.', code: [['ActivateCharResource', 0x76cb6], ['EvalMissionBitSetString', 0x99dc5]] },
    Flags: { note: '0x0001: the scenario offered first in the new pilot dialog (the first chär with it). The program reads no other bit.', code: [['GetDefaultCharResourceName', 0x77100], ['DoNewPilotNameDialog', 0x165cc]] },
    startDay: { note: 'The day of the month the game starts. With no chär: 1.', code: [['ActivateCharResource', 0x76cb6]] },
    startMonth: { note: 'The month the game starts. With no chär: 1.', code: [['ActivateCharResource', 0x76cb6]] },
    startYear: { note: 'The year the game starts. With no chär: 2250.', code: [['ActivateCharResource', 0x76cb6]] },
    DatePrefix: { note: 'Kept as the words written before the game\'s date.', code: [['ActivateCharResource', 0x76cb6]] },
    DateSuffix: { note: 'Kept as the words written after the game\'s date.', code: [['ActivateCharResource', 0x76cb6]] },
  },
  'jünk': {
    BoughtAt: {
      note: 'Up to eight stellars where it trades at BasePrice × 1.25 while its BuyOn test passes. The multiplier is 1.1 where the player\'s record is below 0 under a government and 1.5 where the player has dominated the stellar. When several commodities list the same stellar only the highest-numbered of them trades there. It is the seventh row of the trade screen. The player trades it there in both directions at that one price.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    SoldAt: {
      note: 'Up to eight stellars where it trades at BasePrice ÷ 1.25 while its SellOn test passes. The divisor is 1.1 where the player\'s record is below 0 under a government and 1.5 where the player has dominated the stellar. When several commodities list the same stellar only the highest-numbered trades there. It is the eighth row of the trade screen. The player trades it there in both directions at that one price.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    BasePrice: {
      note: 'Its price before the stellar\'s factor (see BoughtAt and SoldAt).',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    BuyOn: {
      note: 'A test of control bits. While it fails its BoughtAt stellars do not trade it. Empty: no test.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    SellOn: {
      note: 'A test of control bits. While it fails its SoldAt stellars do not trade it. Empty: no test.',
      code: [['DoTradeDialog', 0x5dbe1], ['EvalMissionBitTestString', 0x9959e]],
    },
    Flags: {
      note: '0x0001: the player\'s load of it grows by a ton every 250 frames while the fleet has room in its holds. 0x0002: the load shrinks by a ton every 250 frames. The room test for it uses a value that the program works out only when the player also carries 0x0001 cargo. Otherwise the test uses whatever value remains from the last time. With both bits set the load grows. It shrinks only when another cargo the player carries has 0x0002 alone.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['HandlePlayer', 0x68390], ['TotalFleetHolds', 0xc24d], ['TotalCargo', 0x4a0b]],
    },
    ScanMask: {
      note: 'A ship of a government whose ScanMask shares a bit with this may scan the player while the player carries it. That counts as smuggling. The player\'s record with that government drops and the player pays its ScanFine. The ship\'s message uses the cargo\'s LCName.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['ScanPlayer', 0x7e46e], ['SlapWithPenalty', 0x9bbc]],
    },
    LCName: {
      note: 'Its name in the middle of a sentence. It appears in the ship\'s information and when a scan catches the player with it (ScanMask). The trade screen shows the resource\'s name instead.',
      code: [['LoadObjectData', 0x771b0], ['SetupPlayerInfoText', 0x53cb8], ['ScanPlayer', 0x7e46e], ['TradeDialogUpdate', 0x4ceea]],
    },
    Abbrev: {
      note: 'Its short name in the list of the player\'s cargo on the status bar.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusCargo', 0x4c313]],
    },
  },
  'öops': {
    Commodity: {
      note: 'Which of the six standard commodities (0 to 5) the disaster changes. While the disaster lasts that commodity\'s price at its stellar is its base price plus PriceDelta whatever the stellar\'s demand. The price is at least 5.',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    PriceDelta: {
      note: 'Added to the Commodity\'s base price at the stricken stellar while the disaster lasts. The price stays at 5 or more.',
      code: [['DoTradeDialog', 0x5dbe1]],
    },
    Freq: {
      note: 'The chance in 100 each day that the disaster starts while it is not under way and its ActivateOn test passes.',
      code: [['DisasterHandler', 0x41ab9], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    ActivateOn: {
      note: 'A test of control bits. While it fails the disaster does not start. Empty: no test.',
      code: [['DisasterHandler', 0x41ab9], ['EvalMissionBitTestString', 0x9959e]],
    },
    Stellar: {
      note: 'Where the disaster strikes. 128 and up: that spöb. Anything else: a stellar drawn at random when it starts. The stellar must be there now and have Flags 0x20 clear.',
      code: [['DisasterHandler', 0x41ab9], ['Rand', 0xa4c76]],
    },
    Duration: {
      note: 'How many days it lasts once started. Below 0: it never ends.',
      code: [['DisasterHandler', 0x41ab9]],
    },
  },
  'düde': {
    AIType: {
      note: 'How its ships fly. Above 0: that AI (1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI, 4 InterceptorAI, and above 4 EscortAI). 0 or less: the InherentAI of the ship class drawn.',
      code: [['RandomShipSpawn', 0x3c0f3], ['AIDispatch', 0x8fb52]],
    },
    Govt: {
      note: 'The government of its ships. 128 to 383: that gövt. Anything else: none.',
      code: [['LoadObjectData', 0x771b0], ['RandomShipSpawn', 0x3c0f3]],
    },
    ShipTypes: {
      note: 'Up to sixteen ship classes. The game draws its ships from these. 128 to 895: that class with the Probs beside it as its weight. The game passes over a class whose AppearOn fails. A mission\'s ships still use one when none remains. Anything else: none.',
      code: [['LoadObjectData', 0x771b0], ['SelectShipFieldFromDude', 0x65c2], ['MissionDudeSpawn', 0x3cd3b]],
    },
    Probs: {
      note: 'The weight of the ShipTypes beside it. Each class\'s chance is its Probs divided by the total of those the game may draw.',
      code: [['SelectShipFieldFromDude', 0x65c2], ['Rand', 0xa4c76]],
    },
    Booty: {
      note: 'What the player finds when boarding one of its ships. 0x0001 to 0x0020: the six commodities in order. The game picks one of those set at random. The player finds between half its Holds and all of its Holds in tons of it. 0x0040: credits. That is 2.5% of its class\'s Cost (or up to just under 5% for a class costing 81,000 or more) and at least 1,000. Without it only a përs\'s ship has credits (half to all of the përs\'s Credits). A bit above 0x0040 set with none of 0x0001 to 0x0020 hangs the game when the player boards. The program draws a commodity forever.',
      code: [['SetPlunderValues', 0x92219], ['Rand', 0xa4c76]],
    },
    InfoTypes: {
      note: 'What its ships reply when the player hails them. The game picks one of the kinds set at random. 0x1000: a stellar where one of the six commodities has a low or high price (a good place to trade it). 0x2000: the price of a commodity at a stellar where a disaster is under way. 0x4000: a string from STR# 7500 plus the low twelve bits. The program never draws the number that picks it. So the reply is the first string until the player hails a stellar and almost never another one afterwards. 0x8000: one of strings 1 to 5 of STR# 7000 + (its gövt - 128) for a trading ship (an AI of 2 or less) and 6 to 10 for others. A plug-in\'s \'STR \' 10010 + 10 × (gövt - 128) + 0 to 4 (or 10015 + …) comes first. None of these: STR# 2002\'s string 175.',
      code: [['LoadAdvice', 0x9133c], ['CalcPortDemand', 0x56b1], ['DoPlanetCommDialog', 0x96949], ['LoadPluginString', 0x71a8e]],
    },
  },
  'flët': {
    LinkSyst: {
      note: 'Where the player may meet this fleet. The game uses it as it places a system\'s AvgShips ships (1 time in 7 for each ship after the përs chance) and as ships jump in later. -1: anywhere. 128 to 9999: that sÿst (0 to 127 count as 128 to 255). 10000 + n: systems of gövt 128 + n. 15000 + n: systems of its allies. 20000 + n: systems of another government. 25000 + n: systems of its enemies. Each time the game draws one of the 256 fleet places at random. The fleet comes only if the place drawn includes this system. So the player meets fleets more often where more of them may appear.',
      code: [['SpawnFleet', 0x42704], ['SetupShipsInSystem', 0x42b61], ['HyperShipSpawn', 0x4291a], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['Rand', 0xa4c76]],
    },
    ActivateOn: {
      note: 'A test of control bits. While it fails the player does not meet this fleet. Empty: no test.',
      code: [['PropagateMissionBitEffects', 0x99676], ['SpawnFleet', 0x42704], ['HyperSpawnFleet', 0x41c8d]],
    },
    LeadShipType: {
      note: 'The class of the fleet\'s lead ship (128 to 895). Below 128: shïp 128.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    EscortType: {
      note: 'Up to four classes of escort (128 to 895). Each comes Min to Max strong. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    Min: {
      note: 'The fewest of the EscortType beside it. The count is Min plus a number from 0 to Max - Min drawn at random.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76]],
    },
    Max: {
      note: 'The most of the EscortType beside it.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76]],
    },
    Govt: {
      note: 'The government of every ship in the fleet. 128 and up: that gövt. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['HyperSpawnFleet', 0x41c8d]],
    },
    Quote: {
      note: 'Above 0: when the fleet jumps in while the player is there the game shows a string picked at random from the STR# of this number. Each # in it becomes a random digit. 0 or less: none.',
      code: [['HyperSpawnFleet', 0x41c8d], ['GetRandomIndString', 0x72ef7], ['DisplayComm', 0x90201]],
    },
    Flags: {
      note: '0x0001: each ship of the fleet whose class has an InherentAI of 2 or less starts with cargo. The cargo is 1 to Holds tons of one of the six commodities picked at random. The program reads no other bit.',
      code: [['HyperSpawnFleet', 0x41c8d], ['Rand', 0xa4c76], ['DrawStatusCargo', 0x4c313]],
    },
  },
  'sÿst': {
    xPos: {
      note: 'With yPos it gives where the system is on the galaxy map. Systems at the same place are versions of one another. The game uses the lowest-numbered of them whose Visibility test passes.',
      code: [['LoadObjectData', 0x771b0], ['FindFirstCoLocatedSystem', 0x4baa], ['FindActiveCoLocatedSystem', 0x4be0]],
    },
    yPos: {
      note: 'With xPos it gives where the system is on the galaxy map. See xPos for systems at the same place.',
      code: [['LoadObjectData', 0x771b0], ['FindActiveCoLocatedSystem', 0x4be0], ['DrawMap', 0xe568]],
    },
    Con: {
      note: 'Up to sixteen systems linked to this one. 128 to 2175: that sÿst. Anything else: none.',
      code: [['LoadObjectData', 0x771b0], ['StellarsAreDistant', 0x9cb9]],
    },
    Nav: {
      note: 'Up to sixteen stellars in the system. 128 to 2175: that spöb. Anything else: none.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarSystemVisibility', 0x32aa5]],
    },
    Govt: {
      note: 'The government of the system. 128 to 383: that gövt. Anything else: none. The player\'s record here starts at the government\'s InitialRec. The government ranges of LinkSyst, ShipSyst, AuxShipSyst, PayVal, and CompReward count the system as that government\'s.',
      code: [['LoadObjectData', 0x771b0], ['ResetPlayer', 0x1d40d], ['SpawnPerson', 0x408d5], ['SelectMissionSystem', 0x9b993], ['ValidAuxShipSystem', 0x992b5], ['ApplyMissionPay', 0x98326], ['DoMissionSuccess', 0xa03fc]],
    },
    BkgndColor: {
      note: 'The color of space while the player is in the system.',
      code: [['LoadObjectData', 0x771b0], ['SetSystemBackgroundColor', 0x6af4]],
    },
    Visibility: {
      note: 'A test of control bits. While it fails the system and its stellars are absent. The game uses another version of it at the same place instead. Empty: always there.',
      code: [['PropagateMissionBitEffects', 0x99676], ['EvalMissionBitTestString', 0x9959e], ['FindActiveCoLocatedSystem', 0x4be0], ['HandleStellarSystemVisibility', 0x32aa5]],
    },
    Interference: {
      note: 'The chance in 100 each step that jamming blanks the player\'s status display. The ship\'s anti-interference comes off it and the result stays between 0 and 100. It is also the chance in 100 that a guided shot with Seeker 0x0008 fired here becomes confused.',
      code: [['HandleStatus', 0x494d7], ['ShipAntiInterference', 0x5f2c], ['SpawnShot', 0x3e550]],
    },
    Murk: {
      note: 'How murky the system is. A value below 0 counts as 0. Each ModType 28 outfit the player carries adds its ModVal once for every copy. The total stays between 0 and 100. Murk shades the ships in the system.',
      code: [['PlayerEffectiveMurk', 0x6f8f], ['HandleShipDisplay', 0x2b514], ['HandleSpriteMurkiness', 0x2b42f]],
    },
    Asteroids: {
      note: 'How many asteroids are around the player (up to 16). The game places them when the player arrives and adds one at the edge of the screen whenever there are fewer. 0 or less: none.',
      code: [['CreateAsteroids', 0x3fa05], ['SpawnAsteroid', 0x3a233]],
    },
    AstTypes: {
      note: 'Which röid types the asteroids are. The game draws them at random among those set. Bit 0x0001 is röid 128, 0x0002 is röid 129, and so on to 0x8000 (röid 143). 0: no asteroids.',
      code: [['SpawnAsteroid', 0x3a233]],
    },
    DudeTypes: {
      note: 'The düdes for the system\'s ships. 128 to 639: that düde with the Probs beside it as its weight. Anything else: none.',
      code: [['SelectDudeFieldFromSystem', 0x674d], ['RandomShipSpawn', 0x3c0f3]],
    },
    Probs: {
      note: 'The weight of the DudeTypes beside it. The game draws a düde with the chance of its Probs over the total of them all. The total need not be 100.',
      code: [['SelectDudeFieldFromSystem', 0x674d], ['Rand', 0xa4c76]],
    },
    AvgShips: {
      note: 'How many ships the game places when the player enters the system. Each is a përs 1 time in 7 (one picked from those the player may meet here). Otherwise it is a flët 1 time in 7 and otherwise a ship from DudeTypes.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['SpawnFleet', 0x42704], ['RandomShipSpawn', 0x3c0f3], ['Rand', 0xa4c76]],
    },
    Person: {
      note: 'Up to eight përs that may be here as well as those AvgShips brings. Each comes when the player enters with a chance of its PersonProb in 100. No one may have destroyed or captured it and its ActivateOn test must pass.',
      code: [['SetupShipsInSystem', 0x42b61], ['SpawnPerson', 0x408d5], ['EvalMissionBitTestString', 0x9959e]],
    },
    PersonProb: {
      note: 'The chance in 100 that the Person beside it comes when the player enters.',
      code: [['SetupShipsInSystem', 0x42b61], ['Rand', 0xa4c76]],
    },
    Message: {
      note: 'Shown when the player reaches the system. It is entry Message of STR# 1000 or the STR resource numbered Message + 999 where there is one. -1: the game picks "Entering the", "Jumping into the", or "Arriving in the" at random. The system\'s name follows.',
      code: [['HandlePlayer', 0x68390], ['DisplayMessage', 0x5289], ['LoadPluginString', 0x71a8e]],
    },
    ReinfFleet: {
      note: 'The flët that comes when a ship of a government allied with the fleet\'s signals for help in this system. A ship signals when the odds against it are more than half the MaxOdds of the fleet\'s government. Without that test the fleet also comes when a ship the player hails comes to help the player. While the fleet is on its way a warship of that side runs only once the odds reach twice its MaxOdds instead of its MaxOdds. Below 128: none.',
      bible: 'a ship calls the fleet once the odds against ships allied with its government exceed that government\'s MaxOdds, not half of it.',
      code: [['AICallForReinforcements', 0x7f5a1], ['GovtAllies', 0x4e3d], ['WarshipAI', 0x8b729], ['DoCommDialog', 0x956d5], ['LoadObjectData', 0x771b0], ['HandleReinforcements', 0x39048]],
    },
    ReinfTime: {
      note: 'How long the fleet needs to come once called. The game counts it down by the game speed each step and then the fleet jumps in from hyperspace. When less than a quarter remains the game shows "Sensors detect" followed by the government\'s name and "reinforcement fleet approaching."',
      code: [['AICallForReinforcements', 0x7f5a1], ['HandleReinforcements', 0x39048]],
    },
    ReinfIntrval: {
      note: 'Days from the fleet\'s warning or its coming before a ship can call it here again. At least 1.',
      code: [['HandleReinforcements', 0x39048], ['IncrementGameTime', 0xb516]],
    },
  },
  'shïp': {
    Holds: {
      note: 'Tons of cargo. The player\'s ship adds each ModType 2 outfit\'s ModVal. The player\'s cargo space also counts the Holds of each ship flying with the player under AI 6 whose class has an InherentAI of 2 or less (up to 32,000 in all). Below 0: the ship has as many tons but the player cannot buy any outfit that uses hold space (ModType 2 with a negative ModVal) for it. Otherwise such an outfit needs that much room free.',
      code: [['LoadObjectData', 0x771b0], ['ShipTotalHolds', 0x5cb3], ['TotalFleetHolds', 0xc24d], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Shield: {
      note: 'Shield points for a ship of this class. The player\'s ship adds the ModVal of each ModType 4 outfit. A përs\'s ship scales the shield by its ShieldMod percentage when ShieldMod is above 0. Launched fighters and ships the player captures fly under AI 5. A ship under AI 5 has its shield multiplied by 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipShieldCapacity', 0x2995]],
    },
    Accel: {
      note: 'Accel ÷ 10,000 is its acceleration each 30th of a second. The player\'s ship adds each ModType 7 outfit\'s ModVal ÷ 10,000. For another ship the game multiplies it by its skill (SkillVar) × its government\'s SkillMult ÷ 100 and then by 2. It drops to a third while it is in another ship\'s tractor beam. Ionization reduces it by at most 70% (IonizeMax). Flags 0x0400 makes it 0. A ship caught in a tractor beam matches the speed of the ship that fired it by a quarter of the player\'s acceleration each 30th of a second whoever fired the beam.',
      code: [['LoadObjectData', 0x771b0], ['ShipAccelRate', 0x353b], ['HandleShip', 0x33581]],
    },
    Speed: {
      note: 'Speed ÷ 100 is its top speed each 30th of a second. The player\'s ship adds each ModType 8 outfit\'s ModVal ÷ 100. The game then multiplies the top speed of the player\'s ship and of the ships flying with it by 1.5 unless the pilot is a strict-play pilot. For another ship the game multiplies it by its skill (SkillVar) × its government\'s SkillMult ÷ 100. It drops to a third while it is in another ship\'s tractor beam. Flags 0x0400 makes it 0.',
      code: [['LoadObjectData', 0x771b0], ['ShipMaxSpeed', 0x36f2], ['DoNewPilotNameDialog', 0x165cc]],
      bible: 'Top speed. 300 is also an average value here.',
    },
    Maneuver: {
      note: 'Maneuver ÷ 10 is its turn in degrees each 30th of a second. The player\'s ship adds each ModType 9 outfit\'s ModVal ÷ 100 and turns at least 1 if the class turns at all. For another ship the turn drops to a third while it is in another ship\'s tractor beam. A class turning 1 or more turns at least 1. Ionization then reduces the turn by at most 70% unless the ship is jumping.',
      code: [['LoadObjectData', 0x771b0], ['ShipTurnRate', 0x32f7]],
    },
    Fuel: {
      note: 'Units of fuel. A jump uses 100. The player\'s ship adds each ModType 12 outfit\'s ModVal (0 to 32,000). Another ship jumps out of a system only if its class has 100 or more. A përs\'s ship with Flags2 0x0001 also needs 100 aboard.',
      code: [['ShipFuelCapacity', 0x2f21], ['HandlePlayer', 0x68390], ['AIShipHasFuelForJump', 0x7f48f]],
    },
    FreeMass: {
      note: 'Tons for outfits. The player\'s ship has this minus the Mass of each outfit carried. An outfit with Flags 0x0400 weighs that percentage of this class\'s Mass when that is more. Below 0 counts as 0. Its stock weapons and their ammunition use none of it because loading adds their outfits\' Mass to it (WeapType). The outfitter offers an outfit to the player only while its Mass fits (or is 0 or less).',
      code: [['ShipFreeMass', 0xb462], ['LoadObjectData', 0x771b0], ['AdjustedItemMass', 0x2889], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Armor: {
      note: 'Armor points for a ship of this class. The player\'s ship adds the ModVal of each ModType 6 outfit. A përs\'s ship scales the armor by its ShieldMod percentage when ShieldMod is above 0. A ship under AI 5 has its armor multiplied by 1.333 (as Shield).',
      code: [['LoadObjectData', 0x771b0], ['ShipArmorCapacity', 0x2bc0]],
    },
    DispWeight: {
      note: 'The shipyard shows the classes on offer highest DispWeight first and classes of equal DispWeight by id (but see Flags3 0x4000).',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    DeathDelay: {
      note: 'How many steps its ships need to break up once their armor is gone. Small explosions (Explode1) show over them 1 in 8 steps while 60 or more steps remain, 1 in 4 from 40, 1 in 2 from 20, and then every step. At the end a ship of Mass 100 or more without Flags 0x0400 blasts every ship within Mass × 0.075 + 50 for Mass × 0.0375 + 25 damage. The blast can disable but not kill. Then Explode2 shows and the ship is gone.',
      code: [['HandleShipDisplay', 0x2b514], ['DamageShip', 0x3a807], ['CreateExplosion', 0x3f698]],
      bible: '0 to 59: the ship disintegrates for this number of frames and then disappears in a single fireball. 60 and up: then a huge explosion, its size proportional to the ship\'s mass.',
    },
    Explode1: {
      note: 'The explosion shown over its ships as they break up (DeathDelay). 0 to 63: bööm 128 + n. 1000 to 1063: a big one with smaller ones around it. Anything else: none.',
      code: [['HandleShipDisplay', 0x2b514], ['CreateExplosion', 0x3f698]],
    },
    Explode2: {
      note: 'The explosion when one of its ships is gone after DeathDelay or immediately when it touches a deadly stellar. Its values are as Explode1. The big kind spreads over the blast of a ship of Mass 100 or more.',
      code: [['HandleShipDisplay', 0x2b514], ['HandleDeadlyStellars', 0x39ccd], ['CreateExplosion', 0x3f698]],
    },
    Length: {
      note: 'Shown in the ship\'s description. Nothing else reads it.',
      code: [['ShipDescDialogUpdate', 0x4f915]],
    },
    Flags: {
      note: '0x0001 to 0x0004: its jumps run at 0.7 (0x0001), 1.3 (0x0002), or 1.6 (0x0004) × the usual pace. Only the first bit set counts. 0x0008: its FuelRegen works for the player. 0x0010: it becomes disabled at a tenth of its armor instead of a third. 0x0020: another ship has an afterburner when the player\'s kills ÷ shïp 128\'s Strength reach 256 + a number up to 1,343 drawn for it. 0x0040: always. 0x0100 and 0x0200 change what the target display shows of its shields and armor. 0x0400: a planet-type ship. Only weapons with wëap Flags2 0x0400 hit it and those hit nothing else. When it is not the player\'s it does not move. Tractor beams do not work on it and it leaves no blast. 0x1000 to 0x4000: its turrets cannot fire within 45° of ahead (0x1000), from 45° to 135° off (0x2000), or beyond 135° (0x4000). 0x8000: in the player\'s fighter bay it is the player\'s escape ship. The player ejects into it. The program reads neither 0x0080 nor 0x0800.',
      code: [['LoadObjectData', 0x771b0], ['HandleShip', 0x33581], ['ShipFuelGenRate', 0x2ffb], ['IsDisabled', 0x2ce6], ['AIHasAfterburner', 0x64f5], ['DrawStatusTarg', 0x4ace1], ['ShotCanHitShip', 0x4477e], ['AIFireGun', 0x7feb6], ['ShipAccelRate', 0x353b], ['HandleBeams', 0x30295], ['TurretBlindSpot', 0xb325], ['EscapeShipType', 0x38d0]],
      bible: '0x0001, slow jumping (75% normal speed); 0x0002, semi-fast (125%); 0x0004, fast (150%).',
    },
    Flags2: {
      note: '0x0001: its ships swarm. 0x0002: they hold off at 0.85 of their longest reach. 0x0004: the player cannot target it. The targeting keys and mouse pass it over and AI ships fire no missiles or turrets at it. 0x0008: point defense fires on it. 0x0010: as the player\'s escort it does not reply to orders. 0x0020: it jumps without slowing down. 0x0040: it is inertialess. 0x0080: the warship, interceptor, and escort AIs change its orders when it is out of ammunition. 0x0100 to 0x0800: as an AI ship it cloaks while a weapon is in burst reload (0x0100), while running away (0x0200), while jumping (0x0400), or while flying about (0x0800). 0x1000: it stays cloaked while attacking until within 165 of its target on both axes or while mining. 0x2000: it cloaks while idle. 0x4000: it cloaks immediately when a ship it is not fighting attacks it. Its burst weapons go into their burst reload. An escort in formation behind a cloaked lead cloaks too.',
      code: [['AIDoSwarming', 0x80250], ['HighLevelAIHandler', 0x8d453], ['FindNearestShipToPlayer', 0x923f], ['HandleMouse', 0x37fba], ['AIFireMissile', 0x8115d], ['AIFireTurret', 0x80ad3], ['HandleShipPointDefense', 0x392c4], ['IssueNewEscortCommand', 0x660d5], ['SpeakVoiceMessage', 0x44558], ['ShipCanExpiditeJumps', 0x7872], ['ShipIsInertialess', 0x79c2], ['AIShipIsOutOfAmmo', 0x7f71f], ['AIHandleCloaking', 0x833e1], ['DamageShip', 0x3a807]],
    },
    PodCount: {
      note: 'How many escape pods its ships launch as they break up (DeathDelay). The first goes immediately. Then one goes every DeathDelay ÷ PodCount × 0.4 frames and at least 10 frames apart. 0 or less: none.',
      code: [['RandomShipSpawn', 0x3c0f3], ['HandleShip', 0x33581], ['SpawnEscapePod', 0x45547]],
      bible: 'At a rate of one per second.',
    },
    Mass: {
      note: 'It sets how many days a jump lasts. Under 100: 1 day. 100 to 199: 2 days. From 200: 3 days. The player\'s ship adds each ModType 22 outfit\'s ModVal to the days (at least 1). From 100 it shows as a larger blip on the radar. A tractor beam catches it only when the firing ship\'s Mass is at least ¾ of this. With 0 or less or with Flags 0x0400 no beam catches it. The game tests only a ship of 100 or more for giving up a hopeless chase.',
      code: [['ShipHyperTransitTime', 0x43d0], ['DrawStatusRadar', 0x496e0], ['HandleBeams', 0x30295], ['AIEvalHopelessChase', 0x80ea9]],
    },
    InherentAI: {
      note: 'The AI of its ships wherever a düde, mission, or përs leaves it 0 or less (1 WimpyTraderAI, 2 BraveTraderAI, 3 WarshipAI, and 4 InterceptorAI). With 0 or less none runs. 2 or less is a trading ship. As the player\'s escort its Holds add to the player\'s cargo space. A fleet\'s ship starts with cargo (flët Flags). Missions and persons can require the player to fly one (mïsn Flags and përs Flags). Above 2: as the player\'s escort it adds to the player\'s capture odds (Crew).',
      code: [['RandomShipSpawn', 0x3c0f3], ['AIDispatch', 0x8fb52], ['TotalFleetHolds', 0xc24d], ['HyperSpawnFleet', 0x41c8d], ['SetPlunderValues', 0x92219]],
    },
    InherentGovt: {
      note: 'Two governments for every ship of the class. 128 to 383: that gövt as both. 1128 to 1383: minus 1000 for the attributes government only. 2128 to 2383: minus 2000 for the combat government only. Anything else: neither. Other ships see its combat government. A warship picks it as a target and a stellar treats it as a threat when that government is their enemy. It counts among a ship\'s friends when that government is an ally. The attributes government gives it that government\'s jamming and determines whether it signals for help. The game also reads it where the ship hails, where the player captures it, or where it flies as an escort.',
      code: [['LoadObjectData', 0x771b0], ['SelectWarshipTarget', 0x89d5e], ['IsThreatToStellar', 0x9ef7], ['AIShipFriendStrength', 0x825a8], ['ShipECM', 0x3aff], ['AICallForHelp', 0x82ffb], ['DoCommDialog', 0x956d5], ['DoShipCapture', 0x41120], ['IssueNewEscortCommand', 0x660d5]],
    },
    Crew: {
      note: 'The player\'s odds in percent of capturing a boarded ship. They are 10 × the player\'s crew ÷ its Crew + each ModType 25 outfit\'s ModVal + a tenth of the Crew of each escort flying with the player under AI 6 whose class has an InherentAI above 2. The player\'s crew here is the class\'s Crew. The game then adds 10 if the player\'s Strength (counted the same way) is more than 5 × its Strength. It adds each negative ModType 25 outfit\'s ModVal made positive and ± 5 at random. The result stays between 1 and 75. The odds are 0 against a ship of a government with Flags 0x0800, in an unregistered copy, or when the player cannot take on another escort.',
      code: [['SetPlunderValues', 0x92219], ['CanHireEscorts', 0x5795], ['Rand', 0xa4c76]],
    },
    Strength: {
      note: 'Its weight in the odds a ship works out before fighting or running. A ship adds its Strength × the share of its shields left (¼ to 1) to its friends\' and sets that against the Strength of those opposing it. A warship runs when the odds pass its government\'s MaxOdds. The player\'s ship multiplies it by the player\'s kills ÷ (6,400 × shïp 128\'s Strength) kept between 1 and 2. For boarding see Crew.',
      code: [['AIShipFriendStrength', 0x825a8], ['AICalculateOddsAgainst', 0x84a2e], ['SetPlunderValues', 0x92219]],
    },
    WeapType: {
      note: 'Four stock weapons and four more in WeapType2. 128 to 383: that wëap. Anything else: none. Every ship of the class has them. That includes every ship spawned of it and the player\'s ship when the player buys, captures, or starts in one. If a weapon appears twice the later count applies. At loading the game adds to FreeMass the Mass of the first ModType 1 outfit for each weapon × its WeapCount and of the first ModType 3 outfit for its ammunition × its AmmoLoad. So they use none of it.',
      code: [['LoadObjectData', 0x771b0], ['AdjustedItemMass', 0x2889], ['RandomShipSpawn', 0x3c0f3], ['DoShipyardDialog', 0x5e679], ['DoShipCapture', 0x41120]],
    },
    WeapCount: {
      note: 'How many of the WeapType beside it. 0 or less: none. Its AmmoLoad still counts.',
      code: [['LoadObjectData', 0x771b0]],
    },
    AmmoLoad: {
      note: 'Ammunition for the WeapType beside it if the weapon uses any. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0]],
    },
    WeapType2: {
      note: 'Four more stock weapons after WeapType\'s. The game reads them the same way.',
      code: [['LoadObjectData', 0x771b0]],
    },
    WeapCount2: {
      note: 'How many of the WeapType2 beside it (as WeapCount).',
      code: [['LoadObjectData', 0x771b0]],
    },
    AmmoLoad2: {
      note: 'Ammunition for the WeapType2 beside it (as AmmoLoad).',
      code: [['LoadObjectData', 0x771b0]],
    },
    MaxGun: {
      note: 'How many fixed guns (outfits with Flags 0x0001) the ship can mount. The player\'s ship adds each ModType 45 outfit\'s ModVal. 0 or less: none.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    MaxTur: {
      note: 'How many turrets (outfits with Flags 0x0002) the ship can mount. The player\'s ship adds each ModType 46 outfit\'s ModVal. 0 or less: none.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    ShieldRech: {
      note: 'ShieldRech ÷ 1,000 shield points come back each 30th of a second. That is ShieldRech × 0.03 a second. 0 or less: none. The player\'s ship adds each ModType 5 outfit\'s ModVal ÷ 1,000. A ship under AI 5 has it multiplied by 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipShieldRechargeRate', 0x2abb], ['HandleShip', 0x33581]],
    },
    ArmorRech: {
      note: 'ArmorRech ÷ 1,000 armor points come back each 30th of a second. That is ArmorRech × 0.03 a second. 0 or less: none. A disabled ship recovers none. The player\'s ship adds each ModType 29 outfit\'s ModVal ÷ 1,000 and multiplies the total by 50 while the cheats are on. A ship under AI 5 has it multiplied by 1.333.',
      code: [['LoadObjectData', 0x771b0], ['ShipArmorRechargeRate', 0x2e0e], ['IsDisabled', 0x2ce6], ['HandleShip', 0x33581]],
    },
    SkillVar: {
      note: 'A ship\'s skill is (100 - SkillVar + a number from 0 to 2 × SkillVar drawn at random) ÷ 100. For a ship other than the player\'s it multiplies Accel and Speed. A fleet\'s or përs\'s ship draws it from shïp 128\'s SkillVar before the game gives it its actual class.',
      code: [['RandomSkillLevel', 0x6922], ['GenericRandomShipSpawn', 0x3c89f], ['Rand', 0xa4c76]],
      bible: 'This affects acceleration and turn rate for each ship. Values from 1 to 50% are valid.',
    },
    Deionize: {
      note: 'Deionize ÷ 100 of its ionization wears off each 30th of a second. 0 or less: 1. The player\'s ship adds each ModType 39 outfit\'s ModVal ÷ 100.',
      code: [['LoadObjectData', 0x771b0], ['ShipDeionizationRate', 0x6ec3], ['HandleShip', 0x33581]],
    },
    IonizeMax: {
      note: 'Its ionization divided by IonizeMax is the fraction by which ionization slows its acceleration, top speed, and turning (at most 70%). The player\'s ship adds each ModType 40 outfit\'s ModVal. 0 or less: never slowed.',
      code: [['LoadObjectData', 0x771b0], ['ShipIonizationFactor', 0x3225]],
    },
    Availability: {
      note: 'A test of control bits. While it fails the player cannot buy the class. With Flags3 0x0100 the shipyard also hides it. Empty: no test.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['SetupPortAvailableShipTypes', 0xbbe3], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnPurchase: {
      note: 'Control bits set when the player buys a ship of this class. The game also sets them when it is the ship the player receives after escaping in a pod. Empty: none.',
      code: [['DoShipyardDialog', 0x5e679], ['HandlePlayer', 0x68390], ['ResetPlayer', 0x1d40d], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnCapture: {
      note: 'Control bits set when the player captures a ship of this class. Empty: none.',
      code: [['DoShipCapture', 0x41120], ['DoPlunderDialog', 0x9302b], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRetire: {
      note: 'Control bits set when the player leaves a ship of this class. The player leaves it by trading it in at a shipyard, by taking a captured ship in its place, or by escaping from it in a pod. Empty: none.',
      code: [['DoShipyardDialog', 0x5e679], ['DoShipCapture', 0x41120], ['HandlePlayer', 0x68390], ['HasEscapePod', 0xb83d], ['EvalMissionBitSetString', 0x99dc5]],
    },
    ShortName: {
      note: 'Its name in the shipyard\'s list. "\\n" in it splits it over two lines. The shipyard draws a line starting with a letter or digit in white.',
      code: [['LoadObjectData', 0x771b0], ['ShipyardDialogUpdate', 0x58a10], ['SplitTwoLineString', 0x7dc1]],
    },
    CommName: {
      note: 'Its name in the hail and escort dialogs.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5], ['DoEscortDialog', 0x951ee]],
    },
    LongName: {
      note: 'Its full name. It appears in the shipyard and the ship\'s description, in the message a new pilot starts with, and in messages about the player\'s ship in flight.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['ShipDescDialogUpdate', 0x4f915], ['DoNewPilot', 0x18b0a], ['HandlePlayer', 0x68390]],
    },
    MovieFile: {
      note: 'A movie played on a loop in the shipyard while the player has the class selected.',
      code: [['LoadObjectData', 0x771b0], ['ShipyardFilter', 0x60449], ['StartLoopingMovie', 0x60266]],
    },
    Subtitle: {
      note: 'Shown under its name in the target display unless the ship is a përs\'s that sets a Subtitle. It also shows under the player\'s ship on the main screen.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1], ['MainScreenUpdate', 0x17c0d]],
    },
    KeyCarried: {
      note: 'A class (128 to 895) of fighters aboard it. The class also serves as its key. The key is aboard while one of its fighter bays has one or more. Only then does its shän with Flags 0x0004 show its second set of frames and its weapons with wëap Flags2 0x0080 fire. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['KeyCarriedShipTypeOnboard', 0x399c], ['HandleShipDisplay', 0x2b514], ['WeaponHasAmmo', 0xb95a]],
    },
    EscortType: {
      note: 'Its group among the player\'s escorts. 0: fighter. 1: medium. 2: warship. 3: freighter. For anything else loading picks 3 for an InherentAI of 2 or less and otherwise 0 below Mass 50, 1 below 200, or 2 from 200. The group also gives the class 80 (fighter), 90 (medium), or 100. A turret\'s shot rolls from 1 to its firer\'s number. It misses a ship that is not disabled when the roll is over the target\'s number.',
      code: [['LoadObjectData', 0x771b0], ['DrawEscortMenuInFrame', 0x56268], ['ShotCanHitShip', 0x4477e]],
    },
    AppearOn: {
      note: 'A test of control bits. While it fails the game draws no ships of this class from a düde. A mission\'s ships may still use it when no other class remains. Empty: no test.',
      code: [['PropagateMissionBitEffects', 0x99676], ['SelectShipFieldFromDude', 0x65c2]],
    },
    TechLevel: {
      note: 'Offered at stellars with a shipyard whose TechLevel is at least this or with this among their SpecialTech. Below 0: in none.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    Cost: {
      note: 'The shipyard\'s price is this minus a trade-in and never below 0. The trade-in is a quarter of the player\'s current ship\'s Cost and half the Cost of each outfit the player carries. Some outfits do not count. The PriceMod of every rank the player holds with a government allied to the stellar\'s multiplies each amount (the trade-in twice over). At a stellar of TechLevel 5 or less a ship of lower TechLevel costs 3% less for each level between (from 100 credits). The trade-in again counts that twice. The game rounds each amount down to 10 credits above 100, 100 above 10,000, and 1,000 above 100,000.',
      bible: 'the price is the new ship\'s Cost less 25% of the original cost of your current ship and upgrades; it says nothing of outfits at half, nor of the PriceMods and TechLevel.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['PlayerShipTradeInPrice', 0xb079], ['ApplyPriceAndTechnologyFlux', 0x4e6cd], ['DoPortDialog', 0x5f911]],
    },
    BuyRandom: {
      note: 'The chance in 100 that it is for sale on a given day. It is for sale while BuyRandom is at least a number from 1 to 100 drawn for its class each day. 0: never.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    HireRandom: {
      note: 'The chance in 100 that it is for hire on a given day. It is for hire while HireRandom is at least a number from 1 to 100 drawn for its class each day. 0: never. In an unregistered copy the program skips the draw and every class above 0 is for hire every day. That is the state in which the program sends its nag ship (Captain Hector).',
      bible: 'says nothing of the unregistered copy.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['SpawnNagShip', 0x5fdb]],
    },
    Require: {
      note: 'The player can buy it only when the Contributes bits of the player\'s ship and outfits include every bit set here. With Flags3 0x0200 the shipyard also hides it until then. Without that flag the shipyard shows it but the player cannot buy it.',
      code: [['CalcShipCanBuy', 0x4f5eb], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableShipTypes', 0xbbe3], ['GetPlayerContributeBits', 0x76b2]],
    },
    UpgradeTo: {
      note: 'The ship class an escort of this class that you own (not a hired one) becomes when you have marked it in the escort dialog ("Will be upgraded at next shipyard") and land at a shipyard with its EscUpgrdCost in hand. Below 128: you cannot upgrade it ("This ship class cannot be upgraded.").',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['LoadObjectData', 0x771b0]],
    },
    EscUpgrdCost: {
      note: 'Credits charged for that upgrade at the shipyard. With fewer the upgrade waits.',
      code: [['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    EscSellValue: {
      note: 'Credits paid to the player for an escort of this class marked "Will be sold off at next shipyard" when the player lands at a shipyard. The escort then leaves. This applies only to escorts the player owns and not to hired or disabled ones. 0 or less: a tenth of its Cost.',
      code: [['DoEscortDialog', 0x951ee], ['DoEscortLand', 0x4031f], ['EscortDialogUpdate', 0x94a1b]],
    },
    DefaultItems: {
      note: 'An outfit a ship of this class comes with (ItemCount of it). 128 to 639: that oütf. Anything else: none. The player\'s ship receives it when the player buys one at a shipyard, starts a new pilot in one, or captures one, or when a set expression gives the player one. Four more fields of the same kind follow from DefaultItms2.',
      bible: '128 to 255.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['DoNewPilot', 0x18b0a], ['DoShipCapture', 0x41120], ['EvalSetExp', 0x150fc]],
    },
    ItemCount: {
      note: 'How many of the DefaultItems beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    DefaultItms2: {
      note: 'Four more DefaultItems with ItemCount2. The game reads them the same way.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    ItemCount2: {
      note: 'How many of the DefaultItms2 beside it. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679]],
    },
    Contributes: {
      note: 'Added to the player\'s bits while the player flies this class. The player\'s bits come from the ship class, every outfit the player carries, every ränk the player has, and every crön event that is running. The Require of a shïp, mïsn, crön, or gövt passes when the bits include every bit it sets. So do an oütf\'s Requires.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
    FuelRegen: {
      note: 'One unit of Fuel comes back every FuelRegen steps × the game speed up to what the ship can have. 0 or less: none. The player\'s ship regains it only with Flags 0x0008.',
      code: [['ShipFuelGenRate', 0x2ffb], ['HandleShip', 0x33581]],
    },
    Flags3: {
      note: '0x0001 and 0x0002: a ship not following another flies as a miner. With 0x0001 it parks where there are no asteroids. With 0x0002 it goes between the nearest stellars and coasts 100 to 174 steps instead of 300 to 499 when idle. 0x0020: a planet\'s Gravity does not pull it and deadly stellars do not harm it. 0x0040: the game draws its turrets\' shots above the ships. 0x0100: the shipyard hides it while its Availability fails. 0x0200: the shipyard hides it while its Require fails. 0x4000: while it is on offer the shipyard offers no higher-numbered class of the same DispWeight. The program does not read 0x0010.',
      code: [['AIDispatch', 0x8fb52], ['MinerAI', 0x8b202], ['HighLevelAIHandler', 0x8d453], ['ShipResistsGravity', 0x7b10], ['ShipResistsDeadlyStellars', 0x7bbe], ['SpawnShot', 0x3e550], ['SetupPortAvailableShipTypes', 0xbbe3]],
      bible: '0x0010, the ship ignores gravity; 0x0020, it ignores deadly stellars.',
    },
  },
  'gövt': {
    VoiceType: {
      note: 'Its ships\' spoken messages. They are snd resources from 1000 + 100 × VoiceType with ten for each kind of message. The game picks one of those present at random. -1: none.',
      code: [['HandleVoiceSound', 0x31e20]],
    },
    Flags: {
      note: '0x0001: every government not its ally and every independent ship is its enemy (Enemies). 0x0004: its warships attack the player whenever they see the player. 0x0008: shots from the player and the player\'s fleet do not hit its ships. 0x0010: its warships run when their shields fall below 30% or 15% of full depending on their aggression or at the share a përs sets. Without it they fight on. 0x0040: its warships leave the player alone. The shots of the player\'s fleet and its ships do not hit each other. 0x0080: the game halves the jamming of its ships other than the player\'s (InhJam). 0x0100: a përs\'s ship of it launches no escape pod. 0x0200: its warships accept bribes. 0x2000: its freighters accept bribes. 0x4000: its stellars accept bribes. 0x0400: the player cannot hail its ships. 0x0800: its ships are derelicts. They are always disabled and no one\'s ally or enemy. Nothing the player does to them brings a penalty. 0x1000: its warships fly the pirate warship AI and plunder before they destroy. 0x0002: its warships also attack the player in other governments\' and independent systems when the record there is below -2 × CrimeTol. 0x0020: other governments\' warships do not come to help its ships when something attacks them. 0x8000: its ships demand a bigger bribe of 10,000 + 1,000 × a random number up to the player\'s credits ÷ 10,000. Otherwise the bribe is 3,000 + 1,000 × a random number up to the player\'s credits ÷ 2,000,000. Its stellars demand half as much again and always accept one. A bribe is at most a third of the player\'s credits.',
      code: [['GovtEnemies', 0x4f22], ['WarshipAI', 0x8b729], ['AIMakeShipAttackPlayer', 0x89c3e], ['ShotCanHitShip', 0x4477e], ['ShipECM', 0x3aff], ['HandleShip', 0x33581], ['DoCommDialog', 0x956d5], ['DoPlanetCommDialog', 0x96949], ['HandlePlayerCommunication', 0x61f48], ['IsDisabled', 0x2ce6], ['GovtAllies', 0x4e3d], ['SlapWithPenalty', 0x9bbc], ['AIDispatch', 0x8fb52], ['PirateWarshipAI', 0x8c2d2], ['SelectWarshipTarget', 0x89d5e], ['DoGoodSamaritan', 0x82823]],
      bible: '0x0010: warships of this govt will retreat when their shields drop below 25%. 0x0080: freighters (AI types 1 and 2) have 50% of the standard InherentJam value for warships.',
    },
    Flags2: {
      note: '0x0001: the hail dialog offers no request for help with its ships. 0x0002 and 0x0004: how its systems count in drawing the political boundaries on the map. 0x0008: its ships do not signal for help. 0x0010: its ships help the player by repairing or refueling free of charge (as does a ränk with Flags 0x0800 held with an ally). 0x0020 to 0x0080 set where its ships go. 0x0020: never to a hypergate. 0x0040: to a hypergate whenever the system has one. 0x0080: to a wormhole whenever the system has one (without it never to a wormhole). Its mission ships always reach the player\'s system through a hypergate with 0x0040. Without it they do half the time and never with 0x0020. They always come through a wormhole with 0x0080 and otherwise one time in four.',
      code: [['CommFilter', 0x908ed], ['AddSystemInfluenceToMap', 0x11592], ['AICallForHelp', 0x82ffb], ['DoCommDialog', 0x956d5], ['DoShipCommPayment', 0x920f3], ['SelectRandomStellarDest', 0x805de], ['HandlePlayerDockRequest', 0x66691]],
    },
    CrimeTol: {
      note: 'Whether its warships attack the player depends on the player\'s record in the current system. In systems it governs they attack below -CrimeTol. In an ally\'s they attack below -1.5 × CrimeTol. In an enemy\'s they attack above CrimeTol. Elsewhere they attack only with Flags 0x0002 and below -2 × CrimeTol. The player\'s legal status in its systems drops a step at -CrimeTol, -4, -16, -64, -256, and -1,024 × CrimeTol.',
      code: [['SelectWarshipTarget', 0x89d5e], ['DrawLegalStatusString', 0xd43f], ['DamageShip', 0x3a807]],
    },
    SmugPenalty: {
      note: 'How far the player\'s record with it falls when one of its ships catches the player smuggling (ScanMask). It falls by half this where it happens and the change spreads to other systems from there. The game drops very small changes and limits the record to -32,000 to 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    DisabPenalty: {
      note: 'How far the player\'s record with it falls when the player disables one of its ships. It falls by half this where it happens and the change spreads to other systems from there. The game drops very small changes and limits the record to -32,000 to 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    BoardPenalty: {
      note: 'How far the player\'s record with it falls when the player boards one of its ships. It falls by half this where it happens and the change spreads to other systems from there. The game drops very small changes and limits the record to -32,000 to 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    KillPenalty: {
      note: 'How far the player\'s record with it falls when the player destroys one of its ships. It falls by half this where it happens and the change spreads to other systems from there. The game drops very small changes and limits the record to -32,000 to 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    ShootPenalty: {
      note: 'How far the player\'s record with it falls when the player fires on one of its ships. It falls by half this where it happens and the change spreads to other systems from there. The game drops very small changes and limits the record to -32,000 to 32,000.',
      code: [['SlapWithPenalty', 0x9bbc], ['RecursivePenaltySlap', 0x980a]],
    },
    Classes: {
      note: 'Up to four class numbers (0 and up). Below 0: none. Other governments\' Allies and Enemies, missions, and other records use them to refer to it.',
      code: [['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48]],
    },
    Allies: {
      note: 'Up to four class numbers. A government with any of them among its Classes is its ally and it is theirs. Below 0: none. A government with Flags 0x0800 is no one\'s ally.',
      code: [['GovtAllies', 0x4e3d]],
    },
    Enemies: {
      note: 'Up to four class numbers. A government with any of them among its Classes is its enemy and it is theirs even if they are also allies. Otherwise with Flags 0x0001 every government not its ally and every independent ship is its enemy. A government with Flags 0x0800 is no one\'s enemy.',
      code: [['GovtEnemies', 0x4f22], ['GovtAllies', 0x4e3d]],
    },
    SkillMult: {
      note: 'Multiplies the skill of its ships (shïp SkillVar) and so their acceleration and top speed by SkillMult ÷ 100. 0 or less: 1.',
      code: [['LoadObjectData', 0x771b0], ['ShipAccelRate', 0x353b], ['ShipMaxSpeed', 0x36f2]],
    },
    ScanMask: {
      note: 'Its scans find a mission\'s cargo, a jünk, or an outfit whose ScanMask shares a bit with this. Finding one counts as smuggling and brings ScanFine and SmugPenalty.',
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
      note: 'The player may land at its stellars only when the Contributes bits of the player\'s ship and outfits include every bit set here. The test does not apply when one of the player\'s missions goes to or returns to that stellar.',
      code: [['HandlePlayerDockRequest', 0x66691], ['PlayerMeetsRequirements', 0x776f]],
    },
    InhJam: {
      note: 'Jamming of types 1 to 4 for every ship whose class\'s attributes government it is (shïp InherentGovt). Another ship adds the jamming outfits among its class\'s DefaultItems. The game halves that ship\'s total when the ship\'s government has Flags 0x0080. The player\'s ship adds the player\'s jamming outfits. Below 0 counts as 0.',
      code: [['ShipECM', 0x3aff]],
    },
    MediumName: {
      note: 'Its name in the message when its reinforcements arrive.',
      code: [['LoadObjectData', 0x771b0], ['HandleReinforcements', 0x39048]],
    },
    Color: {
      note: 'The color of its territory on the galaxy map.',
      code: [['LoadObjectData', 0x771b0], ['DrawMapInfluence', 0xe360]],
    },
    ShipColor: {
      note: 'The color the game paints its ships (5 bits a channel). Black: unpainted. The game draws a përs\'s ship in the përs\'s color instead and leaves the player\'s ship unpainted.',
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
      note: 'The player\'s record in each system whose Govt is this at the start of a new pilot. A system with no government starts at 0. After the rescue of the player\'s escape pod (dësc 13999) every system\'s record goes back to this.',
      bible: 'says nothing of the escape pod.',
      code: [['ResetPlayer', 0x1d40d], ['ResetPlayerRecord', 0x1db70], ['DoNewPilot', 0x18b0a], ['HandlePlayer', 0x68390]],
    },
    ScanFine: {
      note: 'The fine when one of its ships fines the player after a scan. 1 and up: that many credits. 0: a warning only. Below 0: that percentage of the player\'s credits rounded down to the hundred (at least 1).',
      code: [['ScanPlayer', 0x7e46e]],
    },
    MaxOdds: {
      note: 'The game stores it as MaxOdds ÷ 100 (at least 0.01). A warship of this government runs once the odds against it pass that. While a reinforcement fleet is on its way it runs at twice that. A ship calls a system\'s reinforcement fleet of this government at half of it.',
      code: [['LoadObjectData', 0x771b0], ['WarshipAI', 0x8b729], ['AICallForReinforcements', 0x7f5a1]],
    },
  },
  'mïsn': {
    Require: {
      note: 'The game offers it only when the Contributes bits of the player\'s ship and outfits include every bit set here.',
      code: [['IsMissionAvailable', 0x9b152], ['PlayerMeetsRequirements', 0x776f]],
    },
    AvailStel: {
      note: 'Where the game offers it. -1: anywhere. 128 to 4999: at that spöb. 5000 + n: in a system with a link to sÿst 128 + n. 9999: at a stellar with no government. 10000 + n: at a stellar of gövt 128 + n. 15000 + n: at a stellar of an ally of it. 20000 + n: at a stellar of any government but it or of none. 25000 + n: at a stellar of an enemy of it. 30000 + n: at a stellar of it or of a government with the same class in the same one of the four Classes. 31000 + n: at a stellar of neither (a stellar with no government does not count). Anything else: never. The game does not test it when a ship offers the mission. Unless it is a single spöb the game does not offer the mission while its TravelStel or ReturnStel is a stellar in the player\'s current system.',
      code: [['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48], ['LoadObjectData', 0x771b0]],
    },
    AvailLoc: {
      note: 'Where the game offers it. 0: listed in the Mission BBS. 1: in the bar. 2: by a ship whose përs has it as LinkMission. The ship offers it when the player hails it. With that përs\'s Flags 0x0200 it offers it when the player boards it. 3: on landing at the spaceport. 4: at the Trade Center. 5: at the shipyard. 6: at the outfitter. Anything else: nowhere.',
      code: [['IsMissionAvailable', 0x9b152], ['OfferMissionFromPort', 0xa369e], ['DoMissionDialog', 0xa37cf], ['DoBarDialog', 0x48ef5], ['DoPortDialog', 0x5f911], ['DoTradeDialog', 0x5dbe1], ['DoShipyardDialog', 0x5e679], ['DoOutfitDialog', 0x5bacf], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    AvailRecord: {
      note: '0: no test. Above 0: the player\'s record in this system must be at least this. Below 0: it must be at most this. -32000: the stellar the player is at must be one the player has dominated. -32001: the player must have dominated some stellar. Below that: never offered.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRating: {
      note: '0 or less: no test. Above 0: the player\'s combat rating must be at least this.',
      code: [['IsMissionAvailable', 0x9b152]],
    },
    AvailRandom: {
      note: 'The chance in 100 that the game offers it. Each mission has a number from 1 to 100 that the game draws again from time to time during play. The game offers the mission while AvailRandom is at least that number. 100 or more: always. 0 or less: never. Accepting it sets its number to 0.',
      code: [['IsMissionAvailable', 0x9b152], ['InitObjects', 0x1c2e5], ['HandlePlayer', 0x68390], ['DoMissionAccept', 0xa1b11]],
    },
    AvailShipTyp: {
      note: '128 to 896: the player must be flying that ship class. 1128 to 1896: the player must not be. 2128 to 2384: the InherentGovt of the player\'s ship class must be that government (as 128 and up or 1128 and up). 3128 to 3384: it must be some other government. Anything else: no test.',
      code: [['IsMissionAvailable', 0x9b152], ['LoadObjectData', 0x771b0]],
    },
    TravelStel: {
      note: 'Where the player must go. The game picks it when it makes the mission ready to offer. -1: nowhere. 128 to 2175: that spöb. -2: one picked at random from the stellars that qualify and have Flags 0x20 clear. -3: one from those with Flags 0x20 set and 0x10 clear. The government numbers of AvailStel (9999, 10000 + n, 15000 + n, 20000 + n, 25000 + n, 30000 + n, and 31000 + n) pick one with Flags 0x20 clear from those of the governments they give. For 10000 + n stellars with Flags 0x20 set also count when gövt 128 + n has Flags 0x0800. A stellar qualifies when its system is there now (its Visibility) and it is in every version of that system. The player must be able to land on it and it must be no hypergate or wormhole (Flags2 0x1000 and 0x2000). It must not be where the player is, in the player\'s system, or in a system linked to it. The game does not offer the mission while none qualifies (not counting that last test). With -4, any other value, or none qualifying it is the player\'s current stellar. When a ship offers the mission it is the first stellar in the player\'s system. Landing on it or on a stellar of the same name at the same place completes this part of the mission.',
      bible: 'lists no -4, nor what other values do.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['StellarsAreDistant', 0x9cb9], ['StellarIsNormalLandable', 0xa9f8], ['StellarIsLandable', 0xa989], ['IsMissionAvailable', 0x9b152], ['HandleStellarSystemVisibility', 0x32aa5], ['PropagateMissionBitEffects', 0x99676], ['StellarsAreIdentical', 0xab35], ['MissionLandCargoCheck', 0x9edc5]],
    },
    ReturnStel: {
      note: 'Where the player must land to complete the mission once the player has done the rest of it. The game picks it as it picks TravelStel from where the player is. A random pick is never the stellar TravelStel picked. -1: the stellar TravelStel picked. Landing there completes it. With TravelStel -1 too no landing completes it. Landing on a stellar of the same name at the same place counts as well.',
      bible: '-1 is no specific stellar destination.',
      code: [['RandomizeOneMission', 0xa14d1], ['SelectMissionStellar', 0x9a26a], ['LoadCurrentMissionData', 0xa0a38], ['MissionLandCheck', 0xa19cc], ['StellarsAreIdentical', 0xab35]],
    },
    PickupMode: {
      note: 'When the cargo comes aboard. 0: when the player accepts. The player cannot accept while the cargo is more than the player\'s cargo space or free room. 1: on landing at TravelStel\'s stellar. While the cargo does not fit that stellar does not count as reached. 2: on boarding one of the mission\'s ships. Anything else: never. The game shows LoadCargText (unless it is -1) as the cargo comes aboard by landing or accepting.',
      code: [['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5], ['DoMissionCargoPickup', 0x98292], ['HandlePlayerBoardAttempt', 0x65000]],
    },
    DropoffMode: {
      note: 'Where the cargo comes off if it is aboard. 0: on landing at TravelStel\'s stellar. 1: on landing at ReturnStel\'s once the player meets its ShipGoal or it is -1. With ShipGoal 3 this also needs a count kept with the mission (not yet read) to be 0. Anything else: never. The game then shows DropCargText unless it is -1.',
      code: [['MissionLandCargoCheck', 0x9edc5]],
    },
    PayVal: {
      note: 'Above 0: credits paid when the player completes the mission. -10000 - n: no credits. Instead in every system whose government is gövt n a record below 0 goes to 0. -20000 - n: the same where the government is an ally of gövt n. -30000 - n: the same where the government shares a class with it. -40000 - p: the player loses p percent of the player\'s credits (p from 1 to 99). -50000 - c: the mission costs c credits for any value below -50000. The game charges them when the player accepts and never leaves the player below 0. The game offers the mission only while the player has c credits. With Flags2 0x0002 the payment also happens when the mission ends by itself. Anything else: nothing.',
      code: [['ApplyMissionPay', 0x98326], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['DoMissionAccept', 0xa1b11], ['IsMissionAvailable', 0x9b152], ['GovtAllies', 0x4e3d], ['GovtSharedClass', 0x6e48]],
    },
    ShipSyst: {
      note: 'Where the mission\'s ships are. The game works it out when the player accepts. -1: the player\'s system at that moment. -2: a random system there now (its Visibility) other than the player\'s. -3: TravelStel\'s stellar\'s system or ReturnStel\'s if TravelStel has none. -4: ReturnStel\'s. -5: a random system linked to the player\'s and there now (drawn until one qualifies). -6: whichever system the player is in. 128 to 2175: that sÿst. The government numbers AvailStel accepts (9999, 10000 + n, and the others) give a random system there now of those governments other than the player\'s. Anything else: nowhere.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SelectMissionSystem', 0x9b993], ['SetupShipsInSystem', 0x42b61], ['MissionHandlePlayerEnteredNewSystem', 0x99f11]],
    },
    ShipGoal: {
      note: 'What the player must do with the mission\'s ships before landing at ReturnStel\'s stellar finishes it. 0: destroy them all. 1: disable them all. 2 and 5: board them all. With 5 they start still and disabled and stay disabled until boarded. 3: keep them. The player meets the goal while one of them is still around. 4: see one of them once all have come (on the player\'s screen if it can cloak). 6: get rid of them. Each one destroyed or jumped out counts. Jumping out does not count with ShipSyst -6. Unless its Flags has 0x0400 the mission fails immediately when one blows up with goal 1 or 3 or with 2 or 5 before the player has boarded it. It also fails when one becomes disabled with goal 3.',
      code: [['MissionObjectivesCheck', 0x9e79e], ['HandleShipDisplay', 0x2b514], ['DamageShip', 0x3a807], ['HandlePlayerBoardAttempt', 0x65000], ['LowLevelAIHandler', 0x851da], ['QuickMissionFailure', 0x99d1b], ['ShipVisibleToShip', 0x971c], ['SetupShipsInSystem', 0x42b61], ['IsDisabled', 0x2ce6]],
    },
    ShipBehav: {
      note: 'How the mission\'s ships act. 0: each attacks the player as it appears. 1: they fly with the player as escorts do while not disabled. 2: they attack stellars of governments that are their enemies while the stellars still stand. Anything else: they fly by their AI.',
      code: [['MissionDudeSpawn', 0x3cd3b], ['AIMakeShipAttackPlayer', 0x89c3e], ['AIDispatch', 0x8fb52], ['DeathStarAI', 0x8c125], ['EscortAI', 0x838d2], ['IsDisabled', 0x2ce6]],
    },
    ShipCount: {
      note: 'How many ships the mission has. ShipSyst and ShipStart set where they go. 0 or less: none. With ShipSyst -6 and ShipBehav 1 the game does not place again those already with the player.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipDude: {
      note: 'The game draws each mission ship\'s class in turn from this düde. With the mission\'s Flags 0x0800 the game draws one class when the player accepts and that class serves for them all.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionDudeSpawn', 0x3cd3b], ['SelectShipFieldFromDude', 0x65c2]],
    },
    CompGovt: {
      note: 'The government whose regard CompReward changes (128 to 383). Anything else: none. CompReward then does nothing.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    CompReward: {
      note: 'On success the player\'s record goes up by this in every system whose government is CompGovt. It goes up by half this where the government is an ally of CompGovt\'s and down by half where it is an enemy. On failure it goes down by half in CompGovt\'s systems. It goes down by 5 × this in CompGovt\'s systems when the player aborts the mission and its Flags has 0x0040.',
      bible: 'speaks only of CompGovt: up by this on success, down by half on failure.',
      code: [['DoMissionSuccess', 0xa03fc], ['DoMissionFailure', 0xa0285], ['DoMissionInfoDialog', 0x9e19b], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    DatePostInc: {
      note: 'Days that pass when the player completes the mission or when it ends by itself.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['AutoAbortMission', 0x99bdc], ['IncrementGameTime', 0xb516]],
    },
    TimeLimit: {
      note: 'Days the player has. One comes off each day. When none remain the mission fails as soon as the player is not in a spaceport. A message shows unless its Flags has 0x0400. 0 or less: no limit.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['IncrementGameTime', 0xb516], ['MissionObjectivesCheck', 0x9e79e], ['QuickMissionFailure', 0x99d1b]],
    },
    CanAbort: {
      note: 'Anything but 0: the player can abort it from the mission list and jettison its cargo. Jettisoning the cargo fails the mission. A failed mission leaves the player\'s list immediately. 0: neither. A failed mission stays until the player next lands and then ends as failed.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['PlayerHasJettisonableCargo', 0x825a], ['JettisonCargo', 0x3dffd], ['QuickMissionFailure', 0x99d1b], ['MissionLandCheck', 0xa19cc]],
    },
    BriefText: {
      note: 'The dësc shown when the player accepts the mission. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11]],
    },
    QuickBrief: {
      note: 'The dësc shown for the mission in the player\'s list of missions. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionInfoDialog', 0x9e19b], ['MissionInfoFilter', 0x9d6e5]],
    },
    LoadCargText: {
      note: 'The dësc shown when the cargo comes aboard on accepting or landing (PickupMode 0 or 1). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['MissionLandCargoCheck', 0x9edc5]],
    },
    DropCargText: {
      note: 'The dësc shown when the cargo comes off (DropoffMode). 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionLandCargoCheck', 0x9edc5]],
    },
    CompText: {
      note: 'The dësc shown when the player completes the mission. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc]],
    },
    FailText: {
      note: 'The dësc shown when the mission fails. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285]],
    },
    RefuseText: {
      note: 'The dësc shown when the player declines the mission as the game offers it. -1: none.',
      code: [['OfferOneMission', 0xa21ac]],
    },
    ShipDoneText: {
      note: 'The dësc shown when the mission\'s ShipGoal is first met. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e]],
    },
    ShipNameID: {
      note: '-1: the mission\'s ships have their usual names. Otherwise an STR#. The game picks one of its strings at random when the player accepts and gives that name to every one of them.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1], ['AICallForHelp', 0x82ffb]],
    },
    ShipSubtitle: {
      note: '-1: none. Otherwise an STR#. The game picks one of its strings at random when the player accepts and gives that subtitle to every one of the mission\'s ships.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DrawStatusTarg', 0x4ace1]],
    },
    ShipStart: {
      note: 'Where the mission\'s ships start. -1 to -16: on the stellar in that place of their system\'s list (-1 is the first). They are there when the player comes. With 0 or a place the list does not fill the game brings them in as the system\'s other ships and they are there when the player comes. 1: they come in from hyperspace heading for the player 100 to 199 steps after the player comes (30 with ShipBehav 1 and ShipGoal 3). They do so again each time the player enters their system. 2: the first time is the same. After that they are there and cloaked when the player comes.',
      bible: '-1 to -4 for the first four stellars; 1, jump in after a short delay; 2, appear at random, cloaked.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['DoShipCloak', 0xde73], ['GenericRandomShipSpawn', 0x3c89f]],
    },
    AuxShipCount: {
      note: 'How many ships of AuxShipDude the mission sends after the player in the systems AuxShipSyst allows. 70 to 139 steps after the player enters such a system (or lifts off) as many as remain minus those already there come in from hyperspace. Each one that comes reduces what remains. With the mission\'s Flags 0x0010 the full number comes again in each system. 0 or less: none.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['MissionHandlePlayerEnteredNewSystem', 0x99f11], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipDude: {
      note: 'The düde for the aux ships (128 to 639). Anything else: none. The game then ignores AuxShipCount.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['EnterMoreShips', 0x43459], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    AuxShipSyst: {
      note: 'Where the aux ships come. -1 or -6: any system. -2: TravelStel\'s stellar\'s system. -3: ReturnStel\'s. 128 to 2175: that sÿst. 5000 + n: sÿst 128 + n or a system linked to it. The government numbers AvailStel accepts (9999, 10000 + n, and the others) give systems of those governments. There a government with Flags 0x0001 counts every government not its ally as an enemy. Anything else: none.',
      code: [['ValidAuxShipSystem', 0x992b5], ['EnterMoreShips', 0x43459], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22], ['GovtSharedClass', 0x6e48]],
    },
    ScanMask: {
      note: 'A ship of a government whose ScanMask shares a bit with this may scan the player while the mission\'s cargo is aboard. With Flags 0x0020 the mission then fails ("Your ship has been scanned - mission failed."). Otherwise it is smuggling and the player pays a fine.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['ScanPlayer', 0x7e46e]],
    },
    Flags: {
      note: '0x0001: it ends by itself once the game places its ships or the player meets its ShipGoal. It also ends on accepting if it has no ships and no ReturnStel. 0x0002: the map does not mark its systems. 0x0004: the player cannot decline it. 0x0008: offered only while the player has 100 units of fuel. The game removes that fuel when the mission ends by itself. 0x0010: the aux ships never run out. 0x0020: it fails if a scan finds its cargo aboard (ScanMask). 0x0040: aborting it costs 5 × CompReward. 0x0100: the map marks its destination while the game offers it. 0x0200: the map marks ShipSyst\'s system too. 0x0400: the player\'s list of missions leaves it out and its failures show no message. Losing its ships to destruction or disabling does not fail it. 0x0800: one class for all its ships (ShipDude). 0x2000: not offered while the InherentAI of the player\'s ship class is 2 or less. 0x4000: not offered while it is 3 or more. 0x8000: it fails when a ship plunders the player\'s ship. The program reads neither 0x0080 nor 0x1000.',
      bible: '0x0400 makes the mission invisible, kept out of the mission info dialog, and no more; it gives no 0x1000.',
      code: [['AutoAbortMission', 0x99bdc], ['SetupShipsInSystem', 0x42b61], ['EnterMoreShips', 0x43459], ['MissionObjectivesCheck', 0x9e79e], ['DoMissionAccept', 0xa1b11], ['RecalcMissionSystsForMap', 0xe1b5], ['OfferOneMission', 0xa21ac], ['IsMissionAvailable', 0x9b152], ['ScanPlayer', 0x7e46e], ['DoMissionInfoDialog', 0x9e19b], ['SetupMissionInfoList', 0x9de7a], ['DamageShip', 0x3a807], ['HandleShipDisplay', 0x2b514], ['JettisonCargo', 0x3dffd], ['MissionDudeSpawn', 0x3cd3b], ['AIPlunderShipContents', 0x83fab]],
    },
    Flags2: {
      note: '0x0001: offered only while the player\'s ship has room for its cargo. 0x0002: the player receives PayVal when it ends by itself too. 0x0004: it fails if the player\'s ship becomes disabled.',
      code: [['IsMissionAvailable', 0x9b152], ['TotalMissionCargoSpace', 0xcffb], ['AutoAbortMission', 0x99bdc], ['ApplyMissionPay', 0x98326], ['DamageShip', 0x3a807]],
    },
    AvailBits: {
      note: 'A test of control bits. The game offers the mission only while it passes. Empty: no test.',
      code: [['InitMissions', 0x97b97], ['IsMissionAvailable', 0x9b152], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnAccept: {
      note: 'Control bits set when the player accepts the mission.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionAccept', 0xa1b11], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnRefuse: {
      note: 'Control bits set when the player declines the mission as the game offers it.',
      code: [['OfferOneMission', 0xa21ac], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnSuccess: {
      note: 'Control bits set when the player completes the mission.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionSuccess', 0xa03fc], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnFailure: {
      note: 'Control bits set when the mission fails.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['DoMissionFailure', 0xa0285], ['QuickMissionFailure', 0x99d1b], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    OnAbort: {
      note: 'Control bits set when the player aborts the mission or a set expression aborts it. The game also sets them after the rescue of the player\'s escape pod (which aborts every mission) and when the mission ends by itself. It does not set them when a failed mission leaves the player\'s list.',
      code: [['LoadCurrentMissionData', 0xa0a38], ['AbortMission', 0x99a92], ['DoMissionInfoDialog', 0x9e19b], ['EvalSetExp', 0x150fc], ['HandlePlayer', 0x68390], ['AutoAbortMission', 0x99bdc], ['QuickMissionFailure', 0x99d1b]],
    },
    OnShipDone: {
      note: 'Control bits set when the mission\'s ShipGoal is first met (not with ShipGoal -1).',
      code: [['LoadCurrentMissionData', 0xa0a38], ['MissionObjectivesCheck', 0x9e79e], ['EvalCurrentMissionBitSetString', 0x99a43]],
    },
    AcceptButton: {
      note: 'The label of the Accept button as the game offers the mission. When it is empty or does not start with a letter the button reads "Yes" if the player can decline the mission and otherwise "Okay" (STR# 150).',
      bible: 'empty text gives Yes, or Okay when it cannot be refused; it says nothing of text not starting with a letter.',
      code: [['OfferOneMission', 0xa21ac]],
    },
    RefuseButton: {
      note: 'The label of the Refuse button as the game offers the mission. When it is empty or does not start with a letter the button reads "No" (STR# 150).',
      code: [['OfferOneMission', 0xa21ac]],
    },
    DispWeight: {
      note: 'This orders a port\'s missions highest first. It sets the order of the Mission BBS\'s list and which mission the game offers first elsewhere.',
      code: [['InitMissions', 0x97b97], ['RandomizeMissionData', 0xa1756], ['OfferMissionFromPort', 0xa369e]],
    },
    CargoType: {
      note: '0 to 999: that cargo. 1000: one of the first six at random. Anything else: none.',
      code: [['SelectMissionCargoType', 0x981d8]],
    },
    CargoQty: {
      note: '0 and up: that many tons. -1: none. -2 and below: half its size plus a number from 0 to one less than its size drawn at random. That gives half to one and a half × the size.',
      code: [['SelectMissionCargoQty', 0x98191]],
    },
  },
  'oütf': {
    ModType: {
      note: 'What it does. The amount is in ModVal and ModType2 to ModType4 work the same way. 1: the weapon wëap ModVal. 2: tons of hold (below 0 it uses hold space). 3: ammunition for wëap ModVal. 4: shield points. 5: shield recharge (ModVal ÷ 1,000 a frame). 6: armor points. 7: acceleration (÷ 10,000). 8: top speed (÷ 100). 9: turn (÷ 100 degrees a frame). 11: an escape pod. 12: fuel. 13: a density scanner. 14: IFF. 15: an afterburner burning ModVal fuel a second. 16: a map of the systems within ModVal jumps. -1 maps every inhabited system and -1000 - n the systems of governments of class n. 17: a cloak. In its ModVal 0x0002 shows on radar, 0x0004 drops the shields immediately, 0x0008 drops when hit, 0x00f0 ÷ 0x10 is its fuel use, 0x0f00 ÷ 0x100 is its shield use, and 0x1000 cloaks the ships in formation with it. 18: a fuel scoop (as FuelRegen). 19: auto-refueling. 20: auto-eject. 21: the player\'s record below 0 set to 0 in the systems of gövt ModVal or in every system for -1. 22: days per jump. 23: how far from the middle of the system the player can jump (1,000 + ModVal). 24: anti-interference (-100 to 100 in all). 25: the player\'s capture odds (shïp Crew). 27: the Max of oütf ModVal × how many of these the player carries. 28: murk. 29: armor recharge (÷ 1,000 a frame). 30: a cloak scanner. 31: a mining scoop. 32: ModVal extra jumps per jump. The game counts it once for each kind aboard and not for each one. 33 to 36: jamming of types 1 to 4. 37: jumping without slowing. 38: inertialess. 39: deionization (÷ 100). 40: ionization capacity. 41: gravity does not pull the player. 42: deadly stellars do not harm the player. 43: paint. 44: a reinforcement inhibitor. 45 and 46: more guns and turrets. 47 and 50: bombs. 48: an IFF scrambler. 49: now and then (1 in 500 frames) a disabled ship with it aboard repairs itself to just over the point of disabling. For another ship 32 and 49 count among its class\'s DefaultItems.',
      code: [['LoadObjectData', 0x771b0], ['ShipTotalHolds', 0x5cb3], ['ShipShieldCapacity', 0x2995], ['ShipShieldRechargeRate', 0x2abb], ['ShipAccelRate', 0x353b], ['ShipMaxSpeed', 0x36f2], ['ShipTurnRate', 0x32f7], ['HasEscapePod', 0xb83d], ['ShipFuelCapacity', 0x2f21], ['HasDensityScanner', 0x42c0], ['HasIFF', 0x4348], ['ShipAfterburnerFuelUsage', 0x7a82], ['GrantOutfitItem', 0x44d4f], ['AutoSetExploration', 0xdaba], ['HasAreaCloak', 0x3d49], ['ShipCloakVisibleOnRadar', 0x40f8], ['CloakZeroesShields', 0x3e9d], ['ShipDecloaksWhenHit', 0x3f68], ['CloakFuelUsage', 0x3e25], ['CloakShieldUsage', 0x4033], ['ShipFuelGenRate', 0x2ffb], ['DoAutoRefuel', 0x41bc5], ['HasAutoEject', 0x3a14], ['ShipHyperTransitTime', 0x43d0], ['ShipHyperSafeDist', 0x4485], ['ShipAntiInterference', 0x5f2c], ['SetPlunderValues', 0x92219], ['HasMaxOfItem', 0x4512], ['PlayerEffectiveMurk', 0x6f8f], ['ShipCanSeeCloakedShips', 0x41a9], ['ShipCanScoop', 0x75c7], ['ShipJumpsPerJump', 0x77b4], ['ShipECM', 0x3aff], ['ShipCanExpiditeJumps', 0x7872], ['ShipIsInertialess', 0x79c2], ['ShipDeionizationRate', 0x6ec3], ['ShipIonizationFactor', 0x3225], ['ShipResistsGravity', 0x7b10], ['ShipResistsDeadlyStellars', 0x7bbe], ['ResetPlayerPrecalcedValues', 0xc357], ['HandlePlayer', 0x68390], ['ShipCanSelfRepair', 0x9134], ['HandleShip', 0x33581]],
    },
    ModVal: {
      note: 'How much of the effect ModType sets. See there. For ModType 1, 3, and 21 the game stores the id minus 128.',
      code: [['LoadObjectData', 0x771b0]],
    },
    ModType2: { note: 'A second effect with the same values as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal2: { note: 'How much of ModType2\'s effect (as ModVal is for ModType).', code: [['LoadObjectData', 0x771b0]] },
    ModType3: { note: 'A third effect with the same values as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal3: { note: 'How much of ModType3\'s effect (as ModVal is for ModType).', code: [['LoadObjectData', 0x771b0]] },
    ModType4: { note: 'A fourth effect with the same values as ModType.', code: [['LoadObjectData', 0x771b0]] },
    ModVal4: { note: 'How much of ModType4\'s effect (as ModVal is for ModType).', code: [['LoadObjectData', 0x771b0]] },
    DispWeight: {
      note: 'The outfitter shows the items on offer highest DispWeight first and those of equal DispWeight by id (but see Flags 0x1000).',
      code: [['SetupPortAvailableItems', 0xbedb]],
    },
    Mass: {
      note: 'Tons of the player\'s FreeMass that each one uses. With Flags 0x0400 it is that percentage of the player\'s ship class\'s Mass when that is more. At 0 or less the player can always buy it whatever the free mass.',
      code: [['ShipFreeMass', 0xb462], ['AdjustedItemMass', 0x2889], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Max: {
      note: 'The most the player can carry. The game multiplies it by the number of ModType 27 outfits aboard that point to this one (at least 1). For ammunition (ModType 3) for a weapon with a MaxAmmo the limit is instead MaxAmmo × the launchers aboard.',
      code: [['HasMaxOfItem', 0x4512], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Flags: {
      note: '0x0001: a fixed gun. 0x0002: a turret. Both count against the ship\'s MaxGun and MaxTur. 0x0004: it stays with the player when the player buys or captures another ship and the ship\'s trade-in leaves it out. With 0x0004 or 0x0020 it also stays when a mission changes the player\'s ship. 0x0008: the player cannot sell it. 0x0010: the game removes the player\'s stock of it when the player leaves the outfitter. 0x0100: not offered unless the player\'s bits meet its Requires or the player has one. 0x4000: not offered unless its Availability test passes or the player has one. 0x0200: its price is Cost × the player\'s ship class\'s Mass when that is more. 0x0400: its Mass is that percentage of the player\'s ship class\'s. 0x0800: any outfitter shows it while the player has one. 0x1000: while it is on offer the outfitter offers no higher-numbered item of the same DispWeight. 0x2000: shown among the player\'s ranks in the player info instead of among the rest. The program reads no other bit.',
      code: [['HasMaxOfItem', 0x4512], ['LoadObjectData', 0x771b0], ['DoShipyardDialog', 0x5e679], ['PlayerShipTradeInPrice', 0xb079], ['EvalSetExp', 0x150fc], ['DoOutfitDialog', 0x5bacf], ['SetupPortAvailableItems', 0xbedb], ['AdjustedItemCost', 0x5869], ['AdjustedItemMass', 0x2889], ['SetupPlayerInfoText', 0x53cb8]],
    },
    Cost: {
      note: 'Its price. 0 or less: free. With Flags 0x0200: Cost × the player\'s ship class\'s Mass when that is more. The outfitter offers it only while the player has the credits.',
      code: [['AdjustedItemCost', 0x5869], ['CanBuyOutfitItem', 0x4e7c4]],
    },
    Requires: {
      note: 'The outfitter offers it to the player only when the Contributes bits of the player\'s ship and outfits include every bit set here wherever RequireGovt applies them. With Flags 0x0100 the outfitter hides it until then unless the player has one.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableItems', 0xbedb]],
    },
    Availability: {
      note: 'A test of control bits. While it fails the outfitter does not offer it. With Flags 0x4000 the outfitter also hides it unless the player has one. Empty: no test.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['SetupPortAvailableItems', 0xbedb], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnPurchase: {
      note: 'Control bits set when the player buys one. Empty: none.',
      code: [['DoOutfitDialog', 0x5bacf], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnSell: {
      note: 'Control bits set when the player sells one. Empty: none.',
      code: [['DoOutfitDialog', 0x5bacf], ['EvalMissionBitSetString', 0x99dc5]],
    },
    ShortName: {
      note: 'Its name in the outfitter\'s list.',
      code: [['LoadObjectData', 0x771b0], ['OutfitDialogUpdate', 0x572cb]],
    },
    LCName: {
      note: 'Its name in a sentence for a single one. It appears when the player buys, sells, or plunders it, when a scan catches the player with it (ScanMask), and in the player info.',
      code: [['LoadObjectData', 0x771b0], ['DoOutfitDialog', 0x5bacf], ['DoPlunderDialog', 0x9302b], ['ScanPlayer', 0x7e46e], ['SetupPlayerInfoText', 0x53cb8]],
    },
    LCPlural: {
      note: 'Its name in a sentence for more than one. LCName is for one.',
      code: [['LoadObjectData', 0x771b0], ['DoOutfitDialog', 0x5bacf], ['DoPlunderDialog', 0x9302b], ['ScanPlayer', 0x7e46e], ['SetupPlayerInfoText', 0x53cb8]],
    },
    ItemClass: {
      note: 'Its class for a përs\'s GrantClass. Plundering that përs\'s ship may give the player outfits of one item of this class.',
      code: [['DoPlunderDialog', 0x9302b]],
    },
    ScanMask: {
      note: 'A ship of a government whose ScanMask shares a bit with this may scan the player while the player carries one. That counts as smuggling. The player\'s record with that government drops and the player pays its ScanFine. The ship\'s message gives the outfit\'s name.',
      code: [['ResetPlayerPrecalcedValues', 0xc357], ['ScanPlayer', 0x7e46e], ['SlapWithPenalty', 0x9bbc]],
    },
    RequireGovt: {
      note: 'Where its Requires apply when the player is landed. -1: everywhere. 128 to 383: at stellars of that gövt or its allies. 1128 to 1383: those and independent stellars. 2128 to 2383: everywhere but stellars of that gövt or its allies. 3128 to 3383: everywhere but those and independent stellars. Anything else: everywhere.',
      code: [['CanBuyOutfitItem', 0x4e7c4], ['GovtAllies', 0x4e3d]],
    },
    TechLevel: {
      note: 'Offered at outfitters whose stellar\'s TechLevel is at least this or with this among the stellar\'s SpecialTech. With a value below 0 or 32767 no outfitter offers it by its TechLevel.',
      code: [['SetupPortAvailableItems', 0xbedb]],
    },
    BuyRandom: {
      note: 'The chance in 100 that it is for sale on a given day. It is for sale while BuyRandom is at least a number from 1 to 100 drawn for it each day. Above 100: 100. 0 or less: never unless the player already has one.',
      bible: 'the game reads values below 1 or above 100 as 100.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableItems', 0xbedb], ['IncrementGameTime', 0xb516]],
    },
    Contributes: {
      note: 'Added to the player\'s bits while the player carries at least one. The player\'s bits come from the ship class, every outfit the player carries, every ränk the player has, and every crön event that is running. The Require of a shïp, mïsn, crön, or gövt passes when the bits include every bit it sets. So do an oütf\'s Requires.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f], ['SetupPortAvailableItems', 0xbedb], ['CanBuyOutfitItem', 0x4e7c4]],
    },
  },
  'wëap': {
    Sound: {
      note: 'The sound when it fires. 0 and up: snd 200 + Sound. With Flags 0x0010 the game does not start it again while it still plays so it loops. Below 0: silent.',
      code: [['LoadSounds', 0x1c036], ['FireAIShipWeapon', 0x8873d]],
    },
    SmokeSet: {
      note: 'Which set of smoke pictures its shots leave behind them (eight to a set). Flags 0x0200 gives small smoke, 0x0400 big smoke, and 0x0800 smoke lasting longer. Without those: no smoke.',
      code: [['HandleShot', 0x35586], ['SpawnSmoke', 0x3f927], ['HandleSmoke', 0x2e29f]],
    },
    BeamColor: {
      note: 'The color of a beam\'s core as drawn.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    CoronaColor: {
      note: 'The color of a beam\'s glow around its core as drawn. A lightning beam has none.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    LiDensity: {
      note: 'Above 0: the game draws the beam as lightning zig-zagging this often (1 counts as 2) with no glow (Falloff 0) and a BeamWidth of at least 1. It strikes as a straight beam would.',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    LiAmplitude: {
      note: 'How far a lightning beam\'s zig-zags swing as drawn (LiDensity).',
      code: [['LoadObjectData', 0x771b0], ['BeamDrawCallback', 0x37952]],
    },
    MaxAmmo: {
      note: 'Above 0: the most ammunition the player can carry for it is MaxAmmo × the launchers aboard whatever the ammunition outfit\'s Max. 0 or less: the outfit\'s Max.',
      code: [['HasMaxOfItem', 0x4512]],
    },
    MassDmg: {
      note: 'Damage to the armor of a ship hit once its shields are down (immediately with Flags 0x0020). One comes off for each Decay period passed. A beam removes it from an asteroid\'s strength too (× 10 with Flags2 0x8000). Against a shot point defense removes this plus half its EnergyDmg from the shot\'s Durability.',
      code: [['DamageShip', 0x3a807], ['HandleShipHit', 0x36a45], ['HandleBeams', 0x30295], ['PointDefenseCollisionHandler', 0x37776]],
    },
    EnergyDmg: {
      note: 'Damage to the shields of a ship hit. One comes off for each Decay period passed. The shields go no lower than a tenth of their capacity below 0. A shot (not a beam) removes it from an asteroid\'s strength (× 10 with Flags2 0x8000).',
      code: [['DamageShip', 0x3a807], ['HandleShipHit', 0x36a45], ['HandleAsteroidHit', 0x36637]],
      bible: 'Flags2 0x8000: weapon does x10 mass damage to asteroids.',
    },
    Guidance: {
      note: 'How it flies and fires. -1: a forward gun. 0: a beam. 1: homing (Seeker and GuidedTurn). 3: a turreted beam. 4: a turret. Both fire at the target in reach and out of the blind spots. 5: a bomb turning a degree a step to its course. 6: a rocket easing onto its heading. 7 and 8: front and rear quadrant turrets within 45° of the bow or stern. 9 and 10: point defense (shot and beam). They fire at homing shots coming at the ship or its lead and at ships of Flags2 0x0008 attacking them. 99: a fighter bay (AmmoType gives the ship class).',
      code: [['FireAIShipWeapon', 0x8873d], ['SpawnShot', 0x3e550], ['HandleShotGuidance', 0x320dc], ['HandleShipPointDefense', 0x392c4]],
    },
    AmmoType: {
      note: 'What a shot uses. -1: nothing. 0 to 255: the ammunition stored for weapon 128 + n. -999: firing wrecks the firing ship and sets its shields and armor to 0. -1000 and below: (|AmmoType| - 1000) ÷ 10 fuel a shot. The weapon fires only with that much aboard. A fighter bay gives the ship class.',
      code: [['WeaponHasAmmo', 0xb95a], ['FireAIShipWeapon', 0x8873d], ['SpawnShot', 0x3e550]],
    },
    Graphic: {
      note: 'Its shots\' sprite (spïn 3000 + Graphic). Above 255: the weapon makes no shot.',
      code: [['SpawnShot', 0x3e550], ['HandleShot', 0x35586]],
    },
    Inaccuracy: {
      note: 'Above 0: each shot leaves within that many degrees either side of its aim (only a bomb\'s picture). Below 0: it leaves that many degrees off the bow toward the side of its exit point. 0: straight.',
      code: [['SpawnShot', 0x3e550], ['HandleShipPointDefense', 0x392c4]],
    },
    ExplodType: {
      note: 'The explosion where it hits or where it ends with Flags 0x8000. 0 to 63: bööm 128 + n. 1000 to 1063: the big kind spread over BlastRadius. Anything else: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleShot', 0x35586], ['CreateExplosion', 0x3f698]],
    },
    ProxRadius: {
      note: 'The reach of its proximity fuse plus a third of the target\'s sprite. An armed shot (ProxSafety) goes off when it comes that near. 0: only a hit.',
      code: [['CheckShotProximities', 0x371bc]],
    },
    BlastRadius: {
      note: 'Every other ship within this distance on each axis of where it goes off receives its full damage with Impact and Ionization. The blast spares the firer. The player\'s blast hurts the player unless Flags 0x0100. 0: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleShot', 0x35586], ['IonizeShip', 0x8409]],
    },
    Flags: {
      note: '0x0001: its shots\' frames advance in turn (one every BeamWidth steps) instead of following their heading. 0x0004: they start from the first frame. 0x0008: the game picks a homing one only against a target turning 3 or less. 0x0020: it goes through shields to the armor. 0x0040: all of them fire together and reload together. 0x0080: point defense ignores its shots. 0x0100: its blast does not hurt the player. 0x1000 to 0x4000: a turret blind ahead (0x1000), abeam (0x2000), or astern (0x4000). 0x8000: a shot goes off with its blast when its life ends. 0x0010: its Sound loops. 0x0200 and 0x0400: small or big smoke (SmokeSet). 0x0800: the smoke lasts longer. 0x0002: the player fires it with the second trigger. Another ship that picks one continues firing it step after step. For primary weapons that ship picks again each time.',
      code: [['SpawnShot', 0x3e550], ['HandleShot', 0x35586], ['HandleShip', 0x33581], ['SuitableMissileType', 0x34e1], ['DamageShip', 0x3a807], ['WeaponMaxSimultShots', 0x8350], ['HandleShipPointDefense', 0x392c4], ['HandleShipHit', 0x36a45], ['TurretBlindSpot', 0xb325]],
    },
    Seeker: {
      note: '0x0001: its shots and beams pass over asteroids. 0x0020: not fired while its ship is fully ionized. The rest apply to a homing shot. 0x0002: an asteroid ahead decoys it. 0x0008: the system\'s interference can make it lose its target when fired and spiral. 0x0010: jamming turns it away. 0x4000: it loses its target once that is more than 45° off its nose within 250. 0x8000: when jammed or lost it now and then turns on its firing ship.',
      code: [['HandleShotGuidance', 0x320dc], ['SpawnShot', 0x3e550], ['HandleBeams', 0x30295], ['HandleShip', 0x33581]],
    },
    Decay: {
      note: 'Every Decay steps that a shot flies remove one from its MassDmg and EnergyDmg. A beam fades over its Falloff. 0 or less: none.',
      code: [['HandleShot', 0x35586], ['HandleShipHit', 0x36a45], ['HandleBeams', 0x30295]],
    },
    Particles: {
      note: 'Trail particles given off each step from the shot\'s tail with PartVel, PartLifeMin to PartLifeMax, and PartColor. 0: none.',
      code: [['HandleShot', 0x35586], ['SpawnParticles', 0x44b70]],
    },
    PartVel: {
      note: 'The trail particles\' speed × 0.6 to 1.4 (one of eight drawn at loading).',
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
      note: 'The trail particles\' color scaled 0.6 to 1.4 with their speed.',
      code: [['LoadObjectData', 0x771b0], ['SpawnParticles', 0x44b70]],
    },
    BeamLength: {
      note: 'A beam\'s reach. Every step it lasts it strikes the nearest ship whose middle is within this plus a third of its sprite and within a few degrees of the line. A turreted beam fires at a ship within this plus 32.',
      code: [['HandleBeams', 0x30295], ['FireAIShipWeapon', 0x8873d]],
    },
    BeamWidth: {
      note: 'A beam\'s width as drawn. For shots whose frames advance in turn (Flags 0x0001) it gives the steps per frame.',
      code: [['HandleShot', 0x35586], ['HandleBeams', 0x30295]],
    },
    Falloff: {
      note: 'How fast a decaying beam fades (Decay). A beam with a BeamLength and 0 or less here fades over 16.',
      code: [['LoadObjectData', 0x771b0], ['HandleBeams', 0x30295]],
    },
    SubType: {
      note: 'The weapon of its submunitions (SubCount). 128 to 383: that wëap. Anything else: none. Its reach adds to this one\'s.',
      code: [['SpawnShotSubmunitions', 0x3f1d5], ['LoadObjectData', 0x771b0]],
    },
    ProxSafety: {
      note: 'Steps from firing before a shot arms. Before then it hits nothing and its fuse is off.',
      code: [['CheckShotProximities', 0x371bc], ['HandleShot', 0x35586]],
    },
    Flags2: {
      note: '0x0001: the first frame while not yet armed. 0x0002: the last frame held. 0x0008: a homing shot hits ships besides its target. 0x0010: submunitions aim at the nearest ship they can hit. 0x0020: no submunitions when a shot\'s life ends. 0x0080: fired only with a ship of the class\'s KeyCarried aboard. 0x0100: only the player\'s ship fires it. 0x0200: the ship\'s weapon sprite shows as it fires. 0x0400: planet-type. It hits only planet-type ships (shïp Flags 0x0400) and nothing else hits them. 0x1000: it disables but never destroys. 0x4000: fired while cloaked (as point defense reads it). 0x8000: × 10 damage to asteroids. 0x0040: the status display does not show its ammunition. 0x0800: not offered as the player\'s secondary weapon while out of ammunition. 0x2000: a beam drawn beneath the ships. Nothing reads 0x0004. An asteroid sets off its proximity fuse all the same.',
      code: [['HandleShot', 0x35586], ['ShotCanHitShip', 0x4477e], ['SpawnShotSubmunitions', 0x3f1d5], ['WeaponHasAmmo', 0xb95a], ['FireAIShipWeapon', 0x8873d], ['DamageShip', 0x3a807], ['HandleShipPointDefense', 0x392c4], ['HandleAsteroidHit', 0x36637], ['DrawStatusWeap', 0x4c00a], ['BeamDrawCallback', 0x37952], ['CheckShotProximities', 0x371bc], ['HandlePlayer', 0x68390]],
      bible: '0x0004: proximity detonator ignores asteroids.',
    },
    HitParticles: {
      note: 'Particles where a shot or beam hits a ship or asteroid. They last HitPartLife to 1.25 × that at HitPartVel in HitPartColor. 0: none.',
      code: [['HandleShipHit', 0x36a45], ['HandleAsteroidHit', 0x36637], ['SpawnParticles', 0x44b70]],
    },
    HitPartLife: {
      note: 'The fewest steps a hit particle lasts. The most is a quarter more.',
      code: [['HandleShipHit', 0x36a45]],
    },
    HitPartVel: {
      note: 'The hit particles\' speed.',
      code: [['HandleShipHit', 0x36a45]],
    },
    HitPartColor: {
      note: 'The hit particles\' color.',
      code: [['HandleShipHit', 0x36a45]],
    },
    Recoil: {
      note: 'Pushes the firing ship back by Recoil ÷ its Mass each time it fires. Below 0: forward. 0 or -1: none.',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    ExitType: {
      note: 'Which of the shän\'s four sets of exit points its shots use. They use the points in turn (or the one nearest the target with Flags3 0x0010). 0: guns. 1: turrets. 2: guided. 3: beams. Anything else: the middle of the ship.',
      code: [['ModifyShotStartPosition', 0x7348], ['SelectClosestShotStartPosition', 0x7254], ['SpawnBeam', 0x44ff3]],
    },
    BurstCount: {
      note: 'Shots before a burst reload. It is this × the weapons carried or this alone with Flags 0x0040. 0 or less: no bursts.',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    BurstReload: {
      note: 'The reload in steps after a burst (BurstCount).',
      code: [['FireAIShipWeapon', 0x8873d]],
    },
    JamVuln: {
      note: 'For a homing shot each of the four jamming types. The game draws a number from 0 to this for the shot as it fires. From 16 steps old jamming confuses the shot while its target\'s jamming of that type is more than 100 minus that number. The value stays between 0 and 100.',
      code: [['SpawnShot', 0x3e550], ['HandleShotGuidance', 0x320dc], ['ShipECM', 0x3aff]],
    },
    Flags3: {
      note: '0x0001: a burst uses ammunition once instead of for each shot. 0x0004: no second shot until the first is gone. 0x0010: from the exit point nearest the target. 0x0020: while it reloads no other weapon of the ship fires. 0x0002: the game draws its shots translucent in thousands of colors or more. The program reads no other bit.',
      code: [['FireAIShipWeapon', 0x8873d], ['HandleShot', 0x35586], ['ModifyShotStartPosition', 0x7348]],
    },
    Durability: {
      note: 'For a homing shot what point defense must wear down. Each hit removes its MassDmg and half its EnergyDmg. A hit when nothing remains destroys the shot. 0 or less: the first hit does.',
      code: [['SpawnShot', 0x3e550], ['PointDefenseCollisionHandler', 0x37776]],
    },
    IonizeColor: {
      note: 'The color added to a ship it ionizes.',
      code: [['IonizeShip', 0x8409]],
    },
    Reload: {
      note: 'Steps before it fires again shared among however many of it are aboard. Each shot fired waits Reload ÷ that many or the whole Reload with Flags 0x0040. At the end of a burst it waits BurstReload instead.',
      code: [['FireAIShipWeapon', 0x8873d], ['FirePlayerWeapon', 0x62702]],
    },
    Count: {
      note: 'Steps a shot lasts. A shot\'s reach is Count × Speed ÷ 100. Its submunitions extend that reach.',
      code: [['LoadObjectData', 0x771b0], ['HandleShot', 0x35586]],
    },
    Speed: {
      note: 'A shot moves Speed ÷ 100 units a step along its heading. With Count this sets its reach.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    GuidedTurn: {
      note: 'A homing shot turns a tenth of this in degrees each step from 15 steps old.',
      code: [['LoadObjectData', 0x771b0], ['HandleShotGuidance', 0x320dc]],
    },
    Impact: {
      note: 'Pushes the ship it hits unless that ship is jumping.',
      code: [['DamageShip', 0x3a807]],
    },
    Ionization: {
      note: 'Added to the ship it hits. For a blast the game reduces it by the square of the distance over the square of BlastRadius. Beyond BlastRadius it adds none.',
      code: [['IonizeShip', 0x8409]],
    },
    SubCount: {
      note: 'How many shots of SubType come from a shot as it breaks up.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubTheta: {
      note: 'Above 0: each submunition leaves at random within this many degrees of the shot\'s heading. Below 0: the submunitions fan out this far apart.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
    SubLimit: {
      note: 'How many generations of submunitions there can be. Below 1: no limit.',
      code: [['SpawnShotSubmunitions', 0x3f1d5]],
    },
  },
  'përs': {
    Color: {
      note: 'The color the game paints its ship in place of its government\'s ShipColor. Black: unpainted.',
      code: [['LoadObjectData', 0x771b0], ['GetShipPaintColor', 0x7d0c]],
    },
    Coward: {
      note: 'As a warship of a government with Flags 0x0010 and with no leader it turns tail once its shields fall below Coward percent of full. Ships that are not persons go by their aggression instead.',
      code: [['WarshipAI', 0x8b729], ['ShipShieldCapacity', 0x2995]],
    },
    HailPict: {
      note: 'The picture shown when the player hails its ship. 128 and up: that PICT. Anything else: the picture of its ship class.',
      code: [['LoadObjectData', 0x771b0], ['DoCommDialog', 0x956d5]],
    },
    CommQuote: {
      note: 'What its ship answers when the player hails it. Above 0: the STR resource numbered CommQuote + 15000 where there is one and otherwise entry CommQuote of STR# 7100. With -1 and Flags 0x8000 it gives news of a disaster now under way. Otherwise the usual answer.',
      code: [['LoadAdvice', 0x9133c], ['LoadPluginString', 0x71a8e]],
    },
    Subtitle: {
      note: 'Shown for its ship in the player\'s target display.',
      code: [['LoadObjectData', 0x771b0], ['DrawStatusTarg', 0x4ace1]],
    },
    Credits: {
      note: 'The credits the player can take when plundering this person\'s ship. The game rounds Credits ÷ 1,000 down and halves it. When that is above 2 the game adds a number from 0 to one less than it drawn at random. The result is in thousands. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['SetPlunderValues', 0x92219], ['Rand', 0xa4c76]],
    },
    GrantClass: {
      note: 'When the player plunders this person\'s ship there is a chance of GrantProb in 100 of a gift. The player receives outfits of one oütf picked at random among those whose ItemClass is this and of which the player does not already have the maximum. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['HasMaxOfItem', 0x4512], ['GrantOutfitItem', 0x44d4f]],
    },
    GrantProb: {
      note: 'The chance in 100 of the GrantClass gift. The value stays between 0 and 100.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b]],
    },
    GrantCount: {
      note: 'How many of the GrantClass outfit it grants. That is GrantCount × a number from 50 to 100 drawn at random ÷ 100 and at least 1. The number drops while they would not fit the free mass of the player\'s ship. 0 or less: none.',
      code: [['LoadObjectData', 0x771b0], ['DoPlunderDialog', 0x9302b], ['ShipFreeMass', 0xb462], ['GrantOutfitItem', 0x44d4f]],
    },
    ShipType: {
      note: 'The class of this person\'s ship (128 to 895). Anything else: shïp 128.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    Govt: {
      note: 'The government of this person\'s ship. If that gövt has Flags 0x0800 the ship starts disabled and never jumps in.',
      code: [['SpawnPerson', 0x408d5]],
    },
    AIType: {
      note: 'How this person\'s ship flies by the program\'s routines. 1: WimpyTraderAI. 2: BraveTraderAI. 3: WarshipAI (PirateWarshipAI if its government has Flags 0x1000). 4: InterceptorAI. Above 4: EscortAI. 0 or less: LinkSyst never picks the person.',
      code: [['SpawnPerson', 0x408d5], ['AIDispatch', 0x8fb52], ['WimpyTraderAI', 0x8b029], ['BraveTraderAI', 0x8b493], ['WarshipAI', 0x8b729], ['PirateWarshipAI', 0x8c2d2], ['InterceptorAI', 0x8c895], ['EscortAI', 0x838d2]],
    },
    Aggress: {
      note: 'Kept for the ship as 1 when below 1, as given when 1 or 2, and as 4 when above 2.',
      code: [['SpawnPerson', 0x408d5]],
    },
    WeapType: {
      note: 'Weapons added to those of the ship\'s class. Each value of 128 and up is a wëap with WeapCount of it and AmmoLoad of its ammunition. If one appears twice the later one counts. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['SpawnPerson', 0x408d5]],
    },
    WeapCount: {
      note: 'How many of the WeapType beside it the ship receives.',
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
      note: 'The message this person\'s ship sends when it hails the player. It is the STR resource numbered HailQuote + 4999 where there is one and otherwise entry HailQuote of STR# 7101. -1: it does not hail. It hails 1 time in 140 each step as Flags allows. It must be in sight and not dying, jumping, or leaving, and 2,700 ticks must have passed since its last hail.',
      code: [['HandleShip', 0x33581], ['ShowPersonHailQuote', 0x4457e], ['LoadPluginString', 0x71a8e]],
    },
    LinkMission: {
      note: 'The mïsn this person offers when the player hails its ship (or boards it with Flags 0x0200) if the mission is available then (AvailLoc 2). -1: none.',
      code: [['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['IsMissionAvailable', 0x9b152], ['OfferOneMission', 0xa21ac]],
    },
    Flags: {
      note: '0x0001: damaging its ship gives it a grudge and as a warship it then attacks the player. 0x0002: its ship always has an afterburner. Losing its ship does not remove it for good. As its ship\'s death throes reach half their length it launches an escape pod unless its government has Flags 0x0100. The pod is only for show and nothing hits it. The next flags apply to HailQuote only. 0x0004: while it has a grudge. 0x0008: while it likes the player. 0x0010: as it turns on the player (then immediately). 0x0020: while its ship lies disabled. 0x0080: only the first time. 0x0400: while its LinkMission is available. 0x1000 to 0x4000: not if the InherentAI of the player\'s ship class is 1 (0x1000), 2 (0x2000), or 3 or more (0x4000). 0x0040: once the player accepts its LinkMission and that mission has one ship this ship becomes the mission\'s ship. 0x0100: once the player accepts its LinkMission the player does not meet it again. 0x0200: it offers its LinkMission on boarding instead of hailing. 0x0800: once the player accepts its LinkMission its ship leaves. 0x8000: with CommQuote -1 hailing it gives news of a disaster.',
      bible: '0x1000, 0x2000 and 0x4000 keep the person from offering its mission to a player flying a wimpy freighter, beefy freighter or warship, not from hailing; 0x8000 shows disaster info when hailing, with no word of CommQuote.',
      code: [['DamageShip', 0x3a807], ['SelectWarshipTarget', 0x89d5e], ['SpawnPerson', 0x408d5], ['HandleShipDisplay', 0x2b514], ['HandleShip', 0x33581], ['HandlePlayerCommunication', 0x61f48], ['HandlePlayerBoardAttempt', 0x65000], ['LoadAdvice', 0x9133c], ['AIDoesShipLikePlayer', 0x82177], ['IsThreatToPlayer', 0x7f501], ['AIMakeShipLeave', 0x7e2b0], ['SpawnEscapePod', 0x45547]],
    },
    Flags2: {
      note: '0x0001: its ship starts with no fuel and cannot jump out while it has less than 100 units.',
      code: [['SpawnPerson', 0x408d5], ['AIShipHasFuelForJump', 0x7f48f], ['WarshipAI', 0x8b729]],
    },
    LinkSyst: {
      note: 'Where the player may meet this person among the ships a system\'s AvgShips brings or among those jumping in later (1 time in 7 each). -1: anywhere. 128 to 9998: that sÿst (0 to 127 count as 128 to 255). 9999: systems of no government. 10000 + n: systems of gövt 128 + n. 15000 + n: systems of its allies. 20000 + n: systems of another government. 25000 + n: systems of its enemies. It is never among those jumping in if its government has Flags 0x0800. The game never picks it while its AIType is 0 or less or its ActivateOn fails, after its destruction or capture, or while it is already there.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['HyperShipSpawn', 0x4291a], ['GovtAllies', 0x4e3d], ['GovtEnemies', 0x4f22]],
    },
    ActivateOn: {
      note: 'A test of control bits. While it fails the player does not meet this person by LinkSyst or as a system\'s Person. Empty: no test.',
      code: [['SpawnPerson', 0x408d5], ['SetupShipsInSystem', 0x42b61], ['PropagateMissionBitEffects', 0x99676], ['EvalMissionBitTestString', 0x9959e]],
    },
  },
  'ränk': {
    Weight: {
      note: 'Of the ranks the player holds that have a ConvName the heaviest gives <PRK> in the game\'s texts. Of those with a ShortName the heaviest gives <SRK>. Flags 0x0010 sets it against the other ranks of the same government.',
      code: [['MungeBriefing', 0x9c11d], ['ActivateRank', 0x452f0], ['LoadObjectData', 0x771b0, ['DeactivateRank', 0x4541e], ['DoCommDialog', 0x956d5]]],
    },
    Govt: {
      note: 'Its government. 128 and up: that gövt. Below 128: none. Its PriceMod and Flags 0x0004, 0x0040, 0x0100, and 0x0200 apply at the stellars and ships of every government allied with it (GovtAllies and this one too). Flags 0x0001 and 0x0010 set it against the other ranks of this government.',
      code: [['LoadObjectData', 0x771b0], ['DoPortDialog', 0x5f911], ['SlapWithPenalty', 0x9bbc], ['ResetPlayerPrecalcedValues', 0xc357], ['GovtAllies', 0x4e3d]],
    },
    PriceMod: {
      note: 'A percentage. At a stellar whose government is an ally of this rank\'s it multiplies prices while the player holds it. With several such ranks each one\'s applies in turn. 0 or less: 100.',
      code: [['LoadObjectData', 0x771b0], ['DoPortDialog', 0x5f911], ['ApplyPriceAndTechnologyFlux', 0x4e6cd]],
    },
    Salary: {
      note: 'Credits added each day while the player holds it and the player\'s credits are below SalaryCap or SalaryCap is 0 or less. Below 0: the player loses that much but never drops below 0 credits.',
      code: [['IncrementGameTime', 0xb516]],
    },
    SalaryCap: {
      note: 'The player receives Salary only while the player\'s credits are below this. 0 or less: always.',
      code: [['IncrementGameTime', 0xb516]],
    },
    Contrib: {
      note: 'Contribute bits added for any Require while the player holds it. They join those of the player\'s ship, outfits, and running events.',
      code: [['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
    Flags: {
      note: '0x0001: gaining it removes every other rank the player holds of its government except those with 0x0008. 0x0010: gaining it removes those of its government with a lower Weight except those with 0x0008. 0x0008: never lost that way or for crimes. 0x0040: lost on any crime against a government allied with the rank\'s government. 0x0004: lost only on disabling or destroying one of their ships. 0x0100: while the player holds it the ships of a government allied with the rank\'s government do not count the player a threat (IsThreatToShip). They check whether the player is one when they choose targets and come to help. 0x0200: while the player holds it the stellars of a government allied with the rank\'s government check the player the same way when the player hails and lands and for their colors on the map. 0x0002: losing it removes every other rank the player holds of its government except those with 0x0008. 0x0020: losing it removes those of its government with a lower Weight except those with 0x0008. 0x0400: while the player holds it a ship of a government allied with the rank\'s government always answers a request for help against its enemies. It fights them and sends for reinforcements. 0x0800: such a ship repairs or refuels the player free of charge (DoCommDialog). The program reads no other bit.',
      code: [['ActivateRank', 0x452f0], ['SlapWithPenalty', 0x9bbc], ['ResetPlayerPrecalcedValues', 0xc357], ['PlayerBlessedByGovt', 0x2732], ['IsThreatToShip', 0x81faf], ['SelectWarshipTarget', 0x89d5e], ['HandlePlayerDockRequest', 0x66691], ['DoPlanetCommDialog', 0x96949], ['ColorCodeStellar', 0xaa26], ['DoCommDialog', 0x956d5]],
    },
    ConvName: {
      note: 'What replaces <PRK> in the game\'s texts while this is the heaviest rank the player holds with one (Weight). With none: STR# 2002\'s 341st string.',
      code: [['MungeBriefing', 0x9c11d], ['LoadObjectData', 0x771b0]],
    },
    ShortName: {
      note: 'What replaces <SRK> in the game\'s texts while this is the heaviest rank the player holds with one (Weight).',
      code: [['MungeBriefing', 0x9c11d], ['LoadObjectData', 0x771b0]],
    },
  },
  'crön': {
    FirstDay: {
      note: 'The day of the month from which it may start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    FirstMonth: {
      note: 'The month from which it may start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    FirstYear: {
      note: 'The year from which it may start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastDay: {
      note: 'The day of the month after which it may not start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastMonth: {
      note: 'The month after which it may not start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    LastYear: {
      note: 'The year after which it may not start. The program does not compare the dates as whole dates. The year must be from FirstYear to LastYear. The day of the year must be from FirstMonth and FirstDay to LastMonth and LastDay in every year. A span across the new year therefore never opens. 0 or less leaves that part open.',
      code: [['CronDateInRange', 0x74d3], ['CronEventHandler', 0x3874f]],
      bible: 'The first or last date on which the event can occur.',
    },
    Random: {
      note: 'Each day it is not running it starts if a number from 0 to 100 drawn for it is at most this. It must also be within its dates (FirstYear) and its Require and EnableOn test must pass. 100 or more: always. Below 0: never.',
      code: [['CronEventHandler', 0x3874f], ['Rand', 0xa4c76]],
    },
    Duration: {
      note: 'Days it runs once started (after PreHoldoff). It sets OnStart as it starts and OnEnd as it ends. 0: both on the same day. Below 0: it never starts.',
      code: [['CronEventHandler', 0x3874f], ['ActivateCron', 0x385db], ['TerminateCron', 0x38467]],
    },
    PreHoldoff: {
      note: 'Days between the draw that picks it and its start. It sets OnStart only then. 0 or less: immediately.',
      code: [['CronEventHandler', 0x3874f]],
    },
    PostHoldoff: {
      note: 'Days after it ends before the game may draw it again. 0 or less: from the next day.',
      code: [['CronEventHandler', 0x3874f]],
    },
    IndNewsStr: {
      note: 'While it runs an STR# of news shown at any stellar where none of its NewsGovt applies. The game picks one of its strings at random and picks the event itself at random among those with news there. Government news (GovtNewsStr) from any running event comes first. 0 or less: none.',
      code: [['RandomizeNewsDialog', 0x48238], ['GetRandomIndString', 0x72ef7]],
    },
    Flags: {
      note: '0x0001: as it starts it sets OnStart over and over while its Require and EnableOn still pass. 0x0002: as it ends it sets OnEnd the same way. The program reads no other bit.',
      code: [['ActivateCron', 0x385db], ['TerminateCron', 0x38467]],
    },
    EnableOn: {
      note: 'A test of control bits. It starts only while this passes. Empty: no test.',
      code: [['CronEventHandler', 0x3874f], ['EvalMissionBitTestString', 0x9959e]],
    },
    OnStart: {
      note: 'Control bits set when it starts (after PreHoldoff). See Flags 0x0001. Empty: none.',
      code: [['ActivateCron', 0x385db], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnEnd: {
      note: 'Control bits set when it ends. See Flags 0x0002. Empty: none.',
      code: [['TerminateCron', 0x38467], ['EvalMissionBitSetString', 0x99dc5]],
    },
    Require: {
      note: 'It starts only when the Contributes bits of the player\'s ship and outfits include every bit set here.',
      code: [['CronEventHandler', 0x3874f], ['PlayerMeetsRequirements', 0x776f]],
    },
    NewsGovt: {
      note: 'Up to four governments. While it runs the GovtNewsStr beside one becomes the event\'s news at a stellar of a government allied with it (or of that government). The last one that applies counts. Below 128: none.',
      code: [['LoadObjectData', 0x771b0], ['RandomizeNewsDialog', 0x48238], ['GovtAllies', 0x4e3d]],
    },
    GovtNewsStr: {
      note: 'The STR# of news for the NewsGovt beside it. The game picks one of its strings at random. Below 1: none.',
      code: [['RandomizeNewsDialog', 0x48238], ['GetRandomIndString', 0x72ef7]],
    },
    Contrib: {
      note: 'Added to the player\'s bits while the event is running. That is from the end of its PreHoldoff until it ends and not in its PostHoldoff. The player\'s bits come from the ship class, every outfit the player carries, every ränk the player holds, and every crön event that is running. The Require of a shïp, mïsn, crön, or gövt passes when the bits include every bit it sets. So do an oütf\'s Requires.',
      code: [['CronEventHandler', 0x3874f], ['GetPlayerContributeBits', 0x76b2], ['PlayerMeetsRequirements', 0x776f]],
    },
  },
  'spöb': {
    xPos: {
      note: 'With yPos it gives where it is in its system measured from the middle. Ships head for and land on that point and the radar shows it there.',
      code: [['LoadObjectData', 0x771b0], ['FindNearestStellar', 0x276c], ['DrawStatusRadar', 0x496e0]],
    },
    yPos: {
      note: 'With xPos it gives where it is in its system.',
      code: [['LoadObjectData', 0x771b0], ['FindNearestStellar', 0x276c]],
    },
    Type: {
      note: 'Its picture. Its sprite is spïn 1000 + Type and its landing picture is PICT 10000 + Type unless CustPicID is 128 or more.',
      code: [['LoadObjectData', 0x771b0], ['HandleStellarSprites', 0x2e6f1], ['PreloadPortDialog', 0x4e5c7]],
    },
    Flags: {
      note: '0x01: the player can land or dock. 0x80: only while destroyed. 0x02: a commodity exchange. 0x04: an outfitter. 0x08: a shipyard. 0x40: a bar. 0x10: a station. Being a station changes the words of hails, landing, and advice. 0x20: uninhabited. The player cannot hail it and it gives no missions and no services. The next 24 bits are the six commodities\' prices with a nibble each from the top. 1: low. 2: medium. 4: high. Only the first bit set counts. 0: not traded.',
      code: [['StellarIsLandable', 0xa989], ['SystemHasService', 0xd373], ['CalcPortDemand', 0x56b1], ['DoPlanetCommDialog', 0x96949], ['HandlePlayerDockApproach', 0x647a6], ['SystemIsInhabited', 0x4c4a]],
    },
    TechLevel: {
      note: 'Its shipyard offers the ship classes and its outfitter the outfits whose TechLevel is 0 or more and at most this or equal to one of its SpecialTech.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['SetupPortAvailableItems', 0xbedb]],
    },
    SpecialTech: {
      note: 'Three of its eight special tech levels (SpecialTech4to8 has the other five). It also offers ship classes and outfits of exactly one of these TechLevels.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableShipTypes', 0xbbe3], ['SetupPortAvailableItems', 0xbedb]],
    },
    SpecialTech4to8: {
      note: 'The other five of its eight special tech levels. See SpecialTech.',
      code: [['LoadObjectData', 0x771b0], ['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    MinStatus: {
      note: 'In its hail dialog it treats the player as hated while the player\'s record in its system is below this. At 32767 it always does and at -32767 it never does. Releasing it once dominated puts the player\'s record there just below this.',
      code: [['DoPlanetCommDialog', 0x96949], ['PlanetCommFilter', 0x911a9]],
    },
    CustPicID: {
      note: 'The picture when the player lands. 128 and up: that PICT. Below 128: PICT 10000 + Type. For a hypergate it is where the frames split when it is from 1 to the frame count minus 2. The frames below this number are the opening frames.',
      code: [['PreloadPortDialog', 0x4e5c7], ['HandleStellarSprites', 0x2e6f1]],
    },
    CustSndID: {
      note: 'While the player is landed a snd of 128 and up plays if ambient sounds are on. For a hypergate or wormhole it is the heading of a ship leaving it. 0 to 359: that heading. Anything else: a random one.',
      code: [['DoPortDialog', 0x5f911], ['PlayerEnterHypergate', 0x637bf], ['PlayerEnterWormhole', 0x64005], ['AIMakeShipEmergeFromHyperGate', 0x89518]],
    },
    DefenseDude: {
      note: 'The düde for its defense ships. They are of the stellar\'s government and fly as warships tied to it. Below 128: none.',
      code: [['SpawnStellarDefenseShip', 0x3d2c9], ['SpecificDudeSpawn', 0x3d0eb]],
    },
    DefCount: {
      note: 'How many defense ships it has. Up to 1000: that many launched together. Above 1000 the last digit is how many are out together and the total is DefCount ÷ 10 - 100 (÷ 10 - 1000 above 10,000). It launches more as it loses those out.',
      code: [['LoadObjectData', 0x771b0], ['EnterMoreShips', 0x43459], ['SpawnStellarDefenseShip', 0x3d2c9], ['DoPlanetCommDialog', 0x96949]],
    },
    Flags2: {
      note: '0x0001: the game shows frame 0 between each of the others. 0x0002: the game picks frames at random. 0x0080: it animates only while destroyed. 0x0020: always dominated. 0x0040: it starts destroyed. 0x0100: it destroys a ship that touches it. 0x0400: its outfitter shows every outfit the player carries that the player can sell so the player can buy it back. 0x1000: a hypergate. 0x2000: a wormhole (HyperLink). 0x0010: its sound loops while the player is landed. 0x0200: it fires only once provoked and then only at the player and ships flying with the player.',
      code: [['HandleStellarSprites', 0x2e6f1], ['DoStellarTimePassage', 0x40867], ['DoNewPilot', 0x18b0a], ['HandleDeadlyStellars', 0x39ccd], ['SetupPortAvailableItems', 0xbedb], ['HandlePlayerDockRequest', 0x66691], ['PlayerEnterWormhole', 0x64005], ['PlanetSoundCallback', 0x55f5d], ['IsThreatToStellar', 0x9ef7]],
    },
    AnimDelay: {
      note: 'How many 30ths of a second each frame of its sprite shows.',
      code: [['HandleStellarSprites', 0x2e6f1]],
    },
    Frame0Bias: {
      note: 'Above 1: the first frame lasts this multiple of the other frames\' length.',
      code: [['HandleStellarSprites', 0x2e6f1]],
    },
    HyperLink: {
      note: 'For a hypergate the stellars the player can go to by picking their systems on the map. For a wormhole one of them at random or another such wormhole at random when it has none. Below 128: none.',
      code: [['PlayerEnterHypergate', 0x637bf], ['PlayerEnterWormhole', 0x64005], ['DoSystemMap', 0x121a3]],
    },
    OnDominate: {
      note: 'Control bits set when the player dominates it. Empty: none.',
      code: [['DoPlanetCommDialog', 0x96949], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRelease: {
      note: 'Control bits set when the player releases it from domination. Empty: none.',
      code: [['DoPlanetCommDialog', 0x96949], ['EvalMissionBitSetString', 0x99dc5]],
    },
    DeadTime: {
      note: 'Days it stays destroyed. One comes off each day. At 0 it regenerates with its strength restored and sets OnRegen. Below 0: it never regenerates.',
      code: [['IncrementGameTime', 0xb516], ['StellarIsDestroyed', 0x4e14]],
    },
    OnDestroy: {
      note: 'Control bits set on its destruction. Empty: none.',
      code: [['CheckShotProximities', 0x371bc], ['EvalMissionBitSetString', 0x99dc5]],
    },
    OnRegen: {
      note: 'Control bits set when it regenerates (DeadTime). Empty: none.',
      code: [['IncrementGameTime', 0xb516], ['EvalMissionBitSetString', 0x99dc5]],
    },
    Govt: {
      note: '128 and up: that gövt. Anything less: no government.',
      code: [['LoadObjectData', 0x771b0]],
    },
    Tribute: {
      note: 'Credits added to the player\'s credits each day once the player has dominated the stellar. The player-info screen adds them up. 0 or less: TechLevel × 1,000.',
      code: [['LoadObjectData', 0x771b0], ['DoStellarTimePassage', 0x40867], ['PlayerInfoDialogUpdate', 0x5244f]],
    },
    Fee: {
      note: 'Credits charged when the player lands. With fewer the player cannot land ("You don\'t have enough…"). The game does not charge it once the player has dominated it. Above 0 the landing clearance reads "[Landing fee is …]". It reads "[Docking fee is …]" with Flags 0x10 and "[Hypergate fee is …]" with Flags2 0x1000.',
      code: [['HandlePlayerDockRequest', 0x66691], ['HandlePlayerDockApproach', 0x647a6], ['DoPlanetCommDialog', 0x96949]],
    },
    Gravity: {
      note: 'While the player is in its system it pulls every ship in the system toward the stellar however far. Each step the pull is Gravity × the game speed ÷ the square of the distance in hundreds of units. The square counts as at least 30. Below 0: it pushes instead. 0: nothing. Inertialess ships do not feel it and neither do ship classes with Flags3 0x0020 or the player\'s ship if an outfit with ModType 41 is aboard.',
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
      note: 'With a value above 255 or below 0 it uses its Type.',
      code: [['LoadObjectData', 0x771b0]],
    },
    ExplodType: {
      note: 'Below 0: none.',
      code: [['LoadObjectData', 0x771b0]],
    },
  },
};

/* ---- what the value in a record means ---------------------------------------

   Beside each note, a reading of the value in the record at hand, by the same
   rules: (value, record, game) to words, the records it refers to named from the
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
  30: 'cloak scanner', 31: 'mining scoop', 32: 'extra jumps per jump', 33: 'jamming 1', 34: 'jamming 2', 35: 'jamming 3', 36: 'jamming 4', 37: 'jumps without slowing',
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
  if (t === 23) return `${v > 0 ? '+' : ''}${v} added to the 1,000 from the middle`;
  if (t === 39) return `${novaNum(v * 0.3)} a second`;
  if (t === 17) return novaBitsRead(v & 0x100e, { 2: 'on radar', 4: 'drops shields', 8: 'drops when hit', 0x1000: 'area' }) + ` · fuel ${(v >> 4) & 15} · shield ${(v >> 8) & 15}`;
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
// Up to eight ids with weights, each as its share of the total ("düde 130, Pirates 40%").
function novaWeightedRead(game, type, ids, weights, lo, hi, sharesOnly) {
  const ok = ids.map((id, i) => id >= lo && id <= hi ? i : -1).filter(i => i >= 0);
  const total = ok.reduce((t, i) => t + weights[i], 0);
  if (!(total > 0)) return 'none';
  return ok.map(i => (sharesOnly ? `${type} ${ids[i]}` : novaRefText(game, type, ids[i])) + ` ${Math.round(100 * weights[i] / total)}%`).join('; ');
}
// Outfits and counts ("oütf 130, Afterburner ×1"), as a ship comes with them.
const novaItemsRead = (game, ids, counts) => novaListRead(ids.map((id, i) => id >= 128 && id <= 639 && counts[i] > 0 ? `${novaRefText(game, 'oütf', id)} ×${counts[i]}` : null));

/* A few words for each note, shown while the notes are not shown in full. */
const NOVA_FIELD_SHORT = {
  'nëbu': { XPos: 'Map rectangle\'s left edge', YPos: 'Map rectangle\'s top edge', XSize: 'Map rectangle\'s width', YSize: 'Map rectangle\'s height', ActiveOn: 'Test: when it is there', OnExplore: 'Bits set on first arrival' },
  'spïn': { SpritesID: 'Its frames: rlë or PICT', MasksID: 'PICT mask for the frames', xSize: 'Frame width', ySize: 'Frame height', xTiles: 'Frames across', yTiles: 'Frames down' },
  'dësc': { Description: 'The text shown', Graphic: 'Picture shown with it', Movie: 'Movie played with it', Flags: 'How the movie plays' },
  'bööm': { FrameAdvance: 'How fast it plays', SoundIndex: 'Its sound (snd 300 + n)', GraphicIndex: 'Its picture (spïn 400 + n)' },
  'röid': { Strength: 'Damage before it breaks', SpinRate: 'How fast it turns', YieldType: 'What it leaves when broken', YieldQty: 'How many boxes it leaves', PartCount: 'Particles when it breaks', PartColor: 'Particle color', FragType1: 'One fragment kind', FragType2: 'Other fragment kind', FragCount: 'How many fragments', ExplodType: 'Explosion when it breaks', Mass: 'How hard it is to push' },
  'shän': {
    BaseTransp: 'Base picture transparency', WeapDecay: 'Weapon flash fade', BlinkMode: 'How its lights blink', BlinkA: 'Blink setting A', BlinkB: 'Blink setting B', BlinkC: 'Blink setting C', BlinkD: 'Blink setting D',
    BaseImageID: 'Base picture sprite', BaseMaskID: 'Base picture mask', BaseXSize: 'Base frame width', BaseYSize: 'Base frame height',
    AltImageID: 'Alternating picture sprite', AltMaskID: 'Alternating picture mask', AltXSize: 'Alternating frame width', AltYSize: 'Alternating frame height',
    GlowImageID: 'Engine glow sprite', GlowMaskID: 'Engine glow mask', GlowXSize: 'Glow frame width', GlowYSize: 'Glow frame height',
    LightImageID: 'Lights sprite', LightMaskID: 'Lights mask', LightXSize: 'Lights frame width', LightYSize: 'Lights frame height',
    WeapImageID: 'Weapon flash sprite', WeapMaskID: 'Weapon flash mask', WeapXSize: 'Weapon flash frame width', WeapYSize: 'Weapon flash frame height',
    ShieldImgID: 'Shield flash sprite', ShieldMaskID: 'Shield flash mask', ShieldXSize: 'Shield flash frame width', ShieldYSize: 'Shield flash frame height',
    BaseSetCount: 'Sets of base frames', AltSetCount: 'Sets of alternating frames', Flags: 'Banking, folding, key, and cycling', AnimDelay: 'Steps between sets', FramesPer: 'Frames to a full turn',
    GunPosX: 'Gun exit points across', GunPosY: 'Gun exit points along', GunPosZ: 'Gun exit heights',
    TurretPosX: 'Turret exit points across', TurretPosY: 'Turret exit points along', TurretPosZ: 'Turret exit heights',
    GuidedPosX: 'Guided exit points across', GuidedPosY: 'Guided exit points along', GuidedPosZ: 'Guided exit heights',
    BeamPosX: 'Beam exit points across', BeamPosY: 'Beam exit points along', BeamPosZ: 'Beam exit heights',
    UpCompressX: 'Exit point squash at the top across', UpCompressY: 'Exit point squash at the top up-down', DnCompressX: 'Exit point squash at the bottom across', DnCompressY: 'Exit point squash at the bottom up-down',
  },
  'chär': {
    startCash: 'Starting credits', startShipType: 'First ship', startSystem: 'Possible starting systems', startGovt: 'Governments with a starting record', startStatus: 'Starting record with each',
    startKills: 'Starting combat rating', introPictID: 'Opening pictures', introPictDelay: 'Seconds each picture shows', introTextID: 'Opening text', onStart: 'Bits set at the start',
    Flags: 'Offered first', startDay: 'Starting day', startMonth: 'Starting month', startYear: 'Starting year', DatePrefix: 'Words before the date', DateSuffix: 'Words after the date',
  },
  'jünk': {
    BoughtAt: 'Where it\'s expensive', SoldAt: 'Where it\'s cheap', BasePrice: 'Price before the stellar\'s factor', BuyOn: 'Test: traded where bought', SellOn: 'Test: traded where sold',
    Flags: 'Grows or shrinks in the hold', ScanMask: 'Who counts it as smuggling', LCName: 'Name in a sentence', Abbrev: 'Short name on the status bar',
  },
  'öops': { Commodity: 'Commodity it changes', PriceDelta: 'Added to the price', Freq: 'Daily chance it starts', ActivateOn: 'Test: when it can start', Stellar: 'Where it strikes', Duration: 'Days it lasts' },
  'düde': { AIType: 'How its ships fly', Govt: 'Its ships\' government', ShipTypes: 'Classes its ships come from', Probs: 'Weight of each class', Booty: 'What boarding finds', InfoTypes: 'What its ships say when hailed' },
  'flët': {
    LinkSyst: 'Where the player meets it', ActivateOn: 'Test: when the player meets it', LeadShipType: 'Lead ship class', EscortType: 'Escort classes', Min: 'Fewest of each escort', Max: 'Most of each escort',
    Govt: 'Government of its ships', Quote: 'Message when it jumps in', Flags: 'Traders start with cargo',
  },
  'sÿst': {
    xPos: 'Place on the map across', yPos: 'Place on the map down', Con: 'Linked systems', Nav: 'Its stellars', Govt: 'Its government', BkgndColor: 'Color of space',
    Visibility: 'Test: when it is there', Interference: 'Radar jamming chance', Murk: 'How murky', Asteroids: 'Asteroids kept around', AstTypes: 'Asteroid kinds', DudeTypes: 'Düdes its ships come from',
    Probs: 'Weight of each düde', AvgShips: 'Ships placed on arrival', Person: 'Persons who may be here', PersonProb: 'Chance each person comes', Message: 'Arrival message',
    ReinfFleet: 'Fleet called for help', ReinfTime: 'How long it takes to come', ReinfIntrval: 'Days before it can come again',
  },
  'shïp': {
    Holds: 'Tons of cargo', Shield: 'Shield points', Accel: 'Acceleration', Speed: 'Top speed', Maneuver: 'Turning', Fuel: 'Fuel (a jump uses 100)', FreeMass: 'Tons for outfits', Armor: 'Armor points',
    DispWeight: 'Order in the shipyard', DeathDelay: 'Steps to break up', Explode1: 'Small explosions as it breaks up', Explode2: 'Final explosion', Length: 'Shown in its description only',
    Flags: 'Jump pace, afterburner, planet-type, and more', Flags2: 'Swarming, targeting, cloaking, and more', PodCount: 'Escape pods launched', Mass: 'Jump days and tractor beams',
    InherentAI: 'Its ships\' AI', InherentGovt: 'Its ships\' governments', Crew: 'Capture odds', Strength: 'Weight in the fight-or-run odds',
    WeapType: 'Stock weapons', WeapCount: 'How many of each', AmmoLoad: 'Ammunition for each', WeapType2: 'Four more stock weapons', WeapCount2: 'How many of each', AmmoLoad2: 'Ammunition for each',
    MaxGun: 'Fixed guns allowed', MaxTur: 'Turrets allowed', ShieldRech: 'Shield recharge', ArmorRech: 'Armor recharge', SkillVar: 'Spread of pilot skill', Deionize: 'Ionization wearing off',
    IonizeMax: 'Ionization capacity', Availability: 'Test: when the player can buy it', OnPurchase: 'Bits set on buying', OnCapture: 'Bits set on capturing', OnRetire: 'Bits set on leaving it',
    ShortName: 'Name in the shipyard list', CommName: 'Name in hail and escort dialogs', LongName: 'Full name', MovieFile: 'Shipyard movie', Subtitle: 'Line under its name',
    KeyCarried: 'Fighter class it carries', EscortType: 'Group among your escorts', AppearOn: 'Test: when its ships appear', TechLevel: 'Tech level to sell it', Cost: 'Price',
    BuyRandom: 'Daily chance it is for sale', HireRandom: 'Daily chance it is for hire', Require: 'Bits needed to buy it', UpgradeTo: 'Class an escort upgrades to',
    EscUpgrdCost: 'Upgrade price', EscSellValue: 'What an escort sells for', DefaultItems: 'Outfits it comes with', ItemCount: 'How many of each', DefaultItms2: 'Four more outfits it comes with',
    ItemCount2: 'How many of each', Contributes: 'Bits it gives while flown', FuelRegen: 'Fuel regained over time', Flags3: 'Mining, gravity, and shipyard display',
  },
  'gövt': {
    VoiceType: 'Spoken messages', Flags: 'Who it fights, bribes, hailing, and more', Flags2: 'Help, map borders, gates, and wormholes', CrimeTol: 'Record before warships attack',
    SmugPenalty: 'Record lost for smuggling', DisabPenalty: 'Record lost for disabling', BoardPenalty: 'Record lost for boarding', KillPenalty: 'Record lost for destroying', ShootPenalty: 'Record lost for firing on',
    Classes: 'Class numbers others name it by', Allies: 'Its allied classes', Enemies: 'Classes it is at war with', SkillMult: 'Skill of its ships', ScanMask: 'What its scans find',
    CommName: 'Name in the hail dialog', TargetCode: 'Name in the target display', Require: 'Bits needed to land', InhJam: 'Jamming of its ships', MediumName: 'Name when reinforcements arrive',
    Color: 'Territory color on the map', ShipColor: 'Paint on its ships', Intf: 'Status display in its systems', NewsPic: 'News picture', InitialRec: 'The player\'s starting record',
    ScanFine: 'Fine after a scan', MaxOdds: 'Odds before its warships run',
  },
  'mïsn': {
    Require: 'Bits needed for the offer', AvailStel: 'Where the game offers it', AvailLoc: 'Where on the stellar', AvailRecord: 'Record needed', AvailRating: 'Combat rating needed', AvailRandom: 'Chance of the offer',
    AvailShipTyp: 'Ship class needed', TravelStel: 'Where the player must go', ReturnStel: 'Where it ends', PickupMode: 'When the cargo comes aboard', DropoffMode: 'Where the cargo comes off',
    PayVal: 'Pay or another reward', ShipSyst: 'Where its ships are', ShipGoal: 'What to do with its ships', ShipBehav: 'How its ships act', ShipCount: 'How many ships', ShipDude: 'Düde its ships come from',
    CompGovt: 'Government whose regard changes', CompReward: 'How far the regard changes', DatePostInc: 'Days passing when done', TimeLimit: 'Days the player has', CanAbort: 'Whether the player can abort it',
    BriefText: 'Text on accepting', QuickBrief: 'Text in the player\'s mission list', LoadCargText: 'Text when cargo comes aboard', DropCargText: 'Text when cargo comes off', CompText: 'Text when done',
    FailText: 'Text when it fails', RefuseText: 'Text when refused', ShipDoneText: 'Text when the ship goal is met', ShipNameID: 'Names of its ships', ShipSubtitle: 'Subtitle of its ships',
    ShipStart: 'Where its ships start', AuxShipCount: 'Ships sent after the player', AuxShipDude: 'Düde they come from', AuxShipSyst: 'Where they appear', ScanMask: 'Who counts its cargo as smuggling',
    Flags: 'Ending, map marks, refusing, and more', Flags2: 'Room for cargo, pay, and disabling', AvailBits: 'Test: when the game offers it', OnAccept: 'Bits set on accepting', OnRefuse: 'Bits set on refusing',
    OnSuccess: 'Bits set when done', OnFailure: 'Bits set when it fails', OnAbort: 'Bits set when aborted', OnShipDone: 'Bits set on meeting the ship goal', AcceptButton: 'Accept button label',
    RefuseButton: 'Refuse button label', DispWeight: 'Order among a port\'s missions', CargoType: 'Its cargo', CargoQty: 'Tons of cargo',
  },
  'oütf': {
    ModType: 'What it does', ModVal: 'How much', ModType2: 'Second effect', ModVal2: 'How much', ModType3: 'Third effect', ModVal3: 'How much', ModType4: 'Fourth effect', ModVal4: 'How much',
    DispWeight: 'Order in the outfitter', Mass: 'Tons of free mass each', Max: 'Most per ship', Flags: 'Guns, turrets, selling, listing, and more', Cost: 'Price',
    Requires: 'Bits needed to buy it', Availability: 'Test: when it is sold', OnPurchase: 'Bits set on buying', OnSell: 'Bits set on selling', ShortName: 'Name in the outfitter list',
    LCName: 'Name in a sentence for one', LCPlural: 'Name in a sentence for several', ItemClass: 'Class for a person\'s gift', ScanMask: 'Who counts it as smuggling', RequireGovt: 'Where Requires apply',
    TechLevel: 'Tech level to offer it', BuyRandom: 'Daily chance it is for sale', Contributes: 'Bits it gives while carried',
  },
  'wëap': {
    Sound: 'Sound when fired', SmokeSet: 'Smoke its shots leave', BeamColor: 'Beam core color', CoronaColor: 'Beam glow color', LiDensity: 'Lightning zig-zags', LiAmplitude: 'Lightning swing',
    MaxAmmo: 'Most ammunition per launcher', MassDmg: 'Armor damage', EnergyDmg: 'Shield damage', Guidance: 'How it flies and fires', AmmoType: 'What a shot uses', Graphic: 'Shot sprite',
    Inaccuracy: 'Spread of its shots', ExplodType: 'Explosion where it hits', ProxRadius: 'Proximity fuse reach', BlastRadius: 'Blast reach', Flags: 'Frames, shields, firing together, and more',
    Seeker: 'Asteroids, ionization, decoys, and jamming', Decay: 'Damage lost as it flies', Particles: 'Trail particles', PartVel: 'Trail particle speed', PartLifeMin: 'Shortest trail particle life',
    PartLifeMax: 'Longest trail particle life', PartColor: 'Trail particle color', BeamLength: 'Beam reach', BeamWidth: 'Beam width or steps a frame', Falloff: 'Beam fade', SubType: 'Submunition weapon',
    ProxSafety: 'Steps before it arms', Flags2: 'Frames, hits, submunitions, planet-type, and more', HitParticles: 'Particles where it hits', HitPartLife: 'Hit particle life', HitPartVel: 'Hit particle speed',
    HitPartColor: 'Hit particle color', Recoil: 'Push back on the firer', ExitType: 'Which exit points', BurstCount: 'Shots a burst', BurstReload: 'Reload after a burst', JamVuln: 'How jamming affects it',
    Flags3: 'Ammunition, single shots, and exit point', Durability: 'What point defense wears down', IonizeColor: 'Color of an ionized ship', Reload: 'Steps between shots', Count: 'Steps a shot lasts',
    Speed: 'Shot speed', GuidedTurn: 'Homing turn', Impact: 'Push on the ship hit', Ionization: 'Ionization added', SubCount: 'Submunitions a shot', SubTheta: 'Submunition spread', SubLimit: 'Submunition generations',
  },
  'përs': {
    Color: 'Paint on its ship', Coward: 'Shields before it runs', HailPict: 'Picture when hailed', CommQuote: 'Answer when hailed', Subtitle: 'Line in the target display', Credits: 'Credits plundered',
    GrantClass: 'Outfit class it may give', GrantProb: 'Chance of the gift', GrantCount: 'How many it gives', ShipType: 'Its ship class', Govt: 'Its government', AIType: 'How its ship flies',
    Aggress: 'Aggression', WeapType: 'Weapons added', WeapCount: 'How many of each', AmmoLoad: 'Ammunition for each', ShieldMod: 'Shields and armor (percent)', HailQuote: 'What it says when it hails the player',
    LinkMission: 'Mission it offers', Flags: 'Grudges, pods, hails, and its mission', Flags2: 'Starts with no fuel', LinkSyst: 'Where the player meets it', ActivateOn: 'Test: when the player meets it',
  },
  'ränk': {
    Weight: 'Which rank gives the player\'s title', Govt: 'Its government', PriceMod: 'Price (percent)', Salary: 'Daily pay', SalaryCap: 'Pay only below this', Contrib: 'Bits it gives while held',
    Flags: 'Losing it and what it does', ConvName: 'Name used for <PRK>', ShortName: 'Name used for <SRK>',
  },
  'crön': {
    FirstDay: 'Earliest day', FirstMonth: 'Earliest month', FirstYear: 'Earliest year', LastDay: 'Latest day', LastMonth: 'Latest month', LastYear: 'Latest year', Random: 'Daily chance it starts',
    Duration: 'Days it runs', PreHoldoff: 'Days before it starts', PostHoldoff: 'Days before it can come again', IndNewsStr: 'News elsewhere', Flags: 'Bits set over and over',
    EnableOn: 'Test: when it can start', OnStart: 'Bits set when it starts', OnEnd: 'Bits set when it ends', Require: 'Bits needed to start', NewsGovt: 'Governments with news of it',
    GovtNewsStr: 'Their news', Contrib: 'Bits it gives while running',
  },
  'spöb': {
    xPos: 'Place in its system across', yPos: 'Place in its system down', Type: 'Its picture', Flags: 'Landing, services, and prices', TechLevel: 'What its shipyard and outfitter offer',
    SpecialTech: 'Special tech levels', SpecialTech4to8: 'More special tech levels', MinStatus: 'Record below which it hates the player', CustPicID: 'Landing picture', CustSndID: 'Landed sound or gate heading',
    DefenseDude: 'Düde of its defense ships', DefCount: 'How many defense ships', Flags2: 'Animation, domination, gates, and more', AnimDelay: 'How long each frame shows', Frame0Bias: 'How long the first frame shows',
    HyperLink: 'Where a gate leads', OnDominate: 'Bits set on dominating', OnRelease: 'Bits set on releasing', DeadTime: 'Days it stays destroyed', OnDestroy: 'Bits set when destroyed',
    OnRegen: 'Bits set when it regenerates', Govt: 'Its government', Tribute: 'Daily tribute once dominated', Fee: 'Landing fee', Gravity: 'Pull on ships', Weapon: 'Its weapon',
    Strength: 'Damage that destroys it', DeadType: 'Picture when destroyed', ExplodType: 'Explosion',
  },
};

const NOVA_FIELD_READS = {
  'dësc': {
    Graphic: v => v > 127 ? `PICT ${v}` : 'none',
    Movie: v => v || 'none',
    Flags: v => novaBitsRead(v, { 1: 'after the text', 2: 'twice its size', 4: 'over the whole game' }),
  },
  'shän': {
    Flags: v => novaBitsRead(v, { 1: 'banking', 2: 'folding', 4: 'second set with KeyCarried', 8: 'cycling', 0x10: 'still while disabled', 0x20: 'no alternating image while disabled',
      0x40: 'no running lights while disabled', 0x80: 'folds only to fire', 0x100: 'frames in perspective', 0x200: 'not read', 0x400: 'not read', 0x800: 'not read', 0x1000: 'not read', 0x2000: 'not read', 0x4000: 'not read', 0x8000: 'not read' }),
  },
  'ränk': {
    Govt: (v, r, g) => novaGovtText(g, v),
    Flags: v => novaBitsRead(v, { 1: 'gaining it removes the others', 0x10: 'gaining it removes lower Weights', 2: 'losing it removes the others', 0x20: 'losing it removes lower Weights',
      8: 'never removed that way', 0x40: 'lost on crimes against allies', 4: 'lost only on attacks', 0x100: "allies' ships see no threat", 0x200: "allies' stellars see no threat",
      0x400: 'allies always help', 0x800: 'allies help free', 0x80: 'not read', 0x1000: 'not read', 0x2000: 'not read', 0x4000: 'not read', 0x8000: 'not read' }),
    PriceMod: v => `${v > 0 ? v : 100}% of the price`,
    Salary: v => `${v.toLocaleString('en-US')} credits a day`,
    SalaryCap: v => (v > 0 ? `while the player has under ${v.toLocaleString('en-US')} credits` : 'always'),
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
    Flags: v => novaBitsRead(v, { 1: 'offered first', 0x2: 'not read', 0x4: 'not read', 0x8: 'not read', 0x10: 'not read', 0x20: 'not read', 0x40: 'not read', 0x80: 'not read', 0x100: 'not read', 0x200: 'not read', 0x400: 'not read', 0x800: 'not read', 0x1000: 'not read', 0x2000: 'not read', 0x4000: 'not read', 0x8000: 'not read' }),
  },
  'mïsn': {
    AvailStel: (v, r, g) => novaPlaceRead(g, 'avail', v),
    ScanMask: (v, r, g) => r.Flags & 0x20 ? novaScanRead(g, v).replace(/^smuggling where scanned by /, 'fails if scanned by ').replace(/^never smuggling$/, 'never fails a scan') : novaScanRead(g, v),
    AvailLoc: v => NOVA_AVAIL_LOC[v] || 'nowhere',
    AvailRecord: v => v === 0 ? 'no test' : v === -32000 ? 'a stellar the player has dominated' : v === -32001 ? 'once the player has dominated a stellar' : v < -32001 ? 'never offered' : v > 0 ? `a record of ${v} or more here` : `a record of ${v} or less here`,
    AvailRating: v => v <= 0 ? 'no test' : `a combat rating of ${v} or more`,
    AvailRandom: v => v >= 100 ? 'always' : v <= 0 ? 'never' : `${v} in 100`,
    AvailShipTyp: (v, r, g) => v >= 128 && v <= 896 ? 'flying ' + novaRefText(g, 'shïp', v) : v >= 1128 && v <= 1896 ? 'not flying ' + novaRefText(g, 'shïp', v - 1000)
      : v >= 2128 && v <= 2384 ? 'a ship class whose InherentGovt is ' + novaGovtText(g, v - 2000) : v >= 3128 && v <= 3384 ? 'a ship class whose InherentGovt is not ' + novaGovtText(g, v - 3000) : 'no test',
    TravelStel: (v, r, g) => novaPlaceRead(g, 'travel', v),
    ReturnStel: (v, r, g) => novaPlaceRead(g, 'return', v) + (v === -1 && r.TravelStel === -1 ? ' (with TravelStel -1 too no landing finishes it)' : ''),
    CargoQty: v => v >= 0 ? `${v} tons` : v === -1 ? 'none' : `${Math.trunc(-v / 2)} to ${Math.trunc(-v / 2) - v - 1} tons at random`,
    PickupMode: v => ['on accepting', 'at TravelStel', 'on boarding one of its ships'][v] || 'not picked up',
    DropoffMode: v => ['at TravelStel', 'at ReturnStel'][v] || 'not dropped off',
    PayVal: (v, r, g) => { const p = novaMissionPay(v); return p.text.replace('{g}', p.govt !== undefined ? novaGovtText(g, p.govt) : ''); },
    ShipCount: v => v > 0 ? `${v} ship${v === 1 ? '' : 's'}` : 'none',
    ShipSyst: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : novaPlaceRead(g, 'ship', v),
    ShipDude: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : novaDudeRead(g, v),
    ShipGoal: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (({ 0: 'destroy them all', 1: 'disable them all', 2: 'board them all', 3: 'keep them', 4: 'see one of them', 5: 'board them all (disabled from the start)', 6: 'get rid of them' })[v] || 'none'),
    ShipBehav: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (({ 0: 'attack the player', 1: 'fly with the player as escorts', 2: 'go for stellars of their enemies' })[v] || 'by their AI'),
    ShipStart: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v >= -16 && v <= -1 ? `on stellar ${-v} of their system's list` : v === 1 ? 'in from hyperspace after a while each time' : v === 2 ? 'in from hyperspace the first time and cloaked after' : 'brought in as the system\'s other ships are'),
    ShipNameID: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v === -1 ? 'their usual names' : g.get('STR#', v) ? novaRefText(g, 'STR#', v) : `their usual names (no STR# ${v})`),
    ShipSubtitle: (v, r, g) => r.ShipCount <= 0 ? 'no ships' : (v === -1 ? 'none' : g.get('STR#', v) ? novaRefText(g, 'STR#', v) : `none (no STR# ${v})`),
    CompGovt: (v, r, g) => v >= 128 && v <= 383 ? novaGovtText(g, v) : 'none',
    CompReward: (v, r) => r.CompGovt >= 128 && r.CompGovt <= 383 ? `${v} done · ${-Math.trunc(v / 2)} failed · ${-5 * v} aborted with Flags 0x0040` : 'not used',
    BriefText: (v, r, g) => novaDescRead(g, v), QuickBrief: (v, r, g) => novaDescRead(g, v),
    LoadCargText: (v, r, g) => novaDescRead(g, v), DropCargText: (v, r, g) => novaDescRead(g, v),
    CompText: (v, r, g) => novaDescRead(g, v), FailText: (v, r, g) => novaDescRead(g, v),
    ShipDoneText: (v, r, g) => novaDescRead(g, v),
    RefuseText: (v, r, g) => v === -1 ? 'none' : g.get('dësc', v) ? novaRefText(g, 'dësc', v) : `dësc ${v} is not in the files. The text is empty.`,
    TimeLimit: v => v > 0 ? `${v} days` : 'no limit',
    CanAbort: v => v ? 'the player can abort it' : 'the player cannot abort it',
    AuxShipCount: (v, r) => v > 0 && r.AuxShipDude >= 128 && r.AuxShipDude <= 639 ? `${v} ship${v === 1 ? '' : 's'}` : 'none',
    AuxShipDude: (v, r, g) => r.AuxShipCount > 0 ? novaDudeRead(g, v) : 'no aux ships',
    AuxShipSyst: (v, r, g) => r.AuxShipCount > 0 ? novaPlaceRead(g, 'aux', v) : 'no aux ships',
    DatePostInc: v => v > 0 ? `${v} days` : 'none',
    AcceptButton: (v, r) => /^[a-z]/i.test(v || '') ? `"${v}"` : (r.Flags & 4 ? '"Okay"' : '"Yes"'),
    RefuseButton: v => /^[a-z]/i.test(v || '') ? `"${v}"` : '"No"',
    Flags: v => novaBitsRead(v, { 1: 'ends by itself', 2: 'unmarked on the map', 4: 'cannot be refused', 8: 'needs 100 fuel', 0x10: 'aux ships without end',
      0x20: 'fails if scanned', 0x40: 'abort penalty', 0x100: 'marked while offered', 0x200: "ShipSyst's system marked", 0x400: 'invisible',
      0x800: 'one ship class', 0x2000: 'not for InherentAI 2 or less', 0x4000: 'not for InherentAI 3 or more', 0x8000: 'fails if plundered', 0x80: 'not read', 0x1000: 'not read' }),
    Flags2: v => novaBitsRead(v, { 1: 'needs cargo room', 2: 'pays when it ends by itself', 4: 'fails if the player is disabled' }),
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
    Asteroids: v => v > 0 ? `${Math.min(v, 16)} around the player` : 'none',
    Interference: v => `${Math.max(0, Math.min(100, v))} in 100 before the ship\'s anti-interference`,
    Murk: v => `${Math.max(0, Math.min(100, v))} before outfits`,
    Message: (v, r, g) => v === -1 ? 'one of three greetings at random and the system\'s name' : `"${novaString(g, 1000, v - 1, 1000) ?? '(no such string)'}"`,
    ReinfFleet: (v, r, g) => v >= 128 ? novaRefText(g, 'flët', v) : 'none',
    ReinfIntrval: v => `${Math.max(1, v)} day${Math.max(1, v) === 1 ? '' : 's'}`,
  },
  'shïp': {
    Holds: v => v < 0 ? `${-v} tons and no outfits that use hold space` : `${v} tons`,
    Shield: v => `${v} points`,
    Armor: v => `${v} points`,
    Accel: v => `${novaNum(v / 10000)} each 30th of a second before skill`,
    Speed: v => `${novaNum(v / 100)} each 30th of a second before skill and strict play`,
    Maneuver: v => `${novaNum(v / 10)}° each 30th of a second (${novaNum(v * 3)}° a second)`,
    Fuel: v => `${Math.max(0, Math.trunc(v / 100))} jump${Math.trunc(v / 100) === 1 ? '' : 's'}`,
    FreeMass: v => `${v} tons`,
    DispWeight: v => `order ${v} (highest first)`,
    InherentGovt: (v, r, g) => v >= 128 && v <= 383 ? novaGovtText(g, v) + ', in combat and attributes' : v >= 1128 && v <= 1383 ? novaGovtText(g, v - 1000) + ', attributes only'
      : v >= 2128 && v <= 2383 ? novaGovtText(g, v - 2000) + ', in combat only' : 'none',
    DeathDelay: (v, r) => `${Math.max(0, v)} steps${r.Mass >= 100 && !(r.Flags & 0x0400) ? ` and then a blast ${Math.trunc(r.Mass * 0.075 + 50)} across for ${Math.trunc(r.Mass * 0.0375 + 25)} damage` : ''}`,
    Explode1: (v, r, g) => novaBoomRead(g, v),
    Explode2: (v, r, g) => novaBoomRead(g, v),
    PodCount: v => v > 0 ? `${v} pod${v === 1 ? '' : 's'}` : 'none',
    EscortType: (v, r) => (t => ['fighter', 'medium', 'warship', 'freighter'][t] + (v >= 0 && v <= 3 ? '' : ', worked out'))(v >= 0 && v <= 3 ? v : r.InherentAI <= 2 ? 3 : r.Mass < 50 ? 0 : r.Mass < 200 ? 1 : 2),
    KeyCarried: (v, r, g) => v >= 128 && v <= 895 ? novaRefText(g, 'shïp', v) : 'none',
    Flags: v => novaBitsRead(v, { 1: 'jumps at 0.7', 2: 'jumps at 1.3', 4: 'jumps at 1.6', 8: 'FuelRegen for the player too', 0x10: 'disabled at a tenth', 0x20: 'afterburner for good pilots', 0x40: 'afterburner always', 0x100: 'target display', 0x200: 'target display', 0x400: 'planet-type', 0x1000: 'no turret fire ahead', 0x2000: 'no turret fire abeam', 0x4000: 'no turret fire astern', 0x8000: 'escape ship', 0x80: 'not read', 0x800: 'not read' }),
    Flags2: v => novaBitsRead(v, { 1: 'swarms', 2: 'stands off', 4: 'untargetable', 8: 'point defense fires on it', 0x10: 'no spoken replies', 0x20: 'jumps without slowing', 0x40: 'inertialess', 0x80: 'minds its ammunition', 0x100: 'cloaks in burst reload', 0x200: 'cloaks running away', 0x400: 'cloaks jumping', 0x800: 'cloaks flying about', 0x1000: 'cloaked until near', 0x2000: 'cloaks idle', 0x4000: 'cloaks when attacked' }),
    WeapType: (v, r, g) => novaStockRead(g, v, r.WeapCount, r.AmmoLoad),
    WeapType2: (v, r, g) => novaStockRead(g, v, r.WeapCount2, r.AmmoLoad2),
    Mass: v => (d => `${d} day${d === 1 ? '' : 's'} a jump${v >= 100 ? ', a larger radar blip' : ''}`)(v < 100 ? 1 : v < 200 ? 2 : 3),
    InherentAI: v => ({ 1: 'WimpyTraderAI (a trading ship)', 2: 'BraveTraderAI (a trading ship)', 3: 'WarshipAI', 4: 'InterceptorAI' })[v] || (v > 4 ? 'EscortAI' : 'none (its ships run no AI and count as trading ships)'),
    MaxGun: v => v > 0 ? `${v} fixed gun${v === 1 ? '' : 's'} before outfits` : 'none before outfits',
    MaxTur: v => v > 0 ? `${v} turret${v === 1 ? '' : 's'} before outfits` : 'none before outfits',
    ShieldRech: v => v > 0 ? `${novaNum(v * 0.03)} points a second` : 'none',
    ArmorRech: v => v > 0 ? `${novaNum(v * 0.03)} points a second` : 'none',
    SkillVar: v => v > 0 ? `skill ${100 - v}% to ${100 + v}%` : 'skill 100%',
    Deionize: v => `${novaNum(v > 0 ? v * 0.3 : 30)} a second`,
    IonizeMax: v => v > 0 ? `fully ionized at ${v}` : 'never slowed',
    TechLevel: v => v < 0 ? 'in no shipyard by it' : `shipyards of TechLevel ${v} or more`,
    BuyRandom: v => v <= 0 ? 'not sold' : `${Math.min(v, 100)} in 100 a day`,
    HireRandom: v => v <= 0 ? 'never for hire' : `${Math.min(v, 100)} in 100 a day`,
    UpgradeTo: (v, r, g) => v >= 128 ? novaRefText(g, 'shïp', v) : 'no upgrade',
    EscSellValue: (v, r) => `${(v > 0 ? v : Math.trunc(r.Cost / 10)).toLocaleString('en-US')} credits`,
    DefaultItems: (v, r, g) => novaItemsRead(g, v, r.ItemCount),
    DefaultItms2: (v, r, g) => novaItemsRead(g, v, r.ItemCount2),
    FuelRegen: (v, r) => v > 0 ? `a unit every ${v} steps${r.Flags & 8 ? '' : ' (not the player\'s: Flags 0x0008 clear)'}` : 'none',
    Flags3: v => novaBitsRead(v, { 1: 'a miner that parks', 2: 'a miner that goes between stellars', 0x20: 'no gravity or deadly stellars', 0x40: 'turret shots above ships', 0x100: 'hidden while Availability fails', 0x200: 'hidden while Require is not met', 0x4000: 'hides later classes of its DispWeight' }),
  },
  'oütf': {
    DispWeight: v => `order ${v} (highest first)`,
    Mass: (v, r) => r.Flags & 0x0400 && v > 0 ? `${v}% of the ship class's Mass and at least ${v} tons` : `${v} tons`,
    Max: v => `${v}, before ModType 27 outfits`,
    Cost: (v, r) => v <= 0 ? 'free' : `${v.toLocaleString('en-US')} credits${r.Flags & 0x0200 ? ', × the ship class\'s Mass' : ''}`,
    Flags: v => novaBitsRead(v, { 1: 'fixed gun', 2: 'turret', 4: 'kept on a new ship', 8: 'the player cannot sell it', 0x10: 'taken on leaving', 0x20: 'kept on a mission\'s new ship',
      0x100: 'hidden without Requires', 0x200: 'price by ship mass', 0x400: 'mass by ship mass', 0x800: 'sold anywhere', 0x1000: 'hides later items of its DispWeight',
      0x2000: 'shown among ranks', 0x4000: 'hidden without Availability', 0x40: 'not read', 0x80: 'not read', 0x8000: 'not read' }),
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
    BuyRandom: v => v <= 0 ? 'not for sale unless the player has one' : `${Math.min(v, 100)} in 100 a day`,
  },
  'gövt': {
    VoiceType: v => v >= 0 ? `snd ${1000 + 100 * v} on` : 'silent',
    Flags: v => novaBitsRead(v, { 1: 'xenophobic', 2: 'hunts criminals anywhere', 4: 'always attacks the player', 8: 'the player\'s shots miss it', 0x10: 'warships run when hurt', 0x20: 'its ships not helped',
      0x40: 'never attacks the player', 0x80: 'jamming halved', 0x100: 'no escape pods', 0x200: 'warships take bribes', 0x400: 'no hailing', 0x800: 'derelicts',
      0x1000: 'pirate warships', 0x2000: 'freighters take bribes', 0x4000: 'stellars take bribes', 0x8000: 'bigger bribes' }),
    Flags2: v => novaBitsRead(v, { 1: 'no request for help', 2: 'map boundaries', 4: 'map boundaries', 8: 'never calls for help', 0x10: 'free help', 0x20: 'no hypergates', 0x40: 'prefers hypergates', 0x80: 'prefers wormholes' }),
    CrimeTol: v => `attacks the player below ${-v} in its systems`,
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
    ScanFine: v => v > 0 ? `${v.toLocaleString('en-US')} credits` : v === 0 ? 'a warning' : `${-v}% of the player\'s credits`,
    MaxOdds: v => `runs at odds over ${Math.max(0.01, v / 100)}`,
  },
  'spöb': {
    Type: (v, r, g) => `${novaRefText(g, 'spïn', 1000 + v)} and ${r.CustPicID >= 128 ? `PICT ${r.CustPicID}` : `PICT ${10000 + v}`} when landed`,
    Flags: (v, r, g) => novaListRead([v & 1 ? (v & 0x80 ? 'landable only destroyed' : 'landable') : 'not landable',
      ...[[2, 'commodity exchange'], [4, 'outfitter'], [8, 'shipyard'], [0x40, 'bar'], [0x10, 'station'], [0x20, 'uninhabited']].filter(([b]) => v & b).map(([, w]) => w),
      novaListRead([0, 1, 2, 3, 4, 5].map(i => { const n = (v >>> (28 - 4 * i)) & 15; const w = n & 1 ? 'low' : n & 2 ? 'medium' : n & 4 ? 'high' : null;
        return w && `${novaString(g, 4000, i, 9000) ?? `commodity ${i}`} ${w}`; })).replace(/^none$/, 'no trade')]),
    TechLevel: v => `ships and outfits of TechLevel 0 to ${v}`,
    MinStatus: v => v === -32767 ? 'never hated' : v === 32767 ? 'always hated' : `hated below ${v}`,
    CustSndID: v => v >= 128 ? `snd ${v} when landed` : v >= 0 && v <= 359 ? `leaving gates at ${v}°` : 'none',
    DefenseDude: (v, r, g) => novaDudeRead(g, v),
    DefCount: v => v <= 1000 ? `${v} ship${v === 1 ? '' : 's'}` : `${Math.trunc(v / 10) - (v > 10000 ? 1000 : 100)} ships with ${v % 10} out together`,
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
    DeadType: (v, r) => v > 255 || v < 0 ? `its Type, ${r.Type}` : `${v}`,
    ExplodType: v => v < 0 ? 'none' : `${v}`,
  },
  'wëap': {
    Sound: (v, r, g) => v >= 0 ? novaRefText(g, 'snd ', 200 + v) : 'silent',
    Guidance: v => ({ [-1]: 'forward gun', 0: 'beam', 1: 'homing', 3: 'turreted beam', 4: 'turret', 5: 'bomb', 6: 'rocket', 7: 'front quadrant turret', 8: 'rear quadrant turret', 9: 'point defense shot', 10: 'point defense beam', 99: 'fighter bay' })[v] || `${v}: not fired`,
    AmmoType: (v, r, g) => r.Guidance === 99 ? novaRefText(g, 'shïp', v) : v === -1 ? 'none' : v >= 0 && v <= 255 ? 'ammunition of ' + novaRefText(g, 'wëap', 128 + v) : v === -999 ? 'wrecks its own ship' : v <= -1000 ? `${novaNum((Math.abs(v) - 1000) / 10)} fuel a shot` : 'none',
    Graphic: (v, r, g) => v >= 0 && v <= 255 ? novaRefText(g, 'spïn', 3000 + v) : 'no shot',
    Inaccuracy: v => v > 0 ? `±${v}°` : v < 0 ? `${-v}° off the bow` : 'straight',
    ExplodType: (v, r, g) => novaBoomRead(g, v),
    ProxRadius: v => v > 0 ? `${v}, plus a third of the target` : 'hits only',
    BlastRadius: v => v > 0 ? `${v}` : 'none',
    Flags: v => novaBitsRead(v, { 1: 'frames step', 2: 'second trigger', 4: 'first frame first', 8: 'only at slow ships', 0x10: 'sound loops', 0x20: 'through shields', 0x40: 'all together',
      0x80: 'point defense passes it', 0x100: 'blast spares the player', 0x200: 'small smoke', 0x400: 'big smoke', 0x800: 'lasting smoke', 0x1000: 'blind ahead', 0x2000: 'blind abeam', 0x4000: 'blind astern', 0x8000: 'goes off at its end' }),
    Seeker: v => novaBitsRead(v, { 1: 'over asteroids', 2: 'decoyed by asteroids', 8: 'confused by interference', 0x10: 'turns away jammed', 0x20: 'not when ionized', 0x4000: 'loses lock off the nose', 0x8000: 'may turn on its ship' }),
    Flags2: v => novaBitsRead(v, { 1: 'first frame till armed', 2: 'holds last frame', 4: 'not read', 8: 'hits others than its target', 0x10: 'submunitions seek', 0x20: 'no submunitions at its end', 0x40: 'ammunition not shown',
      0x80: 'needs KeyCarried', 0x100: 'the player\'s alone', 0x200: 'weapon sprite', 0x400: 'planet-type', 0x800: 'hidden when empty', 0x1000: 'disables only', 0x2000: 'beam under ships', 0x4000: 'fires cloaked', 0x8000: '× 10 on asteroids' }),
    Flags3: v => novaBitsRead(v, { 1: 'ammunition a burst', 2: 'translucent', 4: 'one shot at a time', 0x10: 'nearest exit', 0x20: 'exclusive',
      0x8: 'not read', 0x40: 'not read', 0x80: 'not read', 0x100: 'not read', 0x200: 'not read', 0x400: 'not read', 0x800: 'not read', 0x1000: 'not read', 0x2000: 'not read', 0x4000: 'not read', 0x8000: 'not read' }),
    SubType: (v, r, g) => r.SubCount > 0 && v >= 128 && v <= 383 ? novaRefText(g, 'wëap', v) : 'none',
    Recoil: v => v > 0 ? `${v} back divided by the ship's Mass` : v < -1 ? `${-v} forward divided by the ship's Mass` : 'none',
    ExitType: v => ({ 0: 'gun points', 1: 'turret points', 2: 'guided points', 3: 'beam points' })[v] || 'the middle',
    BurstCount: (v, r) => v > 0 ? `${v} shots${r.Flags & 0x40 ? '' : ' a weapon'} and then ${r.BurstReload}` : 'no bursts',
    Durability: v => v > 0 ? `${v}` : 'none: the first hit',
    Decay: v => v > 0 ? `1 damage every ${v} steps` : 'none',
    Count: (v, r) => `${v} steps with a reach of ${Math.trunc(v * r.Speed / 100)}`,
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
      0x10: 'hails as it turns on the player', 0x20: 'hails while disabled only', 0x40: 'becomes the mission ship', 0x80: 'hails once', 0x100: 'gone after its mission',
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

/* The value of a field in a record, in words, or null where there is no reading. */
function novaFieldRead(game, type, field, rec) {
  const f = NOVA_FIELD_READS[type] && NOVA_FIELD_READS[type][field];
  return f ? f(rec[field], rec, game) : null;
}

/* A field's note, or null. */
function novaFieldNote(type, field) {
  const t = NOVA_FIELD_NOTES[type];
  return t && t[field] || null;
}
// Its few words, or null.
function novaFieldShort(type, field) {
  const t = NOVA_FIELD_SHORT[type];
  return t && t[field] || null;
}
