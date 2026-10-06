# Poof Panic

Game 25, at `/poof`. A versus falling-pair puzzler in the style of Puyo Puyo: pairs of fluff balls fall into a well, four of a colour that touch pop, and chains of pops bury the other player in dust.

Built on 06-10-2026. The rivals were set with the bot only; nobody has yet played it by hand, so how the pace and each rival feel to a person are first guesses.

## The board

- A well is 6 columns by 12 rows, with a thirteenth row hidden above. Balls in the hidden row are never part of a group.
- Pairs start upright in the third column. They are dealt from one seeded bag that both boards read, so both players get the same pairs in the same order. There are four colours; the first two pairs use three at most.
- A pair can be moved, turned either way, and pushed down. Turning into a wall or a stack pushes the pair off it; turning the second ball underneath on the floor lifts the pair. In a gap one column wide a turn cannot happen, and a second press within 24 ticks swaps the two balls instead.
- A pair resting on something locks after 32 ticks (the game runs at 60 ticks a second). Moving or turning restarts that wait up to 8 times; pushing down makes it four times as quick.
- A pair laid flat comes apart when it lands: each ball falls on its own.
- The round is lost when the top visible cell of the third column, marked ✕, is full when the next pair is due.

## Pops, chains and points

- Four or more balls of one colour touching side to side or up and down pop. Everything above falls, and if that makes a new group it pops as the next link of the chain.
- A link scores 10 points a ball, times the sum of three bonuses (at least 1, at most 999):
  - the chain: 0 for the first link, then 8, 16, 32, 64, 96, 128 and 32 more for each link after that;
  - colours popped at once: 0 for one, 3 for two, 6 for three, 12 for four, 24 for five;
  - group size: 0 for four, 2 for five, 3 for six, up to 7 for ten and 10 for eleven or more.
- So four balls are 40 points, a two-chain of fours is 40 + 320, and a three-chain 40 + 320 + 640.
- Pushing a pair down scores 1 point a row. Those points never become dust.

## Dust

- Every 70 points from pops make one dust clump for the rival. Points left over carry on to the next pop.
- Dust made by a pop first cancels dust waiting above your own board, clump for clump. Only what is left is sent.
- Dust sent by a chain cannot fall until that chain has finished.
- Dust lands after a pair that popped nothing, 30 clumps (five rows) at most at a time. Whole rows land as rows. The odd clumps land the way the sender throws them: **Dora** sprinkles them over different columns, **Enzo** heaps them side by side. Each rival does one or the other.
- Dust never matches. A clump goes when something pops right beside it.
- Emptying the whole board is a **clean sweep**: your next pop sends 30 extra clumps.
- After 96 seconds a clump gets a quarter cheaper every 16 seconds, down to 8 points, so no round lasts for ever.

## Ways to play

- **Rival ladder.** Six rivals, each match first to two rounds. Lose a match and you play that rival again. The climb is saved between matches. Reaching the top with a chinchilla opens the hard ladder for that chinchilla.
- **Hard ladder.** The same six, changed as in the second table below.
- **Free match.** Any rival you have reached on a ladder; at hard-ladder strength too once either chinchilla has climbed the ladder.
- **Endless.** No rival. A level every 12 pairs; a row takes 0.67 s to fall at level 1 and a fifth less each level, down to two ticks. From level 4 each new level blows in dust: one clump fewer than the level number, 12 at most. The best score, level and chain are kept.
- **Chain lessons.** Twelve set boards with a few set pairs each. Pairs wait at the top until you drop them.

## The rivals

A rival picks a place for each pair, then walks the pair there one press at a time, as a player would. It looks at the pair for a while first, makes one press every few ticks, and pushes down for a share of the ticks once the pair is in place. **Fires at** is the shortest chain it sets off on purpose; it fires anything it has when its board is in danger. **Slips** is how often it puts a pair down anywhere at all, and **pokes** how often it takes a small pop just to send something.

| # | Rival | Looks at a pair (ticks) | Ticks a press | Push down | Pairs planned | Fires at | Slips | Pokes | A row takes | Dust |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mossy the Mole | 50 | 16 | 10% | 1 | 1 | 50% | 100% | 0.73 s | sprinkle |
| 2 | Pongo the Skunk | 42 | 13 | 20% | 1 | 1 | 36% | 100% | 0.67 s | sprinkle |
| 3 | Whip the Weasel | 28 | 10 | 40% | 1 | 2 | 16% | 25% | 0.60 s | heap |
| 4 | Brock the Badger | 24 | 10 | 45% | 1 | 3 | 10% | 10% | 0.53 s | sprinkle |
| 5 | Professor Hoot the Owl | 20 | 8 | 55% | 1 | 4 | 6% | 5% | 0.47 s | heap |
| 6 | Sierra the Cougar | 16 | 7 | 65% | 2 | 4 | 4% | 3% | 0.40 s | sprinkle |

On the hard ladder:

