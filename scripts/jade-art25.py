"""Jade Street art, the twenty-fifth pass only: python3 scripts/jade-art25.py [folder of the pass's Codex sheets]
(default ~/arcade-protos/jade25-sheets). The prompts are docs/jade-street-art/jobs25.py. Keyed, cut and scaled with
scripts/jade-art.py's own functions (loaded from that file, nothing else of it runs), packed into NEW atlases and appended
to lib/jade-art.ts without touching any other entry (the full rebuild needs every older sheet, so it is not run for this
pass):
  atlas-punggol       Punggol and Coney Island's buildings (two HDB blocks, the MRT entrance under the LRT viaduct, the
                      seafood kopitiam, the void-deck flat, the old tide-gauge house, the ruined beach villa, the Lorong
                      Halus research hut, the kayak hire kiosk), props (the red footbridge and Madam Sutera's junk among
                      them), the Brahman cattle (five frames of one cow at one scale), the calf, otters, hornbills and the
                      owl, Abang Pucong's Pucong Boys, his three portraits and the three new properties' stands: the
                      'punggol' zone
  atlas-cast-punggol  the four chapter-sixteen givers' bodies and portraits, and Abang Pucong's body (sheet cast25b):
                      the 'punggol' zone
  atlas-act25         both heroes' Punggol actions in their Punggol outfits (herding a cow: two walk frames, crouched still,
                      thrown back as it bolts; fishing off the jetty: casting, a fish on; the herd walk's two frames
                      from their own sheet, dora-herd25 / enzo-herd25): the job tier
  atlas-ui25          three round icons (the tide icon is pass 21's i-tide), three map icons and the heron pin:
                      the job tier
plus three seamless ground textures (marsh, needles, pgdeck) and two paintings (bg-chapter-16 and bg-stall-punggol).
Every sheet of this pass is painted on MAGENTA (roof gardens, vines, casuarinas, reeds and teal accents are green), so no
cut here keys green; at the end every new frame is checked for leftover bright green or magenta, and the zone atlases for
the decoded-memory budget. Re-runnable from the sheets alone: a second run replaces these atlases' own entries, and it
refuses to run if a new frame name already belongs to another pass's atlas.
"""
import ast, hashlib, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'arcade-protos' / 'jade25-sheets'
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'
MINE = ('atlas-punggol', 'atlas-cast-punggol', 'atlas-act25', 'atlas-ui25')

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

# ── Punggol and Coney Island's buildings (footprints in lib/jade-punggol.ts), both sheets on magenta
rect('atlas-punggol', 'pg-bld', ['pg-hdb', 'pg-hdb2', 'pg-stn', 'pg-kopitiam', 'pg-flat', 'pg-kiosk'], 3, 2,
     {'pg-hdb': (4, 3), 'pg-hdb2': (4, 3), 'pg-stn': (3, 2), 'pg-kopitiam': (4, 3), 'pg-flat': (3, 2), 'pg-kiosk': (2, 2)}, green=False)
rect('atlas-punggol', 'pg-bld2', ['pg-gauge', 'pg-villa', 'pg-hut', None], 2, 2,
     {'pg-gauge': (2, 2), 'pg-villa': (3, 2), 'pg-hut': (3, 2)}, green=False)
