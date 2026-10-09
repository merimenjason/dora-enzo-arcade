import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
async function check(name, fn, view = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport: view, hasTouch: true });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.error(`FAIL ${name}: ${e.message}`); }
  finally { await page.close(); }
}
/** Runs `stage` on the page, lets the game loop draw `frames` more times, and returns what `read` sees: nothing in between waits on the page's own redraw. */
const afterFrames = (p, stage, read, frames = 3) => p.evaluate(async ([s, r, n]) => {
  (0, eval)(`(${s})`)();
  for (let i = 0; i < n; i++) await new Promise((done) => requestAnimationFrame(done));
  return (0, eval)(`(${r})`)();
}, [String(stage), String(read), frames]);
/** Tells the page its tab was hidden, the way a phone does when another app comes forward. */
const hideTab = (p) => p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
const clash = async (p) => {
  await p.goto(`${base}/clash`);
  await p.waitForFunction(() => !document.querySelector('[data-testid="battle-beige"]').disabled);
  await p.getByTestId('battle-beige').click();
  await p.waitForSelector('[data-testid="arena"][data-state="playing"]');
};
const maze = async (p) => {
  await p.goto(`${base}/hay-maze`);
  await p.waitForFunction(() => !document.querySelector('[data-testid="begin"]').disabled);
  await p.getByTestId('begin').click(); await p.getByTestId('board').waitFor();
};
const zombies = async (p) => {
  await p.goto(`${base}/chinchillas-vs-zombies`);
  await p.waitForFunction(() => !document.querySelector('[data-testid="level-1"]').disabled);
  await p.getByTestId('level-1').click();
  await p.waitForSelector('[data-testid="lawn"][data-state="playing"]');
};

try {
  await check('Chinchilla Clash: a win is saved in the frame the battle ends', async (p) => {
    await clash(p);
    const saved = await afterFrames(p, () => { window.__clash().tower(1, 'king').hp = 0; }, () => [window.__clash().state, JSON.parse(localStorage.getItem('chinchilla-clash-v1') ?? '{}')]);
    assert.equal(saved[0], 'over');
    assert.equal(saved[1].beaten, 1); assert.equal(saved[1].wins, 1); assert.equal(saved[1].threeCrowns, 1);
    await p.waitForSelector('[data-testid="arena"][data-state="over"]'); await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => JSON.parse(localStorage.getItem('chinchilla-clash-v1')).wins), 1, 'the win is counted once');
  });
  await check('Chinchilla Clash: a cancelled drag does not drop the card later', async (p) => {
    await clash(p);
    await p.evaluate(() => { window.__clash().dust[0] = 10; });
    const before = await p.evaluate(() => window.__clash().played[0]);
    const card = await p.getByTestId('hand-0').boundingBox(), arena = await p.getByTestId('arena').boundingBox();
    await p.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await p.mouse.down();
    await p.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
    await p.mouse.move(arena.x + arena.width / 2, arena.y + arena.height * 0.75, { steps: 6 });
    await p.mouse.up(); await p.waitForTimeout(100);
    assert.equal(await p.evaluate(() => window.__clash().played[0]), before);
    // A whole drag still plays the card.
    await p.mouse.move(card.x + card.width / 2, card.y + card.height / 2); await p.mouse.down();
    await p.mouse.move(arena.x + arena.width / 2, arena.y + arena.height * 0.75, { steps: 6 });
    await p.mouse.up();
    await p.waitForFunction((n) => window.__clash().played[0] === n + 1, before);
  });
  await check('Chinchilla Clash: a hidden tab stops the clock', async (p) => {
    await clash(p); await hideTab(p);
    await p.waitForSelector('[data-testid="arena"][data-state="paused"]');
  });
  await check('Hay Maze Defence: how far a run got is saved in the frame it ends', async (p) => {
    await maze(p);
    const saved = await afterFrames(p, () => {
      const r = window.__maze(), b = r.battle;
      r.level = 2; r.flame = 1; b.plan[b.wave] = [['weasel', 3, 0.3]]; b.sendWave();
      for (let i = 0; i < 60 * 60 && r.state === 'battle'; i++) b.update(1 / 60);
    }, () => [window.__maze().state, JSON.parse(localStorage.getItem('hay-maze-v2') ?? '{}'), localStorage.getItem('hay-maze-run-v1')]);
    assert.equal(saved[0], 'lost');
    assert.equal(saved[1].best, 2); assert.equal(saved[1].runs, 1); assert.equal(saved[1].wins, 0);
    await p.waitForSelector('[data-testid="board"][data-state="lost"]');
  });
  await check('Hay Maze Defence: a hidden tab pauses the wave and keeps the run', async (p) => {
    await maze(p);
    await p.evaluate(() => { window.__maze().battle.sendWave(); });
    await p.waitForFunction(() => window.__maze().battle.phase === 'wave');
    await hideTab(p);
    assert.equal(await p.evaluate(() => window.__maze().battle.paused), true);
    assert.ok(await p.evaluate(() => localStorage.getItem('hay-maze-run-v1')), 'the run is written');
  });
  await check('Chinchillas vs Zombies: a won night is saved in the frame it ends', async (p) => {
    await zombies(p);
    const saved = await afterFrames(p, () => { const g = window.__cvz(); g.spawns = []; g.zombies = []; }, () => [window.__cvz().state, JSON.parse(localStorage.getItem('chinchillas-vs-zombies-v1') ?? '{}')]);
    assert.equal(saved[0], 'won'); assert.equal(saved[1].cleared, 1);
  });
  await check('Chinchillas vs Zombies: a hidden tab pauses the night', async (p) => {
    await zombies(p); await hideTab(p);
    await p.waitForFunction(() => window.__cvz().state === 'paused');
  });
  await check('Burrow Tactics: sound turned off mid-battle survives the win', async (p) => {
    await p.goto(`${base}/tactics`); await p.getByTestId('mission-1').click();
    await p.waitForSelector('[data-testid="board"][data-busy="0"]');
    await p.keyboard.press('m');
    await p.evaluate(() => { const b = window.__tactics().battle; b.turns = b.turn; for (const u of b.preds) u.hp = 0; b.marks = []; b.plan = []; });
    await p.getByTestId('end-turn').click();
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('burrow-tactics-v1')));
    assert.ok(saved.stars[0] > 0); assert.equal(saved.muted, true);
  });
  for (const [route, open, canvas] of [['clash', clash, 'arena'], ['hay-maze', maze, 'board'], ['chinchillas-vs-zombies', zombies, 'lawn']]) {
    await check(`${route}: portrait and landscape layouts fit narrow screens`, async (p) => {
      await open(p);
      for (const [width, height] of [[320, 568], [568, 320], [390, 844], [844, 390]]) {
        await p.setViewportSize({ width, height }); await p.waitForTimeout(150);
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}×${height}: no horizontal overflow`);
        const q = await p.getByTestId(canvas).boundingBox();
        assert.ok(q.width > 0 && q.height > 0 && q.x >= -1 && q.x + q.width <= width + 1, `${width}×${height}: the canvas fits`);
      }
    }, { width: 390, height: 844 });
  }
  assert.deepEqual(errors, [], 'no browser errors');
  assert.deepEqual(failures, [], 'older-game regressions');
} finally { await browser.close(); }
