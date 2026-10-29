# Seedstorm

A cosy vertical shoot-'em-up at `/seedstorm`. The Grumble Storm has rolled over the valley and its gusty helpers are blowing everyone's washing away, so Dora and Enzo hop on dandelion-seed gliders and fly up through five skies to calm it down. Dodge pretty patterns of petals, seeds and raindrops with a tiny hitbox, puff storm critters into fluff, and make friends with five grumpy bosses. Nobody is ever hurt: a beaten critter puffs into fluff and drifts home.

Written 29-10-2026 (difficulty retuned the same day) from the code in `lib/seedstorm-game.ts`. Every number below is a constant there.

## The field and the clock

- The field is 360 × 640 units, portrait. The scene scales it to fit the screen and paints the space around it with a blurred, darkened copy of the sky.
- The game runs in fixed ticks, 60 a second. The page steps it with an accumulator; a long frame runs at most 8 ticks and drops the rest, so a slow device never spirals.
- Randomness (a few boss patterns and how seeds scatter) comes from a seeded mulberry32 generator, so a seed and the same inputs replay a run exactly.
- Bullets, shots, seeds and critters live in fixed pools of 700, 160, 320 and 48. When the bullet pool is full, new bullets are simply not fired. A seed that does not fit in its pool is collected on the spot.

## Pilots

| Pilot | Speed (units a tick) | Shot | Wingmate |
| --- | --- | --- | --- |
| Dora | 3.7 | **Petal Spread**: 1 + 2 × Shot Power petals a volley (3, 5, 7, 9), 1 damage each, speed 10, fanned over 0.26 + 0.12 × level radians (focused: 0.08 + 0.03 × level). | Enzo |
| Enzo | 3.1 | **Pebble Lance**: Shot Power + 1 pebbles side by side (2 to 5), 1.45 damage each, speed 12, 8 units apart (focused: 5). A pebble pierces small critters (base health 12 or less: bumbles, kites, sprouts, moths, wisps) and carries on. | Dora |

- Shots fire by themselves, a volley every 5 ticks (12 a second).
- The wingmate flies behind and to one side of the pilot and fires a homing seed (2.2 damage, speed 7, turning up to 0.15 radians a tick toward the nearest critter or boss) every 5, 4, 3 or 2 volleys (Wingmate Wings level 0 to 3).
- **Focus** (Shift, or the 🎯 button) slows the pilot to 45 %, tightens the shot, pulls the wingmate in front, and shows the hitbox.
- The **hitbox** is a dot of radius 2.5 at the pilot's chest. Only that dot can be hit; bumping into a critter (55 % of its radius) or a boss (50 %) counts too.
- A bullet that passes within 16 units without hitting is a **graze**: +5 points and +1.6 Bloom meter. Each bullet grazes once, and nothing grazes while the pilot is blinking.

## Hearts, Bloom and continues

- **Hearts:** 3 at the start (5 on Breezy), at most 8. A hit costs a heart, clears every bullet within 110 units, resets Breeze to ×1, and gives 120 ticks (2 s) of blinking invulnerability.
- **Bloom** (X, Space or K, a second finger, or the 🌸 button): hold 2 at the start, carry 3 (plus one per Bloom Pouch). A Bloom sends a ring of petals out from the pilot at 16 units a tick for 45 ticks; every bullet it passes turns into a seed, and on its last tick every bullet left goes too. It deals 40 damage to every critter and 50 to the boss, and gives 180 ticks (3 s) of invulnerability.
- **Bloom meter:** 100 points makes a Bloom. Grazes give 1.6, seeds 0.35 (big seeds 1.05), puffing a critter 1. At the cap the meter waits, full, and becomes a Bloom as soon as one is used.
- **Last-gasp Bloom:** a hit only lands 12 ticks (0.2 s) later. Blooming inside those 12 ticks cancels it ("Phew! Saved by a Bloom!").
- At 0 hearts the run is over. Breezy and Gusty offer **Continue**: hearts refill, at least 2 Blooms, 3 s of invulnerability, the score starts again from 0 and a continue counter shows. Stormy has no continues. The score at each game over goes on the high-score table.

## Seeds and the Breeze multiplier

- Puffed critters drop seeds (see the critter table), a boss phase that ends drops 6 big seeds, and Bloom and phase breaks turn bullets into seeds.
- Seeds drift down at up to 1.1 units a tick. Within 44 units of the pilot (plus 26 per Magnet Paws) they are pulled in; seeds from bullets fly home by themselves after 20 to 24 ticks; and while the pilot is in the top quarter of the field every seed flies to them. A seed is collected within 15 units. When a stage ends, any seeds still in the air are collected.
- A seed scores 10 × Breeze (a big seed 50 × Breeze) and adds 1 seed (big: 5) to the purse for the shop.
- **Breeze** starts at ×1.0. Each critter puffed within 90 ticks (1.5 s) of the last adds 0.1, up to ×5.0. With no kill for 1.5 s it decays by 0.01 a tick back to ×1.0. Losing a heart resets it.

