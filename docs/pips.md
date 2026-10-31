# Lucky Pips

Game 61, at `/pips`. A dice-placement roguelite for one player. A mischief of fog has rolled over the valley's harvest fair and grumpy fog-sprites in fair costumes have taken over the stalls. Dora and Enzo, with a pouch of carved wooden dice and a satchel of handmade tools, walk the fair stall by stall and set it right.

All numbers below come from `lib/pips-game.ts`, `lib/pips-tools.ts` and `app/pips/page.tsx`. Written 31-10-2026.

## Files

- `lib/pips-tools.ts`: the data. Every tool (its slot rule, how often it works, its one-line rule before and after a gold rim, and its effect as a pure function of the dice in it), the three leads, the foes and their plans, the three areas, the charms, the mystery tents and the Foggier rules.
- `lib/pips-game.ts`: the rules. A run is one plain JSON object (it is also the save) carrying its own mulberry32 state, so a seed and the same choices replay a run exactly; there is no DOM, no clock and no `Math.random`. Every action (`go`, `place`, `takeBack`, `reroll`, `endTurn`, `takeReward`, `stallBuy`, `picnic`, `tentChoose`, `takeCharm`...) changes the run and returns the events the page animates. It also holds the map maker, the meta progress (`recordRun`, `poolFor`) and the save reader.
- `lib/pips-scene.ts`: Canvas 2D drawing of the battle stage: the painted area backdrop, Dora and Enzo as painted cut-outs on the left (ready, attack, hurt, win), the foes on the right bobbing on the spot with their plan in a bubble above, hearts bars, block and status badges, popping numbers, winces, lunges, a hit-stop and a burst of sparks on big hits, and drawn stand-ins until the paintings load.
- `app/pips/page.tsx`: the menu, the map, the battle desk (the felt dice tray, the tool cards, dragging and tapping), the stall, picnic, tent, reward, charm and ending panels, the event player, keys, saving, and the browser-test hooks `window.__pips()`, `window.__pipsStart(seed, lead)` and `window.__pipsDebug(fn)`.
- `app/pips/glyphs.tsx`: the tool, charm and map icons, drawn from simple SVG shapes.
- `app/pips/sound.ts`: WebAudio sounds and the fair-organ waltzes.
- `tests/pips.mjs`, `tests/pips-ai.mjs`, `tests/pips-bot.mjs`, `tests/e2e/pips.mjs`: the engine tests, the two bot players, the bot suite and the browser suite.

## A turn

You roll your dice: 4, or 5 with the Fifth Die charm. Each die is 1 to 6; frost takes one pip off each (never below 1) for as many turns as it has stacks. Sticky toffee (a foe's curse) glues dice so they cannot be used that turn; a ring (a foe's lock) shuts one tool for that turn. Drop dice into tools:

- A tool fires as soon as its slots are full. Two-dice tools (a pair, two dice adding to 7) and three-dice tools (three of a kind, a run of three) hold dice until full; the dice can be taken back. Unused dice and dice still waiting in a tool are lost when you end the turn.
- Countdown tools take any die and subtract its pips from their counter; when it runs out they fire and reset. The counter carries across turns but not across battles.
- Uses: once a turn (most), two or three times a turn (Pebble Toss, Quill Dart, Balance Beam, Wishbone, Weathervane, Mill Wheel), as often as you like (Hay Bale, Little Carousel, the countdowns), or once a battle (Thunder Drum).
- A gold rim (from a grand foe, a picnic, a stall, the Fortune Teller or the Tinker) improves one tool: a looser rule, more uses or bigger numbers, as its card says.
- Tools that make dice (split, flip, twin, nudge, re-roll, roll new ones) put them back in the tray; the tray never holds more than 12.

Then the foes act, in order: their block clears, burn stings (then halves), poison stings (then drops by one), a stunned foe skips its turn, and the rest do what their bubble said and choose their next plan. Then your block resets, your own burn and poison sting, and you roll again. Block soaks hits first; the Hazel Hammer smashes through a foe's block. A battle that reached 40 turns would count as lost (no bot run ever comes close).

## Leads

| Lead | Hearts | Tools | Passive |
| --- | --- | --- | --- |
| Dora | 44 | Pinecone Sling, Twig Shield, Lucky Clover, Acorn Splitter, Pebble Toss | Lucky Paw: one re-roll a turn, and every 6 rolled heals 1 |
| Enzo | 40 | Pinecone Sling, Twig Shield, Honey Pot, Oak Mallet | Thick Fur: 2 block at the start of every turn |
| Side by Side (after a first win) | 38 | Pinecone Sling, Twig Shield, Twin Rattle, Spinning Top, Pebble Toss | Paw in Paw: 2 block for every pair rolled |

