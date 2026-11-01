# Wind-Up Rally

A side-on badminton duel between wind-up tin toys at `/rally`, game 74 of the arcade. After closing time the toyshop shelf plays badminton: Dora or Enzo, tin chinchillas with brass keys in their backs, wind up, run, hop and smash past seven clockwork rivals for the Clockwork Cup.

All numbers below come from `lib/rally-game.ts`, `lib/rally-scene.ts` and `app/rally/page.tsx`. Written 01-11-2026.

## Files

- `lib/rally-game.ts`: the rules. The court, the shuttle's flight, the swing and which shot it plays, the shot solver, the wind-up spring, scoring, the serve, the seven toys and their AI, doubles and versus, medals, unlocks and the save. A fixed step of 1/120 s with every random choice drawn from a seeded mulberry32 generator kept in the match state, so a seed and the same inputs replay a match exactly. No DOM, no wall clock.
- `lib/rally-scene.ts`: the drawing (Canvas 2D). The painted toyshop backdrop and the lithographed tin court (four skins), the net, the toys as painted cut-outs (crossfading poses, the topple, the swing swoosh, the winding key), the shuttle with its trail and shadow (and an arrow when it flies off the top), the crowd of toys at the back of the shelf, the cheering chinchilla, sparks, feather puffs and words. It does not use the shared `drawChinchilla`; until the cut-outs load it draws tin stand-ins. The backdrop and court are drawn once into a layer and reused.
- `lib/rally-art.ts`: generated from the cut-outs: each sprite's size and where its feet are.
- `app/rally/page.tsx`, `rally.css`, `sound.ts`, `layout.tsx`: the page (menu, ladder, doubles, intro card, play, the result, the dawn ending), keyboard and touch input, the in-flow tutorial, the match-point replay, the HUD (name plaques with key gauges, a tin flip-card scoreboard, the call), saving; synthesised tings, clanks, the winding ratchet and a music-box tune for each toy.
- `public/art/rally/`: 31 Codex paintings: the backdrop, the title and the dawn ending (1536×1024), and the cut-outs of Dora and Enzo (ready, run, smash, lunge, wind, cheer, topple) and the seven toys (ready, swing). Dora and Enzo face right, the toys face left.
- `tests/rally.mjs`, `tests/rally-bot.mjs`, `tests/e2e/rally.mjs`: engine checks, the ladder bots and the browser suite.

## The court

Distances are court units, seen side-on, with the net at x = 0. Each half is 4.4 long (`HALF`), the short service line is 1.3 from the net, the net is 1.0 high and its top 0.08 is the tape. A toy may run 0.6 behind its back line and no closer than 0.28 to the net. A shuttle landing on a line is in.

## The shuttle

Gravity 7.2 and quadratic drag (`a = −0.24 |v| v`), so a shuttle leaves the racket fast and then drops steeply at a terminal speed of about 5.5. It is stepped with semi-implicit Euler at 120 Hz and turns cork-first after every hit. A shuttle that clips the tape is a let-cord: it pops up and carries on over or falls back (a let-cord that falls back counts as a net). Hitting the net below the tape drops it on the hitter's side.

## Swinging and shots

One swing button. A swing lasts 0.3 s; the racket's strike moment is 0.1 s after the press, and it can meet the shuttle up to 0.075 s either side of it within reach (0.38 behind to 0.88 in front, 0.04 to 1.5 up from the feet). Within 0.024 s of the strike moment it is a sweet-spot hit: a ting, a spark and 12% more pace on a smash. If the shuttle would leave reach before the strike moment, the racket meets it early.

Which shot it plays depends on the contact height above the feet and the held direction (toward the net is short, away is long):

| Contact | Shot | Target |
|---|---|---|
| above 1.0, in the air and on time | **smash** | 1.5, 2.6 or 3.6 deep at 21 × power |
| above 1.0, aiming short | **drop** | just over the net |
| above 1.0 | **clear** | 3.3, 3.75 or 4.0 deep, launched at 46–50° |
| 0.45 to 1.0 | **drive** | 2.0, 2.9 or 3.5 deep, flat |
| below 0.45 near the net | **net** shot (62°), a **tumble** (70°) on the sweet spot, or a **lift** when aiming long | |
| below 0.45 further back | **lift** (3.0–3.9 deep, 51–55°), or a net shot when aiming short | |

The shot solver finds the speed that lands each shot on its target and raises the launch angle 4° at a time until the flight clears the net. The low serve goes at 24° to 1.75 deep; the high serve (hold back as you serve) at 54° to 3.95.

