// Clatterbox in the browser: the menu, the first puzzle solved with the real mouse (the ramp dragged out of the tray
// into the box, turned with a key, Go, the bell, the result card and its acorns), the parts by mouse and keyboard
// (adding with number keys, nudging, turning with the wheel, flipping, moving a placed part by dragging it, putting it
// back, the hint, fast forward, a failed run and Rewind, pausing), progress kept across a reload, a corrupt save, the
// free build, the Big Show and its ending, the framing at 1280×800 and 1920×1080 (the whole box in view, nothing
// covering it, Dora and Enzo a clear size beside it, the result card clear of the payoff), and phones held either
// way, played by touch. No page errors anywhere.
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'clatterbox-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
// The headless shell can crash decoding the big paintings again and again as one page reloads many times, so the
// pages that reload a lot leave the paintings out (the cardboard stand-ins show instead); the first one loads them.
const open = async (viewport = { width: 1280, height: 800 }, mobile = false, art = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (!art) await page.route('**/art/clatter/*.webp', (r) => r.abort());
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const game = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => game(page, () => { const s = window.__clatter(); return { ...s, save: undefined }; });
const pt = (page, x, y) => game(page, ([a, b]) => window.__clatterPoint(a, b), [x, y]);
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const saved = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
const ALL = (ended) => JSON.stringify({ v: 1, puzzles: Object.fromEntries([1, 2, 3, 4, 5].flatMap((r) => [1, 2, 3, 4, 5, 6].map((n) => [`${r}-${n}`, { done: !(ended === false && r === 5 && n === 6), stars: 1, best: 3, lay: [] }])).filter(([, v]) => v.done)), tutorial: true, ended: ended !== false, free: [], settings: { sound: true, music: true } });
async function dismissTip(page) { const b = page.locator('.cb-tip .cb-go'); if (await b.count()) { await b.click(); await page.waitForTimeout(150); } }
/** Opens a puzzle from a save that has it unlocked. */
async function openPuzzle(page, id, save = ALL()) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save]);
  await page.reload(); await ready(page);
  await game(page, (x) => window.__clatterOpen(x), id);
  await page.waitForFunction((x) => window.__clatter().puzzle === x, id);
  await dismissTip(page); await frames(page);
}
const centre = async (loc) => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const rect = (page, q) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, q);
const overlap = (a, b, slack = 1) => a.x < b.x + b.w - slack && b.x < a.x + a.w - slack && a.y < b.y + b.h - slack && b.y < a.y + a.h - slack;
async function framing(page, label, { minScale = 30, minPuppet = 100 } = {}) {
  await frames(page);
  const L = await game(page, () => window.__clatterLayout());
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const inside = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
  assert.ok(inside(L.board), `${label}: the whole box is in view (${JSON.stringify(L.board)})`);
  assert.ok(L.s >= minScale, `${label}: the box is a clear size (${L.s.toFixed(1)}px a unit)`);
  for (const who of ['dora', 'enzo']) {
    assert.ok(inside(L[who]), `${label}: ${who} is in view (${JSON.stringify(L[who])})`);
    assert.ok(L[who].h >= minPuppet, `${label}: ${who} is a clear size (${L[who].h.toFixed(0)}px)`);
  }
  for (const q of ['.cb-bar', '.cb-tray', '.cb-line']) {
    const r = await rect(page, q); if (!r) continue;
    assert.ok(!overlap(r, L.board), `${label}: ${q} does not cover the box`);
    for (const who of ['dora', 'enzo']) assert.ok(!overlap(r, L[who], 4), `${label}: ${q} does not cover ${who}`);
  }
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
  return L;
}

