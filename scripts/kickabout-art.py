#!/usr/bin/env python3
"""Turns the Codex football sprite sheets shared by the football games into pixel art in public/art/kickabout/.

Usage: python3 scripts/kickabout-art.py <folder with the k-*.png and t-*.png paintings>

Each sheet is 2 by 2 on flat magenta: each quarter is keyed, cropped to what's painted and shrunk to its in-game size
with a box filter and a small palette, so it stays crisp pixel art. Players face right (Grumbles are flipped to face
right too); the scenes flip them to face left. Each player also gets a big copy for menus and cards.
"""
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'kickabout'
OUT.mkdir(parents=True, exist_ok=True)


def key(im, tight=False):
    """magenta and anything close to it becomes clear; tight keys only near-pure magenta, so purple kits survive"""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if tight:
                if (255 - r) ** 2 + g ** 2 + (255 - b) ** 2 < 70 ** 2:
                    px[x, y] = (0, 0, 0, 0)
            elif r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
    return im


def quarters(name, tight=False):
    im = key(Image.open(SRC / f'{name}.png'), tight)
    w, h = im.width // 2, im.height // 2
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in (0, 1) for x in (0, 1)]


def palette(im, colours):
    """a small palette, keeping clear pixels clear"""
    alpha = im.getchannel('A').point(lambda a: 255 if a > 140 else 0)
    rgb = im.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def sprite(im, name, height=None, fit=None, colours=24, flip=False):
    im = im.crop(im.getbbox())
    if fit:
        k = fit / max(im.width, im.height)
    else:
        k = height / im.height
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.BOX)
    if flip:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    palette(im, colours).save(OUT / f'{name}.png')


SMALL, BIG = 20, 56
for who in ('dora', 'enzo'):
    q = quarters(f'k-{who}')
    for im, frame in zip(q, ('stand', 'run1', 'run2', 'kick')):
        sprite(im, f'{who}-{frame}', SMALL, colours=24)
    sprite(q[0], f'{who}-big', BIG, colours=32)
q = quarters('k-mates')
for who, (stand, run) in (('pip', q[:2]), ('bram', q[2:])):
    sprite(stand, f'{who}-stand', SMALL if who == 'pip' else SMALL + 1, colours=24)
    sprite(run, f'{who}-run', SMALL if who == 'pip' else SMALL + 1, colours=24)
    sprite(stand, f'{who}-big', BIG, colours=32)
q = quarters('k-grumble')
for im, frame in zip(q, ('stand', 'run1', 'run2', 'slide')):
    sprite(im, f'grumble-{frame}', 18 if frame != 'slide' else 12, colours=20, flip=True)
sprite(q[0], 'grumble-big', BIG - 8, colours=28, flip=True)
q = quarters('k-keepers')
sprite(q[0], 'keeper-stand', SMALL + 1, colours=24)
sprite(q[1], 'keeper-dive', 14, colours=24)
sprite(q[2], 'gkeeper-stand', SMALL + 2, colours=24, flip=True)
sprite(q[3], 'gkeeper-dive', 15, colours=24, flip=True)
# the rival league: each team's sheet a is stand, run, run, slide; sheet b is keeper ready, keeper diving, a captain
# portrait and a celebration. All painted facing left, flipped to face right like the Grumbles.
for team in ('rabbit', 'frog', 'mole', 'otter', 'hog', 'magpie', 'fox', 'badger'):
    a, b = quarters(f't-{team}-a', team == 'magpie'), quarters(f't-{team}-b', team == 'magpie')
    for im, frame in zip(a, ('stand', 'run1', 'run2', 'slide')):
        sprite(im, f'{team}-{frame}', SMALL if frame != 'slide' else 12, colours=24, flip=True)
    sprite(b[0], f'{team}-keeper-stand', SMALL + 2, colours=24, flip=True)
    sprite(b[1], f'{team}-keeper-dive', 15, colours=24, flip=True)
    sprite(b[2], f'{team}-big', BIG, colours=32)
    sprite(b[3], f'{team}-cheer', SMALL + 2, colours=24, flip=True)
q = quarters('k-props')
sprite(q[0], 'goal', 54, colours=12)
sprite(q[1], 'ball', fit=6, colours=8)
sprite(q[1], 'ball-big', fit=24, colours=12)
sprite(q[2], 'flag', 14, colours=8)
sprite(q[3], 'trophy', 40, colours=20)
print('wrote', len(list(OUT.glob('*.png'))), 'sprites to', OUT)
