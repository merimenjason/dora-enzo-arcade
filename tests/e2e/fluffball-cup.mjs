import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
// The game loop drawing the canvas means React has hydrated and the buttons work.
const ready = (p) => p.waitForFunction(() => { const c = document.querySelector('.soccer-pitch canvas'); return c && c.getContext('2d').getImageData(500, 400, 1, 1).data[3] > 0; });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/soccer`);
  await ready(page);

  // The title shows the cup draw and both ways to play.
  const bracket = page.locator('.soccer-bracket li');
  assert.deepEqual(await bracket.allTextContents(), ['Round oneViscacha United', 'Semi-finalDegu Dynamo', 'FinalEnzo’s Ember FC']);
  await page.getByRole('button', { name: 'Play the cup →' }).click();
  await page.waitForSelector('.soccer-overlay', { state: 'detached' });
  assert.match(await page.locator('.soccer-status').textContent(), /ROUND ONE\s*vs Viscacha United/);
  assert.match(await page.locator('.soccer-score').textContent(), /VITO/);

  // The pitch is drawn: grass, crowd, players and boards give it plenty of colours.
  const colours = await page.evaluate(() => {
    const c = document.querySelector('.soccer-pitch canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 53) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
  assert.ok(colours > 200, `pitch shows ${colours} colours`);

  // The Cloud Chip waits for a full Fluff meter; pausing stops the clock.
  assert.equal(await page.getByRole('button', { name: 'L · CHIP' }).isDisabled(), true);
  await page.locator('.soccer-pitch canvas').focus();
  await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d');
  await page.keyboard.press('p');
  await page.getByText('A quick breather.').waitFor();
  const clock = await page.locator('.soccer-score time').textContent();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('.soccer-score time').textContent(), clock);
  await page.getByRole('button', { name: 'Back to the match →' }).click();
  await page.waitForSelector('.soccer-overlay', { state: 'detached' });

  // A friendly is still one click from the title.
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Friendly vs Enzo' }).click();
  assert.match(await page.locator('.soccer-status').textContent(), /FRIENDLY\s*vs Enzo’s Ember FC/);

  // Phones get the whole board without sideways scrolling.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/soccer`);
  await phone.getByRole('button', { name: 'Play the cup →' }).waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll on a phone');

  assert.deepEqual(errors, []);
  console.log('PASS Fluffball Cup browser: cup draw, cup and friendly kickoff, rival scoreboard, drawn pitch, chip gating, pause, phone layout.');
} finally {
  await browser.close();
}
