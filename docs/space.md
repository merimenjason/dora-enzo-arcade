# Into Space

Game 88, `/space`. A pixel-art football roguelite about the pass into space. Every pass goes to a spot on the grass, not to a player. The moment it leaves the boot, you take over the runner, the teammate who can get there soonest. A gold ring on the spot shrinks as the ball comes. Arrive just as it closes and the arrival is **perfect**: time slows down, and the next pass or shot is first time. Arrive early and you have to stop and settle it while they close in. Arrive late and the ball runs on without you. While you stand on the ball, or aim a pass or a shot, **time stops**, so the only thing done against the clock is the run onto the ball. Dora, Enzo, Pip and Bram, with Tuft in goal, play a seven-round cup of four-a-side matches against six of the league's eight animal teams, each with its own style, and then the Grumble Galacticos in the final. Lose once and the run is over. **Assist**, on by default, widens the perfect window, slows the other team and steers your runner onto the spot. Built on 06-11-2026 from the football roguelite shortlist in the Game Invention Lab. Made easier on the same day, after it proved too hard to play: time stops while aiming, Assist, a closer camera, and a re-tune against bots with human reaction times.

## Files

| File | What it is |
|---|---|
| `lib/space-game.ts` | The rules, deterministic at 60 ticks a second with no DOM. It covers time stopping while we aim, passes to a spot (ground and lofted), choosing the runner, rating arrivals, slow motion and the first-time window, shots, tackles, keepers, Assist, the league's teams and their styles, the opposition AI and team shapes, the four pitches, golden goal, the cup draw, the changing-room picks and the save. |
| `lib/space-scene.ts` | Canvas 2D on a canvas twice the game's 384 by 216, scaled up with nearest-neighbour. A camera follows the play at ×1.5 (×2 on an upright phone), leaning towards where a pass or shot is going, and always lands on whole canvas pixels so the sprites stay even. It draws the painted pitch, chalk lines and the goals; the landing ring, which shrinks to the arrival radius and turns white when the window opens; a dashed line from the runner to the spot; and the pass reticle (straight, or arced for a loft). While time is stopped, the picture cools with a TIME STOPPED word at the top, the reticle turns green or red by who gets there first, and the nearest opponent's chase line shows; a shot being charged marks the keeper's reach on the goal line in red, with the aim beside it. Players are drawn in depth order in their team's sprites, with a ring and a bouncing arrow over the one you control. The ball has a shadow that shrinks with height and a trail. On top come the rain, dust, text pops and a white frame during slow motion. |
| `app/space/page.tsx` | The title, the intro cards, the match HUD (score, clock, the player you control with his stamina, the flow streak, the round, pitch and shape), the input, Enzo's pointers, the changing room with the next team's captain, the league on the how-to page, the Assist setting, pausing, results and the save. Input is keys and mouse, or a thumb stick plus PASS, SHOOT/TACKLE, SPRINT and SWITCH on a touch screen. The page exposes `window.__space()` with `debug` helpers for the browser tests. |
| `app/space/sound.ts` | Synthesised effects: kicks (a deeper whoomph for a loft), the blip when control jumps, a rising chime for a perfect arrival that climbs with the streak, early and late thuds, landings, bounces, shots, saves, the post, tackles, the whistle, goals and Enzo's chatter. Also five original chiptune loops: title, match, golden goal, changing room and ending. |
| `app/space/space.css` | A floodlit cup night, prefix `is-`. The scoreboard sits in the strip above the pitch's boards and Enzo's pointers sit in the strip below them, so no text covers a player. On an upright phone, the HUD moves above the pitch, and the stick and buttons sit below it. |
| `app/space/layout.tsx` | The page title and description. |
| `scripts/space-art.py` | Turns the Codex paintings into the game's pictures: the four pitches (384 by 216 at 40 colours), the goal (keyed off magenta, 15 by 46 at 8 colours), the title and the ending. |
| `public/art/space/` | `dry`, `wet`, `sand`, `hard`, `goal`, `title`, `ending`. The players, the league's teams (`<team>-stand`, `-run1`, `-run2`, `-slide`, `-keeper-stand`, `-keeper-dive`, `-cheer`, `-big`), ball and trophy are the shared kickabout sprites in `public/art/kickabout/`. |
| `tests/space.mjs` | Engine checks (see below). |
| `tests/space-bot.mjs` | The balance bots. |
| `tests/e2e/space.mjs` | The browser checks. |

## Time stops while you aim

