"""Jade Street art, the seventeenth pass only: python3 scripts/jade-art17.py <folder of the pass's Codex sheets>
The prompts are docs/jade-street-art/jobs17.py. Keyed, cut and scaled with scripts/jade-art.py's own functions (loaded
from that file, nothing else of it runs), packed into NEW atlases and appended to lib/jade-art.ts without touching any
other entry (the full rebuild needs every older sheet, so it is not run for this pass):
  atlas-ubin        Pulau Ubin's buildings, props, townsfolk and the three new properties' stands: the 'ubin' zone
  atlas-boars       the Tusker Boys (a full set like the bats') and Tok Taring on the run: the 'ubin' zone
  atlas-cast-ubin   the four chapter-ten givers' bodies and portraits: the 'ubin' zone
  atlas-act17       both heroes' island actions (reading hoof prints, shaking a durian tree, catching a durian, the
                    binoculars, hailing the bumboat, eating a durian): the 'ubin' zone (Changi's jetty is within reach)
  atlas-ui17        map icons, the boar pin and three round icons: the job tier
plus six seamless ground textures (dirt, kampong, mud, forest, quarry, rock) and two paintings (bg-chapter-10 and
bg-stall-pulau). Every atlas here is cropped to what it holds and streams with its zone (lib/jade-load.ts), so none of it
adds to the paintings decoded before play. Re-runnable: a second run replaces these atlases' own entries.
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

# ── Pulau Ubin's buildings (footprints in lib/jade-ubin.ts); the tower, the jetty shelter and the kelong are props
rect('atlas-ubin', 'ubin-bld', ['ubin-house-a', 'ubin-house-b', 'ubin-shops', 'ubin-bikes', 'ubin-temple', 'ubin-wayang'], 3, 2,
     {'ubin-house-a': (3, 2), 'ubin-house-b': (3, 2), 'ubin-shops': (3, 2), 'ubin-bikes': (3, 2), 'ubin-temple': (3, 2), 'ubin-wayang': (3, 2)})
rect('atlas-ubin', 'ubin-bld2', [None, 'ubin-house1', None, 'safe-ubin', 'ubin-den', None], 3, 2,
     {'ubin-house1': (3, 2), 'safe-ubin': (2, 2), 'ubin-den': (3, 2)})
each('atlas-ubin', 'ubin-bld2', ['ubin-tower', None, 'ubin-jetty', None, None, 'kelong'], 3, 2, {'ubin-tower': 92, 'ubin-jetty': 150, 'kelong': 210})
# ── props (world widths as lib/jade-ubin.ts draws them)
each('atlas-ubin', 'props17a', ['durian-tree', 'rambutan-tree', 'coconut', 'mangrove', 'ubin-bike', 'ubin-rack', 'drum', 'coop',
     'sampan', 'fish-trap', 'boulder', 'signpost', 'dig-hole', 'hoof-prints', 'durian-pile', 'tin-chest'], 4, 4,
     {'durian-tree': 120, 'rambutan-tree': 104, 'coconut': 120, 'mangrove': 110, 'ubin-bike': 40, 'ubin-rack': 84, 'drum': 34, 'coop': 46,
      'sampan': 70, 'fish-trap': 70, 'boulder': 60, 'signpost': 40, 'dig-hole': 60, 'hoof-prints': 30, 'durian-pile': 54, 'tin-chest': 44})
each('atlas-ubin', 'props17b', ['horseshoe-crab', 'sea-star', 'heron', 'seagrass', 'hornbill', 'piglet', 'hen-chicks', 'wild-banana',
     'headdress', 'wayang-chairs', 'incense-urn', 'kerosene-lamp', 'granite-blocks', 'winch', 'hammock', 'lalang'], 4, 4,
     {'horseshoe-crab': 40, 'sea-star': 34, 'heron': 50, 'seagrass': 60, 'hornbill': 46, 'piglet': 40, 'hen-chicks': 46, 'wild-banana': 70,
      'headdress': 40, 'wayang-chairs': 70, 'incense-urn': 36, 'kerosene-lamp': 30, 'granite-blocks': 60, 'winch': 50, 'hammock': 62, 'lalang': 56})
# ── the island's townsfolk: a junglefowl villager, a hornbill cyclist, a box-turtle grandma (as folk8: 50 units tall)
grid('atlas-ubin', 'folk9', [f'folk-{s}-{k}' for s in ('fowl', 'hornbill', 'boxturtle') for k in ('down', 'up', 'side-0', 'side-1', 'hop')], 5, 3, 50)
# ── the three new properties' stands, four levels each, 160 px wide like the sixteenth pass's
cs = cells('emp17-props', 4, 3)
for i, b in enumerate(('ubinbikes', 'durianstall', 'kelongseafood')):
    for l in range(4):
        c = cs[i * 4 + l]; put('atlas-ubin', f'biz-{b}-{l}', scaled(c, 160 / c.shape[1]))

# ── the Tusker Boys (the bats' frame names and sizes: about 46 units tall) and Tok Taring (66)
grid('atlas-boars', 'boars', ['boar-walk-down-0', 'boar-walk-down-1', 'boar-walk-up-0', 'boar-walk-up-1', 'boar-run-0', 'boar-run-1',
     'boar-charge-0', 'boar-charge-1', 'boar-root-0', 'boar-root-1', 'boar-taunt', 'boar-dizzy'], 4, 3, 48, ref='boar-walk-down-0')
grid('atlas-boars', 'boars2', ['boar-netted', 'boar-munch', 'boar-peer', 'boar-sing', 'boar-caught', 'boar-grab', 'boar-till-0', 'boar-till-1',
     'boar-kick', 'boar-gloat', 'boar-sneak-0', 'boar-sneak-1'], 4, 3, 46, ref='boar-peer')
grid('atlas-boars', 'taring', ['taring-stand', 'taring-run-0', 'taring-run-1', 'taring-charge', 'taring-dizzy', 'taring-caught', 'taring-laugh', 'taring-root'], 4, 2, 70)

# ── the four givers: six standing frames each and four portraits
CAST_POSES = ('idle-0', 'idle-1', 'wave-0', 'wave-1', 'talk-0', 'talk-1')
CAST_H = {'ayu': 58, 'belangkas': 58, 'lan': 58, 'taring': 70}
cast, faces = cells('cast17', 6, 4), cells('faces17', 4, 4)
for r, who in enumerate(('ayu', 'belangkas', 'lan', 'taring')):
    row = cast[r * 6:(r + 1) * 6]
    k = CAST_H[who] * PX / row[0].shape[0]
    for p, c in zip(CAST_POSES, row): put('atlas-cast-ubin', f'npc-{who}-{p}', scaled(c, k))
    for m, c in zip(('', '-happy', '-worried', '-cross'), faces[r * 4:(r + 1) * 4]): put('atlas-cast-ubin', f'face-{who}{m}', scaled(c, 256 / max(c.shape[:2])))

# ── both heroes' island actions (the act8/act11 scale: 58 units tall)
ACTS = ['read-0', 'read-1', 'shake-0', 'shake-1', 'catch-0', 'catch-1', 'spy-0', 'spy-1', 'hail-0', 'hail-1', 'eat-durian-0', 'eat-durian-1']
for h in ('dora', 'enzo'):
    grid('atlas-act17', f'{h}-act17', [f'{h}-{a}' for a in ACTS], 4, 3, 58, ref=f'{h}-spy-0', fix=cream if h == 'dora' else None, keep=0.01)

# ── map icons (160 px like the older ones), the boar pin, the round icons (128)
for n, c in zip(['mi-kampong', 'mi-tower', 'mi-wayang', 'mi-quarry', 'pin-boar', 'i-durian', 'i-ubinbike', 'i-hoof'], cells('ui17', 4, 2)):
    put('atlas-ui17', n, scaled(c, 128 / max(c.shape[:2])))

# ── ground: six squares, made seamless like the rest
a = np.asarray(Image.open(SRC / 'ground17.png').convert('RGB'))
H, W = a.shape[:2]
TEXN = ['dirt', 'kampong', 'mud', 'forest', 'quarry', 'rock']
for k, n in enumerate(TEXN):
    i, j = k % 3, k // 3
    cell = a[H * j // 2:H * (j + 1) // 2, W * i // 3:W * (i + 1) // 3].astype(np.float32)
    lum = cell.mean(-1); rows = np.where(lum.mean(1) > 18)[0]; cols = np.where(lum.mean(0) > 18)[0]
    cell = cell[rows.min() + 6:rows.max() - 6, cols.min() + 6:cols.max() - 6]
    s = min(cell.shape[:2]); cell = cell[:s, :s]
    Image.fromarray(seamless(cell.astype(np.float32))).resize((256, 256), Image.LANCZOS).save(OUT / f'tex-{n}.webp', 'WEBP', quality=84, method=6)

# ── the paintings
PAINT = {}
for n in ('chapter-10', 'stall-pulau'):
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
