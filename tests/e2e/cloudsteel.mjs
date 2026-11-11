// Cloudsteel in the browser. The terrace duel: the title, the first-time guide, every fight control by keyboard and
// mouse (move, cut, guard, dodge, swapping to Enzo, lock-on switch), the prompts, a posture break and finisher, pause and its
// buttons, a fall and the retry, all three rounds to the result and the ending, the record on the title, every
// setting, a corrupt save. The climb: the prologue, talk advanced by every key, a click and a tap, both answers to a
// choice by key and by button, walking by WASD and the arrows, turning the camera by key and by drag, talking,
// picking up, reading a stone, the lantern by F and L, a gate opening, an optional duel turned down and fought, a
// required duel lost, stepped back from, lost again, retried and won, the pause pack, save and leave, continue, travel
// between areas, the last duel, the ending and the finale's buttons. Phones held either way: the fight's stick and four
// buttons, and the climb's stick, ACT, LANTERN, talk taps and choice buttons. The tag team and the quest arrow at
// 1280x800, 844x390 and 390x844, by keys on the desktop and taps on the phones: the Quest arrow setting off and on (the
// label, the chevron and the edge pointer), and in a duel the swap, Enzo's sweep, ward and hop, the swap back, and the
// swap on a full meter that comes in with a strike. No page errors, no sideways scrolling.
// Needs a running server (`npm run dev`, or `npx vinext start` on a build) and Playwright; set BASE_URL to point at it.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// an ES import of Playwright ignores NODE_PATH; require honours it, so a Playwright installed elsewhere can be used
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'cloudsteel-v2';
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
/** while the controls are checked one by one, the foe would win on time: keep Dora standing */
let keepAlive = false;
/** a press while Dora is hit is ignored (as in play), and a blow can land between the check and the press: try a few times */
const tryPress = async (p, press, fn, what) => { for (let i = 0; i < 8; i++) { await until(p, (f) => f.state === 'idle' || f.state === 'run', 'Dora free'); await press(); if (await sawState(p, fn)) return; } assert.fail(what); };
/** watches every frame in the page (a poll from outside can miss a short state such as a cut under load) until `fn`
 * holds for the fight, or until 45 steps of the game have passed without it */
