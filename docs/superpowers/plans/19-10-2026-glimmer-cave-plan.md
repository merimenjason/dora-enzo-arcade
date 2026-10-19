# Glimmer Cave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Glimmer Cave (`/cave`), the arcade's 38th game: a cosy Deep Rock Galactic: Survivor-style dive. Dora or Enzo digs down through five layers of a seeded cave while their weapons fire on their own, levels up from crystals, picks cards and overclocks, and runs for the drop pod at the end of each layer. Gold buys camp upgrades between dives.

**Architecture:**
- **Engine:** a deterministic fixed-step engine split four ways:
  - data in `lib/glimmer-cave-data.ts`;
  - map generation and digging in `lib/glimmer-cave-map.ts`;
  - the twelve weapons in `lib/glimmer-cave-weapons.ts`;
  - the `Dive`, camp, profile and bot policy in `lib/glimmer-cave-game.ts`.
- **Scene and page:** a Canvas 2D scene draws the 55° view, and a client page wires the loop, input, HUD, saving and sound.
- **Painted art:** an offline import script cleans the accepted sheets and measures every frame. A lazy loader on Chinchilla Trek's pattern paints the frames, with code drawings as the fallback.

**Tech Stack:**
- TypeScript, and React through a Next/vinext client page.
- Canvas 2D, with WebAudio through `lib/cue-sound.ts`.
- Node `assert` tests compiled with `tsc` into `.checks/`, and `worker_threads` for the bot.
- Python 3 with Pillow for the offline art import, the same toolchain as `scripts/cave-frame-review.py`.
- Playwright for the browser tests.

**Spec:** [`docs/superpowers/specs/19-10-2026-glimmer-cave-design.md`](../specs/19-10-2026-glimmer-cave-design.md). Every number below that the spec names is copied from it. Numbers the spec leaves to "the data file" or "the bot" are given here as starting values, marked *(start)*. Task 8 may retune them.

## Global Constraints

- **Branches and PRs:** each PR below gets its own branch off `main`, and each is rebase-merged before the next starts. Pushing to `main` deploys.
  - Tasks 1–7: `feat/glimmer-cave-engine`.
  - Task 8: `feat/glimmer-cave-bot`.
  - Task 9: `art/glimmer-cave-references`.
  - Task 10: `feat/glimmer-cave-scene`.
  - Tasks 11–12: `feat/glimmer-cave-paint`.
  - Task 13: `feat/glimmer-cave-arcade`.
- **Staging:** never stage `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`. Stage files by name.
- **Commits and PRs:** commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. `gh pr edit` fails here, so edit a PR with `gh api -X PATCH repos/merimenjason/dora-enzo-arcade/pulls/<n>`.
- **Imports:** engine files import their siblings with a `.js` extension.
- **Randomness:** there's no `Math.random` and no DOM in `lib/glimmer-cave-{data,map,weapons,game}.ts`. Copy `Rand` and `mix` from `lib/chinchilla-trek-game.ts:13-32`.
- **Fixed step:** the engine runs at **60 steps a second** by default. `Dive` also takes `hz: 60 | 30 | 15` for the bot (Task 3). Projectiles and dashes test collisions along their whole path, so a 15 Hz step can't skip through a critter.
- **Units:** the engine works in tiles. Tile `(x, y)` covers `[x, x+1) × [y, y+1)`, and `y` grows downward, toward the camera.
- **Names:**
  - The route is `/cave`.
  - The save keys are `glimmer-cave-run-v1`, `glimmer-cave-v1` and `glimmer-cave-sound-v1`.
  - The test hook is `window.__cave()`.
- **Scripts:** `test:cave`, `bot:cave` and `test:e2e:cave`, shaped like `test:trek`, `bot:trek` and `test:e2e:trek`.
- **Tone:** critters and the wyrm are **bonked** or **poofed**; a hero at 0 Fluff is **bonked** and goes home. No copy says kill, die, dead, blood or hurt-as-injury. A `copy is gentle` test (Task 1) scans all names and text.
- **Formatting and docs:** don't run `oxfmt`; match the hand-formatted style of `lib/chinchilla-trek-game.ts`. Markdown dates are dd-mm-yyyy. Every user-visible change gets a CHANGELOG entry.
- **Playwright:** install it with `npm i -D playwright` and never commit that change. Scratch output goes in `.checks/`.
- **Balance:** rerun `npm run bot:cave` after changing any balance number.
- **No accessibility options** beyond what the spec names (reduced motion).

## Review Focus

1. **Diagonal pushes into rock.** Holding up-right against a wall that's open to the right must slide the hero along the wall (move each axis on its own). Only the blocked axis's block is dug, and dig progress resets when the target block changes, so brushing past rock doesn't chip it. Task 3's tests `sliding along a wall` and `dig progress resets on a new block` pin this.
2. **Several level-ups from one pickup**, such as a crystal cache of 20, must queue every pick. Picks come one after another, none lost, and play resumes only after the last. With no valid card at all (every weapon at 12, every passive at 5, slots full), the offer is a single **Snack** card that heals 20 Fluff. Task 5's test `stacked level-ups and an empty pool` pins this.
3. **Reaching the pod in the same step that Fluff hits 0.** Damage is applied before the pod check, so a bonked hero is bonked, never extracted. The 45 s pod timer can't run out once the pod is reached. Task 3's test `bonked on the pod's step` pins this.
4. **A reload in the middle of a layer** restarts that layer from its pod, with the build it began with. Gold and experience collected on the half-played layer are not kept, and Continue never resumes a dive that has ended. Task 7's tests `a save restarts its layer` and `an ended dive leaves no save` pin this, with the e2e in Task 10.
5. **300 critters plus a burst.** A swarm burst at the cap spawns only up to 300 alive, and spawns never land in rock or on screen. Task 3's test `spawning respects the cap and the view` pins this.

---

### Task 1: The data, `Rand` and the scripts

**Files:**
- Create: `lib/glimmer-cave-data.ts`, `lib/glimmer-cave-game.ts` (only `Rand`, `mix` and `export * from './glimmer-cave-data.js'` for now), `tests/glimmer-cave.mjs`
- Modify: `package.json`:
  - add `test:cave`;
  - add `lib/glimmer-cave-game.ts` to the `tsc` list of `test`;
  - add `node tests/glimmer-cave.mjs` to its `node` list.

