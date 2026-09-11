# Mountain Retreat acceptance record

Implemented 10-09-2026 as cabinet 12 at `/mountain-retreat`. No existing game page, engine, style or asset was edited. Shared navigation, metadata, package scripts, README and navigation-count assertions were updated.

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

## Readability and theme update (10-09-2026)

Mountain Retreat now offers a route-scoped Light / Dark / System selector. System follows live device preferences and is the default. A separate `mountain-retreat-theme` browser preference preserves the choice without modifying game saves. Storage denial still allows in-memory theme changes. Other games are not themed by these selectors.

Guide paragraphs are explicitly 18px with 1.8 line-height, 28px headings and bounded line lengths. Supporting control descriptions are 14px, main controls 16px, and room labels 12px. Mobile cards reflow rather than shrinking the text. White Dora and grey Enzo retain authored pixel colors.

`node tests/e2e/mountain-retreat-theme.mjs` checks measured guide contrast (light 8.16:1, dark 9.96:1), selected and disabled button-label contrast >=4.5:1, font sizes, 320/390/768/1440 widths, remembered theme, live System changes, explicit overrides, denied storage, route isolation and zero page errors. Screenshots are in `.checks/mountain-retreat/theme-*.png`. This is focused contrast and Chromium layout testing, not a complete WCAG certification. Existing lodge gameplay e2e and all 12 engine cases also pass, alongside typecheck, scoped lint and production build (existing warnings unchanged).

## Walking hosts and visiting guests (11-09-2026)

Dora and Enzo now tour the open rooms instead of standing still. `hostStop` in the engine picks each host's room from `elapsed`: Dora stops 8 seconds per room (hearth → suite → bath → kitchen), Enzo 12 seconds (kitchen → bath → hearth → suite), skipping rooms that aren't open. Because `elapsed` stops during expeditions and festivals, the hosts freeze with production. Moving between rooms side by side is a 1.4-second walk. Moving between floors is a hop: straight up or down when the rooms share a column, otherwise a walk and then a hop. The sprite faces the direction of travel.

Visitors follow the real guest-visit timer (`visitPeriod`: 6 seconds on Welcome, 10 on Comfort). For the three seconds before a visit, one visiting chinchilla per open room walks up the path, but only if there are enough supplies for the visit. After a visit that actually succeeds (the page watches `served` rise), each open room shows a guest at its furniture with a heart until the next visit. The scene caption says whether guests are on the path, staying, or the hosts are away. Guests come in five coat colours (beige, black velvet, violet, ebony, sapphire), each with a scarf. They are decorative (`aria-hidden`), so the accessible image count stays at two per host. Outings clear the hosts and guests from the lodge. Reduced motion removes every walk, hop and fade. The save format is unchanged.

Evidence: two new engine cases cover room tours, walking windows, only-open-room stops, freezing during outings, and the visit period (`npm run test:mountain-retreat`, 14 cases). `node tests/e2e/mountain-retreat-scene.mjs` seeds a four-room lodge and checks the starting rooms, four arriving guests visible on the path, four seated guests at full opacity inside their rooms, a delay-free climb from hearth to suite, a walk across from suite to bath, Dora inside the suite's bounds once she arrives, Enzo's tour, an outing clearing the scene, instant moves under reduced motion, no overflow and hosts inside the lodge at 320/390/768px, and zero page errors. Screenshots are in `.checks/mountain-retreat/scene-*.png`. The existing gameplay and theme browser suites still pass.

## Faster supplies and more depth (11-09-2026)

Saves are now version 2, under the same `dora-enzo-mountain-retreat-v1` key. Version-1 journals load and upgrade in place with empty new fields; a malformed version-2 journal is still rejected whole. The engine stays pure and deterministic: the featured guest of each visit comes from a fixed hash of the visit number, never from `Math.random`.

