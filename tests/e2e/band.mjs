// Woodland Band in the browser: the menu; the first request played with the real mouse (four taps on the hedgehog's
// row, the band keeps playing, the loop comes round and the audience loves it: the result card and its stars, clear
// of the grid and of Dora and Enzo); the second with a real drag up for pitch and "Hear the tune"; the keyboard (cells,
// pitch, play and stop, undo); adding a musician from the picker and taking one off; progress kept across a reload; a
// corrupt save; the jam (a save slot, a share code copied out and loaded back, a bad code refused); the festival and
// its ending; the framing at 1280×800 and 1920×1080 (the whole grid in view, Dora and Enzo a clear size, nothing over
// the grid or their faces); and phones held upright and sideways, played by touch. No page errors anywhere.
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'woodland-band-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
// The headless shell can crash decoding paintings again and again as one page reloads, so later pages leave the
// painted Dora and Enzo out (the drawn stand-ins show instead); the first page loads them.
const open = async (viewport = { width: 1280, height: 800 }, mobile = false, art = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (!art) await page.route(/\/art\/band\/(dora|enzo)-[a-z]+\.webp$/, (r) => r.abort());
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Moss Waltz' : undefined));
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
const state = (page) => page.evaluate(() => { const s = window.__band(); return { ...s, save: undefined }; });
const row = (s, m) => s.song.rows.find((r) => r.m === m);
const text = (r) => (r ? r.n.map((v) => (v < 0 ? '.' : v.toString(36))).join('') : null);
const cell = (page, m, step, frac = 0.5) => page.evaluate(([a, b, c]) => window.__bandCell(a, b, c), [m, step, frac]);
const saved = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, KEY);
const rect = (page, q) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, q);
const overlap = (a, b, slack = 1) => a.x < b.x + b.w - slack && b.x < a.x + a.w - slack && a.y < b.y + b.h - slack && b.y < a.y + a.h - slack;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const settle = (page) => page.waitForTimeout(250);
async function dismissTip(page, tap = false) { const b = page.locator('.wb-tip .wb-go'); if (await b.count()) { if (tap) await b.tap(); else await b.click(); await settle(page); } }
const save = (o) => JSON.stringify({ v: 1, reqs: {}, slots: [null, null, null, null], jam: '', ended: false, tutorial: true, settings: { sound: true, music: true }, ...o });
const ALL = (ended = true) => save({ reqs: Object.fromEntries(['1', '2', '3', '4', '5'].flatMap((c) => [1, 2, 3, 4, 5, 6].map((n) => [`${c}-${n}`, { done: !(c === '5' && n === 6 && !ended), stars: 7, best: 3, code: '' }])).filter(([, v]) => v.done)), ended });
async function framing(page, label, { minPuppet = 120, minRow = 30, minCell = 18 } = {}) {
  await page.waitForTimeout(350);
  const L = await page.evaluate(() => window.__bandLayout());
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const inside = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
  assert.ok(inside(L.grid), `${label}: the whole grid is in view (${JSON.stringify(L.grid)})`);
  assert.ok(L.rh >= minRow && L.cw >= minCell, `${label}: rows and cells are a clear size (${L.rh.toFixed(0)} × ${L.cw.toFixed(0)})`);
  for (const who of ['dora', 'enzo']) {
    assert.ok(inside(L.face[who]), `${label}: ${who}'s face is in view`);
    assert.ok(L[who].h >= minPuppet, `${label}: ${who} is a clear size (${L[who].h.toFixed(0)}px)`);
    assert.ok(!overlap(L.face[who], L.grid, 4), `${label}: the grid leaves ${who}'s face clear`);
  }
  for (const q of ['.wb-bar', '.wb-card', '.wb-dock', '.wb-result', '.wb-banner']) {
    const r = await rect(page, q); if (!r) continue;
    assert.ok(inside(r), `${label}: ${q} is in view`);
    assert.ok(!overlap(r, L.grid, 2), `${label}: ${q} does not cover the grid`);
    for (const who of ['dora', 'enzo']) assert.ok(!overlap(r, L.face[who], 2), `${label}: ${q} does not cover ${who}'s face`);
  }
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
  return L;
}
async function tapCells(page, m, steps, touch = false) {
  for (const i of steps) { const [x, y] = await cell(page, m, i); if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(60); }
}

