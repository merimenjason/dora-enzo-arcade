// Meadowmend in the browser: the menu, the guided First Spring played with the real mouse (hover shows the ghost,
// R, the wheel and a right-click turn the tile, a click places it, a Perfect in the hole, undo), the run saved across
// a reload and picked up again, the end-of-run panel, the valley list, a corrupt save, the framing at 1280×800 and
// 1920×1080 with Dora and Enzo a clear size and clear of the tile panel, and phones held either way (tap to try a
// cell, tap again or ✓ to place, ⟳ to turn).
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'meadow-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const game = (page, fn, arg) => page.evaluate(fn, arg);
const turnNo = (page) => game(page, () => window.__meadow()?.turn ?? -1);
const cell = (page, q, r) => game(page, ([a, b]) => window.__meadowCell(a, b), [q, r]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Waits for the camera to stop easing, so a cell's place on screen holds still. */
const settle = (page) => page.waitForFunction(() => window.__meadowScene()?.settled, null, { polling: 50 });
/** The best placement for the current tile, as the page's own engine sees it. */
const bestMove = (page) => game(page, () => {
  const g = window.__meadow(); let best = null, bv = -1;
  for (const [q, r] of g.frontier()) for (let rot = 0; rot < 6; rot++) { const a = g.assess(q, r, rot); const v = a.pts + a.tiles * 30; if (a.legal && v > bv) { bv = v; best = [q, r, rot]; } }
  return best;
});
/** Places the current tile with the mouse: pick the turn on the dots, move over the cell, click. */
async function mousePlace(page, [q, r, rot]) {
  await page.locator('.mm-rot').nth(rot).click(); await settle(page);
  const before = await turnNo(page), [x, y] = await cell(page, q, r);
  await page.mouse.move(x, y); await page.waitForTimeout(60); await page.mouse.click(x, y);
  await page.waitForFunction((t) => window.__meadow().turn > t, before);
}

{
  const page = await open();
  await page.goto(base + '/meadow'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Meadow\s*mend/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.match(await page.locator('.mm-go').innerText(), /START[\s\S]*First Spring/);
  assert.ok(await page.getByRole('button', { name: /Endless/ }).isDisabled(), 'the endless modes wait for an acorn');
  console.log('PASS the menu loads and hydrates');

  // First Spring, with the real mouse
  await page.locator('.mm-go').click();
  await page.locator('main[data-screen="play"]').waitFor(); await settle(page);
  assert.match(await page.locator('.mm-guide').innerText(), /Turn the tile/);
  const [gx, gy] = await cell(page, 2, -1);
  await page.mouse.move(gx, gy);
  assert.equal(await game(page, () => window.__meadow().assess(2, -1, window.__meadowRot()).matches), 0, 'the first tile needs turning');
  // R turns it, the wheel turns it, a right-click turns it
  await page.keyboard.press('r'); assert.equal(await game(page, () => window.__meadowRot()), 1);
  await page.mouse.wheel(0, 120); await page.waitForTimeout(50); assert.equal(await game(page, () => window.__meadowRot()), 2, 'the wheel turns the tile');
  await page.mouse.click(gx, gy, { button: 'right' }); assert.equal(await game(page, () => window.__meadowRot()), 3, 'a right-click turns it');
  assert.equal(await turnNo(page), 0, 'turning places nothing');
  assert.equal(await game(page, () => window.__meadow().assess(2, -1, window.__meadowRot()).matches), 2, 'turned, the meadow meets the meadow');
  await page.mouse.click(gx, gy);
  await page.waitForFunction(() => window.__meadow().turn === 1);
  assert.equal(await game(page, () => window.__meadow().score), 20, 'two matching edges score');
  // the hole in the middle: a Perfect
  assert.match(await page.locator('.mm-guide').innerText(), /hole in the middle/);
  await mousePlace(page, [0, 0, 0]);
  assert.equal(await game(page, () => window.__meadow().stats.perfects), 1, 'a Perfect');
  const left = await game(page, () => window.__meadow().stack.length);
  // undo, then place it again
  await page.getByRole('button', { name: 'Undo the last tile' }).click();
  assert.equal(await turnNo(page), 1, 'undo takes back the last tile');
  assert.ok(await page.getByRole('button', { name: 'Undo the last tile' }).isDisabled(), 'one step only');
  await mousePlace(page, [0, 0, 0]);
  assert.equal(await game(page, () => window.__meadow().stack.length), left);
  console.log('PASS a real placement by mouse, turning by R, the wheel and a right-click, a Perfect and undo');

  // the run is saved and picks up again after a reload
  const score = await game(page, () => window.__meadow().score);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.mm-go').innerText(), /CONTINUE[\s\S]*First Spring/);
  await page.locator('.mm-go').click(); await page.locator('main[data-screen="play"]').waitFor();
  assert.equal(await turnNo(page), 2); assert.equal(await game(page, () => window.__meadow().score), score, 'the same valley after a reload');
  console.log('PASS the run is saved across a reload');

  // play the rest with the mouse to the end-of-run panel
  for (let i = 0; i < 40 && !(await game(page, () => window.__meadow().done)); i++) await mousePlace(page, await bestMove(page));
  await page.locator('.mm-result').waitFor({ timeout: 10000 });
  assert.match(await page.locator('.mm-result').innerText(), /FIRST SPRING/);
  assert.equal(Number(await page.getByTestId('final-score').innerText().then((t) => t.match(/\d+/)[0])), await game(page, () => window.__meadow().score));
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.equal(sv.tutorial, true); assert.equal(sv.run, null, 'a finished run is not kept');
  console.log('PASS the end-of-run panel');

  // the valley list
  await page.getByRole('button', { name: /Valleys/ }).first().click();
  await page.locator('.mm-valleys').waitFor();
  assert.equal(await page.locator('.mm-card').count(), 8, 'First Spring and seven valleys');
  assert.ok(!(await page.getByRole('button', { name: /Valley 1: Clover Hollow/ }).isDisabled()));
  assert.ok(await page.getByRole('button', { name: /Valley 2: Willow Brook \(locked\)/ }).isDisabled(), 'later valleys wait for an acorn');
  console.log('PASS the valley list');

  // a corrupt save starts fresh, without errors
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"valleys":{"clover":{"best":"x"}},"run":{"v":1,"cells":"nope"'), KEY);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.mm-go').innerText(), /START/);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, tutorial: true, run: { v: 1, mode: { kind: 'valley', valley: 'clover' }, cells: [{ q: 0, r: 0, kind: 'tile', e: ['lava'] }] } })), KEY);
  await page.reload(); await ready(page);
  assert.doesNotMatch(await page.locator('.mm-go').innerText(), /CONTINUE/, 'a broken run is dropped');
  console.log('PASS a corrupt save');

  // the framing on desktop screens: the valley and the pair clear of the panel, the pair a clear size
  for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => window.__meadowStart({ kind: 'valley', valley: 'clover' })); await page.locator('main[data-screen="play"]').waitFor();
    for (let i = 0; i < 6; i++) await mousePlace(page, await bestMove(page));
    await page.waitForTimeout(1600);
    const m = await game(page, () => window.__meadowScene()), panel = await page.locator('.mm-side').boundingBox(), stage = await page.locator('.mm-stage').boundingBox();
    for (const ch of m.chins) {
      assert.ok(ch.h >= 60, `${ch.who} is a clear size at ${vp.width}×${vp.height} (${Math.round(ch.h)} px)`);
      assert.ok(ch.x >= 0 && ch.x + ch.w <= panel.x - stage.x && ch.y >= 0 && ch.y + ch.h <= stage.height, `${ch.who} is on screen and clear of the panel`);
    }
    const cells = await game(page, () => [...window.__meadow().cells.values()].map((c) => window.__meadowCell(c.q, c.r)));
    for (const [x, y] of cells) assert.ok(x > stage.x && x < panel.x && y > stage.y && y < stage.y + stage.height, 'every tile is framed in the clear part of the screen');
    assert.ok(await noSideScroll(page));
  }
  console.log('PASS the desktop framing at 1280×800 and 1920×1080');
  await page.context().close();
}

