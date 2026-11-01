// Shadowplay in the browser: the menu, the first scene cast with the real mouse (the moon dragged up into its outline,
// clicking into place, the scene coming alive and the stars), the puppet tools by mouse and keyboard (rotating, the
// turning handle, flipping, undo and reset, the hint, sliding a puppet near and far on the board and the lantern
// along its rail, taking a decoy down), the progress kept across a reload, a corrupt save, the free stage, the
// framing at 1280×800 and 1920×1080 (the whole paper screen and board in view, nothing covering them, Dora and Enzo
// a clear size), the result card never covering the living picture, and phones held either way, played by touch.
// No page errors anywhere.
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'shadowplay-v1';
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
const state = (page) => game(page, () => { const s = window.__shadow(); return { ...s, save: undefined }; });
const pt = (page, u, v) => game(page, ([a, b]) => window.__shadowPoint(a, b), [u, v]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const savedScenes = (page) => page.evaluate((k) => { try { return Object.keys(JSON.parse(localStorage.getItem(k)).scenes); } catch { return []; } }, KEY);
const SAVE_STORY1 = JSON.stringify({ v: 1, scenes: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`s1-${n}`, { done: true, stars: 1, best: 9 }])), tutorial: true });
const SAVE_ALL = JSON.stringify({ v: 1, scenes: Object.fromEntries([1, 2, 3, 4, 5].flatMap((s) => [1, 2, 3, 4, 5, 6].map((n) => [`s${s}-${n}`, { done: true, stars: 3, best: 3 }]))), tutorial: true, ended: true });
async function dismissTip(page) { const b = page.locator('.sp-card .sp-go'); if (await b.count()) { await b.click(); await page.waitForTimeout(150); } }
/** Opens a scene from a save that has it unlocked. */
async function openScene(page, id, save = SAVE_ALL) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save]);
  await page.reload(); await ready(page);
  await game(page, (x) => window.__shadowOpen(x), id);
  await page.waitForFunction((x) => window.__shadow().scene === x, id);
  await dismissTip(page);
  // the theatre is fitted on the next frame after a scene opens: wait for it before measuring anything
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/** Where puppet i's shadow and its solution are, in page pixels. */
async function shadowAt(page, i) { return game(page, (n) => window.__shadowShadow(n), i); }
/** Once the result card shows and the theatre has glided aside, the whole living picture is in view beside it. */
async function pictureClear(page, label) {
  await page.waitForTimeout(900);
  const L = await game(page, () => window.__shadowLayout()), box = await page.locator('.sp-result').boundingBox(), vp = page.viewportSize();
  const S = L.screen, clear = S.x + S.w <= box.x + 1 || box.x + box.width <= S.x + 1 || S.y + S.h <= box.y + 1 || box.y + box.height <= S.y + 1;
  assert.ok(clear, `${label}: the result card does not cover the living picture (${JSON.stringify(S)} vs ${JSON.stringify(box)})`);
  assert.ok(S.x >= -1 && S.y >= -1 && S.x + S.w <= vp.width + 1 && S.y + S.h <= vp.height + 1, `${label}: the living picture is in view`);
  assert.ok(S.w >= vp.width * 0.4, `${label}: the living picture is a good size (${S.w.toFixed(0)}px wide)`);
}
/** Drags a puppet's shadow with the real mouse to a point on the paper (in screen units). */
async function mouseDrag(page, i, u, v) {
  const [x0, y0] = await shadowAt(page, i), [x1, y1] = await pt(page, u, v);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 6 }); await page.mouse.move(x1, y1, { steps: 6 });
  await page.mouse.up();
}
/** The layout checks: the whole screen and board inside the window, nothing covering them, the narrators a clear size. */
async function framing(page, label, { minScale = 30 } = {}) {
  const L = await game(page, () => window.__shadowLayout());
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const inside = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
  assert.ok(inside(L.screen) && inside(L.board), `${label}: the paper screen and the board are in view (${JSON.stringify(L.screen)})`);
  assert.ok(L.s >= minScale, `${label}: the theatre is a clear size (${L.s.toFixed(1)}px a unit)`);
  // the narrators stand about two units tall at 0.78–0.86 of a unit's scale
  if (minScale >= 50) assert.ok(L.s * 0.86 * 2 >= 80, `${label}: Dora and Enzo are a clear size (${(L.s * 0.86 * 2).toFixed(0)}px tall)`);
  const rects = await page.evaluate(() => ['.sp-bar', '.sp-tools', '.sp-line'].map((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { q, x: r.left, y: r.top, w: r.width, h: r.height }; }));
  const overlap = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const bar = rects[0], tools = rects[1], line = rects[2];
  if (bar) assert.ok(!overlap(bar, L.screen), `${label}: the bar does not cover the screen`);
  if (line) assert.ok(!overlap(line, L.screen), `${label}: the story line does not cover the screen`);
  if (tools) { assert.ok(!overlap(tools, L.screen), `${label}: the toolbar does not cover the screen`); assert.ok(!overlap(tools, L.board), `${label}: the toolbar does not cover the board`); }
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
  return L;
}

