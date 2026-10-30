# Kiln & Clay · art brief

Paintings for Kiln & Clay (`/pottery`), a cosy pottery workshop game. Dora and Enzo run a little hillside pottery: the valley's neighbours leave orders on the board, and the two of them throw pots on the wheel, glaze them, fire them in the kiln and deliver them. The game draws the wheel, the clay, the pots, the glazes, the kiln's dial and the shelves itself, and draws its own stand-in for every image until the file loads, so the images can arrive in any order. Written 30-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, a cosy workshop palette (terracotta, warm wood, cream plaster, soft hill greens and sky blue through the window, the kiln's orange glow), matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`. **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, smooth and rounded, and clean pink ear insides with nothing standing up from the head. Never use the Hayloft Tycoon portraits as a reference. No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown). Neither wears clothes, except a small clay-smudged canvas apron where noted. All files live in `public/art/pottery/` as `.webp` (quality about 88).

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | Inside the little hillside pottery on a sunny morning. Enzo sits at the potter's wheel with wet clay on his paws, a half-thrown pot spinning; Dora beside him holds up a finished glazed vase, proudly. Shelves of pots, a round window over green hills, the brick kiln glowing at one side. Dora and Enzo large in the upper middle; the lower third calmer (floorboards, a workbench) for text. |
| `workshop.webp` | The workshop backdrop the wheel sits in front of: cream plaster walls and warm wood, shelves of finished and unfired pots at the far left and right, a round window in the upper middle looking out over green hills and blue sky, hanging tools, the kiln's glow at one edge. The middle of the lower two-thirds is calm and plain (soft wall and a little floor), because the game draws the wheel and the pot there. No characters, no wheel. |
| `kiln.webp` | A close-up of the brick kiln for the firing: a round-topped brick kiln filling most of the image, its little iron door open and glowing orange-gold inside, a stack of firewood and a pair of bellows at one side, warm light on the floorboards. The very middle of the glowing door is plain glow (the game draws the pots and the dial). No characters. |
| `ending.webp` | The whole valley's picnic on a sunny hillside: a big checked blanket, a beautiful glazed tea set (a round teapot and many cups, a honey pot, a big bowl of berries) all made in the pottery, Dora and Enzo in the middle pouring tea, and the neighbours gathered round: a hedgehog, a mother duck and ducklings, a badger baker with a pie, a tall heron, a red squirrel, a rabbit and an owl. Warm, happy and peaceful. Dora and Enzo large and clear in the middle. |

## Dora and Enzo at the wheel (green screen, 1536 × 1024)

Three moods of the pair, painted together on one canvas and split apart in the game: **Dora on the left half** facing right, **Enzo on the right half** facing left, both turned towards the empty middle where the wheel would be, with a wide band of plain green between them. Each is shown from the waist up, wearing a small clay-smudged canvas apron, the bottom of each figure cut straight across at the bottom edge of the image (as if behind a counter). Background: a perfectly flat, uniform pure green (#00FF00), no shadow, no props, no wheel.

| File | Description |
| --- | --- |
| `pair-focus.webp` | Watching the clay closely, concentrating: paws held up ready, eyes intent, a tiny tongue-tip for Enzo. |
| `pair-cheer.webp` | Both cheering, forepaws raised high, eyes shut with joy. |
| `pair-oops.webp` | A funny wince after the clay flops: paws to their cheeks, ears back, a splash of clay on Enzo's nose. |

## The neighbours (green screen, 1024 × 1024)

Happy head-and-shoulders portraits of the customers, each facing a little to the left, on a perfectly flat, uniform pure green (#00FF00), bottom of the figure cut straight across at the bottom edge.

| File | Who |
| --- | --- |
| `cust-hedgehog.webp` | Mrs Prickle, a round little hedgehog in a flowery headscarf, beaming. |
| `cust-duck.webp` | Mother Duck, a white duck with a blue bonnet, two fluffy yellow ducklings peeking beside her. |
| `cust-badger.webp` | Bramble, a jolly badger baker in a white baker's hat, flour on his nose. |
| `cust-heron.webp` | Professor Heron, a tall grey heron with little round spectacles, elegant and pleased. |
| `cust-squirrel.webp` | Hazel, a red squirrel with a big fluffy tail curled up behind her, holding an acorn. |
| `cust-rabbit.webp` | Clover, a soft brown rabbit with a daisy behind one ear, smiling. |
| `cust-owl.webp` | Old Mr Hoot, a round tawny owl with a knitted scarf, kindly. |

## In the game

The green is keyed out with Pillow (a soft edge and green despill) and each figure is trimmed. The two halves of each `pair-*` painting are cut apart at the widest green gap, trimmed, and scaled so every mood of a chinchilla has the same height, standing on the bottom edge (`dora-<mood>.webp` and `enzo-<mood>.webp`, 640 × 640). The customer portraits are trimmed and fitted to 640 × 640 on the bottom edge. A mood that fails to load borrows `focus`; a missing customer is drawn as a simple round face; and the drawn chinchillas stand in until any painting arrives.

## What shipped

Every painting above was made except the title: the image tool timed out on it three times, the last with a much simpler prompt, so `title.webp` is put together from the workshop backdrop with the cheering Dora and Enzo cut-outs in front. The ending was also simplified after two time-outs: Dora and Enzo's picnic with the tea set, without the neighbours. `kiln.webp` is cropped so the kiln door sits in the middle of the frame, where the game draws the pots.
