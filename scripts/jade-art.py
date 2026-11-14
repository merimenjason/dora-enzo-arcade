"""Jade Street art pipeline: python3 scripts/jade-art.py <folder of Codex paintings>
Keys every Codex sheet (flat magenta, or green for the neon buildings), pulls the magenta cast out of grey fur and
purple jackets, nudges Dora's fur back to cream-white, cuts each grid by cell (biggest blob per cell, cropped tight),
scales each sheet to its in-game size (2 atlas px per world unit), packs WebP atlases into public/art/jade-street/,
makes the ground paintings into seamless tiling textures, saves the mini-game scenes and title as plain WebP, and
writes lib/jade-art.ts. The prompts and the Codex runner are in docs/jade-street-art/.
"""
import sys, colorsys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art-src')
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'
OUT.mkdir(parents=True, exist_ok=True)
PX = 2.0  # atlas px per world unit

def key(im, green=False, lo=70, hi=180):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green: m = g - np.maximum(r, b); M = np.array([0, 255, 0], np.float32)
    else: m = np.minimum(r, b) - g; M = np.array([255, 0, 255], np.float32)
    al = np.clip(1 - (m - lo) / (hi - lo), 0, 1)
    k = al > 0.03
    f = (a - (1 - al[..., None]) * M) / np.maximum(al[..., None], 0.03)
    out = np.zeros(a.shape[:2] + (4,), np.float32)
    out[..., :3] = np.clip(np.where(k[..., None], f, 0), 0, 255); out[..., 3] = al * 255; out[~k] = 0
    rgb = out[..., :3]
    if green:
        sp = np.clip(rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]), 0, None); rgb[..., 1] -= sp * (1 - al)
    else:
        # despill only the soft edge and grey-ish pixels (fur), never saturated purples inside the figure
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None)
        grey = np.clip(1 - (np.max(rgb, -1) - np.min(rgb, -1)) / 90, 0, 1)
        w = np.maximum(1 - al, grey * 0.8)
        rgb[..., 0] -= sp * w; rgb[..., 2] -= sp * w
    out[out[..., 3] < 25] = 0
    return out.astype(np.uint8)

def cream(arr):
    """Dora is cream-white: pull the yellow out of light warm fur (not the pink ears, not the jade jacket)"""
    a = arr.astype(np.float32); rgb = a[..., :3] / 255
    mx = rgb.max(-1); mn = rgb.min(-1); s = (mx - mn) / np.maximum(mx, 1e-3)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    warm = (r >= g) & (g >= b) & (mx > 0.55) & (s < 0.5) & (r - g < 0.16)
    lum = (r * 0.3 + g * 0.59 + b * 0.11)
    for c, t in ((0, 1.0), (1, 0.97), (2, 0.9)):
        rgb[..., c] = np.where(warm, rgb[..., c] * 0.45 + np.clip(lum * t * 1.06, 0, 1) * 0.55, rgb[..., c])
    a[..., :3] = rgb * 255
    return np.clip(a, 0, 255).astype(np.uint8)

def label(q):
    h, w = q.shape; lab = np.zeros((h, w), np.int32); n = 0; info = []
    for y0 in range(h):
        for x0 in range(w):
            if not q[y0, x0] or lab[y0, x0]: continue
            n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0
            while st:
                y, x = st.pop(); c += 1
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
            info.append((c, n))
    return lab, info

def biggest(sub, keep_frac=0.04):
    q = sub[::4, ::4, 3] > 30
    lab, info = label(q)
    if not info: return sub
    mx = max(i[0] for i in info)
    km = np.isin(lab, [i[1] for i in info if i[0] >= mx * keep_frac])
    p = np.pad(km, 3); d = np.zeros_like(p)
    for dy in range(-3, 4):
        for dx in range(-3, 4): d |= np.roll(np.roll(p, dy, 0), dx, 1)
    mask = d[3:-3, 3:-3].repeat(4, 0).repeat(4, 1)[:sub.shape[0], :sub.shape[1]]
    sub = sub.copy(); sub[~mask] = 0; return sub

