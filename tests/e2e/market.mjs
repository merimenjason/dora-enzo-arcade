// Night Market in the browser: the menu and the customer book; the first dusk played with the real mouse (buying
// from the suppliers, putting wares at the front, lighting a lantern, opening the stall); the first night haggled
// with the real keyboard and mouse (the tells, the dial turned with keys and dragged, asking, a counter-offer taken,
// letting a customer go) through to dawn; progress kept across a reload; a corrupt save; a visitor night (the tax
// heron); the ending; the framing at 1280×800 and 1920×1080 (the stall, Dora, Enzo and the customer in view and a
// clear size, the haggle panel covering none of them); and phones held either way, played by touch. No page errors.
// Needs `npm run dev` on port 3000 (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots there.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const KEY = 'night-market-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const st = (page) => page.evaluate(() => { const s = window.__market(); return { ...s, save: undefined }; });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, q) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, q);
const overlap = (a, b, slack = 1) => a.x < b.x + b.w - slack && b.x < a.x + a.w - slack && a.y < b.y + b.h - slack && b.y < a.y + a.h - slack;
const beat = (page, b) => page.waitForFunction((x) => window.__market().beat === x, b, { timeout: 20000 });
const waitPaintings = (page) => page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});

async function framing(page, label, { minChin = 90, minCustomer = 150 } = {}) {
  await frames(page);
  const L = await page.evaluate(() => window.__marketLayout());
  assert.ok(L, `${label}: the scene is drawn`);
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const inside = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vw + 1 && r.y + r.h <= vh + 1;
  for (const k of ['dora', 'enzo', 'customer']) assert.ok(inside(L[k]), `${label}: the ${k} is in view (${JSON.stringify(L[k])})`);
  const seen = Math.min(vw, L.stall.x + L.stall.w) - Math.max(0, L.stall.x);
  assert.ok(seen >= L.stall.w * 0.85 && L.stall.y >= -1 && L.stall.y + L.stall.h <= vh + 1, `${label}: the stall is in view (${JSON.stringify(L.stall)})`);
  for (const k of ['dora', 'enzo']) assert.ok(L[k].h >= minChin, `${label}: ${k} is a clear size (${L[k].h.toFixed(0)}px above the counter)`);
  assert.ok(L.customer.h >= minCustomer, `${label}: the customer is a clear size (${L.customer.h.toFixed(0)}px)`);
  for (const k of ['dora', 'enzo']) assert.ok(!overlap(L.face, { ...L[k], h: L[k].h * 0.6 }, 4), `${label}: the customer stands clear of ${k}’s face`);
  for (const q of ['.nm-panel', '.nm-bar', '.nm-tip']) {
    const r = await rect(page, q); if (!r) continue;
    for (const k of ['dora', 'enzo', 'face']) assert.ok(!overlap(r, L[k], 4), `${label}: ${q} does not cover ${k === 'face' ? 'the customer’s face' : k}`);
  }
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
  return L;
}
/** Buys a few wares by clicking the + buttons, cheapest suppliers first, until the purse or the cart runs out. */
async function buySome(page, max = 6) {
  let bought = 0;
  for (let round = 0; round < 3 && bought < max; round++) {
    const buttons = page.locator('.nm-buy:not([disabled])');
    const n = await buttons.count();
    for (let i = 0; i < n && bought < max; i++) { const b = page.locator('.nm-buy:not([disabled])').nth(i % Math.max(1, await page.locator('.nm-buy:not([disabled])').count())); if (await b.count()) { await b.click(); bought++; } }
  }
  return bought;
}

