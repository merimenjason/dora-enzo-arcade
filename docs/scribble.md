# Dora & Enzo's Arcade · Chinchilla Scribble

A word puzzler in the style of Super Scribblenauts. You write the name of a thing and it appears. Dora and Enzo use what you write to reach a golden wolfberry in each level: climb it, ride it, feed it to someone, set it on fire or drop it on a pressure plate. Adjectives stack, so the same noun can do very different jobs.

The rules live in `lib/scribble-game.ts`, a deterministic engine with no browser dependencies. The dictionary and the parser are in `lib/scribble-words.ts`. `lib/scribble-art.ts` draws every thing, `lib/scribble-scene.ts` draws the level around them, and `app/scribble/page.tsx` is the page.

## Run locally

Requires Node.js 22.13+ and Canvas 2D.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/scribble`.

## The world

- One screen per level: 1000 × 600 (`W`, `H`), y pointing down, the ground at 472 (`GROUND`).
- Terrain is a list of solid rectangles (`Terrain`) of a kind that decides how it's drawn: `ground`, `cliff`, `rock` (overhangs and tunnel roofs), `burrow`, `house`, `shelf`, `floor` and `haystack`. Water is a separate list (`Water`) that can freeze.
- Things (`Ent`) are boxes with their bottom centre at `(x, y)`. Gravity is 1,500 px/s². Things with `solid` have a top you can stand on (stairs have four steps, a rainbow has an arc, a tree only its canopy). Things with `wall` also block from the side: the llama, Grandpa Pebble, the rockfall and the gate.
- Flying things hover where they're put. Floating things bob on water; everything else sinks slowly.

## Dora and Enzo

- You steer one; the other follows (`followInput`). The follower walks behind, climbs after you, hops onto your ride, stays out of water and fire, and if it's been stuck more than 260 px away for 3 seconds while you're settled, it pops over to you.
- They walk at 180 px/s and jump 540 px/s, about 96 px high. Climbing is 150 px/s.
- `goTo(x, y)` is tap-to-move: it turns a target into the same input a player would press (`steer`). It walks, jumps small steps and onto low things, climbs anything climbable when the target is higher, hops onto a flying ride hovering overhead, and flies a ride to the target, hopping off when there's ground beneath.
- Riding: flying rides (`fly` + `ride`) are boarded on touch and steered in four directions. Vehicles (`drive`), boats (`boat`, only on water) and rideable animals are boarded by standing on them. ↓ on the ground hops off, and pushing into a wall for a quarter of a second hops off over it.
- Water sends a chinchilla back to the last safe spot on dry land. Fire (except torches and candles) and hostile animals knock them back and stun them for 0.7 s.

## Words

`parse(text)` lowercases, drops punctuation and filler words ("a", "the", "very"…), then looks for the longest noun at the end (up to three words, so "hot air balloon" beats "hot" + "air balloon"). Plurals are tried as `-s`, `-es`, `-ies` and `-ves`. Every word before the noun must be an adjective. An unknown word gets a did-you-mean from the closest dictionary word by edit distance. "Wolfberry" is reserved, and "Dora" and "Enzo" suggest "chinchilla" instead.

There are 177 nouns (356 words with synonyms) in `NOUNS`, each with a size, tags, a mass, a drawing and a colour, and 47 adjectives in `ADJECTIVES`:

| Kind | Adjectives |
| --- | --- |
| Size | giant (× 2), big (× 1.5), tiny (× 0.5), long (width × 2), tall (height × 2), short |
| Movement | flying (adds wings; you can ride it), fast, slow, bouncy, rubber |
| Weight | heavy (+6), light (floats), floating, golden, metal, stone, wooden |
| Temperature | flaming (burns), hot, frozen (cold: puts out fire, freezes water), wet |
| Mood (animals) | angry (chases you), friendly, happy, sleepy, hungry (eats food nearby) |
| Other | glowing (gives light), scary, explosive, sticky (stays where it's put), ghostly, fluffy |
| Looks | red, orange, yellow, green, blue, purple, pink, black, white, brown, grey, rainbow, striped, spotty |

`summon(text)` builds the thing (`build`), puts it in front of the leader and slides it back out of any wall (`place`), and counts the word. You can have 14 things at once (`MAX_THINGS`); making more removes the oldest.

## What things do to each other

Every step, `interact` checks every pair:

- Something burning (`flame`) sets touching things that `burn` alight after 0.8 s. They burn for 10 s (`BURN_TIME`) and are gone. A burning thing that isn't made to burn, like a flaming rock, burns for ever.
- Anything `wet` or `cold` touching a fire puts it out, and a rain cloud puts out anything below it.
- Anything `cold` touching water freezes it; frozen water is solid ground.
- `explode` things go off after 3 s (`FUSE`), or sooner if something hot touches them: a 160 px blast (`BLAST`) that breaks rockfalls, throws things, scares guards away and knocks back chinchillas.
- A `break` tool (pickaxe, hammer, drill, shovel, axe, saw) held against a rockfall for 0.8 s breaks it.
- `trap` things (cage, net) dropped on a guard catch it.

## Residents

- **Blockers** (the llama, Grandpa Pebble) stand in the way as walls until something with a tag they need comes within 120 px. The llama eats `plant` food; Pebble wants anything `warm`. Then they move aside.
- **Guards** (the puma, the zombie) patrol a stretch and chase chinchillas who come near. A `scary` thing within 230 px makes them flee off-screen (the zombie also runs from fire and light), food they like within 320 px makes them walk over, eat it and fall asleep, and a cage or net catches them.
- **The gate** opens while its plate carries a mass of 5 or more (`load` counts everything stacked on it). Chinchillas weigh 1.
- **The dark storeroom** only shows the wolfberry when something that gives light is within 230 px of it (`LIGHT_REACH`).

## Levels

| # | World | Level | Par | Some answers |
| --- | --- | --- | --- | --- |
| 1 | Meadow | The high ledge | 1 | ladder, stairs, trampoline |
| 2 | Meadow | The cliff | 1 | ladder, flying carpet, giant trampoline |
| 3 | Meadow | Across the river | 1 | bridge, boat, ice |
| 4 | Meadow | The hungry llama | 1 | carrot, hay, apple |
| 5 | Mountain | Campfire in the pass | 1 | bucket, snowball, rain cloud |
| 6 | Mountain | Rockfall | 1 | pickaxe, bomb, dynamite |
| 7 | Mountain | The puma’s patrol | 1 | steak, cage, dog |
| 8 | Mountain | The old gate | 1 | anvil, boulder, elephant |
| 9 | Burrow Town | Pebble’s doorway | 1 | blanket, heater, hot chocolate |
| 10 | Burrow Town | The dark storeroom | 2 | lamp and ladder, glowing ladder |
| 11 | Burrow Town | Rooftops | 2 | two ladders, helicopter, flying bed |
| 12 | Burrow Town | Zombie in the garden | 2 | brain or torch, then a ladder |

The sandbox (`SANDBOX`, level -1) has a pond and a ledge and no wolfberry.

## Stars and saving

- `starsFor(words, par)`: 3 at or under par, 2 within two more, 1 beyond.
- The page keeps `chinchilla-scribble-v1` in `localStorage`: each solved level's best stars, every word used to solve it, and how many times it was solved again with only new words; and a word book of every noun and adjective written.
- A level opens once the one before it is solved.

## Drawing

Everything is in the clean-line style of the arcade: a thin dark outline, a gradient from a lit top to a shaded base, a highlight and some texture. Four-legged animals share one body (`beast`) and birds another (`birdie`). Colours come from the noun or the adjective; golden, frozen, fluffy and patterned things are painted over only their own pixels on a scratch canvas. Flying things get wings. Dora, Enzo and Grandpa Pebble are the arcade's `drawChinchilla`, lit from the top left the same way. Each level's sky, distant hills and terrain are drawn once and cached; the butterflies, bee, condor, fireflies, water and effects are drawn every frame.

## Tests

- `npm run test:scribble` (also in `npm test`): the parser and dictionary, summoning and adjectives, every noun settling, the interactions above, the follower and the swap, 24 scripted solutions across all 12 levels, walking alone never winning, and star counts.
- `tests/e2e/scribble.mjs` (in `npm run test:e2e`): the page in a browser, from the menu card to winning, keyboard play, dragging, riding, the word book, the sandbox and a phone-sized screen.
