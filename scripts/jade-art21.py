"""Jade Street art, the twenty-first pass only: python3 scripts/jade-art21.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs21.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-islands       the Southern Islands' buildings (St John's marine lab, the Kusu temple, the hilltop keramat, the bungalow
                      safe house, the keeper's cottage, the jetty shelter) and Raffles Lighthouse, props (the island ferry and
                      Madam Sutera's black junk among them), the reef's creatures and Kusu's tortoises, Kapitan Umang's
                      hermit-crab deck crew and the three new properties' stands: the 'islands' zone
  atlas-cast-islands  the four chapter-thirteen faces' bodies and portraits: the 'islands' zone
  atlas-act21         both heroes' reef and island actions (wading, braced on a coral head, washed off their feet, peering
                      into a rock pool, feeding a tortoise, floating in the lagoon, looking out from the lighthouse): the job
                      tier, as every hero frame is core or job art
  atlas-ui21          map icons, the hermit-crab pin and four round icons: the job tier
plus four seamless ground textures (reef, shoal, coral, islepath) and two paintings (bg-chapter-13 and bg-stall-islands).
Every sheet painted on GREEN (the buildings and the lighthouse) is keyed green in every call that cuts it; at the end every
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

# ── the Southern Islands' buildings (footprints in lib/jade-islands.ts), painted on green and keyed tight (no lime
# fringe on the white walls); Raffles Lighthouse is its own sheet, its painted beam trimmed (lib/jade-islandsdraw.ts
# sweeps the real one round)
rect('atlas-islands', 'islands-bld', ['isl-lab', 'isl-temple', 'isl-keramat', 'isl-safe', 'isl-cottage', 'isl-shelter'], 3, 2,
     {'isl-lab': (6, 3), 'isl-temple': (5, 3), 'isl-keramat': (3, 3), 'isl-safe': (4, 3), 'isl-cottage': (3, 2), 'isl-shelter': (4, 2)},
     fix=unspill_green, lo=45, hi=150)
rect('atlas-islands', 'islands-light', ['isl-light'], 1, 1, {'isl-light': (3, 4)}, fix=chain(cut((900, 0, 1536, 330)), unspill_green), lo=45, hi=150)
# ── props (world widths as lib/jade-islands.ts and lib/jade-islandsdraw.ts draw them)
PW = {'isl-ferry': 96, 'isl-bollard': 30, 'isl-buoy': 34, 'isl-coral': 46, 'isl-pool': 52, 'isl-turtle-statue': 60, 'isl-lens': 60, 'isl-logbook': 30,
      'isl-crate': 50, 'isl-shells': 50, 'isl-camp': 110, 'isl-coconut': 24, 'isl-palm': 90, 'isl-umbrella': 70, 'isl-snorkel': 40, 'isl-junk': 150}
each('atlas-islands', 'props21', list(PW), 4, 4, PW)
# ── the reef's creatures and Kusu's tortoises (resting, plodding, munching), real animals
RW = {'isl-tortoise-rest': 50, 'isl-tortoise-walk': 54, 'isl-tortoise-munch': 50, 'isl-hatchling': 22, 'isl-seastar': 26, 'isl-clam': 28, 'isl-anemone': 28,
      'isl-octopus': 28, 'isl-seahorse': 20, 'isl-stingray': 40, 'isl-nudibranch': 22, 'isl-fiddler': 24}
each('atlas-islands', 'reef21', list(RW), 4, 3, RW)
# ── Kapitan Umang's deck crew: hermit crabs in sailor caps (the case and swap steps' guards, 'crab')
grid('atlas-islands', 'crabs21', ['crab-walk-down-0', 'crab-walk-down-1', 'crab-walk-up-0', 'crab-walk-up-1', 'crab-run-0', 'crab-run-1',
     'crab-sing', 'crab-peer', 'crab-munch', 'crab-taunt'], 5, 2, 46, ref='crab-walk-down-0')
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp21-props', 4, 3)
for i, b in enumerate(('coconutbar', 'jettycafe', 'snorkelhire')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-islands', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the four new faces: six standing frames each and four portraits
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'camar': 62, 'lumba': 60, 'ku': 50, 'umang': 54}
cast, faces = cells('cast21', 6, 4), cells('faces21', 4, 4)
for r, who in enumerate(('camar', 'lumba', 'ku', 'umang')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-islands', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-islands', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── both heroes' reef and island actions (the act8/act11 scale: 58 units tall, measured on the standing look-out pose)
ACTS = ['wade-0', 'wade-1', 'tide-brace', 'washed', 'peer', 'tortoise', 'float', 'lookout']
def unviolet(arr):
    """the lagoon ripples round the floating pose were painted on magenta: their see-through fringe came out violet; make
    it lagoon water"""
    a = arr.astype(np.int32); r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    v = (al > 0) & (r > g + 25) & (b > g + 25)
    a[v, 0] = 120; a[v, 1] = 200; a[v, 2] = 220
    return a.astype(np.uint8)
for h in ('dora', 'enzo'):
    grid('atlas-act21', f'{h}-act21', [f'{h}-{a}' for a in ACTS], 4, 2, 58, ref=f'{h}-lookout', fix=cream if h == 'dora' else None, keep=0.01)

# ── map icons, the hermit-crab pin, the round icons (128); the lighthouse icon's painted beam trimmed
for n, c in zip(['mi-raffles', 'mi-kusu', 'mi-lagoon', 'pin-crab', 'i-tide', 'i-shell', 'i-tortoise', 'i-logbook'], cells('ui21', 4, 2, fix=cut((250, 0, 384, 200)))):
    put('atlas-ui21', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: four squares (a 2 by 2 sheet), made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground21.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['reef', 'shoal', 'coral', 'islepath']
for k, n in enumerate(TEXN):
    i, j = k % 2, k // 2
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 2:W * (i + 1) // 2].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 12)[0]; cols = np.where(lum.mean(0) > 12)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); cell = cell[:s, :s]
    Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-13', 'stall-islands'):
    p = SRC / f'{n}.png'
    if not p.exists(): print('!! missing', n); continue
    Image.open(p).convert('RGB').resize((1536, 1024), Image.LANCZOS).save(OUT / f'bg-{n}.webp', 'WEBP', quality=80, method=6); PAINT['bg-' + n] = (1536, 1024)

# ── the floating pose's violet fringe (see unviolet)
for h in ('dora', 'enzo'):
    FR = ATL['atlas-act21']; FR[f'{h}-float'] = Image.fromarray(unviolet(np.array(FR[f'{h}-float'].convert('RGBA'))))

GREEN_KEYED = {'isl-lab', 'isl-temple', 'isl-keramat', 'isl-safe', 'isl-cottage', 'isl-shelter', 'isl-light'}
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
