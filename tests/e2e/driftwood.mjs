// Driftwood Post in the browser: the menu, setting sail, picking up Granny Tuft's letter, sailing with real keys,
// pausing (and pausing when the tab hides), docking by key and by the test hook's teleport, delivering a letter and
// reading the reply, the chart and its letter book, the save surviving a reload, and the phone layouts with the
// touch wheel and buttons. Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const game = (page, fn, arg) => page.evaluate(fn, arg);
const phase = (page, p) => page.locator(`main[data-phase="${p}"]`).waitFor();
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** Whether the lake canvas has been painted (a pixel in the middle isn't blank). */
const painted = (page, sel) => page.evaluate((s) => { const c = document.querySelector(s), d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data; return d[3] > 0 && d[0] + d[1] + d[2] > 30; }, sel);

{
  const page = await open();
  await page.goto(base + '/driftwood'); await ready(page);
  assert.match(await page.locator('h1').innerText(), /Driftwood/i);
  assert.ok(await page.locator('a[href="/"]').first().isVisible(), 'a plain link back to the arcade');
  assert.ok(await painted(page, '.dw-canvas'), 'the lake is drawn behind the menu');
  console.log('PASS the menu loads and hydrates');

  // a new voyage starts tied up at home with Granny Tuft's letter waiting
  await page.getByRole('button', { name: /SET SAIL/ }).click();
  await phase(page, 'dock');
  const card = page.getByRole('dialog', { name: 'Whisker Cove' }); await card.waitFor();
  assert.match(await card.locator('.dw-letter').first().innerText(), /Dear Pip/, 'the first letter is open to read');
  await card.getByRole('button', { name: 'Pick up' }).click();
  assert.equal(await game(page, () => window.__driftwood().bag.length), 1, 'the letter is in the bag');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('driftwood-post-v1')).voyage.bag[0].story), 1, 'and saved');
  console.log('PASS a new voyage starts at home and the first letter is picked up');

  // cast off and sail with real keys
  await card.getByRole('button', { name: /Cast off/ }).click();
  await phase(page, 'sail');
  await page.locator('.dw-canvas').focus();
  await page.waitForFunction(() => window.__driftwood().speed > 0.8, null, { timeout: 10000 });
  const h0 = await game(page, () => window.__driftwood().boat.h);
  await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d');
  const h1 = await game(page, () => window.__driftwood().boat.h);
  assert.ok(h1 > h0 + 0.2, `D turns to starboard (${h0.toFixed(2)} → ${h1.toFixed(2)})`);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600); await page.keyboard.up('ArrowLeft');
  const h2 = await game(page, () => window.__driftwood().boat.h);
  assert.ok(h2 < h1 - 0.2, `the left arrow turns to port (${h1.toFixed(2)} → ${h2.toFixed(2)})`);
  const x0 = await game(page, () => window.__driftwood().boat.x); await page.waitForTimeout(800);
  assert.notEqual(await game(page, () => window.__driftwood().boat.x), x0, 'the boat sails');
  assert.ok(await page.locator('.dw-bag .dw-slot.is-full').count() === 1, 'the bag shows the letter');
  console.log('PASS the boat sails and steers with real keys');

  // pause stops the clock; resuming carries on; a hidden tab pauses too
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = await game(page, () => window.__driftwood().tick); await page.waitForTimeout(400);
  assert.equal(await game(page, () => window.__driftwood().tick), t0, 'nothing moves while paused');
  await page.getByRole('button', { name: 'Keep sailing' }).click();
  await page.waitForFunction((t) => window.__driftwood().tick > t + 5, t0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  await page.getByRole('button', { name: 'Keep sailing' }).click();
  console.log('PASS pausing stops the lake, and hiding the tab pauses it');

  // the test hook ties up at Lighthouse Rock: hand over Tuft's letter and read Pip's reply
  assert.ok(await game(page, () => window.__driftwoodDock('lighthouse')));
  const pip = page.getByRole('dialog', { name: 'Lighthouse Rock' }); await pip.waitFor();
  await pip.getByRole('button', { name: 'Hand over', exact: true }).click();
  assert.deepEqual(await game(page, () => { const g = window.__driftwood(); return [[...g.done], g.shells, g.bag.length]; }), [[1], 5, 0], 'delivered and paid');
  await pip.locator('.dw-news').waitFor();
  assert.match(await pip.locator('.dw-news').innerText(), /🐚 \+5/);
  await pip.getByRole('button', { name: /An order for a seed loaf/ }).click();
  assert.match(await pip.locator('.dw-letter').first().innerText(), /seed loaf/, 'Pip’s reply can be read');
  await pip.getByRole('button', { name: 'Pick up' }).click();
  console.log('PASS docking by the hook, delivering a letter and picking up the reply');

  // docking by key: drift up to the jetty and hold E
  await pip.getByRole('button', { name: /Cast off/ }).click(); await phase(page, 'sail');
  // cast off points the bow away from the jetty: put the boat 60 out, turned back towards it
  await game(page, () => { const b = window.__driftwood().boat; b.x += Math.cos(b.h) * 60; b.y += Math.sin(b.h) * 60; b.h += Math.PI; b.v = 1.6; });
  await page.locator('.dw-canvas').focus();
  await page.keyboard.down('e');
  await phase(page, 'dock');
  await page.keyboard.up('e');
  assert.equal(await game(page, () => window.__driftwood().at), 'lighthouse', 'holding E brakes and ties up');
  await page.waitForTimeout(600); await page.keyboard.press('Space'); await phase(page, 'sail');
  console.log('PASS holding E slows the boat and ties up; Space casts off');

  // the chart, its pins and the letter book
  await page.keyboard.press('m');
  const chart = page.getByRole('dialog', { name: 'Chart' }); await chart.waitFor(); await page.waitForTimeout(300);
  assert.ok(await painted(page, '.dw-chart-cv'), 'the chart is drawn');
  const tick = await game(page, () => window.__driftwood().tick); await page.waitForTimeout(300);
  assert.equal(await game(page, () => window.__driftwood().tick), tick, 'the lake waits while the chart is open');
  await chart.getByRole('tab', { name: /Letters/ }).click();
  assert.match(await chart.locator('.dw-book').innerText(), /A letter for Old Pip/);
  await page.keyboard.press('Escape'); await chart.waitFor({ state: 'detached' });
  console.log('PASS the chart opens, pauses the lake and keeps the letters');

  // the save: tied up last at Lighthouse Rock with Pip's letter in the bag
  await page.reload(); await ready(page);
  const cont = page.getByRole('button', { name: /CONTINUE THE VOYAGE/ });
  assert.match(await cont.innerText(), /1 of 24 story letters/);
  await cont.click();
  await page.getByRole('dialog', { name: 'Lighthouse Rock' }).waitFor();
  assert.deepEqual(await game(page, () => { const g = window.__driftwood(); return [g.at, g.bag.map((i) => i.story), g.shells]; }), ['lighthouse', [2], 5], 'the voyage continues where it tied up');
  console.log('PASS the voyage saves at the jetty and continues after a reload');
  await page.close();
}

