# Companion icons

Eight individual background-free PNGs derived from the supplied icon sheet:

1. `ha-integration.png` — primary integration mark
2. `media-playback.png`
3. `movie-library.png`
4. `library-ha.png`
5. `cube-play.png`
6. `stacked-library.png`
7. `play-ha.png`
8. `film-reel.png`

`transparent-icon-set.png` preserves the edited source sheet. PNG alpha, rather
than a painted background/checkerboard, defines transparency. The integration
packages only the first mark's 256 px and 512 px copies under its `brand/`
folder. The 256 px icon is also copied to
`frontend/src/ui/assets/companion-icon.png` for the bundled desktop panel
header; keep that copy in sync when updating the primary mark. The
alternate/project source images are not deployed.
