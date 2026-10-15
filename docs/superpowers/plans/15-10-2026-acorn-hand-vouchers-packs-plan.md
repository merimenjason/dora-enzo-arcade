# Acorn Hand · vouchers and booster packs implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Acorn Hand a late-game nut sink: one permanent voucher on offer each ante, and two booster packs (charm, almanac, treat or card) in every shop.

**Architecture:** Everything lives in the existing engine / scene / page split. The rules go in `lib/acorn-hand-cards.ts` (tables) and `lib/acorn-hand-game.ts` (`Run`): vouchers feed the getters `Run` already has, and an open pack is a new `'pack'` phase that is saved like any other. `lib/acorn-hand-scene.ts` draws a voucher ticket and a pack in Canvas 2D; `app/acorn-hand/page.tsx` adds the shop rows and the pack screen. The bot learns to buy both, and is retuned so it still wins 20–45% of runs.

**Tech Stack:** TypeScript, Next.js (vinext) client page, Canvas 2D, Node `assert` engine tests compiled with `tsc` into `.checks/`, Playwright browser tests.

**Spec:** [`docs/superpowers/specs/15-10-2026-acorn-hand-vouchers-packs-design.md`](../specs/15-10-2026-acorn-hand-vouchers-packs-design.md)

## Global Constraints

- Work on branch `feat/acorn-hand-vouchers-packs`; never commit to or push `main` (pushing `main` deploys).
- Never commit `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`; stage files by name, never `git add -A`.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't run `oxfmt`; match the hand-formatted, dense one-line style of the file you are in.
- Dates in Markdown are dd-mm-yyyy. Today is 15-10-2026.
- Every user-visible change gets a `CHANGELOG.md` entry under `## 15-10-2026` in the same commit (Task 4 adds it).
- Playwright is not a dependency: `npm i -D playwright` before browser tests, and never commit `package.json`/`package-lock.json` changes from that.
- Engine randomness only through `this.rand`, so a seed replays a run exactly.
- Run save: `SAVE_VERSION = 2`, key `acorn-hand-run-v2`. Record: `PROFILE_VERSION = 1`, key `acorn-hand-v1` (records must survive).
- Numbers from the spec: `VOUCHER_COST = 10`; Haggler rerolls start at 3; Squirrel Hoard cap 10; 2 packs per shop; normal packs 3× as likely as big; card-pack gloss chance 30%; treat packs deal 8 cards. Pack table: charm 1 of 2 · 5 / big 1 of 4 · 7; almanac, treat, card 1 of 3 · 4 / big 2 of 5 · 7.

## Review Focus

1. **A save from before this change** (a version-1 run under `acorn-hand-run-v1`): the title shows no Continue and nothing throws. Pinned in Task 4's browser check.
2. **Buying Bigger Stall mid-shop, then rerolling and reloading**: the reroll shows three charms and the save with three shop charms loads. Pinned in Task 1.
3. **Deep Pockets with the item slots otherwise full**: skipping a round still gives an item into the third slot, not 4 nuts. Pinned in Task 1.
4. **A Wishing stone in a treat pack with every charm slot full**: it can't be taken, the other treats can, and Skip still closes the pack. Pinned in Task 2.
5. **Pressing a digit in a treat pack with no cards selected**: a "Select…" note, no crash, the pack stays open. Pinned in Task 4.

---

### Task 1: Vouchers in the engine

**Files:**
- Modify: `lib/acorn-hand-cards.ts` (after `export const ITEM_COST = 3;`, line 176)
- Modify: `lib/acorn-hand-game.ts` (constants lines 9–11; `Run` fields 169–173; constructor 175–179; getters 196–199; `skip` 220–226; `win` 307–317; `collect` 319–327; `rollCharm` 342–347; `stock` 356–362; `rerollCost` 364; `buyCharm` 367–373; `buyItem` 374–379; `reroll` 395–402; `itemWhyNot` 412; `Save` type 159–163; `save` 441–448; `load` 450–492; profile 497–501)
- Test: `tests/acorn-hand.mjs`

**Interfaces:**
- Produces (`acorn-hand-cards.ts`): `type Voucher = { id: string; name: string; text: string }`, `VOUCHERS: Voucher[]` (ids `shelf pockets haggler hoard play discard hand stall market lucky`), `voucherById(id): Voucher | undefined`, `VOUCHER_COST = 10`.
- Produces (`acorn-hand-game.ts`): `SAVE_VERSION = 2`, `PROFILE_VERSION = 1`, `HOARD_CAP = 10`, `HAGGLER_REROLL = 3`; on `Run`: `vouchers: string[]`, `offer: string | null`, `owns(id): boolean`, getters `charmSlots`, `itemSlots`, `interestCap`, `shopCharms`, `packBonus` (all `number`), `buyVoucher(): boolean`, private `rollOffer(): void`; `Save` gains `vouchers`, `offer`.

- [ ] **Step 1: Write the failing tests**

In `tests/acorn-hand.mjs`, replace the import block (lines 2–5) with:

```js
import {
  Run, Rand, evaluate, scorePlay, HANDS, CHARMS, TREATS, BOSSES, BLIND, ANTES, ANTE_BASE, CHARM_SLOTS, ITEM_SLOTS, HAND_SIZE, PLAYS, DISCARDS, START_NUTS,
  INTEREST_CAP, REROLL, COST, SAVE_VERSION, PROFILE_VERSION, SHOP_CHARMS, HOARD_CAP, HAGGLER_REROLL, VOUCHERS, VOUCHER_COST,
  anteBase, cardChips, charmById, voucherById, freshProfile, loadProfile, record,
} from '../.checks/acorn-hand-game.js';
```

In the `// Antes, the win and endless` block, the run plays one card per round; a Badger boss (exactly five cards) would refuse that once the random sequence changes. Change

```js
    run.start(); run.round.target = 1; run.play([run.round.hand[0]]); assert.ok(run.collect());
```

to

```js
    run.start(); run.round.target = 1; run.play(run.round.hand.slice(0, 5)); assert.ok(run.collect());
```

and change the profile line

```js
  assert.deepEqual(loadProfile({ v: SAVE_VERSION, runs: 2, wins: 1, bestAnte: 3, bestHand: 9, seen: ['dora', 'nobody'] }).seen, ['dora']);
```

to

```js
  assert.deepEqual(loadProfile({ v: PROFILE_VERSION, runs: 2, wins: 1, bestAnte: 3, bestHand: 9, seen: ['dora', 'nobody'] }).seen, ['dora']);
  assert.equal(PROFILE_VERSION, 1, 'records from before vouchers still load'); assert.equal(SAVE_VERSION, 2, 'runs from before vouchers do not');
```

Then insert this new section directly before `// Seeds replay, saves round-trip, broken saves are refused`:

```js
// Vouchers
const inShop = (seed) => { const run = new Run(seed); run.start(); run.round.target = 1; run.play(run.round.hand.slice(0, 5)); run.collect(); run.nuts = 200; return run; };
{
  assert.equal(VOUCHERS.length, 10); assert.equal(new Set(VOUCHERS.map((v) => v.id)).size, 10); assert.equal(VOUCHER_COST, 10);
  const run = inShop(31);
  assert.deepEqual({ slots: run.charmSlots, items: run.itemSlots, cap: run.interestCap, shop: run.shopCharms, hand: run.handSize, plays: run.maxPlays, discards: run.maxDiscards, reroll: run.rerollCost, bonus: run.packBonus },
    { slots: CHARM_SLOTS, items: ITEM_SLOTS, cap: INTEREST_CAP, shop: SHOP_CHARMS, hand: HAND_SIZE, plays: PLAYS, discards: DISCARDS, reroll: REROLL, bonus: 0 });
  run.vouchers = VOUCHERS.map((v) => v.id); run.offer = null;
  assert.equal(run.charmSlots, CHARM_SLOTS + 1); assert.equal(run.itemSlots, ITEM_SLOTS + 1); assert.equal(run.interestCap, HOARD_CAP);
  assert.equal(run.shopCharms, SHOP_CHARMS + 1); assert.equal(run.handSize, HAND_SIZE + 1); assert.equal(run.maxPlays, PLAYS + 1); assert.equal(run.maxDiscards, DISCARDS + 1);
  assert.equal(run.rerollCost, HAGGLER_REROLL); assert.equal(run.packBonus, 1);
  assert.ok(run.reroll()); assert.equal(run.shop.charms.length, SHOP_CHARMS + 1, 'Bigger Stall shows a third charm once rerolled');
  const back = Run.load(JSON.parse(JSON.stringify(run.save()))); assert.ok(back, 'and a save with three shop charms loads'); assert.deepEqual(back.save(), run.save());
  for (let i = 0; i < CHARM_SLOTS + 1; i++) run.charms.push({ id: CHARMS[i].id, state: 0 });
  run.shop.charms[0] = CHARMS[20].id; assert.equal(run.buyCharm(0), false, 'six charms fill the wider shelf');
  run.items = [{ kind: 'treat', id: 'tea' }, { kind: 'treat', id: 'tea' }]; run.shop.items[0] = { kind: 'treat', id: 'wish' }; assert.ok(run.buyItem(0), 'a third item fits in deep pockets');
}
{
  // Boss rules that set a number outright still win.
  const run = new Run(32); run.vouchers = ['play', 'discard', 'hand']; run.blind = 2;
  run.bosses[0] = 'plays'; assert.equal(run.maxPlays, 3);
  run.bosses[0] = 'nodiscard'; assert.equal(run.maxDiscards, 0);
  run.bosses[0] = 'small'; assert.equal(run.handSize, HAND_SIZE, 'one fewer than Big Paws gives');
}
{
  const run = new Run(33); run.vouchers = ['hoard']; run.nuts = 60; run.start(); run.round.target = 1; run.play(run.round.hand.slice(0, 5));
  assert.equal(run.cash.interest, HOARD_CAP, 'Squirrel Hoard pays interest up to 10');
  const skip = new Run(34); skip.vouchers = ['pockets']; skip.items = [{ kind: 'treat', id: 'tea' }, { kind: 'treat', id: 'tea' }];
  assert.notEqual(skip.skip(), 'nuts', 'a skip still gives an item into the third slot'); assert.equal(skip.items.length, 3);
}
{
  const share = (lucky) => { const run = new Run(35); if (lucky) run.vouchers = ['lucky']; let n = 0; for (let i = 0; i < 400; i++) if (charmById(run.rollCharm([])).rarity > 1) n++; return n / 400; };
  assert.ok(share(true) > share(false) * 1.25, `Lucky Burrow makes uncommon and rare charms likelier (${share(false)} → ${share(true)})`);
}
{
  // One voucher an ante, never one already owned.
  const run = new Run(36); assert.ok(voucherById(run.offer), 'a voucher is on offer from the start');
  const first = run.offer;
  run.start(); run.round.target = 1; run.play(run.round.hand.slice(0, 5)); run.collect();
  assert.equal(run.offer, first, 'the same voucher all ante');
  run.nuts = 9; assert.equal(run.buyVoucher(), false, 'it costs ten nuts');
  run.nuts = 10; assert.ok(run.buyVoucher()); assert.equal(run.nuts, 0); assert.deepEqual(run.vouchers, [first]); assert.equal(run.offer, null);
  run.nuts = 50; assert.equal(run.buyVoucher(), false, 'one an ante');
  run.leave(); assert.equal(run.buyVoucher(), false, 'only in the shop');
  run.vouchers = VOUCHERS.slice(0, 9).map((v) => v.id); run.rollOffer(); assert.equal(run.offer, VOUCHERS[9].id, 'never one already owned');
  run.vouchers.push(run.offer); run.rollOffer(); assert.equal(run.offer, null, 'none once all ten are owned');
  const boss = new Run(37); boss.offer = null; boss.bosses = ['small']; boss.blind = 2; boss.start(); boss.round.target = 1; boss.play(boss.round.hand.slice(0, 5)); boss.collect();
  assert.equal(boss.ante, 2); assert.ok(voucherById(boss.offer), 'beating the boss puts a new voucher on the shelf');
}
```

