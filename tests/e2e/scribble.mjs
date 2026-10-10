import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const world = (p) => p.getByTestId('world');
const game = (p, fn) => p.evaluate(`(${fn})(window.__scribble())`);
// The canvas draws the 1000 × 600 world scaled to fit.
const at = (box, x, y) => [box.x + (x / 1000) * box.width, box.y + (y / 600) * box.height];
const write = async (p, word) => { await p.getByTestId('word').fill(word); await p.getByTestId('word').press('Enter'); };
try {
  await mkdir('.checks/scribble', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 30);
  assert.match(await menu.locator('a.arcade-card[href="/scribble"]').textContent(), /Chinchilla Scribble/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/scribble`);
  await page.evaluate(() => localStorage.removeItem('chinchilla-scribble-v1'));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="level-1"]').disabled);
  assert.ok(await page.getByTestId('level-2').isDisabled(), 'level 2 is locked until level 1 is solved');
  await page.screenshot({ path: '.checks/scribble/home.png', fullPage: true });

  // Level 1: a word the dictionary doesn't know gets a suggestion, then a ladder, a click to climb, and the wolfberry.
  await page.getByTestId('level-1').click();
  await page.waitForSelector('[data-testid="world"][data-state="playing"]');
  await write(page, 'ladr');
  await page.waitForFunction(() => /Did you mean “ladder”/.test(document.querySelector('[data-testid="note"]')?.textContent ?? ''));
  assert.equal(await game(page, 'g => g.summons.length'), 0, 'unknown words cost nothing');
  let box = await world(page).boundingBox();
  await page.mouse.click(...at(box, 680, 460));
  await page.waitForFunction(() => { const g = window.__scribble(); return Math.abs(g.lead.x - 672) < 4 && !g.lead.target; });
  await write(page, 'ladder');
  await page.waitForFunction(() => window.__scribble().ents.some((e) => e.noun === 'ladder'));
  assert.equal(await page.getByTestId('count').textContent(), '1 word · par 1');
  await page.mouse.click(...at(box, 862, 320));
  await page.waitForSelector('[data-testid="won"]');
  assert.equal(await page.locator('[data-testid="won"] .sc-stars path.on').count(), 3, 'three stars at par');
  await page.screenshot({ path: '.checks/scribble/won.png' });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('chinchilla-scribble-v1')).levels[0].stars), 3, 'the stars are saved');

  // Level 2: keyboard only. Write with Enter, steer with the arrows, and drag a thing with the mouse.
  await page.getByTestId('next').click();
  await page.waitForSelector('[data-testid="world"][data-state="playing"]');
  await game(page, 'g => g.def.name').then((n) => assert.equal(n, 'The cliff'));
  await page.getByTestId('world').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__scribble().lead.x > 690);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.type('giant box');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__scribble().ents.some((e) => e.label === 'giant box'));
  const boxThing = await game(page, 'g => { const e = g.ents.find((x) => x.label === "giant box"); return { x: e.x, y: e.y, h: e.h }; }');
  box = await world(page).boundingBox();
  await page.mouse.move(...at(box, boxThing.x, boxThing.y - boxThing.h / 2));
  await page.mouse.down();
  await page.mouse.move(...at(box, 300, 300), { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => { const e = window.__scribble().ents.find((x) => x.label === 'giant box'); return e.x < 360 && e.grounded; });
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => !window.__scribble().ents.some((e) => e.label === 'giant box'));
  await page.getByTestId('world').focus();
  await page.keyboard.press('q');
  assert.equal(await world(page).getAttribute('data-leader'), 'enzo', 'Q swaps to Enzo');
  await page.keyboard.press('Enter');
  await page.keyboard.type('flying carpet');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__scribble().ents.some((e) => e.noun === 'magic carpet'));
  await page.mouse.click(...at(box, 862, 240));
  await page.waitForFunction(() => window.__scribble().lead.riding !== null);
  await page.waitForSelector('[data-testid="won"]');
  assert.equal(await page.locator('[data-testid="won"] .sc-stars path.on').count(), 2, 'two words over a par of 1 is two stars');

  // The sandbox and the word book.
  await page.getByRole('button', { name: 'Levels' }).last().click();
  await page.getByRole('button', { name: /Word book/ }).click();
  assert.match(await page.locator('.sc-book').textContent(), /ladder/);
  await page.getByTestId('sandbox').click();
  await page.waitForSelector('[data-testid="world"][data-state="playing"]');
  for (const w of ['frozen dragon', 'sleepy bear', 'rainbow', 'striped rocket']) await write(page, w);
  await page.waitForFunction(() => window.__scribble().summons.length === 4);
  await page.waitForTimeout(600);
  await page.screenshot({ path: '.checks/scribble/sandbox.png' });
  await page.close();

  // A phone: the page fits, and a tap walks.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/scribble`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="level-1"]').disabled);
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling on the home screen');
  await phone.getByTestId('level-1').tap();
  await phone.waitForSelector('[data-testid="world"][data-state="playing"]');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scrolling in a level');
  box = await world(phone).boundingBox();
  await phone.touchscreen.tap(...at(box, 500, 460));
  await phone.waitForFunction(() => window.__scribble().lead.x > 400);
  await phone.screenshot({ path: '.checks/scribble/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log('Passed: menu card, level lock, did-you-mean, click to walk and climb, stars and saving, keyboard steering, dragging, deleting, swapping, riding, the word book, the sandbox and phone taps.');
} finally {
  await browser.close();
}
