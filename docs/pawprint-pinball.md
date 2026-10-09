# Pawprint Pinball — The Clockwork Warren

Game 28, `/pinball`, built 09-10-2026. A handcrafted woodland pinball table matching the approved mock-up, with carved paw flippers, brass-and-timber ramps, hay bumpers and miniature burrows. Dora has dark ruby eyes, Enzo has black eyes, and the dust bowl contains matte dry powder.

## Play and scoring

Arcade ends after three drained berries. Practice supplies unlimited berries and never changes arcade records. Hold Launch/Space to charge at 90% per second, then release. A weak shot returning down the launcher can be retried without losing a berry. Every launch has seven seconds of ball save; a saved berry returns automatically to the field.

| Event | Points |
| --- | --- |
| Hay bumper | 500 × combo, up to 5×; consecutive hits within two seconds |
| Slingshot cushion | 250 |
| Newly lit rescue target | 1,000 |
| Three targets / rescued burrow | 10,000; lamps reset after three seconds |
| Ramp entrance | 500 |
| Left bridge completion | 2,500 |
| Multiball start | 5,000 |

The left ramp guides the berry over the painted bridge and into the right return lane. The right ramp and direct dust scoop lead to a dry-powder lock. Each of the first two locks supplies another launch without consuming a life. The third releases three purple moonberries, awards the multiball bonus and gives twelve seconds of ball save. All awards double during multiball. Draining one of several balls leaves the others in play; returning to one ball ends double points. The final unsaved drain consumes a life.

Flippers can catch a slow berry: release and flip again to aim. A nudge pushes berries upward and toward the middle, with a 0.45-second recharge. Each adds 0.38 heat, which cools at 0.12 per second. Reaching one heat rests both flippers for three seconds. The meter and tilt label explain the penalty.

## Physics and controls

The table is 1000 × 1000 units. A 1/240-second fixed-step engine simulates gravity (650 units/s²), drag, circle bumpers, capsule walls/slings and rotating capsule flippers. Flipper surface velocity transfers momentum to the berry; the engine caps speed at 1550 units/s to keep contacts stable. Ordinary balls collide with each other. Elevated ramp balls are guided along shared scene/engine paths and are excluded from ordinary field collisions until returning. The seeded random stream varies launch drift and saved/multiball returns deterministically.

- ← / A and → / D: left and right flipper; hold, release and time the next flip.
- Space / Launch: hold to charge, release to launch. Pointer cancellation stops charging without firing.
- ↑ / N / Nudge: a limited table nudge.
- P / Escape: pause; M: sound. Native buttons also accept Space/Enter. Focus loss or a hidden tab pauses and releases all held controls.
- Phone controls support two simultaneous captured pointers, with independent left/right releases. Save & menu preserves the table; Continue resumes paused.

## Artwork, sound and saves

Two runtime assets preload before play: the painted table and an alpha sprite atlas for bumpers, paw flippers, gold/purple berries and Dora/Enzo portraits. The background has empty live-piece positions; scores, lamps, locks, flippers and berries come from current game state. Dry grains, rebound glints, berry trails and scoring feedback respect pause and reduced motion. [Asset provenance and exact built-in imagegen prompts](pinball-art.md).

`pawprint-pinball-v1` keeps the best arcade score, completed arcade runs and rescued burrows. `pawprint-pinball-run-v1` preserves physics positions/velocities, fixed-step remainder, seeded stream, flipper angles, mission lamps, ramp state, lock count, timers and resources. `Game.load` checks field ranges, unique IDs, ramp positions, references and legal unfinished states. It restores paused, excludes transient events and clears held input/launch charge. Records bank immediately at the third drain and finished runs are removed. `pawprint-pinball-sound-v1` keeps mute. Storage or audio unavailable does not stop play.

## Checks

`lib/pinball-game.ts`, `lib/pinball-scene.ts` and `app/pinball/` follow the engine/scene/page split. `npm run test:pinball` checks real collision impulses, charge/cancel, rescue, ramp capture, dry dust, locks, multiball, saved berries, three-ball ending, practice, tilt, frame subdivision, snapshot replay and malformed saves. Three legal-input planner runs validate 14,400 snapshots. `npm run bot:pinball` checks eight seeded legal-control runs. `tests/e2e/pinball.mjs` covers actual keyboard/touch, simultaneous pointers, cancellation, pause/focus, saved tables, records, loading recovery, reduced motion and four phone layouts.

The automated planner proves scoring, rescues, ramps and multiball are reachable and physics stays finite. Human aiming, real-phone latency and a listening pass remain useful follow-ups.