- **When.** While the player you control has the ball and isn't settling it, time stops if you aren't moving the stick, or while you hold PASS (J), SHOOT (K) or drag the phone's slingshot. The clock, the ball and everyone else stand still, so you can aim as long as you like.
- **When it runs.** As soon as the ball leaves your boot, or you run with it. The run onto a pass is in real time: that's the game.
- **What it shows.**
  - The reticle turns **green** where our runner reaches the spot in time and before the nearest opponent, and **red** where he wouldn't.
  - The nearest opponent's chase line runs to the spot in red, and our runner's in gold.
  - While a shot is charged, the stretch of goal mouth the keeper can reach in time is marked in red, with the aim beside it. The aim is green when it's outside his reach.
  - On the keyboard the camera leans halfway towards the reticle. With the mouse it holds still, so the pitch doesn't slide under the pointer.
- **Holding over.** After you win the ball back, SHOOT has to be let go before it can charge a shot, and a cold shot can't start in the first third of a second. Without this, the press that won a tackle used to fire a weak shot from midfield.

## Assist

On by default; Settings turns it off, and the change applies from the next cup. It's saved as `settings.assist`.

| Assist | Effect |
|---|---|
| Perfect window | ×2 (`ASSIST.window`) |
| The other team | 25% slower; not their keeper (`ASSIST.foe`) |
| Steering | When the stick points within about 60° of the spot, the runner heads straight for it and slows to a stop on it from 6 pixels out (`ASSIST.steer`, `ASSIST.cone`) |
| Control | Jumps to the runner on every pass (with or without Assist) |

## Passing into space

- **The spot.** You can pick it in four ways:
  - hold **J**, and the target walks out ahead of you from 44 to 184 pixels over three quarters of a second; let go to pass;
  - point with the **mouse** and click;
  - on a phone, drag out from **PASS** the way you want the ball to go, then let go;
  - tap PASS, or tap J, to play it 44 pixels ahead.
- **Loft.** Hold Shift or L, right-click, or on a phone drag further than 80 pixels.
- **Limits.** Passes are 16 to 190 pixels long (`MIN_PASS`, `MAX_PASS`).
- **Ground passes** slow down as they roll. They start fast enough to reach the spot still rolling at the pitch's end speed, so on summer grass a 100-pixel pass takes about half a second.
- **Lofted passes** take (0.34 + distance ÷ 330) seconds and rise up to 50 pixels. Nobody can touch one until 55% of its flight has gone, except a team that jumps for it (below). An opponent near the path of a ground pass gets one chance to cut it out: 70%, or 45% when the ball is moving faster than 150, times the team's interception.
- **The runner** is the teammate who can reach the spot soonest among those who can make it in time. If nobody can, it is the one who'd be least late. **Q** (or SWITCH) moves the run to the next teammate. The runner has to hold his run: reaching the spot too soon is early.
- **Rating the arrival.** The game records when the runner first comes within 9 pixels of the spot (`ARRIVE`) and compares that with when the ball lands:

  | Arrival | When | What happens |
  |---|---|---|
  | **Perfect** | No more than 0.22 s early and no more than 0.13 s late, scaled by the pitch's window (and ×2 with Assist) | Half-speed slow motion for 0.6 real seconds, and a first-time window of 0.55 s |
  | **Early** | More than 0.22 s early | A 0.5 s settling touch: no passing or shooting, 0.55× speed, and they press three times as hard with tackles 30% likelier to win |
  | **Late** | More than 0.13 s late | The streak ends, and it's a loose ball |

- **First time.** In the window, a pass flies 15% faster and a shot is hit at least 85% power, 20% faster, with less than half the spread. A first-time shot also wrong-foots the keeper: he reacts 0.1 s later and his save chance falls by 0.2.
- **The flow streak** counts perfect arrivals in a row. It drives the chime's pitch and the Carousel perk.

## Shooting, defending, keepers

- **Shooting.** Hold **K** (or SHOOT) to charge and let go to shoot. Aim with the mouse, or with up and down. Spread is 2 + distance × 0.05 pixels, plus 4 for an over-hit shot. Keepers save with a chance of 1.65 − speed ÷ 300 (`KEEPER_SAVE`), kept between 0.2 and 0.9, whether diving or standing in the way (Tuft, ours, holds anything he stands in front of). Their keeper reacts after 0.2 s (`KEEPER_REACT`), 0.012 s quicker and 0.01 surer each round.
- **Defending.** The same button tackles: 56% to win the ball, or 72% for Bram, with a short stun if you miss.
- **Teammates** run into lanes ahead of the ball and press the carrier. Bram hangs back.
- **Keepers.** Both keepers smother a dribbler in their box. They roll the ball out to the most open teammate.
- **The other team.** Two chase a loose ball, one goes for the spot of our pass, one (or two) press the carrier, and the rest hold the team's shape. They run 1.8 faster each round and shoot from further out.

