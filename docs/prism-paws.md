# Prism Paws

Game 50, at `/prism`. A light-beam puzzle game. The valley's Lantern Festival has gone dark. Moon windows shine beams of moonlight across a small night board, and Dora and Enzo steer them with mirrors, candy glass, crystal panes and prisms to relight every paper lantern, without waking the sleeping kits. Light mixes like real light, so a rose beam and a leaf beam meeting at a lantern glow honey.

There are 32 handmade levels in four chapters of eight. Every level is proven by a solver in the engine, which also sets each level's par and gives the hints.

## Files

- `lib/prism-paws-game.ts`: the engine. Rules, tracing, the solver, the levels, stars and saves. Deterministic, no DOM and no randomness.
- `lib/prism-paws-scene.ts`: Canvas 2D drawing only. Paintings from `public/art/prism/` when they have loaded, and a drawn stand-in for every one until then.
- `app/prism/page.tsx`, `app/prism/prism.css`, `app/prism/sound.ts`, `app/prism/layout.tsx`: the page, its styles, the generated sounds and the page title.
- `tests/prism-paws.mjs`: the engine checks. `tests/e2e/prism-paws.mjs`: the browser suite.
- `docs/prism-paws-art-brief.md`: the brief for the 23 paintings.

## The board

A board is at most 9 tiles wide and 7 tall. Directions are 0 east, 1 south, 2 west and 3 north. A beam travels from tile centre to tile centre in straight lines.

