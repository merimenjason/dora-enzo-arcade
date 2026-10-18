import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as G from '../.checks/hay-bale-game.js';
import * as A from '../.checks/hay-bale-paint.js';

const { UNIT_IDS, SNACK_IDS } = G;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const crops = json('docs/hay-bale-brawl-crops.json'), made = json('docs/hay-bale-brawl-generation.json');
const fxCrops = json('docs/hay-bale-brawl-fx-crops.json'), fxMade = json('docs/hay-bale-brawl-fx-generation.json');
const file = (key) => new URL(`../public/art/brawl/${key}.${A.brawlArtUrl(key).split('?')[0].split('.').pop()}`, import.meta.url);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
/** Width and height from a PNG's IHDR or a lossy WebP's VP8 frame header. */
function size(buf) {
  if (buf.toString('ascii', 1, 4) === 'PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  assert.equal(buf.toString('ascii', 8, 16), 'WEBPVP8 ', 'a lossy WebP');
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
}

// ---- the files ----

test('files: all eight are served at 1536 × 1024, versioned by their own hash', () => {
  assert.equal(A.BRAWL_ASSETS.length, 8);
  for (const key of A.BRAWL_ASSETS) {
    assert.ok(existsSync(file(key)), key);
    const buf = readFileSync(file(key)), url = A.brawlArtUrl(key);
    assert.deepEqual(size(buf), [1536, 1024], key);
    assert.equal(url.split('?v=')[1], sha(buf).slice(0, 12), `${key} version`);
    assert.match(url, /^\/art\/brawl\/[a-z0-9-]+\.(png|webp)\?v=[0-9a-f]{12}$/);
  }
});

test('files: the sheets and title are the delivered PNGs byte for byte', () => {
  const delivered = Object.fromEntries(made.assets.map((a) => [a.file ?? a.path?.split('/').pop() ?? a.name, a.sha256]));
  for (const key of ['critters-1', 'critters-2', 'critters-3', 'snacks', 'title']) {
    const want = Object.entries(delivered).find(([name]) => String(name).endsWith(`${key}.png`))?.[1];
    assert.ok(want, `${key} in the manifest`);
    assert.equal(sha(readFileSync(file(key))), want, key);
  }
});

test('files: the effects sheet is the delivered PNG byte for byte', () => {
  assert.equal(sha(readFileSync(file('fx'))), fxMade.sha256);
  assert.equal(fxCrops.sha256, fxMade.sha256, 'the crops were measured on this file');
  assert.match(A.brawlArtUrl('fx'), /^\/art\/brawl\/fx\.png\?v=fe0a4128c317$/);
});

// ---- the mapping ----

const SHEETS = {
  'critters-1': ['wren', 'mouse', 'ladybird', 'toad', 'bee', 'dormouse', 'hedgehog', 'squirrel', 'robin', 'mole', 'frog', 'pip'],
  'critters-2': ['badger', 'otter', 'magpie', 'rabbit', 'porcupine', 'beaver', 'stoat', 'tortoise', 'crow', 'skunk', 'raccoon', 'hare'],
  'critters-3': ['boar', 'bear', 'stag', 'duchess', 'hawk', 'goose', 'mouselet', 'log', 'fawn', 'dora', 'enzo', 'bale'],
  snacks: ['apple', 'raisin', 'honey', 'hay', 'mint', 'chilli', 'seed', 'cake'],
};
const spriteOf = (key) => A.BRAWL_UNITS[key] ?? A.BRAWL_SNACKS[key] ?? A.BRAWL_EXTRAS[key];

test('mapping: every unit, summon and snack is painted once, coaches and the bale kept apart', () => {
  assert.deepEqual(Object.keys(A.BRAWL_UNITS).sort(), [...UNIT_IDS, 'mouselet', 'log', 'fawn'].sort());
  assert.deepEqual(Object.keys(A.BRAWL_SNACKS).sort(), [...SNACK_IDS].sort());
  assert.deepEqual(Object.keys(A.BRAWL_EXTRAS).sort(), ['bale', 'dora', 'enzo']);
  const seen = new Set();
  for (const key of Object.values(SHEETS).flat()) { const s = spriteOf(key); assert.ok(s, key); const at = `${s.sheet}:${s.rect}`; assert.ok(!seen.has(at), `${key} shares a crop`); seen.add(at); }
  assert.equal(seen.size, 44);
});

test('mapping: each key uses the measured padded crop at its documented index', () => {
  for (const [sheet, keys] of Object.entries(SHEETS)) keys.forEach((key, index) => {
    const m = crops.sprites.find((s) => s.asset === `${sheet}.png` && s.index === index), s = spriteOf(key);
    assert.ok(m, `${sheet}[${index}]`);
    assert.equal(s.sheet, sheet, key);
    assert.deepEqual([...s.rect], m.rect, `${key} = ${m.name}`);
    const [x, y, w, h] = s.rect, [l, t, r, b] = m.cell;
    assert.ok(x >= l && y >= t && x + w <= r && y + h <= b && x + w <= 1536 && y + h <= 1024, `${key} inside its cell`);
  });
  assert.equal(A.BRAWL_FIGHT_STAGE_Y, Math.round((crops.surfaces['bg-fight.png'].visualStageY * 320) / 1024 * 10) / 10);
});

test('mapping: twelve effects, each the measured padded crop at its index and inside its cell', () => {
  assert.deepEqual([...A.BRAWL_FX_IDS], ['bonk', 'dust', 'poof', 'hay', 'gold', 'green', 'frost', 'crumbs', 'acorn', 'shell', 'mint', 'chilli']);
  assert.equal(fxCrops.sprites.length, 12);
  A.BRAWL_FX_IDS.forEach((id, index) => {
    const m = fxCrops.sprites.find((s) => s.index === index), rect = A.BRAWL_FX[id];
    assert.equal(m.name, id);
    assert.deepEqual([...rect], m.rect, id);
    const [x, y, w, h] = rect, [l, t, r, b] = m.cell, [bx, by, bw, bh] = m.bounds;
    assert.ok(x >= l && y >= t && x + w <= r && y + h <= b, `${id} inside its cell`);
    assert.ok(x <= bx && y <= by && x + w >= bx + bw && y + h >= by + bh, `${id} keeps its whole silhouette`);
  });
});

test('mapping: sheets for a crew', () => {
  assert.deepEqual(A.brawlSheetsFor(['wren', 'bear', 'fawn', 'pip']), ['critters-1', 'critters-3']);
  assert.deepEqual(A.brawlSheetsFor([]), []);
});

// ---- the loader ----

test('loader: no Image means no request (the server render)', () => {
  A.requestBrawlArt(['title']);
  assert.deepEqual(A.brawlArtStatus(), { ready: [], pending: [], failed: [] });
});

test('loader: requests once, falls back at once, waits for Retry after a failure, ignores stale callbacks', () => {
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
    let heard = 0, v = A.brawlArtVersion();
    const off = A.subscribeBrawlArt(() => heard++);
    const calls = [], c = { drawImage: (...a) => calls.push(['draw', ...a]), save: () => calls.push(['save']), restore: () => calls.push(['restore']), translate: (...a) => calls.push(['translate', ...a]), scale: (...a) => calls.push(['scale', ...a]) };
    const box = { x: 10, y: 20, w: 60, h: 80 };
    A.requestBrawlArt(['title', 'bg-shop']); A.requestBrawlArt(['title', 'bg-shop', '../../etc', 'nope']);
    assert.equal(images.length, 2, 'two files, asked for once each; unknown names never become requests');
    assert.equal(images[0].url, A.brawlArtUrl('title'));
    assert.equal(A.paintBrawlTitle(c, box), false, 'pending: draw the fallback now');
    images[0].fail(); images[1].load();
    assert.ok(A.brawlArtVersion() > v && heard > 0, 'subscribers hear arrivals and failures');
    for (let k = 0; k < 120; k++) assert.equal(A.paintBrawlTitle(c, box), false);
    assert.equal(images.length, 2, 'a failed file is not asked for again every frame');
    assert.deepEqual(A.brawlArtStatus().failed, ['title']);
    assert.equal(A.paintBrawlBackdrop(c, 'bg-shop', { x: 0, y: 0, w: 480, h: 320 }), true);
    assert.deepEqual(calls.at(-1).slice(2), [0, 0, 1536, 1024, 0, 0, 480, 320], 'the whole frame, stretched to nothing');
    A.retryBrawlArt();
    assert.equal(images.length, 3, 'Retry asks again for the failed file only');
    images[0].load();
    assert.deepEqual(A.brawlArtStatus().pending, ['title'], 'the old attempt cannot complete the retry');
    images[2].load();
    assert.equal(A.paintBrawlTitle(c, box), true);
    off();
    const before = heard; A.retryBrawlArt(); assert.equal(heard, before, 'unsubscribed');

    // a unit stands on the bottom of its box, never wider or taller than it
    calls.length = 0;
    A.requestBrawlArt(['critters-2']); images.at(-1).load();
    assert.equal(A.paintBrawlUnit(c, 'raccoon', box, 1), true);
    const [, , sx, sy, sw, sh, dx, dy, dw, dh] = calls.at(-1);
    assert.deepEqual([sx, sy, sw, sh], [...A.BRAWL_UNITS.raccoon.rect]);
    assert.ok(dw <= box.w + 1e-9 && dh <= box.h + 1e-9, 'contain fit never clips');
    assert.ok(Math.abs(dy + dh - (box.y + box.h)) < 1e-9, 'feet on the bottom of the box');
    assert.ok(Math.abs(dx + dw / 2 - (box.x + box.w / 2)) < 1e-9, 'centred across');
    assert.ok(Math.abs(dw / dh - sw / sh) < 1e-9, 'aspect kept');

    // the rival faces left: only the picture flips, about its own centre, inside save/restore
    calls.length = 0;
    assert.equal(A.paintBrawlUnit(c, 'raccoon', box, -1), true);
    assert.deepEqual(calls.map((k) => k[0]), ['save', 'translate', 'scale', 'draw', 'restore']);
    assert.equal(calls[1][1], dx + dw / 2); assert.deepEqual(calls[2].slice(1), [-1, 1]);
    assert.equal(calls[3][6], -dw / 2);

    // a wrong-sized image is a failure, not a misplaced crop
    A.requestBrawlArt(['snacks']); images.at(-1).naturalWidth = 1024; images.at(-1).load();
    assert.ok(A.brawlArtStatus().failed.includes('snacks'));
    assert.equal(A.paintBrawlSnack(c, 'apple', box), false);
    A.retryBrawlArt(); images.at(-1).load();
    assert.equal(A.paintBrawlSnack(c, 'apple', box), true);

    // an effect is centred on its point and contain-fitted into a square, aspect kept, faded by alpha, never cropped
    calls.length = 0;
    const fc = { ...c, globalAlpha: 1, save() { calls.push(['save', this.globalAlpha]); }, restore() { calls.push(['restore']); this.globalAlpha = 1; } };
    fc.drawImage = (...a) => calls.push(['draw', fc.globalAlpha, ...a.slice(1)]);
    const asked0 = images.length;
    assert.equal(A.paintBrawlFx(fc, 'acorn', 100, 50, 20), false, 'pending: the code acorn draws');
    assert.equal(A.paintBrawlFx(fc, 'bonk', 100, 50, 20), false);
    assert.equal(images.length, asked0 + 1, 'one request for the whole sheet');
    images.at(-1).load();
    assert.equal(A.paintBrawlFx(fc, 'acorn', 100, 50, 20, { alpha: 0.5 }), true);
    const [, alpha, sx2, sy2, sw2, sh2, dx2, dy2, dw2, dh2] = calls.find((k) => k[0] === 'draw');
    assert.deepEqual([sx2, sy2, sw2, sh2], [...A.BRAWL_FX.acorn]);
    assert.equal(alpha, 0.5);
    const [, tx, ty] = calls.find((k) => k[0] === 'translate');
    assert.ok(Math.abs(tx + dx2 + dw2 / 2 - 100) < 1e-9 && Math.abs(ty + dy2 + dh2 / 2 - 50) < 1e-9, 'centred on its point');
    assert.ok(Math.max(dw2, dh2) <= 20 + 1e-9 && Math.abs(dw2 / dh2 - sw2 / sh2) < 1e-9, 'fitted, aspect kept');
    assert.equal(fc.globalAlpha, 1, 'alpha restored');
    assert.equal(A.paintBrawlFx(fc, 'bonk', 100, 50, 0), false, 'a zero size paints nothing');
    assert.equal(A.paintBrawlFx(fc, 'bonk', 100, 50, 20, { alpha: 0 }), true, 'fully faded counts as drawn');

    // bad boxes and ids paint nothing
    assert.equal(A.paintBrawlUnit(c, 'nobody', box), false);
    assert.equal(A.paintBrawlUnit(c, 'raccoon', { x: 0, y: 0, w: 0, h: 10 }), false);
    assert.equal(A.paintBrawlExtra(c, 'bale', { x: 0, y: 0, w: NaN, h: 10 }), false);
  } finally { delete globalThis.Image; }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl art');
