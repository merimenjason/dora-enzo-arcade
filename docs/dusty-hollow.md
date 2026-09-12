# Dusty Hollow

A cozy village-life game: Dora or Enzo moves into a seaside Andean hollow and the other chinchilla runs Burrow Works next door. Rules live in `lib/dusty-hollow-game.ts` (deterministic, no DOM), the Canvas 2D view in `lib/dusty-hollow-scene.ts`, and the page in `app/dusty-hollow/`. Numbers below come from the engine's constants.

## Clock

- `DAY` = 360 s of real time; `hour` = `clock / DAY × 24`. A new game starts at 08:00 on day 1.
- `DAYS_PER_SEASON` = 4, cycling spring, summer, autumn, winter. `year` counts 16-day loops.
- `isNight` is before 06:00 or from 19:00. The scene tints toward dusk from 17:00 and darkens fully by 21:00.
- `weather` hashes the seed and day with Mulberry32: about 28% of days are rainy, and rain falls as snow in winter. Rain shortens fishing waits, thins bug spawns and is the only time snails appear.
- Villagers are out from `WAKE` = 7 to `BEDTIME` = 22; Vito's Emporium is open `SHOP_OPEN` = 8 to `SHOP_CLOSE` = 22.
- Midnight or `sleep()` (only from inside the burrow) runs `newDay()`: fruit regrows, rocks reset, `FOSSILS_PER_DAY` = 3 fossils are reburied on free grass, watered flowers breed, bugs clear, and every neighbour draws a new request.

## Map

`makeTerrain()` is fixed: a 32×24 grid with cliffs on the north, east and west edges, a sea across the bottom three rows behind a strip of sand, a two-tile river down column 18 (shifting one tile east below row 12) with a bridge on the main street and another at row 18, and a 4×3 pond in the north-west. The main street is row `STREET_Y` = 11; every building's door tile sits on a path spur off it. `BUILDINGS` lists footprints and doors: your burrow, Burrow Works, Vito's Emporium, the Hollow Museum and four neighbour houses.

Trees (22), rocks (4) and flowers (14) are scattered from the seed on `freeGrass()` tiles, which excludes anything within one tile of a door or the street. Trees, rocks, buildings, cliffs and water are `solid()`; grass, path, sand and bridges are walkable. The hero moves at `WALK` = 3.2 or `RUN` = 5.4 tiles per second with a 0.3-tile collision box.

## The action button

`interact()` looks at the hero's `facingTile()` and resolves in this order: a neighbour in front (talk) → a door tile under the hero while facing up (enter) → a tree (shake) → a rock (shovel hits; otherwise a hint) → a bug near the tile with the net → water with the rod (cast; otherwise a hint) → a fossil crack with the shovel (dig; otherwise a hint) → a flower (watering can waters, bare paws pick, other tools hint) → free grass with the shovel (plant the selected seeds or fruit) → a message.

While `fishing` is set, the button reels instead: before `bite` opens it loses the cast, during the `BITE_WINDOW` = 0.9 s it lands a fish weighted by `rarity` from the species whose `habitat`, `seasons` and `time` match; letting the window pass loses the fish, and moving cancels the cast.

## Economy

| Source | Raisins |
| --- | --- |
| Native apple / foreign fruit | 100 / 500 |
| Base / hybrid flower | 40 / 400 |
| Money rock, hits 1–4 | 25, 50, 75, 100 |
| Fish | 100 (pond frog) to 7,000 (yellowfin tuna) |
| Bugs | 130 (cricket, moth) to 2,000 (stag beetle) |
| Fossils | 1,000 (fern) to 5,000 (dinosaur egg) |
| Request delivered | 300, or a foreign fruit half the time |
| Goals | 100 to 5,000 each, 11 in total |

Vito sells the shovel (600) and watering can (400), seeds (80 each) and a daily `stock` of three furniture pieces shuffled from `FURNITURE` by seed and day. Selling pays each item's `price`; `sellAll()` keeps seeds and furniture. Pockets hold `POCKETS` = 20.

The loan ladder `LOANS` = 4,800 → 19,800 → 49,800 moves the burrow through `HOME_NAMES` Tent, Cozy Burrow, Roomy Burrow and Grand Burrow, with `HOME_ROOM` = 2, 4, 6, 8 furniture slots. `pay()` takes whatever the hero has, up to the debt.

## Neighbours and friendship

`NEIGHBOURS` are Pia (flamingo, likes fish), Rodri (fox, fruit), Vivi (viscacha, flowers) and Tato (condor, bugs); the friend chinchilla is a fifth villager who never asks for anything. Each wanders one tile at a time along walkable ground during waking hours. Friendship runs 0 to `FRIEND_MAX` = 10 with `FRIEND_TITLES` from Stranger to Best friend: the first chat each day is +1, a gift +1 (+3 for their liked kind), a delivered request +3. Requests are drawn each morning, half the time for the neighbour's favourite kind.

## Flowers

`breedFlowers()` runs every new day. Each watered flower with a watered four-neighbour has a 45% chance to spawn a new flower on an adjacent free grass tile, taking a `HYBRIDS` colour half the time when the parents' pair is listed (red+yellow → orange, red+white → pink, white+yellow → purple, white+white → blue), otherwise one parent's colour. Watering wears off overnight. Hybrids count toward `stats.hybrids`.

## Saves

`save()` returns a `Save` (v1) with the seed, RNG state, clock, position, money, loan, tools, pockets, furniture, museum, friendship, requests, goals, trees, flowers, rocks, fossils, stats and the caught list; terrain and villager definitions are rebuilt. `Hollow.load()` restores it in the world view. The page writes it to `localStorage` under `dusty-hollow-save-v1` every 3 seconds and on quit.
