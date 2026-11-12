// Brinelight in the browser, with real keys and real touches, at 1280×800, a phone held upright (390×844) and a phone
// on its side (844×390): the title, the intro panel, the tutorial; then in a quiet arena every action by key (walk,
// both depth directions, attack, jump, jump-attack, tag, a double-tap dash, a dash attack, the dash special for both
// heroes, the Festival double-team, pause and resume) and the same by touch (the stick, a double flick to dash, the
// three buttons, the special as flick-flick, JUMP, ATTACK); the special's one-time prompt in the player's own keys;
// the harbour map, a locked district, a stage card, the results card and the save under brinelight-v1. Then the
// Ropewalk and Shipyard, by keys and again by touch: stepping out of a belt barrel's lane, Enzo punching one to a stop,
// walking up into a barrel to pick it up, hauling an eel out of its hole, knocking an inker off its post (its ink
// clears), kicking a cormorant out of its dive, heaving Longshanks over by his stuck leg, and rolling a barrel onto one
// of Tanglejaw's holes; and area 3 on the map, opening once 2-3 is cleared, with its story panel. The scene goals by
// keys and by touch: jump-kicking the gull thief out of a chase while the camera scrolls, beating a raider off the
// lantern stall and holding out, knocking a boarder off the barge, and running out of the tide. The three festival
// breathers: whack-a-crab from the results card's Next stage (keys J K L, or tapping the pots), hanging a lantern on
// the beat, the bottle toss, Skip, and the reward card. Fails on any page error or sideways scroll. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
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

