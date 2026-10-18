# Hay Bale Brawl

Route `/brawl`. An auto-battler in the manner of Super Auto Pets. You buy a crew of woodland critters in a shop, line them up on a hay bale, and watch them fight a rival crew by themselves. Design: [`superpowers/specs/18-10-2026-hay-bale-brawl-design.md`](superpowers/specs/18-10-2026-hay-bale-brawl-design.md).

## The code

- `lib/hay-bale-units.ts`: the 30 units, 3 summoned tokens and 8 snacks. Abilities are written against a `Ctx` interface, so the same ability works in the shop and in a fight.
- `lib/hay-bale-game.ts`:
  - `fight(left, right, seed, coach)` works out a whole fight into a list of events;
  - `Run` is the shop and the run (`buy`, `feed`, `sell`, `move`, `roll`, `freeze`, `endTurn`, saving);
  - `choose` and `playShop` are the buying policy that the rival ghosts and the bot both use;
  - `ghost(seed, turn)` builds a rival crew;
  - the profile (`loadProfile`, `record`).
- `lib/hay-bale-scene.ts` draws the shop, the fight replay and every critter in code on a 480 × 320 stage. Pip, the Duchess and the coaches use `drawChinchilla`.
- `app/brawl/page.tsx` handles the screens, drag and tap-tap input, the replay, sound and saving. `window.__brawl()` exposes the run, the profile, the replay, the shop layout and a `set` hook for tests.

## The run

- Pick a coach:
  - **Dora** gives the front friend +0/+2 at the start of every fight;
  - **Enzo** makes the first roll each turn free.
- Each turn is a shop, then a fight. A win earns a **bale**, a loss costs one of **5 hearts**, and a draw changes nothing. **10 bales** win the run; at 0 hearts it is over. So a run lasts at most 14 turns.

## The shop

- **Acorns:** 10 every turn; whatever is left over is lost.
- **Prices:** a unit costs 3, a snack 3 and a roll 1. Selling a unit refunds its level.
- **Slots:** 3 units and 1 snack on turns 1–4, 4 and 1 on turns 5–8, 5 and 2 from turn 9.
- **Tiers:** tier 1 unlocks on turn 1, then one more tier every two turns, up to tier 5 on turn 9.
- **Freezing:** a frozen slot keeps its item through rolls and into the next turn, until it is unfrozen.
- **The line:** 5 slots, front first. Moving a unit onto an empty slot moves it, onto a copy merges them, and onto another unit swaps them.
- **Merging:**
  - the merged unit keeps the higher attack and the higher health, plus +1/+1;
  - it gains 1 experience plus the dropped copy's experience;
  - level 2 comes at 2 experience (three copies) and level 3 at 5 (six copies);
  - each new level adds a unit from the tier above the shop's tier to the shop for that turn.
- **Snacks:** Apple +1/+1; Raisin +3 attack for the next fight; Honey gives Shell; Hay Bundle +1/+1 to two random friends; Mint Leaf gives Mint; Chilli gives Chilli; Sunflower Seed +1 experience; Acorn Cake +3/+3.
- **Stat cap:** 50 attack and 50 health.

## Fights

A fight is worked out in one go from the two lines and a seed derived from the run, so a replay is exact.

1. **Start of battle:** Dora's perk, then every start-of-battle ability.
2. **Rounds:** the front units' before-attack abilities fire, then the two front units hit each other at the same moment. Hurt, faint and knock-out abilities follow, summons take the fainted unit's place, and the lines close up.
3. **The end:** both sides empty at once is a draw. So is a round in which neither front unit has any attack and no ability fired. A 200-round cap is the backstop.

**Ability order:**
- abilities that trigger together resolve highest attack first, then your side first, then front-most;
- abilities they trigger in turn resolve afterwards;
- a fainted unit's abilities fire only if they are faint abilities.

**Damage:**
- Shell turns the next hit into 1 and is then used up;
- Mint takes 1 off every hit, but a hit always deals at least 1;
- Chilli adds 2 damage to the enemy behind the one hit;
- a unit is hurt only if it survives the hit.

**Summons and buffs:**
- a summon fizzles when its side already has 5 living units;
- buffs during a fight last only for that fight;
- shop buffs last for the rest of the run.

### Units

Numbers are for levels 1 / 2 / 3.

