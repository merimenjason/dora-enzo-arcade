#!/usr/bin/env python3
"""Tambak art pipeline: Codex coloured-sand paintings -> web atlases and frame boxes.

  python3 scripts/tambak-art.py <paint-dir> [--debug <dir>]

Every picture in Tambak is a Codex painting in coloured sand on a lightbox. The sprite sheets (Dora, Enzo, the sea
creatures, Captain Bakau, the floating pickups) were painted on flat #00FF00; this script keys the green out by how
far green beats red and blue (so the olive crocodiles and sage sands stay), softens the edge, pulls the green spill
out of the fringe, refills small speckle holes the key punched inside a figure (but not real openings like the life
ring's middle), and writes each sheet as one webp with the same grid, plus the content box and foot point of every
frame to lib/tambak-art.ts. The six site paintings, the sea, the work table and the title go through at web size.

Outputs:
  public/art/tambak/<sheet>.webp   sprite atlases (alpha), one cell per frame
  public/art/tambak/<pic>.webp     the six site paintings, 1536x864
  public/art/tambak/sea.webp, table.webp, title.webp
  lib/tambak-art.ts                atlas cell sizes and per-frame boxes
"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/art/tambak')
OUT_TS = os.path.join(ROOT, 'lib/tambak-art.ts')

# sheet -> (cols, rows, output cell width, frame names in reading order)
SHEETS = {
  'dora': (4, 4, 176, 'idle blink downA downB rightA rightB upA upB pourA pourB hurt cheer sad wave flag dizzy'),
  'enzo': (4, 4, 176, 'idle blink downA downB rightA rightB upA upB pourA pourB hurt cheer sad wave flag dizzy'),
  'foes': (4, 3, 192, 'jellyA jellyB crocA crocB crocSnap puffS puffM puffL crabA crabB splash burst'),
  'boss': (2, 2, 288, 'swimA swimB lunge dizzy'),
  'items': (4, 2, 128, 'kopi net bucket ring flag star heart shell'),
}
PICS = ['ecp', 'marina', 'changi', 'jurong', 'semakau', 'tuas']
BACKS = {'sea': 90, 'table': 80, 'title': 86}


def key(rgb):
  """alpha from green dominance: pure key green is gone, anything with real red or blue in it stays"""
  r, g, b = (rgb[..., i].astype(np.float32) for i in range(3))
  dom = g - np.maximum(r, b)
  # full key at a lead of 110+, fully kept at 55 or less (olive croc greens lead by about 30 to 50)
  a = 1 - np.clip((dom - 55) / 55, 0, 1)
  a[(g < 120)] = 1
  solid = a > 0.5
  out = rgb.astype(np.float32).copy()
  # refill speckle holes (sand-grain gaps the key punched inside a figure, under 0.05% of the cell) with the colour
  # of the sand around them, never with the key green; bigger gaps such as between tentacles stay open
  holes = ~solid
  lab, n = ndimage.label(holes)
  if n:
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    lim = 0.0005 * holes.size
    fill = np.zeros(holes.shape, bool)
    for i, s in enumerate(sizes, 1):
      if i not in border and s < lim: fill |= lab == i
    if fill.any():
      w = ndimage.gaussian_filter(solid.astype(np.float32), 3) + 1e-6
      for c in range(3): out[..., c] = np.where(fill, ndimage.gaussian_filter(out[..., c] * solid, 3) / w, out[..., c])
      a[fill] = 1; solid = solid | fill
  # despill: near the edge, green may not exceed the brighter of red and blue by much
  r, g, b = (out[..., i] for i in range(3))
  edge = ndimage.binary_dilation(~solid, iterations=3) & solid
  mx = np.maximum(r, b)
  g2 = np.where(edge | (a < 1), np.minimum(g, mx + 12), g)
  out[..., 1] = g2
  # a touch of crumbly dark sand on the outermost edge, so a figure reads on a bright lightbox
  rim = ndimage.binary_dilation(~solid, iterations=1) & solid
  out[rim] *= 0.62
  return np.dstack([np.clip(out, 0, 255), a * 255]).astype(np.uint8)


def sheet(name, src, cols, rows, cw, frames, dbg):
  im = Image.open(src).convert('RGB')
  W, H = im.size
  sw, sh = W / cols, H / rows
  ch = round(cw * sh / sw)
  atlas = Image.new('RGBA', (cw * cols, ch * rows), (0, 0, 0, 0))
  boxes = {}
  for i, fname in enumerate(frames):
    cx, cy = i % cols, i // cols
    cell = im.crop((round(cx * sw), round(cy * sh), round((cx + 1) * sw), round((cy + 1) * sh)))
    rgba = key(np.asarray(cell))
    # anything touching the cell's edge that is not part of the main figure is a neighbour's spill: drop it
    solid = rgba[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    if n > 1:
      sizes = ndimage.sum(solid, lab, range(1, n + 1))
      keep = np.zeros(n + 1, bool); big = sizes.max()
      for j, s in enumerate(sizes, 1): keep[j] = s > 0.04 * big
      rgba[..., 3] = np.where(keep[lab], rgba[..., 3], 0)
    small = Image.fromarray(rgba).resize((cw, ch), Image.LANCZOS)
    arr = np.asarray(small)
    ys, xs = np.nonzero(arr[..., 3] > 60)
    if len(xs) == 0: raise SystemExit(f'{name}:{fname} is empty')
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    # the foot point: the middle of the lowest tenth of the figure
    low = ys >= y1 - max(2, (y1 - y0) // 10)
    fx = int(np.median(xs[low]))
    atlas.paste(small, (cx * cw, cy * ch))
    boxes[fname] = [cx * cw + x0, cy * ch + y0, x1 - x0, y1 - y0, cx * cw + fx, cy * ch + y1]
  atlas.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=88, method=6)
  if dbg:
    for bgc in [(246, 238, 215), (60, 40, 30)]:
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
  for name, (cols, rows, cw, names) in SHEETS.items():
    atl[name] = sheet(name, os.path.join(src, f'{name}.png'), cols, rows, cw, names.split(), dbg)
    print('sheet', name, atl[name]['cw'], atl[name]['ch'])
  for p in PICS:
    Image.open(os.path.join(src, f'{p}.png')).convert('RGB').resize((1536, 864), Image.LANCZOS).save(os.path.join(OUT, f'{p}.webp'), 'WEBP', quality=84, method=6)
  for b, q in BACKS.items():
    Image.open(os.path.join(src, f'{b}.png')).convert('RGB').resize((1536, 864), Image.LANCZOS).save(os.path.join(OUT, f'{b}.webp'), 'WEBP', quality=q, method=6)
  with open(OUT_TS, 'w') as f:
    f.write('// Generated by scripts/tambak-art.py from the Codex sand paintings; do not edit by hand.\n')
    f.write('// Each atlas is a grid of cw x ch cells; a frame box is [x, y, w, h, footX, footY] in atlas pixels.\n')
    f.write('export type FrameBox = [number, number, number, number, number, number];\n')
    f.write('export interface Atlas { cw: number; ch: number; f: Record<string, FrameBox> }\n')
    f.write(f'export const TAMBAK_ATLAS: Record<string, Atlas> = {json.dumps(atl, separators=(",", ":"))};\n')
    f.write(f'export const TAMBAK_PICS = {json.dumps(PICS)} as const;\n')
    f.write("export const TAMBAK_IMG = (name: string) => `/art/tambak/${name}.webp`;\n")
  print('wrote', OUT_TS)


if __name__ == '__main__':
  main()
