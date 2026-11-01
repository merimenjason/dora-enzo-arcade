// Tidepool in the browser: the menu; the first minutes played with the real mouse (looking closely at creatures to
// sketch them, bringing the hermit crab in from the basket, planting by keyboard tool choice, shooing a gull, the
// speed buttons and pausing the tide); the journal's pages, field guide and food web; the pool saved across a reload
// and picked up again; a corrupt save; turning the season and laying the plank; the spring tide, the ending and the
// free pool's season picker; the framing at 1280×800 and 1920×1080 with Dora and Enzo a clear size and clear of the
// tray and panel; and phones held upright and sideways played by touch, with no page errors.
// Needs `npm run dev` (BASE_URL, default http://localhost:3000) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'tidepool-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
const T = (page, fn, arg) => page.evaluate(fn, arg);
const at = (page, x, y) => T(page, ([a, b]) => window.__tideAt(a, b), [x, y]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Where a creature of a kind is on screen right now (the nth one). */
const where = (page, sp, n = 0) => T(page, ([s, i]) => { const a = window.__tide().agents.filter((q) => q.sp === s)[i]; return a ? window.__tideAt(a.x, a.y - 1) : null; }, [sp, n]);
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.w && a.y < b.y + b.height && b.y < a.y + a.h;
async function play(page) { await page.locator('.tp-go').first().click(); await page.locator('main[data-screen="play"]').waitFor(); await page.waitForTimeout(300); }

{
  const page = await open();
  await page.goto(base + '/tide'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Tide\s*pool/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.match(await page.locator('.tp-go').innerText(), /START/);
  assert.ok(await page.getByRole('button', { name: /Free pool/ }).isDisabled(), 'the free pool waits for the spring tide');
  console.log('PASS the menu loads and hydrates');

  await play(page);
  await T(page, () => { /* hold the tide while the mouse works */ });
  await page.getByRole('button', { name: 'Pause the tide' }).click();
  // look closely: click an anemone, a limpet and a shrimp with the real mouse
  for (const sp of ['anemone', 'limpet', 'mussel']) { const p = await where(page, sp); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(80); }
  const sk = await T(page, () => window.__tide().sketch);
  assert.ok(sk.anemone >= 1 && sk.limpet >= 1 && sk.mussel >= 1, `three sketches started (${JSON.stringify(sk)})`);
  assert.ok(await page.locator('.tp-note').isVisible(), 'a field note opens beside the pool');
  await page.getByRole('button', { name: 'Speed 1×' }).click(); await page.waitForTimeout(800);
  assert.ok(await T(page, () => !!window.__tide().done[1]), 'the first page is done');
  assert.ok(await page.locator('.tp-page[data-page="1"].is-done').isVisible());
  console.log('PASS looking closely with the mouse sketches creatures and finishes the first page');

  // bring the hermit crab in from the basket
  await page.getByRole('button', { name: 'Bring in: Hermit crab' }).click();
  const [hx, hy] = await at(page, 82, 78); await page.mouse.click(hx, hy);
  await page.waitForFunction(() => window.__tide().count('hermit') === 1);
  await page.waitForFunction(() => !!window.__tide().done[2]);
  assert.equal(await T(page, () => window.__tide().basket.hermit), 0);
  // pick the planting tool by key and plant on the sand
  await page.keyboard.press('4');
  const w0 = await T(page, () => window.__tide().weeds.length), [px, py] = await at(page, 40, 78);
  await page.mouse.move(px, py); await page.mouse.click(px, py);
  assert.equal(await T(page, () => window.__tide().weeds.length), w0 + 1, 'planted a seedling');
  await page.keyboard.press('1');
  console.log('PASS bringing the hermit crab in and planting by keyboard tool choice');

  // the speed buttons and pausing the tide
  let t0 = await T(page, () => window.__tide().tick); await page.keyboard.press('Space'); await page.waitForTimeout(400);
  let t1 = await T(page, () => window.__tide().tick); await page.waitForTimeout(400);
  assert.equal(await T(page, () => window.__tide().tick), t1, 'Space stops the tide');
  await page.getByRole('button', { name: 'Speed 4×' }).click(); t0 = await T(page, () => window.__tide().tick); await page.waitForTimeout(1000);
  t1 = await T(page, () => window.__tide().tick); assert.ok(t1 - t0 > 20, `4× runs fast (${t1 - t0} steps in a second)`);
  await page.getByRole('button', { name: 'Speed 1×' }).click();
  // a gull: wait for one to eye the pool, then click it
  await T(page, () => { const g = window.__tide(); let i = 0; while (i++ < 3000 && !g.gulls.some((q) => q.st === 'eye')) window.__tideRun(1); });
  await page.getByRole('button', { name: 'Pause the tide' }).click();
  const gp = await T(page, () => { const q = window.__tide().gulls.find((x) => x.st === 'eye'); return window.__tideAt(q.x, q.y); });
  await page.mouse.click(gp[0], gp[1]);
  assert.equal(await T(page, () => window.__tide().stats.shoos), 1, 'a click shoos the gull');
  console.log('PASS the speed buttons, pausing the tide, and shooing a gull with a click');

  // the journal
  await page.keyboard.press('j');
  const book = page.getByRole('dialog', { name: 'The journal' }); await book.waitFor();
  assert.equal(await book.locator('.tp-season-col').count(), 4);
  await page.getByRole('tab', { name: /Field guide/ }).click(); assert.equal(await book.locator('.tp-entry').count(), 11);
  await page.getByRole('tab', { name: /Food web/ }).click(); assert.ok(await book.locator('svg.tp-web').isVisible());
  await page.getByRole('button', { name: 'Close the journal' }).click(); await book.waitFor({ state: 'detached' });
  console.log('PASS the journal: pages by season, the field guide and the food web');

  // saved across a reload
  await T(page, () => window.__tideSave());
  const before = await T(page, () => ({ tick: window.__tide().tick, sk: window.__tide().sketch, done: Object.keys(window.__tide().done) }));
  await page.reload(); await ready(page);
  assert.match(await page.locator('.tp-go').innerText(), /CONTINUE/);
  await play(page);
  const after = await T(page, () => ({ tick: window.__tide().tick, sk: window.__tide().sketch, done: Object.keys(window.__tide().done) }));
  assert.ok(after.tick >= before.tick && after.tick - before.tick < 60, 'the pool picks up where it was');
  assert.deepEqual(after.sk, before.sk); assert.deepEqual(after.done, before.done);
  console.log('PASS the pool is saved and picked up again after a reload');

  // turning the season and laying the plank at low tide
  await T(page, () => { const g = window.__tide(); for (const id of [3, 4, 5]) g.finishPage(id); window.__tideRun(6); });
  await page.getByRole('button', { name: /On to Summer/ }).click();
  await page.getByRole('dialog', { name: /Summer begins/ }).waitFor();
  await page.getByRole('button', { name: 'To the pool →' }).click();
  await T(page, () => { const g = window.__tide(); let i = 0; while (i++ < 2000 && g.connected) window.__tideRun(1); });
  await page.getByRole('button', { name: 'Plank' }).click();
  assert.ok(await T(page, () => window.__tide().plank), 'the plank goes down');
  console.log('PASS turning to summer, and the plank at low tide');

  // the spring tide and the ending, then the free pool's season picker
  await T(page, () => { const g = window.__tide(); g.plank = false; g.setSeason(3); for (const id of [19, 20, 21, 22]) g.finishPage(id); window.__tideRun(6); });
  await page.getByRole('button', { name: 'To the pool →' }).click().catch(() => {});
  await page.getByRole('button', { name: /spring tide/ }).click();
  await T(page, () => window.__tideRun(900));
  await page.getByRole('dialog', { name: 'The spring tide' }).waitFor();
  assert.ok(await T(page, () => window.__tide().ended));
  assert.equal(await T(page, () => JSON.parse(localStorage.getItem('tidepool-v1')).ended), true, 'the ending is saved');
  await page.getByRole('button', { name: 'Free pool →' }).click();
  await page.locator('main[data-screen="free"]').waitFor();
  assert.equal(await page.locator('.tp-card').count(), 4, 'four seasons to pick from');
  await page.getByRole('button', { name: 'Free pool in Summer' }).click();
  await page.locator('main[data-screen="play"]').waitFor();
  assert.deepEqual(await T(page, () => window.__tide().mode), { kind: 'free', season: 1 });
  console.log('PASS the spring tide, the ending, and the free pool by season');
  await page.context().close();
}

{
  // a corrupt save never breaks the page
  const page = await open();
  await page.goto(base + '/tide'); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"run":{"v":1,"agents":"lots"},"settings":7'), KEY);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.tp-go').innerText(), /START/);
  await play(page);
  assert.ok(await T(page, () => window.__tide().agents.length > 5));
  console.log('PASS a corrupt save is ignored');

  // desktop framing
  for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp); await page.waitForTimeout(600);
    const m = await T(page, () => window.__tideScene()), stage = await page.locator('.tp-stage').boundingBox();
    const side = await page.locator('.tp-side').boundingBox(), tray = await page.locator('.tp-tray').boundingBox();
    for (const ch of m.chins) {
      const r = { x: stage.x + ch.x, y: stage.y + ch.y, w: ch.w, h: ch.h };
      assert.ok(ch.h >= 80, `${ch.who} is a clear size at ${vp.width}×${vp.height} (${Math.round(ch.h)} px)`);
      assert.ok(r.x >= -2 && r.y >= stage.y - 2 && r.x + r.w <= side.x + 2 && !overlap(r, tray), `${ch.who} is on screen and clear of the panel and tray ${JSON.stringify({ r, stage, side, tray })}`);
    }
    const pool = m.pool;
    assert.ok(pool.w > vp.width * 0.45, `the pool fills the screen (${Math.round(pool.w)} px wide)`);
    assert.ok(stage.x + pool.x + pool.w <= side.x + 2 && stage.y + pool.y + pool.h <= tray.y + 4, 'the pool is clear of the panel and tray');
    assert.ok(await noSideScroll(page));
  }
  console.log('PASS the desktop framing at 1280×800 and 1920×1080');
  await page.context().close();
}

