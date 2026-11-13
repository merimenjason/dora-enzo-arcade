"""After Dark art packer: python3 art.py
Keys every Codex sheet in arcade-art/raw that is listed below (magenta #FF00FF, or green #00FF00 for violet things),
pulls the ground's cast back out of grey fur, cuts the grid (cuts found from alpha bounds: each cell keeps its biggest
blob, cropped tight), scales each sheet so its reference frame stands at a set world height, packs one WebP atlas per
sheet into arcade/img/ and merges the frames into arcade/img/art.js (same format: name -> [atlas, x, y, w, h, ax, ay]).
Sheets that are not painted yet are skipped, so the game keeps its fallbacks. Plain paintings (backgrounds) are saved
as WebP and listed under ART.images. Keying follows dora-enzo-arcade-salt/scripts/brinelight-art.py.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path('/Users/jasonchua/arcade-protos')
RAW = ROOT / 'arcade-art/raw'
IMG = ROOT / 'arcade/img'
ARTJS = IMG / 'art.js'
src = ARTJS.read_text()
ART = json.loads(src[src.index('{'):src.rindex('}') + 1])
PX = ART['PX']
o = (ROOT / 'arcade-art/art.js.orig').read_text(); ORIG = json.loads(o[o.index('{'):o.rindex('}') + 1])['frames']
ART['frames'].update(ORIG)

def key(im, green=False, lo=40, hi=170):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green: m = g - np.maximum(r, b); M = np.array([0, 255, 0], np.float32)
    else: m = np.minimum(r, b) - g; M = np.array([255, 0, 255], np.float32)
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
    else:   # magenta cast on grey fur: pull it back to neutral
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None); rgb[..., 0] -= sp; rgb[..., 2] -= sp
    out[out[..., 3] < 25] = 0
    return out.astype(np.uint8)

def blobs(q):
    h, w = q.shape; lab = np.zeros((h, w), np.int32); n = 0; sizes = {}
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
    return lab, sizes

def biggest(sub):
    q = sub[::4, ::4, 3] > 30
    lab, sizes = blobs(q)
    if not sizes: return sub
    keep = [k for k, v in sizes.items() if v >= max(sizes.values()) * 0.04]
    km = np.isin(lab, keep); p = np.pad(km, 3); d = np.zeros_like(p)
    for dy in range(-3, 4):
        for dx in range(-3, 4): d |= np.roll(np.roll(p, dy, 0), dx, 1)
    mask = d[3:-3, 3:-3].repeat(4, 0).repeat(4, 1)[:sub.shape[0], :sub.shape[1]]
    sub = sub.copy(); sub[~mask] = 0
    return sub

def cuts(profile, n):
    """split a 1-D alpha profile into n bands at the emptiest gaps near the even cut lines"""
    L = len(profile); out = [0]
    for i in range(1, n):
        c = L * i // n; r = L // (n * 3)
        seg = profile[c - r:c + r]
        out.append(c - r + int(np.argmin(seg)))
    out.append(L); return out

def crop(sub):
    ys, xs = np.where(sub[..., 3] > 20)
    if len(ys) == 0: return None
    return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

def anchor_x(a, mode):
    al = a[..., 3].astype(np.float32)
    cols = (al[:max(4, int(a.shape[0] * .3))] if mode == 'head' else al).sum(0)
    if cols.sum() == 0: return a.shape[1] / 2
    c = np.cumsum(cols); return float(np.searchsorted(c, c[-1] / 2))

def frame_h(name):
    f = ART['frames'].get(name); return f[4] / PX if f else None

# file, names (row-major, None = skip, '_x' = scale reference only), cols, rows, ref, world height (or existing frame
# whose height to match), green, anchor ('head' for heroes: feet at the bottom, head centred; 'mass'; 'center')
H = lambda n: ('match', n)
SHEETS = [
    ('dora-cloud', [f'dora-cloud-{n}' for n in ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'jump', 'fall', 'glide1', 'glide2', 'ride', 'gust', 'ability']], 4, 3, 'dora-cloud-idle', H('dora-hub-idle'), False, 'head'),
    ('enzo-cloud', [f'enzo-cloud-{n}' for n in ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'jump', 'fall', 'glide1', 'glide2', 'ride', 'gust', 'ability']], 4, 3, 'enzo-cloud-idle', H('enzo-hub-idle'), False, 'head'),
    ('dora-cloud2', ['_dc2'] + [f'dora-cloud-{n}' for n in ['reach', 'dive', 'hurt', 'win', 'gustw', 'brace', 'land']], 4, 2, '_dc2', H('dora-hub-idle'), False, 'head'),
    ('enzo-cloud2', ['_ec2'] + [f'enzo-cloud-{n}' for n in ['reach', 'dive', 'hurt', 'win', 'gustw', 'brace', 'land']], 4, 2, '_ec2', H('enzo-hub-idle'), False, 'head'),
    ('dora-hubx', ['_dh'] + [f'dora-hub-{n}' for n in ['gustw', 'gust', 'brace', 'awe', 'down']], 3, 2, '_dh', H('dora-hub-idle'), False, 'head'),
    ('enzo-hubx', ['_eh'] + [f'enzo-hub-{n}' for n in ['gustw', 'gust', 'brace', 'awe', 'down']], 3, 2, '_eh', H('enzo-hub-idle'), False, 'head'),
    ('dora-seax', ['_ds'] + [f'dora-sea-{n}' for n in ['gustw', 'gust', 'tumble']], 2, 2, '_ds', H('dora-sea-tread1'), False, 'head'),
    ('enzo-seax', ['_es'] + [f'enzo-sea-{n}' for n in ['gustw', 'gust', 'tumble']], 2, 2, '_es', H('enzo-sea-tread1'), False, 'head'),
    ('dora-castlex', ['_dk'] + [f'dora-castle-{n}' for n in ['gustw', 'gust', 'hang']], 2, 2, '_dk', H('dora-castle-idle'), False, 'head'),
    ('enzo-castlex', ['_ek'] + [f'enzo-castle-{n}' for n in ['gustw', 'gust', 'hang']], 2, 2, '_ek', H('enzo-castle-idle'), False, 'head'),
    ('giant', ['g-idle1', 'g-idle2', 'g-raise', 'g-slam', 'g-roar', 'g-flinch', 'g-scatter', 'g-reform', 'g-stagger', 'g-dissolve', 'g-core', 'g-minion'], 4, 3, 'g-idle1', 430, True, 'mass'),
    ('cloud-props', ['terrace-long', 'terrace-mid', 'disc', 'puff', 'cvent', 'ped-gust', 'ped-empty', 'storm', 'wheel', 'arch', 'flag', 'balloon'], 4, 3, 'ped-gust', 230, False, 'mass'),
    ('castle-wall', ['wall-tall', 'wall-tall-door'], 2, 1, 'wall-tall', 760, False, 'mass'),
    ('castle-props2', ['chandelier', 'web-big', 'web-small', 'brazier', 'brazier-lit', 'ledge-long', 'ledge-short', 'portcullis', 'kchest', 'kchest-open', 'pillar-c', 'books'], 4, 3, 'brazier', 120, False, 'mass'),
    ('armour', ['arm-walk1', 'arm-walk2', 'arm-turn', 'arm-dazed'], 2, 2, 'arm-walk1', 190, False, 'mass'),
    ('sea-props2', ['jellyp1', 'jellyp2', 'jelly-dim', 'mound', 'arch-sunk', 'crystal', 'crystal-lit', 'bigclam', 'bigclam-open', 'rock-ledge', 'kelp-tall', 'mast'], 4, 3, 'jellyp1', 110, False, 'mass'),
    ('ui2', ['ico-gust', 'btn-gust', 'ico-pearl', 'ico-glide', 'ico-clock', 'ico-static'], 3, 2, 'ico-gust', 120, False, 'center'),
    ('pearls', ['pearl', 'pearl-shell', 'pearl-gold', 'pearl-bubble'], 2, 2, 'pearl', 46, False, 'center'),
]
PAINTINGS = {'cloud-bg': (1536, 1024)}

def cut_sheet(file, names, gx, gy, green):
    arr = key(Image.open(RAW / f'{file}.png'), green)
    al = arr[..., 3] > 30
    ys = cuts(al.sum(1).astype(float), gy)
    cells = {}
    for j in range(gy):
        band = arr[ys[j]:ys[j + 1]]
        xs = cuts((band[..., 3] > 30).sum(0).astype(float), gx)
        for i in range(gx):
            n = names[j * gx + i] if j * gx + i < len(names) else None
            if not n: continue
            c = crop(biggest(band[:, xs[i]:xs[i + 1]]))
            if c is None: print('  !! empty', file, n); continue
            cells[n] = c
    return cells

def pack(cells, k, anchor):
    """scale by k, shelf-pack into one atlas; returns (atlas image, {name: [x,y,w,h,ax,ay]})"""
    ims = {}
    for n, c in cells.items():
        im = Image.fromarray(c); w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
        ims[n] = im.resize((w, h), Image.LANCZOS)
    W = 4096 if sum(i.width * i.height for i in ims.values()) > 2048 * 2048 else 2048; x = y = rowh = 0; pos = {}
    for n, im in sorted(ims.items(), key=lambda t: -t[1].height):
        if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
        pos[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
    at = Image.new('RGBA', (W, y + rowh))
    out = {}
    for n, im in ims.items():
        at.paste(im, pos[n])
        a = np.asarray(im)
        ax = im.width / 2 if anchor == 'center' else anchor_x(a, anchor)
        ay = im.height / 2 if anchor == 'center' else im.height
        out[n] = [pos[n][0], pos[n][1], im.width, im.height, round(ax, 1), round(ay, 1)]
    return at, out

only = set(sys.argv[1:])
for file, names, gx, gy, ref, world, green, anchor in SHEETS:
    if only and file not in only: continue
    if not (RAW / f'{file}.png').exists(): print('-- waiting on art:', file); continue
    cells = cut_sheet(file, names, gx, gy, green)
    if ref not in cells: print('!! no ref frame in', file); continue
    wh = frame_h(world[1]) if isinstance(world, tuple) else world
    if wh is None: wh = 165
    k = wh * PX / cells[ref].shape[0]
    cells = {n: c for n, c in cells.items() if not n.startswith('_')}
    at, fr = pack(cells, k, anchor)
    at.save(IMG / f'atlas-{file}.webp', quality=88, method=6)
    for n, v in fr.items():
        if n in ORIG and ORIG[n][0] != file: print('  !! name clash, skipped', n); continue
        ART['frames'][n] = [file] + v
    if file not in ART['atlases']: ART['atlases'].append(file)
    print(f'ok {file}: {len(fr)} frames, atlas {at.size}')
for n, size in PAINTINGS.items():
    if only and n not in only: continue
    p = RAW / f'{n}.png'
    if not p.exists(): print('-- waiting on art:', n); continue
    im = Image.open(p).convert('RGB').resize(size, Image.LANCZOS); im.save(IMG / f'{n}.webp', quality=86, method=6)
    ART['images'][n] = list(size); print('ok painting', n)
ARTJS.write_text('window.ART = ' + json.dumps(ART) + ';\n')
print('art.js:', len(ART['frames']), 'frames,', len(ART['atlases']), 'atlases')
