# Meadowmend

Game 56, at `/meadow`. A cosy hex tile-laying valley builder for one player. Winter is over and the valley below the burrow is patchy and bare; Dora and Enzo mend it one hexagonal tile at a time, while the neighbours (a bee, a hedgehog, a rabbit and a duck) make little wishes.

All numbers below come from `lib/meadow-game.ts`. Written 30-10-2026.

## Files

- `lib/meadow-game.ts`: the rules. Deterministic and DOM-free: the stack and the wishes come from two seeded generators kept in the game's state, so a seed and the same placements always give the same valley. It also holds the valleys, the tutorial, the snapshot used for undo and the saved run, the save format, and the helpers the hints and the bots use (`rotations`, `perfectSpots`).
- `lib/meadow-scene.ts`: Canvas 2D drawing: the bare valley floor, the tiles (pre-drawn once per cell), streams that flow, ponds with ducklings, critters in finished patches, wish flags, the ghost tile with its ticks and crosses, sparkles and pops, Dora and Enzo, the camera, and the stand-ins for the paintings and the valley cards.
- `app/meadow/page.tsx`, `layout.tsx`, `meadow.css` and `sound.ts`: the page. It handles the mouse, touch and keys, the loop, saving, the HUD (this tile, the next tile, the turn dots, the wish list) and WebAudio sound and music.
- `tests/meadow.mjs`, `tests/meadow-bot.mjs`, `tests/meadow-bot-policy.mjs` and `tests/e2e/meadow.mjs`: the tests.
- `docs/meadowmend-art-brief.md`: the art brief. The paintings live in `public/art/meadow/`.

## Tiles

Every tile is a pointy-top hexagon with six edges, each **meadow**, **woods**, **burrow-hill** or **stream**. Inside a tile, every stream edge meets in the middle (one stream), and each unbroken run of one land terrain round the rim is one patch, so a stream through the middle splits the land either side of it. A tile comes in one of ten shapes, turned at random: solid (one terrain), five and one, four and two, half and half, three pairs, split (two runs of one terrain either side of another), river (a stream straight through), bend, spring (one stream edge, with a pool in the middle) and fork (three stream edges). Each valley weighs the shapes and the land terrains differently.

## Placing

The current tile can go on any empty cell next to at least one tile (a rock alone is not enough), and inside the valley's edge where it has one. It can be turned to any of six positions. A placement is always allowed; what it earns depends on the edges:

