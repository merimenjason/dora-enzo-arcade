Work only inside `/home/jason/repos/dora-enzo-arcade/.worktrees/gh-fixes`, a git worktree on branch `codex/grumble-hunt-fixes` (head 5ac3848). Your sandbox can't write git metadata or reach github.com, so don't commit or push: Claude will review, commit and push.

Bug: the hunt camera can end up inside a tree's leaves, so the whole screen is foliage and you can't see Dora, Enzo or the beast. It shows in the browser suite's `puffwart-nap` screenshot.

Cause: in `lib/grumble-hunt-scene.ts`, the camera's clipping check (around lines 290–294) casts only against `blockers`, which holds the trunks (line 111). The crowns (`crowns`, an icosahedron per tree) and the billboard leaf cards (`leafCards`, centred at y 4.2, scaled 5 × 4.4) aren't checked. The camera never moves in for them, and nothing is hidden when it's inside them.

Fix it so foliage never fills the view, and the leader and beast stay visible:
- Each frame, hide or fade any tree whose crown is close to the camera, or between the camera and the camera target. Fade both its crown and its leaf card, the leaf card more strongly. Either scale those instances to zero or use a per-instance fade. Keep each the single instanced draw it is now.
- Don't pull the camera in for crowns. Keep the existing trunk behaviour, so the view doesn't keep jumping as the camera passes under trees.
- Make the fade smooth, over about 0.2 s, so trees don't pop.
- Phone and desktop both, at no extra draw calls.

Add a browser check to `tests/e2e/grumble-hunt.mjs`:
- Put the camera target next to a tree, with the camera orbiting behind that tree.
- Assert that the tree's crown and leaf card instance are hidden or faded, and that the leader is still on screen.
- Save a screenshot as `.checks/hunt/canopy-camera.png`.

Run `npm run typecheck` and `npm run test:grumble-hunt`. Report the file:line of each change. Don't touch any other behaviour.
