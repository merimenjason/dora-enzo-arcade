# Salt & Dust

Game 97, at `/salt-dust`. An isometric, turn-based exploration RPG on a high-Andean salt flat. This is the first playable chapter: Tunupa Well, the crossing, and Coipa Yard. The design brief and the four mock-ups it was built from are in [`docs/ideas/salt-and-dust/`](ideas/salt-and-dust/).

## Code layout

- `lib/salt-dust-world.ts`: the data. Heroes and their skills, the two maps (24×24 isometric grids whose walkable masks were traced from the paintings), people and where they stand, every conversation node, the journey map and its legs, the Runners, the fight's start positions and every balance number (`RULES`).
- `lib/salt-dust-game.ts`: the engine, `SaltGame`. Deterministic, no DOM; randomness comes from a seeded generator whose state is saved, so a save replays exactly. Modes: `explore`, `talk`, `travel`, `combat`, `finding`, `end`.
- `lib/salt-dust-scene.ts`: Canvas 2D drawing only (1536×864): the painted plates, depth-sorted sprites with an animation per action, the fight grid, hit-chance tags and the journey map.
- `lib/salt-dust-art.ts`: generated sprite manifest (cell size, frames, foot line).
- `app/salt-dust/page.tsx`: input, the loop, saving and the HTML HUD (party, canteen, dialogue, travel, fight bar, menu, ending card). `salt-dust.css` lays the HUD out in container units; on a phone held upright the panels move under the picture.
- `app/salt-dust/sound.ts`: small WebAudio effects and a quiet drone.

## The heroes

| | Health | AP | Scout | Speech | Barter | Repair |
|---|---|---|---|---|---|---|
| Dora | 14 | 7 | 6 | 3 | 3 | 2 |
| Enzo | 16 | 6 | 3 | 5 | 5 | 7 |

A check uses whichever hero is better at it. Some earlier choices add +1 (Wayra's tip on the pump helps Barter; Wayra's errand helps Speech with the Wardens; the Wardens' word helps Speech with Tika). A check passes when the total reaches the number; there is no dice roll, so with help on the option shows whether it will pass. A failed check is remembered and can raise a price (Tika's toll goes from 3 to 4 water).

## The story and its checks

- **Wayra** gives the errand. `[Scout 5]` reads the Runners' cart tracks (the fight starts quiet: the Runners nap the first round). She tips you about Parina's broken pump and lets you rest by her fire.
- **The Warden Captain**: pay 2 silver for 4 water, `[Repair 6]` mend the well pulley for a full canteen, or `[Speech 6]` (+1 with Wayra's errand) win the Wardens' word to share any spring found, which also gives 2 water.
- **Parina of the Brine Guild**: "Water is three cups a silver. For strangers, four." Buy two cups for 3 silver, or `[Barter 6] Three, and we mend your pump.` (+1 with Wayra's tip) for a Guild seal and 3 water.
- **Tika of the Dust Runners**, at Coipa Yard: `[Speech 6]` with the Wardens' word (share the spring), `[Scout 6]` point out her sail-cart's cracked mast if the caravan told you of it, show the Guild seal, pay a toll of 3 water (4 after a failed check), or fight.

## The journey

Tunupa → Red Lagoon → Coipa is 2 stages of 2 water. Tunupa → first cactus island → far cactus island → Coipa is 3 stages of 1 water. Water drains a cup at a time while the party walks; with an empty canteen each stage costs 2 health (never below 1). Events, once each: the Runners' carts at the lagoon (`[Scout 6]` hide, or be seen), a silted cistern on the first island (`[Repair 5]` +4 water, or +1 water and a rest), a stranded caravan on the far island (give 2 water or `[Repair 6]` for silver and the mast tip). You can rest on the flat for a cup of water, or turn back to town from Tunupa.

## The fight

Turn order: Dora, a Runner, Enzo, a Runner, Tika. Moving costs 1 AP a tile. Dora's sling costs 3 AP, reaches 6 tiles, hits 85% minus 5% a tile past the first (never under 40%) for 3–4. Enzo's pole costs 3 AP, hits adjacent at 85% for 4–5. Enzo's Mend (3 AP, twice a fight) heals 5; Drink (2 AP, 1 water) heals 3. Runners have 10 health, Tika 12, all 6 AP; a spear jab hits 70% (60% with help) for 3–4 and they jab up to twice a turn, and a Runner on 2 health or less runs. Down Tika or two Runners and they give up. If both heroes go down, you wake with half health and half the water and can try again. The bots keep this at about 93% wins for a casual player with help on.

## Art

All art was painted by Codex. `docs/salt-dust-art/jobs.txt` holds the 27 prompts (`id|size|refs|prompt`) and `gen.sh` runs one (`ART_DIR=<folder> zsh gen.sh <id>`). `scripts/salt-dust-art.py <paintings> <mock-ups>` keys the green sprite sheets, cuts and foot-aligns the frames, crops the plates and UI pieces, writes `public/art/salt-dust/*.webp` and regenerates `lib/salt-dust-art.ts`. Every action has its own frames (walk front and back, attack, hit, down, talk, drink, cheer, Enzo's crank and mend, NPC gestures, llama graze and walk).

## Save

`localStorage['salt-dust-v1']` holds `{ v: 1, mode, place, at, f, water, silver, hp, pos, rng, passed, failed }`; a fight is not saved mid-turn (a save during a fight resumes before it). Settings live under `salt-dust-v1-settings`. A corrupt save is ignored.

## Tests

- `npm run test:salt-dust`: 23 engine tests.
- `npm run bot:salt-dust`: the casual-player fight bot (help on ≥85% wins, the quiet start no harder, not 100% for everyone) and the random whole-chapter bot (every seed reaches the ending). `npm test` runs it with `--quick`.
- `npm run test:e2e:salt-dust` (needs `npm run dev` and Playwright; `BASE_URL`, `SHOTS=<dir>` for screenshots): real clicks and keys through the title, every person, every kind of reply, the menu, save and continue, both routes and every event, every peaceful way past Tika, the fight (move, sling, pole, Mend, Drink, End Turn by button and key, winning and losing), the pump, the ending card, a corrupt save, and a phone held upright.

`window.__salt()` returns `{ g, scene, screen, at(x, y, lift), busy }`: the engine, the scene, the current screen, the page position of a tile, and whether an animation is playing. `main[data-ready="true"]` marks hydration.
