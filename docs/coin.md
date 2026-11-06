# Coin of the Realm

Game 85, `/coin`. A pixel-art roguelite where you are the coin. Every hour the townsfolk holding you spends you, and all you choose is whose paw you land in next. Dora is on one face and Enzo on the other: Dora-side up the coin rolls two streets, Enzo-side up it only goes next door but Enzo overhears how everyone near is feeling. It was the third of the top five pixel roguelites in [`game-ideas.md`](game-ideas.md) (scored 7.90), built on 05-11-2026.

## Files

| File | What it is |
|---|---|
| `lib/coin-game.ts` | The rules, deterministic with no DOM: towns, reach by face, spending, moods, each town's thieves, days, perks, the run and the save. |
| `lib/coin-scene.ts` | Canvas 2D drawing at 384 by 216 pixels, scaled up with nearest-neighbour: the painted town, streets, townsfolk with their stalls and cottages, goods badges, mood bubbles, rings on who can be paid, the coin and each hand-over played out. |
| `app/coin/page.tsx` | The HUD (day and hours, town, bridge planks, the coin's face, today's orders), input, Enzo's pointers, the perk picker, results and the save. Exposes `window.__coin()` with `debug` helpers for the browser tests. |
| `app/coin/sound.ts` | Synthesised effects (the coin's clink and whoosh, a shop bell for an order, each special's sound, a thief's steps, dusk and dawn) and four original chiptune loops (title, market day, Grumble Hollow, ending). |
| `app/coin/coin.css` | The market-town look. The page is a column: HUD, the coin's face and the orders, the town, then who's chosen and the buttons. |
| `public/art/coin/` | The art (see **Art**). |
| `scripts/coin-art.py` | Turns the Codex paintings into the game's pixel art. |
| `tests/coin.mjs`, `tests/coin-bot.mjs`, `tests/e2e/coin.mjs` | Engine checks, bots and the browser suite. |

## A town

Eleven townsfolk on a 4 by 3 grid of plots (one plot left empty), joined by streets: most neighbouring plots, plus a few diagonals (at most one per square of four, so streets never cross), topped up until everyone is joined and has two streets where the grid allows. The Mayor lives in one of the two middle plots; Thieves' dens are the corners furthest from her. Everyone else is shuffled: the town's specials and at least one of each of the six sellers.

| Townsfolk | When the coin lands with them |
|---|---|
| **Baker**, **Woodcutter**, **Smith**, **Weaver**, **Fisher**, **Potter** | If their good (bread, timber, nails, rope, fish, pots) is an open order today, it's filled: one plank, two if they're cheery, none if they're grumpy (the order stays open). |
| **Mayor** | Every morning starts in her paw. Once a day, paying her pins one more order on the board (a good not already open). |
| **Pedlar** | The coin's next spend can go to anyone in town. |
| **Gossip** | Enzo hears everyone's mood in town. |
| **Juggler** | The coin lands both ways up: Dora's reach and Enzo's ears at once. |
| **Miser** | Once a day, a plank from his sock of savings, but the coin stays with him two hours longer. |

| Town | Planks | Thieves | Specials | Grumpy chance |
|---|---|---|---|---|
| Bramble Green | 6 | none | Pedlar, Gossip | 12% |
| Saltwick Harbour | 7 | 1 herring gull | + Miser | 16% |
| Russet Hill | 8 | 1 magpie | + Juggler | 20% |
| Grumble Hollow | 9 | 2 Grumbles | all four | 24% |

Each town has its own thieves, and they all follow the same rules: herring gulls at the harbour, magpies on the hill, and Grumbles only in Grumble Hollow. Enzo introduces each kind the first time you meet it.

## An hour

1. **Choose.** Whoever can be paid glows gold. Dora-side up, that's anyone within two streets; Enzo-side up, next door; after the Pedlar, anyone. The coin never lands on, or rolls through, a thief. A red ring means a thief would snatch the coin there in the next hour (or the next three, at the Miser). **Wait an hour** keeps the coin where it is.
2. **Land.** The coin turns over (Dora to Enzo, Enzo to Dora; after the Juggler it's both, then Dora). The townsfolk does their thing. If the coin lands Enzo-side up (or both), Enzo hears the mood of everyone within two streets.
3. **Thieves.** The hour passes and each thief steps one street along the shortest way to the coin (ties to the lower-numbered townsfolk; they don't share a plot). If one reaches the coin's paw, the coin is snatched and the rest of the day is lost.

Each day has eight hours. At dusk everyone's visits are counted, and in the morning each seller's mood is dealt again from the seed: a seller paid yesterday is cheery 30% of the time and grumpy half the town's usual chance; one left out is cheery 8% of the time and grumpy the town's chance plus 20%. Moods start unheard every morning. The coin goes back to the Mayor, Dora-side up, with three new orders, and the Grumbles go home.

The bridge is built the moment the planks reach the goal. If the last day ends first, the coin is melted down for nails and the run is over.

## The run

Four towns, three days each. After each bridge, pick one of three perks from Dora's pockets:

| Perk | Most | Effect |
|---|---|---|
| Long day | 2 | One more hour every day. |
| Wanderlust | 1 | Dora-side up, three streets. |
| Big ears | 1 | Enzo hears three streets away. |
| Lucky toss | 2 | Once a day per pick, turn the coin over without spending an hour. |
| Spare planks | 2 | Every new town's bridge starts with one plank per pick. |
| Butter paws | 1 | Thieves only move every other hour. |
| Rainy-day fund | 1 | One more day in every town. |

## Art

All the art is Codex-painted pixel art: three 2×2 townsfolk sheets on flat magenta (rabbit baker, beaver woodcutter, badger smith, mouse weaver; otter fisher, tortoise potter, fox pedlar, duck gossip; raccoon juggler, toad miser, owl mayor, a Grumble), a thieves sheet (a herring gull and a magpie, each with a thief's sack; `cn2-thieves`), the coin with Dora's face and with Enzo's, planks and a sock, two goods sheets (bread, timber, nails, rope; fish, a pot, a cottage and a market stall), four towns seen from above with an empty middle and a river with a broken bridge along the bottom, the title, the ending and portraits of Dora and Enzo. `scripts/coin-art.py` keys the magenta, crops and shrinks each sprite with a box filter and a small palette, crops the towns from the bottom to 384 by 216 and speckles their plain middles. The source paintings are not in the repo.

## Bots and balance

`npm run bot:coin` (with `--quick`, six runs, part of `npm test`), thirty seeded runs:

| Bot | Plays | Result (05-11-2026) |
|---|---|---|
| Planner | Looks two hand-overs ahead, treating unheard moods as fair (it never peeks), counting planks, steering clear of thieves and towards open orders. | 18 of 30 won, 3.4 bridges on average. Must win at least 30%. |
| Greedy | Takes an open order it can reach now, otherwise the first townsfolk it can reach. | 1 of 30 won, 1.4 bridges. Must do worse than the planner. |
| Random | Any townsfolk it can reach. | 0 won, 0.5 bridges. Must never win, and be 1.5 bridges behind the planner. |

The bots take the first perk offered; a person chooses, and can also use the Gossip and the Mayor on purpose.

## Ideas not done

- Townsfolk who trade with each other off-screen, so the town's wealth moves even where the coin isn't.
- A coin that wears smooth with every hand-over, and a Smith who can restrike it.
- A daily seed.
