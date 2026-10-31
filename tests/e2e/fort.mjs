// Pillow Fort in the browser: the arcade card and the menu, the first night built with a real mouse (aim, click to
// drop) and the keyboard (arrows, turn, Space, B for bedtime), the result and its save; restart; progress kept across
// a reload; a corrupt save; the nights screen with locked nights; the free build shelf; the ending; the framing at
// 1280×800 and 1920×1080 (Dora and Enzo in view, a clear size, clear of the rug, the buttons and each other); and
// phones held upright and sideways, building by touch (drag to aim, the Drop button).
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'pillow-fort-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const state = (page) => page.evaluate(() => window.__fort());
const canDrop = (page) => page.waitForFunction(() => window.__fort().canDrop, null, { polling: 50 });
const pt = (page, x) => page.evaluate((a) => window.__fortPoint(a), x);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const ids = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 't1', 't2', 't3', 't4', 't5', 't6'];
const saveWith = (done, extra = {}) => JSON.stringify({ v: 1, best: Object.fromEntries(done.map((id) => [id, { stars: 2, height: 3, used: 6 }])), tips: [...ids, 'sandbox'], ended: false, settings: { sound: false, music: false }, ...extra });
async function dismissTip(page) { const t = page.locator('.pw-tip button'); if (await t.count()) await t.click(); }

/** Checks Dora and Enzo are on screen, a clear size, off the rug and clear of each other and of the buttons. */
async function framing(page, label, minChin) {
  const r = await page.evaluate(() => {
    const s = window.__fortScene(), c = document.querySelector('.pw-canvas').getBoundingClientRect();
    const rect = (q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return b && b.width ? { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom } : null; };
    return { s, c: { x: c.left, y: c.top }, W: innerWidth, H: innerHeight, tools: rect('.pw-tools'), basket: rect('.pw-basket'), top: document.querySelector('.pw-bar')?.getBoundingClientRect().bottom ?? 0 };
  });
  const { s } = r, box = (b) => ({ x0: r.c.x + b.x + b.w * 0.18, x1: r.c.x + b.x + b.w * 0.82, y0: r.c.y + b.y + b.h * 0.08, y1: r.c.y + b.y + b.h });
  const inView = (b) => b.x0 >= -2 && b.y0 >= r.top - 2 && b.x1 <= r.W + 2 && b.y1 <= r.H + 2;
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const dora = box(s.dora), enzo = box(s.enzo);
  const fort = { x0: r.c.x + s.rug.x0 + 0.4 * s.s, x1: r.c.x + s.rug.x1 - 0.4 * s.s, y0: r.top, y1: r.c.y + s.rug.y };
  for (const [n, b] of [['Dora', dora], ['Enzo', enzo]]) {
    assert.ok(inView(b), `${label}: ${n} is in view (${[b.x0, b.y0, b.x1, b.y1].map(Math.round)} in ${r.W}×${r.H})`);
    assert.equal(overlap(b, fort), 0, `${label}: ${n} is clear of the fort`);
    for (const [m, o] of [['buttons', r.tools], ['basket', r.basket]]) if (o) assert.ok(overlap(b, o) < 0.06 * area(b), `${label}: ${n} is clear of the ${m}`);
  }
  assert.ok(s.dora.h >= minChin && s.enzo.h >= minChin, `${label}: Dora and Enzo are a clear size (${Math.round(s.dora.h)}px)`);
  assert.ok(s.s >= (s.tall ? 28 : 50), `${label}: the fort is a good size (${Math.round(s.s)}px a unit)`);
  assert.equal(overlap(dora, enzo), 0, `${label}: Dora and Enzo don’t overlap`);
  assert.ok(await noSideScroll(page), `${label}: no sideways scrolling`);
}

