import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { Run } from '../../.checks/summit-shuffle-game.js';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000', KEY = 'summit-shuffle-v1';
const browser = await chromium.launch();
const errors = [];
const game = (p, fn) => p.evaluate(`(${fn})(window.__summit())`);
const top = async (p) => { const t = p.getByTestId('top'); return { phase: await t.getAttribute('data-phase'), hp: Number(await t.getAttribute('data-hp')), seeds: Number(await t.getAttribute('data-seeds')), stop: Number(await t.getAttribute('data-stop')), act: Number(await t.getAttribute('data-act')), deck: Number(await t.getAttribute('data-deck')) }; };
const settled = (p) => p.waitForSelector('[data-testid="board"][data-waiting="0"]');
/** A saved climb standing on the first stop of the given kind on a stretch, made with the engine itself. */
function savedAt(type, act = 0, prep = () => {}) {
  for (let seed = 1; seed < 300; seed++) {
    const r = Run.start({ seed, hero: 'dora', level: 0 });
    r.act = act;
    const n = r.map.find((x) => x.type === type), parent = n && r.map.find((x) => x.next.includes(n.id));
    if (!n || (!parent && n.row > 0)) continue;
    r.at = parent ? parent.id : -1; r.walked = parent ? [parent.id] : [];
    prep(r);
    if (!r.go(n.id)) return r.save();
  }
  throw new Error(`no ${type} stop found`);
}
/** Opens the game with a climb saved in the browser, beside whatever records are already there, and carries on with it. */
async function carryOn(p, run) {
  await p.goto(`${base}/summit`);
  await p.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ ...JSON.parse(localStorage.getItem(k) ?? '{}'), run: v })), [KEY, run]);
  await p.reload();
  await p.getByTestId('resume').click();
}
/** Ends the fight on the spot: every foe is left on 1 health and an Avalanche is put in hand and played. */
async function finish(p) {
  await settled(p);
  await game(p, 't => { const f = t.run.fight; f.foes.forEach((x) => { if (x.alive) { x.hp = 1; x.fluff = 0; x.st = {}; } }); f.hand = [{ id: "avalanche", up: false, uid: 987654 }]; f.energy = 3; }');
  await p.getByTestId('end-turn').focus();
  await p.keyboard.press('1');
  await p.keyboard.press('1');
}
try {
  await mkdir('.checks/summit-shuffle', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 25);
  assert.match(await menu.locator('a.arcade-card[href="/summit"]').textContent(), /Summit Shuffle/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/summit`);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);

  // Home: two chinchillas, six altitudes with only Base Camp open, and nothing found yet.
  assert.equal(await page.locator('.ss-hero').count(), 2);
  assert.equal(await page.locator('.ss-levels button').count(), 6);
  assert.ok(await page.getByTestId('level-0').isEnabled());
  assert.ok(await page.getByTestId('level-1').isDisabled(), 'Altitude 1 is locked until the summit is reached');
  assert.match(await page.locator('.ss-fold summary').first().textContent(), /0 of 48 seen/);
  assert.equal(await page.getByTestId('resume').count(), 0);
  await page.getByTestId('hero-enzo').click();
  assert.equal(await page.getByTestId('hero-enzo').getAttribute('aria-pressed'), 'true');
  assert.match(await page.getByTestId('start').textContent(), /with Enzo/);
  await page.getByTestId('hero-dora').click();
  await page.getByTestId('start').click();

  // The trail: only the foot of the mountain is open, and it is all fights.
  await page.waitForSelector('[data-testid="map"]');
  let t = await top(page);
  assert.deepEqual([t.phase, t.hp, t.stop, t.act, t.deck], ['map', 80, 0, 0, 10]);
  // A stop says what it is when the mouse rests on it, open or not.
  await page.locator('.ss-stop:has(.ss-node.k-boss)').hover();
  await page.getByTestId('peek').waitFor();
  assert.match(await page.getByTestId('peek').textContent(), /Guardian: Russet, the Old Fox.*Beat it to finish this stretch\..*Not in reach/s);
  await page.mouse.move(5, 5);
  const open = page.locator('.ss-node.open');
  assert.ok((await open.count()) >= 2);
  for (const type of await open.evaluateAll((els) => els.map((e) => e.dataset.type))) assert.equal(type, 'fight');
  assert.ok(await page.locator('.ss-node.k-boss').isDisabled());
  assert.equal(await page.locator('.ss-node.k-rest').count() >= 1, true);
  await page.screenshot({ path: '.checks/summit-shuffle/map.png' });
  await open.first().click();

  // The fight: Dora's Ruby Bell gives her seven cards and four energy to open with.
  await page.waitForSelector('[data-testid="board"]');
  await settled(page);
  assert.equal(await page.getByTestId('hand').getAttribute('data-count'), '7');
  assert.equal(await page.getByTestId('energy').getAttribute('data-energy'), '4');
  assert.match(await page.getByTestId('info').textContent(), /predators will hit for|No attack is coming/);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.checks/summit-shuffle/fight.png' });

  // Resting the mouse on a card shows a big copy with its words explained and what an upgrade would do.
  const shown = await game(page, 't => t.run.fight.hand.findIndex((c) => c.id === "nip")');
  assert.equal(await page.getByTestId('peek').count(), 0);
  await page.getByTestId(`hand-${shown}`).hover();
  const peek = page.getByTestId('peek');
  await peek.waitFor();
  assert.equal(await peek.getAttribute('data-card'), 'nip');
  assert.match(await peek.textContent(), /Nip.*Deal 6 damage\..*Numbers as they stand against .*Upgraded.*Deal 9 damage\./s);
  const [big, small, view] = [await peek.locator('.ss-card').boundingBox(), await page.getByTestId(`hand-${shown}`).boundingBox(), page.viewportSize()];
  assert.ok(big.width > small.width * 1.4, 'the copy is a good deal bigger than the card in hand');
  const whole = await peek.boundingBox();
  assert.ok(whole.x >= 0 && whole.y >= 0 && whole.x + whole.width <= view.width && whole.y + whole.height <= view.height, 'the note stays on the screen');
  // So does a predator, with what it will do next, and a trinket.
  const over = await page.evaluate(() => { const t = window.__summit(), cv = document.querySelector('[data-testid="board"]'), q = cv.getBoundingClientRect(), b = t.stage.boxOf(0, q.width, q.height, t.run); return [q.left + b.x + b.w / 2, q.top + b.y + b.h * 0.6]; });
  await page.mouse.move(over[0], over[1]);
  await page.waitForFunction(() => document.querySelector('[data-testid="peek"].k-note'));
  const foeName = await game(page, 't => t.run.fight.foes[0].name');
  assert.match(await peek.textContent(), new RegExp(`${foeName}.*health.*Next: `, 's'));
  await page.getByTestId('trinket-bell').hover();
  await page.waitForFunction(() => /Ruby Bell/.test(document.querySelector('[data-testid="peek"]')?.textContent ?? ''));
  assert.match(await peek.textContent(), /On the first turn of every fight, draw 2 more cards/);
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.querySelector('[data-testid="peek"]'));

  // One tap chooses a card and shows its rules; a second plays it.
  const nip = await game(page, 't => t.run.fight.hand.findIndex((c) => c.id === "nip")');
  const before = await game(page, 't => t.run.fight.foes.map((x) => x.hp)');
  await page.getByTestId(`hand-${nip}`).click();
  assert.equal(await page.getByTestId(`hand-${nip}`).getAttribute('aria-pressed'), 'true');
  assert.match(await page.getByTestId('info').textContent(), /Nip · Deal 6 damage\. Aimed at /);
  assert.equal(await page.getByTestId('energy').getAttribute('data-energy'), '4', 'choosing a card does not play it');
  await page.getByTestId(`hand-${nip}`).click();
  assert.equal(await page.getByTestId('energy').getAttribute('data-energy'), '3');
  assert.equal(await page.getByTestId('hand').getAttribute('data-count'), '6');
  const after = await game(page, 't => t.run.fight.foes.map((x) => x.hp)');
  assert.equal(before.reduce((a, b) => a + b, 0) - after.reduce((a, b) => a + b, 0), 6);

  // Tapping a predator shows what it is about to do; with a card chosen, tapping a predator plays the card on it.
  const spot = async (i) => game(page, `t => { const cv = document.querySelector('[data-testid="board"]'), q = cv.getBoundingClientRect(); for (let y = q.height * 0.7; y > 20; y -= 6) for (let x = q.width * 0.3; x < q.width; x += 6) if (t.stage.foeAt(x, y, q.width, q.height, t.run) === ${i}) return [q.left + x, q.top + y]; return null; }`);
  const last = await game(page, 't => t.run.fight.foes.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0).pop()');
  const at = await spot(last);
  assert.ok(at, 'the predator can be found on the board');
  await page.mouse.click(at[0], at[1]);
  assert.match(await page.getByTestId('info').textContent(), /health\..*: (attacks|gains|leaves|puts|does|calls|runs)/);
  const nip2 = await game(page, 't => t.run.fight.hand.findIndex((c) => c.id === "nip")');
  await page.getByTestId(`hand-${nip2}`).click();
  const hpWas = await game(page, `t => t.run.fight.foes[${last}].hp`);
  await page.mouse.click(at[0], at[1]);
  assert.equal(await game(page, `t => t.run.fight.foes[${last}].hp`), hpWas - 6);
  assert.equal(await page.getByTestId('energy').getAttribute('data-energy'), '2');

  // A card that costs too much says so and stays in hand.
  await game(page, 't => { t.run.fight.energy = 0; }');
  await page.getByTestId('hand-0').click(); await page.getByTestId('hand-0').click();
  assert.match(await page.locator('.ss-note').textContent(), /Not enough energy|cannot be played/);
  assert.equal(await page.getByTestId('hand').getAttribute('data-count'), '5');

  // The piles and the deck can be looked through.
  await page.getByTestId('pile-discard').click();
  assert.equal(await page.locator('.ss-sheet .ss-card').count(), 2);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.ss-sheet').count(), 0);
  await page.getByTestId('deck').click();
  assert.equal(await page.locator('.ss-sheet .ss-card').count(), 10);
  // A card in a list explains the words on it too.
  await page.locator('.ss-sheet [data-card="dustkick"]').hover();
  await peek.waitFor();
  assert.match(await peek.textContent(), /Dust Kick.*Deal 8 damage\. Apply 2 Exposed\..*Exposed.*half as much again.*Upgraded.*Deal 10 damage\. Apply 3 Exposed\./s);
  await page.getByTestId('sheet-close').click();
  assert.equal(await peek.count(), 0, 'a press puts the note away');

  // E ends the turn: the predators move, and a new hand of five is drawn with three energy.
  const hpBefore = (await top(page)).hp;
  await game(page, 't => { t.run.fight.fluff = 0; }');
  await page.getByTestId('board').focus();
  await page.keyboard.press('e');
  await page.waitForSelector('[data-testid="board"][data-turn="2"]');
  assert.equal(await page.getByTestId('board').getAttribute('data-waiting'), '1', 'the predators’ turn plays out before the next hand can be used');
  assert.ok(await page.getByTestId('end-turn').isDisabled());
  await page.keyboard.press('Enter');
  await settled(page);
  assert.equal(await page.getByTestId('hand').getAttribute('data-count'), '5');
  assert.equal(await page.getByTestId('energy').getAttribute('data-energy'), '3');
  assert.ok((await top(page)).hp <= hpBefore);

  // The keyboard: a number chooses, Enter plays, the arrows change the foe.
  const first = await game(page, 't => t.run.fight.hand.findIndex((c) => c.id === "fluffup")');
  if (first >= 0) {
    await page.keyboard.press(String(first + 1));
    assert.equal(await page.getByTestId(`hand-${first}`).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Enter');
    assert.equal(await game(page, 't => t.run.fight.fluff'), 5);
  }
  await page.keyboard.press('Escape');

  // A climb saved in the middle of a fight walks back into the same fight from its start.
  await page.reload();
  await page.getByTestId('resume').click();
  await settled(page);
  assert.equal(await page.getByTestId('board').getAttribute('data-turn'), '1');
  assert.equal(await page.getByTestId('hand').getAttribute('data-count'), '7');
  assert.equal((await top(page)).hp, 80);

  // Winning: seeds, a choice of three cards, and back to the trail one row up.
  await finish(page);
  await page.waitForSelector('[data-testid="reward"]');
  t = await top(page);
  assert.ok(t.seeds >= 70 && t.seeds <= 79, 'ten to nineteen seeds for a fight');
  assert.equal(await page.locator('[data-testid^="reward-"]').count(), 3);
  assert.match(await page.getByTestId('continue').textContent(), /Skip the cards/);
  await page.screenshot({ path: '.checks/summit-shuffle/reward.png' });
  await page.getByTestId('reward-1').click();
  assert.equal((await top(page)).deck, 11);
  assert.match(await page.getByTestId('continue').textContent(), /Back to the trail/);
  await page.getByTestId('continue').click();
  await page.waitForSelector('[data-testid="map"]');
  assert.equal(await page.locator('.ss-node.here').count(), 1);
  assert.ok((await page.locator('.ss-node.open').count()) >= 1);
  assert.equal((await top(page)).stop, 1);
  // The card book has started to fill in.
  await page.getByTestId('menu').click();
  assert.match(await page.locator('.ss-fold summary').first().textContent(), /[3-9] of 48 seen/);
  assert.match(await page.locator('.ss-resume').textContent(), /Dora is on the mountain.*stop 1 of 21/s);

  // A rest burrow: grooming upgrades a card of your choice.
  await carryOn(page, savedAt('rest', 0, (r) => { r.hp = 30; }));
  await page.waitForSelector('[data-testid="rest"]');
  assert.match(await page.getByTestId('nap').textContent(), /Heal 24 health/);
  await page.getByTestId('groom').click();
  assert.equal(await page.locator('[data-testid="sheet-card"]').count(), 10);
  await page.locator('[data-testid="sheet-card"][data-card="dustkick"]').click();
  await page.waitForSelector('[data-testid="map"]');
  assert.ok(await game(page, 't => t.run.deck.some((c) => c.id === "dustkick" && c.up)'));
  // And napping heals.
  await carryOn(page, savedAt('rest', 0, (r) => { r.hp = 30; }));
  await page.getByTestId('nap').click();
  await page.waitForSelector('[data-testid="map"]');
  assert.equal((await top(page)).hp, 54);

  // A treat stall: buying a card, and paying to leave one behind.
  await carryOn(page, savedAt('stall', 0, (r) => { r.seeds = 400; }));
  await page.waitForSelector('[data-testid="stall"]');
  assert.equal(await page.locator('[data-testid^="buy-card-"]').count(), 5);
  await page.screenshot({ path: '.checks/summit-shuffle/stall.png' });
  await page.getByTestId('buy-card-0').click();
  t = await top(page);
  assert.equal(t.deck, 11); assert.ok(t.seeds < 400);
  await page.getByTestId('buy-removal').click();
  await page.locator('[data-testid="sheet-card"][data-card="nip"]').first().click();
  assert.equal((await top(page)).deck, 10);
  assert.equal(await game(page, 't => t.run.deck.filter((c) => c.id === "nip").length'), 4);
  await page.getByTestId('continue').click();
  await page.waitForSelector('[data-testid="map"]');

  // Something on the trail: an option is chosen, and what happened is told.
  await carryOn(page, savedAt('event'));
  await page.waitForSelector('[data-testid="event"]');
  assert.ok((await page.locator('[data-testid^="option-"]').count()) >= 2);
  const plain = page.locator('[data-testid^="option-"]:not([disabled])').last();
  await plain.click();
  if (await page.locator('.ss-sheet').count()) await page.locator('[data-testid="sheet-card"]').first().click();
  assert.ok((await page.getByTestId('event-result').textContent()).length > 10);
  await page.getByTestId('continue').click();
  await page.waitForSelector('[data-testid="map"]');

  // A guardian: one of its trinkets must be taken, the stretch is mended, and the next one begins.
  await carryOn(page, savedAt('boss', 0, (r) => { r.hp = 25; }));
  await finish(page);
  await page.waitForSelector('[data-testid="reward"]');
  assert.equal(await page.locator('[data-testid^="relic-"]').count(), 3);
  assert.ok(await page.getByTestId('continue').isDisabled(), 'a trinket must be chosen first');
  await page.getByTestId('relic-0').click();
  await page.getByTestId('continue').click();
  await page.waitForSelector('[data-testid="map"]');
  t = await top(page);
  assert.equal(t.act, 1); assert.equal(t.hp, await game(page, 't => t.run.maxHp'));
  assert.match(await page.locator('.ss-map-title').textContent(), /Stretch 2 of 3: The Cliffs/);

  // The last guardian: the summit, the record, and the next altitude opened.
  await carryOn(page, savedAt('boss', 2));
  await finish(page);
  await page.waitForSelector('[data-testid="end"][data-won="1"]');
  assert.match(await page.getByTestId('end').textContent(), /Dora stands on the summit!.*Altitude 1 is open for Dora/s);
  await page.screenshot({ path: '.checks/summit-shuffle/summit.png' });
  await page.getByTestId('again').click();
  assert.ok(await page.getByTestId('level-1').isEnabled());
  assert.equal(await page.getByTestId('level-1').getAttribute('aria-pressed'), 'true');
  assert.match(await page.getByTestId('hero-dora').textContent(), /1 of 1 climb reached the summit · highest: Base Camp/);
  assert.equal(await page.getByTestId('resume').count(), 0, 'a finished climb is not kept');
  await page.getByTestId('hero-enzo').click();
  assert.ok(await page.getByTestId('level-1').isDisabled(), 'altitudes open for each chinchilla separately');
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
  assert.match(await page.getByTestId('hero-dora').textContent(), /highest: Base Camp/, 'the record is saved');

  // Losing ends the climb too.
  await carryOn(page, savedAt('fight', 1));
  await settled(page);
  await game(page, 't => { t.run.hp = 1; t.run.fight.fluff = 0; t.run.fight.st = {}; const x = t.run.fight.foes[0]; x.st = { zoomies: 30 }; }');
  let ended = false;
  for (let i = 0; i < 6 && !ended; i++) { await settled(page).catch(() => {}); if (await page.getByTestId('end').count()) { ended = true; break; } await game(page, 't => { if (t.run.fight) t.run.fight.fluff = 0; }'); await page.getByTestId('end-turn').click(); await page.keyboard.press('Enter'); await page.waitForTimeout(400); ended = (await page.getByTestId('end').count()) > 0; }
  await page.waitForSelector('[data-testid="end"][data-won="0"]');
  assert.match(await page.getByTestId('end').textContent(), /Dora turns back at the cliffs/);
  await page.getByTestId('again').click();
  assert.match(await page.getByTestId('hero-dora').textContent(), /1 of 2 climbs reached the summit/);

  // A whole climb through the page, stop by stop, with every fight cut short: all twenty-one stops lead to the summit.
  await page.getByTestId('hero-enzo').click();
  await page.getByTestId('start').click();
  const seen = new Set();
  for (let guard = 0; guard < 120; guard++) {
    if (await page.getByTestId('end').count()) break;
    const phase = (await top(page)).phase;
    seen.add(phase);
    if (phase === 'map') { await page.waitForSelector('[data-testid="map"]'); await page.locator('.ss-node.open').last().click(); }
    else if (phase === 'fight') { await finish(page); await page.waitForFunction(() => document.querySelector('[data-testid="top"]').dataset.phase !== 'fight'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid="reward"], [data-testid="end"]'); }
    else if (phase === 'reward') { if (await page.getByTestId('relic-0').count() && await page.getByTestId('relic-0').isEnabled()) await page.getByTestId('relic-0').click(); await page.getByTestId('continue').click(); }
    else if (phase === 'rest') { if (await page.getByTestId('nap').isEnabled()) await page.getByTestId('nap').click(); else { await page.getByTestId('groom').click(); await page.locator('[data-testid="sheet-card"]').first().click(); } }
    else if (phase === 'stall') await page.getByTestId('continue').click();
    else if (phase === 'event') {
      if (!(await page.getByTestId('event-result').count())) { await page.locator('[data-testid^="option-"]:not([disabled])').first().click(); if (await page.locator('.ss-sheet').count()) await page.locator('[data-testid="sheet-card"]').first().click(); }
      await page.getByTestId('continue').click();
    }
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('[data-testid="end"][data-won="1"]');
  assert.match(await page.getByTestId('end').textContent(), /21 STOPS OF 21.*Enzo stands on the summit!/s);
  for (const phase of ['map', 'fight', 'reward', 'rest']) assert.ok(seen.has(phase), `the climb passed through ${phase}`);
  await page.getByTestId('again').click();

  // Giving up a climb in progress.
  await page.evaluate(([k, run]) => { const s = JSON.parse(localStorage.getItem(k)); s.run = run; localStorage.setItem(k, JSON.stringify(s)); }, [KEY, savedAt('event')]);
  await page.reload();
  await page.getByTestId('abandon').click();
  assert.equal(await page.getByTestId('resume').count(), 0);
  await page.close();

  // A phone: the whole hand fits across, nothing spills sideways, and the trail can be tapped.
  const phone = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, hasTouch: true });
  phone.setDefaultTimeout(20000);
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/summit`);
  await phone.evaluate((k) => localStorage.removeItem(k), KEY);
  await phone.reload();
  await phone.waitForFunction(() => !document.querySelector('[data-testid="start"]').disabled);
  await phone.getByTestId('hero-enzo').tap();
  await phone.getByTestId('start').tap();
  await phone.waitForSelector('[data-testid="map"]');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the trail fits a phone');
  await phone.locator('.ss-node.open').first().tap();
  await phone.waitForSelector('[data-testid="board"][data-waiting="0"]');
  assert.equal(await phone.getByTestId('hand').getAttribute('data-count'), '5');
  const cards = await phone.locator('.ss-hand .ss-card').evaluateAll((els) => els.map((e) => { const q = e.getBoundingClientRect(); return [q.left, q.right]; }));
  assert.ok(cards.every(([l, r]) => l >= 0 && r <= 390), 'five cards fit across a phone');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the fight fits a phone');
  const board = await phone.getByTestId('board').boundingBox();
  assert.ok(board.width > 350 && board.height >= 230);
  // Holding a finger on a card shows the big copy; letting go puts it away without choosing or playing the card.
  const held = await phone.getByTestId('hand-1').boundingBox(), touch = await phone.context().newCDPSession(phone);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: held.x + held.width / 2, y: held.y + held.height / 2 }] });
  await phone.getByTestId('peek').waitFor();
  const shownCard = await phone.getByTestId('peek').boundingBox();
  assert.ok(shownCard.x >= 0 && shownCard.x + shownCard.width <= 390, 'the big copy fits across a phone');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.waitForFunction(() => !document.querySelector('[data-testid="peek"]'));
  assert.equal(await phone.locator('.ss-hand .ss-card.on').count(), 0);
  assert.equal(await phone.getByTestId('hand').getAttribute('data-count'), '5');
  await phone.getByTestId('hand-0').tap();
  assert.match(await phone.getByTestId('info').textContent(), /Tap the card again to play it|Tap a foe/);
  await phone.getByTestId('hand-0').tap();
  assert.equal(await phone.getByTestId('hand').getAttribute('data-count'), '4');
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: '.checks/summit-shuffle/phone.png' });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS summit-shuffle: menu, home, trail, cards, predators, keyboard, piles, saving, rewards, burrow, stall, meeting, guardians, summit, records, a whole climb and phone');
} finally {
  await browser.close();
}
