# Acorn Hand

Route `/acorn-hand`. A poker-scoring card run in the manner of Balatro: play poker hands for chips × mult, gather chinchilla charms that change the arithmetic, and beat eight antes of rising targets set by woodland rivals. The rules are in `lib/acorn-hand-game.ts` and the tables in `lib/acorn-hand-cards.ts`; every number below comes from them.

## A round

- The deck is 52 cards: four suits (Acorns, Clovers, Berries, Pebbles) of 2 to 10, jack, queen, king and ace. Cards can be glossed, dyed, copied and removed during a run, so the deck changes.
- You hold 8 cards and have 4 plays and 3 discards. A play or a discard takes 1 to 5 cards; the hand refills from the draw pile afterwards.
- The best poker hand among the played cards sets base chips and mult (raised by its level). Each card that counts adds its chips: its number, 10 for a face card, 11 for an ace. Then glosses on those cards, then each charm in order from left to right: per scoring card, per card held in hand, and finally once for the whole hand. The score is chips × mult, rounded down.
- Only the cards that make the hand count: the pair in a pair, the top card in a high card, all five in a straight, a flush or a full house. Aces are high or low in a straight; straights do not wrap round.
- Reach the target before the plays run out. Running out ends the run.

## Hand types

| Hand | Chips | Mult | Per level |
| --- | --- | --- | --- |
| High card | 5 | 1 | +10 chips, +1 mult |
| Pair | 10 | 2 | +15 chips, +1 mult |
| Two pair | 20 | 2 | +20 chips, +1 mult |
| Three of a kind | 30 | 3 | +20 chips, +2 mult |
| Straight | 30 | 4 | +30 chips, +3 mult |
| Flush | 35 | 4 | +15 chips, +2 mult |
| Full house | 40 | 4 | +25 chips, +2 mult |
| Four of a kind | 60 | 7 | +30 chips, +3 mult |
| Straight flush | 100 | 8 | +40 chips, +4 mult |
| Five of a kind | 120 | 12 | +35 chips, +3 mult |
| Flush five | 160 | 16 | +50 chips, +3 mult |

Five of a kind and flush five need copied or dyed cards. Almanac pages for them only appear in the shop once you have played them.

## A run

- Eight antes, each a small round, a big round and a boss round. The small round's target per ante is 250, 650, 1,800, 4,400, 8,500, 16,000, 25,500 and 38,000; the big round is 1.5 times that and the boss round twice. Past ante 8 (endless) each ante is 1.8 times the last.
- Winning pays 3, 4 or 5 nuts for the small, big or boss round, 1 for each play left, 1 for every 5 nuts held (at most 5, or 10 with Squirrel Hoard), plus charms and gold cards. You start with 4 nuts.
- The small and big rounds can be skipped for a free item (or 4 nuts if both item slots are full). The boss round cannot.
- Each ante's rival is drawn so that all thirteen come round before any repeats, and never the same rule twice in a row.

## Stakes

Winning a run opens a harder stake, picked on the title screen before a new run (the hardest one open is picked by default). Each stake keeps every rule of the stakes below it, and winning on a stake opens the next. Endless antes keep the stake's rules.

| Stake | Adds |
| --- | --- |
| Green | The run as it comes. |
| Bronze | The small round pays no blind reward (plays left, interest, charms and gold still pay). |
| Silver | Targets from ante 2 on are a quarter higher (×1.25, rounded). |
| Gold | One discard fewer each round (never below none). |

Over 500 seeds the bot wins about 29% on green, 14% on bronze, 8% on silver and 6% on gold. `npm test` plays 200 seeds on each and requires each stake to win fewer runs than the one below (gold no more than silver) and gold to be won at least 2% of the time. A player who builds around a hand type does much better than the bot, which is what the stakes are for.

## The shop

Between rounds: two charms, two distinct items (almanac pages or treats; the same page or treat cannot appear twice on one shelf), a reroll for 5 nuts that costs 1 more each time in the same shop and never shows the charms it replaced, and selling (half the price, at least 1). Commons cost 4, uncommons 6, rares 8, items 3. Charms are drawn 70% common, 25% uncommon and 5% rare, and a charm that fits the run (its suit, or the hand types you play most) is 2.5 times as likely. You hold 5 charms and 2 items. Charms can be reordered: a ×mult charm multiplies everything to its left. Each shop also has this ante's voucher and two booster packs; a reroll changes neither.

