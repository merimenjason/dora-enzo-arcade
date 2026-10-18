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
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
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

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log('PASS Hay Bale Brawl in the browser');
