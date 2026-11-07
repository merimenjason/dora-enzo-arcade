#!/usr/bin/env python3
"""Overclock: turns the Codex paintings into 16-bit pixel art.

Every sheet was painted large on flat magenta. This script keys the magenta out, crops each figure, scales it down to
its in-game size with a box filter, snaps each sprite set to one shared palette (so frames never flicker between
colours), cleans stray pixels and gives sprites a one-pixel ink outline. Frames are packed into webp strips under
public/art/overclock/; lib/overclock-art.ts records each strip's cell size and frame count, and lib/overclock-boxes.ts
each foe's and boss's painted bounds per frame, which the engine uses as hitboxes.

    python3 scripts/overclock-art.py <folder with the oc-*.png paintings> <folder with the mock-ups>
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
MOCK = Path(sys.argv[2] if len(sys.argv) > 2 else SRC)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'art' / 'overclock'
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = {}
FOE_BOXES = {}
BOSS_BOXES = {}
INK = (20, 14, 34)


def have(name):
    return (SRC / f'{name}.png').exists()


def load(name):
    return Image.open(SRC / f'{name}.png').convert('RGBA')


def key(im):
    """the flat magenta becomes clear, and its anti-aliased fringe is pulled towards the ink outline"""
    a = np.asarray(im.convert('RGBA')).astype(np.int16).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g
    hard = (m > 95) & (r > 150) & (b > 150)
    soft = (m > 35) & ~hard & (np.abs(r - b) < 110)
    a[hard] = 0
    k = np.clip((m - 35) / 60.0, 0, 1)
    for c, ink in zip(range(3), INK):
        ch = a[..., c]
        ch[soft] = (ch[soft] * (1 - k[soft]) + ink * k[soft]).astype(np.int16)
    a[..., 3][soft] = (255 * (1 - k[soft] * 0.85)).astype(np.int16)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def cells(im, cols, rows):
    w, h = im.width // cols, im.height // rows
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in range(rows) for x in range(cols)]


def biggest(im, keep=0.12):
    """keep the cell's main figure: drop opaque pieces much smaller than the biggest (a stray limb from the next
    cell, specks), labelled on a quarter-size mask"""
    a = np.asarray(im).copy()
    m = a[::4, ::4, 3] > 60
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes = [0]
    for y0 in range(h):
        for x0 in range(w):
            if not m[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes); lab[y0, x0] = n
            stack, cnt = [(y0, x0)], 0
            while stack:
                y, x = stack.pop(); cnt += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; stack.append((yy, xx))
            sizes.append(cnt)
    if len(sizes) <= 2:
        return im
    big = max(sizes)
    drop = np.array([i == 0 or s < big * keep for i, s in enumerate(sizes)])
    drop[0] = False
    gone = np.repeat(np.repeat(drop[lab], 4, 0), 4, 1)[:a.shape[0], :a.shape[1]]
    a[..., 3][gone] = 0
    return Image.fromarray(a)


def bbox(im):
    a = np.asarray(im)[..., 3] > 60
    ys, xs = np.nonzero(a)
    if not len(xs):
        return (0, 0, im.width, im.height)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def shrink(im, w, h):
    """box-scale to (w, h) with a hard alpha"""
    big = im.resize((max(1, w) * 4, max(1, h) * 4), Image.LANCZOS)
    small = big.resize((max(1, w), max(1, h)), Image.BOX)
    a = np.asarray(small).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    return Image.fromarray(a)


def palette_of(frames, colors):
    """one palette for a whole set of frames"""
    w = sum(f.width for f in frames) + len(frames)
    h = max(f.height for f in frames)
    sheet = Image.new('RGB', (w, h), (0, 0, 0))
    x = 0
    for f in frames:
        rgb = Image.new('RGB', f.size, (0, 0, 0)); rgb.paste(f.convert('RGB'), mask=f.split()[3])
        sheet.paste(rgb, (x, 0)); x += f.width + 1
    return sheet.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def snap(f, pal, outline=True, clean=True):
    """snap to the palette, remove lone pixels, add an ink outline (one pixel of margin all round)"""
    rgb = f.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB')
    out = np.zeros((f.height + 2, f.width + 2, 4), np.uint8)
    out[1:-1, 1:-1, :3] = np.asarray(rgb)
    out[1:-1, 1:-1, 3] = np.asarray(f)[..., 3]
    al = out[..., 3] > 0
    if clean:
        n = np.zeros(al.shape, np.int16)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy:
                    n += np.roll(np.roll(al, dy, 0), dx, 1)
        out[..., 3][al & (n <= 1)] = 0
        al = out[..., 3] > 0
    if outline:
        edge = np.zeros_like(al)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            edge |= np.roll(np.roll(al, dy, 0), dx, 1)
        edge &= ~al
        out[edge] = (*INK, 255)
    return Image.fromarray(out)


def strip(name, frames, anchors, cw, ch, ax, ay):
    """pack frames into one strip of cw x ch cells; each frame's anchor lands on (ax, ay) in its cell"""
    out = Image.new('RGBA', (cw * len(frames), ch))
    for i, (f, (fx, fy)) in enumerate(zip(frames, anchors)):
        cell = Image.new('RGBA', (cw, ch))
        cell.alpha_composite(f, (int(round(ax - fx)), int(round(ay - fy))) if True else (0, 0))
        out.alpha_composite(cell, (i * cw, 0))
    out.save(OUT / f'{name}.webp', lossless=True, method=6)
    MANIFEST[name] = (cw, ch, len(frames))
    al = np.asarray(out)[..., 3] > 0
    boxes = []
    for i in range(len(frames)):
        c = al[:, i * cw:(i + 1) * cw]
        ys, xs = np.nonzero(c)
        boxes.append([int(xs.min()) - ax, int(ys.min()) - ay, int(xs.max() - xs.min()) + 1, int(ys.max() - ys.min()) + 1] if len(xs) else [0, 0, 0, 0])
    print(f'{name:16} {len(frames):2} x {cw}x{ch}')
    return boxes