def crop(sub):
    ys, xs = np.where(sub[..., 3] > 20)
    if len(ys) == 0: return None
    return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

FRAMES = {}
MISSING = []
def cells(file, gx, gy, green=False, lo=70, clean=True, fix=None):
    p = SRC / f'{file}.png'
    if not p.exists(): MISSING.append(file); return [None] * (gx * gy)
    arr = key(Image.open(p), green, lo=lo)
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        for i in range(gx):
            sub = arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx]
            if clean: sub = biggest(sub)
            out.append(crop(sub))
    return out

def put(n, c, k):
    im = Image.fromarray(c)
    FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

def grid(file, names, gx, gy, world, ref=None, dim='h', **kw):
    """one scale per sheet: the ref frame (default the first) is `world` units tall (or wide with dim='w')"""
    cs = cells(file, gx, gy, **kw)
    named = {n: c for n, c in zip(names, cs) if n and c is not None}
    for n, c in zip(names, cs):
        if n and c is None and (SRC / f'{file}.png').exists(): print('!! empty', file, n)
    if not named: return
    r = named[ref or names[0]]
    k = world * PX / (r.shape[0] if dim == 'h' else r.shape[1])
    for n, c in named.items(): put(n, c, k)

def fit(file, names, gx, gy, size, **kw):
    """each item scaled so its longer side is `size` atlas px"""
    for n, c in zip(names, cells(file, gx, gy, **kw)):
        if not n or c is None: continue
        put(n, c, size / max(c.shape[:2]))

def each(file, names, gx, gy, sizes, dim='w', **kw):
    """each item scaled to its own world size (width by default)"""
    for n, c in zip(names, cells(file, gx, gy, **kw)):
        if not n or c is None: continue
        s = sizes[n] if isinstance(sizes, dict) else sizes
        put(n, c, s * PX / (c.shape[1] if dim == 'w' else c.shape[0]))

def square(file, names, gx, gy, sizes, **kw):
    """buildings: stretched to exactly fill their square footprint"""
    for n, c in zip(names, cells(file, gx, gy, **kw)):
        if not n or c is None: continue
        s = round(sizes[n] * PX) if isinstance(sizes, dict) else round(sizes * PX)
        FRAMES[n] = Image.fromarray(c).resize((s, s), Image.LANCZOS)

# ── heroes (3/4 view: walk, run, actions) and riding (top-down)
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    dirs = ['down', 'up', 'side']
    grid(f'{h}-walk', [f'{h}-walk-{d}-{i}' for d in dirs for i in range(4)], 4, 3, 58, fix=fx)
    grid(f'{h}-run', [f'{h}-run-{d}-{i}' for d in dirs for i in range(4)], 4, 3, 56, fix=fx)
    grid(f'{h}-act', [f'{h}-idle-down', f'{h}-idle-up', f'{h}-idle-side', f'{h}-bump', f'{h}-dash-down', f'{h}-dash-up', f'{h}-dash-side', f'{h}-hop-down', f'{h}-hop-up', f'{h}-hop-side', f'{h}-pickup', f'{h}-hide'], 4, 3, 58, fix=fx)
    grid(f'{h}-act2', [f'{h}-cheer-0', f'{h}-cheer-1', f'{h}-caught-0', f'{h}-caught-1', f'{h}-climb-on', f'{h}-climb-off', f'{h}-wave', f'{h}-talk', f'{h}-swap', f'{h}-carry-down', f'{h}-carry-side', f'{h}-sneak'], 4, 3, 58, ref=f'{h}-wave', fix=fx)
    grid(f'{h}-act3', [f'{h}-paint-0', f'{h}-paint-1', f'{h}-pick-0', f'{h}-pick-1', f'{h}-barge-side', f'{h}-barge-down', f'{h}-door', f'{h}-sleep', f'{h}-wok', f'{h}-fold', f'{h}-map', f'{h}-thumbs'], 4, 3, 58, ref=f'{h}-thumbs', fix=fx)
    grid(f'{h}-ride', [f'{h}-ride-scooter-0', f'{h}-ride-scooter-1', f'{h}-ride-pedal-0', f'{h}-ride-pedal-1', f'{h}-ride-pole-0', f'{h}-ride-pole-1', f'{h}-ride-cheer', f'{h}-ride-bump'], 4, 2, 46, fix=fx)
