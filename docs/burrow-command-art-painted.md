# Burrow Command art — Painted 28-10-2026

**Status: 70 of 71 requested images painted and saved. `title.webp` remains missing.** The built-in image generator repeatedly timed out on the title composition and then returned HTTP 429 `usage_limit_reached`. No paid CLI/API fallback was used. No API key was requested. No code, brief, changelog or other project files were changed by this art task; no commit was made.

## References

- `public/art/disco/dancer-dora-idle.webp`: viewed and supplied directly for the Dora portrait; character family reference throughout.
- `public/art/disco/dancer-enzo-idle.webp`: viewed and supplied directly for the Enzo portrait; character family reference throughout. The requested solid-black eyes and cool-grey fur were explicitly corrected in the final portrait.
- `public/art/disco/venue-burrow.webp`: viewed painting-style reference throughout.
- `public/art/pebble/place-meadow.webp`: absent from this worktree and the main checkout; not available as a reference.
- Completed Marlo and Queen sprites were supplied directly for their portraits.

## Processing and validation

All generation and repainting used the built-in image-generation tool. Post-processing used Pillow and numpy, one source image at a time. Transparent assets were generated on flat green `#00ff00`, or magenta `#ff00ff` for green subjects; the matte was removed and its contribution unmixed from soft edges, then the result was cropped and Lanczos-fitted inside the requested box. Units retain approximately 15% margins; the hay resource fills the width. Opaque assets were fitted with `ImageOps.fit` and Lanczos. All final files use WebP quality 88.

Every saved file was reopened and fully decoded, and checked for exact dimensions, WebP format and RGB/RGBA mode. Every alpha asset passed the visible chroma-dominance fringe check and was visually reviewed on a mid-dark background. All 22 units face right and were also reviewed at 44px and 26px, the HUD card/button sizes in `app/command/command.css`; icons were reviewed at 40px. All buildings and remaining assets were also reviewed in compact contact sheets. Terrain textures were reviewed in 2×2 repeat grids with no obvious tile joins. No game code tests were run for this image-only change.

The first Enzo portrait was repainted to remove brown eye colour and warm fur. The first Queen portrait was repainted from full-body framing to close head-and-shoulders framing. Superseded and unsuccessful prompts are recorded below.

## Validation

| File | Size | Mode | Notes |
| --- | --- | --- | --- |
| `unit-colony-gatherer.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-slinger.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-fluffguard.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-puffer.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-glider.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-digger.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-dora.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-colony-enzo.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-tinkerer.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-scrapper.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-tosser.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-trapper.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-kite.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-cart.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-guild-marlo.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-sorter.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-clicker.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-squirt.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-shellback.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-buzzer.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-rammer.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `unit-hive-queen.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. Right-facing; family/style and 26px/44px readability reviewed. |
| `bld-colony-burrow.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-hut.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-pit.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-bath.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-mound.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-perch.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-den.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-stump.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-colony-library.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-bin.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-stash.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-yard.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-workshop.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-loft.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-lantern.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-guild-bench.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-core.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-cell.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-spring.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-brood.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-forge.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-nest.webp` | 512×512 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-coil.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `bld-hive-hall.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `res-hay.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `res-glimmer.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `tex-grass.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. 2×2 repeat grid reviewed. |
| `tex-dirt.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. 2×2 repeat grid reviewed. |
| `tex-water.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. 2×2 repeat grid reviewed. |
| `deco-tree.webp` | 384×384 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `deco-bush.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `deco-boulder.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `fx-trap.webp` | 256×256 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. |
| `portrait-dora.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `portrait-enzo.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. Repainted: solid-black eyes and cool-grey fur. |
| `portrait-marlo.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `portrait-queen.webp` | 512×512 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. Repainted: close portrait framing. |
| `title.webp` | 1600×1000 | RGB required; missing | NOT COMPLETE — repeated generation timeouts, then built-in usage limit. |
| `brief-meadow.webp` | 1600×900 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `brief-junkyard.webp` | 1600×900 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `brief-clockwood.webp` | 1600×900 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `brief-glimmer.webp` | 1600×900 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `brief-festival.webp` | 1600×900 | RGB | Exact dimensions; fully decoded; opaque Lanczos fit; visual review passed. |
| `icon-move.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |
| `icon-stop.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |
| `icon-hold.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |
| `icon-patrol.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |
| `icon-attack.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |
| `icon-build.webp` | 128×128 | RGBA | Exact dimensions; fully decoded; matte removed, edge colour unmixed; no detected chroma fringe; dark-background review passed. 40px readability reviewed. |

## Exact final prompts

### unit-colony-gatherer.webp

