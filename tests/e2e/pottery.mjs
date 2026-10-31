// Kiln & Clay in the browser: the arcade card and the menu; Mrs Prickle's blackberry bowl thrown with the real mouse
// (centred, opened, the walls raised and shaped), shown to her, glazed by dipping and painting a band, fired with
// the Space bar and delivered for acorns; the wheel's tools (speed, water, the outline, trim, a fresh lump) by mouse
// and key; a collapse; the save across a reload, the gallery and a corrupt save; the framing at 1280×800 and
// 1920×1080 (Dora and Enzo a clear size, nothing over them or the pot); phones held either way, thrown by touch;
// and at all four sizes, Dora and Enzo as big at the kiln and the counter as at the wheel, and the picnic's words clear of all three.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'kiln-clay-v1';
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
const wheel = (page) => game(page, () => { const g = window.__pottery(), w = g.wheel; return { phase: g.phase, screen: g.screen, w: w && { centred: w.centred, opened: w.opened, top: w.top, maxR: w.maxR, flumps: w.flumps, wet: w.wet, speed: w.speed, slump: w.slump } }; });
const pt = (page, x, y) => game(page, ([a, b]) => window.__potteryPoint(a, b), [x, y]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const closeTip = async (page) => { const t = page.getByRole('button', { name: 'Got it' }); if (await t.count()) await t.click(); };

/** Presses on the clay at (x0, y0) in pot units and drags to (x1, y1) slowly, with the mouse or a finger. */
async function drag(page, a, b, { ms = 900, cdp = null, hold = 0 } = {}) {
  const [x0, y0] = await pt(page, ...a), steps = Math.max(2, Math.round(ms / 50));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  if (cdp) await touch('touchStart', x0, y0); else { await page.mouse.move(x0, y0); await page.mouse.down(); }
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, [x, y] = await pt(page, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (cdp) await touch('touchMove', x, y); else await page.mouse.move(x, y);
    await page.waitForTimeout(50);
  }
  if (hold) await page.waitForTimeout(hold);
  if (cdp) await touch('touchEnd'); else await page.mouse.up();
}
/** Centres, opens and raises the clay: the first three steps of any pot. */
async function throwBasics(page, cdp = null) {
  await page.waitForFunction(() => { const p = window.__potteryPoint(0, 2); return p && Number.isFinite(p[0]) && Number.isFinite(p[1]); });
  await page.waitForTimeout(300);
  await drag(page, [0, 2], [0, 2], { ms: 2600, cdp });
  let s = (await wheel(page)).w;
  assert.equal(s.centred, 1, 'holding on the spinning clay centres it');
  await drag(page, [0, s.top - 0.1], [0, 0.8], { ms: 1100, cdp });
  s = (await wheel(page)).w; assert.ok(s.opened, 'pressing down into the middle opens it');
  for (let pass = 0; pass < 2; pass++) {
    s = (await wheel(page)).w;
    await drag(page, [s.maxR + 0.3, 0.3], [s.maxR + 0.1, s.top + 1], { ms: 1300, cdp });
    await page.waitForTimeout(200);
  }
  return (await wheel(page)).w;
}

// ---------------------------------------------------------------- the arcade card and the menu
{
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 65);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.getByRole('link', { name: /Kiln & Clay/ }).click();
  await page.waitForURL(/\/pottery$/); await ready(page);
  assert.ok(await page.getByRole('heading', { name: /Kiln/ }).isVisible());
  assert.ok(await page.getByRole('button', { name: /Free throw/ }).first().isDisabled(), 'the free throw opens after the first order');
  assert.ok(await noSideScroll(page));
  console.log('PASS the arcade card and the menu');

  // ---------------------------------------------------------------- the first order, all with the real mouse and keys
  await page.getByRole('button', { name: /OPEN THE WORKSHOP/ }).click();
  assert.equal(await page.locator('.kc-order').count(), 3, 'three orders on the first day');
  await page.getByRole('button', { name: 'Make it →' }).first().click();
  await closeTip(page);
  assert.equal((await wheel(page)).phase, 'throw');
  assert.match(await page.locator('.kc-hint').textContent(), /centre/i, 'the first pot walks you through it');
  const s = await throwBasics(page);
  assert.ok(s.top > 2.4, `the walls rise (top ${s.top.toFixed(2)})`);
  assert.equal(s.flumps, 0);
  const live = await page.getByTestId('live').textContent();
  assert.match(live, /Shape \d+%/);
  // the wheel's tools: speed by key and by button, water, the outline, trim
  await page.keyboard.press('1'); assert.equal((await wheel(page)).w.speed, 1);
  await page.getByRole('button', { name: 'Fast wheel' }).click(); assert.equal((await wheel(page)).w.speed, 3);
  await page.getByRole('button', { name: 'Medium wheel' }).click();
  const wet0 = (await wheel(page)).w.wet; await page.getByRole('button', { name: 'Water' }).click();
  assert.ok((await wheel(page)).w.wet > wet0, 'water wets the clay');
  const ghost0 = await game(page, () => window.__pottery().save.settings.ghost);
  await page.keyboard.press('g'); assert.notEqual(await game(page, () => window.__pottery().save.settings.ghost), ghost0, 'G toggles the outline');
  await page.keyboard.press('g');
  const top0 = (await wheel(page)).w.top;
  await page.getByRole('button', { name: 'Trim' }).click();
  const [tx, ty] = await pt(page, 0, top0 - 0.25); await page.mouse.click(tx, ty);
  assert.ok((await wheel(page)).w.top < top0 - 0.1, 'trim takes the rim down to where you tap');
  await page.keyboard.press('Enter');
  await page.locator('.kc-result').waitFor();
  const stars = await page.locator('.kc-result .kc-stars i.is-on').count();
  assert.ok(stars >= 1, `Mrs Prickle likes the bowl (${stars} stars)`);
  await page.getByRole('button', { name: /Keep it/ }).click();
  await closeTip(page);
  assert.equal((await wheel(page)).phase, 'glaze');
  // glaze: dip in honey, then a sky band at the rim, undo it and paint it again
  await page.getByRole('button', { name: 'Honey' }).click(); await page.getByRole('button', { name: 'Dip' }).click();
  assert.equal(await game(page, () => window.__pottery().job.glaze.base), 'honey');
  await page.getByRole('button', { name: 'Sky blue' }).click();
  const h = await game(page, () => window.__pottery().job.parts[0].prof.h);
  await drag(page, [0, h * 0.86], [0, h * 0.99], { ms: 300 });
  assert.equal(await game(page, () => window.__pottery().job.glaze.bands.length), 1, 'dragging paints a band');
  await page.keyboard.press('z'); assert.equal(await game(page, () => window.__pottery().job.glaze.bands.length), 0, 'Z undoes it');
  await drag(page, [0, h * 0.86], [0, h * 0.99], { ms: 300 });
  assert.ok(await page.locator('.kc-wishes li.is-on').count() >= 1, 'the wish list ticks off honey all over');
  await page.getByRole('button', { name: 'To the kiln' }).click();
  assert.equal((await wheel(page)).phase, 'fire');
  // fire: hold Space to keep the needle in the green
  for (let i = 0; i < 500; i++) {
    const f = await game(page, () => { const k = window.__pottery().firing; return k && { T: k.T, lo: k.lo, hi: k.hi, done: k.done }; });
    if (!f || f.done) break;
    if (f.T < (f.lo + f.hi) / 2 - 0.02) await page.keyboard.down(' '); else await page.keyboard.up(' ');
    await page.waitForTimeout(40);
  }
  await page.keyboard.up(' ');
  await page.locator('.kc-result').waitFor();
  assert.match(await page.locator('.kc-result h2').textContent(), /shining|good/i, 'steady bellows give a good firing');
  await page.getByRole('button', { name: /Deliver it/ }).click();
  await page.getByTestId('pay').waitFor();
  const save = await game(page, () => window.__pottery().save);
  assert.ok(save.done.o1 >= 1 && save.acorns >= 10, `delivered and paid (${save.acorns} acorns)`);
  await page.getByRole('button', { name: /Keep one/ }).click();
  await page.getByRole('button', { name: /Back to the board/ }).click();
  assert.equal(await page.locator('.kc-order.is-done').count(), 1);
  console.log(`PASS the blackberry bowl thrown, glazed, fired and delivered by mouse and keys (${stars}★, ${save.acorns} acorns)`);

  // ---------------------------------------------------------------- a collapse: walls pulled out too thin, too fast
  await page.getByRole('button', { name: /Free throw/ }).first().click();
  await closeTip(page);
  await page.keyboard.press('3');
  await throwBasics(page);
  let flumped = false;
  for (let i = 0; i < 10 && !flumped; i++) {
    const w = await game(page, () => { const w = window.__pottery().wheel; return { slump: w.slump, top: w.top, Ri: w.at(w.top - 0.3).Ri }; });
    if (w.slump >= 0) { flumped = true; break; }
    await drag(page, [w.Ri - 0.2, w.top - 0.3], [9, w.top - 0.3], { ms: 300, hold: 1500 });
    flumped = (await wheel(page)).w.flumps > 0;
  }
  assert.ok(flumped, 'pulling the walls out thin on a fast wheel collapses them');
  await page.locator('.kc-toast').filter({ hasText: /Flump/ }).waitFor();
  await page.waitForFunction(() => window.__pottery().wheel.slump < 0);
  await page.keyboard.press('r'); assert.equal((await wheel(page)).w.opened, false, 'R gives a fresh lump');
  await page.keyboard.press('Escape'); assert.ok(await page.getByRole('dialog', { name: 'Paused' }).isVisible());
  await page.getByRole('button', { name: 'To the board' }).click();
  console.log('PASS the tools, a flump and a fresh lump');

  // ---------------------------------------------------------------- the save across a reload, and the gallery
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /CONTINUE/ }).textContent(), /Day 1/);
  assert.ok(await page.getByRole('button', { name: /Free throw/ }).first().isEnabled(), 'the free throw is open now');
  await page.getByRole('button', { name: /Gallery/ }).click();
  assert.equal(await page.locator('.kc-shelfpot').count(), 1, 'the kept bowl is on the gallery shelf');
  await page.getByRole('button', { name: '← Back' }).click();
  await page.getByRole('button', { name: /CONTINUE/ }).click();
  assert.equal(await page.locator('.kc-order.is-done').count(), 1);
  console.log('PASS the save across a reload and the gallery');

  // ---------------------------------------------------------------- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"acorns":"lots","day":99,"done":[1,2],"gallery":{"x":1},"rack":[{"order":"o99"}]'), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /OPEN THE WORKSHOP|CONTINUE/ }).click();
  assert.equal(await page.locator('.kc-order').count(), 3);
  assert.match(await page.getByTestId('acorns').textContent(), /^\d+$/);
  await page.evaluate((k) => localStorage.setItem(k, 'not json at all'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /OPEN THE WORKSHOP/ }).isVisible(), 'a broken save starts fresh');
  console.log('PASS a corrupt save');
  await page.context().close();
}

