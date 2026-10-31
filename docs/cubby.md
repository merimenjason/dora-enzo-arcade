# Cubby Valley

Game 67, at `/cubby`. A cosy 3D block-building sandbox for one player, drawn with Three.js. Dora and Enzo arrive in a green valley made of blocks. They dig and gather, weave things at the Burrow Workbench, build snug burrows for six animal neighbours, keep the night's monsters at bay, and end the story with a summer fair.

All numbers below come from `lib/cubby-world.ts`, `lib/cubby-content.ts` and `lib/cubby-game.ts`. Written 01-11-2026.

## Files

- `lib/cubby-world.ts`: the block table, the valley generator, the world and its light, the burrow check and the save codec. Deterministic and DOM-free.
- `lib/cubby-content.ts`: the items, the Workbench patterns, the six neighbours and their errands, and the night's creatures.
- `lib/cubby-game.ts`: the rules: bodies and paths, digging and placing, the bag, the Workbench, errands and moving in, the day, the creatures, hearts and knock-outs, and the save format. Randomness comes only from the valley's seed.
- `lib/cubby-models.ts`: the voxel models: Dora and Enzo, the six neighbours, the creatures, the furniture and the items in paw.
- `lib/cubby-mesh.ts`: greedy chunk meshing with corner shading and smoothed light.
- `lib/cubby-scene.ts`: the Three.js scene: the painted block atlas, chunk meshes, the sky, sun, moon and stars, water, the characters and their animation, particles, the camera, the hotbar icons and screen boxes for the tests.
- `app/cubby/page.tsx`, `layout.tsx`, `cubby.css` and `sound.ts`: the page. It handles the menu and save slots, the keyboard, mouse and touch, the loop, the HUD and panels, autosaving and the WebAudio sound and music.
- `tests/cubby.mjs`, `tests/cubby-bot.mjs` and `tests/e2e/cubby.mjs`: the tests.
- `public/art/cubby/title.webp` and `ending.webp`: the paintings (brief in [`cubby-art-brief.md`](cubby-art-brief.md)).

## The valley

Every valley is 96 × 96 blocks and 48 high, grown from its seed: a flowery meadow in the middle, a birch wood to the north-west, a river winding down to a lake in the south-west, terraced chalk cliffs on the east with ironstone in them, low hills around the rim, and the glow cave: a tunnel into the east cliff that opens into a chamber of glow crystals, ironstone and mushrooms. Dora and Enzo's cubby stands near the start with a round door, a window, their bed, a lantern and the Burrow Workbench; the notice stump, where visiting neighbours wait, is close by. Twelve golden recipe leaves lie around the valley, each teaching one pattern when you walk over it.

Blocks are dug by holding: soft things (turf, soil, sand, leaves, plants) go at once, planks take 0.4 seconds, chalk 0.55, birch logs 0.6, glow crystals 0.7, bricks 0.9, fieldstone 1.1 and ironstone 1.4. The digging trowel digs stone, chalk, logs and ironstone two to three times faster. Turf gives soil, leaves give twigs (and three times in ten a sapling), tall grass gives hay, berry bushes 2 red berries, cotton puffs 2 fluff and ironstone an iron nugget. Sand falls, water flows into holes beside it, and a sapling planted on turf or soil grows into a birch after 90 seconds. You reach 5 blocks.

Dora and Enzo walk at 4.3 blocks a second, hop up one-block steps on their own, swim (and scramble out onto a bank a block above the water), climb rope ladders, and pass through round doors, which the creatures cannot. **Tab** swaps which of them you play; the other follows.

## The Burrow Workbench

Stand within 4.5 blocks of a Workbench and press **F**. Lay things from the bag on its three threads, or tap a pattern in the book, and Weave; the same pattern doubled weaves twice. A pattern you haven't learned shows a question mark. You start with nine patterns: planks (4 from a log), twigs (3 from a plank), Workbench, lantern, round door, cloth (3 fluff), cushion, snug bed and the bonk-stick. Neighbours teach their patterns through their errands, and the twelve recipe leaves teach ladders, fences, garden benches, glass, four tiles, pebble paths, hay bales, bunting and the crystal lamp.

## The neighbours

One neighbour at a time waits by the notice stump. Each has three errands; the last is always a burrow. A burrow is a space shut in on every side (at least 4 and at most 240 spaces) with a round door in its wall, a light inside, a bed, the neighbour's own furniture, and nobody else's bed. Stand in it and press **B** to check it, then invite them; they walk to their new home.

