import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { huntPolicy } from '../grumble-hunt-policy.mjs';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/hunt', { recursive: true });
const hunt = (p, fn, arg) => p.evaluate(`(() => { const w = window.__hunt(), value = (${fn})(w, ${JSON.stringify(arg ?? null)}); w.refresh(); return value; })()`);
async function fresh(p, hero = 'dora', story = false) {
  await p.goto(`${base}/hunt`); await p.evaluate(() => { localStorage.removeItem('grumble-hunt-v1'); localStorage.removeItem('grumble-hunt-v2'); localStorage.removeItem('grumble-hunt-v3'); localStorage.removeItem('grumble-hunt-v4'); localStorage.removeItem('grumble-hunt-v5'); localStorage.removeItem('grumble-hunt-v6'); localStorage.removeItem('grumble-hunt-sound-v1'); }); await p.reload();
  await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor();
  await p.getByTestId(`choose-${hero}`).click(); await p.getByTestId('rack-ready').click();
  await p.getByTestId('story-scene').waitFor(); if (story) return;
  await p.getByTestId('story-skip').click();
  await hunt(p, (w) => { const g = w.game; g.returnVillage(); g.story.chapter = 6; g.profile.extraGrumpyUnlocked = true; for (const id of ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane']) g.profile.beastBook[id].met = true; });
  await p.locator('main[data-mode="village"]').waitFor();
}
// Checks start after the hello roar (it can't come in the first 2.4 s); the orange-warnings check covers the roar.
async function start(p, id = 'bristleback') { await p.getByTestId('open-board').click(); await p.getByTestId(`hunt-${id}`).click(); await p.locator('main[data-mode="hunt"]').waitFor(); await hunt(p, (w) => { w.game.roared = w.game.introduced = true; }); }
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
  await check('story pages, paddock calf, villagers, four areas, ending and daily board', async (p) => {
    await fresh(p, 'dora', true);
    const first = await p.getByTestId('story-text').innerText(); await snapshot(p, 'story-intro');
    await p.keyboard.press('Enter'); assert.notEqual(await p.getByTestId('story-text').innerText(), first);
    await p.getByTestId('story-skip').click(); await p.locator('main[data-mode="hunt"]').waitFor();
    assert.equal(await hunt(p, (w) => w.game.beast.maxGrump), 40); assert.equal(await hunt(p, (w) => w.game.area), 'paddock');
    await snapshot(p, 'story-paddock');
    await hunt(p, (w) => { const g = w.game; g.bonkBeast(1000, true, g.hero); for (let n = 0; n < 240; n++) g.step(1/60); });
    await p.getByTestId('story-scene').waitFor(); await p.getByTestId('story-skip').click(); await p.getByTestId('return-village').click();
    await p.waitForFunction(() => window.__hunt().metrics().villagers === 4); assert(await hunt(p, (w) => w.metrics().calls) < 400); await snapshot(p, 'story-villagers');
    await hunt(p, (w) => { const g = w.game; g.story.chapter = 6; g.clearedChapter = -1; g.profile.extraGrumpyUnlocked = true; for (const id of ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane']) g.profile.beastBook[id].met = true; });
    for (const [id, area] of [['puffwart', 'marsh'], ['skreel', 'ridge'], ['hornclack', 'hollow'], ['frostmane', 'peak']]) {
      await start(p, id); await p.waitForFunction((area) => window.__hunt().metrics().area === area, area);
      await p.waitForTimeout(700); await snapshot(p, `story-area-${area}`);
      assert(await hunt(p, (w) => w.metrics().calls) < 400);
      await hunt(p, (w) => w.game.returnVillage());
    }
    const baseline = await hunt(p, (w) => w.metrics().textures);
    for (let round = 0; round < 2; round++) for (const id of ['puffwart', 'skreel', 'hornclack', 'frostmane']) {
      await hunt(p, (w, id) => { w.game.returnVillage(); w.game.startHunt(id); w.game.paused = true; }, id);
      await p.waitForTimeout(250);
      // Each area adds its ground, sky and prop paintings (the peak adds ice too); switching back and forth must not grow this.
      assert(await hunt(p, (w) => w.metrics().textures) <= baseline + 5, 'area textures remain bounded');
    }
    await hunt(p, (w) => w.game.returnVillage());
    await hunt(p, (w) => w.game.setBountyDay('2026-10-24'));
    await p.getByTestId('open-book').click(); await p.getByTestId('open-bounties').click(); assert.equal(await p.getByTestId('bounty-card').count(), 3); await snapshot(p, 'story-bounties');
    await p.keyboard.press('Escape'); await p.getByTestId('open-board').click(); await p.getByTestId('extra-grumpy-toggle').check(); await p.getByTestId('hunt-puffwart').click();
    await p.waitForFunction(() => window.__hunt().metrics().variantColor === '#639dc8'); assert.equal(await hunt(p, (w) => w.game.beast.maxGrump), 440 * 1.6); await snapshot(p, 'story-blue-puffwart');
  });
  await check('v3 migrates to v5 with old scenes seen and equipped gear intact', async (p) => {
    await fresh(p);
    await p.evaluate(() => { const s = window.__hunt().game.save(); s.v = 3; delete s.profile.story; delete s.profile.beastBook; delete s.profile.bounties; delete s.profile.extraGrumpyUnlocked; for (const id of ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane']) s.profile.naps[id] = 1; s.profile.weapons.hammer = { tier: 3, branch: 'A' }; localStorage.removeItem('grumble-hunt-v4'); localStorage.removeItem('grumble-hunt-v5'); localStorage.removeItem('grumble-hunt-v6'); localStorage.setItem('grumble-hunt-v3', JSON.stringify(s)); });
    await p.reload(); await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor();
    assert.equal(await p.getByTestId('story-scene').count(), 0);
    assert.equal(await hunt(p, (w) => w.game.chapter), 6); assert.equal(await hunt(p, (w) => w.game.story.scenesSeen.length), 12); assert.equal(await hunt(p, (w) => w.game.node('hammer').id), 'hammer-3A');
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('grumble-hunt-v6') || 'null')?.v === 6);
    await p.getByTestId('open-book').click(); await p.getByRole('button', { name: /A Grumpy Morning · Before/ }).click(); await p.getByTestId('story-scene').waitFor(); await p.getByTestId('story-skip').click(); await p.getByTestId('panel-book').waitFor();
  });
  await check('Hop-on rider, tap meter, grip prompt and roll off', async (p) => {
    await fresh(p);
    await hunt(p, (w) => { const g = w.game; for (const id of ['bristleback', 'puffwart', 'skreel']) g.profile.naps[id] = 1; if (!g.equip('yoyo')) throw new Error('Yo-yo did not equip'); });
    await start(p);
    await hunt(p, (w) => { const g = w.game; g.hero.x = g.beast.x; g.hero.z = g.beast.z + 2.7; g.makeDizzy(8); g.buddy.cooldown = 100; });
    await p.keyboard.down('k'); await p.waitForTimeout(100); await p.keyboard.up('k');
    await p.waitForFunction(() => window.__hunt().game.ride.riding);
    await p.getByTestId('ride-hud').waitFor();
    await snapshot(p, 'hop-on-rider');
    assert.equal(await hunt(p, (w) => w.metrics().ride.riding), true);
    await p.keyboard.down('k');
    for (let i = 0; i < 5; i++) { await p.keyboard.press('j', { delay: 45 }); await p.waitForTimeout(120); }
    await p.waitForFunction(() => window.__hunt().game.ride.fullBonks === 1);
    assert.equal(await p.getByTestId('ride-pips').getAttribute('aria-label'), '1 of 3 full bonks');
    assert.equal(await p.getByTestId('ride-pips').locator('[data-full="true"]').count(), 1);
    await p.getByTestId('ride-warning').waitFor(); assert.match(await p.getByTestId('ride-warning').innerText(), /Hold on! \(K\)/);
    await snapshot(p, 'hop-on-hold-on');
    await p.keyboard.press('Space'); await p.keyboard.up('k');
    await p.waitForFunction(() => !window.__hunt().game.ride.riding);
    await p.getByTestId('ride-hud').waitFor({ state: 'hidden' });
    assert.equal(await hunt(p, (w) => w.game.hero.fluff), 100);
  });
  await check('arcade, village, field guide, Beast Book and locked hunts', async (p) => {
    await p.goto(base); assert.equal(await p.locator('.arcade-card').count(), 39); await p.getByRole('link', { name: /Grumble Hunt/ }).click();
    await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); await snapshot(p, 'title');
    await p.getByTestId('choose-dora').click(); await p.getByTestId('panel-rack').waitFor(); assert(await p.getByTestId('weapon-preview').isVisible()); assert.equal(await p.getByTestId('rack-wand').isDisabled(), true); await p.getByTestId('rack-hammer').click(); await p.getByTestId('rack-ready').click(); await p.getByTestId('story-skip').click(); await hunt(p, (w) => { const g = w.game; g.returnVillage(); g.story.chapter = 1; }); await snapshot(p, 'village');
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
    await hunt(p, (w) => { w.game.hero.fluff = 50; w.game.buddy.berry = 100; }); await p.keyboard.press('f'); await p.waitForFunction(() => window.__hunt().game.profile.pouch.fluffberry === 2); assert(await hunt(p, (w) => w.game.hero.fluff) >= 80); assert.equal(await hunt(p, (w) => w.game.profile.pouch.fluffberry), 2);
    await p.keyboard.press('e'); await p.waitForFunction(() => window.__hunt().game.item === 1); assert.equal(await hunt(p, (w) => w.game.item), 1);
    await p.keyboard.press('p'); await p.getByTestId('resume').waitFor(); assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'resume'); const time = await hunt(p, (w) => w.game.time); await p.waitForTimeout(200); assert.equal(await hunt(p, (w) => w.game.time), time); await p.getByTestId('resume').click();
    await p.keyboard.down('k'); await p.waitForTimeout(250); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal(await hunt(p, (w) => w.game.hero.charge), 0); assert.equal(await hunt(p, (w) => w.input().keys.length), 0); await p.keyboard.up('k'); await p.getByTestId('resume').click();
    assert.equal(await hunt(p, (w) => w.game.hero.charge), 0);
    await p.getByTestId('mute').click(); assert.equal(await p.getByTestId('mute').getAttribute('aria-pressed'), 'true'); assert.equal(await p.evaluate(() => localStorage.getItem('grumble-hunt-sound-v1')), 'off');
  });

  await check('review fixes: HUD focus, sprint lock, hit-stop taps and guide', async (p) => {
    await fresh(p); await start(p);
    await hunt(p, (w) => { const g = w.game; g.beast.state = 'rest'; g.beast.duration = 1000; g.buddy.cooldown = 1000; g.buddy.berry = 1000; g.hero.fluff = 40; });
    // Slow software frames can start and finish a roll between two polls, so a setter records that the roll began.
    const armRoll = () => hunt(p, (w) => { const h = w.game.hero; window.__rolled = false; if (!Object.getOwnPropertyDescriptor(h, 'rollCd')?.set) { let v = h.rollCd; Object.defineProperty(h, 'rollCd', { get: () => v, set: (x) => { if (x > 0.5) window.__rolled = true; v = x; }, configurable: true }); } });
    for (const button of [p.getByTestId('use-item'), p.getByRole('button', { name: 'Next item', exact: true }), p.getByRole('button', { name: 'Previous item', exact: true }), p.getByTestId('mute')]) {
      await button.click(); assert.equal(await p.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'hunt-canvas');
      const before = await hunt(p, (w) => ({ pouch: { ...w.game.profile.pouch }, item: w.game.item }));
      const muted = await p.getByTestId('mute').getAttribute('aria-pressed');
      await armRoll(); await p.keyboard.press('Enter'); await p.keyboard.press('Space');
      await p.waitForFunction(() => window.__rolled);
      assert.deepEqual(await hunt(p, (w) => ({ pouch: { ...w.game.profile.pouch }, item: w.game.item })), before);
      assert.equal(await p.getByTestId('mute').getAttribute('aria-pressed'), muted);
      await hunt(p, (w) => { w.game.hero.roll = -1; w.game.hero.rollCd = 0; w.game.clearInput(); });
    }
    const locked = await hunt(p, (w) => w.game.locked);
    await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');
    await p.waitForFunction((before) => window.__hunt().game.locked !== before, locked);
    assert.equal(await hunt(p, (w) => w.game.paused), false);
    for (const focusBody of [false, true]) {
      await armRoll();
      await p.evaluate((body) => {
        const g = window.__hunt().game; g.hitstop = 0.11; g.hero.roll = -1; g.hero.rollCd = 0;
        if (body) document.activeElement.blur();
        const target = body ? document.body : document.activeElement;
        target.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
      }, focusBody);
      await p.waitForFunction(() => window.__rolled);
    }
    await hunt(p, (w) => { w.game.hero.cooldown = 2; w.game.hero.charge = 0; w.game.hero.roll = -1; });
    await p.keyboard.down('k'); await p.waitForTimeout(150);
    assert.equal(await hunt(p, (w) => w.game.hero.charge), 0); assert.match(await p.getByTestId('charge-status').innerText(), /recovering/);
    await hunt(p, (w) => { w.game.hero.cooldown = 0; });
    await p.waitForFunction(() => window.__hunt().game.hero.charge >= 0.35);
    await p.waitForFunction(() => document.querySelector('[data-testid=charge-status]').textContent.includes('ready'));
    await p.keyboard.up('k');
    await p.getByRole('button', { name: 'Open field guide' }).click();
    assert.match(await p.getByTestId('panel-help').innerText(), /two big bonks or big shots; buddy bonks help a little/);
  });

  await check('review fixes: graphics context loss in village and hunt recovers keyboard', async (p) => {
    await fresh(p);
    for (const mode of ['village', 'hunt']) {
      if (mode === 'hunt') await start(p);
      await p.getByTestId('hunt-canvas').dispatchEvent('webglcontextlost');
      assert.equal(await hunt(p, (w) => w.game.paused), mode === 'hunt');
      if (mode === 'village') {
        const before = await hunt(p, (w) => w.game.hero.x); await p.keyboard.down('d');
        await p.waitForFunction((x) => window.__hunt().game.hero.x > x + 0.2, before); await p.keyboard.up('d');
      }
      await p.getByTestId('hunt-canvas').dispatchEvent('webglcontextrestored');
      assert.equal(await hunt(p, (w) => w.game.paused), false);
      // React clears the banner on its next render, which can land a moment after the event under load.
      await p.locator('.hunt-error').waitFor({ state: 'detached', timeout: 15000 });
      await p.getByTestId('hunt-canvas').focus();
      const before = await hunt(p, (w) => w.game.hero.x); await p.keyboard.down('d');
      await p.waitForFunction((x) => window.__hunt().game.hero.x > x + 0.2, before); await p.keyboard.up('d');
    }
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
      const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('grumble-hunt-v6'))); assert(stored.profile.naps[id] > 0, 'last bonk is saved before the nap finishes');
      await hunt(p, (w) => { const g = w.game; g.paused = false; for (let i = 0; i < 180; i++) g.step(1 / 60); });
      await p.getByTestId('result').waitFor(); assert.equal(await p.locator('.hunt-unlock').count(), await hunt(p, (w) => w.game.clearedChapter >= 0 && w.game.clearedChapter < 5 ? 1 : 0), 'the next-chapter note'); assert.equal(await p.getByTestId('reward').count(), 1, 'the nap reward card'); assert.match(await p.getByTestId('hunt-time').innerText(), await hunt(p, (w) => w.game.newRecord) ? /^Calmed in .+ s · New best time!$/ : /^Calmed in .+ s/); if (id === 'frostmane') { assert.match(await p.getByTestId('result').innerText(), /The End · free hunt is open/); await snapshot(p, 'victory'); }
      await p.getByTestId('return-village').click();
    }
    await hunt(p, (w) => { Object.assign(w.game.profile.pouch, { 'bristle-tuft': 10, berry: 4, 'tusk-shard': 2 }); });
    await p.getByTestId('open-forge').click(); await p.getByTestId('forge-tree').waitFor();
    await p.getByTestId('rack-hammer').click();
    assert.equal(await p.getByTestId('forge-hammer-3A').isDisabled(), true);
    await p.getByTestId('forge-hammer-2').click();
    assert.equal(await hunt(p, (w) => w.game.profile.pouch['bristle-tuft']), 7);
    await p.getByTestId('forge-cheer').waitFor({ state: 'hidden' }); await p.getByTestId('forge-hammer-3A').click(); assert.equal(await hunt(p, (w) => w.game.node().id), 'hammer-3A');
    await p.getByTestId('forge-armour').click(); await p.getByTestId('armour-bristleback-helm').click();
    assert.equal(await hunt(p, (w) => w.game.profile.armour.worn.helm), 'bristleback-helm');
    await snapshot(p, 'forge'); await p.keyboard.press('Escape');
    await p.getByTestId('open-forge').click(); await p.getByTestId('forge-tree').waitFor();
    await p.getByTestId('rack-hammer').click(); await p.getByTestId('forge-hammer-3A').waitFor();
    // Switching who to equip selects that hero's current tool.
    await p.getByTestId('forge-who').selectOption('enzo'); assert.equal(await p.getByTestId('rack-bow').getAttribute('aria-pressed'), 'true'); await p.getByTestId('forge-bow-2').waitFor();
    await p.getByTestId('forge-who').selectOption('dora'); assert.equal(await p.getByTestId('rack-hammer').getAttribute('aria-pressed'), 'true');
    await p.keyboard.press('Escape');
    const profile = await hunt(p, (w) => w.game.profile); await p.reload(); await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); assert.deepEqual(await hunt(p, (w) => w.game.profile), profile);
    await p.getByTestId('open-board').click(); assert.equal(await p.getByTestId('hunt-frostmane').isDisabled(), false); await p.getByTestId('hunt-frostmane').click(); await p.locator('main[data-mode="hunt"]').waitFor();
  });

  await check('tuckered out keeps materials, retry works, and New game resets only this save', async (p) => {
    await fresh(p, 'enzo'); await start(p);
    await hunt(p, (w) => { const g = w.game; g.profile.pouch['bristle-tuft'] = 7; for (const id of ['bristleback', 'puffwart', 'skreel']) g.profile.naps[id] = 1; g.hero.fluff = 1; g.hero.invincible = 0; g.bumpHero(20, g.beast); });
    await p.getByTestId('result').waitFor(); assert.match(await p.getByTestId('result').innerText(), /tuckered out/); assert.equal(await p.locator('.hunt-unlock').count(), 0); assert.equal(await hunt(p, (w) => w.game.materialTotal), 7); await snapshot(p, 'camp-return');
    await p.getByTestId('retry').click(); assert.equal(await hunt(p, (w) => w.game.hero.fluff), 100); assert.equal(await hunt(p, (w) => w.game.profile.pouch.fluffberry), 3);
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
    // Roar: the first sighting shows the name card and a big orange circle, then sound rings and covered ears.
    await hunt(p, (w) => { const g = w.game; g.returnVillage(); g.startHunt('bristleback'); const b = g.beast; g.buddy.cooldown = 100; g.hero.x = b.x; g.hero.z = b.z + 4; b.state = 'roam'; b.t = 0; b.duration = 0; });
    await p.waitForFunction(() => window.__hunt().game.beast.attack === 'roar');
    await p.getByTestId('intro-card').waitFor(); assert.match(await p.getByTestId('intro-card').innerText(), /Bristleback[\s\S]*the Bristly Charger/);
    await snapshot(p, 'roar-warning');
    await p.waitForFunction(() => window.__hunt().metrics().roarRings > 0, null, { timeout: 15000 });
    await p.waitForFunction(() => window.__hunt().game.hero.covered > 0, null, { timeout: 15000 }); await snapshot(p, 'roar');
    await p.getByTestId('intro-card').waitFor({ state: 'hidden', timeout: 30000 });
    // Weather at full strength: thicker fog everywhere, plus rain, dust or a blizzard of flakes, under the draw budget.
    for (const [id, kind, bit] of [['bristleback', 'rain', 'rain'], ['skreel', 'mist', null], ['hornclack', 'dust', 'dust'], ['frostmane', 'blizzard', 'flakes']]) {
      await hunt(p, (w, a) => { const g = w.game; g.returnVillage(); g.story.chapter = 6; g.startHunt(a); g.roared = g.introduced = true; g.buddy.cooldown = 100; g.beast.state = 'rest'; g.beast.duration = 100; g.huntTime = g.weatherClear + g.weatherSpell / 2; }, id);
      await p.waitForFunction((k) => { const w = window.__hunt(), m = w.metrics(); return w.game.weather.kind === k && w.game.stormy && m.weather.fogFar < 60; }, kind, { timeout: 15000 });
      const m = await hunt(p, (w) => w.metrics()); if (bit) assert(m.weather[bit] > 300 || bit === 'dust' && m.weather.dust > 200, `${kind}: ${JSON.stringify(m.weather)}`); assert(m.calls < 400, `${kind} calls ${m.calls}`);
      assert.match(await p.locator('.hunt-beast-hud small').innerText(), /Rain shower|Mist|Dust storm|Blizzard/); await snapshot(p, `weather-${kind}`);
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

  await check('a tree between the camera and the leader shrinks its canopy away', async (p) => {
    await fresh(p); await start(p, 'puffwart');
    // The default camera sits behind the leader on +z, so a tree 3.5 units behind them is right in its view.
    await hunt(p, (w) => { const g = w.game, tree = g.obstacles.find((o) => o.kind === 'tree'); g.beast.state = 'roam'; g.beast.duration = 30; g.beast.x = -tree.x; g.beast.z = -tree.z; g.hero.x = tree.x; g.hero.z = tree.z - 3.5; });
    await p.waitForFunction(() => window.__hunt().metrics().hiddenCanopies >= 1, null, { timeout: 15000 });
    await snapshot(p, 'canopy-camera');
  });

  await check('alive hunts: Extra Grumpy steam, Enzo sniff pawprints and buddy orders', async (p) => {
    await fresh(p); await start(p);
    // The beast stays in zone 1 until the zone step turns the wander thresholds back on.
    await hunt(p, (w) => { w.game.zoneAt = []; });
    // Buddy orders: hold Tab and tap E; lock-on stays as it was. A plain Tab tap still toggles it.
    const locked = await hunt(p, (w) => w.game.locked);
    await p.keyboard.down('Tab'); await p.keyboard.press('KeyE'); await p.keyboard.up('Tab');
    await p.waitForFunction(() => window.__hunt().game.order === 'gather');
    assert.equal(await hunt(p, (w) => w.game.locked), locked); assert.match(await p.getByTestId('buddy-order').innerText(), /Gather/);
    await p.getByTestId('buddy-order').click(); await p.waitForFunction(() => window.__hunt().game.order === 'close');
    await p.getByTestId('buddy-order').click(); await p.waitForFunction(() => window.__hunt().game.order === 'bonk');
    // Out of sight: the beast far across the meadow gets a pawprint trail within about a second.
    await hunt(p, (w) => { const g = w.game, b = g.beast; b.state = 'rest'; b.t = 0; b.duration = 60; b.x = 0; b.z = -14; g.hero.x = 0; g.hero.z = 4; g.buddy.cooldown = 60; });
    await p.waitForFunction(() => window.__hunt().metrics().pawprints >= 6, null, { timeout: 15000 });
    assert.match(await p.getByTestId('note').innerText(), /pawprints/);
    await snapshot(p, 'sniff-trail');
    // Extra Grumpy: below 30% Grump the ears steam and the HUD says so.
    await hunt(p, (w) => { const g = w.game, b = g.beast; b.x = 0; b.z = -1; g.hero.x = 0; g.hero.z = 4; g.bonkBeast(b.grump - b.maxGrump * 0.25, false, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); b.state = 'roam'; b.t = 0; b.duration = 60; });
    await p.waitForFunction(() => window.__hunt().metrics().steam === true, null, { timeout: 15000 });
    await p.waitForFunction(() => /Extra Grumpy/.test(document.querySelector('.hunt-beast-hud')?.textContent ?? ''));
    await p.waitForTimeout(400); await snapshot(p, 'extra-grumpy');
    assert(await fits(p));
    // Tired: below 20% Grump the beast trudges home and snoozes in its nest, with sleepy puffs; a bonk wakes it.
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.hero.invincible = 60; g.buddy.cooldown = 60; g.bonkBeast(b.grump - b.maxGrump * 0.15, false, { x: b.x - Math.cos(b.face) * 3, z: b.z + Math.sin(b.face) * 3 }); b.state = 'rest'; b.t = 0; b.duration = 0; b.x = g.nest.x + 2; b.z = g.nest.z; g.hero.x = g.nest.x - 5; g.hero.z = g.nest.z; });
    assert.match(await p.getByTestId('note').innerText(), /nest/);
    await p.waitForFunction(() => window.__hunt().game.beast.state === 'snooze', null, { timeout: 30000 });
    await p.waitForFunction(() => { const m = window.__hunt().metrics(); return m.nest && m.sleepy; }, null, { timeout: 15000 });
    await p.waitForTimeout(600); await snapshot(p, 'snooze');
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.bonkBeast(5, false, { x: b.x - 3, z: b.z }); });
    assert.equal(await hunt(p, (w) => w.game.beast.state), 'rest'); assert.match(await p.getByTestId('note').innerText(), /Wake-up/);
    // A visitor: Puffwart wanders into the meadow, squares off with Bristleback inside an orange circle, and the turf bonk leaves it dizzy.
    await hunt(p, (w) => { const g = w.game; g.returnVillage(); g.startHunt('bristleback'); g.roared = g.introduced = true; const b = g.beast; g.buddy.cooldown = 100; b.state = 'rest'; b.duration = 100; b.x = 0; b.z = 0; g.hero.x = 0; g.hero.z = 9; g.huntTime = g.visitAt; });
    await p.waitForFunction(() => window.__hunt().metrics().visitor === true, null, { timeout: 15000 }); assert.match(await p.getByTestId('note').innerText(), /Puffwart wanders in/);
    await hunt(p, (w) => { const g = w.game, v = g.visitor; v.x = 3; v.z = 0; });
    await p.waitForFunction(() => window.__hunt().metrics().turfCircle === true, null, { timeout: 15000 }); await snapshot(p, 'turf');
    await p.waitForFunction(() => window.__hunt().game.beast.state === 'dizzy', null, { timeout: 15000 }); assert.match(await p.getByTestId('note').innerText(), /Turf bonk/);
    // The grab-on vine with real keys: G holds on, two J tickles soften, K yanks.
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.visitor = null; g.visited = true; g.buddy.cooldown = 100; b.state = 'rest'; b.duration = 100; b.height = 0; b.x = 0; b.z = 0; g.hero.x = 0; g.hero.z = 5; g.hero.invincible = 60; g.vineCd = 0; });
    assert.match(await p.getByTestId('vine-status').innerText(), /Vine ready/);
    await p.keyboard.press('KeyG'); await p.waitForFunction(() => window.__hunt().game.vine?.phase === 'cling', null, { timeout: 15000 });
    await p.waitForFunction(() => window.__hunt().metrics().vine === true); assert.match(await p.getByTestId('vine-status').innerText(), /Holding on/);
    // Each tickle holds J for a few frames so a busy frame can't miss it.
    for (let n = 0; n < 2; n++) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(80); await p.keyboard.up('KeyJ'); await p.waitForTimeout(150); }
    await p.waitForFunction(() => window.__hunt().metrics().soft === true, null, { timeout: 15000 }); await snapshot(p, 'vine');
    await p.keyboard.press('KeyK'); await p.waitForFunction(() => !['grabbed', 'yanked'].includes(window.__hunt().game.beast.state), null, { timeout: 15000 });
    assert.equal(await hunt(p, (w) => w.game.vine), null); assert.match(await p.getByTestId('vine-status').innerText(), /coiling/);
    // The slinger: R flicks a pebble at the locked-on beast; it flies, plinks and the count drops.
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.locked = true; b.state = 'rest'; b.duration = 100; b.x = 0; b.z = 0; g.hero.x = 0; g.hero.z = 9; g.pebbles = 5; g.stones = []; });
    const before = await hunt(p, (w) => w.game.beast.grump);
    await p.keyboard.press('KeyR'); await p.waitForFunction(() => window.__hunt().metrics().pebbles > 0, null, { timeout: 15000 }); await snapshot(p, 'sling');
    await p.waitForFunction(() => window.__hunt().game.stones.length === 0, null, { timeout: 15000 });
    assert.equal(await hunt(p, (w) => w.game.pebbles), 4); assert(await hunt(p, (w) => w.game.beast.grump) < before); assert.match(await p.getByTestId('vine-status').innerText(), /4 pebbles/);
    // Hit numbers and sparks: a big bonk on the face shows an orange number.
    await hunt(p, (w) => { const g = w.game, b = g.beast; b.state = 'rest'; b.duration = 100; b.face = -Math.PI / 2; g.hero.x = b.x; g.hero.z = b.z + 2.7; g.fx = []; g.bonkBeast(37, true, g.hero); g.bonkBeast(9, false, { x: b.x, z: b.z - 3 }); });
    await p.waitForFunction(() => { const m = window.__hunt().metrics(); return m.hitDigits >= 3 && m.sparks > 0; }, null, { timeout: 15000 }); await snapshot(p, 'hit-numbers');
    assert.deepEqual(await hunt(p, (w) => w.game.fx.filter((f) => f.kind === 'bonk').map((f) => f.weak)), [true, false]);
    // The area hazard: F beside it shows the orange circle, then it drops on the beast inside.
    await hunt(p, (w) => { const g = w.game, z = g.hazard, b = g.beast; g.fx = []; b.state = 'rest'; b.duration = 100; b.height = 0; b.x = z.x + 1; b.z = z.z; g.hero.x = z.x - 1.5; g.hero.z = z.z; g.hero.invincible = 5; g.buddy.cooldown = 10000; });
    assert.equal(await hunt(p, (w) => w.metrics().hazard.state), 'ready');
    await p.keyboard.press('KeyF'); await p.waitForFunction(() => window.__hunt().metrics().hazard?.circle, null, { timeout: 15000 }); await snapshot(p, 'hazard-warning');
    await p.waitForFunction(() => window.__hunt().metrics().hazard?.state === 'spent', null, { timeout: 15000 }); await snapshot(p, 'hazard');
    assert.equal(await hunt(p, (w) => w.game.beast.state), 'dizzy'); assert.equal(await hunt(p, (w) => w.metrics().hazard.circle), false);
    // A fluff finch hops nearby; walking up to it adds most Fluff, and it flutters away.
    assert.equal(await hunt(p, (w) => w.metrics().finches), 3);
    const max = await hunt(p, (w) => { const g = w.game, f = g.finches[0]; g.hero.x = f.x - 2.5; g.hero.z = f.z; return g.hero.maxFluff; }); await snapshot(p, 'finch');
    await hunt(p, (w) => { const g = w.game, f = g.finches[0]; g.hero.x = f.x - 0.5; g.hero.z = f.z; }); await p.waitForFunction(() => window.__hunt().game.finches[0].caught, null, { timeout: 15000 });
    assert.equal(await hunt(p, (w) => w.game.hero.maxFluff), max + 5); await p.waitForFunction(() => window.__hunt().metrics().finches === 2, null, { timeout: 15000 });
    // Zones: below 70% Grump the beast wanders off down the north path, the path glows, and walking up it travels to zone 2.
    assert.equal(await hunt(p, (w) => w.metrics().paths), 1); assert.equal(await p.locator('.hunt-zones li').count(), 3); assert.match(await p.locator('.hunt-zones .here').innerText(), new RegExp(await hunt(p, (w) => w.game.zoneName)));
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.zoneAt = [0.7, 0.35]; b.state = 'roam'; b.t = 0; b.duration = 100; b.grump = b.maxGrump * 0.6; b.x = 0; b.z = -8; g.hero.x = 6; g.hero.z = 2; g.buddy.cooldown = 10000; });
    await p.waitForFunction(() => window.__hunt().game.beast.state === 'wander', null, { timeout: 15000 }); await snapshot(p, 'zone-wander');
    await p.waitForFunction(() => { const m = window.__hunt().metrics(); return m.openPath && !m.beastShown; }, null, { timeout: 30000 }); await snapshot(p, 'zone-path');
    assert.match(await p.locator('.hunt-beast-hud').innerText(), /Gone to Zone 2/);
    await hunt(p, (w) => { const g = w.game, e = g.exitTo(1); g.hero.x = e.x; g.hero.z = e.z + 3.5; });
    await p.keyboard.down('KeyW'); await p.waitForFunction(() => window.__hunt().game.zone === 1, null, { timeout: 15000 }); await p.keyboard.up('KeyW');
    await p.waitForFunction(() => { const m = window.__hunt().metrics(); return m.zone === 1 && m.beastShown && m.paths === 2; }, null, { timeout: 15000 }); await p.waitForTimeout(800); await snapshot(p, 'zone-2');
    assert.equal((await p.locator('.hunt-zones .here').innerText()).replace(/[\s]+/g, ' ').trim(), `2 ${await hunt(p, (w) => w.game.zoneName)}`);
  });

  await check('painted portraits, tool tiers and material icons load and follow the game', async (p) => {
    await fresh(p, 'enzo');
    await hunt(p, (w) => { w.game.profile.weapons.bow = { tier: 2, branch: null }; w.game.profile.pouch['sky-feather'] = 4; });
    await p.getByTestId('open-forge').click();
    await p.getByTestId('rack-bow').click(); assert.equal(await p.getByTestId('forge-bow-2').innerText(), '✓ Crafted');
    await snapshot(p, 'forge-art'); await p.keyboard.press('Escape');
    await start(p);
    for (const [mood, hero] of [['sleepy', { fluff: 20 }], ['dizzy', { fluff: 100, invincible: 1.4 }], ['happy', { invincible: 0 }]]) {
      await hunt(p, (w, h) => { w.game.paused = true; Object.assign(w.game.hero, h); }, hero);
      await p.locator(`[data-testid="hero-mood"][data-mood="${mood}"]`).waitFor();
    }
    const sheets = await p.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll('.hunt-art')].map((e) => getComputedStyle(e).backgroundImage.slice(5, -2)))];
      return Promise.all(urls.map((url) => new Promise((done) => { const img = new Image(); img.onload = () => done([url.split('/').pop(), img.naturalWidth]); img.onerror = () => done([url, 0]); img.src = url; })));
    });
    assert.deepEqual(Object.fromEntries(sheets), { 'portraits-enzo.webp': 1024, 'icons-gear.webp': 1024, 'icons-items.webp': 1024 });
  });
  await check('pantry: a v1 save migrates, crafting, ring and snack update the pouch, F gathers, and sap, smoke and drop icons render', async (p) => {
    await p.goto(`${base}/hunt`);
    await p.evaluate(() => { localStorage.removeItem('grumble-hunt-v2'); localStorage.removeItem('grumble-hunt-v3'); localStorage.removeItem('grumble-hunt-v4'); localStorage.removeItem('grumble-hunt-v5'); localStorage.removeItem('grumble-hunt-v6'); localStorage.setItem('grumble-hunt-v1', JSON.stringify({ v: 1, seed: 9, profile: { hero: 'dora', levels: { dora: 2, enzo: 1 }, materials: { bristleback: 5, puffwart: 0, skreel: 0, hornclack: 0, frostmane: 0 }, naps: { bristleback: 1 }, won: false, hunts: 3 } })); });
    await p.reload(); await p.locator('main[data-ready="true"][data-rendered="true"]').waitFor(); await p.locator('main[data-mode="village"]').waitFor();
    assert.equal(await hunt(p, (w) => w.game.profile.pouch['bristle-tuft']), 5); assert.equal(await hunt(p, (w) => w.game.profile.weapons.hammer.tier), 2);
    await p.waitForFunction(() => JSON.parse(localStorage.getItem('grumble-hunt-v6') || 'null')?.v === 6);
    await hunt(p, (w) => { w.game.story.chapter = 3; Object.assign(w.game.profile.pouch, { berry: 5, 'marsh-reed': 3 }); });
    await p.getByTestId('open-pantry').click(); await p.getByTestId('panel-pantry').waitFor();
    await p.getByTestId('craft-big-fluffberry').click(); assert.equal(await hunt(p, (w) => w.game.profile.pouch['big-fluffberry']), 1); assert.equal(await p.getByTestId('pouch-berry').innerText(), '3');
    assert.equal(await p.getByTestId('craft-dizzy-bell').isDisabled(), true, 'opens after three beasts nap');
    await p.getByTestId('ring-sleepy-seed').click(); assert.equal(await p.getByTestId('ring-count').innerText(), '5 / 6 in your ring'); await p.getByTestId('ring-pathfinder-acorn').click();
    await p.getByTestId('eat-clover-crunch').click(); assert.equal(await hunt(p, (w) => w.game.profile.snack), 'clover-crunch'); assert.equal(await p.getByTestId('pouch-berry').innerText(), '1');
    await snapshot(p, 'pantry'); await p.keyboard.press('Escape'); await start(p);
    assert.equal(await hunt(p, (w) => w.game.hero.maxFluff), 120); assert.match(await p.locator('.hunt-hero-hud').innerText(), /Clover Crunch/);
    await hunt(p, (w) => { const g = w.game, s = g.spots[0]; g.beast.state = 'rest'; g.beast.duration = 1e9; g.buddy.cooldown = 1e9; g.order = 'close'; g.hero.x = s.x + 1; g.hero.z = s.z; });
    await p.getByTestId('gather').waitFor(); await p.locator('.hunt-canvas').focus(); await p.keyboard.press('f');
    await p.waitForFunction(() => window.__hunt().game.gathering); await snapshot(p, 'gathering');
    await p.waitForFunction(() => window.__hunt().game.spots[0].done); assert.equal(await hunt(p, (w) => w.game.profile.pouch.berry), 3);
    await hunt(p, (w) => { const g = w.game; g.story.chapter = 4; g.profile.pouch['sticky-sap'] = 1; g.profile.pouch['smoke-puffball'] = 1; g.item = g.ring.indexOf('sticky-sap'); });
    await p.keyboard.press('f'); await p.waitForFunction(() => window.__hunt().metrics()?.trap);
    await hunt(p, (w) => { const g = w.game; g.item = g.ring.indexOf('smoke-puffball'); g.drops.push({ id: 9999, x: g.hero.x + 3.5, z: g.hero.z - 1.5, material: 'tusk-shard', count: 1 }); });
    await p.keyboard.press('f'); await p.waitForFunction(() => window.__hunt().metrics()?.smoke); await p.waitForFunction(() => window.__hunt().metrics()?.drops >= 1);
    await snapshot(p, 'sap-smoke-drop');
    await hunt(p, (w) => { const g = w.game, b = g.beast; g.hero.hidden = 0; g.trap = { x: b.x, z: b.z }; });
    await p.waitForFunction(() => window.__hunt().game.beast.state === 'stuck'); await p.waitForTimeout(150); await snapshot(p, 'stuck');
  });
  await check('post-game weapons: locked cards show their goal, then unlock, preview, show icons and hunt', async (p) => {
    const tools = ['feather', 'puffer', 'pogo', 'umbrella'];
    await fresh(p);
    await hunt(p, (w) => { const g = w.game; g.profile.bountiesClaimed = 2; g.profile.totalPlops = 7; g.profile.variantNaps.skreel = 1; });
    await p.getByTestId('open-forge').click(); await p.getByTestId('weapon-rack').waitFor();
    for (const [t, text] of [['feather', 'Complete 5 bounties · 2/5'], ['puffer', 'Extra Grumpy variants · 1/5'], ['pogo', 'Hop-on plops · 7/10'], ['umbrella', 'all five beasts · 0/5']]) {
      const card = p.getByTestId(`rack-${t}`); assert(await card.isDisabled(), t); assert((await card.innerText()).includes(text), `${t}: ${await card.innerText()}`);
    }
    await p.keyboard.press('Escape');
    await hunt(p, (w) => { const g = w.game, parts = { bristleback: 'tusks', puffwart: 'throat sac', skreel: 'crest', hornclack: 'horn cap', frostmane: 'mane tufts' }; g.profile.bountiesClaimed = 5; g.profile.totalPlops = 10; for (const id of Object.keys(parts)) { g.profile.variantNaps[id] = 1; g.profile.beastBook[id].partsBroken = [parts[id]]; } });
    await p.getByTestId('open-forge').click();
    for (const t of tools) {
      await p.getByTestId(`rack-${t}`).click(); assert.equal(await p.getByTestId(`rack-${t}`).isDisabled(), false);
      await p.waitForFunction((t) => document.querySelector('[data-testid="weapon-preview"]')?.dataset.weapon === t, t);
      await p.getByTestId(`forge-${t}-5B`).waitFor(); await snapshot(p, `postgame-forge-${t}`);
    }
    const sheets = await p.evaluate(async () => {
      const urls = [...new Set([...document.querySelectorAll('.hunt-art')].map((e) => getComputedStyle(e).backgroundImage.slice(5, -2)))].filter((u) => /icons-weapons-[56]/.test(u));
      return Promise.all(urls.map((url) => new Promise((done) => { const img = new Image(); img.onload = () => done([url.split('/').pop(), img.naturalWidth]); img.onerror = () => done([url, 0]); img.src = url; })));
    });
    assert.deepEqual(Object.fromEntries(sheets), { 'icons-weapons-5.webp': 1024, 'icons-weapons-6.webp': 1024 });
    await p.keyboard.press('Escape');
    for (const t of tools) {
      await hunt(p, (w, t) => { w.game.equip(t); }, t); await start(p);
      await hunt(p, (w) => { const g = w.game; g.hero.invincible = 99; g.beast.x = g.hero.x; g.beast.z = g.hero.z - 3; g.beast.state = 'rest'; g.beast.duration = 99; });
      await p.getByTestId('postgame-meter').waitFor();
      await p.keyboard.down('k'); await p.waitForTimeout(600);
      if (t === 'umbrella') { assert.equal(await hunt(p, (w) => w.game.hold().kind), 'guard'); assert((await p.getByTestId('charge-status').innerText()).includes('tap J to spin')); }
      await snapshot(p, `postgame-hunt-${t}`); await p.keyboard.up('k'); await p.waitForTimeout(400);
      await p.keyboard.press('j'); await p.waitForTimeout(500);
      assert(await hunt(p, (w) => w.game.beast.grump < w.game.beast.maxGrump), `${t} bonks`);
      assert(await hunt(p, (w) => w.metrics().calls) < 400);
      await p.getByTestId('pause').click(); await p.getByRole('button', { name: 'Return to camp', exact: true }).click(); await p.locator('main[data-mode="village"]').waitFor();
    }
  });
  await check('three-hit strings: the pips fill and the third J lands the tool finisher', async (p) => {
    await fresh(p); await start(p);
    await hunt(p, (w) => { const g = w.game; g.zoneAt = []; g.buddy.cooldown = 1e9; g.hero.invincible = 1e9; g.beast.grump = g.beast.maxGrump = 1e5; g.beast.state = 'rest'; g.beast.duration = 1e9; g.beast.x = g.hero.x; g.beast.z = g.hero.z - 2.7; g.locked = true; });
    const ready = () => p.waitForFunction(() => { const g = window.__hunt().game; return g.hero.cooldown <= 0 && g.hitstop <= 0 && g.hero.swing < 0; });
    for (const step of [1, 2]) { await p.keyboard.down('KeyJ'); await p.waitForTimeout(80); await p.keyboard.up('KeyJ'); await p.waitForFunction((n) => document.querySelector('[data-testid="combo"]')?.getAttribute('data-step') === String(n), step); if (step === 2) await snapshot(p, 'string-two'); await ready(); }
    await p.keyboard.down('KeyJ'); await p.waitForTimeout(80); await p.keyboard.up('KeyJ');
    await p.waitForFunction(() => window.__hunt().game.huntFacts.finishers === 1); assert.match(await p.getByTestId('note').innerText(), /Acorn Upswing/);
    await snapshot(p, 'string-finisher');
    await p.getByTestId('pause').click(); await p.getByRole('button', { name: 'Return to camp', exact: true }).click(); await p.getByTestId('open-forge').click();
    assert.match(await p.getByTestId('weapon-finisher').innerText(), /Acorn Upswing/);
  });
  await check('quest board: a two-beast quest, its HUD line, stars and the result card', async (p) => {
    await fresh(p);
    await hunt(p, (w) => { const g = w.game; g.story.chapter = 6; for (const id of ['bristleback', 'puffwart', 'skreel', 'hornclack', 'frostmane']) { g.profile.beastBook[id].met = true; g.profile.naps[id] = 1; } });
    await p.getByTestId('open-board').click(); assert.match(await p.getByTestId('stars').innerText(), /★ 0/);
    await p.getByTestId('quest-double-meadow').scrollIntoViewIfNeeded(); await snapshot(p, 'quest-board');
    await p.getByTestId('quest-double-meadow').click(); await p.locator('main[data-mode="hunt"]').waitFor();
    assert.match(await p.getByTestId('quest-status').innerText(), /Double Trouble · nap 1 of 2/);
    const calm = () => p.evaluate(`(() => { const g = window.__hunt().game, policy = ${huntPolicy.toString()}; g.paused = false; g.hero.invincible = 1e9; let n = 0; while (g.mode === 'hunt' && n++ < 36000) { g.step(1/60, policy(g)); g.events.length = 0; } while (g.mode === 'nap' && n++ < 40000) g.step(1/60); window.__hunt().refresh(); return g.mode; })()`);
    assert.equal(await calm(), 'hunt', 'the second beast wanders in'); await p.waitForTimeout(200);
    assert.match(await p.getByTestId('quest-status').innerText(), /nap 2 of 2/); assert.equal(await hunt(p, (w) => w.game.beast.id), 'puffwart');
    await snapshot(p, 'quest-second-beast');
    assert.equal(await calm(), 'calm'); await p.getByTestId('result').waitFor();
    assert.match(await p.getByTestId('quest-result').innerText(), /Quest done: Double Trouble! \+2 stars/);
    await snapshot(p, 'quest-result');
    await p.getByTestId('return-village').click(); await p.getByTestId('open-board').click();
    assert.match(await p.getByTestId('stars').innerText(), /★ 2/);
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('grumble-hunt-v6')).profile.quests['double-meadow']), 1);
  });
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
