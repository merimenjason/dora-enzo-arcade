import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
async function check(name, fn, view = { width: 1280, height: 800 }, options = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view, ...options });
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) {
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const g = window.__haven?.()?.game; return g ? { meadow: g.meadow.id, tick: g.tick, pop: g.pop, purse: g.purse, buildings: g.buildings.size } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
const fresh = async (page, save) => {
  await page.goto(`${base}/pawhaven`); await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('pawhaven-v1', JSON.stringify(s)); }, save ?? null);
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
};
/** Starts a meadow from the menu and closes the brief. */
const play = async (page, n = 0) => {
  await page.locator('.haven-meadows li').nth(n).getByRole('button', { name: 'Start' }).click();
  await page.locator('main[data-rendered="true"]').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: "Let's build!" }).click();
};
const state = (page) => page.evaluate(() => { const h = window.__haven(), g = h.game; return g && { meadow: g.meadow.id, tick: g.tick, speed: g.speed, pop: g.pop, purse: g.purse, buildings: g.buildings.size, tool: h.tool, selected: h.selected }; });
/** The screen point at the middle of tile (x, y). */
const at = (page, x, y) => page.evaluate(([x, y]) => window.__haven().toScreen(x + 0.5, y + 0.5), [x, y]);
/** The way in and a step inwards from it, so tests can build beside the entry on any map. */
const entry = (page) => page.evaluate(() => { const g = window.__haven().game, N = g.size, x = g.entry % N, y = Math.floor(g.entry / N); return { x, y, dx: x === 0 ? 1 : x === N - 1 ? -1 : 0, dy: y === 0 ? 1 : y === N - 1 ? -1 : 0 }; });

await check('the arcade lists Pawhaven and opens the meadow menu', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 45);
  await page.getByRole('link', { name: /Pawhaven/ }).click();
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
  await page.evaluate(() => localStorage.removeItem('pawhaven-v1')); await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.locator('main').getAttribute('data-screen'), 'menu');
  assert.equal(await page.locator('.haven-meadows li').count(), 8);
  assert.equal(await page.getByRole('button', { name: 'Start' }).count(), 2, 'Clover Landing and the free meadow start open');
  assert.equal(await page.locator('.haven-slots').count(), 0, 'no saved towns yet');
});

await check('the brief holds the clock, then the town runs and the speed keys work', async (page) => {
  await fresh(page);
  await page.locator('.haven-meadows li').first().getByRole('button', { name: 'Start' }).click();
  await page.locator('main[data-rendered="true"]').waitFor({ timeout: 60000 });
  await page.getByRole('dialog', { name: 'Clover Landing' }).waitFor();
  assert.match(await page.locator('.haven-say').first().innerText(), /DORA/i);
  await page.waitForTimeout(500);
  assert.equal((await state(page)).tick, 0, 'the clock waits for the brief');
  await page.getByRole('button', { name: "Let's build!" }).click();
  await page.waitForFunction(() => window.__haven().game.tick > 5);
  await page.locator('canvas').focus();
  await page.keyboard.press('Space'); assert.equal((await state(page)).speed, 0);
  const t = (await state(page)).tick; await page.waitForTimeout(400); assert.equal((await state(page)).tick, t, 'paused');
  await page.keyboard.press('Digit3'); assert.equal((await state(page)).speed, 4);
  await page.keyboard.press('KeyR'); assert.equal((await state(page)).tool, 'road');
  await page.keyboard.press('Escape'); assert.equal((await state(page)).tool, null);
});

await check('dragging lays a road, a tap builds a well, and tapping it shows what it is', async (page) => {
  await fresh(page); await play(page);
  await page.locator('canvas').focus(); await page.keyboard.press('Space');
  const e = await entry(page), purse = (await state(page)).purse;
  await page.evaluate(([x, y]) => window.__haven().look(x, y), [e.x + e.dx * 4, e.y + e.dy * 4]);
  await page.locator('.haven-tabs').getByRole('button', { name: /Roads/ }).click();
  await page.locator('.haven-drawer').getByRole('button', { name: /^Road/ }).click();
  const a = await at(page, e.x + e.dx, e.y + e.dy), b = await at(page, e.x + e.dx * 6, e.y + e.dy * 6);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  const roads = await page.evaluate(([e]) => { const g = window.__haven().game; let n = 0; for (let k = 1; k <= 6; k++) if (g.road[(e.y + e.dy * k) * g.size + e.x + e.dx * k] === 1) n++; return n; }, [e]);
  assert.equal(roads, 6, 'six road tiles from the way in');
  assert.equal((await state(page)).purse, purse - 12);
  // a well beside the road: one tile to the side of the third road tile
  const wx = e.x + e.dx * 3 + e.dy, wy = e.y + e.dy * 3 + e.dx;
  const tabs = page.locator('.haven-tabs');
  await tabs.getByRole('button', { name: /Water/ }).click(); await page.getByRole('button', { name: /^Well/ }).click();
  const w = await at(page, wx, wy); await page.mouse.click(w.x, w.y);
  const s = await state(page);
  assert.equal(s.buildings, 1); assert.equal(s.tool, null, 'a placed building is picked out and the tool put away');
  await page.getByRole('complementary', { name: 'Well' }).waitFor();
  await page.getByRole('button', { name: 'Close' }).click(); assert.equal((await state(page)).selected, 0);
  await page.mouse.click(w.x, w.y);
  assert.ok((await state(page)).selected > 0, 'tapping it picks it out again');
  // building on water says why, kindly
  const water = await page.evaluate(() => { const g = window.__haven().game; const i = g.terrain.indexOf(2); return { x: i % g.size, y: Math.floor(i / g.size) }; });
  await page.evaluate(([x, y]) => window.__haven().look(x, y), [water.x, water.y]);
  // the drawer stays open after building, so the well is one tap away
  await page.getByRole('button', { name: /^Well/ }).click();
  const q = await at(page, water.x, water.y); await page.mouse.click(q.x, q.y);
  assert.match(await page.locator('.haven-toast').innerText(), /water/i);
});

