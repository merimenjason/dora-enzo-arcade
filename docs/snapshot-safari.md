# Snapshot Safari

Game 45, at `/safari`. A cosy wildlife-photography game. Dora or Enzo walks a side-scrolling Andes trail at their own pace with a camera and 24 frames of film. Shy animals scamper off if you hurry at them, so you tiptoe, crouch in the tall grass and wait for the moment a vicuña rolls in the dust or a flamingo starts to dance. At home the photos are developed, scored out of five stars, and the best go into a field journal with a page for each of 24 creatures and a slot for each of their 82 behaviours. Journal stars unlock new times of day, new trails and new tools: a berry pouch, a soft whistle and a camera trap.

## Files

| Part | File |
| --- | --- |
| Engine: creatures and behaviours, trails, noticing, tools, scoring, journal, save | `lib/safari-game.ts` |
| Scene: sky, painted far hills, trail features, creatures, Dora or Enzo, viewfinder, photo prints (Canvas 2D) | `lib/safari-scene.ts` |
| Sound: shutter, whistle, berries, trap, chimes and star twinkles | `app/safari/sound.ts` |
| Page: camp, the outing HUD and controls, pause, developing photos, the field journal | `app/safari/page.tsx`, `app/safari/safari.css` |
| Paintings: the title, four far landscapes, a sheet per creature and a walking sheet each for Dora and Enzo | `public/art/safari/`, listed in [`snapshot-safari-art-brief.md`](snapshot-safari-art-brief.md) |
| Tests | `tests/safari.mjs`, `tests/safari-bot.mjs`, `tests/e2e/safari.mjs` |

## Trails and times

Four trails, each 220 m long, laid out from the outing's seed with tall grass to hide in (ferns in the forest, tola bushes on the salt flat, tussocks on the cliffs), rocks, trees, water and flowers. Five groups of creatures live along each outing's trail, picked from those that live there at that time of day and placed at a spot that suits them: rock-dwellers on rocks, tree birds in trees, water birds on the water, hummingbirds at flowers.

| Trail | Opens at | Creatures |
| --- | --- | --- |
| Puna Grassland | from the start | vicuña, llama, alpaca, Andean fox, wild guinea pig, puna tinamou, mountain caracara, puna rhea, Andean lapwing, mountain viscacha |
| Cloud Forest | 30 ★ | giant hummingbird, spectacled bear, wild guinea pig, torrent duck, taruca deer, cock-of-the-rock, mountain toucan, mountain tapir |
| Salt Flat Lagoon | 95 ★ | vicuña, Andean flamingo, giant coot, mountain caracara, Andean goose, puna rhea, Andean lapwing, puna ibis |
| Condor Cliffs | 155 ★ | Andean condor, Andean fox, Andean cat (dusk only), mountain caracara, taruca deer, mountain viscacha, wild chinchilla (noon and dusk) |

Mornings are open from the start, noon at 12 ★ and dusk at 70 ★. Each behaviour has its own weight for morning, noon and dusk, so the time changes what animals do: viscachas sunbathe in the morning, vicuñas dust-bathe at noon, alpacas huddle and wild chinchillas roll in dust at dusk. The light counts too: golden light per trail and time is

| | Morning | Noon | Dusk |
| --- | --- | --- | --- |
| Puna Grassland | 0.7 | 0.1 | 1 |
| Cloud Forest | 0.45 | 0.25 | 0.6 |
| Salt Flat Lagoon | 0.75 | 0.05 | 1 |
| Condor Cliffs | 0.7 | 0.15 | 0.95 |

An outing lasts 360 seconds of daylight (a warning comes with 45 left) or until you head home.

## Creatures

24 creatures, inspired by real Andean wildlife, with 3 or 4 behaviours each: 82 journal slots, 22 of them rare (✦). Some behaviours wait for something: **calm** (the animal has calmed down, see below), **group** (a friend from its group within 6 m), **berries**, **whistle**, or **alone** (nobody within 14 m: only the camera trap sees it).