// ---- the menu, the book, and the first dusk with the real mouse
let savedAfterNight;
{
  const page = await open();
  await page.goto(base + '/market'); await ready(page);
  assert.equal(await page.title(), 'Night Market · Dora & Enzo’s Arcade');
  await page.waitForFunction(() => { const i = document.querySelector('.nm-hero img'); return i && i.complete && i.naturalWidth === 1536; });
  await page.locator('h1', { hasText: 'Night Market' }).waitFor();
  assert.ok(await page.locator('a[href="/"]').count() > 0, 'a way back to the arcade');
  assert.ok(await noSideScroll(page), 'menu: no sideways scroll');
  const cards = await page.locator('.nm-cards .nm-card').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().width));
  assert.ok(cards.length === 3 && cards.every((w) => w > 280), `the menu cards are large (${cards.map(Math.round)})`);
  await waitPaintings(page); await shot(page, 'menu-1280');
  await page.locator('button', { hasText: 'Open the book' }).click();
  await page.locator('.nm-persona').first().waitFor();
  assert.equal(await page.locator('.nm-persona').count(), 6, 'six kinds of customer in the book');
  await page.waitForTimeout(400); await shot(page, 'book-1280');
  await page.locator('button', { hasText: 'Back' }).click();
  await page.locator('.nm-go', { hasText: 'Open the stall' }).click();
  await page.waitForFunction(() => window.__market().screen === 'dusk');
  await page.evaluate(() => window.__marketNew(4242, 'moon'));
  await page.locator('.nm-tip-dusk').waitFor();
  const supCards = await page.locator('.nm-sup').count();
  assert.ok(supCards >= 3 && supCards <= 4, 'three or four suppliers are open');
  await page.waitForTimeout(500); await shot(page, 'dusk-1280');
  await page.locator('.nm-tip-dusk button').click();
  const purse0 = (await st(page)).run.purse;
  const bought = await buySome(page, 5);
  let s = await st(page);
  assert.ok(bought >= 3 && s.run.stock === bought, `bought ${bought} wares with the mouse`);
  assert.ok(s.run.purse < purse0, 'the purse paid for them');
  // put back one, and take it again
  const minus = page.locator('.nm-qty .nm-step:not(.nm-buy):not([disabled])').first();
  await minus.click(); assert.equal((await st(page)).run.stock, bought - 1, 'a ware put back');
  // the front of the stall: toggle a ware off and on
  const first = page.locator('.nm-stockitem').first();
  const was = await first.getAttribute('aria-pressed');
  await first.click(); assert.notEqual(await first.getAttribute('aria-pressed'), was, 'a ware moved to or from the front');
  await first.click();
  await page.locator('.nm-lanbtn').first().click();
  assert.equal((await st(page)).run.lanterns, 1, 'a lantern lit');
  await page.locator('.nm-open').click();
  await page.waitForFunction(() => window.__market().screen === 'night');
  // ---- the first customer: arrives, looks, and the haggle opens
  await beat(page, 'look'); await page.waitForTimeout(250); await shot(page, 'night-look-1280');
  await beat(page, 'haggle');
  s = await st(page);
  assert.ok(s.customer && s.customer.tells, 'a customer with tells');
  assert.equal(await page.locator('.nm-tells li').count() >= 5, true, 'the tells are listed');
  assert.ok(await page.locator('.nm-tip').isVisible(), 'the first haggle explains itself');
  await framing(page, '1280×800 haggle', { minChin: 110, minCustomer: 250 });
  await shot(page, 'night-haggle-1280');
  // the dial with the keyboard, then dragged with the mouse
  const p0 = (await st(page)).price;
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown');
  assert.equal((await st(page)).price, p0 + 1, 'arrow keys turn the dial');
  const dialBox = await page.locator('.nm-dialsvg').boundingBox();
  await page.mouse.move(dialBox.x + dialBox.width * 0.5, dialBox.y + dialBox.height * 0.2); await page.mouse.down();
  await page.mouse.move(dialBox.x + dialBox.width * 0.63, dialBox.y + dialBox.height * 0.29, { steps: 4 }); await page.mouse.up();
  const dragged = (await st(page)).price;
  assert.ok(dragged > s.customer.value, `dragging to the right raises the price (${dragged})`);
  // ask far too much with Enter: a counter or a walk-out
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const s = window.__market(); return s.beat !== 'haggle' || (s.customer && s.customer.offer !== null); });
  s = await st(page);
  if (s.customer && s.customer.offer !== null) {
    await page.waitForTimeout(200); await shot(page, 'night-counter-1280');
    const purse = s.run.purse;
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__market().beat === 'react');
    await page.waitForTimeout(350); await shot(page, 'night-sale-1280');
    assert.ok((await st(page)).run.purse > purse, 'taking the counter-offer sells');
  } else { await page.waitForTimeout(300); await shot(page, 'night-walk-1280'); }
  // the rest of the night: ask Dora's hunch with the Ask button; let one customer go with Escape
  await page.evaluate(() => window.__marketSpeed(4));
  let letGo = false;
  for (let guard = 0; guard < 30; guard++) {
    const r = await page.waitForFunction(() => { const s = window.__market(); return s.screen !== 'night' || s.beat === 'haggle' ? s.screen : false; }, null, { timeout: 30000 });
    if ((await r.jsonValue()) !== 'night') break;
    const c = (await st(page)).customer;
    if (!letGo && c.persona !== 'regular') { await page.keyboard.press('Escape'); letGo = true; continue; }
    await page.evaluate((v) => window.__marketSetPrice(v), c.hunch);
    await page.locator('.nm-ask').click();
    await page.waitForFunction(() => { const s = window.__market(); return s.beat !== 'haggle' || (s.customer && s.customer.offer !== null); });
    const t = await st(page); if (t.beat === 'haggle' && t.customer?.offer !== null) await page.locator('.nm-take').click();
  }
  await page.waitForFunction(() => window.__market().screen === 'dawn');
  await page.locator('.nm-dawncard').waitFor();
  s = await st(page);
  assert.equal(s.run.phase, 'dawn');
  await page.waitForTimeout(400); await shot(page, 'dawn-1280');
  const dawnRect = await rect(page, '.nm-dawncard'), pl = await rect(page, '.nm-puppet-l'), pr = await rect(page, '.nm-puppet-r');
  assert.ok(!overlap(dawnRect, pl, 6) && !overlap(dawnRect, pr, 6), 'the dawn card leaves Dora and Enzo clear');
  savedAfterNight = s.run;
  // ---- progress across a reload
  await page.reload(); await ready(page);
  await page.locator('.nm-go', { hasText: 'Continue' }).click();
  await page.waitForFunction(() => window.__market().screen === 'dawn');
  s = await st(page);
  assert.equal(s.run.night, savedAfterNight.night); assert.equal(s.run.purse, savedAfterNight.purse, 'the purse survived the reload');
  await page.locator('.nm-dawncard .nm-go').click();
  await page.waitForFunction(() => window.__market().screen === 'dusk' && window.__market().run.night === 2);
  // ---- a visitor night: the tax heron
  await page.evaluate(() => window.__marketAutoplay(17));
  await page.waitForFunction(() => window.__market().run.night === 19 && window.__market().screen === 'dusk');
  await page.waitForTimeout(400); await shot(page, 'dusk-tax-1280');
  await page.locator('.nm-open').click();
  await beat(page, 'visitor'); await page.waitForTimeout(1200); await shot(page, 'night-heron-1280');
  await page.locator('.nm-visitor .nm-go').click();
  await page.waitForFunction(() => ['arrive', 'look', 'haggle', 'closed'].includes(window.__market().beat));
  // ---- the ending
  await page.evaluate(() => window.__marketAutoplay(20));
  await page.waitForFunction(() => window.__market().screen === 'end');
  s = await st(page);
  assert.equal(s.run.phase, 'end'); assert.equal(s.run.weeks.length, 4);
  await page.waitForFunction(() => { const i = document.querySelector('.nm-end .nm-hero img'); return i && i.complete; });
  await page.waitForTimeout(400); await shot(page, 'end-1280');
  const endCard = await rect(page, '.nm-endcard'); assert.ok(endCard.y + endCard.h <= 801, 'the end card is in view');
  await page.locator('.nm-endcard .nm-go').click();
  await page.waitForFunction(() => window.__market().screen === 'menu');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.equal(saved.best.months, 1, 'the finished month is recorded'); assert.equal(saved.run, null);
  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"run":{"night":"lots"},"best":[]'), KEY);
  await page.reload(); await ready(page);
  assert.equal(await page.locator('.nm-go', { hasText: 'Continue' }).count(), 0, 'a broken month is ignored');
  await page.locator('.nm-go', { hasText: 'Open the stall' }).waitFor();
  await page.close();
}

