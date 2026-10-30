// Starstitch in the browser: the arcade card and the menu (the Daily Sky and the Shooting Star wait for the end of the
// story); the first lesson stitched with the real mouse in one go, dragged star to star, earning the ★ and a hint; the
// second stitched with the keyboard alone; the tools on a later constellation (a refused seam, unpicking by dragging
// back, the Unpick button and Z, starting again with R, a hint with H and the free hint used up), and a twin's leap;
// the save across a reload, the sky chart and the Night Journal; a corrupt save; the framing at 1280×800 and 1920×1080
// (Dora and Enzo a clear size, nothing over them or over a star, the done card beside the sky); and phones held either
// way, stitched by touch. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'starstitch-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const game = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => game(page, () => { const g = window.__stars(), s = g.st; return { screen: g.screen, puzzle: g.puzzle, at: s?.at, stitched: s?.stitched, total: s?.total, done: s?.done, clean: s?.clean, unpicks: s?.unpicks, restarts: s?.restarts, hints: s?.hints, bank: g.save.bank, path: s ? s.path() : [] }; });
const pt = (page, i) => game(page, (k) => window.__starsPoint(k), i);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const closeTip = async (page) => { const t = page.getByRole('button', { name: 'Got it' }); if (await t.count()) await t.click(); };
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const box = async (page, sel) => { const r = await page.locator(sel).first().boundingBox().catch(() => null); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };

/** Stitches the whole solution with one long drag, star to star, with the mouse or a finger; a twin's leap ends the
 *  drag, so the needle is picked up again where it landed. */
async function stitchAll(page, { cdp = null, ms = 260 } = {}) {
  const sol = await game(page, () => window.__starsSolution());
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const press = async (i) => { const [x, y] = await pt(page, i); if (cdp) await touch('touchStart', x, y); else { await page.mouse.move(x, y); await page.mouse.down(); } };
  const lift = async () => { if (cdp) await touch('touchEnd'); else await page.mouse.up(); };
  await press(sol.start);
  for (const to of sol.path) {
    let s = await state(page);
    if (!(await game(page, () => window.__stars().st.dragging))) { await lift(); await press(s.at); s = await state(page); }
    const [x0, y0] = await pt(page, s.at), [x1, y1] = await pt(page, to), steps = Math.max(4, Math.round(ms / 30));
    for (let k = 1; k <= steps; k++) {
      const x = x0 + (x1 - x0) * (k / steps), y = y0 + (y1 - y0) * (k / steps);
      if (cdp) await touch('touchMove', x, y); else await page.mouse.move(x, y);
      await page.waitForTimeout(ms / steps);
    }
    const after = await state(page);
    assert.equal(after.at === to || after.path.at(-1) === to || after.path.at(-2) === to, true, `stitched to star ${to}`);
  }
  await lift();
  return state(page);
}