// ---- the menu, and the first scene with the real mouse
{
  const page = await open();
  await page.goto(base + '/shadow'); await ready(page);
  assert.equal(await page.title(), 'Shadowplay · Dora & Enzo’s Arcade');
  await page.locator('h1', { hasText: 'Shadowplay' }).waitFor();
  assert.ok(await page.locator('a[href="/"]').count() > 0, 'a way back to the arcade');
  assert.ok(await page.locator('.sp-go', { hasText: 'BEGIN THE SHOW' }).isEnabled(), 'begin is ready');
  assert.ok(await page.locator('button', { hasText: 'Free stage' }).isDisabled(), 'the free stage waits for the first story');
  assert.ok(await noSideScroll(page), 'menu: no sideways scroll');
  await page.locator('.sp-go', { hasText: 'BEGIN THE SHOW' }).click();
  await page.waitForFunction(() => window.__shadow().scene === 's1-1');
  await page.locator('.sp-card', { hasText: 'Drag a shadow' }).waitFor();
  await dismissTip(page);
  await page.locator('.sp-guide').waitFor();
  await framing(page, '1280×800 first scene', { minScale: 50 });
  // drag the moon up, close to its outline but not exactly on it: it clicks in
  await mouseDrag(page, 1, 10.9 + 0.2, 2.5 - 0.15);
  await page.waitForFunction(() => window.__shadow().alive);
  let s = await state(page);
  assert.equal(s.moves, 1, 'one puppet picked up: one move');
  assert.deepEqual([s.poses[1].x, s.poses[1].y], [Math.round(10.9 * 8), Math.round(2.5 * 8)], 'it clicked into place');
  await page.locator('.sp-result').waitFor({ timeout: 8000 });
  assert.match(await page.locator('.sp-line').innerText(), /Up came the moon/);
  assert.match(await page.locator('.sp-result').innerText(), /Moonrise/);
  await pictureClear(page, '1280×800 result');
  assert.equal(await page.locator('.sp-result .sp-stars.is-big i.is-on').count() >= 2, true, 'cast within par: at least two stars');
  assert.deepEqual(await savedScenes(page), ['s1-1'], 'saved');
  // next scene from the card
  await page.locator('.sp-result .sp-go').click();
  await page.waitForFunction(() => window.__shadow().scene === 's1-2');
  // the progress survives a reload
  await page.reload(); await ready(page);
  await page.locator('.sp-alt', { hasText: 'Stories' }).click();
  await page.locator('.sp-lv.is-done', { hasText: 'Moonrise' }).waitFor();
  assert.ok(await page.locator('.sp-lv', { hasText: 'A House on the Hill' }).isEnabled(), 'the next scene is open');
  assert.ok(await page.locator('.sp-lv', { hasText: 'Up on the Roof' }).isDisabled(), 'three ahead is locked');
  await page.close();
}

