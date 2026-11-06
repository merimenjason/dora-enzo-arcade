#!/usr/bin/env python3
"""Turns the Codex paintings for Snowball Siege into the game's voxel models and pictures in public/art/snowball/.

Usage: python3 scripts/snowball-art.py <folder with the sb-*.png and sb2-*.png paintings>

Each character sheet is a flat pixel-art front view (left half) and side view facing right (right half) on magenta.
Both halves are keyed, cropped and shrunk with a box filter to the same height in model pixels, and every pixel
becomes a cube: a cube is kept where both views are solid (a visual hull). Every cube carries two colours: its front
face takes the front view's colour for its row and column. Its sides and back take the side view's colour, but only in
the back part of each row (the tail, the back of the hat, the satchel); towards the front the sides take the front
view's colour too, so the profile's eye and mouth never show up as a second face from three-quarter on. The top and
bottom of the front-most cube of each column take the front colour. The props sheet is six front views; round props (the pine, the boulder, the snowman) use their front
view for the side too, and the flags and the lantern post are made two cubes deep. Each model is written as JSON: its
size, a small palette and the surface cubes as [x, y, z, front colour, side colour]. The six slope skies, the title
and the ending are written as WebP pictures.
"""
import json
import sys
from pathlib import Path
from collections import Counter
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'snowball'
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


def crop(im):
    return im.crop(im.getbbox())


def shrink(im, height):
    """box-filter to the model height, then a hard alpha so every model pixel is solid or empty"""
    w = max(1, round(im.width * height / im.height))
    im = im.resize((w, height), Image.Resampling.BOX)
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a > 120 else (0, 0, 0, 0)
    return im


def quantise(colours, n):
    """a small palette for the whole model"""
    strip = Image.new('RGB', (len(colours), 1))
    strip.putdata(colours)
    q = strip.quantize(n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = q.getpalette()[: 3 * n]
    idx = list(q.getdata())
    return ['#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]) for i in range(n)], idx


def unoutline(im):
    """a copy with the dark one-pixel outline painted over in the colour just inside it, for the sides and back of the
    model (the outline belongs on the front face, but on the sides it would show up as dark stripes)"""
    out = im.copy()
    src, dst = im.load(), out.load()
    solid = lambda x, y: 0 <= x < im.width and 0 <= y < im.height and src[x, y][3] > 0
    dark = lambda c: c[0] + c[1] + c[2] < 200
    for y in range(im.height):
        for x in range(im.width):
            c = src[x, y]
            if not c[3] or not dark(c) or all(solid(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            for r in (1, 2, 3):
                near = [src[x + a, y + b] for a in range(-r, r + 1) for b in range(-r, r + 1) if solid(x + a, y + b) and not dark(src[x + a, y + b])]
                if near:
                    dst[x, y] = max(set(near), key=near.count)
                    break
    return out


def hull(front, side, name, colours=40):
    """front: (w × h) RGBA, side: (d × h) RGBA with the character's front on the right; returns the model dict"""
    w, h, d = front.width, front.height, side.width
    fp, sp, fq = front.load(), unoutline(side).load(), unoutline(front).load()
    cubes = {}
    for x in range(w):
        for yy in range(h):
            if fp[x, yy][3] == 0:
                continue
            zs = [z for z in range(d) if sp[z, yy][3]]
            if not zs:
                continue
            cut = min(zs) + 0.5 * (max(zs) - min(zs) + 1)
            for z in zs:
                cubes[(x, h - 1 - yy, z)] = (fp[x, yy][:3], sp[z, yy][:3] if z < cut else fq[x, yy][:3])
    # surface cubes only
    def solid(p):
        return p in cubes
    surface = [p for p in cubes if any(not solid((p[0] + a, p[1] + b, p[2] + c)) for a, b, c in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)))]
    cols = [cubes[p][0] for p in surface] + [cubes[p][1] for p in surface]
    pal, idx = quantise(cols, min(colours, max(2, len(set(cols)))))
    n = len(surface)
    flat = []
    for k, p in enumerate(surface):
        flat += [p[0], p[1], p[2], idx[k], idx[n + k]]
    model = {'name': name, 'size': [w, h, d], 'palette': pal, 'stride': 5, 'cubes': flat}
    (OUT / f'{name}.json').write_text(json.dumps(model, separators=(',', ':')))
    return model


def halves(name):
    # the newest painting wins (Dora was repainted as sb3-dora: cream fur, brown cap and jacket, gold goggles)
    im = key(Image.open(next(p for p in (SRC / f'sb3-{name}.png', SRC / f'sb2-{name}.png') if p.exists())))
    w = im.width // 2
    return crop(im.crop((0, 0, w, im.height))), crop(im.crop((w, 0, im.width, im.height)))


def cell(im):
    """the size of one painted pixel in the sheet: the commonest run of one colour along the rows (outlines and
    small details are one painted pixel wide)"""
    px, runs = im.load(), Counter()
    for y in range(0, im.height, 3):
        n = 1
        for x in range(1, im.width):
            a, b = px[x, y], px[x - 1, y]
            if a[3] and b[3] and sum(abs(a[i] - b[i]) for i in range(3)) < 40:
                n += 1
            else:
                if 6 <= n <= 40:
                    runs[n] += 1
                n = 1
    return runs.most_common(1)[0][0]


def native(im, height):
    """one model pixel per painted pixel, sampled at the centres so outlines and eyes stay crisp"""
    w = max(1, round(im.width * height / im.height))
    im = im.resize((w, height), Image.Resampling.NEAREST)
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a > 120 else (0, 0, 0, 0)
    return im


# the chibi sheets are painted on a grid of their own (about 40 to 75 painted pixels tall): each model keeps that grid
for who in ('dora', 'enzo', 'vizcacha', 'pudu', 'guanaco', 'fox', 'flamingo', 'bear'):
    f, s = halves(who)
    height = round(f.height / cell(f))
    m = hull(native(f, height), native(s, height), who)
    print(who, m['size'], len(m['cubes']) // 4, 'cubes')

# props: a 3 × 2 grid of front views
props = key(Image.open(SRC / 'sb-props.png'))
cw, ch = props.width // 3, props.height // 2
PROPS = [('pine', 34, 'round'), ('rock', 12, 'round'), ('snowman', 22, 'round'), ('lantern', 26, 'thin'), ('flag-red', 18, 'thin'), ('flag-blue', 18, 'thin')]
for k, (name, height, shape) in enumerate(PROPS):
    cell = crop(props.crop(((k % 3) * cw, (k // 3) * ch, (k % 3) * cw + cw, (k // 3) * ch + ch)))
    f = shrink(cell, height)
    if shape == 'round':
        s = f.copy()
    else:
        # two cubes deep, solid wherever the front has anything on that row
        s = Image.new('RGBA', (2, f.height), (0, 0, 0, 0))
        fp, sp = f.load(), s.load()
        for yy in range(f.height):
            row = [fp[x, yy] for x in range(f.width) if fp[x, yy][3]]
            if row:
                for z in range(2):
                    sp[z, yy] = row[len(row) // 2]
    m = hull(f, s, name, 16)
    print(name, m['size'], len(m['cubes']) // 4, 'cubes')

for name, size in [(n, (1536, 1024)) for n in ('sky', 'sky-pond', 'sky-ridge', 'sky-pines', 'sky-lagoon', 'sky-summit', 'title', 'ending')]:
    Image.open(SRC / f'sb-{name}.png').convert('RGB').resize(size, Image.Resampling.LANCZOS).save(OUT / f'{name}.webp', quality=84)
print('wrote', OUT)