| Creature | Shyness | Behaviours |
| --- | --- | --- |
| Vicuña | 0.75 | Grazing, Trotting together (group), Dust bath ✦ (calm), Sentry call (whistle) |
| Llama | 0.25 | Chewing, Curious stare (calm; it walks up to you), Berry snack (berries), Humming with a cria ✦ (calm) |
| Alpaca | 0.35 | Munching, Fluffy shake, Cosy huddle (group), Pronking ✦ (calm) |
| Andean flamingo | 0.6 | Filter feeding, Standing on one leg (calm), Flamingo dance ✦ (group), Taking flight ✦ |
| Andean condor | 0.5 | Perched on a ledge, Sunning its wings, Soaring, Gliding past the sun ✦ (noon) |
| Giant hummingbird | 0.3 | Hovering, Sipping nectar, Resting on a twig (calm), Courtship dive ✦ |
| Andean fox | 0.7 | Trotting, Sniffing the air, Mouse pounce ✦ (calm), Head tilt (whistle) |
| Spectacled bear | 0.55 | Munching bromeliads, Climbing a tree, Berry feast (berries), Cub tumble ✦ (a cub, with its mother) |
| Wild guinea pig | 0.8 | Nibbling clover, Peeking from the grass, Popcorning ✦ (calm), Sharing berries (berries) |
| Torrent duck | 0.6 | Preening on a rock, Diving, Riding the rapids ✦ |
| Giant coot | 0.35 | Paddling, Building its nest, Feeding a chick ✦ (calm) |
| Andean cat | 0.95 | Watching from the rocks, Grooming (calm), Prowling ✦ (alone) |
| Puna tinamou | 0.7 | Pecking seeds, Freezing still, Whistling back (whistle) |
| Mountain caracara | 0.4 | Strutting, Turning stones, Head-back call ✦ (calm) |
| Andean goose | 0.45 | Grazing the shore, Honking parade (group), Preening |
| Puna rhea | 0.6 | Striding, Pecking, Wing display ✦ (calm) |
| Andean lapwing | 0.5 | Wading, Calling out, Wing flash ✦ (whistle) |
| Taruca deer | 0.8 | Browsing, Ears up, Leaping ✦ |
| Mountain viscacha | 0.55 | Nibbling, Washing its face, Sunbathing ✦ (calm, not at dusk), Standing tall (whistle) |
| Wild chinchilla | 0.85 | Nibbling a seed, Peeking out, Dust bath ✦ (calm, dusk) |
| Cock-of-the-rock | 0.5 | Perched, Hopping branches, Lek dance ✦ (group) |
| Puna ibis | 0.45 | Probing the mud, Preening, Flying in a line ✦ (group) |
| Mountain toucan | 0.5 | Perched in the mist, Berry toss (berries), Yelping call |
| Mountain tapir | 0.65 | Browsing leaves, Mud wallow ✦ (calm), Trunk sniff (whistle) |

Common behaviours last 10 to 18 seconds and rare ones 4 to 7. When a behaviour ends the animal picks the next: 70% of the time it joins in with a group-mate's behaviour (herds keep together), otherwise it picks by the time-of-day weights, with rare behaviours picked at 0.6 of their weight. Flamingos taking flight and ibises flying off in a line leave the trail. The journal shows a hint for every empty slot ("Rare · Dusk · when it feels calm: hide or keep very still").

## Moving and being noticed

| Pace | Speed | Noise | Camera steadiness |
| --- | --- | --- | --- |
| Standing still | | 0.05 | up to 1 |
| Tiptoe | 0.8 m/s | 0.18 | up to 0.5 |
| Walk | 2 m/s | 0.55 | up to 0.22 |
| Hurry | 4.4 m/s | 1.25 | 0 |
| Hidden (crouched in cover, still) | | 0 | up to 1 |

Moving through cover is 0.6 times as loud. Steadiness rises 0.8 a second (1.2 when crouched) and drops 4 a second.

Each creature has a shyness from 0 to 1. Its **alarm** rises by noise × (1 − distance / reach) × (0.3 + 1.5 × shyness) a second within its reach of 4 + 16 × shyness metres, plus 0.3 × shyness a second if you stand in the open within 1.2 + 2.5 × shyness metres, and falls by 0.12 a second. Above 0.45 it freezes and stares at you (a "!" shows); at 1 it runs or flies off and is gone 2.5 seconds later. The shutter's click adds 0.08 × shyness to animals within 6 m.

Its **calm** builds while you are within 18 m and it is not uneasy (alarm under 0.3): 0.05 a second while you hide, 0.025 a second while you stand still, and it drops 0.08 a second while you walk or hurry nearby. Calm behaviours need calm 0.6 (hearts float up when an animal is that calm). Rare behaviours twinkle while they happen, and a "something special nearby" note appears when one starts within 16 m.

## Tools

- **Berry pouch** (50 ★): three handfuls an outing, tossed 4 m ahead, one on the ground at a time for 25 seconds. Berry lovers (llama, bear, guinea pig, toucan, tinamou, viscacha, wild chinchilla) within 12 m and not uneasy walk over at 1.1 m/s and eat for at least 8 seconds, doing their berry behaviour if they have one.
- **Soft whistle** (125 ★): every 8 seconds. Animals within 14 m that answer a whistle start their whistle behaviour; the rest look your way for 2.5 seconds. Each adds 0.1 × shyness to alarm (0.03 × shyness while you hide).
- **Camera trap** (190 ★): one an outing, set where you stand. Once it has been out 3 seconds and you are more than 8 m away, it takes a photo whenever a creature below 2 m comes within 1.8 m of it, at most every 4 seconds and at most 3 photos, keeping only shots worth 2 stars or more. Its lens is fixed on the spot at 1 m high and 1.8× zoom, and it is always steady. Walk back within 1.5 m to fetch it and its photos; a trap left out comes home empty. It is the only way to see the Andean cat prowling.

