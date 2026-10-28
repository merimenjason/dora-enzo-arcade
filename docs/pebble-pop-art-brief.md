# Pebble Pop: art brief

Every image Pebble Pop loads, all under `public/art/pebble/`. None exist yet: until each one loads, the game draws a stand-in in Canvas 2D (or, on the title screen, a plain gradient), so they can be added one at a time.

**Style for all of them:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. **Dora** is a cream-white chinchilla with pink ears and ruby eyes; **Enzo** is a grey chinchilla with a pale chest and black eyes. Crows and badgers are grumpy and a little huffy, never scary. **No text or letters in any image.** WebP, sRGB.

## Title and menu

| File | Size | Transparent | Description |
| --- | --- | --- | --- |
| `title.webp` | 1600 × 1000 | no | Dora and Enzo together holding a hay bale above their heads on a sunny meadow, a smooth grey pebble mid-bounce above them, a few crates and acorn piles popping into wood chips and acorns in the air. A grumpy crow peeks from behind a stack of crates on the right. Keep the lower third calm (the title text sits over it). |
| `pick-dora.webp` | 400 × 400 | no | Dora's portrait card: head and shoulders, cheerful, holding a little wisp of hay, soft meadow green background. |
| `pick-enzo.webp` | 400 × 400 | no | Enzo's portrait card: head and shoulders, a determined grin, a pebble with little blue spin swirls in one paw, soft creek blue background. |

## Places (behind the field)

Drawn to cover the whole screen, centred, under a light dimming. The middle is covered by the playfield, so the interest should sit around the edges and the corners. Leave out characters.

| File | Size | Transparent | Description |
| --- | --- | --- | --- |
| `place-meadow.webp` | 1600 × 1200 | no | The Meadow: rolling green hills, wildflowers (white, yellow, pink), a few hay bales, puffy clouds, morning light. |
| `place-creek.webp` | 1600 × 1200 | no | Pebble Creek: a shallow sparkling creek full of smooth pebbles, reeds, a little wooden footbridge, willow branches. |
| `place-frosty.webp` | 1600 × 1200 | no | Frosty Ridge: snowy pine slopes and pale blue peaks, gentle falling snow, icicles on rocks, cool clear sky. |
| `place-barn.webp` | 1600 × 1200 | no | Badger Barn: a big red barn at golden hour, hay stacks, crates piled by the doors, warm lantern light inside. |

## Blocks

Each block is drawn 30 × 14 game units (about 2.1 : 1), facing the player, filling the image edge to edge with a soft dark outline. Keep them readable at small sizes: bold shapes, little fine detail.

| File | Size | Transparent | Description |
| --- | --- | --- | --- |
| `block-crate.webp` | 120 × 56 | yes | A light wooden crate seen from the front: two planks, a diagonal brace. |
| `block-stout.webp` | 120 × 56 | yes | A darker, sturdier crate with metal corner brackets. |
| `block-stout-cracked.webp` | 120 × 56 | yes | The same stout crate with a big split and a bent bracket. |
| `block-acorn.webp` | 120 × 56 | yes | A neat little heap of four or five shiny acorns in a shallow wooden tray. |
| `block-ice.webp` | 120 × 56 | yes | A clear pale-blue ice block with a white glint. |
| `block-ice-cracked.webp` | 120 × 56 | yes | The same ice block with white cracks across it. |
| `block-dust.webp` | 120 × 56 | yes | A soft cream dust cloud, lumpy and fluffy, with two tiny dot eyes (a sleepy dust bunny). |
| `block-moss.webp` | 120 × 56 | yes | A cushion of bright moss on a small stone, with a couple of tiny sprouts. |
| `block-chain.webp` | 120 × 56 | yes | A grey stone block with two linked iron rings and a little golden spark on it. |
| `block-slide.webp` | 120 × 56 | yes | A light crate on two tiny wheels, with little arrow notches on each side (no letters). |

## On the field

