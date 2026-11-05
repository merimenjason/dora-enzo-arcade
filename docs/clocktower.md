# The Clocktower Mystery

A painted point-and-click adventure at `/clocktower`. The town clock has stopped at quarter past six the evening before the Winter Fair, and the fair opens when it strikes eight the next morning. Someone knocked the cover off the works and four wheels went everywhere. Dora and Enzo have one night to find them.

Rules: `lib/clocktower-game.ts`. Where everything is in each painting: `app/clocktower/rooms.ts`. Page, talk box, satchel, works close-up and save: `app/clocktower/page.tsx`. Sounds and music (synthesised): `app/clocktower/sound.ts`.

## How it plays

- Click a hotspot and the hero you're playing walks over and has a go: looking, talking or picking up, whatever fits. The arrows are the ways out.
- Click a thing in the satchel to pick it up, then click a hotspot to use it there. Click it again to look at it closely.
- **Dora climbs:** high places, the ledge outside the clock room, the bakery damper up the flue, hanging on the mill lever. **Enzo listens:** he hears the clink in the dough and remembers the music box's tune. Some hotspots answer differently depending on who tries them.
- The partner walks along with you, except while Dora is hanging on the mill lever. Then switching to Enzo leaves her there, and the bar says where she is.
- A move counts only when something happens. Enzo's notebook gives the next step whenever you ask (the hint count is kept).
- Holding **Q** (or the 🔍 button) outlines everything clickable. Smaller hotspots sit above bigger ones, so the oil can on the workbench is still clickable.

## The rooms

| Room | Painting | Who's there | Hotspots |
| --- | --- | --- | --- |
| Market square | dusk (chapter 1), night (after) | | clock face, stalls, well, drain, Hatters' door, the silver button (once lit) |
| Clock tower | | Mr Tock | Mr Tock, workbench, oil can, chute, bell rope |
| Clock room | | | the works, the chart, the hatch, the bell |
| Hollis's bakery | | Baker Hollis | Hollis, three dough tubs, the oven, the damper, a torn flour sack |
| Riverside | | | the waterwheel, the drain outlet |
| Captain Rook's barge | with and without the boathook | Captain Rook (asleep), Gubbins | Rook, crow's nest, music box, boathook, Gubbins |
| Nell's mill | | Nell | Nell, the brake lever, the millstones |
| The Hatters' shop | | Hob and Hettie (once the door opens) | the twins, the parade float, the hats |

The bakery and the riverside stay shut in chapter 1 ("the clock first"), and the hat shop stays locked until Mr Tock's note goes under its door.

## The story and the solution

**Chapter 1 · The Clock Stops (dusk).** Mr Tock in the tower can't see what's wrong. The works in the clock room are missing wheels. The hatch out to the ledge is rusted shut, so take the oil can from Mr Tock's bench and oil it. Dora climbs out and sees a trail of flour and cogs heading off into town, and a tuft of red fur caught on the hatch. Tell Mr Tock and he gives you his lantern.

**Chapter 2 · Night in Town.** Three wheels:

- **Copper:** Hollis's oven won't draw and her bread won't rise. Dora climbs up and oils the stuck damper. Then Enzo taps the tubs and hears a clink in the middle one, and with the oven working Hollis lets you dig the copper wheel out of the dough.
- **Brass:** Nell at the mill says something heavy went down the drain. It's caught under the waterwheel. Borrow the boathook from Captain Rook's barge. Dora hangs on the mill's brake lever to stop the wheel, then switch to Enzo, go out to the riverside and hook the brass wheel.
- **Silver:** Gubbins the magpie has the silver wheel in the crow's nest. Enzo listens to the music box, learns Rook's supper tune and whistles it, and Gubbins flaps down to the barrel. He wants something shinier, so hold the lantern up by the dark well in the square, find the silver button between the cobbles, and swap.

Take the three wheels back to Mr Tock.

**Chapter 3 · Before Dawn.** One wheel is still missing. Show Mr Tock the red fur from the ledge: Hob and Hettie Hatter! He writes them a note saying he isn't cross. Slip it under the hat shop door, and the twins own up and hand over the little star wheel, which they meant for their parade reindeer.

**Chapter 4 · Eight O'Clock.** In the clock room, open the works and fit each wheel on its own spindle, biggest to smallest: brass, copper, silver, star. A wrong wheel won't sit. With the fourth the clock ticks again, it strikes eight, the twins ring the bell, and the fair opens.

`WALKTHROUGH` in the engine is this solution as 56 actions. The tests play it, and the page's debug hook uses it to jump ahead.

## The notebook

`hint()` looks at the story so far and gives the next step: 23 different hints on the way through. The solver checks that following only the hints, always taking the shortest way to make the hint change, reaches the ending with every hint at most a few actions from where you stand (the longest is 7, fitting the four wheels).

## The solver

`npm run bot:clocktower` (`tests/clocktower-bot.mjs`) tries every action a player could take from every state: every exit, every hotspot, every thing on every hotspot, switching heroes, and every wheel on every spindle.

- **States:** 24,648 reachable states and 78,982 moves (flags that only change what someone says are left out of a state's key, and the partner is counted as standing with you unless Dora is on the lever).
- **No dead ends:** from every reachable state the ending can still be reached.
- **Shortest solution:** 45 actions. The test keeps it between 45 and 110.
- **Everything is used:** every hotspot does something, and every thing in the satchel gets used somewhere.
- **Hints alone finish it:** 23 hints, 58 actions.

## Tests

- `npm run test:clocktower` (`tests/clocktower.mjs`): the rooms join both ways; the walkthrough runs through chapters 2, 3 and 4; the shut paths; the hidden button; the talents (only Dora on the ledge, only Enzo hears the clink); Dora on the lever while Enzo hooks the wheel, and the hook failing without her; the works; misuse lines; the notebook; and saves.
- `node tests/e2e/clocktower.mjs` (dev server running): the title, the opening and chapter card, walking, talking, picking up and using things, switching, the notebook, pause, carrying on after a reload, the works close-up, the ending with the best saved, a corrupt save, and phones held either way.

## Art

30 Codex paintings in `public/art/clocktower/`: ten room paintings for the eight rooms (the square at dusk and at night, the barge with and without its boathook), the works close-up, the title and the ending. Dora, Enzo, Mr Tock, Hollis, Nell, Gubbins and the twins are cut-outs drawn over the rooms, and so are the ten things you can carry. The talk box shows each speaker's face cropped from their cut-out (Captain Rook's comes from the barge painting). Text never sits over a face: the title's words are in the starry sky on the left, and the ending's words go below the painting.

On a portrait phone the painting fills the height above the bar and pans sideways to follow the hero you're playing. On a landscape phone the bar moves to the side.

## Save

`localStorage` key `clocktower-mystery-v1`: the story in progress (chapter, where each hero is, who you're playing, the satchel, the things found, the flags, the fitted wheels, moves, hints, rooms seen), whether it has been solved, the best result (fewest hints, then fewest moves), and the sound, music and quick-walking settings. Loading cleans a save: unknown rooms or a bad chapter drop the story in progress, and the satchel only keeps things that were found, the flags only known ones, and the spindles only the right wheel.