// ---- the menu, and the first puzzle with the real mouse
{
  const page = await open(undefined, false, true);
  await page.goto(base + '/clatter'); await ready(page);
  assert.equal(await page.title(), 'Clatterbox · Dora & Enzo’s Arcade');
  await page.waitForFunction(() => { const i = document.querySelector('.cb-hero-art img'); return i && i.complete && i.naturalWidth === 1536; });
  await page.locator('h1', { hasText: 'Clatter' }).waitFor();
  assert.ok(await page.locator('a[href="/"]').count() > 0, 'a way back to the arcade');
  assert.ok(await page.locator('button', { hasText: 'Free build' }).isDisabled(), 'the free build waits for the first room');
  assert.ok(await noSideScroll(page), 'menu: no sideways scroll');
  await page.locator('.cb-go', { hasText: 'Start building' }).click();
  await page.waitForFunction(() => window.__clatter().puzzle === '1-1');
  await page.locator('.cb-tip', { hasText: 'press Go' }).waitFor();
  await dismissTip(page);
  await page.locator('.cb-guide').waitFor();
  await framing(page, '1280×800 first puzzle', { minScale: 50, minPuppet: 140 });
  // drag the ramp out of the tray onto the faint one in the box
  const sol = { x: 4.85, y: 3.65 };
  const [x0, y0] = await centre(page.locator('.cb-part[data-part=ramp]')), [x1, y1] = await pt(page, sol.x, sol.y);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12);
  await page.mouse.up();
  let s = await state(page);
  assert.equal(s.places.length, 1, 'the ramp is in the box');
  assert.deepEqual([s.places[0].p, s.places[0].x, s.places[0].y], ['ramp', 4.85, 3.65], 'where it was dropped, on the grid');
  assert.equal(s.selected, 0, 'and chosen');
  assert.ok(await page.locator('.cb-part[data-part=ramp]').isDisabled(), 'the tray is empty');
  assert.equal(s.places[0].r, -1, 'turned like the faint one');
  await page.keyboard.press('q'); s = await state(page);
  assert.ok(s.places[0].r === 0 || s.places[0].r === -1, 'Q turns it back a step (or says it will not fit)');
  if (s.places[0].r === 0) { await page.keyboard.press('e'); s = await state(page); }
  assert.equal(s.places[0].r, -1, 'E turns it a step');
  await page.locator('[data-testid=go]').click();
  await page.waitForFunction(() => window.__clatter().mode === 'run');
  assert.equal(await page.locator('[data-testid=go]').textContent(), '⟲ Rewind', 'Go becomes Rewind');
  await page.locator('.cb-result').waitFor({ timeout: 15000 });
  s = await state(page);
  assert.ok(s.won && s.goals.every(Boolean), 'the bell rings');
  assert.ok(s.token, 'and the marble touches the golden button on the way');
  assert.equal(await page.locator('.cb-result .cb-stars i.is-on').count(), 3, 'three acorns');
  // the result card leaves the bell in view
  const L = await game(page, () => window.__clatterLayout()), card = await rect(page, '.cb-result');
  const [bx, by] = await pt(page, 10.1, 3.9);
  assert.ok(by < card.y, 'the result card stays clear of the payoff');
  assert.ok(!overlap(card, L.dora, 4) && !overlap(card, L.enzo, 4), 'and of Dora and Enzo');
  void bx;
  const sv = await saved(page);
  assert.ok(sv.puzzles['1-1'].done && sv.puzzles['1-1'].stars === 7 && sv.tutorial, 'the solve is saved');
  // next puzzle; then a reload keeps it all
  await page.locator('.cb-result .cb-go', { hasText: 'Next' }).click();
  await page.waitForFunction(() => window.__clatter().puzzle === '1-2');
  await page.reload(); await ready(page);
  assert.ok(await page.locator('.cb-go', { hasText: 'Continue' }).textContent().then((t) => t.includes('1-2')), 'Continue goes on to 1-2 after a reload');
  await page.locator('.cb-alt', { hasText: 'Puzzles' }).click();
  await page.locator('.cb-lv', { hasText: 'Breakfast Bell' }).waitFor();
  assert.equal(await page.locator('.cb-lv.is-done').count(), 1, 'the rooms show one solved');
  assert.ok(await page.locator('.cb-lv', { hasText: 'Clack Clack' }).isEnabled(), 'and the next one open');
  assert.ok(await page.locator('.cb-lv', { hasText: 'Acorn Relay' }).isDisabled(), 'but not the ones after');
  await page.close();
}

