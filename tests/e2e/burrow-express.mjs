import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { Game } from '../../.checks/burrow-express-game.js';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000', RUN = 'burrow-express-run-v1', KEY = 'burrow-express-v1';
const browser = await chromium.launch(), errors = [];
const hook = (p, fn) => p.evaluate(`(${fn})(window.__express())`);
const watch = (p) => p.on('pageerror', (e) => errors.push(e.message));
const point = async (p, id) => {
  const q = await p.getByTestId('board').boundingBox(), s = await hook(p, `t => t.game.stations[${id}]`);
  return [q.x + s.x / 960 * q.width, q.y + s.y / 600 * q.height];
};
async function tools(p) {
  if (await p.getByTestId('editor').getAttribute('open') === null) await p.getByTestId('editor').locator('summary').click();
}
async function blueprint(p) {
  const info = await hook(p, 't => ({ paused: t.game.paused, loop: t.game.lines[0].loop, stops: t.game.lines[0].stops.length, open: t.game.active, drills: t.game.drills })');
  if (!info.paused) await p.keyboard.press('p');
  await tools(p); await p.getByTestId('line-0').click();
  if (info.loop) await p.getByTestId('loop').click();
  for (let i = 0; i < info.stops; i++) await p.getByTestId('remove-stop').click();
  const x = info.open.reduce((n, s) => n + s.x, 0) / info.open.length, y = info.open.reduce((n, s) => n + s.y, 0) / info.open.length;
  const left = [...info.open].sort((a, b) => Math.atan2(a.y - y, a.x - x) - Math.atan2(b.y - y, b.x - x));
  while (left.length) {
    const ids = await hook(p, `t => ${JSON.stringify(left.map((s) => s.id))}.filter(id => { const from = t.game.lines[0].stops.at(-1); return from === undefined || !t.game.needsDrill(from, id) || t.game.drills > 0; })`);
    if (!ids.length) break;
    const id = ids[0]; left.splice(left.findIndex((s) => s.id === id), 1); await p.getByTestId(`station-${id}`).click();
  }
  if (await p.getByTestId('loop').isEnabled()) await p.getByTestId('loop').click();
  while (await p.getByTestId('add-cart').isEnabled()) await p.getByTestId('add-cart').click();
  await p.keyboard.press('p');
}
try {
  await mkdir('.checks/burrow-express', { recursive: true });
  // A cold connection must finish loading the real painted assets before a game can start.
  const cold = await browser.newPage(); watch(cold);
  let release, requested; const held = new Promise((r) => release = r), seen = new Promise((r) => requested = r);
  await cold.route('**/art/express/carts.png', async (route) => { requested(); await held; await route.continue(); });
  await cold.goto(`${base}/express`, { waitUntil: 'domcontentloaded' }); await seen;
  assert.ok(await cold.getByTestId('start').isDisabled(), 'game cannot run behind missing artwork');
  release(); await cold.getByTestId('start').click(); await cold.getByTestId('board').waitFor();
  assert.ok(await cold.locator('.be-duo').evaluate((im) => im.complete && im.naturalWidth >= 1000), 'the approved-style portrait really loaded');
  await cold.close();
  const broken = await browser.newPage(); watch(broken);
  await broken.route('**/art/express/carts.png', (route) => route.fulfill({ status: 404, body: '' }));
  await broken.goto(`${base}/express`); await broken.getByText('The warren artwork could not load.', { exact: false }).waitFor();
  assert.ok(await broken.getByTestId('start').isDisabled()); assert.ok(await broken.getByRole('button', { name: 'Try again', exact: true }).isVisible()); await broken.close();

  const p = await browser.newPage({ viewport: { width: 1440, height: 1050 } }); watch(p); p.setDefaultTimeout(20000);
  await p.goto(base); assert.equal(await p.locator('.arcade-card').count(), 31);
  await p.locator('a[href="/express"]').click(); await p.getByTestId('start').waitFor();
  assert.equal(await p.locator('.be-maps button').count(), 3);
  await p.screenshot({ path: '.checks/burrow-express/home.png', fullPage: true });

  // A cancelled drawing gesture creates neither a stop nor a cart. A real drag creates both endpoints.
  await p.getByTestId('map-2').click(); await p.getByTestId('tutorial').click();
  assert.equal(await hook(p, 't => t.game.map'), 0, 'the guided lesson always uses gentle Clover Meadow');
  let a = await point(p, 0), b = await point(p, 1);
  await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...b);
  await p.getByTestId('board').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' }); await p.mouse.up();
  assert.deepEqual(await hook(p, 't => t.game.lines[0].stops'), []);
  await p.mouse.move(...a); await p.mouse.down(); await p.mouse.move(...b, { steps: 8 }); await p.mouse.up();
  assert.deepEqual(await hook(p, 't => t.game.lines[0].stops'), [0, 1]);
  assert.equal(await hook(p, 't => t.game.carts.length'), 1);
  assert.match(await p.getByTestId('coach').textContent(), /Connect the warren/);
  await tools(p); await p.getByTestId('station-2').click(); await p.getByTestId('station-3').click();
  await hook(p, 't => t.fast(60)'); await p.getByTestId('upgrade-cart').waitFor();
  await p.getByTestId('upgrade-cart').click(); await p.getByTestId('result').waitFor();
  assert.equal(await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).tutorial, KEY), true);
  assert.equal(await p.evaluate((k) => localStorage.getItem(k), RUN), null, 'a finished tutorial is not offered as a saved route');
  await p.screenshot({ path: '.checks/burrow-express/tutorial-complete.png' });
  await p.getByTestId('menu').click(); await hook(p, 't => t.fast(1)'); await p.getByTestId('map-0').click();

  // Keyboard selection, adding/releasing carts, loops and a safe route edit.
  await p.getByTestId('start').click(); await tools(p); await p.getByTestId('board').focus();
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter');
  assert.deepEqual(await hook(p, 't => t.game.lines[0].stops'), [1, 0]);
  await p.keyboard.press('2'); await p.getByTestId('editor').locator('summary').focus(); await p.keyboard.press('Enter');
  assert.deepEqual(await hook(p, 't => t.game.lines[1].stops'), [], 'Enter on the tools disclosure does not also connect a station');
  await p.keyboard.press('1'); await tools(p); await p.getByTestId('board').focus();
  await p.keyboard.press('a'); assert.equal(await hook(p, 't => t.game.carts.length'), 2);
  await p.getByTestId('release-cart').click(); assert.equal(await hook(p, 't => t.game.carts.length'), 1);
  const q = await p.getByTestId('board').boundingBox(), s = await hook(p, 't => t.game.stations[3]');
  await p.mouse.click(q.x + s.x / 960 * q.width, q.y + (s.y + 67) / 600 * q.height);
  assert.deepEqual(await hook(p, 't => t.game.lines[0].stops'), [1, 0, 3], 'the label below a building is clickable too');
  await p.keyboard.press('l'); assert.equal(await hook(p, 't => t.game.lines[0].loop'), true);
  await p.getByTestId('reroute').click(); assert.equal(await p.getByTestId('status').getAttribute('data-paused'), 'true');
  await p.getByTestId('remove-stop').click(); assert.deepEqual(await hook(p, 't => t.game.lines[0].stops'), [1, 0]);
  await p.getByTestId('carry-on').click();
  await hook(p, 't => t.game.passenger(1, "home")'); await hook(p, 't => t.advance(2)');
  await p.getByTestId('menu').click();
  const kept = await p.evaluate((k) => localStorage.getItem(k), RUN); assert.ok(Game.load(kept));
  await p.reload(); await p.getByTestId('resume').click();
  assert.equal(await hook(p, 't => t.game.save()'), kept, 'every cart, passenger and clock returns unchanged and paused');
  const time = await hook(p, 't => t.game.time'); await p.waitForTimeout(180); assert.equal(await hook(p, 't => t.game.time'), time);
  await p.getByTestId('carry-on').click(); await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await p.getByTestId('status').getAttribute('data-paused'), 'true');

  // A real cave-in uses a drill; focus loss and pausing keep its expiry clock still.
  await hook(p, 't => { const g = t.game; g.block = { a: 0, b: 1, until: g.time + 20 }; t.advance(0); }');
  const drills = await hook(p, 't => t.game.drills'); await p.getByRole('button', { name: 'Clear cave-in' }).click();
  assert.equal(await hook(p, 't => t.game.block'), null); assert.equal(await hook(p, 't => t.game.drills'), drills - 1);

  // A whole seeded shift, built through the actual controls, day by day, with no free passengers or resources.
  await p.getByTestId('menu').click();
  await p.evaluate(([k, text]) => localStorage.setItem(k, text), [RUN, Game.start(0, 'challenge', 1).save()]); await p.reload(); await p.getByTestId('resume').click();
  await hook(p, 't => t.fast(45)'); await blueprint(p);
  for (let guard = 0; guard < 12; guard++) {
    await p.waitForSelector('[data-testid^="upgrade-"], [data-testid="result"]');
    if (await p.getByTestId('result').count()) break;
    const pick = await hook(p, 't => { const g = t.game, a = g.offers(); return g.drills < 2 && a.includes("drill") ? "drill" : g.fleet < 7 && a.includes("cart") ? "cart" : a.includes("capacity") ? "capacity" : a[0]; }');
    await p.getByTestId(`upgrade-${pick}`).click();
    if (await p.getByTestId('cave-in').count()) { const button = p.getByRole('button', { name: 'Clear cave-in' }); if (await button.isEnabled()) await button.click(); }
    await blueprint(p);
  }
  assert.equal(await hook(p, 't => t.game.state'), 'won');
  assert.ok(await hook(p, 't => t.game.delivered >= t.game.goal'));
  const won = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY); assert.equal(won.records[0].wins, 1);
  await p.screenshot({ path: '.checks/burrow-express/won.png' });
  await p.reload(); await p.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
  assert.equal(await p.getByTestId('resume').count(), 0); assert.match(await p.getByTestId('map-0').textContent(), /1 shift won/);

  // A loss banks records and removes the route too; corrupt saves leave the home screen usable.
  await p.getByTestId('endless').click(); await p.getByTestId('map-2').click(); await p.getByTestId('start').click();
  await hook(p, 't => { for (let i = 0; i < 9; i++) t.game.passenger(0, "hay"); }');
  for (let i = 0; i < 10; i++) await hook(p, 't => t.advance(2)');
  assert.equal(await hook(p, 't => t.game.state'), 'lost'); assert.equal(await p.evaluate((k) => localStorage.getItem(k), RUN), null);
  await p.getByTestId('menu').click();
  await p.evaluate((k) => localStorage.setItem(k, '{"v":1,"stations":null}'), RUN); await p.reload();
  await p.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
  assert.equal(await p.getByTestId('resume').count(), 0); assert.ok(await p.getByTestId('start').isEnabled());
  await p.close();

  // Native touch cancellation and drawing, accessible station buttons, mobile upgrades and rotation.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); watch(phone); phone.setDefaultTimeout(20000);
  await phone.goto(`${base}/express`); await phone.getByTestId('tutorial').tap();
  const touch = await phone.context().newCDPSession(phone); a = await point(phone, 0); b = await point(phone, 1);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b[0], y: b[1] }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.deepEqual(await hook(phone, 't => t.game.lines[0].stops'), []);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a[0], y: a[1] }] });
  for (let i = 1; i <= 8; i++) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a[0] + (b[0] - a[0]) * i / 8, y: a[1] + (b[1] - a[1]) * i / 8 }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(await hook(phone, 't => t.game.lines[0].stops'), [0, 1]);
  await phone.getByTestId('station-2').tap(); await phone.getByTestId('station-3').tap();
  await phone.screenshot({ path: '.checks/burrow-express/phone.png', fullPage: true });
  await hook(phone, 't => t.fast(60)'); await phone.getByTestId('upgrade-cart').tap(); await phone.getByTestId('result').waitFor();
  await phone.getByTestId('again').tap(); await phone.getByTestId('pause').tap();
  for (const [width, height] of [[320, 568], [568, 320], [844, 390], [390, 844]]) {
    await phone.setViewportSize({ width, height }); await phone.waitForTimeout(100);
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}×${height} has no sideways overflow`);
    const q = await phone.getByTestId('board').boundingBox(); assert.ok(q.width >= 290 && q.x >= 0 && q.x + q.width <= width + 1);
    assert.ok(await phone.getByTestId('station-0').isVisible());
  }
  await phone.close(); assert.deepEqual(errors, []);
  console.log('PASS Burrow Express: menu, tutorial, drag/cancel, keys, carts, loops, editing, mid-journey saves, pause/focus, cave-ins, a whole shift, records, loss, corrupt saves, touch and four phone layouts.');
} finally { await browser.close(); }
