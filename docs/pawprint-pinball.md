# Pawprint Pinball — The Clockwork Warren

Game 28, `/pinball`, built 09-10-2026. A handcrafted woodland pinball table matching the approved mock-up, with carved paw flippers, brass-and-timber ramps, hay bumpers and miniature burrows. Dora has dark ruby eyes, Enzo has black eyes, and the dust bowl contains matte dry powder.

## Play and scoring

Arcade ends after three drained berries. Practice supplies unlimited berries and never changes arcade records. Hold Launch/Space to charge at 90% per second, then release. The berry waits on top of the plunger. A firm shot (about a fifth of full charge or more) clears the lane, rides the wooden ramp to the bridge and drops onto the felt beneath it, above the hay bumpers. A weaker one settles back on the plunger and can be retried without losing a berry. Every launch has seven seconds of ball save; a saved berry returns automatically to the field.

| Event | Points |
| --- | --- |
| Hay bumper | 500 × combo, up to 5×; consecutive hits within two seconds |
| Slingshot cushion | 250 |
| Newly lit rescue target | 1,000 |
| Three targets / rescued burrow | 10,000; lamps reset after three seconds |
| Ramp entrance | 500 |
| Left bridge completion | 2,500 |
| Multiball start | 5,000 |

The two ramps are entered from the felt pockets either side of the table, by a berry moving up into the brass doorstep at the top of the pocket: a cross-table shot from the opposite flipper. The left ramp climbs the winding boardwalk, crosses the painted bridge, comes down the right return lane and sets the berry down above the right flipper. The right ramp leads to the dry-powder bowl and a lock. The three rescue targets are brass studs on the stone wall under the burrow; each one lights the burrow window above it. Each of the first two locks supplies another launch without consuming a life. The third releases three purple moonberries, awards the multiball bonus and gives twelve seconds of ball save. All awards double during multiball. Draining one of several balls leaves the others in play; returning to one ball ends double points. The final unsaved drain consumes a life.

Flippers can catch a slow berry: release and flip again to aim. A nudge pushes berries upward and toward the middle, with a 0.45-second recharge. Each adds 0.38 heat, which cools at 0.12 per second. Reaching one heat rests both flippers for three seconds. The meter and tilt label explain the penalty.

## Physics and controls

The table is 1000 × 1000 units. A 1/240-second fixed-step engine simulates gravity (900 units/s²), drag, circle bumpers, capsule walls and cushions, and rotating capsule flippers; the engine caps speed at 1800 units/s to keep contacts stable.

Every collider is traced from the painted table, so the berry only touches what is drawn. `WALLS` is the edge of the green felt: the underside of the bridge, the stone wall under the burrow, both fences, the brass doorsteps, the two pockets, the cushion islands and the stone step down to each flipper, with a floor under the flippers that runs to the slot between them. That slot is the only drain. The side lanes, the stonework and the lantern boxes are scenery the berry never crosses, and the tests check that a berry off a ramp stays on the felt. The table is painted symmetric, so one half is traced and mirrored; only the pockets differ. To retrace after an artwork change, draw the exported constants over `public/art/pinball/table.png`.

- **Flippers** are 114 long and 17 thick, the size of the paw sprite, pivoting at the two brass rings. A swinging paw carries the berry, so a shot is as fast as the part of the paw it leaves from: slower from beside the pivot, fastest off the tip. A raised paw holds a slow berry still.
- **Hay bumpers** always throw the berry off at 520 units/s or more.
- **Cushions**: only the face of each island that looks onto the felt kicks, straight out from that face, and only when struck. A berry rolling down it is just guided to the flipper.
- **Walls** return 42% of the speed into them, the flippers 30%, and any touch slower than 45 units/s does not bounce at all, which is what lets a berry settle.
- **Launcher**: the berry is in the lane until it passes the top, touching only the lane's rails and the plunger. Ordinary balls collide with each other. Elevated ramp balls are guided along shared scene/engine paths and are excluded from ordinary field collisions until returning. A saved berry is fired back up out of the drain slot. The seeded random stream varies where a launched berry leaves the bridge and saved/multiball returns deterministically.