In the `// Seeds replay…` block, after `assert.equal(bad((s) => { s.levels.pair = 0; }), null);` add:

```js
  assert.equal(bad((s) => { s.vouchers = ['shelf', 'shelf']; }), null);
  assert.equal(bad((s) => { s.vouchers = ['wings']; }), null);
  assert.equal(bad((s) => { s.vouchers = ['pockets']; s.offer = 'pockets'; }), null, 'the offer is never one already owned');
  assert.equal(bad((s) => { s.v = 1; }), null, 'a version-1 run is not misread');
  const six = JSON.parse(JSON.stringify(run.save())); six.charms = CHARMS.slice(0, 6).map((c) => ({ id: c.id, state: 0 }));
  assert.equal(Run.load(six), null, 'six charms need Wider Shelf');
  six.vouchers = ['shelf']; if (six.offer === 'shelf') six.offer = null; assert.ok(Run.load(six), 'and load with it');
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run test:acorn-hand`
Expected: FAIL. `tsc` succeeds, then the first new assertion fails, e.g. `AssertionError` on `PROFILE_VERSION` being `undefined`.

- [ ] **Step 3: Add the voucher table**

In `lib/acorn-hand-cards.ts`, after `export const ITEM_COST = 3;` add:

```ts

// ── Vouchers ──────────────────────────────────────────────────────────────────

/** A permanent upgrade for the rest of the run. One is on offer each ante. */
export type Voucher = { id: string; name: string; text: string };
export const VOUCHERS: Voucher[] = [
  { id: 'shelf', name: 'Wider Shelf', text: '+1 charm slot.' },
  { id: 'pockets', name: 'Deep Pockets', text: '+1 item slot.' },
  { id: 'haggler', name: 'Haggler', text: 'Rerolls start at 3 nuts, not 5.' },
  { id: 'hoard', name: 'Squirrel Hoard', text: 'Interest goes up to 10, not 5: up to 50 nuts held count.' },
  { id: 'play', name: 'Extra Paw', text: '+1 play each round.' },
  { id: 'discard', name: 'Spare Paw', text: '+1 discard each round.' },
  { id: 'hand', name: 'Big Paws', text: '+1 hand size.' },
  { id: 'stall', name: 'Bigger Stall', text: 'The shop shows 3 charms, not 2.' },
  { id: 'market', name: 'Market Day', text: 'Every pack shows one more option.' },
  { id: 'lucky', name: 'Lucky Burrow', text: 'Uncommon and rare charms are twice as likely.' },
];
export const voucherById = (id: string) => VOUCHERS.find((v) => v.id === id);
export const VOUCHER_COST = 10;
```

- [ ] **Step 4: Wire vouchers into `Run`**

In `lib/acorn-hand-game.ts`:

1. Import line 6: add `VOUCHERS, VOUCHER_COST, voucherById,` after `ITEM_COST,`.
2. Replace `export const SAVE_VERSION = 1;` with:

```ts
/** The run save's shape; version 2 added vouchers and packs. The record has its own version, so it survives. */
export const SAVE_VERSION = 2, PROFILE_VERSION = 1;
```

3. After the `INTEREST_EVERY…` line add:

```ts
/** What Squirrel Hoard raises the interest cap to, and what Haggler starts a reroll at. */
export const HOARD_CAP = 10, HAGGLER_REROLL = 3;
```

4. `Save` type: add `vouchers: string[]; offer: string | null;` before `best: number;`.
5. `Run` fields, after `bosses: BossRule[] = []; …` line add:

```ts
  /** Vouchers owned, in the order bought, and this ante's offer (null once bought, or when all are owned). */
  vouchers: string[] = []; offer: string | null = null;
```

6. Constructor: after `this.bossFor(1);` add ` this.rollOffer();` (same line is fine: `this.bossFor(1); this.rollOffer();`).
7. Replace the three getters `handSize`, `maxPlays`, `maxDiscards` and add the new ones:

```ts
  owns(v: string) { return this.vouchers.includes(v); }
  get handSize() { return HAND_SIZE + this.has('handSize') + (this.owns('hand') ? 1 : 0) - this.has('tight') - (this.boss?.rule === 'small' ? 1 : 0); }
  get maxPlays() { return this.boss?.rule === 'plays' ? 3 : PLAYS + this.has('play') + (this.owns('play') ? 1 : 0); }
  get maxDiscards() { return this.boss?.rule === 'nodiscard' ? 0 : DISCARDS + this.has('discard') + (this.owns('discard') ? 1 : 0); }
  get charmSlots() { return CHARM_SLOTS + (this.owns('shelf') ? 1 : 0); }
  get itemSlots() { return ITEM_SLOTS + (this.owns('pockets') ? 1 : 0); }
  get interestCap() { return this.owns('hoard') ? HOARD_CAP : INTEREST_CAP; }
  get shopCharms() { return SHOP_CHARMS + (this.owns('stall') ? 1 : 0); }
  get packBonus() { return this.owns('market') ? 1 : 0; }
```

8. `skip()`: `this.items.length < ITEM_SLOTS` → `this.items.length < this.itemSlots`.
9. `win()`: `Math.min(INTEREST_CAP, …)` → `Math.min(this.interestCap, …)`.
10. `collect()`: change `if (this.blind === 2) { this.ante++; this.blind = 0; this.bossFor(this.ante); } else this.blind++;` to `if (this.blind === 2) { this.ante++; this.blind = 0; this.bossFor(this.ante); this.rollOffer(); } else this.blind++;`
11. `rollCharm`: replace its `return` line with:

```ts
    const lean = this.leanings(), lucky = this.owns('lucky');
    return this.rand.weighted(free, (c) => RARITY_ODDS[c.rarity] * (lucky && c.rarity > 1 ? 2 : 1) / CHARMS.filter((x) => x.rarity === c.rarity).length * (c.tags.some((t) => t !== 'any' && lean.has(t)) ? FIT_WEIGHT : 1)).id;
```

(and delete the old `const lean = this.leanings();` line above it).
12. `stock()` and `reroll()`: `i < SHOP_CHARMS` → `i < this.shopCharms` (both places).
13. `rerollCost`: `get rerollCost() { return (this.owns('haggler') ? HAGGLER_REROLL : REROLL) + (this.shop?.rerolls ?? 0); }`
14. `buyCharm`: `this.charms.length >= CHARM_SLOTS` → `this.charms.length >= this.charmSlots`. `buyItem`: `ITEM_SLOTS` → `this.itemSlots`. `itemWhyNot`: `CHARM_SLOTS` → `this.charmSlots`.
15. After `leave()` add:

```ts
  /** Buy this ante's voucher. */
  buyVoucher() {
    const id = this.offer;
    if (this.phase !== 'shop' || !id || this.nuts < VOUCHER_COST) return false;
    this.nuts -= VOUCHER_COST; this.vouchers.push(id); this.offer = null;
    return true;
  }
  /** Put a voucher not yet owned on the shelf for the coming ante, or none once all are owned. */
  private rollOffer() {
    const free = VOUCHERS.filter((v) => !this.vouchers.includes(v.id));
    this.offer = free.length ? this.rand.pick(free).id : null;
  }
```

16. `save()`: add `vouchers: [...this.vouchers], offer: this.offer,` before `best: this.best`.
17. `load()`: directly after the `HANDS.some((h) => s.levels[h.id] < 1)` line add:

```ts
      if (!Array.isArray(s.vouchers) || !s.vouchers.every((v) => typeof v === 'string' && !!voucherById(v)) || new Set(s.vouchers).size !== s.vouchers.length) return null;
      if (s.offer !== null && (typeof s.offer !== 'string' || !voucherById(s.offer) || s.vouchers.includes(s.offer))) return null;
      const plus = (n: number, v: string) => n + (s.vouchers.includes(v) ? 1 : 0);
```

then in the charms check `s.charms.length > CHARM_SLOTS` → `s.charms.length > plus(CHARM_SLOTS, 'shelf')`, the items check `ITEM_SLOTS` → `plus(ITEM_SLOTS, 'pockets')`, the shop check `SHOP_CHARMS` → `plus(SHOP_CHARMS, 'stall')`, and in `Object.assign(g, { … })` add `vouchers: [...s.vouchers], offer: s.offer,` before `best: s.best`.
18. Profile: in `freshProfile` and `loadProfile`, `SAVE_VERSION` → `PROFILE_VERSION`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm run test:acorn-hand && npm run typecheck`
Expected: `PASS Acorn Hand: …` and no type errors (the page still imports `CHARM_SLOTS`, `ITEM_SLOTS` and `INTEREST_CAP`, which stay exported as base values until Task 4).

- [ ] **Step 6: Commit**

```bash
git add lib/acorn-hand-cards.ts lib/acorn-hand-game.ts tests/acorn-hand.mjs
git commit -m "Add vouchers to the Acorn Hand engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Booster packs in the engine

