# Dust Bath Dash acceptance record

Verified 2026-09-09 on the existing local dev server at port 3000, Chromium desktop and mobile emulation. No production-only test hooks or game-state injection are used in the browser suite.

| Requirement | Concrete evidence | Result |
| --- | --- | --- |
| Dora white / Enzo grey, polished spa and tutorial | SVG duo, three tutorial steps, desktop/mobile screenshots and visual review | Pass |
| Select customer then bath | Engine seat/selection/occupied-bath guards and browser selected-state/seating assertions | Pass |
| Hold and release sweet spot | Engine early/perfect/late outcomes, browser Space hold, mouse capture release outside button, native touch hold/release | Pass |
| Sneezes and neighboring splashes | Engine occupied-neighbor-only mess checks, browser sneeze text and adjacent bath mess | Pass |
| Enzo dust and treats | Exhausted dust blocks scrub, refill cooldown/restock, treats restore patience/remove mess, browser supplies reset to 6/6 and 3/3 | Pass |
| Two-minute shifts | Engine exact 120-second ending, browser clock to 0:00, summary, restart and reset stats | Pass |
| Coins, upgrades, decor and towels | Browser earns nine services and 106 coins, buys all upgrades for 95, retains 11; visible towels/ferns; engine verifies wider sweet spot, half splash, faster refill and extra patience | Pass |
| Untimed cozy | Engine 600 seconds, browser 180 seconds without timer/departures, explicit close-to-shop flow | Pass |
| Keyboard, touch and accessible alternatives | Native buttons, focus styling, labeled meters/live feedback, keyboard hold, native touch cancellation, two-tap mobile service, reduced-motion emulation | Pass within tested scope |
| Pause, guide, background safety | Engine freeze/cancel checks, browser pause/resume, guide freeze, dispatched blur/visibility handlers | Pass |
| MAIN ARCADE, eleventh card, existing names | All 11 return-link cases pass; home contains 11 cards and “Eleven ways”; only new card appended; metadata and README diff reviewed | Pass |
| Deterministic standalone engine | `npm run test:dust-bath`: 12 named groups, seeded replay, bounded queue, invalid actions/dt, time-chunk tolerance | Pass |
| Repository checks | `npm run typecheck`, full `npm run test`, `npm run build`, `git diff --check`, focused oxlint on four new TS/JS files | Pass; focused lint 0 warnings / 0 errors |
| Existing navigation and remake regression | `node tests/e2e/arcade-navigation.mjs` and `node tests/e2e/checkpoint-remake.mjs` | Pass, including original booth and remake shift/mobile/WebGL paths |
| Context graph | `graft build` | Pass; generated graph is ignored by repository git rules |

## Scope and limitations

- Coins and upgrades persist between shifts during the current page visit, not across reloads. The interface and README say so.
- Browser timers use Playwright's controlled clock. Blur/hidden-tab lifecycle handlers are explicitly dispatched, not a physical OS tab-switch test.
- Mobile tests use Chromium touch emulation at 390px and 320px, not physical iOS/Android hardware. No screen-reader session or full WCAG audit was performed.
- Production build succeeds with the repository's large-chunk warning and vinext route-classification notice. No deployment was performed.
- Focused lint documents exceptions for the intentionally mutable animation engine, hard arcade navigation and custom ARIA pressure meter. Repository-wide lint was not run.
- Initial checks caught floating-point exact-equality sensitivity, a pre-hydration start-click race, asynchronous React visibility assertions, and asynchronous CDP touch delivery. Final tests use numeric tolerance, disabled pre-hydration start buttons, and explicit UI readiness waits. Visual review also caught and fixed pale global paragraph colors on the light spa background.

Screenshots are generated outside the tracked source under `$JCODE_SCRATCH_DIR/dust-bath-desktop.png` and `dust-bath-mobile.png` (or `.checks` when unset).