fit('heroes-face', ['face-dora', 'face-enzo', 'face-dora-2', 'face-enzo-2'], 2, 2, 256, fix=None)
# ── rides (top-down, facing up)
each('vehicles', ['v-scooter', 'v-trishaw', 'v-tuktuk', 'v-van', 'v-boat', 'v-cart', 'v-bike', 'v-skiff'], 4, 2,
     {'v-scooter': 62, 'v-trishaw': 80, 'v-tuktuk': 74, 'v-van': 96, 'v-boat': 104, 'v-cart': 78, 'v-bike': 52, 'v-skiff': 70}, dim='h')
each('riders', ['mag-cart-0', 'mag-cart-1', 'warden-bike-a', 'warden-bike-b', 'boss-0', 'boss-1', 'mag-boat-0', 'mag-boat-1'], 4, 2,
     {'mag-cart-0': 80, 'mag-cart-1': 80, 'warden-bike-a': 60, 'warden-bike-b': 60, 'boss-0': 70, 'boss-1': 70, 'mag-boat-0': 96, 'mag-boat-1': 96}, dim='h', lo=95)
each('traffic', ['car-mint', 'car-cream', 'car-van', 'car-taxi', 'car-bus', 'car-purple', 'car-fruit', 'car-moto'], 4, 2,
     {'car-mint': 80, 'car-cream': 80, 'car-van': 88, 'car-taxi': 80, 'car-bus': 112, 'car-purple': 76, 'car-fruit': 92, 'car-moto': 52}, dim='h', lo=95)