- **Supplies:** a delivery every 2 seconds instead of every 3–6. Gather brings 3, Craft 1, plus 1 in spring and 1 with the Larder. The cap rose from 120 to 200. Gather now runs well ahead of a full Welcome lodge (1.5 per second against 0.67 used); Craft still drains stock.
- **Guest wishes and reputation:** each visit has a featured guest from the types whose room is open and whose star requirement is met. Granting the wish (and any oat cake, herbal soap or Extra comfort it needs) adds 4 tips, 2 hearts and 1 reputation, plus 10 tips when an item is used. An unmet wish costs 1 reputation, and a guest turned away for lack of supplies costs 3. Rating is 1 + reputation ÷ 20, capped at 5 stars, and adds (stars − 1) tips per room served.
- **Specialties:** at level 3 each room picks one of two permanent perks (`PERKS`): Storyteller's chair or Tea stall, Bakery oven or Larder, Telescope or Feather beds, Healing springs or Soap works. Existing level-3 rooms from version-1 journals can choose theirs.
- **Enzo's recipes:** on Craft, every 6 seconds Enzo spends 2 supplies on an oat cake (kitchen) or herbal soap (bath), alternating between the open workshops, up to 9 of each.
- **Album and regulars:** featured guests fill a 7 × 5 coat album. Pip, Mochi and Luna return on every fifth visit once their room is open, and send 20, 40 and 80-tip postcards at friendship 3, 6 and 10.
- **Destinations:** Glass lake (25 s, 5 supplies → 18 supplies, 12 tips, 1 oat cake, 1 soap), the Juniper trail (unchanged) and the Condor summit (90 s, 30 supplies, 2 stars → 60 supplies, 90 tips, 10 hearts, a decoration worth +1 tip per visit up to 6, and a viscacha sighting).
- **Seasons and nights:** 6-minute seasons and 2-minute days on the lodge clock (`elapsed`), so they pause during outings. Spring: +1 supply per delivery. Summer: festivals pay 1.5×. Autumn: +1 tip per room. Winter: +1 heart per room, and the summit is closed. Stargazers only book at night.

Pacing (engine test): a greedy fresh game opens the kitchen, suite and bath at 30, 162 and 306 seconds and has every room at level 3 within 10 minutes.

Evidence: `npm run test:mountain-retreat` now has 23 cases, covering the supply rates, recipes and pantry cap, wishes and reputation, rating thresholds and guest pools, regulars and postcards, specialties, trails and closures, festival season bonus, seasons and nights, version-1 upgrade, and version-2 malformed-save rejection. `node tests/e2e/mountain-retreat-depth.mjs` checks the rating, guest book, pantry, nightfall, choosing a specialty, the lake trail stocking the pantry, the album and regulars, the winter summit closure, a one-star summit lock, a version-1 journal upgrading in the browser, and no overflow at 320/390/768px in light and dark themes. Screenshots are in `.checks/mountain-retreat/depth-*.png`. The gameplay, theme and scene browser suites still pass unchanged.

## Readable numbers and quality of life (11-09-2026)

- **Breakdowns:** a `?` disclosure (native `<details>`, so it works with touch, keyboard and screen readers) on tips, hearts, supplies and the rating. It lists the labelled parts of the next visit's reward, the wish bonuses, the supply rate and uses with an approximate net per minute, and how much reputation the next star needs. The parts come from the engine's `visitRewards` and `supplyParts`, which the simulation itself now sums, so the explanation cannot drift from the payout.
- **Countdown ring:** a ring around the next guest fills over the visit period, and it holds still during outings.
- **Season strip:** the four seasons, a marker for the year's progress, and the time to the next season and to nightfall or dawn in lodge time.
- **Visit floaters and new coats:** for two seconds after a visit, the featured room shows `+tips ✦ +hearts ♥`. The next-guest card flags coats the album doesn't have yet. When such a guest arrives, their sprite glows, a NEW tag appears, and the notice names them.
- **Welcome-back summary:** after 30 seconds or more away, `awaySummary` compares the saved journal with the restored one. The page lists visits, tips, hearts, reputation, supplies, pantry, postcards, new coats and finished outings, and leaves out anything unchanged. A button dismisses it.
- **Keyboard shortcuts:** 1 Welcome, 2 Extra comfort, 3 Gather, 4 Craft with care, announced with `aria-keyshortcuts`. They are ignored with modifier keys, during outings, and while a form control has focus.
- **Sound:** off by default, and remembered separately under `mountain-retreat-sound`. Cues are synthesized with the Web Audio API (no files): a visit chime, a brighter chime for a granted wish, a low note for a turned-away guest, a sparkle for a new coat, an arpeggio for returns and postcards, and a soft footstep when a host sets off. Audio starts only after a gesture and stays silent in background tabs, so offline catch-up doesn't burst out chimes.

