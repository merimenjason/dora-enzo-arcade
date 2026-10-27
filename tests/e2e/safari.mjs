// Snapshot Safari in the browser: the arcade card, camp and its saved choices, walking, aiming, snapping, pausing,
// developing photos into the journal, the journal page, and the phone layout.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** Puts the photographer a few steps from the first creature, aims at it and presses Space, all in one go. */
const snapFirst = (page) => page.evaluate(() => {
  const g = window.__safari(), a = g.animals.find((x) => x.state === 'live');
  g.x = a.x - 5; g.move(0); g.steady = 1;
  const h = a.sp.h; g.view = { x: a.x, y: a.y + h / 2, zoom: Math.min(8, 2.5 / h) };
  const before = { film: g.film, photos: g.photos.length, sp: a.sp.id };
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  return before;
});

{
  const page = await open();
  await page.goto(base);
  await page.getByRole('link', { name: /Snapshot Safari/ }).click(); await page.waitForURL('**/safari'); await ready(page);
  console.log('PASS the arcade lists Snapshot Safari and its card opens the game');

  const trails = page.locator('.safari-trail');
  assert.equal(await trails.count(), 4);
  assert.equal(await page.locator('.safari-trail:disabled').count(), 3, 'only the Puna Grassland is open at first');
  assert.equal(await page.locator('.safari-times button:disabled').count(), 2, 'only mornings are open at first');
  await page.getByRole('button', { name: /Enzo/ }).click();
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('button', { name: /Enzo/ }).getAttribute('aria-pressed'), 'true', 'the photographer is remembered');
  console.log('PASS camp opens one trail and one time, and remembers who is holding the camera');

  await page.evaluate(() => window.__safariStart('puna', 'morning', 7));
  await page.waitForFunction(() => window.__safari()?.state === 'out');
  assert.equal(await page.evaluate(() => window.__safari().who), 'enzo');
  const x0 = await page.evaluate(() => window.__safari().x);
  await page.keyboard.down('d'); await page.waitForTimeout(800); await page.keyboard.up('d');
  const x1 = await page.evaluate(() => window.__safari().x);
  assert.ok(x1 > x0 + 0.5, `D walks right (${x0.toFixed(1)} → ${x1.toFixed(1)})`);
  await page.keyboard.press('1');
  assert.equal(await page.getByRole('button', { name: 'Tiptoe' }).getAttribute('aria-pressed'), 'true', '1 picks tiptoe');
  console.log('PASS walking by keys and picking a pace');

  // the mouse moves the viewfinder
  const box = await page.locator('.safari-canvas').boundingBox();
  await page.mouse.move(box.width * 0.75, box.height * 0.5); await page.waitForTimeout(200);
  const v1 = await page.evaluate(() => window.__safari().view.x);
  await page.mouse.move(box.width * 0.25, box.height * 0.5); await page.waitForTimeout(200);
  const v2 = await page.evaluate(() => window.__safari().view.x);
  assert.ok(v1 > v2 + 1, `the viewfinder follows the mouse (${v1.toFixed(1)} vs ${v2.toFixed(1)})`);
  await page.mouse.wheel(0, -200); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => window.__safari().view.zoom) > 2, 'the wheel zooms in');
  console.log('PASS the mouse aims and the wheel zooms');

  const before = await snapFirst(page);
  const after = await page.evaluate(() => ({ film: window.__safari().film, photos: window.__safari().photos.length }));
  assert.equal(after.film, before.film - 1, 'Space takes a photo and uses film');
  assert.equal(after.photos, before.photos + 1, `the ${before.sp} is in the photo`);
  console.log(`PASS Space snaps a photo of the ${before.sp}`);

  await page.keyboard.press('p');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const frozen = await page.evaluate(() => window.__safari().t); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__safari().t), frozen, 'the day stops while paused');
  await page.getByRole('button', { name: /Head home/ }).click();
  await page.getByRole('region', { name: 'Developing photos' }).waitFor();
  assert.equal(await page.locator('.safari-print').count(), after.photos, 'every photo is developed');
  assert.match(await page.locator('.safari-print').first().textContent(), /★/);
  console.log('PASS pausing stops the day, and heading home develops the photos');

  await page.getByRole('button', { name: /Paste|Done/ }).click();
  await page.locator('.safari-news').waitFor();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('snapshot-safari-v1')));
  assert.equal(saved.outings, 1, 'the outing is saved');
  assert.ok(Object.keys(saved.journal).length >= 1 && saved.who === 'enzo', `the photo is in the saved journal (${Object.keys(saved.journal).join(', ')})`);
  await page.getByRole('button', { name: /Journal/ }).click();
  await page.getByRole('region', { name: 'Field journal' }).waitFor();
  assert.ok(await page.locator('.safari-slot.has').count() >= 1, 'the journal page shows the photo');
  console.log('PASS the photo is pasted into the journal, saved and shown on its page');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.goto(base + '/safari'); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on a phone at camp');
  await page.getByRole('button', { name: /SET OFF/ }).click();
  await page.waitForFunction(() => window.__safari()?.state === 'out');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the trail');
  const x0 = await page.evaluate(() => window.__safari().x);
  const right = page.getByRole('button', { name: 'Walk right' }), rb = await right.boundingBox();
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  assert.ok(await page.evaluate(() => window.__safari().x) > x0 + 0.4, 'holding ▶ walks');
  const film = await page.evaluate(() => window.__safari().film);
  await page.getByRole('button', { name: 'Take a photo' }).click();
  assert.equal(await page.evaluate(() => window.__safari().film), film - 1, 'the snap button takes a photo');
  for (const name of ['Walk left', 'Walk right', 'Take a photo']) {
    const b = await page.getByRole('button', { name }).boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844, `${name} fits on the screen`);
  }
  console.log('PASS the phone layout fits, ▶ walks and the snap button shoots');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
