# Burrow Clinic (`/clinic`)

A cosy hospital-management sim in a 1950s mid-century cartoon style. Dora and Enzo open clinics across the Andes for
their animal neighbours, who turn up with silly, harmless made-up ailments. You lay out rooms on an isometric floor,
hire chinchilla vets, nurses, cleaners and receptionists, keep the queues moving and meet each clinic's three goals to
open the next. It runs in real time with pause and 1×, 2× and 3× speed. It is assist-first: Dora's tips, "try here"
spots and hiring suggestions are on by default, and nothing is lost for good unless you switch on Strict.

Code:
- `lib/clinic-levels.ts`: the data (rooms, ailments, species, roles, traits, decorations, the six clinics and the Sandbox).
- `lib/clinic-path.ts`: A* over the tile grid with edge walls, and the path cache.
- `lib/clinic-game.ts`: the rules (deterministic, a seeded generator, a fixed 10 ticks a second, no DOM) and the save.
- `lib/clinic-scene.ts`: the Canvas 2D isometric floor.
- `app/clinic/page.tsx`: screens, input, the loop, saving and the HUD.
- `app/clinic/sound.ts`: Web Audio music and effects.
- `app/clinic/clinic.css`: all classes prefixed `hc-`.

## How a patient moves through the clinic

1. **Arrives** at the front door. The arrival rate depends on reputation and the clinic, and is slower on days 1 and 2.
   When the waiting room is packed (6 waiting plus 2 per treatment room), new patients come back another day, so a
   struggling clinic never drowns.
2. **Reception:** checks in with a receptionist.
3. **Check-up Room:** a vet works out what is wrong. Vets with more stars are quicker and more often right.
   Accuracy is 60% plus 8% a star, plus 10% for a Careful vet, up to 98%.
4. **Cure room** for the ailment they were told they have. A **wrong guess fails gently.** The machine does nothing,
   the patient looks puzzled, and they go back for a second check-up, which is always right. Nobody pays for a wrong
   cure.
5. **Cured:** a starburst, a cheer and a fee as they leave. The fee earns 10% more if they were still happy. A VIP condor
   tips three times the fee.

**Waiting:**
- Patients sit on benches when they can, and wait twice as patiently sitting down.
- They lose patience faster when thirsty, cold, near litter or far from cheer. Plants, cacti, lamps, rugs and magazine
  tables are cheer; a cheery staff member nearby, Dora and Enzo walking by.
- A thirsty patient fetches a free drink from a water cooler, or buys one (15 coins) from a drinks cart, and keeps
  their place in the queue.
- A patient who runs out of patience goes home unhappy, which costs reputation (2, or 4 for a VIP).

**Reputation:**
- Each cure raises reputation, more for a happier patient, with diminishing returns as it gets high.
- Inspectors, emergencies, unhappy patients and wrong cures nudge it up or down.

## Ailments and rooms

| Ailment | What you see | Cure room | Who runs it | Fee |
| --- | --- | --- | --- | --- |
| Static Fluff | sparks crackle round the fur | Fluff-Dryer | vet | 90 |
| Echo Hiccups | bubbles float up | Hiccup Jar | vet | 110 |
| Upside-Down Ears | an ear badge | Ear-Flipper | vet | 120 |
| Snowball Sneezes | little snowflakes | Steam Booth | vet | 125 |
| Dust-Bath Fever | dust puffs at their feet | Dust-Bath Ward (beds) | nurse | 150 |
| Tangle Tail | a knot badge | Comb Station | nurse | 130 |
| Glow Whiskers | a soft glow | Dark Room | vet | 140 |
| Puff-Up | drawn a third wider | Deflating Hammock (beds) | nurse | 160 |
| Sleepy Spots | purple spots | Bright Lamp Room | vet | 145 |

**Every clinic also has:**
- a **Reception** (a receptionist at the desk);
- a **Check-up Room** (a vet);
- a **Staff Room**, where tired staff rest with a cuppa.

**Room sizes and cost:**
- Every room is at least 3×3, except the wards (4×3), and at most 8 tiles on a side.
- A bigger room costs 15 coins more per extra tile.
- A ward has one bed for every four floor tiles, up to four, and its nurse looks after every bed at once.

## Staff

- **Hiring:**
  - Hire from a short list of three candidates per role, refreshed every evening.
  - Each candidate has 1–5 stars, a wage and a trait:

    | Trait | Effect |
    |---|---|
    | Quick | works a quarter faster |
    | Careful | fewer wrong guesses, machines wear more slowly |
    | Cheery | patients nearby stay patient longer |
    | Sleepy | needs more breaks, but asks for less |

  - Hiring costs a day's wage up front. After that, wages are paid every evening at 20:00.
- **Rest:**
  - Staff tire as they work, and tired staff work slower: 25% slower below 30 energy, half speed below 10.
  - Below 28 energy, staff go to the Staff Room when they have a moment, then go back to their room.
