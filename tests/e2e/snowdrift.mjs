// Snowdrift in the browser: the menu, day 1 played to the lodge with real key presses (hold Space down the slopes,
// let go on the climbs), the medals panel, the lodge shop buying an upgrade, the save across a reload, the day list,
// a corrupt save, pausing (by key and when the tab hides, with no jump in time afterwards), the framing of the sled at
// 1280×800 and 1920×1080, and phones held either way with touch anywhere as the button.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'snowdrift-v1';
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
const phase = (page, p, timeout = 30000) => page.locator(`main[data-phase="${p}"]`).waitFor({ timeout });
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** What the sled is doing, and whether a player would hold the button now (down a slope or under a cave roof). */
const look = (page) => page.evaluate(() => {
  const g = window.__snowdrift(); if (!g) return null;
  const q = g.course.ground(g.x + g.speed * 0.12), roof = g.course.ceiling(g.x + g.speed * 0.4) !== null;
  return { phase: g.phase, want: !g.air && !g.tumbling && (roof || (q ? q.m < -0.04 : false)), x: g.x, t: g.t };
});
/** Rides with real key presses until the day ends, the way the human-like bot does. */
async function ride(page, press, release, until = () => false) {
  let down = false;
  for (let i = 0; i < 20000; i++) {
    const s = await look(page);
    if (!s || s.phase === 'finish' || s.phase === 'caught' || until(s)) break;
    if (s.want !== down) { down = s.want; if (down) await press(); else await release(); }
    await page.waitForTimeout(8);
  }
  if (down) await release();
  return look(page);
}

