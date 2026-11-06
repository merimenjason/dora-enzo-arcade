# Rulebook FC

Game 89, `/rulebook`. A turn-based football roguelite where you rewrite the laws of the game. Dora, Enzo, Pip and Bram (with Tuft in goal) play a ten-match season against the animal league, with the Grumble Galacticos as the boss and a Grumble rematch to finish. The other side's next moves are always on the pitch before you move, so every turn is a small puzzle. Win a match and Enzo lets you write one of three new laws of football into the rulebook for the rest of the season; every team you meet brings a law of its own, and that stays too. It was built on 06-11-2026 from the football roguelite mock-ups, on the shared turn-based engine `lib/tactics-football.ts`.

## Files

| File | What it is |
|---|---|
| `lib/tactics-football.ts` | The shared turn-based football engine, with no DOM and its API at the top: the 15 by 9 board, moves, ground and lofted passes, shots and keepers, tackles, the other side's plan (shown before we move) and how it resolves, undo, hints, and hooks for a game's own rules. How a team plays is a `Level`, so other games can reuse the animal teams. |
| `lib/rulebook-game.ts` | The season: the league table, the 16 gold and 14 purple laws (each one a hook into the engine), the card offers, Red Pen, strikes, Fog, the save. Deterministic from a seed. |
| `lib/rulebook-scene.ts` | Canvas 2D at 384 by 216 (216 by 384 on an upright phone, the board turned a quarter so we attack upward), scaled up with nearest-neighbour: the pitch, the board, the other side's plan, our previews, the players in their own team's sprites, and the playback of each turn at 120 ms a cell. |
| `app/rulebook/page.tsx` | The screens (title, team sheet, match, card table, Red Pen, rulebook, result, how to play, settings), the input, the save, and `window.__rulebook()` with `debug` helpers for the browser tests. |
| `app/rulebook/sound.ts` | Synthesised effects (passes, steps, shots, saves, the post, tackles, the whistle, the crowd, a card being dealt, a law being written and a law struck out) and four original chiptune loops (title, a thoughtful match loop, the card table, ending). |
| `app/rulebook/rulebook.css` | The look: the score bar above the pitch and the explainer and buttons below it, so no words cross a player. |
| `public/art/rulebook/` | The pitch, title, ending, law icons, card backs, hedge, mud, Enzo's card and the referee (see **Art**). The players come from `public/art/kickabout/`. |
| `scripts/rulebook-art.py` | Turns the Codex paintings into the pictures. |
| `tests/tactics-football.mjs`, `tests/rulebook.mjs`, `tests/rulebook-bot.mjs`, `tests/e2e/rulebook.mjs` | Engine checks, season checks, the bots and the browser suite. |

## A turn

- **The board** is 15 columns by 9 rows; the goal mouths are rows 3 to 5. A match is 16 turns. Level at full time, there's a golden turn; still level, it's a draw.
- **Their plan shows first.** A red arrow for each of their moves, red hatching on every cell each one will tackle at End turn, orange hatching on the cells their runners screen off while they attack, and the ball's route in yellow (a pass and the passes they'd switch to if it's cut, a long ball, or shot lines at our goal). A mole's tunnel is a dotted purple arrow. The plan is played out against where we stand, so it updates as we move. Hover (or hold, on a phone) anyone to have it explained.
- **Our ball:** each of ours moves up to 2 cells; the carrier dribbles. With the ball, a ground pass reaches 6 cells and is cut out by anyone standing on its line; a long ball lands 3 to 7 cells away and is won by whoever's next to where it lands; a shot is saved if the keeper covers that row, blocked by anyone on its line, and can't beat the keeper from more than 7 columns out. Up to 4 passes a turn. Every action is previewed (green works, red doesn't, the keeper's covered rows in blue) and played with a second tap.
- **Their ball:** each of ours moves 1 cell. Stand on a yellow line to cut it out, or beside their carrier to tackle him (a tackle beats a dribble; a pass or shot goes first).
- **Keepers** cover 1 row against a shot from 2 columns or closer, 2 from 3 to 5, 3 from further, but never the whole mouth from 5 or closer; a header is harder to save. Outfield players can't stand in the goal columns.
- **Undo** anything until End turn. **Hint** shows a good move: a goal, the most forward safe pass, a step out of the red cells, or the step that does most to stop their attack.

