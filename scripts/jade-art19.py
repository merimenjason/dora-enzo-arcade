"""Jade Street art, the nineteenth pass only: python3 scripts/jade-art19.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs19.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-mandai       Mandai's buildings (Bird Paradise's aviary dome among them), props, the night animals by the trails,
                     Madam Sutera's barn-owl night watch and the three new properties' stands: the 'mandai' zone
  atlas-cast-mandai  the four chapter-twelve faces' bodies and portraits: the 'mandai' zone
  atlas-act19        both heroes' night-trail actions (creeping by torch, listening, hush, startled, feeding a lory,
                     clapping at the show, riding the tram): the job tier, as every hero frame is core or job art
  atlas-ui19         map icons, the owl pin and four round icons: the job tier
plus four seamless ground textures (resv, board, jungle, laterite) and two paintings (bg-chapter-12 and bg-stall-mandai).
Every sheet painted on GREEN (the buildings and the aviary) is keyed green in every call that cuts it; at the end every
new frame is checked for leftover bright green or magenta. Re-runnable: a second run replaces these atlases' own entries.
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

def rect(atlas, file, names, gx, gy, sizes):
    """buildings: stretched to (w, h) tiles at 1 atlas px per world unit (as jade-art.py's rect)"""
    for n, c in zip(names, cells(file, gx, gy, green=True)):
        if n: w, h = sizes[n]; put(atlas, n, Image.fromarray(c).resize((w * 64, h * 64), Image.LANCZOS))

# ── Mandai's buildings (footprints in lib/jade-mandai.ts), painted on green; the aviary dome is its own sheet
rect('atlas-mandai', 'mandai-bld', ['mnd-lodge', 'mnd-zoo', 'mnd-panda', 'safe-mandai', 'mandai-stn', 'mnd-amphi'], 3, 2,
     {'mnd-lodge': (8, 4), 'mnd-zoo': (8, 4), 'mnd-panda': (6, 4), 'safe-mandai': (3, 2), 'mandai-stn': (6, 3), 'mnd-amphi': (6, 4)})
rect('atlas-mandai', 'mandai-aviary', ['mnd-aviary'], 1, 1, {'mnd-aviary': (8, 6)})
# ── props (world widths as lib/jade-mandai.ts and lib/jade-mandaidraw.ts draw them)
PW = {'mnd-tram': 64, 'mnd-tramstop': 110, 'mnd-lantern': 40, 'mnd-stud': 26, 'mnd-bamboo': 70, 'mnd-fence': 70, 'mnd-boat': 80, 'mnd-perch': 90,
      'mnd-crate': 50, 'mnd-trig': 60, 'mnd-sextant': 50, 'mnd-torch': 36, 'mnd-bench': 70, 'mnd-platform': 120, 'mnd-nectar': 40, 'mnd-rubbing': 44}
each('atlas-mandai', 'props19', list(PW), 4, 4, PW)
# Madam Sutera's black seaplane, moored on the reservoir: the eighteenth pass's painting, in this zone's atlas too
c = cells('props18', 4, 4)[3]; put('atlas-mandai', 'mnd-seaplane', scaled(c, 170 * PX / c.shape[1]))
# ── the night animals by the trails (resting, alert with eyeshine, bolting)
grid('atlas-mandai', 'beasts19', [f'bst-{a}-{k}' for a in ('fcat', 'pango', 'porc', 'squir') for k in ('rest', 'alert', 'bolt')], 3, 4, 34, ref='bst-fcat-alert')
# ── Madam Sutera's night watch: barn owls in caps (the case and swap steps' guards, 'owl')
grid('atlas-mandai', 'owls19', ['owl-walk-down-0', 'owl-walk-down-1', 'owl-walk-up-0', 'owl-walk-up-1', 'owl-run-0', 'owl-run-1',
     'owl-sing', 'owl-peer', 'owl-munch', 'owl-taunt'], 5, 2, 50, ref='owl-walk-down-0')
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp19-props', 4, 3)
for i, b in enumerate(('safarishop', 'boardkopi', 'nectarbar')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-mandai', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four new faces: six standing frames each and four portraits
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'kongkang': 52, 'enggang': 64, 'bintu': 60, 'hantu': 64}
cast, faces = cells('cast19', 6, 4), cells('faces19', 4, 4)
for r, who in enumerate(('kongkang', 'enggang', 'bintu', 'hantu')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-mandai', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-mandai', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── both heroes' night-trail actions (the act8/act11 scale: 58 units tall, measured on the hush pose, standing)
ACTS = ['torch-0', 'torch-1', 'listen', 'hush', 'startle', 'lory', 'clap', 'tram']
for h in ('dora', 'enzo'):
    grid('atlas-act19', f'{h}-act19', [f'{h}-{a}' for a in ACTS], 4, 2, 58, ref=f'{h}-hush', fix=cream if h == 'dora' else None, keep=0.01)

# ── map icons, the owl pin, the round icons (128)
for n, c in zip(['mi-nightsafari', 'mi-aviary', 'mi-panda', 'pin-owl', 'i-torch', 'i-eyes', 'i-lory', 'i-tram'], cells('ui19', 4, 2)):
    put('atlas-ui19', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: four squares (a 2 by 2 sheet), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground19.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['resv', 'board', 'jungle', 'laterite']
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 12)[0]; cols = np.where(lum.mean(0) > 12)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); cell = cell[:s, :s]
    Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-12', 'stall-mandai'):
    p = SRC / f'{n}.png'
    if not p.exists(): print('!! missing', n); continue
    Image.open(p).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PAINT['bg-' + n] = (1536, 1024)

# ── the torches' glow was painted on magenta, so its see-through fringe came out pink: make it warm torchlight
for ATLAS, FR in ATL.items():
    for n in list(FR):
        if not ('-torch' in n or n.endswith('-listen')): continue
        q = np.array(FR[n].convert('RGBA')).astype(np.int32); r, g, b, al = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
        pink = (al > 0) & (r > 190) & (b > g + 18) & (b > 110)
        q[pink, 0] = 255; q[pink, 1] = 214; q[pink, 2] = 120
        FR[n] = Image.fromarray(q.astype(np.uint8), 'RGBA')

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