Evidence: `npm run test:mountain-retreat` has 25 cases. The two new cases check that the reward breakdown sums to what a visit pays, including wishes and postcards, and that `awaySummary` counts postcards and coats correctly. `node tests/e2e/mountain-retreat-ux.mjs`, with the page clock paused, checks the breakdown contents against the card figures, the season strip text, the ring at 0 and 0.5 of a visit period, the new-coat badge and celebration, the floater appearing and clearing, shortcuts (including being ignored in the theme select), the remembered sound preference, the ten-minute welcome-back summary, and no overflow at 320 and 390px with every breakdown open. Screenshots are in `.checks/mountain-retreat/ux-*.png`. The gameplay, theme, scene and depth browser suites still pass. Actual audio output was not verified by ear, only that turning sound on raises no page errors.

## Distinctive guests and a livelier scene (11-09-2026)

Everything here is decorative CSS pixel art derived from existing game state. There is no new saved data and no engine change; the one exception is the viscacha's short stay after a summit trip, which is held for the session only. All of it is `aria-hidden`, so the accessible image count stays at two per host.

- **Guest accessories:** `Visitor` takes the guest type and adds two sprite pieces drawn in the sprite's unscaled 78×84 space: traveler (straw hat, suitcase), pastry fan (chef hat, oat cake), stargazer (nightcap, telescope), hiker (backpack, walking stick), painter (beret, brush), duchess (tiara, pearls). The viscacha gets longer ears and tail. The featured guest wears their real type. The other staying and arriving guests wear a type from the current `guestPool`.
- **Reactions:** the first arriving guest shows a wish bubble (the room icon, or the oat cake or soap icon, with ♛ when Extra comfort is needed). Regulars wear a name tag. A granted wish makes the guest hop three times. A turned-away guest walks off down the path with "…". Guests doze ("z") at night and, by day, chat ("…" / "♪") when a host stands in their room.
- **Weather and night:** 12 falling particles per season (5 butterflies in summer), hidden entirely under reduced motion. At night there are 14 twinkling stars, a warm glow inside the rooms and furniture, a glowing lantern once it has been found, and a stargazer on the roof when the suite is open.
- **Specialty art:** each of the eight level-3 specialties draws its own object in the room: a storyteller's chair, a tea stall with steam, a bakery oven, larder jars, a telescope, stacked feather beds, a steaming spring and soap bars.
- **Summit decorations:** decorations 1–6 appear on the lodge as a pennant, a wind chime, a lantern, a garden gnome, a flower box and a weathervane. The scene footer names them.
- **Outing backdrops:** a canoe on Glass lake, pines on the Juniper trail, a snowy peak for the Condor summit, and strings of lanterns for the festival.
- **Viscacha:** once seen from the summit, it appears on the mountainside for the first minute of every four minutes of lodge daylight, and for 60 lodge seconds after each summit return.
- **Chimney:** a chimney sits outside the roof, because the roof's `clip-path` would hide anything above it. It puffs one, two or three columns of smoke depending on how many guests are staying, and none during outings.

Evidence: `node tests/e2e/mountain-retreat-scenery.mjs`, with the page clock paused, checks the weather class and particle count for each season, stars and the rooftop stargazer only at night, the viscacha by day but not at night, all four specialty art pieces, the six decorations in order, the featured guest's accessory, wish bubble and name tag (Luna, visit 14), accessories on every arriving and staying guest, the regular's hop, chat bubbles by day and dozing guests at night, smoke levels 1 and 3, lake, summit and festival backdrops, a turned-away guest walking off, weather hidden under reduced motion, no overflow at 390px, and zero page errors. Screenshots are in `.checks/mountain-retreat/scenery-*.png` and were checked by eye. The gameplay, theme, scene, depth and UX browser suites still pass.
