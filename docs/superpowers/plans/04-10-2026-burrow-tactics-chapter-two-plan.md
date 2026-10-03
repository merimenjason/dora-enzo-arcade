# Burrow Tactics · chapter two plan

Written 04-10-2026. Spec: [`../specs/04-10-2026-burrow-tactics-chapter-two-design.md`](../specs/04-10-2026-burrow-tactics-chapter-two-design.md). Branch `feat/burrow-tactics`, draft PR #5, never merge.

Tick a box when its step is committed and pushed.

- [x] **1. Engine.** Classes, second actions, ice / high ground / fire, objectives (escort, hunt, nursery), mole / skunk / bear, deploy, difficulty, `hint`; eight new missions; run rewards and bosses. Engine tests and the bot updated; `npm test` passes.
- [x] **2. Scene.** Draw the new terrain, the kit, the three predators, the den and nursery markers, the hint and deploy overlays, and animations for the new events.
- [x] **3. Page.** Deploy step, second-action button, hint button, guided first mission, difficulty picker, chapter-two mission list, class and second-action text on the cards, objective text in the HUD and result screens.
- [x] **4. Look at it.** Play the new missions in a browser, fix what looks or feels wrong. Done 04-10-2026: all eight chapter-two missions and a whole Standard run were played through the page with scripted clicks following the planner. Fixed on the way: the guide and hint bars now float over the board so it never jumps, the header stays one line high, Enter confirms an action aimed at oneself, a clickable tile wins over a creature standing in front of it, and the attack-order badge clears long health bars.
- [x] **5. Balance.** Rerun the bot over missions and runs on each difficulty; tune. Done 04-10-2026: wave budget 3.5 → 3.8 and Fierce at 1.3 ×; over 48 runs the planner wins 46 on Gentle, 41 on Standard, 23 on Fierce.
- [x] **6. Docs and tests.** `docs/burrow-tactics.md`, README guide, CHANGELOG, HANDOFF; browser test extended; typecheck, `npm test`, build, browser suites.
- [ ] **7. Iterate.** Anything the play-through shows.
