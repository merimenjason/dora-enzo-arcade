// Echo Burrow in the browser: the menu, room 1 played with real keys through both loops (Dora records, time rewinds,
// Enzo clears beside her echo), the rewind itself, retrying and recording again, the room list, the save across a
// reload, a corrupt save, pausing (by key and when the tab hides, with no jump in time afterwards), and phones held
// either way with the touch buttons. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'echo-burrow-v1';
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
const phase = (page, p) => page.locator(`main[data-phase="${p}"]`).waitFor({ timeout: 30000 });
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Holds → until Dora's middle is over the plate in room 1 (column 5), then lets go. */
const walkOntoPlate = async (page, press = (k) => page.keyboard.down(k), release = (k) => page.keyboard.up(k)) => {
  await press('ArrowRight');
  await page.waitForFunction(() => { const g = window.__echo(); return g.p.x >= 85; }, null, { polling: 'raf' });
  await release('ArrowRight');
  await page.waitForFunction(() => window.__echo().groups[1] && Math.abs(window.__echo().p.vx) < 1, null, { timeout: 5000 });
};

{
  const page = await open();
  await page.goto(base + '/echo'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Echo\s*Burrow/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.match(await page.locator('.eb-go').innerText(), /START/);
  assert.match(await page.locator('.eb-alt').first().innerText(), /0 of 90/, 'no stars yet');
  console.log('PASS the menu loads and hydrates');

  // room 1 with real keys: Dora records on the plate, R rewinds, Enzo walks through the open door to the exit
  await page.locator('.eb-go').click();
  await page.locator('main[data-screen="play"]').waitFor(); await phase(page, 'record');
  assert.equal(await game(page, () => window.__echo().who), 'dora', 'Dora records first in room 1');
  assert.equal(await game(page, () => window.__echo().room.index), 0);
  await page.locator('.eb-canvas').focus();
  await walkOntoPlate(page);
  await page.waitForTimeout(250);
  assert.ok(await game(page, () => window.__echo().groups[1]), 'Dora holds the plate down');
  const recorded = await game(page, () => window.__echo().t);
  await page.keyboard.press('r');
  await phase(page, 'rewind');
  assert.ok(await game(page, () => window.__echo().rewindLen > 0), 'time winds back');
  console.log('PASS the rewind plays after R');
  await phase(page, 'live');
  assert.deepEqual(await game(page, () => { const g = window.__echo(); return [g.who, g.loops, g.t < 30]; }), ['enzo', 2, true], 'Enzo steps out, loop 2, time back at the start');
  assert.ok(await game(page, (n) => window.__echo().frameCount >= n - 2, recorded), 'the echo kept the whole recording');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__echo().t > window.__echo().frameCount + 5);
  assert.ok(await game(page, () => window.__echo().groups[1]), 'the echo waits on the plate after its recording ends');
  await page.locator('main[data-phase="clear"]').waitFor({ timeout: 20000 });
  await page.keyboard.up('ArrowRight');
  await page.getByRole('dialog', { name: 'Room cleared' }).waitFor();
  const s1 = await save(page);
  assert.equal(s1.rooms.c1.clear, true, 'the clear is saved');
  assert.equal(s1.rooms.c1.par, true, 'two loops is within par');
  console.log('PASS room 1 cleared through both loops with real keys');

  // the next room opens with Enter; then retry (R while live) and record again (Shift+R)
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__echo()?.room.index === 1); await phase(page, 'record');
  await page.locator('.eb-canvas').focus();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  const x1 = await game(page, () => window.__echo().p.x);
  await page.keyboard.press('r'); await phase(page, 'live');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
  const echoFrames = await game(page, () => window.__echo().frameCount);
  await page.keyboard.press('r'); await phase(page, 'rewind'); await phase(page, 'live');
  assert.deepEqual(await game(page, (n) => { const g = window.__echo(); return [g.who, g.loops, g.frameCount === n]; }, echoFrames), ['enzo', 3, true], 'R while live tries again with the same echo');
  await page.keyboard.press('Shift+R'); await phase(page, 'rewind'); await phase(page, 'record');
  assert.deepEqual(await game(page, () => { const g = window.__echo(); return [g.who, g.loops]; }), ['dora', 4], 'Shift+R records again');
  assert.ok(x1 > 20, 'Dora moved during the first recording');
  console.log('PASS retrying and recording again');

  // pause by key and on a hidden tab: time stands still and doesn't jump on resume
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = await game(page, () => window.__echo().t); await page.waitForTimeout(400);
  assert.equal(await game(page, () => window.__echo().t), t0, 'paused time stands still');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor({ state: 'detached' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t1 = await game(page, () => window.__echo().t); await page.waitForTimeout(600);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.waitForTimeout(200);
  const t2 = await game(page, () => window.__echo().t);
  assert.ok(t2 >= t1 && t2 - t1 < 30, `no jump in time after a hidden tab (${t1} → ${t2})`);
  console.log('PASS pausing by key and when the tab hides');

  // the room list, and the save across a reload
  await page.reload(); await ready(page);
  assert.match(await page.locator('.eb-go').innerText(), /CONTINUE/);
  assert.match(await page.locator('.eb-go small').innerText(), /Room 2/, 'continues at the last room played');
  await page.getByRole('button', { name: /Rooms/ }).click();
  await page.locator('main[data-screen="rooms"]').waitFor();
  assert.match(await page.locator('.eb-total').innerText(), /3 \/ 90|2 \/ 90/);
  assert.equal(await page.locator('.eb-room.is-done').count(), 1, 'room 1 shows as cleared');
  assert.equal(await page.locator('.eb-room:not([disabled])').count(), 3, 'rooms 1 to 3 are open');
  assert.ok(await page.locator('.eb-room').nth(3).isDisabled(), 'room 4 is still locked');
  await page.locator('.eb-room').nth(2).click();
  await page.waitForFunction(() => window.__echo()?.room.index === 2);
  console.log('PASS the room list and the save across a reload');

  // a corrupt save is ignored, not misread
  for (const bad of ['{nope', '[]', '{"v":1,"rooms":{"c1":{"clear":"yes"}},"last":99}', '{"v":7,"rooms":{"c1":{"clear":true}}}']) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bad]);
    await page.reload(); await ready(page);
    assert.match(await page.locator('.eb-go').innerText(), /START/, `fresh start from ${bad}`);
    assert.match(await page.locator('.eb-alt').first().innerText(), /0 of 90/);
  }
  console.log('PASS a corrupt save starts fresh');

  // the room is framed large enough on a desktop screen
  await page.evaluate(() => window.__echoStart(0)); await phase(page, 'record');
  const r = await game(page, () => window.__echoRoomRect());
  assert.ok(r.h > 800 * 0.6 && r.w <= 1280, `the room fills the screen (${Math.round(r.w)}×${Math.round(r.h)})`);
  assert.ok(13 * r.scale >= 800 * 0.02 && 22 * r.scale >= 800 * 0.04, 'the climbers are big enough to read');
  assert.ok(await noSideScroll(page));
  console.log('PASS the desktop framing');
  await page.context().close();
}

