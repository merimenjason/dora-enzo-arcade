# Acorn Hand · game feel design

Written 15-10-2026. Builds on [`docs/acorn-hand.md`](../../acorn-hand.md) and the painted art pass. Jason found a round flat after the painted art landed: nothing moves, and the top of the table is empty, so it feels like playing against no one. He asked for the whole game-feel pass in one pull request, a rival who reacts across the table, cards that move, scoring that lands, and a shop that moves, with rival reactions built as motion now and painted reaction poses added later.

## Goals and limits

- A round should feel like a duel against someone, and every action should answer with motion and sound.
- Rules, balance, saves and the bots don't change. The engine (`lib/acorn-hand-game.ts`, `lib/acorn-hand-cards.ts`) is not touched, and no draw is taken from the run's random generator.
- Motion never holds up the game. State and the DOM update at once, as now; motion only animates elements from where they were to where they now are. The existing lock while a hand is scored is the only time input waits.
- `prefers-reduced-motion: reduce` turns all of it off, the table shake included, and the game stays fully playable.
- No new dependency. Motion uses the Web Animations API (`element.animate`) and CSS.

## Files

| File | New or changed | What it holds |
| --- | --- | --- |
| `lib/acorn-hand-banter.ts` | new | Rival lines per moment, `tableRival()` and `REACTIONS`; no DOM. |
| `app/acorn-hand/motion.ts` | new | The motion helpers: `remember`, `settle`, `fly`, `flip`, `shake`, `countUp`, `burst`; all no-ops under reduced motion. |
| `app/acorn-hand/page.tsx` | changed | The rival seat, nut pile, deck stack, side chinchillas, and the calls into `motion.ts`. |
| `app/acorn-hand/acorn-hand.css` | changed | Layout for the rival strip and deck stack, keyframes for idle and reactions, the banner and bubbles. |
| `app/acorn-hand/sound.ts` | changed | Cues `flip`, `whoosh`, `tear` and `chirp`. |
| `lib/acorn-hand-scene.ts` | changed | `drawRival` takes an optional pose and uses a painted pose sheet when one exists. |
| `tests/acorn-hand.mjs` | changed | Banter data checks. |
| `tests/e2e/acorn-hand.mjs` | changed | Rival, motion and reduced-motion checks; layout checks cover the new pieces. |
| `docs/acorn-hand-suit-prompts.md` | changed | Adds the reaction-pose prompts. |

`lib/acorn-hand-banter.ts` joins the `tsc` list in the `test` script and in `test:acorn-hand`, so `tests/acorn-hand.mjs` can import it from `.checks/`.

## 1 · The rival at the table

**Who sits there.** `tableRival(seed, ante, blind, boss)` returns a `Rival`:

- in the boss round, the ante's boss (`boss.rival`);
- in the small and big rounds, one of the other 12 rivals, chosen by a small integer hash of `seed`, `ante` and `blind`, never the ante's boss, and not the same rival for both rounds of an ante.

It is pure and uses no run randomness, so a reload shows the same rival and seeds replay exactly as before.

**Where.** A rival strip across the top of the table, above the played-card slots: the rival's painted portrait (`RivalArt`, about 140 × 105 at desktop width) on the left, its speech bubble beside it, and the nut pile on the right. In the boss round a small hanging sign under the portrait shows the boss name and rule; the boss panel in the sidebar (`ah-boss-mini`) goes, and its tooltip moves to the sign. Test id `rival`, with `data-rival` set to the rival's id; the sign keeps `boss-rule`.

**The nut pile.** A stack of 🌰, drawn at three sizes, standing for what is left of the target: `ceil(10 × (1 − score ÷ target))` nuts, 0 once the target is passed. Nuts pop off the top as the round score grows. Test id `nut-pile`, with `data-left` the count.

**Reactions.** `REACTIONS` names the moments. Each has a CSS animation on the portrait and, for some, a line in a bubble that stays about 2.2 s:

