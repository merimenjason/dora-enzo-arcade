# Sweep & Slide

A cosy curling game at `/curl`, game 64 of the arcade, in a new linocut / woodblock-print art style. The millpond has frozen for the winter Pebble Cup, and Dora and Enzo's two-chinchilla team slides polished river stones at the painted rings against eight woodland teams.

All numbers below come from `lib/curl-game.ts`, `lib/curl-ai.ts` and `app/curl/page.tsx`. Written 31-10-2026.

## Files

- `lib/curl-game.ts`: the rules. The sheet, the ice physics (friction, curl, sweeping, collisions), the out-of-play rules, the line-finders, end scoring, the match and the hammer, the Practice Pond drills and the save. Deterministic, no DOM; the only randomness is a seeded generator.
- `lib/curl-ai.ts`: the eight woodland teams and the shot-caller that plans their throws and suggests Dora and Enzo's.
- `lib/curl-scene.ts`: the drawing (Canvas 2D): the pond, the sheet and house, the stones, the aim ghost and the skip's broom, sweepers and broom strokes, ice chips, the measuring tape, the crowd, and Dora, Enzo and the captain.
- `app/curl/page.tsx`, `curl.css`, `sound.ts`, `layout.tsx`: the page (menu, Cup ladder, Practice Pond, the ice, the ending), input, saving and the HUD; the sounds and music are made with WebAudio.
- `tests/curl.mjs`, `tests/curl-bot.mjs`, `tests/e2e/curl.mjs`: engine checks, the ladder bots, and the browser suite.
- Paintings in `public/art/curl/`, briefed in [`curl-art-brief.md`](curl-art-brief.md).

## The sheet

