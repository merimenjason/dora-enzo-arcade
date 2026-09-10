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
- Dust Bath independently passed desktop gameplay and cozy-mode checks. Its stale card-count/headline expectations were fixed, and those exact return-navigation assertions passed a focused browser replay. A superseded full rerun was stopped because it had loaded the old headline assertion. Full spa mobile/shift coverage is not claimed for this change. No regression processes remain running.
- `git diff --check`: passed.
- `graft build`: refreshed local ignored graph cache.

## Limitations

Single lodge, no audio, cloud sync, account, cross-device persistence or cross-tab conflict resolution. Use one open tab. Local wall-clock time is trusted, so manually changing the device clock or editing the save is not anti-cheat protected. Storage denial allows play but cannot retain progress. Resource counters cap at one billion and supplies at 120. Browser coverage is Chromium desktop/mobile emulation, not physical-device Safari or Firefox testing. Offline tests use controlled timestamps, not an eight-hour wall-clock soak. Global `npm run lint` fails in existing helper scripts, UI components and older games; these unrelated files were not altered.

## Readability and theme update (2026-09-10)

Mountain Retreat now offers a route-scoped Light / Dark / System selector. System follows live device preferences and is the default. A separate `mountain-retreat-theme` browser preference preserves the choice without modifying game saves. Storage denial still allows in-memory theme changes. Other games are not themed by these selectors.

Guide paragraphs are explicitly 18px with 1.8 line-height, 28px headings and bounded line lengths. Supporting control descriptions are 14px, main controls 16px, and room labels 12px. Mobile cards reflow rather than shrinking the text. White Dora and grey Enzo retain authored pixel colors.

`node tests/e2e/mountain-retreat-theme.mjs` checks measured guide contrast (light 8.16:1, dark 9.96:1), selected and disabled button-label contrast >=4.5:1, font sizes, 320/390/768/1440 widths, remembered theme, live System changes, explicit overrides, denied storage, route isolation and zero page errors. Screenshots are in `.checks/mountain-retreat/theme-*.png`. This is focused contrast and Chromium layout testing, not a complete WCAG certification. Existing lodge gameplay e2e and all 12 engine cases also pass, alongside typecheck, scoped lint and production build (existing warnings unchanged).

## Walking hosts and visiting guests (2026-09-11)

Dora and Enzo now tour the open rooms instead of standing still. `hostStop` in the engine picks each host's room from `elapsed`: Dora stops 8 seconds per room (hearth → suite → bath → kitchen), Enzo 12 seconds (kitchen → bath → hearth → suite), skipping rooms that aren't open. Because `elapsed` stops during expeditions and festivals, the hosts freeze with production. Moving between rooms side by side is a 1.4-second walk. Moving between floors is a hop: straight up or down when the rooms share a column, otherwise a walk and then a hop. The sprite faces the direction of travel.

Visitors follow the real guest-visit timer (`visitPeriod`: 6 seconds on Welcome, 10 on Comfort). For the three seconds before a visit, one visiting chinchilla per open room walks up the path, but only if there are enough supplies for the visit. After a visit that actually succeeds (the page watches `served` rise), each open room shows a guest at its furniture with a heart until the next visit. The scene caption says whether guests are on the path, staying, or the hosts are away. Guests come in five coat colours (beige, black velvet, violet, ebony, sapphire), each with a scarf. They are decorative (`aria-hidden`), so the accessible image count stays at two per host. Outings clear the hosts and guests from the lodge. Reduced motion removes every walk, hop and fade. The save format is unchanged.

Evidence: two new engine cases cover room tours, walking windows, only-open-room stops, freezing during outings, and the visit period (`npm run test:mountain-retreat`, 14 cases). `node tests/e2e/mountain-retreat-scene.mjs` seeds a four-room lodge and checks the starting rooms, four arriving guests visible on the path, four seated guests at full opacity inside their rooms, a delay-free climb from hearth to suite, a walk across from suite to bath, Dora inside the suite's bounds once she arrives, Enzo's tour, an outing clearing the scene, instant moves under reduced motion, no overflow and hosts inside the lodge at 320/390/768px, and zero page errors. Screenshots are in `.checks/mountain-retreat/scene-*.png`. The existing gameplay and theme browser suites still pass.
