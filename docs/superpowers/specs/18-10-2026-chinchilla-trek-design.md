# Chinchilla Trek · design

Written 18-10-2026. The arcade's 37th game: a chinchilla take on Capybara Go!. Jason pointed at that game and asked for a plan without a question round, so every choice below is Claude's call, made to fit the arcade's patterns. Push back on any of them before the plan is written. The game ships code-drawn first; painted art follows through a ChatGPT prompts doc written after this design is approved, as Hay Bale Brawl's was.

## Why this game

Capybara Go! is a roguelite you play with one thumb: the hero walks on their own, one day at a time, and each day brings something to react to: a scrap, a choice of three skills, a stranger with a bargain, a chest. The skills stack into silly, powerful combinations, the fights play themselves, and every run, won or lost, pays into gear and training that make the next run go further.

The arcade has nothing like it. Hay Bale Brawl plays itself, but you build a team in a shop; Acorn Hand and Summit Shuffle are runs, but you play every hand. Here the whole game is a string of small decisions, each taken in a second, with a story told around them. It suits a phone held in one hand, and a chapter is a single sitting.

What we take from Capybara Go!: the day-by-day walk, the level-up skill picks, auto-battles, the bargain events, gear that merges up in rarity, and chapters that unlock one after another. What we leave out: stamina, gems, gacha, adverts, battle passes, idle patrol rewards and anything else built to sell. Nothing here is timed or paid for.

## The trek

- You pick a **chinchilla**, Dora or Enzo, and a **chapter** you have unlocked. A chapter is a trek of **30 days**.
- Each day the chinchilla walks a few steps along the path (about 1.2 s), then meets that day's **event**. Most events are one tap.
- **HP carries from day to day.** It comes back only from resting, events, level-ups and skills. At 0 HP the trek ends.
- Day 30 is the chapter's **boss**. Beat it and the chapter is cleared and the next unlocks.
- A trek can be left and resumed at any time; it is saved after every day and every choice.

### Chinchillas

| Chinchilla | Starts with |
| --- | --- |
| Dora | **Shell** at level 1, and +10% max HP. |
| Enzo | **Combo** at level 1, and +10% attack. |

The one you didn't pick turns up as a cameo in a few events (cheering from a hilltop, sharing a snack).

### Stats

The hero has **max HP**, **attack**, **crit chance** (base 5%; a crit deals double) and **dodge** (base 0%). The base is 100 HP and 10 attack, plus training and gear (see **Camp**). Skills add on top for the trek only.

## Days

Five days are fixed in every chapter:

| Day | Event |
| --- | --- |
| 10 | **Elite fight**: a tougher foe; a sure chest. |
| 15 | **The crossroads**: the Owl and the Fox (below). |
| 20 | **Elite fight**. |
| 25 | **Pedlar**: the travelling Hedgehog's shop. |
| 30 | **Boss**. |

Every other day draws from this table, with the trek's seeded `Rand`:

| Weight | Event |
| --- | --- |
| 40 | **Fight**: a foe from the chapter's roster. |
| 20 | **Story**: a short scene with two choices. |
| 12 | **Skill cache**: pick one of three skills, as on a level-up. |
| 10 | **Find**: acorns, a snack that heals, or a small chest. |
| 8 | **Rest spot**: heal 30% of max HP. |
| 5 | **Lucky wheel**: spin for a prize; one segment is a small HP loss. |
| 5 | **Pedlar**. |

No event repeats on consecutive days, and day 1 is always a fight, so the first skill pick comes quickly.

### Fights

Fights play themselves and are resolved by the engine in one go, from the hero, the foe and a fight seed, into a list of **events** the page replays (as Hay Bale Brawl does).

- The hero and the foe trade turns, the hero first. Each turn is one attack, plus whatever skills trigger.
- Damage is the attacker's attack, doubled on a crit, after any reductions, never below 1. A dodged attack deals nothing.
- At 40 rounds the foe gives up and wanders off: the fight ends, with no experience or acorns.
- At 0 HP the foe is **knocked out**: it tumbles over and scampers off sulking. Nobody is hurt; it's a scrap, not a battle. If the hero reaches 0, the trek is over.
- A won fight gives **experience** and a few **acorns**.

Foes scale by chapter and day: a foe's HP and attack are its base times `CHAPTER_SCALE[chapter]` times `(1 + DAY_SCALE × day)`. Both are tuning numbers that the bot sets (below).

### Levels and skills

