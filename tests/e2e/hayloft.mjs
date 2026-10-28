// Hayloft Tycoon in the browser: the arcade card, tapping and buying, helpers, tabs, saving, the welcome-back card after time
// away, trips, visitors, the Twig Shower, pausing and the phone layout.
// Needs `npm run dev` on port 3000 and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const state = (page) => page.evaluate(() => JSON.parse(window.__hayloft().save()));

{
  const page = await open();
  await page.goto(base);
  await page.getByRole('link', { name: /Hayloft Tycoon/ }).click(); await page.waitForURL('**/hayloft'); await ready(page);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page);
  console.log('PASS the arcade lists Hayloft Tycoon and its card opens the game');

  // taps on the valley sky give coins and fluff
  const box = await page.locator('.hayloft-canvas').boundingBox();
  for (let k = 0; k < 8; k++) await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.12);
  let s = await state(page);
  assert.ok(s.stats.taps >= 8 && s.coins > 0, `taps count (${s.stats.taps})`);
  await page.keyboard.press('Space'); s = await state(page); assert.ok(s.stats.taps >= 9, 'Space taps too');
  console.log(`PASS tapping the valley: ${s.stats.taps} taps`);

  // buying and hiring through the panel
  await page.evaluate(() => { window.__hayloft().s.coins = 1e7; });
  await page.getByRole('button', { name: /^Buy 1 Hay Meadow/ }).click();
  s = await state(page); assert.equal(s.levels[0], 2, 'a hay meadow bought');
  await page.getByRole('button', { name: 'MAX' }).click();
  await page.getByRole('button', { name: /^Buy \d+ Dust Bath Spa/ }).click();
  s = await state(page); assert.ok(s.levels[1] > 10 && s.buy === 0, `buy max (${s.levels[1]} spas)`);
  await page.getByRole('button', { name: /Run/ }).first().click();
  await page.getByRole('button', { name: /Helpers/ }).click();
  await page.getByRole('button', { name: /^Hire/ }).first().click();
  s = await state(page); assert.ok(s.managers[1], 'Enzo hired for the spa');
  console.log('PASS buying ×1 and MAX, running by paw and hiring a helper');

  // saving and the welcome-back card
  await page.waitForTimeout(5600);
  await page.evaluate(() => { const g = window.__hayloft(); g.s.wall -= 2 * 3600e3; localStorage.setItem('hayloft-tycoon-v1', g.save()); localStorage.setItem = () => {}; }); // the page saves again on pagehide, which would undo the two hours
  await page.reload(); await ready(page);
  await page.getByRole('dialog', { name: 'Welcome back' }).waitFor();
  const card = await page.getByRole('dialog', { name: 'Welcome back' }).textContent();
  assert.match(card, /2h/);
  assert.match(card, /Dust Bath Spa · Enzo/, 'the top earners list the spa and its helper');
  assert.match(card, /· Enzo|· Dora/, 'a word from the top helper');
  assert.match(card, /Ready to buy:/, 'what the coins can buy now');
  await page.screenshot({ path: process.env.SHOT ?? '/dev/null' }).catch(() => {});
  s = await state(page); assert.ok(s.levels[1] > 10 && s.managers[1], 'the valley was saved');
  await page.getByRole('button', { name: 'Lovely!' }).click();
  console.log('PASS the valley is saved, and two hours away shows the welcome-back card with top earners and what to buy');

  // trips
  await page.getByRole('button', { name: /Trips/ }).click();
  await page.getByRole('button', { name: /Babbling Brook/ }).first().click();
  s = await state(page); assert.equal(s.trips[0].dest, 'brook', 'Team Dora set off');
  await page.evaluate(() => { const g = window.__hayloft(); g.s.trips[0].ends = g.s.wall - 1; });
  await page.getByRole('button', { name: /Welcome home/ }).click();
  s = await state(page); assert.equal(s.trips[0], null); assert.equal(s.stats.trips, 1);
  console.log('PASS sending a trip and unpacking its finds');

  // a visitor, caught with C
  await page.evaluate(() => { const g = window.__hayloft(); g.s.nextVisit = g.s.t; });
  await page.waitForFunction(() => !!window.__hayloft().s.visitor);
  await page.locator('.hayloft-canvas').focus(); await page.keyboard.press('c');
  s = await state(page); assert.equal(s.stats.visitors, 1, 'a visitor caught');
  console.log('PASS catching a visitor');

  // the Twig Shower
  await page.evaluate(() => { const g = window.__hayloft(); g.s.nextShower = g.s.t; });
  await page.locator('.hayloft-shower-offer').click({ force: true }); // it wiggles forever, so it never counts as stable
  await page.waitForFunction(() => !!window.__hayloftShower());
  for (let k = 0; k < 120; k++) {
    const hit = await page.evaluate(() => { const sh = window.__hayloftShower(); if (!sh) return 'done'; const t = sh.twigs.find((x) => !x.caught && !x.gone && sh.y(x) > 0.25 && sh.y(x) < 0.8); return t ? { x: t.x, y: sh.y(t) } : null; });
    if (hit === 'done') break;
    if (hit) { const b = await page.locator('.hayloft-canvas').boundingBox(); await page.mouse.click(b.x + hit.x * b.width, b.y + hit.y * b.height); } else await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => !window.__hayloftShower() && window.__hayloft().s.stats.showers === 1, null, { timeout: 20000 });
  s = await state(page); assert.ok(s.stats.bestShower >= 3, `twigs caught (${s.stats.bestShower})`);
  console.log(`PASS the Twig Shower: ${s.stats.bestShower} caught`);

  // pause
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const t0 = (await state(page)).t; await page.waitForTimeout(600); assert.equal((await state(page)).t, t0, 'paused time stands still');
  await page.keyboard.press('p'); await page.getByRole('dialog', { name: 'Paused' }).waitFor({ state: 'detached' });
  console.log('PASS pausing');

  // every tab opens
  for (const name of ['Research', 'Stars', 'More', 'Build']) { await page.getByRole('button', { name: new RegExp(name) }).first().click(); await page.locator('.hayloft-panel').waitFor(); }
  console.log('PASS every tab opens');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.goto(base + '/hayloft'); await ready(page);
  const fit = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(fit.sw <= fit.cw, `no sideways scroll on a phone (${fit.sw} > ${fit.cw})`);
  for (const sel of ['.hayloft-canvas', '.hayloft-tabs', '.hayloft-coins']) assert.ok(await page.locator(sel).isVisible(), `${sel} shows on a phone`);
  const tabs = await page.locator('.hayloft-tabs').boundingBox(); assert.ok(tabs.y + tabs.height <= 845, 'the tab bar sits at the bottom');
  const box = await page.locator('.hayloft-canvas').boundingBox(); assert.ok(box.height >= 200, 'the valley gets a good share of the screen');
  console.log('PASS the phone layout');
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('Hayloft Tycoon browser checks passed.');
