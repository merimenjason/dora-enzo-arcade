// Sweep & Slide in the browser: the menu; the Practice Pond's first drill thrown with a real mouse pull-back and
// swept by holding the mouse, then again by keyboard (line, weight, curl, Space to throw and to sweep); a Cup match
// against the hedgehogs played through its first end with the scoreboard and the hammer; the match kept across a
// reload; corrupt saves; the final and the ending; the framing at 1280×800 and 1920×1080 (the house, the stone,
// Dora, Enzo and the captain all in view, a clear size and clear of the controls and the speech bubbles); and phones
// held upright and sideways, aiming with a touch drag and sweeping with the Sweep button.
// Needs `npm run dev` (port 3000, or BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'sweep-slide-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const state = (page) => page.evaluate(() => window.__curl());
const phase = (page, ...ps) => page.waitForFunction((ps) => ps.includes(window.__curl().phase), ps, { polling: 50, timeout: 60000 });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const quietSave = (extra = {}) => JSON.stringify({ v: 1, beaten: 0, wins: {}, best: {}, drills: {}, ended: false, tips: [], settings: { sound: false, music: false }, match: null, ...extra });
const settled = (page) => page.waitForFunction(() => window.__curlScene()?.settled, null, { polling: 50, timeout: 10000 });

/** The pull-back that sets a shot: the drag vector (screen px) for an angle and weight. */
async function pullFor(page, shot) {
  const s = await page.evaluate(() => window.__curlScene());
  const L = Math.min(300, Math.max(130, Math.min(s.W, s.H) * 0.36)) * shot.weight, a = 2 * shot.angle;
  // wide: world x is screen right and world y screen up; tall: world x is screen up, world y screen left
  return s.tall ? { dx: L * Math.sin(a), dy: L * Math.cos(a) } : { dx: -L * Math.cos(a), dy: L * Math.sin(a) };
}
async function canvasMid(page) { const r = await page.locator('.ss-canvas').boundingBox(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.42 }; }

/** Checks the house, the stone and the three characters are in view, a clear size, and clear of the controls and bubbles. */
async function framing(page, label, minChar) {
  await settled(page);
  const r = await page.evaluate(() => {
    const s = window.__curlScene(), c = document.querySelector('.ss-canvas').getBoundingClientRect();
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }; };
    return { s, c: { x: c.left, y: c.top, w: c.width, h: c.height }, W: innerWidth, H: innerHeight, controls: box('.ss-controls'), bubble: box('.ss-bubble'), bar: box('.ss-bar') };
  });
  const { s, c } = r, abs = (p) => ({ x: c.x + p.x, y: c.y + p.y });
  const chars = { dora: s.dora, enzo: s.enzo, captain: s.cap }, boxes = {};
  for (const [k, d] of Object.entries(chars)) {
    if (k === 'captain' && !s.captain) continue;
    const b = { x0: c.x + d.x - d.h * 0.36, x1: c.x + d.x + d.h * 0.36, y0: c.y + d.y - d.h * 0.85, y1: c.y + d.y };
    boxes[k] = b;
    assert.ok(b.x0 >= -4 && b.x1 <= r.W + 4 && b.y1 <= r.H + 2 && b.y0 >= (r.bar?.y1 ?? 0) - 2, `${label}: ${k} is in view ${JSON.stringify(b)}`);
    assert.ok(d.h >= minChar, `${label}: ${k} is a clear size (${d.h.toFixed(0)} ≥ ${minChar})`);
    if (r.controls) assert.ok(b.x1 <= r.controls.x0 + 6 || b.x0 >= r.controls.x1 - 6 || b.y1 <= r.controls.y0 + 6 || b.y0 >= r.controls.y1 - 6, `${label}: ${k} is clear of the controls`);
  }
  const h = abs(s.house), hr = s.house.r;
  assert.ok(h.x - hr >= c.x - 2 && h.x + hr <= c.x + c.w + 2 && h.y - hr >= c.y + s.band.y - 2 && h.y + hr <= c.y + s.band.y + s.band.h + 2, `${label}: the whole house is on the ice`);
  assert.ok(hr >= (s.tall ? 30 : 60), `${label}: the house is a clear size (${hr.toFixed(0)})`);
  const st = abs(s.stone0);
  assert.ok(st.x > c.x && st.x < c.x + c.w && st.y > c.y + s.band.y && st.y < c.y + s.band.y + s.band.h, `${label}: the stone at the hack is in view`);
  for (const b of [r.controls, r.bubble]) if (b) {
    assert.ok(b.x1 < h.x - hr || b.x0 > h.x + hr || b.y1 < h.y - hr || b.y0 > h.y + hr, `${label}: ${b === r.controls ? 'the controls' : 'the bubble'} leave the house clear`);
    assert.ok(b.x1 < st.x - 8 || b.x0 > st.x + 8 || b.y1 < st.y - 8 || b.y0 > st.y + 8, `${label}: ${b === r.controls ? 'the controls' : 'the bubble'} leave the stone clear`);
  }
  if (r.bubble) for (const [k, b] of Object.entries(boxes)) assert.ok(r.bubble.x1 <= b.x0 + 10 || r.bubble.x0 >= b.x1 - 10 || r.bubble.y1 <= b.y0 + 30 || r.bubble.y0 >= b.y1, `${label}: the bubble is clear of ${k}'s face`);
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
}

