"""Jade Street art, the twenty-sixth pass only: python3 scripts/jade-art26.py [folder of the pass's Codex sheets]
(default ~/arcade-protos/jade26-sheets). The prompts are docs/jade-street-art/jobs26.py. Keyed, cut and scaled with
scripts/jade-art.py's own functions (loaded from that file, nothing else of it runs), packed into NEW atlases and appended
to lib/jade-art.ts without touching any other entry (the full rebuild needs every older sheet, so it is not run for this
pass):
  atlas-bishan       Bishan and Ang Mo Kio's buildings (two kinds of HDB block, both MRT stations, the market and food
                     centre, a void deck, Junction 8, the bird-singing shelter, the park cafe, AMK Hub), props (the stepping
                     stones, the survey stone, the footbridge, the old stone bridge, the rain trees, the chess table, the
                     wedding dais and the bird poles among them), the otters and the kingfisher, Ah Wei's Koel Boys, his
                     four portraits and the three new properties' stands: the 'bishan' zone
  atlas-cast-bishan  the four chapter-seventeen givers' bodies and portraits, and Ah Wei's body (sheet cast26b): the
                     'bishan' zone
  atlas-act26        both heroes' Bishan actions in their Bishan outfits (the stepping-stone leap, the one-footed landing,
                     swept off by a surge; blitz chess, thinking and moving; sliding down the grassy bank): the job tier
  atlas-ui26         three map icons (the footbridge, the otters, the bird-singing corner): the job tier
plus three seamless ground textures (riverbank, amk, shallows) and two paintings (bg-chapter-17 and bg-stall-bishan).
Every sheet of this pass is painted on MAGENTA (the park, the reeds and the rain trees are green), so no cut here keys
green; at the end every new frame is checked for leftover magenta, and the zone atlases for the decoded-memory budget.
Re-runnable from the sheets alone: a second run replaces these atlases' own entries, and it refuses to run if a new frame
name already belongs to another pass's atlas.
"""
import ast, hashlib, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'arcade-protos' / 'jade26-sheets'
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'
MINE = ('atlas-bishan', 'atlas-cast-bishan', 'atlas-act26', 'atlas-ui26')

_src = (ROOT / 'scripts' / 'jade-art.py').read_text()
_mod = ast.parse(_src)
_keep = ast.Module(body=[n for n in _mod.body if isinstance(n, ast.FunctionDef) and n.name in ('key', 'cream', 'label', 'biggest', 'crop', 'seamless')], type_ignores=[])
NS = {'np': np, 'Image': Image}
exec(compile(_keep, 'jade-art.py', 'exec'), NS)
key, cream, biggest, crop, seamless = NS['key'], NS['cream'], NS['biggest'], NS['crop'], NS['seamless']
PX = 2.0  # atlas px per world unit, as in jade-art.py

