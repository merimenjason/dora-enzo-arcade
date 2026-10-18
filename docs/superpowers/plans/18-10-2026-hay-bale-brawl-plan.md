# Hay Bale Brawl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Hay Bale Brawl, the arcade's 36th game: a Super Auto Pets-style auto-battler with 30 woodland units, 8 snacks, a shop, deterministic fights replayed on a hay bale, ghost rival crews, Dora or Enzo as coach, and runs of ten wins or five lost hearts.

**Architecture:** Pure data in `lib/hay-bale-units.ts` (units, snacks, tokens, abilities written against a `Ctx` interface). `lib/hay-bale-game.ts` implements that `Ctx` twice, once for the shop and once for the fight, and holds `Rand`, `fight`, `Run`, the buying policy, ghosts and the profile. A Canvas 2D scene draws a 480 × 320 stage from the run and replays a fight's event list; the page wires DOM buttons, drag and tap-tap input, sound and saving.

**Tech Stack:** TypeScript, React (Next/vinext client page), Canvas 2D, WebAudio through `lib/cue-sound.ts`, Node `assert` tests compiled with `tsc` into `.checks/`, Playwright for e2e.

**Spec:** [`docs/superpowers/specs/18-10-2026-hay-bale-brawl-design.md`](../specs/18-10-2026-hay-bale-brawl-design.md). Every number in the plan (stats, costs, slot counts, tiers, ability values) is the spec's; where a step says "per the spec", copy it from there.

## Global Constraints

- Work on branch `feat/hay-bale-brawl`; pushing to `main` deploys. Never stage `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`; stage files by name.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Engine files import siblings with a `.js` extension (`import { UNITS } from './hay-bale-units.js'`), so `tsc` output runs in Node.
- Engines have no DOM and no `Math.random`; randomness only from the seeded `Rand` (copied from `lib/acorn-hand-game.ts:28`).
- Route `/brawl`. Save keys `hay-bale-run-v1`, `hay-bale-v1`, `hay-bale-sound-v1`. Stage 480 × 320.
- Turn: 10 acorns; unit 3, snack 3, reroll 1, sell refunds level. 5 hearts, 10 bales to win. Line of 5, position 0 at the front. Stats cap 50. Fight cap 200 rounds.
- Scripts: `test:hay-bale`, `bot:hay-bale`, `test:e2e:brawl`, each `tsc lib/hay-bale-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck && node …` like `test:whisker-ware`.
- Don't run `oxfmt`; match the hand-formatted style of `lib/whisker-ware-game.ts` and `lib/acorn-hand-game.ts`.
- Markdown dates are dd-mm-yyyy. User-visible changes get a CHANGELOG entry under the day's `## DD-MM-YYYY`.
- Playwright is installed locally with `npm i -D playwright`; never commit that `package.json`/lockfile change.
- Scratch files go in `.checks/` and are deleted afterwards.
- Rerun `npm run bot:hay-bale` after any balance change.

## Review Focus

1. **Reloading during a fight's replay** must not replay or lose the fight: `endTurn` applies the result and the page saves before the replay starts, so Continue lands on the next shop with the bale or heart counted exactly once. Pinned in Task 6's e2e.
2. **Both lines fainting at once** (two Hedgehogs, a chain of faint damage) must end as a draw without looping. Pinned in Task 2's test `chained faints end in a draw`.
3. **Two zero-attack fronts** (Log Dam against Log Dam, or a Raccoon-drained front) must not grind to the 200-round cap: when neither front can deal damage and no ability fires in a round, the fight is a draw at once. Pinned in Task 2's test `zero attack fronts draw at once`. (Rule decided here; the spec's cap stays as the backstop.)
4. **An illegal buy** (full line with no matching unit, too few acorns, a snack on an empty slot) must change nothing and spend nothing. Pinned in Task 3's test `illegal actions change nothing`.
5. **A drag dropped anywhere that is not a target** (the shop, outside the canvas, the HUD) must cancel with no acorns spent, and `pointercancel` must too. Pinned in Task 6's e2e.

---

### Task 1: The roster

**Files:**
- Create: `lib/hay-bale-units.ts`, `lib/hay-bale-game.ts` (only `Rand` and re-exports for now), `tests/hay-bale.mjs`
- Modify: `package.json` (`test:hay-bale`; add `lib/hay-bale-game.ts` to the `tsc` list and `tests/hay-bale.mjs` to the `node` list of `test`)

