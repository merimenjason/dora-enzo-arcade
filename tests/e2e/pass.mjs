// Kumori Pass in the browser: the menu, real keyboard driving (throttle, steering, handbrake, camera, pause), a delivery
// finished and kept across a reload, a corrupt save, the story's first steps, a duel's intro, HUD and cut-in, the framing
// at 1280×800 and 1920×1080 with the HUD clear of the road ahead, and phones held sideways and upright driven by touch,
// with no page errors. Needs `npm run dev` running and Playwright installed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'kumori-pass-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const state = (page) => page.evaluate(() => { const s = window.__pass(); return JSON.parse(JSON.stringify({ screen: s.screen, paused: s.paused, race: s.race, save: s.save, cutin: s.cutin, round: s.round, result: s.result })); });
const waitFor = async (page, fn, what, ms = 20000) => {
  const t0 = Date.now();
  for (;;) { const s = await state(page); if (fn(s)) return s; if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}: ${JSON.stringify({ screen: s.screen, race: s.race && { t: s.race.t, s: s.race.s, speed: s.race.speed } })}`); await page.waitForTimeout(150); }
};
const mode = (page, name) => page.locator('.kp-mode').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
const box = (page, sel) => page.locator(sel).first().boundingBox();
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// ---------------------------------------------------------------- desktop: menu, driving, a delivery, saving
{
  const page = await open();
  await page.goto(`${base}/pass`); await ready(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.match(await page.locator('h1').textContent(), /Kumori Pass/);
  assert.equal(await page.locator('a.kp-home[href="/"]').count(), 1, 'a plain link home');
  for (const m of ['Story', 'Delivery Runs', 'Free Duel', 'Time Attack', 'Garage', 'Settings']) assert.equal(await mode(page, m).count(), 1, `menu has ${m}`);
  assert.ok(await mode(page, 'Free Duel').isDisabled(), 'Free Duel waits for a beaten rival');
  console.log('PASS menu');

  // the course picker: six passes, the first two open, notebook levels shown
  await mode(page, 'Delivery Runs').click();
  assert.equal(await page.locator('.kp-pass').count(), 6);
  assert.ok(await page.locator('.kp-pass[data-pass="cedar"]').isEnabled());
  assert.ok(await page.locator('.kp-pass[data-pass="tunnel"]').isDisabled(), 'later passes open through the story');
  assert.match(await page.locator('.kp-pass[data-pass="cedar"]').textContent(), /Scribbles/);
  await page.locator('.kp-pass[data-pass="cedar"]').click();
  let s = await waitFor(page, (x) => x.screen === 'race' && x.race, 'the race');
  assert.equal(s.race.mode, 'delivery'); assert.equal(s.race.buns, 12);
  // the countdown, then real keys: throttle, steering, handbrake
  await waitFor(page, (x) => x.race.t > 0.2, 'the start');
  // waits are on what the car does, not on the wall clock: a slow software-rendered frame rate runs less game time
  await page.keyboard.down('ArrowUp');
  s = await waitFor(page, (x) => x.race.s > 16 && x.race.speed > 5, 'throttle to move the car along the road', 20000);
  assert.ok(s.race.speed > 5 && s.race.s > 16, `throttle moves the car (${s.race.speed.toFixed(1)} m/s, ${s.race.s.toFixed(0)} m)`);
  await page.keyboard.down('ArrowLeft');
  s = await waitFor(page, (x) => x.race.steer > 0.02, 'left to steer left', 8000); assert.ok(s.race.steer > 0.02, `left steers left (${s.race.steer.toFixed(3)})`);
  await page.keyboard.up('ArrowLeft'); await page.keyboard.down('KeyD');
  s = await waitFor(page, (x) => x.race.steer < 0, 'D to steer right', 8000); assert.ok(s.race.steer < 0, 'D steers right'); await page.keyboard.up('KeyD');
  await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space');
  await page.keyboard.press('KeyC'); await page.keyboard.press('KeyC'); await page.keyboard.press('KeyC');
  await page.keyboard.up('ArrowUp');
  // Enzo has called a corner by now
  await waitFor(page, (x) => !!x.race.note, 'a pace note', 15000);
  await page.keyboard.press('Escape'); s = await state(page); assert.ok(s.paused, 'Esc pauses');
  const tPaused = s.race.t; await page.waitForTimeout(400); assert.equal((await state(page)).race.t, tPaused, 'nothing moves while paused');
  await expectVisible(page, '.kp-pausecard');
  await page.locator('.kp-pausecard button', { hasText: 'Resume' }).click();
  // jump to the line and finish
  await page.evaluate(() => window.__pass().debug.nearFinish());
  await page.keyboard.down('ArrowUp');
  s = await waitFor(page, (x) => x.screen === 'result', 'the result', 30000);
  await page.keyboard.up('ArrowUp');
  assert.equal(s.result.mode, 'delivery'); assert.ok(s.result.time > 0); assert.ok(s.result.coins > 0, 'coins earned');
  assert.equal(s.save.runs.cedar, 1, 'the run is counted'); assert.ok(s.save.best.cedar > 0);
  assert.equal(await page.locator('.kp-levelup').count(), 1, 'the notebook levels up after the first run');
  console.log(`PASS keyboard delivery (${s.result.time.toFixed(1)} s, ${s.result.buns} buns, +${s.result.coins} coins)`);

  // kept across a reload
  await page.reload(); await ready(page);
  s = await state(page);
  assert.equal(s.save.runs.cedar, 1); assert.ok(s.save.coins > 0);
  await mode(page, 'Delivery Runs').click();
  assert.match(await page.locator('.kp-pass[data-pass="cedar"]').textContent(), /Rough notes/);
  await page.locator('.kp-back').first().click();
  console.log('PASS save and reload');

  // a corrupt save falls back to a fresh one
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"coins":"lots","runs":[1,2],"upgrades":["rocket"],"settings":7'), KEY);
  await page.reload(); await ready(page);
  s = await state(page); assert.equal(s.save.coins, 0); assert.deepEqual(s.save.upgrades, []);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, coins: 999, upgrades: ['tyres', 'nitro'], story: 99, beaten: ['stoat', 'dragon'], settings: { assist: 9 } })), KEY);
  await page.reload(); await ready(page);
  s = await state(page); assert.equal(s.save.coins, 999); assert.deepEqual(s.save.upgrades, ['tyres']); assert.deepEqual(s.save.beaten, ['stoat']); assert.equal(s.save.settings.assist, 1);
  console.log('PASS corrupt saves');

  // the garage: buy a part
  await mode(page, 'Garage').click();
  await page.locator('.kp-part[data-part="tray"] button').click();
  s = await state(page); assert.ok(s.save.upgrades.includes('tray')); assert.equal(s.save.coins, 949);
  await page.locator('.kp-back').first().click();
  console.log('PASS garage');

  // the story: the opening scene, skipped, leads to the first delivery's briefing
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  await mode(page, 'Story').click();
  await page.locator('.kp-step button[data-step="0"]').click();
  await page.locator('.kp-dialog').waitFor();
  await page.keyboard.press('Enter');
  await page.locator('.kp-skip').click();
  s = await waitFor(page, (x) => x.screen === 'scene' && x.save.story === 1, 'the delivery briefing');
  await page.locator('.kp-skip').click();
  s = await waitFor(page, (x) => x.screen === 'race', 'the first story delivery');
  assert.equal(s.race.pass, 'cedar');
  await page.keyboard.press('Escape'); await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  console.log('PASS story start');

  // a duel: the VS card, the gap meter, the cut-in panel
  await page.evaluate(() => window.__pass().debug.story(3));
  await mode(page, 'Story').click();
  await page.locator('.kp-step button[data-step="3"]').click();
  await page.locator('.kp-vs').waitFor();
  assert.match(await page.locator('.kp-vs').textContent(), /Skitter/);
  await page.locator('.kp-go', { hasText: 'Race!' }).click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race?.mode === 'duel', 'the duel');
  assert.equal(await page.locator('.kp-gap').count(), 1, 'the gap meter');
  await waitFor(page, (x) => x.race.t > 0.1, 'the duel start');
  await page.evaluate(() => window.__pass().debug.cutin(0));
  await page.locator('.kp-cutin').waitFor();
  assert.equal(await page.locator('.kp-cutin .kp-paint').count(), 2, 'a split comic panel');
  await page.evaluate(() => window.__pass().debug.clearCutin());
  await page.keyboard.press('Escape'); await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  console.log('PASS duel intro, gap meter and cut-in');
  await page.context().close();
}

async function expectVisible(page, sel) { assert.ok(await page.locator(sel).first().isVisible(), `${sel} is visible`); }

// ---------------------------------------------------------------- desktop framing
for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const page = await open(vp);
  await page.goto(`${base}/pass`); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, coins: 0, story: 3 })), KEY); await page.reload(); await ready(page);
  // the menu fits without scrolling
  for (const sel of ['.kp-titleblock', '.kp-modes']) { const b = await box(page, sel); assert.ok(b && b.y >= 0 && b.y + b.height <= vp.height && b.x + b.width <= vp.width, `${sel} fits at ${vp.width}`); }
  await mode(page, 'Story').click();
  await page.locator('.kp-step button[data-step="3"]').click();
  await page.locator('.kp-go', { hasText: 'Race!' }).click();
  await waitFor(page, (x) => x.screen === 'race' && x.race.t > 0.5, 'racing');
  await page.evaluate(() => window.__pass().debug.say('Left 3 · into right 4'));
  await page.waitForTimeout(300);
  // the road ahead (the middle of the screen) is clear of the HUD; the note bubble sits in the sky band
  const road = { x: vp.width * 0.3, y: vp.height * 0.32, width: vp.width * 0.4, height: vp.height * 0.6 };
  for (const sel of ['.kp-hud-tl', '.kp-hud-tr', '.kp-note', '.kp-pausebtn']) { const b = await box(page, sel); assert.ok(!overlap(b, road), `${sel} stays off the road at ${vp.width}×${vp.height}`); }
  const note = await box(page, '.kp-note'), tl = await box(page, '.kp-hud-tl'), tr = await box(page, '.kp-hud-tr');
  assert.ok(note.y + note.height < vp.height * 0.2, 'the note bubble is at the top');
  assert.ok(!overlap(note, tl) && !overlap(note, tr), 'the note bubble clears the HUD corners');
  console.log(`PASS framing ${vp.width}×${vp.height}`);
  await page.context().close();
}

// ---------------------------------------------------------------- phones, sideways and upright, by touch
for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
  const page = await open(vp, true);
  await page.goto(`${base}/pass`); await ready(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling');
  for (const sel of ['.kp-modes', '.kp-titleblock h1']) { const b = await box(page, sel); assert.ok(b && b.y >= 0 && b.y + b.height <= vp.height + 1 && b.x >= 0 && b.x + b.width <= vp.width + 1, `${sel} fits at ${vp.width}×${vp.height}`); }
  await mode(page, 'Delivery Runs').tap();
  await page.locator('.kp-pass[data-pass="cedar"]').tap();
  let s = await waitFor(page, (x) => x.screen === 'race' && x.race.t > 0.2, 'the start');
  assert.ok(s.save.settings.assist >= 0.85, 'touch players start with high assist');
  const gas = await box(page, '.kp-tp-gas'), left = await box(page, '.kp-tp-left button');
  assert.ok(gas && left, 'touch pads shown');
  assert.ok(gas.x + gas.width <= vp.width && gas.y + gas.height <= vp.height && left.x >= 0, 'pads on screen');
  for (const sel of ['.kp-hud-tl', '.kp-hud-tr', '.kp-pausebtn']) { const b = await box(page, sel); for (const p of ['.kp-tp-gas', '.kp-tp-brake', '.kp-tp-hand', '.kp-tp-left']) assert.ok(!overlap(b, await box(page, p)), `${sel} clear of ${p}`); }
  // hold GAS with a real touch: the car moves
  const cdp = await page.context().newCDPSession(page);
  const pt = { x: gas.x + gas.width / 2, y: gas.y + gas.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...pt, id: 1 }] });
  s = await waitFor(page, (x) => x.race.speed > 4, 'GAS by touch to move the car', 20000);
  assert.ok(s.race.speed > 4, `GAS by touch moves the car (${s.race.speed.toFixed(1)} m/s)`);
  const lp = { x: left.x + left.width / 2, y: left.y + left.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...pt, id: 1 }, { ...lp, id: 2 }] });
  s = await waitFor(page, (x) => x.race.steer > 0.02, 'the left pad to steer', 8000);
  assert.ok(s.race.steer > 0.02, 'the left pad steers left while GAS is held');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__pass().debug.say('Hairpin right · don\'t cut'));
  await page.waitForTimeout(250);
  const note = await box(page, '.kp-note');
  for (const p of ['.kp-tp-gas', '.kp-tp-left']) assert.ok(!overlap(note, await box(page, p)), 'the note is clear of the pads');
  assert.ok(note.x >= 0 && note.x + note.width <= vp.width, 'the note fits across');
  console.log(`PASS phone ${vp.width}×${vp.height}`);
  await page.context().close();
}

// the garage's cars: beat a rival, drive their kind of car in free play; the story stays in the Biscuit
{
  const page = await open();
  await page.goto(`${base}/pass`); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, coins: 3, story: 3, beaten: ['stoat'] })), KEY); await page.reload(); await ready(page);
  await mode(page, 'Garage').click();
  assert.match(await page.locator('.kp-carcard[data-car="brioche"] button').textContent(), /Beat Vesper/);
  assert.ok(await page.locator('.kp-carcard[data-car="brioche"] button').isDisabled(), 'a locked car cannot be picked');
  await page.locator('.kp-carcard[data-car="shortbread"] button').click();
  let s = await state(page); assert.equal(s.save.car, 'shortbread');
  await page.locator('.kp-back').first().click();
  await mode(page, 'Delivery Runs').click(); await page.locator('.kp-pass[data-pass="cedar"]').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race, 'a free delivery');
  assert.equal(s.race.car, 'shortbread', 'free play drives the picked car');
  await page.keyboard.press('Escape'); await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  await mode(page, 'Story').click(); await page.locator('.kp-step button[data-step="1"]').click();
  await page.locator('.kp-skip').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race, 'a story delivery');
  assert.equal(s.race.car, 'biscuit', 'the story drives the Biscuit');
  await page.keyboard.press('Escape'); await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  console.log('PASS cars');
  // after the ending: the stranger's chapter opens, Hush and the Pavlova stay locked until she is beaten
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, story: 17, ended: true })), KEY); await page.reload(); await ready(page);
  assert.match(await mode(page, 'Story').locator('small').textContent(), /stranger/i);
  await mode(page, 'Garage').click();
  assert.match(await page.locator('.kp-carcard[data-car="pavlova"] button').textContent(), /Beat Hush/);
  assert.ok(!(await page.locator('.kp-carcard[data-car="stollen"] button').isDisabled()), 'the ending opens the story cars');
  await page.locator('.kp-back').first().click();
  await mode(page, 'Story').click(); await page.locator('.kp-step button[data-step="17"]').click();
  await waitFor(page, (x) => x.screen === 'scene', 'the stranger\'s scene'); await page.locator('.kp-skip').click();
  s = await waitFor(page, (x) => x.screen === 'intro', 'Hush\'s intro'); assert.equal(s.save.story, 18, 'the scene moves the story on');
  console.log('PASS postgame');
  await page.context().close();
}

// Enzo's line: the demo drives itself from the course picker and saves nothing
{
  const page = await open();
  await page.goto(`${base}/pass`); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, coins: 3, story: 3 })), KEY); await page.reload(); await ready(page);
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  await mode(page, 'Delivery Runs').click();
  await page.locator('.kp-watch[data-pass="cedar"]').click();
  let s = await waitFor(page, (x) => x.screen === 'race' && x.race && x.race.t > 3, 'the demo under way', 40000);
  assert.equal(s.race.mode, 'demo'); assert.ok(s.race.s > 20, `the demo drives itself (${s.race.s.toFixed(0)} m)`);
  assert.match(await page.locator('.kp-time small').textContent(), /Enzo/);
  await page.keyboard.press('Escape'); await waitFor(page, (x) => x.paused, 'paused');
  assert.equal(await page.evaluate((k) => localStorage.getItem(k), KEY), before, 'the demo saves nothing');
  console.log('PASS demo');
  // race Enzo's line in Time Attack: his demo run is the ghost
  await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  await mode(page, 'Time Attack').click();
  await page.locator('.kp-race-enzo[data-pass="cedar"]').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race && x.race.t > 1, 'the race against Enzo', 40000);
  assert.equal(s.race.mode, 'attack'); assert.ok(s.race.enzo, 'the run is against Enzo\'s line');
  assert.match(await page.locator('.kp-time small').textContent(), /Enzo/);
  console.log('PASS race Enzo\'s line');
  // side jobs: the cake rides alone in a careful delivery
  await page.keyboard.press('Escape'); await waitFor(page, (x) => x.paused, 'paused');
  await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  await mode(page, 'Side Jobs').click();
  assert.equal(await page.locator('.kp-job[data-pass="cedar"]').count(), 3, 'three jobs on an open pass');
  await page.locator('.kp-job[data-job="cake"][data-pass="cedar"]').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race && x.race.t > 0.5, 'the cake job', 40000);
  assert.equal(s.race.job, 'cake'); assert.equal(s.race.buns, 1, 'one cake on the back seat');
  assert.match(await page.locator('.kp-buns small').textContent(), /Cake/);
  console.log('PASS side jobs');
  // drift trials: a scored run in the garage car
  await page.keyboard.press('Escape'); await waitFor(page, (x) => x.paused, 'paused');
  await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  await mode(page, 'Drift Trials').click();
  await page.locator('.kp-pass[data-pass="cedar"]').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race && x.race.t > 0.5, 'a drift trial', 40000);
  assert.equal(s.race.mode, 'trial'); assert.equal(s.race.trial, 0, 'the score starts at nothing');
  assert.match(await page.locator('.kp-trialbox small').textContent(), /gold \d+/);
  console.log('PASS drift trials');
  // weather: a snowy delivery
  await page.keyboard.press('Escape'); await waitFor(page, (x) => x.paused, 'paused');
  await page.locator('.kp-pausecard button', { hasText: 'Quit' }).click();
  await mode(page, 'Delivery Runs').click(); await page.locator('.kp-weather button[data-weather="snow"]').click();
  assert.equal(await page.locator('.kp-weather button[data-weather="snow"]').getAttribute('aria-checked'), 'true');
  await page.locator('.kp-pass[data-pass="cedar"]').click();
  s = await waitFor(page, (x) => x.screen === 'race' && x.race && x.race.t > 0.5, 'a snowy delivery', 40000);
  assert.equal(s.race.weather, 'snow'); assert.match(await page.locator('.kp-time small').textContent(), /Snow/);
  console.log('PASS weather');
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], `no page errors: ${errors.join(' | ')}`);
console.log('pass e2e: all good');
