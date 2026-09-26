import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const arena = (p) => p.getByTestId('arena');
const game = (p, fn) => p.evaluate(`(${fn})(window.__clash())`);
const KIND = { kits: 'troop', flickers: 'troop', dora: 'troop', enzo: 'troop', pebble: 'troop', dasher: 'troop', gliders: 'troop', mochi: 'troop', balloon: 'troop', dustbomb: 'spell', volley: 'spell', cannon: 'building' };
/** The first hand slot holding a card of `kind` ('troop', 'spell' or 'building'), or -1. */
const slotOf = async (p, kind) => (await p.evaluate('window.__clash().hands[0]')).findIndex((id) => KIND[id] === kind);
const fill = (p) => game(p, 'g => { g.dust[0] = 10; }');
const played = (p) => game(p, 'g => g.played[0]');
try {
  await mkdir('.checks/clash', { recursive: true });

  // The arcade lists the new cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 19);
  assert.match(await menu.locator('a.arcade-card[href="/clash"]').textContent(), /Chinchilla Clash/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/clash`);
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-beige"]').disabled);

  // Only the first arena is open, and the starter deck has eight cards.
  assert.equal(await page.getByTestId('battle-violet').isDisabled(), true);
  assert.equal(await page.getByTestId('battle-ebony').isDisabled(), true);
  assert.equal(await page.locator('.cc-pick.on').count(), 8);
  await page.screenshot({ path: '.checks/clash/home.png', fullPage: true });

  // Deck builder: a ninth card is refused, seven cards can't battle, and a full deck is remembered.
  await page.getByTestId('card-mochi').click();
  assert.equal(await page.locator('.cc-pick.on').count(), 8, 'a full deck refuses a ninth card');
  await page.getByTestId('card-cannon').click();
  assert.equal(await page.getByTestId('battle-beige').isDisabled(), true, 'seven cards can’t battle');
  await page.getByTestId('card-mochi').click();
  assert.equal(await page.getByTestId('battle-beige').isDisabled(), false);
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-beige"]').disabled);
  assert.equal(await page.getByTestId('card-mochi').getAttribute('aria-pressed'), 'true', 'the deck survives a reload');
  assert.equal(await page.getByTestId('card-cannon').getAttribute('aria-pressed'), 'false');

  // Into battle.
  await page.getByTestId('battle-beige').click();
  await page.waitForSelector('[data-testid="arena"][data-state="playing"]');
  await game(page, 'g => { g.ai = [null, null]; }');
  await page.waitForTimeout(300);
  const colours = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="arena"]'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
  assert.ok(colours > 40, `the arena shows ${colours} colours`);
  const box = await arena(page).boundingBox();
  const at = (x, y) => [box.x + (x / 18) * box.width, box.y + (y / 32) * box.height];

  // Tap a card, then tap the arena: a troop goes down on our half.
  await fill(page);
  let slot = await slotOf(page, 'troop');
  assert.ok(slot >= 0, 'the hand has a troop');
  let before = await played(page);
  await page.getByTestId(`hand-${slot}`).click();
  assert.equal(await page.getByTestId(`hand-${slot}`).getAttribute('aria-pressed'), 'true');
  await page.mouse.click(...at(4, 22));
  assert.equal(await played(page), before + 1, 'tap to play');
  assert.ok(Number(await arena(page).getAttribute('data-troops')) >= 1);

  // Troops can't go over the river.
  await fill(page);
  slot = await slotOf(page, 'troop');
  if (slot >= 0) {
    before = await played(page);
    await page.getByTestId(`hand-${slot}`).click();
    await page.mouse.click(...at(9, 8));
    assert.equal(await played(page), before, 'no troops on the enemy half');
    await page.waitForSelector('.cc-note');
    assert.match(await page.locator('.cc-note').textContent(), /your side of the river/);
    await page.keyboard.press('Escape');
  }

  // Keyboard: a number picks, arrows move the drop point, Enter drops.
  await fill(page);
  await page.mouse.move(box.x - 40, box.y);
  slot = await slotOf(page, 'troop');
  before = await played(page);
  await page.keyboard.press(String(slot + 1));
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await played(page), before + 1, 'keyboard play');

  // Drag a card straight onto the arena.
  await fill(page);
  slot = await slotOf(page, 'troop');
  before = await played(page);
  const card = await page.getByTestId(`hand-${slot}`).boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(...at(13, 24), { steps: 8 });
  await page.mouse.up();
  assert.equal(await played(page), before + 1, 'drag to play');

  // A spell can land anywhere, even on the enemy's towers.
  await fill(page);
  slot = await slotOf(page, 'spell');
  if (slot >= 0) {
    before = await played(page);
    await page.getByTestId(`hand-${slot}`).click();
    await page.mouse.click(...at(3.5, 6.5));
    assert.equal(await played(page), before + 1, 'spells go anywhere');
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.checks/clash/battle.png' });

  // Pause and resume.
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="arena"][data-state="paused"]');
  assert.match(await page.locator('.cc-overlay').textContent(), /PAUSED/);
  const t = await game(page, 'g => g.time');
  await page.waitForTimeout(400);
  assert.equal(await game(page, 'g => g.time'), t, 'the clock stops while paused');
  await page.keyboard.press('p');
  await page.waitForSelector('[data-testid="arena"][data-state="playing"]');

  // Topple Sandy's king: victory, three crowns, and the next arena opens.
  await game(page, 'g => { g.tower(1, "king").hp = 0; }');
  await page.waitForSelector('[data-testid="arena"][data-state="over"]');
  assert.match(await page.locator('.cc-overlay').textContent(), /VICTORY/);
  assert.equal(await arena(page).getAttribute('data-crowns'), '3-0');
  await page.screenshot({ path: '.checks/clash/victory.png' });
  await page.getByRole('button', { name: 'Trophy road' }).click();
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-violet"]').disabled);
  assert.equal(await page.getByTestId('battle-ebony').isDisabled(), true);
  assert.match(await page.locator('.cc-section').first().textContent(), /1 win/);
  await page.close();

  // On a phone the whole hand fits under the arena and taps play cards.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  // A fresh browser context, so seed a save that has beaten Sandy and play the second arena.
  await phone.addInitScript(() => localStorage.setItem('chinchilla-clash-v1', JSON.stringify({ beaten: 1, wins: 1, threeCrowns: 1 })));
  await phone.goto(`${base}/clash`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="battle-violet"]').disabled);
  await phone.getByTestId('battle-violet').tap();
  await phone.waitForSelector('[data-testid="arena"][data-state="playing"]');
  await game(phone, 'g => { g.ai = [null, null]; g.dust[0] = 10; }');
  const pbox = await arena(phone).boundingBox(), dust = await phone.locator('.cc-dust').boundingBox();
  assert.ok(pbox.x >= 0 && pbox.x + pbox.width <= 390, 'the arena fits the width');
  assert.ok(dust.y + dust.height <= 844 + 60, 'the dust bar is on screen or just below it');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll');
  slot = await slotOf(phone, 'troop');
  before = await played(phone);
  await phone.getByTestId(`hand-${slot}`).tap();
  await phone.touchscreen.tap(pbox.x + pbox.width * 0.3, pbox.y + pbox.height * 0.7);
  assert.equal(await played(phone), before + 1, 'tap to play on a phone');
  await phone.waitForTimeout(1200);
  await phone.screenshot({ path: '.checks/clash/phone.png' });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS Chinchilla Clash browser: 19-card menu, locked arenas, deck builder limits and persistence, tap, keyboard and drag plays, the river zone, spells anywhere, pause, a king-tower victory that opens the next arena, and phone layout with touch plays.');
} finally {
  await browser.close();
}