{
  const page = await open();
  await page.goto(base + '/snowdrift'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Snow\s*drift/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.match(await page.locator('.sd-go').innerText(), /START/);
  assert.match(await page.locator('.sd-alt').first().innerText(), /0 of 21/, 'no medals yet');
  assert.ok(await page.getByRole('button', { name: /Moonlit Hills/ }).isDisabled(), 'the Moonlit Hills wait for day 3');
  console.log('PASS the menu loads and hydrates');

  // day 1, the real way: Space pushes off, then hold down the slopes and let go on the climbs
  await page.locator('.sd-go').click();
  await page.locator('main[data-screen="play"]').waitFor(); await phase(page, 'ready');
  assert.match(await page.locator('.sd-intro').innerText(), /Pine Meadow/);
  await page.waitForTimeout(400);
  assert.equal(await game(page, () => window.__snowdrift().t), 0, 'nothing moves before the push-off');
  await page.locator('.sd-canvas').focus();
  await page.keyboard.down(' '); await phase(page, 'ride'); await page.keyboard.up(' ');
  assert.equal(await page.locator('.sd-intro').count(), 0, 'the intro card goes once they push off');
  const end = await ride(page, () => page.keyboard.down(' '), () => page.keyboard.up(' '));
  assert.equal(end.phase, 'finish', `Dora and Enzo reach the Pine Meadow lodge (${Math.round(end.x)})`);
  await page.getByRole('dialog', { name: 'The lodge' }).waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.sd-bigmedals span.is-on').first().innerText().then((t) => /lodge/i.test(t)), true);
  const s1 = await save(page);
  assert.equal(s1.days.meadow.done, true, 'the day is saved');
  assert.ok(s1.days.meadow.best > 0 && s1.flakes > 0, `with a best time and banked snowflakes (${s1.flakes})`);
  assert.equal(s1.last, 1, 'day 2 is next');
  console.log(`PASS day 1 played to the lodge with real key presses (${s1.flakes} snowflakes)`);

  // the lodge shop
  await page.getByRole('button', { name: /To the lodge/ }).click();
  await page.locator('main[data-screen="shop"]').waitFor();
  if (s1.flakes < 20) { await page.evaluate(([k]) => { const s = JSON.parse(localStorage.getItem(k)); s.flakes = 25; localStorage.setItem(k, JSON.stringify(s)); }, [KEY]); await page.reload(); await ready(page); await page.getByRole('button', { name: /Lodge shop/ }).click(); await page.locator('main[data-screen="shop"]').waitFor(); }
  const before = (await save(page)).flakes;
  await page.getByRole('button', { name: /Buy Sled wax for 20/ }).click();
  const s2 = await save(page);
  assert.equal(s2.levels.wax, 1, 'sled wax bought');
  assert.equal(s2.flakes, before - 20, 'for 20 snowflakes');
  assert.match(await page.locator('.sd-flakes').innerText(), new RegExp(`${before - 20} snowflakes`));
  assert.ok(await page.getByRole('button', { name: /Buy Sled wax for 60/ }).isVisible(), 'the next level costs more');
  console.log('PASS the lodge shop sells an upgrade for snowflakes');

  // pausing: by key, and when the tab hides, with no jump in time afterwards
  await page.getByRole('button', { name: /Next day/ }).click();
  await phase(page, 'ready');
  assert.equal(await game(page, () => window.__snowdrift().valley.id), 'lake');
  assert.equal(await game(page, () => window.__snowdrift().levels.wax), 1, 'the upgrade comes along');
  await page.locator('.sd-canvas').focus();
  await page.keyboard.down(' '); await phase(page, 'ride'); await page.waitForTimeout(600); await page.keyboard.up(' ');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = await game(page, () => window.__snowdrift().t); await page.waitForTimeout(500);
  assert.equal(await game(page, () => window.__snowdrift().t), t0, 'paused time stands still');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor({ state: 'detached' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t1 = await game(page, () => window.__snowdrift().t); await page.waitForTimeout(700);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await game(page, () => window.__snowdrift().t), t1, 'still paused until asked');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.waitForTimeout(150);
  const t2 = await game(page, () => window.__snowdrift().t);
  assert.ok(t2 >= t1 && t2 - t1 < 20, `no jump in time after a hidden tab (${t1} → ${t2})`);
  // a lost window focus pauses too
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  await page.getByRole('button', { name: 'Keep going' }).click();
  console.log('PASS pausing by key, on a hidden tab and on lost focus, with no jump in time');

  // the dusk catches a sled that stops pressing
  await page.evaluate(() => { const g = window.__snowdrift(); g.duskX = g.x - 3; });
  await phase(page, 'caught');
  await page.getByRole('dialog', { name: 'Night fell' }).waitFor({ timeout: 10000 });
  assert.match(await page.locator('.sd-dist-line').innerText(), /of \d+ m to the lodge/);
  await page.keyboard.press('Enter');
  await phase(page, 'ready');
  console.log('PASS the dusk catching them shows how far they got, and Enter tries again');

  // the save across a reload, and the day list
  await page.reload(); await ready(page);
  assert.match(await page.locator('.sd-go').innerText(), /CONTINUE/);
  assert.match(await page.locator('.sd-go small').innerText(), /Day 2/, 'continues at day 2');
  await page.getByRole('button', { name: /Days/ }).click();
  await page.locator('main[data-screen="days"]').waitFor();
  assert.equal(await page.locator('.sd-daycard.is-done').count(), 1, 'day 1 shows as done');
  assert.equal(await page.locator('.sd-daycard:not([disabled])').count(), 2, 'days 1 and 2 are open');
  assert.ok(await page.locator('.sd-daycard').nth(2).isDisabled(), 'day 3 is still locked');
  await page.locator('.sd-daycard').nth(0).click();
  await page.waitForFunction(() => window.__snowdrift()?.valley.id === 'meadow');
  console.log('PASS the save across a reload, and replaying a day from the list');

  // a corrupt save is ignored, not misread
  for (const bad of ['{nope', '[]', '{"v":1,"days":{"meadow":{"done":"yes"}},"flakes":"lots","last":99}', '{"v":9,"days":{"meadow":{"done":true}}}']) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bad]);
    await page.reload(); await ready(page);
    assert.match(await page.locator('.sd-go').innerText(), /START/, `fresh start from ${bad}`);
    assert.match(await page.locator('.sd-alt').first().innerText(), /0 of 21/);
  }
  console.log('PASS a corrupt save starts fresh');

  // the endless hills open after day 3, seeded per run or by the day
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, days: { meadow: { done: true }, lake: { done: true }, caves: { done: true } }, flakes: 5, last: 3 })), KEY);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Daily Hill/ }).click();
  await phase(page, 'ready');
  assert.match(await page.locator('.sd-intro').innerText(), /Daily Hill/);
  const seedA = await game(page, () => window.__snowdrift().mode.seed);
  await page.evaluate(() => window.__snowdriftStart('daily')); await phase(page, 'ready');
  assert.equal(await game(page, () => window.__snowdrift().mode.seed), seedA, 'the Daily Hill is the same hill all day');
  console.log('PASS the Moonlit Hills and the Daily Hill open after day 3');

  // the sled pair reads clearly on desktop screens
  for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.evaluate(() => window.__snowdriftStart(0)); await phase(page, 'ready');
    await page.locator('.sd-canvas').focus();
    await page.keyboard.down(' '); await phase(page, 'ride'); await page.keyboard.up(' ');
    await ride(page, () => page.keyboard.down(' '), () => page.keyboard.up(' '), (s) => s.t > 60 * 5);
    await page.waitForFunction(() => { const g = window.__snowdrift(); return !g.air && g.speed > 12 && g.speed < 30; }, null, { timeout: 20000, polling: 50 });
    const r = await game(page, () => window.__snowdriftSled());
    assert.ok(r.h >= vp.height * 0.07, `Dora and Enzo are at least 7% of the screen tall at ${vp.width}×${vp.height} (${Math.round(r.h)} px)`);
    const bar = await page.locator('.sd-bar').boundingBox(), stageTop = bar.y + bar.height;
    assert.ok(r.y + stageTop > stageTop + 10 && r.x > 0 && r.x + r.w < vp.width, 'the sled is on screen, clear of the bar');
    assert.ok(await noSideScroll(page));
  }
  console.log('PASS the desktop framing at 1280×800 and 1920×1080');
  await page.context().close();
}