## The wind-up spring

Every toy's spring runs from 1 (full) to 0. Running costs 0.015 per unit, a hop 0.04, and shots cost: smash 0.12, clear 0.04, lift 0.04, drop 0.03, drive 0.03, tumble 0.025, net 0.02, serve 0.01, a whiff 0.015. Holding Wind while standing still winds 0.36 a second. Below 0.3 a toy runs slower; under 0.25 it hits softer (power falls to 0.8), and a toy that runs out hops lower. Toys run at 3.3 a second at top speed on a full key and hop 3.9 up.

## Scoring and the serve

Rally-point games to 11, win by two, capped at 15. The ladder matches are one game, except Old Humbert's final, best of three. The winner of a point serves. The server may walk to a spot but cannot hop; a human server who waits 8 s serves on their own. A point pauses 1.5 s and a game 2.6 s, while the toys stroll back and wind.

## The toys

Each toy is the same physics with its own style: reaction delay, how far off its read of the flight is, shot error, swing timing spread, appetite for hops, net shots and deep shots, how well it aims away from you, where it waits and when it winds.

| # | Toy | Plays | Speed | Reaction | Error |
|---|---|---|---|---|---|
| 1 | Sprocket, the tin robot | only flat drives, never hops | 0.74 | 0.36 s | 1.55 |
| 2 | Ribbit, the wind-up frog | hops and smashes anything high | 0.86 | 0.31 s | 1.42 |
| 3 | Dabble, the tin duck | lives at the net, drops short | 0.88 | 0.30 s | 1.45 |
| 4 | Topsy, the spinning-top acrobat | a bit of everything | 1.04 | 0.25 s | 1.20 |
| 5 | Sir Clank, the tin knight | keen to hop, a 12% heavier smash | 0.88 | 0.19 s | 0.92 |
| 6 | Waddle, the tin penguin | quick, deep and steady, rarely smashes | 1.10 | 0.19 s | 0.76 |
| 7 | Old Humbert, the music-box bear | best of three, aims best | 1.00 | 0.17 s | 0.78 |

The AI reads a shot after its reaction delay with a perception error, scans the predicted flight for a spot it can reach standing or on a hop, scores the options by its style, runs there and presses swing at its own slightly noisy strike moment, aiming away from you as well as its `smart` lets it.

## Modes, medals and unlocks

- **The Clockwork Cup**: the seven toys in order, each win opening the next. Three medals a toy: the win, winning without your key running out, and winning by five or more points across the match.
- **Courts**: the toyshop tin court from the start; the biscuit-tin court after two ladder wins, the music-box court after five and the toy-train court for winning the cup.
- **Doubles**: opens after four ladder wins. Dora and Enzo (the computer plays your partner) against Sprocket & Dabble, Ribbit & Topsy, and Sir Clank & Old Humbert.
- **Dora vs Enzo**: two players on one keyboard, best of one game.
- **The ending**: winning the cup leads to the dawn painting.

The save, `windup-rally-v1`, holds the medals per toy, the doubles pairs beaten, the chosen court and chinchilla, and whether the tutorial is done. A corrupt or unknown save loads as a fresh one.

## Bot results

`npm run bot:rally` plays each toy with a competent bot (the AI's planner with a partner-level style for the chinchilla), a button-masher and a bot that stands still, then the doubles pairs. Full run, 01-11-2026:

| Toy | Competent win | Key medal | Margin medal | Median rally | Longest |
|---|---|---|---|---|---|
| Sprocket | 100% | 100% | 100% | 5 | 27 |
| Ribbit | 100% | 58% | 93% | 8 | 54 |
| Dabble | 82% | 73% | 43% | 11 | 56 |
| Topsy | 85% | 48% | 53% | 11 | 57 |
| Sir Clank | 78% | 52% | 37% | 11 | 56 |
| Waddle | 63% | 20% | 25% | 11 | 56 |
| Old Humbert | 50% | 8% | 27% | 13 | 65 |

Against every toy, none of the competent bot's points end on the first hit. The button-masher beats Sprocket 88% of the time and no one else; standing still loses every match. In doubles, with the computer playing both chinchillas, they beat Sprocket & Dabble and Ribbit & Topsy every time (median rallies 15 and 30 hits) and Sir Clank & Old Humbert 56% of the time (29).

The bot fails if a competent win rate drops below its floor (Sprocket 92%, Ribbit 88%, Dabble and Topsy 62%, Sir Clank 60%, Waddle 45%, Old Humbert 25%), if the masher beats anyone past Sprocket, or if standing still wins anything.
