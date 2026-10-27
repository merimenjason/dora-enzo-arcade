# Burrow Command art brief

Date: 27-10-2026

Burrow Command (`/command`) is a real-time strategy game seen from above at a slight 3/4 angle (camera tilted about 30° from straight down, so you see the tops of things and a little of their front faces). Three sides meet on a painted meadow map: **the Burrow Colony** (chinchillas, led by Dora and Enzo), **the Ringtail Guild** (scrappy, friendly raccoons) and **the Clockwork Hive** (wind-up mechanical beetles with brass keys in their backs). Nobody is ever hurt: beaten units are "poofed" home in a cloud of dust, dizzy.

The game loads every image below from `public/art/command/` and draws a Canvas fallback until (or if never) an image arrives, so each file can be painted and dropped in on its own. **71 images.**

## Shared style (use in every prompt)

Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Chibi proportions: big heads, big glossy eyes with two highlights, stubby limbs. Chinchillas have huge round dish ears, a soft round body and a single continuous bushy tail. **Dora** is cream-white with pink ears and ruby eyes; **Enzo** is grey with a pale chest and black eyes. Raccoons are plump and cheerful with a grey coat, a black eye mask, a ringed tail and little paws. Clockwork beetles are rounded toy-like beetles with lacquered shells, brass legs, rivets, small round glass eyes and a brass wind-up key sticking out of the back; they look like cute antique toys, not insects to be afraid of. **No text, letters, numbers, logos, watermarks, borders or frames in any image.**

**Team colours are added by the game** (a coloured ring under each unit and a little pennant on each building), so paint units and buildings without any red or blue team markings; keep their own palette as described.

## Sprite rules

- **Units**: transparent background (PNG-style alpha, saved as WebP with alpha), the figure centred, feet or base on the lower third, about 15% empty margin all round. **Every unit faces to the right** (3/4 view from above-right: we see the top of the head and back, the face in right-facing three-quarter profile); the game mirrors them to face left. One pose per unit, standing ready and alert; the game adds bobbing, squash and stretch. No ground shadow (the game draws one), no ground patch.
- **Buildings**: transparent background, seen from the same 3/4 angle: the building's ground footprint is a rectangle filling the lower ~70% of the image width, front wall visible, roof and chimneys may rise into the top. Centred, no ground patch beyond a thin ring of trodden earth at the very base, no shadow, no characters.
- **Resource nodes and decals**: transparent background, same angle, no shadow.
- **Terrain textures**: opaque and **seamless** (tiles left-right and top-bottom), straight top-down, flat even lighting, no strong features that would repeat visibly.
- **Paintings** (title, briefing backdrops): opaque, full-bleed.
- **Portraits**: opaque, square, head and shoulders, softly blurred warm background.
- **Command icons**: transparent background, one bold simple painted object centred, readable at 40×40 px.

## Units (22), 256×256, transparent

### Burrow Colony (chinchillas)

| File | Description |
| --- | --- |
| `unit-colony-gatherer.webp` | **Hay Gatherer**: a small sandy-beige chinchilla with a woven straw basket on its back heaped with golden hay, a little straw hat, carrying a wooden hay fork. Cheerful worker. |
| `unit-colony-slinger.webp` | **Pebble Slinger**: a light-grey chinchilla with a leather sling whirling a smooth round pebble above its head, a pouch of pebbles on a belt, a green leaf headband. |
| `unit-colony-fluffguard.webp` | **Fluffguard**: a big, extra-fluffy dark-grey chinchilla in a padded quilted jacket, holding a round wicker shield and a soft hay-stuffed mallet; sturdy and protective. |
| `unit-colony-puffer.webp` | **Dust Puffer**: a pale-lilac-grey chinchilla holding a large wooden bellows that puffs a little cloud of sparkly sandy dust, wearing round goggles pushed up on its head. |
| `unit-colony-glider.webp` | **Glider**: a light-grey chinchilla gliding in mid-air under a leaf-and-twig hang glider (a big maple leaf stretched over a twig frame), ears blown back, scarf trailing, seen from above-right. Leave clear space below (it flies; the game draws its shadow on the ground). |
| `unit-colony-digger.webp` | **Burrow Digger**: a stocky brown-grey chinchilla in a miner's helmet with a candle lamp, pushing a big wooden wheelbarrow-drill (a hand-cranked wooden auger on two wheels). Siege unit. |
| `unit-colony-dora.webp` | **Dora (hero)**: Dora, cream-white with pink ears and ruby eyes, a little red-gold cape and a flower crown, holding a twig staff topped with a glowing golden seed. Brave and kind. |
| `unit-colony-enzo.webp` | **Enzo (hero)**: Enzo, grey with a pale chest and black eyes, a blue neckerchief and a small round acorn-cap helmet, holding a big round seed-pod shield. Steady and loyal. |

