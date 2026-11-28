// Neon Lane in the browser, muted, with real keys at 1536×900: the title (and a click on it); the six nights (a locked
// night stays shut, the arrows and WASD walk the grid, every option button and the 2 key); the brief, back, and a click
// on it; Q from pause ending the run and Enter from its results; then on a quiet sign every solo key (W A S D and the
// arrows set the way to run), the newest held key winning, a swipe, Q swapping who runs, eating sparks, putting a
// circuit out by running over its last spark, pause and resume on Esc and P with its three options, a fuse blown by
// running onto it and a panicked cicak caught for its tail; lights out, the card between nights (key and click) and
// the save opening night 2; the last night put out winning the run; caught with no lives left and R to run again;
// two players with WASD and the arrows each steering their own chinchilla. Fails on any page error, a blank canvas,
// sideways scroll or card text under 4.5:1 contrast. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir>
// saves screenshots.
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
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/neon-${n}.png` }); };
const st = () => page.evaluate(() => { const s = window.__neon(); return { screen: s.screen, paused: s.paused, twoP: s.twoP, sel: s.sel, save: s.save }; });
const game = () => page.evaluate(() => {
  const g = window.__neon().game; if (!g) return null;
  return { night: g.night, phase: g.phase, over: g.over, t: g.t, score: g.score, lives: g.lives, sparksLeft: g.sparksLeft, fuseT: g.fuseT, catches: g.st.catches, tails: g.tails.length,
    heroes: g.heroes.map((h) => ({ id: h.id, cell: h.cell, dir: h.dir, wish: h.wish, state: h.state })) };
});
const tap = async (key, ms = 70) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };
/** every line of text on the open cards reads at 4.5:1 or better against what it sits on; app/globals.css paints bare
 *  `p` a pale grey, so the cards set their colours explicitly */
const readable = async (where) => {
  const bad = await page.evaluate(() => {
    const px = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.99) return c.slice(0, 3); } return [7, 4, 12]; };
    const out = [];
    for (const el of document.querySelectorAll('.nl-card, .nl-card *, .nl-press, .nl-back, .nl-load *')) {
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
const noScroll = async (where) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no sideways scroll on ${where}`);
/** the canvas shows a real picture: plenty of distinct colours, not a flat fill */
const painted = async (where) => {
  const n = await page.evaluate(() => { const c = document.querySelector('.nl-cv'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4); return seen.size; });
  ok(n > 60, `the ${where} canvas is painted (${n} colours)`);
};
/** the HUD strip along the top: its lettering against the dark panel, sampled from the canvas, reads at 4.5:1 */
const hudReadable = async () => {
  const cr = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const c = document.querySelector('.nl-cv'), x = c.getContext('2d'), h = Math.round(c.height * 60 / 864), w = Math.round(c.width * 560 / 1536);
    const d = x.getImageData(0, 0, w, h).data; const ls = [];
    for (let i = 0; i < d.length; i += 4) ls.push(lum([d[i], d[i + 1], d[i + 2]]));
    ls.sort((a, b) => a - b);
    const bg = ls[Math.floor(ls.length * 0.4)], fg = ls[Math.floor(ls.length * 0.995)];
    return (fg + 0.05) / (bg + 0.05);
  });
  ok(cr >= 4.5, `the HUD lettering reads on its panel (${cr.toFixed(2)}:1)`);
};
/** a quiet sign: every cicak kept in the drainpipe for good, so the key tests are not cut short */
const quiet = () => page.evaluate(() => { const g = window.__neon().game; for (const c of g.cicaks) if (c.mode !== 'away') { c.mode = 'home'; c.timer = 1e9; } });
/** wait out the "ready" freeze at the start of a night */
const playing = () => until(async () => (await game())?.phase === 'play');
/** put the running chinchilla on a cell, standing still, with nothing wished */
const put = (cell, i = 0) => page.evaluate(([cell, i]) => { const h = window.__neon().game.heroes[i]; Object.assign(h, { cell, dir: 0, t: 0, wish: 0 }); }, [cell, i]);

