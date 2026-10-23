Work only inside `/home/jason/repos/dora-enzo-arcade/.worktrees/gh-weapons`, a git worktree already on branch `codex/grumble-hunt-weapons`, with `node_modules` linked. Don't touch any other checkout or branch, never push to `main`, and don't open a pull request.

Task: in the Grumble Hunt look test, model every weapon type Dora can't hold yet, add a weapon-select overlay, and check each weapon visually.

Read first:
- `docs/grumble-hunt/README.md`;
- `docs/grumble-hunt/look-test/main.ts.txt` (TypeScript renamed `.txt`; see `WEAPON`, `held`, `grip()`, `poseGrips()`, and how the Acorn Hammer `hamPivot` and Enzo's `bow` are built);
- `lib/hunt-chinchilla.ts` (`poseArms` aims the front arms at grip points in body space; +x is forward, +z is Dora's right);
- `lib/grumble-hunt-content.ts` (`WEAPON_TYPES`, `BASIC_WEAPONS`, `MH_EQUIVALENT`, `FIRST_PICKS`).

1. Add a model and a held idle pose for each of these, picked with `?weapon=<id>` the same way as `claws`, `lance`, `wand` and `yoyo`:
   - `greatsword`: Driftwood Greatsword. A huge flat paddle of pale driftwood with rounded edges and a wrapped grip, carried in both paws, resting on the shoulder.
   - `katana`: Bamboo Katana. A long, slim, slightly curved bamboo blade with a round leaf guard, held in both paws in front, angled up.
   - `sword`: Twig Sword and Acorn Shield. A short twig sword in the right paw, and a small round acorn-cap shield on the left.
   - `horn`: Gourd Horn. A big round gourd on a short handle, with little pipe holes, carried in both paws.
   - `gunlance`: Puffcap Lance. Like the Thistle Lance, but with a fat puffball mushroom cap at the tip, and a leaf shield on the left.
   - `switchaxe`: Switch Spade. A long-handled wooden spade with a flower-bud hinge, in both paws.
   - `chargeblade`: Seedpod Blade. A short seed-pod blade in the right paw and a bean-pod shield with three visible seeds on the left.
   - `glaive`: Firefly Staff. A slim staff with a lantern-flower head, plus a small glowing firefly that orbits Dora's head (unlit material, no outline).
   - `lightbow`: Acorn Slingshot. A Y-shaped twig slingshot in the left paw, with the right paw pulling the band.
   - `heavybow`: Pumpkin Popper. A chunky little pumpkin cannon with a stem handle, held at the hip in both paws.

   Also fix the Thistle Lance's Leaf Shield, which covers half of Dora's face in the front view: move it further out to her left side and lower it, so the face is always clear.

2. Rules for every model:
   - Chunky, rounded and kid-friendly: no sharp points or edges, nothing that looks like a real blade or gun.
   - Use the look test's `pair()` toon materials with ink outlines.
   - Keep each weapon under about 30 meshes.
   - Build each one with `grip()` so it lives in Dora's body space, scaled to rig units.
   - The paws must sit on the handles: every pose goes through `poseArms` with grip points on the weapon, as the hammer does.
   - Nothing may cut through Dora's head, ears or body in the front, side or hunt-camera views.
   - Size them like the hammer: big and readable, but not bigger than Dora except the greatsword.

3. Weapon-select overlay. Add a small panel (bottom centre, matching the look test's HUD styling) showing:
   - the current weapon's name, its Monster Hunter equivalent ("plays like Great Sword"), its signature move text, and a "Good first pick" badge for `FIRST_PICKS`, all read from `lib/grumble-hunt-content.ts` (import it from `../../../lib/grumble-hunt-content`);
   - ‹ and › buttons, plus the `[` and `]` keys, cycling through all 16 types (the 14 in `BASIC_WEAPONS` order, then `wand` and `yoyo`) without reloading the page, by swapping which weapon group is visible.

   The `?weapon=` option still sets the first one shown. The Acorn Hammer's swing (J) only needs to work when the hammer is out; other weapons can play a small bob when J is pressed.

4. Check it:
   - Build with `bash docs/grumble-hunt/look-test/build.sh '<json>'` (read the script's header for the shot list format).
   - Take front shots (`?portrait=1.1&weapon=<id>`) and side shots (`?portrait=-4&weapon=<id>`) of all 16 weapons, saved to `docs/grumble-hunt/screenshots/weapons/` as `<id>-front.png` and `<id>-side.png` (set `SHOTS` to that folder).
   - Look at every screenshot yourself. Fix anything that clips, floats away from the paws, hides the face or doesn't read as the weapon described, then reshoot.
   - Run `npm run typecheck`.
   - Then add a "Weapons" section to `docs/grumble-hunt/README.md` listing each `?weapon=` id with its name.

Don't change any file outside `docs/grumble-hunt/look-test/`, `docs/grumble-hunt/screenshots/weapons/`, `docs/grumble-hunt/README.md` and this prompt file. Commit with a clear message, push `codex/grumble-hunt-weapons`, and report which weapons you checked and anything you couldn't get right.
