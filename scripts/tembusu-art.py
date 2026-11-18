#!/usr/bin/env python3
"""Turns the Codex paintings for Tembusu into the game's pixel art.

Usage: python3 scripts/tembusu-art.py <folder with the paintings>

The pixel pass, in this order (the spec's rules):
  1. key the flat magenta out of every sprite sheet first;
  2. find each item on the sheet (connected shapes, little bits such as a bud's sparkles joined to the nearest one);
  3. shrink each item nearest-neighbour by a whole factor (4 for most pieces, so the pixel density matches across the
     tree; a little more for Dora, Enzo and some animals);
  4. cut every sprite to ONE shared 64-colour palette (FASTOCTREE, no dither), done separately from the alpha, so the
     trunk and the branch browns never seam;
  5. the canvas and the page scale everything up nearest-neighbour.
Sprites go into one atlas, public/art/tembusu/atlas.png, with lib/tembusu-art.ts listing each one's box and anchor.
The six hills and the title are shrunk to 384 by 256 with their own 64 colours; the journal and the panel frame are
kept as their own pictures for the page.
"""
import sys
from pathlib import Path
from collections import deque
from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'art' / 'tembusu'
OUT.mkdir(parents=True, exist_ok=True)

# sheet -> (names in reading order, shrink factor, anchor kind)
#   anchor kinds: 'bottom' (centre of the bottom edge), 'centre', 'base' (a branch: its cut base on the left)
SHEETS = {
    'tr-trunks': (['trunk-0', 'trunk-1', 'trunk-2'], 4, 'bottom'),
    'tr-branches': (['br-0L', 'br-1L', 'br-2L', 'br-0S', 'br-1S', 'br-2S'], 4, 'base'),
    'tr-leaves': (['leaf-L1', 'leaf-M1', 'leaf-S1', 'leaf-L2', 'leaf-M2', 'leaf-S2'], 4, 'centre'),
    'tr-bits': (['bud', 'flower', 'fruit', 'hollow', 'stub', 'roots'], 4, 'centre'),
    'tr-hill': (['stump', 'seedling', 'sapling', 'young', 'log', 'seed'], 4, 'bottom'),
    'home': (['home', 'ladder'], 4, 'bottom'),
    'dora-a': (['dora-water-0', 'dora-water-1', 'dora-idle-0', 'dora-idle-1'], 7, 'bottom'),
    'dora-b': (['dora-wave-0', 'dora-wave-1', 'dora-brace-0', 'dora-brace-1'], 7, 'bottom'),
    'dora-c': (['dora-carry-0', 'dora-carry-1', 'dora-climb-0', 'dora-climb-1'], 7, 'bottom'),
    'enzo-a': (['enzo-sit-0', 'enzo-sit-1', 'enzo-read-0', 'enzo-read-1'], 6, 'bottom'),
    'enzo-b': (['enzo-write-0', 'enzo-write-1', 'enzo-plant-0', 'enzo-plant-1'], 6, 'bottom'),
    'an-a': (['hornbill-0', 'hornbill-1', 'colugo-0', 'colugo-1'], 5, 'bottom'),
    'an-b': (['squirrel-0', 'squirrel-1', 'sunbird-0', 'sunbird-1'], 5, 'bottom'),
    'an-c': (['koel-0', 'koel-1', 'robin-0', 'robin-1'], 5, 'bottom'),
    'an-d': (['bat-0', 'bat-1', 'monitor-0', 'monitor-1'], 5, 'bottom'),
    'an-e': (['bees-0', 'bees-1', 'birdwing-0', 'birdwing-1'], 6, 'bottom'),
    'an-f': (['kingfisher-0', 'kingfisher-1', 'loris-0', 'loris-1'], 5, 'bottom'),
    'icons-bud': (['ic-wide', 'ic-tall', 'ic-flower', 'ic-root', 'ic-hollow', 'ic-bark'], 6, 'centre'),
    'icons-ev': (['ic-storm', 'ic-dry', 'ic-lightning', 'ic-beetles', 'ic-fruiting', 'ic-migrants'], 6, 'centre'),
}
# per-sprite size overrides (shrink factor), when one item on a sheet was painted bigger than the rest
FACTOR = {'log': 5, 'young': 6, 'sapling': 6, 'stump': 7, 'home': 7, 'ladder': 7, 'bud': 8, 'flower': 7, 'fruit': 7, 'hollow': 6, 'stub': 5,
          'seed': 4, 'seedling': 4}
# the animals at their own sizes: a sunbird is tiny, a hornbill is big
for a, f in {'hornbill': 6, 'colugo': 7, 'squirrel': 8, 'sunbird': 10, 'koel': 7, 'robin': 8, 'bat': 8, 'monitor': 7, 'bees': 8,
             'birdwing': 9, 'kingfisher': 8, 'loris': 7}.items():
    FACTOR[f'{a}-0'] = FACTOR[f'{a}-1'] = f
