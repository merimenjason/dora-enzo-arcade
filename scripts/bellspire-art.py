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
OPEN_FLAMES = {'halls': (6, 0), 'towers': (4, 6), 'crypt': (6, 2)}
FLAMES = {}  # decor sheet: per frame, the painted flames' boxes
FOE_BODY = {}  # foe kind: the frame whose bounds are its body
INK = (34, 24, 32)


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


def hero_colours(im, hero):
    """Tell the heroes apart at a glance: Dora warm cream-white with a teal coat, Enzo mid-grey with a rust coat. The
    painted fur is remapped onto a fixed ramp, the coats are pushed to their hue, and the pink inner ears are toned
    down so they don't dominate a small sprite. The magenta ground is left alone for the keyer."""
    a = np.asarray(im.convert('RGBA')).astype(np.float32).copy()
    rgb = a[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    ground = (np.minimum(r, b) - g > 60) & (r > 140) & (b > 140)
    h, sat, v = _hsv(rgb)
    lum = (0.3 * r + 0.55 * g + 0.15 * b) / 255
    pinkish = ((h > 320) | (h < 15)) & (sat > 0.22) & (sat < 0.62) & (v > 0.72) & ~ground
    if hero == 'enzo':
        fur = (sat < 0.34) & (np.minimum(r, b) >= g - 6) & (v > 0.18) & ~ground
        rgb[fur] = _ramp(np.clip(lum[fur] * 1.05, 0, 1), [(0, (34, 36, 42)), (0.35, (88, 92, 102)), (0.6, (138, 143, 153)), (0.8, (169, 173, 181)), (1, (214, 217, 223))])
        coat = ((h > 330) | (h < 25)) & (sat >= 0.45) & (v < 0.85) & ~ground
        nh = np.full(h.shape, 16.0)
        rgb[coat] = _rgb(nh[coat], np.clip(sat[coat] * 0.92, 0, 1), v[coat] * 0.95)
    else:
        fur = (sat < 0.3) & (r >= b) & (v > 0.55) & ~ground & ~pinkish
        rgb[fur] = _ramp(np.clip(lum[fur], 0, 1), [(0.4, (150, 124, 104)), (0.65, (214, 192, 164)), (0.85, (244, 232, 210)), (1, (255, 250, 238))])
        coat = (h > 150) & (h < 250) & (sat > 0.2) & ~ground
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


def _big_parts(m, min_cells, step=4):
    """keep the connected pieces of a mask that are at least `min_cells` cells big (labelled at 1/step size)"""
    q = m[::step, ::step]
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
            if len(cells) >= min_cells:
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


def strip(name, frames, cw, ch, anchor='foot', note='', parts=None):
    """pack frames into one strip of (cw, ch) cells; each frame's foot sits at the cell's bottom middle. With `parts`
    (a part map per frame), also write <name>-parts.webp: the part number times 80 in red, opaque where there is one"""
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
            sl[..., 3] = np.where(pm > 0, 255, 0)
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
for hero in ('dora', 'enzo'):
    src = lambda n: hero_colours(load(n), hero)
    # a, b: the first 16 frames; c to h, the animation pass (climb and land, run, idle and interactions, attacks,
    # body, water); i, j: every state its own poses (run start-up, Whirl Slash, Enzo's combo, bell strikes, wading,
    # treading). 8 each, in the order of the HERO_FRAMES comment in lib/bellspire-anim.ts
    # (the new sheets' long staffs and swords can reach into the next cell, so stray pieces at a cell's side go)
    figs = [bbox(drop_neighbours(c) if sh in 'ij' else c) for sh in 'abcdefghij' for c in cells(key(src(f'bs-{hero}-{sh}')), 4, 2)]
    s = 38 / figs[0].height  # the idle pose stands 38 pixels tall; every sheet was painted at the same size
    PARTS.clear()
    if hero == 'dora':
        frames = [scaled(f, s, 20, parts=hero_parts(f, hero)) for f in figs]
        parts = [teal_trim(f, pm) for f, pm in zip(frames, PARTS)]
    else:
        frames = [scaled(f, s, 20) for f in figs]
        parts = [enzo_parts(f) for f in frames]
    strip(hero, frames, 56, 44, parts=parts)

# ─── enemies: frame A on top, frame B below ───────────────────────────────
FOE_H = {'frog': 20, 'moth': 15, 'eel': 18, 'reed': 30, 'condor': 30, 'imp': 19, 'shell': 30, 'vizcacha': 18,
         'jelly': 19, 'golem': 38}
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
for k, n in enumerate(FOE_H):
    cs = [bbox(c) for c in cells(key(load(f'bs-foe-{n}')), 4, 2)]
    s = FOE_H[n] / cs[0].height
    FOE_BODY[n] = [len(foes) + j for j in range(6)]
    foes += [scaled(c, s, 18) for c in cs]
strip('foes', foes, 64, 48)

# ─── bosses ───────────────────────────────────────────────────────────────
def boss(name, sheet, height, cw, ch):
    """frames 0-2: rest, wind-up, attack; 3-5 (the animation pass): a second wind-up, stagger, calmed"""
    cs = figures(key(load(sheet)), 3)
    s = height / cs[0].height
    more = figures(key(load(sheet + '2')), 3)
    strip(name, [scaled(c, s, 32) for c in cs + more], cw, ch)


boss('boss-frog', 'bs-boss-frog', 74, 150, 96)
boss('boss-puma', 'bs-boss-puma', 60, 170, 92)
boss('boss-mother', 'bs-boss-mother', 120, 280, 150)

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
strip('flames', [scaled(c, 18 / c.height, 12, outline=False) for c in wd[0:3]] + [scaled(c, 8 / c.height, 8, outline=False) for c in wd[4:7]], 16, 20)
cs = [bbox(c) for c in cells(key(load('bs-npcs')), 4, 2)]
NPCS = [44, 44, 50, 50, 12, 16, 10, 16]  # wayra x2, ukumari x2, wisp, ghost-glass, coins, ability orb
npc = [scaled(c, h / c.height, 24, outline=(i != 5)) for i, (c, h) in enumerate(zip(cs, NPCS))]
strip('npcs', npc, 72, 56)

# ─── icons and portraits ──────────────────────────────────────────────────
icons = []
for sheet in ('bs-icons-a', 'bs-icons-b'):
    for c in cells(key(load(sheet)), 4, 4):
        f = bbox(c)
        s = 20 / max(f.width, f.height)
        icons.append(scaled(f, s, 16))
strip('icons', icons, 24, 24, anchor='middle')
ports = []
for i, c in enumerate(cells(load('bs-portraits'), 3, 2)):
    f = bbox(key(hero_colours(c, 'enzo') if i == 1 else hero_colours(c, 'dora') if i in (0, 5) else c))  # Enzo is second; Dora first and last
    s = 60 / max(f.width, f.height)
    ports.append(scaled(f, s, 32))
strip('portraits', ports, 64, 64, anchor='middle')

# ─── tiles, decor and backdrops for each area ─────────────────────────────
DECOR = {
    'halls': [22, 56, 30, 30, 26, 46, 30, 30],
    'docks': [52, 30, 28, 22, 26, 34, 30, 40],
    'towers': [56, 34, 30, 60, 30, 56, 22, 46],
    'crypt': [36, 64, 22, 30, 24, 26, 30, 26],
    'throne': [60, 30, 40, 52, 22, 28, 34, 18],
}
for area, hs in DECOR.items():
    ts = []
    for c in cells(key(load(f'bs-tiles-{area}')), 3, 3):
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
    sheet.save(OUT / f'tiles-{area}.webp', lossless=True, method=6)
    MANIFEST[f'tiles-{area}'] = (16, 16, 9)
    print(f'tiles-{area:8}  9 x 16x16')
    cs = [bbox(c) for c in cells(key(load(f'bs-decor-{area}')), 4, 2)]
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
    mid = key(cover(load(f'bs-mid-{area}'), 16, 9))
    m = pixelate(mid, 480, 270, 24, outline=False, clean=False)
    m.save(OUT / f'mid-{area}.webp', lossless=True, method=6)
    MANIFEST[f'mid-{area}'] = (480, 270, 1)
    print(f'mid-{area:10}  1 x 480x270')

# ─── full paintings ───────────────────────────────────────────────────────
# repainted (the "2" versions) so Dora's coat is teal and Enzo grey with a rust coat, as in the game
# (a refined palette: with a plain median cut, the teal coat on the blue night merged into the blue)
for n, src in (('title', 'bs-title2'), ('ending', 'bs-ending2'), ('epilogue', 'bs-epilogue2')):
    opaque(n, cover(load(src), 16, 9), 480, 270, 96, kmeans=4)
murals = [cover(c, 4, 3) for c in cells(load('bs-murals'), 3, 2)]
ms = []
for c in murals:
    small = c.convert('RGB').resize((640, 480), Image.LANCZOS).resize((160, 120), Image.BOX)
    ms.append(small.quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA'))
strip('murals', ms, 160, 120, anchor='middle')
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
for k in ('foes', 'dora', 'enzo', 'boss-frog', 'boss-puma', 'boss-mother', 'boss-warden', 'hydra-head'):
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
    lines.append(f"  {k}: [{', '.join(map(str, v))}],")
lines.append('};')
(ROOT / 'lib' / 'bellspire-art.ts').write_text('\n'.join(lines) + '\n')
total = sum(f.stat().st_size for f in OUT.glob('*.webp'))
print(f'total {total / 1e6:.2f} MB in {OUT}')
