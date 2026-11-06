#!/usr/bin/env python3
"""Turns the Codex paintings for Burrow Clinic into the game's art in public/art/clinic/.

Usage: python3 scripts/clinic-art.py <folder with the hc-*.png paintings> [<folder with mp-paper.png>]

- sp-<species>.webp, st-<look>.webp, dora.webp, enzo.webp: one strip of eight frames per character from the 4 by 2
  sheets painted on flat magenta (the flamingo on flat green, so its pink survives the key). Frames, in order: walk
  towards the viewer A and B, walk away A and B, then sitting / working, grumpy / tired, cheering / resting, lying /
  cheering (see FRAMES in lib/clinic-scene.ts). Every frame of a sheet is scaled by the same factor (set by the first
  frame's height), placed bottom-centre in equal cells, and mirrored where the painting faced the other way, so in
  every strip the front walk faces screen-left and the back walk faces screen-right.
- face-<species>.webp: the sitting frame, square, for the patient info card; p-<who>.webp: the twelve portraits.
- m-<machine>.webp, d-<deco>.webp: the clinic machines and decorations, i-<name>.webp: the UI and status icons.
- b-<piece>.webp: litter and effect pieces.
- t-<floor>.webp: seamless floor and ground textures (mirror-tiled), wall.webp for the room walls.
- title, map, win, bg1..bg6 (.webp paintings), paper.webp (the printed-paper grain).
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(sys.argv[1])
PAPER = Path(sys.argv[2]) if len(sys.argv) > 2 else SRC
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'clinic'
OUT.mkdir(parents=True, exist_ok=True)


def key(im, bg='magenta'):
    """the flat background becomes clear, and its anti-aliased fringe is pulled towards the ink outline"""
    a = np.asarray(im.convert('RGBA')).astype(np.int16).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if bg == 'magenta':
        m = np.minimum(r, b) - g  # how magenta a pixel is
        hard = (m > 95) & (r > 150) & (b > 150)
        soft = (m > 35) & ~hard & (np.abs(r - b) < 110)
    else:
        m = g - np.maximum(r, b)
        hard = (m > 80) & (g > 150)
        soft = (m > 30) & ~hard
    a[hard] = 0
    # fringe: fade out and darken towards the warm off-black ink
    k = np.clip((m - 35) / 60.0, 0, 1)
    for c, ink in zip(range(3), (58, 40, 38)):
        ch = a[..., c]
        ch[soft] = (ch[soft] * (1 - k[soft]) + ink * k[soft]).astype(np.int16)
    a[..., 3][soft] = (255 * (1 - k[soft] * 0.85)).astype(np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def cells(im, cols, rows):
    w, h = im.width // cols, im.height // rows
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in range(rows) for x in range(cols)]


def biggest(im):
    """crop to the main figure: drop stray specks far from it"""
    a = np.asarray(im)[..., 3] > 40
    if not a.any():
        return im
    ys, xs = np.nonzero(a)
    # columns/rows with a meaningful amount of ink
    colsum, rowsum = a.sum(0), a.sum(1)
    xs2 = np.nonzero(colsum > 1)[0]
    ys2 = np.nonzero(rowsum > 1)[0]
    if len(xs2) and len(ys2):
        return im.crop((int(xs2.min()), int(ys2.min()), int(xs2.max()) + 1, int(ys2.max()) + 1))
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def scale(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.LANCZOS)


def save(im, name, q=86):
    im.save(OUT / f'{name}.webp', quality=q, method=6)


# ---- characters. Height of the first frame in pixels; flip = (front painted facing right, back painted facing left)
CHARS = {
    'sp-pudu': ('hc-sp-pudu', 118, (False, False)), 'sp-guanaco': ('hc-sp-guanaco', 182, (False, False)),
    'sp-vizcacha': ('hc-sp-vizcacha', 132, (False, False)), 'sp-flamingo': ('hc-sp-flamingo', 182, (False, False)),
    'sp-alpaca': ('hc-sp-alpaca', 168, (False, False)), 'sp-fox': ('hc-sp-fox', 128, (False, False)),
    'sp-armadillo': ('hc-sp-armadillo', 100, (False, False)), 'sp-condor': ('hc-sp-condor', 160, (False, False)),
    'sp-owl': ('hc-sp-owl', 132, (False, False)),
    'dora': ('hc-dora', 150, (False, False)), 'enzo': ('hc-enzo', 150, (False, False)),
}
for look in ['vet-a', 'vet-b', 'nurse-a', 'nurse-b', 'clean-a', 'clean-b', 'recep-a', 'recep-b']:
    CHARS['st-' + look] = ('hc-st-' + look, 146, (False, False))
meta = []
for name, (src, height, flip) in CHARS.items():
    sheet = key(Image.open(SRC / f'{src}.png'), 'green' if 'flamingo' in src else 'magenta')
    cs = [biggest(c) for c in cells(sheet, 4, 2)]
    k = height / cs[0].height
    frames = [scale(c, k) for c in cs]
    if flip[0]:
        frames[0], frames[1] = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames[:2]]
    if flip[1]:
        frames[2], frames[3] = [f.transpose(Image.Transpose.FLIP_LEFT_RIGHT) for f in frames[2:4]]
    cw = max(f.width for f in frames) + 4
    ch = max(f.height for f in frames) + 2
    strip = Image.new('RGBA', (cw * 8, ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * cw + (cw - f.width) // 2, ch - f.height - 1), f)
    save(strip, name, 88)
    meta.append(f'{name} {cw} {ch}')
    if name.startswith('sp-'):
        # the sitting frame, square, for the info card
        s = cs[4]
        side = max(s.width, s.height) + 16
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(s, ((side - s.width) // 2, (side - s.height) // 2), s)
        save(sq.resize((176, 176), Image.Resampling.LANCZOS), 'face-' + name[3:], 86)
(OUT / 'frames.txt').write_text('\n'.join(meta) + '\n')

# ---- portraits (hc-por, 4 by 3)
POR = ['dora', 'enzo', 'vet-a', 'vet-b', 'nurse-a', 'nurse-b', 'clean-a', 'clean-b', 'recep-a', 'recep-b', 'owl', 'condor']
for c, n in zip(cells(key(Image.open(SRC / 'hc-por.png')), 4, 3), POR):
    m = round(c.height * 0.03)  # trim the cell edges: a neighbour's outline can creep over the line
    c = biggest(c.crop((m, m, c.width - m, c.height - m)))
    side = max(c.width, c.height) + 8
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(c, ((side - c.width) // 2, side - c.height), c)
    save(sq.resize((192, 192), Image.Resampling.LANCZOS), f'p-{n}', 86)

# ---- machines and decorations: width in pixels
MACH1 = [('dryer', 190), ('jar', 168), ('flipper', 190), ('steam', 150), ('tub', 176), ('comb', 182), ('booth', 160), ('hammock', 200)]
MACH2 = [('sunlamp', 190), ('desk', 200), ('exam', 200), ('sofa', 200), ('coffee', 150), ('heater', 112), ('vending', 140), ('cabinet', 130)]
DECO = [('cactus', 70), ('plant', 104), ('cooler', 76), ('bench', 132), ('lamp', 76), ('bin', 64), ('table', 90), ('rug', 150)]
for sheet, items, pre in (('hc-mach1', MACH1, 'm-'), ('hc-mach2', MACH2, 'm-'), ('hc-deco', DECO, 'd-')):
    for c, (n, w) in zip(cells(key(Image.open(SRC / f'{sheet}.png')), 4, 2), items):
        c = biggest(c)
        save(scale(c, w / c.width), pre + n, 88)
# the heater and drinks cart are decorations too
for n in ('heater', 'vending'):
    Image.open(OUT / f'm-{n}.webp').save(OUT / f'd-{n}.webp', quality=88, method=6)

# ---- icons
I1 = ['coin', 'heart', 'star', 'calendar', 'pause', 'play', 'fast', 'build', 'staff', 'gear', 'home', 'sell', 'rotate', 'move', 'ok', 'no']
I2 = ['happy', 'meh', 'grumpy', 'thirsty', 'sleepy', 'repair', 'static', 'hiccups', 'ears', 'sneezes', 'dust', 'tangle', 'glow', 'puff', 'spots', 'bell']
for sheet, names in (('hc-icons1', I1), ('hc-icons2', I2)):
    for c, n in zip(cells(key(Image.open(SRC / f'{sheet}.png')), 4, 4), names):
        c = biggest(c)
        k = 96 / max(c.width, c.height)
        save(scale(c, k), f'i-{n}', 90)

# ---- effect pieces (hc-bits, 4 by 2): litter, the cure starburst, steam, a bubble, a spark, a snowflake
BITS = ['litter0', 'litter1', 'litter2', 'burst', 'steam', 'bubble', 'spark', 'snow']
for c, n in zip(cells(key(Image.open(SRC / 'hc-bits.png')), 4, 2), BITS):
    c = biggest(c)
    save(scale(c, 220 / max(c.width, c.height)), f'b-{n}', 88)

# ---- textures: six swatches per sheet (3 by 2) with a thin cream gap; mirror-tiled so they repeat seamlessly
def swatch(c):
    i = round(c.width * 0.04)
    return c.crop((i, i, c.width - i, c.height - i))


def mirror(im, size):
    im = im.resize((size // 2, size // 2), Image.Resampling.LANCZOS)
    out = Image.new('RGB', (size, size))
    out.paste(im, (0, 0))
    out.paste(im.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (size // 2, 0))
    out.paste(im.transpose(Image.Transpose.FLIP_TOP_BOTTOM), (0, size // 2))
    out.paste(im.transpose(Image.Transpose.ROTATE_180), (size // 2, size // 2))
    return out


T1 = ['checker', 'terrazzo', 'parquet', 'lino', 'grass', 'cobble']
T2 = ['salt', 'pebbles', 'moss', 'sand', 'snow', 'wall']
for sheet, names in (('hc-tex1', T1), ('hc-tex2', T2)):
    im = Image.open(SRC / f'{sheet}.png').convert('RGB')
    for c, n in zip(cells(im, 3, 2), names):
        s = swatch(c)
        if n == 'checker':
            # one period of the painted 4 by 4 checkerboard (2 by 2 squares) repeats on its own
            s = s.crop((0, 0, s.width // 2, s.height // 2)).resize((256, 256), Image.Resampling.LANCZOS)
            save(s, 't-' + n, 84)
        else:
            save(mirror(s, 384), 't-' + n, 80)

# ---- paintings
for n, w in (('title', 1400), ('map', 1536), ('win', 1280), ('bg1', 1280), ('bg2', 1280), ('bg3', 1280), ('bg4', 1280), ('bg5', 1280), ('bg6', 1280)):
    im = Image.open(SRC / f'hc-{n}.png').convert('RGB')
    if im.width != w:
        im = im.resize((w, round(im.height * w / im.width)), Image.Resampling.LANCZOS)
    save(im, n, 80)
p = Image.open(PAPER / 'mp-paper.png').convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
save(p, 'paper', 78)
total = sum(f.stat().st_size for f in OUT.iterdir())
print('wrote', len(list(OUT.iterdir())), 'files to', OUT, f'({total / 1e6:.2f} MB)')
