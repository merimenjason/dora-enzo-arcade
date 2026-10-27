# Fluff Roll

Game 41, at `/roll`: a 3D roll-and-grow game. Dora pushes a dust ball round the meadow, and everything smaller than it sticks. Written 27-10-2026.

## The game

- **The fluffball.** Dora's dust bath has gone rolly-polly. She pushes the ball from behind, and Enzo runs on top and calls out every catch ("A teacup!").
- **Sticking.** A thing sticks when its size is at most `PICK` = 0.6 of the ball's radius. Bigger things are in the way: the ball bounces off them. As the ball grows, yesterday's walls become today's catches.
- **Growing.** The ball keeps `GROW` = 0.4 of each stuck thing's volume (the rest is the gaps between things). Size call-outs come every 5 cm under 50 cm, every 10 cm under 2 m, then every metre.
- **Bonk.** Hitting something too big at more than 0.6 of top speed knocks up to three of the newest small things off. They land round the ball and can't stick again for 1.2 s.
- **Levels.** Each level has a starting size, a goal size and a clock. Reaching the goal opens the next level, and you keep rolling until the clock runs out. Stars: one for the goal, two for 1.35× the goal, three for 1.65×.
- **Too big for now.** A coral ring on the ground marks every thing near the ball that is still too big to roll up, so the rule is visible. Bumping one says what it is and the size it sticks at ("Too big for now! A cushion sticks at 80 cm"). The HUD names the next kind up ("Next up: teacups at 24 cm"). When the ball grows big enough for a new kind, a banner says so and every one nearby gives a hop.
- **Critters.** Ladybirds, shiny beetles, field mice, ducklings and ducks potter about. One the ball could roll up scurries away when the ball comes near, at most 0.45 of the ball's top speed, so a chase always ends in a catch. Ones too big to roll walk round the ball.
- **Golden acorns.** Each level hides three, ringed in gold, turning and bobbing. Each adds `GOLDEN_TIME` = 5 s to the clock; the most found per level is saved. They are never named as "next up".
- **Streaks.** Catches less than `STREAK_GAP` = 1 s apart count up a streak (shown from ×3), and each catch in a streak pops a little higher. The longest streak shows at the end. Streaks are for show and don't change the size.
- **Fluffbook.** Every kind of thing you have ever rolled up is recorded, with a count of things rolled in all.

| # | Level | Start | Goal | Time | Fenced square |
| --- | --- | --- | --- | --- | --- |
| 1 | Dust Bath Corner | 8 cm | 40 cm | 3 min | 14 m |
| 2 | Clover Garden | 32 cm | 1.6 m | 4 min | 52 m |
| 3 | Hay Barn Yard | 1.6 m | 8 m | 5 min | 180 m |
| 4 | The Whole Meadow | 6 m | 30 m | 3½ min | 660 m |

The Whole Meadow has the shortest clock because a ball that big crosses the meadow in seconds. Its biggest things are farmhouses, barns and grassy hills 18 m across, and a fast roll gathers every last thing in it.

## Controls

- **Touch or mouse:** press anywhere and drag, like a joystick. Up rolls forward, sideways turns (and edges the ball across a little). Past the rim, the stick's centre follows the finger.
- **Keys:** ↑/↓ or W/S roll forward and back, ←/→ or A/D turn. Space skips the intro, Escape pauses and M toggles sound.

## Rules engine (`lib/roll-game.ts`)

- Units are metres. A level's things are laid out from its seed, biggest first, in rings round the start (small things near the middle, big ones further out) and in patches. The same seed always gives the same layout.
- The ball steers towards the stick at `grip` (5.2 per second, a little lazier when big) up to `topSpeed` = 7.5 × r^0.9 metres per second. Movement is substepped so a fast little ball never skips over a seed.
- Free things are kept in a grid, with very big ones in a separate list, so a 1,400-thing level stays cheap.
- The profile is saved under `fluff-roll-v1`: unlocked levels, best size and stars per level, the kinds found and the number rolled. Junk and unknown ids are dropped.

## Balance

`node tests/roll-bot.mjs` (after compiling the engine) plays each level four times as a busy player. It heads for the best nearby thing, steers round anything too big, backs out when wedged and gives up on a target after 4 s. It checks the goal comes between 35% and 80% of the clock. On 27-10-2026:

| Level | Goal reached at | Final size |
| --- | --- | --- |
| Dust Bath Corner | 77–97 s of 180 | 69 cm |
| Clover Garden | 95–113 s of 240 | 2.5–3.1 m |
| Hay Barn Yard | 125–155 s of 300 | 13 m |
| The Whole Meadow | 81–102 s of 210 | 48 m |

The first level's start was made much denser after a play-through showed that rolling straight ahead for 8 s caught nothing. Adding the critters and golden acorns moved the seeded layout and emptied the start again, so it now has a fixed starter carpet of 300 seeds, crumbs and clover leaves within 1.3 m of the start.

`node tests/roll.mjs` checks the layout replays, sticking and bumping, the next-up hint and its call-out, streaks, golden acorns, critters (they wander, run and still get caught) and the save.

## Drawing (`lib/roll-scene.ts`)

- Toon materials and the ink outline, as in Grumble Hunt and Puttering Paws, with Grumble Hunt's meadow sky and grass and the Puttering Paws dust and wood textures.
- Every kind of thing has a modelled low-poly prop in `lib/roll-props.ts` (made by Codex: a teacup with a handle, a sock with a heel, a duckling with a beak), merged into one vertex-coloured shape, with a primitive stand-in for any kind without one. Each kind is drawn as one instanced mesh, so a level costs about one draw call per kind (about 290 with outlines and shadows). Tiny things use fewer segments.
- A stuck thing is stored in the ball's own turning frame, standing out from the surface like a pin in a cushion. Things buried deeper than 55% of the current radius are hidden.
- Rings are one instanced mesh, rebuilt every frame from the things within 12 ball radii; sparkles are a pool of 160 instanced bits that burst from where a thing sticks (gold and bigger for a golden acorn).
- Dora stands a little shorter than the ball, so the camera behind her sees the ball over her head.
- The camera sits behind the heading and pulls back and up as the ball grows; Dora grows more slowly than the ball, so late in a level she is small beside it.

## Tests

- `npm run test:roll` and `npm run bot:roll`, both in `npm test`.
- `npm run test:e2e:roll` checks:
  - the arcade card and the level menu;
  - rolling with the keys and with a drag;
  - a ring and the "too big" note at the dust-bath tub;
  - pausing;
  - finishing a level, which opens the next one and saves;
  - The Whole Meadow's draw calls;
  - the phone HUD.
