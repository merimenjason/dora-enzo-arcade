# Changelog

Notable changes to Dora & Enzo's Arcade, newest first. Every push to `main` deploys to https://chinchillas.jason.engineering, so there are no version numbers; entries are grouped by commit date instead. The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 11-09-2026

### Added

- **Arcade favicon:** pixel Dora and Enzo on the arcade navy, replacing the unused "Cc" placeholder. There is also an Apple touch icon. The site now links the icons, so they finally show in browser tabs and bookmarks.
- **Mountain Retreat:** guest profiles, goals, surprises, mini-games and a scrapbook.
  - Click any guest to see their name, home village, bio, wish and friendship. The guest in a room can be offered an oat cake or herbal soap once per visit, for extra hearts; regulars also gain friendship.
  - Nine lodge goals each pay tips once, leave a keepsake by the lodge, and raise its title from Mountain hut to Legend of the Andes.
  - Surprise events: mountain storms, a travelling musician, and lost hikers to rescue.
  - Two optional mini-games: pour the perfect cup of tea, and catch the season's weather.
  - A scrapbook: snap the lodge into up to 12 photos with editable captions.
  - Existing journals upgrade automatically to the new save format.
- **Mountain Retreat:** more distinctive guests and a livelier scene.
  - Each guest type wears its own accessory: a traveler's straw hat and suitcase, a hiker's backpack and walking stick, a pastry fan's chef hat, a stargazer's nightcap and telescope, a painter's beret and brush, a duchess's tiara and pearls.
  - Arriving guests show their wish in a bubble. Regulars wear name tags. Happy guests hop, guests turned away walk off down the path, and guests doze at night.
  - Seasonal weather: spring petals, summer butterflies, autumn leaves and winter snow.
  - Twinkling stars, glowing rooms and a stargazer on the roof at night.
  - Art in each room for its specialty.
  - The six summit decorations are now six different objects on the lodge: a pennant, a wind chime, a lantern, a garden gnome, a flower box and a weathervane.
  - A backdrop for each outing, a mountain viscacha that visits after summit trips, chimney smoke that thickens as guests arrive, and guests chatting with the hosts.
- **Mountain Retreat:** easier to read at a glance.
  - A **?** beside tips, hearts, supplies and the rating shows exactly where each number comes from.
  - A countdown ring shows when the next guest arrives.
  - A season strip shows the time until the next season and until nightfall.
  - Each guest visit shows its rewards floating over the room, and coats that are new to the album are highlighted.
  - A "while you were away" summary appears when you come back.
  - Keys 1–4 set Dora's and Enzo's duties.
  - Optional soft sound (off by default).
- **Mountain Retreat:** more depth.
  - **Guest wishes and reputation:** every visit has a featured guest with a wish (a room, sometimes an oat cake or herbal soap, sometimes Extra comfort). Granting wishes earns reputation, and a one-to-five-star rating unlocks new guests and bigger tips. Unmet wishes and turned-away guests cost reputation. A guest book shows who is coming next and how the last guest left.
  - **Specialties:** each room picks one of two specialties at level 3.
  - **Enzo's recipes:** crafting now bakes oat cakes and makes herbal soap for the pantry.
  - **Destinations:** three expedition trails: Glass lake, the Juniper trail and the Condor summit. The summit finds decorations for the lodge.
  - **Album and regulars:** a guest album of every guest type and coat. Named regulars (Pip, Mochi and Luna) come back and send postcards as your friendship grows.
  - **Seasons and nights:** each has its own bonus. Stargazers visit only at night, and snow closes the summit in winter.
  - **Saves:** existing journals upgrade automatically to the new save format.
- **Mountain Retreat:** Dora and Enzo now walk between the open rooms. They walk between rooms side by side, hop between floors, and freeze while they're away on outings. Before each guest visit, one visiting chinchilla per open room walks up the path, then sits in its room with a heart. Guests come in five coat colours. The scene caption shows whether guests are on the path, staying, or the hosts are away. Adds a new scene browser test (`tests/e2e/mountain-retreat-scene.mjs`).
- **Automatic deploys:** every push to `main` that passes typecheck, tests and build deploys to Cloudflare Workers at chinchillas.jason.engineering. A new `npm run deploy` script covers manual deploys.
- **README:** a guide for all twelve games in one format (Play, Controls, Tests, Docs), deployment instructions, and a checklist for adding a game. `tests/readme.mjs` now fails `npm test` if the README drifts from the arcade menu.
- MIT license, plus notes on CI and contributing.

