# Tembusu

Game 106, at `/tembusu`. A calm pixel-art idle roguelite about one tembusu tree on a hill, from seed to fall. The tree grows by itself in real time, even with the tab closed. Now and then a branch reaches a fork and offers three buds; you pick one, or after an hour the tree picks for itself. Animals move in according to the tree's shape, storms and dry spells pass, and when the tree falls you keep up to three of its seeds. Enzo plants one and the rest go into his journal. Earlier trees stay on the hill.

Code: engine `lib/tembusu-game.ts`, scene `lib/tembusu-scene.ts`, page `app/tembusu/` (page, sound, styles), art `public/art/tembusu/` with its index `lib/tembusu-art.ts`.

## Time

The engine never reads the clock. A tree is a pure function of its seed, its planting time and the timestamped picks (`derive(tree, now)`), so a closed tab catches up at once, one long jump gives the same tree as many short ones, and a clock set backwards never rewinds it (`now` is clamped to the latest time seen).

| Constant | Value | Meaning |
| --- | --- | --- |
| `FIRST_TREE_MINUTES` | 15 | The first tree is a short tutorial: about 15 minutes, 5 forks, with a fruiting and a storm guaranteed. |
| `TREE_HOURS` | 12 | Every later tree lives about 12 hours of growth (the life varies ±8%, and Long-lived trees get 12% more). |
| `SLOW_HOURS` | 24 | The optional slow speed, in Settings; it applies from the next tree. |
| `FORKS` / `FIRST_FORKS` | 8 / 5 | Forks per tree, evenly spaced through its life. |
| `ASSIST_WAIT` | 60 minutes | A fork waits this long for you, then the tree picks the bud that fills its biggest need. |
| `KEEP` | 3 | Seeds you can keep when a tree falls. |

Growth time stops while a fork waits, so the twelve hours are hours of growth, not wall time. A fallen tree waits for you indefinitely. The time of day (dawn 5.30–8, day 8–17.30, dusk 17.30–20, night) follows your own clock.

## A tree's life

- **Buds** (three of six at each fork): Wide branch (room for more animals), Tall leader (catches light, can snap in a storm), Flower (bees and sunbirds, then fruit), Deep root (holds water through a dry spell), Hollow (a nesting hole), Thick bark (stands up to lightning and beetles).
- **Events,** about ten in a grown tree's life: storm, dry spell, lightning, beetles, fruiting and migrants passing through.
- **Animals** (12), each needing a shape and helping or costing something: Oriental pied hornbill, Sunda colugo, plantain squirrel, crimson sunbird, Asian koel, Oriental magpie-robin, cave nectar bat (night), clouded monitor lizard, giant honey bees, common birdwing (day), collared kingfisher and Sunda slow loris (night). The journal lists each one's needs and effect.
- **The fall:** in old age, or earlier if storms and troubles wear it down, the tree lies down gently. A wordless recap shows its buds, its animals and the log; then 4–6 seeds drop, each carrying one of 20 traits (from its buds, its animals, its parent seed or chance).
- **Seeds:** keep up to three, plant one, and the other two go into Enzo's journal (up to 12), from where they can be planted later.
- **The hill:** earlier trees take six fixed slots on the slopes, as a stump, then a sapling, then a young tree as later trees grow.

## Dora and Enzo

Dora lives in the crown: she waters the tree at a fork, carries her things after a branch breaks, waves at a new arrival and braces in a storm, and from the time the tree is big enough she has a little house on its lowest branch. Enzo sits at the roots: he reads and writes in his journal, and plants each new seed. Each action has its own painted animation.

## Controls

Mouse first. Click a glowing bud on the branch, or a bud in the panel at the bottom right (which appears only when there is a decision). Keys: 1, 2, 3 pick a bud; J opens the journal; Esc closes it or Settings. Sound is soft and optional; Settings has sound, grow speed, starting the hill over (two clicks) and the way back to the arcade.

## Save

`localStorage` key `tembusu-v1`: the current tree's inputs (seed, planting time, time zone, hours, starting traits and picks), the kept seeds, and the journal (seeds, animals and traits seen, past trees). A corrupt save starts a new hill.

## Art

Every picture is painted by Codex on a magenta ground (`~/arcade-protos/tembusu/art/gen.py`), then `scripts/tembusu-art.py` keys out the magenta, cuts the sheets, shrinks each sprite nearest-neighbour by a whole factor, maps everything to one shared 64-colour palette and packs `atlas.png`. The six hills (dawn, day, dusk, night, storm, dry) and the title are 384×256 with their own palettes. The scene draws at 384×256, scaled up in whole pixels, and assembles the tree from trunk, branch, leaf, flower, fruit, hollow and root pieces.

## Tests

- `npm run test:tembusu` (`tests/tembusu.mjs`): no clock reads in the engine, determinism, long jump equals short jumps, backwards clock, a week and a month away, the fork wait and assist, run lengths, seeds and planting, the hill, content counts and save round trips.
- `npm run bot:tembusu` (`tests/tembusu-bot.mjs`): many trees played at a human pace by random, assist-only and always-one-bud players. Every animal and trait is reachable, no bud strategy dominates (best within 1.2× of the next and 1.3× of random), and a grown tree averages `TREE_HOURS`.
- `npm run test:e2e:tembusu` (`tests/e2e/tembusu.mjs`, needs `npm run dev`): at 1280, 1536 and 1920 wide, with sound off and Chromium muted, it plants the first seed, skips time through the whole tutorial tree, picks buds by clicking the branch, by key and in the panel, keeps three seeds and plants one, opens the journal and Settings every way, checks a backwards clock and a week away, and saves screenshots of every time of day, storm, dry spell, a fork, the recap, the seed pick and the journal to `.shots/tembusu/`. `window.__tembusu.skip(ms)` moves the page's clock for this.
