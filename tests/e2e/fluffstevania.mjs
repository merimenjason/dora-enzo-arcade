import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const board = (p) => p.getByTestId('board');
const data = (p, k) => board(p).getAttribute(`data-${k}`);
// The title sets data-ready once React has hydrated and the buttons work.
const ready = (p) => p.locator('.fv-title[data-ready=true]').waitFor();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/fluffstevania`);
  await page.evaluate(() => localStorage.removeItem('fluffstevania-v1'));
  await page.reload();
  await ready(page);

  // Pick Hard, then a new game opens with the story; jump advances it.
  await page.getByTestId('diff-hard').click();
  assert.equal(await page.getByTestId('diff-hard').getAttribute('aria-pressed'), 'true');
  await page.getByTestId('new-game').click();
  await page.getByTestId('dialog').waitFor();
  assert.match(await page.getByTestId('dialog').textContent(), /Golden Wolfberry/);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('z'); await page.waitForTimeout(80); }
  await page.getByTestId('dialog').waitFor({ state: 'detached' });
  assert.equal(await data(page, 'room'), 'path');

  // Walk, swing, tag.
  const x = Number(await data(page, 'x'));
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  assert.ok(Number(await data(page, 'x')) > x + 50, 'Dora walks right');
  await page.keyboard.press('x');
  await page.keyboard.press('c');
  await page.waitForTimeout(100);
  assert.equal(await data(page, 'leader'), 'enzo');

  // The castle is drawn with plenty of colour.
  const colours = await page.evaluate(() => {
    const c = document.querySelector('[data-testid=board]'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 61) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
  assert.ok(colours > 300, `the view shows ${colours} colours`);

  // The menu pauses and has every tab.
  await page.keyboard.press('Escape');
  await page.getByTestId('menu').waitFor();
  const frozen = await data(page, 'x');
  for (const tab of ['Equip', 'Magic', 'Items', 'Familiars', 'Bestiary', 'Map', 'Status']) await page.getByRole('tab', { name: tab }).click();
  await page.getByRole('tab', { name: 'Map' }).click();
  assert.equal(await page.getByTestId('map-legend').locator('li').count(), 11, 'the map legend lists every icon');
  assert.match(await page.getByTestId('map-legend').textContent(), /Pip’s stall|Pip's stall/);
  await page.getByRole('tab', { name: 'Status' }).click();
  assert.match(await page.getByTestId('menu').textContent(), /Hard/, 'the difficulty shows on Status');
  assert.match(await page.getByTestId('menu').textContent(), /Level 1/);
  await page.waitForTimeout(300);
  assert.equal(await data(page, 'x'), frozen, 'paused behind the menu');
  await page.getByRole('button', { name: 'Resume' }).first().click();
  await page.getByTestId('menu').waitFor({ state: 'detached' });

  // Continue from an older shrine save (from when Dora had whips), then equip found gear and ready a sub-weapon.
  const save = { v: 1, room: 'save-hall', x: 6 * 384 + 136, y: 2 * 224 + 192, level: 3, xp: 0, hp: { dora: 60, enzo: 80 }, leader: 'dora',
    equip: { dora: { weapon: 'ribbon', armor: null, acc: null }, enzo: { weapon: 'claws', armor: 'scarf', acc: null } }, bag: { bramble: 1 },
    relics: ['dash'], flags: ['script:intro'], visited: ['6,2'], raisins: 5, seeds: 10, time: 60, leaves: 0 };
  await page.goto(`${base}/fluffstevania`);
  await page.evaluate((s) => localStorage.setItem('fluffstevania-v1', JSON.stringify(s)), save);
  await page.reload();
  await ready(page);
  await page.getByTestId('continue').click();
  await board(page).waitFor();
  assert.equal(await data(page, 'room'), 'save-hall');
  assert.equal(await data(page, 'level'), '3');
  await page.getByTestId('menu-button').click();
  await page.getByRole('tab', { name: 'Equip' }).click();
  await page.getByTestId('equip-moonfan').click();
  assert.match(await page.getByTestId('menu').textContent(), /Moonlit Fan/);
  await page.getByRole('tab', { name: 'Magic' }).click();
  assert.match(await page.getByTestId('menu').textContent(), /Sunflower Seed/);
  await page.getByRole('tab', { name: 'Bestiary' }).click();
  assert.match(await page.getByTestId('beast-bat').textContent(), /\?\?\?/, 'nothing defeated in that old save');
  await page.getByTestId('menu-button').click();
  await page.getByTestId('menu').waitFor({ state: 'detached' });

  // Pip's stall in the catacombs sells for raisins.
  const crypt = { ...save, room: 'save-crypt', x: 14 * 384 + 18 * 16 + 8, y: 2 * 224 + 192, raisins: 30, flags: ['script:intro', 'boss:owl', 'script:pip'] };
  await page.goto(`${base}/fluffstevania`);
  await page.evaluate((s) => localStorage.setItem('fluffstevania-v1', JSON.stringify(s)), crypt);
  await page.reload();
  await ready(page);
  await page.getByTestId('continue').click();
  await board(page).waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp');
  await page.getByTestId('shop').waitFor();
  assert.ok(await page.getByTestId('buy-ring').isDisabled(), 'the ring costs too much');
  await page.getByTestId('buy-cake').click();
  assert.match(await page.getByTestId('shop').textContent(), /6 raisins/);
  await page.keyboard.press('Escape');
  await page.getByTestId('shop').waitFor({ state: 'detached' });

  // Two shrines found: the catacomb shrine offers a warp back to the hall.
  const warp = { ...crypt, x: 14 * 384 + 5 * 16 + 8, flags: [...crypt.flags, 'shrine:save-hall', 'shrine:save-crypt'] };
  await page.goto(`${base}/fluffstevania`);
  await page.evaluate((s) => localStorage.setItem('fluffstevania-v1', JSON.stringify(s)), warp);
  await page.reload();
  await ready(page);
  await page.getByTestId('continue').click();
  await board(page).waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp');
  await page.getByTestId('warp').waitFor();
  await page.getByTestId('warp-save-hall').click();
  await page.getByTestId('warp').waitFor({ state: 'detached' });
  assert.equal(await data(page, 'room'), 'save-hall');
  await page.getByTestId('music').click();
  assert.equal(await page.getByTestId('music').getAttribute('aria-pressed'), 'false');

  // A save in Count Culpeo's Library loads there, and the map opens scrolled across to it.
  const library = { ...crypt, room: 'save-library', x: 21 * 384 + 11 * 16 + 8, y: 12 * 16, level: 11, relics: ['dash', 'hop'], flags: [...crypt.flags, 'boss:rat', 'script:library'] };
  await page.goto(`${base}/fluffstevania`);
  await page.evaluate((s) => localStorage.setItem('fluffstevania-v1', JSON.stringify(s)), library);
  await page.reload();
  await ready(page);
  await page.getByTestId('continue').click();
  await board(page).waitFor();
  assert.equal(await data(page, 'room'), 'save-library');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.setViewportSize({ width: 700, height: 900 });
  await page.getByRole('tab', { name: 'Status' }).click(); await page.getByRole('tab', { name: 'Map' }).click();
  assert.ok(await page.getByTestId('map-scroll').evaluate((el) => el.scrollLeft > 0), 'the map scrolls to the library');
  await page.setViewportSize({ width: 1280, height: 900 });

  // Phones get the pad and no sideways scroll.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/fluffstevania`);
  await ready(phone);
  await phone.getByTestId('new-game').click();
  await phone.getByRole('button', { name: 'Jump', exact: true }).waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on a phone');

  assert.deepEqual(errors, []);
  console.log('PASS Fluffstevania browser: difficulty, story, walking, attack, tag, drawn castle, pausing menu with every tab and the map legend, continue from an older save, equipping a fan, the Magic tab and Bestiary, Pip’s shop, warping between shrines, the music toggle, a library save and the scrolling map, phone layout.');
} finally {
  await browser.close();
}