# ── props (world widths as lib/jade-punggol.ts draws them)
PA = {'pg-camp': 110, 'pg-casuarina': 92, 'pg-reeds': 70, 'pg-kayaks': 90, 'pg-bikerack': 90, 'pg-gate': 70}
each('atlas-punggol', 'props25a', list(PA), 3, 2, PA, fix=unspill_mag)
# the casuarina has no blue or purple of its own (grey-green needles, a brown trunk), but its hair-thin needle tips keep a
# blue-violet tinge after the unspill: wherever blue stands above green, blue and red are pulled down to the green
_c = np.array(ATL['atlas-punggol']['pg-casuarina']).astype(np.int16); _r, _g, _b = _c[..., 0], _c[..., 1], _c[..., 2]
_m = _b > _g + 4; _c[..., 2] = np.where(_m, _g + 4, _b); _c[..., 0] = np.where(_m, np.minimum(_r, _g), _r)
ATL['atlas-punggol']['pg-casuarina'] = Image.fromarray(np.clip(_c, 0, 255).astype(np.uint8))
PB = {'pg-bench': 62, 'pg-tidestaff': 40, 'pg-post': 40, 'pg-trough': 60, 'pg-page': 36, 'pg-plate': 36, 'pg-crab': 40, 'pg-register': 40}
# (the trough's lip reaches past the even grid into the survey post's cell: each row is split at the gaps between items)
each('atlas-punggol', 'props25b', list(PB), 4, 2, PB, xcuts=[[0, 400, 780, 1062, 1536], [0, 370, 740, 1150, 1536]])
# the red footbridge (top-down, a ground layer, 140 wide) and Madam Sutera's junk (200 wide), on a sheet of two
PC = {'pg-redbridge': 140, 'pg-junk': 200}
each('atlas-punggol', 'props25c', list(PC), 2, 1, PC)
# ── the Brahman cattle: five frames of one cow, all at the walk's scale (about 110 units long); then the calf, otters,
# hornbills and owl, each animation pair at one scale
COWS = ['pg-cow-walk-0', 'pg-cow-walk-1', 'pg-cow-look', 'pg-cow-graze', 'pg-cow-bolt', None]
each('atlas-punggol', 'cows25', COWS, 3, 2, {'pg-cow-walk-0': 110},
     pairs=[(n, 'pg-cow-walk-0') for n in COWS[1:] if n])
# the cow's walk pair repainted on its own sheet (cowwalk25: cows25 put the same legs forward in both): brought to cows25's
# scale by height (the same pose, so the same height as cows25's walk frame)
if (SRC / 'cowwalk25.png').exists():
    c0 = cells('cows25', 3, 2)[0]; k = 110 * PX / c0.shape[1]
    w0, w1 = cells('cowwalk25', 2, 1)
    k *= c0.shape[0] / ((w0.shape[0] + w1.shape[0]) / 2)
    put('atlas-punggol', 'pg-cow-walk-0', scaled(w0, k)); put('atlas-punggol', 'pg-cow-walk-1', scaled(w1, k))
BW = {'pg-calf-0': 70, 'pg-otter-0': 40, 'pg-hornbill-0': 40, 'pg-owl': 30}
each('atlas-punggol', 'beasts25', ['pg-calf-0', 'pg-calf-1', 'pg-otter-0', 'pg-otter-1', 'pg-hornbill-0', 'pg-hornbill-1', 'pg-owl', None],
     4, 2, BW, pairs=[('pg-calf-1', 'pg-calf-0'), ('pg-otter-1', 'pg-otter-0'), ('pg-hornbill-1', 'pg-hornbill-0')])
# ── Abang Pucong's Pucong Boys (the case and swap steps' guards, 'pucong'), a little taller than the Mudskipper Boys
grid('atlas-punggol', 'pucong25', ['pucong-walk-down-0', 'pucong-walk-down-1', 'pucong-walk-up-0', 'pucong-walk-up-1',
     'pucong-run-0', 'pucong-run-1', 'pucong-sing', 'pucong-peer', 'pucong-munch', 'pucong-taunt', 'pucong-dizzy', None], 4, 3, 52,
     ref='pucong-walk-down-0', keep=0.005)  # (a low keep, so the dizzy frame's little stars stay)
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp25-props', 4, 3)
for i, b in enumerate(('crabhouse', 'coneykiosk', 'kayakhire')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-punggol', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four new givers: six standing frames each and four portraits; Abang Pucong's three portraits (his body below)
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'pekaka': 56, 'bubut': 58, 'tempua': 48, 'berang': 54}
cast, faces = cells('cast25', 6, 4), cells('faces25', 4, 4)
for r, who in enumerate(('pekaka', 'bubut', 'tempua', 'berang')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-punggol', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-punggol', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))
for m, c in zip(('', '-happy', None, '-cross'), cells('faces25b', 2, 2)):
    if m is not None: put('atlas-punggol', f'face-pucong{m}', scaled(c, 256 / max(c.shape[:2])))
