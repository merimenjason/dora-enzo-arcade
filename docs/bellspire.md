# The Sunken Bellspire (`/bellspire`)

A hi-bit pixel-art castle explorer with dynamic lighting. A citadel of bells sleeps under a high Andean lake. Dora
(cream-white fur, sword, jumps and dashes) and Enzo (grey fur, lantern staff, light and spells) row out to it and
explore it together, swapping the lead with a tag. It is an original world: the map, the guardians, the items, the
music and the interface are made for this game.

Code:
- `lib/bellspire-world.ts`: the data. The map (94 screens in 8 areas: the citadel's 64 and the Windward Belfry's 30),
  abilities, spells, gear, food, the shop, the guardians, the murals and every line of dialogue.
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

The Windward Belfry adds: ↑ by Wayra's boat rows across the lake (after the Lake Mother). With the Bell Rope and the
helping hand on (the default), jumping or falling within about 6 tiles of a bell hook catches it by itself (X still
throws it too) and Dora swings a steady arc; a dotted arc shows where Z will take her, ← or → picks the way (or the way
she faces), Z at any moment flies her there, and ↓ takes her back to the ledge she swung from. In Strict (or with the
helping hand off), X in the air beside a bell hook throws the rope; ← and → pump the swing, Z lets go with a kick
upward, and ↓ drops off. Shift on the rope says Dora's on the rope instead of tagging. X, a Lantern Bolt, the Bell Chime or the Gale Wave rings a wind bell and turns the wind round. As Enzo with
the Echo Step, ↑ + V beside an echo bell lays three notes to stand on; a tap of V in the air is the Frost Fan, and V
held past the Ember Ring (about 1.2 seconds) is the Gale Wave.

Ladders: ↑ grabs one you stand at or beside (within about 6 pixels of it), and holding ↑ while jumping into one grabs
it in mid-air. Hold ↑ to climb all the way up: at the top the hero pulls up and stands on the ladder's top, and stays
there however long ↑ is held. ↓ on a ladder top climbs back down, Z jumps off part way, and ← or → at the top walks off
along the ledge. The partner follows the same path up and down.

At a candle shrine, ↑ rests (heals both heroes and saves) and X opens travel: the map opens on this shrine, ← and →
step through the lit shrines, Z or X travels, and a tap on a lit candle works too; Esc cancels. X only opens travel
when the lead is on the ground at the shrine with no awake foe within about 80 pixels and no guardian fight, so a fight
at a shrine still swings. A small prompt over the candle shows the player's own keys ("↑ Rest · X Travel", with "Hit"
on the touch pad, or "↑ Rest to light" at an unlit one).

Anything that can't be done yet says why in a toast, such as a door that needs an ability, a spell not yet learned,
Enzo trying to dash, a knocked-out partner or a shrine that isn't lit.

## The map format

Each map cell is one screen of 30×17 tiles of 16 px. A room covers a rectangle of cells (`gx`, `gy`, `w`, `h`), and
its `rows` are strings at fixed world coordinates, so walking off one room's edge lands in the room next door. The
engine tests check that every row has the right width and every open edge leads into another room.

- Terrain: `#` stone, `=` one-way ledge, `H` ladder, `^` spikes, `g` ghost-glass (solid only in the raised lantern's
  light), `x` a cracked wall that breaks, `f` a float that rides the water.
- Doors: `d` Reed Dash, `j` Wind Leap, `k` Wall Kick, `l` lantern hatch, `c` bell-sealed (Bell Chime), `u` the throne
  door (four bell seals: opens once all four area guardians are calm and Ukumari has the bells), `b` a guardian's door (open until the fight starts, shut until it ends).
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

The hydra and the puma open no ability door, but the throne still needs them: the throne door (`u`) is held by four bell
seals, one per area guardian (the frog, the hydra, the puma and the warden), drawn on the door in each area's colour.
Each seal lights when its guardian is calmed, with a chime and a toast ("The Reed Docks bell is quiet. 3 of 4 seals
open."). Until all four are lit, Ukumari names the guardians still restless and where they are, the door's hint lists
them, and the throne stays shut. Once all four are calm, Ukumari opens it as before. The maps show the seals by the door
and a red mark on each restless guardian. With every ability owned and seals still shut, the wisp leads to the nearest
restless guardian. The planner gates the throne on all four guardians too, and every guardian can be reached before the
throne opens. An old save where Ukumari had already opened the door with a guardian skipped is locked again on load,
unless its ending has been seen or the Lake Mother is already calm.

After the Lake Mother, the ending shows the epilogue straight away if everything has been found (100%). Otherwise it
says the epilogue plays the moment the last thing is found, and Keep exploring goes back in. The moment completion
reaches 100% (checked every quarter second), Dora and Enzo say a line and the ending plays again with the epilogue,
saved first and only once (the `epilogue` flag). The title screen then offers See the epilogue. After the Lake Mother
the wisp rests, the throne stays open, and her arena stays quiet.

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
raised). In the Windward Belfry, an echo bell gives off a faint cyan shimmer (44 px) that swells (96 px, pulsing) while
its notes hang in the air, each echo note glows cyan as it appears and dims and flickers through its last second, and a
wind bell catches a little cool light that flares when it is rung. In a guardian fight the room behind the action dims and loses colour, the camera looks at the guardian
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
| The Hail Condor | 1000 | 20 |
| The Twin Clappers (two of 410) | 820 | 17 |
| The Out-of-Tune Bell | 1300 | 24 |

## The Windward Belfry

