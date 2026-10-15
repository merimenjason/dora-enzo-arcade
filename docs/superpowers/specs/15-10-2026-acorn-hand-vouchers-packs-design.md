# Acorn Hand · vouchers and booster packs design

Written 15-10-2026. Builds on [`docs/acorn-hand.md`](../../acorn-hand.md). Jason asked for a late-game nut sink in Acorn Hand and chose vouchers and booster packs together, with all four pack kinds. A harder stake was left for a separate pull request, once this economy has settled.

## Why

Measured with the bot over 200 seeded runs (`tests/e2e/.tmp/nuts.mjs`, scratch): every run has all five charm slots full from ante 3, and it leaves each shop holding about 12 nuts from then on only because it spends anything over 10 on rerolls. Income late in a run is about 12 to 15 nuts a round, roughly 40 an ante, and there is nothing to spend it on but rerolls and 3-nut items. Play by hand found the same.

## Vouchers

Permanent upgrades for the rest of the run.

- One voucher is on offer each ante. It stays on the shelf in every shop of that ante until it is bought; a new one is rolled when the boss is beaten (and one at the start of the run).
- Each costs 10 nuts (`VOUCHER_COST`). A voucher is never offered twice in a run; once all ten are owned, none is offered.

| Voucher | Id | Effect |
| --- | --- | --- |
| Wider Shelf | `shelf` | +1 charm slot (6). |
| Deep Pockets | `pockets` | +1 item slot (3). |
| Haggler | `haggler` | Rerolls start at 3 nuts, not 5. |
| Squirrel Hoard | `hoard` | Interest cap rises from 5 to 10, so up to 50 nuts held count. |
| Extra Paw | `play` | +1 play each round. |
| Spare Paw | `discard` | +1 discard each round. |
| Big Paws | `hand` | +1 hand size. |
| Bigger Stall | `stall` | The shop shows 3 charms, not 2. |
| Market Day | `market` | Every pack shows one more option. |
| Lucky Burrow | `lucky` | Uncommon and rare charms are twice as likely in the shop and in charm packs. |

Boss rules that set plays, discards or hand size outright (`plays`, `nodiscard`, `small`) keep working as now: `plays` still fixes 3 plays and `nodiscard` 0 discards; `small` still takes one card off the hand size, vouchers included.

## Booster packs

- Every shop visit offers 2 packs, rolled with the rest of the stock. A reroll leaves them alone. Each pack can be opened once.
- Opening a pack costs its price and shows its options. The player takes what the pack allows, or skips the rest; nuts are not refunded.

| Pack | Normal | Big |
| --- | --- | --- |
| Charm | pick 1 of 2 · 5 nuts | pick 1 of 4 · 7 nuts |
| Almanac | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |
| Treat | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |
| Card | pick 1 of 3 · 4 nuts | pick 2 of 5 · 7 nuts |

Market Day adds one option to each, never a pick. Normal packs are three times as likely as big ones; the four kinds are equally likely. These numbers are starting points for tuning.

