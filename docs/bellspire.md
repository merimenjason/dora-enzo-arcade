# The Sunken Bellspire (`/bellspire`)

A hi-bit pixel-art castle explorer with dynamic lighting. A citadel of bells sleeps under a high Andean lake. Dora
(cream-white fur, sword, jumps and dashes) and Enzo (grey fur, lantern staff, light and spells) row out to it and
explore it together, swapping the lead with a tag. It is an original world: the map, the guardians, the items, the
music and the interface are made for this game.

Code:
- `lib/bellspire-world.ts`: the data. The map (64 screens in 6 areas), abilities, spells, gear, food, the shop, the
  guardians, the murals and every line of dialogue.
- `lib/bellspire-physics.ts`: the body. Run, a jump with a cut, coyote time and a jump buffer, the dash, the Wind Leap,
  wall slides and kicks, ladders, one-way ledges, swimming, wading, the glide and the deep-water push.
- `lib/bellspire-game.ts`: the rules. Deterministic, a seeded generator, a fixed 60 ticks a second, no DOM. Rooms, doors,
  water, the lantern, combat, foes, guardians, XP, the wisp, menus, completion and the save.
- `lib/bellspire-nav.ts`: a route planner for the tests. It replays short input "moves" through the real physics to
  build a graph of where a hero can stand, swim or climb.
- `lib/bellspire-scene.ts`: Canvas 2D drawing at a view size the page picks (see **Screen fit**), with parallax,
  sprites, water, particles and the lighting.
- `lib/bellspire-art.ts`: the generated manifest of sprite sheets (cell size and frame count).
- `app/bellspire/page.tsx`: the screens, input (keyboard with remapping, gamepad, an on-screen pad), the loop, the HUD,
  the menus and saving.
- `app/bellspire/sound.ts`: Web Audio music (an Andean-flavoured chiptune loop per area) and effects.
- `app/bellspire/bellspire.css`: all classes prefixed `bs-`.
- `scripts/bellspire-art.py`: the pixel pass that turns the Codex paintings into the sheets in `public/art/bellspire/`.

## Controls

Arrows move, Z jump, X attack, C dash (Dora), V spell, Shift tag, ↑ use (shrines, Wayra, murals, Ukumari), Esc or P
the menu. Every key can be rebound in Settings. Down + Z drops through a ledge. As Enzo: tap V for the Lantern Bolt,
hold V and let go for the Ember Ring, ↓ + V raises or lowers the lantern, ↑ + V rings the Bell Chime. As Dora, V is the
Whirl Slash and ↓ + X in the air is a downward thrust. Gamepads: A jump, X attack, B dash, Y spell, bumpers tag, Start
menu. On touch screens an on-screen pad appears (Settings can force it on or off).

Anything that can't be done yet says why in a toast, such as a door that needs an ability, a spell not yet learned,
Enzo trying to dash, a knocked-out partner or a shrine that isn't lit.

## The map format

Each map cell is one screen of 30×17 tiles of 16 px. A room covers a rectangle of cells (`gx`, `gy`, `w`, `h`), and
its `rows` are strings at fixed world coordinates, so walking off one room's edge lands in the room next door. The
engine tests check that every row has the right width and every open edge leads into another room.

- Terrain: `#` stone, `=` one-way ledge, `H` ladder, `^` spikes, `g` ghost-glass (solid only in the raised lantern's
  light), `x` a cracked wall that breaks, `f` a float that rides the water.
- Doors: `d` Reed Dash, `j` Wind Leap, `k` Wall Kick, `l` lantern hatch, `c` bell-sealed (Bell Chime), `u` the throne
  door (opens once Ukumari has the bells), `b` a guardian's door (open until the fight starts, shut until it ends).
- Things: `@` the start, `S` candle shrine, `M` Wayra's stall, `R` mural, `C` chest, `A` ability pedestal, `B` water
  bell, `O` where the guardian stands, `U` Ukumari, `T` torch, `i` candle, `w` window (god rays), `h` hanging bell.
