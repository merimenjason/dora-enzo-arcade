#!/usr/bin/env python3
"""Salt & Dust: turns the Codex paintings into the game's art.

Every sprite sheet was painted as a 3 by 2 grid on flat green (#00FF00). This script keys the green out, cuts the six
cells, lines every frame up on the feet (so a figure never jumps between frames), scales each character to its size in
the game and packs its frames into one webp strip under public/art/salt-dust/. The backgrounds and event paintings are
cropped to 16:9; the UI sheets are cut into separate pieces, and the three square floor glows are turned into isometric
diamonds. lib/salt-dust-art.ts records each strip's cell size and frame count.

    python3 scripts/salt-dust-art.py <folder with the sd-*.png paintings> <folder with the mock-ups>

The prompts are in docs/salt-dust-art/jobs.txt, painted one at a time with docs/salt-dust-art/gen.sh.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
MOCK = Path(sys.argv[2] if len(sys.argv) > 2 else SRC)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'art' / 'salt-dust'
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = {}


def load(name):
    return Image.open(SRC / f'{name}.png').convert('RGBA')


def key(im):
    """flat green becomes clear; the green-tinted fringe is pulled back to neutral"""
    a = np.asarray(im.convert('RGBA')).astype(np.int16).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = g - np.maximum(r, b)
    hard = (m > 90) & (g > 150)
    soft = (m > 25) & ~hard
    a[..., 3][hard] = 0
    k = np.clip((m - 25) / 65.0, 0, 1)
    a[..., 3][soft] = (255 * (1 - k[soft])).astype(np.int16)
    # despill: green no higher than the larger of red and blue
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    a[..., 1] = np.where(a[..., 3] > 0, g2, g)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def cells(im, cols, rows, inset=0):
    w, h = im.width // cols, im.height // rows
    return [im.crop((x * w + inset, y * h + inset, x * w + w - inset, y * h + h - inset)) for y in range(rows) for x in range(cols)]


def biggest(im, keep=0.04):
    """drop specks: opaque pieces much smaller than the biggest, labelled on a quarter-size mask"""
    a = np.asarray(im).copy()
    m = a[::4, ::4, 3] > 40
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    for y0 in range(h):
        for x0 in range(w):
            if not m[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes); lab[y0, x0] = n
            stack, cnt = [(y0, x0)], 0
            while stack:
                y, x = stack.pop(); cnt += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; stack.append((yy, xx))
            sizes.append(cnt)
    if len(sizes) <= 2:
        return im
    big = max(sizes)
    drop = np.array([i == 0 or s < big * keep for i, s in enumerate(sizes)])
    drop[0] = False
    gone = np.repeat(np.repeat(drop[lab], 4, 0), 4, 1)[:a.shape[0], :a.shape[1]]
    a[..., 3][gone] = 0
    return Image.fromarray(a)


def bbox(im, t=40):
    a = np.asarray(im)[..., 3] > t
    ys, xs = np.nonzero(a)
    if not len(xs):
        return (0, 0, im.width, im.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def sprites(name, sheets, height):
    """a character's frames from its sheets, feet on one line, scaled so the first (idle) frame stands `height` px tall"""
    frames = []
    for s in sheets:
        frames += [biggest(c) for c in cells(key(load(s)), 3, 2, inset=6)]
    boxes = [bbox(f) for f in frames]
    scale = height / (boxes[0][3] - boxes[0][1])
    # each frame keeps its own place across the cell (the painter centred the figure); the feet go on the baseline
    cw = frames[0].width
    left = min(b[0] for b in boxes); right = max(b[2] for b in boxes)
    tall = max(b[3] - b[1] for b in boxes)
    pad = 6
    W = int((right - left) * scale) + pad * 2
    H = int(tall * scale) + pad * 2
    strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, (f, b) in enumerate(zip(frames, boxes)):
        piece = f.crop((left, b[1], right, b[3]))
        piece = piece.resize((max(1, int(piece.width * scale)), max(1, int(piece.height * scale))), Image.LANCZOS)
        strip.alpha_composite(piece, (i * W + pad, H - pad - piece.height))
    strip.save(OUT / f'{name}.webp', quality=88, method=6)
    # cell width, cell height, frames, the feet's row, the x of the figure's middle (from the idle frame)
    mid = int(((boxes[0][0] + boxes[0][2]) / 2 - left) * scale) + pad
    MANIFEST[name] = [W, H, len(frames), H - pad, mid]
    print(name, W, H, len(frames))


