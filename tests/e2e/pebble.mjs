// Pebble Pop in the browser: the arcade card, choosing a chinchilla, the map, playing a wall by keys and mouse, the
// reward, pausing, saving and carrying on a run, the end of a run, and the phone layout.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** Clicks the first open map step with the mouse, as a player would. */
const clickStep = async (page) => { const b = await page.locator('.pebble-node.is-open').first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
const phase = (page) => page.evaluate(() => window.__pebble()?.phase ?? null);

{
  const page = await open();
  await page.goto(base); assert.equal(await page.locator('.arcade-card').count(), 52);
  await page.getByRole('link', { name: /Pebble Pop/ }).click(); await page.waitForURL('**/pebble'); await ready(page);
  console.log('PASS the arcade lists Pebble Pop and its card opens the game');

  await page.getByRole('radio', { name: /Enzo/ }).click();
  assert.equal(await page.getByRole('radio', { name: /Enzo/ }).getAttribute('aria-checked'), 'true');
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('radio', { name: /Enzo/ }).getAttribute('aria-checked'), 'true', 'the chinchilla is remembered');
  await page.getByRole('radio', { name: /Dora/ }).click();
  await page.getByRole('button', { name: /NEW RUN WITH DORA/ }).click();
  await page.getByRole('region', { name: 'The map' }).waitFor();
  assert.equal(await phase(page), 'map');
  const open1 = page.locator('.pebble-node.is-open');
  assert.equal(await open1.count(), 1, 'one place to start');
  console.log('PASS choosing Dora starts a run on the map');

  // the first wall: launch with Space, steer with the keys under the pebble for a while
  await page.waitForFunction(() => { const r = document.querySelector('.pebble-node.is-open')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; }); await clickStep(page); // open steps bob forever, so they never count as stable: click like a player instead
  await page.waitForFunction(() => window.__pebble()?.phase === 'wall');
  await page.locator('.pebble-canvas').focus();
  await page.keyboard.press('Space');
  assert.ok(await page.evaluate(() => !window.__pebble().wall.balls[0].held), 'Space launches the pebble');
  await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
  const px = await page.evaluate(() => window.__pebble().wall.paddle.x);
  assert.ok(px > 180, `the D key moves the bale right (${px})`);
  // the mouse steers too
  const box = await page.locator('.pebble-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.8); await page.waitForTimeout(200);
  const px2 = await page.evaluate(() => window.__pebble().wall.paddle.x);
  assert.ok(px2 < px, `the mouse moves the bale (${px2})`);
  // keep the pebble up for a few seconds by following it with the mouse
  const t0 = Date.now(); let lost = 0;
  while (Date.now() - t0 < 4000) {
    const s = await page.evaluate(() => { const g = window.__pebble(), b = g.wall?.balls[0]; return b ? { x: b.x, lives: g.lives } : null; });
    if (!s) break; lost = 3 - s.lives;
    // move the real mouse to where the pebble is, through the canvas's own mapping
    const sx = await page.evaluate((x) => { const c = document.querySelector('.pebble-canvas').getBoundingClientRect(), k = Math.min((c.width - 16) / 360, (c.height - 80) / 540); return c.left + (c.width - 360 * k) / 2 + x * k; }, s.x);
    await page.mouse.move(sx, box.y + box.height * 0.8);
    await page.waitForTimeout(50);
  }
  const hits = await page.evaluate(() => window.__pebble().wall?.hits ?? 0);
  console.log(`PASS keys, mouse and Space play the wall (${hits} hits, ${lost} pebbles lost)`);

  // pause stops the clock
  await page.keyboard.press('p');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const frozen = await page.evaluate(() => window.__pebble().wall.clock); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__pebble().wall.clock), frozen, 'the wall clock stops while paused');
  await page.getByRole('button', { name: 'Keep popping' }).click();
  await page.waitForFunction((t) => window.__pebble().wall.clock > t + 0.2, frozen);
  console.log('PASS pausing stops the wall and resuming carries on');

  // clear the wall, then pick an upgrade
  await page.evaluate(() => window.__pebble().popAll());
  await page.getByRole('dialog', { name: 'Pick an upgrade' }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.pebble-reward .pebble-card').count(), 3);
  const picked = await page.evaluate(() => window.__pebble().offer[0]);
  await page.locator('.pebble-reward .pebble-card').first().click();
  await page.getByRole('region', { name: 'The map' }).waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pebble-pop-v1')));
  assert.ok(saved.run && saved.run.ups[picked] === 1 && saved.discovered.includes(picked), 'the run and the new upgrade are saved');
  console.log(`PASS clearing a wall offers three upgrades, and ${picked} is saved with the run`);

  // leave and carry on
  await page.getByRole('button', { name: '← Menu' }).click();
  await page.getByRole('button', { name: /Carry on: step 2/ }).click();
  await page.getByRole('region', { name: 'The map' }).waitFor();
  assert.equal(await page.evaluate((id) => window.__pebble().has(id), picked), 1, 'the carried-on run keeps its upgrade');
  console.log('PASS a saved run carries on from the map');

  // lose the run: drop every pebble
  await page.waitForFunction(() => { const r = document.querySelector('.pebble-node.is-open')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; }); await clickStep(page);
  await page.waitForFunction(() => window.__pebble()?.phase === 'wall');
  await page.evaluate(() => { const g = window.__pebble(); g.lives = 1; g.wall.shield = 0; const b = g.wall.balls[0]; b.held = false; b.x = 10; b.y = 520; b.vx = 0; b.vy = 300; g.input.target = 340; });
  await page.getByRole('dialog', { name: 'Run over' }).waitFor({ timeout: 10000 });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pebble-pop-v1')));
  assert.ok(after.runs === 1 && after.run === null && after.bestFloor >= 2, 'the finished run is recorded');
  console.log('PASS losing every pebble ends the run kindly and records it');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.goto(base + '/pebble'); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the title');
  await page.evaluate(() => window.__pebbleStart('enzo', 1234));
  await page.waitForFunction(() => { const r = document.querySelector('.pebble-node.is-open')?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; }); await clickStep(page);
  await page.waitForFunction(() => window.__pebble()?.phase === 'wall');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll in a wall');
  // a tap launches and a drag steers
  const box = await page.locator('.pebble-canvas').boundingBox();
  await page.mouse.move(box.width * 0.5, box.height * 0.8); await page.mouse.down();
  assert.ok(await page.evaluate(() => !window.__pebble().wall.balls[0].held), 'a press launches');
  await page.mouse.move(box.width * 0.2, box.height * 0.8, { steps: 5 }); await page.waitForTimeout(150); await page.mouse.up();
  assert.ok(await page.evaluate(() => window.__pebble().wall.paddle.x < 150), 'dragging moves the bale');
  console.log('PASS the phone layout fits, a press launches and a drag steers');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
