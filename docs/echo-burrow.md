# Echo Burrow

Game 54, at `/echo`. A side-on time-loop puzzle platformer for one player. Dora and Enzo are finding their way home through thirty burrow rooms. In every room one of them goes first and records a run while a candle burns; then time winds back and the other plays live beside a teal echo that repeats the recording exactly. Every room needs both of them.

All numbers below come from `lib/echo-game.ts` and `lib/echo-rooms.ts`. Written 30-10-2026.

## Files

- `lib/echo-rooms.ts`: the thirty rooms, written out as 24 × 13 tile maps, with their chapters, candles, pars, hints and teaching lines.
- `lib/echo-game.ts`: the rules. Deterministic and DOM-free, at a fixed 60 ticks a second. Every room is fixed (there is no randomness at all), so the same inputs always give the same run. It also holds the input encoding, the save format and `playRoom`, which the tests and the bot use.
- `lib/echo-scene.ts`: Canvas 2D drawing: the room, the paintings and their stand-ins, the echo's tint and afterimages, the rewind, squash and stretch, dust and shake, and the painted title, ending and room maps.
- `app/echo/page.tsx`, `layout.tsx`, `echo.css` and `sound.ts`: the page. It handles input (keys, touch, gamepads), the loop, saving, the HUD and WebAudio sound and music.
- `tests/echo.mjs`, `tests/echo-bot.mjs`, `tests/echo-solutions.json` and `tests/e2e/echo.mjs`: the tests.
- `docs/echo-burrow-art-brief.md`: the art brief. The paintings live in `public/art/echo/`.

## The loop

1. **Record.** The first climber plays while the candle burns (12 to 22 s, set per room). Every tick's input is kept. **R** stops the recording early; when the candle burns out it stops by itself.
2. **Rewind.** Time winds back for 42 ticks (26 for a retry), drawn as the room playing backwards in faded colour with a whoosh. Every plate, door, crate, lift, seesaw and crumbling ledge goes back to how it started.
3. **Live.** The other climber plays beside the echo, which repeats the recorded inputs tick for tick. When the recording runs out, the echo stays where it stopped and keeps standing on whatever it was standing on, so a plate it ended on stays pressed.
4. **Clear** by walking the live climber into the burrow door. Only the live climber can clear a room.

**R** while live tries again with the same echo; **Shift+R** throws the echo away and records again. Each loop (the recording counts as one) adds to the room's loop count, which decides the par star.

## The echo

- It is a ghost to the live climber's paws: it is never pushed, blocked or knocked off anything, and it moves exactly as recorded even if the live climber stands in its way.
- It is solid from above: the live climber can stand on its head and ride it.
- **Head boost:** jumping off the head of Dora's echo leaves 25% faster (Enzo rises about 75 units instead of 39). Enzo's echo is just a step: Dora rises about 79 off his head.
- It weighs what its climber weighs, presses plates, rides lifts, flips seesaws (Enzo's), pushes crates (Enzo's), crumbles ledges, lights glow-moss and can pick up the golden seed.
- During the rewind its whole path is drawn as a fading trail.

## Moving

| | Dora | Enzo |
| --- | --- | --- |
| Size (units; a tile is 16) | 10 × 13 | 14 × 22 |
| Run speed | 96 | 78 |
| Jump speed | 345 (rises about 57: four tiles) | 288 (rises about 39: two tiles and a bit) |
| Weight | 1 | 2 |
| Pushes crates | no | yes, at 45 a second |
| Fits kit tunnels (one tile high) | yes | no |
| Wind | lifts her, up to 130 a second | only slows his fall, to 50 a second |

Gravity is 1,000 units a second², falls top out at 420. Holding jump gives the full height; letting go while rising keeps half the speed, for short hops. There are 6 ticks of coyote time after walking off an edge and a 6-tick jump buffer before landing. Climbers walk straight up onto lips of 8 units or less (a low seesaw pad, a resting lift). A jump held from the previous loop has to be let go first.

## Things in the rooms

- **Ledges** are one-way: jump up through, land on top.
- **Plates** (groups 1 to 4) open every door of their group while anything stands on them: a climber, the echo or a crate. **Heavy plates** need a weight of 2: Enzo, his echo or a crate.
- **Doors** slide open or shut in 10 ticks. Some groups **hold** their doors open for a few seconds after the plate is let go, with a ticking clock arc on the door (2 to 8 seconds, per room).
- **Crates** (16 × 16) fall, stack and press plates. Only Enzo or his echo can push them, one at a time.
- **Lifts** rise while their plate is pressed (48 units a second) and sink back when it isn't.
- **Fans** blow a column of wind up to the first solid tile. Some only run while a plate is pressed.
- **Seesaws** are four tiles wide. A weight of 2 or more (Enzo, his echo or a crate) landing on the high pad faster than 90 flips it and launches whatever is on the low pad: Dora at 470 (she rises about 130 units), Enzo at 330, a crate at 300. Dora is too light to flip one.
- **Crumbling ledges** fall 30 ticks after anyone stands on them and stay gone until time rewinds.
- **Glow-moss** is solid for the live climber only while the echo is within 52 units of it; during a recording it is never solid.
- **The golden seed** counts if the live climber or the echo touches it in the clearing loop.

## Stars, unlocking and hints

Each room has three stars: clearing it, the golden seed, and clearing within par loops. Stars only ever add up; the best loop count is kept. Clearing a room opens the next two, so one stubborn room never blocks the way. Every room has a free hint (the 💡 button or **H**). The first clear of room 30 plays the ending, which can be watched again from the menu.