The table holds 6 tools (7 with the Tool Belt). Dora's kind of tools (re-rolls, splits, poison, healing) turn up 1.6 times as often when she leads and 0.6 times as often when Enzo leads, and the other way round for Enzo's kind (heavy hits and walls).

## Tools

48 tools: 8 in the starting kits, 33 more in the pool from the start, and 7 unlocked between runs (Big Firework and Caramel Apple after beating the Prize Pumpkin, Cobbler's Anvil and Paper Kite after the Lantern Moth, Little Carousel and Hot Cider with the first win, Ringmaster's Hat with a Foggier win). Rewards weight common, uncommon and rare tools 6 : 3 : 1 (after a grand foe or a boss, and at the Coconut Shy, 2 : 4 : 3). The full list, with every rule, is `TOOLS` in `lib/pips-tools.ts`.

## Foes

| Foe | Hearts | Plans |
| --- | --- | --- |
| Hoopla Goblin | 17 | hit 5; hit 3 twice; hit 3 and block 5 (shuffled) |
| Candyfloss Cloud | 21 | hit 4 and frost 1; block 7 and heal 3; hit 6 (shuffled) |
| Ring-toss Imp | 19 | hit 3 and ring a tool; hit 6; hit 2 and poison 3 (shuffled) |
| Toffee Golem | 32 | block 8 and stick a die; hit 11; hit 4 and block 4 (in turn) |
| Carousel Ghost | 25 | hit 4 and get 2 stronger; burn 3 and hit 3; hit 5 and get 2 stronger; block 6 (in turn) |
| Prize Pumpkin (boss) | 60 | hit 7; a seedling (9 hearts) and block 6; stick a die and hit 5; block 8 and get 2 stronger; hit 13 |
| Lantern Moth (boss) | 92 | burn 3 and hit 6; ring a tool and block 10; hit 4 three times; frost 2 and hit 5; hit 15 |
| The Fog Ringmaster (boss) | 135 | hit 9 and ring a tool; a Hoopla Goblin and block 10; stick two dice and hit 6; hit 5 three times; get 3 stronger and block 12; hit 22 |

Regular foes grow with the area: hearts ×1, ×1.45 and ×1.9 and every hit +0, +1 and +2. Grand foes (elites) have 1.5× hearts and hit 2 harder, and wear a crown. No more than three foes stand at once.

## The map

Each area is seven rows of two or three stops (three in the first row, spread across the meadow; two-stop rows sit closer together), then the boss. The first row is all battles; the second is battles (70%) or mystery tents; the middle rows are battles 42%, grand foes 16%, tents 15%, stalls 14% and picnics 13%; the last row before the boss is all picnics. Every map has at least one stall. Paths only lead to a near stop in the next row, and every stop can be reached.

- **Battles** pay 10–16 acorns, grand foes 24–32 (and gold-rim a random tool), bosses 40–50. Then choose one of three tools, or skip for 8 acorns.
- **Trading stall:** three tools at 38–46, 58–66 or 82–90 acorns by rarity; one gold rim (45, 55, 65 by area), leaving one tool behind (30) and a pumpkin pie (+12 hearts, 25), once each.
- **Picnic:** rest for a third of your hearts (a fifth from Foggier 3), or gold-rim a tool.
- **Mystery tents:** the Fortune Teller, the Lost Basket, the Wobbly Ferris Wheel, the Pie Contest, the Hall of Mirrors, the Coconut Shy, the Tinker's Cart and the Rattling Tent (an ambush), each seen at most once a run.
- **After a boss:** choose one of three charms (the Fifth Die, Golden Acorn, Four-Leaf Locket, Warm Scarf, Tool Belt, Sticky Paws, Ember Charm, Picnic Basket), then rest for 40% of your hearts and walk on. Beating the Fog Ringmaster wins the run.

## Foggier and the Daily Fair

Winning at a Foggier level opens the next, up to 5. Each adds one rule to those below it: 1, foes have 15% more hearts; 2, every foe hit lands 1 harder; 3, picnics heal a fifth, not a third; 4, you start with 4 fewer hearts; 5, bosses have 20% more hearts and start with 10 block. The Daily Fair (its date read only after the page has loaded) seeds one run from the date, picks the leader from the seed, plays at Foggier 0 with every tool in the pool, and keeps the best result per day without unlocking anything.

## Balance and the bots

