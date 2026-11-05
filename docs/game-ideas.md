# Game ideas

Ideas for future games that haven't been built yet, newest first. Each comes with what Dora and Enzo do, because every game here needs a part for both of them. When one gets built, move it out of this file and into the README's games table and its own `docs/` file.

Painted mock-ups (Codex) are in [`ideas/`](ideas/). There is a page with all of them and their interfaces at https://claude.ai/artifact/4jSWyhexvhzJtC67u7UUzM (private to the owner).

## Two unrelated systems (05-11-2026)

Pixel roguelites where two systems that don't normally meet drive each other: changing one is how you play the other. Gameplay mock-ups: `ideas/px-forms-play.webp`, `ideas/px-thyme-play.webp`, `ideas/px-words-play.webp`, `ideas/px-sight-play.webp`, `ideas/px-yarn-play.webp`. A separate set of fifteen strategy-first systemic roguelites, with scores and prototype plans, is in [`systemic-roguelites.md`](systemic-roguelites.md).

### Form & Function (bureaucracy × physics)

Nothing is physical until its form is stamped: unstamped crates and boulders float as weightless ghosts, and each stamp (heavy, light, sticky, solid) sets how the object behaves. Departments have their own rules ("two stamps for anything bigger than a cart"); contradictory forms make an object flicker; Grumble clerks slip fake forms into the tray, which become real if stamped.

- **Enzo:** stamps the forms.
- **Dora:** crosses the rooms built from whatever exists.

### Thyme Kitchen (cooking × time manipulation)

Dora's lantern ages everything in its light (dough rises, seedlings fruit, Grumbles grow old and slow) or, switched to slow light, holds falling things in the air. Recipes need exact ages, so cooking and fighting use the same tool, and ageing a Grumble also ages the food in your satchel. Lamp oil is scarce.

- **Dora:** carries the lantern.
- **Enzo:** cooks to the recipes and calls the ages.

### Wordwild (language × ecosystem)

Words are a living population in the villagers' speech: words used together breed, unused ones go extinct, and slang ("grr") preys on gentler words. What villagers can say decides what they can do (no word for "share", no trading). Get "peace" thriving in both villages before the Grumble King comes.

- **Enzo:** writes new words, which hatch from his notebook.
- **Dora:** carries words in jars between villages.

### Sightlines (architecture × social deduction)

One guest at the manor is a thief. Each night you add walls, doors and windows, and the layout decides who could see whom, so your floor plan creates the witness statements. The thief picks routes hidden from view, so every wall changes the crime.

- **Dora:** builds the rooms.
- **Enzo:** interviews the guests and checks their claims against the walls.

### Yarnwalk (movement × textile design)

Every step Dora takes unwinds Enzo's yarn, and he knits exactly that path into her gear: zigzags make speed, spirals spin, loops knots. The yarn is also in the world (it wraps posts to hold gates, ties up Grumbles, blocks your way back) and it's limited. Coloured yarn adds properties to the stitches.

- **Dora:** walks the route.
- **Enzo:** knits it.

## Top five pixel roguelites, cast (05-11-2026)

The five best-scoring concepts from a fifteen-idea brief for original pixel roguelites. Scores are weighted out of 10: originality 30%, replayability 25%, pixel-art appeal 15%, solo feasibility 15%, marketing 15%. Pixel Smith (8.40) is in the next section. Gameplay mock-ups: `ideas/px-frame-play.webp`, `ideas/px-down-play.webp`, `ideas/px-coin-play.webp`, `ideas/px-hour-play.webp`.

### Out of Frame (8.15): time only runs inside the camera

Dora walks forward on her own; you drag a fixed-size viewfinder, and only what's inside it moves. Everything outside freezes mid-action: arrows hang in the air as stepping stones, a Grumble stops mid-step, a boulder waits mid-roll. Anything crossing the frame's edge freezes there, so the border is a wall. About twenty generated screens a run; lenses persist (wide, fisheye, two frames).

- **Dora:** the adventurer who walks on her own.
- **Enzo:** the photographer; his viewfinder is the frame you control.

### Downsample (8.05): resolution is health, and collision follows it