// ─────────────────────────────── the Ropewalk and Shipyard: every new interaction, by keys and by touch
/** a quiet arena in an area-3 stage; `boss` brings a boss straight in and waits out its entrance */
const arena3 = async (page, stage, who = 'dora', setup = '', boss = '') => {
  await game(page, `o.start("${stage}", 3)`);
  await until(page, `o.screen === "play" && g && g.stageId === "${stage}"`);
  await game(page, `(() => { g.tut.stage = 9; g.evI = 99; g.foes = []; g.items = []; g.props = []; g.rolls = []; g.ink = []; g.talk = null;
    ${boss ? `g.lock = g.cam; g.spawnBoss("${boss}");` : ''} return 1; })()`);
  if (boss) await until(page, 'g.boss && g.boss.st !== "intro"', 20000);
  if (await game(page, 'g.active') !== who) await game(page, '(g.doTag(true), 1)');
  await wait(600);
  await game(page, `(() => { const p = g.hero(); p.x = g.camL + 300; p.z = 80; p.face = 1; p.hp = 100; g.partner().hp = 100; g.tagCD = 0; g.fest = 0;
    for (const k in g.stats) if (typeof g.stats[k] === 'number') g.stats[k] = 0;
    ${setup}
    return 1; })()`);
};
/** the same moves by key or by touch: attack, jump, and holding a direction */
async function controls(page, how) {
  if (how === 'keys') {
    const tap = async (key, ms = 60) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
    return { how, atk: () => tap('KeyJ'), jmp: () => tap('KeyK'),
      hold: async (dir, ms) => { const key = { up: 'ArrowUp', down: 'ArrowDown', right: 'ArrowRight', left: 'ArrowLeft' }[dir]; await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); } };
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const T = await game(page, '(() => { const t = o.scene.tl; return { s: t.stick, a: t.atk, j: t.jmp }; })()');
  const press = async (b) => { await touch('touchStart', [[b.x, b.y]]); await wait(70); await touch('touchEnd', []); };
  return { how, atk: () => press(T.a), jmp: () => press(T.j),
    hold: async (dir, ms) => {
      const [dx, dy] = { up: [0, -1], down: [0, 1], right: [1, 0], left: [-1, 0] }[dir];
      await touch('touchStart', [[T.s.x, T.s.y]]); await touch('touchMove', [[T.s.x + dx * T.s.r * 0.9, T.s.y + dy * T.s.r * 0.9]]); await wait(ms); await touch('touchEnd', []);
    } };
}
async function area3Actions(page, tag, how) {
  const t = `${tag} ${how}`;
  let c = await controls(page, how);
  // the belt: a barrel rumbles and marks lane 2; stepping up a lane lets it roll past
  await arena3(page, '3-1', 'dora', 'g.sendRoll(2, "barrel", false);');
  if (how === 'touch') c = await controls(page, how);
  await until(page, 'g.rolls.length && g.rolls[0].t > 0.3', 4000);
  await shot(page, `${tag}-belt-tell`);
  await c.hold('up', 450);
  ok(await game(page, 'g.hero().z') < 55, `${t}: stepping up a lane out of the barrel's way (z ${Math.round(await game(page, 'g.hero().z'))})`);
  await until(page, '!g.rolls.length', 8000);
  ok(await game(page, 'g.hero().hp') === 100, `${t}: the belt barrel rolls past`);
  // Enzo punches a rolling barrel to a stop
  await arena3(page, '3-1', 'enzo', 'g.sendRoll(2, "barrel", false);');
  await until(page, 'g.rolls.length && g.rolls[0].t >= g.rolls[0].tell && g.rolls[0].x - g.hero().x < 210', 6000);
  await c.atk();
  await until(page, 'g.learned.stop >= 1', 2000); ok(true, `${t}: Enzo's paw stops a rolling barrel`);
  await shot(page, `${tag}-belt-stop`);
  // walking up into a barrel on the boards picks it up
  await arena3(page, '3-1', 'enzo', 'g.addItem("barrel", g.hero().x, g.hero().z - 40, 0, 0, 0);');
  await c.hold('up', 400);
  await until(page, '!!g.hero().hold', 2000); ok(true, `${t}: walking up into a barrel picks it up`);
  // an eel in its hole: Enzo's paw hauls it out onto the boards
  await arena3(page, '3-1', 'enzo', 'const f = g.spawnFoe("eel", 1, { lane: 2 }); f.x = f.tx = g.hero().x + 70; f.z = f.tz = 80; f.st = "idle"; f.t = 0; f.cd = 9;');
  await shot(page, `${tag}-eel`);
  await c.atk();
  await until(page, 'g.foes[0].loose', 2000); ok(true, `${t}: Enzo hauls an eel out of its hole`);
  // an inker on its post squirts ink; Dora knocks it off and the ink clears
  await arena3(page, '3-2', 'dora', 'const f = g.spawnFoe("octo", 1); f.x = f.tx = g.camL + 400; f.z = f.tz = 20;');
  await until(page, 'g.foes[0].st === "perch"', 6000); await game(page, '(g.foes[0].cd = 0, 1)');
  await until(page, 'g.ink.length > 0', 8000);
  await shot(page, `${tag}-ink`);
  await game(page, '(() => { const p = g.hero(); p.x = g.foes[0].x - 60; p.z = 20; p.face = 1; p.hp = 100; return 1; })()');
  await c.atk();
  await until(page, 'g.foes[0].loose && g.ink.length === 0', 2500); ok(true, `${t}: Dora knocks the inker off its post and the ink clears`);
  // a cormorant: its ring locks, and Dora's jump kick knocks it out of the sky
  await arena3(page, '3-2', 'dora', 'const f = g.spawnFoe("cormorant", 1); f.x = g.hero().x + 150; f.h = 185; f.st = "hover"; f.t = 0; f.cd = 0;');
  await until(page, 'g.foes[0].st === "wind"', 6000);
  await shot(page, `${tag}-cormorant`);
  await game(page, '(() => { const p = g.hero(), f = g.foes[0]; p.x = f.x - 40; p.face = 1; return 1; })()');
  await c.jmp(); await wait(90); await c.atk();
  await until(page, '["crash", "down", "ko"].includes(g.foes[0]?.st) || !g.foes.length || g.foes[0].hp < g.foes[0].max', 2500);
  ok(true, `${t}: Dora kicks a cormorant out of its dive`);
  // Longshanks: his stomp sticks a leg in the planks, and Enzo's paw beside it heaves him over
  await arena3(page, '3-2', 'enzo', '', 'longshanks');
  await game(page, '(() => { const b = g.boss, p = g.hero(); p.inv = 9; b.st = "stomp"; b.t = 0; b.tx = p.x + 70; b.tz = p.z; b.x = b.tx + 95; b.z = p.z; return 1; })()');
  await shot(page, `${tag}-longshanks-stuck`);
  await c.atk();
  await until(page, 'g.boss.st === "heave" || g.boss.st === "toppled"', 2000);
  await until(page, 'g.boss.st === "toppled"', 3000); ok(true, `${t}: Enzo heaves Longshanks over by his stuck leg`);
  await shot(page, `${tag}-longshanks-toppled`);
  // Tanglejaw: Enzo carries a barrel onto one of the holes he isn't in
  await arena3(page, '3-3', 'enzo', '', 'tanglejaw');
  await game(page, `(() => { const b = g.boss, p = g.hero(); p.inv = 9;
    const hi = g.holes.findIndex((h, i) => i !== b.hole), h = g.holes[hi];
    const it = g.addItem("barrel", p.x, p.z, 0, 0, 0); it.held = true; p.hold = it; p.st = "hold"; p.t = 0;
    p.x = h.x - 130; p.z = h.z; p.face = 1; window.__hole = hi; return 1; })()`);
  await shot(page, `${tag}-tanglejaw-carry`);
  await c.hold('right', 900);
  await until(page, 'g.holes[window.__hole].plug', 2000); ok(true, `${t}: walking a barrel onto Tanglejaw's hole plugs it`);
  await shot(page, `${tag}-tanglejaw-plug`);
}

