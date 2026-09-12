import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Play as Dora and Enzo' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/dh-title2.png' });
// Walk to the river and fish, so the reel bar and a hooked fish get drawn over the pixels.
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(3400);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(1400);
await page.keyboard.up('ArrowUp');
const peek = await page.locator('.dh-peek').innerText();
await page.keyboard.press('Digit3');
await page.keyboard.press('Space');
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(250);
  const t = await page.locator('.dh-peek').innerText();
  if (/Now! Press to hook/.test(t)) { await page.keyboard.press('Space'); break; }
}
await page.keyboard.down('Space');
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/dh-reel.png' });
await page.keyboard.up('Space');
console.log(JSON.stringify({ errors, peek, after: await page.locator('.dh-peek').innerText() }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
