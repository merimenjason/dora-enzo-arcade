// Moonhop in the browser: the arcade card and the menu (Starlight and the Moon Garden wait); the first stage played
// with the real mouse for all three stars (every firefly, the golden one, within the leap par), then again with the
// keyboard alone for three stars, and the second stage by mouse; the core interactions (the charge ring and the
// dotted path, a puff by mouse and by keyboard, the lantern string reeling them back from the dark, Look, restarting,
// the shut lantern); the save across a reload and the sky map; a corrupt save; the Moon Garden and the ending; the
// framing at 1280×800 and 1920×1080 (Dora and Enzo a clear size, nothing over them); and phones held upright and
// sideways, played by touch to three stars. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'moonhop-v1';
const SOL = JSON.parse(fs.readFileSync(new URL('../orbit-solutions.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const state = (page) => page.evaluate(() => { const g = window.__orbit(), h = g.h; return { screen: g.screen, mode: g.mode, stage: g.stage, look: g.look, m: h?.mode, moon: h?.moon, at: h?.at, charge: h?.charge, leaps: h?.leaps, got: h?.got, open: h?.open, puffs: h?.puffs, puffsUsed: h?.puffsUsed, lost: h?.lost, vx: h?.vx, vy: h?.vy, x: h?.x, y: h?.y, flyT: h?.flyT, par: h?.s.par, gold: h ? h.goldGot() : false, done: h?.done, r: h ? h.s.moons[h.moon].r : 0 }; });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const closeTip = async (page) => { await page.waitForTimeout(250); const t = page.getByRole('button', { name: 'Got it' }); if (await t.count()) await t.click(); };
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const box = async (page, sel) => { const r = await page.locator(sel).first().boundingBox().catch(() => null); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
const pairBox = async (page) => { const m = await page.evaluate(() => window.__orbitScene()), c = await box(page, 'canvas.mh-canvas'); const [x, y, w, h] = m.pair; return { x: c.x + x, y: c.y + y, w, h }; };
const settle = (page) => page.waitForFunction(() => { const h = window.__orbit().h; return h && (h.mode === 'stand' || h.mode === 'done'); }, null, { timeout: 30000 });
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** A spot on the screen that points at angle `at` on the moon they stand on, kept inside the sky. */
const aimPoint = (page, at) => page.evaluate((a) => {
  const h = window.__orbit().h, m = h.s.moons[h.moon], cv = document.querySelector('canvas.mh-canvas').getBoundingClientRect();
  for (const d of [m.r + 60, m.r + 30, m.r * 0.6]) {
    const [x, y] = window.__orbitPoint(h.mx[h.moon] + Math.cos(a) * d, h.my[h.moon] + Math.sin(a) * d);
    if (x > cv.left + 6 && x < cv.right - 6 && y > cv.top + 6 && y < cv.bottom - 6) return [x, y];
  }
  return window.__orbitPoint(h.mx[h.moon] + Math.cos(a) * m.r * 0.5, h.my[h.moon] + Math.sin(a) * m.r * 0.5);
}, at);

/** One leap with the mouse or a finger: hold on the spot (the pair walk there and the ring fills), let go at the charge. */
async function leapPointer(page, act, cdp = null) {
  const before = (await state(page)).leaps;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  let [x, y] = await aimPoint(page, act.at);
  if (cdp) await touch('touchStart', x, y); else { await page.mouse.move(x, y); await page.mouse.down(); }
  for (let k = 0; k < 600; k++) {
    const s = await state(page);
    if (s.charge >= act.charge - 0.02 || (act.charge >= 1 && s.charge >= 1)) break;
    [x, y] = await aimPoint(page, act.at);
    if (cdp) await touch('touchMove', x, y); else await page.mouse.move(x, y);
    await page.waitForTimeout(8);
  }
  if (cdp) await touch('touchEnd'); else await page.mouse.up();
  await page.waitForFunction((n) => window.__orbit().h.leaps > n, before);
  await settle(page);
  return state(page);
}
/** One leap with the keyboard alone: walk there with the arrows, hold Space, let go at the charge. */
async function leapKeys(page, act) {
  const before = (await state(page)).leaps;
  for (let tries = 0; tries < 6; tries++) {
    let s = await state(page), d = wrap(act.at - s.at);
    if (Math.abs(d) * s.r < 3) break;
    const key = (d > 0) === (Math.sin(s.at) <= 0.05) ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    for (let k = 0; k < 400; k++) { s = await state(page); const e = wrap(act.at - s.at); if (Math.abs(e) * s.r < 4 || Math.sign(e) !== Math.sign(d)) break; await page.waitForTimeout(5); }
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
  }
  await page.keyboard.down(' ');
  for (let k = 0; k < 600; k++) { const s = await state(page); if (s.charge >= act.charge - 0.02 || (act.charge >= 1 && s.charge >= 1)) break; await page.waitForTimeout(8); }
  await page.keyboard.up(' ');
  await page.waitForFunction((n) => window.__orbit().h.leaps > n, before);
  await settle(page);
  return state(page);
}
async function playRoute(page, route, how, cdp) {
  for (const act of route) {
    if ((await state(page)).done) break;
    if (how === 'keys') await leapKeys(page, act); else await leapPointer(page, act, cdp);
  }
  return state(page);
}
async function threeStars(page, label) {
  const s = await state(page);
  assert.ok(s.done, `${label}: home`); assert.ok(s.gold, `${label}: the golden firefly`); assert.ok(s.leaps <= s.par, `${label}: within the par (${s.leaps}/${s.par})`);
  await page.locator('.mh-done').waitFor();
  assert.equal(await page.locator('.mh-done .mh-stars.is-big i.is-on').count(), 3, `${label}: three stars on the card`);
}

// ---------------------------------------------------------------- the arcade card and the menu
{
  const page = await open();
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 60);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.getByRole('link', { name: /Moonhop/ }).click();
  await page.waitForURL(/\/orbit$/); await ready(page);
  assert.ok(await page.getByRole('heading', { name: /Moonhop/ }).isVisible());
  assert.ok(await page.getByRole('button', { name: /Starlight/ }).isDisabled(), 'Starlight waits for the Frost Moons');
  assert.ok(await page.getByRole('button', { name: /Moon Garden/ }).isDisabled(), 'and the Moon Garden for the first sky');
  assert.ok(await noSideScroll(page));
  console.log('PASS the arcade card and the menu');

  // ---------------------------------------------------------------- the first stage, with the real mouse, three stars
  await page.getByRole('button', { name: /BEGIN/ }).click();
  assert.equal(await page.getByRole('dialog', { name: /Walk, crouch, leap/ }).count(), 1, 'the first lesson card');
  await closeTip(page);
  assert.equal((await state(page)).stage, '1-1');
  await page.waitForTimeout(1800); // the camera eases in from the whole field
  await playRoute(page, SOL['e2e-1-1'], 'mouse');
  await threeStars(page, 'the first stage by mouse');
  assert.match(await page.locator('.mh-done').textContent(), /The golden firefly/);
  let save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.deepEqual(save.stages['1-1'].s, [true, true, true], 'three stars saved');
  console.log('PASS the first stage with the mouse: home, the golden firefly and within the par');

  // ---------------------------------------------------------------- again, with the keyboard alone
  await page.getByRole('button', { name: '↺ Again' }).click();
  await page.waitForTimeout(1800);
  await page.locator('canvas.mh-canvas').focus();
  await playRoute(page, SOL['e2e-1-1'], 'keys');
  await threeStars(page, 'the first stage by keyboard');
  console.log('PASS the first stage again with the keyboard alone, three stars');

  // ---------------------------------------------------------------- the second stage by mouse, then Enter goes on
  await page.keyboard.press('Enter');
  await closeTip(page);
  assert.equal((await state(page)).stage, '1-2', 'Enter goes on to the next stage');
  await page.waitForTimeout(1800);
  const s2 = await playRoute(page, SOL['e2e-1-2'], 'mouse');
  assert.ok(s2.done && s2.gold, 'the second stage home with the golden firefly');
  await page.locator('.mh-done').waitFor();
  console.log('PASS the second stage by mouse');

  // ---------------------------------------------------------------- the core interactions on the third
  await page.getByRole('button', { name: 'Next →' }).click();
  await closeTip(page); await page.waitForTimeout(1800);
  assert.equal((await state(page)).stage, '1-3');
  await page.locator('canvas.mh-canvas').focus();
  await page.keyboard.down(' '); await page.waitForTimeout(450);
  let s = await state(page);
  assert.ok(s.charge > 0.2 && s.m === 'stand', 'holding Space crouches and fills the ring');
  await page.keyboard.up(' ');
  await page.waitForFunction(() => window.__orbit().h.mode === 'fly');
  // a puff with Space and an arrow
  await page.keyboard.down('ArrowRight'); await page.keyboard.press(' '); await page.keyboard.up('ArrowRight');
  s = await state(page); assert.equal(s.puffsUsed, 1, 'Space in the air puffs'); assert.equal(s.puffs, 0);
  await settle(page);
  assert.equal((await state(page)).puffs, 1, 'landing refills the puff');
  // a puff with a click
  {
    const before = (await state(page)).leaps;
    const [x, y] = await aimPoint(page, (await state(page)).at);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForFunction(() => window.__orbit().h.charge > 0.3); await page.mouse.up();
    await page.waitForFunction((n) => window.__orbit().h.leaps > n && window.__orbit().h.mode === 'fly', before);
    const p = await page.evaluate(() => { const h = window.__orbit().h; return window.__orbitPoint(h.x + 120, h.y); });
    await page.mouse.click(p[0], p[1]);
    assert.equal((await state(page)).puffsUsed, 2, 'a click in the air puffs');
    await settle(page);
  }
  // the dotted path shows while charging (not drawn in Starlight)
  await page.keyboard.down(' '); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => window.__orbit().h.preview(1).length > 5), 'the dotted path');
  await page.keyboard.up(' '); await settle(page);
  // R starts again, L looks round the whole sky
  await page.keyboard.press('r'); await closeTip(page);
  s = await state(page); assert.equal(s.leaps, 0, 'R starts the stage again');
  await page.keyboard.press('l'); assert.ok((await state(page)).look, 'L looks round');
  await page.getByRole('button', { name: /Look/ }).click(); assert.ok(!(await state(page)).look, 'and the Look button puts it back');
  // straight out into the dark at full power: the lantern string reels them back
  await page.locator('canvas.mh-canvas').focus();
  const out = await page.evaluate(() => { const h = window.__orbit().h, st = h.s, [l, t, r, b] = h.bounds(); void l; void t; void r; void b; return Math.atan2(h.my[h.moon] - (st.moons.reduce((a, m) => a + m.y, 0) / st.moons.length), h.mx[h.moon] - (st.moons.reduce((a, m) => a + m.x, 0) / st.moons.length)); });
  await leapPointer(page, { at: out, charge: 1 });
  s = await state(page);
  assert.equal(s.lost, 1, 'drifted off into the dark'); assert.equal(s.leaps, 1, 'the leap still counts'); assert.equal(s.m, 'stand');
  console.log('PASS the charge ring and the dotted path, puffs by key and click, R, Look, and the rewind from the dark');

  // ---------------------------------------------------------------- the save across a reload, and the sky map
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /CONTINUE/ }).textContent(), /Lantern Clouds · Round the Moon/);
  await page.getByRole('button', { name: /Sky map/ }).click();
  await page.locator('.mh-map').waitFor();
  const cells = page.locator('.mh-cell');
  assert.equal(await cells.count(), 8);
  assert.match(await cells.nth(0).textContent(), /★★★/);
  assert.ok(await cells.nth(2).isEnabled() && await cells.nth(3).isDisabled(), 'the next stage is open, the one after locked');
  assert.ok(await page.getByRole('button', { name: /Mushroom Moons/ }).isDisabled(), 'the next sky is locked');
  assert.ok(await noSideScroll(page));
  console.log('PASS the save across a reload and the sky map');

  // ---------------------------------------------------------------- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"stages":{"1-1":{"s":"lots"}},"garden":7'), KEY);
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /BEGIN/ }).textContent(), /First Hop/);
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"stages":{"9-9":{"s":[true,true,true]},"1-1":{"s":[true,false,false],"best":"x"}},"seen":7}'), KEY);
  await page.reload(); await ready(page);
  assert.match(await page.getByRole('button', { name: /CONTINUE/ }).textContent(), /Hold for Higher/, 'the good part of a damaged save is kept');
  console.log('PASS corrupt saves are shrugged off');

  // ---------------------------------------------------------------- the Moon Garden and the ending
  await page.evaluate((k) => { const st = {}; for (let i = 1; i <= 8; i++) st['1-' + i] = { s: [true, false, false], best: 5, time: 0, medal: false }; localStorage.setItem(k, JSON.stringify({ v: 1, stages: st, garden: { level: 3, best: 2 }, seen: [], ended: false, settings: { sound: false, music: false } })); }, KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Moon Garden/ }).click();
  s = await state(page);
  assert.equal(s.mode, 'garden'); assert.match(await page.locator('.mh-bar').textContent(), /MOON GARDEN · FIELD 3/);
  await page.keyboard.press('Escape'); await page.locator('.mh-menu').waitFor();
  await page.evaluate((k) => { const st = {}; for (let n = 1; n <= 5; n++) for (let i = 1; i <= 8; i++) st[`${n}-${i}`] = { s: [true, true, false], best: 5, time: 30, medal: false }; localStorage.setItem(k, JSON.stringify({ v: 1, stages: st, garden: { level: 1, best: 0 }, seen: [], ended: true, settings: { sound: false, music: false } })); }, KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /Starlight/ }).isEnabled(), 'Starlight opens after the Frost Moons');
  await page.getByRole('button', { name: /The ending/ }).click();
  await page.locator('.mh-ending').waitFor();
  assert.match(await page.locator('.mh-ending').textContent(), /The lantern brings them home/);
  await page.getByRole('button', { name: /Goodnight/ }).click();
  await page.getByRole('button', { name: /Starlight/ }).click();
  await page.locator('.mh-cell').first().click();
  s = await state(page); assert.equal(s.mode, 'starlight');
  assert.equal(await page.getByTestId('time').count(), 1, 'Starlight shows the clock');
  await page.keyboard.down(' '); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__orbit().mode), 'starlight');
  await page.keyboard.up(' ');
  console.log('PASS the Moon Garden, the ending and Starlight');
  await page.close();
}

