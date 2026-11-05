# What StarGrimoire Is Built From

This list began on 28 September 2026 as the basis for a fuller credits section
that the maintainer planned. The page has had that section since 10 October
2026. The name in the bar opens Credits. Credits gives the game's crew as its
documentation does (`EV Nova Documentation.pdf` page 3 under "The crew behind the
scenes") and then what is below. `NOTICE` names Ambrosia and ATMOS, grimoire,
and ResForge. These are the sources of what is built. The sources used only to
check it are in `CLAUDE.md` § What plays delvmod's part. They are the ConText
dump in evnova-utils, ResForge's sprite decoder, and headless Chrome.

## Information

- **Ambrosia Software and ATMOS.** The game's files give every record, sprite,
  picture, and text shown. StarGrimoire reads the Mac 1.0.10 program's code for
  the rules the Bible leaves out. These are the shipyard picture, names cut at
  a semicolon, landing pictures, defense fleets, and hailing.
- **The EV Nova Resource Bible** "by Matt Burch, ©1995-2004 by Ambrosia
  Software, Inc." in the copy "Reformatted by ReinierK, August 9th, 2007"
  (`reference/game/EV_Nova_Bible.pdf`). It gives field meanings, units, id
  ranges, flags, and rules.
- **Ambrosia's ResEdit templates** in 1.0.10's `Documentation` folder. They
  give the order and width of every field in `js/nova-records.js`.
- **ResForge** by Andrew Simmonds (`andrews05/ResForge` under the MIT license).
  The Bible does not say how to blend a shän's layers. The ships view blends
  them as ResForge does. No code is copied.
- **The subway map's method.** It comes from three papers. No code is taken
  from them.
  - Stress majorization evens out the distances. Gansner, Koren, and North.
    "Graph drawing by stress majorization". Graph Drawing 2004.
  - Hill climbing over weighted criteria puts the systems on a grid. Stott,
    Rodgers, Martinez-Ovando, and Walker. "Automatic metro map layout using
    multicriteria optimization". IEEE TVCG 2011.
  - Routing on an octilinear grid gives the bend costs, link order, and local
    search. Bast, Brosi, and Storandt. "Metro maps on octilinear grid graphs".
    EuroVis 2020.
- **Names at every zoom.** They come from two papers and from a third on the
  map with headings kept. No code is taken from them.
  - The rules a name must follow as the map is zoomed. Been, Daiches, and Yap.
    "Dynamic map labeling". IEEE TVCG 2006.
  - The names receive one range of zooms each in order of importance. Been,
    Nöllenburg, Poon, and Wolff. "Optimizing active ranges for consistent
    dynamic map labeling". Computational Geometry 2010.
  - On the map with headings kept the names are put greedily and then moved
    while that helps. Christensen, Marks, and Shieber. "An empirical study of
    algorithms for point-feature label placement". ACM TOG 1995.
- **Storyline charts.** They come from a paper. No code is taken from it. Rows
  follow the longest path, loops are cut, and each row is ordered by its
  neighbors' mean place. Sugiyama, Tagawa, and Toda. "Methods for visual
  understanding of hierarchical system structures". IEEE Transactions on
  Systems, Man, and Cybernetics 1981.
- **turbo** by Anton Mikhailov of Google (2019). It is the color scale for
  jumps. StarGrimoire uses the polynomial fit from `d3-scale-chromatic` (ISC).
- **The maintainer.** The maintainer gave the release files from the Macintosh
  Garden and 1.1.1's files copied off its disk image.

## Code

- **grimoire** (`ratlizard/grimoire`). The `js/mac-*` readers are copied from
  grimoire. So is the PowerPC decoder that reads the program (`js/mac-ppc.js`
  there). Within the readers StuffIt's layouts and methods 13 and 15 are ported
  from Ben Letchford's `stuffit-rs` (MIT or Apache-2.0). `stuffit-rs` descends
  from The Unarchiver's. The PICT reader's opcode table is from Apple's "PICT
  File Format Notes" (1990). The 8-bit colors are Apple's standard palette.
- **cythera-workbench.** `tools/pefreloc_nova.py` is copied from its Cythera
  tool.
- **pypdf** extracts the Bible's text from the PDF.
- **evnova-decomp** by Lancelot de Ferrière (`wraitii/evnova-decomp`). Its
  function names for the Community Edition helped read that program alongside
  Mac 1.1.1's (`tools/exenames.py` in the workbench). No code is copied.
- Claude wrote everything else in the StarGrimoire sessions at the
  maintainer's direction. This includes the `nova-*` readers, the sprite
  decoder (written from the bytes), the map, and the ships view.
