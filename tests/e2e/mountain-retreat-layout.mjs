import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const start = Date.parse('2026-09-10T00:00:00Z');
const lodge = {
  version: 4,
  savedAt: start,
  coins: 500,
  hearts: 40,
  supplies: 150,
  rooms: [3, 3, 3, 3],
  perks: [1, 0, 0, -1],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 0,
  served: 40,
  visits: 12,
  reputation: 30,
  pantry: { oatcake: 3, soap: 3 },
  album: [1, 1, 1, 1, 0, 0, 0],
  friends: [3, 0, 0],
  decor: 2,
  activity: null,
  festivals: 0,
  expeditions: 0,
  last: null,
  treat: { visit: 0, rooms: 0 },
  goals: 1,
  event: null,
  rescues: 0,
  perfectPours: 0,
  teaReadyAt: 0,
  catchReadyAt: 0,
  xp: { dora: 29, enzo: 0 },
  skills: { dora: [-1, -1, -1, -1], enzo: [-1, -1, -1, -1] },
  daily: { day: 0, progress: [0, 0, 0], claimed: false },
  quests: [0, 0, 0],
  questProgress: [0, 0, 0],
  festivalSeasons: 0,
};
const TABS = ['Hosts', 'Rooms', 'Trips', 'Fun', 'Guests', 'Goals', 'Scrapbook'];
const browser = await chromium.launch();
const errors = [];
const open = async (save, viewport = { width: 1280, height: 720 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 500);
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  // The page's own calendar day, so a seeded wish list belongs to "today".
  const day = await page.evaluate(() =>
    Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000),
  );
  const seeded = typeof save === 'function' ? save(day) : save;
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(seeded)]);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  return page;
};
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const fits = (page) =>
  page.evaluate(() => ({
    tall: document.documentElement.scrollHeight <= innerHeight,
    wide: document.documentElement.scrollWidth <= innerWidth,
  }));
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });

  // One screen: no page scroll at common laptop sizes, whichever tab is open.
  for (const viewport of [
    { width: 1024, height: 640 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    const page = await open(lodge, viewport);
    for (const name of TABS) {
      await tab(page, name).click();
      assert.deepEqual(await fits(page), { tall: true, wide: true }, `${name} fits ${viewport.width}×${viewport.height}`);
    }
    await page.getByRole('button', { name: /Field guide/ }).click();
    assert.deepEqual(await fits(page), { tall: true, wide: true }, `guide fits ${viewport.width}×${viewport.height}`);
    await page.getByRole('button', { name: /Field guide/ }).click();
    await tab(page, 'Hosts').click();
    await page.screenshot({ path: `.checks/mountain-retreat/layout-${viewport.width}x${viewport.height}.png` });
    await page.close();
  }

  const page = await open((day) => ({ ...lodge, daily: { day, progress: [99, 99, 0], claimed: false } }));

  // Tabs: one panel at a time, arrow keys and Home/End move between them.
  assert.equal(await page.getByRole('tabpanel').count(), 1);
  await tab(page, 'Hosts').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tab(page, 'Rooms').getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mr-tab-rooms');
  await page.keyboard.press('End');
  assert.equal(await tab(page, 'Scrapbook').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await tab(page, 'Hosts').getAttribute('aria-selected'), 'true', 'wraps around');
  assert.match(await tab(page, 'Rooms').textContent(), /●/, 'a specialty is waiting');

  // Host skills: Dora levels up from her next guest and picks a skill.
  await page.clock.runFor(6000);
  assert.match(await page.locator('.mr-notice').textContent(), /Dora reached level 2/);
  assert.match(await tab(page, 'Hosts').textContent(), /●/);
  const dora = page.getByTestId('skills-dora');
  assert.match(await dora.textContent(), /Level 2/);
  await dora.getByRole('button', { name: /Tip jar/ }).click();
  assert.match(await dora.textContent(), /✓ Tip jar/);
  assert.equal(await dora.locator('.mr-skill-choice').count(), 0);
  await page.getByLabel('Where tips come from').click();
  assert.match(await page.locator('.mr-wallet').textContent(), /Tip jar\+2 ✦/);
  await page.getByLabel('Where tips come from').click();

  // Daily wish list: one request left; the claim waits until all three are done.
  await tab(page, 'Goals').click();
  assert.equal(await page.locator('[data-testid^="daily-"]').count(), 3);
  const claim = page.getByRole('button', { name: /Claim the wish list reward/ });
  assert.ok(await claim.isDisabled());
  await page.evaluate(([k]) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.daily.progress = [99, 99, 99];
    localStorage.setItem(k, JSON.stringify(s));
  }, [key]);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  assert.match(await tab(page, 'Goals').textContent(), /●/);
  await tab(page, 'Goals').click();
  const tips = Number(await page.getByTestId('tips').textContent());
  await page.getByRole('button', { name: /Claim the wish list reward/ }).click();
  assert.equal(Number(await page.getByTestId('tips').textContent()), tips + 100);
  assert.ok(await page.getByRole('button', { name: /Claimed for today/ }).isDisabled());

  // Regulars' stories: Pip (friendship 3) wants to see the lake.
  await tab(page, 'Guests').click();
  assert.match(await page.getByTestId('quest-0').textContent(), /Story 1 of 3: Pip wants to see Glass lake/);
  assert.match(await page.getByTestId('quest-1').textContent(), /unlocks at 3 friendship/);
  await tab(page, 'Trips').click();
  assert.match(await page.getByTestId('festival').textContent(), /Blossom fair/);
  await page.getByRole('button', { name: /Paddle to the lake/ }).click();
  await page.clock.runFor(25000);
  assert.match(await page.locator('.mr-notice').textContent(), /Pip’s story, part 1 of 3: done!/);
  await tab(page, 'Guests').click();
  assert.match(await page.getByTestId('quest-0').textContent(), /Story 2 of 3 unlocks at 6 friendship/);
  await page.screenshot({ path: '.checks/mountain-retreat/layout-guests.png' });
  await page.close();

  // Seasonal festivals and a narrow screen that falls back to a scrolling page.
  const winter = await open({ ...lodge, elapsed: 1080 });
  await tab(winter, 'Trips').click();
  assert.match(await winter.getByTestId('festival').textContent(), /Snow-lantern night.*\+10 reputation/);
  await winter.close();
  const phone = await open(lodge, { width: 390, height: 844 });
  for (const name of TABS) {
    await tab(phone, name).click();
    assert.ok((await fits(phone)).wide, `${name} has no sideways scroll at 390`);
  }
  await phone.screenshot({ path: '.checks/mountain-retreat/layout-390.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('Mountain Retreat layout: one screen at 1024×640 to 1920×1080 on every tab, tab keyboard navigation, host skills, daily wish list, regulars’ stories, seasonal festivals, phone fallback.');
} finally {
  await browser.close();
}
