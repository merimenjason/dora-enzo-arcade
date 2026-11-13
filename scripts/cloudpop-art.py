"""Cloudpop art pipeline: python3 scripts/cloudpop-art.py <art-src folder>
Keys the Codex sheets (flat magenta, or green for the UI pieces), pulls the magenta cast out of fur and clouds, cuts
each 4x4 (or 4x3) grid by cells keeping the biggest blobs per cell, cropped tight, packs atlases into
public/art/cloudpop/, saves the painted maps and backgrounds as WebP, measures each map's water from the painting
(a 16-pixel grid) and writes lib/cloudpop-art.ts. Adapted from scripts/highburrow-art.py.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art-src')
OUT = ROOT / 'public' / 'art' / 'cloudpop'
TS = ROOT / 'lib' / 'cloudpop-art.ts'
OUT.mkdir(parents=True, exist_ok=True)

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
    if green:
        sp = np.clip(rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]), 0, None); rgb[..., 1] -= sp
    else:
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None); rgb[..., 0] -= sp * 0.8; rgb[..., 2] -= sp
    out[out[..., 3] < 25] = 0
    return out.astype(np.uint8)

def label(q):
    h, w = q.shape
    lab = np.zeros((h, w), np.int32); n = 0; info = []
    for y0 in range(h):
        for x0 in range(w):
            if not q[y0, x0] or lab[y0, x0]: continue
            n += 1; st = [(y0, x0)]; lab[y0, x0] = n; c = 0; x1 = x2 = x0; y1 = y2 = y0
            while st:
                y, x = st.pop(); c += 1; x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; st.append((yy, xx))
            info.append((c, n, x1, y1, x2, y2))
    return lab, info

def biggest(sub, keep_frac=0.03):
    q = sub[::4, ::4, 3] > 30
    lab, info = label(q)
    if not info: return sub
    mx = max(i[0] for i in info)
    keep = [i[1] for i in info if i[0] >= mx * keep_frac]
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

FRAMES = {}
def cells(file, gx, gy, green=False):
    arr = key(Image.open(SRC / f'{file}.png'), green)
    H, W = arr.shape[:2]
    for j in range(gy):
        for i in range(gx):
            sub = arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx]
            # trim a 1% border so a neighbour's stray pixel at the seam is dropped
            bh, bw = max(1, sub.shape[0] // 100), max(1, sub.shape[1] // 100)
            sub = sub[bh:-bh, bw:-bw]
            yield crop(biggest(sub))

def grid(file, names, gx, gy, height, ref=None, green=False):
    """one scale per sheet: the `ref` frame (default the first) stands `height` px tall"""
    cs = list(cells(file, gx, gy, green))
    named = {n: c for n, c in zip(names, cs) if n and c is not None}
    for n in names:
        if n and n not in named: print('!! empty', file, n)
    k = height / named[ref or names[0]].shape[0]
    for n, c in named.items():
        im = Image.fromarray(c)
        FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

def fit(file, names, gx, gy, size, green=False):
    """every item scaled so its longer side is `size`"""
    for n, c in zip(names, cells(file, gx, gy, green)):
        if not n: continue
        if c is None: print('!! empty', file, n); continue
        im = Image.fromarray(c); k = size / max(im.size)
        FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

LOOKS = ['base', 'a3', 'a5', 'b3', 'b5', 'c3', 'c5']
TOWERS = ['pebble', 'busker', 'ember', 'ice', 'llama', 'hay', 'condor', 'boat', 'windmill', 'lantern', 'quinoa']
for t in TOWERS:
    if t == 'condor':
        names = ['condor-roost'] + [f'condor-{l}-{f}' for l in LOOKS for f in (0, 1)] + ['condor-proj']
        grid('tw-condor', names, 4, 4, 170, ref='condor-roost')
        continue
    names = [f'{t}-{l}-{f}' for l in LOOKS for f in (0, 1)] + [f'{t}-proj', f'{t}-proj2']
    grid(f'tw-{t}', names, 4, 4, 180, ref=f'{t}-base-0')
    # projectiles keep a modest fixed size
    for n in (f'{t}-proj', f'{t}-proj2'):
        im = FRAMES[n]; k = 64 / max(im.size); FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
im = FRAMES['condor-proj']; k = 56 / max(im.size); FRAMES['condor-proj'] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

P1 = ['wisp', 'drizzle', 'shower', 'squall', 'gale', 'rumble', 'frost', 'hail']
fit('puffs1', [f'p-{k}-{f}' for k in P1 for f in (0, 1)], 4, 4, 120)
fit('puffs2', ['p-tempest-0', 'p-tempest-1', 'p-cloudburst-0', 'p-cloudburst-1', 'p-sleet-0', 'p-sleet-1', 'p-sleet-crack1', 'p-sleet-crack2',
               'ov-night', 'ov-fog', 'ov-fort', 'pop-1', 'pop-2', 'pop-ring', 'splash', 'puddle'], 4, 4, 128)
fit('bosses', ['b-thunderhead', 'b-thunderhead-hurt', 'b-anvilhead', 'b-anvilhead-hurt', 'b-stormcrown', 'b-stormcrown-hurt', 'b-whirlwind', 'b-whirlwind-hurt', 'b-huracan', 'b-huracan-hurt', 'b-break', 'b-bolt'], 4, 3, 300)

HF = ['idle', 'idle2', 'wind', 'throw', 'ab1a', 'ab1b', 'ab2a', 'ab2b', 'ab3a', 'ab3b', 'cheer', 'land', 'worry', 'win', 'face', 'proj']
for sheet, pre in (('hero-dora', 'dora'), ('hero-enzo', 'enzo'), ('hero-dora-moonlit', 'dora-moonlit'), ('hero-enzo-harvest', 'enzo-harvest')):
    if not (SRC / f'{sheet}.png').exists(): print('!! missing', sheet); continue
    grid(sheet, [f'{pre}-{f}' for f in HF], 4, 4, 190, ref=f'{pre}-idle')
    for n in (f'{pre}-face',):
        im = FRAMES[n]; k = 220 / max(im.size); FRAMES[n] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im = FRAMES[f'{pre}-proj']; k = 64 / max(im.size); FRAMES[f'{pre}-proj'] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

for t in TOWERS:
    if (SRC / f'ic-{t}.png').exists(): fit(f'ic-{t}', [f'ic-{t}-{i}' for i in range(15)] + [f'ic-{t}-portrait'], 4, 4, 112)
    else: print('!! missing icons', t)
fit('icons1', ['i-heart', 'i-coin', 'i-acorn', 'i-round', 'i-play', 'i-ff', 'i-fff', 'i-pause', 'i-gear', 'i-sell', 'i-first', 'i-last', 'i-strong', 'i-close', 'i-lock', 'i-star'], 4, 4, 96)
if (SRC / 'icons2.png').exists():
    fit('icons2', ['i-tree', 'i-medal', 'i-trophy', 'i-daily', 'i-map', 'i-hero', 'i-lab', 'i-back', 'i-home', 'i-sound', 'i-mute', 'i-auto', 'i-help', 'i-x', 'i-ok', 'i-crown'], 4, 4, 96)
if (SRC / 'medals.png').exists():
    fit('medals', ['m-gold', 'm-silver', 'm-bronze', 'm-reverse', 'm-onekind', 'm-lean', 'm-nightfall', 'm-endless'] + [f'tr-{i}' for i in range(8)], 4, 4, 112)
if (SRC / 'lore.png').exists(): fit('lore', [f'lore-{i}' for i in range(16)], 4, 4, 96)
if (SRC / 'fx.png').exists():
    fit('fx', ['fx-ice', 'fx-burn', 'fx-stun', 'fx-goo', 'fx-coins', 'fx-level', 'fx-flash', 'fx-wind', 'fx-rocks', 'fx-confetti', 'fx-moon', 'fx-sun', 'fx-snow', 'fx-spark', 'fx-dust', 'fx-petals'], 4, 4, 128)

# UI pieces: nine blobs on one green sheet, sorted into rows of three, saved as single files for CSS
UISIZE = {}
if (SRC / 'ui.png').exists():
    arr = key(Image.open(SRC / 'ui.png'), green=True)
    lab, info = label(arr[::4, ::4, 3] > 30)
    info = sorted(info, reverse=True)[:9]
    Hh = arr.shape[0]
    info.sort(key=lambda b: (int((b[3] + b[5]) / 2 * 4 / (Hh / 3)), b[2]))
    UI = ['ui-panel', 'ui-card', 'ui-banner', 'ui-btn-red', 'ui-btn-teal', 'ui-btn-round', 'ui-plaque', 'ui-ring', 'ui-strip']
    for (c, n, x1, y1, x2, y2), name in zip(info, UI):
        m = (lab == n).repeat(4, 0).repeat(4, 1)[:arr.shape[0], :arr.shape[1]]
        sub = arr.copy(); sub[~m] = 0
        im = Image.fromarray(crop(sub))
        if im.width > 700: im = im.resize((700, round(im.height * 700 / im.width)), Image.LANCZOS)
        im.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6); UISIZE[name] = im.size

# paintings, and each map's water measured from its own paint
PLAIN = {}; WATER = {}
MAPIDS = ['meadow', 'loop', 'salar', 'falls', 'canyon', 'isles', 'forest', 'summit']
for mid in MAPIDS:
    f = SRC / f'map-{mid}.png'
    if not f.exists(): print('!! missing map', mid); continue
    im = Image.open(f).convert('RGB').resize((1536, 1024), Image.LANCZOS)
    im.save(OUT / f'map-{mid}.webp', 'WEBP', quality=82, method=6); PLAIN[f'map-{mid}'] = im.size
    a = np.asarray(im).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    wet = (b > r + 45) & (g > r + 25) & (b > 140)
    cell = wet.reshape(64, 16, 96, 16).mean(axis=(1, 3)) > 0.55
    rows = []
    for row in cell:  # run lengths, alternating dry/wet, starting dry
        runs, cur, n = [], False, 0
        for v in row:
            if bool(v) == cur: n += 1
            else: runs.append(n); cur = not cur; n = 1
        runs.append(n); rows.append('.'.join(map(str, runs)))
    WATER[mid] = rows
for n in ('bg-title', 'bg-library', 'bg-mapselect', 'bg-win', 'bg-lose'):
    f = SRC / f'{n}.png'
    if not f.exists(): print('!! missing', n); continue
    im = Image.open(f).convert('RGB').resize((1536, 1024), Image.LANCZOS)
    im.save(OUT / f'{n}.webp', 'WEBP', quality=78, method=6); PLAIN[n] = im.size

GROUPS = [('towers1', lambda n: n.split('-')[0] in TOWERS[:6]), ('towers2', lambda n: n.split('-')[0] in TOWERS[6:]),
          ('heroes', lambda n: n.startswith(('dora', 'enzo'))), ('puffs', lambda n: n.startswith(('p-', 'ov-', 'pop-', 'splash', 'puddle', 'b-'))),
          ('icons', lambda n: n.startswith('ic-')), ('ui', lambda n: True)]
meta = {}; assigned = {}; SIZES = {}
for n in FRAMES:
    for gi, (g, f) in enumerate(GROUPS):
        if f(n): assigned[n] = gi; break
for gi, (g, _) in enumerate(GROUPS):
    names = sorted([n for n in FRAMES if assigned[n] == gi], key=lambda n: -FRAMES[n].height)
    MAXW = 2048; x = y = rowh = 0; place = {}
    for n in names:
        im = FRAMES[n]
        if x + im.width + 2 > MAXW: x = 0; y += rowh + 2; rowh = 0
        place[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (MAXW, max(1, y + rowh)), (0, 0, 0, 0))
    for n in names: atlas.paste(FRAMES[n], place[n])
    atlas.save(OUT / f'atlas-{g}.webp', 'WEBP', quality=84, method=6); SIZES[g] = atlas.size
    for n in names: meta[n] = [gi, place[n][0], place[n][1], FRAMES[n].width, FRAMES[n].height]
    print(g, len(names), atlas.size, (OUT / f'atlas-{g}.webp').stat().st_size // 1024, 'KB')

lines = ['// Generated by scripts/cloudpop-art.py from the Codex paintings; do not edit by hand.',
         '// FRAMES: name -> [atlas, x, y, w, h] in atlas pixels. WATER: per map, 64 rows of 96 cells (16 px) as run lengths, dry first.',
         'export const ATLASES = [' + ', '.join(f"'atlas-{g}'" for g, _ in GROUPS) + '] as const;',
         'export const FRAMES: Record<string, [number, number, number, number, number]> = {']
lines += [f"  '{n}': [{', '.join(map(str, meta[n]))}]," for n in sorted(meta)]
lines += ['};', 'export const UI: Record<string, [number, number]> = {']
lines += [f"  '{n}': [{w}, {h}]," for n, (w, h) in UISIZE.items()]
lines += ['};', 'export const PLAIN: Record<string, [number, number]> = {']
lines += [f"  '{n}': [{w}, {h}]," for n, (w, h) in PLAIN.items()]
lines += ['};', 'export const ATLAS_SIZE: Record<string, [number, number]> = {' + ', '.join(f"'atlas-{g}': [{w}, {h}]" for g, (w, h) in SIZES.items()) + '};']
lines += ['export const WATER: Record<string, string[]> = {']
for mid, rows in WATER.items():
    lines.append(f"  {mid}: [" + ', '.join(f"'{r}'" for r in rows) + '],')
lines += ['};']
TS.write_text('\n'.join(lines) + '\n')
print(len(meta), 'frames')