```text
Use case: illustration-story. Paint one Burrow Command RTS sprite: Hay Gatherer, a small sandy-beige chinchilla with a woven straw basket on its back heaped with golden hay, a little straw hat, carrying a wooden hay fork. Cheerful worker. Match the shown Dora and Enzo reference character family exactly: huge round dish ears with pink interiors, soft round fluffy body, single continuous bushy tail, big glossy eyes with two highlights, stubby limbs. Warm hand-painted toon storybook like the shown burrow venue reference, soft cel shading, gentle fine brown ink edges, saturated but soft colours, cosy kind playful. Camera above-right tilted 30 degrees from straight down; see top of head and back, face in RIGHT-facing three-quarter profile. Standing ready alert, all equipment and tail fully visible, centred with 15% empty margin, feet lower third. No ground patch, no shadow, no team markings. Perfectly flat uniform pure green #00ff00 background for later chroma extraction. No text, letters, numbers, logos, watermarks, borders or frames. Square composition, intended final 256x256.
```

### unit-colony-slinger.webp

```text
Paint a single right-facing RTS Pebble Slinger sprite. A light-grey fluffy chinchilla with huge pink round dish ears, glossy black eyes, single bushy tail, leather sling whirling one smooth pebble overhead, belt pouch of pebbles, green leaf headband. Match the previously shown Dora/Enzo character references and warm burrow painting: warm hand-painted toon storybook, soft cel shading, fine brown ink edges, kind cosy chibi. Camera from above-right, tilted 30 degrees from top down: show head top and back and face pointing RIGHT in three-quarter profile. Standing alert, entire equipment and tail visible, centred with 15% margin, feet lower third. No ground, no shadow, no text letters numbers logos watermarks borders frames or team markings. Perfectly uniform pure magenta #ff00ff background for chroma removal. Final square 256x256.
```

### unit-colony-fluffguard.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Fluffguard**: a big, extra-fluffy dark-grey chinchilla in a padded quilted jacket, holding a round wicker shield and a soft hay-stuffed mallet; sturdy and protective.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure green #00ff00 for chroma removal. Square final 256×256.
```

### unit-colony-puffer.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Dust Puffer**: a pale-lilac-grey chinchilla holding a large wooden bellows that puffs a little cloud of sparkly sandy dust, wearing round goggles pushed up on its head.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure green #00ff00 for chroma removal. Square final 256×256.
```

### unit-colony-glider.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Glider**: a light-grey chinchilla gliding in mid-air under a leaf-and-twig hang glider (a big maple leaf stretched over a twig frame), ears blown back, scarf trailing, seen from above-right. Leave clear space below (it flies; the game draws its shadow on the ground).
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure magenta #ff00ff for chroma removal. Square final 256×256.
```

### unit-colony-digger.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Burrow Digger**: a stocky brown-grey chinchilla in a miner's helmet with a candle lamp, pushing a big wooden wheelbarrow-drill (a hand-cranked wooden auger on two wheels). Siege unit.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure green #00ff00 for chroma removal. Square final 256×256.
```

