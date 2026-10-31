# Honeycomb Hollow

A hex match-3 puzzle adventure at `/honey`, in a new stained-glass art style. The bees of the hollow oak have lost the queen's honey map, and Dora and Enzo help them refill the comb chamber by chamber. Instead of swapping, you turn a trio of cells that meet at a corner.

All numbers below come from `lib/honey-game.ts`, `lib/honey-levels.ts`, `lib/honey-scene.ts` and `app/honey/page.tsx`. Written 31-10-2026.

## Files

- `lib/honey-game.ts`: the rules. The comb's shape (axial hex coordinates, neighbours, trios), turning, matching on three axes, specials and combos, gravity and the seeded refill, the obstacles, goals, stars, the honey rush, the reshuffle and the save. No DOM, no `Math.random`, no clock.
- `lib/honey-levels.ts`: the five areas, the sixty chamber maps, the move limits and star targets from the bot (`TUNE`), the tips and the story pages.
- `lib/honey-scene.ts`: the drawing (Canvas 2D): the area's window behind, the oak frame, leaded glass cells with a hammered-glass texture that fill gold from the bottom up, glass-jewel drops, bees, blossoms, royal jelly, wax, acorns, dew, wasps, moss and sticky glaze, the step playback, shards, sparks, beams, rings, words and the stained-glass cut-outs of Dora and Enzo.
- `app/honey/page.tsx`, `honey.css`, `sound.ts`, `layout.tsx`: the page (menu, the chamber map, the comb, story pages, tips, results, the ending), input, saving and the HUD; bell chimes and the glass music box are made with Web Audio.
- `tests/honey.mjs`, `tests/honey-bot.mjs`, `tests/e2e/honey.mjs`: engine checks, the random, greedy and look-ahead bots, and the browser suite.
- Paintings in `public/art/honey/`, briefed in [`honey-art-brief.md`](honey-art-brief.md).

## The comb

- Cells are flat-topped hexes in axial coordinates (q, r). A chamber's map is rows of characters with odd columns half a cell lower; every column is one unbroken run, so drops always have a way down. Boards run from 37 cells (a hexagon of radius 3) to 72 (nine columns of eight).
- Three cells that touch at a corner form a trio; a 7 × 7 comb has 72 of them. Turning a trio moves its three drops one place round the corner, clockwise or anticlockwise.
- Drops, acorns and dew drops can be turned. Wax, wasps and anything in a sticky cell can't.
- A turn that makes no match springs back and costs nothing. A turn that matches costs one turn. A trio holding two specials, or royal jelly beside a coloured drop, always fires.

## Matching and specials

- Three or more drops of one colour in a line along any of the comb's three axes (straight down, and the two diagonals) pop. Lines that share a drop pop together.
- Four in a line makes a **bee** that clears its whole line when it is matched. Two lines crossing (five drops or more, such as an L, a V or a triangle) make a **blossom** that clears every cell within two steps (19 cells) and lights dark comb. Five in a line makes **royal jelly**, which has no colour: turn it with drops and every drop of their colours pops; hit by a blast, it takes the commonest colour.
- The special lands on the drop you turned into the line, else where the lines cross, else mid-line.
- A **double turn** (two of the three turned drops each finish a line) scores 60 more; a **triple turn** scores 150 and adds a bee.
- Combos: bee + bee clears all three lines through both; bee + blossom does the same and lights; blossom + blossom clears three steps round both; jelly + bee turns every drop of the bee's colour into bees and fires them; jelly + blossom does the same with blossoms; jelly + jelly clears the whole comb.
- After a clear, drops fall straight down their columns; a cell under wax or a wasp fills by sliding in from the upper left or right. New drops are dealt at the top of each column from the chamber's seeded generator. Matches made by falling drops cascade; cascades are capped at 60 links (none comes close).

## Goals and obstacles

