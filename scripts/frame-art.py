#!/usr/bin/env python3
"""Turns the Codex paintings for Out of Frame into the game's pixel art in public/art/frame/.

Usage: python3 scripts/frame-art.py <folder with the f-*.png and fr2-*.png paintings>

Sprite sheets are 2 by 2 on flat magenta: each quarter is keyed, cropped to what's painted and shrunk to its in-game
size with a box filter and a small palette, so it stays crisp pixel art. Tile sheets are 2 by 2 squares shrunk to 16 by
16. Backdrops are cropped to the screen's shape and shrunk to 480 by 256; the title and ending to 384 by 256 and the
portraits to 96 by 96, all drawn with nearest-neighbour in the game.
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'frame'
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
    im = im.crop((m, m, im.width - m, im.height - m)).resize((16, 16), Image.Resampling.BOX)
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


heroes = quarters(Image.open(SRC / 'f-heroes.png'))
sprite(heroes[0], 'dora-walk1', height=22)
sprite(heroes[1], 'dora-walk2', height=22)
sprite(heroes[2], 'dora-stand', height=22)
sprite(heroes[3], 'dora-hurt', height=22)
foes = quarters(Image.open(SRC / 'f-foes.png'))
sprite(foes[0], 'grumble', height=15)
sprite(foes[1], 'boulder', height=15)
sprite(foes[2], 'trap', height=16)
sprite(foes[3], 'rock', height=16)
# the hopper frog (sitting, crouched, rising, falling) and the bat (hanging, wings up, wings down, gliding), all facing left
frog = quarters(Image.open(SRC / 'fr2-frog.png'))
for im, name in zip(frog, ('frog-sit', 'frog-crouch', 'frog-up', 'frog-down')):
    sprite(im, name, width=16 if name == 'frog-up' else 15)
sprite(frog[0], 'frog', width=15)
bat = quarters(Image.open(SRC / 'fr2-bat.png'))
sprite(bat[0], 'bat-hang', height=14)
for im, name in zip(bat[1:], ('bat-up', 'bat-down', 'bat-glide')):
    sprite(im, name, width=20)
sprite(bat[3], 'bat', width=20)
props = quarters(Image.open(SRC / 'f-props.png'))
sprite(props[0], 'arrow', width=16)
sprite(props[1], 'lift', width=32)
sprite(props[2], 'acorn', height=11)
sprite(props[3], 'film', height=10)
extra = quarters(Image.open(SRC / 'f-extra.png'))
tile(extra[0], 'water-top')
tile(extra[1], 'water')
sprite(extra[2], 'raft', width=32)
sprite(extra[3], 'heart', height=10)
for biome in ('ruins', 'cave', 'temple'):
    t = quarters(Image.open(SRC / f'f-tiles-{biome}.png'))
    tile(t[0], f'{biome}-top')
    tile(t[1], f'{biome}-fill')
    tile(t[2], f'{biome}-crumble', keyed=True)
    tile(t[3], f'{biome}-spikes', keyed=True)
    # the backdrops are hazy paintings: a little more colour, so the picture inside the frame is plainly in colour
    picture(f'f-bg-{biome}.png', f'bg-{biome}', (480, 256), 48, colour=1.35)
picture('f-title.png', 'title', (384, 256))
picture('f-ending.png', 'ending', (384, 256))
picture('f-dora.png', 'dora-portrait', (96, 96))
picture('f-enzo.png', 'enzo-portrait', (96, 96))
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
