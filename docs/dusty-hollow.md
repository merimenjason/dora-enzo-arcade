# Dusty Hollow

A cozy village-life game: Dora or Enzo moves into a seaside Andean hollow and the other chinchilla runs Burrow Works next door. Rules live in `lib/dusty-hollow-game.ts` (deterministic, no DOM), the Canvas 2D view in `lib/dusty-hollow-scene.ts`, procedural sound in `app/dusty-hollow/sound.ts`, and the page in `app/dusty-hollow/`. Numbers below come from the engine's constants.

## Clock

- `DAY` = 360 s of real time; `hour` = `clock / DAY × 24`. A new game starts at 08:00 on day 1.
- `DAYS_PER_SEASON` = 4, cycling spring, summer, autumn, winter. `YEAR` = 16 days; `dayOfYear` drives birthdays.
- `isNight` is before 06:00 or from 19:00. The scene tints toward dusk from 17:00 and darkens fully by 21:00.
- `weather` hashes the seed and day with Mulberry32: about 28% of days are rainy, and rain falls as snow in winter. Rain shortens fishing waits, thins bug spawns and is the only time snails appear.
- Villagers are out from `WAKE` = 7 to `BEDTIME` = 22; Vito's Emporium is open `SHOP_OPEN` = 8 to `SHOP_CLOSE` = 22.
- Midnight or `sleep()` (only from inside the burrow) runs `newDay()`: the festival settles, fruit regrows, rocks reset, `FOSSILS_PER_DAY` = 3 fossils and `SHELLS_PER_DAY` = 3 shells are laid out, watered flowers breed, bugs and snowmen clear, wishes pay out and every resident draws a new request.
- **Live mode.** `setLive(true)` / `syncLive(date)` set the clock from the real time of day, take the season from the real month (southern hemisphere: December to February is summer), and run `newDay()` when the calendar date changes. `sleep()` is refused in live mode.

## Map

`makeTerrain()` is fixed: a 32×24 grid with cliffs on the north, east and west edges, a sea across the bottom three rows behind a strip of sand, a two-tile river down column 18 (shifting one tile east below row 12) with a bridge on the main street and another at row 18, and a 4×3 pond in the north-west. The main street is row `STREET_Y` = 11; every building's door tile sits on a path spur off it. `BUILDINGS` lists footprints and doors: your burrow, Burrow Works, Vito's Emporium, the Hollow Museum and six neighbour houses, two of which (`house-lupe`, `house-nico`) are empty plots until their owners arrive. The notice board stands on `BOARD` = (12, 10).

Trees (22), rocks (4) and flowers (14) are scattered from the seed on `freeGrass()` tiles, which excludes anything within one tile of a door or the street. Trees, rocks, buildings, cliffs, water, the board and snowmen are `solid()`; grass, path, sand and bridges are walkable. The hero moves at `WALK` = 3.2 or `RUN` = 5.4 tiles per second with a 0.3-tile collision box.

## The action button

`peek()` reports what the hero faces and what the button will do; the page shows it under the map. `interact()` resolves in this order: a resident in front (talk) → a door tile under the hero while facing up (enter) → the notice board (read) → a tree (shake) → a rock (shovel hits) → a snowball (roll, bare paws) → a bug near the tile (net) → water (cast) → a fossil crack (dig) → a shell (pick up) → a flower (water with the can, pick bare-pawed) → free grass with the shovel (plant the selected seeds or fruit) → a shooting star (wish) → a message. Where a tool is needed and owned, `need()` swaps to it automatically and fires the `swap` cue.

Effects (`fx`) and reactions (`react`) are cosmetic lists the engine ages and the scene draws: fruit and leaves on a shake, dirt on a dig, a splash on a cast or catch, a puff on a net, sparkles on a rock hit, and a pop over the hero (♪, !, ?, ♥, ★, 💦).

## Fishing

`cast()` picks the species up front from the fish whose `habitat`, `seasons` and `time` match, weighted by `rarity`, and derives `size` (1 under 300 raisins, 2 under 1,500, 3 above) and `fight` (0.22, 0.34, 0.48). The scene draws a shadow scaled by size. Phases:

1. **wait**: a timer of 2 to 7 s (1 to 4 s in rain). Pressing loses the cast.
2. **nibble** (0 to 2 of them): the bobber dips for 0.4 s, then waits 0.8 to 2.4 s more. Pressing spooks the fish.
3. **bite**: `BITE_WINDOW` = 0.9 s to press and hook. Missing it loses the fish.
4. **reel**: while the button is held, progress rises by `REEL_SPEED` = 0.7/s and tension by `fight`/s; released, progress falls by `REEL_SLIP` = 0.12/s and tension by `TENSION_RELAX` = 1.3/s. Random tugs add `fight × 0.1`. A small fish lands in about a second of holding; a big one needs the line eased once or twice. Tension at 1 snaps the line, progress at 0 slips the hook, progress at 1 lands the fish.

Moving cancels a cast before the reel phase. Landed fish add their value to `today.fish` for the tourney.

## Bugs

Up to `MAX_BUGS` = 6 at once, spawning every 4 to 8 s from the species active for the season, time and rain, on their habitat (grass, under a tree, on a flower, over water). Species with `rarity` ≤ 2 are `shy`. A bug within 1.3 tiles of a running hero (2.4 for shy bugs), or within 1.0 tile of a walking hero if shy, starts `fleeing`: it flies straight away for about 1.4 s, cannot be netted and then despawns. Netting adds the value to `today.bugs`.

