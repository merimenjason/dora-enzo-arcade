# Tetherball

Game 82, `/tether`. A pixel-art action roguelite with no weapons: Dora hooks an enemy on a rope, whirls it round and lets go, and the enemy is the weapon. It was the top pick of the fifteen action roguelite concepts in [`action-roguelites.md`](action-roguelites.md) (05-11-2026).

## Files

| File | What it is |
|---|---|
| `lib/tether-game.ts` | The rules, deterministic at 60 ticks a second from a seed with no DOM: arenas, the hook and rope, momentum and impacts, enemies, the run, upgrades and the save. |
| `lib/tether-scene.ts` | Canvas 2D drawing at 480 by 320 pixels, scaled up with nearest-neighbour. |
| `app/tether/page.tsx` | Input, the loop, the HUD, Enzo's pointers, the upgrade picker, results and the save. Exposes `window.__tether()` with `debug` helpers for the browser tests. |
| `app/tether/sound.ts` | Synthesised effects and four original chiptune loops (title, arena, golem, ending). |
| `app/tether/tether.css` | The pixel look. The HUD sits on the arena's wall bands, never over the floor. |
| `public/art/tether/` | The art (see **Art**). |
| `scripts/tether-art.py` | Turns the Codex paintings into the game's pixel art. |
| `tests/tether.mjs`, `tests/tether-bot.mjs`, `tests/e2e/tether.mjs` | Engine checks, bots and the browser suite. |

## The rope

- **Hook.** The hook flies at 560 px/s, up to the rope's reach (100 px, plus 22 for each **Longer rope**). It latches onto the first enemy, Enzo or post it touches. With the mouse it goes where you aim; without it, it goes for the nearest thing within 60° of where Dora faces (Enzo and posts count as a little further away, so enemies come first).
- **Whirl.** While the button is held, the rope never stretches: the two ends are pulled together by their weights, and their speed apart is cancelled. The enemy is pushed round at 430 px/s² up to a top speed of 240 px/s for a light one. The top speed falls with the square root of the enemy's weight against Dora's, so a Shellback (3) tops out near 196 px/s and a Boar (6) near 139. **Whirlwind**, **Longer rope** and **Heavy boots** all raise it.
- **Yank.** If the button is already up when the hook bites, the enemy is pulled towards Dora at up to 230 px/s instead.
- **Throw.** Letting go leaves the enemy flying (for 1.4 s) at its swing speed, 25% faster for each **Bungee rope**. The dotted line from a whirling enemy shows where it will go.
- **Shield.** While an enemy whirls at 150 px/s or more, the disc its rope sweeps blocks acorns and rocks.
- **Dash.** 300 px/s for 0.16 s, every 0.7 s (a third less per **Quick feet**). It goes straight through enemies, with a quarter second of safety after, and while whirling it whips the enemy round 90 px/s faster (less for heavy ones).
- **Enzo and posts.** Hooking Enzo (or a stone post) makes Dora the one going round, at up to 240 px/s. At 140 px/s or more she hits whatever she meets and is not hurt by it. Letting go flings her.
- **The swing meter** on the HUD is the swing speed divided by 25.

## Impacts

- Two bodies meeting push apart by their weights and bounce (restitution 0.7). If either was flying and they met at 60 px/s or more, both take damage: 1 at 60, plus 1 for every 50 above (2 at 110, 3 at 160, 4 at 210).
- Anything hit flies off in turn (25% faster for each **Bowling**), and an enemy knocked out by a hit tumbles on for half a second, still hitting what it meets. That is how one throw bowls through a line.
- A pair can only hit each other once every 0.3 s. Every hit adds to the combo, which resets 1.1 s after the last hit or when Dora is hurt. Hits stop the game for 30–90 ms (hitstop), longer for harder hits.
- **Armour:** the Shellback takes no damage from hits under 200 px/s, faster than it can be whirled, so it is the best flail there is. The Stone Golem ignores hits under 90 px/s.
- **Walls:** a flying enemy that hits a wall at 90 px/s or more takes impact damage. **Wall quake** adds a 1-damage shockwave.
- **Spikes** deal 3 damage to anything that hits them at 50 px/s or more, through armour.
- **Pits** swallow any enemy but the golem whose middle ends up over one. Dora can't walk into a pit.
- **Crates** break under a flying enemy at 90 px/s or more, or under Dora dashing or swinging. 35% hold a heart, which heals 1.
- **Bomb Beetles** explode on any damage: 3 damage and a big shove to everything within 44 px, which sets off other beetles; Dora takes 1 if she's close. A **Blast knot** makes a thrown enemy explode (2 damage) when it first hits something.

## Enemies

