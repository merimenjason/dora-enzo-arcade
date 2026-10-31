// Twig & Twine in the browser: the arcade card and the menu, First Crossing built with the real mouse (the planks,
// a twig strut), tested and crossed, removing by right-click with undo and redo, mirror building, a failing bridge
// that falls in and puts you back in build mode with the design intact, the design saved across a reload, the
// crossing list and its locks, a corrupt save, the framing at 1280×800 and 1920×1080 (the whole gap and the cart in
// view and Dora and Enzo a clear size), and phones held either way, built by touch.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'twig-twine-v1';
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
const members = (page) => game(page, () => window.__bridges().builder?.members.length ?? -1);
const settle = (page) => page.waitForFunction(() => window.__bridgesScene()?.settled, null, { polling: 50 });
const pt = (page, x, y) => game(page, ([a, b]) => window.__bridgesPoint(a, b), [x, y]);
const mode = (page) => page.locator('main').getAttribute('data-mode');
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Builds a member with the real mouse: press on the joint, drag, let go. */
async function mouseBuild(page, a, b) {
  await settle(page);
  const before = await members(page), [x0, y0] = await pt(page, ...a), [x1, y1] = await pt(page, ...b);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 5 }); await page.mouse.move(x1, y1, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((n) => window.__bridges().builder.members.length > n, before);
}
/** Builds a member with a finger, through real touch events. */
async function touchBuild(page, cdp, a, b) {
  await settle(page);
  const before = await members(page), [x0, y0] = await pt(page, ...a), [x1, y1] = await pt(page, ...b);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= 8; i++) await touch('touchMove', x0 + ((x1 - x0) * i) / 8, y0 + ((y1 - y0) * i) / 8);
  await touch('touchEnd');
  await page.waitForFunction((n) => window.__bridges().builder.members.length > n, before);
  // a finger lifted from a drag: Chrome ignores a tap that follows too quickly
  await page.waitForTimeout(400);
}
/** Runs a test to its end (four times as fast) and returns how it went. */
async function runTest(page) {
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('main').dataset.mode === 'test');
  await game(page, () => window.__bridgesSpeed(4));
  await page.waitForFunction(() => window.__bridges().sim?.outcome || document.querySelector('main').dataset.mode === 'build', null, { timeout: 60000 });
  const outcome = await game(page, () => window.__bridges().sim?.outcome ?? 'back');
  await game(page, () => window.__bridgesSpeed(1));
  return outcome;
}
/** Checks the whole gap and the cart are on screen and the painted chinchillas are a clear size. */
async function framing(page, label, minCart) {
  await settle(page);
  const r = await game(page, () => {
    const L = window.__bridges().level, m = window.__bridgesScene(), c = document.querySelector('canvas').getBoundingClientRect();
    const xs = L.anchors.map((a) => a[0]), ys = L.anchors.map((a) => a[1]);
    const p0 = window.__bridgesPoint(Math.min(...xs), Math.max(...ys)), p1 = window.__bridgesPoint(Math.max(...xs), Math.min(...ys)), fl = window.__bridgesPoint(L.finish, 0);
    const bar = document.querySelector('.bt-tools')?.getBoundingClientRect(), top = document.querySelector('.bt-bar')?.getBoundingClientRect();
    return { p0, p1, fl, cart: m.cart, W: innerWidth, H: innerHeight, c: { x: c.left, y: c.top }, bar: bar && { y: bar.top, x0: bar.left, x1: bar.right }, top: top?.bottom ?? 0 };
  });
  for (const [n, p] of [['near bank', r.p0], ['far bank', r.p1], ['flag', r.fl]]) {
    assert.ok(p[0] >= 0 && p[0] <= r.W && p[1] >= r.top - 2 && p[1] <= r.H, `${label}: the ${n} is in view (${p.map(Math.round)})`);
  }
  assert.ok(r.cart, `${label}: the cart is drawn`);
  const cx0 = r.c.x + r.cart.x, cy0 = r.c.y + r.cart.y;
  assert.ok(cx0 >= -2 && cx0 + r.cart.w <= r.W + 2 && cy0 >= r.top - 4 && cy0 + r.cart.h <= r.H + 2, `${label}: the whole cart is in view (${[cx0, cy0, r.cart.w, r.cart.h].map(Math.round)} in ${r.W}×${r.H}, top ${Math.round(r.top)})`);
  assert.ok(r.cart.h >= minCart, `${label}: Dora and Enzo are a clear size (${Math.round(r.cart.h)}px)`);
  if (r.bar) assert.ok(cy0 + r.cart.h <= r.bar.y + 4 || cx0 + r.cart.w < r.bar.x0 || cx0 > r.bar.x1, `${label}: the cart is clear of the toolbar`);
  assert.ok(await noSideScroll(page), `${label}: no sideways scrolling`);
}