def foot_x(f):
    a = np.asarray(f)[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.55):])
    return float(xs.mean()) if len(xs) else f.width / 2


def figure(cell):
    k = biggest(key(cell))
    return k.crop(bbox(k))


# ─── the heroes ─────────────────────────────────────────────────────────────
# frame order in each hero's strip; a sheet not painted yet falls back to sheet A's frames
HERO_H = {'dora': 44, 'enzo': 46}
# until sheets B and C are painted, their frames borrow the nearest sheet-A frame (see lib/overclock-anim.ts)
# the nearest pose for a frame that isn't painted yet (frames 8-31; an entry may point at another stand-in)
FALLBACK = {'dora': [6, 3, 7, 6, 7, 6, 7, 0, 0, 2, 4, 6, 6, 0, 3, 6, 21, 9, 14, 6, 0, 15, 16, 0],
            'enzo': [6, 3, 7, 6, 7, 7, 0, 0, 0, 0, 2, 4, 6, 6, 0, 3, 22, 23, 13, 8, 0, 14, 16, 8]}


def cream(im):
    """Dora's fur is cream-white: the paintings drift it to peach, so warm, pale, softly coloured pixels are pulled to
    ivory (the jacket's coral is far more saturated, and her pink nose and inner ears stay pinker than the fur)"""
    a = np.asarray(im).astype(np.float32).copy()
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    warm = (rgb[..., 0] >= rgb[..., 1]) & (rgb[..., 0] >= rgb[..., 2]) & (rgb[..., 1] >= rgb[..., 2] - 0.02)
    fur = (a[..., 3] > 0) & warm & (sat > 0.06) & (sat < 0.36) & (mx > 0.5)
    v = mx[fur]
    k = np.clip((sat[fur] - 0.06) / 0.3, 0, 1)
    a[..., 0][fur] = v * 255
    a[..., 1][fur] = v * 255 * (0.95 - 0.03 * k)
    a[..., 2][fur] = v * 255 * (0.84 - 0.04 * k)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


PAINTED = {}


