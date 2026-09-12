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
await page.waitForTimeout(900);
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(900);
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(400);
const peek = await page.locator('.dh-peek').innerText();
await page.keyboard.press('Space');
await page.waitForTimeout(600);
const panel = await page.locator('.dh-panel h2').innerText().catch(() => 'NO PANEL');
const buttons = await page.locator('.dh-panel button').allInnerTexts().catch(() => []);
console.log(JSON.stringify({ errors, peek: peek.split('\n')[0], panel, buttons }, null, 1));
if (/Sleep until morning/.test(buttons.join('|'))) {
  for (let i = 0; i < 4; i++) { await page.getByRole('button', { name: 'Sleep until morning' }).click(); await page.waitForTimeout(300); }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/dh-card.png' });
  console.log('HUD ' + (await page.locator('.dh-hud').innerText()).replace(/\n/g, ' | '));
}
await browser.close();
process.exit(errors.length ? 1 : 0);
