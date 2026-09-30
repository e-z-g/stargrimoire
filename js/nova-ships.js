/* nova-ships.js -- EV Nova's ships: a shïp record, its shän, and what the
   game makes of them.
   =========================================================================

   A ship class is a shïp record and the shän of the same id, the sprites
   it flies as. Every rule below is the Bible's (Part II, the shïp, shän and
   dësc sections) unless it names an address in the program, which is the
   Mac 1.0.10 build's PowerPC code as evnova-workbench's tools/pefreloc_nova.py lays it out
   (code at 0x100000).

   WORDS AND PICTURES. The ship's description is dësc 13000 + (id - 128),
   shown in the shipyard; its pilot's is dësc 14000 + (id - 128), shown when
   hiring one as an escort, and the program picks one or the other on one
   flag in the routine that shows them (0x13c150). The target picture is
   PICT 3000 + (id - 128), and a ship without one uses that of the first
   ship with the same base sprites. PICT 5000 + (id - 128), which the Bible
   does not name, is the ship's picture beside its description: the program
   looks for it when it loads the ships (0x19b7d8), and without it takes the
   one of the ship whose sprites this one shares (0x19b810, the index kept
   at 0x1a0810 when a ship's sprites are found already loaded); that routine
   draws it for each of up to 20 ships in a grid (0x13c944) and for the one
   selected (0x13cda8), and the communications window shows it unless a
   përs's HailPict replaces it (0x11cb80). The dësc's own Graphic field,
   PICT 20128 onward for the stock ships, is read into a global by the
   routine that loads any dësc (0x12ce10); where the shipyard draws it is
   not traced.

   SPRITES. A shän names up to six sprites -- the base image and, drawn over
   it, the alternating image, the engine glow, the running lights, the
   weapon glow and the shield -- each an rlëD or rlë8 of that id or a PICT
   sheet with a mask; in the four releases every one is an rlëD
   (utilities/ships_check.mjs counts them). The base holds
   BaseSetCount sets of FramesPer frames; frame 0 points up and the frames
   go round clockwise (seen in the frames; ResForge's Shan Editor turns its
   exit points the same way). The glow and lights have one frame for each
   of the base's, as the Bible says they must, or only FramesPer: fifteen
   stock ships, the Argosies and Manticores, fly several sets of base over
   one set of glow, drawn at the heading's frame. The shield has 1,
   FramesPer or BaseSetCount x FramesPer.
   What the extra sets are for is Flags' low four bits, one mode at a time.

   GENERIC TO EV NOVA, NO DOM. LOAD ORDER: after nova-records.js and
   nova-sprites.js. */

