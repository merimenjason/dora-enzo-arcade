#!/usr/bin/env python3
"""Moth Hoop art pipeline: Codex paintings -> stitch atlases, cloth, frame, and the sprite and picture grids.

  python3 scripts/moth-art.py <paint-dir> [--debug <dir>]

Every visible thing in Moth Hoop is drawn by lib/moth-scene.ts as real cross stitches: the scene tints Codex-painted
macro photos of single white cotton crosses (stitches.png) to each colour and lays them on Codex aida cloth. So the
characters, moths and kit pictures are painted by Codex as pixel art, and this script reads each painting back to its
art-pixel grid (finding the block pitch from the colour edges), keys the flat green out, and writes the grids as
palette strings: sprites to lib/moth-art.ts and the six kit pictures to lib/moth-patterns.ts (which the engine reads).

Outputs:
  public/art/moth/stitches.webp  32 white crosses, 48 px cells, alpha
  public/art/moth/holes.webp     8 chewed holes, 64 px cells, alpha (the dark under the cloth shows through)
  public/art/moth/aida.webp      seamless aida, 24 px per weave square (2x of a 12 px stitch cell)
  public/art/moth/frame.webp     the hoop and sewing table, transparent inside the ring
  public/art/moth/<bg>.webp      backdrops (title, gallery, rail) copied through at web size
"""
import os, sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/art/moth')
OUT_ART = os.path.join(ROOT, 'lib/moth-art.ts')
OUT_PAT = os.path.join(ROOT, 'lib/moth-patterns.ts')

# sprite sheets: name -> frame names in reading order (rows top to bottom, left to right)
SHEETS = {
  'dora': 'idle blink leanL leanR raise throw hurt cheer ko wave hold sad',
  'enzo': 'idle blink leanL leanR raise throw hurt cheer ko wave hold sad',
  'moths': 'mothUp mothDown mothLand mothChew goldUp goldDown goldDive larva',
  'moths2': 'silkUp silkDown silkHit cocoon larva2 larvaChew goldShiver mothHit',
  'queen': 'queenUp queenDown queenLay queenHit',
  'props': 'reel reelSpin buttonLav buttonTriple buttonGold buttonThimble needle egg',
}
# kit pictures: name -> (field row of the picture's top, colours kept)
PATTERNS = ['kopi', 'flats', 'merlion', 'tiles', 'supertrees', 'ndp']
FIELD_W, PIC_TOP, PIC_BOTTOM = 128, 7, 48
CHARS = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'


def is_key_green(px):
  px = px.astype(np.int32)
  return (px[..., 1] > 150) & (px[..., 1] - np.maximum(px[..., 0], px[..., 2]) > 90)


def pitch_1d(edge):
  """best (pitch, offset) so that block boundaries land on colour edges; edge is a 1-D edge-strength profile"""
  n = len(edge); best = (0, 8.0, 0.0)
  e = edge / (edge.mean() + 1e-6)
  for p in np.arange(8.0, 64.0, 0.05):
    k = np.arange(0, n / p + 1)
    for o in np.arange(0, p, max(1.0, p / 24)):
      idx = np.round(o + k * p).astype(int); idx = idx[(idx > 0) & (idx < n)]
      if len(idx) < 4: continue
      s = e[idx].mean() - 0.002 * p   # prefer the finest pitch that explains the edges
      if s > best[0]: best = (s, p, o)
  # refine the offset at 0.25 px
  p = best[1]; k = np.arange(0, n / p + 1); bo, bs = best[2], -1
  for o in np.arange(0, p, 0.25):
    idx = np.round(o + k * p).astype(int); idx = idx[(idx > 0) & (idx < n)]
    s = e[idx].mean()
    if s > bs: bs, bo = s, o
  return p, bo


def runs_along(a, axis):
  """lengths of flat-colour runs along rows (axis=1) or columns (axis=0), from every third line"""
  if axis == 0: a = a.transpose(1, 0, 2)
  out = []
  for line in a[::3]:
    d = np.abs(np.diff(line, axis=0)).sum(1) > 60
    pos = np.flatnonzero(d)
    if len(pos) < 2: continue
    # an anti-aliased edge changes over a few pixels: keep the first change of each cluster
    keep = [pos[0]]
    for p in pos[1:]:
      if p - keep[-1] > 3: keep.append(p)
    out.extend(np.diff(keep))
  return np.array(out, np.float32)


