// Paperfold in the browser: the arcade card and the menu, the first page folded with a real mouse click (the
// chapter tip first), the second with a real drag, undo and reset, then folded by keyboard; a fold blocked by tape;
// progress kept across a reload; a corrupt save; the festival and the ending; the framing at 1280×800 and
// 1920×1080 (the paper, the target card and Dora and Enzo all in view, a clear size and clear of each other and of
// the buttons); and phones held upright and sideways, folding by touch (tap twice, or drag).
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'paperfold-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const state = (page) => page.evaluate(() => window.__fold());
const idle = (page) => page.waitForFunction(() => !window.__fold().busy, null, { polling: 50 });
const pt = (page, x, y) => page.evaluate(([a, b]) => window.__foldPoint(a, b), [x, y]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ids = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];
const saveWith = (done, extra = {}) => JSON.stringify({ v: 1, done: Object.fromEntries(done.map((id) => [id, { seal: 3, best: 1 }])), tips: ['lanterns', 'boats', 'cranes', 'stars', 'night', ...ids], ended: false, settings: { sound: false, music: false }, ...extra });
async function dismissTip(page) { const t = page.locator('.pf-tip button'); if (await t.count()) await t.click(); }
async function solvedPanel(page) { await page.locator('.pf-result').waitFor(); return page.locator('.pf-result-card').textContent(); }

/** Checks the paper, the target card and Dora and Enzo are on screen, a clear size and clear of each other and the buttons. */
async function framing(page, label, minChin) {
  await idle(page);
  const r = await page.evaluate(() => {
    const s = window.__foldScene(), c = document.querySelector('.pf-canvas').getBoundingClientRect();
    const tools = document.querySelector('.pf-tools')?.getBoundingClientRect(), bar = document.querySelector('.pf-bar')?.getBoundingClientRect();
    return { s, c: { x: c.left, y: c.top }, W: innerWidth, H: innerHeight, tools: tools && { x0: tools.left, x1: tools.right, y0: tools.top, y1: tools.bottom }, top: bar?.bottom ?? 0 };
  });
  const { s } = r, box = (b) => ({ x0: r.c.x + b.x, y0: r.c.y + b.y, x1: r.c.x + b.x + b.w, y1: r.c.y + b.y + b.h });
  const chin = (d) => ({ x0: r.c.x + d.x - d.h * 0.42, x1: r.c.x + d.x + d.h * 0.42, y0: r.c.y + d.y - d.h * 0.92, y1: r.c.y + d.y });
  const inView = (b) => b.x0 >= -2 && b.y0 >= r.top - 2 && b.x1 <= r.W + 2 && b.y1 <= r.H + 2;
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const paper = box(s.paper), card = box(s.card), dora = chin(s.dora), enzo = chin(s.enzo);
  for (const [n, b] of [['paper', paper], ['target card', card], ['Dora', dora], ['Enzo', enzo]]) assert.ok(inView(b), `${label}: the ${n} is in view (${[b.x0, b.y0, b.x1, b.y1].map(Math.round)} in ${r.W}×${r.H})`);
  assert.ok(s.dora.h >= minChin && s.enzo.h >= minChin, `${label}: Dora and Enzo are a clear size (${Math.round(s.dora.h)}px)`);
  assert.ok(s.cell >= (s.tall ? 40 : 70), `${label}: the paper squares are a good size (${Math.round(s.cell)}px)`);
  for (const [n, b] of [['Dora', dora], ['Enzo', enzo], ['the card', card]]) {
    assert.equal(overlap(b, paper), 0, `${label}: ${n} is clear of the paper`);
    if (r.tools) assert.ok(overlap(b, r.tools) < 0.06 * (b.x1 - b.x0) * (b.y1 - b.y0), `${label}: ${n} is clear of the buttons`);
  }
  if (r.tools) assert.equal(overlap(paper, r.tools), 0, `${label}: the paper is clear of the buttons`);
  assert.ok(overlap(dora, enzo) === 0, `${label}: Dora and Enzo don’t overlap`);
  assert.ok(await noSideScroll(page), `${label}: no sideways scrolling`);
}