### unit-colony-dora.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Dora (hero)**: Dora, cream-white with pink ears and ruby eyes, a little red-gold cape and a flower crown, holding a twig staff topped with a glowing golden seed. Brave and kind.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure magenta #ff00ff for chroma removal. Square final 256×256.
```

### unit-colony-enzo.webp

```text
Use case: illustration-story. One Burrow Command RTS sprite. Exact subject: **Enzo (hero)**: Enzo, grey with a pale chest and black eyes, a blue neckerchief and a small round acorn-cap helmet, holding a big round seed-pod shield. Steady and loyal.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora and Enzo and venue-burrow images as visual reference. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except the glider in flight with clear space below. No ground patch or shadow. Background perfectly uniform pure green #00ff00 for chroma removal. Square final 256×256.
```

### unit-guild-tinkerer.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-tinkerer.webp. Exact brief: **Tinkerer**: a small raccoon in patched overalls with a tool belt (spanner, string, a spoon), a sack of odds and ends over one shoulder. Worker.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-scrapper.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-scrapper.webp. Exact brief: **Scrapper**: a scrappy lean raccoon with a dented saucepan for a helmet, waving a wooden spoon, a cork-and-string sash; fast and cheeky.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-tosser.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-tosser.webp. Exact brief: **Lid Tosser**: a raccoon about to throw a shiny tin bin lid like a frisbee, a stack of lids under the other arm, a striped knitted hat.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-trapper.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-trapper.webp. Exact brief: **Trapsetter**: a raccoon with a coil of rope, a sticky honey pot and a spring-loaded net on its back, a miner's head-torch, sneaky grin.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-kite.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-kite.webp. Exact brief: **Kite Rider**: a raccoon riding a patchwork kite made of mismatched cloth scraps and newspaper-coloured paper (no lettering), ringed tail streaming behind, seen from above-right in flight. Leave clear space below.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-cart.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-cart.webp. Exact brief: **Junk Cart**: a wobbly wooden cart on four mismatched wheels (one is a bottle cap) with a spoon catapult on top loaded with a squashy apple core, pushed by a small raccoon. Siege unit.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-guild-marlo.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-guild-marlo.webp. Exact brief: **Marlo (hero)**: the Guild's leader, a big, warm, round raccoon with a patched purple waistcoat, a tiny top hat made from a tin can, a monocle made from a bottle bottom, a walking stick made from a bent fork. Grand but friendly.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-sorter.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-sorter.webp. Exact brief: **Sorter Beetle**: a small round copper beetle with two little brass arms holding a basket, a brass wind-up key in its back. Worker.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-clicker.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-clicker.webp. Exact brief: **Click Beetle**: a small, quick, glossy teal beetle with springy brass legs, a little brass horn on its nose, wind-up key in its back. Cheap swarm unit.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-squirt.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-squirt.webp. Exact brief: **Squirt Beetle**: a plum-coloured beetle with a brass nozzle on its head spraying a little arc of shiny oil droplets, wind-up key in its back. Ranged.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-shellback.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-shellback.webp. Exact brief: **Shellback**: a big, chunky beetle with a thick domed jade-green shell plated with brass bands and rivets, short sturdy legs, wind-up key in its back. Tank.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-buzzer.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-buzzer.webp. Exact brief: **Buzz Beetle**: a flying beetle with its amber shell open and two clear glassy clockwork wings whirring, wind-up key, seen from above-right in flight. Leave clear space below.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-rammer.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-rammer.webp. Exact brief: **Ram Beetle**: a long rhinoceros-style beetle with a big polished brass battering horn and a wind-up key, built low and heavy. Siege unit.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### unit-hive-queen.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: unit-hive-queen.webp. Exact brief: **Queen Beetle**: a large regal beetle with an iridescent violet-and-gold shell, a little brass crown, gentle wise glass eyes, a big ornate wind-up key in her back with a golden ribbon. Graceful, motherly.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Single complete unit sprite, not a sheet. Camera above-right tilted 30 degrees from straight down; show top of head and back, face pointing RIGHT in three-quarter profile. Entire figure and equipment visible; centred with 15% empty margin, feet lower third. Standing alert except flying units in flight with clear space below. No ground patch or shadow.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-colony-burrow.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-burrow.webp. Exact brief: **Great Burrow** (HQ): a big grassy mound with a round wooden door, round windows with warm light, a hay-thatched porch, a little flag pole without a flag, root arches and flowers.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-colony-hut.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-hut.webp. Exact brief: **Hay Hut** (house): a small round hut thatched with golden hay, a round door, a lantern.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-colony-pit.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-pit.webp. Exact brief: **Pebble Pit** (training ground): a sandy practice pit ringed by stones, a rack of slings, a straw target dummy, a wooden lean-to.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-colony-bath.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-bath.webp. Exact brief: **Dust Bath** (heals): a shallow round stone basin full of fine sparkling pale sand, a little rising puff of dust, a towel on a twig rail.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-colony-mound.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-mound.webp. Exact brief: **Tunnel Mound**: a dome of earth with a big round tunnel mouth framed in wooden beams, a lantern hanging by it.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-colony-perch.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-perch.webp. Exact brief: **Glider Perch**: a tall wooden lookout platform built round a tree stump with a launch ramp of twigs, spare leaf gliders hanging on pegs.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-colony-den.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-den.webp. Exact brief: **Digger's Den** (workshop): a timber workshop dug half into a bank, a big wooden auger leaning outside, bellows hanging up, a sawhorse.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-colony-stump.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-stump.webp. Exact brief: **Watch Stump** (tower): a hollow tree stump made into a little watchtower with a lookout platform and a pebble pile on top.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-colony-library.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-colony-library.webp. Exact brief: **Seed Library** (upgrades): a cosy round shed lined with shelves of seed jars and acorns, a sunflower beside the door.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-guild-bin.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-bin.webp. Exact brief: **Big Bin** (HQ): a huge friendly dented metal bin turned into a house, a round porthole window, a door cut in the side, bunting made of bottle caps, a tin-can chimney.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-guild-stash.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-stash.webp. Exact brief: **Stash Den** (house): a cosy den built from an upturned crate and a teapot, patched with cloth, a string of buttons.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-guild-yard.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-yard.webp. Exact brief: **Scrap Yard** (barracks): a fenced yard of neat junk piles (spoons, lids, corks), a hand-made archway of bent cutlery, a workbench.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-guild-workshop.webp

```text
Paint ONE transparent-ready game sprite on perfectly flat pure green #00ff00. A little wooden Rolling Workshop shed on a wagon with FOUR large mismatched wheels, tin chimney puffing, tools hanging off its side, towing shaft at the front pointing RIGHT. It clearly rolls. No characters. Camera RTS 3/4 from above-right, 30 degrees from straight down: roof and front visible. Rectangular base, centred whole building, no ground patch, no cast shadow. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy playful, soft saturated colours. No text letters numbers logos watermarks borders frames or team markings. Square final 512x512.
```

### bld-guild-loft.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-loft.webp. Exact brief: **Kite Loft**: a tall rickety tower of crates with patchwork kites tied to the top and a reel of string.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### bld-guild-lantern.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-lantern.webp. Exact brief: **Lantern Post** (tower): a tall pole of stacked tin cans topped with a bright lantern and a basket of bin lids to throw.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-guild-bench.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-bench.webp. Exact brief: **Tinker Bench** (upgrades): a messy workbench under a patched awning, a vice, cogs, bottles, a desk lamp made from a spoon.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### bld-hive-core.webp

```text
Paint ONE game building: **Hive Core** (HQ): a big domed brass-and-copper hive like an antique music box, with honeycomb windows glowing amber, a giant wind-up key slowly turning on top, little cogs visible. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 512 pixels.
```

### bld-hive-cell.webp

```text
Paint ONE game building: **Cog Cell** (house): a small hexagonal copper pod with a round glass hatch and a cog on top. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 384 pixels.
```

### bld-hive-spring.webp

```text
Paint ONE game building: **Spring Tower**: a slim brass tower with a huge coiled spring spiralling up it and a glowing teal gem at the top, little sparks of winding energy. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 384 pixels.
```

### bld-hive-brood.webp

```text
Paint ONE game building: **Brood Works** (barracks): a brass workshop shaped like a half-beetle shell, an assembly cradle with half-built toy beetle shells, gear wheels. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 512 pixels.
```

### bld-hive-forge.webp

```text
Paint ONE game building: **Gear Forge**: a heavy riveted brass forge with a warm glowing furnace mouth, big gears on the side, a short chimney. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 512 pixels.
```

### bld-hive-nest.webp

```text
Paint ONE game building: **Buzz Nest**: a round open-topped brass nest like a birdcage dome with landing perches and glassy wings drying on a rack. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 512 pixels.
```

### bld-hive-coil.webp

```text
Paint ONE game building: **Spark Coil** (tower): a copper coil tower with a glass bulb on top crackling with soft friendly blue sparks. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 384 pixels.
```

### bld-hive-hall.webp

```text
Paint ONE game building: **Winding Hall** (upgrades): a small octagonal clockwork pavilion with a clock face without numbers or hands on its front, ticking gears behind glass. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, fine brown ink edges, cosy kind playful, soft saturated colours. RTS camera above-right 30 degrees from top-down, roof and front wall visible. Complete centred building, rectangular footprint in lower 70% width. No characters, cast shadow or ground patch beyond thin earth ring at base. No text letters numbers logos watermarks borders frames flags or team markings. Perfectly flat pure green #00ff00 chroma background. Final square 384 pixels.
```

### res-hay.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: res-hay.webp. Exact brief: **Hay meadow**: a lush patch of tall golden-green meadow grass with a few loose bundles of cut hay and clover flowers, about as wide as the image, roughly round.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### res-glimmer.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: res-glimmer.webp. Exact brief: **Glimmer deposit**: a cluster of smooth grey boulders with glowing pale-turquoise and pink crystals growing out of them, faint sparkles.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### tex-grass.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: tex-grass.webp. Exact brief: Soft meadow grass seen from straight above: varied greens, tiny flowers and clover, no paths or objects.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Opaque seamless repeat texture tile, perfectly tiles left-right and top-bottom. Straight top-down, flat even lighting, subtle small evenly distributed details, no strong repeating features, no central focal object. Full-bleed edge to edge.
Opaque, fully painted background. Final size 512×512; compose at matching aspect ratio.
```

