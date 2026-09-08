# Dust & Documents remake: requirement-to-evidence matrix

## Scope and evidence quality

Audit date: **2026-09-08**. Implementation commit: **`79cfe44`**. This follow-up changes tests and documentation only. The product remains `/checkpoint-remake`, with `/checkpoint` preserved.

Each row maps a request or changed public behavior to a specific observation, not just an aggregate test count. The evidence labels below distinguish actual UI workflows, controlled fixtures, geometric sampling and source/process checks.

- **E1/E2**: `tests/checkpoint-remake.mjs`. Deterministic engine tests. E1 is the original section, E2 is the explicitly labeled accounting/evidence/guard extension.
- **W**: `tests/e2e/checkpoint-remake.mjs`, from its opening arcade assertions through the timed-second-day/mobile checks. Real Chromium UI, real WebGL, first complete shift, both verdicts and actual animation waits.
- **V1/V2**: labeled sections in that same file. Production Three scene instantiated in a real browser, advanced in deterministic 0.1-second steps. These are scene integration tests, not a claim that a human played every species.
- **V3**: actual original-edition link navigation, opening the original WebGL booth, judgment and next-case smoke test.
- **B1–B6**: `tests/e2e/checkpoint-remake-behavior.mjs`. Actual React UI and engine, with **WebGL deliberately unavailable** for the document-only fallback. B2 plays a complete **55-case, seven-day fallback UI week** by reading documents/rules and clicking controls. No engine state, traveler data, score or ending is injected. B5 separately uses a controlled browser clock and **synthetic `document.hidden` values**. B6 aborts the scene module download instead of disabling WebGL.
- **S**: source/diff inspection, runtime routing evidence or generated screenshots, identified per row.

**A full seven-day WebGL/animated browser week was not performed.** The full week was performed through the real document-only fallback UI. Real WebGL workflow coverage is one full shift plus a timed second-day opening, augmented by all-species production scene integration checks. This distinction is intentional.

## Explicit request and delivery constraints

| ID | Requirement | Concrete check and observed result |
|---|---|---|
| R01 | Implement first using GPT-6 Astra | Coordinator tool-transcript evidence, confirmed by coordinator on 2026-09-08: `swarm list_models` at 06:48:58 UTC reported coordinator `gpt-6-astra` and availability via `openai-oauth`. Worker spawn at 06:49:38 explicitly set `model: "gpt-6-astra"`, `effort: "low"`, label `Checkpoint remake`, and returned worker session `session_poodle_1788850178640_5e6d8feaddb60a5e`. **Routing selection verified**, not independent attestation of model internals. |
| R02 | Substantial isolated remake at `/checkpoint-remake` | W follows the arcade link, waits for `.rm-brief`, opens the booth and completes a shift. B2 reaches the successful ending through this route. Observed new page, stylesheet, engine and scene in `79cfe44`. |
| R03 | Preserve playable `/checkpoint` | S: `git diff 79cfe44^ 79cfe44 -- app/checkpoint/page.tsx lib/checkpoint-game.ts lib/checkpoint-scene.ts tests/checkpoint.mjs` is empty. Baseline `npm test` passes. V3 follows the original-edition link, loads its WebGL canvas, makes a judgment and advances to `1 / 5 processed`. |
| R04 | Read existing page, engine, scene and tests before implementation | Session tool transcript read `app/checkpoint/page.tsx`, `lib/checkpoint-game.ts`, `lib/checkpoint-scene.ts`, `tests/checkpoint.mjs` and `lib/chinchilla.ts` before writing remake files. Existing tests were rerun successfully. |
| R05 | Own new files, do not alter baseline files | Implementation diff contains seven added files and only the later-authorized `app/page.tsx` modification. Original checkpoint files are unchanged. Follow-up diff is tests/docs only. |
| R06 | Add arcade menu integration while retaining original | W asserts ten `.arcade-card` elements (including the restored Classic), the updated “Ten ways to play.” heading, exactly one `/checkpoint-remake` card and one `/checkpoint` card. Both editions are reachable. |
| R07 | Use existing React and Three dependencies | `package.json` and dependency lockfile have no implementation diff. Imports resolve against existing dependencies. `npm run typecheck` and `npm run build` pass. No dependency installation was needed for the game. |
| R08 | Do not spawn workers | Process transcript contains no worker spawn action by this worker. All implementation, audit and test work was done directly. Coordinator-to-worker routing is separate from worker spawning. |
| R09 | Validate typecheck and new engine tests | `npm run typecheck` passes. Explicit TypeScript compilation of remake engine followed by `node tests/checkpoint-remake.mjs` passes E1 and E2. |
| R10 | Use real browser if available, checking built-in browser status first | Built-in browser `status` was called first. Setup was attempted but required extension approval. Existing Playwright Chromium then ran W/V/B suites. This was reported, not represented as a working built-in bridge. |
| R11 | Persistent regressions and scoped commit/report | Tests are tracked in `tests/checkpoint-remake.mjs`, `tests/e2e/checkpoint-remake.mjs` and `tests/e2e/checkpoint-remake-behavior.mjs`. Implementation was committed as `79cfe44` and reported with routes, tests and limitations. Follow-up commit is restricted to these tests and docs. |

