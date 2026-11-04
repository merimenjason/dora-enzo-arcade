// Pawpark Skate in the browser: the title and the way home, the mentors' welcome, a session pushed along with the
// keyboard (an ollie, a flip banked into the score), a grind with its balance bar and a golden acorn, pause, the
// whistle at the end of a session and the result saved, goals opening the next park, a switch to Enzo, free skate, a
// corrupt save, and phones held either way with the touch stick and buttons, all with no page errors and no sideways
// scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'pawpark-skate-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
// a busy dev server now and then drops a module and the page never hydrates, so try again (up to 5 times)
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__skate(); return { screen: s.screen, paused: s.paused, save: s.save, result: s.result, intro: s.intro, pick: s.pick, ses: s.ses }; });
// on a timeout, say where the game was
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__skate(); return JSON.stringify({ screen: s.screen, paused: s.paused, ses: s.ses, result: s.result }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (r, vw, vh) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__skate().debug[f](...args), [fn, a]);
const skating = (page) => until(page, () => window.__skate().screen === 'skate' && !!window.__skate().ses);

try {
  const page = await open();
  await page.goto(`${base}/skate`); await ready(page);
  // ---- the title, the way home, and the welcome at the parks
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.sk-home').getAttribute('href'), '/');
  await page.getByRole('button', { name: 'Let’s skate' }).click();
  await until(page, () => window.__skate().intro === 0);
  assert.ok(await page.getByRole('button', { name: /Skate! · 2:00/ }).isDisabled(), 'no skating until the welcome is done');
  for (let i = 0; i < 4; i++) await page.locator('.sk-talk').click();
  await until(page, () => window.__skate().intro === -1 && window.__skate().save.intro);
  assert.ok((await page.locator('[data-park="hill"]').getAttribute('class')).includes('locked'), 'the hill starts locked');
  ok('the title links home, the mentors welcome you at the parks and it is remembered; the other parks start locked');

  // ---- a session: push, ollie, flip, land
  await page.getByRole('button', { name: /Skate! · 2:00/ }).click(); await skating(page);
  let s = await st(page); assert.equal(s.ses.park, 'plaza'); assert.ok(s.ses.left > 118 && s.ses.left <= 120, 'a two-minute clock');
  await page.keyboard.down('ArrowUp'); await until(page, () => window.__skate().ses.speed > 5); await page.keyboard.up('ArrowUp');
  await page.keyboard.press('Space'); await until(page, () => window.__skate().ses.state === 'air');
  await page.keyboard.press('KeyJ'); await until(page, () => window.__skate().ses.combo.includes('Kickflip'));
  await until(page, () => window.__skate().ses.score > 0, undefined, 10000);
  ok('up pushes, Space ollies, J kickflips, and landing it banks the combo into the score');

  // ---- a grind along the long ledge, with the balance bar, and the golden acorn above it
  await dbg(page, 'place', 10.5, -13.4, Math.PI / 2 - 0.25, 6);
  await page.keyboard.press('Space'); await page.keyboard.down('KeyL');
  await until(page, () => window.__skate().ses.state === 'grind');
  assert.equal(await page.locator('.sk-bal').getAttribute('data-on'), '1', 'the balance bar shows on a grind');
  await page.keyboard.up('KeyL');
  await until(page, () => window.__skate().ses.acorns === 1 && window.__skate().ses.state !== 'grind');
  assert.match(await page.locator('.sk-acorns').innerText(), /1\/5/);
  ok('L grinds the ledge with a balance bar, and the golden acorn above it is collected');

  // ---- pause stands still
  await page.keyboard.press('Escape'); await until(page, () => window.__skate().paused);
  const tp = (await st(page)).ses.t; await page.waitForTimeout(400); assert.equal((await st(page)).ses.t, tp, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep skating' }).click(); await until(page, () => !window.__skate().paused);
  ok('Esc pauses and the session stands still');

  // ---- the whistle: the session ends and is saved
  await dbg(page, 'left', 0.3);
  await until(page, () => window.__skate().screen === 'result' && !!window.__skate().result);
  s = await st(page);
  assert.equal(s.result.park, 'plaza'); assert.ok(s.result.score > 0); assert.equal(s.save.stats.sessions, 1); assert.equal(s.save.best.plaza, s.result.score);
  assert.ok(s.save.stats.acorns >= 1);
  ok('when the clock runs out the session ends: the score is shown and saved as the best');

  // ---- goals open the next park; Enzo on the hill; it all survives a reload
  await page.getByRole('button', { name: 'Parks' }).click(); await until(page, () => window.__skate().screen === 'parks');
  await dbg(page, 'goals', ['plaza-score', 'plaza-pro', 'plaza-combo']);
  await until(page, () => !document.querySelector('[data-park="hill"]').className.includes('locked'));
  await page.locator('[data-park="hill"]').click();
  await page.getByRole('button', { name: /^Enzo/ }).click(); await until(page, () => window.__skate().save.char === 'enzo');
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.char, 'enzo'); assert.equal(s.save.goals.length, 3);
  await page.getByRole('button', { name: 'Back to the parks' }).click();
  await page.locator('[data-park="hill"]').click();
  await page.getByRole('button', { name: /Skate! · 2:00/ }).click(); await skating(page);
  s = await st(page); assert.equal(s.ses.park, 'hill'); assert.equal(s.ses.char, 'enzo');
  ok('three goals open Cloverdrop Hill, Enzo can be picked, and both survive a reload');

  // ---- free skate: no clock, ended from the pause menu, the session scores don't count
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /Back to the parks/ }).click();
  await until(page, () => window.__skate().screen === 'parks');
  await page.getByRole('button', { name: 'Free skate' }).click(); await skating(page);
  await until(page, () => document.querySelector('.sk-clock').textContent === 'Free skate' && window.__skate().ses.left === Infinity);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'End the session now' }).click();
  await until(page, () => window.__skate().screen === 'result' && window.__skate().result.free);
  ok('free skate has no clock and ends from the pause menu');

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"char":"zed","goals":7,"best":['), KEY);
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.char, 'dora'); assert.deepEqual(s.save.goals, []);
  ok('a corrupt save falls back to a new one');
  await page.close();

  // ---- phones, held upright and sideways: touch controls clear of the HUD, nothing off the side
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const p = await open(vp, true);
    await p.goto(`${base}/skate`); await ready(p);
    await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
    await p.reload(); await ready(p);
    for (const sel of ['.sk-logo', '.sk-menu']) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on the title`);
    await p.getByRole('button', { name: 'Let’s skate' }).tap();
    assert.ok(await noSideScroll(p), `${tag}: the parks fit`);
    await p.getByRole('button', { name: /Skate! · 2:00/ }).tap(); await skating(p);
    const sels = ['.sk-stick', '.t-jump', '.t-flip', '.t-grab', '.t-grind', '.sk-scorebox', '.sk-topbtns', '.sk-meter'];
    for (const sel of sels) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on screen`);
    for (let i = 0; i < sels.length; i++) for (let j = i + 1; j < sels.length; j++) {
      if (sels[i].startsWith('.t-') && sels[j].startsWith('.t-')) continue;
      assert.ok(!overlap(await rect(p, sels[i]), await rect(p, sels[j])), `${tag}: ${sels[i]} clear of ${sels[j]}`);
    }
    for (const sel of ['.sk-scorebox', '.sk-topbtns', '.sk-meter', '.sk-stick', '.t-flip']) assert.ok(!overlap(await rect(p, '.sk-combo'), await rect(p, sel)), `${tag}: the combo clear of ${sel}`);
    // the stick pushes: hold it up and the board speeds up
    const sr = await rect(p, '.sk-stick'), cx = sr.x + sr.w / 2, cy = sr.y + sr.h / 2;
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 44, id: 1 }] });
    await until(p, () => window.__skate().ses.speed > 4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.locator('.t-jump').tap();
    await until(p, () => window.__skate().ses.state === 'air');
    assert.ok(await noSideScroll(p), `${tag}: nothing off the side`);
    ok(`phone ${tag}: the stick pushes, OLLIE pops, the HUD fits and nothing overlaps`);
    await p.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`skate e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
