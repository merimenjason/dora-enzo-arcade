// Cloudsteel in the browser: the title, the first-time guide, every control by keyboard and mouse (move, cut, guard,
// dodge, Enzo's tag, lock-on switch), the prompts, a posture break and finisher, pause and its buttons, a fall and
// the retry, all three rounds to the result and the ending, the record on the title, every setting, a corrupt save,
// and phones held either way with the stick and the four buttons, with no page errors and no sideways scrolling.
// Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'cloudsteel-v1';
const gpu = process.platform === 'darwin' ? ['--enable-unsafe-webgpu', '--enable-features=WebGPU', '--use-angle=metal', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...gpu] });
const errors = []; let pass = 0;
const ok = (m) => { pass++; console.log(`PASS ${m}`); };
const open = async (viewport = { width: 1280, height: 720 }, mobile = false, save) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  if (save !== undefined) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(k, v); } }, [KEY, typeof save === 'string' ? save : JSON.stringify(save)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 40000 }); return; } catch (e) { if (i >= 4) throw e; await page.reload(); }
  }
};
const st = (p) => p.evaluate(() => window.__cloudsteel());
const fight = async (p) => (await st(p)).fight;
const until = async (p, fn, what, ms = 40000) => { const t0 = Date.now(); for (;;) { const f = await fight(p); if (f && fn(f)) return f; if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}: ${JSON.stringify(f)}`); await p.waitForTimeout(30); } };
const dbg = (p, name, ...a) => p.evaluate(([n, args]) => window.__cloudsteel().debug[n](...args), [name, a]);
const seen = { v: 1, best: null, wins: 0, fights: 1, seenHow: true, settings: { assist: true, sound: true, music: true, fx: true } };
const noScroll = async (p) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling');
/** cuts until the round's foes are down (their health set to 1 first) */
const clearRound = async (p, tap) => { const r = (await until(p, (f) => f.phase === 'fight' && f.foes.every((o) => o.state !== 'enter'), 'foes on the terrace')).round; for (let i = 0; i < 80; i++) { const f = await fight(p); if (!f || f.round !== r || f.phase !== 'fight') return; await dbg(p, 'foeHp', 1); await dbg(p, 'hp', 100); await tap(); await p.waitForTimeout(120); } assert.fail('round not cleared'); };

try {
  { // the arcade menu
    const p = await open(); await p.goto(base + '/'); await p.locator('.arcade-card').first().waitFor();
    assert.equal(await p.locator('a[href="/cloudsteel"]').count(), 1); await p.close(); ok('the arcade menu has a Cloudsteel card');
  }
  const p = await open(); await p.goto(base + '/cloudsteel'); await ready(p);
  assert.equal((await st(p)).screen, 'title'); await p.waitForFunction(() => { const i = document.querySelector('.cs-bg img'); return i && i.complete && i.naturalWidth > 0; }); await noScroll(p);
  assert.equal(await p.locator('.cs-home').getAttribute('href'), '/');
  ok('the title shows its painting and a way back to the arcade');
  await p.getByRole('button', { name: 'How to fight' }).click(); assert.equal((await st(p)).screen, 'howto'); assert.equal(await p.locator('.cs-cols .cs-card').count(), 4);
  await p.locator('.cs-back').click(); assert.equal((await st(p)).screen, 'title'); ok('How to fight opens and goes back');
  await p.getByRole('button', { name: 'Begin' }).click(); assert.equal((await st(p)).screen, 'howto');
  await p.getByRole('button', { name: /Start the fight/ }).click(); assert.equal((await st(p)).screen, 'fight'); assert.equal((await st(p)).save.seenHow, true);
  ok('the first fight shows the guide, then starts');
  await until(p, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', 'round one');
  assert.ok(/Atoq/.test(await p.locator('.cs-foe b').textContent())); assert.equal(await p.locator('.cs-foe').getAttribute('data-on'), '1');

  // every control, by keyboard
  await dbg(p, 'place', 0, 5); let a = await fight(p);
  await p.keyboard.down('KeyW'); await until(p, (f) => Math.hypot(f.x - a.x, f.z - a.z) > 0.5, 'W to move'); await p.keyboard.up('KeyW');
  a = await fight(p); await p.keyboard.down('ArrowLeft'); await until(p, (f) => Math.hypot(f.x - a.x, f.z - a.z) > 0.4, 'the arrows to move'); await p.keyboard.up('ArrowLeft'); ok('WASD and the arrows move Dora');
  await p.keyboard.press('KeyJ'); await until(p, (f) => f.state.startsWith('cut'), 'J to cut'); ok('J cuts');
  await until(p, (f) => f.state === 'idle', 'the cut to end');
  await p.keyboard.down('KeyK'); await until(p, (f) => f.state === 'guard', 'K to guard'); await p.keyboard.up('KeyK'); await until(p, (f) => f.state !== 'guard', 'guard to drop'); ok('K guards while held');
  await p.keyboard.down('ShiftLeft'); await until(p, (f) => f.state === 'guard', 'Shift to guard'); await p.keyboard.up('ShiftLeft'); ok('Shift guards too');
  await until(p, (f) => f.state === 'idle' || f.state === 'run', 'Dora free');
  await p.keyboard.press('Space'); await until(p, (f) => f.state === 'dodge', 'Space to dodge'); ok('Space dodges');
  // mouse
  const cv = p.locator('.cs-canvas'); await until(p, (f) => f.state === 'idle', 'Dora free');
  await cv.click({ position: { x: 300, y: 300 } }); await until(p, (f) => f.state.startsWith('cut'), 'a click to cut'); ok('left-click cuts');
  await until(p, (f) => f.state === 'idle', 'the cut to end');
  await p.mouse.move(300, 300); await p.mouse.down({ button: 'right' }); await until(p, (f) => f.state === 'guard', 'right-click to guard'); await p.mouse.up({ button: 'right' }); await until(p, (f) => f.state !== 'guard', 'guard to drop'); ok('right-click guards while held');

  // the prompt, a block, a posture break, the finisher
  await until(p, (f) => f.foes[0].state === 'windup', 'a wind-up', 60000);
  assert.equal(await p.locator('.cs-prompt').getAttribute('data-kind'), 'guard'); assert.ok(await p.locator('.cs-prompt [data-p="guard"]').isVisible());
  await p.keyboard.down('KeyK'); const g1 = await until(p, (f) => f.stats.deflects > 0 || f.posture > 0, 'the blow to meet the guard'); await p.keyboard.up('KeyK'); assert.equal(g1.hp, 100);
  ok(`a wind-up shows "Guard now", and the guard ${g1.stats.deflects ? 'deflects' : 'blocks'} the blow`);
  await dbg(p, 'foePosture', 99);
  for (let i = 0; i < 40 && (await fight(p)).foes[0].state !== 'broken'; i++) { await p.keyboard.press('KeyJ'); await p.waitForTimeout(120); }
  await until(p, (f) => f.foes[0].state === 'broken', 'posture to break'); assert.equal(await p.locator('.cs-foe').getAttribute('data-broken'), '1');
  await until(p, async () => (await p.locator('.cs-prompt').getAttribute('data-kind')) === 'finish', 'the finish prompt');
  const before = (await fight(p)).foes[0].hp;
  for (let i = 0; i < 30 && (await fight(p)).stats.finishers === 0; i++) { await p.keyboard.press('KeyJ'); await p.waitForTimeout(120); }
  const fin = await until(p, (f) => f.stats.finishers === 1 && f.state !== 'finisher', 'the finisher'); assert.ok(before - fin.foes[0].hp >= 60 || fin.foes[0].state === 'dead');
  ok('a broken posture shows "Finish it", and a cut is the finisher');

  // Enzo
  await p.keyboard.press('KeyE'); await p.waitForTimeout(200); assert.equal((await fight(p)).stats.tags, 0);
  await dbg(p, 'tag', 100); await until(p, async () => (await p.locator('.cs-tagbox').getAttribute('data-full')) === '1', 'the full meter');
  await until(p, (f) => f.state === 'idle' || f.state === 'run', 'Dora free'); await p.keyboard.press('KeyE');
  await until(p, (f) => f.stats.tags === 1, 'E to call Enzo'); await until(p, (f) => f.enzo === 'wait' && f.tag < 100, 'Enzo back at his post');
  ok('E does nothing on an empty meter, and calls Enzo on a full one');

  // pause and its buttons
  await p.keyboard.press('Escape'); assert.equal((await st(p)).paused, true); const t1 = (await fight(p)).stats.ticks; await p.waitForTimeout(300); assert.equal((await fight(p)).stats.ticks, t1);
  await p.getByRole('button', { name: /^Help:/ }).click(); assert.equal((await st(p)).save.settings.assist, false); await p.getByRole('button', { name: /^Help:/ }).click(); assert.equal((await st(p)).save.settings.assist, true);
  await p.getByRole('button', { name: 'Back to the fight' }).click(); assert.equal((await st(p)).paused, false);
  await p.locator('.cs-pausebtn').click(); assert.equal((await st(p)).paused, true); await p.keyboard.press('KeyP'); assert.equal((await st(p)).paused, false);
  ok('Esc, P and the pause button stop the fight; the pause menu toggles help and resumes');

  // a fall and the retry
  await dbg(p, 'hp', 1); await p.waitForFunction(() => document.querySelector('.cs-veil h2')?.textContent === 'Dora is down', null, { timeout: 90000 });
  assert.equal((await fight(p)).phase, 'lost'); await p.keyboard.press('Escape'); assert.equal((await st(p)).paused, false);
  await p.getByRole('button', { name: /try the round again/ }).click(); const re = await fight(p); assert.equal(re.hp, 100); assert.equal(re.stats.falls, 1); assert.equal(re.round, 0);
  ok('a fall offers the round again on full health');

  // round two: two foes and the lock-on switch
  const tapJ = () => p.keyboard.press('KeyJ');
  await clearRound(p, tapJ); const r2 = await until(p, (f) => f.round === 1 && f.phase === 'fight', 'round two'); assert.equal(r2.foes.length, 2);
  await p.keyboard.press('KeyQ'); await until(p, (f) => f.target !== r2.target, 'Q to switch foe'); const t2 = (await fight(p)).target; await p.keyboard.press('Tab'); await until(p, (f) => f.target !== t2, 'Tab to switch foe');
  ok('round two has two foes, and Q or Tab switches the lock');
  await clearRound(p, tapJ); const r3 = await until(p, (f) => f.round === 2 && f.phase === 'fight', 'round three'); assert.equal(r3.foes[0].kind, 'bear'); assert.ok(/Ukhu/.test(await p.locator('.cs-foe b').textContent()));
  await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 });
  const done = (await st(p)).done; assert.equal(done.first, true); assert.equal(done.best, true); assert.equal(done.result.falls, 1); assert.notEqual(done.result.rank, 'gold');
  assert.equal(await p.locator('.cs-stats div').count(), 6); assert.equal((await st(p)).save.wins, 1); await noScroll(p);
  ok('the bear falls, and the result shows the seal and six figures');
  await p.getByRole('button', { name: /Cross the bridge/ }).click(); assert.equal((await st(p)).screen, 'ending'); await p.waitForFunction(() => { const i = document.querySelector('.cs-ending .cs-bg img'); return i && i.complete && i.naturalWidth > 0; }); assert.ok(/not built yet/.test(await p.locator('.cs-ending-text').textContent()));
  await p.locator('.cs-ending').getByRole('button', { name: 'Title' }).click(); assert.equal((await st(p)).screen, 'title');
  assert.ok(await p.locator('.cs-best').isVisible()); await p.getByRole('button', { name: 'The Condor Gate' }).click(); assert.equal((await st(p)).screen, 'ending');
  await p.getByRole('button', { name: 'Fight again' }).click(); assert.equal((await st(p)).screen, 'fight'); assert.equal((await st(p)).save.fights, 2);
  await p.keyboard.press('Escape'); await p.getByRole('button', { name: /Leave the terrace/ }).click(); assert.equal((await st(p)).screen, 'title');
  ok('the ending says what is next, the title keeps the record, and a fight can be left from the pause menu');

  // result buttons on a second crossing
  await p.getByRole('button', { name: 'Step onto the terrace' }).click(); for (let r = 0; r < 3; r++) await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 }); assert.equal((await st(p)).done.first, false);
  await p.getByRole('button', { name: 'Fight again' }).click(); assert.equal((await st(p)).screen, 'fight'); await p.keyboard.press('Escape'); await p.getByRole('button', { name: /Leave the terrace/ }).click();
  await p.getByRole('button', { name: 'Step onto the terrace' }).click(); for (let r = 0; r < 3; r++) await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 }); await p.locator('.cs-result').getByRole('button', { name: 'Title' }).click(); assert.equal((await st(p)).screen, 'title');
  ok('Fight again and Title work from the result');

  // settings
  await p.getByRole('button', { name: 'Settings' }).click();
  for (const [name, key] of [['Help', 'assist'], ['Sound', 'sound'], ['Music', 'music']]) {
    const row = p.locator('.cs-set', { hasText: name }).first();
    await row.getByRole('button', { name: 'Off' }).click(); assert.equal((await st(p)).save.settings[key], false); await row.getByRole('button', { name: 'On' }).click(); assert.equal((await st(p)).save.settings[key], true);
  }
  assert.ok(/WebGPU|WebGL 2/.test(await p.locator('.cs-settings .cs-small').textContent()));
  p.once('dialog', (d) => d.accept()); await p.getByRole('button', { name: 'Clear my record' }).click(); assert.equal((await st(p)).save.wins, 0); assert.equal((await st(p)).save.best, null);
  await p.locator('.cs-set', { hasText: 'Effects' }).getByRole('button', { name: 'Off' }).click(); await p.waitForLoadState('load'); await ready(p); assert.equal((await st(p)).save.settings.fx, false);
  await p.getByRole('button', { name: /Step onto|Begin/ }).click(); if ((await st(p)).screen === 'howto') await p.getByRole('button', { name: /Start the fight/ }).click();
  await until(p, (f) => f.phase === 'fight', 'a fight with effects off'); await p.keyboard.press('KeyJ'); await until(p, (f) => f.state.startsWith('cut'), 'a cut with effects off');
  ok('every setting switches, the record clears, and the game runs with effects off');
  await p.close();

  { // a corrupt save
    const c = await open(undefined, false, '{not json'); await c.goto(base + '/cloudsteel'); await ready(c);
    const s = await st(c); assert.equal(s.screen, 'title'); assert.equal(s.save.wins, 0); assert.equal(s.save.settings.assist, true); await c.close(); ok('a corrupt save starts fresh');
  }
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const m = await open(vp, true, seen); await m.goto(base + '/cloudsteel'); await ready(m); await noScroll(m);
    await m.getByRole('button', { name: 'Step onto the terrace' }).tap(); await until(m, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', 'the fight on a phone');
    for (const sel of ['.cs-stick', '.t-cut', '.t-guard', '.t-dodge', '.t-tag', '.cs-hero', '.cs-tagbox', '.cs-foe', '.cs-pausebtn']) { const b = await m.locator(sel).boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, `${sel} fits on the screen`); }
    const over = await m.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; const pads = [r('.cs-stick'), r('.cs-tbtns')], hud = [r('.cs-hero'), r('.cs-tagbox'), r('.cs-foe')]; return pads.some((x) => hud.some((y) => hit(x, y))) || hit(pads[0], pads[1]); });
    assert.equal(over, false, 'the pad and the bars do not overlap');
    await dbg(m, 'place', 0, 5); const a0 = await fight(m), sb = await m.locator('.cs-stick').boundingBox(), cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
    const cdp = await m.context().newCDPSession(m), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', cx, cy); await touch('touchMove', cx, cy - 40); await until(m, (f) => Math.hypot(f.x - a0.x, f.z - a0.z) > 0.4, 'the stick to move Dora'); await touch('touchEnd');
    await m.locator('.t-cut').tap(); await until(m, (f) => f.state.startsWith('cut'), 'CUT'); await until(m, (f) => f.state === 'idle', 'the cut to end');
    await m.locator('.t-dodge').tap(); await until(m, (f) => f.state === 'dodge', 'DODGE'); await until(m, (f) => f.state === 'idle', 'the roll to end');
    const gb = await m.locator('.t-guard').boundingBox(); await touch('touchStart', gb.x + gb.width / 2, gb.y + gb.height / 2); await until(m, (f) => f.state === 'guard', 'GUARD'); await touch('touchEnd'); await until(m, (f) => f.state !== 'guard', 'guard to drop');
    await dbg(m, 'tag', 100); await until(m, (f) => f.state === 'idle' || f.state === 'run', 'Dora free'); await m.locator('.t-tag').tap(); await until(m, (f) => f.stats.tags === 1, 'ENZO');
    await m.locator('.cs-pausebtn').tap(); assert.equal((await st(m)).paused, true); await m.getByRole('button', { name: 'Back to the fight' }).tap(); await noScroll(m);
    ok(`phone ${tag}: the stick moves Dora, CUT, GUARD, DODGE and ENZO work, and the HUD fits`);
    await m.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`cloudsteel e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
