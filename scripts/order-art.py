#!/usr/bin/env python3
"""Turns the Codex paintings for Turn Order into the game's pixel art in public/art/order/.

Usage: python3 scripts/order-art.py <folder with the o-*.png paintings>

Sprite sheets are 2 by 2 on flat magenta: each quarter is keyed, cropped to what's painted and shrunk to its in-game
size with a box filter and a small palette, so it stays crisp pixel art. The tile sheet is 2 by 2 squares shrunk to 24 by
24. The garden is cropped to the screen's shape and shrunk to 384 by 216; the title and ending to 384 by 256 and the
portraits to 96 by 96, all drawn with nearest-neighbour in the game.
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'order'
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


def sprite(im, name, height=None, width=None, colours=24, flip=False):
    im = key(im)
    box = im.getbbox()
    im = im.crop(box)
    if height:
        w = max(1, round(im.width * height / im.height)); size = (w, height)
    else:
        h = max(1, round(im.height * width / im.width)); size = (width, h)
    im = im.resize(size, Image.Resampling.BOX)
    if flip:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    palette(im, colours).save(OUT / f'{name}.png')


def tile(im, name, keyed=False, colours=16):
    im = im.convert('RGBA')
    if keyed:
        im = key(im)
    # trim a sliver off each side, where the painting's quarters can bleed into each other
    m = im.width // 40
    im = im.crop((m, m, im.width - m, im.height - m)).resize((24, 24), Image.Resampling.BOX)
    palette(im, colours).save(OUT / f'{name}.png')


def picture(src, name, size, colours=32, colour=1.0):
    im = Image.open(SRC / src).convert('RGB')
    if colour != 1:
        im = ImageEnhance.Color(im).enhance(colour)
    tw, th = size
    # crop to the target's shape, keeping the middle
    if im.width / im.height > tw / th:
        w = round(im.height * tw / th); x = (im.width - w) // 2; im = im.crop((x, 0, x + w, im.height))
    else:
        h = round(im.width * th / tw); y = (im.height - h) // 2; im = im.crop((0, y, im.width, y + h))
    im = im.resize(size, Image.Resampling.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    im.convert('RGB').save(OUT / f'{name}.png')


one = quarters(Image.open(SRC / 'o-critters1.png'))
sprite(one[0], 'hog', height=17)
sprite(one[1], 'frog', height=17)
sprite(one[2], 'shroom', height=19)
sprite(one[3], 'beetle', height=16)
two = quarters(Image.open(SRC / 'o-critters2.png'))
sprite(two[0], 'snail', height=16)
sprite(two[1], 'mole', height=13)
sprite(two[2], 'acorn', height=17)
sprite(two[3], 'pot', width=22)
heroes = quarters(Image.open(SRC / 'o-heroes.png'))
sprite(heroes[0], 'enzo', height=56, colours=32)
sprite(heroes[1], 'dora', height=48, colours=32)
sprite(heroes[2], 'grumble', height=18)
sprite(heroes[3], 'rock', height=17)
t = quarters(Image.open(SRC / 'o-tiles.png'))
tile(t[0], 'grass1')
tile(t[1], 'grass2')
tile(t[2], 'soil')
tile(t[3], 'wall')
picture('o-garden.png', 'garden', (384, 216), 48)
picture('o-title.png', 'title', (384, 256))
picture('o-ending.png', 'ending', (384, 256))
picture('o-dora.png', 'dora-portrait', (96, 96))
picture('o-enzo.png', 'enzo-portrait', (96, 96))
# small critter faces for the queue bar: the same sprites, fitted into 24 by 24
for n in ('hog', 'frog', 'shroom', 'beetle', 'snail', 'mole', 'grumble'):
    im = Image.open(OUT / f'{n}.png'); c = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); c.alpha_composite(im, ((24 - im.width) // 2, (24 - im.height) // 2)); c.save(OUT / f'q-{n}.png')
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