// ---------------------------------------------------------------- the arcade card and the menu
{
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 59);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.getByRole('link', { name: /Starstitch/ }).click();
  await page.waitForURL(/\/stars$/); await ready(page);
  assert.ok(await page.getByRole('heading', { name: /Starstitch/ }).isVisible());
  assert.ok(await page.getByRole('button', { name: /Daily Sky/ }).isDisabled(), 'the Daily Sky opens after the story');
  assert.ok(await page.getByRole('button', { name: /Shooting Star/ }).isDisabled(), 'and so does the Shooting Star');
  assert.ok(await noSideScroll(page));
  console.log('PASS the arcade card and the menu');

  // ---------------------------------------------------------------- the first lesson, with the real mouse, in one go
  await page.getByRole('button', { name: /BEGIN/ }).click();
  await closeTip(page);
  assert.equal((await state(page)).puzzle, 't1');
  assert.match(await page.getByTestId('hints').textContent(), /^2$/, 'the free hint and one banked');
  const s1 = await stitchAll(page);
  assert.ok(s1.done && s1.clean, 'the first lesson is stitched in one go');
  await page.locator('.ss-done').waitFor();
  assert.match(await page.locator('.ss-done').textContent(), /Stitched in one go/);
  assert.match(await page.locator('.ss-done').textContent(), /\+1 ✨ hint/);
  assert.equal((await state(page)).bank, 2, 'a hint earned for stitching it without one');
  console.log('PASS the first lesson stitched with the mouse in one go, a ★ and a hint earned');

  // ---------------------------------------------------------------- the second, with the keyboard alone
  await page.getByRole('button', { name: 'Next →' }).click();
  await closeTip(page);
  assert.equal((await state(page)).puzzle, 't2');
  const sol = await game(page, () => window.__starsSolution());
  for (const to of [sol.start, ...sol.path]) {
    const order = await game(page, () => { const s = window.__stars().st, list = s.started ? s.options() : s.p.stars.map((_, i) => i).filter((i) => !s.startRefusal(i)); return [...list].sort((a, b) => s.p.stars[a].x - s.p.stars[b].x || s.p.stars[a].y - s.p.stars[b].y); });
    const n = order.indexOf(to) + 1; assert.ok(n > 0, `star ${to} can be chosen`);
    for (let k = 0; k < n; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
  }
  const s2 = await state(page);
  assert.ok(s2.done && s2.clean, 'stitched with the arrow keys and Enter, in one go');
  await page.locator('.ss-done').waitFor();
  await page.keyboard.press('Enter');
  await closeTip(page);
  assert.equal((await state(page)).puzzle, 't3', 'Enter goes on to the next');
  console.log('PASS the second lesson stitched with the keyboard alone');

  // ---------------------------------------------------------------- the tools
  await page.keyboard.press('Escape');
  await page.locator('.ss-chart').waitFor();
  await game(page, () => window.__starsOpen('t3'));
  await closeTip(page); await page.waitForTimeout(400);
  const s3 = await game(page, () => window.__starsSolution());
  // a refused seam: a star with no seam from the needle
  const [ax, ay] = await pt(page, s3.start);
  await page.mouse.move(ax, ay); await page.mouse.down();
  const [bx, by] = await pt(page, s3.path[0]);
  for (let k = 1; k <= 8; k++) { await page.mouse.move(ax + (bx - ax) * k / 8, ay + (by - ay) * k / 8); await page.waitForTimeout(25); }
  let s = await state(page); assert.equal(s.stitched, 1, `dragged one stitch ${JSON.stringify(s)} ${JSON.stringify(s3)}`);
  const [cx, cy] = await pt(page, s3.path[1]);
  for (let k = 1; k <= 8; k++) { await page.mouse.move(bx + (cx - bx) * k / 8, by + (cy - by) * k / 8); await page.waitForTimeout(25); }
  s = await state(page); assert.equal(s.stitched, 2, 'and a second');
  // drag back along the thread to unpick
  for (let k = 1; k <= 8; k++) { await page.mouse.move(cx + (bx - cx) * k / 8, cy + (by - cy) * k / 8); await page.waitForTimeout(25); }
  s = await state(page); assert.equal(s.stitched, 1, 'dragging back unpicks'); assert.ok(!s.clean, 'and the ★ is gone for this go');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Unpick' }).click();
  assert.equal((await state(page)).stitched, 0, 'the Unpick button');
  await page.locator('canvas.ss-canvas').focus();
  // the needle stays on the first star after unpicking: the arrow keys and Enter carry on from there
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  assert.equal((await state(page)).stitched, 1, 'a stitch by keyboard'); await page.keyboard.press('z');
  assert.equal((await state(page)).stitched, 0, 'Z unpicks');
  await page.keyboard.press('r');
  s = await state(page); assert.equal(s.at, -1, 'R starts again'); assert.equal(s.restarts, 1);
  await page.keyboard.press('h');
  assert.ok(await game(page, () => window.__stars().hint?.k === 'start'), 'H shows where to start');
  assert.match(await page.getByRole('button', { name: 'Hint' }).textContent(), /\(3\)/, 'the free hint is used up, three banked');
  await page.keyboard.press('h');
  assert.equal((await state(page)).hints, 2, 'a second hint, from the bank');
  assert.match(await page.getByTestId('hints').textContent(), /^2$/, 'one taken from the bank');
  console.log('PASS the tools: dragging back, Unpick, Z, R, and hints with H');

  // ---------------------------------------------------------------- the save across a reload, the chart and the journal
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /CONTINUE/ }).textContent(), /First Lessons · /);
  await page.getByRole('button', { name: /Sky chart/ }).click();
  assert.match(await page.locator('.ss-tabs').textContent(), /Lessons\s*2\/3/);
  await page.locator('.ss-tabs button').first().click();
  assert.equal(await page.locator('.ss-cell.is-done').count(), 2, 'two lessons stitched');
  await page.getByRole('button', { name: /MENU/ }).click();
  await page.getByRole('button', { name: /Night Journal/ }).click();
  assert.equal(await page.locator('.ss-entry').count(), 40, 'forty pages in the journal');
  assert.equal(await page.locator('.ss-entry.is-done').count(), 0, 'and the lessons are not among them');
  console.log('PASS the save across a reload, the chart and the journal');

  // ---------------------------------------------------------------- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"solved":{"t1":{"one":"yes"},"n5-8":{"one":true},"zz":3},"bank":"lots","daily":7,"settings":null'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /BEGIN|CONTINUE/ }).isVisible());
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"solved":{"t1":{"one":"yes"},"n5-8":{"one":true},"zz":3},"bank":"lots","daily":7,"settings":null}'), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /CONTINUE/ }).click(); await closeTip(page);
  assert.equal((await state(page)).puzzle, 't2', 'only the real lesson is kept');
  assert.match(await page.getByTestId('hints').textContent(), /^\d+$/);
  await page.evaluate((k) => localStorage.setItem(k, 'not json at all'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /BEGIN/ }).isVisible(), 'a broken save starts fresh');
  console.log('PASS a corrupt save');
  await page.context().close();
}

