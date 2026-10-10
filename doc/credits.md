# What StarGrimoire is built from

Listed on 28 September 2026 so that a fuller credits section, which the
maintainer wants later, starts from it. Since 10 October 2026 the page has
one: the name in the bar opens Credits, which names the game's crew as its
documentation does (`EV Nova Documentation.pdf`, page 3, "The crew behind
the scenes") and what follows here. `NOTICE` names Ambrosia and ATMOS,
grimoire and ResForge. These are the sources
of what is built. The sources used only to check it (the ConText dump in
evnova-utils, ResForge's sprite decoder, headless Chrome) are in `CLAUDE.md`
§ What plays delvmod's part.

## Information

- **Ambrosia Software and ATMOS**: the game's files, which give every record,
  sprite, picture and text shown, and the Mac 1.0.10 program's code, read for
  the rules the Bible leaves out (the shipyard picture, names cut at a
  semicolon, landing pictures, defence fleets, hailing).
- **The EV Nova Resource Bible**, "by Matt Burch, ©1995-2004 by Ambrosia
  Software, Inc.", in the copy "Reformatted by ReinierK, August 9th, 2007"
  (`reference/game/EV_Nova_Bible.pdf`): field meanings, units, id ranges,
  flags and rules.
- **Ambrosia's ResEdit templates**, in 1.0.10's `Documentation` folder: the
  order and width of every field in `js/nova-records.js`.
- **ResForge**, Andrew Simmonds (`andrews05/ResForge`, MIT): how the ships
  view blends a shän's layers, since the Bible does not say. No code copied.
- **The subway map's method**, from three papers, no code taken: stress
  majorization (Gansner, Koren and North, "Graph drawing by stress
  majorization", Graph Drawing 2004) to even out the distances; hill
  climbing over weighed criteria (Stott, Rodgers, Martinez-Ovando and
  Walker, "Automatic metro map layout using multicriteria optimization",
  IEEE TVCG, 2011) to put the systems on a grid; and routing on an
  octilinear grid with its bend costs, link order and local search (Bast,
  Brosi and Storandt, "Metro maps on octilinear grid graphs", EuroVis
  2020).
- **Names at every zoom**, from two papers, no code taken: the rules a
  name must keep as the map is zoomed (Been, Daiches and Yap, "Dynamic map
  labeling", IEEE TVCG, 2006), and each name's one range of zooms given
  in order of importance (Been, Nöllenburg, Poon and Wolff, "Optimizing
  active ranges for consistent dynamic map labeling", Computational
  Geometry, 2010); and on the map that keeps each link's heading, names
  put greedily and then moved while that helps (Christensen, Marks and
  Shieber, "An empirical study of algorithms for point-feature label
  placement", ACM TOG, 1995).
- **turbo** (Anton Mikhailov, Google, 2019), the colour scale for jumps,
  in the polynomial fit `d3-scale-chromatic` gives it (ISC).
- **The maintainer**: the release files, from the Macintosh Garden, and
  1.1.1's files, copied off its disk image.

## Code

- **grimoire** (`ratlizard/grimoire`): the `js/mac-*` readers, copied, and the
  PowerPC decoder (`js/mac-ppc.js` there) used to read the program. Within the
  readers: StuffIt's layouts and methods 13 and 15 are ported from Ben
  Letchford's `stuffit-rs` (MIT or Apache-2.0), which descends from The
  Unarchiver's; the PICT reader's opcode table is from Apple's "PICT File
  Format Notes" (1990); the 8-bit colours are Apple's standard palette.
- **cythera-workbench**: `tools/pefreloc_nova.py`, copied from its Cythera
  tool.
- **Drydock**, geuis (`geuis/drydock`, MIT): what each control bit is for,
  in `js/nova-bits.js`, ported from its StoryFlagCatalog and
  NCBSetExpression (29 September 2026): which records' expressions to
  read, how a test's negations and a set's random choices count, and a
  bit's name from what sets it.
- **pypdf**: the Bible's text, taken out of the PDF.
- **evnova-decomp**, Lancelot de Ferrière (`wraitii/evnova-decomp`): the
  Community Edition's function names, by which its program was read beside
  Mac 1.1.1's (`tools/exenames.py` in the workbench). No code copied.
- Everything else -- the `nova-*` readers, the sprite decoder (written from
  the bytes), the map and the ships view -- was written by Claude in the
  StarGrimoire sessions, at the maintainer's direction.
