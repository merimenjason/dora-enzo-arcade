// Moonhop in the browser: the arcade card and the menu (Starlight and the Moon Garden wait); the first stage played
// with the real mouse for all three stars (every firefly, the golden one, within the leap par), then again with the
// keyboard alone for three stars, and the second stage by mouse; the core interactions (the charge ring and the
// dotted path, a puff by mouse and by keyboard, the lantern string reeling them back from the dark, Look, restarting,
// the shut lantern); the save across a reload and the sky map; a corrupt save; the Moon Garden and the ending; the
// framing at 1280×800 and 1920×1080 (Dora and Enzo a clear size, nothing over them); and phones held upright and
// sideways, played by touch to three stars; the sky map fitting a sideways phone without scrolling, and the edge markers
// on an upright phone sitting apart and clear of the hint, the tools and the pair. Needs `npm run dev` on port 3000 and Playwright.
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

/** True when it is time to let go: a full ring for a full leap; otherwise, once the ring is nearly there, waits out
 *  the last moment (the ring fills in 1.1 s) so the letting go lands on the charge rather than a poll later. */
async function charged(page, act) {
  const c = (await state(page)).charge;
  if (act.charge >= 1) return c >= 1;
  const left = (act.charge - c) * 1.1;
  if (c <= 0 || left > 0.1) return false;
  if (left > 0.012) await page.waitForTimeout(Math.round((left - 0.012) * 1000));
  return true;
}
/** One leap with the mouse or a finger: hold on the spot (the pair walk there and the ring fills), let go at the charge. */
async function leapPointer(page, act, cdp = null) {
  const before = (await state(page)).leaps;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  let [x, y] = await aimPoint(page, act.at);
  if (cdp) await touch('touchStart', x, y); else { await page.mouse.move(x, y); await page.mouse.down(); }
  for (let k = 0; k < 600; k++) {
    if (await charged(page, act)) break;
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
  // walk there: hold the arrow while far off (letting go a few px early, since they take a step to stop), then tap
  for (let tries = 0; tries < 30; tries++) {
    let s = await state(page), d = wrap(act.at - s.at);
    if (Math.abs(d) * s.r < 1.2) break;
    const key = (d > 0) === (Math.sin(s.at) <= 0.05) ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key);
    if (Math.abs(d) * s.r > 9) {
      for (let k = 0; k < 400; k++) { s = await state(page); const e = wrap(act.at - s.at); if (Math.abs(e) * s.r < 5 || Math.sign(e) !== Math.sign(d)) break; await page.waitForTimeout(5); }
    } else await page.waitForTimeout(25);
    await page.keyboard.up(key);
    await page.waitForTimeout(140);
  }
  await page.keyboard.down(' ');
  for (let k = 0; k < 600; k++) { if (await charged(page, act)) break; await page.waitForTimeout(8); }
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
  assert.equal(await page.locator('.arcade-card').count(), 62);
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
  await page.waitForFunction(() => window.__orbit().h.puffsUsed > 0, null, { timeout: 2000 }).catch(() => {});
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
    await page.waitForFunction(() => window.__orbit().h.puffsUsed > 1, null, { timeout: 2000 }).catch(() => {});
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
  // straight out into the dark: a full leap off the left of the moon and a puff on the way out; the lantern string
  // reels them back
  await page.locator('canvas.mh-canvas').focus();
  {
    const [x, y] = await aimPoint(page, Math.PI);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.waitForFunction(() => window.__orbit().h.charge >= 1); await page.mouse.up();
    await page.waitForFunction(() => window.__orbit().h.mode === 'fly'); await page.waitForTimeout(350);
    const p = await page.evaluate(() => { const h = window.__orbit().h, v = Math.hypot(h.vx, h.vy) || 1; return window.__orbitPoint(h.x + h.vx / v * 120, h.y + h.vy / v * 120); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(() => window.__orbit().h.lost > 0, null, { timeout: 15000 });
    await settle(page);
  }
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

// ---------------------------------------------------------------- the sky map on sideways phones, and edge markers
{
  const all = { v: 1, stages: {}, garden: { level: 1, best: 0 }, seen: [], ended: true, settings: { sound: false, music: false } };
  for (let sky = 1; sky <= 5; sky++) for (let i = 1; i <= 8; i++) all.stages[`${sky}-${i}`] = { s: [true, i % 2 === 0, false], best: 9, time: 60, medal: false };
  all.seen = Object.keys(all.stages);
  // held sideways, every stage of the sky is on the map without scrolling
  for (const vp of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    const page = await open(vp, true);
    await page.goto(base + '/orbit'); await ready(page);
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, all]);
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: /Sky map/ }).tap(); await page.locator('.mh-map').waitFor();
    for (const name of ['Lantern Clouds', 'The Night Garden']) {
      await page.getByRole('button', { name: new RegExp(name) }).tap(); await page.waitForTimeout(200);
      const m = await page.evaluate(() => { const e = document.querySelector('.mh-map'); const cells = [...document.querySelectorAll('.mh-cell')].map((c) => c.getBoundingClientRect()); return { sh: e.scrollHeight, ch: e.clientHeight, n: cells.length, bottom: Math.max(...cells.map((r) => r.bottom)), top: Math.min(...cells.map((r) => r.top)), thumb: document.querySelector('.mh-thumb').getBoundingClientRect().height }; });
      assert.equal(m.n, 8);
      assert.ok(m.sh <= m.ch + 1 && m.bottom <= vp.height && m.top >= 0, `${vp.width}×${vp.height}: all eight stages of ${name} on the map without scrolling (${m.sh} of ${m.ch})`);
      assert.ok(m.thumb >= 36, `${vp.width}×${vp.height}: the stage pictures are still a readable size (${Math.round(m.thumb)} px)`);
    }
    assert.ok(await noSideScroll(page));
    console.log(`PASS the sky map fits a phone held sideways (${vp.width}×${vp.height}) without scrolling`);
    await page.close();
  }
  // held upright, a wide stage's off-screen fireflies get edge markers that sit apart and clear of the hint, the tools
  // and the pair
  const page = await open({ width: 390, height: 844 }, true);
  await page.goto(base + '/orbit'); await ready(page);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [KEY, all]);
  for (const [sky, idx] of [['Mushroom Moons', 6], ['Frost Moons', 7], ['The Night Garden', 8]]) {
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: /Sky map/ }).tap(); await page.locator('.mh-map').waitFor();
    await page.getByRole('button', { name: new RegExp(sky) }).tap();
    await page.locator('.mh-cell').nth(idx - 1).tap();
    await page.waitForTimeout(3000);
    const c = await box(page, 'canvas.mh-canvas'), p = await pairBox(page), marks = (await page.evaluate(() => window.__orbitScene())).marks;
    assert.ok(marks.length >= 1, `${sky} ${idx}: fireflies out of sight are marked`);
    const R = 12, mb = (m) => ({ x: c.x + m.x - R, y: c.y + m.y - R, w: 2 * R, h: 2 * R });
    for (let i = 0; i < marks.length; i++) {
      for (let j = i + 1; j < marks.length; j++) assert.ok(!overlaps(mb(marks[i]), mb(marks[j])), `${sky} ${idx}: edge markers don't sit on each other`);
      for (const sel of ['.mh-hint', '.mh-tools', '.mh-bar']) { const b = await box(page, sel); if (b) assert.ok(!overlaps(mb(marks[i]), b), `${sky} ${idx}: an edge marker clear of ${sel}`); }
      assert.ok(!overlaps(mb(marks[i]), p), `${sky} ${idx}: an edge marker clear of the pair`);
    }
    console.log(`PASS ${sky} ${idx} upright: ${marks.length} edge marker${marks.length > 1 ? 's' : ''} for ${marks.reduce((n, m) => n + m.n, 0)} off-screen fireflies, apart and clear of the hint, tools and pair`);
  }
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