// ---------------------------------------------------------------- the framing on desktop screens
for (const [W, H, minH] of [[1280, 800, 230], [1920, 1080, 320]]) {
  const page = await open({ width: W, height: H });
  await page.goto(base + '/pottery'); await ready(page);
  await page.evaluate(() => window.__potteryOpen('o2'));
  await closeTip(page);
  await page.waitForTimeout(400);
  const m = await game(page, () => window.__potteryScene());
  const cv = await page.locator('canvas.kc-canvas').boundingBox();
  for (const who of ['dora', 'enzo']) {
    const [x, y, w, h] = m[who];
    assert.ok(h >= minH, `${who} is a clear size at ${W}×${H} (${Math.round(h)}px)`);
    assert.ok(x >= -2 && x + w <= W + 2, `${who} is on screen`);
    // nothing on top of their faces (the upper middle of the box)
    const face = { x: cv.x + x + w * 0.25, y: cv.y + y + h * 0.05, w: w * 0.5, h: h * 0.5 };
    for (const sel of ['.kc-side', '.kc-hint', '.kc-tools']) {
      const r = await page.locator(sel).boundingBox(); if (!r) continue;
      const hit = r.x < face.x + face.w && r.x + r.width > face.x && r.y < face.y + face.h && r.y + r.height > face.y;
      assert.ok(!hit, `${sel} is clear of ${who}'s face at ${W}×${H}`);
    }
  }
  // the pot and its outline are clear of the bars
  const top = await game(page, () => Math.max(window.__pottery().wheel.top, 4.2));
  const [, py] = await pt(page, 0, top), [, by] = await pt(page, 0, 0);
  for (const sel of ['.kc-hint', '.kc-tools']) {
    const r = await page.locator(sel).boundingBox(); const [px0] = await pt(page, -3, 0), [px1] = await pt(page, 3, 0);
    const hit = r.x < px1 && r.x + r.width > px0 && r.y < by && r.y + r.height > py;
    assert.ok(!hit, `${sel} is clear of the pot at ${W}×${H}`);
  }
  assert.ok(await noSideScroll(page));
  console.log(`PASS the framing at ${W}×${H} (Dora ${Math.round(m.dora[3])}px, Enzo ${Math.round(m.enzo[3])}px)`);
  await page.context().close();
}