`tests/pips-ai.mjs` holds the two players. The greedy one tries every die in every tool, and every pair or three of dice in a multi-dice tool, scores the result (hearts kept against the foes' next hits, foe hearts left after their poison and burn, block, statuses, dice still in hand, countdown progress), and looks one move further after any move that makes dice; it plays the best move until nothing helps, then ends the turn. Off the battlefield it picks stops by hearts left, rates tools from a table plus a little per-run taste, buys and gold-rims at stalls, and rests when hurt. The random player places random dice and makes random choices.

Measured with `npm run bot:pips`, 31-10-2026. "Fresh save" is what a first-time player has: the 41 starting tools in the pool and Dora or Enzo leading (Side by Side opens after a first win); "every tool" has all 48 unlocked and all three leads.

| Players | Runs | Wins |
| --- | --- | --- |
| Greedy, Foggier 0, fresh save | 600 | 49% (Dora 44%, Enzo 54%) |
| Greedy, Foggier 0, every tool | 900 | 48% (Dora 50%, Enzo 51%, Side by Side 43%) |
| Random, Foggier 0, fresh save | 600 | 0% (570 fall in the Meadow Fair) |
| Random, Foggier 0, every tool | 900 | 0% (868 fall in the Meadow Fair) |
| Greedy, Foggier 5, every tool | 300 | 8% |

The fresh-save numbers were first measured on 31-10-2026 (before that the suite only played with every tool unlocked). They already sat inside the band a first run should have, so nothing was retuned for them: the seven unlockable tools add choice more than strength.

A greedy run lasts about 50 turns over 15 or so battles; the biggest single hit in 900 runs was 48. The suite fails if the greedy player's Foggier 0 rate with every tool leaves 35–60% (or any lead leaves 28–68%), its fresh-save rate leaves 25–50% (or Dora's or Enzo's leaves 25–60%), the random player either way wins more than 2%, Foggier 5 is not harder, any hit passes 80, a run passes 160 turns, or any tool never appears in a winning run. Tuning that got here: Dora's kit first had no multiplier tool and won 5%, so she gained Pebble Toss with the Acorn Splitter (split a 4 into two 2s for two Pebble Tosses), the Lucky Clover now also deals its die, and she heals on sixes; Enzo's Thick Fur went from 3 block to 2 and his hearts from 44 to 40; the second and third areas' foes were softened from ×1.55/×2.1 hearts and +2/+3 hits to ×1.45/×1.9 and +1/+2.

## Controls

Drag a die onto a tool, or tap the die and then the tool; while a die is chosen, the tools it fits glow and the rest dim, and tools any die fits give a little wiggle now and then. Tap a waiting two- or three-dice tool to take its dice back. The Re-roll cup (Dora's Lucky Paw, the Four-Leaf Locket) takes a dropped die or the chosen one. Click or tap a foe to aim at it (a dashed ring marks the target when there is more than one). Keys: **←**/**→** choose a die, **1**–**7** drop it in that tool (or, with no die chosen, take a waiting tool's dice back), **R** re-roll, **↑**/**↓** change the target, **E** or **Enter** end the turn, **Escape** put the die down; on the map, arrows and **Enter**. The first battle shows two short tips.

## Feel

Dice tumble in from the left of the tray along a path fixed by each die's id, with a clatter of wooden knocks that thin out as they settle. A die dropping into a slot thunks; a firing tool flashes, the pair lunge on an attack, the foe winces with a white flash and a number pops; hits of 15 or more stop the action for a beat, shake the stage and burst sparks. Foes lunge when they act, and the pair flinch, with a red flash, when hit. Each area has its own fair-organ waltz, bosses a faster one, and the ending its own.

The sound is silent until the first click, tap or key, which starts it (browsers allow nothing sooner); the tab going hidden pauses it. The Sound and Music toggles in the bar fade their own channel out and are saved. The browser suite checks this by listening at the speakers: no audio before the first click, the menu waltz playing after it, a clatter of knocks when the dice roll, a thwack when a die goes into the Sling, silence for effects and music once each is turned off, and both toggles still off after a reload (31-10-2026: it all played; nothing needed fixing).

## Fitting the screen

The menu and the ending never scroll. On phones held upright the title painting takes the space above the menu card, so the card never covers a face; each lead shows just its name, and the chosen lead's hearts and gift sit in one line below; below 760 pixels tall the story line gives its room to the painting. Held sideways, the card sits on the left and the painting beside it. The ending fills the screen: held upright, the painting takes whatever the words leave; held sideways, the painting is on the left and the words on the right. The news a first win brings (up to five lines) folds every "new tools" line into one. The browser suite checks the menu (at its tallest: a run to continue, every lead open, the Foggier row) and a first win's ending at 390×844, 360×740, 844×390, 667×375, 1280×800 and 1920×1080: no scroll, the way back on screen, and Dora's and Enzo's faces inside the painting and clear of the card or the words.

## Saving

Everything saves under `localStorage` key `lucky-pips-v1` after every action: the run in play (the whole run object, so a reload carries on exactly), the meta progress (runs, wins, the best Foggier won, unlocks, whether the ending was seen, Daily Fair results), the chosen lead and Foggier, whether the tips were shown, and the Sound and Music toggles. A save that is not valid JSON, has the wrong version, or holds a run with anything out of place (an unknown tool, a broken map, a battle that does not match the table) is ignored rather than misread; the meta fields are each checked on their own.
