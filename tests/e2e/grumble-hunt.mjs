import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { huntPolicy } from '../grumble-hunt-policy.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/hunt', { recursive: true });
const hunt = (p, fn, arg) => p.evaluate(`(() => { const w = window.__hunt(), value = (${fn})(w, ${JSON.stringify(arg ?? null)}); w.refresh(); return value; })()`);
async function fresh(p, hero = 'dora') {
  await p.goto(`${base}/hunt`); await p.evaluate(() => { localStorage.removeItem('grumble-hunt-v1'); localStorage.removeItem('grumble-hunt-sound-v1'); }); await p.reload();
  await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor();
  await p.getByTestId(`choose-${hero}`).click(); await p.locator('main[data-mode="village"]').waitFor();
}
async function start(p, id = 'bristleback') { await p.getByTestId('open-board').click(); await p.getByTestId(`hunt-${id}`).click(); await p.locator('main[data-mode="hunt"]').waitFor(); }
async function check(name, fn, options = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 }, ...options }); page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (process.env.TRACE && m.type() === 'error') console.error('Browser:', m.text().slice(0, 800)); });
  try { await fn(page); console.log(`PASS hunt browser: ${name}`); }
  catch (e) { failures.push(name); console.error(`FAIL hunt browser: ${name}: ${e.message}`); await page.screenshot({ path: `.checks/hunt/failure-${failures.length}.png`, fullPage: true }).catch(() => {}); }
  finally { await page.close(); }
}
const fits = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const snapshot = (p, name) => p.screenshot({ path: `.checks/hunt/${name}.png` });

