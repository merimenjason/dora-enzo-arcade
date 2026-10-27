# Burrow Command

Game 47, at `/command`. A cosy real-time strategy game. Three sides share the meadows round the Glimmer Spring: Dora and Enzo's **Burrow Colony** of chinchillas, Marlo's **Ringtail Guild** of raccoons and the **Clockwork Hive** of wind-up beetles. You gather hay and glimmer, put up buildings, train an army and send it out. Nobody gets hurt: a unit bumped down to nothing is **poofed** home, dizzy, and a building bumped down to nothing is **tidied away**. Play a ten-mission story campaign as the Colony, or a skirmish as any side against the computer on five maps.

The battlefield is a painted meadow seen from above at a slight angle, with a scrolling camera, a minimap, fog, box selection, right-click orders, control groups, shift-queued orders, attack-move, patrol and hold, and touch controls for phones.

## Files

| Part | File |
| --- | --- |
| Rules data: the three sides' units, buildings, upgrades and abilities, the five maps, and every number below | `lib/command-data.ts` |
| Pathfinding: A* on the tile grid, path smoothing, free-spot spirals | `lib/command-path.ts` |
| Engine: the 20 Hz simulation (orders, gathering, building, training, combat, abilities, fog, winning) and replays | `lib/command-game.ts` |
| Computer players: build orders, expansions, waves, retreats, abilities, for Easy, Normal and Hard | `lib/command-ai.ts` |
| Campaign: the ten missions, their talk, goals and stars, the test pilot, and saving | `lib/command-campaign.ts` |
| Scene: ground, trees, ponds, units, buildings, fog, shots, poofs, selection, the minimap (Canvas 2D) | `lib/command-scene.ts` |
| Sound: small Web Audio blips made on the spot | `app/command/sound.ts` |
| Page: title, skirmish setup, mission list, briefings, the match and its HUD, pause, results | `app/command/page.tsx`, `app/command/command.css` |
| Paintings: every unit and building, hay and glimmer, ground textures, trees and rocks, portraits, briefing backdrops and the title, each with a drawn stand-in until it loads | `public/art/command/`, described in [`burrow-command-art-brief.md`](burrow-command-art-brief.md) |
| Tests | `tests/command.mjs`, `tests/command-bot.mjs`, `tests/e2e/command.mjs` |

## The simulation

The engine runs in fixed ticks of 1/20 s. Positions are whole numbers of world units (256 to a tile), distances use an integer square root, and every random choice comes from a seeded generator, so a match is decided only by its seed and its orders. The page hands the player's orders to `World.issue()`, which carries them out at the start of the next tick and logs them with that tick; `replay(make, log, ticks)` plays a match back exactly from the seed and the log. The computer players think inside the tick, so they replay too.

Units move along A* paths over the tile grid (8 directions, never cutting a blocked corner), smoothed to straight lines where the way is clear, and push apart from each other each tick through a spatial hash (cells of 2 tiles). A goal that cannot be reached leads to the nearest spot that can. Path searches are budgeted at 28 a tick so a big order spreads over a few ticks. Ponds, trees, rocks and buildings block walkers; fliers go straight over everything. Units that are walking let friends slip past them, so a crowd does not jam in a gap, and an attack-move marches at the pace of its slowest walker so the army arrives together.

## Economy

| | |
| --- | --- |
| Start | the side's home building, 5 workers and 150 hay |
| Hay meadow | 1500 hay, 2 workers at once; a trip picks 5 hay in 28 ticks (1.4 s) |
| Glimmer deposit | 1200 glimmer, 3 workers at once; a trip picks 4 glimmer in 44 ticks (2.2 s) |
| Room | the home holds 10, each house 8 more, 60 at most; training waits for room |

Workers carry what they pick to the nearest finished home building and go back for more by themselves. A meadow with its two places taken sends extra workers to the nearest quieter one, and an empty meadow disappears from the map. Building costs are paid when the order is given; stopping a worker before the foundation is down gives it all back, and cancelling a foundation gives back 75%. Up to five units or upgrades queue at a building and each can be cancelled for a full refund. A rally point sends new units somewhere, or straight to work when it is set on a meadow.

How each side builds:

- **Colony**: one Hay Gatherer builds at a time; others can help but the building does not go up faster.
- **Guild**: Tinkerers pile in, up to four at once, each one adding its own speed.
- **Hive**: a Sorter Beetle starts the building and walks off; it grows on its own.

## Combat

