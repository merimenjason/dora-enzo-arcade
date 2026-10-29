# Echo Burrow · art brief

Paintings for Echo Burrow (`/echo`), a side-on time-loop puzzle platformer. Dora and Enzo find their way home through thirty burrow rooms in five chapters. One of them records a run while a candle burns; then time rewinds and the other plays beside a teal "echo" that repeats the first run exactly. The game draws its own stand-in for every image until the file loads, so the images can arrive in any order. The game draws the rooms (rock, ledges, plates, doors, crates, seesaws) and tints the echo itself. Written 30-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy underground colours (earth, lantern light, glowing moss), matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`. **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, NO spiky tufts, cowlicks or forelocks anywhere on the head, and clean pink ear insides with NO fluffy ear tufts. Never use the Hayloft Tycoon portraits as a reference (they have these tufts). No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown). Neither wears clothes. Export as `.webp` (quality about 88). All files live in `public/art/echo/`.

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | A cosy lantern-lit burrow tunnel: Dora in front, mid-hop, and just behind her a glowing see-through teal copy of her (her echo) in the same pose a moment earlier; Enzo beside them looking amazed. A tall candle burns on a stone ledge, roots hang from the earth ceiling, a round wooden burrow door glows warm in the far distance. Keep the lower third calmer. |
| `ending.webp` | Home at last: inside a snug round burrow room with a crackling little stove, a rag rug and shelves of seeds, Dora and Enzo curled up side by side on a cushion, eyes closed, content; a candle burnt down to a stub on the shelf, the round front door shut behind them. |

## Chapter backgrounds (opaque, 1536 × 1024, landscape)

The far back wall of each chapter's burrow rooms, seen straight on. The game draws rock, ledges and everything you stand on over the top, so keep these **soft, muted, low in contrast and fairly dark**, with no ledges, platforms or big objects across the middle, and no characters.

| File | Description |
| --- | --- |
| `bg-cellar.webp` | The Root Cellar: packed earth wall with old roots threading through it, a few jars and a sack at the edges, warm amber lantern light. |
| `bg-hollow.webp` | Mushroom Hollow: a purple-brown cave wall with clusters of soft glowing mushrooms (pink, orange, lilac) at the edges, spores drifting. |
| `bg-brook.webp` | The Underground Brook: cool blue-grey stone with wet streaks, a thin waterfall far back on one side, ripples of reflected light. |
| `bg-gallery.webp` | The Crystal Gallery: a deep violet cave with pale crystals glinting in the far rock, faint beams of teal and lilac light. |
| `bg-home.webp` | Home Burrow: a warm earthen tunnel near home, little lanterns hung on pegs, a doormat-coloured glow, wooden beams at the edges. |

## Prop (transparent, 512 × 512)

| File | Description |
| --- | --- |
| `stone.webp` | The echo stone: a small rounded grey standing stone with a softly glowing teal spiral carved on its face, a little moss at its foot. Whole stone in frame, no ground or shadow. |

## Dora and Enzo (transparent, 1024 × 1024, side-on, facing **right**, the whole body in frame, feet near the bottom centre)

Ten poses, five each, all drawn at the same scale for each chinchilla so the game can swap them without a jump: Dora's files are `dora-<pose>.webp`, Enzo's `enzo-<pose>.webp`. No ground, no shadow, no props. The game tints these teal for the echo, so keep the outlines clean.

| Pose | Who | Description |
| --- | --- | --- |
| `idle` | both | Standing on all fours, alert and cheerful, tail curled up behind. |
| `run` | both | A bounding run to the right: front paws reaching, hind legs pushing off, ears swept back a little. |
| `jump` | both | Mid-hop up and to the right, body stretched, forepaws tucked, hind legs trailing, tail streaming. |
| `squeeze` | Dora | Flattened low to the ground, creeping forward on her belly as if under a low ceiling, ears folded back. |
| `push` | Enzo | Leaning hard into an unseen crate on his right, both front paws pressed forward at shoulder height, hind legs braced behind, determined face. |
| `cheer` | both | Sitting up on hind legs, both forepaws raised high in a happy cheer, eyes shut with joy. |

## In the game

The game trims and scales the poses with Pillow so that each chinchilla's idle pose is the same height, and every pose of that chinchilla uses the same scale and stands on the same line. A pose that fails to load borrows the nearest painted pose (`run` for `push` and `squeeze`, `idle` for `cheer`), and the drawn chinchillas stand in until any painting arrives.
