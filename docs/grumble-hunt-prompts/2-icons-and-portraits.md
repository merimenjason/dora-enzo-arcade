Repo: dora-enzo-arcade. Stay on branch `codex/grumble-hunt-art` (pull first; it already holds the first Grumble Hunt art commit). Art only: do not write game code or edit any file outside `public/art/hunt/` and `docs/grumble-hunt-art.md`.

Context: same game and style as the first art pass, which `docs/grumble-hunt-art.md` describes. Grumble Hunt is a kid-friendly 3D Monster Hunter-style game starring Dora (white chinchilla) and Enzo (grey chinchilla). It renders in a toon "storybook" style: flat three-band cel shading, thin dark-brown ink outlines, chunky rounded shapes, saturated but gentle colours. Nothing is ever hurt: beasts are bonked until they nap. No text, logos or watermarks.

Make these images. Save each as WebP (quality 85) at the path given, and add them to `docs/grumble-hunt-art.md` with size and prompt.

A. Icon sheets (transparent background). Each sheet is a 4×4 grid of 256×256 cells, 1024×1024 overall. Centre one icon in each cell with even padding, the same three-quarter angle, the same light from the top left, and a thick dark-brown outline so it reads at 48 px. Leave unused cells empty. Fill the cells left to right, top to bottom, in the order listed:
1. `public/art/hunt/icons-materials.webp`: bristle tuft, tusk shard, boar hide patch, curly tail tuft, puff sac, wart pebble, sleepy-cloud wisp, marsh reed, sky feather, owl down, beetle shell plate, horn chip, frost fur, icy mane lock, glimmer stone, berry.
2. `public/art/hunt/icons-items.webp`: fluffberry (heals), big fluffberry, sleepy seed, dizzy bell, sticky sap, smoke puffball, pathfinder acorn, hay bundle, map scroll, berry pouch, empty slot ring.
3. `public/art/hunt/icons-gear.webp`: Acorn Hammer, Acorn Hammer upgraded (iron-banded), Acorn Hammer final (golden cap), Twin Claws, Twin Claws upgraded, Twin Claws final, Seed Bow, Seed Bow upgraded, Seed Bow final, Bristle helm, Bristle vest, Bristle boots, Puffwart helm, Puffwart vest, Puffwart boots.

B. Weapon modelling references (plain light background, side view and front view of each weapon at the same scale, with a white chinchilla paw drawn holding it to show the grip size, no text). They are for building simple 3D models, so keep the shapes chunky:
4. `public/art/hunt/ref-weapons.webp`, 2048×1024: the Acorn Hammer (a big acorn head on a stout wooden handle with a leather grip wrap), the Twin Claws (a pair of curved wooden paw-blades with rounded tips, nothing sharp-looking), and the Seed Bow (a small curved green-wood bow with a leaf at each tip and a pouch of seeds as ammunition).

C. HUD portraits of Dora and Enzo (transparent background). Look at the real photos `public/art/dora.jpeg` and `public/art/enzo.jpeg` and at the 3D model renders in `docs/grumble-hunt/screenshots/` (on branch `grumble-hunt-base`), and match them:
- chibi heads with huge round dish ears that tilt outward;
- big glossy eyes with two highlights;
- a tiny nose and a "w" mouth;
- Dora is cream white with pink ears and ruby eyes; Enzo is grey with a pale chest, mauve-pink inner ears and black eyes.

Each sheet is a 2×2 grid of head-and-shoulders portraits, each centred in its own 512×512 cell with the same framing:
- top left: happy;
- top right: determined;
- bottom left: dizzy (swirly eyes, little stars);
- bottom right: sleepy and content.

5. `public/art/hunt/portraits-dora.webp`, 1024×1024: Dora. In the determined cell she has the Acorn Hammer over her shoulder.
6. `public/art/hunt/portraits-enzo.webp`, 1024×1024: Enzo. In the determined cell he holds the Seed Bow.

Commit with a short message and push the branch. Don't open a pull request.