## Taking a photo

The viewfinder is 5 m tall at 1× and 3:2, zooms from 1× to 8× and reaches up to 14 m either side of you and 0 to 8 m up. A photo takes a frame of film and half a second to wind on. A creature counts if at least 60% of it is in the frame; the best of them is the subject, and friends filling at least a tenth of the frame are recorded too.

| Part | How it is scored, 0 to 1 |
| --- | --- |
| Size | the subject's share of the frame: nothing below 0.06, rising to 1 at 0.3, full to 0.72, then falling for a crop |
| Framing | the better of the centre (0.9 at the centre, 0 at 0.3 of the frame away) and the nearest third point (1 on it, 0 at 0.16 away), times the share in frame squared |
| Sharpness | 1 − 0.55 × the animal's movement − (1 − steadiness) × (0.45 + 0.06 × zoom); an animal running off moves 1, a frozen one 0.05 |
| Facing | 1 looking at you, 0.6 side-on, 0.15 facing away |

Quality = 0.28 size + 0.24 framing + 0.3 sharpness + 0.18 facing. Stars = 2.8 × quality + the behaviour (1.4 rare, 0.3 otherwise) + 0.35 for each friend (up to 2) + 0.7 × the golden light, rounded and kept between 0 and 5. A speck (size 0) is 0 stars and a blur (sharpness under 0.35) at most 1. Each photo gets a short, kind comment saying what went well or what to try next. Stars stay hidden until the photos are developed.

## Developing and the journal

Heading home (or running out of daylight) develops the roll: each photo fades in on a print with its stars, creature, behaviour and comment, marked **NEW SLOT** or **BETTER** than the journal's photo. The best photo of each slot that improves the journal is ticked for you; untick or tick any, then paste them in. A journal slot only ever takes a better photo (more stars, then more points). Photos are saved as small descriptions (creature, behaviour, where it sat in the frame, its size, the aim and zoom, sharpness, friends, score) and re-drawn by the scene, never as images.

| Unlock | Journal stars |
| --- | --- |
| Noon outings | 12 |
| Cloud Forest | 30 |
| Berry pouch | 50 |
| Dusk outings | 70 |
| Salt Flat Lagoon | 95 |
| Soft whistle | 125 |
| Condor Cliffs | 155 |
| Camera trap | 190 |

The journal holds up to 410 stars (82 slots × 5).

## Controls

- **Keyboard:** A and D or ← and → walk; 1, 2 and 3 pick tiptoe, walk and hurry, and holding Shift tiptoes; S or ↓ crouches (and hides in cover); the mouse aims, or I, J, K and L nudge the viewfinder; click, Space or Enter takes a photo; the mouse wheel, + and − (or ↑) zoom; B tosses berries, V whistles, C sets the camera trap; P or Escape pauses; H asks whether to head home, and H again heads home. Escape leaves the journal.
- **Touch:** hold ◀ or ▶ to walk, tap a pace and Hide, drag on the trail to aim, use the zoom slider and the round 📸 button. The tool buttons sit beside it.

## Saving

Saved in `localStorage` under `snapshot-safari-v1`: the journal (one photo per slot), the number of outings and photos, the best roll and best single photo, the creatures seen, the photographer (Dora or Enzo), the last trail and time, and whether sound is on. Saves are read field by field: a photo with an unknown creature, behaviour or out-of-range number is dropped, and a locked trail or time falls back to the Puna Grassland in the morning.

## Tests

- `tests/safari.mjs`: the creatures, behaviours, hints and where each slot can be found; the trails; exact replays from a seed; walking, steadiness, hiding and noise; hurrying scaring vicuñas while tiptoeing and hiding calms them; scoring (thirds, centre, edges, specks, blur, backs, fleeing, rare, light, friends, empty frames); film and the shutter; berries, the whistle and the camera trap; the end of the day; developing, pasting, unlocks; and the save.
- `tests/safari-bot.mjs`: a careful photographer (walks between groups, tiptoes in, hides, waits up to 30 seconds per group for something the journal still wants, frames on a third and uses every tool) and a careless one (always hurries, snaps the moment anything is in view) play 36 outings each. The careful one fills 70 of 82 slots (279 ★), reaching three quarters only on outing 22, at 3.88 ★ a photo, and catches the Andean cat prowling with the camera trap; the careless one fills 30 slots (89 ★) at 1.88 ★ a photo. Seasons replay exactly.
- `tests/e2e/safari.mjs`: the arcade card, camp's locks and saved photographer, walking and paces by keys, aiming with the mouse and zooming with the wheel, snapping with Space, pausing, developing and pasting into the saved journal, the journal page, and the phone layout with the ▶ and 📸 buttons.

Written 27-10-2026.