- **Cleaners** roam the clinic. They fix worn machines, sweep litter and water plants.
- **Moving staff:** drag a staff member (or use **Pick up** on their card and tap) into a room to keep them there.
  - Drop them in the corridor to let them go wherever they are needed.
  - Drop them in the Staff Room to send them to rest.
  - A drop into the wrong kind of room is refused with a reason, for example "A Hiccup Jar needs a vet, and Ana is a
    receptionist".
- **Firing** asks once to confirm, and the staff member walks home.

## Machines

- Every treatment wears a machine a little; Hot Springs wears them twice as fast.
- A worn machine (75+) shows a spanner badge.
- At 100 it simply stops, greyed out, until a cleaner fixes it. Nothing explodes and nobody is hurt.
- The "breakdown" event stops one machine at once.

## Building

- **Build cards:** **Build** (B) opens the room cards, and **Decor** opens the decoration cards. A locked card says
  where it unlocks, for example "Opens at Lakeside".
- **The ghost:**
  - Picking a card shows a ghost room at a suggested spot ("Try here!", from the assist).
  - Drag on the floor to draw a room rectangle, drag the ghost to move it, or tap to move it there.
  - **Another spot** jumps to the next suggestion.
  - **Rotate** (R) turns the room and moves its door side.
  - **✓** places it (also Enter); **✕**, right-click or Escape cancels.
- **When it doesn't fit:** the ghost is green where it fits and red where it doesn't, and the bar above the cards says
  why. The reasons are:
  - too small or too big;
  - outside the walls;
  - overlapping a room or a decoration;
  - blocking the front door;
  - a door that would open into a wall;
  - not enough coins;
  - shutting another room off from the corridor.
- **Doors:**
  - Doors go automatically on the edge nearest the corridor.
  - **Move door** on a room's card steps the door round to the next spot that works.
- **Selling:** a room or decoration sells back for half its price.
- **Paths:**
  - Patients and staff path-find with A* over the tile grid. Walls sit on tile edges and a room is entered only
    through its door.
  - Paths are cached and the cache is cleared whenever the layout changes.

## Events

- **Emergency:**
  - "4 flamingos with Snowball Sneezes need help. Cure them all within N hours for a bonus."
  - The card pauses the clock. **Yes, send them** or **Not today** (which costs nothing). Unanswered offers go
    elsewhere after two hours.
  - Emergency patients skip the desk and the check-up.
  - Curing them all in time pays the bonus and +5 reputation; missing the deadline costs 1.
- **Inspector** (the owl): visits up to four rooms. Clean floors, working machines, watered plants and smiling
  patients earn +200 coins and +4 reputation; otherwise −2, with the reasons named.
- **VIP condor:** a happy cure means a triple-fee tip.
- **Breakdown:** one machine stops until a cleaner fixes it.

## The campaign

| # | Clinic | Twist | New | Goals (cures / reputation / coins) | Days (2★ by) |
| --- | --- | --- | --- | --- | --- |
| 1 | Burrow Clinic | Tutorial: Enzo's six steps; patients only come once you are ready | Fluff-Dryer, Hiccup Jar | 70 / 65% / 4,500 | 7 (5) |
| 2 | Salt Flat | Thirst builds twice as fast; drinks carts earn coins | Ear-Flipper, Drinks Cart | 100 / 70% / 6,500 | 8 (6) |
| 3 | Lakeside | Rainy spells keep patients away, then they all come at once | Steam Booth, Dust-Bath Ward | 120 / 70% / 9,000 | 9 (6) |
| 4 | Cloud Forest | Plants dry out three times as fast but cheer twice as much | Comb Station, Dark Room | 160 / 72% / 13,000 | 10 (7) |
| 5 | Hot Springs | Machines overheat: twice the wear | Deflating Hammock | 170 / 70% / 13,000 | 10 (7) |
| 6 | Summit | Cold: patients far from a heater lose patience faster | Bright Lamp Room, Heater | 180 / 60% / 11,000 | 11 (8) |

- **Stars:** one for meeting every goal, a second for meeting them by the fast day, and a third for doing it with the
  clinic's high reputation (70–75%).
- **Day limits:** the day limit is soft. Past it you can keep playing, but only one star is possible. **Strict** in
  Settings turns the limit into a real end.
- **Unlocks:** meeting a clinic's goals opens the next. The **Sandbox** (every room and ailment, 50,000 coins, no goals)
  opens after Salt Flat, or straight away with the Sandbox setting.

## Tutorial (Burrow Clinic)

Enzo's notes sit in the dock beside the floor, and each step highlights the button to press next:

1. build a Reception;
2. hire a receptionist;
3. build a Check-up Room;
4. hire a vet;
5. build a Fluff-Dryer, which opens the doors and lets in the first patient, a pudú;
6. watch them get cured.

Before step 5 the clock does not run and nobody arrives, so nothing in the first clinic can be lost by being slow.

## Controls

