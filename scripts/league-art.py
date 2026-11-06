#!/usr/bin/env python3
"""Turns the Codex paintings for Snow Day League into the game's art in public/art/league/.

Usage: python3 scripts/league-art.py <folder with the lg-*.png paintings>

- <species>.png: one strip of seven pixel-art frames per species (idle, run A, run B, throw, special, dizzy/KO, cheer),
  from the 4 by 2 sheets lg-sp-<species>.png painted on flat magenta (the flamingos on flat green, so their pink
  survives the key). Every frame of a species is shrunk by the same factor (set by the idle frame's height), placed
  bottom-centre in equal cells and palette-snapped. The painted turquoise scarf is rewritten as three exact marker
  shades (#00FFFF, #00C8C8, #008C8C) so the scene can recolour it to each team's colour at run time.
- <species>-face.png: the eighth cell, a pixel head-and-shoulders portrait for the match's bottom bar (scarf marked too).
- por-<species>-<0..3>.webp: four looks per species for the paper cards (lg-pv-<species>, 2 by 2), so every player in
  a squad is their own individual; por-dora.webp, por-enzo.webp, por-fort.webp (lg-por4).
- icon-<name>.png: the sixteen paper badge icons (roles, personalities, week jobs, coins, trophy).
- flag-red, flag-blue, ball, pile (pixel props), brick-0/1/2, gate, steps, wlantern, rubble, bush (the snow castle's
  kit, lg-fortkit), hud-<name>.png (the score bar's icons, lg-hud), bench (Dora and Enzo's coach bench), fan-0..7 (the
  crowd), arena.png (the 480 by 270 pitch, lg-arena2).
- office, draft, title, trophy, season, final (.webp paintings), card, pin, hourglass, cross (paper bits for the HTML).
- coach-<team>.webp: the seven rival coaches (lg-coach1, lg-coach2), and window-<weather>.webp: the office window's view
  for each week's weather (lg-windows).
"""
import sys, colorsys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'league'
OUT.mkdir(parents=True, exist_ok=True)


def key(im, bg='magenta'):
    """the flat background (and its fringe) becomes clear"""
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if bg == 'magenta':
                if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                    px[x, y] = (0, 0, 0, 0)
            elif g > 160 and g > r + 70 and g > b + 70:
                px[x, y] = (0, 0, 0, 0)
    return im


def cells(im, cols, rows):
    w, h = im.width // cols, im.height // rows
    return [im.crop((x * w, y * h, x * w + w, y * h + h)) for y in range(rows) for x in range(cols)]


def biggest(im):
    """drop stray specks: keep everything whose bounding box touches the main blob's (sparkles next to it stay)"""
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def palette(im, colours):
    alpha = im.getchannel('A').point(lambda a: 255 if a > 120 else 0)
    rgb = im.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


MARK = [(0, 255, 255), (0, 200, 200), (0, 140, 140)]


def mark_scarf(im):
    """the turquoise scarf becomes three exact marker shades by brightness"""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.47 < h < 0.56 and s > 0.42 and v > 0.32:
                px[x, y] = MARK[0] + (255,) if v > 0.82 else MARK[1] + (255,) if v > 0.6 else MARK[2] + (255,)
    return im


def shrink(im, k):
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.Resampling.BOX)


HEIGHT = {'vizcacha': 31, 'guanaco': 43, 'pudu': 27, 'fox': 29, 'bear': 32, 'mara': 36, 'alpaca': 35, 'flamingo': 43,
          'armadillo': 24, 'condor': 36, 'rhea': 43, 'vicuna': 41, 'cat': 29}
