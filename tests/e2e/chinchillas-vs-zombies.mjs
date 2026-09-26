import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const lawn = (p) => p.getByTestId('lawn');
const game = (p, fn) => p.evaluate(`(${fn})(window.__cvz())`);
const count = async (p) => Number(await lawn(p).getAttribute('data-defenders'));
// The canvas draws a 970 × 578 view; the lawn starts 132 px in and 64 px down, with tiles 86 × 100.
const at = (box, x, y) => [box.x + (x / 970) * box.width, box.y + (y / 578) * box.height];
const tileAt = (box, row, col) => at(box, 132 + (col + 0.5) * 86, 64 + (row + 0.5) * 100);
try {
  await mkdir('.checks/chinchillas-vs-zombies', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 20);
  assert.match(await menu.locator('a.arcade-card[href="/chinchillas-vs-zombies"]').textContent(), /Chinchillas vs Zombies/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/chinchillas-vs-zombies`);
  await page.evaluate(() => localStorage.removeItem('chinchillas-vs-zombies-v1'));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="level-1"]').disabled);
  assert.ok(await page.getByTestId('level-2').isDisabled(), 'night 2 is locked until night 1 is won');
  assert.equal(await page.locator('.cz-roster').first().locator('.cz-card.locked').count(), 5, 'five defenders still to meet');
  await page.screenshot({ path: '.checks/chinchillas-vs-zombies/home.png', fullPage: true });

  // Night 1: two defenders and the shovel.
  await page.getByTestId('level-1').click();
  await page.waitForSelector('[data-testid="lawn"][data-state="playing"]');
  assert.equal(await page.locator('.cz-packet').count(), 3);
  assert.equal(await page.getByTestId('seeds').textContent(), '🌻75');
  let box = await lawn(page).boundingBox();

  // Plant a Seed Gatherer with the packet and a click.
  await page.getByTestId('packet-gatherer').click();
  assert.equal(await page.getByTestId('packet-gatherer').getAttribute('aria-pressed'), 'true');
  await page.mouse.click(...tileAt(box, 1, 0));
  await page.waitForSelector('[data-testid="lawn"][data-defenders="1"]');
  assert.equal(await game(page, 'g => g.at(1, 0)?.kind'), 'gatherer');
  assert.equal(await page.getByTestId('packet-gatherer').getAttribute('aria-pressed'), 'false', 'the packet is put down after planting');

  // Too poor for a Flicker, and nothing grows on the bare lanes.
  await page.getByTestId('packet-flicker').click();
  await page.mouse.click(...tileAt(box, 2, 2));
  await page.waitForSelector('.cz-note');
  assert.match(await page.locator('.cz-note').textContent(), /Not enough seeds/);
  await game(page, 'g => { g.seeds = 1000; }');
  await page.mouse.click(...tileAt(box, 0, 2));
  await page.waitForFunction(() => /bare earth/.test(document.querySelector('.cz-note')?.textContent ?? ''));
  assert.equal(await count(page), 1);
  // Right-click puts the packet down.
  await page.mouse.click(...tileAt(box, 2, 2), { button: 'right' });
  assert.equal(await page.getByTestId('packet-flicker').getAttribute('aria-pressed'), 'false');

  // Click a seed pouch to collect it.
  const seeds0 = await game(page, 'g => { g.drops.push({ id: 9999, x: 5.5, y: 2.5, toY: 2.5, value: 25, life: 30, sky: true }); return g.seeds; }');
  await page.mouse.click(...at(box, 132 + 5.5 * 86, 64 + 2.5 * 100));
  await page.waitForFunction((s) => window.__cvz().seeds === s + 25, seeds0);
  assert.ok(!(await game(page, 'g => g.drops.some((d) => d.id === 9999)')));
  // Space collects every pouch on the lawn.
  await game(page, 'g => { g.drops.push({ id: 9998, x: 2.5, y: 1.5, toY: 1.5, value: 25, life: 30, sky: true }, { id: 9997, x: 7.5, y: 3.5, toY: 3.5, value: 25, life: 30, sky: true }); }');
  const seeds1 = await game(page, 'g => g.seeds');
  await page.keyboard.press('Space');
  await page.waitForFunction((s) => window.__cvz().seeds >= s + 50, seeds1);

  // The keyboard: 2 picks the Flicker, the arrows move, Enter plants.
  await page.mouse.move(...tileAt(box, 2, 4));
  await page.keyboard.press('2');
  assert.equal(await page.getByTestId('packet-flicker').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="lawn"][data-defenders="2"]');
  assert.equal(await game(page, 'g => g.at(1, 5)?.kind'), 'flicker');
  // Recharging: the packet waits.
  assert.match(await page.getByTestId('packet-flicker').getAttribute('aria-label'), /recharging/);
  await page.keyboard.press('2');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /still recharging/.test(document.querySelector('.cz-note')?.textContent ?? ''));
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('packet-flicker').getAttribute('aria-pressed'), 'false');

  // The shovel digs a defender up.
  await page.getByTestId('shovel').click();
  await page.mouse.click(...tileAt(box, 1, 0));
  await page.waitForSelector('[data-testid="lawn"][data-defenders="1"]');
  assert.equal(await game(page, 'g => g.at(1, 0)'), null);

  // F speeds up; P pauses and resumes.
  await page.keyboard.press('f');
  await page.getByRole('button', { name: '2× · F' }).waitFor();
  await page.keyboard.press('f'); await page.keyboard.press('f');
  await page.getByRole('button', { name: '1× · F' }).waitFor();
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="lawn"][data-state="paused"]');
  assert.match(await page.locator('.cz-overlay').textContent(), /PAUSED/);
  const t = await game(page, 'g => g.time');
  await page.waitForTimeout(400);
  assert.equal(await game(page, 'g => g.time'), t, 'nothing moves while paused');
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="lawn"][data-state="playing"]');

  // Zombies arrive and a Flicker shoots them.
  await game(page, 'g => { g.recharge.flicker = 0; g.plant("flicker", 2, 1); for (let i = 0; i < 60 * 30; i++) g.update(1 / 60); }');
  await page.waitForTimeout(300);
  assert.ok(await game(page, 'g => g.zombies.length > 0 || g.kills > 0'), 'the first wave is on the lawn');
  await page.screenshot({ path: '.checks/chinchillas-vs-zombies/night-1.png' });

  // Win the night: the next defender is shown and night 2 opens.
  await game(page, 'g => { g.spawns = []; g.zombies = []; }');
  await page.waitForSelector('[data-testid="lawn"][data-state="won"]');
  assert.match(await page.locator('.cz-overlay').textContent(), /New defender: Grandpa Pebble/);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('chinchillas-vs-zombies-v1'))), { cleared: 1 });
  await page.screenshot({ path: '.checks/chinchillas-vs-zombies/won.png' });
  await page.getByTestId('next-level').click();
  await page.waitForSelector('[data-testid="lawn"][data-state="playing"]');
  assert.equal(await game(page, 'g => g.level'), 1);
  assert.equal(await page.getByTestId('packet-pebble').count(), 1, 'Grandpa Pebble joins the seed bar');

  // A zombie past an empty lane gets into the burrow.
  await game(page, 'g => { g.carts = g.carts.map(() => "used"); g.spawns.unshift({ kind: "zombie", row: 2, at: 0 }); g.update(1 / 600); g.zombies.at(-1).x = 0.08; }');
  await page.waitForSelector('[data-testid="lawn"][data-state="lost"]');
  assert.match(await page.locator('.cz-overlay').textContent(), /got into the burrow/);
  await page.screenshot({ path: '.checks/chinchillas-vs-zombies/lost.png' });

  // Back home, night 2 is open.
  await page.getByRole('button', { name: 'Choose a night' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="level-2"]').disabled);
  assert.ok(await page.getByTestId('level-3').isDisabled());
  await page.close();

  // A phone: the first tap previews, the second plants.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/chinchillas-vs-zombies`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="level-1"]').disabled);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling on the home screen');
  await phone.getByTestId('level-1').tap();
  await phone.waitForSelector('[data-testid="lawn"][data-state="playing"]');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling on the lawn');
  box = await lawn(phone).boundingBox();
  assert.ok(box.width <= 390);
  await phone.getByTestId('packet-gatherer').tap();
  await phone.touchscreen.tap(...tileAt(box, 2, 0));
  await phone.waitForFunction(() => /Tap again/.test(document.querySelector('.cz-note')?.textContent ?? ''));
  assert.equal(await count(phone), 0, 'the first tap only previews');
  await phone.touchscreen.tap(...tileAt(box, 2, 0));
  await phone.waitForSelector('[data-testid="lawn"][data-defenders="1"]');
  assert.equal(await game(phone, 'g => g.at(2, 0)?.kind'), 'gatherer');
  await phone.screenshot({ path: '.checks/chinchillas-vs-zombies/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Passed: menu card, level lock, planting by click and keyboard, seeds, shovel, speed, pause, winning with an unlock, losing, and phone taps.');
} finally {
  await browser.close();
}
