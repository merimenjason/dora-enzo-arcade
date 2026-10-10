# Moonpond

Game 31, `/moonpond`, built 10-10-2026. A night-fishing journal: Dora and Enzo sit on a dock with a lantern, coax the pond's creatures up to the surface, sketch them and let them go. A night is a handful of casts and takes about five minutes; the journal has forty pages and takes weeks of short visits to fill.

Nothing is kept. Chinchillas eat hay, so every catch becomes a journal page and earns moon shells when it is released.

## A night

The lantern holds 8 casts of oil (up to 12 with upgrades). The hour moves on as the oil burns, an equal number of casts at **dusk**, **moonrise**, **midnight** and **first light**. Each night has one weather: a clear night (40%), mist, rain or a firefly night (20% each). The moon moves on one phase per night round a cycle of eight, starting at the new moon; night 5 is the first full moon, and a full moon is always clear.

Before the first cast of a night you choose who fishes. **Dora** casts 15% further. **Enzo** has 15% longer to hook a bite. The other holds the lantern.

## A cast

1. **Throw.** Hold to charge, let go to throw. The charge swings up to full and back down at 85% a second. A touch shorter than 8% of a charge is not a cast. Aim with ← → (or by where you touch the water).
2. **Bite.** The bite comes a few seconds after the splash, sooner in rain and later in mist. Up to three nibbles may come first (one at most on a firefly night): the bobber dips for 0.35 s. The real bite pulls it right under for 0.6 s. Press then to hook. Pressing early scares the creature off; waiting too long misses it. Either way the cast is spent.
3. **Reel.** Hold to reel, let go to ease. The gauge beside the dock shows the tension on the line, and the pale band (34% to 68%) is where it should stay. Above the band, strain builds, faster the further over it is, and the line snaps at 0.7 s of strain. Below it, slack builds and the creature slips the hook after 1.6 s. Strain and slack ease off again while the line is in the band. The creature only comes in while you reel with the line in or above the band.

How far the cast goes decides the water it lands in:

| Water | Distance | Reached by |
| --- | --- | --- |
| The reeds | 0 to 20% | any rod |
| The lily pads | 20% to 42% | any rod |
| Open water | 42% to 66% | any rod |
| The deep channel | 66% and beyond | the willow rod |
| The moon's reflection | a patch in the deep water, clear nights only | the silver-tipped rod |

The first rod throws 56% of the way across, the better rods 88%.

## Five ways of fighting

Each creature pulls in its own way, harder the stronger it is.

- **Steady** ones pull evenly. The gentle ones come in on a held reel.
- **Darters** pull in half-second bursts with rests between.
- **Divers** pull in slow waves.
- **Heavy** ones pull hard all the time, so the reel has to be worked in pulses.
- **Jumpers** gather for 0.35 s (a ring on the water and "Let go!") and then leap for 0.6 s. Reeling through a leap strains the line two and a half times as fast; riding it out on a loose line tires the creature.

Every creature also surges now and then with no rhythm to learn, and strong ones surge more often.

## The journal

Forty pages: thirty creatures, six curiosities and four legends. A page not yet sketched shows an outline and a clue. A sketched page shows where and when the creature is found, its largest size and its stars: three stars for a catch in the top fifth of its size range, two for the top three fifths.

What takes the lure depends on the water, the hour, the weather, the lure and the moon:

- **Common** creatures live in one water and have a preference. Off their preference they still turn up, at about a third of the rate.
- **Uncommon** creatures need one thing to be right: an hour, a weather or a lure.
- **Rare** creatures need two.
- **Curiosities** (a lost button, a tiny teacup, a message in a bottle, a glass marble, a brass key, a sunken bell) turn up now and then in their own water, whatever the night.
- **Legends** need a moon phase, an hour and a lure: the Ink Eel at the new moon, the Crescent Carp under a crescent, Old Mossback under a half moon, and the Moon Koi in the full moon's reflection once the other three are sketched.

A creature not yet sketched is 30% more likely to come than one that already has been.

Three lures: the **glow bead** you start with, the **clover knot** (40 shells) and the **dust puff** (90 shells).

## Shells, the bait shop and requests

Letting a catch go earns moon shells: 2 for a common creature, 5 for an uncommon one, 12 for a rare one, 40 for a legend and 8 for a curiosity. Two stars add a quarter and three stars a half, and the first sketch of a page pays the base amount again.

