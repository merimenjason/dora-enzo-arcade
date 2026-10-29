# Snowdrift

Game 55, at `/snowdrift`. A one-button momentum sledding game for one player. Dora (in front, red scarf) and Enzo (behind, blue scarf) share one little wooden sled and race the sunset across seven snowy valleys of the Andes, reaching each evening's lodge before the dusk catches them.

All numbers below come from `lib/snowdrift-game.ts` and `lib/snowdrift-terrain.ts`. Written 30-10-2026.

## Files

- `lib/snowdrift-terrain.ts`: the hills. Each valley is a smooth curve (cubic Hermite pieces) built from a seeded hill grammar: rolls, drops, ice flats, cave roofs, gust zones and gaps, with snowflakes and cocoa placed along the flight lines. It also builds the endless hills on demand and checks every course for sense.
- `lib/snowdrift-game.ts`: the rules. Deterministic and DOM-free, at a fixed 60 ticks a second with two physics steps a tick. All randomness comes from seeds, so the same inputs always give the same run. It also holds the upgrades, the save format and `playRun`, which the tests and the bot use.
- `lib/snowdrift-scene.ts`: Canvas 2D drawing: the sky through the day, the paintings and their stand-ins, the hills, caves, gaps and lodge, the sled with squash and spray, speed lines, the Flurry's snow trail, the dusk wall, fireworks and the painted title, lodge, valley cards and ending.
- `app/snowdrift/page.tsx`, `layout.tsx`, `snowdrift.css` and `sound.ts`: the page. It handles input (keys, mouse, touch, gamepads), the loop, saving, the HUD, the lodge shop and WebAudio sound and music.
- `tests/snowdrift.mjs`, `tests/snowdrift-bot.mjs`, `tests/snowdrift-bot-policy.mjs` and `tests/e2e/snowdrift.mjs`: the tests.
- `docs/snowdrift-art-brief.md`: the art brief. The paintings live in `public/art/snowdrift/`.

## The one button

- **Waiting at the top:** the first press pushes off at 6 units a second.
- **Holding on the ground (tuck):** the pair get heavy. Down a slope the pull is 1.7 times stronger; up a slope it is only half as strong (0.5), so a held climb costs a little speed. They also press into the snow (1.25 times), so they stick to small bumps.
- **Letting go (light):** a crest throws them into the air whenever the curve pulls away faster than gravity holds them.
- **In the air:** gravity is 0.72 of the ground's pull (lighter runners make it lighter still). Holding for more than 0.12 s turns a backflip: the spin builds at 18 radians a second squared up to 8 radians a second, and settles quickly once you let go. With no flip attempted, the sled eases itself to match the flight and the slope below, so an ordinary landing never tumbles.
- **Landing:**
  - A **Smooth landing** meets a downslope (steeper than 0.07) within 0.34 radians of its angle: a boost of 2.4.
  - Three smooth landings in a row start a **Snow Flurry**: extra push (6), a top speed 6 higher, a snow trail and a music layer, for 4 s (more with the woolly scarf).
  - A **Flip!** is a full backflip landed upright: a boost of 6.5.
  - Landing more than 0.95 radians off the slope is a **tumble**: the pair keep 40% of their speed and take 1.1 s to get going again. It is never a game over.
- Speed is always at least 5 and at most 44. Snow friction is 0.055 (times the press into the ground), ice friction 0.006, and there is a little air drag.

## The sunset

The dusk wall starts 6 seconds behind the sled and moves at the valley's dusk speed. The HUD shows the daylight left: the gap to the dusk in seconds at its pace. If the dusk reaches the sled, night falls and the day ends, showing how far they got and how far the lodge was; the snowflakes they picked up are kept. A cocoa mug pushes the dusk back by 3 seconds of its pace (more with the bigger thermos). Snowflakes are the currency for the lodge shop.

## Valleys

