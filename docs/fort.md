# Pillow Fort

A physics stacking game at `/fort`, game 63 of the arcade, in a new needle-felt art style. A storm rattles the windows and Dora and Enzo build the greatest pillow fort the burrow has ever seen: tall, with a den under a blanket roof, and steady enough to stand till bedtime.

All numbers below come from `lib/fort-physics.ts`, `lib/fort-levels.ts`, `lib/fort-game.ts` and `app/fort/page.tsx`. Written 31-10-2026; the camera, the later nights' baskets, the dens and the pars revised 01-11-2026.

## Files

- `lib/fort-physics.ts`: the physics engine. Rigid bodies made of convex shapes (rounded boxes as chamfered polygons, circles, compound bodies such as the stool and the teapot), contacts with friction found by separating axes and clipping, a soft-step solver, spring links for cloth, a surface probe and cloning.
- `lib/fort-levels.ts`: the pieces, the four rooms and the twenty-four nights.
- `lib/fort-game.ts`: the rules. The basket, aiming, turning and dropping, landing, lost pieces, the den, the hazards, bedtime and the five-second check, stars, replays and the save.
- `lib/fort-scene.ts`: the drawing (Canvas 2D): the painted room, the rug, felted fabric pieces with stitched edges and a seeded felt texture, the blanket and the fairy lights, the lines, the den glow, the cat and the napping Enzo, the felted cut-outs of Dora and Enzo, puffs of fluff, lightning and the hold-your-breath slow-down.
- `app/fort/page.tsx`, `fort.css`, `sound.ts`, `layout.tsx`: the page (menu, nights, the fort, free build, ending), input, saving and the HUD; the sounds and the music-box tunes are made with Web Audio.
- `tests/fort.mjs`, `tests/fort-bot.mjs`, `tests/e2e/fort.mjs`: engine checks, the search and naive bots, and the browser suite.
- Paintings in `public/art/fort/`, briefed in [`fort-art-brief.md`](fort-art-brief.md).

## The physics

- A cushion is 1.6 units wide and the rug 8.4. Gravity is 18 units/s² downward. The world steps at a fixed 1/60 s, split into 6 substeps, each with 3 biased solver passes and 1 relaxing pass (the soft-step scheme): contacts are springs at 90 Hz with heavy damping, so pushes apart are firm but never explosive and stacks come to rest instead of jittering.
- Two-point contacts that land hard are solved together (a 2×2 block) so a flat piece lands flat instead of rocking. Contact impulses are warm-started from the last step by feature id, and the solve order alternates each pass.
- Soft pieces (cushions, pillows, floor cushions, partly bolsters and the duck) have no bounce and extra spin damping, so they land with a dead thump; the scene squashes them on landing.
- The blanket is 27 small linked beads (the fairy lights 18) with stretchy spring links and rotation locked, so it drapes over two pillars like cloth instead of rolling off.
- No `Math.random` anywhere: the drop wobble (up to ±0.06 units sideways) and the hazards come from a seeded generator kept in the game state, so a night replays exactly from its moves.

## The rules

- The rug runs from −4.2 to 4.2. Pieces hang above the top of the fort and drop when you let go; a new piece can drop 24 steps (0.4 s) after the last.
- A piece that ends up off the rug and down at the floor is lost: it is counted and removed.
- **Height** is the top of the highest landed piece. **Den** is the area under the fort, scanned in 0.1-unit columns over the rug: a column counts when the first thing above the floor is at least 0.8 up (room for a chinchilla), in runs at least 0.6 wide, each column counting up to 2.5 high.
- **Bedtime** (the button, or automatic once the basket is empty and the fort is still) starts the check: the fort has to stand for 300 steps (five seconds). Hazards may strike during it.
- **Stars:** the first for the height past the line (and the den, on den nights); the second for that plus the star line; the third for the first plus using no more pieces than par. Nights open one after another; each room opens when the last night of the room before is built.
- **Hazards:** the window draught pushes every piece sideways, harder the higher it sits; the cat creeps in every few pieces and pounces on the top piece, and comes back at bedtime; thunder shakes the floor a moment after the drop it is due on and again at bedtime; sleepy Enzo yawns after his piece number, flops onto the fort for a few seconds of nap and then gets up.
- Time slows to 0.4 while the top of a tall fort wobbles, and during the check when anything is moving.

## The view

All in `lib/fort-scene.ts`; the zoom is drawing only and never touches the physics.

- **Zoom and pan:** while building, each night is framed to its star line plus 2.2 units of headroom (at least 5.2 units), but never more than 5.8 units, so on a wide screen or a sideways phone the pieces are the same size every night, the tallest (Trunk tower, Encyclopaedias, The grand fort) included. Instead the camera pans up smoothly just enough to keep in view the piece hanging over the fort, the fort's top and the next line still to reach (with its label); the floor slides down out of view, and Dora and Enzo stay at the bottom edge, watching, with no more than a third of them cut off. At bedtime it eases back down and out to show the whole fort and the star line, and on the bedtime card it frames the fort that was built. Free build pans the same way instead of zooming out.
- **Wide screens:** the zoom also fits the rug with Dora and Enzo beside it, each 1.9 units tall (up to 2.6 on a tall night, when the height sets the zoom and leaves width spare), their fur on the fort side 0.3 past the rug's edge. The height lines span the rug, with their labels inside its right end. On a sideways phone the buttons stack down the right edge and the scene fits the space to their left.
- **Upright phones:** the rug fills the width and Dora and Enzo sit below it. The room painting only has to reach the rug, so more of it shows, and the slice is centred on each room's cosy corner (the rainy window, the round attic window, the library lamp and shelves, the treehouse lantern).
- **Bedtime card:** it stands beside the fort on wide screens and above it on upright ones. On wide screens the camera glides over to frame the fort that was built, with Dora and Enzo close beside it.
- **Felt:** a seeded 128-pixel felt tile (mottling, grain and curly fibres), drawn once offscreen, overlays every fabric at a fixed on-screen grain size and moves with each piece. Stuffed pieces are lit from above and shaded underneath, and their running stitches cast a faint shadow.

