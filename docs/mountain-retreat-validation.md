# Mountain Retreat acceptance record

Implemented 2026-09-10 as cabinet 12 at `/mountain-retreat`. No existing game page, engine, style or asset was edited. Shared navigation, metadata, package scripts, README and navigation-count assertions were updated.

## Requirement to evidence

| Requirement | Concrete check and observed result |
| --- | --- |
| One polished pixel cutaway lodge | Desktop 1440px and mobile 390px screenshots inspected. Four distinct room interiors, locked-room blueprints, stars and added decor. Screenshots generated under `.checks/mountain-retreat/` (ignored). |
| White Dora and grey Enzo, equal main characters | Browser asserts two accessible images of each on a fresh lodge. Both have same-size portraits, individual allocation controls, animated room sprites and shared outing sprites. Visual inspection confirms distinct fur colors. |
| Idle production, tips and hearts | Engine asserts six seconds yields one guest, two tips, one heart and net three supplies. Browser advances 90 seconds and purchases the kitchen with earned tips. |
| Meaningful allocations | Engine compares welcome/gather, comfort/craft and welcome/craft throughput, hearts, stock and tips. Browser selects comfort with Enter and crafting with pointer, then verifies persisted selection. UI states each rate and stock tradeoff. |
| Upgrades and visible unlocks | Engine checks affordability, ordered unlocks, invalid indices and level-three cap. Browser opens all four rooms and improves hearth, asserting unlocked classes and visible decor. |
| 5–10 minute visits | Deterministic fresh-game progression opens kitchen at 90s, suite at 270s and bath at 492s without expeditions or upgrades. This is a pacing check, not a longitudinal usability study. |
| Expeditions/festivals pause normal work | Engine asserts unchanged normal elapsed time, stock and coins before completion, exact costs/rewards and rejection of concurrent outings/upgrades. Browser verifies frozen tips, disabled host controls and +35/+110 tips at completion. |
| Offline activity completion and remainder | Engine restores a 45-second expedition after 51 seconds and verifies exactly one reward followed by six seconds of normal work. Repeat restore at the same timestamp adds nothing. |
| Eight-hour offline cap | Engine compares eight-hour and forty-hour restores. Browser ages a journal by 24 hours, observes 480-minute payout and confirms immediate reload does not pay twice. |
| Robust saves and SSR | Engine rejects malformed JSON, wrong versions/types, negative/fractional/out-of-range timestamps/resources, invalid room sequences and invalid activities. Future timestamp awards zero. Browser exercises malformed recovery, blocked storage with playable in-memory state, normal reload and an untouched unrelated save sentinel. Typecheck and production SSR build pass. |
| Keyboard, touch, responsiveness, motion | Browser uses keyboard Enter and touch taps, opens/closes guide, checks no overflow at 320/390/768px, and checks `mr-bob` animation becomes `none` for reduced motion. Native buttons provide focus and selected/disabled semantics. |
| Twelve-card navigation | Updated navigation e2e visits all twelve routes and returns to twelve cabinets. Classic's two stale ten-card assertions were changed to twelve, with no gameplay assertion changes. Dust Bath’s stale eleven-card return assertion was also updated to twelve. |
| No accounts or services | Implementation uses no account, payment or remote-data API. Dedicated localStorage key only. No new dependency or lockfile changes. |

## Executed validation

- `npm test`: passed all wired existing deterministic suites plus 12 Mountain Retreat cases.
- `npm run test:mountain-retreat`: 12 cases passed.
- `npm run typecheck`: passed.
- `npm run build`: passed, includes `/mountain-retreat` in SSR route output. Existing large-chunk and vinext route-classification warnings remain.
- `node tests/e2e/mountain-retreat.mjs`: passed in Chromium, including all visible room unlocks and reduced-motion checks.
- Scoped `oxlint` for the new page/layout, engine and test files: zero errors or warnings. Explicit documented exceptions preserve the repository's imperative-engine rendering and full-navigation convention and represent CSS pixel artwork accessibly.
- Existing browser regressions: Classic and all twelve navigation routes passed. Fighter independently completed with no browser errors. The aggregate `npm run test:e2e` was stopped after approximately five minutes in the unchanged legacy checkpoint scenario, whose last output was `docs: 2 | permit rows: 0`. No full aggregate-browser pass is claimed.
- `git diff --check`: passed.
- `graft build`: refreshed local ignored graph cache.

## Limitations

Single lodge, no audio, cloud sync, account, cross-device persistence or cross-tab conflict resolution. Use one open tab. Local wall-clock time is trusted, so manually changing the device clock or editing the save is not anti-cheat protected. Storage denial allows play but cannot retain progress. Resource counters cap at one billion and supplies at 120. Browser coverage is Chromium desktop/mobile emulation, not physical-device Safari or Firefox testing. Offline tests use controlled timestamps, not an eight-hour wall-clock soak. Global `npm run lint` fails in existing helper scripts, UI components and older games; these unrelated files were not altered.
