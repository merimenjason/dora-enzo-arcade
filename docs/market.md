# Night Market

A lantern-lit market stall game with haggling at `/market`, in a new Japanese woodblock-print art style. Over one moon month Dora and Enzo run a little stall at the riverside Night Market: they buy wares at dusk, set out the stall, sell by lantern light, read their customers' tells, haggle on a price dial and save up for a festival lantern boat.

All numbers below come from `lib/market-game.ts`, `lib/market-scene.ts` and `app/market/page.tsx`. Written 01-11-2026.

## Files

- `lib/market-game.ts`: the rules, deterministic and seeded (a mulberry32 generator whose state lives in the game state; no `Math.random`, no clock): the wares, suppliers and sets, the season and rumour price model, the customer kinds and their haggling, the tells and reading them, reputation and the regulars, the moon calendar and its events, the weekly lanterns, and the save.
- `lib/market-scene.ts`: the night scene in Canvas 2D: the backdrop painting (or a drawn bokashi stand-in), the stall with its noren curtain and paper lanterns, the wares as woodblock stamps, Dora and Enzo behind the counter, the customer with their tells drawn as ink marks, the long look, the speech scroll, flying coins and verses, and a paper-fibre overlay. It does not use the shared `drawChinchilla`.
- `app/market/page.tsx`, `market.css`, `sound.ts`, `layout.tsx`: the page (menu, customer book, dusk, night, dawn, the end), input, the haggle dial, saving and the HUD; koto plucks, coin chinks, a shamisen twang, wind chimes, a taiko thump, a seal stamp and a yo-scale music loop.
- `tests/market.mjs`, `tests/market-bot.mjs`, `tests/market-bot-policy.mjs`, `tests/e2e/market.mjs`: the engine checks, the bots and their shared policies, and the browser suite.
- Art in `public/art/market/`: three paintings (title, backdrop, ending), Dora and Enzo in four poses each (greeting, thinking, delighted, counting coins) and seven customers, all briefed in [`market-art-brief.md`](market-art-brief.md).

## The month

The moon month is 28 nights in four weeks (`MOON_NIGHTS`). It starts with a purse of 30 mon and reputation 30 out of 100. The lantern boat costs **500 mon** (`BOAT`): whatever is in the purse at the end of night 28 decides whether Dora and Enzo sail their own boat at the festival or ride along on Kiko's.

The **Free market** is one week of seven nights (`FREE_NIGHTS`) from a seed the player types (or a random one): a random rain or poets' night on night 2, 3 or 4, the festival on the last night, no tax and no boat. The best purse is kept.

## Dusk: buying

Three or four of the five suppliers are open each dusk (a seeded shuffle). Each sells two wares:

| Supplier | Wares (going rate before demand) | Set |
| --- | --- | --- |
| Old Umeko, the potter | teacup 6, teapot 16 | teacup + teapot = **Tea set** |
| Shige, the weaver | silk scarf 13, wrapping cloth 8 | scarf + pearl = **River finery** |
| Aunt Chiyo, the tea grower | green tea 7, moon tea 15 | |
| Toku, the toy carver | spinning top 5, paper lantern 9 | lantern + top = **Festival pair** |
| Gen, the night fisher | dried fish 4, river pearl 26 | |

A ware's **going rate** is its base times tonight's demand. The wholesale **cost** is 62% of the base, nudged by the season's supply and ±10% of seeded wobble. Demand gets ±6% wobble plus:

- **The season** (week by week): week 1 harvest moon (tea ×1.25, fish ×1.15, cups ×1.1; tea costs ×0.8); week 2 cold nights (scarves ×1.25, cloths ×1.15, moon tea ×1.1; fish costs ×0.85); week 3 the collectors (pearls ×1.2, teapots and moon tea ×1.15; cups and tops cost ×0.85); week 4 the festival is near (lanterns ×1.4, tops ×1.25, cups ×1.05; lanterns cost ×1.15).
- **The rumour**: each dusk one open supplier's ware (never last night's) gets a tip. 65% of the time it will sell (demand ×1.35, marked 売); otherwise the supplier has a glut and sells it at 70% of the price (marked 安).
- **Events**: rain makes scarves and cloths ×1.5; the festival makes lanterns ×1.6 and tops ×1.3.
- **Kiko the rival fox** sells one ware across the lane on nights 8 to 21 (demand for it ×0.75).

Wares in demand (×1.15 or more) carry the 売 seal. The cart holds 8 wares, 10 from night 8 (Shige lends a bigger cart) and 12 from night 22; unsold wares carry over. A ware bought this dusk can be put back for what was paid.

**The stall.** Up to three different wares stand at the front of the counter; the rest wait in crates below. A customer comes for a ware chosen by demand, weighted by their kind's taste, doubled when it is at the front, and ×1.3 more when both halves of a matching set are at the front. If the stall doesn't have what they came for, 55% of the time they settle for a front ware (a little less keen, ×0.88); otherwise they shrug and move on (counted as missed at dawn).

**Lanterns.** Two lanterns always hang at the stall; up to three more can be lit for 3 mon of oil each a night, and each brings one more customer.

**The crowd** is 2 + lit lanterns + reputation ÷ 34 + word of mouth (one more after a night with four or more fair deals), −2 on the rain night, +1 on poets' night, +4 at the festival and +1 from night 22 (Kiko's overflow), between 2 and 14.

## Night: the customers

