// Little Red Dot: The Straits in the browser, with real clicks and keys at 1280×720 and 390×844: the arcade card, the
// title and hero pick, setting sail and steering, the conversation at the kelong, a jetty's menu, the map, pause, a
// volley, and landing the hay. Positions are set through window.__straits() so the run is short. Fails on any failed
// check, page error or sideways scroll. Needs `npm run dev` (or BASE_URL) and Playwright.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const G = (page, fn, arg) => page.evaluate(([f, a]) => new Function('g', 'a', f)(window.__straits(), a), [fn, arg]);
try {
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(`${w}×${h}: ${e.message}`));
    await page.goto(base); assert.equal(await page.locator('.arcade-card').count(), 103);
    await page.getByRole('link', { name: /Little Red Dot: The Straits/ }).click();
    await page.waitForSelector('main[data-ready="true"]'); await page.getByRole('heading', { name: 'Little Red Dot: The Straits' }).waitFor();
    await page.getByRole('button', { name: /ENZO/ }).click(); await page.click('#st-play'); await page.waitForFunction(() => window.__straits?.()?.phase === 'sail');
    assert.equal(await G(page, 'return g.hero'), 'enzo');
    await page.keyboard.press('KeyW'); await page.keyboard.press('KeyW'); await page.keyboard.down('KeyD');
    await page.waitForFunction(() => window.__straits().t > 2); await page.keyboard.up('KeyD');
    const s = await G(page, 'return { v: g.v, gear: g.gear, h: g.h, z: g.z }'); assert.equal(s.gear, 2); assert.ok(s.v > 1 && s.h < 0 && s.z > -71, 'under way and turning to starboard');
    // a volley
    await page.keyboard.press('Space'); await page.waitForFunction(() => window.__straits().reload > 0);
    // the map and pause
    await page.keyboard.press('KeyM'); await page.locator('.st-map').waitFor(); await page.keyboard.press('Escape'); await page.locator('.st-map').waitFor({ state: 'detached' });
    await page.keyboard.press('KeyP'); await page.getByRole('button', { name: 'Carry on' }).click();
    // the conversation
    await G(page, 'g.foes.length = 0; g.x = 20; g.z = -13; g.v = 0; g.gear = 0;'); await page.locator('#st-say-bargain').click();
    await page.waitForFunction(() => window.__straits().phase === 'sail'); assert.equal(await G(page, 'return g.hay'), 75); assert.equal(await G(page, 'return g.stance'), 'calm');
    // a jetty
    await G(page, 'g.x = -14; g.z = -52; g.hull = 50; g.seeds = 20;'); await page.keyboard.press('KeyE');
    await page.getByRole('heading', { name: 'Sentosa' }).waitFor(); await page.getByRole('button', { name: /Patch the hull/ }).click();
    assert.equal(await G(page, 'return g.hull'), 130); await page.getByRole('button', { name: 'Cast off' }).click(); await page.waitForFunction(() => window.__straits().phase === 'sail');
    // land the hay
    await G(page, 'g.x = 55.5; g.z = 47.5;'); await page.keyboard.press('KeyE'); await page.getByRole('heading', { name: 'Hay landed on Pulau Ubin' }).waitFor();
    assert.match(await page.locator('.st-card').textContent(), /SILVER · 75% of the bale/);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('straits-v1'))).best, 'silver');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await page.getByRole('button', { name: 'Sail again' }).click(); await page.getByText(/Best voyage: silver/).waitFor();
    console.log(`PASS straits ${w}×${h}`); await page.close();
  }
} finally { await browser.close(); }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS straits e2e');