**Files:**
- Modify: `lib/acorn-hand-cards.ts` (after the voucher block from Task 1)
- Modify: `lib/acorn-hand-game.ts` (`Phase` 152; `Shop` 158; `Save`; `Run` fields; `rollItem` 348–355; `stock`; `reroll`; `sell` 380–387; `itemWhyNot`/`useItem` 407–438; `save`; `load`; `record`)
- Test: `tests/acorn-hand.mjs`

**Interfaces:**
- Consumes: `Run.packBonus`, `Run.charmSlots`, `Run.owns` (Task 1).
- Produces (`acorn-hand-cards.ts`): `type PackKind = 'charm' | 'almanac' | 'treat' | 'card'`, `PACK_KINDS: PackKind[]`, `type PackType = { id: string; kind: PackKind; big: boolean; name: string; shown: number; picks: number; cost: number }`, `PACKS: PackType[]` (ids `charm charm-big almanac almanac-big treat treat-big card card-big`), `packById(id): PackType | undefined`, `SHOP_PACKS = 2`, `BIG_PACK_ODDS = 0.25`, `PACK_DEAL = 8`, `CARD_PACK_GLOSS = 0.3`.
- Produces (`acorn-hand-game.ts`): `type Pack = { id: string; options: (string | Card | null)[]; picks: number; dealt: number[] }`; `Phase` gains `'pack'`; `Shop.packs: (string | null)[]`; on `Run`: `pack: Pack | null`, `openPack(slot: number): boolean`, `packWhyNot(i: number, ids?: number[]): string | null`, `takePack(i: number, ids?: number[]): boolean`, `skipPack(): boolean`; card options carry `id: -1` until taken.

- [ ] **Step 1: Write the failing tests**

In `tests/acorn-hand.mjs` add `PACKS, SHOP_PACKS, PACK_DEAL, packById,` to the import list (after `VOUCHER_COST,`). Insert this section directly before `// Seeds replay, saves round-trip, broken saves are refused`:

```js
// Booster packs
{
  assert.equal(PACKS.length, 8); assert.equal(SHOP_PACKS, 2);
  const run = inShop(41);
  assert.equal(run.shop.packs.length, SHOP_PACKS); assert.ok(run.shop.packs.every((id) => packById(id)));
  const packs = [...run.shop.packs]; assert.ok(run.reroll()); assert.deepEqual(run.shop.packs, packs, 'a reroll leaves the packs alone');
  run.shop.packs[0] = 'charm-big'; const nuts = run.nuts;
  assert.ok(run.openPack(0)); assert.equal(run.phase, 'pack'); assert.equal(run.nuts, nuts - 7); assert.equal(run.shop.packs[0], null, 'a pack opens once');
  assert.equal(run.pack.options.length, 4); assert.equal(new Set(run.pack.options).size, 4); assert.equal(run.pack.picks, 1);
  assert.ok(run.pack.options.every((id) => !run.charms.some((c) => c.id === id)), 'no charm you own');
  assert.equal(run.openPack(1), false, 'one pack at a time'); assert.equal(run.leave(), false, 'the shop is not left from inside a pack');
  assert.equal(run.reroll(), false); assert.equal(run.buyVoucher(), false);
  const want = run.pack.options[2]; assert.ok(run.takePack(2));
  assert.equal(run.charms.at(-1).id, want); assert.equal(run.phase, 'shop', 'the last pick closes the pack'); assert.equal(run.pack, null);
  run.nuts = 3; run.shop.packs[1] = 'card'; assert.equal(run.openPack(1), false, 'a pack costs nuts');
}
{
  const run = inShop(42); for (let i = 0; i < CHARM_SLOTS; i++) run.charms.push({ id: CHARMS[i].id, state: 0 });
  run.shop.packs[0] = 'charm'; assert.ok(run.openPack(0), 'a charm pack opens with every slot full');
  assert.match(run.packWhyNot(0), /sell one/); assert.equal(run.takePack(0), false);
  assert.ok(run.sell(0), 'charms can be sold inside a pack'); assert.equal(run.packWhyNot(0), null); assert.ok(run.takePack(0));
  run.shop.packs[1] = 'card'; assert.ok(run.openPack(1)); assert.ok(run.skipPack()); assert.equal(run.phase, 'shop'); assert.equal(run.shop.packs[1], null, 'a skipped pack is gone');
  assert.equal(run.skipPack(), false);
}
{
  const run = inShop(43); run.vouchers = ['market']; run.shop.packs[0] = 'almanac-big'; assert.ok(run.openPack(0));
  assert.equal(run.pack.options.length, 6, 'Market Day adds an option'); assert.equal(run.pack.picks, 2, 'but not a pick');
  assert.equal(new Set(run.pack.options).size, 6); assert.ok(!run.pack.options.includes('five') && !run.pack.options.includes('ffive'), 'no five-of-a-kind pages before one is played');
  const [a, b] = run.pack.options; assert.ok(run.takePack(0)); assert.equal(run.levels[a], 2, 'a page is used as it is taken'); assert.equal(run.phase, 'pack');
  assert.equal(run.takePack(0), false, 'a taken option is gone'); assert.ok(run.takePack(1)); assert.equal(run.levels[b], 2); assert.equal(run.phase, 'shop');
}
{
  const run = inShop(44); run.shop.packs[0] = 'card-big'; assert.ok(run.openPack(0));
  assert.ok(run.pack.options.every((o) => o.id === -1 && o.rank >= 2 && o.rank <= 14 && o.suit >= 0 && o.suit <= 3));
  const deck = run.deck.length, next = run.nextId, c = run.pack.options[3];
  assert.ok(run.takePack(3)); assert.equal(run.deck.length, deck + 1, 'a card joins the deck');
  assert.deepEqual(run.deck.at(-1), { ...c, id: next }, 'as it was shown, with a new id'); assert.equal(run.nextId, next + 1);
  let glossed = 0, n = 0;
  for (let s = 0; s < 60; s++) { const r = inShop(100 + s); r.shop.packs[0] = 'card-big'; r.openPack(0); for (const o of r.pack.options) { n++; if (o.gloss) glossed++; } }
  assert.ok(glossed / n > 0.2 && glossed / n < 0.4, `about 30% of pack cards are glossed (${glossed}/${n})`);
}
{
  const run = inShop(45); run.shop.packs[0] = 'treat-big'; assert.ok(run.openPack(0));
  assert.equal(run.pack.dealt.length, PACK_DEAL); assert.ok(run.pack.dealt.every((id) => run.deck.some((c) => c.id === id))); assert.equal(new Set(run.pack.options).size, 5);
  run.pack.options = ['mirror', 'compost', 'honey', 'tea', 'wish']; run.pack.picks = 2;
  const [x, y, z] = run.pack.dealt;
  assert.match(run.packWhyNot(0, []), /Select a card/); assert.match(run.packWhyNot(0, [x, y]), /at most 1/); assert.match(run.packWhyNot(0, [-5]), /dealt/);
  const deck = run.deck.length; assert.ok(run.takePack(0, [x]));
  assert.equal(run.deck.length, deck + 1, 'Mirror pond copies a dealt card into the deck'); assert.equal(run.pack.dealt.length, PACK_DEAL + 1, 'and among the dealt cards');
  assert.ok(run.takePack(1, [y, z])); assert.equal(run.deck.length, deck - 1, 'Compost removes two for good');
  assert.ok(!run.deck.some((c) => c.id === y || c.id === z));
  assert.equal(run.phase, 'shop', 'two picks used'); assert.equal(run.round, null);
}
{
  // A Wishing stone with every charm slot full: it waits, the other treats don't, and Skip still closes the pack.
  const run = inShop(46); for (let i = 0; i < CHARM_SLOTS; i++) run.charms.push({ id: CHARMS[i].id, state: 0 });
  run.shop.packs[0] = 'treat'; assert.ok(run.openPack(0)); run.pack.options = ['wish', 'tea', 'honey'];
  assert.match(run.packWhyNot(0), /slots are full/); assert.equal(run.takePack(0), false); assert.equal(run.packWhyNot(1), null);
  assert.ok(run.skipPack()); assert.equal(run.phase, 'shop');
}
{
  // Treats in a round still work through the shared code, and the record meets charms seen in packs.
  const run = inShop(47); run.shop.packs[0] = 'charm'; run.openPack(0);
  const p = record(freshProfile(), run, false); assert.ok(run.pack.options.every((id) => p.seen.includes(id)), 'charms in an open pack count as met');
}
```

In the `// Seeds replay…` block, after the `six` lines from Task 1 add:

```js
  {
    const go = (seed) => { const r = inShop(seed); r.offer = 'pockets'; r.buyVoucher(); r.shop.packs[0] = 'treat'; r.openPack(0); return r; };
    assert.deepEqual(go(51).save(), go(51).save(), 'a seed replays exactly through vouchers and packs');
    const r = go(52), back = Run.load(JSON.parse(JSON.stringify(r.save())));
    assert.ok(back); assert.equal(back.phase, 'pack'); assert.deepEqual(back.save(), r.save(), 'a run saved inside a pack comes back exactly');
    const broke = (f) => { const s = JSON.parse(JSON.stringify(r.save())); f(s); return Run.load(s); };
    assert.equal(broke((s) => { s.pack = null; }), null, 'a pack phase needs a pack');
    assert.equal(broke((s) => { s.shop = null; }), null, 'and the shop it came from');
    assert.equal(broke((s) => { s.pack.id = 'sack'; }), null);
    assert.equal(broke((s) => { s.pack.options[0] = 'nothing'; }), null);
    assert.equal(broke((s) => { s.pack.dealt.push(9999); }), null);
    assert.equal(broke((s) => { s.pack.picks = 5; }), null);
    assert.equal(broke((s) => { s.shop.packs = ['sack']; }), null);
    assert.equal(broke((s) => { s.phase = 'shop'; }), null, 'a pack outside the pack phase');
  }
```

Also update the final `console.log` line to end `…, seeds and saves, vouchers and packs`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm run test:acorn-hand`
Expected: FAIL (`PACKS` is `undefined`, so `assert.equal(PACKS.length, 8)` throws a `TypeError`).

- [ ] **Step 3: Add the pack table**

In `lib/acorn-hand-cards.ts`, after `export const VOUCHER_COST = 10;` add:

```ts