| Tile | Grid | Light | Pieces |
| --- | --- | --- | --- |
| Open grass | `.` | passes | yes |
| Rock | `#` | stops | no |
| Clover | `,` | passes | no |
| Moon window | `>` `v` `<` `^` | shines that way; stops light that hits it | no |
| Lantern | `r` `g` `b` `y` `p` `m` `w` | absorbs | no |
| Sleeping kit | `z` | absorbs, and wakes up | no |
| Firefly | `*` | passes, and catches the firefly | no |
| Burrow pair | `1` `2` | enters one end, leaves the other going the same way | no |
| Fixed mirror | `/` `\` | reflects; locked | no |
| Fixed mirror that turns | `[` `]` | reflects; starts `/` or `\` and the player may turn it | no |

Moon windows shine Moonwhite unless the level's `sources` list gives their colours in reading order. Other fixed pieces (panes, prisms, glass) come from the level's `fixed` list, each locked or turnable. Every level has exactly one firefly.

## Colours

Colours are a 3-bit mask and mix by OR, like light.

| Mask | Name | Made from | Lantern letter |
| --- | --- | --- | --- |
| 1 | Rose | | `r` |
| 2 | Leaf | | `g` |
| 4 | Sky | | `b` |
| 3 | Honey | rose + leaf | `y` |
| 5 | Plum | rose + sky | `p` |
| 6 | Mint | leaf + sky | `m` |
| 7 | Moonwhite | rose + leaf + sky | `w` |

A lantern is **lit** when the OR of every colour reaching it equals its colour exactly. Too much colour (Moonwhite on a Rose lantern) leaves it "too bright": the scene flickers it in the wrong tint with a little dazzle of white rays, and the status line says so. Too little (only rose on a Honey lantern) flickers it without the dazzle. Each lantern wears a tag split into the colours that mix to it.

## Pieces

| Piece | Tray | Light |
| --- | --- | --- |
| Mirror `/` or `\` | `mirror` | Reflects from both faces. `/` turns east to north, south to west, west to south and north to east; `\` turns east to south, south to east, west to north and north to west. |
| Crystal pane `/` or `\` | `splitter` | The beam goes straight through and also reflects as a mirror would. Two beams meeting at a pane mix and leave together both ways. |
| Candy glass | `rose`, `leaf`, `sky` | The beam goes on as `colour & glass`; if that is nothing, it stops. |
| Prism | `prism` | Splits a beam by its travel direction: rose turns left, leaf goes straight on, sky turns right. Colours not in the beam are not sent. |

The player places tray pieces on open grass, turns placed mirrors and panes (and fixed ones that turn), moves placed pieces, and picks them back up. Undo is unbounded, and reset clears the board (undo brings it back). Moves are free; only the number of tray pieces on the board counts.

## Tracing

`trace` follows every beam from every moon window, keeping a seen set over (tile, direction, colour), so loops end and beams leaving the board vanish. It returns the beam segments with their colours (for drawing), the colours each lantern receives, which lanterns are lit, which kits woke, whether the firefly is caught, and which tiles a beam reaches. The board is retraced after every change. The level is won when every lantern is lit and no kit is awake.

## Solver

`search` finds the fewest tray pieces that win, by iterative deepening, so its first solution is a smallest one. Fixed pieces that turn are tried both ways first.

- Pieces only go where a beam they would change already reaches. In a smallest solution every piece changes some beam, or the board without it would already win.
- `probe` follows the same light one tile per step in order of time, so each tile knows the first step each colour reaches it. Give each piece of a solution the first step a beam it changes arrives; adding pieces in that order, each sits on a beam of the board before it and changes nothing earlier. So the search only adds pieces in order of that step (then of tile), and reaches every smallest solution exactly once.
- Light that has arrived by the last piece's step can no longer change, so a kit already woken, or a lantern already given a colour it must not have, ends that branch at once.

`solveLevel` reports whether a level is solvable, its par and a smallest solution, and the same again while also catching the firefly. All 32 levels solve in under half a second in Node.

**Hints** are free and unlimited. When every placed piece belongs to the stored smallest solution, the hint is its next step. Otherwise the solver searches for a smallest solution that keeps the placed pieces (it may turn them). If none exists, the page says "Try picking a piece back up" and offers to clear the board and show the first piece of a fresh solution. The scene shows the hint as a pulsing ghost piece, or a glowing turn arrow.

## Stars

Each level gives up to three stars, and the best is kept:

1. Every lantern lit.
2. The firefly caught in the winning arrangement.
3. No more tray pieces on the board than par.

The win card shows what was missed ("Catch the firefly", "Par is N pieces"). The tests check that every level can earn all three at once: the firefly can always be caught at par.

## Levels

| # | Name | Chapter | Par | Tray |
| --- | --- | --- | --- | --- |
| 1 | First Light | Meadow Lanterns | 0 | none (turn the mirror) |
| 2 | Bend in the Path | Meadow Lanterns | 0 | none (turn two mirrors) |
| 3 | Pocket Mirror | Meadow Lanterns | 1 | 1 mirror |
| 4 | Stepping Stones | Meadow Lanterns | 2 | 2 mirrors |
| 5 | Tiptoe Around | Meadow Lanterns | 3 | 3 mirrors |
| 6 | Two Moons | Meadow Lanterns | 2 | 2 mirrors |
| 7 | Clover Maze | Meadow Lanterns | 4 | 5 mirrors |
| 8 | Meadow Lights | Meadow Lanterns | 3 | 4 mirrors, and a mirror to turn |
| 9 | Rose Window | Candy Glass | 1 | rose glass |
| 10 | Pick a Pane | Candy Glass | 3 | rose, leaf and sky glass |
| 11 | Tinted Corner | Candy Glass | 3 | 2 mirrors, sky and rose glass |
| 12 | Honey Mix | Candy Glass | 3 | mirror, rose and leaf glass |
| 13 | Too Bright | Candy Glass | 3 | mirror, rose, sky and leaf glass |
| 14 | Candy Shield | Candy Glass | 3 | mirror, sky and leaf glass |
| 15 | Night Market | Candy Glass | 4 | 3 mirrors, sky and rose glass |
| 16 | Candy Market | Candy Glass | 5 | 3 mirrors, rose and leaf glass |
| 17 | Crystal Pane | Crystal Grotto | 1 | crystal pane |
| 18 | Both Ways | Crystal Grotto | 3 | crystal pane, 2 mirrors |
| 19 | Rainbow | Crystal Grotto | 1 | prism |
| 20 | Prism Corners | Crystal Grotto | 3 | prism, 2 mirrors |
| 21 | Prism Honey | Crystal Grotto | 3 | prism, 2 mirrors |
| 22 | Split and Tint | Crystal Grotto | 4 | crystal pane, mirror, rose and sky glass |
| 23 | Crystal Crossing | Crystal Grotto | 3 | crystal pane, 2 mirrors |
| 24 | Grotto Glow | Crystal Grotto | 4 | prism, crystal pane, 2 mirrors |
| 25 | Burrow Run | Festival Night | 1 | mirror |
| 26 | Under the Hill | Festival Night | 2 | 2 mirrors |
| 27 | Two Tunnels | Festival Night | 3 | 3 mirrors |
| 28 | Kit Nursery | Festival Night | 3 | 2 mirrors, crystal pane |
| 29 | Rainbow Tunnel | Festival Night | 3 | prism, 2 mirrors |
| 30 | Mixing Burrow | Festival Night | 4 | 2 mirrors, rose and sky glass |
| 31 | Moon Garden | Festival Night | 4 | crystal pane, 2 mirrors, sky glass |
| 32 | The Grand Festival | Festival Night | 3 | crystal pane, 3 mirrors, and two fixed panes to turn |

Each chapter brings one idea at a time, with a one-line tip on the levels that introduce something: turning mirrors, then tray mirrors, rocks and clover, kits and two moon windows (Meadow Lanterns); candy glass, coloured moon windows, mixing at a lantern and glass as a blocker (Candy Glass); crystal panes, prisms and beams mixing at a pane (Crystal Grotto); burrows, then everything together (Festival Night). Some trays carry a spare piece. The grand finale lights seven lanterns, one of every colour, from rose, sky and leaf moon windows and a moonwhite one, through two locked prisms and two crystal panes to turn.

The obstacles on each generated board were pruned until every rock, clover tuft and kit that is left changes the puzzle: taking any one away would add solutions or lower par.

## Controls

- Drag a piece from the tray onto open grass, or tap a tray piece and then a tile.
- Tap a piece on the board to turn it. Fixed pieces carry brass rivets; the ones that turn also wear a gold arrow.
- Drag a placed piece to another tile to move it, or off the board to pick it up.
- Keys: **arrows** move a tile cursor, **1–9** pick a tray piece, **Enter** or **Space** place or turn, **Backspace** or **Delete** pick up, **Z** undo, **R** reset, **H** hint, **Esc** drops the chosen piece or goes back to the levels.
- Buttons: undo, reset, hint, sound and levels. On the win card, Enter goes to the next level (or, after the last one, to the Festival) and R replays. Enter or Space on a focused button presses that button.

The board scales to fit; on a wide screen the tray stands beside it, and on a phone it wraps below (or stands at the side when the phone is held sideways).

## Sound

Generated with WebAudio, no files: a chime for each lantern lit, pitched by its colour on a C major pentatonic scale; a soft click to place, turn or pick up; a sleepy "mrrp" when a kit wakes; a sparkle for the firefly; and a short arpeggio for a win. Nothing plays until the first tap or key, and the Sound switch is saved.

## Saving

`localStorage` key `prism-paws-v1` holds `{ v: 1, stars, solved, sound, level }`: the best stars and a solved flag per level id, the sound switch and the last level played. `readProfile` ignores a save from another version, clamps stars to 0–3, drops unknown levels and falls back to a fresh save on bad JSON. A level opens when the one before it is solved, so a chapter opens when the last level of the one before it is lit. With every level solved the menu shows **The Festival**.

## Tests

`npm run test:prism` compiles the engine into `.checks/` and runs `tests/prism-paws.mjs`: every piece's optics in every direction, colour mixing, the too-bright rule, glass as a blocker, kits, the firefly, rocks, clover, burrows and loops, that the drawing tracer and the solver's tracer agree, undo, reset, moving and picking up, hints (including the stuck case), stars, and saves (round trip, bad data and other versions). For every level it checks that it parses, is not won at the start, that the solver's par matches the listed par and fits the tray, that nothing wins with one piece fewer, that the firefly can be caught at par, that the solution wins three stars through the public actions, that no moon window shines straight into a lantern beside it, and that the names are unique. It prints a table of level, par, tray, firefly par and solve time.

`npm run test:e2e:prism` (with `npm run dev` running) opens the game from the arcade card, checks the level list opens one level at a time, lights level 1 with a tap, level 2 with the arrow keys and Enter, and level 3 by dragging a mirror from the tray, checks replay, undo, hints and picking up, the win card and the save, then plays the grand finale by taps on a phone held upright and sideways with no sideways scrolling, and checks there are no page errors. The page exposes `window.__prism()` (the running game), `window.__prismScene()` and `window.__prismStart(i)` for it, and marks `main[data-ready="true"]` once it can draw.
