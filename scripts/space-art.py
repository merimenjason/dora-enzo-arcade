#!/usr/bin/env python3
"""Turns the Codex paintings for Into Space into the game's pixel art in public/art/space/.

Usage: python3 scripts/space-art.py <folder with the is-*.png paintings>

The four pitches (summer grass, rain, the beach, a heatwave) are shrunk whole to the 384 by 216 screen with a box filter
and a small palette, keeping the decorative bands along their top and bottom edges; the game draws the lines and boards
on top. The top-down goal is keyed off its magenta and shrunk so its posts sit 40 game pixels apart, the size of the
goal mouth. The title and ending go to 384 by 256. The players, the ball and the trophy are the shared football sprites
in public/art/kickabout/ (scripts/kickabout-art.py).
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'space'
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


def pitch(src, name):
    im = Image.open(SRC / src).convert('RGB').resize((384, 216), Image.Resampling.BOX)
    im.quantize(40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / f'{name}.png')


def picture(src, name, size, colours=48):
    im = Image.open(SRC / src).convert('RGB')
    tw, th = size
    if im.width / im.height > tw / th:
        w = round(im.height * tw / th); x = (im.width - w) // 2; im = im.crop((x, 0, x + w, im.height))
    else:
        h = round(im.width * th / tw); y = (im.height - h) // 2; im = im.crop((0, y, im.width, y + h))
    im.resize(size, Image.Resampling.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / f'{name}.png')


for n in ('dry', 'wet', 'sand', 'hard'):
    pitch(f'is-{n}.png', n)
goal = key(Image.open(SRC / 'is-goal.png'))
goal = goal.crop(goal.getbbox())
k = 46 / goal.height
goal = goal.resize((max(1, round(goal.width * k)), 46), Image.Resampling.BOX)
palette(goal, 8).save(OUT / 'goal.png')
picture('is-title.png', 'title', (384, 256))
picture('is-ending.png', 'ending', (384, 256))
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