**Interfaces:**
- Produces, in `lib/glimmer-cave-data.ts`:
  - **Basics:**
    - `type Hero = 'dora' | 'enzo'`, `type Hazard = 1 | 2 | 3 | 4 | 5`, `type LayerNo = 1 | 2 | 3 | 4 | 5`.
    - `const BASE = { fluff: 100, speed: 3.2, pickup: 1.5, armour: 0, crit: 0.05, critMult: 2, grace: 0.5, radius: 0.3 }`.
    - `const CLASS: Record<Hero, { start: WeaponId; fluff: number; dig: number; projectile: number; lamp: number; speed: number }>`:
      - dora: `{ start: 'pickaxe', fluff: 1.15, dig: 2, projectile: 1, lamp: 1, speed: 1 }`;
      - enzo: `{ start: 'sling', fluff: 1, dig: 1, projectile: 1.15, lamp: 1.3, speed: 1.1 }`.
    - `const LAYER_SECONDS = 300`, `POD_SECONDS = 45`, `POD_DISTANCE = [12, 20]`, `WYRM_AT = 180` (seconds into layer 5), `BUDDY_DAMAGE = 0.5`.
  - **Blocks:**
    - `type Block = 'floor' | 'dirt' | 'gold' | 'bedrock' | 'crate' | 'lantern'`.
    - `const DIG_TIME = { dirt: 0.6, gold: 1.0, crate: 1.0 }`. Bedrock and lanterns can't be dug.
    - `goldRange(layer: LayerNo): [number, number]` returns `[2 + layer, 5 + layer]`, so layer 1 gives 3–6.
  - **Weapons:**
    - `type WeaponId = 'sling' | 'pickaxe' | 'popper' | 'pulse' | 'lance' | 'puffer' | 'boomerang' | 'orbit' | 'bomb' | 'moths' | 'drum' | 'drill'`, in the spec's table order.
    - `type OverclockId` is `` `${WeaponId}.${string}` ``, restricted to these 48 values:
      - sling: `twin heavy` · `ricochet storm`
      - pickaxe: `wide double` · `quake goldrush`
      - popper: `cluster big` · `sticky bouncy`
      - pulse: `bright warm` · `beacon hearth`
      - lance: `prism long` · `resonance glimmer`
      - puffer: `big sneezy` · `cloud pepper`
      - boomerang: `pair long` · `whirl sharp`
      - orbit: `more wide` · `twin sprout`
      - bomb: `bigger quick` · `chain prospector`
      - moths: `swarm dazzle` · `moonlit firefly`
      - drum: `deep quick` · `avalanche echo`
      - drill: `twin long` · `diamond tunnelrat`
    - `const WEAPONS: Record<WeaponId, WeaponDef>`, where `WeaponDef = { id; name; text; damage; cooldown; mines: boolean; oc5: [OverclockId, OverclockId]; oc10: [OverclockId, OverclockId]; steps: Step[]; p: Record<string, number> }`:
      - `type Step = 'rate' | 'size' | 'count'`. `steps` has 11 entries, the secondary stat each card from level 2 to 12 adds. Each weapon alternates two of the three.
      - `p` holds the weapon's other numbers: ranges, radii and speeds.
      - The spec's level-1 numbers: sling 8 every 0.6 s; pickaxe 14 every 0.9 s in a 110° arc; popper 10 every 1.2 s with a 1-tile splash; pulse 6 every 2 s at 2.5 tiles; lance 12 every 1.5 s; puffer 5 every 0.8 s with a 30% slow for 1.5 s; boomerang 9 every 1.4 s, out to 4 tiles; orbit 3 seeds at 1.6 tiles, 7 per touch, each seed at most every 0.4 s; bomb 25 every 2.5 s with a 1 s fuse and a 1.5-tile burst; moths 2 moths doing 6 per hit, 0.5 s apart; drum 10 every 4 s at 3.5 tiles with a 0.5 s stun; drill 8 per tick every 2 s, out to 6 tiles.
      - Calls *(start)*: sling range 7, acorn speed 10; pickaxe reach 1.4; popper range 6, flight 0.6 s; lance length 6, width 0.4; puffer cone length 2.5 at 60°; boomerang speed 8; orbit 3 rad/s; moth speed 7, range 6; drill speed 8, width 0.8, one tick every 0.25 s per critter.
      - Overclock numbers come from the spec's table. Where the spec gives none: Twin Sling aims 15° apart; Double Tap's second swing comes 0.25 s after the first; Quake reaches 2.5 tiles; Resonance chimes within 1 tile; Pebble Popper's Sticky patch slows by 40%; Sprout leaves a 1 s patch doing 3 per 0.5 s; Firefly's burst is 1 tile.
    - `const START_POOL: WeaponId[]`: the spec's first eight.
    - `const UNLOCK: Record<'bomb' | 'moths' | 'drum' | 'drill', UnlockRule>`, where `type UnlockRule = { k: 'layer'; n: 3 } | { k: 'finish' } | { k: 'finishHazard'; n: 2 } | { k: 'bonked'; n: 5000 }`.
  - **Card bonuses:**
    - `const CARD = { damage: 0.15, rate: 0.06, size: 0.1, count: 1 }` *(start)*.
    - A weapon card at rarity multiplier `m` adds `0.15 × m` damage. Its step adds `rate` (cooldown × `1 / (1 + 0.06 × m)`), `size` (+`0.1 × m` to radii and lengths), or `count` (+1, not scaled).
  - **Passives:**
    - `type PassiveId = 'fluff' | 'paws' | 'magnet' | 'claws' | 'busy' | 'arms' | 'lucky' | 'coat'`.
    - `const PASSIVES: Record<PassiveId, { id; name; text; per: number }>`: fluff 15 (max Fluff, heals as much), paws 0.06, magnet 0.25, claws 0.08, busy 0.06, arms 0.25, lucky 0.04, coat 1. Each stacks to 5, the constant `PASSIVE_MAX`.
  - **Rarity:**
    - `const RARITY = { names: ['Common', 'Uncommon', 'Rare', 'Epic'], weights: [60, 28, 10, 2], mult: [1, 1.5, 2, 3] }`.
    - `rarityWeights(h: Hazard): [number, number, number, number]` moves `4 × (h − 1)` from Common to Uncommon and `1 × (h − 1)` from Uncommon to Rare, so hazard 5 gives `[44, 40, 14, 2]`.
  - **Critters:**
    - `type CritterId = 'soot' | 'mite' | 'beetle'`.
    - `const CRITTERS`:
      - soot `{ fluff: 6, speed: 2.2, contact: 5, xp: 1, radius: 0.3 }`;
      - mite `{ fluff: 4, speed: 2.8, contact: 4, xp: 1, radius: 0.25 }`;
      - beetle `{ fluff: 30, speed: 1.4, contact: 10, xp: 4, radius: 0.45 }`.
    - Habits: `MITE = { pack: [5, 8], dash: 0.4, rest: 0.6 }` *(start)* and `BEETLE = { every: 4, within: 4, ram: 2, ramSpeed: 6 }`.
    - `const ELITE = { size: 1.6, fluff: 8, contact: 1.5, cache: 20, every: 60, from: 2 }`.
    - `critterFluff(base: number, layer: LayerNo, h: Hazard): number` returns `base × (1 + 0.35 × (layer − 1)) × (1 + 0.25 × (h − 1))`.
    - `targetAlive(t: number, layer: LayerNo, h: Hazard, podRun: boolean): number` ramps from 20 to 120 across the 300 s, × 1.25^(layer − 1), × (1 + 0.2 × (h − 1)), × 2 during the pod run, capped at `MAX_ALIVE = 300`.
    - `const BURST = { every: 60, n: 30 }`.
    - `const LAYER_MIX: Record<LayerNo, [number, number, number]>` gives the soot, mite and beetle weights *(start)*: `[70,30,0] [60,30,10] [45,35,20] [40,35,25] [40,30,30]`.
  - **Jobs:**
    - `type JobId = 'haul' | 'crates' | 'lanterns' | 'bigone'`.
    - `const JOBS`:
      - haul `{ goal: 60, gold: 25 }`;
      - crates `{ goal: 3, crystals: 15, gold: 25 }`;
      - lanterns `{ goal: 3, stand: 3, reach: 1.2, pool: 3, slow: 0.3, gold: 25 }`;
      - bigone `{ at: 150, gold: 30, cache: 20 }`.
    - All rewards are × layer.
  - **The wyrm** *(start, except where the spec fixes a number)*: `const WYRM = { fluff: 2500, segments: 8, spacing: 0.9, head: 0.9, body: 0.6, speed: 2.6, contact: 15, rumbleEvery: 8, telegraph: 1, ring: 4, ringWidth: 0.6, ringDamage: 15, diveAt: 0.5, diveFor: 6, fastAfter: 1.3, crystals: 100, gold: 200 }`. Its Fluff is scaled by `1 + 0.25 × (h − 1)`; its gold is × hazard.
  - **Levels:** `xpNeed(level: number): number` returns `5 + 3 × level`.
  - **Camp:**
    - `type UpgradeId = 'fluffier' | 'sharper' | 'quicker' | 'diggier' | 'magnetic' | 'prospector' | 'rerolls' | 'headstart'`.
    - `const UPGRADES`: per level fluffier 8, sharper 0.05, quicker 0.03, diggier 0.1, magnetic 0.1, prospector 0.08, rerolls 1, headstart 1. `max` is 5, except rerolls and headstart, which are 3.
    - Bases *(start)*: fluffier 40, sharper 60, quicker 40, diggier 30, magnetic 30, prospector 50, rerolls 80, headstart 100.
    - `upgradeCost(id: UpgradeId, nextLevel: number): number` returns `base × nextLevel`.
  - **Layer tints:** `const TINT: Record<LayerNo, string>`, the five colours the spec names. The scene uses them; the engine doesn't.

