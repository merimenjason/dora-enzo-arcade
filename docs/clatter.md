# Clatterbox

A chain-reaction contraption puzzle at `/clatter`, game 70 of the arcade, in a new cardboard-craft art style. Dora and Enzo have built a tinkering box out of an old cardboard carton: shelves cut from cereal boxes, tape at every corner, a felt-pen sun on the wall. Each puzzle is a contraption with a few parts missing. Put the missing parts in, press Go, and watch it clatter: ring the bell, wake the hedgehog, feed the sparrow, light the lantern, toot the night train.

All numbers below come from `lib/clatter-physics.ts`, `lib/clatter-game.ts`, `lib/clatter-levels.ts`, `lib/clatter-scene.ts` and `app/clatter/page.tsx`. Written 01-11-2026.

## Files

- `lib/clatter-physics.ts`: a small deterministic 2D rigid-body world: circles, boxes and convex polygons, impulse contacts with friction and restitution, hinges, ropes and a pulley joint, sensors, a fixed step of 1/60 s and gravity 26 units/s². No randomness, so a layout always runs the same way.
- `lib/clatter-game.ts`: the parts (what each one is made of and what it does when touched), building a puzzle's world, where parts may go and snapping, a run from Go (goals, the bonus button, the end of a run, events for the sounds and marker words, the ghost trail and the camera's hot spot), stars, unlocking, the free build and the save.
- `lib/clatter-levels.ts`: the five rooms and thirty puzzles: each puzzle's fixed parts, build areas, tray, par, bonus button and designed solution, and the free build's empty box.
- `lib/clatter-scene.ts`: the drawing (Canvas 2D): the cardboard box, the parts, the faint ghost of the last run, the marker-pen sound words, the minimap, the neighbour audience, and Dora and Enzo as jointed cardboard puppets. It does not use the shared `drawChinchilla`.
- `app/clatter/page.tsx`, `clatter.css`, `sound.ts`, `layout.tsx`: the page (menu, rooms, puzzles, free build, Big Show, ending), input, saving and the HUD; synthesised clacks, boings and dings, and music for the menu, each room, the free build and the ending.
- `tests/clatter.mjs`, `tests/clatter-bot.mjs`, `tests/clatter-solutions.json`, `tests/e2e/clatter.mjs`: engine checks, the searching bot and its recorded solutions, and the browser suite.
- Paintings in `public/art/clatter/` (title, backdrop, ending), briefed in [`clatter-art-brief.md`](clatter-art-brief.md).

## The parts

A standard box is 12 × 7 units; the Big Show boards are 16 × 8 and the finale 24 × 9. Parts are placed in quarter-unit steps (`SNAP`), counted from each build area's edge.

- **Tray parts:** marble (heavy glass, rolls fast, hits hard), acorn (light; fans and bellows push it), domino (stands on end and topples into the next one), ramp and plank (turn in 15° steps), matchbox, seesaw (flip to swap ends), spring (anything landing on its pad leaves at 13 units/s straight out from the pad; turn it to aim), fan (blows light things along the way it points, reach 6 units, softer further away), bellows (puffs when something drops on it: a gust reaching 4.4 units), wind-up car (a bump sets it driving at 3.4 units/s for 7 s the way it faces), balloon (rises, can carry an acorn on its string, pops on a pin or a flame), pin, candle (burns through a string held in its flame for 0.45 s, pops balloons), scissors (a pendulum on a split pin that snips any string its blades pass through), funnel and bell.
- **Fixed parts:** shelves (taped down), trapdoors, the pulley (bucket and weight on one cord), strings, and the goals.
- **Goals:** the bell (rung by a real knock), the sleeping hedgehog (woken by a bump), the sparrow's bowl (an acorn or marble resting in it), the lantern (its switch pressed) and the night train (its whistle cord pulled). A puzzle is solved when every goal in it is met; the run then plays on for 2.6 s (`PAYOFF`) so the payoff is seen.
- A run ends as solved, as stuck (nothing has moved for 70 steps after the first 1.2 s) or out of time (16 s, 20 s for the finale).

## Placing parts

- Parts go only inside the dashed build areas, and never overlapping another part; a drop that would is refused with a reason ("Only in the dashed areas", "That would bump into something"). Standing parts (dominoes, matchboxes, cars, marbles, acorns, bellows, candles) settle down onto whatever is below them.
- While a hint glows, or the first puzzle's faint guide ramp shows, a part of that kind let go within 0.6 units of it lands exactly on it, turned like it.
- The tray shows how many of each part are left.

## Acorns, unlocking and the rooms

Each puzzle has three acorns: **solved**, **par parts** (solved using no more parts than par, the fewest the bot needed) and **the golden button** (something in the chain touches the bonus button on the way). The best of every run is kept. 30 puzzles × 3 = 90 acorns.

