# Into Space

Game 88, `/space`. A pixel-art football roguelite about the pass into space. Every pass goes to a spot on the grass, not to a player. The moment it leaves the boot, you take over the runner, the teammate who can get there soonest. A gold ring on the spot shrinks as the ball comes. Arrive just as it closes and the arrival is **perfect**: time slows down, and the next pass or shot is first time. Arrive early and you have to stop and settle it while the Grumbles close in. Arrive late and the ball runs on without you. Dora, Enzo, Pip and Bram, with Tuft in goal, play a seven-round cup of four-a-side matches against the Grumbles. Lose once and the run is over. Built on 06-11-2026 from the football roguelite shortlist in the Game Invention Lab.

## Files

| File | What it is |
|---|---|
| `lib/space-game.ts` | The rules, deterministic at 60 ticks a second with no DOM. It covers passes to a spot (ground and lofted), choosing the runner, rating arrivals, slow motion and the first-time window, shots, tackles, keepers, the Grumbles' AI and team shapes, the four pitches, golden goal, the cup, the changing-room picks and the save. |
| `lib/space-scene.ts` | Canvas 2D drawing at 384 by 216 pixels, scaled up with nearest-neighbour. It draws the painted pitch, chalk lines and the goals; the landing ring, which shrinks to the arrival radius and turns white when the window opens; a dashed line from the runner to the spot; and the pass reticle (straight, or arced for a loft). Players are drawn in depth order, with a ring and a bouncing arrow over the one you control. The ball has a shadow that shrinks with height and a trail. On top come the rain, dust, text pops and a white frame during slow motion. |
| `app/space/page.tsx` | The title, the intro cards, the match HUD (score, clock, the player you control with his stamina, the flow streak, the round, pitch and shape), the input, Enzo's pointers, the changing room, pausing, results and the save. Input is keys and mouse, or a thumb stick plus PASS, SHOOT/TACKLE, SPRINT and SWITCH on a touch screen. The page exposes `window.__space()` with `debug` helpers for the browser tests. |
| `app/space/sound.ts` | Synthesised effects: kicks (a deeper whoomph for a loft), the blip when control jumps, a rising chime for a perfect arrival that climbs with the streak, early and late thuds, landings, bounces, shots, saves, the post, tackles, the whistle, goals and Enzo's chatter. Also five original chiptune loops: title, match, golden goal, changing room and ending. |
| `app/space/space.css` | A floodlit cup night, prefix `is-`. The scoreboard sits in the strip above the pitch's boards and Enzo's pointers sit in the strip below them, so no text covers a player. On an upright phone, the HUD moves above the pitch, and the stick and buttons sit below it. |
| `app/space/layout.tsx` | The page title and description. |
| `scripts/space-art.py` | Turns the Codex paintings into the game's pictures: the four pitches (384 by 216 at 40 colours), the goal (keyed off magenta, 15 by 46 at 8 colours), the title and the ending. |
| `public/art/space/` | `dry`, `wet`, `sand`, `hard`, `goal`, `title`, `ending`. The players, ball and trophy are the shared kickabout sprites in `public/art/kickabout/`. |
| `tests/space.mjs` | Engine checks (see below). |
| `tests/space-bot.mjs` | The balance bots. |
| `tests/e2e/space.mjs` | The browser checks. |

## Passing into space

- **The spot.** You can pick it in four ways:
  - hold **J**, and the target walks out ahead of you from 44 to 184 pixels over three quarters of a second; let go to pass;
  - point with the **mouse** and click;
  - on a phone, drag out from **PASS** the way you want the ball to go, then let go;
  - tap PASS, or tap J, to play it 44 pixels ahead.
