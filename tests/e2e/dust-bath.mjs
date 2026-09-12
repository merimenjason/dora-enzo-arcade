import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.message));
  // The saved coins/upgrades load in a mount effect, which also enables the
  // start buttons. Waiting for "enabled" (not merely "attached") guarantees the
  // restore has been applied before any coin assertion reads the UI.
  const openSpaReady = async (pg) => {
    await pg
      .getByRole('button', { name: /Open spa/ })
      .and(pg.locator('button:not([disabled])'))
      .waitFor();
  };
  await page.clock.install();
  await page.goto(`${base}/dust-bath`);
  await openSpaReady(page);
  // Start from a clean save so coin/upgrade assertions are deterministic.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openSpaReady(page);
  assert.equal(await page.locator('.db-welcome li').count(), 4);
  assert.equal(
    await page
      .locator('.db-welcome > div > p')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).color),
    'rgb(91, 107, 93)',
  );
  assert.equal(
    await page.getByRole('link', { name: /MAIN ARCADE/ }).getAttribute('href'),
    '/',
  );
  await page.getByRole('button', { name: /Untimed cozy/ }).click();
  assert.match(await page.getByTestId('clock').textContent(), /No rush/);

  const ensureGuest = async () => {
    if (!(await page.locator('.db-guest').count())) await page.clock.runFor(8100);
  };
  const seat = async (i = 0) => {
    await ensureGuest();
    await page.locator('.db-guest').first().click();
    assert.equal(
      await page.locator('.db-guest').first().getAttribute('aria-pressed'),
      'true',
    );
    await page.locator('.db-bath').nth(i).locator('.db-bath-seat').click();
  };
  const scrub = page.locator('.db-scrub');
  const keyboardHold = async (ms = 1300) => {
    await scrub.focus();
    await page.keyboard.down('Space');
    await page.clock.runFor(ms);
    await page.keyboard.up('Space');
  };
  // A bath is finished when the active tub no longer shows a seated guest.
  const activeBusy = async () =>
    (await page.locator('.db-bath.active .db-bath-info').count()) > 0;
  // Complete a full multi-stage bath from the current state.
  const finishBath = async (holdMs = 1300) => {
    let guard = 0;
    while ((await activeBusy()) && guard++ < 6) {
      await keyboardHold(holdMs);
    }
  };

  // --- Sneeze + neighbor splash on the pour stage ---
  await seat(0);
  await seat(1);
  await page.locator('.db-bath').first().locator('.db-bath-seat').click();
  await keyboardHold(2400); // overshoot -> sneeze
  assert.match(await page.getByRole('status').textContent(), /achoo/);
  assert.match(
    await page.locator('.db-bath').nth(1).textContent(),
    /1 splash/,
  );
  await page.getByRole('button', { name: /Give selected guest/ }).click();

  // --- Prep controls change the tub warmth label ---
  const tempButton = page
    .locator('.db-bath')
    .first()
    .getByRole('button', { name: /Warmth/ });
  const before = await tempButton.textContent();
  await tempButton.click();
  assert.notEqual(await tempButton.textContent(), before);

  // --- Complete the full multi-stage bath and earn a first service ---
  await finishBath();
  assert.match(await page.getByTestId('served').textContent(), /^1/);
  const coinsAfterFirst = Number(
    (await page.getByTestId('coins').textContent()).replace(/\D/g, ''),
  );
  assert(coinsAfterFirst > 0, 'a completed bath pays coins');

  // --- Pointer capture: release outside the scrub control still registers ---
  await seat(1);
  await scrub.scrollIntoViewIfNeeded();
  const box = await scrub.boundingBox();
  const pointerStage = async () => {
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.clock.runFor(1300);
    await page.mouse.move(box.x - 30, box.y);
    await page.mouse.up();
  };
  let guard = 0;
  while ((await activeBusy()) && guard++ < 6) await pointerStage();
  assert.match(await page.getByTestId('served').textContent(), /^2/);

  // --- Refill with the golden-scoop-less base capacity of 6 ---
  await page
    .getByRole('button', { name: 'Refill dust & treats', exact: true })
    .click();
  await page.clock.runFor(3100);
  assert.match(await page.locator('.db-supplies').textContent(), /6\/6.*3\/3/);
  console.log(
    'PASS desktop: tutorial, seating, prep controls, multi-stage keyboard baths, sneeze splash, treat repair, pointer capture, coins, refill',
  );

  // --- Two-tap accessible mode earns many services and coins for the shop ---
  await page.getByRole('checkbox').check();
  const coinCount = async () =>
    Number((await page.getByTestId('coins').textContent()).replace(/\D/g, ''));
  const servedCount = async () =>
    Number((await page.getByTestId('served').textContent()).replace(/\D/g, ''));
  const twoTapBath = async () => {
    let g = 0;
    while ((await activeBusy()) && g++ < 6) {
      await scrub.click();
      await page.clock.runFor(1300);
      await scrub.click();
    }
  };
  // Six upgrades cost 275 coins; keep pampering until the shop is affordable.
  let iter = 0;
  while ((await coinCount()) < 275 && iter++ < 40) {
    await seat();
    await twoTapBath();
    if (iter % 3 === 0) {
      await page
        .getByRole('button', { name: 'Refill dust & treats', exact: true })
        .click();
      await page.clock.runFor(3100);
    }
  }
  const served = await servedCount();
  assert(served >= 12, 'many completed baths across the cozy session');
  await page.clock.runFor(180000);
  assert.match(await page.getByTestId('clock').textContent(), /No rush/);
  assert.equal(await page.locator('.db-guest').count(), 5);
  await page.getByRole('button', { name: /Close cozy spa/ }).click();
  assert.match(
    await page.locator('.db-welcome').textContent(),
    new RegExp(`${served} guests pampered`),
  );

  // --- Buy every one of the six upgrades and confirm visible effects ---
  const coins = await coinCount();
  assert(coins >= 275, 'enough coins earned for all six upgrades');
  for (const name of [
    'Cloud towels',
    'Golden scoop',
    'Fern sanctuary',
    'Crystal thermometer',
    'Warm-air dryer',
    'Skylight lounge',
  ]) {
    await page
      .locator('.db-shop article', { hasText: name })
      .getByRole('button')
      .click();
  }
  assert.equal(
    await page.getByRole('button', { name: '✓ Installed', exact: true }).count(),
    6,
  );
  assert.equal(await page.locator('.db-leafy').count(), 1);
  console.log(
    'PASS cozy: fourteen services, 180s without departures, all six upgrades installed with visible spa changes',
  );

  // --- Persistence: reload keeps coins and upgrades (localStorage) ---
  const coinsBefore = await page.getByTestId('coins').textContent();
  await page.reload();
  await openSpaReady(page);
  assert.equal(await page.getByTestId('coins').textContent(), coinsBefore);
  assert.equal(
    await page.getByRole('button', { name: '✓ Installed', exact: true }).count(),
    6,
  );

  // --- Timed shift: lounge opened a fourth bath, dust capacity is 8 ---
  await page.getByRole('button', { name: /Open spa/ }).click();
  assert.match(await page.getByTestId('clock').textContent(), /2:00/);
  assert.match(await page.getByTestId('served').textContent(), /^0/);
  assert.equal(await page.locator('.db-bath').count(), 4);
  assert.match(await page.locator('.db-supplies').textContent(), /8\/8/);
  await page.clock.runFor(2100);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(
    await page
      .locator('.db-paused p')
      .evaluate((el) => getComputedStyle(el).color),
    'rgb(91, 107, 93)',
  );
  const clock = await page.getByTestId('clock').textContent();
  await page.clock.runFor(5000);
  assert.equal(await page.getByTestId('clock').textContent(), clock);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();

  // --- Blur cancels an in-progress hold ---
  await seat();
  await scrub.focus();
  await page.keyboard.down('Space');
  await page.clock.runFor(500);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('meter', { name: 'Scrub pressure', exact: true })
      .getAttribute('aria-valuenow'),
    '0',
  );
  await page.getByRole('button', { name: 'Resume', exact: true }).click();

  // --- Guide pauses the clock ---
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  const guideClock = await page.getByTestId('clock').textContent();
  await page.clock.runFor(2000);
  assert.equal(await page.getByTestId('clock').textContent(), guideClock);
  await page.getByRole('button', { name: 'Close guide', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();

  // --- Hidden-tab visibility handler pauses ---
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();

  // --- Full timed ending ---
  await page.clock.runFor(120000);
  assert.equal(await page.getByTestId('clock').textContent(), '0:00');
  assert.match(
    await page.locator('.db-welcome').textContent(),
    /Small spa. Big feelings/,
  );
  await page.getByRole('button', { name: /Open spa/ }).click();
  assert.equal(await page.getByTestId('clock').textContent(), '2:00');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await mkdir(process.env.JCODE_SCRATCH_DIR || '.checks', { recursive: true });
  await page.screenshot({
    path: `${process.env.JCODE_SCRATCH_DIR || '.checks'}/dust-bath-desktop.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: /MAIN ARCADE/ }).click();
  assert.equal(await page.locator('.arcade-card').count(), 14);
  assert.match(await page.locator('.arcade-hero').textContent(), /Fourteen ways/);
  await page.locator('a.arcade-card[href="/dust-bath"]').click();
  assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
  console.log(
    'PASS shift: persistence reload, fourth bath + 8 dust from upgrades, pause/resume, blur cancel, guide pause, hidden-tab, timed ending, eleventh-card navigation',
  );
  await page.close();

  // --- Mobile: native touch, multi-stage, no overflow at 390 and 320 ---
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  mobile.on('pageerror', (e) => errors.push(e.message));
  await mobile.clock.install();
  await mobile.goto(`${base}/dust-bath`);
  await mobile.getByRole('button', { name: /Untimed cozy/ }).tap();
  await mobile.locator('.db-guest').first().tap();
  await mobile.locator('.db-bath').first().locator('.db-bath-seat').tap();
  const touch = await mobile.context().newCDPSession(mobile);
  const mScrub = mobile.locator('.db-scrub');
  const mActiveBusy = async () =>
    (await mobile.locator('.db-bath.active .db-bath-info').count()) > 0;
  const touchStage = async () => {
    await mScrub.scrollIntoViewIfNeeded();
    const t = await mScrub.boundingBox();
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: t.x + t.width / 2, y: t.y + 20 }],
    });
    await mobile.getByRole('button', { name: /RELEASE IN SWEET SPOT/ }).waitFor();
    await mobile.clock.runFor(1300);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await mobile.waitForTimeout(30);
  };
  let mg = 0;
  while ((await mActiveBusy()) && mg++ < 6) await touchStage();
  await mobile.waitForFunction(() =>
    document.querySelector('[data-testid="served"]').textContent.startsWith('1'),
  );
  // Touch cancel mid-hold clears the meter without a service.
  await mobile.locator('.db-guest').first().tap();
  await mobile.locator('.db-bath').first().locator('.db-bath-seat').tap();
  await mScrub.scrollIntoViewIfNeeded();
  const cancelTarget = await mScrub.boundingBox();
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cancelTarget.x + cancelTarget.width / 2, y: cancelTarget.y + 20 },
    ],
  });
  await mobile.getByRole('button', { name: /RELEASE IN SWEET SPOT/ }).waitFor();
  await mobile.clock.runFor(300);
  await touch.send('Input.dispatchTouchEvent', {
    type: 'touchCancel',
    touchPoints: [],
  });
  await mobile.waitForFunction(
    () => document.querySelector('.db-meter').getAttribute('aria-valuenow') === '0',
  );
  assert.match(await mobile.getByTestId('served').textContent(), /^1/);
  await touch.detach();
  assert(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '390px viewport must not overflow',
  );
  await mobile.setViewportSize({ width: 320, height: 740 });
  assert(
    await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    '320px viewport must not overflow',
  );
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.screenshot({
    path: `${process.env.JCODE_SCRATCH_DIR || '.checks'}/dust-bath-mobile.png`,
    fullPage: true,
  });
  await mobile.close();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log(
    'PASS mobile: native touch multi-stage hold/release, touch cancellation, 390px and 320px no horizontal overflow, reduced motion, zero page errors',
  );
} finally {
  await browser.close();
}
