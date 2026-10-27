# Puttering Paws

Game 40, at `/putt`: storybook 3D mini golf. Dora and Enzo putt through two nine-hole courses in the Grumble Hunt meadow. Written 27-10-2026.

## The game

- **Who putts.** Dora, Enzo, or both taking turns on one screen. In a two-player round each friend plays the hole in turn (Dora first on hole 1). From then on, whoever scored lower on the last hole putts first; a tie keeps the order. The friend who isn't putting waits by the flag and lifts it as the ball drops.
- **Courses.** The **Clover Nine** (par 24) is sunny meadow. The **Lantern Nine** (par 27) is the same meadow at dusk, with lantern strings, fireflies and trickier holes. It opens once a Clover round is finished. **Practise a hole** plays any open hole on its own; practice is not saved as a round.
- **Scoring.** Strokes per hole, against par. A ball in the water costs one stroke and goes back to where it was putted from. After six putts the ball is picked up and the hole scores 7. Labels: Hole in one!, Eagle!, Birdie!, Par!, Bogey, Double bogey, Holed out, Picked up.
- **Golden acorns.** Every hole has one, placed off the easy line. Rolling through it picks it up, and it counts once forever. The clubhouse shows them per course and as a row of 18.
- **The clubhouse** keeps each hole's best, every ace, the acorns, each course's best round and the number of rounds.

## Controls

- **Mouse or touch:** drag back from anywhere on the course and let go, like a slingshot. The putt goes the opposite way to the drag, and power is `(drag length − 0.12) / 3` tiles, up to full. A drag shorter than 0.12 tiles cancels.
- **Keys:** ←/→ or A/D turn the aim (1.3 rad/s), ↑/↓ or W/S change power (0.55 per second), and Shift slows both to a quarter. Space or Enter putts, skips the fly-over and leaves the scorecard. V toggles the whole-hole view, M toggles sound and Escape pauses.
- **Aiming help.** After every putt the aim points straight at the cup if the way is clear, or else at the furthest-along bit of course in plain view. The dotted line shows the direction for `GUIDE_REACH` (3) tiles, plus the first bounce dimmed. It never shows the distance; the power bar and the ring under the ball (green to red) show that.

## Rules engine (`lib/putt-game.ts`, `lib/putt-courses.ts`)

Everything is deterministic, with no randomness at all: the same putts at the same moments roll the same way. The moving parts (windmills, bales, the Bristleback) run off the hole clock, which starts at 0 when each player's turn begins.

**Holes are tile maps.** One character is one tile, one world unit; +x is east and +z is south.

| Char | Tile |
| --- | --- |
| `.` | felt |
| `s` | dust-bath sand |
| `w` | pond |
| `#` | hay block (solid) |
| `T` / `C` / `a` | tee / cup / golden acorn (on felt) |
| `m` | mushroom bumper (on felt) |
| `> < ^ v` | ramp rising east / west / north / south |
| `[ ] { }` | felt cut on the diagonal (NW / NE / SW / SE corner) |

Each hole may also have:

- `levels`: a height per tile, each step `STEP_H` = 0.25.
- `drops: true`: lets a ball roll off a one-step ledge onto the level below. It can never climb back, so the ledge is a wall from below.
- `mounds`: gaussian hills (positive `h`) or bowls (negative `h`).
- `movers`: `boar` or `bale`, moving back and forth between two points on a cosine ease.
- `tunnels`: burrow pairs, mouth to exit and the exit's direction.
- `windmills`: a tile, an axis and a period.

`parseHole` turns a spec into tiles, edges, merged wall segments and a flow field. The flow field counts tiles to the cup, through burrows, and drives the suggested aim and the bot. It also works out each windmill's door gate on the side further from the cup.

**Physics.** Each 1/60 s step runs three substeps:

1. Slope gravity, `G` = 9.8 times the surface gradient (ramps and mounds).
2. Within `CUP_R` + 0.22 of the cup, a pull towards it of 2.6.
3. Rolling drag of `a + b·speed`: felt `{1.4, 0.14}`, sand `{7.5, 1.4}`.
4. Movement, then collisions:
   - rails bounce with 0.75 restitution;
   - mushrooms with 1.1 and a 0.8 kick;
   - movers with 0.5, relative to the mover's own speed;
   - windmill sails with 0.45, while a sail is within 0.36 rad of straight down, which is 46% of the time;
   - speed is capped at `MAX_SPEED` = 8.5.
