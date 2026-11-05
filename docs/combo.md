# Combo Ball

Game 87, `/combo`. A pixel-art football roguelite where a goal is worth the passing move that made it. Dora, Enzo and Pip (with a keeper) play three-a-side against the Grumbles; every completed pass adds chips to a chain, one-touch passes add mult, and a goal scores (10 + chips) × mult. A lone dribble and shot scores 10; five quick passes and a first-time finish can score hundreds. A Grumble touching the ball wipes the chain, and the longer it runs the harder they press. It was built on 06-11-2026 from the football roguelite mock-ups.

## Files

| File | What it is |
|---|---|
| `lib/combo-game.ts` | The rules, deterministic at 60 ticks a second with no DOM: the person's player (running, ground and lofted passes, shots with power, first-time plays pressed early, slides), the team-mates' and Grumbles' play (support triangle, marking, pressing, tackles with a wind-up), the keepers, the ball (rolling, flight, bounces, posts and goals), the chain and what each pass adds, goals and their worth, the clock, the targets, the transfer shop and the save. |
| `lib/combo-scene.ts` | Canvas 2D drawing at 384 by 216 pixels, scaled up with nearest-neighbour: the pitch and its lines, both goals, the chain as a gold line through every touch (thicker with more mult, a grey ghost when it's wiped), the players sorted by depth with the ball between them, the gold ring and arrow on the person's player, a Grumble's white flash and red mark as it winds up a tackle, bursts, and the shake and flash of a goal. |
| `app/combo/page.tsx` | The fixed-step loop, the HUD (points against the target, the chain as chips × mult with the worth and a pressing bar, the clock), the chain's news and a goal's count-up in the top band, Enzo's opening and pointers, the transfer shop, pause, results, how to play, settings and the save. Input is keys and the mouse, or a thumb stick and PASS, SHOOT/TACKLE and SWITCH. Exposes `window.__combo()` with `debug` helpers for the browser tests. |
| `app/combo/sound.ts` | Synthesised effects (kicks, a gain that climbs with the chain, the wipe, shots by power, saves, the post, the tackle wind-up, the whistle, the crowd, the till rattling through a goal's count-up) and five original chiptune loops (title, match, the last twenty seconds, the shop, ending). |
| `app/combo/combo.css` | The match-day look. The HUD sits over the fence at the top of the pitch and Enzo and the traits over the hedge at the bottom, so no words ever cross a player. On a phone held upright the HUD goes above the pitch and the thumb pad below; on its side, Enzo and the buttons get a column to the right of the pitch. |
| `public/art/combo/` | The pitch, title and ending (see **Art**). The players come from the shared `public/art/kickabout/`. |
| `scripts/combo-art.py` | Turns the Codex paintings into the pitch, title and ending. |
| `tests/combo.mjs`, `tests/combo-bot.mjs`, `tests/e2e/combo.mjs` | Engine checks, bots and the browser suite. |

## The chain

The chain belongs to whichever side has the ball and starts at 0 chips and ×1 mult. A completed pass to a team-mate adds:

| Pass | Adds |
|---|---|
| Any completed pass | +10 chips |
| One-touch (the passer had the ball under half a second) | +1 mult |
| Long (over 100 pixels) | +10 chips |
| Lofted (pass held for a fifth of a second or more) | +5 chips |
| A switch (more than 70 pixels across the pitch) | +10 chips |
| Straight back to whoever passed it to you | nothing (and the pass still counts towards the chain's length) |

A goal scores (10 + chips) × mult, with +1 mult more for a first-time finish at the end of a chain. A Grumble getting a touch (a tackle, an interception, a block, a keeper's save) wipes the chain. Pressing grows with the chain: each pass adds 5% to the Grumbles' speed and bite, up to +32%. But the chain also leaves the Grumble keeper chasing shadows: for each pass up to six he reacts 35 ms later and moves 7% slower across his goal, which is what makes a long move's finish more likely to go in than a lone dribble's.

## Controls

| Action | Keys and mouse | Touch |
|---|---|---|
| Run | WASD or the arrows | thumb stick (it appears wherever the thumb lands) |
| Pass to the team-mate you're pointing at | J or Space (tap: along the ground; hold: lofted) | PASS (tap or hold) |
| Pass to a point | click there | |
| Shoot (hold for power; up or down picks a corner) | K or Shift, or the right mouse button | SHOOT |
| Slide tackle (when the Grumbles have the ball) | K or Shift | TACKLE |
| Switch player (defending) | L | SWITCH |
| Pause | Esc or P | ❚❚ |

You always play whoever has the ball. Pressing pass or shoot while a pass is on its way to you queues a first-time play for when it arrives (it waits 0.6 seconds).

## The Grumbles

Three leagues of three matches, ninety seconds each. Their numbers by match (0 to 8):

| | Formula | Match 1 → 9 |
|---|---|---|
| Speed | 46 + 2m | 46 → 62 (ours is 64, 58 on the ball) |
| Pressers | 1, then 2 from match 4 | |
| Tackle wind-up | max(0.17, 0.34 − 0.017m) s | 0.34 → 0.20 |
| Passing when pressed | 0.25 + 0.06m | |
| Shooting range | 92 + 4m px | 92 → 124 |
| Keeper speed | 84 + 7m | 84 → 140 |
| Keeper reaction | max(0.05, 0.1 − 0.005m) s, + 0.035 s a pass in our chain | |
| Shot speed | 200 + 9m (+ up to 140 for power) | |

A Grumble only gets a touch on a fast ground pass by luck (less the faster it is), and a lofted pass sails over them.

## The run

Each match has a points target: 100, 160, 240 (Pebble League), 340, 470, 630 (Meadow League), 830, 1080, 1400 (Summit League). Each goal conceded pushes the target up by 15% of its starting value. Reach it before full time and the transfer shop offers three traits; keep up to five, swapping one out for a sixth. Lose a match and the run ends.

| Trait | Effect |
|---|---|
| Metronome | Every 5th pass in a chain doubles the chips so far. |
| Route One | Long passes give +2 mult instead of +10 chips. |
| Ricochet | The ball bouncing off a Grumble counts as a pass (+10 chips) and doesn't wipe the chain. |
| Backpass Bandit | Passes backwards give +1 mult. |
| Crossfield | Switches of play give +1 mult. |
| Volley | A first-time shot from a lofted pass scores double. |
| Hot Streak | Each goal this match adds +1 mult to every goal after it. |
| Cool Head | The Grumbles' pressing builds up half as fast. |
| Long Range | Goals from outside the box get +3 mult. |
| Tiki-Taka | One-touch passes give +2 mult, but other passes add no chips. |
| Nutmeg | Dribbling right past a Grumble adds +5 chips. |
| Piggy Bank | After a goal, half the chips carry into the next chain. |
| Late Show | Goals in the last 20 seconds score double. |
| Backheel | Enzo's one-touch passes backwards give +2 mult. |

The save (`combo-ball-v1`) keeps whether Enzo's opening has been seen, the bests (matches won, biggest goal, longest chain), totals (runs, titles, goals, passes) and the sound and music settings.

## Art

All the art is Codex-painted pixel art. The players, keepers, ball, goal and flags are the shared kickabout sprites in `public/art/kickabout/` (made by `scripts/kickabout-art.py`, also used by Into Space). `scripts/combo-art.py` makes the rest: the pitch seen from above (its mowing stripes run up and down, so a band of plain grass is cut from the middle to bring it to 384 by 216 without losing the fence and the hedge), the title (Dora volleying a golden ball at the end of a zig-zag of golden passes while two Grumbles tumble) and the ending (the trophy at sunset), each shrunk with a box filter to a small palette. The source paintings are not in the repo.

## Bots and balance

`npm run bot:combo` (with `--quick`, ten runs, part of `npm test`), forty seeded runs:

| Bot | Plays | Result (06-11-2026) |
|---|---|---|
| Pro | Passes into the open lane with the most room (lofted over a Grumble in the way), one-touch while the chain builds, queues first-time passes and shots, shoots near the box from four passes on (or when the clock or the target says so), slides in on defence, and picks traits that combine (Tiki-Taka, Metronome, Hot Streak first). | 2 of 40 won, 4.8 matches on average, 406 points a goal, best goal 8320. Must clear at least four matches on average (quick mode) and beat the hoofer by more than one. |
| Greedy | Like the pro, but won't shoot before eight passes. | 0 won, 1.6 matches. |
| Hoofer | Shoots the moment it has the ball. | 0 won, 0.1 matches, 10 points a goal. |
| Random | Random running, passing and shooting. | 0 won, 0.0 matches. Must never win and never average a match. |

Passing is the point: the hoofer scores more goals than anyone in the first match (six or seven) but can't reach 100 at 10 a goal, and the greedy bot loses most of its long chains before it shoots. The quick mode's ten runs come out at about 6.0 matches for the pro. Rerun the bots after changing any number in the tables above.

## Ideas not done

- Set pieces: corners and free kicks that start a chain with a bonus.
- A replay of the best goal of the run, drawn with its chain line, on the result card.
- Two players on one keyboard, and a daily seed.
