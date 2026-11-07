# Overclock (`/overclock`)

A 16-bit run-and-gun platformer in a neon city. Lumen, the city's power AI, has gone dark and handed eight districts to
eight rogue machines. Dora (cream-white fur, the Arm Blaster, climbs walls) and Enzo (grey fur, the Charge Cannon,
wall-jumps and hovers) tag-swap through each district, reboot its machine and take its core. Every core gives each hero
a different power, and every reboot changes another district. It is an original world: the stages, the bosses, the
powers, the music and the interface are made for this game.

Code:
- `lib/overclock-world.ts`: the data. Every stage is built from small pieces (runs, gaps, climbs, shafts, bike runs,
  secrets, arenas) by a builder that also writes the route the bots follow and a detour for each capsule.
- `lib/overclock-game.ts`: the rules. Deterministic, a seeded generator, a fixed 60 ticks a second, no DOM. The heroes'
  bodies, the 18 powers, foes, bosses and their attack patterns, capsules, chips, the shop, gates and the save.
- `lib/overclock-anim.ts`: which frame of the hero sheets each state shows (every action has its own pose).
- `lib/overclock-boxes.ts`: generated per-frame hitboxes for foes and bosses, measured from the sprites' pixels.
- `lib/overclock-art.ts`: the generated manifest of sprite sheets (cell size, frame count) and which paintings exist.
- `lib/overclock-scene.ts`: Canvas 2D drawing at 384×216 (16 px tiles), parallax, sprites, rain, the dark, key prompts
  and the hitbox overlay.
- `app/overclock/page.tsx`: the screens (title, rooftop hub, stage, core-get, ending), input (keyboard with remapping,
  gamepad, an on-screen pad), the loop, the HUD, the pause menu and saving.
- `app/overclock/sound.ts`: Web Audio chiptune, one track per area plus the title, hub, boss, Lumen and ending, and every
  effect.
- `app/overclock/overclock.css`: all classes prefixed `oc-`.
- `scripts/overclock-art.py`: the pixel pass that turns the Codex paintings into the sheets in `public/art/overclock/`
  (magenta key, biggest piece, box downscale, a shared palette per set, an ink outline).

## Controls

Arrows move. Z, Space or K jump (hold for a higher jump), X or J shoot, C or L dash, Shift or Tab tag, V or I shield
(Enzo), Q and E switch power, Esc, P or Enter pause. Every key can be rebound in Settings; a gamepad works, and touch
screens get an on-screen pad (upright, the picture fills the width with the pad right under it and a hint to turn the phone; sideways, the pad floats faintly over the lower corners). Down + jump drops through a one-way ledge.

- **Dora**: rapid shots; hold toward a wall to climb it, jump off the top.
- **Enzo**: hold shoot to charge the cannon (two levels); slide down walls and jump off them; hold jump in the air to
  hover for 1 s; V raises a deflect shield for 0.3 s.
- **Tag**: the partner swaps in with a short swap-in attack. A knocked-out hero rests for 20 s, then comes back with a
  third of their health.
- Coyote time and the jump buffer are 6 frames each.

## Progress

- **The rooftop run** teaches every control with a key and one word placed low on the screen, away from the heroes,
  and ends with the Rooftop Sentinel.
- **The rooftop hub**: Stage select (the eight districts and the Sky Tower), Pip's shop, the capsule map, Settings, and
  the training room.
- **Eight districts and their machines** (boss: its weakness):
  Crane Port, Magnet Crab: Chain Spark (Storm Heron).
  Sign District, Neon Chameleon: Burrow Mine / Drill Dash (Subway Mole).
  Train Depot, Subway Mole: Magnet Pull / Plate (Magnet Crab).
  Light Arcade, Hologram Peacock: Sticky Glob / Ghost Step (Neon Chameleon).
  Rain Highway, Storm Heron: Scrap Toss / Quake Stomp (Scrapyard Rhino).
  Junk Compactor, Scrapyard Rhino: Orbital Strike / Moon Hop (Satellite Owl).
  Star Observatory, Satellite Owl: Firefly Swarm / Flare (Firefly Queen).
  Power Plant, Firefly Queen: Prism Laser / Decoy (Hologram Peacock).
  A weakness hit does 2.5 times the damage (at least 4) and stuns the boss, at most once every 4 s.
  Bosses stand two to three times a hero's height. Touching one between attacks does half its attack damage, a ground
  rush (charge, drill, scuttle, peck, roll) is low enough to clear with a full jump, and every boss is beatable with the
  starting kit, so any can go first. Each core the heroes already hold (up to six) makes the next boss 3% tougher and
  hit 5% harder, so the late picks still ask for some care.
- **Mini-bosses**: each district has one mid-stage, a big cousin of a local robot: Big Crane Claw (port), Billboard
  Gecko (signs), Rail Grub (depot), Holo Lantern (arcade), Toll Sentry (highway), Crusher Cube (scrap), Dish Turret
  (observatory), Lamp Bug (plant).
