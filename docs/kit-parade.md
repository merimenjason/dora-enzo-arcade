# Kit Parade

Game 49, at `/parade`. A guide-the-wanderers puzzle game. A line of baby chinchilla kits pops out of a burrow, one after another, and marches on: they walk straight ahead, hop up and down little steps, turn round at walls and tumble down drops. Dora and Enzo can't reach them, but they can hand out a limited number of jobs. Pick a job, click a kit, and that kit digs, builds, climbs, glides or bounces so the parade finds its way to the home burrow, where Dora and Enzo wait with open paws. Thirty handmade levels across four worlds, three stars a level.

Nothing ever gets hurt. A kit that falls too far gets dizzy, and Mum swoops in and carries it home; a kit that falls in the pond gets a splash and a towel. Those kits just don't count towards the level.

## Files

| Part | File |
| --- | --- |
| Engine: the pixel world, kits, jobs, terrain things, stars, replays, saving | `lib/parade-game.ts` |
| The thirty levels as data, each with its stored solution and key jobs | `lib/parade-levels.ts` |
| Scene: skies, painted ground cut to shape, burrows, Dora and Enzo, the kits and their job bubbles, effects (Canvas 2D) | `lib/parade-scene.ts` |
| Sound: little pops, boings, chimes and a "wheee", made on demand | `app/parade/sound.ts` |
| Page: level select, briefing, play, pause, results | `app/parade/page.tsx`, `app/parade/parade.css`, `app/parade/layout.tsx` |
| Paintings (all optional; drawn stand-ins show until they load) | `public/art/parade/`, listed in [`kit-parade-art-brief.md`](kit-parade-art-brief.md) |
| Tests | `tests/parade.mjs`, `tests/parade-bot.mjs`, `tests/e2e/parade.mjs` |

## The world

