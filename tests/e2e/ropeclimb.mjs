// Ropeclimb in the browser: the menu, starting a climb, a real charged leap from the keyboard, swapping climbers,
// pausing (by key and when the tab hides, with no jump in time afterwards), rolling in a dust-bath tub and the save it
// makes, continuing after a reload, a corrupt save, the ending at the weathervane and Hard Knot opening, two players,
// and the phone layouts with the touch buttons. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'ropeclimb-v1';
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
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
/** Waits until the climb has run `ticks` more ticks. */
const waitTicks = (page, ticks) => page.waitForFunction((t) => window.__ropeclimb().tick >= t, ticks + 0, { timeout: 30000 }).then(() => {});
const tick = (page) => game(page, () => window.__ropeclimb().tick);

{
  const page = await open();
  await page.goto(base + '/ropeclimb'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Rope\s*climb/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.ok(await page.getByRole('radio', { name: /1 player/ }).isVisible(), 'a choice of 1 or 2 players');
  assert.match(await page.locator('.rc-records').innerText(), /Hard Knot opens after your first climb/, 'Hard Knot starts locked');
  console.log('PASS the menu loads and hydrates');

  // start, and leap for real from the keyboard
  await page.getByRole('button', { name: /START CLIMBING/ }).click();
  await page.locator('main[data-screen="play"]').waitFor();
  assert.equal(await game(page, () => window.__ropeclimb().dora.mode), 'stand', 'the climb starts standing in the cellar');
  await page.locator('.rc-tip').click().catch(() => {});
  await page.locator('.rc-canvas').focus();
  await page.keyboard.down('Space'); await page.waitForTimeout(500);
  assert.ok(await game(page, () => window.__ropeclimb().dora.charging), 'holding Space charges a leap');
  await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__ropeclimb().dora.y > 30);
  assert.ok(await game(page, () => window.__ropeclimb().stats.jumps >= 1), 'letting go springs Dora up');
  console.log('PASS a charged leap from the keyboard');

  // swapping
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ropeclimb().active === 'enzo');
  await page.locator('.rc-who', { hasText: 'Enzo' }).waitFor({ timeout: 3000 }); // the chip says who you steer
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ropeclimb().active === 'dora');
  console.log('PASS Tab swaps climbers');

  // pausing by key, and when the tab hides; no jump in time afterwards
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = await tick(page); await page.waitForTimeout(600);
  assert.equal(await tick(page), t0, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep climbing' }).click();
  await waitTicks(page, t0 + 10);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t1 = await tick(page); await page.waitForTimeout(1500);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Keep climbing' }).click();
  await page.waitForTimeout(120);
  const t2 = await tick(page);
  assert.ok(t2 - t1 < 30, `a hidden tab pauses, and the clock doesn't leap ahead after (${t2 - t1} ticks)`);
  console.log('PASS pausing by Esc and on a hidden tab');

  // roll in the next tub: it saves the climb there
  await game(page, () => { const g = window.__ropeclimb(), t = g.world.tubs[1]; g.place({ x: t.x - 18, y: t.y + 3, mode: 'air' }, { x: t.x + 18, y: t.y + 3, mode: 'air' }); });
  await page.waitForFunction(() => window.__ropeclimb().phase === 'roll');
  await page.waitForFunction(() => window.__ropeclimb().phase === 'climb' && window.__ropeclimb().tub === 1, null, { timeout: 15000 });
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.climb?.tub === 1, KEY);
  console.log('PASS a dust-bath tub saves the climb');

  // an acorn charm is kept at once
  await game(page, () => { const g = window.__ropeclimb(), a = g.world.acorns[2]; g.place({ x: a.x, y: a.y - 4, mode: 'air' }, { x: a.x + 6, y: a.y - 4, mode: 'air' }); });
  await page.waitForFunction((k) => (JSON.parse(localStorage.getItem(k) ?? 'null')?.acorns ?? []).length === 1, KEY);
  console.log('PASS an acorn charm saves straight away');

  // reload and continue from the tub
  await page.reload(); await ready(page);
  const cont = page.getByRole('button', { name: /CONTINUE THE CLIMB/ });
  assert.match(await cont.innerText(), /tub 2 of 12/);
  await cont.click(); await page.locator('main[data-screen="play"]').waitFor();
  assert.equal(await game(page, () => window.__ropeclimb().tub), 1, 'the climb carries on from its tub');
  assert.ok(await game(page, () => window.__ropeclimb().dora.y === 750), 'standing by it');
  console.log('PASS the climb survives a reload');

  // the ending: both on the ridge
  await game(page, () => window.__ropeclimbStart({ tub: 11, seed: 5 }));
  await page.waitForTimeout(300);
  await game(page, () => { const g = window.__ropeclimb(), r = g.world.solids[g.world.solids.length - 1]; g.place({ x: r.x + 60, y: r.y + r.h + 4, mode: 'air' }, { x: r.x + 100, y: r.y + r.h + 4, mode: 'air' }); });
  const end = page.getByRole('dialog', { name: 'The weathervane at dawn' }); await end.waitFor({ timeout: 20000 });
  assert.match(await end.innerText(), /Top of the barn/);
  assert.match(await end.innerText(), /Hard Knot is open/, 'the first finish opens Hard Knot');
  const s = await save(page);
  assert.ok(s.finished === 1 && s.climb === null && s.best.normal.ticks > 0, 'the finish is recorded and the climb cleared');
  await end.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Hard Knot/ }).waitFor();
  assert.match(await page.locator('.rc-records').innerText(), /climbed 1 time/);
  console.log('PASS the ending at the weathervane opens Hard Knot');

  await page.getByRole('button', { name: /Hard Knot/ }).click();
  await page.locator('main[data-screen="play"]').waitFor();
  assert.ok(await game(page, () => window.__ropeclimb().hard && window.__ropeclimb().ropeLen < 130), 'Hard Knot has the shorter rope');
  console.log('PASS Hard Knot starts');

  // a corrupt save doesn't break the page
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"climb":{"tub":"x"},"acorns":"nope"'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /START CLIMBING/ }).isVisible(), 'a corrupt save starts fresh');
  console.log('PASS a corrupt save starts fresh');
  await page.context().close();
}

