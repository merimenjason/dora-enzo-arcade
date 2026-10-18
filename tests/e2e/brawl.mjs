import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/brawl', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.message.split("\n")[0]}`); if (process.env.TRACE) console.error(e.stack); }
  finally { await page.close(); }
}
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const fresh = async (page) => { await page.goto(`${base}/brawl`); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); };
/** Runs `fn(w, arg)` in the page with `w = window.__brawl()`. */
const brawl = (page, fn, arg) => page.evaluate(`(() => { const w = window.__brawl(); return (${fn})(w, ${JSON.stringify(arg ?? null)}); })()`);
const run = (page) => brawl(page, (w) => w.run && JSON.parse(JSON.stringify(w.run)));
const screen = (page, s) => page.locator(`main[data-screen="${s}"]`).waitFor();
/** The client point at the centre of a layout box (stage units). */
async function point(page, kind, i) {
  const { r, b } = await brawl(page, (w, a) => ({ r: w.stage(), b: a[1] === null ? w.layout[a[0]] : w.layout[a[0]][a[1]] }), [kind, i ?? null]);
  return [r.x + ((b.x + b.w / 2) * r.w) / 480, r.y + ((b.y + b.h / 2) * r.h) / 320];
}
const tap = async (page, kind, i) => { const [x, y] = await point(page, kind, i); await page.mouse.click(x, y); };
async function drag(page, from, to) {
  const [x0, y0] = await point(page, ...from);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x0 + 12, y0 - 12, { steps: 3 });
  if (Array.isArray(to)) { const [x1, y1] = typeof to[0] === 'string' ? await point(page, ...to) : to; await page.mouse.move(x1, y1, { steps: 6 }); }
  await page.mouse.up();
}
/** Puts these units (ids) into the shop and line, with acorns, through the test hook. */
const stock = (page, patch) => brawl(page, (w, p) => {
  const mk = (id, extra) => ({ ...w.run.spawn(id), ...(extra || {}) });
  w.set({
    acorns: p.acorns,
    units: p.units && p.units.map((id) => ({ kind: 'unit', unit: mk(id), frozen: false })),
    line: p.line && p.line.map((x) => (x ? mk(x.id ?? x, x.id ? x : null) : null)),
  });
}, patch);
const start = async (page, coach = 'dora') => { await page.getByTestId(`start-${coach}`).click(); await screen(page, 'shop'); };
const BOARS = [0, 1, 2, 3, 4].map(() => ({ id: 'boar', a: 50, h: 50, level: 3, xp: 5 }));

await check('the title on a fresh profile has no Continue, and Dora opens the shop', async (page) => {
  await fresh(page);
  assert.equal(await page.getByTestId('continue').count(), 0);
  await start(page);
  const r = await run(page);
  assert.deepEqual([r.acorns, r.hearts, r.bales, r.turn, r.coach], [10, 5, 0, 1, 'dora']);
  await page.screenshot({ path: '.checks/brawl/shop.png' });
});

await check('buy by drag, by tap-tap, merge, and sell', async (page) => {
  await fresh(page); await start(page);
  await stock(page, { units: ['mole', 'wren', 'mole'], acorns: 10 });
  await drag(page, ['units', 0], ['line', 0]);
  let r = await run(page);
  assert.equal(r.acorns, 7); assert.equal(r.line[0]?.id, 'mole');
  await tap(page, 'units', 1); await tap(page, 'line', 1);
  r = await run(page); assert.equal(r.acorns, 4); assert.equal(r.line[1]?.id, 'wren');
  await tap(page, 'units', 2); await tap(page, 'line', 0);
  r = await run(page); assert.equal(r.acorns, 1); assert.deepEqual([r.line[0].xp, r.line[0].a, r.line[0].h], [1, 2, 5], 'merged');
  await drag(page, ['line', 1], ['sell', null]);
  r = await run(page); assert.equal(r.line[1], null); assert.equal(r.acorns, 2);
});