- Foes: `F` frog, `m` moth, `e` eel, `r` reed lurker, `K` condor, `I` imp, `a` shell, `z` vizcacha, `J` jelly, `G` golem.
- `water: [low, high]` gives the surface row for each level of the area's water (null for dry), and `deep` marks the
  row below which only the Deep-Dive Coat can dive. `dark: true` rooms need the lantern.

## Abilities, in the order the story gives them

| Ability | Hero | From | Opens |
|---|---|---|---|
| Reed Dash | Dora | pedestal in the cistern | blue `d` doors; the docks and the frog |
| Moonwick (lantern) | Enzo | the Grand Frog Idol | `l` hatches, dark rooms, ghost-glass |
| Wind Leap | Dora | pedestal on the stilts | `j` doors, high ledges; the hydra |
| Wall Kick | Dora | pedestal in the murals | `k` doors, the tower shafts |
| Bell Chime | Enzo | pedestal in the bell room | `c` doors, bells from afar; the warden |
| Lantern Glide | Enzo | the Bell Warden | long gaps |
| Deep-Dive Coat | both | a chest in the boathouse | deep water; the Sunken Throne |

The Reed Hydra gives the Ember Ring, the Puma of the Murals gives the Puma Tooth and a Moon Drop, and the other
guardians each give a Bell Heart (+6 max HP for both heroes). Moon Drops add 3 max MP.

## Water

Three areas (Flooded Halls, Reed Docks, Sunken Throne) each have a water level, high or low, changed by hitting a water
bell (or ringing it with the Bell Chime). The level animates at 1.2 px a tick, floats ride it, and the save keeps it.
The planner checks the map with every combination of levels, so no level traps the heroes.

## Screen fit

The page picks the internal view size to fill the screen with whole-number pixels: it aims for about 270 lines, takes
the nearest whole scale, and lets the width follow the screen's shape (320 to 520 pixels wide, 230 to 320 lines
tall). If no whole scale lands in that range it falls back to a fractional fit. At 1280×800 the view is 426×266 at 3×.
The camera is clamped to the room, and a room smaller than the view is centred with dark margins. On a phone held
sideways the pad floats over the picture, small and see-through; held upright the picture sits at the top and the pad
fills the space below. Dialogue moves to the top of the screen when the heroes stand low.

## Lighting

