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
each('riders', ['crow-cart-0', 'crow-cart-1', 'warden-bike-a', 'warden-bike-b', 'boss-0', 'boss-1', 'crow-boat-0', 'crow-boat-1'], 4, 2,
     {'crow-cart-0': 80, 'crow-cart-1': 80, 'warden-bike-a': 60, 'warden-bike-b': 60, 'boss-0': 70, 'boss-1': 70, 'crow-boat-0': 96, 'crow-boat-1': 96}, dim='h', lo=95)
each('traffic', ['car-mint', 'car-cream', 'car-van', 'car-taxi', 'car-bus', 'car-purple', 'car-fruit', 'car-moto'], 4, 2,
     {'car-mint': 80, 'car-cream': 80, 'car-van': 88, 'car-taxi': 80, 'car-bus': 112, 'car-purple': 76, 'car-fruit': 92, 'car-moto': 52}, dim='h', lo=95)
# ── rivals, wardens, townsfolk
grid('magpies', ['crow-walk-down-0', 'crow-walk-down-1', 'crow-walk-up-0', 'crow-walk-up-1', 'crow-run-0', 'crow-run-1', 'crow-look-0', 'crow-look-1', 'crow-taunt', 'crow-dizzy', 'crow-fly-0', 'crow-fly-1'], 4, 3, 54, lo=95)
FRAMES['crow-fly-0'] = FRAMES['crow-fly-0'].resize((140, round(FRAMES['crow-fly-0'].height * 140 / FRAMES['crow-fly-0'].width)), Image.LANCZOS) if 'crow-fly-0' in FRAMES else None
FRAMES['crow-fly-1'] = FRAMES['crow-fly-1'].resize((120, round(FRAMES['crow-fly-1'].height * 120 / FRAMES['crow-fly-1'].width)), Image.LANCZOS) if 'crow-fly-1' in FRAMES else None
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

# ── second batch (docs/jade-street-art/jobs2.py): new hero actions, seated townsfolk, street events and props, the
# festival and fireworks, more buildings and landmarks, the map pieces, medals, the phone and the controls pictures
for h in ('dora', 'enzo'):
    grid(f'{h}-act4', [f'{h}-push-side-0', f'{h}-push-side-1', f'{h}-push-up-0', f'{h}-push-up-1', f'{h}-lantern', f'{h}-lookup', f'{h}-phone', f'{h}-eat', f'{h}-dance', f'{h}-kneel', f'{h}-clap', f'{h}-umbrella'], 4, 3, 58, ref=f'{h}-clap', fix=cream if h == 'dora' else None)
grid('folk3', [f'folk-{s}-sit-{k}' for s in ('rabbit', 'dog', 'squirrel', 'cat', 'duck', 'hedgehog') for k in (0, 1)], 4, 3, 42)
each('events', ['duck-down-0', 'duck-down-1', 'duck-side', 'duck-lost', 'busker-0', 'busker-1', 'busk-hat', 'smoke', 'van-broken', 'crow-mango-0', 'crow-mango-1', 'oranges'], 4, 3,
     {'duck-down-0': 24, 'duck-down-1': 24, 'duck-side': 26, 'duck-lost': 24, 'busker-0': 64, 'busker-1': 64, 'busk-hat': 28, 'smoke': 50, 'van-broken': 96, 'crow-mango-0': 56, 'crow-mango-1': 56, 'oranges': 28}, dim='h')
each('street', ['light-red', 'light-amber', 'light-green', 'fountain', 'banyan', 'table', 'umb-red', 'umb-jade', 'plaza-bench', 'bamboo', 'koi-pond', 'crane-statue'], 4, 3,
     {'light-red': 26, 'light-amber': 26, 'light-green': 26, 'fountain': 120, 'banyan': 190, 'table': 76, 'umb-red': 40, 'umb-jade': 40, 'plaza-bench': 70, 'bamboo': 90, 'koi-pond': 130, 'crane-statue': 50})
each('festival', ['fest-arch', 'fest-dragon', 'sky-lantern', 'sky-lanterns', 'fest-stage', 'fest-rabbit', 'fest-carp', 'fest-bunting', 'fest-float', 'fest-stall', 'fest-pole', 'confetti'], 4, 3,
     {'fest-arch': 270, 'fest-dragon': 200, 'sky-lantern': 26, 'sky-lanterns': 60, 'fest-stage': 170, 'fest-rabbit': 110, 'fest-carp': 120, 'fest-bunting': 270, 'fest-float': 130, 'fest-stall': 134, 'fest-pole': 44, 'confetti': 60})
each('fireworks', ['fw-gold', 'fw-red', 'fw-violet', 'fw-blue', 'fw-orange', 'fw-star'], 3, 2, 220, green=True, lo=60)
square('shops2', [f'shop-{i}' for i in range(7, 13)], 3, 2, 192)
square('roofs2', [f'roof-{i}' for i in range(7, 13)], 3, 2, 192)
square('bld3', ['bld-pavilion', 'bld-incense', 'bld-callig', 'bld-boathouse', 'bld-flowers', 'bld-wheel'], 3, 2, 192, green=True)
square('bld4', ['bld-fish', 'bld-rope', 'bld-chandler', 'bld-hotel', 'bld-robot', 'bld-boba'], 3, 2, 192, green=True)
square('landmarks2', ['lm2-hall', 'lm2-bell', 'lm2-clock', 'lm2-lighthouse', 'lm2-cinema', 'lm2-opera'], 3, 2, {'lm2-hall': 384, 'lm2-bell': 384, 'lm2-clock': 384, 'lm2-lighthouse': 192, 'lm2-cinema': 384, 'lm2-opera': 384}, green=True)
fit('map-icons', ['pin-market', 'pin-safe', 'pin-garage', 'pin-gig', 'pin-job', 'pin-cat', 'pin-mural', 'pin-star', 'mi-temple', 'mi-pagoda', 'mi-crane', 'mi-arcade', 'mi-bridge', 'mi-lighthouse', 'mi-ferry', 'mi-hall'], 4, 4, 160)
fit('map-fog', [f'fog-{i}' for i in range(1, 7)], 3, 2, 420, green=True, lo=50)
fit('ui2', ['ui-medal-bronze', 'ui-medal-silver', 'ui-medal-gold', 'ui-medal-none', 'ui-phone', 'ui-bubble', 'ui-radio', 'ui-book', 'ui-watch', 'ui-calm', 'ui-charm', 'ui-sign'], 4, 3, 200)
fit('controls', ['c-key', 'c-space', 'c-arrows', 'c-shift', 'c-mouse', 'c-stick', 'c-phone', 'c-tap', 'c-hide', 'c-heat', 'c-boost', 'c-horn'], 4, 3, 160)

# ── third batch (docs/jade-street-art/jobs3.py): new hero actions, Madame Glint on foot and her decoys, the chase set
# pieces, impact debris, the six businesses at four levels, and four portrait moods for every speaking character
for h in ('dora', 'enzo'):
    grid(f'{h}-act5', [f'{h}-leap-0', f'{h}-leap-1', f'{h}-land', f'{h}-duck', f'{h}-shoo-0', f'{h}-shoo-1', f'{h}-collect', f'{h}-pocket', f'{h}-deal', f'{h}-mend', f'{h}-skid', f'{h}-tumble'], 4, 3, 58, ref=f'{h}-collect', fix=cream if h == 'dora' else None)
grid('glint', ['glint-run-0', 'glint-run-1', 'glint-down-0', 'glint-down-1', 'glint-taunt', 'glint-leap', 'glint-wave', 'glint-dizzy', 'glint-give', 'decoy-run-0', 'decoy-run-1', 'decoy-pop'], 4, 3, 64, ref='glint-taunt', lo=95)
each('set1', ['stall-smash-0', 'stall-smash-1', 'drum-roll-0', 'drum-roll-1', 'drum-rack', 'warn-bell', 'bridge-down', 'bridge-mid', 'bridge-up', 'crane-load', 'gate-open', 'gate-shut'], 4, 3,
     {'stall-smash-0': 150, 'stall-smash-1': 150, 'drum-roll-0': 60, 'drum-roll-1': 60, 'drum-rack': 130, 'warn-bell': 50, 'bridge-down': 300, 'bridge-mid': 300, 'bridge-up': 300, 'crane-load': 120, 'gate-open': 140, 'gate-shut': 140})
each('set2', ['neon-sign', 'neon-fall', 'neon-wreck', 'float', 'decoy-ride-0', 'decoy-ride-1', 'decoy-poof', 'bunting', 'ramp'], 3, 3,
     {'neon-sign': 120, 'neon-fall': 120, 'neon-wreck': 140, 'float': 230, 'decoy-ride-0': 70, 'decoy-ride-1': 70, 'decoy-poof': 90, 'bunting': 150, 'ramp': 90}, dim='w', lo=95)
