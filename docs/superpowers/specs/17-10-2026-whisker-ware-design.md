# Whisker Ware · design

Written 17-10-2026. The arcade's 35th game. Jason turned down Fluff Drop (a Suika-like) and Burrow Links (mini-golf) as boring, chose Whisker Ware from three new pitches, and picked: hosts plus an endless mode, pointer-plus-one-key controls, 20 microgames plus 4 bosses at launch, and synthesised sound. The painted art comes from ChatGPT through [`docs/whisker-ware-image-prompts.md`](../../whisker-ware-image-prompts.md); the game ships fully code-drawn first and swaps paintings in as they arrive.

## Why this game

Nothing in the arcade is like it. The 34 games are long runs, management loops, or one skill repeated; a microgame frenzy is learnt in one second and laughed at in five, plays as well on a phone as on a keyboard, and gives the cast (Dora, Enzo, and Acorn Hand's Owl and Fox) a stage to be silly on.

## The run

### Hosts

Four hosts, unlocked in order. Each has five microgames and a boss.

| # | Host | Stage | Theme |
| --- | --- | --- | --- |
| 0 | Enzo | Enzo's Snack Shack | food |
| 1 | Dora | Dora's Dust Spa | grooming |
| 2 | The Owl | Owl's Night Watch | stealth |
| 3 | The Fox | Fox's Trick Fair | carnival |

A host stage is **8 microgames** drawn from that host's five (each at least once, no game twice in a row), then the host's **boss**. Lives start at **4**. Losing a microgame costs a life and the stage moves on; losing the boss costs a life and the boss is played again. At 0 lives the stage is over and restarts from the beginning. Beating the boss clears the stage and unlocks the next host; clearing the Fox unlocks Remix.

Stage pacing (speed tiers below):

| Host | Games 1–4 | Games 5–8 and boss | Level |
| --- | --- | --- | --- |
| Enzo | tier 0 | tier 1 | 1 |
| Dora | tier 1 | tier 2 | 1 |
| The Owl | tier 2 | tier 3 | 2 |
| The Fox | tier 3 | tier 4 | 2 |

### Remix

All 20 microgames, endless, 4 lives, starting at tier 0, level 1. The speed tier rises by one after every 5 games cleared (cap tier 5). After every 10 games cleared a boss is played, rotating Enzo, Dora, Owl, Fox; beating it raises the level by one (cap 3). A boss counts as one game for the score. A lost boss costs a life and is played again. Score is games cleared; the best is saved.

### Practice

Opened from the gallery for any microgame cleared at least once (bosses included). That one game loops with 1 life; the tier rises by one after every 3 clears (cap 5) and the level by one after every 6 (cap 3). The best streak is saved per game.

### Two dials

- **Speed tier** `SPEEDS = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0]`. The engine runs `speed` simulation ticks per real tick (a fractional accumulator), so everything (falling, timers, the fuse) runs faster and a game's real length shrinks from 5 s to 2.5 s at tier 5.
- **Level** 1–3 adds content (more items, narrower windows, decoys), per game below.

### Timing

- The engine ticks at **60 Hz**. A microgame lasts **300 simulation ticks** (5 s at ×1); a boss up to **900** (15 s at ×1).
- When a microgame's outcome is decided early it plays on for **30 real ticks** so the win or loss can be seen, then ends. Survive games are decided at the last tick.
- Between games there is a **break** of 90 real ticks (60 at tier 4 and up) in the host's room: lives, the count, the host's reaction to the last game, and a "SPEED UP!" or "BOSS!" card when one is due (+45 ticks).
- The command word (for example `STUFF!`) shows for the first **48 simulation ticks** of each game while the game already runs and takes input.

## Input

The page turns pointer and keys into one raw frame per real tick; the engine derives taps, swipes and rubs from it so pointer and keyboard play are the same to the rules.

```ts
type Frame = {
  x: number; y: number;          // pointer in stage units (480 × 320), or -1 when there is none
  down: boolean;                  // pointer down or Space held
  left: boolean; right: boolean; up: boolean; dn: boolean; // arrow keys held
  pick: 0 | 1 | 2 | 3;            // 1–3 pressed this tick, else 0
};
```

The engine keeps the previous frame and derives `pressed`/`released` (edge of `down`), `swipe` (−1/+1: a pointer drag of ≥ 40 units between press and release, or an arrow press), and `rub` strokes (pointer x reversing direction after ≥ 12 units of travel while down, or ←/→ pressed alternately).

Steering games move the actor towards the pointer x at the game's top speed, or by the arrows at the same top speed. Pick games take a tap on an option or the 1–3 keys.

## The microgames

`win` and `lose` are the outcome rules; anything not decided by the last tick loses unless the game is a survive game (marked ⏳), which wins at the last tick.

### Enzo · Snack Shack

| Id | Command | Input | Rules | Level 2 / 3 |
| --- | --- | --- | --- | --- |
| `stuff` | STUFF! | mash | Each press puffs Enzo's cheeks; 14 presses win. | 18 / 22 presses |
| `catch` | CATCH! | steer | Raisins and pebbles fall one at a time; Enzo's bowl catches. All raisins caught wins; a pebble in the bowl or a raisin on the floor loses. The first pebble falls where Enzo starts. | 2 raisins 2 pebbles / 3 and 3 (L1: 1 and 1) |
| `sort` | SORT! | swipe | Items arrive one at a time: swipe acorns right into the jar, pebbles left onto the heap. All sorted wins; a wrong swipe loses. | 4 / 5 items (L1: 3) |
| `sniff` | SNIFF! | pick | A raisin goes under one of 3 cups, the cups swap, then a tap picks one. Right cup wins, wrong loses; taps during the shuffle are ignored. | 5 / 7 swaps (L1: 3) |
| `gnaw` | GNAW! | timing | A stick slides past Enzo's teeth; press while its notch is in the bite window. Early or late loses. | window 20 / 14 units (L1: 28) |
| `raisin` (boss) | RAISIN RAIN! | steer | Raisins and pebbles fall from 3 chutes, faster over time. 8 raisins caught wins; 3 pebbles caught loses. Missed raisins only cost time. | faster fall |

### Dora · Dust Spa

| Id | Command | Input | Rules | Level 2 / 3 |
| --- | --- | --- | --- | --- |
| `dust` | DUST! | rub | Each rub stroke thickens the dust cloud; 12 strokes win. | 16 / 20 |
| `balance` ⏳ | BALANCE! | steer | Dora tilts on a rolling bale; gusts push her and left/right (or the pointer's side of her) push back. Tilt past the limit loses. Untouched she falls within 2 s. | stronger gusts |
| `fluff` | FLUFF! | hold | Holding puffs Dora up; release with her size inside the band wins. Past the maximum she pops (loses); never releasing loses. | band 0.14 / 0.09 (L1: 0.20) |
| `hop` | HOP! | timing | Logs roll in; a press jumps a fixed arc. A log reaching Dora on the ground loses; all logs past wins. | 2 / 3 logs, uneven gaps (L1: 1) |
| `comb` | COMB! | drag | Tangles sit in her fur; the comb follows the pointer while down, or the arrows. A tangle within 18 units of the comb clears. All cleared wins. | 4 / 5 (L1: 3) |
| `shelf` (boss) | CLIMB! | timing | Shelves slide side to side; a press hops Dora up to the next shelf if she lands within it, otherwise she drops back one. Reaching shelf 8 (the hammock) wins. | faster shelves |

### The Owl · Night Watch

| Id | Command | Input | Rules | Level 2 / 3 |
| --- | --- | --- | --- | --- |
| `sneak` | SNEAK! | hold | Holding tiptoes Dora towards the acorn. The Owl cycles: back turned (random 72–132 ticks), a turning tell (24 ticks), watching (60 ticks). Moving while she watches loses; reaching the acorn wins. | tell 18 / 12 ticks |
| `hide` ⏳ | HIDE! | steer | A lantern beam sweeps across once; Enzo must be inside the shadow when it passes his x. Starts outside the shadow. | narrower shadow |
| `hush` | HUSH! | pick | Squeaky toys pop up at 3 fixed spots; tap a toy (or its 1–3 key) to hush it. A toy squeaking for 72 ticks wakes the Owl and loses. All hushed wins. | 4 / 5 toys (L1: 3) |
| `find` | FIND! | steer + press | Dark screen; the lantern circle follows the pointer or the arrows. A press with the acorn within 22 units of the centre wins; a press elsewhere does nothing. | a pinecone decoy / two; pressing on a decoy loses |
| `dodge` ⏳ | DODGE! | steer | Feathers fall; at least one aims at Dora's x when it spawns. A hit loses. | more, faster feathers |
| `moon` (boss) | DASH! | timing | Dora runs right across rooftops on her own; a press jumps. A gap or a low-swooping owl ends the run (loses); the flag at the end wins. | more hazards |

### The Fox · Trick Fair

| Id | Command | Input | Rules | Level 2 / 3 |
| --- | --- | --- | --- | --- |
| `pick` | PICK! | pick | The Fox shows a suit; three cards show their suits, flip face down, then a pick. The matching card wins. | 1 / 2 shuffles after flipping |
| `pop` | POP! | pick | Balloons rise in 3 lanes; a tap (or the lane's key) pops a lane's lowest balloon. All popped wins; one escaping the top loses. | 5 / 6 balloons (L1: 4) |
| `aim` | AIM! | hold | Drag back from the slingshot and release, or hold Space while the power swings 0→1→0 and release. Power inside the band hits the target and wins; anything else misses and loses. | narrower band; at L3 the target moves |
| `stack` | STACK! | timing | A crate swings on the crane; a press drops it. Landing with ≥ 60% overlap on the stack counts; less falls off and loses. | 3 / 4 crates (L1: 2) |
| `count` | COUNT! | pick | Acorns flash for 48 ticks, then three answers. The right count wins. | 5–8 / 7–11 (L1: 3–5) |
| `ring` (boss) | TOSS! | timing | Pegs slide along a row; a press throws a ring that lands 30 ticks later and scores if a peg centre is within 14 units. 5 of 8 wins. | faster pegs |

Every microgame must lose to a player who does nothing, and must be winnable at tier 5, level 3 by the test solver.

## Architecture

The usual split, with the microgame rules in their own file because there are 24 of them.

- **`lib/whisker-ware-micro.ts`**: the microgame table. Each entry is `{ id, verb, host, boss, input, ticks, init(rand, level), tick(state, frame), outcome(state) }`, with `state` a plain object (JSON-safe, so tests can inspect it). `input` is one of `mash | steer | swipe | pick | timing | rub | hold | drag` and picks the hint icon. Pure functions, no DOM.
- **`lib/whisker-ware-game.ts`**: `Rand` (copied from Acorn Hand), `SPEEDS`, `HOSTS`, the input deriver, and `Run` (mode `host | remix | practice`, host, lives, tier, level, cleared, phase `break | micro | over | clear`, the current microgame and its state). `Run.step(frame)` advances one real tick. Also `Profile` (`loadProfile`, `record`) for the save.
- **`lib/whisker-ware-scene.ts`**: Canvas 2D drawing of a 480 × 320 stage (3:2, matching ChatGPT's 1536 × 1024 output): one draw function per microgame, the break room, the command word, the fuse. Chinchillas use `drawChinchilla`; painted sheets replace drawings when loaded, the drawings stay as the fallback.
- **`app/whisker-ware/page.tsx`**: menu (host cards, Remix, gallery), the loop (`requestAnimationFrame` feeding `Run.step` at 60 Hz), pointer and key capture into `Frame`s, HUD, mute toggle, saving. Exposes `window.__ware()` and sets `main[data-ready="true"]` after hydration.
- **Sound**: `makeSound('whisker-ware-sound', …)` from `lib/cue-sound.ts`: a tick on each beat of the fuse (pitch up with the tier), win and lose jingles, speed-up fanfare, boss sting, a per-game action blip.

### Feel

A fuse burns down along the bottom of the stage; the stage shakes on a loss; the host cheers or winces in the break; the command word slams in with a scale bounce.

## Saving

`localStorage` key `whisker-ware-v1`, the profile only (runs are short and not saved mid-way):

```ts
type Profile = { v: 1; hosts: number; remixBest: number; games: Record<string, { tier: number; streak: number }> };
```

`hosts` is how many stages are cleared (0–4). `games[id].tier` is the highest tier the game has been won at (−1 or absent: never won), `streak` the Practice best. `loadProfile` returns a fresh profile for anything malformed, and drops unknown ids.

## Testing

- **`tests/whisker-ware.mjs`** (engine, in `npm test`): for every microgame, at levels 1–3 and tiers 0 and 5, a scripted solver (in `tests/whisker-ware-solvers.mjs`, reading the state) wins and an idle frame stream loses, over several seeds. Same seed and frames give the same result. The input deriver (press, release, swipe, rub from pointer and from keys). Stage rules (8 games, each of the host's five at least once, no repeats in a row, tier switch after 4, boss retry costs a life, game over at 0, clear unlocks). Remix (tier every 5, boss every 10 rotating, level after a boss, caps). Practice. Profile load, record and validation.
- **`tests/whisker-ware-bot.mjs`** (in `npm test`): a player with a 15-tick reaction delay (±5) and 4% fumbles, built on the solvers. Gates over 300 seeds: Enzo's stage cleared ≥ 85%, the Fox's ≥ 50%, each stage harder than the one before, and the Remix median score between 20 and 45. It should run in under 30 s.
- **`tests/e2e/whisker-ware.mjs`** (Playwright): hydration; start Enzo's stage, win a game through `__ware()`-driven input and lose one, check lives and the break; keyboard play; gallery and Practice; the stage fits without scrolling at 390 × 844 and 1280 × 860; no page errors. Later, `whisker-ware-painted.mjs` once art lands.

## Arcade integration

The README **Adding a game** checklist in full: the `GAMES` card (35th, after Acorn Hand), every hardcoded count (thirty-four → thirty-five, `tests/readme.mjs` number list), the README table row (`| 35 | Whisker Ware | \`/whisker-ware\` | Microgame frenzy |`) and guide, `docs/whisker-ware.md`, the `test:whisker-ware`, `bot:whisker-ware` and `test:e2e:whisker-ware` scripts, and a CHANGELOG entry.

## Out of scope

Two-player mode, a daily seed, more than 24 games, music beyond the cue blips, and online scores.