## Booth, anatomy and motion

| ID | Public requirement/output | Concrete check and observed result |
|---|---|---|
| V01 | Dora and Enzo clearly visible side by side | V1 asserts equal rig Z positions and non-intersecting full character bounds. Screenshot inspection of `remake-booth.png`, `remake-mobile.png` and `remake-approved-gate.png` showed both inspectors visibly separated. |
| V02 | Correct characters and facing toward traveler | V1 asserts Dora's `root.userData.white === true`, Enzo's is false, and transformed model-forward vector Z is less than `−0.99` for both. Observed forward approximately `(0, 0, −1)`. |
| V03 | Anatomically safe inspector placement | V1 samples eight idle animation phases. No inspector mesh bounding box intersects the counter. Character bounds do not intersect one another, the back wall or roof. Diagnostic sample: Dora X `[-2.081,-0.519]`, Enzo X `[0.519,2.081]`, maximum head/ear Y below `2.20` versus roof underside `3.13`, maximum back/tail Z below `4.68` versus wall front `4.81`. Counter check is mesh-based, not a claim that individual fur strands are collision simulated. |
| V04 | Scale physically separate from exit | V2 checks full traveler bounds against scale bounds X `[-2.95,-1.65]`, Z `[-0.70,0.40]` throughout both routes for all five species. No intersection observed. The scale is visually separate in the approved-gate screenshot. |
| V05 | Separate, traversable gate lane | V2 requires traveler bounds to stay within Z `[-2.5,-0.55]` once X exceeds `0.4`, and not intersect counter, scale, gate post or live gate-arm bounds. All ten species/verdict runs pass. |
| V06 | Turning and walking without collision or sideways sliding | E1 samples routes every 0.01 seconds and asserts continuous speed-bounded movement. E2 asserts changing-heading segments have no translation and walking displacement aligns with facing with normalized dot product above `0.99`. V2 adds sampled actual model bounds. |
| V07 | Gate actually raised before approved passage | V2 asserts arm rotation above `1.4` radians when traveler X is between `4.2` and `4.8`; actual geometry remains disjoint. `remake-approved-gate.png` was inspected and shows the traveler within the lane with the arm upright and inspectors unobstructed. |
| V08 | Approved and denied destinations differ | E1/E2 and V2 assert approved final `(8, -1.5)`, denied final `(0, -6)`, and `complete === true`. All five species pass both destinations. |
| V09 | No premature next traveler or interrupted departure | W asserts the next-case button is disabled immediately after each verdict, waits for real animation completion, then clicks it. Both approval and denial were exercised in the first shift. |
| V10 | All five traveler species render and depart | V2 iterates chinchilla, viscacha, fox, owl and viper with both verdicts, performs actual WebGL renders and checks collision clearance and completion. B2 separately encounters all five species in the full fallback UI week. |
| V11 | Polished coherent booth/environment and responsive inspection presentation | Desktop, mobile and gate screenshots were generated and visually inspected: open-front booth, daylight mountain backdrop, separately lit inspectors, labeled equipment, green/cream document palette and separated paper/rule/evidence hierarchy. W checks no horizontal overflow at 390×844. Aesthetic quality is a visual judgment, not proven by numeric assertions. |

## Inspection, timing, economics and endings

