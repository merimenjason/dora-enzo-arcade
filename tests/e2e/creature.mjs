// Every Creature in the browser, with real keys, real touches and a stand-in gamepad, at 1280×800, a phone held upright
// (390×844) and a phone on its side (844×390). By keys: the title (Play by click, Space, Enter, N), walking both ways
// with arrows and WASD, jumping, every form by number (0–6) and E/Q, swapping (Shift, Tab), the call (C), mute (M),
// two players (P; D moves Dora only and ← Enzo only), climbing the vine (↑), the otter's dive (↓ and S), holding Space
// to shell up and to dig, a bird's flaps, hopping off a carrier, clicking Assist, a form icon and the partner's
// portrait, the checkpoint's Continue on the title, and Play again on the end card (R). By gamepad: the stick, A, B, X
// and Y. By touch, at both phone sizes: Play, the stick both ways and up a vine, the action button (tap to jump, hold
// to dig), the form and swap buttons, a form icon, the partner's portrait, the 2P and Assist chips, and that neither
// hero starts under a button. Fails on any page error or sideways scroll. Needs `npm run dev` (or BASE_URL) and
// Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const ALL = '{ tort: true, frog: true, bird: true, beetle: true, fox: true, otter: true }';
/** evaluate with o = window.__creature(), G = the game, a/b = active hero and partner */
const q = (page, expr) => page.evaluate((e) => { const o = window.__creature(), G = o.G, a = G.heroes[G.act], b = G.heroes[1 - G.act]; return new Function('o', 'G', 'a', 'b', `return (${e})`)(o, G, a, b); }, expr);
const run = (page, body) => page.evaluate((e) => { const o = window.__creature(), G = o.G, a = G.heroes[G.act], b = G.heroes[1 - G.act]; new Function('o', 'G', 'a', 'b', e)(o, G, a, b); }, body);
const until = async (page, expr, timeout = 10000) => {
  try { await page.waitForFunction((e) => { const o = window.__creature(), G = o.G, a = G.heroes[G.act], b = G.heroes[1 - G.act]; return new Function('o', 'G', 'a', 'b', `return (${e})`)(o, G, a, b); }, expr, { timeout, polling: 50 }); }
  catch (e) { throw new Error(`${e.message}\n  waiting for: ${expr}\n  state: ${await q(page, 'JSON.stringify(o.snap)').catch(() => '?')}`); }
};
const PLACE = (x, y, form) => `a.form = '${form}'; a.x = ${x}; a.y = ${y}; a.vx = a.vy = 0; a.ground = true; a.swim = false; a.dive = false; a.surf = 'bank'; a.climb = null; a.lastSafe = { x: ${x}, y: ${y} }; a.hurt = 0; a.knock = 0;`;
const CALM = 'b.x = 120; b.y = G.heroes[0].y; b.ride = null; a.rider = null; b.rider = null; a.ride = null; b.arriveT = 0;';

