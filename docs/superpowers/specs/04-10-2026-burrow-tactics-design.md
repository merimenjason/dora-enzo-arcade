# Burrow Tactics · design

Written 04-10-2026. Game 22 of Dora & Enzo's Arcade, at `/tactics`.

## What the user asked for

- A new offline game: turn-based tactics in the style of Into the Breach, starring the chinchillas.
- Structure: a short hand-made campaign that teaches the rules, then a roguelite run as the main mode.
- Look: isometric Canvas 2D in the arcade's clean-line style, using the shared `drawChinchilla`.
- Built overnight without sign-off stops; pushed as a draft pull request, never merged.

Everything below this line is my design, not something the user specified.

## The idea in one paragraph

Predators raid a meadow of burrows. Every predator shows exactly what it will hit next turn. You have three chinchillas, each with one move and one action a turn, and almost every action **pushes** something. You rarely win by damage alone: you win by shoving a fox into the stream, pulling a snake so it spits on an owl, or hiding a burrow behind a dust cloud. Hold out for a set number of turns and the predators give up.

## Rules

**Board.** 8 × 8 tiles. Terrain: grass, water, bramble. Features on a tile: rock (blocks, cannot break), hay bale (blocks, breaks when hit), burrow (blocks, must be protected), rubble (a collapsed burrow, walkable). Dust clouds sit over a tile for two predator phases.

**The warren.** A shared health pool. Every burrow that is hit collapses and costs 1 warren. Warren at 0, or every chinchilla down, loses the battle.

**A turn.**
1. Player phase. Each chinchilla may move (up to its move, through allies, not through predators or features, never into water) and then act once. Acting ends that chinchilla's turn. A move can be undone until the chinchilla acts, and the whole turn can be reset once per battle.
2. Predator phase. Telegraphed attacks resolve in the numbered order shown. Then predators emerge from rustling-grass marks; a mark that is stood on is blocked (the blocker takes 1 damage and the mark stays). Then every predator moves and telegraphs its next attack. Then new marks appear. Dust clouds fade by one.
3. After the last turn's predator phase the battle is won. It is also won early if no predators and no marks remain.

**Pushing.** A pushed unit moves one tile. Off the board: nothing happens. Into a feature or another unit: it does not move, and both take 1 bump damage (a bale breaks, a burrow collapses). Into water: ground predators drown, chinchillas are soaked and cannot act while they stand there. Into bramble: 1 damage. Flying units ignore water and bramble.

**Attacks follow the attacker.** A telegraphed attack is a direction, not a fixed tile. Push the predator and its attack moves with it. A predator standing in a dust cloud when its attack comes up does nothing.

## Chinchillas

| Name | HP | Move | Action |
| --- | --- | --- | --- |
| Dora | 3 | 4 | **Seed Shot**: a straight line; the first thing hit takes 1 and is pushed away. |
| Enzo | 4 | 3 | **Tail Whack**: an adjacent tile takes 2 and is pushed away. |
| Pip | 2 | 5 | **Dust Puff**: lobbed 2 to 4 tiles in a line; a dust cloud lands there and everything next to it is pushed outward. |
| Grandpa Pebble | 5 | 3 | **Hay Toss**: lobbed 2 to 3 tiles in a line; an empty tile gets a hay bale, an occupied one takes 1. |
| Mochi | 3 | 4 | **Tug**: a straight line; the first unit hit is pulled next to her. |
| Biscuit | 3 | 4 | **Pounce**: leaps 2 to 4 tiles in a line to an empty tile; everything next to the landing takes 1 and is pushed outward. |

Everyone can also **Groom** (heal 1) as their action. Dora and Enzo start unlocked; the other four are unlocked by the campaign.

## Predators

| Name | HP | Move | Attack |
| --- | --- | --- | --- |
| Fox | 3 | 3 | **Bite**: the tile in front, 1. |
| Snake | 2 | 2 | **Spit**: a straight line, the first thing hit takes 1. |
| Owl (flies) | 2 | 4 | **Swoop**: flies in a line until something is in the way; it takes 2 and is pushed. |
| Weasel | 2 | 4 | **Lunge**: the two tiles in front, 1 each. |
| Badger | 5 | 2 | **Sweep**: the tile in front and the two beside it, 2 each. |
| Hawk (flies) | 3 | 4 | **Dive**: one tile 2 to 4 away in a line, 2. |
| Mountain Cougar (boss) | 9 | 3 | **Rake**: all four adjacent tiles take 2 and are pushed outward. Too heavy to drown. |

Alpha predators (later battles) have +2 HP and +1 damage.

**Predator thinking.** In id order, each predator scores every tile it can reach with every direction: burrows and chinchillas are worth points, hitting another predator costs points, ending in bramble or a dust cloud costs points, and with nothing to hit it closes on the nearest target. Ties break on the seeded generator. This is the only place a battle uses randomness after it is set up, and it runs after attacks resolve, so what the game forecasts for the coming predator phase is exactly what happens.

## Modes

**Campaign.** Ten fixed missions, each teaching one idea, with up to three stars: win, lose no burrow, and one mission-specific bonus. Winning mission 5 opens the run.

**The Long Night (run).** Pick three unlocked chinchillas. Seven battles on generated boards: two in the Meadow, two in the Foothills, two in the High Pass, then the Mountain Cougar. Warren 5 carries through the run. After each battle pick one of three rewards: an upgrade for one chinchilla (+1 HP, +1 move, or +1 damage), a relic, or a warren repair. A chinchilla knocked out in a battle comes back with 1 less maximum HP. The run is seeded and saves at the start of every player turn.

**Relics.** Thick Fur (each chinchilla ignores the first damage of a battle), Reinforced Doors (each burrow survives its first hit), Spring Paws (+1 bump damage to predators), Burr Seeds (+1 bramble damage to predators), Quick Start (+1 move on turn 1), Deep Roots (blocking a mark does not hurt).

## What makes it readable

- Red tiles and arrows for every telegraphed attack, with the attack order numbered on the predators.
- Before you confirm an action, the board shows its result: where things are pushed, what takes damage, and how the predators' attacks shift.
- A forecast line: what the warren and each chinchilla will lose if you end the turn now.

## Code

The arcade's usual split.

- `lib/burrow-tactics-game.ts`: rules. `Battle` is plain data plus methods and can be cloned, which is how previews, forecasts, the reset-turn button, saving and the bot all work. `Run` holds the run. `MISSIONS` holds the campaign. Seeded, no DOM.
- `lib/burrow-tactics-scene.ts`: isometric drawing, the event player that animates what the engine resolved, and the tile picker.
- `app/tactics/`: page, layout metadata and styles. Saves under `burrow-tactics-v1` (campaign) and `burrow-tactics-run-v1` (run). `window.__tactics()` exposes the battle to the browser test.
- `tests/burrow-tactics.mjs`, `tests/burrow-tactics-bot.mjs`, `tests/e2e/burrow-tactics.mjs`.

## Testing

- Engine suite: movement, every ability and attack, pushing and bumping into each kind of thing, water, bramble, clouds, marks, attack-follows-attacker, forecast equals outcome, undo, reset, win and lose, snapshot round trip, run rewards and seeding.
- Bot: a planner that tries each chinchilla's options on cloned battles. It must win every campaign mission and a set share of seeded runs; an idle player must lose. The share is the balance check and is enforced by `npm test`.
- Browser suite: menu card to a won mission, keyboard play, a run started and resumed, and a phone-sized screen.

## Out of scope for the first version

Choosing where to deploy, unit heights, fire, difficulty settings, two-player.
