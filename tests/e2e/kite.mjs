// Kite Day in the browser: the menu and the summer map, First Flight flown to the finish with the real mouse (the
// pointer steers, the left button pulls in, the right button lets line out), the keyboard (turning, pulling, easing,
// walking, pausing), the medal saved across a reload, a corrupt save, the framing at 1280×800 and 1920×1080 (the kite
// and its flier on screen, Dora a clear size and nothing covering her), and phones held either way, flown by touch.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'kite-day-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const game = (page, fn, arg) => page.evaluate(fn, arg);
const kite = (page) => game(page, () => { const f = window.__kite(); if (!f) return null; const k = f.me; return { x: k.x, y: k.y, hx: k.hx, hy: k.hy, L: k.L, psi: k.psi, state: k.state, done: f.done, won: f.won, t: f.t, obj: f.objective() }; });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const clear = async (page) => { await page.goto(base + '/kite'); await ready(page); await game(page, (k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page); };
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// ---------------------------------------------------------------- the menu, the map, First Flight with the real mouse
{
  const page = await open();
  await clear(page);
  ok(await page.getByRole('heading', { name: 'Kite Day' }).isVisible(), 'the title');
  ok(await noSideScroll(page), 'no sideways scroll on the menu');
  await page.getByRole('button', { name: 'Start the summer' }).click();
  ok(await page.getByRole('button', { name: /Clover Meadow/ }).isEnabled(), 'the meadow is open');
  ok(await page.getByRole('button', { name: /Apple Orchard/ }).isDisabled(), 'the orchard waits');
  await page.getByRole('button', { name: /Clover Meadow/ }).click();
  await page.getByRole('listitem').filter({ hasText: 'First Flight' }).getByRole('button', { name: 'Fly' }).click();
  await page.waitForFunction(() => window.__kiteScreen() === 'play');
  ok(await page.locator('.kd-coach').isVisible(), 'the first flight explains the controls');
  // fly it: point at the next ring, hold the left button to pull in when the line is too long, the right to let it out
  let held = null;
  const press = async (b) => { if (held === b) return; if (held) await page.mouse.up({ button: held }); held = b; if (b) await page.mouse.down({ button: b }); };
  for (let i = 0; i < 400; i++) {
    const k = await kite(page); if (!k || k.done) break;
    if (k.obj) {
      const [sx, sy] = await game(page, ([x, y]) => window.__kiteToScreen(x, y), k.obj);
      await page.mouse.move(sx, sy, { steps: 2 });
      const want = Math.hypot(k.obj[0] - k.hx, k.obj[1] - k.hy);
      await press(k.L > want + 1.5 ? 'left' : k.L < want - 1 ? 'right' : null);
    }
    await page.waitForTimeout(90);
  }
  await press(null);
  const end = await kite(page);
  ok(end.done && end.won, 'First Flight is flown to the finish with the mouse');
  await page.locator('.kd-result').waitFor();
  ok(await page.locator('.kd-result h2').innerText().then((t) => /Gold|Silver|Bronze/.test(t)), 'a medal');
  const saved = await game(page, (k) => JSON.parse(localStorage.getItem(k)), KEY);
  ok(saved.v === 1 && saved.progress.m1?.medal >= 1, 'the medal is saved');

  // ---------------------------------------------------------------- the keyboard, in a free flight
  await game(page, () => window.__kiteStart(null, 'meadow'));
  await page.mouse.move(5, 400); await page.waitForTimeout(1500);
  const a = await kite(page);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
  const b = await kite(page);
  ok(Math.abs(b.psi - a.psi) > 0.3, 'the arrow keys turn the nose');
  await page.waitForTimeout(1500);
  const c = await kite(page); await page.keyboard.down('Space'); await page.waitForTimeout(900); await page.keyboard.up('Space');
  ok((await kite(page)).L < c.L - 1.5, 'Space pulls the line in');
  const d = await kite(page); await page.keyboard.down('Shift'); await page.waitForTimeout(1200); await page.keyboard.up('Shift');
  ok((await kite(page)).L > d.L + 1.5, 'Shift lets line out');
  const e = await kite(page); await page.keyboard.down('d'); await page.waitForTimeout(800); await page.keyboard.up('d');
  ok((await kite(page)).hx > e.hx + 1, 'D walks downwind');
  await page.keyboard.press('Escape');
  ok(await page.getByRole('heading', { name: 'Paused' }).isVisible(), 'Escape pauses');
  const t0 = (await kite(page)).t; await page.waitForTimeout(400);
  ok((await kite(page)).t === t0, 'nothing moves while paused');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok((await kite(page)).t > t0, 'and Escape again flies on');

  // ---------------------------------------------------------------- across a reload
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /summer map/ }).click();
  await page.getByRole('button', { name: /Clover Meadow/ }).click();
  ok(await page.getByRole('listitem').filter({ hasText: 'Clover Rings' }).getByRole('button', { name: 'Fly' }).isEnabled(), 'the next challenge opened and stays open');
  ok(await page.getByRole('listitem').filter({ hasText: 'First Flight' }).getByText(/Best:/).isVisible(), 'the best time is remembered');

  // ---------------------------------------------------------------- a corrupt save
  await game(page, (k) => localStorage.setItem(k, '{"v":1,"progress":{"m1":{"best":"soon","medal":7}}, nope'), KEY);
  await page.reload(); await ready(page);
  ok(await page.getByRole('button', { name: 'Start the summer' }).isVisible(), 'a corrupt save starts afresh');
  await game(page, (k) => localStorage.setItem(k, JSON.stringify({ v: 1, progress: { m1: { best: 4, medal: 3 }, zz: 1 }, shape: 'dragon', flyer: 'enzo' })), KEY);
  await page.reload(); await ready(page);
  const s2 = await game(page, () => window.__kiteSave());
  ok(s2.progress.m1.medal === 3 && s2.shape === 'diamond' && s2.flyer === 'enzo', 'an odd save keeps only what makes sense');
  await page.context().close();
}