## The league

A cup draws six of the eight animal teams in a seeded order, sorted by tier with a random nudge of up to 1.5 tiers so the order is only roughly easiest first, then always the Grumble Galacticos in the final (`Run.order`, `FOES`, `LEAGUE`). Each team's style changes a few numbers in the AI:

| Team | Kit | Tier | Style |
|---|---|---|---|
| Rabbit Rangers | sky blue | 1 | Run 12% faster; their tackles win half as often |
| Frog Wanderers | orange | 1 | Jump for lofted passes from 30% of the flight, reaching 22 pixels higher |
| Otter Athletic | teal | 2 | Pass 2.4 times as readily, and from further away when pressed |
| Mole Miners | brown | 2 | On 30% of our passes over 50 pixels, the one nearest the spot pops up 20 to 28 pixels from it (stunned for 0.3 s) |
| Magpie Rovers | purple | 3 | Go for the landing spot 25% faster, and cut out passes 25% more often |
| Hedgehog Hotspurs | royal blue | 3 | Two press the carrier, and they try tackles 1.5 times as often |
| Fox Forest | navy | 4 | Break forward 10% faster with the ball |
| Badger Borough | mustard | 4 | Run at 0.85; their tackles win 80% of the time, ours on them 70% as often as usual |
| Grumble Galacticos | green | final | A bit of everything: two pressers, tackles 1.1, a 6-pixel jump, 10% pops, passing 1.4, chasing 1.08, counter 1.06, our tackles 0.9 |

The next team's captain (`<team>-big`) stands beside its name, pitch and shape in the changing room, and beside the round banner at kick-off. Their players cheer while the ball sits in our net.

## The cup

Seven rounds against the draw above.

- **Matches.** Two minutes. If it's level at full time, it's 30 seconds of golden goal. If it's still level after that, you go through only if you made more perfect arrivals than they made interceptions.
- **Pitches.** Round one and the Final are on summer grass, and the semi-final never is. The pitch is rolled when the match before it is won, and it is never the same pitch twice running.

  | Pitch | Ball | Players | Perfect window |
  |---|---|---|---|
  | Summer grass | Rolls true, lofts bounce a little | Full speed | ×1 |
  | Rain | Skids on after landing | ×0.97 | ×0.8 |
  | The beach | Dies where it lands, no bounce | ×0.9 | ×1.15 |
  | Heatwave | Lofts bounce high and run on | Full speed | ×0.92 |

- **Shapes.** Each team plays one:
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
  | Bender | Passes curl round the first opponent in the way |
  | Switch boots | Passes over 150 fly a third faster |
  | Decoy runs | A teammate drags his marker away while a pass is in the air |
  | Poacher | Pip shoots for the far corner by himself after a perfect arrival in the box |
  | Sprinter | Twice the stamina |
  | Sweeper keeper | Tuft rushes out to loose balls |
  | Knuckleball | First-time shots wobble, and keepers dive late |

- **Saving.** The save is `into-space-v1` in `localStorage`. It holds whether you've seen the intro, your best round, best streak and best goals in a run, your total runs, cups, goals and perfect arrivals, and the sound, music and Assist settings. A save from before Assist existed reads as Assist on.

## Screens and feel

- **Feedback on a pass.**
  - The pass's landing ring is gold and shrinks toward the 9-pixel arrival circle. It turns white when the perfect window opens.
  - The controlled player has a ring at his feet and a bouncing arrow above his head, and the arrow jumps to the runner as the ball is kicked, with a blip.
  - The ball's shadow stays on the grass and shrinks as the ball climbs, so a loft's height can be read at a glance.
- **A perfect arrival.** The game drops to half speed with a white frame around the pitch, a rising chime and a PERFECT pop above the runner's head. From the second in a row, the pop reads PERFECT ×n.
- **Text placement.** Text never covers a face. The banners use the scoreboard strip, Enzo's pointers sit under the pitch, and pops float above the head arrow. The title painting sits to the right of the menu on a wide screen and in the top half on an upright phone.
- **Upright phones.** The pitch fits the width and the camera comes in to ×2 on the ball, so players are about 40 screen pixels tall. A hint under the stick still suggests turning the phone sideways.

## Art