const NOVA_SHIP_FLAGS = [
  [0x0001, 'Slow jumping (75%)'], [0x0002, 'Semi-fast jumping (125%)'], [0x0004, 'Fast jumping (150%)'],
  [0x0008, 'The player\'s ship regenerates fuel'], [0x0010, 'Disabled at 10% armour, not 33%'],
  [0x0020, 'Afterburner at an advanced combat rating'], [0x0040, 'Always has an afterburner (AI ships)'],
  [0x0100, 'Target display shows armour %'], [0x0200, 'No armour or shield state on the status display'],
  [0x0400, 'Planet-type: hit only by planet-type weapons'],
  [0x1000, 'Turrets blind to the front'], [0x2000, 'Turrets blind to the sides'], [0x4000, 'Turrets blind to the rear'],
  [0x8000, 'Escape ship: ejecting leaves in one'],
];
const NOVA_SHIP_FLAGS2 = [
  [0x0001, 'Swarms'], [0x0002, 'Prefers standoff attacks'], [0x0004, 'Cannot be targeted'],
  [0x0008, 'Point defence fires on it'], [0x0010, 'No fighter voices'], [0x0020, 'Jumps without slowing down'],
  [0x0040, 'Inertialess'], [0x0080, 'Runs away or docks when out of ammunition'],
  [0x0100, 'Cloaks in burst reload'], [0x0200, 'Cloaks when running away'], [0x0400, 'Cloaks when jumping'],
  [0x0800, 'Cloaks when flying around'], [0x1000, 'Uncloaks only close to its target'],
  [0x2000, 'Cloaks when docking'], [0x4000, 'Cloaks when attacked first'],
];
const NOVA_SHIP_FLAGS3 = [
  [0x0001, 'Destroys asteroids'], [0x0002, 'Scoops asteroid debris'], [0x0010, 'Ignores gravity'],
  [0x0020, 'Ignores deadly stellars'], [0x0040, 'Turret shots drawn above the ship'],
  [0x0100, 'Hidden in the shipyard when Availability fails'], [0x0200, 'Hidden in the shipyard when Require fails'],
  [0x4000, 'Keeps higher-numbered ships of the same DispWeight out of the shipyard'],
];
const NOVA_SHAN_FLAGS = [
  [0x0001, 'Extra sets bank: level, left, right'], [0x0002, 'Extra sets fold and unfold'],
  [0x0004, 'Second set shown when not carrying its KeyCarried ships'], [0x0008, 'Extra sets play in sequence'],
  [0x0010, 'Stops animating when disabled'], [0x0020, 'Alternating image hidden when disabled'],
  [0x0040, 'Running lights hidden when disabled'], [0x0080, 'Unfolds to fire'],
  [0x0100, 'Frame chosen to correct off-axis rendering'],
];
const NOVA_AI_TYPES = { 1: 'Wimpy trader', 2: 'Brave trader', 3: 'Warship', 4: 'Interceptor' };
const NOVA_ESCORT_TYPES = { '-1': 'Worked out by the game', 0: 'Fighter', 1: 'Medium ship', 2: 'Warship', 3: 'Freighter' };

function novaShipDescId(id) { return 13000 + id - 128; }
function novaShipPilotDescId(id) { return 14000 + id - 128; }

/* The lowest-numbered ship with the same base sprites as ship `id`, which
   is itself when none comes before it. */
function novaShipSpriteOwner(game, id) {
  const own = novaGet(game, 'shän', id);
  if (!own) return id;
  for (const e of game.list('shän')) {
    if (e.id >= id) break;
    const b = game.get('shän', e.id).bytes;
    if (b.length >= 2 && i16be(b, 0) === own.BaseImageID) return e.id;
  }
  return id;
}

/* A ship's picture in the 3000 (target) or 5000 (beside its description)
   series: { id, from } with `from` the ship whose picture it is, or null
   when neither it nor the ship it shares sprites with has one. */
function novaShipPict(game, id, base) {
  const own = base + id - 128;
  if (game.has('PICT', own)) return { id: own, from: id };
  const owner = novaShipSpriteOwner(game, id);
  const theirs = base + owner - 128;
  return owner !== id && game.has('PICT', theirs) ? { id: theirs, from: owner } : null;
}

/* InherentGovt: the government a ship is of in combat, and the one whose
   attributes (voice, jamming) it takes; -1 each for none. */
function novaShipGovts(v) {
  if (v >= 128 && v <= 383) return { combat: v, attrs: v };
  if (v >= 1128 && v <= 1383) return { combat: -1, attrs: v - 1000 };
  if (v >= 2128 && v <= 2383) return { combat: v - 2000, attrs: -1 };
  return { combat: -1, attrs: -1 };
}

/* Days a hyperspace jump takes, by Mass: 1 below 100 tons, 2 below 200, 3
   from 200. Null for a mass of 0 or less, which the Bible does not cover. */
function novaShipJumpDays(mass) {
  return mass >= 200 ? 3 : mass >= 100 ? 2 : mass >= 1 ? 1 : null;
}

/* Stock weapons, both halves of the record: [{ id, count, ammo }]. An id or
   a count of 0 or less is no weapon. */
