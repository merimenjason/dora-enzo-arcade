# Tambak

An area-capture game drawn entirely in coloured sand on a sand artist's lightbox. Written 28-11-2026 as an overnight
surprise: the brief was "a new type of game with a unique art style, your best, no mistakes", made while the user was
away, so every decision below was made without asking and is written down here.

*Tambak* is the Malay word for filling and embanking land, the word Singapore's reclamation works go by.

## Why this game

- **A genre the arcade didn't have.** None of the 110 games before it was area capture (the family where you cut off
  parts of a field by drawing lines across it). It is not a clone of any one game: the hero walks freely on land, the
  creatures always keep their own water, your own line is a wall instead of a death, a tide clock replaces a stage
  timer, and pickups are claimed by filling the water around them.
- **The mechanic is the place.** About a quarter of Singapore stands on reclaimed land. Area capture *is* reclamation:
  pour a line into the sea, close it off, and the sea becomes land. Every site is a real place built that way.
- **A new art style.** Coloured sand on a lightbox (the stage art of sand-animation performers) had not been used: not
  terrazzo, cross stitch, kung-fu comic, woven textile, pixel art, shadow puppets, neon or cyanotype. It also fits the
  material: the land is literally sand.

## The idea

A quarter of Singapore stands on land poured into the sea. Dora and Enzo, in hi-vis vests and safety helmets, pour some
more. Walk the shore, step into the water to lay a line of sand, and come back to land: every patch of sea with no
creature in it fills in, and the place appears in sand as you pour it. Creatures that touch a line wash it away and
cost a sand bucket.

## The graphics

- **The sea** is the sand artist's empty lightbox (`public/art/tambak/sea.webp`): pale sand ripples on warm glowing
  glass, with a slow breathing light over it.
- **The land** is the site's Codex sand painting (`ecp.webp` and the others), shown through a mask. The mask is the
  cell grid smoothed up to pixels and cut against fixed grain noise, so every shore crumbles like poured sand, with a
  darker damp-sand rim. A claim pours outward from the line: each cell appears a moment after its neighbour nearer the
  trail.
- **Trails** are lines of coloured grains in each hero's sand (Dora terracotta, Enzo ochre), with the dark groove a
  fingertip leaves along the middle.
- **Sprites** are Codex sand paintings on flat green, keyed by how far green leads red and blue (so the olive
  crocodiles stay), despilled, with speckle holes refilled from the surrounding sand: Dora and Enzo (16 frames each:
  idle, blink, walking down, right and up, pouring, hurt, cheering, sad, waving, planting a flag, dizzy), the jellyfish
  pulse, the crocodile swimming and snapping, the pufferfish at three sizes, the horseshoe crab walking, Captain Bakau
  (swimming, lunging, dizzy under a net), a wave splash and a sand burst, and the pickups.
- **Readability on the pictures.** The chinchillas and the crab walk the busy painted land, so each has a soft halo of
  lightbox glow behind it, and the crab a red dashed ring. The chinchillas are drawn over the HUD strip, so one standing
  on the top shore stays in view. The key hint shows for the first 15 seconds of a site (and again when the keys
  change), along whichever edge of the field has no chinchilla near it.
- **The title** is a Codex sand painting of the heroes pouring a sandbank with the skyline behind, under the word
  TAMBAK poured as grains of coloured sand over a dark rim.
- **Menus** sit on the sand artist's work table at night (jars of sand, a scoop, a kopi). Site cards show the painting
  faded under the lightbox until you fill it.

Every picture was painted by Codex; `scripts/tambak-art.py <paint-dir>` turns the paintings into the atlases in
`public/art/tambak/` and the frame boxes in `lib/tambak-art.ts`.

## Outfits

Reclamation workers: Dora (cream-white fur) wears an orange hi-vis vest, a white safety helmet and green rubber boots;
Enzo (grey fur) a lime-yellow vest, a blue helmet and black boots. No signature items. Every Dora prompt named her
helmet as her only headwear so Codex would not copy the bandana from the reference painting, and every frame was
checked.

## Rules

The field is 96 by 50 cells with a two-cell rim of land; the sea inside is 92 by 46 cells (4,232).

- **Walking.** The hero moves one cell at a time, 12 cells a second, only while a direction is held (no momentum). With
  several keys held, the newest one wins.
- **Pouring.** Stepping from land into the sea starts a line; every sea cell you step on becomes your line.
- **Claiming.** Stepping back onto land turns the line into land, then flood-fills the sea from every sea creature:
  any sea left unreached (no creature in it) becomes land. Creatures always keep their water, which makes claims
  readable: close off an empty bay and it fills.
- **Lines are walls.** You can't walk onto your own line (turning back does nothing) or your partner's.
- **Hits.** A sea creature touching your line washes the whole line back to sea, sends you back to the shore cell where
  it started, and costs a sand bucket. After a hit you blink for 1.6 seconds and can't be hit again. Sea creatures
  can't touch you on land.
- **Buckets.** Three to start, five at most; lose the last and the site is lost.
- **The tide.** Each site has a tide clock; when it runs out the site is lost. Warnings at 30 and 10 seconds. Standing
  still on land is safe from the creatures but loses to the tide.
