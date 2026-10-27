# Pebble Pop

Game 44, at `/pebble`. A brick-breaker roguelite: Dora and Enzo hold up a hay bale at the bottom of the field and bounce a pebble into walls of crates, acorn piles, ice, dust clouds, moss and chain blocks. A run follows a branching trail of fifteen steps through four painted places, with shops, rest stops, tougher elite walls and three grumpy bosses, and after every wall you keep one of three upgrades. Crows and badgers peek out from behind the walls and grumble, but nothing is ever scary: bosses are "calmed down" and wander off.

## Files

| Part | File |
| --- | --- |
| Engine: the map, walls, physics, upgrades, shop, rest, saving | `lib/pebble-game.ts` |
| Scene: places, field, blocks, boss, bale and riders, pebbles, particles, shake (Canvas 2D) | `lib/pebble-scene.ts` |
| Sound: one short oscillator or noise puff per effect | `app/pebble/sound.ts` |
| Page: title, chinchilla choice, map, wall HUD, reward, shop, rest, pause, end | `app/pebble/page.tsx`, `app/pebble/pebble.css`, `app/pebble/layout.tsx` |
| Paintings (still to be painted; drawn stand-ins until then) | `public/art/pebble/`, described in [`pebble-pop-art-brief.md`](pebble-pop-art-brief.md) |
| Tests | `tests/pebble.mjs`, `tests/pebble-bot.mjs`, `tests/e2e/pebble.mjs` |

## The field and the pebble

The field is 360 × 540 units, scaled to fit the screen. The top of the bale is at y 500; the pebble has a radius of 5.

- **Physics** runs in fixed steps of 1/120 s. Each step the pebble moves along its path and stops at the first surface it meets (side walls, the top, the bale, any block or the boss), bounces, and carries on with the rest of the step, up to eight surfaces a step. Blocks are tested as boxes grown by the pebble's radius, so a fast pebble can never skip through a thin block. Anything that moves into the pebble (a sliding crate, a boss row, moss growing back) pushes it out and counts as a hit.
- **Angles off the bale:** where the pebble lands on the bale sets where it goes, from straight up in the middle to 62° off vertical at the very ends. The bale's own movement does not change the angle, so the aim is always readable.
- **No flat bounces:** after a bounce off a wall or block, at least 28% of the pebble's speed always goes up or down.
- **Speed:** 320 units a second, 2% faster for each step of the map after the first, and ramping 0.8% a second the longer a serve lasts, up to 50% faster. Losing a pebble starts the ramp again. Dora's pebble rolls at 92% speed; Lazy Breeze takes 8% off per stack.
- **Help when stuck:** if 15 s pass without touching a block you need (on a boss wall: without touching the boss), the pebble gently turns towards the nearest one at each bounce off the walls or the bale (never so far that it would fly flat), moss lets it through and stops growing back, and a boss stops rebuilding.

## Dora and Enzo

| | Bale width | Pebble speed | Special |
| --- | --- | --- | --- |
| **Dora** | 84 | 92% | A wide, gentle bale |
| **Enzo** | 64 | 100% | Spin shot |

**Enzo's spin:** hold Space, the mouse button, gamepad A or the on-screen SPIN button while the pebble comes down. The charge fills in 0.8 s and is spent on the next bale touch if it has reached a quarter; letting go before the touch loses it. The pebble then curves sideways (a pull of up to 560 units/s², fading with a 0.9 s time constant) towards the way the bale was moving, or back across if the bale was still, and hits for 1 more while the spin is strong.

## Blocks

Walls are an 11-column grid of 30 × 14 blocks, mirrored left to right, in one of eight shapes (full, checker, diamond, arches, stripes, pyramid, window, zigzag). They grow from 4 rows on step 1 to 10 on step 15 (`4 + floor(step × 0.45)`), two more on an elite, at most 12. Each wall is built from its own seed, so the choices you make never change a wall.