fit('debris', ['db-orange', 'db-mango', 'db-melon', 'db-leaf', 'db-plank', 'db-shard', 'db-straw', 'db-feather-b', 'db-feather-w', 'db-spark', 'db-spark-b', 'db-paper', 'db-gold', 'db-lantern', 'db-dust', 'db-coin'], 4, 4, 64)
for f, ids in (('biz1', ('noodle', 'tea', 'fan')), ('biz2', ('cake', 'jade', 'claw'))):
    grid(f, [f'biz-{b}-{l}' for b in ids for l in range(4)], 4, 3, 112, ref=f'biz-{ids[0]}-1')
for f, who in (('expr1', ('kee', 'pang', 'mo', 'heron')), ('expr2', ('kiri', 'bo', 'gizmo', 'ren')), ('expr3', ('glint', 'pip', 'bristle', 'lim'))):
    fit(f, [f'face-{w}-{m}' for w in who for m in ('happy', 'worried', 'cross', 'smug')], 4, 4, 256, lo=95)
fit('expr4', [f'face-{w}-{m}' for w in ('dora', 'enzo') for m in ('happy', 'worried', 'cross', 'smug')], 4, 2, 256)

# ── fourth batch (docs/jade-street-art/jobs4.py): both heroes together (tag-team poses and the passenger's seat), the
# six cartoon gadgets (fire poses, the toys, their shots and impacts), the props the duo works with, Tock and his stall
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act6', [f'{h}-boost-give', f'{h}-boost-rise', f'{h}-hold-0', f'{h}-hold-1', f'{h}-haul-0', f'{h}-haul-1', f'{h}-distract-0', f'{h}-distract-1', f'{h}-pounce-side', f'{h}-pounce-down', f'{h}-snatch', f'{h}-reload'], 4, 3, 58, ref=f'{h}-reload', fix=fx)
    grid(f'{h}-fire', [f'{h}-fire-{g}-{d}' for d in ('side',) for g in ('sling', 'paint', 'popper', 'net', 'bubble', 'confetti')] + [f'{h}-fire-{g}-down' for g in ('sling', 'paint', 'popper', 'net', 'bubble', 'confetti')], 4, 3, 60, ref=f'{h}-fire-paint-down', fix=fx)
    grid(f'{h}-ride2', [f'{h}-pass-0', f'{h}-pass-1', f'{h}-pass-grab', f'{h}-pass-aim', f'{h}-pass-sit', f'{h}-pass-cheer', f'{h}-pass-wave', f'{h}-pass-duck'], 4, 2, 46, fix=fx)
each('gear', ['g-sling', 'g-paint', 'g-popper', 'g-net', 'g-bubble', 'g-confetti', 'crate-shut', 'crate-open', 'shot-sling', 'shot-paint', 'shot-popper', 'shot-net', 'shot-bubble', 'shot-confetti', 'net-open', 'satchel'], 4, 4,
     {'g-sling': 40, 'g-paint': 40, 'g-popper': 40, 'g-net': 44, 'g-bubble': 40, 'g-confetti': 44, 'crate-shut': 46, 'crate-open': 46, 'shot-sling': 16, 'shot-paint': 30, 'shot-popper': 26, 'shot-net': 24, 'shot-bubble': 26, 'shot-confetti': 30, 'net-open': 84, 'satchel': 34})
each('splat', ['sp-rice', 'sp-pink', 'sp-teal', 'sp-pop', 'sp-net', 'sp-bubble', 'sp-puddle', 'sp-confetti', 'crow-netted', 'cart-netted', 'warden-slip', 'warden-paint', 'warden-dazed', 'crow-drop', 'awning-splat', 'glint-netted'], 4, 4,
     {'sp-rice': 40, 'sp-pink': 70, 'sp-teal': 70, 'sp-pop': 96, 'sp-net': 70, 'sp-bubble': 64, 'sp-puddle': 100, 'sp-confetti': 110, 'crow-netted': 62, 'cart-netted': 70, 'warden-slip': 66, 'warden-paint': 62, 'warden-dazed': 62, 'crow-drop': 60, 'awning-splat': 120, 'glint-netted': 72})
each('tag', ['lever-up', 'lever-down', 'sluice-shut', 'sluice-open', 'shutter-shut', 'shutter-open', 'pulley', 'boost-spot', 'window-lookout', 'window-paint', 'loot-bag', 'gadget-stall'], 4, 3,
     {'lever-up': 52, 'lever-down': 52, 'sluice-shut': 128, 'sluice-open': 128, 'shutter-shut': 112, 'shutter-open': 112, 'pulley': 60, 'boost-spot': 90, 'window-lookout': 96, 'window-paint': 96, 'loot-bag': 34, 'gadget-stall': 134})
fit('tock', ['face-tock', 'face-tock-happy', 'face-tock-worried', 'face-tock-cross', 'face-tock-smug', 'face-tock-surprised'], 3, 2, 256)

# ── fifth batch (docs/jade-street-art/jobs5.py and jobs5b.py): Singapore. The crow repaints (each `<sheet>-crow.png`
# is the original sheet with the magpies painted as house crows; only the crow frames are taken from it), the hawker
# stalls, the HDB block, kopitiam and shophouses, the townsfolk and their portraits, the kopi drinks, the bumboat and
# the gantry, the fine-city props, the two rival gangs and the heroes' new poses
_N = None
grid('magpies-crow', ['crow-walk-down-0', 'crow-walk-down-1', 'crow-walk-up-0', 'crow-walk-up-1', 'crow-run-0', 'crow-run-1', 'crow-look-0', 'crow-look-1', 'crow-taunt', 'crow-dizzy', 'crow-fly-0', 'crow-fly-1'], 4, 3, 54, lo=95)
for _n, _w in (('crow-fly-0', 140), ('crow-fly-1', 120)):
    if (SRC / 'magpies-crow.png').exists() and _n in FRAMES: FRAMES[_n] = FRAMES[_n].resize((_w, round(FRAMES[_n].height * _w / FRAMES[_n].width)), Image.LANCZOS)
each('riders-crow', ['crow-cart-0', 'crow-cart-1', _N, _N, 'boss-0', 'boss-1', 'crow-boat-0', 'crow-boat-1'], 4, 2, {'crow-cart-0': 80, 'crow-cart-1': 80, 'boss-0': 70, 'boss-1': 70, 'crow-boat-0': 96, 'crow-boat-1': 96}, dim='h', lo=95)
fit('portraits-crow', [_N] * 8 + ['face-glint', 'face-pip'] + [_N] * 6, 4, 4, 256, lo=95)
fit('expr3-crow', [f'face-{w}-{m}' for w in ('glint', 'pip') for m in ('happy', 'worried', 'cross', 'smug')] + [_N] * 8, 4, 4, 256, lo=95)
grid('glint-crow', ['glint-run-0', 'glint-run-1', 'glint-down-0', 'glint-down-1', 'glint-taunt', 'glint-leap', 'glint-wave', 'glint-dizzy', 'glint-give', 'decoy-run-0', 'decoy-run-1', 'decoy-pop'], 4, 3, 64, ref='glint-taunt', lo=95)
each('set2-crow', [_N, _N, _N, 'float', 'decoy-ride-0', 'decoy-ride-1', 'decoy-poof', _N, _N], 3, 3, {'float': 230, 'decoy-ride-0': 70, 'decoy-ride-1': 70, 'decoy-poof': 90}, dim='w', lo=95)
each('splat-crow', [_N] * 8 + ['crow-netted', _N, _N, _N, _N, 'crow-drop', _N, 'glint-netted'], 4, 4, {'crow-netted': 62, 'crow-drop': 60, 'glint-netted': 72})
each('events-crow', [_N] * 9 + ['crow-mango-0', 'crow-mango-1', _N], 4, 3, {'crow-mango-0': 56, 'crow-mango-1': 56})
each('tag-crow', [_N] * 8 + ['window-lookout', 'window-paint', _N, _N], 4, 3, {'window-lookout': 96, 'window-paint': 96})
fit('debris-crow', [_N] * 7 + ['db-feather-b'] + [_N] * 8, 4, 4, 64)
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act7', [f'{h}-{a}' for a in ('chope', 'chope-done', 'tray-down', 'tray-side', 'serve', 'durian-side', 'durian-down', 'lantern-down', 'lantern-side', 'sell-junk', 'shake-wet', 'sit-chess')], 4, 3, 58, ref=f'{h}-serve', fix=fx)
    grid(f'{h}-act8', [f'{h}-{a}' for a in ('feed', 'gum', 'pay-fine', 'ticket', 'toss', 'pick-litter', 'bin-litter', 'shiok')], 4, 2, 58, ref=f'{h}-pay-fine', fix=fx)
