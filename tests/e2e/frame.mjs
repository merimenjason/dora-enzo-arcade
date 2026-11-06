// Out of Frame in the browser: the title and the way home, Enzo's opening (nothing moves under it), the mouse pointing
// the frame and a click jumping, the keys nudging the frame and C centring it, the frog pond and the bat roost, the lens picker (by click and by number
// key), pause, the film running out and the result card, the bests saved across a reload, a corrupt save, the how-to
// page, and the game on phones held either way (a finger drags the frame, the JUMP button jumps), all with no page
// errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'out-of-frame-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
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
const st = (page) => page.evaluate(() => { const s = window.__frame(); return { screen: s.screen, paused: s.paused, intro: s.intro, save: s.save, result: s.result, line: s.line, run: s.run, aim: s.aim }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__frame(); return JSON.stringify({ screen: s.screen, paused: s.paused, intro: s.intro, run: s.run && { ...s.run, ents: s.run.ents.length } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__frame().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** a game point on the canvas, in page pixels */
const at = async (page, x, y) => { const c = await rect(page, 'canvas'); return { x: c.x + (x / 480) * c.w, y: c.y + (y / 256) * c.h }; };
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/frame`); await ready(page);
  // ---- the title and the way home
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.of-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening: nothing moves until it's done
  await page.getByRole('button', { name: 'Start' }).click();
  await until(page, () => window.__frame().intro === 0);
  const x0 = (await st(page)).run.dora.x; await page.waitForTimeout(500);
  assert.equal((await st(page)).run.dora.x, x0, 'the game waits for the briefing');
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__frame().intro === -1 && window.__frame().save.intro === true);
  ok('Enzo’s opening: four cards, the game paused under them, and remembered');

  // ---- the mouse points the frame; Dora walks while she's in it
  const d = (await st(page)).run.dora;
  let p = await at(page, d.x + 40, d.y - 30); await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(700);
  let s = await st(page);
  assert.ok(Math.abs(s.aim.x - (d.x + 40)) < 3, 'the mouse sets the aim');
  assert.ok(s.run.dora.x > d.x + 10 && s.run.dora.live, 'Dora walks inside the frame');
  // point it far away and she freezes
  p = await at(page, 440, 40); await page.mouse.move(p.x, p.y);
  await until(page, () => !window.__frame().run.dora.live);
  const fx = (await st(page)).run.dora.x; await page.waitForTimeout(400);
  assert.equal((await st(page)).run.dora.x, fx, 'frozen outside the frame');
  ok('the mouse points the frame: Dora walks in it and freezes out of it');

  // ---- keys nudge the frame, and C brings it back to Dora
  await page.keyboard.press('KeyC');
  await until(page, () => window.__frame().run.dora.live);
  const a0 = (await st(page)).aim; await page.keyboard.down('KeyS'); await page.waitForTimeout(250); await page.keyboard.up('KeyS');
  assert.ok((await st(page)).aim.y > a0.y + 20, 'S moves the frame down');
  await page.keyboard.press('KeyC');
  // a click jumps
  await dbg(page, 'tp', 60, 192); await page.keyboard.press('KeyC'); await page.waitForTimeout(150);
  const c = await rect(page, 'canvas'); await page.mouse.click(c.x + c.w * 0.2, c.y + c.h * 0.6);
  await until(page, () => window.__frame().run.dora.ground === false);
  ok('WASD nudges the frame, C centres it on Dora, and a click jumps');

  // ---- the frog pond and the bat roost: with Dora frozen to one side, the frog hops up out of the water and the bat
  // swoops off its roost
  await dbg(page, 'segments', ['start', 'pond']); await page.mouse.move(0, 0);
  await dbg(page, 'aim', 360, 190);
  await until(page, () => window.__frame().run.ents.some((e) => e.k === 'frog' && e.y < 185) && !window.__frame().run.dora.live);
  const hp = (await st(page)).run.hp;
  await dbg(page, 'segments', ['start', 'roost']); await dbg(page, 'tp', 300, 192); await dbg(page, 'aim', 380, 150);
  await until(page, () => window.__frame().run.ents.some((e) => e.k === 'bat' && e.s === 'out'));
  await page.waitForTimeout(800);
  assert.ok(hp > 0); assert.equal((await st(page)).run.hp, hp, 'frozen Dora is safe from them');
  ok('the frog pond and the bat roost: the frog hops and the bat swoops while they’re in the picture');

  // ---- the lens picker
  await dbg(page, 'clear');
  await until(page, () => window.__frame().run.phase === 'pick');
  assert.equal(await page.locator('.of-offer').count(), 3);
  const first = (await st(page)).run.offer[0];
  await page.locator('.of-offer').first().click();
  await until(page, () => window.__frame().run.phase === 'play' && window.__frame().run.screen === 1);
  assert.equal((await st(page)).run.lenses[first], 1);
  await dbg(page, 'clear'); await until(page, () => window.__frame().run.phase === 'pick');
  const second = (await st(page)).run.offer[1];
  await page.keyboard.press('Digit2');
  await until(page, () => window.__frame().run.screen === 2);
  assert.ok((await st(page)).run.lenses[second] >= 1);
  ok('the lens picker: three lenses, picked by click or by number key, and on to the next screen');

  // ---- pause
  await page.keyboard.press('Escape'); await until(page, () => window.__frame().paused);
  const film = (await st(page)).run.film; await page.waitForTimeout(400);
  assert.equal((await st(page)).run.film, film, 'the film stops while paused');
  await page.getByRole('button', { name: 'Keep filming' }).click(); await until(page, () => !window.__frame().paused);
  ok('pause: Esc stops the clock, and the button carries on');

  // ---- the film runs out: the result card, and the best kept across a reload
  await dbg(page, 'film', 0.2);
  await until(page, () => window.__frame().screen === 'result' && window.__frame().result !== null);
  s = await st(page);
  assert.equal(s.result.won, false); assert.equal(s.result.film, true); assert.equal(s.result.screen, 3);
  assert.match(await page.locator('.of-resultcard h2').innerText(), /film ran out/);
  assert.equal(s.save.stats.runs, 1); assert.equal(s.save.best.screen, 3);
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.best.screen, 3); assert.equal(s.save.intro, true);
  assert.match(await page.locator('.of-small').first().innerText(), /screen 3 of 9/);
  ok('the film running out ends the run, and the result and best survive a reload');

  // ---- a broken save starts fresh
  await page.evaluate((k) => localStorage.setItem(k, '{nope'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0);
  ok('a corrupt save is ignored');

  // ---- how to play
  await page.getByRole('button', { name: 'How to play' }).click();
  await until(page, () => window.__frame().screen === 'howto');
  assert.equal(await page.locator('.of-foe').count(), 6, 'Grumble, frog, bat, boulder, arrow and rock');
  assert.ok(await page.locator('.of-foe img').evaluateAll((ims) => ims.every((i) => i.complete && i.naturalWidth > 0)), 'every creature’s picture loads');
  assert.ok(await noSideScroll(page));
  await page.getByRole('button', { name: '‹ Title' }).click();
  ok('the how-to page: the viewfinder, freezing, film and who’s who');
  await page.context().close();

  // ---- phones, both ways round
  for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const m = await open(vp, true);
    await m.goto(`${base}/frame`); await ready(m);
    await m.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
    await m.reload(); await ready(m);
    await m.getByRole('button', { name: 'Start' }).tap();
    await until(m, () => window.__frame().screen === 'play' && window.__frame().intro === -1);
    assert.ok(await noSideScroll(m), 'no sideways scroll');
    const canvas = await rect(m, 'canvas'), jump = await rect(m, '.of-jump');
    assert.ok(canvas.w >= vp.width * 0.9 || canvas.h >= vp.height * 0.9, 'the picture fills the screen one way');
    assert.ok(!overlap(canvas, jump) || vp.width > vp.height, 'upright, the JUMP button is below the picture');
    assert.ok(jump.w >= 88 && jump.h >= 88, 'a big JUMP button');
    // a finger dragging moves the frame by as much as it moves, not to where it is
    const a = (await st(m)).aim;
    const cdp = await m.context().newCDPSession(m);
    const px = canvas.x + canvas.w * 0.5, py = canvas.y + canvas.h * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: px, y: py, id: 1 }] });
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: px + i * 8, y: py, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const b = (await st(m)).aim;
    assert.ok(b.x > a.x + 5, `the drag moved the frame (${a.x} → ${b.x})`);
    await dbg(m, 'tp', 60, 192); await m.waitForTimeout(100);
    await m.locator('.of-jump').dispatchEvent('pointerdown', { pointerType: 'touch' });
    await m.waitForTimeout(60); await m.locator('.of-jump').dispatchEvent('pointerup', { pointerType: 'touch' });
    await until(m, () => window.__frame().run.dora.ground === false || window.__frame().run.dora.y < 192);
    ok(`phone ${vp.width}×${vp.height}: the picture fits, a drag moves the frame, and JUMP jumps`);
    await m.context().close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Out of Frame browser checks passed`);
