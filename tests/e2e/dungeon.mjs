// Dust Bunny Dungeon in the browser: the arcade card, the menu and its saved choices, stepping and bopping by keys,
// tools and aiming, pausing, saving and resuming a run, the daily dust-up, the results and the phone layout.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const state = (page) => page.evaluate(() => { const g = window.__dungeon(); return g && { px: g.px, py: g.py, turn: g.turn, floor: g.floor, hp: g.hp, state: g.state, log: [...g.log], seed: g.seed, mode: g.mode, char: g.char }; });
/** A direction (0 up, 1 right, 2 down, 3 left) the player can safely step: open floor, nobody there, nothing marked. */
const safeDir = (page) => page.evaluate(() => {
  const g = window.__dungeon(), danger = g.danger(), DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  for (let d = 0; d < 4; d++) {
    const x = g.px + DX[d], y = g.py + DY[d], i = y * 31 + x, t = g.tile(x, y);
    if ([1, 4, 5, 7].includes(t) && !g.crates[i] && !g.enemyAt(i) && !danger.has(i) && !g.items.has(i)) return d;
  }
  return -1;
});
const KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

{
  const page = await open();
  await page.goto(base);
  await page.getByRole('link', { name: /Dust Bunny Dungeon/ }).click(); await page.waitForURL('**/dungeon'); await ready(page);
  console.log('PASS the arcade lists Dust Bunny Dungeon and its card opens the game');

  await page.evaluate(() => localStorage.removeItem('dust-bunny-dungeon-v1')); await page.reload(); await ready(page);
  await page.getByRole('radio', { name: /Enzo/ }).click();
  await page.locator('.dungeon-box summary', { hasText: 'Settings' }).click();
  await page.getByLabel(/Show the tile grid/).uncheck();
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('radio', { name: /Enzo/ }).getAttribute('aria-checked'), 'true', 'the chosen chinchilla is remembered');
  await page.locator('.dungeon-box summary', { hasText: 'Settings' }).click();
  assert.equal(await page.getByLabel(/Show the tile grid/).isChecked(), false, 'settings are remembered');
  await page.getByLabel(/Show the tile grid/).check();
  console.log('PASS the menu remembers the chinchilla and the settings');

  await page.getByRole('button', { name: /Start tidying/ }).click();
  await page.waitForFunction(() => window.__dungeon()?.state === 'play');
  let s = await state(page);
  assert.equal(s.char, 'enzo'); assert.equal(s.floor, 1); assert.equal(s.hp, 4, 'Enzo starts with four hearts');
  const d = await safeDir(page);
  assert.ok(d >= 0, 'the start room has a safe step');
  await page.keyboard.press(KEYS[d]);
  let t = await state(page);
  assert.equal(t.turn, s.turn + 1, 'a step is one turn');
  assert.equal(Math.abs(t.px - s.px) + Math.abs(t.py - s.py), 1, 'the arrow key moved the player one tile');
  await page.keyboard.press(' ');
  s = await state(page);
  assert.equal(s.turn, t.turn + 1, 'Space waits a turn'); assert.deepEqual(s.log.slice(-2), ['URDL'[d], 'W']);
  console.log('PASS arrow keys step and Space waits, one turn each');

  // aiming a tool: the sling (key 2) asks for a direction, and Esc puts it away without using a turn
  await page.keyboard.press('2');
  await page.locator('.dungeon-aim').waitFor();
  assert.match(await page.locator('.dungeon-aim').textContent(), /Pebble Sling/);
  await page.keyboard.press('Escape');
  await page.locator('.dungeon-aim').waitFor({ state: 'detached' });
  assert.equal((await state(page)).turn, s.turn, 'cancelling an aim uses no turn');
  // and fired: the pebble is spent and the turn passes
  const slings = await page.evaluate(() => window.__dungeon().tools.sling);
  await page.keyboard.press('2'); await page.keyboard.press(KEYS[(d + 2) % 4]);
  assert.equal(await page.evaluate(() => window.__dungeon().tools.sling), slings - 1, 'firing the sling spends a pebble');
  assert.equal((await state(page)).turn, s.turn + 1);
  console.log('PASS tools aim with a direction, Esc cancels, and firing spends a charge');

  await page.keyboard.press('p');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const before = (await state(page)).turn;
  await page.keyboard.press(KEYS[d]); await page.keyboard.press(' ');
  assert.equal((await state(page)).turn, before, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep tidying' }).click();
  await page.getByRole('dialog', { name: 'Paused' }).waitFor({ state: 'detached' });
  console.log('PASS pausing stops the turns and resuming carries on');

  // the run is saved as you go and can be picked up after a reload
  const mid = await state(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dust-bunny-dungeon-v1')));
  assert.deepEqual(saved.run.log, mid.log, 'every action is saved'); assert.equal(saved.run.seed, mid.seed);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Continue Enzo’s run · floor 1/ }).click();
  await page.waitForFunction(() => window.__dungeon()?.state === 'play');
  const back = await state(page);
  assert.deepEqual({ px: back.px, py: back.py, turn: back.turn, hp: back.hp, log: back.log }, { px: mid.px, py: mid.py, turn: mid.turn, hp: mid.hp, log: mid.log }, 'the resumed run is exactly where it was');
  console.log('PASS the run is saved every turn and resumes exactly after a reload');

  // ending the run shows the results and records it
  await page.keyboard.press('p'); await page.getByRole('button', { name: 'End this run' }).click();
  await page.getByRole('dialog', { name: 'Results' }).waitFor();
  assert.match(await page.locator('.dungeon-end h2').textContent(), /cosy nap on floor 1/);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('dust-bunny-dungeon-v1')));
  assert.equal(after.runs, 1); assert.equal(after.run, null, 'a finished run is no longer offered to continue');
  assert.equal(after.best, 1);
  await page.getByRole('button', { name: 'Main menu' }).click();
  assert.equal(await page.getByRole('button', { name: /Continue/ }).count(), 0);
  console.log('PASS ending a run shows the results and records it');

  // the daily dust-up: the same cellars every time today
  await page.getByRole('button', { name: /Daily dust-up/ }).click();
  await page.waitForFunction(() => window.__dungeon()?.mode === 'daily');
  const day1 = await state(page);
  await page.evaluate(() => window.__dungeonStart('dora', 'daily'));
  const day2 = await state(page);
  assert.equal(day1.seed, day2.seed, 'the daily seed is the same all day');
  assert.deepEqual([day1.px, day1.py], [day2.px, day2.py]);
  console.log('PASS the daily dust-up gives everyone the same cellars today');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.goto(base + '/dungeon'); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone menu');
  await page.evaluate(() => window.__dungeonStart('dora', 'run', 12345));
  await page.waitForFunction(() => window.__dungeon()?.state === 'play');
  assert.ok(await page.locator('.dungeon-pad').isVisible(), 'the on-screen pad shows on a phone');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll while playing');
  const s = await state(page), d = await safeDir(page);
  await page.locator('.dungeon-pad .' + ['up', 'right', 'down', 'left'][d]).click();
  const t = await state(page);
  assert.equal(t.turn, s.turn + 1, 'the pad steps');
  await page.locator('.dungeon-pad .wait').click();
  assert.equal((await state(page)).turn, t.turn + 1, 'the pad waits');
  for (const b of await page.locator('.dungeon-tool').all()) {
    const box = await b.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 390, 'every tool button fits on screen');
  }
  console.log('PASS the phone layout fits and the on-screen pad plays');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
