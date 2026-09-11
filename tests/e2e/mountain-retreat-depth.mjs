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
  perks: [-1, -1, -1, -1],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 76,
  served: 40,
  visits: 12,
  // Two stars with headroom, so an unmet wish during the test cannot close the summit.
  reputation: 30,
  pantry: { oatcake: 0, soap: 0 },
  album: [1, 0, 0, 0, 0, 0, 0],
  friends: [2, 0, 0],
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
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(save)]);
  await page.reload();
  await page.locator('fieldset:not([disabled])').first().waitFor();
  return page;
};
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });
  const page = await open({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' }, lodge);
  const text = (id) => page.getByTestId(id).textContent();

  assert.equal(await page.getByTestId('rating').getAttribute('aria-label'), '2 of 5 stars');
  assert.match(await text('rating'), /^★★☆☆☆$/);
  assert.match(await text('season'), /SPRING · ☼ DAY/);
  assert.match(await text('next-guest'), /Next guest.*hopes for the/);
  assert.match(await text('pantry'), /0 oat cakes · ❀ 0 herbal soap/);
  assert.equal(await page.locator('.mr-bunting i').count(), 2);

  // Nightfall at lodge second 80.
  await page.clock.runFor(5000);
  assert.match(await text('season'), /☾ NIGHT/);
  assert.match(await page.getByTestId('landscape').getAttribute('class'), /season-spring night/);

  // Level-3 rooms offer two specialties; picking one is permanent.
  assert.equal(await page.locator('.mr-perk-choice button').count(), 8);
  await page.getByRole('button', { name: /Tea stall/ }).click();
  assert.match(await text('perk-0'), /Tea stall/);
  assert.equal(await page.locator('.mr-perk-choice button').count(), 6);
  assert.match(await page.locator('.mr-notice').textContent(), /Hearth & tea: Tea stall/);

  // Three trails; the lake stocks the pantry.
  for (const name of [/Paddle to the lake/, /Take an expedition/, /Climb the summit/])
    assert.ok(await page.getByRole('button', { name }).isEnabled());
  await page.getByRole('button', { name: /Paddle to the lake/ }).click();
  assert.match(await page.locator('.mr-trail-hosts').textContent(), /Exploring Glass lake/);
  assert.match(await page.locator('.mr-activity').textContent(), /Glass lake · 25s remaining/);
  await page.clock.runFor(25000);
  assert.match(await page.locator('.mr-notice').textContent(), /Home from Glass lake/);
  assert.match(await text('pantry'), /1 oat cake · ❀ 1 herbal soap/);

  // Guests keep coming: the guest book reports the last one and the album fills.
  await page.clock.runFor(12000);
  assert.match(await text('last-guest'), /^Last: /);
  assert.ok(Number((await page.locator('.mr-album .mr-section-title > span').textContent()).match(/(\d+) \//)[1]) >= 1);
  assert.equal(await page.getByRole('progressbar', { name: /Friendship with/ }).count(), 3);
  assert.equal(await page.getByRole('heading', { name: 'Everyone who stayed.' }).count(), 1);
  assert.equal(await page.getByRole('img', { name: /chinchilla/ }).count(), 4, 'album and guest book art stay decorative');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
  assert.equal(saved.version, 2);
  assert.equal(saved.perks[0], 1);
  await page.screenshot({ path: '.checks/mountain-retreat/depth-desktop.png', fullPage: true });
  await page.close();

  // Winter closes the summit.
  const winter = await open({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' }, { ...lodge, elapsed: 1080 });
  assert.match(await winter.getByTestId('season').textContent(), /WINTER/);
  assert.ok(await winter.getByRole('button', { name: /Climb the summit/ }).isDisabled());
  assert.match(await winter.locator('.trail-summit').textContent(), /Snowed in until spring/);
  await winter.close();

  // A one-star lodge cannot climb yet, and a version-1 journal upgrades in place.
  const v1 = {
    version: 1,
    savedAt: start,
    coins: 30,
    hearts: 0,
    supplies: 60,
    rooms: [1, 0, 0, 0],
    dora: 'welcome',
    enzo: 'gather',
    elapsed: 0,
    served: 0,
    activity: null,
    festivals: 0,
    expeditions: 0,
  };
  const old = await open({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' }, v1);
  assert.doesNotMatch(await old.locator('.mr-notice').textContent(), /Unreadable/);
  assert.equal(await old.getByTestId('tips').textContent(), '30');
  assert.match(await old.locator('.trail-summit').textContent(), /Needs a 2-star lodge/);
  assert.equal((await old.evaluate((k) => JSON.parse(localStorage.getItem(k)), key)).version, 2);
  await old.close();

  for (const width of [320, 390, 768]) {
    for (const theme of ['light', 'dark']) {
      const narrow = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' }, lodge);
      await narrow.getByLabel('Color theme').selectOption(theme);
      assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width} (${theme})`);
      if (width === 390)
        await narrow.screenshot({ path: `.checks/mountain-retreat/depth-390-${theme}.png`, fullPage: true });
      await narrow.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log('Mountain Retreat depth: rating, guest book, pantry, night, specialties, trails, winter closure, album, regulars, v1 upgrade, narrow light/dark layouts.');
} finally {
  await browser.close();
}
