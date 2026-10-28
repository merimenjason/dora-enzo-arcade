// Seedstorm in the browser: the menu, choosing a pilot and difficulty, flying by keyboard, pausing (and pausing when
// the tab hides), a boss and its bar, Bloom, game over and the high-score table, the save, and the phone layouts.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const game = (page, fn) => page.evaluate(fn);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Reads a pixel of the canvas at a point of the field (field units), going through the same fit as the scene. */
const fieldPixel = (page, fx, fy) => page.evaluate(([fx, fy]) => {
  const c = document.querySelector('.ss-canvas'), r = c.getBoundingClientRect(), s = Math.min(r.width / 360, r.height / 640);
  const ox = (r.width - 360 * s) / 2, oy = (r.height - 640 * s) / 2, k = c.width / r.width;
  const d = c.getContext('2d').getImageData(Math.round((ox + fx * s) * k), Math.round((oy + fy * s) * k), 1, 1).data;
  return [d[0], d[1], d[2]];
}, [fx, fy]);

{
  const page = await open();
  await page.goto(base + '/seedstorm'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Seedstorm/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  console.log('PASS the menu loads and hydrates');

  // pick Enzo and Breezy; both are remembered
  await page.getByRole('radio', { name: /^Enzo/ }).click(); await page.getByRole('radio', { name: /^Breezy/ }).click();
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('radio', { name: /^Enzo/ }).getAttribute('aria-checked'), 'true', 'the pilot is remembered');
  assert.equal(await page.getByRole('radio', { name: /^Breezy/ }).getAttribute('aria-checked'), 'true', 'the difficulty is remembered');
  await page.getByRole('button', { name: /FLY WITH ENZO · BREEZY/ }).click();
  await page.locator('main[data-screen="play"]').waitFor();
  assert.deepEqual(await game(page, () => { const g = window.__seedstorm(); return [g.phase, g.pilot, g.diffId, g.stage]; }), ['play', 'enzo', 'breezy', 1]);
  console.log('PASS choosing Enzo on Breezy starts stage 1');

  // real keys: left, right, up, Shift to focus
  await page.locator('.ss-canvas').focus();
  const x0 = await game(page, () => window.__seedstorm().player.x);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(300); await page.keyboard.up('ArrowLeft');
  const x1 = await game(page, () => window.__seedstorm().player.x);
  assert.ok(x1 < x0 - 20, `the left arrow flies left (${x0} → ${x1})`);
  await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
  const x2 = await game(page, () => window.__seedstorm().player.x);
  assert.ok(x2 > x1 + 20, `D flies right (${x1} → ${x2})`);
  await page.keyboard.down('Shift'); await page.waitForTimeout(100);
  assert.ok(await game(page, () => window.__seedstorm().player.focus), 'Shift focuses');
  await page.keyboard.up('Shift');
  // weave about under the critters for a while: auto-fire does the rest
  const s0 = await game(page, () => window.__seedstorm().score);
  for (let i = 0; i < 8; i++) { const k = i % 2 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k); }
  await page.waitForFunction((s) => window.__seedstorm().score > s, s0, { timeout: 15000 });
  console.log(`PASS keyboard flight plays the stage (score ${await game(page, () => window.__seedstorm().score)})`);

  // pause stops the clock; resuming carries on; a hidden tab pauses too
  await page.keyboard.press('p');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = await game(page, () => window.__seedstorm().tick); await page.waitForTimeout(400);
  assert.equal(await game(page, () => window.__seedstorm().tick), t0, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep flying' }).click();
  await page.waitForFunction((t) => window.__seedstorm().tick > t + 10, t0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  await page.getByRole('button', { name: 'Keep flying' }).click();
  console.log('PASS pausing stops the sky, and hiding the tab pauses it');

  // the skip helper: straight to Crabapple Crow, through the chat, and the boss bar on screen
  await page.evaluate(() => { window.__seedstormSkip(2); window.__seedstorm().player.invuln = 900; });
  await page.getByRole('dialog', { name: 'Chat' }).waitFor({ timeout: 15000 });
  assert.equal(await game(page, () => window.__seedstorm().chat.boss), 'crow');
  await page.keyboard.press('Enter');
  assert.equal(await game(page, () => window.__seedstorm().chat?.i), 1, 'Enter moves the chat on');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => { const g = window.__seedstorm(); return g.phase === 'play' && g.boss?.state === 'fight'; });
  assert.equal(await game(page, () => window.__seedstorm().banner?.text), 'Crabapple Cascade', 'the first attack is announced');
  await page.waitForTimeout(300);
  const bar = [];
  for (const fx of [24, 40, 60]) bar.push(await fieldPixel(page, fx, 82.5));
  assert.ok(bar.some(([r, g]) => r > 200 && g < 200), `the boss health bar is drawn (${JSON.stringify(bar)})`);
  await page.evaluate(() => { const g = window.__seedstorm(); g.boss.hp = 1; g.player.invuln = 900; });
  await page.waitForFunction(() => window.__seedstorm().boss?.phase === 1, null, { timeout: 10000 });
  console.log('PASS the skip helper reaches the boss, the chat runs, and its bar is drawn');
  await page.close();
}