/** Saves a game with everything before `id` stitched. */
const seed = (page, id) => page.evaluate(([k, id]) => {
  const ids = ['t1', 't2', 't3']; for (let n = 1; n <= 5; n++) for (let i = 1; i <= 8; i++) ids.push(`n${n}-${i}`);
  const solved = {}; for (const x of ids.slice(0, ids.indexOf(id))) solved[x] = { one: true, hint: false };
  localStorage.setItem(k, JSON.stringify({ v: 1, solved, bank: 2 }));
}, [KEY, id]);

// ---------------------------------------------------------------- a twin's leap, on night 4
{
  const page = await open();
  await page.goto(base + '/stars'); await ready(page);
  await seed(page, 'n4-3'); await page.reload(); await ready(page);
  await page.getByRole('button', { name: /CONTINUE/ }).click();
  await closeTip(page); await page.waitForTimeout(400);
  assert.equal((await state(page)).puzzle, 'n4-3');
  const tw = await stitchAll(page);
  assert.ok(tw.done && tw.clean, 'the Dragonfly, twins and all, stitched in one go');
  console.log('PASS a twin’s leap, picked up again where the needle landed');
  await page.context().close();
}

// ---------------------------------------------------------------- the framing on desktop screens
for (const [W, H, minH] of [[1280, 800, 200], [1920, 1080, 280]]) {
  const page = await open({ width: W, height: H });
  await page.goto(base + '/stars'); await ready(page);
  await seed(page, 'n2-8'); await page.reload(); await ready(page);
  await game(page, () => window.__starsOpen('n2-8'));
  await closeTip(page); await page.waitForTimeout(400);
  const m = await game(page, () => window.__starsScene());
  const cv = await box(page, 'canvas.ss-canvas');
  const [x, y, w, h] = m.pair, pair = { x: cv.x + x, y: cv.y + y, w, h };
  assert.ok(h >= minH, `Dora and Enzo are a clear size at ${W}×${H} (${Math.round(h)}px)`);
  assert.ok(pair.x >= -2 && pair.x + w <= W + 2 && pair.y + h <= H + 2, 'and on screen');
  const faces = { x: pair.x, y: pair.y, w: pair.w, h: pair.h * 0.75 };
  const stars = await game(page, () => window.__stars().st.p.stars.map((_, i) => window.__starsPoint(i)));
  for (const sel of ['.ss-side', '.ss-tools', '.ss-toast', '.ss-bar']) {
    const r = await box(page, sel); if (!r) continue;
    assert.ok(!overlaps(r, faces), `${sel} is clear of Dora and Enzo at ${W}×${H}`);
    for (const [sx, sy] of stars) assert.ok(!overlaps(r, { x: sx - 12, y: sy - 12, w: 24, h: 24 }), `${sel} is clear of every star at ${W}×${H}`);
  }
  for (const [sx, sy] of stars) assert.ok(!overlaps(faces, { x: sx - 8, y: sy - 8, w: 16, h: 16 }), 'no star behind the chinchillas');
  // stitch it, and the done card sits beside the sky
  const s = await stitchAll(page, { ms: 150 });
  assert.ok(s.done && s.clean, `the Sleeping Fox stitched in one go at ${W}×${H}`);
  await page.locator('.ss-done').waitFor(); await page.waitForTimeout(500);
  const card = await box(page, '.ss-done');
  assert.ok(!overlaps(card, faces), 'the done card is clear of Dora and Enzo');
  for (const [sx, sy] of stars) assert.ok(!overlaps(card, { x: sx - 8, y: sy - 8, w: 16, h: 16 }), 'and of the blazing constellation');
  assert.ok(await noSideScroll(page));
  console.log(`PASS the framing at ${W}×${H} (Dora and Enzo ${Math.round(h)}px tall, the Sleeping Fox in one go)`);
  await page.context().close();
}

