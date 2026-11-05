// The Clocktower Mystery in the browser: the title, the opening talk and the chapter card, walking out through a way
// out, talking to Mr Tock and picking up the oil can, using it on the hatch, switching to Enzo, the notebook, the works
// close-up (a wrong wheel refused, the right one fitted), the last wheel ending the mystery with the best saved,
// carrying on after a reload, a corrupt save, and phones held either way (the painting never under the bar), all with
// no page errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'clocktower-mystery-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  page.on('dialog', (d) => d.accept());
  return page;
};
// a busy dev server now and then drops a module and the page never hydrates, so try again (up to 5 times)
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => window.__clocktower());
const until = async (page, fn, arg, timeout = 15000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    const s = await st(page); throw new Error(`${e.message}\n  game: ${JSON.stringify({ screen: s.screen, who: s.state.who, room: s.state.at, sel: s.sel, inv: s.state.inv, lines: s.lines, card: s.card, works: s.works })}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__clocktower().debug[f](...args), [fn, a]);
/** read through whatever is being said, and close a chapter card */
const talk = async (page) => {
  for (let i = 0; i < 20; i++) {
    const s = await st(page); if (!s.lines.length && !s.card) return;
    await page.keyboard.press('Enter'); await page.waitForTimeout(40);
  }
  throw new Error('the talking never stopped');
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  // ---- title, opening, first steps
  {
    const page = await open();
    await page.goto(`${base}/clocktower`); await ready(page);
    assert.equal((await st(page)).screen, 'title');
    assert.ok(await page.getByRole('heading', { name: /Clocktower/ }).isVisible());
    assert.ok(await page.getByRole('link', { name: /Arcade/ }).isVisible());
    await page.getByRole('button', { name: 'Begin the mystery' }).click();
    await until(page, () => window.__clocktower().lines.length === 3);
    assert.ok(await page.locator('.ct-talk.on').isVisible());
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await until(page, () => window.__clocktower().card === 1);
    await page.getByRole('button', { name: 'Go on' }).click();
    await until(page, () => window.__clocktower().card === null);
    ok('the title, the opening talk and the chapter 1 card');

    await dbg(page, 'fast');
    await page.locator('[data-exit="tower"]').click();
    await until(page, () => window.__clocktower().state.at.dora === 'tower');
    assert.equal((await st(page)).state.at.enzo, 'tower', 'Enzo comes too');
    await page.locator('[data-spot="tock"]').click();
    await until(page, () => window.__clocktower().lines.length > 0); await talk(page);
    assert.ok((await st(page)).state.flags.includes('metTock'));
    await page.locator('[data-spot="oilcan"]').click(); await talk(page);
    await until(page, () => window.__clocktower().state.inv.includes('oilcan'));
    assert.equal(await page.locator('[data-sprite="oilcan"]').count(), 0, 'the oil can is gone from the bench');
    assert.ok(await page.locator('[data-item="oilcan"]').isVisible());
    ok('through the tower door, talking to Mr Tock, the oil can into the satchel');

    await page.locator('[data-exit="clockroom"]').click(); await until(page, () => window.__clocktower().state.at.dora === 'clockroom');
    await page.locator('[data-spot="works"]').click(); await talk(page);
    await page.locator('[data-item="oilcan"]').click();
    assert.equal((await st(page)).sel, 'oilcan'); assert.match(await page.locator('.ct-status').innerText(), /Use the oil can on/);
    await page.locator('[data-spot="hatch"]').click(); await talk(page);
    await until(page, () => window.__clocktower().state.flags.includes('hatchOpen'));
    assert.equal((await st(page)).sel, null);
    ok('picking the oil can and using it on the hatch');

    await page.keyboard.press('KeyX'); await until(page, () => window.__clocktower().state.who === 'enzo');
    assert.equal(await page.locator('[data-who="enzo"]').getAttribute('aria-pressed'), 'true');
    await talk(page); await page.locator('[data-who="dora"]').click(); await until(page, () => window.__clocktower().state.who === 'dora'); await talk(page);
    const h = (await st(page)).state.hints;
    await page.getByRole('button', { name: /Hint/ }).click();
    await until(page, () => window.__clocktower().lines.length === 1);
    assert.match((await st(page)).lines[0], /notebook/); assert.equal((await st(page)).state.hints, h + 1);
    await talk(page);
    await page.keyboard.press('Escape'); await until(page, () => window.__clocktower().menu === true);
    await page.getByRole('button', { name: 'Carry on' }).click(); await until(page, () => window.__clocktower().menu === false);
    ok('switching with X and the buttons, the notebook counts a hint, pause and carry on');

    // ---- carry on after a reload
    await page.reload(); await ready(page);
    assert.ok(await page.getByRole('button', { name: /Carry on · The Clock Stops/ }).isVisible());
    await page.getByRole('button', { name: /Carry on/ }).click();
    await until(page, () => window.__clocktower().screen === 'play');
    const s = await st(page); assert.equal(s.state.at.dora, 'clockroom'); assert.ok(s.state.flags.includes('hatchOpen')); assert.equal(s.lines.length, 0);
    ok('the mystery carries on after a reload, right where it was');

    // ---- the works
    await dbg(page, 'upto', 52); await dbg(page, 'fast');
    await page.locator('[data-spot="works"]').click(); await talk(page);
    await until(page, () => window.__clocktower().works === true);
    await page.locator('[data-slot="0"]').click();
    await until(page, () => window.__clocktower().lines.length === 1); assert.match((await st(page)).lines[0], /Pick a wheel/); await talk(page);
    await page.locator('[data-item="star"]').click(); await page.locator('[data-slot="0"]').click(); await talk(page);
    assert.equal((await st(page)).state.fitted[0], null, 'the star wheel doesn’t sit on the big spindle');
    await page.locator('[data-item="brass"]').click(); await page.locator('[data-slot="0"]').click(); await talk(page);
    await until(page, () => window.__clocktower().state.fitted[0] === 'brass');
    assert.ok(await page.locator('[data-slot="0"] img').isVisible());
    ok('the works close-up: a wheel must be picked, the wrong one won’t sit, the right one fits');

    for (const [it, k] of [['copper', 1], ['silver', 2], ['star', 3]]) { await page.locator(`[data-item="${it}"]`).click(); await page.locator(`[data-slot="${k}"]`).click(); await talk(page); }
    await until(page, () => window.__clocktower().screen === 'ending');
    assert.ok(await page.getByRole('heading', { name: /fair is open/ }).isVisible());
    const sv = (await st(page)).save; assert.equal(sv.done, true); assert.equal(sv.game, null); assert.ok(sv.best && sv.best.moves > 0);
    // the words sit under the painting, not over anyone's face
    const img = await rect(page, '.ct-ending .ct-bg'), txt = await rect(page, '.ct-ending-text');
    assert.ok(txt.y >= img.y + img.h - 1, 'the ending text is below the painting');
    await page.getByRole('button', { name: 'Back to the title' }).click();
    assert.ok(await page.getByText(/Solved! Best:/).isVisible());
    ok('the last wheel strikes eight: the ending, the save marked done with the best');
    assert.ok(await noSideScroll(page));
    await page.context().close();
  }

  // ---- a corrupt save
  {
    const page = await open();
    await page.goto(`${base}/clocktower`); await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"game":{"ch":7},"settings":"x'), KEY);
    await page.reload(); await ready(page);
    assert.equal(await page.getByRole('button', { name: /Carry on/ }).count(), 0);
    await page.getByRole('button', { name: 'Begin the mystery' }).click(); await until(page, () => window.__clocktower().screen === 'play');
    ok('a corrupt save is ignored and a fresh mystery starts');
    await page.context().close();
  }

  // ---- phones, both ways round
  for (const [vp, name] of [[{ width: 390, height: 844 }, 'portrait'], [{ width: 844, height: 390 }, 'landscape']]) {
    const page = await open(vp, true);
    await page.goto(`${base}/clocktower`); await ready(page);
    assert.ok(await noSideScroll(page), `${name}: title doesn’t scroll sideways`);
    await page.getByRole('button', { name: 'Begin the mystery' }).tap();
    await until(page, () => window.__clocktower().lines.length > 0);
    await page.locator('.ct-talk').tap(); await page.locator('.ct-talk').tap(); await page.locator('.ct-talk').tap();
    await page.getByRole('button', { name: 'Go on' }).tap();
    await dbg(page, 'fast');
    await page.locator('[data-exit="tower"]').tap({ force: true });
    await until(page, () => window.__clocktower().state.at.dora === 'tower');
    const stage = await rect(page, '.ct-stage'), bar = await rect(page, '.ct-bar');
    if (name === 'portrait') assert.ok(stage.y + stage.h <= bar.y + 1, 'the painting is above the bar');
    else assert.ok(stage.x + stage.w <= bar.x + 1, 'the painting is beside the bar');
    for (const sel of ['[data-who="dora"]', '[data-who="enzo"]', '.ct-talk', '.ct-tools button']) {
      const r = await rect(page, sel); assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1, `${name}: ${sel} on screen`);
    }
    const hero = await rect(page, '[data-hero="dora"]'), scene = await rect(page, '.ct-scene');
    assert.ok(hero.h > 60, `${name}: Dora is a decent size (${hero.h})`); assert.ok(scene.h >= stage.h * 0.6 || scene.w >= stage.w * 0.98);
    await page.locator('[data-spot="tock"]').tap({ force: true });
    await until(page, () => window.__clocktower().lines.length > 0);
    assert.ok(await page.locator('.ct-talk.on').isVisible());
    assert.ok(await noSideScroll(page), `${name}: no sideways scrolling`);
    ok(`a phone held ${name}: the painting clear of the bar, everything on screen, tapping works`);
    await page.context().close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally {
  await browser.close();
}
console.log(`clocktower e2e: ${pass} passed`);