- **Matching edges:** 10 points for every edge that matches the tile next to it.
- **Perfect:** a tile whose six sides are all filled and all match is Perfect: 60 points and **1 tile** added to the stack. A rock or the valley's edge never spoils a Perfect. Filling a neighbour's last open side can make that neighbour Perfect too.
- **Finished patches:** a land patch with no open side left (every edge faces a tile, a rock or the valley's edge) is finished: 5 points per tile if it covers at least 2 tiles, with critters moving in (bees and a butterfly in a meadow, a hedgehog and a bird in a woods, a rabbit in a burrow-hill).
- **Ponds:** a stream whose every end meets another stream is a pond: 12 points per tile and **1 tile** back, and a duck and her ducklings move in. A stream that runs into land, a rock or the valley's edge is no pond.
- **Wishes:** see below.

Undo takes back the last placement only (one step). The run ends when the stack is empty, or in a valley with an edge when there is no empty cell left.

## Wishes

When a tile comes into view (current or next), it may carry a wish: there is a 55% chance when fewer than 3 wishes are open or waiting, and at least 3 placements since the last one. The wish sits on one of the tile's edges and is about the patch (or stream) through that edge once it is placed:

| Who | Wants | At least | Exactly |
| --- | --- | --- | --- |
| 🐝 the bee | a meadow | 6 to 10 tiles | 3 to 6 tiles, finished |
| 🦔 the hedgehog | a woods | 5 to 9 tiles | 3 to 6 tiles, finished |
| 🐇 the rabbit | a burrow-hill | 4 to 7 tiles | 3 to 6 tiles, finished |
| 🦆 the duck | a stream | 4 to 7 tiles | never |

Sizes grow by one for every 12 placements so far (at most 6; half that for the exact wishes), and about a third of the land wishes are exact.

- **At least:** granted when the patch reaches the size: 8 points per tile of the size and **2 tiles**. The patch keeps counting as it grows: 4 more points for every tile past it. Spoiled if the patch is finished short of the size.
- **Exactly:** granted when the patch is finished at exactly the size: 12 points per tile of the size and **3 tiles**. Spoiled if the patch grows past the size or is finished short of it.

A wish is checked the moment its tile is placed, so setting a wish tile into a big patch that already meets it grants it at once (and spoils an exact one).

## Valleys

Each valley is a fixed deal (the same seed every time), so a valley can be replayed to do better. The next valley opens with an acorn in the one before it; the Endless Meadow and the Daily Valley open with the first acorn in Clover Hollow.

| # | Valley | What is special | Tiles | 🌰 acorns at |
| --- | --- | --- | --- | --- |
| 1 | Clover Hollow | An open meadow; mostly meadow tiles | 34 | 850 · 1650 · 2700 |
| 2 | Willow Brook | A brook of five tiles already runs across; more stream tiles | 34 | 900 · 1850 · 3200 |
| 3 | Old Oak Rise | A great old oak (a woods tile) in the middle; woods-heavy | 36 | 850 · 2150 · 4500 |
| 4 | Pebble Fields | Ten boulders in the grass | 36 | 1050 · 1950 · 3050 |
| 5 | Twin Ponds | Two springs four cells apart, facing away from each other across a strip of meadow | 36 | 1300 · 3300 · 7100 |
| 6 | Burrow Downs | A round valley with an edge (radius 5) and four rocks; hill-heavy | 34 | 1050 · 2650 · 5600 |
| 7 | Misty Fen | A three-way fork to start, four rocks, streams everywhere | 38 | 950 · 2150 · 4050 |

The acorn targets come from the bots (`npm run bot:meadow`): the first is about what a casual player gets (85% of the median of a bot that takes the best turn at four random cells), the third is 90% of the best of three styles of the smart bot, and the second sits between them.

**First Spring** is the tutorial: six meadow tiles round a hole, and a fixed stack of eight tiles that teaches turning, matching, the Perfect in the hole, a hedgehog's wish for a woods of 3, two springs that make a pond, and finished patches. The first two tiles have a glowing spot to aim for. It has no acorns; finishing it is saved.

The **Endless Meadow** starts from a single tile with a stream through it and a stack of 40, seeded fresh each run. The **Daily Valley** is the same, seeded from the local date (computed after the page mounts); its best is kept for that date.

When every valley has an acorn, the ending plays once (and can be watched again from the menu).

## Controls

- **Mouse:** move over a cell to see the ghost tile there; a click places it. **R** or **E**, the mouse wheel, or a right-click turns it clockwise; **Q** turns it back. Drag to pan; **Shift** (or **Ctrl**, or a trackpad pinch) with the wheel zooms.
- **Keys:** **WASD** or the arrow keys pan, **+** and **−** zoom, **F** frames the valley, **Z** (or **U** or **Backspace**) undoes, **Enter** or **Space** places at the cell under the pointer, **Esc** or **P** pause.
- **Touch:** a tap shows the ghost on a cell; a second tap on the same cell, or ✓, places it. Drag to pan and pinch to zoom. ⟳ and ⟲ turn the tile.
- **The panel:** the current tile (click to turn it), the next tile, six turn dots (the best turns at the hovered cell glow gold when Hints are on), turn, undo, frame and zoom buttons, and the open wishes with their progress.
- **Hints** (on by default, a toggle on the menu and pause panel): cells where some turn of the current tile would be Perfect shimmer gold, and the turn dots show the best turns.

The ghost shows a green tick on every edge that would match and a red cross on every edge that would not, with a pill above it: the points, any Perfect, tiles won, wishes granted or spoiled, and ponds.

## Dora and Enzo

They hop to each new tile (Enzo a beat behind), cheer a Perfect or a granted wish, go and sit by each new pond, and otherwise sit together. They are painted poses (walk, sit and cheer) once the paintings load, and the shared drawn chinchillas until then. On screen they are 1.15 hex radii tall but never less than 72 pixels (14% of the shorter side on small screens), so they read clearly however far the camera pulls back, and they turn see-through when the ghost tile is right behind them.

## The camera

The camera frames every tile and the empty cells round them inside the part of the screen the tile panel leaves clear, and eases to a new frame after each placement. Panning or zooming by hand stops that for 12 seconds; **F** (or ⌖) frames again.

## Saving

Progress is saved in `localStorage` under `meadow-v1`: best score, acorns and plays per valley, the tutorial, the Endless best, the Daily best for its date, running totals, settings (sound, music, hints), whether the ending has played, and the run in progress (a full snapshot after every placement, so a reload carries on exactly where it was). A save that does not parse, or has the wrong version, starts fresh; numbers are clamped, unknown valleys dropped, and a saved run that does not load cleanly is dropped.

## Sound

All WebAudio, made on the fly: a soft landing and a wooden pluck (higher with more matching edges), a chime per matching edge, a rising bell run for a Perfect, a warm chord for a finished patch, a splash and a quack for a pond, a jingle for a granted wish and a soft sigh for a spoiled one, a tick to turn, and a music-box flourish at the end. Under them a gentle pentatonic loop with birdsong (one for the menu, one for the valleys, a dusky one for the Endless Meadow and a golden one for the ending). Sound and Music are separate toggles.

## Tests

- `npm run test:meadow` (also in `npm test`): edges, patches and turning; seeded deals and exact replay (and no `Math.random`); legal cells, rocks and the valley's edge; matching; Perfects (rocks and the edge count, neighbours made Perfect); finished patches and ponds; wishes (at least, exactly, growing past, spoiled both ways, never more than three open); undo and snapshots (corrupt runs refused); the end of a run (an empty stack, a full valley); the tutorial's lesson in order; saves, acorns, unlocking, the ending and the daily best.
- `npm run bot:meadow` (with `--quick` in `npm test`): in every valley a naive bot (random cells and turns) stays below the first acorn, the greedy bot earns at least one and its stack lasts past its start with Perfects earned rather than every other tile; without `--quick`, the casual bot lands about the first acorn and the smart bot reaches three. Also checks the Endless Meadow.
- `npm run test:e2e:meadow` (needs `npm run dev`): the menu, First Spring with the real mouse (the ghost, turning by R, the wheel and a right-click, a click to place, the Perfect, undo), the run across a reload, the end-of-run panel, the valley list, corrupt saves, the framing at 1280×800 and 1920×1080 with Dora and Enzo a clear size and clear of the panel, and phones held either way (tap, tap again or ✓, ⟳).
