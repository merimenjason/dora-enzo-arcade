import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 980 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
await page.goto('http://localhost:4173/dusty-hollow', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Play as Dora and Enzo' }).click();
await page.waitForSelector('canvas');
await page.waitForTimeout(900);
await page.locator('canvas').screenshot({ path: '/tmp/dh-2d-label.png' });
const box = page.getByText('Voxel 3D view');
await box.click();               // to 3D
await page.waitForTimeout(1800);
const is3d = await page.locator('.dh-stage3d').count();
await page.locator('canvas').focus();
await page.keyboard.press('KeyX');
await page.waitForTimeout(600);
const swapped = await page.locator('.dh-hud').innerText();
await box.click();               // back to 2D
await page.waitForTimeout(1500);
const back2d = await page.locator('.dh-stage3d').count();
await page.locator('canvas').focus();
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(600);
await page.locator('canvas').screenshot({ path: '/tmp/dh-back2d.png' });
// The setting must survive a reload.
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForTimeout(1200);
const afterReload = await page.locator('.dh-stage3d').count();
console.log(JSON.stringify({ errors, is3d, swappedTo: swapped.split('\n')[3], back2d, afterReload }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);