// ---- the parts, by mouse and keyboard
{
  const page = await open();
  await page.goto(base + '/clatter'); await ready(page);
  await openPuzzle(page, '1-3');
  // number keys add parts from the tray, arrows nudge, X puts back
  await page.keyboard.press('1');
  let s = await state(page); assert.equal(s.places.length, 1, '1 adds the first tray part'); assert.equal(s.places[0].p, 'domino');
  const x0 = s.places[0].x;
  await page.keyboard.press('ArrowRight'); s = await state(page);
  if (s.places[0].x === x0) { await page.keyboard.press('ArrowLeft'); s = await state(page); }
  assert.equal(Math.abs(s.places[0].x - x0), 0.25, 'an arrow nudges it a quarter');
  await page.keyboard.press('x'); s = await state(page); assert.equal(s.places.length, 0, 'X puts it back in the tray');
  // the ramp: added, turned by the wheel, dragged to a new spot with the mouse
  await page.keyboard.press('2'); s = await state(page); assert.equal(s.places[0].p, 'ramp');
  const [rx, ry] = await pt(page, s.places[0].x, s.places[0].y);
  await page.mouse.move(rx, ry); await page.mouse.wheel(0, -100); await page.waitForTimeout(100);
  s = await state(page); assert.equal(s.places[0].r, 1, 'the wheel turns the chosen part');
  const before = s.places[0];
  await page.mouse.move(rx, ry); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(rx - i * 6, ry);
  await page.mouse.up();
  s = await state(page);
  assert.ok(s.places[0].x < before.x && s.places[0].r === 1, 'dragging a placed part moves it');
  // a run that fails, then Rewind
  await page.keyboard.press('x');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__clatter().mode === 'over', null, { timeout: 25000 });
  await page.locator('.cb-toast').waitFor();
  s = await state(page); assert.ok(!s.won, 'nothing placed: the chain stops short');
  await page.keyboard.press('Space');
  s = await state(page); assert.equal(s.mode, 'edit', 'Space rewinds');
  // the hint: a faint part and a note
  await page.locator('.cb-hint').click();
  await page.locator('.cb-toast', { hasText: 'Try a' }).waitFor();
  // fast forward, and the authored solution solves it
  await page.keyboard.press('.');
  assert.equal(await page.locator('.cb-btn[aria-label="Fast forward"]').getAttribute('aria-pressed'), 'true', 'fast forward is on');
  await game(page, () => window.__clatterSolve());
  await page.keyboard.press('g');
  await page.locator('.cb-result').waitFor({ timeout: 15000 });
  // flip: the wind-up car turns round
  await openPuzzle(page, '2-3');
  await page.locator('.cb-part[data-part=car]').press('Enter');
  s = await state(page); assert.equal(s.places[0]?.p, 'car', 'Enter on a tray part adds it');
  await page.locator('.cb-btn[aria-label=Flip]').click();
  s = await state(page); assert.equal(s.places[0].f, 1, 'the flip button turns the car round');
  // pausing
  await page.locator('[data-testid=box]').focus();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.locator('.cb-pausecard').waitFor();
  s = await state(page); assert.ok(s.paused, 'Esc pauses');
  await page.locator('.cb-pausecard .cb-go').click();
  s = await state(page); assert.ok(!s.paused, 'and back');
  // a corrupt save is ignored
  await page.evaluate((k) => localStorage.setItem(k, '{not json at all'), KEY);
  await page.reload(); await ready(page);
  await page.locator('.cb-go', { hasText: 'Start building' }).waitFor();
  assert.ok(await page.locator('button', { hasText: 'Free build' }).isDisabled(), 'a corrupt save starts fresh');
  // the free build keeps what is built
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, ALL(false)]);
  await page.reload(); await ready(page);
  await page.locator('.cb-alt', { hasText: 'Free build' }).click();
  await page.waitForFunction(() => window.__clatter().puzzle === 'free');
  await page.keyboard.press('3'); await page.keyboard.press('3');
  s = await state(page); assert.equal(s.places.length, 2, 'two parts in the free build');
  await page.reload(); await ready(page);
  assert.equal((await saved(page)).free.length, 2, 'kept in the save');
  await page.close();
}

// ---- the finale, the Big Show and the ending
{
  const page = await open();
  await page.goto(base + '/clatter'); await ready(page);
  await openPuzzle(page, '5-6', ALL(false));
  await framing(page, '1280×800 finale', { minScale: 30, minPuppet: 120 });
  await game(page, () => window.__clatterSolve());
  await page.locator('[data-testid=go]').click();
  await page.locator('.cb-result').waitFor({ timeout: 40000 });
  assert.ok((await saved(page)).ended, 'the finale ends the game');
  await page.locator('.cb-result .cb-go', { hasText: 'Big Show' }).click();
  await page.waitForFunction(() => window.__clatter().screen === 'show');
  await page.locator('.cb-ending').waitFor({ timeout: 45000 });
  await page.locator('.cb-ending h2', { hasText: 'The Big Show' }).waitFor();
  await page.locator('.cb-ending .cb-go').click();
  await page.locator('.cb-room').first().waitFor();
  await page.close();
}