A bump does its damage less the target's armour, and always at least 1. Melee units reach 0.5 tiles past their own edge; ranged reach is in the tables below. Siege units do three times as much to buildings, and splash does half damage to everyone within the splash radius of the target. A unit that is bumped calls nearby friends to help. Idle units bump anything grumpy that comes into sight and then walk back to where they stood; units told to **Hold** bump what is in reach but never chase. **Attack-move** bumps whatever it meets on the way; a plain **Move** walks past everything. **Patrol** walks back and forth, bumping anyone who comes by.

When a unit is poofed its room is freed. When a building is tidied away its ground is free again. Each side remembers enemy buildings it has seen, drawn faded in the fog, until it sees that they have gone.

The **fog** has three states per team: never seen (dark), seen before (dimmed, with remembered buildings), and in view now. Units see their own sight in tiles; finished buildings see 6 tiles, towers 8, foundations 3. Enemies in the fog cannot be clicked or targeted, and buildings can only go down on ground that has been seen.

A skirmish is won by tidying away every rival building. A Guild side with only a packed Rolling Workshop left is still in the game. After 30 minutes the match is decided on score.

## The Burrow Colony

Adaptable all-rounders led by Dora and Enzo. **Tunnels**: a Colony unit sent to a Tunnel Mound or the Great Burrow walks to the nearest tunnel mouth (within 4 tiles), spends 2 s underground and pops out at the one picked. **Dust Baths** mend 3 health a second to Colony units within 4 tiles of their edge.

| Unit | Cost | Room | Train | Health | Armour | Bump | Reach | Every | Speed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hay Gatherer | 50 | 1 | 12 s | 45 | 0 | 5 | close | 1.2 s | 2.8 | gathers and builds |
| Pebble Slinger | 55 | 1 | 13 s | 55 | 0 | 8 | 4.5 | 1.2 s | 2.6 | hits fliers |
| Fluffguard | 100 + 25 glimmer | 2 | 20 s | 180 | 1 | 14 | close | 1.3 s | 2.3 | |
| Dust Puffer | 75 + 50 glimmer | 2 | 20 s | 70 | 0 | 7 | 4 | 1.4 s | 2.4 | splash 1 tile; Dust Cloud |
| Glider | 75 + 25 glimmer | 1 | 16 s | 60 | 0 | 6 | 3 | 1 s | 4.2 | flies |
| Burrow Digger | 150 + 100 glimmer | 3 | 30 s | 150 | 1 | 32 | 6 | 3 s | 1.8 | ×3 on buildings, splash 0.8 |
| Dora | missions only | 0 | | 320 | 2 | 16 | 4 | 1 s | 3 | hero; Rally Song |
| Enzo | missions only | 0 | | 440 | 4 | 20 | close | 1.2 s | 2.8 | hero; Stand Firm |

| Building | Key | Cost | Build | Health | Armour | Needs | Does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Great Burrow | Q | 400 | 60 s | 1300 | 5 | | home and drop-off, room for 10, trains Hay Gatherers, tunnel mouth |
| Hay Hut | W | 100 | 18 s | 320 | 4 | | room for 8 |
| Pebble Pit | E | 150 | 30 s | 650 | 4 | | trains Pebble Slingers and Fluffguards |
| Watch Stump | R | 100 + 25 glimmer | 20 s | 420 | 5 | Pebble Pit | flings 10 every 1.2 s, reach 6, hits fliers |
| Dust Bath | A | 100 + 25 glimmer | 22 s | 400 | 4 | Pebble Pit | mends Colony units nearby |
| Tunnel Mound | S | 75 | 15 s | 350 | 4 | Pebble Pit | tunnel mouth |
| Seed Library | D | 125 + 50 glimmer | 25 s | 420 | 4 | Pebble Pit | studies the Colony's upgrades |
| Glider Perch | Z | 150 + 75 glimmer | 30 s | 520 | 4 | Seed Library | trains Gliders |
| Digger's Den | X | 150 + 100 glimmer | 35 s | 620 | 4 | Seed Library | trains Dust Puffers and Burrow Diggers |

Upgrades at the Seed Library: **Sharper Pebbles** (100 hay + 100 glimmer, 40 s) +20% damage for units and Watch Stumps; **Thicker Fluff** (100 + 100, 40 s) +1 armour and +10% health; **Swift Paws** (75 + 75, 35 s) +15% speed.

## The Ringtail Guild

