import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DUSK_TURN } from '../../.checks/burrow-barrage-game.js';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
async function check(name, fn) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); }
  finally { await page.close(); }
}
const poofReady = (p) => p.waitForFunction(() => {
  const g = window.__poof().game, b = g.drill?.board ?? g.endless?.board;
  return b?.phase === 'fall' && g.count === 0;
});
const barrageReady = (p) => p.waitForSelector('[data-testid="board"][data-busy="0"]');

try {
  await check('Poof Panic: cancelled tap does not rotate a pair', async (p) => {
    await p.goto(`${base}/poof`);
    await p.getByTestId('lessons').click(); await p.getByTestId('lesson-four').click(); await poofReady(p);
    const board = p.getByTestId('board'), q = await board.boundingBox(), x = q.x + q.width * 0.8, y = q.y + q.height / 2;
    const before = await p.evaluate(() => window.__poof().game.drill.board.pair.rot);
    await p.mouse.move(x, y); await p.mouse.down();
    await board.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y });
    await p.mouse.up(); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.__poof().game.drill.board.pair.rot), before);
    await p.touchscreen.tap(x, y);
    await p.waitForFunction((rot) => window.__poof().game.drill.board.pair.rot === (rot + 1) % 4, before);
  });
  await check('Poof Panic: cancelled downward flick does not drop a pair', async (p) => {
    await p.goto(`${base}/poof`);
    await p.getByTestId('lessons').click(); await p.getByTestId('lesson-four').click(); await poofReady(p);
    const board = p.getByTestId('board'), q = await board.boundingBox(), x = q.x + q.width / 2, y = q.y + q.height * 0.2;
    const dy = await p.evaluate(() => Math.max(18, window.__poof().stage.lay.a.cell * 0.85) * 3);
    await p.mouse.move(x, y); await p.mouse.down();
    await board.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y + dy });
    await board.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', clientX: x, clientY: y + dy });
    await p.mouse.up(); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.__poof().game.drill.board.placed), 0);
    assert.ok(await p.evaluate(() => !window.__poof().pad.poll().soft), 'soft drop was released');
  });
  await check('Poof Panic: losing focus pauses and releases held controls', async (p) => {
    await p.goto(`${base}/poof`); await p.getByTestId('endless').click(); await poofReady(p);
    await p.keyboard.down('ArrowLeft');
    await p.waitForFunction(() => window.__poof().game.endless.board.pair.x < 2);
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.equal(await p.evaluate(() => window.__poof().card), 'paused');
    const tick = await p.evaluate(() => window.__poof().game.endless.board.tick);
    await p.waitForTimeout(150);
    assert.equal(await p.evaluate(() => window.__poof().game.endless.board.tick), tick);
    await p.keyboard.up('ArrowLeft'); await p.getByTestId('resume').click();
    const x = await p.evaluate(() => window.__poof().game.endless.board.pair.x);
    await p.waitForTimeout(180);
    assert.equal(await p.evaluate(() => window.__poof().game.endless.board.pair.x), x);
    await p.keyboard.press('ArrowRight');
    await p.waitForFunction((n) => window.__poof().game.endless.board.pair.x > n, x);
  });
  await check('Burrow Barrage: cancelled walking press releases the control', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('start-duel').click(); await barrageReady(p);
    const button = p.getByTestId('walk-right'), q = await button.boundingBox();
    await p.mouse.move(q.x + q.width / 2, q.y + q.height / 2); await p.mouse.down();
    await button.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' });
    const moved = await p.evaluate(() => window.__barrage().match.active.moved);
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => window.__barrage().match.active.moved), moved);
    await p.mouse.up();
  });
  await check('Burrow Barrage: a held key does not walk the next player', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('start-duel').click(); await barrageReady(p);
    await p.keyboard.down('ArrowRight'); await p.getByTestId('skip').click(); await p.keyboard.press('Enter'); await barrageReady(p);
    await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => window.__barrage().match.active.moved), 0);
    await p.keyboard.up('ArrowRight');
    await p.keyboard.press('ArrowRight');
    assert.ok(await p.evaluate(() => window.__barrage().match.active.moved > 0));
  });
  await check('Burrow Barrage: arrow keys adjust a focused slider without walking', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('start-duel').click(); await barrageReady(p);
    const angle = await p.getByTestId('angle').inputValue();
    await p.getByTestId('angle').focus(); await p.keyboard.press('ArrowRight');
    assert.equal(await p.evaluate(() => window.__barrage().match.active.moved), 0);
    assert.notEqual(await p.getByTestId('angle').inputValue(), angle);
  });
  await check('Burrow Barrage: charging starts at zero and focus loss cancels the shot', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('start-duel').click(); await barrageReady(p);
    const power = await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); return window.__barrage().match.active.power; });
    assert.equal(power, 0, 'the power resets during the key press, before the next animation frame');
    await p.waitForFunction(() => window.__barrage().match.active.power >= 10);
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    await p.keyboard.up(' '); await p.waitForTimeout(200);
    assert.equal(await p.evaluate(() => window.__barrage().match.turn), 1, 'a cancelled charge does not fire');
  });
  await check('Burrow Barrage: victory is saved before the animation finishes', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('ladder-1').click(); await barrageReady(p);
    // Stage a last-turn dusk win, then resolve it through the actual Skip button.
    await p.evaluate((turn) => { const m = window.__barrage().match; m.turn = turn; for (const u of m.units) if (u.team === 1) u.hp = 1; }, DUSK_TURN);
    await p.getByTestId('skip').click();
    assert.equal(await p.evaluate(() => window.__barrage().match.state), 'over');
    assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('burrow-barrage-v1') ?? '{}').stars?.[0] > 0));
    await p.getByTestId('menu').click(); await p.reload();
    await p.waitForFunction(() => !document.querySelector('[data-testid="ladder-1"]').disabled);
    assert.ok(await p.getByTestId('ladder-2').isEnabled());
  });
  await check('Burrow Barrage: an AI-resolved victory preserves current sound settings', async (p) => {
    await p.goto(`${base}/barrage`); await p.getByTestId('ladder-1').click(); await barrageReady(p);
    await p.getByRole('button', { name: 'Sound on · M', exact: true }).click();
    await p.getByTestId('skip').click();
    await p.evaluate((turn) => { const m = window.__barrage().match; m.turn = turn; for (const u of m.units) if (u.team === 1) { u.hp = 1; u.items = []; } }, DUSK_TURN);
    await p.waitForFunction(() => window.__barrage().match.state === 'over');
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('burrow-barrage-v1')));
    assert.ok(saved.stars[0] > 0); assert.equal(saved.muted, true);
  });
  await check('Burrow Tactics: mission victory survives leaving during the animation', async (p) => {
    await p.goto(`${base}/tactics`); await p.getByTestId('mission-1').click();
    await p.waitForSelector('[data-testid="board"][data-busy="0"]');
    await p.evaluate(() => { const b = window.__tactics().battle; b.turns = b.turn; for (const u of b.preds) u.hp = 0; b.marks = []; b.plan = []; });
    await p.getByTestId('end-turn').click();
    assert.equal(await p.evaluate(() => window.__tactics().battle.state), 'won');
    assert.ok(await p.evaluate(() => JSON.parse(localStorage.getItem('burrow-tactics-v1') ?? '{}').stars?.[0] > 0));
    await p.getByRole('button', { name: 'Menu', exact: true }).click(); await p.reload();
    await p.waitForFunction(() => !document.querySelector('[data-testid="mission-1"]').disabled);
    assert.ok(await p.getByTestId('mission-2').isEnabled());
  });
  await check('Burrow Tactics: a run reward survives reload and is banked once', async (p) => {
    await p.goto(`${base}/tactics`);
    await p.getByTestId('mission-1').waitFor();
    await p.evaluate(() => localStorage.setItem('burrow-tactics-v1', JSON.stringify({ stars: Array.from({ length: 18 }, (_, i) => i < 5 ? 1 : 0) })));
    await p.reload(); await p.getByTestId('start-run').click();
    await p.getByTestId('deploy-ready').click();
    await p.waitForSelector('[data-testid="board"][data-busy="0"]');
    await p.evaluate(() => { const b = window.__tactics().battle; b.turns = b.turn; for (const u of b.preds) u.hp = 0; b.marks = []; b.plan = []; b.stats.kills = 2; });
    await p.getByTestId('end-turn').click();
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('burrow-tactics-run-v2')));
    assert.equal(saved.phase, 'reward'); assert.equal(saved.kills, 2); assert.ok(saved.choices.length > 0);
    await p.reload(); await p.getByTestId('continue-run').click();
    await p.getByTestId('reward-0').waitFor();
    const resumed = await p.evaluate(() => window.__tactics().run);
    assert.equal(resumed.kills, 2); assert.deepEqual(resumed.choices, saved.choices);
    await p.getByTestId('reward-0').click();
    assert.equal(await p.evaluate(() => window.__tactics().run.stage), 1);
  });
  await check('Summit Shuffle: hero introduction explains the separate card pools', async (p) => {
    await p.goto(`${base}/summit`); await p.getByTestId('start').waitFor();
    assert.match(await p.getByRole('heading', { name: /Who climbs/ }).textContent(), /cards of their own/);
  });
  for (const [route, start] of [['tactics', 'mission-1'], ['barrage', 'start-duel'], ['summit', 'start'], ['poof', 'endless']]) {
    await check(`${route}: portrait and landscape layouts fit narrow screens`, async (p) => {
      await p.goto(`${base}/${route}`); await p.getByTestId(start).click();
      if (route === 'summit') await p.locator('.ss-node.open').first().click();
      for (const [width, height] of [[320, 568], [568, 320], [390, 844], [844, 390]]) {
        await p.setViewportSize({ width, height }); await p.waitForTimeout(150);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}×${height}: no horizontal overflow`);
        const board = await p.getByTestId('board').boundingBox();
        assert.ok(board.width > 0 && board.height > 0 && board.x >= -1 && board.x + board.width <= width + 1, `${width}×${height}: the canvas fits`);
        if (route === 'summit') {
          const last = p.getByTestId('hand').locator('.ss-card').last();
          await last.scrollIntoViewIfNeeded();
          const card = await last.boundingBox();
          assert.ok(card.x >= -1 && card.x + card.width <= width + 1, `${width}×${height}: the last card can be reached`);
        }
      }
    });
  }
  assert.deepEqual(errors, [], 'no browser errors');
  assert.deepEqual(failures, [], 'newest-game regressions');
} finally { await browser.close(); }
