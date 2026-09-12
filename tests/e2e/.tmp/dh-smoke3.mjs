import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Play as Dora' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
// Drive the engine straight into the new content: tourney day, Best friend Pia, a stocked pocket.
await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
for (const key of ['ArrowRight', 'ArrowDown']) { await page.keyboard.down(key); await page.waitForTimeout(500); await page.keyboard.up(key); }
await page.keyboard.press('KeyP');
await page.waitForTimeout(400);
const passport = await page.locator('.dh-passport h2').innerText();
const fishCount = await page.locator('.dh-passport section').first().innerText();
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const neighbours = await page.locator('.dh-friends').innerText();
await page.screenshot({ path: '/tmp/dh-smoke3.png' });
console.log(JSON.stringify({ errors, passport, fishHeader: fishCount.split('\n')[0], jackpotListed: /Golden Dorado|\?\?\?/.test(fishCount), neighbourLines: neighbours.split('\n').length }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
