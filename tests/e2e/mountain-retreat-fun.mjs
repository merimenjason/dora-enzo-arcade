import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const start = Date.parse('2026-09-10T00:00:00Z');
// Visit 14 is a regular (every fifth visit): Luna the stargazer, staying in the suite.
const lodge = {
  version: 3,
  savedAt: start,
  coins: 500,
  hearts: 40,
  supplies: 150,
  rooms: [3, 3, 3, 3],
  // The bath's specialty stays unchosen, so only the "Every room open" goal is met on the first tick.
  perks: [1, 0, 0, -1],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 0,
  served: 40,
  visits: 14,
  reputation: 30,
  pantry: { oatcake: 3, soap: 3 },
  album: [0, 0, 0, 0, 0, 0, 0],
  friends: [0, 0, 1],
  decor: 0,
  activity: null,
  festivals: 0,
  expeditions: 0,
  last: null,
  treat: { visit: 0, rooms: 0 },
  goals: 0,
  event: null,
  rescues: 0,
  perfectPours: 0,
  teaReadyAt: 0,
  catchReadyAt: 0,
};
const browser = await chromium.launch();
// The lodge's controls live in tabs; open one before using what is inside it.
const tab = (p, name) => p.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
const errors = [];
const open = async (save, options = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, ...options });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 500);
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v);
      localStorage.removeItem('mountain-retreat-scrapbook');
    },
    [key, JSON.stringify(save)],
  );
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  return page;
};
const notice = (page) => page.locator('.mr-notice').textContent();
const hearts = async (page) => Number(await page.getByTestId('hearts').textContent());
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });
  const page = await open(lodge);

  // Favicon: the new pixel icon is linked and served.
  assert.equal(await page.locator('link[rel="icon"]').first().getAttribute('href'), '/favicon.svg');
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'), '/apple-touch-icon.png');
  for (const path of ['/favicon.svg', '/apple-touch-icon.png'])
    assert.equal((await page.request.get(`${base}${path}`)).status(), 200, path);

  // Goals: opening every room is met on the first tick, with a keepsake and a notice.
  await page.clock.runFor(1000);
  await tab(page, 'Goals');
  assert.match(await page.getByTestId('goal-0').getAttribute('class'), /done/);
  assert.match(await notice(page), /Goal complete: Every room open/);
  await tab(page, 'Hosts');
  assert.equal(await page.getByTestId('keepsakes').locator('i').count(), 1);
  assert.equal(await page.getByTestId('lodge-title').textContent(), 'MOUNTAIN HUT');

  // Profiles: every guest opens one; the featured regular can be spoiled once.
  await page.clock.runFor(5000);
  assert.ok((await page.getByRole('button', { name: /: open profile$/ }).count()) >= 5);
  await page.locator('.room-2 .mr-guest-btn').click();
  const profile = page.getByTestId('guest-profile');
  assert.match(await profile.locator('h3').textContent(), /^Luna STARGAZER/);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'mr-profile-name');
  assert.match(await page.getByTestId('profile-status').textContent(), /Staying in the Starlight suite\. Their wish was granted/);
  assert.match(await profile.textContent(), /Friendship 2 \/ 10/);
  const before = await hearts(page);
  await profile.getByRole('button', { name: /Offer oat cake/ }).click();
  assert.equal(await hearts(page), before + 3);
  assert.match(await notice(page), /Luna loved the oat cake/);
  assert.match(await profile.textContent(), /Friendship 3 \/ 10/);
  assert.ok(await profile.getByRole('button', { name: /Offer herbal soap/ }).isDisabled(), 'one treat per guest per visit');
  await page.screenshot({ path: '.checks/mountain-retreat/fun-profile.png', fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await profile.count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'mr-guest-btn', 'focus returns to the guest');
  await page.locator('.room-0 .mr-guest-btn').click();
  assert.doesNotMatch(await profile.locator('h3').textContent(), /Luna/);
  assert.match(await page.getByTestId('profile-status').textContent(), /Staying in the Hearth & tea/);
  await profile.getByRole('button', { name: 'Close profile' }).click();
  await page.getByTestId('visit-ring').locator('.mr-guest-btn').click();
  assert.match(await page.getByTestId('profile-status').textContent(), /On the way up, hoping for/);
  await page.keyboard.press('Escape');

  // Mini-games: stop the pour dead centre, then catch two petals.
  await tab(page, 'Fun');
  await page.getByRole('button', { name: 'Pour tea ↗' }).click();
  await page.clock.runFor(560);
  await page.getByRole('button', { name: 'Stop pouring' }).click();
  assert.match(await notice(page), /Goal complete: Perfect pour/);
  await tab(page, 'Goals');
  assert.match(await page.getByTestId('goal-8').getAttribute('class'), /done/);
  await tab(page, 'Fun');
  assert.match(await page.getByRole('button', { name: /Kettle warming · 60s/ }).textContent(), /60s/);
  await page.getByRole('button', { name: 'Catch the petals ↗' }).click();
  await page.clock.runFor(1000);
  const items = page.locator('.mr-catch-item');
  assert.equal(await items.count(), 2);
  // The items fall on a real-time CSS animation, so a positional click can miss; dispatch the event instead.
  await items.first().dispatchEvent('click');
  await items.first().dispatchEvent('click');
  assert.match(await page.getByTestId('catch-field').textContent(), /2 caught/);
  await page.clock.runFor(8000);
  assert.match(await notice(page), /You caught 2! \+2 tips/);

  // Scrapbook: a snap redraws the lodge, captions are editable and survive a reload.
  await page.getByTestId('snap').click();
  await tab(page, 'Scrapbook');
  const photo = page.getByTestId('photo');
  assert.equal(await photo.count(), 1);
  assert.ok((await photo.locator('.mr-photo-scene .mr-chin').count()) >= 2);
  await photo.getByLabel('Photo caption').fill('Tea with Luna');
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  await tab(page, 'Scrapbook');
  assert.equal(await page.getByTestId('photo').getByLabel('Photo caption').inputValue(), 'Tea with Luna');
  await page.screenshot({ path: '.checks/mountain-retreat/fun-desktop.png', fullPage: true });
  await page.getByTestId('photo').getByRole('button', { name: 'Remove photo' }).click();
  assert.equal(await page.getByTestId('photo').count(), 0);
  await page.close();

  // Events: a storm pays shelter bonuses, a musician plays, a lost hiker is rescued.
  const storm = await open({ ...lodge, event: { kind: 'storm', remaining: 40 } });
  assert.match(await storm.getByTestId('landscape').getAttribute('class'), /storm/);
  assert.equal(await storm.locator('.mr-weather.rain').count(), 1);
  assert.match(await storm.getByTestId('event').textContent(), /Mountain storm/);
  await storm.getByLabel('Where tips come from').click();
  assert.match(await storm.locator('.mr-wallet').textContent(), /Storm shelter \(\+50%\)/);
  await storm.close();
  const music = await open({ ...lodge, event: { kind: 'musician', remaining: 30 } });
  await music.getByTestId('musician').locator('.mr-guest-btn').click();
  assert.match(await music.getByTestId('profile-status').textContent(), /charango/);
  await music.close();
  const lost = await open({ ...lodge, event: { kind: 'lost', remaining: 60 } });
  assert.equal(await lost.locator('.mr-lost-signal').count(), 1);
  await lost.getByRole('button', { name: /Rescue the hiker/ }).click();
  assert.match(await lost.locator('.mr-trail-hosts.rescue').textContent(), /Rescuing a lost hiker/);
  await lost.clock.runFor(20000);
  await tab(lost, 'Goals');
  assert.match(await lost.getByTestId('goal-7').getAttribute('class'), /done/);
  assert.equal(await lost.getByTestId('event').count(), 0);
  await lost.close();

  // Narrow screens with a profile open stay contained.
  const narrow = await open(lodge, { viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  await narrow.clock.runFor(6000);
  await narrow.locator('.room-2 .mr-guest-btn').click();
  assert.ok(await narrow.getByTestId('guest-profile').isVisible());
  assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow at 390');
  await narrow.screenshot({ path: '.checks/mountain-retreat/fun-390.png', fullPage: true });
  await narrow.close();

  assert.deepEqual(errors, []);
  console.log('Mountain Retreat fun: favicon, guest profiles and treats, goals and keepsakes, storm, musician and rescue events, tea and catch mini-games, scrapbook, narrow layout.');
} finally {
  await browser.close();
}