PAGES = {'ui': (['panel', '_ribbon-journal'], 2), 'journal2': (['journal'], 4)}
HILLS = ['hill-dawn', 'hill-day', 'hill-dusk', 'hill-night', 'hill-storm', 'hill-dry']


def key(im):
    """flat magenta, and anything close to it, becomes clear"""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            # magenta, and the pinkish-purple fringe where an edge was blended into it
            if (r > 150 and b > 140 and g < 120 and abs(r - b) < 100) or (r - g > 70 and b - g > 60):
                px[x, y] = (0, 0, 0, 0)
    return im


def items(im, want):
    """the boxes of the separate things on a keyed sheet, in reading order (rows, then left to right)"""
    s = 4
    small = im.getchannel('A').resize((im.width // s, im.height // s), Image.Resampling.BOX)
    w, h = small.size
    m = [[small.getpixel((x, y)) > 40 for x in range(w)] for y in range(h)]
    lab = [[0] * w for _ in range(h)]
    boxes = []
    for y in range(h):
        for x in range(w):
            if m[y][x] and not lab[y][x]:
                q = deque([(x, y)]); lab[y][x] = len(boxes) + 1; b = [x, y, x, y, 0]
                while q:
                    cx, cy = q.popleft(); b[4] += 1
                    b[0] = min(b[0], cx); b[1] = min(b[1], cy); b[2] = max(b[2], cx); b[3] = max(b[3], cy)
                    for dx in (-2, -1, 0, 1, 2):
                        for dy in (-2, -1, 0, 1, 2):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and m[ny][nx] and not lab[ny][nx]:
                                lab[ny][nx] = lab[y][x]; q.append((nx, ny))
                boxes.append(b)
    boxes.sort(key=lambda b: -b[4])
    big, bits = boxes[:want], boxes[want:]
    # little bits (sparkles, flying bees, drops of water) join the nearest big item
    for b in bits:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        near = min(big, key=lambda B: max(0, B[0] - cx, cx - B[2]) + max(0, B[1] - cy, cy - B[3]))
        d = max(0, near[0] - cx, cx - near[2]) + max(0, near[1] - cy, cy - near[3])
        if d < 40 and b[4] > 2:
            near[0] = min(near[0], b[0]); near[1] = min(near[1], b[1]); near[2] = max(near[2], b[2]); near[3] = max(near[3], b[3])
    assert len(big) == want, f'found {len(big)} items, wanted {want}'
    # reading order: group into rows by vertical centre
    big.sort(key=lambda b: (b[1] + b[3]) / 2)
    rows, cur = [], []
    for b in big:
        if cur and (b[1] + b[3]) / 2 - (cur[-1][1] + cur[-1][3]) / 2 > h * 0.18:
            rows.append(cur); cur = []
        cur.append(b)
    rows.append(cur)
    out = []
    for row in rows:
        out += sorted(row, key=lambda b: b[0])
    return [(max(0, b[0] * s - 4), max(0, b[1] * s - 4), min(im.width, (b[2] + 1) * s + 4), min(im.height, (b[3] + 1) * s + 4)) for b in out]


def grid(im, cols, rows):
    """icon sheets are cut by their grid, so an icon made of two parts (a sun over a leaf) stays one icon"""
    w, h = im.width // cols, im.height // rows
    out = []
    for r in range(rows):
        for c in range(cols):
            cell = (c * w, r * h, c * w + w, r * h + h)
            bb = im.crop(cell).getbbox()
            out.append((cell[0] + bb[0], cell[1] + bb[1], cell[0] + bb[2], cell[1] + bb[3]))
    return out


def shrink(im, f):
    """nearest-neighbour by a whole factor, sampling the middle of each block, with a hard alpha"""
    w, h = max(1, im.width // f), max(1, im.height // f)
    out = Image.new('RGBA', (w, h))
    src, dst = im.load(), out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[min(im.width - 1, x * f + f // 2), min(im.height - 1, y * f + f // 2)]
            dst[x, y] = (r, g, b, 255) if a > 140 else (0, 0, 0, 0)
    bb = out.getbbox()
    return out.crop(bb) if bb else out


sprites = {}
kinds = {}
for sheet, (names, f, kind) in SHEETS.items():
    path = SRC / f'{sheet}.png'
    if not path.exists():
        print('missing', sheet); continue
    im = key(Image.open(path))
    boxes = grid(im, 3, 2) if sheet.startswith('icons') else items(im, len(names))
    for name, box in zip(names, boxes):
        sprites[name] = shrink(im.crop(box), FACTOR.get(name, f))
        kinds[name] = kind

# one shared palette for every sprite, cut separately from the alpha
collage_w = sum(s.width for s in sprites.values())
collage = Image.new('RGB', (collage_w, max(s.height for s in sprites.values())), (0, 0, 0))
x = 0
for s in sprites.values():
    bg = Image.new('RGB', s.size, s.getpixel((s.width // 2, s.height // 2))[:3])
    bg.paste(s.convert('RGB'), (0, 0), s)
    collage.paste(bg, (x, 0)); x += s.width
pal = collage.quantize(64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
for name, s in sprites.items():
    rgb = s.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB').convert('RGBA')
    rgb.putalpha(s.getchannel('A'))
    sprites[name] = rgb

# shelf-pack the atlas
order = sorted(sprites, key=lambda n: -sprites[n].height)
W = 1024
pos, x, y, row = {}, 0, 0, 0
for n in order:
    s = sprites[n]
    if x + s.width > W:
        x, y, row = 0, y + row + 1, 0
    pos[n] = (x, y); x += s.width + 1; row = max(row, s.height)
atlas = Image.new('RGBA', (W, y + row + 1))
for n, (ax, ay) in pos.items():
    atlas.paste(sprites[n], (ax, ay))
atlas.save(OUT / 'atlas.png', optimize=True)


def anchor(name, s):
    k = kinds[name]
    if k == 'bottom':
        return s.width // 2, s.height - 1
    if k == 'centre':
        return s.width // 2, s.height // 2
    # a branch: the middle of its cut base on the left, and the far tip
    a = s.getchannel('A').load()
    col = [y for y in range(s.height) if a[0, y]] or [s.height - 1]
    return 0, (min(col) + max(col)) // 2


def tip(s):
    a = s.getchannel('A').load()
    best, bx, by = -1, 0, 0
    for yy in range(s.height):
        for xx in range(s.width):
            if a[xx, yy] and xx - yy * 0.6 + (s.height - yy) * 0.9 > best:
                best, bx, by = xx - yy * 0.6 + (s.height - yy) * 0.9, xx, yy
    return bx, by


lines = []
for n in sorted(sprites):
    s = sprites[n]; ax, ay = anchor(n, s); x0, y0 = pos[n]
    extra = ''
    if kinds[n] == 'base':
        tx, ty = tip(s); extra = f', {tx}, {ty}'
    lines.append(f"  '{n}': [{x0}, {y0}, {s.width}, {s.height}, {ax}, {ay}{extra}],")
(ROOT / 'lib' / 'tembusu-art.ts').write_text(
    "// Tembusu: where each sprite sits in public/art/tembusu/atlas.png. Written by scripts/tembusu-art.py; don't edit by hand.\n"
    "// [x, y, w, h, anchor x, anchor y] (and for branches the tip x, y), in pixels of the atlas.\n"
    "export const ATLAS: Record<string, number[]> = {\n" + '\n'.join(lines) + "\n};\n")

for name in HILLS + ['title']:
    p = SRC / f'{name}.png'
    if not p.exists():
        print('missing', name); continue
    im = Image.open(p).convert('RGB').resize((384, 256), Image.Resampling.NEAREST)
    im.quantize(64, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB').save(OUT / f'{name}.png', optimize=True)

# the ground line of the master hill, every 4 pixels across: the first grass pixel from the top
hd = Image.open(OUT / 'hill-dawn.png').convert('RGB').load()
ground = []
for gx in range(0, 384, 4):
    gy = next((yy for yy in range(80, 256) if hd[gx, yy][1] > hd[gx, yy][0] - 10), 255)
    ground.append(gy)
with open(ROOT / 'lib' / 'tembusu-art.ts', 'a') as fh:
    fh.write("/** where the grass starts at every 4th column of the 384 by 256 hill */\nexport const GROUND = [" + ', '.join(map(str, ground)) + "];\n")

for sheet, (names, f) in PAGES.items():
    p = SRC / f'{sheet}.png'
    if not p.exists():
        print('missing', sheet); continue
    im = key(Image.open(p))
    for name, box in zip(names, items(im, len(names))):
        if name.startswith('_'):
            continue  # the first journal had a ribbon over the right page; journal2 replaced it
        s = shrink(im.crop(box), f if name == 'journal' else 4)
        rgb = s.convert('RGB').quantize(48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB').convert('RGBA')
        rgb.putalpha(s.getchannel('A'))
        rgb.save(OUT / f'{name}.png', optimize=True)

print(f'{len(sprites)} sprites in a {W}x{atlas.height} atlas; wrote', sorted(p.name for p in OUT.iterdir()))
