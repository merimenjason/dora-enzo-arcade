// Prism Paws in the browser: the arcade card, the level list opening one level at a time, level 1 solved by tapping,
// level 3 by dragging a mirror from the tray, undo, hints and keys, the win card and the save, the phone layouts held
// upright and sideways with taps, and no page errors. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, hasTouch = false) => {
  const page = await browser.newPage({ viewport, hasTouch });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** The middle of a board tile, as page coordinates. */
const tile = async (page, x, y) => {
  const box = await page.locator('.prism-canvas').boundingBox();
  const p = await page.evaluate(([x, y]) => window.__prismScene().centre(x, y), [x, y]);
  return { x: box.x + p.x, y: box.y + p.y };
};
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('prism-paws-v1')));

{
  const page = await open();
  await page.goto(base);
  const card = page.getByRole('link', { name: /Prism Paws/ });
  if (await card.count()) { await card.first().click(); await page.waitForURL('**/prism'); console.log('PASS the arcade card opens Prism Paws'); }
  else await page.goto(base + '/prism');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('prism-paws-v1')); await page.reload(); await ready(page);

  assert.equal(await page.locator('.prism-chapter').count(), 4, 'four chapters');
  assert.equal(await page.locator('.prism-level').count(), 32, 'thirty-two levels');
  assert.equal(await page.locator('.prism-level:disabled').count(), 31, 'only the first level is open');
  assert.equal(await page.getByRole('button', { name: /The Festival/ }).count(), 0, 'no festival until every level is lit');
  assert.ok(await page.locator('a.prism-back[href="/"]').count(), 'a plain link back to the arcade');
  console.log('PASS the level list opens one level at a time');

  // level 1: tap the mirror with the gold arrow to turn it
  await page.locator('.prism-level').first().click();
  await page.waitForFunction(() => window.__prism()?.index === 0);
  const sol = await page.evaluate(async () => { const g = window.__prism(); return { won: g.won, turns: g.hint() }; });
  assert.equal(sol.won, false, 'not won at the start');
  assert.equal(sol.turns.kind, 'turn', 'level one is solved by turning');
  const t = await tile(page, sol.turns.x, sol.turns.y);
  await page.mouse.click(t.x, t.y);
  assert.ok(await page.evaluate(() => window.__prism().won), 'tapping the mirror turns it and lights the lantern');
  await page.getByRole('dialog', { name: 'Lanterns lit' }).waitFor();
  assert.match(await page.locator('.prism-win').textContent(), /Firefly caught/);
  assert.equal((await save(page)).stars.m1, 3, 'three stars saved');
  console.log('PASS turning the mirror lights level 1, the win card shows three stars and they are saved');

  // level 2 by keyboard: arrows to the mirrors and Enter to turn them
  await page.getByRole('button', { name: /Next level/ }).click();
  await page.waitForFunction(() => window.__prism()?.index === 1);
  let cur = null;
  for (let n = 0; n < 4 && !(await page.evaluate(() => window.__prism().won)); n++) {
    const h = await page.evaluate(() => window.__prism().hint());
    assert.equal(h.kind, 'turn', 'level two is solved by turning');
    if (!cur) { await page.keyboard.press('ArrowUp'); cur = await page.evaluate(() => { const g = window.__prism(); return { x: Math.floor(g.w / 2), y: Math.floor(g.h / 2) }; }); }
    for (; cur.x < h.x; cur.x++) await page.keyboard.press('ArrowRight');
    for (; cur.x > h.x; cur.x--) await page.keyboard.press('ArrowLeft');
    for (; cur.y < h.y; cur.y++) await page.keyboard.press('ArrowDown');
    for (; cur.y > h.y; cur.y--) await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
  }
  await page.getByRole('dialog', { name: 'Lanterns lit' }).waitFor();
  console.log('PASS level 2 is lit with the arrow keys and Enter');

  // level 3: drag a mirror from the tray, tap it to turn it, undo and redo by key
  await page.getByRole('button', { name: /Next level/ }).click();
  await page.waitForFunction(() => window.__prism()?.index === 2);
  const goal = await page.evaluate(() => window.__prism().hint());
  assert.equal(goal.kind, 'place');
  const from = await page.locator('.prism-piece').first().boundingBox(), to = await tile(page, goal.x, goal.y);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 }); await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up();
  const placed = await page.evaluate(([x, y]) => { const g = window.__prism(); return { used: g.used, code: g.pieces[g.at(x, y)] }; }, [goal.x, goal.y]);
  assert.equal(placed.used, 1, 'dragging from the tray places a mirror');
  if (!(await page.evaluate(() => window.__prism().won))) { await page.mouse.click(to.x, to.y); }
  assert.ok(await page.evaluate(() => window.__prism().won), 'tapping the placed mirror turns it to light the lantern');
  await page.getByRole('dialog', { name: 'Lanterns lit' }).waitFor();
  await page.getByRole('button', { name: 'Replay' }).click();
  assert.equal(await page.evaluate(() => window.__prism().used), 0, 'replay clears the board');
  await page.keyboard.press('z');
  assert.ok(await page.evaluate(() => window.__prism().won), 'Z undoes the reset');
  await page.getByRole('dialog', { name: 'Lanterns lit' }).waitFor();
  console.log('PASS dragging from the tray, tapping to turn, replay and undo');

  // level 4: a hint glows, then dragging a placed piece off the board picks it up
  await page.getByRole('button', { name: /Next level/ }).click();
  await page.waitForFunction(() => window.__prism()?.index === 3);
  await page.getByRole('button', { name: /Hint/ }).click();
  await page.locator('.prism-note.is-hint').waitFor();
  assert.match(await page.locator('.prism-note').textContent(), /mirror/i);
  const hh = await page.evaluate(() => window.__prism().hint());
  await page.keyboard.press('1');
  const ht = await tile(page, hh.x, hh.y); await page.mouse.click(ht.x, ht.y);
  assert.equal(await page.evaluate(() => window.__prism().used), 1, 'key 1 then a tap places a mirror');
  const box = await page.locator('.prism-canvas').boundingBox();
  await page.mouse.move(ht.x, ht.y); await page.mouse.down(); await page.mouse.move(ht.x, box.y + 20, { steps: 8 }); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__prism().used), 0, 'dragging it off the board picks it up');
  const sv = await save(page);
  assert.ok(sv.solved.m3 && sv.level === 3 && unlockedCount(sv) === 4, 'the save keeps solved levels and the last level');
  await page.getByRole('button', { name: /Levels/ }).click();
  assert.equal(await page.locator('.prism-level:disabled').count(), 28, 'four levels are open now');
  console.log('PASS hints, keys and picking up; the level list remembers progress');
  await page.close();
}

