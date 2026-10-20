#!/usr/bin/env python3
"""Imports Glimmer Cave's accepted painted sheets for the game.

    python3 scripts/glimmer-cave-import.py

Reads each sheet named in SOURCES from public/art/cave-survival/ and, for each:
  1. clears alpha below 32 to 0, snaps alpha >= 240 to 255 and sets RGB to 0 where alpha is 0;
  2. labels the connected pieces (alpha > 128, >= 30 px) as scripts/cave-frame-review.py does and gives each piece to the
     cell holding its centre. Fainter edges and specks smaller than a piece (alpha > 0) go with the piece they touch, or
     else with the cell holding their centre. A frame's rect is the union of its cell's content plus 6 px, and every pixel
     outside a used frame's rect is cleared, so a crop never shows a neighbour and unused cells cost no bytes;
  3. measures each frame's foot line as the lowest opaque row of its largest piece (exclusive). On an animated sheet a
     row of a subject stands on one line, the median of its grounded frames, and the middle is the cell's centre, so a
     hop, a bob or a lunge moves as drawn; a single object is centred on its pieces;
  4. computes scale = 1 / the median size of the subject's walk or idle frames (height, or width for blocks and
     effects), so a frame drawn at `px` × scale per source px shows the subject at `px`; nothing is resampled;
  5. writes the cleaned PNG to public/art/cave/<name>.png;
  6. writes docs/glimmer-cave-crops.json and regenerates lib/glimmer-cave-crops.ts from it.

Frame keys are "<sheet>:<row>:<column>", counted from 1 as the art reviews count them. Needs Pillow only.
"""
import hashlib
import json
import os
import statistics
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/art/cave-survival")
OUT = os.path.join(ROOT, "public/art/cave")
PAD = 6
OVERHANG = 24


def cells(rows, cols):
    return [(r, c) for r in rows for c in cols]


R6, C6 = range(1, 5), range(1, 7)
# One group per subject: its frames share one scale, from the median size of its basis (walk or idle) frames.
# `anchor` "cell" keeps the generator's placement within the cell, on the row's ground line; "centre" anchors an effect
# on its cell's centre; "piece" centres on the largest piece, and "union" on all of a frame's pieces (a crumbling block's
# chunks), each standing on the largest piece's lowest row.
SOURCES = {
    # docs/cave-survival-art.md, "Enzo v2 — Claude's review": accepted as the source sheet
    "enzo": {"src": "enzo-animation-v2.png", "grid": (6, 4), "anchor": "cell", "groups": [
        ("h", cells(R6, C6), [(1, c) for c in C6] + [(3, 1), (3, 2)])]},
    # "Enzo digging, round 2": enzo-dig-v4 accepted, row 1 raise, slam, fling (done and row 2, a spare take, are unused). Sized
    # by the raise frame, sitting up tall: drawn at the hero's height, its helmet matches the idle frame's width
    "enzodig": {"src": "enzo-dig-v4.png", "grid": (4, 2), "anchor": "cell", "groups": [
        ("h", cells([1], [1, 2, 3]), [(1, 1)])]},
    # "Round 1 sheets": accepted
    "dora": {"src": "dora-animation-v2.png", "grid": (6, 4), "anchor": "cell", "groups": [
        ("h", cells(R6, C6), [(1, c) for c in C6] + [(3, 1), (3, 2)])]},
    # "Round 1 sheets": accepted. Rows 1-3 soot, mite, beetle; row 4 their attacks, two frames each
    "critters": {"src": "critters-animation-v2.png", "grid": (6, 4), "anchor": "cell", "groups": [
        ("h", cells([1], C6) + [(4, 1), (4, 2)], cells([1], range(1, 5))),
        ("h", cells([2], C6) + [(4, 3), (4, 4)], cells([2], range(1, 5))),
        ("h", cells([3], C6) + [(4, 5), (4, 6)], cells([3], range(1, 5)))]},
    # "Round 1 sheets": accepted. One group per effect, sized by width (rings and swooshes are flat)
    "fx": {"src": "fx-animation-v2.png", "grid": (6, 4), "anchor": "centre", "groups": [
        ("w", g, g) for g in (cells([1], C6), cells([2], [1, 2, 3]), cells([2], [4, 5, 6]), cells([3], [1, 2, 3, 4]),
                              cells([3], [5, 6]), cells([4], [1, 2, 3]), cells([4], [4, 5, 6]))]},
    # "Round 2 sheets": environment-v3 accepted. Sized by the five blocks' width, so a block fills its tile across
    "environment": {"src": "environment-v3.png", "grid": (4, 2), "anchor": "union", "groups": [
        ("w", cells([1, 2], [1, 2, 3, 4]), cells([1], [1, 2, 3, 4]) + [(2, 1)])]},
    # "Round 2 sheets": floor-v2 accepted at 1254 x 1254; any square tile is taken at its own size
    "floor": {"src": "floor-v2.png", "tile": True},
    # "Round 2 sheets": wyrm-v1 row 2 only (body, flinch, tail, boulders); row 1 drew whole wyrms and is left out.
    # Sized by the body segment's height; the heads below share that scale (the heads sheet was drawn at the same
    # size against wyrm-head-guide.png, which chains these pieces)
    "wyrm": {"src": "wyrm-v1.png", "grid": (4, 2), "anchor": "piece", "groups": [
        ("h", cells([2], [1, 2, 3, 4]), [(2, 1)])]},
    # "Wyrm heads — Claude's review": wyrm-heads-v2 accepted, 2 x 2 cells of 768 x 512
    "wyrmheads": {"src": "wyrm-heads-v2.png", "grid": (2, 2), "anchor": "piece", "groups": [
        ("h", cells([1, 2], [1, 2]), None)]},
    # the concept sheet: Enzo, Dora, soot, mite / beetle, wyrm, crystal, gold block. Each pose is its own subject;
    # it is the fallback while a sheet is missing, and the only painting of a crystal
    "sprites": {"src": "sprites-0.png", "grid": (4, 2), "anchor": "piece", "groups": [
        ("w" if (r, c) == (2, 4) else "h", [(r, c)], [(r, c)]) for r in (1, 2) for c in (1, 2, 3, 4)]},
}

