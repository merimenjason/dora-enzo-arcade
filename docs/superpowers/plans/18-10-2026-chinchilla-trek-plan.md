# Chinchilla Trek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Chinchilla Trek, the arcade's 37th game: a Capybara Go!-style roguelite where Dora or Enzo walks a 30-day trek. Each day brings an event. Level-ups offer skill picks, fights resolve on their own, the Owl and the Fox wait at a crossroads, and camp between treks holds training and gear that merges up in rarity.

**Architecture:**
- **Data:** pure data lives in `lib/chinchilla-trek-data.ts`: skills, evolutions, foes, chapters, story scenes, gear tables and tuning numbers.
- **Engine:** `lib/chinchilla-trek-game.ts` holds `Rand`, the hero's stats, a deterministic `fight` that returns an event list, the `Trek` state machine, camp and the profile, and the bot policy.
- **Scene and page:** a Canvas 2D scene draws a 480 × 320 stage (the path, the walker and the fight replay). Event text, choices, skill cards and camp are DOM under the stage, in `app/trek/page.tsx`.

**Tech Stack:**
- TypeScript, and React through a Next/vinext client page.
- Canvas 2D, with WebAudio sound through `lib/cue-sound.ts`.
- Node `assert` tests, compiled with `tsc` into `.checks/`.
- Playwright for the browser tests.

**Spec:** [`docs/superpowers/specs/18-10-2026-chinchilla-trek-design.md`](../specs/18-10-2026-chinchilla-trek-design.md). Every number in this plan comes from the spec: skill values, weights, fixed days, base stats and caps. Where a step says "per the spec", copy the value from there.

## Global Constraints

- **Branch and staging:** work on branch `feat/chinchilla-trek`; pushing to `main` deploys. Never stage `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`. Stage files by name, and check `git branch --show-current` before every commit.
- **Commit messages** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Imports:** engine files import their siblings with a `.js` extension (`import { SKILLS } from './chinchilla-trek-data.js'`).
- **Randomness:** engines have no DOM and no `Math.random`. Every random choice comes from the seeded `Rand`, copied from `lib/hay-bale-game.ts:12`.
- **Names:** the route is `/trek`. The save keys are `chinchilla-trek-run-v1`, `chinchilla-trek-v1` and `chinchilla-trek-sound-v1`. The stage is 480 × 320.
- **Trek rules:**
  - A trek is 30 days. The fixed days are 10 (elite), 15 (crossroads), 20 (elite), 25 (pedlar) and 30 (boss), and day 1 is always a fight.
  - The hero's base is 100 HP, 10 attack, 5% crit and 0% dodge; a crit deals ×2.
  - A level-up heals 20% of max HP. Skills go up to level 3, and each trek allows one reroll.
  - A fight ends at the 40-round cap. Damage is at least 1.
- **Scripts:** add `test:trek`, `bot:trek` and `test:e2e:trek`, shaped like `test:hay-bale` and `bot:hay-bale`: `tsc lib/chinchilla-trek-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck && node …`.
- **Formatting:** don't run `oxfmt`. Match the hand-formatted style of `lib/hay-bale-game.ts`.
- **Docs:** Markdown dates are dd-mm-yyyy. Every user-visible change gets a CHANGELOG entry under the day's `## DD-MM-YYYY`.
- **Playwright and scratch files:** install Playwright with `npm i -D playwright`, and never commit that change. Scratch files go in `.checks/` and are deleted afterwards.
- **Balance:** rerun `npm run bot:trek` after any balance change.
- **Tone:** foes are never hurt. They are "knocked out", tumble over and scamper off. No copy says kill, die, blood or steal.

## Review Focus

1. **Reloading during a fight's replay** must not replay the fight or lose it. `Trek.next()` resolves the fight and applies HP, experience and acorns, and the page saves before the replay starts, so Continue lands after the fight with each change counted exactly once. Task 6's e2e pins this.
2. **Level-ups that stack.** One fight can give two levels, and it must give two picks in a row, with none lost. If fewer than three skills can be offered, the offer shows only those. If none can, the single card is **Rest** (heal 30%). Task 3's test `stacked level-ups and an empty pool` pins this.
3. **Who falls first.** Hits resolve one at a time, and the fight checks for a knock-out after every hit, including counters, reflects, zaps and burn. If the foe drops first, the hero wins, even when the hero falls later in the same turn. Second Wind fires at the moment the hero hits 0. Task 2's test `knock-outs are checked after every hit` pins this.
4. **The Fox's price** lowers max HP. Current HP is clamped to the new max, never below 1, so a bargain can't end the trek. Task 3's test `the fox cannot knock you out` pins this.
5. **Illegal actions change nothing:**
   - choosing an index that's out of range;
   - picking while no offer is open;
   - a second reroll;
   - buying from the pedlar without enough acorns;
   - `next()` while a choice is pending;
   - training without enough acorns;
   - merging fewer than three pieces.

   Each returns `false` (or `null`), and `JSON.stringify` stays unchanged. Tasks 3 and 4 pin this.

---

### Task 1: The data

**Files:**
- Create: `lib/chinchilla-trek-data.ts`, `lib/chinchilla-trek-game.ts` (only `Rand`, `mix` and re-exports for now), `tests/chinchilla-trek.mjs`
- Modify: `package.json`. Add `test:trek`, add `lib/chinchilla-trek-game.ts` to the `tsc` list of `test`, and add `tests/chinchilla-trek.mjs` to its `node` list.

