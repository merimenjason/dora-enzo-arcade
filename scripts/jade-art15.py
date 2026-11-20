"""Jade Street art, the fifteenth pass only: python3 scripts/jade-art15.py <folder of the pass's Codex sheets>
The four new rides (rides15.png) and both heroes' riding poses for them ({dora,enzo}-ride15a.png and -ride15b.png;
the prompts are docs/jade-street-art/jobs15.py) are keyed, cut and scaled with scripts/jade-art.py's own functions
(loaded from that file, nothing else of it runs), packed into one NEW atlas, public/art/jade-street/atlas-rides15.webp,
and appended to lib/jade-art.ts without touching any other entry. The full rebuild (scripts/jade-art.py) needs every
older sheet, so it is not run for this pass. Re-runnable: a second run replaces this atlas's own entries.
"""
import ast, hashlib, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'
ATLAS = 'atlas-rides15'

# jade-art.py's keying, Dora's cream fur fix, and its blob cutting: just those function definitions
_src = (ROOT / 'scripts' / 'jade-art.py').read_text()
_mod = ast.parse(_src)
_keep = ast.Module(body=[n for n in _mod.body if isinstance(n, ast.FunctionDef) and n.name in ('key', 'cream', 'label', 'biggest', 'crop')], type_ignores=[])
NS = {'np': np, 'Image': Image}
exec(compile(_keep, 'jade-art.py', 'exec'), NS)
key, cream, biggest = NS['key'], NS['cream'], NS['biggest']
PX = 2.0  # atlas px per world unit, as in jade-art.py

def cells(file, gx, gy, fix=None):
    """each cell keyed and cleaned (biggest blob), with the box of what is painted in it (cell coordinates)"""
    arr = key(Image.open(SRC / f'{file}.png'))
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        for i in range(gx):
            sub = biggest(arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx])
            ys, xs = np.where(sub[..., 3] > 20)
            out.append((sub, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)) if len(ys) else None)
    return out

FRAMES = {}
def put(n, c, k):
    im = Image.fromarray(c)
    FRAMES[n] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

def pairs(file, names, gx, gy, world, ref, fix=None):
    """a sheet of two-frame cycles: each pair is cut to the box both frames share, so a rider drawn centred on its seat
    doesn't jump between frames; one scale per sheet (the ref frame is `world` units tall)"""
    cs = dict(zip(names, cells(file, gx, gy, fix)))
    for n, c in cs.items(): assert c is not None, f'{file}: {n} is empty'
    boxes = {}
    for a in names[::2]:
        b = a[:-1] + '1'; (_, ba), (_, bb) = cs[a], cs[b]
        u = (min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3]))
        boxes[a] = boxes[b] = u
    k = world * PX / (cs[ref][1][3] - cs[ref][1][1])
    for n in names:
        x0, y0, x1, y1 = boxes[n]; put(n, cs[n][0][y0:y1, x0:x1], k)

# ── the rides, empty, top-down and facing up: each scaled to its own length (world units), like 'vehicles' (v-bike 52)
for n, c in zip(['v-tandem', 'v-icecream', 'v-luge', 'v-dragon'], cells('rides15', 4, 1)):
    sub, (x0, y0, x1, y1) = c
    put(n, sub[y0:y1, x0:x1], {'v-tandem': 124, 'v-icecream': 84, 'v-luge': 58, 'v-dragon': 210}[n] * PX / (y1 - y0))
# ── both heroes' riding poses, two-frame cycles; one scale per sheet, a little under the hired bike's rider (59 tall), so the longer rides show round them
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    pairs(f'{h}-ride15a', [f'{h}-ride-tandem-0', f'{h}-ride-tandem-1', f'{h}-tandem-back-0', f'{h}-tandem-back-1', f'{h}-ride-moto-0', f'{h}-ride-moto-1', f'{h}-sidecar-0', f'{h}-sidecar-1'], 4, 2, 54, f'{h}-ride-tandem-0', fx)
    pairs(f'{h}-ride15b', [f'{h}-ride-luge-0', f'{h}-ride-luge-1', f'{h}-ride-paddle-0', f'{h}-ride-paddle-1', f'{h}-drum-0', f'{h}-drum-1'], 3, 2, 54, f'{h}-ride-paddle-0', fx)

# ── pack (the same shelf packing as jade-art.py)
names = sorted(FRAMES, key=lambda n: (-FRAMES[n].height, n))
MAXW = 2048; x = y = rowh = 0; place = {}
for n in names:
    im = FRAMES[n]
    if x + im.width + 2 > MAXW: x = 0; y += rowh + 2; rowh = 0
    place[n] = (x, y); x += im.width + 2; rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (MAXW, y + rowh), (0, 0, 0, 0))
for n in names: atlas.paste(FRAMES[n], place[n])
atlas.save(OUT / f'{ATLAS}.webp', 'WEBP', quality=80, method=6)
ver = hashlib.sha256((OUT / f'{ATLAS}.webp').read_bytes()).hexdigest()[:10]

# ── append to lib/jade-art.ts: the atlas at the end of ATLASES (its index is computed, so a later pass can follow),
# its size and hash, and each frame's place and painted share; this atlas's own old entries go first
t = TS.read_text()
m = re.search(r"export const ATLASES = \[(.*?)\] as const;", t)
atl = [a.strip().strip("'") for a in m[1].split(',')]
if ATLAS not in atl: atl.append(ATLAS); t = t.replace(m[0], 'export const ATLASES = [' + ', '.join(f"'{a}'" for a in atl) + '] as const;')
gi = atl.index(ATLAS)
# this atlas's own size and hash entries from an earlier run go first, wherever they sit in their objects
t = re.sub(r"'" + ATLAS + r"': (\[\d+, \d+\]|'\w+'), ", '', t); t = re.sub(r", '" + ATLAS + r"': (\[\d+, \d+\]|'\w+')", '', t)
t = t.replace('export const ATLAS_SIZE: Record<string, [number, number]> = {', 'export const ATLAS_SIZE: Record<string, [number, number]> = {' + f"'{ATLAS}': [{atlas.width}, {atlas.height}], ", 1)
lines = t.split('\n')
mine = set(FRAMES)
lines = [l for l in lines if not (l.startswith("  '") and l.split("'")[1] in mine)]
fi = lines.index('export const FRAMES: Record<string, [number, number, number, number, number]> = {')
end = lines.index('};', fi)
lines[end:end] = [f"  '{n}': [{gi}, {place[n][0]}, {place[n][1]}, {FRAMES[n].width}, {FRAMES[n].height}]," for n in sorted(FRAMES)]
li = lines.index('export const FILL: Record<string, number> = {')
end = lines.index('};', li)
lines[end:end] = [f"  '{n}': {round(float((np.array(FRAMES[n].convert('RGBA'))[:, :, 3] > 24).mean()), 3)}," for n in sorted(FRAMES)]
t = '\n'.join(lines)
t = t.replace('export const VER: Record<string, string> = {', 'export const VER: Record<string, string> = {' + f"'{ATLAS}': '{ver}', ", 1)
TS.write_text(t)
print(ATLAS, gi, atlas.size, (OUT / f'{ATLAS}.webp').stat().st_size // 1024, 'KB;', len(FRAMES), 'frames:', ', '.join(f'{n} {FRAMES[n].size}' for n in sorted(FRAMES)))