// ── title
await page.goto(`${base}/neon-lane`, { waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await page.evaluate(() => localStorage.removeItem('neon-lane-v1'));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await wait(1200);
ok((await st()).screen === 'title', 'opens on the title');
ok(await page.locator('.nl-title img').evaluate((i) => i.complete && i.naturalWidth > 0), 'the title painting loads');
ok((await page.locator('.nl-back').getAttribute('href')) === '/', 'the arcade link goes home');
await readable('title'); await noScroll('the title'); await shot('1-title');
await page.locator('.nl-title').click(); await wait(250); ok((await st()).screen === 'nights', 'a click on the title opens the nights');
await tap('Escape'); await wait(200); ok((await st()).screen === 'title', 'Esc from the nights goes back to the title');

// ── the nights
await tap('Enter'); await wait(300);
ok((await st()).screen === 'nights', 'Enter opens the nights');
ok(await page.locator('.nl-night').count() === 6, 'six nights up Geylang Road');
ok(await page.locator('.nl-night.locked').count() === 5, 'only the first night is open on a fresh save');
ok(await page.locator('.nl-night .sign').count() === 6, 'every night shows its eatery sign');
await readable('nights'); await noScroll('the nights'); await shot('2-nights');
await page.locator('[data-night="1"]').click({ force: true }); await wait(200);
ok((await st()).screen === 'nights', 'a locked night stays shut');
await tap('ArrowLeft'); await tap('ArrowRight'); await wait(100); ok((await st()).sel === 1, 'Right moves along the nights');
await tap('ArrowDown'); await wait(100); ok((await st()).sel === 4, 'Down drops a row');
await tap('KeyW'); await tap('KeyA'); await wait(100); ok((await st()).sel === 0, 'W and A walk back');
await tap('KeyD'); await tap('KeyS'); await wait(100); ok((await st()).sel === 4, 'D and S walk on');
await tap('Enter'); await wait(150); ok((await st()).screen === 'nights', 'Enter on a locked night does nothing');
await tap('ArrowUp'); await tap('ArrowLeft'); await wait(100); ok((await st()).sel === 0, 'Up and Left walk back');
for (const opt of ['assist', 'music', 'sound']) {
  const before = (await st()).save[opt];
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
  ok((await st()).save[opt] === !before, `the ${opt} button toggles`);
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('neon-lane-v1')))[opt] === !before, `${opt} is saved`);
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
}
await page.locator('[data-opt="lead"]').click(); await wait(150); ok((await st()).save.lead === 'enzo', 'the running button picks Enzo');
await page.locator('[data-opt="lead"]').click(); await wait(150); ok((await st()).save.lead === 'dora', 'and back to Dora');
await page.locator('[data-opt="players"]').click(); await wait(150); ok((await st()).twoP, 'the players button picks two');
await tap('Digit2'); await wait(150); ok(!(await st()).twoP, 'the 2 key switches back to one');
await tap('Escape'); await wait(200); ok((await st()).screen === 'title', 'Esc goes back to the title');
await tap('Space'); await wait(200); ok((await st()).screen === 'nights', 'Space opens the nights too');

// ── the brief
await tap('Enter'); await wait(250);
ok((await st()).screen === 'brief', 'Enter opens the brief for the open night');
const brief = await page.locator('.nl-card').textContent();
ok(brief.includes('Corner kopitiam') && brief.includes('5 lives'), 'the brief names the night and the gentle lives');
ok(await page.locator('.nl-gang span').count() === 4, 'the brief introduces the four cicaks');
await readable('brief'); await shot('3-brief');
await tap('Escape'); await wait(200); ok((await st()).screen === 'nights', 'Esc leaves the brief');
await page.locator('[data-night="0"]').click(); await wait(200); ok((await st()).screen === 'brief', 'clicking the open night opens its brief');
await page.locator('.nl-card').click(); await wait(400); ok((await st()).screen === 'play', 'a click on the brief starts the night');
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(400);
ok((await st()).screen === 'results', 'Q from pause ends the run and shows the results');
ok((await page.locator('.nl-card h2').textContent()).includes('Run ended at'), 'a run ended by hand is not called caught');
await readable('results'); await shot('4-quit');
await tap('Enter'); await wait(250); ok((await st()).screen === 'nights', 'Enter from the results goes back to the nights');
await tap('Enter'); await wait(250); await tap('Enter'); await wait(300);
ok((await st()).screen === 'play', 'Enter on the brief starts the night');
await playing(); await wait(300); await painted('sign'); await hudReadable(); await shot('5-play');

