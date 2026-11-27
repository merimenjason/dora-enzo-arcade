#!/usr/bin/env python3
"""Dragon Playground art pipeline: Codex mosaic paintings on flat key colours -> packed WebP atlases + lib/dragon-art.ts.

  python3 scripts/dragon-art.py <paint-dir> [--debug <dir>]

<paint-dir> holds the 1536x1024 sheets (dragon.png, dora.png, ...) and the backdrops (bg1far.png ..., ground.png,
title.png). Each sheet is painted on its own flat key colour (green, cyan or magenta, picked so it never appears in the
art: magenta would eat the dragon's red tiles and the chinchillas' pink ears). Parts are keyed off, split into connected
components (small specks join the nearest part), put in reading order and named from the lists below. --debug writes a
labelled contact image per sheet so the naming can be checked by eye. Sprites keep one chip size: every character sheet
is scaled once here and the scene draws it 1:1; props are drawn to fit their footprint in the course.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, 'public/art/dragon')
OUT_TS = os.path.join(ROOT, 'lib/dragon-art.ts')
KEYS = {'g': (0, 255, 0), 'c': (0, 255, 255), 'm': (255, 0, 255)}

# sheet -> (atlas id, key, scale, join-specks-within px, part names in reading order)
SHEETS = [
  ('dragon', 'dragon', 'g', 0.36, 12, 'head headOpen segH seg leg legB tail'),
  ('dora', 'dora', 'g', 0.42, 20, 'sit lean swat grab hang cheer flap wobble'),
  ('enzo', 'enzo', 'g', 0.42, 20, 'sit lean swat grab hang cheer flap wobble'),
  ('otters', 'otters', 'g', 0.5, 40, 'run1 run2 run3 run4 jump dive pop stumble cheer barge belly'),
  ('crows', 'crows', 'g', 0.45, 44, 'fly1 fly2 swoop steal knocked toast chips sand'),
  ('props', 'props', 'c', 1.0, 10, 'slide seesaw swing bars mgr bench pole grate finish'),
  ('bg1mid', 'mid1', 'm', 0.8, 10, 'tree shrub lamp pillar bike rail walkway palm'),
  ('dove', 'dove', 'g', 0.75, 30, 'asleep awake'),
]
BGS = ['bg1far']
MIN_PX = 1200
PAD = 3


def key(rgb, k):
  """Hard mask for segmentation, soft alpha and colour unmixing on the outline band, for any of the three keys."""
  im = rgb.astype(np.float32); r, g, b = im[..., 0], im[..., 1], im[..., 2]
  if k == 'g': t = g - np.maximum(r, b)
  elif k == 'c': t = np.minimum(g, b) - r
  else: t = np.minimum(r, b) - g
  hard = t < 150
  hard = ndimage.binary_opening(hard, iterations=1)
  hard = hard | (ndimage.binary_closing(hard, iterations=1) & (t < 200))
  soft = np.clip(1 - (t - 25) / 210, 0, 1)
  inner = ndimage.binary_erosion(hard, iterations=3)
  a = np.where(inner, 1.0, np.where(hard, soft, 0.0))
  M = np.array(KEYS[k], np.float32)
  aa = np.maximum(a, 0.08)[..., None]
  F = (im - (1 - aa) * M) / aa
  F = np.where((a > 0.999)[..., None], im, F)
  F = np.clip(F, 0, 255)
  band = (hard & ~inner)[..., None]
  # despill: pull the key's cast out of the outline band
  if k == 'g': sp = np.clip(F[..., 1] - np.maximum(F[..., 0], F[..., 2]) - 10, 0, None)[..., None]; F = np.where(band, F - sp * np.array([0, 1, 0], np.float32), F)
  elif k == 'c': sp = np.clip(np.minimum(F[..., 1], F[..., 2]) - F[..., 0] - 20, 0, None)[..., None]; F = np.where(band, F - sp * np.array([0, 0.8, 0.8], np.float32), F)
  else: sp = np.clip(np.minimum(F[..., 0], F[..., 2]) - F[..., 1] - 20, 0, None)[..., None]; F = np.where(band, F - sp * np.array([0.8, 0, 0.8], np.float32), F)
  a = np.where(a < 0.04, 0, a)
  return np.dstack([np.clip(F, 0, 255), a * 255]).astype(np.uint8), hard


def cut(path, k, group):
  rgba, hard = key(np.asarray(Image.open(path).convert('RGB')), k)
  # a few px of the sheet's edge are often not perfectly flat: ignore them
  hard[:6] = hard[-6:] = False; hard[:, :6] = hard[:, -6:] = False
  # everything within `group` px of each other is one part: dilate, label, then keep only the real pixels
  lab, n = ndimage.label(ndimage.binary_dilation(hard, iterations=max(1, group // 2)) if group else hard)
  glab = np.where(hard, lab, 0)
  sizes = ndimage.sum(hard, glab, range(1, n + 1))
  small = np.zeros(n + 1, bool); small[1:] = sizes < MIN_PX
  glab = np.where(small[glab], 0, glab)
  parts = []
  for i, sl in enumerate(ndimage.find_objects(glab)):
    if sl is None: continue
    m = glab[sl] == i + 1
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    pc = rgba[sl].copy(); pc[..., 3] = np.where(m, pc[..., 3], 0)
    parts.append(dict(x=x0, y=y0, w=x1 - x0, h=y1 - y0, img=pc))
  parts.sort(key=lambda p: p['y'] + p['h'] / 2)
  rows = []
  for p in parts:
    cy = p['y'] + p['h'] / 2
    if rows and cy < max(q['y'] + q['h'] for q in rows[-1]) - 10 and cy > min(q['y'] for q in rows[-1]): rows[-1].append(p)
    else: rows.append([p])
  return [p for row in rows for p in sorted(row, key=lambda p: p['x'])]


def pack(items, maxw=2048):
  order = sorted(items, key=lambda it: -it[1].height)
  area = sum((im.width + PAD * 2) * (im.height + PAD * 2) for _, im in items)
  W = min(maxw, max(max(im.width for _, im in items) + PAD * 2, int((area * 1.15) ** 0.5)))
  x = y = sh = 0; rects = {}
  for name, im in order:
    w, h = im.width + PAD * 2, im.height + PAD * 2
    if x + w > W: x = 0; y += sh; sh = 0
    rects[name] = (x + PAD, y + PAD, im.width, im.height); x += w; sh = max(sh, h)
  H = y + sh
  assert W <= 2048 and H <= 2048, (W, H)
  atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
  for name, im in items: atlas.paste(im, rects[name][:2])
  return atlas, rects


def scaled(arr, s):
  im = Image.fromarray(arr)
  if s == 1: return im
  p = np.asarray(im).astype(np.float32); a = p[..., 3:4] / 255
  pm = Image.fromarray(np.dstack([p[..., :3] * a, p[..., 3:]]).astype(np.uint8))
  w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
  q = np.asarray(pm.resize((w, h), Image.LANCZOS)).astype(np.float32); qa = q[..., 3:4] / 255
  rgb = np.where(qa > 0.004, q[..., :3] / np.maximum(qa, 0.004), 0)
  return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), q[..., 3:]]).astype(np.uint8))


def debug_sheet(path, parts, names, out):
  im = Image.open(path).convert('RGBA'); d = ImageDraw.Draw(im)
  for i, p in enumerate(parts):
    d.rectangle([p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']], outline=(0, 0, 0, 255), width=3)
    lbl = names[i] if i < len(names) else f'?{i}'
    d.rectangle([p['x'], p['y'], p['x'] + 9 * len(lbl) + 8, p['y'] + 16], fill=(255, 255, 255, 255))
    d.text((p['x'] + 4, p['y'] + 3), lbl, fill=(0, 0, 0, 255))
  im.convert('RGB').save(out)


def main():
  if len(sys.argv) < 2: sys.exit(__doc__)
  src = sys.argv[1]
  dbg = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
  os.makedirs(OUT_IMG, exist_ok=True)
  if dbg: os.makedirs(dbg, exist_ok=True)
  atlases = {}; problems = []
  for sheet, aid, k, s, group, names in SHEETS:
    names = names.split(); path = os.path.join(src, sheet + '.png')
    parts = cut(path, k, group)
    if dbg: debug_sheet(path, parts, names, os.path.join(dbg, sheet + '.png'))
    if len(parts) != len(names):
      problems.append(f'{sheet}: {len(parts)} parts, {len(names)} names'); continue
    items = [(n, scaled(p['img'], s)) for n, p in zip(names, parts)]
    atlas, rects = pack(items)
    atlas.save(os.path.join(OUT_IMG, aid + '.webp'), 'WEBP', quality=86, method=6, alpha_quality=90)
    atlases[aid] = dict(src=f'/art/dragon/{aid}.webp', scale=s, parts=rects, size=atlas.size)
  # the ground: four seamless bands, each 256 px tall on the sheet, kept at 0.75
  g = Image.open(os.path.join(src, 'ground.png')).convert('RGB')
  for i, nm in enumerate(['path', 'sand', 'grass', 'drain']):
    band = g.crop((0, i * 256, 1536, (i + 1) * 256)).resize((1152, 192), Image.LANCZOS)
    band.save(os.path.join(OUT_IMG, f'ground-{nm}.webp'), 'WEBP', quality=82, method=6)
  for bg in BGS:
    im = Image.open(os.path.join(src, bg + '.png')).convert('RGB').resize((1536, 864), Image.LANCZOS)
    im.save(os.path.join(OUT_IMG, bg + '.webp'), 'WEBP', quality=80, method=6)
  im = Image.open(os.path.join(src, 'title.png')).convert('RGB').resize((1536, 864), Image.LANCZOS)
  im.save(os.path.join(OUT_IMG, 'title.webp'), 'WEBP', quality=86, method=6)
  write_ts(atlases)
  tot = sum(os.path.getsize(os.path.join(OUT_IMG, f)) for f in os.listdir(OUT_IMG))
  for k2, a in atlases.items(): print(f"{k2:8s} {a['size'][0]}x{a['size'][1]} {os.path.getsize(os.path.join(OUT_IMG, k2 + '.webp')) / 1024:.0f} KB")
  print(f'total {tot / 1e6:.2f} MB')
  if problems: print('PROBLEMS:\n  ' + '\n  '.join(problems)); sys.exit(1)


def write_ts(atlases):
  L = ['// Generated by scripts/dragon-art.py from the Codex mosaic paintings. Do not edit by hand; rerun the script.',
       '// Rects are [x, y, w, h] in atlas px; scale = atlas px per source-sheet px.', '',
       'export const DRAGON_ATLAS: Record<string, { src: string; scale: number; parts: Record<string, [number, number, number, number]> }> = {']
  for k, a in atlases.items():
    ps = ', '.join(f"{json.dumps(n) if not n.isidentifier() else n}: [{r[0]}, {r[1]}, {r[2]}, {r[3]}]" for n, r in a['parts'].items())
    L.append(f"  {json.dumps(k) if not k.isidentifier() else k}: {{ src: '{a['src']}', scale: {a['scale']}, parts: {{ {ps} }} }},")
  L += ['};', '',
        f"export const DRAGON_BG: string[] = [{', '.join(repr(b) for b in BGS)}];",
        "export const DRAGON_IMG = (id: string) => `/art/dragon/${id}.webp`;",
        "export const DRAGON_GROUNDS = ['path', 'sand', 'grass', 'drain'] as const;",
        f"export const DRAGON_ATLAS_IDS: string[] = [{', '.join(repr(k) for k in atlases)}];", '']
  open(OUT_TS, 'w').write('\n'.join(L))


if __name__ == '__main__':
  main()