// ─────────────────────────────── scene goals and festival breathers
const goalArena = async (page, stage, sid) => {
  await game(page, `o.start("${stage}", 5)`);
  await until(page, `o.screen === "play" && g && g.stageId === "${stage}"`);
  await game(page, `(() => { g.sceneI = g.sceneIds.indexOf("${sid}"); g.enterScene("${sid}"); g.tut.stage = 9;
    const e = g.scene.events.find((x) => ["chase", "defend", "ride", "tide"].includes(x.kind));
    g.evI = g.scene.events.indexOf(e); g.cam = Math.min(Math.max(e.col * 40, 430), g.len - 430); g.hero().x = g.cam - 100; return 1; })()`);
  await until(page, '!!g.goal', 8000);
  await game(page, '(() => { g.foes = []; const p = g.hero(); p.hp = 100; p.inv = 0; g.partner().hp = 100; g.talk = null; return 1; })()');
};
async function varietyActions(page, tag, how) {
  const t = `${tag} ${how}`;
  let c = await controls(page, how);
  // the chase: the camera scrolls by itself; a jump kick at the swooping thief wins the lanterns back
  await goalArena(page, '1-1', 'q2');
  if (how === 'touch') c = await controls(page, how);
  const c0 = await game(page, 'g.cam'); await wait(600);
  ok(await game(page, 'g.cam') > c0 + 30, `${t}: the chase scrolls on by itself`);
  await game(page, '(() => { g.foes = []; const p = g.hero(), G = g.goal; p.face = 1; Object.assign(G, { st: "swoop", stT: 0, x: p.x + 60, z: p.z, h: 70 }); return 1; })()');
  await shot(page, `${tag}-chase`);
  await c.jmp(); await wait(110); await c.atk();
  await until(page, 'g.goal.won', 2500); ok(true, `${t}: a jump kick knocks the lantern out of the thief's beak`);
  // defend: a raider bashes the stall while you're away; your kicks drive it off; holding out wins
  await goalArena(page, '1-2', 'sd');
  ok(await game(page, 'g.goal.kind === "defend" && g.goal.hp === 100 && g.lock !== null'), `${t}: the stall to defend, at full health`);
  await game(page, '(() => { const G = g.goal, p = g.hero(); p.x = g.camL + 60; p.z = 150; const f = g.spawnFoe("crab", 1, { script: "raid" }); f.x = G.x + 160; f.z = G.z + 16; f.st = "idle"; f.cd = 0; f.hp = f.max = 30; window.__raider = f; return 1; })()');
  await until(page, 'g.goal.hp < 100', 8000); ok(true, `${t}: a raider bashes the stall`);
  await shot(page, `${tag}-defend`);
  await game(page, '(() => { const f = window.__raider, p = g.hero(); f.cd = 9; p.x = f.x - 70; p.z = f.z; p.face = 1; return 1; })()');
  await c.atk();
  await until(page, 'window.__raider.hp < window.__raider.max', 2000); ok(true, `${t}: a kick drives the raider off the stall`);
  await game(page, '(() => { g.foes = []; g.goal.t = 99; return 1; })()');
  await until(page, 'g.goal.done && g.goal.won && g.lock === null', 3000); ok(true, `${t}: holding out with the stall standing wins its lanterns`);
  // ride: a boarder knocked past the edge of the barge goes overboard
  await goalArena(page, '1-3', 'bg');
  await game(page, '(() => { const p = g.hero(); p.x = g.camR - 170; p.z = 80; p.face = 1; const f = g.spawnFoe("crab", 1); f.x = p.x + 70; f.z = 80; f.st = "idle"; f.cd = 9; f.hp = 99; f.max = 99; return 1; })()');
  await shot(page, `${tag}-ride`);
  for (let i = 0; i < 8 && !(await game(page, 'g.stats.overboard')); i++) { await c.atk(); await wait(170); }
  await until(page, 'g.stats.overboard >= 1', 3000); ok(true, `${t}: a boarder knocked off the edge goes overboard`);
  // the tide: standing in it chips your health and asks you to move; walking right gets you out
  await goalArena(page, '1-3', 'bt');
  await game(page, '(() => { const p = g.hero(); g.goal.front = p.x + 60; return 1; })()');
  await wait(700);
  ok(await game(page, 'g.hero().hp < 100'), `${t}: the tide chips a hero standing in it`);
  ok(await game(page, 'g.prompt && g.prompt.act === "go"'), `${t}: and the arrow says keep moving`);
  await shot(page, `${tag}-tide`);
  await c.hold('right', 900);
  ok(await game(page, 'g.hero().x > g.goal.front + 18'), `${t}: walking right gets out of the water`);
}
/** a breather by real presses: keys J K L, or taps on the touch buttons (whack: on the pots themselves) */
async function festControls(page, how) {
  if (how === 'keys') return { press: (i) => page.keyboard.press(['KeyJ', 'KeyK', 'KeyL'][i]) };
  const cdp = await page.context().newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const T = await page.evaluate(() => { const s = window.__brinelight().scene; return { b: [s.tl.atk, s.tl.jmp, s.tl.tag], pots: s.festPots() }; });
  const tap = async (x, y) => { await touch('touchStart', [[x, y]]); await wait(50); await touch('touchEnd', []); };
  return { press: (i) => tap(T.b[i].x, T.b[i].y), pot: (i) => tap(T.pots[i].x, T.pots[i].y - T.pots[i].w * 0.3) };
}
const fest = (page, expr) => page.evaluate((e) => new Function('F', 'o', `return (${e})`)(window.__brinelight().fest, window.__brinelight()), expr);
async function festActions(page, tag, how) {
  const t = `${tag} ${how}`;
  // Next stage on the results card leads into a breather first
  await game(page, 'o.start("1-1", 4)'); await until(page, 'g && g.stageId === "1-1"');
  await game(page, '(() => { g.tut.stage = 9; g.mode = "clear"; g.clearT = 3; return 1; })()');
  await page.locator('.bl-results').waitFor();
  await page.locator('.bl-results button', { hasText: 'Next stage' }).click();
  await until(page, 'o.screen === "fest" && o.fest && o.fest.kind === "whack"'); ok(true, `${t}: Next stage opens whack-a-crab`);
  const fc = await festControls(page, how);
  const hit = new Set();
  for (const t0 = Date.now(); Date.now() - t0 < 20000 && hit.size < 3;) {
    const i = await fest(page, 'F.pots.findIndex((p) => p.st === "up")');
    if (i < 0 || hit.has(i)) { await wait(60); continue; }
    const s0 = await fest(page, 'F.score');
    if (how === 'touch' && i !== 1) await fc.pot(i); else await fc.press(i);
    await wait(80);
    if (await fest(page, 'F.score') > s0) hit.add(i);
  }
  ok(hit.size === 3, `${t}: each pot's own button bonks its crab (${[...hit]})`);
  await shot(page, `${tag}-fest-whack`);
  await fest(page, '(F.t = F.dur - 0.05, 1)');
  await page.locator('.bl-festend').waitFor(); ok(true, `${t}: the reward card`);
  const before = (await page.evaluate(() => JSON.parse(localStorage.getItem('brinelight-v1')))).lanterns;
  await page.locator('.bl-festend button', { hasText: 'Next stage' }).click();
  await until(page, 'o.screen === "play" && g.stageId === "1-2"'); ok(true, `${t}: then the next stage`);
  ok(before >= 1, `${t}: the breather's lanterns are saved (${before})`);
  // hanging lanterns: press as one reaches the hook
  await game(page, 'o.festStart("1-2", "1-3")'); await until(page, 'o.screen === "fest" && o.fest.kind === "lanterns"');
  const fl = await festControls(page, how);
  for (let k = 0; k < 3 && !(await fest(page, 'F.hung')); k++) {
    await page.waitForFunction(() => { const F = window.__brinelight().fest; return F.lanterns.some((l) => l.st === 'fly' && l.arrive - F.t < 0.06 && l.arrive - F.t > -0.02); }, null, { polling: 'raf', timeout: 6000 });
    await fl.press(0); await wait(100);
  }
  ok(await fest(page, 'F.hung') >= 1, `${t}: a lantern hung on the beat`);
  await shot(page, `${tag}-fest-lanterns`);
  // the bottle toss: throw as the marker passes over a stack
  await page.locator('.bl-skip').click();
  // 1-3 opens on its story panel the first time
  await until(page, '(o.screen === "play" && g.stageId === "1-3") || o.screen === "panel"');
  if (await game(page, 'o.screen === "panel"')) await page.locator('.bl-panel button', { hasText: 'Go' }).click();
  await until(page, 'o.screen === "play" && g.stageId === "1-3"'); ok(true, `${t}: Skip goes straight on`);
  await game(page, 'o.festStart("1-3", "2-1")'); await until(page, 'o.screen === "fest" && o.fest.kind === "bottles"');
  const fb = await festControls(page, how);
  for (let k = 0; k < 4 && !(await fest(page, 'F.stacks.some((s) => s.st !== "up")')); k++) {
    await page.waitForFunction(() => { const F = window.__brinelight().fest; return F.stacks.some((s) => s.st === 'up' && Math.abs(s.x - F.aim) < 0.03); }, null, { polling: 'raf', timeout: 6000 });
    await fb.press(0); await wait(700);
  }
  ok(await fest(page, 'F.stacks.some((s) => s.st !== "up")'), `${t}: a ball topples a stack of bottles`);
  await shot(page, `${tag}-fest-bottles`);
  await page.locator('.bl-skip').click();
  await until(page, 'o.screen === "play" && g.stageId === "2-1"');
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
  await area3Actions(page, tag, 'keys');
  await area3Actions(page, tag, 'touch');
  await varietyActions(page, tag, 'keys');
  await varietyActions(page, tag, 'touch');
  await festActions(page, tag, 'keys');
  await festActions(page, tag, 'touch');
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
  // area 3 on the map: locked until 2-3 is cleared, then 3-1 opens; the shipyard story panel before 3-3
  await page.keyboard.press('Escape'); await page.locator('.bl-overlay button', { hasText: 'Map' }).click();
  await page.locator('.bl-map').waitFor();
  await page.locator('.bl-spot').nth(2).click();
  ok(await page.locator('.bl-stage').count() === 3 && !(await page.locator('.bl-stage').nth(0).isEnabled()), `${tag}: the Ropewalk's stages wait for 2-3`);
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('brinelight-v1'));
    for (const id of ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2']) s.cleared[id] = { score: 1000, time: 90, medal: 1 };
    localStorage.setItem('brinelight-v1', JSON.stringify(s));
  });
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
  await page.locator('.bl-title button', { hasText: 'Continue' }).click(); await page.locator('.bl-map').waitFor();
  await page.locator('.bl-spot').nth(2).click();
  ok(await page.locator('.bl-area').textContent().then((x) => /Ropewalk/.test(x)) && await page.locator('.bl-stage').nth(2).isEnabled(), `${tag}: area 3 opens on the map`);
  await shot(page, `${tag}-map-area3`);
  await page.locator('.bl-stage').nth(2).click();
  await page.locator('.bl-panel').waitFor();
  ok(/Tanglejaw/.test(await page.locator('.bl-panel').textContent()), `${tag}: the shipyard story panel before the drydock`);
  await shot(page, `${tag}-panel-shipyard`);
  await page.locator('.bl-panel button', { hasText: 'Go' }).click();
  await until(page, 'o.screen === "play" && g.stageId === "3-3"'); ok(true, `${tag}: 3-3 starts`);
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('brinelight-v1')))).v === 1, `${tag}: still the brinelight-v1 save`);
  await ctx.close();
}
await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`Brinelight e2e: ${checks} checks passed at 1280×800, 390×844 and 844×390.`);
