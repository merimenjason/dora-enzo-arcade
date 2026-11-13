# Little Red Dot: The Straits

Game 103, `/straits`. The first voyage of a 3D sailing adventure around Singapore's islands: a first playable slice, built on 13-11-2026 to see how the idea plays. It has one voyage, one conversation and no sound.

## Code layout

- **Engine**, `lib/straits-game.ts`: all the rules, no DOM. `newGame(seed, hero)`, `step(g, input)` at a fixed 60 ticks a second, `choose(g, answer)` for the conversation, `dockOptions`, `dockAction` and `leaveDock` for jetties, `result(g)` for the medal, and the save helpers. Randomness comes from the seed, so a seed and the same inputs replay exactly. `g.events` holds what happened in the last tick for the page and the scene.
- **Scene**, `lib/straits-scene.ts`: Three.js drawing only. `render(g, time, dt)` draws a frame; `handle(events)` starts splash rings; `project(x, y, z)` gives the page a screen position for its markers.
- **Chinchillas**, `lib/chinchilla-3d.ts`: `makeChinchilla3d('dora' | 'enzo', { layers, sun })`, the furred pair ported from the playpen prototype (see [`playpen-reference.md`](playpen-reference.md)). This game draws them with 14 fur shells; the default is 28.
- **Page**, `app/straits/page.tsx` with `straits.css` and `layout.tsx`: the title, the HUD, the overlays (conversation, jetty, map, pause, end), keys and touch buttons, the loop and the save.

## The map

A square of sea from −96 to 96 on both axes, in metres at toy scale. North is −z. The mainland fills everything north of z = −80. The islands are named for real ones but are not where the real ones are.

| Place | Centre (x, z) | Radius | Jetty |
| --- | --- | --- | --- |
| Tiong Bahru jetty (start) | 0, −75 | | yes |
| Sentosa | −14, −34 | 14 | yes, and a viewpoint |
| The kelong | 20, −24 | 3.2 | |
| St John's Island | 26, 4 | 7 | yes, and a viewpoint |
| Kusu Island | 42, 22 | 4 | |
| Pulau Semakau | −52, 30 | 10 | |
| Pulau Ubin (goal) | 66, 58 | 12 | yes |

An island is added to the map when you come within 16 m of its shore. Docking at a viewpoint adds all of them.

## Rules and numbers

**The boat.** Four gears: stopped, row (2.2 m/s), half sail (4.2), full sail (6.2). Speed rises at 2.4 m/s² and falls at 3.2. The tiller turns at 1.5 rad/s for Dora and 1.2 for Enzo at speed, less when slow. Land, the kelong and the edge of the sea stop the boat.

| | Hull | Reload | Ram damage |
| --- | --- | --- | --- |
| Dora | 100 | 1.25 s | 30 |
| Enzo | 130 | 1.6 s | 45 |

**Volley.** Three peanuts off the side that faces the nearest foe within 18 m (starboard if there is none), 12 damage each, range 14 m.

**Brace.** While held, damage taken is 40% and speed is halved.

**Ram.** A 1.1 s burst at 1.8 times speed, six seconds to recover. Touching a foe during it deals the ram damage and costs you 5.

**Foes.**

| | Health | Speed | Sees you at | Throws | Bump |
| --- | --- | --- | --- | --- | --- |
| Otter raft | 40 | 3.1 m/s (half that on patrol) | 17 m | one clam, 5, every 2.6 s | 8 |
| Captain Bishan | 170 | 3.9 | 60 m | three clams, 7 each, every 1.7 s | 14 |
| Cat hunter | 90 | 5.1 | anywhere | one harpoon, 9, every 2.1 s | 10 |

Five rafts patrol fixed loops. Sinking one leaves 4 to 7 seeds, takes 15 off otter power and adds a bounty pip (five at most). At two pips a cat hunter appears 40 m away; sinking it (10 seeds) or paying the bounty clears it. At 40 power or less Captain Bishan casts off from the kelong; sinking him (20 seeds) sets power to 0 and calms the rafts for good.

**The conversation.** Opens once, the first time you come within 9 m of the kelong.

- Bargain: lose 25 hay; the rafts are calm. Firing on a calm raft ends the truce.
- Bluff: works with probability 0.65, less 0.15 for each bounty pip, never below 0.2. If it works the rafts are calm and the hay is untouched; if not, Bishan casts off.
- Fight: Bishan casts off.

**Jetties.** Press E within 4.5 m at under 3 m/s. Patch the hull (1 seed for each 10 missing), add a plank (+25 hull for 10 seeds, up to three), bigger peanuts (+4 damage for 10 seeds, up to 24), pay off the cats (4 seeds a pip). At Ubin, E lands the hay and ends the voyage.

**Capsizing.** At 0 hull you lose 15 hay and half your seeds and restart at the last jetty you docked at with 60% hull. With no hay left the voyage is lost.

**Medals.** Gold for all the hay, silver for 70% or more, bronze below.

## Save

`localStorage` key `straits-v1`: `{ v: 1, hero, best, bestTime, voyages }`. Only the best medal (and its time) and the number of voyages landed are kept; a voyage in progress is not saved.

## Tests

- `npm run test:straits`: 16 engine tests, including a seed replaying exactly and an autopilot that bargains and lands the hay as each hero.
- `npm run test:e2e:straits`: a browser run at 1280×720 and 390×844 through the arcade card, the title, sailing, a volley, the map, pause, the conversation, a jetty and landing the hay. It moves the boat through `window.__straits()`, which returns the live game.

## What is missing

- **Balance from real play.** Only the autopilot and one scripted browser run have played it. Raft damage, the hunter's speed and seed prices are first guesses.
- **Sound.** None.
- **Going ashore.** The islands are scenery with jetties; there is no on-foot play.
- **More story.** One conversation, one quest, one faction. The macaques, mynas and the wider turf war from the mockup are not in.
- **Wind, upgrades beyond three, a crew.** Not in.
- **Menu art.** The arcade card uses an emoji like the other newest games.
- **Phone layout.** The touch buttons work in the browser test but have not been tried on a real phone.