| ID | Changed public behavior/output | Concrete check and observed result |
|---|---|---|
| G01 | Briefing, day/date, quota and escalating rulebook | B2 asserts `01` through `07`, rules dates `1001` through `1007`, quotas `5,6,7,8,9,10,10`, and the displayed processed count after every decision. The UI-derived solver encounters all eight rule categories. |
| G02 | Traveler identity, permit, species, purpose and measurement are available for comparison | B2 reads all displayed card/permit fields, seal status, scale grams and rulebook to decide every case. It makes 55 correct decisions without inspecting the engine object. Starting identity is ROCO and the full starting document/rule snapshot matches after restart. |
| G03 | Clicking document fields selects matching discrepancies | B1 clicks each of the eight `.rm-field` controls: Full name, Home region, Species, Purpose of entry, Issued to, Issuing region, Valid through and Declared weight. Each matching reason's `aria-pressed` becomes true, field receives `selected`, and denial enables. Clicking the reason clears the field and disables denial when no reasons remain. |
| G04 | Seal and missing-permit affordances work | B1 toggles the seal twice and checks the Missing seal chip. B2 clicks “Flag missing permit” for each missing-permit case and asserts the matching chip selection before making a decision. Missing-permit cases were actually encountered. |
| G05 | Multiple reasons, reason count and locked findings | B1 selects two reasons and checks `2 REASONS`. B2 asserts all eight chips and all document fields are disabled after every judgment. E2 confirms engine toggles cannot alter evidence after judgment. |
| G06 | Denial requires evidence and rejects unsupported reasons | W/B1 assert deny disabled with no reasons. E1 asserts `decide(false)` returns null without a selection. E2 plants each of eight faults and verifies the matching denial passes; a mixed correct/incorrect reason set fails. B4 submits an incorrect name reason for an actual region discrepancy and gets a citation. |
| G07 | Valid papers can be approved; one supported discrepancy can deny | W completes a correct shift containing both outcomes. E1 verifies a single true reason is sufficient. B2 completes all 55 UI cases with 100% accuracy by selecting one supported reason or approving valid papers. |
| G08 | Decision stamp/feedback and pay are accurate | B2 checks good feedback and `+6 cr`, exact wallet increment and processed count after every case. B4 checks citation feedback, five `−3` deductions and bankruptcy. E2 asserts flags, correct/citation counters and corresponding `returned · +6 credits`/`−3 credits` ledger text. Region feedback retains the original generic “Region is closed today.” wording even for issuing-region mismatch; this is an inherited wording limitation, not a claim of precise per-subtype explanation. |
| G09 | Double decisions and phase misuse cannot duplicate income | E1/E2 assert a second decision returns null, credits do not change, early decisions/selection are ignored, repeated begin does not reset the timer, and rent and meals cannot be charged repeatedly. UI removes decision buttons after verdict. |
| G10 | Untimed default and optional timed shifts | E1 asserts untimed `tick(9999)` does not decrement. W checks timed day two starts at approximately 170 seconds after warm supper. B5 checks timer expiry through real rendered controls using the controlled clock. |
| G11 | Hidden-tab clock pause | B5 sets synthetic `document.hidden=true`, advances browser time five seconds and asserts no displayed countdown change. After setting false, two visible seconds deduct only about two seconds, not seven. **This covers the visibility branch with interval callbacks continuing, not actual OS suspension or browser timer-throttling behavior.** |
| G12 | Timeout without verdict closes shift; outstanding verdict stays readable | E1 covers both engine paths. B5 advances the browser clock through zero with no decision and observes the ledger with zero processed and rent paid. On the next shift it makes a decision, advances past zero and verifies the verdict remains until Next, which then opens the ledger. |
| G13 | Rent, available balance and report counters | B2 checks every ledger's processed, citations, rent and available credits exactly. Perfect week balances after rent/basic supper are `34,47,63,82,104,129,151`. E1/E2 prevent double rent and assert final total 55, final credits 151. |
| G14 | Budget choice, affordability and next-day bonus | W asserts warm supper deducts exactly 7 credits, locks both meal buttons, displays the 20-second bonus and gives the next timed shift 170 seconds. B2 asserts hay deducts exactly 3, displays zero bonus, locks both choices and enables next day. B4 asserts both choices disabled when unaffordable. E2 tests exactly 3 credits: warm rejected, hay accepted, zero savings after a paid meal may continue. |
| G15 | Reviewable cumulative ledger | B2 opens the report's native details/summary each day, checks cumulative entry count against decisions and checks the latest positive-pay text. Final count is 55. |
| G16 | Successful ending heading, narrative and exact stats | B2/B3 reach the actual fallback UI ending after seven shifts and assert “A little further north.”, the seven-mornings narrative and `55 decisions · 100% accuracy · 151 credits saved`. E1/E2 independently reach the engine ending. |
| G17 | Bankruptcy ending heading, narrative and exact stats | B4 intentionally makes five wrong calls through the UI and asserts unaffordable-supper message, “The lights go out.”, the packing-stamps narrative and `5 decisions · 0% accuracy · -8 credits saved`. |
| G18 | Restart really restores the game | B3 restarts after success and verifies day 01, 24 credits, untimed checkbox in that untimed run, and exact starting documents/rules. B4 separately restarts after bankruptcy and verifies briefing plus 24 credits. This does not claim that a previously selected timed-mode preference is cleared. |
| G19 | WebGL unavailable message does not block gameplay | B1 disables WebGL context creation and asserts the explanatory fallback text. B2 then plays the entire fallback week, with Next enabled rather than waiting for a nonexistent animation. |
| G20 | Scene download failure is separately recoverable | B6 aborts the scene-module request, asserts “Document inspection is still playable.”, makes a decision and advances to another document case. No engine injection or fake scene is used. |
| G21 | No new browser runtime errors on normal path | W/V assert collected `pageerror` list is empty. B1–B5 assert the same despite intentionally unavailable WebGL. B6 deliberately aborts a network request; an expected failed download is not counted as a normal-path console-cleanliness claim. |