| Block | Hits | Points | Notes |
| --- | --- | --- | --- |
| Crate | 1 | 10 | |
| Stout crate | 2 | 20 | Badger Barn, elites |
| Acorn pile | 1 | 15 | Drops 3 acorns to catch on the bale |
| Ice block | 2 | 20 | Cracks on the first hit; from Frosty Ridge |
| Dust cloud | 1 | 5 | Soft: the pebble rolls through, poofs it and slows to 70%, recovering 35% a second |
| Moss | 1 | 5 | Not needed to clear the wall; grows back after 7 s |
| Chain block | 1 | 15 | Pops all eight neighbours 0.07 s later, and chains on |
| Sliding crate | 1 | 15 | From Pebble Creek: a row of its own, swaying a cell either side |

On elite walls 30% of crates and sliding crates take one more hit. Hits score their points times `1 + floor(combo / 5)`.

- **Combo:** block hits in a row before the pebble touches the bale. Every 10 earns 2 acorns (3 with Lucky Clover, 4 with two).
- **Acorns** fall at 150 units a second and are kept if they land on the bale; any still falling when a wall clears are caught for you.
- A wall is cleared when every block except moss is gone. Clearing pays acorns (wall `6 + step`, elite `14 + 2 × step`, boss `25 + step`, half again per Lucky Clover) and 100 points per step.

## Pebbles

A run starts with 3 pebbles (lives), up to 6. A pebble lost off the bottom costs one; with Split Pebble you only lose one when the last pebble of the serve is gone. A new pebble waits on the bale until you launch it.

## The trail

Fifteen steps, each with three lanes except step 1 and the boss steps, and paths only step one lane sideways.

| Steps | Place |
| --- | --- |
| 1–4 | The Meadow |
| 5–8 | Pebble Creek |
| 9–12 | Frosty Ridge |
| 13–15 | Badger Barn |

- Steps 1 and 2 are plain walls. Steps 4, 9 and 14 offer a rest stop, a shop and an elite wall; steps 6 and 11 have a shop in the middle lane. Other steps draw walls (weight 6), elites (2.2), shops (1.2) and rests (1), never two shops or two rests side by side.
- **Bosses** at steps 5, 10 and 15. Each sways side to side, carries rows of five blocks beneath it, and fills its lowest gap back in every few seconds. Hit the boss itself to calm it; calming it poofs its rows and gives back a pebble.

| Step | Boss | Calm | Rows | Sway | Rebuilds every |
| --- | --- | --- | --- | --- | --- |
| 5 | **Captain Caw**, a crow in a captain's hat | 12 | crates, crates | ±50 | 9 s |
| 10 | **Frostwhisker**, a frosty badger | 18 | ice, crates, ice | ±60 | 8 s |
| 15 | **Big Bramble**, the badger of Badger Barn | 26 | stout, chain, crates | ±70 | 7 s |

- **Shop:** three upgrades priced by rarity (common 28, uncommon 42, rare 60 acorns) and a berry snack that gives back a pebble for 20. Shaking the tree rerolls the upgrades for 8 acorns, 6 more each time.
- **Rest stop:** a nap fills every pebble (or, if you are already full, finds 10 acorns), or a snack adds one more pebble to carry, filled.
- **After a wall:** keep one of three different upgrades, or skip for 5 acorns. Elites lean towards uncommon and rare upgrades (×2.2), bosses even more (×3).

## Upgrades

Rarity weights: common 6, uncommon 3, rare 1.4.