try {
  // ---- the arcade card, the menu
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 65);
  await page.locator('a.arcade-card[href="/bridges"]').click();
  await ready(page);
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Twig & Twine');
  assert.match(await page.locator('.bt-go').textContent(), /START/);
  assert.equal(await page.getByRole('button', { name: /Sandbox/ }).isDisabled(), true, 'the sandbox waits');
  await page.locator('.bt-go').click();
  await page.waitForFunction(() => window.__bridges().level?.id === 'b1');
  assert.equal(await page.locator('main').getAttribute('data-screen'), 'play');
  await framing(page, '1280×800 build', 90);

  // ---- First Crossing: the tutorial's road with the real mouse, a test that fails, then a strut, and across
  await page.keyboard.press('2');
  assert.match(await page.locator('.bt-tip, .bt-guide').first().textContent(), /plank/i, 'the tutorial explains the plank');
  await mouseBuild(page, [0, 0], [2, 0]);
  await mouseBuild(page, [2, 0], [4, 0]);
  assert.equal(await members(page), 2);
  assert.match(await page.locator('.bt-bar').textContent(), /72/, 'two planks cost 72 acorns');
  assert.notEqual(await runTest(page), 'cross', 'two planks alone don’t hold');
  await page.waitForFunction(() => document.querySelector('main').dataset.mode === 'build', null, { timeout: 20000 });
  assert.equal(await members(page), 2, 'back in build mode with the design intact');
  assert.ok((await page.locator('.bt-toast').textContent()).length > 4, 'a toast says what happened');
  await page.keyboard.press('1');
  await mouseBuild(page, [0, -2], [2, 0]);
  assert.equal(await members(page), 3);
  // remove by right-click, then undo and redo
  const [mx, my] = await pt(page, 1, -1);
  await page.mouse.click(mx, my, { button: 'right' });
  await page.waitForFunction(() => window.__bridges().builder.members.length === 2);
  await page.keyboard.press('z'); await page.waitForFunction(() => window.__bridges().builder.members.length === 3);
  await page.keyboard.press('y'); await page.waitForFunction(() => window.__bridges().builder.members.length === 2);
  await page.getByRole('button', { name: 'Undo' }).click(); await page.waitForFunction(() => window.__bridges().builder.members.length === 3);
  // across
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelector('main').dataset.mode === 'test');
  await page.waitForTimeout(2600);
  await framing(page, '1280×800 crossing', 90);
  await page.screenshot({ path: '.checks/bridges-1280.png' });
  await game(page, () => window.__bridgesSpeed(4));
  await page.getByRole('dialog', { name: 'Across!' }).waitFor({ timeout: 40000 });
  const saved = await game(page, (k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.equal(saved.levels.b1.crossed, true, 'the crossing is saved');
  assert.equal(saved.levels.b1.best, 100, 'with its cost');
  assert.equal(saved.levels.b1.medals, 3, 'and three acorns');
  assert.equal(saved.tutorial, true, 'the tutorial is done');

  // ---- on to Puddle Hop: mirror building
  await page.getByRole('button', { name: /Next/ }).click();
  await page.waitForFunction(() => window.__bridges().level?.id === 'b2');
  await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('2'); await page.keyboard.press('m');
  await mouseBuild(page, [0, 0], [2, 0]);
  assert.equal(await members(page), 2, 'mirror building lays the twin');
  assert.ok(await game(page, () => window.__bridges().builder.index(6, 0, 4, 0) > 0), 'on the far side');
  await page.getByRole('button', { name: 'Mirror building' }).click();
  await mouseBuild(page, [2, 0], [4, 0]);
  assert.equal(await members(page), 3, 'mirror off: one at a time');
  // a failing design falls and puts us back in build mode, untouched
  const design = await game(page, () => JSON.stringify(window.__bridges().builder.members));
  assert.notEqual(await runTest(page), 'cross', 'a plank-only bridge falls');
  await page.waitForFunction(() => document.querySelector('main').dataset.mode === 'build', null, { timeout: 20000 });
  assert.equal(await game(page, () => JSON.stringify(window.__bridges().builder.members)), design, 'the design is just as it was');

  // ---- saved across a reload
  await page.reload(); await ready(page);
  assert.match(await page.locator('.bt-go').textContent(), /CONTINUE/);
  await page.locator('.bt-go').click();
  await page.waitForFunction(() => window.__bridges().level?.id === 'b2');
  assert.equal(await members(page), 3, 'the Puddle Hop design came back');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  await page.getByRole('dialog', { name: 'Paused' }).getByRole('button', { name: 'Crossings' }).click();

  // ---- the crossing list
  await page.locator('.bt-levels').waitFor();
  assert.equal(await page.locator('.bt-lv').count(), 24, 'twenty-four crossings');
  assert.equal(await page.locator('.bt-lv.is-done').count(), 1, 'one crossed');
  assert.equal(await page.getByRole('button', { name: '1-2: Puddle Hop' }).isDisabled(), false, 'the next is open');
  assert.equal(await page.getByRole('button', { name: /1-3: Over the Top \(locked\)/ }).isDisabled(), true, 'the one after waits');
  assert.equal(await page.getByRole('button', { name: /2-1: Hanging Fern \(locked\)/ }).isDisabled(), true, 'the ravine waits');
  assert.equal(await page.locator('.bt-region').count(), 4, 'four regions');
  assert.match(await page.locator('.bt-total').textContent(), /3 \/ 72/);
  await page.close();

  // ---- a corrupt save
  {
    const p = await open();
    await p.goto(base + '/bridges'); await ready(p);
    await p.evaluate((k) => localStorage.setItem(k, '{"v":1,"levels":{"b1":{"best":"lots","design":[[0,0,2,0,9],"x"]}},"settings":7'), KEY);
    await p.reload(); await ready(p);
    assert.match(await p.locator('.bt-go').textContent(), /START/, 'a corrupt save starts fresh');
    await p.locator('.bt-go').click(); await p.waitForFunction(() => window.__bridges().level?.id === 'b1');
    assert.equal(await members(p), 0);
    await p.evaluate((k) => localStorage.setItem(k, '{"v":1,"levels":{"b1":{"best":"x","medals":9,"design":[[0,0,2,0,1],[0,0,2,0,1],[0,0,2,0,3]],"crossed":true}}}'), KEY);
    await p.reload(); await ready(p);
    await p.locator('.bt-go').click(); await p.waitForFunction(() => window.__bridges().level?.id === 'b1');
    assert.equal(await members(p), 1, 'only the good member of a damaged design is kept');
    await p.close();
  }

  // ---- 1920×1080
  {
    const p = await open({ width: 1920, height: 1080 });
    await p.goto(base + '/bridges'); await ready(p);
    // every crossing but the last built, so the finale opens
    await p.evaluate((k) => {
      const levels = {};
      for (const r of 'brmc') for (let i = 1; i <= 6; i++) if (r + i !== 'c6') levels[r + i] = { best: 1, medals: 1, design: [], crossed: true };
      localStorage.setItem(k, JSON.stringify({ v: 1, levels, tutorial: true }));
    }, KEY);
    await p.reload(); await ready(p);
    for (const id of ['b1', 'c6']) {
      await game(p, (i) => window.__bridgesOpen(i), id); await p.waitForFunction((i) => window.__bridges().level?.id === i, id);
      await p.getByRole('button', { name: 'Got it' }).click({ timeout: 1500 }).catch(() => {});
      await framing(p, `1920×1080 ${id}`, id === 'b1' ? 120 : 70);
    }
    await p.screenshot({ path: '.checks/bridges-1920.png' });
    await p.close();
  }

  // ---- phones, held upright and sideways, built by touch
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const label = vp.width < vp.height ? 'phone upright' : 'phone sideways';
    const p = await open(vp, true), cdp = await p.context().newCDPSession(p);
    await p.goto(base + '/bridges'); await ready(p);
    assert.ok(await noSideScroll(p), `${label}: the menu fits`);
    await p.locator('.bt-go').tap();
    await p.waitForFunction(() => window.__bridges().level?.id === 'b1');
    assert.equal(await p.locator('main').getAttribute('data-touch'), vp.width < vp.height ? 'tall' : 'wide', `${label}: touch controls`);
    await p.getByRole('button', { name: 'Plank', exact: true }).tap();
    await touchBuild(p, cdp, [0, 0], [2, 0]);
    await touchBuild(p, cdp, [2, 0], [4, 0]);
    await p.getByRole('button', { name: 'Twig', exact: true }).tap();
    await touchBuild(p, cdp, [0, -2], [2, 0]);
    assert.equal(await members(p), 3, `${label}: built by touch`);
    // the remove tool: tap it, then the strut
    await p.getByRole('button', { name: 'Remove tool' }).tap();
    await settle(p); const [sx, sy] = await pt(p, 1, -1); await p.touchscreen.tap(sx, sy);
    await p.waitForFunction(() => window.__bridges().builder.members.length === 2, null, { timeout: 5000 }).catch(async (e) => { await p.screenshot({ path: '.checks/bridges-erase-fail.png' }); console.log('tap at', sx, sy, await game(p, () => JSON.stringify([window.__bridges().tool, window.__bridges().builder.members.map((m) => [m.ax, m.ay, m.bx, m.by, m.m])]))); throw e; });
    await p.getByRole('button', { name: 'Undo' }).tap();
    await p.waitForFunction(() => window.__bridges().builder.members.length === 3);
    await p.getByRole('button', { name: 'Remove tool' }).tap();
    await framing(p, `${label} build`, vp.width < vp.height ? 34 : 40);
    await p.locator('.bt-test').tap();
    await p.waitForFunction(() => document.querySelector('main').dataset.mode === 'test');
    await p.waitForTimeout(2400);
    await framing(p, `${label} crossing`, vp.width < vp.height ? 40 : 50);
    await p.screenshot({ path: `.checks/bridges-${vp.width}.png` });
    await game(p, () => window.__bridgesSpeed(4));
    await p.getByRole('dialog', { name: 'Across!' }).waitFor({ timeout: 40000 });
    assert.ok(await noSideScroll(p), `${label}: the result fits`);
    await p.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Twig & Twine browser checks passed');
} finally {
  await browser.close();
}
