import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const map = (p) => p.getByTestId('map');
const game = (p, fn) => p.evaluate(`(${fn})(window.__frontier())`);
/** Screen point of a tile's centre, through the page's camera (the canvas draws a 644-pixel view with a 10-pixel border). */
const tileAt = async (p, x, y) => {
  const box = await map(p).boundingBox();
  const cam = await p.evaluate(() => { const g = window.__frontier(); let x0 = 13, y0 = 13, x1 = 0, y1 = 0; for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) if (g.tile(x, y).seen) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } x0 -= 1.5; y0 -= 1.5; x1 += 2.5; y1 += 2.5; const size = Math.min(13, Math.max(7, x1 - x0, y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; return { x: Math.max(0, Math.min(13 - size, cx - size / 2)), y: Math.max(0, Math.min(13 - size, cy - size / 2)), size }; });
  const k = 624 / (cam.size * 48), vx = 10 + (x + 0.5 - cam.x) * 48 * k, vy = 10 + (y + 0.5 - cam.y) * 48 * k;
  return [box.x + (vx / 644) * box.width, box.y + (vy / 644) * box.height];
};
/** Lets the camera settle after the land changes. */
const settle = (p) => p.waitForTimeout(1600);
try {
  await mkdir('.checks/frontier', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 30);
  assert.match(await menu.locator('a.arcade-card[href="/frontier"]').textContent(), /Frostpaw Frontier/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/frontier`);
  await page.evaluate(() => { localStorage.removeItem('frostpaw-frontier-v1'); localStorage.removeItem('frostpaw-frontier-run-v1'); });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="map-1"]').disabled);
  assert.ok(await page.getByTestId('map-2').isDisabled(), 'Salt Flats waits for the first beacon');
  assert.equal(await page.getByTestId('continue').count(), 0, 'nothing to continue yet');
  await page.screenshot({ path: '.checks/frontier/home.png', fullPage: true });

  // A new run: the burrow is selected, with a farm and a lodge already working.
  await page.getByTestId('map-1').click();
  await page.waitForSelector('[data-testid="map"][data-state="playing"]');
  assert.match(await page.getByTestId('panel').textContent(), /The Burrow · level 1/);
  assert.equal(await game(page, 'g => g.buildings.length'), 2);
  await game(page, 'g => g.pause()');

  // Explore: a cloud tile next to home, by clicking it. Set its contents so the test knows what's there.
  const [ex, ey] = await game(page, `g => { const x = ${6} + 2, y = 6, t = g.tile(x, y); t.t = 'meadow'; t.f = 'cache'; t.cache = { hay: 0, wood: 30, stone: 0 }; g.state = 'playing'; return [x, y]; }`);
  const s0 = await game(page, 'g => g.stamina'), w0 = await game(page, 'g => Math.floor(g.stock.wood)');
  await page.mouse.click(...(await tileAt(page, ex, ey)));
  await page.waitForFunction(([x, y]) => window.__frontier().tile(x, y).seen, [ex, ey]);
  assert.equal(await game(page, 'g => g.stamina'), s0 - 1);
  assert.ok((await game(page, 'g => g.stock.wood')) >= w0 + 30, 'the cache is collected');
  await settle(page);
  // Too far: a cloud tile with nothing held beside it.
  await page.mouse.click(...(await tileAt(page, ex + 2, ey)));
  assert.match(await page.getByTestId('panel').textContent(), /Under the cloud/);
  assert.ok(await page.getByTestId('explore').isDisabled());

  // Build a nest on a meadow from the tile's panel.
  const meadow = await game(page, `g => { for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) { const t = g.tile(x, y); if (t.seen && !t.f && t.t === 'meadow' && !g.buildingAt(x, y)) return [x, y]; } }`);
  await game(page, 'g => { g.stock.wood = Math.max(g.stock.wood, 200); g.stock.hay = Math.max(g.stock.hay, 200); g.stock.stone = Math.max(g.stock.stone, 200); }');
  await page.mouse.click(...(await tileAt(page, ...meadow)));
  await page.getByTestId('build-nest').click();
  await page.waitForFunction(([x, y]) => window.__frontier().buildingAt(x, y)?.kind === 'nest', meadow);
  assert.equal(await game(page, 'g => g.housing'), 7);

  // Raise the burrow with U; the quarry tool opens.
  assert.ok(await page.getByTestId('tool-quarry').isDisabled());
  await page.keyboard.press('h');
  await page.keyboard.press('u');
  await page.waitForFunction(() => window.__frontier().hqLevel === 2);
  assert.ok(!(await page.getByTestId('tool-quarry').isDisabled()));

  // The keyboard: pick the watchtower (6), walk to a tile with the arrows, Enter builds it.
  const spot = await game(page, `g => { for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = 6 + dx, y = 6 + dy; if (g.canBuild('tower', x, y) === 'ok') return [dx, dy]; } }`);
  assert.ok(spot, 'somewhere for a tower');
  await game(page, 'g => { g.survivors += 1; }'); // someone free to keep watch
  await page.keyboard.press('6');
  assert.equal(await page.getByTestId('tool-tower').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('h');
  if (spot[0]) await page.keyboard.press(spot[0] > 0 ? 'ArrowRight' : 'ArrowLeft');
  if (spot[1]) await page.keyboard.press(spot[1] > 0 ? 'ArrowDown' : 'ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(([dx, dy]) => window.__frontier().buildingAt(6 + dx, 6 + dy)?.kind === 'tower', spot);
  assert.equal(await page.getByTestId('tool-tower').getAttribute('aria-pressed'), 'false', 'the tool is put down after building');

  // Workers: take one off the tower and put them back.
  await page.getByTestId('worker-minus').click();
  await page.waitForFunction(([dx, dy]) => window.__frontier().buildingAt(6 + dx, 6 + dy).workers === 0, spot);
  const idle = await game(page, 'g => g.idle');
  assert.ok(idle >= 1);
  await page.getByTestId('worker-plus').click();
  await page.waitForFunction(([dx, dy]) => window.__frontier().buildingAt(6 + dx, 6 + dy).workers === 1, spot);

  // Train Enzo at the burrow.
  await page.keyboard.press('h');
  await page.getByTestId('train-enzo').click();
  await page.waitForFunction(() => window.__frontier().hero('enzo').level === 2);

  // A den: attack it from its panel. A weasel hole falls to the squad.
  const den = await game(page, `g => { const x = 6, y = 6 + 2, t = g.tile(x, y); t.seen = true; t.t = 'meadow'; t.f = 'den'; t.den = 'weasel'; g.stamina = 10; return [x, y]; }`);
  await settle(page);
  await page.mouse.click(...(await tileAt(page, ...den)));
  assert.match(await page.getByTestId('panel').textContent(), /Weasel Hole/);
  await page.getByTestId('attack').click();
  await page.waitForFunction(([x, y]) => window.__frontier().tile(x, y).f === null, den);
  assert.equal(await game(page, 'g => g.denCleared'), 1);

  // A rumour: the choice dialog stops the clock until you answer.
  const rumour = await game(page, `g => { const x = 6 - 2, y = 6, t = g.tile(x, y); t.seen = false; t.t = 'meadow'; t.f = 'rumour'; t.event = 'spring'; g.stamina = 10; return [x, y]; }`);
  await settle(page);
  await page.mouse.click(...(await tileAt(page, ...rumour)));
  await page.waitForSelector('[data-testid="map"][data-state="event"]');
  assert.match(await page.getByTestId('overlay').textContent(), /A warm spring/);
  const t0 = await game(page, 'g => g.time');
  await page.waitForTimeout(300);
  assert.equal(await game(page, 'g => g.time'), t0);
  const hay = await game(page, 'g => g.stock.hay');
  await page.getByTestId('choice-2').click();
  await page.waitForSelector('[data-testid="map"][data-state="playing"]');
  assert.ok((await game(page, 'g => g.stock.hay')) >= hay + 24, 'the flasks are filled');

  // Speed and pause.
  await page.keyboard.press('f');
  await page.getByRole('button', { name: '2× · F' }).waitFor();
  await page.keyboard.press('f'); await page.keyboard.press('f');
  await page.getByRole('button', { name: '1× · F' }).waitFor();
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="map"][data-state="paused"]');
  const t1 = await game(page, 'g => g.time');
  await page.waitForTimeout(300);
  assert.equal(await game(page, 'g => g.time'), t1, 'nothing moves while paused');
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="map"][data-state="playing"]');

  // Night falls and the raid comes.
  await game(page, 'g => { while (!g.night) g.update(1 / 60); for (let i = 0; i < 60 * 9; i++) g.update(1 / 60); }');
  await page.waitForTimeout(300);
  assert.ok(await game(page, 'g => g.raid && g.raid.done'));
  await page.screenshot({ path: '.checks/frontier/night.png' });

  // Save and leave, then continue: the run comes back paused, as it was.
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Save and leave' }).click();
  await page.getByTestId('continue').waitFor();
  const before = await game(page, 'g => JSON.stringify([g.day, g.hqLevel, g.buildings.length, g.denCleared, g.hero("enzo").level])');
  await page.reload();
  await page.getByTestId('continue').click();
  await page.waitForSelector('[data-testid="map"][data-state="paused"]');
  assert.equal(await game(page, 'g => JSON.stringify([g.day, g.hqLevel, g.buildings.length, g.denCleared, g.hero("enzo").level])'), before);
  await page.keyboard.press('p');

  // Light the beacon: the run is won, stars are kept, and the next mountain opens.
  await game(page, `g => { const s = g.summit, t = g.tile(s.x, s.y); t.seen = true; t.f = 'beacon'; delete t.den; g.stock = { hay: 999, wood: 999, stone: 999 }; while (g.hqLevel < 4) g.upgrade(); }`);
  const summit = await game(page, 'g => [g.summit.x, g.summit.y]');
  await settle(page);
  await page.keyboard.press('7');
  await page.mouse.click(...(await tileAt(page, ...summit)));
  await page.waitForSelector('[data-testid="map"][data-state="won"]');
  assert.match(await page.getByTestId('overlay').textContent(), /The beacon is lit!/);
  assert.equal(await page.evaluate(() => localStorage.getItem('frostpaw-frontier-run-v1')), null, 'a finished run is not offered again');
  const stars = JSON.parse(await page.evaluate(() => localStorage.getItem('frostpaw-frontier-v1'))).stars;
  assert.ok(stars[0] >= 1);
  await page.screenshot({ path: '.checks/frontier/won.png' });
  await page.getByTestId('next-map').click();
  await page.waitForSelector('[data-testid="map"][data-state="playing"]');
  assert.equal(await game(page, 'g => g.map'), 1);

  // Losing: the raiders break the burrow.
  await game(page, 'g => { g.def = { ...g.def, raidBase: 999 }; while (g.state === "playing") g.update(1 / 30); }');
  await page.waitForSelector('[data-testid="map"][data-state="lost"]');
  assert.match(await page.getByTestId('overlay').textContent(), /raiders broke the burrow/);
  await page.close();

  // A phone: the first tap previews, the second explores.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/frontier`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="map-1"]').disabled);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling on the home screen');
  await phone.getByTestId('map-1').tap();
  await phone.waitForSelector('[data-testid="map"][data-state="playing"]');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling in play');
  const [px, py] = await game(phone, 'g => { const x = 6, y = 6 - 2, t = g.tile(x, y); t.t = "meadow"; t.f = null; return [x, y]; }');
  await phone.touchscreen.tap(...(await tileAt(phone, px, py)));
  await phone.waitForFunction(() => /Tap again/.test(document.querySelector('.ff-note')?.textContent ?? ''));
  assert.equal(await game(phone, `g => g.tile(${px}, ${py}).seen`), false, 'the first tap only previews');
  await phone.touchscreen.tap(...(await tileAt(phone, px, py)));
  await phone.waitForFunction(([x, y]) => window.__frontier().tile(x, y).seen, [px, py]);
  await phone.screenshot({ path: '.checks/frontier/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Passed: menu card, locked mountains, exploring by click, building from the panel and the keyboard, raising the burrow, workers, training, a den, a rumour, speed, pause, a night raid, save and continue, winning, losing and phone taps.');
} finally {
  await browser.close();
}