Walls and hazards are checked against the image at its current resolution, so at low resolution thin spikes vanish and narrow gaps close. Dial the resolution down to cross a spike field and up to squeeze through a gap; every hit lowers the top resolution you can reach. Relics change the filter (sharpen, blur, crop part of the screen).

- **Dora:** moves.
- **Enzo:** turns the resolution dial.

### Coin of the Realm (7.90): you are the coin

At every hand-over you choose whose paw you land in next; that's the only control. A small town economy runs around you and your path decides who prospers. A run is the coin's life (until lost, melted or kept in a sock), with a goal such as funding the bridge.

- **Dora** and **Enzo** are the coin's two faces. Dora-side up, it travels far; Enzo-side up, it overhears its owner's plans, showing what each choice would lead to.

### Hourglass Keep (7.85): the sand is the clock and the ground

The keep is inside a giant hourglass; falling sand pours through the neck all the time, burying the lower rooms, and the glass is lost when the top bulb empties. Flipping turns everything over (Dora, sand and Grumbles) and brings the buried rooms back up, at a cost in sand. Sand types are the build: wet sand holds shape, glass sand cuts, magnetic sand follows you.

- **Dora:** runs, digs and collects the gems.
- **Enzo:** flips the hourglass from outside.

## Original pixel roguelites (05-11-2026)

Roguelites where something about pixel art itself is the mechanic, rather than a mash-up of existing genres. No released game is known to be built on any of these. Same pixel pipeline as the mash-ups below. Gameplay mock-ups: `ideas/px-smith-play.webp`, `ideas/px-faded-play.webp`, `ideas/px-fold-play.webp`, `ideas/px-double-play.webp`.

### Pixel Smith (pixels are the loot, the weapon and the health)

Draw your own weapon pixel by pixel on a 12×12 grid. Its shape is exactly its hitbox (a long thin spear reaches, a fat hammer covers) and its colours are its powers (gold cuts, blue freezes, red burns, green heals). Grumbles burst into loose pixels you collect as paint; every hit knocks pixels off Dora's own sprite, so a big weapon means less left to lose.

- **Dora:** fights with whatever was drawn.
- **Enzo:** draws at the easel between rooms, one pixel at a time, from what you collected.

### The Faded Picture (every pixel of a picture is a level)

The world map is one tiny faded picture, and every pixel is a whole room. The pixel's colour decides the room (blue is water, green forest, yellow sand, brown burrow, grey stone) and neighbouring colours mix in (blue next to green has reeds and frogs). Clearing a room brings its pixel's colour back; colour carries over between runs, so the picture returns run by run. A finished picture reveals a story scene and opens the next picture.

- **Dora:** plays the rooms.
- **Enzo:** peeks inside a pixel through his lens before you go in.

### Paperfold Burrow (a dungeon you fold)

The dungeon is drawn on a sheet of graph paper and you fold it. Folding lays one part of the map over another: corridors line up into shortcuts, walls stack, and stairs can be folded next to you. Overlapping rooms merge everything, so a room of Grumbles folded onto a spike trap meets the spikes. A few creases per floor; the back of the paper has its own rooms.

- **Dora:** walks the map.
- **Enzo:** folds it.

### Double Cartridge (one controller, two games)

The screen is split into two different games, and every input goes to both: Enzo in a platformer up top, Dora in a shooter below, where up is jump for him and climb for her. The halves feed each other: coins he grabs fall through as her ammo, Grumbles she shoots down land on his level as stepping stones, and a hit in either hurts both. Each world pairs two genres (platformer and shooter, maze and racer, puzzle and rhythm), and relics change how the two games are wired together.

- **Dora** and **Enzo** each star in one of the two games.

## Pixel-art roguelite mash-ups (05-11-2026)

The next roguelite should be pixel art. Pixel tilesets suit roguelites, because a run's rooms are rebuilt each time and tiles can be put together into any room. Codex draws the art in a 16-bit style; it's then cut down to the true low resolution (384×256) with a fixed palette (32 colours) and scaled up without smoothing, so the pixels are real. The interface uses a pixel font with square boxes. Gameplay mock-ups: `ideas/px-palette-play.webp`, `ideas/px-bomb-play.webp`, `ideas/px-sweep-play.webp`, and pixel versions of three mash-ups below: `ideas/px-castle-play.webp`, `ideas/px-conga-play.webp`, `ideas/px-push-play.webp`. Of the painted mash-ups below, Castle Crumble, Conga Caravan and Push Pals suit pixel art; Monster Stew and Gambit Burrow suit the painted style better.

