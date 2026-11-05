// Paperwing Post in the browser: the title and the way home, the welcome at the map, a flight flown with the keyboard
// (steering turns, diving speeds up, the arrow and Enzo's tips), a letter posted with Space and another with Enter for a
// second player, pause, gliding home saved with its stars and opening the next flight, pages folding a glider in the
// workshop, a corrupt save, and phones held either way with the stick and the POST button, all with no page errors and
// no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'paperwing-post-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__glider(); return { screen: s.screen, paused: s.paused, save: s.save, result: s.result, intro: s.intro, pick: s.pick, flight: s.flight }; });
// on a timeout, say where the game was
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__glider(); return JSON.stringify({ screen: s.screen, paused: s.paused, flight: s.flight, result: s.result }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (r, vw, vh) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__glider().debug[f](...args), [fn, a]);
const flying = (page) => until(page, () => window.__glider().screen === 'fly' && !!window.__glider().flight);

try {
  const page = await open();
  await page.goto(`${base}/glider`); await ready(page);
  // ---- the title, the way home, and the welcome at the map
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.pw-home').getAttribute('href'), '/');
  await page.getByRole('button', { name: 'Let’s fly' }).click();
  await until(page, () => window.__glider().intro === 0);
  assert.ok(await page.getByRole('button', { name: 'Fly!' }).isDisabled(), 'no flying until the welcome is done');
  for (let i = 0; i < 4; i++) await page.locator('.pw-talk').click();
  await until(page, () => window.__glider().intro === -1 && window.__glider().save.intro);
  assert.ok((await page.locator('[data-flight="market"]').getAttribute('class')).includes('locked'), 'the second flight starts locked');
  ok('the title links home, Dora and Enzo explain the post at the map and it is remembered; the later flights start locked');

  // ---- the first flight: steering, diving, the arrow and the tips
  await page.getByRole('button', { name: 'Fly!' }).click(); await flying(page);
  let s = await st(page); assert.equal(s.flight.lv, 'morning'); assert.ok(s.flight.alt > 4, 'it launches from the attic window');
  await until(page, () => /Steer with/.test(document.querySelector('.pw-tip').textContent));
  assert.match(await page.locator('.pw-compass span').innerText(), /the Thimbletons · \d+ m/);
  const yaw0 = (await st(page)).flight.yaw;
  await page.keyboard.down('ArrowRight'); await until(page, (y) => window.__glider().flight.yaw < y - 0.2, yaw0); await page.keyboard.up('ArrowRight');
  await dbg(page, 'place', -200, 80, 230, Math.PI / 2);
  const v0 = (await st(page)).flight.speed;
  await page.keyboard.down('ArrowDown'); await until(page, (v) => window.__glider().flight.speed > v + 3, v0); await page.keyboard.up('ArrowDown');
  ok('Enzo says how to steer, the arrow names the first window, → banks right and ↓ dives for speed');

  // ---- posting: Space for the first player, Enter for Enzo's player
  await dbg(page, 'window', 0);
  await until(page, () => /In reach/.test(document.querySelector('.pw-tip').textContent));
  await page.keyboard.press('Space'); await until(page, () => window.__glider().flight.posted === 1);
  assert.match(await page.locator('.pw-chip b').first().innerText(), /^1\/3$/);
  await dbg(page, 'window', 1); await until(page, () => /In reach/.test(document.querySelector('.pw-tip').textContent));
  await page.keyboard.press('Enter'); await until(page, () => window.__glider().flight.posted === 2);
  ok('in reach of a window, Space posts a letter and Enter does too for a second player; the HUD counts them');

  // ---- pause stands still
  await page.keyboard.press('Escape'); await until(page, () => window.__glider().paused);
  const tp = (await st(page)).flight.t; await page.waitForTimeout(400); assert.equal((await st(page)).flight.t, tp, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep flying' }).click(); await until(page, () => !window.__glider().paused);
  ok('Esc pauses and the flight stands still');

  // ---- home through the attic window: saved with its stars, the next flight opens
  await dbg(page, 'postAll'); await until(page, () => window.__glider().flight.t > 6.2);
  await until(page, () => /Glide home/.test(document.querySelector('.pw-tip').textContent));
  await dbg(page, 'window', -1);
  await until(page, () => window.__glider().screen === 'result' && !!window.__glider().result);
  s = await st(page);
  assert.equal(s.result.why, 'home'); assert.ok(s.result.stars >= 2, 'every letter and home is two stars at least');
  assert.equal(s.save.stats.flights, 1); assert.equal(s.save.best.morning.points, s.result.points);
  assert.equal(s.result.opened, 'market');
  ok('gliding home through the attic window ends the flight: the points and stars are shown and saved, and the next flight opens');

  // ---- the workshop: banked pages fold a new glider, and the next flight flies it
  await page.getByRole('button', { name: 'Map' }).click(); await until(page, () => window.__glider().screen === 'map');
  await dbg(page, 'paper', 30);
  await page.getByRole('button', { name: /Workshop/ }).click(); await until(page, () => window.__glider().screen === 'workshop');
  assert.ok(await page.locator('[data-glider="stunt"] button').isDisabled(), "the Swoop costs more pages than you've got");
  await page.locator('[data-glider="wing"] button').click();
  await until(page, () => window.__glider().save.glider === 'wing' && window.__glider().save.paper === 5);
  await page.getByRole('button', { name: '‹ Map' }).click();
  await page.locator('[data-flight="market"]').click();
  await page.getByRole('button', { name: 'Fly!' }).click(); await flying(page);
  assert.equal((await st(page)).flight.glider, 'wing');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /Back to the map/ }).click();
  await until(page, () => window.__glider().screen === 'map');
  await page.reload(); await ready(page);
  s = await st(page); assert.ok(s.save.best.morning && s.save.owned.includes('wing'), 'the flight and the glider survive a reload');
  ok('pages fold the Broadwing in the workshop, it flies the next flight, and the save survives a reload');

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"best":7,"settings":['), KEY);
  await page.reload(); await ready(page);
  s = await st(page); assert.deepEqual(s.save.best, {}); assert.equal(s.save.intro, false);
  ok('a corrupt save falls back to a new one');
  await page.close();

  // ---- phones, held upright and sideways: the stick and POST clear of the HUD, nothing off the side
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const p = await open(vp, true);
    await p.goto(`${base}/glider`); await ready(p);
    await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
    await p.reload(); await ready(p);
    for (const sel of ['.pw-logo', '.pw-menu']) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on the title`);
    await p.getByRole('button', { name: 'Let’s fly' }).tap();
    assert.ok(await noSideScroll(p), `${tag}: the map fits`);
    await p.getByRole('button', { name: 'Fly!' }).tap(); await flying(p);
    await until(p, () => /the stick/.test(document.querySelector('.pw-tip').textContent));
    const sels = ['.t-post', '.pw-alt', '.pw-top', '.pw-compass', '.pw-tip'];
    for (const sel of sels) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on screen`);
    for (let i = 0; i < sels.length; i++) for (let j = i + 1; j < sels.length; j++) assert.ok(!overlap(await rect(p, sels[i]), await rect(p, sels[j])), `${tag}: ${sels[i]} clear of ${sels[j]}`);
    // drag the stick right and the glider turns right; tap POST at a window and Enzo posts
    const cdp = await p.context().newCDPSession(p), y0 = (await st(p)).flight.yaw, sx = vp.width * 0.2, sy = vp.height * 0.7;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + 60, y: sy, id: 1 }] });
    await until(p, (y) => window.__glider().flight.yaw < y - 0.2, y0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await dbg(p, 'window', 0); await until(p, () => /In reach/.test(document.querySelector('.pw-tip').textContent));
    await p.locator('.t-post').tap(); await until(p, () => window.__glider().flight.posted === 1);
    assert.ok(await noSideScroll(p), `${tag}: nothing off the side`);
    ok(`phone ${tag}: the stick steers, POST posts, and the HUD, Enzo's tips and the buttons fit without overlapping`);
    await p.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`glider e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