// two players: each keyboard half steers its own climber
{
  const page = await open();
  await page.goto(base + '/ropeclimb'); await ready(page);
  await page.getByRole('radio', { name: /2 players/ }).click();
  await page.getByRole('button', { name: /START CLIMBING/ }).click();
  await page.locator('main[data-screen="play"]').waitFor();
  await page.locator('.rc-tip').click().catch(() => {});
  await game(page, () => window.__ropeclimb().place({ x: 200, y: 0 }, { x: 260, y: 0 }));
  await page.locator('.rc-canvas').focus();
  await page.keyboard.down('a'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400);
  await page.keyboard.up('a'); await page.keyboard.up('ArrowRight');
  const [dx, ex] = await game(page, () => [window.__ropeclimb().dora.x, window.__ropeclimb().enzo.x]);
  assert.ok(dx < 195 && ex > 265, `A moves Dora left and → moves Enzo right (${dx.toFixed(0)}, ${ex.toFixed(0)})`);
  assert.equal(await game(page, () => window.__ropeclimb().players), 2);
  console.log('PASS two players on one keyboard');
  await page.context().close();
}

// phones, sideways and upright
for (const [name, viewport] of [['sideways', { width: 844, height: 390 }], ['upright', { width: 390, height: 844 }]]) {
  const page = await open(viewport, true);
  await page.goto(base + '/ropeclimb'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the ${name} menu`);
  await page.getByRole('button', { name: /START CLIMBING/ }).tap();
  await page.locator('main[data-screen="play"]').waitFor();
  const leapBtn = page.getByRole('button', { name: 'Leap', exact: true });
  assert.ok(await leapBtn.isVisible(), `touch buttons show on a ${name} phone`);
  assert.ok(await noSideScroll(page), `no sideways scroll while climbing (${name})`);
  await page.locator('.rc-tip').tap().catch(() => {});
  const box = await leapBtn.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  // a long press charges: hold with pointer events
  await leapBtn.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(450);
  assert.ok(await game(page, () => window.__ropeclimb().dora.charging), `holding the leap button charges (${name})`);
  await leapBtn.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  await page.waitForFunction(() => window.__ropeclimb().stats.jumps >= 1);
  console.log(`PASS the ${name} phone layout and touch leap`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('ropeclimb e2e: all passed');