// ── solo keys, on a quiet sign
await quiet();
let g = await game();
const start = g.heroes[0].cell;
ok(g.heroes[0].id === 'dora', 'Dora runs');
const wishes = [['KeyW', 1], ['KeyD', 2], ['KeyS', 3], ['KeyA', 4], ['ArrowUp', 1], ['ArrowRight', 2], ['ArrowDown', 3], ['ArrowLeft', 4]];
for (const [key, d] of wishes) { await put(start); await tap(key); await wait(60); ok((await game()).heroes[0].wish === d, `${key} sets the way to run`); }
await put(start); await tap('KeyD'); await wait(500); g = await game();
const ran = g.heroes[0].cell !== start || g.heroes[0].dir !== 0;
await put(start); await tap('KeyA'); await wait(500); const g2 = await game();
ok(ran || g2.heroes[0].cell !== start, 'a tap sends the chinchilla running, and it keeps going');
// newest key held wins: hold D, press W on top, W wins; let go of W and D takes over again
await page.keyboard.down('KeyD'); await wait(120); await page.keyboard.down('KeyW'); await wait(120);
ok((await game()).heroes[0].wish === 1, 'with D held, a pressed W wins');
await page.keyboard.up('KeyW'); await wait(120); ok((await game()).heroes[0].wish === 2, 'letting go of W hands back to D');
await page.keyboard.up('KeyD');
// a swipe on a touch screen sets the way too
await page.evaluate(() => {
  const t = (x, y) => new Touch({ identifier: 1, target: document.body, clientX: x, clientY: y });
  window.dispatchEvent(new TouchEvent('touchstart', { touches: [t(500, 400)] }));
  window.dispatchEvent(new TouchEvent('touchmove', { touches: [t(500, 300)], cancelable: true }));
  window.dispatchEvent(new TouchEvent('touchend', { touches: [] }));
});
ok((await game()).heroes[0].wish === 1, 'a swipe up sets the way to up');
await tap('KeyQ'); await wait(150); g = await game();
ok(g.heroes[0].id === 'enzo' && (await st()).save.lead === 'enzo', 'Q hands over to Enzo and remembers it');
await tap('KeyQ'); await wait(150); ok((await game()).heroes[0].id === 'dora', 'Q swaps back');
// eating: run along and the sparks go
g = await game(); const s0 = g.sparksLeft, sc0 = g.score;
await put(start); await tap('KeyD'); await wait(900); g = await game();
ok(g.sparksLeft < s0 && g.score > sc0, `running eats sparks (${s0 - g.sparksLeft} eaten)`);
// putting a circuit out: leave one spark on the circuit next to the chinchilla and run over it
const dark = await page.evaluate(() => {
  const n = window.__neon(), g = n.game, b = g.board, h = g.heroes[0];
  for (const d of [2, 4, 1, 3]) {
    if (!g.open(h.cell, d)) continue;
    const next = h.cell + [0, -29, 1, 29, -1][d], k = b.circuit[next];
    for (const c of b.circuits[k].cells) if (c !== next && g.spark[c]) { g.spark[c] = 0; g.left[k]--; g.sparksLeft--; }
    if (!g.spark[next]) { g.spark[next] = 1; g.left[k]++; g.sparksLeft++; }
    h.dir = 0; h.t = 0; h.wish = 0;
    return { d, k };
  }
  return null;
});
ok(dark, 'found a tube next to the chinchilla');
await tap(['', 'KeyW', 'KeyD', 'KeyS', 'KeyA'][dark.d]); await wait(500);
ok(await page.evaluate((k) => window.__neon().game.left[k] === 0, dark.k), 'running over the last spark puts its circuit out');
await shot('6-dark');