// ---- the menu, and the first request with the real mouse
{
  const page = await open(undefined, false, true);
  await page.goto(base + '/band'); await ready(page);
  assert.equal(await page.title(), 'Woodland Band · Dora & Enzo’s Arcade');
  await page.locator('h1', { hasText: 'Woodland' }).waitFor();
  assert.ok(await page.locator('a[href="/"]').count() > 0, 'a way back to the arcade');
  assert.ok(await page.locator('.wb-alt', { hasText: 'Jam' }).isDisabled(), 'the jam waits for two requests');
  assert.ok(await noSideScroll(page), 'menu: no sideways scroll');
  const hero = await rect(page, '.wb-hero');
  assert.ok(hero.w >= 1000, `menu: the hero fills the screen (${hero.w})`);
  await page.locator('.wb-go', { hasText: 'Start playing' }).click();
  await page.waitForFunction(() => window.__band().req === '1-1');
  await page.locator('.wb-tip', { hasText: 'Tap' }).waitFor();
  await dismissTip(page);
  let s = await state(page);
  assert.ok(s.playing, 'the band starts playing straight away');
  await page.waitForFunction(() => window.__band().step >= 0, null, { timeout: 10000 });
  await framing(page, '1280×800 first request', { minPuppet: 180, minRow: 60, minCell: 60 });
  await tapCells(page, 'hedgehog', [0, 2, 4]);
  s = await state(page);
  assert.equal(text(row(s, 'hedgehog')), '0.0.0...', 'three taps, three kicks');
  assert.ok(!s.solved && s.close > 0.5, 'nearly there');
  assert.equal(await page.locator('[data-testid=changes] b').textContent(), '3', 'three changes so far');
  await tapCells(page, 'hedgehog', [6]);
  s = await state(page);
  assert.ok(s.solved, 'four kicks: the echo matches');
  await page.locator('.wb-result').waitFor({ timeout: 15000 });
  s = await state(page);
  assert.ok(s.won && s.result, 'the loop came round and the audience loves it');
  assert.equal(await page.locator('.wb-result .wb-stars i.is-on').count(), 2, 'two stars: solved within par, no flourish');
  await framing(page, '1280×800 result', { minPuppet: 150, minRow: 40, minCell: 40 });
  const sv = await saved(page);
  assert.ok(sv.reqs['1-1'].done && sv.reqs['1-1'].stars === 3 && sv.reqs['1-1'].best === 4 && sv.reqs['1-1'].code.startsWith('WB'), 'the solve is saved with its song');

  // the second: a real drag up for pitch, and the hum
  await page.locator('.wb-result .wb-go', { hasText: 'Next' }).click();
  await page.waitForFunction(() => window.__band().req === '1-2');
  await dismissTip(page);
  await page.locator('.wb-hum').click();
  await page.waitForFunction(() => window.__band().humming, null, { timeout: 8000 });
  await tapCells(page, 'frog', [0]);
  const [fx, fy] = await cell(page, 'frog', 4, 0.75);
  await page.mouse.move(fx, fy); await page.mouse.down();
  let p = -1;
  for (let k = 1; k <= 40 && p !== 3; k++) { await page.mouse.move(fx, fy - k * 3); p = row(await state(page), 'frog').n[4]; }
  await page.mouse.up();
  s = await state(page);
  assert.equal(text(row(s, 'frog')), '0...3...', 'a tap and a drag up to G');
  assert.ok(s.solved, 'the frogs’ hum matches');
  await page.waitForFunction(() => window.__band().result, null, { timeout: 15000 });
  await page.locator('.wb-result .wb-alt', { hasText: 'Again' }).click();
  await page.waitForFunction(() => !window.__band().result);

  // the keyboard: choose a cell, put a note in, raise it, undo, stop and play
  await page.locator('[data-testid=stage]').focus();
  await page.keyboard.press('ArrowRight');
  s = await state(page);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  s = await state(page);
  const on = s.song.rows.find((r) => r.n.some((v, i) => v >= 0 && i === 1));
  assert.ok(on, 'Enter puts a note in the chosen cell');
  await page.keyboard.press('w'); await page.keyboard.press('w');
  const raised = (await state(page)).song.rows.find((r) => r.m === on.m).n[1];
  assert.ok(raised > on.n[1], 'W raises it');
  await page.keyboard.press('u');
  assert.equal((await state(page)).song.rows.find((r) => r.m === on.m).n[1], raised - 1, 'U undoes one step');
  await page.keyboard.press(' '); assert.ok(!(await state(page)).playing, 'Space stops the band');
  await page.keyboard.press(' '); assert.ok((await state(page)).playing, 'and starts it again');

  // a musician joins from the picker, and leaves with the ✕
  await page.locator('.wb-btn[aria-label="Add a musician"]').click();
  await page.locator('.wb-picker').waitFor();
  await page.locator('.wb-who[data-who=enzo]').click();
  await page.waitForFunction(() => window.__band().song.rows.some((r) => r.m === 'enzo'));
  await settle(page);
  const xy = await page.evaluate(() => window.__bandX('enzo'));
  await page.mouse.click(xy[0], xy[1]);
  await page.waitForFunction(() => !window.__band().song.rows.some((r) => r.m === 'enzo'));

  // progress across a reload
  await page.reload(); await ready(page);
  assert.ok((await page.locator('.wb-go', { hasText: 'Continue' }).textContent()).includes('1-3'), 'Continue goes on to 1-3 after a reload');
  assert.ok(!(await page.locator('.wb-alt', { hasText: 'Jam' }).isDisabled()), 'the jam is open now');
  await page.locator('.wb-alt', { hasText: 'Clearings' }).click();
  await page.locator('.wb-req', { hasText: 'Something Sleepy' }).waitFor();
  assert.equal(await page.locator('.wb-req.is-done').count(), 2, 'two requests played');
  assert.ok(await page.locator('.wb-req', { hasText: 'Wandering Frog' }).isDisabled(), 'the next but one waits');
  const card = await rect(page, '.wb-clearing');
  assert.ok(card.w >= 1000 && card.x > 10, `the clearing cards are big and centred (${card.w})`);

  // a corrupt save is ignored
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"reqs":{"1-1":{"done":"maybe"}},"slots":7'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.locator('.wb-go', { hasText: 'Start playing' }).count(), 'a corrupt save starts afresh');
  await page.close();
}