### Palette Thief (platformer × colour puzzle × roguelite)

Colour is the resource. You can only stand on blocks of your own colour; every other colour is a ghost you fall through. Paint orbs recolour you, and Smudges (red Grumbles with paintbrush tails) steal your colour if they touch you. Each run is a climb through sky-temple rooms built from tiles; relics give each colour a power (double jump while red, float while yellow).

- **Dora:** runs, jumps and dashes.
- **Enzo:** holds a three-colour palette and can swap which colour Dora is, even mid-jump.
- **Why:** the palette swap, the oldest pixel-art trick, is the mechanic.

### Acorn Blast (bomb maze × dungeon roguelite)

Twelve floors of grid dungeon: stone pillars, breakable crates and hay, Grumbles roaming the gaps, and a ladder down that opens once they're gone. Drop acorn bombs that blast in a cross. Relics change the blast (longer flames, rolling acorns, blasts through crates, a second acorn at once); crates drop them and a shop sits every third floor. Your own blasts hurt you.

- **Dora** and **Enzo** each drop acorns: two players on one keyboard, or one player while the other follows.

### Sweeper's Burrow (minesweeper × RPG levelling × roguelite)

Every covered tile might hide a monster, and an uncovered tile's number is the total level of the monsters around it. Uncover one weaker than you and you beat it for XP; uncover one stronger and it hurts. Each floor is a puzzle about which monsters to beat first so you grow strong enough for the crowned Grumble, who holds the key down. Hearts, coins and keys lie under some tiles.

- **Dora:** uncovers tiles and fights.
- **Enzo:** his lantern peeks under nearby tiles a few times a floor, and he keeps the flags.

## Roguelite mash-ups (05-11-2026)

Roguelites crossed with genres that roguelites rarely use, avoiding the nine the arcade has and the four roguelites below. Gameplay mock-ups: `ideas/stew-play.webp`, `ideas/castle-play.webp`, `ideas/conga-play.webp`, `ideas/gambit-play.webp`, `ideas/push-play.webp`.

### Monster Stew (dungeon crawler × cooking)

Fight through floors of a mossy cave of cute monsters; everything you beat drops an ingredient. Between floors, cook: four ingredients in the pot make the stew you eat, and the stew is your build for the next floor (chilli makes your hits burn, jelly makes you bounce off walls, a glowing mushroom lights the dark). Ingredients combine into flavours, and a good combination is worth more than its parts. Recipes you discover stay in the cookbook for every run after.

- **Dora:** forages and fights with her ladle.
- **Enzo:** cooks: picks what goes in the pot, and tastes it to say what it'll do.

### Castle Crumble (falling-block builder × siege defence)

By day, shaped stone blocks fall and you build your castle with them, block by block; special blocks have a catapult, an acorn launcher, a flag tower or ivy that mends. By night the Grumbles attack whatever you built: gaps let them in, high walls hold them, and blocks they knock out are gone. Relics change the blocks (blocks that grow, blocks that float). Survive ten nights.

- **Dora:** guides the falling blocks into place.
- **Enzo:** mans the catapult at night.

### Conga Caravan (snake × party builder)

Your party is a conga line. Dora leads, everyone you recruit joins the end, and Enzo is always last, keeping the beat on his drum. Each friend acts on their own (the hedgehog shields, the rabbit shoots, the frog blows slowing bubbles), and where they are in the line matters: shields near the front, shooters in the middle, healers by the drum. Cross your own line and it splits, and the cut-off friends wander away until you pick them up again.

- **Dora:** steers the head of the line.
- **Enzo:** sets the tempo at the tail; a faster beat means faster attacks and a harder line to steer.

### Gambit Burrow (chess × roguelite)

Every board is a little chess puzzle against the Grumbles. Dora jumps like a knight, Enzo slides like a bishop, hedgehogs step and spear like pawns. Protect the lantern (your king) and capture the Grumble with the crown. Win a board, then pick a new piece or a rule-changing relic (hedgehogs promote on any edge, Dora jumps twice after a capture). Ten boards to the Grumble King's court; the enemies move in plain patterns, so every turn is solvable.

