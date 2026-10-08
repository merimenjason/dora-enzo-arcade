# Moonlight Mischief

Game 27, `/moonlight`, built 09-10-2026. A short stealth adventure in the approved painted village. Collect every treat, rescue the caged friend with Enzo, and take both Dora and Enzo to the home door. The rescued friend finds a legal path home automatically.

## Nights and records

| Night | Time | Treat bundles | Patrols |
| --- | --- | --- | --- |
| Lantern Lane | 180 seconds | 5 | 2 |
| The Watchful Warren | 165 seconds | 6 | 3 |
| One Last Moonbeam | 150 seconds | 7 | 3 |

The clock starts on the first move or action. One completed timed night unlocks the next. Practice opens all three nights and removes the deadline and catch limit; it does not earn records or unlock nights. Three catches end a timed night. A catch returns the spotted hero to the safe starting path, preserving collected treats and the rescue. A win needs all treats, a rescue, the friend home and both heroes checked in at the home door. Stars: one for winning, one for zero catches, one for using less than 75% of the time limit. Records keep the best stars and fastest completed time, shown on the night cards. Results list elapsed time and catches; practice results do not display unearned stars.

## Moving and staying unseen

The world is 1000 × 640. Heroes move at 95 units/second, or 55 while creeping. Keyboard movement respects the painted path corridors and the heavy barrel. Tap/click navigation uses A* over 20-unit cells, with full-edge collision checks and no corner cutting. It follows the same legal movement as the keyboard. Village-object buttons provide accessible destinations; phones also have a paw pad, a creep toggle and 2× map zoom. Zoom is contained in a scrollable viewport with compact controls; the camera follows the selected hero and yields briefly to manual panning. Drag with a mouse, swipe on touch, or use the trackpad to pan a zoomed view. Reduced motion snaps the camera instead of easing it. Action buttons return keyboard focus without scrolling the page.

Owls patrol at 22, 27 or 32 units/second, pausing 1.2 seconds at turns. Vision reaches 165 units, within 0.48 radians to either side, and cottages block rays. The scene renders those same rays. Being seen increases suspicion by 0.48/second, or 0.36 while the selected hero creeps. Dry dust reduces it to 0.12 outside 65 units; closer owls can still spot a dusty chinchilla. Hidden and safely home heroes are invisible. Suspicion falls at 0.65/second when nobody is visible. Both portrait meters show current owl attention; reaching 28% emits a warning naming the watched friend and plays a soft cue. A warning rearms only after suspicion settles below 8%, avoiding repeated cues at the cone edge. Moving normally over marked cobbled stretches can make nearby owls turn toward the noise; creeping, a quiet dash and dry dust avoid that rustle.

- **Dora:** quiet dash for 0.32 seconds at 290 units/second, recharging in four seconds. From a standstill it moves in the facing direction; input or a tap route steers it. Pause and interactions stop unfinished dashes. Marked fence gaps let only Dora pass between the two sides.
- **Enzo:** a decoy rustle 80 units toward his facing direction; owls within 280 units investigate it for 4.5 seconds. Eight-second recharge. Only Enzo can open the rescue latch or push the heavy barrel to open the shortcut.
- **Hay:** E/the interaction button toggles hiding within 48 units. Moving leaves hiding.
- **Dry dust:** rolling near the bowl gives 22 seconds of disguise. The bowl contains dry powder, and the scene animates grains rather than water or steam.

WASD/arrows move, Shift creeps, Q switches heroes, E interacts, Space uses an ability. P/Escape pauses and M toggles sound. Native buttons keep their keyboard controls. Focus loss, tab hiding and cancelled paw-pad presses release movement. Pausing clears the current tap route. The contextual action explains when the other hero is needed.

## Artwork, animation and saves

Four runtime PNGs derive from the approved reference: village, character poses, props and portraits/details. Dora stays white with dark burgundy ruby eyes; Enzo stays grey with black eyes. Character poses, steps, breathing, footprints, owl cones, pickup glints, dry grains and decoy rings animate over the painted map. Pause freezes the scene clock; reduced motion disables decoration while gameplay continues. Assets preload, with an explicit retry if loading fails. [Art provenance and exact prompts](moonlight-art.md).

`moonlight-mischief-v1` keeps records. `moonlight-mischief-run-v1` saves the night, clock, heroes, patrols, resources, rescue and collected treats after actions/events and every three seconds. `Game.load` validates geometry, identities, fixed treat positions, field ranges and references; malformed or incompatible saves are ignored. It restores paused, excludes transient input/routes/events, and reconstructs the rescued friend's path. Owl positions are checked against actual patrol segments with the engine's three-unit corner tolerance, so valid mid-patrol saves remain resumable. Finished runs are removed immediately and timed results banked once. `moonlight-mischief-sound-v1` keeps the mute choice. Storage or audio unavailable does not stop play.

Fireflies drift gently, decoys leave visible pawprints for their full 4.5-second lifetime, rescued friends get a warm spark effect and the pushed barrel settles beside the shortcut. These effects respect pause and reduced motion.

## Code and checks

- `lib/moonlight-game.ts`: deterministic fixed-step movement, routing, vision, abilities, rescue, progress and validated snapshots. No DOM or random gameplay.
- `lib/moonlight-scene.ts`: alpha-fitted painted atlases and the same occluded visibility rays as the engine. Draws only; never changes gameplay state.
- `app/moonlight/`: client interface, input, focus handling, storage, metadata, sound and responsive styles.
- `tests/moonlight.mjs`: rules, collision, abilities, sight, catches, timeouts, snapshot validation/replay, valid snapshots throughout complete heists and after a catch, and all three completed nights.
- `tests/moonlight-bot.mjs`: legal-path timed planner; 15/15 wins required across three nights and five starting patrol phases. It uses the same movement, actions and cooldowns as a player.
- `tests/e2e/moonlight-polish.mjs`: all-night practice, timed unlocks, action focus, standstill dashes, creeping, zoom camera, zoomed pause, modal focus and reduced-motion restarts.
- `tests/e2e/moonlight.mjs`: actual browser controls, path tapping, save/resume, pause, interrupted input, reduced motion, full heist/results, asset recovery and phone layouts.

Human pacing, animation feel, real-device touch and a sound review remain useful follow-ups; automated play proves that objectives can be completed, rather than human difficulty.