The expansion, reached once the Lake Mother is calm. Finished saves are told about it with a toast when they load,
and Wayra mentions it at the next shrine rest. ↑ by Wayra's boat at the Lakebed Landing rows to the Cliffoot Candle
at the foot of the Cloudstair (and back). Before the Lake Mother, Wayra says the lake is too rough.

- **Areas.** The Cloudstair (terraced cliffs, bell posts, banners, wind) and the Belfry Loft (beams, cogs, louvres,
  swinging bells), 13 rooms and 27 screens, each with its own tile set, decor, backdrop, middle layer, light and tune.
  Three more rope rooms open off the citadel (the gallery, the chapel's shrine and the landing) behind rope-knot doors.
  The map widens to take the belfry in once the heroes have crossed the water. Two new shrines (Cliffoot and
  Bannerwalk Candles, plus the Loft Candle) join shrine travel.
- **Wind.** Gust zones push a hero in the air hard and a running hero a little; a hero standing still braces and holds.
  The Lantern Glide rises in a gust. Wind bells (one each side of every gap that needs the wind) turn an area's wind
  round, and the wind is saved per area like the water. The Windward Jacket and the Highland Cloak halve the push.
- **The Bell Rope** (Dora, from a pedestal in the ropehall). Rope-knot doors (the knot sigil) need it. Enzo can't hold
  it, so Shift on the rope (or flying off it) says "Dora’s on the rope. Tag once she’s on her feet." There are two ways
  to swing:
  - **Guided, with the helping hand** (the default; `ropeAssist` in the physics). In the air within 96 px (6 tiles) of
    a hook above her hands, it catches itself (X still throws it, even at the hook just let go of). On the way, the
    hook glows: bright, with a faint dashed rope from her hand, when her fall as it is going will bring her into reach
    in the next half second; faint when it's near but she needs more height or to get closer. Caught, the rope reels
    to 56 px and she swings a steady arc of 1 radian each way by herself: no pumping, and the wind doesn't push her
    (it still does in the air). A dotted arc shows where a jump goes, the way held (← or →) or else the way she faces:
    the next hook that way (within 15 tiles across, 7 up and 10 down), or the nearest safe ledge that way (a floor or
    one-way ledge with room to stand and no spikes on it or beside it; a ledge well below the swing counts for much
    less, so the floor under a rope is the last choice). Only targets the whole flight can reach without touching a
    wall or a hazard are offered, and only in the hook's own room. Z at any point of the swing flies her there along
    an eased arc (20 to 56 ticks): a hook catches her (so a row of hooks is hold →, tap Z, tap Z), a ledge sets her
    down standing. With nowhere to go, Z lets go as in Strict. ↓ (after a few ticks) or a hit while she swings flies
    her back to where her feet last stood (the hit's damage still counts, the spikes' doesn't); with no way back, ↓
    just drops. The hook she leaves won't catch her again until she lands. Standing under a hook never catches.
  - **Free, in Strict** (or with the helping hand off). In the air within about 4 tiles of a bell hook, X throws the
    rope instead of swinging the sword. The swing is a pendulum (gravity over the rope's length, pumped with ← and →,
    nudged by the wind); a jump lets go with the swing's speed and a kick up, and ↓ drops off. This is the swing as it
    was before the helping hand's version, unchanged.
- **The Echo Step** (Enzo, from the Hail Condor). ↑ + V beside an echo bell sounds it: three translucent cyan notes
  appear along that bell's own shape, a fifth of a second apart, and last 4 seconds (8 with the Carillon Staff). They
  are one-way ledges. Note-sigil doors need it. Without it, a bell only hums.
- **Swinging bells.** Giant bells in the bell shaft swing on long ropes; their headstocks carry a hero along the arc.
  They are shortcuts only: no gate depends on their timing.
- **Gates.** The rope-knot door `y`, the note-sigil door `n`, and the belfry seal `Z`, which opens once the Hail Condor
  and the Twin Clappers are both calm (its two bell seals light up as they are).
- **Guardians.** (A guardian's fight starts only once the heroes are inside, and never while a hero is still
  climbing up under a boss door that would shut over them: the condor bridge's hatch from the bannerwalk.) The Hail
  Condor on the condor bridge rains hail, dives at an aimed spot and rests on the bridge after,
  and from phase 2 gusts, then in phase 3 brings a storm and breaks bridge planks (which mend). The Twin Clappers hang
  side by side: the Iron Clapper only takes Dora's blows and the Glass Clapper only Enzo's (if one of them is knocked
  out, the other can finish it, so the fight never stalls). They swing, slam and clap together, and in phase 3 throw
  shards and cogs. The Out-of-Tune Bell tolls a ring of sound (from phase 2 with waves along the floor), swings over a
  hero who stays low, retunes the room (the wind turns, notes appear to climb, and it rises out of reach without them)
  and in phase 3 rains sour notes. Calming it plays the belfry's ending page.
- **Rewards.** The Echo Step and the Frost Fan (Hail Condor), the Gale Wave and a Moon Drop (Twin Clappers). Chests hold
  the Windward Jacket and the Highland Cloak (painted outfits, each its own sprite strip with a part map), the Condor
  Talon (Dora) and the Carillon Staff (Enzo), two Bell Hearts and more. Eight more murals, for 18.
- **Completion.** The totals now include the belfry (94 rooms, 27 chests, 5 pedestals, 18 murals, 8 guardians). The
  citadel's own 100% still plays the first epilogue (the `epilogue` flag is kept); everything at 100% after the
  Out-of-Tune Bell plays the second (`epilogue2`, with its own painting); when both are earned at once, the second
  stands for both and the first never plays after it. The pause map shows the citadel's numbers until the heroes cross
  the water, then everything. The wisp stays on after the citadel's ending (a save loaded from the title keeps the
  ending flag) and leads to Wayra's boat and up the mountain; it goes out once the Bell is calm.

## Echo Trials

Once the Out-of-Tune Bell is calm, resting at a shrine plays a short scene (Enzo, then Dora) and the **Trials** page in
the pause menu opens. A trial starts from any lit candle shrine (standing or swimming by it, not on a ladder). Before
the Bell, the page says "Calm the Out-of-Tune Bell to open the Echo Trials."; away from a shrine it says to stand at
one; a run whose start shrine is still dark says "Light the X first".

- **Guardian Rush.** All eight guardians in story order (frog, hydra, puma, warden, mother, condor, clappers, Bell). The
  clock starts at once. Between guardians each hero gets back half their max HP and MP (`RUSH_HEAL = 0.5`, a knocked-out hero gets up) and a
  short breath. No XP, coins or drops, no endings.
- **Area runs.** One per area: the heroes are moved to the area's shrine and touch its trial bells in order (a post
  with a swinging bell, lit, numbered; later ones dim). The clock starts on the first move.

| Trial | Start | Bells | Gold / silver / bronze |
|---|---|---|---|
| Guardian Rush | the shrine you stand at | 8 guardians | 5:20 / 6:20 / 8:40 |
| Landing Dash | Landing | rope cellar, well | 0:18 / 0:24 / 0:36 |
| Flooded Halls Run | Chapel | sink, gate | 0:58 / 1:18 / 1:56 |
| Reed Docks Run | Reed Mill | boathouse, dock gate, jetty | 0:32 / 0:42 / 1:03 |
| Bell Towers Run | Bell Loft | shaft, roost, attic | 0:51 / 1:08 / 1:42 |
| Crypt Murals Run | Mural Crypt | vault, stair | 0:29 / 0:39 / 0:58 |
| Sunken Throne Run | Pearl Throne | garden, throne gate | 1:08 / 1:30 / 2:15 |
| Cloudstair Run | Cliff foot (wind up the stair) | windgate, cairns, bannerwalk | 1:33 / 2:04 / 3:06 |
| Belfry Loft Run | Loft base | bell shaft, cogworks, belfry top | 0:52 / 1:09 / 1:43 |

A trial runs on a copy of the save: water reset to a new game's, the wind set for the run, food set to 2 cakes and 1
tea, and travel shut. When it ends (all done, given up from the Trials page, or both heroes knocked out) the save comes
back as it was, plus the best time and medal (`save.medals[id]`). The result card shows the medal, the time, "New
best!", the thresholds, and Try again / Close.

Medal tuning: gold for a run is set about 15 to 25% above the planner bot's line (the bot runs at 15 to 78 s; gold
must stay at or above the bot's best and within 1.35× of it). For the rush, the casual bot (helping hand on, human
delay) finishes 16 of 16 seeds in 307 to 420 s (median 366 s): 4 gold, 7 silver, 5 bronze; pro (helping hand off) finishes 12 of 16, all bronze. Gold is for a player who
fights clean.