# Per-frame overrides, each with its reason. `flip` mirrors the picture; `air` keeps the feet on the row's ground line
# (the median of its grounded frames) instead of the frame's own lowest row, so a hop is drawn off the ground.
FIX = {
    # docs/cave-survival-art.md, Round 1: "Mirror row 4, column 2 (her dig-up frame faces left; mirrored, it reads as
    # the pick raised in front)."
    "dora:4:2": {"flip": True},
    # dora:2:4's dust tuft at the pick tip reaches 20 px past the cell line, beside and below the tail of the recoil frame
    # (2:5), so no rectangle holds one without the other. The two crops meet at x = 1030: the strike loses the last
    # 14 px of faint dust, the recoil keeps its whole tail
    "dora:2:4": {"clip": [None, None, 1030, None]}, "dora:2:5": {"clip": [1030, None, None, None]},
    # enzodig:1:2's slam clods end at x = 769 and 1:3's flung clods start there, so the two padded rects overlap by the
    # padding alone; both crops meet on that line and neither loses paint
    "enzodig:1:2": {"clip": [None, None, 769, None]}, "enzodig:1:3": {"clip": [769, None, None, None]},
    # dora:4:1's dig strike throws a dirt chip up and right from the pick, 4 px over the cell line, so by its centre it
    # would join the next frame; checked by eye, it flies from 4:1's dust tuft (4:2's chips fly from its own pick)
    "dora:4:1": {"claim": [(260, 908)]},
    # sprites-0.png, checked by eye: Dora's concept pose looks to the left (eye and nose on the left of her head);
    # every other painting faces right
    "sprites:1:2": {"flip": True},
    # airborne by design, per cave-survival-enzo-generation-prompt-v2.md and the v2 prompts: walk frame 4 "airborne
    # (body lifted, feet tucked)", row 3 frame 4 "startled hop (both feet up)", row 4 frame 5 "happy bounce in the air"
    "enzo:1:4": {"air": True}, "enzo:3:4": {"air": True}, "enzo:4:5": {"air": True},
    "dora:1:4": {"air": True}, "dora:3:4": {"air": True}, "dora:4:5": {"air": True},
    # the soot sprite's attack is "crouching then pouncing forward": frame 2 is the leap, 12 px above the crouch
    "critters:4:2": {"air": True},
}