**Interfaces:**
- Produces, in `lib/hay-bale-units.ts`:
  - `type Tier = 1 | 2 | 3 | 4 | 5; type Level = 1 | 2 | 3; type Status = 'shell' | 'mint' | 'chilli' | null;`
  - `type UnitId` (the 30 ids in the spec), `type TokenId = 'mouselet' | 'log' | 'fawn'`, `type SnackId` (the 8 ids).
  - `type Trigger = 'buy' | 'sell' | 'startTurn' | 'endTurn' | 'startBattle' | 'beforeAttack' | 'hurt' | 'faint' | 'knockOut' | 'friendSummoned' | 'friendAheadFaints' | 'friendFaints' | 'friendAte'`.
  - `type Unit = { uid: number; id: UnitId | TokenId; a: number; h: number; level: Level; xp: number; status: Status; tmpA: number }` (`tmpA` is the Raisin's fight-only attack).
  - `interface Ctx { rand: { int(n: number): number }; friends(u: Unit): Unit[]; enemies(u: Unit): Unit[]; ahead(u: Unit): Unit | null; behind(u: Unit): Unit | null; buff(u: Unit, a: number, h: number): void; damage(u: Unit, n: number): void; status(u: Unit, s: Status): void; summon(at: Unit, id: TokenId, a: number, h: number): void; acorns(n: number): void; snackDiscount(n: number): void }` — `friends` never includes `u`, both lists are living units front first, `enemies` is empty in the shop, `acorns`/`snackDiscount` do nothing in a fight.
  - `type UnitDef = { id: UnitId; name: string; tier: Tier; a: number; h: number; on: Trigger; text: [string, string, string]; run(ctx: Ctx, self: Unit, n: Level, other: Unit | null): void }` — `text` is the ability line per level, `other` is the summoned friend, the eater, the fainted friend or the knocked-out enemy.
  - `const UNITS: Record<UnitId, UnitDef>`, `const UNIT_IDS: UnitId[]` (spec order), `const TOKENS: Record<TokenId, { name: string }>`, `const SNACKS: Record<SnackId, { id: SnackId; name: string; tier: Tier; text: string }>`, `const SNACK_IDS: SnackId[]`.
- Produces, in `lib/hay-bale-game.ts`: `class Rand` (Acorn Hand's, with `s` public) and `export * from './hay-bale-units.js'`.

- [ ] **Step 1: Write the failing test** `tests/hay-bale.mjs` importing from `../.checks/hay-bale-game.js`: `roster: 30 units, six per tier` (count per tier is 6), `roster: stats and triggers match the spec` (a table of `[id, tier, a, h, on]` for all 30, copied from the spec, compared to `UNITS`), `roster: 8 snacks with their tiers`, `roster: every unit has three ability lines`.
- [ ] **Step 2: Run** `npm run test:hay-bale` → FAIL (cannot find `.checks/hay-bale-game.js`).
- [ ] **Step 3: Implement** the data with each `run` written against `Ctx` from the spec's ability text. "Random friends" picks distinct friends with `ctx.rand`; "the second enemy" is `enemies(self)[1]`; the healthiest/most-attack/least-health enemy breaks ties front-most; Skunk takes `floor(h × pct)` and leaves at least 1; Hare deals `floor(a × pct)`; Raccoon's drain is `min(n × 2, enemy.a)`.
- [ ] **Step 4: Run** `npm run test:hay-bale` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's roster`.

---

### Task 2: The fight

**Files:**
- Modify: `lib/hay-bale-game.ts`, `tests/hay-bale.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `type Coach = 'dora' | 'enzo'`; `type Result = 'win' | 'loss' | 'draw'` (from the left side's view).
  - `type FightEvent = { k: 'ability'; uid: number } | { k: 'attack'; uid: number } | { k: 'hit'; uid: number; dmg: number; h: number } | { k: 'buff'; uid: number; a: number; h: number } | { k: 'status'; uid: number; status: Status } | { k: 'faint'; uid: number } | { k: 'summon'; side: 0 | 1; at: number; unit: Unit } | { k: 'line'; side: 0 | 1; uids: number[] } | { k: 'end'; result: Result }` — `buff` and `hit` carry the new totals; `line` is each side's order after closing up.
  - `fight(left: Unit[], right: Unit[], seed: number, coach: Coach | null): { result: Result; events: FightEvent[]; rounds: number }` — the inputs are front-first lines without holes and are never mutated (the fight works on copies); summoned tokens get uids above every uid in either line.
  - `mix(a: number, b: number): number` — a 32-bit hash of two numbers, used for every derived seed.
- Rules decided here (the spec's fight section is the rest):
  - Whenever several abilities trigger together they are queued and resolved highest current attack first, ties left side first, then front-most. Effects that make new triggers (a hurt from Bee's damage) queue them after the current batch.
  - Damage to a unit: Shell turns the hit into 1 and is used up; Mint takes 1 off (at least 1); a 0-damage hit is no hit (no event, no hurt). Hurt fires only for units still alive. Faints resolve after the batch that caused them, then any faints they cause, until none are left (cap 100 passes).
  - Knock out fires for the attacker when its attack (not Chilli splash) fainted the front enemy and it is still alive.
  - `friendAheadFaints` fires for the unit directly behind the fainted one, at the moment it fainted.
  - A summon goes into the fainted unit's place; it fizzles when the side already has 5 living units. Robin's `friendSummoned` fires for it.
  - A round in which neither front unit has attack above 0 and no ability fired is a draw at once.
  - The Dora coach perk resolves before every other start-of-battle ability.
  - `tmpA` adds to attack in the fight.

- [ ] **Step 1: Write the failing tests.** Build lines with a helper `u(id, level = 1, extra = {})` that makes a `Unit` with the spec's base stats. One test per unit ability at levels 1 and 3, each with a hand-built fight and an assertion on the event list or on `result` (for example: `bee level 3 deals 3`; `hedgehog faint hits both sides`; `mouse summons a 3/3 at level 3`; `beaver's log takes the front`; `stoat grows on a knock out`; `skunk leaves at least 1`; `bear buffs ahead and behind`). Plus:
  - `simultaneous hits`: 2/3 vs 3/2 → both hit, left wins.
  - `ability order: higher attack first, ties to the left`.
  - `statuses: shell, mint, chilli`.
  - `summon into a full line fizzles`.
  - `chained faints end in a draw` (two lines of Hedgehogs at 1 health against each other).
  - `zero attack fronts draw at once` (Log Dam token lines, `rounds` under 3).
  - `dora's perk gives the front +0/+2 before abilities`.
  - `same seed, same events`, and different seeds can differ (Bee's target).
  - `fight leaves its inputs untouched`.
  - `500 random lines never reach 200 rounds` (seeded random lines of tier-mixed units).
- [ ] **Step 2: Run** `npm run test:hay-bale` → FAIL (`fight is not a function`).
- [ ] **Step 3: Implement** `fight` with a fight `Ctx` whose `buff` changes the fight copies only.
- [ ] **Step 4: Run** `npm run test:hay-bale` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's fights`.

---

### Task 3: The shop and the run

**Files:**
- Modify: `lib/hay-bale-game.ts`, `tests/hay-bale.mjs`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `type Slot = { kind: 'unit'; unit: Unit; frozen: boolean } | { kind: 'snack'; snack: SnackId; cost: number; frozen: boolean }`.
  - `type Phase = 'shop' | 'over' | 'won'`.
  - `type Outcome = { result: Result; events: FightEvent[]; rival: { name: string; line: Unit[] }; left: Unit[] }` — `left` is the line that fought (after end-of-turn triggers), for the replay.
  - `class Run { constructor(seed: number, coach: Coach | null, opt?: { acorns?: number; fights?: boolean }); seed: number; coach: Coach | null; turn: number; acorns: number; hearts: number; bales: number; phase: Phase; line: (Unit | null)[]; units: (Slot | null)[]; snacks: (Slot | null)[]; freeRoll: boolean; last: Outcome | null; rand: Rand; buy(i: number, to: number): boolean; feed(i: number, to: number): boolean; sell(at: number): boolean; move(from: number, to: number): boolean; roll(): boolean; freeze(kind: 'unit' | 'snack', i: number): boolean; endTurn(): Outcome | null; toJSON(): object; static load(raw: string | null): Run | null }`.
  - `levelOf(xp: number): Level` (2 at xp ≥ 2, 3 at xp ≥ 5); `crewName(line: Unit[], turn: number): string`.
- Rules decided here:
  - `line` has 5 entries (`null` = empty), index 0 at the front. `buy` into an empty slot places the unit; into a same-id unit merges; anything else fails. `move` onto an empty slot moves, onto a same-id unit merges, onto another unit swaps.
  - Merge: higher attack and higher health, +1/+1, `xp += 1 + other.xp` (capped at 5), level from `levelOf`, the merged unit keeps the target's status. A merge from the shop fires the merged unit's `buy`. Reaching a new level pushes one extra unit slot (tier `min(5, shopTier + 1)`) onto `units` for this turn.
  - Shop tier is `min(5, 1 + floor((turn − 1) / 2))`; slot counts per the spec by turn. A new turn's shop keeps frozen slots in place and fills the rest; a roll does the same within the turn. Snack cost is `max(0, 3 − discount)` with the Squirrel discounts summed.
  - Turn start: refill acorns to the run's acorns-per-turn (10, or `opt.acorns`), `freeRoll = coach === 'enzo'`, build the shop, then `startTurn` abilities. `endTurn`: `endTurn` abilities, then (with `fights !== false`) the fight against `ghost(mix(seed, turn), turn)` with seed `mix(seed, turn + 1000)`, then hearts/bales, `tmpA` cleared on the line, `last` set, phase to `over` at 0 hearts or `won` at 10 bales, else the next turn starts. With `fights: false` (ghosts) it skips the fight and returns `null`.
  - The fight's copy of the line drops `null`s; shop buffs are permanent on `line` itself.
  - `toJSON` holds everything including `rand.s`, `last` without events (`last.events = []`), and `v: 1`; `load` returns `null` for anything malformed or with unknown ids.
- `ghost(seed: number, turn: number): Unit[]` is written in Task 4; until then `endTurn` takes it from a module-level function stubbed to `[]`, which Task 4 replaces.

- [ ] **Step 1: Write the failing tests:**
  - `a new run`: 10 acorns, 5 hearts, 0 bales, turn 1, 3 unit slots and 1 snack slot, all tier 1.
  - `slots and tiers by turn`: turns 1, 3, 5, 7, 9 → tiers 1–5; turn 5 has 4 + 1 slots, turn 9 has 5 + 2.
  - `buy, sell and acorns`: buy costs 3; selling a level-2 unit refunds 2; `wren` sell buffs a friend.
  - `merging levels up and adds a bonus unit` (three copies → level 2 with stats max+1/+1 twice, `units.length` grows by one, the bonus unit's tier is one above).
  - `feed: snacks per the spec`, including `seed` levelling a unit and `rabbit` adding health when a friend eats.
  - `freeze survives a roll and the next turn`.
  - `enzo's first roll is free each turn; dora's is not`.
  - `squirrel makes snacks cheaper, never below 0`; `magpie adds acorns at turn start`; `duchess and dormouse buff at end turn, and it lasts`.
  - `raisin attack lasts one fight`.
  - `illegal actions change nothing`: buying with 2 acorns, into a full line with no match, feeding an empty slot, selling an empty slot, freezing out of range — each returns `false` and `JSON.stringify(run)` is unchanged.
  - `the run ends`: force results by stubbing lines (a level-3 Boar line against an empty ghost wins) → 10 bales gives `won`; 5 losses give `over`; a draw changes neither.
  - `save round-trips` (`Run.load(JSON.stringify(run))` continues to an identical next shop) and `malformed saves load as null` for `null`, `'x'`, `'{"v":2}'`, a line of 6, an unknown unit id, `hearts: -1`.
- [ ] **Step 2: Run** `npm run test:hay-bale` → FAIL (`Run is not a constructor`).
- [ ] **Step 3: Implement** `Run` with a shop `Ctx` (`enemies` empty; `buff` permanent).
- [ ] **Step 4: Run** `npm run test:hay-bale` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's shop and run`.

---

### Task 4: The buying policy, ghosts and the profile

**Files:**
- Modify: `lib/hay-bale-game.ts`, `tests/hay-bale.mjs`

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `type Action = { k: 'buy'; i: number; to: number } | { k: 'feed'; i: number; to: number } | { k: 'sell'; at: number } | { k: 'move'; from: number; to: number } | { k: 'roll' } | { k: 'freeze'; kind: 'unit' | 'snack'; i: number }`.
  - `const WEIGHT: Record<UnitId, number>` — the policy's value of each ability per level, in stat points.
  - `worth(line: (Unit | null)[]): number` — sum of `a + h + WEIGHT[id] × level` (tokens 0).
  - `choose(run: Run): Action | null` — the next action, or `null` to end the shop.
  - `playShop(run: Run, pick?: (run: Run) => Action | null): void` — applies `pick` (default `choose`) until `null` or 40 actions, then orders the line: highest `a + h` at the front.
  - `GHOST_ACORNS = 10`; `ghost(seed: number, turn: number): Unit[]` — a `Run(seed, null, { acorns: GHOST_ACORNS, fights: false })` shopped with `playShop` for `turn` turns; returns its line without `null`s.
  - `type Profile = { v: 1; runs: number; wins: number; best: number; won: UnitId[]; last: number }`; `freshProfile()`; `loadProfile(raw: string | null): Profile`; `record(p: Profile, run: Run): Profile` — pure; does nothing unless `run.phase` is `over` or `won`, and nothing when `p.last === run.seed`, so calling it twice is harmless.
- Policy, in order (the first that applies is the action):
  1. The affordable buy or feed (any slot, any target) with the largest `worth` gain, if the gain is above 0.
  2. With a full line, a shop unit whose `a + h + WEIGHT` beats the weakest line unit's by more than 2 and is affordable after selling it: sell the weakest.
  3. Freeze an unfrozen shop unit that would merge into the line, when there aren't acorns to buy it.
  4. Roll when acorns ≥ 4 (or the roll is free and acorns ≥ 3).
  5. `null`.

- [ ] **Step 1: Write the failing tests:** `the policy fills an empty line on turn 1`; `the policy merges a copy it can afford`; `the policy never takes an illegal action` (over 100 seeded runs of 6 turns, every `choose` result applied returns `true`); `ghosts are deterministic and grow` (`ghost(5, 1)` equals itself; the mean `worth` of 50 ghosts rises from turn 1 to 5 to 9); `the run fights ghosts` (`endTurn` returns an `Outcome` with a `rival.name` like `The … 's …`); `profile: record counts a run once`; `profile: malformed saves load fresh` (for `null`, `'x'`, `{"v":2}`, `runs: -1`, `best: 11`, `won: "x"`), with unknown ids dropped from `won`.
- [ ] **Step 2: Run** `npm run test:hay-bale` → FAIL.
- [ ] **Step 3: Implement**; start `WEIGHT` at 2 for every unit and leave tuning to Task 5.
- [ ] **Step 4: Run** `npm run test:hay-bale` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's buying policy, ghosts and profile`.

---

### Task 5: The bot and the balance gates

**Files:**
- Create: `tests/hay-bale-bot.mjs`
- Modify: `package.json` (`bot:hay-bale`; the bot after `tests/hay-bale.mjs` in the `node` list of `test`), `lib/hay-bale-units.ts` and `lib/hay-bale-game.ts` (tuning only)

- [ ] **Step 1: Write the bot.** Over seeds 1–300, play whole runs as Dora and Enzo alternately with `playShop(run)` then `endTurn()`, and again with a random buyer (`pick` that returns a random legal buy into a random legal slot while acorns ≥ 3, else `null`). Track per run whether it was won, the units bought, the units in the final line of each won run, and the most rounds any fight took. Gates:

```js
assert.ok(win >= 0.30 && win <= 0.55, `policy wins ${win}`);
assert.ok(randomWin < 0.05, `random buyer wins ${randomWin}`);
for (const id of UNIT_IDS) assert.ok(bought[id] / 300 >= 0.02, `${id} is bought in ${bought[id]} runs`);
for (const id of UNIT_IDS) assert.ok(inWins[id] / wins <= 0.50, `${id} is in ${inWins[id]} of ${wins} winning lines`);
for (const t of [1, 2, 3, 4, 5]) assert.ok(tierInWins[t] > 0, `tier ${t} appears in winning lines`);
assert.ok(maxRounds < 200, `longest fight ${maxRounds} rounds`);
```

Print the win rates, the bought and in-wins tables sorted, the mean bales, the turn of the first loss, and the run time; keep it under 60 s.
- [ ] **Step 2: Run** `npm run bot:hay-bale`. A first run failing a gate is expected.
- [ ] **Step 3: Tune**, in the spec's order: `GHOST_ACORNS`, then unit stats, then ability numbers; `WEIGHT` may change freely (it is the policy, not the game). Rerun `npm run test:hay-bale` after each change and update any test that pinned a tuned number. Ledger each tuned value as a `Ruling:`; any change to a spec number is also written into the spec's tables in this commit.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's bot and tune the roster`, with the final rates in the body.

---

### Task 6: The scene, the page, sound and saving

**Files:**
- Create: `lib/hay-bale-scene.ts`, `app/brawl/page.tsx`, `app/brawl/brawl.css`, `tests/e2e/brawl.mjs`
- Modify: `package.json` (`test:e2e:brawl`)

**Interfaces:**
- Consumes: Tasks 1–4; `makeSound` (`lib/cue-sound.ts`); `drawChinchilla` (`lib/chinchilla-art.ts`) for Pip, the Duchess and the coaches.
- Produces:
  - `const STAGE = { w: 480, h: 320 }`; `type Box = { x: number; y: number; w: number; h: number }`; `const LAYOUT: { line: Box[]; units: Box[]; snacks: Box[]; sell: Box; rival: Box[] }` — the hit boxes the page tests pointer positions against (`units` long enough for a bonus slot).
  - `drawShop(c: CanvasRenderingContext2D, run: Run, ui: { held: { from: 'line' | 'unit' | 'snack'; i: number } | null; x: number; y: number; hover: Box | null }, now: number): void`.
  - `type Replay = { outcome: Outcome; i: number; t: number; speed: 1 | 2 }`; `stepReplay(r: Replay, dt: number): boolean` (advance; `false` when done, at about 0.35 s per event, halved at ×2) and `drawFight(c, r: Replay, now: number): void` (the two lines, hit flashes, damage numbers, faint puffs, ability callouts, the crew name, the result card).
  - `drawCritter(c, id: UnitId | TokenId, box: Box, facing: 1 | -1): void` — the code-drawn fallback for every unit and token from a shared round-body shape with per-id colours, ears and tail; chinchillas through `drawChinchilla`.
  - `window.__brawl()` → `{ run: Run | null; profile: Profile; replay: Replay | null; start(coach: Coach, seed?: number): void; set(patch: { line?: (Unit | null)[]; units?: (Slot | null)[]; snacks?: (Slot | null)[]; acorns?: number }): void; stage(): Box }`.
  - `main[data-ready="true"]` after hydration and `data-screen` on `main` (`title | shop | fight | over | almanac`). Test ids: `start-dora`, `start-enzo`, `continue`, `almanac`, `back`, `roll`, `freeze`, `end-turn`, `speed`, `skip`, `next`, `mute`, `stage`.
- Decisions:
  - Input: pointer events on the canvas with `setPointerCapture`, `pointerup`/`pointercancel` also on `document`; stage coordinates from `getBoundingClientRect()` at each event. A press on an item and a release on a target over 8 units away is a drag; a press and release on the same item selects it (tap-tap), and a later tap on a target applies it; tapping the selected item again, or anywhere not a target, clears the selection. Keys per the spec.
  - Unit card: hovering (mouse) or selecting (touch) a unit in the line or shop shows its card on the stage: name, stats, level and experience pips, status, and the ability line for its level from `text`.
  - Order of an end turn: `run.endTurn()`, save, then start the replay. Skip jumps to the result card. Leaving the page mid-replay loses nothing.
  - Saving: after every successful action and every end turn, `localStorage.setItem('hay-bale-run-v1', JSON.stringify(run))`; at `over`/`won`, `record` into `hay-bale-v1` and remove the run save. Every storage call in `try/catch`.
  - Sound cues: `buy`, `sell`, `merge`, `level`, `roll`, `hit`, `faint`, `ability`, `win`, `loss`.
  - Loop: `requestAnimationFrame`, `dt` capped at 100 ms, paused while `document.hidden`.
  - Canvas fitted to the largest 3:2 box above the button row, backing store × `devicePixelRatio`; no page scroll at 390 × 844 or 1280 × 860.

- [ ] **Step 1: Write the failing e2e test** `tests/e2e/brawl.mjs` in the shape of `tests/e2e/whisker-ware.mjs` (`check`, `fresh`, a stage-coordinate click helper using `LAYOUT` boxes read through `__brawl()`). Checks:
  - the title on a fresh profile has no Continue; `start-dora` opens the shop with 10 acorns;
  - buy by drag (shop unit → line slot 0) → 7 acorns, the line has the unit;
  - buy by tap-tap; merge by tapping a copy onto a copy; sell by drag to the bin;
  - **a drag dropped on the shop, outside the canvas, and a `pointercancel`** each leave acorns and the line unchanged;
  - freeze then roll keeps the frozen unit; Enzo's first roll leaves acorns at 10;
  - end turn → `data-screen="fight"`, events replay, Skip shows the result, `next` returns to the shop on turn 2;
  - **reload during the replay** → Continue opens turn 2 with exactly one bale or heart changed from turn 1;
  - a won run through `set` (a level-3 line of Boars) records into the profile and removes the run save; Continue is gone;
  - the Almanac lists 30 units and 8 snacks;
  - the stage fits with no scroll at 390 × 844 and 1280 × 860; mute persists across a reload; no page errors.
- [ ] **Step 2: Run** with `npm run dev` up: `node tests/e2e/brawl.mjs` → FAIL (404 / no `data-ready`).
- [ ] **Step 3: Implement** the scene and the page.
- [ ] **Step 4: Run** `node tests/e2e/brawl.mjs` → PASS; `npm run typecheck` → clean. Screenshot the shop, a mid-fight frame, the result card and the Almanac into `.checks/brawl/` and check them by eye: every critter tells apart at a glance, stats readable on a phone, the drag ghost visible.
- [ ] **Step 5: Commit** `Add Hay Bale Brawl's scene and page`.

---

### Task 7: Into the arcade

**Files:**
- Modify: `app/page.tsx` (`GAMES`, counts), `app/layout.tsx`, `README.md`, `tests/readme.mjs`, the e2e files named in the README **Adding a game** checklist, `tests/e2e/panel-contrast.mjs`, `package.json` (`test:e2e` chain), `CHANGELOG.md`, `HANDOFF.md`, `CLAUDE.md` (its game count)
- Create: `docs/hay-bale-brawl.md`

- [ ] **Step 1: Add the `GAMES` card** after Whisker Ware: `{href:'/brawl',title:'Hay Bale Brawl',tag:'NEW · AUTO-BATTLER',blurb:'Buy a crew of woodland critters, line them up on the hay bale and watch them brawl: merge copies, feed them snacks, and win ten fights before you lose five hearts.',color:'#d9a441',art:'🌾'}`, and drop `NEW · ` from Whisker Ware's tag only if the current cards show a single `NEW` (look and follow them). Run `npm test` → FAIL in `tests/readme.mjs`.
- [ ] **Step 2: Follow the checklist** in `README.md` **Adding a game** in full: thirty-five → thirty-six and 35 → 36 everywhere it lists (the checklist's own wording still says thirty-four; correct it to the new count while there), the next number word in `tests/readme.mjs`, the README row `| 36 | Hay Bale Brawl | \`/brawl\` | Auto-battler |`, and a `### 36 · Hay Bale Brawl (\`/brawl\`)` guide with **Play**, **Controls**, **Tests** and **Docs** written from the code.
- [ ] **Step 3: Write `docs/hay-bale-brawl.md`**: the run, coaches, the shop, the fight rules (including the rules decided in Task 2), the 30 units and 8 snacks with their final numbers, rivals, saving, the bot's gates and final rates, and the code-drawn art.
- [ ] **Step 4: Run** `npm test` → PASS; `npm run typecheck`; `npm run build` → PASS; with `npm run dev` up, `node tests/e2e/brawl.mjs`, `node tests/e2e/arcade-navigation.mjs`, `node tests/e2e/panel-contrast.mjs` and `node tests/e2e/dust-bath.mjs` → PASS. Add `npm run test:e2e:brawl` to the `test:e2e` chain.
- [ ] **Step 5: CHANGELOG and HANDOFF.** CHANGELOG **Added**: "**Hay Bale Brawl**: the arcade's 36th game, an auto-battler. Pick Dora or Enzo as coach, buy a crew of thirty woodland critters, merge copies to level them up, feed them snacks, and watch them brawl rival crews on a hay bale. Win ten fights before you lose five hearts." HANDOFF: a Hay Bale Brawl section (code, saves, balance, checks, not done: painted art and play-testing by hand) and next-step items updated.
- [ ] **Step 6: Commit** `Add Hay Bale Brawl to the arcade`.