// ---- the jam: save slots and share codes
{
  const page = await open();
  await page.goto(base + '/band'); await ready(page);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save({ reqs: { '1-1': { done: true, stars: 7, best: 6, code: '' }, '1-2': { done: true, stars: 1, best: 4, code: '' } } })]);
  await page.reload(); await ready(page);
  await page.locator('.wb-alt', { hasText: 'Jam' }).click();
  await page.waitForFunction(() => window.__band().screen === 'play' && window.__band().req === null);
  await tapCells(page, 'hedgehog', [0, 4, 8, 12]);
  await tapCells(page, 'dora', [0, 8]);
  const before = await state(page);
  await page.locator('[data-testid=tempo]').waitFor();
  await page.locator('.wb-btn[aria-label="Quicker"]').click();
  assert.equal((await state(page)).song.bpm, before.song.bpm + 4, 'the tempo dial turns in the jam');
  await page.locator('.wb-btn[aria-label="Songs and codes"]').click();
  await page.locator('.wb-slots').waitFor();
  await page.locator('.wb-slot').first().locator('button', { hasText: 'Save here' }).click();
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).slots[0]?.name === 'Moss Waltz', KEY);
  const code = await page.locator('[data-testid=code]').textContent();
  assert.ok(/^WB[A-Za-z0-9_-]+$/.test(code) && code.length < 90, `a short song code (${code})`);
  await page.locator('.wb-slots .wb-alt', { hasText: 'Close' }).click();
  await page.locator('.wb-btn[aria-label="Clear"]').click();
  await page.waitForFunction(() => window.__band().song.rows.every((r) => r.n.every((v) => v < 0)));
  await page.locator('.wb-btn[aria-label="Songs and codes"]').click();
  await page.locator('.wb-share input').fill('WBnotreal');
  await page.locator('.wb-share button', { hasText: 'Load code' }).click();
  await page.locator('.wb-toast', { hasText: 'doesn’t look right' }).waitFor();
  await page.locator('.wb-share input').fill(code);
  await page.locator('.wb-share button', { hasText: 'Load code' }).click();
  await page.waitForFunction(() => window.__band().song.rows.some((r) => r.n.some((v) => v >= 0)));
  const after = await state(page);
  assert.equal(text(row(after, 'hedgehog')), text(row(before, 'hedgehog')), 'the code brings the hedgehog back');
  assert.equal(text(row(after, 'dora')), text(row(before, 'dora')), 'and Dora');
  assert.equal(after.song.bpm, before.song.bpm + 4, 'at its tempo');
  await page.reload(); await ready(page);
  await page.locator('.wb-alt', { hasText: 'Jam' }).click();
  await page.waitForFunction(() => window.__band().song.rows.some((r) => r.n.some((v) => v >= 0)));
  assert.equal(text(row(await state(page), 'dora')), text(row(before, 'dora')), 'the jam keeps its song across a reload');
  await page.close();
}

