import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch(), errors = [];
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const inspect = (p) => p.evaluate(() => window.__express().stage.inspect());
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(20000);
  await page.goto(`${base}/express`); await page.getByTestId('tutorial').click();
  await page.waitForFunction(() => window.__express().stage.inspect().waiting[0]?.count === 5);
  let view = await inspect(page);
  assert.deepEqual(view.waiting[0], { count: 5, visible: 5, overflow: 0 });
  assert.deepEqual(view.waiting[3], { count: 0, visible: 0, overflow: 0 }, 'empty stations draw no fixed passengers');
  assert.ok(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => r.name.endsWith('/stations-empty.png'))), 'the dry empty-building atlas is loaded');
  await page.evaluate(() => { const t = window.__express(); for (let i = 0; i < 6; i++) t.game.passenger(0, 'hay'); t.advance(0); });
  await page.waitForFunction(() => window.__express().stage.inspect().waiting[0]?.count === 11);
  view = await inspect(page); assert.deepEqual(view.waiting[0], { count: 11, visible: 8, overflow: 3 });

  await page.getByTestId('menu').click(); await page.getByTestId('tutorial').click(); await page.getByTestId('pause').click();
  const editor = page.getByTestId('editor'); if (await editor.getAttribute('open') === null) await editor.locator('summary').click();
  for (const i of [0, 1, 2, 3]) await page.getByTestId(`station-${i}`).click();
  await page.getByTestId('pause').click();
  await page.evaluate(() => window.__express().advance(1));
  view = await inspect(page);
  assert.ok(view.transits.some((x) => x.type === 'board'), 'actual boarding events start hop animations');
  assert.equal(new Set(view.transits.map((x) => x.id)).size, view.transits.length, 'a passenger has at most one presentation animation');
  const pure = await page.evaluate(() => { const t = window.__express(), before = t.game.save(); t.stage.update(.1, t.game); return before === t.game.save(); });
  assert.ok(pure, 'animation never edits the deterministic game or its passenger counts');
  await page.waitForFunction(() => window.__express().stage.inspect().waiting[0]?.count === 1);
  assert.equal((await inspect(page)).waiting[0].visible, 1, 'boarded passengers leave the waiting group');
  await page.getByTestId('pause').click();
  const clock = (await inspect(page)).clock; await page.waitForTimeout(200); assert.equal((await inspect(page)).clock, clock, 'pause freezes decorative animation');
  await page.getByTestId('pause').click();
  const leaving = await page.evaluate(() => {
    const t = window.__express();
    for (let i = 0; i < 400; i++) { t.advance(.05); const v = t.stage.inspect(); if (v.transits.some((x) => x.type === 'alight')) return { seen: true, time: t.game.time, paused: t.game.paused }; }
    return { seen: false, time: t.game.time, paused: t.game.paused };
  });
  assert.ok(leaving.seen, `delivery produces a leaving-cart animation (${JSON.stringify(leaving)})`);
  const powder = await page.evaluate(() => { const t = window.__express(); for (let i = 0; i < 500; i++) { t.advance(.05); if (t.stage.inspect().dustBursts > 0) return true; } return false; });
  assert.ok(powder, 'a dry dust-bath delivery makes powder particles');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !window.__express().stage.inspect().motion);
  const before = await page.evaluate(() => ({ time: window.__express().game.time, clock: window.__express().stage.inspect().clock }));
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({ time: window.__express().game.time, clock: window.__express().stage.inspect().clock }));
  assert.equal(after.clock, before.clock); assert.ok(after.time > before.time, 'reduced motion leaves gameplay running');
  assert.equal((await inspect(page)).transits.length, 0);
  await page.reload(); await page.getByTestId('resume').click();
  await page.waitForFunction(() => Object.keys(window.__express().stage.inspect().waiting).length === 4);
  const resumed = await page.evaluate(() => { const t = window.__express(), v = t.stage.inspect(); return t.game.active.every((s) => v.waiting[s.id].count === s.queue.length); });
  assert.ok(resumed, 'saved queues return with the same live counters, not stale animation state');
  assert.deepEqual(errors, []);
  console.log('PASS Burrow Express animations: live zero/overflow queues, boarding, alighting, identity, simulation independence, pause, dry powder, reduced motion and saved counters.');
} finally { await browser.close(); }