### Changed

- GitHub Actions updated to v5 to clear the Node 20 deprecation warning.

### Documentation

- This changelog, covering every change since the first commit, plus a rule in `AGENTS.md` that asks agents to add an entry with each change.

## 10-09-2026

### Added

- **Mountain Retreat**, the twelfth cabinet: a pixel-style idle lodge where Dora welcomes guests and Enzo gathers supplies. Open and upgrade four rooms and go on expeditions or festivals. Progress is saved locally, with up to eight hours of offline progress.
- **Mountain Retreat:** a Light / Dark / System theme that each browser remembers, and larger, more readable text.

### Fixed

- **Dust Bath Dash:** Enzo's coat is grey again, and Dora appears at her station.
- The Dust Bath Dash browser test expects twelve cabinets when returning to the arcade.

### Documentation

- Recorded exactly which older browser tests were re-run for the Mountain Retreat launch, and their limitations.

## 09-09-2026

### Added

- **Dust Bath Dash**, the eleventh cabinet: a cozy chinchilla spa, later overhauled with deeper play and richer visuals.
- **Chin x Pit · Classic:** the original ball-bouncing game, restored as its own cabinet alongside Night Survivors.
- A Graft code graph and wiring for coding agents.

### Changed

- The whole site was rebranded as **Dora & Enzo's Arcade**.
- Every game has a clear **MAIN ARCADE** link back to the menu.
- The survival game's arcade entry is named Chin x Pit again.
- The repository was prepared for GitHub downloads, and the site description corrected to ten games.

## 08-09-2026

### Added

- **Dust & Documents:** a *Papers, Please*-style border-inspection game in a 3D Andean booth, with Dora, Enzo and travelers who walk up to the window.
- An arcade main menu linking every game (eight at the time).
- **Dust & Documents: Remake:** a redesigned booth with evidence-based inspection, plus a record mapping each requirement to its checks.

### Fixed

- Booth staging: Dora and Enzo stand side by side at the window instead of clipping through the desk, and travelers turn to face Dora. Approved travelers now walk through the gate along a clear exit lane, without clipping the scale or barrier.

## 07-09-2026

### Added

- **Pawprint Grand Prix:** a kart racer with Dora and Enzo sharing a kart against predator racers.
- **Fluffball Cup:** soccer, with Dora's team against Enzo's.
- **Spy Escape:** a stealth escape from a cage into a guarded room. The cage has shelves to climb and an orbiting camera, both based on reference photos. Later updates added tougher patrols, limited decoys, a timed desk search, different abilities for each leader, interactive cage props, disguises, a radar and guard stuns.
- **Paw Fighter II:** a fighting game with portrait character cards and a distinct fireball for each fighter, thrown with quarter-circle inputs. It has rising attacks, a super move for each fighter, and a seven-chapter story mode, later retold as a chinchilla's journey from the Andes to US citizenship. Training mode has a configurable dummy and combo-damage tracking.

### Fixed

- **Spy Escape:** cage collisions, the jump to the hay feeder, overlapping shelf surfaces, and shelves not fading together. Dora and Enzo were enlarged, with collision sizes to match.
- **Paw Fighter II:** character selection, and articulated chinchilla feet instead of glove-like paws.

## 06-09-2026

### Added

- **Dustbound:** an isometric chinchilla action RPG with procedurally generated dungeon floors, XP levels and branching skill trees. The trees were later reworked into mystic arts, stances and a spirit form. It now lives at `/adventure`.
- A ball-bouncing roguelite with elemental fusions. Its weapons gained piercing, splitting, life-drain and knockback, and it added predator enemies, hidden enemy health, free movement across the field, and fusion suggestions at level-up. It became **Chin x Pit**, then the Night Survivors survival arena for both chinchillas, set on a rocky Andean plateau.
- **Border Hop:** a Flappy Bird-style flying game for the pair, later refined with better rewards, clearer feedback and quick retries.
