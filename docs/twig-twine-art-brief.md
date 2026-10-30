# Twig & Twine · art brief

Paintings for Twig & Twine (`/bridges`), a cosy physics bridge-building puzzle. Spring floods have washed away the paths of the valley, and Dora and Enzo rebuild the crossings with twigs, planks, twine and bamboo, then ride across in their little acorn cart. The game draws the banks, the water, the bridges, the cart's wheels and the stress colours itself, and draws its own stand-in for every image until the file loads, so the images can arrive in any order. Written 30-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`. **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, smooth and rounded, and clean pink ear insides. Never use the Hayloft Tycoon portraits as a reference. No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown). Neither wears clothes. All files live in `public/art/bridges/` as `.webp` (quality about 88).

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | A spring valley after the floods, golden morning. A brook runs through the middle under a newly built little bridge of twigs, planks and twine (triangles of twigs under a plank deck). Dora and Enzo ride across it in a small cart made from a big acorn, with round wooden wheels; Enzo holds a coil of twine, Dora waves. Willows, wildflowers, a heron watching. Keep the lower third calmer (water and grass) for text. |
| `bg-brook.webp` | Willow Brook backdrop, seen side-on: a soft morning sky, far rolling green hills, weeping willows and wildflowers at the far left and right edges. The middle third and the whole lower half are quiet and open (soft distant meadow and sky), because the game draws the banks, the gap and the bridge over it. No near ground, no water, no bridge. |
| `bg-ravine.webp` | Mossy Ravine backdrop, side-on: misty green-blue gorge walls far away, ferns and mossy boulders and bamboo at the far left and right edges, a thin waterfall far in the distance, soft light shafts. Middle and lower half calm and misty. No near ground, no bridge. |
| `bg-marsh.webp` | Reed Marsh backdrop, side-on: a wide pale-gold sky over a flat marsh, tall reeds and cattails and a dragonfly at the far left and right edges, a few distant pools and a far windmill-free horizon with low trees. Middle and lower half calm. No near ground, no bridge. |
| `bg-canyon.webp` | Sunset Canyon backdrop, side-on: warm orange and rose sunset sky, layered red-rock mesas and buttes far away, a few wind-bent pines at the far left and right edges. Middle and lower half calm. No near ground, no bridge. |
| `ending.webp` | The great canyon at sunset, the finale crossed: a long, beautiful suspension bridge of bamboo, planks and twine spans the canyon behind them; Dora and Enzo sit together on the far rim beside their acorn cart, watching the sun go down, with a small picnic of seeds. Warm, proud and peaceful. |

## Dora and Enzo in the acorn cart (green screen, 1024 × 1024, side view, facing **right**)

Four poses of the same cart and the same pair, so the game can swap them while the cart rolls. The cart is the bottom half of a big glossy brown acorn shell (the cap is behind them, like a seat back), with a little wooden axle board under it and **no wheels** (the game draws spinning wheels). Dora sits at the front (right), Enzo just behind her (left), both looking right. The whole cart is in frame and fills about 80% of the width, its bottom edge near the bottom of the image. Background: a perfectly flat, uniform pure green (#00FF00), no shadow, no ground.

| File | Description |
| --- | --- |
| `cart-ride.webp` | Riding along happily, paws on the rim of the cart, ears up. |
| `cart-cheer.webp` | Both cheering, forepaws raised high, eyes shut with joy. |
| `cart-nervous.webp` | Both covering their eyes with their forepaws, ears flat, a little nervous (funny, not scared). |
| `cart-soggy.webp` | Soggy after a splash: fur damp and droopy, drips falling, a little pond weed on Enzo's ear, both blinking and comically dismayed. |

**Status (31-10-2026):** every painting above is in place. `cart-soggy.webp` came on the fifth try (31-10-2026), with Enzo's irises darkened to black by hand; the scene shows it after a fall into water or the stream, with drips drawn over it, and the eyes-covered pose after a tumble into the canyon's dust.

## In the game

The green is keyed out with Pillow (a soft edge and green despill), and each pose is trimmed and scaled so the cart is the same width in every pose, on a 768 × 512 canvas with the cart's bottom 24 pixels above the bottom edge. The scene draws the two wheels under the cart and spins them as it rolls. A pose that fails to load borrows `cart-ride`, and drawn chinchillas in a drawn cart stand in until any painting arrives.
