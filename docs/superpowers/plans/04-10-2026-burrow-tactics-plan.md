# Burrow Tactics · implementation plan

Written 04-10-2026. Spec: [`../specs/04-10-2026-burrow-tactics-design.md`](../specs/04-10-2026-burrow-tactics-design.md). Branch `feat/burrow-tactics`, stacked on `feat/dustbound-combat`.

Tick a box when its step is committed.

- [x] **1. Engine core.** `lib/burrow-tactics-game.ts`: board, units, movement, pushing, damage, the six chinchilla actions, Groom, the seven predator attacks, predator thinking, marks, turn loop, win and lose, events, snapshot and restore, preview, forecast, undo, reset turn.
- [x] **2. Engine tests.** `tests/burrow-tactics.mjs` covering every rule in the spec; wire `test:tactics` and the `npm test` lists in `package.json`.
- [x] **3. Campaign and run.** `MISSIONS`, stars, hero unlocks, `makeField`, `Run` with rewards, relics and saving; tests for each.
- [x] **4. Bot.** `tests/burrow-tactics-bot.mjs`: planner on cloned battles; thresholds in `npm test`; `bot:tactics` script. Tune balance against it.
- [x] **5. Scene.** `lib/burrow-tactics-scene.ts`: isometric board, three region palettes, chinchillas with coats and props, seven predators, telegraphs, previews, event player with tweens, particles and damage numbers, tile picker, icons.
- [x] **6. Page.** `app/tactics/`: home (campaign list, run card, roster), battle HUD (turn, warren, forecast, chinchilla cards, action buttons, end turn, undo, reset), reward and result screens, keyboard and touch, saving, `window.__tactics()`.
- [x] **7. Look at it.** Run the dev server and play it in a browser; fix what looks or feels wrong. Repeat until it is good.
- [x] **8. Arcade wiring and docs.** `GAMES` card, the hardcoded counts in the README checklist, README row and guide, `docs/burrow-tactics.md`, `CHANGELOG.md`, `HANDOFF.md`, panel-contrast route list.
- [x] **9. Browser test.** `tests/e2e/burrow-tactics.mjs`, added to `test:e2e`.
- [x] **10. Verify and ship.** `npm run typecheck`, `npm test`, `npm run build`, browser suite; push; open a draft pull request. Do not merge.
- [x] **11. Iterate.** Sound, extra polish, balance passes, anything the play-through shows. Done on 04-10-2026: run budget raised and Grandpa Pebble's move raised to 3 after measuring the bot; info line made live; attack arrows drawn over creatures; portraits unclipped; a how-it-works strip, a best-run record and a distinct rustling-grass badge added; phone layout tightened. Five missions were played through the page with scripted mouse clicks without a mismatch.
