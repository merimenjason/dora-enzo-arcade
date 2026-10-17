# Whisker Ware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Whisker Ware, the arcade's 35th game: a WarioWare-style microgame frenzy with four hosts, 20 microgames and 4 bosses, Remix, a gallery with Practice, synthesised sound, and the painted art already in `public/art/whisker-ware/`.

**Architecture:** A deterministic engine (`lib/whisker-ware-game.ts`: input deriver, clock, `Run`, `Profile`) drives a table of 24 pure microgames (`lib/whisker-ware-micro.ts`). A Canvas 2D scene (`lib/whisker-ware-scene.ts`) draws a 480 × 320 stage, painting with `lib/whisker-ware-paint.ts` and falling back to code drawings. The page (`app/whisker-ware/page.tsx`) runs a fixed 60 Hz loop, turns pointer and keys into `Frame`s, and saves the profile.

**Tech Stack:** TypeScript, React (Next/vinext client page), Canvas 2D, WebAudio through `lib/cue-sound.ts`, Node `assert` tests compiled with `tsc` into `.checks/`, Playwright for e2e.

**Spec:** [`docs/superpowers/specs/17-10-2026-whisker-ware-design.md`](../specs/17-10-2026-whisker-ware-design.md). Art: [`docs/whisker-ware-integration.md`](../../whisker-ware-integration.md) and [`docs/whisker-ware-art.md`](../../whisker-ware-art.md).

## Global Constraints