GREEN_KEYED = set()  # every frame cut from a sheet keyed green (filled in by the cut calls themselves)
def cells(file, gx, gy, fix=None, keep=0.04, green=False, lo=70, hi=180, xcuts=None):
    """each cell keyed and cleaned (the biggest blob and anything a fair share of it), cropped to what is painted;
    `xcuts` (one list of gx + 1 pixel columns per row) splits a row where the painter let an item spill over the even grid"""
    arr = key(Image.open(SRC / f'{file}.png'), green, lo, hi)
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; out = []
    for j in range(gy):
        xs = xcuts[j] if xcuts else [W * i // gx for i in range(gx + 1)]
        for i in range(gx):
            out.append(crop(biggest(arr[H * j // gy:H * (j + 1) // gy, xs[i]:xs[i + 1]], keep)))
    return out

def scaled(c, k):
    im = Image.fromarray(c)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)

ATL = {}  # atlas -> {frame: image}
def put(atlas, n, im, green=False):
    ATL.setdefault(atlas, {})[n] = im
    if green: GREEN_KEYED.add(n)

def grid(atlas, file, names, gx, gy, world, ref=None, fix=None, keep=0.04, green=False):
    """one scale per sheet: the ref frame (default the first) is `world` units tall"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep, green)))
    k = world * PX / cs[ref or names[0]].shape[0]
    for n in names:
        if n: put(atlas, n, scaled(cs[n], k), green)

def each(atlas, file, names, gx, gy, sizes, keep=0.04, green=False, pairs=(), dim='w', fix=None, xcuts=None):
    """each item scaled to its own world width (or height, dim='h'); a frame named in `pairs` takes its partner's scale"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep=keep, green=green, xcuts=xcuts)))
    ks = {}
    for n in names:
        if n and n in sizes: ks[n] = sizes[n] * PX / cs[n].shape[1 if dim == 'w' else 0]
    for n, partner in pairs: ks[n] = ks[partner]
    for n in names:
        if n: put(atlas, n, scaled(cs[n], ks[n]), green)

def rect(atlas, file, names, gx, gy, sizes, fix=None, lo=70, hi=180, green=True):
    """buildings: stretched to (w, h) tiles at 1 atlas px per world unit (as jade-art.py's rect)"""
    for n, c in zip(names, cells(file, gx, gy, fix, green=green, lo=lo, hi=hi)):
        if n: w, h = sizes[n]; put(atlas, n, Image.fromarray(c).resize((w * 64, h * 64), Image.LANCZOS), green)

def unspill_green(arr):
    """a tighter green key leaves no lime fringe: pull any green that stands above red and blue back down to them"""
    a = arr.astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    a[..., 1] = np.minimum(g, np.maximum(r, b) + 12)
    return np.clip(a, 0, 255).astype(np.uint8)

def unspill_mag(arr):
    """the casuarina's hair-thin needles keep a purple fringe from the magenta key: pull any red and blue that both stand
    above green back down towards it (the sheet has no real purple: the tarpaulin is blue, the kayaks red and yellow)"""
    a = arr.astype(np.float32); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sp = np.clip(np.minimum(r, b) - g - 6, 0, None)
    a[..., 0] = r - sp; a[..., 2] = b - sp
    return np.clip(a, 0, 255).astype(np.uint8)

def registered(atlas, file, names, gx, gy, world, keep=0.04):
    """frames that the game draws on top of each other (the crocodile dozing, peeking, watching, snapping): each frame is
    shifted to lie on the first one's body (the best overlap of their silhouettes, found by FFT cross-correlation), then
    all are cut from one shared canvas, so they come out the same size with the body in the same place. Scaled so the
    first frame is `world` units wide."""
    cs = cells(file, gx, gy, keep=keep)
    S = max(max(c.shape[0] for c in cs), max(c.shape[1] for c in cs)) * 2
    def canvas(c):
        a = np.zeros((S, S, 4), np.uint8); y0 = (S - c.shape[0]) // 2; x0 = (S - c.shape[1]) // 2
        a[y0:y0 + c.shape[0], x0:x0 + c.shape[1]] = c; return a
    base = canvas(cs[0]); m0 = (base[..., 3] > 60).astype(np.float32); F0 = np.fft.fft2(m0)
    placed = [base]
    for c in cs[1:]:
        a = canvas(c); m = (a[..., 3] > 60).astype(np.float32)
        cc = np.real(np.fft.ifft2(F0 * np.conj(np.fft.fft2(m))))
        dy, dx = np.unravel_index(np.argmax(cc), cc.shape)
        dy = dy - S if dy > S // 2 else dy; dx = dx - S if dx > S // 2 else dx
        placed.append(np.roll(np.roll(a, dy, 0), dx, 1))
    al = np.max([p[..., 3] for p in placed], 0)
    ys, xs = np.where(al > 20); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    k = world * PX / cs[0].shape[1]
    for n, p in zip(names, placed): put(atlas, n, scaled(np.ascontiguousarray(p[y0:y1, x0:x1]), k))

# ── refuse to run if a new frame name belongs to another pass's atlas (the FRAMES rewrite below drops any line with one
# of this pass's names, whichever atlas it is in)
def owners(t):
    atl = [q.strip().strip("'") for q in re.search(r"export const ATLASES = \[(.*?)\] as const;", t)[1].split(',')]
    fr = t[t.index('export const FRAMES'):t.index('export const FILL')]
    return {m[1]: atl[int(m[2])] for m in re.finditer(r"^  '([^']+)': \[(\d+),", fr, re.M)}

# ── Bishan and Ang Mo Kio's buildings (footprints in lib/jade-bishan.ts; a block used at two footprints is cut at its
# commoner one and stretched by the game to the other), both sheets on magenta
rect('atlas-bishan', 'bs-bld', ['bs-amkhdb', 'bs-bshhdb', 'bs-amkstn', 'bs-market', 'bs-voiddeck', 'bs-j8'], 3, 2,
     {'bs-amkhdb': (5, 3), 'bs-bshhdb': (3, 3), 'bs-amkstn': (6, 3), 'bs-market': (5, 3), 'bs-voiddeck': (4, 3), 'bs-j8': (5, 3)}, green=False)
rect('atlas-bishan', 'bs-bld2', ['bs-bishanstn', 'bs-birdshelter', 'bs-cafe', 'bs-amkhub'], 2, 2,
     {'bs-bishanstn': (5, 3), 'bs-birdshelter': (3, 3), 'bs-cafe': (4, 2), 'bs-amkhub': (5, 3)}, green=False)
# ── props (world widths as lib/jade-bishan.ts draws them)
PA = {'bs-koelcamp': 120, 'bs-birdpole': 60, 'bs-raintree': 104, 'bs-chess': 72, 'bs-pelamin': 92, 'bs-reeds': 66}
each('atlas-bishan', 'props26a', list(PA), 3, 2, PA, fix=unspill_mag)
PB = {'bs-stonehi': 62, 'bs-stonelo': 62, 'bs-survey': 34, 'bs-cage': 36, 'bs-mee': 40, 'bs-berkat': 36, 'bs-book': 36, 'bs-feather': 36}
each('atlas-bishan', 'props26b', list(PB), 4, 2, PB)
# the footbridge (top-down, a ground layer, 140 long: measured by height, it runs up the sheet) and the old stone bridge
each('atlas-bishan', 'props26c', [None, 'bs-oldbridge'], 2, 1, {'bs-oldbridge': 120})
_fb = cells('props26c', 2, 1)[0]; put('atlas-bishan', 'bs-footbridge', scaled(_fb, 140 * PX / _fb.shape[0]))
# ── the Bishan Ten: an adult otter's bound (two frames), sat up, swimming and rolling, all at the bound's scale; the pup's
# bound at its own; the kingfisher
OT = ['bs-otter-0', 'bs-otter-1', 'bs-otter-sit', 'bs-otter-swim', 'bs-pup-0', 'bs-pup-1', 'bs-otter-roll', 'bs-kingfisher']
each('atlas-bishan', 'otters26', OT, 4, 2, {'bs-otter-0': 44, 'bs-pup-0': 26, 'bs-kingfisher': 22},
     pairs=[('bs-otter-1', 'bs-otter-0'), ('bs-otter-sit', 'bs-otter-0'), ('bs-otter-swim', 'bs-otter-0'), ('bs-otter-roll', 'bs-otter-0'), ('bs-pup-1', 'bs-pup-0')])
# ── Ah Wei's Koel Boys (the case step's guards and the runners, 'koel'), the size of the Pucong Boys' smaller cousins
grid('atlas-bishan', 'koel26', ['koel-walk-down-0', 'koel-walk-down-1', 'koel-walk-up-0', 'koel-walk-up-1',
     'koel-run-0', 'koel-run-1', 'koel-sing', 'koel-peer', 'koel-munch', 'koel-taunt', 'koel-dizzy', None], 4, 3, 46,
     ref='koel-walk-down-0', keep=0.005)
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp26-props', 4, 3)
for i, b in enumerate(('hokkienmee', 'birdkopi', 'parkhire')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-bishan', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four new givers: six standing frames each and four portraits; Ah Wei's four portraits (his body below)
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'merbok': 52, 'puyuh': 46, 'kura': 54, 'kijang': 60}
cast, faces = cells('cast26', 6, 4), cells('faces26', 4, 4)
for r, who in enumerate(('merbok', 'puyuh', 'kura', 'kijang')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-bishan', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-bishan', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))
for m, c in zip(('', '-happy', '-worried', '-cross'), cells('faces26b', 2, 2)):
    put('atlas-bishan', f'face-koel{m}', scaled(c, 256 / max(c.shape[:2])))
row = cells('cast26b', 3, 2)
k = 58 * PX / row[0].shape[0]
for p, c in zip(CAST_POSES, row): put('atlas-cast-bishan', f'npc-koel-{p}', scaled(c, k))

# ── both heroes' Bishan actions at the act scale: the one-footed landing (teeter, the sheet's second, an upright pose with
# a leg lifted) is set 56 units tall, as pass 25's upright herding walk, and every pose on the sheet shares its scale
ACTS = ['stonehop', 'teeter', 'swept', 'blitz-0', 'blitz-1', 'cartonslide']
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    cs = cells(f'{h}-act26', 3, 2, fx, keep=0.01)
    k = 56 * PX / cs[1].shape[0]
    for n, c in zip(ACTS, cs): put('atlas-act26', f'{h}-{n}', scaled(c, k))
    print(h, 'act scale', round(k, 3), 'teeter height', round(ATL['atlas-act26'][f'{h}-teeter'].height / PX, 1), 'units')

# ── the three map icons (128): the park's footbridge, the Bishan Ten's holt, the bird-singing corner. (The sheet's four
# round icons and the koel pin are not packed: nothing in the game draws a step's icon, and this atlas is always decoded)
for n, c in zip([None, None, None, None, 'mi-footbridge', 'mi-otter', 'mi-birds', None], cells('ui26', 4, 2)):
    if n: put('atlas-ui26', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: three squares of a 2 by 2 sheet (the fourth is a spare), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground26.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['riverbank', 'amk', 'shallows']
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 12)[0]; cols = np.where(lum.mean(0) > 12)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); out = Image.fromarray(seamless(cell[:s, :s].astype(np.float32)))
    out.resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-17', 'stall-bishan'):
    p = SRC / f'{n}.png'
    if not p.exists(): print('!! missing', n); continue
    Image.open(p).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PAINT['bg-' + n] = (1536, 1024)

# ── leftover key colour: no new frame may keep a patch of bright green or magenta (a sheet keyed with the wrong colour
# leaves a solid square of it in the game)
bad = []
for ATLAS, FR in ATL.items():
    for n, im in FR.items():
        q = np.array(im.convert('RGBA')).astype(int); r, g, b, al = q[..., 0], q[..., 1], q[..., 2], q[..., 3]
        vis = al > 128
        green = vis & (g > 180) & (r < 110) & (b < 110); mag = vis & (r > 200) & (b > 200) & (g < 90)
        # (a frame cut from a green sheet is checked for green and magenta; one from a magenta sheet for magenta: its
        # casuarinas, reeds and roof gardens are meant to be green)
        share = max(green.sum() if n in GREEN_KEYED else 0, mag.sum()) / max(1, vis.sum())
        if share > 0.004: bad.append((n, round(float(share), 4)))
if bad: print('!! key colour left in', bad)
else: print('key colour check: clean,', sum(len(f) for f in ATL.values()), 'frames')

# ── pack each atlas (the same shelf packing as jade-art.py), cropped to its width, and append it to lib/jade-art.ts
t = TS.read_text()
taken = {n: a for n, a in owners(t).items() if a not in MINE}
clash = sorted(n for FR in ATL.values() for n in FR if n in taken)
if clash: sys.exit(f'!! frame names already used by other passes: {[(n, taken[n]) for n in clash]}')
DEC = {}
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
    DEC[ATLAS] = atlas.width * atlas.height * 4 / 1048576
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
    print(ATLAS, gi, atlas.size, f'{DEC[ATLAS]:.1f} MB decoded,', (OUT / f'{ATLAS}.webp').stat().st_size // 1024, 'KB;', len(FR), 'frames')
# the decoded-memory budget (the game caps decoded art at 320 MB): the two zone atlases together, then each job atlas
zone = DEC['atlas-bishan'] + DEC['atlas-cast-bishan']
print(f'zone atlases {zone:.1f} MB decoded (budget 18), act {DEC["atlas-act26"]:.2f} MB (1), ui {DEC["atlas-ui26"]:.2f} MB (0.6)')
if zone > 18 or DEC['atlas-act26'] > 1 or DEC['atlas-ui26'] > 0.6: sys.exit('!! over the decoded-memory budget: lib/jade-art.ts not written')
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
