# Next Bellspire expansion (pitch): The Glacier Stair

A proposal written 09-11-2026, after the Night Orchard. Nothing here is built yet. The Night Orchard is the
reference for quality (see [the Night Orchard](bellspire-night-orchard.md)), and every rule in the Codex handover
in `HANDOFF.md` applies.

## The pitch

Above the orchard, the mountain is still frozen. The Mother of Grafts' roots reach up through the rock to the
snowline. Once she is calm, a root lift in her chamber carries the heroes up to the **Glacier Stair**, the old
caravan's road over the pass to a stone **Sun Gate** that hasn't opened since the Bellspire sank.

It is the **first daytime area** in the game: white ice, blue shadow and gold sunlight, after the night orchard and
dark cellars. It also brings a **new way of moving**: ice floors are slick, so the heroes carry momentum, and a
running jump off ice goes further than one off stone.

## The two moves

**Enzo, Sun Mirror.** At a marked sun-socket, Enzo turns a mirror and a beam of sunlight runs straight across the
room. Ice in its path melts: an **ice plug** becomes a **waterfall** that the heroes can pass through. The beam only
works where sunlight reaches; shadowed rooms need a second mirror to bounce it.

**Dora, Ice Pick.** Dora can grip an **ice wall** or a **frozen fall** and climb it, and stab into a slick floor to
stop a slide dead.

**Where they meet:** Enzo's existing Frost spell (V) refreezes a waterfall into a **frozen fall**, a column only
Dora's Ice Pick can climb. So a single piece of terrain has three states: an ice plug (blocks you), a waterfall (lets
you through) and a frozen fall (lets Dora climb). Most puzzles come from choosing the right state, in the right
order, with the right hero.

## Map: 12 rooms in two areas (each room two map cells, like the orchard)

**The Ice Falls** (outside, daylight):

1. **Root Lift Landing**: arrive, meet the guide, first slick floor (safe, flat, no hazards).
2. **Phuyu's Camp**: the shrine; Phuyu, a vizcacha mountaineer (a chinchilla's cousin), lends Enzo the Sun Mirror.
3. **First Thaw**: one plug, one beam: melt it and walk through.
4. **The Slide**: a long slick descent with stop-points; learn to brake and to use momentum on purpose.
5. **The Glass-Horn Vicuña** (guardian).
6. **Serac Walk**: icicles that shake, then fall, as you pass under (a clear tell); Dora's Ice Pick is found here.

**The Blue Hollows** (inside the glacier, lit through the ice):

7. **Frozen Fall**: the three states taught in one safe room (melt, refreeze, climb).
8. **Mirror Gallery**: two mirrors, bouncing the beam into a shadowed shaft.
9. **The Serac Osjollo** (guardian).
10. **Meltwater Run**: a timed room: melted falls refreeze on their own, so the climb has a window (generous with the
    helping hand).
11. **The Cold Vault**: optional, holding the outfits, a heart and a mural behind a three-state puzzle.
12. **The Sun Gate**: the last guardian, then the ending.

## Guardians (both heroes needed, as in the orchard)

- **The Glass-Horn Vicuña** charges across slick ice and can't stop. Enzo melts a plug behind where it stands, so the
  next charge carries it into the waterfall, where it stands drenched and slow. Dora strikes while it's drenched.
- **The Serac Osjollo**, a mountain cat, leaps between ice walls high above the floor. Enzo melts the wall it's
  clinging to and it drops to the floor. Dora climbs the refrozen fall to reach the high perch where its next leap
  lands, and strikes as it arrives.
- **The Sun Gate Warden**, a great stone face, alternates sun and shadow phases. In sun it sweeps a beam across the
  floor; in shadow its face is exposed. Enzo bounces the gate's own beam back with the mirror, which turns the next
  phase to shadow early, and Dora strikes the face before the sun returns.

## Why it isn't more of the same

- **A new feel:** momentum on ice changes how every jump and landing works, unlike any earlier area.
- **Terrain with three states,** and both heroes changing it, instead of one-off platforms.
- **The game's first daylight:** a new palette and mood, and a dawn ending that answers the Night Orchard.
- **It builds on what players already know** (Frost from the Foundry) rather than adding a third unrelated spell.

## What it needs to meet the standard

- Hand-drawn rows for all 12 rooms (no room generator); painted tiles, backdrops, props, guardians, Phuyu, and an
  outfit each for Dora (cream-white fur) and Enzo (grey fur), with every new action animated: grip, climb, brake,
  mirror turn, slide.
- **Jump windows on ice:** sweep take-off points 4 px apart *and* run-up lengths (momentum changes the jump), for
  both heroes; nothing under 16 px.
- **Tells:** icicles shake before they fall, guardians wind up before every attack; prove each tell is long enough
  with a human-delay bot (200–300 ms).
- **Guardian proofs** like `tests/bellspire-orchard.mjs`: each fight needs both heroes, and each dodge works with a
  real jump.
- **Prompts** in the helping-hand style (`echoHint`, `frostHint`): "V freeze the fall", "Dora: climb the ice",
  "Turn the mirror".
- **Screenshots** of every room at 1280×800 and 390×844 beside a Night Orchard shot; no dark-room flag on pale ice.
- **A route-bot or planner path** from the root lift to the Sun Gate, with the three-state terrain modelled in shared
  geometry (as `crystalSpans` is), so the bot never plans a climb the game doesn't allow.
- The usual: `docs/bellspire.md` section, `CHANGELOG.md` entry, browser checks of every new action, and a pull
  request rather than a push to `main`.

## Rough size

About the size of the Night Orchard: 12 rooms, 2 moves, 3 guardians, 1 NPC, 2 outfits, plus the ice physics. That
last part is the riskiest piece; build and tune it first, in one test room, before any other room is laid out.
