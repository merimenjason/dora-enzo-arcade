import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/putt', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 800 }, options = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view, ...options });
  page.setDefaultTimeout(30000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) {
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const g = window.__putt?.()?.game; return g ? { mode: g.mode, hole: g.hole.id, strokes: g.strokes, ball: g.ball } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
const fresh = async (page) => { await page.goto(`${base}/putt`); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); };
const game = (page, fn, arg) => page.evaluate(`(() => { const s = window.__putt(), out = (${fn})(s.game, ${JSON.stringify(arg ?? null)}); s.refresh(); return out; })()`);
const mode = (page, want) => page.waitForFunction((m) => window.__putt()?.game?.mode === m, want, { timeout: 30000 });
const practise = async (page, n) => { await page.locator('.putt-holes button').nth(n).click(); await page.locator('main[data-rendered="true"]').waitFor(); };

await check('the arcade lists Puttering Paws and opens the clubhouse', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 46);
  await page.getByRole('link', { name: /Puttering Paws/ }).click();
  await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.locator('main').getAttribute('data-screen'), 'menu');
  assert.equal(await page.getByRole('button', { name: 'Play the Clover Nine' }).isEnabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Locked' }).isDisabled(), true, 'the Lantern Nine starts locked');
  assert.equal(await page.locator('.putt-holes button').count(), 9);
  assert.match(await page.locator('.putt-acorn-row').innerText(), /0\/18/);
});

await check('a practice hole putts with a drag, rolls, and drops on its recorded line', async (page) => {
  await fresh(page); await practise(page, 0);
  await page.locator('canvas').click({ position: { x: 640, y: 400 } }); await mode(page, 'aim');
  // drag back from the ball, straight towards the camera, and let go
  await page.waitForTimeout(800);
  const at = await page.evaluate(() => { const s = window.__putt(); return s.screenPoint(s.game.ball.x, s.game.ball.z); });
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x, at.y + 60, { steps: 5 });
  const aimed = await game(page, '(g) => ({ ...g.aim })'); assert(aimed.power > 0.03, `drag set power ${aimed.power}`);
  await page.mouse.up(); await mode(page, 'roll');
  assert.equal(await game(page, '(g) => g.strokes'), 1);
  await mode(page, 'aim');
  // now replay the hole's recorded line from the tee with the keyboard's Space
  const line = await game(page, '(g) => { g.restAt(g.hole.tee.x, g.hole.tee.z, 0, 0); return g.hole.spec.proof; }');
  for (const [a, p] of line) { await game(page, '(g, s) => g.setAim(s[0] * Math.PI / 180, s[1])', [a, p]); await page.keyboard.press('Space'); await page.waitForFunction(() => ['aim', 'sunk', 'card'].includes(window.__putt().game.mode) && window.__putt().game.mode !== 'roll'); }
  await page.locator('[aria-label="Practice result"]').waitFor();
  assert.match(await page.locator('[aria-label="Practice result"]').innerText(), /Hole in one|Birdie|Par/);
  await page.screenshot({ path: '.checks/putt/practice-card.png' });
  await page.getByRole('button', { name: 'Clubhouse' }).click();
  assert.match(await page.locator('.putt-holes button').first().innerText(), /best/);
});

await check('arrow keys aim and set power, V shows the whole hole, Escape pauses', async (page) => {
  await fresh(page); await practise(page, 3);
  await page.keyboard.press('Space'); await mode(page, 'aim');
  const before = await game(page, '(g) => ({ ...g.aim })');
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
  const after = await game(page, '(g) => ({ ...g.aim })');
  assert(after.angle !== before.angle, 'turned'); assert(after.power > before.power, 'more power');
  await page.keyboard.press('KeyV'); await page.getByRole('button', { name: 'Back to ball' }).waitFor();
  await page.screenshot({ path: '.checks/putt/overview.png' });
  await page.keyboard.press('KeyV'); await page.getByRole('button', { name: 'Whole hole' }).waitFor();
  await page.keyboard.press('Escape'); await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const clock = await game(page, '(g) => g.clock'); await page.waitForTimeout(300); assert.equal(await game(page, '(g) => g.clock'), clock, 'paused');
  await page.getByRole('button', { name: 'Keep putting' }).click(); await page.getByRole('dialog', { name: 'Paused' }).waitFor({ state: 'detached' });
});

await check('a course round saves between putts and carries on from the clubhouse', async (page) => {
  await fresh(page);
  await page.getByRole('radio', { name: /Both, taking turns/ }).click();
  await page.getByRole('button', { name: 'Play the Clover Nine' }).click(); await page.locator('main[data-rendered="true"]').waitFor();
  await game(page, '(g) => { g.skipIntro(); g.setAim(-Math.PI / 2, 0.15); g.putt(); }'); await mode(page, 'aim');
  const where = await game(page, '(g) => ({ x: g.ball.x, z: g.ball.z, hero: g.hero })');
  assert.equal(where.hero, 'dora');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Carry on with your round' }).click(); await page.locator('main[data-rendered="true"]').waitFor();
  const back = await game(page, '(g) => ({ x: g.ball.x, z: g.ball.z, strokes: g.strokes, players: g.players })');
  assert.deepEqual(back, { x: where.x, z: where.z, strokes: 1, players: ['dora', 'enzo'] });
});

await check('the Lantern Nine opens after a Clover round and draws its dusk course', async (page) => {
  await fresh(page);
  await page.evaluate(() => localStorage.setItem('puttering-paws-v1', JSON.stringify({ finished: ['clover'], courseBest: { clover: 22 } })));
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  await page.getByRole('button', { name: 'Play the Lantern Nine' }).click(); await page.locator('main[data-rendered="true"]').waitFor();
  await game(page, '(g) => g.skipIntro()'); await page.waitForTimeout(1200);
  assert.equal(await game(page, '(g) => g.hole.id'), 'lantern-1');
  const m = await page.evaluate(() => window.__putt().metrics);
  assert(m.calls < 500, `draw calls ${m.calls}`); assert(m.triangles < 150000, `triangles ${m.triangles}`);
  await page.screenshot({ path: '.checks/putt/lantern.png' });
});

await check('the phone layout fits, and a touch drag putts', async (page) => {
  await fresh(page);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'menu fits');
  await page.screenshot({ path: '.checks/putt/phone-menu.png' });
  await practise(page, 1); await page.locator('canvas').tap({ position: { x: 195, y: 420 } }); await mode(page, 'aim'); await page.waitForTimeout(800);
  const at = await page.evaluate(() => { const s = window.__putt(); return s.screenPoint(s.game.ball.x, s.game.ball.z); });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: at.x, y }] });
  await touch('touchStart', at.y); for (let i = 1; i <= 5; i++) await touch('touchMove', at.y + i * 14); await touch('touchEnd');
  await mode(page, 'roll');
  const m = await page.evaluate(() => window.__putt().metrics);
  assert(m.calls < 450, `phone draw calls ${m.calls}`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'hud fits');
  await page.screenshot({ path: '.checks/putt/phone-play.png' });
}, { width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });

await check('leaving the game frees the renderer', async (page) => {
  await fresh(page); await practise(page, 0);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Clubhouse' }).click();
  await page.getByRole('link', { name: /MAIN ARCADE/ }).click(); await page.waitForSelector('.arcade-grid');
  assert.equal(await page.evaluate(() => typeof window.__putt), 'undefined');
});

await browser.close();
if (errors.length) { console.error(errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`Puttering Paws browser suite: ${failures.length} failed`); process.exit(1); }
console.log('Puttering Paws browser suite passed.');
