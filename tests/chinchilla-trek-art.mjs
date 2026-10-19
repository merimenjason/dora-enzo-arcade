import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as G from '../.checks/chinchilla-trek-game.js';
import * as A from '../.checks/chinchilla-trek-paint.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const crops = json('docs/chinchilla-trek-crops.json'), made = json('docs/chinchilla-trek-generation.json');
const file = (key) => new URL(`../public/art/trek/${key}.png`, import.meta.url);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// ---- the files ----

test('files: all twelve are the delivered PNGs at 1536 × 1024, versioned by their own hash', () => {
  assert.equal(A.TREK_ASSETS.length, 12);
  for (const key of A.TREK_ASSETS) {
    assert.ok(existsSync(file(key)), key);
    const buf = readFileSync(file(key)), url = A.trekArtUrl(key);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG', key);
    assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [1536, 1024], key);
    const want = made.assets.find((a) => a.name === `${key}.png`)?.sha256;
    assert.equal(sha(buf), want, `${key} is the delivered file byte for byte`);
    assert.equal(url, `/art/trek/${key}.png?v=${want.slice(0, 12)}`);
  }
});

// ---- the mapping ----

const SHEETS = {
  'foes-1': ['beetle', 'mice', 'toad', 'wasp', 'hedgepig', 'kingmole', 'magpie', 'stoat', 'sprite', 'piglet', 'raccoon', 'badger'],
  'foes-2': ['crab', 'heron', 'pike', 'vole', 'turtle', 'otter', 'snowhare', 'ptarmigan', 'goatkid', 'imp', 'pika', 'foxqueen'],
  'foes-3': ['bat', 'moth', 'wisp', 'owlet', 'shadowcat', 'hornedowl', 'x:owl', 'x:fox', 'x:pip', 'x:pipBag', 'x:pony', 'x:dizzy'],
  landmarks: ['story', 'crossroads', 'chest', 'chestOpen', 'wheel', 'cart', 'rest', 'acorn'],
  skills: [...G.SKILL_IDS, ...G.EVO_IDS, 'rest', 'reroll'],
  gear: ['hat', 'scarf', 'charm', 'boots'].flatMap((slot) => [0, 1, 2, 3, 4].map((r) => `${slot}:${r}`)),
};
const rectOf = (sheet, key) => {
  if (sheet === 'skills') return A.TREK_BADGES[key];
  if (sheet === 'gear') { const [slot, r] = key.split(':'); return A.TREK_GEAR[slot][+r]; }
  if (sheet === 'landmarks') return A.TREK_LANDMARKS[key].rect;
  const s = key.startsWith('x:') ? A.TREK_EXTRAS[key.slice(2)] : A.TREK_FOES[key];
  assert.equal(s.sheet, sheet, key);
  return s.rect;
};

test('mapping: every engine id has exactly one painting, and all 88 crops are used once', () => {
  assert.deepEqual(Object.keys(A.TREK_FOES).sort(), [...G.FOE_IDS].sort());
  assert.deepEqual(Object.keys(A.TREK_EXTRAS).sort(), ['dizzy', 'fox', 'owl', 'pip', 'pipBag', 'pony']);
  assert.deepEqual(Object.keys(A.TREK_BADGES).sort(), [...G.SKILL_IDS, ...G.EVO_IDS, 'rest', 'reroll'].sort());
  assert.deepEqual(Object.keys(A.TREK_GEAR).sort(), [...G.GEAR_SLOTS].sort());
  for (const slot of G.GEAR_SLOTS) assert.equal(A.TREK_GEAR[slot].length, G.RARITY.length, slot);
  assert.equal(crops.sprites.length, 88);
  assert.equal(Object.values(SHEETS).flat().length, 88);
});

test('mapping: each key is the measured padded crop at its documented index, inside its cell', () => {
  for (const [sheet, keys] of Object.entries(SHEETS)) keys.forEach((key, index) => {
    const m = crops.sprites.find((s) => s.asset === `${sheet}.png` && s.index === index);
    assert.ok(m, `${sheet}[${index}]`);
    const rect = rectOf(sheet, key);
    assert.deepEqual([...rect], m.rect, `${key} = ${m.name}`);
    const [x, y, w, h] = rect, [l, t, r, b] = m.cell, [bx, by, bw, bh] = m.bounds;
    assert.ok(x >= l && y >= t && x + w <= r && y + h <= b, `${key} inside its cell`);
    assert.ok(x <= bx && y <= by && x + w >= bx + bw && y + h >= by + bh, `${key} keeps its whole silhouette`);
  });
});

