"""Jade Street art, the twenty-third pass only: python3 scripts/jade-art23.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs23.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry:
  atlas-act23          both heroes' mangrove planting (push the seedling in, pat it down, water it, a muddy thumbs-up): the
                       job tier, as every hero frame is core or job art
  atlas-gig23-south    the plate of satay (Clarke Quay): the 'south' zone
  atlas-gig23-ubin     the mangrove seedling (Chek Jawa): the 'ubin' zone
  atlas-gig23-kallang  the cups of iced water (the Sports Hub): the 'kallang' zone
  atlas-gig23-islands  the washed-up flotsam and the lighthouse keeper's tiffin carrier: the 'islands' zone
  atlas-gig23-east     the three Kampong Glam murals: the 'east' zone
Every sheet was painted on MAGENTA (none on green); at the end every new frame is checked for leftover bright green or
magenta. Re-runnable: a second run replaces these atlases' own entries.
"""
import ast, hashlib, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'

_src = (ROOT / 'scripts' / 'jade-art.py').read_text()
_mod = ast.parse(_src)
_keep = ast.Module(body=[n for n in _mod.body if isinstance(n, ast.FunctionDef) and n.name in ('key', 'cream', 'label', 'biggest', 'crop')], type_ignores=[])
NS = {'np': np, 'Image': Image}
exec(compile(_keep, 'jade-art.py', 'exec'), NS)
key, cream, biggest, crop = NS['key'], NS['cream'], NS['biggest'], NS['crop']
PX = 2.0  # atlas px per world unit, as in jade-art.py

def cells(file, gx, gy, fix=None, keep=0.04, green=False, lo=70, hi=180):
    """each cell keyed (green only for a sheet painted on green) and cleaned, cropped to what is painted"""
    arr = key(Image.open(SRC / f'{file}.png'), green, lo, hi)
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        for i in range(gx):
            out.append(crop(biggest(arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx], keep)))
    return out

def scaled(c, k):
    im = Image.fromarray(c)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

ATL = {}
def put(atlas, n, im): ATL.setdefault(atlas, {})[n] = im

def unviolet(arr):
    """the watering-can stream was painted over magenta: its see-through fringe comes out violet; make it water"""
    a = arr.astype(np.int32); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    v = (al > 0) & (r > g + 25) & (b > g + 25)
    a[v, 0] = 150; a[v, 1] = 205; a[v, 2] = 235
    return a.astype(np.uint8)

# ── both heroes' planting (the act scale: 58 units tall, measured on the standing thumbs-up)
ACTS = ['plant-0', 'plant-1', 'plant-2', 'plant-3']
for h in ('dora', 'enzo'):
    arr = cells(f'{h}-act23', 2, 2, fix=cream if h == 'dora' else None, keep=0.01)
    k = 58 * PX / arr[3].shape[0]
    for a, c in zip(ACTS, arr): put('atlas-act23', f'{h}-{a}', scaled(unviolet(c), k))

# ── the things: carried items at 120 atlas px (as the twentieth pass's), the murals wider (drawn 112 units across)
ZONE = {'g23-satay': 'south', 'g23-seedling': 'ubin', 'g23-cup': 'kallang', 'g23-flotsam': 'islands', 'g23-tiffin': 'islands',
        'g23-mural-a': 'east', 'g23-mural-b': 'east', 'g23-mural-c': 'east'}
for n, c in zip(ZONE, cells('props23', 4, 2)):
    size = 232 if n.startswith('g23-mural') else 120
    put(f'atlas-gig23-{ZONE[n]}', n, scaled(c, size / max(c.shape[:2])))

# ── leftover key colour: no new frame may keep a patch of bright green or magenta
bad = []
for ATLAS, FR in ATL.items():
    for n, im in FR.items():
        q = np.array(im.convert('RGBA')).astype(int); r, g, b, al = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
        vis = al > 128
        green = vis & (g > 180) & (r < 110) & (b < 110); mag = vis & (r > 200) & (b > 200) & (g < 90)
        share = max(green.sum(), mag.sum()) / max(1, vis.sum())
        if share > 0.004: bad.append((n, round(float(share), 4)))
if bad: print('!! key colour left in', bad)
else: print('key colour check: clean,', sum(len(f) for f in ATL.values()), 'frames')

# ── pack each atlas (the same shelf packing as jade-art.py) and append it to lib/jade-art.ts
t = TS.read_text()
for ATLAS, FR in ATL.items():
    names = sorted(FR, key=lambda n: (-FR[n].height, n))
    MAXW = 2048; x = y = rowh = 0; place = {}; used = 0
    for n in names:
        im = FR[n]
        if x + im.width + 2 > MAXW: x = 0; y += rowh + 2; rowh = 0
        place[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height); used = max(used, x)
    atlas = Image.new('RGBA', (used, y + rowh), (0, 0, 0, 0))
    for n in names: atlas.paste(FR[n], place[n])
    atlas.save(OUT / f'{ATLAS}.webp', 'WEBP', quality=80, method=6)
    ver = hashlib.sha256((OUT / f'{ATLAS}.webp').read_bytes()).hexdigest()[:10]
    m = re.search(r"export const ATLASES = \[(.*?)\] as const;", t)
    atl = [q.strip().strip("'") for q in m[1].split(',')]
    if ATLAS not in atl: atl.append(ATLAS); t = t.replace(m[0], 'export const ATLASES = [' + ', '.join(f"'{q}'" for q in atl) + '] as const;')
    gi = atl.index(ATLAS)
    t = re.sub(r"'" + ATLAS + r"': (\[\d+, \d+\]|'\w+'), ", '', t); t = re.sub(r", '" + ATLAS + r"': (\[\d+, \d+\]|'\w+')", '', t)
    t = t.replace('export const ATLAS_SIZE: Record<string, [number, number]> = {', 'export const ATLAS_SIZE: Record<string, [number, number]> = {' + f"'{ATLAS}': [{atlas.width}, {atlas.height}], ", 1)
    lines = t.split('\n')
    mine = set(FR)
    lines = [l for l in lines if not (l.startswith("  '") and l.split("'")[1] in mine)]
    fi = lines.index('export const FRAMES: Record<string, [number, number, number, number, number]> = {')
    end = lines.index('};', fi)
    lines[end:end] = [f"  '{n}': [{gi}, {place[n][0]}, {place[n][1]}, {FR[n].width}, {FR[n].height}]," for n in sorted(FR)]
    li = lines.index('export const FILL: Record<string, number> = {')
    end = lines.index('};', li)
    lines[end:end] = [f"  '{n}': {round(float((np.array(FR[n].convert('RGBA'))[:, :, 3] > 24).mean()), 3)}," for n in sorted(FR)]
    t = '\n'.join(lines)
    t = t.replace('export const VER: Record<string, string> = {', 'export const VER: Record<string, string> = {' + f"'{ATLAS}': '{ver}', ", 1)
    print(ATLAS, gi, atlas.size, f'{atlas.width * atlas.height * 4 / 1048576:.2f} MB decoded,', (OUT / f'{ATLAS}.webp').stat().st_size // 1024, 'KB;', len(FR), 'frames')
TS.write_text(t)