| # | Rival | Looks at a pair (ticks) | Ticks a press | Push down | Pairs planned | Fires at | Slips | Pokes | A row takes | Dust |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mossy the Mole | 30 | 10 | 35% | 1 | 1 | 20% | 100% | 0.56 s | sprinkle |
| 2 | Pongo the Skunk | 25 | 8 | 45% | 1 | 1 | 14% | 100% | 0.51 s | sprinkle |
| 3 | Whip the Weasel | 17 | 7 | 65% | 2 | 3 | 6% | 25% | 0.46 s | heap |
| 4 | Brock the Badger | 14 | 7 | 70% | 2 | 4 | 4% | 10% | 0.41 s | sprinkle |
| 5 | Professor Hoot the Owl | 12 | 5 | 80% | 2 | 5 | 2% | 5% | 0.36 s | heap |
| 6 | Sierra the Cougar | 10 | 5 | 90% | 2 | 5 | 2% | 3% | 0.31 s | sprinkle |

### What the bot found

`npm run bot:poof` plays three stand-in players, written as rivals, against the six. Share of rounds the stand-in won, over 30 rounds each, on 06-10-2026:

| Stand-in | Mossy | Pongo | Whip | Brock | Hoot | Sierra |
|---|---|---|---|---|---|---|
| Novice: pops whatever turns up, slowly | 83% | 50% | 3% | 3% | 0% | 0% |
| Casual: makes two-chains | 100% | 93% | 83% | 40% | 10% | 0% |
| Keen: builds three-chains | 100% | 100% | 100% | 97% | 73% | 23% |
| Sharp: plans two pairs ahead, fires fours | 100% | 100% | 100% | 100% | 100% | 97% |

On the hard ladder the same four won 23%, 93%, 100%, 100% of rounds against Mossy and 0%, 7%, 3%, 37% against Sierra.

Each rival beat the one below it in 77% to 90% of rounds. Rounds against the casual stand-in lasted 35 to 56 seconds; the rivals' longest chain a round averaged 0.9 for Mossy up to 4.4 for Sierra.

## The lessons

| # | Lesson | Pairs | Goal | What it teaches |
|---|---|---|---|---|
| 1 | Four of a kind | 1 | Make a 1-chain | Four fluff balls of one colour that touch will pop. |
| 2 | Split the pair | 1 | Pop every fluff ball | A pair laid flat comes apart: each ball falls on its own. |
| 3 | One thing leads to another | 1 | Make a 2-chain | When a pop lets other balls fall into a new group, that is a chain. |
| 4 | Stairs | 1 | Make a 3-chain | Three of a colour in a column with the next colour on top, again and again: the classic staircase. |
| 5 | Sandwich | 1 | Make a 2-chain | Two halves of one colour with another colour between them. Pop the filling and the halves meet. |
| 6 | Dust off | 1 | Clear every dust clump | Dust clumps never match. They vanish when a pop happens right beside them. |
| 7 | Build your own | 2 | Make a 2-chain | Now set the chain up yourself: finish the second step, then pull the trigger. |
| 8 | Clean sweep | 2 | Pop every fluff ball | Empty the whole board and your next pop sends thirty extra clumps. |
| 9 | Three steps | 3 | Make a 3-chain | Two steps are built. Add the third and fire. |
| 10 | Dig out | 1 | Make a 2-chain | A clump in the way goes when something pops beside it, and whatever stood on it falls into the gap. |
| 11 | Long fuse | 2 | Make a 4-chain | One flat pair can finish two jobs at once: a cap for one step and the third ball of the next. |
| 12 | Five alarm | 2 | Make a 5-chain | A full staircase. Finish the missing step and set off all five. |

`tests/poof-panic.mjs` solves every lesson by search, plays the first answer through a real board key by key, and checks that dropping every pair straight down does not solve any lesson but the first.

## Saving

Everything is kept in `localStorage` under `poof-panic-v1`: sound, the landing guide, the chosen chinchilla, which ladders each chinchilla has climbed, the furthest rival reached, the longest chain, the endless records, the lessons done, and the climb in progress (chinchilla, ladder, rung, score, time and matches lost). A match in progress is not saved; a climb left in the middle of a match comes back at the start of that match.

## Code

- `lib/poof-panic-game.ts`: the rules. Grid functions (`collapse`, `findPops`, `resolve`, `land`), `Board`, `Pad` (keys and touches as one input a tick), `Brain` and `RIVALS`, `Match`, `Endless`, `Drill` and `LESSONS`, and `solve` for checking lessons.
- `lib/poof-panic-scene.ts`: drawing. `Stage.feed` turns a board's events into particles, chain call-outs and flying dust; `Stage.draw` lays out one or two boards for wide and narrow screens.
- `app/poof/page.tsx`: the menu, the loop (60 engine ticks a second whatever the screen does), input, saving, and the cards between rounds. `window.__poof()` gives the browser test the game, and lets it put a rival's brain on the player's side or fast-forward.
