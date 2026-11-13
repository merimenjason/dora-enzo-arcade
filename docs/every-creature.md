# Every Creature

Game 100, at `/every-creature`. Chapter One of a shapeshifting adventure: Dora and Enzo walk into a valley, befriend
its animals with a small game each (three hops beside a frog, nudging an upturned tortoise, hide and seek with a fox
kit, catching an otter pup's pebble), and from then on can **become** them. Every screen is a puzzle for a *pair* of
forms: a tortoise ferries a frog over the pike's water, a bird lifts a beetle to a perch on a slick cliff, a shelled
tortoise draws the hawk while a fox digs, an otter dives with a frog on its belly under a log jam. The finale, Storm
Falls, brings every pairing back to free the Storm Heron. Solo (with a partner AI and a partner call), two players on
one keyboard, touch and gamepad; assist is on by default.

Written 13-11-2026. This is a port of the finished standalone prototype (`arcade-protos/creature/`, plain JS) into the
arcade with the same rules, numbers, art and sounds. What changed in the port is listed under
[Changes from the prototype](#changes-from-the-prototype).

## Code layout

| File | What |
|---|---|
| `lib/creature-core.ts` | Forms and their tuning (`F`), who can ride whom (`CARRY`), the types, the seeded random stream, the live game/screen bindings (`G`, `LV`, `SCR`), level geometry (floors, ramps, walls, surfaces), particles, and the queues the page reads (`G.sfx` for sounds, `G.ev` for the event log). |
| `lib/creature-forms.ts` | Heroes: form changes, mounting and carrying, respawns, the hero physics (walk, jump, swim, dive, flap, glide, climb vines and walls), the partner's follow AI and the partner call. |
| `lib/creature-s1.ts` … `creature-s4.ts` | The four screens' rules: level data, animals and threats, puzzles, the stage machine, the idle hint (`hint()`), the ghost demos (`demoPose()`). `creature-s1.ts` also holds the shared screen helpers (`befriend`, `puzzleClick`, `needPair`). |
| `lib/creature-game.ts` | The chapter flow (title → four screens → end card), the fixed 60 Hz `step`, auto-boarding, the demo trigger, the checkpoint helpers, the hero sprite picker and a snapshot. Re-exports the core. |
| `lib/creature-scene.ts` | Drawing only (Canvas 2D): sprites from the painted frames, the camera, heroes, effects, idle key prompts, the HUD, the touch controls, the title, the screen card and the end card. Lays out the hit areas (`UI`) the page tests taps against. |
| `lib/creature-scene-screens.ts` | Each screen's pictures: props behind the heroes, the animals, things in front, Storm Falls' sky, and the glints. |
| `app/every-creature/page.tsx` | Input (keys, touch, gamepads), the loop, the checkpoint save, the sound. |
| `app/every-creature/sound.ts` | WebAudio: a voice for every form, the effects, and a generated tune per screen. |
| `public/art/every-creature/` | 231 WebP frames and `sizes.json` (each frame's size and its sheet). |

The engine has no DOM. Looks-only randomness (spray, mist, the screen shake) uses `Math.random` in the scene, so the
seeded stream is the game's alone and a seed replays a run exactly. `window.__creature()` returns `{ G, SCR, scene,
sound, snap, loaded, mode, opts, begin(cont), toggle(id), setForm, swap, callPartner }` for the browser tests, and
`main[data-ready="true"]` is set once the art has loaded.

## Controls

| | Keys (solo) | Touch | Gamepad |
|---|---|---|---|
| Move | arrows or WASD | the stick (left half) | left stick or d-pad |
| Action: jump, flap, nudge, tug; hold to dig (fox), shell up (tortoise), dive (otter) | Space or Enter | the big ✦ button | A |
| Up: climb a vine or a wall, jump | ↑ or W | stick up | stick up |
| Down: dive (otter), set a carried friend down (bird) | ↓ or S | stick down | stick down |
| Change form | 1 tortoise, 2 frog, 3 bird, 4 beetle, 5 fox, 6 otter, 0 chinchilla (its own number again is back to chinchilla); E / Q cycle | tap a form icon; the form button cycles | X or RB next, LB back |
| Swap heroes | Shift or Tab | the swap button | Y |
| Call the partner (or let a rider off) | C | tap the partner's portrait | B |
| Two players | P | the 2P chip | a second pad steers Enzo |
| Assist, mute | the chips top right; M mutes | the chips | |

Two players on one keyboard: Dora on WASD, Space and 1–6 (E/Q cycle); Enzo on the arrows, Enter (or / or right
Shift) and , / . to cycle. There is no swap or call in two-player. On the title Space or Enter plays (or continues),
N starts a new game; on the end card Space, Enter or R plays again.

A rider steers the pair from its seat: left and right walk the carrier, Space hops off (with a boost off a tortoise,
fox or otter); on an otter Down dives it; carried under a bird, Up flaps and holding Up glides.

## The rules

**Forms.** Every form is a different body ([`F` in creature-core.ts](../lib/creature-core.ts)):

| Form | Size | Walk | Jump | Special |
|---|---|---|---|---|
| Chinchilla | 44×118 | 300 | 640 | climbs vines; sinks on lily pads |
| Tortoise | 120×78 | 150 (swims 170) | none | shell up while Action is held (blocks the pike, the hawk and lightning); carries a chinchilla, frog or beetle |
| Frog | 56×60 | 290 (swims 250) | 930, long jumps keep 360 sideways | stands on lily pads; holds its breath on an otter's dive |
| Bird | 54×70 | 230, 300 in the air | flaps of 520 (455 carrying), six before landing | glides at 90 holding Action or Up; carries a beetle, floating down at 160 |
| Beetle | 60×44 | 235 | 520 | climbs walls at 175, but slides off slick rock (0.5 s grip) |
| Fox | 84×64 | 350 | 720 | digs while Action is held; carries a frog or beetle |
| Otter | 90×50 | 190 (swims 430) | 470 | swims against the current, dives 140–165 deep while Action or Down is held; carries a chinchilla, frog, beetle or fox (only a frog survives the dive) |

A form change needs footing: never in mid-air (it shakes and buzzes), and not on The Lake's thin perch branch. New
forms come from friends; fox and otter icons stay padlocked until their screens.

**Partner.** In solo the other hero follows you within its zone, hops aboard a carrier that comes alongside, grabs a
bird hovering low over it (as a beetle), shells up when a threat locks on it (as a tortoise) and, on Fox Hollow and
Storm Falls, digs on its own at the spot. **C** calls it over: with assist it arrives already in the form that pairs
with yours (tortoise ↔ frog, bird ↔ beetle, fox ↔ tortoise, otter ↔ frog), boarding you if it can ride. It can't reach
a zone you haven't linked yet (the ramp, the tunnel, the vine). Pressing C with a rider aboard lets it off.

**The Lake.** Befriend the frog (three hops within 1.9 s of each other near it; 1.3 s without assist) and the
tortoise (nudge it 2 times, 3 without assist). Ride the tortoise over the pike's stretch: the pike circles, rings its
target for 2.0 s (1.3 s), locks 0.45 s before it lunges, and bonks off a shelled tortoise. The frog springs off the
tortoise to the bank and tips the log into a ramp. Up there catch the beetle after its two runs (three) and bump the
chick while it flaps (with assist, standing next to it on the ground is enough). The cliff is slick below the perch:
fly the beetle up (a bird carrying a friend can't climb much past the perch, and the heron snaps at birds that fly
high) and set it on the perch; from there it climbs and unrolls the vine coil. Both heroes on the clifftop clears.

**Fox Hollow.** Hide and seek: the kit peeks from one of three bushes for 2.4 s (1.6 s); three tags befriend it. The
hawk then targets whoever is in the field (a tortoise first): the fox holds Action at the soft earth for 4.3 s while
a shelled tortoise takes the dives (the hawk reels for 1.2 s); a hit on the fox undoes the digging. Through the tunnel,
the tortoise drops onto the seesaw's near end and flings a light friend on the far end up the clay bank (the call
sends your partner to the far end); it tugs the root and the door opens. The bramble pricks.

**Otter River.** Catch the pup's pebble three times (within 58 px, 44 without assist). The current (−230) beats
everyone but the otter; a frog on the otter's belly holds its breath under the driftwood jam, anything else is washed
off and respawns. On the far side the frog springs off the otter onto the high bank and tips the log into a ramp.

**Storm Falls.** Three knots. *Stake*: the fox digs 4.3 s while lightning strikes whoever is out on land (a tortoise
draws it, a shell takes it; 2.0 s tell, 1.4 s without assist); the pool is safe. *Crevice*: dive the otter with a frog
on its belly to the crevice for 0.9 s; an otter alone is too big. *Crest*: the heron lunges at birds in front of it,
so fly low over the pool, rise behind its head in the waterfall spray, and let the carried beetle bite the knot for
0.8 s; a bird alone pricks itself. The storm clears into a rainbow and the end card lists the friends and times.

**Helping a stuck player.** After 6 s idle (10 s without assist) a key prompt in the player's own keys floats over the
active hero (on touch the right button or form icon pulses instead); after 9 s idle, or 16 s stuck and 2.5 s idle, or
35 s stuck (14/30/55 without assist) a ghost demo shows the pairing; glints point at what to try next.

**Respawns.** Falling in deep water (as a non-swimmer) or off the world puts the hero back at its last safe spot after
0.8 s.

## The save

`every-creature-cp1` holds `{ si, friends, total }`, written whenever a screen after the first loads and cleared when
the chapter is finished or a new game starts. The title offers *Continue · <screen>* when one is there. Assist, 2P and
mute are not saved (as in the prototype).

## The art

Every picture is painted; code draws only effects (water tint, glints, rings, rain, the rainbow, lightning). The
prototype's pipeline (`arcade-protos/creature-art/`): reference sheets for the heroes, the forms, the animals, props
and backgrounds (`ref-*.png`) went to Codex image generation (`gen.sh` reads one job per line from `jobs.txt`, with the
references listed in `refs.txt`), painting 3×3 or 4×2 sheets on flat magenta. `pack2.py` keyed out the magenta,
despilled the grey and cream fur, cut each cell, cropped to the alpha bounds and wrote one WebP per frame with its size
and sheet in `sizes.json`; every frame of a sheet is drawn at one scale set by a reference frame (`SHEETREF` in
creature-scene.ts). The backgrounds were painted against blockout guides of each screen's geometry. The port copies the
231 frames unchanged into `public/art/every-creature/`; nothing was missing, so nothing new was painted.

Dora is cream-white, Enzo grey: chinchillas, not mice. Each form keeps their fur so the pair can be told apart in any
shape.

## Sound

Synthesised with WebAudio: each form has a voice that plays when you become it (ribbit, shell clack-clack, flap-flap,
click-click-click, yip, chirp and bubble, a squeak), plus splashes, poofs, the friend fanfare, the puzzle click, bonks,
snaps, thunder and zaps; one generated pentatonic tune per screen (the finale minor), and a calm tune at the end.

## Tests

- `npm run test:creature`: 35 engine tests: the checkpoint, a seed replaying exactly, forms (locked, mid-air, the
  perch, cycling, back to chinchilla), swap, the call (the pairing form, boarding, an unlinked zone), steering a
  carrier, every friend and puzzle on all four screens, the pike and hawk and lightning against a shell, the current,
  the dive with a frog and a chinchilla washed off, the ghost demo, two players, the respawn footing, and that every
  frame a hero or a scene can ask for is painted.
- `npm run bot:creature`: human-delay bots ported from the prototype (`creature-tools/bot.js`), 200–300 ms late,
  overshooting, fumbling about 10% of decisions. *casual* follows the game's own idle prompts; *explorer* wanders,
  tries things, pauses (so prompts and demos appear), follows for a while and wanders off again. Thresholds: casual
  clears the chapter every time, averaging under 6 minutes; explorer clears at least half the time. `--quick` runs 4
  seeds instead of 10.
- `npm run test:e2e:creature`: 85 checks with real keys, touches and a stand-in gamepad at 1280×800, 390×844 and
  844×390 (see the file's header for the list). Needs `npm run dev` (or `BASE_URL`) and Playwright.

### Bot results (10 seeds, assist on, 13-11-2026)

| Bot | Cleared | Average | The Lake | Fox Hollow | Otter River | Storm Falls | Calls | Swaps | Hits | Splashes | Demos |
|---|---|---|---|---|---|---|---|---|---|---|---|
| casual | 10/10 | 3:49 | 0:59 | 0:51 | 0:42 | 1:03 | 11 | 7 | 4.2 | 13.0 | 1.3 |
| explorer | 6/10 | 11:20 | 3:09 | 2:03 | 2:41 | 3:13 | 45 | 41 | 45.5 | 38.9 | 16.6 |

The prototype's casual bot cleared 10 of 10 in about 4.2 minutes; the port's runs 3:49 to 4:06 depending on the two
fixes below. The explorer's four misses: twice at Storm Falls (it keeps wandering out under the lightning or away from
the crevice before the 0.9 s untie), once on The Lake's cliff, once at the crest.

## Changes from the prototype

- **Respawn footing.** A hero's last safe spot is recorded in whatever form it was; a narrower form could reappear past
  a ledge's edge and fall again forever (a chinchilla at the Storm Falls rock, found by the explorer bot). A respawn
  now steps inward up to 48 px until the current form has footing. Knock-back is cleared on respawn too.
- **The Lake's cheering spots.** Dora's spot was past the cliff edge, so she fell off mid-celebration; the spots moved
  onto the clifftop.
- **Gamepads** (the prototype had none): stick or d-pad, A action, B call, X / RB next form, LB previous, Y swap,
  Start or A on the title and end card; a second pad steers Enzo in two-player.
- **Looks-only randomness** moved out of the seeded stream (the prototype's drawing drew from it), and the camera no
  longer feeds the engine (the clear's petals fall over the screen's win view).
- A "← Arcade" link on the title and end card.

## What is weakest

- **Storm Falls is a wall for wanderers.** The explorer bot loses most of its time there: lightning knocks anyone on
  land every few seconds, and the crevice needs the otter to *hold* a dive with the frog aboard for 0.9 s. A casual
  player following prompts is fine (about a minute).
- **The partner call is doing a lot of work.** With assist it changes the partner's form for you; without assist the
  pairings need swaps and form keys on both heroes, which the bots haven't been tuned for (they play with assist on).
- **Two-player is untested by bots,** and the touch layout has no second set of controls, so 2P on a phone means one
  player on touch and one on a keyboard or pad.
- **The HUD's form row on a phone held upright sits under the portraits** and is small (34–56 px icons); it works, but
  a thumb covers the neighbouring icons.
- **Only Chapter One exists**; the end card says "The valley is calm".