| Day | Valley | What it teaches | Course length | Dusk speed | ☀ medal: spare daylight |
| --- | --- | --- | --- | --- | --- |
| 1 | Pine Meadow | Hold on the way down, let go on the way up | 1500 | 19.8 | 28 s |
| 2 | Frozen Lake | Long ice flats keep your speed | 1800 | 24.8 | 27 s |
| 3 | Ice Caves | Low roofs: hold to stay low (a bonk keeps 86% of the speed) | 1900 | 23.6 | 24 s |
| 4 | Windy Ridge | Gusts lift you in the air and push you along | 2100 | 23.7 | 21 s |
| 5 | Snow Bridges | Gaps to fly; a fall puts you back at the lip after 1.2 s at speed 7 | 2100 | 25.8 | 21 s |
| 6 | Aurora Peaks | Night skies and big drops | 2400 | 24.6 | 19 s |
| 7 | The Summit Run | Everything, to the grand lodge, fireworks and the ending | 2700 | 31.5 | 17 s |

Each day has three medals: 🏠 reach the lodge, ☕ collect every cocoa, and ☀ reach the lodge with the spare daylight in the table. The best time and the most spare daylight are kept per day, and any opened day can be replayed. Finishing a day opens the next.

## The lodge shop

Each upgrade has three levels, costing 20, 60 and 120 snowflakes. They help modestly.

| Upgrade | Does | Levels 0 → 3 |
| --- | --- | --- |
| Sled wax | less friction on the snow | × 1, 0.9, 0.82, 0.75 |
| Woolly scarf | a longer Snow Flurry | 4, 5, 6, 7 s |
| Bigger thermos | each cocoa pushes the dusk back further | 3, 4, 5, 6 s |
| Lighter runners | lighter in the air, for longer flights | × 1, 0.96, 0.93, 0.9 air pull |

## The Moonlit Hills

Opens once day 3 is done. An endless night run: every valley's grammar in turn, a new one every 1200 units, starting with the meadow, with a cocoa about every 300 units. The dusk starts 6 seconds behind at 17 units a second and speeds up by 1 for every 300 units travelled, up to 34. **Moonlit Hills** is seeded fresh for each run; the **Daily Hill** is seeded by the local date, so it is the same hill all day. The best distance is saved for both, the daily one per date.

## Controls

- **Keyboard:** Space (or ↓, ↑, S, W, Enter) is the button; Esc or P pauses; on the day's panel Enter goes to the next day after a finish or tries again after night falls, and R plays again.
- **Mouse and touch:** press and hold anywhere on the snow.
- **Gamepad:** Ⓐ, Ⓑ or the right trigger is the button; Start pauses.
- The game pauses when the tab is hidden or the window loses focus, and picks up with no jump in time.

## Saving

Saved in `localStorage` under `snowdrift-v1`: per day whether it is done, its cocoa and daylight medals, the best time and the most spare daylight; the snowflakes; the upgrade levels; the endless best and the Daily Hill's best for its date; the last day played; whether the ending has been seen; and the sound, music and shake settings. Anything that isn't a version-1 save, or a value of the wrong type, is ignored and the game starts fresh.

## Tests

- `npm run test:snowdrift`: the engine checks (terrain sense, exact replay, the push-off, tuck, smooth landings and the Flurry, flips and tumbles, caves and gusts, the dusk, cocoa and snowflakes, gap falls, upgrades, saves and the endless hills).
- `npm run bot:snowdrift`: plays every day with a human-like bot (hold down slopes and under roofs, let go on climbs, with a reaction lag of 6 ticks), which must reach each lodge with spare daylight but below the medal; checks that never pressing and always holding are both caught by the dusk; and, without `--quick`, that the best of an expert flipping bot and a planning bot beats every daylight medal, and that the endless hills catch everyone in the end. `npm test` runs it with `--quick`.
- `npm run test:e2e:snowdrift`: the browser checks.

## Known gaps

- The planner and expert bots beat the human-like bot by only 5 to 13 seconds of daylight, so the daylight medals reward clean, rhythmic riding rather than tricks alone.