Each level is a map of 8-pixel tiles written as text (`#` soft earth, `=` pebble stone, `_` and `-` half tiles, `/` and `\` slopes, `<` and `>` one-way hay, `{` and `}` hay belts, `b` hay bales, `~` water, `E` the entrance, `X` the home burrow; a number before a character repeats it). The engine turns it into a mask with one cell per world pixel, so digging, tunnelling, hugging and building change the ground pixel by pixel. Lily pads, seesaws and fans are objects placed in tiles.

The simulation runs at a fixed **25 ticks a second**. Kits are **10 pixels** tall and walk **1 pixel a tick**. A kit hops up any step of up to **5 pixels** and down any step of up to **4**; anything taller is a wall and the kit turns round. The sides of the world are walls. Kits pop out every `rate` ticks (30 to 110, set per level), facing right unless the level says left.

- **Falls.** Kits fall **3 pixels a tick**. A fall of up to **56 pixels** (seven tiles) is fine; any longer and the kit is dizzy for **40 ticks**, then Mum carries it home. Falling out of the bottom of the world: Mum catches it.
- **The home burrow.** A kit that walks within 3 pixels of it (and 4 up or down) is home and counts at once.
- **Water.** Kits never walk into the pond: they wait at the edge of the bank, or of their lily pad. A kit that falls or bounces into water splashes, and Mum fishes it out after **30 ticks**.
- **Lily pads** drift back and forth across the water (one pixel every 2 ticks in these levels) and carry anyone on them; kits hop on and off when the pad touches a bank.
- **One-way hay** can be tunnelled only in the direction its arrows point. Diggers and huggers clear it either way.
- **Pebble stone** can't be dug, tunnelled or hugged.
- **Hay belts** can't be dug either. They carry walking kits one pixel a tick their way (so a kit walking with a belt goes double quick), and spin round anyone walking against them.
- **Seesaws** tip toward the heavier side, one pixel a tick, up to 10 pixels either end. Each kit standing on it weighs as much as its distance from the middle; a Stopper weighs **three times** as much.
- **Fans** blow upward in a box. A kit that falls (or bounces down) into the breeze floats: it rises a pixel a tick to the top of the breeze and drifts the way it faces, then steps onto any roof it reaches. Floating resets the fall, so the landing is always soft.

## Jobs

Pick a job, then click (or tap near) a kit. Each level gives a few of some jobs; the job bar shows how many are left. Climber and Glider can be given at any time, even in mid-air, and stay with the kit. The others need the kit on the ground, and a kit doing one of them can be switched to another.

| Key | Job | What it does |
| --- | --- | --- |
| 1 | **Stopper** ✋ | Stands with paws out; walkers coming at it turn round. A Stopper stays put until you give it any other ground job (that sets it free), or the ground under it goes. |
| 2 | **Digger** 🕳️ | Digs straight down, a shaft 9 pixels wide, a pixel every 2 ticks, until it breaks through (and drops) or reaches stone or a belt (and shrugs and walks on). |
| 3 | **Tunneller** ⛏️ | Walks on until it reaches earth, then digs a kit-tall tunnel sideways, a pixel every 2 ticks, and walks on when the earth runs out. Stone, belts or hay pointing the other way stop it. |
| 4 | **Builder** 🌾 | Lays **12** hay bales, one every 8 ticks, each 8 pixels long, climbing 2 pixels for every 4 along (a stair 24 pixels high and 48 long). Bumping its head on a wall turns it round. Out of bales it shrugs, and you can give it another stair. |
| 5 | **Climber** 🧗 | Climbs any wall it walks into, a pixel every 2 ticks, and steps onto the top. An overhang sends it back down, facing away. |
| 6 | **Glider** 🪂 | After 12 pixels of falling, opens its fluffy tail and drifts down a pixel a tick, landing softly from any height. |
| 7 | **Bouncer** ☁️ | Takes 12 ticks to fluff up a springy dust puff where it stands. Every kit that steps or lands on the puff bounces: up at 5 pixels a tick and along at 1.5, pulled back down by 0.25 a tick, about 50 pixels high and 60 along on flat ground, turning back off walls. Wheee! A bounce only leaves a kit dizzy if it lands more than 56 pixels below where it took off. |
| 8 | **Hugger** 🤗 | Waits 30 ticks, then gives the ground such a big hug that a circle of earth **13 pixels** round clears away (not stone). A Stopper can be given a hug to set it free. |

## Levels

Every level has a target, a job budget and a gentle timer. When the timer runs out Mum calls everyone home and the level ends; it also ends as soon as nobody is left walking (only Stoppers), or when you choose **Finish here** in the pause menu.

**Stars:** one for bringing home at least the target, one for using no more jobs than par, and one for everyone you save being home by the par time. Clearing a level opens the next.

| # | Level | Home | Jobs | Par (jobs · time) | New things | Size (tiles) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Follow the Leader** | 6 of 10 | none | 0 · 35 s | – | 40×10 |
| 2 | **Dig In** | 8 of 10 | Digger 2 | 1 · 35 s | – | 40×13 |
| 3 | **Hay Stairs** | 8 of 10 | Builder 3 | 1 · 45 s | – | 40×10 |
| 4 | **Mind the Gap** | 8 of 10 | Builder 3 | 1 · 65 s | – | 40×10 |
| 5 | **Through the Hill** | 8 of 10 | Tunneller 2 | 1 · 40 s | – | 40×9 |
| 6 | **Only One Way** | 8 of 10 | Tunneller 3 | 1 · 40 s | one-way hay | 40×9 |
| 7 | **Down and Over** | 7 of 10 | Digger 2, Builder 2 | 2 · 65 s | – | 40×14 |
| 8 | **Meadow Parade** | 9 of 12 | Tunneller 2, Digger 2, Builder 2 | 3 · 75 s | one-way hay | 40×14 |
| 9 | **Hold the Line** | 8 of 10 | Stopper 2 | 1 · 35 s | – | 40×10 |
| 10 | **Up the Cupboard** | 4 of 6 | Climber 5 | 4 · 30 s | – | 40×11 |
| 11 | **Hay Belt** | 8 of 10 | Builder 2, Stopper 1 | 1 · 60 s | hay belt | 40×10 |
| 12 | **Turn and Climb** | 5 of 8 | Stopper 1, Climber 7 | 6 · 30 s | – | 40×11 |
| 13 | **Belt Express** | 8 of 10 | Stopper 1, Builder 2 | 2 · 25 s | hay belt | 40×10 |
| 14 | **Jam Jar Shelf** | 7 of 10 | Climber 10, Digger 1 | 8 · 35 s | – | 40×11 |
| 15 | **Two Stairs Up** | 8 of 10 | Builder 3, Stopper 1 | 2 · 70 s | – | 40×11 |
| 16 | **Pantry Parade** | 9 of 12 | Stopper 1, Builder 3, Climber 4 | 3 · 50 s | hay belt | 40×11 |
| 17 | **Soft Landing** | 6 of 8 | Glider 8 | 6 · 30 s | – | 40×17 |
| 18 | **Pebble Stone** | 8 of 10 | Digger 3 | 1 · 50 s | pebble stone | 40×13 |
| 19 | **A Big Hug** | 8 of 10 | Hugger 2 | 1 · 35 s | – | 40×9 |
| 20 | **Lily Ferry** | 8 of 10 | Hugger 2, Tunneller 1 | 1 · 75 s | pond, lily pad | 40×10 |
| 21 | **Hold On, Little Ones** | 10 of 12 | Builder 1, Stopper 1, Hugger 1 | 3 · 35 s | – | 40×9 |
| 22 | **Pond Hop** | 7 of 10 | Glider 10 | 7 · 55 s | pond, lily pad | 40×14 |
| 23 | **Cave Parade** | 8 of 12 | Digger 2, Glider 12, Hugger 2 | 10 · 45 s | – | 40×15 |
| 24 | **Springy Puff** | 8 of 10 | Bouncer 2 | 1 · 35 s | – | 40×11 |
| 25 | **Chimney Updraft** | 8 of 10 | Digger 2 | 1 · 35 s | fan | 40×13 |
| 26 | **Seesaw** | 8 of 10 | Stopper 1 | 1 · 30 s | seesaw | 40×12 |
| 27 | **Up and Away** | 7 of 10 | Bouncer 1, Glider 10 | 8 · 30 s | – | 40×15 |
| 28 | **Breezy Gap** | 8 of 10 | Hugger 1, Stopper 1, Bouncer 1 | 1 · 35 s | fan | 40×11 |
| 29 | **Tipping Point** | 7 of 10 | Stopper 1, Bouncer 1, Builder 1 | 2 · 30 s | seesaw | 40×12 |
| 30 | **Moonlit Parade** | 10 of 14 | Stopper 2, Hugger 1, Bouncer 2, Glider 4, Digger 1 | 3 · 55 s | seesaw, fan | 60×12 |

Levels 1 to 8 are **Clover Meadow** (digging, building, tunnelling, one-way hay), 9 to 16 **The Big Pantry** (stoppers, climbers, hay belts), 17 to 23 **Pebble Cave** (gliders, huggers, pebble stone, the pond and lily pads) and 24 to 30 **Moonlit Rooftops** (bouncers, fans and seesaws).

Every level stores a **solution**: a list of `{ t, k, job }` (on tick `t`, give kit number `k` this job). The par for each level comes from its solution: the same number of jobs, and its last kit's home time plus a quarter, rounded up to 5 seconds. Each level also lists its **key** jobs, the ones it can't be cleared without.

## Controls

- **Mouse:** click a job button (or press **1** to **8**), then click a kit. Hovering shows a dashed ring round the kit that would get the job, with the job's icon when it can take it.
- **Touch:** tap a job, then tap near a kit; the nearest kit that can take the job gets it. Drag to look around a level bigger than the screen.
- **Keys:** **Space**, **P** or **Esc** pause; **F** fast-forward (3×); **R** in the pause menu calls everyone home and starts again; arrow keys or **WASD** pan the view; **Enter** starts a level from its briefing and goes on to the next from the results.
- **Buttons:** pause, fast-forward, ↺ "call them all home" (restart), and sound on and off.
- The game pauses itself when the window loses focus.

## Saving

Progress is saved in `localStorage` under `kit-parade-v1`: the best stars, kits home, fewest jobs and quickest time for each level, the last level picked, and the sound switch. A save that is missing, broken or from another version starts fresh; each value is checked as it is read.

## Tests

- `tests/parade.mjs`: the map format and all thirty levels (sizes, one entrance and one home each, known characters, budgets, which jobs and terrain each world teaches), then every rule on small test maps: walking, steps, walls and edges; safe and dizzy falls and Mum; the home burrow; the job budget and who can take what; every job (stopper and setting it free, digger and stone, tunneller and one-way hay, builder and its stair and head bumps, climber and overhangs, glider, bouncer and its puff, hugger and its circle); water and lily pads; belts; fans; seesaws; the timer, finishing and stars; picking kits; exact replays; and saving.
- `tests/parade-bot.mjs`: the solver. It replays every level's stored solution and asserts three stars and an exact replay; asserts that doing nothing fails every level but the first (which clears by just watching); removes each key job in turn and asserts the level then fails; nudges every click in each solution a few ticks early or late over six seeds and asserts at least 85% still clear (162 of 180 at the time of writing); and asserts that random clicking with the same jobs rarely clears a level (at most a quarter; 15 of 116 now).
- `tests/e2e/parade.mjs` (browser, needs `npm run dev` and Playwright): the arcade card, the level list, watching level 1 home for three stars, clicking a kit to give it the Digger on level 2, pausing, results and the save, calling everyone home, the mute switch, the phone layout with no sideways scroll, dragging the camera on the wide finale, tapping near a kit, and no page errors.

```sh
npx tsc lib/parade-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck
node tests/parade.mjs
node tests/parade-bot.mjs
```

Written 28-10-2026.
