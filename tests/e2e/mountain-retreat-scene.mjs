import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'dora-enzo-mountain-retreat-v1';
const start = Date.parse('2026-09-10T00:00:00Z');
const save = {
  version: 1,
  savedAt: start,
  coins: 0,
  hearts: 0,
  supplies: 120,
  rooms: [3, 3, 3, 3],
  dora: 'welcome',
  enzo: 'gather',
  elapsed: 0,
  served: 0,
  activity: null,
  festivals: 0,
  expeditions: 0,
};
const browser = await chromium.launch();
const errors = [];
try {
  await mkdir('.checks/mountain-retreat', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: start });
  await page.goto(`${base}/mountain-retreat`);
  const ready = () => page.locator('fieldset:not([disabled])').first().waitFor();
  await ready();
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(save)]);
  await page.reload();
  await ready();
  const status = () => page.getByTestId('scene-status').textContent();
  const room = (host) => page.locator(`.${host}-host`).getAttribute('data-room');
  // Step the page clock a second at a time until the scene reaches the expected state.
  const until = async (label, check, seconds = 20) => {
    for (let i = 0; i < seconds; i++) {
      if (await check()) return;
      await page.clock.runFor(1000);
    }
    assert.fail(`timed out waiting for ${label}`);
  };

  assert.equal(await page.getByRole('img', { name: 'Dora, white chinchilla' }).count(), 2);
  assert.equal(await page.getByRole('img', { name: 'Enzo, grey chinchilla' }).count(), 2);
  assert.equal(await room('dora'), '0');
  assert.equal(await room('enzo'), '1');
  assert.match(await status(), /THE KETTLE IS ON/);
  assert.equal(await page.locator('.mr-visitor').count(), 0);

  // CSS animations run on real time, not the installed page clock.
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const opacity = (selector) =>
    page.locator(selector).first().evaluate((el) => Number(getComputedStyle(el).opacity));
  const inside = (inner, outer) =>
    inner.x >= outer.x - 1 &&
    inner.x + inner.width <= outer.x + outer.width + 1 &&
    inner.y >= outer.y - 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1;

  await until('guests on the path', async () => /ON THE PATH/.test(await status()));
  assert.equal(await page.locator('.mr-arrivals > span').count(), 4);
  await settle(1200);
  assert.ok((await opacity('.mr-arrivals > span')) > 0.5, 'arriving guests are visible on the path');
  await page.screenshot({ path: '.checks/mountain-retreat/scene-arriving.png' });

  await until('guests staying', async () => /4 GUESTS STAYING/.test(await status()));
  assert.equal(await page.locator('.mr-room .mr-visitor').count(), 4);
  assert.equal(await page.locator('.mr-visitor .mr-chin.guest').count(), 4);
  assert.equal(await page.getByRole('img', { name: /chinchilla/ }).count(), 4, 'guest sprites stay decorative');
  await settle(800);
  assert.equal(await opacity('.mr-visitor'), 1, 'staying guests are fully visible');
  for (const i of [0, 1, 2, 3]) {
    const guest = await page.locator(`.room-${i} .mr-visitor .mr-chin`).boundingBox();
    const box = await page.getByTestId(`room-${i}`).boundingBox();
    assert.ok(inside(guest, box), `guest sits inside room ${i} (${JSON.stringify({ guest, box })})`);
  }
  await page.screenshot({ path: '.checks/mountain-retreat/scene-staying.png' });

  const motion = () =>
    page.locator('.dora-host').evaluate((el) => {
      const css = getComputedStyle(el);
      return `${el.getAttribute('class')} | ${css.transitionProperty} | ${css.transitionDelay}`;
    });
  await until('Dora climbing to the suite', async () => (await room('dora')) === '2');
  assert.match(await motion(), /walking climbing \| bottom \| 0s$/, 'hearth to suite climbs straight up without a delay');
  await settle(900);
  await page.screenshot({ path: '.checks/mountain-retreat/scene-walking.png' });
  await until('Dora settled', async () => !/walking/.test(await page.locator('.dora-host').getAttribute('class')));
  // CSS transitions run on real time, not the installed page clock.
  for (let i = 0; i < 50; i++) {
    const moving = await page
      .locator('.dora-host')
      .evaluate((el) => el.getAnimations().some((a) => a instanceof CSSTransition));
    if (!moving) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const suite = await page.getByTestId('room-2').boundingBox();
  const dora = await page.locator('.dora-host').boundingBox();
  assert.ok(
    dora.x >= suite.x && dora.x + dora.width <= suite.x + suite.width + 1 && dora.y >= suite.y && dora.y + dora.height <= suite.y + suite.height + 1,
    `Dora stands inside the suite (${JSON.stringify({ dora, suite })})`,
  );
  await until('Dora crossing to the bath', async () => (await room('dora')) === '3');
  const across = await motion();
  assert.match(across, /walking \| left, bottom \|/, 'suite to bath walks across');
  assert.doesNotMatch(across, /climbing|facing-left/);
  await until('Enzo leaving the kitchen', async () => (await room('enzo')) === '3');

  await page.getByRole('tab', { name: /^Trips/ }).click();
  await page.getByRole('button', { name: /Take an expedition/ }).click();
  assert.equal(await page.locator('.mr-host').count(), 0);
  assert.equal(await page.locator('.mr-visitor, .mr-arrivals').count(), 0);
  assert.match(await status(), /BOTH HOSTS AWAY/);

  for (const width of [320, 390, 768]) {
    const narrow = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    narrow.on('pageerror', (e) => errors.push(e.message));
    await narrow.clock.install({ time: start });
    await narrow.goto(`${base}/mountain-retreat`);
    await narrow.locator('fieldset:not([disabled])').first().waitFor();
    await narrow.evaluate(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(save)]);
    await narrow.reload();
    await narrow.locator('fieldset:not([disabled])').first().waitFor();
    for (let i = 0; i < 7; i++) await narrow.clock.runFor(1000);
    assert.equal(await narrow.locator('.dora-host').evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    assert.ok(await narrow.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `no overflow at ${width}`);
    const lodge = await narrow.locator('.mr-rooms').boundingBox();
    for (const host of ['dora', 'enzo']) {
      const box = await narrow.locator(`.${host}-host`).boundingBox();
      assert.ok(box.x >= lodge.x - 1 && box.x + box.width <= lodge.x + lodge.width + 1, `${host} stays inside the lodge at ${width}px`);
    }
    await narrow.locator('.mr-scene-panel').screenshot({ path: `.checks/mountain-retreat/scene-${width}.png` });
    await narrow.close();
  }
  assert.deepEqual(errors, []);
  console.log('Mountain Retreat scene: hosts tour rooms, visitors arrive and stay, outings clear the lodge, narrow layouts contained.');
} finally {
  await browser.close();
}
