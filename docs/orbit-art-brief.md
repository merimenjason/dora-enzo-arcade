# Moonhop · art brief

Paintings for Moonhop (`/orbit`), a cosy gravity-slingshot game. Dora and Enzo's paper-lantern balloon drifts up past the clouds into a sky of tiny round moons, and they hop from moon to moon, holding paws, gathering the lost fireflies that will light the lantern home. The game draws the moons' props, the fireflies, the comets, the trajectory dots and the starfield itself, and draws its own stand-in for every image until the file loads, so the images can arrive in any order. Written 31-10-2026.

**Style for all images:** warm hand-painted toon storybook, soft cel shading, gentle fine ink edges, a deep calm night palette (indigo, violet and midnight blue, with soft moonlight, silver starlight and warm lantern gold), matching how Dora and Enzo look in `public/art/driftwood/title.webp` and `public/art/roll/title.webp`. **Their heads (critical):** copy the heads in those two paintings: a broad, slightly flat crown with a soft edge of short dense fur, smooth and rounded, and clean pink ear insides with nothing standing up from the head. Never use the Hayloft Tycoon portraits as a reference. No text, letters, numbers or logos. **Dora** is a small cream-white chinchilla with pink ears and ruby-red eyes. **Enzo** is a bigger cool blue-grey chinchilla with a darker wavy back, a pale chest and solid black eyes (never taupe, beige or brown). Neither wears clothes. All files live in `public/art/orbit/` as `.webp` (quality about 86).

## Scenes (opaque, 1536 × 1024)

| File | Description |
| --- | --- |
| `title.webp` | Dora and Enzo holding paws, standing on top of a tiny round mossy moon in a starry sky, a big glowing paper-lantern balloon floating above them and a few fireflies around. Simple and calm. |
| `sky-1.webp` | **Lantern Clouds.** A calm dusk sky above a soft sea of pink and gold cloud tops along the bottom edge, a few tiny far-off paper lanterns. Open sky above. No characters, no moons or planets. |
| `sky-2.webp` | **Mushroom Moons.** A deep teal and violet night with a faint misty nebula of soft green and violet. Calm and open. No characters, no moons or planets. |
| `sky-3.webp` | **Frost Moons.** An icy blue night with faint aurora ribbons along the top edge and tiny frosty sparkles. Calm and open. No characters, no moons or planets. |
| `sky-4.webp` | **The Comet Stream.** A deep blue-violet night with a faint river of stardust running diagonally across. Calm and open. No characters, no moons or planets. |
| `sky-5.webp` | **The Night Garden.** A deep midnight sky with soft glowing nebula clouds shaped like faint flower petals, rose and gold. Calm and open. No characters, no moons or planets. |
| `ending.webp` | Dora and Enzo holding paws in a little basket under a big glowing paper-lantern balloon, drifting down towards a round burrow door in a grassy hill at night, a trail of fireflies behind them. Warm and calm. |

## Moon surfaces (cut-out discs, 1024 × 1024)

Each one a single round little world seen flat, as a perfect circle filling most of the frame, its surface painted inside the circle only (nothing sticking out past the edge), on a perfectly flat pure green (#00FF00) background, or pure magenta (#FF00FF) where the moon itself is green. The game masks each to a clean circle, turns it as the moon spins and adds its own small props on the rim.

| File | Surface |
| --- | --- |
| `moon-moss.webp` | A soft mossy moon: velvety green moss with tiny white flowers (the sticky moon). |
| `moon-cheese.webp` | A cheese-coloured moon: pale golden yellow with round holes and craters. |
| `moon-ice.webp` | An ice moon: pale blue frosty ice with cracks and glints (the slippery moon). |
| `moon-jelly.webp` | A jelly moon: translucent pink and lilac jelly with little bubbles and a shine (the bouncy moon). |
| `moon-lantern.webp` | A lantern moon: warm paper-lantern orange with soft ribs and a glow inside. |
| `moon-mushroom.webp` | A mushroom moon: a red mushroom-cap surface with cream spots. |
| `moon-garden.webp` | A night-garden moon: dark green leaves with glowing pale blue and rose flowers. |
| `moon-bean.webp` | A black-bean moon: glossy deep purple-black with a faint violet sheen (the moon that pushes away). |

## Dora and Enzo, holding paws (green screen, 1024 × 1024)

Four poses of the pair side by side, Dora on the left and Enzo on the right, holding paws, whole bodies seen from the front. One painting per pose, both chinchillas in it, nothing else. Background: a perfectly flat, uniform pure green (#00FF00), no shadow, no ground, no props.

| File | Pose |
| --- | --- |
| `pair-stand.webp` | Standing upright on their hind legs, smiling, calm. |
| `pair-crouch.webp` | Crouched low, knees bent, ready to leap, happy and determined. |
| `pair-fly.webp` | Leaping through the air, bodies stretched upward, ears streaming back, joyful. |
| `pair-cheer.webp` | Just landed and cheering, free paws raised, big smiles. |

## In the game

The pair's green is keyed out with Pillow (a soft edge and green despill), trimmed and fitted to 640 × 640 standing on the bottom edge. The moon discs are masked to a clean circle and saved at 512 × 512. A missing pose borrows `stand`; the drawn chinchillas stand in until any pose arrives; a missing moon surface falls back to a drawn, shaded disc in the moon's colour; a missing sky falls back to a drawn gradient.