test('mapping: names agree with the delivery (foes by name, badges by skill name, gear by row and column)', () => {
  const name = (sheet, i) => crops.sprites.find((s) => s.asset === `${sheet}.png` && s.index === i).name;
  for (const [sheet, keys] of [['foes-1', SHEETS['foes-1']], ['foes-2', SHEETS['foes-2']], ['foes-3', SHEETS['foes-3'].slice(0, 6)]])
    keys.forEach((id, i) => assert.equal(name(sheet, i), G.FOES[id].name, id));
  [...G.SKILL_IDS].forEach((id, i) => assert.equal(name('skills', i), G.SKILLS[id].name, id));
  [...G.EVO_IDS].forEach((id, i) => assert.equal(name('skills', 18 + i), G.EVOS[id].name, id));
  assert.deepEqual([name('skills', 22), name('skills', 23)], ['Rest', 'Reroll']);
  ['Hat', 'Scarf', 'Charm', 'Boots'].forEach((slot, row) => [0, 1, 2, 3, 4].forEach((r) => assert.ok(name('gear', row * 5 + r).startsWith(`${slot} ·`), `${slot} ${r}`)));
  assert.deepEqual([6, 7, 8, 9, 10, 11].map((i) => name('foes-3', i)), ['The Owl', 'The Fox', 'Pip', 'Pip', "The Pedlar's pony", 'Dizzy stars']);
});

test('mapping: each backdrop path band holds the hero\'s feet; the wheel has a slice for each prize', () => {
  for (const ch of [1, 2, 3, 4, 5]) {
    const s = crops.surfaces[`bg-${ch}.png`], [top, bottom] = A.TREK_PATH[ch];
    assert.deepEqual([top, bottom], s.pathBandY);
    assert.equal(s.tileMode, 'alternate-mirror-required');
    assert.ok(top < (258 * 1024) / 320 && (258 * 1024) / 320 < bottom, `chapter ${ch}`);
  }
  assert.equal(A.TREK_WHEEL.prize.length, G.WHEEL.length);
  assert.equal(new Set(A.TREK_WHEEL.prize.map((a) => Math.floor(a / 45))).size, 8, 'every prize on its own slice');
});

// ---- the loader and painters ----

test('loader: no Image means no request (the server render)', () => {
  A.requestTrekArt(['title']);
  assert.deepEqual(A.trekArtStatus(), { ready: [], pending: [], failed: [] });
  assert.equal(A.trekArtReady(['title']), false);
});

/** A canvas that records calls, with a device scale of `dpr`. */
function canvas(dpr = 1) {
  const calls = [];
  const c = { calls, globalAlpha: 1, getTransform: () => ({ a: dpr, e: 0 }) };
  for (const k of ['drawImage', 'save', 'restore', 'translate', 'scale', 'rotate', 'beginPath', 'arc', 'rect', 'moveTo', 'lineTo', 'closePath', 'clip', 'fill']) c[k] = (...a) => calls.push([k, ...a]);
  return c;
}

