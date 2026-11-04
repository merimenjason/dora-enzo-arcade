# Cloudberry Balloon

A side-on hot-air balloon game at `/balloon`. Dora and Enzo fly Granny Bramble's patchwork balloon over eight hops of a painted valley to the Lantern Festival on the High Meadow. There is no steering: the burner takes the balloon up, the vent lets it down, and the wind, which blows a different way at different heights, carries it along. On the way they pick cloudberries, parachute jars of jam into village gardens and land softly at the end of each hop.

Rules: `lib/balloon-game.ts`. Drawing: `lib/balloon-scene.ts` (Three.js, toon shading with ink outlines; Dora and Enzo use the shared rig in `lib/hunt-chinchilla.ts`). Page, input, HUD and save: `app/balloon/page.tsx`. Sound and the waltzes: `app/balloon/sound.ts`.

## The balloon

The engine runs at 60 ticks a second; the page runs two ticks per frame, so a flight plays at double speed and a hop takes one to three minutes.

- **Heat:** the burner adds 0.16 a second and uses one unit of fuel a second. The envelope cools by 3% of its heat a second, and the vent takes away 0.24 a second. Heat stays between 0 and 1.2.
- **Neutral heat:** the heat that holds the balloon level is `0.5 + height / 5000 - 0.045 × sandbags thrown`. Thin air higher up needs more heat; each sandbag thrown needs less. The HUD's heat gauge marks it with a line.
- **Climb and sink:** vertical acceleration is `6 × (heat - neutral) + thermal - 0.5 × vertical speed`. The balloon answers the burner slowly: heat builds over seconds, and so does the climb.
- **Along:** the balloon drifts toward the wind's speed, catching up over about 2.2 seconds. Enzo's pedals add up to 2.2 m/s either way: enough to line up over a bush or a garden or to creep along near the ground, not to fight a real wind.
- **The wind:** each hop has bands of wind, each blowing east or west at its own speed up to a given height, with gusts. Near the ground the wind fades to 5% at the surface and is full strength 38 m up. The HUD's wind gauge shows the wind at twelve heights round the balloon.
- **Thermals** over sunny clearings lift the balloon, fading out 320 m above the ground; the gorge and the High Meadow have downdrafts.
- **Walls:** rising ground (the cliffs, the gorge sides) pushes the balloon back with a bump.

## Tips on the first hop

On Granny Bramble's Farm a line at the top of the screen says what to do next, from where the balloon is: light the burner, let go once high enough and read the wind gauge, skim the bush ahead, get ready to vent near the meadow, come down gently, and pedal back in the calm if you overshoot. It uses the touch buttons' names on a touch screen.

## Touching down

- Faster than 5.5 m/s down onto the ground is a **crash** and ends the hop.
- Faster than 1.8 m/s down, sideways faster than 4 m/s, or onto the **treetops**: a bounce and a bump.
- Gentler than that, the balloon settles. On the finish pad that is **landed**. On a village pad the burner is **filled up** again. Anywhere else it waits for the burner to lift it off.
- Into the **lake**: a **splash**, and the hop ends.
- Out of fuel on the ground away from a village: **stranded**, and the hop ends.
- Every **bump** (birds, the storm, trees, walls) knocks one cloudberry out of the basket; lightning knocks out two.

## Cloudberries and jam

- **Berries:** pass the basket over a bush, within 5 m along and from 1 m below its top to 6 m above it, and Dora's net picks 3 cloudberries.
- **Jars:** **E** drops a jar of jam on a parachute from wherever the balloon is, moving with the balloon and then the wind. Within 2.5 m of a garden it is **perfect**, within 7 m it is **good**, and otherwise it is a miss. The white ring (the jar guide, on by default, **G** to toggle) shows where a jar dropped now would come down.

## The hops

| # | Hop | Fuel | Jars | Gardens | Sandbags | Berry goal | Par (s) |
|---|---|---|---|---|---|---|---|
| 1 | Granny Bramble's Farm | 90 | 0 | 0 | 2 | 6 | 160 |
| 2 | The Windmill | 150 | 4 | 2 | 2 | 9 | 175 |
| 3 | Lake Lumen | 160 | 5 | 3 | 3 | 9 | 170 |
| 4 | Bramblewood | 160 | 4 | 2 | 3 | 12 | 170 |
| 5 | Kestrel Cliffs | 180 | 5 | 3 | 3 | 12 | 180 |
| 6 | Whistling Gorge | 180 | 4 | 2 | 3 | 12 | 180 |
| 7 | The Thunderhead | 200 | 4 | 2 | 3 | 12 | 185 |
| 8 | The High Meadow | 220 | 4 | 2 | 3 | 15 | 205 |

Every hop after the first has a village on the way to fill up the burner. Kestrel Cliffs, Whistling Gorge and the High Meadow have flocks of birds crossing at set heights. The Thunderhead's cloud flashes every 4 seconds and strikes a balloon inside it.

## Points and stars

A landed hop scores 300, plus 20 a cloudberry, 150 a perfect jar and 75 a good one, up to 200 for a soft touch-down, 2 a unit of fuel left, and 2 a second under par (flight time, at the engine's speed). A hop that doesn't land scores nothing.

Stars: one for landing, one for a jar in every garden (free on the farm, which has none) and one for the berry goal. Landing a hop opens the next one; landing the High Meadow the first time brings the ending.

## Bots

`npm run bot:balloon` flies every hop with two pilots that see only what a player sees (the wind gauge, the ground, the jar guide) and checks:

- the **hurried** pilot (straight for the finish, refuelling only when it must) lands every hop with more than a quarter of its fuel left;
- the **careful** pilot (goes for the bushes and gardens, gives up on one after 75 seconds, and on all of them below 45% fuel) lands every hop, gets two stars or more on at least four, and picks at least 45% of the berries and delivers at least 45% of the jars;
- a pilot that never lights the burner never leaves the ground.

At the time of writing, the hurried pilot lands every hop in 131 to 304 seconds of engine time; the careful pilot gets two stars or more on four hops, 62 of 111 berries and 8 of 16 garden jars.

## Tests

- `npm run test:balloon`: the burner, vent and neutral heat; winds, the calm near the ground and the pedals; thermals and the downdraft; flat pads; berries, jars and sandbags; touch-downs (crash, settling, trees, the lake); refuelling and being stranded; the storm and the birds; results and stars; saves; determinism.
- `npm run bot:balloon`: the pilots above.
- `node tests/e2e/balloon.mjs` (with `npm run dev` running): the title, the welcome, burner, vent and pedals, pause, a landing saved, a jar and a sandbag, a corrupt save, and phones held either way.

## Save

`localStorage` key `cloudberry-balloon-v1`: the best points and stars for each hop, whether the welcome and the ending have been seen, the settings (sound, music, jar guide) and running totals (flights, cloudberries, jars, splashes). A save that doesn't parse falls back to a new one.
