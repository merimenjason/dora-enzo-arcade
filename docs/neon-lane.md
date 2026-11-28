# Neon Lane

Game 112, route `/neon-lane`. A maze chase on a hand-bent neon signboard on a Geylang shophouse wall, one night per
real eatery up Geylang Road. Dora and Enzo run the glass tubes eating sparks while four cicak geckos hunt them through
the glow. Every picture is a Codex painting: the six rainy shophouse walls, the title, and the neon sprite sheets of
Dora, Enzo, the cicaks and the items, painted as glowing glass on black and drawn with additive light. The tubes
themselves are drawn from the maze, so each circuit can light, flicker and go dark on its own.

## The hook: light is how the cicaks see

Real cicaks hang round lit signs because that is where the moths are. Here, the light is also how they find you.

- The sign is wired in **circuits**: each is a chain of tube runs, junction to junction, in one colour, mirrored on
  the two halves of the sign. Eat every spark on a circuit and that circuit **goes dark**; its last few sparks pulse so
  you can see it is nearly out. Fuse and start tubes carry no spark.
- A cicak only sees you while you stand on a **lit** tube, and only close by (Chik 6 tubes along the route, Chak 4,
  Tokek and Lulu 5) or straight down a tube up to 9 away. Step onto a dark tube and it loses you: it runs to where it
  last saw you, then wanders, preferring lit tubes (that is where the moths are). That preference fades as the sign
  goes dark, so the last few sparks are not walled in by a crowd.
- Cicaks crawl dark tubes at 60% speed, feeling their way, and show only as two glinting eyes.
- A cicak still catches you if it bumps into you in the dark.

So every circuit you clear becomes a hiding place, and the last lit circuits, where the cicaks crowd, hold the last
sparks. The board is cleared when the whole sign is dark: lights out, on to the next night.

## The big fuse

Each board has four glass cartridge fuses. Eat one and it blows: the whole sign flickers and every cicak out on the
tubes panics for a few seconds (7 s on night 1, down to 4 s by night 6; two more with gentle cicaks on). Panicked
cicaks run away from you and crawl at 55% speed. Catch one and, like a real gecko, it **drops its tail** and bolts
back to its drainpipe as a stub. The wriggling tail stays where it fell for 5 s and is worth a bonus, but for the first 0.6 s it thrashes too hard to grab, so running straight on through it misses it: double back for it. A cicak grows
its tail back in the drainpipe and comes out again two seconds later.

Catches in one fuse score 250, 500, 750 and 1000.

## The moth

When 30% and again when 70% of the sparks are eaten, a fat moth lands on a lit tube away from the players and stays
10 s. A cicak within seven steps of it goes for it instead of you; if it gets there it gulps it and sits still for
1.5 s, which is your window. Eat it yourself for 300 points times the night number.

## The four cicaks

| Name | Colour | Habit |
|------|--------|-------|
| Chik | green | Hunts: heads straight for the nearest chinchilla it can see. |
| Chak | magenta | Cuts you off: heads for the tube three steps ahead of where you are running. |
| Tokek | blue | Guards: patrols the lit circuit with the most sparks left until it sees you. |
| Lulu | orange | Drifts: wanders the lit tubes 8% faster than the others. |

How many come out: two on night 1 (Chik, Lulu), three on nights 2 and 3 (adding Chak), all four from night 4. With
gentle cicaks on there are never more than three, and from night 4 Tokek takes Lulu's place.

They leave the drainpipe one at a time, four seconds apart (5.6 s with gentle cicaks). A cicak rethinks its route
every 0.35 s, not every frame, so a sharp turn at a junction really does lose it for a moment. With gentle cicaks on,
it takes a random turn at 15% of junctions.

## Moving

Arrow keys or WASD. A chinchilla keeps running the way it was going until a wall. Press a direction early and it
turns at the next junction that allows it; reversing is instant. A turn pressed up to a third of a tube past a
junction still counts. There is no momentum. In two-player, Dora runs on
WASD and Enzo on the arrows; in one-player either set moves whoever is running, and Q swaps them at any time (the one running hands over to the other).
On a touch screen, swipe.

Speeds in tubes per second: chinchillas 6.5. Cicaks 5.4 on night 1, rising 0.2 a night; times 0.8 with gentle
cicaks on (the default).

## Lives and nights

Three lives (five with gentle cicaks), shared in two-player, and one more every 8 000 points. Caught in one-player:
the zap plays, the chinchilla goes back to the start and the cicaks back to the drainpipe. Caught in two-player: the
other chinchilla keeps running and the caught one comes back at the start two seconds later, safe for two more.

Scoring: spark 10, fuse 50, cicak 250 to 1000, dropped tail 100, moth 300 x night, clearing a night 1000 x night.

## The six nights, up Geylang Road

| Night | Place | Sign |
|------|-------|------|
| 1 | A corner kopitiam, Geylang Road | kopi cup |
| 2 | Geylang Lor 9 Fresh Frog Porridge, 235 Geylang Road | frog |
| 3 | Tan Ser Seng Herbs Restaurant, 29 Lorong Bachok (off Lorong 21) | turtle |
| 4 | Kwong Satay, Lorong 27A | satay |
| 5 | Durian 36, 608 Geylang Road (Lorong 36) | durian |
| 6 | Sin Huat Eating House, Lorong 35 | crab |

Addresses checked 28-11-2026 against Eatbook, Burpple, the Michelin Guide, Eatapp and the New Zealand Herald's
Geylang guide. Each night is a hand-drawn maze on a 29 x 15 grid of tubes laid on a lattice (tubes at even rows and
columns), so corridors are always one tube wide and there are no dead ends; `tests/neon.mjs` checks both.

After night 6 the run is cleared. The save (`neon-lane-v1`) keeps the best score, the furthest night reached (a run
can start from any night reached, at score 0), and the settings.

## Bots

`npm run bot:neon` plays each night, 12 seeds each, with human-delay bots that hold a key the way a person does
(pressing a turn early, before the junction). The careful bot replans every 0.12 s and uses the dark tubes, fuses
and moths; the first-timer replans every 0.3 s, hesitates more, and only eats sparks while keeping two tubes from a
cicak. With gentle cicaks on both must clear every night in almost every seed; with them off the careful bot must
clear 70% and the first-timer clearly fewer than with them on; a bot that stands still never clears. The thresholds
are in `tests/neon-bot.mjs`.