## Rooms

### The Root Cellar

| Room | Name | Records first | Candle | Par | New idea |
| --- | --- | --- | --- | --- | --- |
| 1 | First Light | Dora | 12 s | 3 | Dora records first. Then Enzo plays beside her echo. |
| 2 | Two Doors | Dora | 12 s | 3 | The echo replays in time: what Dora does later happens later. |
| 3 | Leg Up | Dora | 14 s | 3 | Jump off Dora’s echo for a springy boost. |
| 4 | Kit Tunnel | Dora | 14 s | 3 | Kit tunnels are one tile high: Dora fits, Enzo doesn’t. |
| 5 | Hold, Then Help | Dora | 16 s | 3 |  |
| 6 | Root Maze | Dora | 12 s | 4 |  |

### Mushroom Hollow

| Room | Name | Records first | Candle | Par | New idea |
| --- | --- | --- | --- | --- | --- |
| 7 | Crate Pen | Dora | 16 s | 3 | Only Enzo can push crates. A crate holds a plate down. |
| 8 | Heavy Paws | Dora | 14 s | 3 | Big plates need something heavy: Enzo or a crate. |
| 9 | Count to Two | Dora | 14 s | 3 | Ticking doors stay open a moment after you step off. |
| 10 | Slow Crate | Dora | 14 s | 4 |  |
| 11 | Mushroom Steps | Dora | 16 s | 3 |  |
| 12 | Hollow Heart | Dora | 12 s | 4 |  |

### The Underground Brook

| Room | Name | Records first | Candle | Par | New idea |
| --- | --- | --- | --- | --- | --- |
| 13 | Lift Off | Dora | 18 s | 3 | Lifts rise while their plate is pressed. |
| 14 | Updraft | Dora | 14 s | 3 | Wind lifts Dora up. It only slows Enzo’s fall. |
| 15 | Brook Crossing | Dora | 14 s | 3 | Some fans only blow while their plate is pressed. |
| 16 | Wind and Lift | Dora | 18 s | 4 |  |
| 17 | Enzo’s Turn | Enzo | 12 s | 3 | Now Enzo records first, and Dora plays beside his echo. |
| 18 | Shoulders | Enzo | 18 s | 4 | Dora can stand on Enzo’s echo too. |

### Crystal Gallery

| Room | Name | Records first | Candle | Par | New idea |
| --- | --- | --- | --- | --- | --- |
| 19 | Seesaw | Enzo | 14 s | 3 | Enzo’s weight flips a seesaw and throws whoever is on the other end. |
| 20 | Crumble Lid | Dora | 12 s | 3 | Cracked ledges crumble under paws and stay gone until time rewinds. |
| 21 | Over the Top | Enzo | 16 s | 3 |  |
| 22 | Crate Fling | Enzo | 12 s | 3 | Crates are heavy enough to flip a seesaw. |
| 23 | Brittle Bridge | Dora | 14 s | 4 |  |
| 24 | Gallery Heart | Enzo | 16 s | 4 |  |

### Home Burrow

| Room | Name | Records first | Candle | Par | New idea |
| --- | --- | --- | --- | --- | --- |
| 25 | Glow-Moss | Dora | 12 s | 3 | Glow-moss is only solid while the echo is close by. |
| 26 | Lantern Walk | Enzo | 14 s | 4 | A moving echo carries the light with it. |
| 27 | Lantern Climb | Dora | 22 s | 4 |  |
| 28 | Fling and Glow | Enzo | 14 s | 4 |  |
| 29 | Hover Lamp | Dora | 12 s | 4 |  |
| 30 | Home | Enzo | 22 s | 5 |  |

## Controls

- **Keyboard:** ←/→ or A/D move; Space, ↑ or W jump; R stops the recording or retries; Shift+R records again; H hint; Esc or P pause; on the stars panel Enter goes on and R plays again.
- **Gamepad:** stick or d-pad moves, Ⓐ jumps, Ⓧ is R, Ⓨ is Shift+R, Start pauses.
- **Touch:** ◀ ▶ and a jump button, with ⟲ (stop or retry) and ⟲⟲ (record again). Upright phones get them below the room, sideways phones beside it; they never cover the room.
- The game pauses when the tab is hidden or the window loses focus, and picks up with no jump in time.

## Saving

Saved in `localStorage` under `echo-burrow-v1`: per room whether it is cleared, the seed and par stars and the best loop count, plus the last room played, whether the ending has been seen, and the sound, music and shake settings. Anything that isn't a version-1 save, or a value of the wrong type, is ignored and the game starts fresh; a last room that isn't open falls back to room 1.

## Tests

- `npm run test:echo`: 683 engine checks (see the README).
- `npm run bot:echo`: plays every room's stored solution (`tests/echo-solutions.json`, run-length encoded inputs for both loops) and its seed solution, checks that idling clears nothing, and runs a breadth-first search to show the second climber can't clear a room alone with an empty recording. `npm test` runs it with `--quick`, which skips the search.
- `npm run test:e2e:echo`: the browser checks.

The stored solutions were written as small step plans (walk to here, jump, wait for the door) and recorded tick by tick, so if a room changes, its solution must be recorded again.

## Known gaps

- Room 30 (Home) brings together crates, a heavy plate, a seesaw, crumbling ledges, a kit tunnel, glow-moss and a timed door, but not fans, lifts or the head boost.
