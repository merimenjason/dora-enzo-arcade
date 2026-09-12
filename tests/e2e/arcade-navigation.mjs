import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 for (const route of ['chin-x-pit','fighter','escape','kart','hop','soccer','survival','adventure','checkpoint','checkpoint-remake','dust-bath','mountain-retreat','paw-buster']) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`http://localhost:3000/${route}`);
  const link = page.getByRole('link', { name: /MAIN ARCADE/ });
  assert.equal(await link.count(), 1, route);
  assert.equal(await link.getAttribute('href'), '/');
  await link.click();
  await page.waitForSelector('.arcade-grid');
  assert.equal(await page.locator('.arcade-card').count(), 14);
  console.log(`PASS ${route} → main arcade (14 game cards)`);
  await page.close();
 }
} finally { await browser.close(); }
