# Dragon Playground

A side-on racing platformer across Singapore's old mosaic playgrounds, drawn as terrazzo and broken-tile mosaic. Written
27-11-2026. The user picked it from four Singapore pitches (mock-ups in `docs/ideas/dragon-playground/`), and chose:
race the otters; co-op on one keyboard with a helper bot; built straight into the arcade.

## The idea

At dusk the old mosaic dragon at Lorong 6 Toa Payoh wakes up. Dora and Enzo climb on, and the dragon wants to wake its
old friends, the other mosaic playgrounds across the island. But the Bishan otter family thinks every playground belongs
to them. Each race runs from one playground to the next through the estate in between, against three otters. Win and
that playground wakes up and lends you its power for the rest of the game.

## Two jobs on one dragon

| | Driver (the dragon's legs) | Rider (on its back) |
|---|---|---|
| Who | player 1 | player 2, or the helper bot until player 2 presses a key |
| Does | runs, jumps, slides, roars | swats crows, grabs laundry poles, swing chains and monkey bars, uses the playground power |

Q swaps which hero drives (solo only). Dora and Enzo both drive and ride; only the art changes.

## Controls

| | Solo | Player 1 with a second player | Player 2 |
|---|---|---|---|
| Run | arrows or A / D | A / D | – |
| Slide (on a slide or slope), belly-slide on flat | Down or S | S | – |
| Jump (hold to go higher) | K or Space | K or Space | – |
| Roar (spend a full snack meter) | I | I | – |
| Swat | J (takes over from the bot for a moment) | – | , (comma) or Numpad 1 |
| Grab | L | – | / or Numpad 3 |
| Playground power | O | – | ' (apostrophe) or Numpad 0 |
| Swap driver and rider | Q | – | – |
| Pause | Esc or P | Esc or P | Esc or P |

Player 2 joins by pressing any of their keys.

## Direct controls, no momentum

Speed answers the keys at once: holding right runs at full speed, releasing stops, and holding left walks back at half
speed. There is no inertia, skid or drift. Boosts are timed speed tiers on top of the run:

| Source | Tier | For |
|---|---|---|
| Slide exit (press Down on a slide) | 1.35× | 1.2 s |
| Swing-chain or laundry-pole fling (rider grabs) | 1.5× | 1.0 s |
| See-saw (land on the high end) | a tall spring jump | – |
| Roar (full snack meter) | 1.6×, and otters within reach ahead stumble | 2.5 s |

Sand slows the dragon to 0.6× while its feet are in it. A crow that reaches the rider steals a kaya toast and makes the
dragon stumble for 0.5 s; the rider swats crows away. Falling into a longkang puts you back at the last checkpoint after
a short splash, a time loss but never a game over.

## The otters

Three otters from the Bishan family race every course: a leader and two pups. They follow a racing line written into
each course, take their own drain shortcuts (they dive into a drain grate and pop out further on, shown by bubbles),
bump the dragon if they share a spot, and stumble when roared at, swatted or hit by a power. Easy hits (assist, on by
default) slows them when they lead by a lot. The race is won by finishing first. A lost race just offers a retry.

## Races

Every race is a fixed list of hand-placed chunks (sandpit, slide, see-saw, swing set, monkey bars, laundry poles, void
deck, longkang gap, bench row, merry-go-round), so a seed only changes the crows and the otters' small choices.

| # | Route | New thing | Win wakes |
|---|---|---|---|
| 1 | Lorong 6 Toa Payoh to Dakota Crescent | run, jump, slide, sand, crows | the Dakota Crescent dove: **Flutter**, the rider flaps for a second jump |
| 2 | Dakota Crescent to Pipit Road, MacPherson | void decks and laundry poles | the Pipit Road pelican: **Gulp**, scoops up every crow and toast near the dragon |
| 3 | Pipit Road to Tampines Avenue 5 | rain, drains overflowing, slides become fast | the Tampines watermelon: **Seed spit**, knocks down the otter ahead |
| 4 | Tampines to Ang Mo Kio Avenue 3 | a pasar malam to run through | the Ang Mo Kio mini dragon: **Twin**, runs beside you and doubles the next boost |
| 5 | Ang Mo Kio through Bishan Park back to Toa Payoh | the otters' home river, night | the finale: the whole estate's playgrounds awake |

Playground places come from the National Heritage Board's *Mosaic Playgrounds in Singapore* and press guides; the
Pipit Road pelican has a dragon's head.

## Art

Everything is Codex-painted terrazzo and broken-tile mosaic (style reference `docs/ideas/dragon-playground/mockup.webp`).
To keep play readable when everything is made of chips: backgrounds are calmer and lower in contrast, and everything you
touch (ground, platforms, props, racers) has a thick dark grout outline. Sprites are painted at one chip size and drawn
at 1:1, never stretched.

- The dragon is a chain of mosaic body segments that follow the head, so its body curls and waves as it runs and jumps.
- The riders and the otters are painted as pose sheets, one pose per action, so every action has its own animation:
  run, jump, land, slide, belly-slide, stumble, cheer, swat, grab, hang, fling, flap, splash.
- Dora and Enzo wear new clothes for this game, with no signature items: Dora a yellow school shirt and blue shorts,
  Enzo a red PE singlet and white shorts.
- HUD text is real text on solid plaques, never painted lettering, and every card sets its own text colour.