| File | Size | Transparent | Description |
| --- | --- | --- | --- |
| `bale.webp` | 320 × 56 | yes | A long golden hay bale seen from the front, rounded ends, two bands of red twine. It is stretched in three slices: the left and right 42 px (the rounded ends) stay their shape and the middle stretches, so keep the middle even. |
| `hold-dora.webp` | 256 × 256 | yes | Dora standing upright facing right, both paws raised as if holding up the end of a bale, happy. Her feet sit at about 75% of the image height, horizontally centred; nothing below the feet. |
| `hold-enzo.webp` | 256 × 256 | yes | Enzo in the same pose and framing as Dora, facing right, a cheeky grin. |
| `pebble.webp` | 64 × 64 | yes | A smooth round grey river pebble with a soft highlight, filling the image. |
| `acorn.webp` | 64 × 64 | yes | A single glossy acorn with its cap, upright, filling the image. |
| `crow-peek.webp` | 128 × 128 | yes | A grumpy black crow peeking in from the left edge, facing right, frowning eyebrows, orange beak, centred. |
| `badger-peek.webp` | 128 × 128 | yes | A grumpy badger face peeking in from the left edge, facing right, white stripe, huffy expression, centred. |

## Bosses

Drawn 160 × 84 game units over the boss's place at the top of the field, swaying side to side; its rows of blocks are drawn separately just below, so the creature should look like it is holding them up from above (paws or feet towards the bottom edge). Facing the player.

| File | Size | Transparent | Description |
| --- | --- | --- | --- |
| `boss-captain-caw.webp` | 640 × 336 | yes | Captain Caw: a plump black crow with a little blue captain's hat with a gold band, wings spread wide, crossly squawking, feet gripping downwards. |
| `boss-frostwhisker.webp` | 640 × 336 | yes | Frostwhisker: a grey badger with frosty white whiskers and a knitted ice-blue hat, a scarf, paws reaching down, grumbling. |
| `boss-big-bramble.webp` | 640 × 336 | yes | Big Bramble: a big round badger in a red farmer's cap and dungarees, paws braced downwards, puffing his cheeks, huffy but secretly soft. |

That is 27 images.

*Written 27-10-2026.*

## Painted (27-10-2026)

Painted with the built-in image generation tool only. No paid CLI/API fallback was used. Six good existing images were retained unchanged; the mismatched cracked stout crate was repainted. The other twenty missing images were painted. Existing generation prompts were not available from the interrupted run, so none are invented below.

References: `public/art/disco/dancer-dora-idle.webp` and `dancer-enzo-idle.webp` for exact character designs; `public/art/disco/venue-burrow.webp` for the painting style. The stout crate also referenced its intact counterpart; portrait refinements referenced the existing character/card art; the title composition refinement referenced the first title render.

Processing: transparent subjects were generated on flat green `#00ff00`, except green moss on magenta `#ff00ff`. Pillow and NumPy removed the matte, unmixed spill from soft edges, cropped to the subject and used Lanczos sizing. Blocks, bale and filled icons occupy their target box; other cutouts preserve aspect and are centered, with the holders’ feet centered at 75% height. Opaque images used `ImageOps.fit` with Lanczos. New/replaced files were saved as sRGB WebP at quality 88; retained originals were not recompressed (their historical encoder quality is unavailable).

Validation: every WebP was reopened and fully decoded; all exact dimensions and RGB/RGBA modes passed. All cutouts were viewed on mid-dark `#393946`; no chroma fringe was visible and no strong visible key-color remnants were detected. Small assets were also reviewed at the renderer’s actual approximate game sizes: blocks 30 × 14 (32 × 16 including overdraw), pebble 10 px, acorns 18 px, holders 34–38 px, peekers 39–45 px, bosses 160 × 84. The bale was checked at 14 px high and with its 42 px fixed ends separated from a stretched middle. No text, letters or numbers appear in the art.

### Validation table

