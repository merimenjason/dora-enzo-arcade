# Snapshot Safari art brief

Date: 27-10-2026

Every image Snapshot Safari loads, all under `public/art/safari/`, all WebP. Until an image loads (or if it never does) the game draws its own Canvas version, so these can arrive one at a time. 31 images in all.

**Style for all of them:** warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, the same look as the other painted arcade games (see `public/art/roll/title.webp` and `public/art/disco/`). Creatures are inspired by real Andean wildlife, true to their colours and shapes, but friendly and rounded, never scary. **Dora** is cream-white with pink ears you can almost see through, ruby eyes and a white plume of a tail; **Enzo** is grey with a darker wavy back, a pale chest and face, and black eyes. **No text, letters, logos or borders in any image.**

## Title (1)

| File | Size | Background | Description |
| --- | --- | --- | --- |
| `title.webp` | 1600×1000 | opaque | Dora and Enzo crouched side by side in golden puna grass at sunrise, peeking over the grass tops. Dora holds a little brown leather camera up to her eye; Enzo points ahead, whiskers forward, delighted. In the soft middle distance a vicuña family grazes and a viscacha sits on a warm rock; an Andean condor glides high against a peach sky; snowy volcano peaks behind. Keep the lower third calm and darker (a title sits over it); the chinchillas on the right half. |

## Far landscapes (4)

Drawn behind the trail and tiled side by side as the camera scrolls, so **the left and right edges must join seamlessly**. Transparent sky: only the distant land is painted, filling roughly the lower 60% of the image, so the game's own sky (morning, noon or dusk, with its sun and clouds) shows above. The bottom 6% sits behind the ground line and can be plain. Painted in neutral daylight: the game tints it for dawn and dusk. No animals or people.

| File | Size | Background | Description |
| --- | --- | --- | --- |
| `far-puna.webp` | 2400×800 | transparent above the skyline | The high Andean plateau: two or three snow-capped volcano cones in soft blue-violet distance, rolling golden-ochre hills in front of them, a faint line of a shining lake. |
| `far-forest.webp` | 2400×800 | transparent above the skyline | Misty cloud-forest ridges: layered deep-green slopes fading into white mist, rounded tree crowns on the nearest ridge, a thin waterfall. |
| `far-salar.webp` | 2400×800 | transparent above the skyline | Red, rust and lilac striped mountains along a flat horizon, the white salt flat meeting them in a soft shimmer, a pale pink lagoon edge. |
| `far-cliffs.webp` | 2400×800 | transparent above the skyline | Tall warm-grey and ochre canyon cliffs with ledges and pillars, a deep blue valley between them, small green shrubs clinging on. |

## Creatures (24)

