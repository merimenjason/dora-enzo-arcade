// Moth Hoop in the browser, muted, with real keys at 1536×900: the title; the six kits (a locked kit stays shut, the
// arrows walk the grid, every option button and the 2 key); the brief and back; then in a quiet hoop every solo key (A D
// and the arrows to move, Space, W, Up and K to throw, Q to swap who sews), pause and resume on Esc and P, player two
// joining on Enter and their keys (arrows to move, Up and Enter to throw) while A D stay with player one; R from pause to
// start again and Q from pause back to the kits; a won kit, its results card, the save under moth-hoop-v1 opening kit 2
// and Enter going on to its brief; a lost kit and R to sew it again. Fails on any page error, a blank canvas, sideways
// scroll or card text under 4.5:1 contrast. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves
// screenshots.
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
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/moth-${n}.png` }); };
const st = () => page.evaluate(() => { const s = window.__moth(); return { screen: s.screen, paused: s.paused, twoP: s.twoP, sel: s.sel, save: s.save }; });
const game = () => page.evaluate(() => { const g = window.__moth().game; if (!g) return null; return { hoop: g.hoop, over: g.over, why: g.why, done: g.done, needles: g.needles.map((n) => n.by), heroes: g.heroes.map((h) => ({ id: h.id, ctrl: h.ctrl, x: h.x })), time: g.time, spools: g.spools }; });
const tap = async (key, ms = 70) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
/** every line of text on the open cards reads at 4.5:1 or better against what it sits on; app/globals.css paints bare
 *  `p` a pale grey, so the cards set their colours explicitly */
const readable = async (where) => {
  const bad = await page.evaluate(() => {
    const px = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.99) return c.slice(0, 3); } return [29, 19, 12]; };
    const out = [];
    for (const el of document.querySelectorAll('.mh-card, .mh-card *, .mh-press, .mh-back, .mh-load *')) {
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
  const n = await page.evaluate(() => { const c = document.querySelector('.mh-cv'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4); return seen.size; });
  ok(n > 60, `the ${where} canvas is painted (${n} colours)`);
};
/** nothing arrives and the field is empty */
const quiet = () => page.evaluate(() => { const g = window.__moth().game; g.spawnT = 1e9; g.queenSpawned = true; g.foes = []; g.drops = []; });
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };

// ── title
await page.goto(`${base}/moth-hoop`, { waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await page.evaluate(() => localStorage.removeItem('moth-hoop-v1'));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await wait(1200);
ok((await st()).screen === 'title', 'opens on the title');
ok(await page.locator('.mh-title img').evaluate((i) => i.complete && i.naturalWidth > 0), 'the title art loads');
await painted('title attract');
await readable('title'); await noScroll('the title'); await shot('1-title');

// ── the kits
await tap('Enter'); await wait(300);
ok((await st()).screen === 'hoops', 'Enter opens the kits');
ok(await page.locator('.mh-hoop').count() === 6, 'six kits on the table');
ok(await page.locator('.mh-hoop.locked').count() === 5, 'only the first kit is open on a fresh save');
ok(await page.locator('.mh-hoop .frame img').count() === 6, 'every kit shows its printed picture');
await readable('kits'); await noScroll('the kits'); await shot('2-kits');
await page.locator('[data-hoop="1"]').click({ force: true }); await wait(200);
ok((await st()).screen === 'hoops', 'a locked kit stays shut');
await tap('ArrowLeft'); await tap('ArrowRight'); await wait(100); ok((await st()).sel === 1, 'Right moves along the kits');
await tap('ArrowDown'); await wait(100); ok((await st()).sel === 4, 'Down drops a row');
await tap('KeyW'); await tap('KeyA'); await wait(100); ok((await st()).sel === 0, 'W and A walk back');
await tap('KeyD'); await tap('KeyS'); await wait(100); ok((await st()).sel === 4, 'D and S walk on'); await tap('ArrowUp'); await tap('ArrowLeft');
for (const [opt, key] of [['assist', 'assist'], ['music', 'music'], ['sound', 'sound']]) {
  const before = (await st()).save[key];
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
  ok((await st()).save[key] === !before, `the ${opt} button toggles`);
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('moth-hoop-v1')))[key] === !before, `${opt} is saved`);
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
}
await page.locator('[data-opt="sewer"]').click(); await wait(150); ok((await st()).save.sewer === 'enzo', 'the sewing button picks Enzo');
await page.locator('[data-opt="sewer"]').click(); await wait(150); ok((await st()).save.sewer === 'dora', 'and back to Dora');
await page.locator('[data-opt="players"]').click(); await wait(150); ok((await st()).twoP, 'the players button picks two');
await tap('Digit2'); await wait(150); ok(!(await st()).twoP, 'the 2 key switches back to one');
await tap('Escape'); await wait(200); ok((await st()).screen === 'title', 'Esc goes back to the title');
await tap('Space'); await wait(200); ok((await st()).screen === 'hoops', 'Space opens the kits too');

// ── the brief
await tap('Enter'); await wait(250);
ok((await st()).screen === 'brief', 'Enter opens the brief for the open kit');
ok(await page.locator('.mh-preview').count() === 1, 'the brief shows the printed kit');
await readable('brief'); await shot('3-brief');
await tap('Escape'); await wait(200); ok((await st()).screen === 'hoops', 'Esc leaves the brief');
await tap('Enter'); await wait(200); await tap('Enter'); await wait(400);
ok((await st()).screen === 'play', 'Enter on the brief starts the kit');
// a held Enter auto-repeats: the repeat must not also bring in player two
await page.evaluate(() => { for (let i = 0; i < 3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true })); });
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter' })));
await wait(150); ok(!(await st()).twoP, 'a held Enter on the brief starts the kit and nothing more');
await wait(1500); await painted('hoop'); await shot('4-hoop');

// ── solo keys
await quiet();
let g = await game(); const x0 = g.heroes[0].x;
await hold('KeyD', 300); g = await game(); ok(g.heroes[0].x > x0 + 4, 'D moves right');
const x1 = g.heroes[0].x; await hold('KeyA', 300); g = await game(); ok(g.heroes[0].x < x1 - 4, 'A moves left');
const x2 = g.heroes[0].x; await hold('ArrowRight', 300); g = await game(); ok(g.heroes[0].x > x2 + 4, 'Right moves right in solo');
const x3 = g.heroes[0].x; await hold('ArrowLeft', 300); g = await game(); ok(g.heroes[0].x < x3 - 4, 'Left moves left in solo');
ok(g.heroes[1].ctrl === 'ride' && g.heroes[1].x === g.heroes[0].x, 'the other chinchilla rides the same reel');
for (const key of ['Space', 'KeyW', 'ArrowUp', 'KeyK']) {
  await page.evaluate(() => { window.__moth().game.needles = []; });
  await page.keyboard.down(key); await until(async () => (await game()).needles.length > 0, 2000); g = await game(); await page.keyboard.up(key);
  ok(g.needles.length > 0, `${key} throws a needle`);
}
const d0 = (await game()).done;
await page.evaluate(() => { const g = window.__moth().game, h = g.heroes.find((v) => v.ctrl === 'p1'); h.x = 64; });
await hold('Space', 900); await wait(300);
ok((await game()).done > d0, 'needles stitch the picture');
await tap('KeyQ'); await wait(150); g = await game();
ok(g.heroes.find((h) => h.ctrl === 'p1').id === 'enzo', 'Q hands the needle to Enzo');
ok((await st()).save.sewer === 'enzo', 'and remembers who sews');
await tap('KeyQ'); await wait(150); ok((await game()).heroes.find((h) => h.ctrl === 'p1').id === 'dora', 'Q swaps back');

// ── pause
await tap('Escape'); await wait(200); ok((await st()).paused, 'Esc pauses');
const t0 = (await game()).time; await wait(400); ok((await game()).time === t0, 'the hoop stops while paused');
await readable('pause'); await shot('5-pause');
await tap('Escape'); await wait(200); ok(!(await st()).paused, 'Esc resumes');
await tap('KeyP'); await wait(200); ok((await st()).paused, 'P pauses');
await tap('KeyP'); await wait(200); ok(!(await st()).paused, 'P resumes');

// ── player two, with Enzo sewing so the names follow whoever is player one
await tap('KeyQ'); await wait(150);
await quiet();
const before = (await game()).heroes.find((h) => h.ctrl === 'p1');
ok(before.id === 'enzo', 'Enzo sews');
await page.keyboard.down('ArrowRight'); await wait(150);
await tap('Enter'); await wait(150);
await page.keyboard.up('ArrowRight');
ok((await st()).twoP, 'Enter brings in player two'); g = await game();
const p2 = g.heroes.find((h) => h.ctrl === 'p2'); ok(p2 && p2.id === 'dora', 'Dora gets the second reel when Enzo sews');
ok(await page.evaluate(() => window.__moth().scene.hint.startsWith('Enzo: A D')), 'the hint names Enzo as player one');
const held = (await game()).heroes.find((h) => h.ctrl === 'p1').x; await wait(400);
ok((await game()).heroes.find((h) => h.ctrl === 'p1').x === held, 'an arrow held through the join does not stick');
await quiet();
const a0 = (await game()).heroes.find((h) => h.ctrl === 'p1').x, b0 = (await game()).heroes.find((h) => h.ctrl === 'p2').x;
await hold('ArrowLeft', 300); g = await game();
ok(g.heroes.find((h) => h.ctrl === 'p2').x < b0 - 4 && g.heroes.find((h) => h.ctrl === 'p1').x === a0, 'the arrows move player two only');
await hold('KeyD', 300); g = await game(); ok(g.heroes.find((h) => h.ctrl === 'p1').x > a0 + 4, 'D still moves player one');
const b1 = g.heroes.find((h) => h.ctrl === 'p2').x; await hold('ArrowRight', 300); g = await game(); ok(g.heroes.find((h) => h.ctrl === 'p2').x > b1 + 4, 'Right moves player two');
for (const key of ['ArrowUp', 'Enter']) {
  await page.evaluate(() => { window.__moth().game.needles = []; });
  await page.keyboard.down(key); await until(async () => (await game()).needles.length > 0, 2000); g = await game(); await page.keyboard.up(key);
  ok(g.needles.includes('dora') && !g.needles.includes('enzo'), `${key} throws for player two`);
}
await page.evaluate(() => { window.__moth().game.needles = []; });
await page.keyboard.down('Space'); await until(async () => (await game()).needles.length > 0, 2000); g = await game(); await page.keyboard.up('Space');
ok(g.needles.includes('enzo') && !g.needles.includes('dora'), 'Space throws for player one');
await tap('Escape'); await wait(150);
ok((await page.locator('.mh-card .keys').textContent()).startsWith('Enzo: A D'), 'the pause card names the players right'); await tap('Escape');
await shot('6-two');

// ── restart and quit from pause
await tap('Escape'); await wait(150); await tap('KeyR'); await wait(400);
g = await game(); ok((await st()).screen === 'play' && !(await st()).paused && g.time < 1 && g.done === 0, 'R from pause starts the kit again');
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
ok((await st()).screen === 'hoops', 'Q from pause goes back to the kits');
if ((await st()).twoP) await tap('Digit2');
await wait(150); ok(!(await st()).twoP, 'back to one player');

// ── win kit 1
await tap('Enter'); await wait(200); await tap('Enter'); await wait(500);
await quiet();
await page.evaluate(() => { const g = window.__moth().game; g.done = g.total; });
ok(await until(async () => (await st()).screen === 'results', 9000), 'a finished kit shows the results');
ok((await page.locator('.mh-card h2').textContent()).includes('Finished'), 'the card says Finished');
ok(await page.locator('.mh-card .stars').count() === 1, 'with its stars');
await readable('results'); await noScroll('the results'); await shot('7-won');
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('moth-hoop-v1')));
ok(saved.v === 1 && saved.stars[0] > 0 && saved.best[0] > 0, 'the win is saved under moth-hoop-v1');
await tap('Enter'); await wait(300);
ok((await st()).screen === 'brief' && (await st()).sel === 1, 'Enter goes on to the next kit\'s brief');
await tap('Escape'); await wait(300);
ok(await page.locator('[data-hoop="1"].locked').count() === 0, 'kit 2 is open now');

// ── lose kit 2, then R
await tap('Enter'); await wait(200); await tap('Enter'); await wait(500);
ok((await game()).hoop === 1, 'kit 2 starts');
await quiet(); await page.evaluate(() => { window.__moth().game.spools = 0; });
ok(await until(async () => (await st()).screen === 'results', 9000), 'a lost kit shows the results');
ok((await page.locator('.mh-card h2').textContent()).includes('Out of spools'), 'the card says why');
await readable('lost results'); await shot('8-lost');
await tap('KeyR'); await wait(400);
ok((await st()).screen === 'play' && (await game()).hoop === 1 && !(await game()).over, 'R sews the kit again');

// ── the back link
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
ok(await page.locator('.mh-back').getAttribute('href') === '/', 'the back link goes to the arcade');

ok(errors.length === 0, `no page errors: ${errors.slice(0, 3).join(' | ')}`);
console.log(`moth-hoop e2e: ${checks} checks passed`);
await browser.close();
