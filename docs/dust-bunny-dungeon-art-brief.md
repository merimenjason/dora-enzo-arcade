# Dust Bunny Dungeon art brief

Date: 27-10-2026

Every painting the game loads, all from `public/art/dungeon/` as WebP (quality about 82). None exist yet: the game draws each one itself in Canvas 2D until its painting loads, so they can be added one at a time and nothing else needs to change. The list of names is `ART` in `lib/dungeon-scene.ts`; the menu also uses `title`, `player-<dora|enzo>`, `enemy-<kind>` and `tool-<tool>` in `app/dungeon/page.tsx`.

## Style for every image

Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy cellar colours. **Dora** is a cream-white chinchilla with pink ears and ruby eyes; **Enzo** is a grey chinchilla with a pale chest and black eyes. The dust bunnies are round, fluffy, grumpy-cute balls of grey dust with stubby ears and little eyes: mischievous, never scary, no teeth or claws. No text, letters, numbers, logos, frames or UI in any image.

**Sprites** (everything except `title` and `floor-*`) are seen from a slight top-down three-quarter view, on a **transparent** background, centred, filling the square with the feet (or base) about 5% above the bottom edge, with a soft painted contact shadow left out (the game draws its own shadow). They are drawn about 40–60 px on screen, so keep silhouettes bold and readable and details chunky.

## Images

| # | Path | Size | Background | Description |
| --- | --- | --- | --- | --- |
| 1 | `title.webp` | 1600×900 | opaque | Menu banner, shown cropped to a wide strip (focus 50% across, 35% down; the bottom-left third is darkened for the title text, so keep it calm). Dora with a little broom and Enzo with a feather duster at the top of a lantern-lit burrow cellar stair, peering down at a tumble of grey dust bunnies bouncing up the steps; jam jars and roots on the walls, warm lantern glow against cool deep shadow. |
| 2 | `floor-0.webp` | 512×512 | opaque | Root Cellar floor texture, cut by the game into a 4 × 4 grid of 128 px tiles, so it must tile seamlessly in both directions and each 128 px cell should read as one floor square. Packed warm brown earth with tiny pebbles, root threads and soft dust; low contrast so marks drawn on top stay readable. |
| 3 | `floor-1.webp` | 512×512 | opaque | Pantry Tunnels floor, same 4 × 4 seamless tiling. Honey-brown wooden planks with a few oat flakes and crumbs; low contrast. |
| 4 | `floor-2.webp` | 512×512 | opaque | Old Mine floor, same 4 × 4 seamless tiling. Cool blue-grey flagstones with mossy grout and a little coal dust; low contrast. |
| 5 | `player-dora.webp` | 512×512 | transparent | Dora standing ready, facing **right** (the game mirrors her to face left), holding a small straw broom, a tiny tidy kerchief on her head; cream-white fur, pink ears, ruby eyes. |
| 6 | `player-enzo.webp` | 512×512 | transparent | Enzo in the same pose and size, facing **right**, holding a feather duster, a little scarf; grey fur, pale chest, black eyes. |
| 7 | `enemy-fluff.webp` | 512×512 | transparent | Dust Bunny: a small round puff of grey dust with stubby ears and a grumpy pout. |
| 8 | `enemy-hopper.webp` | 512×512 | transparent | Hop Bunny: a pale dusty bunny with long springy ears and pink-lined ears, mid-hop, cheeky grin. |
| 9 | `enemy-roller.webp` | 512×512 | transparent | Tumble Fluff: a tan tumbleweed-like ball of dust and twigs curled up to roll, two eyes peeking out. |
| 10 | `enemy-puffer.webp` | 512×512 | transparent | Puff Bunny: a rosy-pink dust bunny with puffed-out cheeks about to blow a little dust cloud. |
| 11 | `enemy-sneezer.webp` | 512×512 | transparent | Sneezy Bunny: a straw-yellow dust bunny with a pink twitchy nose, eyes squeezed shut mid “ah-choo”. |
| 12 | `enemy-mimic.webp` | 512×512 | transparent | Bale Mimic awake: a golden hay bale with stubby feet, two eyes and a sly smile, wisps of straw sticking out. |
| 13 | `enemy-burrower.webp` | 512×512 | transparent | Burrow Bunny: a brown earthy dust bunny wearing a tiny miner's helmet, popping half out of a hole of loose soil. |
| 14 | `enemy-bigbun.webp` | 512×512 | transparent | Great Dust Bunny (boss, drawn larger): an enormous, very fluffy grey dust bunny with pink inner ears, small grumpy eyes, a few little dust bunnies clinging to its fluff. |
| 15 | `enemy-foreman.webp` | 512×512 | transparent | Mole Foreman (boss): a stout dusty brown mole in a yellow hard hat and work apron, holding a small shovel and a whistle, gruff but comic. |
| 16 | `enemy-king.webp` | 512×512 | transparent | Dust King (boss): a large lavender-grey dust bunny with a tiny gold crown and a dusty velvet cape, holding a feather-duster sceptre, haughty pout. |
| 17 | `bale.webp` | 512×512 | transparent | A plain golden hay bale tied with twine, no face (a Bale Mimic in disguise looks exactly like this). |
| 18 | `crate.webp` | 512×560 | transparent | A small wooden crate with rope handles, a little dusty; drawn slightly taller than a tile so its top shows. |
| 19 | `chest.webp` | 512×540 | transparent | A small round-lidded treasure chest with brass corners and a keyhole, closed. |
| 20 | `stairs.webp` | 512×512 | opaque | Stairs down, seen from above: a square opening in the floor with wooden steps going down into warm lantern light; fills the whole tile. |
| 21 | `prickles.webp` | 512×560 | transparent | A raised prickle trap: four little clumps of green thistle spikes with pink thistle flowers on a square of earth; slightly taller than a tile. |
| 22 | `switch.webp` | 512×512 | transparent | A floor lever on a wooden base, the handle leaning to the **right** with a coral-red knob (the game mirrors it when the traps are down). |
| 23 | `bellows.webp` | 512×512 | transparent | A round leather bellows plate set into the floor, seen from above, with brass rim and four little air vents pointing out. |
| 24 | `key.webp` | 256×256 | transparent | A small brass key with a heart-shaped bow. |
| 25 | `heart.webp` | 256×256 | transparent | A heart charm: a soft pink felt heart stitched with cream thread. |
| 26 | `tool-duster.webp` | 256×256 | transparent | A feather duster with a wooden handle and soft cream and brown feathers. |
| 27 | `tool-sling.webp` | 256×256 | transparent | A little wooden slingshot with a smooth grey pebble in its pouch. |
| 28 | `tool-soap.webp` | 256×256 | transparent | A small bottle of bubble soap with a wand and three iridescent bubbles. |
| 29 | `tool-lantern.webp` | 256×256 | transparent | A small brass lantern glowing warm orange. |
| 30 | `tool-acorn.webp` | 256×256 | transparent | A plump glossy acorn with its cap, one bite-sized nibble taken out. |

The tool and enemy sprites also appear as icons in the HUD tool bar (30 px) and the bestiary (48 px), so they must read at that size.
