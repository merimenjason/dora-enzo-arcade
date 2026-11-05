// Pixel Smith in the browser: the title and the way home, Enzo's opening, painting the weapon on the easel by
// clicking and dragging (and a pixel that can't go down), choosing paints by key, a sketch, patching fur, a real fight
// (walking, aiming and swinging with the mouse until a Grumble bursts and its pixels fill the pots), clearing a room
// back to the easel, the sketchbook after a place, the Smudge's health bar, running out of fur and the result card,
// the bests and the last weapon saved across a reload, a corrupt save, the how-to page, and a phone held upright
// (a sketch, Fight, the thumb stick and SWING), all with no page errors and no sideways scrolling. Needs `npm run dev`
// and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'pixel-smith-v1';
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
const st = (page) => page.evaluate(() => { const s = window.__smith(); return { screen: s.screen, intro: s.intro, save: s.save, result: s.result, line: s.line, brush: s.brush, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__smith(); return JSON.stringify({ screen: s.screen, intro: s.intro, run: s.run && { ...s.run, cells: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__smith().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const cell = (page, x, y) => page.locator(`[data-cell="${y * 12 + x}"]`);
const painted = async (page) => [...(await st(page)).run.cells].filter((c) => c !== '.').length;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/smith`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.ps-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- Enzo's opening
  await page.getByRole('button', { name: 'Start' }).click();
  await until(page, () => window.__smith().intro === 0);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
  await until(page, () => window.__smith().intro === -1 && window.__smith().save.intro === true);
  assert.equal((await st(page)).run.phase, 'easel');
  ok('Enzo’s opening: four cards on the easel, then remembered');

  // ---- painting
  await cell(page, 6, 2).click();
  assert.equal(await painted(page), 0, 'a pixel away from the handle can’t go down');
  await until(page, () => /touch the handle/.test(window.__smith().line?.text ?? ''));
  await cell(page, 1, 10).click();
  assert.equal(await painted(page), 1);
  // drag a line out from it
  const a = await cell(page, 2, 9).boundingBox(), b = await cell(page, 5, 6).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  for (let k = 0; k <= 12; k++) await page.mouse.move(a.x + a.width / 2 + (b.x - a.x) * k / 12, a.y + a.height / 2 + (b.y - a.y) * k / 12);
  await page.mouse.up();
  const drawn = await painted(page), drawnCells = (await st(page)).run.cells;
  assert.ok(drawn >= 5, 'dragging paints a line'); assert.equal((await st(page)).run.paint.gold, 6 - drawn);
  await page.keyboard.press('Digit1'); assert.equal((await st(page)).brush, 'grey');
  // a free square touching the line
  const near = (q) => [-13, -12, -11, -1, 1, 11, 12, 13].some((d) => drawnCells[q + d] && drawnCells[q + d] !== '.' && Math.abs(((q + d) % 12) - (q % 12)) <= 1);
  const q = [...drawnCells].findIndex((c, k) => c === '.' && k !== 132 && near(k)), free = [q % 12, Math.floor(q / 12)];
  await cell(page, free[0], free[1]).click(); assert.equal((await st(page)).run.cells[free[1] * 12 + free[0]], 's');
  // tapping a pixel of the same colour rubs it out, and the pixels past it come off with it
  await page.keyboard.press('Digit2'); await cell(page, 1, 10).click();
  assert.equal(await painted(page), 0); assert.deepEqual((await st(page)).run.paint, { grey: 12, gold: 6, blue: 0, red: 0, green: 0 });
  await page.getByRole('button', { name: 'Sword', exact: true }).click();
  assert.equal(await painted(page), 18);
  ok('painting: a click, a drag, keys for the paints, rubbing out with everything past it, and a sketch');

  // ---- patching fur
  await dbg(page, 'fur', 20); await dbg(page, 'paint', { green: 3 });
  await page.keyboard.press('Digit5');
  await page.getByRole('button', { name: /Patch fur/ }).click();
  let s = await st(page); assert.equal(s.run.fur, 22); assert.equal(s.run.paint.green, 2);
  await dbg(page, 'fur', 30);
  ok('patching fur spends a pixel of the chosen paint');

  // ---- a real fight: walk up to a Grumble and swing until it bursts
  await page.getByRole('button', { name: 'Fight ›' }).click();
  await until(page, () => window.__smith().run.phase === 'fight' && window.__smith().run.foes.some((f) => f.mode === 'walk'));
  const box = await page.locator('canvas.ps-canvas').boundingBox();
  const g0 = (await st(page)).run.paint.grey + (await st(page)).run.paint.gold;
  for (let k = 0; k < 120; k++) {
    s = await st(page);
    if (s.run.stats.kills > 0 || s.run.phase !== 'fight') break;
    const f = s.run.foes.filter((q) => q.mode !== 'spawn').sort((p, q) => Math.hypot(p.x - s.run.dora.x, p.y - s.run.dora.y) - Math.hypot(q.x - s.run.dora.x, q.y - s.run.dora.y))[0];
    if (!f) { await page.waitForTimeout(100); continue; }
    await page.mouse.move(box.x + f.x / 384 * box.width, box.y + (f.y - 5) / 216 * box.height);
    const dx = f.x - s.run.dora.x, dy = f.y - s.run.dora.y;
    if (Math.hypot(dx, dy) > 26) {
      const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'KeyD' : 'KeyA') : (dy > 0 ? 'KeyS' : 'KeyW');
      await page.keyboard.down(key); await page.waitForTimeout(110); await page.keyboard.up(key);
    } else { await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(150); }
  }
  s = await st(page); assert.ok(s.run.stats.kills > 0, 'a Grumble burst');
  await until(page, (n) => { const r = window.__smith().run; return r.paint.grey + r.paint.gold > n; }, g0);
  ok('a real fight: walking, aiming and swinging with the mouse until a Grumble bursts and its pixels fill the pots');

  // ---- clearing rooms, the sketchbook, the Smudge
  await dbg(page, 'fur', 30); await dbg(page, 'win');
  await until(page, () => window.__smith().run.phase === 'easel' && window.__smith().run.room === 1);
  await dbg(page, 'room', 2);
  await page.keyboard.press('Enter');
  await until(page, () => window.__smith().run.phase === 'fight');
  await dbg(page, 'win');
  await until(page, () => window.__smith().run.phase === 'pick');
  assert.equal(await page.locator('.ps-offer').count(), 3);
  const perk = await page.locator('.ps-offer').first().getAttribute('data-perk');
  await page.keyboard.press('Digit1');
  await until(page, (p) => window.__smith().run.phase === 'easel' && window.__smith().run.perks[p] === 1, perk);
  await dbg(page, 'room', 9); await page.getByRole('button', { name: 'Fight ›' }).click();
  await until(page, () => window.__smith().run.foes.some((f) => f.k === 'smudge'));
  await page.locator('.ps-boss').waitFor({ state: 'visible' });
  ok('clearing a room goes back to the easel, a cleared place opens the sketchbook, and the Smudge has a health bar');

  // ---- out of fur
  await dbg(page, 'fur', 0.5);
  await until(page, () => window.__smith().screen === 'result', undefined, 60000);
  s = await st(page);
  assert.equal(s.result.won, false); assert.equal(s.save.stats.runs, 1); assert.equal(s.save.best.rooms, 2);
  await page.locator('.ps-resultcard h2', { hasText: 'out of fur' }).waitFor();
  ok('running out of fur ends the run with the result card');

  // ---- the save, and drawing the last weapon again
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.stats.runs, 1); assert.ok(s.save.last.length === 144);
  await page.getByRole('button', { name: 'New run' }).click();
  await until(page, () => window.__smith().run?.phase === 'easel');
  await page.getByRole('button', { name: 'Last one' }).click();
  assert.ok(await painted(page) > 0, 'the last weapon comes back');
  await page.evaluate((k) => localStorage.setItem(k, '{broken'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).save.stats.runs, 0, 'a corrupt save starts fresh');
  ok('bests and the last weapon kept across a reload; a corrupt save starts fresh');

  await page.getByRole('button', { name: 'How to play' }).click();
  await page.locator('.ps-foe img').first().waitFor();
  assert.equal(await page.locator('.ps-foe img').count(), 6);
  assert.ok(await noSideScroll(page));
  ok('the how-to page shows every Grumble');
  await page.context().close();

  // ---- a phone held upright
  const m = await open({ width: 390, height: 844 }, true);
  await m.goto(`${base}/smith`); await ready(m);
  await m.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
  await m.reload(); await ready(m);
  await m.getByRole('button', { name: 'Start' }).tap();
  await until(m, () => window.__smith().run?.phase === 'easel');
  assert.ok(await noSideScroll(m));
  await m.getByRole('button', { name: 'Hammer' }).tap();
  assert.ok(await painted(m) > 10);
  await m.getByRole('button', { name: 'Fight ›' }).tap();
  await until(m, () => window.__smith().run.phase === 'fight');
  const cv = await m.locator('canvas.ps-canvas').boundingBox();
  assert.ok(cv.width >= 380, `the room fills the width (${cv.width})`);
  const zone = await m.locator('.ps-stickzone').boundingBox(), x0 = (await st(m)).run.dora.x;
  const cdp = await m.context().newCDPSession(m);
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await tp('touchStart', zone.x + 60, zone.y + 80);
  for (let k = 1; k <= 6; k++) await tp('touchMove', zone.x + 60 + k * 8, zone.y + 80);
  await m.waitForTimeout(600); await tp('touchEnd', 0, 0);
  assert.ok((await st(m)).run.dora.x > x0 + 10, 'the thumb stick walks Dora');
  const sw0 = (await st(m)).run.swings;
  await m.locator('.ps-swing').dispatchEvent('pointerdown');
  await until(m, (n) => window.__smith().run.swings > n, sw0);
  await m.locator('.ps-swing').dispatchEvent('pointerup');
  ok('phone: the easel fits, a sketch, Fight, the room fills the width, the thumb stick walks Dora and SWING swings');
  await m.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`\n${pass} Pixel Smith browser checks passed`);
