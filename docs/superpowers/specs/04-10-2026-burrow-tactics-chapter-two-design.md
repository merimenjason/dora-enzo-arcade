# Burrow Tactics · chapter two design

Written 04-10-2026. Builds on [`04-10-2026-burrow-tactics-design.md`](04-10-2026-burrow-tactics-design.md). Jason asked for: a hint, a guided first mission, difficulty, choosing where to start, a second action per chinchilla, more terrain, more mission objectives, more predators, and classes. Answers given: classes are roles with a perk; second actions are unlocked by play; the new content goes in new missions after the ten; same overnight rules as before (decide and build, push to draft PR #5, never merge).

Everything stays inside the engine / scene / page split, and a `Battle` stays plain, cloneable data.

## Classes

Three classes, two chinchillas each. A class gives one passive perk and sets how far each upgrade can go in The Long Night.

| Class | Chinchillas | Perk | Upgrade caps (health / move / damage) |
| --- | --- | --- | --- |
| Scout | Dora, Pip | **Hit and run**: may still move after acting, if it has not moved yet. | 1 / 3 / 1 |
| Bruiser | Enzo, Biscuit | **Heavy paws**: anything they knock into something takes 1 more. | 2 / 1 / 2 |
| Warden | Grandpa Pebble, Mochi | **Stand guard**: a predator's attack on a burrow next to a Warden hits the Warden instead. | 3 / 2 / 1 |

The perks are always on, in the first ten missions too.

## Second actions

One action a turn, as before; a chinchilla that knows its second action picks between the two (and Groom).

| Chinchilla | Second action | What it does |
| --- | --- | --- |
| Dora | Piercing Seed | A straight line: every creature in the line takes 1, up to the first rock, bale or burrow, which is hit too. No push. |
| Enzo | Ground Slam | All four tiles around him take 1 and are pushed away. |
| Pip | Switcheroo | Swaps places with the first creature in a straight line. |
| Grandpa Pebble | Brace | A burrow next to him survives the next hit it takes. |
| Mochi | Lullaby | A predator 1 or 2 tiles away in a line forgets its attack. Bosses shrug it off. |
| Biscuit | Drop Kick | The creature next to her slides up to 3 tiles; it is bumped if something stops it. |

Unlocked by play: each chapter-two mission lists which of its squad know their second action (`Mission.skills`), introducing one at a time; in The Long Night a second action is one of the rewards.

## Terrain

- **Ice** (`=`): walking is normal. Anything pushed onto ice keeps sliding the same way until it leaves the ice or is stopped (and then bumps).
- **High ground** (`n`): a creature standing on it does 1 more damage with any action or attack that does damage.
- **Fire**: a tile can be alight (`*` on a map, `Battle.fire` turns left). Anything on the ground that stops on, or is pushed onto, a burning tile takes 1. After the predators attack, everything standing in fire takes 1, fire spreads to brambles and hay bales next to it, and each fire burns down by one. Burnt brambles become grass. The fire step is deterministic and is part of `resolveAttacks`, so the forecast includes it.

## Objectives

`BattleDef.goal`:

- `hold` (default): last the turns.
- `escort`: a kit (2 health, moves 2, can only groom) must reach the den tile (`BattleDef.exit`). Won the moment it arrives; lost if it is knocked out or the turns run out.
- `hunt`: knock out the marked predator before the turns run out.

`BattleDef.key` marks one burrow as the nursery: if it collapses, the battle is lost (works with any goal). Predators value it more. Boss battles are `hold` with a marked boss: won when it is knocked out, or by lasting the turns.

## Predators

| Name | Health | Move | Attack | Cost |
| --- | --- | --- | --- | --- |
| Mole | 2 | 4, tunnelling under everything | **Nip**: the tile in front, 1. | 3 |
| Skunk | 3 | 3 | **Spray**: the tile in front takes 1 and is covered by a stink cloud, which works like a dust cloud. | 3 |
| Great Bear | 12 | 2 | **Charge**: runs in a line until something is in the way, hits it for 3 and knocks it back. Too heavy to drown. | boss |

The bear is the boss of the last chapter-two mission and of every other run.

## Choosing where to start

A battle with `deploy` starts in state `deploy`: predators are on the board but have not picked attacks. The player swaps chinchillas between open home-side tiles (`zone()`, `place()`), then `ready()` lets the predators move and telegraph and the first turn begins. All run battles and chapter-two missions use it; the first ten missions keep their fixed starts because they are built as puzzles.

## Difficulty (The Long Night)

Gentle, Standard, Fierce: warren 6 / 5 / 4 and predator budgets × 0.8 / 1 / 1.3. Chosen on the menu when starting a run, kept in the run's save, and the best result is recorded per difficulty.

## Hint

`hint(battle)` in the engine is the planner the test bot uses: for the next chinchilla that can act, the move and action that leave the board best after the predators' attacks. The page's Hint button draws the suggested move and target on the board and says it in words. The bot imports the same function, so the hint and the tests cannot drift apart.

## Guided first mission

The first time mission 1 is played, a coach line above the board walks through turn 1 step by step (pick the action, aim at the fox, read the preview, move Enzo, whack, check the forecast, end the turn), derived from the battle's state, with the button or tile to use highlighted. It stops after turn 1 and never shows once the mission has been won.

## Campaign chapter two

Eight missions after the ten, opened by winning mission 10: Thin Ice, Wildfire, High Ground, The Lost Kit, The Nursery, The Old Badger, Smoke and Stink, The Great Bear. Each introduces one terrain, objective or predator and one second action.

## Saving

Stars grow from 10 to 18 entries; old saves are padded, so the key stays `burrow-tactics-v1`. The run's save changes shape (difficulty, second actions), so its key becomes `burrow-tactics-run-v2`.

## Testing

Engine tests for every new rule; the bot must win all 18 missions and keep its run threshold on Standard; the browser test covers deploy, the hint, the guide and a second action.