## Observed executions

All commands run from the repository root against the existing local development server at `http://localhost:3000`:

```sh
npm run typecheck
npm test
npm run build
npx tsc lib/checkpoint-remake-game.ts --target es2022 --module es2022 \
  --moduleResolution bundler --outDir .checks --skipLibCheck
node tests/checkpoint-remake.mjs
node tests/e2e/checkpoint-remake.mjs
node tests/e2e/checkpoint-remake-behavior.mjs
```

Observed on 2026-09-08:

- Typecheck: exit 0.
- Existing full engine suite: exit 0, including original checkpoint tests.
- Production build: exit 0. Bundler emits non-fatal chunk/dynamic-import warnings; no claim of a warning-free production build.
- Remake engine E1/E2: exit 0. Explicit eight-fault, accounting, phase-guard, budget-boundary and facing checks pass.
- Extended behavior B1–B6: exit 0. Seven fallback UI shifts, 55 correct cases, all eight reason categories, all five species, 151 credits, both endings/restarts, field controls, both failure fallbacks and controlled timer paths passed.
- Real-WebGL W/V1/V2 suite: exit 0. First complete UI shift, warm supper, timed day two, mobile overflow, eight inspector animation phases and ten species/verdict route runs passed.
- Coordinator final rerun: typecheck and E1/E2 passed; W/V1/V2/V3 passed at 11:30 UTC, including original-edition navigation and warm-cost assertion. B1–B6 passed in task 847517uyav, including the full fallback week and scene-download failure.
- Audit exposed two test-harness problems: baseline navigation stalled after the heavy geometry harness, resolved by running it first in a separate page; the scene-download abort missed Vite timestamp query strings, resolved by matching the URL suffix. Both corrected suites were rerun to exit 0.

## Screenshot evidence and remaining limits

Local artifacts generated under `JCODE_SCRATCH_DIR` (not committed binary assets):

- `remake-booth.png`: desktop briefing and live booth.
- `remake-inspection.png`: document workspace and verdict.
- `remake-mobile.png`: 390-pixel mobile layout.
- `remake-approved-gate.png`: separate deterministic scene capture showing the arm upright and the traveler in the exit lane. This is a scene capture, not a screenshot claimed to be taken during a full UI week.

The first three are reproducible from W. The approved-gate capture was inspected during implementation. No frame-rate benchmark, physical weighing animation, save-data persistence, audio, Safari/Firefox run, continuous swept-volume proof, exhaustive screen-reader audit or OS-background-resume test is claimed. The scale is verified UI measurement data. Scene geometry assertions sample actual production geometry at fixed intervals. Full animated-week coverage remains outside the completed run; fallback full-week coverage is explicit above.

## Whole-result rerun and outcome (11:33 UTC)

Coordinator reran the entire command block above sequentially with fail-fast enabled against commit `aebadc2`. Task `107214as4e` exited 0 on 2026-09-08 at 11:33 UTC. This supersedes earlier worker-only execution evidence: typecheck, baseline engine suite, production build, E1/E2, W/V1/V2/V3 and B1–B6 all passed together on the completed result. Original source and dependency diff checks were empty; worktree was clean before this evidence entry. Every executable row above is backed by this run. Historical process rows R01/R04/R08/R10 remain transcript checks, not replayable game tests. Visual aesthetic judgments remain subjective.

Concrete improvements demonstrated, not just inferred from appearance:

- The reported clipping/facing problem now has measured acceptance evidence: both inspectors face the traveler, remain separated across eight animation phases, and all five traveler species complete both routes without sampled scale/counter/post/arm overlap. Moving route segments align with facing and gate passage occurs with arm above 1.4 radians.
- Inspection is now interactive rather than a bare approve/deny choice: all eight document-field controls toggle matching evidence; denial without evidence is blocked and unsupported reasons receive citations. All 55 UI cases in fallback mode were decided correctly from rendered documents/rules.
- Timing and budget choices have observable consequences: warm supper charges 7 credits and yields a 170-second next shift; hay charges 3; unaffordable meals lead to the rendered bankruptcy ending. A perfect seven-day fallback UI run ends at 55 decisions, 100% accuracy and 151 credits, while five incorrect calls produce the distinct bankruptcy ending. Both restart flows restore the initial game.
- Original edition still loads a real WebGL booth, accepts a verdict and advances to its next case. The remake works when WebGL is unavailable or its scene download fails, and has no horizontal overflow at 390-pixel width.

These checks establish the requested functional improvements. They do not establish that players find the remake more fun, prove continuous collision freedom, or replace the explicitly unperformed full animated-week and real OS-suspension tests.