**Interfaces:**
- Produces, in `lib/chinchilla-trek-data.ts`:
  - **Basic types:**
    - `type Hero = 'dora' | 'enzo'`, `type Level = 1 | 2 | 3`, `type ChapterNo = 1 | 2 | 3 | 4 | 5`.
    - `type SkillId`: the 18 ids, in spec order.
    - `type EvoId = 'storm' | 'fury' | 'bramble' | 'feast'`.
  - **Skills:**
    - `const SKILLS: Record<SkillId, { id: SkillId; name: string; v: [number, number, number]; text: [string, string, string] }>`. `v` holds the spec's numbers as fractions or multipliers: `combo: [0.2, 0.35, 0.5]`, `pounce: [2, 3, 4]`, `static: [0.5, 0.8, 1.2]`. `static`'s 25% proc chance is the constant `ZAP_CHANCE = 0.25`.
    - `const SKILL_IDS: SkillId[]`.
    - `const EVOS: Record<EvoId, { id: EvoId; name: string; from: [SkillId, SkillId]; text: string }>` and `const EVO_IDS: EvoId[]`.
  - **Foes:**
    - `type Trait = 'sting' | 'shell' | 'chill' | 'swift' | 'double' | 'regen' | 'rage'`.
      - `sting`: its first hit adds a burn of 10% of its attack per round.
      - `shell`: the first hit it takes is halved.
      - `chill`: every 4th turn its hit freezes the hero.
      - `swift`: 15% dodge.
      - `double`: every 3rd turn it attacks twice.
      - `regen`: it heals 5% of its max HP each round.
      - `rage`: below half HP it gets +50% attack.
    - `type FoeId`: 30 ids, as below.
    - `const FOES: Record<FoeId, { id: FoeId; name: string; chapter: ChapterNo; rank: 'foe' | 'elite' | 'boss'; hp: number; atk: number; trait: Trait | null }>`.
    - The foe ids, by chapter:
      - 1: `beetle mice toad wasp hedgepig kingmole`
      - 2: `magpie stoat sprite piglet raccoon badger`
      - 3: `crab heron pike vole turtle otter`
      - 4: `snowhare ptarmigan goatkid imp pika foxqueen`
      - 5: `bat moth wisp owlet shadowcat hornedowl`

      In each list, the first four are foes, the fifth is the elite and the sixth is the boss.
    - **Base stats by rank:** foe 40 HP / 6 attack, elite 90 / 8, boss 180 / 11. Each foe varies its rank's base by up to ±20%; that's the implementer's call, tuned in Task 5.
    - **Traits:**
      - every elite and boss has one: `hedgepig shell`, `kingmole rage`, `raccoon double`, `badger rage`, `turtle shell`, `otter double`, `pika swift`, `foxqueen chill`, `shadowcat swift`, `hornedowl regen`;
      - spec-fixed foes: `wasp sting`;
      - every other foe gets the trait the implementer picks, or null.
  - **Chapters:** `const CHAPTERS: { no: ChapterNo; name: string; foes: FoeId[]; elite: FoeId; boss: FoeId }[]` (names per the spec).
  - **Days:**
    - `const FIXED_DAYS = { 10: 'elite', 15: 'crossroads', 20: 'elite', 25: 'pedlar', 30: 'boss' } as const`.
    - `const DAY_WEIGHTS = { fight: 40, story: 20, cache: 12, find: 10, rest: 8, wheel: 5, pedlar: 5 }`.
  - **Story effects and scenes:**
    - `type Effect = { k: 'heal' | 'hurt'; pct: number } | { k: 'acorns'; n: number } | { k: 'stat'; stat: 'atk' | 'hp' | 'crit' | 'dodge'; v: number } | { k: 'cache' } | { k: 'later'; scene: string; days: number }`. `hurt` never takes HP below 1. `later` queues the follow-up scene `days` days on, replacing that day's rolled event; if that day is a fixed day, the follow-up comes the next day instead.
    - `type Choice = { label: string; odds?: number; win: Effect[]; winText: string; lose?: Effect[]; loseText?: string }`.
    - `type Scene = { id: string; chapter: ChapterNo | 0; text: string; choices: [Choice, Choice]; followUp?: boolean }`. A `followUp` scene is never rolled; it only comes from `later`. `{other}` in text is replaced by the other chinchilla's name.
    - `const SCENES: Scene[]`: at least 20 rollable scenes plus their follow-ups, including the spec's four examples. At least 2 scenes belong to each chapter, and at least 8 have `chapter: 0`. Choice labels say what they risk ("Eat it (50/50)").
  - **Gear:**
    - `type GearSlot = 'hat' | 'scarf' | 'charm' | 'boots'`, `type Rarity = 0 | 1 | 2 | 3 | 4`, `const RARITY = ['Plain', 'Fine', 'Rare', 'Grand', 'Legend']`.
    - `const GEAR_STAT: Record<GearSlot, [number, number, number, number, number]>`:
      - hat, max HP: `[10, 20, 35, 55, 80]`;
      - scarf, attack: `[1, 2, 4, 6, 9]`;
      - charm, crit: `[0.02, 0.04, 0.06, 0.09, 0.12]`;
      - boots, dodge: `[0.01, 0.02, 0.04, 0.06, 0.08]`.
  - **Tuning numbers** (Task 5 owns them):
    - `CHAPTER_SCALE = [1, 1.8, 3.1, 5, 8]` (indexed by chapter − 1), `DAY_SCALE = 0.04`;
    - `xpNeed(level: number): number` (start with `3 + level`), `FIGHT_XP = { foe: 2, elite: 6, boss: 0 }`;
    - `FIGHT_ACORNS = { foe: 3, elite: 12, boss: 30 }` (× chapter);
    - `PEDLAR_PRICE = { snack: 15, card: 25, charm: 30 }` (× chapter);
    - training: `trainCost(level: number): number` (start with `20 + 10 × level`), `TRAIN_STEP = { atk: 1, hp: 10 }`.
