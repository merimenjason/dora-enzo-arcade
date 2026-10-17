# Whisker Ware

Route `/whisker-ware`. A microgame frenzy in the manner of WarioWare. A command word flashes up, a fuse burns along the bottom, and you have about five seconds to do what it says. Then a short break in the host's room, and the next game, a little faster. Design: [`superpowers/specs/17-10-2026-whisker-ware-design.md`](superpowers/specs/17-10-2026-whisker-ware-design.md); art: [`whisker-ware-art.md`](whisker-ware-art.md).

## The code

- `lib/whisker-ware-micro.ts`: the 24 microgames. Each is a deterministic engine with `init(rand, level)`, `tick(state, input)` and `outcome(state)`, driven by a seeded `Rand`.
- `lib/whisker-ware-game.ts` has the engine core:
  - `Pad` turns raw frames (pointer, Space, arrows, 1–3) into presses, releases, swipes, rubs and steering;
  - `Clock` runs a game's ticks faster at higher speeds;
  - `Run` covers stages, Remix and Practice;
  - the saved profile.
- `lib/whisker-ware-scene.ts` draws the host's room and every game on a 480 × 320 stage.
- `app/whisker-ware/page.tsx` runs the loop, input, sound and saving.

## Hosts and games

Each microgame lasts 300 ticks (five seconds at ×1.0); a boss lasts 900. A *survive* game is won by lasting to the end; every other game is lost when the fuse runs out. Numbers are for levels 1 / 2 / 3.

| Host | Command | Input | To win |
| --- | --- | --- | --- |
| Enzo | STUFF! | mash | Press 14 / 18 / 22 times to fill Enzo's cheeks. |
| Enzo | CATCH! | steer | Catch 1 / 2 / 3 raisins in the bowl and let every pebble fall. Layouts are checked to be catchable by a player who needs 30 ticks to react. |
| Enzo | SORT! | swipe | Send 3 / 4 / 5 items one at a time: acorns right, pebbles left. One wrong way loses. |
| Enzo | SNIFF! | pick | Watch the raisin go under a cup, follow 3 / 5 / 7 swaps, then pick its cup. |
| Enzo | GNAW! | timing | Bite as the stick's notch passes Enzo's tooth. The window is 48 / 36 / 28 units, crossed in 24 / 18 / 14 ticks. |
| Enzo | RAISIN RAIN! (boss) | steer | Catch 8 raisins from three chutes before 3 pebbles land in the bowl. The rain speeds up over 600 ticks. |
| Dora | DUST! | rub | Rub back and forth 12 / 16 / 20 times. |
| Dora | BALANCE! (survive) | steer | Keep Dora upright on the log. She leans further every tick and gusts push harder by level. |
| Dora | FLUFF! | hold | Hold to puff Dora up and let go inside the band, which is 0.2 / 0.14 / 0.09 wide. |
| Dora | HOP! | timing | Jump 1 / 2 / 3 rolling logs. |
| Dora | COMB! | drag | Comb out 3 / 4 / 5 tangles. |
| Dora | CLIMB! (boss) | timing | Hop up 8 sliding shelves; a miss drops one. The shelves are ×1 / ×1.12 / ×1.25 faster. |
| Owl | SNEAK! | hold | Walk only while the Owl's back is turned. A glance warns before she looks, lasting 24 / 18 / 12 ticks. |
| Owl | HIDE! (survive) | steer | Get Enzo into the shadow before the searchlight sweeps past. The shadow is 110 / 80 / 56 wide. |
| Owl | HUSH! | pick | Tap each squeaking toy (3 / 4 / 5) within 72 ticks, or the Owl wakes. |
| Owl | FIND! | steer | Point the lantern in the dark and dig up the acorn. Digging up one of the 0 / 1 / 2 pinecones loses. |
| Owl | DODGE! (survive) | steer | Keep Dora clear of the swaying feathers. They fall at 2.0 / 2.4 / 2.8, a new one every 30 / 26 / 22 ticks, and every third is aimed at her. |
| Owl | DASH! (boss) | timing | Run to the flag, jumping gaps and swooping owls: 5 / 8 / 11 of them. |
| Fox | PICK! | pick | See the cards face up, follow 0 / 1 / 2 swaps, then pick the card with the Fox's suit. |
| Fox | POP! | pick | Pop all 4 / 5 / 6 balloons before any floats away. |
| Fox | AIM! | hold | Let go of the slingshot with the power in the band, which is 0.24 / 0.18 / 0.13 wide. Holding Space swings the power up and down; a drag from the slingshot sets it by distance. At level 3 the target bobs. |
| Fox | STACK! | timing | Drop 2 / 3 / 4 crates from the swinging crane so each lands at least 60% on the one below. |
| Fox | COUNT! | pick | Count 3–5 / 5–8 / 7–11 acorns in a short flash and pick the right number. |
| Fox | TOSS! (boss) | timing | Ring 5 pegs with 8 rings. The pegs speed up over the game and are ×1 / ×1.15 / ×1.3 faster by level. |