# Named sequences, from docs/cave-survival-animation-prompts-v2.md (Dora, critters, effects, environment, wyrm),
# cave-survival-animation-prompts.md and cave-survival-enzo-generation-prompt-v2.md (Enzo), and the reviews in
# cave-survival-art.md. Each is checked against the sheets by eye.
def row(sheet, r, cs):
    return [f"{sheet}:{r}:{c}" for c in cs]


SEQUENCES = {
    "HERO_ANIMS": {
        # Enzo: row 1 hop-walk, row 2 throw (acorn leaves the paw in frame 4), row 3 idle 1-2, blink, startled hop,
        # dizzy, shaking it off; row 4 crouch, spin, spin, land, cheer bounce, cheer
        "enzo": {
            "walk": row("enzo", 1, C6), "attack": row("enzo", 2, C6), "idle": row("enzo", 3, [1, 2]),
            "blink": "enzo:3:3", "flinch": "enzo:3:4", "dizzy": "enzo:3:5", "recover": "enzo:3:6",
            # his own sheet: raise, slam, fling, like a dog digging a hole
            "dig": row("enzodig", 1, [1, 2, 3]), "cheer": row("enzo", 4, [5, 6]),
        },
        # Dora: row 1 walk, row 2 pickaxe bonk, row 3 as Enzo's, row 4 dig down, dig up, wipe brow, cheer, bounce, cheer
        "dora": {
            "walk": row("dora", 1, C6), "attack": row("dora", 2, C6), "idle": row("dora", 3, [1, 2]),
            "blink": "dora:3:3", "flinch": "dora:3:4", "dizzy": "dora:3:5", "recover": "dora:3:6",
            "dig": row("dora", 4, [1, 2]), "cheer": row("dora", 4, [4, 5, 6]),
        },
    },
    # Enzo's special spin (crouch, twist, acorns flying out, land) and Dora's brow wipe, which HERO_ANIMS has no slot for
    "ENZO_SPIN": row("enzo", 4, [1, 2, 3, 4]),
    "DORA_WIPE": "dora:4:3",
    "CRITTER_ANIMS": {
        "soot": {"walk": row("critters", 1, [1, 2, 3, 4]), "flinch": "critters:1:5", "dizzy": "critters:1:6", "attack": row("critters", 4, [1, 2])},
        "mite": {"walk": row("critters", 2, [1, 2, 3, 4]), "flinch": "critters:2:5", "dizzy": "critters:2:6", "attack": row("critters", 4, [3, 4])},
        "beetle": {"walk": row("critters", 3, [1, 2, 3, 4]), "flinch": "critters:3:5", "dizzy": "critters:3:6", "attack": row("critters", 4, [5, 6])},
    },
    "FX_ANIMS": {
        "poof": row("fx", 1, C6), "bonk": row("fx", 2, [1, 2, 3]), "chips": row("fx", 2, [4, 5, 6]),
        # the review: the four acorn frames turn too little, so the scene adds a quarter-turn per frame in code
        "acorn": row("fx", 3, [1, 2, 3, 4]), "twinkle": row("fx", 3, [5, 6]),
        "swoosh": row("fx", 4, [1, 2, 3]), "ring": row("fx", 4, [4, 5, 6]),
    },
    # dig stages, first to last; only the gold block has crack stages
    "BLOCKS": {
        "dirt": ["environment:1:1"], "gold": row("environment", 1, [2, 3, 4]), "bedrock": ["environment:2:1"],
        "pod": ["environment:2:2"], "lantern": ["environment:2:3"], "crate": ["environment:2:4"],
    },
    "WYRM_PARTS": {
        "sleepy": "wyrmheads:1:1", "grumpy": "wyrmheads:1:2", "rumble": "wyrmheads:2:1", "dizzy": "wyrmheads:2:2",
        "body": "wyrm:2:1", "flinch": "wyrm:2:2", "tail": "wyrm:2:3", "boulders": "wyrm:2:4",
    },
    "CRYSTAL": "sprites:2:3",
}


