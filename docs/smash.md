# Fluffball Smash!

Over-the-top anime tennis at `/smash`. Dora and Enzo enter the Cloudtop Cup, the one tennis tournament played on top of the world, and face six rivals in singles and doubles. Charged swings fill a spirit meter, and a full meter unleashes a special move with a painted cut-in.

- Engine: `lib/smash-game.ts` (rules, ball, AI, story, save; deterministic from a seed, no DOM)
- Scene: `lib/smash-models.ts` (toon-shaded players and rivals), `lib/smash-scene.ts` (Three.js courts, ball, effects, camera)
- Page: `app/smash/page.tsx`, with `app/smash/sound.ts` (WebAudio effects and music) and `app/smash/smash.css`
- Art: `public/art/smash/` (title, portraits, cut-ins and the ending, generated to the arcade's no-text art rule)
- Tests: `tests/smash.mjs` (`npm run test:smash`), `tests/smash-bot.mjs` (`npm run bot:smash`), `tests/e2e/smash.mjs`

## The court and the ball

A real-size court in metres: 23.77 m long, 8.23 m wide for singles and 10.97 m for doubles, the net 0.95 m high at the tape (`COURT`). The engine runs at 120 Hz (`DT`). `x` runs across the court, `y` along it (your side is `y < 0`), `z` up.

`stepBall` moves the ball: gravity is stronger with topspin and weaker with slice (`G * (1 + 0.38 * spin)`), a special can add a sideways weave that is zero at both ends of the flight so it still lands on target, and Harbour Court's wind pushes it. A ball crossing below the tape stops in the net on the hitter's side; one that clips the tape pops over, slower. Each surface bounces differently: clay higher and slower, grass lower and faster, hard in between.

`launch` solves the flight time so the ball clears the net by a set margin and lands on the target. Every shot is scattered from its target by the timing, the player's control, running, stretching and (for the AI) its error, so a rushed shot can go out.

## Scoring

Points go 0, 15, 30, 40. At 40-40 (deuce) the next point wins the game (no advantage), which keeps matches short. A match is first to N games (2 for Bramble, 3 for everyone else) with two clear, or the game after N-all. The serve changes every game, from alternate courts each point, into the diagonal box. A serve in the wrong box or long is a fault and two are a double fault; a serve that clips the net and lands in is a let. A ball on the line is in, and the doubles tramlines are in for doubles. Two bounces on a side lose the point.

## Swings, charge and spirit

You press a swing before the ball arrives: **top** (topspin, the all-rounder), **slice** (low and skidding; with ↓ held, a drop shot), **lob** (high and deep). The ball is struck when it reaches you. The earlier you press, the harder the shot: charge is `(contact - press) / 0.9 s`, and power is `0.25 + 0.75 * charge^0.7`. While a swing is readied you move at 45% speed (`CHARGE_MOVE`), so charging early is a trade. A ball above 2.25 m is smashed. The rally speeds up 2% a shot, up to 30%.

Spirit fills from 0 to 100: 2 for a shot plus up to 3 more for a good one, 2 for a serve, 4 for winning a point, 10 for losing one (the comeback rule), and 8 for holding a heavy special (`SPIRIT`). At 100, **Space** (or ★) readies a special instead of a swing; it costs the whole meter and freezes play for 1.25 s while the cut-in shows.

Heavy specials knock back anyone who meets them with a weak swing: you are **blown away** (stunned 1.3 s, the ball loops off) unless you charged at least 55%, which **holds** it, or you **counter** with Space during the cut-in, which costs 50 spirit and returns it hard.

| Special | Who | Heavy | What it does |
|---|---|---|---|
| Moonleap Meteor | Dora | yes | A leaping smash that kicks sideways off the bounce |
| Phantom Page | Enzo | no | Two fake balls fly with the real one, which lands on the line |
| Twin Comet | Dora and Enzo together | yes | Two comets spiral across, then kick sideways |
| Hundred-Step Drop | Bramble | no | A drop shot that hops back towards the net |
| Mirror Volley | Sable and Sorrel | yes | A zigzag through the court |
| Squall Serve | Captain Gale | no | A serve that rides the wind in an S-bend |
| Shell Fortress | Marlow and Fern | no | A shield: their next two returns reach anything |
| Phoenix Blaze | Ember | yes | A fireball that speeds up off the bounce |
| Absolute Zero | Isolde | yes | Skids flat off a frozen court; frost slows your feet for 4 s |

## Footwork and the AI

Every computer player plans an interception from the ball's predicted path (`predict`, `intercept`), readies its swing once it is close to the meeting point, picks a shot (`aiKind`) and aims away from the opponents (`aiAim`). Each rival's `Ai` sets reaction time, error, aim, how early it charges, net play, lobs, drops, slices, how well it reads specials, when it fires its own, how often it counters, and its speed. In doubles only the partner who reaches the ball first goes for it.

**Footwork: Assist** (the default) runs your player to the ball with the same planner whenever you are not steering; **Manual** leaves all the running to you. **Rivals** Easy, Normal and Hard scale the rival's error and reactions.

## The story

Seven matches, each with dialogue before and after (`STORY`):

1. Bramble, a hare who never stops running (singles, Meadow Court, grass)
2. Sable & Sorrel, ferret twins (doubles, Riverside Clay)
3. Captain Gale, a puffin (Enzo plays singles, Harbour Court, hard, windy)
4. Marlow & Fern, old tortoises (doubles, Lantern Garden, clay)
5. Ember, a red panda, last year's champion (singles, you choose Dora or Enzo, Ember Arena)
6. Isolde, a snow leopard (singles, you choose, Cloudtop Court)
7. The final: Ember & Isolde together (doubles, Cloudtop Court)

Winning moves the story on and opens that rival in **Exhibition**, where you pick anyone you have beaten, singles or doubles, any venue.

## Balance

`npm run bot:smash` plays the story team, driven by `BOT` (human-like reactions, aim and charging), against each rival from 32 seeds, and checks each win rate against a band. Measured on 04-11-2026:

| Rival | Bot wins | Minutes per match | Hits per point |
|---|---|---|---|
| Bramble | 100% | 1.8 | 5.0 |
| Sable & Sorrel | 75–83% | 5.1 | 7.5 |
| Captain Gale | 92–94% | 3.4 | 4.3 |
| Marlow & Fern | 58–63% | 6.2 | 11.5 |
| Ember | 50% | 3.5 | 4.3 |
| Isolde | 33–37% | 3.8 | 4.2 |
| Ember & Isolde | 33–34% | 6.1 | 10.3 |

## Save

`localStorage` key `fluffball-smash-v1`: story step, beaten rivals, settings (sound, music, footwork, rival difficulty) and lifetime stats (wins, losses, specials, counters, aces, longest rally). `parseSave` clamps every field and falls back to a new save for anything corrupt.

## Browser hook

`window.__smash()` returns the screen, pause state, save, the current cut-in, banner, result and talk line, the live match, and `debug` helpers: `auto(on)` hands your player to the bot, `ff(secs)` fast-forwards, `meter(v)` sets your spirit.
