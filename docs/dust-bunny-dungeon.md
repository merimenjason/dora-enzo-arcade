# Dust Bunny Dungeon

Game 46, at `/dungeon`. A turn-based grid roguelike: mischievous dust bunnies have taken over the old burrow cellars, and Dora or Enzo tidy them away one step at a time, twelve floors down through three areas to the Dust King. Every step is one turn and the bunnies move after you. Each one shows on the floor what it will do next turn (coral marks where it will bop, arrows where it will go), and you can only ever be bopped on a tile that was marked before you moved. Pushes, pits, prickle traps, crates, bellows, keys and switches chain into each other, so a good shove can tidy three bunnies at once. Nothing is ever hurt: bunnies get bopped, go dizzy and poof into a puff of dust.

## Files

| Part | File |
| --- | --- |
| Engine: floors, rooms, turns, enemies and their plans, tools, perks, replays, saving | `lib/dungeon-game.ts` |
| Scene: cellar tiles per area, fog, marks and arrows, enemies, Dora and Enzo, effects, minimap (Canvas 2D) | `lib/dungeon-scene.ts` |
| Sound: short Web Audio blips, with a mute toggle | `app/dungeon/sound.ts` |
| Page: menu, bestiary, settings, play, aiming, perks, pause, results, phone pad | `app/dungeon/page.tsx`, `app/dungeon/layout.tsx`, `app/dungeon/dungeon.css` |
| Paintings: the title, three floor textures, Dora and Enzo, ten enemies, five tools and the cellar props | `public/art/dungeon/`, described in [`dust-bunny-dungeon-art-brief.md`](dust-bunny-dungeon-art-brief.md) |
| Tests | `tests/dungeon.mjs`, `tests/dungeon-bot.mjs`, `tests/e2e/dungeon.mjs` |

Until (or unless) a painting loads, the scene draws everything itself: Dora and Enzo with the shared `drawChinchilla`, and every bunny, tile and prop in Canvas 2D.

## Floors

Each floor is a 31 × 31 grid: three by three room slots of 9 × 9 tiles with a wall between them. Rooms come from 16 hand-made templates, turned and flipped at random; the outer ring of every room is open floor, so every doorway joins up. The rooms are joined by a random spanning tree of doorways plus a few extra loops (30% per neighbouring pair). The stairs go in the room farthest from the start.

On floors that are not boss floors, there is a 55% chance of a locked treasure room: a dead-end room whose door needs a brass key found in another room, with a chest inside (two tools, and a 35% chance of a heart charm that adds a heart). Two or three tools lie about each floor. Every floor is checked to be solvable (every doorway, the stairs or boss and the key reachable from the start, counting crates as passable) and is rebuilt if not.

| Floors | Area | Bunnies found there |
| --- | --- | --- |
| 1–4 | **Root Cellar**: tangled roots, jam jars and the softest dust | Dust Bunny, Hop Bunny, Tumble Fluff (from floor 2), Bale Mimic |
| 5–8 | **Pantry Tunnels**: sacks of oats and shelves of crumbs | adds Puff Bunny and Sneezy Bunny |
| 9–12 | **Old Mine**: rails, lanterns and deep, deep dust | adds Burrow Bunny |

Each room except the start (and the treasure room) gets 1 bunny, plus 1 from the third floor of an area on, plus the area number (0, 1 or 2), plus one more on a 35% chance (10% more on each floor of the area). Hay bales in the templates are Bale Mimics half the time, crates otherwise.

Floors 4, 8 and 12 are boss floors: a 2 × 2 arena (one of 3 templates) takes four slots, and you start in the far corner.

**The dust clock.** After 120 turns on a floor (not a boss floor) the dust gets thick, and every 10 turns a new dust bunny tumbles out 4 to 6 tiles from you (a Dust Bunny in the Root Cellar, a Dust Bunny or Hop Bunny later). The HUD counts down.

**Fog.** You see a room once you step into it (a doorway shows both rooms). The minimap in the top right fills in as you go: walls, pits, prickles, the stairs, chests and the bunnies you can see.

## Turns and the rules of fairness