5. Burrows swallow the ball within 0.3 at any speed and roll it out after 0.75 s, at 0.9 × its speed, between 2.2 and 6.
6. The ball drops when it is within `CUP_R` = 0.3 of the cup and slower than `CUP_SPEED` = 2.5. Faster, it lips out once per pass, losing a fifth of its speed and turning 0.22 rad.
7. It comes to rest under 0.06 unless the slope pulls harder than the surface can hold (felt 1.6, sand 4.5). A roll is stopped after 30 s.

A putt's speed is `8.5 × √power`, so roll length grows about evenly with power.

**Saves.**

- The profile is saved under `puttering-paws-v1`: `holeBest`, `aces`, `acorns`, `courseBest`, `finished` and `rounds`. Unknown holes, impossible scores and junk are dropped.
- A course round is saved under `puttering-paws-run-v1` whenever the ball is still (intro, aim or scorecard). It holds the course, players, scores, hole, order, turn, strokes, ball and clock.
- `PuttGame.load` refuses a save with a different version, course, hole list, roster, order, turn or score shape. It puts a ball that is off the course back on the tee. Practice is never saved.

## The holes

| # | Clover Nine | Par | Idea |
| --- | --- | --- | --- |
| 1 | First Hop | 2 | A straight lane; the acorn waits in a side pocket. |
| 2 | Clover Bend | 2 | An L, with a cut corner to bank off. |
| 3 | Hayloft Ramp | 2 | Up a ramp, with dust on the top shoulders. |
| 4 | Windmill Lane | 2 | Time the door, or go round through the dust. |
| 5 | Dust Bath Dunes | 3 | Sand traps and gentle hills; the cup sits in a dip. |
| 6 | Burrow Hop | 3 | Two burrows under a hedge: one near the flag, one near the acorn. |
| 7 | Mushroom Ring | 3 | A ring of bouncy mushrooms round the cup. |
| 8 | Sleepy Bristleback | 3 | A sleep-walking Bristleback crosses the bridge every 5 s. |
| 9 | Haystack Summit | 4 | Up a ramp, along a top lane past mushrooms, through a windmill to the summit. |

| # | Lantern Nine | Par | Idea |
| --- | --- | --- | --- |
| 1 | Lantern Steps | 3 | Three one-way ledges down to the cup, past hay blocks. |
| 2 | Firefly Bridge | 3 | A narrow bridge between two ponds; the cup is round the corner. |
| 3 | Twin Windmills | 3 | Two windmills in a row, 4.2 s and 6.4 s. |
| 4 | Moon Bowl | 2 | A round green that dips to the cup. |
| 5 | Burrow Maze | 3 | Three islands joined by four burrows; one leads home to the tee. |
| 6 | Rolling Bales | 3 | Two bales roll across the lane; a mushroom guards the flag between dust traps. |
| 7 | Pond Island | 3 | The cup on an island, a causeway and a corner burrow. |
| 8 | Switchback Hill | 4 | Up a ramp, along a bumpy top, then a drop onto the green. |
| 9 | The Great Lantern | 3 | Up a narrow ramp through a windmill, round a hill to the corner cup, or the burrow gamble. |

## How par was set and checked

- **Proofs.** `node tests/putt-bot.mjs --find` beam-searches angle (every 2°, or 4° on timed holes), 16 power levels and waits through each hole's shortest cycle. It found a par-or-better line (`proof`) and a line through the acorn (`acornProof`) for every hole. `npm run test:putt` replays both through the real game, and a whole Clover round on the proofs.
- **Fairness.** `npm run bot:putt` plays each hole eight times as a careful player who aims the way a person does. It starts from the suggested aim, tries up to 16° either side and every power, picks what looks best one putt ahead, and then misses by up to 5° and 20% power. It fails if the average is more than one stroke from par.

An earlier bot that searched every angle found bank-shot aces no person would see. That made every par look too generous, so the bot now plays like a person.