try {
  await check('arcade, village, field guide, Beast Book and locked hunts', async (p) => {
    await p.goto(base); assert.equal(await p.locator('.arcade-card').count(), 39); await p.getByRole('link', { name: /Grumble Hunt/ }).click();
    await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); await snapshot(p, 'title');
    await p.getByTestId('choose-dora').click(); await snapshot(p, 'village');
    await p.getByTestId('open-board').click(); assert.equal(await p.getByTestId('hunt-hornclack').isDisabled(), true); assert.equal(await p.getByTestId('hunt-frostmane').isDisabled(), true); await p.getByRole('button', { name: 'Close panel' }).click();
    await p.getByTestId('open-book').click(); assert.equal(await p.locator('.hunt-book article').count(), 5); assert.match(await p.getByTestId('nap-count').innerText(), /0 \/ 5/); assert.equal(await p.locator('.hunt-book img').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0)), true); await snapshot(p, 'beast-book');
    await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Open field guide' }).click(); assert.match(await p.getByTestId('panel-help').innerText(), /Hold K|hold K|Charge a big/); await p.getByRole('button', { name: 'Ready for a little adventure' }).click();
    assert(await fits(p));
  });

  await check('keyboard movement, charged hammer, lock, items, pause and focus loss', async (p) => {
    await fresh(p); await start(p);
    const z = await hunt(p, (w) => w.game.hero.z); await p.keyboard.down('w'); await p.waitForFunction((before) => window.__hunt().game.hero.z < before - 0.5, z); await p.keyboard.up('w'); assert(await hunt(p, (w) => w.game.hero.z) < z - 0.5);
    await hunt(p, (w) => { const g = w.game; g.hero.x = g.beast.x; g.hero.z = g.beast.z + 2.8; g.beast.state = 'rest'; g.beast.t = 0; g.beast.duration = 100; g.buddy.cooldown = 100; });
    const grump = await hunt(p, (w) => w.game.beast.grump); await p.keyboard.down('k'); await p.waitForFunction(() => window.__hunt().game.hero.charge >= 0.4); await p.keyboard.up('k'); await p.waitForFunction((before) => window.__hunt().game.beast.grump < before - 20, grump); assert(await hunt(p, (w) => w.game.beast.grump) < grump - 20);
    const lock = await hunt(p, (w) => w.game.locked); await p.keyboard.press('Tab'); await p.waitForFunction((before) => window.__hunt().game.locked !== before, lock); assert.equal(await hunt(p, (w) => w.game.locked), !lock);
    await hunt(p, (w) => { w.game.hero.fluff = 50; w.game.buddy.berry = 100; }); await p.keyboard.press('f'); await p.waitForFunction(() => window.__hunt().game.items[0] === 2); assert(await hunt(p, (w) => w.game.hero.fluff) >= 85); assert.equal(await hunt(p, (w) => w.game.items[0]), 2);
    await p.keyboard.press('e'); await p.waitForFunction(() => window.__hunt().game.item === 1); assert.equal(await hunt(p, (w) => w.game.item), 1);
    await p.keyboard.press('p'); await p.getByTestId('resume').waitFor(); assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'resume'); const time = await hunt(p, (w) => w.game.time); await p.waitForTimeout(200); assert.equal(await hunt(p, (w) => w.game.time), time); await p.getByTestId('resume').click();
    await p.keyboard.down('k'); await p.waitForTimeout(250); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal(await hunt(p, (w) => w.game.hero.charge), 0); assert.equal(await hunt(p, (w) => w.input().keys.length), 0); await p.keyboard.up('k'); await p.getByTestId('resume').click();
    assert.equal(await hunt(p, (w) => w.game.hero.charge), 0);
    await p.getByTestId('mute').click(); assert.equal(await p.getByTestId('mute').getAttribute('aria-pressed'), 'true'); assert.equal(await p.evaluate(() => localStorage.getItem('grumble-hunt-sound-v1')), 'off');
  });

  await check('every hunt, dizzy and nap animation, real input policy, forge, victory and saved replay', async (p) => {
    await fresh(p);
    for (const id of ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane']) {
      await start(p, id);
      await hunt(p, (w) => { w.game.beast.duration = 5; }); await p.waitForTimeout(650); await snapshot(p, id);
      if (id === 'bristleback') {
        await hunt(p, (w) => { w.game.makeDizzy(5); }); await p.waitForTimeout(120); await snapshot(p, 'dizzy');
      }
      const result = await p.evaluate(`(() => { const g = window.__hunt().game, policy = ${huntPolicy.toString()}; g.paused = false; let n = 0; while (g.mode === 'hunt' && n++ < 36000) { g.step(1/60, policy(g)); g.events.length = 0; } if(g.mode === 'nap') { for(let i=0;i<65;i++)g.step(1/60); g.paused=true; } window.__hunt().refresh(); return { mode:g.mode, grump:g.beast.grump, fluff:g.hero.fluff, naps:g.profile.naps, materials:g.materialTotal }; })()`);
      assert.equal(result.mode, 'nap', `${id}: ${JSON.stringify(result)}`); assert.equal(result.grump, 0); assert(result.naps[id] > 0);
      await p.locator('main[data-mode="nap"]').waitFor(); await snapshot(p, `${id}-nap`);
      const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('grumble-hunt-v1'))); assert(stored.profile.naps[id] > 0, 'last bonk is saved before the nap finishes');
      await hunt(p, (w) => { const g = w.game; g.paused = false; for (let i = 0; i < 180; i++) g.step(1 / 60); });
      await p.getByTestId('result').waitFor(); if (id === 'frostmane') { assert.match(await p.getByTestId('result').innerText(), /grand, gentle adventure/); await snapshot(p, 'victory'); }
      await p.getByTestId('return-village').click();
    }
    await p.getByTestId('open-forge').click(); const total = await hunt(p, (w) => w.game.materialTotal); assert(total >= 36);
    for (const id of ['dora', 'enzo']) { await p.getByTestId(`upgrade-${id}`).click(); await p.getByTestId(`upgrade-${id}`).click(); assert.equal(await p.getByTestId(`upgrade-${id}`).isDisabled(), true); }
    assert.equal(await hunt(p, (w) => w.game.materialTotal), total - 36); await snapshot(p, 'forge'); await p.keyboard.press('Escape');
    const profile = await hunt(p, (w) => w.game.profile); await p.reload(); await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); assert.deepEqual(await hunt(p, (w) => w.game.profile), profile);
    await p.getByTestId('open-board').click(); assert.equal(await p.getByTestId('hunt-frostmane').isDisabled(), false); await p.getByTestId('hunt-frostmane').click(); await p.locator('main[data-mode="hunt"]').waitFor();
  });

  await check('tuckered out keeps materials, retry works, and New game resets only this save', async (p) => {
    await fresh(p, 'enzo'); await start(p);
    await hunt(p, (w) => { const g = w.game; g.profile.materials.bristleback = 7; g.hero.fluff = 1; g.hero.invincible = 0; g.bumpHero(20, g.beast); });
    await p.getByTestId('result').waitFor(); assert.match(await p.getByTestId('result').innerText(), /tuckered out/); assert.equal(await hunt(p, (w) => w.game.materialTotal), 7); await snapshot(p, 'camp-return');
    await p.getByTestId('retry').click(); assert.equal(await hunt(p, (w) => w.game.hero.fluff), 100); assert.deepEqual(await hunt(p, (w) => w.game.items), [3, 2, 2]);
    await p.getByRole('button', { name: 'New game', exact: true }).click(); await p.getByTestId('confirm-reset').click(); await p.getByTestId('panel-choose').waitFor(); assert.equal(await hunt(p, (w) => w.game.materialTotal), 0); assert.equal(await hunt(p, (w) => w.game.profile.hero), null);
  });

  await check('phone joystick, quick action taps, charged bow, cancellation and responsive panels', async (p) => {
    await fresh(p, 'enzo'); await start(p);
    assert(await fits(p)); const joy = await p.getByTestId('joystick').boundingBox(), before = await hunt(p, (w) => ({ x: w.game.hero.x, z: w.game.hero.z }));
    await p.mouse.move(joy.x + joy.width / 2, joy.y + joy.height / 2); await p.mouse.down(); await p.mouse.move(joy.x + joy.width / 2 + 34, joy.y + joy.height / 2); await p.waitForFunction((before) => { const h = window.__hunt().game.hero; return Math.hypot(h.x - before.x, h.z - before.z) > 0.5; }, before); await p.mouse.up();
    const after = await hunt(p, (w) => ({ x: w.game.hero.x, z: w.game.hero.z })); assert(Math.hypot(after.x - before.x, after.z - before.z) > 0.5); assert.equal(await hunt(p, (w) => w.input().touch.x), 0);
    await hunt(p, (w) => { w.game.buddy.cooldown = 100; w.game.beast.state = 'rest'; w.game.beast.duration = 100; });
    const grump = await hunt(p, (w) => w.game.beast.grump); await p.getByTestId('touch-bonk').tap(); await p.waitForFunction((before) => window.__hunt().game.beast.grump < before, grump); assert(await hunt(p, (w) => w.game.beast.grump) < grump);
    const charge = await p.getByTestId('touch-charge').boundingBox(); await p.mouse.move(charge.x + charge.width / 2, charge.y + charge.height / 2); await p.mouse.down(); await p.waitForFunction(() => window.__hunt().game.hero.charge >= 0.35); assert(await hunt(p, (w) => w.game.hero.charge) >= 0.35); await p.mouse.up(); await p.waitForTimeout(180);
    await p.mouse.down(); await p.waitForTimeout(150); await p.getByTestId('touch-charge').dispatchEvent('pointercancel', { pointerId: 1 }); await p.mouse.up(); assert.equal(await hunt(p, (w) => w.input().touch.charge), false); assert.equal(await hunt(p, (w) => w.game.hero.charge), 0);
    await p.getByTestId('touch-roll').tap(); await p.waitForFunction(() => window.__hunt().game.hero.rollCd > 0); assert(await hunt(p, (w) => w.game.hero.rollCd) > 0); await snapshot(p, 'phone-hunt');
    await p.getByTestId('pause').click(); await p.getByRole('button', { name: 'Return to camp', exact: true }).click();
    for (const place of ['forge', 'book', 'board']) { await p.getByTestId(`open-${place}`).click(); assert(await fits(p)); await p.getByRole('button', { name: 'Close panel' }).click(); }
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  for (const [width, height] of [[320, 568], [844, 390]]) await check(`layout ${width}x${height}, reduced motion and rendering budget`, async (p) => {
    await p.emulateMedia({ reducedMotion: 'reduce' }); await fresh(p); assert(await fits(p)); await start(p); assert(await fits(p));
    for (const id of ['touch-bonk', 'touch-roll', 'touch-charge', 'joystick']) { const r = await p.getByTestId(id).boundingBox(); assert(r && r.x >= 0 && r.x + r.width <= width + 1 && r.y >= 0 && r.y + r.height <= height + 1, `${id} stays on screen`); }
    const metrics = await hunt(p, (w) => w.metrics()); assert(metrics.pixelRatio <= 1.5); assert(metrics.triangles < 250000); assert(metrics.calls < 400); assert(metrics.camera[1] >= 0.8);
    await snapshot(p, `layout-${width}x${height}`);
  }, { viewport: { width, height }, isMobile: true, hasTouch: true });

  await check('orange warnings, tongue flick, horn sweep and icy mane shake render', async (p) => {
    await fresh(p); await start(p, 'puffwart');
    await hunt(p, (w) => { const b = w.game.beast; b.state = 'windup'; b.attack = 'tongue'; b.t = 0; b.duration = 2; b.start = { x: b.x, z: b.z }; b.dir = { x: 0, z: 1 }; b.face = -Math.PI / 2; b.aim = { x: b.x, z: b.z + 7 }; w.game.buddy.cooldown = 100; });
    await p.waitForTimeout(180); await snapshot(p, 'orange-warning');
    await hunt(p, (w) => { w.game.beast.state = 'tongue'; w.game.beast.t = 0.25; w.game.beast.duration = 2; }); await snapshot(p, 'tongue-flick');
    for (const [id, action] of [['hornclack', 'sweep'], ['frostmane', 'shake']]) {
      await hunt(p, (w, a) => { const g = w.game; g.returnVillage(); for (const k of ['bristleback', 'puffwart', 'skreel']) g.profile.naps[k] = 1; g.startHunt(a.id); g.beast.state = a.action; g.beast.attack = a.action; g.beast.t = 0.25; g.beast.duration = 2; g.buddy.cooldown = 100; }, { id, action });
      await p.waitForTimeout(150); await snapshot(p, action);
    }
  });

  await check('phone rendering budget with four-times CPU throttling', async (p) => {
    await fresh(p); await start(p);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const deltas = await p.evaluate(() => new Promise((resolve) => {
      const frames = []; let start = 0, last = 0;
      const frame = (now) => { if (!start) start = now; if (last) frames.push(now - last); last = now; if (now - start < 2000) requestAnimationFrame(frame); else resolve(frames); };
      requestAnimationFrame(frame);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    deltas.sort((a, b) => a - b); const metrics = await hunt(p, (w) => w.metrics());
    assert(metrics.calls < 400); assert(metrics.triangles < 250000);
    const backend = await p.evaluate(() => { const gl = document.querySelector('canvas[data-testid="hunt-canvas"]').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable'; });
    const result = { backend, viewport: '390x844', deviceScaleFactor: 3, cpuThrottle: 4, frames: deltas.length, medianFrameMs: Number(deltas[Math.floor(deltas.length / 2)].toFixed(1)), ...metrics };
    writeFileSync('.checks/hunt/performance.json', JSON.stringify(result, null, 2)); console.log('Phone emulation:', JSON.stringify(result));
    assert(deltas.length >= 2, 'the scene keeps drawing under throttling');
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  await check('camera orbit avoids terrain, texture count stays bounded, navigation tears down', async (p) => {
    await fresh(p); await start(p); const first = await hunt(p, (w) => w.metrics().textures), c = p.getByTestId('hunt-canvas');
    const r = await c.boundingBox(); await p.mouse.move(r.width / 2, r.height / 2); await p.mouse.down(); await p.mouse.move(r.width / 2 + 200, r.height / 2 - 120, { steps: 8 }); await p.mouse.up();
    assert(await hunt(p, (w) => w.metrics().camera[1]) >= 0.8); await p.mouse.wheel(0, -1500); await p.waitForTimeout(150); assert(await hunt(p, (w) => w.metrics().camera[1]) >= 0.8);
    for (let n = 0; n < 3; n++) { await p.getByTestId('pause').click(); await p.getByRole('button', { name: 'Return to camp', exact: true }).click(); await start(p); }
    assert(await hunt(p, (w) => w.metrics().textures) <= first + 1);
    await p.getByRole('link', { name: /MAIN ARCADE/ }).click(); await p.waitForSelector('.arcade-grid'); assert.equal(await p.locator('.arcade-card').count(), 39);
    // Return via client navigation/history: the lifecycle also has to recreate a working renderer.
    await p.goBack(); await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); assert(await hunt(p, (w) => w.metrics().textures) > 0);
  });
} finally { await browser.close(); }
assert.deepEqual(errors, [], 'no browser exceptions');
assert.deepEqual(failures, [], 'all Grumble Hunt browser checks pass');
console.log('Grumble Hunt browser suite passed; screenshots are in .checks/hunt/.');