for (const [label, viewport] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
  const page = await open(viewport, true);
  await page.goto(base + '/echo'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the ${label} menu`);
  await page.locator('.eb-go').tap();
  await phase(page, 'record');
  await page.locator(`main[data-touch="${label === 'upright' ? 'tall' : 'wide'}"]`).waitFor();
  const r = await game(page, () => window.__echoRoomRect());
  assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.w <= viewport.width + 1 && r.y + r.h <= viewport.height + 1, `the whole room shows (${label})`);
  const room = { x: r.x, y: r.y, w: r.w, h: r.h };
  for (const b of await page.locator('.eb-tb').all()) {
    const bb = await b.boundingBox();
    const overlap = bb.x < room.x + room.w - 1 && bb.x + bb.width > room.x + 1 && bb.y < room.y + room.h - 1 && bb.y + bb.height > room.y + 1;
    assert.ok(!overlap, `touch button ${await b.getAttribute('aria-label')} stays off the room (${label})`);
  }
  // play room 1 with the touch buttons
  const right = page.getByRole('button', { name: 'Right' });
  const box = await right.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx, y: cy, id: 1 }] });
  await walkOntoPlate(page, () => touch('touchStart'), () => touch('touchEnd'));
  await page.getByRole('button', { name: 'Stop recording' }).tap();
  await phase(page, 'live');
  await touch('touchStart');
  await page.locator('main[data-phase="clear"]').waitFor({ timeout: 20000 });
  await touch('touchEnd');
  await page.getByRole('dialog', { name: 'Room cleared' }).waitFor();
  assert.ok(await noSideScroll(page));
  console.log(`PASS a phone held ${label}: the room fits, the buttons stay clear, and touch clears room 1`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS Echo Burrow in the browser');