// ---- the tools by mouse and keyboard
{
  const page = await open();
  await page.goto(base + '/shadow'); await ready(page);
  // A Tail to Tell: rotate, flip, undo, reset, hint
  await openScene(page, 's1-4');
  const cane = 2;
  await page.locator('canvas').focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction((i) => window.__shadow().selected === i, cane);
  let s = await state(page);
  const r0 = s.poses[cane].r, f0 = s.poses[cane].f;
  await page.keyboard.press('e'); await page.keyboard.press('e');
  s = await state(page); assert.equal(s.poses[cane].r, (r0 + 2) % 24, 'E rotates');
  await page.locator('button[aria-label="Rotate left"]').click();
  s = await state(page); assert.equal(s.poses[cane].r, (r0 + 1) % 24, 'the ⟲ button rotates back');
  await page.keyboard.press('f');
  s = await state(page); assert.equal(s.poses[cane].f, 1 - f0, 'F flips');
  assert.equal(s.moves, 1, 'all on one puppet: one move');
  await page.keyboard.press('z');
  s = await state(page); assert.equal(s.poses[cane].f, f0, 'Z undoes the flip');
  // the comb next: a second move
  const [mx, my] = await shadowAt(page, 3);
  await page.mouse.move(mx, my); await page.mouse.down(); await page.mouse.move(mx - 30, my + 10, { steps: 4 }); await page.mouse.up();
  s = await state(page); assert.equal(s.moves, 2, 'another puppet: another move');
  // the turning handle above the chosen puppet: drag it a quarter of the way round
  const r1 = s.poses[3].r, [hx, hy] = await game(page, () => window.__shadowHandle()), [ox, oy] = await shadowAt(page, 3);
  const rad = Math.hypot(hx - ox, hy - oy);
  await page.mouse.move(hx, hy); await page.mouse.down();
  for (let k = 1; k <= 8; k++) { const a = -Math.PI / 2 + (k / 8) * (Math.PI / 2); await page.mouse.move(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad); }
  await page.mouse.up();
  s = await state(page); assert.equal(s.poses[3].r, (r1 + 6) % 24, 'a quarter turn of the handle turns the puppet a quarter');
  assert.equal(s.moves, 2, 'still the same puppet: no new move');
  await page.locator('button[aria-label="Hint"]').click();
  await page.locator('.sp-toast').waitFor();
  await page.keyboard.press('r');
  s = await state(page); assert.equal(s.moves, 0, 'R starts the scene again');
  // casting by the hints plays out the same way
  await game(page, () => window.__shadowCast());
  await page.locator('.sp-result').waitFor({ timeout: 8000 });

  // Near and Far: a rod on the board, and the lantern on its rail
  await openScene(page, 's2-1');
  const coin = 2;
  s = await state(page);
  const d0 = s.poses[coin].d;
  let B = (await game(page, () => window.__shadowLayout())).board;
  // the coin's rod sits on the board under its shadow; drag it down towards the lantern
  const [sx, sy] = await shadowAt(page, coin);
  const notchY = (d) => B.y + 8 + ((12 * (1 - 1 / [1, 1.2, 1.45, 1.75, 2.1, 2.5, 3][d])) / 12) * (B.h - 20);
  // + and − first (taking the coin all the way to the lantern casts the scene, and then the keys rest)
  await page.mouse.click(sx, sy);
  await page.waitForFunction((i) => window.__shadow().selected === i, coin);
  await page.keyboard.press('+'); await page.keyboard.press('+');
  s = await state(page); assert.equal(s.poses[coin].d, d0 + 2, '+ takes it nearer the lantern');
  await page.keyboard.press('-');
  s = await state(page); assert.equal(s.poses[coin].d, d0 + 1, '− brings it nearer the screen');
  await page.mouse.move(sx, notchY(d0 + 1)); await page.mouse.down(); await page.mouse.move(sx, notchY(6), { steps: 8 }); await page.mouse.up();
  s = await state(page); assert.equal(s.poses[coin].d, 6, 'dragging the rod down the board slides it to the lantern');
  // Peekaboo Moon: the lantern slides along its rail
  await openScene(page, 's3-1');
  s = await state(page);
  B = (await game(page, () => window.__shadowLayout())).board;
  const lx = B.x + (8 / 16) * B.w, ly = notchY(6) + 0;
  const o0 = s.offs[0];
  await page.mouse.move(lx, B.y + 8 + (B.h - 20)); await page.mouse.down(); await page.mouse.move(lx - 60, B.y + 8 + (B.h - 20), { steps: 6 }); await page.mouse.up();
  s = await state(page); assert.ok(s.offs[0] < o0, `dragging the lantern slides it (${o0} → ${s.offs[0]})`);
  await page.keyboard.press(']');
  const s2 = await state(page); assert.equal(s2.offs[0], s.offs[0] + 1, '] slides it right');
  void ly;

  // Too Many Puppets: a decoy comes down
  await openScene(page, 's5-3');
  const decoy = await game(page, () => { const sc = window.__shadow(); return sc.poses.findIndex((p, i) => i >= 0 && p.on) ; });
  void decoy;
  const decoys = await game(page, () => window.__shadow().poses.length);
  assert.ok(decoys > 3, 'a scene with many puppets');
  await page.keyboard.press('Tab');
  let sel = (await state(page)).selected;
  assert.ok(sel >= 0, 'Tab picks a puppet');
  await page.keyboard.press('x');
  s = await state(page); assert.equal(s.poses[sel].on, false, 'X takes it off the rods');
  await page.locator('.sp-off .sp-chip').first().click().catch(() => {});
  await page.close();
}