## Economy

| Source | Raisins |
| --- | --- |
| Native apple / foreign fruit | 100 / 500, × `fruitRate` (0.7 to 1.5 by day) at Vito's |
| Base / hybrid flower | 40 / 400 |
| Shells | 90 (clam), 150 (sand dollar), 300 (conch) |
| Money rock, hits 1–4 | 25, 50, 75, 100 |
| Fish | 100 (pond frog) to 7,000 (yellowfin tuna) |
| Bugs | 130 (cricket, moth) to 2,000 (stag beetle) |
| Fossils | 1,000 (fern) to 5,000 (dinosaur egg), once assessed |
| Request delivered | 300, or a foreign fruit half the time |
| Festival | 3,000 / 1,500 / 500 for the top three, plus a trophy for first |
| Snowman | 500 each, three a Snowman Day |
| Wish | 300 or a foreign fruit next morning |
| Goals | 100 to 5,000 each, 11 in total |

Vito sells the shovel (600) and watering can (400), seeds (80 each) and a daily `stock` of three furniture pieces shuffled from the shop-listed `FURNITURE` by seed and day; the Festival Trophy is never stocked. Selling pays `valueOf(item)`; `sellAll()` keeps seeds, furniture, pinned items and unassessed fossils. Pockets hold `POCKETS` = 20; `togglePin` and `sortPockets` (pinned first, then kind, then value) manage them.

Fossils are dug up as `unknownFossil(hidden)` with price 0. `assess()` at the museum reveals every one in your pockets, counts them in `stats.fossils` and the passport, and only then can they be sold or donated.

The loan ladder `LOANS` = 4,800 → 19,800 → 49,800 moves the burrow through `HOME_NAMES` Tent, Cozy Burrow, Roomy Burrow and Grand Burrow, with `HOME_GRID` rooms of 3×2, 4×2, 4×3 and 5×3 tiles. `place(i, x, y)`, `moveFurniture(piece, x, y)` and `pickUp(piece)` manage the room. `pay()` takes whatever the hero has, up to the debt.

## Neighbours and friendship

`NEIGHBOURS` are Pia (flamingo, likes fish), Rodri (fox, fruit), Vivi (viscacha, flowers), Tato (condor, bugs), and two late arrivals: Lupe (llama, fruit) once 4 goals are done and Nico (Andean cat, fish) at 8. `residents` are the villagers currently in town; the friend chinchilla is a fifth who never asks for anything. Each wanders one tile at a time along walkable ground during waking hours.

Friendship runs 0 to `FRIEND_MAX` = 10 with `FRIEND_TITLES` from Stranger to Best friend: the first chat each day is +1, a gift +1 (+3 for their liked kind, 0 if the same item id is in their last three `gifts`), a delivered request +3, and `BIRTHDAY_BONUS` = 5 on top of either on their birthday. Villagers mention their most recent gift about 30% of the time. `BIRTHDAYS` places each one on a fixed day of the 16-day year.

## Festivals and the board

`festival` is set on the last day of each season: `tourney` in spring and autumn, `bugoff` in summer, `snowday` in winter. `festivalBoard` ranks the hero's `today.fish` or `today.bugs` value against each resident, whose scores climb through the day toward a per-day target of 800 to 4,000. `settleFestival()` runs at midnight: `FESTIVAL_PRIZES` = 3,000 / 1,500 / 500 by place, a trophy for first, nothing if you caught nothing. Snowman Day spawns `SNOWBALLS` = 3 on free grass; rolling one bare-pawed makes a solid snowman and pays `SNOWMAN_PRIZE` = 500.

`notices` builds the board's text: the festival or countdown, birthdays today and within two days, the fruit market, a visit between two residents, star-gazing and weather advice, and who is thinking of moving in.

## Sky

On clear summer nights from 20:00, `sky()` streaks a shooting star (`star` counts down from 3 s) every 12 to 26 s. Pressing the action button with nothing else in front while a star is up sets `wished`; the next morning pays `WISH_PRIZE` = 300 or a foreign fruit, and counts in `stats.wishes`.

## Flowers

`breedFlowers()` runs every new day. Each watered flower with a watered four-neighbour has a 45% chance to spawn a new flower on an adjacent free grass tile, taking a `HYBRIDS` colour half the time when the parents' pair is listed (red+yellow → orange, red+white → pink, white+yellow → purple, white+white → blue), otherwise one parent's colour. Watering wears off overnight.

## Saves

`save()` returns a v2 `Save` with the seed, RNG state, clock, position, money, loan, tools, pockets, placed furniture, museum, friendship, gift memory, requests, goals, arrivals, trees, flowers, rocks, fossils, shells, snowballs, snowmen, stats, the caught list, today's festival totals, the wish flag and live-mode fields. `Hollow.load()` also accepts a v1 save, laying its furniture list onto the room grid and admitting any arrivals its goals already earned. The page writes it to `localStorage` under `dusty-hollow-save-v1` every 3 seconds and on quit; music and effects levels live under `dusty-hollow-settings`.

## Playtest bot

`tests/dusty-hollow-bot.mjs` drives the engine: it catches every fish and bug in its listed season, time, water and weather; plays honest six-minute days of shaking, digging, fishing and selling until the whole loan ladder is paid; and runs a full 16-day year through all four festivals.