On your turn you step, bop, wait, use a tool or dash. Then every awake bunny carries out the plan it showed, and then they all plan again. A bunny wakes up when its tile is in view and it is within 3 tiles or in your room; it then spends one turn getting its bearings, so walking into a new room never gets you bopped at once. A bunny that is bumped into something goes dizzy, forgets its plan and misses its next turn.

You are only hurt on a tile that was marked: by a bop, a sweep, a jump's landing, a roll's line, a puff, a sneeze line, or a dust cloud left by an earlier puff. **Careful steps** (on by default) asks before you step onto, or wait on, a marked tile; press again to go anyway.

## Dora and Enzo

| | Hearts | Dash |
| --- | --- | --- |
| **Dora** | 5 | none (Quick Paws gives her one) |
| **Enzo** | 4 | 1 a floor: up to 3 tiles in one turn, bopping whatever he runs into |

Both start with 2 sling pebbles and 1 acorn. Hearts go up to 9. Leaving a boss floor gives a heart back.

## Bopping and pushing

Walk into a bunny to bop it with your broom: 1 bop, and it is knocked back a tile. A knocked bunny that:

- hits a wall, a locked door or a chest bonks for 1 more and goes dizzy;
- hits a crate breaks the crate, bonks for 1 more and goes dizzy;
- hits another bunny: both bonk for 1 and go dizzy, and the other one slides on a tile;
- goes into a pit or onto raised prickles poofs at once;
- slides onto a bellows plate sets it puffing.

Bosses are too heavy to knock back or make dizzy.

**Crates** slide one tile when pushed. A crate pushed into a pit fills it; pushed into a bunny it bops it for 1 and makes it dizzy; with nowhere to go it falls apart. **Switches** raise every lowered prickle trap and lower every raised one; anything standing on a prickle as it rises poofs. **Bellows** plates puff whatever is on the four tiles around them one tile away (you hold tight). **Locked doors** open with a key, and **chests** open when you walk into them.