await check('a drag dropped on no target, off the canvas, or cancelled changes nothing', async (page) => {
  await fresh(page); await start(page);
  await stock(page, { units: ['mole', 'wren', 'bee'], acorns: 10 });
  const before = JSON.stringify(await run(page));
  await drag(page, ['units', 0], ['snacks', 0]);
  await drag(page, ['units', 1], [3, 3]);
  const [x, y] = await point(page, 'units', 2);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y - 40, { steps: 3 });
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })));
  const [lx, ly] = await point(page, 'line', 0);
  await page.mouse.move(lx, ly, { steps: 3 }); await page.mouse.up();
  assert.equal(JSON.stringify(await run(page)), before);
  await tap(page, 'units', 0); await tap(page, 'units', 0);
  assert.equal(await brawl(page, (w) => w.ui().held), null, 'tapping the selection again puts it back');
});

await check('freeze then roll keeps the frozen unit; Enzo rolls free once', async (page) => {
  await fresh(page); await start(page, 'enzo');
  const kept = (await run(page)).units[0].unit.uid;
  await tap(page, 'units', 0);
  await page.getByTestId('freeze').click();
  await page.getByTestId('roll').click();
  let r = await run(page);
  assert.equal(r.units[0].unit.uid, kept); assert.equal(r.units[0].frozen, true);
  assert.equal(r.acorns, 10, 'the first roll is free');
  await tap(page, 'units', 1);
  await page.keyboard.press('KeyR');
  r = await run(page); assert.equal(r.acorns, 9);
  assert.equal(await brawl(page, (w) => w.ui().held), null, 'a roll drops the choice of a shop unit that is gone');
});

await check('end turn replays the fight; Skip shows the result; Next opens turn 2', async (page) => {
  await fresh(page); await start(page);
  await drag(page, ['units', 0], ['line', 0]);
  await page.getByTestId('end-turn').click();
  await screen(page, 'fight');
  await page.waitForFunction(() => window.__brawl().replay?.i > 0);
  await page.screenshot({ path: '.checks/brawl/fight.png' });
  await page.getByTestId('skip').click();
  assert.ok(await brawl(page, (w) => w.replay.i === w.replay.outcome.events.length));
  await page.screenshot({ path: '.checks/brawl/result.png' });
  await page.getByTestId('next').click();
  await screen(page, 'shop');
  assert.equal((await run(page)).turn, 2);
});

await check('reloading during the replay counts the fight exactly once', async (page) => {
  await fresh(page); await start(page);
  await stock(page, { line: BOARS.slice(0, 1) });
  await page.getByTestId('end-turn').click();
  await screen(page, 'fight');
  await page.reload(); await ready(page);
  await page.getByTestId('continue').click();
  await screen(page, 'fight');
  assert.equal(await brawl(page, (w) => w.replay.outcome.result), 'win', 'Continue shows the fight it missed');
  await page.getByTestId('next').click();
  await screen(page, 'shop');
  const r = await run(page);
  assert.deepEqual([r.turn, r.bales, r.hearts], [2, 1, 5]);
  await page.reload(); await ready(page);
  await page.getByTestId('continue').click();
  await screen(page, 'shop');
});

await check('a won run is recorded and its save removed', async (page) => {
  await fresh(page); await start(page);
  await stock(page, { line: BOARS });
  for (let k = 0; k < 10; k++) {
    await page.getByTestId('end-turn').click();
    await page.getByTestId('skip').click();
    await page.getByTestId('next').click();
  }
  await screen(page, 'over');
  const p = await brawl(page, (w) => w.profile);
  assert.deepEqual([p.runs, p.wins, p.best, p.won], [1, 1, 10, ['boar']]);
  assert.equal(await page.evaluate(() => localStorage.getItem('hay-bale-run-v1')), null);
  await page.getByTestId('title').click();
  await screen(page, 'title');
  assert.equal(await page.getByTestId('continue').count(), 0);
});

