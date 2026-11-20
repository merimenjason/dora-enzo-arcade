"""Jade Street art, the sixteenth pass only: python3 scripts/jade-art16.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs16.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into five NEW small atlases and appended to lib/jade-art.ts without
touching any other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-act16          both heroes' new ride actions (the tandem toss, the ice-cream bell, the dragon boat's power
                       stroke, the sidecar's cone): the job tier
  atlas-cast16-far     Uncle Buaya's body and portraits (Orchard Road): the far east tier
  atlas-cast16-south   Coach Kerbau's body and portraits (Clarke Quay): the south shore tier
  atlas-stands16       the six fourteenth-pass properties' own stands at four levels: the south shore tier
  atlas-lake16         the bank round Jurong Lake, one ground decal: the south shore tier
and replaces tex-katong.webp with a calmer one (ground7's first square). Every atlas here is cropped to what it holds
and streams with its zone (lib/jade-load.ts), so none of it adds to the paintings decoded before play. Re-runnable: a
second run replaces these atlases' own entries.
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
_keep = ast.Module(body=[n for n in _mod.body if isinstance(n, ast.FunctionDef) and n.name in ('key', 'cream', 'label', 'biggest', 'crop', 'seamless')], type_ignores=[])
NS = {'np': np, 'Image': Image}
exec(compile(_keep, 'jade-art.py', 'exec'), NS)
key, cream, biggest, crop, seamless = NS['key'], NS['cream'], NS['biggest'], NS['crop'], NS['seamless']
PX = 2.0  # atlas px per world unit, as in jade-art.py

def cells(file, gx, gy, fix=None, keep=0.04):
    """each cell keyed and cleaned (the biggest blob and anything a fair share of it), cropped to what is painted"""
    arr = key(Image.open(SRC / f'{file}.png'))
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        for i in range(gx):
            sub = biggest(arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx], keep)
            out.append(sub)
    return out

def boxed(sub):
    ys, xs = np.where(sub[..., 3] > 20)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

def scaled(c, k):
    im = Image.fromarray(c)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

ATL = {}  # atlas -> {frame: image}
def put(atlas, n, im): ATL.setdefault(atlas, {})[n] = im

def pairs(atlas, file, names, gx, gy, world, ref, fix=None, keep=0.04):
    """two-frame cycles, each pair cut to the box both share (a rider drawn centred on its seat doesn't jump between
    frames); one scale per sheet, the ref frame `world` units tall"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep)))
    bx = {n: boxed(c) for n, c in cs.items()}
    boxes = {}
    for a in names[::2]:
        b = a[:-1] + '1'; ba, bb = bx[a], bx[b]
        u = (min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3]))
        boxes[a] = boxes[b] = u
    k = world * PX / (bx[ref][3] - bx[ref][1])
    for n in names:
        x0, y0, x1, y1 = boxes[n]; put(atlas, n, scaled(cs[n][y0:y1, x0:x1], k))

# ── both heroes' new ride actions: the same scale as their fifteenth-pass riding poses (a rider about 54 units long)
ACTS = ['toss-0', 'toss-1', 'ride-bell-0', 'ride-bell-1', 'ride-stroke-0', 'ride-stroke-1', 'serve-0', 'serve-1']
for h in ('dora', 'enzo'):
    # the parcel leaves the paw in the second toss frame: keep the small blobs (the parcel, the bell's shine)
    pairs('atlas-act16', f'{h}-act16', [f'{h}-{a}' for a in ACTS], 4, 2, 54, f'{h}-toss-0', cream if h == 'dora' else None, keep=0.01)

# ── the two new givers: six standing frames each (scaled from the idle, like jade-art.py's cast) and four portraits
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'buaya': 62, 'kerbau': 68}
cast = cells('cast16', 6, 2)
faces = cells('faces16', 4, 2)
for r, (who, atlas) in enumerate((('buaya', 'atlas-cast16-far'), ('kerbau', 'atlas-cast16-south'))):
    row = [crop(c) for c in cast[r * 6:(r + 1) * 6]]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put(atlas, f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]):
        c = crop(c); put(atlas, f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── the six stands, four levels each (shuttered, then three upgrades); drawn 150 units wide (lib/jade-setdraw.ts), so
# packed 160 px wide: about the size they show at full zoom, and a fraction of the older stands' share
for f, ids in (('emp16-props1', ('chweekueh', 'yongsiak', 'riversatay')), ('emp16-props2', ('jazzbar', 'lakeshop', 'laketea'))):
    cs = cells(f, 4, 3)
    for i, b in enumerate(ids):
        for l in range(4):
            c = crop(cs[i * 4 + l]); put('atlas-stands16', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the bank round Jurong Lake: one decal over the lake's tiles, 0.75 px a world unit (the game stretches it to the
# lake's own size; a thin ring of stones reads fine soft, and at 2 px it would decode to 11 MB)
LAKE_W, LAKE_H = 1150, 750  # world units: LAKE_BANK in lib/jade-southdraw.ts
c = crop(key(Image.open(SRC / 'lake16.png')))
put('atlas-lake16', 'lake-bank', Image.fromarray(c).resize((round(LAKE_W * 0.75), round(LAKE_H * 0.75)), Image.LANCZOS))

# ── calmer Katong ground: ground7's first square (plain cream tiles), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground7.png').convert('RGB'))
H, W = a.shape[:2]
cell = a[0:H // 2, 0:W // 3].astype(np.float32)
lum = cell.mean(-1); rows = np.where(lum.mean(1) > 18)[0]; cols = np.where(lum.mean(0) > 18)[0]
cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
s = min(cell.shape[:2]); cell = cell[:s, :s]
Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / 'tex-katong.webp', 'WEBP', quality=84, method=6)

# ── pack each atlas (the same shelf packing as jade-art.py), cropped to its width, and append it to lib/jade-art.ts
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
    print(ATLAS, gi, atlas.size, f'{atlas.width * atlas.height * 4 / 1048576:.1f} MB decoded,', (OUT / f'{ATLAS}.webp').stat().st_size // 1024, 'KB;', len(FR), 'frames')
kv = hashlib.sha256((OUT / 'tex-katong.webp').read_bytes()).hexdigest()[:10]
t = re.sub(r"'tex-katong': '\w+'", f"'tex-katong': '{kv}'", t)
TS.write_text(t)
