// Above & Below in the browser, with real keys and real touches, at 1280×800, a phone held upright (390×844) and a phone
// on its side (844×390). By keys: the title (Enter for one player, 2 for two, C to continue from the checkpoint), walking
// on the arrows and on WASD, Space to jump, down to duck, E and Enter to act (Dora's stamp, the sluice pull), Shift, Q
// and right Shift to swap, Enzo digging the plug, climbing the grown sapling with up, holding E to brace the root bridge
// and swapping away while holding (the hand-off), the key prompt after idling, M for sound, Esc to pause and Resume,
// Shift + R to restart the room, the HUD's 2P, assist and sound toggles, both players' keys in 2P (WASD + Space + E
// for Dora, arrows + / + . for Enzo), Old Grubber's nose stamp and the boop that ends the chapter, the end card and
// Play again, the save under above-and-below-v1. By touch: 1 Player, the stick (walk, duck, climb), the jump, act and
// swap buttons, holding act to brace, the pause chip. Fails on any page error or sideways scroll. Needs `npm run dev`
// (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const game = (page, expr) => page.evaluate((e) => { const o = window.__above(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr);
const until = async (page, expr, timeout = 10000) => {
  try { await page.waitForFunction((e) => { const o = window.__above(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr, { timeout, polling: 50 }); }
  catch (e) { throw new Error(`${e.message}\n  waiting for: ${expr}\n  state: ${await game(page, 'JSON.stringify({screen: o.screen, room: g.room.id, beat: g.beat, active: g.active, d: [g.heroes.dora.x|0, g.heroes.dora.y|0, g.heroes.dora.state], e: [g.heroes.enzo.x|0, g.heroes.enzo.y|0, g.heroes.enzo.state]})').catch(() => '?')}`); }
};
const hold = async (page, key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const noScroll = async (page, where) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `no sideways scroll (${where})`);
/** put a hero somewhere, standing and free */
const put = (page, id, x, y) => game(page, `(() => { const h = g.heroes.${id}; h.x = ${x}; h.y = ${y}; h.vx = h.vy = 0; h.ground = true; h.state = 'free'; h.act = null; h.brace = null; return 1; })()`);
async function open(vp, touch) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${vp.width}x${vp.height}: ${e.message}`));
  await page.addInitScript(() => { try { localStorage.removeItem('above-and-below-v1'); } catch { /* fresh */ } });
  await page.goto(`${base}/above-and-below`);
  await page.waitForSelector('main[data-ready="true"]', { timeout: 30000 });
  return { ctx, page };
}

// ───────────────────────────────────────────── keys at 1280×800
{
  const { ctx, page } = await open({ width: 1280, height: 800 }, false);
  ok(await page.getByRole('heading', { name: 'Above & Below' }).isVisible(), 'title');
  await noScroll(page, 'title'); await shot(page, 'desk-title');
  await page.keyboard.press('Enter');
  await until(page, 'o.screen === "play" && g.mode === "play" && !g.twoP && g.room.id === "meadow"');
  await wait(2800); await shot(page, 'desk-meadow');
  for (const [k, d] of [['ArrowRight', 1], ['KeyD', 1], ['ArrowLeft', -1], ['KeyA', -1]]) {
    const a = await game(page, 'g.heroes.dora.x'); await hold(page, k, 300); const b = await game(page, 'g.heroes.dora.x');
    ok((b - a) * d > 20, `${k} walks Dora (${a}→${b})`);
  }
  await page.keyboard.down('Space'); await until(page, '!g.heroes.dora.ground'); await page.keyboard.up('Space'); ok(true, 'Space jumps'); await wait(700);
  await page.keyboard.down('ArrowDown'); await until(page, 'g.heroFrame(g.heroes.dora) === "d_duck"'); await page.keyboard.up('ArrowDown'); ok(true, 'Down ducks');
  await page.keyboard.down('KeyS'); await until(page, 'g.heroes.dora.ducking'); await page.keyboard.up('KeyS'); ok(true, 'S ducks');
  await page.keyboard.press('KeyE'); await until(page, 'g.stats.stamps === 1'); ok(true, 'E stamps');
  await wait(300); await page.keyboard.press('Enter'); await until(page, 'g.stats.stamps === 2'); ok(true, 'Enter acts too');
  await put(page, 'dora', 480, 375); await wait(100);
  await page.keyboard.press('KeyE'); await until(page, 'g.o.sluice.open && g.cur().id === "ride"'); ok(true, 'E at the sluice pulls it open');
  await page.keyboard.press('ShiftLeft'); await until(page, 'g.active === "enzo"'); ok(true, 'Shift swaps to Enzo');
  await page.keyboard.press('KeyQ'); await until(page, 'g.active === "dora"'); ok(true, 'Q swaps back');
  await page.keyboard.press('ShiftRight'); await until(page, 'g.active === "enzo"'); ok(true, 'right Shift swaps');
  // Enzo digs the plug
  await game(page, '(g.beat = 2, g.water.level = 640, 1)'); await put(page, 'enzo', 640, 642); await game(page, 'g.heroes.enzo.face = 1');
  await page.keyboard.press('KeyE'); await until(page, 'g.stats.digs >= 1'); ok(true, 'E digs for Enzo');
  await shot(page, 'desk-dig');
  // Dora climbs the grown sapling
  await game(page, '(g.o.sapling.stage = 3, g.beat = 4, 1)'); await page.keyboard.press('ShiftLeft'); await until(page, 'g.active === "dora"');
  await put(page, 'dora', 812, 375); await page.keyboard.down('ArrowUp'); await until(page, 'g.heroes.dora.y <= 257 && g.heroes.dora.x > 835', 6000); await page.keyboard.up('ArrowUp'); ok(true, 'Up climbs the sapling');
  // idle: the key prompt in the player's keys
  await until(page, 'g.showKeys && !!g.prompt()', 12000); ok(true, 'key prompt after idling'); await shot(page, 'desk-prompt');
  await page.keyboard.press('KeyM'); await until(page, 'o.save.sound === false'); ok(true, 'M turns the sound off');
  await page.keyboard.press('KeyM'); await until(page, 'o.save.sound === true');
  await page.keyboard.press('Escape'); await until(page, 'o.paused'); ok(await page.getByRole('heading', { name: /Paused/ }).isVisible(), 'Esc pauses'); await shot(page, 'desk-pause');
  await page.getByRole('button', { name: 'Resume' }).click(); await until(page, '!o.paused'); ok(true, 'Resume');
  await page.keyboard.down('ShiftLeft'); await page.keyboard.press('KeyR'); await page.keyboard.up('ShiftLeft');
  await until(page, 'g.room.id === "meadow" && g.beat === 0 && !g.o.sluice.open'); ok(true, 'Shift + R restarts the room');
  // the HUD toggles
  await page.getByRole('button', { name: 'Assist' }).click(); await until(page, '!g.assist && o.save.assist === false'); ok(true, 'assist toggle');
  await page.getByRole('button', { name: 'Assist' }).click(); await until(page, 'g.assist');
  await page.getByRole('button', { name: 'Sound' }).click(); await until(page, 'o.save.sound === false'); ok(true, 'sound toggle');
  await page.getByRole('button', { name: 'Sound' }).click();
  // the orchard: hold E to brace the root bridge, swap away while holding (the hand-off)
  await game(page, '(o.start(false, 1), 1)'); await until(page, 'g.room.id === "orchard"'); await wait(2700); await shot(page, 'desk-orchard');
  await page.keyboard.press('ShiftLeft'); await until(page, 'g.active === "enzo"'); await put(page, 'enzo', 552, 650);
  await page.keyboard.down('KeyE'); await until(page, 'g.heroes.enzo.state === "brace" && g.o.lift > 0.9'); ok(true, 'holding E braces the bridge');
  await page.keyboard.press('ShiftLeft'); await wait(800);
  ok(await game(page, 'g.active === "dora" && g.heroes.enzo.state === "brace"'), 'swapping while holding leaves Enzo bracing');
  await shot(page, 'desk-handoff');
  await page.keyboard.up('KeyE');
  // two players on one keyboard
  await page.getByRole('button', { name: 'Two players' }).click(); await until(page, 'g.twoP'); ok(true, '2P toggle');
  await put(page, 'dora', 200, 366); await put(page, 'enzo', 200, 650);
  for (const [k, who] of [['KeyD', 'dora'], ['ArrowRight', 'enzo']]) {
    const a = await game(page, `g.heroes.${who}.x`); await hold(page, k, 300); ok((await game(page, `g.heroes.${who}.x`)) - a > 20, `2P ${k} walks ${who}`);
  }
  await page.keyboard.down('Space'); await until(page, '!g.heroes.dora.ground'); await page.keyboard.up('Space'); ok(true, '2P Space jumps Dora');
  await page.keyboard.down('Slash'); await until(page, '!g.heroes.enzo.ground'); await page.keyboard.up('Slash'); ok(true, '2P / jumps Enzo');
  await wait(800); await page.keyboard.press('Period'); await until(page, 'g.heroes.enzo.state === "act"'); ok(true, '2P . acts for Enzo');
  await wait(400); await page.keyboard.press('KeyE'); await until(page, 'g.heroes.dora.state === "act"'); ok(true, '2P E acts for Dora');
  // the stream bank and the den, for the screenshots and the end
  await game(page, '(o.start(true, 2), 1)'); await until(page, 'g.room.id === "stream"'); await wait(2700); await shot(page, 'desk-stream');
  await game(page, '(o.start(true, 3), 1)'); await until(page, 'g.room.id === "den" && g.o.gb.st === "prowl"'); await shot(page, 'desk-den');
  await game(page, '(g.o.gb.hp = 1, g.o.gb.st = "nose", g.o.gb.t = 0, g.o.gb.nx = 700, 1)'); await put(page, 'dora', 700, 372); await put(page, 'enzo', 300, 692);
  await page.keyboard.press('KeyE'); await until(page, 'g.o.gb.st === "fall" || g.o.gb.st === "dizzy"'); ok(true, 'E stamps Grubber’s nose');
  await until(page, 'g.o.gb.st === "dizzy"'); await game(page, 'g.heroes.enzo.x = g.o.gb.x - 170'); await page.keyboard.press('Period');
  await until(page, 'g.o.gb.st === "yawn"'); ok(true, 'Enzo boops him to sleep');
  await page.getByRole('heading', { name: 'Together!' }).waitFor({ timeout: 10000 }); ok(true, 'the end card'); await wait(1200); await shot(page, 'desk-win');
  ok(await game(page, 'o.save.ck === 0 && o.save.best != null'), 'the save keeps a best time and resets the checkpoint');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('above-and-below-v1')).v === 1), 'saved under above-and-below-v1');
  await page.getByRole('button', { name: 'Play again' }).click(); await until(page, 'g.mode === "play" && g.room.id === "meadow"'); ok(true, 'Play again');
  // a checkpoint: Continue from the title, and 2 for two players
  await game(page, '(o.start(false, 2), 1)'); await wait(200);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Title' }).click(); await until(page, 'o.screen === "title"');
  ok(await page.getByRole('button', { name: /Continue · The Stream Bank/ }).isVisible(), 'Continue shows the checkpoint room');
  await page.keyboard.press('KeyC'); await until(page, 'g.room.id === "stream" && g.mode === "play"'); ok(true, 'C continues');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Title' }).click(); await until(page, 'o.screen === "title"');
  await page.keyboard.press('Digit2'); await until(page, 'g.mode === "play" && g.twoP'); ok(true, '2 starts two players');
  await noScroll(page, 'play');
  await ctx.close();
}

// ───────────────────────────────────────────── touch on phones
async function touchRun(vp, tag) {
  const { ctx, page } = await open(vp, true);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const pad = (k) => game(page, `o.scene.L.pad.${k}`);
  const tapBtn = async (k, ms = 90) => { const b = await pad(k); await touch('touchStart', [[b.x, b.y]]); await wait(ms); await touch('touchEnd', []); };
  const drag = async (dx, dy, ms) => { const s = await pad('stick'); await touch('touchStart', [[s.x, s.y]]); await touch('touchMove', [[s.x + dx * 0.5, s.y + dy * 0.5]]); await touch('touchMove', [[s.x + dx, s.y + dy]]); await wait(ms); await touch('touchEnd', []); };
  await shot(page, `${tag}-title`); await noScroll(page, `${tag} title`);
  await page.getByRole('button', { name: '1 Player' }).tap(); await until(page, 'g.mode === "play"'); ok(true, `${tag}: 1 Player`);
  ok(await game(page, 'o.scene.L.touch && o.scene.L.mode === ' + JSON.stringify(vp.height > vp.width ? 'portrait' : 'land')), `${tag}: touch layout`);
  await wait(2800); await shot(page, `${tag}-meadow`);
  let a = await game(page, 'g.heroes.dora.x'); await drag(60, 0, 400); ok((await game(page, 'g.heroes.dora.x')) - a > 20, `${tag}: the stick walks right`);
  a = await game(page, 'g.heroes.dora.x'); await drag(-60, 0, 400); ok(a - (await game(page, 'g.heroes.dora.x')) > 20, `${tag}: the stick walks left`);
  { const s = await pad('stick'); await touch('touchStart', [[s.x, s.y]]); await touch('touchMove', [[s.x, s.y + 60]]); await until(page, 'g.heroes.dora.ducking'); await touch('touchEnd', []); ok(true, `${tag}: stick down ducks`); }
  await tapBtn('jump'); await until(page, '!g.heroes.dora.ground || g.heroes.dora.vy < 0'); ok(true, `${tag}: jump button`); await wait(800);
  await tapBtn('act'); await until(page, 'g.stats.stamps >= 1'); ok(true, `${tag}: act button stamps`);
  await put(page, 'dora', 480, 375); await wait(500); await tapBtn('act'); await until(page, 'g.o.sluice.open'); ok(true, `${tag}: act pulls the sluice`);
  await tapBtn('swap'); await until(page, 'g.active === "enzo"'); ok(true, `${tag}: swap button`);
  await tapBtn('swap'); await until(page, 'g.active === "dora"');
  await game(page, '(g.o.sapling.stage = 3, g.beat = 4, 1)'); await put(page, 'dora', 812, 375);
  { const s = await pad('stick'); await touch('touchStart', [[s.x, s.y]]); await touch('touchMove', [[s.x, s.y - 60]]); await until(page, 'g.heroes.dora.y <= 257', 6000); await touch('touchEnd', []); ok(true, `${tag}: stick up climbs`); }
  // hold act to brace, in the orchard
  await game(page, '(o.start(false, 1), 1)'); await until(page, 'g.room.id === "orchard"'); await wait(400);
  await tapBtn('swap'); await until(page, 'g.active === "enzo"'); await put(page, 'enzo', 552, 650);
  { const b = await pad('act'); await touch('touchStart', [[b.x, b.y]]); await until(page, 'g.heroes.enzo.state === "brace" && g.o.lift > 0.9'); await wait(2000); await shot(page, `${tag}-brace`); await touch('touchEnd', []); ok(true, `${tag}: hold act braces`); }
  for (const r of [2, 3]) { await game(page, `(o.start(false, ${r}), 1)`); await wait(3000); await shot(page, `${tag}-room${r}`); }
  await page.getByRole('button', { name: 'Pause' }).tap(); await until(page, 'o.paused'); ok(true, `${tag}: pause chip`); await shot(page, `${tag}-pause`);
  await page.getByRole('button', { name: 'Resume' }).tap(); await until(page, '!o.paused');
  await game(page, '(g.o.gb.hp = 0, g.o.gb.st = "yawn", g.o.gb.t = 0, 1)'); await page.getByRole('heading', { name: 'Together!' }).waitFor({ timeout: 10000 }); await wait(1200); await shot(page, `${tag}-win`);
  await noScroll(page, `${tag} play`);
  await ctx.close();
}
await touchRun({ width: 390, height: 844 }, 'tall');
await touchRun({ width: 844, height: 390 }, 'wide');

await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`above e2e: ${checks} checks passed`);
