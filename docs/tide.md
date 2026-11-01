# Tidepool

A cosy rock-pool ecosystem at `/tide`, game 73 of the arcade, in a new claymation art style. Below their summer cottage Dora and Enzo look after a rock pool through the tides and four seasons. The creatures live by simple rules of their own; you nudge, watch and fill in a field journal, and on the autumn spring tide everyone goes out to sea.

All numbers below come from `lib/tide-game.ts`, `lib/tide-scene.ts` and `app/tide/page.tsx`. Written 01-11-2026.

## Files

- `lib/tide-game.ts`: the rules. The tide clock, warmth, light, oxygen and food, every creature as an agent with its own small rules, gulls and jellies, the player's nudges, weather, seasons, the 24 journal pages and their shells, the save. A fixed step of 0.1 s, randomness from a seeded generator, so a seed and the same nudges replay exactly.
- `lib/tide-scene.ts`: the drawing (Canvas 2D). Plasticine shapes with a fingerprint texture and an outline that re-jitters 12 times a second like stop-motion; the backdrop, the boulder rims, the sand, every creature, the plank, the sea and weather, word pops ("nom", "phew!", "roomy!"), and Dora and Enzo as clay cut-outs on the rims. It does not use the shared `drawChinchilla`; until the cut-outs load it draws its own clay chinchillas. Also the journal sketches.
- `app/tide/page.tsx`, `tide.css`, `sound.ts`, `layout.tsx`: the page (menu, play, the free pool's season picker, the journal, the season card, pause, the ending), input, saving and the HUD; synthesised waves, plops and a marimba tune for the menu, each season and the ending.
- `tests/tide.mjs`, `tests/tide-bot.mjs`, `tests/tide-bot-policy.mjs`, `tests/e2e/tide.mjs`: engine checks, the caretaker and idle bots, and the browser suite.
- Paintings and cut-outs in `public/art/tide/`, briefed in [`tide-art-brief.md`](tide-art-brief.md).

## The tide

- One tide lasts 600 steps (60 s at normal speed). The sea is over the rim half of each tide; a new tide is counted at each high water. A new pool starts with the tide just gone out.
- While the sea covers the pool its water is the sea's: the season's sea temperature, full oxygen and fresh plankton, and it brings larvae, scraps and (in summer) moon jellies.
- At low tide the pool is cut off. It warms towards the air temperature in the sun, its creatures use up the oxygen, seaweed puts oxygen back in the light, and gulls come (one in spring and autumn, two in summer and late summer).
- Each low tide gives 1 energy (up to 6), and while the basket holds fewer than 7 things, one beachcombing find (a seedling, shell, rock or a creature). Each finished page also gives 1 energy.

## The creatures

| Creature | Eats | Eaten by | Rules |
| --- | --- | --- | --- |
| Beadlet anemone | plankton | nobody here | Catches drifting food at high tide; buds a new anemone when well fed. Up to 8. |
| Limpet | algae on the rocks | nobody here | Grazes its rock and wanders to a greener one when it is bare. Up to 6. |
| Periwinkle | algae on the rocks | nobody here | Grazes like a limpet; leaves a small shell behind when it dies. Up to 6. |
| Mussel | plankton | starfish | Filters the water: a mussel bed clears a bloom. Settles on rocks from the high tide. Up to 10. |
| Rock shrimp | algae and scraps | blenny, gulls | Nibbles and roams; darts into seaweed when the blenny comes. Up to 8. |
| Hermit crab | scraps | gulls | Scavenges the sand, grows, gets cramped and swaps into a bigger shell. Up to 5. |
| Blenny | shrimp, scraps when shrimp are scarce | gulls | Hunts shrimp that are not in the weed; nests in a seaweed forest in summer. Up to 3. |
| Starfish | mussels, slowly | nobody here | Spawns on warm high tides of late summer when well fed. Up to 2. |
| Seaweed | sunlight | nobody | Grows faster in brighter seasons, breathes out oxygen, hides shrimp; dies back in autumn. Up to 8. |

Each creature has a heat limit and an oxygen limit; past them it loses health and can die. Gulls take anything they can see at low tide unless shooed; creatures under the plank or in the weed are hidden from them.

## Tools

Look (1), Rock (2), Shell (3), Plant (4), Trim (5), and from summer Plank (6) and Bucket (7). The basket holds rocks, shells, seedlings and creatures to bring in, shown as buttons beside the tools.

- **Look**: click a creature to sketch it; three looks finish its sketch. The same one counts again after a short while.
- **Rock** and **Shell**: drop one from the basket on the sand. Rocks need room (up to 4 placed); a shell near a cramped hermit crab gets swapped into.
- **Plant** a seedling (up to 8 seaweeds, with room between them); **Trim** a seaweed.
- **Plank** (low tide only): shades the pool so it warms more slowly, and hides what is under it. The rising tide lifts it away.
- **Bucket** (low tide only, costs 2 energy): pours in seawater: cooler water, oxygen back, a little food.
- **Shoo**: click a gull that is eyeing the pool.

Keys: 1–7 tools, Space pauses the tide, F faster, J journal, B bucket, K plank, Esc or P pause. The speed buttons run the tide at 1×, 2× or 4×.

## Seasons and weather

| Season | Light | Sea | Air | Weather | Arrives |
| --- | --- | --- | --- | --- | --- |
| Spring | 78% | 11° | 15° | calm | the hermit crab waits in the basket |
| Summer | 100% | 16° | 22° | heatwave on tides 3–4 of every six | the plank and the bucket, 2 seedlings, a shell |
| Late summer | 86% | 17° | 20° | plankton bloom on tides 2–3 of every six | the starfish, a rock, a seedling |
| Autumn | 58% | 13° | 13° | storm surge on tide 4 of every six | 2 rocks, a seedling, a shell |

A heatwave adds 12° to the air. A storm surge flattens the seaweed by 30% and can sweep away any creature but anemones and mussels that is not sheltered by a placed or big rock or a grown seaweed (limpets and periwinkles hold on better); it leaves a shell and a rock in the basket. Four finished pages in a season let you turn to the next one.

## The journal

24 pages, six a season. Each is worth up to 3 shells: 3 if finished within its target number of tides in that season, 2 within a looser target, otherwise 1. The targets were set just above the slowest caretaker bot over 16 seeds. Some pages give a reward (a seedling, a shell, a rock, a blenny, a shrimp). The last page, **The spring tide**, is the ending: in autumn, after four pages, release everyone; the biggest tide of the year carries the whole pool out to sea.

The journal also holds the field guide (a sketch of each of the 11 kinds, filling in from pencil to colour as you look) and the food web (solid arrows for links you have seen, dashed for ones still to see).

After the ending the **Free pool** opens: any season, every creature and tool, a basket that refills, no pages.

## Saving

Saved in `localStorage` under `tidepool-v1` every 4 s and on leaving: settings, the story pool, the free pool, whether the ending has been reached and the best shell count. A save that fails any check is ignored and the game starts fresh.

## Tests

- `npm run test:tide`: every creature's rules, the food web, the tide clock, warmth, light and oxygen through a tide, the plank and bucket, gulls, population caps and no sudden crashes, sketching and pages, weather and seasons, the ending, exact replay, saves and corrupt saves.
- `npm run bot:tide`: the caretaker finishes all 24 pages with 3 shells on pages 1–23 on 16 seeds; the idle bot fails every care page; cared-for free pools in each season stay stable for 45 tides. `npm test` runs it with `--quick`.
- `npm run test:e2e:tide`: the menu, real mouse and keyboard play, the journal, a save across a reload, a corrupt save, the season turn and the plank, the ending and the free pool, the framing at 1280×800 and 1920×1080, and phones held upright and sideways played by touch.
