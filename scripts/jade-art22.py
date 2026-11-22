"""Jade Street art, the twenty-second pass only: python3 scripts/jade-art22.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs22.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-bukit         Bukit Timah's buildings (the old railway station, the Dairy Farm shed, the trail shelters, the
                      herbarium, the bandstand, the bungalow safe house, Beauty World and Botanic Gardens stations), the
                      Rail Corridor's truss bridge, its props (the summit marker, the survey pillar, Swan Lake's swans,
                      the orchid arches, the plant press and the specimen sheets among them), Big Kow in his safari vest
                      and the three new properties' stands: the 'bukit' zone
  atlas-cast-bukit    the three chapter-fourteen faces' bodies and portraits: the 'bukit' zone
  atlas-act22         both heroes' hill actions (stepping up the trail, winded, resting on a log, arms up at the summit,
                      a snack snatched, shooing a macaque, reading a specimen): the job tier, as every hero frame is core
                      or job art
  atlas-ui22          map icons, the macaque pin and four round icons: the job tier
plus four seamless ground textures (summit, lawn, railbed, swan) and two paintings (bg-chapter-14 and bg-stall-bukit).
Every sheet painted on GREEN (the buildings and the two stations) is keyed green in every call that cuts it; at the end
every new frame is checked for leftover bright green or magenta. Re-runnable: a second run replaces these atlases' own
entries. (The macaques are the twelfth pass's: atlas-sg2.)
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

def cells(file, gx, gy, fix=None, keep=0.04, green=False, lo=70, hi=180):
    """each cell keyed and cleaned (the biggest blob and anything a fair share of it), cropped to what is painted"""
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

ATL = {}  # atlas -> {frame: image}
def put(atlas, n, im): ATL.setdefault(atlas, {})[n] = im

def grid(atlas, file, names, gx, gy, world, ref=None, fix=None, keep=0.04, green=False):
    """one scale per sheet: the ref frame (default the first) is `world` units tall"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep, green)))
    k = world * PX / cs[ref or names[0]].shape[0]
    for n in names:
        if n: put(atlas, n, scaled(cs[n], k))

def each(atlas, file, names, gx, gy, sizes, keep=0.04, green=False):
    """each item scaled to its own world width"""
    for n, c in zip(names, cells(file, gx, gy, keep=keep, green=green)):
        if n: put(atlas, n, scaled(c, sizes[n] * PX / c.shape[1]))

def rect(atlas, file, names, gx, gy, sizes, fix=None, lo=70, hi=180):
    """buildings: stretched to (w, h) tiles at 1 atlas px per world unit (as jade-art.py's rect)"""
    for n, c in zip(names, cells(file, gx, gy, fix, green=True, lo=lo, hi=hi)):
        if n: w, h = sizes[n]; put(atlas, n, Image.fromarray(c).resize((w * 64, h * 64), Image.LANCZOS))

def unspill_green(arr):
    """a tighter green key leaves no lime fringe: pull any green that stands above red and blue back down to them"""
    a = arr.astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)
    return np.clip(a, 0, 255).astype(np.uint8)

def cut(box):
    """clear a region of the keyed sheet (x0, y0, x1, y1 in sheet px): a painted light beam the game draws itself"""
    def f(arr):
        arr = arr.copy(); x0, y0, x1, y1 = box; arr[y0:y1, x0:x1] = 0; return arr
    return f

def chain(*fs):
    def f(arr):
        for g in fs: arr = g(arr)
        return arr
    return f

def unspill_edge(arr):
    """the Botanic Gardens station's roof is a planted lawn, painted on a green screen: pull the lime fringe out of the
    see-through edge only, so the roof stays green"""
    a = arr.astype(np.float32); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    e = al < 250
    a[..., 1] = np.where(e, np.minimum(g, np.maximum(r, b) + 12), g)
    return np.clip(a, 0, 255).astype(np.uint8)

# ── Bukit Timah's buildings (footprints in lib/jade-bukit.ts), painted on green and keyed tight (no lime fringe on the
# white walls); the two MRT stations are their own sheet (the Botanic Gardens one keyed looser: its roof is a lawn)
rect('atlas-bukit', 'bukit-bld', ['bkt-station', 'bkt-bandstand', 'bkt-herbarium', 'bkt-safe', 'bkt-dairy', 'bkt-shelter'], 3, 2,
     {'bkt-station': (6, 3), 'bkt-bandstand': (2, 2), 'bkt-herbarium': (6, 3), 'bkt-safe': (4, 2), 'bkt-dairy': (6, 2), 'bkt-shelter': (3, 2)},
     fix=unspill_green, lo=45, hi=150)
