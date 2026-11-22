"""Jade Street art, the twenty-fourth pass only: python3 scripts/jade-art24.py [folder of the pass's Codex sheets]
(default ~/arcade-protos/jade24-sheets). The prompts are docs/jade-street-art/jobs24.py. Keyed, cut and scaled with
scripts/jade-art.py's own functions (loaded from that file, nothing else of it runs), packed into NEW atlases and appended
to lib/jade-art.ts without touching any other entry (the full rebuild needs every older sheet, so it is not run for this
pass):
  atlas-kranji        Kranji and Woodlands' buildings (the Sungei Buloh visitor centre and bird hide, Woodlands Checkpoint,
                      the frog farm, the goat barn, the orchid greenhouse, an HDB block, the kopitiam, the void-deck flat,
                      the MRT entrance) and the Kranji War Memorial, props, the wetland's and the farms' animals, the
                      basking crocodile's four registered frames, Madam Sutera's limousine and a Malaysian lorry, Bos
                      Belacak's Mudskipper Boys, Belacak's three portraits (a fifth face would need a third face row in the
                      cast atlas) and the three new properties' stands: the 'kranji' zone
  atlas-cast-kranji   the four chapter-fifteen givers' bodies and portraits, and Bos Belacak's body (sheet cast24b):
                      the 'kranji' zone
  atlas-act24         both heroes' Kranji actions in wellies and bucket hats (wading the mud, frozen still by a crocodile,
                      scrambling back, feeding a goat, bowing at the memorial): the job tier
  atlas-ui24          four round icons, three map icons and the mudskipper pin: the job tier
plus four seamless ground textures (mudflat, mangrove, field, woods) and two paintings (bg-chapter-15 and bg-stall-kranji).
Every sheet painted on GREEN (two building sheets: no green subject on either) is keyed green in every call that cuts it;
every green subject (mangroves, nipa, hedges, vegetables, frogs, the crocodile, frangipani) is on a magenta sheet. At the end
every new frame is checked for leftover bright green or magenta, and the zone atlases for the decoded-memory budget.
Re-runnable from the sheets alone: a second run replaces these atlases' own entries, and it refuses to run if a new frame
name already belongs to another pass's atlas.
"""
import ast, hashlib, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'arcade-protos' / 'jade24-sheets'
OUT = ROOT / 'public' / 'art' / 'jade-street'
TS = ROOT / 'lib' / 'jade-art.ts'
MINE = ('atlas-kranji', 'atlas-cast-kranji', 'atlas-act24', 'atlas-ui24')

_src = (ROOT / 'scripts' / 'jade-art.py').read_text()
_mod = ast.parse(_src)
_keep = ast.Module(body=[n for n in _mod.body if isinstance(n, ast.FunctionDef) and n.name in ('key', 'cream', 'label', 'biggest', 'crop', 'seamless')], type_ignores=[])
NS = {'np': np, 'Image': Image}
exec(compile(_keep, 'jade-art.py', 'exec'), NS)
key, cream, biggest, crop, seamless = NS['key'], NS['cream'], NS['biggest'], NS['crop'], NS['seamless']
PX = 2.0  # atlas px per world unit, as in jade-art.py

GREEN_KEYED = set()  # every frame cut from a sheet keyed green (filled in by the cut calls themselves)
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
def put(atlas, n, im, green=False):
    ATL.setdefault(atlas, {})[n] = im
    if green: GREEN_KEYED.add(n)

def grid(atlas, file, names, gx, gy, world, ref=None, fix=None, keep=0.04, green=False):
    """one scale per sheet: the ref frame (default the first) is `world` units tall"""
    cs = dict(zip(names, cells(file, gx, gy, fix, keep, green)))
    k = world * PX / cs[ref or names[0]].shape[0]
    for n in names:
        if n: put(atlas, n, scaled(cs[n], k), green)

def each(atlas, file, names, gx, gy, sizes, keep=0.04, green=False, pairs=(), dim='w'):
    """each item scaled to its own world width (or height, dim='h'); a frame named in `pairs` takes its partner's scale"""
    cs = dict(zip(names, cells(file, gx, gy, keep=keep, green=green)))
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