def fallback_of(key):
    """The sprites-0 pose drawn while a frame's own sheet is missing; the wyrm, effects and plain blocks have none."""
    sheet, r, c = key.split(":")
    r, c = int(r), int(c)
    if sheet in ("enzo", "enzodig", "dora"):
        return "sprites:1:2" if sheet == "dora" else "sprites:1:1"
    if sheet == "critters":
        subject = r if r < 4 else (c + 1) // 2
        return ["sprites:1:3", "sprites:1:4", "sprites:2:1"][subject - 1]
    if key in SEQUENCES["BLOCKS"]["gold"]:
        return "sprites:2:4"
    return None


def clean(im):
    px = bytearray(im.tobytes())
    for i in range(3, len(px), 4):
        a = px[i]
        if a < 32:
            px[i - 3] = px[i - 2] = px[i - 1] = px[i] = 0
        elif a >= 240:
            px[i] = 255
    return px


def components(alpha, w, h, threshold, keep=1):
    """4-connected components above `threshold`, each {box, area, centre, pixels}."""
    seen = bytearray(w * h)
    out = []
    for start in range(w * h):
        if seen[start] or alpha[start] <= threshold:
            continue
        stack, seen[start] = [start], 1
        pix = []
        x0 = y0 = 1 << 30
        x1 = y1 = -1
        sx = sy = 0
        while stack:
            p = stack.pop()
            pix.append(p)
            y, x = divmod(p, w)
            sx += x
            sy += y
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
            for q in (p - 1 if x else -1, p + 1 if x < w - 1 else -1, p - w, p + w):
                if 0 <= q < w * h and not seen[q] and alpha[q] > threshold:
                    seen[q] = 1
                    stack.append(q)
        n = len(pix)
        if n >= keep:
            out.append({"box": [x0, y0, x1 + 1, y1 + 1], "area": n, "centre": (sx / n, sy / n), "pixels": pix})
    return out


