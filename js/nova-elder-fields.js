/* nova-elder-fields.js -- what Escape Velocity's and EV Override's programs
   do with each field of their records.
   =========================================================================

   ELDER_FIELD_NOTES[type][field] is a note read from the two games' PowerPC
   programs (Escape Velocity 1.0.5 and EV Override 1.0.2, each in its
   installer), under the field's name in the game's template. `note` is true
   of both games, `evNote` of Escape Velocity alone and `evoNote` of
   Override alone. `ev` and `evo` list the addresses in each program of the
   instructions the note was read from, and the Code view opens at each.
   `bits` has a note for each bit of a flags field, by its mask. A field with
   `unread` is one that no instruction of that game's program reads after
   the loader copies it.

   Random(n) in a note is the program's draw of a whole number from 0 to
   n - 1. A record's index is its number minus 128.

   NOT A PAGE SCRIPT. LOAD ORDER: after nova-records.js. */

const ELDER_FIELD_NOTES = {
  'öops': {
    Stellar: { note: 'Where the event happens. An event that starts by its Freq is put at stellar Stellar when that is 128 or more. With −1 it is put at the lowest-numbered stellar there is. The news sentence reads −2 as every stellar. A start by Freq is the only place the event is given its stellar.',
      ev: [0x122080, 0x1220a8, 0x1220ec, 0x122124, 0x10a58c, 0x10a604], evo: [0x16d8b8, 0x16da40, 0x16da84, 0x16dbf4, 0x10ac08, 0x10ac80] },
    Commodity: { note: 'The commodity whose price changes, from 0 to 5. While the event is on, the commodity trades at the event’s stellar for its base price plus PriceDelta.',
      ev: [0x13ed30, 0x10a7f0, 0x112794], evo: [0x134ef4, 0x10ae6c, 0x112eac] },
    PriceDelta: { note: 'Added to the commodity’s base price at the event’s stellar while the event is on. The price is never under 5. Its sign picks one of two words for the news sentence.',
      ev: [0x13ed68, 0x13ed8c, 0x13edac, 0x10a790, 0x11282c], evo: [0x134f2c, 0x134f50, 0x134f70, 0x10ae0c, 0x112f44] },
    Duration: { note: 'The days the event stays on once it starts. An event with a MissionBit and a Duration under 0 is on for as long as the bit is set.',
      ev: [0x1220d0, 0x12214c, 0x12201c, 0x154a7c, 0x154aa4], evo: [0x16da68, 0x16dc1c, 0x16d7dc, 0x14bc78, 0x14bca0] },
    Freq: { note: 'The chance in 100 each day that the event starts while it is off. The draw is Random(100) + 1 and the event starts when that is no more than Freq.',
      ev: [0x122068], evoNote: 'An event with a MissionBit from 0 to 511 never starts by Freq.', evo: [0x16d8a0, 0x16d784] },
    MissionBit: { note: 'A mission bit that turns the event on. When a mission sets the bit, an event with a Duration over 0 starts for Duration days. On each day that the bit is set, an event with a Duration under 0 is on.',
      evNote: 'The loader reads only 0 to 255 as a bit and any other value as none.', ev: [0x125db4, 0x125dd4, 0x125df0, 0x121fe0, 0x122000, 0x154a60],
      evoNote: 'The loader reads only 0 to 511 as a bit and any other value as none, so the daily routine’s tests for 1000 and over never pass.', evo: [0x118ff4, 0x119014, 0x119030, 0x16d784, 0x16d7c0, 0x14bc5c, 0x14c3f0, 0x151d9c] },
  },
  'nëbu': {
    XPos: { note: 'The left edge of the nebula on the map, in the systems’ coordinates. A system inside the rectangle from XPos and YPos of XSize by YSize, drawn in by 8 on every side, marks the nebula as found when the player explores the system. The map draws only a nebula so marked.',
      ev: [0x164a4c, 0x164ac0, 0x13b7f4], evo: [0x15d028, 0x1318d8] },
    YPos: { note: 'The top edge of the nebula on the map, in the systems’ coordinates.',
      ev: [0x164a4c, 0x13b8a0], evo: [0x15d028, 0x131a30] },
    XSize: { note: 'The nebula’s width on the map. The map draws the nebula’s picture into a rectangle of XSize by YSize divided by the map’s scale. A nebula with an XSize or a YSize of 0 or under is never marked as found.',
      ev: [0x1649b0, 0x13b910, 0x13e0ec], evo: [0x15cf8c, 0x1342ac] },
    YSize: { note: 'The nebula’s height on the map.',
      ev: [0x1649cc, 0x13b980, 0x13e068], evo: [0x15cfa8, 0x131b18, 0x134224] },
  },
  'jünk': {
    SoldAt: { note: 'The stellar where this cargo is for sale, or −1 for none. While the player is landed there the price is BasePrice divided by the trade factor. The factor is 1.25. It is 1.1 at a stellar with a government where the player’s legal record in the system is under 0, and 1.5 at a stellar whose defense fleet the player has beaten.',
      ev: [0x13ee6c, 0x13eeb4, 0x13eafc, 0x13eb34, 0x13eb4c], evo: [0x135030, 0x135078, 0x134cc0, 0x134cf8, 0x134d10] },
    BoughtAt: { note: 'The stellar that buys this cargo, or −1 for none. While the player is landed there the price is BasePrice times the trade factor in SoldAt’s note.',
      ev: [0x13ee04, 0x13ee4c], evo: [0x134fc8, 0x135010] },
    BasePrice: { note: 'The price per ton before the trade factor.',
      ev: [0x13ee4c, 0x13eeb4], evo: [0x135010, 0x135078] },
    Flags: { note: 'One bit is read.', ev: [0x1389b8], evo: [0x12e924],
      bits: { 0x0001: { note: 'Four times in each 1000 frames of flight, a cargo of this kind in the player’s hold grows by one ton while there is free cargo space.', ev: [0x1389b8], evo: [0x12e924] } } },
  },
  'flët': {
    LeadShipType: { note: 'The ship class of the fleet’s lead ship.', ev: [0x1227c0], evo: [0x16e8c4] },
    EscortType: { note: 'The ship classes of the four kinds of escort.', ev: [0x122a78], evo: [0x16ed2c] },
    Min: { note: 'The fewest ships of each kind of escort. The count of each kind is Min + Random(Max − Min + 1).', ev: [0x1229c4], evo: [0x16ec78] },
    Max: { note: 'The most ships of each kind of escort.', ev: [0x1229ec], evo: [0x16eca0] },
    Govt: { note: 'The government of the lead ship and of every escort.', ev: [0x1227e8, 0x122ad0], evo: [0x16e8ec, 0x16ed84] },
    LinkSyst: { note: 'The systems the fleet may appear in. −1 is any system and 128 to 9999 is that system. 10000 + g is a system of government g, 15000 + g a system of an ally of g, 20000 + g a system of any government but g and 25000 + g a system of an enemy of g. When a system has any fleet that may appear in it, one draw of Random(128) picks a record number, and a fleet appears only when that record is one of them.',
      ev: [0x122310, 0x1224d4, 0x122528, 0x1226c0, 0x122708], evo: [0x16de68, 0x16e02c, 0x16e080, 0x16e218, 0x16e300] },
    MissionBit: { evoNote: 'The mission bit that lets the fleet appear. −1 is none. With a bit under 1000 the fleet appears only while that bit is set. With 1000 + b it appears only while bit b is clear.', evo: [0x16e244, 0x16e260, 0x16e280, 0x16e2b8] },
  },
  'düde': {
    AIType: { note: 'Every ship of this düde flies with this AI type.', ev: [0x11a5e4],
      evoNote: 'An AIType under 1 leaves the ship with its class’s InherentAI.', evo: [0x1657b0, 0x1657d4, 0x165810] },
    Govt: { note: 'The government of every ship of this düde.', ev: [0x11a60c], evo: [0x165798] },
    ShipTypes: { note: 'A new ship is of one of these four ship classes. One with a number under 0 is never drawn.', ev: [0x11a524, 0x11a5c0], evo: [0x161690, 0x165770] },
    '% Prob': { note: 'The chance of each of the four ship classes. A new ship’s class is drawn by these weights.', ev: [0x11a4b4, 0x11a4fc],
      evoNote: 'The draw is Random(the sum of the weights of the classes whose MissionBit lets them appear) + 1.', evo: [0x1615bc, 0x161600, 0x16163c] },
    MissionBit: { evoNote: 'A mission bit for each of the four ship classes. −1 lets the class appear always, a bit from 0 to 511 only while that bit is set, and 1000 + b only while bit b is clear.', evo: [0x1614b0, 0x161504, 0x161520, 0x161584] },
    Booty: { note: 'What boarding a ship of this düde offers.', ev: [0x1143f4], evo: [0x114b64],
      bits: {
        0x0001: { note: 'Bits 0x0001 to 0x0020 each allow one of the six commodities as cargo to plunder. A draw of Random(7) is repeated until it gives an allowed one. The tons are half the class’s Holds plus Random(half the Holds).', ev: [0x1146f4, 0x114724, 0x1147d8], evo: [0x114e64, 0x114e94, 0x114f48] },
        0x0040: { note: 'The ship has money to plunder, which is 2.5 percent of its class’s Cost plus a random amount under that again, and no less than 1000 credits. Without this bit a përs ship has half its Credits plus a random amount under that again.', ev: [0x114404, 0x114434, 0x11455c, 0x1145b4], evo: [0x114b74, 0x114ba4, 0x114ccc, 0x114d24] },
      } },
    InfoTypes: { note: 'What the player hears from a hailed ship of this düde. Values from 1000 to 7127 are read, as a thousands digit and a remainder. The digit is a sum of 1, 2 and 4. With 1 the ship may give the name of a stellar and a commodity priced low or high there, with 2 it may give the news of an event that is on, and with 4 it may give a random string of STR# 7500 + the remainder. One of the three allowed is drawn.',
      ev: [0x112350, 0x112370, 0x112390, 0x1128a0], evo: [0x112a68, 0x112a88, 0x112aa8, 0x112fb8] },
  },
};
