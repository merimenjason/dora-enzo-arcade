# Hay Bale Brawl · design

Written 18-10-2026. The arcade's 36th game. From four pitches (Pebble Putt mini-golf, Burrow Beat rhythm, Hay Bale Brawl auto-battler, Pup Rescue lemmings) Jason chose Hay Bale Brawl and asked for the design without a question round, so every choice below is Claude's call, made to fit the arcade's patterns. Push back on any of them before the plan is written. The game ships code-drawn first; painted art follows through a ChatGPT prompts doc written after this design is approved, as Whisker Ware's was.

## Why this game

Nothing in the arcade plays itself. Acorn Hand and Summit Shuffle are runs where you build something, but you play every hand yourself; here all the thinking happens in the shop, and then you lean back and watch your crew of woodland critters brawl it out on a hay bale. It is quick to learn (buy, line up, watch), each turn takes under a minute, and a run of ten wins is a single sitting. The fights are deterministic from a seed, so the engine and bots fit the house pattern exactly.

The model is Super Auto Pets (a line of five, fights resolved front to front, abilities on triggers), not Teamfight Tactics (a grid, positioning, mana). A line reads on a phone; a grid does not.

## The run

- You pick a **coach**, Dora or Enzo, then play **turns**. Each turn is a **shop** phase, then a **fight** against a rival crew.
- A won fight earns a **bale** (a trophy). **10 bales** wins the run.
- A lost fight costs a **heart**. You start with **5**; at 0 the run is over. A draw costs nothing and earns nothing.
- So a run is at most 14 turns.

### Coaches

| Coach | Perk |
| --- | --- |
| Dora | Start of battle: give the front friend +0/+2. |
| Enzo | The first reroll each turn is free. |

The coach sits at the side of the hay bale, cheering or wincing, drawn with `drawChinchilla`.

### The shop

- Every turn starts with **10 acorns**. Unspent acorns are lost.
- Units cost **3**, snacks cost **3**, a reroll costs **1**. Selling a unit refunds its level (1–3 acorns).
- Shop slots: **3 units and 1 snack** on turns 1–4, **4 and 1** on turns 5–8, **5 and 2** from turn 9.
- Shop tiers unlock by turn: tier 1 on turn 1, tier 2 on turn 3, tier 3 on turn 5, tier 4 on turn 7, tier 5 on turn 9. Each slot draws uniformly from all units of unlocked tiers; snacks the same way.
- **Freeze**: a frozen slot keeps its item into the next turn's shop. Rerolls skip frozen slots.
- **Your line** has 5 slots, position 1 at the front. Units can be moved between slots freely during the shop. There is no bench.
- **Merging**: dropping a unit on a copy of itself merges them. The result keeps the higher attack and the higher health, +1/+1, and gains 1 experience. Level 2 at 2 experience (three copies), level 3 at 5 (six copies). Reaching a new level adds one bonus unit from the tier above the current shop tier (tier 5 at most) to the shop for this turn.
- **Snacks** are dropped on a unit (or used at once for the ones that target several).
- Stats are capped at 50/50.

### Fights

The fight is resolved by the engine in one go, from the two lines and a fight seed, into a list of **events** the page replays. Your line faces right from the left; the rival faces left from the right.

1. **Start of battle**: the coach perk, then every unit's start-of-battle ability.
2. **Rounds**, until one side is empty:
   - before-attack abilities of the two front units;
   - the two front units hit each other at the same moment, each dealing its attack;
   - hurt, faint and knock-out triggers resolve;
   - summoned units take the fainted unit's place; units close up towards the front.
3. Both sides empty at once, or 200 rounds without a winner, is a **draw**.

Ability order: whenever several abilities trigger together, they resolve highest attack first; ties go to your side first, then the front-most. "Ahead" means one slot closer to the front, "behind" one slot further back. A summon into a full line fizzles. Damage never goes below 0 health; a unit at 0 faints.

