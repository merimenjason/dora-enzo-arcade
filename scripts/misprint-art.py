#!/usr/bin/env python3
"""Misprint art: turns the Codex-painted risograph sources into the lean webp set in public/art/misprint/.

    python3 scripts/misprint-art.py <folder with the mp-*.png sources>

- The paintings (title poster, three zine covers, three reward prints) are resized and saved as webp.
- The paper scan is made seamless (each edge cross-faded with the opposite one) so it tiles under every page.
- The two sprite sheets (Dora in pink only, Enzo in teal only, each a 3 by 2 grid on white paper) and the tile sheet
  (teal only, 4 by 2) are keyed: the white paper becomes transparent and the one ink becomes a white alpha mask, so
  the game can tint every piece with the exact ink colour and composite the plates with a multiply blend. Each piece
  is trimmed to its ink and packed into a strip of equal cells; sprites share one baseline (their feet) and are
  centred on their head, so the frames don't jitter when they animate.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'misprint'
OUT.mkdir(parents=True, exist_ok=True)

PINK = (255, 72, 176)
TEAL = (0, 131, 138)


def painting(name, out, width, quality=80):
    im = Image.open(SRC / f'{name}.png').convert('RGB')
    h = round(im.height * width / im.width)
    im.resize((width, h), Image.LANCZOS).save(OUT / out, 'WEBP', quality=quality, method=6)


def paper(name, out, size=768):
    im = Image.open(SRC / f'{name}.png').convert('RGB').resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    # cross-fade a band at each edge with the opposite edge, so the texture tiles without seams
    band = size // 6
    rolled = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    yy, xx = np.mgrid[0:size, 0:size]
    d = np.minimum(np.minimum(xx, size - 1 - xx), np.minimum(yy, size - 1 - yy)).astype(np.float32)
    w = np.clip(d / band, 0, 1)[..., None]
    out_a = a * w + rolled * (1 - w)
    Image.fromarray(out_a.clip(0, 255).astype(np.uint8)).save(OUT / out, 'WEBP', quality=78, method=6)


def ink_alpha(im, ink):
    """how much of one ink sits on each pixel of white paper: 0 is bare paper, 1 is solid ink"""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    best = None
    for ch in range(3):
        span = 255.0 - ink[ch]
        if span < 60: continue
        v = (255.0 - a[..., ch]) / span
        best = v if best is None else np.maximum(best, v)
    al = np.clip(best, 0, 1)
    # paper grain and jpeg-ish noise below a fifth of an ink are bare paper
    al = np.clip((al - 0.12) / 0.88, 0, 1)
    return al


def pieces(name, ink, cols, rows, pad=0.02):
    im = Image.open(SRC / f'{name}.png').convert('RGB')
    al = ink_alpha(im, ink)
    H, W = al.shape
    out = []
    for r in range(rows):
        for c in range(cols):
            x0, x1 = int(W * c / cols), int(W * (c + 1) / cols)
            y0, y1 = int(H * r / rows), int(H * (r + 1) / rows)
            m = int(min(x1 - x0, y1 - y0) * pad)
            cell = al[y0 + m:y1 - m, x0 + m:x1 - m]
            # keep only the big ink: rows and columns with more than a trace of ink
            ys = np.where(cell.max(1) > 0.35)[0]; xs = np.where(cell.max(0) > 0.35)[0]
            if len(ys) == 0 or len(xs) == 0: raise SystemExit(f'{name}: empty piece {r},{c}')
            cell = cell[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]
            out.append(cell)
    return out


def mask_image(a):
    rgba = np.zeros(a.shape + (4,), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (a * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba)


def bolden(a):
    """thin linework vanishes at play size: thicken the lines a touch and deepen the halftone"""
    im = Image.fromarray((a * 255).astype(np.uint8))
    thick = np.asarray(im.filter(ImageFilter.MaxFilter(5))).astype(np.float32) / 255
    a = np.maximum(a, thick * 0.75)
    return np.clip(a, 0, 1) ** 0.72


def sprite_strip(name, ink, out, cell=200):
    ps = [bolden(p) for p in pieces(name, ink, 3, 2)]
    # one scale for every frame: the tallest frame fills 96% of a cell
    tall = max(p.shape[0] for p in ps); wide = max(p.shape[1] for p in ps)
    s = min(cell * 0.96 / tall, cell * 0.98 / wide)
    strip = Image.new('RGBA', (cell * len(ps), cell), (255, 255, 255, 0))
    for i, p in enumerate(ps):
        im = mask_image(p)
        im = im.resize((max(1, round(p.shape[1] * s)), max(1, round(p.shape[0] * s))), Image.LANCZOS)
        a = np.asarray(im)[..., 3].astype(np.float32) / 255
        # centre on the head: the ink in the top third of the figure
        top = a[: max(1, a.shape[0] // 3)]
        cols = top.sum(0)
        cx = (cols * np.arange(len(cols))).sum() / max(cols.sum(), 1e-6)
        x = round(cell / 2 - cx); y = cell - im.height - round(cell * 0.01)
        x = max(0, min(cell - im.width, x))
        strip.alpha_composite(im, (i * cell + x, y))
    strip.save(OUT / out, 'WEBP', quality=86, method=6)


def tile_strip(name, ink, out, cell=160):
    ps = pieces(name, ink, 4, 2, pad=0.03)
    strip = Image.new('RGBA', (cell * len(ps), cell), (255, 255, 255, 0))
    for i, p in enumerate(ps):
        im = mask_image(p)
        s = min(cell / p.shape[1], cell / p.shape[0])
        if i < 3:  # the ink blocks fill their cell edge to edge, so neighbours knit together
            im = im.resize((cell, cell), Image.LANCZOS); x = y = 0
        else:
            im = im.resize((max(1, round(p.shape[1] * s)), max(1, round(p.shape[0] * s))), Image.LANCZOS)
            x = (cell - im.width) // 2; y = (cell - im.height) // 2
        strip.alpha_composite(im, (i * cell + x, y))
    strip.save(OUT / out, 'WEBP', quality=86, method=6)


painting('mp-title', 'title.webp', 1440)
for i in (1, 2, 3):
    painting(f'mp-cover{i}', f'cover{i}.webp', 720)
    painting(f'mp-reward{i}', f'reward{i}.webp', 1280)
paper('mp-paper', 'paper.webp')
sprite_strip('mp-dora', PINK, 'dora.webp')
sprite_strip('mp-enzo', TEAL, 'enzo.webp')
tile_strip('mp-tiles', TEAL, 'tiles.webp')

total = sum(f.stat().st_size for f in OUT.glob('*.webp'))
for f in sorted(OUT.glob('*.webp')): print(f'{f.name:14s} {f.stat().st_size / 1024:7.1f} KB')
print(f'total {total / 1024 / 1024:.2f} MB')