- [ ] **Step 1: Write the failing tests** in `tests/glimmer-cave.mjs`, importing from `../.checks/glimmer-cave-game.js`. Give the file the trek test's `test(name, fn)` harness, and run it with `process.exitCode = failed ? 1 : 0`.
  - `data: 12 weapons with two overclocks at 5 and two at 10, 48 distinct`;
  - `data: level-1 weapon numbers match the spec` (a `[id, damage, cooldown]` table: `sling 8 0.6`, `pickaxe 14 0.9`, `popper 10 1.2`, `pulse 6 2`, `lance 12 1.5`, `puffer 5 0.8`, `boomerang 9 1.4`, `bomb 25 2.5`, `drum 10 4`, `drill 8 2`; orbit `7`, with `p.seeds === 3`; moths `6`, with `p.moths === 2`);
  - `data: mining weapons are pickaxe, bomb and drill`;
  - `data: every weapon's steps has 11 entries`;
  - `data: rarity weights sum to 100 at every hazard, and hazard 5 is [44, 40, 14, 2]`;
  - `data: critters, elites, jobs and xpNeed match the spec` (`xpNeed(1) === 8`, `targetAlive(0,1,1,false) === 20`, `targetAlive(300,1,1,false) === 120`, `targetAlive(300,5,5,true) === 300`);
  - `data: copy is gentle` (no name or text, lower-cased, contains `kill`, `die`, `dead`, `blood`, `murder` or `hurt`).
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL, because `.checks/glimmer-cave-game.js` doesn't exist.
- [ ] **Step 3: Implement** the data and `Rand`/`mix`. Write the names and card text in the arcade's gentle voice.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
- [ ] **Step 5: Commit** `Add Glimmer Cave's data`.

---

### Task 2: The map and digging

**Files:**
- Create: `lib/glimmer-cave-map.ts`
- Modify: `lib/glimmer-cave-game.ts` (re-export the map), `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: `Rand`, `mix`, `Block`, `LayerNo`, `JobId`, `goldRange`.
- Produces:
  - `const MAP_W = 64, MAP_H = 48`.
  - `type CaveMap = { w: number; h: number; tiles: Block[]; start: { x: number; y: number }; pods: { x: number; y: number }[]; props: { kind: 'crate' | 'lantern'; x: number; y: number }[]; tint: LayerNo }`. Tiles are indexed `y * w + x`.
  - `makeMap(seed: number, layer: LayerNo, job: JobId | null): CaveMap`:
    1. Fill with rock.
    2. Carve caverns with cellular automata (45% open, five passes of the 4-5 rule).
    3. Keep the largest cavern and tunnel every other cavern of 12 or more tiles into it with a 2-wide passage.
    4. Make the border two tiles of bedrock.
    5. Make the remaining rock dirt, with gold blocks at 8% + 2% × layer *(start)* and bedrock clumps at 3% *(start)*.
    6. Put `start` at the open tile nearest the map's centre, and clear a 5 × 5 room around it.
    7. Choose `pods`: 12 open tiles, each with all 8 neighbours open.
    8. Place job props: for `crates`, 3 crates fully buried in rock, each with at least one rock neighbour that touches open floor; for `lanterns`, 3 lanterns on open tiles, each at least 10 tiles from `start`.
  - `tileAt(m: CaveMap, x: number, y: number): Block` returns `'bedrock'` outside the map.
  - `solid(b: Block): boolean` is true for everything except `floor`.
  - `dig(m: CaveMap, x: number, y: number, r: Rand, layer: LayerNo): { block: Block; gold: number; crystals: number } | null`:
    - It returns `null` for floor, bedrock and lanterns.
    - Otherwise it sets the tile to floor and returns the drop: gold `r.int` in `goldRange` for a gold block, 15 crystals for a crate, and nothing for dirt.
  - `reachable(m: CaveMap, from: { x: number; y: number }): Uint8Array`, a 4-way flood fill over open tiles.

- [ ] **Step 1: Write the failing tests:**
  - `map: the same seed and layer give the same map; a different seed gives a different one`;
  - `map: the border is two tiles of bedrock` (for 20 seeds);
  - `map: every open tile and every pod spot is reachable from the start` (20 seeds × 5 layers);
  - `map: at least 12 pod spots, each 3 × 3 open` (same seeds);
  - `map: gold is commoner deeper` (mean gold-block count over 20 seeds rises from layer 1 to 5);
  - `map: crates are buried but diggable, lanterns stand on open floor` (with `job: 'crates'` and `job: 'lanterns'`);
  - `dig: dirt turns to floor with nothing; gold drops 3–6 on layer 1; crate drops 15 crystals; bedrock and floor return null and stay`.
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL, because `makeMap` isn't exported.
- [ ] **Step 3: Implement** `lib/glimmer-cave-map.ts`.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Glimmer Cave's seeded maps and digging`.

---

### Task 3: The dive: movement, digging, critters, the timer and the pod

