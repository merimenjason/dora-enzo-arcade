import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const board = (p) => p.getByTestId('board');
const game = (p, fn) => p.evaluate(`(${fn})(window.__tactics())`);
// The canvas draws a 760 × 520 view. tile() mirrors tileCenter() in lib/burrow-tactics-scene.ts.
const tile = (box, x, y) => [box.x + ((380 + (x - y) * 44) / 760) * box.width, box.y + ((124 + (x + y) * 22) / 520) * box.height];
const idle = (p) => p.waitForSelector('[data-testid="board"][data-busy="0"]');
const unit = (p, kind) => game(p, `t => { const u = t.battle.units.find((v) => v.kind === '${kind}'); return [u.x, u.y, u.hp, u.moved, u.acted]; }`);
try {
  await mkdir('.checks/burrow-tactics', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 24);
  assert.match(await menu.locator('a.arcade-card[href="/tactics"]').textContent(), /Burrow Tactics/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/tactics`);
  await page.evaluate(() => { localStorage.removeItem('burrow-tactics-v1'); localStorage.removeItem('burrow-tactics-run-v1'); });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="mission-1"]').disabled);
  assert.ok(await page.getByTestId('mission-2').isDisabled(), 'mission 2 is locked until mission 1 is won');
  assert.equal(await page.locator('.bt-mission').count(), 18, 'ten missions and chapter two');
  assert.ok(await page.getByTestId('mission-11').isDisabled());
  assert.equal(await page.locator('.bt-card.locked').count(), 4, 'four chinchillas still to meet');
  assert.equal(await page.getByTestId('start-run').count(), 0, 'the run is locked');
  await page.screenshot({ path: '.checks/burrow-tactics/home.png', fullPage: true });

  // Mission 1: Dora at (3, 2) and Enzo at (3, 4), a fox beside each.
  await page.getByTestId('mission-1').click();
  await page.waitForSelector('[data-testid="board"][data-state="player"]');
  assert.equal(await page.getByTestId('turn').textContent(), 'TURN1 / 3');
  assert.match(await page.getByTestId('forecast').textContent(), /Dora −1 · Enzo −1/, 'both foxes are about to bite');
  assert.match(await page.getByTestId('hero-dora').getAttribute('class'), /\bon\b/, 'Dora is picked first');
  // The first mission is guided: the coach says what to do and the button to press pulses.
  assert.match(await page.getByTestId('coach').textContent(), /press Seed Shot/);
  assert.match(await page.getByTestId('ability').getAttribute('class'), /pulse/);
  let box = await board(page).boundingBox();
  assert.deepEqual((await unit(page, 'dora')).slice(0, 2), [3, 2]);

  // Move Dora to a blue tile, then take it back.
  await page.mouse.click(...tile(box, 3, 0));
  await idle(page);
  assert.deepEqual((await unit(page, 'dora')).slice(0, 2), [3, 0]);
  assert.equal(await page.getByTestId('hero-dora').getAttribute('data-status'), 'Moved');
  await page.keyboard.press('u'); await page.keyboard.press('u');
  await idle(page);
  assert.deepEqual((await unit(page, 'dora')).slice(0, 4), [3, 2, 3, false], 'the move is undone');

  // Aim the Seed Shot at the fox: the forecast shows the result before the click.
  await page.getByTestId('ability').click();
  assert.equal(await page.getByTestId('ability').getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => /Click the fox to shoot/.test(document.querySelector('[data-testid="coach"]').textContent));
  await page.mouse.move(...tile(box, 4, 2));
  await page.waitForFunction(() => /AFTER THIS ACTION/.test(document.querySelector('[data-testid="forecast"]').textContent));
  assert.match(await page.getByTestId('forecast').textContent(), /Enzo −1$/, 'the pushed fox would miss Dora');
  await page.screenshot({ path: '.checks/burrow-tactics/aim.png' });
  await page.mouse.click(...tile(box, 4, 2));
  await idle(page);
  assert.deepEqual((await unit(page, 'fox')).slice(0, 3), [5, 2, 2], 'the fox took 1 and was pushed back');
  assert.equal(await page.getByTestId('hero-dora').getAttribute('data-status'), 'Can still move', 'Dora is a Scout: she acted without moving');
  await page.waitForFunction(() => /Press Tail Whack/.test(document.querySelector('[data-testid="coach"]').textContent));
  // The hint points at a move and a target for the chinchilla it picks, and changes nothing.
  const beforeHint = await game(page, 't => JSON.stringify(t.battle.units)');
  await page.getByTestId('hint').click();
  await page.waitForSelector('[data-testid="advice"]');
  assert.match(await page.getByTestId('advice').textContent(), /Enzo should .*Tail Whack/);
  assert.equal(await game(page, 't => JSON.stringify(t.battle.units)'), beforeHint);
  await page.screenshot({ path: '.checks/burrow-tactics/hint.png' });
  assert.match(await page.getByTestId('hero-enzo').getAttribute('class'), /\bon\b/, 'the next chinchilla is picked');
  await page.mouse.move(...tile(box, 5, 2));
  await page.waitForFunction(() => /Fox · 2\/3 health/.test(document.querySelector('[data-testid="info"]').textContent));

  // End the turn: the second fox bites Enzo, then both move and aim again.
  await page.getByTestId('end-turn').click();
  await page.waitForSelector('[data-testid="board"][data-turn="2"][data-busy="0"]');
  assert.equal((await unit(page, 'enzo'))[2], 3, 'Enzo was bitten');
  assert.equal(await page.getByTestId('turn').textContent(), 'TURN2 / 3');
  await page.screenshot({ path: '.checks/burrow-tactics/turn-2.png' });

  // Reset the turn works once.
  await page.getByTestId('reset').click();
  await idle(page);
  assert.ok(await page.getByTestId('reset').isDisabled());

  // Leave one weak fox next to Enzo and whack it: the mission is won with three stars.
  await game(page, `t => { const b = t.battle, e = b.units.find((u) => u.kind === 'enzo'), foxes = b.units.filter((u) => u.kind === 'fox'); foxes[0].hp = 0; Object.assign(foxes[1], { hp: 1, x: e.x + 1, y: e.y }); t.stage.sync(b); }`);
  const enzo = await unit(page, 'enzo');
  await page.getByTestId('hero-enzo').click();
  await page.keyboard.press('1');
  await page.mouse.click(...tile(box, enzo[0] + 1, enzo[1]));
  await page.waitForSelector('[data-testid="board"][data-state="won"]');
  await page.waitForSelector('[data-testid="next-mission"]');
  assert.equal(await page.locator('.bt-result-stars .on').count(), 3);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('burrow-tactics-v1')).stars.slice(0, 2)), [3, 0]);
  await page.screenshot({ path: '.checks/burrow-tactics/won.png' });

  // Mission 2 with the keyboard: Tab picks, the arrows move the cursor, Enter moves, E ends the turn.
  await page.getByTestId('next-mission').click();
  await page.waitForSelector('[data-testid="board"][data-state="player"][data-turn="1"]');
  await page.keyboard.press('Tab');
  assert.match(await page.getByTestId('hero-enzo').getAttribute('class'), /\bon\b/);
  const before = (await unit(page, 'enzo')).slice(0, 2);
  await page.keyboard.press('ArrowUp');
  assert.ok((await page.getByTestId('info').textContent()).length > 0);
  await page.keyboard.press('Enter');
  await idle(page);
  assert.deepEqual((await unit(page, 'enzo')).slice(0, 2), [before[0], before[1] - 1], 'Enter moved Enzo to the cursor');
  await page.keyboard.press('e');
  await page.waitForSelector('[data-testid="board"][data-turn="2"][data-busy="0"]');

  // With the campaign won, a run can be started, left and resumed where it was.
  await page.evaluate(() => localStorage.setItem('burrow-tactics-v1', JSON.stringify({ stars: Array(10).fill(3), muted: true })));
  await page.goto(`${base}/tactics`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="mission-11"]').disabled);
  assert.ok(await page.getByTestId('mission-12').isDisabled(), 'chapter two opens one mission at a time');

  // Chapter two: choose where to start, then use a second action.
  await page.getByTestId('mission-11').click();
  await page.waitForSelector('[data-testid="board"][data-state="deploy"]');
  assert.equal(await page.getByTestId('coach').count(), 0, 'only the first mission is guided');
  assert.match(await page.getByTestId('goal').textContent(), /Hold out/);
  box = await board(page).boundingBox();
  await page.getByTestId('hero-enzo').click();
  await page.mouse.click(...tile(box, 3, 0));
  await idle(page);
  assert.deepEqual((await unit(page, 'enzo')).slice(0, 2), [3, 0], 'Enzo starts where he was put');
  await page.mouse.click(...tile(box, 5, 0));
  assert.deepEqual((await unit(page, 'enzo')).slice(0, 2), [3, 0], 'only the home side');
  await page.screenshot({ path: '.checks/burrow-tactics/deploy.png' });
  await page.getByTestId('deploy-ready').click();
  await page.waitForSelector('[data-testid="board"][data-state="player"][data-busy="0"]');
  assert.ok(await game(page, 't => t.battle.preds.every((u) => u.dir >= 0)'), 'the predators have picked their attacks');
  await page.getByTestId('hero-enzo').click();
  assert.equal(await page.getByTestId('ability-2').textContent(), 'Ground Slam2');
  assert.equal(await page.getByTestId('ability-2').count(), 1);
  await game(page, `t => { const b = t.battle, e = b.units.find((u) => u.kind === 'enzo'), f = b.units.find((u) => u.kind === 'fox'); Object.assign(f, { x: e.x + 1, y: e.y, hp: 3 }); t.stage.sync(b); }`);
  await page.keyboard.press('2');
  await page.waitForSelector('.bt-note');
  await page.keyboard.press('Enter');
  await idle(page);
  assert.equal((await unit(page, 'enzo'))[4], true, 'Enzo slammed');
  assert.equal((await unit(page, 'fox'))[2] < 3, true, 'and the fox beside him felt it');
  await page.getByTestId('hero-dora').click();
  assert.equal(await page.getByTestId('ability-2').count(), 0, 'Dora has not learned hers yet');
  await page.goto(`${base}/tactics`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="mission-10"]').disabled);
  assert.equal(await page.locator('.bt-card.locked').count(), 0);
  await page.getByTestId('pick-pip').click();
  assert.ok(await page.getByTestId('start-run').isDisabled(), 'a run needs three chinchillas');
  await page.getByTestId('pick-mochi').click();
  await page.getByTestId('diff-gentle').click();
  assert.equal(await page.getByTestId('diff-gentle').getAttribute('aria-pressed'), 'true');
  await page.getByTestId('start-run').click();
  await page.waitForSelector('[data-testid="board"][data-state="deploy"]');
  assert.deepEqual(await game(page, 't => t.run.squad.map((m) => m.id)'), ['dora', 'enzo', 'mochi']);
  assert.equal(await game(page, 't => t.battle.maxWarren'), 6, 'a gentle run has a warren of 6');
  await page.keyboard.press('e');
  await page.waitForSelector('[data-testid="board"][data-state="player"][data-busy="0"]');
  const seed = await game(page, 't => t.run.seed');
  await page.keyboard.press('e');
  await page.waitForSelector('[data-testid="board"][data-turn="2"][data-busy="0"]');
  const saved = await game(page, 't => JSON.stringify(t.battle.units)');
  await page.screenshot({ path: '.checks/burrow-tactics/run.png' });
  await page.reload();
  await page.getByTestId('continue-run').click();
  await page.waitForSelector('[data-testid="board"][data-turn="2"]');
  assert.equal(await game(page, 't => t.run.seed'), seed);
  assert.equal(await game(page, 't => JSON.stringify(t.battle.units)'), saved, 'the run resumes exactly where it was');

  // Winning a run battle offers three rewards, and picking one starts the next battle.
  await game(page, `t => { const b = t.battle; b.units.forEach((u) => { if (u.side === 'pred') u.hp = 0; }); b.marks = []; b.plan = []; b.state = 'won'; t.stage.sync(b); }`);
  await page.waitForSelector('[data-testid="reward-0"]');
  assert.equal(await page.locator('.bt-rewards button').count(), 3);
  await page.getByTestId('reward-0').click();
  await page.waitForSelector('[data-testid="board"][data-state="deploy"][data-turn="1"]');
  assert.equal(await game(page, 't => t.run.stage'), 1);
  await page.close();

  // A phone: the board fits, and an action needs a second tap.
  const phone = await browser.newPage({ viewport: { width: 390, height: 800 }, hasTouch: true });
  phone.setDefaultTimeout(20000);
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/tactics`);
  await phone.evaluate(() => { localStorage.removeItem('burrow-tactics-v1'); localStorage.removeItem('burrow-tactics-run-v1'); });
  await phone.reload();
  await phone.waitForFunction(() => !document.querySelector('[data-testid="mission-1"]').disabled);
  await phone.getByTestId('mission-1').tap();
  await phone.waitForSelector('[data-testid="board"][data-state="player"]');
  box = await board(phone).boundingBox();
  assert.ok(box.width <= 390 && box.x >= 0, 'the board fits the screen');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
  await phone.getByTestId('ability').tap();
  await phone.touchscreen.tap(...tile(box, 4, 2));
  await phone.waitForSelector('.bt-note');
  assert.match(await phone.locator('.bt-note').textContent(), /Tap again/);
  assert.equal((await unit(phone, 'fox'))[2], 3, 'the first tap only shows the result');
  await phone.touchscreen.tap(...tile(box, 4, 2));
  await idle(phone);
  assert.equal((await unit(phone, 'fox'))[2], 2);
  await phone.screenshot({ path: '.checks/burrow-tactics/phone.png' });
  await phone.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Burrow Tactics: menu, the guided first mission, moving and undo, aiming and forecast, the hint, a won mission, keyboard, choosing where to start, a second action, a saved run on a chosen difficulty and a phone');
} finally {
  await browser.close();
}