- Every chamber is won by filling every cell with honey: a cell turns gold when a drop on it pops. Some also ask for trapped bees, acorns, moss or dew.
- **Wax** (`w`, one hit; `W`, two) cracks when a match touches it or a blast reaches it. **Trapped bees** (`b`) are in thick wax and fly free when it breaks.
- **Sticky** cells (`s`) glue their drop: it can't be turned and doesn't fall. Popping it there washes the cell clean.
- **Acorns** (`a`) don't match and can't be blasted. They fall with the drops and roll out of the bottom of any column. More are dealt at the top until the chamber's count is reached (at most two on the comb at once).
- **Moss** (`m`) grows into a neighbouring cell after every turn that scrubs none; popping a drop on it scrubs it.
- **Dew drops** (`o`) swap with a random neighbouring drop after every turn and are caught by a match beside them or a blast.
- **Wasps** (`x`) hop onto a neighbouring drop after every turn (a gold cell first), eat it and lick the honey off the cell. A match beside one, or a blast, shoos it. Boxed in by wax, it stays put.
- **Dark comb** (`d`) takes no honey until a blossom's light (or a combo with one) reaches it.
- If no turn works, the plain drops are stirred until one does and nothing is matched.

## Score and stars

- Each popped drop scores 10 × its link in the cascade; specials fired 40; specials made 25, 50 or 100; combos 300; trapped bees 200; acorns 150; wasps and dew 50.
- Stars come from turns left when the comb is full: one for filling it, two and three at the chamber's targets (shown on the result card).
- The **honey rush**: each turn left over (up to ten) becomes a bee that zooms along a line, 120 points each; any more score 120 each.

## The chambers

Sixty chambers in five areas of twelve, each with a bee friend and ending with a set-piece chamber: the **Clover Hall** (Pip; turning, bees, blossoms, royal jelly, combos, wax, trapped bees; ends with *The Clover Crown*), the **Rose Arbour** (Rosa; acorns and sticky cells; *The Rose Window*), the **Lavender Loft** (Bumble; moss and dew; *The Lavender Loom*), the **Heather Attic** (Old Heath; wasps and dark comb; *The Heather Lantern*) and the **Queen's Chamber** (the queen; everything, seven colours; *The Queen's Map*). The first three areas and half the attic use six colours, the rest seven. A chamber opens when the one before is filled. Each new thing has a tip the first time it appears, and each area opens and closes with a few story pages.

Each try deals a different comb from the chamber's own seed (the chamber id hashed, plus 7919 per try), so a seed replays exactly.

## The view

- Wide screens sit Dora left of the comb facing right and Enzo right of it facing left, in the side columns; an upright phone puts the comb at the top and the pair below it. The comb takes the most room it can.
- The area's window fills the background, cropped to its middle (the window keeps flowers along all four edges, so an upright crop still shows them at the top and bottom), with a warm glow behind the comb.
- The pair react: thinking, delighted for cascades of two or more and new specials, wowed by combos, jelly, cascades of four and wins.
- The result card stands beside the comb on wide screens and above it on upright ones; the scene shrinks the comb to make room so the card covers neither the comb nor the pair.
- After eight idle seconds the corner of a working turn glows as a hint.

## Controls

- Mouse: point at a corner to light up its trio; click to turn it clockwise, right-click (or the wheel) to turn it anticlockwise.
- Keyboard: the arrows (or WASD) walk a cursor from corner to corner; X, E, Space or Enter turns clockwise, Z or Q anticlockwise; R restarts; Esc goes back to the map.
- Touch: tap a corner to turn it clockwise, or drag round the corner to turn it the way you drag.
- Tapping during a long cascade hurries it along.

## Bots

`tests/honey-bot.mjs` plays every chamber with three players: random (any turn that works), greedy (the turn that best moves the goals on, judged by goal cells left, acorn heights, wax and wasps) and look-ahead (the best four turns, each followed by the best reply; it guesses refills with a different seed so it can't peek). `--tune` plays each chamber sixteen times without a limit and sets the move limit to the look-ahead bot's 90th-percentile turns plus three, three stars at the turns it has left on its best quarter of games and two at its 70th percentile. The default run checks that the look-ahead bot clears every chamber at a healthy rate and that the random bot rarely clears the attic and the queen's chambers; `--quick` (in `npm test`) plays fewer seeds.

Save key: `honeycomb-hollow-v1` (best stars and score per chamber, tips and story pages seen, tries per chamber, the ending, sound and music).
