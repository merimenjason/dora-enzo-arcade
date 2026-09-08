# Dust & Documents: the remake

- Remake: `/checkpoint-remake`. Original: `/checkpoint`, unchanged.
- The arcade menu links both editions. The remake has its own page, scoped stylesheet, deterministic engine and Three scene. It reuses the original rule generation and chinchilla geometry, not the original mutable game controller.
- Seven seeded shifts. Every correct decision earns 6 credits. A citation loses 3 credits. Denial requires at least one selected discrepancy, and every submitted reason must be true. Decisions, rent and meals are guarded against repeat submission.
- Untimed by default. Optional shifts last 150 seconds. A 7-credit warm supper adds 20 seconds to the next shift, versus 3-credit basic hay. Rent is automatically deducted. The clock pauses while the browser tab is hidden. An outstanding verdict remains readable after time expires.
- No detention-for-profit mechanic. No save data, network account or audio. Restart replays the same deterministic queue.

## Scene layout

The camera views an open-front, cutaway booth. Dora and Enzo occupy separate rigs at x=-1.3 and x=1.3, z=3.05, facing -Z. Their rigs own facing while the shared animation only handles breathing, paws and ears. The counter is at z=1.45, with its rear edge at 1.875. The inspectors' bodies, tails and ears stay behind the counter and below the partial roof.

The scale is at x=-2.3, z=-0.15. The traveler waits at (0,0), first turns in place and steps back to (0,-1.5), then turns toward +X and walks through the raised gate to (8,-1.5). Denied travelers turn in place and leave along -Z. The gate pivot is (4.5,1.5,-0.45). It rises long before an approved traveler reaches it. A new traveler cannot be called before departure completes. The scale readout is a verified measurement in the UI, not a simulated weighing animation.

## Validation commands

```sh
npm run typecheck
npx tsc lib/checkpoint-remake-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck
node tests/checkpoint-remake.mjs
# With the existing dev server and Playwright installation:
BASE_URL=http://localhost:3000 node tests/e2e/checkpoint-remake.mjs
```

Engine tests cover every species with both verdicts, invalid reasons, double submissions, timeout boundaries, meal choices, a perfect seven-day run, bankruptcy and continuous collision-safe routes. Browser tests play the first shift through the actual UI, check both verdicts and departure locking, purchase supper, start a timed second day, check mobile overflow and both arcade links. A separate real-WebGL scene harness advances all five species through both exit routes and checks gate clearance. It does not claim every species is encountered in the first UI shift. Screenshots go under `JCODE_SCRATCH_DIR` (or `.checks`).

The browser test imports the scene using Vite's development module URL, so run it against the dev server rather than the production deployment.