def block_pitch(a):
  """the art-pixel size: the first strong peak of the flat-colour run lengths (Codex's blocks wobble a little, so
  this is a mean, not an exact grid)"""
  r = np.concatenate([runs_along(a, 1), runs_along(a, 0)])
  r = r[(r >= 6) & (r < 200)]
  h = np.bincount(r.astype(int), minlength=200).astype(np.float32)
  h = np.convolve(h, [1, 2, 3, 2, 1], 'same')
  top = h.max()
  for i in range(7, 199):
    if h[i] >= 0.45 * top and h[i] >= h[i - 1] and h[i] >= h[i + 1]:
      near = r[(r > i * 0.8) & (r < i * 1.2)]
      return float(near.mean())
  raise SystemExit('no pixel pitch found')


def edge_offset(a, p, axis):
  d = np.abs(np.diff(a, axis=axis)).sum(2) > 60
  e = np.concatenate([[0], d.mean(0 if axis == 1 else 1)])
  n = len(e); k = np.arange(0, n / p + 1); bo, bs = 0.0, -1
  for o in np.arange(0, p, 0.25):
    idx = np.round(o + k * p).astype(int); idx = idx[(idx > 0) & (idx < n)]
    s = e[idx].sum()
    if s > bs: bs, bo = s, o
  return bo


def grid_sample(img, max_w=10000, force=None):
  """pixel-art painting -> (art-pixel RGB grid, key mask). Reads the block pitch from the flat-colour runs; if that
  gives a grid wider than max_w (Codex painted finer detail than asked), the pitch doubles."""
  a = np.asarray(img.convert('RGB')).astype(np.int32)
  p = force or block_pitch(a)
  if a.shape[1] / p > max_w * 1.02:
    # painted finer than asked: sample it straight onto a max_w-wide grid
    p = a.shape[1] / max_w; ox = oy = 0.0
  else:
    ox = edge_offset(a, p, 1); oy = edge_offset(a, p, 0)
  cols = int((a.shape[1] - ox) // p); rows = int((a.shape[0] - oy) // p)
  out = np.zeros((rows, cols, 3), np.uint8); key = np.zeros((rows, cols), bool)
  for r in range(rows):
    for c in range(cols):
      x0 = int(ox + c * p + p * 0.25); x1 = int(ox + (c + 1) * p - p * 0.25)
      y0 = int(oy + r * p + p * 0.25); y1 = int(oy + (r + 1) * p - p * 0.25)
      blk = a[y0:max(y1, y0 + 1), x0:max(x1, x0 + 1)].reshape(-1, 3)
      g = is_key_green(blk)
      if g.mean() > 0.5: key[r, c] = True; continue
      out[r, c] = np.median(blk[~g], axis=0).astype(np.uint8)
  return out, key, p


def kmeans(X, k, it=30, seed=1):
  rng = np.random.default_rng(seed)
  X = X.astype(np.float32)
  if len(X) <= k: return X.copy(), np.arange(len(X))
  C = X[rng.choice(len(X), k, replace=False)]
  for _ in range(it):
    d = ((X[:, None, :] - C[None]) ** 2).sum(2); lab = d.argmin(1)
    for j in range(k):
      m = X[lab == j]
      if len(m): C[j] = m.mean(0)
  d = ((X[:, None, :] - C[None]) ** 2).sum(2)
  return C, d.argmin(1)


def palettise(grid, key, k):
  """quantise the opaque cells to at most k colours, merging near-duplicates"""
  pts = grid[~key].reshape(-1, 3)
  C, _ = kmeans(pts, min(k, len(np.unique(pts, axis=0))))
  # merge centres closer than 14 in RGB
  keep = []
  for c in C:
    if all(np.abs(c - q).sum() > 14 for q in keep): keep.append(c)
  C = np.array(keep)
  d = ((grid.reshape(-1, 3)[:, None, :].astype(np.float32) - C[None]) ** 2).sum(2)
  idx = d.argmin(1).reshape(grid.shape[:2]) + 1
  idx[key] = 0
  pal = ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in C]
  return idx, pal