function novaShipWeapons(ship) {
  const out = [];
  for (const [t, c, a] of [['WeapType', 'WeapCount', 'AmmoLoad'], ['WeapType2', 'WeapCount2', 'AmmoLoad2']]) {
    (ship[t] || []).forEach((id, i) => {
      const count = ship[c][i];
      if (id > 0 && count > 0) out.push({ id, count, ammo: Math.max(0, ship[a][i]) });
    });
  }
  return out;
}

/* Default outfits, both halves: [{ id, count }]. */
function novaShipItems(ship) {
  const out = [];
  for (const [t, c] of [['DefaultItems', 'ItemCount'], ['DefaultItms2', 'ItemCount2']]) {
    (ship[t] || []).forEach((id, i) => { if (id >= 128) out.push({ id, count: ship[c][i] }); });
  }
  return out;
}

/* The stellars whose shipyard can sell the ship, by tech level alone: a
   shipyard (spöb Flags 0x08) whose TechLevel is the ship's or higher, or
   one of whose eight SpecialTech is exactly the ship's. Availability,
   Require and BuyRandom then decide on the day. `stellars` is an iterable
   of spöb records. */
function novaShipyards(stellars, ship) {
  const out = [];
  for (const sp of stellars) {
    if (!(sp.Flags & 0x08)) continue;
    const special = [...(sp.SpecialTech || []), ...(sp.SpecialTech4to8 || [])];
    if (sp.TechLevel >= ship.TechLevel || special.includes(ship.TechLevel)) out.push(sp.id);
  }
  return out;
}

/* The six sprites a shän names, as [{ layer, image, mask, w, h, sets }],
   those with an image id above 0 only. `sets` is how many sets of FramesPer
   the layer is read as: the base's BaseSetCount, the alternating image's
   AltSetCount, and for the rest as many as the base, the shield's settled
   by its frame count when drawn. */
const NOVA_SHAN_LAYERS = [
  ['base', 'Base', 'Base sprite'], ['alt', 'Alt', 'Alternating image'], ['glow', 'Glow', 'Engine glow'],
  ['light', 'Light', 'Running lights'], ['weap', 'Weap', 'Weapon glow'], ['shield', 'Shield', 'Shield'],
];
function novaShanLayers(shan) {
  const out = [];
  for (const [layer, k, label] of NOVA_SHAN_LAYERS) {
    const image = layer === 'shield' ? shan.ShieldImgID : shan[k + 'ImageID'];
    if (!(image > 0)) continue;
    out.push({
      layer, label, image, mask: shan[k + 'MaskID'], w: shan[k + 'XSize'], h: shan[k + 'YSize'],
      sets: layer === 'base' ? shan.BaseSetCount : layer === 'alt' ? shan.AltSetCount : shan.BaseSetCount,
    });
  }
  return out;
}

/* A sprite by id, ready to draw a frame at a time: an rlëD, else an rlë8,
   as { kind: 'rle', id, type, width, height, count, frame(f) -> RGBA };
   { kind: 'pict', id } when the id is a PICT sheet, which the page draws;
   { kind: 'missing', id } when these files have neither; and { kind:
   'bad', id, error } for one that does not read. */
function novaShipSprite(game, id) {
  const r = game.get('rlëD', id) || game.get('rlë8', id);
  if (r) {
    try {
      const ix = novaRleIndex(r.bytes);
      return { kind: 'rle', id, type: r.type, width: ix.header.width, height: ix.header.height, count: ix.header.frames,
               frame: f => novaDecodeRleFrame(r.bytes, ix, f) };
    } catch (e) {
      return { kind: 'bad', id, error: e.message };
    }
  }
  return { kind: game.has('PICT', id) ? 'pict' : 'missing', id };
}

/* The frame of a layer to show for a heading (in frames, 0 up, clockwise)
   and a set, wrapped to what the sprite has: a layer with fewer frames
   than the base, like a one-frame shield, repeats. */
function novaShipFrameIndex(framesPer, heading, set, count) {
  const f = ((set * framesPer) + (((heading % framesPer) + framesPer) % framesPer));
  return count ? f % count : f;
}