### tex-dirt.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: tex-dirt.webp. Exact brief: Warm trodden earth with tiny pebbles and a few straw strands, for building pads and paths.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Opaque seamless repeat texture tile, perfectly tiles left-right and top-bottom. Straight top-down, flat even lighting, subtle small evenly distributed details, no strong repeating features, no central focal object. Full-bleed edge to edge.
Opaque, fully painted background. Final size 512×512; compose at matching aspect ratio.
```

### tex-water.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: tex-water.webp. Exact brief: Clear calm pond water from above, teal-blue with soft ripples and light glints.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. Opaque seamless repeat texture tile, perfectly tiles left-right and top-bottom. Straight top-down, flat even lighting, subtle small evenly distributed details, no strong repeating features, no central focal object. Full-bleed edge to edge.
Opaque, fully painted background. Final size 512×512; compose at matching aspect ratio.
```

### deco-tree.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: deco-tree.webp. Exact brief: A round leafy oak tree seen from above at 3/4: a big puffy canopy, a short trunk visible at the bottom.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 384×384; compose at matching aspect ratio.
```

### deco-bush.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: deco-bush.webp. Exact brief: A round berry bush with a few red berries.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### deco-boulder.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: deco-boulder.webp. Exact brief: A mossy grey boulder with a smaller stone beside it.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### fx-trap.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: fx-trap.webp. Exact brief: A Ringtail snare on the ground: a loop of rope round a small open honey pot, a bent twig spring, a couple of autumn leaves to hide it. Seen from above.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete centred resource or decal sprite, same RTS camera above-right 30 degrees from straight down unless explicitly top-down. No shadow. Whole object visible. Hay meadow should fill width edge to edge.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 256×256; compose at matching aspect ratio.
```

