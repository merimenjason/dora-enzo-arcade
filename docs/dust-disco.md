# Dust Disco

Game 43, at `/disco`. A four-lane rhythm game: dust bunnies roll down four lanes, and you press each lane as its bunny reaches the pad, on the beat of twelve original songs. Dora and Enzo dance either side of the lanes in painted poses (a bop and a step in turn, a point on each bar's last beat, a leap on big hits and in Dust Up, a wobble after a miss; the drawn chinchillas stand in until the paintings load), and a painted front row of six chinchilla friends sways along, each throwing their paws up in turn and all of them cheering in Dust Up.

## Files

| Part | File |
| --- | --- |
| Engine: songs, composing, charts, judging, saving | `lib/disco-game.ts` |
| Scene: venue, lights, disco ball, dancers, crowd, notes and bursts (Canvas 2D) | `lib/disco-scene.ts` |
| Sound: the band that renders each song ahead of time, and the little effects | `app/disco/sound.ts` |
| Page: song list, settings, calibration, play, pause, results | `app/disco/page.tsx`, `app/disco/disco.css` |
| Paintings: the title, twelve venues, and Dora and Enzo's five dance poses each (`dancer-<id>-<pose>.webp`, with foot positions in `dancers.json`), and six front-row friends seen from behind, swaying or cheering (`crowd-f<1-6>-<bob|cheer>.webp`) | `public/art/disco/`, described in [`dust-disco-art.md`](dust-disco-art.md) |
| Tests | `tests/disco.mjs`, `tests/disco-bot.mjs`, `tests/e2e/disco.mjs` |

## Songs

Every song is written in `SONGS` as data: a tempo, a key and mode, a lead sound, a form (intro, verses, choruses, a bridge, an outro) and, per section, chords, melody phrases, one bar of drums and one bar of bass. `compose()` turns that into the music (lead, chorus bells, pad chords, bass, kick, snare, claps and hats, with a snare roll into each new section) and into the cues the charts are picked from. The music and the charts come from the same data, so every note on screen is a note you hear.

| # | Song | Venue | BPM | Length | Notes (easy / normal / hard) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Burrow Bop** | The Home Burrow | 96 | 1:42 | 134 / 191 / 310 |
| 2 | **Hay Loft Hop** | The Hay Loft | 112 (swung) | 1:57 | 107 / 271 / 432 |
| 3 | **Moonpond Waltz** | The Lily Pond | 132 (3/4) | 1:18 | 64 / 162 / 259 |
| 4 | **Pebble Street Funk** | The Night Market | 104 | 2:06 | 139 / 292 / 527 |
| 5 | **Snowpeak Gallop** | The Snowy Summit | 140 | 1:48 | 123 / 261 / 485 |
| 6 | **Dust Storm Disco** | The Grand Dust Hall | 124 | 2:05 | 127 / 299 / 527 |
| 7 | **Pebble Beach Sway** | The Pebble Beach | 100 | 1:52 | 142 / 168 / 336 |
| 8 | **Lantern Lullaby** | The Lantern Garden | 96 | 1:42 | 142 / 209 / 286 |
| 9 | **Clover Reel** | The Clover Fair | 138 | 1:49 | 117 / 325 / 461 |
| 10 | **Raindrop Bossa** | The Raindrop Café | 112 | 1:57 | 107 / 238 / 478 |
| 11 | **Thunder Peak Rock** | Thunder Peak | 152 | 1:39 | 113 / 214 / 421 |
| 12 | **Encore!** | The Starlight Stage | 128 | 2:01 | 127 / 314 / 502 |

The second six are a laid-back reggae sway with the beat dropping on three, a music-box lullaby, a running reel, a bossa nova with notes off the beat, a fast rock song, and **Encore!**, the finale, which brings Burrow Bop's tune back as a disco anthem.

## Charts

`chart(song, diff)` picks notes from the cues:

- **Melody notes** come first and follow the tune: within each phrase the lowest pitch sits on the left lane and the highest on the right, the same pitch again stays in its lane, and a step up or down always moves.
- **Drums fill the rests**: kicks on the inner left lanes and snares on the inner right, swapping sides every other bar; on Hard the off-beat hats also play on the outside lanes.
- **Long notes become holds**: 2 beats or longer on Easy, 1.5 on Normal and Hard.
- **Chords** (two notes at once) land on the downbeats of the chorus: every other bar on Normal, every bar on Hard, never on Easy.

| | Easy | Normal | Hard |
| --- | --- | --- | --- |
| Melody grid | beats | 8ths | 16ths |
| Closest notes | 0.55 s or a beat | 0.2 s or half a beat | 0.12 s or a quarter beat |
| Same lane again after | 0.5 s | 0.3 s | 0.17 s |
| Press while holding | no | no | yes |
| Groove lost on a miss | 5 | 7 | 8 |

The tests check every chart for these spacings, that every lane gets at least a tenth of the notes, and that Easy is sparser than Normal and Normal than Hard on every song.

## Judging and scoring

| Press | Window | Points | Groove | Sparkle |
| --- | --- | --- | --- | --- |
| Perfect | ±45 ms | 100 | +2 | +4 |
| Great | ±90 ms | 70 | +1.5 | +2 |
| Good | ±135 ms | 40 | +0.5 | +1 |
| Miss | later, or pressed 135 to 200 ms early | 0 | −5 / −7 / −8 | |
| Hold kept to the end | let go no more than 90 ms early | 100 | +1 | |
| Hold dropped | | 0 | −5 | |
| Stray press (no note within 0.2 s) | | | −2 | |

- **Combo multiplier:** points are multiplied by 1, then 2 from a 20 combo, 3 from 40 and 4 from 60. A miss or a dropped hold resets the combo.
- **Groove** starts at 50 of 100. If it empties the song stops, unless **Never fail** is on in Settings.
- **Dust Up:** hits fill the sparkle meter. From half full, Space (or the Dust Up button) spends it to double all points for up to 16 beats, depending on how full it was. The lanes, lights and dancers go wild while it lasts.
- **Accuracy** counts every note head and every hold tail. A clear grades **S** from 95%, **A** from 88%, **B** from 78%, **C** from 65%, then **D**. A clear earns one star, an A two and an S three. Full combo (no misses or drops) and all perfect are marked on the song list.

## Music and timing

`app/disco/sound.ts` renders each song once into an audio buffer with an `OfflineAudioContext`: mono, at 24 kHz, with the drums rendered once as samples and a light echo instead of a reverb. That keeps playing a song down to one buffer source, which matters on slow machines. The chosen song starts rendering as soon as the page loads or a song is picked (a song takes a few seconds on a slow machine), and "Tuning up the band…" shows if it is not ready when you press Dance.

The game's clock is the audio clock, minus the speakers' output latency and the player's timing offset, and key and touch presses are dated by their event timestamps. Pausing suspends the audio context, which stops that clock too. **Find my timing** in Settings plays twelve clicks; the average of the middle four of your first eight taps becomes the offset.

## Progress

Saved in `localStorage` under `dust-disco-v1`: the best score, accuracy, grade, stars, full combo and all-perfect marks for each song and difficulty, play counts, and the settings (note speed 1 to 10, timing offset, never fail, step sounds) and the last song and difficulty. Each song opens once the one before it is cleared on any difficulty; every difficulty of an open song is playable. Sound on or off is kept under `dust-disco-sound-v1`.

## Tests

- `tests/disco.mjs`: songs and their sections are well formed, compose and chart are cached and ordered, every chart's spacing and lanes, the timing windows, strays, misses, holds kept and dropped, the multiplier, grades, a perfect run scoring an all-perfect S, Dust Up doubling, failing by standing still or mashing, never fail, unlocking and the save.
- `tests/disco-bot.mjs`: a steady player (timing spread 35 ms, forgets 1% of notes) clears all thirty-six charts at 85% accuracy or better, and a shaky one (70 ms, forgets 5%) clears every Easy and Normal chart. Runs replay exactly from a seed.
- `tests/e2e/disco.mjs`: the arcade card, the song list and saved settings, playing by key presses, pausing, the results and save, and the phone layout with a lane tap.