- Experience fills a bar. Each level-up heals **20% of max HP** and offers **three skills**. You pick one.
- Picking a skill you already have raises its level, up to 3.
- **One reroll** of an offer per trek.
- The offer draws from skills not yet at level 3. When both halves of an **evolution** are at level 3, the evolution can appear as a gold card. Picking it replaces the pair.
- Level thresholds are tuning numbers, set so that a full chapter gives about 12 level-ups.

The skills are below. Numbers are for levels 1 / 2 / 3.

| Id | Skill | Effect |
| --- | --- | --- |
| `combo` | Combo | 20% / 35% / 50% chance to attack again (at most once per turn). |
| `counter` | Counter | 20% / 35% / 50% chance to hit back when hit. |
| `sharp` | Sharp Teeth | +15% / 25% / 40% attack. |
| `keen` | Keen Eye | +10% / 20% / 30% crit chance. |
| `fluff` | Extra Fluff | +20% / 35% / 50% max HP (current HP rises too). |
| `shell` | Shell | Start of fight: a shield of 15% / 25% / 40% of max HP. |
| `dust` | Dust Cloud | +8% / 15% / 22% dodge. |
| `static` | Static Fluff | Each attack: 25% chance of a zap for 50% / 80% / 120% of attack. |
| `snack` | Snack Break | Heal 8% / 14% / 20% of the damage dealt. |
| `nap` | Power Nap | End of each round: heal 2% / 4% / 6% of max HP. |
| `grit` | Grit | Below half HP: +30% / 50% / 80% attack. |
| `prickle` | Prickles | Reflect 15% / 25% / 40% of the damage taken. |
| `pounce` | Pounce | The first attack of each fight deals ×2 / ×3 / ×4. |
| `roll` | Dust Roll | Start of fight: deal 100% / 150% / 200% of attack. |
| `pepper` | Pepper Dust | Hits add a burn: the foe takes 10% / 15% / 20% of attack each round; stacks up to 5. |
| `frost` | Frost Whiskers | 12% / 20% / 28% chance a hit freezes the foe, which then skips its next turn. |
| `lucky` | Lucky Paw | +20% / 40% / 60% acorns, and the lucky wheel's HP segment becomes a prize. |
| `wind` | Second Wind | Once per trek, at 0 HP, stand back up with 30% / 50% / 70% of max HP. |

Evolutions, both halves at level 3:

| Id | Evolution | From | Effect |
| --- | --- | --- | --- |
| `storm` | Thunder Combo | Combo + Static Fluff | Every extra attack also zaps for 120%, and Combo can chain twice. |
| `fury` | Fluffy Fury | Keen Eye + Grit | Crits deal ×3; below half HP, crit chance +30%. |
| `bramble` | Bramble Shell | Shell + Prickles | The shield refills by 10% of max HP each round; reflect 60%. |
| `feast` | Midnight Feast | Snack Break + Power Nap | Heal 25% of the damage dealt, and 6% of max HP each round, at most to full. |

An evolution keeps both halves' effects at level 3 and adds its own line.

### The crossroads (day 15)

The **Owl** and the **Fox** wait where the path forks. Pick one or the other, or walk on:

- **The Owl** (kind): heal to full, or +1 level on a random skill you have.
- **The Fox** (a trickster, never mean): a choice of two skills at once, each at level 2, for −20% of max HP, for the rest of the trek.

Elite fights also end with a smaller visit from one of the two (chosen by the seed), offering half of the above.

### Story events

At least **20** short scenes, each with one or two lines of text and two choices. Some outcomes are certain; others are coin flips that say what they risk. Examples:
- A glowing mushroom: eat it (50%: +10% attack for the trek; 50%: −10% HP) or leave it.
- A tangled bird: free it (it returns on a later day with acorns) or walk on.
- A dust bath by the path: take it (heal 15%) or take Dust Cloud's cheaper cousin (+3% dodge).
- Pip asks to come along: one gift of a healing snack on a later day.

Scenes are written for the chapter they appear in where it matters (the Frosty Peak has snow scenes). The writing is gentle and a little silly. Nobody steals, and nothing is cruel.

### The Pedlar

The Hedgehog sells three items for acorns: a healing snack (heal 40%), a random skill card (one pick from three), and a trek-long stat charm (+8% attack, +10% max HP or +5% crit, one per visit). Acorns spent here are acorns not banked for camp.

## Chapters

Five chapters, unlocked in order. Each has four foes, an elite and a boss, all woodland grumps.

