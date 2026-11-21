"""Jade Street art, the eighteenth pass only: python3 scripts/jade-art18.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs18.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-kallang       Kallang's buildings (the Sports Hub dome among them), props, the match-night fans and the three new
                      properties' stands: the 'kallang' zone
  atlas-cast-kallang  the four chapter-eleven givers' bodies and portraits: the 'kallang' zone
  atlas-act18         both heroes' match-night actions (squeezing through a crowd, shoved, the ticket, the Kallang Wave,
                      looking up at the sky): the 'kallang' zone (every one of them happens there)
  atlas-ui18          map icons, the black-swan pin and four round icons: the job tier
plus four seamless ground textures (hub, prom, apron, basin) and two paintings (bg-chapter-11 and bg-stall-kallang). Every
atlas here is cropped to what it holds; the first three stream with their zone (lib/jade-load.ts), so none of them adds to
the paintings decoded before play. Re-runnable: a second run replaces these atlases' own entries.
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

def grid(atlas, file, names, gx, gy, world, ref=None, fix=None, keep=0.04):
    """one scale per sheet: the ref frame (default the first) is `world` units tall"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep)))
    k = world * PX / cs[ref or names[0]].shape[0]
    for n in names:
        if n: put(atlas, n, scaled(cs[n], k))

def each(atlas, file, names, gx, gy, sizes, keep=0.04):
    """each item scaled to its own world width"""
    for n, c in zip(names, cells(file, gx, gy, keep=keep)):
        if n: put(atlas, n, scaled(c, sizes[n] * PX / c.shape[1]))

def rect(atlas, file, names, gx, gy, sizes):
    """buildings: stretched to (w, h) tiles at 1 atlas px per world unit (as jade-art.py's rect)"""
    for n, c in zip(names, cells(file, gx, gy, green=True)):
        if n: w, h = sizes[n]; put(atlas, n, Image.fromarray(c).resize((w * 64, h * 64), Image.LANCZOS))

# ── Kallang's buildings (footprints in lib/jade-kallang.ts); the dome is its own sheet
rect('atlas-kallang', 'kallang-bld', ['kal-airport', 'kal-indoor', 'kal-mall', 'kal-boathouse', 'safe-kallang', 'kallang-stn'], 3, 2,
     {'kal-airport': (11, 5), 'kal-indoor': (8, 8), 'kal-mall': (7, 7), 'kal-boathouse': (5, 3), 'safe-kallang': (3, 2), 'kallang-stn': (8, 4)})
rect('atlas-kallang', 'kallang-dome', ['kal-stadium'], 1, 1, {'kal-stadium': (14, 13)})
# ── props (world widths as lib/jade-kallang.ts draws them; the seaplane and the biplane are drawn by lib/jade-kallangdraw.ts)
each('atlas-kallang', 'props18', ['kal-shells', 'kal-drum', 'kal-buoy', 'kal-seaplane', 'kal-plane', 'kal-windsock', 'kal-bowser', 'kal-suitcases',
     'kal-turnstile', 'kal-floodlight', 'kal-barrier', 'kal-stage', 'kal-foodtruck', 'kal-screen', 'kal-scarf', 'kal-charts'], 4, 4,
     {'kal-shells': 120, 'kal-drum': 44, 'kal-buoy': 34, 'kal-seaplane': 170, 'kal-plane': 230, 'kal-windsock': 56, 'kal-bowser': 90, 'kal-suitcases': 50,
      'kal-turnstile': 96, 'kal-floodlight': 70, 'kal-barrier': 100, 'kal-stage': 180, 'kal-foodtruck': 120, 'kal-screen': 110, 'kal-scarf': 40, 'kal-charts': 44})
# ── the match-night fans (the crowd step's lanes, and Kallang's townsfolk, so folk frame names: the cheer is their hop)
grid('atlas-kallang', 'fans18', [f'folk-fan{s}-{k}' for s in ('bear', 'kancil', 'otter') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp18-props', 4, 3)
for i, b in enumerate(('wavekiosk', 'hubsatay', 'rowcafe')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-kallang', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four givers: six standing frames each and four portraits
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'biru': 56, 'tenuk': 62, 'kubung': 58, 'sutera': 66}
cast, faces = cells('cast18', 6, 4), cells('faces18', 4, 4)
for r, who in enumerate(('biru', 'tenuk', 'kubung', 'sutera')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-kallang', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-kallang', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── both heroes' match-night actions (the act8/act11 scale: 58 units tall)
ACTS = ['squeeze-0', 'squeeze-1', 'shoved', 'ticket-up', 'wave-0', 'wave-1', 'skyward', 'point-up']
for h in ('dora', 'enzo'):
    grid('atlas-act18', f'{h}-act18', [f'{h}-{a}' for a in ACTS], 4, 2, 58, ref=f'{h}-ticket-up', fix=cream if h == 'dora' else None, keep=0.01)

# ── map icons, the swan pin, the round icons (128)
for n, c in zip(['mi-stadium', 'mi-oldairport', 'mi-dragon', 'pin-swan', 'i-crowd', 'i-wave', 'i-ticket', 'i-seaplane'], cells('ui18', 4, 2)):
    put('atlas-ui18', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: four squares (a 2 by 2 sheet), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground18.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['hub', 'prom', 'apron', 'basin']
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 18)[0]; cols = np.where(lum.mean(0) > 18)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); cell = cell[:s, :s]
    Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-11', 'stall-kallang'):
    p = SRC / f'{n}.png'
    if not p.exists(): print('!! missing', n); continue
    Image.open(p).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PAINT['bg-' + n] = (1536, 1024)

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