## Difficulty

| | Breezy | Gusty | Stormy |
| --- | --- | --- | --- |
| Bullet speed | × 0.62 | × 1 | × 1.25 |
| Bullets per ring, fan and curtain | × 0.45 | × 1 | × 1.5 |
| How often things fire | × 0.55 | × 1 | × 1.45 |
| How often critters fire (on top of that) | × 0.85 | × 1 | × 1 |
| Boss health | × 0.7 | × 1 | × 1.3 |
| Hearts | 5 | 3 | 3 |
| Continues | yes | yes | no |

Spiral arms are never thinned; they fire less often instead. Curtain gaps keep their width on every difficulty. Critters never fire when they are lower than 62 % of the field, off its sides, or within 96 units of the pilot. On Breezy and Gusty, critters fire less often while pilots find their wings: × 0.75 in stage 1 and × 0.85 in stage 2.

## Stages

Each stage runs a scripted timeline: waves of critters at set times, a mid-boss (the stage clock stops until it has gone), then the boss. When the boss is due it waits for the last critters (at most 4 s), the sky clears, and the boss flies in and chats. A stage takes about 2.5 to 3 minutes.

| # | Stage | Critters | Mid-boss (at) | Boss (at) |
| --- | --- | --- | --- | --- |
| 1 | Meadow Morning | bumbles, kites | Big Bumble (35 s) | Gale the Magpie (70 s) |
| 2 | Orchard Breeze | kites, beetles | Kite Captain (35 s) | Crabapple Crow (72 s) |
| 3 | Thunderhead | sprouts, beetles | Sprout Chief (37 s) | Rumble the thundercloud (74 s) |
| 4 | Moonlit Mist | moths, wisps | Moth Matron (37 s) | Madame Hoot the owl (74 s) |
| 5 | Eye of the Storm | all six | Wisp Warden (37 s) | The Grumble Storm (76 s) |

### Critters

Health grows by 30 % a stage after the first (rounded): the last column is stages 1 to 5.

| Critter | Health | Radius | Points | Seeds | Health by stage |
| --- | --- | --- | --- | --- | --- |
| Bumble | 8 | 12 | 150 | 3 | 8, 10, 13, 15, 18 |
| Kite | 5 | 11 | 120 | 2 | 5, 7, 8, 10, 11 |
| Beetle | 22 | 14 | 300 | 5 | 22, 29, 35, 42, 48 |
| Sprout | 12 | 13 | 200 | 3 | 12, 16, 19, 23, 26 |
| Moth | 9 | 12 | 180 | 3 | 9, 12, 14, 17, 20 |
| Wisp | 6 | 10 | 160 | 2 | 6, 8, 10, 11, 13 |

Critters fly one of four paths (fly in and stop, arc across, drift down with a sway, swoop in and curve away) and fire one of six guns: an aimed shot or stream, an aimed fan, a ring, a spiral, a slow-then-fast raindrop, or a burst that stops and turns toward the pilot.

### Bosses and their attacks

Each phase has its own named attack, a health bar and a timer. Health is shown for Gusty (Breezy × 0.7, Stormy × 1.3). Bosses hover at heights 148 to 156 and mid-bosses at 156, clear of the health bar.

