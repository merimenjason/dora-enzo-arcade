#!/usr/bin/env python3
"""The Sunken Bellspire: turns the Codex paintings into hi-bit pixel art.

Every sheet was painted large on flat magenta. This script keys the magenta out, crops each figure, scales it down to
its in-game pixel size with a box filter (so detail averages instead of aliasing), snaps it to a small palette with no
dithering, cleans stray pixels and gives sprites a one-pixel ink outline. Frames are packed into strips under
public/art/bellspire/, and lib/bellspire-art.ts records each strip's cell size and frame count for the scene.

    python3 scripts/bellspire-art.py <folder with the bs-*.png paintings>
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'art' / 'bellspire'
OUT.mkdir(parents=True, exist_ok=True)
MANIFEST = {}
BOXES = {}  # name: per-frame painted bounds (x0, y0, x1, y1) from the draw point
PARTS = []  # the part maps of the frames being scaled (the heroes'), in order
# the decor frames with open flames (the torch and candle frames the scene uses; the docks light with a lantern post
# and the throne with a chandelier, so they have none)
OPEN_FLAMES = {'halls': (6, 0), 'towers': (4, 6), 'crypt': (6, 2), 'loft': (0,), 'cast': (0,), 'glass': (6,), 'salt': (0,), 'haul': (0,)}
OPEN_FLAMES.update(orchard=(0, 6), rootcellar=(0, 6))
# the Foundry Below's sheets full of violet and pink glass were painted on flat green, which the magenta key would eat
GREEN = {'bs-tiles-glass', 'bs-decor-glass', 'bs-mid-glass', 'bs-tiles-fd', 'bs-props-fd', 'bs-foe-cbat', 'bs-foe-gsnail',
         'bs-foes-e', 'bs-boss-choir', 'bs-boss-choir2', 'bs-boss-choir3', 'bs-icons-d'}
FLAMES = {}  # decor sheet: per frame, the painted flames' boxes
FOE_BODY = {}  # foe kind: the frame whose bounds are its body
INK = (34, 24, 32)


def load(name):
    return Image.open(SRC / f'{name}.png').convert('RGBA')


def key(im, green=False):
    """the flat magenta (or, with `green`, the flat green) becomes clear, and its anti-aliased fringe is pulled towards
    the ink outline"""
    a = np.asarray(im.convert('RGBA')).astype(np.int16).copy()
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green:
        m = g - np.maximum(r, b)
        hard = (m > 95) & (g > 150)
    else:
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


def have(name):
    """whether a painting is in the source folder (a strip whose paintings are not all painted yet is left out, never
    filled in with stand-ins)"""
    return (SRC / f'{name}.png').exists()


def kload(name):
    """a sheet, keyed on the ground it was painted on"""
    return key(load(name), name in GREEN)


def _hsv(a):
    r, g, b = a[..., 0] / 255, a[..., 1] / 255, a[..., 2] / 255
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr, gg, bb = (mx == r) & m, (mx == g) & m & (mx != r), (mx == b) & m & (mx != r) & (mx != g)
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx


def _rgb(h, s, v):
    c = v * s
    x = c * (1 - np.abs((h / 60) % 2 - 1))
    m = v - c
    z = np.zeros_like(h)
    k = (h // 60).astype(int) % 6
    r = np.choose(k, [c, x, z, z, x, c]); g = np.choose(k, [x, c, c, x, z, z]); b = np.choose(k, [z, z, x, c, c, x])
    return np.stack([(r + m) * 255, (g + m) * 255, (b + m) * 255], -1)


def _ramp(t, stops):
    """a colour ramp: t in 0..1 through (t, (r, g, b)) stops"""
    out = np.zeros(t.shape + (3,))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        k = ((t - t0) / max(t1 - t0, 1e-6))[m][:, None]
        out[m] = np.array(c0) * (1 - k) + np.array(c1) * k
    return out


def hero_colours(im, hero, outfit=False):
    """Tell the heroes apart at a glance: Dora warm cream-white with a teal coat, Enzo mid-grey with a rust coat. The
    painted fur is remapped onto a fixed ramp, the coats are pushed to their hue, and the pink inner ears are toned
    down so they don't dominate a small sprite. The magenta ground is left alone for the keyer. With `outfit` (the
    Windward Jacket and the Highland Cloak), only the fur and ears are touched: the clothes keep their painted colours,
    and the fur is only the fur's own hues (so Dora's dusty-rose jacket and Enzo's slate-blue cloak are never fur)."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32).copy()
    rgb = a[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ground = (np.minimum(r, b) - g > 60) & (r > 140) & (b > 140)
    h, sat, v = _hsv(rgb)
    lum = (0.3 * r + 0.55 * g + 0.15 * b) / 255
    pinkish = ((h > 320) | (h < 15)) & (sat > 0.22) & (sat < 0.62) & (v > 0.72) & ~ground
    if outfit and hero == 'dora':
        # (the dusty-rose jacket shares the ears' hue; the ears are its palest, brightest pink)
        pinkish &= (v > 0.9) & (sat < 0.55)
    if hero == 'enzo':
        fur = (sat < 0.34) & (np.minimum(r, b) >= g - 6) & (v > 0.18) & ~ground
        if outfit:
            fur &= (b - r < 24)
        if outfit == 'h':
            # the Highland Cloak's felt is painted a deep navy: lift it towards slate so it reads at sprite size
            cloak = (h > 200) & (h < 265) & (sat > 0.18) & ~ground
            rgb[cloak] = _rgb(np.full(h.shape, 222.0)[cloak], np.clip(sat[cloak], 0.4, 0.65), np.clip(v[cloak] * 1.05 + 0.02, 0, 1))
        rgb[fur] = _ramp(np.clip(lum[fur] * 1.05, 0, 1), [(0, (34, 36, 42)), (0.35, (88, 92, 102)), (0.6, (138, 143, 153)), (0.8, (169, 173, 181)), (1, (214, 217, 223))])
        coat = ((h > 330) | (h < 25)) & (sat >= 0.45) & (v < 0.85) & ~ground & (not outfit)
        nh = np.full(h.shape, 16.0)
        rgb[coat] = _rgb(nh[coat], np.clip(sat[coat] * 0.92, 0, 1), v[coat] * 0.95)
    else:
        fur = (sat < 0.3) & (r >= b) & (v > 0.55) & ~ground & ~pinkish
        if outfit:
            fur &= ((h >= 18) & (h <= 70)) | (sat < 0.08)
        rgb[fur] = _ramp(np.clip(lum[fur], 0, 1), [(0.4, (150, 124, 104)), (0.65, (214, 192, 164)), (0.85, (244, 232, 210)), (1, (255, 250, 238))])
        coat = (h > 150) & (h < 250) & (sat > 0.2) & ~ground & (not outfit)
        nh = np.full(h.shape, 178.0)
        rgb[coat] = _rgb(nh[coat], np.clip(sat[coat] * 1.25 + 0.1, 0, 0.85), np.clip(v[coat] * 1.12, 0, 1))
    # tone the inner ears and blush down: halfway to the fur
    furc = np.array((150, 154, 162) if hero == 'enzo' else (238, 222, 200), np.float32)
    keep = 0.35 if hero == 'enzo' else 0.5
    rgb[pinkish] = rgb[pinkish] * keep + furc * (1 - keep)
    a[..., :3] = rgb
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def _grow(m, r):
    """a square dilation by r pixels (separable, no wrap-around)"""
    if r <= 0:
        return m
    p = np.pad(m, r)
    h = np.zeros_like(p)
    for d in range(-r, r + 1):
        h |= np.roll(p, d, 1)
    v = np.zeros_like(p)
    for d in range(-r, r + 1):
        v |= np.roll(h, d, 0)
    return v[r:-r, r:-r]


def _shrink(m, r):
    return ~_grow(~m, r)


def _flood(m, y0, x0):
    """the connected piece of mask `m` holding (y0, x0)"""
    h, w = m.shape
    out = np.zeros_like(m)
    out[y0, x0] = True
    stack = [(y0, x0)]
    while stack:
        y, x = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not out[yy, xx]:
                out[yy, xx] = True
                stack.append((yy, xx))
    return out


def _big_parts(m, min_cells, step=4, away=None, share=0.8):
    """keep the connected pieces of a mask that are at least `min_cells` cells big (labelled at 1/step size); with
    `away`, also drop the pieces that lie mostly (`share` of their cells) inside it"""
    q = m[::step, ::step]
    aq = away[::step, ::step] if away is not None else None
    h, w = q.shape
    lab = np.zeros((h, w), np.int32)
    keep = np.zeros((h, w), bool)
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if not q[y0, x0] or lab[y0, x0]:
                continue
            n += 1
            lab[y0, x0] = n
            stack, cells = [(y0, x0)], []
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
            if len(cells) >= min_cells and (aq is None or sum(aq[y, x] for y, x in cells) < share * len(cells)):
                for y, x in cells:
                    keep[y, x] = True
    big = np.repeat(np.repeat(keep, step, 0), step, 1)[:m.shape[0], :m.shape[1]]
    return m & _grow(big, step)


# the parts of a hero that gear recolours: 1 the coat, 2 Dora's blade or Enzo's staff shaft, 3 Enzo's lantern
PART_COAT, PART_BLADE, PART_LAMP = 1, 2, 3


def hero_parts(fig, hero):
    """Label a (coloured, full-size) hero figure's coat and weapon pixels by colour and shape, so the scene can
    recolour them for the gear worn. The coat is the big blob of the coat's hue (opened, so a staff of the same hue
    crossing it isn't swept in, and closed, so the buttons on it are left alone); Dora's blade is the large bluish-grey
    piece (her fur is warm, so it can't be caught, and the eyes' highlights are too small to count); Enzo's shaft is
    the rest of the wood-brown, and his lantern the brass and glow off the coat."""
    a = np.asarray(fig).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] > 60
    h, sat, v = _hsv(rgb)
    r, b = rgb[..., 0], rgb[..., 2]
    ink = (v < 0.2)
    out = np.zeros(al.shape, np.uint8)
    if hero == 'dora':
        coatc = al & ~ink & (h > 150) & (h < 250) & (sat > 0.2)
        blob = _grow(_shrink(coatc, 4), 4)
        coat = coatc & _grow(blob, 3)
        blade = al & ~ink & (sat < 0.3) & (b - r > -8) & (v > 0.38) & ~coat
        blade = _big_parts(blade, 12)
        out[coat] = PART_COAT
        out[blade] = PART_BLADE
    return out