| Upgrade | Levels and cost in shells | What it does |
| --- | --- | --- |
| Rod | 60, 220 | Willow rod: reaches the deep channel. Silver-tipped rod: the lure can settle on the moon's reflection. |
| Line | 40, 110, 240 | Each level widens the top of the band by 4 points and adds 0.25 s before the line snaps. |
| Lantern oil | 50, 100, 170, 260 | One more cast a night per level. |
| Bobber | 45, 130 | Each level adds 0.1 s to the moment for hooking. |
| Enzo's spyglass | 80 | Shadows under the bobber are tinted by how rare they are. |

The shop is open whenever the line is in, and at dawn.

Three **requests** from the neighbours are always on the board: something from a named water at a named hour (10 shells), anything on a named weather (6), a named creature (12) or a three-star catch (14). A catch that answers a request pays it at once and a new one takes its place.

## The end

Sketching the fortieth page plays a short ending. After that the weather for the next night can be chosen at dawn.

## Controls

- **Space**, or hold the water or the big button: charge and throw, hook, reel, and dismiss a catch.
- **← →** or **A D**: aim. Touching the water aims where you touch.
- **J** journal, **B** bait shop, **R** requests, **P** or **Escape** pause, **M** sound.
- The game pauses if the tab is hidden or the window loses focus while a cast is out, and a touch the browser interrupts cancels a charge without casting.

## Animation

The pond moves with the game. The rod draws back as the cast charges and whips forward on the throw, with a dotted arc and a breathing ring showing where the lure will land. The bobber wobbles as it settles, dips for nibbles and plunges with bubbles for the bite, and the chinchilla holding the lantern starts. On the reel the line hums as it tightens, a hard pull leaves a wake, the edges redden as strain builds, and a snapped line jolts the picture. A landed catch is lifted out of the water in an arc and held up over the lantern while both friends hop (a first sketch gets turning rays); let go, it dives back in and its shadow slips away. Around all that: shooting stars on clear nights, something small jumping out on the water, moths at the lantern, and at dawn a rising sun and birds. The catch card, dawn summary, journal pages, shop rows, lantern-oil flames and the Hook! button are animated in CSS.

Players who ask for reduced motion get none of it: the water, sky and weather hold still, splashes and sparks are not drawn, the catch simply appears held up, and the CSS animations are switched off. The game itself plays the same.

## Saves

`moonpond-v1` keeps the journal, shells, gear, lures, requests, the night number, the angler and the lure. `moonpond-night-v1` keeps the night in progress: casts used, the weather and what was caught. Both are written the moment a catch lands or a cast is lost, when anything is bought, at dawn, and when the page is hidden. A cast that was in the air, in the water or on the line when the page closed is taken again from the dock, and the same creature is waiting. A damaged journal is refused; a damaged night is dropped and the journal kept. `moonpond-sound-v1` keeps the sound switch.

## How it is built

- `lib/moonpond-game.ts`: the rules, with no DOM. A fixed 1/60 s step. Every bite comes from the seed, the night and the cast number, so a seed replays exactly.
- `lib/moonpond-art.ts`: every creature and prop is drawn by name. See [`moonpond-art.md`](moonpond-art.md) for replacing the drawings with painted sheets.
- `lib/moonpond-scene.ts`: sky, moon and phase, far bank, water, weather, dock, rod, line, bobber, shadows, the tension gauge. `Pond.watch` notices the game changing state and starts the animations that follow from it; `Pond.take` turns the engine's events into splashes, rings and bubbles; `Pond.inspect` reports what is being shown, for the browser test. The chinchillas are the shared `drawChinchilla`.
- `app/moonpond/`: the page, sound cues and styles. `window.__moonpond()` exposes the game, the scene and the pause flag for the browser test.

## Checks

- `npm run test:moonpond`: the forty pages and their conditions, casting and the bands of water, the moon's reflection, nibbles, bites and the hooking window, the five ways of fighting, snapping and slipping, leaps, stars, shells, requests, the shop, a whole night, moon phases and weather, the ending, seed replay, frame subdivision, and saves including 23 damaged journals and 9 damaged nights.
- `npm run bot:moonpond`: an angler that presses only what a player can. It must fill the journal within 70 nights on each of eight seeds, catch every entry, and never have a night without a bite. A middling angler on starter gear must land between 55% and 85% of casts. On 10-10-2026 the eight journals took 13 to 56 nights and the starter rate was 76%.
- `tests/e2e/moonpond.mjs`: the menu card, a whole cast by keyboard, nibbles and each kind of loss, an interrupted touch, pausing and a hidden tab, the hold button on a phone, journal, shop and requests, dawn and the next night, reloads mid-night and at dawn, the lifted catch, the hop and the dive back, the ending and chosen weather, reduced motion (no splashes, hops or CSS animation), and seven screen sizes.

Not yet done: the game has been tuned with its bot and looked at in screenshots, but not played by hand by a person, and the sound has not been listened to.