## New Game+

When the Bell is calm, the title offers **New Game+**. It starts a second save under its own key
(`bellspire-v1-ngp`), so the first game stays. The heroes keep their levels and XP, gear, worn gear, spells (not the
Bell Chime, which is an ability) and medals; abilities wait on their pedestals again, and hearts, coins, food, flags and
time start fresh. The intro opens with a line saying so. Finishing NG+ and starting again gives NG+ 2, and so on.

Each guardian has `NGP_HP = 1.4` times its HP and hits for at least `NGP_HIT = 18` (so carried-over levels don't make
it trivial), and gains one new attack with its own wind-up and animation, in every phase:

- **Grand Frog Idol, Flop:** squats, leaps out of sight, a shadow on the floor tracks the lead and then stops, and it
  lands there with a splash wave.
- **Reed Hydra, Seed Rain:** heads rear back and spit; sprouts mark where seeds will fall, with a two-slot gap to
  stand in.
- **Puma of the Murals, Painted Twin:** a purple painted twin peels from the far wall and charges a moment after the
  puma, from the other side.
- **Bell Warden, Chorus:** two of its small bells shake, then drop on marked spots in turn, each ringing out a ring.
- **Lake Mother, Spouts:** whirlpools open at three spots from the lead outward, then water columns rise one after
  another.
- The belfry's three already had New Game+ attacks from the Windward Belfry round, now tested here: the Hail Condor's
  marked row of icicles, the Twin Clappers slamming both at once, and the Out-of-Tune Bell's crack (a spiral of sour
  notes).

The title lists both saves ("Your game" and "New Game+ n") with Continue and Continue New Game+; starting NG+ again
over an NG+ save asks first ("Yes, start New Game+" / "Keep it").

## Shrine travel

Each shrine has a name: Landing Candle, Chapel Candle, Reed Mill Candle, Bell Loft Candle, Mural Crypt Candle and
Pearl Throne Candle. Resting at one lights it, and the shrine the heroes last woke at stays lit. When a second shrine
is lit, a tip says "Shrines are linked: ↑ to rest, X to travel." On the map, lit shrines are big glowing candles and
unlit ones you have seen are grey ("Rest here once to light it"); the one you stand at says "You are here". With only
one lit, the map says "Light another shrine to travel". With the helping hand on, the map can travel from anywhere
except a guardian fight (Esc, then tap a candle or use the list); Strict only travels from a shrine. Travel never
heals: only resting does. A journey takes about a second: both heroes kneel, candlelight swirls up as they fade, and
they fade in at the far candle with a flare and a chime. The controls are locked only for that second, and with
reduced motion they arrive at once.

