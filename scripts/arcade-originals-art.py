#!/usr/bin/env python3
"""Build the cabinet backdrops and keyed sprite atlases from painted PNGs."""
from argparse import ArgumentParser
from pathlib import Path

from PIL import Image, ImageOps

GAMES = ("faultline", "night-wire", "second-show")
ROOT = Path(__file__).resolve().parents[1]


def snap(rgb, colors):
    return rgb.quantize(colors=colors, dither=Image.Dither.NONE).convert("RGB")


def key_atlas(path, rows, height, size=48):
    source = Image.open(path).convert("RGB")
    width, tall = source.size
    atlas = Image.new("RGBA", (4 * size, rows * size))
    for row in range(rows):
        for col in range(4):
            tile = source.crop((col * width // 4, row * tall // rows,
                                (col + 1) * width // 4, (row + 1) * tall // rows))
            mask = Image.new("L", tile.size)
            mask.putdata([0 if r > g + 55 and b > g + 45 and min(r, b) > 100 else 255
                          for r, g, b in tile.getdata()])
            bounds = mask.getbbox()
            if not bounds:
                raise ValueError(f"Empty sprite: {path}, {row + 1}:{col + 1}")
            sprite = snap(tile.crop(bounds), 22)
            sprite.putalpha(mask.crop(bounds))
            sprite.thumbnail((size - 4, height), Image.Resampling.NEAREST)
            atlas.paste(sprite, (col * size + (size - sprite.width) // 2,
                                 (row + 1) * size - 2 - sprite.height))
    return atlas


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path)
    parser.add_argument("--out", type=Path, default=ROOT / "public/art")
    args = parser.parse_args()
    for game in GAMES:
        origin, dest = args.sources / game, args.out / game
        dest.mkdir(parents=True, exist_ok=True)
        for i in range(4):
            name = f"field-{i}"
            art = ImageOps.fit(Image.open(origin / f"{name}.png").convert("RGB"),
                               (432, 270), Image.Resampling.NEAREST)
            snap(art, 64).save(dest / f"{name}.webp", lossless=True, method=6)
        for name in ("dora", "enzo", "objects"):
            key_atlas(origin / f"{name}.png", 2 if name == "objects" else 3,
                      24 if name == "objects" else 38).save(dest / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