| # | Chapter | Foes | Elite | Boss |
| --- | --- | --- | --- | --- |
| 1 | Clover Meadow | Beetle, Field Mouse gang, Grumpy Toad, Wasp | Hedge Pig | **King Mole** |
| 2 | Bramble Wood | Magpie, Stoat, Thornbush Sprite, Wild Boar piglet | Old Raccoon | **Grumbleton the Badger** |
| 3 | Willow River | Crab, Heron, Pike, Water Vole | Snapping Turtle | **Captain Otter** |
| 4 | Frosty Peak | Snow Hare, Ptarmigan, Mountain Goat kid, Ice Imp | Yeti Pika | **The Snow Fox Queen** |
| 5 | Moon Hollow | Bat, Moth, Will-o'-wisp, Night Owlet | Shadow Cat | **The Great Horned Owl** |

Each foe has HP, attack and at most one trait (for example, the Wasp's first hit poisons; the Turtle's shell halves the first hit; the Snow Fox Queen freezes every fourth turn). The design keeps traits few and plain, so the hero's skills stay the story.

## Camp

Between treks the chinchilla is at **camp**. Camp shows everything that carries over:

- **Acorns**: every acorn earned in a trek is kept, won or lost, minus any spent at the Pedlar.
- **Training**: spend acorns on permanent **+attack** and **+max HP** levels. Costs rise with each level.
- **Satchel**: four gear slots, **Hat** (max HP), **Scarf** (attack), **Charm** (crit) and **Boots** (dodge). Each piece has a rarity: Plain, Fine, Rare, Grand or Legend. Three pieces of the same slot and rarity merge into one of the next rarity. The best piece in each slot is worn automatically, and you can swap.
- **Rewards**: a trek ends with a chest. It holds acorns, 1 gear piece (2 if the boss fell) and, on a first clear, a guaranteed Rare. Its rarity odds improve by chapter and by the day you reached.

The meta loop is gentle by design: a failed trek always leaves you a little stronger, and the bot gates (below) check that a player clears all five chapters in a reasonable number of treks without having to grind.

## Screens

- **Title**: Continue (if a trek is saved), Camp, the Journal, mute.
- **Camp**: the campfire with the chinchilla. Training, the satchel, a chapter picker with each chapter's best day, a hero picker, and **Set off**.
- **Trek**: the stage shows the chinchilla walking a side-on path through the chapter's scenery, with parallax. Under it, in the DOM:
  - a bar with the day (12/30), HP, the level and experience bar, and acorns;
  - the skill tray, small icons with level pips that show their text when tapped;
  - the **event card**: what happened, and one to three buttons.
  Fights play on the stage, with the foe walking in from the right. The page shows damage numbers, crits, zaps, dodges, the shield, burn and freeze, and the foe tumbling off. The controls are ×2 and Skip; ×2 is remembered.
- **Skill pick**: three cards over the stage. Each shows the icon, name, its next level and the text for that level; evolutions get a gold card. Below them is Reroll.
- **End card**: the day reached or "Chapter cleared!", the chest opening, and back to camp.
- **Journal**: every skill, evolution and foe, with the ones you have met marked, and the best day for each chapter.

The stage is a 480 × 320 canvas (3:2), as in Hay Bale Brawl. Everything that needs reading or tapping is DOM below it, because the event text has to stay readable on a phone. The page fits with no scroll at 390 × 844 and 1280 × 860.

## Input

- Tap or click the buttons. There is no dragging anywhere.
- Keys: 1, 2 and 3 pick a choice or a skill card; Space continues and skips a fight; R rerolls a skill offer.
- **Auto-walk** is on by default: days with nothing to choose (finds, rests, fights) play out on their own. A toggle turns it off, so every day waits for a tap.

## Saving

- `chinchilla-trek-run-v1` holds the whole trek: chapter, hero, day, HP, level, experience, skills, Second Wind used, the reroll used, pending events (the freed bird), trek acorns, and the seed and generator state. It is written after every day and every choice, so Continue resumes exactly. A fight in progress is not saved; Continue after a reload shows that fight's result.
- `chinchilla-trek-v1` holds the profile: `{ v: 1; acorns; training: { atk, hp }; gear: Piece[]; worn; unlocked; best: number[]; seen: { skills; foes } }`. Malformed data loads as a fresh profile, and unknown ids are dropped.
- `chinchilla-trek-sound-v1` holds whether sound is on.

## Architecture

The usual split, with the data in its own file, as Hay Bale Brawl has.

