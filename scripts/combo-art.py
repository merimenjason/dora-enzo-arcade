#!/usr/bin/env python3
"""Turns the Codex paintings for Combo Ball into the game's pixel art in public/art/combo/.

Usage: python3 scripts/combo-art.py <folder with the cb-*.png paintings>

The players, keepers, goal and ball are shared with Into Space and come from scripts/kickabout-art.py. Here: the
pitch (its mowing stripes run up and down, so a band of plain grass is cut out of the middle to bring it to the screen's
shape without losing the fence and the hedge), the title and the ending, shrunk with a box filter to a small palette
and drawn with nearest-neighbour.
"""
import sys
from pathlib import Path
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / 'public' / 'art' / 'combo'
OUT.mkdir(parents=True, exist_ok=True)


def small(im, size, colours):
    return im.resize(size, Image.Resampling.BOX).quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')


pitch = Image.open(SRC / 'cb-pitch.png').convert('RGB').resize((384, 256), Image.Resampling.BOX)
# 256 rows down to 216: keep the top 100 (the fence) and the bottom 116 (the hedge), losing plain grass between
out = Image.new('RGB', (384, 216))
out.paste(pitch.crop((0, 0, 384, 100)), (0, 0))
out.paste(pitch.crop((0, 140, 384, 256)), (0, 100))
out.quantize(40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(OUT / 'pitch.png')
for name in ('title', 'ending'):
    small(Image.open(SRC / f'cb-{name}.png').convert('RGB'), (480, 320), 64).save(OUT / f'{name}.png')
print('wrote', len(list(OUT.glob('*.png'))), 'pictures to', OUT)
