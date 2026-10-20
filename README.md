# StarGrimoire

Browser-based tools to explore the files of *Escape Velocity Nova* (2002), the
Mac space game by Ambrosia Software and ATMOS. A sibling of
[grimoire](https://github.com/ratlizard/grimoire), which does the same for
*Cythera*.

`index.html` is the universe map: open a copy of the game and it draws the
galaxy from the game's records — every system, hyperspace link, nebula and
government — then a system with its stellars, then a stellar you land on, with
its landing picture and descriptions. It reads Ambrosia's Mac releases (the
`.sit` archives of 1.0.2, 1.0.8 and 1.0.10, and 1.1.1's `.ndat` files), the
`.rez` files of the community's builds and plug-ins, and zips of them, or the
Internet Archive's copy of 1.0.10. It is at <https://e-z-g.github.io/stargrimoire/>,
and works opened straight from the disk too; there is no build step and
nothing to install.

StarGrimoire is written with Claude, Anthropic's AI model; each commit ends
with a link to its Claude session. Everything the page shows about the game
is read from the game's files and program; none of it is typed in. The checks
compare the code with sources outside this repository:

- each reader with another reader of the same files: ResForge's sprite
  decoder, pixel for pixel; a separate `.rez` reader in Python; The
  Unarchiver's tools for StuffIt archives; macOS's `hdiutil` for the disk
  image and Apple's decoder for the sounds;
- the record tables with Ambrosia's ResEdit templates, shipped with 1.0.10;
- the field notes with the game's program: every routine cited must be a
  function in the program, at the address given;
- the rules with the examples worked through in the EV Nova Bible.

`node utilities/check_all.mjs` runs the checks. They need the game's releases
in `reference/`, which is not published.
