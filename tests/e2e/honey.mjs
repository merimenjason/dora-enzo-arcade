// Honeycomb Hollow in the browser: the menu and the opening story pages, the first tip, the first chamber played to
// the end with the real mouse (hover lights a trio, click turns it clockwise, right-click anticlockwise, a turn that
// matches nothing springs back for free) and the keyboard (arrows walk the cursor, X and Z turn), the result card
// beside the comb, the next chamber, progress kept across a reload, a corrupt save, the chamber map with its locks,
// the ending; the framing at 1280×800 and 1920×1080 (Dora and Enzo in view, a clear size, clear of the comb, the
// buttons and each other) and on phones held upright and sideways, turning by touch (a tap, and a drag round the
// corner); every story page with the card clear of the cast; the smallest phones (667×375, 360×740) with the
// map tabs, the story and the ending laid out clear. Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'honeycomb-hollow-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
const state = (page) => page.evaluate(() => window.__honey());
const idle = (page) => page.waitForFunction(() => { const s = window.__honey(); return !s.busy; }, null, { polling: 50, timeout: 20000 });
const corner = (page, t) => page.evaluate((a) => window.__honeyTrio(a), t);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const seen = ['clover-in', 'clover-out', 'rose-in', 'rose-out', 'lavender-in', 'lavender-out', 'heather-in', 'heather-out', 'queen-in', 'queen-out'];
const saveWith = (done, extra = {}) => JSON.stringify({ v: 1, best: Object.fromEntries(done.map((id) => [id, { stars: 2, score: 900 }])), tips: ['c1', 'c2', 'c4', 'c6', 'c7', 'c8', 'c10'], story: seen, ended: false, tries: {}, settings: { sound: false, music: false }, ...extra });
async function closeOverlays(page) {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('.hh-story').count()) { await page.locator('.hh-bubble button').click(); continue; }
    if (await page.locator('.hh-tip button').count()) { await page.locator('.hh-tip button').click(); continue; }
    break;
  }
}
/** Turns trio t by a real click (or right-click) on its corner, then waits for the comb to settle. */
async function click(page, m) {
  const [x, y] = await corner(page, m.t);
  await page.mouse.move(x, y); await page.mouse.click(x, y, { button: m.dir === 1 ? 'left' : 'right' });
  await idle(page);
}

/** A tap turns clockwise; a drag round the corner (from above it, sweeping left) turns anticlockwise. */
async function touchTurn(page, m) {
  const [x, y] = await corner(page, m.t);
  if (m.dir === 1) await page.touchscreen.tap(x, y);
  else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y - 16 }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - k * 5, y: y - 16 + k * 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }
  await idle(page);
}

/** Dora and Enzo on screen, a clear size, clear of the comb, the buttons, the result card and each other; faces clear. */
async function framing(page, label, minChin, minCell) {
  const r = await page.evaluate(() => {
    const s = window.__honeyScene(), c = document.querySelector('.hh-canvas').getBoundingClientRect();
    const rect = (q) => { const b = document.querySelector(q)?.getBoundingClientRect(); return b && b.width ? { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom } : null; };
    return { s, c: { x: c.left, y: c.top }, W: innerWidth, H: innerHeight, tools: rect('.hh-tools'), card: rect('.hh-result-card'), top: document.querySelector('.hh-bar')?.getBoundingClientRect().bottom ?? 0 };
  });
  const { s } = r, box = (b) => ({ x0: r.c.x + b.x + b.w * 0.2, x1: r.c.x + b.x + b.w * 0.8, y0: r.c.y + b.y + b.h * 0.08, y1: r.c.y + b.y + b.h });
  const face = (b) => ({ x0: r.c.x + b.x + b.w * 0.25, x1: r.c.x + b.x + b.w * 0.75, y0: r.c.y + b.y + b.h * 0.05, y1: r.c.y + b.y + b.h * 0.5 });
  const inView = (b) => b.x0 >= -2 && b.y0 >= r.top - 2 && b.x1 <= r.W + 2 && b.y1 <= r.H + 2;
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
  const comb = { x0: r.c.x + s.board.x0 + s.s * 0.4, x1: r.c.x + s.board.x1 - s.s * 0.4, y0: r.c.y + s.board.y0 + s.s * 0.4, y1: r.c.y + s.board.y1 - s.s * 0.4 };
  const dora = box(s.dora), enzo = box(s.enzo);
  for (const [n, b, f] of [['Dora', dora, face(s.dora)], ['Enzo', enzo, face(s.enzo)]]) {
    assert.ok(inView(b), `${label}: ${n} is in view (${[b.x0, b.y0, b.x1, b.y1].map(Math.round)} in ${r.W}×${r.H})`);
    assert.ok(overlap(b, comb) < 0.04 * area(b), `${label}: ${n} is clear of the comb`);
    if (r.tools) assert.ok(overlap(b, r.tools) < 0.06 * area(b), `${label}: ${n} is clear of the buttons`);
    if (r.card) assert.equal(overlap(f, r.card), 0, `${label}: the result card leaves ${n}’s face clear`);
  }
  if (r.card) assert.ok(overlap(comb, r.card) < 0.03 * area(comb), `${label}: the result card leaves the comb clear`);
  assert.ok(s.dora.h >= minChin && s.enzo.h >= minChin, `${label}: Dora and Enzo are a clear size (${Math.round(s.dora.h)}px)`);
  assert.ok(s.s >= minCell, `${label}: the cells are a good size (${Math.round(s.s)}px)`);
  assert.equal(overlap(dora, enzo), 0, `${label}: Dora and Enzo don’t overlap`);
  assert.ok(await noSideScroll(page), `${label}: no sideways scrolling`);
}

