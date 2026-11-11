// Brinelight in the browser, with real keys and real touches, at 1280×800, a phone held upright (390×844) and a phone
// on its side (844×390): the title, the intro panel, the tutorial; then in a quiet arena every action by key (walk,
// both depth directions, attack, jump, jump-attack, tag, a double-tap dash, a dash attack, the dash special for both
// heroes, the Festival double-team, pause and resume) and the same by touch (the stick, a double flick to dash, the
// three buttons, the special as flick-flick, JUMP, ATTACK); the special's one-time prompt in the player's own keys;
// the harbour map, a locked district, a stage card, the results card and the save under brinelight-v1. Fails on any
// page error or sideways scroll. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
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
const game = (page, expr) => page.evaluate((e) => { const o = window.__brinelight(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr);
const until = async (page, expr, timeout = 15000) => {
  try { await page.waitForFunction((e) => { const o = window.__brinelight(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr, { timeout, polling: 50 }); }
  catch (e) { throw new Error(`${e.message}\n  waiting for: ${expr}\n  hero: ${await game(page, 'g && JSON.stringify({st: g.hero().st, x: g.hero().x, h: g.hero().h, stats: g.stats})').catch(() => '?')}`); }
};
/** a quiet arena on the harbour front: no tutorial, no waves, the hero at x 300 facing right */
const arena = async (page, who = 'dora', foes = '') => {
  await game(page, 'o.start("1-2", 3)');
  await until(page, 'o.screen === "play" && g && g.stageId === "1-2"');
  await game(page, `(() => { g.tut.stage = 9; g.evI = 99; g.foes = []; g.items = []; g.props = []; ${who === 'enzo' ? 'g.doTag(true);' : ''} return 1; })()`);
  await wait(500);
  await game(page, `(() => { const p = g.hero(); p.x = 300; p.z = 80; p.face = 1; p.hp = 100; g.partner().hp = 100; g.tagCD = 0; g.fest = 0;
    for (const k in g.stats) if (typeof g.stats[k] === 'number') g.stats[k] = 0;
    ${foes}
    return 1; })()`);
};
const DAZED = 'const f = g.spawnFoe("crab", 1, { lane: 2 }); f.x = 370; f.z = 80; f.st = "idle"; f.cd = 99; f.hp = 60; f.daze = 30;';
const CRABS = 'for (let i = 0; i < 4; i++) { const f = g.spawnFoe("crab", 1, { lane: 2 }); f.x = 470 + i * 70; f.z = 80; f.st = "idle"; f.cd = 30; }';

// ─────────────────────────────── keys
const K = (page) => ({
  tap: async (key, ms = 60) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); },
  double: async (key) => { await page.keyboard.down(key); await wait(55); await page.keyboard.up(key); await wait(70); await page.keyboard.down(key); await wait(40); },
});
async function keyActions(page, tag) {
  const k = K(page);
  await arena(page);
  const x0 = await game(page, 'g.hero().x');
  await page.keyboard.down('ArrowRight'); await wait(400); await page.keyboard.up('ArrowRight');
  ok(await game(page, 'g.hero().x') > x0 + 60, `${tag}: → walks`);
  const z0 = await game(page, 'g.hero().z');
  await page.keyboard.down('ArrowUp'); await wait(250); await page.keyboard.up('ArrowUp');
  ok(await game(page, 'g.hero().z') < z0 - 15, `${tag}: ↑ steps back`);
  await page.keyboard.down('KeyS'); await wait(300); await page.keyboard.up('KeyS');
  ok(await game(page, 'g.hero().z') > z0, `${tag}: S steps forward`);
  await k.tap('KeyJ'); await until(page, 'g.hero().st === "atk"', 2000); ok(true, `${tag}: J attacks`);
  await wait(400);
  await k.tap('KeyK'); await until(page, 'g.hero().h > 20', 2000); ok(true, `${tag}: K jumps`);
  await wait(150); await k.tap('KeyJ'); await until(page, 'g.hero().st === "airatk"', 2000); ok(true, `${tag}: K then J is an air attack`);
  await until(page, 'g.hero().h <= 0 && g.hero().st !== "land"', 4000);
  // dash
  await k.double('ArrowRight'); await until(page, 'g.stats.dashes >= 1', 2000); await page.keyboard.up('ArrowRight');
  ok(true, `${tag}: →→ dashes`);
  await wait(400);
  await k.double('ArrowLeft'); await until(page, 'g.stats.dashes >= 2', 2000); await page.keyboard.up('ArrowLeft');
  ok(await game(page, 'g.hero().face') === -1, `${tag}: ←← dashes left`);
  await wait(400);
  // dash attack
  await game(page, 'g.hero().face = 1, 1');
  await k.double('KeyD'); await k.tap('KeyJ', 40); await page.keyboard.up('KeyD');
  await until(page, 'g.stats.dashAtks >= 1', 2000); ok(true, `${tag}: DD then J is a dash attack`);
  await wait(500);
  // tag
  await k.tap('KeyL'); await until(page, 'g.active === "enzo"', 2000); ok(true, `${tag}: L tags Enzo in`);
  await until(page, 'g.hero().st === "idle" || g.hero().st === "walk"', 4000);
  // Enzo's grab: mashing J beside a dazed crab keeps punching; walking into it picks it up; one J throws it
  await arena(page, 'enzo', DAZED);
  for (let i = 0; i < 10; i++) { await game(page, '(g.foes[0].daze = 30, g.foes[0].hp = 60, g.foes[0].x = Math.min(g.foes[0].x, g.hero().x + 80), 1)'); await k.tap('KeyJ', 40); await wait(80); }
  ok(await game(page, '!g.hero().hold && g.stats.grabs === 0 && g.stats.hits >= 3'), `${tag}: mashing J beside a dazed crab punches it (${await game(page, 'g.stats.hits')} hits, no grab)`);
  await wait(500); await game(page, '(g.foes[0].daze = 30, g.foes[0].x = g.hero().x + 110, g.foes[0].z = g.hero().z, g.hero().face = 1, 1)');
  await page.keyboard.down('ArrowRight'); await until(page, '!!g.hero().hold', 2500); await page.keyboard.up('ArrowRight');
  ok(true, `${tag}: walking into a dazed crab grabs it`);
  await wait(300); await k.tap('KeyJ'); await until(page, '!g.hero().hold && g.stats.throws >= 1', 2000); ok(true, `${tag}: one J throws it`);
  // the special, both heroes, through a line of crabs; the prompt shows in the player's own keys first
  for (const who of ['dora', 'enzo']) {
    await arena(page, who, CRABS);
    await until(page, 'g.prompt && g.prompt.act === "special"', 3000);
    const lab = await game(page, 'o.labels');
    ok(lab.right && lab.jmp === 'K' && lab.atk === 'J', `${tag}: the special prompt reads ${lab.right}${lab.right} then ${lab.jmp} then ${lab.atk}`);
    await shot(page, `${tag}-special-prompt-${who}`);
    await k.double('ArrowRight'); await wait(30); await k.tap('KeyK', 50); await wait(110); await k.tap('KeyJ', 40); await page.keyboard.up('ArrowRight');
    await until(page, 'g.stats.specials >= 1', 2500);
    await shot(page, `${tag}-special-${who}`);
    await until(page, 'g.stats.specialLanded >= 1', 4000);
    ok(await game(page, 'g.stats.specialHits') >= 2, `${tag}: ${who}'s special lands on the line (${await game(page, 'g.stats.specialHits')} hit)`);
  }
  // the double-team
  await arena(page, 'dora', CRABS);
  await game(page, 'g.fest = 100, 1');
  await page.keyboard.down('KeyJ'); await page.keyboard.down('KeyK'); await wait(60); await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyK');
  await until(page, 'g.stats.dbls >= 1', 2000); ok(true, `${tag}: J + K together is the double-team`);
  await wait(800);
  ok(await game(page, 'g.foes.filter((f) => f.hp < f.max || f.dead).length') >= 2, `${tag}: the double-team hits the crabs`);
  // pause
  await page.keyboard.press('Escape'); await page.locator('.bl-overlay').waitFor(); ok(true, `${tag}: Esc pauses`);
  await shot(page, `${tag}-pause`);
  const t0 = await game(page, 'g.t'); await wait(300); ok(await game(page, 'g.t') === t0, `${tag}: the game stops while paused`);
  await page.locator('.bl-overlay button', { hasText: 'Resume' }).click(); await until(page, '!o.paused'); ok(true, `${tag}: Resume`);
}

// ─────────────────────────────── touches (CDP touch events, so the page sees real touch pointers)
async function touchActions(page, tag) {
  const cdp = await page.context().newCDPSession(page);
  // each point is [x, y] or [x, y, id]; a finger missing from a later touchMove has been lifted
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], i) => ({ x, y, id: id ?? i })) });
  const tl = () => game(page, '(() => { const t = o.scene.tl; return { s: t.stick, a: t.atk, j: t.jmp, t: t.tag }; })()');
  const press = async (b, ms = 70) => { await touch('touchStart', [[b.x, b.y]]); await wait(ms); await touch('touchEnd', []); };
  const flick = async (s, dx, ms = 60) => { await touch('touchStart', [[s.x, s.y]]); await touch('touchMove', [[s.x + dx * s.r * 0.9, s.y]]); await wait(ms); await touch('touchEnd', []); };
  await arena(page);
  let T = await tl();
  // the stick
  const x0 = await game(page, 'g.hero().x');
  await touch('touchStart', [[T.s.x, T.s.y]]); await touch('touchMove', [[T.s.x + T.s.r * 0.9, T.s.y]]); await wait(400);
  ok(await game(page, 'o.mode') === 'touch', `${tag}: a touch switches to touch controls`);
  await touch('touchEnd', []);
  T = await tl();
  ok(await game(page, 'g.hero().x') > x0 + 60, `${tag}: the stick walks`);
  await touch('touchStart', [[T.s.x, T.s.y]]); await touch('touchMove', [[T.s.x, T.s.y - T.s.r * 0.9]]); const z0 = await game(page, 'g.hero().z'); await wait(250); await touch('touchEnd', []);
  ok(await game(page, 'g.hero().z') < z0 - 10, `${tag}: the stick steps back`);
  await press(T.a); await until(page, 'g.hero().st === "atk"', 2000); ok(true, `${tag}: ATTACK`);
  await wait(400);
  await press(T.j); await until(page, 'g.hero().h > 20', 2000); ok(true, `${tag}: JUMP`);
  await until(page, 'g.hero().h <= 0', 3000); await wait(200);
  // a double flick dashes
  await flick(T.s, 1); await wait(70); await flick(T.s, 1, 120);
  await until(page, 'g.stats.dashes >= 1', 2000); ok(true, `${tag}: a double flick of the stick dashes`);
  await wait(400);
  await press(T.t); await until(page, 'g.active === "enzo"', 2000); ok(true, `${tag}: TAG`);
  await wait(600);
  // the grab by touch: push the stick into a dazed crab, then ATTACK throws
  await arena(page, 'enzo', DAZED); T = await tl();
  await game(page, '(g.foes[0].x = g.hero().x + 110, g.foes[0].z = g.hero().z, g.hero().face = 1, 1)');
  await touch('touchStart', [[T.s.x, T.s.y, 0]]); await touch('touchMove', [[T.s.x + T.s.r * 0.9, T.s.y, 0]]);
  await until(page, '!!g.hero().hold', 2500); await touch('touchEnd', []); ok(true, `${tag}: pushing the stick into a dazed crab grabs it`);
  await wait(300); await press(T.a); await until(page, '!g.hero().hold && g.stats.throws >= 1', 2000); ok(true, `${tag}: ATTACK throws it`);
  await wait(300);
  // the special by touch: flick, flick (held), JUMP, ATTACK
  await arena(page, 'dora', CRABS);
  T = await tl();
  await until(page, 'g.prompt && g.prompt.act === "special"', 3000);
  ok(/flick/.test(await game(page, '(() => { const L = o.labels; return L.mode === "touch" ? "flick" : ""; })()')), `${tag}: the special prompt is in touch terms`);
  const touchSpecial = async () => {
    await flick(T.s, 1); await wait(70);
    await touch('touchStart', [[T.s.x, T.s.y]]); await touch('touchMove', [[T.s.x + T.s.r * 0.9, T.s.y]]); await wait(40);
    await touch('touchStart', [[T.s.x + T.s.r * 0.9, T.s.y, 0], [T.j.x, T.j.y, 1]]); await wait(50);
    await touch('touchMove', [[T.s.x + T.s.r * 0.9, T.s.y, 0]]); await wait(110);
    await touch('touchStart', [[T.s.x + T.s.r * 0.9, T.s.y, 0], [T.a.x, T.a.y, 2]]); await wait(40);
    await touch('touchEnd', []);
  };
  await touchSpecial();
  await until(page, 'g.stats.specials >= 1', 2500); ok(true, `${tag}: flick-flick, JUMP, ATTACK is the special`);
  // a slow frame on a loaded machine can let the line drift out of the lane; one retry with a fresh line, then it must land
  try { await until(page, 'g.stats.specialLanded >= 1', 4000); }
  catch { console.log(`  ${tag}: touch special missed once, retrying with a fresh line`); await arena(page, 'dora', CRABS); T = await tl(); await wait(300); await touchSpecial(); await until(page, 'g.stats.specialLanded >= 1', 4000); }
  await shot(page, `${tag}-touch-special`);
  // the double-team: both buttons at once
  await arena(page, 'dora', CRABS); T = await tl();
  await game(page, 'g.fest = 100, 1');
  await touch('touchStart', [[T.a.x, T.a.y], [T.j.x, T.j.y]]); await wait(60); await touch('touchEnd', []);
  await until(page, 'g.stats.dbls >= 1', 2000); ok(true, `${tag}: ATTACK + JUMP together is the double-team`);
  await page.locator('.bl-pause-btn').tap(); await page.locator('.bl-overlay').waitFor(); ok(true, `${tag}: the pause button`);
  await page.locator('.bl-overlay button', { hasText: 'Resume' }).tap(); await until(page, '!o.paused');
}