// ── pause
await tap('Escape'); await wait(200); ok((await st()).paused, 'Esc pauses');
const t0 = (await game()).t; await wait(400); ok((await game()).t === t0, 'the night stops while paused');
ok(await page.locator('.nl-card [data-opt]').count() === 3, 'the pause card has its options');
for (const opt of ['assist', 'music', 'sound']) {
  const before = (await st()).save[opt];
  await page.locator(`.nl-card [data-opt="${opt}"]`).click(); await wait(150);
  ok((await st()).save[opt] === !before && (await st()).paused, `the pause card's ${opt} button toggles and stays paused`);
  await page.locator(`.nl-card [data-opt="${opt}"]`).click(); await wait(150);
}
await readable('pause'); await shot('7-pause');
await tap('Escape'); await wait(200); ok(!(await st()).paused, 'Esc resumes');
await tap('KeyP'); await wait(200); ok((await st()).paused, 'P pauses');
await tap('KeyP'); await wait(200); ok(!(await st()).paused, 'P resumes');

// ── a fuse: run onto it, then catch a panicked cicak
const fuse = await page.evaluate(() => {
  const g = window.__neon().game, b = g.board;
  for (const f of b.fuses) for (const d of [1, 3, 2, 4]) {
    const from = f + [0, 29, -1, -29, 1][d];
    if (g.fuseLeft[f] && from >= 0 && from < 29 * 15 && Math.abs(from % 29 - f % 29) <= 1 && b.kind[from] === 1 && g.open(from, d)) return { f, from, d };
  }
  return null;
});
ok(fuse, 'a fuse with a tube leading onto it');
await page.evaluate(() => { const c = window.__neon().game.cicaks[0]; Object.assign(c, { mode: 'out', cell: window.__neon().game.board.door, dir: 0, t: 0, timer: 0 }); window.__neon().game.heroes[0].safe = 1e9; });
await put(fuse.from); await tap(['', 'KeyW', 'KeyD', 'KeyS', 'KeyA'][fuse.d]); await wait(400);
g = await game(); ok(g.fuseT > 0, 'running onto a fuse blows it');
ok(await page.evaluate(() => window.__neon().game.cicaks[0].mode === 'scared'), 'and the cicak out on the tubes panics');
await shot('8-fuse');
await page.evaluate(() => { const g = window.__neon().game, h = g.heroes[0], c = g.cicaks[0]; Object.assign(c, { cell: h.cell, dir: h.dir, t: h.t }); });
await wait(200); g = await game();
const tailsEaten = await page.evaluate(() => window.__neon().game.st.tails);
ok(g.catches === 1 && g.tails + tailsEaten === 1, `catching the panicked cicak scores and drops its tail (${JSON.stringify({ c: g.catches, t: g.tails, e: tailsEaten, f: g.fuseT })})`);
ok(await page.evaluate(() => window.__neon().game.cicaks[0].mode === 'stub'), 'the caught cicak runs home as a stub');
await shot('9-catch');
await page.evaluate(() => { window.__neon().game.heroes[0].safe = 0; });