- **Dora** and **Enzo** are pieces on the board, with their own moves.

### Push Pals (block-pushing puzzle × roguelite)

A run of fifteen procedurally made push-block puzzle rooms: get crates onto the plates to open the gate. Dora can only push and Enzo can only pull, so you switch between them to solve each room. Ice slides things all the way, boulders roll, and sleepy Grumbles can be pushed too (but wake up cross). Between rooms, pick relics that change the rules (crates that stick together, one free pull through a wall), and undos are your health.

- **Dora:** pushes.
- **Enzo:** pulls with a rope.

## Genre mash-ups (05-11-2026)

Genres that don't usually meet. Gameplay mock-ups: `ideas/seedsong-play.webp`, `ideas/shellback-play.webp`, `ideas/teaparty-play.webp`, `ideas/dig-play.webp`, `ideas/cloud-play.webp`.

### Seedsong (farming × music sequencer)

The garden is the song. The bed is a grid: each row is a note, each kind of plant an instrument (bellflowers chime, trumpet flowers toot, beans click, tomatoes pop, pumpkins boom), and a firefly sweeps across the columns playing whatever is growing. Plants grow over the days, so a seedling plays softly and a ripe pumpkin booms. Bees, birds and neighbours ask for songs (a lullaby, a wedding tune, a march for the fair) and pay in seeds for new instruments. Harvest changes the song; so do seasons, frost and slugs.

- **Dora:** plants, waters, prunes and harvests.
- **Enzo:** listens to what's asked for, hums it back, and tells you which notes are wrong.
- **Why:** a farming game where the crops are music; a free-play mode is a toy that makes tunes.

### Shellback (town builder × journey × balance)

Your village is on the shell of Old Moss, a giant tortoise walking across the world. Build cottages, a windmill, gardens and towers on the shell plates, but the shell tilts with the weight, and things slide if you build lopsided. Old Moss walks on through meadows, marshes, snow and the sea shore, stopping at camps where travellers trade or ask to move in. Choose the route: the shorter path is steeper.

- **Dora:** builds up high: towers, rope bridges, anything on the steep parts of the shell.
- **Enzo:** rides on Old Moss's head with the map and the reins, and talks to the travellers.
- **Why:** a city builder where the city moves and balances.

### Haunted Tea Party (logic puzzle × cosy hosting × ghost story)

Each night the manor's ghosts come to tea. Every ghost has likes and grudges (the captain won't sit by the window, the cat must sit next to someone who drops crumbs), so seating them is a logic puzzle; then serve each the tea and cake they love. Happy ghosts tell a piece of the manor's story and some can move on at the end of the night. New ghosts arrive with harder rules.

- **Dora:** sets the table, seats the guests and serves.
- **Enzo:** is the only one who can hear the ghosts' whispers, which are the clues.
- **Why:** a logic grid puzzle dressed as a dinner party, with a story told one ghost at a time.

### Dig & Display (digging by clues × fragment jigsaw × museum tycoon)

Dig a site square by square: a dug square shows how many finds are buried next to it, so you dig the right squares and brush gently near finds (dig too hard and you crack them). Take the fragments back and fit them together into vases, mosaics and fossil skeletons. Put them on show in the town museum; visitors pay, and the money opens new dig sites.

- **Dora:** digs and brushes at the site.
- **Enzo:** restores the finds and lays out the museum.
- **Why:** three relaxing puzzles that feed each other.

### Cloud Shepherd (sheepdog trial × weather gardening)

The clouds are a flock. Dora flies her little red biplane like a sheepdog, herding fluffy cloud sheep across the sky by flying round them, and parks them over thirsty fields to rain. Keep them away from the grumpy thundercloud (it turns sheep stormy) and away from the hot sun (they shrink). Each day the farms want rain in different places; stars for watering every field before evening.

- **Dora:** flies the biplane; clouds drift away from her.
- **Enzo:** stands on the hill and whistles commands that every cloud hears (stop, gather, rain).
- **Why:** herding is rare in games, and Dora is an aviator.

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
