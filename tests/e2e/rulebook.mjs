// Rulebook FC in the browser: the title and the way home, the how-to on a first run, the team sheet (the other
// captain and the law the referee reads out), a real turn (tapping Dora to see her cells, moving, Undo, Hint, End turn
// and its playback), the card table after a win (a law picked by key and written into the rulebook), the rulebook
// page, three defeats and the result card, the save across a reload, a corrupt save, the settings, and a phone held
// upright (the board turned so we attack upward, cells of 22 css pixels or more, tap to select), all with no page
// errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'rulebook-fc-v1';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__rulebook(); return { screen: s.screen, save: s.save, sel: s.sel, busy: s.busy, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__rulebook(); return JSON.stringify({ screen: s.screen, busy: s.busy, run: s.run && { ...s.run, units: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__rulebook().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const at = (page, c, r) => dbg(page, 'screenOf', c, r);
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/rulebook`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.rb-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- a first run opens with the how-to, then the team sheet
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__rulebook().screen === 'howto');
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await until(page, () => window.__rulebook().screen === 'play' && window.__rulebook().run.phase === 'law' && window.__rulebook().save.intro === true);
  await page.locator('.rb-big').waitFor();
  assert.match(await page.locator('.rb-big').getAttribute('src'), /rabbit-big/);
  assert.equal(await page.locator('.rb-ref .rb-law').count(), 1);
  ok('first run: the how-to, then the team sheet with the rabbit captain and their law');

  // ---- a real turn
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__rulebook().run.phase === 'play');
  let s = await st(page);
  const car = s.run.units.find((u) => u.id === s.run.holder);
  assert.equal(car.team, 0, 'we kick off');
  let p = await at(page, car.c, car.r);
  await page.mouse.click(p.x, p.y);
  await until(page, (id) => window.__rulebook().sel === id, car.id);
  const cells = await dbg(page, 'reach', car.id);
  const to = cells.find((q) => q.c !== car.c || q.r !== car.r);
  p = await at(page, to.c, to.r);
  await page.mouse.click(p.x, p.y);
  await until(page, ([id, c, r]) => { const s = window.__rulebook(); const u = s.run.units.find((x) => x.id === id); return !s.busy && u.c === c && u.r === r; }, [car.id, to.c, to.r]);
  ok('tap Dora, see her cells, tap one to move there');
  await page.getByRole('button', { name: 'Undo' }).click();
  await until(page, ([id, c, r]) => { const u = window.__rulebook().run.units.find((x) => x.id === id); return u.c === c && u.r === r && !u.moved; }, [car.id, car.c, car.r]);
  await page.keyboard.press('h');
  await until(page, () => /Hint/.test(window.__rulebook().info));
  ok('Undo puts her back; H shows a hint');
  const t0 = (await st(page)).run.turn;
  await page.getByRole('button', { name: 'End turn' }).click();
  await until(page, (t) => window.__rulebook().run.turn > t && !window.__rulebook().busy, t0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.mouse.click(10, 10);
  await until(page, (t) => window.__rulebook().run.turn > t + 1 && !window.__rulebook().busy, t0);
  ok('End turn plays the turn back; Enter ends the next one');

  // ---- a win, and a law for the rulebook
  assert.ok(await dbg(page, 'finish', 2, 0));
  await until(page, () => window.__rulebook().run.phase === 'pick' && window.__rulebook().run.offer.length === 3);
  assert.equal(await page.locator('.rb-cards button.rb-law').count(), 3);
  const offer = (await st(page)).run.offer;
  let n = offer.findIndex((id) => id !== 'redpen');
  await page.keyboard.press(String(n + 1));
  await until(page, (id) => window.__rulebook().run.book.ours.includes(id) && window.__rulebook().run.phase === 'law' && window.__rulebook().run.match === 1, offer[n]);
  ok('a win: three laws on offer, one picked by key and written into the rulebook');
  await page.getByRole('button', { name: /^Rulebook/ }).click();
  await until(page, () => window.__rulebook().screen === 'rulebook');
  assert.ok(await page.locator(`.rb-book [data-law="${offer[n]}"]`).count());
  await page.keyboard.press('Escape');
  await until(page, () => window.__rulebook().screen === 'play');
  ok('the rulebook shows our law and theirs');

  // ---- three defeats end the season
  for (let k = 0; k < 3; k++) {
    await until(page, () => window.__rulebook().run.phase === 'law');
    await page.keyboard.press('Enter');
    await until(page, () => window.__rulebook().run.phase === 'play');
    assert.ok(await dbg(page, 'finish', 0, 1));
    if (k < 2) { await until(page, () => window.__rulebook().run.phase === 'pick'); await page.getByRole('button', { name: 'Next match' }).click(); }
  }
  await until(page, () => window.__rulebook().screen === 'result');
  assert.match(await page.locator('.rb-result h2').innerText(), /Three strikes/);
  s = await st(page);
  assert.equal(s.save.stats.runs, 1); assert.equal(s.save.best.match, 4); assert.ok(s.save.seen.length >= 4);
  ok('three defeats: the result card, and the run banked in the save');

  // ---- the save across a reload, and a corrupt one
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.stats.runs, 1); assert.equal(s.save.intro, true);
  await page.getByRole('button', { name: 'Rulebook' }).click();
  await until(page, () => window.__rulebook().screen === 'rulebook');
  assert.ok(await page.locator('.rb-back').count() > 0, 'laws not met yet show their backs');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"best":{"match":"lots"},"seen":["nope","wide"]'), KEY);
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.best.match, 0); assert.deepEqual(s.save.seen, []);
  ok('the save survives a reload; a corrupt one starts fresh');

  // ---- settings
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Music').uncheck();
  assert.equal((await st(page)).save.settings.music, false);
  await page.getByRole('button', { name: 'Back' }).click();
  await until(page, () => window.__rulebook().screen === 'title');
  ok('settings: music off, saved');

  // ---- a phone held upright
  const phone = await open({ width: 390, height: 844 }, true);
  await phone.goto(`${base}/rulebook`); await ready(phone);
  await phone.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true })), KEY);
  await phone.reload(); await ready(phone);
  await phone.getByRole('button', { name: 'Kick off' }).tap();
  await until(phone, () => window.__rulebook().run?.phase === 'law');
  await phone.getByRole('button', { name: 'Kick off' }).tap();
  await until(phone, () => window.__rulebook().run.phase === 'play');
  const box = await phone.locator('.rb-canvas').boundingBox();
  assert.ok(box.height > box.width, 'the board turns upright');
  assert.ok(box.width / 9 >= 22, `cells are ${box.width / 9} css px`);
  assert.ok(box.y + box.height <= 844);
  const end = await phone.getByRole('button', { name: 'End turn' }).boundingBox();
  assert.ok(end.y + end.height <= 844, 'End turn is on the screen');
  s = await st(phone);
  const pc = s.run.units.find((u) => u.id === s.run.holder);
  p = await at(phone, pc.c, pc.r);
  const q = await at(phone, pc.c + 2, pc.r);
  assert.ok(q.y < p.y - 40, 'we attack upward');
  await phone.touchscreen.tap(p.x, p.y);
  await until(phone, (id) => window.__rulebook().sel === id, pc.id);
  assert.ok(await noSideScroll(phone));
  ok('phone upright: the board turned to attack upward, big cells, tap to select, End turn in reach');

  assert.deepEqual(errors, []);
  console.log(`\n${pass} checks passed`);
} finally { await browser.close(); }