try {
  // ---- the arcade card, the menu
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 65);
  await page.locator('a.arcade-card[href="/fold"]').click();
  await ready(page);
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Paperfold');
  await page.getByRole('button', { name: /Start folding/ }).click();
  await page.waitForFunction(() => window.__fold().id === 'l1');
  assert.match(await page.locator('.pf-tip').textContent(), /Fold to match/, 'the chapter tip teaches folding');
  await page.locator('.pf-tip button').click();
  assert.match(await page.locator('.pf-toast').textContent(), /right half/, 'the page tip');
  await framing(page, '1280×800', 150);

  // ---- First Fold: hover the right half to see the fold, then click it
  let [x, y] = await pt(page, 1.6, 0.5);
  await page.mouse.move(x, y);
  await page.waitForTimeout(150);
  [x, y] = await pt(page, 1.6, 0.5);
  await page.mouse.click(x, y);
  assert.match(await solvedPanel(page), /gold seal/i, 'one fold in par is a gold seal');
  assert.equal((await state(page)).save.done.l1.seal, 3);
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/e2e-solved.png` : '/dev/null' }).catch(() => {});

  // ---- Corner to Corner: a real drag, undo, reset, then by keyboard
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.waitForFunction(() => window.__fold().id === 'l2');
  await dismissTip(page); await idle(page);
  const [ax, ay] = await pt(page, 1, 1.7), [bx, by] = await pt(page, 1, 0.3);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, (ay + by) / 2, { steps: 5 }); await page.mouse.move(bx, by, { steps: 5 }); await page.mouse.up();
  await page.waitForFunction(() => window.__fold().folds === 1);
  assert.equal((await state(page)).layers, 2, 'the bottom half folded up onto the top');
  await idle(page);
  await page.getByRole('button', { name: /Undo/ }).click();
  let st = await state(page); assert.equal(st.history, 0, 'undo'); assert.equal(st.folds, 1, 'undone folds still count');
  await page.getByRole('button', { name: /Reset/ }).click();
  assert.equal((await state(page)).folds, 0, 'reset');
  assert.ok(await page.getByRole('button', { name: /Hint/ }).count(), 'after a reset the hint is offered');
  await page.getByRole('button', { name: /Hint/ }).click();
  assert.ok((await state(page)).hint, 'the hint shows a fold');
  await page.locator('.pf-canvas').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('a'); await idle(page);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('w');
  assert.match(await solvedPanel(page), /gold seal/i, 'folded by keyboard in par');

  // ---- progress across a reload
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /Continue/ }).textContent(), /1-3/, 'the menu continues at page 1-3');
  await page.getByRole('button', { name: /The book/ }).click();
  assert.equal(await page.locator('.pf-page.is-done').count(), 2, 'two pages folded in the book');
  assert.equal(await page.locator('.pf-page:disabled').count(), 4, 'two open ahead, the rest locked');

  // ---- tape blocks a fold
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(ids.slice(0, 24))]);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /The book/ }).click();
  await page.locator('.pf-tab', { hasText: 'Stars' }).click();
  await page.locator('.pf-page', { hasText: 'Taped Together' }).click();
  await page.waitForFunction(() => window.__fold().id === 's1'); await idle(page);
  [x, y] = await pt(page, 0.5, 0.5);
  await page.mouse.move(x, y); await page.mouse.click(x, y);
  await page.locator('.pf-toast', { hasText: /Tape/ }).waitFor();
  assert.equal((await state(page)).folds, 0, 'a blocked fold doesn’t count');

  // ---- 1920×1080 framing on the biggest sheet
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(ids.slice(0, 39))]);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.waitForFunction(() => window.__fold().id === 'n8'); await dismissTip(page);
  await framing(page, '1920×1080', 220);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/e2e-1920.png` });

  // ---- the finale, the ending and the festival
  for (const t of (await state(page)).solution) { await idle(page); await page.evaluate((f) => window.__foldDo(f), t); }
  await solvedPanel(page);
  await page.getByRole('button', { name: 'Light the lanterns' }).click();
  await page.locator('.pf-ending').waitFor();
  assert.match(await page.locator('.pf-ending').textContent(), /lanterns are lit/);
  assert.equal((await state(page)).save.ended, true);
  await page.getByRole('button', { name: 'See the festival' }).click();
  await page.waitForFunction(() => window.__foldScene().festival);
  assert.match(await page.locator('.pf-bar').textContent(), /40 of 40/);

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"done":{"l1":{"seal":"gold"}},"tips":7'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /Start folding/ }).isVisible(), 'a corrupt save starts afresh');
  await page.context().close();

  // ---- phones: upright and sideways, folding by touch
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const ph = await open(vp, true), label = `${vp.width}×${vp.height}`;
    await ph.goto(base + '/fold'); await ready(ph);
    assert.ok(await noSideScroll(ph), `${label}: the menu fits`);
    if (process.env.SHOTS) await ph.screenshot({ path: `${process.env.SHOTS}/e2e-menu-${label}.png` });
    await ph.getByRole('button', { name: /Start folding/ }).tap();
    await ph.waitForFunction(() => window.__fold().id === 'l1');
    await ph.locator('.pf-tip button').tap();
    await framing(ph, label, vp.height > vp.width ? 110 : 90);
    if (process.env.SHOTS) await ph.screenshot({ path: `${process.env.SHOTS}/e2e-play-${label}.png` });
    [x, y] = await pt(ph, 1.6, 0.5);
    await ph.touchscreen.tap(x, y);
    await ph.locator('.pf-toast', { hasText: /Tap again/ }).waitFor();
    assert.equal((await state(ph)).folds, 0, 'the first tap only shows the fold');
    await ph.waitForTimeout(350);
    await ph.touchscreen.tap(x, y);
    assert.match(await solvedPanel(ph), /gold seal/i, `${label}: the second tap folds`);
    await ph.getByRole('button', { name: 'Next page' }).tap();
    await ph.waitForFunction(() => window.__fold().id === 'l2'); await dismissTip(ph); await idle(ph);
    // a drag with a finger
    const cdp = await ph.context().newCDPSession(ph);
    const [x0, y0] = await pt(ph, 1.7, 1), [x1, y1] = await pt(ph, 0.3, 1);
    const touch = (type, tx, ty) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: tx, y: ty, id: 1 }] });
    await touch('touchStart', x0, y0); for (let i = 1; i <= 8; i++) await touch('touchMove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8); await touch('touchEnd');
    await ph.waitForFunction(() => window.__fold().folds === 1);
    assert.equal((await state(ph)).layers, 2, `${label}: a finger drag folds`);
    await ph.context().close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Paperfold e2e');
} finally {
  await browser.close();
}