Random choices in a fight (random friend, random enemy) use the fight's own `Rand`, seeded from the run seed and the turn, so a replay is exact.

**Statuses** (from snacks; a unit holds one, a new one replaces the old):
- **Shell**: the next hit it takes deals 1 instead.
- **Mint**: every hit it takes deals 1 less (at least 1).
- **Chilli**: its attacks also deal 2 to the enemy behind its target.

### Rivals

There is no online play. The rival for turn *t* is a **ghost crew**: the engine runs the same shop rules for *t* turns with the ghost's own seed, and the bot's buying policy (below) picks for it. The ghost gets `GHOST_ACORNS` acorns per turn, a tuning number, 10 (the bot found it fair on 18-10-2026). A rival's captain is its strongest unit, shown with a crew name built from it ("The Badger's Bunch"); there is no separate rival roster to draw.

## Units

30 units, six per tier. Numbers in an ability are for levels 1 / 2 / 3. Attack/health are level 1 base stats; a level-up adds only what merging gives.

### Tier 1

| Id | Unit | A/H | Ability |
| --- | --- | --- | --- |
| `wren` | Wren | 2/1 | Sell: give 1 / 2 / 3 random friends +1 attack. |
| `mouse` | Field Mouse | 2/1 | Faint: summon a 1/1 / 2/2 / 3/3 Mouselet in its place. |
| `ladybird` | Ladybird | 1/2 | Start of battle: give the friend ahead +1 / +2 / +3 attack. |
| `toad` | Toad | 2/2 | Faint: give the friend behind +1/+1 / +2/+2 / +3/+3. |
| `bee` | Bee | 1/1 | Start of battle: deal 1 / 2 / 3 damage to a random enemy. |
| `dormouse` | Dormouse | 1/3 | End turn: gain +0/+1 / +0/+2 / +0/+3. |

### Tier 2

| Id | Unit | A/H | Ability |
| --- | --- | --- | --- |
| `hedgehog` | Hedgehog | 3/2 | Faint: deal 2 / 4 / 6 damage to every other unit, friend and rival. |
| `squirrel` | Squirrel | 2/3 | Start of turn: snacks in the shop cost 1 / 2 / 3 less. |
| `robin` | Robin | 2/3 | Friend summoned: give it +1/+1 / +2/+2 / +3/+3. |
| `mole` | Mole | 1/4 | Hurt: gain +2 / +4 / +6 attack. |
| `frog` | Frog | 3/3 | Friend ahead faints: gain +2/+2 / +4/+4 / +6/+6. |
| `pip` | Pip (a chinchilla kit) | 2/2 | Buy: give 2 random friends +1 / +2 / +3 health. |

### Tier 3

| Id | Unit | A/H | Ability |
| --- | --- | --- | --- |
| `badger` | Badger | 4/3 | Before attack: deal 2 / 4 / 6 damage to the second enemy. |
| `otter` | Otter | 3/4 | End turn: give the friend ahead +1/+1 / +2/+2 / +3/+3. |
| `magpie` | Magpie | 3/3 | Start of turn: gain 1 / 2 / 3 acorns. |
| `rabbit` | Rabbit | 3/4 | Friend eats a snack: give it +1 / +2 / +3 more health. |
| `porcupine` | Porcupine | 2/5 | Hurt: deal 2 / 4 / 6 damage to a random enemy. |
| `beaver` | Beaver | 3/3 | Faint: summon a 0/6 / 0/12 / 0/18 Log Dam in its place. |

### Tier 4

| Id | Unit | A/H | Ability |
| --- | --- | --- | --- |
| `stoat` | Stoat | 5/3 | Knock out: gain +2/+2 / +4/+4 / +6/+6. |
| `tortoise` | Tortoise | 2/6 | Start of battle: give Shell to the 1 / 2 / 3 front-most friends. |
| `crow` | Crow | 4/4 | Friend faints: gain +1/+1 / +2/+2 / +3/+3. |
| `skunk` | Skunk | 3/5 | Start of battle: take 33% / 66% / 99% of the healthiest enemy's health (it keeps at least 1). |
| `raccoon` | Raccoon | 4/4 | Start of battle: take 2 / 4 / 6 attack from the enemy front (down to 0) and gain it. |
| `hare` | Hare | 4/3 | Start of battle: deal 50% / 100% / 150% of its attack to the enemy with the least health. |