Scrappy scavengers with cheap, quick units. **Salvage**: when a rival unit is poofed within 7 tiles of a raccoon, the Guild picks up 15% of its cost. The **Rolling Workshop** can **Pack Up** onto its wheels (when its queue is empty) and **Unpack** anywhere with a clear 3×3 spot, keeping its share of health.

| Unit | Cost | Room | Train | Health | Armour | Bump | Reach | Every | Speed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tinkerer | 50 | 1 | 12 s | 40 | 0 | 5 | close | 1.2 s | 2.8 | gathers and builds |
| Scrapper | 45 | 1 | 10 s | 58 | 0 | 7 | close | 1 s | 3.4 | |
| Lid Tosser | 50 | 1 | 12 s | 47 | 0 | 8 | 4.5 | 1.2 s | 3 | hits fliers |
| Trapsetter | 60 + 25 glimmer | 1 | 15 s | 50 | 0 | 6 | 3.5 | 1.3 s | 3 | Honey Snare |
| Kite Rider | 70 + 25 glimmer | 1 | 15 s | 55 | 0 | 6 | 3 | 1 s | 4.4 | flies |
| Junk Cart | 125 + 75 glimmer | 3 | 26 s | 115 | 0 | 28 | 6.5 | 3 s | 2 | ×3 on buildings, splash 1 |
| Rolling Workshop (packed) | | 0 | | 500 | 1 | | | | 1.6 | Unpack |
| Marlo | missions only | 0 | | 380 | 2 | 15 | 3.5 | 1 s | 3 | hero; Shiny Toss |

| Building | Key | Cost | Build | Health | Armour | Needs | Does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Big Bin | Q | 400 | 60 s | 1200 | 5 | | home and drop-off, room for 10, trains Tinkerers |
| Stash Den | W | 90 | 15 s | 280 | 3 | | room for 8 |
| Scrap Yard | E | 140 | 25 s | 560 | 4 | | trains Scrappers, Lid Tossers and Trapsetters |
| Lantern Post | R | 90 + 25 glimmer | 18 s | 380 | 4 | Scrap Yard | skims 9 every 1.1 s, reach 6, hits fliers |
| Tinker Bench | A | 110 + 50 glimmer | 22 s | 380 | 4 | Scrap Yard | studies the Guild's upgrades |
| Rolling Workshop | S | 150 + 75 glimmer | 30 s | 500 | 4 | Tinker Bench | trains Junk Carts; Pack Up |
| Kite Loft | D | 140 + 75 glimmer | 28 s | 480 | 4 | Tinker Bench | trains Kite Riders |

Upgrades at the Tinker Bench: **Lucky Lids** (100 + 100, 40 s) +20% damage for units and Lantern Posts; **Patched Coats** (100 + 100, 40 s) +1 armour and +10% health; **Greased Wheels** (75 + 75, 35 s) +20% speed.

## The Clockwork Hive

A whirring swarm. **Winding**: beetles (not Sorters or the Queen) stay wound for 70 s away from a Spring Tower or the Hive Core (7 tiles); near one they wind back up 10 times as fast as they run down. A wound-down beetle moves at half pace and swings at half speed. **Shells mend**: a beetle that has gone 5 s without a bump mends 1 health every 8 ticks (2.5 a second).

| Unit | Cost | Room | Train | Health | Armour | Bump | Reach | Every | Speed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sorter Beetle | 50 | 1 | 12 s | 45 | 1 | 4 | close | 1.2 s | 2.7 | gathers and builds; never runs down |
| Click Beetle | 45 | 1 | 9 s | 52 | 0 | 8 | close | 1 s | 3.4 | |
| Squirt Beetle | 55 | 1 | 13 s | 56 | 0 | 8 | 4.5 | 1.2 s | 2.6 | hits fliers |
| Shellback | 120 + 25 glimmer | 2 | 22 s | 190 | 2 | 12 | close | 1.4 s | 2.1 | |
| Buzz Beetle | 65 + 25 glimmer | 1 | 15 s | 58 | 0 | 6 | 3 | 1 s | 4.2 | flies |
| Ram Beetle | 140 + 75 glimmer | 3 | 28 s | 190 | 2 | 30 | close | 2.4 s | 2.1 | ×3 on buildings |
| Queen Beetle | 250 + 150 glimmer | 4 | 45 s | 520 | 3 | 18 | 4 | 1.2 s | 2 | one at a time; never runs down; Brood Call |

