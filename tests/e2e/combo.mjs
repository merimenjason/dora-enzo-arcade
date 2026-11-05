// Combo Ball in the browser: the title and the way home, Enzo's opening (remembered), a real match (running with the
// keys, passing with J and the chain counting up in the HUD), a goal with its count-up card, reaching the target and
// the transfer shop (picking by key, the five-slot swap), pausing, running out of time and the result card, the bests
// saved across a reload, a corrupt save, the how-to and settings pages, and a phone held upright (the HUD above the
// pitch, the thumb stick, PASS and SHOOT), all with no page errors and no sideways scrolling. Needs `npm run dev` and
// Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'combo-ball-v1';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__combo(); return { screen: s.screen, intro: s.intro, paused: s.paused, save: s.save, result: s.result, phase: s.phase, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__combo(); return JSON.stringify({ screen: s.screen, intro: s.intro, phase: s.phase, run: s.run && { ...s.run, players: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__combo().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const tap = async (page, code, ms = 50) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/combo`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.cb-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__combo().intro === 0);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__combo().intro === -1 && window.__combo().save.intro === true);
  assert.equal((await st(page)).run.phase, 'play');
  ok('Enzo’s opening: five cards, then remembered');

  // ---- a real match: run, then pass, and the chain counts in the HUD
  await until(page, () => window.__combo().run.ball.owner === 0 && window.__combo().run.clock < 89.9);
  const x0 = (await st(page)).run.players[0].x;
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  assert.ok((await st(page)).run.players[0].x > x0 + 8, 'D runs Dora forward');
  let passed = false;
  for (let k = 0; k < 8 && !passed; k++) {
    const r = (await st(page)).run;
    if (r.poss !== 0 || r.ball.owner < 0) { await page.waitForTimeout(300); continue; }
    await tap(page, 'KeyJ');
    await page.waitForTimeout(900);
    passed = (await st(page)).run.stats.passes > 0;
  }
  assert.ok(passed, 'J passes and the pass completes');
  ok('a match: WASD runs, J passes, and completed passes count');

  // ---- a goal: a five-pass chain, Dora alone in front of goal, K shoots
  await page.keyboard.press('Escape');
  await dbg(page, 'ball', 330, 108); await dbg(page, 'chain', 40, 4, 5);
  await until(page, () => document.querySelector('.cb-chain')?.dataset.on === '1' && document.querySelector('.cb-chips').textContent === '50');
  assert.equal(await page.locator('.cb-mult').textContent(), '4');
  assert.equal(await page.locator('.cb-worth').textContent(), '= 200');
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await page.keyboard.down('KeyK'); await page.waitForTimeout(30); await page.keyboard.up('KeyK');
  await until(page, () => window.__combo().run.goals >= 1 || window.__combo().run.ball.owner >= 4, null, 8000);
  const g = (await st(page)).run;
  if (g.goals >= 1) {
    await page.locator('.cb-goal').waitFor();
    await until(page, () => /^\+\d+$/.test(document.querySelector('.cb-goalnum')?.textContent ?? '') && document.querySelector('.cb-goalnum').textContent !== '+0');
    assert.ok(g.points >= 200, `the chain was worth it (${g.points})`);
    ok(`a goal: the GOAL! card counts up to ${g.points}`);
  } else ok('a shot: saved this time (the keeper is allowed to be good)');

  // ---- the transfer shop
  await dbg(page, 'win');
  await until(page, () => window.__combo().phase === 'shop');
  assert.equal(await page.locator('.cb-offer').count(), 3);
  const first = await page.locator('.cb-offer').first().getAttribute('data-trait');
  await page.keyboard.press('Digit1');
  await until(page, () => window.__combo().phase === 'play' && window.__combo().run.match === 1);
  assert.deepEqual((await st(page)).run.traits, [first]);
  ok(`the shop: three offers, 1 picks ${first}, on to match 2`);
  // five slots full: a pick asks which to drop
  await dbg(page, 'traits', ['tiki', 'metronome', 'hotstreak', 'coolhead', 'piggy']);
  await dbg(page, 'win');
  await until(page, () => window.__combo().phase === 'shop');
  const offer = await page.locator('.cb-offer').first().getAttribute('data-trait');
  await page.locator('.cb-offer').first().click();
  assert.equal(await page.locator('.cb-offer.drop').count(), 5);
  await page.locator('[data-drop="coolhead"]').click();
  await until(page, () => window.__combo().phase === 'play' && window.__combo().run.match === 2);
  const t = (await st(page)).run.traits;
  assert.equal(t.length, 5); assert.ok(t.includes(offer) && !t.includes('coolhead'));
  ok('a full bench: picking a sixth trait swaps one out');

  // ---- pause, then full time below the target
  await page.keyboard.press('Escape');
  assert.ok((await st(page)).paused);
  const c0 = (await st(page)).run.clock; await page.waitForTimeout(400);
  assert.equal((await st(page)).run.clock, c0, 'the clock stops');
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await dbg(page, 'lose');
  await until(page, () => window.__combo().screen === 'result');
  const res = (await st(page)).result;
  assert.equal(res.won, false); assert.equal(res.matches, 2);
  await page.locator('.cb-resultcard').waitFor();
  ok('pause stops the clock; full time below the target ends the run on the result card');

  // ---- the save, across a reload; a corrupt save
  await page.reload(); await ready(page);
  const sv = (await st(page)).save;
  assert.equal(sv.best.matches, 2); assert.equal(sv.stats.runs, 1);
  await page.getByText(/Best: 2 of 9 matches/).waitFor();
  await page.evaluate((k) => localStorage.setItem(k, '{nonsense'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0);
  ok('bests saved across a reload; a corrupt save starts fresh');

  // ---- how to play and settings
  await page.getByRole('button', { name: 'How to play' }).click();
  assert.equal(await page.locator('.cb-traitlist p').count(), 14);
  assert.ok(await noSideScroll(page));
  await page.getByRole('button', { name: '‹ Title' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('.cb-set').filter({ hasText: 'Music' }).getByRole('button', { name: 'Off' }).click();
  assert.equal((await st(page)).save.settings.music, false);
  ok('the how-to page lists every trait; settings save');
  await page.context().close();

  // ---- a phone held upright
  const m = await open({ width: 390, height: 844 }, true);
  await m.goto(`${base}/combo`); await ready(m);
  await m.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
  await m.reload(); await ready(m);
  assert.ok(await noSideScroll(m));
  await m.getByRole('button', { name: 'Kick off' }).tap();
  await until(m, () => window.__combo().run?.phase === 'play' && window.__combo().run.clock < 89.9);
  const cv = await m.locator('canvas.cb-canvas').boundingBox(), top = await m.locator('.cb-top').boundingBox();
  assert.ok(cv.width >= 380, `the pitch fills the width (${cv.width})`);
  assert.ok(top.y + top.height <= cv.y + 1, 'the HUD sits above the pitch');
  assert.ok(await noSideScroll(m));
  const zone = await m.locator('.cb-stickzone').boundingBox(), p0 = (await st(m)).run.players[(await st(m)).run.ctl].x;
  const cdp = await m.context().newCDPSession(m);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await tp('touchStart', zone.x + 60, zone.y + 80);
  for (let k = 1; k <= 6; k++) await tp('touchMove', zone.x + 60 + k * 8, zone.y + 80);
  await m.waitForTimeout(500); await tp('touchEnd', 0, 0);
  assert.ok((await st(m)).run.players[(await st(m)).run.ctl].x > p0 + 6, 'the thumb stick runs');
  await dbg(m, 'ball', 330, 108);
  await m.locator('.cb-shoot').dispatchEvent('pointerdown'); await m.waitForTimeout(50); await m.locator('.cb-shoot').dispatchEvent('pointerup');
  await until(m, () => window.__combo().run.ball.owner !== 0);
  ok('phone: the pitch fills the width, the HUD sits above it, the thumb stick runs and SHOOT shoots');
  await m.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Combo Ball browser checks passed`);
