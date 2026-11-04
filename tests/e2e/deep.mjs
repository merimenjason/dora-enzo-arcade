// Deepglow in the browser: the title and the way home, Enzo's briefing on the boat, a dive steered with the keyboard,
// a sonar ping and its echoes, the lamp, the chart, pause, a specimen scooped up and banked at the surface, the journal
// and an upgrade saved across a reload, running out of air (Enzo winches you up and the tray is lost), a corrupt save,
// and the dive on phones held either way with the touch stick and buttons, all with no page errors and no sideways
// scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'deepglow-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__deep(); return { screen: s.screen, paused: s.paused, map: s.map, save: s.save, result: s.result, radio: s.radio, intro: s.intro, dive: s.dive }; });
// on a timeout, say where the game was
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__deep(); return JSON.stringify({ screen: s.screen, paused: s.paused, map: s.map, dive: s.dive, result: s.result }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inView = (r, vw, vh) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__deep().debug[f](...args), [fn, a]);

try {
  const page = await open();
  await page.goto(`${base}/deep`); await ready(page);
  // ---- the title, the way home, and Enzo's briefing on the boat
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.dg-home').getAttribute('href'), '/');
  await page.getByRole('button', { name: 'Start the expedition' }).click();
  await until(page, () => window.__deep().intro === 0);
  assert.ok(await page.getByRole('button', { name: 'Dive! ›' }).isDisabled(), 'no diving until the briefing is done');
  for (let i = 0; i < 4; i++) await page.locator('.dg-radio-card').click();
  await until(page, () => window.__deep().intro === -1 && window.__deep().save.intro);
  ok('the title links home, Enzo briefs you on the boat and the briefing is remembered');

  // ---- a dive: steer down, ping, the lamp, the chart, pause
  await page.getByRole('button', { name: 'Dive! ›' }).click();
  await until(page, () => window.__deep().screen === 'dive' && !!window.__deep().dive);
  const y0 = (await st(page)).dive.y;
  await page.keyboard.down('ArrowDown'); await until(page, (y) => window.__deep().dive.y > y + 6, y0); await page.keyboard.up('ArrowDown');
  ok('arrow keys steer the sub down into the water');
  await page.keyboard.press('Space');
  await until(page, () => window.__deep().dive.echoes > 10 && window.__deep().dive.pingCd > 0);
  ok('Space pings the sonar and the echoes come back off the walls');
  const lamp = (await st(page)).dive.lamp;
  await page.keyboard.press('KeyL'); await until(page, (l) => window.__deep().dive.lamp !== l, lamp);
  await page.keyboard.press('KeyL'); await until(page, (l) => window.__deep().dive.lamp === l, lamp);
  await page.keyboard.press('KeyM'); await until(page, () => window.__deep().map);
  assert.ok(await page.locator('.dg-map').isVisible());
  await page.keyboard.press('KeyM'); await until(page, () => !window.__deep().map);
  await page.keyboard.press('Escape'); await until(page, () => window.__deep().paused);
  const tp = (await st(page)).dive.t; await page.waitForTimeout(400); assert.equal((await st(page)).dive.t, tp, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep diving' }).click(); await until(page, () => !window.__deep().paused);
  ok('L switches the lamp, M opens and closes the chart, Esc pauses and the dive stands still');

  // ---- scoop a specimen and bring it up
  await dbg(page, 'specimen', 'mothjelly');
  await until(page, () => window.__deep().dive.tray.length === 1);
  assert.equal((await st(page)).dive.tray[0], 'mothjelly');
  assert.ok(await page.locator('.dg-tray span.full').count() === 1, 'the tray shows the catch');
  await dbg(page, 'surface');
  await until(page, () => window.__deep().screen === 'result' && !!window.__deep().result);
  let s = await st(page);
  assert.equal(s.result.why, 'surfaced'); assert.deepEqual(s.result.firsts, ['mothjelly']); assert.ok(s.result.earned >= 30 && s.save.points === s.result.earned);
  assert.equal(s.save.journal.mothjelly, 1); assert.equal(s.save.stats.dives, 1);
  assert.ok(await page.locator('.dg-haul li.new').count() === 1, 'the haul marks the new species');
  ok('a creature drifted into gently is scooped up, and surfacing banks it: a new journal entry and research points');

  // ---- the journal, an upgrade, and a reload
  await page.getByRole('button', { name: 'Open the journal' }).click();
  await until(page, () => window.__deep().screen === 'journal');
  assert.ok(!(await page.locator('[data-spec="mothjelly"]').getAttribute('class')).includes('unknown'), 'the mothjelly is in the journal');
  assert.ok((await page.locator('[data-spec="ribboneel"]').getAttribute('class')).includes('unknown'), 'others are still unknown');
  await page.getByRole('button', { name: '‹ Boat' }).click();
  await dbg(page, 'give', 100);
  await page.locator('[data-up="hull"] button').click();
  await until(page, () => window.__deep().save.levels.hull === 1);
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.levels.hull, 1); assert.equal(s.save.journal.mothjelly, 1); assert.ok(s.save.map.length > 0, 'the chart is saved');
  ok('the journal shows what was found, an upgrade is bought, and it all survives a reload');

  // ---- out of air: Enzo winches you up and the tray floats away
  await page.getByRole('button', { name: 'Back to the boat' }).click();
  await page.getByRole('button', { name: 'Dive! ›' }).click();
  await until(page, () => window.__deep().screen === 'dive' && !!window.__deep().dive);
  await dbg(page, 'specimen', 'krill');
  await until(page, () => window.__deep().dive.tray.length === 1);
  await dbg(page, 'air', 0.5);
  await until(page, () => window.__deep().screen === 'result' && !!window.__deep().result);
  s = await st(page);
  assert.equal(s.result.why, 'air'); assert.ok(!s.save.journal.krill, 'the tray is lost when Enzo winches you up'); assert.equal(s.save.stats.rescues, 1);
  assert.match(await page.locator('.dg-resultcard h2').innerText(), /winched/i);
  ok('running out of air ends the dive: Enzo winches you up and the tray floats away');

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"points":"lots","levels":7,"journal":['), KEY);
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.points, 0); assert.equal(s.save.levels.hull, 0);
  ok('a corrupt save falls back to a new one');
  await page.close();

  // ---- phones, held upright and sideways: touch controls, the radio clear of them, nothing off the side
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const p = await open(vp, true);
    await p.goto(`${base}/deep`); await ready(p);
    await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
    await p.reload(); await ready(p);
    await p.getByRole('button', { name: /expedition|boat/ }).tap();
    assert.ok(await noSideScroll(p), `${tag}: the boat fits`);
    await p.getByRole('button', { name: 'Dive! ›' }).tap();
    await until(p, () => window.__deep().screen === 'dive' && !!window.__deep().dive);
    for (const sel of ['.dg-stick', '.t-ping', '.t-lamp', '.dg-tray', '.dg-gauge', '.dg-bars']) assert.ok(inView(await rect(p, sel), vp.width, vp.height), `${tag}: ${sel} on screen`);
    for (const [a, b] of [['.dg-stick', '.t-ping'], ['.dg-stick', '.dg-tray'], ['.t-lamp', '.dg-tray'], ['.dg-gauge', '.dg-bars'], ['.dg-tray', '.dg-topbtns']]) assert.ok(!overlap(await rect(p, a), await rect(p, b)), `${tag}: ${a} clear of ${b}`);
    if (await p.locator('.dg-radio').count()) for (const sel of ['.dg-stick', '.t-ping', '.dg-tray', '.dg-gauge']) assert.ok(!overlap(await rect(p, '.dg-radio'), await rect(p, sel)), `${tag}: Enzo's radio clear of ${sel}`);
    // the stick steers: drag it down and the sub goes down
    const sr = await rect(p, '.dg-stick'), cx = sr.x + sr.w / 2, cy = sr.y + sr.h / 2, y1 = (await st(p)).dive.y;
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy + 40, id: 1 }] });
    await until(p, (y) => window.__deep().dive.y > y + 4, y1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.locator('.t-ping').tap();
    await until(p, () => window.__deep().dive.pingCd > 0);
    assert.ok(await noSideScroll(p), `${tag}: nothing off the side`);
    ok(`phone ${tag}: the touch stick steers, PING pings, the HUD fits and nothing overlaps`);
    await p.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`deep e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
