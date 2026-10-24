Work only inside `/home/jason/repos/dora-enzo-arcade/.worktrees/gh-icons`, a git worktree already on branch `codex/grumble-hunt-weapon-icons`. Don't touch any other checkout or branch, never push to `main`, and don't open a pull request. Art only: don't write game code, and don't edit any file outside `public/art/hunt/` and `docs/grumble-hunt-weapon-icons.md`. Don't change or delete any existing file in `public/art/hunt/`.

Context:
- Read `docs/grumble-hunt/expansion-design.md`, section 2 **Weapons**, and look at `docs/grumble-hunt/screenshots/` and `docs/grumble-hunt-art.md`.
- Grumble Hunt is a kid-friendly 3D game with a warm, hand-painted toon storybook look (Monster Hunter Stories, Wind Waker). Nothing is ever hurt.
- Every weapon is made of wood, seeds, gourds, bamboo or puffballs, with rounded edges. Nothing may look like a real blade or a real gun.
- No text, logos or watermarks.

Make three icon sheets. Each is a 4×4 grid of 256×256 cells, 1024×1024 overall, with a transparent background:
- one icon centred in each cell, with even padding;
- the same three-quarter angle and the same light from the top left in every cell;
- a thick dark-brown outline so it reads at 48 px.

Fill the cells left to right, top to bottom, in this order, and leave unused cells empty. For each weapon, "upgraded" means the same shape with iron bands and brighter colours, and "final" means a grander version with a golden trim and a small beast motif. Save as WebP (quality 85, alpha kept).

1. `public/art/hunt/icons-weapons-3.webp`:
   - Driftwood Greatsword: a huge flat paddle of pale driftwood with rounded edges and a wrapped grip, then its upgraded and final versions;
   - Bamboo Katana: a long, slim, slightly curved bamboo blade with a round leaf guard, then upgraded and final;
   - Twig Sword and Acorn Shield: a short twig sword with a small round acorn-cap shield, then upgraded and final;
   - Gourd Horn: a big round gourd on a short handle, with pipe holes, then upgraded and final;
   - Puffcap Lance: a wooden lance with a fat puffball mushroom cap at the tip, with a leaf shield, then upgraded and final;
   - the Glimmer Greatsword.
2. `public/art/hunt/icons-weapons-4.webp`:
   - Switch Spade: a long-handled wooden spade with a flower-bud hinge, then upgraded and final;
   - Seedpod Blade: a short seed-pod blade with a bean-pod shield showing three seeds, then upgraded and final;
   - Firefly Staff: a slim staff with a lantern-flower head and a small glowing firefly, then upgraded and final;
   - Acorn Slingshot: a Y-shaped twig slingshot with an acorn in its band, then upgraded and final;
   - Pumpkin Popper: a chunky little pumpkin cannon with a stem handle, firing puffs of popcorn, then upgraded and final;
   - the Glimmer Katana.
3. `public/art/hunt/icons-weapons-5.webp`:
   - the Glimmer versions of the Twig Sword and Acorn Shield, Gourd Horn, Puffcap Lance, Switch Spade, Seedpod Blade, Firefly Staff, Acorn Slingshot and Pumpkin Popper;
   - each Glimmer version is the weapon's shape, softly glowing, with a small warm Glimmer Stone crystal set in it.

Check that every file decodes at 1024×1024 with alpha. Look at each sheet: fix any cell that is off-centre, cut off, sharp-looking or inconsistent in angle or outline. Then write `docs/grumble-hunt-weapon-icons.md` listing each file, every cell (row, column, weapon) and the exact prompt used.

Commit with a short message, push `codex/grumble-hunt-weapon-icons`, and report what you made and anything you couldn't get right.