rect('atlas-bukit', 'bukit-stn', ['bkt-stn-beauty', 'bkt-stn-botanic'], 2, 1, {'bkt-stn-beauty': (4, 3), 'bkt-stn-botanic': (3, 2)}, fix=unspill_edge, lo=120, hi=200)
# ── the Rail Corridor's steel truss bridge (lib/jade-bukit.ts lays it 6.2 tiles wide over the road from Jurong)
each('atlas-bukit', 'bukit-bridge', ['bkt-bridge'], 1, 1, {'bkt-bridge': 6.2 * 64})
# ── props (world widths as lib/jade-bukit.ts and lib/jade-bukitdraw.ts draw them, and the jobs' carried things)
PW = {'bkt-summit': 64, 'bkt-trig': 50, 'bkt-signpost': 46, 'bkt-boulder': 56, 'bkt-swan': 46, 'bkt-orchid-arch': 86, 'bkt-orchid-urn': 46, 'bkt-bench': 60,
      'bkt-press': 36, 'bkt-specimen': 30, 'bkt-track': 120, 'bkt-signal': 44, 'bkt-snack': 26, 'bkt-bananas': 30, 'bkt-bin': 40, 'bkt-theodolite': 40}
each('atlas-bukit', 'props22', list(PW), 4, 4, PW)
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp22-props', 4, 3)
for i, b in enumerate(('beautyworld', 'orchidshop', 'railbikes')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-bukit', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the three new faces and Big Kow in his safari vest: six standing frames each; portraits for the three (Kow keeps
# his own portrait, face-kow, in atlas-folk)
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'tenggiling': 54, 'lotong': 60, 'merbah': 56, 'kow22': 62}
cast, faces = cells('cast22', 6, 4), cells('faces22', 4, 4)
for r, who in enumerate(('tenggiling', 'lotong', 'merbah', 'kow22')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-bukit' if who != 'kow22' else 'atlas-bukit', f'npc-{who}-{p}', scaled(c, k))
    if who == 'kow22': continue
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-bukit', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── both heroes' hill actions (the act8/act11 scale: 58 units tall, measured on the standing snack-snatched pose)
ACTS = ['hike-0', 'hike-1', 'winded', 'rest', 'summit', 'snatched', 'scare', 'specimen']
for h in ('dora', 'enzo'):
    grid('atlas-act22', f'{h}-act22', [f'{h}-{a}' for a in ACTS], 4, 2, 58, ref=f'{h}-snatched', fix=cream if h == 'dora' else None, keep=0.01)

# ── map icons, the macaque pin, the round icons (128)
for n, c in zip(['mi-bukit', 'mi-bandstand', 'mi-truss', 'pin-mac', 'i-breath', 'i-orchid', 'i-specimen', 'i-boot'], cells('ui22', 4, 2)):
    put('atlas-ui22', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: four squares (a 2 by 2 sheet), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground22.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['summit', 'lawn', 'railbed', 'swan']
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 12)[0]; cols = np.where(lum.mean(0) > 12)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); cell = cell[:s, :s]
    Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-14', 'stall-bukit'):
    p = SRC / f'{n}.png'
    if not p.exists(): print('!! missing', n); continue
    Image.open(p).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PAINT['bg-' + n] = (1536, 1024)

GREEN_KEYED = {'bkt-station', 'bkt-bandstand', 'bkt-herbarium', 'bkt-safe', 'bkt-dairy', 'bkt-shelter', 'bkt-stn-beauty', 'bkt-stn-botanic'}
# ── leftover key colour: no new frame may keep a patch of bright green or magenta (a sheet keyed with the wrong colour
# leaves a solid square of it in the game)
bad = []
for ATLAS, FR in ATL.items():
    for n, im in FR.items():
        q = np.array(im.convert('RGBA')).astype(int); r, g, b, al = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
        vis = al > 128
        green = vis & (g > 180) & (r < 110) & (b < 110); mag = vis & (r > 200) & (b > 200) & (g < 90)
        # (a frame cut from a green sheet is checked for green and magenta; one from a magenta sheet for magenta: its
        # palm leaves and jade-green paint are meant to be there)
        share = max(green.sum() if n in GREEN_KEYED else 0, mag.sum()) / max(1, vis.sum())
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
# the textures and paintings: their versions and sizes
m = re.search(r"export const TEXTURES = \[(.*?)\] as const;", t)
tx = [q.strip().strip("'") for q in m[1].split(',')]
for n in TEXN:
    if n not in tx: tx.append(n)
t = t.replace(m[0], 'export const TEXTURES = [' + ', '.join(f"'{q}'" for q in tx) + '] as const;')
for n in TEXN:
    v = hashlib.sha256((OUT / f'tex-{n}.webp').read_bytes()).hexdigest()[:10]
    t = re.sub(r"'tex-" + n + r"': '\w+', ", '', t)
    t = t.replace('export const VER: Record<string, string> = {', 'export const VER: Record<string, string> = {' + f"'tex-{n}': '{v}', ", 1)
for n, (w, h) in PAINT.items():
    v = hashlib.sha256((OUT / f'{n}.webp').read_bytes()).hexdigest()[:10]
    t = re.sub(r"'" + n + r"': '\w+', ", '', t); t = re.sub(r"'" + n + r"': \[\d+, \d+\], ", '', t)
    t = t.replace('export const VER: Record<string, string> = {', 'export const VER: Record<string, string> = {' + f"'{n}': '{v}', ", 1)
    t = t.replace('export const PLAIN: Record<string, [number, number]> = {', 'export const PLAIN: Record<string, [number, number]> = {' + f"'{n}': [{w}, {h}], ", 1)
TS.write_text(t)
