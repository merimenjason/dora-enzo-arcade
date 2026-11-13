"""Above & Below art pipeline: python3 scripts/above-art.py <folder of Codex paintings>

Every sheet is painted by Codex (see docs/above-and-below-art/jobs.txt for the prompts) on flat magenta (#FF00FF), or
flat green (#00FF00) for the critters and Old Grubber. This script keys the ground colour to transparency (pulling the
magenta cast back out of grey fur, so Enzo stays grey), cuts each sheet's grid into frames (keeping the biggest blob in
each cell), scales each sheet so its reference frame stands at its world height, finds each frame's anchor (the head
for the heroes, the centre of mass for the rest), shelf-packs WebP atlases into public/art/above-and-below/ and writes
lib/above-art.ts. The four room paintings and the soil tile are saved as plain WebP.
Run it with the user's python3 (numpy and Pillow), not with -I.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
SRC = Path(sys.argv[1])
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/art/above-and-below'; TS = ROOT / 'lib/above-art.ts'
OUT.mkdir(parents=True, exist_ok=True)
PX = 1.6   # atlas px per world unit

def key(im, green=False, lo=40, hi=170):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    if green: m = g - np.maximum(r, b); M = np.array([0, 255, 0], np.float32)
    else: m = np.minimum(r, b) - g; M = np.array([255, 0, 255], np.float32)
    al = np.clip(1 - (m - lo) / (hi - lo), 0, 1); k = al > 0.03
    f = (a - (1 - al[..., None]) * M) / np.maximum(al[..., None], 0.03)
    out = np.zeros(a.shape[:2] + (4,), np.float32)
    out[..., :3] = np.clip(np.where(k[..., None], f, 0), 0, 255); out[..., 3] = al * 255; out[~k] = 0
    rgb = out[..., :3]
    if green:
        sp = np.clip(rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2]), 0, None); rgb[..., 1] -= sp
    else:
        sp = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None); rgb[..., 0] -= sp; rgb[..., 2] -= sp
    # soften the 1px fringe
    out[..., 3] = np.where(out[..., 3] < 25, 0, out[..., 3])
    return out.astype(np.uint8)

def blobs(sub):
    """keep the largest blob and any big neighbour (drops leaked fragments)"""
    q = sub[::4, ::4, 3] > 30; h, w = q.shape
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
                        if 0 <= yy < h and 0 <= xx < w and q[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; st.append((yy, xx))
            sizes[n] = c
    if not sizes: return sub
    keep = [k for k, v in sizes.items() if v >= max(sizes.values()) * 0.04]
    km = np.isin(lab, keep); p = np.pad(km, 3); d = np.zeros_like(p)
    for dy in range(-3, 4):
        for dx in range(-3, 4): d |= np.roll(np.roll(p, dy, 0), dx, 1)
    mask = d[3:-3, 3:-3].repeat(4, 0).repeat(4, 1)[:sub.shape[0], :sub.shape[1]]
    sub = sub.copy(); sub[~mask] = 0; return sub

def crop(sub):
    ys, xs = np.where(sub[..., 3] > 20)
    if len(ys) == 0: return None
    return sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

FR = {}
def grid(file, names, gx, gy, ref, world, green=False, dim='h', anchor='mass', clean=True):
    p = SRC / f'{file}.png'
    if not p.exists(): print('-- missing', file); return
    arr = key(Image.open(p), green); H, W = arr.shape[:2]; cells = {}
    for j in range(gy):
        for i in range(gx):
            n = names[j * gx + i]
            if not n: continue
            sub = arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx]
            if clean: sub = blobs(sub)
            c = crop(sub)
            if c is None: print('!! empty', file, n); continue
            cells[n] = c
    r = cells[ref]; k = world * PX / (r.shape[0] if dim == 'h' else r.shape[1])
    for n, c in cells.items():
        if n.startswith('_'): continue
        im = Image.fromarray(c); w2, h2 = max(1, round(c.shape[1] * k)), max(1, round(c.shape[0] * k))
        im = im.resize((w2, h2), Image.LANCZOS); a = np.asarray(im)
        al = a[..., 3].astype(np.float32)
        if anchor == 'head':
            top = al[: max(4, int(h2 * 0.35))]; cols = top.sum(0)
        else: cols = al.sum(0)
        cs = np.cumsum(cols); ax = float(np.searchsorted(cs, cs[-1] / 2)) if cs[-1] else w2 / 2
        FR[n] = (im, ax, h2)

D, E = 118, 118
grid('dora1', ['d_idle', 'd_walk1', 'd_walk2', 'd_jump', 'd_climb1', 'd_climb2', 'd_pull1', 'd_pull2', 'd_stamp1', 'd_stamp2', 'd_duck', 'd_hurt'], 4, 3, 'd_idle', D, anchor='head')
grid('dora2', ['_d2', 'd_walk3', 'd_walk4', 'd_land', 'd_win1', 'd_win2', 'd_wait1', 'd_wait2', 'd_point', 'd_call', 'd_blink', 'd_face'], 4, 3, '_d2', D, anchor='head')
grid('enzo1', ['e_idle', 'e_walk1', 'e_walk2', 'e_jump', 'e_dig1', 'e_dig2', 'e_heave1', 'e_heave2', 'e_water', 'e_ride', 'e_hurt', 'e_win1'], 4, 3, 'e_idle', E, anchor='head')
grid('enzo2', ['_e2', 'e_walk3', 'e_walk4', 'e_land', 'e_win2', 'e_duck', 'e_wait1', 'e_wait2', 'e_point', 'e_call', 'e_climb', 'e_face'], 4, 3, '_e2', E, anchor='head')
grid('props', ['sluice0', 'sluice1', 'leaf', 'root', 'cup', 'flag', 'broken', 'boulder', 'door0', 'door1', 'shrooms', 'worm'], 4, 3, 'sluice0', 108)
grid('sapling', ['sap1', 'sap2', 'sap3'], 3, 1, 'sap3', 185)
grid('critters', ['bug_idle', 'bug_hiss', 'bug_squint', 'bug_ball', 'hawk1', 'hawk2', 'hawk3', 'hawk4'], 4, 2, 'bug_idle', 74, green=True)
# chapter one: second props sheet, Old Grubber, third hero sheets
grid('props2', ['rootlog', 'pulley', 'ropepost', 'gate', 'portc', 'bush', 'mound', 'burst', 'chin', 'hdoor0', 'hdoor1', 'turf'], 4, 3, 'gate', 130)
grid('grubber', ['g_idle', 'g_wind', 'g_swipe', 'g_dig', 'g_up', 'g_dizzy', 'g_bonk', 'g_roar', 'g_yawn', 'g_sleep', 'g_nose', 'g_face'], 4, 3, 'g_idle', 340, green=True, dim='w')
grid('dora3', ['_d3', 'd_rope1', 'd_rope2', 'd_lever', 'd_hide', 'd_dodge', 'd_tired', 'd_wave'], 4, 2, '_d3', D, anchor='head')
grid('enzo3', ['_e3', 'e_rope1', 'e_rope2', 'e_hold', 'e_dust', 'e_dodge', 'e_tired', 'e_wave'], 4, 2, '_e3', E, anchor='head')
# per-frame overrides of world size (props of different scale on the same sheet)
SIZE = {'leaf': ('w', 120), 'root': ('h', 150), 'cup': ('h', 24), 'flag': ('w', 64), 'broken': ('w', 76), 'boulder': ('w', 50),
        'door0': ('h', 112), 'door1': ('h', 112), 'shrooms': ('h', 40), 'worm': ('h', 26),
        'hawk1': ('w', 190), 'hawk2': ('w', 190), 'hawk3': ('w', 190), 'hawk4': ('w', 190), 'd_face': ('h', 64), 'e_face': ('h', 64),
        'rootlog': ('w', 160), 'pulley': ('h', 120), 'ropepost': ('h', 110), 'portc': ('h', 156), 'bush': ('w', 130), 'mound': ('w', 150),
        'burst': ('w', 240), 'chin': ('w', 70), 'hdoor0': ('h', 150), 'hdoor1': ('h', 150), 'turf': ('w', 110), 'g_face': ('h', 64)}
for n, (dm, v) in SIZE.items():
    if n not in FR: continue
    im, ax, h = FR[n]; w0, h0 = im.size; k = v * PX / (h0 if dm == 'h' else w0)
    im2 = im.resize((max(1, round(w0 * k)), max(1, round(h0 * k))), Image.LANCZOS); FR[n] = (im2, ax * k, im2.size[1])

# shelf pack, one atlas group per prefix so each file stays small
NEW3 = {'d_rope1', 'd_rope2', 'd_lever', 'd_hide', 'd_dodge', 'd_tired', 'd_wave', 'e_rope1', 'e_rope2', 'e_hold', 'e_dust', 'e_dodge', 'e_tired', 'e_wave'}
P2 = {'rootlog', 'pulley', 'ropepost', 'gate', 'portc', 'bush', 'mound', 'burst', 'chin', 'hdoor0', 'hdoor1', 'turf'}
def group(n):
    if n in NEW3: return 'h'
    if n in P2: return 'q'
    if n.startswith('g_'): return 'g' if n in ('g_idle', 'g_wind', 'g_swipe', 'g_dig', 'g_up', 'g_face') else 'k'
    return 'd' if n.startswith('d_') else 'e' if n.startswith('e_') else 'c' if n.startswith(('bug', 'hawk')) else 'p'
AW = 1400; sheets = []; meta = {}; files = []
for gname in ['d', 'e', 'p', 'c', 'h', 'q', 'g', 'k']:
    names = sorted([n for n in FR if group(n) == gname], key=lambda n: -FR[n][0].size[1])
    if not names: continue
    s = {'img': Image.new('RGBA', (AW, 3000), (0, 0, 0, 0)), 'x': 0, 'y': 0, 'rh': 0, 'maxy': 0, 'mx': 0}
    for n in names:
        im, ax, h = FR[n]; w, hh = im.size
        if s['x'] + w + 2 > AW: s['x'] = 0; s['y'] += s['rh'] + 2; s['rh'] = 0
        s['img'].paste(im, (s['x'], s['y'])); meta[n] = [len(files), s['x'], s['y'], w, hh, round(ax, 1)]
        s['x'] += w + 2; s['rh'] = max(s['rh'], hh); s['maxy'] = max(s['maxy'], s['y'] + hh); s['mx'] = max(s['mx'], s['x'])
    f = f'atlas-{gname}.webp'; s['img'].crop((0, 0, s['mx'], s['maxy'])).save(OUT / f, 'WEBP', quality=84, method=6); files.append(f)
# background + soil tile
for b in ['bg', 'bg2', 'bg3', 'bg4']: Image.open(SRC / f'{b}.png').convert('RGB').save(OUT / f'{b}.webp', 'WEBP', quality={'bg': 80, 'bg2': 70}.get(b, 78), method=6)
Image.open(SRC / 'soil.png').convert('RGB').resize((256, 256), Image.LANCZOS).save(OUT / 'soil.webp', 'WEBP', quality=82)
lines = ['// Generated by scripts/above-art.py from the Codex paintings; do not edit by hand.',
         '// FRAMES: name -> [atlas, x, y, w, h, anchor x], in atlas pixels; PX atlas pixels make one world unit.',
         '// A frame is drawn with its bottom edge at the feet and its anchor at the x.',
         f'export const PX = {PX};',
         'export const ATLASES = ' + json.dumps(files) + ';',
         "export const ROOM_ART = ['bg', 'bg2', 'bg3', 'bg4', 'soil'];",
         'export const FRAMES: Record<string, [number, number, number, number, number, number]> = {']
for n in sorted(meta): lines.append(f"  '{n}': {json.dumps(meta[n])},")
lines.append('};')
TS.write_text('\n'.join(lines) + '\n')
for f in sorted(OUT.iterdir()): print(f.name, f.stat().st_size // 1024, 'KB')
print(len(meta), 'frames')
