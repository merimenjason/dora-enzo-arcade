# Whisker Saga

Game 32, `/saga`. A hero-squad adventure in the style of the squad stages of Top Heroes: Kingdom Saga. Five heroes march down a road, meet three waves of enemies and fight on their own. The player chooses who stands where, spends the loot, and decides when each hero's skill is fired.

Every number below is a constant at the top of its section in `lib/saga-game.ts`. Change a number there, then rerun `npm run bot:saga`.

## A battle

- **Squad:** five slots. Slots 1 and 2 are the front row, slots 3 to 5 the back row. Enemies that fight hand to hand hit the front row; when nobody is left in front they hit the back row.
- **Waves:** three per stage. The squad marches for 1.2 s before each. Waves grow from two enemies at stage 1 to five from stage 13 (`2 + stage ÷ 4`, rounded down, at most 5). The third wave is led by a captain, or by the chapter's boss on stage 10. A boss brings one fewer escort than a captain does.
- **Attacks:** heroes and enemies attack on their own. Melee heroes reach an enemy within 1 unit of the front line, ranged heroes within 8. Enemies start 7 units away and walk in; ranged enemies stop at 4.5. When nothing is left in arm's reach the squad walks forward (1.4 units a second), so an all-melee squad still gets to enemies that stand off and shoot.
- **Damage:** attack × 100 ÷ (100 + the target's armour), varied by ±10% from the battle's seed.
- **Time:** a battle that reaches 2:30 is lost.
- **Stars:** one for clearing the stage, one if nobody fell, one for finishing within 1:00.

### Skills

A skill is ready at 100 energy. A hero starts each battle with 40, gains 14 for each attack they land and 5 for each hit they take; a charm speeds both. Fire a ready skill by tapping the hero, tapping their button, or pressing **1** to **5**.

| Kind | What it does | Heroes |
|---|---|---|
| Strike | Hits the nearest enemy and stuns it for 2 s | Dora 320%, Mossy 260%, Thistle 300%, Onyx 460% |
| Volley | Hits every enemy | Bramble 130%, Cinder 150%, Nutmeg 160%, Aurora 200% |
| Snipe | Hits an enemy that is winding up, or else the toughest, and stuns it for 1.2 s | Clover 360%, Gale 420% |
| Freeze | Hits every enemy and stuns them for 1.6 s | Flint 90%, Willow 110%, Zephyr 150% |
| Heal | Heals the whole squad | Pip 240% |
| Mend | Heals the most hurt hero and shields them for half as much | Frost 450% |
| Ward | Shields the whole squad for a share of the caster's health, for 6 s | Enzo 28%, Pebble 24% |
| Rally | The whole squad attacks faster for 6 s | Ember 35% |

A healer's ordinary attack also tops up the most hurt hero by 40% of the healer's attack.

### Wind-ups

Captains, bosses and hexers have a move that takes 1.8 s to wind up. The ground under the squad reddens, a bar fills over the enemy and the hint line turns red.

- **Slam** (captain every 9 s for 220% attack, boss every 8 s for 280%): hits every hero.
- **Heal** (hexer every 6 s): heals every enemy by half the hexer's own full health.

Stunning an enemy that is winding up cancels the move, and the enemy is **staggered**: stunned for 2.5 s and taking 50% more damage for 4 s. A boss shrugs off half of an ordinary stun, but is staggered for the full time. A shield soaks a slam that cannot be stopped.

Firing every skill the moment it charges wastes the stuns, which is the point of the game: the balance bot's duels give the same squad at stage 30 a 100% win rate with stuns timed and 57% on auto.

### Enemies

Health and attack at stage 1; each later stage multiplies both by 1.06.

| Enemy | Health | Attack | Armour | Notes |
|---|---|---|---|---|
| Scuttler | 440 | 105 | 10 | Every wave has at least one |
| Spitter | 280 | 88 | 0 | Ranged; picks any hero |
| Sneak (from chapter 2) | 320 | 110 | 0 | Fast; goes for the weakest hero in the back row |
| Bruiser (from chapter 3) | 1,050 | 165 | 45 | Slow |
| Hexer (from chapter 4) | 380 | 66 | 0 | Ranged; winds up a heal |
| Captain | 3,500 | 130 | 30 | Winds up a slam |
| Boss | 6,000 | 115 | 40 | Winds up a slam. In chapters 2, 4, 6 and 8, and in the tower, calls a scuttler at 66% and 33% health |

The bosses are Thornback, Mudmaw, Old Croak, Rattlewing, Grimtusk, Frostfang, Cinderclaw and The Hollow King.

## Heroes

Eighteen, six to a faction, and each faction can field every role.

| Faction | Guard | Striker | Archer | Mage | Healer |
|---|---|---|---|---|---|
| Meadow | Mossy (epic, chapter 4) | Dora (epic, start) | Clover (rare), Aurora (legendary) | Willow (epic) | Pip (rare, chapter 1) |
| Burrow | Enzo (epic, start) | Cinder (epic, chapter 5), Onyx (legendary) | Bramble (rare, chapter 2) | Nutmeg (rare) | Ember (epic) |
| Summit | Pebble (rare) | Thistle (rare) | Gale (epic) | Flint (rare, chapter 3), Zephyr (legendary) | Frost (epic, chapter 6) |

A hero marked with a chapter joins when that chapter's boss falls. The other ten come from summons.

**Roles**, for a rare hero at level 1:

| Role | Health | Attack | Armour | Seconds between attacks | Reach |
|---|---|---|---|---|---|
| Guard | 900 | 40 | 60 | 1.3 | Melee |
| Striker | 620 | 70 | 25 | 1.0 | Melee |
| Archer | 420 | 62 | 10 | 0.9 | Ranged |
| Mage | 400 | 85 | 5 | 1.4 | Ranged |
| Healer | 460 | 36 | 10 | 1.3 | Ranged |

- **Rarity:** epic heroes have 12% more health and attack, legendary 26%.
- **Levels:** each level multiplies health and attack by 1.08. A level costs 40 gold at level 1 and 9% more each level after. The cap is 10 plus the number of stages cleared, plus one for each tower floor.
- **Stars:** each star past the first adds 12%. Stars cost 10, 20, 40 and 80 shards; a repeat summons gives 10 shards.
- **Faction bonus:** three, four or five heroes of one faction give the whole squad 10%, 15% or 25% more attack and health.

**Best squad** fields the five strongest heroes and always includes a guard and a healer if you own one, with melee heroes in front.

### Gear

Four slots, five tiers. A first clear always drops a piece; a repeat clear drops one 35% of the time. Chapters 1 and 2 drop tier 1, and the tier rises by one every two chapters, with a 15% chance of one higher, to a top of 5.

| Slot | Each tier adds |
|---|---|
| Weapon | 8% attack |
| Armour | 8% health |
| Charm | 6% skill charge |
| Boots | 4% attack speed |

The forge turns three spare pieces of one tier into one of the next.

## Loot

- **Gold:** 42 at stage 1, 6% more each stage, doubled on a first clear.
- **Scrolls:** the game starts with 3. Odd-numbered stages give one on a first clear. Each chapter has three chests, at 10, 20 and 30 stars, holding 1, 2 and 3 scrolls. Scrolls are never bought.
- **Summons:** 70% rare, 24% epic, 6% legendary, and a legendary on the tenth summons without one. Until five heroes are owned a summons always brings a new one. Story heroes who have joined can come up again, which is how they earn stars.
- **Camp chest:** once the first stage is cleared, the camp fills with gold for up to four hours while the game is closed, at four clears of your latest stage an hour.

## The tower

Clearing the last stage opens the tower: one floor at a time, each 6% harder than the one before, starting where the campaign left off. Every fifth floor is a boss and pays 2 scrolls. Auto is not offered in the tower.

## Saving

`saga-v1` holds the whole saga: heroes, squad, gold, scrolls, the gear bag, stars, chests, the tower floor, and the counters that seed battles and summons. It is written whenever something changes in the menus and on the frame a battle is won or lost. A battle in progress is not saved; reloading during one returns to the map with nothing lost or gained. `saga-sound-v1` holds the mute switch.

A save that fails any check in `Game.load` is ignored whole.

## Balance, from the bot

`tests/saga-bot.mjs` plays the campaign from a fresh save on eight seeds. It summons, takes the best squad, forges, wears gear and spends gold between fights, holds stuns for wind-ups in them, and replays the previous stage once after each loss.

- All eight finish the 80 stages, in 80 to 120 fights, losing 0 to 20 of them and never more than 6 in a row on one stage.
- Wins average 32 to 56 seconds.
- They finish with 190 to 239 of the 240 stars and 17 or 18 of the 18 heroes.
- A squad that never spends gold stops at stage 11 or 12.
- A squad that never fires a skill wins the first four stages most of the time and loses most fights from stage 5.

## Code

- `lib/saga-game.ts`: `Battle` (one fight, fixed 1/60 s step, seeded) and `Game` (roster, loot, progress, saving).
- `lib/saga-art.ts`: heroes, enemies and backdrops by name. See [`saga-art.md`](saga-art.md).
- `lib/saga-scene.ts`: `Field` draws a battle. `take` turns battle events into effects, `inspect` reports what is on screen for the browser tests, `slotAt` finds the hero under a tap.
- `app/saga/`: the page, styles, metadata and sounds. `window.__saga()` returns the game, the field, the pause flag, the speed, the auto flag and a `refresh` for the menus.

## Painted presentation · 13-10-2026

The painted pass adds eighteen hero sprites and dedicated portraits, six enemy sprites, eight boss sprites and eight illustrated chapter landscapes. The named art API keeps code-drawn fallbacks; missing artwork can be retried without losing progress. The wider formation and larger skill cards are visual changes only. Boss health and wind-up meters read live battle state. Marching, lunges, breathing, projectiles, spells, defeats and celebrations remain animated; reduced motion removes scene movement while skills and battle rules continue. See `docs/saga-art.md` for provenance and exact prompts.

The combat-feedback pass shows hero health and active shields on the skill cards, highlights charged stuns that can interrupt a current wind-up (a strike must target the winding enemy, while snipes and freezes can reach it behind an escort), and explains early skill presses. Six painted spell textures expand and fade with real skill events; reduced motion suppresses them. The camp chest opens briefly when gold is actually collected, and painted coins and scrolls accompany the results and summoning screen. Chapter postcards use the existing landscape art. Battle balance and saves are unchanged. `tests/e2e/saga-feedback.mjs` checks these interactions and the ten new texture/prop crops.

Valid skill presses are queued until the next fixed combat tick, including on 120/144/240 Hz displays; duplicate presses before that tick fire once. Invalid time deltas are ignored. This fixes dropped inputs without changing skill costs, targeting or combat balance. The Saga engine tests cover the sub-tick queue.