// ── Booster packs ─────────────────────────────────────────────────────────────

export type PackKind = 'charm' | 'almanac' | 'treat' | 'card';
export const PACK_KINDS: PackKind[] = ['charm', 'almanac', 'treat', 'card'];
/** A pack in the shop: how many options it shows, how many you take, and its price. */
export type PackType = { id: string; kind: PackKind; big: boolean; name: string; shown: number; picks: number; cost: number };
export const PACKS: PackType[] = [
  { id: 'charm', kind: 'charm', big: false, name: 'Charm pack', shown: 2, picks: 1, cost: 5 },
  { id: 'charm-big', kind: 'charm', big: true, name: 'Big charm pack', shown: 4, picks: 1, cost: 7 },
  { id: 'almanac', kind: 'almanac', big: false, name: 'Almanac pack', shown: 3, picks: 1, cost: 4 },
  { id: 'almanac-big', kind: 'almanac', big: true, name: 'Big almanac pack', shown: 5, picks: 2, cost: 7 },
  { id: 'treat', kind: 'treat', big: false, name: 'Treat pack', shown: 3, picks: 1, cost: 4 },
  { id: 'treat-big', kind: 'treat', big: true, name: 'Big treat pack', shown: 5, picks: 2, cost: 7 },
  { id: 'card', kind: 'card', big: false, name: 'Card pack', shown: 3, picks: 1, cost: 4 },
  { id: 'card-big', kind: 'card', big: true, name: 'Big card pack', shown: 5, picks: 2, cost: 7 },
];
export const packById = (id: string) => PACKS.find((p) => p.id === id);
/** Packs in each shop; how often one is big; cards dealt for a treat pack; how often a pack card is glossed. */
export const SHOP_PACKS = 2, BIG_PACK_ODDS = 0.25, PACK_DEAL = 8, CARD_PACK_GLOSS = 0.3;
```

- [ ] **Step 4: Add packs to `Run`**

In `lib/acorn-hand-game.ts`:

1. Import line 6: add `PACK_KINDS, SHOP_PACKS, BIG_PACK_ODDS, PACK_DEAL, CARD_PACK_GLOSS, packById,` after `voucherById,`.
2. Types:

```ts
export type Phase = 'pick' | 'round' | 'cashout' | 'shop' | 'pack' | 'over' | 'victory';
```

```ts
export type Shop = { charms: (string | null)[]; items: (Item | null)[]; packs: (string | null)[]; rerolls: number };
/** An open pack: what is in it (null once taken; cards have id -1 until taken), picks left, and the cards dealt for a treat pack. */
export type Pack = { id: string; options: (string | Card | null)[]; picks: number; dealt: number[] };
```

`Save` gains `pack: Pack | null;` after `shop: Shop | null;`. Below the `Save` type add:

```ts
const GLOSSES: Gloss[] = ['', 'honey', 'ember', 'crystal', 'gold'];
```

3. `Run` fields: change `round: Round | null = null; cash: Cash | null = null; shop: Shop | null = null;` to also declare `pack: Pack | null = null;`.
4. Replace `rollItem` with:

```ts
  /** An almanac page's hand: five of a kind and flush five only once played, the most-played hand four times as likely. */
  private rollHand(taken: string[] = []): HandId {
    const lean = this.fame;
    const pool = HANDS.filter((h) => (h.id !== 'five' && h.id !== 'ffive' || this.played[h.id] > 0) && !taken.includes(h.id));
    return this.rand.weighted(pool, (h) => (h.id === lean ? 4 : 1)).id;
  }
  private rollItem(): Item {
    if (this.rand.next() < 0.5) return { kind: 'almanac', id: this.rollHand() };
    return { kind: 'treat', id: this.rand.pick(TREATS).id };
  }
  /** A playing card for a card pack: any rank and suit, glossed now and then. Its id is set when it is taken. */
  private rollCard(): Card {
    const rank = 2 + this.rand.int(13), suit = this.rand.int(4) as Suit;
    return { id: -1, rank, suit, gloss: this.rand.next() < CARD_PACK_GLOSS ? this.rand.pick(GLOSSES.slice(1)) : '' };
  }
```

5. `stock()`: before `return`, add the packs and return them:

```ts
    const packs: (string | null)[] = [];
    for (let i = 0; i < SHOP_PACKS; i++) { const kind = this.rand.pick(PACK_KINDS); packs.push(this.rand.next() < BIG_PACK_ODDS ? `${kind}-big` : kind); }
    return { charms, items, packs };
```

6. `reroll()`: `this.shop = { charms: [], items: this.shop!.items, rerolls: n };` → `this.shop = { charms: [], items: this.shop!.items, packs: this.shop!.packs, rerolls: n };`
7. `sell()`: `(this.phase !== 'shop' && this.phase !== 'pick' && this.phase !== 'round')` → `(this.phase !== 'shop' && this.phase !== 'pick' && this.phase !== 'round' && this.phase !== 'pack')`.
8. After `rollOffer()` (Task 1) add the pack methods:

```ts

  // Booster packs
  /** Open one of the shop's packs: pay, roll what is inside and, for treats, deal cards from the deck to use them on. */
  openPack(slot: number) {
    const id = this.shop?.packs[slot], t = id ? packById(id) : undefined;
    if (this.phase !== 'shop' || !t || this.nuts < t.cost) return false;
    this.nuts -= t.cost; this.shop!.packs[slot] = null;
    const options: (string | Card | null)[] = [], names = () => options.filter((o): o is string => typeof o === 'string');
    for (let i = 0; i < t.shown + this.packBonus; i++) {
      const o = t.kind === 'charm' ? this.rollCharm(names()) : t.kind === 'almanac' ? this.rollHand(names())
        : t.kind === 'treat' ? this.rand.pick(TREATS.filter((x) => !names().includes(x.id))).id : this.rollCard();
      if (o !== null) options.push(o);
    }
    const dealt = t.kind === 'treat' ? this.rand.shuffle(this.deck.map((c) => c.id)).slice(0, PACK_DEAL) : [];
    const picks = Math.min(t.picks, options.length);
    if (picks) { this.pack = { id: t.id, options, picks, dealt }; this.phase = 'pack'; }
    return true;
  }
  /** Why option `i` of the open pack cannot be taken with these dealt cards selected, or null if it can. */
  packWhyNot(i: number, ids: number[] = []): string | null {
    const p = this.pack;
    if (this.phase !== 'pack' || !p) return 'No pack is open.';
    const o = p.options[i];
    if (o === null || o === undefined) return 'That one is taken.';
    const kind = packById(p.id)!.kind;
    if (kind === 'charm' && this.charms.length >= this.charmSlots) return 'Your charm slots are full: sell one to make room.';
    return kind === 'treat' ? this.treatWhyNot(o as string, ids, p.dealt, 'Select cards dealt for the pack.') : null;
  }
  /** Take option `i`: a charm into a slot, a page or treat used at once, a card into the deck. The last pick closes the pack. */
  takePack(i: number, ids: number[] = []) {
    if (this.packWhyNot(i, ids)) return false;
    const p = this.pack!, o = p.options[i]!, kind = packById(p.id)!.kind;
    p.options[i] = null; p.picks--;
    if (kind === 'charm') this.charms.push({ id: o as string, state: charmById(o as string)!.start ?? 0 });
    else if (kind === 'almanac') this.levels[o as HandId]++;
    else if (kind === 'card') this.deck.push({ ...(o as Card), id: this.nextId++ });
    else this.applyTreat(o as string, ids);
    if (p.picks <= 0 || p.options.every((x) => x === null)) this.closePack();
    return true;
  }
  /** Leave what is left in the pack. */
  skipPack() { if (this.phase !== 'pack') return false; this.closePack(); return true; }
  private closePack() { this.pack = null; this.phase = 'shop'; }
```

9. Replace `itemWhyNot` and `useItem` with the shared treat code:

```ts
  /** Why a treat cannot be used on these cards, chosen from `pool`, or null if it can. */
  private treatWhyNot(id: string, ids: number[], pool: number[], where: string): string | null {
    const t = treatById(id)!;
    if (t.picks === 0) return t.id === 'wish' && this.charms.length >= this.charmSlots ? 'Your charm slots are full.' : null;
    if (!ids.length) return `Select ${t.picks === 1 ? 'a card' : `up to ${t.picks} cards`} first.`;
    if (ids.length > t.picks) return `Select at most ${t.picks}.`;
    if (ids.some((x) => !pool.includes(x))) return where;
    return null;
  }
  /** Why an item cannot be used with these cards selected, or null if it can. */
  itemWhyNot(slot: number, ids: number[] = []): string | null {
    const it = this.items[slot];
    if (!it) return 'There is nothing in that slot.';
    if (it.kind === 'almanac') return null;
    if (treatById(it.id)!.picks > 0 && this.phase !== 'round') return 'Use it during a round, with cards selected.';
    return this.treatWhyNot(it.id, ids, this.round?.hand ?? [], 'Select cards in your hand.');
  }
  useItem(slot: number, ids: number[] = []) {
    if (this.itemWhyNot(slot, ids)) return false;
    const it = this.items[slot];
    this.items.splice(slot, 1);
    if (it.kind === 'almanac') { this.levels[it.id as HandId]++; return true; }
    this.applyTreat(it.id, ids);
    return true;
  }
  /** What a treat does to the cards chosen for it: in a round they are in the hand, in a treat pack among the dealt cards. */
  private applyTreat(id: string, ids: number[]) {
    const cards = ids.map((x) => this.card(x)), r = this.round, p = this.pack;
    const gloss = (g: Gloss) => cards.forEach((c) => { c.gloss = g; });
    switch (id) {
      case 'honey': gloss('honey'); break;
      case 'spice': gloss('ember'); break;
      case 'dew': gloss('crystal'); break;
      case 'leaf': gloss('gold'); break;
      case 'dye0': case 'dye1': case 'dye2': case 'dye3': cards.forEach((c) => { c.suit = Number(id[3]) as Suit; }); break;
      case 'sprout': cards.forEach((c) => { c.rank = Math.min(14, c.rank + 1); }); break;
      case 'mirror': { const copy: Card = { ...cards[0], id: this.nextId++ }; this.deck.push(copy); if (r) r.hand.push(copy.id); else if (p) p.dealt.push(copy.id); break; }
      case 'compost':
        this.deck = this.deck.filter((c) => !ids.includes(c.id));
        if (r) { r.hand = r.hand.filter((x) => !ids.includes(x)); this.fill(this.handSize); }
        if (p) p.dealt = p.dealt.filter((x) => !ids.includes(x));
        break;
      case 'tea': this.nuts += Math.min(this.nuts, 20); break;
      case 'wish': { const w = this.rollCharm([]); if (w) this.charms.push({ id: w, state: charmById(w)!.start ?? 0 }); break; }
    }
  }