// ── lights out, the card between nights, and the save
await page.evaluate(() => { const g = window.__neon().game; for (const c of g.board.tubes) if (g.spark[c]) { g.spark[c] = 0; g.left[g.board.circuit[c]]--; g.sparksLeft--; } });
ok(await until(async () => (await st()).screen === 'next'), 'putting the whole sign out brings up the lights-out card');
ok((await page.locator('.nl-card h2').textContent()).includes('Lights out at Corner kopitiam'), 'the card names the night');
ok((await st()).save.reached === 1, 'the save opens night 2');
await readable('lights-out card'); await shot('10-next');
await tap('Enter'); await wait(300);
g = await game(); ok((await st()).screen === 'play' && g.night === 1, 'Enter goes on to night 2');
await page.evaluate(() => { const g = window.__neon().game; for (const c of g.board.tubes) if (g.spark[c]) { g.spark[c] = 0; g.left[g.board.circuit[c]]--; g.sparksLeft--; } });
ok(await until(async () => (await st()).screen === 'next'), 'night 2 put out');
await page.locator('.nl-card').click(); await wait(300);
ok((await game()).night === 2, 'a click on the card goes on too');
// the last night: jump the run to the crab sign and put it out
await page.evaluate(() => { const g = window.__neon().game; g.load(5); });
await playing();
await page.evaluate(() => { const g = window.__neon().game; for (const c of g.board.tubes) if (g.spark[c]) { g.spark[c] = 0; g.left[g.board.circuit[c]]--; g.sparksLeft--; } });
ok(await until(async () => (await st()).screen === 'next'), 'the last sign put out');
ok((await page.locator('.nl-press').textContent()).includes('see the run'), 'the last card offers the run');
await tap('Enter'); await wait(400);
ok((await st()).screen === 'results' && (await page.locator('.nl-card h2').textContent()).includes('Every sign'), 'the run is won');
ok((await st()).save.reached === 5 && (await st()).save.best > 0, 'the save keeps every night and the best score');
await readable('win'); await shot('11-win');

// ── caught: out of lives, and R to run again
await tap('Enter'); await wait(250);
ok(await page.locator('.nl-night.locked').count() === 0, 'every night is open now');
await page.locator('[data-night="3"]').click(); await wait(200); ok((await st()).screen === 'brief' && (await st()).sel === 3, 'a reached night can be started');
await tap('Enter'); await playing();
await page.evaluate(() => { const g = window.__neon().game, h = g.heroes[0]; g.lives = 1; h.safe = 0; Object.assign(g.cicaks[0], { mode: 'out', cell: h.cell, dir: h.dir, t: h.t, timer: 0 }); });
ok(await until(async () => (await st()).screen === 'results', 9000), 'caught on the last life ends the run');
ok((await page.locator('.nl-card h2').textContent()).includes('Caught at Kwong Satay'), 'the results say where');
await readable('caught'); await shot('12-caught');
await tap('KeyR'); await wait(400); g = await game();
ok((await st()).screen === 'play' && g.night === 3 && g.score === 0, 'R runs it again from the same night');
await tap('Escape'); await wait(150); await tap('KeyR'); await wait(400);
ok((await st()).screen === 'play' && !(await st()).paused, 'R from pause starts the run again');

// ── two players
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300); await tap('Escape'); await wait(200);
await page.locator('[data-opt="players"]').click(); await wait(150);
await page.locator('[data-night="0"]').click(); await wait(200);
ok((await page.locator('.nl-card').textContent()).includes('Two players share'), 'the brief tells two players they share the lives');
await tap('Enter'); await playing(); await quiet();
g = await game(); ok(g.heroes.length === 2 && g.heroes[1].id === 'enzo', 'Enzo joins as player two');
ok(g.heroes[0].cell !== g.heroes[1].cell, 'each starts on their own side of the sign');
await tap('KeyD'); await wait(60); await tap('ArrowLeft'); await wait(60); g = await game();
ok(g.heroes[0].wish === 2 && g.heroes[1].wish === 4, 'WASD steer Dora and the arrows steer Enzo');
await tap('KeyQ'); await wait(100); ok((await game()).heroes[0].id === 'dora', 'Q does not swap with two players');
await wait(600); await painted('two-player'); await shot('13-two');

ok(errors.length === 0, `no page errors: ${errors.join(' | ')}`);
await browser.close();
console.log(`PASS neon-lane e2e: ${checks} checks`);
