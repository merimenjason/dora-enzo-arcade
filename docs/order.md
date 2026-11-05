# Turn Order

Game 84, `/order`. A pixel-art puzzle roguelite where you never move a piece: every garden critter does its one thing each round, in the order of the queue, and all Enzo can do is swap two neighbours in that queue. It was the top systemic roguelite concept in [`systemic-roguelites.md`](systemic-roguelites.md) and the second pick of the unbuilt game ideas on 05-11-2026.

## Files

| File | What it is |
|---|---|
| `lib/order-game.ts` | The rules, deterministic with no DOM: the verbs, a round, the solver, the board generator, the run, perks and the save. |
| `lib/order-scene.ts` | Canvas 2D drawing at 384 by 216 pixels, scaled up with nearest-neighbour: the garden, the board, queue numbers, facing arrows, the ghost preview and a round played step by step. |
| `app/order/page.tsx` | The queue bar, the board, the buttons, Enzo's pointers, the perk picker, results and the save. Exposes `window.__order()` with `debug` helpers for the browser tests. |
| `app/order/sound.ts` | Synthesised effects (a drum-roll tock for each turn, rising through the round) and four original chiptune loops (title, garden, the Grumble King's bed, ending). |
| `app/order/order.css` | The garden look. The page is a column: HUD, queue bar, garden, buttons. On a narrow screen the garden zooms in on the board. |
| `public/art/order/` | The art (see **Art**). |
| `scripts/order-art.py` | Turns the Codex paintings into the game's pixel art. |
| `tests/order.mjs`, `tests/order-bot.mjs`, `tests/e2e/order.mjs` | Engine checks, bots and the browser suite. |

## The board

An 8 by 8 lawn with a few cobble walls, a pot, one golden acorn, rocks and critters. Each critter has a place in the queue (its number shows in the corner of its tile) and most face a way (a white arrowhead on that edge).

| Critter | Its turn |
|---|---|
| **Hedgehog** | Rolls one tile forward, pushing the whole line of things in front of it. If the line would hit a wall, the edge, a sleeping mole or the pot (unless the acorn is the one going in), nothing moves and the hedgehog turns round. Pushing the acorn into the pot plants it. |
| **Frog** | Eats one small neighbour (an acorn, a mushroom or a snail), looking ahead first, then round to the right. |
| **Mushroom** | Grows a new mushroom into the first empty neighbour, ahead first then round to the right, facing the same way. The new one joins the end of the queue and first acts next round. At most 14 critters on a board. |
| **Bomb Beetle** | Clears everything in the 3 by 3 square round it, itself included. Walls and the pot stay. |
| **Snail** | Turns each critter next to it (not diagonally) a quarter turn to the right. |
| **Mole** | Asleep, it's as solid as a wall and can't be pushed. A hedgehog that bumps into it wakes it, and on its next turn it burrows away. |
| **Grumble** | If the acorn is next to it, steals it. Otherwise steps one tile towards it, the longer way first. |
| **Rock** | Does nothing; a hedgehog can push it. |

The acorn is lost if it's eaten, blown up or stolen. Then, or when the rounds run out without the acorn in the pot, the garden starts again from the beginning and the run loses a try.

## A round

1. **Plan.** One swap of two neighbours in the queue (two in each board's first round with **Encore**). A **token** sends any critter to the front of the queue. With **Lullaby**, once a board, one critter can be sung to sleep so it skips the round. **Undo** puts the queue back and gives tokens back. The **ghost** shows what the round will do: dotted paths and faded copies where things end up, red crosses on what won't survive, a gold square on the pot if the acorn will land, and a one-line verdict under the board.
2. **Go.** Every critter acts once, in the queue's order. Critters removed earlier in the round are skipped, and the round stops the moment the acorn is planted or lost.
3. **Twists.** From the fifth garden, half the gardens have one: the queue turns back to front after every round, or the first in the queue goes to the back.

**Hint** (costs a token): Enzo runs the solver and says which swap to make this round, or to leave the queue alone. **Restart** (from the second round on) starts the garden again for a try.

## The run

- Eleven gardens: three on **The Lawn** (hedgehogs and frogs), three in **The Vegetable Patch** (mushrooms, snails, rocks), four in **The Rockery** (beetles, moles, Grumbles too) and **The Grumble King's Bed** (everything, a Grumble, the back-to-front twist and a round to spare).
- Three tries, two tokens to start. Planting an acorn within **par** (the solver's fewest rounds) earns a token.
- After each garden, pick one of three perks from Enzo's satchel:

| Perk | Most | Effect |
|---|---|---|
| Pocket of buttons | 3 | Two more tokens. |
| Spare basket | 2 | One more try. |
| Long afternoon | 2 | One more round on every board. |
| Lullaby | 1 | Once a board, one critter skips a round. |
| Encore | 1 | Two swaps in the first round of every board. |

## Making the gardens

`makeBoard(seed, index)` builds a garden from the run's seed. It puts the pot, the acorn and a hedgehog facing them on one line (the acorn two to four tiles from the pot, or two or three on the Lawn; the hedgehog right behind it or one tile further back), a few walls off that line, a frog and then more critters from the place's pool near the line, and rocks from the Vegetable Patch on, and shuffles the queue. It keeps the garden only if:

- leaving the queue alone every round does **not** win;
- the solver can win it in at least two rounds (three after the Lawn), within five (six in the King's bed);
- at most half of the first round's choices still lead to a win.

The garden then gets the solver's fewest rounds, plus one in the first two gardens and in the King's bed. If 120 tries fail, it eases off (fewer critters, any winnable garden that isn't won by doing nothing). The solver is a breadth-first search over the choice each round (no swap, or one of the neighbour swaps), skipping repeated positions; a garden takes at most about 100 ms to make.

## Art

All the art is Codex-painted pixel art: two 2×2 critter sheets on flat magenta (hedgehog, frog, mushroom, Bomb Beetle; snail, mole, golden acorn, pot), a heroes sheet (Enzo on his podium with a baton, Dora with her basket, a Grumble, a mossy rock), a tile sheet (two lawn greens, soil, a cobble wall), the garden, the title, the ending and portraits of Dora and Enzo. `scripts/order-art.py` keys the magenta, crops and shrinks each sprite with a box filter and a small palette, shrinks the tiles to 24 by 24, fits the garden to 384 by 216, and makes 24 by 24 queue-bar faces. The source paintings are not in the repo.

## Bots and balance

`npm run bot:order` (with `--quick`, four runs, part of `npm test`), ten seeded runs:

| Bot | Plays | Result (05-11-2026) |
|---|---|---|
| Conductor | The solver's choice every round. | 10 of 10 won, no slips. Must win every run. |
| Myopic | Keeps the acorn alive this round and moves it as near the pot as it can, like a player who reads the ghost but doesn't plan. | 0 of 10 won, 4.7 gardens on average. Must do worse than the conductor. |
| Random | A random swap (or none) each round. | 0.5 gardens on average. Must be at least six gardens behind. |
| Never | Never swaps. | 0 gardens: the generator guarantees it. |

A person also has tokens, hints and perks, which the bots don't use.

## Ideas not done

- The concept's conductors (a starting choice of queue rule) and more verbs unlocked between runs.
- Carrying a critter on to the next garden after clearing one with rounds to spare.
- A daily seed, and an undo for a whole round.