for (const [w, h] of [[844, 390], [390, 844]]) {
  const page = await open({ width: w, height: h }, true);
  await page.goto(base + '/driftwood'); await ready(page);
  assert.ok(await noSideScroll(page), `no sideways scroll on the menu at ${w}×${h}`);
  await page.evaluate(() => window.__driftwoodStart({ seed: 3 }));
  const card = page.locator('.dw-card'); await card.waitFor();
  await page.waitForTimeout(500); // let the card finish sliding in
  const box = await card.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= w + 1 && box.y >= 0 && box.y + box.height <= h + 1, `the island card fits on screen (${JSON.stringify(box)})`);
  assert.ok(await noSideScroll(page), `no sideways scroll at the jetty at ${w}×${h}`);
  await card.getByRole('button', { name: 'Pick up' }).tap();
  await card.getByRole('button', { name: /Cast off/ }).tap(); await phase(page, 'sail');
  const wheel = page.locator('.dw-wheel'); assert.ok(await wheel.isVisible() && await page.locator('.dw-dockbtn').isVisible(), 'the wheel and the dock button show');
  const wb = await wheel.boundingBox(), h0 = await game(page, () => window.__driftwood().boat.h);
  await page.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2); await page.mouse.down(); await page.mouse.move(wb.x + wb.width - 6, wb.y + wb.height / 2, { steps: 4 });
  await page.waitForTimeout(500); await page.mouse.up();
  const h1 = await game(page, () => window.__driftwood().boat.h);
  assert.ok(h1 > h0 + 0.15, `sliding right on the wheel steers to starboard (${h0.toFixed(2)} → ${h1.toFixed(2)})`);
  for (const sel of ['.dw-wheel', '.dw-dockbtn', '.dw-bag']) { const b = await page.locator(sel).boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= w + 1 && b.y + b.height <= h + 1, `${sel} is on screen`); }
  // the dock button ties up near a jetty
  await game(page, () => { const g = window.__driftwood(); g.dockAt('home'); g.castOff(); g.boat.v = 0.2; });
  await page.waitForTimeout(300);
  const db = await page.locator('.dw-dockbtn').boundingBox();
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2); await page.mouse.down();
  await phase(page, 'dock'); await page.mouse.up();
  assert.ok(await noSideScroll(page), `no sideways scroll in play at ${w}×${h}`);
  console.log(`PASS the ${w > h ? 'sideways' : 'upright'} phone layout fits, the wheel steers and the dock button ties up`);
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