## Vouchers

One voucher is on offer each ante, in every shop of that ante until it is bought; a new one is rolled when the boss is beaten. Each costs 10 nuts, lasts the rest of the run, and is never offered twice. Boss rules that set a number outright still win: the Bear's three plays, the Cougar's no discards, the Mole's one card fewer.

| Voucher | Effect |
| --- | --- |
| Wider Shelf | +1 charm slot (6). |
| Deep Pockets | +1 item slot (3). |
| Haggler | Rerolls start at 3 nuts, not 5. |
| Squirrel Hoard | Interest goes up to 10, not 5: up to 50 nuts held count. |
| Extra Paw | +1 play each round. |
| Spare Paw | +1 discard each round. |
| Big Paws | +1 hand size. |
| Bigger Stall | The shop shows 3 charms, not 2. |
| Market Day | Every pack shows one more option. |
| Lucky Burrow | Uncommon and rare charms are twice as likely. |

## Booster packs

Every shop sells two packs. A normal pack is three times as likely as a big one, and the four kinds are equally likely. Opening a pack shows its options; take what it allows or skip the rest (the nuts are spent either way).

| Pack | Normal | Big |
| --- | --- | --- |
| Charm | pick 1 of 2 · 5 nuts | pick 1 of 4 · 7 nuts |
| Almanac | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |
| Treat | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |
| Card | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |

- **Charm:** charms you don't own, drawn like the shop's. Taking one needs a free slot; charms can be sold inside the pack.
- **Almanac:** pages for different hand types, used as you take them.
- **Treat:** different treats, used at once on cards from eight dealt from your deck for the pack.
- **Card:** playing cards of any rank and suit, about 30% glossed; the one you take joins your deck.

## Charms

| Charm | Rarity (cost) | Effect |
| --- | --- | --- |
| Dora | Common (4) | +4 mult. |
| Enzo | Common (4) | +40 chips. |
| Bramble | Common (4) | Each scoring Acorn gives +3 mult. |
| Pip | Common (4) | Each scoring Clover gives +3 mult. |
| Mossy | Common (4) | Each scoring Berry gives +3 mult. |
| Flint | Common (4) | Each scoring Pebble gives +3 mult. |
| Willow | Common (4) | +8 mult if the hand contains a pair. |
| Nutmeg | Common (4) | +10 mult if the hand contains two pair. |
| Pebble | Common (4) | +12 mult if the hand contains three of a kind. |
| Gale | Common (4) | +12 mult if the hand contains a straight. |
| Thistle | Common (4) | +10 mult if the hand contains a flush. |
| Wren | Common (4) | Each scoring 2, 3, 4 or 5 gives +4 mult. |
| Hazel | Common (4) | Each scoring face card gives +30 chips. |
| Robin | Common (4) | Each scoring ace gives +20 chips and +4 mult. |
| Sorrel | Common (4) | Earn 1 nut for each face card you discard. |
| Cashew | Common (4) | Earn 4 nuts when you win a round. |
| Mags | Common (4) | +1 mult for every 3 nuts you hold. |
| Burrowby | Common (4) | +25 chips for each discard you have left. |
| Driftwood | Common (4) | +2 chips for each card left in your draw pile. |
| Poppy | Common (4) | +15 mult if you play three or fewer cards. |
| Ember | Uncommon (6) | ×2 mult if the hand contains a flush. |
| Clover | Uncommon (6) | ×2 mult if the hand contains two pair. |
| Cinder | Uncommon (6) | Gains +1 mult every time you play a hand. |
| Frost | Uncommon (6) | Gains ×0.25 mult every time you play a straight. |
| Onyx | Uncommon (6) | ×1.5 mult for each king held in your hand. |
| Zephyr | Uncommon (6) | Flushes and straights can be made with four cards. |
| Aurora | Uncommon (6) | The first scoring card scores twice. |
| Fennel | Uncommon (6) | Scoring cards give +1, +2, +3, +4 and +5 mult in turn. |
| Sable | Uncommon (6) | ×2 mult on the last play of a round. |
| Bracken | Uncommon (6) | Gains +3 chips for every card you discard. |
| Rill | Uncommon (6) | Scoring 9s and 10s score twice. |
| Juniper | Uncommon (6) | ×1.5 mult if you play exactly four cards. |
| Prism | Uncommon (6) | ×3 mult if the played cards hold all four suits. |
| Sage | Uncommon (6) | The first hand you play each round goes up a level first. |
| Lantern | Uncommon (6) | Hold one more card in your hand. |
| Thrift | Uncommon (6) | One more discard each round. |
| Honeycomb | Uncommon (6) | Each scoring glossed card gives +6 mult. |
| Stag | Rare (8) | ×1.25 mult for each charm you own, this one included. |
| Echo | Rare (8) | Copies the charm to its right. |
| Luna | Rare (8) | Every card you play scores. |
| Regent | Rare (8) | ×3 mult, but hold one card fewer. |
| Comet | Rare (8) | Gains ×0.5 mult every time you beat a boss. |
| Bloom | Rare (8) | Scoring face cards score twice. |
| Tumble | Rare (8) | One more play each round. |