### portrait-dora.webp

```text
Paint one Burrow Command opaque square head-and-shoulders portrait. Dora, cream-white with pink ears and ruby eyes, flower crown and red-gold cape, a determined happy smile, warm meadow-green background. Match supplied character reference exactly in face, ears, fur or shell colours and eyes; add the described hero costume. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy kind playful, big glossy eyes with two highlights. Dora cream-white pink ears ruby eyes; Enzo cool mid-grey darker back pale chest pink ears solid BLACK eyes. Softly blurred warm background as specified. No text letters numbers logos watermarks borders frames. Full-bleed square 512x512.
```

### portrait-enzo.webp

```text
Edit this Enzo portrait. Keep the composition, acorn helmet, blue neckerchief, pink ears, pale chest, friendly expression and blurred sky-blue background exactly. Correct BOTH eyes to solid glossy BLACK, including their lower halves: remove ALL brown/amber iris colour, retain two white highlights. Correct grey fur to COOL MID-GREY with darker cool-grey back; remove beige/brown warmth from the fur only. Pale chest stays pale. Warm hand-painted toon storybook, soft cel shading, fine brown ink. No text letters numbers logos watermarks borders. Opaque square head-and-shoulders portrait, final 512x512.
```

### portrait-marlo.webp

```text
Paint one Burrow Command opaque square head-and-shoulders portrait. Marlo the raccoon leader, tin-can top hat, bottle-bottom monocle, purple patched waistcoat, a sly but kindly grin, warm lantern-lit junkyard background. Match supplied character reference exactly in face, ears, fur or shell colours and eyes; add the described hero costume. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy kind playful, big glossy eyes with two highlights. Dora cream-white pink ears ruby eyes; Enzo cool mid-grey darker back pale chest pink ears solid BLACK eyes. Softly blurred warm background as specified. No text letters numbers logos watermarks borders frames. Full-bleed square 512x512.
```

### portrait-queen.webp

```text
Repaint this Queen Beetle image as a CLOSE head-and-shoulders character portrait, face filling about half image width; lower legs and ground entirely out of frame. Preserve her exact gentle glass eyes, friendly face, little brass crown, iridescent violet-and-gold upper shell, ornate wind-up key and golden ribbon. Warm amber clockwork background softly blurred, warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy kind. Opaque square full-bleed 512x512. No text letters numbers logos watermarks borders or frames.
```

### brief-meadow.webp

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Briefing backdrop: the Burrow Colony's home meadow at golden morning: grassy mounds with round doors, hay fields, a stream. No characters. Match previously shown venue-burrow painting reference. No characters. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x576 pixels, later Lanczos-fit to 1600x900.
```

### brief-junkyard.webp

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Briefing backdrop: the Ringtail Guild's camp at dusk: tidy junk piles, bunting of bottle caps, kites, lanterns, a rolling workshop wagon. No characters. Match previously shown venue-burrow painting reference. No characters. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x576 pixels, later Lanczos-fit to 1600x900.
```

### brief-clockwood.webp

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Briefing backdrop: a mossy forest with brass clockwork everywhere among the roots: spring towers with glowing teal gems, cogs half-sunk in moss, soft light beams. Mysterious but gentle, not dark. No characters. Match previously shown venue-burrow painting reference. No characters. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x576 pixels, later Lanczos-fit to 1600x900.
```

### brief-glimmer.webp

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Briefing backdrop: a wide rocky valley full of glowing turquoise and pink glimmer crystals under a lilac twilight sky. No characters. Match previously shown venue-burrow painting reference. No characters. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x576 pixels, later Lanczos-fit to 1600x900.
```

