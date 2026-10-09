# Pawprint Detectives

Game 29 at `/detectives`, built 10-10-2026. Three gentle, untimed mysteries set in the approved painted autumn village. The notebook records observations rather than awarding points for clicking. Every final explanation requires four established deductions.

## Cases and reasoning

| Case | Main question | Clues | Required deductions |
| --- | --- | --- | --- |
| The Missing Moonberry | Who moved the festival berry, where and why? | 7 (6 essential) | After closing, the visitor, route, safekeeping |
| The Silent Festival Bell | What quieted the bell, and why? | 7 (6 essential) | Padding, the scarf owner, the roost, kindness |
| The Vanishing Seed Parcel | Where are the seeds, and what caused the mix-up? | 7 | Delivery, arrival, sealed contents, swapped labels |

The bakery, market and old mill are available to explore. Case one starts at the bakery; later cases start at the market. Dora examines physical clues and Enzo follows scents. Scent sources require prior observations, while the pantry message, roost request and sealed parcel require specific deductions. These gates are monotonic: new evidence does not remove old progress, and forward/reverse exploration reaches the same conclusions.

Witness questions add their account to the notebook. Established evidence enables follow-up questions, without replacing the original recorded account. The cast is Bruna the badger baker, Finn the owl clockkeeper, Milo the mouse mill helper/carrier and Wren the vole gardener.

Tap two discovered cards, or drag one onto another, to compare them. Useful pairs offer three candidate conclusions. Only the authored supported claim establishes a deduction; unsupported new claims increment the mistake count. Unrelated comparisons are exploratory and do not cost stars. Reviewing an established deduction cannot lower the grade. The final dialog remains unavailable until all four deductions are established, then requires three answers. Exactly one of the 27 combinations fits each case.

Solving gives one star, plus one for no unsupported conclusions and one for no hints. Stars keep the best grade per case. Solving any grade unlocks the next case. Hints first point to an available missing observation, then a useful comparison; they never automatically solve the case. Replaying does not erase earlier grades.

## Controls and accessibility

- Select a marker, then **Examine**, **Follow scent**, or **Ask a question**. The tools switch to the appropriate detective. **E** examines, **S** follows scent, **T** talks and **Q** switches characters.
- Location tabs and the clue list provide button alternatives to scene markers. Phone notebook cards use two columns and quick links return to the village or notebook. Notebook tap pairing works on touch; mouse drag/drop accepts only valid discovered clue IDs. The information button reopens an observation.
- **P / Escape** pauses or closes the current dialog; **M** toggles sound. Dialogs contain keyboard focus. Native buttons and final-answer selects keep their controls. Focus loss/hidden tabs pause the case.
- **Save & menu** preserves the investigation; **Continue** restores it paused. There are no time limits, lives or combat.

## Artwork and saves

Six runtime assets preload: three empty location backgrounds, a character atlas, a clue atlas and a blank notebook painting. Characters, props, hotspots, speech, cards, connections, counters and explanations are live. Dora retains dark ruby eyes and Enzo black eyes. Characters approach selected clues, breathe gently, and scent trails/leaf drift/discovery glints animate over the painted scene. Pause, dialogs and reduced-motion preferences control decoration without changing deductions. [Exact prompts, source paths and atlas regions](detectives-art.md).

`pawprint-detectives-v1` stores best stars. `pawprint-detectives-run-v1` stores case/place/hero, discovered IDs, proved deductions, current focus/pair, mistakes and hints. `Game.load` validates IDs, uniqueness, clue prerequisites, deduction evidence, focus location, pair membership and field ranges. Finished cases are not resumable. Dialogue/speech, unpaired card selection and animations are transient. Saves write after actions; results bank immediately and remove the finished run. `pawprint-detectives-sound-v1` stores mute. Missing storage or audio does not stop play.

## Code and validation

`lib/detectives-game.ts` contains deterministic authored definitions and rules. `lib/detectives-scene.ts` draws only. `app/detectives/` handles input, native dialogs, notebook interaction, persistence, responsive layouts and synth cues. The single-player browser hook is `window.__detectives()`.

`npm run test:detectives` checks all three cases in two exploration orders, abilities/gates, supported links, unique explanations, hints, witness follow-ups, duplicate reads, pause, action snapshots and malformed saves. `tests/e2e/detectives.mjs` completes every case through actual UI controls and validates dialogue, follow-ups, drag/tap, results/unlocking, save/resume, modal focus, reduced motion, loading recovery, and four phone layouts with native touch cancellation.

Human story pacing, real-device feel and a listening pass remain useful follow-ups; the tests establish logical solvability and interface correctness.
