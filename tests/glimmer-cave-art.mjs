import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import * as D from '../.checks/glimmer-cave-data.js';
import * as A from '../.checks/glimmer-cave-paint.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const crops = JSON.parse(readFileSync(new URL('../docs/glimmer-cave-crops.json', import.meta.url), 'utf8'));
const file = (s) => new URL(`../public/art/cave/${s}.png`, import.meta.url);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG. */
function decode(buf) {
  let p = 8, w = 0, h = 0, type = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4); type = body[9];
      assert.equal(body[8], 8, '8-bit'); assert.equal(body[12], 0, 'not interlaced');
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const n = type === 6 ? 4 : type === 2 ? 3 : 0;
  assert.ok(n, `colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * n, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, row = y * stride;
    for (let i = 0; i < stride; i++) {
      const v = raw[src + i], a = i >= n ? out[row + i - n] : 0, b = y ? out[row - stride + i] : 0, c = y && i >= n ? out[row - stride + i - n] : 0;
      let r;
      if (f === 0) r = v;
      else if (f === 1) r = v + a;
      else if (f === 2) r = v + b;
      else if (f === 3) r = v + ((a + b) >> 1);
      else { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[row + i] = r & 255;
    }
  }
  return { w, h, n, data: out };
}
const images = Object.fromEntries(A.CAVE_SHEETS.map((s) => [s, decode(readFileSync(file(s)))]));
const cellOf = (key) => {
  const [s, r, c] = key.split(':'), [cols, rows] = A.CAVE_GRIDS[s], { w, h } = A.CAVE_SIZES[s];
  const cw = w / cols, ch = h / rows;
  return { s, r: +r, c: +c, l: (+c - 1) * cw, t: (+r - 1) * ch, rt: +c * cw, b: +r * ch, cw, ch };
};

// ---- the files ----

test('files: every cleaned sheet exists, is 1536 × 1024 (the floor any square), and matches its recorded hash; URLs carry the first 12 hex', () => {
  assert.deepEqual([...A.CAVE_SHEETS].sort(), Object.keys(crops.sheets).sort());
  assert.deepEqual([...A.CAVE_SHEETS].sort(), ['critters', 'dora', 'environment', 'enzo', 'enzodig', 'floor', 'fx', 'sprites', 'wyrm', 'wyrmheads']);
  for (const s of A.CAVE_SHEETS) {
    assert.ok(existsSync(file(s)), s);
    const buf = readFileSync(file(s)), want = crops.sheets[s];
    assert.equal(buf.toString('ascii', 1, 4), 'PNG', s);
    const size = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.deepEqual(size, [want.w, want.h], s);
    assert.deepEqual(A.CAVE_SIZES[s], { w: want.w, h: want.h }, s);
    if (s === 'floor') assert.equal(size[0], size[1], 'the floor is square');
    else assert.deepEqual(size, [1536, 1024], s);
    assert.equal(sha(buf), want.sha256, `${s} is the recorded file byte for byte`);
    assert.equal(A.CAVE_HASHES[s], want.sha256.slice(0, 12));
    assert.equal(A.caveArtUrl(s), `/art/cave/${s}.png?v=${want.sha256.slice(0, 12)}`);
  }
});

test('files: no pixel has alpha between 1 and 31, or above 239 and below 255; clear pixels carry no colour; the floor is opaque', () => {
  for (const s of A.CAVE_SHEETS) {
    const { n, data } = images[s];
    if (s === 'floor') { assert.equal(n, 3, 'the floor tile is RGB'); continue; }
    assert.equal(n, 4, `${s} is RGBA`);
    let faint = 0, nearly = 0, tinted = 0, solid = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a >= 1 && a <= 31) faint++;
      else if (a >= 240 && a <= 254) nearly++;
      else if (a === 0 && (data[i] || data[i + 1] || data[i + 2])) tinted++;
      if (a === 255) solid++;
    }
    assert.deepEqual([faint, nearly, tinted], [0, 0, 0], s);
    assert.ok(solid > 10000, `${s} has solid paint`);
  }
});

// ---- the frames ----

const bySheet = (s) => Object.entries(A.CAVE_FRAMES).filter(([, f]) => f.sheet === s);

test('frames: the table is the recorded one; every rect lies inside its own cell, up to its own overhang', () => {
  assert.equal(Object.keys(A.CAVE_FRAMES).length, Object.keys(crops.frames).length);
  for (const [key, f] of Object.entries(A.CAVE_FRAMES)) {
    const m = crops.frames[key];
    assert.ok(m, key);
    assert.deepEqual([[...f.rect], f.foot, f.mid, f.scale, f.flip], [m.rect, m.foot, m.mid, m.scale, m.flip], key);
    assert.equal(f.sheet, key.split(':')[0], key);
    const { l, t, rt, b } = cellOf(key), [x, y, w, h] = f.rect;
    assert.ok(w > 0 && h > 0 && f.scale > 0, key);
    // the review allows a piece 24 px over its cell line; the crop adds 6 px around it
    assert.ok(x >= l - 30 && y >= t - 30 && x + w <= rt + 30 && y + h <= b + 30, `${key} inside its cell`);
    assert.ok(x >= 0 && y >= 0 && x + w <= A.CAVE_SIZES[f.sheet].w && y + h <= A.CAVE_SIZES[f.sheet].h, `${key} inside the sheet`);
  }
  assert.ok(!bySheet('floor').length, 'the floor is a tile, not frames');
  assert.ok(!Object.keys(A.CAVE_FRAMES).some((k) => k.startsWith('wyrm:1:')), "wyrm-v1's row 1 drew whole wyrms and is left out");
});

test("frames: no crop holds another frame's paint, and nothing is painted outside every crop", () => {
  for (const s of A.CAVE_SHEETS) {
    if (s === 'floor') continue;
    const frames = bySheet(s);
    frames.forEach(([ka, a], i) => frames.slice(i + 1).forEach(([kb, b]) => {
      const [ax, ay, aw, ah] = a.rect, [bx, by, bw, bh] = b.rect;
      assert.ok(!(ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah), `${ka} and ${kb} overlap`);
    }));
    const { w, h, data } = images[s], inside = new Uint8Array(w * h);
    for (const [, f] of frames) { const [x, y, fw, fh] = f.rect; for (let yy = y; yy < y + fh; yy++) inside.fill(1, yy * w + x, yy * w + x + fw); }
    let stray = 0;
    for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] && !inside[i]) stray++;
    assert.equal(stray, 0, `${s}: paint outside the crops`);
  }
});

test('frames: every row of a character sheet stands on foot lines within 6 px at the 160 px design size; scales are one per subject', () => {
  const subjects = { enzo: [[1, 6]], dora: [[1, 6]], critters: [[1, 6]] };
  for (const s of Object.keys(subjects)) for (let r = 1; r <= 4; r++) {
    // the critters' attack row holds three subjects, two frames each
    const runs = s === 'critters' && r === 4 ? [[1, 2], [3, 4], [5, 6]] : subjects[s];
    for (const [c0, c1] of runs) {
      const fs = [];
      for (let c = c0; c <= c1; c++) fs.push(A.CAVE_FRAMES[`${s}:${r}:${c}`]);
      const local = fs.map((f) => f.foot - (r - 1) * 256);
      assert.ok((Math.max(...local) - Math.min(...local)) * fs[0].scale * 160 <= 6, `${s} row ${r} columns ${c0}-${c1}: ${local}`);
      local.forEach((y) => assert.ok(y > 160 && y < 256, `${s} row ${r}: the line ${y} is near the cell's bottom`));
    }
  }
  for (const s of ['enzo', 'dora']) assert.equal(new Set(bySheet(s).map(([, f]) => f.scale)).size, 1, `${s}: one scale`);
  for (const [critter, row] of [['soot', 1], ['mite', 2], ['beetle', 3]]) {
    const anims = A.CRITTER_ANIMS[critter];
    assert.equal(new Set([...anims.walk, anims.flinch, anims.dizzy, ...anims.attack].map((k) => A.CAVE_FRAMES[k].scale)).size, 1, `${critter}: one scale for its row ${row} and its attack`);
  }
  assert.equal(new Set(Object.values(A.WYRM_PARTS).map((k) => A.CAVE_FRAMES[k].scale)).size, 1, 'the wyrm: heads and pieces at one scale');
  // the subject's median walk or idle frame comes out at the asked-for size
  const heights = [...A.HERO_ANIMS.enzo.walk, ...A.HERO_ANIMS.enzo.idle].map((k) => A.CAVE_FRAMES[k]).map((f) => f.rect[3] * f.scale);
  assert.ok(heights.every((h) => h > 0.9 && h < 1.25), `${heights}`);
  // Enzo's dig sheet is sized by its raise frame, sitting up tall, at the hero's height; slam is long and low
  const dig = A.HERO_ANIMS.enzo.dig.map((k) => A.CAVE_FRAMES[k]);
  assert.ok(Math.abs(dig[0].rect[3] * dig[0].scale - 1.05) < 0.05, `raise ${dig[0].rect[3] * dig[0].scale}`);
  assert.ok(dig[1].rect[3] * dig[1].scale < 0.75, 'slam is low');
});