/** Every story page, opened in turn: the card covers none of the cast (Dora, Enzo and the bee friend or the queen), all in view. */
async function storyClear(page, label) {
  const fails = [];
  for (const key of seen) {
    for (let i = 0; await page.evaluate(([k, j]) => window.__honeyStory(k, j), [key, i]); i++) {
      await page.waitForTimeout(320);
      const r = await page.evaluate(() => {
        // the painted part of each cut-out: its img box fitted the way object-fit: contain fits it
        const fit = (el) => {
          const b = el.getBoundingClientRect(), k = Math.min(b.width / el.naturalWidth, b.height / el.naturalHeight), w = el.naturalWidth * k, h = el.naturalHeight * k;
          const [px, py] = getComputedStyle(el).objectPosition.split(' ').map((v) => parseFloat(v) / 100);
          const x0 = b.left + (b.width - w) * px, y0 = b.top + (b.height - h) * py;
          return { x0, y0, x1: x0 + w, y1: y0 + h };
        };
        const cast = ['.hh-story-dora', '.hh-story-enzo', '.hh-story-bee'].map((q) => document.querySelector(q)).map((e) => (e?.tagName === 'IMG' && e.complete && e.naturalWidth ? fit(e) : null));
        const c = document.querySelector('.hh-bubble').getBoundingClientRect();
        return { cast, card: { x0: c.left, y0: c.top, x1: c.right, y1: c.bottom }, W: innerWidth, H: innerHeight, who: document.querySelector('.hh-bubble-who').textContent };
      });
      const ov = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      ['Dora', 'Enzo', 'the bee'].forEach((n, k) => {
        const b = r.cast[k];
        if (!b) { fails.push(`${key}/${i}: ${n} is missing`); return; }
        if (ov(b, r.card) > 0) fails.push(`${key}/${i} (${r.who}): the card covers ${n}`);
        if (b.x0 < -1 || b.y0 < -1 || b.x1 > r.W + 1 || b.y1 > r.H + 1) fails.push(`${key}/${i} (${r.who}): ${n} runs off screen`);
        if (b.y1 - b.y0 < Math.min(r.W, r.H) * 0.4) fails.push(`${key}/${i}: ${n} is too small (${Math.round(b.y1 - b.y0)}px)`);
      });
    }
  }
  await page.evaluate(() => window.__honeyStory(null));
  await page.locator('.hh-story').waitFor({ state: 'detached' });
  assert.deepEqual(fails, [], `${label}: the story card leaves the cast clear`);
}

/** The smallest phones: the story, the map (all five area tabs across, no sideways scroll), the ending (card clear of the painting). */
async function smallPhone(size) {
  const label = `${size.width}×${size.height}`, p = await open(size, true);
  await p.goto(base + '/honey');
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13'])]);
  await p.reload(); await ready(p);
  assert.ok(await noSideScroll(p), `${label}: the menu doesn't scroll sideways`);
  await storyClear(p, label);
  await p.getByRole('button', { name: /The chambers/ }).click();
  await p.locator('.hh-cards').waitFor();
  assert.ok(await p.evaluate(() => { const t = document.querySelector('.hh-tabs'); return t.scrollWidth <= t.clientWidth + 1; }), `${label}: all five area tabs fit across`);
  assert.ok(await noSideScroll(p), `${label}: the map doesn't scroll sideways`);
  await p.evaluate(() => { const m = document.querySelector('.hh-map'); m.scrollTop = m.scrollHeight; });
  assert.ok(await p.evaluate(() => document.querySelector('.hh-map .hh-bar').getBoundingClientRect().top >= -1), `${label}: the map's bar stays in view`);
  await p.evaluate(() => window.__honeyEnding());
  await p.locator('.hh-ending-card').waitFor();
  const e = await p.evaluate(() => {
    const r = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }; };
    const card = r('.hh-ending-card'), kids = [...document.querySelectorAll('.hh-ending-card > *, .hh-ending-card .hh-menu-buttons > *')].map((k) => k.getBoundingClientRect()).filter((k) => k.width > 0);
    return { art: r('.hh-ending-art'), card, inside: kids.every((k) => k.left >= card.x0 - 1 && k.right <= card.x1 + 1 && k.bottom <= card.y1 + 1), W: innerWidth, H: innerHeight };
  });
  assert.ok(Math.max(0, Math.min(e.art.x1, e.card.x1) - Math.max(e.art.x0, e.card.x0)) * Math.max(0, Math.min(e.art.y1, e.card.y1) - Math.max(e.art.y0, e.card.y0)) === 0, `${label}: the ending card leaves the painting clear`);
  assert.ok(e.inside, `${label}: the ending card holds its buttons`);
  assert.ok(e.card.y1 <= e.H + 1 && e.card.x1 <= e.W + 1, `${label}: the ending card is on screen`);
  assert.ok(await noSideScroll(p), `${label}: the ending doesn't scroll sideways`);
  await p.context().close();
}