try {
  // ---- the arcade card, the menu
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 63);
  await page.locator('a.arcade-card[href="/fort"]').click();
  await ready(page);
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Pillow Fort');
  await page.getByRole('button', { name: /Start building/ }).click();
  await page.waitForFunction(() => window.__fort().night === 'l1');
  assert.match(await page.locator('.pw-tip').textContent(), /pillow fort/i, 'the first night teaches building');
  await page.locator('.pw-tip button').click();
  await framing(page, '1280×800', 150);

  // ---- First cushions: aim with the real mouse and click to drop
  for (const x of [-0.6, -0.5, -0.55]) {
    await canDrop(page);
    const [px, py] = await pt(page, x);
    await page.mouse.move(px, py, { steps: 4 });
    assert.ok(Math.abs((await state(page)).held.x - x) < 0.2, 'the mouse aims the piece');
    await page.mouse.click(px, py);
  }
  await page.waitForFunction(() => window.__fort().used === 3);
  // ...and the keyboard: arrows aim, a cushion only goes flat, Space drops
  await canDrop(page);
  const before = (await state(page)).held.x;
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  assert.ok(Math.abs((await state(page)).held.x - before - 0.5) < 0.01, 'the arrows move the piece');
  await page.keyboard.press('ArrowUp');
  assert.ok(Math.abs((await state(page)).held.rot) > 0, 'up turns the piece');
  await page.keyboard.press('q');
  assert.ok(Math.abs((await state(page)).held.rot) < 1e-6, 'Q turns it back');
  const [kx, ky] = await pt(page, -0.55); await page.mouse.move(kx, ky);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__fort().used === 4);
  await page.waitForFunction(() => window.__fort().pieces === 4 && window.__fort().top > 2, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press('b');
  await page.locator('.pw-check').waitFor();
  await page.locator('.pw-result').waitFor({ timeout: 20000 });
  let s = await state(page);
  assert.ok(s.result.stars >= 1, `four cushions stand past the line (${s.result.height.toFixed(2)})`);
  assert.ok(s.save.best.l1, 'the night is saved');
  assert.equal(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).best.l1.stars, s.result.stars);
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/e2e-result.png` : '/dev/null' }).catch(() => {});

  // ---- build again, then restart with R
  await page.getByRole('button', { name: 'Build again' }).click();
  await page.waitForFunction(() => window.__fort().used === 0 && window.__fort().phase === 'build');
  await canDrop(page); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__fort().used === 1);
  await page.keyboard.press('r');
  await page.waitForFunction(() => window.__fort().used === 0 && window.__fort().pieces === 0);

  // ---- progress across a reload, and the nights screen
  await page.reload(); await ready(page);
  assert.match(await page.locator('.pw-menu-buttons .pw-primary').textContent(), /Continue · Night 2/);
  await page.getByRole('button', { name: /The nights/ }).click();
  const cards = page.locator('.pw-card');
  assert.equal(await cards.count(), 6);
  assert.equal(await cards.nth(1).isDisabled(), false, 'the next night is open');
  assert.equal(await cards.nth(2).isDisabled(), true, 'the one after is locked');
  assert.equal(await page.locator('.pw-tab').nth(1).isDisabled(), true, 'the attic is locked');
  await cards.nth(1).click();
  await page.waitForFunction(() => window.__fort().night === 'l2');
  await dismissTip(page);
  await page.keyboard.press('Escape');
  await page.locator('.pw-cards').waitFor();

  // ---- a corrupt save starts afresh
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"best":{"l1":{"stars":"lots"}},"tips":7'), KEY);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.pw-menu-buttons .pw-primary').textContent(), /Start building/);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, '{"v":1,"best":{"zz":{"stars":9},"l1":{"stars":9,"height":"x"}},"settings":null}']);
  await page.reload(); await ready(page);
  s = await state(page);
  assert.ok(!s.save.best.zz && (!s.save.best.l1 || s.save.best.l1.stars <= 3), 'bad entries are dropped');

  // ---- free build: pick from the shelf and drop
  await page.getByRole('button', { name: 'Free build' }).click();
  await page.waitForFunction(() => window.__fort().sandbox);
  await dismissTip(page);
  await page.locator('.pw-shelf-item[aria-label="Teapot"]').click();
  assert.equal((await state(page)).held.kind, 'teapot');
  await canDrop(page); await page.locator('.pw-drop').click();
  await page.waitForFunction(() => window.__fort().pieces === 1);

  // ---- the ending
  await page.evaluate(() => window.__fortEnding());
  await page.locator('.pw-ending').waitFor();
  assert.match(await page.locator('.pw-ending-card').textContent(), /grandest fort/);
  await page.close();

  // ---- the framing on a big screen, with a tall fort
  const wide = await open({ width: 1920, height: 1080 });
  await wide.goto(base + '/fort'); await ready(wide);
  await wide.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(ids.slice(0, 18))]);
  await wide.reload(); await ready(wide);
  await wide.getByRole('button', { name: /The nights/ }).click();
  await wide.locator('.pw-tab').nth(3).click();
  await wide.locator('.pw-card').first().click();
  await wide.waitForFunction(() => window.__fort().night === 't1');
  await dismissTip(wide);
  for (let i = 0; i < 6; i++) { await canDrop(wide); await wide.keyboard.press('Space'); await wide.waitForTimeout(300); }
  await wide.waitForTimeout(800);
  await framing(wide, '1920×1080', 200);
  await wide.close();

  // ---- phones: upright and sideways, by touch
  for (const [vp, label] of [[{ width: 390, height: 844 }, 'phone upright'], [{ width: 844, height: 390 }, 'phone sideways']]) {
    const p = await open(vp, true);
    await p.goto(base + '/fort'); await ready(p);
    assert.ok(await noSideScroll(p), `${label}: the menu fits`);
    await p.locator('.pw-menu-buttons .pw-primary').tap();
    await p.waitForFunction(() => window.__fort().night === 'l1');
    await p.locator('.pw-tip button').tap();
    await framing(p, label, label.includes('upright') ? 90 : 70);
    // drag a finger across the room to aim, then tap Drop
    await canDrop(p);
    const [ax, ay] = await pt(p, -1.5), [bx] = await pt(p, 1);
    await p.locator('.pw-canvas').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: ax, clientY: ay, isPrimary: true, button: 0 });
    for (let i = 1; i <= 5; i++) await p.locator('.pw-canvas').dispatchEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: ax + ((bx - ax) * i) / 5, clientY: ay, isPrimary: true });
    await p.locator('.pw-canvas').dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: bx, clientY: ay, isPrimary: true, button: 0 });
    let st = await state(p);
    assert.ok(Math.abs(st.held.x - 1) < 0.2, `${label}: a drag aims the piece (${st.held.x.toFixed(2)})`);
    assert.equal(st.used, 0, `${label}: lifting the finger does not drop`);
    await p.locator('.pw-drop').tap();
    await p.waitForFunction(() => window.__fort().used === 1);
    await canDrop(p); await p.locator('.pw-drop').tap();
    await p.waitForFunction(() => window.__fort().used === 2);
    await p.waitForTimeout(800);
    await p.locator('.pw-bed').tap();
    await p.waitForFunction(() => window.__fort().phase !== 'build');
    st = await state(p);
    assert.ok(st.phase === 'check' || st.phase === 'over', `${label}: Bedtime starts the check`);
    await p.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Pillow Fort browser suite: all checks passed');
} finally {
  await browser.close();
}
