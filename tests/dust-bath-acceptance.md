# Dust Bath Dash acceptance record

Verified 2026-09-09 on the existing local dev server at port 3000, Chromium desktop and mobile emulation. No production-only test hooks or game-state injection are used in the browser suite. This records the depth-and-polish overhaul that replaced the single hold-release loop.

| Requirement | Concrete evidence | Result |
| --- | --- | --- |
| Richer chinchilla variety with distinct needs | Engine `BREEDS` test: six breeds, two VIPs, temp/grain/patience/tip spread; browser shows breed labels and VIP tags | Pass |
| Temperature & grain wishes with prep controls | Engine match-bonus test (matched pay > mismatch); browser cycles tub warmth label and coloured tub art | Pass |
| Multi-stage bath (pour → scrub → fluff → style) | Engine stage-advance test (stage index climbs, pays only on final stage); browser stage chips and repeated keyboard/touch stages per guest | Pass |
| Combo / streak multiplier for flawless baths | Engine multiplier test (streak grows, payout scales, sneeze/miss resets); browser combo-streak stat tile | Pass |
| VIP guests scale in over the shift | Engine VIP test: a four-stage VIP arrives within a long shift as `vipChance` rises | Pass |
| Escalating difficulty across a shift | Engine spawn factor shrinks patience and arrival gap with elapsed time; `wave` counter shown in the waiting nook | Pass |
| Overlapping guests and simultaneous baths | Up to five in the queue, three (or four with the lounge) baths; sneeze splashes only occupied neighbours | Pass |
| Progression that matters, six upgrade tiers | Engine buy test: costs/phase/ownership, lounge opens a fourth bath, scoop lifts dust to 8, towels+thermo+dryer widen windows, decor adds patience; browser installs all six | Pass |
| Persist coins & upgrades across shifts | Engine `restore()` guarded to pre-shift; SSR-safe `localStorage` save/load; browser reload keeps coins and six installed upgrades | Pass |
| Keep cozy untimed mode | Engine 600 seconds no timer/departures; browser 180 seconds without departures, close-to-shop flow | Pass |
| Deterministic seeded engine, no DOM/wall clock | `npm run test:dust-bath`: 18 named groups, seeded replay, bounded queue, invalid actions/dt, time-chunk tolerance | Pass |
| Richer art & animated spa scene | Layered SVG chinchillas with gradients/expressions/VIP crowns, mosaic patches, distinct Dora (white) / Enzo (grey), backdrop (sun, hills, shelf), floating dust motes, sparkle on perfect baths | Pass |
| Responsive 320px, no overflow, contrast, ARIA | Browser 390px and 320px zero horizontal overflow; labelled meters/live regions/aria-pressed; keyboard hold and native touch; reduced-motion emulation | Pass within tested scope |
| MAIN ARCADE, eleventh card, existing names | Return link href `/`; home has 11 cards and “Eleven ways”; only the existing Dust Bath card, no other game touched | Pass |
| Repository checks | `npm run typecheck`, full `npm run test`, `npm run build`, `node tests/e2e/dust-bath.mjs`, `node tests/e2e/arcade-navigation.mjs` (11 cards) | Pass |
| Context graph | `graft build` refreshed after code changes | Pass; generated graph ignored by repo git rules |

## Scope and limitations

- Coins and upgrades now persist across reloads via `localStorage` (key `dust-bath-save-v2`), guarded with try/catch and an SSR check. If storage is unavailable the game still runs in-memory for the visit.
- Browser timers use Playwright's controlled clock. Blur/hidden-tab lifecycle handlers are explicitly dispatched, not a physical OS tab-switch test.
- Mobile tests use Chromium touch emulation at 390px and 320px, not physical hardware. No screen-reader session or full automated WCAG audit was performed; contrast was chosen against the light spa palette and reviewed visually.
- Production build succeeds with the repository's pre-existing large-chunk warning and vinext route-classification notice. No deployment was performed.
- The `easy` (two-tap) toggle is component state and resets on reload, by design; persistence covers coins and upgrades only.

Screenshots are generated outside the tracked source under `$JCODE_SCRATCH_DIR/dust-bath-desktop.png` and `dust-bath-mobile.png` (or `.checks` when unset). Before/after comparison shots are also captured as `before-*` and `after-*` in the same directory.