| Boss | Attack | Health | Time | What it does |
| --- | --- | --- | --- | --- |
| Big Bumble (mid) | Buzzing Bloom | 200 | 20 s | Rings of 14 gold seeds, each one offset half a step, and aimed petal fans. |
| Gale the Magpie | Button Barrage | 400 | 40 s | Aimed 7-way fans of shiny buttons and slow rings of 22 petals. |
| | Feather Flurry | 600 | 45 s | Two counter-turning three-arm spirals of feathers from the wing tips, and aimed buttons. |
| | Shiny Swoop | 520 | 50 s | Swoops while dropping petals that bounce off the side walls once, and rings of 18 buttons that stop, then turn toward you. |
| Kite Captain (mid) | Ribbon Loop | 320 | 20 s | Gently wiggling ribbons of petals from both sides of the kite, and aimed fans. |
| Crabapple Crow | Crabapple Cascade | 600 | 42 s | Lobs 7 crabapples high that fall back under gravity, and aimed seed fans. |
| | Wobbly Windfall | 840 | 46 s | Slow crabapples that wobble and home in for 100 ticks, and rings of 24 seeds. |
| | Scarecrow Shuffle | 920 | 50 s | Curtains of leaves with a 68-unit gap that sways across the sky, while the crow follows you and throws apples. |
| Sprout Chief (mid) | Pitter Patter | 440 | 20 s | Raindrops that start slow and fall faster, and rings of 18 seeds. |
| Rumble | Static Spiral | 1000 | 45 s | A five-arm spiral of sparks that switches direction every 4 s, and slow rings of raindrops. |
| | Slow Drizzle, Fast Pour | 860 | 48 s | Curtains of raindrops that start slow and pour faster, with a 76-unit gap that slides slowly from side to side, and small aimed fans of 3 sparks. |
| | Thunder Drum | 1180 | 52 s | Double rings of 28 sparks on the beat, and bursts that stop and turn toward you. |
| Moth Matron (mid) | Lantern Flutter | 560 | 20 s | A three-arm spiral of petals and fluttering rings of stars. |
| Madame Hoot | Moonmoth Waltz | 1200 | 45 s | Three beats a bar: one big ring of 28 petals and two rings of 18, each curling the other way. |
| | Starry Shawl | 1300 | 48 s | Four star lanterns circle the owl, each blooming rings of 8 stars, plus stars that bounce off the walls. |
| | Hoot Hoot Hush | 1050 | 52 s | Two wide slow rings of 36 moons ("hoot hoot"), a fast three-lane stream aimed where you were ("hush"), and a fan of petals. |
| Wisp Warden (mid) | Will-o'-Whirl | 580 | 20 s | Rings of sparks that stop and turn toward you, and rings of seeds. |
| The Grumble Storm | Grumble Gust | 1250 | 45 s | Gusts of wiggling leaves blow in from one side, switching every 4 s, plus aimed fans. |
| | Hailstone Hullabaloo | 1600 | 48 s | Rings of 22 hailstones that stop, then fall faster and faster, and hail that bounces off the walls. |
| | Lightning Lullaby | 1700 | 50 s | Two counter-turning three-arm spirals of sparks, and fast aimed streams of lightning. |
| | Grumble Typhoon | 1900 | 60 s | A six-arm spiral whose turn swings back and forth, and slow rings of 30 seeds. |

- Beating a phase scores 1,000 × the stage. Beating it before the timer runs out **without losing a heart** (a hit still waiting out its last-gasp window when the phase breaks counts as one unless a Bloom saves it) also earns a **Clear Sky** bonus of 2,000 + 1,000 × the stage + 50 for every second left. A phase that times out just ends, with no bonus.
- When a phase ends every bullet turns into a seed and the game runs in slow motion for a moment. Mid-bosses fly home afterwards; bosses calm down, chat, and make friends.

## Chats

Before each boss, 3 or 4 lines with portraits (advance with a tap, Z, Enter or Space; Esc skips). After the fight, a two-line "making friends" exchange. "Pilot" lines are spoken by whoever flies, "wing" lines by the wingmate.

## The seed shop