### Tier 5

| Id | Unit | A/H | Ability |
| --- | --- | --- | --- |
| `boar` | Boar | 6/6 | Before attack: gain +2 / +4 / +6 attack. |
| `bear` | Bear | 5/8 | Start of battle: give the friends ahead and behind +3 / +6 / +9 health. |
| `stag` | Stag | 6/5 | Faint: summon a 4/4 / 8/8 / 12/12 Fawn in its place. |
| `duchess` | The Duchess (a golden chinchilla) | 3/6 | End turn: give every friend +1/+1 / +2/+2 / +3/+3. |
| `hawk` | Hawk | 5/5 | Start of battle: deal 5 / 10 / 15 damage to the enemy with the most attack. |
| `goose` | Goose | 5/7 | Hurt: give all friends +1 / +2 / +3 attack. |

Summoned units (Mouselet, Log Dam, Fawn) have no ability, can't be bought, and don't carry into the next turn: the line you see in the shop is the line before the fight, restored after it. Fight buffs are for that fight only; shop buffs (Buy, Sell, End turn, Start of turn, snacks) are permanent.

### Snacks

| Id | Snack | Tier | Effect |
| --- | --- | --- | --- |
| `apple` | Apple | 1 | +1/+1. |
| `raisin` | Raisin | 1 | +3 attack for the next fight only. |
| `honey` | Honey | 2 | Shell. |
| `hay` | Hay Bundle | 2 | +1/+1 to two random friends. |
| `mint` | Mint Leaf | 3 | Mint. |
| `chilli` | Chilli | 3 | Chilli. |
| `seed` | Sunflower Seed | 4 | +1 experience, which may level the unit up. |
| `cake` | Acorn Cake | 5 | +3/+3. |

## Screens

- **Title**: Start a run (pick Dora or Enzo), Continue (if a run is saved), the Almanac, mute.
- **Shop**: the hay bale with your line of five on it, the coach beside it, the shop row below, and a HUD with acorns, hearts, bales and the turn. Buttons: Roll, Freeze, End turn. Tap or hover a unit for its card (name, stats, level and experience, ability text for its level).
- **Fight**: the rival's line slides in on the right with its crew name. Events replay one at a time, about 0.35 s each, with hit flashes, damage numbers, faint puffs and ability callouts. Buttons: ×2 speed and Skip. Then a result card (WIN, LOSS or DRAW) and back to the shop, or the run's end card.
- **Almanac**: all 30 units and 8 snacks, with the ones you have won a run with marked.