// ---- framing on big screens
for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const page = await open(vp);
  await page.goto(base + '/clatter'); await ready(page);
  for (const id of ['1-5', '3-6', '5-1']) {
    await openPuzzle(page, id);
    await framing(page, `${vp.width}×${vp.height} ${id}`, { minScale: vp.width >= 1920 ? 75 : 50, minPuppet: vp.width >= 1920 ? 200 : 140 });
  }
  // while it runs and after: the card is clear of the box's payoff
  await openPuzzle(page, '1-5');
  await game(page, () => window.__clatterSolve());
  await page.keyboard.press('Space');
  await page.locator('.cb-result').waitFor({ timeout: 15000 }); await page.waitForTimeout(500); await frames(page);
  const L = await game(page, () => window.__clatterLayout()), card = await rect(page, '.cb-result');
  assert.ok(L.board.y + L.board.h <= card.y + 4, `${vp.width}×${vp.height}: the result card is below the box`);
  assert.ok(!overlap(card, L.dora, 4) && !overlap(card, L.enzo, 4), `${vp.width}×${vp.height}: and clear of Dora and Enzo`);
  await page.close();
}

// ---- phones, held either way, played by touch
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp, true);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await page.goto(base + '/clatter'); await ready(page);
  assert.ok(await noSideScroll(page), `${vp.width}×${vp.height} menu: no sideways scroll`);
  await page.locator('.cb-go', { hasText: 'Start building' }).tap();
  await page.waitForFunction(() => window.__clatter().puzzle === '1-1');
  await dismissTip(page);
  await framing(page, `${vp.width}×${vp.height} first puzzle`, { minScale: 22, minPuppet: 70 });
  // drag the ramp from the tray with a finger: it rides a little above the finger
  const [x0, y0] = await centre(page.locator('.cb-part[data-part=ramp]')), [x1, y1] = await pt(page, 4.85, 3.65);
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= 12; i++) await touch('touchMove', x0 + ((x1 - x0) * i) / 12, y0 + ((y1 + 36 - y0) * i) / 12);
  await touch('touchEnd');
  let s = await state(page);
  assert.deepEqual([s.places[0]?.p, s.places[0]?.x, s.places[0]?.y], ['ramp', 4.85, 3.65], `${vp.width}×${vp.height}: the ramp is dropped where the finger points`);
  assert.equal(s.places[0].r, -1, 'turned like the faint one');
  await page.locator('.cb-btn[aria-label="Turn right"]').tap(); await page.locator('.cb-btn[aria-label="Turn left"]').tap();
  s = await state(page); assert.equal(s.places[0].r, -1, 'the turn buttons turn it');
  await page.locator('[data-testid=go]').tap();
  await page.locator('.cb-result').waitFor({ timeout: 15000 }); await page.waitForTimeout(600); await frames(page);
  const card = await rect(page, '.cb-result');
  assert.ok(card.y >= 0 && card.y + card.h <= vp.height + 1 && card.x >= 0 && card.x + card.w <= vp.width + 1, `${vp.width}×${vp.height}: the result card fits`);
  const L = await game(page, () => window.__clatterLayout());
  assert.ok(!overlap(card, L.board, 4), `${vp.width}×${vp.height}: the result card leaves the box in view`);
  assert.ok(!overlap(card, L.dora, 4) && !overlap(card, L.enzo, 4), `${vp.width}×${vp.height}: and Dora and Enzo`);
  // tap a part, then tap the box to place it
  await openPuzzle(page, '1-2');
  await page.locator('.cb-part[data-part=domino]').tap();
  const [dx, dy] = await pt(page, 6.6, 2.4);
  await page.touchscreen.tap(dx, dy);
  s = await state(page); assert.equal(s.places.length, 1, `${vp.width}×${vp.height}: tap a part, tap the box`);
  // the biggest board still fits
  await openPuzzle(page, '5-6');
  await framing(page, `${vp.width}×${vp.height} finale`, { minScale: vp.width < 500 ? 12 : 14, minPuppet: 50 });
  await page.close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('clatter e2e: menu, mouse play, parts, saves, free build, Big Show, framing and phones all passed');
