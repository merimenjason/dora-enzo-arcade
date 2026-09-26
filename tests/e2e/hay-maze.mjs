import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const board = (p) => p.getByTestId('board');
const game = (p, fn) => p.evaluate(`(${fn})(window.__maze())`);
// The canvas is 740 × 424 with the grid 26 px in and 24 px down, 32 px a tile.
const tileAt = (box, c, r) => [box.x + ((26 + c * 32 + 16) / 740) * box.width, box.y + ((24 + r * 32 + 16) / 424) * box.height];
try {
  await mkdir('.checks/hay-maze', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 19);
  assert.match(await menu.locator('a.arcade-card[href="/hay-maze"]').textContent(), /Hay Maze Defence/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/hay-maze`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="begin"]').disabled);
  assert.equal(await page.locator('.hm-roster').first().locator('.hm-card').count(), 8, 'eight towers in the crew');
  await page.screenshot({ path: '.checks/hay-maze/home.png', fullPage: true });

  // Begin a run: a hand of seven cards and the three starter towers.
  await page.getByTestId('begin').click();
  await page.waitForSelector('[data-testid="board"][data-phase="build"]');
  assert.equal(await page.locator('.hm-cardbtn').count(), 7);
  assert.equal(await page.locator('.hm-tool').count(), 3, 'only the starter towers');
  const box = await board(page).boundingBox();

  // Pick a bale card, turn it, and lay it where it fits.
  const slot = await game(page, 'r => r.battle.hand.findIndex((id) => id !== "shovel" && id !== "bundle" && id !== "cocoa")');
  await page.getByTestId(`card-${slot}`).click();
  assert.equal(await page.getByTestId(`card-${slot}`).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('r');
  const spot = await game(page, `r => { const b = r.battle, id = b.hand[${slot}]; for (let row = 2; row < 10; row++) for (let c = 4; c < 16; c++) if (b.canPlace(id, 1, c, row) === 'ok') return [c, row]; return null; }`);
  assert.ok(spot, 'somewhere for the bale');
  const walk0 = Number(await board(page).getAttribute('data-walk'));
  await page.mouse.click(...tileAt(box, ...spot));
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.hm-cardbtn').count(), 6, 'the card is played');
  assert.ok(await game(page, 'r => r.battle.blocks.some(Boolean)'), 'the bales are down');
  assert.ok(Number(await board(page).getAttribute('data-walk')) >= walk0);

  // A bale can't go on a rock.
  const rock = await game(page, 'r => { const b = r.battle; for (let row = 1; row < 11; row++) for (let c = 2; c < 18; c++) if (b.rock(c, row)) return [c, row]; }');
  const second = await game(page, 'r => r.battle.hand.findIndex((id) => id !== "shovel" && id !== "bundle" && id !== "cocoa")');
  await page.getByTestId(`card-${second}`).click();
  await page.mouse.click(...tileAt(box, ...rock));
  await page.waitForSelector('.hm-note');
  assert.match(await page.locator('.hm-note').textContent(), /already there|doesn’t fit/);
  await page.keyboard.press('Escape');

  // Towers stand on bales and rocks, not on grass.
  await page.keyboard.press('z');
  assert.equal(await page.getByTestId('build-flicker').getAttribute('aria-pressed'), 'true');
  const grass = await game(page, 'r => { const b = r.battle; for (let row = 1; row < 11; row++) for (let c = 3; c < 17; c++) if (!b.rock(c, row) && !b.block(c, row)) return [c, row]; }');
  await page.mouse.click(...tileAt(box, ...grass));
  await page.waitForTimeout(100);
  assert.match(await page.locator('.hm-note').textContent(), /hay bales or rocks/);
  const baleTile = await game(page, 'r => { const b = r.battle; for (let row = 0; row < 12; row++) for (let c = 0; c < 20; c++) if (b.block(c, row)) return [c, row]; }');
  await page.mouse.click(...tileAt(box, ...baleTile));
  await page.mouse.click(...tileAt(box, ...rock));
  await page.waitForTimeout(150);
  assert.equal(Number(await board(page).getAttribute('data-towers')), 2, 'a flicker on the bale and one on the rock');
  await page.keyboard.press('Escape');

  // Select one, upgrade it and sell it.
  await game(page, 'r => { r.battle.hay = 500; }');
  await page.mouse.click(...tileAt(box, ...rock));
  await page.getByTestId('upgrade').click();
  assert.equal(await game(page, `r => r.battle.towerAt(${rock[0]}, ${rock[1]}).level`), 1);
  await page.getByTestId('sell').click();
  assert.equal(await game(page, `r => r.battle.towerAt(${rock[0]}, ${rock[1]})`), null);
  await page.screenshot({ path: '.checks/hay-maze/build.png' });

  // Start the wave with Space: bale cards wait, towers don't.
  await page.keyboard.press('Space');
  await page.waitForSelector('[data-testid="board"][data-phase="wave"]');
  assert.match(await page.getByTestId('wave').textContent(), /1\/5/);
  const pieceSlot = await game(page, 'r => r.battle.hand.findIndex((id) => id !== "shovel" && id !== "bundle" && id !== "cocoa")');
  if (pieceSlot >= 0) assert.equal(await page.getByTestId(`card-${pieceSlot}`).isDisabled(), true);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.checks/hay-maze/wave.png' });

  // Pause and resume.
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="board"][data-paused="true"]');
  const t = await game(page, 'r => r.battle.time');
  await page.waitForTimeout(300);
  assert.equal(await game(page, 'r => r.battle.time'), t);
  await page.keyboard.press('p');

  // Finish the level: the reward screen offers three things, and picking one opens level 2.
  await game(page, 'r => { const b = r.battle; b.queue.length = 0; b.enemies.length = 0; for (let w = b.wave; w < 5; w++) b.plan[w] = [["weasel", 1, 1]]; b.plan[b.wave - 1] = []; }');
  await game(page, 'r => { for (let g = 0; g < 20 && r.state === "battle"; g++) { const b = r.battle; if (b.phase === "build") b.sendWave(); for (let i = 0; i < 60 * 30 && b.phase === "wave"; i++) { for (const e of b.enemies) e.hp = 0; b.update(1 / 60); } } }');
  await page.waitForSelector('[data-testid="reward-0"]');
  assert.equal(await page.locator('.hm-reward').count(), 3);
  await page.screenshot({ path: '.checks/hay-maze/reward.png' });
  const kind = await page.getByTestId('reward-0').getAttribute('data-kind');
  await page.getByTestId('reward-0').click();
  await page.waitForSelector('[data-testid="board"][data-level="2"][data-phase="build"]');
  if (kind === 'tower') assert.equal(await page.locator('.hm-tool').count(), 4, 'the new tower joins the bar');

  // Losing: the Hearthlight goes out.
  await game(page, 'r => { r.flame = 1; const b = r.battle; b.plan[b.wave] = [["weasel", 3, 0.3]]; b.sendWave(); for (let i = 0; i < 60 * 60 && r.state === "battle"; i++) b.update(1 / 60); }');
  await page.waitForSelector('[data-testid="board"][data-state="lost"]');
  assert.match(await page.locator('.hm-overlay').textContent(), /Hearthlight went out/);
  await page.close();

  // A phone: the meadow fits, and a tap previews before a second tap lays the bale.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/hay-maze`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="begin"]').disabled);
  await phone.getByTestId('begin').tap();
  await phone.waitForSelector('[data-testid="board"]');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
  const pslot = await game(phone, 'r => r.battle.hand.findIndex((id) => id !== "shovel" && id !== "bundle" && id !== "cocoa")');
  await phone.getByTestId(`card-${pslot}`).tap();
  const pspot = await game(phone, `r => { const b = r.battle, id = b.hand[${pslot}]; for (let row = 2; row < 10; row++) for (let c = 4; c < 16; c++) if (b.canPlace(id, 0, c, row) === 'ok') return [c, row]; }`);
  const pbox = await board(phone).boundingBox();
  await phone.touchscreen.tap(...tileAt(pbox, ...pspot));
  await phone.waitForTimeout(200);
  assert.equal(await game(phone, 'r => r.battle.blocks.some(Boolean)'), false, 'the first tap only previews');
  await phone.touchscreen.tap(...tileAt(pbox, ...pspot));
  await phone.waitForTimeout(200);
  assert.ok(await game(phone, 'r => r.battle.blocks.some(Boolean)'), 'the second tap lays it');
  await phone.screenshot({ path: '.checks/hay-maze/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS Hay Maze Defence browser: 19-card menu, a run with a seven-card hand and three starter towers, laying and turning a bale, bales refused on rocks, towers only on bales and rocks, upgrade and sell, starting a wave with bales held back, pause, clearing a level to a three-way reward and level 2, losing the Hearthlight, and tap-to-preview on a phone.');
} finally {
  await browser.close();
}