// ---- a corrupt save, the free stage and the final performance
{
  const page = await open();
  await page.goto(base + '/shadow'); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"scenes":{"s1-1":{"done":"maybe"}},"sandbox":"oops'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.locator('.sp-go', { hasText: 'BEGIN THE SHOW' }).isVisible(), 'a corrupt save starts fresh');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, SAVE_STORY1]);
  await page.reload(); await ready(page);
  await page.locator('button', { hasText: 'Free stage' }).click();
  await page.waitForFunction(() => window.__shadow().scene === 'sandbox');
  await page.locator('button[aria-label="Add a puppet"]').click();
  await page.locator('.sp-prop[aria-label="Teapot"]').click();
  await page.locator('button[aria-label="Add a puppet"]').click();
  await page.locator('.sp-prop[aria-label="Round fan"]').click();
  await page.locator('button[aria-label="Two lanterns"]').click();
  let s = await state(page);
  assert.equal(s.poses.length, 2, 'two puppets hung');
  assert.equal(s.offs.length, 2, 'two lanterns lit');
  await page.reload(); await ready(page);
  await page.locator('button', { hasText: 'Free stage' }).click();
  await page.waitForFunction(() => window.__shadow().scene === 'sandbox');
  s = await state(page);
  assert.equal(s.poses.length, 2, 'the free stage is kept');
  await page.close();
  const p2 = await open({ width: 1920, height: 1080 });
  await p2.goto(base + '/shadow'); await ready(p2);
  await p2.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, SAVE_ALL]);
  await p2.reload(); await ready(p2);
  await p2.locator('button', { hasText: 'The final performance' }).click();
  await p2.waitForFunction(() => window.__shadow().screen === 'show');
  await p2.locator('.sp-skip').click();
  await p2.locator('.sp-ending').waitFor();
  assert.match(await p2.locator('.sp-ending').innerText(), /final performance/i);
  await p2.close();
}

// ---- framing on big screens
for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const page = await open(vp);
  await page.goto(base + '/shadow'); await ready(page);
  for (const id of ['s1-6', 's4-6', 's5-6']) {
    await openScene(page, id);
    await framing(page, `${vp.width}×${vp.height} ${id}`, { minScale: vp.width >= 1920 ? 70 : 50 });
  }
  await page.close();
}

// ---- phones, held either way, played by touch
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp, true);
  const cdp = await page.context().newCDPSession(page);
  await page.goto(base + '/shadow'); await ready(page);
  assert.ok(await noSideScroll(page), `${vp.width}×${vp.height} menu: no sideways scroll`);
  await page.locator('.sp-go', { hasText: 'BEGIN THE SHOW' }).tap();
  await page.waitForFunction(() => window.__shadow().scene === 's1-1');
  await dismissTip(page);
  await framing(page, `${vp.width}×${vp.height} first scene`, { minScale: 18 });
  const [x0, y0] = await shadowAt(page, 1), [x1, y1] = await pt(page, 10.9, 2.5);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', x0, y0);
  for (let i = 1; i <= 10; i++) await touch('touchMove', x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10);
  await touch('touchEnd');
  await page.waitForFunction(() => window.__shadow().alive);
  await page.locator('.sp-result').waitFor({ timeout: 8000 });
  assert.ok(await noSideScroll(page), `${vp.width}×${vp.height} result: no sideways scroll`);
  const box = await page.locator('.sp-result').boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= vp.height + 1, `${vp.width}×${vp.height}: the result card fits`);
  await pictureClear(page, `${vp.width}×${vp.height} result`);
  // a busier scene still fits, with its toolbar clear of the theatre
  await openScene(page, 's4-6');
  await framing(page, `${vp.width}×${vp.height} s4-6`, { minScale: 18 });
  await page.close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('shadow e2e: menu, mouse play, tools, saves, free stage, ending, framing and phones all passed');
