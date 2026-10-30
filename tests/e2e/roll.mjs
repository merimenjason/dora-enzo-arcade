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
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const g = window.__roll?.()?.game; return g ? { mode: g.mode, level: g.spec.id, r: g.ball.r, left: g.left } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
const fresh = async (page, save) => {
  await page.goto(`${base}/roll`); await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('fluff-roll-v1', JSON.stringify(s)); }, save ?? null);
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
};
const play = async (page, n = 0) => { await page.getByRole('button', { name: /^Roll in/ }).nth(n).click(); await page.locator('main[data-rendered="true"]').waitFor({ timeout: 60000 }); };
const state = (page) => page.evaluate(() => { const s = window.__roll(), g = s.game; return g && { mode: g.mode, level: g.spec.id, r: g.ball.r, x: g.ball.x, z: g.ball.z, stuck: g.stuck.length, left: g.left, metrics: s.metrics }; });

await check('the arcade lists Fluff Roll and opens the level menu', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 58);
  await page.getByRole('link', { name: /Fluff Roll/ }).click();
  await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.locator('main').getAttribute('data-screen'), 'menu');
  assert.equal(await page.locator('.roll-levels li').count(), 4);
  assert.equal(await page.getByRole('button', { name: 'Roll in Dust Bath Corner' }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Locked' }).count(), 3, 'only the first level starts open');
  assert.match(await page.locator('.roll-book').innerText(), /Fluffbook: 0 of \d+/);
});

await check('the keys skip the intro and roll things up, and the HUD names what comes next', async (page) => {
  await fresh(page); await play(page);
  assert.equal((await state(page)).mode, 'intro');
  await page.keyboard.press('Space'); assert.equal((await state(page)).mode, 'roll');
  // headless browsers draw slowly, so wait on the game's own clock
  await page.keyboard.down('ArrowUp'); await page.waitForFunction(() => window.__roll().game.left < 180 - 5, null, { timeout: 60000 }); await page.keyboard.up('ArrowUp');
  const s = await state(page);
  assert.ok(Math.hypot(s.x, s.z) > 0.5, `the ball rolled (${s.x}, ${s.z})`);
  assert.ok(s.stuck >= 5, `it picked things up (${s.stuck})`);
  assert.match(await page.locator('.roll-next').innerText(), /^Next up: .+ at \d+ cm$/);
  assert.ok(s.metrics.calls < 450, `draw calls ${s.metrics.calls}`);
});

await check('dragging works like a joystick', async (page) => {
  await fresh(page); await play(page);
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 640, y: 500 } }); // skips the intro
  await page.mouse.move(640, 500); await page.mouse.down(); await page.mouse.move(640, 420, { steps: 4 });
  assert.ok(await page.locator('.roll-pad').isVisible(), 'the stick shows');
  await page.waitForTimeout(2500); await page.mouse.up();
  const s = await state(page); assert.ok(Math.hypot(s.x, s.z) > 0.3, 'the drag rolled the ball');
  assert.equal(await page.locator('.roll-pad').count(), 0, 'the stick goes when let go');
});

await check('things too big to roll up are ringed, and a bump says how big they need', async (page) => {
  await fresh(page); await play(page); await page.keyboard.press('Space');
  // park the ball beside the dust-bath tub
  const park = () => page.evaluate(() => { const g = window.__roll().game, t = g.things.find((o) => o.kind === 'tub'); g.ball.x = t.x - t.r - g.ball.r - 0.05; g.ball.z = t.z; g.ball.vx = 0.4; g.ball.vz = 0; g.heading = 0; });
  await park(); await page.waitForTimeout(400);
  assert.ok((await state(page)).metrics.rings >= 1, 'the tub has a ring');
  await park(); await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => /Too big for now! A dust-bath tub sticks at \d/.test(document.querySelector('.roll-caught')?.textContent ?? ''), null, { timeout: 20000 });
  await page.keyboard.up('ArrowUp');
});

await check('Escape pauses and the clock stops', async (page) => {
  await fresh(page); await play(page); await page.keyboard.press('Space');
  await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const a = (await state(page)).left; await page.waitForTimeout(800);
  assert.equal((await state(page)).left, a);
  await page.getByRole('button', { name: 'Keep rolling' }).click();
  await page.waitForTimeout(600); assert.ok((await state(page)).left < a);
});

await check('reaching the goal at the bell gives stars, opens the next level and saves', async (page) => {
  await fresh(page); await play(page); await page.keyboard.press('Space');
  await page.evaluate(() => { const g = window.__roll().game; for (let i = 0; i < 3000 && g.ball.r < g.spec.goal * 1.05; i++) { const t = g.target(); if (!t) break; g.ball.x = t.x; g.ball.z = t.z; g.step(1 / 60); } g.left = 0.05; });
  await page.locator('[aria-label="Level result"]').waitFor();
  assert.match(await page.locator('.roll-panel h2').innerText(), /What a fluffball!/);
  assert.ok(await page.locator('.roll-panel .roll-stars .is-on').count() >= 1);
  assert.match(await page.locator('.roll-unlock').innerText(), /Clover Garden is open!/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('fluff-roll-v1')));
  assert.deepEqual(saved.unlocked, ['corner', 'garden']); assert.ok(saved.best.corner >= 0.2 && saved.stars.corner >= 1);
  await page.getByRole('button', { name: 'Next: Clover Garden' }).click();
  await page.waitForFunction(() => window.__roll().game?.spec.id === 'garden');
});

await check('the last level loads and stays within its budget', async (page) => {
  await fresh(page, { unlocked: ['corner', 'garden', 'yard', 'meadow'] }); await play(page, 3);
  await page.keyboard.press('Space'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2000); await page.keyboard.up('ArrowUp');
  const s = await state(page); assert.equal(s.level, 'meadow'); assert.ok(s.metrics.calls < 450, `draw calls ${s.metrics.calls}`);
});

await check('on a phone the HUD fits and nothing scrolls sideways', async (page) => {
  await fresh(page); await play(page); await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, hud: [...document.querySelectorAll('.roll-hud > *')].map((e) => e.getBoundingClientRect().right) }));
  assert.ok(fit.scroll <= fit.width, 'no sideways scroll');
  assert.ok(Math.max(...fit.hud) <= fit.width + 1, `the HUD fits (${fit.hud.join(', ')})`);
}, { width: 390, height: 760 }, { hasTouch: true, isMobile: true });

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`\nFluff Roll e2e: ${failures.length} failed`); process.exit(1); }
console.log('\nFluff Roll e2e: all checks passed');