// ---- 1920×1080: the dusk picker and a haggle fill the screen
{
  const page = await open({ width: 1920, height: 1080 });
  await page.goto(base + '/market'); await ready(page);
  await page.evaluate(() => window.__marketNew(77, 'moon'));
  await page.waitForFunction(() => window.__market().screen === 'dusk');
  const grid = await rect(page, '.nm-dusk-in');
  assert.ok(grid.w >= 1600, `the dusk picker uses the wide screen (${grid.w})`);
  const fs = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.nm-shell')).fontSize));
  assert.ok(fs >= 20, `text scales up on a big screen (${fs}px)`);
  await page.locator('.nm-tip-dusk button').click();
  await buySome(page, 6);
  await page.waitForTimeout(400); await shot(page, 'dusk-1920');
  await page.locator('.nm-open').click();
  await beat(page, 'haggle');
  await framing(page, '1920×1080 haggle', { minChin: 160, minCustomer: 350 });
  await page.waitForTimeout(300); await shot(page, 'night-haggle-1920');
  await page.close();
}

// ---- phones, held upright and sideways, by touch
for (const [vp, label] of [[{ width: 390, height: 844 }, 'phone-upright'], [{ width: 844, height: 390 }, 'phone-sideways']]) {
  const page = await open(vp, true);
  await page.goto(base + '/market'); await ready(page);
  await waitPaintings(page); await shot(page, `${label}-menu`);
  assert.ok(await noSideScroll(page), `${label}: menu has no sideways scroll`);
  await page.locator('.nm-go', { hasText: 'Open the stall' }).tap();
  await page.waitForFunction(() => window.__market().screen === 'dusk');
  await page.locator('.nm-tip-dusk button').tap();
  for (let i = 0; i < 4; i++) { const b = page.locator('.nm-buy:not([disabled])').first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.tap(); } }
  assert.ok((await st(page)).run.stock >= 3, `${label}: bought by touch`);
  assert.ok(await noSideScroll(page), `${label}: dusk has no sideways scroll`);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.locator('.nm-dusk').evaluate((e) => e.scrollTo(0, 0));
  await shot(page, `${label}-dusk`);
  await page.locator('.nm-open').scrollIntoViewIfNeeded(); await page.locator('.nm-open').tap();
  await beat(page, 'haggle');
  await framing(page, `${label} haggle`, { minChin: 55, minCustomer: 120 });
  for (const q of ['.nm-ask', '.nm-dialsvg', '.nm-tells']) { const r = await rect(page, q); assert.ok(r && r.y >= 0 && r.y + r.h <= vp.height + 1 && r.x + r.w <= vp.width + 1, `${label}: ${q} fits on screen`); }
  const askH = await page.locator('.nm-ask').evaluate((e) => e.getBoundingClientRect().height);
  assert.ok(askH < 70, `${label}: the Ask button doesn't wrap (${askH}px)`);
  await shot(page, `${label}-haggle`);
  const p0 = (await st(page)).price;
  await page.locator('.nm-dialbtns .nm-step', { hasText: '+5' }).tap();
  assert.equal((await st(page)).price, Math.min(p0 + 5, (await st(page)).customer.range[1]), `${label}: the dial turns by touch`);
  await page.locator('.nm-ask').tap();
  await page.waitForFunction(() => { const s = window.__market(); return s.beat !== 'haggle' || (s.customer && s.customer.offer !== null); });
  await page.waitForTimeout(300); await shot(page, `${label}-reply`);
  await page.close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('market e2e: all checks passed');
