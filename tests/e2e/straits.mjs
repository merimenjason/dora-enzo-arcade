// Little Red Dot: The Straits in the browser, with real clicks and keys at 1280×720 and 390×844: the arcade card, the
// title and hero pick, setting sail and steering, the conversation at the kelong, a jetty's menu, the map, pause, a
// volley, the sound toggles, and landing the hay. Positions are set through window.__straits() so the run is short. Fails on any failed
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
    await page.goto(base); assert.equal(await page.locator('.arcade-card').count(), 105);
    await page.getByRole('link', { name: /Little Red Dot: The Straits/ }).click();
    await page.waitForSelector('main[data-ready="true"]'); await page.getByRole('heading', { name: 'Little Red Dot: The Straits' }).waitFor();
    await page.getByRole('button', { name: /ENZO/ }).click(); await page.click('#st-play'); await page.waitForFunction(() => window.__straits?.()?.phase === 'sail');
    assert.equal(await G(page, 'return g.hero'), 'enzo');
    await page.keyboard.press('KeyW'); await page.keyboard.press('KeyW'); await page.keyboard.down('KeyD');
    await page.waitForFunction(() => window.__straits().t > 2); await page.keyboard.up('KeyD');
    const s = await G(page, 'return { v: g.v, gear: g.gear, h: g.h, z: g.z }'); assert.equal(s.gear, 2); assert.ok(s.v > 1 && s.h < 0 && s.z > -71, 'under way and turning to starboard');
    // a volley
    await page.keyboard.press('KeyQ'); await page.waitForFunction(() => window.__straits().reloadP > 0); assert.equal(await G(page, 'return g.reloadS'), 0);
    await page.keyboard.press('KeyE'); await page.waitForFunction(() => window.__straits().reloadS > 0);
    assert.match(await page.locator('#st-wind').textContent(), /WIND · (RUNNING|REACHING|BEATING|IN IRONS)/);
    // sound: running after the first click, both tunes and every effect play without an error, and the toggles stick
    assert.equal(await page.evaluate(() => window.__straitsSound().ac?.state), 'running');
    await page.evaluate(() => { const s = window.__straitsSound(); for (const k of ['volley', 'clam', 'bump', 'loot', 'capsize', 'dock', 'talk', 'found', 'say', 'won', 'lost']) s.fx({ k, x: 0, z: 0, id: 'kusu', seeds: 3, text: '' }); s.fx({ k: 'hit', x: 0, z: 0, mine: true }); s.fx({ k: 'hit', x: 0, z: 0, mine: false }); s.fx({ k: 'sink', x: 0, z: 0, kind: 'bishan' }); s.gear(true); s.ram(); s.ui(false); s.update(1, true, false); });
    await page.waitForTimeout(400); await page.evaluate(() => window.__straitsSound().update(0.2, false, false));
    await page.click('#st-mute'); assert.equal(await page.getAttribute('#st-mute', 'aria-pressed'), 'false'); assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('straits-sound-v1'))), { sfx: false, music: false });
    await page.keyboard.press('KeyN'); assert.equal(await page.getAttribute('#st-mute', 'aria-pressed'), 'true');
    // the map and pause
    await page.keyboard.press('KeyM'); await page.locator('.st-map').waitFor(); await page.keyboard.press('Escape'); await page.locator('.st-map').waitFor({ state: 'detached' });
    await page.keyboard.press('KeyP'); await page.getByRole('button', { name: 'Carry on' }).click();
    // the conversation
    await G(page, 'g.foes.length = 0; g.x = 20; g.z = -13; g.v = 0; g.gear = 0;'); await page.locator('#st-say-bargain').click();
    await page.waitForFunction(() => window.__straits().phase === 'sail'); assert.equal(await G(page, 'return g.hay'), 75); assert.equal(await G(page, 'return g.stance'), 'calm');
    // a jetty
    await G(page, 'g.x = -14; g.z = -52; g.hull = 50; g.seeds = 20;'); await page.getByRole('heading', { name: 'Auntie Kera' }).waitFor(); await page.locator('#st-say-ally').click();
    await page.waitForFunction(() => window.__straits().phase === 'sail'); assert.equal(await G(page, 'return g.volley'), 18); assert.equal(await G(page, 'return g.stance'), 'hostile'); await page.keyboard.press('KeyF');
    await page.getByRole('heading', { name: 'Sentosa' }).waitFor(); await page.getByRole('button', { name: /Patch the hull/ }).click();
    assert.equal(await G(page, 'return g.hull'), 130); await page.getByRole('button', { name: 'Cast off' }).click(); await page.waitForFunction(() => window.__straits().phase === 'sail');
    // Tok Tiong's wind, then land the hay
    await G(page, 'g.x = 17; g.z = 9;'); await page.getByRole('heading', { name: 'Tok Tiong' }).waitFor(); assert.ok(await page.locator('#st-say-cats').isDisabled()); await page.locator('#st-say-wind').click();
    await page.waitForFunction(() => window.__straits().windHeld); assert.match(await page.locator('#st-wind').textContent(), /HELD/);
    await G(page, 'g.x = 55.5; g.z = 47.5;'); await page.keyboard.press('KeyF'); await page.getByRole('heading', { name: 'Hay landed on Pulau Ubin' }).waitFor();
    assert.match(await page.locator('.st-card').textContent(), /SILVER · 75% of the bale/);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('straits-v1'))).best, 'silver');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
    await page.getByRole('button', { name: 'Sail again' }).click(); await page.getByText(/Best voyage: silver/).waitFor();
    console.log(`PASS straits ${w}×${h}`); await page.close();
  }
} finally { await browser.close(); }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS straits e2e');