// ---- desktop: menu, practice by mouse, then by keyboard
const only = process.env.CURL_ONLY;
if (!only) {
  const page = await open();
  await page.goto(base + '/curl'); await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.match(await page.locator('.ss-menu-card h1').textContent(), /Sweep/);
  assert.ok(await page.locator('.ss-menu-card a[href="/"]').count(), 'a link back to the arcade');
  await page.getByRole('button', { name: /Practice Pond/ }).click();
  await page.locator('.ss-drill').first().click();
  await phase(page, 'aim');
  let st = await state(page);
  assert.equal(st.drill, 'draw'); assert.ok(st.call && /button/i.test(st.call.text), 'the teammate calls the shot');
  assert.match(await page.locator('.ss-bubble').textContent(), /Enzo/);
  await framing(page, 'practice 1280×800', 200);
  // pull back with the mouse to the teammate's line and weight, and let go
  const want = st.call.shot, pull = await pullFor(page, want), m0 = await canvasMid(page);
  await page.mouse.move(m0.x, m0.y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(m0.x + (pull.dx * i) / 12, m0.y + (pull.dy * i) / 12);
  st = await state(page);
  assert.ok(Math.abs(st.aim.weight - want.weight) < 0.02 && Math.abs(st.aim.angle - want.angle) < 0.004, `the pull sets the aim (${JSON.stringify(st.aim)} vs ${JSON.stringify(want)})`);
  assert.equal(await page.locator('.ss-wname b').textContent(), 'Draw', 'the weight bar names draw weight');
  await page.mouse.up();
  await phase(page, 'run');
  // hold the mouse to sweep
  await page.mouse.down(); await page.waitForFunction(() => window.__curl().sweeping, null, { polling: 30 });
  await page.waitForTimeout(400); await page.mouse.up();
  await page.evaluate(() => window.__curlSpeed(8));
  await phase(page, 'drilled');
  st = await state(page);
  const me = st.stones.find((s) => s.id === 7);
  assert.ok(me && !me.out && me.x > 14, `the stone slid down the ice (${JSON.stringify(me)})`);
  // again, by keyboard
  await page.keyboard.press('Enter'); await phase(page, 'aim');
  const a0 = (await state(page)).aim;
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('c');
  const a1 = (await state(page)).aim;
  assert.ok(a1.weight > a0.weight && a1.angle > a0.angle && a1.curl === -a0.curl, 'keys change the weight, the line and the curl');
  await page.keyboard.press('c');
  await page.evaluate(() => window.__curlSpeed(1));
  await page.keyboard.press('Space'); await phase(page, 'run');
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.__curl().sweeping, null, { polling: 30 }); await page.keyboard.up('Space');
  await page.evaluate(() => window.__curlSpeed(10)); await phase(page, 'drilled');
  assert.ok(await page.locator('.ss-card-small .ss-stars').count(), 'the drill shows its stars');
  await page.close();
}

// ---- a Cup match: the first end, the scoreboard and the hammer, then kept across a reload
if (!only) {
  const page = await open();
  await page.goto(base + '/curl'); await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, quietSave()]); await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Play the Cup/ }).click();
  assert.equal(await page.locator('.ss-team:not([disabled])').count(), 1, 'only the first team is open');
  await page.locator('.ss-team').first().click();
  await page.locator('.ss-modal').getByRole('button', { name: 'To the ice' }).click();
  await page.evaluate(() => window.__curlSpeed(12));
  let st = await state(page);
  assert.equal(st.team, 'hedgehog'); assert.equal(st.hammer, 0, 'we have the hammer in the first end'); assert.equal(st.ends, 4);
  // the hedgehogs throw first; we follow our teammate's calls through the end
  for (let k = 0; k < 8; k++) {
    await phase(page, 'aim', 'endcard');
    st = await state(page);
    if (st.phase === 'endcard') break;
    assert.equal(st.turn, 0, 'our turn to aim');
    if (k === 0) await framing(page, 'match 1280×800', 200);
    await page.evaluate(() => { const c = window.__curl().call; window.__curlAim(c.shot, true); });
    await page.waitForFunction(() => window.__curl().phase !== 'aim', null, { polling: 30 });
  }
  await phase(page, 'endcard');
  st = await state(page);
  assert.equal(st.end, 1, 'one end played');
  assert.match(await page.locator('.ss-modal h2').textContent(), /score|blank|tie/i);
  assert.equal(await page.locator('.ss-end').first().locator('u').allTextContents().then((t) => t.join('').length > 0), true, 'the scoreboard shows the first end');
  await page.locator('.ss-modal').getByRole('button', { name: 'Next end' }).click();
  await phase(page, 'aim');
  st = await state(page);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.ok(saved.match && saved.match.team === 'hedgehog' && saved.match.snap.end === 1, 'the match is saved between stones');
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Carry on/ }).click();
  await phase(page, 'aim');
  const back = await state(page);
  assert.deepEqual([back.end, back.thrown, back.score], [st.end, st.thrown, st.score], 'the match carries on after a reload');
  await page.close();
}