### brief-festival.webp

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Briefing backdrop: a festival meadow at sunset set for a shared party: long tables of hay and berries, raccoon bunting and kites, brass beetle lanterns glowing, a chinchilla burrow decorated with flowers. No characters. Match previously shown venue-burrow painting reference. No characters. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x576 pixels, later Lanczos-fit to 1600x900.
```

### icon-move.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-move.webp. Exact brief: A small round wooden signpost arrow pointing right on a pebble.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

### icon-stop.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-stop.webp. Exact brief: A round wooden shield-like paw-print sign held up flat (a "stop" paw), warm red-brown.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

### icon-hold.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-hold.webp. Exact brief: A little wooden stake driven into a tuft of grass with a rope loop round it.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure magenta #ff00ff chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

### icon-patrol.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-patrol.webp. Exact brief: Two curved twig arrows chasing each other in a circle.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

### icon-attack.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-attack.webp. Exact brief: A round pebble flying with a little whoosh trail and a yellow star spark.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

### icon-build.webp

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: icon-build.webp. Exact brief: A wooden mallet crossed with a small hay-thatch bundle.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One bold simple painted object, centred, whole object visible, readable at 40x40. No shadow, no ground patch.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 128×128; compose at matching aspect ratio.
```

## Superseded portrait prompts

### portrait-enzo.webp — first version

Not the final saved version. See the validation notes for the correction.

```text
Paint one Burrow Command opaque square head-and-shoulders portrait. Enzo, grey with a pale chest and black eyes, blue neckerchief and acorn-cap helmet, calm and steady smile, warm sky-blue background. Match supplied character reference exactly in face, ears, fur or shell colours and eyes; add the described hero costume. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy kind playful, big glossy eyes with two highlights. Dora cream-white pink ears ruby eyes; Enzo cool mid-grey darker back pale chest pink ears solid BLACK eyes. Softly blurred warm background as specified. No text letters numbers logos watermarks borders frames. Full-bleed square 512x512.
```

### portrait-queen.webp — first version

Not the final saved version. See the validation notes for the correction.

```text
Paint one Burrow Command opaque square head-and-shoulders portrait. The Queen Beetle, iridescent violet-and-gold shell, little brass crown, gentle glass eyes, ornate key with a golden ribbon, warm amber clockwork background. Match supplied character reference exactly in face, ears, fur or shell colours and eyes; add the described hero costume. Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, cosy kind playful, big glossy eyes with two highlights. Dora cream-white pink ears ruby eyes; Enzo cool mid-grey darker back pale chest pink ears solid BLACK eyes. Softly blurred warm background as specified. No text letters numbers logos watermarks borders frames. Full-bleed square 512x512.
```

## Unsuccessful requests and intermediate title work

These exact prompts are retained for reproducibility and continuation. Timeout requests returned no image. The intermediate valley lacks the required characters and was deliberately not installed as `title.webp`.

### 1 · unit-colony-slinger.webp

Timed out; later retried successfully.

Reference inputs: `/home/jason/repos/dora-wt/command/public/art/disco/dancer-dora-idle.webp`, `/home/jason/repos/dora-wt/command/public/art/disco/dancer-enzo-idle.webp`, `/home/jason/repos/dora-wt/command/public/art/disco/venue-burrow.webp`

```text
Use case: illustration-story. Create ONE standalone Burrow Command RTS unit sprite, not a sheet. Subject exactly: **Pebble Slinger**: a light-grey chinchilla with a leather sling whirling a smooth round pebble above its head, a pouch of pebbles on a belt, a green leaf headband.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Reference images 1 and 2 establish character design; image 3 painting style only. Camera above-right 30 degrees from straight down, see top of head and back, face pointing RIGHT in three-quarter profile. Standing alert, feet in lower third, whole figure equipment and tail visible, centred, 15% empty margin all round. No shadow or ground patch. Perfectly flat uniform pure magenta #ff00ff chroma background, no gradients. Square composition, final 256×256.
```

### 2 · bld-guild-yard.webp

Timed out; later retried successfully.

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-yard.webp. Exact brief: **Scrap Yard** (barracks): a fenced yard of neat junk piles (spoons, lids, corks), a hand-made archway of bent cutlery, a workbench.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### 3 · bld-guild-workshop.webp

Timed out; later retried successfully.

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-guild-workshop.webp. Exact brief: **Rolling Workshop**: a little wooden workshop shed built on a wagon with four big mismatched wheels, a tin chimney puffing, tools hanging off the side, a towing shaft at the front pointing right. It drives around, so it must look like it can roll.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind, cosy and playful, never scary or grim. Match supplied references: Dora cream-white pink ears ruby eyes; Enzo COOL MID-GREY darker back pale chest pink ears SOLID BLACK eyes (not brown). Chibi big heads, huge round dish ears, soft fluffy round chinchilla bodies, single continuous bushy tail, stubby limbs, glossy eyes two highlights. Raccoons plump cheerful grey with black mask, ringed tail, little paws. Beetles cute rounded antique wind-up toys, lacquered shells, brass legs rivets glass eyes brass key on back, never frightening. Keep one coherent family within each side. No text, letters, numbers, logos, watermarks, borders, frames. No team markings; retain explicitly requested hero clothing colours.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### 4 · bld-hive-core.webp

