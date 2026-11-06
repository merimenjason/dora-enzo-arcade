# Snow Day League

Game 91, `/league`. A cosy snowball team manager. Dora and Enzo coach the Burrow Snowcats, a squad of Andean neighbours (a vizcacha, a guanaco, a pudú, a culpeo fox, a spectacled bear, a mara and an alpaca), against seven rival teams of Andean animals. Each week you do one job in the office, draft five players against the rival coach with bans and counter-picks on a felt table, then watch the snowball fight play itself and shout from the bench once each half. Seven league weeks, then the top four play semis and a cup final; between seasons players age and grow, veterans retire, a rookie joins and the rivals sign stars. Dora and Enzo are coaches, not players. Built on 06-11-2026 from the paper cut-out mock-ups `tm-office`, `tm-draft`, `tm-match` and `tm-trophy`.

## Files

| File | What it is |
|---|---|
| `lib/league-game.ts` | The engine: deterministic from a seed, no DOM. Players, roles and personalities; the eight teams and their coaches; the 30-tick match (movement, throws, lobs, walls, digging, medics, specials, forts, momentum, phases, weather, the rival coach's shouts, the ticker lines); the draft (order, legality, the Hint, Auto-draft, the rival coaches' habits); the week's jobs; the season (round robin, table, semis, final, rollover); the save; the bot managers. |
| `lib/league-scene.ts` | Canvas 2D at 480 × 270, scaled up with nearest-neighbour: the forest clearing, the crowd with team-colour banners, a snow-brick castle at each end built cube by cube (it cracks, loses cubes and piles up rubble as its blocks go), the players with soft shadows (seven-frame sprite strips recoloured per team, with each player's own look), builders' brick barricades, snowballs, weather, the bench with portraits and cooldown rings, hit flashes, screen shake and confetti. |
| `app/league/page.tsx` | The screens (title, office, draft, match, result, season's end, how to play, settings), the match's score bar (forts, KOs, momentum, players up, the clock), the match loop at 1×, 2×, 4× with hit-stop and slow motion for the last moment, the camera that follows the action on an upright phone, the replay of the deciding moment, the fort graph, the photo wall and the office's parallax, Enzo's first-week notes, the save, and `window.__league()` with `debug` helpers for the browser tests. |
| `app/league/sound.ts` | Synthesised effects (card flick, ban stamp, cork pin, whoosh, thud, KO pop, crumbling blocks, flag fall, cheer, groan, coach's whistle, surge, coins) and five original chiptune loops (office, draft, match, cup final, victory). |
| `app/league/league.css` | The paper look (prefix `lg-`): torn trading cards with brass pins, the corkboard, newspaper clippings, felt, stamps and the deal animation; layouts for desktop, phones held sideways and upright. |
| `public/art/league/` | Sprite strips, faces, portraits, icons, props and paintings (see **Art**). |
| `scripts/league-art.py` | Turns the Codex paintings into the files above. |
| `tests/league.mjs`, `tests/league-bot.mjs`, `tests/e2e/league.mjs` | Engine checks, the bots (`--quick` for a short run), the browser suite. |

## Players

- **Roles and the counter wheel.** Builders' walls stop throwers; scouts lob over builders' walls; diggers bury scouts; throwers out-range diggers. Medics are neutral and revive and heal. A counter hit does 2.3× damage, and a counter takes 0.5× from what it beats. In single-role tests (four of a role and a medic against four of the role it beats) each counter wins at least 85% of the time.
  - **Thrower:** the longest reach (250 to lob at a fort). Special: Big Snowball.
  - **Digger:** buries anyone close (a scout from further off, and for longest) and flicks snow at scouts from 92 away. Special: Tunnel Dash, which tunnels under the nearest scout (within 170) to bury them, or otherwise pops up under their fort.
  - **Builder:** pushes a shield wall that follows them and blocks straight throws, and repairs the fort. Special: Igloo Wall.
  - **Scout:** fast; lobs over walls. Special: Spin Throw.
  - **Medic:** heals and revives. Special: Cocoa Break.
- **Stats:** aim, speed and grit, 1–10. Grit is health; builders get extra.
- **Morale (0–100):** scales how well a player plays (0.86× to 1.14×). Winning raises it; the bench lowers it, depending on personality.
- **Personalities**, all visible in the match and the ticker:
  - **Hothead:** big swings, both ways.
  - **Steady:** half the swings and never below 40.
  - **Shy:** hangs back, and likes the bench and rest days.
  - **Show-off:** specials come faster, they cheer after KOs, and get grumpy on the bench.
  - **Cheery:** lifts everyone's morale each week.
- **Names:** every player in a league has their own name: our squad, the rivals, the village loans and the free agents, including rookies and the rivals' new stars after each rollover.
- **Age** (seasons played): young players grow each rollover; from age 9 a stat slips; one veteran aged 8+ may retire (a goodbye card).

## The week

One job a week in the office:

- **Train:** +1 to a stat, +4 morale for that player. It opens a training sheet with one row per player: tap a stat to see the step it makes (for example 6 → 7), then confirm.
- **Scout:** the next rival's likely ban, best players and tactic, plus a momentum head start (45 of the 100 for a surge).
- **Rest:** +14 morale for everyone, +20 for shy players.
- **Sign:** buy one of three free agents (one is a star); a full squad of 9 has to let someone go. The squad is 6–9. Tapping a free agent opens a signing sheet: the price, your coins before and after, who already plays that role, and, with a full squad, who leaves. When you can't sign (the week's job is used, too few coins, nobody chosen to leave), the sheet says why.

You can also skip the job. Then comes the draft. Pay is 45 coins for a win, 25 for a draw and 15 for a loss (×1.5 in a semi, ×2 in the final), plus 15 sponsor coins a week.

Weather changes week by week and shows in the office window and the arena:

- clear;
- snow (slower, softer);
- wind (blows throws one way);
- fog (shorter range).

## The draft

Fourteen moves, played out on the felt table:

1. Each side bans one card.
2. Five picks go A, B, B, A, A.
3. Each side makes one more ban.
4. The last five picks go B, B, A, A, B.

The home side goes first. You pick from your own squad or the four **village loans** in the middle (either side can take one). You ban from their squad or the loans. Banned and picked cards can't be picked again. The rival coach plays by their habit (each one likes certain roles and has a favourite ban), and their portrait reaches in for the card they're about to take.

The cards on the table are compact (portrait, role badge, rating, name) so all three groups fit on any screen. Tap a card to see it in full (stats, counters, special, personality, and the Hint's reason if it is the Hint's card) with a **Ban** or **Pick** button; a second tap on the same card does the same. While the rival coach chooses, their side of the table glows and their portrait reaches in for the card; picked cards wear a tick in their team's colour.

The **Hint** (on by default) glows on a good card and says why in a sentence; its **Do it** button acts at once. **Auto-draft** plays the rest of your moves as the Hint would. After the draft, choose a plan:

- Balanced;
- All-out attack;
- Guard the fort.

A star marks the suggested plan.

## The match

- 90 seconds at 30 ticks a second on a 400 × 150 field, five a side.
- Each fort is 16 blocks of 25 hp with the flag on the last. Knock every block out and the flag falls: an instant win. Every KO also knocks 10 hp off the victim's fort.
- At time-up the fort with more left wins. Level forts go to the side with more KOs; if that is level too, a league match is a draw and a knockout match is settled by a coin toss.
- **Phases:**
  1. The opening scramble (0–15 s).
  2. Fort pressure (15–60 s): the front line moves up and long-range fort lobs grow.
  3. Comeback time (60–78 s): the trailing side gets a bonus.
  4. Final seconds: clutch play, and slow motion when a fort is about to fall or in the last second.
- **Momentum:** KOs and knocked blocks fill the momentum bar; when it is full the team surges, playing at their best for 6 s.
- **Shouts:** once each half, one at a time, each lasting 12 s.
  - **All attack:** everyone pushes forward.
  - **Hold the walls:** stay home and repair.
  - **Protect…:** guard one player.

  Rival coaches shout on their own. With the Hint on, the right button glows and the reason shows under the pitch.
- **Kick-off:** each side lines up in a chevron, front-liners in the middle (builder, then digger, scout), throwers and medics on the back wings.
- **The score bar** above the pitch shows, for each side: players up (five pips), the fort (blocks standing out of 16, and a bar), KOs and momentum, with the clock in the middle; every part explains itself on hover.
- **Speed and the ticker:** 1×, 2× or 4× (Space cycles), pause, and skip. The ticker under the pitch tells the story; the newest line is on top.
- **On a phone held sideways** the shouts and speed buttons stand in a column beside the pitch so it can use the full height, and the score bar drops the team names (the colour dot stays), the pips and momentum.
- **On an upright phone** the pitch is cropped to 4:3 and the camera follows the middle of the action, with a gentle hint to turn sideways.
- **After the match:**
  - the player of the match;
  - a graph of both forts over the match;
  - how often the lead changed hands (a lead counts once it is more than 3% of a fort, so tiny wobbles don't);
  - each player's KOs, Outs (times knocked out), Blocks (fort blocks knocked out), Hearts (health given back to teammates; a heart is 25 health) and Saves (snowballs stopped by their wall), each column explained on hover;
  - morale changes, coins, and the rival coach's handshake line;
  - a replay of the deciding moment (the last lead change or the flag), re-simulated from the seed and the recorded shouts in slow motion.

## The season

- Eight teams, a seven-week round robin with the circle method, then the top four play semis (1st v 4th, 2nd v 3rd) and the winners play the cup final.
- A loss by a close margin makes the next meeting a **grudge match** (a momentum head start). Every meeting with the alpacas, the neighbouring burrow, is the **derby**.
- The season's end shows the trophy painting (or the cocoa-by-the-campfire painting), the final table place, the squad star, the trophy shelf and any goodbye card.
- **Next season:**
  - everyone ages;
  - a rookie joins;
  - each rival signs a star in place of their weakest player and grows;
  - a new calendar is drawn.

Trophies stay on the office shelf.

The rival coaches:

| Team | Coach | Habit |
|---|---|---|
| Lagoon Flamingos | Coach Rosada | bans the thrower |
| Pampa Armadillos | Coach Tatu | likes builders, guards |
| Peak Condors | Coach Kuntur | likes throwers, bans the builder |
| Valley Alpacas (the derby) | Coach Lanita | likes medics |
| Steppe Rheas | Coach Ñandú | likes scouts, pushes, bans the digger |
| Salt Flat Vicuñas | Coach Wari | likes diggers, pushes, bans the medic |
| Shadow Cats | Coach Osqollo | the strongest (5.8 against the others' 4.7–5.3); drafts the counter to your picks |

The league schedule runs from the gentlest rivals to the hardest (`EASE` in the engine): the Armadillos, Rheas and Vicuñas first in a shuffled order, then the Flamingos and Condors, then the Alpacas, and the Shadow Cats always last. In a new save's first season the rivals start `ROOKIE` (0.8) below their strength; the stars they sign for later seasons come at full strength.

## Enzo's notes

In the first week Enzo explains the office, the draft and the match in a slim note that sits in the page's flow (at the top of the corkboard, under the draft header, and in the ticker's place under the pitch), so it never covers a button or a card. **Got it** puts it away; the settings turn the notes back on.

## Controls

Mouse or touch for everything. Number keys pick (or ban) the numbered card in the draft at once; Enter confirms (the card you tapped, to the draft, kick off, back to the office); Space cycles the match speed; Escape closes a card, pauses, or closes a sheet.

## Saving

`localStorage` key `snow-day-league-v1`: the whole league (seed, season, week, coins, squad, rivals, fixtures, table, trophies, photos, history, news, settings, Enzo's notes). A save that doesn't parse starts a fresh league; an older save without photos starts with an empty wall.

## The office

The office painting drifts behind the paper panels as the mouse moves (the photos on the wall drift a little more), the window shows the week's weather (falling snow in snow and wind), the desk lamp glows, and the trophy shelf fills up. Every win pins a photo of the player of the match on the wall above Dora (the last three) and in the **Photos** tab (the last 24, with the score and the occasion: a win, the derby, a semi-final, the cup).

## Balance and the bots

`node tests/league-bot.mjs` (or `--quick`). Its targets, with the numbers from the full run on 06-11-2026 (after the polish pass):

| Target | Result |
|---|---|
| Matches last a median of 60–100 s | 82 s |
| Leads change hands (by more than 3% of a fort) | in 62 of 120 matches |
| Comebacks happen | 19 of 120 |
| Fewer than 10% of matches are decided in 20 s | none |
| Fewer than 10% of matches end untouched | none |
| With equal squads, the counter drafter and the Hint drafter each beat a random drafter at least 75% of the time | 80% and 80% |
| Casual (Hint) manager, season 1: semis ≥60% and the cup ≥25% | semis 98%, cup 85% |
| Season 2 is tougher | cup 53% |
| Pro manager wins the season-1 cup ≥65% | 80% |
| Random managers rarely win the cup (≤10%) | random: semis 47%, cup 10%; idle: semis 33%, cup 7% |
| A human-paced manager (the Hint draft half the time, a shout every 12 s) wins week one ≥55% and reaches the semis ≥65% | week one 71%, semis 89% |

The casual and pro bots shout the perfect order twice a second, which no person does, so the human-paced bot is the one that sets the difficulty. Before the change below it won week one 38% of the time and the cup 10%.

`tests/league.mjs` also checks that four diggers and a medic beat four scouts and a medic at least 65% of the time (88% over 40 matches).

The knobs are at the top of the match section of `lib/league-game.ts` (`COUNTER_HIT`, `COUNTER_TAKE`, `DIG_DMG`, `KO_FORT`, the role damage table, fort range and share, repair) and in the team strengths; `tune()` changes them for experiments.

## Art

Codex painted everything from prompts in `jobs.txt` (prefix `lg-`), with the four mock-ups as the reference; `scripts/league-art.py <folder>` keys and snaps it:

- **Sprites:** 4 × 2 sheets per species (idle, run A, run B, throw, special, KO, cheer and a portrait) on magenta, or green for the flamingos. They are keyed, cropped, box-downsampled to each species' height (24–43 px) and palette-snapped. The turquoise scarf is rewritten as a marker colour and recoloured per team at run time, with each player's look (a cream-striped or dotted scarf, darker or lighter fur).
- **Paper portraits:** four looks for every species (a bobble hat and striped scarf, round glasses, ear muffs and a checked scarf, a beanie and a dotted scarf), so every player in a squad is their own individual (`lookOf` picks one from the player's id); Dora, Enzo and each rival coach.
- **Icons** for the roles, personalities and jobs, and pixel icons for the score bar and the stats (fort, KO, momentum, heart, save, block).
- **The snow castle's kit** (a brick cube whole, cracked and chipped, the gate, steps, a wall lantern, rubble, a berry bush), **pixel props, the bench, the crowd and the clearing** (trees, fences, lanterns, paths, drifts, rocks and a frozen puddle).
- **Paintings** for the office, the draft table, the title, the trophy, the season's end and the cup final, and the office window in four weathers.

No text is painted into any picture; all words are HTML.
