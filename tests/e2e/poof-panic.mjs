import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000', KEY = 'poof-panic-v1';
const browser = await chromium.launch();
const errors = [];
const hook = (p, fn) => p.evaluate(`(${fn})(window.__poof())`);
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), KEY);
const watch = (p) => { p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); };
/** Waits out "Ready" so the pair is in play. */
const inPlay = (p) => p.waitForFunction(() => { const g = window.__poof().game, b = g.match?.a ?? g.endless?.board ?? g.drill?.board; return b && b.phase === 'fall' && g.count === 0; });
/** Ends the round as soon as the next pair is due, by filling the third column with dust to the top. */
const bury = (p, side) => hook(p, `t => { for (let y = 0; y < 12; y++) t.game.match.${side}.grid[y * 6 + 2] = 9; }`);

try {
  await mkdir('.checks/poof-panic', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 29);
  assert.match(await menu.locator('a.arcade-card[href="/poof"]').textContent(), /Poof Panic/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.setDefaultTimeout(30000);
  watch(page);
  await page.goto(`${base}/poof`);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();

  // Home: a fresh start, with the hard ladder shut.
  await page.getByTestId('ladder').waitFor();
  assert.ok(await page.getByTestId('hard').isDisabled(), 'the hard ladder is shut at first');
  assert.equal(await page.getByTestId('continue').count(), 0);
  await page.getByTestId('hero-enzo').click();
  assert.equal((await saved(page)).hero, 'enzo');
  await page.getByTestId('hero-dora').click();
  await page.locator('.pp-how summary').click();
  assert.match(await page.locator('.pp-how').textContent(), /one for every 70/);
  await page.screenshot({ path: '.checks/poof-panic/home.png', fullPage: true });

  // The ladder starts with the mole.
  await page.getByTestId('ladder').click();
  assert.match(await page.getByTestId('card-intro').textContent(), /Mossy the Mole/);
  assert.match(await page.getByTestId('label').textContent(), /Ladder · rival 1 of 6/);
  // The rival's portrait sits above its name, not on top of it.
  const [face, name] = await Promise.all([page.locator('.pp-card canvas').boundingBox(), page.locator('.pp-card h2').boundingBox()]);
  assert.ok(face.y + face.height <= name.y + 1, `the portrait ends above the name (${Math.round(face.y + face.height)} v ${Math.round(name.y)})`);
  assert.equal(await hook(page, 't => t.game.match'), null, 'nothing is dealt until Start');
  await page.keyboard.press('Enter');
  await inPlay(page);

  // Keys move, turn and drop the pair.
  const pair = () => hook(page, 't => ({ ...t.game.match.a.pair })');
  assert.deepEqual([(await pair()).x, (await pair()).rot], [2, 0]);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => window.__poof().game.match.a.pair?.x === 1);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.__poof().game.match.a.pair?.x === 3);
  await page.keyboard.press('x');
  await page.waitForFunction(() => window.__poof().game.match.a.pair?.rot === 1);
  await page.keyboard.press('z'); await page.keyboard.press('z');
  await page.waitForFunction(() => window.__poof().game.match.a.pair?.rot === 3);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__poof().game.match.a.placed === 1);
  assert.deepEqual(await hook(page, 't => [t.game.match.a.grid[3] > 0, t.game.match.a.grid[2] > 0]'), [true, true], 'the pair landed flat in the fourth and third columns');
  // Holding a key repeats.
  await inPlay(page);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__poof().game.match.a.pair?.x === 5);
  await page.keyboard.up('ArrowRight');

  // Pausing stops the clock; the landing guide and the sound are remembered.
  await page.keyboard.press('p');
  await page.getByTestId('card-paused').waitFor();
  const tick = await hook(page, 't => t.game.match.tick');
  await page.waitForTimeout(300);
  assert.equal(await hook(page, 't => t.game.match.tick'), tick, 'nothing moves while paused');
  await page.getByTestId('resume').click();
  await page.waitForFunction((n) => window.__poof().game.match.tick > n, tick);
  await page.keyboard.press('g');
  assert.equal((await saved(page)).ghost, false);
  await page.keyboard.press('g');
  await page.keyboard.press('m');
  assert.equal((await saved(page)).muted, true);
  await page.screenshot({ path: '.checks/poof-panic/match.png' });

  // A whole match, played by a strong stand-in on fast forward: rounds, the match card, and on to the next rival.
  await hook(page, 't => { t.auto("cougar"); t.fast(40); }');
  let rounds = 0;
  for (;;) {
    await page.waitForSelector('[data-testid="card-round"], [data-testid="card-match"]', { timeout: 120000 });
    rounds++;
    if (await page.getByTestId('card-match').count()) break;
    assert.match(await page.getByTestId('card-round').textContent(), /Round to|play it again/);
    await page.getByTestId('next-round').click();
    assert.ok(rounds < 8);
  }
  await hook(page, 't => t.fast(1)');
  assert.match(await page.getByTestId('card-match').textContent(), /Mossy is buried!/);
  assert.match(await page.getByTestId('card-match').textContent(), /2 – [01]/);
  let s = await saved(page);
  assert.deepEqual([s.climb.rung, s.far, s.climb.hero, s.chain >= 2, s.climb.score > 0], [1, 1, 'dora', true, true], 'the climb moved up a rung and was saved');
  await page.screenshot({ path: '.checks/poof-panic/match-won.png' });
  await page.getByTestId('next-rival').click();
  assert.match(await page.getByTestId('card-intro').textContent(), /Pongo the Skunk/);
  assert.match(await page.getByTestId('label').textContent(), /rival 2 of 6/);

  // Losing a match keeps you on the same rung.
  await hook(page, 't => t.auto(null)');
  for (let i = 0; i < 2; i++) {
    await page.getByTestId(i ? 'next-round' : 'start').click();
    await inPlay(page);
    await bury(page, 'a');
    await page.keyboard.press('Space');
    await page.waitForSelector(i ? '[data-testid="card-match"]' : '[data-testid="card-round"]');
  }
  assert.match(await page.getByTestId('card-match').textContent(), /Pongo wins the match/);
  s = await saved(page);
  assert.deepEqual([s.climb.rung, s.climb.losses], [1, 1]);
  await page.getByTestId('again').click();
  assert.match(await page.getByTestId('card-intro').textContent(), /Pongo the Skunk/);

  // Back at the menu the climb can be carried on, and a free match offers only the rivals met so far.
  await page.getByTestId('quit').click();
  assert.match(await page.getByTestId('continue').textContent(), /rival 2 of 6: Pongo the Skunk/);
  await page.getByTestId('free').click();
  assert.ok(await page.getByTestId('rival-skunk').isEnabled());
  assert.ok(await page.getByTestId('rival-weasel').isDisabled(), 'the weasel has not been met');
  await page.getByTestId('rival-mole').click();
  assert.match(await page.getByTestId('label').textContent(), /Free match/);
  await page.getByTestId('start').click();
  await inPlay(page);
  assert.equal((await saved(page)).climb.rung, 1, 'a free match leaves the climb alone');
  await page.getByTestId('quit').click();

  // The top of the ladder: beat the cougar and the hard ladder opens.
  await page.evaluate((k) => { const v = JSON.parse(localStorage.getItem(k)); v.climb = { hero: 'dora', hard: false, rung: 5, score: 1000, losses: 2, secs: 600 }; localStorage.setItem(k, JSON.stringify(v)); }, KEY);
  await page.reload();
  await page.getByTestId('continue').click();
  assert.match(await page.getByTestId('card-intro').textContent(), /Sierra the Cougar/);
  for (let i = 0; i < 2; i++) {
    await page.getByTestId(i ? 'next-round' : 'start').click();
    await inPlay(page);
    await bury(page, 'b');
    await page.waitForSelector(i ? '[data-testid="card-done"]' : '[data-testid="card-round"]');
  }
  assert.match(await page.getByTestId('card-done').textContent(), /Top of the ladder!.*hard ladder is now open for Dora/s);
  s = await saved(page);
  assert.deepEqual([s.cleared, s.climb, s.far], [{ dora: 1, enzo: 0 }, null, 5]);
  await page.screenshot({ path: '.checks/poof-panic/ladder-done.png' });
  await page.getByTestId('finish').click();
  assert.ok(await page.getByTestId('hard').isEnabled(), 'the hard ladder is open for Dora');
  await page.getByTestId('hero-enzo').click();
  assert.ok(await page.getByTestId('hard').isDisabled(), 'but not for Enzo');
  await page.getByTestId('hero-dora').click();
  await page.getByTestId('hard').click();
  assert.match(await page.getByTestId('label').textContent(), /Hard ladder · rival 1 of 6/);
  await page.getByTestId('start').click();
  await inPlay(page);
  assert.ok(await hook(page, 't => t.game.rival.think < 40 && t.game.hard'), 'hard rivals think faster');
  await page.getByTestId('quit').click();

  // Endless: play until buried, and the record is kept.
  await page.getByTestId('endless').click();
  assert.match(await page.getByTestId('label').textContent(), /Endless/);
  await inPlay(page);
  await hook(page, 't => { t.auto("skunk"); t.fast(60); }');
  await page.getByTestId('card-over').waitFor({ timeout: 120000 });
  await hook(page, 't => { t.auto(null); t.fast(1); }');
  s = await saved(page);
  assert.ok(s.endless.score > 0 && s.endless.level >= 1, 'the endless record is saved');
  assert.match(await page.getByTestId('card-over').textContent(), new RegExp(`Buried at level ${s.endless.level}`));
  await page.screenshot({ path: '.checks/poof-panic/endless-over.png' });
  await page.getByTestId('again').click();
  await inPlay(page);
  assert.equal(await hook(page, 't => t.game.endless.board.placed'), 0);
  await page.getByTestId('quit').click();
  assert.match(await page.getByTestId('endless').textContent(), new RegExp(`Best ${s.endless.score}`));

  // Lessons: the pair waits, a miss can be retried, and a solved lesson is ticked.
  await page.getByTestId('lessons').click();
  assert.equal(await page.locator('.pp-lessons button').count(), 12);
  await page.getByTestId('lesson-four').click();
  assert.match(await page.getByTestId('lesson-bar').textContent(), /Four of a kind.*Make a 1-chain/s);
  await inPlay(page);
  await page.waitForTimeout(400);
  assert.equal(await hook(page, 't => t.game.drill.board.pair.y'), 11, 'the pair waits at the top');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
  await page.getByTestId('card-missed').waitFor();
  await page.getByTestId('retry-card').click();
  await inPlay(page);
  await page.getByText('Hint').click();
  assert.match(await page.getByTestId('lesson-bar').textContent(), /Put the rose ball next to the three/);
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Space');
  await page.getByTestId('card-solved').waitFor();
  assert.deepEqual((await saved(page)).lessons, ['four']);
  await page.getByTestId('next-lesson').click();
  assert.match(await page.getByTestId('label').textContent(), /Lesson 2 of 12/);
  await inPlay(page);
  await page.keyboard.press('x'); await page.keyboard.press('Space');
  await page.getByTestId('card-solved').waitFor();
  assert.deepEqual((await saved(page)).lessons, ['four', 'split']);
  await page.screenshot({ path: '.checks/poof-panic/lesson.png' });
  await page.close();

  // A phone: drag to move, tap to turn, flick down to drop, and nothing spills off the side.
  const phone = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  phone.setDefaultTimeout(30000);
  watch(phone);
  await phone.goto(`${base}/poof`);
  await phone.getByTestId('ladder').waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the menu fits a phone');
  await phone.getByTestId('ladder').tap();
  await phone.getByTestId('start').tap();
  await inPlay(phone);
  assert.match(await phone.locator('.pp-foot').textContent(), /Drag to move/);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.documentElement.scrollHeight <= window.innerHeight + 1), 'the board fits a phone with no scrolling');
  const lay = await hook(phone, 't => t.stage.lay');
  assert.ok(lay.narrow && lay.a.cell >= 34 && lay.b.cell >= 12, `a big board for you and a small one for the rival (${lay.a.cell}, ${lay.b.cell})`);
  const box = await phone.getByTestId('board').boundingBox(), cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.5;
  const px = () => hook(phone, 't => t.game.match.a.pair && [t.game.match.a.pair.x, t.game.match.a.pair.rot]');
  await phone.touchscreen.tap(box.x + box.width * 0.8, cy);
  await phone.waitForFunction(() => window.__poof().game.match.a.pair?.rot === 1);
  await phone.touchscreen.tap(box.x + box.width * 0.2, cy);
  await phone.waitForFunction(() => window.__poof().game.match.a.pair?.rot === 0);
  const drag = async (dx, dy, steps = 6, wait = 16) => {
    await phone.mouse.move(cx, cy); await phone.mouse.down();
    for (let i = 1; i <= steps; i++) { await phone.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps); await phone.waitForTimeout(wait); }
    await phone.mouse.up();
  };
  await drag(-lay.a.cell * 2.2, 0);
  await phone.waitForFunction(() => window.__poof().game.match.a.pair?.x === 0);
  await drag(lay.a.cell * 4.4, 0);
  await phone.waitForFunction(() => window.__poof().game.match.a.pair?.x >= 4);
  assert.equal((await px())[1], 0, 'a drag does not turn the pair');
  await drag(0, lay.a.cell * 3, 3, 10);
  await phone.waitForFunction(() => window.__poof().game.match.a.placed === 1);
  await phone.screenshot({ path: '.checks/poof-panic/phone.png' });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS poof-panic: menu, home, keys, pause, a whole match, losing, carrying on, free match, the top of the ladder, hard ladder, endless, lessons and phone');
} finally {
  await browser.close();
}