test('loader and painters', () => {
  const images = [];
  class FakeImage {
    naturalWidth = 1536; naturalHeight = 1024;
    constructor() { images.push(this); }
    set src(v) { this.url = v; }
    load() { this.onload(); }
    fail() { this.onerror(); }
  }
  globalThis.Image = FakeImage;
  try {
    let heard = 0;
    const v = A.trekArtVersion(), off = A.subscribeTrekArt(() => heard++);
    const c = canvas(), box = { x: 10, y: 20, w: 60, h: 80 };
    A.requestTrekArt(['title', 'bg-1']); A.requestTrekArt(['title', 'bg-1', '../../etc', 'nope']);
    assert.equal(images.length, 2, 'two files, asked for once each; unknown names never become requests');
    assert.equal(images[0].url, A.trekArtUrl('title'));
    assert.equal(A.paintTrekTitle(c, box), false, 'pending: draw the fallback now');
    images[0].fail(); images[1].load();
    assert.ok(A.trekArtVersion() > v && heard > 0, 'subscribers hear arrivals and failures');
    for (let k = 0; k < 60; k++) assert.equal(A.paintTrekTitle(c, box), false);
    assert.equal(images.length, 2, 'a failed file is not asked for again every frame');
    assert.deepEqual(A.trekArtStatus().failed, ['title']);
    A.retryTrekArt();
    assert.equal(images.length, 3, 'Retry asks again for the failed file only');
    images[0].load();
    assert.deepEqual(A.trekArtStatus().pending, ['title'], 'the old attempt cannot complete the retry');
    images[2].load();
    assert.equal(A.paintTrekTitle(c, { x: 0, y: 0, w: 480, h: 320 }), true);
    assert.deepEqual(c.calls.at(-1).slice(2), [0, 0, 1536, 1024, 0, 0, 480, 320], 'the whole 3:2 frame, upper quarter and all');
    off();

    // a foe stands with its silhouette (not its padding) on the bottom of the box, facing left as painted
    A.requestTrekArt(['foes-2']); images.at(-1).load();
    c.calls.length = 0;
    assert.equal(A.paintTrekFoe(c, 'otter', box, -1), true);
    assert.deepEqual(c.calls.map((k) => k[0]), ['drawImage'], 'facing left: no flip');
    const [, , sx, sy, sw, sh, dx, dy, dw, dh] = c.calls[0];
    assert.deepEqual([sx, sy, sw, sh], [...A.TREK_FOES.otter.rect]);
    assert.ok(dw <= box.w + 1e-9 && dh <= box.h + 1e-9, 'contain fit never clips');
    assert.ok(Math.abs(dy + dh - 8 * (dh / sh) - (box.y + box.h)) < 1e-9, 'silhouette on the bottom of the box');
    assert.ok(Math.abs(dx + dw / 2 - (box.x + box.w / 2)) < 1e-9 && Math.abs(dw / dh - sw / sh) < 1e-9, 'centred, aspect kept');
    c.calls.length = 0;
    assert.equal(A.paintTrekFoe(c, 'otter', box, 1), true);
    assert.deepEqual(c.calls.map((k) => k[0]), ['save', 'translate', 'scale', 'drawImage', 'restore'], 'facing right: only the picture flips');
    assert.deepEqual(c.calls[2].slice(1), [-1, 1]);

    // badges and gear come from their own sheet's crop
    A.requestTrekArt(['skills', 'gear']); images.at(-2).load(); images.at(-1).load();
    c.calls.length = 0;
    assert.equal(A.paintTrekBadge(c, 'feast', { x: 0, y: 0, w: 32, h: 32 }), true);
    assert.equal(A.paintTrekPiece(c, 'boots', 4, { x: 0, y: 0, w: 40, h: 36 }), true);
    assert.deepEqual(c.calls[0].slice(2, 6), [...A.TREK_BADGES.feast]);
    assert.deepEqual(c.calls[1].slice(2, 6), [...A.TREK_GEAR.boots[4]]);
    assert.equal(A.paintTrekPiece(c, 'boots', 9, box), false, 'no such rarity');

    // the backdrop: two world tiles, odd ones mirrored by world position, edges meeting on whole device pixels
    for (const [dist, dpr] of [[0, 1], [131.37, 2], [480, 3], [959.5, 2.625], [7 * 480 + 17.2, 1.5]]) {
      const b = canvas(dpr);
      assert.equal(A.paintTrekBackdrop(b, 1, dist, 480, 320), true);
      const tiles = [];
      for (let i = 0; i < b.calls.length; i++) if (b.calls[i][0] === 'translate') tiles.push({ at: b.calls[i][1], flip: b.calls[i + 1][1], w: b.calls[i + 2][8] });
      assert.equal(tiles.length, 2);
      const first = Math.floor(dist / 480);
      tiles.forEach((t, i) => assert.equal(t.flip, (first + i) % 2 ? -1 : 1, `tile ${first + i} at ${dist}`));
      const edges = tiles.map((t) => (t.flip === 1 ? [t.at, t.at + t.w] : [t.at - t.w, t.at]));
      assert.ok(Math.abs(edges[0][1] - edges[1][0]) < 1e-9, 'no gap or overlap between tiles');
      assert.ok(edges[0][0] <= 1e-9 && edges[1][1] >= 480 - 1e-9, 'the stage is covered');
      for (const x of edges.flat()) assert.ok(Math.abs(x * dpr - Math.round(x * dpr)) < 1e-6, `edge ${x} on a device pixel at ${dpr}×`);
    }
    assert.equal(A.paintTrekBackdrop(canvas(), 2, 0, 480, 320), false, 'another chapter is asked for, not shown');
    assert.equal(A.paintTrekBackdrop(canvas(), 1, NaN, 480, 320), false);

    // the wheel turns its disc, and only its disc, by the prize's slice
    A.requestTrekArt(['landmarks']); images.at(-1).load();
    const w = canvas();
    assert.equal(A.paintTrekWheel(w, { x: 0, y: 0, w: 100, h: 100 }), true);
    assert.equal(w.calls.filter((k) => k[0] === 'rotate').length, 0, 'before the spin: no turn');
    const w2 = canvas();
    assert.equal(A.paintTrekWheel(w2, { x: 0, y: 0, w: 100, h: 100 }, 3), true);
    assert.deepEqual(w2.calls.filter((k) => k[0] === 'rotate').map((k) => k[1]), [(-A.TREK_WHEEL.prize[3] * Math.PI) / 180]);
    assert.equal(w2.calls.filter((k) => k[0] === 'clip').length, 2);
    assert.equal(w2.calls.filter((k) => k[0] === 'save').length, w2.calls.filter((k) => k[0] === 'restore').length);

    // a wrong-sized image is a failure, not a misplaced crop
    A.requestTrekArt(['foes-1']); images.at(-1).naturalWidth = 1024; images.at(-1).load();
    assert.ok(A.trekArtStatus().failed.includes('foes-1'));
    assert.equal(A.paintTrekFoe(c, 'beetle', box), false);
    assert.equal(A.trekArtReady(['foes-1', 'landmarks']), false);
    A.retryTrekArt(); images.at(-1).load();
    assert.equal(A.paintTrekFoe(c, 'beetle', box), true);
    assert.equal(A.trekArtReady(['foes-1', 'landmarks']), true);

    // bad boxes paint nothing
    assert.equal(A.paintTrekFoe(c, 'beetle', { x: 0, y: 0, w: 0, h: 10 }), false);
    assert.equal(A.paintTrekLandmark(c, 'acorn', { x: 0, y: 0, w: NaN, h: 10 }), false);
  } finally { delete globalThis.Image; }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Chinchilla Trek art');
