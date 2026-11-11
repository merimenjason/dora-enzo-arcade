"""Brinelight art pipeline: python3 scripts/brinelight-art.py <folder of Codex paintings>

Every sheet is painted by Codex on flat magenta (#FF00FF), or flat green (#00FF00) for anything violet or pink
(see docs/brinelight-art/style.md and jobs.txt). This script:
  1. keys the ground colour to transparency and pulls the magenta (or green) cast back out of grey fur and white
     feathers, so Enzo stays grey rather than lavender;
  2. cuts each sheet's grid into frames, keeping only the biggest blob in each cell (so a neighbour's tail can't leak
     in) and cropping tight;
  3. scales every frame of a sheet by one factor, chosen so the sheet's reference frame (its idle stance) stands at its
     world height; later hero sheets repeat the idle stance as frame 1, so their scale matches the first sheet;
  4. finds each frame's anchor: the bottom of the crop is the feet, and across is the head for the heroes (so the
     head stays put while the body moves under it) and the centre of mass for everything else;
  5. packs the frames into a few WebP atlases in public/art/brinelight/ and writes lib/brinelight-art.ts;
  6. keys the floor strips (sky transparent, made seamless left to right) and saves the far paintings, the title,
     the map and the story panels as plain WebP.
Run it with the user's python3 (numpy and Pillow are in the user site-packages), not with -I.
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/art/brinelight'
TS = ROOT / 'lib/brinelight-art.ts'
OUT.mkdir(parents=True, exist_ok=True)
PX = 1.6   # atlas pixels per world unit

def key(im, green=False, lo=40, hi=170):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green:
        m = g - np.maximum(r, b); M = np.array([0, 255, 0], np.float32)
    else:
        m = np.minimum(r, b) - g; M = np.array([255, 0, 255], np.float32)
    al = np.clip(1 - (m - lo) / (hi - lo), 0, 1)
    k = al > 0.03
    f = (a - (1 - al[..., None]) * M) / np.maximum(al[..., None], 0.03)
    out = np.zeros(a.shape[:2] + (4,), np.float32)
    out[..., :3] = np.clip(np.where(k[..., None], f, 0), 0, 255)
    out[..., 3] = al * 255
    out[~k] = 0
    rgb = out[..., :3]
    if green:   # despill: pull any green cast back to neutral
        sp = np.clip(rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]), 0, None); rgb[..., 1] -= sp
    else:       # the magenta ground tints grey fur and feathers lavender: pull it back
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None); rgb[..., 0] -= sp; rgb[..., 2] -= sp
    out[out[..., 3] < 25] = 0
    return out.astype(np.uint8)

def biggest(sub):
    """keep the largest blob plus anything big near it (drops fragments of neighbours at cell edges)"""
    q = sub[::4, ::4, 3] > 30
    h, w = q.shape
    lab = np.zeros((h, w), np.int32); n = 0; sizes = {}
    for y0 in range(h):
        for x0 in range(w):
            if not q[y0, x0] or lab[y0, x0]: continue
            n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0
            while st:
                y, x = st.pop(); c += 1
                for dy in (-2, -1, 0, 1, 2):
                    for dx in (-2, -1, 0, 1, 2):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; st.append((yy, xx))
            sizes[n] = c
    if not sizes: return sub
    keep = [k for k, v in sizes.items() if v >= max(sizes.values()) * 0.04]
    km = np.isin(lab, keep)
    p = np.pad(km, 3); d = np.zeros_like(p)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            d |= np.roll(np.roll(p, dy, 0), dx, 1)
    mask = d[3:-3, 3:-3].repeat(4, 0).repeat(4, 1)[:sub.shape[0], :sub.shape[1]]
    sub = sub.copy(); sub[~mask] = 0
    return sub

def crop(sub):
    ys, xs = np.where(sub[..., 3] > 20)
    if len(ys) == 0: return None
    return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

FRAMES = {}     # name -> (array, anchor mode)
SCALEK = {}     # name -> pixel scale factor

def grid(file, names, gx, gy, ref, world, green=False, anchor='mass', clean=True, flip=False):
    """cut a sheet; `ref` is the name of the frame that must stand `world` units tall"""
    arr = key(Image.open(SRC / f'{file}.png'), green)
    H, W = arr.shape[:2]
    cells = {}
    for j in range(gy):
        for i in range(gx):
            n = names[j * gx + i]
            if not n: continue
            sub = arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx]
            if clean: sub = biggest(sub)
            c = crop(sub)
            if c is None: print('!! empty', file, n); continue
            if flip: c = c[:, ::-1]
            cells[n] = c
    k = world * PX / cells[ref].shape[0]
    for n, c in cells.items():
        if n.startswith('_'): continue
        FRAMES[n] = (c, anchor); SCALEK[n] = k

def anchor_x(a, mode):
    al = a[..., 3].astype(np.float32)
    if mode == 'head':
        top = al[: max(4, int(a.shape[0] * 0.3))]
        cols = top.sum(0)
    else:
        cols = al.sum(0)
    if cols.sum() == 0: return a.shape[1] / 2
    c = np.cumsum(cols); return float(np.searchsorted(c, c[-1] / 2))

# ─────────────────────────────── the sheets
D, E = 165, 172
grid('dora', ['dora-idle', 'dora-walk1', 'dora-walk2', 'dora-k1', 'dora-k2', 'dora-k4', 'dora-jump', 'dora-dive', 'dora-hurt', 'dora-tag', 'dora-win', 'dora-face'], 4, 3, 'dora-idle', D, anchor='head')
grid('dora2', ['_d2', 'dora-idle2', 'dora-walk3', 'dora-walk4', 'dora-k1w', 'dora-k2w', 'dora-k4w', 'dora-k4f', 'dora-fall', 'dora-land', 'dora-rise', 'dora-hurt2'], 4, 3, '_d2', D, anchor='head')
grid('dora3', ['_d3', 'dora-dash', 'dora-knee', 'dora-sp0', 'dora-sp1', 'dora-sp2', 'dora-sp3', 'dora-tagleap', 'dora-down', 'dora-getup', 'dora-pick', 'dora-win2'], 4, 3, '_d3', D, anchor='head')
grid('enzo', ['enzo-idle', 'enzo-walk1', 'enzo-walk2', 'enzo-p1', 'enzo-p3f', 'enzo-hold', 'enzo-throw', 'enzo-jump', 'enzo-hurt', 'enzo-tag', 'enzo-win', 'enzo-face'], 4, 3, 'enzo-idle', E, anchor='head')
grid('enzo2', ['_e2', 'enzo-idle2', 'enzo-walk3', 'enzo-walk4', 'enzo-p1w', 'enzo-p2', 'enzo-p3w', 'enzo-p3', 'enzo-reach', 'enzo-throww', 'enzo-land', 'enzo-hurt2'], 4, 3, '_e2', E, anchor='head')
grid('enzo3', ['_e3', 'enzo-dash', 'enzo-barge', 'enzo-sp0', 'enzo-sp1', 'enzo-sp2', 'enzo-sp3', 'enzo-hammer', 'enzo-down', 'enzo-getup', 'enzo-heave', 'enzo-win2'], 4, 3, '_e3', E, anchor='head')
grid('crab', ['crab-idle', 'crab-walk', 'crab-wind', 'crab-atk', 'crab-hurt', 'crab-down'], 3, 2, 'crab-idle', 64)
grid('crab2', ['_c2', 'crab-walk2', 'crab-wind2', 'crab-rec', 'crab-daze', 'crab-tumble', 'crab-getup', 'crab-taunt'], 4, 2, '_c2', 64)
grid('gull', ['gull-idle', 'gull-flap', 'gull-wind', 'gull-dive', 'gull-hurt', 'gull-down'], 3, 2, 'gull-idle', 98, clean=False)
grid('gull2', ['_g2', 'gull-flap2', 'gull-shriek', 'gull-carry', 'gull-crash', 'gull-getup', 'gull-airhurt', 'gull-waddle'], 4, 2, '_g2', 98, clean=False)
grid('hermit', ['hermit-idle', 'hermit-walk', 'hermit-wind', 'hermit-atk', 'hermit-hurt', 'hermit-down', 'hermit-soft', 'hermit-shell'], 4, 2, 'hermit-idle', 88)
grid('hermit2', ['_h2', 'hermit-walk2', 'hermit-roll', 'hermit-wind2', None, None, None, 'hermit-shellside'], 4, 2, '_h2', 88)
grid('puffer', ['puffer-idle', 'puffer-walk1', 'puffer-walk2', 'puffer-wind', 'puffer-atk', 'puffer-puffed', 'puffer-hurt', 'puffer-down'], 4, 2, 'puffer-idle', 78)
grid('shrimp', ['shrimp-idle', 'shrimp-run1', 'shrimp-run2', 'shrimp-whistle1', 'shrimp-whistle2', 'shrimp-wave', 'shrimp-hurt', 'shrimp-down'], 4, 2, 'shrimp-idle', 92)
grid('lobster', ['lobster-idle', 'lobster-walk1', 'lobster-walk2', 'lobster-block', 'lobster-wind', 'lobster-atk', 'lobster-hurt', 'lobster-down'], 4, 2, 'lobster-idle', 112)
grid('jelly', ['jelly-idle', 'jelly-pulse', 'jelly-drift', 'jelly-charge', 'jelly-zap', 'jelly-hurt', 'jelly-dim', 'jelly-down'], 4, 2, 'jelly-idle', 96, green=True)
grid('urchin', ['urchin-idle', 'urchin-roll1', 'urchin-roll2', 'urchin-wind', 'urchin-hurt', 'urchin-down'], 3, 2, 'urchin-idle', 62, green=True)
grid('brute', ['brute-idle', 'brute-walk', 'brute-wind', 'brute-atk', 'brute-hurt', 'brute-block', 'brute-bidle', 'brute-bwalk', 'brute-bwind', 'brute-batk', 'brute-bhurt', 'brute-down'], 4, 3, 'brute-idle', 175)
grid('knuckles', ['knuckles-idle', 'knuckles-step1', 'knuckles-step2', 'knuckles-tell', 'knuckles-punch', 'knuckles-flurry', 'knuckles-guard', 'knuckles-hop', 'knuckles-hurt', 'knuckles-dizzy', 'knuckles-down', 'knuckles-taunt'], 4, 3, 'knuckles-idle', 150, green=True)
grid('clamps', ['clamps-idle', 'clamps-rock1', 'clamps-rock2', 'clamps-roll', 'clamps-dizzy', 'clamps-bare', 'clamps-bwind', 'clamps-bswipe', 'clamps-juggle', 'clamps-bdizzy', 'clamps-down', 'clamps-barrel'], 4, 3, 'clamps-idle', 190)
grid('admiral', ['admiral-stand', 'admiral-shriek', 'admiral-dive', 'admiral-swoop', 'admiral-tumble', 'admiral-grounded', 'admiral-pinned', 'admiral-hurt', 'admiral-wingw', 'admiral-wing', 'admiral-hover', 'admiral-down'], 4, 3, 'admiral-stand', 175, clean=False)
grid('npcs', ['npc-mabel', 'npc-mabel-talk', 'face-mabel', 'npc-twins', 'npc-twins-cheer', 'face-twins', 'npc-barnaby', 'face-barnaby'], 4, 2, 'npc-mabel', 175)
grid('props', ['lantern-lit', 'lantern-dark', 'barrel', 'fishcrate', 'lobsterpot', 'bollard', 'crate', 'rope'], 4, 2, 'crate', 58)
grid('props2', ['cart', 'hatch', 'hatch-open', 'ice', 'net-hang', 'net-down', 'charm', 'snack', 'bun', 'crate-cracked', 'scroll', 'debris'], 4, 3, 'cart', 86)
grid('props3', ['stall-ice', 'stall-lobster', 'awning', 'fishboxes', 'basket', 'brine', 'driedfish', 'truck', 'mussels', 'netcoil', 'brazier', 'bell'], 4, 3, 'stall-ice', 92)
grid('strings', ['string-dark', 'string-lit'], 1, 2, 'string-dark', 220, clean=False)

# a few props are painted at another size than their sheet-mates: per-frame world heights
FIX = {'lantern-lit': 36, 'lantern-dark': 36, 'barrel': 64, 'fishcrate': 46, 'lobsterpot': 54, 'bollard': 44, 'crate': 58, 'rope': 30,
       'hatch': 34, 'hatch-open': 40, 'ice': 58, 'net-hang': 96, 'net-down': 34, 'charm': 40, 'snack': 30, 'bun': 30, 'crate-cracked': 58, 'scroll': 30, 'debris': 26,
       'stall-ice': 92, 'stall-lobster': 92, 'awning': 230, 'fishboxes': 84, 'basket': 52, 'brine': 70, 'driedfish': 62, 'truck': 84, 'mussels': 40, 'netcoil': 40, 'brazier': 52, 'bell': 130,
       'npc-twins': 118, 'npc-twins-cheer': 124, 'npc-barnaby': 120, 'face-mabel': 120, 'face-twins': 120, 'face-barnaby': 120,
       'dora-face': 140, 'enzo-face': 140, 'hermit-shell': 70, 'hermit-shellside': 60, 'hermit-soft': 52, 'clamps-barrel': 96}
for n, w in FIX.items():
    if n in FRAMES: SCALEK[n] = w * PX / FRAMES[n][0].shape[0]

# ui (blobs on one sheet)
def blobs(file, names, rows, size):
    arr = key(Image.open(SRC / f'{file}.png'))
    q = arr[::4, ::4, 3] > 30
    h, w = q.shape
    lab = np.zeros((h, w), np.int32); n = 0; info = []
    for y0 in range(h):
        for x0 in range(w):
            if not q[y0, x0] or lab[y0, x0]: continue
            n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0; x1 = x2 = x0; y1 = y2 = y0
            while st:
                y, x = st.pop(); c += 1; x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
            info.append((c, n, x1, y1, x2, y2))
    info = sorted(info, reverse=True)[:len(names)]
    H = arr.shape[0]
    info.sort(key=lambda b: (int((b[3] + b[5]) / 2 * 4 / (H / rows)), b[2]))
    for (c, n, x1, y1, x2, y2), name in zip(info, names):
        m = (lab == n).repeat(4, 0).repeat(4, 1)[:arr.shape[0], :arr.shape[1]]
        sub = arr.copy(); sub[~m] = 0
        cc = crop(sub)
        FRAMES[name] = (cc, 'mass'); SCALEK[name] = size / max(cc.shape[:2])
blobs('ui', ['btn-atk', 'btn-jump', 'btn-tag', 'stick-base', 'stick-knob', 'ring', 'bar', 'bossbar', 'go', 'icon-lantern', 'keycap', 'medal'], 3, 400)
# the medal also stands alone, for the results card
Image.fromarray(FRAMES['medal'][0]).resize((240, round(240 * FRAMES['medal'][0].shape[0] / FRAMES['medal'][0].shape[1])), Image.LANCZOS).save(OUT / 'medal.webp', 'WEBP', quality=86)

# ─────────────────────────────── pack
GROUPS = [('dora', lambda n: n.startswith('dora-')), ('enzo', lambda n: n.startswith('enzo-')),
          ('foes', lambda n: n.split('-')[0] in ('crab', 'gull', 'hermit', 'puffer', 'shrimp', 'lobster', 'jelly', 'urchin')),
          ('bosses', lambda n: n.split('-')[0] in ('brute', 'knuckles', 'clamps', 'admiral')),
          ('ui', lambda n: n.startswith('btn-') or n in ('stick-base', 'stick-knob', 'ring', 'bar', 'bossbar', 'go', 'icon-lantern', 'keycap', 'medal') or n.startswith('face-')),
          ('props', lambda n: True)]
assigned = {}
for n in FRAMES:
    for gi, (g, f) in enumerate(GROUPS):
        if f(n): assigned[n] = gi; break
meta = {}
for gi, (g, _) in enumerate(GROUPS):
    names = [n for n in FRAMES if assigned[n] == gi]
    ims = {}
    for n in names:
        a, mode = FRAMES[n]
        k = SCALEK[n]
        im = Image.fromarray(a)
        w2, h2 = max(1, round(im.width * k)), max(1, round(im.height * k))
        im = im.resize((w2, h2), Image.LANCZOS)
        ax = anchor_x(a, mode) * k
        ims[n] = (im, ax)
    MAXW = 2048
    order = sorted(names, key=lambda n: -ims[n][0].height)
    x = y = rowh = 0; place = {}
    for n in order:
        im = ims[n][0]
        if x + im.width + 2 > MAXW: x = 0; y += rowh + 2; rowh = 0
        place[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    H = y + rowh
    atlas = Image.new('RGBA', (MAXW, H), (0, 0, 0, 0))
    for n in names:
        atlas.paste(ims[n][0], place[n])
    atlas.save(OUT / f'atlas-{g}.webp', 'WEBP', quality=84, method=6)
    for n in names:
        im, ax = ims[n]
        meta[n] = [gi, place[n][0], place[n][1], im.width, im.height, round(ax, 1)]
    print(g, len(names), atlas.size, (OUT / f'atlas-{g}.webp').stat().st_size // 1024, 'KB')

# ─────────────────────────────── floors, far paintings, title, map, panels
BG = {}
def strip(file, name, width, overlap=220):
    arr = key(Image.open(SRC / f'{file}.png'))
    ys = np.where(arr[..., 3].max(1) > 200)[0]
    arr = arr[ys.min():]
    a = arr.astype(np.float32)
    H, W = a.shape[:2]
    w = np.linspace(0, 1, overlap)[None, :, None]
    a[:, :overlap] = a[:, :overlap] * w + a[:, W - overlap:] * (1 - w)
    a = a[:, :W - overlap]
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    s = width / im.width
    im = im.resize((width, round(im.height * s)), Image.LANCZOS)
    im.save(OUT / f'floor-{name}.webp', 'WEBP', quality=80, method=6)
    BG['floor-' + name] = list(im.size)
for f, n in (('quay', 'quay'), ('breakwater', 'breakwater'), ('street', 'street'), ('market', 'market')): strip(f, n, 1100)
def plain(file, name, size, q=78):
    im = Image.open(SRC / f'{file}.png').convert('RGB').resize(size, Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=q, method=6); BG[name] = list(im.size)
for f, n in (('far', 'far-harbour'), ('townfar', 'far-town'), ('alleyfar', 'far-alley'), ('marketfar', 'far-market'), ('squarefar', 'far-square'),
             ('far2', 'far-harbour2'), ('far3', 'far-harbour3'), ('townfar2', 'far-town2'), ('marketfar2', 'far-market2'), ('squarefar2', 'far-square2')): plain(f, n, (1344, 896))
for f in ('title', 'map', 'panel-intro', 'panel-quay', 'panel-market'): plain(f, f, (1536, 1024), 80)

# ─────────────────────────────── the TypeScript index
lines = [
    '// Generated by scripts/brinelight-art.py from the Codex paintings; do not edit by hand.',
    '// FRAMES: name -> [atlas, x, y, w, h, anchor x], in atlas pixels; PX atlas pixels make one world unit.',
    '// A frame is drawn with its bottom edge on the ground (or at its height above it) and its anchor at the x.',
    f'export const PX = {PX};',
    'export const ATLASES = [' + ', '.join(f"'{g}'" for g, _ in GROUPS) + '] as const;',
    'export const FRAMES: Record<string, [number, number, number, number, number, number]> = {',
]
for n in sorted(meta):
    lines.append(f"  '{n}': [{', '.join(str(v) for v in meta[n])}],")
lines.append('};')
lines.append('export const IMAGES: Record<string, [number, number]> = {')
for n in sorted(BG): lines.append(f"  '{n}': [{BG[n][0]}, {BG[n][1]}],")
lines.append('};')
TS.write_text('\n'.join(lines) + '\n')
print(len(meta), 'frames;', len(BG), 'images')