# ── rivals, wardens, townsfolk
grid('magpies', ['mag-walk-down-0', 'mag-walk-down-1', 'mag-walk-up-0', 'mag-walk-up-1', 'mag-run-0', 'mag-run-1', 'mag-look-0', 'mag-look-1', 'mag-taunt', 'mag-dizzy', 'mag-fly-0', 'mag-fly-1'], 4, 3, 54, lo=95)
FRAMES['mag-fly-0'] = FRAMES['mag-fly-0'].resize((140, round(FRAMES['mag-fly-0'].height * 140 / FRAMES['mag-fly-0'].width)), Image.LANCZOS) if 'mag-fly-0' in FRAMES else None
FRAMES['mag-fly-1'] = FRAMES['mag-fly-1'].resize((120, round(FRAMES['mag-fly-1'].height * 120 / FRAMES['mag-fly-1'].width)), Image.LANCZOS) if 'mag-fly-1' in FRAMES else None
FRAMES = {k: v for k, v in FRAMES.items() if v is not None}
grid('wardens', ['warden-down-0', 'warden-down-1', 'warden-side-0', 'warden-side-1', 'warden-whistle', 'warden-gotcha', 'warden-pant', 'warden-point'], 4, 3, 62)
each('wardens', [None] * 8 + ['blimp', 'block-oranges', 'block-melons', 'cone'], 4, 3, {'blimp': 170, 'block-oranges': 104, 'block-melons': 104, 'cone': 30})
for f, sp in (('folk1', ['rabbit', 'dog', 'squirrel']), ('folk2', ['cat', 'duck', 'hedgehog'])):
    grid(f, [f'folk-{s}-{k}' for s in sp for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
fit('portraits', ['face-kee', 'face-pang', 'face-mo', 'face-heron', 'face-kiri', 'face-bo', 'face-gizmo', 'face-ren', 'face-glint', 'face-pip', 'face-bristle', 'face-lim', None, None, None, None], 4, 4, 256, lo=95)
# ── the city: buildings stretched to their footprints (3×3 tiles = 192 world units)
square('shops1', ['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6'], 3, 2, 192)
square('roofs', ['roof-1', 'roof-2', 'roof-3', 'roof-4', 'roof-5', 'roof-6'], 3, 2, 192)
square('flatroofs', ['flat-1', 'flat-2', 'flat-3', 'flat-4', 'flat-5', 'flat-6'], 3, 2, 192)
square('buildings2', ['bld-canal', 'bld-tea', 'bld-hill', 'bld-office', 'bld-noodle', 'bld-karaoke'], 3, 2, 192, green=True)
square('landmarks', ['lm-temple', 'lm-pagoda', 'lm-warehouse', 'lm-arcade', 'lm-safe', 'lm-garage'], 3, 2, {'lm-temple': 384, 'lm-pagoda': 256, 'lm-warehouse': 384, 'lm-arcade': 384, 'lm-safe': 192, 'lm-garage': 192}, green=True)
each('decals', ['d-zebra', 'd-dash', 'd-manhole', 'd-grate', 'd-kerb', 'd-puddle-red', 'd-puddle-gold', 'd-petals', 'd-stairs', 'd-bridge-stone', 'd-bridge-wood', 'lucky-circle'], 4, 3,
     {'d-zebra': 128, 'd-dash': 40, 'd-manhole': 44, 'd-grate': 40, 'd-kerb': 128, 'd-puddle-red': 60, 'd-puddle-gold': 56, 'd-petals': 50, 'd-stairs': 256, 'd-bridge-stone': 340, 'd-bridge-wood': 270, 'lucky-circle': 120})
each('props1', ['stall-red', 'stall-noodle', 'stall-fruit', 'stall-tea', 'lamp', 'plants', 'crates', 'bench', 'tree-round', 'tree-frangipani', 'palm', 'lion-statue'], 4, 3,
     {'stall-red': 134, 'stall-noodle': 134, 'stall-fruit': 134, 'stall-tea': 134, 'lamp': 34, 'plants': 64, 'crates': 64, 'bench': 60, 'tree-round': 112, 'tree-frangipani': 112, 'palm': 110, 'lion-statue': 46})
each('props2', ['lucky-cat', 'mural-faded', 'mural-fresh', 'curtain', 'h-dragon', 'h-bell', 'h-lantern', 'h-koi', 'h-drum', 'loot-sack', 'cake', 'pots', 'lion-0', 'lion-1', 'coins', 'basket'], 4, 4,
     {'lucky-cat': 30, 'mural-faded': 92, 'mural-fresh': 92, 'curtain': 64, 'h-dragon': 44, 'h-bell': 40, 'h-lantern': 38, 'h-koi': 44, 'h-drum': 44, 'loot-sack': 32, 'cake': 40, 'pots': 34, 'lion-0': 120, 'lion-1': 120, 'coins': 30, 'basket': 52})
each('props3', ['lanterns-red', 'lanterns-gold', 'crane', 'containers', 'scaffold', 'claw', 'kiosk', 'urn', 'sampan', 'bollard', 'vending', 'shrine'], 4, 3,
     {'lanterns-red': 280, 'lanterns-gold': 280, 'crane': 150, 'containers': 128, 'scaffold': 80, 'claw': 48, 'kiosk': 70, 'urn': 44, 'sampan': 80, 'bollard': 28, 'vending': 44, 'shrine': 60})
each('ladders', ['ladder', 'fire-ladder', 'plank', 'rope', 'gate', 'flag', 'lantern-ground', 'rice'], 4, 2,
     {'ladder': 40, 'fire-ladder': 40, 'plank': 64, 'rope': 30, 'gate': 90, 'flag': 40, 'lantern-ground': 30, 'rice': 30})
# hedges: the park edge uses the potted-plant painting
if 'plants' in FRAMES: FRAMES['hedge'] = FRAMES['plants'].resize((128, round(FRAMES['plants'].height * 128 / FRAMES['plants'].width)), Image.LANCZOS)
if 'containers' in FRAMES: FRAMES['containers-v'] = FRAMES['containers']
# ── UI and icons
fit('ui', ['ui-plaque-jade', 'ui-plaque-red', 'ui-btn-red', 'ui-btn-jade', 'ui-lantern-on', 'ui-lantern-off', 'ui-coin', 'ui-star', 'ui-ring', 'ui-arrow', 'ui-pin', 'ui-lock'], 4, 3, 256)
fit('icons', ['i-jade', 'i-mooncake', 'i-tea', 'i-bowl', 'i-fan', 'i-mango', 'i-safe', 'i-garage', 'i-key', 'i-jacket', 'i-trophy', 'i-map', 'i-lock', 'i-wok', 'i-dumpling', 'i-wires'], 4, 4, 128)
# ── mini-game parts
each('mg-parts', ['mg-pin', 'mg-pin-glow', 'mg-pick', 'mg-wrench', 'mg-plug-red', 'mg-plug-blue', 'mg-plug-yellow', 'mg-plug-green', 'mg-spark', 'mg-key', 'mg-lock-open', 'mg-lock-shut'], 4, 3,
     {'mg-pin': 30, 'mg-pin-glow': 30, 'mg-pick': 200, 'mg-wrench': 80, 'mg-plug-red': 60, 'mg-plug-blue': 60, 'mg-plug-yellow': 60, 'mg-plug-green': 60, 'mg-spark': 70, 'mg-key': 60, 'mg-lock-open': 80, 'mg-lock-shut': 80})
each('mg-food', ['mg-wok', 'mg-noodles', 'mg-prawn', 'mg-bokchoy', 'mg-chilli', 'mg-egg', 'mg-wrapper', 'mg-filled', 'mg-half', 'mg-dumpling', 'mg-messy', 'mg-steamer'], 4, 3,
     {'mg-wok': 220, 'mg-noodles': 60, 'mg-prawn': 52, 'mg-bokchoy': 52, 'mg-chilli': 48, 'mg-egg': 52, 'mg-wrapper': 120, 'mg-filled': 120, 'mg-half': 110, 'mg-dumpling': 100, 'mg-messy': 100, 'mg-steamer': 150})

# ── seamless ground textures: crop each square, then blend it with its half-offset copy so the edges wrap
TEX = {}
def seamless(arr):
    h, w = arr.shape[:2]
    rolled = np.roll(np.roll(arr, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.minimum(np.minimum(xx, w - 1 - xx) / (w * 0.5), np.minimum(yy, h - 1 - yy) / (h * 0.5))
    m = np.clip(m * 2.2, 0, 1)[..., None]
    return (arr * m + rolled * (1 - m)).astype(np.uint8)
for f, names in (('ground', ['road', 'walk', 'plaza', 'grass', 'canal', 'plank']), ('ground2', ['temple', 'sea', 'dock', 'neon', 'path', 'cobble'])):
    p = SRC / f'{f}.png'
    if not p.exists(): MISSING.append(f); continue
    a = np.asarray(Image.open(p).convert('RGB'))
    H, W = a.shape[:2]
    for k, n in enumerate(names):
        i, j = k % 3, k // 3
        x0, x1 = W * i // 3, W * (i + 1) // 3; y0, y1 = H * j // 2, H * (j + 1) // 2
        cell = a[y0:y1, x0:x1].astype(np.float32)
        # trim the black gaps: keep the bright interior
        lum = cell.mean(-1); rows = np.where(lum.mean(1) > 18)[0]; cols = np.where(lum.mean(0) > 18)[0]
        cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
        s = min(cell.shape[:2]); cell = cell[:s, :s]
        im = Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS)
        im.save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6); TEX[n] = 256

# ── full paintings
PLAIN = {}
for n, size in (('title', (1536, 1024)), ('mg-lock', (1280, 853)), ('mg-wire', (1280, 853)), ('mg-wok', (1280, 853)), ('mg-board', (1280, 853)), ('mg-haggle', (1280, 853))):
    p = SRC / f'{n}.png'
    if not p.exists(): MISSING.append(n); continue
    im = Image.open(p).convert('RGB').resize(size, Image.LANCZOS)
    im.save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PLAIN['bg-' + n] = size

# the minimap frame: the painted ring with its jade centre cut away
if 'ui-ring' in FRAMES:
    import numpy as _np
    r = _np.array(FRAMES['ui-ring']).copy(); hh, ww = r.shape[:2]
    yy, xx = _np.mgrid[0:hh, 0:ww]; rad = _np.hypot(xx - ww / 2, yy - hh / 2)
    r[rad < min(ww, hh) * 0.40, 3] = 0
    FRAMES['ui-ring-hollow'] = Image.fromarray(r)

# ── stand-alone UI pieces for CSS border-image (plaques and round buttons stretch with their painted ends intact)
for n in ('ui-plaque-jade', 'ui-plaque-red', 'ui-btn-jade', 'ui-btn-red', 'ui-ring'):
    if n in FRAMES: FRAMES[n].save(OUT / f'{n}.webp', 'WEBP', quality=88, method=6)

# ── atlases
GROUPS = [('dora', lambda n: n.startswith('dora-')), ('enzo', lambda n: n.startswith('enzo-')),
          ('city', lambda n: n.startswith(('shop-', 'roof-', 'flat-', 'bld-', 'lm-'))),
          ('rides', lambda n: n.startswith(('v-', 'car-', 'mag-cart', 'mag-boat', 'boss-', 'warden-bike'))),
          ('folk', lambda n: n.startswith(('folk-', 'mag-', 'warden-', 'blimp', 'block-', 'cone', 'face-'))),
          ('props', lambda n: True)]
meta = {}; assigned = {}; SIZES = {}
for n in FRAMES:
    for gi, (g, f) in enumerate(GROUPS):
        if f(n): assigned[n] = gi; break
for gi, (g, _) in enumerate(GROUPS):
    names = sorted([n for n in FRAMES if assigned[n] == gi], key=lambda n: (-FRAMES[n].height, n))
    MAXW = 2048; x = y = rowh = 0; place = {}
    for n in names:
        im = FRAMES[n]
        if x + im.width + 2 > MAXW: x = 0; y += rowh + 2; rowh = 0
        place[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (MAXW, max(1, y + rowh)), (0, 0, 0, 0))
    for n in names: atlas.paste(FRAMES[n], place[n])
    atlas.save(OUT / f'atlas-{g}.webp', 'WEBP', quality=86, method=6); SIZES[g] = atlas.size
    for n in names: meta[n] = [gi, place[n][0], place[n][1], FRAMES[n].width, FRAMES[n].height]
    print(g, len(names), atlas.size, (OUT / f'atlas-{g}.webp').stat().st_size // 1024, 'KB')

lines = ['// Generated by scripts/jade-art.py from the Codex paintings; do not edit by hand.',
         '// FRAMES: name -> [atlas, x, y, w, h] in atlas pixels (2 px per world unit). TEXTURES: seamless 256 px ground tiles.',
         'export const ATLASES = [' + ', '.join(f"'atlas-{g}'" for g, _ in GROUPS) + '] as const;',
         'export const ATLAS_SIZE: Record<string, [number, number]> = {' + ', '.join(f"'atlas-{g}': [{w}, {h}]" for g, (w, h) in SIZES.items()) + '};',
         'export const FRAMES: Record<string, [number, number, number, number, number]> = {']
lines += [f"  '{n}': [{', '.join(map(str, meta[n]))}]," for n in sorted(meta)]
# how much of each frame is painted (share of pixels that are not see-through): the tests check none is blank
import numpy as _np2
fill = {n: round(float((_np2.array(FRAMES[n].convert('RGBA'))[:, :, 3] > 24).mean()), 3) for n in meta}
lines += ['};', '/** share of each frame\'s pixels that are painted (not transparent) */', 'export const FILL: Record<string, number> = {']
lines += [f"  '{n}': {fill[n]}," for n in sorted(fill)]
lines += ['};', 'export const TEXTURES = [' + ', '.join(f"'{n}'" for n in TEX) + '] as const;',
          'export const PLAIN: Record<string, [number, number]> = {' + ', '.join(f"'{n}': [{w}, {h}]" for n, (w, h) in PLAIN.items()) + '};']
TS.write_text('\n'.join(lines) + '\n')
print(len(meta), 'frames;', len(TEX), 'textures;', 'missing:', MISSING)
