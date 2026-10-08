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
      note: 'While you are in its system, pulls every ship in it toward the stellar, however far: each step by Gravity × the game speed ÷ the square of the distance in hundreds of units, the square taken as at least 30. 0: no pull. Inertialess ships do not feel it, nor some ship classes by a flag, nor your ship if it carries an outfit with ModType 41.',
      code: [['HandleGravity', 0x39bc3], ['ApplyGravity', 0x7c5a], ['ShipResistsGravity', 0x7b10]],
    },
    Weapon: {
      note: '-1: it does not fire. It does not fire once destroyed.',
      code: [['HandleStellarWeapons', 0x2ef3a]],
    },
    Strength: {
      note: 'Its strength to start with and its most.',
      code: [['LoadObjectData', 0x771b0]],
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
