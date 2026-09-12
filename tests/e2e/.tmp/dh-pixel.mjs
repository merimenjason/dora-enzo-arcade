import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/tmp/dh-title.png' });
await page.getByRole('button', { name: 'Play as Dora and Enzo' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
await page.waitForTimeout(800);
// Walk about so the companion has to follow.
for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) { await page.keyboard.down(key); await page.waitForTimeout(600); await page.keyboard.up(key); }
await page.waitForTimeout(900);
const before = await page.locator('.dh-hud').innerText();
await page.screenshot({ path: '/tmp/dh-pixel.png' });
await page.keyboard.press('KeyX');
await page.waitForTimeout(700);
const after = await page.locator('.dh-hud').innerText();
const toast = await page.locator('.dh-toast').innerText().catch(() => '');
const foot = await page.locator('.dh-foot').innerText();
const neighbours = await page.locator('.dh-friends').innerText();
await page.screenshot({ path: '/tmp/dh-swap.png' });
console.log(JSON.stringify({ errors, before: before.split('\n'), after: after.split('\n'), toast, foot, companionLine: neighbours.split('\n').find((l) => /Enzo|Dora/.test(l)) }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
