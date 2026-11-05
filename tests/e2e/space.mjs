// Into Space in the browser: the title and the way home, Enzo's opening, kicking off, holding J to walk a pass out and
// letting go (control jumping to the runner), a lofted pass with a right click onto a spot and a timed run that
// arrives perfect (time slows down), winning a match into the changing room with the next opponent and three picks,
// picking by key, pausing, losing and the result card, the bests saved across a reload, a corrupt save, the how-to
// page, and a phone held upright (the pitch above the controls, the thumb stick and a PASS drag), all with no page
// errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'into-space-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__space(); return { screen: s.screen, intro: s.intro, paused: s.paused, save: s.save, result: s.result, line: s.line, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__space(); return JSON.stringify({ screen: s.screen, intro: s.intro, run: s.run && { ...s.run, players: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__space().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const toScreen = async (page, x, y) => { const b = await page.locator('canvas.is-canvas').boundingBox(); return [b.x + (x * b.width) / 384, b.y + (y * b.height) / 216]; };
/** Dora on the ball in midfield, Enzo free ahead of her, the Grumbles out of the way */
const setPiece = async (page) => {
  await dbg(page, 'clear');
  await dbg(page, 'place', 1, 120, 120); await dbg(page, 'place', 2, 185, 165); await dbg(page, 'place', 3, 60, 60); await dbg(page, 'place', 4, 50, 180);
  await dbg(page, 'give', 1);
};
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/space`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.is-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__space().intro === 0);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__space().intro === -1 && window.__space().save.intro === true);
  await until(page, () => window.__space().run?.state === 'play');
  let s = await st(page);
  assert.equal(s.run.round, 0); assert.equal(s.run.pitch, 'dry'); assert.equal(s.run.who, 'dora', 'Dora kicks off');
  ok('Enzo’s opening: four cards, remembered, then kick-off with Dora on the ball');

  // ---- holding J walks the pass out; letting go passes and hands us the runner
  await setPiece(page);
  await page.keyboard.down('KeyD'); await page.keyboard.down('KeyJ'); await page.waitForTimeout(350);
  s = await st(page); assert.ok(s.run.reticle && s.run.reticle.x > 140, 'the target is out ahead of Dora');
  await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyD');
  await until(page, () => { const r = window.__space().run; return r.pass && r.who !== 'dora'; });
  ok('keyboard: hold J and the target walks out ahead; let go and control jumps to the runner');

  // ---- a lofted pass with a right click, and a run timed onto it: perfect, and time slows down
  await setPiece(page);
  await dbg(page, 'auto', true);
  const [sx, sy] = await toScreen(page, 218, 150);
  await page.mouse.move(sx, sy); await page.waitForTimeout(60);
  await page.mouse.click(sx, sy, { button: 'right' });
  await until(page, () => window.__space().run.rating?.r === 'perfect', undefined, 5000);
  s = await st(page);
  assert.equal(s.run.who, 'enzo'); assert.ok(s.run.streak >= 1);
  assert.ok(s.run.slow > 0 || s.run.gt - s.run.rating.at < 0.5, 'time slows down');
  await dbg(page, 'auto', false);
  ok('mouse: a right-click loft onto a spot, Enzo runs onto it, PERFECT and slow motion');

  // ---- pausing
  await page.keyboard.press('Escape');
  await until(page, () => window.__space().paused === true);
  const gt = (await st(page)).run.gt; await page.waitForTimeout(300);
  assert.equal((await st(page)).run.gt, gt, 'the clock stops');
  await page.getByRole('button', { name: 'Play on' }).click();
  await until(page, () => window.__space().paused === false);
  ok('Esc pauses, the match stands still, Play on carries on');

  // ---- winning: the changing room, the next opponent, three picks, a pick by key
  await dbg(page, 'win');
  await until(page, () => window.__space().run?.phase === 'pick');
  await page.locator('.is-offer').first().waitFor();
  assert.equal(await page.locator('.is-offer').count(), 3);
  assert.match(await page.locator('.is-next').innerText(), /Puddle Athletic/);
  const up = (await st(page)).run.upcoming, first = (await st(page)).run.offer[0];
  await page.keyboard.press('Digit1');
  await until(page, () => window.__space().run?.phase === 'match' && window.__space().run.round === 1);
  s = await st(page); assert.ok(s.run.perks[first], 'the pick is kept'); assert.equal(s.run.pitch, up.pitch); assert.equal(s.run.shape, up.shape);
  ok('a win: the changing room shows the next team and pitch, three picks, 1 picks the first');

  // ---- losing: the result card, and the bests saved
  await dbg(page, 'lose');
  await until(page, () => window.__space().screen === 'result');
  assert.match(await page.locator('.is-resultcard h2').innerText(), /Knocked out/);
  s = await st(page); assert.equal(s.save.stats.runs, 1); assert.equal(s.save.best.round, 1); assert.ok(s.save.best.flow >= 1);
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.best.round, 1); assert.equal(s.save.intro, true);
  assert.match(await page.locator('.is-title').innerText(), /1 round won/);
  ok('a defeat ends the run: the result card, and the best round saved across a reload');

  // ---- a corrupt save, the how-to page
  await page.evaluate((k) => localStorage.setItem(k, '{not json'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0);
  await page.getByRole('button', { name: 'How to play' }).click();
  assert.match(await page.locator('.is-page').innerText(), /Pass into space/);
  assert.ok(await noSideScroll(page));
  ok('a corrupt save starts fresh; the how-to page');
  await page.context().close();

  // ---- a phone held upright
  const m = await open({ width: 390, height: 844 }, true);
  await m.addInitScript((k) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ v: 1, intro: true, best: { round: 0, flow: 0, goals: 0 }, stats: { runs: 0, cups: 0, goals: 0, perfects: 0 }, settings: { sound: false, music: false } })); }, KEY);
  await m.goto(`${base}/space`); await ready(m);
  assert.ok(await noSideScroll(m));
  await m.getByRole('button', { name: 'Kick off' }).click();
  await until(m, () => window.__space().run?.state === 'play');
  const stage = await m.locator('.is-stage').boundingBox(), pad = await m.locator('.is-touchpad').boundingBox();
  assert.ok(stage.y + stage.height <= pad.y + 1, 'the pitch sits above the controls'); assert.ok(stage.width >= 380);
  assert.ok(await noSideScroll(m));
  const cdp = await m.context().newCDPSession(m);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const zone = await m.locator('.is-stickzone').boundingBox();
  const y0 = (await st(m)).run.players[1].y;
  await tp('touchStart', zone.x + 60, zone.y + 80);
  for (let k = 1; k <= 6; k++) await tp('touchMove', zone.x + 60, zone.y + 80 + k * 8);
  await m.waitForTimeout(600); await tp('touchEnd', 0, 0);
  assert.ok((await st(m)).run.players[1].y > y0 + 10, 'the thumb stick runs Dora');
  // drag out from PASS and let go
  await setPiece(m);
  const pb = await m.locator('.is-pass').boundingBox(), cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2;
  await tp('touchStart', cx, cy);
  for (let k = 1; k <= 5; k++) await tp('touchMove', cx + k * 10, cy - k * 4);
  await tp('touchEnd', 0, 0);
  await until(m, () => { const r = window.__space().run; return !!r.pass && r.who !== 'dora'; });
  ok('phone: the pitch above the controls, the thumb stick runs, a PASS drag passes and hands over the runner');
  await m.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Into Space browser checks passed`);
