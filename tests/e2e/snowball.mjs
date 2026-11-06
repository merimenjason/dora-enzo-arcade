// Snowball Siege in the browser: the title and the way home, the how-to on a first run, the slopes (only the first
// open), a real match (the clock running, a click on our wall scooping a snowball, a drag back throwing one, a right-
// click patching a gap, Tab switching chinchilla, pause), a win and its stars, the save across a reload (the next slope
// open), a corrupt save, the settings, Versus with the second player's keys, and phones held sideways (tap to scoop,
// drag to throw) and upright (the turn-sideways hint, still playable), all with no page errors and no sideways
// scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'snowball-siege-v1';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
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
const st = (page) => page.evaluate(() => { const s = window.__snowball(); return { screen: s.screen, save: s.save, match: s.match, paused: s.paused }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__snowball(); return JSON.stringify({ screen: s.screen, match: s.match && { ...s.match, chars: undefined, stats: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__snowball().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/snowball`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.sb-home').getAttribute('href'), '/');
  assert.match(await page.locator('.sb-title-art').getAttribute('src'), /title\.webp/);
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- a first run opens with the how-to, then the slopes
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await until(page, () => window.__snowball().screen === 'howto');
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await until(page, () => window.__snowball().screen === 'slopes');
  assert.equal(await page.locator('.sb-card').count(), 6);
  assert.equal(await page.locator('.sb-card:not([disabled])').count(), 1, 'only Sunny Slope is open');
  await page.locator('.sb-card img').first().waitFor();
  ok('first run: the how-to, then six slopes with only the first open');

  // ---- a real match
  await page.locator('.sb-card').first().click();
  await until(page, () => window.__snowball().screen === 'play' && window.__snowball().match?.slope === 'sunny');
  const clock0 = await page.locator('.sb-clock b').textContent();
  await page.waitForTimeout(1600);
  assert.notEqual(await page.locator('.sb-clock b').textContent(), clock0, 'the clock runs');
  let s = await st(page);
  const ammo0 = s.match.ammo[0], cubes0 = s.match.ours;
  const pt = await dbg(page, 'point', false); assert.ok(pt, 'a cube of our wall is on screen in reach');
  await page.mouse.click(pt.x, pt.y);
  await until(page, ([a, c]) => { const m = window.__snowball().match; return m.ammo[0] > a || m.ours < c; }, [ammo0, cubes0]);
  s = await st(page); assert.equal(s.match.ours, cubes0 - 1);
  ok('a click on our wall scoops a snowball out of it');

  // drag back like a slingshot: down and to the left throws up and to the right
  await until(page, () => window.__snowball().match.ammo[0] >= 1 && window.__snowball().match.chars[window.__snowball().match.active[0]].busy === 0);
  const thrown0 = (await st(page)).match.stats.thrown[0];
  await page.mouse.move(700, 400); await page.mouse.down(); await page.mouse.move(640, 440, { steps: 4 }); await page.mouse.move(560, 470, { steps: 4 });
  await until(page, () => document.querySelector('.sb-canvas') && window.__snowball().match.chars.some((c) => c.side === 0 && c.aiming));
  await page.mouse.up();
  await until(page, (t) => window.__snowball().match.stats.thrown[0] > t, thrown0);
  ok('a drag back throws a snowball across the valley');

  // right-click a gap to pat one back in
  await until(page, () => window.__snowball().match.ammo[0] >= 1 && window.__snowball().match.chars.every((c) => c.side !== 0 || c.busy === 0));
  const gap = await dbg(page, 'point', true);
  if (gap) {
    await page.mouse.click(gap.x, gap.y, { button: 'right' });
    await until(page, () => window.__snowball().match.stats.patched[0] >= 1);
    ok('a right-click pats a snowball back into a gap');
  } else console.log('note: no patchable gap on screen this time');

  // Tab switches chinchilla; Escape pauses
  const act0 = (await st(page)).match.active[0];
  await page.keyboard.press('Tab');
  await until(page, (a) => window.__snowball().match.active[0] !== a, act0);
  await page.keyboard.press('Escape'); await until(page, () => window.__snowball().paused === true);
  const t0 = (await st(page)).match.t; await page.waitForTimeout(400); assert.equal((await st(page)).match.t, t0, 'paused means paused');
  await page.getByRole('button', { name: 'Play on' }).click(); await until(page, () => window.__snowball().paused === false);
  ok('Tab switches to the other chinchilla; Escape pauses and Play on carries on');

  // ---- a win: the result, stars, the save, the next slope open
  await dbg(page, 'win');
  await until(page, () => window.__snowball().screen === 'result', null, 10000);
  await page.locator('.sb-stars li.on').first().waitFor();
  s = await st(page); assert.equal(s.save.won.sunny, true); assert.ok(s.save.stars.sunny & 1);
  await page.getByRole('button', { name: /Next: Frozen Pond/ }).waitFor();
  await page.reload(); await ready(page);
  s = await st(page); assert.equal(s.save.won.sunny, true);
  await page.getByRole('button', { name: 'Play', exact: true }).click(); await until(page, () => window.__snowball().screen === 'slopes');
  assert.equal(await page.locator('.sb-card:not([disabled])').count(), 2);
  ok('a win: the result and its stars, saved across a reload, and Frozen Pond opens');

  // ---- a loss
  await page.locator('.sb-card').nth(1).click(); await until(page, () => window.__snowball().match?.slope === 'pond');
  await dbg(page, 'lose'); await until(page, () => window.__snowball().screen === 'result', null, 10000);
  assert.match(await page.locator('.sb-result h2').textContent(), /flag fell/);
  assert.equal((await st(page)).save.won.pond, undefined);
  ok('a loss: the result says so and nothing is saved');

  // ---- settings
  await page.getByRole('button', { name: 'Slopes' }).click(); await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Settings' }).click(); await until(page, () => window.__snowball().screen === 'settings');
  await page.getByLabel('Music').uncheck(); await page.getByLabel('Camera shake and sway').uncheck();
  s = await st(page); assert.equal(s.save.settings.music, false); assert.equal(s.save.settings.motion, false);
  assert.equal(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).settings.music, false);
  await page.getByRole('button', { name: 'Back' }).click(); await until(page, () => window.__snowball().screen === 'title');
  ok('settings: music and camera motion switch off and are saved');

  // ---- Versus with the second player's keys
  await page.getByRole('button', { name: /Versus/ }).click();
  await until(page, () => window.__snowball().match?.slope === 'versus');
  s = await st(page); assert.equal(s.match.chars.length, 2);
  await page.keyboard.down('.'); await page.waitForTimeout(450); await page.keyboard.up('.');
  await until(page, () => window.__snowball().match.stats.thrown[1] >= 1);
  await page.keyboard.down('f'); await page.waitForTimeout(450); await page.keyboard.up('f');
  await until(page, () => window.__snowball().match.stats.thrown[0] >= 1);
  ok('Versus: player 1 throws with F and player 2 with the full stop');

  // ---- a corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{nope'), KEY); await page.reload(); await ready(page);
  assert.deepEqual((await st(page)).save.won, {});
  ok('a corrupt save starts fresh');
  await page.context().close();

  // ---- a phone held sideways: tap to scoop, drag to throw
  const phone = await open({ width: 844, height: 390 }, true);
  await phone.goto(`${base}/snowball`); await ready(phone);
  assert.ok(await noSideScroll(phone));
  await dbg(phone, 'start', 'sunny', 3);
  await until(phone, () => window.__snowball().screen === 'play');
  await phone.waitForTimeout(500);
  const box = await phone.locator('.sb-canvas').boundingBox(); assert.ok(box.height > 200, 'the valley gets most of the screen');
  const tp = await dbg(phone, 'point', false); assert.ok(tp);
  const a0 = (await st(phone)).match.ours;
  await phone.touchscreen.tap(tp.x, tp.y);
  await until(phone, (c) => window.__snowball().match.ours < c, a0);
  ok('phone sideways: the valley fills the screen and a tap scoops');
  await phone.context().close();

  const upright = await open({ width: 390, height: 844 }, true);
  await upright.goto(`${base}/snowball`); await ready(upright);
  assert.ok(await noSideScroll(upright));
  await upright.locator('.sb-title-menu h1').waitFor();
  await dbg(upright, 'start', 'sunny', 3); await until(upright, () => window.__snowball().screen === 'play');
  assert.match(await upright.locator('.sb-tip').textContent(), /sideways/);
  const ub = await upright.locator('.sb-canvas').boundingBox(); assert.ok(ub.height > 300);
  const up = await dbg(upright, 'point', false); assert.ok(up, 'still playable: our wall is in reach on screen');
  assert.ok(await noSideScroll(upright));
  ok('phone upright: the turn-sideways hint, a closer camera, and still playable');
  await upright.context().close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`\n${pass} Snowball Siege browser checks passed`);
} finally {
  await browser.close();
}