## The league

Easiest first. Every team plays its own way (the `Level` in `TEAMS`):

| Team | Style | Press · lunge | Move (with ball) | Shoots from | Extras |
|---|---|---|---|---|---|
| Rabbit Rangers | Quick: they move 3 cells, but only lunge 1 cell to tackle. | 1 · 1 cell | 3 | 4 | – |
| Frog Wanderers | They love a long ball, and win any lofted pass that lands next to one of them. | 1 · 1 cell | 2 | 4 | aerial |
| Mole Miners | Every other turn one mole tunnels to any free cell within 4 (the dotted arrow). | 1 · 1 cell | 2 | 5 | 1 sweeper, tunnels |
| Otter Athletic | Slick: with the ball they pass twice in one go, and two of them press, lunging up to 2 cells. | 2 · all within 2 | 2 | 5 | 1 sweeper, one-twos |
| Hedgehog Hotspurs | A spiky press: three of them close you down, lunging into every cell up to 4 away. Five on the pitch. | 3 · all within 4 | 2 (3) | 6 | 1 sweeper, +1 player |
| Magpie Rovers | Thieves: they steal any pass that goes past next to a magpie, and their press lunges 4 cells. | 3 · all within 4 | 2 (3) | 6 | 1 sweeper, +1 player, thief |
| Fox Forest | Cunning: they read two passing lanes, lunge from 4 cells away, and break 3 cells at a time with the ball. | 3 · all within 4 | 2 (3) | 7 | 1 sweeper, +1 player |
| Badger Borough | Strong and slow: they move 1 cell, but lunge from 4 away and can’t be tackled from the front. | 3 · all within 4 | 1 | 7 | 1 sweeper, +1 player, no tackles from the front |
| Grumble Galacticos | The boss: six of them, quick, thieving, good in the air and slick on the ball. Everything at once. | 4 · all within 4 | 3 | 7 | 1 sweeper, +2 players, aerial, thief, one-twos |
| Grumble Galacticos (rematch) | The rematch: all of that again, and now they tunnel too. | 4 · all within 4 | 3 | 7 | 1 sweeper, +2 players, aerial, tunnels, thief, one-twos |

## The season

Ten matches. Before each, the team sheet shows the other captain, how they play and the law the referee reads out for them. A win offers three gold laws, a draw two, and a defeat none and a strike; three strikes end the season, and reaching the end of the tenth match wins it. Now and then Red Pen is one of the cards: it strikes out one of their laws. Their first two laws come from the gentle five (marked below).

| Gold law | What it does |
|---|---|
| Woodwork | A shot that hits their post, or a save at a corner of the goal, counts as a goal worth 1. |
| Headers Double | Catch a lofted pass and shoot in the same turn: that’s a header, worth 2. |
| Wide Open | The goal we attack is a row wider. |
| From Distance | We can score from our own half, and those goals are worth 3. |
| Parry Back | When their keeper saves, the ball goes to the nearest red shirt. |
| Late Show | Our goals in the last 3 turns are worth double. |
| Pinball | Ground passes can bank off the side boards, and goals from a banked move are worth double. |
| Sticky Boots | A player who got a pass this turn can only be tackled from right beside him, not by a lunge from further off. |
| Deflections | A shot blocked by one defender goes in off him, if the keeper’s not there. |
| Small Door | Our goal looks tiny from far out: they have to come 2 columns closer to shoot. |
| Kick-off Special | A goal in the turn we kick off is worth double. |
| Bender | A ground pass curls round one defender in its way. |
| Thunder Boots | We can shoot from 2 columns further out, and keepers cover a cell less. |
| Second Wind | Once a turn, one of our players can move twice. |
| Hat-trick | Every third goal we score in a match is worth triple. |
| Red Pen | Strike out one of their laws. |

