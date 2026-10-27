// Burrow Command in the browser: the arcade card, the menus, a skirmish played by mouse and keys (picking, gathering,
// building, training, groups, pausing), a campaign mission won and saved, and the phone layout played by touch.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (opts = { viewport: { width: 1280, height: 800 } }) => {
  const page = await browser.newPage(opts);
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** Where a world point is on the screen right now. */
const at = (page, x, y) => page.evaluate(([x, y]) => window.__commandAt(x, y), [x, y]);
const tick = (page) => page.evaluate(() => window.__command()?.tick ?? 0);

{
  const page = await open();
  await page.goto(base);
  await page.getByRole('link', { name: /Burrow Command/ }).click(); await page.waitForURL('**/command'); await ready(page);
  console.log('PASS the arcade lists Burrow Command and its card opens the game');

  await page.getByRole('button', { name: /Story campaign/ }).click();
  assert.equal(await page.locator('.cmd-mission').count(), 10);
  assert.equal(await page.locator('.cmd-mission:disabled').count(), 9, 'only the first mission is open');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Skirmish/ }).click();
  await page.locator('.cmd-side', { hasText: 'Clockwork Hive' }).click();
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /^Skirmish/ }).click();
  assert.equal(await page.locator('.cmd-side', { hasText: 'Clockwork Hive' }).getAttribute('aria-pressed'), 'true', 'the side is remembered');
  assert.equal(await page.getByRole('button', { name: 'Hard', exact: true }).getAttribute('aria-pressed'), 'true', 'the difficulty is remembered');
  console.log('PASS the menus open one mission at a time, and skirmish choices are saved');

  await page.locator('.cmd-side', { hasText: 'Burrow Colony' }).click();
  await page.getByRole('button', { name: 'Easy', exact: true }).click();
  await page.getByRole('button', { name: /Start the match/ }).click();
  await page.waitForFunction(() => window.__command()?.tick > 20);
  assert.equal(await page.evaluate(() => window.__command().players[0].side), 'colony');
  assert.match(await page.locator('.cmd-hay').textContent(), /150/);
  console.log('PASS a skirmish starts with 150 hay');

  // pick the five gatherers with a box
  const box = await page.evaluate(() => {
    const w = window.__command(), us = w.units.filter((u) => u.owner === 0).map((u) => window.__commandAt(u.x, u.y));
    return [Math.min(...us.map((p) => p[0])) - 30, Math.min(...us.map((p) => p[1])) - 40, Math.max(...us.map((p) => p[0])) + 30, Math.max(...us.map((p) => p[1])) + 20];
  });
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[2], box[3], { steps: 6 }); await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('.cmd-many-u').length === 5);
  console.log('PASS dragging a box picks the five gatherers');

  // right-click the nearest meadow: they gather and bring hay home
  const node = await page.evaluate(() => {
    const w = window.__command(), hq = w.buildings.find((b) => b.owner === 0);
    const n = w.nodes.filter((n) => n.res === 'hay').sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
    return [n.x, n.y];
  });
  const [nx, ny] = await at(page, ...node);
  await page.mouse.click(nx, ny, { button: 'right' });
  await page.waitForFunction(() => window.__command().players[0].stats.hay >= 10, null, { timeout: 90000 });
  console.log('PASS right-clicking a meadow sets the gatherers to work');

  // groups: Ctrl+1 keeps them, a click elsewhere drops them, 1 brings them back
  await page.keyboard.press('Control+Digit1');
  await page.keyboard.press('Backspace');
  await page.waitForFunction(() => document.querySelector('.cmd-card h3')?.textContent.includes('Great Burrow'));
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => document.querySelectorAll('.cmd-many-u').length === 5);
  console.log('PASS control groups and the home key');

  // train a gatherer from the Great Burrow with its key
  await page.keyboard.press('Backspace');
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__command().buildings.find((b) => b.owner === 0).queue.length === 1);
  await page.waitForFunction(() => window.__command().units.filter((u) => u.owner === 0).length === 6, null, { timeout: 90000 });
  console.log('PASS Q trains a gatherer at the Great Burrow');

  // build a Hay Hut: pick a gatherer, B, W, click a clear spot
  await page.waitForFunction(() => window.__command().players[0].hay >= 100, null, { timeout: 120000 });
  const spot = await page.evaluate(() => {
    const w = window.__command(), hq = w.buildings.find((b) => b.owner === 0);
    for (let r = 4; r < 10; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) {
      const tx = hq.tx + dx, ty = hq.ty + dy;
      if (w.canPlace(0, 'hut', tx, ty, true)) return [(tx + 1) * 256, (ty + 1) * 256];
    }
    return null;
  });
  assert.ok(spot, 'there is room for a hut near home');
  const g = await page.evaluate(() => { const u = window.__command().units.find((u) => u.owner === 0 && u.def.worker); return [u.x, u.y]; });
  const [gx, gy] = await at(page, ...g);
  await page.mouse.click(gx, gy);
  await page.waitForFunction(() => document.querySelector('.cmd-card h3')?.textContent.includes('Gatherer'));
  await page.keyboard.press('b'); await page.keyboard.press('w');
  const [hx, hy] = await at(page, ...spot);
  await page.mouse.move(hx, hy); await page.mouse.click(hx, hy);
  await page.waitForFunction(() => window.__command().buildings.some((b) => b.owner === 0 && b.type === 'hut'));
  console.log('PASS a gatherer lays down a Hay Hut where it is clicked');

  // pause stops the clock
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Paused' }).waitFor();
  const t0 = await tick(page); await page.waitForTimeout(800); assert.equal(await tick(page), t0, 'nothing moves while paused');
  await page.getByRole('button', { name: /Carry on/ }).click();
  await page.waitForFunction((t) => window.__command().tick > t + 5, t0);
  console.log('PASS Escape pauses and Carry on resumes');
  await page.close();
}

