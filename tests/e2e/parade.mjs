// Kit Parade in the browser: the arcade card, the level list, a level played by clicking kits, pausing and calling
// everyone home, results and the save, the phone layout with taps and dragging, and no page errors.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, hasTouch = false) => {
  const page = await browser.newPage({ viewport, hasTouch });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** Where kit `i` is on the screen, as page coordinates. */
const kitOnScreen = async (page, i) => {
  const box = await page.locator('.parade-canvas').boundingBox();
  const p = await page.evaluate((i) => { const g = window.__parade(), sc = window.__paradeScene(), k = g.kits[i]; return { x: (k.x - sc.cam.x) * sc.scale, y: (k.y - 5 - sc.cam.y) * sc.scale + sc.insets.top }; }, i);
  return { x: box.x + p.x, y: box.y + p.y };
};

{
  const page = await open();
  await page.goto(base);
  const card = page.getByRole('link', { name: /Kit Parade/ });
  if (await card.count()) { await card.first().click(); await page.waitForURL('**/parade'); console.log('PASS the arcade card opens Kit Parade'); }
  else await page.goto(base + '/parade');
  await ready(page);
  await page.evaluate(() => localStorage.removeItem('kit-parade-v1')); await page.reload(); await ready(page);

  assert.equal(await page.locator('.parade-world').count(), 4, 'four worlds');
  assert.equal(await page.locator('.parade-level').count(), 8, 'eight meadow levels');
  assert.equal(await page.locator('.parade-level:disabled').count(), 7, 'only the first level is open');
  console.log('PASS the level list opens one level at a time');

  await page.locator('.parade-level').first().click();
  await page.getByRole('dialog', { name: 'Follow the Leader' }).waitFor();
  await page.getByRole('button', { name: /Let’s go/ }).click();
  await page.waitForFunction(() => window.__parade()?.kits.length > 0);
  await page.getByRole('button', { name: 'Fast forward' }).click();
  await page.getByRole('dialog', { name: 'Results' }).waitFor({ timeout: 90000 });
  assert.match(await page.locator('.parade-results').textContent(), /Every single kit is home/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kit-parade-v1')));
  assert.equal(saved.best.m1.stars, 3, 'three stars saved');
  console.log('PASS watching the first parade home earns three stars, and it is saved');

  // level 2: give the first kit the Digger job by clicking it
  await page.getByRole('button', { name: /Next level/ }).click();
  await page.getByRole('dialog', { name: 'Dig In' }).waitFor();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Fast forward' }).click();
  await page.waitForFunction(() => { const k = window.__parade().kits[0]; return k && k.state === 'walk' && k.x > 60; });
  await page.getByRole('button', { name: 'Fast forward' }).click();
  await page.keyboard.press('2');
  assert.equal(await page.locator('.parade-job.is-on').count(), 1, 'key 2 picks the Digger');
  const at = await kitOnScreen(page, 0);
  await page.mouse.click(at.x, at.y);
  const dug = await page.evaluate(() => ({ state: window.__parade().kits[0].state, left: window.__parade().left.digger }));
  assert.ok(dug.state === 'dig' && dug.left === 1, `clicking a kit gives it the job (${JSON.stringify(dug)})`);
  console.log('PASS clicking a kit gives it the chosen job');

  await page.keyboard.press('Space');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const frozen = await page.evaluate(() => window.__parade().tick); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__parade().tick), frozen, 'pausing stops the parade');
  await page.getByRole('button', { name: 'Keep going' }).click();
  await page.waitForFunction((t) => window.__parade().tick > t + 5, frozen);
  console.log('PASS pausing stops the parade and resuming carries on');

  await page.getByRole('button', { name: 'Fast forward' }).click();
  await page.getByRole('dialog', { name: 'Results' }).waitFor({ timeout: 90000 });
  assert.match(await page.locator('.parade-results').textContent(), /home/i);
  assert.ok((await page.evaluate(() => JSON.parse(localStorage.getItem('kit-parade-v1')))).best.m2.stars >= 1, 'level two is saved');
  await page.getByRole('button', { name: 'Levels' }).click();
  assert.equal(await page.locator('.parade-level:disabled').count(), 5, 'the third level is open now');
  console.log('PASS digging home clears level two and opens level three');

  // call them all home: a restart from the pause menu
  await page.locator('.parade-level').nth(2).click(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__parade().tick > 60);
  await page.keyboard.press('Space'); await page.keyboard.press('r');
  assert.ok(await page.evaluate(() => window.__parade().tick < 30), 'calling them all home starts the level again');
  console.log('PASS calling everyone home starts over');

  await page.getByRole('button', { name: /Sound on/ }).click();
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('kit-parade-v1')))).muted, true, 'mute is saved');
  console.log('PASS the mute switch is saved');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 }, true);
  await page.goto(base + '/parade'); await ready(page);
  // open every level for the phone checks
  await page.evaluate(() => localStorage.setItem('kit-parade-v1', JSON.stringify({ v: 1, level: 0, muted: true, best: Object.fromEntries(['m1','m2','m3','m4','m5','m6','m7','m8','p1','p2','p3','p4','p5','p6','p7','p8','c1','c2','c3','c4','c5','c6','c7','r1','r2','r3','r4','r5','r6'].map((id) => [id, { stars: 1, saved: 1, used: 1, time: 1 }])) })));
  await page.reload(); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on the phone menu');
  await page.evaluate(() => window.__paradeStart(29));
  await page.waitForFunction(() => window.__parade()?.kits.length > 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll while playing');
  // drag to look around the wide finale
  const box = await page.locator('.parade-canvas').boundingBox();
  const cam0 = await page.evaluate(() => window.__paradeScene().cam.x);
  await page.mouse.move(box.x + 300, box.y + 400); await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 400, { steps: 8 }); await page.mouse.up();
  const cam1 = await page.evaluate(() => window.__paradeScene().cam.x);
  assert.ok(cam1 > cam0 + 20, `dragging pans the camera (${cam0} → ${cam1})`);
  await page.mouse.move(box.x + 60, box.y + 400); await page.mouse.down(); await page.mouse.move(box.x + 330, box.y + 400, { steps: 8 }); await page.mouse.up();
  // tap a little beside the first kit: the nearest one gets the job
  await page.waitForFunction(() => { const k = window.__parade().kits[0]; return k && k.state === 'walk'; });
  await page.locator('.parade-job').first().tap();
  const at = await kitOnScreen(page, 0);
  await page.touchscreen.tap(at.x + 8, at.y + 6);
  assert.equal(await page.evaluate(() => window.__parade().kits[0].state), 'stop', 'a tap near a kit gives it the job');
  console.log('PASS the phone layout fits, dragging pans and a tap near a kit gives the job');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