## Animation

Every state a hero can be in has its own painted frames, picked by a small state machine in `lib/bellspire-anim.ts` that the scene runs
each frame (the engine knows nothing of it, so play stays deterministic, and no animation delays a control):
breathing, a blink and after about five seconds a fidget; a start-up, a six-frame run, a skid with dust and a turn;
rise, apex, fall, a landing squash and a crouch after a long fall; a four-frame back-view ladder climb that advances by
distance climbed (holding still holds the frame), with climb-on and pull-up frames; Dora's wall slide and kick, the
dash with afterimages, Enzo's glide; three combo cuts with wind-up and follow-through, the down-thrust and whirl;
Enzo's cast wind-up and release, lantern raise and lower and the chime; hurt, knocked out and revive; the tag hop-back
and leap-in; wading, a four-stroke swim, dive and surface; kneeling at shrines, a back view at murals, lifting a lid,
raising a relic, striking a bell (Dora raps it with her sword's pommel, Enzo with the lantern end of his staff) and
paying Wayra. Enzo's three staff swings are an overhead strike, a low sweep and an upward lantern swing; Dora's Whirl
Slash is a crouched wind-up and a spin seen from the front and from behind; wading on the spot balances knee-deep and
treading water is upright, apart from the swim stroke. States a hero is never in have no frames for that hero (Enzo
can't dash, wall-kick, thrust or whirl; Dora doesn't glide, cast Enzo's spells or carry the lantern). The tests check
that no two states share a frame, save one: a hard landing recovers through the ordinary landing frame. Tails, coats and ears sway and bounce in code with squash and stretch.

The Windward Belfry adds sheet k (frames 80 to 87) to each hero: Dora's rope throw, three swing frames picked by the
rope's angle, the release kick and a shield guard (and the guided rope's flight: the release kick for 12 ticks, then
`ropeFly`, spare take 78 from sheet j, a forward reach shown nowhere else, until she lands, always a clean landing); Enzo's echo-bell strike, the Frost Fan's wind-up and release, the
Gale Wave's wind-up and release and a hop onto a note; and for both a brace into the wind and a balance on a swinging
bell. The two outfits are whole painted strips of their own (`dora-windward`, `enzo-highland`), not tints.

Foes have two idle frames, four moving, a wind-up and an attack, a squash when hit and a puff when calmed. Guardians
have extra tell and attack frames, a stagger and a calm pose. In the world, bells and chains swing when hit or passed,
reeds and banners sway, torches and candles flicker, water ripples and pours while it rises, doors glow and slide open,
cracked walls crumble, ghost-glass shimmers, chests open, and pickups bob and turn.

## Hitboxes

Each foe's hurtbox is 90% of the painted bounds of the frame it is showing (worked out by the art script and stored in
`BOXES`), centred on the art; the box that hurts the heroes on touch is 72%. Guardians' boxes come from their painted
frames the same way. `?hitboxes=1` or `__bellspire().debug(true)` draws them: green hurtbox, red harm, cyan the heroes,
yellow the sword. Before this, a moth's box covered 8% of its picture and sat 11 pixels off; now every kind covers 81%
and is centred.

## Damage numbers and the minimap

Hits pop numbers in the pixel font, outlined and stacked so they never sit on a face: white for a hit, gold and bigger
for a finisher, blue for spells, red for the heroes' hurts, green for heals, and "+XP" and "+coins" drift up when a foe
is calmed. The HUD minimap, top right by the coins, shows about 5 by 4 rooms round the heroes, coloured by area, with
the room pulsing, a dot where the lead stands, shrines, guardians, and the wisp's goal as a small glowing mote. It
fades when the heroes walk under it and a tap opens the map. Otherwise it is solid, so a foe flying through the corner
never shows through it. Both can be turned off in Settings.

Doorways: every run of open tiles across a border between two rooms (`MAP_EXITS` in the engine, with the shafts up and
down) is drawn at its real spot on the edge. Between two explored rooms it is a plain gap in the wall. Into a room not
seen yet, it is a bright stub. Into another area, it is a notch in that area's colour (even when that room is
unexplored), so "the Reed Docks are through here" shows once the doorway has been seen from inside. A shut door
(ability doors, bell seals, hatches, the throne) is a small lock in the colour of what opens it, and turns into a gap
once open. The pause map has a key for these symbols. The numbers on the map read "Guardians 2 of 5 · Rooms 39 of 64 ·
Chests 10 of 17 · Murals 5 of 10".

The way to the Windward Belfry: before the Lake Mother is calm the maps show nothing of it. Once she is calm
(`belfryKnown()`), the pause map widens east to show the belfry's rooms not seen yet as a dim hatched silhouette in each
area's colour, outlined where the area ends, with no room detail, named "The Cloudstair" and "The Belfry Loft" while
anything of that area is unseen. Wayra's boat shows on both shores (on the minimap too) with a dotted route bowed over
the lake between them, still drawn on the way back. Rooms fill in as they are seen. On the minimap, when what to head
for (`mapTarget()`) is past its edge, a small arrow at that edge points to it: in the citadel, the boat while the
belfry has rooms not seen or the next goal is over there; in the belfry, the nearest unseen room of the Cloudstair,
then of the Belfry Loft, then the boat back. The wisp's mark on the maps (`mapGoal()`) sits on the boat when the next
goal is across the water. The key adds Wayra's boat, the unexplored belfry, the belfry's seal door and the minimap's
arrow. The Bell Rope and Echo Step doors are drawn as locks in those abilities' colours; bell hooks, wind bells and
echo bells are not drawn on the maps.