When a bunny poofs (not a boss's helper) there is a 12% chance it leaves an acorn, a sling pebble or a duster behind.

## Tools

You carry up to 3 of each (4 with Deep Pockets). Using one takes a turn.

| Key | Tool | What it does |
| --- | --- | --- |
| 1 | **Feather Duster** (aim) | Sweeps the three tiles in front of you: 1 bop each and a knock back. |
| 2 | **Pebble Sling** (aim) | A pebble flies up to 7 tiles: 1 bop (2 with Sharp Shot) and a knock back to the first bunny it meets. |
| 3 | **Bubble Soap** (aim) | A bubble stream 5 tiles long pushes every bunny in it 2 tiles, and slides crates. |
| 4 | **Lantern** | Lights the whole floor: every room, the stairs, and which bales are mimics and where burrowers hide. |
| 5 | **Acorn Snack** | A heart back (2 with Acorn Stash). |

## Bunnies

| Bunny | Hearts | What it does |
| --- | --- | --- |
| **Dust Bunny** | 1 | Hops a tile toward you; next to you, bops your tile. |
| **Hop Bunny** | 1 | Jumps two tiles at a time; the landing thumps the landing tile and the tiles either side. |
| **Tumble Fluff** | 2 | Lines up with you, then rolls (up to 7 tiles away) until it bumps into something, then rests a turn. |
| **Puff Bunny** | 2 | Puffs a dust cloud on your tile from up to 3 tiles away if it can see you. The cloud lingers for two more turns. |
| **Sneezy Bunny** | 2 | From up to 3 tiles in line, sneezes down the line, pushing everything in it a tile; a push into a wall is a bop. |
| **Bale Mimic** | 3 | Looks like a hay bale until you are next to it. Slow: rests every other turn. |
| **Burrow Bunny** | 2 | Digs under the floor, tunnels closer, and pops up on your tile from within 2 tiles, then rests two turns. |
| **Great Dust Bunny** (floor 4) | 8 | Hops toward you, jumps every third turn, and splits off a little dust bunny every time it is bopped (up to 4 at once). |
| **Mole Foreman** (floor 8) | 10 | Swings his shovel across three tiles, whistles up two dust bunnies (up to 3 helpers), digs down and pops up under you. |
| **Dust King** (floor 12) | 13 | Rolls along your line, calls his court of dust and hop bunnies (up to 4), puffs from up to 5 tiles and sweeps three tiles. |

After a swing a boss catches its breath for two turns: that is the moment to bop it. When a boss poofs its helpers calm down and poof too, and on floors 4 and 8 stairs open where it stood. Tidying the Dust King wins the run.

## Perks

After floors 2, 4, 6, 8 and 10 you pick one perk of three (the choice is seeded, so a seed always offers the same).

| Perk | Effect |
| --- | --- |
| **Second Wind** | Once a run, when your last heart goes, you bounce back with two. |
| **Long Broom** | Broom bops also hit whoever stands right behind your target. |
| **Push Strength** | Broom bops knock back two tiles. |
| **Big Heart** | One more heart (offered until you have 9). |
| **Deep Pockets** | Carry one more of every tool, plus a duster and a sling pebble now. |
| **Acorn Stash** | Acorns heal 2, plus two acorns now. |
| **Keen Nose** | Every floor starts lantern-lit. |
| **Sharp Shot** | Sling pebbles bop for 2. |
| **Quick Paws** | One more dash every floor (Dora learns to dash). |
| **Prickly Fluff** | Anything that bops you from next door gets bopped back. |
| **Tidy Habits** | Every second flight of stairs gives a heart back. |

## Controls

- **Arrow keys**, **WASD** or the **numpad** step, and bop a bunny you step into. **Space**, **.** or numpad **5** waits.
- **1–5** use a tool; aimed tools then take a direction (an arrow key, or a tap on a tile in line). **Esc** puts the tool away.
- Enzo dashes with **Q** (or **E**) then a direction, or **Shift + arrow**.
- **1–3** pick a perk. **P** or **Esc** pauses (the game also pauses when the window loses focus). **Enter** on the results returns to the menu.
- Mouse and touch: tap a tile next to you to step or bop, tap yourself to wait, hover (or tap) a bunny to read its plan. On a phone an on-screen pad (four arrows and a wait button) sits under the tool bar.
- The **Daily dust-up** gives everyone the same cellars on a given date (seeded from the date); your best daily result is kept per day.

## Saving

The profile is kept in `localStorage` under `dust-bunny-dungeon-v1`: the chosen chinchilla, runs, deepest floor, wins for each of Dora and Enzo, the bestiary (how many of each bunny you have tidied), the best daily result per date, the settings (careful steps, tile grid, quick held steps) and the run in progress. A run is saved after every turn as its seed and its list of actions, and **Continue** replays it exactly. A save that does not parse, is from another version, or holds a run that no longer replays gives a fresh start. The sound toggle is kept under `dust-bunny-dungeon-sound-v1`.

`window.__dungeon()` returns the running engine for the browser tests; `window.__dungeonStart(char, mode, seed)` and `window.__dungeonAct(action)` start a run and play an action.

## Tests

- `tests/dungeon.mjs`: room templates, 1440 generated floors that are all solvable with safe starts and keys outside their doors, stepping, bopping and every kind of knock, crates, pits, switches, bellows, keys, doors and chests, every tool, dashing, each boss, every perk, Second Wind and losing, the dust clock, fairness (over many seeded games you are only ever bopped on a tile marked before you moved), replays, clones and reading saves.
- `tests/dungeon-bot.mjs`: a careful bot with a two-turn look-ahead clears the Root Cellar on at least 80% of 16 seeds and wins at least 60% of whole runs (16 of 16 at the time of writing); a hasty bot with no look-ahead wins far less (0 of 12, but reaches floor 9.7 on average); a random walker never wins and rarely passes floor 2. Every bot run replays exactly from its seed and actions.
- `tests/e2e/dungeon.mjs`: the arcade card, the saved chinchilla and settings, stepping and waiting by keys, aiming and firing a tool, pausing, saving and resuming after a reload, ending a run and its results, the daily seed, and the phone layout with the on-screen pad.

Last updated 27-10-2026.
