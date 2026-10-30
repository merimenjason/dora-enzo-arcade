# Twig & Twine

Game 57, at `/bridges`. A cosy physics bridge-building puzzle for one player. The spring floods have washed away the valley's little bridges; Dora and Enzo build them again from twigs, planks, twine and bamboo, then ride across in their acorn cart.

All numbers below come from `lib/bridges-game.ts` and `lib/bridges-levels.ts`. Written 30-10-2026.

## Files

- `lib/bridges-game.ts`: the rules and the physics. Deterministic and DOM-free: no `Math.random`, no clock, a fixed step. It holds the materials, the builder (snapping, reach, where joints may go, undo and redo, mirror building, removing), the simulation, the medals and the save format.
- `lib/bridges-levels.ts`: the four regions, the twenty-four crossings, the sandbox and the medal prices.
- `lib/bridges-scene.ts`: Canvas 2D drawing: the painted backdrop for the region, the banks, rocks, posts and water, the build grid and anchors, the members in their materials and stress colours, the acorn cart with the painted Dora and Enzo on spinning wheels, the hay wagon, the boat, the wind, splinters, splashes and confetti, the camera, and drawn stand-ins for every painting.
- `app/bridges/page.tsx`, `layout.tsx`, `bridges.css` and `sound.ts`: the page. It handles the mouse, touch and keys, the loop, saving, the toolbar and the medal bar, the tips and the tutorial, and the WebAudio sound and music.
- `tests/bridges.mjs`, `tests/bridges-bot.mjs`, `tests/bridges-solutions.json` and `tests/e2e/bridges.mjs`: the tests.

## Building

The world is a grid of whole units with y up. Drag from an anchor or a joint to a grid point to build a member there; the far end becomes a new joint (or joins one already there). A drag past a material's reach stops at the furthest grid point it can reach. A member may not be built twice, may not put a joint inside the ground (anchors excepted), must stay inside the level's building area and may not touch the boat's lane.

| Material | Key | Acorns a unit | Reach | Mass a unit | Pulls up to | Pushes up to (2 long) |
| --- | --- | --- | --- | --- | --- | --- |
| Twig | 1 | 10 | 3 | 0.18 | 105 | 95 |
| Plank | 2 | 18 | 2.5 | 0.45 | 110 | 130 |
| Twine | 3 | 5 | 8 | 0.04 | 170 | nothing (goes slack) |
| Bamboo | 4 | 26 | 4 | 0.3 | 300 | 260 |

