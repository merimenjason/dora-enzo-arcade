// Turn Order in the browser: the title and the way home, Enzo's opening, the queue bar (one swap by click and by the
// keyboard, undo, a token to the front, a hint), the ghost's verdict, playing a round and skipping it, planting an acorn
// and the perk picker, losing every try and the result card, the bests saved across a reload, a corrupt save, the
// how-to page, and a phone held upright, all with no page errors and no sideways scrolling. Needs `npm run dev` and
// Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'turn-order-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__order(); return { screen: s.screen, intro: s.intro, save: s.save, result: s.result, line: s.line, playing: s.playing, sel: s.sel, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__order(); return JSON.stringify({ screen: s.screen, intro: s.intro, playing: s.playing, run: s.run && { ...s.run, pieces: s.run.pieces.length } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__order().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** play the round and wait for it to finish */
const goRound = async (page) => { await page.getByRole('button', { name: 'Go! ›' }).click(); await until(page, () => window.__order().playing); await page.getByRole('button', { name: 'Skip ›' }).click(); await until(page, () => !window.__order().playing); };
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/order`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.to-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening
  await page.getByRole('button', { name: 'Start' }).click();
  await until(page, () => window.__order().intro === 0);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__order().intro === -1 && window.__order().save.intro === true);
  ok('Enzo’s opening: four cards, then remembered');

  // ---- the queue bar
  let s = await st(page);
  const q = s.run.order;
  await page.locator('.to-swap').first().click();
  s = await st(page);
  assert.deepEqual(s.run.order.slice(0, 2), [q[1], q[0]]); assert.equal(s.run.swapsLeft, 0);
  assert.equal(await page.locator('.to-swap:not([disabled])').count(), 1, 'only the swap made stays clickable, to undo it');
  await page.getByRole('button', { name: 'Undo' }).click();
  assert.deepEqual((await st(page)).run.order, q);
  await page.keyboard.press('Space');
  assert.deepEqual((await st(page)).run.order.slice(0, 2), [q[1], q[0]], 'Space swaps at the cursor');
  await page.keyboard.press('KeyZ');
  // a token to the front
  await page.locator('.to-slot').last().click();
  await page.getByRole('button', { name: /To the front/ }).click();
  s = await st(page);
  assert.equal(s.run.order[0], q[q.length - 1]); assert.equal(s.run.tokens, 1);
  await page.getByRole('button', { name: 'Undo' }).click();
  assert.equal((await st(page)).run.tokens, 2, 'undo gives the token back');
  ok('the queue bar: a swap by click or Space, undo, and a token to send a critter to the front');

  // ---- a hint, then planting the acorn by following the solver
  await page.getByRole('button', { name: 'Hint' }).click();
  await until(page, () => /My ears say/.test(window.__order().line?.text ?? ''));
  assert.equal((await st(page)).run.tokens, 1);
  for (let i = 0; i < 8 && (await st(page)).run.phase === 'plan'; i++) { await dbg(page, 'solve'); await goRound(page); }
  s = await st(page);
  assert.equal(s.run.phase, 'pick'); assert.equal(s.run.stats.boards, 1);
  assert.equal(await page.locator('.to-offer').count(), 3);
  await page.keyboard.press('Digit2');
  await until(page, () => window.__order().run.ix === 1 && window.__order().run.phase === 'plan');
  ok('a hint from Enzo, then following the ghost plants the acorn and Enzo’s satchel opens');

  // ---- the ghost's verdict, and losing every try
  await dbg(page, 'hp', 1);
  // leave the queue alone until something goes wrong: no garden is won that way
  for (let i = 0; i < 8 && (await st(page)).run?.phase === 'plan'; i++) {
    if (i === 0) assert.match(await page.locator('.to-status').innerText(), /ghost says|swap/);
    await goRound(page);
  }
  await until(page, () => window.__order().screen === 'result', null, 15000);
  s = await st(page);
  assert.equal(s.result.won, false); assert.equal(s.result.board, 2); assert.equal(s.save.best.board, 2);
  await page.reload(); await ready(page);
  assert.match(await page.locator('.to-small').first().innerText(), /garden 2 of 11/);
  ok('leaving the queue alone loses; no tries left ends the run, and the best survives a reload');

  await page.evaluate((k) => localStorage.setItem(k, '{nope'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0);
  ok('a corrupt save is ignored');

  await page.getByRole('button', { name: 'How to play' }).click();
  await until(page, () => window.__order().screen === 'howto');
  assert.equal(await page.locator('.to-foe').count(), 8);
  assert.ok(await noSideScroll(page));
  ok('the how-to page: conducting, tokens and every critter');
  await page.context().close();

  // ---- a phone held upright
  const m = await open({ width: 390, height: 844 }, true);
  await m.goto(`${base}/order`); await ready(m);
  await m.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
  await m.reload(); await ready(m);
  await m.getByRole('button', { name: 'Start' }).tap();
  await until(m, () => window.__order().screen === 'play');
  assert.ok(await noSideScroll(m));
  const cv = await m.locator('canvas').boundingBox();
  assert.ok(cv.width >= 360, `the garden fills the width (${cv.width})`);
  const go = await m.getByRole('button', { name: 'Go! ›' }).boundingBox();
  assert.ok(go.y + go.height <= 844 && go.height >= 40, 'Go! is on screen and big enough');
  await m.locator('.to-swap').first().tap();
  assert.equal((await st(m)).run.swapsLeft, 0);
  ok('phone: the garden fills the width, the queue and Go! fit, and a tap swaps');
  await m.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Turn Order browser checks passed`);