| File | Size | Mode | Notes |
| --- | --- | --- | --- |
| `title.webp` | 1600 × 1000 | RGB | Composition reviewed for a quiet lower third; exact character references. |
| `pick-dora.webp` | 400 × 400 | RGB | Retained original; reference-matched cream fur, ruby eyes and hay wisp. |
| `pick-enzo.webp` | 400 × 400 | RGB | Black eyes, grey fur, pale chest, pebble and blue swirls; matches Enzo reference. |
| `place-meadow.webp` | 1600 × 1200 | RGB | Retained original; flowers, hay, morning hills and clear middle. |
| `place-creek.webp` | 1600 × 1200 | RGB | Pebbles, reeds, footbridge, willow branches; open middle. |
| `place-frosty.webp` | 1600 × 1200 | RGB | Retained original; snowy pines, blue peaks and icicles. |
| `place-barn.webp` | 1600 × 1200 | RGB | Retained original; red barn, crates, hay and lantern glow. |
| `block-crate.webp` | 120 × 56 | RGBA | Retained original; readable at 30 × 14. |
| `block-stout.webp` | 120 × 56 | RGBA | Retained original; dark wood and metal corners, readable at 30 × 14. |
| `block-stout-cracked.webp` | 120 × 56 | RGBA | Repainted to match intact dark stout crate, with split and bent bracket; 30 × 14 checked. |
| `block-acorn.webp` | 120 × 56 | RGBA | Tray and acorn heap readable at 30 × 14. |
| `block-ice.webp` | 120 × 56 | RGBA | Pale blue, clear glint; 30 × 14 checked. |
| `block-ice-cracked.webp` | 120 × 56 | RGBA | Prominent white cracks; 30 × 14 checked. |
| `block-dust.webp` | 120 × 56 | RGBA | Cream fluffy silhouette and two eyes; 30 × 14 checked. |
| `block-moss.webp` | 120 × 56 | RGBA | Magenta keyed to preserve moss greens; 30 × 14 checked. |
| `block-chain.webp` | 120 × 56 | RGBA | Linked rings and gold spark readable at 30 × 14. |
| `block-slide.webp` | 120 × 56 | RGBA | Revised for clear arrow notches; wheels and crate readable at 30 × 14. |
| `bale.webp` | 320 × 56 | RGBA | Revised twine placement; 42 px end slices and stretched middle visually checked; 14 px high preview. |
| `hold-dora.webp` | 256 × 256 | RGBA | Feet centered at x ≈ 128, baseline y = 192; no pixels below; 38 px preview. |
| `hold-enzo.webp` | 256 × 256 | RGBA | Same framing and baseline as Dora; 34–38 px previews. |
| `pebble.webp` | 64 × 64 | RGBA | Round smooth highlight; readable at 10 px. |
| `acorn.webp` | 64 × 64 | RGBA | Upright cap and glossy nut; readable at 18 px. |
| `crow-peek.webp` | 128 × 128 | RGBA | Right-facing huffy crow, orange beak; 39–45 px preview. |
| `badger-peek.webp` | 128 × 128 | RGBA | Right-facing white-striped huffy badger; 45 px preview. |
| `boss-captain-caw.webp` | 640 × 336 | RGBA | Blue/gold hat, wide wings, squawk, gripping feet; 160 × 84 preview. |
| `boss-frostwhisker.webp` | 640 × 336 | RGBA | Blue knit hat/scarf, frosty whiskers, reaching paws; 160 × 84 preview. |
| `boss-big-bramble.webp` | 640 × 336 | RGBA | Red cap, dungarees, puffed cheeks and braced paws; 160 × 84 preview. |

### Exact prompts

Each distinct prompt is reproduced verbatim below, including discarded variants and requests that timed out. Identical retries reused the same prompt. Longer portrait and creek requests repeatedly timed out; the shorter versions succeeded. The final bale and slide prompts replaced their first renders. The six retained originals have no recoverable prompt record.

#### Prompt 01 · `title.webp`

```text
Use case: illustration-story. Paint title.webp, a 1600×1000 opaque landscape illustration for Pebble Pop. Reference images 1 and 2 are Dora and Enzo: match their exact character designs, proportions, fur colors and eyes. Reference 3 supplies the painting style: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Dora and Enzo together holding a hay bale above their heads on a sunny meadow, a smooth grey pebble mid-bounce above them, a few crates and acorn piles popping into wood chips and acorns in the air. A grumpy crow peeks from behind a stack of crates on the right. Keep the lower third calm, open meadow. No text, letters, numbers, logos or watermark.
```

#### Prompt 02 · `pick-enzo.webp`

```text
Use case: illustration-story. Paint pick-enzo.webp, a 400×400 game asset for Pebble Pop. Input images 1 and 2 are exact Dora and Enzo character design references; match their proportions, faces, fur and eyes exactly if present. Image 3 supplies the warm hand-painted toon storybook painting style, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Enzo's portrait card: head and shoulders, a determined grin, a pebble with little blue spin swirls in one paw, soft creek blue background. Opaque background, fully painted to the edges.  No text, letters, numbers, logos or watermark.
```