for sp, height in HEIGHT.items():
    sheet = key(Image.open(SRC / f'lg-sp-{sp}.png'), 'green' if sp == 'flamingo' else 'magenta')
    cs = [biggest(c) for c in cells(sheet, 4, 2)]
    k = height / cs[0].height
    frames = [mark_scarf(palette(shrink(c, k), 26)) for c in cs[:7]]
    cw = max(f.width for f in frames) + 2
    ch = max(f.height for f in frames) + 1
    strip = Image.new('RGBA', (cw * 7, ch), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        strip.paste(f, (i * cw + (cw - f.width) // 2, ch - f.height), f)
    strip.save(OUT / f'{sp}.png')
    face = mark_scarf(palette(shrink(cs[7], 30 / cs[7].height), 28))
    face.save(OUT / f'{sp}-face.png')

# ---- the paper card portraits: Dora, Enzo and the fort, then four looks for every species (lg-pv-<species>, 2 by 2:
# a bobble hat and striped scarf, round glasses, ear muffs and a checked scarf, a beanie and a dotted scarf)
im = Image.open(SRC / 'lg-por4.png').convert('RGB')
for c, n in zip(cells(im, 2, 2), ['cat', 'dora', 'enzo', 'fort']):
    if n == 'cat':
        continue
    i = round(c.width * 0.02)
    c.crop((i, i, c.width - i, c.height - i)).resize((288, 288), Image.Resampling.LANCZOS).save(OUT / f'por-{n}.webp', quality=84)
for sp in HEIGHT:
    im = Image.open(SRC / f'lg-pv-{sp}.png').convert('RGB')
    for k, c in enumerate(cells(im, 2, 2)):
        i = round(c.width * 0.02)
        c.crop((i, i, c.width - i, c.height - i)).resize((256, 256), Image.Resampling.LANCZOS).save(OUT / f'por-{sp}-{k}.webp', quality=84)

# ---- the paper badges
ICONS = ['thrower', 'digger', 'builder', 'scout', 'medic', 'hothead', 'steady', 'shy', 'showoff', 'cheery', 'train',
         'scout-job', 'rest', 'sign', 'coins', 'trophy']
for c, n in zip(cells(key(Image.open(SRC / 'lg-icons.png')), 4, 4), ICONS):
    c = biggest(c)
    k = 72 / max(c.width, c.height)
    c.resize((round(c.width * k), round(c.height * k)), Image.Resampling.LANCZOS).save(OUT / f'icon-{n}.png')

# ---- pixel props
props = [biggest(c) for c in cells(key(Image.open(SRC / 'lg-props.png')), 4, 2)]
for c, (n, size, cols) in zip(props, [(None, 0, 0), ('flag-red', 26, 10), ('flag-blue', 26, 10), ('ball', 6, 6),
                                       ('pile', 12, 8), (None, 0, 0), (None, 0, 0), (None, 0, 0)]):
    if n:
        palette(shrink(c, size / c.height), cols).save(OUT / f'{n}.png')
# the snow castle's kit (lg-fortkit): the brick cube whole, cracked and chipped, the gate, steps, a wall lantern, rubble
# and a berry bush, each shrunk to its width in buffer pixels
kit = [biggest(c) for c in cells(key(Image.open(SRC / 'lg-fortkit.png')), 4, 2)]
for c, (n, w, cols) in zip(kit, [('brick-0', 12, 10), ('brick-1', 12, 10), ('brick-2', 12, 10), ('gate', 25, 16),
                                  ('steps', 17, 10), ('wlantern', 8, 10), ('rubble', 20, 10), ('bush', 16, 12)]):
    palette(shrink(c, w / c.width), cols).save(OUT / f'{n}.png')
# the score bar's icons (lg-hud): fort, KO, momentum, heart, save, block, crisp at 48 pixels
for c, n in zip(cells(key(Image.open(SRC / 'lg-hud.png')), 3, 2), ['fort', 'ko', 'momentum', 'heart', 'save', 'block']):
    c = biggest(c)
    k = 24 / max(c.width, c.height)
    sm = palette(shrink(c, k), 16)
    sm.resize((sm.width * 2, sm.height * 2), Image.Resampling.NEAREST).save(OUT / f'hud-{n}.png')
b = biggest(key(Image.open(SRC / 'lg-bench.png')))
palette(shrink(b, 84 / b.width), 40).save(OUT / 'bench.png')
for i, c in enumerate(cells(key(Image.open(SRC / 'lg-crowd.png')), 4, 2)):
    c = biggest(c)
    palette(shrink(c, 15 / c.height), 16).save(OUT / f'fan-{i}.png')

# ---- the arena: the 16:9 clearing (lg-arena2) at 480 by 270
a = Image.open(SRC / 'lg-arena2.png').convert('RGB').resize((480, 270), Image.Resampling.BOX)
a.quantize(56, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'arena.png')

# ---- paintings and paper bits
for n in ['office', 'draft', 'title', 'trophy', 'season', 'final']:
    Image.open(SRC / f'lg-{n}.png').convert('RGB').save(OUT / f'{n}.webp', quality=82)
ui = [biggest(c) for c in cells(key(Image.open(SRC / 'lg-ui.png')), 2, 2)]
for c, (n, w) in zip(ui, [('card', 320), ('pin', 40), ('hourglass', 96), ('cross', 200)]):
    c.resize((w, round(c.height * w / c.width)), Image.Resampling.LANCZOS).save(OUT / f'{n}.png')
for sheet, names in (('lg-coach1', ['flamingos', 'armadillos', 'condors', 'alpacas']), ('lg-coach2', ['rheas', 'vicunas', 'cats', 'cup'])):
    im = Image.open(SRC / f'{sheet}.png').convert('RGB')
    for c, n in zip(cells(im, 2, 2), names):
        i = round(c.width * 0.02)
        c.crop((i, i, c.width - i, c.height - i)).resize((288, 288), Image.Resampling.LANCZOS).save(OUT / f'coach-{n}.webp', quality=84)
im = Image.open(SRC / 'lg-windows.png').convert('RGB')
for c, n in zip(cells(im, 2, 2), ['clear', 'snow', 'wind', 'fog']):
    c.resize((384, 384), Image.Resampling.LANCZOS).save(OUT / f'window-{n}.webp', quality=82)
print('wrote', len(list(OUT.iterdir())), 'files to', OUT)