Between stages: the stage results (stage score, grazes, Clear Sky out of the stage's phases, seeds, no-hit bonus and Bloom bonus), then the shop. Prices rise with each purchase: base × growth to the power of how many you have bought, to the nearest 10.

| Upgrade | Effect | Max | Prices |
| --- | --- | --- | --- |
| 🌼 Shot Power | More petals or pebbles a volley | level 4 (starts at 1) | 250, 450, 810 |
| 🪶 Wingmate Wings | Faster homing seeds | 3 | 180, 310, 520 |
| 💗 Extra Heart | +1 heart | once per shop, up to 8 hearts | 300, 450, 680, 1,010, … |
| 👝 Bloom Pouch | Carry one more Bloom | 4 | 200, 320, 510, 820 |
| 🧲 Magnet Paws | Seeds pulled from 26 units further | 2 | 120, 220 |

Keys 1 to 5 buy, Enter flies on.

## Scoring

- Critters: their points (120 to 300).
- Seeds: 10 (big 50) × Breeze.
- Grazes: 5 each.
- Boss phases: 1,000 × stage, plus Clear Sky bonuses.
- At the end of each stage: 5,000 × the stage if no heart was lost, and 1,000 for every Bloom still held.

## Practice

Any stage reached on any difficulty can be practised alone, on the chosen difficulty, with fresh hearts (the difficulty's starting number) and starting upgrades. Practice runs do not go on the high-score table.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Fly | Arrow keys or WASD | Drag anywhere: the pilot keeps its offset from your finger |
| Focus | Hold Shift | 🎯 toggle |
| Bloom | X, Space or K | 🌸 button, or tap with a second finger |
| Pause | Esc or P | ❚❚ Pause |
| Chat | Z, Enter or Space; Esc skips | Tap |

Shots fire by themselves. The game pauses when the tab is hidden or the window loses focus. A mouse drag flies the pilot too.

## Saving

`localStorage` key `seedstorm-v1`, read defensively (anything missing, broken or from another version falls back to the default):

- `pilot` and `diff`: the last choices;
- `scores`: the top 5 per difficulty, each with score, pilot, stage reached, whether it cleared all five, continues used, and the date (a timestamp, formatted on the page after it mounts);
- `reached`: the furthest stage per difficulty, and `cleared` flags;
- `settings`: sound, music and screen shake.

## Art

Twenty-three paintings in `public/art/seedstorm/` (briefed in `docs/seedstorm-art-brief.md`): the title and ending (1200 × 800), five skies (720 × 1600, tiling top to bottom, drawn 360 × 800 units), the two gliders and six critters (256 × 256), the five bosses plus the calm Grumble Storm (512 × 512), and Dora's and Enzo's chat portraits (512 × 512). Bosses talk in their own painting. Under play each painted sky is baked once into a quieter copy, partly desaturated and washed toward a deep stage colour (strongest on the bright daytime stages 1 and 2), so every bullet reads over it; the drawn cloud layers drift over the paintings at 40 % of their usual strength. Every painting keeps a drawn stand-in, shown until (or unless) it loads: the scene draws every critter, boss, glider and sky itself, and the menu, chat portraits and ending have canvas stand-ins under their images.
## Sound

Made on the fly with WebAudio; silent until the first click, tap or key. Soft shot ticks (at most one every 0.09 s), puff pops, graze tings, a Bloom whoosh and chime, chords when a phase breaks, and an "oof" on a hit. Each stage has its own music loop from a small step sequencer (a melody over a bass, a pad and a soft beat, in its own key and tempo, with a faster boss variant). Sound, music and shake each have their own toggle.

## Files

- `lib/seedstorm-game.ts`: the rules (deterministic, no DOM).
- `lib/seedstorm-scene.ts`: Canvas 2D drawing, the drawn stand-ins and the HUD.
- `app/seedstorm/page.tsx`, `app/seedstorm/seedstorm.css`, `app/seedstorm/sound.ts`, `app/seedstorm/layout.tsx`: the page.
- `tests/seedstorm.mjs`: engine checks (`npm run test:seedstorm`).
- `tests/seedstorm-bot.mjs`: the dodging bot (`npm run bot:seedstorm`; `npm test` runs its `--quick` check).
- `tests/e2e/seedstorm.mjs`: the browser suite (`npm run test:e2e:seedstorm`, with `npm run dev` running and Playwright installed).

The page exposes `window.__seedstorm()` (the running game), `window.__seedstormStart({ pilot, diff, seed, stage, practice })` and `window.__seedstormSkip(stage)` (jump to that stage's boss) for the browser tests, and marks `main[data-ready="true"]` once it has hydrated.

## Tests

- **Engine** (`tests/seedstorm.mjs`): exact replays after 3,000 ticks; movement, focus and touch targets; shots and piercing; the hitbox and graze edges; invulnerability; Bloom, the meter and the last-gasp window; game over and continues; pool caps under the busiest boss on every difficulty; seeds, magnets and the top-quarter call; Breeze chains and decay; shop prices and caps; every timeline ending with its boss; every boss phase's name, timer and health; a full boss with chats, Clear Sky and a timeout; mid-bosses stopping the clock; practice; difficulty scaling; bullet behaviours; and saving.
- **Bot** (`tests/seedstorm-bot.mjs`): each tick it plays the nearby bullets forward 22 ticks and tries the nine moves with focus on and off (two-part moves when nothing is safe), preferring to fly under the boss or the critters or toward seeds, and Blooms when a hit is certain or has just landed. It must clear Breezy and Gusty for at least 4 of 5 seeds, buying upgrades in the shop, and a pilot who stands still and never Blooms must lose on Gusty before the end of stage 2.
- **Human-like pilot** (also in `tests/seedstorm-bot.mjs`): it looks and decides only every 8 or 9 ticks (about 140 ms), watches the nearest 40 bullets within 110 units (ignoring ones already past it), keeps about 5 units clear, holds focus when 12 or more bullets are within 70 units, steers up to 25 degrees off on one look in five (a seeded wobble), Blooms only when it notices a bullet within 10 units (never in the last-gasp window), shops, and continues when it runs out. On seeds 1 to 8 it must clear Breezy losing at most 2 hearts, clear Gusty's stage 1 losing at most 1 heart, and reach Gusty's stage 4 on at least 6 seeds; its Stormy runs are printed, not asserted. `npm test` checks Gusty's stage 1 for seeds 1 to 3.
- It also reports, without asserting, how a clumsier bot (reacting every 8 ticks, keeping 10 units clear, never Blooming) fares on each difficulty.
