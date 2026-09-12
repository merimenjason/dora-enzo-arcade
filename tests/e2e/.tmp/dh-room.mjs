import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Play as Dora and Enzo' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
await page.waitForTimeout(900);
// Give ourselves a Grand Burrow and one of everything, to see a full room.
await page.evaluate(() => {
  const k = 'dusty-hollow-save-v1';
  const s = JSON.parse(localStorage.getItem(k));
  s.homeLevel = 3; s.debt = 0; s.raisins = 99999;
  s.furniture = [
    { id: 'bed', x: 0, y: 0 }, { id: 'shelf', x: 1, y: 0 }, { id: 'stove', x: 2, y: 0 }, { id: 'chart', x: 3, y: 0 }, { id: 'poncho', x: 4, y: 0 },
    { id: 'table', x: 0, y: 1 }, { id: 'lamp', x: 1, y: 1 }, { id: 'rug', x: 2, y: 1 }, { id: 'cactus', x: 3, y: 1 }, { id: 'quena', x: 4, y: 1 },
    { id: 'tub', x: 0, y: 2 }, { id: 'hammock', x: 1, y: 2 }, { id: 'trophy', x: 2, y: 2 }, { id: 'plaque-fish', x: 3, y: 2 }, { id: 'photo-pia', x: 4, y: 2 },
  ];
  localStorage.setItem(k, JSON.stringify(s));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForSelector('canvas');
await page.locator('canvas').focus();
await page.waitForTimeout(800);
// Step into the burrow.
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(800);
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(300);
await page.keyboard.press('Space');
await page.waitForTimeout(900);
const title = await page.locator('.dh-panel h2').innerText().catch(() => 'NO PANEL');
const caption = await page.locator('.dh-caption').innerText().catch(() => '');
await page.locator('.dh-room').screenshot({ path: '/tmp/room-full.png' });
await page.screenshot({ path: '/tmp/room-page.png' });
console.log(JSON.stringify({ errors, title: title.split('\n')[0], caption }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