// ---------------------------------------------------------------- phones, held upright and sideways, thrown by touch
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp, true);
  const cdp = await page.context().newCDPSession(page);
  await page.goto(base + '/pottery'); await ready(page);
  assert.ok(await noSideScroll(page), `the menu fits ${vp.width}×${vp.height}`);
  await page.getByRole('button', { name: /OPEN THE WORKSHOP/ }).tap();
  await page.getByRole('button', { name: 'Make it →' }).first().tap();
  await closeTip(page);
  assert.equal(await page.locator('main').getAttribute('data-touch'), vp.width > vp.height ? 'wide' : 'tall');
  const s = await throwBasics(page, cdp);
  assert.ok(s.opened && s.top > 2.2, `thrown by touch at ${vp.width}×${vp.height}`);
  const m = await game(page, () => window.__potteryScene());
  for (const who of ['dora', 'enzo']) assert.ok(m[who][3] >= Math.min(vp.width, vp.height) * 0.22, `${who} is a clear size on the phone`);
  const tools = await page.locator('.kc-tools').boundingBox();
  assert.ok(tools.y + tools.height <= vp.height + 1 && tools.x >= -1 && tools.x + tools.width <= vp.width + 1, 'the tools fit on screen');
  await page.getByRole('button', { name: 'Done' }).tap();
  await page.locator('.kc-result').waitFor();
  const r = await page.locator('.kc-result').boundingBox();
  assert.ok(r.y >= 0 && r.y + r.height <= vp.height + 1, 'the verdict fits on screen');
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone at ${vp.width}×${vp.height}, thrown by touch`);
  await page.context().close();
}

// ---------------------------------------------------------------- Dora and Enzo the same size at the kiln and the counter; the picnic's words clear of all three
{
  const prof = { h: 3.2, r: Array.from({ length: 33 }, (_, i) => 1.6 + 2 * Math.sin((i / 32) * 1.4)), floor: 0.5 };
  prof.ri = prof.r.map((r, i) => (i < 4 ? 0 : r - 0.45));
  const racked = { v: 1, acorns: 0, day: 1, done: {}, upgrades: [], gallery: [], rack: [{ order: 'o1', parts: [{ id: 'body', prof, stars: 3 }], handle: null, glaze: { base: 'honey', bands: [], speckle: false, drip: null }, throwStars: 3 }], ended: false, seen: ['o1', 'o2', 'o3'], tutorial: true, tipDay: 1, flumps: 0, pots: 0, settings: { sound: false, music: false, ghost: true } };
  const ids = Array.from({ length: 21 }, (_, i) => 'o' + (i + 1));
  const ended = { ...racked, rack: [], day: 7, done: Object.fromEntries(ids.map((id) => [id, 3])), ended: true };
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  for (const [vp, mobile] of [[{ width: 1280, height: 800 }, false], [{ width: 1920, height: 1080 }, false], [{ width: 390, height: 844 }, true], [{ width: 844, height: 390 }, true]]) {
    const page = await open(vp, mobile), at = `${vp.width}×${vp.height}`;
    await page.goto(base + '/pottery'); await ready(page);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(racked)]);
    await page.reload(); await ready(page);
    await page.evaluate(() => window.__potteryOpen('o2')); await closeTip(page); await page.waitForTimeout(300);
    const size = async () => { const m = await game(page, () => window.__potteryScene()); return [m.dora, m.enzo]; };
    const [wd] = await size();
    await page.evaluate(() => { window.confirm = () => true; }); await page.getByRole('button', { name: '← BOARD' }).click();
    await page.getByRole('button', { name: /Fire the kiln/ }).click(); await page.waitForTimeout(400);
    assert.match(await page.locator('.kc-bar-mid').textContent(), /blackberry bowl/i, 'the bar names the pot from the rack');
    const clear = async (where, sels) => {
      const cv = await page.locator('canvas.kc-canvas').boundingBox();
      for (const [x, y, w, h] of await size()) {
        assert.ok(Math.abs(h - wd[3]) < 1, `${where} at ${at}: the pair as big as at the wheel (${Math.round(h)} vs ${Math.round(wd[3])}px)`);
        assert.ok(x >= -2 && x + w <= vp.width + 2, `${where} at ${at}: on screen`);
        const face = { x: cv.x + x + w * 0.25, y: cv.y + y + h * 0.05, width: w * 0.5, height: h * 0.5 };
        for (const sel of sels) { const r = await page.locator(sel).boundingBox(); if (r) assert.ok(!overlap(r, face), `${where} at ${at}: ${sel} clear of a face`); }
      }
    };
    await clear('the kiln', ['.kc-tools', '.kc-fire-hint']);
    await game(page, () => { window.__pottery().firing.t = 99; });
    await page.locator('.kc-fired').waitFor(); await page.waitForTimeout(400);
    await clear('out of the kiln', ['.kc-fired']);
    await page.getByRole('button', { name: /Deliver it/ }).click(); await page.getByTestId('pay').waitFor(); await page.waitForTimeout(400);
    await clear('the counter', ['.kc-deliver']);
    // the picnic: the painting's three (x 8.5–92.5%, y 18.5–78% of it) all on screen, nothing over them
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(ended)]);
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: /The picnic/ }).first().click(); await page.waitForTimeout(500);
    const art = await page.locator('.kc-ending-art').boundingBox(), k = Math.max(art.width / 1536, art.height / 1024);
    const ox = art.x + (art.width - 1536 * k) * 0.5, oy = art.y + (art.height - 1024 * k) * 0.45;
    const trio = { x: ox + 0.085 * 1536 * k, y: oy + 0.185 * 1024 * k, width: 0.84 * 1536 * k, height: 0.595 * 1024 * k };
    assert.ok(trio.x >= art.x - 1 && trio.y >= art.y - 1 && trio.x + trio.width <= art.x + art.width + 1 && trio.y + trio.height <= art.y + art.height + 1, `the picnic at ${at}: all three in view`);
    for (const sel of ['.kc-ending-text', '.kc-credits', '.kc-ending .kc-go']) {
      const r = await page.locator(sel).boundingBox(); if (r && r.width > 0) assert.ok(!overlap(r, trio), `the picnic at ${at}: ${sel} clear of the three`);
    }
    const go = await page.locator('.kc-ending .kc-go').boundingBox();
    assert.ok(go.y >= 0 && go.y + go.height <= vp.height + 1, `the picnic at ${at}: the button on screen`);
    assert.ok(await noSideScroll(page));
    console.log(`PASS the kiln, the counter and the picnic at ${at} (the pair ${Math.round(wd[3])}px throughout)`);
    await page.context().close();
  }
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
