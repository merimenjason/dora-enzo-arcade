// Coin of the Realm in the browser: the title and the way home, Enzo's opening, spending the coin by clicking a glowing
// townsfolk and by the keyboard, filling an order, waiting an hour, building a bridge and the perk picker, running out
// of days and the result card, the bests saved across a reload, a corrupt save, the how-to page, and a phone held
// upright (tap once to choose, again to spend), all with no page errors and no sideways scrolling. Needs `npm run dev`
// and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'coin-of-the-realm-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__coin(); return { screen: s.screen, intro: s.intro, save: s.save, result: s.result, line: s.line, playing: s.playing, sel: s.sel, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__coin(); return JSON.stringify({ screen: s.screen, intro: s.intro, playing: s.playing, run: s.run && { ...s.run, folk: s.run.folk.length } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__coin().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** where a townsfolk stands on the screen */
const spot = async (page, id) => {
  const box = await page.locator('canvas').boundingBox(), f = (await st(page)).run.folk[id];
  return { x: box.x + (f.x / 384) * box.width, y: box.y + ((f.y - 8) / 216) * box.height };
};
const settle = (page) => until(page, () => !window.__coin().playing);
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/coin`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.cr-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening
  await page.getByRole('button', { name: 'Start' }).click();
  await until(page, () => window.__coin().intro === 0);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__coin().intro === -1 && window.__coin().save.intro === true);
  ok('Enzo’s opening: four cards, then remembered');

  // ---- spending the coin: a click on a glowing townsfolk, then the keyboard
  let s = await st(page);
  assert.equal(s.run.holder, s.run.folk.find((f) => f.kind === 'mayor').id); assert.equal(s.run.face, 'dora');
  const seller = await dbg(page, 'seller');
  const to = seller >= 0 ? seller : s.run.targets[0];
  const p = await spot(page, to); await page.mouse.click(p.x, p.y);
  await until(page, () => window.__coin().playing); await settle(page);
  s = await st(page);
  assert.equal(s.run.holder, to); assert.equal(s.run.hour, 1); assert.equal(s.run.face, 'enzo');
  if (seller >= 0) assert.ok(s.run.planks >= 1 || s.run.orders.some((o) => !o.done), 'an order filled, unless the seller was grumpy');
  assert.ok(s.run.known.some((k, i) => k && ['baker', 'woodcutter', 'smith', 'weaver', 'fisher', 'potter'].includes(s.run.folk[i].kind)), 'Enzo-side up, Enzo overheard someone');
  await page.keyboard.press('ArrowRight');
  const pick = (await st(page)).sel; assert.ok(s.run.targets.includes(pick), '→ chooses someone the coin can reach');
  await page.keyboard.press('Enter'); await until(page, () => window.__coin().playing); await settle(page);
  assert.equal((await st(page)).run.holder, pick); assert.equal((await st(page)).run.face, 'dora');
  await page.getByRole('button', { name: 'Wait an hour' }).click(); await settle(page);
  assert.equal((await st(page)).run.hour, 3);
  ok('spending: a click on a glowing townsfolk, ← → and Enter, the coin turns over, Enzo overhears, and waiting an hour');

  // ---- building the bridge
  await dbg(page, 'planks', (await st(page)).run.goal - 1);
  for (let i = 0; i < 12 && (await st(page)).run.phase === 'play'; i++) {
    const id = await dbg(page, 'seller'); const q = await spot(page, id >= 0 ? id : (await st(page)).run.targets[0]);
    await page.mouse.click(q.x, q.y); await page.waitForTimeout(50); await settle(page);
  }
  await until(page, () => window.__coin().run.phase === 'pick');
  assert.equal(await page.locator('.cr-offer').count(), 3);
  await page.keyboard.press('Digit1');
  await until(page, () => window.__coin().run.ix === 1 && window.__coin().run.phase === 'play');
  ok('the bridge built: Dora’s pockets open, and on to the next town');

  // ---- running out of days
  await dbg(page, 'lastDay');
  for (let i = 0; i < 20 && (await st(page)).run?.phase === 'play'; i++) { await page.keyboard.press('KeyW'); await page.waitForTimeout(40); await settle(page); }
  await until(page, () => window.__coin().screen === 'result', null, 15000);
  s = await st(page);
  assert.equal(s.result.won, false); assert.equal(s.result.towns, 1); assert.equal(s.save.best.towns, 1);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.cr-small').first().innerText(), /1 of 4 bridges/);
  ok('out of days: melted down, and the best survives a reload');

  await page.evaluate((k) => localStorage.setItem(k, '{nope'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0);
  ok('a corrupt save is ignored');

  await page.getByRole('button', { name: 'How to play' }).click();
  await until(page, () => window.__coin().screen === 'howto');
  assert.equal(await page.locator('.cr-foe').count(), 12);
  assert.ok(await noSideScroll(page));
  ok('the how-to page: being a coin, the bridge, and every townsfolk');
  await page.context().close();

  // ---- a phone held upright
  const m = await open({ width: 390, height: 844 }, true);
  await m.goto(`${base}/coin`); await ready(m);
  await m.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
  await m.reload(); await ready(m);
  await m.getByRole('button', { name: 'Start' }).tap();
  await until(m, () => window.__coin().screen === 'play');
  assert.ok(await noSideScroll(m));
  const cv = await m.locator('canvas').boundingBox();
  assert.ok(cv.width >= 360, `the town fills the width (${cv.width})`);
  const t = (await st(m)).run.targets[0], q = await spot(m, t);
  await m.touchscreen.tap(q.x, q.y);
  assert.equal((await st(m)).sel, t, 'one tap chooses'); assert.equal((await st(m)).run.hour, 0);
  await m.getByRole('button', { name: 'Spend here ›' }).tap(); await settle(m);
  assert.equal((await st(m)).run.holder, t, 'and Spend spends');
  ok('phone: the town fills the width, a tap chooses and Spend spends');
  await m.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Coin of the Realm browser checks passed`);