await check('the Almanac lists 30 units and 8 snacks', async (page) => {
  await fresh(page);
  await page.getByTestId('almanac').click();
  await screen(page, 'almanac');
  assert.equal(await page.locator('[data-testid^="almanac-unit-"]').count(), 30);
  assert.equal(await page.locator('[data-testid^="almanac-snack-"]').count(), 8);
  await page.screenshot({ path: '.checks/brawl/almanac.png' });
  await page.getByTestId('back').click();
  await screen(page, 'title');
});

for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
  await check(`the stage fits ${view.width} × ${view.height} with no scroll`, async (page) => {
    await fresh(page); await start(page);
    const fit = await page.evaluate(() => ({ w: document.documentElement.scrollWidth <= innerWidth + 1, h: document.documentElement.scrollHeight <= innerHeight + 1 }));
    assert.deepEqual(fit, { w: true, h: true });
    const r = await brawl(page, (w) => w.stage());
    assert.ok(Math.abs(r.w / r.h - 1.5) < 0.02, `3:2 stage, got ${r.w} × ${r.h}`);
    for (const id of ['roll', 'freeze', 'end-turn']) assert.ok(await page.getByTestId(id).isVisible(), id);
    await page.screenshot({ path: `.checks/brawl/fit-${view.width}.png` });
  }, view);
}

await check('mute is remembered', async (page) => {
  await fresh(page);
  await page.getByTestId('mute').click();
  assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  await page.reload(); await ready(page);
  assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: '.checks/brawl/title.png' });
});

// ---- the painted art ----

const SPRITES = ['wren', 'mouse', 'ladybird', 'toad', 'bee', 'dormouse', 'hedgehog', 'squirrel', 'robin', 'mole', 'frog', 'pip', 'badger', 'otter', 'magpie', 'rabbit', 'porcupine', 'beaver', 'stoat', 'tortoise', 'crow', 'skunk', 'raccoon', 'hare', 'boar', 'bear', 'stag', 'duchess', 'hawk', 'goose', 'mouselet', 'log', 'fawn'];
const ART = ['critters-1', 'critters-2', 'critters-3', 'snacks', 'title', 'bg-shop', 'bg-fight'];
const artReady = (page, keys = ART) => page.waitForFunction((k) => { const s = window.__brawl().art.status(); return k.every((x) => s.ready.includes(x)); }, keys, { timeout: 30000 });
const askAll = (page) => page.evaluate(() => { const w = window.__brawl(), c = document.createElement('canvas').getContext('2d'), b = { x: 0, y: 0, w: 40, h: 40 }; w.art.unit(c, 'wren', b); w.art.unit(c, 'badger', b); w.art.unit(c, 'boar', b); w.art.snackArt(c, 'apple', b); });
/** The pixels of a static canvas, to tell a repaint from the drawing it replaced. */
const still = (loc) => loc.evaluate((cv) => cv.toDataURL());