async function open(w, h, touch) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(`${base}/every-creature`);
  await page.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => { try { localStorage.removeItem('every-creature-cp1'); } catch { /* fresh */ } });
  await wait(300);
  return page;
}
/** a screen with every friend, in play, the active hero placed */
async function arena(page, si, place) {
  await run(page, `const G2 = o.G; Object.assign(G2.friends, ${ALL}); G2.mode = 'trans'; G2.transT = 0; G2.nextSi = ${si};`);
  await until(page, `G.mode === 'play' && G.si === ${si}`);
  await run(page, `Object.assign(G.friends, ${ALL}); G.demo = null; G.demoCool = 999; ${place}`);
  await wait(250);
}
async function hold(page, key, ms) { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); await wait(80); }
async function noSideScroll(page, tag) { ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: no sideways scroll`); }

// ─────────────────────────────── desktop: keys, mouse, gamepad
{
  const p = await open(1280, 800, false), tag = '1280x800';
  await shot(p, `${tag}-title`);
  const B = await q(p, 'o.scene.UI.btns[0]'); ok(B && B.id === 'new', 'title shows Play');
  await p.mouse.click(B.x + B.w / 2, B.y + B.h / 2); await until(p, 'G.mode === "play"'); ok(true, 'click Play starts');
  await arena(p, 0, `${PLACE(300, 816, 'chin')} ${CALM}`);
  for (const [k, sgn] of [['ArrowRight', 1], ['ArrowLeft', -1], ['KeyD', 1], ['KeyA', -1]]) { const x0 = await q(p, 'a.x'); await hold(p, k, 350); const x1 = await q(p, 'a.x'); ok(Math.sign(x1 - x0) === sgn && Math.abs(x1 - x0) > 20, `key ${k} moves (${(x1 - x0) | 0})`); }
  await p.keyboard.press('Space'); await wait(100); ok(!(await q(p, 'a.ground')), 'Space jumps'); await wait(900);
  for (const [k, f] of [['Digit1', 'tort'], ['Digit2', 'frog'], ['Digit3', 'bird'], ['Digit4', 'beetle'], ['Digit5', 'fox'], ['Digit6', 'otter'], ['Digit0', 'chin']]) { await p.keyboard.press(k); await wait(200); ok(await q(p, `a.form === '${f}'`), `key ${k} → ${f}`); }
  await p.keyboard.press('KeyE'); await wait(200); ok(await q(p, 'a.form === "tort"'), 'E cycles forward'); await p.keyboard.press('KeyQ'); await wait(200); ok(await q(p, 'a.form === "chin"'), 'Q cycles back');
  for (const k of ['ShiftLeft', 'Tab']) { const act = await q(p, 'G.act'); await p.keyboard.press(k); await wait(200); ok((await q(p, 'G.act')) !== act, `${k} swaps hero`); }
  { await run(p, 'b.x = 1000;'); const c0 = await q(p, 'G.stats.calls'); await p.keyboard.press('KeyC'); await wait(250); ok((await q(p, 'G.stats.calls')) > c0, 'C calls the partner'); await wait(1000); }
  { const m0 = await q(p, 'o.sound.muted'); await p.keyboard.press('KeyM'); await wait(100); ok((await q(p, 'o.sound.muted')) !== m0, 'M toggles mute'); await p.keyboard.press('KeyM'); }
  { await p.keyboard.press('KeyP'); await wait(150); ok(await q(p, 'G.two'), 'P turns on two players');
    await run(p, 'const d = G.heroes[0], e = G.heroes[1]; for (const [h, x] of [[d, 300], [e, 600]]) { h.form = "chin"; h.x = x; h.y = 816; h.ground = true; h.vx = 0; h.ride = h.rider = null; h.arriveT = 0; }'); await wait(150);
    const d0 = await q(p, '[G.heroes[0].x, G.heroes[1].x]'); await hold(p, 'KeyD', 350); const d1 = await q(p, '[G.heroes[0].x, G.heroes[1].x]');
    ok(d1[0] > d0[0] + 20 && Math.abs(d1[1] - d0[1]) < 5, '2P: D moves Dora only');
    const e0 = await q(p, '[G.heroes[0].x, G.heroes[1].x]'); await hold(p, 'ArrowLeft', 350); const e1 = await q(p, '[G.heroes[0].x, G.heroes[1].x]');
    ok(e1[1] < e0[1] - 20 && Math.abs(e1[0] - e0[0]) < 5, '2P: ← moves Enzo only');
    await shot(p, `${tag}-2p`); await p.keyboard.press('KeyP'); await wait(150); ok(!(await q(p, 'G.two')), 'P back to solo'); }
  // ↑ climbs the vine as a chinchilla
  await run(p, `G.S.ramp = 1; G.S.vine = 1; ${PLACE(1590, 657, 'chin')} ${CALM}`); await wait(150);
  await hold(p, 'ArrowUp', 400); ok(await q(p, 'a.climb === "vine" || a.y < 640'), '↑ climbs the vine'); await hold(p, 'ArrowDown', 900);
  // a bird flaps with Space; a frog riding a tortoise hops off with Space
  await run(p, `${PLACE(400, 816, 'bird')} ${CALM}`); await wait(100); await p.keyboard.press('Space'); await wait(60); await p.keyboard.press('Space'); await wait(60);
  ok(await q(p, 'a.flaps >= 2 || a.y < 700'), 'Space flaps a bird'); await wait(1500);
  await run(p, `${PLACE(300, 816, 'frog')} b.form = 'tort'; b.x = 300; b.y = 816; b.ground = true; b.ride = null; b.arriveT = 0; b.rider = a; a.ride = b;`); await wait(200);
  ok(await q(p, 'a.ride === b'), 'frog on the tortoise'); await p.keyboard.press('Space'); await wait(150); ok(await q(p, '!a.ride'), 'Space hops off the carrier'); await wait(800);
  // the tortoise shells up while Space is held
  await run(p, `${PLACE(300, 816, 'tort')} ${CALM}`); await wait(100); await p.keyboard.down('Space'); await wait(250); ok(await q(p, 'a.shell'), 'holding Space shells the tortoise'); await p.keyboard.up('Space'); await wait(100); ok(await q(p, '!a.shell'), 'letting go comes out');
  // mouse: Assist chip, a form icon, the partner's portrait
  { const o = (await q(p, 'o.scene.UI.optHit')).find((x) => x.id === 'assist'); const a0 = await q(p, 'G.assist'); await p.mouse.click(o.x + o.w / 2, o.y + o.h / 2); await wait(120); ok((await q(p, 'G.assist')) !== a0, 'click Assist toggles'); await p.mouse.click(o.x + o.w / 2, o.y + o.h / 2); await wait(120); ok(await q(p, 'G.assist'), 'Assist back on'); }
  { await run(p, `${PLACE(300, 816, 'chin')} ${CALM}`); await wait(200); const r = await q(p, '({ row: o.scene.UI.rowHit, ic: o.scene.UI.ic })'); const t = r.row.find((x) => x.f === 'tort'); await p.mouse.click(t.x, t.y + r.ic / 2); await wait(200); ok(await q(p, 'a.form === "tort"'), 'click a form icon'); }
  { await run(p, 'b.x = 900; b.y = 816;'); await wait(100); const ph = await q(p, 'o.scene.UI.portHit[0]'); const c0 = await q(p, 'G.stats.calls'); await p.mouse.click(ph.x, ph.y); await wait(250); ok((await q(p, 'G.stats.calls')) > c0, 'click the partner’s portrait calls'); await wait(900); }
  await shot(p, `${tag}-lake`);
  // Fox Hollow: hold Space to dig as a fox
  await arena(p, 1, `${PLACE(1095, 800, 'fox')} ${CALM} G.S.hawk.cool = 99;`);
  await p.keyboard.down('Space'); await wait(800); ok(await q(p, 'G.S.dig > .3 && a.digging'), 'holding Space digs as a fox'); await shot(p, `${tag}-dig`); await p.keyboard.up('Space');
  // Otter River: ↓ and S dive the otter
  await arena(p, 2, `${PLACE(600, 876, 'otter')} a.swim = true; ${CALM}`);
  await p.keyboard.down('ArrowDown'); await wait(300); ok(await q(p, 'a.dive'), '↓ dives the otter'); await p.keyboard.up('ArrowDown'); await wait(700);
  await p.keyboard.down('KeyS'); await wait(300); ok(await q(p, 'a.dive'), 'S dives the otter'); await shot(p, `${tag}-dive`); await p.keyboard.up('KeyS'); await wait(400);
  // the checkpoint: Otter River was reached, so the title offers Continue
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('every-creature-cp1')).si === 2), 'checkpoint saved at Otter River');
  // a stand-in gamepad: stick right, A jumps, Y swaps, X changes form, B calls
  await arena(p, 0, `${PLACE(300, 816, 'chin')} ${CALM}`);
  await p.evaluate(() => { const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) }; window.__pad = pad; navigator.getGamepads = () => [pad]; });
  const press = async (i, ms = 120) => { await p.evaluate((i) => { window.__pad.buttons[i] = { pressed: true }; }, i); await wait(ms); await p.evaluate((i) => { window.__pad.buttons[i] = { pressed: false }; }, i); await wait(120); };
  { const x0 = await q(p, 'a.x'); await p.evaluate(() => { window.__pad.axes = [1, 0]; }); await wait(350); await p.evaluate(() => { window.__pad.axes = [0, 0]; }); await wait(80); ok((await q(p, 'a.x')) > x0 + 20, 'gamepad stick moves'); }
  await press(0, 60); ok(!(await q(p, 'a.ground')) || (await q(p, 'a.vy')) !== 0, 'gamepad A jumps'); await wait(900);
  { const act = await q(p, 'G.act'); await press(3); ok((await q(p, 'G.act')) !== act, 'gamepad Y swaps'); }
  { const f = await q(p, 'a.form'); await press(2); ok((await q(p, 'a.form')) !== f, 'gamepad X changes form'); }
  { await run(p, 'b.x = 900;'); const c0 = await q(p, 'G.stats.calls'); await press(1); ok((await q(p, 'G.stats.calls')) > c0, 'gamepad B calls'); }
  // the end card: R plays again
  await run(p, 'G.mode = "end"; G.endT = 2; G.endFull = true;'); await wait(300); await shot(p, `${tag}-end`);
  await p.keyboard.press('KeyR'); await wait(300); ok((await q(p, 'G.mode')) !== 'end', 'R plays again from the end card');
  await noSideScroll(p, tag); ok(!p.errs.length, `${tag}: no page errors ${p.errs.slice(0, 2).join(' | ')}`); await p.close();
}
// the title by key, and Continue from a checkpoint
for (const k of ['Space', 'Enter', 'KeyN']) { const p = await open(1280, 800, false); await p.keyboard.press(k); await wait(250); ok((await q(p, 'G.mode')) !== 'title', `title: ${k} starts`); await p.close(); }
{
  const p = await open(1280, 800, false);
  await p.evaluate(() => localStorage.setItem('every-creature-cp1', JSON.stringify({ si: 1, friends: { tort: true, frog: true, bird: true, beetle: true }, total: 120 })));
  await wait(300); const btns = await q(p, 'o.scene.UI.btns'); const c = btns.find((b) => b.id === 'cont'); ok(c, 'title offers Continue'); await shot(p, '1280x800-continue');
  await p.mouse.click(c.x + c.w / 2, c.y + c.h / 2); await until(p, 'G.mode === "play"'); ok(await q(p, 'G.si === 1 && G.friends.beetle && !G.friends.fox'), 'Continue resumes at Fox Hollow with the friends made');
  await p.close();
}

// ─────────────────────────────── touch, both phone orientations
for (const [w, h] of [[390, 844], [844, 390]]) {
  const p = await open(w, h, true), tag = `${w}x${h}`, cdp = await p.context().newCDPSession(p);
  await shot(p, `${tag}-title`);
  const B = await q(p, 'o.scene.UI.btns[0]'); await p.touchscreen.tap(B.x + B.w / 2, B.y + B.h / 2); await until(p, 'G.mode === "play"'); ok(true, `${tag}: tap Play`);
  await arena(p, 0, `${PLACE(300, 816, 'chin')} ${CALM}`);
  const U = await q(p, '({ act: o.scene.UI.act, swap: o.scene.UI.swap, form: o.scene.UI.form, stick: o.scene.UI.stick, ic: o.scene.UI.ic })');
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const drag = async (dx, dy, ms) => { const s = U.stick; await touch('touchStart', s.x, s.y); await touch('touchMove', s.x + dx * s.r * .8, s.y + dy * s.r * .8); await wait(ms); await touch('touchEnd'); await wait(80); };
  { const x0 = await q(p, 'a.x'); await drag(1, 0, 400); ok((await q(p, 'a.x')) > x0 + 20, `${tag}: stick right moves`); }
  { const x0 = await q(p, 'a.x'); await drag(-1, 0, 400); ok((await q(p, 'a.x')) < x0 - 20, `${tag}: stick left moves`); }
  await p.touchscreen.tap(U.act.x, U.act.y); await wait(100); ok(!(await q(p, 'a.ground')), `${tag}: tap action jumps`); await wait(900);
  { const f = await q(p, 'a.form'); await p.touchscreen.tap(U.form.x, U.form.y); await wait(200); ok((await q(p, 'a.form')) !== f, `${tag}: form button cycles`); }
  { const act = await q(p, 'G.act'); await p.touchscreen.tap(U.swap.x, U.swap.y); await wait(200); ok((await q(p, 'G.act')) !== act, `${tag}: swap button`); }
  { await run(p, `${PLACE(300, 816, 'chin')} ${CALM}`); await wait(150); const r = await q(p, 'o.scene.UI.rowHit'); const t = r.find((x) => x.f === 'beetle'); await p.touchscreen.tap(t.x, t.y + U.ic / 2); await wait(200); ok(await q(p, 'a.form === "beetle"'), `${tag}: tap a form icon`); }
  { await run(p, `${PLACE(320, 816, 'chin')} b.x = 900; b.y = 816; b.ride = null; b.rider = null; b.arriveT = 0;`); await wait(150); const ph = await q(p, 'o.scene.UI.portHit[0]'); const c0 = await q(p, 'G.stats.calls'); await p.touchscreen.tap(ph.x, ph.y); await wait(250); ok((await q(p, 'G.stats.calls')) > c0, `${tag}: tap the partner’s portrait calls`); await wait(900); }
  { const o = (await q(p, 'o.scene.UI.optHit')).find((x) => x.id === 'two'); await p.touchscreen.tap(o.x + o.w / 2, o.y + o.h / 2); await wait(150); ok(await q(p, 'G.two'), `${tag}: tap 2P`); await p.touchscreen.tap(o.x + o.w / 2, o.y + o.h / 2); await wait(150); ok(!(await q(p, 'G.two')), `${tag}: tap 2P off`); }
  { const o = (await q(p, 'o.scene.UI.optHit')).find((x) => x.id === 'assist'); await p.touchscreen.tap(o.x + o.w / 2, o.y + o.h / 2); await wait(150); ok(!(await q(p, 'G.assist')), `${tag}: tap Assist off`); await p.touchscreen.tap(o.x + o.w / 2, o.y + o.h / 2); await wait(150); ok(await q(p, 'G.assist'), `${tag}: tap Assist on`); }
  // stick up climbs the vine
  await run(p, `G.S.ramp = 1; G.S.vine = 1; ${PLACE(1590, 657, 'chin')} ${CALM}`); await wait(200);
  await drag(0, -1, 450); ok(await q(p, 'a.climb === "vine" || a.y < 640'), `${tag}: stick up climbs the vine`); await shot(p, `${tag}-vine`);
  // holding the action button digs as a fox
  await arena(p, 1, `${PLACE(1095, 800, 'fox')} ${CALM} G.S.hawk.cool = 99;`);
  await touch('touchStart', U.act.x, U.act.y); await wait(700); ok(await q(p, 'G.S.dig > .3'), `${tag}: hold the action button to dig`); await shot(p, `${tag}-dig`); await touch('touchEnd'); await wait(100);
  // nobody starts under a button
  await arena(p, 0, '');
  const cover = await q(p, '(() => { const r = [], sc = o.scene; for (const h of G.heroes) { const s = sc.toScreen(h.x, h.y - 40); for (const k of ["act", "swap", "form", "stick"]) { const B = sc.UI[k]; if (Math.hypot(s.x - B.x, s.y - B.y) < B.r) r.push(h.name + " under " + k); } } return r.join(", "); })()');
  ok(!cover, `${tag}: heroes not under buttons at the start (${cover})`);
  await shot(p, `${tag}-lake`);
  await noSideScroll(p, tag); ok(!p.errs.length, `${tag}: no page errors ${p.errs.slice(0, 2).join(' | ')}`); await p.close();
}

await browser.close();
console.log(`creature e2e: ${checks} checks passed`);