Numbers in the UI use Silkscreen's blocky digits (a digits-only font face covering 0 to 9, % and /, ahead of Pixelify
Sans), because in Pixelify Sans the 5 reads as an S and the 2 as a Z. The canvas damage numbers use their own 3×5
glyphs, which have no S or B to mix them up with.

## Assist and Strict

The helping hand is on by default: 40% less damage taken, slower guardians with longer warnings, healing near shrines,
and the guiding wisp. While the helping hand is on, the wisp is always there: a small soft glow with a short trail,
floating about 56 px ahead of the lead along the way to the next story goal (the next ability, the next guardian, the
nearest restless guardian once every ability is owned, then Ukumari and the throne). In the goal's room it hovers over
the goal. It follows a path through the room's open tiles, turning at corners, so it never passes through stone; the
path is through the air, not always one the heroes can walk. It keeps at least 24 px from the lead's face, fades while
someone talks, drifts to the far top corner in a guardian's arena, and never touches play (it lights no ghost-glass).
After the Lake Mother it rests. A door the heroes can already open (an ability door with that ability, a hatch with
the lantern, a bell seal with the Chime) counts as a way through when it picks the doorway, so it never points
straight through a wall at a goal beyond a door they could walk through. The Guiding wisp setting, under the helping hand, hides it; it is greyed out with "Needs
the helping hand on." while the helping hand is off. Strict turns the helping hand off and only allows shrine travel from a shrine.

## Gear you can see