The stage is a 480 × 320 canvas (3:2, ChatGPT's landscape size) that scales to fit with no scroll at 390 × 844 and 1280 × 860; the buttons are DOM, under it.

## Input

- Pointer: drag a shop unit or snack onto a line slot or unit to buy it there; drag line units to swap or merge; drag a line unit onto the sell bin to sell. Tap-then-tap does the same as a drag (tap the item, tap the target), because drags are fiddly on phones.
- Keys: R rolls, F freezes the selected shop slot, Space ends the turn, and during a fight Space skips.

## Saving

- `hay-bale-run-v1`: the whole run (turn, acorns, hearts, bales, coach, line, shop with freezes, both seeds and the generator's state), written after every action, so Continue resumes exactly. A fight in progress is not saved: Continue after a reload shows the fight's result.
- `hay-bale-v1`: the profile, `{ v: 1; runs; wins; best; won: string[] }`. `best` is the most bales in a run, `won` the ids of units that were in a winning line. Malformed data loads as a fresh profile; unknown ids are dropped.
- `hay-bale-sound-v1`: sound on or off.

## Architecture

The usual split, with the roster in its own file as Acorn Hand does.

- **`lib/hay-bale-units.ts`**: `UNITS`, `SNACKS` and the summoned tokens, each with its tier, stats and ability (`trigger` plus an effect function taking a context). Pure data and small functions, no DOM.
- **`lib/hay-bale-game.ts`**: `Rand` (copied from Acorn Hand), the shop (`Run` with `buy`, `sell`, `move`, `merge`, `feed`, `roll`, `freeze`, `endTurn`), `fight(left, right, seed, coach)` returning `{ result, events }`, the ghost builder `ghost(seed, turn)`, the buying policy `choose(run)` shared by ghosts and the bot, and the profile (`loadProfile`, `record`).
- **`lib/hay-bale-scene.ts`**: Canvas 2D drawing of the bale, the line, the shop, cards, and the fight replay from events. Each critter has a code-drawn fallback built from a few shared shapes (round body, ears, tail and colours per id); chinchillas use `drawChinchilla`. Painted sheets replace the drawings when they load.
- **`app/hay-bale-brawl/page.tsx`**: screens, input, replay timing, sound, saving. Exposes `window.__brawl()` (run, profile, last fight's events, and helpers to set the line and shop for tests) and sets `main[data-ready="true"]` after hydration.
- **Sound**: `makeSound('hay-bale-sound-v1', …)` from `lib/cue-sound.ts`: buy, sell, merge, level-up, roll, hit, faint, ability, win, loss.

Route `/brawl`, matching the short routes of `/clash` and `/tactics`.

## Balance

**The buying policy** (`choose`) is a plain greedy player: it scores each affordable action by the value it adds to the line (stats, plus a per-ability weight, plus merge and level-up value), takes the best until no action scores above zero, keeps the strongest units at the front, and freezes a unit it would buy but can't afford. It is deliberately decent, not clever, because the ghosts use it too.

**`tests/hay-bale-bot.mjs`** plays 300 seeded runs, in `npm test`, under 60 s. It gates:
- the policy wins a run (10 bales) 30–55% of the time;
- a random buyer wins under 5%, so choices matter;
- every unit is bought in at least 2% of runs and none is in more than 50% of winning lines;
- each tier's units appear in winning lines;
- no fight hits the 200-round draw cap.

Tuning knobs, in order: `GHOST_ACORNS`, unit stats, ability numbers.

## Testing

- **`tests/hay-bale.mjs`** (engine, in `npm test`): every unit's ability at each level in a hand-built fight or shop; the ability order rule; summons into a full line fizzle; statuses; merging and experience, and the level-up bonus unit; freeze surviving rolls and turns; shop slot counts and tier unlocks by turn; selling refunds; snack cost floor at 0 with Squirrel; the same seed and lines give the same events; fight buffs reset after the fight; draws; hearts and bales ending the run; the save round-trips and a malformed one loads fresh.
- **`tests/hay-bale-bot.mjs`**: the gates above.
- **`tests/e2e/brawl.mjs`** (Playwright): hydration; start a run as each coach; buy by drag and by tap-tap; merge; sell; freeze and roll; end the turn and see the fight replay and result; Skip; Continue after a reload; the Almanac; the stage fits at 390 × 844 and 1280 × 860; no page errors.

## Arcade integration

The README **Adding a game** checklist in full: the `GAMES` card (36th, after Whisker Ware), every hardcoded count (thirty-five → thirty-six, the `tests/readme.mjs` number word, the e2e files and the `panel-contrast` route list), the README table row (`| 36 | Hay Bale Brawl | \`/brawl\` | Auto-battler |`) and guide, `docs/hay-bale-brawl.md`, the `test:hay-bale`, `bot:hay-bale` and `test:e2e:brawl` scripts, and a CHANGELOG entry.

## Out of scope

Online play or real opponents' teams, a daily seed, difficulty stakes, more than 30 units, a bench, items held between fights other than statuses, and music beyond the cue sounds.