test('frames: every sequence names existing frames, and dora:4:2 is flipped', () => {
  const names = [];
  for (const hero of ['dora', 'enzo']) {
    const a = A.HERO_ANIMS[hero];
    assert.deepEqual(Object.keys(a).sort(), ['attack', 'blink', 'cheer', 'dig', 'dizzy', 'flinch', 'idle', 'recover', 'walk']);
    for (const v of Object.values(a)) names.push(...[v].flat());
    assert.equal(a.walk.length, 6); assert.equal(a.attack.length, 6);
    assert.ok([...a.walk, ...a.attack].every((k) => k.startsWith(`${hero}:`)), hero);
  }
  assert.deepEqual(Object.keys(A.HERO_ANIMS).sort(), ['dora', 'enzo']);
  assert.deepEqual(Object.keys(A.CRITTER_ANIMS).sort(), [...D.CRITTER_IDS].sort());
  for (const a of Object.values(A.CRITTER_ANIMS)) { assert.equal(a.walk.length, 4); assert.equal(a.attack.length, 2); names.push(...a.walk, ...a.attack, a.flinch, a.dizzy); }
  assert.deepEqual(Object.keys(A.BLOCKS).sort(), ['bedrock', 'crate', 'dirt', 'gold', 'lantern', 'pod']);
  assert.equal(A.BLOCKS.gold.length, 3, 'the gold block cracks in three stages');
  names.push(...Object.values(A.FX_ANIMS).flat(), ...Object.values(A.BLOCKS).flat(), ...Object.values(A.WYRM_PARTS), ...A.ENZO_SPIN, A.DORA_WIPE, A.CRYSTAL);
  for (const [k, v] of Object.entries(A.CAVE_FALLBACK)) { names.push(k, v); assert.equal(A.CAVE_FRAMES[v].sheet, 'sprites', k); }
  for (const k of names) assert.ok(A.CAVE_FRAMES[k], `${k} exists`);
  // every animated frame is used somewhere
  const used = new Set(names);
  for (const s of ['enzo', 'enzodig', 'dora', 'critters', 'fx', 'environment', 'wyrm', 'wyrmheads']) for (const [k] of bySheet(s)) assert.ok(used.has(k), `${k} is used`);
  assert.deepEqual(A.HERO_ANIMS.enzo.dig, ['enzodig:1:1', 'enzodig:1:2', 'enzodig:1:3'], 'Enzo digs with his own raise, slam and fling');
  assert.equal(A.CAVE_FALLBACK['enzodig:1:2'], 'sprites:1:1');
  assert.equal(A.CAVE_FRAMES['dora:4:2'].flip, true);
  assert.deepEqual(Object.entries(A.CAVE_FRAMES).filter(([, f]) => f.flip).map(([k]) => k).sort(), ['dora:4:2', 'sprites:1:2']);
  assert.equal(A.CAVE_FALLBACK['enzo:2:4'], 'sprites:1:1');
  assert.equal(A.CAVE_FALLBACK['critters:4:6'], 'sprites:2:1', "the beetle's ram falls back to the beetle");
});