await check('painted art: all 44 subjects paint, both facings, on dark and cream', async (page) => {
  await fresh(page); await start(page);
  await askAll(page); await artReady(page);
  const r = await page.evaluate((ids) => {
    const w = window.__brawl(), cv = document.createElement('canvas'); cv.width = 1360; cv.height = 1160;
    const c = cv.getContext('2d'); c.scale(2, 2);
    const bad = [], mirrored = [];
    for (const [y0, bg] of [[0, '#1d1430'], [290, '#f6ecd6']]) {
      c.fillStyle = bg; c.fillRect(0, y0, 680, 290);
      ids.forEach((id, i) => {
        const x = (i % 17) * 40 + 4, y = y0 + Math.floor(i / 17) * 56 + 4, right = { x, y, w: 34, h: 50 }, left = { x, y: y + 112, w: 34, h: 50 };
        if (!w.art.unit(c, id, right, 1) || !w.art.unit(c, id, left, -1)) bad.push(id);
        // a mirrored sprite is the same picture flipped: compare one row of pixels each way
        if (y0 === 0) {
          const a = c.getImageData(x * 2, (y + 35) * 2, 68, 1).data, b = c.getImageData(x * 2, (y + 147) * 2, 68, 1).data;
          let same = 0; for (let k = 0; k < 68; k++) for (let ch = 0; ch < 3; ch++) same += Math.abs(a[k * 4 + ch] - b[(67 - k) * 4 + ch]) < 40 ? 1 : 0;
          if (same / 204 > 0.8) mirrored.push(id);
        }
      });
      ['apple', 'raisin', 'honey', 'hay', 'mint', 'chilli', 'seed', 'cake'].forEach((id, i) => { if (!w.art.snackArt(c, id, { x: 4 + i * 40, y: y0 + 230, w: 34, h: 50 })) bad.push(id); });
      ['dora', 'enzo', 'bale'].forEach((id, i) => { if (!w.art.extra(c, id, { x: 340 + i * 44, y: y0 + 230, w: 40, h: 50 })) bad.push(id); });
    }
    return { bad, mirrored: mirrored.length, url: cv.toDataURL() };
  }, SPRITES);
  assert.deepEqual(r.bad, [], 'every subject painted');
  assert.ok(r.mirrored >= 30, `rival sprites are true mirror images (${r.mirrored}/33)`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync('.checks/brawl/painted-roster.png', Buffer.from(r.url.split(',')[1], 'base64'));
});

await check('painted art: shop, drag ghost, the three summons and a whole fight, at phone size with reduced motion', async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fresh(page);
  // a fixed seed, and summoners that can't hurt anyone, so all three faint and summon
  await brawl(page, (w) => w.start('dora', 12345)); await screen(page, 'shop');
  await stock(page, { line: [{ id: 'mouse', a: 0, h: 1 }, { id: 'beaver', a: 0, h: 1 }, { id: 'stag', a: 0, h: 1 }], units: ['raccoon', 'bear', 'duchess'], acorns: 10 });
  await artReady(page, ['bg-shop', 'snacks', 'critters-1', 'critters-2', 'critters-3']);
  const [x0, y0] = await point(page, 'units', 1);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x0 + 30, y0 - 60, { steps: 4 });
  assert.equal(await brawl(page, (w) => w.ui().dragging), true);
  await page.waitForTimeout(100); await page.screenshot({ path: '.checks/brawl/painted-drag-390.png' });
  const [lx, ly] = await point(page, 'line', 3);
  await page.mouse.move(lx, ly, { steps: 4 }); await page.mouse.up();
  assert.equal((await run(page)).line[3]?.id, 'bear', 'the drag still buys');
  const dpr = await page.evaluate(() => devicePixelRatio), size = await page.getByTestId('stage').evaluate((cv) => [cv.width, cv.height, cv.clientWidth, cv.clientHeight]);
  assert.ok(Math.abs(size[0] - size[2] * dpr) <= 1 && Math.abs(size[1] - size[3] * dpr) <= 1, `canvas at device pixels ${size}`);
  await page.getByTestId('end-turn').click(); await screen(page, 'fight');
  await artReady(page, ['bg-fight']);
  const summons = await brawl(page, (w) => w.replay.outcome.events.filter((e) => e.k === 'summon' && e.side === 0).map((e) => e.unit.id));
  assert.deepEqual([...new Set(summons)].sort(), ['fawn', 'log', 'mouselet'], 'all three summons appear');
  const at = await brawl(page, (w) => w.replay.outcome.events.findLastIndex((e) => e.k === 'summon') + 1);
  await page.waitForFunction((n) => window.__brawl().replay.i >= n, at, { timeout: 60000 });
  await page.getByTestId('stage').screenshot({ path: '.checks/brawl/painted-summons-390.png' });
  await page.getByTestId('skip').click();
  await page.getByTestId('stage').screenshot({ path: '.checks/brawl/painted-result-390.png' });
}, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

