#!/usr/bin/env python3
"""Turns the Codex paintings for Rulebook FC into the game's pixel art in public/art/rulebook/.

Usage: python3 scripts/rulebook-art.py <folder with the rb-*.png paintings>

- pitch.png: the cage pitch, scaled so the painted boards sit on the game's pitch edges (27 to 357 across, 12 to 210
  down: the 15 by 9 board of 22-pixel cells) with a band of plain grass cut from (or added to) the middle to fit the height, and a dark hedge-green margin at the sides.
- title.png and ending.png at 384 by 256.
- ours-a..p.png and theirs-a..p.png: each cell of the two 4 by 4 icon sheets keyed off its magenta, cropped to what's
  painted and shrunk to 24 pixels (and a 48-pixel -big copy for the cards). Ours: the gold law icons a to o and Red Pen
  (p). Theirs: the purple law icons a to n, then the two card backs (o gold, p purple).
- hedge.png, mud.png, enzo-card.png and ref.png from the 2 by 2 props sheet.

The players, keepers, goal and ball are the shared football sprites in public/art/kickabout/.
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'rulebook'
OUT.mkdir(parents=True, exist_ok=True)


def key(im):
    """magenta and anything close to it becomes clear"""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
    return im


def palette(im, colours):
    """a small palette, keeping clear pixels clear"""
    alpha = im.getchannel('A').point(lambda a: 255 if a > 140 else 0)
    rgb = im.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def sprite(im, name, fit=None, height=None, colours=24):
    im = im.crop(im.getbbox())
    k = fit / max(im.width, im.height) if fit else height / im.height
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.BOX)
    palette(im, colours).save(OUT / f'{name}.png')


def picture(src, name, size, colours=64):
    im = Image.open(SRC / src).convert('RGB')
    tw, th = size
    if im.width / im.height > tw / th:
        w = round(im.height * tw / th); x = (im.width - w) // 2; im = im.crop((x, 0, x + w, im.height))
    else:
        h = round(im.width * th / tw); y = (im.height - h) // 2; im = im.crop((0, y, im.width, y + h))
    im.resize(size, Image.Resampling.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / f'{name}.png')


def inner(im):
    """the painted grass inside the boards: the bounding box of the bright green in the middle rows and columns"""
    px = im.load()
    def green(x, y):
        r, g, b = px[x, y]
        return g > 110 and g > r + 30 and g > b + 40
    mid_y, mid_x = im.height // 2, im.width // 2
    def run(n, ok):
        """the unbroken stretch of grass through the middle (a few odd pixels allowed)"""
        a = b = n // 2
        while a > 0 and any(ok(a - k) for k in range(1, 4)): a -= 1
        while b < n - 1 and any(ok(b + k) for k in range(1, 4)): b += 1
        return a, b + 1
    x0, x1 = run(im.width, lambda x: 0 <= x < im.width and green(x, mid_y))
    y0, y1 = run(im.height, lambda y: 0 <= y < im.height and green(mid_x, y))
    return x0, y0, x1, y1


# ---- the pitch: the painted grass lands on the game's pitch
src = Image.open(SRC / 'rb-pitch.png').convert('RGB')
ix0, iy0, ix1, iy1 = inner(src)
PX0, PY0, PX1, PY1 = 27, 12, 357, 210
s = (PX1 - PX0) / (ix1 - ix0)
scaled = src.resize((round(src.width * s), round(src.height * s)), Image.Resampling.BOX)
ox, oy = round(PX0 - ix0 * s), round(PY0 - iy0 * s)
# cut plain grass out of the middle (or stretch a band of it) so the bottom boards land on PY1
extra = round(iy1 * s) + oy - PY1
out = Image.new('RGB', (384, 216), (22, 52, 24))
mid = round((iy0 + iy1) / 2 * s)
top = scaled.crop((0, 0, scaled.width, mid))
bottom = scaled.crop((0, mid + max(0, extra), scaled.width, scaled.height))
out.paste(top, (ox, oy))
if extra < 0:
    band = scaled.crop((0, mid - 4, scaled.width, mid))
    for y in range(0, -extra, 4): out.paste(band, (ox, oy + mid + y))
out.paste(bottom, (ox, oy + mid - min(0, extra)))
out.quantize(64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'pitch.png')

picture('rb-title.png', 'title', (384, 256))
picture('rb-ending.png', 'ending', (384, 256))

# ---- the law icons
for sheet, prefix in (('rb-ours.png', 'ours'), ('rb-theirs.png', 'theirs')):
    im = key(Image.open(SRC / sheet))
    cw, ch = im.width // 4, im.height // 4
    for k, letter in enumerate('abcdefghijklmnop'):
        cell = im.crop(((k % 4) * cw, (k // 4) * ch, (k % 4) * cw + cw, (k // 4) * ch + ch))
        sprite(cell, f'{prefix}-{letter}', fit=24, colours=16)
        sprite(cell, f'{prefix}-{letter}-big', fit=48, colours=24)

# ---- the props
im = key(Image.open(SRC / 'rb-props.png'))
w, h = im.width // 2, im.height // 2
q = [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in (0, 1) for x in (0, 1)]
sprite(q[0], 'hedge', height=12, colours=12)
sprite(q[1], 'mud', fit=40, colours=10)
sprite(q[2], 'enzo-card', height=64, colours=32)
sprite(q[3], 'ref', height=64, colours=32)
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