function unlockedCount(s) { return 1 + Object.keys(s.solved).length; }

// ---- phones: held upright and sideways, with taps
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(viewport, true);
  await page.goto(base + '/prism'); await ready(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(await overflow() <= 0, `no sideways scrolling on the menu at ${viewport.width}×${viewport.height}`);
  await page.evaluate(() => { const ids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']; localStorage.setItem('prism-paws-v1', JSON.stringify({ v: 1, stars: {}, solved: Object.fromEntries(ids.map((i) => [i, true])), sound: false, level: 31 })); });
  await page.reload(); await ready(page);
  await page.locator('.prism-level').nth(31).click();
  await page.waitForFunction(() => window.__prism()?.index === 31);
  await page.waitForTimeout(300);
  assert.ok(await overflow() <= 0, `no sideways scrolling while playing at ${viewport.width}×${viewport.height}`);
  const fit = await page.evaluate(() => { const b = window.__prismScene().board, g = window.__prism(); return { l: b.x, t: b.y, r: b.x + b.cell * g.w, b: b.y + b.cell * g.h, cell: b.cell, w: innerWidth, h: innerHeight }; });
  assert.ok(fit.l >= 0 && fit.t >= 0 && fit.r <= fit.w && fit.b <= fit.h && fit.cell >= 22, `the board fits the screen (${JSON.stringify(fit)})`);
  const tray = await page.locator('.prism-tray').boundingBox();
  assert.ok(tray && tray.x >= 0 && tray.x + tray.width <= viewport.width + 1 && tray.y + tray.height <= viewport.height + 1, 'the tray is on screen');
  const head = await page.locator('.prism-hud').boundingBox();
  assert.ok(head.y + head.height <= fit.t + 4 || fit.r <= head.x, 'the header does not cover the board');
  // tap through the finale with turns and tray taps
  const sol = await page.evaluate(async () => { const g = window.__prism(), out = []; for (let n = 0; n < 8 && !g.won; n++) { const h = g.hint(); out.push(h); if (h.kind === 'turn') g.rotate(h.x, h.y); else if (h.kind === 'place') g.place(h.x, h.y, ['mirror', 'mirror', 'splitter', 'splitter'][h.code - 1], h.code); } g.reset(); while (g.canUndo) g.undo(); g.events.length = 0; return out; });
  for (const h of sol) {
    if (h.kind === 'place') {
      const kind = h.code <= 2 ? 'Mirror' : 'Crystal pane';
      await page.locator('.prism-piece', { hasText: kind }).tap();
      const p = await tile(page, h.x, h.y); await page.touchscreen.tap(p.x, p.y);
      const code = await page.evaluate(([x, y]) => { const g = window.__prism(); return g.pieces[g.at(x, y)]; }, [h.x, h.y]);
      if (code !== h.code) await page.touchscreen.tap(p.x, p.y);
    } else if (h.kind === 'turn') { const p = await tile(page, h.x, h.y); await page.touchscreen.tap(p.x, p.y); }
  }
  assert.ok(await page.evaluate(() => window.__prism().won), `the grand finale is lit by taps at ${viewport.width}×${viewport.height}`);
  await page.getByRole('dialog', { name: 'Lanterns lit' }).waitFor();
  const card = await page.locator('.prism-win').boundingBox();
  assert.ok(card.y >= 0 && card.y + card.height <= viewport.height + 1, 'the win card fits the screen');
  await page.getByRole('button', { name: /See the festival/ }).tap();
  await page.getByRole('region', { name: 'The Festival' }).waitFor();
  console.log(`PASS the phone layout at ${viewport.width}×${viewport.height}: board and tray fit, taps light the finale, and the festival opens`);
  await page.close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
