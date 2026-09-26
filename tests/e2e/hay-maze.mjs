import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const board = (p) => p.getByTestId('board');
const game = (p, fn) => p.evaluate(`(${fn})(window.__maze())`);
try {
  await mkdir('.checks/hay-maze', { recursive: true });

  // The arcade lists the new cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 19);
  assert.match(await menu.locator('a.arcade-card[href="/hay-maze"]').textContent(), /Hay Maze Defence/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/hay-maze`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="play-meadow"]').disabled);
  assert.equal(await page.getByTestId('play-canyon').isDisabled(), true, 'the canyon starts locked');
  await page.screenshot({ path: '.checks/hay-maze/home.png', fullPage: true });

  await page.getByTestId('play-meadow').click();
  await page.waitForSelector('[data-testid="board"][data-state="playing"]');
  const box = await board(page).boundingBox();
  // Tile (c, r) on screen: the grid starts 26 px in and 22 px down on a 712 × 420 canvas, 32 px a tile.
  const tile = (c, r) => [box.x + ((26 + c * 32 + 16) / 712) * box.width, box.y + ((22 + r * 32 + 16) / 420) * box.height];
  const walk0 = Number(await board(page).getAttribute('data-walk'));

  // Build a hay bale with the mouse: the predators' walk gets longer as bales cross the way.
  await page.getByTestId('build-hay').click();
  assert.equal(await page.getByTestId('build-hay').getAttribute('aria-pressed'), 'true');
  for (let r = 1; r < 12; r++) await page.mouse.click(...tile(9, r));
  await page.waitForTimeout(200);
  assert.equal(Number(await board(page).getAttribute('data-towers')), 11, 'build mode stays on for a row of bales');
  assert.ok(Number(await board(page).getAttribute('data-walk')) > walk0, 'the bales bend the route');
  // The last gap can't be closed.
  await game(page, 'g => { g.hay = 500; }');
  await page.mouse.click(...tile(9, 0));
  await page.waitForSelector('.hm-note');
  assert.match(await page.locator('.hm-note').textContent(), /Leave them a way through/);
  assert.equal(Number(await board(page).getAttribute('data-towers')), 11);

  // Keyboard: pick the Pellet Flicker with 2, move with the arrows and build with Enter.
  await page.mouse.move(box.x - 30, box.y);
  await page.keyboard.press('2');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  assert.equal(await game(page, 'g => g.towers.filter((t) => t.kind === "flicker").length'), 1, 'keyboard build');
  await page.keyboard.press('Escape');

  // Select it, upgrade it, and sell a bale.
  const at = await game(page, 'g => { const t = g.towers.find((t) => t.kind === "flicker"); return [t.c, t.r]; }');
  await page.mouse.click(...tile(...at));
  await page.waitForSelector('[data-testid="upgrade"]');
  await page.getByTestId('upgrade').click();
  assert.equal(await game(page, 'g => g.towers.find((t) => t.kind === "flicker").level'), 1);
  await page.mouse.click(...tile(9, 5));
  const hayBefore = await game(page, 'g => g.hay');
  await page.getByTestId('sell').click();
  assert.equal(await game(page, 'g => g.hay') - hayBefore, 2, 'a bale sells back for 70%');
  assert.equal(await game(page, 'g => g.towerAt(9, 5)'), null);

  // Start the first wave; predators arrive and the countdown to the next wave begins.
  await page.getByTestId('send-wave').click();
  await page.waitForFunction(() => window.__maze().enemies.length > 0);
  assert.match(await page.getByTestId('wave').textContent(), /1\/20/);
  await page.getByTestId('build-puffer').click();
  await page.mouse.move(...tile(6, 6));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.checks/hay-maze/play.png' });

  // Pause and resume.
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="board"][data-state="paused"]');
  const t = await game(page, 'g => g.time');
  await page.waitForTimeout(300);
  assert.equal(await game(page, 'g => g.time'), t);
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="board"][data-state="playing"]');

  // Speed up.
  await page.keyboard.press('f');
  assert.match(await page.locator('button:has-text("× · F")').textContent(), /2×/);

  // Win the map: the canyon opens and the win is remembered.
  await game(page, 'g => { g.queue.length = 0; g.enemies.length = 0; g.wave = 20; }');
  await page.waitForSelector('[data-testid="board"][data-state="won"]');
  assert.match(await page.locator('.hm-overlay').textContent(), /The stash is safe/);
  await page.screenshot({ path: '.checks/hay-maze/won.png' });
  await page.getByRole('button', { name: 'Map select' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="play-canyon"]').disabled);
  assert.match(await page.locator('.hm-map').first().textContent(), /Won with 20 raisins/);

  // Losing: raisins run out.
  await page.getByTestId('play-canyon').click();
  await page.waitForSelector('[data-testid="board"][data-state="playing"]');
  await game(page, 'g => { g.raisins = 1; g.queue.push({ kind: "weasel", at: 0, entrance: 0 }); }');
  await game(page, 'g => { for (let i = 0; i < 60 * 40 && g.state === "playing"; i++) g.update(1 / 60); }');
  await page.waitForSelector('[data-testid="board"][data-state="lost"]');
  assert.match(await page.locator('.hm-overlay').textContent(), /Not a raisin left/);
  await page.close();

  // A phone: the meadow fits the width, and taps build.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/hay-maze`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="play-meadow"]').disabled);
  await phone.getByTestId('play-meadow').tap();
  await phone.waitForSelector('[data-testid="board"]');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
  const pbox = await board(phone).boundingBox();
  await phone.getByTestId('build-hay').tap();
  const spot = [pbox.x + ((26 + 6 * 32 + 16) / 712) * pbox.width, pbox.y + ((22 + 3 * 32 + 16) / 420) * pbox.height];
  await phone.touchscreen.tap(...spot);
  await phone.waitForTimeout(200);
  assert.equal(await game(phone, 'g => g.towerAt(6, 3)'), null, 'the first tap only previews');
  assert.match(await phone.locator('.hm-note').textContent(), /Tap again/);
  await phone.touchscreen.tap(...spot);
  await phone.waitForTimeout(200);
  assert.ok(await game(phone, 'g => !!g.towerAt(6, 3)'), 'the second tap builds');
  await phone.screenshot({ path: '.checks/hay-maze/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS Hay Maze Defence browser: 19-card menu, locked maps, mouse bales that lengthen the route, the last gap refused, keyboard build, upgrade and sell, a wave arriving, pause and speed, a win that opens the next map, losing, and tap-to-preview, tap-again-to-build on a phone.');
} finally {
  await browser.close();
}
