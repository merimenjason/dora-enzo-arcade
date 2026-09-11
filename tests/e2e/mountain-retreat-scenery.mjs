import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const start = Date.parse('2026-09-10T00:00:00Z');
// Visit 14 is a regular (every fifth visit): Luna the stargazer, whose wish needs no item.
const lodge = {
  version: 2,
  savedAt: start,
  coins: 500,
  hearts: 40,
  supplies: 150,
  rooms: [3, 3, 3, 3],
  perks: [1, 0, 0, 1],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 0,
  served: 40,
  visits: 14,
  reputation: 30,
  pantry: { oatcake: 5, soap: 5 },
  album: [1, 1, 1, 1, 0, 0, 1],
  friends: [0, 0, 0],
  decor: 6,
  activity: null,
  festivals: 0,
  expeditions: 1,
  last: null,
};
const browser = await chromium.launch();
const errors = [];
const open = async (save, options = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, ...options });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 500);
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(save)]);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  return page;
};
// CSS animations run in real time, not on the paused page clock.
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const panel = (page, name) =>
  page.locator('.mr-scene-panel').screenshot({ path: `.checks/mountain-retreat/scenery-${name}.png` });
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });
  const day = await open(lodge);
  assert.equal(await day.locator('.mr-weather.petals i').count(), 12);
  assert.ok(!(await day.locator('.mr-sky-stars').isVisible()), 'no stars by day');
  assert.equal(await day.getByTestId('viscacha').count(), 1, 'the viscacha drops by once it is in the album');
  assert.deepEqual(
    await day.locator('.mr-perk-art').evaluateAll((els) => els.map((el) => el.getAttribute('class').split(' ')[1]).sort()),
    ['perk-0-1', 'perk-1-0', 'perk-2-0', 'perk-3-1'],
  );
  assert.deepEqual(
    await day.locator('.mr-trophy').evaluateAll((els) => els.map((el) => el.getAttribute('title'))),
    ['pennant', 'wind chime', 'lantern', 'garden gnome', 'flower box', 'weathervane'],
  );
  assert.match(await day.locator('.mr-chimney').getAttribute('class'), /smoke-1/);
  assert.match(await day.getByTestId('next-guest').locator('.mr-chin').getAttribute('class'), /kind-stargazer/);

  // Arrivals: the featured guest wears their accessory, shows a wish and a name tag.
  await day.clock.runFor(3000);
  const featured = day.locator('.mr-arrivals > .featured');
  assert.match(await featured.locator('.mr-chin').getAttribute('class'), /kind-stargazer/);
  assert.equal(await featured.locator('.mr-wish-bubble').textContent(), '☾');
  assert.equal(await featured.locator('.mr-nametag').textContent(), 'Luna');
  assert.equal(await day.locator('.mr-arrivals .mr-chin[class*="kind-"]').count(), 4);
  await settle(1400);
  await panel(day, 'arriving');

  // Staying: Luna hops in the suite, guests chat with the hosts, the chimney smokes harder.
  await day.clock.runFor(3000);
  assert.equal(await day.locator('.room-2 .mr-visitor.featured.regular.hop').count(), 1);
  assert.equal(await day.locator('.room-2 .mr-nametag').textContent(), 'Luna');
  assert.equal(await day.locator('.mr-room .mr-visitor .mr-chin[class*="kind-"]').count(), 4);
  assert.ok((await day.locator('.mr-chat').count()) >= 1, 'a guest chats with a host in the same room');
  assert.match(await day.locator('.mr-chimney').getAttribute('class'), /smoke-3/);
  assert.equal(await day.getByRole('img', { name: /chinchilla/ }).count(), 4, 'scenery stays decorative');
  await settle(800);
  await panel(day, 'day');

  // Outings each get their own backdrop.
  await day.getByRole('tab', { name: /^Trips/ }).click();
  await day.getByRole('button', { name: /Paddle to the lake/ }).click();
  assert.ok(await day.locator('.mr-trail-hosts.lake .mr-outing-prop').isVisible());
  await panel(day, 'lake');
  await day.clock.runFor(25000);
  await day.getByRole('button', { name: /Climb the summit/ }).click();
  assert.ok(await day.locator('.mr-trail-hosts.summit').isVisible());
  await day.clock.runFor(90000);
  await day.getByRole('button', { name: /Host a festival/ }).click();
  assert.ok(await day.locator('.mr-trail-hosts.festival').isVisible());
  await panel(day, 'festival');
  await day.close();

  // Night: stars, a stargazer on the roof, sleepy guests.
  const night = await open({ ...lodge, elapsed: 84, visits: 10 });
  assert.ok(await night.locator('.mr-sky-stars').isVisible());
  assert.equal(await night.locator('.mr-roof-guest .kind-stargazer').count(), 1);
  assert.equal(await night.getByTestId('viscacha').count(), 0, 'the viscacha keeps daylight hours');
  await night.clock.runFor(6000);
  assert.equal(await night.locator('.mr-zzz').count(), 4);
  assert.equal(await night.locator('.mr-chat').count(), 0);
  await settle(800);
  await panel(night, 'night');
  await night.close();

  // Each season has its weather.
  for (const [elapsed, weather] of [[400, 'butterflies'], [720, 'leaves'], [1085, 'snow']]) {
    const page = await open({ ...lodge, elapsed, album: [1, 1, 1, 1, 0, 0, 0] });
    assert.equal(await page.locator(`.mr-weather.${weather}`).count(), 1);
    if (weather === 'snow') await panel(page, 'winter');
    await page.close();
  }

  // A guest turned away for lack of supplies walks off down the path.
  const empty = await open({ ...lodge, supplies: 0, enzo: 'craft', elapsed: 396, pantry: { oatcake: 0, soap: 0 } });
  await empty.clock.runFor(6000);
  assert.match(await empty.getByTestId('scene-status').textContent(), /TURNED AWAY/);
  assert.equal(await empty.locator('.mr-sad .mr-chin[class*="kind-"]').count(), 1);
  await empty.close();

  // Reduced motion hides the falling weather; narrow screens stay contained.
  const calm = await open(lodge, { reducedMotion: 'reduce', viewport: { width: 390, height: 900 } });
  assert.equal(await calm.locator('.mr-weather').evaluate((el) => getComputedStyle(el).display), 'none');
  assert.ok(await calm.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow at 390');
  await panel(calm, '390');
  await calm.close();

  assert.deepEqual(errors, []);
  console.log('Mountain Retreat scenery: guest accessories, wish bubbles, regular name tags and hops, chat, smoke, specialty art, six decorations, outing backdrops, night stars and roof stargazer, sleepy guests, seasonal weather, viscacha visits, turned-away walk-off, reduced motion.');
} finally {
  await browser.close();
}