- **Charm pack.** Options are distinct charms not owned, rolled like shop charms (rarity odds and the run's leanings). Taking one needs a free charm slot. Charms can be sold on the pack screen, so a full shelf can still swap.
- **Almanac pack.** Options are distinct hand types, rolled like shop almanac pages (five of a kind and flush five only once played, the most-played hand favoured). A page taken is used at once and levels its hand type up.
- **Treat pack.** Options are distinct treats. Eight cards are dealt from the deck, shuffled, for the pack (fewer if the deck is smaller). A treat taken is used at once on cards selected from those eight, with the same limits as in a round. Clover tea and the Wishing stone need no cards; a Wishing stone cannot be taken with no charm slot free. Mirror pond adds its copy to the deck and to the dealt cards; Compost removes cards from the deck and from the dealt cards.
- **Card pack.** Options are playing cards with a random rank and suit; each has a 30% chance of a random gloss (honey, ember, crystal or gold). A card taken joins the deck with a new id.

## Engine (`lib/acorn-hand-cards.ts`, `lib/acorn-hand-game.ts`)

New data in `acorn-hand-cards.ts`: `VOUCHERS` (id, name, text), `PACKS` (id, kind, big, shown, picks, cost; ids such as `charm`, `charm-big`), `VOUCHER_COST`, `CARD_PACK_GLOSS = 0.3`, `PACK_DEAL = 8`.

New state on `Run`:

- `vouchers: string[]`, owned, in the order bought.
- `offer: string | null`, this ante's voucher, or null once bought or when none are left.
- `shop.packs: (string | null)[]`, the shop's two pack ids; null once opened.
- `pack: Pack | null`, the open pack: `{ id, options, picks, dealt }`, where `options` are charm ids, hand ids, treat ids or cards (nulls once taken), `picks` the picks left and `dealt` the card ids dealt for a treat pack (empty otherwise).

A new phase, `'pack'`:

- `openPack(slot)` works only in `'shop'`, with enough nuts; a charm pack opens even with every charm slot full, since a charm can be sold inside it. It takes the nuts, rolls the options and (for a treat pack) deals the cards, in that order, and enters `'pack'`.
- `packWhyNot(i, ids)` says why option `i` cannot be taken with these dealt cards selected, or returns null.
- `takePack(i, ids = [])` applies option `i`; when no picks are left, the pack closes and the phase returns to `'shop'`.
- `skipPack()` closes the pack and returns to `'shop'`.
- `sell` is allowed in `'pack'` too.
- `buyVoucher()` works only in `'shop'`, with enough nuts and an offer; it adds the voucher and clears the offer.

Vouchers feed getters that already exist (`handSize`, `maxPlays`, `maxDiscards`, `rerollCost`) and new ones: `charmSlots`, `itemSlots`, `interestCap`, `shopCharms`, `packBonus`. These replace `CHARM_SLOTS`, `ITEM_SLOTS`, `INTEREST_CAP` and `SHOP_CHARMS` wherever a run is at hand, including the Wishing stone's slot check, `win()`'s interest and `stock()`/`reroll()`. The constants stay exported as the base values. Lucky Burrow doubles the rarity weights of uncommons and rares in `rollCharm`.

The treat code in `useItem` moves into a private `applyTreat(id, cards)` shared by `useItem` and treat packs. Mirror pond adds its copy to the round's hand during a round, or to `pack.dealt` in a pack; Compost refills the hand only during a round.

Every random draw comes from `this.rand`, in a fixed order, so a seed still replays a run exactly. The voucher offer is rolled in `collect()` when the ante changes and in the constructor; packs are rolled in `stock()` after the charms and items.

## Saving

- The run's `SAVE_VERSION` becomes 2, and the page's run key becomes `acorn-hand-run-v2`, so a version-1 run is ignored, not misread.
- The record gets its own `PROFILE_VERSION = 1` and keeps the key `acorn-hand-v1`, so records survive.
- `Run.load` checks the new fields: vouchers known and not repeated; the offer known and not owned; charms within `charmSlots` and items within `itemSlots`; shop packs known; the `'pack'` phase with a valid open pack whose dealt cards are in the deck, whose options match its kind, and whose picks are within its size.
- The page already writes the run after every action, so a run quit inside a pack comes back on the pack screen.

## Page (`app/acorn-hand/page.tsx`) and scene (`lib/acorn-hand-scene.ts`)

- **Shop.** Under the charm and item offers, a voucher card (name, effect, **Buy · 10**, or "Bought") and two pack cards (kind, "pick 1 of 3", **Open · N**; disabled when short of nuts). Inside a charm pack with every slot full, **Take** says to sell a charm first. A line under the shop heading names the vouchers owned, with hover notes. The charm and item slot rows and every buy check read the run's getters.
- **Pack screen**, for `phase === 'pack'`. The options as offer cards with **Take**, the picks left and **Skip**; the charm row with its sell buttons stays visible. Card options are drawn with `drawCard`. A treat pack shows the eight dealt cards as a selectable hand below the options; select cards, then **Use** on a treat, with `packWhyNot` as the message when it can't be used. Keys: 1 to 5 take an option, S skips; taps work as in the shop.
- **Art.** `drawVoucher` (a ticket stub with a paw stamp, tinted per voucher) and `drawPack` (a wrapped acorn-paper packet, tinted per kind, with a pip) in Canvas 2D. Shop items stay emoji.
- The cash-out's interest line reads the run's interest cap.
- `window.__acorn()` also returns the pack, the offer and the vouchers.

## Bot (`tests/acorn-hand-bot.mjs`)

- Buys the ante's voucher when it can keep about 5 nuts after; Wider Shelf, Extra Paw and Big Paws first.
- Opens a charm pack with spare nuts or a weak charm to swap; judges options with `value()`, selling the weakest charm when an option beats it by 8% as in the shop.
- Opens an almanac pack when it has a most-played hand; takes that hand's page, otherwise the first.
- Opens a treat pack only for its gloss treats, used on its highest-ranked dealt cards.
- Opens card packs only with 20 or more nuts spare.
- New assertions: every voucher bought in some run, every pack kind opened. The 20–45% win band and under 5% lost in ante 1 stay; prices, pack sizes or ante targets are tuned until it is back in the band.

## Tests

- **Engine (`tests/acorn-hand.mjs`):** each voucher's effect; the offer rolling once per ante and never repeating; opening, taking, skipping and selling inside a pack for each kind; treat-pack Mirror and Compost changing the deck; a card pack growing the deck; a seed replaying exactly with packs and vouchers; save and load in the middle of a pack; broken pack and voucher saves rejected; a version-1 record still loading.
- **Browser (`tests/e2e/acorn-hand.mjs`):** a check that buys a voucher and opens and takes from each kind of pack, a treat pack used by clicking dealt cards; a reload inside a pack returns to the pack screen; the layout checks include the pack screen at the phone sizes.

## Docs

`docs/acorn-hand.md` (vouchers and packs tables, the shop's new numbers), the Acorn Hand guide in `README.md`, a **Added** entry in `CHANGELOG.md` under `## 15-10-2026`, and the Acorn Hand section and next steps in `HANDOFF.md`.

## Not in this change

A harder stake; drawn icons for shop items; any change to charms, treats or rivals themselves.