#### Prompt 03 · `place-creek.webp`

```text
Use case: illustration-story. Paint place-creek.webp, a 1600×1200 game asset for Pebble Pop. Input images 1 and 2 are exact Dora and Enzo character design references; match their proportions, faces, fur and eyes exactly if present. Image 3 supplies the warm hand-painted toon storybook painting style, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Pebble Creek: a shallow sparkling creek full of smooth pebbles, reeds, a little wooden footbridge, willow branches. Opaque background, fully painted to the edges. No characters. Keep the middle quiet for the playfield, interest around edges and corners. No text, letters, numbers, logos or watermark.
```

#### Prompt 04 · `block-acorn.webp`

```text
Use case: illustration-story. Paint block-acorn.webp, a 120×56 game asset for Pebble Pop. Input images 1 and 2 are exact Dora and Enzo character design references; match their proportions, faces, fur and eyes exactly if present. Image 3 supplies the warm hand-painted toon storybook painting style, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A neat little heap of four or five shiny acorns in a shallow wooden tray. Single isolated subject on a perfectly flat uniform pure green #00ff00 background. No ground shadow, no gradient, no green reflected light. Block silhouette should fill a wide 30:14 box edge to edge; bold simple shapes readable at 30×14, front facing, soft dark outline. No text, letters, numbers, logos or watermark.
```

#### Prompt 05 · `block-ice.webp`

```text
Use case: illustration-story. Paint block-ice.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A clear pale-blue ice block with a white glint. Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 06 · `block-ice-cracked.webp`

```text
Use case: illustration-story. Paint block-ice-cracked.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: The same ice block with white cracks across it. Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 07 · `block-dust.webp`

```text
Use case: illustration-story. Paint block-dust.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A soft cream dust cloud, lumpy and fluffy, with two tiny dot eyes (a sleepy dust bunny). Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 08 · `block-moss.webp`

```text
Use case: illustration-story. Paint block-moss.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A cushion of bright moss on a small stone, with a couple of tiny sprouts. Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure magenta #ff00ff chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 09 · `block-chain.webp`

```text
Use case: illustration-story. Paint block-chain.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A grey stone block with two linked iron rings and a little golden spark on it. Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 10 · `block-slide.webp`

```text
Use case: illustration-story. Paint block-slide.webp, 120×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A light crate on two tiny wheels, with little arrow notches on each side (no letters). Front facing block, wide 30:14 silhouette filling the image edge to edge with a soft dark outline. Bold shapes, little fine detail; must read clearly at 30×14 game size. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 11 · `bale.webp`

```text
Use case: illustration-story. Paint bale.webp, 320×56 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A long golden hay bale seen from the front, rounded ends, two bands of red twine. It is stretched in three slices: the left and right 42 px (the rounded ends) stay their shape and the middle stretches, so keep the middle even. Very wide 320:56 silhouette. Rounded ends occupy 42px each, keep the middle even for three-slice stretching. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 12 · `hold-dora.webp`

```text
Use case: illustration-story. Paint hold-dora.webp, 256×256 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Dora standing upright facing right, both paws raised as if holding up the end of a bale, happy. Her feet sit at about 75% of the image height, horizontally centred; nothing below the feet. Full body character facing right, both paws above head, feet horizontally centered at 75% of final square image height; nothing below feet. Keep character proportions exactly from references. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 13 · `hold-enzo.webp`

```text
Use case: illustration-story. Paint hold-enzo.webp, 256×256 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Enzo in the same pose and framing as Dora, facing right, a cheeky grin. Full body character facing right, both paws above head, feet horizontally centered at 75% of final square image height; nothing below feet. Keep character proportions exactly from references. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 14 · `pebble.webp`

```text
Use case: illustration-story. Paint pebble.webp, 64×64 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A smooth round grey river pebble with a soft highlight, filling the image.  Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 15 · `acorn.webp`

```text
Use case: illustration-story. Paint acorn.webp, 64×64 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A single glossy acorn with its cap, upright, filling the image.  Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 16 · `crow-peek.webp`

```text
Use case: illustration-story. Paint crow-peek.webp, 128×128 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A grumpy black crow peeking in from the left edge, facing right, frowning eyebrows, orange beak, centred.  Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 17 · `badger-peek.webp`