def components(mask):
  lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
  boxes = ndimage.find_objects(lab)
  parts = []
  for i, b in enumerate(boxes):
    size = (lab[b] == i + 1).sum()
    parts.append({'id': i + 1, 'box': b, 'size': size})
  return lab, parts


def split_sheet(idx, names, debug=None):
  """split a sheet's art-pixel grid into figures (small specks join the nearest figure), in reading order"""
  mask = idx > 0
  lab, parts = components(mask)
  big = [p for p in parts if p['size'] >= 12]
  small = [p for p in parts if p['size'] < 12]
  cen = lambda p: ((p['box'][0].start + p['box'][0].stop) / 2, (p['box'][1].start + p['box'][1].stop) / 2)
  for s in small:
    sy, sx = cen(s)
    tgt = min(big, key=lambda b: (cen(b)[0] - sy) ** 2 + (cen(b)[1] - sx) ** 2)
    lab[lab == s['id']] = tgt['id']
  # a figure may come in several big pieces (sparkles, a needle): merge pieces whose boxes come within 2 cells
  groups = [[b] for b in big]
  def gbox(g):
    return (min(b['box'][0].start for b in g), max(b['box'][0].stop for b in g), min(b['box'][1].start for b in g), max(b['box'][1].stop for b in g))
  merged = True
  while merged and len(groups) > len(names):
    merged = False
    best = None
    for i in range(len(groups)):
      for j in range(i + 1, len(groups)):
        a, b = gbox(groups[i]), gbox(groups[j])
        gapy = max(0, max(a[0], b[0]) - min(a[1], b[1])); gapx = max(0, max(a[2], b[2]) - min(a[3], b[3]))
        gap = max(gapy, gapx)
        if best is None or gap < best[0]: best = (gap, i, j)
    if best and len(groups) > len(names):
      _, i, j = best; groups[i] += groups.pop(j); merged = True
  if len(groups) != len(names):
    raise SystemExit(f'expected {len(names)} figures, found {len(groups)}')
  # reading order: rows by the box centre, then columns
  boxes = [gbox(g) for g in groups]
  hts = np.median([b[1] - b[0] for b in boxes])
  order = sorted(range(len(groups)), key=lambda i: (round(((boxes[i][0] + boxes[i][1]) / 2) / (hts * 1.1)), boxes[i][2]))
  frames = {}
  for name, gi in zip(names, order):
    y0, y1, x0, x1 = boxes[gi]
    ids = {b['id'] for b in groups[gi]}
    sub = idx[y0:y1, x0:x1].copy()
    sub[~np.isin(lab[y0:y1, x0:x1], list(ids))] = 0
    frames[name] = sub
  return frames


def enc(sub):
  return [''.join('.' if v == 0 else CHARS[v - 1] for v in row) for row in sub]


def key_alpha(rgb, k):
  im = rgb.astype(np.float32); r, g, b = im[..., 0], im[..., 1], im[..., 2]
  t = g - np.maximum(r, b) if k == 'g' else np.minimum(r, b) - g
  a = np.clip(1 - (t - 30) / 120, 0, 1)
  return a


def save_webp(img, name, q=88):
  os.makedirs(OUT, exist_ok=True)
  img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)