def plate(src, name, w=1536, h=864, q=84):
    """a 16:9 painting: scaled to `w` wide and the middle cropped to `h`"""
    im = Image.open(src).convert('RGB')
    s = w / im.width
    im = im.resize((w, int(im.height * s)), Image.LANCZOS)
    top = (im.height - h) // 2
    im.crop((0, top, w, top + h)).save(OUT / f'{name}.webp', quality=q, method=6)
    MANIFEST[name] = [w, h, 1, 0, 0]


def pieces(sheet, names, cols=3, rows=3, size=None):
    for c, n in zip(cells(key(load(sheet)), cols, rows, inset=4), names):
        if not n:
            continue
        c = biggest(c, 0.02) if n not in ('brackets',) else c
        c = c.crop(bbox(c, 20))
        if size and n in size:
            c = c.resize(size[n], Image.LANCZOS)
        c.save(OUT / f'ui-{n}.webp', quality=90, method=6)
        MANIFEST['ui-' + n] = [c.width, c.height, 1, 0, 0]


def diamond(sheet, idx, name):
    """a square floor glow, laid flat as a 2:1 isometric diamond (192×96, twice the tile)"""
    c = cells(key(load(sheet)), 3, 3, inset=4)[idx]
    c = c.crop(bbox(c, 20)).resize((256, 256), Image.LANCZOS)
    r = c.rotate(45, resample=Image.BICUBIC, expand=True)
    r = r.crop(bbox(r, 10)).resize((192, 96), Image.LANCZOS)
    r.save(OUT / f'{name}.webp', quality=90, method=6)
    MANIFEST[name] = [192, 96, 1, 0, 0]


if __name__ == '__main__':
    sprites('dora', ['sd-dora-move', 'sd-dora-fight', 'sd-dora-more', 'sd-dora-extra'], 150)
    sprites('enzo', ['sd-enzo-move', 'sd-enzo-fight', 'sd-enzo-more', 'sd-enzo-tools', 'sd-enzo-extra'], 162)
    sprites('fox', ['sd-fox-move', 'sd-fox-fight', 'sd-fox-more'], 146)
    sprites('warden', ['sd-warden'], 176)
    sprites('parina', ['sd-parina'], 200)
    sprites('wayra', ['sd-wayra'], 132)
    sprites('llama', ['sd-llama'], 150)
    # portraits: a 4×2 sheet; each cell's top square (the face) at 256 px
    por = load('sd-portraits').convert('RGB')
    strip = Image.new('RGB', (256 * 8, 256))
    for i, c in enumerate(cells(por, 4, 2, inset=10)):
        sq = c.crop((0, 0, c.width, c.width)).resize((256, 256), Image.LANCZOS)
        strip.paste(sq, (i * 256, 0))
    strip.save(OUT / 'portraits.webp', quality=86, method=6)
    MANIFEST['portraits'] = [256, 256, 8, 0, 0]
    for bg in ['bg-town', 'bg-yard', 'bg-map', 'ending', 'ev-caravan', 'ev-islands', 'ev-runners']:
        plate(SRC / f'sd-{bg}.png', bg)
    plate(MOCK / '4-keyart.png', 'title')
    pieces('sd-ui-a', ['plaque', 'plaque-lit', 'banner', 'canteen', 'drop', 'drop-empty', 'compass', 'pip', 'pip-empty'])
    pieces('sd-ui-b', ['frame', 'frame-lit', 'bar', None, None, None, 'brackets', 'tag', 'knot'])
    diamond('sd-ui-b', 3, 'tile-move')
    diamond('sd-ui-b', 4, 'tile-attack')
    diamond('sd-ui-b', 5, 'tile-grid')
    pan = load('sd-ui-panel').convert('RGB').resize((768, 768), Image.LANCZOS)
    pan.save(OUT / 'ui-panel.webp', quality=88, method=6)
    MANIFEST['ui-panel'] = [768, 768, 1, 0, 0]

    lines = ['// Generated by scripts/salt-dust-art.py: each art file’s cell width, cell height, frame count, the row of',
             '// the feet in a cell and the x of the figure’s middle (sprites only).',
             'export const ART: Record<string, number[]> = {']
    lines += [f"  '{k}': {v}," for k, v in MANIFEST.items()]
    lines += ['};', '']
    (ROOT / 'lib' / 'salt-dust-art.ts').write_text('\n'.join(lines))
    print('wrote', len(MANIFEST), 'entries')