The scene draws the world at the view size, then multiplies it by a light map made at half size. Each light map
pixel starts at the area's ambient colour (darker in dark rooms, but never below a floor that keeps walls and ledges
faintly visible, and the edges of floors, ledges and walls get a faint line) and adds every light in range, falling off with the
square of the distance (the raised lantern falls off linearly, for a wide even pool). Values above full light pass
through a soft knee and feed an additive glow layer, so torches bloom without burning sprites to white. The light is
rounded to steps of 0.1, which gives hand-shaded bands. Under water, caustics add thin moving threads of light;
windows cast a cool moonlight shaft with drifting dust; water surfaces glow teal; a sword swing or a spin flashes the
nearby walls. Lights come from torches, candles, shrines, windows, pedestals, locked doors
(in their ability's colour), glowing foes, bolts, pulses, the heroes, the wisp and Enzo's lantern (46 px lowered, 118 px
raised). In a guardian fight the room behind the action dims and loses colour, the camera looks at the guardian
during its introduction and then keeps both it and the heroes in view, and the guardian gets a key light, a one-pixel
dark outline and a rim light in its own colour. Its wind-ups flash a bright warm white.

## Guardians

Each has a door that stays open until the heroes walk in, an introduction, a wind-up before
each attack and three phases by health. A wipe in a guardian's room restarts at its door with nothing lost. With
the helping hand on, guardians move at 80% speed with 25% longer warnings.

| Guardian | HP | Attack |
|---|---|---|
| The Grand Frog Idol | 220 | 8 |
| The Reed Hydra | 420 | 12 |
| The Puma of the Murals | 480 | 15 |
| The Bell Warden | 600 | 14 |
| The Lake Mother | 720 | 16 |

## Assist and Strict

The helping hand is on by default: 40% less damage taken, slower guardians with longer warnings, healing near shrines,
and a wisp that flies towards the doorway on the way to the next goal if the heroes stand still for six seconds (or
seem lost for 75 seconds). It follows a path through the room's open tiles, turning at corners, so it never passes
through stone; the path is through the air, not always one the heroes can walk. Strict turns the helping hand off and only allows shrine travel from a shrine.

Knocked out: the partner takes over. When both are down they wake at the last shrine and drop their coins in a bag
where they fell; walking back picks it up.

## Saves

`localStorage` key `bellspire-v1` (settings in `bellspire-v1-settings`). Resting at a candle shrine saves and heals. A
save is checked when loaded (version, shrine, abilities, gear worn, HP) and a bad one is ignored, not misread.

## Tuning and bots

`tests/bellspire-bot.mjs` plays each guardian with two human-paced bots that see the fight a quarter of a second late
and sometimes miss an input: "casual" (helping hand on) and "pro" (off), at the levels the route bot reaches on the
shortest way through. A route bot then plays the whole game from a new save with the planner, fighting what it meets.

Results on 07-11-2026 (24 seeds each, rerun after the polish round):

| Guardian | Casual | Pro |
|---|---|---|
| Frog | 24/24, 34 s, lowest HP 62% | 24/24, 29 s, lowest HP 28% |
| Hydra | 24/24, 57 s, lowest HP 93% | 24/24, 59 s, lowest HP 60% |
| Puma | 24/24, 40 s, lowest HP 62% | 24/24, 47 s, lowest HP 37% |
| Warden | 24/24, 72 s, lowest HP 54% | 23/24, 75 s, lowest HP 15% |
| Mother | 24/24, 75 s, lowest HP 83% | 24/24, 70 s, lowest HP 40% |

The route bot finishes seeds 1 to 3 in 13 to 14 minutes of game time, reaching level 9. A person exploring will take
much longer. The test requires casual wins in 85% of seeds and pro in 70%.

## Tests

- `tests/bellspire.mjs`: the map, the gates (each pedestal reachable with what comes before it, each area shut without
  its ability), no traps with four ability sets, physics, water, doors, the lantern and ghost-glass, combat, XP,
  tagging, knock-outs, shrines, travel, gear, the shop, food, a guardian from door to reward, the wisp, saves and
  determinism.
- `tests/bellspire-bot.mjs`: the guardian bots and the route bot (`--quick` for 8 seeds and one route).
- `tests/e2e/bellspire.mjs`: the browser suite. Every player action with the real keys, each locked action's message,
  the shrine, the shop, a mural, every menu tab, a key rebind, a water bell, a lantern hatch, a guardian, the ending,
  saves, and phones held both ways, with no page errors and no sideways scrolling.

Compile first: `npx tsc lib/bellspire-game.ts lib/bellspire-nav.ts --target es2022 --module es2022
--moduleResolution bundler --outDir .checks --skipLibCheck --strict`.

## Art

Every picture was painted with Codex on a flat magenta ground, then run through `scripts/bellspire-art.py`. The script
keys out the magenta, crops each figure, box-downscales it to its in-game height, cuts it to a small palette, cleans
stray pixels and adds a one-pixel ink outline, then packs the frames into strips. Enzo's fur gets an extra pass that
turns its lavender cast into cool grey, so the two heroes are told apart by fur: Dora cream-white, Enzo grey.

The heroes are 38 pixels tall in game (their hitbox stays 10 by 22). A colour pass maps Enzo's fur onto a mid-grey
ramp and his coat to rust, and Dora's fur onto a warm cream ramp and her coat to teal, and tones down pink ears. The
title, ending and epilogue paintings were repainted so the coats match, and are reduced with a refined palette so the
teal coat keeps its hue against the blue night. Guardian frames are cut out as whole figures (the biggest pieces on
the sheet, with loose bits joined to the figure they sit in), so no limb of a neighbouring frame leaks in.

The pause map marks the current room with a pulsing gold outline and a blinking head in the lead hero's fur colour,
and scrolls to centre on it when it opens on a small screen.