```text
Use case: illustration-story. Paint badger-peek.webp, 128×128 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: A grumpy badger face peeking in from the left edge, facing right, white stripe, huffy expression, centred.  Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 18 · `boss-captain-caw.webp`

```text
Use case: illustration-story. Paint boss-captain-caw.webp, 640×336 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Captain Caw: a plump black crow with a little blue captain's hat with a gold band, wings spread wide, crossly squawking, feet gripping downwards. Facing the player, wide 160:84 silhouette, feet or paws at the bottom edge as if holding rows of blocks below. Full creature visible, no pedestal or scenery. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 19 · `boss-frostwhisker.webp`

```text
Use case: illustration-story. Paint boss-frostwhisker.webp, 640×336 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Frostwhisker: a grey badger with frosty white whiskers and a knitted ice-blue hat, a scarf, paws reaching down, grumbling. Facing the player, wide 160:84 silhouette, feet or paws at the bottom edge as if holding rows of blocks below. Full creature visible, no pedestal or scenery. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 20 · `boss-big-bramble.webp`

```text
Use case: illustration-story. Paint boss-big-bramble.webp, 640×336 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Big Bramble: a big round badger in a red farmer's cap and dungarees, paws braced downwards, puffing his cheeks, huffy but secretly soft. Facing the player, wide 160:84 silhouette, feet or paws at the bottom edge as if holding rows of blocks below. Full creature visible, no pedestal or scenery. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.
```

#### Prompt 21 · `block-stout-cracked.webp`

```text
Use case: illustration-story. Paint a replacement block-stout-cracked.webp game sprite, 120×56 aspect ratio. Reference image 1 is the INTACT stout crate; preserve its exact dark brown horizontal planks, rectangular shape, lighting, metal corner brackets and absence of diagonal bracing. Add one big split through its wood and a visibly bent corner bracket. Reference image 2 supplies warm hand-painted toon storybook style, soft cel shading and fine brown ink edges. Front view, bold simple shapes readable at 30×14. Wide rectangular block fills edge to edge with a soft dark outline. Single isolated object on perfectly flat uniform pure green #00ff00 chroma background, no shadow, no gradient, no green reflection. No text, letters, numbers or watermark.
```

#### Prompt 22 · `pick-enzo.webp`

```text
Paint a 400×400 opaque square character portrait card. Use the exact Enzo chinchilla design from both reference images: grey fur, pale chest, huge pink ears and black eyes. Head and shoulders, determined grin, holding a smooth grey pebble in one paw with little blue spin swirls. Soft creek-blue background. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers or watermark.
```

#### Prompt 23 · `bale.webp`

```text
Paint one isolated long golden hay bale from the front, wide and shallow 320:56 aspect. Rounded ends. Exactly two bands of red twine, one at 10% and one at 90% of the width, both entirely inside the outer 13% end zones. Middle 74% must be even golden horizontal hay, no bands or distinct features, for a stretching game paddle. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges. Fill the wide image edge to edge. Perfectly flat uniform pure green #00ff00 chroma background, no shadow, no green reflection. No text, letters, numbers or watermark.
```

#### Prompt 24 · `block-slide.webp`

```text
Paint a front-facing light wooden crate on exactly two tiny visible wooden wheels for a brick-breaker game. Wide shallow 120:56 aspect, bold simple shapes readable at 30×14. Large clear carved LEFT pointing arrow notch on the left side plank, large clear carved RIGHT pointing arrow notch on the right side plank. Arrows are simple pictograms, no letters. Match reference crate wood and reference 2 warm hand-painted toon storybook style, soft cel shading, fine brown edges. Isolated subject fills frame edge to edge. Perfectly flat uniform pure green #00ff00 chroma background, no shadow, no green reflection. No text, letters, numbers or watermark.
```

#### Prompt 25 · `place-creek.webp`

```text
Paint an opaque 4:3 landscape background for a cosy storybook game, Pebble Creek: shallow sparkling water full of smooth pebbles, reeds, a little wooden footbridge, willow branches. Interest around the outer edges and corners; quiet open middle for the playfield. No characters. Match the supplied painting reference: warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. No text, letters, numbers or watermark.
```

#### Prompt 26 · `place-creek.webp`

```text
Paint a shallow sparkling creek full of smooth pebbles, with reeds, a little wooden footbridge and willow branches. Wide storybook game background, quiet open middle, details near edges, no characters. Match the warm hand-painted style of this reference. No text.
```

#### Prompt 27 · `pick-enzo.webp`

```text
Paint the grey chinchilla Enzo from reference 1 as a portrait card in the style and framing of reference 2. Head and shoulders, determined grin, holding a smooth pebble in one paw, little blue spin swirls around the pebble. Soft creek blue background. Match Enzo exactly: grey fur, pale chest, black eyes, big pink ears. Warm hand-painted storybook. No text, letters or numbers.
```

#### Prompt 28 · `pick-enzo.webp`

```text
Paint this exact grey chinchilla's cheerful determined head-and-shoulders portrait, holding a little pebble with blue spin swirls in one paw, against a soft creek-blue background. Warm hand-painted toon storybook style. No text.
```

#### Prompt 29 · `title.webp`

```text
Paint a wide 1600×1000 storybook game title illustration. Match Dora and Enzo exactly from reference images 1 and 2, and warm hand-painted style from reference 3. In the UPPER TWO THIRDS ONLY: cream ruby-eyed Dora and grey black-eyed Enzo together holding a hay bale above their heads on a sunny meadow, smooth grey pebble bouncing above them, crates and acorn piles popping into chips and flying acorns. A huffy crow peeks behind crates on the right. Keep ALL characters, crates and action above the lower third. The entire LOWER THIRD must be calm low-detail soft meadow grass, empty space for a title overlay. Cosy and kind, soft cel shading, fine brown ink edges. No text, letters, numbers or watermark.
```

#### Prompt 30 · `pick-enzo.webp`

```text
Paint Enzo's square portrait card for Pebble Pop, 400×400 opaque. Image 1 is Enzo: match this exact grey chinchilla, pale chest, huge pink ears, fluffy tail, black eyes and face. Head and shoulders, determined cheerful grin, holding a smooth grey pebble with little blue spin swirls in one paw. Soft creek-blue background. Image 2 is the warm hand-painted storybook style reference; soft cel shading and fine brown ink edges, cosy and kind. No text, letters or numbers.
```

#### Prompt 31 · `pick-enzo.webp`

```text
Paint a square head-and-shoulders portrait of the exact grey chinchilla in the reference image: Enzo, pale chest, black eyes, huge pink ears, determined cheerful grin, a smooth grey pebble in one paw with small blue spin swirls. Soft creek-blue background. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy and kind. No text, letters, numbers or watermark.
```

#### Prompt 32 · `title.webp`

```text
Paint a sunny meadow storybook game title scene in this reference style. These exact Dora and Enzo chinchillas hold a hay bale overhead together; a grey pebble bounces above, crates and acorns pop into flying wood chips, a grumpy crow peeks behind crates at the right. Compose ALL the action in the upper two thirds. Leave the entire lower third empty calm low-detail meadow for a title overlay. No text.
```

#### Prompt 33 · `title.webp`

```text
Repaint this scene with all the characters, crates and action smaller and entirely within the upper two thirds. Leave the entire lower third calm empty soft meadow grass. Preserve these exact character designs and this painting style. No text.
```

#### Prompt 34 · `title.webp` (final composition)

The reference was the first title render resized to 800 × 500 with Lanczos for this request.

```text
Repaint this illustration with its entire scene in the upper two thirds and a completely calm empty meadow in the lower third. Keep the exact characters and painting style. No text.
```


## Enzo repaint (28-10-2026)

Used only the built-in image generation tool, one image at a time. No CLI/API fallback or API key was used. No code or CHANGELOG.md was edited; nothing was committed.

Every generation used these three identity references: `public/art/enzo.jpeg` (real photo), `public/art/command/portrait-enzo.webp`, and `public/art/safari/walker-enzo.webp`. The current image being replaced was also supplied for its pose, composition, props and painting style, never as an identity-colour reference. Disco calls additionally supplied the matching `public/art/disco/dancer-dora-<pose>.webp` for scale and feet placement. No disco Enzo dancer was used as an identity reference.

### Files and outcomes

- `public/art/pebble/hold-enzo.webp` — Repainted and saved.
- `public/art/pebble/pick-enzo.webp` — Repainted and saved.
- `public/art/pebble/title.webp` — Repainted and saved.

Completed images were saved as WebP quality 88, preserving exact original pixel size and RGB/RGBA mode, and reopened and fully decoded to assert those properties. Originals were copied before replacement to `/tmp/enzo-old/<game>-<name>.webp`. Transparent sprites were generated on flat pure green #00ff00, keyed with Pillow and numpy, with green spill unmixed from soft edges, resampled with Lanczos into the original subject bounds and baseline, and checked after WebP encoding for chroma fringe. Opaque images used `ImageOps.fit` with Lanczos. Saved results were visually compared beside the originals on a dark purple background. Enzo has cool grey fur and black eyes (original closed eyes and dizzy spirals retained); props and poses were retained.

All three generations succeeded on their initial calls. The title retains Dora and the original scene arrangement; generated repainting may introduce small brushwork differences outside Enzo.

### Exact prompts used

Each block is the exact submitted string; identical timeout retries reused it unchanged.

#### `public/art/pebble/hold-enzo.webp`

```text
Use case: illustration-story. Paint hold-enzo.webp, 256×256 game sprite for Pebble Pop. Reference images 1 and 2 show exact Dora and Enzo designs; match faces, proportions, fur, ears and eyes exactly if present. Reference image 3 supplies painting style. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy and kind. Subject: Enzo in the same pose and framing as Dora, facing right, a cheeky grin. Full body character facing right, both paws above head, feet horizontally centered at 75% of final square image height; nothing below feet. Keep character proportions exactly from references. Single isolated subject on a perfectly flat uniform pure green #00ff00 chroma background. No background texture, gradient, cast shadow or colored reflected spill. No text, letters, numbers, logos or watermark.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo are identity colour references only; no copying clothes or props. Image 4 is the CURRENT EDIT TARGET and defines exact pose, silhouette, composition, props, background and painting style. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, solid jet BLACK eyes with white glints. No brown iris, lower-eye crescent or warm eye reflection. Never taupe, beige or brown fur. Preserve Dora EXACTLY as she is, cream-white, ruby eyes, pink ears. Preserve everything else including framing and all background details. Supersede original reference instructions. Perfectly flat uniform pure green #00ff00 chroma background, no spill, gradient or shadow. Match old subject bounding box and feet baseline exactly on 256x256 canvas.
```

#### `public/art/pebble/pick-enzo.webp`

```text
Paint a square head-and-shoulders portrait of the exact grey chinchilla in the reference image: Enzo, pale chest, black eyes, huge pink ears, determined cheerful grin, a smooth grey pebble in one paw with small blue spin swirls. Soft creek-blue background. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy and kind. No text, letters, numbers or watermark.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo are identity colour references only; no copying clothes or props. Image 4 is the CURRENT EDIT TARGET and defines exact pose, silhouette, composition, props, background and painting style. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, solid jet BLACK eyes with white glints. No brown iris, lower-eye crescent or warm eye reflection. Never taupe, beige or brown fur. Preserve Dora EXACTLY as she is, cream-white, ruby eyes, pink ears. Preserve everything else including framing and all background details. Supersede original reference instructions.
```

#### `public/art/pebble/title.webp`

```text
Repaint this illustration with its entire scene in the upper two thirds and a completely calm empty meadow in the lower third. Keep the exact characters and painting style. No text.

EDIT OVERRIDE: Image 1 real Enzo photo, 2 command portrait-enzo, 3 safari walker-enzo are identity colour references only; no copying clothes or props. Image 4 is the CURRENT EDIT TARGET and defines exact pose, silhouette, composition, props, background and painting style. Change ONLY Enzo colours: COOL BLUE-GREY chinchilla, mid-grey coat, darker grey wavy back, pale grey-white face and chest, pink ears, solid jet BLACK eyes with white glints. No brown iris, lower-eye crescent or warm eye reflection. Never taupe, beige or brown fur. Preserve Dora EXACTLY as she is, cream-white, ruby eyes, pink ears. Preserve everything else including framing and all background details. Supersede original reference instructions.
```
