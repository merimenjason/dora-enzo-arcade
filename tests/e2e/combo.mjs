// Combo Ball in the browser: the title and the way home, the how-to on a first run, the team sheet (the rabbit captain,
// the target and the turns), a real turn (tapping Dora to see her cells, moving, Undo, a pass previewed and played
// that puts chips × mult in the bar with a pop-up, Hint, End turn and its playback), the transfer shop after a target
// (a trait picked by key, then a sixth needing one dropped), missing a target and the result card, the save across a
// reload, a corrupt save, the settings, and a phone held upright (the board turned so we attack upward, cells of 22 css
// pixels or more, tap to select), all with no page errors and no sideways scrolling. Needs `npm run dev` and
// Playwright. SHOTS=<folder> also saves screenshots of the title, a chain, the shop and the phone.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'combo-ball-v2';
const shots = process.env.SHOTS;
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
const st = (page) => page.evaluate(() => { const s = window.__combo(); return { screen: s.screen, save: s.save, sel: s.sel, busy: s.busy, info: s.info, run: s.run }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__combo(); return JSON.stringify({ screen: s.screen, busy: s.busy, run: s.run && { ...s.run, units: undefined } }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__combo().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const at = (page, c, r) => dbg(page, 'screenOf', c, r);
const snap = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/combo`); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.locator('a.cb-home').getAttribute('href'), '/');
  assert.ok(await noSideScroll(page));
  await page.waitForTimeout(400); await snap(page, 'title');
  ok('title: the painting, the menu and the way back to the arcade');

  // ---- a first run opens with the how-to, then the team sheet
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__combo().screen === 'howto');
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await until(page, () => window.__combo().screen === 'play' && window.__combo().run.phase === 'sheet' && window.__combo().save.intro === true);
  await page.locator('.cb-big').waitFor();
  assert.match(await page.locator('.cb-big').getAttribute('src'), /rabbit-big/);
  assert.match(await page.locator('.cb-target').innerText(), /Score \d+ points in \d+ turns/);
  ok('first run: the how-to, then the team sheet with the rabbit captain, the target and the turns');

  // ---- a real turn
  await page.getByRole('button', { name: 'Kick off' }).click();
  await until(page, () => window.__combo().run.phase === 'play');
  let s = await st(page);
  const car = s.run.units.find((u) => u.id === s.run.holder);
  assert.equal(car.team, 0, 'we kick off');
  let p = await at(page, car.c, car.r);
  await page.mouse.click(p.x, p.y);
  await until(page, (id) => window.__combo().sel === id, car.id);
  const cells = await dbg(page, 'reach', car.id);
  const to = cells.find((q) => q.c !== car.c || q.r !== car.r);
  p = await at(page, to.c, to.r);
  await page.mouse.click(p.x, p.y);
  await until(page, ([id, c, r]) => { const s = window.__combo(); const u = s.run.units.find((x) => x.id === id); return !s.busy && u.c === c && u.r === r; }, [car.id, to.c, to.r]);
  ok('tap Dora, see her cells, tap one to move there');
  await page.getByRole('button', { name: 'Undo' }).click();
  await until(page, ([id, c, r]) => { const u = window.__combo().run.units.find((x) => x.id === id); return u.c === c && u.r === r && !u.moved; }, [car.id, car.c, car.r]);
  ok('Undo puts her back');
  // a pass: tap the receiver once to preview, again to play it; the chain shows in the bar
  s = await st(page);
  const mates = s.run.units.filter((u) => u.team === 0 && !u.keeper && u.id !== car.id);
  let mate = mates[0];
  for (const m of mates) if (await dbg(page, 'canPass', car.id, m.id)) { mate = m; break; }
  await page.keyboard.press('Escape');
  p = await at(page, car.c, car.r); await page.mouse.click(p.x, p.y);
  await until(page, (id) => window.__combo().sel === id, car.id);
  const q = await at(page, mate.c, mate.r);
  await page.mouse.click(q.x, q.y);
  await until(page, () => /Pass to/.test(window.__combo().info));
  await page.mouse.click(q.x, q.y);
  await until(page, () => !window.__combo().busy && window.__combo().run.chain.passes === 1);
  await page.locator('.cb-chain[data-on="1"]').waitFor();
  assert.match(await page.locator('.cb-chain').innerText(), /20\s*×\s*1/);
  await snap(page, 'chain');
  ok('a pass previewed and played: the chain shows 20 × 1 in the bar');
  await page.keyboard.press('h');
  await until(page, () => /Hint/.test(window.__combo().info));
  ok('H shows a hint');
  const t0 = (await st(page)).run.turn;
  await page.getByRole('button', { name: 'End turn' }).click();
  await until(page, (t) => window.__combo().run.turn > t && !window.__combo().busy, t0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.mouse.click(10, 10);
  await until(page, (t) => (window.__combo().run.turn > t + 1 || window.__combo().run.phase !== 'play') && !window.__combo().busy, t0);
  ok('End turn plays the turn back; Enter ends the next one');

  // ---- a target reached: the transfer shop
  if ((await st(page)).run.phase === 'play') assert.ok(await dbg(page, 'win'));
  await until(page, () => window.__combo().run.phase === 'shop' && window.__combo().run.offer.length === 3);
  assert.equal(await page.locator('.cb-cards button.cb-trait').count(), 3);
  await snap(page, 'shop');
  const offer = (await st(page)).run.offer;
  await page.keyboard.press('2');
  await until(page, (id) => window.__combo().run.traits.includes(id) && window.__combo().run.phase === 'sheet' && window.__combo().run.match === 1, offer[1]);
  ok('a target reached: three traits on offer, one picked by key');
  // five slots: a sixth needs one dropped
  await dbg(page, 'traits', [offer[1], ...['metronome', 'routeone', 'ricochet', 'backpass', 'crossfield', 'volley'].filter((t) => t !== offer[1])].slice(0, 5));
  await page.keyboard.press('Enter');
  await until(page, () => window.__combo().run.phase === 'play');
  assert.ok(await dbg(page, 'win'));
  await until(page, () => window.__combo().run.phase === 'shop');
  const want = (await st(page)).run.offer[0];
  await page.locator('.cb-cards button.cb-trait').first().click();
  await page.locator('button.cb-drop').first().waitFor();
  assert.equal(await page.locator('button.cb-drop').count(), 5);
  await page.locator('button.cb-drop').first().click();
  await until(page, (id) => window.__combo().run.traits.includes(id) && window.__combo().run.traits.length === 5 && window.__combo().run.match === 2, want);
  ok('five slots full: a sixth trait drops one');

  // ---- a target missed ends the run
  await page.keyboard.press('Enter');
  await until(page, () => window.__combo().run.phase === 'play');
  for (let k = 0; k < 40 && (await st(page)).screen === 'play'; k++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
    await dbg(page, 'skip');
  }
  await until(page, () => window.__combo().screen === 'result');
  assert.match(await page.locator('.cb-result h2').innerText(), /Full time/);
  s = await st(page);
  assert.equal(s.save.stats.runs, 1); assert.equal(s.save.best.matches, 2);
  ok('ending turns without scoring: full time, the result card, the run banked');

  // ---- the save across a reload, and a corrupt one
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.stats.runs, 1); assert.equal(s.save.intro, true);
  await page.evaluate((k) => localStorage.setItem(k, '{"v":2,"best":{"matches":"lots"'), KEY);
  await page.reload(); await ready(page);
  s = await st(page);
  assert.equal(s.save.best.matches, 0); assert.equal(s.save.stats.runs, 0);
  ok('the save survives a reload; a corrupt one starts fresh');

  // ---- settings
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Music').uncheck();
  assert.equal((await st(page)).save.settings.music, false);
  await page.getByRole('button', { name: 'Back' }).click();
  await until(page, () => window.__combo().screen === 'title');
  ok('settings: music off, saved');

  // ---- a phone held upright
  const phone = await open({ width: 390, height: 844 }, true);
  await phone.goto(`${base}/combo`); await ready(phone);
  await phone.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 2, intro: true })), KEY);
  await phone.reload(); await ready(phone);
  await phone.getByRole('button', { name: 'Kick off' }).tap();
  await until(phone, () => window.__combo().run?.phase === 'sheet');
  await phone.getByRole('button', { name: 'Kick off' }).tap();
  await until(phone, () => window.__combo().run.phase === 'play');
  const box = await phone.locator('.cb-canvas').boundingBox();
  assert.ok(box.height > box.width, 'the board turns upright');
  assert.ok(box.width / (256 / 22) >= 22, `cells are ${box.width / (256 / 22)} css px`);
  assert.ok(box.y + box.height <= 844);
  const end = await phone.getByRole('button', { name: 'End turn' }).boundingBox();
  assert.ok(end.y + end.height <= 844, 'End turn is on the screen');
  s = await st(phone);
  const pc = s.run.units.find((u) => u.id === s.run.holder);
  p = await at(phone, pc.c, pc.r);
  const up = await at(phone, pc.c + 2, pc.r);
  assert.ok(up.y < p.y - 30, 'we attack upward');
  await phone.touchscreen.tap(p.x, p.y);
  await until(phone, (id) => window.__combo().sel === id, pc.id);
  const pm = s.run.units.find((u) => u.team === 0 && !u.keeper && u.id !== pc.id), pq = await at(phone, pm.c, pm.r);
  await phone.touchscreen.tap(pq.x, pq.y); await phone.waitForTimeout(150); await phone.touchscreen.tap(pq.x, pq.y);
  await until(phone, () => !window.__combo().busy && window.__combo().run.chain.passes === 1);
  assert.ok(await noSideScroll(phone));
  await phone.waitForTimeout(300); await snap(phone, 'phone');
  ok('phone upright: the board turned to attack upward, big cells, tap to select and pass, End turn in reach');

  assert.deepEqual(errors, []);
  console.log(`\n${pass} checks passed`);
} finally { await browser.close(); }
