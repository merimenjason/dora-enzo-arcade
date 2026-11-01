// Wind-Up Rally in the browser: the menu, the ladder, real keyboard play (run, serve, hop, wind, pause), a whole match won
// and saved across a reload, a corrupt save, two-player versus, the framing on desktops and phones held either way played
// by touch, with no page errors. Needs `npm run dev` running and Playwright installed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'windup-rally-v1';
// Big headless viewports can crash Chrome's GPU raster on this machine with the painted backdrops (other painted games
// do the same at 1920×1080), so the browser draws with SwiftShader.
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
// The headless shell also runs out of resources loading the big paintings again and again as one page reloads, so the
// page that reloads a lot leaves them out (the tin stand-ins show instead); the framing pages load them.
const open = async (viewport = { width: 1280, height: 800 }, mobile = false, art = true) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (!art) await page.route('**/art/rally/*.webp', (r) => r.abort());
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
// The dev server serves hundreds of modules, and a busy headless shell now and then drops one with
// ERR_INSUFFICIENT_RESOURCES and never hydrates, so a page that is not ready in 30 s is loaded again (up to 5 times).
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const reload = async (page) => { await page.reload().catch(() => {}); await ready(page); };
const st = (page) => page.evaluate(() => { const s = window.__rally(); return { ...s }; });
const until = async (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  // ---- the menu and the ladder
  {
    const page = await open(undefined, false, false);
    await page.goto(`${base}/rally`).catch(() => {});
    await ready(page);
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await reload(page);
    assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Wind-Up Rally');
    assert.equal(await page.locator('a.wr-home').getAttribute('href'), '/');
    assert.equal(await page.locator('.wr-mode').count(), 3);
    assert.ok(await page.locator('.wr-mode').nth(1).isDisabled(), 'doubles starts locked');
    assert.ok(await noSideScroll(page));
    ok('menu: title, three modes, doubles locked, the arcade link');

    await page.locator('.wr-mode-cup').click();
    await page.locator('.wr-toy[data-toy=robot]').waitFor();
    assert.equal(await page.locator('.wr-toy').count(), 7);
    assert.ok(!(await page.locator('.wr-toy[data-toy=robot]').isDisabled()));
    assert.ok(await page.locator('.wr-toy[data-toy=frog]').isDisabled());
    ok('ladder: seven toys, only Sprocket open');

    // ---- real keyboard play against Sprocket, with the tutorial
    await page.locator('.wr-toy[data-toy=robot]').click();
    await page.getByRole('button', { name: /Wind up & play/ }).click();
    await until(page, () => window.__rally().screen === 'play');
    await until(page, () => window.__rally().match.t > 1); // let the first frames settle
    let s = await st(page);
    assert.equal(s.match.foe, 'robot'); assert.ok(s.tutorial >= 0, 'the tutorial runs on the first match');
    const x0 = s.match.players[0].x;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(450); await page.keyboard.up('ArrowRight');
    s = await st(page);
    assert.ok(s.match.players[0].x > x0 + 0.4, `running right moves Dora (${x0.toFixed(2)} → ${s.match.players[0].x.toFixed(2)})`);
    const run = s.match.players[0].spring;
    assert.ok(run < 1, 'running spends the spring');
    await page.keyboard.down('s'); await page.waitForTimeout(700); await page.keyboard.up('s');
    s = await st(page);
    assert.ok(s.match.players[0].spring > run, `holding S winds the key (${run.toFixed(3)} → ${s.match.players[0].spring.toFixed(3)})`);
    ok('keys: run with the arrows, wind with S');

    await until(page, () => { const m = window.__rally().match; return m.phase === 'serve' && m.server === 0 && m.shuttle.held === 0; });
    await page.keyboard.press('f');
    await until(page, () => window.__rally().match.shuttle.held < 0, null, 3000);
    await page.keyboard.press('w');
    await until(page, () => window.__rally().match.players[0].y > 0.05, null, 2000);
    ok('keys: W hops and F serves');

    await page.keyboard.press('Escape');
    await until(page, () => window.__rally().paused);
    await page.locator('.wr-pause').waitFor();
    const tPaused = (await st(page)).match.t;
    await page.waitForTimeout(400);
    assert.equal((await st(page)).match.t, tPaused, 'the match stands still while paused');
    await page.keyboard.press('Escape');
    await until(page, () => !window.__rally().paused);
    ok('Escape pauses and resumes');

    // ---- play the rest out and win: the result, the save, the next toy
    await page.evaluate(() => { window.__rallyAuto(true); window.__rallySpeed(12); });
    await until(page, () => window.__rally().screen === 'result', null, 120000);
    s = await st(page);
    assert.equal(s.match.winner, 0, 'Dora beats Sprocket');
    await page.locator('.wr-result').getByText('You won!').waitFor();
    assert.ok(s.save.ladder.robot.win);
    await page.getByRole('button', { name: /Next: Ribbit/ }).waitFor();
    ok(`a whole match: won ${s.match.score.join('–')}, result card and the next toy`);

    await reload(page);
    s = await st(page);
    assert.ok(s.save.ladder.robot.win, 'the win survives a reload');
    await page.locator('.wr-mode-cup').click();
    assert.ok(!(await page.locator('.wr-toy[data-toy=frog]').isDisabled()), 'Ribbit opens');
    ok('save kept across a reload; Ribbit open');

    // ---- a corrupt save is ignored, not misread
    await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"ladder":{"robot":"yes"},"court":12'), KEY);
    await reload(page);
    s = await st(page);
    assert.equal(Object.keys(s.save.ladder).length, 0);
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, ladder: { robot: { win: 'x' } }, court: 'moon', who: 'cat' })), KEY);
    await reload(page);
    s = await st(page);
    assert.equal(s.save.court, 'shop'); assert.ok(['dora', 'enzo'].includes(s.save.who));
    ok('corrupt saves load as a fresh start');

    // ---- two players on one keyboard
    await page.locator('.wr-mode').nth(2).click();
    await page.getByRole('button', { name: /Wind up & play/ }).click();
    await until(page, () => window.__rally().screen === 'play');
    await until(page, () => window.__rally().match.t > 1);
    s = await st(page);
    assert.equal(s.match.mode, 'versus'); assert.deepEqual(s.match.players.map((p) => p.human), [true, true]);
    const ax = s.match.players.map((p) => p.x);
    await page.keyboard.down('d'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400);
    await page.keyboard.up('d'); await page.keyboard.up('ArrowLeft');
    s = await st(page);
    assert.ok(s.match.players[0].x > ax[0] + 0.3 && s.match.players[1].x < ax[1] - 0.3, 'D moves Dora right and ← moves Enzo left');
    ok('versus: both players move on one keyboard');
    await page.close();
  }

  // ---- desktop framing
  for (const [w, h] of [[1280, 800], [1920, 1080]]) {
    const page = await open({ width: w, height: h });
    await page.goto(`${base}/rally`).catch(() => {}); await ready(page);
    await page.evaluate(() => { window.__rallyStart({ foe: 'frog', seed: 3 }); window.__rallyAuto(true); });
    await page.waitForTimeout(2500);
    const L = await page.evaluate(() => window.__rallyLayout());
    const hud = await rect(page, '.wr-hud');
    assert.equal(L.faces.filter(Boolean).length, 2);
    for (const f of L.faces) {
      assert.ok(f.y > hud.y + hud.h - 30, `faces sit below the HUD at ${w}×${h}`);
      assert.ok(f.x >= 0 && f.x + f.w <= w && f.y + f.h <= h, `faces on screen at ${w}×${h}`);
    }
    const tall = Math.min(...L.toys.filter(Boolean).map((t) => t.h));
    assert.ok(tall > h * 0.14, `the toys stand a clear size at ${w}×${h} (${Math.round(tall)} px)`);
    assert.ok(L.court.x > 0 && L.court.x + L.court.w < w, 'the whole court is on screen');
    assert.ok(await noSideScroll(page));
    ok(`framing at ${w}×${h}: toys ${Math.round(tall)} px, faces clear of the HUD`);
    await page.close();
  }

  // ---- phones, held either way, played by touch
  for (const [w, h] of [[844, 390], [390, 844]]) {
    const page = await open({ width: w, height: h }, true);
    await page.goto(`${base}/rally`).catch(() => {}); await ready(page);
    assert.ok(await noSideScroll(page), `menu fits at ${w}×${h}`);
    await page.locator('.wr-mode-cup').tap();
    await page.locator('.wr-toy[data-toy=robot]').tap();
    await page.getByRole('button', { name: /Wind up & play/ }).tap();
    await until(page, () => window.__rally().screen === 'play');
    await page.locator('.wr-pads').waitFor();
    await until(page, () => window.__rally().match.t > 1);
    const L = await page.evaluate(() => window.__rallyLayout());
    const pads = await page.locator('.wr-pad').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
    for (const p of pads) for (const t of [...L.toys, ...L.faces].filter(Boolean)) assert.ok(!overlap(p, t), `pads clear of the toys at ${w}×${h}`);
    const hud = await rect(page, '.wr-hud');
    for (const f of L.faces) assert.ok(f.y > hud.y + hud.h - 20, `faces below the HUD at ${w}×${h}`);
    // hold ▶ to run, then tap SWING to serve
    const x0 = (await st(page)).match.players[0].x;
    const right = page.getByRole('button', { name: 'Run right' });
    await right.dispatchEvent('pointerdown', { pointerId: 3, pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(400);
    await right.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch', isPrimary: true });
    assert.ok((await st(page)).match.players[0].x > x0 + 0.3, `the ▶ pad runs at ${w}×${h}`);
    await until(page, () => { const m = window.__rally().match; return m.phase === 'serve' && m.server === 0 && m.shuttle.held === 0; });
    await page.getByRole('button', { name: 'Swing' }).tap();
    await until(page, () => window.__rally().match.shuttle.held < 0, null, 3000);
    assert.ok(await noSideScroll(page));
    ok(`phone ${w}×${h}: pads clear of the toys, run and serve by touch`);
    await page.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`\nWind-Up Rally e2e: ${pass} checks passed`);
} finally {
  await browser.close();
}
