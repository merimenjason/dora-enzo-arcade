// Dragon Playground in the browser, muted, with real keys at 1536×864: the title, the race map (a locked race stays
// shut, every option button), the race card (the power buttons once one is owned), the countdown; then every driver key
// (D and → run, A and ← walk back, K, Space, W and ↑ jump, a held jump going higher, S and ↓ on a slide, I to roar), the
// solo rider keys (J swats a crow, L grabs a swing, O flutters), Q to swap seats, Esc and P to pause and resume, R to
// restart and Q to leave from the pause card; player two joining on comma and riding with comma, slash, apostrophe and
// numpad 1 3 0; a race run to the line with real keys, the results card, the save under dragon-playground-v1 opening race
// 2, R to race again and K back to the map. Fails on any page error, sideways scroll or card or HUD text under 4.5:1
// contrast. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
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
const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/dragon-${n}.png` }); };
const st = () => page.evaluate(() => { const o = window.__dragon(); return { screen: o.screen, paused: o.paused, twoP: o.twoP }; });
const dragon = () => page.evaluate(() => { const g = window.__dragon().game, d = g.dragon; return { x: d.x, y: d.y, ground: d.ground, st: d.st, tier: d.tier, meter: d.meter, hang: !!d.hang, flutter: d.flutterUsed, driver: g.driver, riderBot: g.riderBot, act: g.rider.act, crows: g.stats.crows, mode: g.mode }; });
const tap = async (key, ms = 70) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
/** every line of text on the cards, the map and the HUD plaques reads at 4.5:1 or better against what it sits on;
 *  app/globals.css paints bare `p` a pale grey that would leak onto the cream cards */
const readable = async (where) => {
  const bad = await page.evaluate(() => {
    const px = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.99) return c.slice(0, 3); } return [31, 26, 31]; };
    const out = [];
    for (const el of document.querySelectorAll('.dp-card, .dp-card *, .dp-plaque, .dp-plaque *, .dp-race, .dp-race *, .dp-opts *, .dp-keys, .dp-lede, .dp-sub, .dp-back')) {
      if (el.closest('.locked')) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      const a = lum(px(getComputedStyle(el).color).slice(0, 3)), b = lum(bgOf(el));
      const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (cr < 4.5) out.push(`${el.textContent.trim().slice(0, 30)} (${cr.toFixed(2)}:1)`);
    }
    return out;
  });
  ok(bad.length === 0, `the ${where} text is readable: ${bad.join('; ')}`);
};
/** no crows, otters well behind, the dragon stood on open ground at x */
const quiet = (x) => page.evaluate((x) => {
  const g = window.__dragon().game, d = g.dragon; g.crows = []; g.nextCrow = 1e9;
  d.x = x; d.y = g.supports(x, 0)[0] ?? 0; d.vy = 0; d.ground = true; d.st = 'run'; d.tier = null; d.hang = null; d.stumbleT = 0; d.flutterUsed = false;
  for (const o of g.otters) { o.x = x - 1500 - o.i * 100; o.y = 0; o.st = 'run'; }
}, x);
/** an x with flat open ground and nothing overhead for the next 700 px, so a jump goes up and comes down clean */
const open = () => page.evaluate(() => {
  const g = window.__dragon().game, c = g.course;
  for (let x = 900; x < c.finish - 1000; x += 50) {
    let clear = true;
    for (let k = 0; k <= 700 && clear; k += 25) { const s = g.supports(x + k, 0); if (s.length !== 1 || s[0] !== 0 || g.inGap(x + k)) clear = false; }
    if (clear && !c.grabs.some((q) => (q.x1 ?? q.x) > x - 100 && q.x < x + 800)) return x;
  }
  return 900;
});
const toRace = async () => { await page.waitForFunction(() => window.__dragon().game?.mode === 'race', null, { timeout: 10000 }); };

// ── title, map, card
await page.goto(`${base}/dragon-playground`, { waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await page.evaluate(() => localStorage.removeItem('dragon-playground-v1'));
await page.reload(); await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
ok((await st()).screen === 'title', 'the title shows first'); await shot('title'); await readable('title');
await page.keyboard.press('Enter'); await wait(250);
ok((await st()).screen === 'map', 'Enter opens the race map'); await shot('map'); await readable('map');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(250);
ok((await st()).screen === 'map', 'race 2 stays shut before race 1 is won');
await page.keyboard.press('ArrowLeft');
for (const [label, re] of [['Easy race', /Easy race: off/], ['Music', /Music: off/], ['Sound', /Sound: off/], ['Driving', /Driving: Enzo/]]) {
  const b = page.locator('.dp-opts button', { hasText: label }); await b.click(); await wait(100);
  ok(re.test(await b.textContent()), `the ${label} button toggles`); await b.click(); await wait(100);
}
ok(/Easy race: on/.test(await page.locator('.dp-opts button', { hasText: 'Easy race' }).textContent()), 'easy race is back on');
await page.keyboard.press('KeyK'); await wait(250);
ok((await st()).screen === 'card', 'K opens the race card'); await shot('card'); await readable('race card');
ok(await page.locator('.dp-powers').count() === 0, 'no power to pick before any race is won');
await page.locator('.dp-go').click(); await wait(400);
ok((await st()).screen === 'play' && (await dragon()).mode === 'count', 'the Race button starts the countdown');
await shot('count'); await readable('countdown HUD');
await toRace(); ok(true, 'the countdown ends in a race');

// ── the driver's keys
for (const key of ['KeyD', 'ArrowRight']) { await quiet(920); const x0 = (await dragon()).x; await hold(key, 300); ok((await dragon()).x > x0 + 60, `${key} runs right`); }
for (const key of ['KeyA', 'ArrowLeft']) { await quiet(1100); const x0 = (await dragon()).x; await hold(key, 300); ok((await dragon()).x < x0 - 20, `${key} walks back`); }
for (const key of ['KeyK', 'Space', 'KeyW', 'ArrowUp']) {
  await quiet(920); await page.keyboard.down(key); await wait(120); const d = await dragon(); await page.keyboard.up(key); await wait(900);
  ok(d.y > 20 && !d.ground, `${key} jumps`);
}
const peak = async (ms) => { await quiet(920); await page.keyboard.down('KeyK'); let top = 0; for (let i = 0; i < 14; i++) { await wait(40); if (i * 40 >= ms) await page.keyboard.up('KeyK'); top = Math.max(top, (await dragon()).y); } await page.keyboard.up('KeyK'); await wait(700); return top; };
const tapTop = await peak(30), heldTop = await peak(500);
ok(heldTop > tapTop + 30, `holding jump goes higher (${Math.round(heldTop)} vs ${Math.round(tapTop)})`);
for (const key of ['KeyS', 'ArrowDown']) {
  await page.evaluate(() => { const g = window.__dragon().game, s = g.course.slides[0], d = g.dragon; g.crows = []; d.x = s.x0 + 5; d.y = g.supports(d.x, 0)[0]; d.ground = true; d.vy = 0; d.tier = null; });
  await page.keyboard.down('KeyD'); await page.keyboard.down(key); await wait(900); await page.keyboard.up(key); await page.keyboard.up('KeyD');
  ok(await page.evaluate(() => window.__dragon().game.stats.boosts > 0), `${key} on the chute gives a slide boost`);
}
await quiet(920); await page.evaluate(() => { window.__dragon().game.dragon.meter = 5; }); await wait(100);
await shot('meter-full'); await readable('full meter HUD');
await tap('KeyI'); await wait(100); ok((await dragon()).tier === 'roar' && (await dragon()).meter === 0, 'I roars on a full meter');

// ── the solo rider keys, on top of the helper bot
await quiet(920);
await page.evaluate(() => { const g = window.__dragon().game, d = g.dragon; g.crows = [{ id: 99, x: d.x + 30, y: d.y + g.bodyH() + 70, vx: 0, vy: 0, st: 'swoop', t: 0, gone: false }]; g.nextCrow = 1e9; });
const crows0 = (await dragon()).crows; await tap('KeyJ', 40); await wait(80);
ok((await dragon()).crows > crows0, 'J swats the crow');
await page.evaluate(() => { const g = window.__dragon().game, sw = g.course.grabs.find((q) => q.kind === 'swing'); const d = g.dragon; g.crows = []; d.x = sw.x - 30; d.y = 0; d.vy = 0; d.ground = true; d.tier = null; });
await page.keyboard.down('KeyL'); await wait(150); await page.keyboard.up('KeyL'); await wait(50);
ok((await dragon()).tier === 'fling', 'L grabs the swing and flings the dragon');

// ── swap seats, pause and resume, restart, leave
const drv0 = (await dragon()).driver; await tap('KeyQ'); await wait(150);
ok((await dragon()).driver !== drv0, 'Q swaps seats'); await tap('KeyQ'); await wait(100);
for (const key of ['Escape', 'KeyP']) {
  await tap(key); await wait(200); ok((await st()).paused, `${key} pauses`);
  if (key === 'Escape') { await shot('paused'); await readable('pause'); }
  const x = (await dragon()).x; await hold('KeyD', 200); ok((await dragon()).x === x, 'nothing moves while paused');
  await tap(key); await wait(150); ok(!(await st()).paused, `${key} resumes`);
}
await tap('Escape'); await wait(150); await tap('KeyR'); await wait(300);
ok((await st()).screen === 'play' && !(await st()).paused && (await dragon()).mode === 'count', 'R on the pause card restarts the race');
await toRace(); await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
ok((await st()).screen === 'map', 'Q on the pause card goes back to the map');

// ── win race 1 with real keys: hold right, jump what is in the way, Down on the slides, roar when full
await page.keyboard.press('Enter'); await wait(250); await page.keyboard.press('KeyK'); await toRace();
const course = await page.evaluate(() => { const c = window.__dragon().game.course; return { walls: c.walls.filter((w) => w.h > 32).map((w) => [w.x, w.h]), gaps: c.gaps.map((g) => [g.x0, 0]), slides: c.slides.map((s) => [s.x0, s.x1]) }; });
await page.keyboard.down('ArrowRight'); let downOn = false;
for (let i = 0; i < 2400 && (await st()).screen === 'play'; i++) {
  const d = await dragon();
  const next = [...course.walls, ...course.gaps].filter(([x, h]) => x > d.x - 10 && !(h && d.y >= h - 32)).sort((a, b) => a[0] - b[0])[0];
  if (next && d.ground && next[0] - d.x < (next[1] > 120 || next[1] === 0 ? 230 : 200) && next[0] - d.x > 0) await hold('Space', next[1] > 120 || next[1] === 0 ? 260 : 120);
  const onSl = course.slides.some(([a, b]) => d.x > a && d.x < b && d.y > 1);
  if (onSl !== downOn) { if (onSl) await page.keyboard.down('ArrowDown'); else await page.keyboard.up('ArrowDown'); downOn = onSl; }
  if (d.meter >= 5) await page.keyboard.press('KeyI');
  await wait(30);
}
await page.keyboard.up('ArrowRight'); if (downOn) await page.keyboard.up('ArrowDown');
await page.waitForFunction(() => window.__dragon().screen === 'results', null, { timeout: 60000 });
const place = await page.evaluate(() => window.__dragon().game.place);
ok(place === 1, `a first-timer holding right and jumping wins race 1 (placed ${place})`);
await shot('results'); await readable('results');
const save = JSON.parse(await page.evaluate(() => localStorage.getItem('dragon-playground-v1')));
ok(save?.won?.r1?.stars >= 1, 'the win is saved under dragon-playground-v1');
await tap('KeyR'); await wait(300); ok((await st()).screen === 'play', 'R on the results races again');
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowLeft');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await wait(300);
ok((await st()).screen === 'card', 'race 2 is open now');
ok(await page.locator('.dp-powers button', { hasText: 'Flutter' }).count() === 1, 'the dove lends Flutter');
await page.locator('.dp-powers button', { hasText: 'Flutter' }).click(); await wait(100);
ok(/on/.test(await page.locator('.dp-powers button', { hasText: 'Flutter' }).getAttribute('class')), 'the Flutter button picks it');
await shot('card-powers'); await readable('race 2 card');

// ── race 2: O flutters; player two joins and rides
await page.keyboard.press('KeyK'); await toRace(); const OPEN = await open(); await quiet(OPEN);
await page.keyboard.down('KeyK'); await wait(220); await page.keyboard.up('KeyK'); await wait(40);
const vy0 = await page.evaluate(() => window.__dragon().game.dragon.vy); await tap('KeyO', 40); await wait(30);
ok((await dragon()).flutter && (await page.evaluate(() => window.__dragon().game.dragon.vy)) > vy0, 'O flutters in the air');
await wait(1200);
await tap('Comma'); await wait(150); ok((await st()).twoP && !(await dragon()).riderBot, 'comma joins player two and the helper bot steps off');
await shot('two-player'); await readable('two-player HUD');
for (const key of ['Comma', 'Numpad1']) {
  await wait(400);   // past the 0.32 s swat cooldown
  await quiet(OPEN); await page.evaluate(() => { const g = window.__dragon().game, d = g.dragon; g.crows = [{ id: 98, x: d.x + 30, y: d.y + g.bodyH() + 70, vx: 0, vy: 0, st: 'swoop', t: 0, gone: false }]; });
  const c0 = (await dragon()).crows; await tap(key, 40); await wait(80);
}
for (const key of ['Slash', 'Numpad3']) {
  await page.evaluate(() => { const g = window.__dragon().game, sw = g.course.grabs.find((q) => q.kind !== 'bars'); const d = g.dragon; g.crows = []; d.x = sw.x - 30; d.y = 0; d.vy = 0; d.ground = true; d.tier = null; d.hang = null; });
  await page.keyboard.down(key); await wait(150); await page.keyboard.up(key); await wait(50);
  ok((await dragon()).tier === 'fling', `${key} grabs for player two`);
}
for (const key of ['Quote', 'Numpad0']) {
  await quiet(OPEN); await page.keyboard.down('KeyK'); await wait(220); await page.keyboard.up('KeyK'); await wait(40);
  await tap(key, 40); await wait(30); ok((await dragon()).flutter, `${key} flutters for player two`); await wait(1200);
}

ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log(`dragon playground e2e: ${checks} checks passed`);