| Action | Mouse and keys | Touch |
| --- | --- | --- |
| Select (info card) | click | tap |
| Pan | drag | one-finger drag (two fingers in build mode) |
| Zoom | wheel | pinch |
| Draw or move a room | drag on the floor or the ghost in build mode | the same |
| Pick up staff | drag them, or Pick up on their card | the same |
| Rotate the ghost | R or the rotate button | the rotate button |
| Place | Enter or ✓ | ✓ |
| Cancel | right-click or Escape | ✕ |
| Pause | Space or the pause button | the pause button |
| Speed | 1, 2, 3 | 1×, 2×, 3× |
| Build cards | B | Build |

**Layout:**
- **Wide screens:** the toolbar is on the left and the dock of cards on the right.
- **Phones held sideways (the main phone layout):** the same, slimmer.
- **Phones held upright:** the top bar wraps to two rows, the dock slides up under the floor and the toolbar sits at the
  bottom.
- Panels never sit over the floor.

## The assist ("Helping hand", on by default)

- **Dora's tips:** the most useful nudge right now, each with a **Show me** button that opens the right card. For
  example: hire for an unstaffed room, a second Check-up Room for a long line, a staff room for tired staff, a cleaner
  for a worn machine, drinks on the salt, heaters on the summit, benches for a standing queue.
- **"Try here" ghost spots** that never cut a corridor in two.
- **A suggested candidate** in the hire list.
- **A gentle warning** before the evening's wages would leave you short.
- The doors open automatically once a reception, a check-up room and a cure room are all staffed.

## Saving

- **Where:** `localStorage` under `burrow-clinic-v1`.
- **What it holds:**
  - stars and best days per clinic;
  - the clinic in play (its full state);
  - the settings: sound, music, speed, helping hand, strict, motion and Sandbox.
- **When:**
  - at the start of every in-game day;
  - after building, hiring or selling;
  - on reaching the goals;
  - when you leave: to the map, a hidden tab or closing the page.
- **Errors:** a corrupt save, or one from another version, starts fresh. A corrupt clinic in an otherwise good save is
  dropped and the campaign progress kept.

## Tests

- **`tests/clinic.mjs`:** the rules. It covers:
  - arrivals, queues, diagnosis (right and wrong) and cures;
  - money, wages and selling;
  - room fit rules and their reasons, doors, and path-finding around rooms with the cache;
  - fatigue and the staff room;
  - wear, breakdowns and repair;
  - mood, patience, thirst, benches and plants;
  - dropping staff into rooms;
  - emergencies, the inspector and the VIP;
  - goals, stars and the soft and strict limits;
  - the tutorial and the assist;
  - determinism;
  - the save round-trip and corrupt saves.
- **`tests/clinic-bot.mjs`:** plays every clinic headless with three managers (`--quick` for 12 seeds, the default 40):
  - **casual:** builds the tutorial's rooms in a sensible but imperfect layout, hires average staff, reacts to Dora's
    tips 20–40 in-game minutes late and takes half the emergencies;
  - **pro:** plans ahead within its budget;
  - **idle:** builds nothing.
- **`tests/e2e/clinic.mjs`:** every player action in a real browser, on desktop and both phone layouts.

**Balance targets:**
- casual meets clinic 1 in at least 90% of seeds, clinic 2 in at least 80% and each later clinic in at least 60%;
- pro meets every clinic in at least 95%, with three stars on clinic 1 in at least 70%;
- idle never meets clinic 1.

The latest full run (40 seeds a clinic, 06-11-2026); the idle manager met none:

| Clinic | Casual met | Casual 3★ | Casual day | Pro met | Pro 3★ | Pro day |
| --- | --- | --- | --- | --- | --- | --- |
| Burrow Clinic | 100% | 95% | 4.6 of 7 | 100% | 100% | 4.6 |
| Salt Flat | 100% | 100% | 5.3 of 8 | 100% | 100% | 5.1 |
| Lakeside | 100% | 100% | 5.4 of 9 | 100% | 100% | 5.1 |
| Cloud Forest | 100% | 98% | 6.5 of 10 | 100% | 95% | 6.5 |
| Hot Springs | 95% | 65% | 7.1 of 10 | 100% | 83% | 6.8 |
| Summit | 95% | 55% | 7.7 of 11 | 100% | 98% | 7.2 |

## Art

- **Source:** every picture is Codex-painted in the mid-century cartoon style (mustard, teal, coral, mint and cream,
  warm ink outlines). Character sheets are painted on flat magenta, or green for the flamingo, and keyed, trimmed and
  packed by `scripts/clinic-art.py` into `public/art/clinic/` (webp, about 3 MB).
- **Characters:**
  - 8-frame strips for the 7 patient species, the condor VIP, the owl inspector, Dora, Enzo and the 8 staff looks;
  - frames: walk towards and away, then the poses; the scene mirrors them for the other two facings;
  - Dora (cream-white, a white vet coat) and Enzo (grey, teal scrubs) wear no signature accessories here.
- **Things on the floor:** 16 machines, 10 decorations, 32 icons, litter and effect pieces, and 12 seamless floor and
  wall textures.
- **Paintings:** the title, the map, the goals-met vignette and six backdrops.