| Purple law | What it does |
|---|---|
| Closing In | Hedges grow in from both touchlines every 4 turns. |
| Heavy Ball (gentle) | Ground passes reach a cell less every 4 turns. |
| No Back-passes | A pass backwards gives the ball to the other side. |
| Giant Keeper | Their keeper covers a cell more of his goal. |
| Tiny Goal | The goal we attack is a row narrower. |
| Fog | In their half, we can’t see what players more than 3 cells from the ball will do. |
| Wind (gentle) | Lofted passes drift a row with the wind, which changes every turn. |
| One More | They play with one more outfield player. |
| Ice | Anyone who moves 2 cells in a straight line slides a third. |
| Sore Losers | Their goals count double while they’re losing. |
| Mud (gentle) | The middle third is mud: a step there costs two. |
| Bouncy Ball (gentle) | Lofted passes bounce on a cell when they land. |
| Short Matches (gentle) | Matches are 2 turns shorter. |
| Big Net | Our goal is a row wider. |

Some laws touch the same thing, and the rulebook shows a link on both cards:

| Laws | Link |
|---|---|
| Woodwork + Tiny Goal | The woodwork still counts when the goal shrinks. |
| Woodwork + Giant Keeper | A giant keeper saves more shots at the corners: Woodwork counts those. |
| Headers Double + Bouncy Ball | A bouncy ball rolls on to a header. |
| Pinball + Closing In | The hedges are boards too. |
| Wide Open + Tiny Goal | Wide Open and Tiny Goal cancel out. |
| Deflections + One More | One more of them means more deflections. |
| Small Door + Big Net | Small Door keeps their shots close, even at a big net. |
| Bender + No Back-passes | A pass curled round a defender can go backwards. |
| Thunder Boots + Giant Keeper | Thunder Boots take back the giant’s extra cell. |
| Late Show + Short Matches | A short match still has a last 3 turns. |
| Second Wind + Mud | A second move gets through the mud. |

## Controls

Tap or click one of ours to see where he can go, then a cell to move there. With the ball, tap a team-mate to pass, an empty cell further off for a long ball, or their goal to shoot; tap again to play it. With theirs, tap their carrier from beside him to tackle. Enter ends the turn (and skips a playback), Z undoes, H hints, R opens the rulebook, Esc deselects; 1 to 3 pick a card. On a phone held upright the board turns so we attack upward, with cells of 22 css pixels or more.

## Art

Painted with Codex for this game and cut into pixel art by `scripts/rulebook-art.py`: the cage pitch (fitted so its boards sit on the edges of the board), the title (the logo and menu sit in the clear sky on the left), the ending, sixteen gold and fourteen purple law icons, two card backs, a hedge, mud, Enzo holding up a card and the referee. The players, keepers and captains' portraits are the shared animal-league sprites in `public/art/kickabout/`. Lines, hatching, arrows, the goal nets and the confetti are drawn in code.

## Bots

`npm run bot:rulebook` plays 20 seasons (`--quick`) with three players. **pro** searches its ball actions with undo (one pass deep, with a dribble first), then moves support; on defence it steps to cut their route and tackles. **blind** plays the same but takes the first card offered. **random** moves and kicks at random. The checks: the pro averages 6 matches or more, wins more matches and more seasons than blind, wins 10 to 35% of seasons, and random never wins one.

Results on 06-11-2026: pro won 7 of 20 seasons (35%), 8.5 matches and 4.9 wins a season; blind won 4, with 4.2 wins; random won none and was out after 3.1 matches. The first three teams are won every time; the hedgehogs, magpies and foxes are the wall, the badgers mostly end in draws.

## Ideas not done

- More gold laws that change how we attack (most of the big ones are about scoring more per goal).
- A gentler ramp between the otters and the hedgehogs.
- Combo Ball reusing the animal teams' `Level` styles.
