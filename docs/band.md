# Woodland Band

A music-making toy and puzzle game at `/band`, in a new mid-century cartoon art style. Dora and Enzo lead a woodland band that plays the clearings of the forest. The stage is a grid of beat columns by musician rows; each musician plays their own row round and round, and together they make a song. Paint notes on the rows, and play each clearing's audience what they ask for: hum a tune back, play a mood, fix a muddled part, or make do with only three musicians.

All numbers below come from `lib/band-game.ts`, `lib/band-levels.ts`, `lib/band-scene.ts`, `app/band/sound.ts` and `app/band/page.tsx`. Written 01-11-2026.

## Files

- `lib/band-game.ts`: the rules, deterministic and DOM-free: the cast, the keys and scales, notes snapping into the scale, songs and editing, counting changes, every rule a request can ask for and how close a song is to it, echo matching, judging a request, stars, share codes and the save.
- `lib/band-levels.ts`: the five clearings and their thirty requests (starting song, cast, rules, flourish, par and a designed solution), unlocking and progress.
- `lib/band-scene.ts`: the drawing (Canvas 2D): the clearings, the stage grid, the notes, the playhead, the musicians at their row heads, Dora and Enzo either side, the audience, and the stand-ins for the two paintings. It does not use the shared `drawChinchilla`.
- `app/band/page.tsx`, `band.css`, `sound.ts`, `layout.tsx`: the page (menu, clearings, requests, jam, festival, ending), input, saving and the HUD; the synthesised band and its look-ahead scheduler.
- `tests/band.mjs`, `tests/band-bot.mjs`, `tests/e2e/band.mjs`: engine checks, the solving bot, and the browser suite.
- Paintings in `public/art/band/` (title, festival ending), briefed in [`band-art-brief.md`](band-art-brief.md).

## The stage

- A song has 8 or 16 steps in one bar, a tempo of 60 to 180 beats a minute, a swing (0 to 0.6 of a step, applied to every second step) and a key. Sixteen steps are sixteenth notes; eight steps are eighth notes. The big beats are every quarter of the bar.
- Each musician has one row. A cell is off or holds a pitch index inside the musician's range, counted in steps of the key's scale, so every note is in key: there are no wrong notes. `snapMidi` puts any note on the nearest note of the key (ties go down).
- Up to 6 musicians play at once (fewer in a "only three" request).

| Musician | Plays | Range | Sound |
| --- | --- | --- | --- |
| Hedgehog | drums | kick, snare, hat | a pitched-down sine kick, a noise snare, a short hat |
| Woodpecker | wood blocks | low, middle, high | hollow triangle knocks |
| Frog | double bass | 8 scale steps, two octaves down | a low-passed plucked triangle |
| Mole | tuba | 6 scale steps, an octave down | a soft low-passed sawtooth |
| Owl | flute | 10 scale steps | a breathy sine with vibrato |
| Enzo | glockenspiel | 10 scale steps, an octave up | bell partials |
| Dora | ukulele | chords I, ii, iii, IV, V, vi | a four-string strum of the triad |
| Bird choir | chords | chords I to vi | three "ooh" voices |

The keys: C pentatonic (Mossy Hollow), F major (Riverbank), D dorian (Mushroom Ring), E♭ major (Treetop Stage) and A minor (Moonlight Festival). Chords on a pentatonic tune are built from its major scale.

## Requests

Thirty requests, six in each of five clearings. A request opens when the one before it is played; the jam opens after the second.

- **Echo:** the audience hums a part (the "Hear the tune" button plays it once round, on audience voices: hums, stomps, claps and clicks). The rows to match show dotted rhythm rings on the stage, so the puzzle is the pitch. A part matches only when every cell is the same; extra notes spoil it.
- **Mood:** rules from the request card, each ticked as it is met: tempo, notes per step, how high the tune sits, how wide it spans, how many notes fall between the big beats ("bouncy"), how many musicians play, and who must or must not play.
- **Fix the band:** a muddled part to put right by a rule: a part that lands exactly with another's notes (or only its kicks), two parts that take turns, a part that plays just what another plays, a tune that climbs, or a last note.
- **Only three:** the stage holds three musicians; take one off and still meet the rules.
- A request is solved when every part of it is met; the band plays on to the end of the bar, then the audience cheers.
- The audience reacts live as the song nears the goal (how close it is, from 0 to 1): still, then swaying, then clapping on the beat, then dancing when it is solved. The request card's five starbursts show the same.

### Stars

- ★ solved;
- ★ with par changes or fewer: each cell that differs from the request's starting song is one change, a musician added or taken off is one (plus the notes they bring); tempo, swing and key are free;
- ★ the flourish: one more rule, shown dashed on the card.

Par is set from the bot: a searching solver must reach three stars within par for every request, and par may be at most three more than the fewest changes it finds.

## Controls

- **Mouse or touch:** tap a cell to put a note there (or take it out); drag up or down on a cell to change its note (heard as it changes); drag along a row to paint notes along it (or rub them out, if the first cell had a note). Tap a musician to hear them; the ✕ by their name takes them off; the dashed row (or ➕) adds one.
- **Keyboard:** `Space` play or stop, arrows choose a cell, `Enter` or `X` note on or off, `W` / `S` (or `Shift`+up/down) higher or lower, `H` hear the tune, `A` add a musician, `[` and `]` tempo, `U` or `Ctrl+Z` undo, `?` hint, `Esc` pause.
- The dock: Play / Stop, Hear the tune (echo), the tempo dial where a request lets it turn (and always in the jam), add, undo, hint (a glow on the next cell of the designed solution, or which musician to add or take off), and start over.

## The jam and the festival

- The jam stage has every musician met so far, the key of each open clearing, the tempo dial and a swing switch. Its song is kept in the save.
- Four save slots. Saved songs play at the festival.
- A song shares as a short code (`WB` and base-64 of the steps, key, tempo, swing and each row packed two cells to a byte, with a check byte); pasting a code loads it back, and a mistyped code is refused.
- Solving the last request, The Moonlight Festival, opens the festival: the five clearing finales as you played them, then your saved songs, each for two times round, with the whole wood dancing; then the ending card and the credits.

## Timing and drawing

- The scheduler wakes every 25 ms and books the notes due in the next 120 ms on the audio clock, so playback stays steady while the page draws. Each booked step is queued for the page, which squashes and stretches each musician exactly when their note sounds. Until a browser lets audio start, the page's own clock keeps time.
- Everything is drawn in code: mustard, teal, coral, cream and ink, colour fills printed slightly off their outlines, dry-brush ink, starbursts and boomerangs. Dora (cream, ruby eyes, ukulele) and Enzo (blue-grey, black eyes, glockenspiel) lead from either side on a wide screen, or above the stage on a tall one.

## Save

`localStorage` key `woodland-band-v1`: each request's stars (as bits), fewest changes and the song as a code; the four slots; the jam song; whether the festival has been reached; Sound and Music. Anything odd in a save is dropped, never trusted.