await check('painted art: a hidden tab holds the replay and the art; showing it again resumes', async (page) => {
  await fresh(page); await start(page);
  await stock(page, { line: BOARS.slice(0, 2) });
  await page.getByTestId('end-turn').click(); await screen(page, 'fight');
  await page.waitForFunction(() => window.__brawl().replay.i > 0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const held = await brawl(page, (w) => w.replay.i);
  await page.waitForTimeout(1200);
  assert.equal(await brawl(page, (w) => w.replay.i), held, 'no replay time passes while hidden');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction((n) => window.__brawl().replay.i > n, held);
});

await check('slow art: the game plays on its drawings until the paintings arrive', async (page) => {
  let release; const gate = new Promise((r) => { release = r; });
  await page.route('**/art/brawl/**', async (route) => { await gate; await route.continue(); });
  await fresh(page); await start(page);
  await stock(page, { units: ['mole', 'wren', 'bee'], acorns: 10 });
  assert.ok((await brawl(page, (w) => w.art.status().pending)).length > 0, 'art is still on its way');
  await drag(page, ['units', 0], ['line', 0]);
  assert.equal((await run(page)).line[0]?.id, 'mole', 'buying works before the art');
  await page.getByTestId('end-turn').click(); await screen(page, 'fight');
  await page.getByTestId('skip').click(); await page.getByTestId('next').click(); await screen(page, 'shop');
  assert.equal((await run(page)).turn, 2, 'a whole fight plays on the drawings');
  assert.equal(await brawl(page, (w) => w.art.status().ready.length), 0);
  await page.screenshot({ path: '.checks/brawl/slow-art-fallback.png' });
  release();
  await artReady(page, ['bg-shop', 'snacks', 'critters-1', 'critters-3', 'bg-fight']);
});

await check('failed art: drawings stand in, nothing is asked for again until Retry, which repaints the title and Almanac', async (page) => {
  const asked = new Map(); let fail = true;
  page.on('request', (rq) => { const m = rq.url().match(/\/art\/brawl\/([a-z0-9-]+)\./); if (m) asked.set(m[1], (asked.get(m[1]) ?? 0) + 1); });
  await page.route('**/art/brawl/**', (route) => (fail ? route.abort() : route.continue()));
  // a new page has empty storage, so one load: a second would add its own requests to the count
  await page.goto(`${base}/brawl`); await ready(page);
  await page.waitForFunction(() => window.__brawl().art.status().failed.length >= 2);
  await page.getByTestId('retry-art').waitFor();
  const title = page.locator('.hb-title canvas'), before = await still(title);
  await page.waitForTimeout(1500);
  assert.ok([...asked.values()].every((n) => n === 1), `each failed file asked for once, not every frame: ${JSON.stringify([...asked])}`);
  await page.screenshot({ path: '.checks/brawl/failed-art-title.png' });
  fail = false;
  await page.getByTestId('retry-art').click();
  await artReady(page, ['title', 'bg-shop']);
  await page.waitForFunction(() => !document.querySelector('[data-testid="retry-art"]'));
  assert.notEqual(await still(title), before, 'the title repaints without navigating');
  await page.screenshot({ path: '.checks/brawl/retried-art-title.png' });

  // the Almanac, after a reload: a sheet fails, then a retry paints its cards in place
  fail = true; asked.clear();
  await page.reload(); await ready(page);
  await page.getByTestId('almanac').click(); await screen(page, 'almanac');
  await page.waitForFunction(() => window.__brawl().art.status().failed.includes('critters-1'));
  const wren = page.getByTestId('almanac-unit-wren').locator('canvas'), drawn = await still(wren);
  assert.equal(asked.get('critters-1'), 1, 'thirty Almanac cards share one request');
  fail = false;
  await page.getByTestId('retry-art').click();
  await artReady(page, ['critters-1', 'critters-2', 'critters-3', 'snacks']);
  await page.waitForFunction((d) => document.querySelector('[data-testid="almanac-unit-wren"] canvas').toDataURL() !== d, drawn);
  await page.screenshot({ path: '.checks/brawl/retried-art-almanac.png' });
}, { width: 1280, height: 860 });

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl in the browser');