Results on 27-10-2026:

| Course | Hole averages (1–9) |
| --- | --- |
| Clover | 1.63, 1.75, 2.00, 2.13, 2.13, 2.63, 2.63, 3.13, 4.38 |
| Lantern | 2.63, 3.25, 3.50, 1.38, 3.00, 2.63, 2.50, 4.38, 2.88 |

Two pars moved from the measurements: Windmill Lane 3 → 2 and Burrow Hop 2 → 3. Three holes were redesigned:

- Firefly Bridge's cup left the straight line.
- Rolling Bales got its mushroom.
- The Great Lantern lost its catch-all bowl and became par 3.

## Drawing (`lib/putt-scene.ts`)

- **Look.** Three.js with toon materials and the ink `OutlineEffect`, matching Grumble Hunt. The heroes are Grumble Hunt's chinchilla rigs (`lib/hunt-chinchilla.ts`) at 0.42 scale, holding a little putter. The putter swings back with the power and through on the putt. The hero hops to the ball's new spot between putts.
- **Course.**
  - Felt, sand and water are surface meshes per kind, subdivided where there are mounds.
  - Rails are merged wooden slabs with posts.
  - Ramps carry pale chevrons pointing uphill.
  - The windmill has a house, a roof and turning sails, and its footing stops under the felt.
- **Ball.** White, with a band in the putter's colour (Dora pink `#f6a9b8`, Enzo blue `#9fb7d9`).
- **Aim line.** Two instanced meshes, bright before the first bounce and dim after, so it costs two draw calls.
- **Dusk.** Lantern strings on posts and a warm point light at each end. Fireflies are round glow points. A lantern within 4 units of the camera hides, so it never blocks the view.
- **Cameras.** A fly-over intro; an aim view over the putter's right shoulder (1.4× further back on a tall phone screen); a follow camera while rolling; an orbit of the cup on a drop; and the whole-hole view, fitted to the hole's bounding circle.
- **Budget.** The Lantern holes measured 321–399 draw calls and 82k–96k triangles at 1280×800 before the instanced aim line. The browser suite holds desktop under 500 calls and phone under 450.
- **Paintings.** Codex painted the dusk sky, the felt, wood, dust and water textures, the clubhouse title painting and the two finale paintings: `trophy.webp` after the Clover Nine and `lantern.webp` after the Lantern Nine (`public/art/putt/`, see [`docs/puttering-paws-art.md`](puttering-paws-art.md)). The tree, flower and lantern-tree cards timed out on every try across three briefs, so trees and flowers use Grumble Hunt's cards. Every texture starts as a plain or speckled placeholder and falls back to Grumble Hunt art if a file fails to load.

## Sound (`app/putt/sound.ts`)

Small Web Audio synths, at most one per event kind every 60 ms:

- a tock for the putt (louder the harder it is hit);
- wood knocks for rails, a boing for mushrooms and a rattle for a lip-out;
- a plink and chime for the cup, and a splash;
- a hiss for sand;
- a sparkle for the acorn;
- a sliding pop into and out of a burrow, a grunt for a mover and a clack for a windmill sail;
- a two-note call at each hole and turn, a soft two notes for a pick-up, and a little fanfare at the end of a round.

Mute is saved under `puttering-paws-sound-v1`.

## Tests

- `npm run test:putt`: 13 engine checks, in `npm test`.
- `npm run bot:putt`: par fairness on all 18 holes. It takes a few minutes, so it is not in `npm test`.
- `npm run test:e2e:putt`: the browser suite. It covers:
  - arcade entry and the clubhouse;
  - a drag putt and a recorded line played with Space;
  - keyboard aim, the whole-hole view and pause;
  - a saved two-player round resumed after a reload;
  - the Lantern Nine's unlock and draw-call budget;
  - the phone layout with a touch drag;
  - renderer clean-up on leaving.

  Screenshots go in `.checks/putt/`.

## Ideas not done

- A third course: winter, with ice that barely slows the ball.
- Ghost lines of your best putts on each hole.
- Per-hole camera hints for the trickiest holes (Burrow Maze, Switchback Hill).