// ---- corrupt saves; the final and the ending
if (!only) {
  const page = await open();
  await page.goto(base + '/curl');
  for (const bad of ['{nope', '[1,2]', JSON.stringify({ v: 1, beaten: 'x', match: { team: 'stoat', seed: 1, snap: { stones: 'x' } }, drills: { draw: 99 } })]) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bad]); await page.reload(); await ready(page);
    assert.equal(await page.getByRole('button', { name: /Carry on/ }).count(), 0, 'a corrupt save starts fresh');
    assert.match(await page.locator('.ss-menu-buttons').textContent(), /0\/8/);
  }
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, quietSave({ beaten: 7, wins: { hedgehog: 1 } })]); await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Cup ladder/ }).click();
  assert.equal(await page.locator('.ss-team:not([disabled])').count(), 8, 'every team is open after beating seven');
  await page.locator('.ss-team.is-final').click();
  assert.match(await page.locator('.ss-modal').textContent(), /THE FINAL/);
  await page.locator('.ss-modal').getByRole('button', { name: 'To the ice' }).click();
  assert.equal((await state(page)).hammer, 1, 'the champions have the hammer in the first end');
  await page.evaluate(() => window.__curlFinish(0));
  await phase(page, 'over');
  assert.match(await page.locator('.ss-modal h2').textContent(), /Pebble Cup/);
  await page.locator('.ss-modal').getByRole('button', { name: 'Lift the Cup' }).click();
  await page.locator('.ss-ending-card').waitFor();
  const sv = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.ok(sv.ended && sv.beaten === 8 && sv.match === null, 'the Cup is won and saved');
  await page.close();
}

// ---- 1920×1080
if (!only) {
  const page = await open({ width: 1920, height: 1080 });
  await page.goto(base + '/curl'); await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, quietSave()]); await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Play the Cup/ }).click(); await page.locator('.ss-team').first().click();
  await page.locator('.ss-modal').getByRole('button', { name: 'To the ice' }).click();
  await page.evaluate(() => window.__curlSpeed(12)); await phase(page, 'aim');
  await framing(page, 'match 1920×1080', 280);
  await page.close();
}

// ---- phones, upright and sideways: aim with a touch drag, sweep with the button
for (const [w, h, label, minChar] of [[390, 844, 'phone upright', 90], [844, 390, 'phone sideways', 90]]) {
  const page = await open({ width: w, height: h }, true);
  await page.goto(base + '/curl'); await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, quietSave()]); await page.reload(); await ready(page);
  assert.ok(await noSideScroll(page), `${label}: the menu fits`);
  await page.getByRole('button', { name: /Practice Pond/ }).tap(); await page.locator('.ss-drill').first().tap();
  await phase(page, 'aim');
  await framing(page, label, minChar);
  const want = (await state(page)).call.shot, pull = await pullFor(page, want), m0 = await canvasMid(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: m0.x, y: m0.y }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: m0.x + (pull.dx * i) / 10, y: m0.y + (pull.dy * i) / 10 }] });
  await page.waitForTimeout(150);
  const st = await state(page);
  assert.ok(Math.abs(st.aim.weight - want.weight) < 0.03, `${label}: a touch drag sets the weight (${JSON.stringify(st.aim)} vs ${JSON.stringify(want)}, pull ${JSON.stringify(pull)} from ${JSON.stringify(m0)})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phase(page, 'run');
  const sweep = page.locator('.ss-sweep');
  await sweep.waitFor();
  const b = await sweep.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await page.waitForFunction(() => window.__curl().sweeping, null, { polling: 30 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.evaluate(() => window.__curlSpeed(10)); await phase(page, 'drilled');
  assert.ok(await noSideScroll(page), `${label}: no sideways scroll`);
  await page.close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('e2e curl: all checks passed');
