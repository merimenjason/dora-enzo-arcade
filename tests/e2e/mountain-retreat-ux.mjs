import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const start = Date.parse('2026-09-10T00:00:00Z');
const lodge = {
  version: 2,
  savedAt: start,
  coins: 500,
  hearts: 40,
  supplies: 120,
  rooms: [3, 3, 3, 3],
  perks: [1, -1, -1, -1],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 0,
  served: 40,
  visits: 12,
  reputation: 30,
  pantry: { oatcake: 3, soap: 3 },
  album: [0, 0, 0, 0, 0, 0, 0],
  friends: [0, 0, 0],
  decor: 2,
  activity: null,
  festivals: 0,
  expeditions: 0,
  last: null,
};
const browser = await chromium.launch();
const errors = [];
const open = async (options, save) => {
  const page = await browser.newPage(options);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: start });
  // Freeze page time so countdowns only move when the test steps the clock.
  await page.clock.pauseAt(start + 500);
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  await page.evaluate(([k, v]) => {
    localStorage.setItem(k, v);
    localStorage.removeItem('mountain-retreat-sound');
  }, [key, JSON.stringify(save)]);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  return page;
};
const pressed = (page, name) =>
  page.getByRole('button', { name }).getAttribute('aria-pressed');
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });
  const page = await open({ viewport: { width: 1440, height: 1100 } }, lodge);

  // Explanations: every figure opens a breakdown that matches the card.
  const perVisit = Number((await page.locator('.mr-wallet > div').first().locator('small').first().textContent()).match(/\+(\d+)/)[1]);
  await page.getByLabel('Where tips come from').click();
  const tipsPanel = page.locator('.mr-wallet > div').first().locator('.mr-why-panel');
  assert.ok(await tipsPanel.isVisible());
  assert.match(await tipsPanel.textContent(), new RegExp(`next visit pays \\+${perVisit} tips`));
  assert.match(await tipsPanel.textContent(), /Room levels \(12 × 2\)\+24 ✦/);
  assert.match(await tipsPanel.textContent(), /Tea stall\+3 ✦/);
  await page.getByLabel('Where supplies come from and go').click();
  assert.match(await page.locator('.mr-wallet').textContent(), /Enzo gathering\+3 ▧.*per minute/);
  await page.getByLabel('How reputation works').click();
  assert.match(await page.locator('.mr-wallet').textContent(), /10 more reputation for 3 stars/);
  await page.getByLabel('Where hearts come from').click();
  assert.match(await page.locator('.mr-wallet').textContent(), /Welcome \(4 rooms × 1\)\+4 ♥/);

  // Season strip and countdown ring.
  assert.match(await page.getByTestId('season-timeline').textContent(), /Summer in 6:00 · Nightfall in 1:20/);
  assert.match(await page.locator('.mr-year li[aria-current]').textContent(), /spring/);
  const ring = () => page.getByTestId('visit-ring').evaluate((el) => Number(el.style.getPropertyValue('--p')));
  assert.equal(await ring(), 0);
  await page.clock.runFor(3000);
  assert.equal(await ring(), 0.5);

  // New coat: an empty album makes every guest new, and the visit celebrates it.
  assert.ok(await page.getByTestId('new-coat').isVisible());
  await page.clock.runFor(3000);
  assert.match(await page.locator('.mr-notice').textContent(), /New in the album: /);
  assert.equal(await page.locator('.mr-visitor.new-coat').count(), 1);
  assert.match(await page.getByTestId('visit-float').textContent(), /^\+\d+ ✦ \+\d+ ♥$/);
  await page.screenshot({ path: '.checks/mountain-retreat/ux-desktop.png', fullPage: true });
  await page.clock.runFor(2000);
  assert.equal(await page.getByTestId('visit-float').count(), 0, 'floater clears after the moment');

  // Keyboard shortcuts, ignored while typing into a form control.
  await page.keyboard.press('2');
  assert.equal(await pressed(page, /Extra comfort/), 'true');
  await page.keyboard.press('4');
  assert.equal(await pressed(page, /Craft with care/), 'true');
  await page.getByLabel('Color theme').focus();
  await page.keyboard.press('1');
  assert.equal(await pressed(page, /Extra comfort/), 'true', 'shortcuts ignore the theme select');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('1');
  await page.keyboard.press('3');
  assert.equal(await pressed(page, /^Welcome/), 'true');
  assert.equal(await pressed(page, /^Gather/), 'true');
  assert.equal(await page.getByRole('button', { name: /Extra comfort/ }).getAttribute('aria-keyshortcuts'), '2');

  // Sound: off by default, remembered once switched on.
  assert.equal(await page.getByTestId('sound').getAttribute('aria-pressed'), 'false');
  await page.getByTestId('sound').click();
  assert.equal(await page.getByTestId('sound').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('mountain-retreat-sound')), 'on');
  await page.clock.runFor(6000);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  assert.match(await page.getByTestId('sound').textContent(), /Sound on/);

  // Welcome-back summary after ten minutes away.
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.savedAt = Date.now() - 10 * 60000;
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  const summary = page.getByTestId('away-summary');
  assert.match(await summary.textContent(), /While you were away · 10 min/);
  assert.match(await summary.textContent(), /\d+ guest visits/);
  assert.match(await summary.textContent(), /\+\d+ tips/);
  assert.match(await page.locator('.mr-notice').textContent(), /10 minutes away/);
  await page.getByRole('button', { name: 'Back to the lodge' }).click();
  assert.equal(await summary.count(), 0);
  await page.close();

  for (const width of [320, 390]) {
    const narrow = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }, { ...lodge, savedAt: start - 5 * 60000 });
    assert.ok(await narrow.getByTestId('away-summary').isVisible());
    for (const label of ['Where tips come from', 'Where supplies come from and go', 'How reputation works'])
      await narrow.getByLabel(label).click();
    assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width}`);
    if (width === 390) await narrow.screenshot({ path: '.checks/mountain-retreat/ux-390.png', fullPage: true });
    await narrow.close();
  }
  assert.deepEqual(errors, []);
  console.log('Mountain Retreat UX: breakdowns, season strip, countdown ring, new-coat cues, visit floaters, keyboard shortcuts, sound preference, welcome-back summary, narrow layouts.');
} finally {
  await browser.close();
}