Timed out; later retried successfully.

```text
Use case: illustration-story. Paint ONE Burrow Command game asset: bld-hive-core.webp. Exact brief: **Hive Core** (HQ): a big domed brass-and-copper hive like an antique music box, with honeycomb windows glowing amber, a giant wind-up key slowly turning on top, little cogs visible.
Warm hand-painted toon storybook, soft cel shading, gentle fine brown ink edges, saturated but soft colours; kind cosy playful, never grim. Match the viewed venue-burrow painting style. No text, letters, numbers, logos, watermarks, borders, frames or team markings.
Use previously viewed Dora/Enzo images as character design reference and venue-burrow as painting-style reference. One complete building centred, no characters. Same RTS camera above-right 30 degrees from straight down, roof and front wall visible. Rectangular ground footprint filling lower 70% width, roof may rise into top. No ground patch beyond thin trodden earth ring at very base, no shadow. No flags or team markings.
Perfectly flat uniform pure green #00ff00 chroma background for extraction. Final size 512×512; compose at matching aspect ratio.
```

### 5 · title.webp

Two identical attempts timed out.

```text
Paint one full-bleed LANDSCAPE Burrow Command storybook backdrop. Exact brief: Title painting: a sunny meadow valley from above at a gentle angle; on the left Dora and Enzo stand on the Great Burrow mound pointing ahead, a few Hay Gatherers and Pebble Slingers around them; in the middle distance a cheerful raccoon junk camp with kites; on the right a brass clockwork hive among trees with little beetles. Everyone looks curious, nobody fights. Keep the top-centre calmer (soft sky) for the game's title text. Warm hand-painted toon storybook matching the viewed venue-burrow reference, soft cel shading, gentle fine brown ink edges, saturated but soft colours, cosy kind playful, never grim. Match viewed Dora and Enzo references exactly: Dora cream-white pink ears ruby eyes, flower crown red-gold cape golden seed staff; Enzo COOL MID-GREY darker back pale chest pink ears solid BLACK eyes, blue neckerchief acorn-cap helmet seed-pod shield. Other chinchillas huge round dish ears soft bodies single bushy tails. Raccoons friendly grey black mask ringed tails; beetles rounded brass wind-up toys. No fighting. No text letters numbers logos watermarks borders frames. Opaque fully painted edge to edge. Wide composition exact aspect ratio 1600:1000, final 1600x1000 pixels.
```

### 6 · title.webp

Timed out.

```text
Wide 1600x1000 opaque title painting for Burrow Command. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy kind, no fighting. Sunny meadow valley from gently above. LEFT: Dora cream-white chinchilla pink dish ears ruby eyes flower crown red-gold cape, and Enzo cool mid-grey chinchilla pale chest pink ears solid BLACK eyes blue neckerchief acorn helmet, standing on grassy Great Burrow mound pointing ahead, hay-basket chinchilla Gatherers and leaf-headband Pebble Slingers nearby. MIDDLE DISTANCE: cheerful raccoon junk camp with patchwork kites. RIGHT: brass clockwork hive among trees with cute little wind-up beetles. All curious and friendly. Calm soft sky TOP CENTRE for later game title. Match previously viewed Dora, Enzo and venue-burrow reference style. Full-bleed. NO text letters numbers logos watermarks borders frames.
```

### 7 · title.webp

Timed out.

```text
Warm hand-painted toon storybook LANDSCAPE, soft cel shading, gentle fine brown ink edges, soft saturated colours, cosy kind gentle. Title painting: a sunny meadow valley from above at a gentle angle; on the left Dora and Enzo stand on the Great Burrow mound pointing ahead, a few Hay Gatherers and Pebble Slingers around them; in the middle distance a cheerful raccoon junk camp with kites; on the right a brass clockwork hive among trees with little beetles. Everyone looks curious, nobody fights. Keep the top-centre calmer (soft sky) for the game's title text. Match previously shown venue-burrow painting reference. Dora cream-white pink ears ruby eyes; Enzo cool grey pale chest black eyes. Chinchillas huge round dish ears bushy tails; raccoons friendly grey masked ringed tails; beetles cute brass wind-up toys. Opaque full-bleed. No text letters numbers logos watermarks borders frames. Generate a modest working image 1024x640 pixels, later Lanczos-fit to 1600x1000.
```

### 8 · title.webp

Timed out.

Reference inputs: `public/art/command/brief-meadow.webp`