- **Loft.** Hold Shift or L, right-click, or on a phone drag further than 80 pixels.
- **Limits.** Passes are 16 to 190 pixels long (`MIN_PASS`, `MAX_PASS`).
- **Ground passes** slow down as they roll. They start fast enough to reach the spot still rolling at the pitch's end speed, so on summer grass a 100-pixel pass takes about half a second.
- **Lofted passes** take (0.34 + distance ÷ 330) seconds and rise up to 50 pixels. Nobody can touch one until 55% of its flight has gone. A Grumble near the path of a ground pass gets one chance to cut it out: 70%, or 45% when the ball is moving faster than 150.
- **The runner** is the teammate who can reach the spot soonest among those who can make it in time. If nobody can, it is the one who'd be least late. **Q** (or SWITCH) moves the run to the next teammate. The runner has to hold his run: reaching the spot too soon is early.
- **Rating the arrival.** The game records when the runner first comes within 9 pixels of the spot (`ARRIVE`) and compares that with when the ball lands:

  | Arrival | When | What happens |
  |---|---|---|
  | **Perfect** | No more than 0.22 s early and no more than 0.13 s late, scaled by the pitch's window | Half-speed slow motion for 0.6 real seconds, and a first-time window of 0.55 s |
  | **Early** | More than 0.22 s early | A 0.5 s settling touch: no passing or shooting, 0.55× speed, and the Grumbles press three times as hard with tackles 30% likelier to win |
  | **Late** | More than 0.13 s late | The streak ends, and it's a loose ball |

- **First time.** In the window, a pass flies 15% faster and a shot is hit at least 85% power, 20% faster, with less than half the spread. A first-time shot also wrong-foots the keeper: he reacts 0.1 s later and his save chance falls by 0.2.
- **The flow streak** counts perfect arrivals in a row. It drives the chime's pitch and the Carousel perk.

## Shooting, defending, keepers

- **Shooting.** Hold **K** (or SHOOT) to charge and let go to shoot. Aim with the mouse, or with up and down. Spread grows with distance and with an over-hit shot. Keepers save with a chance of 1.6 − speed ÷ 300, kept between 0.25 and 0.92. The Grumble keeper reacts 0.012 s quicker and saves 0.01 more each round.
- **Defending.** The same button tackles: 56% to win the ball, or 72% for Bram, with a short stun if you miss.
- **Teammates** run into lanes ahead of the ball and press the carrier. Bram hangs back.
- **Keepers.** Both keepers smother a dribbler in their box. They roll the ball out to the most open teammate.
- **Grumbles.** Two chase a loose ball, one goes for the spot of our pass, one presses the carrier, and the rest hold the team's shape. They run 1.8 faster each round and shoot from further out.

## The cup

Seven rounds, each against a different team: Bramble Rovers, Puddle Athletic, Dune United, Dustbowl Town, Thistle Wanderers, Grumble City, and The Grumble Grand XI in the Final.

- **Matches.** Two minutes. If it's level at full time, it's 30 seconds of golden goal. If it's still level after that, you go through only if you made more perfect arrivals than the Grumbles made interceptions.
- **Pitches.** Round one and the Final are on summer grass. The pitch is rolled when the match before it is won, and it is never the same pitch twice running.

  | Pitch | Ball | Players | Perfect window |
  |---|---|---|---|
  | Summer grass | Rolls true, lofts bounce a little | Full speed | ×1 |
  | Rain | Skids on after landing | ×0.97 | ×0.8 |
  | The beach | Dies where it lands, no bounce | ×0.9 | ×1.15 |
  | Heatwave | Lofts bounce high and run on | Full speed | ×0.92 |

- **Shapes.** Each Grumble team plays one:
  - **High line**: space behind them;
  - **Low block**: they crowd the box;
  - **Man-markers**: each one shadows one of ours, so a run drags its marker away.
- **The changing room.** After every win, Enzo offers three of twelve perks and you pick one. The room shows the next team, pitch and shape before you choose.

  | Perk | Effect |
  |---|---|
  | Backspin boots | Lofted passes stop dead |
  | Heavy touch | Bram's first touch knocks it on |
  | Wide window | The perfect window ×1.5 |
  | Carousel | +0.05 to the window for each perfect in a row, up to five |
  | Wall pass | After a perfect arrival, a quick tap lays it back into the passer's run |
  | Bender | Passes curl round the first Grumble in the way |
  | Switch boots | Passes over 150 fly a third faster |
  | Decoy runs | A teammate drags his marker away while a pass is in the air |
  | Poacher | Pip shoots for the far corner by himself after a perfect arrival in the box |
  | Sprinter | Twice the stamina |
  | Sweeper keeper | Tuft rushes out to loose balls |
  | Knuckleball | First-time shots wobble, and keepers dive late |