### Ringtail Guild (raccoons)

| File | Description |
| --- | --- |
| `unit-guild-tinkerer.webp` | **Tinkerer**: a small raccoon in patched overalls with a tool belt (spanner, string, a spoon), a sack of odds and ends over one shoulder. Worker. |
| `unit-guild-scrapper.webp` | **Scrapper**: a scrappy lean raccoon with a dented saucepan for a helmet, waving a wooden spoon, a cork-and-string sash; fast and cheeky. |
| `unit-guild-tosser.webp` | **Lid Tosser**: a raccoon about to throw a shiny tin bin lid like a frisbee, a stack of lids under the other arm, a striped knitted hat. |
| `unit-guild-trapper.webp` | **Trapsetter**: a raccoon with a coil of rope, a sticky honey pot and a spring-loaded net on its back, a miner's head-torch, sneaky grin. |
| `unit-guild-kite.webp` | **Kite Rider**: a raccoon riding a patchwork kite made of mismatched cloth scraps and newspaper-coloured paper (no lettering), ringed tail streaming behind, seen from above-right in flight. Leave clear space below. |
| `unit-guild-cart.webp` | **Junk Cart**: a wobbly wooden cart on four mismatched wheels (one is a bottle cap) with a spoon catapult on top loaded with a squashy apple core, pushed by a small raccoon. Siege unit. |
| `unit-guild-marlo.webp` | **Marlo (hero)**: the Guild's leader, a big, warm, round raccoon with a patched purple waistcoat, a tiny top hat made from a tin can, a monocle made from a bottle bottom, a walking stick made from a bent fork. Grand but friendly. |

### Clockwork Hive (wind-up beetles)

| File | Description |
| --- | --- |
| `unit-hive-sorter.webp` | **Sorter Beetle**: a small round copper beetle with two little brass arms holding a basket, a brass wind-up key in its back. Worker. |
| `unit-hive-clicker.webp` | **Click Beetle**: a small, quick, glossy teal beetle with springy brass legs, a little brass horn on its nose, wind-up key in its back. Cheap swarm unit. |
| `unit-hive-squirt.webp` | **Squirt Beetle**: a plum-coloured beetle with a brass nozzle on its head spraying a little arc of shiny oil droplets, wind-up key in its back. Ranged. |
| `unit-hive-shellback.webp` | **Shellback**: a big, chunky beetle with a thick domed jade-green shell plated with brass bands and rivets, short sturdy legs, wind-up key in its back. Tank. |
| `unit-hive-buzzer.webp` | **Buzz Beetle**: a flying beetle with its amber shell open and two clear glassy clockwork wings whirring, wind-up key, seen from above-right in flight. Leave clear space below. |
| `unit-hive-rammer.webp` | **Ram Beetle**: a long rhinoceros-style beetle with a big polished brass battering horn and a wind-up key, built low and heavy. Siege unit. |
| `unit-hive-queen.webp` | **Queen Beetle**: a large regal beetle with an iridescent violet-and-gold shell, a little brass crown, gentle wise glass eyes, a big ornate wind-up key in her back with a golden ribbon. Graceful, motherly. |

Note: use **384×384** for `unit-hive-queen.webp` and **256×256** for every other unit.

## Buildings (24), transparent

Sizes: footprint 2×2 tiles → **384×384**; 3×3 tiles → **512×512**.

### Burrow Colony