def stitches(src):
  im = np.asarray(Image.open(src).convert('RGB'))
  H, W = im.shape[:2]; cw, ch = W // 8, H // 4
  out = Image.new('RGBA', (8 * 48, 4 * 48))
  for r in range(4):
    for c in range(8):
      cell = im[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
      a = key_alpha(cell, 'g')
      # the floss is white: keep its light (sheen and shadow) as grey, so the scene can multiply it by any colour
      lum = cell.astype(np.float32) @ np.array([0.3, 0.59, 0.11], np.float32)
      lum = np.clip((lum - 40) / (235 - 40), 0, 1) * 255
      # despill: green-tinted edge pixels read as darker
      rgba = np.dstack([lum, lum, lum, a * 255]).astype(np.uint8)
      tile = Image.fromarray(rgba)
      bb = tile.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
      if bb:
        # centre the cross and fit it to 92% of the cell
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2; s = max(bb[2] - bb[0], bb[3] - bb[1]) / 0.92 / 2
        tile = tile.crop((int(cx - s), int(cy - s), int(cx + s), int(cy + s)))
      out.paste(tile.resize((48, 48), Image.LANCZOS), (c * 48, r * 48))
  save_webp(out, 'stitches', 92)


def holes(src):
  im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
  H, W = im.shape[:2]; cw, ch = W // 4, H // 2
  out = Image.new('RGBA', (8 * 64, 64))
  for i in range(8):
    r, c = divmod(i, 4)
    cell = im[r * ch:(r + 1) * ch, c * cw:(c + 1) * cw]
    ag = key_alpha(cell, 'g')
    am = key_alpha(cell, 'm')
    # the magenta inside the hole is the dark under the cloth; the green outside is nothing
    dark = np.array([34, 22, 16], np.float32)
    rgb = cell * am[..., None] + dark * (1 - am[..., None])
    rgb = np.where((ag < 0.5)[..., None], rgb, rgb)
    alpha = ag.copy()
    # fade the aida ring out so it melts into the cloth underneath
    yy, xx = np.mgrid[0:ch, 0:cw]; d = np.hypot(yy - ch / 2, xx - cw / 2) / (min(cw, ch) / 2)
    alpha *= np.clip((1.0 - d) / 0.28, 0, 1)
    rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    out.paste(Image.fromarray(rgba).resize((64, 64), Image.LANCZOS), (i * 64, 0))
  save_webp(out, 'holes', 90)


def aida(src):
  im = Image.open(src).convert('RGB')
  # 32 weave squares across the painting -> 24 px each
  save_webp(im.resize((768, 768), Image.LANCZOS), 'aida', 86)


def frame(src):
  im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
  a = key_alpha(im, 'm')                      # opacity: 0 on the magenta key inside the ring
  a = ndimage.grey_erosion(a, size=3)         # eat the one-pixel magenta fringe
  # despill: pull leftover magenta out of the edge pixels
  r, g, b = im[..., 0], im[..., 1], im[..., 2]
  spill = np.clip(np.minimum(r, b) - g, 0, None)
  im = np.dstack([r - spill * 0.6, g, b - spill * 0.6]).clip(0, 255)
  rgba = np.dstack([im.astype(np.uint8), (a * 255).astype(np.uint8)])
  save_webp(Image.fromarray(rgba), 'frame', 88)


def main():
  if len(sys.argv) < 2: raise SystemExit(__doc__)
  src = sys.argv[1]
  debug = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None
  if debug: os.makedirs(debug, exist_ok=True)
  P = lambda n: os.path.join(src, n + '.png')
  stitches(P('stitches')); holes(P('holes')); aida(P('aida')); frame(P('frame'))
  for bg in ['title', 'gallery', 'rail', 'wall']:
    if os.path.exists(P(bg)):
      im = Image.open(P(bg))
      if bg == 'rail':
        rgb = np.asarray(im.convert('RGB')); a = key_alpha(rgb, 'g')
        im = Image.fromarray(np.dstack([rgb, (a * 255).astype(np.uint8)]))
        bb = im.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox(); im = im.crop(bb)
      else: im = im.convert('RGB')
      im.thumbnail((1536, 1536)); save_webp(im, bg, 86)

  sprites, spal = {}, None
  # one shared sprite palette so every sheet tints the same stitch colours
  grids = {}
  for name, names in SHEETS.items():
    if not os.path.exists(P(name)): print('skip sheet', name); continue
    g, key, p = grid_sample(Image.open(P(name)))
    grids[name] = (g, key, names.split())
    print(f'{name}: pitch {p:.2f}px -> {g.shape[1]}x{g.shape[0]} art px')
  allpts = np.concatenate([g[~k].reshape(-1, 3) for g, k, _ in grids.values()]) if grids else np.zeros((0, 3))
  C, _ = kmeans(allpts, 56) if len(allpts) else (np.zeros((0, 3)), None)
  keep = []
  for c in C:
    if all(np.abs(c - q).sum() > 12 for q in keep): keep.append(c)
  C = np.array(keep)
  spal = ['#%02x%02x%02x' % tuple(int(v) for v in c) for c in C]
  for name, (g, key, names) in grids.items():
    d = ((g.reshape(-1, 3)[:, None, :].astype(np.float32) - C[None]) ** 2).sum(2)
    idx = (d.argmin(1) + 1).reshape(g.shape[:2]); idx[key] = 0
    frames = split_sheet(idx, names)
    for fn, sub in frames.items():
      sprites[f'{name}.{fn}' if name.startswith('moths') or name == 'props' or name == 'queen' else f'{name}.{fn}'] = sub
    if debug:
      rgbs = np.zeros(idx.shape + (3,), np.uint8); rgbs[:] = (0, 255, 0)
      for i, c in enumerate(C): rgbs[idx == i + 1] = c.astype(np.uint8)
      Image.fromarray(rgbs).resize((idx.shape[1] * 8, idx.shape[0] * 8), Image.NEAREST).save(os.path.join(debug, f'{name}.png'))

  with open(OUT_ART, 'w') as f:
    f.write('// Generated by scripts/moth-art.py from the Codex pixel-art sheets. Do not edit by hand; rerun the script.\n')
    f.write('// Each sprite is rows of palette characters (`.` is empty): the scene stitches every art pixel as one cross.\n\n')
    f.write(f'export const SPRITE_PALETTE: string[] = {json.dumps(spal)};\n')
    f.write(f'export const SPRITE_CHARS = {json.dumps(CHARS)};\n')
    f.write('export const SPRITES: Record<string, string[]> = {\n')
    for k, sub in sprites.items(): f.write(f'  {json.dumps(k)}: {json.dumps(enc(sub))},\n')
    f.write('};\n')
    f.write("export const MOTH_IMG = (id: string) => `/art/moth/${id}.webp`;\n")

  pats = {}
  for name in PATTERNS:
    if not os.path.exists(P(name)): print('skip pattern', name); continue
    g, key, p = grid_sample(Image.open(P(name)), 80)
    # trim the green margins
    ys, xs = np.where(~key)
    g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]; key = key[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    idx, pal = palettise(g, key, 12)
    h, w = idx.shape
    if w > 100 or h > PIC_BOTTOM - PIC_TOP: raise SystemExit(f'pattern {name} is {w}x{h}, too big')
    x0 = (FIELD_W - w) // 2; y0 = PIC_TOP + (PIC_BOTTOM - PIC_TOP - h) // 2
    pats[name] = {'w': int(w), 'h': int(h), 'x0': int(x0), 'y0': int(y0), 'palette': pal, 'rows': enc(idx)}
    print(f'pattern {name}: pitch {p:.2f}px -> {w}x{h}, {len(pal)} colours, {(idx > 0).sum()} stitches')
    if debug:
      rgbs = np.zeros((h, w, 3), np.uint8); rgbs[:] = (239, 228, 207)
      for i, c in enumerate(pal): rgbs[idx == i + 1] = tuple(int(c[j:j + 2], 16) for j in (1, 3, 5))
      Image.fromarray(rgbs).resize((w * 10, h * 10), Image.NEAREST).save(os.path.join(debug, f'pat-{name}.png'))

  with open(OUT_PAT, 'w') as f:
    f.write('// Generated by scripts/moth-art.py from the Codex kit pictures. Do not edit by hand; rerun the script.\n')
    f.write('// A kit picture: one character per stitch (`.` is bare cloth), placed at (x0, y0) on the 128 x 72 field.\n\n')
    f.write('export interface Pattern { w: number; h: number; x0: number; y0: number; palette: string[]; cells: Uint8Array }\n')
    f.write(f'const CH = {json.dumps(CHARS)};\n')
    f.write('const make = (w: number, h: number, x0: number, y0: number, palette: string[], rows: string[]): Pattern => {\n')
    f.write("  const cells = new Uint8Array(w * h);\n  rows.forEach((r, y) => { for (let x = 0; x < w; x++) { const ch = r[x]; cells[y * w + x] = ch === '.' ? 0 : CH.indexOf(ch) + 1; } });\n")
    f.write('  return { w, h, x0, y0, palette, cells };\n};\n\n')
    f.write('export const MOTH_PATTERNS: Record<string, Pattern> = {\n')
    for k, v in pats.items():
      f.write(f"  {k}: make({v['w']}, {v['h']}, {v['x0']}, {v['y0']}, {json.dumps(v['palette'])}, {json.dumps(v['rows'])}),\n")
    f.write('};\n')


if __name__ == '__main__':
  main()