- **Saving.** The save is `into-space-v1` in `localStorage`. It holds whether you've seen the intro, your best round, best streak and best goals in a run, your total runs, cups, goals and perfect arrivals, and the sound and music settings.

## Screens and feel

- **Feedback on a pass.**
  - The pass's landing ring is gold and shrinks toward the 9-pixel arrival circle. It turns white when the perfect window opens.
  - The controlled player has a ring at his feet and a bouncing arrow above his head, and the arrow jumps to the runner as the ball is kicked, with a blip.
  - The ball's shadow stays on the grass and shrinks as the ball climbs, so a loft's height can be read at a glance.
- **A perfect arrival.** The game drops to half speed with a white frame around the pitch, a rising chime and a PERFECT pop above the runner's head. From the second in a row, the pop reads PERFECT ×n.
- **Text placement.** Text never covers a face. The banners use the scoreboard strip, Enzo's pointers sit under the pitch, and pops float above the head arrow. The title painting sits to the right of the menu on a wide screen and in the top half on an upright phone.
- **Upright phones.** The whole pitch fits the width, about one screen pixel per game pixel, which is small. A hint under the stick suggests turning the phone sideways.

## Art

All the art is painted by Codex: the four pitches, the top-down goal, the title and the ending. The kickabout sprites shared with Combo Ball are painted by Codex too. `scripts/space-art.py` reduces each painting to a small palette with nearest-neighbour scaling.

## Tests

`npm run test:space` compiles the engine and runs `tests/space.mjs`, which checks:

- a pass goes to the spot and control jumps to the runner;
- passes are capped and first-time passes are quicker;
- perfect, early and late arrivals, with slow motion and the first-time window;
- a first-time shot is harder than a charged one;
- an early arrival's settling touch;
- a streak of three;
- a loft is out of reach early in its flight;
- the beach, rain and heatwave pitches;
- golden goal and the tie-break;
- a full cup: picks, the next round shown in advance, no repeated pitch, the Final on grass, and one defeat ending the run;
- the switch, sprinter, wide-window and backspin perks;
- a seed replaying exactly;
- the save.

`tests/e2e/space.mjs` (needs `npm run dev` and Playwright) checks:

- the title and the intro;
- holding J and letting go;
- a right-click loft onto a spot, run onto perfectly by a timed run;
- pausing;
- a win into the changing room, with a pick by key;
- a defeat and the result card;
- the bests across a reload;
- a corrupt save;
- the how-to page;
- an upright phone, with the stick and a PASS drag;
- no page errors or sideways scrolling.

## Bots and balance

`npm run bot:space` runs forty seeded runs; `--quick`, part of `npm test`, runs twelve.

| Bot | Plays | Result (06-11-2026, 40 runs) |
|---|---|---|
| Pro | Looks for spots ahead of each teammate that he can reach in time and the nearest Grumble can't. Lofts over anyone in the lane, times the run to arrive as the ball lands, and shoots first time from the box. | 5.00 rounds won, 9 of 40 cups, 4.74–1.66 goals a match, 93% of arrivals perfect. Must win at least three rounds on average. |
| Early | Passes like the pro but sprints straight to every spot and waits there. | 3.50 rounds, 4 cups, 48% perfect. Must be at least 20 points less perfect than the pro, and win fewer rounds. |
| To feet | Ground passes to where teammates stand. | 0.28 rounds, 0 cups. Must win clearly fewer rounds than the pro. |
| Random | Runs, passes and shoots at random. | 0 rounds, 0 cups. Must never win the cup. |

Balance notes from tuning:

- **Rewarding timing.** Sprinting to the spot used to be rated perfect most of the time. To make timing matter:
  - the runner is now the teammate who can arrive soonest, so he has to hold his run;
  - passes are faster than running pace;
  - early arrivals cost a settling touch.
- **Making perfect pay.** First-time shots wrong-foot the keeper, and an early arrival's settling touch invites the press.
- **The beach** was where most cup runs ended until its ball was allowed to roll a little and players got a little faster on it.
- **The Final** is now where the pro most often goes out. That is the intended shape.

Rerun the bots after changing any number above.

## Ideas not done

- A camera that follows the ball on an upright phone, so the players are bigger.
- Replays of a perfect arrival and finish.
- A two-player mode, with one passing and one running.