// ---- the loader and painters ----

test('loader: no Image means no request (the server render)', () => {
  A.requestCaveArt(['enzo']);
  assert.deepEqual(A.caveArtStatus(), { ready: [], pending: [], failed: [] });
  assert.equal(A.caveArtReady(['enzo']), false);
  assert.equal(A.frameCanvas('enzo:1:1', 48, 1), null);
});

/** A canvas context that records calls, with a device scale of `dpr`. */
function context(dpr = 1) {
  const calls = [];
  const c = { calls, globalAlpha: 1, getTransform: () => ({ a: dpr, d: dpr, e: 0, f: 0 }) };
  for (const k of ['drawImage', 'save', 'restore', 'translate', 'scale', 'fillRect']) c[k] = (...a) => calls.push([k, ...a]);
  return c;
}

test('loader: one request per file, failures, Retry, stale callbacks and wrong sizes', () => {
  const made = [], canvases = [];
  class FakeImage {
    naturalWidth = 1536; naturalHeight = 1024;
    constructor() { made.push(this); }
    set src(v) { this.url = v; }
    load() { this.onload(); }
    fail() { this.onerror(); }
  }
  globalThis.Image = FakeImage;
  globalThis.document = { createElement: () => { const k = { width: 0, height: 0, ctx: context() }; k.getContext = () => k.ctx; canvases.push(k); return k; } };
  try {
    let heard = 0;
    const v = A.caveArtVersion(), off = A.subscribeCaveArt(() => heard++);
    const c = context();
    A.requestCaveArt(['enzo', 'dora']); A.requestCaveArt(['enzo', 'dora', '../../etc', 'nope']);
    assert.equal(made.length, 2, 'two files, asked for once each; unknown names never become requests');
    assert.equal(made[0].url, A.caveArtUrl('enzo'));
    assert.equal(A.frameCanvas('enzo:1:1', 48, 1), null, 'pending: no canvas yet');
    assert.equal(A.paintCaveFrame(c, 'enzo:1:1', 100, 200, 48), false, 'pending, and the fallback sheet pending too');
    assert.equal(made.length, 3, 'the fallback pose sheet is asked for');
    assert.equal(made[2].url, A.caveArtUrl('sprites'));
    made[0].fail(); made[1].load();
    assert.ok(A.caveArtVersion() > v && heard > 0, 'subscribers hear arrivals and failures');
    for (let k = 0; k < 60; k++) assert.equal(A.paintCaveFrame(c, 'enzo:1:1', 100, 200, 48), false);
    assert.equal(made.length, 3, 'a failed file is not asked for again every frame');
    assert.deepEqual(A.caveArtStatus().failed, ['enzo']);
    A.retryCaveArt();
    assert.equal(made.length, 4, 'Retry asks again for the failed file only');
    made[0].load();
    assert.deepEqual(A.caveArtStatus().pending.sort(), ['enzo', 'sprites'], 'the old attempt cannot complete the retry');
    made[3].load();
    assert.equal(A.caveArtReady(['enzo', 'dora']), true);
    off();

    // a frame is drawn once at its size, then cached by key, size and device scale
    const n0 = canvases.length, k1 = A.frameCanvas('enzo:1:1', 48, 2);
    assert.ok(k1);
    assert.equal(A.frameCanvas('enzo:1:1', 48, 2), k1);
    assert.notEqual(A.frameCanvas('enzo:1:1', 48, 1), k1);
    assert.notEqual(A.frameCanvas('enzo:1:1', 60, 2), k1);
    assert.equal(canvases.length, n0 + 3);
    const f = A.CAVE_FRAMES['enzo:1:1'], kk = f.scale * 48 * 2;
    assert.deepEqual([k1.width, k1.height], [Math.round(f.rect[2] * kk), Math.round(f.rect[3] * kk)]);
    assert.deepEqual(k1.ctx.calls.map((x) => x[0]), ['drawImage'], 'not flipped');
    assert.deepEqual(k1.ctx.calls[0].slice(2), [...f.rect, 0, 0, k1.width, k1.height]);
    const flipped = A.frameCanvas('dora:4:2', 48, 1);
    assert.deepEqual(flipped.ctx.calls.map((x) => x[0]), ['translate', 'scale', 'drawImage'], 'dora:4:2 is mirrored once, in the canvas');
    assert.deepEqual(flipped.ctx.calls[1].slice(1), [-1, 1]);
    assert.equal(A.frameCanvas('nope:1:1', 48, 1), null);
    assert.equal(A.frameCanvas('enzo:1:1', 0, 1), null);

    // the anchor (mid, foot) lands on (x, footY); mirroring turns the picture about it
    c.calls.length = 0;
    assert.equal(A.paintCaveFrame(c, 'enzo:2:4', 100, 200, 48), true);
    const g = A.CAVE_FRAMES['enzo:2:4'], s = g.scale * 48, [, , dx, dy, dw, dh] = c.calls[0];
    assert.ok(Math.abs(dx + (g.mid - g.rect[0]) * s - 100) < 1e-9 && Math.abs(dy + (g.foot - g.rect[1]) * s - 200) < 1e-9, 'anchor on the point');
    assert.ok(Math.abs(dw - g.rect[2] * s) < 1e-9 && Math.abs(dh - g.rect[3] * s) < 1e-9);
    c.calls.length = 0;
    assert.equal(A.paintCaveFrame(c, 'enzo:2:4', 100, 200, 48, true), true);
    assert.deepEqual(c.calls.map((x) => x[0]), ['save', 'translate', 'scale', 'drawImage', 'restore']);
    assert.deepEqual(c.calls[1].slice(1), [100, 0]);
    assert.ok(Math.abs(c.calls[3][2] + (g.mid - g.rect[0]) * s) < 1e-9, 'mirrored about the anchor');
    // a flipped frame's anchor mirrors within its crop
    c.calls.length = 0;
    A.paintCaveFrame(c, 'dora:4:2', 100, 200, 48);
    const d = A.CAVE_FRAMES['dora:4:2'], ds = d.scale * 48;
    assert.ok(Math.abs(c.calls[0][2] + (d.rect[0] + d.rect[2] - d.mid) * ds - 100) < 1e-9);

    // a missing sheet falls back to the sprites-0 pose; with no pose either, code draws
    A.requestCaveArt(['critters']); made.at(-1).fail();
    c.calls.length = 0;
    assert.equal(A.paintCaveFrame(c, 'critters:2:3', 50, 60, 24), false, 'the pose sheet is still pending');
    made[2].load();
    assert.equal(A.paintCaveFrame(c, 'critters:2:3', 50, 60, 24), true, 'the mite pose stands in');
    const pose = A.CAVE_FRAMES['sprites:1:4'];
    assert.ok(Math.abs(c.calls.at(-1)[5] - pose.rect[3] * pose.scale * 24) < 1e-9, 'at the asked-for size');
    assert.equal(A.paintCaveFrame(c, 'fx:1:1', 50, 60, 24), false, 'effects have no pose: pending');

    // blocks: the stage picks the painting, clamped; the block is as wide as its tile and stands on its bottom edge
    A.requestCaveArt(['environment']); made.at(-1).load();
    c.calls.length = 0;
    assert.equal(A.paintCaveBlock(c, 'gold', 9, 10, 20, 40), true);
    const last = A.CAVE_FRAMES[A.BLOCKS.gold[2]], bs = last.scale * 40, [, , bx, by, bw] = c.calls[0];
    assert.ok(Math.abs(by + (last.foot - last.rect[1]) * bs - 60) < 1e-9 && Math.abs(bx + (last.mid - last.rect[0]) * bs - 30) < 1e-9);
    assert.ok(bw > 40 && bw < 48, 'about a tile wide, padding and all');
    assert.equal(A.paintCaveBlock(c, 'gold', -1, 10, 20, 40), true);
    assert.equal(A.paintCaveBlock(c, 'gold', NaN, 10, 20, 40), false);
    assert.equal(A.paintCaveBlock(c, 'dirt', 0, 10, 20, 0), false);

    // the floor: world-fixed tiles cover the stage on whole device pixels, then the tint
    assert.equal(A.paintCaveFloor(context(), { x: 0, y: 0, w: 480, h: 320, tilePx: 32 }), false, 'pending');
    made.at(-1).naturalWidth = 1254; made.at(-1).naturalHeight = 1254; made.at(-1).load();
    for (const [x, y, dpr] of [[0, 0, 1], [131.37, -45.2, 2], [7 * 192 + 17.2, 999.9, 2.625]]) {
      const b = context(dpr);
      assert.equal(A.paintCaveFloor(b, { x, y, w: 480, h: 320, tilePx: 32 }, '#7a4a8c'), true);
      const tiles = b.calls.filter((k) => k[0] === 'drawImage').map((k) => k.slice(6));
      const period = A.CAVE_FLOOR_TILES * 32;
      for (const [l, t, w, h] of tiles) {
        assert.ok(Math.abs(w - period) < 1 && Math.abs(h - period) < 1, 'one painting per period');
        for (const e of [l, t, l + w, t + h]) assert.ok(Math.abs(e * dpr - Math.round(e * dpr)) < 1e-6, `edge ${e} on a device pixel`);
      }
      const covers = (px, py) => tiles.some(([l, t, w, h]) => px >= l && px < l + w && py >= t && py < t + h);
      for (const [px, py] of [[0, 0], [479.9, 0], [0, 319.9], [479.9, 319.9], [240, 160]]) assert.ok(covers(px, py), `covers ${px}, ${py}`);
      const left = tiles.map((k) => k[0] + x);
      assert.ok(left.every((v) => Math.abs(v / period - Math.round(v / period)) < 0.02), 'fixed to the world');
      assert.deepEqual(b.calls.slice(-3).map((k) => k[0]), ['save', 'fillRect', 'restore'], 'the tint over the floor');
    }
    assert.equal(A.paintCaveFloor(context(), { x: NaN, y: 0, w: 480, h: 320, tilePx: 32 }), false);

    // a wrong-sized image is a failure, not a misplaced crop
    A.requestCaveArt(['wyrm']); made.at(-1).naturalWidth = 1024; made.at(-1).load();
    assert.ok(A.caveArtStatus().failed.includes('wyrm'));
    assert.equal(A.paintCaveFrame(c, A.WYRM_PARTS.body, 0, 0, 30), false, 'no pose for the wyrm: code draws it');
    A.retryCaveArt(); made.at(-1).load();
    assert.equal(A.paintCaveFrame(c, A.WYRM_PARTS.body, 0, 0, 30), true);

    // bad arguments paint nothing
    assert.equal(A.paintCaveFrame(c, 'enzo:1:1', NaN, 0, 30), false);
    assert.equal(A.paintCaveFrame(c, 'enzo:1:1', 0, 0, -3), false);
    assert.equal(A.paintCaveFrame(c, 'nope', 0, 0, 30), false);
  } finally { delete globalThis.Image; delete globalThis.document; }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Glimmer Cave art');
