"""Jade Street art, the twentieth pass only: python3 scripts/jade-art20.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs20.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry:
  atlas-act20        both heroes' rounds actions (a garland held up and draped; reaching up to hang a cage or a lantern,
                     then admiring it): the job tier, as every hero frame is core or job art (four frames a hero)
  atlas-gig20-south  the Tiong Bahru Bakery box, the songbird cage and the plate of chwee kueh: the 'south' zone
  atlas-gig20-east   the bolt of batik: the 'east' zone
  atlas-gig20-far    the bowl of Katong laksa and the box of potong: the 'far' zone
  atlas-ride20       the vehicle perks' cab and kayak (three liveries each) and both heroes driving, paddling, stepping
                     into the cab and calling a ride: the job tier, decoded in free roam like the older rides
Every sheet is painted on MAGENTA and keyed magenta; after packing every new frame is checked for leftover magenta or
chroma green. No frame name may already exist in lib/jade-art.ts. Re-runnable: a second run replaces these atlases' own
entries.
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


# ── both heroes' rounds actions (the act18 scale: 58 units tall, the admiring pose standing)
ACTS = ['drape-0', 'drape-1', 'hang-up', 'admire']
for h in ('dora', 'enzo'):
    grid('atlas-act20', f'{h}-act20', [f'{h}-{a}' for a in ACTS], 2, 2, 58, ref=f'{h}-admire', fix=cream if h == 'dora' else None, keep=0.01)
# ── the carried things, each 120 px wide (drawn 24 to 34 units)
ITEMS = ['g20-croissants', 'g20-cage', 'g20-chweekueh', 'g20-batik', 'g20-laksa', 'g20-potong']
ZONE = {'g20-croissants': 'south', 'g20-cage': 'south', 'g20-chweekueh': 'south', 'g20-batik': 'east', 'g20-laksa': 'far', 'g20-potong': 'far'}
for n, c in zip(ITEMS, cells('props20', 3, 2)):
    put(f'atlas-gig20-{ZONE[n]}', n, scaled(c, 120 / max(c.shape[:2])))

# ── the vehicle perks (lib/jade-fleet.ts): the taxi depot's cab and the Siloso kayak, each in three liveries (the
# business's levels 1, 2 and 3), top-down and facing up like 'vehicles' (v-taxi is 80 units long); and both heroes
# driving the cab (paws on the wheel, then a hand over the top in a turn), paddling the kayak (left blade, right blade),
# stepping into the cab and waving a called ride over with the phone. All of it the job tier (atlas-ride20).
for n, c in zip(['v-cab', 'v-cab-2', 'v-cab-3', 'v-kayak', 'v-kayak-2', 'v-kayak-3'], cells('rides20', 3, 2)):
    put('atlas-ride20', n, scaled(c, (80 if 'cab' in n else 74) * PX / c.shape[0]))  # (the kayak drawn a little over its 62-unit hull, so the paddler sits inside it)
def pair(file, names, gx, gy, world, fix=None):
    """two-frame cycles cut to the box both frames share (the rider, drawn centred on the seat, doesn't jump between
    frames); one scale per pair (the first frame is `world` units tall); a lone frame is cropped to itself"""
    arr = key(Image.open(SRC / f'{file}.png'))
    if fix: arr = fix(arr)
    H, W = arr.shape[:2]; cs = []
    for j in range(gy):
        for i in range(gx):
            sub = biggest(arr[H * j // gy:H * (j + 1) // gy, W * i // gx:W * (i + 1) // gx], 0.01)
            ys, xs = np.where(sub[..., 3] > 20); cs.append((sub, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
    return dict(zip(names, cs))
for h in ('dora', 'enzo'):
    cs = pair(f'{h}-ride20', [f'{h}-ride-cab-0', f'{h}-ride-cab-1', f'{h}-ride-kayak-0', f'{h}-ride-kayak-1', f'{h}-cab-in', f'{h}-call'], 3, 2, 0, cream if h == 'dora' else None)
    for a, b, world in ((f'{h}-ride-cab-0', f'{h}-ride-cab-1', 46), (f'{h}-ride-kayak-0', f'{h}-ride-kayak-1', 44)):
        (_, ba), (_, bb) = cs[a], cs[b]; u = (min(ba[0], bb[0]), min(ba[1], bb[1]), max(ba[2], bb[2]), max(ba[3], bb[3]))
        k = world * PX / (ba[3] - ba[1])
        for n in (a, b): put('atlas-ride20', n, scaled(cs[n][0][u[1]:u[3], u[0]:u[2]], k))
    # (standing poses at the act scale: 58 units tall, as climb-on)
    for n in (f'{h}-cab-in', f'{h}-call'):
        s, (x0, y0, x1, y1) = cs[n]; put('atlas-ride20', n, scaled(s[y0:y1, x0:x1], 58 * PX / (y1 - y0)))

# ── a looser magenta key: the songbird cage's background shows through its bars, and the antialiased key leaves those
# slivers a dull pink-violet; anything with green far under both red and blue is the sheet, not paint (the heroes' pink
# ears and the marigolds keep green well above that)
def unmagenta(im):
    a = np.asarray(im.convert('RGBA')).copy(); r, g, b = (a[:, :, i].astype(int) for i in range(3))
    sheet = (r > 110) & (b > 90) & (g < 0.55 * np.minimum(r, b)) & (np.abs(r - b) < 110)
    a[sheet, 3] = 0
    return Image.fromarray(a), int(sheet.sum())
def bamboo(im):
    """the cage's back bars came out tinted by the sheet (a dark magenta-maroon between the front bars): turned to the
    bars' own amber at the same brightness (the shama's orange chest has blue well under green, so it stays)"""
    a = np.asarray(im.convert('RGBA')).copy(); r, g, b = (a[:, :, i].astype(int) for i in range(3))
    tint = (r > g + 35) & (b > g + 12) & (a[:, :, 3] > 0)
    v = np.maximum(r, b)[tint]
    a[tint, 0] = np.clip(v * 1.0, 0, 255); a[tint, 1] = np.clip(v * 0.66, 0, 255); a[tint, 2] = np.clip(v * 0.3, 0, 255)
    print(f'g20-cage: {int(tint.sum())} px of tinted bars turned amber')
    return Image.fromarray(a)
for FR in ATL.values():
    for n in list(FR):
        FR[n], k = unmagenta(FR[n])
        if k: print(f'{n}: {k} px of dull magenta keyed')
ATL['atlas-gig20-south']['g20-cage'] = bamboo(ATL['atlas-gig20-south']['g20-cage'])

# ── no clashes with older frames, and nothing left of the key colours
old = TS.read_text()
OLD_ATL = [q.strip().strip("'") for q in re.search(r"export const ATLASES = \[(.*?)\] as const;", old)[1].split(',')]
for FR in ATL.values():
    for n, im in FR.items():
        hit = re.search(r"\n  '" + re.escape(n) + r"': \[(\d+),", old)
        assert not hit or OLD_ATL[int(hit[1])] in ATL, f'{n} already exists in an older atlas'
        a = np.asarray(im.convert('RGBA')).astype(int); vis = a[:, :, 3] > 24
        mag = vis & (a[:, :, 0] > 110) & (a[:, :, 2] > 90) & (a[:, :, 1] < 0.55 * np.minimum(a[:, :, 0], a[:, :, 2]))
        grn = vis & (a[:, :, 1] > 200) & (a[:, :, 0] < 80) & (a[:, :, 2] < 80)
        print(f'{n}: {im.size}, magenta {mag.sum()} px, green {grn.sum()} px')
        assert mag.sum() < 30 and grn.sum() < 30, f'{n} keeps key colour'

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
