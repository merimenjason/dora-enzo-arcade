# Playpen reference

Reference photos of Dora and Enzo's real playpen, and a 3D prototype built from them on 12-11-2026. Nothing here is a game or is linked from the arcade menu. It is source material for future games: what the two of them and their home really look like, and a furred 3D chinchilla that can be ported when a 3D game needs one.

## Photos

All six are in `public/art/`, at most 2016 px on the long side, with camera metadata removed. Like the older `cage-*.jpg` shots, anything in `public/` is served by the live site.

| File | Shows |
| --- | --- |
| `playpen-hide-corner.jpg` | Back-left corner. Enzo sitting on the back two-hole hide box, Dora on the floor beside the yellow dust bath, the teal wheel on its clear tub, the frosted panels. |
| `playpen-front-corner.jpg` | Front-left corner from above. Dust bath, woven grass hut, purple fleece bed, the mouth of the tunnel, Dora from behind. |
| `playpen-tunnel.jpg` | The blue pop-up tunnel with its red-lined window, from above, with the fleece bed at one end and the branch perch and toy board at the other. |
| `playpen-cage-cabinet.jpg` | The cage cabinet with its mesh door open (ledges, litter tray, stick arch, hanging tube), the cubby stack to its left, the pine box and the chew-stick block. |
| `duo-pine-box-sitting.jpg` | Close-up. Enzo loafing on the pine box, Dora sitting upright in the open cubby with her eyes shut. |
| `duo-pine-box-crouched.jpg` | The same spot a moment later, Dora crouched. Best view of the top of her head and ears. |

The older references are still there: `dora.jpeg`, `enzo.jpeg`, `the-original-duo.jpg`, `cage-reference.jpg`, `cage-interior.jpg` and `cage-tunnel.jpg`.

## What the photos show

**Enzo** is a standard grey. His back is dark slate, fading through mid grey on his sides to a white belly and chest. Fine wavy darker bands run down his sides, about a centimetre apart. His muzzle and cheeks are paler than the rest of his face, his ears are dark grey-mauve, his eyes black, his toes grey, and his tail is bushy and darkest at the tip. At rest he is a round loaf, about as tall as he is wide.

**Dora** is white all over with a cream tint to her tail. Her ears are large, thin and pale pink, and stand upright. Her nose and toes are pink. Her eyes are dark ruby (shut in both close-ups). Sitting up she is pear-shaped, with her front paws held together at her chest.

**The pen** is a rectangle of wood-pattern vinyl (red, orange and tan planks running left to right) fenced with frosted clip-together panels on white frames with black connectors, against a lavender wall.

## Floor plan used by the prototype

Estimated by eye from the photos, not measured. Metres; x runs left to right along the wall, z runs from the wall towards the front. The pen is 2.5 wide and 2.0 deep; panels are 0.7 tall.

| Thing | Centre (x, z) | Size |
| --- | --- | --- |
| Back hide box | 0.44, 0.30 | 0.22 wide, 0.42 long, 0.22 tall |
| Front hide box | 0.25, 0.86 | same |
| Wheel on its tub | 0.80, 0.36 | wheel 0.38 across |
| Cubby stack | 1.22, 0.20 | 0.37 wide, 1.0 tall |
| Pine box with stick bay | 1.20, 0.60 | 0.43 wide, 0.32 deep, 0.30 tall |
| Cage cabinet | 1.80, 0.27 | 0.75 wide, 0.5 deep, 1.04 tall; door hinged on the right |
| Chew-stick block | 1.86, 0.98 | 0.26 square, 0.25 tall |
| Branch perch | 2.20, 1.25 | about 0.7 tall |
| Dust bath | 0.52, 1.34 | 0.24 across, 0.30 tall |
| Grass hut | 0.50, 1.72 | 0.42 across |
| Fleece bed | 0.93, 1.60 | 0.40 across |
| Tunnel | 1.62, 1.72 | 1.12 long, 0.26 across, lying left to right |
| Toy board | 2.30, 1.72 | 0.24 by 0.30 |

## The prototype

[`playpen-prototype.html`](playpen-prototype.html) is the whole thing in one file: open it in a browser. It draws the pen and both chinchillas, with two poses taken from the photos and a roaming mode. It was checked in a software renderer on desktop and phone widths only.

It is a prototype, not arcade code. It is one untyped script, has no tests, and uses the old global build of Three.js r128 from a CDN, where the arcade uses `three` 0.185 as modules.

Three parts are worth porting when a game needs them:

- **Furred chinchilla** (`chin()`, `furMesh()`, `bodyGeo`, `tailGeo()`). The body is eight ellipsoids blended into one surface and wrapped in shells of fur: the same mesh drawn in layers, each pushed out along the normal and cut away by a noise texture. The coat (Enzo's back-to-belly fade, bands and pale muzzle) is computed in the fragment shader from the position on the body. A shared `lib/chinchilla-3d.ts` built from this would do for the 3D games what `drawChinchilla` in `lib/chinchilla-art.ts` does for the 2D ones.
- **The pen as a set**: the floor texture, panels, hide boxes, wheel, cabinet, tunnel and the rest, each built in its own block.
- **Roaming** (`SPOTS`, `LINKS`, `roam()`): fourteen spots joined by hand-checked links; each chinchilla hops along floor links, jumps in an arc to and from perches, and never heads for a spot the other holds or is going to.

Things to change in a port:

- The fur shader ends with `#include <encodings_fragment>` and the renderer sets `outputEncoding`; in current Three.js these are `#include <colorspace_fragment>` and `outputColorSpace`. The shader also hardcodes the scene's light colours and direction.
- Each chinchilla is 54 draw calls (29 body layers, 25 tail layers). That is fine for two; a game with a crowd needs a layer count setting, or fur on the heroes only.
- Fur does not receive shadows.
- There are no legs or skeleton: the whole body hops as one piece. The ears read a little mouse-like and the paws show more than in the photos.
- Roaming picks with `Math.random()`. An arcade engine needs the seeded generator so a seed replays exactly.
