# Highburrow, The First Valley

Game 102, at `/highburrow`. A gentle turn-based settlement game up an Andean valley: an 18×14 hex map climbing from cloud forest to the snow line. Dora scouts the mist, Enzo founds burrow-villages, settlers work the fields around them, llama caravans carry goods on standing routes, and three neighbours (the vicuña herders, the condors and the viscachas) trade, teach skills and ask favours. Keep every village warm through the frost nights of the dry season and hold the summit festival before turn 60. Ported on 13-11-2026 from the standalone prototype (`arcade-protos/highburrow/`), with the same rules, tuning, art and layout.

## Code layout

- `lib/highburrow-world.ts`: the scenario data. Goods, terrain and altitude bands, the map rows and rivers, the three neighbours (offers, skill, favour, greeting), buildings, indoor jobs, the mid-game decisions, events and every balance number.
- `lib/highburrow-rules.ts`: pure rules over a `State`: movement and paths, sight, what each tile makes, the per-village `preview` (goods, food, Warmth, happiness, growth and work, each as signed parts that the tooltips show), job slots, store caps, founding checks.
- `lib/highburrow-game.ts`: the engine, `Game`. Deterministic, no DOM; every player action is a `Cmd` applied with `apply`, and randomness comes from a seeded generator kept in the state, so a seed plus the command log replays a game exactly. `end` resolves the turn.
- `lib/highburrow-advisor.ts`: Enzo. `advise` picks the next useful command (the Assist tips, the "Do it" button and the bots all use it), `attention` lists what still needs orders (the Next button), `routeAdvice` suggests a llama route.
- `lib/highburrow-scene.ts`: Canvas 2D drawing only: the hex tiles from the atlas, rivers, trails, villages and their banners, units with an animation per action (walk, explore, befriend, found, build, trade), the mist, frost snow, path previews, the advisor's ring and the mini map.
- `lib/highburrow-art.ts`: generated atlas manifest (`FRAMES`: atlas, x, y, w, h).
- `app/highburrow/page.tsx`: the React page: the shell, the HUD and which panel is open. `controller.ts` (the prototype's `App`) owns map gestures, keys, turns, toasts and saving and fires a re-render on every change. `hud.tsx` (top bar, unit panel, Enzo's tip, summary, decision, title and end cards), `village.tsx` (the cut-away and its side panel), `trade.tsx` (the market and the route editor), `tutorial.ts` (the ring and paw), `dom.tsx` (sprites, tooltips, storage). `highburrow.css` is the prototype's stylesheet with every rule scoped under `.hb-shell`.

There is no sound; the prototype had none.

## Controls

Mouse or touch. Tap a unit to select it; tap a tile to see the path, tap it again to go (right-click moves at once). Tap a village or its banner to open it, a neighbour's camp to open the market. Drag to pan, wheel or pinch to zoom, tap the mini map to jump. Every number and greyed-out button explains itself on hover (or tap on a phone).

Keys: Enter or Space end the turn, N next thing needing orders, A do Enzo's tip, H ask Enzo (without Assist), Tab next unit, E explore, B befriend, F found, T trail, J join, R rest, O llama route, X stop route, V open the village here, G trade at the camp next door, arrows or W/S/D pan, + and − zoom, Esc close.

In a village: drag a settler (or tap it, then tap where it should go) between the six ring tiles and the rooms; tap an unbuilt room's tag to queue it. On a phone held upright the cut-away is drawn 1.6× wider than the screen and scrolls sideways; a "Swipe to see the whole burrow" hint shows until the first swipe.

## Rules and numbers

- **Units.** Dora (scout, 3 steps, sight 2) explores and befriends; Enzo (leader, 2 steps) founds villages with a settler on his tile and lays trails; settlers (2 steps) join a village or found one; the llama caravan (3 steps, holds 12) loads, unloads, trades and runs routes. Grass, terraces and meadows cost 1 step, forest, scree and snow 2, a trail ½.
- **Tiles.** A settler on a ring tile makes: quinoa terraces 3 quinoa, potato terraces 3 potatoes, meadow and cloud forest 2 potatoes, alpaca pasture 2 wool, salt flat 1 salt, scree 2 stone, snowfield 1 stone, reed island 2 quinoa, hot spring +3 Warmth. Silver veins can't be worked: silver comes only from the condors.
- **Food.** Each settler eats 2 a turn, potatoes first. A storehouse holds 40 of each good (a granary doubles food). A hungry or freezing (Warmth ≤ 10) village gets help from the best friend (−5 friendship) or lowland kin: 4 potatoes a settler and +25 Warmth, then a 3-turn (Assist) or 4-turn cooldown.
- **Warmth.** +2 burrow hearths, minus altitude (1, 2, 4, 6, 8 by band), −2 on dry-season nights, −5 (Assist) or −8 on a frost night; hearth keepers +3 each (2 places), a kiln +2 and its keeper +3, a bath +4 and its attendant +2, a hot-spring tile +3. Below 30 the village stops growing and is unhappy; at 0 it freezes and work halves.
- **Happiness** heads 10 a turn toward 60, +10 when warm (60+), −20 chilly, −30 freezing, −25 hungry, +10 bath, +5 attendant, +5 watcher, +3 per friend nearby. 70+ gives +1 growth, below 40 none.
- **Growth.** A village needs 8 + 2.5 × settlers growth points for a new settler: spare food (up to 3), happy +1, granary keeper +2. Nine settlers fill a village; five villages at most.
- **Seasons and frost.** Eight wet turns then eight dry. From turn 6 a dry night is frosty 28% of the time with Assist (38% without), a wet one 6%. Frost spoils 15% (Assist) or 25% of potatoes (halved by a granary) and high food tiles make 1 less. Assist or a lookout warns you a turn ahead. A 20% chance each turn of an event: good rains, a warm spell, hail, a snowstorm, a wandering llama, a neighbour's gift.
- **Buildings** (work, cost): kiln 10, 3 stone; wool loom 10, 2 stone (weavers turn 2 wool into 1 cloth); granary 10, 2 stone + 1 salt; lookout 8, 2 stone; hot spring bath 16 (half beside a spring), 4 stone; llama caravan 8, 4 quinoa + 2 wool. Work per turn: 1, +3 per builder, +4 while Enzo is there.
- **Neighbours.** Befriend +15 (Assist) or +12, once every 2 turns each; each trade +6; their favour +30; 20 friendship a heart. At 3 hearts (Friends) they teach a skill: the herders Fine weaving (+1 cloth per weaver), the condors Sky paths (the hidden passes to the summit), the viscachas Chuño (frost no longer spoils potatoes and makes +2). At 4 hearts every trade gives +1. Each offer once a turn. Favours: 4 salt for the herders; find the condors' feather in the far west corner and the viscachas' pup by the lake.
- **Decisions**, once each between turns 14 and 36: a hungry herd (share 8 quinoa for +25 friendship and 6 wool, or refuse, −10), stray alpacas (keep them for +1 wool per pasture and −15, or walk them home for +25), a long cold snap (knit blankets: 3 wool for +15 Warmth in each village, or brace for two frost nights).
- **Winning.** A village on the snow line becomes Highburrow. The festival needs 6 woven cloth, 10 quinoa and 4 silver in its storehouse and a league of 22 chinchillas (24 without Assist), before turn 60. After turn 60 a card offers to keep playing.