- **`lib/chinchilla-trek-data.ts`**: the skills, evolutions, chapters, foes, story scenes, gear tables and tuning numbers. Pure data and small functions, with no DOM.
- **`lib/chinchilla-trek-game.ts`**:
  - `Rand`, copied from Hay Bale Brawl;
  - the hero's stats from the profile and skills;
  - `fight(hero, foe, seed)`, returning `{ result, events }`;
  - the trek state machine `Trek`, with `next()`, `choose(i)`, `pickSkill(i)`, `reroll()` and `buy(i)`;
  - the day roll;
  - camp actions (`train`, `merge`, `wear`, `openChest`);
  - the bot policy `decide(trek)`, shared with the bot test;
  - the profile (`loadProfile`, `record`).
- **`lib/chinchilla-trek-scene.ts`**: Canvas 2D drawing of the path and parallax scenery for each chapter, the walking chinchilla (`drawChinchilla`), the foes, and the fight replay from events. The motion follows `lib/hay-bale-motion.ts`'s rule: poses come from event progress, nothing bobs while nothing happens, and reduced motion is calm.
- **`app/trek/page.tsx`**: screens, input, timing, sound and saving. It exposes `window.__trek()` (the trek, the profile, the last fight's events, and helpers that set skills, HP and day for tests) and sets `main[data-ready="true"]` after hydration.
- **Sound**: `makeSound('chinchilla-trek-sound-v1', …)` from `lib/cue-sound.ts`: step, hit, crit, zap, dodge, level-up, pick, chest, knock-out, win, lose.

The route is `/trek`.

## Balance

**The bot policy** (`decide`) is a plain greedy player:
- it scores skills by a fixed weight per skill, with a bonus when the skill completes an evolution;
- it takes the safer story choice below 40% HP and the bolder one above it;
- it buys a healing snack below 50% HP, otherwise a stat charm;
- at camp, it trains and merges greedily and wears the best gear.

**`tests/chinchilla-trek-bot.mjs`** is part of `npm test` and runs in under 60 s. It gates:
- **Fresh profiles:** in 300 seeded treks of chapter 1 with a fresh profile, the policy clears the chapter 25–55% of the time, and a random picker clears it at least 20 points less often.
- **Whole campaigns:** in 40 seeded campaigns, each starting from a fresh profile and playing treks until chapter 5 falls, the median campaign takes 15–45 treks, and none takes more than 90.
- **Every skill** is picked in at least 2% of treks, and each evolution is reached in at least 5% of chapter clears.
- **Round cap:** fewer than 2% of fights reach the 40-round cap.

Tuning knobs, in order: `CHAPTER_SCALE`, `DAY_SCALE`, foe base stats, the experience thresholds, then skill numbers.

## Testing

- **`tests/chinchilla-trek.mjs`** (the engine, in `npm test`):
  - **Skills:** every skill at each level in a hand-built fight. Evolutions are offered only when both halves are at level 3, and picking one replaces them. Combo and counter respect their limits. Second Wind fires once.
  - **Fights:** the 40-round cap.
  - **Days:** the fixed days fall on 10, 15, 20, 25 and 30; no event repeats on consecutive days; day 1 is a fight.
  - **Determinism:** the same seed and choices give the same trek and events.
  - **Camp:** gear merges three into one of the next rarity; training costs rise with each level; acorns are kept after a loss.
  - **Saving:** the save round-trips, and a malformed save loads fresh.
- **`tests/chinchilla-trek-bot.mjs`**: the gates above.
- **`tests/e2e/trek.mjs`** (Playwright):
  - hydration;
  - set off as each chinchilla;
  - walk a day, pick a skill, play a fight to the end, and Skip;
  - take a story choice and the crossroads;
  - buy from the Pedlar;
  - finish a trek, and see the chest and camp;
  - train and merge gear;
  - Continue after a reload;
  - auto-walk off waits for a tap;
  - the Journal;
  - the stage fits at 390 × 844 and 1280 × 860;
  - no page errors.

## Arcade integration

Follow the README's **Adding a game** checklist in full:
- the `GAMES` card, 37th, after Hay Bale Brawl;
- every hardcoded count: thirty-six → thirty-seven, the `tests/readme.mjs` number word, the e2e files, and the `panel-contrast` route list;
- the README table row (`| 37 | Chinchilla Trek | \`/trek\` | Roguelite trek |`) and guide;
- `docs/chinchilla-trek.md`;
- the `test:trek`, `bot:trek` and `test:e2e:trek` scripts;
- a CHANGELOG entry.

## Out of scope

- Stamina or energy, premium currency, gacha, adverts and daily log-in rewards.
- Idle patrol rewards.
- Pets as a separate collection; companions appear only as story events.
- Online play and leaderboards.
- More than five chapters, a daily seed and difficulty stakes.
- Music beyond the cue sounds.