for (const [label, viewport] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
  const page = await open(viewport, true);
  await page.goto(base + '/meadow'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the ${label} menu`);
  await page.locator('.mm-go').tap();
  await page.locator('main[data-screen="play"]').waitFor();
  await page.locator(`main[data-touch="${label === 'upright' ? 'tall' : 'wide'}"]`).waitFor();
  await settle(page);
  // ⟳ turns; a tap tries the cell, a second tap places
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Turn right' }).tap();
  assert.equal(await game(page, () => window.__meadowRot()), 3);
  let [x, y] = await cell(page, 2, -1);
  await page.touchscreen.tap(x, y); await page.waitForTimeout(150);
  assert.equal(await turnNo(page), 0, 'the first tap only shows the ghost');
  assert.ok(!(await page.getByRole('button', { name: 'Place the tile' }).isDisabled()), '✓ is ready');
  await page.touchscreen.tap(x, y);
  await page.waitForFunction(() => window.__meadow().turn === 1);
  // and ✓ places too
  await settle(page); [x, y] = await cell(page, 0, 0);
  await page.touchscreen.tap(x, y); await page.waitForTimeout(150);
  assert.equal(await turnNo(page), 1);
  await page.getByRole('button', { name: 'Place the tile' }).tap();
  await page.waitForFunction(() => window.__meadow().turn === 2);
  assert.equal(await game(page, () => window.__meadow().stats.perfects), 1);
  await page.waitForTimeout(1500);
  const m = await game(page, () => window.__meadowScene()), panel = await page.locator('.mm-side').boundingBox(), stage = await page.locator('.mm-stage').boundingBox();
  assert.ok(panel.x >= 0 && panel.x + panel.width <= viewport.width && panel.y + panel.height <= viewport.height, `the tile panel fits (${label})`);
  for (const ch of m.chins) {
    assert.ok(ch.h >= 40, `${ch.who} reads clearly on a phone held ${label} (${Math.round(ch.h)} px)`);
    assert.ok(ch.x >= 0 && ch.x + ch.w <= viewport.width && ch.y >= 0 && ch.y + ch.h + stage.y <= viewport.height, `${ch.who} is on screen (${label})`);
  }
  assert.ok((await page.locator('.mm-bar').boundingBox()).height <= 50, 'the bar stays slim');
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone held ${label}: tap to try, tap again or ✓ to place, ⟳ to turn`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS Meadowmend in the browser');
