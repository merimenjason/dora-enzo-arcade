"""mkref.py faces.png out.png — the calm portraits (first column) of a 4x4 face sheet side by side, for the cast sheets"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size
out = Image.new('RGB', (1536, 384))
for r in range(4): out.paste(im.crop((0, H * r // 4, W // 4, H * (r + 1) // 4)).resize((384, 384), Image.LANCZOS), (384 * r, 0))
out.save(sys.argv[2])