| Moment | When | Motion | Bubble |
| --- | --- | --- | --- |
| `enter` | the round starts | slides in from the top, small hop | greeting (boss: boast) |
| `idle` | always, between reactions | slow 3 s breathing bob, a squash every 4–7 s | — |
| `discard` | a discard | leans in, smug tilt | taunt |
| `hit` | a hand total under a quarter of the target | small flinch | — |
| `big` | a hand total of a quarter of the target or more | big recoil and wobble | yelp |
| `rule` | a scoring step with `who: 'boss'` | lean forward, show-off bounce | the rule in its own words |
| `beaten` | the round's score passes the target | slumps, tilts, fades to greyscale | concedes |
| `gloat` | the run ends in that round | bounces | gloat |

`BANTER: Record<Rival, Record<'enter' | 'discard' | 'big' | 'rule' | 'beaten' | 'gloat', string[]>>` holds two or three short lines per rival per bubble moment, in each animal's voice (the Fox sly, the Owl prim, the Bear grumbly and so on), each line under 48 characters. Lines are picked in turn per moment, not at random, so there is no random draw and a browser test can predict them. The bubble has test id `rival-say`. Each bubble plays `chirp` at a pitch set per rival.

**Your side.** Small Dora and Enzo sit at the left end of your hand, drawn with `drawChinchilla` as on the title screen. They lean toward the cards as you pick, hop when a hand scores and droop when a round is lost (CSS on their canvases). Test id `pals`. On phones they are hidden to keep the hand's room.

**Phones.** Under 600 px wide the strip shrinks to a 56 px-high row: a small portrait, the bubble as one line and the nut pile as a number with one nut. The six existing layout checks keep the hand, the buttons and the strip on screen with no horizontal scroll.

**Painted poses later.** `drawRival(c, rival, w, h, t = 0.4, pose = 'calm')` gains a `pose` of `'calm' | 'happy' | 'sad'`. For `happy` and `sad` it first tries the `rivals-happy` or `rivals-sad` painted sheets (laid out like `rivals-0`, `rivals-1` and `rival-armadillo`, crops added when they arrive) and falls back to the calm pose. `gloat` and `enter` use `happy`; `big`, `beaten` use `sad`. Until those sheets exist, the reactions are motion only. `docs/acorn-hand-suit-prompts.md` gains the prompt for both sheets.

## 2 · Cards that move

**The deck stack.** A small stack of card backs at the bottom right of the felt, drawn with `drawCard`'s back, with the draw-pile count on it (test id `deck-stack`). The sidebar's "Deck N" stays.

**`motion.ts`.** Every card element carries `data-card-id`.

- `remember(root)` records the bounding box of every `[data-card-id]` under `root`.
- `settle(root, from, { origin })`, called from a `useLayoutEffect` after the render that follows an action, animates each card from its remembered box to its new one (a translate and scale, 180–320 ms, ease-out with a small overshoot). A card with no remembered box flies in from `origin` (the deck stack). Cards are staggered by 50 ms in hand order.
- `fly(el, to, opts)` moves an element, or a clone of it for things leaving the DOM, to a target box or off-screen, then removes the clone.
- `flip(el)` turns a card about its vertical axis: the first half shows a card-back overlay, the second half the face.

**Dealing.** At a round's start and on every refill, the new cards fly from the deck stack and flip face-up halfway, with `flip` cues, 50 ms apart. Face-down cards (the Skunk's first hand, the Weasel's faces) fly in face-down and flip when they are revealed.

**Picking.** A picked card lifts 18 px (today 10) and tilts up to 3° with an overshoot; putting it back settles it with a small bounce. Sorting slides cards to their new places with `settle`.

**Playing.** The picked cards fly from the hand into the played slots in a shallow arc and land with a scale thump. Scoring then runs (section 3). When it ends, the played cards sweep off the right edge with `whoosh`, and the refill deals from the deck.

**Discarding.** The picked cards spin away off the bottom-right edge and fade, with `whoosh`; the refill deals from the deck.

## 3 · Scoring, cash-out and shop

**The last hand plays out.** Today a hand that wins or loses the round moves the engine to `'cashout'` or `'over'` at once, so the page swaps the table for the cash-out or game-over panel and the count-up of the most important hand is never seen. The page now shows the table while a hand is being counted (`stage = anim ? 'round' : r.phase`), and moves on when the count ends. The engine's phase still changes at once, so saving is unchanged.