| Neighbour | Errands | Furniture |
| --- | --- | --- |
| Hazel the hedgehog baker | 3 red berries; a berry tart | Brick oven |
| Morrow the mole miner | 6 fieldstone; 2 glow crystals and a gloom pearl | Ore cart |
| Ottoline the owl librarian | Catch 3 dust-bunnies at night; 2 books | Bookshelf |
| Juniper the rabbit gardener | Plant 3 saplings; 2 daisies and 2 bluebells | Flower pot |
| Fennel the fox musician | Place 3 lanterns outside; a wind chime | Drum |
| Barnaby the badger smith | 5 iron nuggets; 4 boar thorns | Anvil |

When Barnaby moves in, all six gather by the stump for the summer fair, the camera circles them, and the ending painting follows; **Keep building** carries on in the same valley.

## Day, night and the creatures

A day lasts 10 minutes; night runs from 68% to 95% of it. In a bed (**F** on it, from the evening on) you sleep till morning, unless a monster is within 10 blocks, and that bed becomes where you wake after a knock-out. Creatures are rolled every 2.5 seconds from the valley's seed. Monsters come out on open ground at night where lantern light is under 4, never inside a burrow someone lives in; Gloom Gnashers sit by the glow crystals in the dark at any hour. Harmless **dust-bunnies** come out every night: they knock over unlit pots, benches, cushions and bunting, and turn into 2 fluff when you bump into them.

| Monster | Bonk-stick hits | Hurts you | Behaviour | Drops |
| --- | --- | --- | --- | --- |
| Bramble Boar | 3 | 1½ hearts | Snorts for 0.9 s, then charges in a straight line; step aside and it bonks into the wall, dizzy | 2 boar thorns |
| Murk Moth | 1 | ½ heart | Snuffs lanterns standing under open sky; swoops at you outside | 1 moth shimmer |
| Gloom Gnasher | 2 | 1 heart | Sits like a rock by the crystals, then lunges; backs off from lantern light and poofs in bright light | 1 gloom pearl |
| Grumblefluff | 2 | ½ heart | Chases you and nibbles up to 3 of something from your bag, then runs | 2 fluff and what it took |

You have 5 hearts (10 halves) and get half a heart back every 3 seconds once nothing has hurt you for 6. The bonk-stick does 2 and reaches 2.7 blocks; a paw does 1 and reaches 2; the slingshot flings river pebbles for 2. A knock-out leaves half of every stack (never the tools) where you fell and wakes you beside your bed. Lanterns keep monsters off, walls and doors keep them out, and a snuffed lantern relights with **F**.

**Cosy nights** (a Story valley chosen at the start) has no monsters at all, only dust-bunnies, and swaps the monster drops in recipes and errands: twigs for thorns, fluff for shimmer and a glow crystal for the pearl. **Creative** has every block without end, flying (double-jump), and no creatures.

## Controls

**WASD** or the arrows walk, the mouse looks (click the valley; dragging also works), **Space** jumps, swims up and climbs, holding the left button digs or bonks, the right button places the held block, **1**–**9** and the wheel pick from the hotbar, **F** talks, uses the Workbench, sleeps and relights, **E** opens the bag, **B** checks a burrow, **V** swaps first person and close behind, **Tab** swaps Dora and Enzo, **Esc** pauses. On a touch screen, the left pad walks, dragging the valley looks, a tap digs or bonks, a long press places, and there are Dig, Place, Jump, Use and Bag buttons; phones work held either way. Sound, Music, the view and the look speed are on the menu and the pause panel.

## Saving

Three slots, autosaved every 20 seconds, when the tab is hidden and on leaving, in `cubby-valley-v1`. A slot keeps the seed and only the blocks that differ from the grown valley (run-length packed), plus the bag, hotbar, known patterns, errands, neighbours and their homes, the time, hearts and the stats. A save that doesn't read is ignored.

## Tests

`npm run test:cubby` checks the engine: generation (the same from a seed, everything every valley needs), meshing (exact faces, greedy merging, against a brute-force count), the picking ray, walking, hopping, swimming out, ladders and paths, digging and placing, sand and water, the bag and the Workbench, burrow checks (solid furniture included), errands and saplings, every creature's behaviour, the spawn and light rules, Cosy nights and creative with no monsters, hearts, knock-outs, drops and stolen things returned, and saves (corrupt ones included). `npm run bot:cubby` plays two Story valleys with monsters on, walking real paths, holding to dig, weaving, building burrows, sleeping through nights and fighting with the bonk-stick, until all six neighbours move in and the fair starts (`npm test` runs one with `--quick`). `npm run test:e2e:cubby` checks the browser: the menu, real keyboard and mouse play, the Workbench, an errand, a burrow and a move-in, a night with every monster facing the chinchilla, a bonk-stick fight, a knock-out, Cosy nights and creative, the save across a reload, corrupt saves, the ending, the framing at 1280×800 and 1920×1080 and phones held either way, by touch.
