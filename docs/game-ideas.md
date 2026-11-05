# Game ideas

Ideas for future games that haven't been built yet, newest first. Each comes with what Dora and Enzo do, because every game here needs a part for both of them. When one gets built, move it out of this file and into the README's games table and its own `docs/` file.

Painted mock-ups (Codex) are in [`ideas/`](ideas/). There is a page with all of them and their interfaces at https://claude.ai/artifact/4jSWyhexvhzJtC67u7UUzM (private to the owner).

## Roguelites (05-11-2026)

The arcade already has nine roguelites: Chin x Pit Classic (ball bouncing), Night Survivors (survivors-like), Hay Maze Defence (tower defence), Summit Shuffle (deck-building climb), Acorn Hand (poker scoring), Hay Bale Brawl (auto-battler), Chinchilla Trek (trek), Dust Bunny Dungeon (classic roguelike) and Lucky Pips (dice placement). Bounce / Burrow already has boon picks between rooms. These ideas use kinds of roguelite the arcade doesn't have yet. Gameplay mock-ups: `ideas/satchel-play.webp`, `ideas/burrow-play.webp`, `ideas/loop-play.webp`, `ideas/beat-play.webp`.

### Satchel Road (recommended)

A backpack-packing roguelite. Dora and Enzo walk a road of painted stops (meadow, market, haunted orchard, the Grumble King's hill) in runs of about 20 minutes. Everything they find has a shape, and it only works if it fits in Enzo's satchel grid: a lantern lights the things next to it, a honey pot makes the spoon beside it heal, three acorns in a row make a slingshot fire twice. Fights play out on their own from what's packed, so the game is in the packing: rotate, squeeze and give things up. New satchel shapes, a shop and a camp between stops.

- **Dora:** carries what's packed into the fights, and her climbing kit (rope, hook) opens shortcut stops on the map.
- **Enzo:** keeps the satchel. Between stops he can repack for free, and at camp he can stitch on an extra pocket.
- **Why:** inventory packing is new to the arcade, and every item is a painted cut-out, which suits the Codex art. Easy to play with a mouse or a finger.

### Burrow Keeper

Dig and defend. Enzo digs down through painted layers of soil, roots, old pipes and crystal caves for gems and relics until a bell rings; then Grumbles attack the burrow door and Dora holds them off with what the gems bought. Each run the layers and the relics are new; dig deeper to find the deep relics that change how the run plays (a mole friend who digs for you, a lantern that shows gems through rock).

- **Dora:** the defender at the door: aim the acorn catapult, mend the door, and set traps.
- **Enzo:** the digger, listening through his headphones for hollow rock and buried relics.
- **Why:** two halves with one player each makes it a strong two-player game on one keyboard; one player switches between them.

### Lantern Loop

A loop builder. Dora walks a lantern-lit loop on her own, round and round, fighting what she meets. You don't steer her: you play cards that become tiles along the path (meadows that heal, ponds that spawn frogs that drop loot, a haunted grove that spawns ghosts that drop better loot). The loop gets harder each lap; head home before the lantern runs out and keep what you carried, or push on for more.

- **Dora:** walks and fights on her own.
- **Enzo:** draws the map: he's the one playing the cards, and his notebook shows what the next lap will bring.
- **Why:** a calm way to play a roguelite (you plan, she fights), and the loop is a single painted board.

### Beat Burrow

A rhythm dungeon. Every step, swipe and swing happens on the beat of Enzo's music. Dora moves through a grid of painted burrow rooms one beat at a time, and every enemy moves on its own beat pattern, so learning a song is learning a fight. Each floor has its own song; relics change the rules (a metronome that slows a boss, a drum that hits everything on the downbeat).

- **Dora:** moves and fights on the beat.
- **Enzo:** is the band: pick his songs between floors, and the tempo changes how hard the floor is.
- **Why:** Enzo's headphones finally do something. Dust Disco is rhythm, but nothing mixes rhythm with a dungeon.

## After The Clocktower Mystery (05-11-2026)

Mock-ups: `ideas/lantern*.webp`, `ideas/jigsaw*.webp`, `ideas/snowglobe*.webp`, `ideas/bakery*.webp` (a painted scene, and a `-play` gameplay view each).

### Lantern Boats (recommended)

A calm night-time river puzzle seen from above. Paper lantern boats drift down a river and each must reach the dock of its own colour. You set up the river first, then press "Let them float" and watch. Stepping stones turn the current, sluice gates open and shut, a sleeping frog blocks a channel until a tune wakes him, and whirlpools spin boats round. About 30 hand-made levels in five stretches from the mill pond to the sea, with stars for every boat home, moves at or under par and fireflies caught. Every finished level sends lanterns up into a night sky that slowly fills.

- **Dora:** turns stepping stones, opens sluice gates and drops lily pads.
- **Enzo:** plays amber, rose and teal notes on a reed flute to recolour a boat; his tunes also wake the frog.
- **Build notes:** a deterministic current simulation, and a solver that proves each level solvable and finds par.

### Moonlit Jigsaw Museum

Paintings go missing from the town museum, one a night. On night watch, every jigsaw finished is a painting of the scene with a hidden clue in it. Five nights, then name who did it.

- **Dora:** builds the puzzles; her torch shows pieces hidden in the dark corners of the table.
- **Enzo:** zooms in on finished patches with his magnifying glass to find what's painted there, and keeps the clue book.

### Snowglobe Village

Build a tiny winter town inside a snow globe: cottages, a skating pond, a bakery, lamp posts. Townsfolk move in when the town has what they ask for. Shake the globe to change season. No way to fail.

- **Dora:** builds the tall things (towers, chimneys, the clock).
- **Enzo:** visits townsfolk to hear what they need next.

### Burrow Bakery Rush

Run a busy burrow bakery against the clock: knead, bake, fill and serve before the woodland customers' patience runs out. Each day adds a recipe or a twist (a second oven, a mole who only wants crusts, a power cut by candlelight).

- **Dora:** runs the oven and the mixing table.
- **Enzo:** takes orders, serves the counter and washes up.
- **Two players** share a keyboard, or one player switches with Tab.