One horizontal sheet per creature, **one 256×256 frame per behaviour, left to right in the order listed**, transparent background. In every frame the creature faces **right**, is horizontally centred, and stands (or sits, swims or hovers) with its feet or lowest point on the line **8 px above the bottom edge**; it is scaled so its larger dimension (the pose's width or height) spans about **240 px**. Flying poses: the bird's lowest point still near the bottom line, wings spread wide. The game gently bobs, squashes and tilts the frames, so keep poses clear and readable at small sizes. Its head is turned a little toward the viewer (three-quarter view) unless a pose says otherwise. No ground, rocks or branches: the game draws those (the bear's short trunk piece is the one exception).

| File | Size | Frames, left to right |
| --- | --- | --- |
| `creature-vicuna.webp` | 1024×256 | 1 Grazing: slim cinnamon-tan wild camelid with a white bib and belly, head down nibbling grass. 2 Trotting together: mid-trot, legs lifted, neck forward. 3 Dust bath: lying on its side rolling, legs in the air, a little puff of dust. 4 Sentry call: standing very tall and alert, ears up, neck stretched, mouth open in a call. |
| `creature-llama.webp` | 1024×256 | 1 Chewing: cream llama with soft brown patches and long banana ears, standing, jaw mid-chew. 2 Curious stare: head high and turned to face the viewer, ears forward, big curious eyes. 3 Berry snack: head down eating purple berries from the ground. 4 Humming with a cria: standing beside a tiny fluffy baby llama (the cria at its front legs), both content, eyes half closed. |
| `creature-alpaca.webp` | 1024×256 | 1 Munching: very fluffy cream alpaca with a pom-pom topknot, head down grazing. 2 Fluffy shake: shaking itself, wool flying out in a fuzzy blur. 3 Cosy huddle: lying down legs tucked, a round fluffy loaf. 4 Pronking: springing into the air with all four legs straight, joyful. |
| `creature-flamingo.webp` | 1024×256 | 1 Filter feeding: pink Andean flamingo standing in shallow water, head upside down in the water. 2 Standing on one leg: one leg tucked, neck curled, head resting on its back. 3 Flamingo dance: marching, neck stretched up, head flagging, wings half open showing black and crimson. 4 Taking flight: running take-off, wings wide (crimson and black), neck straight forward, legs trailing. |
| `creature-condor.webp` | 1024×256 | 1 Perched on a ledge: big black Andean condor with a white neck ruff and bald pinkish head, standing upright. 2 Sunning its wings: standing with its huge wings held open wide, white wing patches showing. 3 Soaring: in flight seen from the side and a little below, wings flat and enormous, fingered wingtips. 4 Gliding past the sun: the same soaring pose with wings slightly raised, a warm golden rim light on the feathers. |
| `creature-hummingbird.webp` | 1024×256 | 1 Hovering: a giant hummingbird (olive-green and buff, long straight bill), wings a blur, hovering. 2 Sipping nectar: hovering with its bill in a red tubular flower. 3 Resting on a twig: perched on a short mossy twig, wings folded, head turned to the viewer. 4 Courtship dive: diving steeply, wings swept back, tail fanned. |
| `creature-fox.webp` | 1024×256 | 1 Trotting: Andean fox (culpeo), rusty-orange with grey back, pale throat and a bushy tail, mid-trot. 2 Sniffing the air: standing, nose raised, ears up. 3 Mouse pounce: leaping in a high arc, front paws down, aiming at the grass. 4 Head tilt: sitting and tilting its head at the viewer, one ear cocked, puzzled and cute. |
| `creature-bear.webp` | 1024×256 | 1 Munching bromeliads: spectacled bear, shaggy black with cream "spectacle" markings around the eyes, sitting and chewing a spiky bromeliad. 2 Climbing a tree: upright against a short trunk section, claws hooked in, looking back (include just the trunk piece). 3 Berry feast: sitting back on its bottom with a paw full of berries at its mouth, happy face to the viewer. 4 Cub tumble: a small round cub rolling head over heels on its back, paws up (only the cub in this frame). |
| `creature-cavy.webp` | 1024×256 | 1 Nibbling clover: small brown wild guinea pig, no tail, nibbling a clover leaf. 2 Peeking from the grass: sitting up a little, looking straight at the viewer. 3 Popcorning: leaping straight up with a happy twist, all four feet off the ground. 4 Sharing berries: crouched over two purple berries, cheeks full. |
| `creature-torrent.webp` | 768×256 | 1 Preening on a rock: torrent duck (white head with bold black stripes, red bill) standing, preening its back. 2 Diving: tail up, head under rushing water, splash. 3 Riding the rapids: swimming upstream through white foam, body low, determined. |
| `creature-coot.webp` | 768×256 | 1 Paddling: big dark giant coot with a red and yellow bill and shield, swimming. 2 Building its nest: on a floating heap of green waterweed, carrying a strand. 3 Feeding a chick: on its nest feeding a fluffy black chick with a red head. |
| `creature-cat.webp` | 768×256 | 1 Watching from the rocks: Andean cat, pale silvery-grey with rusty spots and a thick tail with dark rings, sitting up neatly, facing the viewer. 2 Grooming: sitting, licking a raised paw. 3 Prowling: low stalking walk, tail out straight and heavy. |
| `creature-tinamou.webp` | 768×256 | 1 Pecking seeds: round speckled buff-and-brown puna tinamou, small head, pecking the ground. 2 Freezing still: crouched round and motionless, eye on the viewer. 3 Whistling back: head raised, bill open, singing. |
| `creature-caracara.webp` | 768×256 | 1 Strutting: mountain caracara, black and white with a bare orange face and yellow legs, walking boldly. 2 Turning stones: flipping a pebble with its bill. 3 Head-back call: head thrown right back, bill open to the sky. |
| `creature-goose.webp` | 768×256 | 1 Grazing the shore: snow-white Andean goose with black wings and a small pink bill, head down to the grass. 2 Honking parade: neck stretched up, honking, mid-step. 3 Preening: neck curled back to its wing. |
| `creature-rhea.webp` | 768×256 | 1 Striding: puna rhea, a tall grey-brown flightless bird with a long neck, mid-stride. 2 Pecking: neck down to the ground. 3 Wing display: wings held out and fluffed like a big feather skirt. |
| `creature-lapwing.webp` | 768×256 | 1 Wading: Andean lapwing, grey-brown with white belly, black breast band and pink legs, walking. 2 Calling out: head up, bill open. 3 Wing flash: wings raised high over its back showing bold black and white patches. |
| `creature-taruca.webp` | 768×256 | 1 Browsing: stocky grey-brown taruca deer with big ears and a dark face mask, nibbling a shrub. 2 Ears up: alert, looking at the viewer, ears wide. 3 Leaping: bounding over a rock, all legs tucked. |
| `creature-viscacha.webp` | 1024×256 | 1 Nibbling: mountain viscacha, soft grey-tan with long rabbit-like ears and a long curly black-tipped tail, sitting nibbling. 2 Washing its face: sitting up, paws rubbing its face. 3 Sunbathing: stretched out flat on the warm rock, eyes shut, blissful. 4 Standing tall: up on its hind legs, very upright, ears high. |
| `creature-chinchilla.webp` | 768×256 | 1 Nibbling a seed: a wild short-tailed chinchilla, blue-grey with a white belly, huge round ears and a bushy tail, holding a seed in its front paws (cousins of Dora and Enzo, but plainly grey and wild). 2 Peeking out: sitting up, looking right at the viewer, ears wide. 3 Dust bath: rolling on its back in a puff of pale volcanic dust. |
| `creature-rooster.webp` | 768×256 | 1 Perched: Andean cock-of-the-rock, blazing orange with a big half-disc crest and black wings, perched, feet gripping as if on a branch. 2 Hopping branches: mid-hop with wings half open. 3 Lek dance: bowing low with crest forward, wings flicked out, showing off. |
| `creature-ibis.webp` | 768×256 | 1 Probing the mud: glossy bronze-purple puna ibis with a long down-curved bill, bill in the mud. 2 Preening: neck turned back into its wing. 3 Flying in a line: in flight, neck straight, bill forward, wings down-stroke. |
| `creature-toucan.webp` | 768×256 | 1 Perched in the mist: grey-breasted mountain toucan (misty blue-grey, dark cap, yellow rump, painted yellow-red-black bill) perched, feet gripping as if on a branch. 2 Berry toss: tossing a berry up and catching it, head tipped back. 3 Yelping call: bill open wide, calling. |
| `creature-tapir.webp` | 768×256 | 1 Browsing leaves: woolly dark-brown mountain tapir with a short wiggly trunk and white lip edges, reaching for leaves. 2 Mud wallow: lying in a shallow mud puddle, content. 3 Trunk sniff: trunk raised and curled, sniffing toward the viewer. |

## Dora and Enzo (2)

Five 256×256 frames left to right, transparent background, facing **right**, feet on the line 8 px above the bottom, the chinchilla (ears included) about **220 px** tall. Each wears a small brown leather camera on a red strap.

| File | Size | Frames, left to right |
| --- | --- | --- |
| `walker-dora.webp` | 1280×256 | Dora. 1 Walking, back feet pushing. 2 Walking, front paws reaching (the other half of the stride). 3 Tiptoeing: high on her toes, body stretched, paws held up, very sneaky. 4 Crouched low with the camera raised, peeking over (she sits behind grass in game, so keep her low and compact). 5 Standing still with the camera up to her eye, taking a photo. |
| `walker-enzo.webp` | 1280×256 | Enzo, the same five frames. |