Distances in metres, along the sheet (x) from the release line and across it (y, positive to the thrower's left).

| | |
| --- | --- |
| Hack | x = −1.6 |
| Release | x = 0, on the centre line |
| Far hog line | x = 12 |
| Tee (button centre) | x = 18.4 |
| House rings | radius 1.83, 1.22, 0.61 and 0.15 |
| Back line | x = 20.23 (tee + 1.83) |
| End boards | x = 21.23 |
| Sheet width | 4.4 (side boards at y = ±2.2) |
| Stone radius | 0.18 |

The sheet is shorter than a real one (real hog to hog is about 22 m) so a throw takes about 8 seconds on screen, but the house and stones keep realistic proportions.

## The ice

The engine steps at a fixed 1/120 s.

- **Friction:** a sliding stone slows at a steady 0.2 m/s² (0.168 m/s² while swept, ×0.84).
- **Curl:** a stone turning anticlockwise (seen from above) drifts left, clockwise drifts right. The sideways pull is 0.04 / (speed + 0.22) m/s², so the bend grows as the stone slows: a draw to the button curls about 1 m, most of it in the last third. Sweeping halves the curl. A thrown stone spins at 1.2 rad/s; a stone curls in proportion to its spin up to 1 rad/s.
- **Collisions:** equal-mass discs. The push along the line of centres has restitution 0.88 (a full hit leaves the shooter with 6 % of its speed and passes 94 % on); a capped rub at the contact (0.06 of the push) passes spin between the stones, so a struck stone curls a little after a glancing hit. Overlapping stones are pushed apart, and momentum is kept exactly.
- **Out of play:** a stone touching the side boards, a stone wholly past the back line, a stone reaching the end boards, and a delivered stone that stops short of the far hog line without touching another stone (hogged).

### Weight

The weight bar runs 0 … 1. From 0 to 0.7 it sets where the stone would stop on an empty sheet, from 10.4 m (short of the hog line) to 21.53 m (the boards); from 0.7 to 1 it rises to a 4.6 m/s peel. The bar names the zones: **Short**, **Guard** (stops between the hog line and the house), **Draw** (stops in the house), **Tap** (to 0.82), **Hit** (to 0.93) and **Peel**.

### Release error

Every delivery gets a small seeded error on its speed and its line (normally distributed). Dora and Enzo's is 1.1 % of the speed and 0.0022 rad (about 4 cm at the tee): enough that a draw now and then needs sweeping, which is the point. Thrown light and swept home is the safe way to draw. The opposing teams' errors are listed below.

## Scoring

After all eight stones (four per team, two each for Dora and Enzo), only stones touching the house count. The team with the stone nearest the button scores one point for each of its stones nearer than the other team's best. A measured tie for shot (the two nearest within 0.1 mm) scores nothing. An empty house is a blank end.

- **Hammer:** the team without the hammer throws first, so the hammer team throws last. The team that scores gives the hammer to the other team; a blank end or a measured tie keeps it where it is. Dora and Enzo have the hammer in the first end of every match except the final, where the champions have it.
- **Matches:** four ends (six in the final). Level after the last end, extra ends are played until someone scores.
- **Measuring:** when both teams have a stone in the house and the two nearest are within 30 cm of each other, a measuring tape runs from the button to each and shows the distances.

## Playing

- **Aim:** pull back anywhere on the ice and drag away from the direction of the throw, like a slingshot. The pull's length sets the weight (a full pull is 36 % of the shorter side of the ice, between 130 and 300 px); its direction sets the line (half the drag angle, within ±0.2 rad). A dotted ghost shows the first 4.5 m of the path and a dashed line runs to the tee line; the curl is not shown.
- **Curl:** the Curl left and Curl right buttons, or **C**. A turning arrow round the stone at the hack shows the choice.
- **Sweep:** while your stone runs, hold the mouse, Space or Enter; on a touch screen hold or tap fast on the Sweep button (each tap sweeps for 0.38 s).
- **Shot calls:** before each of your stones the teammate who isn't throwing calls a shot ("Draw behind our guard", "Take out their shot stone", …), holds the broom where to aim, sets the curl, and marks the weight on the bar. Follow it, or don't.
- **Keys:** on a wide screen **↑ ↓** move the line and **← →** the weight; on an upright screen **← →** move the line and **↑ ↓** the weight. Shift for fine steps. Space or Enter throws. Escape goes back.
- Dora throws your first two stones of an end and Enzo the last two; the other sweeps. The last stone of each end plays in slow motion as it reaches the house.

## The shot-caller

`plan` lists the sensible shots for the team on the ice: draws to nine spots in and around the house, come-arounds to the line behind every guard, three guards (centre, two corners) plus one in front of the team's best stone, hits on up to four of the other team's stones in play at three weights and three lines, peels on guards, taps on the team's own short stones, and a throw-through, each with either curl. It plays each one out on a copy of the ice and scores the result with `evaluate`: the points if the end stopped now (weighted more as the end goes on), each stone in the house by closeness, stones covered by a guard, centre guards for the team without the hammer and corner guards for the team with it. In the last stone, a blank is worth keeping the hammer and one point with the hammer counts a little less. A team that thinks less sees the values blurred; the better teams then replay their favourite shots a few times with their own release error and keep the one that holds up. Dora and Enzo's caller thinks hardest and has no favourite shots.

## The Cup ladder

| # | Team | Captain | Ends | Release error (speed, line) | Plays |
| --- | --- | --- | --- | --- | --- |
| 1 | The Hedgehog Twins | Prickle | 4 | 5 %, 0.014 rad | gentle draws |
| 2 | The Duck Pond Paddlers | Mallory | 4 | 3.8 %, 0.011 rad | wobbly weight, the odd hit |
| 3 | The Badger Brothers | Brock | 4 | 3.4 %, 0.0095 rad | love hitting |
| 4 | The Squirrel Scramblers | Hazel | 4 | 2.8 %, 0.008 rad | guards and hits everywhere |
| 5 | The Beaver Builders | Timber | 4 | 1.6 %, 0.0048 rad | walls of guards |
| 6 | The Otter Swimmers | Ripple | 4 | 1.9 %, 0.0055 rad | takeouts |
| 7 | The Owl Tacticians | Professor Hoot | 4 | 0.92 %, 0.0027 rad | think hardest, the odd guard |
| 8 | The Stoat Champions | Ermine | 6 | 0.95 %, 0.0026 rad | everything; the hammer first |

Beating a team opens the next. Beating the stoats wins the Pebble Cup and opens the ending.

### Balance, from the bots

`npm run bot:curl` (60 matches per team with `CURL_N=60`): an expert bot playing as Dora and Enzo (their caller, their release error and a sharp sweep judge) won against each team in turn:

BOT_TABLE

A naive bot that throws the same draw to the button every time without sweeping won BOT_NAIVE. `tests/curl-bot.mjs` checks that the expert beats the hedgehogs at least 75 % of the time, the champions between 10 % and 70 %, that the second half of the ladder is harder than the first, and that the naive bot loses most matches.

## The Practice Pond

Five drills, each scored with up to three stars (the best is kept). The teammate holds the broom for a three-star throw found by searching the drill.

| Drill | Setup | ★ | ★★ | ★★★ |
| --- | --- | --- | --- | --- |
| Draw to the button | an empty house | in the house | within 0.9 m of the tee | within 0.3 m |
| Centre guard | our stone just in front of the tee | in the guard zone | within 0.5 m of the line to our stone | within 0.2 m of it and past the hog line by 2.2 m |
| Come around | their guard 3.3 m past the hog line | in the house | within 1 m of the tee, or hidden | hidden behind the guard and within 1.25 m |
| Hit and roll | their stone near the button | theirs out | ours stays in play | ours stays in the house |
| Double takeout | two of theirs, one in front of the other | one out | both out | both out and ours stays |

## Saving

Saved in `localStorage` under `sweep-slide-v1`: teams beaten, wins and best margins per team, drill stars, whether the Cup is won, the tips seen, Sound and Music, and the match in progress (a snapshot of the stones at rest, the ends, the score, the hammer and the generator's state, saved after every stone). Anything unreadable is ignored: a corrupt save starts fresh, a broken match is dropped and the rest kept.

## Art

The new linocut / woodblock-print style: bold carved outlines, flat inks (navy, ice blue, cream, warm red, a little mustard) with print grain and slight misregistration. Dora is printed in cream-white with ruby-red eyes, Enzo in cool blue-grey with black eyes, both with clean pink ears and a smooth rounded crown. The cut-outs (`dora-` and `enzo-` `throw`, `sweep`, `cheer`, `groan`) face right, down the ice; the eight captains face left. The scene adds its own print grain over everything and draws the sheet, stones and brooms in the same inks; every painting has a print-style stand-in until it loads.