await check('homes fill up and a town is saved and carried on', async (page) => {
  await fresh(page); await play(page);
  const e = await entry(page);
  await page.evaluate(([e]) => {
    const g = window.__haven().game;
    for (let k = 1; k <= 8; k++) { g.build('road', e.x + e.dx * k, e.y + e.dy * k); for (const s of [-1, 1]) g.build('home', e.x + e.dx * k + e.dy * s, e.y + e.dy * k + e.dx * s); }
    g.setSpeed(4);
  }, [e]);
  // a month at full speed is 300 ticks, 7.5 s of game time; headless draws slowly, so wait on the clock
  await page.waitForFunction(() => window.__haven().game.tick > 320, null, { timeout: 90000 });
  const s = await state(page);
  assert.ok(s.pop > 0, `newcomers moved in (${s.pop})`);
  await page.getByRole('button', { name: 'Meadows' }).click();
  await page.locator('.haven-slots li').first().waitFor();
  assert.match(await page.locator('.haven-slots li').first().innerText(), /Clover Landing/);
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Carry on' }).click();
  await page.locator('main[data-rendered="true"]').waitFor({ timeout: 60000 });
  const r = await state(page);
  assert.equal(r.meadow, 'clover'); assert.equal(r.buildings, s.buildings); assert.ok(r.tick >= s.tick, 'the clock carries on from the save');
  assert.equal(await page.getByRole('dialog').count(), 0, 'no brief when carrying on');
});

await check('finishing a meadow gives stars and opens the next one', async (page) => {
  await fresh(page); await play(page);
  await page.evaluate(() => {
    const g = window.__haven().game;
    // pretend the town has grown: ten Snug Burrows and sixty chinchillas, checked on the next goal tick
    let n = 0;
    for (let i = 0; i < g.size * g.size && n < 10; i++) { const r = g.build('home', i % g.size, Math.floor(i / g.size)); if (r.ok) { const h = g.buildings.get(r.id); h.level = 3; h.pop = 6; n++; } }
    g.pop = 60; g.tick = 49; g.step();
  });
  await page.getByRole('dialog', { name: 'Meadow finished' }).waitFor();
  assert.match(await page.locator('.haven-big-stars').getAttribute('aria-label'), /^[123] of 3 stars$/);
  await page.getByRole('button', { name: 'On to Willow Bend' }).click();
  await page.getByRole('dialog', { name: 'Willow Bend' }).waitFor();
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('pawhaven-v1')));
  assert.equal(p.open, 2); assert.ok(p.stars.clover >= 1);
  assert.equal(p.towns.filter(Boolean).length, 2, 'the finished town and the new one both keep a slot');
});

await check('trade routes open from Clayfoot Brook', async (page) => {
  await fresh(page, { open: 4, stars: { clover: 3, willow: 2, sandy: 1 }, best: {}, towns: [null, null, null] });
  assert.equal(await page.getByRole('button', { name: 'Start' }).count(), 5);
  assert.equal(await page.locator('.haven-meadows li').first().locator('.haven-stars').getAttribute('aria-label'), '3 of 3 stars');
  await play(page, 3);
  await page.getByRole('button', { name: 'Trade' }).click();
  const dialog = page.getByRole('dialog', { name: 'Trade' });
  await dialog.getByText(/Build a trading post/).waitFor();
  const purse = (await state(page)).purse;
  await dialog.getByRole('button', { name: /Open road · 100/ }).click();
  assert.equal((await state(page)).purse, purse - 100);
  await dialog.getByRole('combobox', { name: 'berries trade' }).selectOption('export');
  assert.deepEqual(await page.evaluate(() => window.__haven().game.trade.berries), { mode: 'export', n: 20 });
});

await check('the phone layout fits, and a full set of slots asks which town to replace', async (page) => {
  await fresh(page); await play(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
  await page.getByRole('button', { name: /Homes/ }).click();
  await page.getByRole('button', { name: /^Home plot/ }).waitFor();
  const box = await page.locator('.haven-palette').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, 'the build bar fits');
  const save = await page.evaluate(() => { const h = window.__haven(); return JSON.parse(JSON.stringify(h.profile.towns[0])); });
  await fresh(page, { open: 1, stars: {}, best: {}, towns: [save, save, save] });
  await page.locator('.haven-meadows li').first().getByRole('button', { name: 'Start' }).click();
  await page.getByRole('dialog', { name: 'Choose a slot' }).waitFor();
  await page.getByRole('button', { name: /Clover Landing · year 1/ }).nth(1).click();
  await page.getByRole('dialog', { name: 'Clover Landing' }).waitFor();
  assert.equal(await page.evaluate(() => window.__haven().slot), 1);
}, { width: 390, height: 844 }, { isMobile: true, hasTouch: true });

await browser.close();
if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exitCode = 1; }
if (failures.length) { console.error(`${failures.length} failed`); process.exitCode = 1; }