# Abang Pucong's six standing frames (cast25b, a 3 by 2 grid, painted after his portraits), in the cast atlas, 66 tall
row = cells('cast25b', 3, 2)
k = 66 * PX / row[0].shape[0]
for p, c in zip(CAST_POSES, row): put('atlas-cast-punggol', f'npc-pucong-{p}', scaled(c, k))

# ── both heroes' Punggol actions at the act scale. None of the six poses is a plain standing pose, so the upright herding
# walk (herd-0, from the six-pose sheet) is set 56 units tall, a touch under pass 24's standing goat-feeding pose (58),
# and every pose on the sheet shares its scale (carrying pass 24's scale over by the pink inner-ear areas came out 67
# units for Dora and 38 for Enzo: the two sheets' ears differ too much to measure by)
ACTS = ['herd-0', 'herd-1', 'herd-still', 'herd-bolt', 'fish-0', 'fish-1']
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    cs = cells(f'{h}-act25', 3, 2, fx, keep=0.01)
    k = 56 * PX / cs[0].shape[0]
    for n, c in zip(ACTS, cs): put('atlas-act25', f'{h}-{n}', scaled(c, k))
    # the herd walk's two frames repainted on their own (the six-pose sheet put the same leg forward in both): a stride and
    # a passing pose, brought to the six-pose sheet's scale by the stride's height (the same pose as its herd-0)
    if (SRC / f'{h}-herd25.png').exists():
        w0, w1 = cells(f'{h}-herd25', 2, 1, fx, keep=0.01)
        kk = k * cs[0].shape[0] / w0.shape[0]
        put('atlas-act25', f'{h}-herd-0', scaled(w0, kk)); put('atlas-act25', f'{h}-herd-1', scaled(w1, kk))
    print(h, 'act scale', round(k, 3), 'herd-0 height', round(ATL['atlas-act25'][f'{h}-herd-0'].height / PX, 1), 'units')

# ── four round icons, three map icons and the heron pin (128)
# (the tide-staff icon, the sheet's third, is not packed: 'i-tide' already belongs to atlas-ui21, pass 21's wave icon, and
# the code uses that one)
for n, c in zip(['i-cow', 'i-fish', None, 'i-page', 'mi-coney', 'mi-jetty', 'mi-halus', 'pin-pucong'], cells('ui25', 4, 2)):
    if n: put('atlas-ui25', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: three squares of a 2 by 2 sheet (the fourth is a spare), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground25.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['marsh', 'needles', 'pgdeck']
PERIODIC = {'pgdeck'}
def period(prof, lo=12):
    """a repeating pattern's period in px: the strongest autocorrelation peak of a mean brightness profile"""
    p = prof - prof.mean(); ac = np.correlate(p, p, 'full')[len(p) - 1:]
    return lo + int(np.argmax(ac[lo:len(p) // 2]))
def periodic(cell):
    """the deck boards and paver bands are regular: cut a whole number of repeats each way (about 480 px) so the tile
    repeats by itself; seamless()'s cross-fade would leave half-faded ghost bands"""
    lum = cell.mean(-1); py, px = period(lum.mean(1)), period(lum.mean(0))
    ny, nx = max(1, round(480 / py)), max(1, round(480 / px))
    while ny * py > cell.shape[0]: ny -= 1
    while nx * px > cell.shape[1]: nx -= 1
    return Image.fromarray(cell[:ny * py, :nx * px].astype(np.uint8))
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 12)[0]; cols = np.where(lum.mean(0) > 12)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    if n in PERIODIC: out = periodic(cell)
    else: s = min(cell.shape[:2]); out = Image.fromarray(seamless(cell[:s, :s].astype(np.float32)))
    out.resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-16', 'stall-punggol'):
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
zone = DEC['atlas-punggol'] + DEC['atlas-cast-punggol']
print(f'zone atlases {zone:.1f} MB decoded (budget 18), act {DEC["atlas-act25"]:.2f} MB (1), ui {DEC["atlas-ui25"]:.2f} MB (0.6)')
if zone > 18 or DEC['atlas-act25'] > 1 or DEC['atlas-ui25'] > 0.6: sys.exit('!! over the decoded-memory budget: lib/jade-art.ts not written')
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
