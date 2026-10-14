import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch(),
  errors = [];
mkdirSync('.checks/kitchen', { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/kitchen');
  await page.getByRole('button', { name: 'Open shift 1' }).click();
  await page
    .getByRole('button', { name: 'Prepare', exact: true })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'To the oven', exact: true })
    .first()
    .click({ timeout: 10000 });
  await page
    .getByRole('button', { name: 'Serve', exact: true })
    .first()
    .click({ timeout: 10000 });
  await page.waitForFunction(() =>
    document.querySelector('.k-hud')?.textContent.includes('1 / 5'),
  );
  await page.keyboard.press('Space');
  assert.match(await page.locator('.k-hud').innerText(), /Bell rush/);
  await page.keyboard.press('p');
  await page.getByRole('dialog').waitFor();
  const before = await page.locator('.k-hud').innerText();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.k-hud').innerText(), before);
  await page
    .getByRole('button', { name: 'Back to the kitchen', exact: true })
    .click();
  await page.keyboard.press('2');
  assert.match(await page.locator('.k-selected').innerText(), /Enzo/);
  await page.keyboard.press('0');
  assert.match(await page.locator('.k-selected').innerText(), /Auto crew/);
  await page.screenshot({
    path: '.checks/kitchen/desktop.png',
    fullPage: true,
  });
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Kitchen menu', exact: true }).click();
  await page.evaluate(() =>
    localStorage.setItem(
      'midnight-kitchen-v1',
      JSON.stringify({
        version: 1,
        coins: 300,
        unlocked: 3,
        stars: [3, 2],
        scores: [10],
        upgrades: [0, 0, 0],
      }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: /Prep table/ }).click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('midnight-kitchen-v1')).upgrades[0],
    ),
    1,
  );
  await page.evaluate(() =>
    localStorage.setItem('midnight-kitchen-v1', 'garbage'),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Open shift 1' }).waitFor();
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [844, 390],
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole('button', { name: 'Cozy kitchen · no clock', exact: true })
      .click();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${width}`,
    );
    await page.keyboard.press('p');
    const box = await page.locator('.k-modal').boundingBox();
    assert(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= width + 1 &&
        box.y + box.height <= height + 1,
      `modal ${width}`,
    );
    await page
      .getByRole('button', { name: 'Back to the kitchen', exact: true })
      .click();
    await page.screenshot({
      path: `.checks/kitchen/${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press('p');
    await page
      .getByRole('button', { name: 'Kitchen menu', exact: true })
      .click();
  }
  const campaign = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await campaign.clock.install();
  await campaign.goto(base + '/kitchen');
  await campaign.getByRole('button', { name: 'Open shift 1' }).click();
  for (let step = 0; step < 180; step++) {
    const orders = campaign.locator('.k-order>button');
    const n = await orders.count();
    for (let i = 0; i < n; i++) {
      const b = orders.nth(i);
      if (await b.isEnabled()) await b.click();
    }
    const bell = campaign.locator('.k-hud>button').first();
    if (await bell.isEnabled()) await bell.click();
    await campaign.clock.runFor(500);
    if (await campaign.getByRole('dialog').count()) break;
  }
  await campaign.getByRole('dialog').waitFor();
  assert.match(
    await campaign.locator('.k-modal').innerText(),
    /Supper is served/,
  );
  const reward = await campaign.evaluate(() =>
    JSON.parse(localStorage.getItem('midnight-kitchen-v1')),
  );
  assert.equal(reward.unlocked, 2);
  assert.equal(reward.stars[0], 3);
  assert(reward.coins > 0);
  await campaign.screenshot({ path: '.checks/kitchen/victory.png' });
  await campaign
    .getByRole('button', { name: 'Kitchen menu', exact: true })
    .click();
  await campaign.reload();
  await campaign.getByRole('button', { name: 'Open shift 2' }).waitFor();
  assert.equal(
    await campaign.evaluate(
      () => JSON.parse(localStorage.getItem('midnight-kitchen-v1')).coins,
    ),
    reward.coins,
  );
  await campaign.close();
  await page.bringToFront();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page
    .getByRole('button', { name: 'Cozy kitchen · no clock', exact: true })
    .click();
  await page.keyboard.press('Space');
  assert.equal(
    await page
      .locator('.k-stage')
      .evaluate((el) => getComputedStyle(el, ':after').animationName),
    'none',
  );
  await page.close();
  assert.deepEqual(errors, []);
  console.log(
    'PASS actual kitchen serving, keyboard, pause, upgrades, corrupt save, six layouts and reduced motion',
  );
} finally {
  await browser.close();
}
