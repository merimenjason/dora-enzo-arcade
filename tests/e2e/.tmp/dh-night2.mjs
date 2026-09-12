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
// Six-minute days: idle a while to reach dusk, when the tint and lit windows come in.
await page.waitForTimeout(3000);
for (let i = 0; i < 32; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(120); }
await page.waitForTimeout(2000);
const hud = await page.locator('.dh-hud').innerText();
await page.screenshot({ path: '/tmp/story-page.png' });
console.log(JSON.stringify({ errors, hud: hud.split('\n') }));
await browser.close();
process.exit(errors.length ? 1 : 0);
