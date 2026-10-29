# Snowdrift · art brief

Paintings for Snowdrift (`/snowdrift`), a one-button side-on sledding game. Dora and Enzo share one little wooden sled and race the sunset across seven snowy valleys of the high Andes to reach each evening's lodge, where cocoa and a fire wait. The game draws the snowy hills, the sled's trail, snow spray, cocoa mugs, snowflakes and the creeping dusk itself, and draws its own stand-in for every image until the file loads, so the images can arrive in any order. Written 30-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, crisp mountain air and cosy winter colours, matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp` (and the newest accepted look in `public/art/echo/`). **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, NO spiky tufts, cowlicks or forelocks anywhere on the head, and clean pink ear insides with NO fluffy ear tufts. Never use the Hayloft Tycoon portraits as a reference (they have these tufts). No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes, wearing a little red knitted scarf. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown), wearing a little blue knitted scarf whose ends stream behind him. They wear nothing else. Export as `.webp` (quality about 88). All files live in `public/art/snowdrift/`.

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | Dora and Enzo flying over a snowy crest on their little wooden sled, Dora in front with her red scarf, Enzo behind with his blue scarf streaming, both delighted; a powder spray behind the runners, Andes peaks glowing pink and gold at sunset behind them, a tiny lit lodge far down the valley. Keep the lower third calmer. |
| `ending.webp` | The grand lodge at the summit at night: a big timber lodge with glowing windows, fireworks blooming in a starry sky, and inside the big front window Dora and Enzo snuggled on a rug by a crackling fire with two mugs of cocoa, the little sled leaning by the door outside. |
| `lodge.webp` | Inside a snug mountain lodge: a stone fireplace with a crackling fire, wooden walls, a woven rug, a shelf with a jar of wax, a woolly scarf, a big thermos and a pair of polished sled runners, two steaming cocoa mugs on a low table, frosty window with blue dusk outside. No characters. Keep the centre calm (a panel is drawn over it). |

## Valley backdrops (opaque, 1536 × 1024, landscape)

The far distance of each valley, seen side-on: the sky and far mountains only. The game draws its own snowy hills over the lower half and tints the sky towards sunset as the day goes on, so keep the **lower 40% soft and simple** (distant snowfields or mist), with no foreground slopes, trees across the middle, buildings or characters.

| File | Description |
| --- | --- |
| `bg-meadow.webp` | Pine Meadow: a gentle morning sky, soft rounded snowy hills with far pine forests, pale blue and cream. |
| `bg-lake.webp` | Frozen Lake: a wide glassy frozen lake far below reflecting pale peaks, a big open sky. |
| `bg-caves.webp` | Ice Caves: the far wall of a huge blue ice cavern with glowing translucent ice columns and a bright opening of daylight at the top. |
| `bg-ridge.webp` | Windy Ridge: jagged high peaks with long plumes of snow blowing off the summits, streaky wind clouds. |
| `bg-bridges.webp` | Snow Bridges: deep snowy gorges with distant arched snow bridges and steep cliffs, hazy depth. |
| `bg-aurora.webp` | Aurora Peaks: a night sky with green and violet aurora ribbons over sharp moonlit peaks, many stars. |
| `bg-summit.webp` | The Summit Run: the highest peaks above a sea of clouds, golden late light, a tiny lodge light on the far summit. |

## Dora and Enzo on the sled (transparent, 1536 × 1024, side-on, moving **right**, the whole sled and both riders in frame)

Six poses of the pair together on one little wooden toboggan with a curled front and two runners. Dora sits in front, Enzo behind her. All drawn at the same scale and framing so the game can swap them without a jump. No snow, ground, shadow or background.

| File | Description |
| --- | --- |
| `ride.webp` | Sitting up on the sled, cheerful, Dora holding the curled front, Enzo's paws on her back, scarves fluttering behind. |
| `tuck.webp` | Both tucked low and pressed down flat against the sled for speed, ears back, determined, scarves streaming straight back. |
| `air.webp` | Airborne: the sled in the air, both riders lifted slightly off the seat with paws out, delighted, scarves flying up. |
| `flip.webp` | Mid backflip seen side-on: both clinging tight to the sled, curled into little balls, eyes squeezed shut and grinning. |
| `tumble.webp` | A comic tumble: the pair bouncing off the sled in a puff of snow, legs and scarves everywhere, surprised but unhurt, the sled tipped beside them. |
| `cheer.webp` | Stopped on the sled, both sitting up with paws raised high in a happy cheer, eyes shut with joy. |

## In the game

After painting, the poses are trimmed and rescaled with Pillow onto 768 × 512 canvases: the `ride` figure is about 330 pixels wide, every pose uses the ride pose's scale, and all of them sit on a runner line 24 pixels above the bottom edge. A pose that fails to load borrows another painted pose (`ride` for `tuck` and `cheer`, `air` for `flip` and `tumble`), and the drawn sled stands in until any painting arrives.