for (const [label, viewport] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
  const page = await open(viewport, true);
  await page.goto(base + '/snowdrift'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the ${label} menu`);
  await page.locator('.sd-go').tap();
  await phase(page, 'ready');
  await page.locator(`main[data-touch="${label === 'upright' ? 'tall' : 'wide'}"]`).waitFor();
  assert.match(await page.locator('.sd-go-hint').innerText(), /Touch and hold anywhere/);
  // touch anywhere on the snow is the button: push off, hold to tuck, lift to let go
  const cdp = await page.context().newCDPSession(page);
  const at = { x: viewport.width * 0.7, y: viewport.height * 0.75 };
  const touch = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: at.x, y: at.y, id: 1 }] });
  await touch('touchStart'); await phase(page, 'ride');
  await page.waitForTimeout(300);
  assert.equal(await game(page, () => window.__snowdrift().held), true, 'a held finger tucks');
  await touch('touchEnd'); await page.waitForTimeout(150);
  assert.equal(await game(page, () => window.__snowdrift().held), false, 'lifting it lets go');
  const s = await ride(page, () => touch('touchStart'), () => touch('touchEnd'), (q) => q.t > 60 * 8);
  assert.equal(s.phase, 'ride', 'still riding after eight seconds of touch play');
  assert.ok(s.x > 120, `and well on the way (${Math.round(s.x)})`);
  const r = await game(page, () => window.__snowdriftSled());
  const bar = await page.locator('.sd-bar').boundingBox();
  assert.ok(r.x >= 0 && r.x + r.w <= viewport.width && r.y >= 0 && r.y + r.h + bar.height <= viewport.height, `the sled is on screen (${label})`);
  assert.ok(r.h >= 22, `and big enough to read (${Math.round(r.h)} px)`);
  assert.ok(bar.height <= 50, 'the bar stays slim');
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone held ${label}: touch anywhere pushes off, tucks and lets go`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS Snowdrift in the browser');
