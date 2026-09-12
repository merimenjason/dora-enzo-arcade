import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Play as Dora' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
// Walk about, run, sneak and press the action button for a while.
for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.down(key); await page.waitForTimeout(700); await page.keyboard.up(key); }
await page.keyboard.down('KeyC'); await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight'); await page.keyboard.up('KeyC');
await page.keyboard.press('Space');
await page.waitForTimeout(6000);
const peek = await page.locator('.dh-peek').innerText();
const hud = await page.locator('.dh-hud').innerText();
const neighbours = await page.locator('.dh-friends').innerText();
await page.keyboard.press('KeyF');
await page.waitForTimeout(300);
const photobar = await page.locator('.dh-photobar').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const photobarAfter = await page.locator('.dh-photobar').count();
await page.screenshot({ path: '/tmp/dh-smoke.png' });
console.log(JSON.stringify({ errors, peek, hud, neighbours: neighbours.split('\n').slice(0, 4), photobar, photobarAfter }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
