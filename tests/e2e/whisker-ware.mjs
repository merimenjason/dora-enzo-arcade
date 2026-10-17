import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/whisker-ware', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) {
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const r = window.__ware?.()?.run; return r ? { phase: r.phase, game: r.game, lives: r.lives, last: r.last, t: r.state?.t } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
const fresh = async (page) => { await page.goto(`${base}/whisker-ware`); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); };
const ware = (page, fn, arg) => page.evaluate(`(() => { const w = window.__ware(); return (${fn})(w, ${JSON.stringify(arg ?? null)}); })()`);
const state = (page) => ware(page, (w) => { const r = w.run; return r && { phase: r.phase, game: r.game, lives: r.lives, last: r.last, mode: r.mode, s: r.state }; });
/** Clicks a point given in stage units (480 × 320). */
const clickStage = async (page, x, y) => { const r = await ware(page, (w) => w.stage()); await page.mouse.click(r.x + (x * r.w) / 480, r.y + (y * r.h) / 320); };
const startHost = async (page, host = 0) => { await page.getByTestId(`host-${host}`).click(); await page.locator('main[data-phase="break"]').waitFor(); };
const force = (page, id, level = 1, tier = 0) => ware(page, (w, a) => w.force(a[0], a[1], a[2]), [id, level, tier]);
/** Wins a forced SNIFF by clicking the cup that hides the raisin. */
async function winSniff(page) {
  await page.waitForFunction(() => window.__ware().run.state?.open);
  const s = (await state(page)).s;
  await clickStage(page, s.cups[s.raisin].x, 200);
  await page.waitForFunction(() => window.__ware().run.last === 'win' || window.__ware().run.state?.result === 'win');
}

await check('the menu opens on a fresh profile with only Enzo unlocked', async (page) => {
  await fresh(page);
  for (let h = 0; h < 4; h++) assert.equal(await page.getByTestId(`host-${h}`).isEnabled(), h === 0, `host ${h}`);
  assert.equal(await page.getByTestId('remix').isEnabled(), false);
});

await check('winning and losing in a stage', async (page) => {
  await fresh(page); await startHost(page);
  await force(page, 'sniff');
  await winSniff(page);
  await page.locator('main[data-phase="break"]').waitFor();
  let s = await state(page);
  assert.equal(s.last, 'win'); assert.equal(s.lives, 4);
  await page.screenshot({ path: '.checks/whisker-ware/break-enzo.png' });
  await force(page, 'stuff');
  await page.waitForFunction(() => window.__ware().run.last === 'lose', null, { timeout: 15000 });
  s = await state(page); assert.equal(s.lives, 3);
  await page.locator('main[data-phase="micro"]').waitFor();
});

await check('keyboard: SORT by arrows', async (page) => {
  await fresh(page); await startHost(page);
  await force(page, 'sort');
  for (let k = 0; k < 8; k++) {
    const h = await page.waitForFunction(() => { const r = window.__ware().run; return r.last ? 'done' : r.state?.item?.kind; });
    const kind = await h.jsonValue();
    if (kind === 'done') break;
    await page.keyboard.press(kind === 'acorn' ? 'ArrowRight' : 'ArrowLeft');
    await page.waitForFunction((n) => { const r = window.__ware().run; return r.last || r.state.done > n; }, (await state(page)).s.done);
  }
  assert.equal((await state(page)).last, 'win');
});

await check('a pointer released outside the canvas lets go', async (page) => {
  await fresh(page); await startHost(page, 0);
  await force(page, 'fluff');
  await page.waitForFunction(() => window.__ware().run.state?.t > 50);
  const r = await ware(page, (w) => w.stage());
  await page.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.down();
  await page.waitForFunction(() => window.__ware().run.state?.held === true);
  await page.mouse.move(2, 2); await page.mouse.up();
  await page.waitForFunction(() => window.__ware().run.state?.held !== true, null, { timeout: 2000 });
});

await check('a hidden tab pauses the game', async (page) => {
  await fresh(page); await startHost(page);
  await force(page, 'shelf');
  await page.waitForFunction(() => window.__ware().run.state?.t > 10);
  const before = await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); return window.__ware().run.state.t; });
  await page.waitForTimeout(1000);
  const after = await page.evaluate(async () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((done) => requestAnimationFrame(() => done()));
    return window.__ware().run.state.t;
  });
  assert.ok(after - before <= 4, `t moved ${after - before} ticks across the return`);
});

await check('a resize mid-game keeps clicks on target', async (page) => {
  await fresh(page); await startHost(page);
  await force(page, 'sniff');
  await page.setViewportSize({ width: 844, height: 390 });
  await winSniff(page);
});

await check('every microgame draws at its hardest', async (page) => {
  await fresh(page); await startHost(page);
  const ids = await ware(page, (w) => w.ids);
  assert.equal(ids.length, 24);
  for (const id of ids) {
    await force(page, id, 3, 5);
    await page.evaluate(() => new Promise((done) => { let n = 0; const f = () => (++n >= 40 ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    const lit = await page.evaluate(() => {
      const c = document.querySelector('canvas[data-testid="stage"]'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 997) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
      return seen.size;
    });
    assert.ok(lit > 4, `${id} draws something (${lit} colours)`);
  }
  await force(page, 'pick', 1, 0); await page.waitForTimeout(1200); await page.screenshot({ path: '.checks/whisker-ware/pick.png' });
  await force(page, 'balance', 1, 0); await page.waitForTimeout(1200); await page.screenshot({ path: '.checks/whisker-ware/balance.png' });
  await force(page, 'sneak', 1, 0); await page.waitForTimeout(1200); await page.screenshot({ path: '.checks/whisker-ware/sneak.png' });
  await force(page, 'catch', 1, 0); await page.waitForTimeout(400); await page.screenshot({ path: '.checks/whisker-ware/command.png' });
});

await check('the gallery shows best speeds and opens Practice', async (page) => {
  await fresh(page);
  await page.getByTestId('gallery').click();
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 24);
  assert.equal(await page.getByTestId('practice-sniff').isEnabled(), false);
  await page.getByTestId('back').click();
  await startHost(page);
  await force(page, 'sniff');
  await winSniff(page);
  await page.locator('main[data-phase="break"]').waitFor();
  await page.getByTestId('quit').click();
  await page.getByTestId('gallery').click();
  assert.match(await page.getByTestId('card-sniff').innerText(), /×1\.0/);
  await page.getByTestId('practice-sniff').click();
  await page.locator('main[data-phase="break"]').waitFor();
  const s = await state(page);
  assert.equal(s.mode, 'practice'); assert.equal(s.lives, 1); assert.equal(s.game, 'sniff');
});

for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
  await check(`the stage fits ${view.width} × ${view.height} with no scroll`, async (page) => {
    await fresh(page); await startHost(page);
    const fit = await page.evaluate(() => ({ w: document.documentElement.scrollWidth <= innerWidth + 1, h: document.documentElement.scrollHeight <= innerHeight + 1 }));
    assert.deepEqual(fit, { w: true, h: true });
    const r = await ware(page, (w) => w.stage());
    assert.ok(Math.abs(r.w / r.h - 1.5) < 0.02, `3:2 stage, got ${r.w} × ${r.h}`);
    await page.screenshot({ path: `.checks/whisker-ware/fit-${view.width}.png` });
  }, view);
}

await check('mute toggles and is remembered', async (page) => {
  await fresh(page);
  await page.getByTestId('mute').click();
  assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: '.checks/whisker-ware/menu.png' });
});

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log('PASS Whisker Ware in the browser');
