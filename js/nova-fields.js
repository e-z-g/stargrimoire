/* nova-fields.js -- what record fields do, as the program does it.
   =========================================================================

   A note here says what the game does with a field, read from Mac 1.1.1's
   Intel code and nothing else: not the Bible, not the editors' templates,
   not the wiki. Each names the routines it was read from, by the names the
   program carries and their addresses, so it can be read again; a field
   with no note has not been traced. evnova-workbench's tools/fieldtrace.py
   finds where a loader puts each field and which routines use that place;
   utilities/fields_check.mjs holds every routine named here to the
   program's own symbols.

   The plug-in editor shows a note beside its field (page-plugin.js).

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js. */

const NOVA_FIELD_NOTES = {
  'sÿst': {
    Message: {
      note: 'Shown when you arrive: entry Message of STR# 1000, or the STR resource numbered Message + 999 where there is one. -1: "Entering the", "Jumping into the" or "Arriving in the", at random, and the system\'s name.',
      code: [['HandlePlayer', 0x68390], ['DisplayMessage', 0x5289], ['LoadPluginString', 0x71a8e]],
    },
    ReinfFleet: {
      note: 'The flët that comes when a ship of a government allied with the fleet\'s calls for help in this system: when the odds against it are more than half the MaxOdds of the fleet\'s government, or, without that test, when a ship you hail comes to help you. While it is on its way, a warship of that side holds out to twice its MaxOdds before it runs, not once. Below 128: none.',
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
    TechLevel: {
      note: 'Offered in a stellar\'s shipyard whose TechLevel is at least this, or one of whose SpecialTech is this. Below 0: in none.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3]],
    },
    BuyRandom: {
      note: 'The chance in 100 it is offered on a given day: it is offered while BuyRandom is at least a number from 1 to 100 drawn for its class each day. 0: never.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['IncrementGameTime', 0xb516], ['Rand', 0xa4c76]],
    },
    Require: {
      note: 'Offered only when the Contributes bits of your ship and outfits include every bit set here.',
      code: [['SetupPortAvailableShipTypes', 0xbbe3], ['GetPlayerContributeBits', 0x76b2]],
    },
    FuelRegen: {
      note: 'One unit of Fuel back every FuelRegen steps, times the game speed, up to what it can hold. 0 or less: none. Your own ship regains it only with Flags 0x0008.',
      code: [['ShipFuelGenRate', 0x2ffb], ['HandleShip', 0x33581]],
    },
    Flags3: {
      note: '0x0020: a planet\'s Gravity does not pull it.',
      code: [['ShipResistsGravity', 0x7b10]],
    },
  },
  'spöb': {
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

/* A field's note, or null. */
function novaFieldNote(type, field) {
  const t = NOVA_FIELD_NOTES[type];
  return t && t[field] || null;
}