Weapons and coats are painted into every hero frame, so the worn ones are shown by recolouring those pixels.
`scripts/bellspire-art.py` writes a part map beside each hero strip (`dora-parts.webp`, `enzo-parts.webp`: red 80 the
coat, 160 Dora's blade or Enzo's staff shaft, 240 Enzo's lantern). Dora's map comes from hue at full size (the teal
coat, the pale blade), then every teal pixel left on the final sprite. Enzo's colour pass pushes his staff's wood,
his lantern and his coat's rust to one hue, so his map is read off the painting before that pass, frame by frame:

- the lantern is the box round its glass (the most solid bright piece not sitting on the coat; a hook's highlight is a
  thin curve), grown by its frame and cap, so the dark bands across it are inside; a second light nearly as solid (a
  raised spell, a coin held up) gets its own box;
- the staff is the long warm piece that carries the lantern (the coat's orange trim never touches it, and fat warm
  areas such as lit folds are not staff), plus any long warm run on the line of its shaft past the paw that splits it;
  where a pose paints the shaft as dark and red as the coat, the shapes' long thin lines that hold the lantern count too;
- the coat is the final sprite's big rust pieces near the painting's red, plus collar and hem cloth next to them.

The lantern always wins: a coat pixel touching it counts as its rim unless it sits well inside the coat, and a small
island of "coat" touching it is its own dark band. The painted lantern box also goes into the part map's green, and
the browser suite checks against it, not against the labels: `lanternCheck` on the debug hook counts, across all 3
weapons and 4 coats and all 80 frames, the pixels inside the painted lantern that change with the coat (0), and
`lanternCheckControl` labels frame 8's lantern as coat to show the check catches that leak.
`lib/bellspire-gear-art.ts` repaints each part along a colour ramp by the brightness it was painted with (a weapon's
`lift` raises it first, so a shaft painted dark in a pose still comes out light), once per hero, weapon and coat.

- Weapons: the Reed-Cutter is a green blade, the Moonsteel a bright silver-blue one with a one-pixel glint. Enzo's
  shafts are pale so they stand off every coat (the painted wood was his coat's own rust): the Oak Staff is ash-white
  with a lit amber lantern, the Bell Staff bright brass with a gold lantern, the Star Lamp star-silver with a
  white-gold lamp. Dora's Bronze Sword is polished pale bronze. `gearContrast` on the debug hook measures every weapon
  against every coat each hero can wear (24 pairs), frame by frame: in each frame the mean colours of the weapon's and
  the coat's pixels must be at least ΔE 30 apart (CIE76) and 15 apart in lightness, and it reports the worst frame, so
  a pose can't hide behind the idle ones. The lowest pair is Enzo's Oak Staff on the Reedweave Coat at ΔE 41, and the
  lowest lightness gap the Reed-Cutter on the Reedweave Coat at ΔL 21. The swing arc and the whirl take the
  weapon's colour, Enzo's lantern light follows the weapon (the Star Lamp burns star-white and brighter), and the Bell
  Chime's ring is gold with the Bell Staff.
- Coats: either hero can wear any coat. Teal, rust, Reedweave (golden straw with a darker weave line every third row) and
  Snail-Shell (earthy brown, with a small spiral shell on the coat's back that turns with the hero).
- Rings and relics: the Moon Ring lets off a faint moon-blue sparkle now and then, the Frog Ring glints gold on the paw,
  the Lucky Reed Ring glints green, the Condor Feather is tucked behind an ear, the Salt Lamp casts a soft pink light
  round its wearer, the Bell Charm hangs at the belt and jingles on landing, and Puma Tooth crits flash orange.
- The gear menu shows each hero in the gear they wear. Picking an item shows that hero wearing it and what it changes
  ("ATK 8 → 11", "+ Swings come round faster") in green or red before equipping. Closing the menu after equipping plays
  a shine round the hero and a toast ("Dora equipped the Reed-Cutter and the Snail-Shell Coat."). The HUD bars use the
  new maximums at once.

Every item's effect has an engine test: blade damage, the Moonsteel's reach and the Reed-Cutter's quicker swing, the Frog
Ring's HP (and the HUD's numbers agreeing), the Snail-Shell Coat's lack of knock-back, the Reedweave's swimming, the Moon
Ring's MP, the Lucky Ring's coins, the Bell Staff's cheaper chime, the Star Lamp's bigger lantern and the Puma Tooth's
crits.

Knocked out: the partner takes over. When both are down they wake at the last shrine and drop their coins in a bag
where they fell; walking back picks it up.

## Saves

`localStorage` key `bellspire-v1` (settings in `bellspire-v1-settings`). Resting at a candle shrine saves and heals. A
save is checked when loaded (version, shrine, abilities, gear worn, HP) and a bad one is ignored, not misread. The
Windward Belfry added `wind` (each wind area's direction), `medals` and `ngp` to the save; a save from before it loads
with the wind at its start, no medals and a first time through, and keeps its `epilogue`. New Game+ saves under
`bellspire-v1-ngp`; a trial never writes its working copy, only the best time back into the save it started from.

## Tuning and bots

`tests/bellspire-bot.mjs` plays each guardian with two human-paced bots that see the fight a quarter of a second late
and sometimes miss an input: "casual" (helping hand on) and "pro" (off), at the levels the route bot reaches on the
shortest way through. A route bot then plays the whole game from a new save with the planner, fighting what it meets:
the citadel to the Lake Mother, then the ending's Keep exploring, Wayra's boat and the Windward Belfry to the
Out-of-Tune Bell, turning the wind with a wind bell, swinging on the Bell Rope and ringing an echo bell to climb its
notes for real inside their four seconds. It plays the belfry a second time from the finished citadel save loaded as
the title's Continue loads it (ending flag kept). In the belfry it replays the planner's moves back to back, exactly as
planned (settling only on a spot to stand or a rung, never on a wall mid-shaft), since a rope swing or a run of wall
kicks only works as simulated. The bots play with the helping hand on, so the planner they use (`new Graph(state,
true)`) simulates the guided rope: any move near a hook may be caught, and carries on with a tap of jump the way it was
going, and there are moves that jump at a hook and tap jump on the rope at a set moment, holding a way. (The planner's
proofs in the tests stay on the free rope, the harder of the two.)

The Bell Rope's human-paced bots (`node tests/bellspire-rope.mjs --bots`, and the 95% check in `tests/bellspire.mjs`)
see the game 12 to 15 ticks late, jump at a gap a little early or late, hold jump for a sloppy 9 to 17 ticks,
double-jump when no hook glows bright, and (guided) let go at a random moment 0 to 70 ticks into the swing; in Strict
they press X when a hook looks close, pump with the swing as they saw it and let go on a forward swing. A crossing
counts only on the first try: any hurt, or falling back, is a miss. Results on 07-11-2026, 24 seeds each:

| Crossing | Guided (helping hand) | Strict (free swing) |
|---|---|---|
| Rope cellar (to the chest ledge) | 24/24, 1.5 s | 19/24 |
| Rope loft (two hooks over spikes) | 24/24, 3.7 s | 0/24 |
| Rope gallery (two hooks over spikes) | 24/24, 3.4 s | 6/24 |
| Ropehall (to the chest ledge) | 24/24, 2.2 s | 2/24 |
| Louvres (from the echo notes) | 24/24, 1.6 s | 19/24 |
| Bell shaft (to the chest ledge) | 24/24, 1.9 s | 0/24 |
| Bannerwalk (to the pillar) | 24/24, 2.3 s | 12/24 |
| Condor bridge (across the bannerwalk and up the hatch) | 24/24, 5.5 s | 9/24 |

Results on 07-11-2026 (24 seeds each, all eight rerun together after the Twin Clappers were loosened):

| Guardian | Casual | Pro |
|---|---|---|
| Frog | 24/24, 37 s, lowest HP 58% | 24/24, 33 s, lowest HP 23% |
| Hydra | 24/24, 55 s, lowest HP 91% | 24/24, 61 s, lowest HP 60% |
| Puma | 24/24, 46 s, lowest HP 52% | 24/24, 48 s, lowest HP 32% |
| Warden | 24/24, 54 s, lowest HP 61% | 24/24, 63 s, lowest HP 28% |
| Mother | 24/24, 30 s, lowest HP 78% | 24/24, 34 s, lowest HP 58% |
| Hail Condor | 24/24, 46 s, lowest HP 84% | 24/24, 46 s, lowest HP 69% |
| Twin Clappers | 24/24, 82 s, lowest HP 78% | 24/24, 139 s, lowest HP 30% |
| Out-of-Tune Bell | 24/24, 100 s, lowest HP 62% | 24/24, 122 s, lowest HP 43% |

The Twin Clappers were loosened for pro, who had scraped through at 5% HP: in phase 3 a clapper throws after four
swings in five rather than every one, its glass shards fly at 2 rather than 2.4, it rests 32 ticks rather than 28,
and its floor waves are 10 high (from 12) and hit for 80% of its attack. Casual's lowest HP rose from 65% to 78%.

New Game+ (24 seeds, NG+ preset: the tune preset's levels, gear and spells, ×1.4 HP, the new attacks): casual wins
every guardian within 3 tries in 24 of 24 seeds (lowest HP: frog 91%, hydra 97%, puma 73%, warden 74%, mother 88%,
condor 82%, clappers 66%, Bell 49%); pro wins all but one Bell seed (lowest HP from 8%, the clappers, to 87%). The test
requires 85% for casual. `tests/bellspire-trials-bot.mjs` also runs the rush bot (casual must finish 75% of 16 seeds,
at least bronze every time, gold in at most a third) and a run bot on every area run (finished, under gold, gold within
1.35× of the bot).

The Bell Warden's falling bells and the Lake Mother's lilies never fired before 07-11-2026 (their wind-up skipped
its first step, so no marks were placed and nothing fell). With them working, the warden's lowest HP went from 62% to
61% (casual) and 33% to 28% (pro); the Mother's stayed at 78% and 58%, since she rarely lives long enough in phase 3 to
throw lilies (2 in 8 casual fights). Their landing spots now show as a pulsing ring with a faint column of light and a
small bell or lily over it, drawn over the heroes and the water.

The route bot finishes seeds 1 to 3 in 20 to 21 minutes of game time: the citadel in 12 (level 9), the belfry in
8 or 9 more (level 12). From the finished citadel save the belfry takes 8 minutes. A person exploring will take much
longer. The test requires casual wins in 85% of seeds and pro in 70%.

## Tests

- `tests/bellspire.mjs`: the map, the gates (each pedestal reachable with what comes before it, each area shut without
  its ability), no traps with four ability sets, physics, water, doors, the lantern and ghost-glass, combat, XP,
  tagging, knock-outs, shrines, travel (and when X opens it), the hero animator (every state, the climb), every foe
  frame's hitbox against its art, damage numbers, every gear item's effect, the shop, food, a guardian from door to reward,
  the throne's four seals (Ukumari with 0 to 4 guardians calm, the names, the door, the planner without each guardian,
  old saves), the map's doorways against the real open edges, the always-on wisp (every tick, never near a face, never
  changing play, off with the setting or in Strict), saves and determinism.
- `tests/bellspire-bot.mjs`: the guardian bots and the route bot (`--quick` for 8 seeds and one route;
  `--route-seeds=1,2,3` to pick the routes). A referee watches every route. It checks the throne is never open before
  all four seals, and that the wisp's goal can be reached with what the heroes have (allowing the water bells) and
  never sits behind a wall, at every goal change and every 20 seconds. It saves and loads after each step of the story
  and checks the seals and the wisp's goal come back the same. At Ukumari it loads an old save with the hydra skipped
  and checks the throne locks again and the wisp leads to the hydra, and that Wayra won't row before the Lake Mother.
  After the ending it finds the rest and checks the epilogue plays once. Both heroes must lead at some point. In the
  belfry the referee checks the wisp's goal can be reached in every wind the wind bells can set (and across the water,
  that it leads to the boat), that the wisp stays on, that the heroes are never there before the Lake Mother, that the
  wind is turned and an echo-note climb is done, that saving and loading after each belfry step keeps the wind, the
  seals, the totals and the wisp, that the belfry's ending plays once, and that finding everything afterwards plays the
  second epilogue once and nothing else, again after a reload.
- `tests/bellspire-belfry.mjs` (run by `tests/bellspire.mjs`): the Windward Belfry. Planner proofs from Wayra's boat
  in both winds and with the abilities in story order (the windgate shut while the wind blows the wrong way, the Bell
  Rope's pedestal reached by turning it, the bannerwalk and condor bridge needing the rope, the cairns and the loft's
  upper rooms needing the Echo Step, the belfry seal needing both guardians, every belfry chest, mural, shrine,
  pedestal and bell reachable with everything) and no trap in either wind with each ability set. The rope rooms need
  the rope and the citadel is still all reachable with its own seven abilities. Then the engine: the rope across the
  bannerwalk replayed from the planner's path, its rules (catch, length, swing, no tagging, release with a kick, ↓ to
  drop, Dora only), the wind (bracing, faster with it, blown in the air, the jacket's half, a wind bell rung by sword
  and chime, the glide's lift, saved), echo notes (three in order, the bell's own path, standing on one, fading at 4
  seconds, the staff's double time, and the climb to the cairns' shelf done for real inside that time), swinging bells
  carrying a hero, every new door and its message, Wayra's boat before and after the Lake Mother, the news for a
  finished save, the wisp to the boat, both new spells, every new foe's wind-up and attack, the three guardians (door,
  introduction, three phases, wind-ups, their signature attacks, each clapper's hero, the reward, the ending), the
  condor's planks, the retune, old saves, the totals and both epilogues, and every new pose.