Each customer has a kind, a hidden **top price** (the going rate × their kind's mean × up to ±17% of wobble) and **tells**:

- **posture** (leaning in, standing straight, leaning back), **ears** (pricked up, relaxed, flat) and the **purse** (heavy or light): each follows how far the top price is over or under the going rate, skewed by their kind and blurred by noise;
- **the look**: one to four beats of gazing at the ware (shown as a dotted eye-line with beads);
- **the tail**: flicking for an eager tanuki, and always for a rabbit in a hurry (where it only means hurry);
- **coming back**: a customer who walked off keen may come back later, 8% keener, marked with the red 再 seal.

| Kind | Species | Top price | Patience | Habits |
| --- | --- | --- | --- | --- |
| Thrifty | badger | 0.95× | 3 counters | Always haggles once, even at a fair price. Hides interest (posture, ears and purse read low). Likes cheap wares. |
| Impulsive | tanuki | 1.12× | 1 counter | Pays up to 8% over their top price if you name it at once. Loud, honest tells. Likes tops, lanterns, scarves. |
| Collector | crane | 1.0×, 1.32× for teapots, moon tea and pearls | 2 counters | Straight face, but the length of the look is reliable. Heavy purse. |
| In a hurry | rabbit | 1.04× | 1 counter | Tail always flicks, look always short; walks at once from an ask 25% over. |
| Regular | otter (Granny Kawa, Mo, Little Suzu) | 1.0× + 5% per friendship | 3 counters | Remembers you: friendship from −3 to 5. |
| Poet (poets' night) | rabbit | 1.05× | 2 counters | Pays 70% in coin plus a verse, and tips 45% of the price for a fair deal. |

**Haggling.** The dial runs from 1 to two and a half times the going rate and starts at the going rate; it marks the going rate, the customer's last offer and, on nights 1 to 3, Enzo's hunch (the engine's reading of the tells). An ask at or under the top price sells. An ask over it gets a counter-offer, starting at 62% to 86% of the top price by kind and rising each round, until the kind's patience runs out or the ask is more than 1.25× to 1.7× the top price, when they walk. The player can take the counter, ask again, or let the customer go with no hard feelings.

**Reputation.** A fair deal (no more than 92% of the top price) +1; a regular's fair deal +2 and a friend; squeezing a regular (over 97%) −2 and a friend lost; a walk-out −2 (−3 for a regular, and a friend lost). Reputation fades by 2 every night. A matching set: when a customer buys one half at no more than 97% of their top price and the other half is at the front, they take that too at its going rate.

## The calendar

- Night 1: Granny Kawa's welcome; Enzo's hunch shows on nights 1 to 3.
- Night 5, **rain night**: fewer folk, scarves and cloths fly.
- Night 8: Kiko the fox opens a rival stall (visits at the start of the night); the cart grows to 10.
- Night 12, **poets' night**: half the customers are rabbit poets.
- Night 19, **the tax heron**: a market fee of a tenth of the purse at the start of the night, halved with reputation 60 or more. No haggling.
- Night 22: Kiko calls a truce and sends her overflow; the cart grows to 12.
- Night 28, **the lantern festival**: four more customers, lanterns and tops in demand, then the ending.

**Weekly lanterns** (up to 3 a week, 12 a month): one each for the week's profit (takings less what the sold wares cost) reaching the two goals, and one for the week's request.

| Week | Profit goals | Request |
| --- | --- | --- |
| 1 | 110, 160 | Old Umeko: sell a matching set together |
| 2 | 170, 250 | Granny Kawa: make 8 fair deals |
| 3 | 210, 320 | Gen: sell 3 river pearls |
| 4 | 250, 380 | Toku: sell 6 paper lanterns |
| Free market | 140, 200 | Kiko: make 6 fair deals |

## The bots

`tests/market-bot.mjs` plays 40 moon months (8 with `--quick`) with three policies that buy and arrange the stall the same way (best margin times demand, spread across wares, sets at the front, lanterns when the stock outruns the crowd) and differ in haggling:

- **reader**: asks Enzo's hunch (90% of it for regulars) and takes a counter at 84% of it or better: median purse about 870 (lowest about 600), the boat every time, median 10 of 12 lanterns;
- **greedy**: always asks the top of the dial: everyone walks, the purse ends near 0, no lanterns;
- **giveaway**: always asks 65% of the going rate: median purse about 340, never the boat, median 4 lanterns.

The boat price and the lantern goals were set from these runs: the first lantern each week is in reach of the reader at least 85% of the time, the second needs sharper haggling than the bot's, and the giveaway bot misses the first.

## Controls

- **Dusk:** click or tap **+** and **−** on a ware to buy it or put it back, tap a ware under *Your stall* to put it at the front or take it off, tap the lanterns to light them, then **Open the stall**.
- **Night:** turn the dial by dragging it, with the **−5 − + +5** buttons, or with **←** **→** (**↑** **↓**, **Shift** for 5, **Page Up** / **Page Down** for 5). **Enter** or **Space** asks the price, **T** takes the customer's offer, **Esc** or **L** lets them go. **Enter** continues past a visitor.
- Sound and Music toggles are on the menu and in the top bar; **← Arcade** goes back.

## Layout

On a desktop the night scene fills the screen above the haggle panel (who they are, the tells, the dial, the buttons); the stall, Dora, Enzo and the customer scale with the scene and the panel never covers them. Text scales with the screen. On an upright phone the customer stands closer to the counter and the panel stacks the tells over the dial and buttons; held sideways the panel moves to the right. Dusk is a centred grid of large supplier cards with the stall card beside it (below on an upright phone). Dawn shows Dora counting coins and Enzo cheering either side of the night's tally.

## Save

`localStorage` key `night-market-v1`: `{ v: 1, run, best: { lanterns, boat, free, months }, tutorial, settings: { sound, music } }`. `run` is the whole month in progress (including the generator state, so a reload continues exactly), saved at every dusk, customer and dawn. Every field of a stored month is checked on load; a damaged month is dropped while the best results and settings are kept, and anything unreadable starts fresh.