# ── Kranji and Woodlands' buildings (footprints in lib/jade-kranji.ts). The first sheet (visitor centre, checkpoint,
# hide, barn) and the memorial are on green and keyed tight (no lime fringe on the white concrete); the second (the frog
# farm's frog sign, the greenhouse's plants, the teal HDB block, the MRT sign) is on magenta
rect('atlas-kranji', 'kranji-bld', ['kr-visitor', 'kr-checkpoint', 'kr-hide', 'kr-barn'], 2, 2,
     {'kr-visitor': (5, 3), 'kr-checkpoint': (6, 4), 'kr-hide': (3, 2), 'kr-barn': (4, 3)}, fix=unspill_green, lo=45, hi=150)
rect('atlas-kranji', 'kranji-bld2', ['kr-frogfarm', 'kr-greenhouse', 'kr-hdb', 'kr-kopitiam', 'kr-flat', 'kr-stn'], 3, 2,
     {'kr-frogfarm': (4, 3), 'kr-greenhouse': (4, 3), 'kr-hdb': (4, 3), 'kr-kopitiam': (4, 3), 'kr-flat': (3, 2), 'kr-stn': (2, 2)}, green=False)
rect('atlas-kranji', 'kranji-memorial', ['kr-memorial'], 1, 1, {'kr-memorial': (6, 3)}, fix=unspill_green, lo=45, hi=150)
# ── props (world widths as lib/jade-kranji.ts draws them; the rest as the drawn scene will)
PA = {'kr-graves': 150, 'kr-camp': 104, 'kr-sluice': 96, 'kr-mangrove': 92, 'kr-nipa': 80, 'kr-roots': 80}
each('atlas-kranji', 'props24a', list(PA), 3, 2, PA)
PB = {'kr-post': 46, 'kr-bench': 62, 'kr-fence': 66, 'kr-veg': 88, 'kr-hedge': 70, 'kr-flower': 50, 'kr-wreath': 30, 'kr-hay': 40,
      'kr-tin': 22, 'kr-ringbook': 22, 'kr-kopi': 30}
each('atlas-kranji', 'props24b', list(PB) + [None], 4, 3, PB)
# ── the wetland's and the farms' animals, real animals; each animation pair shares one scale
BW = {'kr-skipper-0': 20, 'kr-lizard-0': 72, 'kr-owl': 22, 'kr-whimbrel-0': 30, 'kr-whimbrel-1': 30, 'kr-whimbrel-fly-0': 46,
      'kr-goat-0': 54, 'kr-frog-0': 18}
each('atlas-kranji', 'beasts24', ['kr-skipper-0', 'kr-skipper-1', 'kr-lizard-0', 'kr-lizard-1', 'kr-owl',
     'kr-whimbrel-0', 'kr-whimbrel-1', 'kr-whimbrel-fly-0', 'kr-whimbrel-fly-1', None,
     'kr-goat-0', 'kr-goat-1', 'kr-frog-0', 'kr-frog-1', None], 5, 3, BW,
     pairs=[('kr-skipper-1', 'kr-skipper-0'), ('kr-lizard-1', 'kr-lizard-0'), ('kr-whimbrel-fly-1', 'kr-whimbrel-fly-0'),
            ('kr-goat-1', 'kr-goat-0'), ('kr-frog-1', 'kr-frog-0')])
# ── the basking crocodile: four registered frames, about 2.3 tiles long
registered('atlas-kranji', 'croc24', ['kr-croc-doze', 'kr-croc-peek', 'kr-croc-watch', 'kr-croc-snap'], 2, 2, 147)
# ── Madam Sutera's limousine and a Malaysian lorry, nose up like the traffic sheet's car-mint (109 x 160 px) and about as
# wide as it (a car's width), so each comes out longer than it, as a limousine and a lorry are
each('atlas-kranji', 'cars24', ['kr-car-sutera', 'kr-lorry'], 2, 1, {'kr-car-sutera': 54, 'kr-lorry': 58})
# ── Bos Belacak's Mudskipper Boys (the case and swap steps' guards, 'skipper'), the crab crew's scale
grid('atlas-kranji', 'skippers24', ['skipper-walk-down-0', 'skipper-walk-down-1', 'skipper-walk-up-0', 'skipper-walk-up-1',
     'skipper-run-0', 'skipper-run-1', 'skipper-sing', 'skipper-peer', 'skipper-munch', 'skipper-taunt'], 5, 2, 46, ref='skipper-walk-down-0')
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp24-props', 4, 3)
for i, b in enumerate(('farmstall', 'kiosk', 'bikehire')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-kranji', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four new givers: six standing frames each and four portraits; Bos Belacak's three portraits (his body below)
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'kedidi': 60, 'biawak': 62, 'katak': 52, 'kambing': 62}
cast, faces = cells('cast24', 6, 4), cells('faces24', 4, 4)
for r, who in enumerate(('kedidi', 'biawak', 'katak', 'kambing')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-kranji', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-kranji', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))
for m, c in zip(('', '-happy', None, '-cross'), cells('faces24b', 2, 2)):
    if m is not None: put('atlas-kranji', f'face-belacak{m}', scaled(c, 256 / max(c.shape[:2])))
