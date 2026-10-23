Repo: dora-enzo-arcade. Run this only after the first build (`1-build-game.md`, branch `codex/grumble-hunt`) has been reviewed. The review fixes are on `codex/grumble-hunt-fixes`, which is the first build plus those fixes.

Goal: add Grumble Hunt's story mode, 16 weapon types with branching trees, armour, crafting, and the Monster Hunter mechanics the design picks. Build it as five separate branches, one per step in **Build order** in `docs/grumble-hunt/expansion-design.md`, each based on the previous one, and push each when it's done:
- `codex/grumble-hunt-x1-alive`
- `codex/grumble-hunt-x2-pantry`
- `codex/grumble-hunt-x3-forge`
- `codex/grumble-hunt-x4-hopon`
- `codex/grumble-hunt-x5-story`

Don't open pull requests and never push to `main`.

Setup:
- Run `git fetch origin`. Create the first branch from `origin/codex/grumble-hunt-fixes`, not `codex/grumble-hunt`, then merge in `origin/grumble-hunt-base`. That brings in the design doc, `lib/grumble-hunt-content.ts` with its tests, and the prompts. If `codex/grumble-hunt-story-art` has been pushed, merge it too for the new art (listed in `docs/grumble-hunt-story-art.md`), and use that art where the design asks for it.
- Read AGENTS.md, CLAUDE.md, `docs/grumble-hunt/expansion-design.md` (the source of truth for every number and rule), `docs/grumble-hunt.md`, and the existing engine, scene and page for Grumble Hunt.

Use the content module; don't duplicate it:
- `lib/grumble-hunt-content.ts` already holds all the data and pure helpers: materials, drop tables (`rollShed`, `rollCalm`, `rollGather`), Pantry items and snacks, weapon types and the tree (`WEAPON_TREE`, `nextNodes`, `weaponStats`), armour (`armourCost`, `armourBonus`), the story chapters and pages (`STORY`), and `validate()`.
- Wire the engine to it, passing the engine's seeded random generator wherever a helper takes `Rand`. If the first build already has its own materials or Forge data, replace it with the module and keep the behaviour the module describes.
- Add `lib/grumble-hunt-content.ts` to the `tsc` list and `tests/grumble-hunt-content.mjs` to the `node` list of the `test` script in `package.json`.
- The tests in `tests/grumble-hunt-content.mjs` must keep passing. If you change content numbers, rerun them and the bot.

Each step:
1. **Alive hunts:**
   - **Extra Grumpy:** below 30% Grump, puffs of steam come from the ears, red eyebrows, +15% speed, and telegraphs 0.1 s earlier.
   - **Enzo's sniff:** glowing pawprint trails to the beast when it's out of sight.
   - **Buddy commands:** hold Tab and tap Q/E for stay close, go bonk or gather.
2. **Pantry:**
   - gathering spots per area (press F, 1.2 s);
   - Pantry item crafting, and the item ring (6 slots, Q/E and F);
   - traps (sticky sap), the dizzy bell and the smoke puffball;
   - snacks before a hunt.
3. **Forge:**
   - a weapon rack for picking any of the 14 basic weapons at the start, and all 16 weapon types with their signature moves (`WEAPON_TYPES`, `BASIC_WEAPONS`, `MH_EQUIVALENT` and `FIRST_PICKS`);
   - each weapon's 3D model and held pose from the look test (`?weapon=<id>` in `docs/grumble-hunt/look-test/`, built on branch `codex/grumble-hunt-weapons`). Merge `origin/codex/grumble-hunt-weapons` in for this step if it isn't in yet;
   - the Forge tree screen, a node graph per weapon type with costs, greyed out until affordable;
   - armour sets drawn as small accessories on `lib/hunt-chinchilla.ts` models, never covering the face or ears;
   - the save bumps to `grumble-hunt-v2`, migrating v1 as the design says.
   - Each new weapon is held with `poseArms`, the same way the hammer and bow are (see `docs/grumble-hunt/look-test/main.ts.txt`, `poseGrips`).
4. **Hop-on:** mounting a dizzy beast, with the Pinecone Yo-yo making it easy.
5. **Story:**
   - the villagers (Mossback, Bramble, Pip, Wren) as simple low-poly toon figures at their stations;
   - storybook pages from `STORY` (a painted panel, a paper card with the speaker portrait, tap, Enter or J to advance, Skip);
   - chapters 0–5 in the four new areas, using the new textures, skies and cards;
   - the post-game: free hunt, Extra Grumpy variants and Wren's bounties seeded by date.

Every step:
- Kind words only: bonk, dizzy, calm, nap, shed, boop.
- Telegraphs at least 0.6 s ahead.
- Keyboard and touch controls for everything new.
- Keep the engine deterministic.
- Extend `tests/grumble-hunt.mjs`, the bot (it must clear chapters 0–5 using only gear it crafts) and the browser test.
- Update `docs/grumble-hunt.md`, the README game guide, and the CHANGELOG under that day's date (Markdown dates are dd-mm-yyyy).
- Run `npm run typecheck`, `npm test` and `npm run build`, plus the browser suite with `npm run dev` running.
- Play-test it in a browser on desktop and phone sizes.

Finish each step by committing and pushing its branch. Report what works, what was tested, and any remaining limitations.