- ← / A and → / D: left and right flipper; hold, release and time the next flip.
- Space / Launch: hold to charge, release to launch. Pointer cancellation stops charging without firing.
- ↑ / N / Nudge: a limited table nudge.
- P / Escape: pause; M: sound. Native buttons also accept Space/Enter. Focus loss or a hidden tab pauses and releases all held controls.
- Phone controls support two simultaneous captured pointers, with independent left/right releases. Save & menu preserves the table; Continue resumes paused.

## Artwork, sound and saves

Two runtime assets preload before play: the painted table and an alpha sprite atlas for bumpers, paw flippers, gold/purple berries and Dora/Enzo portraits. The background has empty live-piece positions; scores, lamps, locks, flippers and berries come from current game state. The plunger is drawn back as the launch charges: the scene redraws that part of the painting with the cap, its collar and the brackets that ride the rails slid down by up to 40 units, the spring squashed beneath them and the lane above stretched to follow, and the waiting berry rides down on the cap. On release it springs back and throws sparks. The berry turns as it rolls and is drawn a little larger, with a shadow, while it is up on a ramp. Bumpers ring, a struck cushion flashes and bulges, targets and ramp doorsteps pulse, lit lamps breathe, a drain ripples at the slot, a saved berry returns up a streak of light, multiball washes the table purple, and a nudge rocks the table (harder on a tilt). Lanterns flicker and fireflies drift over the table throughout. All of it is drawn by `lib/pinball-scene.ts` from the engine's events and stops for pause; with reduced motion only the plunger's position remains, since it is the launch gauge. Dry grains, rebound glints, berry trails and scoring feedback respect pause and reduced motion.

Dora and Enzo sit as a mirrored pair outside the playfield, placed by `app/pinball/pinball.css` so they never cover the table or the side panel. In a wide window (at least 951 px wide and 36:25 or wider) one perches on each side of the table at its bottom corners, each 18% of the table's width. In a squarer or narrower window, and on phones, they peek over the control bar under the table. Short landscape windows (500 px tall or less) keep them beside the table. [Asset provenance and exact built-in imagegen prompts](pinball-art.md).

`pawprint-pinball-v1` keeps the best arcade score, completed arcade runs and rescued burrows. `pawprint-pinball-run-v2` (v2 since the table was retraced, so a berry saved on the old table is not restored inside a wall) preserves physics positions/velocities, fixed-step remainder, seeded stream, flipper angles, mission lamps, ramp state, lock count, timers and resources. `Game.load` checks field ranges, unique IDs, ramp positions, references and legal unfinished states. It restores paused, excludes transient events and clears held input/launch charge. Records bank immediately at the third drain and finished runs are removed. `pawprint-pinball-sound-v1` keeps mute. Storage or audio unavailable does not stop play.

## Checks

`lib/pinball-game.ts`, `lib/pinball-scene.ts` and `app/pinball/` follow the engine/scene/page split. `npm run test:pinball` checks real collision impulses, charge/cancel, weak and firm launches, shot speed along the paw, a catch, struck and rolled-on cushions, rescue, ramp capture, the bridge run, dry dust, locks, multiball, saved berries, three-ball ending, practice, tilt, frame subdivision, snapshot replay and malformed saves. Three legal-input planner runs validate 14,400 snapshots and that the berry never leaves the felt. `npm run bot:pinball` checks eight seeded legal-control runs. `tests/e2e/pinball.mjs` covers actual keyboard/touch, simultaneous pointers, cancellation, pause/focus, saved tables, records, loading recovery, reduced motion, four phone layouts and, at five desktop sizes, that Dora and Enzo mirror each other and overlap neither the table nor the side panel.

The automated planner proves scoring, rescues, ramps and multiball are reachable and physics stays finite. Human aiming, real-phone latency and a listening pass remain useful follow-ups.
