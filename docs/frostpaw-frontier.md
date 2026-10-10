# Dora & Enzo's Arcade · Frostpaw Frontier

A tile-by-tile survival builder in the style of Tiles Survive. Winter is coming to the Andes, and Dora and Enzo lead a band of chinchillas out of the burrow onto a mountain hidden under cloud. Uncover it a tile at a time, put everyone to work, power the workshops with glow lanterns, recruit heroes, clear predator dens and hold the burrow against a raid every night. Clear the cougar from the summit and light the Summit Beacon to call the herd home.

The rules live in `lib/frontier-game.ts`, a deterministic engine with no browser dependencies: every random choice (the map, the raiders, where newcomers wait) comes from the seed, so a seed replays a run exactly. `lib/frontier-scene.ts` draws it, and `app/frontier/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/frontier`.

## The mountain

`makeMap(map, seed)` lays out a 13 × 13 grid (`W`, `H`) with the burrow in the middle (`HOME`, tile 6, 6).

- **Ground:** meadow, grove, rocks, snow and crag, in proportions set by each map (`MapDef.p`).
- **The first ring:** the eight tiles round the burrow are uncovered from the start. They always hold two groves, a rocky tile and five meadows, shuffled. A Hay Farm and a Twig Lodge stand on them, already staffed.
- **The summit:** a corner tile, one in from the edge, snowy, holding the **Cougar Lair**.
- **Dens:** each map's five dens (`MapDef.dens`), weakest nearest home: the weakest 2–3 tiles out, the strongest 4–7.
- **Ruins:** one per hero still to find (`MapDef.heroes`: Grandpa Pebble, Kiki and Luna in a map's own order), 2 to 6 tiles out.
- **Caches, strays and rumours:** six caches (25 hay; 30 wood; 20 stone; 20 hay and 20 wood; 25 wood and 15 stone; 30 hay and 10 stone), five lost chinchillas and five of the six rumours, 2 to 6 tiles out.
- **Checks:** a map is redrawn until there are at least three rocky tiles and three groves within three tiles of home, and the summit can be walked to round the crags.

## Exploring

`explore(x, y)` uncovers a cloudy tile next to (sharing a side with) a tile you hold. A held tile is uncovered and is not a crag or an uncleared den.

- **Cost:** 1 stamina, or 2 for snow (1 while Dora is fit). Stamina holds up to 10 (`STAMINA_MAX`) and a point comes back every 5 seconds (`STAMINA_EVERY`). A run starts with 6.
- **Cache:** collected at once.
- **Ruin:** its hero joins.
- **Rumour:** opens a choice (below). The game stops until you answer.
- **Lost chinchilla:** moves in if there's room. Otherwise it waits on its tile and moves in as soon as there is (a new nest, a bigger burrow).
- **Den:** stays where it is until your heroes clear it, and nothing can be explored past it.

## Buildings

`build(kind, x, y)` needs an uncovered, empty tile of the right ground, the burrow level and the cost. New buildings take idle survivors at once. `assign(id, ±1)` moves one in or out. Idle survivors fill short-handed jobs oldest building first, or farms first while the hay is running down.

| Building | Ground | Burrow | Cost (hay / wood / stone) | Workers | Does |
| --- | --- | --- | --- | --- | --- |
| Hay Farm | meadow | 1 | 0 / 20 / 0 | 2 | 0.5 hay a second |
| Twig Lodge | grove | 1 | 10 / 10 / 0 | 2 | 0.5 wood a second |
| Snug Nest | meadow | 1 | 0 / 25 / 0 | — | homes for 3 |
| Pebble Quarry | rocks | 2 | 10 / 30 / 0 | 2 | 0.35 stone a second |
| Glow Lantern | meadow, rocks | 2 | 0 / 40 / 20 | — | lights every tile within 2 (3 with Luna); burns 0.08 wood a second |
| Watchtower | meadow, rocks, snow | 2 | 0 / 30 / 30 | 1 | +15 defence while manned |
| Summit Beacon | the summit, once the cougar is gone | 4 | 100 / 200 / 150 | — | wins the run |

- Output scales with the workers present.
- A lit workshop works half as fast again (`LANTERN_BOOST`), and Kiki makes farms 30% better. Lanterns go dark when the wood runs out.
- A damaged building does nothing until it is repaired for half its cost.
- Pulling a building down gives half its cost back. A nest can't come down while someone needs the room.

## The burrow

The burrow starts at level 1 and rises to 4 for 40 hay and 60 wood, then 60 hay, 140 wood and 60 stone, then 120 hay, 220 wood and 140 stone (`HQ_COST`).

| Level | Homes | Walls | Defence |
| --- | --- | --- | --- |
| 1 | 4 | 60 | 8 |
| 2 | 6 | 100 | 16 |
| 3 | 8 | 140 | 24 |
| 4 | 10 | 180 | 32 |

- **Homes:** 4 + 2 for each level after the first, plus 3 for each nest.
- **Walls:** 60 + 40 for each level after the first. Raising the burrow restores them, and they mend half a point a second by day.
- **Defence:** 8 for each level.
- **Unlocks:** level 2 opens the quarry, lantern and watchtower; level 4 opens the beacon.

## Food and people

- **Eating:** each chinchilla eats 0.07 hay a second (`EAT`).
- **Hunger:** if the hay is gone for 20 seconds (`STARVE`), someone leaves, from the idle first.
- **Travellers:** a traveller settles at dawn if there's room and at least 30 hay (`ARRIVAL_HAY`).
- **Losing:** the run is lost if nobody is left.

## Day, night and raids

- **The clock:** a day is 50 seconds of daylight (`DAY`) and 16 of night (`NIGHT`).
- **Strength:** at nightfall a raid sets out, with strength `raidBase + raidGrow × (day − 1)^1.3`, plus each standing den's raid value (weasel 1, fox 2, owl 2, badger 3, cougar 3), plus anything a rumour added for tonight. The HUD shows the coming raid against your defence.
- **Defence:** 8 for each burrow level, 15 for each manned, undamaged watchtower, and half the power of every fit hero. Enzo adds 8 and Grandpa Pebble 12.
- **Where they come from:** the raiders set out from the dens you've uncovered and the edge of the cloud, and reach the burrow 8 seconds after nightfall (`RAID_AT`).
- **Held:** if the defence is at least the strength, the raid is held.
- **Broken in:** otherwise, with `gap` the difference, the raiders take up to `2 × gap` hay, `2 × gap` wood and `gap` stone, and knock `2 × gap` off the walls. If `gap` is 8 or more, they damage a random building.
- **Losing:** the run is lost when the walls reach 0.

## Heroes and dens

| Hero | Power | Perk | Found |
| --- | --- | --- | --- |
| Dora | 10 | snow costs her 1 stamina to cross | with you |
| Enzo | 14 | +8 night defence | with you |
| Grandpa Pebble | 8 | +12 night defence | a ruin |
| Kiki | 6 | hay farms make 30% more | a ruin |
| Luna | 12 | lanterns light one tile further | a ruin |

- **Power:** a hero's power grows 40% of its base with each level after the first, rounded.
- **Training:** costs `10 × level` hay, `30 × level` wood and `20 × level` stone. Heroes go up to level 5, and to no more than one level above the burrow.
- **Attacking:** `attack(x, y)` costs 2 stamina and sends every fit hero.
- **Winning:** if their combined power reaches the den's, the den is cleared. It pays its loot and the land past it opens. The Cougar Lair becomes the beacon site.
- **Losing:** otherwise every hero who went is hurt for 30 seconds (`HURT_TIME`). They can't fight or defend until they recover.

| Den | Power | Loot (hay / wood / stone) |
| --- | --- | --- |
| Weasel Hole | 12 | 20 / 20 / 0 |
| Fox Den | 24 | 30 / 30 / 15 |
| Owl Roost | 36 | 30 / 40 / 30 |
| Badger Sett | 52 | 40 / 50 / 45 |
| Cougar Lair | 80 | — |

## Rumours

| Rumour | First choice | Second choice |
| --- | --- | --- |
| A cry in the snow | bring the kit home: +1 chinchilla, tonight's raid +6 | 10 hay: uncover the 3 nearest cloudy tiles |
| A buried sled | 3 stamina: +60 wood | +20 wood |
| Clouds over the peaks | 30 wood: tonight's raid −10 | tonight's raid +5 |
| An old owl | 40 hay for 35 stone | nothing |
| Fresh pawprints | 4 stamina: +2 chinchillas | uncover the 3 nearest cloudy tiles |
| A warm spring | every hero healed, +3 stamina | +25 hay |

A choice you can't afford is greyed out.

## The mountains

| Map | Dens | Raids (`raidBase`, `raidGrow`) | Three stars by |
| --- | --- | --- | --- |
| Clover Valley | 2 weasels, 2 foxes, an owl | 5, 3.2 | day 15 |
| Salt Flats (more rocks, fewer trees) | weasel, fox, 2 owls, badger | 7, 3.9 | day 16 |
| Frost Summit (deep snow) | 2 foxes, owl, 2 badgers | 9, 4.6 | day 18 |

Lighting the beacon within four days of the three-star day earns two stars, and any later earns one. Winning a mountain opens the next.

## Balance

`tests/frontier-bot.mjs` plays whole runs with a steady settler. In priority order it:

- explores (towards the summit once the burrow is at level 3);
- moves workers to farms while the hay is falling, and to an empty quarry or watchtower when wood piles up;
- keeps the hay positive, builds nests for anyone waiting, and builds lodges and quarries;
- builds a watchtower when the next raid would get through, and a lantern over three or more workshops;
- raises the burrow, trains the strongest heroes with what's spare, clears every den its squad can beat, and lights the beacon.

It wins all 12 of its seeded runs (four per map), between day 13 and day 21. `npm test` asserts every map is won on seed 1, at least 10 of 12 overall, and that standing still loses. The settler is a strong player that never wastes stamina, so the star days are set a few days past its pace.

## Saves

The page keeps three things in `localStorage`:

- **`frostpaw-frontier-run-v1`**, the run in progress, as the JSON from `Game.snapshot()`. It covers the whole map, stock, people, buildings, heroes, the raid in progress, an unanswered rumour and the random generator's state, so a loaded run carries on exactly as it would have.
  - **When it's written:** every couple of seconds, on leaving and when the page is hidden.
  - **When it's dropped:** the moment a run is won or lost.
  - **Loading:** `Game.load()` checks every field. It returns null for a save that's broken, from another version (`SAVE_VERSION`) or impossible, for example a building on the wrong ground, two on one tile, more workers than jobs or more chinchillas than homes. The start screen then offers no **Continue**. A continued run starts paused.
- **`frostpaw-frontier-v1`**: the best stars on each mountain.
- **`frostpaw-frontier-sound-v1`**: whether the sound is on.

## Controls

- **Exploring:** click a cloudy tile next to your land to explore it.
- **The side panel:** clicking any tile shows what can be done there. Build, attack a den, move workers, repair or pull down a building. On the burrow, raise it and train heroes.
- **Building:** 1–7 pick a building from the toolbar, then click a tile. Right-click or Escape puts it down.
- **Keyboard:**
  - The arrow keys move the selection, and Enter explores, attacks or builds there. H selects the burrow and U raises it.
  - F cycles 1×, 2× and 3× speed. P, or Escape with nothing picked, pauses. M turns the sound off.
  - 1 or 2 answers a rumour.
- **Touch:** the first tap on a tile previews, and a second tap on the same tile explores or builds.
- **Pausing:** the game pauses when the window loses focus. **Save and leave** in the pause menu returns to the start screen.

## Drawing

- **The view:** the mountain is drawn from above, a 48-pixel tile at a time. The camera frames the land you hold and a ring of cloud round it, at least seven tiles across, and eases out as you explore.
- **Ground:** meadows have grass tufts and flowers, groves have swaying trees, rocks have boulders, snowfields have drifts, and crags have snow-capped peaks.
- **The cloud:** rolling puffs. The tiles you can explore are outlined, with a paw print.
- **Buildings:** each is drawn, with a dot for every job (gold when filled). Damaged ones are cracked and smoking. The burrow grows an arch, a chimney and a flag as it rises, with Dora and Enzo at the door.
- **Dens:** each shows its predator, drawn with the arcade's shared predator art, and a badge with its power: green when your squad can win, red when it can't.
- **Night:** the mountain darkens except for the lantern light and the burrow door. The raiders walk in from their dens, then slink off if the raid is held. A banner shows the raid against your defence.
- **Effects:** words float up for supplies, newcomers and damage, and bursts mark heroes and cleared dens.
