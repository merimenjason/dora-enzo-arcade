import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

// The loader has no DOM side effects at import time. Use its real transpiled module in Node and browsers.
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = source => transpileModule(source, { compilerOptions: { module: ModuleKind.ES2022, target: ScriptTarget.ES2022 } }).outputText;
export async function wareModuleUrl() {
  const crops = uri(compile(await readFile(new URL('../lib/whisker-ware-crops.ts', import.meta.url), 'utf8')));
  return uri(compile(await readFile(new URL('../lib/whisker-ware-paint.ts', import.meta.url), 'utf8')).replaceAll("'./whisker-ware-crops'", JSON.stringify(crops)).replaceAll('"./whisker-ware-crops"', JSON.stringify(crops)));
}

export async function verifyWareArt() {
  const art = await import(await wareModuleUrl());
  art.prefetchWareMenu();
  assert.deepEqual(art.wareArtStatus(), { ready: [], pending: [], failed: [] }, 'SSR never needs Image or requests assets');
  const images = [];
  class FakeImage {
    naturalWidth = 1536; naturalHeight = 1024;
    constructor() { images.push(this); }
    set src(value) { this.url = value; }
    load() { this.onload(); }
    fail() { this.onerror(); }
  }
  const oldImage = globalThis.Image;
  globalThis.Image = FakeImage;
  try {
    let notifications = 0;
    const unsubscribe = art.subscribeWareArt(() => notifications++);
    art.prefetchWareMenu(); art.prefetchWareMenu();
    assert.equal(images.length, 2, 'menu requests exactly hosts and title once');
    assert.deepEqual(art.wareArtStatus().pending, ['hosts', 'title']);
    const calls = [], ctx = { drawImage: (...args) => calls.push(args) }, box = { x: 10, y: 20, w: 200, h: 180 };
    assert.equal(art.paintWareHost(ctx, 'dora', 'oops', box), false, 'pending art returns immediately to fallback');
    images[0].fail(); images[1].load();
    for (let i = 0; i < 120; i++) assert.equal(art.paintWareHost(ctx, 'dora', 'oops', box), false);
    assert.equal(images.length, 2, 'failed art does not retry on every animation frame');
    assert.deepEqual(art.wareArtStatus().failed, ['hosts']);
    art.retryWareArt(); assert.equal(images.length, 3);
    images[0].load(); assert.deepEqual(art.wareArtStatus().ready, ['title'], 'stale request callback cannot complete a retry');
    images[2].load();
    assert.equal(art.paintWareHost(ctx, 'dora', 'oops', box), true);
    assert.deepEqual(calls.at(-1).slice(1, 5), art.WARE_CROPS.hosts[9], 'oops Dora uses the measured complete frame');
    assert.ok(calls.at(-1)[7] <= box.w && calls.at(-1)[8] <= box.h, 'contain fit never clips');
    assert.equal(calls.at(-1)[6] + calls.at(-1)[8], box.y + box.h, 'sprite frame is grounded at destination bottom');
    assert.equal(art.paintWareSprite(ctx, 'props-fox', 11, box), false, 'the intentionally empty Fox cell never draws');
    assert.equal(art.paintWareSprite(ctx, 'hosts', 12, box), false);
    assert.equal(art.paintWareSprite(ctx, 'hosts', -1, box), false);
    assert.equal(art.paintWareSprite(ctx, 'hosts', .5, box), false);
    assert.equal(art.paintWareProp(ctx, 'dora', 'not-a-sprite', box), false);
    const before = images.length;
    art.prefetchWareGame('unknown'); art.requestWareArt(['../../bad']);
    assert.equal(images.length, before, 'unknown asset/game names never create requests');
    art.prefetchWareGame('sneak');
    assert.deepEqual(art.wareArtStatus().pending, ['props-owl', 'room-owl', 'bg-sneak']);
    const wrong = images.at(-1); wrong.naturalWidth = 1024; wrong.load();
    assert.ok(art.wareArtStatus().failed.includes('bg-sneak'), 'wrong-sized art falls back instead of corrupting geometry');
    art.retryWareArt(); images.at(-1).load();
    assert.ok(art.wareArtStatus().ready.includes('bg-sneak'));
    const rect = art.fitWareBox({ x: 0, y: 0, w: 640, h: 320 }, 1536, 1024);
    assert.deepEqual(rect, { x: 80, y: 0, w: 480, h: 320 }, 'a wide box letterboxes instead of cropping the stage');
    assert.equal(art.fitWareBox({ ...box, w: 0 }, 1536, 1024), null);
    assert.equal(art.fitWareBox({ ...box, h: NaN }, 1536, 1024), null);
    unsubscribe(); const saved = notifications;
    art.prefetchWareHost('fox'); assert.equal(notifications, saved, 'unmounted subscribers are not called');
    assert.ok(saved >= 7, 'pending, failure and retry arrival notify redraw subscribers');

    const metadata = JSON.parse(await readFile(new URL('../docs/whisker-ware-crops.json', import.meta.url), 'utf8'));
    const manifest = JSON.parse(await readFile(new URL('../docs/whisker-ware-generation.json', import.meta.url), 'utf8'));
    assert.equal(art.WARE_ASSETS.length, 34); assert.equal(new Set(art.WARE_ASSETS).size, 34);
    for (const asset of manifest.finalAssets) {
      const png = await readFile(new URL(`../public/art/whisker-ware/${asset.file}`, import.meta.url));
      assert.equal(createHash('sha256').update(png).digest('hex'), asset.sha256, `${asset.file} is the selected original`);
      assert.equal(png.readUInt32BE(16), 1536); assert.equal(png.readUInt32BE(20), 1024);
      assert.equal(png[25], asset.mode === 'RGBA' ? 6 : 2, `${asset.file} has the intended PNG colour type`);
      assert.match(art.wareArtUrl(asset.file.slice(0, -4)), new RegExp(asset.sha256.slice(0, 12)), 'content hash busts old artwork caches');
    }
    let sprites = 0;
    for (const [file, sheet] of Object.entries(metadata.sheets)) {
      assert.deepEqual(art.WARE_CROPS[file.slice(0, -4)], sheet.cells.map(cell => cell.frame));
      for (const cell of sheet.cells) {
        if (!cell.frame) continue;
        sprites++;
        const [x, y, w, h] = cell.frame, [bx, by, bw, bh] = cell.bounds;
        assert.ok(x >= 0 && y >= 0 && x + w <= 1536 && y + h <= 1024);
        assert.ok(x <= bx && y <= by && x + w >= bx + bw && y + h >= by + bh);
      }
      for (const group of sheet.sharedFrameGroups) assert.equal(new Set(group.map(i => sheet.cells[i].frame.slice(2).join(','))).size, 1, `${file}: poses retain one scale`);
    }
    assert.equal(sprites, 59);
  } finally { if (oldImage === undefined) delete globalThis.Image; else globalThis.Image = oldImage; }
  console.log('Whisker Ware art: 34 assets, 59 complete frames, SSR, lazy loading, failure/retry, stale callbacks, cache hashes and pose scales pass.');
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) await verifyWareArt();