def hero(h):
    painted = []
    for s in 'abcd':
        if have(f'oc-{h}-{s}'):
            painted += [figure(c) for c in cells(load(f'oc-{h}-{s}'), 4, 2)]
        else:
            painted += [None] * 8
    PAINTED[h] = ''.join(s for s in 'abcd' if have(f'oc-{h}-{s}'))
    idle = painted[0]
    sc = HERO_H[h] / idle.height
    raw = []
    for i, f in enumerate(painted):
        j = i
        while f is None:
            j = FALLBACK[h][j - 8]
            f = painted[j]
        f = shrink(f, round(f.width * sc), round(f.height * sc))
        raw.append(cream(f) if h == 'dora' else f)
    pal = palette_of(raw, 40)
    frames = [snap(f, pal) for f in raw]
    anchors = [(foot_x(f), f.height - 1) for f in frames]
    cw = max(max(int(ax), f.width - int(ax)) for f, (ax, _) in zip(frames, anchors)) * 2 + 4
    ch = max(f.height for f in frames) + 6
    strip(h, frames, anchors, cw, ch, cw // 2, ch - 2)


# ─── foes: two kinds per sheet, four frames each ───────────────────────────
FOE_SHEETS = {'a': ('drone', 'sentry'), 'b': ('bat', 'hopper'), 'c': ('claw', 'riot'), 'd': ('gecko', 'grub'),
              'e': ('holo', 'jelly'), 'f': ('cube', 'dish'), 'g': ('firefly', 'sweeper')}
FOE_H = {'drone': 22, 'sentry': 26, 'bat': 18, 'hopper': 22, 'claw': 26, 'riot': 28, 'gecko': 16, 'grub': 28,
         'holo': 20, 'jelly': 26, 'cube': 26, 'dish': 28, 'firefly': 14, 'sweeper': 24}
FOE_ORDER = [k for s in 'abcdefg' for k in FOE_SHEETS[s]]


def foes():
    allf, anch = [], []
    for s in 'abcdefg':
        cs = cells(load(f'oc-foe-{s}'), 4, 2)
        for row, kind in enumerate(FOE_SHEETS[s]):
            keyed = [biggest(key(c), 0.05) for c in cs[row * 4:row * 4 + 4]]
            bx = [bbox(k) for k in keyed]
            # the idle frame's middle anchors all four, so a frame that lunges moves off it
            x0, y0, x1, y1 = bx[0]
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            sc = FOE_H[kind] / (y1 - y0)
            for k, b in zip(keyed, bx):
                f = k.crop(b)
                f = shrink(f, round(f.width * sc), round(f.height * sc))
                allf.append(f)
                anch.append(((cx - b[0]) * sc + 1, (b[3] - b[1]) * sc + 1 - MINI_GROUND[kind] if kind in MINI_GROUND else (cy - b[1]) * sc + 1))
    pal = palette_of(allf, 64)
    frames = [snap(f, pal) for f in allf]
    cw = max(max(ax, f.width - ax) for f, (ax, _) in zip(frames, anch)) * 2 + 2
    chh = max(max(ay, f.height - ay) for f, (_, ay) in zip(frames, anch)) * 2 + 2
    cw, chh = int(cw) + 1, int(chh) + 1
    boxes = strip('foes', frames, anch, cw, chh, cw // 2, chh // 2)
    for i, kind in enumerate(FOE_ORDER):
        FOE_BOXES[kind] = boxes[i * 4:i * 4 + 4]


# ─── bosses ─────────────────────────────────────────────────────────────────
# bosses read as big threats: about 2-3 times a hero's 44-46 px (the mole fills half the room, as in the mock-up)
BOSS_H = {'sentinel': 96, 'crab': 100, 'chameleon': 92, 'mole': 132, 'peacock': 128, 'heron': 132, 'rhino': 112, 'owl': 112, 'firefly': 108,
          'spider': 112, 'serpent': 96, 'lumen-a': 170, 'lumen-b': 110}


GROUNDED = {'sentinel', 'crab', 'chameleon', 'mole', 'peacock', 'rhino', 'spider', 'lumen-a'}


def boss(name):
    cs = cells(load(f'oc-boss-{name}'), 4, 2)
    keyed = [biggest(key(c), 0.1) for c in cs]
    bx = [bbox(k) for k in keyed]
    x0, y0, x1, y1 = bx[0]
    cx = (x0 + x1) / 2
    sc = BOSS_H[name] / (y1 - y0)
    raw, anch = [], []
    for i, (k, b) in enumerate(zip(keyed, bx)):
        f = k.crop(b)
        raw.append(shrink(f, round(f.width * sc), round(f.height * sc)))
        # anchored at the idle frame's feet; a ground boss stands every frame on the floor (the painted frames sit at
        # different heights in their cells: the mole's digging frame floated)
        fy = (b[3] - b[1]) * sc + 1 if name in GROUNDED else (y1 - b[1]) * sc + 1
        anch.append(((cx - b[0]) * sc + 1, fy))
    pal = palette_of(raw, 40)
    frames = [snap(f, pal) for f in raw]
    if name in GROUNDED:
        # stand on the lowest solid row that is drawn, not on faint dust the snap dropped
        anch = [(ax, f.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()[3] - 1) for f, (ax, _) in zip(frames, anch)]
    cw = int(max(max(ax, f.width - ax) for f, (ax, _) in zip(frames, anch)) * 2 + 4)
    up = max(ay for _, ay in anch)
    down = max(f.height - ay for f, (_, ay) in zip(frames, anch))
    ch = int(up + max(down, 2) + 4)
    BOSS_BOXES[name] = strip(f'boss-{name}', frames, anch, cw, ch, cw // 2, int(up) + 2)
    MANIFEST[f'boss-{name}'] = (cw, ch, 8, int(up) + 2)


# the rooftop sentinel (a boss sheet) and the eight district mini-bosses: same 8-frame layout as the bosses; minis are
# anchored at their middle like the foes they grew from
MINI_H = {'claw': 76, 'gecko': 60, 'grub': 58, 'holo': 72, 'sentry': 78, 'cube': 80, 'dish': 84, 'firefly': 64}
MINI_BOXES = {}
# the walking minis stand on the floor: the engine keeps a big foe's middle this far above its feet (twice the small
# foe's half-height), so each frame's bottom goes that far below the anchor
MINI_GROUND = {'gecko': 14, 'grub': 26, 'sentry': 24, 'cube': 24, 'dish': 26}


def mini(kind):
    cs = cells(load(f'oc-mini-{kind}'), 4, 2)
    keyed = [biggest(key(c), 0.1) for c in cs]
    bx = [bbox(k) for k in keyed]
    x0, y0, x1, y1 = bx[0]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sc = MINI_H[kind] / (y1 - y0)
    raw, anch = [], []
    for k, b in zip(keyed, bx):
        f = k.crop(b)
        raw.append(shrink(f, round(f.width * sc), round(f.height * sc)))
        anch.append(((cx - b[0]) * sc + 1, (b[3] - b[1]) * sc + 1 - MINI_GROUND[kind] if kind in MINI_GROUND else (cy - b[1]) * sc + 1))
    pal = palette_of(raw, 32)
    frames = [snap(f, pal) for f in raw]
    cw = int(max(max(ax, f.width - ax) for f, (ax, _) in zip(frames, anch)) * 2 + 4)
    up = max(ay for _, ay in anch)
    down = max(f.height - ay for f, (_, ay) in zip(frames, anch))
    ch = int(up + max(down, 2) + 4)
    MINI_BOXES[kind] = strip(f'mini-{kind}', frames, anch, cw, ch, cw // 2, int(up) + 2)
    MANIFEST[f'mini-{kind}'] = (cw, ch, 8, int(up) + 2)


# ─── tiles, backdrops, paintings, icons ─────────────────────────────────────
AREAS = ['roof', 'port', 'signs', 'depot', 'arcade', 'highway', 'scrap', 'observatory', 'plant', 'tower']


def water():
    """the hover-bike water: four rolling surface frames (magenta above the waterline is keyed out), then three depths"""
    cs = cells(load('oc-water'), 4, 2)
    out = [shrink(key(c) if i < 4 else c.convert('RGBA'), 16, 16) for i, c in enumerate(cs)]
    pal = palette_of(out, 24)
    frames = [snap(f, pal, outline=False, clean=False).crop((1, 1, 17, 17)) for f in out]
    im = Image.new('RGBA', (16 * 8, 16))
    for i, f in enumerate(frames):
        im.alpha_composite(f, (i * 16, 0))
    im.save(OUT / 'water.webp', lossless=True, method=6)
    MANIFEST['water'] = (16, 16, 8)


def tiles(a):
    cs = cells(load(f'oc-tiles-{a}'), 3, 3)
    out = []
    for i, c in enumerate(cs):
        k = key(c) if i in (3, 4, 7) else c.convert('RGBA')
        out.append(shrink(k, 16, 16))
    pal = palette_of(out, 32)
    frames = [snap(f, pal, outline=False, clean=False).crop((1, 1, 17, 17)) for f in out]
    im = Image.new('RGBA', (16 * 9, 16))
    for i, f in enumerate(frames):
        im.alpha_composite(f, (i * 16, 0))
    im.save(OUT / f'tiles-{a}.webp', lossless=True, method=6)
    MANIFEST[f'tiles-{a}'] = (16, 16, 9)


def cover(im, w, h):
    r = w / h
    if im.width / im.height > r:
        nw = int(im.height * r); x = (im.width - nw) // 2
        return im.crop((x, 0, x + nw, im.height))
    nh = int(im.width / r); y = (im.height - nh) // 2
    return im.crop((0, y, im.width, y + nh))


def opaque(name, im, w, h, colors=48):
    small = cover(im.convert('RGB'), w, h).resize((w * 4, h * 4), Image.LANCZOS).resize((w, h), Image.BOX)
    q = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, kmeans=2, dither=Image.Dither.NONE).convert('RGB')
    q.save(OUT / f'{name}.webp', lossless=True, method=6)
    MANIFEST[name] = (w, h, 1)


def keyed(name, im, w, h, colors=40):
    k = key(cover(im, w, h))
    f = shrink(k, w, h)
    pal = palette_of([f], colors)
    snap(f, pal, outline=False).crop((1, 1, w + 1, h + 1)).save(OUT / f'{name}.webp', lossless=True, method=6)
    MANIFEST[name] = (w, h, 1)


def sprites(name, sheet, size, cols=4, rows=2, colors=48, outline=True):
    figs = [figure(c) for c in cells(load(sheet), cols, rows)]
    raw = []
    for f in figs:
        s = size / max(f.width, f.height)
        raw.append(shrink(f, max(1, round(f.width * s)), max(1, round(f.height * s))))
    pal = palette_of(raw, colors)
    frames = [snap(f, pal, outline=outline) for f in raw]
    cw = ch = size + 2
    im = Image.new('RGBA', (cw * len(frames), ch))
    for i, f in enumerate(frames):
        im.alpha_composite(f, (i * cw + (cw - f.width) // 2, ch - f.height if name == 'props' else (ch - f.height) // 2))
    im.save(OUT / f'{name}.webp', lossless=True, method=6)
    MANIFEST[name] = (cw, ch, len(frames))
    print(f'{name:16} {len(frames):2} x {cw}x{ch}')


def portraits():
    cs = cells(load('oc-portraits'), 4, 2)
    out = []
    for i, c in enumerate(cs):
        k = key(c); b = bbox(k)
        f = k.crop(b)
        f = (cream(f) if i < 2 else f).convert('RGB')
        out.append(f.resize((256, 256), Image.LANCZOS).resize((64, 64), Image.BOX))
    im = Image.new('RGB', (64 * 8, 64))
    for i, f in enumerate(out):
        im.paste(f, (i * 64, 0))
    im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'portraits.webp', lossless=True, method=6)
    MANIFEST['portraits'] = (64, 64, 8)


# the approved stage-select mock-up's nine frames: the eight bosses round the heroes (left, top, right, bottom)
SELECT_BOXES = [(326, 22, 602, 254), (634, 22, 912, 254), (942, 22, 1220, 254), (318, 292, 556, 530), (594, 292, 958, 530),
                (992, 292, 1230, 530), (312, 566, 596, 828), (628, 566, 922, 828), (952, 566, 1236, 828)]
SELECT_ORDER = ['crab', 'chameleon', 'mole', 'peacock', 'heroes', 'heron', 'rhino', 'owl', 'firefly']


def select():
    im = Image.open(MOCK / 'oc-select.png').convert('RGB')
    out = Image.new('RGB', (96 * 9, 80))
    for i, b in enumerate(SELECT_BOXES):
        f = im.crop(b)
        f = cover(f, 96, 80).resize((96 * 4, 80 * 4), Image.LANCZOS).resize((96, 80), Image.BOX)
        out.paste(f, (i * 96, 0))
    out.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'select.webp', lossless=True, method=6)
    MANIFEST['select'] = (96, 80, 9)


if __name__ == '__main__':
    for h in ('dora', 'enzo'):
        hero(h)
    foes()
    for b in BOSS_H:
        if have(f'oc-boss-{b}'):
            boss(b)
    for m in MINI_H:
        if have(f'oc-mini-{m}'):
            mini(m)
    for a in AREAS:
        if have(f'oc-tiles-{a}'):
            tiles(a)
        if have(f'oc-bg-{a}'):
            opaque(f'bg-{a}', load(f'oc-bg-{a}'), 512, 288, 40)
        if have(f'oc-mid-{a}'):
            keyed(f'mid-{a}', load(f'oc-mid-{a}'), 512, 288)
    if have('oc-water'):
        water()
    if have('oc-bg-bike'):
        opaque('bg-bike', load('oc-bg-bike'), 512, 288, 40)
    for p in ('title', 'hub', 'ending'):
        if have(f'oc-{p}'):
            opaque(p, load(f'oc-{p}'), 480, 270, 64)
    portraits()
    select()
    sprites('icons', 'oc-icons-a', 22)
    sprites('parts', 'oc-icons-b', 22)
    sprites('cores', 'oc-icons-c', 22)
    sprites('props', 'oc-icons-d', 46)
    # the manifest and the hitboxes
    lines = ['// Generated by scripts/overclock-art.py: each art strip’s cell width, cell height, frame count (and, for a boss, the',
             '// row of its feet in the cell).',
             'export const ART: Record<string, number[]> = {']
    for k, v in MANIFEST.items():
        lines.append(f"  '{k}': [{', '.join(str(int(x)) for x in v)}],")
    lines.append('};')
    lines.append('export const HAVE: string[] = [' + ', '.join(f"'{k}'" for k in MANIFEST) + '];')
    lines.append('// which of each hero\'s four 8-frame sheets (a-d, 32 frames) are painted; the rest stand in with a close pose')
    lines.append('export const PAINTED: Record<string, string> = {' + ', '.join(f"{k}: '{v}'" for k, v in PAINTED.items()) + '};')
    (ROOT / 'lib' / 'overclock-art.ts').write_text('\n'.join(lines) + '\n')
    bl = ['// Generated by scripts/overclock-art.py: each painted frame’s opaque bounds [x, y, w, h] in game pixels, measured from',
          '// the sprite’s centre (foes) or its feet (bosses), facing left as painted. The engine uses these as hitboxes.',
          'export const FOE_BOXES: Record<string, [number, number, number, number][]> = {']
    for k, v in FOE_BOXES.items():
        bl.append(f"  {k}: [{', '.join('[' + ', '.join(str(x) for x in b) + ']' for b in v)}],")
    bl.append('};')
    bl.append('export const BOSS_BOXES: Record<string, [number, number, number, number][]> = {')
    for k, v in BOSS_BOXES.items():
        bl.append(f"  '{k}': [{', '.join('[' + ', '.join(str(x) for x in b) + ']' for b in v)}],")
    bl.append('};')
    bl.append('export const MINI_BOXES: Record<string, [number, number, number, number][]> = {')
    for k, v in MINI_BOXES.items():
        bl.append(f"  '{k}': [{', '.join('[' + ', '.join(str(x) for x in b) + ']' for b in v)}],")
    bl.append('};')
    (ROOT / 'lib' / 'overclock-boxes.ts').write_text('\n'.join(bl) + '\n')
    total = sum(p.stat().st_size for p in OUT.glob('*.webp'))
    print(f'{len(MANIFEST)} strips, {total / 1e6:.2f} MB')
