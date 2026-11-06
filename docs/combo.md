# Combo Ball

Game 87, `/combo`. A turn-based pixel-art football roguelite where a goal is worth the passing move that made it. Dora, Enzo and Pip (with Tuft in goal) play three-a-side against the animal league on the shared tactics pitch, `lib/tactics-football.ts`, the same engine as Rulebook FC. Every completed pass adds chips to a chain, a first-time pass adds mult, and a goal scores (10 + chips) × mult. A lone dribble and shot scores 10; a chain of first-time passes can score hundreds. The other side touching the ball wipes the chain, and the longer it runs the harder they press. It was built on 06-11-2026 as a real-time game and made turn-based on 06-11-2026, because the real-time version was too hard to play.

## Files

| File | What it is |
|---|---|
| `lib/combo-game.ts` | The rules on top of the tactics engine, deterministic with no DOM: the league (`TEAMS`, each a `Level` style), the targets, the chain's worth pass by pass (`chainValue`), the 14 traits, the hooks that make a goal worth chips × mult and raise the pressing, Nutmeg, Ricochet and Piggy Bank, the chain-aware Hint, the run (team sheet, match, transfer shop, result) and the save. |
| `lib/tactics-football.ts` | The shared turn-based engine (moves, passes, long balls, shots, tackles, the other side's plan, undo, the hint). Combo Ball added three small things to it: each pass record keeps where its passer and receiver stood (`a`, `b`), the state has a `data` bag for a game's own numbers (snapshotted by undo), and two hooks, `onChainReset` (the chain is about to be wiped) and `golden` (whether a level match goes to a golden turn). |
| `lib/combo-scene.ts` | Canvas 2D drawing at 384 by 256 pixels, scaled up with nearest-neighbour: the pitch with the fence above and the hedge below the 15 by 9 board, the chain as a gold line through every pass of it, their plan for the next turn (red arrows and tackle cells, the ball's yellow route), our selected player's cells and previews, the hint, everyone in their own sprites, and the turn's playback. On a phone held upright the board turns so we attack upward. |
| `app/combo/page.tsx` | The page: the bar above the pitch (points against the target, the chain as chips × mult with what a goal is worth now, the pass count and the pressing, the turn), the pop-up for each pass, the goal banner, the explainer and Undo, Hint and End turn below the pitch, the team sheet, the transfer shop, the how-to, settings, results and the save. Exposes `window.__combo()` with `debug` helpers for the browser tests. |
| `app/combo/sound.ts` | Synthesised effects (footsteps, kicks, a gain that climbs with the chain, the wipe, shots, saves, the post, tackles, the whistle, the crowd) and five original chiptune loops (title, match, the last three turns, the shop, ending). |
| `app/combo/combo.css` | The match-day look. All words sit in the bars above and below the pitch, so nothing ever covers a player. |
| `public/art/combo/` | The pitch, title and ending (see **Art**). The players come from the shared `public/art/kickabout/`. |
| `scripts/combo-art.py` | Turns the Codex paintings into the pitch, title and ending. |
| `tests/combo.mjs`, `tests/combo-bot.mjs`, `tests/e2e/combo.mjs` | Engine checks, bots and the browser suite. |

## The chain

The chain is our run of completed passes. It carries over from one turn to the next, and anything that gives them the ball (a pass cut out, a tackle, a save they keep, a goal) wipes it. A goal is worth (10 + chips) × mult, from the chain as it stands when the shot goes in. Each pass adds:

- **10 chips** for any completed pass;
- **+10 chips** for a long pass (5 cells or more);
- **+5 chips** for a lofted pass (a long ball someone catches);
- **+10 chips** for a switch of play (4 rows or more across);
- **+1 mult** for a first-time pass: played on by someone who received the ball this turn and hasn't moved since;
- **nothing at all** for a pass straight back to whoever just passed (ping-pong).

**Pressure:** for every 4 passes in the chain the other side presses with one more player and lunges one cell further (at most +2), planned at the start of each turn. Cool Head halves the rate.

## Traits

Fourteen traits, sold three at a time in the transfer shop after each target is reached. Five slots; a sixth replaces one.

| Trait | What it does |
|---|---|
| Metronome | Every 5th pass in a chain doubles the chips so far. |
| Route One | Long passes give +2 mult instead of +10 chips. |
| Ricochet | Their keeper's saves bounce back to us, and the chain lives on with +10 chips. |
| Backpass Bandit | Passes backwards give +1 mult. |
| Crossfield | Switches of play give +1 mult as well. |
| Volley | A shot by someone who caught a lofted pass this turn scores double. |
| Hot Streak | Each goal this match adds +1 mult to every goal after it. |
| Cool Head | Their pressing builds up half as fast. |
| Long Range | Goals from 7 cells out or more get +3 mult. |
| Tiki-Taka | First-time passes give +2 mult, but other passes add no chips. |
| Nutmeg | Dribbling through a cell next to two of them adds +5 chips. |
| Piggy Bank | After a goal, half its chips carry into our next goal. |
| Late Show | Goals in the last 3 turns score double. |
| Backheel | Enzo's first-time passes backwards give +2 mult. |

## Controls

Tap or click one of ours to see the cells they can reach (2 cells; 1 when they have the ball), and a cell to move there. With the ball, tap a team-mate to pass, an empty cell 3 to 7 away for a long ball, or their goal to shoot: each is previewed first (green works, red doesn't, the keeper's covered cells in blue, the goal's worth in the explainer) and played with a second tap. Four passes a turn. When they have the ball, tap their carrier from beside them to tackle. Hovering, or holding on a phone, explains what anyone is about to do. **Undo** (Z) takes back anything until **End turn** (Enter); **Hint** (H) shows a good move, never a ping-pong pass, and a shot once the chain is worth cashing in. During playback, a tap or End turn skips it. In the transfer shop, 1 to 3 pick a trait.

## The league

| Match | Team | How they play |
|---|---|---|
| 1 | Rabbit Rangers | Quick: they move 3 cells, but only lunge 1 cell to tackle. A weak keeper. |
| 2 | Frog Wanderers | They win any lofted pass that lands next to one of them. A weak keeper. |
| 3 | Mole Miners | Every other turn one mole tunnels to any free cell within 4. |
| 4 | Otter Athletic | Two press; with the ball they pass twice in one go. |
| 5 | Hedgehog Hotspurs | Two press, lunging into every cell up to 2 away. |
| 6 | Magpie Rovers | They steal any pass that goes past next to a magpie. |
| 7 | Fox Forest | They read two passing lanes and break 3 cells at a time with the ball. |
| 8 | Badger Borough | They move 1 cell, but can't be tackled from the front. |
| 9 | Grumble Galacticos | The final: four of them, quick, thieving and slick on the ball. |

Leagues: Pebble (matches 1 to 3), Meadow (4 to 6), Summit (7 to 9). Their sprites are `public/art/kickabout/<id>-*`; the team sheet shows their captain's portrait (`<id>-big`) with the words beside it, never over it.

## The run

Nine matches of 16 turns each. Each match has a points target: 40, 60, 100, 200, 320, 500, 1200, 3000 and 8000. Reach it and the match ends there and then; the transfer shop opens with three traits. Every goal they score raises the target by 15% of the match's own target. Full time short of the target ends the run. A level score doesn't go to a golden turn. The save, under `combo-ball-v2`, keeps whether the how-to has been seen, the best run (matches won, biggest goal, longest chain), totals and the sound and music settings; old real-time saves are ignored.

## Art

All the art is Codex-painted pixel art. The players, keepers and ball are the shared kickabout sprites in `public/art/kickabout/` (made by `scripts/kickabout-art.py`), the animal teams included. `scripts/combo-art.py` makes the rest: the pitch seen from above at 384 by 256, with the fence along the top and the hedge along the bottom framing the board; the title (Dora volleying a golden ball at the end of a zig-zag of golden passes); and the ending (the trophy at sunset). Each is shrunk with a box filter to a small palette. The source paintings are not in the repo.

## Bots and balance

`tests/combo-bot.mjs` plays whole runs:

- **pro** searches each turn with the engine's own previews: every pass, long ball and shot its carrier could make (after a dribble or not), and what each receiver could do next, up to three passes deep, playing each through the engine and undoing it. It cashes the chain in when the shot is worth more than the chain is likely to grow to, or reaches the target. Then it moves everyone else into open cells away from the tackle zones. Defending, it stands in the way of their pass or shot, or tackles a dribbler. It buys traits that combine (Crossfield, Route One, Backpass Bandit, Metronome first).
- **blind** plays the same football but takes the first trait it's offered.
- **casual** presses Hint and does what it says until Hint has nothing more (at most four times), then ends the turn.
- **random** moves and kicks at random.

With `--quick` (20 runs each) at the time of writing: the pro clears 7.5 of 9 matches and wins 15% of runs; blind clears 6.5; casual clears the first two matches in all 20 runs and about 3 matches in all; random never scores. The asserts: casual clears the first two most of the time, the pro clears 5 or more on average, beats blind by at least half a match and wins 10 to 35% of runs, and random never wins.

## Ideas not done

- Set pieces: corners and free kicks that start a chain with a bonus.
- A replay of the best goal of the run, drawn with its chain line, on the result card.
- A daily seed.