def enzo_parts(px):
    """Enzo's coat and staff share one rust-brown hue, so they are told apart by shape on the finished pixel sprite:
    the coat is a body of that colour at least three pixels thick (and the pixels hugging it), the staff the one- and
    two-pixel lines of it left over, and the lantern the brass and glow (with its dark frame beside them)."""
    a = np.asarray(px).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] > 0
    h, sat, v = _hsv(rgb)
    ink = np.all(a[..., :3] == INK, axis=-1) | (v < 0.16)
    rust = al & ~ink & ((h > 340) | (h < 27)) & (sat >= 0.33) & (v < 0.9)
    body = _grow(_shrink(rust, 1), 1)
    n = np.zeros(rust.shape, np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                n += np.roll(np.roll(body, dy, 0), dx, 1)
    # the coat is the big piece of that body; small pieces of it are the lantern hanging off the staff
    lab = np.zeros(body.shape, np.int32)
    sizes = [0]
    H, W = body.shape
    for y0 in range(H):
        for x0 in range(W):
            if body[y0, x0] and not lab[y0, x0]:
                k = len(sizes); lab[y0, x0] = k; stack = [(y0, x0)]; cnt = 0
                while stack:
                    y, x = stack.pop(); cnt += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < H and 0 <= xx < W and body[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = k; stack.append((yy, xx))
                sizes.append(cnt)
    big = np.isin(lab, [k for k, c in enumerate(sizes) if k and c >= 16])
    small = body & ~big
    n = np.zeros(rust.shape, np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                n += np.roll(np.roll(big, dy, 0), dx, 1)
    coat = big | (rust & (n >= 2))
    coat |= rust & _grow(coat, 1) & (v < 0.45)  # the coat's dark edge shading, not the staff
    glow = al & ~ink & (h >= 24) & (h < 62) & (sat > 0.3) & (v > 0.55) & ~coat
    lamp = (glow | small) & ~coat
    lamp |= al & ~ink & ~coat & _grow(lamp, 1) & (sat > 0.25) & ((h < 62) | (h > 340))
    staff = rust & ~coat & ~lamp
    out = np.zeros(rust.shape, np.uint8)
    out[coat] = PART_COAT
    out[staff] = PART_BLADE
    out[lamp] = PART_LAMP
    return out


def enzo_zones(raw, outfit=False):
    """Where Enzo's lantern and staff are, read from the painting before the colour pass (which pushes the staff's wood
    and the coat's rust to one hue). The lantern is found by its glow (the brightest warm pixels) and taken as the box
    round it, grown by a lantern's frame and cap; when it isn't lit, by the biggest piece of brass. The staff is every
    long piece of wood or brass outside the lantern (some sheets paint the shaft brass; the eyes and the coat's brass
    buttons are too small to count), and the coat is its painted red grown to take in the trim. Returns 3 for the
    lantern zone, 2 for the staff zone and 1 for the coat zone, at full size."""
    a = np.asarray(raw).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] > 60
    h, sat, v = _hsv(rgb)
    H, W = al.shape
    k = H / 286  # the painted size of a frame
    brass = al & (h >= 28) & (h < 70) & (sat > 0.3) & (v > 0.3)
    glow = al & (h >= 30) & (h < 62) & (sat > 0.35) & (v > 0.82)
    red = al & ((h >= 330) | (h < 8)) & (sat > 0.45)
    if outfit == 'h':
        # the Highland Cloak's blue felt is the coat: a brass clasp on it is no lantern
        red |= al & (h > 200) & (h < 265) & (sat > 0.18)
    mx, my, reach = int(7 * k), int(12 * k), int(20 * k)

    def boxes(seed):
        """the lantern's box: the glass is the most solid bright piece not sitting on the coat (the hook's highlight
        is a long thin curve, a buckle sits on red); the frame's and the cap's bright pieces close round it join it,
        and the box is grown by the frame and the cap. Returns a box per light"""
        lab = np.zeros(seed.shape, np.int32); n = 0; found = []
        for y0, x0 in zip(*np.nonzero(seed)):
            if lab[y0, x0]:
                continue
            n += 1; lab[y0, x0] = n; stack = [(y0, x0)]; pts = []
            while stack:
                y, x = stack.pop(); pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and seed[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; stack.append((yy, xx))
            ys = np.array([p[0] for p in pts]); xs = np.array([p[1] for p in pts])
            if len(pts) >= 6:
                found.append((len(pts), len(pts) / ((np.ptp(ys) + 1) * (np.ptp(xs) + 1)), ys.min(), ys.max() + 1, xs.min(), xs.max() + 1))
        def on_coat(b):
            y0, y1, x0, x1 = max(0, b[2] - my), b[3] + my, max(0, b[4] - mx), b[5] + mx
            return red[y0:y1, x0:x1].sum() > 0.2 * max(1, al[y0:y1, x0:x1].sum())
        cands = [f for f in found if not on_coat(f)]
        if not cands:
            return []
        cands.sort(key=lambda f: -f[0] * f[1])
        top = cands[0][0] * cands[0][1]
        out = []
        for core in cands:
            # another solid bright piece nearly as big is a second light (a raised spell, a coin held up beside the
            # lantern); a long thin one (fill under 0.45) is a hook's highlight
            if core is not cands[0] and (core[1] < 0.45 or core[0] * core[1] < 0.12 * top):
                continue
            if any(b[0] <= core[2] and core[3] <= b[1] and b[2] <= core[4] and core[5] <= b[3] for b in out):
                continue
            y0, y1, x0, x1 = core[2], core[3], core[4], core[5]
            for f in found:
                if f[2] >= core[2] - reach and f[3] <= core[3] + reach and f[4] >= core[4] - reach and f[5] <= core[5] + reach:
                    y0, y1, x0, x1 = min(y0, f[2]), max(y1, f[3]), min(x0, f[4]), max(x1, f[5])
            out.append((max(0, y0 - my), y1 + my, max(0, x0 - mx), x1 + mx))
        return out

    bs = boxes(_big_parts(glow, 3, step=2)) or boxes(_big_parts(_shrink(_grow(brass, 3), 3), 20))
    lamp = np.zeros_like(al)
    for y0, y1, x0, x1 in bs:
        lamp[y0:y1, x0:x1] = True
    lamp &= al
    warm = al & (((h >= 6) & (h < 30) & (sat > 0.3) & (v > 0.12)) | brass) & ~lamp
    # (a staff is thin, so anything warm that is fat, like a lit coat's folds, is not staff)
    fat = _grow(_shrink(_shrink(_grow(warm, 3), 3), int(9 * k)), int(11 * k))
    pieces = _big_parts(warm & ~fat, 24)
    if lamp.any():
        # the staff is the piece that carries the lantern (the coat's orange trim never touches it), and, past a
        # paw that splits it, whatever warm lies on the line of its shaft
        near = _grow(lamp, int(10 * k))
        held = np.zeros_like(pieces)
        for y0, x0 in zip(*np.nonzero(pieces & near)):
            if held[y0, x0]:
                continue
            piece = _flood(pieces, y0, x0)
            py, px = np.nonzero(piece)
            # (a staff is long; a cuff's trim by a coin held up is not)
            if max(np.ptp(py), np.ptp(px)) >= 50 * k:
                held |= piece
        ys, xs = np.nonzero(held)
        if len(ys) >= 40:
            # the shaft: the half of the piece farthest from the lantern (the other half is the hook)
            ly, lx = np.nonzero(lamp)
            far = np.argsort(np.hypot(ys - ly.mean(), xs - lx.mean()))[len(ys) // 2:]
            ys, xs = ys[far], xs[far]
        line = np.zeros_like(held)
        if len(ys) >= 20:
            cy, cx = ys.mean(), xs.mean()
            _, _, vt = np.linalg.svd(np.stack([ys - cy, xs - cx], 1), full_matrices=False)
            dy, dx = vt[0]
            yy, xx = np.mgrid[0:H, 0:W]
            line = np.abs((yy - cy) * dx - (xx - cx) * dy) < 6 * k
        # (on the line, a shaft in shadow can be as red as the coat; the coat's own red is broad, the shaft thin)
        thin_red = red & ~_grow(_shrink(_shrink(_grow(red, 3), 3), int(9 * k)), int(11 * k))
        cand = (warm | thin_red) & line & _grow(held, int(120 * k)) & ~held
        more = np.zeros_like(cand)
        for y0, x0 in zip(*np.nonzero(cand)):
            if more[y0, x0]:
                continue
            piece = _flood(cand, y0, x0)
            py, px = np.nonzero(piece)
            # (a run of shaft is long; an eye or a mouth the line happens to cross is not)
            if max(np.ptp(py), np.ptp(px)) >= 35 * k:
                more |= piece
            cand &= ~piece
        staff = _grow(held | more, 2) & al & ~lamp
    else:
        staff = _grow(pieces, 2) & al & ~lamp & ~fat
    # the coat: its painted red, grown a little to take in its trim (the only place the coat can be)
    coat = _grow(red & (v < 0.85), int(4 * k)) & al & ~lamp
    out = np.zeros(al.shape, np.uint8)
    out[coat] = PART_COAT
    out[staff] = PART_BLADE
    out[lamp] = PART_LAMP
    return out


def enzo_merge(px, shape, zones):
    """Enzo's final part map: the shape labels (coat, staff, lantern) checked against the painted zones, so the
    lantern is never coat or staff, and the staff is only ever where the painting had wood (never an ear's edge)."""
    a = np.asarray(px)
    lampz = zones == PART_LAMP
    lamp = (lampz | ((shape == PART_LAMP) & _grow(lampz, 1))) & (a[..., 3] > 0)
    ink = np.all(a[..., :3] < 45, axis=-1)
    # the coat only where the painting had the coat's red nearby: a lantern or a staff is never coat
    coat = (shape == PART_COAT) & ~lamp & _grow((zones == PART_COAT) | (zones == PART_BLADE) & _grow(zones == PART_COAT, 1), 1)
    # the staff wherever the painting had wood and the shapes found no coat (thin lines of rust next to the wood count)
    staff = ((zones == PART_BLADE) | ((shape == PART_BLADE) & _grow(zones == PART_BLADE, 1))) & (a[..., 3] > 0) & ~ink & ~lamp & ~coat
    # where a pose paints the shaft as dark and red as the coat, the painting can't tell them apart, but the shapes
    # can: a long thin line of the shapes' staff that holds the lantern, or runs on 16 pixels or more (an ear's rim
    # is shorter), is the staff
    sb = (shape == PART_BLADE) & ~staff & ~lamp & ~coat & ~ink & (a[..., 3] > 0)
    seen = np.zeros_like(sb)
    for y0, x0 in zip(*np.nonzero(sb)):
        if seen[y0, x0]:
            continue
        piece = _flood(sb | staff, y0, x0) & sb
        seen |= piece
        py, px = np.nonzero(piece)
        if (piece & _grow(lamp | staff, 1)).any() or max(np.ptp(py), np.ptp(px)) >= 16:
            staff |= piece
    # cloth the shapes missed (a collar, a turned-back lapel): unlabelled pixels next to the coat that the painting had
    # as the coat's red and that are still a deep rust in the sprite
    rgb = a[..., :3].astype(np.int16)
    rust = (rgb[..., 0] > rgb[..., 1] + 40) & (rgb[..., 0] > rgb[..., 2] + 40) & (rgb[..., 0] < 235) & (rgb[..., 1] < 150)
    # (spreading out from the coat a pixel at a time, so an ear's rim far from it never joins)
    # (the shapes often call a collar staff, it being long, thin and rust, and a hem far from the lantern lantern)
    cloth = (zones == PART_COAT) & rust & ~ink & ~lamp & ~staff & ~coat & (a[..., 3] > 0)
    for _ in range(16):
        coat |= cloth & _grow(coat, 1)
    # a coat pixel touching the lantern belongs to the lantern's rim unless it sits well inside the coat
    n = np.zeros(coat.shape, np.int16)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy or dx:
                n += np.roll(np.roll(coat, dy, 0), dx, 1)
    rim = coat & _grow(lamp, 1) & (n < 5)
    coat &= ~rim
    lamp |= rim
    # a little island of "coat" touching the lantern is the lantern's own dark band, not the coat
    H, W = coat.shape
    seen = np.zeros_like(coat)
    for y0, x0 in zip(*np.nonzero(coat)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True; stack = [(y0, x0)]; pts = []
        while stack:
            y, x = stack.pop(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and coat[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True; stack.append((yy, xx))
        if len(pts) < 16 and any(lamp[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any() for y, x in pts):
            for y, x in pts:
                coat[y, x] = False; lamp[y, x] = True
    out = np.zeros(shape.shape, np.uint8)
    out[coat] = PART_COAT
    out[staff] = PART_BLADE
    out[lamp] = PART_LAMP
    return out


def teal_trim(px, pm):
    """Dora's coat, finished on the pixel sprite: every teal pixel left (collar, cuffs, edges) is coat too"""
    a = np.asarray(px).astype(np.float32)
    h, sat, v = _hsv(a[..., :3])
    teal = (a[..., 3] > 0) & (h > 150) & (h < 250) & (sat > 0.18) & (v > 0.1) & ~np.all(a[..., :3] == INK, axis=-1)
    out = pm.copy()
    out[teal & (pm != PART_BLADE)] = PART_COAT
    return out


def parts_scaled(parts, w, h):
    """a part map shrunk to (w, h) the way the picture is: each pixel takes the part covering most of its box"""
    fr = []
    for k in (1, 2, 3):
        m = Image.fromarray(((parts == k) * 255).astype(np.uint8)).resize((w, h), Image.BOX)
        fr.append(np.asarray(m).astype(np.float32) / 255)
    fr = np.stack(fr)
    best = fr.argmax(0)
    return np.where(fr.max(0) > 0.42, best + 1, 0).astype(np.uint8)


def grey_fur(im):
    """Enzo's portrait: the same colours as his sprites"""
    return hero_colours(im, 'enzo')


def cells(im, cols, rows):
    w, h = im.width // cols, im.height // rows
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in range(rows) for x in range(cols)]


def drop_neighbours(im):
    """a sheet cell can catch a limb of the figure next door at its side; remove pieces touching the left or right
    edge that are much smaller than the main figure (labelled on a quarter-size mask, which is plenty)"""
    a = np.asarray(im).copy()
    m = a[::4, ::4, 3] > 60
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes, edge = [0], [False]
    for y0 in range(h):
        for x0 in range(w):
            if not m[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes)
            lab[y0, x0] = n
            stack, cnt, touch = [(y0, x0)], 0, False
            while stack:
                y, x = stack.pop()
                cnt += 1
                touch |= x == 0 or x == w - 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
            sizes.append(cnt); edge.append(touch)
    if len(sizes) <= 2:
        return im
    big = max(sizes)
    drop = np.zeros(len(sizes), bool)
    for i in range(1, len(sizes)):
        drop[i] = edge[i] and sizes[i] < big * 0.25
    gone = np.repeat(np.repeat(drop[lab], 4, 0), 4, 1)[:a.shape[0], :a.shape[1]]
    a[..., 3][gone] = 0
    return Image.fromarray(a)


def label(m):
    """connected pieces of a boolean mask: (labels, sizes, boxes as [y0, x0, y1, x1])"""
    h, w = m.shape
    lab = np.zeros((h, w), np.int32)
    sizes, boxes = [0], [None]
    for y0 in range(h):
        for x0 in range(w):
            if not m[y0, x0] or lab[y0, x0]:
                continue
            n = len(sizes)
            lab[y0, x0] = n
            stack, cnt, box = [(y0, x0)], 0, [y0, x0, y0, x0]
            while stack:
                y, x = stack.pop()
                cnt += 1
                box = [min(box[0], y), min(box[1], x), max(box[2], y), max(box[3], x)]
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        stack.append((yy, xx))
            sizes.append(cnt); boxes.append(box)
    return lab, sizes, boxes


def figures(im, n):
    """the n biggest figures on a sheet, left to right, whole even where they stray over the grid lines; small loose
    pieces (a tongue, a drip) join the figure whose box they sit in"""
    a = np.asarray(im)
    lab, sizes, boxes = label(a[::4, ::4, 3] > 60)
    order = sorted(range(1, len(sizes)), key=lambda i: -sizes[i])[:n]
    order.sort(key=lambda i: boxes[i][1])
    groups = {i: [i] for i in order}
    for j in range(1, len(sizes)):
        if j in groups or sizes[j] < sizes[order[0]] * 0.004:
            continue
        cy, cx = (boxes[j][0] + boxes[j][2]) / 2, (boxes[j][1] + boxes[j][3]) / 2
        for i in order:
            y0, x0, y1, x1 = boxes[i]
            py, px = (y1 - y0) * 0.15, (x1 - x0) * 0.15
            if y0 - py <= cy <= y1 + py and x0 - px <= cx <= x1 + px:
                groups[i].append(j)
                break
    out = []
    for i in order:
        keep = np.isin(lab, groups[i])
        big = np.repeat(np.repeat(keep, 4, 0), 4, 1)[:a.shape[0], :a.shape[1]]
        b = a.copy()
        b[..., 3][~big] = 0
        out.append(bbox(Image.fromarray(b)))
    return out


def bbox(im, keep_small=False):
    """crop to the figure: drop specks far from the main body"""
    a = np.asarray(im)[..., 3] > 60
    if not a.any():
        return im.crop((0, 0, 1, 1))
    if not keep_small:
        # drop rows/columns whose opaque run is tiny and isolated (stray magenta speckle survivors)
        ys, xs = np.nonzero(a)
        cy, cx = np.median(ys), np.median(xs)
        d = np.hypot(ys - cy, xs - cx)
        lim = np.percentile(d, 99.5) * 1.15
        a2 = np.zeros_like(a)
        a2[ys[d <= lim], xs[d <= lim]] = True
        a = a2
    ys, xs = np.nonzero(a)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def unrope(fig):
    """a figure hanging from a painted rope (the clappers), cut off where the rope meets its knot or ring: the scene
    draws the rope itself, from wherever it is tied, so the sprite and its bounds are the body alone. The rope is the
    run of narrow rows at the top; a figure without one is left whole"""
    a = np.asarray(fig)[..., 3] > 60
    wide = a.sum(1)
    h = len(wide)
    top = wide[:max(4, h // 8)]
    rope = float(np.median(top[top > 0])) if (top > 0).any() else 0
    if not rope or rope > 0.2 * wide.max():
        return fig
    rows = np.nonzero(wide > 1.8 * rope)[0]
    y = int(rows[0]) if len(rows) else 0
    if y < 0.08 * h:
        return fig
    return bbox(fig.crop((0, y, fig.width, h)), keep_small=True)


def pixelate(im, w, h, colors=24, outline=True, clean=True):
    """box-scale to (w, h), hard alpha, a small palette and an ink outline"""
    big = im.resize((w * 4, h * 4), Image.LANCZOS)
    small = big.resize((w, h), Image.BOX)
    a = np.asarray(small).astype(np.int16).copy()
    alpha = a[..., 3] > 110
    # un-premultiply the edge so faded fringe pixels keep their colour
    rgb = Image.fromarray(a[..., :3].astype(np.uint8))
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.asarray(q)
    out[..., 3] = np.where(alpha, 255, 0)
    if clean:
        al = out[..., 3] > 0
        n = np.zeros_like(al, dtype=np.int16)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy:
                    n += np.roll(np.roll(al, dy, 0), dx, 1)
        out[..., 3][al & (n <= 1)] = 0
    if outline:
        al = out[..., 3] > 0
        edge = np.zeros_like(al)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            edge |= np.roll(np.roll(al, dy, 0), dx, 1)
        edge &= ~al
        edge[0, :] = edge[-1, :] = False
        edge[:, 0] = edge[:, -1] = False
        out[edge] = (*INK, 255)
    return Image.fromarray(out)


def scaled(fig, s, colors=24, outline=True, parts=None):
    w, h = max(1, round(fig.width * s)), max(1, round(fig.height * s))
    px = pixelate(fig, w, h, colors, outline=False)
    if parts is not None:
        pm = parts_scaled(parts, w, h)
        pm[np.asarray(px)[..., 3] == 0] = 0
        PARTS.append(np.pad(pm, 1) if outline else pm)
    if outline:
        bigger = Image.new('RGBA', (w + 2, h + 2))
        bigger.paste(px, (1, 1))
        a = np.asarray(bigger).copy()
        al = a[..., 3] > 0
        edge = np.zeros_like(al)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            edge |= np.roll(np.roll(al, dy, 0), dx, 1)
        edge &= ~al
        a[edge] = (*INK, 255)
        px = Image.fromarray(a)
    return px


def foot_x(px):
    """where the figure stands: the middle of the opaque pixels in its bottom third"""
    a = np.asarray(px)[..., 3] > 0
    h = a.shape[0]
    ys, xs = np.nonzero(a[int(h * 0.62):])
    return float(xs.mean()) if len(xs) else px.width / 2


def strip(name, frames, cw, ch, anchor='foot', note='', parts=None, lamps=None):
    """pack frames into one strip of (cw, ch) cells; each frame's foot sits at the cell's bottom middle. With `parts`
    (a part map per frame), also write <name>-parts.webp: the part number times 80 in red, opaque where there is one.
    With `lamps` (a mask per frame of where the painting had the lantern), that mask goes in its green, for the
    browser suite's lantern check, which so never leans on the part labels"""
    cw = max(cw, *(f.width for f in frames))
    ch = max(ch, *(f.height for f in frames))
    out = Image.new('RGBA', (cw * len(frames), ch))
    pout = np.zeros((ch, cw * len(frames), 4), np.uint8) if parts is not None else None
    for i, f in enumerate(frames):
        if anchor == 'foot':
            fx = foot_x(f)
            x = int(round(cw / 2 - fx))
            x = max(0, min(cw - f.width, x))
            y = ch - f.height
        else:
            x, y = (cw - f.width) // 2, (ch - f.height) // 2
        out.alpha_composite(f, (i * cw + x, y))
        if pout is not None:
            pm = parts[i].copy()
            pm[np.all(np.asarray(f)[..., :3] == INK, axis=-1)] = 0
            sl = pout[y:y + f.height, i * cw + x:i * cw + x + f.width]
            sl[..., 0] = pm * 80
            lm = lamps[i] & (np.asarray(f)[..., 3] > 0) if lamps is not None else np.zeros(pm.shape, bool)
            sl[..., 1] = np.where(lm, 255, 0)
            sl[..., 3] = np.where((pm > 0) | lm, 255, 0)
    out.save(OUT / f'{name}.webp', lossless=True, method=6)
    if pout is not None:
        Image.fromarray(pout).save(OUT / f'{name}-parts.webp', lossless=True, method=6)
    MANIFEST[name] = (cw, ch, len(frames))
    # each frame's painted bounds, measured from the point the scene draws it at (the cell's bottom middle), so
    # hitboxes can be taken from the art itself
    al = np.asarray(out)[..., 3] > 0
    bx = []
    for i in range(len(frames)):
        cell = al[:, i * cw:(i + 1) * cw]
        ys, xs = np.nonzero(cell)
        bx.append((int(xs.min()) - cw // 2, int(ys.min()) - ch, int(xs.max()) + 1 - cw // 2, int(ys.max()) + 1 - ch) if len(xs) else (0, 0, 0, 0))
    BOXES[name] = bx
    print(f'{name:14} {len(frames):2} x {cw}x{ch} {note}')


def opaque(name, im, w, h, colors=48, kmeans=0):
    """a painted scene, pixelated to (w, h) with no transparency; `kmeans` refines the palette so small areas of
    colour (a coat against a big night sky) keep their own hue"""
    small = im.convert('RGB').resize((w * 4, h * 4), Image.LANCZOS).resize((w, h), Image.BOX)
    q = small.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, kmeans=kmeans, dither=Image.Dither.NONE).convert('RGB')
    q.save(OUT / f'{name}.webp', lossless=True, method=6)
    MANIFEST[name] = (w, h, 1)
    print(f'{name:14}  1 x {w}x{h}')


def cover(im, w, h):
    """crop to the aspect ratio w:h around the middle"""
    r = w / h
    if im.width / im.height > r:
        nw = int(im.height * r)
        x = (im.width - nw) // 2
        return im.crop((x, 0, x + nw, im.height))
    nh = int(im.width / r)
    y = (im.height - nh) // 2
    return im.crop((0, y, im.width, y + nh))


# ─── the heroes ────────────────────────────────────────────────────────────
SHEETS = 'abcdefghijkl'
# the outfits: every sheet painted again in the Windward Belfry's Windward Jacket (Dora) and Highland Cloak (Enzo), and
# the Foundry Below's Forge Apron (Dora) and Ashwork Smock (Enzo)
OUTFIT = {'dora': [('w', 'dora-windward'), ('r', 'dora-forge')], 'enzo': [('h', 'enzo-highland'), ('s', 'enzo-ash')]}


def hero_frames(hero, prefix, outfit=False, SHEETS=SHEETS):
    """a hero's 96 frames (from the sheets bs-<prefix>-a to -l), with their part maps and (Enzo) lantern masks"""
    src = lambda n: hero_colours(load(n), hero, outfit)
    # a, b: the first 16 frames; c to h, the animation pass (climb and land, run, idle and interactions, attacks,
    # body, water); i, j: every state its own poses (run start-up, Whirl Slash, Enzo's combo, bell strikes, wading,
    # treading); k: the Windward Belfry's (Bell Rope throw and swing, wind, hail; Enzo's echo, frost and gale casts);
    # l: the Foundry Below's (Dora's Bell Hammer slam, bounce and bell ring; Enzo's Resonance and ground Frost Fan; heat,
    # handing a weapon over to be recast, hopping off a hot floor).
    # 8 each, in the order of the HERO_FRAMES comment in lib/bellspire-anim.ts
    # (the new sheets' long staffs and swords can reach into the next cell, so stray pieces at a cell's side go)
    near = lambda sh: outfit or sh in 'ijkl'  # (the outfit sheets were all repainted, so any can stray)
    figs = [bbox(drop_neighbours(c) if near(sh) else c) for sh in SHEETS for c in cells(key(src(f'bs-{prefix}-{sh}')), 4, 2)]
    if hero == 'enzo':
        # the same figures before the colour pass, for where the lantern and the staff are
        raws = [bbox(drop_neighbours(c) if near(sh) else c) for sh in SHEETS for c in cells(key(load(f'bs-{prefix}-{sh}')), 4, 2)]
        assert all(r.size == f.size for r, f in zip(raws, figs)), 'raw and coloured figures should crop alike'
    s = 38 / figs[0].height  # the idle pose stands 38 pixels tall; every sheet was painted at the same size
    PARTS.clear()
    if hero == 'dora':
        frames = [scaled(f, s, 20, parts=hero_parts(f, hero)) for f in figs]
        parts = [teal_trim(f, pm) for f, pm in zip(frames, PARTS)]
        if outfit:
            # (no teal coat to finish: the jacket is never recoloured, so only the blade counts)
            parts = [np.where(pm == PART_BLADE, PART_BLADE, 0).astype(np.uint8) for pm in PARTS]
        lamps = None
    else:
        frames = [scaled(f, s, 20, parts=enzo_zones(r, outfit)) for f, r in zip(figs, raws)]
        parts = [enzo_merge(f, enzo_parts(f), z) for f, z in zip(frames, PARTS)]
        lamps = [z == PART_LAMP for z in PARTS]
    return frames, parts, lamps


for hero in ('dora', 'enzo'):
    frames, parts, lamps = hero_frames(hero, hero)
    # (an outfit whose sheets are not all painted yet keeps the sheets it has, a to k, or is left out)
    outs = []
    for wear, wname in OUTFIT[hero]:
        for shs in (SHEETS, SHEETS[:11]):
            if all(have(f'bs-{hero}-{wear}-{sh}') for sh in shs):
                outs.append((wname,) + hero_frames(hero, f'{hero}-{wear}', outfit=wear, SHEETS=shs))
                break
        else:
            print(f'{wname:14} not all painted yet: left out')
    # the outfit strips share the hero strip's cell size and frame order, so the scene can swap one for another
    every = frames + [f for o in outs for f in o[1]]
    cw = max(56, *(f.width for f in every))
    ch = max(44, *(f.height for f in every))
    strip(hero, frames, cw, ch, parts=parts, lamps=lamps)
    for wname, oframes, oparts, olamps in outs:
        strip(wname, oframes, cw, ch, parts=oparts, lamps=olamps)
    if all(have(f'bs-{hero}-salt-{sh}') for sh in SHEETS):
        salt_frames, salt_parts, salt_lamps = hero_frames(hero, f'{hero}-salt', outfit=True)
        strip(f'{hero}-salt', salt_frames, cw, ch, parts=salt_parts, lamps=salt_lamps)
    if all(have(f'bs-{hero}-orchard-{sh}') for sh in SHEETS):
        orchard_frames, orchard_parts, orchard_lamps = hero_frames(hero, f'{hero}-orchard', outfit=True)
        strip(f'{hero}-orchard', orchard_frames, cw, ch, parts=orchard_parts, lamps=orchard_lamps)

# Each Salt Road action has four poses in ordinary gear and four in its Salt Road outfit.
for hero in ('dora', 'enzo'):
    for area in ('salt', 'orchard'):
        sheet = f'bs-{hero}-{area}-work'
        if have(sheet):
            frames = [bbox(drop_neighbours(c)) for c in cells(kload(sheet), 4, 2)]
            strip(f'{hero}-{area}-work', [scaled(f, 38 / frames[0].height, 24) for f in frames], 58, 48)

# ─── enemies: frame A on top, frame B below ───────────────────────────────
FOE_H = {'frog': 20, 'moth': 15, 'eel': 18, 'reed': 30, 'condor': 30, 'imp': 19, 'shell': 30, 'vizcacha': 18,
         'jelly': 19, 'golem': 38,
         # the Windward Belfry (frames 104-135): wind spirit, hail-hawk, clapper on its rope, bell-beetle
         'gust': 22, 'hawk': 22, 'clapper': 28, 'beetle': 18,
         # the Foundry Below (frames 144-175, after the Windward Belfry's projectiles): bronze ingot, ember wisp,
         # crystal bat, glass snail
         'ingot': 20, 'ember': 16, 'cbat': 18, 'gsnail': 18}
FOE_FD = ('ingot', 'ember', 'cbat', 'gsnail')
order = [('bs-foes-a', ['frog', 'moth', 'eel', 'reed']), ('bs-foes-b', ['condor', 'imp', 'shell', 'vizcacha'])]
foes = []
for sheet, names in order:
    cs = [bbox(c) for c in cells(key(load(sheet)), 4, 2)]
    for i, n in enumerate(names):
        s = FOE_H[n] / cs[i].height
        foes += [scaled(cs[i], s, 18), scaled(cs[i + 4], s, 18)]
cs = [bbox(c) for c in cells(key(load('bs-foes-c')), 4, 2)]
for i, n in ((0, 'jelly'), (1, 'golem')):
    s = FOE_H[n] / cs[i].height
    foes += [scaled(cs[i], s, 18), scaled(cs[i + 4], s, 18)]
# projectiles: falling bell, mud ball, salt shard, fire orb
for i, hgt in ((2, 22), (3, 11), (6, 12), (7, 13)):
    foes.append(scaled(cs[i], hgt / cs[i].height, 16))
# the animation pass: each foe's own sheet, 8 frames from index 24 (idle x2, move x4, wind-up, attack); the idle
# frame keeps the height the foe had, and the body frames (idle and move) are what its hitbox is checked against
def foe_sheet(n):
    cs = [bbox(c) for c in cells(kload(f'bs-foe-{n}'), 4, 2)]
    if n == 'clapper':
        cs = [unrope(c) for c in cs]
    s = FOE_H[n] / cs[0].height
    FOE_BODY[n] = [len(foes) + j for j in range(6)]
    return [scaled(c, s, 18) for c in cs]


for n in FOE_H:
    if n not in FOE_FD:
        foes += foe_sheet(n)
# the Windward Belfry's projectiles (136-143): hail streak, icicle, gust puff, plank chunk, clapper shard, falling cog,
# sour-note ring fragment, big hailstone
cs = [bbox(c) for c in cells(key(load('bs-foes-d')), 4, 2)]
for c, hgt in zip(cs, (12, 20, 16, 14, 12, 14, 14, 16)):
    foes.append(scaled(c, hgt / c.height, 16))
for n in FOE_FD:
    foes += foe_sheet(n)
# the Foundry Below's projectiles (176-183): ember spark, bronze glob, glass shard, crystal note, molten splash chunk,
# hollow-toll ring fragment, lava drop, falling bell blank
cs = [bbox(c) for c in cells(kload('bs-foes-e'), 4, 2)]
for c, hgt in zip(cs, (10, 12, 12, 14, 16, 14, 12, 16)):
    foes.append(scaled(c, hgt / c.height, 16))
for n, height in (('brine-skater', 15), ('salt-hare', 24), ('pack-tick', 18), ('crust-crawler', 19)):
    if not have(f'bs-foe-{n}'):
        continue
    FOE_H[n] = height
    foes += foe_sheet(n)
for n, height in (('wall-moth', 17), ('thorn-hare', 23), ('clay-beetle', 20), ('root-mite', 16)):
    if have(f'bs-foe-{n}'):
        FOE_H[n] = height
        foes += foe_sheet(n)
strip('foes', foes, 64, 48)

# ─── bosses ───────────────────────────────────────────────────────────────
def boss(name, sheet, height, cw, ch, rope=False, fit=False):
    """frames 0-2: rest, wind-up, attack; 3-5 (the animation pass): a second wind-up, stagger, calmed. With `rope`, the
    painted rope it hangs from is cut off (the scene draws it). With `fit`, the second sheet was painted at another
    size, so its frames are scaled to make its calmed frame (hanging straight, like the rest frame) as wide as the rest"""
    if not (have(sheet) and have(sheet + '2')):
        print(f'{name:14} not all painted yet: left out')
        return
    cs = figures(key(load(sheet)), 3)
    more = figures(key(load(sheet + '2')), 3)
    if rope:
        cs, more = [unrope(c) for c in cs], [unrope(c) for c in more]
    s = height / cs[0].height
    s2 = s * cs[0].width / more[2].width if fit else s
    strip(name, [scaled(c, s, 32) for c in cs] + [scaled(c, s2, 32) for c in more], cw, ch)


boss('boss-frog', 'bs-boss-frog', 74, 150, 96)
boss('boss-puma', 'bs-boss-puma', 60, 170, 92)
boss('boss-mother', 'bs-boss-mother', 120, 280, 150)
# the Windward Belfry's guardians: the Hail Condor, the Twin Clappers (iron for Dora's blade, glass for Enzo's spells),
# the Out-of-Tune Bell
boss('boss-condor', 'bs-boss-condor', 90, 240, 130)
boss('boss-clapper-a', 'bs-boss-clapper-a', 64, 110, 110, rope=True)
boss('boss-clapper-b', 'bs-boss-clapper-b', 64, 110, 110, rope=True)
boss('boss-bell', 'bs-boss-bell', 120, 200, 160, fit=True)
# the Foundry Below's guardians: the Molten Founder, the Hollow Bell (its dark shell, then its molten heart set free)
boss('boss-founder', 'bs-boss-founder', 100, 220, 140)
boss('boss-hollow', 'bs-boss-hollow', 120, 200, 160)
boss('boss-hollowb', 'bs-boss-hollowb', 110, 200, 160)
for n, height in (('weighmaster', 94), ('panback', 65), ('tollkeeper', 105)):
    if not have(f'bs-boss-{n}'):
        continue
    frames = [bbox(c) for c in cells(kload(f'bs-boss-{n}'), 3, 2)]
    scale = height / frames[0].height
    strip(f'boss-{n}', [scaled(f, scale, 30) for f in frames], 184, 130)
for n, height in (('bracken-stag', 85), ('rootback', 59), ('graft-mother', 105)):
    if have(f'bs-boss-{n}'):
        frames = [bbox(c) for c in cells(kload(f'bs-boss-{n}'), 3, 1)]
        strip(f'boss-{n}', [scaled(f, height / frames[0].height, 28) for f in frames], 190, 130)


def choir(name, sheets, height, cw, ch):
    """the Glass Choir: three singers (low, middle, high) on each sheet (resting, singing, calmed), all at one scale"""
    if not all(have(sh) for sh in sheets):
        print(f'{name:14} not all painted yet: left out')
        return
    figs = [f for sh in sheets for f in figures(kload(sh), 3)]
    s = height / figs[0].height
    strip(name, [scaled(f, s, 32) for f in figs], cw, ch)


choir('boss-choir', ('bs-boss-choir', 'bs-boss-choir2', 'bs-boss-choir3'), 60, 90, 90)

# the hydra: its coiled body stays put, and its three heads move on their own necks
hy = cells(key(load('bs-boss-hydra')), 3, 1)
body = bbox(hy[0])
s = 150 / body.height
base = body.crop((0, int(body.height * 0.52), body.width, body.height))
idle_head = bbox(body.crop((0, 0, int(body.width * 0.5), int(body.height * 0.2))))
tell = bbox(hy[1])
open_head = bbox(tell.crop((int(tell.width * 0.05), 0, int(tell.width * 0.55), int(tell.height * 0.18))))
strip('boss-hydra', [scaled(base, s, 32)], 220, 96)
hs = 30 / idle_head.height
# the animation pass: six painted heads: calm, sway, open, hurt, asleep, snapping
heads = [bbox(drop_neighbours(c)) for c in cells(key(load('bs-hydra-heads')), 3, 2)]
hh = 30 / heads[0].height
strip('hydra-head', [scaled(h, hh, 24) for h in heads], 80, 48)

# the warden: the great bell, and the small bells at the end of its chains
wd = cells(key(load('bs-boss-warden')), 3, 1)
f0 = bbox(wd[0])
f1 = bbox(wd[1])


# the great bell alone, without its chains: measured boxes on the 1536×1024 sheet (frame 1 hanging, frame 2 lit)
wsheet = key(load('bs-boss-warden'))
bell = bbox(drop_neighbours(wsheet.crop((84, 250, 346, 706))))
lit = bbox(drop_neighbours(wsheet.crop((546, 244, 836, 706))))
small = bbox(f0.crop((0, int(f0.height * 0.62), int(f0.width * 0.3), f0.height)))
s = 118 / bell.height
more = figures(key(load('bs-boss-warden2')), 3)  # the animation pass: tilted mid-swing, struck, calmed
strip('boss-warden', [scaled(bell, s, 32), scaled(lit, s, 32)] + [scaled(c, s * bell.width / more[2].width * 0.97, 32) for c in more], 150, 130)
strip('warden-bell', [scaled(small, 26 / small.height, 20)], 40, 32)

# ─── props, people and pickups ────────────────────────────────────────────
PROPS = [40, 40, 40, 18, 18, 48, 26, 30]  # shrine, shrine lit, water bell, chest, chest open, door, reed wreck, lectern
cs = [bbox(c) for c in cells(key(load('bs-props')), 4, 2)]
# the animation pass (bs-world): a chest with its lid half up (frame 8) and rubble for crumbling walls (frame 9);
# torch and candle flame frames for the flicker
wd = [bbox(drop_neighbours(c)) for c in cells(key(load('bs-world')), 4, 2)]
strip('props', [scaled(c, h / c.height, 24) for c, h in zip(cs, PROPS)] + [scaled(wd[3], 22 / wd[3].height, 24), scaled(wd[7], 9 / wd[7].height, 16)], 64, 56)
# the Windward Belfry's props: bell hook, echo bell (unlit, lit), wind bell (still, rung), giant bell, Wayra's boat,
# note platform; sized by height, or by width where the width is what matters
PROPS2 = [('h', 18), ('h', 26), ('h', 26), ('h', 34), ('h', 34), ('w', 56), ('w', 70), ('w', 34)]
cs = [bbox(c) for c in cells(key(load('bs-props-wb')), 4, 2)]
strip('props2', [scaled(c, n / (c.height if d == 'h' else c.width), 24) for c, (d, n) in zip(cs, PROPS2)], 80, 56)
# the Foundry Below's props: forge furnace (lit), vent (closed, puffing mist), humming crystal (dim, ringing), beam
# emitter, Tupa's anvil with a bell blank, the tuneless bell blank; the second frame of a pair keeps the first's scale
# so the vent and the crystal stay the same size
PROPS3 = [44, 16, None, 22, None, 26, 28, 36]
cs = [bbox(c) for c in cells(kload('bs-props-fd'), 4, 2)]
ss = []
for c, hgt in zip(cs, PROPS3):
    ss.append(hgt / c.height if hgt else ss[-1])
strip('props3', [scaled(c, s, 24) for c, s in zip(cs, ss)], 64, 48)
strip('flames', [scaled(c, 18 / c.height, 12, outline=False) for c in wd[0:3]] + [scaled(c, 8 / c.height, 8, outline=False) for c in wd[4:7]], 16, 20)
cs = [bbox(c) for c in cells(key(load('bs-npcs')), 4, 2)]
NPCS = [44, 44, 50, 50, 12, 16, 10, 16]  # wayra x2, ukumari x2, wisp, ghost-glass, coins, ability orb
npc = [scaled(c, h / c.height, 24, outline=(i != 5)) for i, (c, h) in enumerate(zip(cs, NPCS))]
strip('npcs', npc, 72, 56)
# Tupa the bellfounder: idle, hammering, waving and talking, holding out a recast item
strip('npcs2', [scaled(c, 44 / c.height, 24) for c in (bbox(c) for c in cells(key(load('bs-npcs-fd')), 2, 2))], 72, 56)

# ─── icons and portraits ──────────────────────────────────────────────────
icons = []
# (the Windward Belfry's 32-39 come from a 4 by 2 sheet)
# (the Foundry Below's 40-47 too)
for sheet, (cols, rows) in (('bs-icons-a', (4, 4)), ('bs-icons-b', (4, 4)), ('bs-icons-c', (4, 2)), ('bs-icons-d', (4, 2))):
    for c in cells(kload(sheet), cols, rows):
        f = bbox(c)
        s = 20 / max(f.width, f.height)
        icons.append(scaled(f, s, 16))
for sheet in ('bs-icons-salt', 'bs-icons-orchard'):
    if have(sheet):
        for c in cells(kload(sheet), 4, 2):
            f = bbox(c)
            icons.append(scaled(f, 20 / max(f.width, f.height), 16))
strip('icons', icons, 24, 24, anchor='middle')
if have('bs-npc-suma'):
    frames = [bbox(c) for c in cells(kload('bs-npc-suma'), 2, 2)]
    strip('suma', [scaled(f, 43 / frames[0].height, 24) for f in frames], 64, 58)
if have('bs-props-salt'):
    sheet = kload('bs-props-salt')
    # The painted deck spans its nominal column, so slice at the actual gutters rather than cropping its end.
    edges = ((0, .233, .564, .75, 1), (0, .31, .565, .75, 1))
    figs = [bbox(sheet.crop((int(l * sheet.width), row * sheet.height // 2, int(r * sheet.width), (row + 1) * sheet.height // 2)))
            for row, xs in enumerate(edges) for l, r in zip(xs, xs[1:])]
    dims = ((29, 23), (144, 20), (17, 22), (17, 22), (144, 20), (32, 20), (14, 19), (24, 22))
    strip('props-salt', [pixelate(f, w, h, 20, outline=False) for f, (w, h) in zip(figs, dims)], 144, 30)
if have('bs-npc-killa'):
    keeper = bbox(kload('bs-npc-killa'))
    strip('killa', [scaled(keeper, 40 / keeper.height, 24)], 58, 54)
if have('bs-props-orchard'):
    frames = [bbox(c) for c in cells(kload('bs-props-orchard'), 4, 2)]
    dims = ((24, 25), (24, 25), (23, 25), (23, 25), (96, 13), (29, 24), (46, 62), (22, 14))
    strip('props-orchard', [pixelate(f, w, h, 22, outline=False) for f, (w, h) in zip(frames, dims)], 96, 64)
ports = []
for i, c in enumerate(cells(load('bs-portraits'), 3, 2)):
    f = bbox(key(hero_colours(c, 'enzo') if i == 1 else hero_colours(c, 'dora') if i in (0, 5) else c))  # Enzo is second; Dora first and last
    s = 60 / max(f.width, f.height)
    ports.append(scaled(f, s, 32))
# the Foundry Below's (6-8): Tupa, the Hollow Bell, the Molten Founder's mask; painted in a row, each its middle square
for c in cells(load('bs-portraits-fd'), 3, 1):
    f = bbox(key(cover(c, 1, 1)))
    ports.append(scaled(f, 60 / max(f.width, f.height), 32))
strip('portraits', ports, 64, 64, anchor='middle')

# ─── the Cloudstair's stone ─────────────────────────────────────────────────
# (its painted tile set read as flat orange brick against the warm backdrop: the play surfaces are redrawn here as
# weathered grey-gold stone with snow and ichu-grass caps, and its middle layer loses the rope bridge that looked
# walkable at the heroes' height and is pushed back)
import random
OUTLINE = (38, 36, 40); DEEP = (78, 76, 78); MID = (120, 118, 114); LIGHT = (156, 152, 140); HI = (198, 192, 172)
WARM = (138, 128, 104); GOLD = (184, 156, 88); GOLD_D = (130, 106, 60)
SNOW = (244, 248, 252); SNOW_S = (196, 212, 230); SNOW_D = (136, 156, 184)
GRASS = (222, 188, 96); GRASS_D = (156, 122, 54)

def cloud_stone(seed, crack=False, carve=False, under=False):
    """Irregular dressed stone: two or three courses of blocks of different lengths, each lit from the top left."""
    rnd = random.Random(seed)
    t = Image.new('RGBA', (16, 16), DEEP + (255,))
    px = t.load()
    y = 0
    heights = rnd.choice(((8, 8), (7, 9), (9, 7)))
    off = rnd.randint(0, 15)
    for h in heights:
        y0, y1 = y, min(16, y + h)
        # block lengths along this course (wrapping, so the tile still repeats)
        x, cuts = off, []
        while x < off + 16:
            cuts.append(x); x += rnd.randint(9, 16)
        cuts.append(off + 16)
        for a, b in zip(cuts, cuts[1:]):
            tone = rnd.choice((MID, (130, 126, 116), LIGHT, WARM, (112, 110, 108)))
            for yy in range(y0, y1):
                for xx in range(a, b):
                    c = tone
                    if xx == a or yy == y1 - 1: c = DEEP                                   # mortar
                    elif yy == y0: c = tuple(min(255, v + 26) for v in tone)                     # lit top
                    elif xx == a + 1: c = tuple(min(255, v + 12) for v in tone)                  # softer lit side
                    elif xx == b - 1 or yy == y1 - 2: c = tuple(max(0, v - 18) for v in tone)    # shade
                    else:
                        n = rnd.randint(-4, 4)
                        c = tuple(max(0, min(255, v + n)) for v in tone)
                        if rnd.random() < 0.02: c = GOLD                                   # lichen
                    px[xx % 16, yy] = c + (255,)
        y = y1
        off = (off + rnd.randint(4, 9)) % 16
    if crack:
        x = rnd.randint(4, 11)
        for yy in range(1, 15):
            px[x, yy] = OUTLINE + (255,)
            if rnd.random() < 0.45: x = max(1, min(14, x + rnd.choice((-1, 1))))
            if rnd.random() < 0.2: px[min(15, x + 1), yy] = DEEP + (255,)
    if carve:  # a small Andean step-diamond cut into the stone
        for (dx, dy) in [(0, -3), (-1, -2), (1, -2), (-2, -1), (2, -1), (-3, 0), (3, 0), (-2, 1), (2, 1), (-1, 2), (1, 2), (0, 3)]:
            px[8 + dx, 8 + dy] = GOLD_D + (255,)
        px[8, 8] = GOLD + (255,)
    if under:  # the underside of an overhang: shadowed, with a ragged lip
        for x in range(16):
            lip = 12 + (1 if rnd.random() < 0.4 else 0)
            for yy in range(lip, 16):
                px[x, yy] = (DEEP if yy < 15 else OUTLINE) + (255,)
    return t

def cloud_cap(t, seed, depth=4, tufts=1):
    """Snow on top with a ragged lower edge and the odd drip, and straw tufts poking through it."""
    rnd = random.Random(seed)
    px = t.load()
    edge, e = [], depth
    for x in range(16):
        e = max(depth - 1, min(depth + 2, e + rnd.choice((-1, 0, 0, 1))))
        edge.append(e)
    for x in range(16):
        e = edge[x]
        for y in range(0, e):
            px[x, y] = (SNOW if y < e - 2 else SNOW_S) + (255,)
        px[x, e] = SNOW_D + (255,)
        if rnd.random() < 0.12 and e + 2 < 16: px[x, e + 1] = SNOW_S + (255,)       # a drip
    for _ in range(tufts):
        tx = rnd.randint(3, 12)
        for dx in (-2, -1, 0, 1, 2):
            if abs(dx) == 2 and rnd.random() < 0.5: continue
            x = tx + dx
            h = 5 - abs(dx) * 1 + rnd.randint(0, 1)
            for y in range(max(0, edge[x] - h + 1), edge[x] + 1):
                lean = 1 if (dx > 0 and y < edge[x] - h + 3) else -1 if (dx < 0 and y < edge[x] - h + 3) else 0
                px[max(0, min(15, x + lean)), y] = (GRASS if (y + dx) % 3 else GRASS_D) + (255,)
    return t

def stone_cloud(sheet):
    """The Cloudstair's tile set: top (0) and a second top (6), fill (1) and a second fill (7), carved fill (2),
    ledge (3), cracked stone (5) and underside (8); the ladder (4) is kept."""
    s = sheet.copy()
    ledge = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    slab = cloud_cap(cloud_stone(25, ), 5, depth=3, tufts=0).crop((0, 0, 16, 7))
    ledge.paste(slab, (0, 0))
    lp = ledge.load()
    for x in range(16): lp[x, 7] = OUTLINE + (255,)
    tiles = {0: cloud_cap(cloud_stone(21), 3, tufts=1), 6: cloud_cap(cloud_stone(22), 8, tufts=0), 1: cloud_stone(23), 7: cloud_stone(24), 2: cloud_stone(26, carve=True),
             3: ledge, 5: cloud_stone(27, crack=True), 8: cloud_stone(28, under=True)}
    for i, t in tiles.items():
        s.paste(Image.new('RGBA', (16, 16), (0, 0, 0, 0)), (i * 16, 0))
        s.paste(t, (i * 16, 0))
    return s

def calm_mid_cloud(mid):
    """The Cloudstair's middle layer: no walkway-looking rope bridge at the heroes' height, and pushed back (darker,
    cooler, less saturated) so the stone the heroes stand on is what pops."""
    m = mid.copy().convert('RGBA')
    px = m.load()
    for y in range(166, 228):
        for x in range(272, 394):
            px[x, y] = (0, 0, 0, 0)
    w, h = m.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0: continue
            l = 0.3 * r + 0.59 * g + 0.11 * b
            r, g, b = [int(0.55 * c + 0.45 * l) for c in (r, g, b)]
            px[x, y] = (int(r * 0.72), int(g * 0.74), int(b * 0.84), a)
    return m


# ─── tiles, decor and backdrops for each area ─────────────────────────────
DECOR = {
    'halls': [22, 56, 30, 30, 26, 46, 30, 30],
    'docks': [52, 30, 28, 22, 26, 34, 30, 40],
    'towers': [56, 34, 30, 60, 30, 56, 22, 46],
    'crypt': [36, 64, 22, 30, 24, 26, 30, 26],
    'throne': [60, 30, 40, 52, 22, 28, 34, 18],
    # the Windward Belfry: bell post, banner, prayer cloths, cairn, ichu grass, rope coil, wind chimes, condor head
    'cloud': [56, 60, 24, 22, 22, 20, 48, 30],
    # lantern (lit), cogwheel, bell on a bracket, beam bracket and chain, pulley, crate, louvred window, bell rope coil
    'loft': [30, 48, 26, 40, 34, 20, 56, 44],
    # the Foundry Below: furnace mouth (lit), hanging crucible, anvil, clay bell mould, ingot stack, bellows, crane hook,
    # rack of tongs and ladles
    'cast': [50, 44, 18, 58, 18, 20, 48, 34],
    # red crystals, purple crystals, crystal stalactite, glowing lava boulder, obsidian spire, cave fungus, glassblower's
    # lamp (lit), bottle and pipe rack
    'glass': [30, 26, 40, 22, 56, 18, 34, 32],
    'salt': [22, 34, 28, 25, 19, 44, 43, 24],
    'haul': [22, 34, 28, 25, 19, 44, 43, 24],
    'orchard': [26, 39, 18, 23, 24, 36, 18, 37],
    'rootcellar': [28, 34, 18, 26, 29, 28, 19, 45],
}
for area, hs in DECOR.items():
    if area in ('salt', 'haul', 'orchard', 'rootcellar') and not all(have(f'bs-{part}-{area}') for part in ('tiles', 'decor', 'bg', 'mid')):
        continue
    ts = []
    for c in cells(kload(f'bs-tiles-{area}'), 3, 3):
        sq = cover(c, 1, 1)
        ts.append(sq.resize((64, 64), Image.LANCZOS).resize((16, 16), Image.BOX))
    # one palette for the whole tile set, so neighbouring tiles agree; the ledge, ladder and pillar keep clear parts
    rgba = Image.new('RGBA', (16 * 9, 16))
    for i, t in enumerate(ts):
        rgba.paste(t, (i * 16, 0))
    q = rgba.convert('RGB').quantize(colors=28, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    a = np.asarray(q).copy()
    a[..., 3] = np.where(np.asarray(rgba)[..., 3] > 110, 255, 0)
    sheet = Image.fromarray(a)
    if area == 'cloud': sheet = stone_cloud(sheet)
    sheet.save(OUT / f'tiles-{area}.webp', lossless=True, method=6)
    MANIFEST[f'tiles-{area}'] = (16, 16, 9)
    print(f'tiles-{area:8}  9 x 16x16')
    cs = [bbox(c) for c in cells(kload(f'bs-decor-{area}'), 4, 2)]
    strip(f'decor-{area}', [scaled(c, h / c.height, 20) for c, h in zip(cs, hs)], 72, 68)
    # where the painted flames are in each decor frame (bright warm pixels), so the scene can lay moving flames over
    # them: up to six per frame, as [x0, y0, x1, y1] from the draw point
    sheet = np.asarray(Image.open(OUT / f'decor-{area}.webp').convert('RGBA')).astype(int)
    cw, ch, n = MANIFEST[f'decor-{area}']
    FLAMES[f'decor-{area}'] = []
    for i in range(n):
        c = sheet[:, i * cw:(i + 1) * cw]
        if i not in OPEN_FLAMES.get(area, ()):
            FLAMES[f'decor-{area}'].append([])
            continue
        hot = (c[..., 3] > 0) & (c[..., 0] > 200) & (c[..., 1] > 100) & (c[..., 2] < 150) & (c[..., 0] - c[..., 2] > 80)
        lab, sizes, boxes = label(hot)
        fl = [boxes[j] for j in sorted(range(1, len(sizes)), key=lambda j: -sizes[j]) if sizes[j] >= 3][:6]
        FLAMES[f'decor-{area}'].append([(x0 - cw // 2, y0 - ch, x1 + 1 - cw // 2, y1 + 1 - ch) for y0, x0, y1, x1 in fl])
    opaque(f'bg-{area}', cover(load(f'bs-bg-{area}'), 16, 9), 480, 270, 40)
    mid = key(cover(load(f'bs-mid-{area}'), 16, 9), f'bs-mid-{area}' in GREEN)
    m = pixelate(mid, 480, 270, 24, outline=False, clean=False)
    if area == 'cloud': m = calm_mid_cloud(m)
    if area in ('orchard', 'rootcellar'):
        # Keep foliage and arch edges behind the walkable planes. Leave the key and coverage untouched.
        rgba = np.asarray(m).copy()
        rgb = rgba[..., :3].astype(float)
        value = rgb @ np.array((0.30, 0.59, 0.11))
        muted = rgb * 0.64 + value[..., None] * 0.36
        scales = (0.68, 0.72, 0.84) if area == 'orchard' else (0.76, 0.79, 0.88)
        rgba[..., :3] = (muted * scales).astype(np.uint8)
        m = Image.fromarray(rgba)
    m.save(OUT / f'mid-{area}.webp', lossless=True, method=6)
    MANIFEST[f'mid-{area}'] = (480, 270, 1)
    print(f'mid-{area:10}  1 x 480x270')

# ─── full paintings ───────────────────────────────────────────────────────
# repainted (the "2" versions) so Dora's coat is teal and Enzo grey with a rust coat, as in the game
# (a refined palette: with a plain median cut, the teal coat on the blue night merged into the blue)
for n, src in (('title', 'bs-title2'), ('ending', 'bs-ending2'), ('epilogue', 'bs-epilogue2'),
               ('ending2', 'bs-ending-wb'), ('epilogue2', 'bs-epilogue-wb'), ('ending3', 'bs-ending-fd'),
               ('epilogue3', 'bs-epilogue-fd')):
    opaque(n, cover(load(src), 16, 9), 480, 270, 96, kmeans=4)
if have('bs-ending-salt'):
    opaque('ending4', cover(load('bs-ending-salt'), 16, 9), 480, 270, 72, kmeans=4)
if have('bs-ending-orchard'):
    opaque('ending5', cover(load('bs-ending-orchard'), 16, 9), 480, 270, 72, kmeans=4)
murals = [cover(c, 4, 3) for c in cells(load('bs-murals'), 3, 2)]
# the Windward Belfry's eight (6-13), painted four to a sheet so each panel is near 4:3
murals += [cover(c, 4, 3) for sh in ('bs-murals-wb', 'bs-murals-wb2') for c in cells(load(sh), 2, 2)]
# the Foundry Below's six (14-19)
murals += [cover(c, 4, 3) for c in cells(load('bs-murals-fd'), 3, 2)]
if have('bs-murals-orchard'):
    murals += [cover(c, 4, 3) for c in cells(load('bs-murals-orchard'), 2, 2)]
ms = []
for c in murals:
    small = c.convert('RGB').resize((640, 480), Image.LANCZOS).resize((160, 120), Image.BOX)
    ms.append(small.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA'))
strip('murals', ms, 160, 120, anchor='middle')
# the Foundry Below's special terrain (12 tiles, one palette): molten bronze surface x2, molten fill, cooled crust,
# cracking crust, vent grate, mist-hardened stone, bounce plate, cracked glass, crystal bridge, beam door, lava surface
ts = [cover(c, 1, 1).resize((64, 64), Image.LANCZOS).resize((16, 16), Image.BOX) for c in cells(kload('bs-tiles-fd'), 4, 3)]
rgba = Image.new('RGBA', (16 * 12, 16))
for i, t in enumerate(ts):
    rgba.paste(t, (i * 16, 0))
q = rgba.convert('RGB').quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
a = np.asarray(q).copy()
a[..., 3] = np.where(np.asarray(rgba)[..., 3] > 110, 255, 0)
Image.fromarray(a).save(OUT / 'tiles-fd.webp', lossless=True, method=6)
MANIFEST['tiles-fd'] = (16, 16, 12)
print('tiles-fd       12 x 16x16')
p = load('bs-parchment').convert('RGB').resize((256, 256), Image.LANCZOS).resize((128, 128), Image.BOX)
p.quantize(colors=20, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'parchment.webp', lossless=True, method=6)
MANIFEST['parchment'] = (128, 128, 1)

# ─── the manifest ─────────────────────────────────────────────────────────
lines = ['// Generated by scripts/bellspire-art.py: each art strip\'s cell width, cell height and frame count.',
         'export const ART: Record<string, [number, number, number]> = {']
for k, (w, h, n) in MANIFEST.items():
    lines.append(f"  '{k}': [{w}, {h}, {n}],")
lines.append('};')
lines += ['', '// Painted bounds of every frame, [x0, y0, x1, y1] from the draw point (the cell\'s bottom middle; y is up-negative),',
          '// for sprites whose hitboxes come from the art. The art faces the way it was painted; mirror x when flipped.',
          'export const BOXES: Record<string, [number, number, number, number][]> = {']
for k in ('foes', 'dora', 'enzo', 'boss-frog', 'boss-puma', 'boss-mother', 'boss-warden', 'hydra-head',
          'boss-condor', 'boss-clapper-a', 'boss-clapper-b', 'boss-bell', 'dora-windward', 'enzo-highland',
          'dora-forge', 'enzo-ash', 'boss-founder', 'boss-hollow', 'boss-hollowb', 'boss-choir',
          'dora-salt', 'enzo-salt', 'boss-weighmaster', 'boss-panback', 'boss-tollkeeper',
          'dora-orchard', 'enzo-orchard', 'boss-bracken-stag', 'boss-rootback', 'boss-graft-mother'):
    if k in BOXES:
        lines.append(f"  '{k}': [" + ', '.join(f'[{a}, {b}, {c}, {d}]' for a, b, c, d in BOXES[k]) + '],')
lines.append('};')
lines += ['', '// Painted flames in each decor frame, [x0, y0, x1, y1] from the draw point, for the flicker overlay.',
          'export const FLAMES: Record<string, [number, number, number, number][][]> = {']
for k, v in FLAMES.items():
    lines.append(f"  '{k}': [" + ', '.join('[' + ', '.join(f'[{a}, {b}, {c}, {d}]' for a, b, c, d in fr) + ']' for fr in v) + '],')
lines.append('};')
lines += ['', '// For each foe kind, the frames that show its body (idle and moving, not the reach of an attack): the first is',
          '// the one its hitbox is taken from.', 'export const FOE_BODY: Record<string, number[]> = {']
for k, v in FOE_BODY.items():
    prop = k if k.isidentifier() else repr(k)
    lines.append(f"  {prop}: [{', '.join(map(str, v))}],")
lines.append('};')
(ROOT / 'lib' / 'bellspire-art.ts').write_text('\n'.join(lines) + '\n')
total = sum(f.stat().st_size for f in OUT.glob('*.webp'))
print(f'total {total / 1e6:.2f} MB in {OUT}')