- Produces, in `lib/chinchilla-trek-game.ts`: `class Rand` (Hay Bale Brawl's), `mix(a: number, b: number): number` (Hay Bale Brawl's), and `export * from './chinchilla-trek-data.js'`.

- [ ] **Step 1: Write the failing tests** in `tests/chinchilla-trek.mjs`, importing from `../.checks/chinchilla-trek-game.js`:
  - `data: 18 skills and 4 evolutions` (each evolution's `from` names two distinct skills, and no skill is in two evolutions);
  - `data: skill values match the spec` (a `[id, v]` table copied from the spec);
  - `data: 5 chapters, each with 4 foes, an elite and a boss of the right rank and chapter`;
  - `data: elites and bosses all have traits`;
  - `data: scenes` (at least 20 rollable, at least 2 per chapter, at least 8 general; every `later` names an existing follow-up scene; every `odds` lies between 0 and 1 and comes with `lose`; no text contains `kill`, `die`, `dead`, `blood` or `steal`);
  - `data: day weights sum to 100`.
- [ ] **Step 2: Run** `npm run test:trek`. Expected: FAIL, because `.checks/chinchilla-trek-game.js` doesn't exist.
- [ ] **Step 3: Implement** the data, and write the scenes in the arcade's gentle, slightly silly voice.
- [ ] **Step 4: Run** `npm run test:trek`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's data`.

---

### Task 2: Stats and the fight

**Files:**
- Modify: `lib/chinchilla-trek-game.ts`, `tests/chinchilla-trek.mjs`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `type Stats = { hp: number; atk: number; crit: number; dodge: number }`, where `hp` is max HP.
  - `type Kit = { skills: Partial<Record<SkillId, Level>>; evos: EvoId[]; bonus: Stats }`. `bonus` holds the trek-long buffs from events, the pedlar and the Fox: `atk` and `hp` as fractions, `crit` and `dodge` as amounts.
  - `const BASE: Stats = { hp: 100, atk: 10, crit: 0.05, dodge: 0 }`.
  - `heroStats(base: Stats, hero: Hero, kit: Kit): Stats`. The order is: base, then the hero perk (Dora +10% HP, Enzo +10% attack), then Sharp, Extra Fluff and the bonus fractions (each multiplies), then Keen, Dust Cloud and the bonus amounts (each adds). Attack and HP are rounded. Crit is capped at 0.9 and dodge at 0.6.
  - `type Side = 0 | 1`. Side 0 is the hero.
  - `type FightEvent`, one of:
    - `{ k: 'attack'; side: Side }`;
    - `{ k: 'hit'; side: Side; dmg: number; hp: number; crit: boolean; src: 'attack' | 'combo' | 'counter' | 'zap' | 'burn' | 'reflect' | 'roll' }`, where `side` is the one hit and `hp` its new HP;
    - `{ k: 'dodge'; side: Side }`;
    - `{ k: 'shield'; n: number }`, the hero's shield total;
    - `{ k: 'freeze'; side: Side }`;
    - `{ k: 'heal'; side: Side; n: number; hp: number }`;
    - `{ k: 'skill'; id: SkillId | EvoId }`, a callout when a skill fires;
    - `{ k: 'wind'; hp: number }`;
    - `{ k: 'end'; result: 'win' | 'loss' | 'stall' }`.
  - `type FightIn = { stats: Stats; hp: number; kit: Kit; foe: FoeId; chapter: ChapterNo; day: number; seed: number; wind: boolean }`, where `wind` means Second Wind is still unused.
  - `type FightOut = { result: 'win' | 'loss' | 'stall'; events: FightEvent[]; rounds: number; hp: number; windUsed: boolean; foeHp: number; foeAtk: number }`.
  - `foeStats(foe: FoeId, chapter: ChapterNo, day: number): { hp: number; atk: number }` is `round(base × CHAPTER_SCALE[chapter − 1] × (1 + DAY_SCALE × day))`.
  - `fight(input: FightIn): FightOut`. It is pure and never mutates `input`.
- Rules decided here (the spec has the rest):
  - **Start of fight:** the shield is set (Shell or Bramble), then Dust Roll hits.
  - **Each round:**
    - The hero's turn, unless the hero is frozen. One attack, then Combo (at most one extra attack, or two with Thunder Combo). Each attack can crit, zap (Static, with chance `ZAP_CHANCE`) and freeze (Frost), and adds Pepper burn stacks (at most 5).
    - The foe's turn, unless the foe is frozen. One attack (the `double` trait adds one), each followed by the hero's Counter roll.
    - End of round: the burn deals its damage, then Power Nap, Bramble's refill, Feast and the foe's `regen` heal.
  - **Damage:**
    - Pounce multiplies the hero's first attack.
    - Grit and Fury apply on each attack.
    - Dodge cancels a whole attack, with no zap or counter.
    - A hit on the hero goes into the shield first.
    - Prickles reflects its share of the hit's amount before the shield, at least 1; reflected damage can't be reflected again.
    - Snack Break and Feast heal from the damage the hero deals.
    - Counters and reflects can't trigger Combo or Counter.
    - Every hit deals at least 1.
  - **Knock-outs and the cap:**
    - After every `hit` event, the fight checks both sides. If the foe is at 0, the hero wins at once. If the hero is at 0 and `wind` is set, Second Wind fires once: a `wind` event, and HP goes to its share of max HP. Otherwise the hero has lost.
    - After 40 rounds the fight ends in a `stall`.
  - The foe's trait counters (the 4th turn for `chill`, the 3rd for `double`) count the foe's own turns.

- [ ] **Step 1: Write the failing tests.** A helper `kit(skills = {}, evos = [])` makes a `Kit` with a zero bonus. Seeds are chosen to show each proc. Tests:
  - `stats: dora and enzo perks, sharp, fluff, keen, dust and caps`.
  - `foe stats scale by chapter and day` (`foeStats('beetle', 1, 0)` against the base; chapter 3 on day 10 is `base × 3.1 × 1.4`, rounded).
  - One test per skill, at level 1 and level 3, each with a hand-built fight that asserts on the events. For example:
    - `pounce triples the first attack at level 2`;
    - `combo never attacks more than twice in a turn`;
    - `counter does not counter a counter`;
    - `shell absorbs before hp`;
    - `prickles reflects at least 1 and never twice`;
    - `pepper stacks to 5`;
    - `frost skips the foe's next turn`;
    - `power nap never heals above max`;
    - `second wind fires once`.
  - One test per evolution.
  - One test per trait: `wasp stings once`; `shell halves the first hit`; `chill freezes on the 4th turn`; `double attacks twice every 3rd turn`; `regen heals each round`; `rage below half`; `swift dodges`.
  - **`knock-outs are checked after every hit`:**
    - a counter that knocks out the foe ends the fight as a `win`, with no later events;
    - a hero at 1 HP whose zap knocks out the foe still wins;
    - a burn that knocks out the foe at the end of a round wins.
  - `40 rounds is a stall` (a 1-attack hero with Feast against a `regen` boss).
  - `same input, same events`, and `fight leaves its input untouched`.
  - `1000 random fights end and the events agree with the result` (the last `hit` event's `hp` matches `hp`, and `end` is last).
- [ ] **Step 2: Run** `npm run test:trek`. Expected: FAIL with `fight is not a function`.
- [ ] **Step 3: Implement** `heroStats`, `foeStats` and `fight`.
- [ ] **Step 4: Run** `npm run test:trek`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's fights`.

---

### Task 3: The trek

**Files:**
- Modify: `lib/chinchilla-trek-game.ts`, `tests/chinchilla-trek.mjs`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `type Ware = { k: 'snack' } | { k: 'card' } | { k: 'charm'; stat: 'atk' | 'hp' | 'crit' }`. Each ware's price is the spec's `PEDLAR_PRICE` × the chapter. The charm's stat is rolled per visit, with values +8% attack, +10% max HP or +5% crit.
  - `type DayEvent`, one of:
    - `{ k: 'fight'; foe: FoeId; rank: 'foe' | 'elite' | 'boss' }`;
    - `{ k: 'story'; scene: string }`;
    - `{ k: 'cache' }`;
    - `{ k: 'find'; what: 'acorns' | 'snack' | 'chest'; n: number }`;
    - `{ k: 'rest' }`;
    - `{ k: 'wheel'; prize?: number }`;
    - `{ k: 'pedlar'; stock: Ware[]; sold: boolean[] }`;
    - `{ k: 'crossroads' }`;
    - `{ k: 'visit'; who: 'owl' | 'fox' }`.
  - `type Card = { k: 'skill'; id: SkillId; level: Level } | { k: 'evo'; id: EvoId } | { k: 'rest' }`.
  - `type Phase = 'walk' | 'event' | 'pick' | 'over' | 'cleared'`.
  - `class Trek`:
    - **The constructor:** `constructor(seed: number, hero: Hero, chapter: ChapterNo, base: Stats)`. `base` is the camp's stats at set-off, a snapshot. The hero starts at day 0, at full HP, at level 1, with its starting skill at level 1 (Dora `shell`, Enzo `combo`).
    - **Fields:** `seed`, `hero`, `chapter`, `base`, `day`, `hp`, `level`, `xp`, `kit: Kit`, `acorns`, `windUsed`, `rerolled`, `phase`, `today: DayEvent | null`, `offer: Card[] | null`, `picks: number` (level-ups still to pick), `after: DayEvent | null` (the visit that follows an elite's picks), `last: { foe: FoeId; out: FightOut } | null`, `note: string` (the outcome text for the page), `later: { day: number; scene: string }[]`, `seen: { skills: string[]; foes: FoeId[] }`, `rand: Rand`, `prev: DayEvent['k'] | null`.
    - **Methods:**
      - `stats(): Stats`;
      - `next(): DayEvent | null`, which is legal only in `walk`;
      - `choose(i: number): boolean`, where `-1` means walk on;
      - `pickSkill(i: number): boolean`;
      - `reroll(): boolean`;
      - `buy(i: number): boolean`;
      - `toJSON(): object`, and `static load(raw: string | null): Trek | null`.
  - `rollDay(t: Trek): DayEvent`.
- Rules decided here:
  - **`next()`** advances the day and sets `today`:
    1. A due `later` scene comes first.
    2. Then the fixed day.
    3. Otherwise the event is drawn from `DAY_WEIGHTS`. It is redrawn when it matches `prev`, and day 1 is always a fight.
  - **Events that resolve at once:**
    - **Fights:**
      - The fight runs with seed `mix(seed, day)` and its result is applied: HP, Second Wind, experience, acorns (× Lucky Paw), and the foe added to `seen`.
      - Level-ups add to `picks`. Each heals 20% of max HP, applied in order.
      - A `loss` sets phase `over`. A boss `win` sets phase `cleared`, and its level-ups are not offered.
      - After an elite `win`, `after` becomes a `visit` from the Owl or the Fox, chosen by `rand`.
    - **Finds:** acorns give `n = 5 × chapter`. A snack heals 20%. A chest gives `n = 15 × chapter` acorns.
    - **Rests** heal 30%.
  - Story, wheel, pedlar, crossroads and visit set phase `event`.
  - A cache sets `picks = 1`.
  - **Picks:**
    - Whenever `picks > 0`, the phase is `pick` and `offer` holds three distinct cards, drawn from skills not yet at level 3 and evolutions that are ready.
    - The offer shows fewer cards when fewer can be drawn, and `[{ k: 'rest' }]` when none can.
    - After the last pick, the phase is `event` if `after` is set (`today = after`), and `walk` otherwise.
  - **Evolutions:** picking an evolution removes both halves from `kit.skills` and adds the evolution to `kit.evos`. The evolution keeps both halves' effects at level 3.
  - **Story:** `choose` rolls `odds` with `rand`, applies `win` or `lose`, and sets `note` to the outcome text. A `cache` effect opens a pick.
  - **Wheel:** `choose(0)` spins and `choose(-1)` walks on. It has 8 equal segments:
    - small acorns (`3 × chapter`), three times;
    - big acorns (`12 × chapter`);
    - heal 25%;
    - a skill pick;
    - +5% attack;
    - −10% HP.

    With Lucky Paw, the HP segment gives big acorns instead.
  - **Crossroads:** `choose(0)` is the Owl's heal to full; `choose(1)` is the Owl's +1 level on a random skill below level 3. `choose(2)` is the Fox: two random skills not yet held, each added at level 2, for `bonus.hp −= 0.2`. `choose(-1)` walks on.
  - **Visits** offer half:
    - **Owl:** `choose(0)` heals 50%.
    - **Fox:** `choose(0)` adds one skill at level 2 for `bonus.hp −= 0.1`.
  - **Max HP changes:** whenever max HP drops, `hp = max(1, min(hp, stats().hp))`. When Extra Fluff raises max HP, current HP rises by the same amount.
  - **Pedlar:** `buy(i)` spends trek acorns. A snack heals 40%, a card opens a pick, and a charm adds to `bonus`. Each ware can be bought once, and `choose(-1)` leaves.
  - **Reroll:** `reroll()` is allowed once per trek while in `pick`. It redraws the whole offer.
  - **Illegal calls** return `false` (or `null` for `next`) and change nothing.
  - **Saving:**
    - `toJSON` writes `v: 1` and everything above, including `rand.s` and `last` without its events.
    - `load` returns `null` for anything malformed: unknown ids, a day outside 0–30, HP above max, a negative count, or a `phase` that disagrees with `offer` or `today`.

- [ ] **Step 1: Write the failing tests.** A helper `walk(t, policy)` repeats `next` and answers with `policy` until the phase is `over` or `cleared`. Tests:
  - `a new trek`: day 0, full HP, level 1, and the hero's starting skill.
  - `day 1 is a fight, and the fixed days fall on 10, 15, 20, 25 and 30`, over 50 seeds.
  - `no event repeats on consecutive days`, over 50 seeds.
  - `fights apply hp, experience and acorns once`.
  - `stacked level-ups and an empty pool`. Force two levels and see two picks in a row, each healing 20%. With every skill at level 3 and no evolution ready, the offer is `[{ k: 'rest' }]`.
  - `evolutions are offered only when both halves are at level 3, and replace them`.
  - `one reroll per trek`.
  - Crossroads: `the owl heals or levels a skill`; `the fox gives two level-2 skills for 20% max hp`.
  - `the fox cannot knock you out` (at 5 HP of 100, after the Fox, `hp` is at least 1).
  - `an elite win brings a visit after the picks`.
  - `story: odds, effects, follow-ups` (the freed bird returns on its day; a follow-up due on a fixed day comes the next day).
  - `wheel segments`, and `lucky paw turns the hp segment into acorns`.
  - `pedlar: buying, prices by chapter, one of each`.
  - `a lost fight ends the trek; the boss clears it`.
  - `illegal actions change nothing`:
    - `choose(7)`;
    - `pickSkill(0)` while in `walk`;
    - a second `reroll`;
    - `buy` without enough acorns;
    - `next()` while in `event` or `pick`;
    - any action after `over`.

    Each returns `false` or `null`, and `JSON.stringify(t)` is unchanged.
  - `same seed and choices, same trek`.
  - `save round-trips`: `Trek.load(JSON.stringify(t))` plays on identically from day 0, from mid-pick and from mid-event.
  - `malformed saves load as null`, for `null`, `'x'`, `{"v":2}`, an unknown skill, `day: 31`, `hp` above max, `picks: -1`, and `phase: 'pick'` with `offer: null`.
- [ ] **Step 2: Run** `npm run test:trek`. Expected: FAIL with `Trek is not a constructor`.
- [ ] **Step 3: Implement** `Trek` and `rollDay`.
- [ ] **Step 4: Run** `npm run test:trek`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's trek`.

---

### Task 4: Camp, the profile and the bot policy

**Files:**
- Modify: `lib/chinchilla-trek-game.ts`, `tests/chinchilla-trek.mjs`

**Interfaces:**
- Consumes: Task 3.
- Produces:
  - `type Piece = { uid: number; slot: GearSlot; r: Rarity }`.
  - `type Profile = { v: 1; acorns: number; training: { atk: number; hp: number }; gear: Piece[]; worn: Partial<Record<GearSlot, number>>; unlocked: ChapterNo; best: [number, number, number, number, number]; seen: { skills: string[]; foes: FoeId[] }; next: number; last: number }`. `best` is the best day per chapter, with 31 meaning cleared. `next` is the next gear uid. `last` is the seed of the last trek recorded.
  - Profile basics: `freshProfile(): Profile` and `loadProfile(raw: string | null): Profile`. A malformed profile loads fresh, and unknown ids and pieces are dropped.
  - `campStats(p: Profile): Stats` is `BASE` plus training plus the worn gear.
  - Camp actions:
    - `train(p: Profile, which: 'atk' | 'hp'): Profile | null`. The cost is `trainCost(level)`; it returns `null` when there aren't enough acorns.
    - `merge(p: Profile, slot: GearSlot, r: Rarity): Profile | null`. Three pieces of that slot and rarity, below Legend, become one of the next rarity, and the result is worn when it beats the worn piece. It returns `null` otherwise.
    - `wear(p: Profile, uid: number): Profile | null`.
  - `type Chest = { acorns: number; pieces: Piece[] }`.
  - `record(p: Profile, t: Trek): { profile: Profile; chest: Chest | null }`. It is pure, and does nothing unless the phase is `over` or `cleared`, or when `p.last === t.seed`. On a recorded trek, the profile:
    - adds `t.acorns` plus the chest's acorns;
    - adds 1 piece, or 2 on a clear, each worn when it beats the worn one;
    - unlocks the next chapter on a clear;
    - updates `best` and `seen`.
  - Chest rules:
    - The rarity weights start at Plain 60, Fine 30, Rare 9, Grand 1, Legend 0.
    - Each chapter above 1, and each 10 days reached, moves 8 points from the lowest rarity that still has weight to the next one up.
    - Legend is possible only from chapter 4.
    - A first clear of a chapter makes one piece at least Rare.
    - The chest's acorns are `2 × chapter × day reached`.
    - The chest draws from `new Rand(mix(t.seed, 999))`.
  - The bot policy:
    - `SKILL_WEIGHT: Record<SkillId, number>` and `decide(t: Trek): { k: 'next' } | { k: 'choose'; i: number } | { k: 'pick'; i: number } | { k: 'reroll' } | { k: 'buy'; i: number }`.
    - **Picks:** the card with the highest `SKILL_WEIGHT`, with +50 if it finishes an evolution's half at level 3, and evolutions at 100. Reroll when the best card is below 20 and the reroll is unused.
    - **Story:** the choice without `odds` below 40% HP, and the one with `odds` above it.
    - **Crossroads:** the Owl's heal below 50% HP, otherwise the Fox.
    - **Pedlar:** the snack below 50% HP, otherwise the charm if affordable, then the card.
    - **Wheel:** always spin.
  - `playTrek(t: Trek, policy?: (t: Trek) => ReturnType<typeof decide>): Trek` applies the policy (by default `decide`) until the trek is over or cleared, with a 500-step cap.
  - `campStep(p: Profile): Profile` makes every legal merge, then trains whichever of attack and HP is cheaper, until nothing is affordable.

- [ ] **Step 1: Write the failing tests:**
  - `camp: a fresh profile` (chapter 1 unlocked, 0 acorns, nothing worn, `campStats` equals `BASE`);
  - `camp: training costs rise and need acorns`;
  - `camp: three pieces merge into one of the next rarity, and it is worn if better`;
  - `camp: legend pieces don't merge, two pieces don't merge`;
  - `record: acorns kept after a loss, pedlar spending excluded`;
  - `record: a clear unlocks the next chapter, gives two pieces, and the first clear gives a rare`;
  - `record: counts a trek once`;
  - `chest odds improve by chapter and day` (over 2000 chests, the mean rarity rises from chapter 1 day 5 to chapter 3 day 30; no Legend before chapter 4);
  - `profile: malformed saves load fresh` (for `null`, `'x'`, `{"v":2}`, `acorns: -1`, `unlocked: 6`, a piece with `r: 7`, a worn uid that isn't owned);
  - `the policy only takes legal actions` (100 seeded treks through `playTrek` never hit the step cap, and every action returns `true`);
  - `campStep never overspends`.
- [ ] **Step 2: Run** `npm run test:trek`. Expected: FAIL.
- [ ] **Step 3: Implement** the code. Start every `SKILL_WEIGHT` at 30.
- [ ] **Step 4: Run** `npm run test:trek`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's camp, profile and policy`.

---

### Task 5: The bot and the balance gates

**Files:**
- Create: `tests/chinchilla-trek-bot.mjs`
- Modify:
  - `package.json`: add `bot:trek`, and put the bot after `tests/chinchilla-trek.mjs` in the `node` list of `test`;
  - `lib/chinchilla-trek-data.ts` and `lib/chinchilla-trek-game.ts`, for tuning only.

- [ ] **Step 1: Write the bot.**
  - **Fresh treks:** seeds 1–300, each a chapter-1 trek from a fresh profile with the heroes alternating, played twice: once with `decide`, and once with a random policy that picks a random legal action.
  - **Campaigns:** 40 campaigns, each a fresh profile that loops: trek the highest unlocked chapter with `playTrek`, `record` it, then `campStep`, until chapter 5 is cleared or 200 treks have run.
  - **What it tracks:** clears, how often each skill was picked, evolutions reached in clears, the number of treks each campaign took, and how many fights stalled.
  - **Gates:**

```js
assert.ok(clear >= 0.25 && clear <= 0.55, `policy clears chapter 1 in ${clear}`);
assert.ok(clear - randomClear >= 0.20, `random clears ${randomClear}`);
assert.ok(median >= 15 && median <= 45, `median campaign ${median} treks`);
assert.ok(worst <= 90, `longest campaign ${worst} treks`);
for (const id of SKILL_IDS) assert.ok(picked[id] / treks >= 0.02, `${id} picked in ${picked[id]} treks`);
for (const id of EVO_IDS) assert.ok(evo[id] / clears >= 0.05, `${id} in ${evo[id]} of ${clears} clears`);
assert.ok(stalls / fights < 0.02, `${stalls} of ${fights} fights stalled`);
```

  Print the rates, the treks each chapter took, the mean level-ups per chapter (aim for about 12), the pick table and the run time. The whole bot runs in under 60 s.
- [ ] **Step 2: Run** `npm run bot:trek`. It is expected to fail a gate on the first run.
- [ ] **Step 3: Tune**, in the spec's order: `CHAPTER_SCALE`, `DAY_SCALE`, the foes' base stats, `xpNeed`, then the skill numbers.
  - `SKILL_WEIGHT`, `trainCost` and the chest odds may change freely, because they are the policy and the meta pace.
  - Rerun `npm run test:trek` after each change, and update any test that pinned a tuned number.
  - Ledger each tuned value as a `Ruling:`. When a change touches a number in the spec, write it into the spec in the same commit.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's bot and tune the treks`, with the final rates in the body.

---

### Task 6: The scene, the page, sound and saving

**Files:**
- Create: `lib/chinchilla-trek-scene.ts`, `app/trek/page.tsx`, `app/trek/trek.css`, `tests/e2e/trek.mjs`
- Modify: `package.json` (`test:e2e:trek`)

**Interfaces:**
- Consumes:
  - Tasks 1–4;
  - `makeSound` from `lib/cue-sound.ts`;
  - `drawChinchilla` from `lib/chinchilla-art.ts`;
  - the motion helpers `arc`, `backOut` and `smooth`, plus the `Pose` shape, all from `lib/hay-bale-motion.ts` (import them; don't copy them).
- Produces:
  - **Stage:** `const STAGE = { w: 480, h: 320 }`.
  - **Walking:** `drawWalk(c: CanvasRenderingContext2D, t: Trek, step: number, now: number, calm: boolean): void`. It draws the chapter's parallax path and the walker. `step` is the walk's progress, from 0 to 1, and the scenery scrolls only while `step < 1`.
  - **Fights:**
    - `type Replay = { foe: FoeId; out: FightOut; i: number; t: number; speed: 1 | 2 }`;
    - `stepReplay(r: Replay, dt: number): boolean` takes about 0.3 s per event, halved at ×2;
    - `drawFight(c, r: Replay, t: Trek, now: number, calm: boolean): void` draws the foe walking in, lunges, damage numbers, crits, zaps, dodges, the shield bubble, burn and frost marks, skill callouts and the foe tumbling off.
  - **Foes:** `drawFoe(c, id: FoeId, box, facing: -1 | 1, pose: Pose): void`. Every foe is code-drawn from a shared round-body shape with per-id colours, ears and tail.
  - **Test hook:** `window.__trek()` returns `{ trek: Trek | null; profile: Profile; replay: Replay | null; start(hero: Hero, chapter?: ChapterNo, seed?: number): void; set(patch: Partial<Pick<Trek, 'hp' | 'day' | 'acorns' | 'kit' | 'xp' | 'level'>>): void; setProfile(p: Profile): void }`.
  - **Page markers:** `main[data-ready="true"]` is set after hydration, and `main` carries `data-screen` (`title | camp | trek | over | journal`).
  - **Test ids:** `continue`, `camp`, `journal`, `back`, `mute`, `hero-dora`, `hero-enzo`, `chapter-1`…`chapter-5`, `set-off`, `train-atk`, `train-hp`, `merge-<slot>-<r>`, `walk` (continue), `choice-0`…`choice-2`, `walk-on`, `card-0`…`card-2`, `reroll`, `ware-0`…`ware-2`, `speed`, `skip`, `auto`, `stage`, `hp`, `day`, `acorns`.
- Decisions:
  - **Layout:**
    - The canvas is fitted to the largest 3:2 box that leaves room for the panel, with its backing store × `devicePixelRatio`.
    - Under it come the status bar (day, HP bar, level and experience bar, acorns), the skill tray (icons with level pips; tapping one shows its text), and the event card with its buttons.
    - Skill cards overlay the stage.
    - There is no page scroll at 390 × 844 or at 1280 × 860.
  - **Order of a day:**
    - **Walk:** the walk animation runs (1.2 s, or 0.6 s at ×2), then the page calls `trek.next()` and saves.
    - **Fights:** for a fight, the replay plays after the save; at the end, picks or the next walk follow.
    - **Auto-walk:** when it is on, a `walk` phase continues by itself after a 0.5 s pause. When it is off, the page waits for `walk`.
    - The ×2 setting and auto-walk are saved in `chinchilla-trek-v1`'s `ui` field: `{ fast: boolean; auto: boolean }`. Add the field in `loadProfile`, defaulting to `{ fast: false, auto: true }`, and pin it in the profile test.
  - **Saving:**
    - After every successful action, save `localStorage.setItem('chinchilla-trek-run-v1', JSON.stringify(trek))`.
    - At `over` or `cleared`, `record` into `chinchilla-trek-v1`, remove the run save, and show the end card with the chest opening.
    - Every storage call goes in `try/catch`.
  - **Keys:** 1, 2 and 3 pick a choice or card. Space continues, and skips during a fight. R rerolls. Escape is the same as walking on.
  - **Sound cues:** `step`, `hit`, `crit`, `zap`, `dodge`, `level`, `pick`, `chest`, `ko`, `win`, `lose`.
  - **Loop:** `requestAnimationFrame`, with `dt` capped at 100 ms, paused while `document.hidden`.
  - **Reduced motion:** `prefers-reduced-motion` sets `calm`. The walk doesn't bob, lunges stay small, and nothing moves while nothing is happening.
  - **The other chinchilla's cameo:** in a story scene that mentions `{other}`, the scene draws the other chinchilla at the path's edge.

- [ ] **Step 1: Write the failing e2e test** `tests/e2e/trek.mjs`, in the shape of `tests/e2e/brawl.mjs`: `check`, `fresh`, and `ONLY=`/`TRACE=1`. The checks:
  - **Start:** a fresh title has no Continue. Camp shows chapter 1 only. `hero-enzo` then `set-off` opens the trek with `data-screen="trek"`.
  - **The first fight:** with auto-walk off, `walk` plays day 1's fight. The replay runs, Skip jumps to its end, and HP and experience in the status bar match `__trek()`.
  - **A pick:** a level-up offers cards, `card-0` adds the skill to the tray, and `reroll` works once and is then disabled.
  - **A story day:** `set` puts the trek on a story day (`today` through `__trek().set`), and `choice-1` shows the outcome text.
  - **The crossroads:** on day 15, choosing the Fox lowers max HP and adds two skills.
  - **The pedlar:** a buy spends acorns. A ware you can't afford is disabled.
  - **Reload during a fight replay:** after Continue, the day and HP are the same as before the reload, and the fight is not replayed.
  - **The end of a trek:** HP set to 1 against a fight ends the trek. The end card shows the chest. Back at camp, the acorns have gone up, and Continue is gone.
  - **Camp:** `train-atk` spends acorns, and a merge of three Plain hats gives one Fine hat, which is worn.
  - **Auto-walk:** when it is on, days advance without taps until a choice is needed.
  - **The journal** lists 18 skills, 4 evolutions and 30 foes.
  - **Fit and errors:** the stage fits with no scroll at 390 × 844 and 1280 × 860; mute persists across a reload; there are no page errors.
- [ ] **Step 2: Run** `node tests/e2e/trek.mjs` with `npm run dev` up. Expected: FAIL (a 404, or no `data-ready`).
- [ ] **Step 3: Implement** the scene and the page.
- [ ] **Step 4: Run** `node tests/e2e/trek.mjs`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
  - Screenshot into `.checks/trek/` and check each by eye: a walk in every chapter, a mid-fight frame with a crit and a zap, a pick, a story card, camp, and the end card.
  - Check that the foes are easy to tell apart, the text reads on a phone, and nothing looks scary.
- [ ] **Step 5: Commit** `Add Chinchilla Trek's scene and page`.

---

### Task 7: Into the arcade

**Files:**
- Modify:
  - `app/page.tsx` (`GAMES` and the counts) and `app/layout.tsx`;
  - `README.md` and `tests/readme.mjs`;
  - the e2e files named in the README's **Adding a game** checklist, and `tests/e2e/panel-contrast.mjs`;
  - `package.json` (the `test:e2e` chain);
  - `CHANGELOG.md`, `HANDOFF.md` and `CLAUDE.md` (its game count).
- Create: `docs/chinchilla-trek.md`

- [ ] **Step 1: Add the `GAMES` card** after Hay Bale Brawl: `{href:'/trek',title:'Chinchilla Trek',tag:'NEW · ROGUELITE TREK',blurb:'Walk Dora or Enzo through thirty days of meadow, wood and mountain: pick a skill at every level-up, let the scraps play out, bargain with the Owl and the Fox, and bring home gear to go further next time.',color:'#7bb661',art:'🧭'}`. Follow the current cards' `NEW` convention for Hay Bale Brawl's tag. Run `npm test`. Expected: FAIL in `tests/readme.mjs`.
- [ ] **Step 2: Follow the README's Adding a game checklist** in full:
  - thirty-six → thirty-seven and 36 → 37 everywhere it lists them, including the checklist's own wording;
  - `thirty-seven` added to the number words in `tests/readme.mjs`;
  - the README row `| 37 | Chinchilla Trek | \`/trek\` | Roguelite trek |`;
  - a `### 37 · Chinchilla Trek (\`/trek\`)` guide with **Play**, **Controls**, **Tests** and **Docs**, written from the code.
- [ ] **Step 3: Write `docs/chinchilla-trek.md`** to cover:
  - the trek and its days;
  - the fight rules, including the ones decided in Task 2;
  - every skill and evolution with its final numbers;
  - the chapters and foes with their traits;
  - the story scenes, listed by id;
  - the pedlar, the wheel and the crossroads;
  - camp, gear and chests;
  - saving;
  - the bot's gates and final rates;
  - the code-drawn art.
- [ ] **Step 4: Run** the checks:
  - `npm test`, `npm run typecheck` and `npm run build`. Expected: PASS.
  - With `npm run dev` up: `node tests/e2e/trek.mjs`, `node tests/e2e/arcade-navigation.mjs`, `node tests/e2e/panel-contrast.mjs` and `node tests/e2e/dust-bath.mjs`. Expected: PASS.

  Then add `npm run test:e2e:trek` to the `test:e2e` chain.
- [ ] **Step 5: CHANGELOG and HANDOFF.**
  - Add a CHANGELOG **Added** entry: "**Chinchilla Trek**: the arcade's 37th game, a roguelite trek in the spirit of Capybara Go!. Dora or Enzo walks thirty days through one of five chapters: pick a skill at every level-up, watch the scraps play out, bargain with the Owl and the Fox at the crossroads, and face the chapter's boss on day 30. Every trek, won or lost, brings home acorns for training and gear that merges up in rarity."
  - Add a Chinchilla Trek section to HANDOFF: the code, the saves, the balance and the checks. Under "not done", list painted art and play-testing by hand. Update the next-step items.
- [ ] **Step 6: Commit** `Add Chinchilla Trek to the arcade`.