```

10. `save()`: add `pack: copy(this.pack),` after `shop: copy(this.shop),`.
11. `load()`:
    - phases: `['pick', 'round', 'cashout', 'shop', 'over', 'victory']` → `['pick', 'round', 'cashout', 'shop', 'pack', 'over', 'victory']`.
    - Before the deck loop add `const okCard = (c: Card) => !!c && int(c.rank, 2, 14) && int(c.suit, 0, 3) && GLOSSES.includes(c.gloss);` and change the deck loop to `for (const c of s.deck) if (!okCard(c) || !int(c.id, 0, s.nextId - 1)) return null;`
    - `if ((s.phase === 'shop') !== !!s.shop) return null;` → `if ((s.phase === 'shop' || s.phase === 'pack') !== !!s.shop) return null;`
    - In the shop check, after `!int(s.shop.rerolls, 0, big) ||` add `!Array.isArray(s.shop.packs) || s.shop.packs.length > SHOP_PACKS || !s.shop.packs.every((id) => id === null || (typeof id === 'string' && !!packById(id))) ||`.
    - After the shop check add:

```ts
      if ((s.phase === 'pack') !== !!s.pack) return null;
      if (s.pack) {
        const p = s.pack, t = typeof p.id === 'string' ? packById(p.id) : undefined;
        if (!t || !Array.isArray(p.options) || p.options.length < 1 || p.options.length > t.shown + 1 || !int(p.picks, 1, t.picks) || !ids(p.dealt, inDeck)) return null;
        if (t.kind !== 'treat' && p.dealt.length) return null;
        const okOption = (o: unknown) => o === null || (t.kind === 'charm' ? typeof o === 'string' && !!charmById(o)
          : t.kind === 'almanac' ? HANDS.some((h) => h.id === o) : t.kind === 'treat' ? typeof o === 'string' && !!treatById(o)
          : okCard(o as Card) && (o as Card).id === -1);
        if (!p.options.every(okOption)) return null;
      }
