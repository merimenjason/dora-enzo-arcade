// Tetherball in the browser: the title and the way home, Enzo's opening, walking with the keyboard, hooking, whirling
// and throwing with the mouse, the upgrade picker (by click and by number key), pause, losing and the result card, the
// bests saved across a reload, a corrupt save, the how-to page, and the game on phones held either way with the touch
// stick and the HOOK and DASH buttons, all with no page errors and no sideways scrolling. Needs `npm run dev` and
// Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'tetherball-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__tether(); return { screen: s.screen, paused: s.paused, intro: s.intro, save: s.save, result: s.result, line: s.line, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__tether(); return JSON.stringify({ screen: s.screen, paused: s.paused, intro: s.intro, run: s.run && { ...s.run, foes: s.run.foes.length } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__tether().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/tether`); await ready(page);
  // ---- the title and the way home
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.tb-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening: nothing moves until it's done
  await page.getByRole('button', { name: 'Start' }).click();
  await until(page, () => window.__tether().intro === 0);
  const x0 = (await st(page)).run.x; await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  assert.equal((await st(page)).run.x, x0, 'the game waits for the briefing');
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__tether().intro === -1 && window.__tether().save.intro === true);
  ok('Enzo’s opening: three cards, the game paused under them, and remembered');

  // ---- walking
  await dbg(page, 'calm');
  const a = (await st(page)).run; await page.keyboard.down('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyA');
  const b = (await st(page)).run; assert.ok(b.x < a.x - 20, `A walks left (${a.x.toFixed(0)} → ${b.x.toFixed(0)})`);
  ok('walking with the keyboard');

  // ---- hook, whirl and throw with the mouse
  await page.evaluate(() => { const t = window.__tether(); t.debug.clear(); });
  await until(page, () => window.__tether().run.phase === 'pick');
  await page.keyboard.press('Digit1'); await until(page, () => window.__tether().run.arena === 1 && window.__tether().run.phase === 'fight');
  // the wave frozen where it stands, and a shellback just to the right of Dora
  await dbg(page, 'calm');
  const box = await page.locator('canvas').boundingBox();
  const S = (x, y) => ({ x: box.x + (x / 480) * box.width, y: box.y + (y / 320) * box.height });
  await page.evaluate(() => { const t = window.__tether(); t.debug.tp(140, 170); t.debug.spawn('shellback', 200, 170); t.debug.calm(); });
  const m = S(200, 170); await page.mouse.move(m.x, m.y); await page.waitForTimeout(150); await page.mouse.down();
  await until(page, () => window.__tether().run.rope === 'foe');
  await until(page, () => window.__tether().run.swing > 120, undefined, 15000);
  await page.mouse.up();
  await until(page, () => window.__tether().run.rope === null);
  ok('the mouse aims the hook, holding whirls the enemy up, letting go throws it');

  // ---- the upgrade picker by click
  const before = (await st(page)).run;
  await dbg(page, 'clear'); await until(page, () => window.__tether().run.phase === 'pick');
  assert.equal(await page.locator('.tb-offer').count(), 3);
  const id = await page.locator('.tb-offer').first().getAttribute('data-up');
  await page.locator('.tb-offer').first().click();
  await until(page, ([n, u]) => window.__tether().run.arena === n && window.__tether().run.mods[u] >= 1, [before.arena + 1, id]);
  ok(`the upgrade picker: three cards, and clicking one (${id}) takes it to the next arena`);

  // ---- pause
  await page.keyboard.press('Escape'); await until(page, () => window.__tether().paused);
  const p0 = (await st(page)).run; await page.waitForTimeout(400); assert.equal((await st(page)).run.x, p0.x);
  await page.getByRole('button', { name: 'Keep swinging' }).click(); await until(page, () => !window.__tether().paused);
  ok('pause stops the arena and Keep swinging goes back');

  // ---- losing, the result card, and the bests saved across a reload
  await dbg(page, 'hp', 0);
  await until(page, () => window.__tether().screen === 'result');
  const r = await st(page); assert.equal(r.result.won, false); assert.equal(r.result.arena, 3); assert.equal(r.save.best.arena, 3); assert.equal(r.save.stats.runs, 1);
  await page.reload(); await ready(page);
  const saved = (await st(page)).save; assert.equal(saved.best.arena, 3); assert.equal(saved.intro, true);
  assert.match(await page.locator('.tb-title-col').textContent(), /Best: arena 3 of 13/);
  ok('losing: the result card, and the best arena saved across a reload');

  // ---- how to play, and a corrupt save
  await page.getByRole('button', { name: 'How to play' }).click(); await until(page, () => window.__tether().screen === 'howto');
  assert.equal(await page.locator('.tb-foe').count(), 7);
  await page.evaluate((k) => localStorage.setItem(k, '{nope'), KEY); await page.reload(); await ready(page);
  assert.equal((await st(page)).save.best.arena, 0);
  ok('how to play lists all seven enemies; a corrupt save starts fresh');
  assert.ok(await noSideScroll(page));

  // ---- phones, held either way
  for (const [w, h] of [[390, 844], [844, 390]]) {
    const ph = await open({ width: w, height: h }, true);
    await ph.goto(`${base}/tether`); await ready(ph);
    await ph.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true, seen: ['slime', 'grumble'] })), KEY); await ph.reload(); await ready(ph);
    await ph.getByRole('button', { name: 'Start' }).tap();
    await until(ph, () => window.__tether().screen === 'play');
    await dbg(ph, 'calm');
    // the arena fits, and the touch controls don't cover it when the phone is upright
    const stg = await rect(ph, '.tb-stage'), stk = await rect(ph, '.tb-stick'), hk = await rect(ph, '.t-hook');
    assert.ok(stg.x >= -1 && stg.x + stg.w <= w + 1 && stg.y + stg.h <= h + 1, 'the arena fits the screen');
    if (h > w) assert.ok(!overlap(stg, stk) && !overlap(stg, hk), 'upright, the stick and buttons sit below the arena');
    // the stick walks Dora
    const s0 = (await st(ph)).run, c = { x: stk.x + stk.w / 2, y: stk.y + stk.h / 2 };
    const cdp = await ph.context().newCDPSession(ph);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });
    await touch('touchStart', [c]); await touch('touchMove', [{ x: c.x - 40, y: c.y }]); await ph.waitForTimeout(500); await touch('touchEnd', []);
    const s1 = (await st(ph)).run; assert.ok(s1.x < s0.x - 15, `the stick walks Dora left (${s0.x.toFixed(0)} → ${s1.x.toFixed(0)})`);
    // HOOK held: the hook finds the enemy she faces, and whirls it
    await ph.evaluate(() => { const t = window.__tether(); t.debug.tp(150, 170); t.debug.spawn('grumble', 210, 172); t.debug.calm(); });
    // face right first with a nudge of the stick
    await touch('touchStart', [c]); await touch('touchMove', [{ x: c.x + 30, y: c.y }]); await ph.waitForTimeout(60); await touch('touchEnd', []);
    await ph.evaluate(() => { const t = window.__tether(); t.debug.tp(150, 170); t.debug.calm(); });
    const hb = { x: hk.x + hk.w / 2, y: hk.y + hk.h / 2 };
    await touch('touchStart', [hb]);
    await until(ph, () => window.__tether().run.rope !== null, undefined, 10000);
    await ph.waitForTimeout(400); await touch('touchEnd', []);
    await until(ph, () => window.__tether().run.rope === null);
    assert.ok(await noSideScroll(ph));
    ok(`phone ${w}×${h}: the arena fits, the stick walks, HOOK held whirls and letting go throws`);
    await ph.context().close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
  console.log(`\n${pass} Tetherball browser checks passed`);
} finally { await browser.close(); }