| File | Size | Description |
| --- | --- | --- |
| `bld-colony-burrow.webp` | 512 | **Great Burrow** (HQ): a big grassy mound with a round wooden door, round windows with warm light, a hay-thatched porch, a little flag pole without a flag, root arches and flowers. |
| `bld-colony-hut.webp` | 384 | **Hay Hut** (house): a small round hut thatched with golden hay, a round door, a lantern. |
| `bld-colony-pit.webp` | 512 | **Pebble Pit** (training ground): a sandy practice pit ringed by stones, a rack of slings, a straw target dummy, a wooden lean-to. |
| `bld-colony-bath.webp` | 384 | **Dust Bath** (heals): a shallow round stone basin full of fine sparkling pale sand, a little rising puff of dust, a towel on a twig rail. |
| `bld-colony-mound.webp` | 384 | **Tunnel Mound**: a dome of earth with a big round tunnel mouth framed in wooden beams, a lantern hanging by it. |
| `bld-colony-perch.webp` | 512 | **Glider Perch**: a tall wooden lookout platform built round a tree stump with a launch ramp of twigs, spare leaf gliders hanging on pegs. |
| `bld-colony-den.webp` | 512 | **Digger's Den** (workshop): a timber workshop dug half into a bank, a big wooden auger leaning outside, bellows hanging up, a sawhorse. |
| `bld-colony-stump.webp` | 384 | **Watch Stump** (tower): a hollow tree stump made into a little watchtower with a lookout platform and a pebble pile on top. |
| `bld-colony-library.webp` | 384 | **Seed Library** (upgrades): a cosy round shed lined with shelves of seed jars and acorns, a sunflower beside the door. |

### Ringtail Guild

| File | Size | Description |
| --- | --- | --- |
| `bld-guild-bin.webp` | 512 | **Big Bin** (HQ): a huge friendly dented metal bin turned into a house, a round porthole window, a door cut in the side, bunting made of bottle caps, a tin-can chimney. |
| `bld-guild-stash.webp` | 384 | **Stash Den** (house): a cosy den built from an upturned crate and a teapot, patched with cloth, a string of buttons. |
| `bld-guild-yard.webp` | 512 | **Scrap Yard** (barracks): a fenced yard of neat junk piles (spoons, lids, corks), a hand-made archway of bent cutlery, a workbench. |
| `bld-guild-workshop.webp` | 512 | **Rolling Workshop**: a little wooden workshop shed built on a wagon with four big mismatched wheels, a tin chimney puffing, tools hanging off the side, a towing shaft at the front pointing right. It drives around, so it must look like it can roll. |
| `bld-guild-loft.webp` | 512 | **Kite Loft**: a tall rickety tower of crates with patchwork kites tied to the top and a reel of string. |
| `bld-guild-lantern.webp` | 384 | **Lantern Post** (tower): a tall pole of stacked tin cans topped with a bright lantern and a basket of bin lids to throw. |
| `bld-guild-bench.webp` | 384 | **Tinker Bench** (upgrades): a messy workbench under a patched awning, a vice, cogs, bottles, a desk lamp made from a spoon. |

### Clockwork Hive

| File | Size | Description |
| --- | --- | --- |
| `bld-hive-core.webp` | 512 | **Hive Core** (HQ): a big domed brass-and-copper hive like an antique music box, with honeycomb windows glowing amber, a giant wind-up key slowly turning on top, little cogs visible. |
| `bld-hive-cell.webp` | 384 | **Cog Cell** (house): a small hexagonal copper pod with a round glass hatch and a cog on top. |
| `bld-hive-spring.webp` | 384 | **Spring Tower**: a slim brass tower with a huge coiled spring spiralling up it and a glowing teal gem at the top, little sparks of winding energy. |
| `bld-hive-brood.webp` | 512 | **Brood Works** (barracks): a brass workshop shaped like a half-beetle shell, an assembly cradle with half-built toy beetle shells, gear wheels. |
| `bld-hive-forge.webp` | 512 | **Gear Forge**: a heavy riveted brass forge with a warm glowing furnace mouth, big gears on the side, a short chimney. |
| `bld-hive-nest.webp` | 512 | **Buzz Nest**: a round open-topped brass nest like a birdcage dome with landing perches and glassy wings drying on a rack. |
| `bld-hive-coil.webp` | 384 | **Spark Coil** (tower): a copper coil tower with a glass bulb on top crackling with soft friendly blue sparks. |
| `bld-hive-hall.webp` | 384 | **Winding Hall** (upgrades): a small octagonal clockwork pavilion with a clock face without numbers or hands on its front, ticking gears behind glass. |

## Resource nodes (2), transparent, 384×384

| File | Description |
| --- | --- |
| `res-hay.webp` | **Hay meadow**: a lush patch of tall golden-green meadow grass with a few loose bundles of cut hay and clover flowers, about as wide as the image, roughly round. |
| `res-glimmer.webp` | **Glimmer deposit**: a cluster of smooth grey boulders with glowing pale-turquoise and pink crystals growing out of them, faint sparkles. |

## Terrain (6)

