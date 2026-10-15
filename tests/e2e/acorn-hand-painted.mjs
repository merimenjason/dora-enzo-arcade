import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/art/acorn-hand/title.png*', (route) => route.abort());
  await page.goto(`${base}/acorn-hand`);
  await page.getByRole('button', { name: 'Retry artwork' }).waitFor();
  const fallback = await page.locator('.ah-title-art').evaluate((c) => c.toDataURL());
  // A missing painting must never gate the new-run control.
  assert.equal(await page.getByTestId('new-run').isEnabled(), true);
  await page.unroute('**/art/acorn-hand/title.png*');
  await page.getByRole('button', { name: 'Retry artwork' }).click();
  await page.waitForFunction(() => window.__acorn().art.loaded.includes('title'));
  await page.waitForFunction((before) => document.querySelector('.ah-title-art').toDataURL() !== before, fallback);
  await page.locator('main[data-painted-table="true"]').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Retry artwork' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.getByTestId('new-run').click();
  await page.getByTestId('start').click();
  await page.waitForFunction(() => window.__acorn().art.loaded.includes('suits'));
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 8);
  await page.getByTestId('card-0').click();
  assert.equal(await page.getByTestId('play').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS Acorn Hand painted art: missing-image fallback, retry, asynchronous canvas redraw, painted table, phone fit and playable painted cards.');
} finally { await browser.close(); }
