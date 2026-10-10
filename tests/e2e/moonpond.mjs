import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
async function check(name, fn, view = { width: 1280, height: 860 }) {
  const page = await browser.newPage({ viewport: view, hasTouch: true });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const m = window.__moonpond?.(); return m ? { s: m.game.state, cast: m.game.cast, charge: m.game.charge, loss: m.game.loss, paused: m.paused, focus: document.activeElement?.dataset?.testid, save: localStorage.getItem('moonpond-v1')?.slice(0, 200) } : null; }).catch(() => null))); const at = /moonpond\.mjs:(\d+)/.exec(e.stack ?? '')?.[1]; failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name} (line ${at}): ${e.message}`); }
  finally { await page.close(); }
}
/** Runs a function against the running game. */
const game = (page, fn, arg) => page.evaluate(`(${fn})(window.__moonpond().game, ${JSON.stringify(arg ?? null)})`);
const state = (page) => page.evaluate(() => { const g = window.__moonpond().game; return { state: g.state, cast: g.cast, charge: g.charge, aim: g.aim, shells: g.shells, found: g.found, night: g.night, loss: g.loss, zone: g.bob?.zone, paused: window.__moonpond().paused }; });
const until = (page, want) => page.waitForFunction((s) => window.__moonpond().game.state === s, want);
const fresh = async (page) => { await page.goto(`${base}/moonpond`); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByTestId('start').click(); await page.getByTestId('pond').waitFor(); };
/** Casts with the keyboard and waits for the bobber to settle. A gentle creature is put on the line so the reel is not the thing under test. */
const castOut = async (page, easy = 'reed-skipper') => {
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.__moonpond().game.charge > 0.35); await page.keyboard.up('Space'); await until(page, 'waiting');
  if (easy) await game(page, '(g, id) => { g.bite.id = id; g.bite.size = 6; g.bite.nibbles = []; g.bite.at = Math.min(g.bite.at, g.clock + 0.9); }', easy);
};
/** Waits until a catch or a loss has been on screen long enough to be dismissed. */
const settled = (page) => page.waitForFunction(() => window.__moonpond().game.clock > 0.75);
const stored = (page) => page.evaluate(() => ({ profile: JSON.parse(localStorage.getItem('moonpond-v1') || 'null'), night: JSON.parse(localStorage.getItem('moonpond-night-v1') || 'null') }));

await check('the arcade lists Moonpond as its thirty-first game', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 31);
  await page.locator('.arcade-card[href="/moonpond"]').click(); await page.waitForURL('**/moonpond');
  await page.getByTestId('start').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0, 'nothing to continue on a first visit');
});

await check('a whole cast with the keyboard: throw, bite, reel, sketch', async (page) => {
  await fresh(page);
  let s = await state(page); assert.equal(s.state, 'ready'); assert.equal(s.cast, 0);
  // A tap too light to be a cast does nothing.
  await page.keyboard.down('Space'); await page.keyboard.up('Space'); await page.waitForTimeout(250);
  s = await state(page); assert.equal(s.state, 'ready'); assert.equal(s.cast, 0);
  // Aim, then charge and throw.
  await page.keyboard.down('ArrowRight'); await page.waitForFunction(() => window.__moonpond().game.aim > 0.2); await page.keyboard.up('ArrowRight');
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.__moonpond().game.charge > 0.3);
  assert.equal((await state(page)).state, 'charging'); assert.match(await page.getByTestId('hint').textContent(), /Let go/);
  await page.keyboard.up('Space'); await until(page, 'waiting');
  s = await state(page); assert.ok(['reeds', 'lily', 'open'].includes(s.zone), `the lure lands in water the first rod reaches (${s.zone})`);
  const where = await page.evaluate(() => { const m = window.__moonpond(), b = m.pond.inspect(m.game).bob, box = document.querySelector('[data-testid=pond]').getBoundingClientRect(); return { b, w: box.width, h: box.height }; });
  assert.ok(where.b.x > 0 && where.b.x < where.w && where.b.y > where.h * 0.3 && where.b.y < where.h * 0.9, 'the bobber is drawn on the water');
  await game(page, '(g) => { g.bite.id = "reed-skipper"; g.bite.size = 8.5; g.bite.nibbles = []; g.bite.at = g.clock + 0.8; }');
  await page.waitForFunction(() => window.__moonpond().game.biting);
  assert.equal(await page.getByTestId('hint').textContent(), 'Now!'); assert.equal(await page.getByTestId('act').textContent(), 'Hook!');
  await page.keyboard.down('Space'); await until(page, 'hooked'); await until(page, 'landed');
  // The sketch is in the journal and on disk before the card is dismissed.
  const save = await stored(page);
  assert.equal(save.profile.journal['reed-skipper'].n, 1, 'the catch is saved the moment it lands'); assert.equal(save.night.cast, 1);
  await page.keyboard.up('Space');
  // The catch is lifted out and held up, the two friends hop, and the card pops in.
  let seen = await page.evaluate(() => { const m = window.__moonpond(); return m.pond.inspect(m.game); });
  assert.equal(seen.holding, 'reed-skipper'); assert.ok(seen.hop > 0, 'they hop for a catch');
  assert.equal(await page.getByTestId('catch').evaluate((el) => getComputedStyle(el).animationName), 'mp-pop');
  const card = page.getByTestId('catch'); assert.match(await card.textContent(), /Reed Skipper/); assert.match(await card.textContent(), /New sketch/); assert.match(await card.textContent(), /8\.5 cm/);
  s = await state(page); assert.ok(s.shells > 0); assert.equal(await page.getByTestId('shells').locator('strong').textContent(), String(s.shells));
  assert.equal(await page.getByTestId('oil').locator('i[data-spent=true]').count(), 1);
  await settled(page); await page.keyboard.press('Space'); await until(page, 'ready');
  seen = await page.evaluate(() => { const m = window.__moonpond(); return m.pond.inspect(m.game); });
  assert.equal(seen.holding, null); assert.equal(seen.releasing, 'reed-skipper', 'let go, it dives back in');
  await page.waitForFunction(() => { const m = window.__moonpond(); return m.pond.inspect(m.game).releasing === null; });
  await page.getByTestId('catch').waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('angler-enzo').isDisabled(), true, 'the angler is fixed after the first cast');
});

await check('nibbles, misses and a snapped line are explained', async (page) => {
  await fresh(page);
  await castOut(page, null);
  await game(page, '(g) => { g.bite.nibbles = [g.clock + 0.5]; g.bite.at = g.clock + 3; }');
  await page.waitForFunction(() => window.__moonpond().game.nibbling); await page.keyboard.press('Space'); await until(page, 'lost');
  assert.equal((await state(page)).loss, 'early'); assert.match(await page.getByTestId('lost').textContent(), /only a nibble/);
  await settled(page); await page.keyboard.press('Space'); await until(page, 'ready');
  await castOut(page); await until(page, 'lost'); assert.equal((await state(page)).loss, 'missed');
  await settled(page); await page.keyboard.press('Space'); await until(page, 'ready');
  await castOut(page, 'old-mossback'); await page.waitForFunction(() => window.__moonpond().game.biting);
  await page.keyboard.down('Space'); await until(page, 'lost'); await page.keyboard.up('Space');
  assert.equal((await state(page)).loss, 'snapped'); assert.match(await page.getByTestId('lost').textContent(), /snapped/);
  assert.equal((await stored(page)).night.cast, 3, 'lost casts are saved too');
});

await check('an interrupted touch casts nothing; a hidden tab pauses and saves', async (page) => {
  await fresh(page);
  const pond = page.getByTestId('pond'), box = await pond.boundingBox();
  await pond.dispatchEvent('pointerdown', { pointerId: 7, button: 0, clientX: box.x + box.width * 0.8, clientY: box.y + box.height * 0.5, bubbles: true });
  await page.waitForFunction(() => window.__moonpond().game.charge > 0.2);
  assert.ok((await state(page)).aim > 0.5, 'touching the right of the pond aims right');
  await pond.dispatchEvent('pointercancel', { pointerId: 7, bubbles: true }); await page.waitForTimeout(150);
  let s = await state(page); assert.equal(s.state, 'ready'); assert.equal(s.cast, 0, 'a cancelled touch does not cast');
  // A held touch released normally does.
  await pond.dispatchEvent('pointerdown', { pointerId: 8, button: 0, clientX: box.x + box.width * 0.3, clientY: box.y + box.height * 0.5, bubbles: true });
  await page.waitForFunction(() => window.__moonpond().game.charge > 0.4); await pond.dispatchEvent('pointerup', { pointerId: 8, bubbles: true }); await until(page, 'waiting');
  assert.ok((await state(page)).aim < -0.3);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByTestId('resume').waitFor(); s = await state(page); assert.equal(s.paused, true);
  const clock = await game(page, '(g) => g.clock'); await page.waitForTimeout(400); assert.equal(await game(page, '(g) => g.clock'), clock, 'nothing moves while paused');
  assert.ok((await stored(page)).profile, 'leaving the tab saves');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  await page.getByTestId('resume').click(); await page.waitForFunction((c) => window.__moonpond().game.clock > c, clock);
  // P pauses too.
  await page.keyboard.press('KeyP'); await page.getByTestId('resume').waitFor(); await page.keyboard.press('KeyP'); await page.getByTestId('resume').waitFor({ state: 'detached' });
});

await check('the hold button casts, hooks and reels', async (page) => {
  await fresh(page);
  const act = page.getByTestId('act'), box = await act.boundingBox(), at = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(...at); await page.mouse.down(); await page.waitForFunction(() => window.__moonpond().game.charge > 0.4); await page.mouse.up(); await until(page, 'waiting');
  await game(page, '(g) => { g.bite.id = "pad-minnow"; g.bite.size = 5; g.bite.nibbles = []; g.bite.at = g.clock + 0.6; }');
  await page.waitForFunction(() => window.__moonpond().game.biting); await page.mouse.down(); await until(page, 'landed'); await page.mouse.up();
  assert.match(await page.getByTestId('catch').textContent(), /Pad Minnow/);
  // Focused, it also answers to Space and Enter.
  await settled(page); await act.focus(); await page.keyboard.press('Enter'); await until(page, 'ready');
  await page.keyboard.down('Space'); await page.waitForFunction(() => window.__moonpond().game.charge > 0.3); await page.keyboard.up('Space'); await until(page, 'waiting');
}, { width: 390, height: 844 });

await check('journal, bait shop and requests', async (page) => {
  await fresh(page);
  await game(page, '(g) => { g.journal["clover-carp"] = { n: 3, best: 41.5, stars: 3 }; g.shells = 130; }'); await page.keyboard.press('KeyM'); await page.keyboard.press('KeyM');
  await page.keyboard.press('KeyJ'); const journal = page.getByTestId('journal-panel'); await journal.waitFor();
  assert.equal(await journal.locator('.mp-page').count(), 40); assert.equal(await journal.locator('.mp-page[data-known=true]').count(), 1);
  await page.getByTestId('page-clover-carp').click(); let entry = await page.getByTestId('entry').textContent();
  assert.match(entry, /Clover Carp/); assert.match(entry, /41\.5 cm/); assert.match(entry, /lily pads/); assert.match(entry, /clover knot/);
  await page.getByTestId('page-moon-koi').click(); entry = await page.getByTestId('entry').textContent();
  assert.match(entry, /\?\?\?/); assert.match(entry, /full moon/); assert.doesNotMatch(entry, /Moon Koi/, 'an unfound page keeps its name');
  // The pond holds still while a panel is open.
  const time = await game(page, '(g) => g.time'); await page.waitForTimeout(300); assert.equal(await game(page, '(g) => g.time'), time);
  await page.keyboard.press('Escape'); await journal.waitFor({ state: 'detached' });
  await page.getByTestId('shop').click(); await page.getByTestId('shop-panel').waitFor();
  assert.equal(await page.getByTestId('buy-rod').isEnabled(), true); assert.equal(await page.getByTestId('buy-dust').isEnabled(), true); assert.equal(await page.getByTestId('buy-spyglass').isEnabled(), true);
  await page.getByTestId('buy-rod').click(); await page.getByTestId('buy-clover').click();
  const s = await state(page); assert.equal(s.shells, 30); assert.equal(await page.getByTestId('buy-dust').isDisabled(), true, 'not enough shells left for dust');
  assert.equal(await page.getByTestId('buy-clover').textContent(), 'Owned');
  const save = await stored(page); assert.equal(save.profile.up.rod, 1); assert.deepEqual(save.profile.lures, ['glow', 'clover']); assert.equal(save.profile.shells, 30);
  await page.getByTestId('close').click();
  await page.getByTestId('lure-clover').click(); assert.equal(await page.getByTestId('lure-clover').getAttribute('aria-pressed'), 'true'); assert.equal(await page.getByTestId('lure-dust').isDisabled(), true);
  await page.getByTestId('angler-enzo').click(); assert.equal(await game(page, '(g) => g.angler'), 'enzo');
  await page.getByTestId('board').click(); assert.equal(await page.getByTestId('board-panel').locator('li').count(), 3);
  await page.getByTestId('close').click();
  // The sound switch is remembered.
  await page.getByTestId('mute').click(); assert.equal(await page.evaluate(() => localStorage.getItem('moonpond-sound-v1')), 'off');
});

await check('a night ends at dawn, and the journal is kept across a reload', async (page) => {
  await fresh(page);
  await castOut(page); await page.waitForFunction(() => window.__moonpond().game.biting); await page.keyboard.down('Space'); await until(page, 'landed'); await page.keyboard.up('Space');
  await settled(page); await page.keyboard.press('Space'); await until(page, 'ready');
  // Reload in the middle of the night.
  await castOut(page); await page.reload();
  const again = page.getByTestId('continue'); assert.match(await again.textContent(), /night 1, 1\/40/); await again.click(); await page.getByTestId('pond').waitFor();
  let s = await state(page); assert.equal(s.state, 'ready'); assert.equal(s.cast, 1, 'the cast that was in the water is taken again'); assert.equal(s.found, 1);
  // Starting over asks first.
  await page.getByTestId('menu').click(); await page.getByTestId('new').click(); assert.ok(await page.getByTestId('new-sure').isVisible());
  await page.getByText('Keep my journal').click(); await page.getByTestId('continue').click(); await page.getByTestId('pond').waitFor();
  // Last cast of the night.
  await game(page, '(g) => { g.cast = g.casts - 1; g.tonight.lost = g.casts - 2; }');
  await castOut(page); await until(page, 'lost'); await settled(page); await page.keyboard.press('Space'); await until(page, 'dawn');
  const dawn = page.getByTestId('dawn'); assert.match(await dawn.textContent(), /First light/); assert.match(await dawn.textContent(), /1 sketched and let go/);
  assert.equal((await stored(page)).night.dawn, true);
  await page.reload(); await page.getByTestId('continue').click(); await page.getByTestId('dawn').waitFor();
  await page.getByTestId('next-night').click(); await until(page, 'ready');
  s = await state(page); assert.equal(s.night, 2); assert.equal(s.cast, 0); assert.match(await page.getByTestId('sky').textContent(), /Night 2/); assert.match(await page.getByTestId('sky').textContent(), /Waxing crescent/);
  assert.equal(await page.getByTestId('angler-enzo').isEnabled(), true, 'a new night lets you choose the angler again');
  assert.equal((await stored(page)).profile.night, 2);
});

await check('a full journal ends the game and frees the weather', async (page) => {
  await fresh(page);
  await game(page, '(g) => { for (const id of ["ink-eel", "crescent-carp", "old-mossback"]) g.journal[id] = { n: 1, best: 60, stars: 1 }; }');
  await castOut(page, null);
  await game(page, '(g) => { g.bite.nibbles = []; g.bite.at = g.clock + 30; }');
  // Fill every page but the one on the line, then land it as the last cast of the night.
  await page.getByTestId('journal').click(); const ids = await page.locator('.mp-page').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(5))); await page.getByTestId('close').click();
  assert.equal(ids.length, 40);
  await game(page, '(g, ids) => { g.bite.id = "reed-skipper"; g.bite.size = 5; for (const id of ids) if (id !== "reed-skipper") g.journal[id] ??= { n: 1, best: 0, stars: 1 }; g.cast = g.casts - 1; g.tonight.lost = g.casts - 1; g.bite.at = g.clock + 0.6; }', ids);
  await page.waitForFunction(() => window.__moonpond().game.biting); await page.keyboard.down('Space'); await until(page, 'landed'); await page.keyboard.up('Space');
  assert.equal(await game(page, '(g) => g.complete'), true);
  await settled(page); await page.keyboard.press('Space'); await until(page, 'dawn');
  assert.match(await page.getByTestId('dawn').textContent(), /The journal is full/);
  await page.getByTestId('weather').selectOption('fireflies'); await page.getByTestId('next-night').click(); await until(page, 'ready');
  assert.equal(await game(page, '(g) => g.weather'), 'fireflies'); assert.match(await page.getByTestId('sky').textContent(), /firefly night/);
});

await check('reduced motion holds the water still but the game still plays', async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await fresh(page);
  const clock = await page.evaluate(() => window.__moonpond().pond.clock); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__moonpond().pond.clock), clock);
  await castOut(page); await page.waitForFunction(() => window.__moonpond().game.biting); await page.keyboard.down('Space'); await until(page, 'landed'); await page.keyboard.up('Space');
  const still = await page.evaluate(() => { const m = window.__moonpond(); return m.pond.inspect(m.game); });
  assert.equal(still.holding, 'reed-skipper', 'the catch is still shown'); assert.equal(still.fx, 0, 'with no splashes or sparks'); assert.equal(still.hop, 0);
  assert.equal(await page.getByTestId('catch').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.getByTestId('oil').locator('i').first().evaluate((el) => getComputedStyle(el).animationName), 'none');
  await settled(page); await page.keyboard.press('Space'); await until(page, 'ready');
  assert.equal(await page.evaluate(() => { const m = window.__moonpond(); return m.pond.inspect(m.game).releasing; }), null);
});

for (const [width, height] of [[320, 568], [390, 844], [568, 320], [844, 390], [820, 1180], [1366, 768], [1920, 1080]]) {
  await check(`layout at ${width}×${height}`, async (page) => {
    await fresh(page);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling');
    const pond = await page.getByTestId('pond').boundingBox(), act = await page.getByTestId('act').boundingBox();
    assert.ok(pond.width >= 280 && pond.height >= 170, `the pond is a usable size (${Math.round(pond.width)}×${Math.round(pond.height)})`);
    assert.ok(pond.y >= 0 && pond.y + pond.height <= height + 1, 'the whole pond is on screen');
    assert.ok(act.y + act.height <= height + 1 && act.height >= 38, 'the hold button is on screen without scrolling');
    for (const id of ['journal', 'shop', 'board', 'pause', 'menu']) { const b = await page.getByTestId(id).boundingBox(); assert.ok(b && b.x >= 0 && b.x + b.width <= width + 1, `${id} fits`); }
    await page.getByTestId('journal').scrollIntoViewIfNeeded(); await page.getByTestId('journal').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the journal fits too'); await page.getByTestId('close').click();
    await page.screenshot({ path: `.checks/moonpond/layout-${width}x${height}.png` });
  }, { width, height });
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
if (failures.length) { console.error(`\n${failures.length} Moonpond check(s) failed`); process.exit(1); }
console.log('PASS Moonpond: menu entry, keyboard and touch casts, nibbles and losses, interrupted input, pause and hidden tab, journal, shop, requests, dawn, reloads, the ending, reduced motion and seven layouts.');