A puzzle opens when the one before it is solved, or the one two before (except each room's last puzzle). A room opens when the one before it is finished. Solving the first room's last puzzle opens the free build.

1. **The Kitchen Shelf**: marbles, ramps and dominoes among the jam jars (Breakfast Bell, Clack Clack, Seeds for the Sparrow, Down the Shelves, Acorn Relay, Breakfast Is Served).
2. **The Toy Box**: seesaws, springs and the wind-up car (Boing!, Seesaw Toss, Wind-Up Car, Car Jump, Clockwork Clacks, Toy Box Parade).
3. **The Garden Shed**: fans, bellows, balloons and pins (A Little Breeze, Pop!, Puff, Up and Away, Garden Clacks, Garden Party).
4. **The Attic**: strings, scissors, candles, trapdoors and the pulley (Snip!, Slow Burn, Going Down, Snip and Drop, Hot Wax, Attic Lights).
5. **The Big Show**: bigger boards and longer chains while the neighbours take their seats (Opening Act, The Long Drive, Balloon Ride, Snip, Fizz, Ding, Dress Rehearsal, and the finale **The Big Show**: ring the bell, light the lantern and toot the night train on one 24 × 9 board).

A puzzle that brings in a new part shows a short note about it first.

## Go, rewind and the ghost trail

Go runs the contraption; Rewind puts every part back where it was placed. The last run's path stays as a faint trail while you change things. Fast forward runs at three times speed. On the finale's big board the camera zooms in 1.45 times and follows the busiest moving thing, with a minimap of the whole board in the corner. Dora and Enzo watch from the sides of the box (from below it on an upright phone): they point and think while you build, lean in while it runs, wince at a near miss, and cheer when it works.

## The bot

`tests/clatter-bot.mjs` solves every puzzle from its starting layout by beam search, placing one tray part at a time on the same grid a player snaps to (ramps and planks turned through every 15° step up to ±60°, springs and fans aimed a few ways, cars and bellows facing both ways, standing parts settled), carrying the five most promising contraptions on to the next part. The fewest parts it needs must equal the puzzle's par. It also finds a layout that takes the golden button. Its layouts are written, rounded to three decimals, to `tests/clatter-solutions.json` and copied into the levels as each puzzle's solution, which is also where hints come from. A random tinkerer throws the tray parts anywhere 120 times a puzzle and must not solve puzzles with a par of three or more; the starting layout alone never solves a puzzle or takes the button. With `--quick` (as `npm test` runs it) the recorded layouts are replayed instead of searching.

## Controls

- **Mouse:** drag a part from the tray into a dashed area; drag a placed part to move it; click a part to choose it and the mouse wheel turns the chosen part. Or click a tray part and then click the box where it goes.
- **Keyboard:** **1**–**9** add that tray part somewhere free, **Tab** chooses the next part, the arrows nudge the chosen part a quarter unit (**Shift** for a whole unit), **Q** / **E** turn it, **F** flips it, **X** or **Delete** puts it back in the tray, **Space**, **Enter** or **G** is Go / Rewind, **.** toggles fast forward, **H** shows a hint, **Esc** deselects or pauses.
- **Touch:** drag parts from the tray (the part rides a little above the finger so it can be seen), drag placed parts, and use the buttons under the tray: ⟲ ⟳ turn, ⇋ flip, ↩ back to the tray, 💡 hint, ⏩ fast forward, and Go / Rewind. Phones work held either way.
- Sound and Music are toggles on the menu and the pause panel.

## The free build

An empty 16 × 8 box with no goals, a 30-second run, and a tray of every part met in the rooms opened so far (ten dominoes, four marbles, acorns and ramps, two of everything else). What is built is saved.

## The Big Show and the ending

Solving the finale opens the Big Show from its result card: the finale's contraption runs on stage while the neighbours (a hedgehog, a rabbit, a mouse, an owl and a badger, cut from card) watch from the front row and cheer. Then the ending painting with a short story of the evening, the acorn count and the credits. The Big Show can be replayed from the menu.

## Fitting the screen

The box is drawn as large as the space allows with Dora and Enzo beside it on wide screens and below it on tall ones. The top bar, the puzzle line, the tray and the result card are measured and the box fits in what is left, so nothing covers the box or the puppets. While the result card shows, the tray hides and the box stays in view above the card (beside it on a phone held sideways), so the payoff stays visible. Text scales up on screens 1600 × 900 and larger.

## Saving

Progress is saved in `localStorage` under `clatterbox-v1`: per puzzle whether it is solved, its acorns (as bits), the fewest parts used and the last layout; whether the first-puzzle guide has been seen; whether the ending has played; the free build; and the sound settings. A corrupt or unreadable save, or one with parts that make no sense, is ignored part by part rather than misread.
