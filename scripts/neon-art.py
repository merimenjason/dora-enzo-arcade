#!/usr/bin/env python3
"""Neon Lane art pipeline: Codex neon paintings -> web atlases and frame boxes.

  python3 scripts/neon-art.py <paint-dir> [--debug <dir>]

Every picture in Neon Lane is a Codex painting. The sprite sheets (Dora, Enzo, the four cicaks, the extras, the items
and the six sign pictures) were painted as glowing glass tubes on black. Light on black has no edge to key, so this
script builds the alpha in two parts: inside a figure's outline (the bright lines, closed up and hole-filled) the
painting is solid, so its dark fill (Enzo's grey fur, a cicak's belly) hides the tubes behind it; outside the outline
the glow fades out with its brightness, so the halo blends onto the rainy wall like real light. Colour in the halo is
un-premultiplied so drawing it with ordinary alpha gives back the painted glow. The six walls and the title go
through at web size.

Outputs:
  public/art/neon/<sheet>.webp   sprite atlases (alpha), one cell per frame
  public/art/neon/wall1..6.webp, title.webp
  lib/neon-art.ts                atlas cell sizes and per-frame boxes
"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/art/neon')
OUT_TS = os.path.join(ROOT, 'lib/neon-art.ts')

HERO = 'runA runB runC runD climbA climbB downA downB eat idle blink zapA zapB pounce cheer sad'
# sheet -> (cols, rows, output cell width, frame names in reading order, solid inside the outline?)
SHEETS = {
  # Dora was painted in cream lines on black: her body is filled with warm cream glass so she reads as the pale one
  'dora': (4, 4, 192, HERO, (238, 226, 204)),
  'enzo': (4, 4, 192, HERO, True),
  'cicaks': (4, 4, 160, ' '.join(f'{k}{f}' for k in ['chik', 'chak', 'tokek', 'lulu'] for f in ['A', 'B', 'Chirp', 'Stub']), True),
  'extras': (4, 2, 160, 'scaredA scaredB tailA tailB eyes gulp mothA mothB', True),
  'items': (4, 2, 160, 'fuse blown den doraHead enzoHead spark plug star', True),
  'motifs': (3, 2, 384, 'kopi frog satay turtle durian crab', False),
}
BACKS = {'wall1': 80, 'wall2': 80, 'wall3': 80, 'wall4': 80, 'wall5': 80, 'wall6': 80, 'title': 86}


def light(rgb, solid_inside):
  """alpha from brightness, plus a solid body inside the outline (filled with a colour where it was left black)"""
  f = rgb.astype(np.float32)
  fill = solid_inside if isinstance(solid_inside, tuple) else None
  lum = f.max(axis=2)
  # the background is near black (about 0 to 12): fade the glow in from just above it
  a = np.clip((lum - 14) / 150, 0, 1)
  if solid_inside:
    lines = lum > 70
    closed = ndimage.binary_closing(lines, iterations=4)
    body = ndimage.binary_fill_holes(closed)
    body = ndimage.binary_erosion(body, iterations=1) | lines
    # a soft edge on the body so it does not show as a hard cut-out on the wall
    soft = ndimage.gaussian_filter(body.astype(np.float32), 1.2)
    a = np.maximum(a, np.clip(soft * 1.6 - 0.3, 0, 1))
    if fill:
      # the black inside the outline becomes the fill colour, shaded by how dark it was so the lines stay crisp
      inner = ndimage.binary_erosion(body, iterations=2) & (lum < 90)
      k = (np.clip((64 - lum) / 34, 0, 1) * inner)[..., None]
      f = f * (1 - k) + np.array(fill, np.float32) * k
      lum = f.max(axis=2)
  # un-premultiply the halo so ordinary alpha drawing gives back the painted light
  out = np.where(a[..., None] > 0.02, f / np.maximum(a[..., None], 0.02), 0)
  # but never brighten the solid body's dark fill
  out = np.where((a[..., None] >= 0.98), f, out)
  return np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8)


def sheet(name, src, cols, rows, cw, frames, solid, dbg):
  im = Image.open(src).convert('RGB')
  W, H = im.size
  sw, sh = W / cols, H / rows
  ch = round(cw * sh / sw)
  atlas = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
  boxes = {}
  for i, fname in enumerate(frames):
    cx, cy = i % cols, i // cols
    cell = im.crop((round(cx * sw), round(cy * sh), round((cx + 1) * sw), round((cy + 1) * sh)))
    rgba = light(np.asarray(cell), solid)
    # glow that is not part of the main figure and touches the cell edge is a neighbour's spill: drop it
    seen = rgba[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(seen, iterations=8))
    if n > 1:
      sizes = ndimage.sum(seen, lab, range(1, n + 1))
      edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
      keep = np.zeros(n + 1, bool); big = sizes.max()
      for j, s in enumerate(sizes, 1): keep[j] = s > 0.15 * big or (j not in edge and s > 0.01 * big)
      rgba[..., 3] = np.where(keep[lab], rgba[..., 3], 0)
    small = Image.fromarray(rgba).resize((cw, ch), Image.LANCZOS)
    arr = np.asarray(small)
    ys, xs = np.nonzero(arr[..., 3] > 60)
    if len(xs) == 0: raise SystemExit(f'{name}:{fname} is empty')
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    low = ys >= y1 - max(2, (y1 - y0) // 10)
    fx = int(np.median(xs[low]))
    atlas.paste(small, (cx * cw, cy * ch))
    boxes[fname] = [cx * cw + x0, cy * ch + y0, x1 - x0, y1 - y0, cx * cw + fx, cy * ch + y1]
  atlas.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=88, method=6)
  if dbg:
    for bgc in [(40, 30, 50), (120, 90, 60)]:
      bg = Image.new('RGBA', atlas.size, bgc + (255,)); bg.alpha_composite(atlas)
      bg.convert('RGB').save(os.path.join(dbg, f'{name}-{bgc[0]}.png'))
  return {'cw': cw, 'ch': ch, 'f': boxes}


def main():
  if len(sys.argv) < 2: raise SystemExit(__doc__)
  src = sys.argv[1]
  dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
  os.makedirs(OUT, exist_ok=True)
  if dbg: os.makedirs(dbg, exist_ok=True)
  atl = {}
  for name, (cols, rows, cw, names, solid) in SHEETS.items():
    atl[name] = sheet(name, os.path.join(src, f'{name}.png'), cols, rows, cw, names.split(), solid, dbg)
    print('sheet', name, atl[name]['cw'], atl[name]['ch'])
  for b, q in BACKS.items():
    Image.open(os.path.join(src, f'{b}.png')).convert('RGB').resize((1536, 864), Image.LANCZOS).save(os.path.join(OUT, f'{b}.webp'), 'WEBP', quality=q, method=6)
  with open(OUT_TS, 'w') as f:
    f.write('// Generated by scripts/neon-art.py from the Codex neon paintings; do not edit by hand.\n')
    f.write('// Each atlas is a grid of cw x ch cells; a frame box is [x, y, w, h, footX, footY] in atlas pixels.\n')
    f.write('export type FrameBox = [number, number, number, number, number, number];\n')
    f.write('export interface Atlas { cw: number; ch: number; f: Record<string, FrameBox> }\n')
    f.write(f'export const NEON_ATLAS: Record<string, Atlas> = {json.dumps(atl, separators=(",", ":"))};\n')
    f.write("export const NEON_IMG = (name: string) => `/art/neon/${name}.webp`;\n")
  print('wrote', OUT_TS)


if __name__ == '__main__':
  main()