// ---- the festival and its ending; 1920×1080
{
  const page = await open({ width: 1920, height: 1080 });
  await page.goto(base + '/band'); await ready(page);
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, ALL(false)]);
  await page.reload(); await ready(page);
  assert.ok(!(await page.locator('.wb-alt', { hasText: 'Festival' }).count()), 'no festival before the finale');
  await page.locator('.wb-go', { hasText: 'Continue' }).click();
  await page.waitForFunction(() => window.__band().req === '5-6');
  await framing(page, '1920×1080 finale', { minPuppet: 260, minRow: 70, minCell: 60 });
  const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.wb-ask')).fontSize));
  assert.ok(fs >= 21, `text scales up on a big screen (${fs}px)`);
  await page.evaluate(() => window.__bandSolve());
  await page.locator('.wb-result .wb-go', { hasText: 'Festival' }).waitFor({ timeout: 20000 });
  await framing(page, '1920×1080 result', { minPuppet: 220, minRow: 50, minCell: 50 });
  await page.locator('.wb-result .wb-go', { hasText: 'Festival' }).click();
  await page.locator('.wb-banner').waitFor();
  assert.equal((await state(page)).screen, 'fest');
  await framing(page, '1920×1080 festival', { minPuppet: 220, minRow: 50, minCell: 50 });
  await page.locator('.wb-banner button', { hasText: 'Next' }).click();
  assert.equal((await state(page)).fest, 1, 'the next song in the set');
  await page.locator('.wb-banner button', { hasText: 'Skip' }).click();
  await page.locator('.wb-ending h2', { hasText: 'Moonlight Festival' }).waitFor();
  assert.ok((await saved(page)).ended, 'the ending is saved');
  await page.locator('.wb-ending .wb-alt', { hasText: 'Menu' }).click();
  await page.locator('.wb-alt', { hasText: 'Festival' }).waitFor();
  await page.close();
}

// ---- phones, upright and sideways, by touch
for (const [label, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
  const page = await open(vp, true);
  await page.goto(base + '/band'); await ready(page);
  assert.ok(await noSideScroll(page), `${label}: menu has no sideways scroll`);
  await page.locator('.wb-go', { hasText: 'Start playing' }).tap();
  await page.waitForFunction(() => window.__band().req === '1-1');
  await dismissTip(page, true);
  await framing(page, `${label} first request`, { minPuppet: 85, minRow: label === 'upright' ? 50 : 28, minCell: 30 });
  await tapCells(page, 'hedgehog', [0, 2, 4, 6], true);
  assert.equal(text(row(await state(page), 'hedgehog')), '0.0.0.0.', `${label}: four taps`);
  await page.locator('.wb-result').waitFor({ timeout: 15000 });
  await framing(page, `${label} result`, { minPuppet: 85, minRow: 24, minCell: 30 });
  // a long request on a small screen still fits
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, ALL(false)]);
  await page.reload(); await ready(page);
  await page.evaluate(() => window.__bandOpen('5-6'));
  await page.waitForFunction(() => window.__band().req === '5-6');
  await framing(page, `${label} six musicians`, { minPuppet: 85, minRow: label === 'upright' ? 40 : 22, minCell: 18 });
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('band e2e: menu, mouse and keyboard play, the picker, saves, the jam and codes, the festival, framing and phones all pass');
await browser.close();