- **Win.** Fill the target share of the sea: 75%, or 70% with gentle tides.
- **Score.** 10 a cell, plus 5 a cell beyond 150 in one fill (big fills pay more), 250 a pickup, and on a win 20 a second
  of tide left and 500 a bucket kept.
- **Stars.** One for winning, one for losing no buckets, one for beating par.

## Creatures

All real Singapore sea life (and one cheeky boss):

| Creature | Behaviour |
|---|---|
| Moon jellyfish | drifts diagonally, bouncing off land, 6 cells a second |
| Estuarine crocodile | the same at 10 cells a second |
| Pufferfish | 5 cells a second; every 5.8 s it puffs up from a radius of 0.6 to 1.5 cells and slows to half while big (a dotted ring shows the full size as it puffs) |
| Mangrove horseshoe crab | lives on land, not water: climbs out once 25% of the sea is filled (Jurong Island, Semakau and Tuas), as far from the heroes as it can, and walks the land diagonally, bouncing off the water and the outermost row of the rim (so it stays in view); walking into you costs a bucket |
| Captain Bakau | the huge old saltwater croc of the Tuas sea, radius 1.5 cells: whenever there is a line in the water she turns toward its nearest cell and speeds up by 30% |

Fast creatures move in quarter-cell sub-steps so nothing skips over a one-cell line. Creatures never start within 12
cells of a hero.

## Pickups

One at a time floats in open water now and then (every 12 to 18 seconds), and sinks after 15 seconds. Fill the water it
floats in to claim it:

- **Kopi** (in a kopitiam cup): 16 cells a second for 8 seconds.
- **Net**: every creature at half speed for 8 seconds (Captain Bakau goes dizzy).
- **Spare bucket**: one more bucket (more likely to float when you have fewer than three).

## Sites

Six real reclamation sites, each opening when the one before is won:

| # | Site | Creatures | Tide (gentle) | Par |
|---|---|---|---|---|
| 1 | East Coast Park | 2 jellyfish | 3:00 (3:45) | 1:50 |
| 2 | Gardens by the Bay, Marina South | 2 jellyfish, pufferfish | 3:10 (3:57) | 2:00 |
| 3 | Changi Airport | jellyfish, pufferfish, crocodile | 3:20 (4:10) | 2:10 |
| 4 | Jurong Island | jellyfish, pufferfish, 2 crocodiles, crab | 3:50 (4:47) | 2:30 |
| 5 | Pulau Semakau | jellyfish, 2 pufferfish, 2 crocodiles, crab | 4:10 (5:12) | 2:50 |
| 6 | Tuas Port | Captain Bakau, crocodile, pufferfish, crab | 4:20 (5:25) | 3:00 |

## Gentle tides (assist)

On by default: creatures swim 20% slower, the target is 70% instead of 75%, and the tide clock runs 25% longer.

## Two players

Enter during play brings in player two on the top shore, mid-pour or not; player one's line is untouched. Player one
(whoever is chosen to pour) uses WASD; player two the arrows. Buckets are shared. With one player, Q swaps Dora and Enzo
where they stand.

## Bots and balance

`Bot` in the engine plays like a careful person. It looks again only every 200 to 300 ms. On land it picks a trip: a
launch point on the shore and a shape to pour, either a straight line across to the far shore or a box out and back.
It picks the one that fills the most per second of walking and pouring, among trips it judges no creature can reach in
time (it follows each creature's bounces off the land forward, the way a player reads them, with a margin that shrinks
and a heading error that grows as its skill drops). It looks again from the shore before stepping out, and in the sea
it runs for the nearest land when a creature could reach the line before it can get home. `careless` turns the safety
checks off.

From the tests (four seeds a site, gentle tides): the careful bot (skill 0.8) and a sloppy one (skill 0.5) clear every
site, the careful one usually in one to three minutes. A careless bot loses most of sites 3 to 6 to the creatures, and
standing still always loses to the tide. With gentle tides off, the sloppy bot sometimes runs out of tide on the later
sites, which is the intended challenge.

## Controls

- Solo: WASD or the arrows walk; Q swaps the chinchilla; Enter brings in player two; Esc or P pauses.
- Two players: player one WASD, player two the arrows; Esc or P pauses.
- Pause: R starts the site again, Q goes back to the sites.
- Sites screen: the arrows or WASD pick a site, Enter opens it, 2 switches one or two players, Esc goes back.
- Results: Enter goes on (or back), R pours the site again.

Keyboard only; it is not made for phones.

## Files

- `lib/tambak-game.ts`: the rules, deterministic, plus the bot.
- `lib/tambak-scene.ts`: the sand renderer.
- `lib/tambak-art.ts`: generated frame boxes.
- `app/tambak/`: the page, its sounds and styles.
- `scripts/tambak-art.py`: the art pipeline.
- `tests/tambak.mjs`: engine tests; `tests/e2e/tambak.mjs`: the browser test.

The save is `tambak-v1` in `localStorage`: stars and best score per site, gentle tides, music, sound and who pours.
