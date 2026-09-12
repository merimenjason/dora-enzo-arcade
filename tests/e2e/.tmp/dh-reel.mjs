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
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(4200);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(400);
let peek = await page.locator('.dh-peek').innerText();
await page.keyboard.press('Digit3');
let hooked = false;
for (let cast = 0; cast < 4 && !hooked; cast++) {
  await page.keyboard.press('Space');
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(160);
    const t = await page.locator('.dh-peek').innerText();
    if (/Now! Press to hook/.test(t)) { await page.keyboard.press('Space'); hooked = true; break; }
    if (!/Fishing/.test(t)) break;
  }
}
await page.keyboard.down('Space');
await page.waitForTimeout(500);
const reeling = await page.locator('.dh-peek').innerText();
await page.screenshot({ path: '/tmp/dh-reel.png' });
await page.keyboard.up('Space');
console.log(JSON.stringify({ errors, peek: peek.split('\n')[0], hooked, reeling: reeling.split('\n')[0] }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