| Enemy | Radius | Weight | Hearts | Speed | Touch | What it does |
|---|---|---|---|---|---|---|
| Slime | 6 | 1 | 2 | hops | 1 | Hops at Dora every 0.8–1.3 s. |
| Grumble | 7 | 1.5 | 3 | 42 | 1 | Walks straight at her. |
| Spitter | 7 | 1.2 | 2 | 38 | 1 | Keeps 90–130 px away, flashes for 0.6 s, then spits an acorn at 150 px/s. |
| Bomb Beetle | 6 | 1 | 1 | 34 | 1 | Explodes when hurt. |
| Shellback | 9 | 3 | 5 | 26 | 1 | Armour 200. |
| Boar | 10 | 6 | 8 | 30 | 2 | Within 190 px it paws the ground for 0.7 s, then charges at 210 px/s for up to 1.1 s. Running into a wall or anything solid stuns it for 1.4 s and costs it a heart; spikes cost it 3 every time it touches them. A hooked charging boar keeps charging and drags Dora. |
| Stone Golem | 18 | 16 | 24 | 18 | 2 | Armour 90. Within 110 px it raises its fists for 0.9 s and slams a shockwave out to 110 px; further away it throws three rocks at 120 px/s. It rests 3.2 s between attacks, is dazed for 0.8 s by a hit of 3 or more, and every 8 s calls two little ones (slimes, grumbles or beetles) while fewer than five enemies are up. |

Enemies arrive at the edges of the floor at least 120 px from Dora, spending 0.7 s appearing (harmless and unhookable). Walkers steer round pits, spikes, crates and Enzo. Touching an enemy that isn't flying, stunned or on Dora's rope costs her its touch damage and gives her 1 s of safety.

## The run

- Dora has 5 hearts. Thirteen arenas: three each in the **Mossy Courtyard** (slimes and grumbles; the first boar at the end), **Clover Meadow** (spitters arrive, then beetles and boars), **Glimmer Mine** (shellbacks arrive) and **Grumble Keep** (everything), then the **Stone Golem** with two grumbles.
- Arenas are seeded: one to three spikes (four round the golem), up to one pit from the second arena (up to two in the mine and keep), two or three crates, sometimes a post from the meadow on, and Enzo near a side wall or a top corner. Arena 1 is two fixed waves; arenas 2 and 3 have two waves; the rest have three, each with a budget that grows with the arena (slime 1, grumble 1.5, beetle 1.5, spitter 2, shellback 2.5, boar 4; boars are capped).
- After each arena Enzo offers three upgrades from his satchel and Dora takes one. She heals 1 at the end of each place (every third arena) and 1 more per **Enzo's plasters**.

| Upgrade | Levels | Effect |
|---|---|---|
| Longer rope | 3 | +22 px reach, and a faster top speed. |
| Bungee rope | 3 | Throws 25% faster. |
| Blast knot | 2 | A thrown enemy explodes on its first hit. |
| Barbed hook | 2 | The hook deals 1 damage and dazes. |
| Heavy boots | 3 | Dora's weight +1.5: big enemies drag her less and whirl faster. |
| Whirlwind | 3 | Whirls up a third faster, top speed +30 px/s. |
| Big heart | 3 | +1 heart, full. |
| Quick feet | 2 | The dash recharges a third faster. |
| Bowling | 2 | Things knocked by a flying enemy fly 30% faster. |
| Wall quake | 2 | A wall slam sends out a shockwave. |
| Enzo's plasters | 3 | Heal a heart after every arena. |

## Art

All art was painted with Codex in pixel-art style and turned into game-size pixel art by `scripts/tether-art.py`:

- Four 2×2 sprite sheets on flat magenta: Dora standing, running and whirling, Enzo braced; slime, Grumble, boar, Shellback; bomb beetle, Spitter, golem, crate; spikes, pit, post, heart. They are keyed, cropped and shrunk to their in-game size (Dora is 30 px tall) with a 24-colour palette.
- Four arena floors at 1536 by 1024, fitted so each painting's inner wall lines up with the engine's floor rectangle, then shrunk to 480 by 320 with 32 colours.
- The title, the ending and Dora's and Enzo's portraits, shrunk to 384 by 256 (portraits 96 by 96) and drawn with nearest-neighbour.

## Bots

`npm run bot:tether` plays thirty seeded runs with each bot. The swinger hooks the nearest light enemy, whirls it, and lets go when the swing points at a crowd. It dashes out of charges, steps out of the line of shots, keeps clear of heavy enemies, hooks Enzo when nothing light is near, and takes upgrades in a fixed order. The careless bot walks at the nearest enemy, tapping the hook. On 05-11-2026:

- **Swinger:** won 4 of 30 runs and reached arena 11.4 on average; a run takes about 8.5 minutes.
- **Careless:** won none and reached arena 1.2 on average.

The test needs the swinger to win between 1 and 24 runs, average arena 5 or more, and beat the careless bot by more than two arenas. Rerun it after changing any number above.

## The save

`localStorage` key `tetherball-v1`: whether Enzo's opening has been seen, the bests (arena, kills, combo, swing), totals (runs, wins, kills), the enemies met (Enzo introduces each one the first time ever) and the sound and music settings.