// ---------------------------------------------------------------- the framing on desktop screens
for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const page = await open(vp);
  await page.goto(base + '/orbit'); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, stages: {}, garden: { level: 1, best: 0 }, seen: ['1-1'], ended: false, settings: { sound: false, music: false } })), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /BEGIN/ }).click();
  await page.waitForTimeout(2600);
  const p = await pairBox(page);
  assert.ok(p.h >= 70, `${vp.width}: Dora and Enzo are a clear size (${Math.round(p.h)} px)`);
  for (const sel of ['.mh-bar', '.mh-tools', '.mh-hint']) { const b = await box(page, sel); if (b) assert.ok(!overlaps(p, b), `${vp.width}: ${sel} is clear of the pair`); }
  assert.ok(await noSideScroll(page));
  await playRoute(page, SOL['e2e-1-1'], 'mouse');
  await page.locator('.mh-done').waitFor();
  const d = await box(page, '.mh-done'), q = await pairBox(page);
  assert.ok(!overlaps(q, d), `${vp.width}: the done card sits clear of the cheering pair`);
  console.log(`PASS the framing at ${vp.width}×${vp.height}: the pair ${Math.round(p.h)} px, nothing over them`);
  await page.close();
}

// ---------------------------------------------------------------- phones, upright and sideways, by touch
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp, true);
  await page.goto(base + '/orbit'); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, stages: {}, garden: { level: 1, best: 0 }, seen: ['1-1'], ended: false, settings: { sound: false, music: false } })), KEY);
  await page.reload(); await ready(page);
  assert.ok(await noSideScroll(page), `${vp.width}×${vp.height}: no sideways scroll on the menu`);
  await page.getByRole('button', { name: /BEGIN/ }).tap();
  await page.waitForTimeout(2600);
  const cdp = await page.context().newCDPSession(page);
  const p = await pairBox(page), c = await box(page, 'canvas.mh-canvas');
  assert.ok(p.h >= 48, `${vp.width}×${vp.height}: the pair is a comfortable size (${Math.round(p.h)} px)`);
  assert.ok(p.x >= c.x && p.y >= c.y && p.x + p.w <= c.x + c.w && p.y + p.h <= c.y + c.h, 'and inside the sky');
  for (const sel of ['.mh-tools', '.mh-hint', '.mh-bar']) { const b = await box(page, sel); if (b) assert.ok(!overlaps(p, b), `${vp.width}×${vp.height}: ${sel} clear of the pair`); }
  await playRoute(page, SOL['e2e-1-1'], 'touch', cdp);
  await threeStars(page, `${vp.width}×${vp.height} by touch`);
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone ${vp.width > vp.height ? 'sideways' : 'upright'} (${vp.width}×${vp.height}): played by touch to three stars, the pair ${Math.round(p.h)} px`);
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
