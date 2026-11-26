# Lookout Ridge

Game 107, at `/lookout-ridge`. Turn-based artillery on a ridge woven from Andean cloth, in the style of Gunbound. Dora rides Tupa the llama and fires a pebble trebuchet; Enzo rides Mochi the capybara and fires a clay-pot cannon. A culpeo fox with a log cannon and a black-chested buzzard-eagle that flies are the predators. The level is the burrow: three chinchilla kits in a pocket in Dora's ledge, to be kept safe until nightfall.

Code: engine `lib/lookout-ridge-game.ts`, scene `lib/lookout-ridge-scene.ts`, page `app/lookout-ridge/`, art `public/art/lookout-ridge/` (the painted woven webps from the prototype, unchanged).

## Turns

The order is Dora, fox, Enzo, eagle; anyone who is down is skipped. Each turn rolls a new wind from -6 to 6. A hero can walk until the walk meter runs out (Tupa 230px, climbing 14px steps; Mochi 140px, 6px steps), set the angle and hold Space to charge (power 0 to 100 in two seconds). The eagle flies to a spot over its target and drops a stone. The fox aims with the same guide sim as the heroes, with a little more error (`PRED_ERR` 1.1), and gets closer after a miss.

| Shot | Who | Damage | Blast radius | Notes |
| --- | --- | --- | --- | --- |
| Pebble | Dora | 34 | 30 | |
| Pebble Trio | Dora | 16 each | 24 | three pebbles at 95%, 100% and 105% power |
| Clay Pot | Enzo | 26 | 54 | |
| Heavy Pot | Enzo | 40 | 34 | falls 1.35 times as fast |
| Darning Needle | both | none | patch of 44 | thrown at 80% speed, 1.1 gravity, 30% of the wind; flies through animals |
| Log Shot | fox | 30 | 40 | |
| Stone Drop | eagle | 28 | 30 | |

Damage falls off to 35% at the edge of the blast. Mochi takes 80% of all damage. Units on the ground are hit within 38px (80% of it for a direct hit); the eagle within 62px.

## The cloth

The ground is an alpha mask in the engine: the cloth below the surface line plus the grass band laid along it (strips 36px tall, 40% of them above the line, so the grass stands about 14px proud on the flat). It is woven in rows 30px tall from y 430 down; each row is one thread.

- **Craters** cut the mask and leave frayed fringes round the rim. A crater can leave one loose thread: the cut row with the longest run of cloth (at least 110px) beside the hole, whose pom-pom hangs in the open. At most five loose threads at a time.
- **Pulls.** A shot that hits a pom-pom (within 24px) pulls its thread. A hero's shot that lands within 40px of one (`TANGLE`) also pulls it, as aim assist; predators must hit the pom itself, so their misses don't unravel the kits' roof. The row unravels 14 columns a frame, for up to 520px, until a gap or a knot: everything woven above it drops one row. Anyone standing on it slides up to 220px toward the hole and takes 22 tumble damage (`PULL_DMG`). Any fall over 50px hurts 0.3 a pixel beyond that.
- **The knot.** Rows above the burrow's floor never unravel within 110px of it.
- **The Darning Needle** stitches a crater-shaped patch of cloth into any gap where it lands, as long as there is cloth there to stitch to. The patch fills only gaps, leaves old cloth as it was, lifts anyone it buries, and never fills the kits' chamber.

The engine logs every change to the mask in `ops` (cut, darn, shift); the scene replays them on its painted bitmap with the canvas calls the prototype used, so the picture and the rules agree (the browser test samples both on a grid and expects over 98.5% to match; it measures 99.95%).

## The burrow and nightfall

| Constant | Value | Meaning |
| --- | --- | --- |
| `NIGHT` | 7 | Hold out this many rounds and night falls: the kits are safe. The sky darkens round by round. |
| `KIT_FOCUS` | 0.85 | How often a predator aims at the burrow rather than the nearest hero. |
| `KIT_REACH` | 18 | A blast this far past its radius still scares a kit off, unless 12px of cloth lies between. |

Losing: every kit has bolted, or both heroes are down. Downing both predators also wins.

## Balance

Self-play (`npm run bot:lookout-ridge`): 300 seeded matches an arm, the same seeds for both. Smart heroes mend an open roof with the needle, pull a thread out from under a predator when none of their own is on it, and otherwise shoot the weaker predator; dumb heroes only shoot. Smart heroes win 54% and dumb ones 35% (the prototype measured 55% and 30% over 100 matches). The bot requires a gap of at least 10 points. A single match can swing on a pixel, so samples of a few dozen are too noisy to compare; `npm test` runs 16 matches an arm and checks only that every match ends and that the smart heroes do darn and pull.

## From the prototype

The game is the v2 browser prototype, split into engine, scene and page with the gameplay and every tuned number unchanged. Matched seed for seed, the port replays the prototype's matches event for event until a sub-pixel difference in an antialiased crater edge sends them apart. The changes: the title's subtitle reads "The burrow" instead of "Prototype 2: the burrow" and gains a "Press Space or click to start" line; a "← Arcade" link sits in the corner; and Tab no longer moves the browser's focus during play.
