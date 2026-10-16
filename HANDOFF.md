# Handoff · 15-10-2026

Where Dora & Enzo's Arcade stands, how the newest games fit together, how to check your work, and what is worth doing next. For the arcade as a whole, start with [`README.md`](README.md); for how the code is laid out and the traps to avoid, [`CLAUDE.md`](CLAUDE.md); for the documentation and changelog rules, [`AGENTS.md`](AGENTS.md).

This file replaces the handover of 26-09-2026 (`HANDOVER.md`), whose notes are folded in below.

## Start here (fresh session, 15-10-2026)

**Where things stand.** `main` is at the merge of PR #42 and is deployed: 34 games at https://chinchillas.jason.engineering. Nothing is open: no pull requests, no unmerged branches. The only local changes are three `.claude/` graft files (see **Agent configuration**), which are the user's and must stay uncommitted.

**What happened in the last few sessions (13–15-10-2026), newest first:**

| PR | What | Notes |
| --- | --- | --- |
| #42 | **Acorn Hand** (`/acorn-hand`), game 34 | Poker-scoring card run in the manner of Balatro. Built, bot-tuned, played by hand and shipped in one PR. See **Acorn Hand**. |
| #41 | Midnight Kitchen chef matte | The four painted chefs stood in pale boxes; `public/art/kitchen/chefs.png` was re-cut with OpenCV GrabCut. |
| #40 | Saga play-test fixes, Kitchen docs | A first clear selects the newly opened stage; a heal/shield hint; the empty summon label; `CLAUDE.md` count. |
| #39 | **Ember & Clover: Midnight Kitchen** (`/kitchen`), game 33 | Built in another session. |
| #38 | Saga hero trials | Six trials, Fennel and Sable (20 heroes), tier-six Ascendant gear, save version 2. Built in another session; reviewed and verified here before it merged. |
| #35–#37 | Saga painted art, loading, animation | Built in another session. |
| #33–#34 | **Whisker Saga** (`/saga`), game 32, and its docs | |

**The way work is done here** (the user has asked for this consistently):

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`). Pushing to `main` deploys, so never commit to it directly.
2. Commit only when the user asks. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; PR bodies end with the Claude Code line.
3. `gh pr create`, then `gh pr checks --watch`, then `gh pr merge --rebase --delete-branch`, then fast-forward local `main` and watch the deploy run for that SHA (`gh run watch <id> --exit-status`). The user's "merge and push" means all of that.
4. Every user-visible change gets a `CHANGELOG.md` entry in the same commit, under `## DD-MM-YYYY`. "Update the relevant md files" means README (guide, counts), `docs/<game>.md`, CHANGELOG and this file.
5. A new game follows the README **Adding a game** checklist in full; `npm test` fails if the README and `GAMES` disagree.

**Things that cost time in these sessions, so they don't again:**

- **A server-rendered page is not a ready page.** A browser test that clicks a button before React hydrates does nothing and then times out. Acorn Hand sets `data-ready` on `main` after mount and its tests wait for `main[data-ready="true"]`. Copy that pattern into any new game.
- **Chrome through the Claude-in-Chrome extension can't play real-time games here.** The window is not visible, so the tab reports `visibilityState: hidden` and `requestAnimationFrame` never fires. Play through headless Playwright instead.
- **Don't fake the clock to slow a real-time game down.** `page.clock.install()` made Saga run about six times fast, because every frame hit the loop's 0.1 s cap. Use real time and the game's own pause key between moves.
- **Playing a game by hand through Playwright.** `tests/e2e/.tmp/` (git-ignored) holds the scratch driver: `drive.mjs` keeps a browser open and serves `/click?sel=`, `/key?k=`, `/run?ms=`, `/eval?js=`, `/shot` on port 3999 (`URL=http://localhost:3000/<route> node tests/e2e/.tmp/drive.mjs`); `p.mjs` sends commands; `ah.mjs` prints Acorn Hand's state as text and takes actions (`c1 c2 play`, `disc`, `buyc1`, `collect`, `leave`, `start`); `go.mjs`, `st.mjs` and `t` do the same for a Saga battle, pausing at each wind-up. Stop the driver with `node tests/e2e/.tmp/p.mjs /quit`. The directory is not committed, so a fresh clone won't have it.
- **A context-mode hook blocks `curl` and inline `fetch(` in Bash commands.** Put HTTP calls in a script file and run it with node, as `p.mjs` does.
- **Foreground `sleep` is blocked.** Wait with `until …; do sleep N; done` in a background command, or `gh pr checks --watch`.
- **Some failures are not yours.** `tests/e2e/moonlight.mjs` and `tests/e2e/detectives.mjs` write screenshots to a fixed macOS path (`/Users/jasonchua/...`) and fail on any other machine; `tests/e2e/burrow-express.mjs` has a touch-drag check that passes and fails on reruns. All 49 suites were run on 15-10-2026: 46 passed.
- **Graft** is at 0.21.1 (0.22.0 available). End a reply with a graft tally only when graft was used in that turn, and never pipe graft through `head`/`tail`.

**What to do next, in the order I'd do it:**

1. **Play-test with real people.** Acorn Hand (does a focused build win too easily? the bot wins 33%, my hand-played run won comfortably), Whisker Saga (chapter 1 is samey and easy; trials punish idle heals and shields), Midnight Kitchen (never played by hand, no bot).
2. **Listen to the sound** in every game from Moonpond on. Nobody has heard any of it.
3. **Acorn Hand:** play a run by hand with vouchers and packs (antes 5–8 were raised for them); a harder stake for players who win (agreed as its own PR); drawn icons instead of emoji for items.
4. **Whisker Saga chapter 1 variety:** a spitter-heavy stage, an early brute, a second wind-up before the boss.
5. **Midnight Kitchen code split:** drawing lives in `app/kitchen/page.tsx` (about 700 lines); move it to `lib/kitchen-scene.ts` like every other game, and add `window.__kitchen()`.
6. **Test hygiene:** make the moonlight and detectives screenshot paths relative (`.checks/…`), and steady the Burrow Express touch-drag check.
7. Next new game, if wanted: the suggestions given on 15-10-2026 were physics mini-golf ("Burrow Links") and a merge-and-drop game like Suika ("Fluff Drop"); a rhythm game was ruled last because audio can't be checked here.

## Quality pass · 08-10-2026

The four newest games received a focused quality pass on `fix/newest-games-quality-pass`. PR #15 is merged to main.