**Files:**
- Modify: `lib/glimmer-cave-game.ts`, `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `type Input = { x: number; y: number }`, with the length clamped to 1.
  - `type Critter = { id: number; kind: CritterId; elite: boolean; x: number; y: number; fluff: number; max: number; slow: number; slowFor: number; stun: number; hit: number; state: 'walk' | 'dash' | 'rest' | 'ready' | 'ram'; t: number; dx: number; dy: number }`.
  - `type CaveEvent`, all with `x` and `y` in tiles where a position applies:
    - `{ k: 'fire'; w: WeaponId; x; y; dx; dy }`
    - `{ k: 'hit'; id: number; x; y; dmg: number; crit: boolean }`
    - `{ k: 'bonk'; id: number; kind: CritterId; elite: boolean; x; y }`
    - `{ k: 'dig'; x; y; block: Block; progress: number }` (`progress` 1 means dug)
    - `{ k: 'gold'; n: number }`
    - `{ k: 'crystal'; n: number }`
    - `{ k: 'hurt'; dmg: number }`
    - `{ k: 'level'; level: number }`
    - `{ k: 'burst'; dx: number; dy: number }`
    - `{ k: 'pod'; x; y }`
    - `{ k: 'podReached' }`
    - `{ k: 'job'; id: JobId; n: number; done: boolean }`
    - `{ k: 'wyrm'; what: 'surface' | 'dive' | 'rumble' | 'bonked'; x; y }`
    - `{ k: 'over'; result: 'bonked' | 'missed' | 'complete' }`
  - `type Phase = 'play' | 'pick' | 'pod' | 'over'`.
  - `type DiveOpts = { seed: number; hero: Hero; hazard: Hazard; profile: Profile; hz?: 60 | 30 | 15 }`. `Profile` comes from Task 7; until then, accept `Partial<Profile>` and read upgrades as level 0.
  - `class Dive`:
    - **Fields:** `seed`, `hero`, `hazard`, `hz`, `dt`, `layer: LayerNo`, `map: CaveMap`, `phase: Phase`, `t` (seconds into the layer), `timer` (seconds left: 300 counting down, then the pod's 45), `hx`, `hy`, `face: { x: number; y: number }` (a unit vector, starting `{ x: 1, y: 0 }`), `moving: boolean`, `fluff`, `grace`, `xp`, `level`, `picks: number` (queued level-ups), `offer: Card[]`, `weapons: WeaponState[]`, `passives`, `rerolls`, `gold: { banked: number; layer: number }`, `crystals: { x: number; y: number; n: number }[]`, `critters: Critter[]`, `pod: { x: number; y: number; reached: boolean } | null`, `job`, `jobsUsed: JobId[]`, `wyrm`, `bonked` (critters bonked this dive), `buddy: { x: number; y: number }`, `digging: { x: number; y: number; p: number } | null`, `result: 'bonked' | 'missed' | 'complete' | null`, `events: CaveEvent[]`.
    - **Methods:**
      - `constructor(o: DiveOpts)` starts layer 1.
      - `stats(): { maxFluff; speed; pickup; armour; crit; dig; damage; cooldown; projectile }` combines the base, class, passives and camp upgrades.
      - `step(input: Input): CaveEvent[]` advances one tick of `1 / hz` s. It clears and returns `events`, and returns `[]` unless `phase === 'play'`.
      - `startLayer(n: LayerNo)`, used by the constructor, `descend` and `fromSave`, builds the map with `mix(seed, n)` and the layer's `Rand` with `mix(seed, n + 100)`.
      - `descend(): boolean` works only in phase `pod` with `layer < 5`.
      - `pick(i)` and `reroll()` come in Task 5; `toSave()` and `fromSave` come in Task 7.
  - **Order of a step:**
    1. Timers.
    2. The hero's move, by axis, against `solid`. A blocked axis with input on it digs: progress adds `dt / DIG_TIME[block] × stats().dig`.
    3. Weapons (Task 4; a no-op hook for now).
    4. Critters move and attack.
    5. Contact damage.
    6. Crystals fly to the hero within the pickup radius and are collected.
    7. Spawns.
    8. Jobs and the wyrm (Task 6 hook).
    9. The pod check.
    10. The over check.
  - **Spatial hash:** `class Grid { constructor(cell = 2) {} clear(): void; add(c: Critter): void; near(x: number, y: number, r: number, out: Critter[]): Critter[] }`, rebuilt once per step. The weapons and the contact check query it.
  - **Critters:** a critter treats `solid` tiles as walls and steers toward the hero. Pick its direction by a 4-way flow field from the hero, recomputed when the hero changes tile. Mites and beetles follow the habits in Task 1's data.
  - **Spawning:**
    - While alive < `targetAlive`, at most one spawn per `0.05 s`.
    - Each spawns on an open tile just outside the view: an 11 × 18 tile window centred on the hero, then 1–3 tiles beyond its edge.
    - Every 60 s a burst places 30 at once along one side.
    - Elites come from layer 2, one every 60 s from 30 s.
    - Nothing spawns past 300 alive.
  - **The pod:**
    - At `timer` 0 the pod lands on the `map.pods` spot whose distance from the hero is closest to 16, within 12–20 if any spot qualifies. `timer` becomes 45.
    - Reaching within 1 tile of it sets phase `pod` and banks `gold.layer`.
    - At 0 without reaching it, the hero is bonked: `result: 'missed'`.
  - **Bonked:** at Fluff 0, the phase becomes `over` and `result` is `'bonked'`. Half the layer's gold is banked, rounded down.
  - **Layer 5:** `timer` counts down to the wyrm instead (300 − `WYRM_AT` left at the start, so the HUD shows 2:00). There's no pod until the wyrm is bonked (Task 6). Reaching layer 5's pod sets `result: 'complete'` and phase `over`.
  - **The buddy** follows 1.2 tiles behind the hero, passes through critters and takes no damage. Its weapon comes in Task 4.

- [ ] **Step 1: Write the failing tests**, building dives on a hand-made open map through a test helper `openDive(opts)`. It replaces `d.map` with a 64 × 48 floor inside a bedrock border, and turns spawning off with `d.spawning = false`, a public field.
  - `move: the hero moves 3.2 tiles in one second right` (60 steps of `{1,0}`, ±0.01), `and Enzo 3.52`;
  - `move: the hero can't pass rock` (a bedrock wall);
  - `move: sliding along a wall` (input `{1,-1}` against a wall on the right moves the hero up, and digs nothing when the wall is bedrock);
  - `dig: pushing into dirt digs it in 0.6 s, Dora in 0.3 s` (to within a step);
  - `dig: progress resets on a new block`;
  - `dig: a gold block adds its gold to gold.layer`;
  - `critters: contact takes Fluff once per 0.5 s of grace` (a soot sprite on the hero: 100 → 95, still 95 after 0.4 s, 90 after 0.6 s);
  - `critters: a beetle within 4 tiles rams 2 tiles every 4 s`;
  - `spawning respects the cap and the view` (fast-forward with 300 alive and a burst due: alive stays ≤ 300; every spawn is on floor and at least 9 tiles across or 5.5 tiles up or down from the hero);
  - `timer: the pod lands at 0:00 between 12 and 20 tiles away, and the run lasts 45 s`;
  - `pod: reaching it banks the layer's gold and opens phase pod; descend starts layer 2`;
  - `pod: missing it bonks the hero with result missed`;
  - `bonked: at 0 Fluff, result bonked, half the layer's gold banked, rounded down` (layer gold 7 → 3);
  - `bonked on the pod's step` (Fluff and pod contact on the same step: the result is `'bonked'`);
  - `determinism: the same seed and inputs give the same events` (two dives of 3,000 steps of a scripted input; the JSON of every step's events is equal);
  - `hz: 15 Hz moves as far per second as 60 Hz` (±0.05 tiles).
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL, because `Dive` isn't exported.
- [ ] **Step 3: Implement** the `Dive` core and `Grid`.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Glimmer Cave's dive: moving, digging, critters and the pod`.

---

### Task 4: The twelve weapons and their overclocks

**Files:**
- Create: `lib/glimmer-cave-weapons.ts`
- Modify: `lib/glimmer-cave-game.ts` (call the weapons in step 3, and give the buddy its class's start weapon at 50% damage), `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: `Dive`, `Grid`, `CaveEvent`, `WEAPONS`, `CARD`, `dig`.
- Produces:
  - `type WeaponState = { id: WeaponId; level: number; overclocks: OverclockId[]; dmg: number; rate: number; size: number; count: number; cd: number; n: number }`:
    - `dmg`, `rate` and `size` are the summed card bonuses;
    - `count` is the extra count;
    - `cd` is the time to the next fire;
    - `n` counts fires, for "every 5th volley" and "every 3rd pulse".
  - `newWeapon(id: WeaponId): WeaponState`.
  - `type Shot`: the live projectiles, zones and orbiters, as a tagged union in `lib/glimmer-cave-weapons.ts`. `Dive` holds `shots: Shot[]`, and `Shot` is exported for the scene.
  - `runWeapons(d: Dive, owner: 'hero' | 'buddy'): void`:
    - it fires each weapon whose `cd` reaches 0 and advances every `Shot`;
    - it applies hits through `hurtCritter(d, c, dmg, from)`;
    - it digs through `dig` for mining weapons.
  - `hurtCritter(d: Dive, c: Critter, base: number, x: number, y: number): void`:
    - it rolls the crit;
    - it applies all-damage bonuses and emits `hit`;
    - at 0 Fluff it emits `bonk`, drops crystals (`xp`, or `ELITE.cache` for an elite) and counts `d.bonked`.
  - **Aiming rules:**
    - **The sling** aims at the nearest critter within range.
    - **The lance** aims at the 8-way direction holding the most critters within 6 tiles.
    - **The pickaxe, puffer and drill** use `face`.
    - **The popper** lobs at a random critter within range.
    - **Moths** seek the nearest critter not already targeted.
- Decisions:
  - Every overclock does exactly what the spec's table says, with Task 1's numbers. Overclocks stack with card bonuses.
  - "Knocks back" moves the critter 0.5 tiles away, stopping at rock.
  - A slowed critter moves at `speed × (1 − slow)`. A stunned one doesn't move.

- [ ] **Step 1: Write the failing tests** with `openDive`, a single weapon, and critters placed by hand with Fluff 999 unless the test bonks. Use a seeded crit of 0 (`d.critOff = true`, a public test switch that makes `crit` 0).
  - `weapons: each level-1 weapon hits a placed critter for its table damage at its table rate`: for each of the 12, a critter where the weapon reaches it, and over 10 s the hit count and the first hit's `dmg` match the spec. For example, the sling's first hit is 8 and it hits 16–17 times in 10 s. The bomb's first hit is 25, 1 s after its fire.
  - `weapons: mining weapons dig` (pickaxe, bomb and drill each turn a dirt block in reach to floor; the sling doesn't);
  - `weapons: a card raises damage by 15% × rarity` (Common: sling 8 → 9.2; Epic: 8 → 11.6);
  - `weapons: the buddy's sling does 4 and never levels`;
  - `overclocks: each changes what it says`. This is one table-driven test, with one observable per overclock:
    - sling: `twin` 2 acorns 15° apart · `heavy` 14.4 and knockback 0.5 · `ricochet` 3 distinct critters hit by one acorn · `storm` the 5th fire launches 8 acorns.
    - pickaxe: `wide` a critter 90° off-face is hit · `double` a second hit 0.25 s after the first · `quake` a critter 2.5 tiles ahead is hit · `goldrush` a gold block dug by a swing pays 1.5× (same seed).
    - popper: `cluster` 3 splashes · `big` a critter 1.5 tiles from the landing is hit · `sticky` a critter in the patch is slowed by 40% · `bouncy` 3 landings.
    - pulse: `bright` a critter at 3.4 tiles is hit · `warm` a hit critter is 25% slower for 2 s · `beacon` the 3rd pulse reaches 5 tiles · `hearth` 3 critters hit heals 3, and 8 heals 5.
    - lance: `prism` 3 lances · `long` reaches 12 tiles and pierces 10 critters · `resonance` a neighbour within 1 tile takes 6 · `glimmer` over 2,000 bonks, double drops fall between 8% and 12%.
    - puffer: `big` a critter 45° off-axis is hit · `sneezy` a critter behind is hit · `cloud` a critter entering 1 s later is hit · `pepper` hits for 10, no slow.
    - boomerang: `pair` 2 twigs · `long` it turns at 6 tiles · `whirl` it hovers 1 s at its far point · `sharp` hits for 15.3.
    - orbit: `more` 5 seeds · `wide` radius 2.4 · `twin` a second ring turning the other way · `sprout` a bramble patch appears.
    - bomb: `bigger` a critter at 2.2 tiles is hit · `quick` the burst comes 0.4 s after the drop · `chain` a second burst 2 tiles away · `prospector` dug dirt drops gold.
    - moths: `swarm` 4 moths · `dazzle` a hit critter is stunned 0.3 s · `moonlit` one moth hits 2 critters in a line · `firefly` a 15 burst on return.
    - drum: `deep` a critter at 4.9 tiles is hit · `quick` thumps every 2.5 s · `avalanche` it digs blocks in range · `echo` a second thump 0.5 s later.
    - drill: `twin` a critter behind is hit · `long` reaches 10 tiles · `diamond` 16 per tick · `tunnelrat` the hero is 25% faster for 2 s after a fire.
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL, because `newWeapon` isn't exported.
- [ ] **Step 3: Implement** `lib/glimmer-cave-weapons.ts`, one fire function and one shot updater per weapon, with overclock branches inline.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Glimmer Cave's twelve weapons and overclocks`.

---

### Task 5: Levels, cards, rarity and rerolls

**Files:**
- Modify: `lib/glimmer-cave-game.ts`, `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `type Card`:
    - `{ k: 'weapon'; id: WeaponId; rarity: 0 | 1 | 2 | 3 }`, a new weapon or its next level;
    - `{ k: 'overclock'; id: OverclockId }`;
    - `{ k: 'passive'; id: PassiveId; rarity: 0 | 1 | 2 | 3 }`;
    - `{ k: 'snack' }`.
  - `Dive.deal(): Card[]`:
    - **Overclocks:** when any held weapon is at level 4 or 9 (the next card is its overclock), the offer is that weapon's two overclocks in a shuffled order, at the weapon of lowest slot index.
    - **Normal offers:** otherwise, three distinct cards drawn by weight from the valid pool:
      - held weapons below 12 that aren't waiting on an overclock;
      - unheld weapons from the pool (`START_POOL` plus the profile's unlocks) while a slot is free;
      - passives below 5 stacks.
    - **A free slot** means at least one card is a new weapon, if any are left.
    - **Rarity** is rolled from `rarityWeights(hazard)`.
    - **A short pool** offers what's left. **No valid card** at all means `[{ k: 'snack' }]`.
  - `Dive.pick(i: number): boolean`:
    - it applies the card;
    - a weapon card raises the level by 1, adds `CARD.damage × mult` to `dmg`, and adds that level's step;
    - an overclock is pushed to `overclocks` and raises the weapon's level by 1;
    - a passive adds `per × mult`;
    - a snack heals 20;
    - then `picks--` and the next offer is dealt, or the phase goes back to `play`.
  - `Dive.reroll(): boolean` redeals an offer while `rerolls > 0`; overclock offers can't be rerolled.
  - **Rerolls** reset each layer to `1 + profile.upgrades.rerolls`.
  - **Head start:** at the dive's start, head start level `n` sets `level = 1 + n` and `picks = n`, so the first picks open immediately.
- Decisions: a level-up sets phase `pick` at the end of the step that crossed it. Leftover experience carries over to the next level.

- [ ] **Step 1: Write the failing tests:**
  - `levels: 8 crystals reach level 2 and open a pick of three distinct valid cards`;
  - `levels: with a free slot, an offer holds a new weapon`;
  - `levels: rarity scales a passive` (an Epic Quick Paws adds 0.18);
  - `levels: at level 4 a weapon's next card is an overclock pair; picking one makes it level 5 with that overclock`, and again at level 9;
  - `levels: four slots fill, then only those weapons and passives are offered` (200 deals);
  - `levels: nothing past its cap` (weapon 12, passive 5, never offered in 500 deals);
  - `stacked level-ups and an empty pool` (a 20-crystal cache from level 1 queues several picks, each taken in turn; every weapon at 12 and every passive at 5 gives a single Snack);
  - `rerolls: one per layer, refreshed on descend; an overclock offer can't be rerolled`;
  - `illegal actions change nothing` (`pick(5)`, `pick` while playing, `reroll` with none left, `descend` while playing, `step` while picking: each returns `false` or `[]`, and `JSON.stringify({ phase, level, xp, picks, offer, weapons, passives, rerolls })` of the dive is unchanged).
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL.
- [ ] **Step 3: Implement** the cards.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Glimmer Cave's level-up cards, rarity and overclocks`.

---

### Task 6: Jobs and the Rock Wyrm

**Files:**
- Modify: `lib/glimmer-cave-game.ts`, `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `type JobState = { id: JobId; n: number; goal: number; done: boolean; lit?: number[]; standing?: number }`.
  - **Choosing jobs:** `startLayer` picks the layer's job, for layers 1–4, from the jobs not yet in `jobsUsed`, with the layer's `Rand`. Layer 5 has none.
  - **Progress:**
    - **haul** counts crystal pickups;
    - **crates** counts crates dug;
    - **lanterns** counts lanterns lit by standing within `reach` for `stand` seconds;
    - **bigone** spawns an elite of the layer's mix at `t = 150` and completes when it's bonked.
  - **Rewards:** completing a job adds its gold × layer to `gold.layer`, and bigone also drops `cache` crystals.
  - **Lit lanterns** slow critters within `pool` tiles by 30%.
  - **The wyrm:** `type Wyrm = { x: number; y: number; dir: number; fluff: number; max: number; segs: { x: number; y: number }[]; under: number; rumble: number; ring: number | null; fast: boolean; bonked: boolean }`. On layer 5 at `t = WYRM_AT` it surfaces 6 tiles from the hero.
    - It circles the hero at 4 tiles, digging every block its head passes.
    - The segments follow the head's trail at `spacing`.
    - Every 8 s it rumbles: `telegraph` warning, then a ring expands to `ring` tiles over 1 s. The ring deals `ringDamage` to a hero within `ringWidth` of its edge, once per ring.
    - Only the head takes damage. Shots that touch a segment stop without damage.
    - At 50% Fluff it goes under for 6 s (`under > 0`: no damage, no contact) and comes back at speed × 1.3.
    - At 0 it's bonked: it emits `wyrm bonked`, drops `crystals`, adds `gold × hazard` to `gold.layer`, and the pod lands with `timer = 45`.

- [ ] **Step 1: Write the failing tests:**
  - `jobs: one per layer 1–4, never repeated in a dive` (100 seeds: each dive's four jobs are distinct);
  - `jobs: haul completes at 60 crystals and pays 25 × layer`;
  - `jobs: crates complete after digging 3 crates, each worth 15 crystals`;
  - `jobs: lanterns light after 3 s standing, and a lit pool slows a critter by 30%`;
  - `jobs: bigone spawns an elite at 2:30 that pays 30 × layer and a 20-crystal cache`;
  - `wyrm: appears on layer 5 at 3:00, not before`;
  - `wyrm: only its head takes damage` (a sling shot at a body segment does nothing; at the head, it takes 8);
  - `wyrm: the rumble ring hits once, and stepping outside it avoids it`;
  - `wyrm: dives at half Fluff for 6 s and resurfaces faster`;
  - `wyrm: bonked drops 100 crystals and 200 × hazard gold, and the pod lands; reaching it completes the dive`.
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL.
- [ ] **Step 3: Implement** the jobs and the wyrm.
- [ ] **Step 4: Run** `npm run test:cave`. Expected: PASS.
- [ ] **Step 5: Commit** `Add Glimmer Cave's layer jobs and the Rock Wyrm`.

---

### Task 7: Camp, the profile and saving

**Files:**
- Modify: `lib/glimmer-cave-game.ts`, `tests/glimmer-cave.mjs`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces:
  - **The profile:**
    - `type Profile = { v: 1; gold: number; upgrades: Record<UpgradeId, number>; unlocked: { hazard: Hazard; weapons: WeaponId[] }; stats: { dives: number; bestLayer: number; bonked: number; finished: number; finishedHazard: number } }`.
    - `finishedHazard` is added to the spec's shape, so the Rumble Drum's rule can be checked.
  - **Profile functions:**
    - `freshProfile(): Profile`.
    - `loadProfile(raw: unknown): Profile`: malformed data loads fresh, unknown ids are dropped, and numbers are clamped to their ranges.
    - `buy(p: Profile, id: UpgradeId): boolean` spends `upgradeCost(id, level + 1)` if affordable and below `max`.
  - **Recording a dive:**
    - `record(p: Profile, d: Dive): { gold: number; unlocked: WeaponId[]; hazard: Hazard | null }` runs once a dive ends, or when it is abandoned.
    - It adds the banked gold, the stats, `bestLayer`, the bonk count, unlocks earned (`UNLOCK` rules) and the next hazard after a finished dive.
  - **The run save:**
    - `type RunSave = { v: 1; hero; hazard; seed; layer: LayerNo; fluff; xp; level; picks; weapons: WeaponState[]; passives: Record<PassiveId, { n: number; v: number }>; rerolls; gold: { banked: number; layer: 0 }; jobsUsed: JobId[]; bonked: number }`.
    - The spec's shape gains `picks` and the full `WeaponState`, so rarity bonuses survive a reload. `cd` and `n` are reset on load.
    - `Dive.toSave(): RunSave` records the start of `layer`.
    - `static Dive.fromSave(raw: unknown, profile: Profile): Dive | null` returns null for anything malformed or with unknown ids. Otherwise it rebuilds the dive at the start of `layer`.
  - **Page protocol** (Task 10 follows it):
    - write `toSave()` when a dive starts and after each `descend()`;
    - remove the run save and `record` when phase `over` is reached;
    - starting a new dive while a save exists first `record`s the abandoned save, through `Dive.fromSave` with `result: 'bonked'`.

- [ ] **Step 1: Write the failing tests:**
  - `camp: costs are base × level; buying spends gold and stops at max`;
  - `camp: upgrades change stats` (Fluffier 2 gives 116 max Fluff; Sharper 3 gives sling hits of 9.2);
  - `camp: unlocks` (reaching layer 3 unlocks the bomb; a finished dive unlocks moths and the next hazard; finishing hazard 2 unlocks the drum; 5,000 bonked unlocks the drill);
  - `camp: banking` (a dive bonked on layer 3 with 40 banked and 9 on the layer records 44);
  - `saving: a save restarts its layer` (play layer 2 halfway; `fromSave(toSave from layer 2's start)` gives layer 2 at its start, with the start's build, Fluff and xp, and gold.layer 0);
  - `saving: round-trips at a pod` (descend, then `JSON` → `fromSave` → `toSave` is deep-equal);
  - `saving: malformed saves load fresh` (`null`, `'x'`, `{v:2}`, an unknown weapon id, a negative layer: `fromSave` returns null, and `loadProfile` returns a fresh profile);
  - `saving: an ended dive leaves no save` (this is the page protocol, so a unit test pins `record` running once: a second `record` of the same dive adds nothing, via a `d.recorded` flag).
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL.
- [ ] **Step 3: Implement** camp, the profile and saving.
- [ ] **Step 4: Run** `npm run test:cave`, `npm test` and `npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit** `Add Glimmer Cave's camp, profile and saves`. Open PR **"Add Glimmer Cave's engine"** from `feat/glimmer-cave-engine`. Wait for CI and the user's go-ahead, then rebase-merge.

---

### Task 8: The bot and the balance gates

**Files:**
- Create: `tests/glimmer-cave-bot.mjs`
- Modify: `lib/glimmer-cave-game.ts` (`drive`, `botPick`, `randomPick`), `lib/glimmer-cave-data.ts` (tuning only), `package.json` (`bot:cave`; add the bot to `test`'s node list)

**Interfaces:**
- Produces:
  - `drive(d: Dive): Input` steers by the spec's policy:
    - away from the weighted centre of critters within 5 tiles (weight `1 / distance²`);
    - toward the nearest crystal within 4 tiles, the job target, a gold block within 3 tiles, and the pod once it lands (the pod outweighs everything).
    - It routes with the map's flow field so it never pushes into bedrock.
  - `botPick(d: Dive, r: Rand): number` takes index 0 on an overclock offer; overclock offers are shuffled, so this varies. Otherwise it picks by weighted chance with fixed weights: new weapon 5 while a slot is free, held weapon 3, passive 2, snack 1.
  - `randomPick(d: Dive, r: Rand): number`.
  - **The bot file:**
    - It runs dives on `worker_threads`, `os.availableParallelism()` of them, at `hz: 15`, with fixed seeds, so results are deterministic.
    - `QUICK` sample sizes (the default, in `npm test`) are chosen so the file runs in under 90 s on a 4-core CI runner.
    - `FULL=1` (`npm run bot:cave`) runs 4× more dives.
    - It prints a table of rates and asserts the spec's gates.
- **The gates, from the spec:**
  - **First dives**, fresh profile, hazard 1: the policy reaches layer 2 in at least 70% and finishes in 5–30%. A random-card player finishes at least 10 points less often.
  - **Upgraded**, every upgrade at level 3 and everything unlocked: the policy finishes hazard 1 in 50–85% and hazard 3 in 15–50%.
  - **Variety**, across the upgraded dives: every weapon is taken in at least 3% of dives, and every overclock in at least 1% of the times its weapon reaches level 5 or 10.
  - **Timing:** the wyrm is bonked within 30–150 s in at least 80% of fights reached.
  - **Performance:** a 60 Hz step with 300 critters alive averages under 2 ms over 600 steps. Measure on the main thread.

- [ ] **Step 1: Write** `tests/glimmer-cave-bot.mjs` with the gates.
- [ ] **Step 2: Run** `npm run bot:cave`. Expected: FAIL on at least one gate with the *(start)* numbers. Record the table.
- [ ] **Step 3: Tune** the knobs in the spec's order: critter Fluff scaling, the spawn ramp, weapon base damage, experience per level, then the per-level tables. Change only `lib/glimmer-cave-data.ts`, and rerun until every gate passes in both `QUICK` and `FULL`. If a gate can't be met without changing a spec-fixed number, stop and report.
- [ ] **Step 4: Run** `npm test`. Expected: PASS, with the bot under 90 s (time it).
- [ ] **Step 5: Commit** `Add Glimmer Cave's bot and balance`. Write the tuned numbers and the final table into the PR body. Open PR **"Balance Glimmer Cave with its bot"**, wait for CI and the go-ahead, then merge.

---

### Task 9: The art references on `main`

This is the spec's build step 1, moved here: the art is still arriving, and Tasks 1–8 don't need it. Do it once the round 2 sheets (environment, floor and wyrm) are accepted. If they aren't ready by Task 10, do it with what's accepted, and add the rest in Task 11.

**Files:** the branch `codex/cave-survival-style-art` as it stands, less the rejected attempts.

- [ ] **Step 1:** branch `art/glimmer-cave-references` from `origin/codex/cave-survival-style-art`, then rebase it onto `main`. Resolve the `CHANGELOG.md` conflict by keeping both entries under their dates.
- [ ] **Step 2:** `git rm` the generated sheets that `docs/cave-survival-art.md` marks rejected or unused (`dora-animation-v1.png`, `critters-animation-v1.png`, `fx-animation-v1.png`, `environment-v1.png`, `environment-v2.png`, and any later rejects), keeping their review JSONs. History keeps the PNGs. Add a sentence saying so under the review section.
- [ ] **Step 3: Run** `npm test` and `npm run build`. Expected: pass.
- [ ] **Step 4: Commit** `Keep only the accepted cave sheets`. Open PR **"Add the cave survival style art and animation sheets"**, wait for CI and the go-ahead, then merge.

---

### Task 10: The scene and the page, with code drawings

**Files:**
- Create: `lib/glimmer-cave-scene.ts`, `app/cave/page.tsx`, `app/cave/cave.css`, `tests/e2e/cave.mjs`
- Modify: `package.json` (`test:e2e:cave`)

**Interfaces:**
- Consumes:
  - Tasks 1–8;
  - `makeSound` from `lib/cue-sound.ts`;
  - `drawChinchilla` from `lib/chinchilla-art.ts`;
  - the mock-up's shapes in `.superpowers/brainstorm/` are a guide only; don't import them.
- Produces:
  - **View geometry:**
    - `type View = { w: number; h: number; tile: number; squash: 0.8; cx: number; cy: number }`. `tile = min(w, h) / 11`, and `cx` and `cy` are the camera's centre in tiles.
    - `toScreen(v: View, x: number, y: number): [number, number]` returns `[(x − cx) × tile + w/2, (y − cy) × tile × 0.8 + h/2]`.
    - `const FACE = 0.55`: a block's front face is `0.55 × tile` tall.
  - **Drawing:**
    - `drawDive(c: CanvasRenderingContext2D, d: Dive, v: View, fx: Fx, now: number, calm: boolean): void` draws, in order:
      1. the tinted floor;
      2. one pass over rows top to bottom: each row's blocks (top face, plus a front face only where the tile below is open), then everything whose feet are in that row, sorted by `y` (crystals, critters, the wyrm's pieces, the buddy, the hero, shots and effects);
      3. lantern light: a warm radial gradient around the hero of `4 × stats().lamp` tiles (so Enzo's is 30% wider), with the cave beyond it darkened, plus the pools of lit job lanterns;
      4. the rumble ring;
      5. the pod arrow at the screen edge, outlined damage numbers, and outlined Fluff bars over elites and the wyrm's head.
    - `type Fx`: the scene's own short-lived effects, fed by `addEvents(fx: Fx, events: CaveEvent[], calm: boolean)`. They are poofs, bonk stars, rock chips, crack stages, damage numbers, the level-up ring and shake. `calm` drops the shake and halves the poofs.
  - **Frame selection** (shared with Task 12):
    - `type Anim = { walk: number; idle: number; attack: { w: WeaponId; t: number } | null; flinch: number; dig: boolean }` per hero and buddy, and `type CritterAnim = { walk: number; flinch: number; dizzy: number; poof: number }` per critter.
    - `type AnimState = { hero: Anim; buddy: Anim; critters: Map<number, CritterAnim & { ghost?: Critter }> }`.
    - `animate(d: Dive, a: AnimState, events: CaveEvent[], dt: number)` advances walk frames by distance moved, at one frame per 0.18 tiles *(start)*. It starts an attack on `fire` for the sling (Enzo) or the pickaxe (Dora), a 0.15 s flinch on `hurt`, and on `bonk` keeps the critter's ghost for flinch → dizzy (0.25 s) → poof.
  - **Code drawings:**
    - heroes with `drawChinchilla`, flipped by `face.x`;
    - critters, blocks, the pod, lanterns, crates, crystals and the wyrm as simple shapes in the style test's palette;
    - every painter used later in Task 12 returns `false` here, so these are the fallback path.
  - **The page** `app/cave/page.tsx`:
    - **Screens:** `title | camp | dive | pick | pod | over`, on `main[data-screen]`, with `main[data-ready="true"]` after hydration.
    - **Loop:** a fixed-step loop on `requestAnimationFrame` that accumulates `dt`, capped at 0.1 s, steps at 60 Hz, and is paused while `document.hidden`, on `P`/`Escape` and on the pause button.
    - **Input:** WASD and arrow keys; a floating joystick from `pointerdown` anywhere on the stage, 60 px radius, drawn at the touch point; `1`/`2`/`3` and `R` on card screens.
    - **HUD:** DOM over the canvas, holding the Fluff bar, layer and timer (or the wyrm's bar), job and progress, gold, a top experience bar and four weapon slots with levels.
    - **Saving** follows Task 7's protocol, with every `localStorage` call in `try/catch`.
    - **Sound:** `makeSound('glimmer-cave-sound-v1', …)` with cues `sling bonk poof crystal level dig gold hurt podIncoming podReached rumble complete`. The crystal cue is throttled to 12 a second.
    - **Test hook:** `window.__cave()` returns `{ dive: Dive | null; profile: Profile; start(hero: Hero, hazard?: Hazard, seed?: number): void; set(patch: { level?: number; xp?: number; fluff?: number; timer?: number; layer?: LayerNo; weapons?: WeaponState[] }): void; setProfile(p: Profile): void }`.
    - **Test ids:** `continue camp mute pause hero-dora hero-enzo hazard-1…hazard-5 dive buy-<upgrade> card-0 card-1 card-2 reroll descend home stage fluff timer gold job slot-0…slot-3`.
    - **Layout:** the canvas fills the viewport with its backing store × `devicePixelRatio`, and nothing scrolls at 390 × 844 or 1280 × 860.

- [ ] **Step 1: Write the failing e2e** `tests/e2e/cave.mjs`, in the shape of `tests/e2e/trek.mjs` (`check`, `fresh`, `ONLY=`, `TRACE=1`). Each check covers the spec's list, except the art ones, which come in Task 12:
  - **Hydration:** a fresh title has no Continue.
  - **Each hero:** `hero-dora` then `dive` starts with the pickaxe in slot 0; likewise Enzo with the sling.
  - **Keys and digging:** holding `ArrowRight` moves the hero. Placing the hero beside dirt with `set` and holding the key into it digs it.
  - **A card and a reroll:** `set({ xp })` to the threshold opens the pick screen. `card-0` adds a card, and `reroll` works once, then is disabled.
  - **The pod:** `set({ timer: 0.1 })` lands the pod. Moving the hero onto it through the hook shows the summary with gold banked, and `descend` starts layer 2.
  - **Continue after a reload:** reload at the pod summary, and Continue starts the next layer.
  - **An overclock offer:** `set({ weapons: [{ …sling at level 4 }] })` plus a level-up offers exactly the sling's two overclocks.
  - **A camp upgrade:** `buy-fluffier` with the gold set by `setProfile` spends it, and the level shows.
  - **Fit:** the stage and HUD fit at 390 × 844 and 1280 × 860.
  - **Mute** persists across a reload.
  - **No page errors.**
- [ ] **Step 2: Run** `node tests/e2e/cave.mjs` with `npm run dev` up. Expected: FAIL (a 404).
- [ ] **Step 3: Implement** the scene and the page.
- [ ] **Step 4: Run** `node tests/e2e/cave.mjs`. Expected: PASS. Then run `npm run typecheck`. Expected: clean.
  - Take screenshots into `.checks/cave/`: camp, layer 1 at 2:00, a 300-critter swarm, a pick, the pod run, the wyrm and the pod summary. Check each by eye.
  - On a 390 × 844 viewport with 300 critters, the frame time in the Performance panel should hold under 16 ms. Record the number in the PR.
- [ ] **Step 5: Commit** `Add Glimmer Cave's scene and page`. Open PR **"Make Glimmer Cave playable with code drawings"**, wait for CI and the go-ahead, then merge. The route is live but not in the menu until Task 13.

---

### Task 11: The art import and the loader

**Files:**
- Create: `scripts/glimmer-cave-import.py`, `public/art/cave/{dora,enzo,critters,fx,environment,floor,wyrm}.png` (cleaned copies), `docs/glimmer-cave-crops.json`, `lib/glimmer-cave-crops.ts` (generated), `lib/glimmer-cave-paint.ts`, `tests/glimmer-cave-art.mjs`
- Modify: `package.json` (`tests/glimmer-cave-art.mjs` and the paint module in `test` and `test:cave`)

**Interfaces:**
- **The import script** `python3 scripts/glimmer-cave-import.py` reads the accepted sheets named in its `SOURCES` table. Today that's `enzo-animation-v2`, `dora-animation-v2`, `critters-animation-v2` and `fx-animation-v2`, with the round 2 sheets as they're accepted. For each, it:
  1. clears alpha below 32 to 0, snaps alpha ≥ 240 to 255, and sets RGB to 0 where alpha is 0;
  2. labels the connected pieces (alpha > 128, ≥ 30 px), as `scripts/cave-frame-review.py` does, and assigns each piece to the cell holding its centre. A frame's rect is the union of its cell's pieces plus 6 px;
  3. measures each frame's foot line as the lowest opaque row of its largest piece;
  4. computes `scale = target / median height of the sheet's walk or idle frames`, so the import normalises size at draw time and never resamples;
  5. writes the cleaned PNG to `public/art/cave/<name>.png`;
  6. writes `docs/glimmer-cave-crops.json` (`{ sheets: { name: { sha256, w, h } }, frames: { "<sheet>:<row>:<col>": { rect, foot, scale, flip } } }`) and regenerates `lib/glimmer-cave-crops.ts` from it.
  - Per-frame overrides live in the script's `FIX` table, with the reason in a comment. Today there is one: `dora:4:2` gets `flip: true`, because that frame faces left (per `docs/cave-survival-art.md`).
- **The crop tables** in `lib/glimmer-cave-crops.ts`:
  - `type CaveSheet = 'dora' | 'enzo' | 'critters' | 'fx' | 'environment' | 'floor' | 'wyrm'`;
  - `CAVE_HASHES: Record<CaveSheet, string>`, the first 12 hex digits of each cleaned file's SHA-256;
  - `type CaveFrame = { sheet: CaveSheet; rect: [number, number, number, number]; foot: number; scale: number; flip: boolean }`;
  - `CAVE_FRAMES: Record<string, CaveFrame>`;
  - named sequences, such as `HERO_ANIMS: Record<Hero, { walk: string[]; attack: string[]; idle: string[]; blink: string; flinch: string; dizzy: string; recover: string; dig: string[]; cheer: string[] }>`, `CRITTER_ANIMS`, `FX_ANIMS`, `BLOCKS` and `WYRM_PARTS`.
- **The loader** `lib/glimmer-cave-paint.ts`, on `lib/chinchilla-trek-paint.ts`'s pattern:
  - `subscribeCaveArt`, `caveArtVersion`, `caveArtServerVersion`, `caveArtUrl(s) = /art/cave/<s>.png?v=<hash>`, `requestCaveArt`, `caveArtStatus`, `retryCaveArt` and `caveArtReady`;
  - a size check against `CAVE_HASHES`' recorded `w`/`h`;
  - `frameCanvas(key: string, px: number, dpr: number): HTMLCanvasElement | null`, which draws the frame once to an off-screen canvas at its display height × dpr, scaled by `scale`, flipped if `flip`, cached by `key:px:dpr`, and returns null until the sheet is ready;
  - painters that return `false` while pending or failed: `paintCaveFrame(c, key, x, footY, heightPx, mirror)`, `paintCaveBlock(c, block, stage, x, y, tilePx)` and `paintCaveFloor(c, view, tint)`.
  - The fallback order from the spec: the sheet, then the `sprites-0.png` pose (one more asset, `sprites`, with its own crops), then code.

- [ ] **Step 1: Write the failing test** `tests/glimmer-cave-art.mjs`, on the trek art test's pattern:
  - `files: every cleaned sheet exists, is 1536 × 1024 (the floor 1024 × 1024), and matches its recorded hash; URLs carry the first 12 hex`;
  - `files: no pixel has alpha between 1 and 31, or above 239 and below 255` (decode the PNG with `zlib.inflateSync` and the PNG filters; the sheets are 8-bit RGBA);
  - `frames: every frame's rect lies inside its own cell; every row of a character sheet has foot lines within 6 px after scale`;
  - `frames: every sequence names existing frames, and dora:4:2 is flipped`;
  - `loader: one request per file, failures, Retry, stale callbacks and wrong sizes`, copying the trek's loader tests with a fake `Image`.
- [ ] **Step 2: Run** `npm run test:cave`. Expected: FAIL.
- [ ] **Step 3: Implement** the script and run it, then implement the loader.
- [ ] **Step 4: Run** `npm run test:cave` and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Import Glimmer Cave's painted sheets`.

---

### Task 12: Painted animation in the scene

**Files:**
- Modify: `lib/glimmer-cave-scene.ts`, `app/cave/page.tsx`, `app/cave/cave.css`, `tests/e2e/cave.mjs`

**Interfaces:**
- Consumes: Task 11's painters and sequences, and Task 10's `Anim`.
- Decisions:
  - Every draw tries the painter first and falls back to Task 10's code drawing in the same frame.
  - **Heroes:**
    - walk frames advance by distance;
    - idle breathes at 2 frames, 0.5 s each, with a blink every 3–5 s;
    - attack frames play over the weapon's swing (Dora's pickaxe) or throw (Enzo's sling) at 0.06 s a frame;
    - flinch shows for 0.15 s;
    - dig frames play while `d.digging` (Enzo uses his walk frames pushing);
    - cheer frames play at the pod summary.
  - **Critters:** a 4-frame walk by distance; flinch; dizzy for 0.25 s; then `fx` dust poof frames 1–6 at 0.05 s.
  - **The sling's acorn** spins through the 4 acorn frames plus a quarter turn per frame (per `docs/cave-survival-art.md`).
  - **Blocks** use the environment's crack stages by dig progress: gold → cracked at ⅓ → crumbling at ⅔.
  - **The floor** is the tile, tinted per layer with a `multiply` fill.
  - **Elites** get a warm rim from drawing the frame at 1.6× with a `source-atop` tint pass on the cached canvas.
  - **A Retry artwork button** (test id `retry-art`) shows when `caveArtStatus().failed` is not empty, as in the trek.
  - The page asks for the hero sheets at camp, and the rest at dive start.

- [ ] **Step 1: Add the failing e2e checks:**
  - **Painted:** after load, `__cave()` reports every sheet ready, and a canvas pixel at the hero's position matches the painting, not the code drawing. Probe the code drawing's flat colour, which the painting never has.
  - **Slow art:** with `route` delaying `/art/cave/*` by 3 s, the dive plays at once with code drawings, then switches to paintings.
  - **Failed art:** with `/art/cave/critters.png` aborted, the game plays, `retry-art` shows, unblocking and clicking it loads the sheet, and the button disappears.
- [ ] **Step 2: Run** `node tests/e2e/cave.mjs`. Expected: the new checks FAIL.
- [ ] **Step 3: Implement** the wiring.
- [ ] **Step 4: Run** `node tests/e2e/cave.mjs`, `npm test` and `npm run typecheck`. Expected: PASS. Retake the Task 10 screenshots with paintings and check each by eye: facing, foot lines on the floor, the 48 px heroes, and critters readable on the purple. Check the 300-critter frame time again.
- [ ] **Step 5: Commit** `Paint Glimmer Cave with its animation sheets`. Open PR **"Paint Glimmer Cave"**, wait for CI and the go-ahead, then merge.

---

### Task 13: Into the arcade

**Files:**
- Modify:
  - `app/page.tsx` (`GAMES`, 38th after Chinchilla Trek, and the counts);
  - `app/layout.tsx`;
  - every file the README's **Adding a game** checklist names, from thirty-seven to thirty-eight, including the number word in `tests/readme.mjs` and the `panel-contrast` route list;
  - `README.md` (the count, the row `| 38 | Glimmer Cave | \`/cave\` | Cave survival |`, and the guide with **Play**, **Controls**, **Tests** and **Docs**, written from the code);
  - `CHANGELOG.md`;
  - `HANDOFF.md`;
  - `package.json` (add `test:e2e:cave` to `test:e2e:newest`).
- Create: `docs/glimmer-cave.md` (how to play, the numbers from `lib/glimmer-cave-data.ts`, the art pipeline, the saves and the tests).

- [ ] **Step 1: Run** `npm test`. Expected: PASS. Then add the `GAMES` card and run it again. Expected: FAIL in `tests/readme.mjs`.
- [ ] **Step 2: Update** every count and the README until `npm test` passes. Then run the browser suites that assert the count (`ONLY` isn't needed): `node tests/e2e/arcade-navigation.mjs` and `node tests/e2e/panel-contrast.mjs`. Expected: PASS.
- [ ] **Step 3: Write** `docs/glimmer-cave.md`, the CHANGELOG entry under today's date (**Added**, naming **Glimmer Cave**), and the HANDOFF state.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run build` and `node tests/e2e/cave.mjs`. Expected: all pass.
- [ ] **Step 5: Commit** `Add Glimmer Cave to the arcade`. Open PR **"Add Glimmer Cave to the arcade"**, wait for CI and the go-ahead, then merge. After the deploy, check `/cave` live: every art URL returns 200, there are no page errors, and a dive reaches the first pick.