## Treats

Treats that change cards are used during a round with up to the stated number of cards selected. Almanac pages, Clover tea and the wishing stone can be used at any time.

| Treat | Effect |
| --- | --- |
| Honey drop | Up to two selected cards turn honey: +30 chips when they score. |
| Ember spice | Up to two selected cards turn ember: +4 mult when they score. |
| Crystal dew | One selected card turns crystal: ×1.5 mult when it scores. |
| Gold leaf | One selected card turns gold: +3 nuts if it is in your hand when you win the round. |
| Acorn dye | Up to three selected cards become Acorns. |
| Clover dye | Up to three selected cards become Clovers. |
| Berry dye | Up to three selected cards become Berries. |
| Pebble dye | Up to three selected cards become Pebbles. |
| Mirror pond | Adds a copy of one selected card to your deck and your hand. |
| Compost | Removes up to two selected cards from your deck for good. |
| Sprout | Up to two selected cards go up one rank (an ace stays an ace). |
| Clover tea | Doubles your nuts, adding at most 20. |
| Wishing stone | A random charm, if you have room for it. |

Glosses: honey +30 chips, ember +4 mult and crystal ×1.5 mult when the card scores; a gold card pays 3 nuts if it is still in your hand when the round is won.

## Rivals

| Rival | Rule |
| --- | --- |
| The Fox | Acorns score nothing. |
| The Owl | Clovers score nothing. |
| The Hawk | Berries score nothing. |
| The Snake | Pebbles score nothing. |
| The Badger | Every play must be exactly five cards. |
| The Skunk | Your first hand is dealt face down. |
| The Weasel | Face cards are dealt face down. |
| The Mole | Hold one card fewer. |
| The Bear | Only three plays this round. |
| The Cougar | No discards this round. |
| The Beetle | After each play or discard, draw at most three cards. |
| The Lizard | Your most-played hand type scores half its base chips and mult. |
| The Armadillo | A thick shell: the target is half as high again. |

## Table and motion

A rival sits across the table every round: the ante's boss in the boss round, and otherwise one of the other twelve rivals, picked by `tableRival` in `lib/acorn-hand-banter.ts` from the seed, the ante and the round. It never uses the run's random numbers, so seeds replay as before and a reload shows the same rival; the small and big rounds of an ante always have different rivals. Beside the rival, a pile of `ceil(10 × (1 − score ÷ target))` nuts shows what is left of the target. Dora and Enzo sit by your hand (hidden on phones). On screens wider than 560px and taller than 520px the rival's portrait is centred across the table at 200px, with its nut pile at its left and its words at its right; on screens taller than 700px five soft card-shaped slots between the rival and your hand mark where a played hand lands, and they clear while it counts.