- **Burrow Tactics** and **Burrow Barrage** bank finished battles immediately, while the result screen still waits for the animation. Leaving or reloading during a victory no longer loses stars or a run reward. A resumed Tactics reward is banked once.
- **Burrow Barrage** releases walking, charging and board gestures between turns and on focus loss. Cancelled walking presses stop walking. Focused sliders keep their native arrow-key controls, and Space sets power to zero immediately when charging starts. Results resolved by the computer read the latest save, preserving current sound settings and earlier stars.
- **Poof Panic** pauses matches and Endless on focus loss and clears held input and unfinished gestures. A cancelled gesture does not rotate or hard-drop a pair; ordinary taps still work after cancellation.
- **Summit Shuffle** keeps the hand scrollable on landscape phones and narrow tablets rather than spilling sideways, and its introduction describes shared cards and each hero's own cards accurately.
- **Older games, same pass (PR #18, merged 09-10-2026):** Chinchilla Clash, Hay Maze Defence and Chinchillas vs Zombies bank a result inside the game loop as soon as the engine ends the game (it used to happen on the page's next redraw, after the part-way save was already cleared), read the save through a ref, and pause on `visibilitychange` as well as `blur`. Clash forgets a card drag on `pointercancel`. Burrow Tactics reads its save through a ref too. `npm run test:e2e:older` runs the three suites and `tests/e2e/older-quality.mjs`. Its Clash and Hay Maze checks and the Zombies hidden-tab check fail on the pages as they were; the Zombies save, Tactics and layout checks passed before too and are there to keep it that way.
- **Repeatable checks:** `npm run test:e2e:newest` runs the four quality-pass browser suites, Burrow Express and `tests/e2e/newest-quality.mjs`. Run `npm test` first to compile the engines and keep `npm run dev` running. The quality suite includes portrait and landscape layouts at 320 × 568, 568 × 320, 390 × 844 and 844 × 390.

Validation completed with the project's locked runtime dependencies: typecheck, `npm test`, the production build, all four main browser suites, all 16 quality regressions and the contrast check across 26 routes passed. Screenshots of the four phone layouts were inspected; browser checks reported no page errors.

This is a browser and regression pass, not a human balance or sound review. Real-phone gestures, animation feel, a listening pass and end-to-end human campaign/climb playtesting remain open. The eight lint findings in these four pages were reproduced on the unchanged baseline; they predate this pass.

Still open from the layout checks: the Bounce / Burrow (`/adventure`) and Paw Fighter II (`/fighter`) pages are wider than a 390-pixel phone screen (about 512 and 400 pixels), so they scroll sideways there. Neither has a layout check yet.


## Burrow Express · 09-10-2026

Game 26, `/express`, was merged to main in PR #16 on 09-10-2026, following the merged quality pass. It has a guided tutorial, three maps, eight-day shifts and Endless; route construction, transfers, fleet and seat upgrades, hay, rocky ground, cave-ins, mid-journey saving and touch controls. Full rules and balance numbers: [`docs/burrow-express.md`](docs/burrow-express.md).

The usual split is `lib/burrow-express-game.ts`, `lib/burrow-express-scene.ts`, and `app/express/`. Checks: `npm run test:express`, `npm run bot:express`, `tests/e2e/burrow-express.mjs`, `tests/e2e/burrow-express-animation.mjs`. Save keys: `burrow-express-v1`, `burrow-express-run-v1`, and `burrow-express-sound-v1`. The browser hook is `window.__express()`.

Routes and saves preserve passenger identities. The route finder ignores lines without carts and blocked tunnels. Editing parks a cart's passengers at the nearest end of its current segment before reassigning it. Dawn choices stop the engine clock. `Game.load` checks geometry, references, resources and passenger conservation before returning a saved route. Bump `v` if the saved shape changes. The game now uses the approved mock-up's painted terrain, station/cart atlases and close-up portrait, preserving Dora's dark ruby eyes. See `docs/burrow-express-art.md` for asset provenance and prompts; editing controls are in the station/tools drawer.

Validation on 08-10-2026: typecheck, the complete engine/README suite, build, targeted lint, the full Burrow Express browser playthrough, arcade navigation and contrast across 27 routes passed. The planner won 9 of 12 seeded shifts, 3 of 4 per map.

On 09-10-2026, live passenger groups and exact counts replaced baked-in station characters. Active art loads stations-empty.png, passengers.png and rail-props.png alongside terrain, carts and duo. Routes use sleepers, rails, coloured strips, timber crossings and directional markers. Transit events are presentation-only and excluded from v1 saves. The renderer follows passenger identities; pause/reduced motion suppress hops and freeze decoration. Dust baths contain dry powder. The focused animation suite passed with identity, simulation independence, pause, reduced motion, overflow and restored-count checks. Typecheck, targeted lint, the complete engine/README suite, production build, both Express browser suites and contrast across 27 routes passed. The planner remains at 9/12 seeded wins. PR #16 has been merged to main.

Human balance playtesting, real-device gesture checks and listening to the cues remain open; the planner and browser playthroughs provide the first balance check. Merging future feature branches to main deploys them.

## Moonlight Mischief · 09-10-2026

Game 27, `/moonlight`, was merged to main in PR #17 on 09-10-2026. It has three timed stealth heists, untimed practice, two distinct heroes, vision occluded by cottages, noisy paths, dry dust, hiding, a rescue and both heroes returning home. Code follows the engine/scene/page split in lib/moonlight-game.ts, lib/moonlight-scene.ts and app/moonlight. Artwork derives from the approved mock-up; exact prompts are in docs/moonlight-art.md. Save keys: moonlight-mischief-v1, moonlight-mischief-run-v1 and moonlight-mischief-sound-v1. Run saves resume paused, clear transient input and rebuild the rescued friend’s route. Results are banked before leaving the win screen. The browser hook is window.__moonlight().

Checks: npm run test:moonlight, npm run bot:moonlight and tests/e2e/moonlight.mjs. Validation: typecheck, targeted lint, the full engine/README suite, production build, a complete timed browser heist with saved results and unlocking, four phone layouts, asset-failure recovery, and contrast across 28 routes pass. The engine planner completes all three timed nights through legal navigation and abilities. Human balance, real-device feel and a listening pass remain useful follow-ups. The refinement pass adds objective hints, both heroes’ attention meters and warnings, keyboard focus after actions, standstill dashes, mobile creeping, zoom follow with manual-pan grace, and all-night practice. Practice never bypasses timed unlocks or awards stars. Saved owl positions validate against actual patrol segments and the engine’s corner tolerance; snapshot checks cover whole runs and a catch recovery. The planner wins all 15 patrol-phase variations. The engine suite validates 1,433 snapshots throughout complete heists and a catch recovery. Both browser suites, targeted lint, typecheck, build and contrast across 28 routes pass. Focused regression: tests/e2e/moonlight-polish.mjs, included in both browser scripts. New features go through a PR; merging to main deploys.

## Pawprint Pinball · 09-10-2026

Game 28, `/pinball`, was merged to main in PR #21 on 09-10-2026. It follows the approved Clockwork Warren mock-up, with authored table/piece PNGs, deterministic 240 Hz ball physics, rotating capsule flippers, ball-to-ball collisions, rescue targets, guided raised ramps, dry dust locks and three-ball multiball. Arcade uses three berries; practice is unlimited. Launch and multiball ball-save windows are seven and twelve seconds. Three quick nudges produce a three-second tilt. Save keys: pawprint-pinball-v1, pawprint-pinball-run-v2 and pawprint-pinball-sound-v1. Results bank immediately; snapshots restore paused and clear held launch/flip input. Browser hook: window.__pinball().

Checks: npm run test:pinball, npm run bot:pinball and tests/e2e/pinball.mjs. Validation passes: typecheck, targeted lint, full engine/README suite, production build, complete three-ball browser run, saved physics/records, native two-finger controls and cancellation, four phone layouts, arcade navigation and contrast across 29 routes. The planner exercises eight seeded runs, reaching rescues, ramps and multiball; the engine suite validates 14,400 in-play snapshots. Geometry constants are shared with the scene. Raised ramps guide the ball along visible tracks; ordinary field movement uses collision physics. Art provenance and exact prompts: docs/pinball-art.md. Human flipper feel and a listening pass remain useful follow-ups.

Physics and hitbox pass, 09-10-2026: the first colliders were a rough sketch that did not follow the painting, so the berry crossed fences, stonework and the lantern boxes, bounced off unseen lines on open felt, and could not reach the rescue targets, which sat behind a wall. Every collider in `lib/pinball-game.ts` is now traced from `table.png` (see **Physics and controls** in docs/pawprint-pinball.md): the felt's edge is closed, the slot between the flippers is the only drain, the targets are studs on the stone wall, the ramps are entered from the two pockets, the launcher lane sits where it is painted, and the direct dust scoop is gone because nothing on the felt reaches the bowl. Flippers carry the berry (shot speed depends on where it leaves the paw), cushions kick only when struck and only from their painted face, and slow touches do not bounce. The flipper length (114) sets the difficulty: with the test planner an arcade run lasts about three minutes; nobody has tuned it by hand yet. `tests/e2e/pinball.mjs` wrote screenshots to a path on another machine and now uses `.checks/pinball`.

Follow-ups, merged 09-10-2026 and 10-10-2026: the physics pass is PR #22. PR #23 moves the plunger with the launch charge, adds the table animations listed in `docs/pawprint-pinball.md` and keeps the gold buttons gold under the mouse. PR #24 seats Dora and Enzo as a mirrored pair: beside the table in wide windows, over the control bar in squarer ones, with a browser check at five desktop sizes. Still not done by a person: playing the table by hand, and watching the short effects in motion (cushion flash, table rock, drain ripple, save streak, multiball wash). The chinchilla placement was looked at in screenshots at 1446 × 1202, 1920 × 1080 and 1366 × 768 only.

## Pawprint Detectives · 10-10-2026

Game 29, `/detectives`, is on `feat/pawprint-detectives` for review, based on main after Pinball PR #21. Three authored untimed cases use the same painted bakery, market and old mill, with live characters/clue props and an interactive parchment notebook. Case rules and clue content live in lib/detectives-game.ts; the scene is drawing-only. Dora inspects, Enzo follows scents, and witnesses have evidence-gated follow-ups. Each case needs four supported deductions and one unique three-part explanation. Unrelated comparisons and reviewing known facts do not cost stars; optional hints and unsupported new conclusions affect the best case grade. Save keys: pawprint-detectives-v1, pawprint-detectives-run-v1 and pawprint-detectives-sound-v1. Saved IDs and prerequisites validate against the case definition, resume paused, and discard transient dialogue/animation. Results bank once before the closing dialog. Browser hook: window.__detectives().

Checks: npm run test:detectives and tests/e2e/detectives.mjs. The engine suite proves forward/reverse exploration, no clue soft locks, unique final explanations across 27 combinations per case and valid action snapshots. Validation passes: typecheck, targeted lint, complete engine/README suite, production build, arcade navigation and contrast across 30 routes. The browser suite completes all three cases through actual controls and checks drag/tap pairing, dialogue/follow-up, native touch/cancellation, saves, focus, stars/unlocks, hints, reduced motion and phone layouts. Full rules: docs/pawprint-detectives.md; exact built-in imagegen prompts and atlas regions: docs/detectives-art.md. Human mystery pacing and a listening pass remain useful follow-ups. Merging the PR deploys the game.

## Frostpaw Frontier · 10-10-2026

Game 30, `/frontier`, is merged on main. It is a tile-by-tile survival builder in the style of Tiles Survive.

- **The loop:** a 13 × 13 mountain under cloud, explored with stamina next to held land. Survivors work farms, lodges and quarries, glow lanterns burn wood to speed up nearby workshops, and a raid comes every night. Five heroes (three found in ruins) clear predator dens, and the run is won by clearing the cougar from the summit and lighting the Summit Beacon.
- **Maps:** three, each opening the next, with three stars by day 15, 16 or 18.
- **Code:** the usual split, in `lib/frontier-game.ts`, `lib/frontier-scene.ts` and `app/frontier/` (page, styles, metadata and `sound.ts` on the shared `lib/cue-sound.ts`).
- **Saves and hook:** `frostpaw-frontier-run-v1` (the run in progress), `frostpaw-frontier-v1` (stars) and `frostpaw-frontier-sound-v1`. A saved run comes back paused, and a finished run's save is dropped the moment it ends. The browser hook is `window.__frontier()`. Full rules and every number: [`docs/frostpaw-frontier.md`](docs/frostpaw-frontier.md).
- **Checks:** `npm run test:frontier`, `npm run bot:frontier` and `tests/e2e/frontier.mjs`.
  - The engine suite covers maps, exploring, every rumour, building, work and food, lanterns, raids, defence, dens, training, winning and saves, including a mid-run save that carries on identically and ten kinds of refused save.
  - The settler bot wins 12 of 12 seeded runs, between day 13 and day 21, and `npm test` needs every map on seed 1 and at least 10 overall.
  - The browser suite plays through the controls on desktop and with phone taps.
- **Things to know:**
  - The page's camera (`camFor` in the scene) frames the land you hold plus a ring of cloud, at least seven tiles across, so the map is readable on a phone from the start. The browser test computes the same camera to click tiles.
  - `fill()` puts idle survivors in farms first while hay income is negative. Without it the bot deadlocked with every worker in a lodge.
  - The Canvas renderer now uses painted atlases from `public/art/frontier/`, loaded and cached by `lib/frontier-art.ts`. `lib/frontier-life.ts` plans cached safe routes and animation cycles without changing the engine; `tests/frontier-life.mjs` checks counts, obstacles, reassignment, damage, motion and state isolation. Alpha margins are trimmed once; the building row gutters have measured crop bounds. Original drawings remain available if artwork fails; the page offers retry. Tile coordinates, saves and rules are unchanged. Full art prompts and provenance: `docs/frontier-art.md`. `tests/e2e/frontier-art.mjs` covers layouts and failed-request recovery. Workers have four stable coat variants (`workers.png` adds white, cream and charcoal to the original grey-brown); map/card descriptions are tested in `tests/e2e/frontier-descriptions.mjs`, including keyboard focus on locked tools. Enemies use separate padded `enemy-*.png` assets so tails and paws cannot cross atlas cuts; `tests/e2e/frontier-enemies.mjs` checks safe margins and all five den icons.
- **Still to do:** human balance (the bot is a strong, stamina-perfect player), a listening pass, and real-device touch.

## Moonpond · 10-10-2026

Game 31, `/moonpond`, is merged on main (PR #30). It is a night-fishing journal: cast, hook the bite, work the reel, sketch the catch and let it go.

- **The loop:** 8 casts a night (12 with oil) across four hours, one weather and a moon phase that moves on each night. A cast is a charged throw into one of five waters, a bite to hook within 0.6 s, and a reel fought on a tension gauge.
- **The journal:** forty pages (thirty creatures, six curiosities, four legends) decided by water, hour, weather, lure and moon, each with a clue. Moon shells buy rods, lines, oil, bobbers, a spyglass and two lures; three neighbour requests pay extra.
- **Code:** the usual split, in `lib/moonpond-game.ts`, `lib/moonpond-scene.ts` and `app/moonpond/` (page, styles, metadata and `sound.ts` on the shared `lib/cue-sound.ts`), plus `lib/moonpond-art.ts` for the drawings.
- **Saves and hook:** `moonpond-v1` (journal, shells, gear), `moonpond-night-v1` (the night in progress) and `moonpond-sound-v1`. Both saves are written the moment a catch lands, a cast is lost or something is bought. `window.__moonpond()` returns the game, the scene and the pause flag; `pond.inspect(game)` reports what the picture is showing (held catch, release, hop, effects).
- **Art:** now painted, retaining the named `creature`/`prop` API in `lib/moonpond-art.ts`. `lib/moonpond-paint.ts` loads eleven runtime images and caches complete alpha silhouettes; `lib/moonpond-crops.ts` records measured atlas bounds. Background, dock, hero poses, props, five creature packs and two isolated outliers are separate from live state. Exact prompts and provenance: `docs/moonpond-art.md`. `tests/e2e/moonpond-painted.mjs` checks all forty entries, crop gutters, upgraded tension and retry.
- **Input:** presses and releases are queued and fed to the engine one per frame, because a tap that began and ended between two frames, or two taps in a row, was being swallowed. Worth copying if another hold-to-act game shows the same thing.
- **Animation:** `Pond.watch` in `lib/moonpond-scene.ts` notices the game changing state and starts what should move (cast whip, lifted catch, hops, the dive back, the jolt on a snapped line); ambient life and weather are in `draw`; interface motion is at the end of `app/moonpond/moonpond.css`. Reduced motion turns all of it off. The painted version preserves those state transitions; the horizontal DOM tension gauge below the pond uses the real band and tension. Rain avoids the dock/characters, which are sheltered by a canopy. The original drawn sprites remain as failed-request fallbacks.
- **Checks:** `npm run test:moonpond`, `npm run bot:moonpond` (both in `npm test`) and `tests/e2e/moonpond.mjs`. The bot filled eight journals in 13 to 56 nights; a middling angler on starter gear landed 76% of casts.
- **Next:** play it by hand and adjust the reel numbers at the top of `lib/moonpond-game.ts` (`BAND_LOW`, `BAND_HIGH`, `SNAP_AFTER`, `SLIP_AFTER`, `LINE_RESPONSE`, the `SURGE_` values), rerunning `npm run bot:moonpond` after any change; listen to the cues in `app/moonpond/sound.ts`; watch the animations in motion on a phone; and continue the human balance and listening pass now that the painted art is in place.
- **Not done:** nobody has played it by hand, the sound has not been listened to, and the reel has only been tuned against the bot and a scripted hand. The spread of 13 to 56 nights comes from weather luck on the rare pages; if it feels grindy, raise the rare weight in `WEIGHT` or let the journal's found count nudge the weather.

## Acorn Hand · 15-10-2026

Game 34, `/acorn-hand`, a poker-scoring card run in the manner of Balatro. Rules and every number: [`docs/acorn-hand.md`](docs/acorn-hand.md); what is drawn where, and prompts for a painted pass: [`docs/acorn-hand-art.md`](docs/acorn-hand-art.md).

- **Code:** `lib/acorn-hand-cards.ts` (hand types, 44 charms, 13 treats, 13 rivals, targets), `lib/acorn-hand-game.ts` (`Run`, `evaluate`, the pure `scorePlay` that returns each step of a score for the page to count up, saving), `lib/acorn-hand-scene.ts` (cards, pips, charms and rivals in Canvas 2D) and `app/acorn-hand/`. `window.__acorn()` returns the run, the record, the scoring animation, the selection and `refresh`. The page sets `data-ready` on `main` once it has hydrated; browser tests wait for it, because a click on the server-rendered title before that does nothing. Vouchers (`VOUCHERS`, `Run.offer`, `buyVoucher`) and booster packs (`PACKS`, the `'pack'` phase, `openPack`/`takePack`/`skipPack`, shared `applyTreat`) were added the same day; see `docs/superpowers/specs/15-10-2026-acorn-hand-vouchers-packs-design.md`.
- **Saves:** `acorn-hand-run-v2` (version 2, with vouchers, the offer and an open pack) is the whole run including a round or pack in progress and the generator's state, written after every action; `acorn-hand-v1` is the record; `acorn-hand-sound-v1` the sound. The record has its own `PROFILE_VERSION` (1), so it survived the bump.
- **Balance:** `tests/acorn-hand-bot.mjs` judges charms by rescoring its own recent plays with and without them. Since vouchers and packs it buys both, and wins about 33% of 200 runs (4.5% lost in ante 1); `npm test` holds it to 20–45%, under 5% lost in ante 1, every rival met and beaten. Juniper went from ×2 to ×1.5 and antes 7 and 8 came down to 20,000 and 30,000 after play by hand; with vouchers and packs the bot won 49% at those targets, so antes 5 to 8 went up to 9,000, 16,000, 25,500 and 38,000 (above the hand-tuned values: check by hand).
- **Played by hand (15-10-2026):** one full run, won with a two-pair build (Nutmeg, Cinder, Comet, Juniper, Sable); from ante 6 single hands beat targets two or three times over. A second run with an acorn flush build reached ante 3 comfortably. Fixed from that play: sorting no longer reveals face-down cards, a reroll never shows the charms it replaced, using a treat clears the selection (a discard had thrown away two freshly honeyed cards), the save is written after the hand is re-sorted, and the victory screen no longer says "Ante 9 of 8".
- **Checks:** `npm run test:acorn-hand`, `npm run bot:acorn-hand` (both in `npm test`, the bot about 25 s) and `npm run test:e2e:acorn-hand` (25 checks; `ONLY` filters by name as in the Saga suite). With the card count at 34, all 49 browser suites in `test:e2e` were run on 15-10-2026: 46 passed. `moonlight.mjs` and `detectives.mjs` write screenshots to a fixed macOS path (`/Users/jasonchua/...`) and fail on any other machine; `burrow-express.mjs` has a touch-drag check that passes and fails on reruns.
- **Not done:** the sound has not been listened to. Vouchers and packs were added as the late-game nut sink and tuned only against the bot; play a run by hand to see whether nuts now run short or still pile up. A focused build likely wins more often than the bot's 33%, so watch real players and consider a harder stake later. Items in the shop are emoji, not drawn.

**Painted integration (15-10-2026).** All nineteen PNGs in `public/art/acorn-hand/` are now wired into the live scene/page: title, table, suits, court, card backs, 44 charms, 13 rivals, vouchers, packs and items. `lib/acorn-hand-paint.ts` loads on demand and notifies canvas subscribers; original drawings remain playable fallbacks, with a Retry artwork button for failed requests. `lib/acorn-hand-crops.ts` contains measured complete alpha silhouettes including detached props. The last charm sheet has only two populated cells. Pack atlas order differs from the interleaved PACKS list and is mapped explicitly. Exact provenance remains in `docs/acorn-hand-generation.json`. Browser regressions cover gameplay, saves, reduced motion and six layouts; painted checks cover arrival redraws and failure/retry. No gameplay or save changes.

**Game feel (15-10-2026).** A rival sits across the table every round (`tableRival` in `lib/acorn-hand-banter.ts`: the ante's boss in the boss round, otherwise one of the other twelve chosen from the seed, ante and round, never from the run's random numbers), with lines per moment, a nut pile for what is left of the target, and Dora and Enzo beside the hand. `app/acorn-hand/motion.ts` holds Web Animations helpers (`remember`/`settle` glide cards from where they were, `fly` sends copies away, `flip`, `toss`, `burst`, `useTicker`); the page calls them around actions it already had and nothing waits for them, except that the hand that ends a round now counts on the table before the cash-out (`stage = anim ? 'round' : r.phase`). Reduced motion turns it all off. Spec and plan: `docs/superpowers/specs/15-10-2026-acorn-hand-game-feel-design.md`, `docs/superpowers/plans/15-10-2026-acorn-hand-game-feel-plan.md`. **Update (16-10-2026):** suit pips and all happy/sad poses are generated and registered (see below). The Squirrel Hoard voucher, nuts and chips/mult plaques are generated as standalone files but still need runtime integration. The new sounds (flip, whoosh, tear, chirp) have not been listened to.

**Three-file art handoff (16-10-2026).** Pulled main through `811e486`. `voucher-hoard.png`, `nuts.png` and `counters.png` now exist in `public/art/acorn-hand/`, with true alpha transparency, generated using the redo prompts and checked at game size. Full prompts, selected sources, hashes and candidate crop bounds: `docs/acorn-hand-redos-generation.json`. These files are **not integrated**: the user requested the standalone PNGs for handoff. Follow the existing redo document to replace voucher cell 3 and wire currency/plaque consumers, then update crops/cache version and test. No suit or rival-pose art was generated in this pass.

**Remaining redo assets (16-10-2026).** The seven previously missing required sheets from `docs/acorn-hand-suit-prompts.md` now exist: redrawn `suits.png`, `rivals-0-happy/sad.png`, `rivals-1-happy/sad.png`, and `rival-armadillo-happy/sad.png`. The document now has a delivery-status table for all ten required assets. Their measured crops are registered; suit frames are equal squares and rival pose frames share calm aspects/baselines. Cache version `suits-poses-2`. Exact prompts, sources, corrections, hashes and alpha measurements: `docs/acorn-hand-suits-poses-generation.json`. All thirteen triplets and tiny colour/greyscale pips were reviewed through the actual renderer. The optional large suit sheet is unnecessary. PR #50's standalone voucher/nuts/counters still need runtime integration; preserve that distinction.

## Midnight Kitchen · 15-10-2026

Game 33, `/kitchen` (**Ember & Clover: Midnight Kitchen**), is merged on main (PR #39). Dora, Enzo, Pip and Ember run a moonlit bakery: orders move from new to prepared, baked and served, one chef a job, with twelve timed shifts, five recipes, a rush bell, upgrades and an untimed cozy mode. Rules and numbers are in [`docs/midnight-kitchen.md`](docs/midnight-kitchen.md), the painted sheets and prompts in [`docs/kitchen-art.md`](docs/kitchen-art.md).

- **Code:** `lib/kitchen-game.ts` holds the rules; there is no `lib/kitchen-scene.ts`, so all the drawing lives in `app/kitchen/page.tsx` (about 700 lines), unlike the engine / scene / page split the other games follow. Saves are `midnight-kitchen-v1`, written between shifts.
- **Checks:** `npm run test:kitchen` (in `npm test`, with 240 simulated campaigns) and `tests/e2e/kitchen.mjs`. Both passed on 15-10-2026, as did `arcade-navigation` with 33 cards.
- **Chef art:** `public/art/kitchen/chefs.png` was re-cut on 15-10-2026. The sheet came with a half-transparent haze and a nearly opaque warm glow around each chef, which the `.k-art` drop shadow turned into pale boxes. Each crop was separated with OpenCV GrabCut (faint pixels as background, the eroded solid body as foreground, the glow band left to the colour model), dark solid pixels next to the figure put back (GrabCut took an eye for background) and holes filled; the scratch script was `tests/e2e/.tmp/grab.py`. Repaint the sheet with a clean transparent background rather than re-cutting it again.
- **Not done:** nobody has played it by hand; there is no bot.

## Whisker Saga · 13-10-2026

Game 32, `/saga`, is merged on main (PR #33). It is a hero-squad adventure modelled on the squad stages of Top Heroes: Kingdom Saga, with the kingdom building, guilds and anything online left out by choice.

- **The loop:** a squad of five (two in front, three behind) marches through three waves a stage and attacks on its own. The player fires each hero's skill when it is charged. Captains, bosses and hexers wind up their big moves for 1.8 s; a stun in that window cancels the move and staggers the enemy (2.5 s stunned, 50% more damage taken for 4 s).
- **Progress:** twenty heroes in three factions and five roles (two to start, six from chapter bosses, ten from summons with a guarantee on the tenth, and Fennel and Sable from the hero trials added in PR #38), levels for gold, stars from repeat summons, four gear slots in six tiers (the sixth, Ascendant, since PR #38) with a forge, a faction bonus, eighty stages with three stars each, chapter chests, a camp chest that fills for four hours, and an endless tower.
- **Code:** the usual split, in `lib/saga-game.ts` (`Battle` for one fight, `Game` for the roster and progress), `lib/saga-scene.ts` (`Field`), `lib/saga-art.ts` (heroes, enemies and backdrops by name) and `app/saga/` (page, styles, metadata and `sound.ts`).
- **Saves and hook:** `saga-v1` and `saga-sound-v1`. The save is written on every menu action and on the frame a battle ends. A battle in progress is not saved: a reload returns to the map with nothing lost. `window.__saga()` returns the game, the field, the pause flag, the speed, the auto flag and `refresh` to redraw the menus after a test changes the game.
- **Art:** the approved painted pass and combat-feedback improvements are in PR #35. Eighteen hero sprites and dedicated portraits (Fennel and Sable came later, in `heroes-3.png`), six enemies, eight bosses and eight landscapes live in `public/art/saga/`. `lib/saga-paint.ts` prioritizes the saved squad/current chapter and loads other sheets on demand, with lazy crops using measured silhouettes in `lib/saga-crops.ts`; original code drawings remain loading fallbacks. The field retains the battle animations and reduced motion. Large skill cards show live hero health, shields and charge; eligible interrupts follow actual targets during wind-ups and early presses explain why a skill cannot fire. Valid presses now queue until a combat tick, preventing drops on high-refresh screens. Six painted spell textures, chapter postcards and camp/reward props accompany the live animations. Hero and boss meters remain HTML. Missing assets can be retried, and pending images do not block menus or battles. Layout and exact prompts are in `docs/saga-art.md`.
- **Balance:** done against `tests/saga-bot.mjs` only. Three findings shaped the numbers and are worth knowing before changing them. First, when holding a stun for a wind-up only cancelled the move, firing everything on cooldown won more fights; the stagger is what makes timing pay. Second, a slam strong enough to wipe the squad made stage 1 unwinnable for a player who never fires a skill, so slams now take roughly half a back-row hero's health. Third, gold income (`GOLD`) is the sensitive dial: 36 gave the bot 16 or more losses on some seeds and 50 gave almost none; it is at 42.
- **Checks:** `npm run test:saga`, `npm run bot:saga` (both in `npm test`) and `tests/e2e/saga.mjs` (`npm run test:e2e:saga`), which passed three runs in a row before the merge. Set `ONLY` to part of a check's name to run just that check, for example `ONLY="the squad" node tests/e2e/saga.mjs`. Adding the game changed the card count from 31 to 32 in about twenty older browser suites; only `arcade-navigation`, `panel-contrast` and `dust-bath` were rerun afterwards. The painted pass adds `tests/e2e/saga-painted.mjs` to the Saga command and has passed the full Saga suite, fifty-sprite crop checks, all eight chapter/boss scenes, live-meter and failed-art retry checks, plus the thirty-three-route text-contrast suite.
- **Next:** play it by hand, above all the first ten stages and one boss, and adjust `GOLD`, the slam `power` values in `ENEMIES` and `STAGGER` / `EXPOSED`, rerunning `npm run bot:saga` after any change; listen to the cues in `app/saga/sound.ts`; review the painted pass in every chapter.
- **Hero trials (PR #38, 13-10-2026):** six optional three-wave trials open after 10 to 60 campaign stages and recruit Fennel (chain damage) and Sable (cleanse and heal), so the roster is twenty. Gear goes to a sixth tier, Ascendant, with painted equipment icons. The save is version 2 under the same `saga-v1` key and version-one saves are carried over. Measured over eight bot campaigns, each trial is won soon after it unlocks and every time five stages later; Backline Watch (5/8) and Frostbound Guard (2/8) are the hardest at unlock. The bot itself never plays trials.
- **First play by hand (15-10-2026):** stages 1–10, the Thornback boss and Briar Relay were played in a real browser, pausing between moves. Chapter 1 is samey and easy: every stage is two short waves and a Captain with one wind-up, and holding a single stun for it won all ten on three stars in 26–44 s. Briar Relay was lost twice by leaving the heal and shields charged; with the same squad the bot's habits win it 20 of 20 and no input at all loses at about 32 s in both the browser and the engine, so the trial is fair. Fixed from this round: a first clear now selects the stage it opened on the map, the battle hint points at a charged heal or shield when someone is below half health, and the batch summon button no longer says "Summon 2" with no scrolls.
- **Not done:** the sound has not been listened to, and chapters 2 to 8 have not been played by hand. Chapter 1 needs more variety (a slinger-heavy stage, an early brute, a second wind-up) to teach something before the boss. The painted pass gives all eight bosses distinct artwork. Enemy make-up is rolled per stage, so a few stages are harder than their neighbours (the bot most often loses at stages 13, 20, 35 and 40).

## Current state

- **34 games on `main`**, deployed at https://chinchillas.jason.engineering. The newest are listed below; `README.md` has all 34 with guides.
- **Played by hand:** Acorn Hand (one full run won, a second to ante 3), Whisker Saga (chapter 1, the Thornback boss and Briar Relay, 15-10-2026). Every other recent game has been balanced against its bot, or not at all (Midnight Kitchen), and nobody has listened to any game's sound.
- **Left uncommitted in the working tree, on purpose:** `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` and `.claude/skills/graft/SKILL.md`. They belong to the user; don't stage them.

## What shipped recently

The eight newest cabinets, all merged to `main` and deployed.

| # | Game | Route | Added | Pull requests |
| --- | --- | --- | --- | --- |
| 27 | Moonlight Mischief | `/moonlight` | 09-10-2026 | |
| 28 | Pawprint Pinball | `/pinball` | 09-10-2026 | |
| 29 | Pawprint Detectives | `/detectives` | 10-10-2026 | |
| 30 | Frostpaw Frontier | `/frontier` | 10-10-2026 | |
| 31 | Moonpond | `/moonpond` | 10-10-2026 | #31–#32 for docs and the painted pond |
| 32 | Whisker Saga | `/saga` | 13-10-2026 | #33–#38, #40 |
| 33 | Ember & Clover: Midnight Kitchen | `/kitchen` | 15-10-2026 | #39–#41 |
| 34 | Acorn Hand | `/acorn-hand` | 15-10-2026 | #42 |

Each has its own section near the top of this file. The older games' notes (Clash, Hay Maze, Chinchillas vs Zombies, Scribble, Bounce / Burrow, Burrow Tactics, Burrow Barrage, Summit Shuffle, Poof Panic) follow under **Where the code lives**.

## Where the code lives

All four follow the arcade's usual split: a deterministic engine with no DOM, a Canvas 2D scene, and a client page.

| Part | Chinchilla Clash | Hay Maze Defence | Chinchillas vs Zombies | Chinchilla Scribble |
| --- | --- | --- | --- | --- |
| Rules (deterministic, testable in Node) | `lib/chinchilla-clash-game.ts` | `lib/hay-maze-game.ts` | `lib/cvz-game.ts` | `lib/scribble-game.ts`, with the vocabulary (177 nouns, 47 adjectives) in `lib/scribble-words.ts` |
| Drawing | `lib/chinchilla-clash-scene.ts` | `lib/hay-maze-scene.ts` | `lib/cvz-scene.ts` | `lib/scribble-scene.ts`, `lib/scribble-art.ts` |
| Page, styles, metadata | `app/clash/` | `app/hay-maze/` | `app/chinchillas-vs-zombies/` | `app/scribble/` |
| Engine tests (`npm test`) | `tests/chinchilla-clash.mjs` | `tests/hay-maze.mjs`, `tests/hay-maze-bot.mjs` | `tests/cvz.mjs`, `tests/cvz-bot.mjs` | `tests/scribble.mjs` |
| Browser test (`npm run test:e2e`) | `tests/e2e/chinchilla-clash.mjs` | `tests/e2e/hay-maze.mjs` | `tests/e2e/chinchillas-vs-zombies.mjs` | `tests/e2e/scribble.mjs` |
| Save keys (`localStorage`) | `chinchilla-clash-v1` | `hay-maze-v2` (stats) and `hay-maze-run-v1` (the run in progress); the first version's `hay-maze-v1` is no longer read | `chinchillas-vs-zombies-v1` (nights won) and `chinchillas-vs-zombies-night-v1` (the night in progress) | `chinchilla-scribble-v1` |
| Test hook on `window` | `__clash()` | `__maze()` | `__cvz()` | `__scribble()` |

Clash, Hay Maze and Chinchillas vs Zombies draw Dora, Enzo and the other chinchillas with the shared `drawChinchilla` from `lib/chinchilla-art.ts`, using `coatLike` for other coats.

### Chinchilla Clash, briefly

- Arena of 18 × 32 tiles; side 0 (the player) owns the bottom. `local(side, y)` flips y so every side sees itself at the bottom, and the computer player (`think`) is written in that view.
- All randomness comes from `rng(seed)` (mulberry32), so a seed replays a match exactly.
- The computer player spells towers it can finish, then defends the most urgent push, then supports a crossing tank, and attacks once it has saved enough dust. Each rival's `AiLevel` in `RIVALS` sets how it plays; `STEADY` is a neutral bot for tests.
- Balance as of 26-09-2026: `STEADY` playing the starter deck wins about 29/30, 21/30 and 9/30 against the three rivals. `tests/chinchilla-clash.mjs` asserts that each arena is harder than the last.

### Hay Maze Defence, briefly

- The state is split into two classes. `Run` holds what carries over: the Hearthlight, the deck, unlocked towers, relics and the reward choice. `Battle` is one level: the generated meadow (`makeLayout`), its wave plan (`planWaves`), bales, towers, hand, draw and discard piles, and hay.
- Grid of 20 × 12 tiles. `field()` is a BFS from the burrow door round rocks and bales. Ground predators step to the neighbouring tile with fewer steps to go.
- **Only bales block the route; towers don't** (they stand on bales or rocks). `canPlace()` refuses a piece that would cut off a way in, and bales can only be laid in the build phase.
- Pieces are `PIECES` cells, turned by `shape()` and centred by `cellsAt()`.
- Elements are resolved in `Battle.fire()` and `fly()`: `SHATTER` for sparks on chilled foes, and `FLARE` for moonlight on burning foes.
- Relics change a tower's numbers in `Battle.stats()`, plus a few hooks: Hay Loft, Lucky Raisin, Old Map and Hearthstone.
- Everything random comes from `rng(seed)`: the run's rewards from the run's seed, and each level's meadow, waves and shuffles from the seed and the level number. A seed replays a run exactly.
- Balance knobs: `hpScale` and `toughness` (health growth, mostly within a level, because each level starts from scratch), `budget` and `COST` (wave size), `LEVEL_HAY` and `LEVEL_HAY_STEP`, `FIRST_DRAW` and `DRAW_PER_WAVE`, and the tower, enemy and relic tables. The first wave of each level has no hawks or badgers, which stops a new level from opening with a wave you can't answer yet.
- `tests/hay-maze-bot.mjs` plays six seeded runs. It lays bales along a snaking plan to lengthen the walk, stands towers where they cover the route (and anti-air along the hawks' flight line), and picks rewards. As of 26-09-2026 it won 4 of 6, usually with the flame well down, and `npm test` needs at least 3. Rerun it after any balance change; it takes about five seconds.

### Chinchillas vs Zombies, briefly

- `Game` is one night. Tiles are `row` (0–4) and `col` (0–8); zombies have a fractional `x` and walk left. `planLevel(n, seed)` lays out every zombie of a night up front, and `update()` lets them in as their time comes.
- `touching(z, d)` is the one contact rule, used both for a zombie stopping to bite and for a Dust Trap going off, so the two can't disagree. An earlier version had them disagree, and a ready trap then blocked a zombie forever without firing.
- Balance knobs: `ZOMBIES` speeds and health, the `DEFENDERS` table, each level's `base` and `step` (wave points), `COST` (points per zombie), `FIRST_WAVE`, `WAVE_GAP`, `SKY_EVERY` and `START_SEEDS`.
- `tests/cvz-bot.mjs` plays each night with a simple gardener and must win all eight on seed 1. As of 26-09-2026, across seeds 1–6 it won 47 of 48, with night 8 the one it sometimes loses. Rerun it after any balance change; it takes a couple of seconds.

### Chinchilla Scribble, briefly

No engine notes have been written for Scribble yet. [`docs/scribble.md`](docs/scribble.md) covers the world, the words, what things do to each other, the levels, and stars and saving; the README guide lists what `tests/scribble.mjs` covers, including 24 scripted solutions across the 12 levels.

### Bounce / Burrow, briefly

Game 05 (`/adventure`, titled *Dustbound* in game) was reworked on 03-10-2026 on `feat/dustbound-combat`, then merged on 04-10-2026 with PR #5. Rules in `lib/arpg-game.ts`, drawing in `lib/arpg-scene.ts`, page in `app/adventure/page.tsx`, styles at the end of `app/globals.css`, tests in `tests/arpg.mjs`. Full rules: [`docs/dustbound-rpg.md`](docs/dustbound-rpg.md).

- **Attack visuals are cosmetic.** `Hero.swing` and `Hero.aim` are set when an attack fires and only the scene reads them; damage timing is unchanged. `Adventure.shake` drives the camera shake.
- **Shift-attack** is `standAttack()` / `release()` and `strike()`: the leader stays put while `hold` is set.
- **Elites** are chosen in `setup()` from a generator seeded by the floor, separate from `generateFloor`, so floor layouts for a seed did not change.
- **Gear** is forged by `forge()` from `Adventure.roll`, a generator seeded by the run. `wear()` is the one place that moves maximum courage with gear. Critical hits only roll when gear gives a critical chance.
- **Saving:** `snapshot()` and `Adventure.restore()`, key `dustbound-v1`. Bump `SAVE_VERSION` when the shape changes; older saves are then ignored. A restore rebuilds the floor from its start.
- **Balance** of elites and gear has only been checked by the existing bot playthroughs (four floors on three seeds, no revivals). Deeper floors have not been played.
- The page has no `window` test hook and there is no browser test for this game.

### Burrow Tactics, briefly

Game 22 (`/tactics`), turn-based tactics in the style of Into the Breach. Rules in `lib/burrow-tactics-game.ts`, drawing and animation in `lib/burrow-tactics-scene.ts`, page, styles and sounds in `app/tactics/`, tests in `tests/burrow-tactics.mjs`, the planner bot in `tests/burrow-tactics-bot.mjs`, the browser test in `tests/e2e/burrow-tactics.mjs`. Full rules: [`docs/burrow-tactics.md`](docs/burrow-tactics.md). Design notes and the build plan are under `docs/superpowers/`.

- **A `Battle` is plain data.** `clone()` copies it cheaply, and previews, the forecast, the reset button, saving and the bot all work on copies. Keep every field JSON-safe.
- **The engine does not animate.** It resolves an action or a whole predator phase at once and leaves events in `Battle.events`. The page hands them to `Stage.feed()`, which plays them and then syncs to the engine. A new kind of effect needs an event in `Ev` and a case in `Stage.anim()`.
- **Attacks are directions.** `Unit.dir` (and `dist` for the hawk) is set by `think()`; `threat()` turns it into tiles from where the predator stands now. That is what makes pushing a predator move its attack.
- **The only randomness after setup is in `think()` and `placeMarks()`**, both after attacks resolve, which is why `forecast()` can be exact. Keep it that way.
- **Balance knobs:** the `HEROES` and `PREDATORS` tables, each mission's map, squad, turns, warren and arrivals in `MISSIONS`, and for the run `START_BUDGET`, `START_STEP`, `WAVE_BUDGET`, `WAVE_STEP`, `ALPHA_FROM`, `ALPHA_CHANCE`, `RUN_WARREN` and the `DIFFICULTY` table.
- **The planner lives in the engine** (`boardValue`, `bestStep`, `planTurn`, `hint`). The Hint button and the bot in `tests/burrow-tactics-bot.mjs` both use it. It wins all eighteen missions and, as of 04-10-2026, 8 of the 12 seeded Standard runs that `npm test` plays (it needs 6); over 48 runs with six squads it wins 46 on Gentle, 42 on Standard and 24 on Fierce. It looks one turn ahead with perfect knowledge of the coming attacks, so a person will do worse than it does. Rerun `npm run bot:tactics` (`ALL=1` for every difficulty) after any balance change; it takes a few seconds.
- **Chapter two** (added 04-10-2026, the same day): classes with a perk each (`CLASSES`), a second action per chinchilla (`Unit.skill`), ice, high ground and fire, the objectives `escort` and `hunt` and the nursery burrow (`BattleDef.goal`, `key`), the mole, skunk and Great Bear, a deployment step (`Battle.state === 'deploy'`, `zone`, `place`, `ready`), run difficulty (`DIFFICULTY`), and the guided first mission (`guide` in the page). Design: `docs/superpowers/specs/04-10-2026-burrow-tactics-chapter-two-design.md`.
- Saves: `burrow-tactics-v1` (stars, sound, difficulty, best runs) and `burrow-tactics-run-v2` (the run in progress) and `burrow-tactics-mission-v1` (a campaign mission in progress). Test hook: `window.__tactics()` returns `{ battle, stage, run }`.

### Burrow Barrage, briefly

`lib/burrow-barrage-game.ts`, `lib/burrow-barrage-scene.ts`, `app/barrage/`, `tests/burrow-barrage.mjs`, `tests/burrow-barrage-bot.mjs`, `tests/e2e/burrow-barrage.mjs`. Save key `burrow-barrage-v1`; test hook `__barrage()`. Full notes in [`docs/burrow-barrage.md`](docs/burrow-barrage.md).

- **The ground is a grid of cells** (`Match.terrain`, 400 × 225). Shots carve circles out of it and units drop onto whatever is left; falling out of the bottom or being shoved off the side is a knock-out.
- **`flight()` changes nothing**, and both the real shot and the computer's search use it. Keep it that way, so what the computer plans is what happens.
- **The engine does not animate.** `fire()` resolves the whole turn and leaves `Match.events`; `Stage.feed()` plays them, and `Stage` carves its own copy of the ground when each blast is shown.
- **Turn order is by wait** (`Unit.delay`), not rounds: the lowest goes next.
- **Balance knobs:** the `RIDES` and `ITEMS` tables, `AI_LEVELS`, and the constants at the top of the engine (`GRAVITY`, `SPEED`, `WIND_PULL`, `DUSK_TURN`). Small changes swing the ride win rates a long way, so rerun `npm run bot:barrage` with `SEEDS=5` after any of them.
- **Not checked by a person:** the speed of the power bar (`CHARGE_RATE` in the page), how a shot looks in flight, and the crater sizes. The phone camera (`Stage.zoom`, `Stage.pan`, `Stage.toWorld`) has only been checked in a phone-sized browser window, not on a real phone.

### Summit Shuffle, briefly

`lib/summit-shuffle-game.ts` (rules), `lib/summit-shuffle-cards.ts` (cards, trinkets, statuses), `lib/summit-shuffle-foes.ts` (predators and encounters), `lib/summit-shuffle-scene.ts`, `app/summit/`, `tests/summit-shuffle.mjs`, `tests/summit-shuffle-bot.mjs`, `tests/e2e/summit-shuffle.mjs`. Save key `summit-shuffle-v1`; test hook `__summit()`. Full notes and every table in [`docs/summit-shuffle.md`](docs/summit-shuffle.md).

- **A climb is one `Run` of plain data**: three stretches of six rows of stops and a guardian, 21 stops. `run.save()` and `Run.load()` round-trip it. Saved during a fight, it gives the moment before the fight, and loading walks back into the same fight.
- **Three seeded streams** live in the run (`rng.map`, `rng.loot`, `rng.fight`), so nothing outside it affects a climb.
- **Cards ask, the engine does.** A card's `play` calls the `Ops` interface (`hit`, `fluff`, `hex`, `buff`, `draw` and so on), which `Run` implements. Adding a card is one `add(...)` or `aimed(...)` line in the cards file, plus a number in the bot's `WANT` table.
- **Predators are data.** Each has a table of moves and a `next` function that picks one; the engine turns the picked move into the intent on screen. Special behaviour keeps notes in the foe's `mem` (the dozing owl, the old fox's kits, the cougar's fury).
- **Timed statuses on the chinchilla count down at the start of its turn**, and land one higher when a predator applies them, so the number shown is the turns still to be felt. On predators they count down at the end of the predator's turn.
- **`run.clone()` copies everything but the maps.** The bot searches on clones; an earlier version shared the deck and trinkets, and fights won inside the search handed the real run their rewards.
- **The finished fight stays on the run** (`run.fight`) until the stop is left, so the scene can still draw its last moments. `textOf()` and the page check `run.phase`, not `run.fight`, to know whether a fight is on.
- **The scene draws at the canvas's own size** in CSS pixels, so a phone gets full-size text; predators share the line in proportion to their size.
- **The look was reworked on 07-10-2026**: a painted backdrop per stretch (cached, with clouds, motes or snow drawn live over it), claw marks, puffs and confetti fed by the same events, health bars that drain, drawn intent badges, a fanned hand, a painted trail map with drawn stop icons. The predators were redrawn the same day in the shared `lib/predator-art.ts` (which Burrow Tactics and Poof Panic also use): `blob()` outlines, `fur()` gradients lit from above, far-side limbs in shadow and outlines mixed from each animal's own tint, so a new tint recolours the whole animal. The scene still lays a light wash and the white hit flash over them (`Stage.shaded`). `tests/e2e/.tmp/pred-gallery.mjs` (git-ignored) renders every animal big and small for judging a change by eye.
- **Hover notes** go through one module-level `peek` in `app/summit/page.tsx`: `tipOn(make)` gives any element the mouse-over and long-press handlers, and the note is made again on every render so its numbers stay true. The words it explains are `GLOSSARY` in the cards file, and `npm test` checks every status a card names is in it.
- **Balance knobs:** the numbers in the cards file, the moves and health in the foes file, `HEROES`, `ALTITUDES`, `NAP`, the row weights (`WEIGHTS`) and reward odds (`offer()`). The game is sensitive: an early pair of altitude rules (12% more predator health and 10% harder hits) took the bot from about 50% to about 5%. Rerun `npm run bot:summit` after any change; `npm test` holds Base Camp between 50% and 95% for the bot.
- **Not checked by a person:** how fast the animations feel, whether tap-to-choose then tap-to-play is comfortable, and how hard each altitude is for someone who is not the bot.

### Poof Panic, briefly

`lib/poof-panic-game.ts` (rules, rivals, lessons), `lib/poof-panic-scene.ts`, `app/poof/page.tsx`. [`docs/poof-panic.md`](docs/poof-panic.md) has every number.

- **One tick, one input.** A `Board` advances in 60 ticks a second and takes one `Input` a tick. The page's `Pad` turns held keys and touches into those inputs; a rival's `Brain` produces the same thing, so rivals move pairs press by press like a player.
- **The grid functions are shared.** `collapse`, `findPops`, `resolve` and `land` are used by the board, by the rivals when they weigh a placement, and by `solve`, which checks the lessons. Change a rule there and all three follow.
- **Rivals are a row of numbers** in `RIVALS`; `harder()` makes the hard-ladder version. After changing any of them run `npm run bot:poof`, which fails if a rival stops beating the one below it. The bot is not part of `npm test`.
- **Dust has two counters**: `incoming` while the sender's chain is still running, `pending` once it may fall. `give()` cancels against both before sending.
- **Not yet played by hand.** How fast the pairs feel, whether the touch gestures are comfortable, and whether Mossy and Pongo are gentle enough for a first-time player are guesses from the bot's stand-in players.

## Checking your work

```sh
npm ci
npm run typecheck
npm test                    # every engine suite, the bots, and the README check
npm run build
npm run test:clash          # one game at a time
npm run test:hay-maze
npm run bot:hay-maze
npm run test:cvz
npm run bot:cvz
npm run test:scribble
npm run test:tactics
npm run bot:tactics
npm run test:barrage
npm run bot:barrage
npm run test:summit
npm run bot:summit
npm run test:saga
npm run bot:saga
npm run test:kitchen
npm run test:acorn-hand
npm run bot:acorn-hand
```

Browser tests need `npm run dev` running and Playwright. Playwright is **not** in `devDependencies`. Install it with `npm i -D playwright`, or link a global copy (`ln -s "$(npm root -g)/playwright" node_modules/playwright`). Then run one suite, such as `node tests/e2e/scribble.mjs`, or the whole `npm run test:e2e`. The browser tests write screenshots to `.checks/<game>/`, which git ignores.

CI (`.github/workflows/ci.yml`) runs typecheck, `npm test` and the build on every push and pull request. Every push to `main` then deploys to https://chinchillas.jason.engineering on Cloudflare Workers. So merging to `main` means going live. The pull requests so far were all rebase-merged to keep `main` linear.

## Things to know

- **`tests/checkpoint-remake.mjs` is not run by `npm test`.** The file exists, but neither it nor `lib/checkpoint-remake-game.ts` is in the `test` script in `package.json`. Whether that is deliberate is not recorded anywhere.
- **Test hooks.** Sixteen pages expose their running game on `window` so the browser tests can read state and fast-forward: `__acorn`, `__barrage`, `__clash`, `__cvz`, `__detectives`, `__express`, `__frontier`, `__maze`, `__moonlight`, `__moonpond`, `__pinball`, `__poof`, `__saga`, `__scribble`, `__summit` and `__tactics`. Midnight Kitchen has none. Anyone can use them from the console. That's harmless in a single-player game, but remove them if that ever matters.
- **Formatting.** `oxfmt --check` fails across most of the repo, old files included, so new files match the surrounding hand-formatted style instead. `oxlint` was clean for Clash, Hay Maze and Chinchillas vs Zombies when they were added; the repo has older lint errors elsewhere.
- **The panel-contrast test** (`tests/e2e/panel-contrast.mjs`) covers the routes in its route list, the newest games included. Those pages hand text colour back to `p` elements (`color: inherit`), as the test expects.

## Agent configuration

The round of 03-10-2026 was spent on the Claude Code setup, not the games:

- **Prompt audit.** Three edits were applied to the graft instructions. In `AGENTS.md`, "For ANY task here" became "For tasks about this repo's code". In `.claude/skills/graft/SKILL.md`, the line calling card spans authoritative now excepts files edited in the same turn, and two mentions of old command names were removed.
- **One audit finding is still open.** `AGENTS.md` says to run `graft build` after big code changes; the graft skill says the tools refresh the graph themselves and `build` isn't needed after editing. Both passages came in the same commit, so someone has to decide which is right for the installed graft version and delete the other.
- **Both graft files look tool-generated** (the `AGENTS.md` block sits between `<!-- graft:start -->` markers), so regenerating them with graft may undo the audit edits.
- **Graft** is installed at 0.21.1, with 0.22.0 available (`npm i -g @nanonets/graft@latest`). `graft/` is git-ignored, so each checkout builds its own graph.
- **A context-bar mod** for Claude Code was written this round. It lives outside the repo, under `~/.claude/dev-mods/`, and is not part of this project.

## Known limitations and ideas for next time

**Fitting drawings into boxes (07-10-2026).** `lib/art-fit.ts` measures a drawing by painting it once off screen (`span`), and `fitDraw(c, key, x, y, w, h, paint, face)` then draws it standing on the bottom of a box, centred and scaled so that all of it is inside. `paint` draws with its feet at the origin, facing right. Every title banner and portrait that used to be placed by a fixed offset now goes through it (Clash, Hay Maze, Zombies, Barrage, Summit Shuffle, Burrow Tactics, Poof Panic, Scribble, Fluff Forge and `components/chinchilla-portrait.tsx`), because the chinchilla's tail and the redrawn predators made the old offsets overlap or run off the edge. Use it for any new portrait; give each animal its own box and they cannot overlap. The measurement is cached by `key`, so a key must name one drawing. The 3D games and the older hand-placed sprites inside play fields were looked at on their first screens only.

**Hit effects, same day.** Clash, Hay Maze and Zombies redraw the engine's `effects` (hits, dust, blasts, a broken-ice shatter, a zombie's splat, the brute's smash) in their scenes, and Clash shakes the arena when a tower falls. Burrow Tactics has `Stage.bursts` (a star where a chinchilla lands a blow, claw marks where a predator does, a ring when a burrow falls) and Burrow Barrage a fireball with smoke that hangs over the crater. They were checked by staging each effect at several ages in a screenshot, not by watching them move.

**Hover notes outside Summit Shuffle (07-10-2026).** `components/hover-note.tsx` is a small shared hook: a page calls `useHoverNote()`, spreads `tip(() => note)` on anything worth explaining (passing the element's own pointer handlers as the second argument so both run), and renders `view`. Chinchilla Clash (cards), Hay Maze Defence (towers, cards, relics), Chinchillas vs Zombies (packets) and Burrow Tactics (actions, chinchillas) and Burrow Barrage (rides, shots, items, team panels) use it. A long press was tried on a touch screen in all five on 07-10-2026 and shows the note without also counting as a tap. Scrolling hides a note, so a browser test must scroll the thing into view before it hovers. Summit Shuffle keeps its own richer version in its page.

**Units, same day.** Hay Maze's predators now come from the shared `predator-art` (its lynx is the cougar in a grey-tan tint); Clash's towers, capybara and gliders, the zombies' shading and Barrage's carts were redrawn in place.

**Graphics pass of 07-10-2026.** Chinchilla Clash, Hay Maze Defence, Burrow Tactics, Burrow Barrage and Chinchillas vs Zombies were repainted in the manner of Summit Shuffle. Clash, Hay Maze and Barrage now paint their ground or far view once onto a canvas of their own (`paintArena`, `paintGround`, `paintBackdrop`) and copy it each frame, keyed on the level and the canvas scale; anything that changes the static picture must change that key. It was judged from screenshots of a handful of screens per game, not by playing. Scratch screenshot scripts are in `tests/e2e/.tmp/` (`maze-look`, `clash-look`, `barrage-look2`, `tactics-look`; git-ignored).

The lists for Clash, Hay Maze and Chinchillas vs Zombies date from 26-09-2026 and have not been re-checked against the code since.

- **Sound.** Clash, Hay Maze and Chinchillas vs Zombies got sound on 07-10-2026. `lib/cue-sound.ts` is the shared synth: `makeSound(key, cues)` returns `cue`, `muted` and `setMuted`, remembers the mute under its own `localStorage` key (`chinchilla-clash-sound-v1`, `hay-maze-sound-v1`, `chinchillas-vs-zombies-sound-v1`: `on` or `off`), and will not restart the same cue within a short gap, so a volley is one sound. Each page plays a cue for every engine event and for every new entry on the engine's `effects` list (a `WeakSet` remembers which it has heard). Nobody has listened to it: the cues were written blind and need a pass by ear. M mutes in Clash and Zombies; in Hay Maze M already picks the seventh tower, so only the button does. The older games each have their own copy of much the same synth (`app/poof/sound.ts` and others) and could move onto the shared one.
- **Hay Maze on phones:** the meadow is only about 16 px a tile at phone width. Building uses tap-to-preview, then tap-again-to-build, to avoid misplacing. A zoomed or scrollable view would help more.
- **Hay Maze:** towers have no targeting modes (they always shoot the predator furthest along). There is no endless mode and no difficulty setting. Runs save between waves, at the reward screen and, since 07-10-2026, in the middle of a wave (`Run.snapshot()` and `Run.load()`, key `hay-maze-run-v1`); a wave comes back paused. Bump `SAVE_VERSION` when the save format changes; older saves are then simply not offered. Emberward's multi-tile towers (archways, line shooters) and its branching region map aren't in yet, and would be natural next steps.
- **Chinchilla Clash:** no card levels, emotes or two-player mode. The computer player never uses the pocket placement opened by a fallen tower.
- **Chinchillas vs Zombies:** a night in progress is saved since 07-10-2026 (`Game.snapshot()` and `Game.restore()`) and comes back paused. There's no endless mode, no mini-games and no night-time or pool lawns. On a phone the lawn is small (tiles about 32 px); tap-to-preview keeps planting accurate.
- **Chinchilla Scribble:** no bot plays the levels, and its limits haven't been written up.
- **Burrow Tactics:** balance has only been tuned against the bot; nobody has played the campaign or a run by hand from start to finish. A campaign mission in progress is saved since 07-10-2026. The hint looks one turn ahead only.
- **Summit Shuffle:** balanced against the bot only. Since 07-10-2026 each chinchilla has cards of their own (`who` on a card, `poolFor()`), sixteen of them new; the new ones have not been through `TRIAL=1`. One-use treats and more chance meetings are the obvious next additions. The bot plans one turn at a time, so cards that need setting up (Belly Flop, Puff Up, Sore Spot) score badly in its trials and may be stronger in a person's hands than their numbers suggest.
- **Whisker Saga:** balanced against the bot only; chapter 1 and the first trial were played by hand on 15-10-2026. A battle in progress is not saved. The painted pass gives all eight bosses distinct artwork. There is no way to sell or break down spare gear at the top tier, no hero beyond the twenty, and the kingdom building, guilds and rival players of the game it is modelled on were left out by choice. Painted source paths, layout and exact prompts are in `docs/saga-art.md`.
- **Balance** has only been tuned against bots. Watch real players on levels 5–6 of Hay Maze, against Baron Ebony in Clash, and on nights 7–8 of Chinchillas vs Zombies, the hardest of each.