A member costs its rate times its length, rounded. Planks are the road: the cart and the wagon roll only on planks (and the banks' roads). A member longer than 2 buckles sooner: the push it can take falls as 2 ÷ its length. Mirror building (**M**) builds the twin of every member on the other side of the level's mirror line, and removing a member removes its twin. Undo and redo keep every step (up to 300), including clearing and removing.

## The physics

Pressing Test builds a simulation from the design: the anchors hold still, every joint is a point mass (half of each member it touches plus 0.06), and every member is a distance constraint with its material's stiffness, solved with XPBD at 60 steps a second of 16 substeps each. Twine only pulls: pushed, it goes slack and carries nothing. The force in each member is averaged over each step; if it passes the member's limit (its pull limit, or its push limit for its length), the member snaps. For the first 0.8 seconds the bridge settles under its own weight, heavily damped, and only a hard overload (15% over) snaps anything; then the cart sets off. Gravity is 10.

The acorn cart is two wheels (radius 0.42) on a rigid axle 1.7 long, mass 6, cruising at 2.6 a second with a grip of 7. The hay wagon is heavier (mass 11, wheels 0.45, axle 2) and follows 2.6 behind, easing off if it gets close to the cart. Wheels rest on planks and roads from above only (nothing steeper than about 58° is a road), and the push of a wheel is shared with the plank's two joints, so the cart's weight loads the deck. A run is won when every vehicle's rear wheel passes the finish; it is lost when a vehicle drops below the water (or the ravine or canyon floor), when nothing has moved forward for 4 seconds, after 60 seconds, or when any member touches the boat's lane after the bridge has settled.

Wind (the canyon levels) blows in gusts every 4.6 seconds against the cart, with an updraft rising and falling, and pushes on everything in proportion to its size: twine catches little, planks a lot.

The stress view colours each member from calm green through amber (at 60% of its limit) to red as it nears snapping; slack twine droops.

## Regions and crossings

Each region's first crossing opens with a tip card. Crossings open in order; a region's first crossing also opens once four in the region before are crossed. The sandbox opens when all of Willow Brook is crossed, and the ending plays the first time the Great Canyon is crossed within its budget.

| Region | Crossings | New ideas |
| --- | --- | --- |
| Willow Brook | First Crossing, Puddle Hop, Over the Top, Stepping Stone, Willow Bend, Wide Brook | planks and twigs, triangles, trusses above and below, a stone in the brook, deep anchors for an arch |
| Mossy Ravine | Hanging Fern, Rope Walk, Fern Gully, Bamboo Grove, Mossy Arch, Waterfall Gap | twine hung from old posts, bamboo (from Bamboo Grove) |
| Reed Marsh | Soft Banks, Reed Islands, The Ferry Lane, Up the Bank, Two Crossings, Heron’s Pool | few anchors, rocks in the water, the boat's lane, a climb to a higher bank, two gaps in one |
| Sunset Canyon | Windy Rim, Hay Day, Red Rock Step, The Long Haul, Gusty Gorge, The Great Canyon | wind, the hay wagon, a descent, long spans with a pillar, everything at once |

## Medals and prices

Each crossing has three acorns: one for crossing within the budget, two within the thrifty price and three within the master builder's price. The prices come from two stored designs per level in `tests/bridges-solutions.json`, found with an offline search (rich trusses, hangers and arches, pruned member by member while they still crossed): the master price is a little above the cheapest design (at least 4 acorns or 3%, rounded up to 5), the thrifty price is above a second, different design and at least a fifth above the master price (rounded up to 10), and the budget is 1.45 times the thrifty price. A crossing over budget still lets the cart across, but earns nothing.

## Controls

- Mouse: drag from a joint or anchor to build; right-click a member or joint to remove it; the wheel zooms at the pointer; drag empty space (or with the middle button) to pan.
- Keys: **1**–**4** pick twig, plank, twine and bamboo; **Space**, **Enter** or **T** tests (and stops a test); **Z** undoes and **Y** (or **Shift**+**Z**) redoes; **X**, **Delete** or **Backspace** removes the joint under the pointer, or toggles the remove tool; **M** mirror; **V** the stress view; **F** frames the crossing; **+** and **−** zoom; **WASD** or the arrows pan; **Esc** stops a test or pauses.
- Touch: drag from a joint or anchor to build, ✂ to remove by tapping, two fingers to pan and zoom. Phones work held either way.
- The toolbar has the materials, ✂ remove, ⇋ mirror, ↶ undo, ↷ redo, 🗑 clear, 📊 stress, ▶ Test; while testing, a strain meter, ⏩ double speed and 📊. The sandbox adds 🌾 for the hay wagon.

## First Crossing

First Crossing walks through the first bridge with a pointing paw: lay a plank from the anchor to the middle and on to the far anchor, test it (the planks sag and snap and the cart splashes in), then prop the middle joint with a twig from a low anchor to make a triangle, and test again.

## Saving

Progress is kept in `localStorage` under `twig-twine-v1`: for each crossing the cheapest crossing cost, the acorns and the latest design (saved as it is built), the sandbox design and its wagon setting, whether the tutorial and the ending are done, and the Sound, Music, stress view and mirror settings. A save that doesn't parse, or has the wrong version, starts fresh; members that aren't valid on their level are dropped; bests and acorns only ever go up.

## Sound

WebAudio, made on the fly: a wooden tock as a member drops in (softer for twine, hollow for bamboo), creaks that grow with the strain, a crack and a thud for a snap and a twang for twine, a splash (a dusty poof in the canyon), a bump for the boat and a jingle for a crossing. Each region has a gentle loop and its own ambience: water and birds, drips, frogs and wind.

## Tests

- `npm run test:bridges`: the engine checks: the levels and their prices, costs and medals, the builder (reach, snapping, the ground, the boat's lane, undo and redo, mirror building, removing), twine slack when pushed and holding when pulled, plank-only decks snapping, a simple truss holding, determinism (twice, step by step, in any build order, with wind), the vehicles, and saves (corrupt ones included), unlocking and the ending.
- `npm run bot:bridges`: every crossing with its stored master and thrifty designs (within their prices, nothing snapping), nothing built and the road alone failing, and every run repeated and stepped by hand to the same end. `npm test` runs it with `--quick`, without the repeats.
- `npm run test:e2e:bridges`: the browser checks (needs `npm run dev` and Playwright).
