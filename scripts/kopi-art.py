#!/usr/bin/env python3
"""Kopi Peng Brawl art pipeline: Codex paintings on flat magenta -> packed WebP atlases + lib/kopi-art.ts.

  python3 scripts/kopi-art.py <paint-dir> [--debug <dir>]

<paint-dir> holds the 1536x1024 sheets (macaque-parts.png ... sfx.png, bg-1a.png ... bg-5c.png, title.png) and the
hero cut-outs (cut-dora/p*.png, cut-enzo/p*.png). Parts are keyed off the magenta, split into connected components,
ordered in reading order (rows, then left to right) and named from the lists below. --debug writes a labelled
contact image per sheet so the naming can be checked by eye.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_IMG = os.path.join(ROOT, 'public/art/kopi')
OUT_TS = os.path.join(ROOT, 'lib/kopi-art.ts')

# sheet -> (atlas id, scale, group dilation px, part names in reading order)
SHEETS = [
  ('macaque-parts', 'macaque', 0.5, 0, 'head torso tail ua uaF fa faF th thF sh shF'),
  ('rat-parts', 'rat', 0.4, 0, 'head body fl flF hl hlF tail'),
  ('mynah-parts', 'mynah', 0.4, 0, 'head body wing wingF fold leg legF tail'),
  ('monitor-parts', 'monitor', 0.45, 0, 'head body tail1 tail2 tail3 fl flF hl hlF'),
  ('python-parts', 'python', 0.45, 0, 'head headOpen seg1 seg2 seg3 seg4 tail'),
  ('toad-parts', 'toad', 0.5, 0, 'body bodyOpen arm armF leg legF tongue'),
  ('boar-parts', 'boar', 0.45, 0, 'body head fl flF hl hlF tail'),
  ('roach-parts', 'roach', 0.3, 0, 'walk wing wingF shell fly1 fly2 fly3 fly4'),
  ('king-parts', 'king', 0.6, 0, 'head torso cape ua uaF fa faF th thF sh shF tail'),
  ('boss-parts', 'bossparts', 1.0, 0,
   'tank-head tank-body tank-tail1 tank-tail2 tank-tail3 tank-fl tank-hl '
   'tusker-head tusker-body tusker-fl tusker-hl ong-body ong-bodyOpen ong-arm ong-leg'),
  ('bosses', 'bosses', 1.0, 0, 'tank ssst tusker ong'),
  ('hawkers', 'hawkers', 1.0, (40, 3, 3),
   'satay-stand satay-fan satay-cheer drinks-stand drinks-throw drinks-slide noodle-stand noodle-bang noodle-duck'),
  ('weapons', 'weapons', 0.5, 14, 'tray stool wok durian satay kopibag fish ice plate kopi chopsticks basin coconut pole'),
  # props are laid out loosely (the broken table is a dozen shards), so each part is a box on the 1536x1024 sheet
  ('props', 'props', 1.0, {'trolley': (40, 0, 440, 360), 'lion': (480, 40, 950, 360), 'lionup': (1020, 0, 1470, 370),
    'table': (30, 390, 350, 665), 'tablebroken': (350, 410, 780, 665), 'jet': (780, 380, 1536, 630),
    'durianroll': (30, 750, 330, 965), 'drum': (360, 720, 690, 1010), 'doors': (740, 690, 1140, 1000),
    'splash': (1180, 620, 1510, 1015)}, 'trolley lion lionup table tablebroken jet durianroll drum doors splash'),
  ('sfx', 'sfx', 1.0, 26,
   'PANG BONK WHAM KRAK DUSH POK SPLASH CLANG SSSS OINK CROAK GO KO burst1 burst2 burst3 smoke1 smoke2 smoke3'),
]
HEROES = [('dora', 0.5, 'head ua uaF tail fa faF torso th thF bow sh shF'),
          ('enzo', 0.5, 'head tail torso ua uaF fa faF th thF sh shF')]
# far-side limbs painted only once: a darkened copy is packed beside the original
DARK = {'bossparts': ['tank-fl', 'tank-hl', 'tusker-fl', 'tusker-hl', 'ong-arm', 'ong-leg']}
BGS = [f'bg-{s}{l}' for s in '12345' for l in 'abc']
MIN_PX = 1500
PAD = 3


def key(rgb):
  """Magenta key: hard mask for segmentation, soft alpha + colour unmixing only on the outline band."""
  im = rgb.astype(np.float32)
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  t = np.minimum(r, b) - g  # 255 on pure magenta, ~0 on ink and on the painted colours
  hard = t < 150
  hard = ndimage.binary_opening(hard, iterations=1)
  # enclosed magenta (a stool's legs, a bag's loop) stays transparent: no hole filling
  hard = hard | (ndimage.binary_closing(hard, iterations=1) & (t < 200))
  soft = np.clip(1 - (t - 25) / 210, 0, 1)
  inner = ndimage.binary_erosion(hard, iterations=3)
  a = np.where(inner, 1.0, np.where(hard, soft, 0.0))
  a = np.where(hard & ~inner, np.maximum(a, 0), a)
  # unmix: C = aF + (1-a)M  ->  F = (C - (1-a)M) / a, M = (255, 0, 255)
  M = np.array([255, 0, 255], np.float32)
  aa = np.maximum(a, 0.08)[..., None]
  F = (im - (1 - aa) * M) / aa
  F = np.where((a > 0.999)[..., None], im, F)
  F = np.clip(F, 0, 255)
  # last despill on the band: magenta cast (r,b above g) pulled down to the mean of the other channels
  band = (hard & ~inner)[..., None]
  sp = np.clip(np.minimum(F[..., 0], F[..., 2]) - F[..., 1] - 20, 0, None)[..., None]
  F = np.where(band, F - sp * np.array([1, 0, 1], np.float32) * 0.8, F)
  a = np.where(a < 0.04, 0, a)
  return np.dstack([np.clip(F, 0, 255), a * 255]).astype(np.uint8), hard


def cut(path, group, grid=None, min_px=MIN_PX):
  rgba, hard = key(np.asarray(Image.open(path).convert('RGB')))
  lab, n = ndimage.label(hard)
  sizes = ndimage.sum(hard, lab, range(1, n + 1))
  big = np.zeros(n + 1, bool); big[1:] = sizes >= min_px
  glab = np.where(big[lab], lab, 0)
  if group:
    # small pieces (the dot of a "!", motion lines round a hawker) join the nearest big part within `group` px
    dist, (iy, ix) = ndimage.distance_transform_edt(glab == 0, return_indices=True)
    for i in range(1, n + 1):
      if big[i] or sizes[i - 1] < 40: continue
      m = lab == i
      d = dist[m]; j = d.argmin()
      if d[j] <= group: glab[m] = glab[iy[m][j], ix[m][j]]
  if isinstance(grid, dict):
    # loose layouts: every piece (bar specks) whose centre falls in a named box joins that part
    lab2 = np.where(sizes[np.maximum(lab - 1, 0)] >= 30, lab, 0) * (lab > 0)
    coms = ndimage.center_of_mass(lab2 > 0, lab2, range(1, n + 1))
    cell = np.zeros(n + 1, int)
    for i, c in enumerate(coms):
      if np.isnan(c[0]): continue
      for j, (x0, y0, x1, y1) in enumerate(grid.values()):
        if x0 <= c[1] < x1 and y0 <= c[0] < y1: cell[i + 1] = j + 1; break
    glab = cell[lab2]
  elif grid:
    # sheets painted as a grid of poses: everything whose centre falls in a cell is one part
    cols, rws = grid; H, W = glab.shape
    coms = ndimage.center_of_mass(glab > 0, glab, range(1, n + 1))
    cell = np.zeros(n + 1, int)
    for i, c in enumerate(coms):
      if np.isnan(c[0]): continue
      cell[i + 1] = 1 + int(c[0] * rws / H) * cols + int(c[1] * cols / W)
    glab = cell[glab]
  parts = []
  for i, sl in enumerate(ndimage.find_objects(glab)):
    if sl is None: continue
    m = glab[sl] == i + 1
    y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
    pc = rgba[sl].copy(); pc[..., 3] = np.where(m, pc[..., 3], 0)
    parts.append(dict(cell=i, x=x0, y=y0, w=x1 - x0, h=y1 - y0, img=pc))
  if grid: return parts, rgba
  # reading order: a part starts a new row when its centre is below the current row's lowest top + half its height
  parts.sort(key=lambda p: p['y'] + p['h'] / 2)
  rows = []
  for p in parts:
    cy = p['y'] + p['h'] / 2
    if rows and cy < max(q['y'] + q['h'] for q in rows[-1]) - 10 and cy > min(q['y'] for q in rows[-1]): rows[-1].append(p)
    else: rows.append([p])
  return [p for row in rows for p in sorted(row, key=lambda p: p['x'])], rgba


def pack(items, maxw=2048):
  """Shelf pack, tallest first. items: list of (name, PIL RGBA). Returns (atlas, rects)."""
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
  # resize premultiplied so transparent edge colour does not bleed in
  p = np.asarray(im).astype(np.float32); a = p[..., 3:4] / 255
  pm = Image.fromarray(np.dstack([p[..., :3] * a, p[..., 3:]]).astype(np.uint8))
  w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
  q = np.asarray(pm.resize((w, h), Image.LANCZOS)).astype(np.float32); qa = q[..., 3:4] / 255
  rgb = np.where(qa > 0.004, q[..., :3] / np.maximum(qa, 0.004), 0)
  return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), q[..., 3:]]).astype(np.uint8))


def debug_sheet(path, parts, names, out):
  im = Image.open(path).convert('RGBA'); d = ImageDraw.Draw(im)
  for i, p in enumerate(parts):
    d.rectangle([p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']], outline=(0, 160, 0, 255), width=3)
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
  for sheet, aid, s, group, names in SHEETS:
    names = names.split(); path = os.path.join(src, sheet + '.png')
    grid = group[1:] if isinstance(group, tuple) else group if isinstance(group, dict) else None
    parts, _ = cut(path, 0 if isinstance(grid, dict) else group[0] if grid else group, grid)
    if dbg: debug_sheet(path, parts, names, os.path.join(dbg, sheet + '.png'))
    if len(parts) != len(names):
      problems.append(f'{sheet}: {len(parts)} parts, {len(names)} names'); continue
    items = [(n, scaled(p['img'], s)) for n, p in zip(names, parts)]
    for n in DARK.get(aid, []):
      im = dict(items)[n]; a = np.asarray(im).astype(np.float32)
      items.append((n + 'F', Image.fromarray(np.dstack([a[..., :3] * [0.7, 0.66, 0.72], a[..., 3:]]).astype(np.uint8))))
    atlas, rects = pack(items)
    atlas.save(os.path.join(OUT_IMG, aid + '.webp'), 'WEBP', quality=85, method=6, alpha_quality=90)
    atlases[aid] = dict(src=f'/art/kopi/{aid}.webp', scale=s, parts=rects, size=atlas.size)
  for hero, s, names in HEROES:
    items = []
    for i, n in enumerate(names.split()):
      # pad each cut to even size (right/bottom) so its rect is exactly cut size x scale and the rig's origin holds
      im = Image.open(os.path.join(src, f'cut-{hero}', f'p{i}.png')).convert('RGBA')
      ev = Image.new('RGBA', (im.width + im.width % 2, im.height + im.height % 2), (0, 0, 0, 0)); ev.paste(im, (0, 0))
      items.append((n, scaled(np.asarray(ev), s)))
    atlas, rects = pack(items)
    atlas.save(os.path.join(OUT_IMG, hero + '.webp'), 'WEBP', quality=88, method=6, alpha_quality=90)
    atlases[hero] = dict(src=f'/art/kopi/{hero}.webp', scale=s, parts=rects, size=atlas.size)
  for bg in BGS + ['title']:
    im = Image.open(os.path.join(src, bg + '.png')).convert('RGB')
    W, H = im.size; m = round(W * 0.015)
    im = im.crop((m, m, W - m, H - m))
    W2, H2 = im.size; h = round(W2 * 864 / 1536)
    if bg != 'title':
      im = im.crop((0, H2 - h, W2, H2)).resize((1536, 864), Image.LANCZOS)  # keep the floor: trim from the top
    else: im = im.resize((1536, round(H2 * 1536 / W2)), Image.LANCZOS)  # whole painting; the page fits it
    im.save(os.path.join(OUT_IMG, bg + '.webp'), 'WEBP', quality=80 if bg != 'title' else 86, method=6)
  write_ts(atlases)
  tot = sum(os.path.getsize(os.path.join(OUT_IMG, f)) for f in os.listdir(OUT_IMG))
  for k, a in atlases.items(): print(f"{k:10s} {a['size'][0]}x{a['size'][1]} {os.path.getsize(os.path.join(OUT_IMG, k + '.webp')) / 1024:.0f} KB")
  print(f'total {tot / 1e6:.2f} MB')
  if problems: print('PROBLEMS:\n  ' + '\n  '.join(problems)); sys.exit(1)


def write_ts(atlases):
  L = ['// Generated by scripts/kopi-art.py from the Codex paintings. Do not edit by hand; rerun the script.',
       '// Rects are [x, y, w, h] in atlas px; scale = atlas px per source-sheet px.', '',
       'export const KOPI_ATLAS: Record<string, { src: string; scale: number; parts: Record<string, [number, number, number, number]> }> = {']
  for k, a in atlases.items():
    ps = ', '.join(f"{json.dumps(n) if not n.isidentifier() else n}: [{r[0]}, {r[1]}, {r[2]}, {r[3]}]" for n, r in a['parts'].items())
    L.append(f"  {json.dumps(k) if not k.isidentifier() else k}: {{ src: '{a['src']}', scale: {a['scale']}, parts: {{ {ps} }} }},")
  L += ['};', '',
        f"export const KOPI_BG: string[] = [{', '.join(repr(b) for b in BGS)}];",
        "export const KOPI_BG_SRC = (id: string) => `/art/kopi/${id}.webp`;",
        "export const KOPI_TITLE = '/art/kopi/title.webp';",
        f"export const KOPI_ATLAS_IDS: string[] = [{', '.join(repr(k) for k in atlases)}];", '']
  open(OUT_TS, 'w').write('\n'.join(L))


if __name__ == '__main__':
  main()