```

    - In `Object.assign(g, { … })` add `pack: JSON.parse(JSON.stringify(s.pack)),` after `shop: …,`.
12. `record()`: after `run.shop?.charms.forEach(…)` add:

```ts
  if (run.pack && packById(run.pack.id)?.kind === 'charm') run.pack.options.forEach((id) => { if (typeof id === 'string') seen.add(id); });
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm run test:acorn-hand && npm run typecheck`
Expected: `PASS Acorn Hand: … vouchers and packs`; no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/acorn-hand-cards.ts lib/acorn-hand-game.ts tests/acorn-hand.mjs
git commit -m "Add booster packs to the Acorn Hand engine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Draw vouchers and packs

**Files:**
- Modify: `lib/acorn-hand-scene.ts` (import line 6; append after `drawCharm`, before `/** The critters' colours…`)

**Interfaces:**
- Consumes: `Voucher`, `VOUCHERS`, `VOUCHER_COST`, `PackType`, `PackKind` from `acorn-hand-cards.ts` (Tasks 1–2); `rounded`, `drawSuit`, `shade` already in scope in the scene.
- Produces: `drawVoucher(c: CanvasRenderingContext2D, v: Voucher, w: number, h: number): void`, `drawPack(c: CanvasRenderingContext2D, t: PackType, w: number, h: number): void`.

- [ ] **Step 1: Add the drawings**

Change the import on line 6 to:

```ts
import { type Card, type Charm, type Rival, type Voucher, type PackType, type PackKind, VOUCHERS, VOUCHER_COST, rankName } from './acorn-hand-cards';
```

After `drawCharm` add:

```ts

const VOUCHER_TINT = ['#c8743a', '#5f8f6a', '#b8892f', '#8a6a3c', '#a4524f', '#5c7fa8', '#7a5ea0', '#c09a4a', '#4f8f8f', '#6f9a3c'];
/** A voucher: a ticket stub with a paw stamp and its price, tinted by which voucher it is. */
export function drawVoucher(c: C2D, v: Voucher, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const tint = VOUCHER_TINT[Math.max(0, VOUCHERS.findIndex((x) => x.id === v.id)) % VOUCHER_TINT.length];
  const x = w * 0.06, y = h * 0.16, tw = w * 0.88, th = h * 0.68, notch = th * 0.14, mid = y + th / 2;
  // The ticket, with a half-round bite out of each end.
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + tw, y);
  c.lineTo(x + tw, mid - notch); c.arc(x + tw, mid, notch, -Math.PI / 2, Math.PI / 2, true); c.lineTo(x + tw, y + th);
  c.lineTo(x, y + th); c.lineTo(x, mid + notch); c.arc(x, mid, notch, Math.PI / 2, -Math.PI / 2, true); c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + th); g.addColorStop(0, shade(tint, 1.15)); g.addColorStop(1, shade(tint, 0.8)); c.fillStyle = g; c.fill();
  c.strokeStyle = '#fff3d6'; c.lineWidth = 2; c.stroke();
  // Perforation between the ticket and its stub.
  c.save(); c.setLineDash([3, 4]); c.strokeStyle = 'rgba(255,243,214,.7)'; c.beginPath(); c.moveTo(x + tw * 0.72, y + 4); c.lineTo(x + tw * 0.72, y + th - 4); c.stroke(); c.restore();
  // A paw stamp: a pad and four toes.
  const px = x + tw * 0.36, py = y + th * 0.6, s = th * 0.17;
  c.fillStyle = 'rgba(255,243,214,.9)';
  c.beginPath(); c.ellipse(px, py, s * 1.1, s * 0.85, 0, 0, Math.PI * 2); c.fill();
  for (const [dx, dy] of [[-1.25, -1.15], [-0.45, -1.7], [0.45, -1.7], [1.25, -1.15]]) { c.beginPath(); c.arc(px + dx * s, py + dy * s, s * 0.42, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#fff3d6'; c.font = `700 ${Math.round(th * 0.3)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(VOUCHER_COST), x + tw * 0.86, mid);
}

const PACK_TINT: Record<PackKind, [string, string]> = { charm: ['#7a4f8a', '#3e2648'], almanac: ['#4f7a5a', '#26402e'], treat: ['#b0603a', '#5a2c18'], card: ['#3f6390', '#1f3250'] };
const PACK_SUIT: Record<PackKind, number> = { charm: 2, almanac: 1, treat: 0, card: 3 };
/** A booster pack: a crimped acorn-paper packet, coloured by kind, gold-edged and banded when big. */
export function drawPack(c: C2D, t: PackType, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const [hi, lo] = PACK_TINT[t.kind], x = w * 0.14, y = h * 0.06, pw = w * 0.72, ph = h * 0.88, teeth = 7, tooth = ph * 0.04;
  c.beginPath(); c.moveTo(x, y + tooth);
  for (let i = 0; i < teeth; i++) { c.lineTo(x + (pw * (i + 0.5)) / teeth, y); c.lineTo(x + (pw * (i + 1)) / teeth, y + tooth); }
  c.lineTo(x + pw, y + ph - tooth);
  for (let i = teeth - 1; i >= 0; i--) { c.lineTo(x + (pw * (i + 0.5)) / teeth, y + ph); c.lineTo(x + (pw * i) / teeth, y + ph - tooth); }
  c.closePath();
  const g = c.createLinearGradient(x, 0, x + pw, 0); g.addColorStop(0, lo); g.addColorStop(0.45, hi); g.addColorStop(1, lo); c.fillStyle = g; c.fill();
  c.strokeStyle = t.big ? '#e6b84a' : '#fff3d6'; c.lineWidth = t.big ? 3 : 2; c.stroke();
  // Crimped bands at the top and bottom.
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + tooth, pw, ph * 0.07); c.fillRect(x, y + ph - tooth - ph * 0.07, pw, ph * 0.07);
  drawSuit(c, PACK_SUIT[t.kind], x + pw / 2, y + ph * 0.44, pw * 0.5);
  if (t.big) {
    c.fillStyle = '#e6b84a'; c.fillRect(x, y + ph * 0.7, pw, ph * 0.12);
    c.fillStyle = '#3b2a14'; c.font = `900 ${Math.round(ph * 0.09)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BIG', x + pw / 2, y + ph * 0.76);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (The drawings are checked by eye in Task 4's screenshots.)

- [ ] **Step 3: Commit**

```bash
git add lib/acorn-hand-scene.ts
git commit -m "Draw Acorn Hand vouchers and booster packs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shop rows, the pack screen and the browser checks

**Files:**
- Modify: `app/acorn-hand/page.tsx` (imports 5–10; `RUN_KEY` 17; art components 35–38; `__acorn` 72; `toggle` 90–93; after `applyItem` 128–135; keyboard 138–152; help text 185–186; `charmsRow`/`itemsRow` 206–236; cash-out interest line 321; shop 327–346; `charmsRow(…)` call 376)
- Modify: `app/acorn-hand/acorn-hand.css` (after line 127, and in the phone media block near line 141)
- Modify: `tests/e2e/acorn-hand.mjs`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything from Tasks 1–3: `r.offer`, `r.vouchers`, `r.buyVoucher()`, `r.charmSlots`, `r.itemSlots`, `r.interestCap`, `r.packBonus`, `r.shop.packs`, `r.openPack(i)`, `r.pack`, `r.packWhyNot(i, ids)`, `r.takePack(i, ids)`, `r.skipPack()`, `VOUCHERS`, `VOUCHER_COST`, `voucherById`, `packById`, `type PackType`, `type PackKind`, `drawVoucher`, `drawPack`.
- Produces (test ids): `buy-voucher`, `offer-voucher`, `vouchers`, `offer-pack-N`, `open-pack-N`, `pack`, `pack-option-N`, `take-N`, `dealt`, `dealt-N`, `skip-pack`. `window.__acorn()` also returns `pack`, `offer`, `vouchers`.

- [ ] **Step 1: Write the failing browser checks**

In `tests/e2e/acorn-hand.mjs`:

1. Change the `stored` default key: `key = 'acorn-hand-run-v1'` → `key = 'acorn-hand-run-v2'`.
2. In the reload check, change both `localStorage.setItem('acorn-hand-run-v1', …)` calls to `'acorn-hand-run-v2'`, and after the last `assert.equal(await page.getByTestId('continue').count(), 0);` add:

```js
  await page.evaluate(() => { localStorage.removeItem('acorn-hand-run-v2'); localStorage.setItem('acorn-hand-run-v1', JSON.stringify({ v: 1, seed: 5, rand: 5, ante: 2, blind: 0, phase: 'pick' })); });
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0, 'a run from before vouchers is not offered');
```

3. Before `await check('a boss rule is shown and enforced'…`, add:

```js
await check('vouchers and packs: buy a voucher, open every kind of pack, and a reload comes back inside one', async (page) => {
  await fresh(page); await deal(page);
  await run(page, '(r) => { r.round.target = 1; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  await page.getByTestId('collect').click(); await page.getByTestId('shop').waitFor();
  await run(page, '(r) => { r.nuts = 200; r.offer = "shelf"; }');
  await page.getByTestId('buy-voucher').click();
  assert.deepEqual(await run(page, '(r) => r.vouchers'), ['shelf']);
  assert.equal(await page.locator('[data-testid="charms"] > *').count(), 6, 'Wider Shelf shows a sixth slot');
  assert.match(await page.getByTestId('vouchers').innerText(), /Wider Shelf/);
  // A charm pack, by mouse.
  await run(page, '(r) => { r.shop.packs = ["charm", "almanac-big"]; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
  const want = await run(page, '(r) => r.pack.options[1]');
  await page.getByTestId('take-1').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.charms[0].id'), want);
  // A big almanac pack, two picks by keyboard.
  await page.getByTestId('open-pack-1').click(); await page.getByTestId('pack').waitFor();
  const [a, b] = await run(page, '(r) => r.pack.options.slice(0, 2)');
  await page.keyboard.press('1'); await page.keyboard.press('2'); await page.getByTestId('shop').waitFor();
  assert.deepEqual(await run(page, `(r) => [r.levels["${a}"], r.levels["${b}"]]`), [2, 2], 'both pages are used as they are taken');
  // A treat pack: a digit with nothing selected explains itself, then honey on two dealt cards.
  await run(page, '(r) => { r.shop.packs = ["treat", "card"]; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('dealt').waitFor();
  await run(page, '(r) => { r.pack.options = ["honey", "tea", "mirror"]; }');
  await page.keyboard.press('1'); assert.match(await page.getByTestId('note').innerText(), /Select/); assert.equal(await run(page, '(r) => r.phase'), 'pack');
  const ids = await run(page, '(r) => r.pack.dealt.slice(0, 2)');
  await page.getByTestId('dealt-0').click(); await page.getByTestId('dealt-1').click(); await page.getByTestId('take-0').click();
  await page.getByTestId('shop').waitFor();
  assert.deepEqual(await run(page, `(r) => ${JSON.stringify(ids)}.map((id) => r.card(id).gloss)`), ['honey', 'honey']);
  // A card pack joins the deck.
  const deck = await run(page, '(r) => r.deck.length');
  await page.getByTestId('open-pack-1').click(); await page.getByTestId('pack').waitFor(); await page.getByTestId('take-0').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.deck.length'), deck + 1);
  // A reload inside a pack comes back to it; Skip leaves it.
  await run(page, '(r) => { r.leave(); r.phase = "shop"; r.shop = { charms: [null, null], items: [null, null], packs: ["card-big", null], rerolls: 0 }; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
  assert.equal((await stored(page)).phase, 'pack', 'the open pack is saved');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); await page.getByTestId('continue').click(); await page.getByTestId('pack').waitFor();
  assert.equal(await run(page, '(r) => r.pack.id'), 'card-big');
  await page.getByTestId('skip-pack').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.pack'), null);
});
```

4. In the layout loop, after the shop screenshot line add:

```js
    await run(page, '(r) => { r.nuts = 50; r.shop.packs[0] = "treat-big"; }'); await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
    assert.ok(await fits(page), 'pack');
    await page.screenshot({ path: `.checks/acorn-hand/pack-${width}x${height}.png`, fullPage: true });
```

- [ ] **Step 2: Run the browser checks to see them fail**

Start the dev server in a separate terminal or background shell (`npm run dev`), make sure Playwright is installed (`npm i -D playwright`, not committed), then:

Run: `ONLY=vouchers npm run test:e2e:acorn-hand`
Expected: `FAIL vouchers and packs: …` (no `buy-voucher` button; the locator times out).

- [ ] **Step 3: Imports, keys, art and the test hook**

In `app/acorn-hand/page.tsx`:

1. Replace the import block (lines 5–10) with:

```tsx
import {
  Run, BLIND, ANTES, ITEM_COST, MAX_PLAY, INTEREST_EVERY, HANDS, CHARMS, GLOSS_TEXT, SUITS, VOUCHERS, VOUCHER_COST,
  charmById, handById, itemName, itemText, rankLong, voucherById, packById, loadProfile, freshProfile, record,
  type Card, type Score, type Profile, type Item, type Rival, type PackType, type PackKind,
} from '../../lib/acorn-hand-game';
import { drawCard, drawCharm, drawRival, drawVoucher, drawPack } from '../../lib/acorn-hand-scene';
```

2. `const RUN_KEY = 'acorn-hand-run-v1'` → `const RUN_KEY = 'acorn-hand-run-v2'`.
3. After the `cardName` line add:

```tsx
const PACK_TEXT: Record<PackKind, string> = {
  charm: 'Chinchilla charms: take one into a free slot.', almanac: 'Almanac pages, each used as you take it.',
  treat: 'Treats, used at once on cards dealt from your deck.', card: 'Playing cards, some glossed, that join your deck.',
};
const packLine = (t: PackType, bonus: number) => `Pick ${t.picks} of ${t.shown + bonus}`;
```

4. After `RivalArt` add:

```tsx
const VoucherArt = ({ id }: { id: string }) => <Paint w={150} h={110} sig={id} draw={(c, w, h) => drawVoucher(c, voucherById(id)!, w, h)} />;
const PackArt = ({ id }: { id: string }) => <Paint w={110} h={150} sig={id} draw={(c, w, h) => drawPack(c, packById(id)!, w, h)} />;
```

5. The `__acorn` effect becomes:

```tsx
  useEffect(() => { (window as unknown as { __acorn?: () => unknown }).__acorn = () => ({ run: runRef.current, profile, anim, selected, refresh, motion: motion.current, pack: runRef.current?.pack ?? null, offer: runRef.current?.offer ?? null, vouchers: runRef.current?.vouchers ?? [] }); });
```

- [ ] **Step 4: Selection, taking and keys inside a pack**

1. `toggle`'s first line becomes:

```tsx
    if (anim || !(run?.phase === 'round' || (run?.phase === 'pack' && run.pack?.dealt.includes(id)))) return;
```

2. After `applyItem` add:

```tsx
  /** Take option `i` of the open pack, using the selected dealt cards for a treat. */
  const takeOption = (i: number) => {
    const r = runRef.current; if (!r?.pack) return;
    const why = r.packWhyNot(i, selected); if (why) { act(false, 'nope', why); return; }
    const ok = r.takePack(i, selected); if (ok) setSelected([]);
    act(ok, 'use');
  };
  const skipPack = () => { const r = runRef.current; if (!r) return; setSelected([]); act(r.skipPack(), 'click'); };
```

3. In the keyboard effect, replace

```tsx
      const r = runRef.current; if (view !== 'run' || !r || r.phase !== 'round' || anim) return;
```

with

```tsx
      const r = runRef.current; if (view !== 'run' || !r || anim) return;
      if (r.phase === 'pack') {
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); takeOption(Number(e.key) - 1); }
        else if (e.key === 's' || e.key === 'S') skipPack();
        else if (e.key === 'Escape') setSelected([]);
        return;
      }
      if (r.phase !== 'round') return;
```

and update the comment above the effect to `// Keyboard: 1 to 9 pick cards, Enter plays, D discards, S sorts, Escape clears, M mutes; in a pack 1 to 9 take, S skips.`

4. Help text: the `Between rounds` item becomes

```tsx
            <li><b>Between rounds:</b> spend nuts on charms (five slots), almanac pages that level up a hand type, treats that change your cards, one voucher an ante that lasts the whole run, and booster packs to pick from. Every five nuts you keep earns one more, up to five.</li>
```

and the `Keys` item adds `In a pack, 1 to 5 take and S skips.` before `On a phone, tap.`

- [ ] **Step 5: Slots, interest and the shop rows**

1. In `charmsRow`, `Array.from({ length: CHARM_SLOTS }, …)` → `Array.from({ length: r.charmSlots }, …)`; in `itemsRow`, `ITEM_SLOTS` → `r.itemSlots`.
2. The cash-out interest line: `at most {INTEREST_CAP}` → `at most {r.interestCap}`.
3. After `itemTip` add:

```tsx
  const voucherTip = (id: string, price?: number) => () => { const v = voucherById(id)!; return { title: v.name, sub: 'Voucher', body: v.text, foot: price ? `Costs ${price} nuts and lasts the rest of the run.` : 'Yours for the rest of the run.' }; };
  const packTip = (t: PackType) => () => ({ title: t.name, sub: packLine(t, r.packBonus), body: PACK_TEXT[t.kind], foot: `Costs ${t.cost} nuts.` });
  /** What one option in an open pack looks like. */
  const packOption = (kind: PackKind, o: string | Card) => {
    if (kind === 'charm') { const d = charmById(o as string)!; return <><div {...tip(charmTip(d.id))}><CharmArt id={d.id} /></div><h3>{d.name}</h3><p className="ah-small">{RARITY[d.rarity]}</p><p>{d.text}</p></>; }
    if (kind === 'card') { const c = o as Card; return <><CardArt card={c} /><h3>{cardName(c)}</h3>{c.gloss && <p>{GLOSS_TEXT[c.gloss as keyof typeof GLOSS_TEXT]}</p>}</>; }
    const it: Item = { kind: kind === 'almanac' ? 'almanac' : 'treat', id: o as string };
    return <><div className="ah-item-big" aria-hidden="true" {...tip(itemTip(it))}>{itemIcon(it)}</div><h3>{itemName(it)}</h3><p>{itemText(it)}</p></>;
  };
```

4. In the shop: the `buy-charm` button's `r.charms.length >= CHARM_SLOTS` → `r.charms.length >= r.charmSlots`; the `buy-item` button's `r.items.length >= ITEM_SLOTS` → `r.items.length >= r.itemSlots`. After the shop heading's `<p>Next: …</p>` (inside `ah-shop-head`) add:

```tsx
        {r.vouchers.length > 0 && <p className="ah-vouchers" data-testid="vouchers">Vouchers: {r.vouchers.map((v, i) => <span key={v} {...tip(voucherTip(v))}>{i ? ', ' : ''}{voucherById(v)!.name}</span>)}</p>}
```

and directly after the closing `</div>` of `ah-offers` add:

```tsx
      <div className="ah-offers ah-offers-extra">
        <article className="ah-offer ah-offer-voucher" data-testid="offer-voucher">
          {r.offer ? <>
            <div {...tip(voucherTip(r.offer, VOUCHER_COST))}><VoucherArt id={r.offer} /></div>
            <h3>{voucherById(r.offer)!.name}</h3><p className="ah-small">Voucher · this ante</p><p>{voucherById(r.offer)!.text}</p>
            <button className="ah-gold" data-testid="buy-voucher" disabled={r.nuts < VOUCHER_COST} onClick={() => act(r.buyVoucher(), 'buy')}>Buy · {VOUCHER_COST}</button>
          </> : <p>{r.vouchers.length >= VOUCHERS.length ? 'Every voucher is yours.' : 'Voucher bought. A new one comes after the boss.'}</p>}
        </article>
        {s.packs.map((id, i) => {
          const t = id ? packById(id) : undefined;
          return t ? <article key={`p${i}`} className="ah-offer ah-offer-pack" data-testid={`offer-pack-${i}`} data-kind={t.kind}>
            <div {...tip(packTip(t))}><PackArt id={t.id} /></div>
            <h3>{t.name}</h3><p className="ah-small">{packLine(t, r.packBonus)}</p><p>{PACK_TEXT[t.kind]}</p>
            <button className="ah-gold" data-testid={`open-pack-${i}`} disabled={r.nuts < t.cost} onClick={() => { setSelected([]); act(r.openPack(i), 'deal'); }}>Open · {t.cost}</button>
          </article> : <article key={`p${i}`} className="ah-offer ah-sold"><p>Opened</p></article>;
        })}
      </div>
```

- [ ] **Step 6: The pack screen**

Directly after the shop branch (before `} else if (r.phase === 'victory') {`) add:

```tsx
  } else if (r.phase === 'pack' && r.pack) {
    const p = r.pack, t = packById(p.id)!;
    body = <section className="ah-shop ah-pack" data-testid="pack" data-kind={t.kind}>
      <div className="ah-shop-head"><h2>{t.name}</h2><p>{p.picks} pick{p.picks === 1 ? '' : 's'} left. {t.kind === 'treat' ? 'Select dealt cards, then use a treat on them.' : 'Take what you want, or skip the rest.'}</p></div>
      <div className="ah-offers">
        {p.options.map((o, i) => {
          if (o === null) return <article key={i} className="ah-offer ah-sold"><p>Taken</p></article>;
          const why = r.packWhyNot(i, selected);
          return <article key={i} className="ah-offer" data-testid={`pack-option-${i}`} data-rarity={t.kind === 'charm' ? charmById(o as string)!.rarity : undefined}>
            {packOption(t.kind, o)}
            <button className="ah-gold" data-testid={`take-${i}`} aria-disabled={!!why} title={why ?? undefined} onClick={() => takeOption(i)}>{t.kind === 'treat' ? 'Use' : 'Take'} <kbd aria-hidden="true">{i + 1}</kbd></button>
          </article>;
        })}
      </div>
      {t.kind === 'treat' && <div className="ah-hand ah-dealt" data-testid="dealt" style={{ '--n': p.dealt.length } as React.CSSProperties}>
        {p.dealt.map((id, i) => {
          const c = r.card(id), sel = selected.includes(id);
          return <button key={id} className="ah-card" data-selected={sel} data-testid={`dealt-${i}`} aria-pressed={sel} aria-label={cardName(c)} onClick={() => toggle(id)}><CardArt card={c} /></button>;
        })}
      </div>}
      <div className="ah-row ah-center"><button data-testid="skip-pack" onClick={skipPack}>Skip the rest</button></div>
    </section>;
```

And the charm row call near the end: `charmsRow(r.phase === 'shop' || r.phase === 'pick')` → `charmsRow(r.phase === 'shop' || r.phase === 'pick' || r.phase === 'pack')`.

- [ ] **Step 7: Styles**

In `app/acorn-hand/acorn-hand.css`, after `.ah-offer button { margin-top: auto; }` add:

```css
.ah-offers-extra { margin-top: 10px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ah-offer-voucher canvas { width: 120px; }
.ah-offer-pack canvas { width: 76px; }
.ah-offer kbd { font-size: 11px; opacity: .7; margin-left: 4px; }
.ah-vouchers { font-size: 13px; color: #6a5a48; }
.ah-vouchers span { text-decoration: underline dotted; cursor: help; }
.ah-dealt { margin-top: 14px; }
```

and inside the phone media block, next to `.ah-offers { grid-template-columns: repeat(2, minmax(0, 1fr)); }`, add `.ah-offers-extra { grid-template-columns: repeat(2, minmax(0, 1fr)); }`.

- [ ] **Step 8: Run the checks to see them pass**

Run: `npm run typecheck && npm run test:e2e:acorn-hand`
Expected: no type errors; every check `PASS`, including the new one and all six layouts. Open `.checks/acorn-hand/shop-390x844.png`, `pack-390x844.png` and `shop-1280x720.png` and confirm by eye: the voucher ticket and packs are drawn (not blank), nothing overlaps, and the pack screen's dealt cards and Skip button are visible.

- [ ] **Step 9: Changelog**

In `CHANGELOG.md`, under `## 15-10-2026` → `### Added`, add as the first bullet:

```markdown
- **Acorn Hand**: vouchers and booster packs give the nuts that pile up late in a run somewhere to go. Each ante offers one voucher that lasts the whole run: a sixth charm slot, a third item slot, an extra play, an extra discard, a bigger hand, a higher interest cap, cheaper rerolls, a third charm in the shop, bigger packs or luckier charms. Every shop also sells two booster packs of charms, almanac pages, treats or playing cards to pick from; a treat pack deals cards from your deck to use them on. A run started before this change can't be continued.
```

- [ ] **Step 10: Commit**

```bash
git add app/acorn-hand/page.tsx app/acorn-hand/acorn-hand.css tests/e2e/acorn-hand.mjs CHANGELOG.md
git commit -m "Sell vouchers and booster packs in the Acorn Hand shop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Teach the bot, and retune

**Files:**
- Modify: `tests/acorn-hand-bot.mjs` (import line 5; `shop` 89–112; `play` 114–125; main 127–146)
- Possibly modify: `lib/acorn-hand-cards.ts` (`ANTE_BASE`, `VOUCHER_COST`, `PACKS` costs) only if the win rate leaves 20–45%

**Interfaces:**
- Consumes: `run.offer`, `run.buyVoucher()`, `run.charmSlots`, `run.shop.packs`, `run.openPack(i)`, `run.pack`, `run.takePack(i, ids)`, `run.skipPack()`, `packById`, `treatById`, `VOUCHERS`, `VOUCHER_COST`.
- Produces: `shop(run, out?)`; `play(seed)` result gains `vouchers: Set<string>` (via `out.run.vouchers`) and `packs: Set<string>` (pack kinds opened).

- [ ] **Step 1: Add the failing assertions**

In `tests/acorn-hand-bot.mjs`, change the import to:

```js
import { Run, CHARMS, BOSSES, VOUCHERS, VOUCHER_COST, MAX_PLAY, charmById, packById, treatById, scorePlay } from '../.checks/acorn-hand-game.js';
```

In the main block, change `let wins = 0; const lost = {}, met = new Set(), beaten = new Set(), bought = new Set(), inWins = new Set();` to also declare `vouchers = new Set(), packs = new Set()`, and inside the seed loop after `r.charms.forEach((c) => bought.add(c));` add `r.run.vouchers.forEach((v) => vouchers.add(v)); r.packs.forEach((k) => packs.add(k));`. After the `never in a win` line add:

```js
  console.log(`vouchers bought ${vouchers.size}/${VOUCHERS.length}; pack kinds opened ${[...packs].sort().join(' ')}`);
```

and after the last existing `assert` add:

```js
  assert.equal(vouchers.size, VOUCHERS.length, 'every voucher is bought somewhere');
  assert.equal(packs.size, 4, 'every kind of pack is opened');
```

- [ ] **Step 2: Run the bot to see it fail**

Run: `npm run bot:acorn-hand`
Expected: FAIL. `r.packs` is undefined (`TypeError: Cannot read properties of undefined (reading 'forEach')`).

- [ ] **Step 3: The shopping policy**

Replace the line `const fresh = (id) => ({ id, state: charmById(id).start ?? 0 });` and the whole `shop` function with:

```js
const fresh = (id) => ({ id, state: charmById(id).start ?? 0 });
/** The vouchers the bot wants most come first. */
const VOUCHER_ORDER = ['shelf', 'play', 'hand', 'discard', 'hoard', 'stall', 'lucky', 'haggler', 'market', 'pockets'];

/** Take what is worth taking from the open pack, then close it. */
function takeFromPack(run) {
  const kind = packById(run.pack.id).kind;
  while (run.phase === 'pack') {
    const opts = run.pack.options.map((o, i) => [o, i]).filter(([o]) => o !== null);
    let pick = -1, ids = [];
    if (kind === 'charm') {
      const now = value(run, run.charms);
      if (run.charms.length < run.charmSlots) { let top = -Infinity; for (const [id, i] of opts) { const v = value(run, [...run.charms, fresh(id)]); if (v > top) { top = v; pick = i; } } }
      else {
        // Full: swap out whichever charm an option beats by most, as in the shop.
        let top = now * 1.08, swap = -1;
        for (const [id, i] of opts) run.charms.forEach((_, k) => { const v = value(run, run.charms.map((c, j) => (j === k ? fresh(id) : c))); if (v > top) { top = v; swap = k; pick = i; } });
        if (pick >= 0) run.sell(swap);
      }
    } else if (kind === 'almanac') pick = (opts.find(([h]) => h === run.fame) ?? opts[0])[1];
    else if (kind === 'card') pick = opts[0][1];
    else {
      const t = opts.find(([id]) => ['honey', 'spice', 'dew', 'tea', 'wish'].includes(id));
      if (t) { pick = t[1]; ids = [...run.pack.dealt].sort((a, b) => run.card(b).rank - run.card(a).rank).slice(0, treatById(t[0]).picks); }
    }
    if (pick < 0 || !run.takePack(pick, ids)) { run.skipPack(); break; }
  }
}

export function shop(run, out = null) {
  if (run.offer && run.nuts >= VOUCHER_COST + (VOUCHER_ORDER.indexOf(run.offer) < 3 ? 0 : 5)) run.buyVoucher();
  for (let pass = 0; pass < 6; pass++) {
    run.shop.charms.forEach((id, i) => {
      if (!id || run.nuts < run.priceOf(id)) return;
      const now = value(run, run.charms);
      if (run.charms.length < run.charmSlots) { if (value(run, [...run.charms, fresh(id)]) > now * 1.02 || run.charms.length < 2) run.buyCharm(i); return; }
      // Full: swap out whichever charm the new one beats by most.
      let swap = -1, top = now * 1.08;
      run.charms.forEach((_, k) => { const v = value(run, run.charms.map((c, j) => (j === k ? fresh(id) : c))); if (v > top) { top = v; swap = k; } });
      if (swap >= 0 && run.nuts + run.sellPrice(run.charms[swap].id) >= run.priceOf(id)) { run.sell(swap); run.buyCharm(i); }
    });
    run.shop.items.forEach((it, i) => {
      if (!it) return;
      const want = it.kind === 'almanac' ? it.id === run.fame || run.ante < 3 : ['tea', 'wish', 'honey', 'spice', 'dew'].includes(it.id);
      if (want && run.nuts >= 3 + (run.ante > 2 ? 5 : 0)) run.buyItem(i);
    });
    for (let slot = run.items.length - 1; slot >= 0; slot--) if (run.items[slot].kind === 'almanac' || ['tea', 'wish'].includes(run.items[slot].id)) run.useItem(slot);
    run.shop.packs.forEach((id, i) => {
      if (!id) return;
      const t = packById(id), spare = run.nuts - t.cost;
      const want = t.kind === 'charm' ? spare >= 2 : t.kind === 'almanac' ? spare >= 0 && run.fame !== null : t.kind === 'treat' ? spare >= 4 : spare >= 20;
      if (want && run.openPack(i)) { out?.packs.add(t.kind); if (run.phase === 'pack') takeFromPack(run); }
    });
    if (run.nuts >= run.rerollCost + 10) run.reroll(); else break;
  }
  // ×mult charms at the end, where they multiply the most.
  for (let k = 0; k < run.charms.length; k++) for (let i = 0; i < run.charms.length - 1; i++) if (charmById(run.charms[i].id).text.startsWith('×') && !charmById(run.charms[i + 1].id).text.startsWith('×')) run.shift(i, 1);
  run.leave();
}
```

In `play`, change `out = { run, lostAt: null, bosses: [], bossBeaten: [], charms: new Set(), maxHand: 0 }` to add `packs: new Set()`, and `shop(run);` to `shop(run, out);`.

- [ ] **Step 4: Run the bot**

Run: `npm run bot:acorn-hand`
Expected: the two new assertions pass. Note the printed win rate.

- [ ] **Step 5: Retune if the win rate is outside 20–45%**

The aim is the middle of the band, about 25–35%. Change one lever at a time and rerun `npm run bot:acorn-hand` after each:
- **Above 45%:** raise `ANTE_BASE` for antes 5–8 in `lib/acorn-hand-cards.ts` by about 10% per step (for example `[250, 650, 1600, 3500, 7700, 13750, 22000, 33000]`). If it is still high after two steps, raise `VOUCHER_COST` to 12.
- **Below 20%:** lower the big-pack costs from 7 to 6, then if needed lower `ANTE_BASE` for antes 5–8 by about 5%.
- **Over 5% lost in ante 1:** don't touch ante 1; check that the bot doesn't buy vouchers or packs before it has two charms (add `run.charms.length >= 2 &&` to the voucher and pack conditions).

Then run `npm test`, so every suite that reads the tables still passes. If any number changed, the engine test's `ANTE_BASE`/`VOUCHER_COST` assertions read the constants, so they move with it.

Optional, local only: run `node tests/e2e/.tmp/nuts.mjs` (a git-ignored scratch file from the design work; it imports `playRound` and `shop` from the bot) and see the median nuts left after a shop. Before this change it was about 12 from ante 3 on.

- [ ] **Step 6: Commit**

```bash
git add tests/acorn-hand-bot.mjs lib/acorn-hand-cards.ts
git commit -m "Teach the Acorn Hand bot vouchers and packs, and retune

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Leave out `lib/acorn-hand-cards.ts` if Step 5 changed nothing. If numbers did change, add a line to the Task 4 changelog bullet, e.g. "The later antes' targets went up to match.", in this commit.)

---

### Task 6: Documentation and the full check

**Files:**
- Modify: `docs/acorn-hand.md` (`## A run` interest line 34; `## The shop` 38–40; new sections after it; `## Saves` 131–133; `## Balance` 135+)
- Modify: `README.md` (the `### 34 · Acorn Hand` guide, lines 827–835)
- Modify: `HANDOFF.md` (`## Acorn Hand · 15-10-2026` and the next-steps list in `## Start here`)

**Interfaces:**
- Consumes: the final numbers after Task 5 (`ANTE_BASE`, `VOUCHER_COST`, pack costs, the bot's win rate and ante-1 losses). Read them from the code and the bot's output, not from this plan.

- [ ] **Step 1: `docs/acorn-hand.md`**

1. In `## A run`, change `1 for every 5 nuts held (at most 5)` to `1 for every 5 nuts held (at most 5, or 10 with Squirrel Hoard)`. If Task 5 changed `ANTE_BASE`, update the targets in the first bullet to match.
2. In `## The shop`, append to the paragraph: ` Each shop also has this ante's voucher and two booster packs; a reroll changes neither.`
3. After that paragraph, add:

```markdown
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
```

(Use the final costs if Task 5 changed any.)

4. In `## Saves`, change `` `acorn-hand-run-v1` holds the whole run, the round in progress included`` to `` `acorn-hand-run-v2` holds the whole run, the round or open pack in progress included`` and append: ` Version 2 added vouchers and packs; a version-1 run is ignored. The record keeps its own version, so it carried over.`
5. In `## Balance`, replace `Over 200 seeds it wins about 23% of runs and loses about 2.5% in ante 1` with the numbers the bot printed in Task 5 (e.g. `Since vouchers and packs (15-10-2026), over 200 seeds it wins about N% of runs and loses about M% in ante 1`), and add a sentence: `It buys this ante's voucher when it can (Wider Shelf, Extra Paw and Big Paws first), opens charm packs with nuts to spare, almanac packs for its most-played hand, treat packs for glosses, and card packs only when rich.`

- [ ] **Step 2: `README.md`**

In `### 34 · Acorn Hand (`/acorn-hand`)`:
- **Play:** replace `Between rounds the shop sells 44 chinchilla charms (five slots), almanac pages that level up a hand type and one-use treats that gloss, dye, copy or remove cards. Every five nuts kept earns one more, up to five.` with `Between rounds the shop sells 44 chinchilla charms (five slots), almanac pages that level up a hand type, one-use treats that gloss, dye, copy or remove cards, one voucher an ante from ten permanent upgrades (a sixth charm slot, an extra play, a bigger hand and so on) and two booster packs of charms, pages, treats or cards to pick from. Every five nuts kept earns one more, up to five.`
- **Controls:** after `**M** changes sound.` add ` In a booster pack, **1–5** take an option and **S** skips the rest.`
- **Tests:** after `the shop and rerolls,` add ` every voucher, every kind of booster pack,` and after `nearly every charm in some winning run` add `, every voucher bought and every kind of pack opened`; change `plays rounds by mouse, keyboard and touch in a browser.` to `plays rounds by mouse, keyboard and touch in a browser, buys a voucher and opens every kind of pack.` If the bot's band or win rate changed, update its numbers here too.

- [ ] **Step 3: `HANDOFF.md`**

In `## Acorn Hand · 15-10-2026`:
- **Code** bullet: append `Vouchers (`VOUCHERS`, `Run.offer`, `buyVoucher`) and booster packs (`PACKS`, the `'pack'` phase, `openPack`/`takePack`/`skipPack`, shared `applyTreat`) were added the same day; see `docs/superpowers/specs/15-10-2026-acorn-hand-vouchers-packs-design.md`.`
- **Saves** bullet: `acorn-hand-run-v1` → `acorn-hand-run-v2` (version 2, with vouchers, the offer and an open pack); add `The record has its own PROFILE_VERSION (1), so it survived the bump.`
- **Balance** bullet: replace the win rate with the Task 5 figure and say the bot now buys vouchers and opens packs.
- **Not done** bullet: replace `Late in a run nuts pile up with nothing worth buying once five charms are set; a sink (a sixth slot, packs, or vouchers) would help.` with `Vouchers and packs were added as the late-game nut sink and tuned only against the bot; play a run by hand to see whether nuts now run short or still pile up.`

In `## Start here`, next-steps item 3 becomes: `**Acorn Hand:** play a run by hand with vouchers and packs; a harder stake for players who win (agreed as its own PR); drawn icons instead of emoji for items.`

- [ ] **Step 4: The full check**

Run each and read the output:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e:acorn-hand
node tests/e2e/arcade-navigation.mjs
```

Expected: typecheck clean; `npm test` ends with every suite passing, including `PASS Acorn Hand: … vouchers and packs`, `Acorn Hand bot: PASS` and the README check; build succeeds; every Acorn Hand browser check passes; arcade navigation passes. (`npm run dev` must be running for the two browser commands.)

- [ ] **Step 5: Commit**

```bash
git add docs/acorn-hand.md README.md HANDOFF.md
git commit -m "Document Acorn Hand vouchers and booster packs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then stop. Opening the pull request and merging wait for the user ("merge and push" means: `gh pr create`, `gh pr checks --watch`, `gh pr merge --rebase --delete-branch`, fast-forward local `main`, watch the deploy run).