for (const [label, viewport] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
  const page = await open(viewport, true);
  await page.goto(base + '/tide'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the ${label} menu`);
  await page.locator('.tp-go').tap();
  await page.locator('main[data-screen="play"]').waitFor(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Pause the tide' }).tap();
  const p = await where(page, 'anemone'); await page.touchscreen.tap(p[0], p[1]);
  assert.equal(await T(page, () => window.__tide().sketch.anemone), 1, 'a tap looks closely');
  await page.getByRole('button', { name: 'Bring in: Hermit crab' }).tap();
  const [hx, hy] = await at(page, 80, 78); await page.touchscreen.tap(hx, hy);
  assert.equal(await T(page, () => window.__tide().count('hermit')), 1, 'a tap brings the hermit crab in');
  const m = await T(page, () => window.__tideScene()), stage = await page.locator('.tp-stage').boundingBox();
  const side = await page.locator('.tp-side').boundingBox(), tray = await page.locator('.tp-tray').boundingBox();
  for (const b of [side, tray]) assert.ok(b.x >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1, `the panels fit (${label})`);
  const pool = { x: stage.x + m.pool.x, y: stage.y + m.pool.y, w: m.pool.w, h: m.pool.h };
  assert.ok(pool.x >= -1 && pool.x + pool.w <= viewport.width + 1 && pool.y >= stage.y - 1, `the whole pool is on screen (${label})`);
  assert.ok(!overlap(pool, tray) && !overlap(pool, side), `the tray and panel leave the pool clear (${label})`);
  for (const ch of m.chins) {
    const r = { x: stage.x + ch.x, y: stage.y + ch.y, w: ch.w, h: ch.h };
    assert.ok(ch.h >= 36, `${ch.who} reads clearly on a phone held ${label} (${Math.round(ch.h)} px)`);
    assert.ok(r.x >= -2 && r.x + r.w <= viewport.width + 2 && r.y >= stage.y - 2 && !overlap(r, tray) && !overlap(r, side), `${ch.who} is on screen and uncovered (${label}) ${JSON.stringify({ r, stage, side, tray })}`);
  }
  const barH = (await page.locator('.tp-top').boundingBox()).height; assert.ok(barH <= 50, `the bar stays slim (${barH})`);
  const wrap = await page.evaluate(() => [...document.querySelectorAll('.tp-tool span')].some((s) => s.getBoundingClientRect().height > 22));
  assert.ok(!wrap, 'tool labels never wrap');
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone held ${label}: tap to look, tap to bring a creature in, everything framed`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS Tidepool in the browser');