All the art is painted by Codex: the four pitches, the top-down goal, the title and the ending. The kickabout sprites shared with Combo Ball, and the league's eight animal teams, are painted by Codex too. `scripts/space-art.py` reduces each painting to a small palette with nearest-neighbour scaling.

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
- the save, with Assist on by default and kept when off;
- the league: a seeded draw of six then the Grumbles, faster rabbits and slower badgers, moles popping up beside the spot, frogs jumping for lofts that rabbits can't reach;
- time stopping: the clock and the opposition stand still while Dora stands on the ball, aims a pass (the stick turning the aim) or charges a shot, and the slingshot; it runs again on the pass or when she dribbles; the keeper's reach shrinks for a harder shot;
- Assist: twice the window, the other team (not their keeper) a quarter slower, a runner steered onto the spot, control jumping to him.

`tests/e2e/space.mjs` (needs `npm run dev` and Playwright) checks:

- the title and the intro (Assist on, the draw ending with the Grumbles);
- time stopping while Dora stands on the ball and while a shot is aimed;
- holding J and letting go;
- a right-click loft onto a spot, run onto perfectly by a timed run;
- pausing;
- a win into the changing room, with the next team's captain and a pick by key;
- a defeat and the result card;
- the bests across a reload;
- a corrupt save;
- the how-to page with the league;
- Assist turned off in Settings, kept across a reload and used by the next cup;
- an upright phone zoomed to ×2, with the stick and a PASS drag;
- no page errors or sideways scrolling.

## Bots and balance

`npm run bot:space` runs forty seeded runs; `--quick`, part of `npm test`, runs twenty.

The bots play like people, not machines. Every input reaches the game 12 to 15 ticks (a fifth to a quarter of a second) after the bot decides it. Passes and shots are aimed with a wobble. On the ball, a bot stops to think, which is when time stands still, and if nothing's on it dribbles on for a while before looking again. The first version of the game was tuned against frame-perfect bots, and that is why people found it too hard: given human reactions, those same bots won 0.4 rounds.

| Bot | Plays | Result (06-11-2026, 40 runs) |
|---|---|---|
| Casual, Assist on | A careless person: 15-tick reactions, a 14-pixel wobble, takes any pass that looks on (one of the top three), and gets the timing of every run up to 0.16 s wrong, a little early on average. | 4.35 rounds won, 6 of 40 cups, 3.66–1.08 goals a match, 85% perfect. Must win at least three rounds on average and a cup in at least one run in ten. |
| Pro, Assist on | 12-tick reactions, a 5-pixel wobble. Looks for spots ahead of each teammate that he can reach in time and the nearest opponent can't, lofts over anyone in the lane, times the run, and shoots first time from the box. | 6.58 rounds, 31 of 40 cups, 4.97–0.81. Must win more rounds than the casual player. |
| Random, Assist on | Runs, passes and shoots at random. | 0 rounds, 0 cups. Must never win the cup. |
| Pro, Assist off | As above, without Assist. | 1.48 rounds, 0 cups, 85% perfect. Must win at least one round on average. |
| Early, Assist off | A machine on purpose (no reaction delay): passes like the pro, then sprints straight to every spot and waits there. | 4.92 rounds, 12 cups, 66% perfect. Must be at least 10 points less perfect than the pro. |
| To feet, Assist off | Ground passes to where teammates stand. | 0.07 rounds, 0 cups. Must win clearly fewer rounds than the pro. |

Before the re-tune, with frame-perfect bots and no Assist, the pro won 4.50 rounds and 3 of 12 cups.

Balance notes from tuning:

- **Rewarding timing.** Sprinting to the spot used to be rated perfect most of the time. To make timing matter:
  - the runner is now the teammate who can arrive soonest, so he has to hold his run;
  - passes are faster than running pace;
  - early arrivals cost a settling touch.
- **Making perfect pay.** First-time shots wrong-foot the keeper, and an early arrival's settling touch invites the press.
- **The beach** was where most cup runs ended until its ball was allowed to roll a little and players got a little faster on it.
- **Shooting for people.** With human reactions, a casual player took 21 shots a match and scored 1.45. Half were tackle presses turning into shots from midfield, now held over. The keeper also caught anything that hit him standing up, with no chance roll; now he has to hold it like a diving save. Spread, reaction and save numbers were then swept against the bots.
- **The league.** Fox Forest and Badger Borough knocked out a careless player most often, so their counter, tackle and hardness were softened. The Galacticos' "everything at once" started at full strength and won every final against the casual bot.
- **With Assist off,** the game is as hard as it first was, minus the frozen aiming. That's deliberate: it's there for players who want the original.

Rerun the bots after changing any number above.

## Ideas not done

- Replays of a perfect arrival and finish.
- A two-player mode, with one passing and one running.
