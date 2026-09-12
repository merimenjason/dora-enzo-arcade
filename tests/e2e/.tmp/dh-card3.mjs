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
const enterHome = async () => {
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
};
let title = '';
for (let i = 0; i < 4; i++) {
  await enterHome();
  title = await page.locator('.dh-panel h2').innerText().catch(() => 'NO PANEL');
  await page.getByRole('button', { name: 'Sleep until morning' }).click();
  await page.waitForTimeout(400);
  // The bedtime summary sits over the world until dismissed.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}
await page.screenshot({ path: '/tmp/dh-card.png' });
const hud = await page.locator('.dh-hud').innerText();
console.log(JSON.stringify({ errors, homeTitle: title.split('\n')[0], hud: hud.split('\n') }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