| Tier | Unit | Stats | Ability |
| --- | --- | --- | --- |
| 1 | Wren | 2/1 | Sell: give 1 / 2 / 3 random friends +1 attack. |
| 1 | Field Mouse | 2/1 | Faint: summon a 1/1 / 2/2 / 3/3 Mouselet. |
| 1 | Ladybird | 1/2 | Start of battle: friend ahead +1 / +2 / +3 attack. |
| 1 | Toad | 2/2 | Faint: friend behind +1/+1 / +2/+2 / +3/+3. |
| 1 | Bee | 1/1 | Start of battle: 1 / 2 / 3 damage to a random enemy. |
| 1 | Dormouse | 1/3 | End turn: gain +0/+1 / +0/+2 / +0/+3. |
| 2 | Hedgehog | 3/2 | Faint: 2 / 4 / 6 damage to every other unit, friend and rival. |
| 2 | Squirrel | 2/3 | Start of turn: snacks cost 1 / 2 / 3 less. |
| 2 | Robin | 2/3 | Friend summoned: give it +1/+1 / +2/+2 / +3/+3. |
| 2 | Mole | 1/4 | Hurt: gain +2 / +4 / +6 attack. |
| 2 | Frog | 3/3 | Friend ahead faints: gain +2/+2 / +4/+4 / +6/+6. |
| 2 | Pip | 2/2 | Buy: 2 random friends +1 / +2 / +3 health. |
| 3 | Badger | 4/3 | Before attack: 2 / 4 / 6 damage to the second enemy. |
| 3 | Otter | 3/4 | End turn: friend ahead +1/+1 / +2/+2 / +3/+3. |
| 3 | Magpie | 3/3 | Start of turn: gain 1 / 2 / 3 acorns. |
| 3 | Rabbit | 3/4 | Friend eats a snack: give it +1 / +2 / +3 more health. |
| 3 | Porcupine | 2/5 | Hurt: 2 / 4 / 6 damage to a random enemy. |
| 3 | Beaver | 3/3 | Faint: summon a 0/6 / 0/12 / 0/18 Log Dam. |
| 4 | Stoat | 5/3 | Knock out: gain +2/+2 / +4/+4 / +6/+6. |
| 4 | Tortoise | 2/6 | Start of battle: Shell to the 1 / 2 / 3 front-most friends. |
| 4 | Crow | 4/4 | Friend faints: gain +1/+1 / +2/+2 / +3/+3. |
| 4 | Skunk | 3/5 | Start of battle: take 33% / 66% / 99% of the healthiest enemy's health (it keeps 1). |
| 4 | Raccoon | 4/4 | Start of battle: take 2 / 4 / 6 attack from the enemy front. |
| 4 | Hare | 4/3 | Start of battle: 50% / 100% / 150% of its attack to the enemy with the least health. |
| 5 | Boar | 6/6 | Before attack: gain +2 / +4 / +6 attack. |
| 5 | Bear | 5/8 | Start of battle: friends ahead and behind +3 / +6 / +9 health. |
| 5 | Stag | 6/5 | Faint: summon a 4/4 / 8/8 / 12/12 Fawn. |
| 5 | The Duchess | 3/6 | End turn: every friend +1/+1 / +2/+2 / +3/+3. |
| 5 | Hawk | 5/5 | Start of battle: 5 / 10 / 15 damage to the enemy with the most attack. |
| 5 | Goose | 5/7 | Hurt: all friends +1 / +2 / +3 attack. |

## Rivals

There is no online play. Each run has one **ghost** rival:
- it is a run of its own, seeded from yours, with **10 acorns** a turn (`GHOST_ACORNS`), like yours;
- it shops with the same buying policy the bot uses;
- turn *t*'s rival is the ghost after *t* turns of shopping, so the rival grows through the run;
- its uids are lifted by 1,000,000 so they never clash with yours;
- a ghost never fights, so its Raisins are cleared before each turn's shopping, as a fight would clear yours;
- the crew is named after its strongest unit ("The Badger's Bunch").

The buying policy takes the first of these that applies:
1. the affordable buy or feed that adds the most value;
2. sell the weakest unit when the line is full and something clearly better is on offer;
3. freeze a copy it can't yet afford;
4. roll while it has 4 acorns or more.

It values a unit at attack + health + 2 × tier × level, and it marks the Dormouse down.

## Saving

- `hay-bale-run-v1` holds the whole run, including the generator's state. It is written after every action and every end of turn, before the fight is replayed. So a reload mid-fight counts the fight once and Continue opens the next shop.
- When a run ends, it goes into `hay-bale-v1`, the profile: runs, wins, the most bales and the units that were in a winning crew. The run save is then removed.
- A malformed save is ignored. Sound on or off is kept under `hay-bale-sound-v1`.

## Balance · 18-10-2026

`npm run bot:hay-bale` plays 300 seeded runs with the buying policy, alternating Dora and Enzo, and 300 with a random buyer. It takes under a second. It gates:
- the policy wins 30–55% of runs;
- the random buyer wins under 5%;
- every unit is bought in at least 2% of runs;
- no unit is in more than half of the winning crews;
- every tier appears in winning crews;
- no fight comes near the 200-round cap.

At the time of writing it measures:
- the policy wins 37.3% (Dora 54 runs, Enzo 58), with 6.05 bales on average;
- the random buyer wins none;
- the least-bought unit is the Duchess, in 36 runs;
- the most common unit in winning crews is the Bear, in 46 of 112;
- the longest fight is 23 rounds.

The first tuning pass dropped the ghosts to 9 acorns, but the final review found that ghosts kept every Raisin's attack for good; with that fixed, 10 acorns is fair again. With a flat ability weight, the policy never got past tier-1 units, and the Dormouse sat in about two-thirds of winning crews. It was also in half the losing ones: the policy simply never sold it. Nerfing its stats or ability did not move that number, so the roster stayed as designed and only the policy's taste changed.

**Stalls.** A fight is a draw at once when neither front can deal damage (no attack, and no Chilli with someone behind its target) and the round produced nothing but empty ability callouts, such as a drained Badger with no second enemy. Nobody has played a run by hand yet.

## Art and sound

Everything is drawn in code:
- each critter is built from a shared round body with its own colours, ears and features (spines, antlers, a mask, a shell);
- birds, bugs, frogs and the tortoise have their own shapes;
- Pip and the Duchess are chinchillas, and the Duchess wears a crown.

Painted art can follow through ChatGPT prompts, as for Whisker Ware. Sound is synthesised WebAudio blips (`app/brawl/sound.ts`), with no files.