## The nights

`par` is the number of pieces the full search bot (`npm run bot:fort`, not `--quick`) used to stand past the star line. The dens on Rubber duck, Reading nook, The library ladder, The great library den and Duck storm are about 80% of the biggest den the bot could build there while standing past the line (2.84, 2.65, 4.79, 1.96 and 2.33), and those nights' lines were then set so the den and the star line can be had together. Every night after the living room is out of reach of a fort stacked straight up the middle: Draughty corner, The cat and Thunder put the round teapot early in the basket, where a middle tower trips over it (it belongs down on the rug, out of the way), and the den nights ask for a den too big to happen by accident. On Rubber duck, Reading nook and The great library den the bot needed the whole basket, so par is the basket.

| Night | Room | Name | Line | Den | Star line | Par | Hazards | Basket |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 `l1` | living room | First cushions | 2 | — | 3.5 | 6 | none | 7 pieces |
| 2 `l2` | living room | Story books | 2.6 | — | 3.8 | 8 | none | 9 pieces |
| 3 `l3` | living room | The bolster | 3 | — | 4.4 | 8 | none | 9 pieces |
| 4 `l4` | living room | A roof! | 1.6 | 1.5 | 2.6 | 9 | none | 9 pieces |
| 5 `l5` | living room | The wobbly stool | 2.4 | 1.5 | 3.5 | 10 | none | 10 pieces |
| 6 `l6` | living room | Sofa castle | 2.8 | 1.4 | 3.8 | 12 | none | 12 pieces |
| 7 `a1` | attic | Draughty corner | 3.2 | — | 4.4 | 8 | draught 0.6 | 11 pieces |
| 8 `a2` | attic | Tea party | 2.4 | 3.5 | 3.4 | 9 | draught 0.3 | 11 pieces |
| 9 `a3` | attic | Rubber duck | 2.6 | 2.2 | 3.1 | 12 | draught 0.5 | 12 pieces |
| 10 `a4` | attic | Under the eaves | 2.4 | 3.5 | 3.4 | 10 | draught 0.4 | 10 pieces |
| 11 `a5` | attic | Trunk tower | 4.2 | — | 5.4 | 10 | draught 0.6 | 13 pieces |
| 12 `a6` | attic | Attic hideout | 3 | 2.5 | 4.2 | 12 | draught 0.5 | 13 pieces |
| 13 `b1` | library | Book stacks | 3.8 | — | 4.2 | 12 | none | 12 pieces |
| 14 `b2` | library | The cat | 3.4 | — | 4.4 | 9 | cat every 3 | 12 pieces |
| 15 `b3` | library | Reading nook | 2 | 2 | 2.3 | 12 | cat every 5 | 12 pieces |
| 16 `b4` | library | Encyclopaedias | 4.2 | — | 5.2 | 11 | cat every 4 | 14 pieces |
| 17 `b5` | library | The library ladder | 3 | 3.8 | 4.1 | 14 | draught 0.3, cat every 3 | 14 pieces |
| 18 `b6` | library | The great library den | 3 | 1.6 | 3.5 | 15 | cat every 4 | 15 pieces |
| 19 `t1` | treehouse | Thunder | 3.4 | — | 4.4 | 8 | thunder every 3 | 12 pieces |
| 20 `t2` | treehouse | Sleepy Enzo | 2.6 | 2 | 3.3 | 11 | Enzo after 4 | 11 pieces |
| 21 `t3` | treehouse | Treetop tower | 3.8 | — | 4.4 | 14 | draught 0.4, thunder every 3 | 14 pieces |
| 22 `t4` | treehouse | Duck storm | 3 | 1.8 | 4.2 | 14 | cat every 4, thunder every 3 | 14 pieces |
| 23 `t5` | treehouse | Everything at once | 3.2 | 2.5 | 4.4 | 12 | draught 0.3, cat every 5, thunder every 4, Enzo after 6 | 15 pieces |
| 24 `t6` | treehouse | The grand fort | 4.4 | 3.5 | 5.6 | 16 | draught 0.3, cat every 6, thunder every 5, Enzo after 8 | 20 pieces |

The draught is a sideways push per unit of height (it gusts); "every N" counts drops; on cat and thunder nights the hazard also comes at bedtime.

## Bots

`npm run bot:fort` plays every night with a search bot, trying every spot (0.35 apart) and turn for each piece, scoring height, a flat top, the den and the pillars, and shaking the best eight candidates to prefer sturdy ones. Nights without a den are played twice (one plan spreads over the rug, one keeps building the tallest tower); den nights are played three times, building a pair of pillars before the blanket at ±1.25, ±1.55 and ±1.85 (the outer two accept a narrow top, so a cushion, a book or a bolster can stand on end as a pillar). The best play counts. It goes to bed as soon as the first two stars are in hand. On the last full run it took three stars on every night, using exactly par, and a naive bot that drops every piece in the middle, unturned, and goes to bed failed all 18 nights after the living room (the check allows one). `--measure` plays the whole basket chasing the biggest den (or height) that still stands past the line, which is how the den targets were set. `--quick` plays the first night of each room only, with a coarser search that may use up to three pieces over par (it needs 12 on Book stacks, par 9).
