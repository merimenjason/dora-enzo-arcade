#!/usr/bin/env python3
"""Import The River Remembers paintings into the runtime's pixel atlases."""
import argparse
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter


def palette(image, count):
    return image.convert('RGB').quantize(colors=count, dither=Image.Dither.NONE).convert('RGB')


def keyed(image, green):
    image = image.convert('RGB')
    mask = Image.new('L', image.size)
    if green:
        mask.putdata([0 if g > 115 and g > r + 46 and g > b + 34 else 255
                      for r, g, b in image.getdata()])
    else:
        mask.putdata([0 if r > 118 and b > 102 and r > g + 49 and b > g + 44 else 255
                      for r, g, b in image.getdata()])
    image.putalpha(mask)
    return image


def atlas(source, dest, name, cols, rows, size, *, green=True, terrain=False, height=None):
    raw = Image.open(source / (name + '.png'))
    width, tall = raw.size
    output = Image.new('RGBA', (cols * size, rows * size))
    for y in range(rows):
        for x in range(cols):
            box = (width*x//cols, tall*y//rows, width*(x+1)//cols, tall*(y+1)//rows)
            cell = keyed(raw.crop(box), green)
            # Suppress single pixels at a sheet edge, then retain the original art.
            alpha = cell.getchannel('A')
            reduced = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
            bounds = reduced.getbbox()
            if not bounds:
                raise ValueError(f'{name}: empty frame {x},{y}')
            cell = cell.crop(bounds)
            if terrain:
                tile = ImageOps.fit(cell.convert('RGB'), (size, size), Image.Resampling.NEAREST)
                output.paste(palette(tile, 20), (x*size, y*size))
                continue
            cell.thumbnail((size - 4, height or size - 4), Image.Resampling.NEAREST)
            painted = palette(cell, 26)
            painted.putalpha(cell.getchannel('A'))
            if not painted.getbbox():
                raise ValueError(f'{name}: transparent frame {x},{y}')
            ox = x*size + (size - painted.width)//2
            oy = (y+1)*size - 2 - painted.height
            output.paste(painted, (ox, oy))
    output.save(dest / (name + '.png'), optimize=True)


def material(source, dest, name):
    raw = Image.open(source / (name + '.png'))
    width, height = raw.size
    output = Image.new('RGB', (320, 320))
    for y in range(2):
        for x in range(2):
            crop = raw.crop((x*width//2+8, y*height//2+8, (x+1)*width//2-8, (y+1)*height//2-8))
            tile = ImageOps.fit(crop, (160, 160), Image.Resampling.NEAREST)
            output.paste(palette(tile, 40), (x*160, y*160))
    output.save(dest / (name + '.webp'), lossless=True, method=5)


def main():
    args = argparse.ArgumentParser()
    args.add_argument('source', type=Path)
    args.add_argument('--out', type=Path, default=Path('public/art/river'))
    opt = args.parse_args()
    opt.out.mkdir(parents=True, exist_ok=True)
    for i in range(6):
        atlas(opt.source, opt.out, f'tiles-{i}', 4, 3, 24, green=False, terrain=True)
        atlas(opt.source, opt.out, f'boss-{i}', 2, 2, 112)
        material(opt.source, opt.out, f'surface-{i}')
    for i in range(4):
        atlas(opt.source, opt.out, f'foes-{i}', 4, 3, 42)
    for name in ('dora', 'enzo'):
        atlas(opt.source, opt.out, name, 4, 4, 60, height=47)
    atlas(opt.source, opt.out, 'props', 4, 4, 64)
    atlas(opt.source, opt.out, 'effects', 4, 3, 72, green=False)
    for name in ['cover', *[f'view-{i}' for i in range(6)]]:
        image = ImageOps.fit(Image.open(opt.source / (name + '.png')), (576, 360), Image.Resampling.NEAREST)
        palette(image, 112).save(opt.out / (name + '.webp'), lossless=True, method=5)


if __name__ == '__main__':
    main()
