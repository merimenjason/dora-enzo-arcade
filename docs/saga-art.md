# Whisker Saga artwork

Everything in Whisker Saga is drawn in code today. `lib/saga-art.ts` is the only file that knows how: the scene and the page ask for a hero, an enemy or a backdrop by name. To move to painted art, add the sheets below, set `PAINTED` to `true` in `lib/saga-art.ts`, and the same calls draw from the sheets. Backdrops stay drawn in code, because they scroll.

## What is drawn today

- **Heroes:** the shared chinchilla from `lib/chinchilla-art.ts` in eighteen coats (`HERO_COATS`), each with a faction neckerchief and the thing their role carries: a shield, a sword, a bow, a staff with an orb, or a staff with a sprig.
- **Enemies:** six kinds and one boss shape, tinted per chapter from `CHAPTER_TINT` (body, dark, light, accent). The boss gains tusks or teeth, back spikes, a crest and, in chapters 4 and 8, wings.
- **Backdrops:** eight lands in `LANDS`, each a sky, two ranges of hills, ground, a path and one kind of roadside thing (flowers, trees, reeds, rocks, stumps, ice, embers, pillars).

## Sheets for a painted pass

All sheets are transparent PNGs in `public/art/saga/`. Every figure stands on the bottom edge of its cell, centred, with a little clear space around it.

| File | Grid | Cells, left to right, top to bottom |
|---|---|---|
| `heroes.png` | 6 × 3 | Dora, Enzo, Pip, Bramble, Flint, Mossy / Cinder, Frost, Clover, Nutmeg, Pebble, Thistle / Willow, Ember, Gale, Aurora, Onyx, Zephyr. Facing right |
| `enemies.png` | 6 × 1 | Scuttler, Spitter, Sneak, Bruiser, Hexer, Captain. Facing left |
| `bosses.png` | 8 × 1 | Thornback, Mudmaw, Old Croak, Rattlewing, Grimtusk, Frostfang, Cinderclaw, The Hollow King. Facing left |

The hero order is the order of `HEROES` in `lib/saga-game.ts`; `cell` in `lib/saga-art.ts` reads the sheets by that order. Painted enemies are not tinted per chapter, so a painted pass either accepts one look for all chapters or adds a row per chapter and a row index to the `cell` call.

### Prompts

Shared style line, to put at the start of each prompt:

> Storybook game sprites, soft painted shading with a dark plum outline, warm rim light, flat transparent background, each figure the same size and standing on the same baseline, side view.

**Heroes** (`heroes.png`, 6 columns by 3 rows, facing right):

> A sprite sheet of eighteen chinchilla heroes, round bodies, big ears and bushy tails, each wearing a small neckerchief. Meadow heroes wear green, Burrow heroes orange, Summit heroes blue. Row 1: a white chinchilla with ruby eyes and a short sword (green); a grey chinchilla with a white chest and a round shield (orange); a beige chinchilla with a staff topped by a clover sprig (green); a dark brown chinchilla with a bow (orange); a slate-blue chinchilla with a staff and a glowing orb (blue); a brown velvet chinchilla with a shield (green). Row 2: a black chinchilla with ember-orange eyes and a sword (orange); a blue-white chinchilla with blue eyes and a sprig staff (blue); a cinnamon chinchilla with a bow (green); a tan chinchilla with an orb staff (orange); a pale grey chinchilla with a shield (blue); a violet chinchilla with a sword (blue). Row 3: a pale gold chinchilla with an orb staff (green); a rust-red chinchilla with a sprig staff (orange); a sapphire chinchilla with a bow (blue); a pink-white chinchilla with a bow, a faint golden glow (green); an ebony chinchilla with amber eyes and a sword, a faint golden glow (orange); a silver-white chinchilla with violet eyes and an orb staff, a faint golden glow (blue).

**Enemies** (`enemies.png`, 6 columns, facing left):

> A sprite sheet of six small woodland troublemakers, cheeky and not frightening. A green beetle with angry eyebrows. A squat toad with its cheeks puffed, about to spit. A long, low weasel wearing a bandit mask. A big round badger with a white face stripe and heavy claws. A toadstool with a red spotted cap, two eyes on its stalk and a twig wand tipped with a glowing bead. A large stag beetle with horns and a small yellow crest.

**Bosses** (`bosses.png`, 8 columns, facing left, each about twice the height of an enemy):

> A sprite sheet of eight big woodland bosses, each a bulky round beast with a small jagged crown, grumpy and not frightening. A green one with thorny back spikes and tusks. A brown one caked in mud with a wide toothy mouth. A teal one with warty skin and tusks. A sandy one with rattling insect wings. A purple one with long tusks. An ice-blue one with icicle spikes and teeth. A red one with glowing ember cracks and tusks. A dark indigo one with tattered wings and a violet crown.

## Checking a painted pass

1. Put the three files in `public/art/saga/` and set `PAINTED = true`.
2. `npm run dev`, open `/saga`, and look at the Squad screen (all eighteen portraits) and one battle from each chapter.
3. Run `node tests/e2e/saga.mjs`. It does not look at pixels, so also check by eye that feet sit on the shadows and that nothing is cropped at a cell edge.
