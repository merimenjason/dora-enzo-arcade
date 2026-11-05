#!/usr/bin/env python3
"""Turns the Codex paintings for Pixel Smith into the game's pixel art in public/art/smith/.

Usage: python3 scripts/smith-art.py <folder with the s-*.png paintings>

Sprite sheets are 2 by 2 on flat magenta: each quarter is keyed, cropped to what's painted and shrunk to its in-game
size with a box filter and a small palette, so it stays crisp pixel art. The three rooms and Enzo's workshop are
cropped to the screen's shape round the middle and shrunk to 384 by 216, with a light speckle of darker and lighter
pixels on the plain floors; the title and ending go to 384 by 256. Everything is drawn with nearest-neighbour, in the
canvas and in the page.
"""
import random
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'smith'
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


def quarters(im):
    w, h = im.width // 2, im.height // 2
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in (0, 1) for x in (0, 1)]


def palette(im, colours):
    """a small palette, keeping clear pixels clear"""
    alpha = im.getchannel('A').point(lambda a: 255 if a > 140 else 0)
    rgb = im.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def sprite(im, name, height=None, width=None, colours=24, flip=False, fit=None):
    im = key(im)
    box = im.getbbox()
    im = im.crop(box)
    if fit:
        k = fit / max(im.width, im.height); size = (max(1, round(im.width * k)), max(1, round(im.height * k)))
    elif height:
        w = max(1, round(im.width * height / im.height)); size = (w, height)
    else:
        h = max(1, round(im.height * width / im.width)); size = (width, h)
    im = im.resize(size, Image.Resampling.BOX)
    if flip:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    palette(im, colours).save(OUT / f'{name}.png')


def picture(src, name, size, colours=32, colour=1.0, bottom=False, speckle=False):
    im = Image.open(SRC / src).convert('RGB')
    if colour != 1:
        im = ImageEnhance.Color(im).enhance(colour)
    tw, th = size
    # crop to the target's shape, keeping the middle
    if im.width / im.height > tw / th:
        w = round(im.height * tw / th); x = (im.width - w) // 2; im = im.crop((x, 0, x + w, im.height))
    else:
        h = round(im.width * th / tw); y = im.height - h if bottom else (im.height - h) // 2; im = im.crop((0, y, im.width, y + h))
    im = im.resize(size, Image.Resampling.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    if speckle:
        # the plain ground in the middle gets a sprinkle of darker and lighter pixels, the same every time
        px = im.load(); g = px[im.width // 2, im.height // 2]; rnd = random.Random(name)
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if sum(abs(p[i] - g[i]) for i in range(3)) < 24:
                    v = rnd.random()
                    if v < 0.05: px[x, y] = tuple(max(0, round(c * 0.9)) for c in p)
                    elif v < 0.07: px[x, y] = tuple(min(255, round(c * 1.08)) for c in p)
    im.save(OUT / f'{name}.png')


dora = quarters(Image.open(SRC / 's-dora.png'))
for im, n in zip(dora, ('dora-stand', 'dora-run1', 'dora-run2', 'dora-hurt')):
    sprite(im, n, height=26, colours=28)
enzo = quarters(Image.open(SRC / 's-enzo.png'))
sprite(enzo[0], 'enzo-paint', height=64, colours=32)
sprite(enzo[1], 'enzo-cheer', height=64, colours=32)
sprite(enzo[2], 'enzo-portrait', fit=48, colours=32)
sprite(enzo[3], 'dora-portrait', fit=48, colours=32)
f1 = quarters(Image.open(SRC / 's-foes1.png'))
for im, n in zip(f1, ('pebble', 'glint', 'frost', 'ember')):
    sprite(im, n, height=17, colours=20)
    sprite(im, f'big-{n}', height=40, colours=24)
f2 = quarters(Image.open(SRC / 's-foes2.png'))
sprite(f2[0], 'moss', height=18, colours=20)
sprite(f2[0], 'big-moss', height=40, colours=24)
sprite(f2[1], 'smudge', height=40, colours=28)
sprite(f2[1], 'big-smudge', height=40, colours=28)
sprite(f2[2], 'ice', fit=8, colours=10)
for n in ('mine', 'cellar', 'forge', 'shop'):
    picture(f's-{n}.png', n, (384, 216), 48, speckle=n != 'shop')
picture('s-title.png', 'title', (384, 256))
picture('s-ending.png', 'ending', (384, 256))
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
