# StarGrimoire

Browser-based tools to explore the files of *Escape Velocity Nova* (2002). The
game is a Mac space game by Ambrosia Software and ATMOS. StarGrimoire is a
sibling of [grimoire](https://github.com/ratlizard/grimoire). grimoire does the
same for *Cythera*.

`index.html` is the universe map. It draws every system, hyperspace link,
nebula, and government in the galaxy from the game's records. It then shows a
system with its stellars and a stellar with its landing picture and
descriptions. It reads Ambrosia's Mac releases. These are the `.sit` archives
of 1.0.2, 1.0.8, and 1.0.10 and the `.ndat` files of 1.1.1. It also reads the
`.rez` files of the community's builds and plug-ins, zips of those files, and
the Internet Archive's copy of 1.0.10. The site is at
<https://e-z-g.github.io/stargrimoire/>. It also works when opened straight
from the disk. It needs no build step and nothing to install.

StarGrimoire is written with Anthropic's AI model Claude. Each commit ends
with a link to its Claude session. Everything the page shows about the game
comes from the game's files and program. None of it is typed in. The checks
compare the code with these sources outside this repository.

- each reader with another reader of the same files (ResForge's sprite decoder
  pixel for pixel, a separate `.rez` reader in Python, The Unarchiver's tools
  for StuffIt archives, macOS's `hdiutil` for the disk image, and Apple's
  decoder for the sounds)
- the record tables with the ResEdit templates Ambrosia shipped with 1.0.10
- the field notes with the game's program (every routine cited must be a
  function in the program at the address given)
- the rules with the examples worked through in the EV Nova Bible

`node utilities/check_all.mjs` runs the checks. They need the game's releases
in `reference/`. That folder is not published.