```text
Repaint this as a wider-view sunny meadow valley illustration from gently above. On LEFT grassy burrow mound add Dora (cream-white chinchilla pink ears ruby eyes flower crown red-gold cape) and Enzo (cool grey chinchilla pale chest black eyes blue neckerchief acorn helmet), pointing ahead. Nearby add a few tiny hay-basket workers and pebble-sling chinchillas. In MIDDLE DISTANCE add cheerful raccoon junk camp with kites. On RIGHT among trees add brass clockwork hive and tiny cute wind-up beetles. Everyone curious, nobody fights. Keep TOP CENTRE calm soft sky. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy kind. No text letters numbers logos watermarks borders frames. Opaque landscape working image 768x480.
```

### 9 · title.webp

Intermediate valley generated; missing required characters, therefore not saved as title.webp.

```text
A sunny meadow valley seen from gently above. Left foreground grassy mound house with round door. Middle distance cheerful tidy junk camp with patchwork kites. Right among trees a domed brass clockwork hive. Calm soft sky at top centre. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, cosy playful. Opaque full-bleed landscape 1024x640. No text, letters, numbers, logos, borders or watermarks. No characters yet.
```

### 10 · title.webp

Timed out.

```text
Edit image 1, preserving the meadow valley, camps, calm top-centre sky, style and landscape framing. Add Dora and Enzo standing ON TOP of the grassy Great Burrow mound at LEFT, pointing curiously toward the camps. Use images 2 and 3 as exact hero character design references. Dora cream-white pink ears ruby eyes flower crown red-gold cape seed staff; Enzo cool grey pale chest solid black eyes blue neckerchief acorn helmet seed-pod shield. Chibi huge dish ears fluffy bushy tails. Brave kind happy. Warm hand-painted toon storybook soft cel shading fine brown edges. No fighting. No text letters numbers logos borders watermarks. Opaque landscape.
```

### 11 · title.webp

Timed out.

```text
Keep this painting. Add ONE cute cream-white chinchilla hero on top of the left grassy mound, pointing toward the valley. Huge round pink dish ears, ruby eyes, fluffy bushy tail, flower crown, little red-gold cape. Warm hand-painted toon storybook matching existing painting, soft cel shading, fine brown edges, kind happy expression. Preserve all camps and calm sky. No text letters numbers logos watermarks borders. Opaque landscape.
```

### 12 · title.webp

Timed out.

```text
Add a little cream-white fluffy chinchilla with huge pink ears and ruby eyes, flower crown and red-gold cape, standing atop the grassy mound on the left and pointing right. Keep the entire valley painting otherwise unchanged. Warm hand-painted toon storybook, soft cel shading, fine brown ink, kind and cosy. No text or watermarks. Opaque landscape.
```

### 13 · title.webp

Rejected: HTTP 429 usage_limit_reached; no image returned.

```text
Cosy hand-painted storybook landscape, sunny meadow valley from above. Left: two chibi chinchilla heroes, cream-white ruby-eyed Dora and cool-grey black-eyed Enzo, on a grassy round-door burrow mound pointing ahead, with tiny hay gatherers and pebble slingers. Middle distance: cheerful raccoon junk camp and kites. Right: brass clockwork hive among trees, tiny toy beetles. Curious friendly, no fighting. Calm soft sky at top centre. Soft cel shading, fine brown ink edges. No text letters numbers logos watermarks borders. Opaque wide landscape 1024x640.
```

## Remaining work

Generate and validate `title.webp` (1600×1000 RGB opaque), following the original brief exactly. The staged valley and unfinished edits do not satisfy the character requirements. Keep all other 70 completed assets. The last built-in request returned `usage_limit_reached` with `resets_at: 1793167331`; the tool reported approximately 42,163 seconds until reset when it rejected the request. No fallback generation is authorized.
## Painted (28-10-2026, follow-up)

Skipped `public/art/command/title.webp`: both built-in generation attempts timed out; original unchanged.

Initial prompt:

```text
Paint a sunny meadow valley from a gentle high angle, matching reference 1's landscape style and reference 2's Enzo. On the left cream-white ruby-eyed pink-eared Dora and COOL BLUE-GREY Enzo with darker back, pale chest and solid BLACK eyes stand on a grassy burrow mound pointing ahead. A cheerful raccoon junk camp with kites fills the middle distance; a brass clockwork beehive stands among trees on the right. Warm hand-painted toon storybook, soft cel shading, fine brown ink edges, calm sky top-centre, opaque 1600x1000, no text, letters or borders.
```

Retry prompt:

```text
Sunny meadow valley, gentle high angle: left, cream-white ruby-eyed pink-eared Dora and COOL BLUE-GREY black-eyed Enzo with darker back and pale chest point ahead from a grassy burrow mound. Middle distance, cheerful raccoon junk camp with kites; right, brass clockwork beehive among trees. Warm painted toon storybook, soft cel shading, fine brown ink edges, calm top-centre sky; opaque 1600x1000, no text or borders.
```

