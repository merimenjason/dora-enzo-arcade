import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const board = (p) => p.getByTestId('board');
const attr = async (p, name) => board(p).getAttribute(`data-${name}`);
try {
  await mkdir('.checks/fluff-forge', { recursive: true });

  // The arcade lists the new cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 18);
  assert.match(await menu.locator('a.arcade-card[href="/fluff-forge"]').textContent(), /Fluff Forge/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/fluff-forge`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="play-first-hop"]').disabled);
  assert.equal(await page.locator('.ff-card:has(button:text("PLAY"))').count(), 4, 'four starter courses');

  // Play a starter: the hero moves and tags.
  await page.getByTestId('play-first-hop').click();
  await page.waitForSelector('[data-testid="board"][data-state="play"]');
  await page.waitForTimeout(300);
  const colours = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="board"]'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
  assert.ok(colours > 20, `canvas shows ${colours} colours`);
  const x0 = Number(await attr(page, 'x'));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowRight');
  assert.ok(Number(await attr(page, 'x')) > x0 + 20, 'ArrowRight moves the hero');
  assert.equal(await attr(page, 'hero'), 'dora');
  await page.keyboard.press('KeyC');
  await page.waitForSelector('[data-testid="board"][data-hero="enzo"]', { timeout: 2000 });
  await page.screenshot({ path: '.checks/fluff-forge/play.png' });
  await page.getByTestId('exit').click();

  // Build a short course and clear it to unlock its share code.
  await page.getByTestId('new-course').click();
  await page.getByTestId('editor').waitFor();
  await page.getByTestId('title').fill('Tiny Test');
  await page.getByTestId('width').fill('25');
  await page.getByTestId('width').blur();
  await page.getByTestId('tool-raisin').click();
  const box = await page.getByTestId('editor').boundingBox();
  const cell = (c, r) => ({ x: box.x + ((c * 16 + 8) / 400) * box.width, y: box.y + ((r * 16 + 8) / 240) * box.height });
  for (const c of [6, 7, 8]) { const at = cell(c, 12); await page.mouse.click(at.x, at.y); }
  await page.screenshot({ path: '.checks/fluff-forge/editor.png' });
  await page.getByTestId('test-play').click();
  await page.waitForSelector('[data-testid="board"][data-state="play"]');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('ArrowRight');
  await page.getByTestId('result').waitFor({ timeout: 10000 });
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('ShiftLeft');
  assert.match(await page.getByTestId('result').textContent(), /3\/3 raisins/);
  assert.match(await page.getByTestId('result').textContent(), /Clear check passed/);
  await page.screenshot({ path: '.checks/fluff-forge/clear.png' });
  await page.getByTestId('result').getByRole('button', { name: 'Back to editor' }).click();
  assert.match(await page.locator('.ff-status').textContent(), /You’ve cleared this version/);
  await page.getByTestId('done').click();

  const mine = page.getByTestId('my-course').first();
  assert.match(await mine.textContent(), /Tiny Test/);
  assert.match(await mine.textContent(), /Cleared: ready to share/);
  await mine.getByRole('button', { name: 'Share' }).click();
  const code = await page.getByTestId('share-code').inputValue();
  assert.match(code, /^FLUFF-/);

  // It survives a reload; editing it asks for a fresh clear.
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="new-course"]').disabled);
  assert.match(await page.getByTestId('my-course').first().textContent(), /Cleared: ready to share/);
  await page.getByTestId('my-course').first().getByRole('button', { name: 'Edit' }).click();
  await page.getByTestId('tool-brick').click();
  const box2 = await page.getByTestId('editor').boundingBox();
  await page.mouse.click(box2.x + ((10 * 16 + 8) / 400) * box2.width, box2.y + ((8 * 16 + 8) / 240) * box2.height);
  assert.match(await page.locator('.ff-status').textContent(), /Test play from the start/);
  await page.keyboard.press('Control+z');
  assert.match(await page.locator('.ff-status').textContent(), /You’ve cleared this version/, 'undo restores the cleared version');
  await page.getByTestId('done').click();

  // A friend pastes the code in and plays it.
  await page.getByTestId('code-input').fill('FLUFF-nonsense');
  await page.getByRole('button', { name: 'PLAY IT' }).click();
  assert.match(await page.locator('.ff-note').textContent(), /didn’t work/);
  await page.getByTestId('code-input').fill(code);
  await page.getByRole('button', { name: 'PLAY IT' }).click();
  await page.waitForSelector('[data-testid="board"][data-state="play"]');
  assert.match(await page.locator('.ff-brand').textContent(), /Tiny Test/);
  await page.getByTestId('exit').click();

  // Phone-sized: the touch pad shows and drives the hero.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/fluff-forge`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="play-salt-sprint"]').disabled);
  const wide = await phone.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(wide <= 390, `no sideways scroll on a phone (${wide}px)`);
  await phone.getByTestId('play-salt-sprint').click();
  await phone.waitForSelector('[data-testid="board"][data-state="play"]');
  const px = Number(await attr(phone, 'x'));
  const right = phone.getByRole('button', { name: 'Move right' });
  await right.dispatchEvent('pointerdown');
  await phone.waitForTimeout(500);
  await right.dispatchEvent('pointerup');
  assert.ok(Number(await attr(phone, 'x')) > px + 20, 'touch pad moves the hero');
  await phone.screenshot({ path: '.checks/fluff-forge/phone.png' });

  assert.deepEqual(errors, []);
  console.log('PASS Fluff Forge browser: starters play, hero tags, build → test → clear check → share code, reload, edit resets the check, undo, import, touch pad.');
} finally {
  await browser.close();
}