## Pacing

- Speeds are ×1.0, ×1.15, ×1.3, ×1.5, ×1.75 and ×2.0 (tiers 0–5).
- A break in the host's room lasts 90 ticks (60 at tier 4 and up), plus 45 when it shows a SPEED UP or BOSS card.
- A decided game holds its result for 30 ticks before the break.
- **Host stages.** Eight of the host's five games (each at least once, never the same twice running), then the boss. Games 1–4 and games 5–8 with the boss run at these tiers:

  | Stage | Games 1–4 | Games 5–8 and boss | Level |
  | --- | --- | --- | --- |
  | Enzo | 0 | 1 | 1 |
  | Dora | 1 | 2 | 1 |
  | Owl | 2 | 3 | 2 |
  | Fox | 3 | 4 | 2 |

  Four lives:
  - a lost game costs one and play moves on;
  - a lost boss costs one and is played again;
  - beating the boss clears the stage and opens the next.
- **Remix** opens once all four stages are cleared.
  - It mixes the twenty ordinary games, never the same twice running.
  - The tier rises every five wins, up to ×2.0.
  - A boss comes after every ten wins, cycling Enzo, Dora, Owl, Fox; beating one raises the level, up to 3.
  - The score is the number of games won before the four lives run out.
- **Practice** plays one game you have won, alone, on one life. The tier rises every three wins and the level every six.

## Saving

The profile is saved under `whisker-ware-v1` when a run ends, when you go back to the menu and when you leave the page. It holds:
- stages cleared;
- the best Remix score;
- per game, the best tier won at and the best Practice streak.

A malformed save loads as a fresh profile, and unknown games are dropped. Sound on or off is kept under `whisker-ware-sound-v1`.

## Balance · 18-10-2026

`npm run bot:whisker-ware` plays each stage and Remix 300 times through the test solvers with human timing:
- games that are anticipated land within 5 ticks of the right moment;
- reactions see the game 10–20 ticks late;
- one game in 25 is fumbled.

It gates:
- Enzo's stage cleared ≥ 85%;
- the Fox's stage cleared ≥ 50%;
- no stage easier than the one before (within 2 points);
- a Remix median of 20–45.

At the time of writing it measures:
- Enzo 100%, Dora 100%, the Owl 100% and the Fox 98%;
- a Remix median of 31 (quartiles 27–38).

The stages are generous on purpose: four lives and a boss retried until beaten. The challenge is in Remix, where CATCH!, DODGE!, AIM!, BALANCE! and the bosses at level 3 and ×1.75 or more lose a third to most of the time. `WARE_BOT_DETAIL=1` breaks the loss table down by level and tier.

The first bot run found several games that could not be won with human reaction times:
- DODGE! lost every time;
- BALANCE! lost 60% at level 1;
- GNAW! lost about 40%.

Drift, windows and spacing were widened until a quarter-second reaction is enough.

## Art and sound

Every backdrop, host and prop is painted. The 28 opaque environments are WebP and the sprite sheets and title are PNG, loaded lazily:
- the menu loads the title and hosts;
- choosing a stage loads that host's room and props;
- each break loads the next game's backdrop.

Anything not yet loaded, or failed, is drawn in code instead, and a **Retry art** button appears after a failure. Sound is synthesised WebAudio blips (`app/whisker-ware/sound.ts`) with no files.
