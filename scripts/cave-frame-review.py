#!/usr/bin/env python3
"""Measures a cave animation sheet and says whether it can be imported.

    python3 scripts/cave-frame-review.py <sheet.png> <cols> <rows> <out.json>
    python3 scripts/cave-frame-review.py --tile <floor.png> <out.json>

A sheet is split into connected pieces (alpha > 128, at least 30 px), and each piece belongs to the cell holding its
centre, so a tail or an acorn that overhangs a cell line still belongs to one frame. The importer crops by piece and
rescales every frame, so size and foot line need not be exact. The gate fails only on what import cannot repair:
an empty cell, one piece shared by two cells (two frames merged), a piece overhanging its cell by more than 24 px,
or a sheet with no solid pixels. Facing and poses are checked by eye.

`--tile` checks a seamless floor tile: how far its opposite edges differ, against how far neighbouring columns differ
inside it.

Needs Pillow only. Exit status 0 when the gate passes, 1 when it fails.
"""
import json
import sys
from PIL import Image

OVERHANG = 24


def pieces(alpha, w, h):
    seen = bytearray(w * h)
    out = []
    for start in range(w * h):
        if seen[start] or alpha[start] <= 128:
            continue
        stack, seen[start] = [start], 1
        x0 = y0 = 1 << 30
        x1 = y1 = -1
        n = sx = sy = 0
        cells = {}
        while stack:
            p = stack.pop()
            y, x = divmod(p, w)
            n += 1
            sx += x
            sy += y
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            neighbours = (p - 1 if x else -1, p + 1 if x < w - 1 else -1, p - w, p + w)
            for q in neighbours:
                if 0 <= q < w * h and not seen[q] and alpha[q] > 128:
                    seen[q] = 1
                    stack.append(q)
        if n >= 30:
            out.append({"box": [x0, y0, x1 + 1, y1 + 1], "area": n, "centre": [sx / n, sy / n]})
    return out


def review_sheet(path, cols, rows):
    im = Image.open(path)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size
    cw, ch = w // cols, h // rows
    alpha = im.getchannel("A").tobytes()
    found = pieces(alpha, w, h)
    cells = {(r, c): [] for r in range(rows) for c in range(cols)}
    problems = []
    for p in found:
        c, r = int(p["centre"][0] // cw), int(p["centre"][1] // ch)
        cells[(r, c)].append(p)
        x0, y0, x1, y1 = p["box"]
        over = max(c * cw - x0, x1 - (c + 1) * cw, r * ch - y0, y1 - (r + 1) * ch, 0)
        p["overhang"] = over
        if over > OVERHANG:
            # a piece that reaches far into a neighbour is two frames run together, or a frame too big to separate
            problems.append(f"row {r + 1} column {c + 1}: a piece overhangs its cell by {over} px")
    frames = []
    for (r, c), ps in sorted(cells.items()):
        if not ps:
            problems.append(f"row {r + 1} column {c + 1}: empty")
            frames.append({"row": r + 1, "column": c + 1, "pieces": 0})
            continue
        x0 = min(p["box"][0] for p in ps) - c * cw
        y0 = min(p["box"][1] for p in ps) - r * ch
        x1 = max(p["box"][2] for p in ps) - c * cw
        y1 = max(p["box"][3] for p in ps) - r * ch
        frames.append({
            "row": r + 1, "column": c + 1, "pieces": len(ps),
            "bounds_local_exclusive": [x0, y0, x1, y1], "width": x1 - x0, "height": y1 - y0,
            "overhang_px": max(p["overhang"] for p in ps),
        })
    top = max(alpha)
    if top < 200:
        problems.append(f"no solid pixels: alpha peaks at {top}")
    # the same frame's size across a row: the importer evens this out, but a big spread usually means a wrong pose
    for r in range(rows):
        hs = [f["height"] for f in frames if f["row"] == r + 1 and f.get("height")]
        if hs and max(hs) > 1.5 * min(hs):
            problems.append(f"row {r + 1}: frame heights range {min(hs)}–{max(hs)} px; check the poses by eye")
    return {
        "image": path, "grid": [cols, rows], "cell": [cw, ch], "size": [w, h], "mode": im.mode,
        "alpha_max": top, "alpha_zero_pixels": alpha.count(0),
        "measurement": "connected pieces at alpha > 128 (>= 30 px), each assigned to the cell holding its centre",
        "status": "pass" if not [p for p in problems if "check the poses" not in p] else "fail",
        "problems": problems, "frames": frames,
    }


def review_tile(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    diff = lambda a, b: sum(abs(x - y) for x, y in zip(a, b)) / 3
    seam_x = sum(diff(px[0, y], px[w - 1, y]) for y in range(h)) / h
    seam_y = sum(diff(px[x, 0], px[x, h - 1]) for x in range(w)) / w
    inner = sum(diff(px[w // 2, y], px[w // 2 + 1, y]) for y in range(h)) / h
    ok = seam_x <= 2.5 * inner + 2 and seam_y <= 2.5 * inner + 2
    return {
        "image": path, "size": [w, h], "square": w == h,
        "edge_difference": {"left_right": round(seam_x, 2), "top_bottom": round(seam_y, 2), "neighbouring_columns": round(inner, 2)},
        "status": "pass" if ok and w == h else "fail",
    }


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "--tile" and len(a) == 3:
        result, out = review_tile(a[1]), a[2]
    elif len(a) == 4:
        result, out = review_sheet(a[0], int(a[1]), int(a[2])), a[3]
    else:
        sys.exit(__doc__)
    with open(out, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(result["status"], *result.get("problems", []), sep="\n  ")
    sys.exit(0 if result["status"] == "pass" else 1)
