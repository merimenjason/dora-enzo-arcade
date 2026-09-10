import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-09-10T00:00:00Z') });
  await page.goto(`${base}/mountain-retreat`);
  const ready = async (p) => {
    await p
      .getByRole('button', { name: /Extra comfort/ })
      .and(p.locator('fieldset:not([disabled]) button'))
      .waitFor();
  };
  await ready(page);
  await page.evaluate((k) => {
    localStorage.removeItem(k);
    localStorage.setItem('other-game-sentinel', 'unchanged');
  }, key);
  await page.reload();
  await ready(page);
  assert.equal(await page.getByTestId('tips').textContent(), '25');
  assert.equal(
    await page.getByRole('img', { name: 'Dora, white chinchilla' }).count(),
    2,
  );
  assert.equal(
    await page.getByRole('img', { name: 'Enzo, grey chinchilla' }).count(),
    2,
  );
  await page.clock.runFor(90000);
  await page
    .getByRole('button', { name: 'Open room · 55 tips', exact: true })
    .click();
  assert.match(
    await page.getByTestId('room-1').getAttribute('class'),
    /unlocked/,
  );
  await page.getByRole('button', { name: /Extra comfort/ }).focus();
  await page.keyboard.press('Enter');
  assert.equal(
    await page
      .getByRole('button', { name: /Extra comfort/ })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('button', { name: /Craft with care/ }).click();
  await page.clock.runFor(10000);
  await page.getByRole('button', { name: /Take an expedition/ }).click();
  const tips = Number(await page.getByTestId('tips').textContent());
  await page.clock.runFor(44000);
  assert.equal(Number(await page.getByTestId('tips').textContent()), tips);
  assert.ok(
    await page.getByRole('button', { name: /Extra comfort/ }).isDisabled(),
  );
  await page.clock.runFor(1000);
  assert.equal(Number(await page.getByTestId('tips').textContent()), tips + 35);
  await page.getByRole('button', { name: /Host a festival/ }).click();
  const beforeFestival = Number(await page.getByTestId('tips').textContent());
  await page.clock.runFor(60000);
  assert.equal(
    Number(await page.getByTestId('tips').textContent()),
    beforeFestival + 110,
  );
  await page.reload();
  await ready(page);
  assert.match(
    await page.getByTestId('room-1').getAttribute('class'),
    /unlocked/,
  );
  assert.equal(
    await page
      .getByRole('button', { name: /Craft with care/ })
      .getAttribute('aria-pressed'),
    'true',
  );
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k));
    s.savedAt = Date.now() - 24 * 3600000;
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  await page.reload();
  await ready(page);
  assert.match(
    await page.locator('.mr-notice').textContent(),
    /480 minutes away/,
  );
  const offlineTips = await page.getByTestId('tips').textContent();
  await page.reload();
  await ready(page);
  assert.equal(await page.getByTestId('tips').textContent(), offlineTips);
  await page
    .getByRole('button', { name: 'Open room · 120 tips', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open room · 220 tips', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Improve · 35 tips', exact: true })
    .click();
  assert.equal(await page.locator('.mr-room.unlocked').count(), 4);
  assert.equal(await page.locator('.room-0 .mr-decor').count(), 1);
  assert.equal(
    await page
      .locator('.dora-host')
      .evaluate((el) => getComputedStyle(el).animationName),
    'none',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(
    await page
      .locator('.dora-host')
      .evaluate((el) => getComputedStyle(el).animationName),
    'mr-bob',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir('.checks/mountain-retreat', { recursive: true });
  await page.screenshot({
    path: '.checks/mountain-retreat/desktop.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: /MAIN ARCADE/ }).click();
  assert.equal(await page.locator('.arcade-card').count(), 12);
  await page.locator('a[href="/mountain-retreat"]').click();
  await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, '{"savedAt":"bad"}'), key);
  await page.reload();
  await ready(page);
  assert.match(
    await page.locator('.mr-notice').textContent(),
    /Unreadable journal/,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('other-game-sentinel')),
    'unchanged',
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no overflow at ${width}`,
    );
  }
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  mobile.on('pageerror', (e) => errors.push(e.message));
  await mobile.goto(`${base}/mountain-retreat`);
  await ready(mobile);
  await mobile.getByRole('button', { name: /Extra comfort/ }).tap();
  assert.equal(
    await mobile
      .getByRole('button', { name: /Extra comfort/ })
      .getAttribute('aria-pressed'),
    'true',
  );
  await mobile.getByRole('button', { name: /Field guide/ }).tap();
  assert.ok(
    await mobile
      .getByRole('heading', { name: 'Your first 5–10 minutes' })
      .isVisible(),
  );
  await mobile.getByRole('button', { name: /Field guide/ }).tap();
  await mobile.screenshot({
    path: '.checks/mountain-retreat/mobile.png',
    fullPage: true,
  });
  const blocked = await browser.newPage();
  blocked.on('pageerror', (e) => errors.push(e.message));
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await blocked.goto(`${base}/mountain-retreat`);
  await ready(blocked);
  assert.match(
    await blocked.locator('.mr-footer').textContent(),
    /Storage unavailable/,
  );
  await blocked.getByRole('button', { name: /Take an expedition/ }).click();
  assert.ok(
    await blocked
      .getByRole('progressbar', { name: 'Activity progress' })
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS Mountain Retreat browser: idle income, unlock, keyboard allocations, expedition/festival pauses and rewards, persistence, offline cap/no double claim, malformed/blocked storage, unrelated save preservation, 12-card navigation, 320/390/768 responsive widths, touch and reduced motion.',
  );
} finally {
  await browser.close();
}