try {
  // ---- the menu, the story, the first tip
  const page = await open();
  await page.goto(base + '/');
  assert.equal(await page.locator('.arcade-card').count(), 65);
  await page.locator('a.arcade-card[href="/honey"]').click();
  await ready(page);
  assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Honeycomb Hollow');
  await page.getByRole('button', { name: /Start filling/ }).click();
  await page.locator('.hh-story').waitFor();
  assert.match(await page.locator('.hh-bubble-who').textContent(), /Pip/i, 'Pip tells the story');
  let pages = 0; while (await page.locator('.hh-story').count()) { await page.keyboard.press('Enter'); pages++; assert.ok(pages < 6); }
  assert.equal(pages, 3, 'three story pages open the Clover Hall');
  assert.match(await page.locator('.hh-tip').textContent(), /three cells meet/i, 'the first chamber teaches turning');
  await page.locator('.hh-tip button').click();
  let s = await state(page);
  assert.equal(s.chamber, 'c1'); assert.ok(s.moves > 10);
  await framing(page, '1280×800', 180, 30);
  await storyClear(page, '1280×800');

  // ---- the mouse: hover lights a trio, a dud springs back for free, a click turns
  const dud = await page.evaluate(() => window.__honeyDud());
  assert.ok(dud >= 0);
  const [dx, dy] = await corner(page, dud);
  await page.mouse.move(dx, dy);
  assert.equal((await state(page)).hover, dud, 'pointing at a corner lights its trio');
  await page.mouse.click(dx, dy); await idle(page);
  s = await state(page);
  assert.equal(s.turns, 0, 'a turn that matches nothing springs back'); assert.equal(s.moves, (await page.evaluate(() => window.__honey().moves)));
  const movesAtStart = s.moves;
  const m1 = await page.evaluate(() => window.__honeyBest());
  await click(page, m1);
  s = await state(page);
  assert.equal(s.turns, 1); assert.equal(s.moves, movesAtStart - 1, 'a turn that matches costs one');
  assert.ok(s.goals[0].left < 37, 'honey fills in');
  // an anticlockwise turn with the right button
  const anti = (await page.evaluate(() => window.__honeyMoves())).find((m) => m.dir === -1);
  if (anti) { const before = (await state(page)).turns; await click(page, anti); assert.equal((await state(page)).turns, before + 1, 'right-click turns anticlockwise'); }

  // ---- the keyboard: arrows walk the cursor; X turns the corner under it
  await page.mouse.move(5, 300);
  await page.keyboard.press('ArrowRight');
  assert.ok((await state(page)).cursor >= 0, 'the arrows pick a corner');
  const km = await page.evaluate(() => window.__honeyBest());
  if (km) { await page.evaluate((t) => window.__honeyCursor(t), km.t); const before = (await state(page)).turns; await page.keyboard.press(km.dir === 1 ? 'x' : 'z'); await idle(page); assert.equal((await state(page)).turns, before + 1, 'X and Z turn the corner under the cursor'); }

  // ---- fill the first chamber with real clicks
  for (let k = 0; k < 60 && !(await state(page)).over; k++) { const m = await page.evaluate(() => window.__honeyBest()); assert.ok(m); await click(page, m); }
  s = await state(page);
  assert.ok(s.over?.won, 'the first chamber is filled');
  await page.locator('.hh-result-card').waitFor();
  await page.waitForTimeout(500);
  assert.match(await page.locator('.hh-result-card').textContent(), /Turns to spare/);
  await framing(page, '1280×800 result', 140, 20);
  assert.ok((await state(page)).save.best.c1?.stars >= 1, 'the result is saved');
  await page.getByRole('button', { name: 'Next chamber' }).click();
  await page.waitForFunction(() => window.__honey().chamber === 'c2');
  assert.match(await page.locator('.hh-tip').textContent(), /bee/i, 'chamber 2 teaches bees');
  await page.locator('.hh-tip button').click();

  // ---- progress kept across a reload
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /Continue/ }).textContent(), /Chamber 2/);
  assert.match(await page.locator('.hh-note').first().textContent(), /1 of 60/);

  // ---- the chamber map: tabs, locks
  await page.getByRole('button', { name: /The chambers/ }).click();
  assert.equal(await page.locator('.hh-tab').count(), 5);
  assert.equal(await page.locator('.hh-tab:disabled').count(), 4, 'later areas are locked');
  assert.equal(await page.locator('.hh-card').count(), 12);
  assert.equal(await page.locator('.hh-card:disabled').count(), 10, 'two chambers open');
  await page.locator('.hh-card').nth(1).click();
  await page.waitForFunction(() => window.__honey().chamber === 'c2');
  await page.keyboard.press('r');
  assert.equal((await state(page)).turns, 0);
  await page.keyboard.press('Escape');
  await page.locator('.hh-cards').waitFor();

  // ---- the ending
  await page.evaluate(() => window.__honeyEnding());
  assert.equal(await page.getByRole('heading', { level: 2 }).textContent(), 'The oak glows gold');
  await page.getByRole('link', { name: /MAIN ARCADE/ }).click(); await page.locator('.arcade-grid').waitFor();
  await page.goto(base + '/honey'); await ready(page);

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"best":{"c1":{"stars":"lots"}},"tips":7,"story":{}}'), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Start filling/ }).waitFor();
  await page.evaluate((k) => localStorage.setItem(k, 'not json {'), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Start filling/ }).waitFor();
  await page.context().close();

  // ---- 1920×1080: a big comb, a later chamber with wax and trapped bees
  const big = await open({ width: 1920, height: 1080 });
  await big.goto(base + '/honey');
  await big.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'])]);
  await big.reload(); await ready(big);
  await big.getByRole('button', { name: /Continue/ }).click();
  await big.waitForFunction(() => window.__honey().chamber === 'c10');
  await closeOverlays(big);
  assert.ok((await state(big)).goals.some((g) => g.key === 'bees'), 'trapped bees to free');
  await framing(big, '1920×1080', 260, 44);
  await storyClear(big, '1920×1080');
  await big.context().close();

  // ---- a phone held upright: tap a corner, drag round a corner
  const tall = await open({ width: 390, height: 844 }, true);
  await tall.goto(base + '/honey');
  await tall.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(['c1'])]);
  await tall.reload(); await ready(tall);
  await tall.getByRole('button', { name: /Continue/ }).click();
  await closeOverlays(tall);
  await framing(tall, '390×844', 140, 20);
  await storyClear(tall, '390×844');
  const tm = await tall.evaluate(() => window.__honeyBest());
  await touchTurn(tall, tm);
  assert.equal((await state(tall)).turns, 1, 'a finger turns a trio');
  const drag = (await tall.evaluate(() => window.__honeyMoves())).find((m) => m.dir === -1);
  if (drag) { await touchTurn(tall, drag); assert.equal((await state(tall)).turns, 2, 'dragging round a corner turns it the way you drag'); }
  for (let k = 0; k < 60 && !(await state(tall)).over; k++) await touchTurn(tall, await tall.evaluate(() => window.__honeyBest()));
  if ((await state(tall)).over?.won) { await tall.locator('.hh-result-card').waitFor(); await tall.waitForTimeout(500); await framing(tall, '390×844 result', 90, 12); }
  await tall.context().close();

  // ---- a phone held sideways
  const side = await open({ width: 844, height: 390 }, true);
  await side.goto(base + '/honey');
  await side.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, saveWith(['c1', 'c2'])]);
  await side.reload(); await ready(side);
  await side.getByRole('button', { name: /Continue/ }).click();
  await closeOverlays(side);
  await framing(side, '844×390', 150, 17);
  await storyClear(side, '844×390');
  const sm = (await side.evaluate(() => window.__honeyMoves())).find((m) => m.dir === 1);
  const [sx, sy] = await corner(side, sm.t);
  await side.touchscreen.tap(sx, sy); await idle(side);
  assert.equal((await state(side)).turns, 1, 'a tap turns a trio sideways too');
  await side.context().close();

  // ---- the smallest phones, both ways round
  await smallPhone({ width: 667, height: 375 });
  await smallPhone({ width: 360, height: 740 });

  assert.deepEqual(errors, [], 'no page errors');
  console.log('honey browser suite ok');
} finally {
  await browser.close();
}
