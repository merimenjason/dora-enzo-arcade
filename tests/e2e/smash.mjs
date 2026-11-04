// Fluffball Smash! in the browser: the title and the way home, the story ladder, dialogue with the portrait clear of the
// words, the VS card, a real keyboard serve, pause, a special's cut-in with its name clear of the painting, a whole story
// match won and saved across a reload, the talk after it, a corrupt save, Exhibition, and the match on phones held either
// way with the touch controls, all with no page errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'fluffball-smash-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
// a busy dev server now and then drops a module and the page never hydrates, so try again (up to 5 times)
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__smash(); return { screen: s.screen, paused: s.paused, save: s.save, cutin: s.cutin, match: s.match, result: s.result, talk: s.talk }; });
// on a timeout, say where the game was
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__smash(); return JSON.stringify({ screen: s.screen, paused: s.paused, cutin: !!s.cutin, m: s.match && { phase: s.match.phase, t: s.match.t, server: s.match.server, by: s.match.ball.by, over: s.match.over, freeze: s.match.freeze } }); }).catch(() => '?');
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
// the game reads held keys once a frame, so a press is held long enough for a frame to see it
const tap = async (page, key) => { await page.keyboard.down(key); await page.waitForTimeout(80); await page.keyboard.up(key); };
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  // ---- the title and the way home
  let page = await open();
  await page.goto(`${base}/smash`); await ready(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.match(await page.locator('.fs-logo').textContent(), /Fluffball Smash!/);
  assert.equal(await page.locator('a.fs-home').getAttribute('href'), '/');
  assert.equal(await page.locator('.fs-menu button').count(), 4);
  assert.ok(await noSideScroll(page));
  ok('title: logo, four menu buttons and the way back to the arcade');

  // ---- the story ladder: only the first match is open
  await page.locator('.fs-menu button', { hasText: 'Story' }).click();
  assert.equal(await page.locator('.fs-rung').count(), 7);
  assert.equal(await page.locator('.fs-rung[data-step="1"]').isDisabled(), true);
  await page.locator('.fs-rung[data-step="0"]').click();
  assert.equal((await st(page)).screen, 'talk');
  // dialogue: Enter moves it on, and the portrait never sits under the words
  let seen = 0;
  for (let i = 0; i < 12 && (await st(page)).screen === 'talk'; i++) {
    if (await page.locator('.fs-talk-face').count()) { assert.ok(!overlap(await rect(page, '.fs-talk-face'), await rect(page, '.fs-talkbox')), 'the words stay off the portrait'); seen++; }
    await page.keyboard.press('Enter'); await page.waitForTimeout(120);
  }
  assert.ok(seen >= 1, 'a speaker portrait shows');
  await page.locator('.fs-vs').waitFor();
  assert.match(await page.locator('.fs-vs').textContent(), /Bramble/);
  ok(`story: seven rungs, the first open; dialogue by Enter with ${seen} portrait lines clear of the words; then the VS card`);

  // ---- a real serve from the keyboard, and pause
  await page.locator('.fs-vs .fs-go').click();
  await until(page, () => window.__smash().match?.t > 0.3);
  let s = await st(page);
  if (s.match.server === 0) {
    // hold J until the game sees it (a slow frame can swallow a quick tap), then swing once the toss is high
    await page.keyboard.down('KeyJ'); await until(page, () => window.__smash().match.phase === 'toss'); await page.keyboard.up('KeyJ');
    await until(page, () => window.__smash().match.ball.z > 2);
    await page.keyboard.down('KeyJ'); await until(page, () => window.__smash().match.phase !== 'toss'); await page.keyboard.up('KeyJ');
    await until(page, () => ['rally', 'point'].includes(window.__smash().match.phase) && window.__smash().match.ball.by === 0);
    ok('a keyboard serve: J tosses, J again hits');
  } else {
    await until(page, () => window.__smash().match.ball.by === 1);
    ok('Bramble serves first');
  }
  await page.keyboard.press('Escape'); assert.equal((await st(page)).paused, true);
  const tPaused = (await st(page)).match.t; await page.waitForTimeout(400); assert.equal((await st(page)).match.t, tPaused, 'paused play stands still');
  await page.keyboard.press('Escape'); assert.equal((await st(page)).paused, false);
  ok('Esc pauses and resumes');

  // ---- a special: the cut-in shows, with the move's name to the left of the painting
  // as a player would: with a full meter, Space readies the special as the ball comes, and footwork assist runs to it
  await page.evaluate(() => window.__smash().debug.meter(100));
  for (let i = 0; i < 300 && !(await st(page)).cutin; i++) {
    const m = (await st(page)).match;
    if (m.phase === 'serve' && m.server === 0) await tap(page, 'KeyJ');
    else if (m.phase === 'toss' && m.server === 0 && m.ball.z > 2) await tap(page, 'KeyJ');
    else if (m.phase === 'rally' && m.ball.by === 1 && !m.you.ready) { if (m.meter[0] < 100) await page.evaluate(() => window.__smash().debug.meter(100)); await tap(page, 'Space'); }
    await page.waitForTimeout(100);
  }
  assert.ok((await st(page)).cutin, 'Space with a full meter fires the special');
  await page.locator('.fs-cutin-text').waitFor(); await page.waitForTimeout(250);
  const txt = await rect(page, '.fs-cutin-text'), art = await rect(page, '.fs-cutin-art');
  assert.ok(txt.x + txt.w <= art.x + art.w * 0.4, 'the move name stays clear of the face side of the painting');
  assert.match(await page.locator('.fs-cutin-text').textContent(), /Moonleap Meteor|Hundred-Step Drop/);
  ok('Space with a full meter fires a special, its cut-in name clear of the painting');

  // ---- win the match, see the result, the talk after, and the save across a reload
  await page.evaluate(() => window.__smash().debug.auto(true));
  for (let i = 0; i < 6 && (await st(page)).screen === 'match'; i++) { await page.evaluate(() => window.__smash().debug.ff(300)); await page.waitForTimeout(200); }
  await until(page, () => window.__smash().screen === 'result' && !!window.__smash().result, null, 40000);
  s = await st(page);
  if (s.result.win) {
    assert.equal(s.save.story, 1); assert.deepEqual(s.save.beaten, ['bramble']); assert.equal(s.save.stats.wins, 1);
    await page.locator('.fs-resultcard .fs-go').click(); assert.equal((await st(page)).screen, 'talk');
    for (let i = 0; i < 12 && (await st(page)).screen === 'talk'; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); }
    assert.equal((await st(page)).screen, 'story');
    await page.reload(); await ready(page); s = await st(page);
    assert.equal(s.save.story, 1); assert.equal(await page.locator('.fs-menu .fs-big small').textContent().then((t) => /match 2 of 7/.test(t)), true);
    ok('a story match won: result, the talk after, saved across a reload, the story moves to match 2');
  } else {
    assert.equal(s.save.story, 0); assert.equal(s.save.stats.losses, 1); ok('the story match was lost by the bot this time: nothing unlocked, a loss counted');
  }

  // ---- a corrupt save falls back
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"story":"lots","beaten":7,"settings":['), KEY);
  await page.reload(); await ready(page); s = await st(page);
  assert.equal(s.save.story, 0); assert.equal(s.screen, 'title');
  ok('a corrupt save falls back to a new one');

  // ---- settings and Exhibition
  await page.locator('.fs-menu button', { hasText: 'Settings' }).click();
  await page.locator('.fs-set', { hasText: 'Footwork' }).locator('button', { hasText: /manual/i }).click();
  assert.equal((await st(page)).save.settings.footwork, 'manual');
  await page.locator('.fs-set', { hasText: 'Footwork' }).locator('button', { hasText: /assist/i }).click();
  await page.locator('.fs-back').first().click();
  await page.locator('.fs-menu button', { hasText: 'Exhibition' }).click();
  assert.equal(await page.locator('.fs-oppcard').count(), 4, 'four singles rivals');
  assert.equal(await page.locator('.fs-oppcard[data-opp="bramble"]').isDisabled(), false); assert.equal(await page.locator('.fs-oppcard[data-opp="isolde"]').isDisabled(), true);
  ok('Settings saves footwork; Exhibition lists the singles rivals, Bramble open and the rest locked');
  await page.context().close();

  // ---- phones, held upright and sideways: touch controls in a match, nothing off the side
  for (const [vp, tag] of [[{ width: 390, height: 844 }, 'upright'], [{ width: 844, height: 390 }, 'sideways']]) {
    page = await open(vp, true);
    await page.goto(`${base}/smash`); await ready(page);
    assert.ok(await noSideScroll(page), `${tag}: title fits`);
    await page.locator('.fs-menu button', { hasText: 'Story' }).tap(); await page.locator('.fs-rung[data-step="0"]').tap();
    await page.locator('.fs-skip').tap(); await page.locator('.fs-talkbox').tap(); await page.locator('.fs-vs').waitFor();
    assert.ok(await noSideScroll(page), `${tag}: VS fits`);
    await page.locator('.fs-vs .fs-go').tap();
    await until(page, () => window.__smash().match?.t > 0.3);
    for (const b of ['.t-top', '.t-slice', '.t-lob', '.t-special']) assert.ok(await page.locator(b).isVisible(), `${tag}: ${b} shows`);
    assert.ok(await page.locator('.fs-stick').isVisible());
    s = await st(page);
    if (s.match.server === 0) {
      // held until a frame sees it
      await page.locator('.t-top').dispatchEvent('pointerdown'); await until(page, () => window.__smash().match.phase !== 'serve'); await page.locator('.t-top').dispatchEvent('pointerup');
    }
    assert.ok(await noSideScroll(page), `${tag}: the match fits`);
    ok(`phone ${tag}: story to match by touch, touch controls show${s.match.server === 0 ? ', TOP serves' : ''}, nothing off the side`);
    await page.context().close();
  }

  assert.deepEqual(errors, []);
  console.log(`smash e2e: all good (${pass} checks)`);
} finally {
  await browser.close();
}