| Upgrade | Rarity | Stacks | What it does |
| --- | --- | --- | --- |
| 🪨 Split Pebble | common | 3 | Each serve splits into 2 extra pebbles (+1 per extra stack) |
| 🌰 Burr Ball | uncommon | 3 | Rolls on through 2 blocks it pops (+2 per stack), refilled on each bale touch |
| ☃️ Snowball | uncommon | 2 | Grows 0.5 per hit up to 2.5 per stack; hits for 1 more at 2.5 and 2 more at 5 |
| 🧲 Acorn Magnet | common | 2 | Falling acorns drift to the bale; acorn piles drop 1 more |
| 🛡️ Dust Up Shield | common | 3 | Bounces the pebble off the floor once per wall per stack |
| 🌾 Wide Bale | common | 3 | The bale grows 14 wider |
| 🍯 Sticky Paws | uncommon | 1 | Catches the pebble; slide to aim, launch, or it lets go after 2 s |
| ✨ Spark | uncommon | 3 | Each popped block sends a spark (1 damage) to the nearest needed block, one per stack |
| 🍀 Lucky Clover | common | 2 | Half again as many acorns for clearing walls and for combos |
| 🥕 Hay Snack | uncommon | 2 | One more pebble to carry, and one back now |
| 🍃 Lazy Breeze | common | 2 | The pebble rolls 8% slower |
| 🌲 Pinecone Pop | rare | 2 | Every 8th hit (6th with two) bursts all blocks within 40 units |
| ☄️ Comet Tail | rare | 1 | With a combo of 5 or more, every hit does 1 more |

**Synergies**, shown on the cards and on the map when they switch on:

- **Snow Flurry** (Snowball + Split Pebble): split pebbles start half grown.
- **Thorn Sparks** (Spark + Burr Ball): sparks hit for 2.
- **Golden Harvest** (Acorn Magnet + Lucky Clover): every acorn you catch counts double.
- **Spin Catch** (Sticky Paws, Enzo only): caught pebbles leave with a full spin.

## Feel

Hits squash and flash the block and throw chips; pops hold the action still for 25 ms (45 ms for ice and stout crates, 50 for a chain, 60 for a pinecone burst, 70 for a boss hit, 120 for a clear). Chains, bursts, boss hits and lost pebbles shake the screen (Settings can turn shaking off). Block hits climb a pentatonic scale with the combo, and floating words call out combos, acorns and spins. A dotted line shows where a waiting pebble will go.

## Controls

- **Mouse:** move to steer the bale, click to launch; Enzo holds the button to charge a spin.
- **Touch:** drag anywhere to steer, tap to launch; Enzo holds the SPIN button.
- **Keys:** A / D or ← / → steer, Space launches (hold it to charge Enzo's spin), P or Esc pauses. Number keys pick on the map and in the reward, shop and rest screens.
- **Gamepad:** d-pad or left stick steers, A launches and charges, Start pauses.

## Saving

`localStorage` under `pebble-pop-v1`: the furthest step and best score, runs and wins for each chinchilla, every upgrade found (shown on the title screen), the chinchilla last chosen, sound and shake settings, and the run in progress. A run is saved each time it is back on the map (its seed, generator state, place on the map, pebbles, acorns, score and upgrades), so **Carry on** picks it up from the last map stop; leaving in the middle of a wall goes back to that stop. Anything broken or out of range in the save is read as a fresh profile or clamped.

## Tests

- `tests/pebble.mjs`: the map's shape, lanes, fixed stops and links, wall shapes and sizes for 25 seeds (no overlaps, sliding crates and boss rows clear of the sides), the swept collision (no pebble ever ends a step inside a block over many fast rallies), bale angles, keys and pointer, losing pebbles, every block type, combos, all thirteen upgrades and four synergies, Enzo's spin, the reward, shop and rest, a whole run to the win, bosses swaying and rebuilding, help when stuck, exact replays, and saving and carrying on a run.
- `tests/pebble-bot.mjs`: a seeded bot predicts where each pebble will cross the bale and angles it at the lowest block (or the boss), choosing paths, upgrades and shop buys. A careful bot (8 steps late, 5 units off, a whole bale off on 2.5% of touches) must win at least half its runs as Dora and 40% as Enzo; a sloppy bot (18 steps late, 19 units off, 3% lapses, on the keys, choosing at random) must win clearly fewer and get less far. No wall may take five minutes, and runs replay exactly. Sixteen seeds each: careful wins Dora 14, Enzo 16; sloppy wins Dora 4, Enzo 1.
- `tests/e2e/pebble.mjs`: the arcade card, choosing a chinchilla, the map, playing by keys, mouse and Space, pausing, the reward and save, carrying on a run, losing a run, and the phone layout with press and drag.

*Written 27-10-2026.*