## Art

Every image was painted by Codex: the sheets and prompts live with the prototype (`arcade-protos/highburrow/art-src/`, `gen.sh` paints one). `scripts/highburrow-art.py <art-src folder>` keys the magenta (or green, for UI) backgrounds, cuts each grid cell, masks terrain to exact pointy-top hexes, packs six atlases (tiles, heroes, folk, places, neighbours, icons) plus the plates (village cut-away, market, festival) and UI pieces (panels, buttons, ring, banner, meter) into `public/art/highburrow/` and regenerates `lib/highburrow-art.ts`. Running it on the prototype's sheets reproduces the committed files byte for byte. Dora is cream-white with red eyes, Enzo grey; settlers come in grey, beige and dark fur and keep their fur in every job pose.

## Save

`localStorage['highburrow-v1']` holds the whole engine state as JSON (`Game.save()`), written after every command and turn; the tutorial step is `highburrow-tut`. A corrupt save is ignored and the title offers a new game.

## Tests and bot results

- `npm run test:highburrow`: 19 engine tests (a turn resolving, production matching the preview, hunger and aid, frost and chuño, founding and the summit village, the festival, friendship and trade, llama routes, decisions, replay, saves, the advisor, short bot runs).
- `npm run bot:highburrow`: 50 seeds each of three bots that take Enzo's advice. Asserts casual wins ≥ 95% at turn 38–50, nobody stuck, no refused commands, greedy wins ≥ 80%, careless wins fewer. `--quick` runs 10 seeds (`npm test`), `--normal` also reports the game without Assist. Results on 13-11-2026 (the same as the prototype):

  | | Assist wins | turn | Normal wins | turn | stuck |
  |---|---|---|---|---|---|
  | casual (follows every tip) | 50/50 | 43.6 | 43/50 | 53.0 | 0 |
  | greedy (rushes villages) | 46/50 | 50.6 | 43/50 | 52.4 | 0 |
  | careless (ignores Warmth) | 30/50 | 54.1 | 1/50 | 60 | 0 |

- `npm run test:e2e:highburrow` (needs `npm run dev` and Playwright; `BASE_URL`, `SHOTS=<dir>` for screenshots): 246 checks with real clicks, taps and keys at 1280×800, 390×844 and 844×390: the title, the tutorial, every unit action including the greyed-out ones' reasons, the village (queue, unqueue, tap-then-tap, drag, the unbuilt-room tag, caravan load and unload, tooltips, send a settler, the wasted-goods button), tap-twice moves, Enzo's tips, Next, End Turn by button and key, the summary, every shortcut, zoom and pan, the market, the route editor, both answers to a decision, the festival, the out-of-time card, reload and a corrupt save, with no page errors or sideways scroll. Mid-game states are played in the page by the casual bot (seed 1002).

`window.__highburrow()` returns the state plus `pop`, `goal`, `modal`, `selected`, `tutorial` and `advice`; `window.__hb` is the controller, `window.__hbHex(q, r)` a hex centre, `window.__hbLib` the engine and advisor. `main[data-ready="true"]` marks that the art has loaded.

## What is weakest

- **No sound.** The prototype had none and the port keeps it that way.
- **Without Assist the game is hard for anyone who ignores Warmth** (careless wins 1 of 50) and the casual win comes late (turn 53), so Assist is on by default.
- **The phone portrait map is busy.** Enzo's tip sits across the top under the goods bar; the frost banner draws over the tip's bottom edge on a frost night.
- **Tooltips carry the rules.** Most of the explanation is in hover or tap tooltips; a player who never opens them leans on Enzo's tips.
- **Only one valley.** "The First Valley" is the whole game; there is no second map or random map.
