import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
 for (const route of ['chin-x-pit','fighter','escape','kart','hop','soccer','survival','adventure','checkpoint','checkpoint-remake','dust-bath','mountain-retreat','paw-buster','fluff-forge','fluffstevania','express','moonlight','pinball','detectives','hunt','putt','roll','pawhaven']) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`http://localhost:3000/${route}`);
  const link = page.getByRole('link', { name: /MAIN ARCADE|← ARCADE/ });
  assert.equal(await link.count(), 1, route);
  assert.equal(await link.getAttribute('href'), '/');
  await link.click();
  await page.waitForSelector('.arcade-grid');
  assert.equal(await page.locator('.arcade-card').count(),97);
  console.log(`PASS ${route} → main arcade (97 game cards)`);
  await page.close();
 }
 {
  // The genre buttons filter the cards, the choice goes in the address, and it survives a reload.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  const puzzle = page.locator('.arcade-filter button[data-genre="puzzle"]');
  const want = Number(await puzzle.locator('span').textContent());
  assert.ok(want > 5 && want < 86);
  await puzzle.click();
  assert.equal(await page.locator('.arcade-card').count(), want);
  assert.equal(await puzzle.getAttribute('aria-pressed'), 'true');
  assert.ok(page.url().endsWith('/?genre=puzzle'));
  assert.equal(await page.locator('.arcade-card[href="/fold"] .arcade-number').textContent(), '62', 'cards keep their arcade number');
  await page.reload(); await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.querySelectorAll('.arcade-card').length < 86);
  assert.equal(await page.locator('.arcade-card').count(), want);
  await page.locator('.arcade-filter button', { hasText: 'All' }).click();
  assert.equal(await page.locator('.arcade-card').count(), 97);
  assert.ok(!page.url().includes('genre'));
  console.log(`PASS the genre filter (${want} puzzle games), kept in the address`);
  await page.close();
 }
 {
  // Picking a cabinet puts it at the top of the menu next time.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.arcade-continue').count(), 0);
  await page.locator('.arcade-card[href="/hayloft"]').click();
  await page.waitForURL('**/hayloft');
  await page.goto('http://localhost:3000/');
  const go = page.locator('.arcade-continue');
  await go.waitFor();
  assert.equal(await go.getAttribute('href'), '/hayloft');
  assert.match(await go.innerText(), /CONTINUE PLAYING[\s\S]*Hayloft Tycoon/);
  const box = await go.boundingBox();
  assert.ok(box.y < 844 && box.x >= 0 && box.x + box.width <= 390, 'shortcut sits on the phone screen');
  await page.screenshot({ path: process.env.SHOT ?? '/dev/null' }).catch(() => {});
  console.log('PASS the last game picked shows as Continue playing at the top');
  // Heading home through a game's own arcade link remembers that game too.
  await page.goto('http://localhost:3000/parade');
  await page.locator('main[data-ready="true"]').waitFor();
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL('http://localhost:3000/');
  await page.waitForFunction(() => document.querySelector('.arcade-continue')?.getAttribute('href') === '/parade');
  console.log('PASS heading home from a game makes it the Continue playing game');
  await page.close();
 }
} finally { await browser.close(); }