- `tests/bellspire-trials.mjs` (run by `tests/bellspire.mjs`): Echo Trials and New Game+. Each trial's definition and
  that every bell stands on ground; the locks and their reasons; the trials scene once; a run's clock (starting on the
  first move), bells in order, the result, the save restored with only the best kept, a slow run's medal, wind and
  water restored, giving up, a knock-out; the rush (all eight in order, the half heal, no XP or endings, the save
  restored, a knock-out ending it); New Game+ (what carries over, the save round trip, the intro line, round 2), and
  each guardian's ×1.4 HP, the hit floor and its new attack only in New Game+, always after its wind-up.
- The map guide (in `tests/bellspire-belfry.mjs`): no belfry on the maps before the Lake Mother; after her, the arrow to
  the boat (east of the shrine), the wisp's mark on the boat, never back to Ukumari, the Cloudstair then the Loft then
  the boat back from inside the belfry, no arrow with everything done, kept across a save. The browser suite checks the
  same on screen on a desktop and both phone sizes (silhouette cells, both names, both boats, the route, the legend
  entries, the arrow's direction), and sweeps every menu tab, gear slot and gear preview for "undefined" or "NaN".
- `tests/bellspire-rope.mjs` (run by `tests/bellspire.mjs`): the Bell Rope in both modes. The catch (by itself with
  the helping hand from 6 tiles but not 7, never from below or standing, X still works, never Enzo; in Strict and with
  the helping hand off, only with X), the glow (bright when the catch is coming, faint when she needs more height, none
  in Strict), the steady swing (a full arc of 1 radian on a 56 px rope, the same with ← or → held, pumped or in a gust;
  Strict's pumping grows its swing), the guided release (← and → pick the side, neither picks the way she faces, a jump
  at any of 13 moments of the swing lands on the same spot, standing, unhurt, eased with no step over 9 px), a chain of
  two hooks over the gallery's spikes to the far ledge, no catching the same hook again on the way down, the safety
  net (↓ and a hit fly her home over the spikes, the hit's damage only; Strict's ↓ just drops), Shift's message on the
  rope in both modes, Strict and helping-hand-off swinging exactly the same free pendulum, and every aim from every
  hook in every rope room at 16 points of the swing each way: through no wall and no hazard, in the hook's own room, a
  hook target a real hook, a ledge target something to stand on and a stand spot the route planner moves on from. The
  planner crosses each rope room with the guided rope, and the human-paced bots cross every rope crossing first try in
  at least 95% of 24 seeds. The free rope's older checks (the planner's path across the bannerwalk replayed, catch,
  length, swing, no tagging, release with a kick, ↓ to drop, Dora only) run in Strict in `tests/bellspire-belfry.mjs`.
