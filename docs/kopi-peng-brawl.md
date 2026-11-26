# Kopi Peng Brawl

A side-scrolling belt brawler set across Singapore on one long night, drawn as a 1980s Hong Kong kung-fu comic come
alive. Written 26-11-2026. The four style mock-ups are in `docs/ideas/kopi-peng-brawl/`; the user picked the
kung-fu comic look (`manhua.webp`).

## How it differs from Brinelight

Brinelight (#98) is a tag-team brawler: one hero on the belt at a time. In Kopi Peng Brawl **both heroes are always
on screen**. You play one, and the other is a helper bot until a second player presses their key to take over.
The fights are built around four kinds of surprise, so no two scenes play alike:

1. **Every stage has a twist** that changes a rule (below).
2. **Foes combine**: the mynah drops weapons to a macaque, rats ride a monitor's back, and a python wraps up one hero
   until the other frees them.
3. **Hawker uncles and aunties join in**: the satay uncle fans smoke across the floor, an auntie throws you a weapon,
   the drinks uncle slides a kopi peng that heals, and food from broken plates buffs whoever eats it (foes too).
4. **Seeded random events** mid-fight: a power cut, a durian lorry spill, a cockroach swarm, a sudden downpour.

## Animation

Heroes and foes are cut-out rigs: Codex paints each character once as separate parts (head, torso, upper arm,
forearm, thigh, lower leg, tail, and so on, each with rounded joint ends), and the game poses the parts with angles at
60 frames a second. Poses come from procedural cycles (idle, walk, run) and key-framed actions eased between keys.
On top of the rig the scene draws comic extras: swipe smears on fast swings, ink impact bursts, speed lines and
painted sound-effect words (PANG!, BONK!, WHAM!).

The rig is in `lib/kopi-rig.ts` (solve, then draw back to front so an upper limb always covers its lower limb's
joint cap; the lower foot is grounded automatically), the animations in `lib/kopi-anim.ts`.

## Heroes

| | Dora | Enzo |
|---|---|---|
| Look | cream-white fur, red eyes; red bandana, red singlet, canvas hawker apron, white rubber boots | grey fur; blue-and-white striped polo, white towel round the neck, navy shorts, blue rubber slippers |
| Feel | quicker, longer combos, kicks, jumps higher | slower, heavier hits, grabs and throws foes, lifts big things |
| Combo | jab, jab, high kick | jab, hook, belly bump |
| Special | Tray Cyclone (spinning tray through a lane) | Stool Slam (stool overhead, shockwave) |

Both can pick up anything lying on the floor. Team-ups trigger when the heroes stand close and both press Special.

## Controls

| | Solo | Player 1 with a second player | Player 2 |
|---|---|---|---|
| Move | arrows or WASD | WASD | arrows |
| Attack | J | J | , (comma) or Numpad 1 |
| Jump | K or Space | K | . (full stop) or Numpad 2 |
| Special / grab / pick up | L | L | / or Numpad 3 |
| Swap hero | Q | – | – |
| Pause | Esc or P | Esc or P | Esc or P |

Player 2 joins by pressing any of their keys; the helper bot hands the hero over. No touch controls (a keyboard game).

## Stages

| # | Stage | Twist | New foes | Boss |
|---|---|---|---|---|
| 1 | Lau Pa Sat at night | Closing time: stalls pull their shutters down one by one, the cleaners' trolley rolls through and sweeps up anything on the floor | rats, macaques, mynahs | Old Tank, the giant water monitor |
| 2 | Chinatown night market | A lion dance troupe parades through and tramples anyone in its lane; hits on the drum beat hit harder | monitor lizards, cockroach swarm | Madam Ssst, the python in the lion costume |
| 3 | The last MRT train | Doors open at each station: new foes get on, and you can kick foes out before the doors shut; tunnels cut the lights, curves slide everyone | pythons on the grab rails, rats | Tusker, the wild boar charging through the carriages |
| 4 | Tekka wet market in a monsoon | The floor floods as the stage goes on: water slows everyone, fish and ice are weapons, lightning flashes | toads, macaques | Big Frog Ong, the giant toad |
| 5 | Changi Village at dawn | Planes land overhead: every few seconds a jet roars over and everyone not in the air is stunned | wild boars, the whole macaque troop | the Macaque King |

## Foes

| Foe | Attack | Combines with |
|---|---|---|
| Sewer rat | low charge under swings, comes in pairs | rides a monitor's back |
| Long-tailed macaque | leaps table to table, steals food and weapons, two-hand slap | catches weapons the mynah drops |
| Javan mynah | flies in, snatches what you hold, pecks | drops what it stole to a macaque |
| Water monitor | slow tank, tail sweep knocks you down | carries rats |
| Cockroach swarm | flies at faces: everyone (foes too) flinches | panics foes into each other |
| Reticulated python | hangs from columns and rails, wraps one hero | the other hero frees the wrapped one |
| Asian toad | hops, tongue lash pulls you in | – |
| Wild boar | charges straight through a lane | carries a macaque rider |

## Code layout

| File | What |
|---|---|
| `lib/kopi-levels.ts` | Stages, scenes, waves, hawkers, twists, bosses. Nothing random. |
| `lib/kopi-game.ts` | Engine: fixed 60 Hz step, seeded randomness, no DOM. Heroes, helper bot, foes, items, hawkers, events, bosses, camera lock. |
| `lib/kopi-rig.ts` / `lib/kopi-anim.ts` | The cut-out rig and the animations (no DOM in the solver; drawing takes a context). |
| `lib/kopi-scene.ts` | Canvas 2D drawing: backdrops, depth-sorted rigs, comic effects, HUD. |
| `lib/kopi-art.ts` | Generated: every part's place in the atlases and its joint points. |
| `app/kopi/page.tsx` | Title, stage select, story panels, play, pause, results; keys; loop; save (`kopi-peng-v1`). |