def import_sheet(name, spec, used):
    im = Image.open(os.path.join(SRC, spec["src"])).convert("RGBA")
    w, h = im.size
    cols, rows = spec["grid"]
    cw, ch = w // cols, h // rows
    px = clean(im)
    alpha = px[3::4]
    cell_of = lambda x, y: (min(int(y // ch), rows - 1) + 1, min(int(x // cw), cols - 1) + 1)

    # big pieces, as the review script finds them
    pieces = components(alpha, w, h, 128, 30)
    owner = {}
    piece_cell = [cell_of(*p["centre"]) for p in pieces]
    for i, p in enumerate(pieces):
        for q in p["pixels"]:
            owner[q] = i
    claims = {}
    for key, fix in FIX.items():
        if key.startswith(name + ":") and "claim" in fix:
            claims[tuple(int(n) for n in key.split(":")[1:])] = [y * w + x for x, y in fix["claim"]]
    # everything visible: a faint region goes with the pieces inside it, or else with the cell holding its centre. A
    # faint cloud that joins pieces of two cells (a dust tuft over the line) goes whole to the cell owning most of it,
    # and a FIX `claim` hands the region holding a named pixel to its frame
    content = {}
    for comp in components(alpha, w, h, 0, 1):
        spots = set(comp["pixels"]) if claims else ()
        claimed = [cell for cell, qs in claims.items() if any(q in spots for q in qs)]
        inside = {owner[q] for q in comp["pixels"] if q in owner}
        share = {}
        for i in inside:
            share[piece_cell[i]] = share.get(piece_cell[i], 0) + pieces[i]["area"]
        cell = claimed[0] if claimed else max(share, key=share.get) if share else cell_of(*comp["centre"])
        if len(share) > 1 or claimed or (share and cell not in share):
            print(f"  {name}: content at {comp['box']} ({comp['area']} px, pieces of {sorted(share)}) goes to {cell}")
        for i in inside:
            piece_cell[i] = cell
        content.setdefault(cell, []).append(comp)
    by_cell = {}
    for i, p in enumerate(pieces):
        by_cell.setdefault(piece_cell[i], []).append(p)

    frames = {}
    for cell in used:
        if cell not in by_cell:
            sys.exit(f"{name}: cell {cell} has no piece")
        comps = content[cell]
        x0 = min(c["box"][0] for c in comps) - PAD
        y0 = min(c["box"][1] for c in comps) - PAD
        x1 = max(c["box"][2] for c in comps) + PAD
        y1 = max(c["box"][3] for c in comps) + PAD
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
        clip = FIX.get(f"{name}:{cell[0]}:{cell[1]}", {}).get("clip")
        if clip:
            x0, y0 = max(x0, clip[0] if clip[0] is not None else x0), max(y0, clip[1] if clip[1] is not None else y0)
            x1, y1 = min(x1, clip[2] if clip[2] is not None else x1), min(y1, clip[3] if clip[3] is not None else y1)
        big = by_cell[cell]
        largest = max(big, key=lambda p: p["area"])
        bx0 = min(p["box"][0] for p in big)
        by0 = min(p["box"][1] for p in big)
        bx1 = max(p["box"][2] for p in big)
        by1 = max(p["box"][3] for p in big)
        r, c = cell
        if spec["anchor"] == "piece":
            mid, foot = (largest["box"][0] + largest["box"][2]) / 2, largest["box"][3]
        elif spec["anchor"] == "union":
            mid, foot = (bx0 + bx1) / 2, largest["box"][3]
        elif spec["anchor"] == "centre":
            mid, foot = (c - 0.5) * cw, (r - 0.5) * ch
        else:
            mid, foot = (c - 0.5) * cw, largest["box"][3]
        frames[cell] = {"rect": [x0, y0, x1 - x0, y1 - y0], "foot": foot, "mid": mid, "size": (bx1 - bx0, by1 - by0), "pixels": [c["pixels"] for c in comps]}

    # rects must not overlap: a crop may never show a neighbour's paint
    keys = sorted(frames)
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            ra, rb = frames[a]["rect"], frames[b]["rect"]
            if ra[0] < rb[0] + rb[2] and rb[0] < ra[0] + ra[2] and ra[1] < rb[1] + rb[3] and rb[1] < ra[1] + ra[3]:
                sys.exit(f"{name}: the rects of {a} {ra} and {b} {rb} overlap")
    # a frame may reach past its cell only as far as its own paint overhangs (the review allows 24 px), never more
    for (r, c), f in frames.items():
        x, y, fw, fh = f["rect"]
        over = max((c - 1) * cw - x, x + fw - c * cw, (r - 1) * ch - y, y + fh - r * ch, 0)
        if over > OVERHANG + PAD:
            sys.exit(f"{name}: frame {r}:{c} overhangs its cell by {over} px")

    # keep a pixel only inside its own frame's rect: unused cells, and paint a FIX clips off, are cleared
    keep = bytearray(w * h)
    for f in frames.values():
        x, y, fw, fh = f["rect"]
        for comp in f["pixels"]:
            for q in comp:
                qy, qx = divmod(q, w)
                if x <= qx < x + fw and y <= qy < y + fh:
                    keep[q] = 1
    cleared = 0
    for i in range(w * h):
        if not keep[i] and px[i * 4 + 3]:
            px[i * 4: i * 4 + 4] = b"\0\0\0\0"
            cleared += 1
    return Image.frombytes("RGBA", (w, h), bytes(px)), frames, cleared


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.png")
    im.save(path, optimize=True)
    with open(path, "rb") as f:
        data = f.read()
    return {"sha256": hashlib.sha256(data).hexdigest(), "w": im.size[0], "h": im.size[1]}


def main():
    sheets, frames = {}, {}
    sizes = {}  # (sheet, row, col) -> measured size, for the scale groups
    groups = []
    for name, spec in SOURCES.items():
        if spec.get("tile"):
            im = Image.open(os.path.join(SRC, spec["src"]))
            if im.size[0] != im.size[1]:
                sys.exit(f"{name}: a floor tile must be square, not {im.size}")
            im = im.convert("RGB")
            sheets[name] = {"source": spec["src"], "grid": [1, 1], **save(im, name)}
            print(f"{name}: {im.size[0]} x {im.size[1]} tile")
            continue
        used = sorted({cell for _, g, _ in spec["groups"] for cell in g})
        im, measured, cleared = import_sheet(name, spec, used)
        sheets[name] = {"source": spec["src"], "grid": list(spec["grid"]), **save(im, name)}
        cols, rows = spec["grid"]
        cw, ch = im.size[0] // cols, im.size[1] // rows
        for (r, c), m in measured.items():
            key = f"{name}:{r}:{c}"
            fix = FIX.get(key, {})
            frames[key] = {"rect": m["rect"], "foot": m["foot"], "mid": m["mid"], "scale": None, "flip": bool(fix.get("flip"))}
            sizes[key] = m["size"]
        # on an animated sheet the generator drew each row of a subject on one ground line, and a pickaxe tip or a bob
        # moves a frame's own lowest row, so every frame of the row stands on the row's line: the median foot of its
        # grounded frames (FIX `air` frames are drawn off the ground and don't count). Hops, bobs and lunges stay as painted
        if spec["anchor"] == "cell":
            for _, members, _ in spec["groups"]:
                for r in sorted({r for r, _ in members}):
                    keys = [f"{name}:{r}:{c}" for rr, c in members if rr == r]
                    line = statistics.median(frames[k]["foot"] for k in keys if not FIX.get(k, {}).get("air"))
                    for k in keys:
                        frames[k]["foot"] = line
        for measure, members, basis in spec["groups"]:
            groups.append((name, measure, members, basis))
        print(f"{name}: {len(measured)} frames, {cleared} px outside them cleared")

    # scales: 1 / the median basis size. The heads (no basis of their own) share the wyrm body's scale
    scale_of = {}
    for name, measure, members, basis in groups:
        if basis is None:
            continue
        i = 0 if measure == "w" else 1
        s = 1 / statistics.median(sizes[f"{name}:{r}:{c}"][i] for r, c in basis)
        scale_of[name] = scale_of.get(name, s)
        for r, c in members:
            frames[f"{name}:{r}:{c}"]["scale"] = s
    for name, measure, members, basis in groups:
        if basis is None:
            for r, c in members:
                frames[f"{name}:{r}:{c}"]["scale"] = scale_of["wyrm"]
    for k, f in frames.items():
        f["scale"] = round(f["scale"], 8)
        f["mid"] = round(f["mid"], 2)
        f["foot"] = round(f["foot"], 2)

    fallback = {k: fallback_of(k) for k in sorted(frames) if fallback_of(k)}
    doc = {
        "generated": "python3 scripts/glimmer-cave-import.py",
        "keys": "<sheet>:<row>:<column>, counted from 1",
        "rect": "[x, y, w, h] in sheet px: the frame's content plus 6 px, inside its cell up to its own overhang",
        "foot": "sheet y of the ground line (exclusive bottom of the largest piece; an airborne frame keeps its row's line; effects: the cell centre)",
        "mid": "sheet x the frame is centred on (the cell centre on animated sheets, the largest piece's centre on single objects)",
        "scale": "1 / the subject's median basis size: drawn at px × scale per source px, the subject is px tall (blocks, props and effects: px wide)",
        "sheets": sheets,
        "frames": {k: frames[k] for k in sorted(frames)},
        "sequences": SEQUENCES,
        "fallback": fallback,
    }
    with open(os.path.join(ROOT, "docs/glimmer-cave-crops.json"), "w") as f:
        json.dump(doc, f, indent=1)
        f.write("\n")
    write_ts(doc)


def ts(value):
    return json.dumps(value, separators=(", ", ": ")).replace('"', "'")


def ts_obj(d, indent="  "):
    lines = ["{"]
    for k, v in d.items():
        key = k if k.isidentifier() else f"'{k}'"
        lines.append(f"{indent}{key}: {ts_inline(v)},")
    lines.append("}")
    return "\n".join(lines)


def ts_inline(v):
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{k if k.isidentifier() else repr(k)}: {ts_inline(x)}" for k, x in v.items()) + " }"
    if isinstance(v, list):
        return "[" + ", ".join(ts_inline(x) for x in v) + "]"
    if isinstance(v, str):
        return f"'{v}'"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def write_ts(doc):
    s = doc["sheets"]
    names = list(s)
    seq = doc["sequences"]
    out = [
        "// Generated by scripts/glimmer-cave-import.py from docs/glimmer-cave-crops.json: rerun the script, never edit by hand.",
        "// Frame keys are '<sheet>:<row>:<column>', counted from 1. A frame drawn at `px` × scale per source px shows its subject",
        "// at `px` tall (blocks, props and effects: `px` wide), with (mid, foot) on the anchor point.",
        "import type { Block, CritterId, Hero } from './glimmer-cave-data.js';",
        "",
        "export type CaveSheet = " + " | ".join(f"'{n}'" for n in names) + ";",
        "export const CAVE_SHEETS: readonly CaveSheet[] = " + ts_inline(names) + ";",
        "/** The first 12 hex digits of each cleaned file's SHA-256, for the URL's cache key. */",
        "export const CAVE_HASHES: Record<CaveSheet, string> = " + ts_obj({n: s[n]["sha256"][:12] for n in names}) + ";",
        "/** Each cleaned file's size; an image of any other size counts as failed. */",
        "export const CAVE_SIZES: Record<CaveSheet, { w: number; h: number }> = " + ts_obj({n: {"w": s[n]["w"], "h": s[n]["h"]} for n in names}) + ";",
        "/** Columns × rows of equal cells. */",
        "export const CAVE_GRIDS: Record<CaveSheet, [number, number]> = " + ts_obj({n: s[n]["grid"] for n in names}) + ";",
        "",
        "export type CaveFrame = { sheet: CaveSheet; rect: [number, number, number, number]; foot: number; mid: number; scale: number; flip: boolean };",
        "const f = (sheet: CaveSheet, x: number, y: number, w: number, h: number, foot: number, mid: number, scale: number, flip = false): CaveFrame =>",
        "  ({ sheet, rect: [x, y, w, h], foot, mid, scale, flip });",
        "export const CAVE_FRAMES: Record<string, CaveFrame> = {",
    ]
    for k, fr in doc["frames"].items():
        args = [f"'{k.split(':')[0]}'", *map(str, fr["rect"]), ts_inline(fr["foot"]), ts_inline(fr["mid"]), ts_inline(fr["scale"])]
        if fr["flip"]:
            args.append("true")
        out.append(f"  '{k}': f({', '.join(args)}),")
    out += [
        "};",
        "/** The sprites-0.png pose painted while a frame's own sheet is pending or failed. */",
        "export const CAVE_FALLBACK: Record<string, string> = " + ts_obj(doc["fallback"]) + ";",
        "",
        "export type HeroAnims = { walk: string[]; attack: string[]; idle: string[]; blink: string; flinch: string; dizzy: string; recover: string; dig: string[]; cheer: string[] };",
        "export const HERO_ANIMS: Record<Hero, HeroAnims> = " + ts_obj(seq["HERO_ANIMS"]) + ";",
        "/** Enzo's special: crouch, twist, acorns flying out, land. */",
        "export const ENZO_SPIN = " + ts_inline(seq["ENZO_SPIN"]) + ";",
        "/** Dora wiping her brow. */",
        f"export const DORA_WIPE = '{seq['DORA_WIPE']}';",
        "export type CritterAnims = { walk: string[]; flinch: string; dizzy: string; attack: string[] };",
        "export const CRITTER_ANIMS: Record<CritterId, CritterAnims> = " + ts_obj(seq["CRITTER_ANIMS"]) + ";",
        "export type CaveFx = " + " | ".join(f"'{k}'" for k in seq["FX_ANIMS"]) + ";",
        "/** Effects are anchored on their centre: pass the effect's centre as the foot point. */",
        "export const FX_ANIMS: Record<CaveFx, string[]> = " + ts_obj(seq["FX_ANIMS"]) + ";",
        "export type CaveBlock = Exclude<Block, 'floor'> | 'pod';",
        "/** Each block's dig stages, first to last. */",
        "export const BLOCKS: Record<CaveBlock, string[]> = " + ts_obj(seq["BLOCKS"]) + ";",
        "export type WyrmPart = " + " | ".join(f"'{k}'" for k in seq["WYRM_PARTS"]) + ";",
        "/** The wyrm's head poses, chain pieces and boulder pile, all at one scale: `px` is a body segment's height. */",
        "export const WYRM_PARTS: Record<WyrmPart, string> = " + ts_obj(seq["WYRM_PARTS"]) + ";",
        "/** The crystal pickup: only the concept sheet paints one. */",
        f"export const CRYSTAL = '{seq['CRYSTAL']}';",
        "",
    ]
    with open(os.path.join(ROOT, "lib/glimmer-cave-crops.ts"), "w") as f:
        f.write("\n".join(out))


if __name__ == "__main__":
    main()
