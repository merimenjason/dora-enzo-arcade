import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const errors = [];
try {
  const page = await browser.newPage({
    colorScheme: 'light',
    viewport: { width: 1440, height: 1100 },
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/mountain-retreat`);
  await page.locator('fieldset:not([disabled])').first().waitFor();
  const select = page.getByRole('combobox', { name: 'Color theme' });
  assert.equal(await select.inputValue(), 'system');
  await page.getByRole('button', { name: /Field guide/ }).click();
  const background = () =>
    page
      .locator('.mr-shell')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
  await mkdir('.checks/mountain-retreat', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await select.selectOption(theme);
    const contrast = await page
      .locator('.mr-guide p')
      .first()
      .evaluate((e) => {
        const lum = (c) =>
          c
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
        const fg = lum(getComputedStyle(e).color);
        const bg = lum(
          getComputedStyle(e.closest('.mr-guide')).backgroundColor,
        );
        return {
          ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05),
          size: parseFloat(getComputedStyle(e).fontSize),
        };
      });
    assert.ok(
      contrast.ratio >= 7,
      `${theme} guide contrast >= 7:1: ${contrast.ratio}`,
    );
    assert.ok(contrast.size >= 18);
    assert.ok(
      await page
        .locator('.mr-host-card button small')
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize) >= 14),
    );
    const buttonRatios = await page
      .locator(
        '.mr-host-card button[aria-pressed="true"], .mr-upgrades button:disabled',
      )
      .evaluateAll((es) =>
        es.map((e) => {
          const lum = (c) =>
            c
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number)
              .map((v) => {
                v /= 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              })
              .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
          const style = getComputedStyle(e),
            fg = lum(style.color),
            bg = lum(style.backgroundColor);
          return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
        }),
      );
    assert.ok(
      buttonRatios.every((r) => r >= 4.5),
      `${theme} selected/disabled labels meet 4.5:1: ${buttonRatios.join(', ')}`,
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${theme}: no overflow at ${width}`,
      );
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `.checks/mountain-retreat/theme-${theme}-${width}.png`,
          fullPage: true,
        });
    }
    console.log(
      `${theme}: guide ${contrast.size}px / contrast ${contrast.ratio.toFixed(2)}:1, no overflow 320–1440px`,
    );
  }
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('.mr-shell')?.dataset.theme === 'dark',
  );
  assert.equal(await select.inputValue(), 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await background(), 'rgb(24, 33, 30)');
  await select.selectOption('system');
  assert.equal(await background(), 'rgb(247, 244, 233)');
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await background(), 'rgb(24, 33, 30)');
  await select.selectOption('light');
  assert.equal(await background(), 'rgb(247, 244, 233)');
  // Theme setting must not leak to the main arcade.
  await page.getByRole('link', { name: /MAIN ARCADE/ }).click();
  assert.equal(await page.locator('.mr-shell').count(), 0);
  assert.equal(await page.locator('.arcade-card').count(), 12);
  const blocked = await browser.newPage({ colorScheme: 'light' });
  blocked.on('pageerror', (e) => errors.push(e.message));
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    }),
  );
  await blocked.goto(`${base}/mountain-retreat`);
  await blocked.locator('fieldset:not([disabled])').first().waitFor();
  await blocked
    .getByRole('combobox', { name: 'Color theme' })
    .selectOption('dark');
  assert.equal(
    await blocked.locator('.mr-shell').getAttribute('data-theme'),
    'dark',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS theme persistence, live System preference, explicit overrides, denied storage, route isolation, zero page errors',
  );
} finally {
  await browser.close();
}
