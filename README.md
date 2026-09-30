# StarGrimoire

Browser-based tools to explore the files of *Escape Velocity Nova* (2002), the
Mac space game by Ambrosia Software and ATMOS. A sibling of
[grimoire](https://github.com/ratlizard/grimoire), which does the same for
*Cythera*.

`index.html` is the universe map: open a copy of the game and it draws the
galaxy from the game's own records — every system, hyperspace link, nebula and
government — then a system with its stellars, then a stellar you land on, with
its landing picture and descriptions. It reads Ambrosia's Mac releases (the
`.sit` archives of 1.0.2, 1.0.8 and 1.0.10, and 1.1.1's `.ndat` files), the
`.rez` files of the community's builds and plug-ins, and zips of them, or the
Internet Archive's copy of 1.0.10. It is at <https://e-z-g.github.io/stargrimoire/>,
and works opened straight from the disk too; there is no build step and
nothing to install.

`node utilities/check_all.mjs` runs the checks, which hold the readers to
sources that are not this repository. They need the game's releases in
`reference/`, which is not published.