| Moment | When | What the rival does |
| --- | --- | --- |
| Enter | the round starts | slides in and greets you (the boss boasts) |
| Idle | between reactions | breathes slowly, then squashes and hops, every 6 s |
| Discard | you discard | leans in with a taunt |
| Hit | a hand under a quarter of the target | flinches |
| Big | a hand of a quarter of the target or more | recoils and yelps; the table shakes |
| Rule | a boss rule changes a score | shows off, saying the rule |
| Beaten | the score passes the target | slumps and concedes |
| Gloat | the run ends in that round | bounces and gloats |

Each rival has two lines per moment, said in turn, never at random. The motion lives in `app/acorn-hand/motion.ts`, on the Web Animations API: cards deal from the deck and flip, fly to the table and sweep away, charms wiggle as they score, a held card a charm counts (Onyx's kings) rises and glows in your hand, the counters and score tick up, the hand's name crosses the table, nuts fly to the purse at cash-out, packs burst open and bought charms fly to their slots. Nothing waits for an animation: the state changes at once and only the counting of a played hand holds input, as before. The hand that wins or loses a round counts on the table before the cash-out or game-over panel. With reduced motion set, none of it runs.

## Saves

`acorn-hand-run-v2` holds the whole run, the round or open pack in progress included, with the random generator's state, so a reload resumes exactly; it is written after every action and cleared when a run is lost. `acorn-hand-v1` is the record: runs, wins, best ante, best hand and the charms you have met. `acorn-hand-sound-v1` is the sound setting. Both saves are validated on load, and anything malformed is ignored. Version 2 added vouchers and packs; a version-1 run is ignored. The record keeps its own version, so it carried over. Both saves gained a `stake` field on 17-10-2026 without a version change: a run without one is a green run, and a record without one has only green open.

## Balance

Tuned against `tests/acorn-hand-bot.mjs`, which weighs every legal play, discards towards flushes and sets, and judges charms by rescoring its own recent plays with and without them. Since vouchers and packs (15-10-2026), and the smoother curve of 17-10-2026, over 200 seeds it wins about 29% of runs and loses about 4.5% in ante 1; `npm test` requires 20–45%, under 5% and no wall (below). It buys this ante's voucher when it can (Wider Shelf, Extra Paw and Big Paws first), opens charm packs with nuts to spare, almanac packs for its most-played hand, treat packs for glosses, and card packs only when rich. With them it won 49% at the old targets, so antes 5 to 8 went up from 7,000, 12,500, 20,000 and 30,000. Its median nuts left after a shop fell from about 12 to about 5 from ante 3 on. A player who builds around one hand type does much better: the first run played by hand (15-10-2026) won with a two-pair build, and once a ×mult charm joined it, antes 6 to 8 were beaten with hands two to three times the target.

### The ante curve · 17-10-2026

Over 1,000 seeds the bot survived antes 2 to 4 almost every time (96–98%), then met a wall at ante 5 (80%), where 18% of all runs ended: 3,500 to 9,000 was the steepest step of the curve. Antes 3 to 5 became 1,800, 4,400 and 8,500, and antes 6 to 8 stayed. Survival per ante is now about 96, 98, 98, 92, 84, 73, 75 and 73%, and the bot wins 28% of 1,000 runs (29% of the 200 that `npm test` plays), with 4.4% lost in ante 1 as before. `npm test` now also fails if any ante's survival is more than 14 points below the ante before it; the old curve failed that at ante 5. A browser run of the ante-8 boss with six charms found the charm row wrapping to two lines and pushing the hand off a 1280×860 screen; the row now has a column per slot.

### Duplicate shelf repair · 17-10-2026

Item slots are drawn without repeating a `(kind, id)` pair on the same shelf. Almanac selection still favours the most-played hand and keeps five-of-a-kind pages locked until played; the choice between almanac and treat stays 50/50. The same consumable can appear again in a later shop, and owned inventory may still contain multiple copies. Rerolls continue to change only charms.

Version-2 saves remain valid. When an older saved shop contains two identical offers, loading keeps the first and deterministically replaces only the later duplicate. Nuts, inventory, levels, owned charms and vouchers, sold slots and an open pack's choices are preserved. The repaired shop then saves and reloads unchanged.