- `tests/bellspire-strips.mjs` (run by `tests/bellspire.mjs`): every art strip's image is exactly its manifest frame
  count of cells wide (read from the WebP header), every strip the CSS sizes in % is (frames × 100)% wide, and every
  `backgroundSize` in the page takes its frame count from `ART` (the icon, portrait and mural strips), so a strip that
  grows can't squeeze its frames again. The browser suite checks the same on screen for a mural, the item icons and a
  dialog portrait: drawn frames × the box wide, on one whole frame, in the frame's shape.
- `tests/bellspire-trials-bot.mjs` (run at the end of `tests/bellspire-bot.mjs`; `--quick`, `--only=rush|runs|ngp`):
  the rush, run and New Game+ bots above.
- `tests/e2e/bellspire.mjs`: the browser suite. Every player action with the real keys, each locked action's message,
  the shrine (↑ rests, X travels, X near a foe swings, a map tap travels), the climb frame, a chest, a door opening,
  a bell ringing, damage numbers, the minimap at three screen sizes (with an area entrance drawn), gear equipped through
  the menu (preview, comparison, toast, worn gear in the scene, a harder hit), the map's doorways and stats line,
  Ukumari keeping the throne shut with the hydra skipped, the Guiding wisp setting, the shop, a mural, every menu tab, a key rebind, a water bell, a lantern hatch, a guardian, the ending,
  saves, the Windward Belfry (Wayra's boat, the wider map, bracing in a gust, a wind bell, the guided Bell Rope with the
  real keys: the glow before the catch, the catch with no X, the dotted arc, a flight to the next hook and on to a ledge
  (hold →, tap Z, tap Z), Shift's message on the rope and ↓ flying home over the spikes; then Strict's free throw,
  swing and release, with screenshots of the glow, catch, arc and flight at 1280×800 and on both phones (with the
  pad), an echo bell's notes, the Frost Fan, the Gale Wave, riding a swinging bell, the two outfits, the
  three guardians and the belfry's ending), the Echo Trials (locked before the Bell, the scene, the page, a run with
its clock, bells, card, Try again and Give up, the whole rush and the medals), New Game+ (locked on the title, started,
both keys, each new attack's wind-up and hit, the title with both saves, the confirm, each Continue), and phones held both ways, with no page errors and no sideways scrolling.

Compile first: `npx tsc lib/bellspire-game.ts lib/bellspire-nav.ts --target es2022 --module es2022
--moduleResolution bundler --outDir .checks --skipLibCheck --strict`.

## Art

The Cloudstair's play surfaces are the one exception: its painted tile set read as flat orange brick against the warm
backdrop, so the script redraws them as weathered grey-gold stone, with snow and ichu-grass caps on every top, a
second top and a second fill for variety, a carved step-diamond, cracked stone and an underside. It also takes the rope
bridge out of the Cloudstair's middle layer (it looked walkable at the heroes' height) and pushes that layer back,
darker, cooler and less saturated. The Cloudstair is out under the sky, so it has no back wall and no back pillars,
and a brighter, cooler ambient light (0.84, 0.78, 0.74) than the citadel's areas, so the stone stays grey. Its "torch"
marks are bell posts that stand on the floor below them (their glow sits at the post's lamp), and every bell hook, and
every lantern hanging in the Belfry Loft, hangs from an iron chain bolted to the stone above it. The Belfry Loft has
no back pillars either: its middle layer has its own posts and beams.

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