**Scoring.** `playHand` keeps its timer per step. Each step now also:

- **`card`:** the card hops and glows in its suit ink, and its pop-up rises and fades.
- **`held`:** the held card in the hand pulses the same way.
- **`charm`:** that charm's slot (`charm-N`) wiggles ±6° twice and flashes its rarity colour, and the pop-up rises from the slot instead of the middle of the table.
- **`boss`:** the rival plays `rule`.
- **The counters:** chips and mult count up over 120 ms with `countUp`, not jump, and the box pulses on each change; a `×` step gives the mult box a bigger punch.

After the last step the hand name crosses the table as a banner (test id `banner`), the total pops, then flies into the round score, which counts up. A total of a quarter of the target or more shakes the table by up to 8 px for 300 ms, scaled by `total ÷ target`. When the score passes the target, the progress bar flares gold and the rival plays `beaten`; when the round is lost, `gloat`.

**Cash-out.** Each reward line launches one nut that flies to the 🌰 purse in the header, with a coin cue each, and the purse counts up.

**Shop.**

- **Opening a pack:** the pack bursts where it stood (`burst`: a dozen paper bits in the pack's tint, with `tear`), and the pack screen's options fan out one by one from where the pack was.
- **Taking an option:** a charm flies to its slot, an item to the item row, a card drops away toward the deck.
- **Buying:** a bought charm or item flies from its shelf card to its slot; a bought voucher stamps down (scale 1.3 to 1 with a thud) and joins the owned list.
- **Reroll:** the shelf cards flip to their new stock.
- **Selling:** the charm shrinks into a nut that flies to the purse.

## Sound

`sound.ts` gains four cues on the existing `makeSound` synthesizer: `flip` (a short paper tick), `whoosh` (a filtered noise sweep), `tear` (a noise burst with a falling filter) and `chirp(pitch)` for bubbles. The mute button covers them.

## Reduced motion and failure

Every helper in `motion.ts` checks the page's `motion` flag and returns at once when it is off. The CSS keeps its existing `animation: none !important; transition: none !important` rule under `prefers-reduced-motion`, and the shake and banner obey it. Bubbles still appear, without motion. If `element.animate` is missing, the helpers do nothing. A clone that is mid-flight when the view changes is removed in the effect's cleanup.

## Testing

- **Unchanged:** `npm test`, the bots and the existing 18 browser checks plus `acorn-hand-painted.mjs` pass without edits beyond the boss panel's move. This shows motion never blocks input or changes state.
- **Engine suite (`tests/acorn-hand.mjs`):** every rival has 2–3 lines for each bubble moment, each under 48 characters; `tableRival` is never the ante's boss in small and big rounds, differs between an ante's small and big rounds, is the boss in the boss round, and is the same for the same inputs.
- **Browser suite (`tests/e2e/acorn-hand.mjs`):**
  - the rival strip shows in each of the three rounds, with a bubble on `enter`, and the same `data-rival` after a reload; the boss round's sign shows the rule;
  - the nut pile's `data-left` drops after a scoring hand;
  - starting a round, playing and discarding each leave running animations on cards (`getAnimations().length > 0`);
  - a hand that triggers a charm wiggles that charm's slot;
  - with `reducedMotion: 'reduce'`, nothing animates and a round can still be played and won;
  - the layout checks at the six existing sizes include the rival strip and the deck stack, with no overlap with the hand or the buttons.
- Before merging, play a few rounds by hand at desktop and phone sizes, and with the painted files blocked.

## Docs

An **Added** entry for **Acorn Hand** in `CHANGELOG.md` under `## 15-10-2026`; the round and shop descriptions in `docs/acorn-hand.md`; the Acorn Hand guide in `README.md` (a rival at the table, motion off with reduced motion); the Acorn Hand section in `HANDOFF.md`.

## Not in this change

Painted reaction poses themselves (only the prompt and the hook for them); new art for the nut pile, the deck stack or the side chinchillas beyond the existing drawings; any change to rules, numbers, rivals' rules or the bots.
