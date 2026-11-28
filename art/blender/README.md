# Blender models

Scripts that build 3D models in Blender, headless, and export them as `.glb` for the three.js games.

## `chinchilla.py`

Builds a chibi Dora (cream-white fur) or Enzo (grey fur) in a game's outfit, rigged and with one animation clip per action.

```sh
blender -b -P art/blender/chinchilla.py -- --who dora --outfit squall --out public/art/squall/dora.glb --preview /tmp/dora.png
```

- Each body part is a smooth mesh weighted fully to one bone, so the figure moves like a jointed toy and needs no weight painting. All parts are joined into one skinned mesh.
- Bones: `root`, `body`, `head`, `ear.L/R`, `arm.L/R`, `leg.L/R`, `tail`. Character faces -Y in Blender (+Z in three.js after the Y-up export), about 1 unit tall.
- Clips: `idle`, `run`, `jump`, `land`. A game adds its own clips (one per action, never a reused pose) with `clip()`.
- Outfits are named per game in the `--outfit` branch at the end of the build section. Dora has nothing on her head unless the game names her headwear.
- Materials carry base colours only; the game shades them (toon ramp, outlines). Leave whiskers out of any outline pass.
- Keep every exported `.glb` well under Cloudflare's 25 MiB per-file limit; a figure is about 3.5 MB at the current subdivision.
