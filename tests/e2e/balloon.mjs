// Cloudberry Balloon in the browser: the title and the way home, Granny Bramble's welcome at the map, a hop flown with
// the keyboard (the burner lifts off, the vent sinks, the pedals push), a jar dropped and a sandbag thrown, pause, a
// soft landing on the meadow saved with its stars and opening the next hop, a corrupt save, and phones held either way
// with the touch buttons, all with no page errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'cloudberry-balloon-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__balloon(); return { screen: s.screen, paused: s.paused, save: s.save, result: s.result, intro: s.intro, pick: s.pick, flight: s.flight }; });
// on a timeout, say where the game was
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__balloon(); return JSON.stringify({ screen: s.screen, paused: s.paused, flight: s.flight, result: s.result }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (r, vw, vh) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__balloon().debug[f](...args), [fn, a]);
const flying = (page) => until(page, () => window.__balloon().screen === 'fly' && !!window.__balloon().flight);

try {
  const page = await open();
  await page.goto(`${base}/balloon`); await ready(page);
  // ---- the title, the way home, and Granny Bramble's welcome at the map
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.bl-home').getAttribute('href'), '/');
  await page.getByRole('button', { name: 'Let’s fly' }).click();
  await until(page, () => window.__balloon().intro === 0);
  assert.ok(await page.getByRole('button', { name: 'Fly!' }).isDisabled(), 'no flying until the welcome is done');
  for (let i = 0; i < 4; i++) await page.locator('.bl-talk').click();
  await until(page, () => window.__balloon().intro === -1 && window.__balloon().save.intro);
  assert.ok((await page.locator('[data-hop="mill"]').getAttribute('class')).includes('locked'), 'the second hop starts locked');
  ok('the title links home, Granny Bramble welcomes you at the map and it is remembered; the later hops start locked');

  // ---- the first hop: the burner lifts off, the vent sinks, the pedals push
  await page.getByRole('button', { name: 'Fly!' }).click(); await flying(page);
  let s = await st(page); assert.equal(s.flight.lv, 'farm'); assert.ok(s.flight.grounded, 'it starts on the ground');
  await until(page, () => /Hold Space/.test(document.querySelector('.bl-tip').textContent));
  await page.keyboard.down('Space');
  await until(page, () => window.__balloon().flight.burning && !window.__balloon().flight.grounded && window.__balloon().flight.alt > 8);
  await page.keyboard.up('Space');
  await page.keyboard.down('KeyS'); await until(page, () => window.__balloon().flight.vy < -0.3); await page.keyboard.up('KeyS');
  await until(page, () => !/Hold Space/.test(document.querySelector('.bl-tip').textContent));
  ok('Granny’s tip says to hold Space; Space lights the burner and lifts off, S vents and sinks');
  await dbg(page, 'place', 120, 4);
  const x0 = (await st(page)).flight.x;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD');
  assert.ok((await st(page)).flight.x > x0 + 1, 'D pedals east near the ground');
  ok('D pedals the balloon along near the ground');

  // ---- pause stands still
  await page.keyboard.press('Escape'); await until(page, () => window.__balloon().paused);
  const tp = (await st(page)).flight.t; await page.waitForTimeout(400); assert.equal((await st(page)).flight.t, tp, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep flying' }).click(); await until(page, () => !window.__balloon().paused);
  ok('Esc pauses and the flight stands still');

  // ---- a soft landing on the meadow: saved with its stars, the next hop opens
  await dbg(page, 'finish');
  await until(page, () => window.__balloon().screen === 'result' && !!window.__balloon().result);
  s = await st(page);
  assert.equal(s.result.why, 'landed'); assert.ok(s.result.stars >= 2, 'landed with no parcels to drop is two stars');
  assert.equal(s.save.stats.flights, 1); assert.equal(s.save.best.farm.points, s.result.points);
  assert.equal(s.result.opened, 'mill');
  ok('landing on the meadow ends the hop: the points and stars are shown and saved, and the next hop opens');

  // ---- the lake hop: a jar on its parachute and a sandbag
  await page.getByRole('button', { name: 'Map' }).click(); await until(page, () => window.__balloon().screen === 'map');
  await dbg(page, 'land', ['farm', 'mill']);
  await until(page, () => !document.querySelector('[data-hop="lake"]').className.includes('locked'));
  await page.locator('[data-hop="lake"]').click();
  await page.getByRole('button', { name: 'Fly!' }).click(); await flying(page);
  await dbg(page, 'place', 200, 40);
  s = await st(page); const jars = s.flight.parcels, sacks = s.flight.sandbags;
  await page.keyboard.press('KeyE'); await until(page, (n) => window.__balloon().flight.parcels === n - 1, jars);
  await page.keyboard.press('KeyQ'); await until(page, (n) => window.__balloon().flight.sandbags === n - 1, sacks);
  assert.match(await page.locator('.bl-chip small').innerText(), new RegExp(`${jars - 1} left`));
  ok('E drops a jar of jam and Q throws a sandbag, and the HUD counts them');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /Back to the map/ }).click();
  await until(page, () => window.__balloon().screen === 'map');
  await page.reload(); await ready(page);
  s = await st(page); assert.ok(s.save.best.farm && s.save.best.mill, 'the landings survive a reload');
  ok('quitting from the pause menu goes back to the map, and the save survives a reload');

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"best":7,"settings":['), KEY);
  await page.reload(); await ready(page);
  s = await st(page); assert.deepEqual(s.save.best, {}); assert.equal(s.save.intro, false);
  ok('a corrupt save falls back to a new one');
  await page.close();

  // ---- phones, held upright and sideways: touch buttons clear of the HUD, nothing off the side
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const p = await open(vp, true);
    await p.goto(`${base}/balloon`); await ready(p);
    await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
    await p.reload(); await ready(p);
    for (const sel of ['.bl-logo', '.bl-menu']) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on the title`);
    await p.getByRole('button', { name: 'Let’s fly' }).tap();
    assert.ok(await noSideScroll(p), `${tag}: the map fits`);
    await p.getByRole('button', { name: 'Fly!' }).tap(); await flying(p);
    await until(p, () => /Hold BURN/.test(document.querySelector('.bl-tip').textContent));
    const sels = ['.t-burn', '.t-vent', '.t-drop', '.t-sand', '.t-left', '.t-right', '.bl-gauges', '.bl-top', '.bl-prog', '.bl-tip'];
    for (const sel of sels) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on screen`);
    for (let i = 0; i < sels.length; i++) for (let j = i + 1; j < sels.length; j++) {
      if (sels[i].startsWith('.t-') && sels[j].startsWith('.t-')) continue;
      assert.ok(!overlap(await rect(p, sels[i]), await rect(p, sels[j])), `${tag}: ${sels[i]} clear of ${sels[j]}`);
    }
    // hold BURN and the balloon lifts off
    const br = await rect(p, '.t-burn'), cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: br.x + br.w / 2, y: br.y + br.h / 2, id: 1 }] });
    await until(p, () => !window.__balloon().flight.grounded && window.__balloon().flight.alt > 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.ok(await noSideScroll(p), `${tag}: nothing off the side`);
    ok(`phone ${tag}: BURN lifts off, the HUD and Granny’s tip fit and nothing overlaps`);
    await p.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`balloon e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