| File | Size | Alpha | Description |
| --- | --- | --- | --- |
| `tex-grass.webp` | 512×512 | opaque, seamless | Soft meadow grass seen from straight above: varied greens, tiny flowers and clover, no paths or objects. |
| `tex-dirt.webp` | 512×512 | opaque, seamless | Warm trodden earth with tiny pebbles and a few straw strands, for building pads and paths. |
| `tex-water.webp` | 512×512 | opaque, seamless | Clear calm pond water from above, teal-blue with soft ripples and light glints. |
| `deco-tree.webp` | 384×384 | transparent | A round leafy oak tree seen from above at 3/4: a big puffy canopy, a short trunk visible at the bottom. |
| `deco-bush.webp` | 256×256 | transparent | A round berry bush with a few red berries. |
| `deco-boulder.webp` | 256×256 | transparent | A mossy grey boulder with a smaller stone beside it. |

## Effects (1), transparent

| File | Size | Description |
| --- | --- | --- |
| `fx-trap.webp` | 256×256 | A Ringtail snare on the ground: a loop of rope round a small open honey pot, a bent twig spring, a couple of autumn leaves to hide it. Seen from above. |

## Portraits (4), opaque, 512×512

| File | Description |
| --- | --- |
| `portrait-dora.webp` | Dora, cream-white with pink ears and ruby eyes, flower crown and red-gold cape, a determined happy smile, warm meadow-green background. |
| `portrait-enzo.webp` | Enzo, grey with a pale chest and black eyes, blue neckerchief and acorn-cap helmet, calm and steady smile, warm sky-blue background. |
| `portrait-marlo.webp` | Marlo the raccoon leader, tin-can top hat, bottle-bottom monocle, purple patched waistcoat, a sly but kindly grin, warm lantern-lit junkyard background. |
| `portrait-queen.webp` | The Queen Beetle, iridescent violet-and-gold shell, little brass crown, gentle glass eyes, ornate key with a golden ribbon, warm amber clockwork background. |

## Paintings (6), opaque

| File | Size | Description |
| --- | --- | --- |
| `title.webp` | 1600×1000 | Title painting: a sunny meadow valley from above at a gentle angle; on the left Dora and Enzo stand on the Great Burrow mound pointing ahead, a few Hay Gatherers and Pebble Slingers around them; in the middle distance a cheerful raccoon junk camp with kites; on the right a brass clockwork hive among trees with little beetles. Everyone looks curious, nobody fights. Keep the top-centre calmer (soft sky) for the game's title text. |
| `brief-meadow.webp` | 1600×900 | Briefing backdrop: the Burrow Colony's home meadow at golden morning: grassy mounds with round doors, hay fields, a stream. No characters. |
| `brief-junkyard.webp` | 1600×900 | Briefing backdrop: the Ringtail Guild's camp at dusk: tidy junk piles, bunting of bottle caps, kites, lanterns, a rolling workshop wagon. No characters. |
| `brief-clockwood.webp` | 1600×900 | Briefing backdrop: a mossy forest with brass clockwork everywhere among the roots: spring towers with glowing teal gems, cogs half-sunk in moss, soft light beams. Mysterious but gentle, not dark. No characters. |
| `brief-glimmer.webp` | 1600×900 | Briefing backdrop: a wide rocky valley full of glowing turquoise and pink glimmer crystals under a lilac twilight sky. No characters. |
| `brief-festival.webp` | 1600×900 | Briefing backdrop: a festival meadow at sunset set for a shared party: long tables of hay and berries, raccoon bunting and kites, brass beetle lanterns glowing, a chinchilla burrow decorated with flowers. No characters. |

## Command icons (6), transparent, 128×128

| File | Description |
| --- | --- |
| `icon-move.webp` | A small round wooden signpost arrow pointing right on a pebble. |
| `icon-stop.webp` | A round wooden shield-like paw-print sign held up flat (a "stop" paw), warm red-brown. |
| `icon-hold.webp` | A little wooden stake driven into a tuft of grass with a rope loop round it. |
| `icon-patrol.webp` | Two curved twig arrows chasing each other in a circle. |
| `icon-attack.webp` | A round pebble flying with a little whoosh trail and a yellow star spark. |
| `icon-build.webp` | A wooden mallet crossed with a small hay-thatch bundle. |

## Checklist

22 units + 24 buildings + 2 resources + 6 terrain + 1 effect + 4 portraits + 6 paintings + 6 icons = **71 images**, all under `public/art/command/`, all `.webp`.
