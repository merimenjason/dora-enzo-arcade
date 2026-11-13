"""Highburrow art pipeline: python3 scripts/highburrow-art.py <art-src folder>
Keys the Codex sheets (flat magenta, or green for the UI pieces), pulls the magenta cast out of grey fur, cuts each
grid by cells (keeping the biggest blob per cell, cropped tight), masks terrain tiles to exact pointy-top hexagons,
packs atlases into public/art/highburrow/ and writes lib/highburrow-art.ts. Adapted from the repo's scripts/brinelight-art.py.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'art-src')
OUT = ROOT / 'public' / 'art' / 'highburrow'
TS = ROOT / 'lib' / 'highburrow-art.ts'
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
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None); rgb[..., 0] -= sp; rgb[..., 2] -= sp
    out[out[..., 3] < 25] = 0
    return out.astype(np.uint8)

def label(q, conn8=True):
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

def biggest(sub):
    q = sub[::4, ::4, 3] > 30
    lab, info = label(q)
    if not info: return sub
    mx = max(i[0] for i in info)
    keep = [i[1] for i in info if i[0] >= mx * 0.04]
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

FRAMES = {}   # name -> PIL RGBA image at final size

def cells(file, gx, gy, green=False, clean=True):
    arr = key(Image.open(SRC / f'{file}.png'), green)
    H, W = arr.shape[:2]
    for j in range(gy):
        for i in range(gx):
            sub = arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx]
            if clean: sub = biggest(sub)
            yield crop(sub)

def grid(file, names, gx, gy, height, ref=None, green=False, clean=True):
    """one scale per sheet: the `ref` frame (default the first) stands `height` px tall"""
    cs = list(cells(file, gx, gy, green, clean))
    named = {n: c for n, c in zip(names, cs) if n and c is not None}
    k = height / named[ref or names[0]].shape[0]
    for n, c in named.items():
        im = Image.fromarray(c)
        FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

def fit(file, names, gx, gy, size, green=False):
    """every item scaled so its longer side is `size` (icons, portraits)"""
    for n, c in zip(names, cells(file, gx, gy, green)):
        if not n or c is None: continue
        im = Image.fromarray(c); k = size / max(im.size)
        FRAMES[n] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)

HEX_W, HEX_H = 222, 256
def hexes(file, names):
    """crop each painted hex to its alpha bounds, then stamp an exact pointy-top hexagon mask"""
    mask = Image.new('L', (HEX_W, HEX_H), 0)
    ImageDraw.Draw(mask).polygon([(HEX_W / 2, 0), (HEX_W, HEX_H / 4), (HEX_W, HEX_H * 3 / 4), (HEX_W / 2, HEX_H), (0, HEX_H * 3 / 4), (0, HEX_H / 4)], fill=255)
    for n, c in zip(names, cells(file, 4, 3)):
        if c is None: print('!! empty hex', n); continue
        im = Image.fromarray(c)
        # trim 3% so the painted edge fringe is dropped, then fill the exact hex
        tw, th = im.size; im = im.crop((round(tw * .03), round(th * .03), round(tw * .97), round(th * .97)))
        im = im.convert('RGB').resize((HEX_W, HEX_H), Image.LANCZOS).convert('RGBA')
        im.putalpha(mask)
        FRAMES[n] = im

hexes('hb-terrain1', ['t-forest', 't-forest2', 't-forest-r', 't-terrace', 't-tpotato', 't-terrace-r', 't-grass', 't-grass2', 't-grass-r', 't-scree', 't-scree2', 't-scree-r'])
hexes('hb-terrain2', ['t-snow', 't-snow2', 't-peak', 't-lake', 't-lake2', 't-reeds', 't-shore', 't-salt', 't-silver', 't-spring', 't-pass', 't-meadow'])
hexes('hb-terrain3', ['t-meadow1', 't-meadow2', 't-meadow3', 't-terrace2', 't-tpotato2', 't-grass3', 't-forest3', 't-scree3', 't-snow3', 't-salt2', 't-reeds2', 't-cave'])
# river pieces: straight segments get rotated toward each river neighbour by the scene; pools sit on the centre
grid('hb-river', ['r-seg1', 'r-seg2', 'r-seg3', 'r-seg4', 'r-pool1', 'r-pool2', 'r-mouth1', 'r-mouth2'], 4, 2, 60, ref='r-seg1')
grid('hb-villages', ['village-1', 'village-2', 'village-3', 'camp-herders', 'camp-condors', 'camp-viscachas'], 3, 2, 190, ref='village-3')
FRAMES['village-1'] = FRAMES['village-1'].resize((round(FRAMES['village-1'].width * .8), round(FRAMES['village-1'].height * .8)), Image.LANCZOS)
grid('hb-dora', ['dora-idle', 'dora-idle2', 'dora-walk1', 'dora-walk2', 'dora-walk3', 'dora-walk4', 'dora-explore', 'dora-befriend', 'dora-wave', 'dora-rest', 'dora-cheer', 'dora-face'], 4, 3, 190)
grid('hb-enzo', ['enzo-idle', 'enzo-idle2', 'enzo-walk1', 'enzo-walk2', 'enzo-walk3', 'enzo-walk4', 'enzo-found1', 'enzo-found2', 'enzo-build1', 'enzo-build2', 'enzo-advise', 'enzo-face'], 4, 3, 190)
grid('hb-settlers', ['s0-idle', 's0-walk1', 's0-walk2', 's1-idle', 's1-walk1', 's1-walk2', 's2-idle', 's2-walk1', 's2-walk2', 's-group', 's0-cheer', 's1-cold'], 4, 3, 170)
grid('hb-jobs', ['job-quinoa', 'job-potato', 'job-wool', 'job-salt', 'job-stone', 'job-silver', 'job-weave', 'job-granary', 'job-kiln', 'job-lookout', 'job-bath', 'job-chuno'], 4, 3, 170, ref='job-quinoa')
JOBK = ['quinoa', 'potato', 'wool', 'salt', 'stone', 'silver', 'weave', 'granary', 'kiln', 'lookout', 'bath', 'chuno', 'hearth', 'builder', 'basket', 'wave']
for fi, fur in enumerate(['grey', 'beige', 'dark']):
    grid(f'hb-jobs-{fur}', [f'job-{k}-{fi}' for k in JOBK], 4, 4, 170, ref=f'job-quinoa-{fi}')
grid('hb-llama', ['car-idle', 'car-walk1', 'car-walk2', 'car-walk3', 'car-walk4', 'car-trade1', 'car-trade2', 'car-rest'], 4, 2, 200)
grid('hb-neighbours', ['nb-herders', 'nb-condors', 'nb-viscachas', 'nb-herders-happy', 'nb-condors-happy', 'nb-viscachas-happy'], 3, 2, 420, ref='nb-herders')
fit('hb-portraits', ['face-herders', 'face-condors', 'face-viscachas', 'face-settler0', 'face-settler1', 'face-llama'], 3, 2, 220)
for n in ('dora-face', 'enzo-face'):
    im = FRAMES[n]; k = 220 / max(im.size); FRAMES[n] = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
grid('hb-buildings', ['b-loom', 'b-granary', 'b-kiln', 'b-lookout', 'b-bath', 'b-store'], 3, 2, 200, ref='b-loom')
fit('hb-icons', ['i-quinoa', 'i-potatoes', 'i-wool', 'i-salt', 'i-stone', 'i-silver', 'i-cloth', 'i-chuno', 'i-warmth', 'i-happy', 'i-pop', 'i-frost', 'i-dry', 'i-wet', 'i-heart', 'i-festival'], 4, 4, 96)
fit('hb-icons2', ['i-loom', 'i-granary', 'i-kiln', 'i-lookout', 'i-bath', 'i-caravan', 'i-explore', 'i-befriend', 'i-rest', 'i-found', 'i-build', 'i-end'], 4, 3, 96)

# UI pieces: blobs on one green sheet, sorted into rows, saved as single files for CSS border-image
arr = key(Image.open(SRC / 'hb-ui.png'), green=True)
lab, info = label(arr[::4, ::4, 3] > 30)
info = sorted(info, reverse=True)[:9]
Hh = arr.shape[0]
info.sort(key=lambda b: (round((b[3] + b[5]) / 2 * 4 / (Hh / 3) - .5), b[2]))
UI = ['ui-panel', 'ui-panel-sq', 'ui-banner', 'ui-btn-red', 'ui-btn-teal', 'ui-btn-round', 'ui-plaque', 'ui-ring', 'ui-meter']
UISIZE = {}
for (c, n, x1, y1, x2, y2), name in zip(info, UI):
    m = (lab == n).repeat(4, 0).repeat(4, 1)[:arr.shape[0], :arr.shape[1]]
    sub = arr.copy(); sub[~m] = 0
    im = Image.fromarray(crop(sub))
    if im.width > 900: im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6); UISIZE[name] = im.size

# plain paintings
PLAIN = {}
for f, n in (('hb-cutaway', 'bg-village'), ('hb-market', 'bg-market'), ('hb-festival', 'bg-festival')):
    im = Image.open(SRC / f'{f}.png').convert('RGB').resize((1536, 1024), Image.LANCZOS)
    im.save(OUT / f'{n}.webp', 'WEBP', quality=80, method=6); PLAIN[n] = im.size

# pack atlases
GROUPS = [('tiles', lambda n: n.startswith(('t-', 'r-'))), ('heroes', lambda n: n.startswith(('dora-', 'enzo-'))),
          ('folk', lambda n: n.startswith(('s0', 's1', 's2', 's-', 'job-', 'car-'))),
          ('places', lambda n: n.startswith(('village-', 'camp-', 'b-'))), ('nb', lambda n: n.startswith('nb-')),
          ('icons', lambda n: True)]
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
    atlas = Image.new('RGBA', (MAXW, y + rowh), (0, 0, 0, 0))
    for n in names: atlas.paste(FRAMES[n], place[n])
    atlas.save(OUT / f'atlas-{g}.webp', 'WEBP', quality=85, method=6); SIZES[g] = atlas.size
    for n in names:
        meta[n] = [gi, place[n][0], place[n][1], FRAMES[n].width, FRAMES[n].height]
    print(g, len(names), atlas.size, (OUT / f'atlas-{g}.webp').stat().st_size // 1024, 'KB')

lines = ['// Generated by scripts/highburrow-art.py from the Codex paintings; do not edit by hand.',
         '// FRAMES: name -> [atlas, x, y, w, h] in atlas pixels. Sprites stand on their bottom-centre.',
         'export const ATLASES = [' + ', '.join(f"'atlas-{g}'" for g, _ in GROUPS) + '] as const;',
         'export const FRAMES: Record<string, [number, number, number, number, number]> = {']
lines += [f"  '{n}': [{', '.join(map(str, meta[n]))}]," for n in sorted(meta)]
lines += ['};', 'export const UI: Record<string, [number, number]> = {']
lines += [f"  '{n}': [{w}, {h}]," for n, (w, h) in UISIZE.items()]
lines += ['};', 'export const PLAIN: Record<string, [number, number]> = {']
lines += [f"  '{n}': [{w}, {h}]," for n, (w, h) in PLAIN.items()]
lines += ['};', 'export const ATLAS_SIZE: Record<string, [number, number]> = {' + ', '.join(f"'atlas-{g}': [{w}, {h}]" for g, (w, h) in SIZES.items()) + '};']
lines += [f'export const HEX_ART = [{HEX_W}, {HEX_H}];']
TS.write_text('\n'.join(lines) + '\n')
print(len(meta), 'frames')