| Building | Key | Cost | Build | Health | Armour | Needs | Does |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Hive Core | Q | 400 | 60 s | 1400 | 5 | | home and drop-off, room for 10, trains Sorter Beetles, winds beetles within 7 |
| Cog Cell | W | 100 | 18 s | 320 | 4 | | room for 8 |
| Spring Tower | E | 75 | 15 s | 320 | 4 | | winds beetles within 7; Overwind |
| Brood Works | R | 150 | 28 s | 620 | 4 | | trains Click Beetles, Squirt Beetles and Shellbacks |
| Spark Coil | A | 100 + 25 glimmer | 20 s | 420 | 5 | Brood Works | sparks 11 every 1.2 s, reach 5.5, hits fliers |
| Winding Hall | S | 125 + 50 glimmer | 25 s | 420 | 4 | Brood Works | studies the Hive's upgrades |
| Buzz Nest | D | 150 + 75 glimmer | 30 s | 500 | 4 | Winding Hall | trains Buzz Beetles |
| Gear Forge | F | 150 + 100 glimmer | 35 s | 620 | 4 | Winding Hall | trains Ram Beetles and the Queen |

Upgrades at the Winding Hall: **Quick Gears** (100 + 100, 40 s) +20% damage for units and Spark Coils; **Polished Shells** (100 + 100, 40 s) +1 armour and shells mend twice as fast; **Tighter Springs** (75 + 75, 35 s) beetles stay wound twice as long.

## Abilities

| Ability | Who | Wait | Effect |
| --- | --- | --- | --- |
| Dust Cloud | Dust Puffer, aimed up to 6 tiles away | 22 s | a cloud 2.2 tiles across for 5 s; grumpy units inside move 40% slower and swing 25% slower |
| Rally Song | Dora | 30 s | friends within 5 tiles mend 60 health and move 30% faster for 6 s |
| Stand Firm | Enzo | 30 s | friends within 4 tiles take half the bumps for 7 s |
| Honey Snare | Trapsetter, up to 3 tiles away | 6 s | a hidden snare; the first grumpy walker in takes 15 and is held for 3 s; six at a time |
| Shiny Toss | Marlo, up to 6 tiles away | 25 s | grumpy units within 3 tiles of the spot stop to stare for 3 s |
| Brood Call | Queen Beetle | 40 s | two Click Beetles whir out beside her, if there is room |
| Overwind | Spring Tower | 60 s | every beetle within 7 tiles is fully wound and 40% quicker for 8 s |
| Pack Up / Unpack | Rolling Workshop | | rolls the workshop somewhere new |
| Tunnel | any Colony walker | | see the Burrow Colony |

Heroes (Dora, Enzo and Marlo) mend 1 health every 4 ticks (5 a second) after 5 s without a bump.

## Maps

| Map | Size | |
| --- | --- | --- |
| Clover Hollow | 52 × 52 | A small, open meadow round a lily pond. Quick to cross, quick to meet. |
| Twin Ponds | 64 × 56 | Two long ponds split the middle into three lanes. |
| Mossy Crossing | 60 × 64 | A stream runs right across, with three shallow fords. |
| Pebble Ridge | 64 × 64 | Rocky ridges make narrow passes. Expansions hide behind them. |
| Sunflower Fields | 72 × 60 | A wide, open map with plenty of meadows to claim. |

Every home has six hay meadows in an arc and a glimmer deposit, and both starts on a map are turned half a circle from each other, so they are the same. Extra sites for a second home sit between the starts.

## Computer players

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Thinks every | 30 ticks | 15 ticks | 8 ticks |
| Workers | 10 | 16 | 21 |
| First wave | 7 minutes | 5 minutes | 4.5 minutes |
| Barracks | 1 | 2 | 3 |
| Expands | never | at 9 minutes | at 6.5 minutes |
| Towers, upgrades, abilities, retreats, scouting | no | yes | yes |

Each side has a build plan (barracks, tech, late buildings, a tower) and an army mix. The computer sends a wave once its army is worth enough (hay plus twice the glimmer), sends bigger waves each time, pulls back to regroup when a fight turns against it, and builds extra barracks when it is banking more than it spends.

## The campaign

Ten missions, all played as the Colony. Each opens with a briefing (portraits and a painted backdrop), talks during play, and ends with a few lines. Each has three stars: winning, and two more listed below. A mission opens once the one before it is won. Losing a hero listed in the goal loses the mission.

