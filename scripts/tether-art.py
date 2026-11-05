# Tetherball art import: turns the Codex paintings in a source folder into the game's pixel art in public/art/tether.
# Sprite sheets (2 by 2 on flat magenta) are keyed, cropped and scaled to their in-game size; the arena floors are
# fitted so their painted walls line up with FLOOR in lib/tether-game.ts; the title, ending and portraits get the same
# low-resolution, 32-colour treatment and are scaled up in the browser with nearest-neighbour.
# Usage: python3 scripts/tether-art.py <folder with the source PNGs>
import sys, numpy as np
from PIL import Image

src, out = sys.argv[1], 'public/art/tether'
W, H, FLOOR = 480, 320, (26, 42, 454, 282)

def pixel(im, w, h, colours=32):
    lo = im.convert('RGB').resize((w, h), Image.BOX)
    return lo.quantize(colors=colours, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')

def sprite(cell, height=None, width=None):
    a = np.asarray(cell.convert('RGB')).astype(int)
    # magenta and its pink fringe: lots of red and blue, little green
    key = (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < 110)
    rgba = np.dstack([a, np.where(key, 0, 255)]).astype('uint8')
    im = Image.fromarray(rgba, 'RGBA'); bb = im.getbbox(); im = im.crop(bb)
    w, h = im.size
    if height: w, h = max(1, round(w * height / h)), height
    else: w, h = width, max(1, round(h * width / w))
    al = im.split()[3].resize((w, h), Image.BOX).point(lambda v: 255 if v >= 128 else 0)
    # premultiply-free colour: fill keyed pixels with their neighbours' colour before shrinking so edges don't go pink
    rgb = np.asarray(im.convert('RGB')).copy(); m = np.asarray(im.split()[3]) == 0
    rgb[m] = (60, 40, 40)
    col = Image.fromarray(rgb).resize((w, h), Image.BOX).quantize(colors=24, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    col.putalpha(al)
    return col

def cells(name):
    im = Image.open(f'{src}/{name}.png').convert('RGB').resize((1024, 1024))
    return [im.crop((x, y, x + 512, y + 512)) for y in (0, 512) for x in (0, 512)]

SHEETS = {
    'heroes': [('dora-stand', 30, None), ('dora-run', 30, None), ('dora-swing', 32, None), ('enzo', 28, None)],
    'foes1': [('slime', 13, None), ('grumble', 18, None), ('boar', None, 34), ('shellback', None, 26)],
    'foes2': [('beetle', None, 18), ('spitter', 18, None), ('golem', 52, None), ('crate', 18, None)],
    'props': [('spikes', 26, None), ('pit', None, 38), ('post', 22, None), ('heart', 11, None)],
}
for sheet, items in SHEETS.items():
    for cell, (name, h, w) in zip(cells(sheet), items):
        sprite(cell, h, w).save(f'{out}/{name}.png', optimize=True)

# arena floors: where each painting's inner floor is, as fractions (left, top, right, bottom)
INNER = {'court': (0.055, 0.13, 0.945, 0.88), 'meadow': (0.05, 0.11, 0.95, 0.88), 'mine': (0.05, 0.10, 0.94, 0.92), 'keep': (0.05, 0.10, 0.95, 0.90)}
for b, (l, t, r, btm) in INNER.items():
    im = Image.open(f'{src}/floor-{b}.png').convert('RGB'); iw, ih = im.size
    pad = 200; a = np.pad(np.asarray(im), ((pad, pad), (pad, pad), (0, 0)), mode='edge'); big = Image.fromarray(a)
    sx = (r - l) * iw / (FLOOR[2] - FLOOR[0]); sy = (btm - t) * ih / (FLOOR[3] - FLOOR[1])
    x0 = l * iw - FLOOR[0] * sx + pad; y0 = t * ih - FLOOR[1] * sy + pad
    fit = big.crop((round(x0), round(y0), round(x0 + W * sx), round(y0 + H * sy)))
    pixel(fit, W, H).save(f'{out}/floor-{b}.png', optimize=True)

pixel(Image.open(f'{src}/title.png'), 384, 256).save(f'{out}/title.png', optimize=True)
pixel(Image.open(f'{src}/ending.png'), 384, 256).save(f'{out}/ending.png', optimize=True)
for n in ('dora-portrait', 'enzo-portrait'): pixel(Image.open(f'{src}/{n}.png'), 96, 96).save(f'{out}/{n}.png', optimize=True)
print('ok')