fit('sg-faces1', [f'face-{w}{m}' for w in ('hoon', 'teo', 'beng', 'ong') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
fit('sg-faces2', [f'face-{w}{m}' for w in ('lily', 'goh') for m in ('', '-happy', '-worried', '-cross')], 4, 2, 256)
fit('gang-faces', [f'face-{w}{m}' for w in ('sleek', 'kow') for m in ('', '-happy', '-worried', '-cross')], 4, 2, 256)
grid('folk4', [f'folk-{s}-{k}' for s in ('goose', 'sunbear', 'rooster') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
each('sg-npc', ['auntie-chope', 'auntie-fan', 'goh-chess-0', 'goh-chess-1', 'ong-trike-0', 'ong-trike-1', 'lily-sing-0', 'lily-sing-1', 'liondance-0', 'liondance-1', 'kid-lantern', 'drummer'], 4, 3,
     {'auntie-chope': 60, 'auntie-fan': 60, 'goh-chess-0': 62, 'goh-chess-1': 62, 'ong-trike-0': 96, 'ong-trike-1': 96, 'lily-sing-0': 66, 'lily-sing-1': 66, 'liondance-0': 130, 'liondance-1': 130, 'kid-lantern': 46, 'drummer': 62}, dim='h')
each('sg-props', ['tissue', 'table-chope', 'table-empty', 'durian', 'durian-crate', 'kueh-tray', 'wok', 'mic', 'getai-stage', 'spirit-seats', 'newspapers', 'junk-heap', 'kopi-tray', 'stink-cloud', 'hawker-arch', 'angpao'], 4, 4,
     {'tissue': 22, 'table-chope': 80, 'table-empty': 80, 'durian': 30, 'durian-crate': 58, 'kueh-tray': 40, 'wok': 42, 'mic': 26, 'getai-stage': 230, 'spirit-seats': 110, 'newspapers': 36, 'junk-heap': 66, 'kopi-tray': 40, 'stink-cloud': 70, 'hawker-arch': 230, 'angpao': 22})
each('sg-rides', ['v-bumboat', 'v-bumboat-b', 'trike-top', 'drum-cart', _N, _N], 3, 2, {'v-bumboat': 120, 'v-bumboat-b': 120, 'trike-top': 70, 'drum-cart': 80}, dim='h')
each('sg-rides', [_N] * 4 + ['gantry', 'pontoon'], 3, 2, {'gantry': 282, 'pontoon': 150}, dim='w')
grid('biz3', [f'biz-{b}-{l}' for b in ('ckt', 'chicken', 'satay') for l in range(4)], 4, 3, 112, ref='biz-ckt-1')
grid('biz4', [f'biz-{b}-{l}' for b in ('laksa', 'kopi') for l in range(4)] + [_N] * 4, 4, 3, 112, ref='biz-laksa-1')
each('biz4', [_N] * 8 + ['stall-fish', 'stall-veg', 'mama-shop', 'chess-table'], 4, 3, {'stall-fish': 92, 'stall-veg': 92, 'mama-shop': 100, 'chess-table': 70})
square('sg-bld', ['sg-hdb', 'sg-kopitiam', 'shop-sg1', 'shop-sg2', 'sg-wetmarket', 'sg-clan'], 3, 2, {'sg-hdb': 384, 'sg-kopitiam': 192, 'shop-sg1': 192, 'shop-sg2': 192, 'sg-wetmarket': 384, 'sg-clan': 192}, green=True)
fit('sg-drinks', [f'drink-{d}' for d in ('kopi-o', 'kopi', 'kopi-c', 'teh', 'teh-o', 'teh-c', 'kopi-peng', 'teh-peng', 'kopi-o-peng', 'teh-o-peng', 'kopi-c-peng', 'teh-c-peng')] + ['tin-condensed', 'tin-evap', 'jar-sugar', 'bucket-ice'], 4, 4, 128)
grid('otters', ['otter-walk-down-0', 'otter-walk-down-1', 'otter-walk-up-0', 'otter-walk-up-1', 'otter-run-0', 'otter-run-1', 'otter-swim-0', 'otter-swim-1', 'otter-taunt', 'otter-dizzy', 'otter-bubble', 'otter-netted'], 4, 3, 46, ref='otter-taunt')
grid('macaques', ['mac-walk-down-0', 'mac-walk-down-1', 'mac-walk-up-0', 'mac-walk-up-1', 'mac-run-0', 'mac-run-1', 'mac-snatch', 'mac-munch', 'mac-taunt', 'mac-startled', 'mac-dizzy', 'mac-paint'], 4, 3, 50, ref='mac-taunt')
each('gang-rides', ['otter-raft-0', 'otter-raft-1', 'mac-cart-0', 'mac-cart-1', 'sleek-boat-0', 'sleek-boat-1'], 3, 2, {'otter-raft-0': 84, 'otter-raft-1': 84, 'mac-cart-0': 80, 'mac-cart-1': 80, 'sleek-boat-0': 100, 'sleek-boat-1': 100}, dim='h')
each('fines', ['pigeon-0', 'pigeon-1', 'pigeon-fly', 'seed-bag', 'gum', 'gum-stuck', 'litter', 'ticket', 'warden-write', 'warden-ticket', 'crate-float', 'bananas', 'handbag', 'bun', 'litter-bin', 'fish-basket'], 4, 4,
     {'pigeon-0': 28, 'pigeon-1': 28, 'pigeon-fly': 40, 'seed-bag': 22, 'gum': 20, 'gum-stuck': 20, 'litter': 36, 'ticket': 40, 'warden-write': 54, 'warden-ticket': 58, 'crate-float': 52, 'bananas': 30, 'handbag': 26, 'bun': 20, 'litter-bin': 36, 'fish-basket': 36})
# ── sixth batch (docs/jade-street-art/jobs6.py): the island. Toa Payoh's estate and Marina Bay's front (buildings keyed
# off green and stretched to their tile footprints at 1 px per world unit), the island's props and rides, the Longkang
# Lizards, the new cast and townsfolk, the heroes' train and taxi poses, and the phone and map icons
def rect(file, names, gx, gy, sizes, **kw):
    """buildings with a non-square footprint: stretched to (w, h) tiles at 1 atlas px per world unit"""
    for n, c in zip(names, cells(file, gx, gy, **kw)):
        if not n or c is None: continue
        w, h = sizes[n]; FRAMES[n] = Image.fromarray(c).resize((w * 64, h * 64), Image.LANCZOS)
rect('hdb-bld', ['hdb-slab-a', 'hdb-slab-b', 'hdb-point-a', 'hdb-mscp', 'hdb-nc', 'hdb-market'], 3, 2, {'hdb-slab-a': (10, 4), 'hdb-slab-b': (10, 4), 'hdb-point-a': (4, 4), 'hdb-mscp': (6, 5), 'hdb-nc': (8, 4), 'hdb-market': (6, 6)}, green=True)
rect('hdb-bld2', ['hdb-point-b', 'hdb-kopitiam', 'hdb-stn', 'hdb-cc', 'hdb-hawker', 'hdb-bus'], 3, 2, {'hdb-point-b': (4, 4), 'hdb-kopitiam': (4, 4), 'hdb-stn': (8, 4), 'hdb-cc': (5, 5), 'hdb-hawker': (5, 4), 'hdb-bus': (8, 3)}, green=True)
rect('bay-bld', ['bay-tower-a', 'bay-tower-b', 'bay-tower-c', 'bay-resort', 'bay-stage', 'bay-domes'], 3, 2, {'bay-tower-a': (6, 6), 'bay-tower-b': (5, 5), 'bay-tower-c': (6, 5), 'bay-resort': (12, 6), 'bay-stage': (8, 6), 'bay-domes': (10, 5)}, green=True)
rect('bay-bld2', ['bay-stn', 'bay-wheel', 'bay-mall', 'bay-grove', 'bay-hotel', 'bay-tower-d'], 3, 2, {'bay-stn': (4, 2), 'bay-wheel': (5, 5), 'bay-mall': (9, 3), 'bay-grove': (4, 4), 'bay-hotel': (6, 4), 'bay-tower-d': (5, 5)}, green=True)
each('isle-props', ['playground', 'void-table', 'letterbox', 'bicycles', 'laundry', 'exercise', 'bus-stop', 'taxi-stand', 'durian-stall', 'bougain', 'prom-palm', 'prom-lamp', 'prom-bench', 'xw-barrier', 'cones', 'spin-top'], 4, 4,
     {'playground': 150, 'void-table': 84, 'letterbox': 84, 'bicycles': 90, 'laundry': 96, 'exercise': 90, 'bus-stop': 110, 'taxi-stand': 110, 'durian-stall': 96, 'bougain': 60, 'prom-palm': 70, 'prom-lamp': 54, 'prom-bench': 72, 'xw-barrier': 128, 'cones': 60, 'spin-top': 90})
each('isle-props2', ['rail', 'rail-pillar', 'psd', 'fare-gate', 'hide-liz', 'hide-otter', 'hide-mac', 'crow-nest', 'light-crate', 'carpet', 'statuette', 'jetty-sign', 'stn-pillar', 'mooncakes', 'balloons', 'stools'], 4, 4,
     {'rail': 256, 'rail-pillar': 52, 'psd': 120, 'fare-gate': 70, 'hide-liz': 120, 'hide-otter': 130, 'hide-mac': 150, 'crow-nest': 120, 'light-crate': 60, 'carpet': 70, 'statuette': 34, 'jetty-sign': 40, 'stn-pillar': 40, 'mooncakes': 36, 'balloons': 50, 'stools': 44})
each('isle-rides', ['mrt-front', 'mrt-mid', 'v-taxi', 'v-taxi-b', 'wscoot-0', 'wscoot-1', 'liz-trolley-0', 'liz-trolley-1'], 4, 2,
     {'mrt-front': 230, 'mrt-mid': 230, 'v-taxi': 80, 'v-taxi-b': 80, 'wscoot-0': 60, 'wscoot-1': 60, 'liz-trolley-0': 60, 'liz-trolley-1': 60}, dim='h')
grid('lizards', ['liz-walk-down-0', 'liz-walk-down-1', 'liz-walk-up-0', 'liz-walk-up-1', 'liz-run-0', 'liz-run-1', 'liz-swim', 'liz-lepak', 'liz-taunt', 'liz-dizzy', 'liz-slip', 'liz-netted'], 4, 3, 50, ref='liz-taunt')
fit('isle-faces', [f'face-{w}{m}' for w in ('kamal', 'vanda', 'lepak', 'kaw') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
grid('folk5', [f'folk-{s}-{k}' for s in ('tapir', 'mousedeer', 'civet') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
each('isle-npc', ['kamal-0', 'kamal-flag', 'vanda-0', 'vanda-point', 'lepak-chair', 'lepak-cross', 'kaw-brief', 'kaw-flap', 'mynahs', 'piglet', 'crowd', 'crow-sales'], 4, 3,
     {'kamal-0': 60, 'kamal-flag': 60, 'vanda-0': 64, 'vanda-point': 64, 'lepak-chair': 76, 'lepak-cross': 70, 'kaw-brief': 64, 'kaw-flap': 76, 'mynahs': 44, 'piglet': 40, 'crowd': 86, 'crow-sales': 60}, dim='h')
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act9', [f'{h}-{a}' for a in ('hail-down', 'hail-side', 'tap-card', 'pole-0', 'pole-1', 'seat', 'phone', 'slide', 'point', 'dance-0', 'dance-1', 'panting')], 4, 3, 58, ref=f'{h}-tap-card', fix=fx)
fit('isle-ui', ['i-taxiapp', 'i-mrt', 'pin-train', 'pin-taxi', 'pin-liz', 'mi-resort', 'mi-hdb', 'mi-wheel'], 4, 2, 128)
# ── the job steps (jobs8): the heroes' casing, searching, trapping, swapping and safe-cracking poses, the spy disguise
# with its own walk, the crows' security guards and office interns, the heist and trap props, icons, the heist cards
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act10', [f'{h}-{a}' for a in ('photo', 'photo-flash', 'notes', 'search-0', 'search-1', 'set-trap', 'spring', 'swap-0', 'swap-1', 'safe', 'triumph', 'whistle')], 4, 3, 58, ref=f'{h}-notes', fix=fx)
    grid(f'{h}-disguise', [f'{h}-dis-{a}' for a in ('down-0', 'down-1', 'up-0', 'up-1', 'side-0', 'side-1', 'paper', 'on')], 4, 2, 60, ref=f'{h}-dis-down-0', fix=fx)
grid('guards', ['guard-down-0', 'guard-down-1', 'guard-up-0', 'guard-up-1', 'guard-side-0', 'guard-side-1', 'guard-alarm', 'guard-dazed', 'mac-netted', 'intern-down', 'intern-side-0', 'intern-side-1'], 4, 3, 56)
each('heist-props', ['job-cam', 'job-cam-paint', 'job-safe', 'job-safe-open', 'job-door', 'job-rota', 'job-crate', 'job-crate-fake', 'job-net', 'job-net-sprung', 'job-bait', 'job-rack', 'job-bell', 'job-pile', 'job-decoy', 'job-mess'], 4, 4,
     {'job-cam': 40, 'job-cam-paint': 40, 'job-safe': 56, 'job-safe-open': 56, 'job-door': 70, 'job-rota': 56, 'job-crate': 54, 'job-crate-fake': 54, 'job-net': 60, 'job-net-sprung': 52, 'job-bait': 34, 'job-rack': 54, 'job-bell': 30, 'job-pile': 64, 'job-decoy': 26, 'job-mess': 50}, lo=90)
fit('ui8', ['i-camera', 'i-clue', 'i-net', 'i-swap', 'i-defend', 'i-disguise', 'i-dial', 'i-ask'], 4, 2, 128)
fit('cards8', ['card-quiet', 'card-loud'], 2, 1, 520)
# ── awareness and the partner's own moves (jobs9): the heroes' warning, own-shot, scoop, hide, getaway, bribe, commotion
# and guarding poses; guards, lizards, crows and wardens looking round, searching, calling for help and grumbling off;
# gang members peering at a noise and caught in a chase; sneaky raiders and stall damage; clue markers; search spots;
# the state bubbles and the branch cards
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act11', [f'{h}-{a}' for a in ('psst-down', 'psst-side', 'ready', 'scoop', 'hold-bag', 'beckon', 'cower', 'peek', 'bribe', 'gong-0', 'gong-1', 'brace')], 4, 3, 58, ref=f'{h}-hold-bag', fix=fx)
grid('aware-guards', ['guard-look-l', 'guard-look-r', 'guard-search-0', 'guard-search-1', 'guard-call', 'guard-grumble'], 4, 3, 56)
grid('aware-guards', [None] * 6 + ['liz-look', 'liz-search', 'liz-call'], 4, 3, 50, ref='liz-call')
grid('aware-guards', [None] * 9 + ['crow-search', 'crow-call', 'crow-grumble'], 4, 3, 54, ref='crow-grumble')
each('aware-folk', ['warden-listen', 'warden-look-l', 'warden-look-r', 'warden-search', 'warden-grumble', 'mac-peer', 'otter-peer', 'crow-peer', 'mac-caught', 'otter-caught', 'crow-sneak-0', 'crow-sneak-1'], 4, 3,
     {'warden-listen': 62, 'warden-look-l': 62, 'warden-look-r': 62, 'warden-search': 56, 'warden-grumble': 62, 'mac-peer': 48, 'otter-peer': 46, 'crow-peer': 54, 'mac-caught': 48, 'otter-caught': 44, 'crow-sneak-0': 50, 'crow-sneak-1': 50}, dim='h')
each('raiders9', ['mac-sneak-0', 'mac-sneak-1', 'otter-sneak-0', 'otter-sneak-1', 'crow-grab', 'mac-grab', 'otter-grab', 'stall-dmg-1', 'stall-dmg-2', 'stall-dmg-3', 'puff-feathers', 'puff-dust'], 4, 3,
     {'mac-sneak-0': 64, 'mac-sneak-1': 64, 'otter-sneak-0': 70, 'otter-sneak-1': 70, 'crow-grab': 62, 'mac-grab': 58, 'otter-grab': 50, 'stall-dmg-1': 84, 'stall-dmg-2': 84, 'stall-dmg-3': 84, 'puff-feathers': 60, 'puff-dust': 70})
each('clues9', ['clue-prints', 'clue-feathers', 'clue-crumbs', 'clue-kopi', 'clue-paper', 'clue-pandan', 'clue-scratch', 'clue-straw', 'clue-paws', 'clue-feather', 'clue-syrup', 'clue-wrappers'], 4, 3,
     {'clue-prints': 44, 'clue-feathers': 40, 'clue-crumbs': 38, 'clue-kopi': 40, 'clue-paper': 40, 'clue-pandan': 42, 'clue-scratch': 44, 'clue-straw': 36, 'clue-paws': 42, 'clue-feather': 26, 'clue-syrup': 38, 'clue-wrappers': 40}, lo=100)
each('spots9', ['spot-puffs', 'spot-bins', 'spot-cooler', 'spot-planters', 'spot-bikes', 'spot-pandan', 'spot-papers', 'spot-steamers', 'spot-cakes', 'spot-bin', 'spot-awning', 'spot-kopi'], 4, 3,
     {'spot-puffs': 58, 'spot-bins': 56, 'spot-cooler': 48, 'spot-planters': 66, 'spot-bikes': 68, 'spot-pandan': 56, 'spot-papers': 50, 'spot-steamers': 40, 'spot-cakes': 52, 'spot-bin': 34, 'spot-awning': 44, 'spot-kopi': 30})
fit('ui9', ['bub-sus', 'bub-alert', 'bub-search', 'bub-grumble', 'bub-call', 'bub-psst', 'ui-paw', 'i-noise'], 4, 2, 96)
fit('cards9a', ['card-disguise', 'card-commotion'], 2, 1, 520)
fit('cards9b', ['card-nets', 'card-chase'], 2, 1, 520)
fit('cards9c', ['card-ask', 'card-bribe'], 2, 1, 520)
each('mg-parts2', ['mg-dial', 'mg-notch', 'mg-lamp-off', 'mg-lamp-on', 'mg-tumbler', 'mg-scope', 'mg-handle', 'mg-sparkle'], 4, 2,
     {'mg-dial': 300, 'mg-notch': 36, 'mg-lamp-off': 56, 'mg-lamp-on': 76, 'mg-tumbler': 40, 'mg-scope': 90, 'mg-handle': 140, 'mg-sparkle': 90})
# ── the ninth pass (jobs10): Little India, Kampong Glam and Sentosa. Their buildings (keyed off green, stretched to
# their footprints), festival, beach, cable car and ferry props, the Kecoh Mynahs and Crow Number Nine, the new cast's
# portraits, three new townsfolk, the heroes' festival and beach poses, and the map and phone icons
rect('india-bld', ['india-temple', 'india-emporium', 'india-sari', 'india-villa', 'india-shop-a', 'india-shop-b'], 3, 2, {'india-temple': (6, 6), 'india-emporium': (9, 5), 'india-sari': (6, 4), 'india-villa': (5, 4), 'india-shop-a': (8, 4), 'india-shop-b': (8, 4)}, green=True)
rect('india-bld2', ['india-tekka', 'india-spice', 'india-flower', 'india-prata', 'india-arcade', 'india-shop-c'], 3, 2, {'india-tekka': (8, 6), 'india-spice': (6, 4), 'india-flower': (6, 4), 'india-prata': (4, 4), 'india-arcade': (5, 3), 'india-shop-c': (8, 4)}, green=True)
rect('glam-bld', ['glam-mosque', 'glam-haji', 'glam-textile', 'glam-perfume', 'glam-cafe', 'glam-bussorah'], 3, 2, {'glam-mosque': (10, 8), 'glam-haji': (8, 3), 'glam-textile': (8, 4), 'glam-perfume': (4, 4), 'glam-cafe': (8, 4), 'glam-bussorah': (6, 4)}, green=True)
rect('resort-bld', ['resort-hotel', 'resort-fort', 'resort-coaster', 'resort-gate', 'resort-aquarium', 'resort-cable'], 3, 2, {'resort-hotel': (12, 5), 'resort-fort': (10, 8), 'resort-coaster': (10, 7), 'resort-gate': (8, 6), 'resort-aquarium': (6, 5), 'resort-cable': (6, 4)}, green=True)
rect('resort-bld2', ['resort-stn', 'resort-tower', 'resort-villa', 'resort-ferry', 'resort-bar', 'glam-shop'], 3, 2, {'resort-stn': (6, 3), 'resort-tower': (4, 4), 'resort-villa': (6, 4), 'resort-ferry': (6, 4), 'resort-bar': (5, 3), 'glam-shop': (6, 4)}, green=True)
each('east-props', ['garland-stall', 'flower-baskets', 'spice-sacks', 'kolam', 'carpet-stall', 'textile-stall', 'cafe-tables', 'deepavali-arch', 'diya', 'diya-lit', 'bazaar-stall', 'bazaar-shut', 'pelita', 'hide-myna', 'cable-pylon', 'cable-cabin'], 4, 4,
     {'garland-stall': 96, 'flower-baskets': 80, 'spice-sacks': 76, 'kolam': 110, 'carpet-stall': 100, 'textile-stall': 100, 'cafe-tables': 110, 'deepavali-arch': 320, 'diya': 30, 'diya-lit': 30, 'bazaar-stall': 112, 'bazaar-shut': 112, 'pelita': 20, 'hide-myna': 150, 'cable-pylon': 70, 'cable-cabin': 46})
each('resort-props', ['cannon', 'carousel', 'beach-umbrella', 'deck-chair', 'lifeguard', 'sandcastle', 'ferry-boat', 'cable-wire', 'kuih', 'firebox', 'garland', 'ketupat', 'perfume', 'beach-ball', 'surfboard', 'kecoh-flock'], 4, 4,
     {'cannon': 90, 'carousel': 150, 'beach-umbrella': 76, 'deck-chair': 54, 'lifeguard': 84, 'sandcastle': 54, 'ferry-boat': 96, 'cable-wire': 162, 'kuih': 30, 'firebox': 34, 'garland': 30, 'ketupat': 28, 'perfume': 32, 'beach-ball': 30, 'surfboard': 56, 'kecoh-flock': 150})
grid('mynahs', ['myna-walk-down-0', 'myna-walk-down-1', 'myna-walk-up-0', 'myna-walk-up-1', 'myna-run-0', 'myna-run-1', 'myna-fly-0', 'myna-fly-1', 'myna-taunt', 'myna-dizzy', 'myna-netted', 'myna-munch'], 4, 3, 44, ref='myna-taunt')
each('mynahs2', ['myna-preen', 'myna-bubble', 'myna-sing', 'myna-peer', 'myna-caught', 'myna-grab', 'myna-sneak-0', 'myna-sneak-1', 'nine-brief', 'nine-run-0', 'nine-run-1', 'myna-perch'], 4, 3,
     {'myna-preen': 44, 'myna-bubble': 46, 'myna-sing': 46, 'myna-peer': 44, 'myna-caught': 44, 'myna-grab': 48, 'myna-sneak-0': 56, 'myna-sneak-1': 56, 'nine-brief': 64, 'nine-run-0': 64, 'nine-run-1': 64, 'myna-perch': 44}, dim='h')
fit('east-faces', [f'face-{w}{m}' for w in ('raju', 'malar', 'kancil', 'wangi') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
fit('east-faces2', [f'face-{w}{m}' for w in ('duyung', 'helang', 'bising', 'nine') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
grid('folk6', [f'folk-{s}-{k}' for s in ('deer', 'loris', 'turtle') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid(f'{h}-act12', [f'{h}-{a}' for a in ('light-lamp-0', 'light-lamp-1', 'kuih-0', 'kuih-1', 'ears-0', 'ears-1', 'sniff-0', 'sniff-1', 'lounge-0', 'lounge-1', 'castle-0', 'castle-1')], 4, 3, 58, ref=f'{h}-kuih-0', fix=fx)
# the playtest fixes: each new district's own safe house (3×3 tiles), and the Jade Line entrance prop at Chinatown station
square('safe-bld', ['safe-hdb', 'safe-bay', 'safe-india', 'safe-glam', 'safe-resort', None], 3, 2, 192, green=True)
each('safe-bld', [None] * 5 + ['stn-entrance'], 3, 2, {'stn-entrance': 124}, green=True)
fit('ui10', ['i-cable', 'pin-cable', 'pin-ferry', 'mi-mosque', 'mi-gopuram', 'mi-fort', 'mi-coaster', 'i-festival'], 4, 2, 128)
# ── tenth batch (docs/jade-street-art/jobs-empire.py): the empire. Fifteen properties at four levels (shuttered and for
# sale, then three upgrades), the damage and repair dressing and the empire's props, the gangs raiding (carrying off the
# till, kicking a crate, gloating), Pak Duri the jaga, the four new people's faces, the heroes' empire poses, the
# empire's pins, icons and rank badges
EMP_PROPS = (('emp-props1', ('shophouse', 'zichar', 'bumboat')), ('emp-props2', ('karaoke', 'kopitiam', 'taxi')), ('emp-props3', ('provision', 'rooftop', 'icekacang')),
             ('emp-props4', ('prata', 'spice', 'cafe')), ('emp-props5', ('textile', 'beachbar', 'kayak')))
EMP_BIZ = tuple(f'biz-{b}-' for _, ids in EMP_PROPS for b in ids)
for f, ids in EMP_PROPS:
    grid(f, [f'biz-{b}-{l}' for b in ids for l in range(4)], 4, 3, 112, ref=f'biz-{ids[0]}-1')
each('emp-dmg', ['emp-boards', 'emp-mess', 'emp-sign-broken', 'emp-scaffold', 'emp-forsale', 'emp-stool', 'emp-ledger', 'emp-cashbox', 'emp-coinbag', 'emp-rosette', 'emp-boards-honest', 'emp-boards-fake'], 4, 3,
     {'emp-boards': 110, 'emp-mess': 64, 'emp-sign-broken': 60, 'emp-scaffold': 110, 'emp-forsale': 42, 'emp-stool': 40, 'emp-ledger': 50, 'emp-cashbox': 34, 'emp-coinbag': 30, 'emp-rosette': 30, 'emp-boards-honest': 50, 'emp-boards-fake': 50})
RAID_POSES = ('till-0', 'till-1', 'kick', 'gloat')
each('emp-raid1', [f'{g}-{p}' for g in ('crow', 'mac', 'otter') for p in RAID_POSES], 4, 3, 56, dim='h')
each('emp-raid2', [f'{g}-{p}' for g in ('liz', 'myna') for p in RAID_POSES] + ['duri-walk-0', 'duri-walk-1', 'duri-alert', 'duri-shoo'], 4, 3,
     {**{f'liz-{p}': 40 for p in RAID_POSES}, **{f'myna-{p}': 46 for p in RAID_POSES}, 'duri-walk-0': 60, 'duri-walk-1': 60, 'duri-alert': 62, 'duri-shoo': 62}, dim='h')
fit('emp-faces', [f'face-{w}{m}' for w in ('huat', 'siew', 'hoot', 'duri') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
for h in ('dora', 'enzo'):
    grid(f'{h}-act13', [f'{h}-{a}' for a in ('repair-0', 'repair-1', 'shake', 'send', 'bag-0', 'bag-1', 'count-0', 'count-1')], 4, 2, 58, ref=f'{h}-send', fix=cream if h == 'dora' else None)
fit('emp-ui', ['pin-prop', 'pin-prop-own', 'pin-raid', 'i-empire', 'i-ledger', 'i-repair', 'i-jaga', 'i-round', 'rank-1', 'rank-2', 'rank-3', 'rank-4'], 4, 3, 160)
# ── the twelfth pass (docs/jade-street-art/jobs12.py): Orchard Road, Katong and Changi. Their buildings and safe houses
# (keyed off green, stretched to their footprints), the Christmas, Peranakan, park and airport props, Jewel's Rain
# Vortex, the Atas Bats and Datin Ciku, the new cast's portraits, three townsfolk, the heroes' coast poses, the
# repainted harbour ferry, the icons and the ground
rect('katong-bld', ['katong-terrace-a', 'katong-terrace-b', 'katong-laksa', 'katong-mansion', 'katong-shops', 'katong-corner'], 3, 2, {'katong-terrace-a': (9, 3), 'katong-terrace-b': (8, 4), 'katong-laksa': (6, 4), 'katong-mansion': (6, 4), 'katong-shops': (8, 4), 'katong-corner': (4, 4)}, green=True)
rect('katong-bld2', ['katong-hawker', 'katong-bike', 'katong-seafood', 'katong-mall', 'katong-stn', 'katong-pavilion'], 3, 2, {'katong-hawker': (10, 4), 'katong-bike': (5, 3), 'katong-seafood': (8, 4), 'katong-mall': (10, 5), 'katong-stn': (8, 4), 'katong-pavilion': (5, 3)}, green=True)
rect('orchard-bld', ['orchard-ion', 'orchard-ngee', 'orchard-lux', 'orchard-lucky', 'orchard-tangs', 'orchard-stn'], 3, 2, {'orchard-ion': (12, 6), 'orchard-ngee': (10, 6), 'orchard-lux': (6, 4), 'orchard-lucky': (6, 4), 'orchard-tangs': (5, 5), 'orchard-stn': (8, 4)}, green=True)
rect('orchard-bld2', ['orchard-emerald', 'orchard-bar', 'orchard-hotel', 'orchard-xmas', 'orchard-glass', 'orchard-cafe'], 3, 2, {'orchard-emerald': (9, 3), 'orchard-bar': (5, 3), 'orchard-hotel': (4, 4), 'orchard-xmas': (8, 4), 'orchard-glass': (6, 4), 'orchard-cafe': (4, 4)}, green=True)
rect('changi-bld', ['changi-terminal', 'changi-tower', 'changi-hangar', 'changi-hawker', 'changi-shops', 'changi-stn'], 3, 2, {'changi-terminal': (12, 5), 'changi-tower': (4, 4), 'changi-hangar': (9, 6), 'changi-hawker': (10, 5), 'changi-shops': (8, 4), 'changi-stn': (8, 4)}, green=True)
rect('changi-bld2', ['changi-ferry', 'safe-katong', 'safe-orchard', 'safe-changi', 'changi-hotel', None], 3, 2, {'changi-ferry': (6, 3), 'safe-katong': (3, 3), 'safe-orchard': (3, 3), 'safe-changi': (3, 3), 'changi-hotel': (6, 4)}, green=True)
each('props12a', ['laksa-cart', 'kamcheng', 'bird-cages', 'kueh-stall', 'bike-rack', 'bbq-pit', 'kite', 'casuarina', 'xmas-tree', 'xmas-arch', 'xmas-star', 'gifts', 'bauble', 'reindeer', 'shop-bags', 'hide-bat'], 4, 4,
     {'laksa-cart': 72, 'kamcheng': 40, 'bird-cages': 84, 'kueh-stall': 76, 'bike-rack': 84, 'bbq-pit': 60, 'kite': 56, 'casuarina': 120, 'xmas-tree': 110, 'xmas-arch': 352, 'xmas-star': 40, 'gifts': 70, 'bauble': 30, 'reindeer': 80, 'shop-bags': 50, 'hide-bat': 160})
each('props12b', ['plane-parked', 'baggage-tug', 'trolley', 'suitcase', 'glass-wall', 'forest-planter', 'runway-light', 'windsock', 'ciku-basket', 'nasi-lemak', 'sea-bench', None, 'plane-fly', 'gift-lights', 'glass-tree', 'fallen-stars'], 4, 4,
     {'plane-parked': 294, 'baggage-tug': 120, 'trolley': 60, 'suitcase': 36, 'glass-wall': 141, 'forest-planter': 90, 'runway-light': 30, 'windsock': 70, 'ciku-basket': 44, 'nasi-lemak': 40, 'sea-bench': 80, 'plane-fly': 220, 'gift-lights': 70, 'glass-tree': 96, 'fallen-stars': 60})
each('jewel', ['vortex', 'vortex-show', 'canopy-bridge', 'forest-terrace'], 2, 2, {'vortex': 448, 'vortex-show': 448, 'canopy-bridge': 384, 'forest-terrace': 150})
each('ferry2', ['ferry-boat'], 1, 1, {'ferry-boat': 96}, dim='h')
grid('bats', ['bat-walk-down-0', 'bat-walk-down-1', 'bat-walk-up-0', 'bat-walk-up-1', 'bat-run-0', 'bat-run-1', 'bat-fly-0', 'bat-fly-1', 'bat-taunt', 'bat-dizzy', 'bat-netted', 'bat-munch'], 4, 3, 46, ref='bat-taunt')
each('bats2', ['bat-hang-0', 'bat-hang-1', 'bat-preen', 'bat-bubble', 'bat-caught', 'bat-grab', 'bat-sneak-0', 'bat-sneak-1', 'bat-peer', 'bat-perch', 'ciku-stand', 'ciku-run-0'], 4, 3,
     {'bat-hang-0': 50, 'bat-hang-1': 50, 'bat-preen': 46, 'bat-bubble': 48, 'bat-caught': 46, 'bat-grab': 50, 'bat-sneak-0': 54, 'bat-sneak-1': 54, 'bat-peer': 46, 'bat-perch': 46, 'ciku-stand': 66, 'ciku-run-0': 66}, dim='h')
each('bats3', ['bat-till-0', 'bat-till-1', 'bat-kick', 'bat-gloat', 'ciku-run-1', 'ciku-dizzy', 'bat-star', 'bat-sing'], 4, 2,
     {'bat-till-0': 46, 'bat-till-1': 46, 'bat-kick': 46, 'bat-gloat': 46, 'ciku-run-1': 66, 'ciku-dizzy': 60, 'bat-star': 58, 'bat-sing': 48}, dim='h')
fit('faces12a', [f'face-{w}{m}' for w in ('rosie', 'bala', 'tiara', 'faiz') for m in ('', '-happy', '-worried', '-cross')], 4, 4, 256)
fit('faces12b', [f'face-{w}{m}' for w in ('ubin', 'ciku') for m in ('', '-happy', '-worried', '-cross')], 4, 2, 256)
grid('folk7', [f'folk-{s}-{k}' for s in ('robin', 'pigeon', 'egret') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
for h in ('dora', 'enzo'):
    grid(f'{h}-act14', [f'{h}-{a}' for a in ('ride-bike-0', 'ride-bike-1', 'laksa-0', 'laksa-1', 'bauble-0', 'bauble-1', 'kite-0', 'kite-1', 'plane-0', 'plane-1', 'suitcase-0', 'suitcase-1')], 4, 3, 58, ref=f'{h}-laksa-0', fix=cream if h == 'dora' else None)
fit('ui12', ['i-bike', 'pin-bat', 'mi-jewel', 'mi-mall', 'mi-terrace', 'mi-airport', 'i-xmas', 'mi-beach'], 4, 2, 128)
# ── the job givers standing in the world (jobs7): six frames each, facing the street; each row scaled from its own idle
CAST_H = {'kee': 52, 'mo': 60, 'pang': 56, 'heron': 70, 'ren': 58, 'kiri': 58, 'lim': 54, 'bo': 72, 'bristle': 62, 'gizmo': 58, 'glint': 64,
          'pip': 50, 'hoon': 58, 'teo': 66, 'beng': 60, 'ong': 56, 'lily': 70, 'goh': 56, 'sleek': 58, 'kow': 62, 'kamal': 58, 'vanda': 66,
          'lepak': 66, 'kaw': 64, 'tock': 52, 'raju': 58, 'malar': 56, 'kancil': 58, 'wangi': 62, 'duyung': 72, 'helang': 66, 'bising': 56, 'nine': 60,
          'huat': 68, 'siew': 74, 'hoot': 62, 'duri': 60, 'rosie': 58, 'bala': 56, 'tiara': 62, 'faiz': 70, 'ubin': 70, 'ciku': 64}
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
for f, who in (('cast1', ['kee', 'mo', 'pang', 'heron']), ('cast2', ['ren', 'kiri', 'lim', 'bo']), ('cast3', ['bristle', 'gizmo', 'glint', 'pip']),
               ('cast4', ['hoon', 'teo', 'beng', 'ong']), ('cast5', ['lily', 'goh', 'sleek', 'kow']), ('cast6', ['kamal', 'vanda', 'lepak', 'kaw']), ('cast7', ['tock']),
               ('cast8', ['raju', 'malar', 'kancil', 'wangi']), ('cast9', ['duyung', 'helang', 'bising', 'nine']), ('cast10', ['huat', 'siew', 'hoot', 'duri']), ('cast11', ['rosie', 'bala', 'tiara', 'faiz']), ('cast12', ['ubin', 'ciku'])):
    gx, gy = (3, 2) if len(who) == 1 else (6, len(who))
    for r, n in enumerate(who):
        names = [f'npc-{n}-{p}' for p in CAST_POSES] if len(who) == 1 else [f'npc-{n}-{p}' if j // 6 == r else None for j, p in enumerate(CAST_POSES * len(who))]
        grid(f, names, gx, gy, CAST_H[n], ref=f'npc-{n}-idle-0')
FRAMES = {k: v for k, v in FRAMES.items() if v is not None}

# ── seamless ground textures: crop each square, then blend it with its half-offset copy so the edges wrap
TEX = {}
def seamless(arr):
    h, w = arr.shape[:2]
    rolled = np.roll(np.roll(arr, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.minimum(np.minimum(xx, w - 1 - xx) / (w * 0.5), np.minimum(yy, h - 1 - yy) / (h * 0.5))
    m = np.clip(m * 2.2, 0, 1)[..., None]
    return (arr * m + rolled * (1 - m)).astype(np.uint8)
for f, names in (('ground', ['road', 'walk', 'plaza', 'grass', 'canal', 'plank']), ('ground2', ['temple', 'sea', 'dock', 'neon', 'path', 'cobble']), ('ground3', ['xway', 'hdb', 'rubber', 'granite', 'deck', 'bay']), ('ground4', ['india', 'glam', 'sand', 'resort', 'lagoon', 'fort']), ('ground5', ['katong', 'orchard', 'tarmac', 'cycle', 'jewel', 'changi'])):
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
BIG = ['loading'] + [f'stall-{d}' for d in ('market', 'temple', 'canal', 'docks', 'arcade')] + [f'story-{i}' for i in range(1, 5)] + [f'chapter-{i}' for i in range(1, 6)] + [f'end-{i}' for i in range(1, 4)] + ['gadget-shop', 'chapter-6', 'end-4', 'mrt-ride', 'stall-heartland', 'stall-bay', 'chapter-7', 'end-5', 'cable-ride', 'stall-india', 'stall-glam', 'stall-resort']
BIG += ['empire']  # the tenth pass: the Empire page's banner
BIG += ['chapter-8', 'end-6', 'stall-katong', 'stall-orchard', 'stall-changi']  # the twelfth pass
for n, size in (('title', (1536, 1024)), ('mg-lock', (1280, 853)), ('mg-wire', (1280, 853)), ('mg-wok', (1280, 853)), ('mg-board', (1280, 853)), ('mg-haggle', (1280, 853)), ('mg-kopi', (1280, 853)), ('mg-safe', (1280, 853)), ('map-paper', (1024, 683))) + tuple((b, (1280, 853)) for b in BIG):
    p = SRC / f'{n}-crow.png' if (SRC / f'{n}-crow.png').exists() else SRC / f'{n}.png'
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
for n in ('ui-plaque-jade', 'ui-plaque-red', 'ui-btn-jade', 'ui-btn-red', 'ui-ring', 'ui-lantern-on', 'ui-lantern-off'):
    if n in FRAMES: FRAMES[n].save(OUT / f'{n}.webp', 'WEBP', quality=88, method=6)
# the map frame: keyed off its green and kept whole for CSS border-image
if (SRC / 'map-frame.png').exists():
    fr = Image.fromarray(key(Image.open(SRC / 'map-frame.png'), True, lo=60)); bb = fr.getbbox(); fr = fr.crop(bb)
    fr.resize((1200, round(fr.height * 1200 / fr.width)), Image.LANCZOS).save(OUT / 'ui-map-frame.webp', 'WEBP', quality=86, method=6)

# ── atlases
NEW_BLD = tuple(f'shop-{i}' for i in range(7, 13)) + tuple(f'roof-{i}' for i in range(7, 13)) + ('bld-pavilion', 'bld-incense', 'bld-callig', 'bld-boathouse', 'bld-flowers', 'bld-wheel', 'bld-fish', 'bld-rope', 'bld-chandler', 'bld-hotel', 'bld-robot', 'bld-boba')
# Atlases are grouped by when the game needs them (lib/jade-load.ts gives each a tier): the heroes' everyday poses,
# the interface, townsfolk and traffic load first; Chinatown's buildings, props, givers and stalls before play; the
# heroes' rarer poses, job pieces and Chinatown's dialogue faces right after; each later district's paintings (and its
# givers and faces) when the heroes get near it; the mini-games' pieces when one opens.
HERO_CORE = ('walk-', 'run-', 'idle-', 'sneak', 'dash-', 'hop-', 'land', 'leap', 'skid', 'tumble', 'bump', 'talk', 'wave', 'cheer', 'carry-', 'pickup', 'ride-', 'pass', 'fire-', 'hide', 'caught', 'swap', 'door', 'climb-', 'lookup', 'duck', 'hail-', 'sleep', 'umbrella', 'phone')
ZONE_PEOPLE = {'isle': ('kamal', 'vanda', 'lepak', 'kaw'), 'east': ('raju', 'malar', 'kancil', 'wangi', 'bising', 'nine'),
               'resort': ('duyung', 'helang'), 'far': ('rosie', 'bala', 'tiara', 'faiz', 'ubin', 'ciku')}
def mood_face(n): return n.startswith('face-') and n.count('-') >= 2 and n.split('-')[-1] in ('happy', 'worried', 'cross', 'smug')
def person(n): return n.split('-')[1] if n.count('-') >= 1 else ''
def zone_group(kind, z): return (f'{kind}-{z}', lambda n: (mood_face(n) if kind == 'faces' else n.startswith('npc-')) and person(n) in ZONE_PEOPLE[z])
GROUPS = [('dora', lambda n: n.startswith('dora-') and n[5:].startswith(HERO_CORE)), ('enzo', lambda n: n.startswith('enzo-') and n[5:].startswith(HERO_CORE)),
          ('dora2', lambda n: n.startswith('dora-')), ('enzo2', lambda n: n.startswith('enzo-')),
          # the tenth pass's empire: the new properties, the damage and props, the raiders and Pak Duri, the rank badges
          # (what the streets show from the first night: each property and stall at level 0 and the for-sale board)
          ('empire', lambda n: n == 'emp-forsale' or (n.startswith(EMP_BIZ) and n.endswith('-0'))),
          ('empire2', lambda n: n.startswith(('emp-', 'duri-', 'rank-') + EMP_BIZ) or n.endswith(('-till-0', '-till-1', '-kick', '-gloat'))),
          ('city2', lambda n: n in NEW_BLD),
          # the twelfth pass's districts: lazy like the ninth's
          ('far', lambda n: n.startswith(('orchard-', 'katong-', 'changi-', 'safe-orchard', 'safe-katong', 'safe-changi'))),
          ('far2', lambda n: n.startswith(('bat-', 'ciku-', 'folk-robin', 'folk-pigeon', 'folk-egret', 'laksa-cart', 'kamcheng', 'bird-cages', 'kueh-stall', 'bike-rack', 'bbq-pit', 'kite', 'casuarina', 'xmas-', 'gifts', 'bauble', 'reindeer', 'shop-bags', 'hide-bat', 'plane-', 'baggage-tug', 'trolley', 'suitcase', 'glass-', 'forest-', 'runway-light', 'windsock', 'nasi-lemak', 'sea-bench', 'gift-lights', 'fallen-stars', 'vortex', 'canopy-bridge'))),
          # the ninth pass's districts: loaded in the background after the game starts (lib/jade-scene.ts LAZY)
          ('east', lambda n: n.startswith(('india-', 'glam-'))), ('resort', lambda n: n.startswith('resort-')),
          ('resort2', lambda n: n.startswith(('cable-', 'cannon', 'carousel', 'beach-', 'deck-chair', 'lifeguard', 'sandcastle', 'ferry-boat', 'surfboard'))),
          ('east2', lambda n: n.startswith(('myna-', 'nine-', 'folk-deer', 'folk-loris', 'folk-turtle', 'garland', 'flower-baskets', 'spice-sacks', 'kolam', 'carpet-stall', 'textile-stall', 'cafe-tables', 'deepavali-arch', 'diya', 'bazaar-', 'pelita', 'hide-myna', 'cable-', 'cannon', 'carousel', 'beach-', 'deck-chair', 'lifeguard', 'sandcastle', 'ferry-boat', 'kuih', 'firebox', 'ketupat', 'perfume', 'surfboard', 'kecoh-flock'))),
          ('isle', lambda n: n.startswith(('hdb-', 'bay-'))),
          ('isle2', lambda n: n.startswith(('liz-', 'kamal-', 'vanda-', 'lepak-', 'kaw-', 'mynahs', 'piglet', 'crowd', 'crow-sales', 'folk-tapir', 'folk-mousedeer', 'folk-civet', 'mrt-', 'v-taxi', 'wscoot', 'rail', 'psd', 'fare-gate', 'hide-', 'crow-nest', 'playground', 'void-table', 'letterbox', 'bicycles', 'laundry', 'exercise', 'bus-stop', 'taxi-stand', 'durian-stall', 'bougain', 'prom-', 'xw-barrier', 'cones', 'spin-top', 'light-crate', 'carpet', 'statuette', 'jetty-sign', 'stn-pillar', 'mooncakes', 'balloons', 'stools'))), ('land', lambda n: n.startswith('lm2-')),
          *[zone_group('cast', z) for z in ZONE_PEOPLE], ('cast-town', lambda n: n.startswith('npc-')),
          ('city', lambda n: n.startswith(('shop-', 'roof-', 'flat-', 'bld-', 'lm-', 'safe-', 'stn-entrance'))),
          ('rides', lambda n: n.startswith(('v-', 'car-', 'crow-cart', 'crow-boat', 'boss-', 'warden-bike'))),
          ('gear', lambda n: n.startswith(('g-', 'crate-', 'shot-', 'net-open', 'satchel', 'sp-', 'crow-netted', 'cart-netted', 'warden-slip', 'warden-paint', 'warden-dazed', 'crow-drop', 'awning-splat', 'glint-netted', 'lever-', 'sluice-', 'shutter-', 'pulley', 'boost-spot', 'window-', 'loot-bag'))),
          ('jobs', lambda n: n.startswith(('guard-', 'intern-', 'job-', 'card-', 'mac-netted'))),
          ('aware', lambda n: n.startswith(('clue-', 'spot-', 'bub-', 'stall-dmg-', 'puff-', 'mac-sneak', 'otter-sneak', 'mac-grab', 'otter-grab', 'crow-grab', 'mac-peer', 'otter-peer', 'crow-peer', 'mac-caught', 'otter-caught', 'crow-sneak', 'crow-search', 'crow-call', 'crow-grumble', 'liz-look', 'liz-search', 'liz-call', 'warden-listen', 'warden-look', 'warden-search', 'warden-grumble'))),
          *[zone_group('faces', z) for z in ZONE_PEOPLE], ('faces-town', lambda n: mood_face(n) and person(n) not in ('dora', 'enzo')),  # the heroes' own go with the townsfolk (first to load)
          ('set', lambda n: n == 'stall-smash-0' or (n.startswith('biz-') and n.endswith('-0'))),
          ('set2', lambda n: n.startswith(('stall-smash', 'biz-', 'drum-', 'warn-bell', 'bridge-', 'crane-load', 'gate-', 'neon-', 'float', 'decoy-', 'bunting', 'ramp', 'db-', 'glint-'))),
          ('folk', lambda n: n.startswith(('folk-', 'crow-', 'warden-', 'blimp', 'block-', 'cone', 'face-'))),
          ('ui', lambda n: n.startswith(('ui-', 'c-', 'pin-', 'mi-', 'fog-', 'i-'))),
          ('sg', lambda n: n.startswith(('pigeon', 'auntie-', 'goh-', 'ong-', 'lily-', 'liondance', 'kid-lantern', 'drummer', 'sg-', 'shop-sg'))),
          ('sg2', lambda n: n.startswith(('otter-', 'mac-', 'sleek-', 'drink-', 'tin-', 'jar-', 'bucket-'))),
          ('mg', lambda n: n.startswith('mg-')),
          # the festival, fireworks, heirlooms, the lost ducklings and the busker: street events and finales, not the first steps
          ('props2', lambda n: n.startswith(('fest-', 'fw-', 'duck-', 'h-', 'busk', 'lion-', 'sky-lantern', 'confetti', 'stink-cloud', 'smoke', 'loot-sack', 'van-broken'))),
          ('props', lambda n: True)]
# quality 80 (was 86): about 15% smaller, with no difference to see at the game's scale (crops compared side by side)
ATLAS_Q = 80
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
    atlas.save(OUT / f'atlas-{g}.webp', 'WEBP', quality=ATLAS_Q, method=6); SIZES[g] = atlas.size
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
# an atlas from an older grouping is removed, and every file gets a content hash (VER): the game asks for
# name.webp?v=<hash>, so the art can be cached for a year (public/_headers) and a repaint is fetched fresh
import hashlib
for f in OUT.glob('atlas-*.webp'):
    if f.stem[6:] not in SIZES: f.unlink()
VER = {f.stem: hashlib.sha256(f.read_bytes()).hexdigest()[:10] for f in sorted(OUT.glob('*.webp'))}
lines += ['/** a content hash of every file in public/art/jade-street/, sent as ?v= so the art can be cached for a year */',
          'export const VER: Record<string, string> = {' + ', '.join(f"'{n}': '{h}'" for n, h in VER.items()) + '};']
TS.write_text('\n'.join(lines) + '\n')
# the stylesheets name a few paintings directly (plaques, buttons, the map's paper and frame): give them the hash too
import re as _re
for css in (ROOT / 'app' / 'jade-street').glob('*.css'):
    t0 = css.read_text(); t1 = _re.sub(r'/art/jade-street/([\w-]+)\.webp(\?v=\w+)?', lambda m: f'/art/jade-street/{m[1]}.webp?v={VER[m[1]]}', t0)
    if t1 != t0: css.write_text(t1)
print(len(meta), 'frames;', len(TEX), 'textures;', 'missing:', MISSING)