// ---------------------------------------------------------------- framing on laptops and big screens
for (const [w, h] of [[1280, 800], [1920, 1080]]) {
  const page = await open({ width: w, height: h });
  await clear(page);
  for (const id of ['m2', 'b1', 'c2', 'h4']) {
    await game(page, (i) => window.__kiteStart(i), id);
    await page.mouse.move(w * 0.7, h * 0.3);
    await page.waitForTimeout(3000);
    const sc = await game(page, () => window.__kiteScene());
    const [sx, sy, sw, sh] = sc.sprite, hud = await rect(page, '.kd-hud-mid'), wind = await rect(page, '.kd-hud-wind');
    ok(sh >= h * 0.17, `${w}×${h} ${id}: the flier is a clear size (${Math.round(sh)} px)`);
    ok(sx >= -sw * 0.05 && sy >= 0 && sx + sw <= w && sy + sh <= h + 2, `${w}×${h} ${id}: the flier is on screen`);
    ok(!overlap([sx + sw * 0.3, sy, sx + sw, sy + sh * 0.5], hud) && !overlap([sx + sw * 0.3, sy, sx + sw, sy + sh * 0.5], wind), `${w}×${h} ${id}: nothing covers the flier's face`);
    ok(!overlap(hud, wind), `${w}×${h}: the HUD panels do not overlap`);
    const [kx, ky] = sc.kite;
    ok(kx > 0 && kx < w && ky > hud[3] - 20 && ky < h, `${w}×${h} ${id}: the kite is in view`);
    ok(sc.kiteSize >= 48, `${w}×${h} ${id}: the kite reads (${Math.round(sc.kiteSize)} px)`);
  }
  ok(await noSideScroll(page), `${w}×${h}: no sideways scroll`);
  await page.context().close();
}

// ---------------------------------------------------------------- phones, both ways, by touch
for (const [w, h] of [[390, 844], [844, 390]]) {
  const page = await open({ width: w, height: h }, true);
  await clear(page);
  ok(await noSideScroll(page), `${w}×${h}: the menu fits`);
  await page.getByRole('button', { name: 'Start the summer' }).tap();
  await page.getByRole('button', { name: /Clover Meadow/ }).tap();
  await page.getByRole('listitem').filter({ hasText: 'First Flight' }).getByRole('button', { name: 'Fly' }).tap();
  await page.waitForFunction(() => window.__kiteScreen() === 'play');
  await page.locator('.kd-pad .is-pull').waitFor();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await page.waitForTimeout(1500);
  // hold Pull with a thumb
  const pb = await rect(page, '.kd-pad .is-pull'), px = (pb[0] + pb[2]) / 2, py = (pb[1] + pb[3]) / 2;
  const before = await kite(page);
  await touch('touchStart', [{ x: px, y: py, id: 1 }]); await page.waitForTimeout(900); await touch('touchEnd', []);
  ok((await kite(page)).L < before.L - 1, `${w}×${h}: holding Pull reels in`);
  // drag a finger across the sky: the kite follows it
  await page.waitForTimeout(600);
  const a = await kite(page);
  const [tx, ty] = await game(page, ([x, y]) => window.__kiteToScreen(x, y), [a.hx + 4, a.hy + 9]);
  await touch('touchStart', [{ x: tx + 40, y: ty, id: 2 }]);
  for (let i = 0; i < 12; i++) { await touch('touchMove', [{ x: tx + 40 - i * 3, y: ty, id: 2 }]); await page.waitForTimeout(100); }
  const b = await kite(page);
  await touch('touchEnd', []);
  ok(Math.hypot(b.x - a.x, b.y - a.y) > 0.5, `${w}×${h}: a finger in the sky steers the kite`);
  const sc = await game(page, () => window.__kiteScene());
  const [sx, sy, sw, sh] = sc.sprite, face = [sx + sw * 0.35, sy, sx + sw, sy + sh * 0.55];
  for (const sel of ['.kd-pad-walk', '.kd-pad-line', '.kd-hud-mid', '.kd-hud-wind', '.kd-coach']) {
    if (!(await page.locator(sel).count()) || !(await page.locator(sel).first().isVisible())) continue;
    ok(!overlap(face, await rect(page, sel)), `${w}×${h}: ${sel} keeps clear of the flier's face`);
  }
  ok(sh >= 84, `${w}×${h}: the flier is a clear size (${Math.round(sh)} px)`);
  ok(sx + sw > 0 && sx < w && sy < h, `${w}×${h}: the flier is on screen`);
  ok(await noSideScroll(page), `${w}×${h}: no sideways scroll while flying`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`kite e2e: ${checks} checks passed`);