| # | Mission | Goal | Stars 2 and 3 |
| --- | --- | --- | --- |
| 1 | First Harvest | Gather 400 hay, and build a Hay Hut and a Pebble Pit. | within 5 minutes; train 3 Pebble Slingers |
| 2 | Muddy Footprints | Tidy away the raccoons' Stash Den. Keep Dora and Enzo safe. | within 8 minutes; lose no more than 4 friends |
| 3 | Hold the Hollow | Hold out for 6 minutes until Marlo arrives. Keep the Great Burrow standing. | Great Burrow above half; lose no more than 10 friends |
| 4 | Lost Kits | Find the three lost kits and bring them home. Keep Enzo and the kits safe. | within 7 minutes; no kit gets bumped |
| 5 | The Ticking Woods | Tidy away the three Spring Towers by the meadows. | within 15 minutes; lose no more than 12 friends |
| 6 | Marlo's Bargain | Escort Marlo to the eastern Tunnel Mound. | within 6 minutes; Marlo above half health |
| 7 | Wind-Down | With the Guild beside you, tidy away the Hive Core. | within 18 minutes; lose no more than 25 friends |
| 8 | Glimmer Rush | Gather 1200 glimmer before the Hive does. | within 9 minutes; lose no buildings |
| 9 | The Queen's Garden | Bring Dora and Enzo to the Queen in her garden. | within 8 minutes; poof fewer than 10 guards |
| 10 | Festival of Friends | With the Guild and the Hive beside you, calm the Overwound. | within 20 minutes; Dora and Enzo above half health |

## Controls

| | Mouse and keys | Touch |
| --- | --- | --- |
| Pick | click; drag a box (an army in the box leaves gatherers out); double-click for every one of that kind on screen; Shift adds | tap; switch the ▢ button to "Drag selects" and drag a box |
| Send | right-click: walk, gather from a meadow, help a foundation, bump a rival, carry home; Shift queues | tap the ground or a rival with something picked |
| Orders | M move, A attack-move, P patrol, H hold, S stop, R carry home, F/G/V abilities, T tunnel | the buttons on the command panel |
| Build | pick a worker, B, then the building's key, then click; Shift places several | the buttons, then tap the spot |
| Train and study | pick the building, then the unit's or upgrade's key; X cancels the last; Y (or right-click) sets the rally point | the buttons |
| Groups | Ctrl+1–9 (or Alt) sets, 1–9 picks, the same number twice looks at it, Shift+number adds | |
| Camera | arrow keys, the screen's edges, the minimap, the middle button; the wheel and + / − zoom; Backspace looks home; Space looks at the last alert | drag to look around, pinch to zoom, tap the minimap |
| Other | . picks the next idle gatherer; Esc cancels an order or pauses | the pause button |

The pause menu has the speed (Gentle 0.75×, Normal, Brisk 1.5×), sound, edge scrolling and hints.

## Saving

Progress is saved in `localStorage` under `burrow-command-v1`: the best stars and fastest win for each mission, skirmish wins by side, and the settings (sound, speed, edge scrolling, hints, and the last skirmish side, rival, difficulty and map). `readProfile()` reads it defensively: a broken save or another version starts fresh, stars are clamped to 0–3, unknown missions are dropped, and unknown settings fall back to the defaults.

## Tests

- `tests/command.mjs` (`npm run test:command`): the sides' tables and tech trees, every map (fair homes, every node reachable), gathering and meadow slots, building for each side, refunds, training, queues, room and limits, upgrades, combat maths (armour, Stand Firm, siege, splash), hold and attack-move, towers, salvage, A* and smoothing, crowds crossing real maps without anyone getting stuck or standing in a pond, fliers over water, fog and memory, every ability, winding and shell mending, each computer player's build order on every difficulty, winning and the clock, every mission's goals and stars, replays from the order log, and saving.
- `tests/command-bot.mjs` (`npm run bot:command`): Normal against Normal for every ordered pair of sides on all five maps with two seeds (60 matches), checking no more than 5% run out of time and every pairing wins between 35% and 65%; Hard and Normal against Easy; a pilot that wins every campaign mission; and an exact replay. The seeds are fixed, so the numbers are the same each run.
- `tests/e2e/command.mjs` (`npm run test:e2e:command`): the arcade card, the menus and saved choices, a skirmish played by mouse and keys (box select, gathering, groups, training, building, pausing), winning mission 1 and finding mission 2 open after a reload, and the phone layout played by touch.

Last bot run (27-10-2026): Colony 9 – Guild 11, Colony 13 – Hive 7, Guild 8 – Hive 12, no stalls; Hard beat Easy 23 of 23; the pilot won all ten missions.