const sawState = (p, fn) => p.waitForFunction(([src]) => {
  const s = window.__cloudsteel(), f = s.fight; if (!f) return false; const w = window;
  if (w.__seenT0 === undefined) w.__seenT0 = f.stats.ticks;
  if ((0, eval)(src)(f)) { delete w.__seenT0; return 'yes'; }
  if (f.stats.ticks - w.__seenT0 > 45) { delete w.__seenT0; return 'no'; }
  return false;
}, [fn.toString()], { polling: 'raf', timeout: 60000 }).then((h) => h.jsonValue()).then((v) => v === 'yes');
const until = async (p, fn, what, ms = 40000) => { const t0 = Date.now(); for (;;) { const f = await fight(p); if (f && fn(f)) return f; if (keepAlive && f && f.phase === 'fight' && (f.hp < 60 || f.enzoHp < 60)) await p.evaluate(() => { const d = window.__cloudsteel().debug; d.hp(100); d.enzoHp(100); }); if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}: ${JSON.stringify(f)}`); await p.waitForTimeout(30); } };
const dbg = (p, name, ...a) => p.evaluate(([n, args]) => window.__cloudsteel().debug[n](...args), [name, a]);
// Nothing below waits a fixed time for the game: under load a frame can take far longer than usual, so every wait is on
// the game's own state (its ticks, mode, line), polled through window.__cloudsteel().
/** the game's step count: the fight's ticks in a fight or duel, otherwise the climb's */
const tickOf = (p) => p.evaluate(() => { const s = window.__cloudsteel(); return s.fight && (s.screen === 'fight' || s.story?.mode === 'duel') ? s.fight.stats.ticks : s.story ? s.story.tick : 0; });
/** waits until the game has run `n` more steps (or `ms` passes: a fight that has ended stops counting) */
const ticks = async (p, n, ms = 5000) => { const t0 = await tickOf(p), d = Date.now(); while ((await tickOf(p)) - t0 < n && Date.now() - d < ms) await p.waitForTimeout(16); };
/** waits for `n` frames to be drawn, for checks that something did not change */
const frames = (p, n = 20) => p.evaluate((k) => new Promise((r) => { let i = 0; const f = () => (++i >= k ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
/** advances talk with `press` until it ends or offers a choice: each press waits until the line may be read on (8 steps
 * after it showed), then for the line to move on, and presses again if the press was lost */
const readOn = async (p, press, what = 'the talk') => {
  const sy = async () => (await st(p)).story, t0 = Date.now();
  for (let i = 0; i < 40 && (await sy())?.mode !== 'talk'; i++) await ticks(p, 2, 500);
  for (;;) {
    let s = await sy(); if (!s || s.mode !== 'talk' || s.choosing) return;
    if (Date.now() - t0 > 60000) assert.fail(`${what} did not end`);
    if (s.t < 8) { await ticks(p, 8 - s.t, 2000); continue; }
    const i0 = s.talkI, tk = s.tick; await press();
    // the line moved on (its count of steps starts again), the talk ended, or the press was lost: try again
    const d = Date.now(); for (;;) { s = await sy(); if (!s || s.mode !== 'talk' || s.talkI !== i0 || s.t < s.tick - tk || s.choosing || Date.now() - d > 3000) break; await p.waitForTimeout(20); }
  }
};
const seen = { v: 2, best: null, wins: 0, fights: 1, seenHow: true, settings: { assist: true, sound: true, music: true, fx: true }, story: null, climbs: 0 };
const noScroll = async (p) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scrolling');
/** cuts until the round's foes are down (their health set to 1 first) */
const clearRound = async (p, tap) => { const r = (await until(p, (f) => f.phase === 'fight' && f.foes.every((o) => o.state !== 'enter'), 'foes on the terrace')).round; const t0 = Date.now(); while (Date.now() - t0 < 90000) { const f = await fight(p); if (!f || f.round !== r || f.phase !== 'fight') return; await dbg(p, 'foeHp', 1); await dbg(p, 'hp', 100); await nextTo(p, f); await tap(); await ticks(p, 7, 1500); } assert.fail('round not cleared'); };
/** an archer keeps her distance: stand Dora next to the foe she is locked on to before the cut */
const nextTo = async (p, f) => { const t = f.foes.find((o) => o.id === f.target && o.state !== 'dead'); if (t && Math.hypot(t.x - f.x, t.z - f.z) > 3) await dbg(p, 'place', t.x, t.z + 1.4); };
/** the hero in front (Dora or Enzo) is free to act */
const meFree = (f) => f.me === 'idle' || f.me === 'run';
const tryMe = async (p, press, fn, what) => { for (let i = 0; i < 8; i++) { await until(p, meFree, 'the hero free'); await press(); if (await sawState(p, fn)) return; } assert.fail(what); };

try {
  { // the arcade menu
    const p = await open(); await p.goto(base + '/'); await p.locator('.arcade-card').first().waitFor();
    assert.equal(await p.locator('a[href="/cloudsteel"]').count(), 1); await p.close(); ok('the arcade menu has a Cloudsteel card');
  }
  const p = await open(); await p.goto(base + '/cloudsteel'); await ready(p);
  assert.equal((await st(p)).screen, 'title'); await p.waitForFunction(() => { const i = document.querySelector('.cs-bg img'); return i && i.complete && i.naturalWidth > 0; }); await noScroll(p);
  assert.equal(await p.locator('.cs-home').getAttribute('href'), '/');
  ok('the title shows its painting and a way back to the arcade');
  await p.getByRole('button', { name: 'How to play' }).click(); assert.equal((await st(p)).screen, 'howto'); assert.equal(await p.locator('.cs-cols .cs-card').count(), 5);
  await p.locator('.cs-back').click(); assert.equal((await st(p)).screen, 'title'); ok('How to play opens and goes back');
  await p.getByRole('button', { name: 'Terrace duel' }).click(); assert.equal((await st(p)).screen, 'howto');
  await p.getByRole('button', { name: /^Start/ }).click(); assert.equal((await st(p)).screen, 'fight'); assert.equal((await st(p)).save.seenHow, true);
  ok('the first fight shows the guide, then starts');
  await until(p, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', 'round one');
  assert.ok(/Atoq/.test(await p.locator('.cs-foe b').textContent())); assert.equal(await p.locator('.cs-foe').getAttribute('data-on'), '1');

  // every control, by keyboard
  keepAlive = true;
  await dbg(p, 'place', 0, 5); let a = await fight(p);
  await p.keyboard.down('KeyW'); await until(p, (f) => Math.hypot(f.x - a.x, f.z - a.z) > 0.5, 'W to move'); await p.keyboard.up('KeyW');
  a = await fight(p); await p.keyboard.down('ArrowLeft'); await until(p, (f) => Math.hypot(f.x - a.x, f.z - a.z) > 0.4, 'the arrows to move'); await p.keyboard.up('ArrowLeft'); ok('WASD and the arrows move Dora');
  await tryPress(p, () => p.keyboard.press('KeyJ'), (f) => f.state.startsWith('cut'), 'J to cut'); ok('J cuts');
  await until(p, (f) => f.state === 'idle', 'the cut to end');
  await p.keyboard.down('KeyK'); await until(p, (f) => f.state === 'guard', 'K to guard'); await p.keyboard.up('KeyK'); await until(p, (f) => f.state !== 'guard', 'guard to drop'); ok('K guards while held');
  await p.keyboard.down('ShiftLeft'); await until(p, (f) => f.state === 'guard', 'Shift to guard'); await p.keyboard.up('ShiftLeft'); ok('Shift guards too');
  await until(p, (f) => f.state === 'idle' || f.state === 'run', 'Dora free');
  await tryPress(p, () => p.keyboard.press('Space'), (f) => f.state === 'dodge', 'Space to dodge'); ok('Space dodges');
  // mouse
  const cv = p.locator('.cs-canvas'); await until(p, (f) => f.state === 'idle', 'Dora free');
  await tryPress(p, () => cv.click({ position: { x: 300, y: 300 } }), (f) => f.state.startsWith('cut'), 'a click to cut'); ok('left-click cuts');
  await until(p, (f) => f.state === 'idle', 'the cut to end');
  await p.mouse.move(300, 300); await p.mouse.down({ button: 'right' }); await until(p, (f) => f.state === 'guard', 'right-click to guard'); await p.mouse.up({ button: 'right' }); await until(p, (f) => f.state !== 'guard', 'guard to drop'); ok('right-click guards while held');

  keepAlive = false;
  // the prompt, a block, a posture break, the finisher
  // the prompt is written by the frame after a wind-up starts: wait for it during the wind-up
  await p.waitForFunction(() => { const s = window.__cloudsteel(), f = s.fight; return f && f.foes[0].state === 'windup' && document.querySelector('.cs-prompt')?.dataset.kind === 'guard'; }, null, { timeout: 60000, polling: 'raf' }); assert.ok(await p.locator('.cs-prompt [data-p="guard"]').isVisible());
  // the next blow, met with the guard already up (a test cannot press in time for every wind-up)
  await until(p, (f) => f.foes[0].state !== 'windup' && f.foes[0].state !== 'strike' && (f.state === 'idle' || f.state === 'run'), 'Dora free, the blow over', 60000);
  await dbg(p, 'hp', 100); await p.keyboard.down('KeyK'); await until(p, (f) => f.state === 'guard', 'the guard up'); await until(p, (f) => f.foes[0].state === 'windup', 'the next wind-up', 60000);
  const hp0 = (await fight(p)).hp; const g1 = await until(p, (f) => f.stats.deflects > 0 || f.posture > 0, 'the blow to meet the guard'); await p.keyboard.up('KeyK'); assert.equal(g1.hp, hp0, 'the guard takes no harm');
  ok(`a wind-up shows "Guard now", and the guard ${g1.stats.deflects ? 'deflects' : 'blocks'} the blow`);
  await dbg(p, 'foePosture', 99);
  // one cut at a time, Dora kept on her feet, until the posture breaks (and before the next cut becomes the finisher)
  for (const t0 = Date.now(); Date.now() - t0 < 60000;) { const f = await fight(p); if (f.foes[0].state === 'broken') break; await dbg(p, 'hp', 100); await dbg(p, 'foePosture', Math.max(f.foes[0].posture, 99)); if (f.state === 'idle' || f.state === 'run') await p.keyboard.press('KeyJ'); await ticks(p, 5, 1500); }
  await until(p, (f) => f.foes[0].state === 'broken', 'posture to break'); assert.equal(await p.locator('.cs-foe').getAttribute('data-broken'), '1');
  await until(p, async () => (await p.locator('.cs-prompt').getAttribute('data-kind')) === 'finish', 'the finish prompt');
  const before = (await fight(p)).foes[0].hp;
  for (const t0 = Date.now(); Date.now() - t0 < 60000 && (await fight(p)).stats.finishers === 0;) { await p.keyboard.press('KeyJ'); await ticks(p, 7, 1500); }
  const fin = await until(p, (f) => f.stats.finishers === 1 && f.state !== 'finisher', 'the finisher'); assert.ok(before - fin.foes[0].hp >= 60 || fin.foes[0].state === 'dead');
  ok('a broken posture shows "Finish it", and a cut is the finisher');

  // the tag team (each move is pressed again at every screen size further down)
  keepAlive = true;
  await until(p, meFree, 'Dora free'); await p.keyboard.press('KeyE'); await until(p, (f) => f.hero === 'enzo', 'E to swap'); assert.equal((await fight(p)).stats.tags, 0);
  assert.equal(await p.locator('.cs-hero b').textContent(), 'Enzo'); assert.equal(await p.locator('.cs-tagbox b').textContent(), 'Dora');
  await until(p, (f) => f.swapCd === 0, 'the rest after a swap'); await p.keyboard.press('KeyE'); await until(p, (f) => f.hero === 'dora', 'E to swap back');
  await dbg(p, 'tag', 100); await until(p, async () => (await p.locator('.cs-tagbox').getAttribute('data-full')) === '1', 'the full meter');
  await until(p, (f) => f.swapCd === 0 && meFree(f), 'Dora free'); await p.keyboard.press('KeyE');
  await until(p, (f) => f.stats.tags === 1 && f.hero === 'enzo', 'E on a full meter: Enzo in with a strike'); await until(p, (f) => f.me === 'idle' || f.me === 'run' || f.me === 'hit', 'Enzo lands');
  await until(p, (f) => f.swapCd === 0, 'the rest'); await p.keyboard.press('KeyE'); await until(p, (f) => f.hero === 'dora', 'back to Dora'); keepAlive = false;
  ok('E swaps Dora and Enzo at any time and back, and on a full meter Enzo comes in with a strike');

  // pause and its buttons
  await p.keyboard.press('Escape'); assert.equal((await st(p)).paused, true); const t1 = (await fight(p)).stats.ticks; await frames(p); assert.equal((await fight(p)).stats.ticks, t1);
  await p.getByRole('button', { name: /^Help:/ }).click(); assert.equal((await st(p)).save.settings.assist, false); await p.getByRole('button', { name: /^Help:/ }).click(); assert.equal((await st(p)).save.settings.assist, true);
  await p.getByRole('button', { name: 'Back to the fight' }).click(); assert.equal((await st(p)).paused, false);
  await p.locator('.cs-pausebtn').click(); assert.equal((await st(p)).paused, true); await p.keyboard.press('KeyP'); assert.equal((await st(p)).paused, false);
  ok('Esc, P and the pause button stop the fight; the pause menu toggles help and resumes');

  // a fall and the retry
  await dbg(p, 'hp', 1); await dbg(p, 'enzoHp', 1); await p.waitForFunction(() => document.querySelector('.cs-veil h2')?.textContent === 'Dora and Enzo are down', null, { timeout: 90000 });
  assert.equal((await fight(p)).phase, 'lost'); await p.keyboard.press('Escape'); assert.equal((await st(p)).paused, false);
  await p.getByRole('button', { name: /try the round again/ }).click(); const re = await fight(p); assert.equal(re.hp, 100); assert.equal(re.stats.falls, 1); assert.equal(re.round, 0);
  ok('a fall offers the round again on full health');

  // round two: two foes and the lock-on switch
  const tapJ = () => p.keyboard.press('KeyJ');
  await clearRound(p, tapJ); const r2 = await until(p, (f) => f.round === 1 && f.phase === 'fight', 'round two'); assert.equal(r2.foes.length, 3); assert.equal(r2.foes[2].kind, 'archer');
  await p.keyboard.press('KeyQ'); await until(p, (f) => f.target !== r2.target, 'Q to switch foe'); const t2 = (await fight(p)).target; await p.keyboard.press('Tab'); await until(p, (f) => f.target !== t2, 'Tab to switch foe');
  ok('round two has two foes and an archer, and Q or Tab switches the lock');
  await clearRound(p, tapJ); const r3 = await until(p, (f) => f.round === 2 && f.phase === 'fight', 'round three'); assert.equal(r3.foes[0].kind, 'bear'); assert.ok(/Ukhu/.test(await p.locator('.cs-foe b').textContent()));
  await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 });
  const done = (await st(p)).done; assert.equal(done.first, true); assert.equal(done.best, true); assert.equal(done.result.falls, 1); assert.notEqual(done.result.rank, 'gold');
  assert.equal(await p.locator('.cs-stats div').count(), 6); assert.equal((await st(p)).save.wins, 1); await noScroll(p);
  ok('the bear falls, and the result shows the seal and six figures');
  await p.getByRole('button', { name: /Cross the bridge/ }).click(); assert.equal((await st(p)).screen, 'ending'); await p.waitForFunction(() => { const i = document.querySelector('.cs-ending .cs-bg img'); return i && i.complete && i.naturalWidth > 0; }); assert.ok(/the climb/.test(await p.locator('.cs-ending-text').textContent()));
  await p.locator('.cs-ending').getByRole('button', { name: 'Title' }).click(); assert.equal((await st(p)).screen, 'title');
  assert.ok(await p.locator('.cs-best').isVisible()); await p.getByRole('button', { name: 'The Condor Gate' }).click(); assert.equal((await st(p)).screen, 'ending');
  await p.getByRole('button', { name: 'Fight again' }).click(); assert.equal((await st(p)).screen, 'fight'); assert.equal((await st(p)).save.fights, 2);
  await p.keyboard.press('Escape'); await p.getByRole('button', { name: /Leave the terrace/ }).click(); assert.equal((await st(p)).screen, 'title');
  ok('the ending points to the climb, the title keeps the record, and a fight can be left from the pause menu');

  // result buttons on a second crossing
  await p.getByRole('button', { name: 'Terrace duel' }).click(); for (let r = 0; r < 3; r++) await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 }); assert.equal((await st(p)).done.first, false);
  await p.getByRole('button', { name: 'Fight again' }).click(); assert.equal((await st(p)).screen, 'fight'); await p.keyboard.press('Escape'); await p.getByRole('button', { name: /Leave the terrace/ }).click();
  await p.getByRole('button', { name: 'Terrace duel' }).click(); for (let r = 0; r < 3; r++) await clearRound(p, tapJ);
  await p.waitForFunction(() => window.__cloudsteel().screen === 'result' && window.__cloudsteel().done, null, { timeout: 60000 }); await p.locator('.cs-result').getByRole('button', { name: 'Title' }).click(); assert.equal((await st(p)).screen, 'title');
  ok('Fight again and Title work from the result');

  // settings
  await p.getByRole('button', { name: 'Settings' }).click();
  for (const [name, key] of [['Help', 'assist'], ['Sound', 'sound'], ['Music', 'music'], ['Quest arrow', 'quest']]) {
    const row = p.locator('.cs-set', { hasText: name }).first();
    await row.getByRole('button', { name: 'Off' }).click(); assert.equal((await st(p)).save.settings[key], false); await row.getByRole('button', { name: 'On' }).click(); assert.equal((await st(p)).save.settings[key], true);
  }
  assert.ok(/WebGPU|WebGL 2/.test(await p.locator('.cs-settings .cs-small').textContent()));
  p.once('dialog', (d) => d.accept()); await p.getByRole('button', { name: 'Clear my record' }).click(); assert.equal((await st(p)).save.wins, 0); assert.equal((await st(p)).save.best, null);
  await p.locator('.cs-set', { hasText: 'Effects' }).getByRole('button', { name: 'Off' }).click(); await p.waitForLoadState('load'); await ready(p); assert.equal((await st(p)).save.settings.fx, false);
  await p.getByRole('button', { name: 'Terrace duel' }).click(); if ((await st(p)).screen === 'howto') await p.getByRole('button', { name: /^Start/ }).click();
  await until(p, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', 'a fight with effects off'); keepAlive = true; await tryPress(p, () => p.keyboard.press('KeyJ'), (f) => f.state.startsWith('cut'), 'a cut with effects off'); keepAlive = false;
  ok('every setting switches, the record clears, and the game runs with effects off');
  await p.close();

  // ---------------------------------------------------------------- the climb
  {
    const q = await open(undefined, false, seen); await q.goto(base + '/cloudsteel'); await ready(q);
    const sy = async () => (await st(q)).story;
    const waitS = async (fn, what, ms = 30000) => { const t0 = Date.now(); for (;;) { const s = await sy(); if (s && fn(s)) return s; if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}: ${JSON.stringify(s && { mode: s.mode, area: s.area, x: s.x, z: s.z, line: s.line })}`); await q.waitForTimeout(40); } };
    const lineOf = async () => (await sy()).line?.text;
    /** advances talk with `key` until it ends, or until a choice is offered */
    const read = (key = 'KeyE') => readOn(q, () => q.keyboard.press(key));
    /** a new press of E or ACT needs the game to have seen the last one let go: wait a few steps of walking */
    const settle = () => waitS((s) => s.mode === 'walk' && s.t >= 3, 'Dora to stand free');
    const choose = async (yes) => { await waitS((s) => s.choosing, 'a choice'); await q.keyboard.press(yes ? 'KeyY' : 'KeyN'); };
    const fightIn = async () => (await st(q)).fight;
    const untilF = async (fn, what, ms = 40000) => { const t0 = Date.now(); for (;;) { const f = await fightIn(); if (f && fn(f)) return f; if (f && f.phase === 'fight' && f.hp < 60 && f.hp > 1) await dbg(q, 'hp', 100); if (f && f.phase === 'fight' && f.enzoHp < 60 && f.enzoHp > 1) await dbg(q, 'enzoHp', 100); if (Date.now() - t0 > ms) assert.fail(`timed out waiting for ${what}: ${JSON.stringify(f && { phase: f.phase, state: f.state })}`); await q.waitForTimeout(30); } };
    const winDuel = async () => { await untilF((f) => f.phase === 'fight' && f.foes.every((o) => o.state !== 'enter'), 'the duel to start'); for (const t0 = Date.now(); Date.now() - t0 < 90000 && (await sy()).mode === 'duel';) { await dbg(q, 'foeHp', 1); await dbg(q, 'hp', 100); await dbg(q, 'enzoHp', 100); const f = await fightIn(); if (f && f.hero === 'dora') await nextTo(q, f); await q.keyboard.press('KeyJ'); await ticks(q, 8, 1500); } assert.notEqual((await sy()).mode, 'duel'); };
    const near = async (label) => { await q.waitForFunction((l) => { const n = document.querySelector('.cs-near'); return n && n.dataset.on === '1' && n.textContent.includes(l); }, label, { timeout: 10000 }); };

    await q.getByRole('button', { name: 'Begin the climb' }).click(); assert.equal((await st(q)).screen, 'prologue');
    await q.getByRole('button', { name: /Start the climb/ }).click(); assert.equal((await st(q)).screen, 'story');
    await waitS((s) => s.mode === 'talk', 'the opening talk'); await q.locator('.cs-talk').waitFor(); assert.equal(await q.locator('.cs-talk .cs-who').textContent(), 'Enzo');
    ok('Begin the climb shows the prologue, then the climb opens with Enzo talking');
    // every way to read on
    for (const how of ['KeyE', 'Enter', 'Space', 'KeyJ', 'click']) {
      const before = await lineOf(); await waitS((s) => s.mode !== 'talk' || s.t >= 8, 'the line to be readable');
      if (how === 'click') await q.locator('.cs-talk').click(); else await q.keyboard.press(how);
      await waitS((s) => s.line?.text !== before || s.mode !== 'talk', `${how} to read on`);
      if ((await sy()).mode !== 'talk') break;
    }
    await read(); assert.equal((await sy()).mode, 'walk'); assert.equal(await q.locator('.cs-talk').count(), 0);
    ok('E, Enter, Space, J and a click on the box all read on');

    // walking and the camera
    for (const [k, what] of [['KeyW', 'W'], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['ArrowUp', 'Up'], ['ArrowLeft', 'Left'], ['ArrowDown', 'Down'], ['ArrowRight', 'Right']]) {
      await dbg(q, 'go', 0, 2, Math.PI); const a = await sy(); await q.keyboard.down(k);
      await waitS((s) => Math.hypot(s.x - a.x, s.z - a.z) > 0.4, `${what} to walk`); await q.keyboard.up(k);
    }
    ok('WASD and the arrows walk Dora');
    let y0 = (await sy()).camYaw; await q.keyboard.down('KeyZ'); await waitS((s) => Math.abs(s.camYaw - y0) > 0.2, 'Z to turn'); await q.keyboard.up('KeyZ'); const y1 = (await sy()).camYaw;
    await q.keyboard.down('KeyC'); await waitS((s) => Math.abs(s.camYaw - y1) > 0.2, 'C to turn'); await q.keyboard.up('KeyC');
    y0 = (await sy()).camYaw; await q.mouse.move(500, 300); await q.mouse.down(); await q.mouse.move(700, 300, { steps: 6 }); await q.mouse.up(); assert.ok(Math.abs((await sy()).camYaw - y0) > 0.3, 'a drag turns'); assert.equal((await sy()).mode, 'walk', 'a drag is not a click');
    ok('Z and C, and a drag across the scene, turn the camera');

    // talking to someone, by key and by click
    await dbg(q, 'go', -4.2, 6.6, -1.9); await near('Talk to Qori'); await q.keyboard.press('KeyE'); await waitS((s) => s.mode === 'talk', 'E to talk');
    assert.equal(await q.locator('.cs-talk .cs-who').textContent(), 'Qori'); await read(); assert.ok(await q.locator('.cs-talk').count() === 0);
    await dbg(q, 'go', -4.2, 6.6, -1.9); await near('Talk to Qori'); await q.mouse.click(640, 300); await waitS((s) => s.mode === 'talk', 'a click to talk'); await read('Enter');
    ok('near Qori the prompt says "Talk to Qori"; E or a click talks, and Dora and Enzo answer');
    // picking up
    await dbg(q, 'go', 6, 13.2, Math.PI); await near('Pick up'); await q.keyboard.press('KeyE'); await waitS((s) => s.mode === 'pickup', 'the pickup');
    await q.locator('.cs-toast').waitFor(); assert.ok(/Quipu 1 of 9/.test(await q.locator('.cs-toast').textContent())); assert.ok((await sy()).got.includes('q1'));
    await q.getByRole('button', { name: 'Carry on' }).click(); assert.equal(await q.locator('.cs-toast').count(), 0); await waitS((s) => s.mode === 'walk', 'Dora to stand up'); assert.ok(/1\/9/.test(await q.locator('.cs-area').textContent()));
    ok('E picks up a quipu: a card says what it is, Carry on closes it, and the count goes up');
    // the lantern, by F and by L
    await dbg(q, 'go', 0, 4, Math.PI); await q.keyboard.press('KeyF'); await waitS((s) => s.mode === 'lantern', 'F for the lantern'); await waitS((s) => s.mode === 'walk', 'the lantern to go down');
    assert.ok((await sy()).enzo.lantern >= 0);
    // reading a stone, then waking it
    await dbg(q, 'go', 1.6, -21.5, Math.PI); await near('Look at the stone'); await q.keyboard.press('KeyE'); await waitS((s) => s.mode === 'talk', 'reading the stone'); await read();
    await q.keyboard.press('KeyL'); await waitS((s) => s.flags.includes('gate:sun'), 'L for the lantern to wake the sun-stone'); assert.ok((await sy()).lit.includes('sun'));
    await q.locator('.cs-banner.on').waitFor(); ok('F and L lift the lantern; E reads the sun-stone, and the lantern wakes it and opens the gate');

    // an optional duel: no by key, no by button, then yes
    await dbg(q, 'go', 26.2, -8.4, Math.PI / 2); await near('Talk to'); await q.keyboard.press('KeyE'); await read(); await waitS((s) => s.choosing, 'the challenge');
    await q.keyboard.press('ArrowRight'); assert.ok(/Not now/.test(await q.locator('.cs-choice .cs-go').textContent())); await q.keyboard.press('KeyE'); await waitS((s) => s.mode === 'walk', 'turning it down by key'); assert.equal((await sy()).duel, null);
    await settle(); await q.keyboard.press('KeyE'); await read(); await waitS((s) => s.choosing, 'the challenge again'); await q.keyboard.press('KeyN'); await waitS((s) => s.mode === 'walk', 'N for no');
    await settle(); await q.keyboard.press('KeyE'); await read(); await waitS((s) => s.choosing, 'the challenge again'); await q.getByRole('button', { name: 'Not now' }).click(); await waitS((s) => s.mode === 'walk', 'the Not now button');
    await settle(); await q.keyboard.press('KeyE'); await read(); await waitS((s) => s.choosing, 'the challenge again'); await q.getByRole('button', { name: /Duel the Sword-Kin/ }).click();
    await waitS((s) => s.mode === 'duel' && s.duel === 'kin1', 'the duel'); await q.locator('.cs-foe[data-on="1"]').waitFor(); assert.equal((await fightIn()).foes.length, 3);
    ok('an optional duel can be turned down by arrow and E, by N, or by its button, and taken by its button');
    // every fight control inside a story duel
    await untilF((f) => f.phase === 'fight' && f.foes.every((o) => o.state !== 'enter'), 'the foes'); let a = await fightIn();
    await q.keyboard.down('KeyW'); await untilF((f) => Math.hypot(f.x - a.x, f.z - a.z) > 0.4, 'W in a duel'); await q.keyboard.up('KeyW');
    // a foe's blow can land between seeing Dora free and the press, so each press gets a few tries
    const tryPressQ = async (press, fn, what) => { for (let i = 0; i < 8; i++) { await untilF((f) => f.state === 'idle' || f.state === 'run', 'Dora free'); await press(); if (await sawState(q, fn)) return; } assert.fail(what); };
    await tryPressQ(() => q.keyboard.press('KeyJ'), (f) => f.state.startsWith('cut'), 'J to cut'); await untilF((f) => f.state === 'idle' || f.state === 'run', 'the cut to end');
    await q.keyboard.down('KeyK'); await untilF((f) => f.state === 'guard', 'K'); await q.keyboard.up('KeyK'); await untilF((f) => f.state !== 'guard', 'guard down');
    await tryPressQ(() => q.keyboard.press('Space'), (f) => f.state === 'dodge', 'Space to dodge'); await untilF((f) => f.state === 'idle' || f.state === 'run', 'the roll to end');
    await tryPressQ(() => q.mouse.click(640, 400), (f) => f.state.startsWith('cut'), 'a click to cut'); await untilF((f) => f.state === 'idle' || f.state === 'run', 'the cut to end');
    await q.mouse.move(640, 400); await q.mouse.down({ button: 'right' }); await untilF((f) => f.state === 'guard', 'right-click'); await q.mouse.up({ button: 'right' });
    const t0 = (await fightIn()).target; await q.keyboard.press('KeyQ'); await untilF((f) => f.target !== t0, 'Q to switch');
    await dbg(q, 'tag', 100); await untilF((f) => f.state === 'idle' || f.state === 'run', 'Dora free'); await q.keyboard.press('KeyE'); await untilF((f) => f.stats.tags === 1 && f.hero === 'enzo', 'E for Enzo');
    assert.equal((await sy()).mode, 'duel', 'E in a duel swaps to Enzo, it does not talk');
    await untilF((f) => f.swapCd === 0 && (f.me === 'idle' || f.me === 'run'), 'Enzo free'); await q.keyboard.press('KeyE'); await untilF((f) => f.hero === 'dora', 'E back to Dora');
    await winDuel(); await waitS((s) => s.mode === 'talk', 'the talk after'); assert.ok((await sy()).got.includes('edge')); await read(); await q.locator('.cs-toast').waitFor(); await q.getByRole('button', { name: 'Carry on' }).click();
    assert.ok((await sy()).won.includes('kin1')); ok('in a story duel J, K, Space, a click, a right-click, Q and E all work; the win gives the Rain-Tempered Edge');

    // a required duel: lose, step back, lose, try again, win
    await dbg(q, 'go', 0, -1.8, Math.PI); await waitS((s) => s.mode === 'talk', 'Atoq to speak'); await read(); await waitS((s) => s.mode === 'duel' && s.duel === 'atoq', 'the Atoq duel');
    await untilF((f) => f.phase === 'fight', 'the duel'); await dbg(q, 'hp', 1); await dbg(q, 'enzoHp', 1); await q.waitForFunction(() => document.querySelector('.cs-veil h2')?.textContent === 'Dora and Enzo are down', null, { timeout: 90000 });
    await q.getByRole('button', { name: /Step back down the path/ }).click(); const back = await waitS((s) => s.mode !== 'duel', 'the step back'); assert.ok(Math.hypot(back.x - 0, back.z - 4) < 0.2, 'back at the foot of the plaza'); assert.ok(!back.won.includes('atoq'));
    await waitS((s) => s.mode === 'walk', 'walking again'); await dbg(q, 'go', 0, -1.8, Math.PI); await waitS((s) => s.mode === 'talk', 'Atoq again'); await read(); await waitS((s) => s.mode === 'duel', 'the duel again');
    await untilF((f) => f.phase === 'fight', 'the duel'); await dbg(q, 'hp', 1); await dbg(q, 'enzoHp', 1); await q.waitForFunction(() => document.querySelector('.cs-veil h2')?.textContent === 'Dora and Enzo are down', null, { timeout: 90000 });
    await q.getByRole('button', { name: /try the duel again/ }).click(); assert.equal((await fightIn()).hp, 100);
    await winDuel(); await waitS((s) => s.won.includes('atoq') && s.mode === 'talk', 'the talk after Atoq'); await read();
    ok('a lost duel offers a step back down the path or another try; both work, and the win is kept');

    // the pause pack, save and leave, continue
    await q.keyboard.press('Escape'); assert.equal((await st(q)).paused, true); const pack = await q.locator('.cs-pack').textContent();
    assert.ok(/Rain-Tempered Edge/.test(pack) && /Quipus: 1 of 9/.test(pack) && /Duels won: 2 of 6/.test(pack), pack);
    const at = (await sy()).tick; await frames(q); assert.equal((await sy()).tick, at);
    await q.getByRole('button', { name: /^Help:/ }).click(); assert.equal((await st(q)).save.settings.assist, false); await q.getByRole('button', { name: /^Help:/ }).click();
    await q.getByRole('button', { name: 'Back to the climb' }).click(); assert.equal((await st(q)).paused, false);
    await q.locator('.cs-pausebtn').click(); assert.equal((await st(q)).paused, true); await q.keyboard.press('KeyP'); assert.equal((await st(q)).paused, false);
    await q.keyboard.press('Escape'); await q.getByRole('button', { name: 'Save and leave' }).click(); assert.equal((await st(q)).screen, 'title');
    assert.ok((await st(q)).save.story.won.includes('atoq'));
    await q.reload(); await ready(q); await q.getByRole('button', { name: 'Continue the climb' }).click(); assert.equal((await st(q)).screen, 'story');
    let s2 = await sy(); assert.equal(s2.area, 'terrace'); assert.ok(s2.won.includes('atoq') && s2.won.includes('kin1') && s2.got.includes('q1') && s2.flags.includes('gate:sun'));
    ok('the pause pack lists upgrades, quipus and duels; P, Esc and the button pause; Save and leave, a reload and Continue pick up the climb');

    // travel: through the open gate to the forest
    await dbg(q, 'go', 0, -23.5, Math.PI); await q.keyboard.down('KeyW'); await waitS((s) => s.area === 'forest', 'the way north'); await q.keyboard.up('KeyW');
    await q.waitForFunction(() => document.querySelector('.cs-area b')?.textContent === 'The Cloud-Forest Path'); await waitS((s) => s.mode === 'talk', 'the forest talk'); await read();
    ok('the open gate leads on to the Cloud-Forest Path');
    // the rest of the way, quickly, to the last duel
    for (const d of ['atoq', 'kin1', 'ambush', 'titu', 'mallku']) await dbg(q, 'win', d);
    for (const i of ['wick', 'jade', 'feather', 'claw', 'flame']) await dbg(q, 'give', i);
    for (const f of ['gate:outer', 'gate:worlds', 'seen:citadel', 'seen:crossed']) await dbg(q, 'flag', f);
    await dbg(q, 'area', 'citadel', 0, -28, Math.PI); await waitS((s) => s.area === 'citadel', 'the citadel'); await dbg(q, 'go', 0, -33, Math.PI);
    await waitS((s) => s.mode === 'talk', 'Ukhu'); await read(); await waitS((s) => s.mode === 'duel' && s.duel === 'ukhu', 'the Ukhu duel');
    assert.equal((await fightIn()).foes[0].kind, 'bear'); assert.ok(/Ukhu/.test(await q.locator('.cs-foe b').textContent()));
    await winDuel(); await waitS((s) => s.mode === 'talk', 'Ukhu after'); await read(); await waitS((s) => s.mode === 'end', 'the end');
    await q.waitForFunction(() => window.__cloudsteel().screen === 'finale', null, { timeout: 15000 }); await q.waitForFunction(() => { const i = document.querySelector('.cs-finale .cs-bg img'); return i && i.complete && i.naturalWidth > 0; });
    assert.equal(await q.locator('.cs-finale .cs-stats div').count(), 6); assert.equal((await st(q)).save.climbs, 1); await noScroll(q);
    ok('Ukhu the bear is the last duel; winning it lights the Lamp, and the finale shows six figures');
    await q.getByRole('button', { name: 'Title' }).click(); assert.equal((await st(q)).screen, 'title'); assert.ok(await q.getByRole('button', { name: 'Climb again' }).isVisible());
    await q.getByRole('button', { name: 'The Condor Gate' }).click(); assert.equal((await st(q)).screen, 'finale');
    await q.getByRole('button', { name: 'Terrace duel' }).click(); assert.equal((await st(q)).screen, 'fight'); await q.keyboard.press('Escape'); await q.getByRole('button', { name: /Leave the terrace/ }).click();
    await q.getByRole('button', { name: 'The Condor Gate' }).click(); await q.locator('.cs-finale').getByRole('button', { name: 'Climb again' }).click(); assert.equal((await st(q)).screen, 'prologue');
    assert.equal((await st(q)).save.story.won.length, 0); await q.getByRole('button', { name: /Start the climb/ }).click(); assert.equal((await sy()).area, 'terrace');
    await q.keyboard.press('Escape'); await q.getByRole('button', { name: 'Save and leave' }).click();
    q.once('dialog', (d) => d.accept()); await q.getByRole('button', { name: 'New climb' }).click(); assert.equal((await st(q)).screen, 'prologue');
    ok('from the finale: Title, The Condor Gate, Terrace duel and Climb again all work; New climb starts over after asking');
    await q.close();
  }
  { // a corrupt save
    const c = await open(undefined, false, '{not json'); await c.goto(base + '/cloudsteel'); await ready(c);
    const s = await st(c); assert.equal(s.screen, 'title'); assert.equal(s.save.wins, 0); assert.equal(s.save.settings.assist, true); await c.close(); ok('a corrupt save starts fresh');
  }
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) {
    const m = await open(vp, true, seen); await m.goto(base + '/cloudsteel'); await ready(m); await noScroll(m);
    await m.getByRole('button', { name: 'Terrace duel' }).tap(); await until(m, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', 'the fight on a phone'); keepAlive = true;
    for (const sel of ['.cs-stick', '.t-cut', '.t-guard', '.t-dodge', '.t-tag', '.cs-hero', '.cs-tagbox', '.cs-foe', '.cs-pausebtn']) { const b = await m.locator(sel).boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, `${sel} fits on the screen`); }
    const over = await m.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; const pads = [r('.cs-stick'), r('.cs-tbtns')], hud = [r('.cs-hero'), r('.cs-tagbox'), r('.cs-foe')]; return pads.some((x) => hud.some((y) => hit(x, y))) || hit(pads[0], pads[1]); });
    assert.equal(over, false, 'the pad and the bars do not overlap');
    await dbg(m, 'place', 0, 5); const a0 = await fight(m), sb = await m.locator('.cs-stick').boundingBox(), cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
    const cdp = await m.context().newCDPSession(m), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', cx, cy); await touch('touchMove', cx, cy - 40); await until(m, (f) => Math.hypot(f.x - a0.x, f.z - a0.z) > 0.4, 'the stick to move Dora'); await touch('touchEnd');
    await tryPress(m, () => m.locator('.t-cut').tap(), (f) => f.state.startsWith('cut'), 'CUT'); await until(m, (f) => f.state === 'idle' || f.state === 'run', 'the cut to end');
    await tryPress(m, () => m.locator('.t-dodge').tap(), (f) => f.state === 'dodge', 'DODGE'); await until(m, (f) => f.state === 'idle' || f.state === 'run', 'the roll to end');
    const gb = await m.locator('.t-guard').boundingBox(); await touch('touchStart', gb.x + gb.width / 2, gb.y + gb.height / 2); await until(m, (f) => f.state === 'guard', 'GUARD'); await touch('touchEnd'); await until(m, (f) => f.state !== 'guard', 'guard to drop');
    await dbg(m, 'tag', 100); await tryPress(m, () => m.locator('.t-tag').tap(), (f) => f.stats.tags === 1, 'ENZO');
    await m.locator('.cs-pausebtn').tap(); assert.equal((await st(m)).paused, true); await m.getByRole('button', { name: 'Back to the fight' }).tap(); await noScroll(m);
    keepAlive = false;
    ok(`phone ${tag}: the stick moves Dora, CUT, GUARD, DODGE and ENZO work, and the HUD fits`);
    await m.close();
  }
  for (const [tag, vp] of [['upright', { width: 390, height: 844 }], ['sideways', { width: 844, height: 390 }]]) { // the climb on a phone
    const m = await open(vp, true, seen); await m.goto(base + '/cloudsteel'); await ready(m); await noScroll(m);
    const sy = async () => (await st(m)).story;
    const waitS = async (fn, what, ms = 30000) => { const t0 = Date.now(); for (;;) { const s = await sy(); if (s && fn(s)) return s; if (Date.now() - t0 > ms) assert.fail(`phone ${tag}: timed out waiting for ${what}`); await m.waitForTimeout(40); } };
    const tapRead = () => readOn(m, () => m.locator('.cs-talk').tap(), `phone ${tag}: the talk`);
    const settle = () => waitS((s) => s.mode === 'walk' && s.t >= 3, 'Dora to stand free');
    const nearM = (l) => m.waitForFunction((x) => { const n = document.querySelector('.cs-near'); return n && n.dataset.on === '1' && n.textContent.includes(x); }, l, { timeout: 15000 });
    await m.getByRole('button', { name: 'Begin the climb' }).tap(); await m.getByRole('button', { name: /Start the climb/ }).tap();
    await waitS((s) => s.mode === 'talk', 'the opening talk'); const b0 = await m.locator('.cs-talk').boundingBox(); assert.ok(b0.x >= 0 && b0.x + b0.width <= vp.width + 1 && b0.y + b0.height <= vp.height + 1, 'the talk box fits');
    await tapRead(); await waitS((s) => s.mode === 'walk', 'tapping through the talk');
    for (const sel of ['.cs-stick', '.t-act', '.t-lantern', '.cs-area', '.cs-pausebtn']) { const b = await m.locator(sel).boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, `${sel} fits`); }
    await dbg(m, 'go', 0, 4, Math.PI); const a0 = await sy(), sb = await m.locator('.cs-stick').boundingBox(), cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
    const cdp = await m.context().newCDPSession(m), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', cx, cy); await touch('touchMove', cx, cy - 40); await waitS((s) => Math.hypot(s.x - a0.x, s.z - a0.z) > 0.4, 'the stick to walk'); await touch('touchEnd');
    await dbg(m, 'go', -4.2, 6.6, -1.9); await nearM('Talk to Qori'); await m.locator('.t-act').tap(); await waitS((s) => s.mode === 'talk', 'ACT to talk'); await tapRead();
    await waitS((s) => s.mode === 'walk', 'the talk to end'); await m.locator('.t-lantern').tap(); await waitS((s) => s.mode === 'lantern', 'LANTERN'); await waitS((s) => s.mode === 'walk', 'the lantern down');
    await dbg(m, 'win', 'atoq'); await dbg(m, 'go', 26.2, -8.4, Math.PI / 2); await nearM('Talk to'); await m.locator('.t-act').tap(); await tapRead(); await waitS((s) => s.choosing, 'the challenge');
    await m.getByRole('button', { name: 'Not now' }).tap(); await waitS((s) => s.mode === 'walk', 'Not now');
    await settle(); await m.locator('.t-act').tap(); await tapRead(); await waitS((s) => s.choosing, 'the challenge again'); await m.getByRole('button', { name: /Duel the Sword-Kin/ }).tap();
    await waitS((s) => s.mode === 'duel', 'the duel'); await m.locator('.t-cut').waitFor();
    await until(m, (f) => f.phase === 'fight' && f.foes.every((o) => o.state !== 'enter'), `phone ${tag}: the duel to start`);
    await tryPress(m, () => m.locator('.t-cut').tap(), (f) => f.state.startsWith('cut'), `phone ${tag}: CUT in a story duel`);
    for (const sel of ['.t-cut', '.t-guard', '.t-dodge', '.t-tag', '.cs-hero', '.cs-tagbox', '.cs-foe']) { const b = await m.locator(sel).boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width + 1 && b.y + b.height <= vp.height + 1, `${sel} fits in a story duel`); }
    await noScroll(m); ok(`phone ${tag}, the climb: taps read on, the stick walks, ACT talks, LANTERN lifts the lantern, the choice buttons answer, and the duel's buttons fit`);
    await m.close();
  }
  for (const [tag, vp, phone] of [['1280x800', { width: 1280, height: 800 }, false], ['844x390', { width: 844, height: 390 }, true], ['390x844', { width: 390, height: 844 }, true]]) {
    // the tag team and the quest arrow, by keys on the desktop and by taps on a phone
    const m = await open(vp, phone, seen); await m.goto(base + '/cloudsteel'); await ready(m);
    const hit = (loc) => phone ? loc.tap() : loc.click(), sy = async () => (await st(m)).story;
    const waitS = async (fn, what, ms = 30000) => { const t0 = Date.now(); for (;;) { const s = await sy(); if (s && fn(s)) return s; if (Date.now() - t0 > ms) assert.fail(`${tag}: timed out waiting for ${what}`); await m.waitForTimeout(40); } };
    const pause = () => phone ? m.locator('.cs-pausebtn').tap() : m.keyboard.press('Escape');
    // the Quest arrow setting: off, then the climb shows no label, chevron or pointer
    await hit(m.getByRole('button', { name: 'Settings' })); const row = m.locator('.cs-set', { hasText: 'Quest arrow' });
    await hit(row.getByRole('button', { name: 'Off' })); assert.equal((await st(m)).save.settings.quest, false); await hit(m.locator('.cs-back'));
    await hit(m.getByRole('button', { name: 'Begin the climb' })); await hit(m.getByRole('button', { name: /Start the climb/ }));
    await readOn(m, () => phone ? m.locator('.cs-talk').tap() : m.keyboard.press('KeyE'), `${tag}: the opening talk`); await waitS((s) => s.mode === 'walk' && s.t > 5, 'walking');
    await frames(m, 6); assert.equal(await m.locator('.cs-goal').getAttribute('data-on'), '0'); assert.equal((await sy()).questShown, false); assert.equal(await m.locator('.cs-goal-ptr').getAttribute('data-on'), '0');
    await pause(); await hit(m.getByRole('button', { name: 'Save and leave' }));
    await hit(m.getByRole('button', { name: 'Settings' })); await hit(row.getByRole('button', { name: 'On' })); assert.equal((await st(m)).save.settings.quest, true); await hit(m.locator('.cs-back'));
    await hit(m.getByRole('button', { name: 'Continue the climb' })); await waitS((s) => s.mode === 'walk', 'walking again');
    // on: the label names the next step; facing it, the chevron and the medallion are on the ground; turned away, the pointer sits on the screen's edge
    await dbg(m, 'go', 0, 4, Math.PI); await frames(m, 30);
    assert.equal(await m.locator('.cs-goal').getAttribute('data-on'), '1'); assert.match(await m.locator('.cs-goal').textContent(), /^Next: face Atoq/); assert.equal((await sy()).questShown, true);
    assert.ok((await sy()).goal.label.startsWith('Next:'));
    await dbg(m, 'go', 0, 4, 0); await m.waitForFunction(() => document.querySelector('.cs-goal-ptr')?.dataset.on === '1', null, { timeout: 15000 });
    const pb = await m.locator('.cs-goal-ptr').boundingBox(); assert.ok(pb && pb.x >= -30 && pb.y >= -30 && pb.x + pb.width <= vp.width + 30 && pb.y + pb.height <= vp.height + 30, 'the pointer sits on the edge');
    await dbg(m, 'go', 0, 4, Math.PI); await m.waitForFunction(() => document.querySelector('.cs-goal-ptr')?.dataset.on === '0', null, { timeout: 15000 });
    await noScroll(m); ok(`${tag}: the Quest arrow setting turns the label, the chevron and the edge pointer off and on`);
    await pause(); await hit(m.getByRole('button', { name: 'Save and leave' }));
    // the tag team in a duel
    await hit(m.getByRole('button', { name: 'Terrace duel' })); await until(m, (f) => f.phase === 'fight' && f.foes[0].state !== 'enter', `${tag}: the fight`); keepAlive = true; await dbg(m, 'calm');
    const press = (key, sel) => phone ? m.locator(sel).tap() : m.keyboard.press(key);
    await tryMe(m, () => press('KeyE', '.t-tag'), (f) => f.hero === 'enzo', `${tag}: swap to Enzo`);
    if (phone) { assert.equal(await m.locator('.t-cut').textContent(), 'SWEEP'); assert.equal(await m.locator('.t-guard').textContent(), 'WARD'); assert.equal(await m.locator('.t-dodge').textContent(), 'HOP'); }
    await tryMe(m, () => press('KeyJ', '.t-cut'), (f) => f.me === 'sweep', `${tag}: Enzo's sweep`); await until(m, (f) => f.me !== 'sweep', 'the sweep to end');
    if (phone) {
      const cdp = await m.context().newCDPSession(m), touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 2 }] });
      const gb = await m.locator('.t-guard').boundingBox(); await until(m, meFree, 'Enzo free'); await touch('touchStart', gb.x + gb.width / 2, gb.y + gb.height / 2); await until(m, (f) => f.me === 'ward', `${tag}: WARD`); await touch('touchEnd');
    } else { await until(m, meFree, 'Enzo free'); await m.keyboard.down('KeyK'); await until(m, (f) => f.me === 'ward', `${tag}: K to ward`); await m.keyboard.up('KeyK'); }
    await until(m, (f) => f.me !== 'ward' && f.wardCd === 0, 'the ward to rest');
    await tryMe(m, () => press('Space', '.t-dodge'), (f) => f.me === 'hop', `${tag}: Enzo's hop`); await until(m, (f) => f.me !== 'hop', 'the hop to end');
    await until(m, (f) => f.swapCd === 0, 'the rest'); await tryMe(m, () => press('KeyE', '.t-tag'), (f) => f.hero === 'dora', `${tag}: swap back to Dora`);
    if (phone) assert.equal(await m.locator('.t-cut').textContent(), 'CUT');
    await dbg(m, 'tag', 100); await until(m, (f) => f.swapCd === 0, 'the rest'); await tryMe(m, () => press('KeyE', '.t-tag'), (f) => f.stats.tags === 1 && f.hero === 'enzo', `${tag}: swap on a full meter`);
    await until(m, (f) => f.swapCd === 0 && meFree(f), 'Enzo landed'); await dbg(m, 'tag', 100); await tryMe(m, () => press('KeyE', '.t-tag'), (f) => f.stats.tags === 2 && f.hero === 'dora' && f.me === 'tagin', `${tag}: Dora in on a full meter`);
    keepAlive = false; await noScroll(m);
    ok(`${tag}: ${phone ? 'SWAP, SWEEP, WARD and HOP taps' : 'E, J, K and Space'} swap to Enzo, sweep, ward, hop, swap back, and come in with a strike on a full meter, both ways`);
    await m.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`cloudsteel e2e: all good (${pass} checks)`);
} finally { await browser.close(); }