{
  // a mission won and remembered
  const page = await open();
  await page.goto(`${base}/command`); await ready(page);
  await page.evaluate(() => localStorage.removeItem('burrow-command-v1'));
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Story campaign/ }).click();
  await page.locator('.cmd-mission').first().click();
  await page.getByRole('heading', { name: 'First Harvest' }).waitFor();
  await page.getByRole('button', { name: /Begin/ }).click();
  await page.waitForFunction(() => window.__command()?.tick > 10);
  await page.evaluate(() => { const w = window.__command(); w.players[0].stats.hay = 400; w.placeBuilding(0, 'hut', 12, 4, true); w.placeBuilding(0, 'pit', 12, 20, true); });
  await page.getByRole('heading', { name: 'Mission won!' }).waitFor({ timeout: 30000 });
  assert.match(await page.locator('.cmd-end-stars').textContent(), /★/);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Story campaign/ }).click();
  assert.equal(await page.locator('.cmd-mission:disabled').count(), 8, 'winning opens the next mission, and it is saved');
  console.log('PASS winning First Harvest is saved and opens mission 2');
  await page.close();
}

{
  // the phone: no sideways scroll, and play by touch
  const page = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(`${base}/command`); await ready(page);
  const wide = async () => page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok((await wide()) <= 390, 'the title fits a phone');
  await page.getByRole('button', { name: /^Skirmish/ }).tap();
  assert.ok((await wide()) <= 390, 'the skirmish menu fits a phone');
  await page.getByRole('button', { name: /Start the match/ }).tap();
  await page.waitForFunction(() => window.__command()?.tick > 20);
  assert.ok((await wide()) <= 390, 'the match fits a phone');
  const hud = await page.locator('.cmd-hud').boundingBox();
  assert.ok(hud && hud.y + hud.height <= 845 && hud.width <= 390, 'the command panel is on screen');
  const u = await page.evaluate(() => { const u = window.__command().units.find((u) => u.owner === 0); return [u.id, u.x, u.y]; });
  const [ux, uy] = await at(page, u[1], u[2]);
  await page.touchscreen.tap(ux, uy);
  await page.waitForFunction(() => document.querySelector('.cmd-card h3') !== null);
  const [tx, ty] = await at(page, u[1] + 256 * 3, u[2] - 256 * 2);
  await page.touchscreen.tap(tx, ty);
  await page.waitForFunction((id) => { const u = window.__command().get(id); return !!u.order; }, u[0]);
  console.log('PASS on a phone: everything fits, a tap picks a gatherer and another tap sends it');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('Burrow Command browser checks passed.');