{
  // Bloom clears the sky, then game over goes on the high-score table
  const page = await open();
  await page.goto(base + '/seedstorm'); await ready(page);
  await page.evaluate(() => window.__seedstormStart({ pilot: 'dora', diff: 'breezy', seed: 1 }));
  await page.locator('main[data-screen="play"]').waitFor(); await page.locator('.ss-canvas').focus();
  await page.evaluate(() => { const g = window.__seedstorm(); for (let i = 0; i < 6; i++) g.ring(180, 160 + i * 25, 20, 0.05, i * 0.1, 0, i % 8); });
  const before = await game(page, () => { const g = window.__seedstorm(); return { n: g.bulletCount, blooms: g.blooms, seeds: g.seedCount }; });
  assert.ok(before.n >= 60, `bullets in the sky (${before.n})`);
  await page.keyboard.press('x');
  await page.waitForFunction((b) => window.__seedstorm().blooms === b - 1, before.blooms);
  await page.waitForTimeout(1000);
  const after = await game(page, () => { const g = window.__seedstorm(); return { n: g.bulletCount, seeds: g.seedCount, purse: g.purse }; });
  assert.ok(after.n < 5 && after.seeds + after.purse > before.seeds + 40, `X Blooms the bullets into seeds (${JSON.stringify(after)})`);
  console.log('PASS Bloom turns the bullets into seeds');

  await page.evaluate(() => { const g = window.__seedstorm(); g.score = 4321; g.hearts = 1; g.player.invuln = 0; g.blooms = 0; g.shoot(g.player.x, g.player.y - 30, Math.PI / 2, 3, 1, 1); });
  await page.getByRole('dialog', { name: 'Out of hearts' }).waitFor();
  assert.ok(await page.getByRole('button', { name: /Continue/ }).isVisible(), 'Breezy offers a continue');
  await page.getByRole('button', { name: 'End run' }).click();
  await page.locator('.ss-table tr.is-new').waitFor();
  const row = await page.locator('.ss-table tr.is-new').innerText();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('seedstorm-v1'))), top = saved.scores.breezy[0];
  const shown = await page.evaluate((n) => n.toLocaleString(), top.score);
  assert.ok(row.includes(shown) && /Dora/.test(row) && /\d{4}/.test(row), `the new row shows the score, pilot and date (${row})`);
  assert.ok(saved.v === 1 && top.score >= 4321 && top.pilot === 'dora' && saved.reached.breezy >= 1, 'the score and the stage reached are saved');
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'High scores' }).click(); await page.getByRole('tab', { name: 'Breezy' }).click();
  assert.ok((await page.locator('.ss-table tbody').innerText()).includes(shown), 'the table survives a reload');
  console.log('PASS game over records the score on the table');
  await page.close();
}

for (const [w, h] of [[390, 844], [844, 390]]) {
  const page = await open({ width: w, height: h }, true);
  await page.goto(base + '/seedstorm'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the menu at ${w}×${h}`);
  await page.evaluate(() => window.__seedstormStart({ pilot: 'dora', diff: 'breezy', seed: 3 }));
  await page.locator('main[data-screen="play"]').waitFor();
  assert.ok(await noSideScroll(page), `no sideways scroll in flight at ${w}×${h}`);
  const box = await page.locator('.ss-canvas').boundingBox();
  const field = await page.evaluate(() => { const r = document.querySelector('.ss-canvas').getBoundingClientRect(), s = Math.min(r.width / 360, r.height / 640); return { s, oy: (r.height - 640 * s) / 2 }; });
  assert.ok(field.s * 640 <= box.height + 1 && field.s * 360 <= box.width + 1, 'the whole field fits on screen');
  assert.ok(await page.locator('.ss-bloom').isVisible() && await page.locator('.ss-focus').isVisible(), 'touch Bloom and Focus buttons show');
  // a drag flies the pilot with the finger's offset kept
  const x0 = await game(page, () => window.__seedstorm().player.x), cx = box.x + box.width / 2, cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 50, cy, { steps: 6 }); await page.waitForTimeout(250); await page.mouse.up();
  const x1 = await game(page, () => window.__seedstorm().player.x);
  assert.ok(x1 > x0 + 50 / field.s - 8 && x1 < x0 + 50 / field.s + 8, `a drag moves the pilot by the same amount (${x0} → ${x1}, expected +${(50 / field.s).toFixed(0)})`);
  const b0 = await game(page, () => window.__seedstorm().blooms);
  await page.locator('.ss-bloom').tap();
  await page.waitForFunction((b) => window.__seedstorm().blooms === b - 1, b0);
  await page.locator('.ss-focus').tap(); await page.waitForTimeout(100);
  assert.ok(await game(page, () => window.__seedstorm().player.focus), 'the Focus button toggles focus');
  console.log(`PASS the ${w > h ? 'sideways' : 'upright'} phone layout fits, drags fly and the touch buttons work`);
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
