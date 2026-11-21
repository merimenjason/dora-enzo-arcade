"""Jade Street art, a polish on the nineteenth pass: python3 scripts/jade-art19b.py <folder of lory19b.png, perch19b.png>
The prompts are docs/jade-street-art/jobs19b.py: Bird Paradise's perched rainbow lorikeets in six poses (perched side on
and facing, preening, wings half open side on and facing, bobbing to nibble) and the feeding perch again, bare. Keyed, cut
and scaled with scripts/jade-art.py's own functions (loaded from that file, nothing else of it runs) and packed into ONE
new atlas appended to lib/jade-art.ts without touching any other entry:
  atlas-lory19b      the lorikeets and the bare perch: the 'mandai' zone (lib/jade-load.ts), never core
Both sheets are painted on MAGENTA and keyed magenta in every call that cuts them (the birds are bright green, so a green
key would eat them). After packing every new frame is checked for leftover magenta or chroma green at pass 19's
threshold. The lorikeets' own grass-green feathers trip the green half of that check (under one percent of a frame, all
inside the wings, checked by eye on a marked-up render): the birds are green, so that is expected, not leftover key.
Re-runnable: a second run replaces this atlas's own entries. The round icon i-lory (atlas-ui19) stays for the interface.
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

def cells(file, gx, gy, fix=None, keep=0.04, green=False):
    """each cell keyed and cleaned (the biggest blob and anything a fair share of it), cropped to what is painted"""
    arr = key(Image.open(SRC / f'{file}.png'), green)
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        for i in range(gx):
            out.append(crop(biggest(arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx], keep)))
    return out

def scaled(c, k):
    im = Image.fromarray(c)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

ATL = {}  # atlas -> {frame: image}
def put(atlas, n, im): ATL.setdefault(atlas, {})[n] = im

# ── the lorikeets: one scale for the sheet, the perched bird facing the camera 30 world units tall (the painted birds on
# the perch prop are about that size)
LORY = ['mnd-lory-perch', 'mnd-lory-front', 'mnd-lory-preen', 'mnd-lory-wings', 'mnd-lory-wings-front', 'mnd-lory-bob']
cs = dict(zip(LORY, cells('lory19b', 3, 2, green=False)))
k = 30 * PX / cs['mnd-lory-front'].shape[0]
for n in LORY: put('atlas-lory19b', n, scaled(cs[n], k)); print(n, cs[n].shape[:2], '->', ATL['atlas-lory19b'][n].size)

# the feeding perch again, bare (the prop sheet's perch has three birds painted on it): 90 world units wide like mnd-perch,
# which stays in atlas-mandai as it was
c = cells('perch19b', 1, 1)[0]; put('atlas-lory19b', 'mnd-perch-bare', scaled(c, 90 * PX / c.shape[1])); print('mnd-perch-bare', c.shape[:2], '->', ATL['atlas-lory19b']['mnd-perch-bare'].size)
LORY.append('mnd-perch-bare')

# no frame name may already belong to another atlas (a re-run replaces this atlas's own)
_t = TS.read_text(); _atl = re.search(r"export const ATLASES = \[(.*?)\] as const;", _t)[1].replace("'", '').replace(' ', '').split(',')
for n in LORY:
    m = re.search(r"^  '" + re.escape(n) + r"': \[(\d+),", _t, re.M)
    if m and _atl[int(m[1])] != 'atlas-lory19b': sys.exit(f'!! {n} already exists in {_atl[int(m[1])]}')

# ── leftover key colour: no new frame may keep a patch of bright green or magenta (a sheet keyed with the wrong colour
# leaves a solid square of it in the game)
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
TS.write_text(t)