- **Reboots change other stages**: Crab lifts the Junk Compactor's scrap wall; Chameleon lights the Light Arcade's
  sign ledges; Mole reopens the train line under the Power Plant; Peacock lays hologram bridges in the observatory; Heron
  stops the rain (the highway's and the port's live puddles go safe); Rhino clears a Sign District alley; Owl powers the
  depot's lift ledges; Firefly lights the highway's high ledges. Each of these opens a capsule.
- **18 capsules**: 8 heart cells (+2 health each), 4 armour parts (helmet: shows secrets and marks capsules on the map;
  legs: an air-dash; body: half damage; arm: Enzo's full charge fires twice and Dora can have five shots out) and 6
  energy tanks (used from the pause menu). Two tanks sit in low tunnels at the waterline that only the hover-bike fits
  (hazard stripes and blinking arrows mark them; a jump inside just bumps the rider's head on the roof). The Power
  Plant tank needs the legs: from the tower, jump and air-dash near the top of the jump (Dora).
- **Pip's shop**: eight mod chips bought with bolts (Bolt Magnet 40, Long Hover 60, Swift Tag 60, Quick Charge 70,
  Rapid Fire 80, Tough Fur 90, Energy Saver 100, Second Wind 120); three can be slotted at once.
- **The Sky Tower** opens after all eight machines: the Antenna Spider, the Cable Serpent, then the Crown with a
  rematch gallery of all eight and Lumen in two forms. Beating Lumen plays the ending.

## Art

Every sprite, area and screen is painted (Codex) and then pixel-passed by `scripts/overclock-art.py` into
`public/art/overclock/`, which also writes `lib/overclock-art.ts` (strip sizes and the list of art present) and
`lib/overclock-boxes.ts` (per-frame hitboxes for the foes, bosses and mini-bosses). Each hero has a 32-frame strip from
four painted sheets, and every action has its own frame: idle (with a look-around), run, jump, fall, landing, dash,
wall cling and kick, hurt, knocked down, the victory pose, tagging in and out, riding the bike and its lift, and the shots
(standing, running, in the air, with a power); Dora also climbs, moon-hops and drill-dashes, and Enzo hovers, shields,
charges and quake-stomps. Ground bosses stand every frame on the floor. Banners and
tips fade right down while a hero or the boss is behind them, and the title and ending cards sit below the faces.

## Assist

Assist mode is on by default (Settings). On assist: heroes take 40% less damage, bosses move 15% slower and show their
tells 45% longer, a pit puts the hero back on the last ledge for 4 damage instead of knocking them out, extra assist
checkpoints appear, and the tanks refill whenever a stage starts. Off, a pit knocks out the lead and the partner takes
over; when both are out the stage restarts from its last checkpoint.

## Save

`localStorage` key `overclock-v1` (settings and key bindings under `overclock-v1-settings`): the intro, beaten bosses,
capsules, bolts, chips owned and slotted, tank charges, time and the ending. A corrupt or unknown save is ignored and a
new game starts.

## Tests

- `tests/overclock.mjs`: 30 engine tests. Saves, coyote time and the jump buffer, variable jump, dash and air-dash,
  climb, wall slide and kick, hover, drop-through, tag and rest, all 18 powers, the weakness loop and its damage, gates,
  assist against strict, capsules, chips, locks and tanks, every boss and Lumen's second form, hitboxes and their
  mirroring, the animation map (no two actions share a painted frame), no stand-in art (every area, boss, mini-boss, the water,
  the bike sky, the title, hub and ending have their own painting), the bike's tunnel bump, the air-dash window, named mini-bosses, determinism, no he/she in any player-facing string, and no names borrowed from other
  games.
- `tests/overclock-bot.mjs` (`--quick` for fewer seeds): a route bot finishes every stage; casual (slow reactions,
  misses) and pro bots fight every boss over many seeds with a save that has the cores from the stages before it, and
  must win within 3 attempts (casual at least 85% of seeds, pro at least 70%); they fight every district boss again
  with no cores and no capsules (casual at least 85%, pro at least 50%), since any boss can be picked first; a full-run
  bot plays from the rooftop to the ending, going back for every capsule once its gate is open, and must find all 18.
- `tests/e2e/overclock.mjs`: the browser suite. Every player action with the real keys (move, jump, shoot, dash, climb,
  tag, charge, hover, shield, wall-jump, drop-through, a pit, power switch and fire, the bike), the pause menu (a tank, a
  power, resume, back to the hub), the hub tabs (a chip bought, slotted and unslotted; a setting; a key rebind), training,
  two bosses and the core screen, Lumen and the ending, the save across a reload, a corrupt save, and the on-screen pad
  on phones sideways and upright; no sideways scrolling at 1280×800, 844×390 and 390×844 and no page errors.

Debug hook: `window.__overclock()` returns the screen, the save, the raw engine and helpers (`start(id)`, `hub()`,
`teleport`, `fight`, `invuln`, `setHp`, `bossHp`, `give`). The page marks `main[data-ready="true"]` once it hydrates.
Settings has a **Show hitboxes** switch that outlines every hitbox.