// ---------------------------------------------------------------- phones, held upright and sideways, stitched by touch
for (const [vp, id] of [[{ width: 390, height: 844 }, 'n3-5'], [{ width: 844, height: 390 }, 'n2-3']]) {
  const page = await open(vp, true);
  const cdp = await page.context().newCDPSession(page);
  await page.goto(base + '/stars'); await ready(page);
  assert.ok(await noSideScroll(page), `the menu fits ${vp.width}×${vp.height}`);
  await seed(page, id); await page.reload(); await ready(page);
  await page.getByRole('button', { name: /CONTINUE/ }).tap();
  await closeTip(page);
  assert.equal((await state(page)).puzzle, id);
  const m = await game(page, () => window.__starsScene());
  assert.ok(m.pair[3] >= Math.min(vp.width, vp.height) * 0.25, `Dora and Enzo are a clear size on the phone (${Math.round(m.pair[3])}px)`);
  const tools = await box(page, '.ss-tools');
  assert.ok(tools.y + tools.h <= vp.height + 1 && tools.x >= -1 && tools.x + tools.w <= vp.width + 1, 'the tools fit on screen');
  const stars = await game(page, () => window.__stars().st.p.stars.map((_, i) => window.__starsPoint(i)));
  for (const [sx, sy] of stars) {
    assert.ok(sx > 4 && sx < vp.width - 4 && sy > 4 && sy < vp.height - 4, 'every star on screen');
    for (const sel of ['.ss-side', '.ss-tools', '.ss-bar']) { const r = await box(page, sel); if (r) assert.ok(!overlaps(r, { x: sx - 10, y: sy - 10, w: 20, h: 20 }), `${sel} is clear of every star`); }
  }
  const s = await stitchAll(page, { cdp, ms: 150 });
  assert.ok(s.done && s.clean, `stitched by touch in one go at ${vp.width}×${vp.height}`);
  await page.locator('.ss-done').waitFor(); await page.waitForTimeout(500);
  const r = await box(page, '.ss-done');
  assert.ok(r.y >= -1 && r.y + r.h <= vp.height + 1 && r.x >= -1 && r.x + r.w <= vp.width + 1, 'the done card fits on screen');
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone at ${vp.width}×${vp.height}, stitched by touch in one go`);
  await page.context().close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