- Work on branch `feat/whisker-ware`; pushing to `main` deploys. Never stage `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs` or `.claude/skills/graft/SKILL.md`; stage files by name.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Engine files import siblings with a `.js` extension (`import { … } from './whisker-ware-micro.js'`), as `lib/acorn-hand-game.ts` does, so `tsc` output runs in Node.
- Engines have no DOM and no `Math.random`; randomness only from the seeded `Rand`.
- Engine tick is 60 Hz. `SPEEDS = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0]`. Microgame `ticks = 300`, boss `ticks = 900` (simulation ticks). Decided early → hold 30 real ticks. Break 90 real ticks (60 at tier ≥ 4), +45 when a "SPEED UP!" or "BOSS!" card is due. Command shows for the first 48 simulation ticks.
- Stage 480 × 320 logical units; backdrops are 1536 × 1024 (`sourceX * 480 / 1536`, `sourceY * 320 / 1024`).
- Lives 4 in host stages and Remix; 1 in Practice.
- Save key `whisker-ware-v1`; sound key `whisker-ware-sound`.
- Don't run `oxfmt`. Match the hand-formatted style of neighbouring files (Acorn Hand's).
- Markdown dates are dd-mm-yyyy. Every user-visible change gets a CHANGELOG entry under `## 17-10-2026` (or the day's date).
- Playwright is installed locally with `npm i -D playwright`; never commit that `package.json`/lockfile change.
- Scratch files go in `.checks/` and are deleted afterwards.

## Review Focus

1. **A pointer released outside the canvas** must release `down`; a held SNEAK or FLUFF must not stay held forever. Pinned in Task 9's e2e (`pointerup` on `document`).
2. **Returning to a backgrounded tab** must not fast-forward the game: the loop runs at most 4 real ticks per animation frame and pauses while `document.hidden`. Pinned in Task 9's e2e.
3. **One tap at tier 5** (two simulation ticks per real tick) must count once, not twice. Pinned in Task 2's test `edges fire on the first sim step only`.
4. **A malformed or old save** must give a fresh profile, never a crash or a half-unlocked menu. Pinned in Task 7's profile tests.
5. **Resizing or rotating the phone mid-game** must keep taps landing where they are drawn: pointer → stage mapping is computed from the canvas's current bounding box at each event. Pinned in Task 9's e2e (resize, then tap a SNIFF cup by its stage coordinates).

---

### Task 1: Ship the environments as WebP

The 28 opaque backdrops and rooms are about 2.3 MB each as PNG; WebP at quality 85 is about 150–200 KB with no visible loss. Sprite sheets and the title keep PNG (they need alpha).

**Files:**
- Modify: `lib/whisker-ware-crops.ts` (`WARE_HASHES`; add `WARE_EXT`)
- Modify: `lib/whisker-ware-paint.ts:19` (`wareArtUrl`)
- Modify: `docs/whisker-ware-generation.json` (`finalAssets`: add `delivered` per environment)
- Modify: `tests/whisker-ware-art.mjs`, `tests/e2e/whisker-ware-painted.mjs` (if it names `.png` for environments)
- Delete: the 28 `public/art/whisker-ware/{bg,room}-*.png`; Create: the 28 matching `.webp`
- Modify: `docs/whisker-ware-art.md`, `docs/whisker-ware-integration.md` (one paragraph each), `CHANGELOG.md`

**Interfaces:**
- Produces: `WARE_EXT: Record<WareAsset, 'png' | 'webp'>`; `wareArtUrl(key)` → `/art/whisker-ware/${key}.${WARE_EXT[key]}?v=${WARE_HASHES[key]}`. Everything else in the loader API is unchanged.

- [ ] **Step 1: Write the failing test.** In `tests/whisker-ware-art.mjs`, replace the per-asset PNG loop with one that branches on `asset.delivered`:

```js
const envs = manifest.finalAssets.filter((a) => /^(bg|room)-/.test(a.file));
assert.equal(envs.length, 28);
let envBytes = 0;
for (const asset of manifest.finalAssets) {
  const key = asset.file.replace(/\.png$/, '');
  if (/^(bg|room)-/.test(key)) {
    assert.ok(asset.delivered, `${key} records its delivered WebP`);
    const webp = await readFile(new URL(`../public/art/whisker-ware/${key}.webp`, import.meta.url));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF'); assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
    assert.equal(webp.toString('ascii', 12, 16), 'VP8 ', `${key} is lossy WebP`);
    assert.equal(webp.readUInt16LE(26) & 0x3fff, 1536); assert.equal(webp.readUInt16LE(28) & 0x3fff, 1024);
    assert.equal(createHash('sha256').update(webp).digest('hex'), asset.delivered.sha256);
    assert.ok(webp.length <= 400 * 1024, `${key} is at most 400 KB (${webp.length})`);
    assert.equal(art.WARE_EXT[key], 'webp');
    assert.match(art.wareArtUrl(key), new RegExp(`${key}\\.webp\\?v=${asset.delivered.sha256.slice(0, 12)}`));
    envBytes += webp.length;
  } else {
    // keep the existing PNG checks (hash, 1536 × 1024, colour type, URL hash) unchanged
  }
}
assert.ok(envBytes <= 8 * 1024 * 1024, `all environments together stay under 8 MB (${envBytes})`);
```

- [ ] **Step 2: Run it.** `npm run test:whisker-ware-art` → FAIL: `bg-aim records its delivered WebP`.

- [ ] **Step 3: Convert.** For each of the 28 environments: `python3 -I` with Pillow, `Image.open(png).convert('RGB').save(webp, 'WEBP', quality=85, method=6)`. Write each `delivered: { file, sha256, bytes, quality: 85 }` into its `finalAssets` entry (the original PNG `sha256` stays as provenance). `git rm` the 28 PNGs; the originals remain in git history at `b0fa421`.

- [ ] **Step 4: Point the loader at them.** Add `WARE_EXT` to `lib/whisker-ware-crops.ts` (`'webp'` for every `bg-`/`room-` key, `'png'` otherwise), set those keys' `WARE_HASHES` to the first 12 hex of the WebP sha256, and use `WARE_EXT` in `wareArtUrl`.

- [ ] **Step 5: Run the suites.** `npm run test:whisker-ware-art` → PASS. With Playwright installed, `npm run test:e2e:whisker-ware-art` → PASS (it already checks opaque 3:2 backgrounds; fix any `.png` assumptions for environments in it).

- [ ] **Step 6: Docs and commit.** One sentence in each of `docs/whisker-ware-art.md` and `docs/whisker-ware-integration.md` ("Environments ship as quality-85 WebP, about 6% of the PNG size; the PNG originals are at `b0fa421`"). CHANGELOG **Changed**: "**Whisker Ware**: backdrops ship as WebP, cutting the art download from 63 MB to about 5 MB." Commit `Ship Whisker Ware backdrops as WebP`.

---

### Task 2: Engine core — input, clock and the microgame contract

**Files:**
- Create: `lib/whisker-ware-game.ts`, `lib/whisker-ware-micro.ts`, `tests/whisker-ware.mjs`, `tests/whisker-ware-solvers.mjs`
- Modify: `package.json` (`test` tsc and node lists; `test:whisker-ware`)

**Interfaces:**
- Produces, in `lib/whisker-ware-game.ts`:
  - `class Rand` (copy Acorn Hand's: `constructor(seed: number)`, `next(): number` in [0, 1), `int(n: number): number`, `pick<T>(a: readonly T[]): T`, `shuffle<T>(a: T[]): T[]`).
  - `const SPEEDS: readonly number[]`.
  - `type Frame = { x: number; y: number; down: boolean; left: boolean; right: boolean; up: boolean; dn: boolean; pick: 0 | 1 | 2 | 3 }` and `const IDLE: Frame` (x = y = −1, everything off).
  - `type Input = Frame & { pressed: boolean; released: boolean; swipe: -1 | 0 | 1; rub: boolean; steer: -1 | 0 | 1 }` (`steer` from ←/→ held).
  - `class Pad { read(f: Frame): Input }` — derives edges from the previous frame: `pressed`/`released` on `down`; `swipe` −1/+1 from a pointer drag of ≥ 40 units between press and release, or from a ← / → key press edge; `rub` true when pointer x reverses direction after ≥ 12 units of travel while down, or when ← and → are pressed alternately (each alternate press edge is one stroke).
  - `const calm = (i: Input): Input` — the same input with `pressed`, `released`, `rub` false and `swipe`, `pick` 0, used for every simulation step after the first in a real tick.
  - `class Clock { constructor(speed: number); steps(): number }` — fractional accumulator kept in integer hundredths (`Math.round(speed * 100)`), so 100 real ticks at ×1.15 give exactly 115 steps with no floating-point drift.
  - `simulate(id: MicroId, seed: number, level: Level, tier: number, drive: (s: any, t: number) => Frame): { result: 'win' | 'lose'; ticks: number }` — runs one microgame exactly as `Run` will (Pad, Clock, `calm` after the first step, 30-tick hold ignored), `t` is the real tick; returns the outcome (survive games win at the last tick, others lose).
- Produces, in `lib/whisker-ware-micro.ts`:
  - `type Level = 1 | 2 | 3`; `type Outcome = 'win' | 'lose' | null`; `type InputKind = 'mash' | 'steer' | 'swipe' | 'pick' | 'timing' | 'rub' | 'hold' | 'drag'`.
  - `const MICRO_IDS` — all 24 ids, host order: `stuff catch sort sniff gnaw raisin dust balance fluff hop comb shelf sneak hide hush find dodge moon pick pop aim stack count ring`; `type MicroId = typeof MICRO_IDS[number]`.
  - `interface Micro<S extends { t: number; result: Outcome } = any> { id: MicroId; verb: string; host: 0 | 1 | 2 | 3; boss: boolean; input: InputKind; ticks: number; survive: boolean; init(rand: Rand, level: Level): S; tick(s: S, i: Input): void; outcome(s: S): Outcome }` — `tick` mutates `s`, increments `s.t`, and sets `s.result` once decided; `outcome` returns `s.result`. States are plain JSON-safe objects whose drawable things carry stage-unit positions.
  - `const MICROS: Partial<Record<MicroId, Micro>>` (filled by Tasks 3–6), `const HOST_GAMES: readonly MicroId[][]` (each host's five), `const HOST_BOSS: readonly MicroId[]` (`raisin shelf moon ring`).
  - `Rand`, `Frame`, `IDLE` and `Input` live in `lib/whisker-ware-micro.ts` and are re-exported from `lib/whisker-ware-game.ts`; the game file imports the micro file, never the reverse.
- Produces, in `tests/whisker-ware-solvers.mjs`: `export const SOLVERS = {}` keyed by `MicroId`, each `(s, t) => Frame` (Tasks 3–6 fill it); `export const READY_HOSTS = []` (Tasks 3–6 push their host index).

- [ ] **Step 1: Write the failing tests** in `tests/whisker-ware.mjs`, importing from `../.checks/whisker-ware-game.js`:

```js
test('press, release and edges', () => {
  const p = new Pad();
  assert.equal(p.read({ ...IDLE, down: true }).pressed, true);
  assert.equal(p.read({ ...IDLE, down: true }).pressed, false);
  assert.equal(p.read(IDLE).released, true);
});
test('pointer swipe needs 40 units; arrow press swipes', () => {
  const p = new Pad();
  p.read({ ...IDLE, x: 200, y: 160, down: true }); assert.equal(p.read({ ...IDLE, x: 239, y: 160 }).swipe, 0);
  p.read({ ...IDLE, x: 200, y: 160, down: true }); assert.equal(p.read({ ...IDLE, x: 241, y: 160 }).swipe, 1);
  assert.equal(p.read({ ...IDLE, left: true }).swipe, -1); assert.equal(p.read({ ...IDLE, left: true }).swipe, 0);
});
test('rubs: pointer reversals after 12 units, alternating arrows', () => {
  const p = new Pad(); let n = 0;
  for (const x of [100, 115, 100, 115]) n += p.read({ ...IDLE, x, y: 100, down: true }).rub ? 1 : 0;
  assert.equal(n, 2); // reversals at 115→100 and 100→115, each after 15 units of travel
  const w = new Pad(); let s = 0;
  for (const x of [100, 105, 100, 105]) s += w.read({ ...IDLE, x, y: 100, down: true }).rub ? 1 : 0;
  assert.equal(s, 0); // 5-unit wiggles are not rubs
  const k = new Pad(); let m = 0;
  for (const f of [{ left: true }, {}, { right: true }, {}, { right: true }, {}, { left: true }]) m += k.read({ ...IDLE, ...f }).rub ? 1 : 0;
  assert.equal(m, 2); // right after left, left after right; right twice is one stroke
});
test('clock accumulates fractional speed', () => {
  const c = new Clock(1.15); let n = 0; for (let i = 0; i < 100; i++) n += c.steps(); assert.equal(n, 115);
});
test('edges fire on the first sim step only', () => {
  const i = new Pad().read({ ...IDLE, down: true, pick: 2 });
  const q = calm(i); assert.equal(q.pressed, false); assert.equal(q.pick, 0); assert.equal(q.down, true);
});
test('every ready host is complete and solvable, idle loses, replays match', () => {
  for (const h of READY_HOSTS) for (const id of [...HOST_GAMES[h], HOST_BOSS[h]]) {
    const m = MICROS[id]; assert.ok(m, `${id} is registered`); assert.ok(SOLVERS[id], `${id} has a solver`);
    assert.equal(m.ticks, m.boss ? 900 : 300); assert.equal(m.host, h);
    for (const level of [1, 2, 3]) for (const tier of [0, 5]) for (let seed = 1; seed <= 6; seed++) {
      const a = simulate(id, seed, level, tier, SOLVERS[id]);
      assert.equal(a.result, 'win', `${id} L${level} tier ${tier} seed ${seed}: the solver wins`);
      assert.deepEqual(simulate(id, seed, level, tier, SOLVERS[id]), a, `${id} replays exactly`);
      assert.equal(simulate(id, seed, level, tier, () => IDLE).result, 'lose', `${id} L${level} tier ${tier} seed ${seed}: idle loses`);
    }
  }
});
```

Use a tiny local `test(name, fn)` that runs and reports, as `tests/acorn-hand.mjs` does.

- [ ] **Step 2: Wire the scripts.** Add `lib/whisker-ware-game.ts` to the `tsc` list and `node tests/whisker-ware.mjs` to the node list of `test`; add `"test:whisker-ware": "tsc lib/whisker-ware-game.ts --target es2022 --module es2022 --moduleResolution bundler --outDir .checks --skipLibCheck && node tests/whisker-ware.mjs"`. Run `npm run test:whisker-ware` → FAIL (`whisker-ware-game.ts` not found).

- [ ] **Step 3: Implement** the interfaces above. `MICROS` is `{}` for now.

- [ ] **Step 4: Run.** `npm run test:whisker-ware` → PASS (the solvability test loops over no hosts yet). `npm run typecheck` → clean.

- [ ] **Step 5: Commit** `Add Whisker Ware's input, clock and microgame contract`.

---

### Tasks 3–6: The microgames, one host per task

Each task registers its host's five microgames and boss in `MICROS` (one `const` object per game in `lib/whisker-ware-micro.ts`, grouped under a `// Enzo · Snack Shack` style comment) and their solvers in `SOLVERS`. The rules, win/lose conditions and level numbers are the spec's tables; this plan adds only what the spec leaves open.

**Rules that hold for all 24:**

- Fairness at tier 0, level 1: every cue gives at least 30 simulation ticks to react (a cup's last swap, a log's approach, the Owl's tell is the exception at 24, as the spec sets).
- Idle must lose: steering games spawn a hazard at the actor's start x within the first 90 ticks; hold games need a release; timing games need a press.
- Speeds are in stage units per simulation tick; the tier multiplies them through the Clock, never inside the microgame.
- Positions are stage units, y down. Actors stand on a `ground` y the scene can override for drawing only (art ground lines live in `WARE_SURFACES`); the engine's own floor is `y = 270` unless the game says otherwise.
- Pick games place their options at x = 120, 240, 360 so taps and the 1–3 keys agree; a tap counts within 50 units of an option's centre.
- Steering: if `i.steer` is non-zero the actor moves by `steer × top speed`; else if `i.x >= 0` it moves towards `i.x` capped at top speed.

**Solvers** read the state and return a raw `Frame`. They may use perfect knowledge (the hidden cup, the acorn's spot); the bot in Task 8 adds human delay and fumbles.

**Steps for each host task (N = 3, 4, 5, 6; host h = N − 3):**

- [ ] **Step 1: Write the solvers** for the host's six games in `tests/whisker-ware-solvers.mjs` and push `h` onto `READY_HOSTS`.
- [ ] **Step 2: Run** `npm run test:whisker-ware` → FAIL: `<first id> is registered`.
- [ ] **Step 3: Implement** the six microgames.
- [ ] **Step 4: Run** `npm run test:whisker-ware` → PASS, all levels, tiers 0 and 5, seeds 1–6. If a game can't be won at tier 5 level 3 by its solver, loosen that game's tier-independent numbers (window, speed, count) within the spec's spirit and ledger a `Ruling:`.
- [ ] **Step 5: Commit** `Add <host>'s Whisker Ware microgames`.

### Task 3: Enzo · Snack Shack (host 0)

| Id | Decisions beyond the spec | Solver |
| --- | --- | --- |
| `stuff` | `cheeks` 0 → target; each `pressed` +1. | toggle `down` every tick |
| `catch` | bowl at y 260, half-width 34, top speed 6; items fall from y −20 at 2.4 + 0.3 × index, spawned 70 ticks apart. | steer to the falling raisin's x; when a pebble is lower than the next raisin and within 50 units, steer to 80 units away from it |
| `sort` | one item at a time at x 240, y 200; a new one 20 ticks after each sort. | `right` edge for acorns, `left` for pebbles, one key edge per item |
| `sniff` | cups at x 120/240/360, swap takes 24 ticks (L1), 18 (L2), 14 (L3); pick opens after the last swap. | track the raisin's cup; after the shuffle send `pick` 1–3 |
| `gnaw` | stick enters from the right at 3.2 units/tick; notch must be within `window/2` of tooth x 180 on the press. | press when \|notch − 180\| < 3 |
| `raisin` | chutes at x 120/240/360; an item every 40 ticks shrinking to 22; fall 2.6 → 4.2. | steer under the lowest raisin unless a pebble is in that chute and lower |

### Task 4: Dora · Dust Spa (host 1)

| Id | Decisions beyond the spec | Solver |
| --- | --- | --- |
| `dust` | `dust` 0 → target strokes, rendered as cloud size. | alternate `left`/`right` edges every 3 ticks |
| `balance` | `tilt` in [−1, 1], lose past ±1; drift 0.012/tick away from upright plus gusts; input changes tilt by 0.03/tick; pointer pushes towards the side of x relative to 240. | press `left` when tilt > 0.05, `right` when < −0.05 |
| `fluff` | `size` grows 0.008/tick while held; band centred at a random 0.55–0.8; pops at 1.0. | hold, release when `size` ≥ band centre |
| `hop` | Dora at x 120; logs roll at 3.4 from x 500; jump lasts 40 ticks. | press when the next log is 70 units away |
| `comb` | tangles placed in a 200 × 120 box round Dora; comb speed 7 via arrows. | move the pointer straight to each tangle in turn, `down` held |
| `shelf` | 8 shelves 34 units apart; shelf half-width 46, slides ±120 at 1.6 → 2.6/tick; Dora at x 240. | press when the next shelf's centre is within 20 units of 240 |

### Task 5: The Owl · Night Watch (host 2)

| Id | Decisions beyond the spec | Solver |
| --- | --- | --- |
| `sneak` | Dora x 40 → acorn x 420 at 2.2/tick while held; the Owl's phase times from the spec. | hold while the Owl's back is turned, release at the tell |
| `hide` | shadow 110 (L1), 80, 56 wide, random x; beam passes at tick 150; Enzo top speed 5, starts outside the shadow. | steer to the shadow's centre |
| `hush` | spots at x 120/240/360; a toy every 45 ticks; a spot holds one toy. | `pick` the oldest squeaking spot |
| `find` | acorn at a random point at least 60 units from the centre; lantern speed 6; decoys at least 60 units from the acorn. | move the lantern to the acorn, press when within 10 |
| `dodge` | Dora at y 270, top speed 5; feathers fall 2.2 with ±1.2 sway; one every 26 ticks; the first at Dora's x. | steer to the x farthest from any feather above y 150 |
| `moon` | auto-run 3/tick over 900 ticks; gaps 50–70 wide, swoops at head height; jump 44 ticks. | press 18 units before a gap's edge or a swoop |

### Task 6: The Fox · Trick Fair (host 3)

Also add the completeness test: `assert.equal(Object.keys(MICROS).length, 24)` and every `MICRO_IDS` entry has a solver.

| Id | Decisions beyond the spec | Solver |
| --- | --- | --- |
| `pick` | suits from Acorn Hand's four (0–3); face-up 60 ticks, then flip and shuffles (20 ticks each). | track the matching card, `pick` it |
| `pop` | lanes at x 120/240/360; balloons rise 1.4–2.2 from y 340, escape at y −30; spawned 30 ticks apart. | `pick` the lane whose lowest balloon is highest up |
| `aim` | power 0 → 1 → 0 over 90 ticks while held (keys); pointer power = drag distance / 120 capped at 1; band centre random 0.45–0.8. | hold Space, release when power is within the band and rising |
| `stack` | crane swing ±150 at 2.8/tick; crate 60 wide; drop falls 6/tick. | press when the crate's x is within 4 of the stack top's x |
| `count` | acorns placed without overlap in a 300 × 140 box; answers: the right count and two others within ±2, shuffled to the three slots. | `pick` the right slot once answers show |
| `ring` | pegs at y 230, 3 pegs 160 apart sliding at 1.8 → 2.6 with wrap; ring flight 30 ticks to y 230 at the thrower's x 240. | press when a peg will be within 6 of 240 in 30 ticks |

---

### Task 7: The run — stages, Remix, Practice and the profile

**Files:**
- Modify: `lib/whisker-ware-game.ts`, `tests/whisker-ware.mjs`

**Interfaces:**
- Consumes: `MICROS`, `HOST_GAMES`, `HOST_BOSS`, `Pad`, `calm`, `Clock`, `SPEEDS`, `Rand` (Task 2).
- Produces:
  - `const HOSTS = [{ id: 'enzo', name: 'Enzo', stage: "Enzo's Snack Shack" }, { id: 'dora', name: 'Dora', stage: "Dora's Dust Spa" }, { id: 'owl', name: 'The Owl', stage: "Owl's Night Watch" }, { id: 'fox', name: 'The Fox', stage: "Fox's Trick Fair" }] as const`.
  - `const STAGE_PACE = [{ tiers: [0, 1], level: 1 }, { tiers: [1, 2], level: 1 }, { tiers: [2, 3], level: 2 }, { tiers: [3, 4], level: 2 }]`.
  - `stageQueue(rand: Rand, host: number): MicroId[]` — 8 games, each of the host's five at least once, never the same twice in a row.
  - `type Mode = 'host' | 'remix' | 'practice'`; `type Phase = 'break' | 'micro' | 'over' | 'clear'`; `type WareEvent = 'command' | 'win' | 'lose' | 'speedup' | 'boss' | 'over' | 'clear'`.
  - `class Run { constructor(mode: Mode, seed: number, opt?: { host?: number; game?: MicroId }); readonly mode; host: number; lives: number; tier: number; level: Level; cleared: number; streak: number; phase: Phase; game: MicroId | null; state: any; last: Outcome; card: 'speedup' | 'boss' | null; t: number; wins: { id: MicroId; tier: number }[]; events: WareEvent[]; step(f: Frame): void; drain(): WareEvent[] }` — starts in `break`; `t` counts real ticks in the current phase; `drain()` returns and clears `events`.
  - `type Profile = { v: 1; hosts: number; remixBest: number; games: Record<string, { tier: number; streak: number }> }`; `freshProfile(): Profile`; `loadProfile(raw: string | null): Profile`; `record(p: Profile, run: Run): Profile` (pure; max-merges, so calling it twice is harmless); `unlocked(p: Profile): { hosts: boolean[]; remix: boolean; games: MicroId[] }`.
- Rules the spec leaves open, decided here:
  - Remix: `tier = min(5, floor(cleared / 5))`; a counter `sinceBoss` reaches 10 → the next game is the boss of host `bossCount % 4`; winning it resets `sinceBoss`, raises level (cap 3). Non-boss picks are uniform over the 20, never the previous game.
  - Practice: `tier = min(5, floor(streak / 3))`, `level = min(3, 1 + floor(streak / 6))`; the run is `over` at the first loss.
  - Card: in a host stage the `speedup` card shows before game 5 and the `boss` card before the boss; in Remix `speedup` when the tier rises, `boss` before a boss.

- [ ] **Step 1: Write the failing tests** (drive with a helper `play(run, decide)` that steps `Run` with `SOLVERS[run.game]` or `IDLE` per game according to `decide(run)` until `over` or `clear`):
  - `stage queue: 8 games, all five, no repeats in a row` over seeds 1–200 for each host.
  - `a host stage at the right pace`: Enzo's games 1–4 run at tier 0 and 5–8 plus the boss at tier 1, level 1; the Fox's at tiers 3/4, level 2.
  - `a perfect stage clears`: all wins → `phase === 'clear'`, `cleared === 9`, events contain `speedup`, `boss`, `clear` in that order.
  - `losing costs a life and moves on; losing the boss repeats it`: lose game 2 → lives 3 and game 3 starts; lose the boss twice then win → lives 2, `clear`.
  - `four losses end the stage`: → `phase === 'over'`.
  - `break lengths`: 90 real ticks at tier 0, 60 at tier 4, +45 with a card.
  - `remix pacing`: after 5 wins tier 1; the 11th game is Enzo's boss; after it level 2; the 22nd game is Dora's boss; tier caps at 5, level at 3.
  - `practice`: one game id only; tier after 3 wins is 1; first loss → `over`.
  - `profile: record unlocks and keeps bests`: clearing host 0 → `hosts: 1`; `remixBest` keeps the max; `games[id].tier` keeps the max tier won; `unlocked` opens Remix only at `hosts === 4`.
  - `profile: malformed saves load fresh` for `null`, `'nope'`, `'{"v":2}'`, `{"v":1,"hosts":9}`, `{"v":1,"hosts":-1}`, `hosts: 1.5`, `remixBest: "3"`, `games: []`, a game with `tier: 6`; and unknown game ids are dropped while known ones are kept.
- [ ] **Step 2: Run** `npm run test:whisker-ware` → FAIL (`stageQueue is not a function`).
- [ ] **Step 3: Implement** `Run` and the profile. The micro phase: each real tick, `const i = pad.read(f)`, then for `k < clock.steps()` call `micro.tick(state, k === 0 ? i : calm(i))` until decided or `state.t >= micro.ticks`; once decided, hold 30 real ticks, then apply the outcome (lives, cleared, streak, `wins`) and go to `break`, `over` or `clear`. Push `command` on entering `micro`.
- [ ] **Step 4: Run** `npm run test:whisker-ware` → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `Add Whisker Ware's stages, Remix, Practice and profile`.

---

### Task 8: The bot and the difficulty gates

**Files:**
- Create: `tests/whisker-ware-bot.mjs`
- Modify: `package.json` (node list of `test`; `bot:whisker-ware`), `lib/whisker-ware-micro.ts` (tuning only)

**Interfaces:**
- Consumes: `Run`, `SOLVERS`, `IDLE`, `Rand`.

- [ ] **Step 1: Write the bot.** A player is the solver seen through a delay: on each real tick it plays the solver's frame computed `d` ticks earlier, with `d = 15 + rand.int(11) − 5` drawn per game, and on 4% of games plays `IDLE` throughout (a fumble). Gates over seeds 1–300:

```js
assert.ok(rate[0] >= 0.85, `Enzo's stage clears ${rate[0]}`);
assert.ok(rate[3] >= 0.50, `the Fox's stage clears ${rate[3]}`);
for (let h = 1; h < 4; h++) assert.ok(rate[h] <= rate[h - 1] + 0.02, `stage ${h} is no easier than ${h - 1}`);
assert.ok(median >= 20 && median <= 45, `Remix median ${median}`);
```

Print the per-host clear rate, the Remix median and the per-game loss rate (sorted), and the run time; keep it under 30 s.

- [ ] **Step 2: Run** `node tests/whisker-ware-bot.mjs` (after the tsc step, via `"bot:whisker-ware": "tsc lib/whisker-ware-game.ts … && node tests/whisker-ware-bot.mjs"`). It is expected to fail at least one gate on the first run; that is the point of the step.
- [ ] **Step 3: Tune** the numbers in `lib/whisker-ware-micro.ts` named in Tasks 3–6 (never the spec's tier speeds or life count) until all gates pass, starting with the games at the top of the loss table. After each change rerun `npm run test:whisker-ware` (solvers must still win, idle still lose). Ledger each tuned value as a `Ruling:`.
- [ ] **Step 4: Add the bot to `npm test`** (node list) and run `npm test` → PASS.
- [ ] **Step 5: Commit** `Add Whisker Ware's bot and tune the microgames`; record the final rates in the commit body.

---

### Task 9: The scene, the page, sound and saving

**Files:**
- Create: `lib/whisker-ware-scene.ts`, `app/whisker-ware/page.tsx`, `app/whisker-ware/whisker-ware.css`, `tests/e2e/whisker-ware.mjs`
- Modify: `package.json` (`test:e2e:whisker-ware`)

**Interfaces:**
- Consumes: `Run`, `Profile` API (Task 7); `MICROS`, `HOSTS`; the paint loader (`paintWareBackdrop`, `paintWareHost`, `paintWareProp`, `paintWareTitle`, `prefetchWareMenu`, `prefetchWareHost`, `prefetchWareGame`, `subscribeWareArt`, `wareArtVersion`, `wareArtServerVersion`, `wareArtStatus`, `retryWareArt`, `WARE_SURFACES`); `makeSound` from `lib/cue-sound.ts`; `drawChinchilla` from `lib/chinchilla-art.ts`; Acorn Hand's `public/art/acorn-hand/suits.png` for PICK's card faces.
- Produces:
  - `lib/whisker-ware-scene.ts`: `const STAGE = { w: 480, h: 320 }`; `drawStage(c: CanvasRenderingContext2D, run: Run, now: number): void` — break room (backdrop, host in the mood of `run.last`, lives as four hay cubes, the count, the card) or the current microgame (backdrop, its draw function, the command word for the first 48 simulation ticks with a scale bounce, the fuse along the bottom, a short shake on a loss); `drawCard(c, id: MicroId, box: WareBox, tier: number | null): void` for the gallery (the backdrop thumbnail with the best speed, for example `×1.3`, or a locked silhouette when `tier` is `null`). Every painter call has a code-drawn fallback.
  - `window.__ware()` → `{ run: Run | null; profile: Profile; start(mode: Mode, opt?: { host?: number; game?: MicroId }, seed?: number): void; force(id: MicroId, level: Level, tier: number): void; stage(): { x: number; y: number; w: number; h: number } }` — `force` replaces the next microgame (for tests); `stage()` is the canvas's current client rect.
  - `main[data-ready="true"]` after hydration; `data-phase` on `main` mirrors `run.phase`; `data-testid` on menu buttons: `host-0`…`host-3`, `remix`, `gallery`, `practice-<id>`, `mute`, `retry-art`.
- Decisions:
  - Loop: `requestAnimationFrame`, a real-tick accumulator at 1000/60 ms, **at most 4 real ticks per animation frame**, paused while `document.hidden` (and the accumulator reset on return).
  - Input: pointer events on the canvas with `setPointerCapture`; `pointerup`/`pointercancel` also listened on `document`. Map client → stage with the canvas's `getBoundingClientRect()` at each event. Keys: Space → `down`, arrows, `1`–`3` → `pick` (one tick). `x = y = −1` when the pointer leaves on touch devices (`pointerType !== 'mouse'`).
  - Canvas: CSS-fitted to the largest 3:2 box in the viewport below the HUD, backing store × `devicePixelRatio`; no page scroll at 390 × 844 or 1280 × 860.
  - Sound cues: `tick` (on each quarter of the fuse; `step` = tier), `win`, `lose`, `speedup`, `boss`, `blip` (on `pressed` in a microgame).
  - Preloading: `prefetchWareMenu()` on mount, `prefetchWareHost(host)` on choosing a stage, `prefetchWareGame(next)` at the start of each break.
  - Saving: `record` + `localStorage.setItem('whisker-ware-v1', …)` on `over`, `clear` and unmount, inside `try/catch`.

- [ ] **Step 1: Write the failing e2e test** `tests/e2e/whisker-ware.mjs` (start like `tests/e2e/acorn-hand.mjs`: `http://localhost:3000/whisker-ware`, wait for `main[data-ready="true"]`, collect `pageerror`). Checks:
  - menu shows four host cards, only `host-0` enabled on a fresh profile; Remix locked;
  - start Enzo's stage; `force('sniff', 1, 0)`; drive the cup by clicking its stage coordinates (from `__ware().run.state` and `stage()`) → `run.last === 'win'` and the break shows lives 4;
  - `force('stuff', 1, 0)` and do nothing → lives 3, `data-phase` returns to `micro` after the break;
  - keyboard: `force('sort', 1, 0)` and press arrows per item → win;
  - **pointer released outside**: `force('fluff', 1, 0)`, `mouse.down()` on the canvas, move outside the window bounds, `mouse.up()` → `run.state` reports not held on the next tick;
  - **backgrounded tab**: record `run.state.t`, dispatch `visibilitychange` with `document.hidden` stubbed true for 1 s, then false → `t` advanced by at most 4 ticks across the return;
  - **resize mid-game**: `force('sniff', 1, 0)`, set the viewport to 844 × 390, wait for the shuffle, click the right cup by stage coordinates → win;
  - every one of the 24 ids: `force(id, 3, 5)` then 40 frames with no page error and a non-blank canvas (pixel sample);
  - gallery lists 24 cards; after a win, the SNIFF card shows `×1.0` and `practice-sniff` opens Practice with 1 life;
  - stage fits with no scroll at 390 × 844 and 1280 × 860; mute toggles and persists across reload.
- [ ] **Step 2: Run** with `npm run dev` up: `node tests/e2e/whisker-ware.mjs` → FAIL (404 / no `data-ready`).
- [ ] **Step 3: Implement** the scene and the page. Draw each microgame from its state; use the painted props named in `WARE_PROPS` (for example `paintWareProp(c, 'enzo', 'enzo-stuffed', box)` scaled by `cheeks`), and the measured ground lines from `WARE_SURFACES` for actors on painted floors.
- [ ] **Step 4: Run** `node tests/e2e/whisker-ware.mjs` → PASS; `npm run typecheck` → clean. Look at it: screenshot each host's break and two microgames per host into `.checks/whisker-ware/` and check them by eye (readable at a glance, actors on the floor, command word legible over every backdrop).
- [ ] **Step 5: Commit** `Add Whisker Ware's scene and page`.

---

### Task 10: Into the arcade

**Files:**
- Modify: `app/page.tsx` (`GAMES`, counts), `app/layout.tsx`, `README.md`, `tests/readme.mjs`, the e2e files named in the README **Adding a game** checklist, `tests/e2e/panel-contrast.mjs`, `package.json` (`test:e2e` chain), `CHANGELOG.md`, `HANDOFF.md`
- Create: `docs/whisker-ware.md`

- [ ] **Step 1: Run** `npm test` after adding the `GAMES` card only → FAIL in `tests/readme.mjs` (README and `GAMES` disagree). Card: `{href:'/whisker-ware',title:'Whisker Ware',tag:'NEW · MICROGAME FRENZY',blurb:'Twenty five-second games in a row, faster and faster: stuff Enzo\'s cheeks, sneak past the Owl and pop the Fox\'s balloons before the fuse burns out.',color:'#e0784a',art:'⚡'}` after Acorn Hand; drop `NEW · ` from Acorn Hand's tag only if the other cards show one `NEW` at a time (check the current cards and follow them).
- [ ] **Step 2: Follow the checklist** in `README.md` "Adding a game" in full: thirty-four → thirty-five and 34 → 35 everywhere it lists, the next number word in `tests/readme.mjs`, the README row `| 35 | Whisker Ware | \`/whisker-ware\` | Microgame frenzy |`, and a `### 35 · Whisker Ware (\`/whisker-ware\`)` guide with **Play**, **Controls**, **Tests** and **Docs** written from the code.
- [ ] **Step 3: Write `docs/whisker-ware.md`**: hosts, the 24 games with their commands and inputs, pacing (tiers, levels, breaks), Remix and Practice rules, saving, the bot's final rates, and the art pipeline (painted with code fallbacks, WebP environments).
- [ ] **Step 4: Run** `npm test` → PASS; `npm run typecheck`; `npm run build` → PASS; with `npm run dev`, `node tests/e2e/whisker-ware.mjs`, `node tests/e2e/arcade-navigation.mjs`, `node tests/e2e/panel-contrast.mjs` and `npm run test:e2e:whisker-ware-art` → PASS. Add `node tests/e2e/whisker-ware.mjs` to the `test:e2e` chain.
- [ ] **Step 5: CHANGELOG and HANDOFF.** CHANGELOG **Added**: "**Whisker Ware**: the arcade's 35th game, a microgame frenzy. Four hosts (Enzo, Dora, the Owl and the Fox) each throw five five-second games and a boss at you, faster and faster; clear all four for the endless Remix, and practise any game you've beaten from the gallery. Plays by tap, click or keyboard, with painted art and synthesised sound." HANDOFF: replace next-step item 7 with the shipped state and what's left (play-testing, more microgames).
- [ ] **Step 6: Commit** `Add Whisker Ware to the arcade`.