# Bos Belacak's six standing frames, painted on their own sheet (cast24b, a 3 by 2 grid) after his portraits: in the cast
# atlas with the four givers, his idle frame as tall as Pak Biawak's
if (SRC / 'cast24b.png').exists():
    row = cells('cast24b', 3, 2)
    k = 62 * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-kranji', f'npc-belacak-{p}', scaled(c, k))

# ── both heroes' Kranji actions (wellies, bucket hat) at the act scale: the standing goat-feeding pose 58 units tall, as
# pass 21's standing look-out (the ears, not the hat, are still the top of the head). The mud wade's two frames come from
# their own sheet when it exists (the six-pose sheet lifted the same boot in both). That sheet was painted bigger, so it is
# brought to the six-pose sheet's scale by the size of the heroes' pink inner ears (steady from pose to pose)
ACTS = ['mud-wade-0', 'mud-wade-1', 'mud-freeze', 'mud-scramble', 'goatfeed', 'bow']
def pink(file, gx, gy):
    a = np.asarray(Image.open(SRC / f'{file}.png').convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return ((r > 200) & (g > 120) & (g < 205) & (b > 110) & (b < 195) & (r - g > 35) & (abs(g - b) < 45)).sum() / (gx * gy)
for h in ('dora', 'enzo'):
    fx = cream if h == 'dora' else None
    grid('atlas-act24', f'{h}-act24', [f'{h}-{a}' for a in ACTS], 3, 2, 58, ref=f'{h}-goatfeed', fix=fx, keep=0.01)
    if (SRC / f'{h}-wade24.png').exists():
        k = ATL['atlas-act24'][f'{h}-goatfeed'].height / cells(f'{h}-act24', 3, 2, fx, keep=0.01)[4].shape[0]
        k *= (pink(f'{h}-act24', 3, 2) / pink(f'{h}-wade24', 2, 1)) ** 0.5
        w0, w1 = cells(f'{h}-wade24', 2, 1, fx, keep=0.01)
        put('atlas-act24', f'{h}-mud-wade-0', scaled(w0, k)); put('atlas-act24', f'{h}-mud-wade-1', scaled(w1, k))

# ── four round icons, three map icons and the mudskipper pin (128)
for n, c in zip(['i-ring', 'i-croc', 'i-whimbrel', 'i-frog', 'mi-buloh', 'mi-memorial', 'mi-causeway', 'pin-skipper'], cells('ui24', 4, 2)):
    put('atlas-ui24', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: four squares (a 2 by 2 sheet), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground24.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['mudflat', 'mangrove', 'field', 'woods']
PERIODIC = {'field', 'woods'}
def period(prof, lo=12):
    """a repeating pattern's period in px: the strongest autocorrelation peak of a mean brightness profile"""
    p = prof - prof.mean(); ac = np.correlate(p, p, 'full')[len(p) - 1:]
    return lo + int(np.argmax(ac[lo:len(p) // 2]))
def periodic(cell):
    """the paving bands and the furrows are regular: cut a whole number of repeats each way (about 480 px) so the tile
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
for n in ('chapter-15', 'stall-kranji'):
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
        # mangrove leaves, frogs and wellies are meant to be green)
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
zone = DEC['atlas-kranji'] + DEC['atlas-cast-kranji']
print(f'zone atlases {zone:.1f} MB decoded (budget 18), act {DEC["atlas-act24"]:.2f} MB (1), ui {DEC["atlas-ui24"]:.2f} MB (0.6)')
if zone > 18 or DEC['atlas-act24'] > 1 or DEC['atlas-ui24'] > 0.6: sys.exit('!! over the decoded-memory budget: lib/jade-art.ts not written')
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
