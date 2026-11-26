// Kopi Peng Brawl in the browser, muted, with real keys at 1536×900: the title, the stage map (a locked stage stays
// shut), the stage panel; then in a quiet arena every player-one key (WASD and the arrows to walk all four ways, a
// double-tap run, J attack, K and Space jump, a jump kick, L to pick up a stool, swing it and throw it, I and J+K for the
// special, Q to swap heroes), pause and resume on Esc and P; player two joining on comma and their keys (arrows, comma,
// full stop, slash, apostrophe, numpad 1 2 3 0) while WASD stays with player one; the team-up; mashing out of a python;
// both heroes down, the Continue overlay and Enter to retry; and the boss going down, the results card and the save
// under kopi-peng-v1 unlocking stage 2. Fails on any page error or sideways scroll. Needs `npm run dev` (or BASE_URL)
// and Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch({ args: ['--mute-audio'] });
const errors = [];
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/kopi-${n}.png` }); };
const screen = () => page.evaluate(() => window.__kopi().screen);
const hero = (id) => page.evaluate((id) => { const h = window.__kopi().game.hero(id); return { x: h.x, z: h.z, h: h.h, st: h.st, move: h.move, ctrl: h.ctrl, hold: h.hold?.kind ?? null, meter: h.meter, hp: h.hp, running: h.running }; }, id);
const tap = async (key, ms = 70) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
/** no waves, no twist, no event; foes cleared; both heroes stood in the middle */
const quiet = () => page.evaluate(() => {
  const g = window.__kopi().game; g.waveWait = 1e9; g.twistT = 1e9; g.jetT = 1e9; g.doorT = 1e9; g.curveT = 1e9; g.eventDone = true; g.foes = []; g.items = []; g.hazards = [];
  for (const h of g.heroes) { h.hp = h.maxHp; h.st = 'idle'; h.move = null; h.hold = null; h.carry = null; h.vx = h.vz = h.vh = 0; h.h = 0; h.x = g.camX + (h.id === 'dora' ? 600 : 900); h.z = 110; h.face = 1; }
});
const settle = () => wait(450);

// ── title, map, panel
await page.goto(`${base}/kopi`, { waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await page.evaluate(() => localStorage.removeItem('kopi-peng-v1'));
await wait(600);
ok(await screen() === 'title', 'title first'); await shot('title');
await page.keyboard.press('Enter'); await wait(300);
ok(await screen() === 'select', 'Enter opens the stage map'); await shot('map');
await page.keyboard.press('ArrowRight'); await wait(100); await page.keyboard.press('Enter'); await wait(300);
ok(await screen() === 'select', 'a locked stage stays shut');
await page.keyboard.press('ArrowLeft'); await wait(100); await page.keyboard.press('Enter'); await wait(400);
ok(await screen() === 'panel', 'stage 1 opens its panel'); await shot('panel');
await page.keyboard.press('Enter'); await page.waitForFunction(() => window.__kopi().screen === 'play' && window.__kopi().game, null, { timeout: 30000 });
await wait(800); await quiet(); await settle();

// ── player one: walking four ways, WASD and arrows
let a = await hero('dora');
ok(a.ctrl === 'p1' && (await hero('enzo')).ctrl === 'bot', 'solo: Dora is player one, Enzo the helper');
await page.evaluate(() => { window.__kopi().game.hero('enzo').ctrl = 'p2'; });   // keep the helper still while we measure
await hold('KeyD', 400); let b = await hero('dora'); ok(b.x > a.x + 40, 'D walks right');
await hold('KeyA', 400); a = await hero('dora'); ok(a.x < b.x - 40, 'A walks left');
await hold('KeyS', 300); b = await hero('dora'); ok(b.z > a.z + 10, 'S walks down the floor');
await hold('KeyW', 300); a = await hero('dora'); ok(a.z < b.z - 10, 'W walks up the floor');
await hold('ArrowRight', 300); b = await hero('dora'); ok(b.x > a.x + 30, 'the right arrow walks in solo play');
await hold('ArrowLeft', 300); a = await hero('dora'); ok(a.x < b.x - 30, 'the left arrow walks');
await hold('ArrowDown', 250); b = await hero('dora'); ok(b.z > a.z + 5, 'the down arrow walks');
await hold('ArrowUp', 250); a = await hero('dora'); ok(a.z < b.z - 5, 'the up arrow walks');
await tap('KeyD', 60); await wait(60); await page.keyboard.down('KeyD'); await wait(250);
b = await hero('dora'); await page.keyboard.up('KeyD'); ok(b.running || b.st === 'run', 'double-tap runs');
await settle();

// ── attack, jump, jump kick
await tap('KeyJ'); a = await hero('dora'); ok(a.st === 'atk' && /jab/.test(a.move ?? ''), `J jabs (${a.move})`); await settle();
await tap('KeyK'); await wait(120); a = await hero('dora'); ok(a.h > 10, 'K jumps'); await wait(150);
await tap('KeyJ'); await wait(40); a = await hero('dora'); ok(/air/.test(a.move ?? ''), `J in the air kicks (${a.move})`); await wait(900);
await tap('Space'); await wait(120); a = await hero('dora'); ok(a.h > 10, 'Space jumps'); await wait(900);

// ── pick up, swing and throw a stool
await page.evaluate(() => { const g = window.__kopi().game, d = g.hero('dora'); const it = g.mkItem('stool', d.x + 30, d.z); g.items.push(it); });
await tap('KeyL'); await settle(); a = await hero('dora'); ok(a.hold === 'stool', 'L picks up the stool');
await tap('KeyJ'); a = await hero('dora'); ok(a.st === 'atk', 'J swings it'); await settle();
await page.waitForFunction(() => window.__kopi().game.hero('dora').st === 'idle'); await tap('KeyL'); await wait(100); a = await hero('dora'); ok(a.hold === null, 'L throws it');
ok(await page.evaluate(() => window.__kopi().game.items.some((i) => i.flying)), 'the stool flies'); await settle(); await wait(600);

// ── the special, on I and on J+K together; holding K then J in the air stays a kick
await page.evaluate(() => { window.__kopi().game.hero('dora').meter = 100; });
await tap('KeyI'); await wait(40); a = await hero('dora'); ok(a.move === 'dora-special' && a.meter < 100, `I fires the special (${a.move})`); await shot('special'); await wait(1400);
await page.evaluate(() => { window.__kopi().game.hero('dora').meter = 100; });
await page.keyboard.down('KeyJ'); await page.keyboard.down('KeyK'); await wait(60); await page.keyboard.up('KeyJ'); await page.keyboard.up('KeyK');
a = await hero('dora'); ok(a.move === 'dora-special', `J+K together fires the special (${a.move})`); await wait(1400);
await page.evaluate(() => { window.__kopi().game.hero('dora').meter = 100; });
await page.keyboard.down('KeyK'); await wait(250); await page.keyboard.press('KeyJ'); await wait(40); await page.keyboard.up('KeyK');
a = await hero('dora'); ok(/air/.test(a.move ?? '') && a.meter >= 100, `held K then J is an air kick, not the special (${a.move})`); await wait(900);

// ── pause on Esc and P
await page.keyboard.press('Escape'); await wait(150);
ok(await page.evaluate(() => window.__kopi().paused), 'Esc pauses'); await shot('pause');
const t0 = await page.evaluate(() => window.__kopi().game.t); await wait(300);
ok(await page.evaluate((t0) => window.__kopi().game.t === t0, t0), 'paused time stands still');
await page.keyboard.press('Escape'); await wait(150); ok(!(await page.evaluate(() => window.__kopi().paused)), 'Esc resumes');
await page.keyboard.press('KeyP'); await wait(150); ok(await page.evaluate(() => window.__kopi().paused), 'P pauses');
await page.keyboard.press('KeyP'); await wait(150); ok(!(await page.evaluate(() => window.__kopi().paused)), 'P resumes');

// ── Q swaps heroes
await page.evaluate(() => { window.__kopi().game.hero('enzo').ctrl = 'bot'; });
await tap('KeyQ'); await wait(100);
ok((await hero('enzo')).ctrl === 'p1' && (await hero('dora')).ctrl === 'bot', 'Q hands player one Enzo');
await tap('KeyQ'); await wait(100); ok((await hero('dora')).ctrl === 'p1', 'Q swaps back');

// ── player two joins and every player-two key works
await quiet(); await settle();
await tap('Comma'); await wait(200);
ok(await page.evaluate(() => window.__kopi().twoP), 'comma joins player two');
ok((await hero('enzo')).ctrl === 'p2', 'player two takes Enzo from the helper'); await shot('p2-join');
await quiet(); await settle();
a = await hero('enzo'); let d0 = await hero('dora');
await hold('ArrowRight', 350); b = await hero('enzo'); ok(b.x > a.x + 30, 'arrows now walk player two');
ok(Math.abs((await hero('dora')).x - d0.x) < 2, 'and not player one');
await hold('ArrowLeft', 300); a = await hero('enzo'); ok(a.x < b.x - 30, 'player two walks left');
await hold('ArrowDown', 250); b = await hero('enzo'); ok(b.z > a.z + 5, 'player two walks down');
await hold('ArrowUp', 250); a = await hero('enzo'); ok(a.z < b.z - 5, 'player two walks up');
await hold('KeyD', 300); ok((await hero('dora')).x > d0.x + 30, 'WASD stays with player one'); await settle();
await tap('Comma'); a = await hero('enzo'); ok(a.st === 'atk', 'comma attacks'); await settle();
await tap('Numpad1'); a = await hero('enzo'); ok(a.st === 'atk', 'numpad 1 attacks'); await settle();
await tap('Period'); await wait(120); a = await hero('enzo'); ok(a.h > 10, 'full stop jumps'); await wait(900);
await tap('Numpad2'); await wait(120); a = await hero('enzo'); ok(a.h > 10, 'numpad 2 jumps'); await wait(900);
await page.evaluate(() => { const g = window.__kopi().game, e = g.hero('enzo'); g.items.push(g.mkItem('wok', e.x + 30, e.z)); });
await tap('Slash'); await settle(); ok((await hero('enzo')).hold === 'wok', 'slash picks up');
await tap('Numpad3'); await wait(100); ok((await hero('enzo')).hold === null, 'numpad 3 throws'); await wait(800);
await page.evaluate(() => { window.__kopi().game.hero('enzo').meter = 100; });
await tap('Quote'); await wait(40); ok((await hero('enzo')).move === 'enzo-special', 'apostrophe fires player two\'s special'); await wait(1600);
await page.evaluate(() => { window.__kopi().game.hero('enzo').meter = 100; });
await tap('Numpad0'); await wait(40); ok((await hero('enzo')).move === 'enzo-special', 'numpad 0 fires it too'); await wait(1600);

// ── the team-up: both press Special close together
await quiet(); await page.evaluate(() => { const g = window.__kopi().game; const d = g.hero('dora'), e = g.hero('enzo'); e.x = d.x + 80; d.meter = 100; e.meter = 100; });
await page.keyboard.down('KeyI'); await page.keyboard.down('Quote'); await wait(60); await page.keyboard.up('KeyI'); await page.keyboard.up('Quote'); await wait(40);
ok((await hero('dora')).move === 'team' && (await hero('enzo')).move === 'team', 'both specials together make the team-up'); await shot('team'); await wait(2200);

// ── mashing out of a python
await quiet(); await page.evaluate(() => { const g = window.__kopi().game, d = g.hero('dora'); g.hero('enzo').x = d.x + 600; const p = g.mkFoe('python', d.x, d.z); p.st = 'act'; p.t = 0; p.h = 40; p.cd = 99; g.foes.push(p); });
await wait(100); ok((await hero('dora')).st === 'wrapped', 'the python wraps Dora'); await shot('wrapped');
for (let i = 0; i < 24 && (await hero('dora')).st === 'wrapped'; i++) await tap(i % 2 ? 'KeyK' : 'KeyJ', 40);
ok((await hero('dora')).st !== 'wrapped', 'mashing J and K wriggles free');

// ── both down, Continue, retry
await quiet(); await page.evaluate(() => { const g = window.__kopi().game; for (const h of g.heroes) g.knockOut(h); });
await page.waitForFunction(() => window.__kopi().down, null, { timeout: 5000 }); ok(true, 'both down shows Continue'); await shot('down');
await page.keyboard.press('Enter'); await wait(300);
ok(!(await page.evaluate(() => window.__kopi().down)) && (await page.evaluate(() => window.__kopi().game.mode)) === 'play', 'Enter continues');

// ── the boss goes down: results and the save
await page.evaluate(() => { const g = window.__kopi().game; g.foes = []; g.enterScene(2); });
await page.waitForFunction(() => window.__kopi().game.boss, null, { timeout: 30000 });
await page.evaluate(() => { const g = window.__kopi().game; g.killFoe(g.boss, 1); });
await page.waitForFunction(() => window.__kopi().screen === 'results', null, { timeout: 30000 }); ok(true, 'the boss down brings the results card'); await shot('results');
const save = JSON.parse(await page.evaluate(() => localStorage.getItem('kopi-peng-v1')));
ok(save?.cleared?.s1, 'the clear is saved under kopi-peng-v1');
await page.keyboard.press('Enter'); await wait(300); ok(await screen() === 'select', 'Enter returns to the map');
await page.keyboard.press('Enter'); await wait(400);
ok(await screen() === 'panel', 'the cursor waits on stage 2, and it is open now');

ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log(`kopi e2e: ${checks} checks passed`);