const sizes = [[1280, 800, false, 'desk'], [390, 844, true, 'portrait'], [844, 390, true, 'landscape']];
for (const [width, height, mobile, tag] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(`${tag}: ${e.message}`); });
  page.setDefaultTimeout(30000);
  await page.goto(`${base}/brinelight`);
  await page.evaluate(() => localStorage.removeItem('brinelight-v1'));
  await page.reload();
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
  await shot(page, `${tag}-title`);
  // the title, the intro panel, the tutorial
  await page.locator('.bl-title button', { hasText: 'Play' }).click();
  await page.locator('.bl-panel').waitFor(); ok(true, `${tag}: Play shows the intro panel`);
  await shot(page, `${tag}-panel`);
  await page.locator('.bl-panel button', { hasText: 'Go' }).click();
  await until(page, 'o.screen === "play" && g.stageId === "1-1"'); ok(true, `${tag}: Go starts 1-1`);
  ok(await game(page, 'g.assist') === true, `${tag}: assist is on by default`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no sideways scroll`);
  await wait(1200); await shot(page, `${tag}-play`);
  if (tag === 'portrait') {
    const L = await game(page, '({ pb: o.scene.playBottom, panel: o.scene.tl.panel, H: innerHeight, stick: o.scene.tl.stick.y, rs: [o.scene.tl.atk.r, o.scene.tl.jmp.r, o.scene.tl.tag.r] })');
    ok(L.pb > L.H * 0.66 && L.pb < L.H * 0.8 && L.stick > L.pb, `${tag}: the play view takes about three quarters of the screen, the controls sit in a panel under it (${L.pb} of ${L.H})`);
    ok(L.rs.every((r) => r * 2 >= 56), `${tag}: every button is at least 56 px across (${L.rs.map((r) => Math.round(r * 2))})`);
  }
  await keyActions(page, tag);
  await touchActions(page, tag);
  // the map, a locked district, a stage card; clear a stage and see the card and the save
  await game(page, 'o.start("1-1", 4)'); await until(page, 'g && g.stageId === "1-1"');
  await game(page, '(() => { g.tut.stage = 9; g.mode = "clear"; g.clearT = 3; g.stats.score = 2400; g.stats.time = 70; return 1; })()');
  await page.locator('.bl-results').waitFor(); ok(true, `${tag}: the results card`);
  await shot(page, `${tag}-results`);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('brinelight-v1')));
  ok(save && save.v === 1 && save.cleared['1-1'], `${tag}: the clear is saved under brinelight-v1`);
  await page.locator('.bl-results button', { hasText: 'Map' }).click();
  await page.locator('.bl-map').waitFor(); ok(true, `${tag}: the harbour map`);
  await page.locator('.bl-spot').nth(3).click();
  ok(await page.locator('.bl-area').textContent().then((t) => /Not built yet/.test(t)), `${tag}: area 4 is listed but locked`);
  await page.locator('.bl-spot').nth(0).click();
  ok(await page.locator('.bl-stage').count() === 3, `${tag}: three stages in Lantern Quay`);
  ok(await page.locator('.bl-stage').nth(1).isEnabled(), `${tag}: 1-2 opens after 1-1`);
  ok(!(await page.locator('.bl-stage').nth(2).isEnabled()), `${tag}: 1-3 stays locked`);
  await shot(page, `${tag}-map`);
  await page.locator('.bl-stage').nth(1).click();
  await until(page, 'o.screen === "play" && g.stageId === "1-2"'); ok(true, `${tag}: a stage card starts its stage`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no sideways scroll in play`);
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`Brinelight e2e: ${checks} checks passed at 1280×800, 390×844 and 844×390.`);
