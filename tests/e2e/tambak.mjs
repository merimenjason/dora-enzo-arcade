// Tambak in the browser, muted, with real keys at 1536×900: the title; the six sites (a locked site stays shut, the
// arrows and WASD walk the grid, every option button and the 2 key); the brief and back; then in a quiet sea every solo
// key (W A S D and the arrows walk, a step into the sea pours and a step back claims, Q swaps who pours), the newest held
// key winning, pause and resume on Esc and P with its options, a held Enter on the brief not bringing in player two,
// player two joining on Enter and their keys (the arrows) while WASD stay with player one; R from pause to start again
// and Q from pause back to the sites; a site won by holding W across the sea, its results card, the save under
// tambak-v1 opening site 2 and Enter going on to its brief; a site lost to the creatures and R to pour it again. Fails
// on any page error, a blank canvas, sideways scroll or card text under 4.5:1 contrast. Needs `npm run dev` (or
// BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
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
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/tambak-${n}.png` }); };
const st = () => page.evaluate(() => { const s = window.__tambak(); return { screen: s.screen, paused: s.paused, twoP: s.twoP, sel: s.sel, save: s.save }; });
const game = () => page.evaluate(() => {
  const g = window.__tambak().game; if (!g) return null;
  return { site: g.site, over: g.over, why: g.why, t: g.t, pct: g.pct, land: g.land, buckets: g.buckets, heroes: g.heroes.map((h) => ({ id: h.id, ctrl: h.ctrl, x: h.x, y: h.y, trail: h.trail.length })) };
});
const hero = (g, ctrl) => g.heroes.find((h) => h.ctrl === ctrl);
const tap = async (key, ms = 70) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const hold = async (key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
/** every line of text on the open cards reads at 4.5:1 or better against what it sits on; app/globals.css paints bare
 *  `p` a pale grey, so the cards set their colours explicitly */
const readable = async (where) => {
  const bad = await page.evaluate(() => {
    const px = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el) => { for (let n = el; n; n = n.parentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c.length === 3 || c[3] > 0.99) return c.slice(0, 3); } return [26, 18, 12]; };
    const out = [];
    for (const el of document.querySelectorAll('.tb-card, .tb-card *, .tb-press, .tb-back, .tb-load *')) {
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
  const n = await page.evaluate(() => { const c = document.querySelector('.tb-cv'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4); return seen.size; });
  ok(n > 60, `the ${where} canvas is painted (${n} colours)`);
};
/** the HUD strip along the top: its text colours against the wood, sampled from the canvas, read at 4.5:1 */
const hudReadable = async () => {
  const cr = await page.evaluate(() => {
    const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const c = document.querySelector('.tb-cv'), x = c.getContext('2d'), h = Math.round(c.height * 64 / 864);
    const d = x.getImageData(0, 0, c.width, h).data; const ls = [];
    for (let i = 0; i < d.length; i += 4) ls.push(lum([d[i], d[i + 1], d[i + 2]]));
    ls.sort((a, b) => a - b);
    // the wood is the dark majority, the lettering the bright few
    const bg = ls[Math.floor(ls.length * 0.4)], fg = ls[Math.floor(ls.length * 0.995)];
    return (fg + 0.05) / (bg + 0.05);
  });
  ok(cr >= 4.5, `the HUD lettering reads on its wood (${cr.toFixed(2)}:1)`);
};
/** a calm sea for the key tests: one jellyfish held still in the far top corner (so a claim fills only what it closes
 *  off, not the whole sea), no pickups, no blink */
const quiet = () => page.evaluate(() => {
  const g = window.__tambak().game; const f = g.foes[0];
  f.x = 88.5; f.y = 6.5; g.foes = [f]; g.moveFoes = () => {};
  g.picks = []; g.pickT = 1e9; g.crabbed = true; for (const h of g.heroes) h.blink = 0;
});
/** no creatures at all: then any line closed off fills the whole sea */
const empty = () => page.evaluate(() => { const g = window.__tambak().game; g.foes = []; g.picks = []; g.pickT = 1e9; g.crabbed = true; for (const h of g.heroes) h.blink = 0; });
const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(100); } return false; };

// ── title
await page.goto(`${base}/tambak`, { waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await page.evaluate(() => localStorage.removeItem('tambak-v1'));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('main[data-ready="true"]', { timeout: 120000 });
await wait(1500);
ok((await st()).screen === 'title', 'opens on the title');
ok(await page.locator('.tb-title img').evaluate((i) => i.complete && i.naturalWidth > 0), 'the title art loads');
ok(await page.locator('.tb-logo').evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++; return n > 2000; }), 'the sand lettering is poured');
await painted('title attract');
await readable('title'); await noScroll('the title'); await shot('1-title');

// ── the sites
await tap('Enter'); await wait(300);
ok((await st()).screen === 'sites', 'Enter opens the sites');
ok(await page.locator('.tb-site').count() === 6, 'six sites on the table');
ok(await page.locator('.tb-site.locked').count() === 5, 'only the first site is open on a fresh save');
ok(await page.locator('.tb-site .frame img').count() === 6, 'every site shows its sand picture');
await page.waitForFunction(() => [...document.querySelectorAll('.tb-site img')].every((i) => i.complete && i.naturalWidth > 0));
await readable('sites'); await noScroll('the sites'); await shot('2-sites');
await page.locator('[data-site="1"]').click({ force: true }); await wait(200);
ok((await st()).screen === 'sites', 'a locked site stays shut');
await tap('ArrowLeft'); await tap('ArrowRight'); await wait(100); ok((await st()).sel === 1, 'Right moves along the sites');
await tap('ArrowDown'); await wait(100); ok((await st()).sel === 4, 'Down drops a row');
await tap('KeyW'); await tap('KeyA'); await wait(100); ok((await st()).sel === 0, 'W and A walk back');
await tap('KeyD'); await tap('KeyS'); await wait(100); ok((await st()).sel === 4, 'D and S walk on');
await tap('Enter'); await wait(150); ok((await st()).screen === 'sites', 'Enter on a locked site does nothing');
await tap('ArrowUp'); await tap('ArrowLeft'); await wait(100); ok((await st()).sel === 0, 'Up and Left walk back');
for (const opt of ['assist', 'music', 'sound']) {
  const before = (await st()).save[opt];
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
  ok((await st()).save[opt] === !before, `the ${opt} button toggles`);
  ok(JSON.parse(await page.evaluate(() => localStorage.getItem('tambak-v1')))[opt] === !before, `${opt} is saved`);
  await page.locator(`[data-opt="${opt}"]`).click(); await wait(150);
}
await page.locator('[data-opt="lead"]').click(); await wait(150); ok((await st()).save.lead === 'enzo', 'the pouring button picks Enzo');
await page.locator('[data-opt="lead"]').click(); await wait(150); ok((await st()).save.lead === 'dora', 'and back to Dora');
await page.locator('[data-opt="players"]').click(); await wait(150); ok((await st()).twoP, 'the players button picks two');
await tap('Digit2'); await wait(150); ok(!(await st()).twoP, 'the 2 key switches back to one');
await tap('Escape'); await wait(200); ok((await st()).screen === 'title', 'Esc goes back to the title');
await tap('Space'); await wait(200); ok((await st()).screen === 'sites', 'Space opens the sites too');

// ── the brief
await tap('Enter'); await wait(250);
ok((await st()).screen === 'brief', 'Enter opens the brief for the open site');
ok(await page.locator('.tb-preview').count() === 1, 'the brief shows the sand picture to uncover');
ok((await page.locator('.tb-card').textContent()).includes('70%'), 'the brief gives the gentle-tides target');
await readable('brief'); await shot('3-brief');
await tap('Escape'); await wait(200); ok((await st()).screen === 'sites', 'Esc leaves the brief');
await page.locator('[data-site="0"]').click(); await wait(200); ok((await st()).screen === 'brief', 'clicking the open site opens its brief');
await page.keyboard.down('Enter'); await wait(400);
ok((await st()).screen === 'play', 'Enter on the brief starts the site');
// a held Enter auto-repeats: the repeat must not also bring in player two
await page.evaluate(() => { for (let i = 0; i < 3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', repeat: true })); });
await page.keyboard.up('Enter');
await wait(150); ok(!(await st()).twoP, 'a held Enter on the brief starts the site and nothing more');
await wait(2500); await painted('sea'); await hudReadable(); await shot('4-play');

// ── solo keys
await quiet();
let g = await game(); const p = hero(g, 'p1');
ok(p.y === 49 && p.x === 48, 'Dora starts on the middle of the bottom shore');
await hold('KeyA', 300); g = await game(); ok(hero(g, 'p1').x < p.x - 1 && hero(g, 'p1').trail === 0, 'A walks left along the shore without pouring');
let q = hero(g, 'p1'); await hold('KeyD', 300); g = await game(); ok(hero(g, 'p1').x > q.x + 1, 'D walks right');
q = hero(g, 'p1'); await hold('ArrowLeft', 300); g = await game(); ok(hero(g, 'p1').x < q.x - 1, 'Left walks left in solo');
q = hero(g, 'p1'); await hold('ArrowRight', 300); g = await game(); ok(hero(g, 'p1').x > q.x + 1, 'Right walks right in solo');
q = hero(g, 'p1'); await hold('KeyW', 480); g = await game();
ok(hero(g, 'p1').y < q.y - 2 && hero(g, 'p1').trail > 0, 'W walks up into the sea and pours a line');
await shot('5-pour');
const l0 = g.land; q = hero(g, 'p1'); await hold('KeyS', 120); g = await game();
ok(hero(g, 'p1').y === q.y, 'S does nothing back onto the line: it is a wall');
// newest key held wins: hold D, press W on top, W wins; let go of W and D takes over again
q = hero(g, 'p1');
await page.keyboard.down('KeyD'); await wait(150); await page.keyboard.down('KeyW'); await wait(250);
g = await game(); const mid = hero(g, 'p1'); ok(mid.y < q.y && mid.x > q.x, 'with D held, a pressed W wins');
await page.keyboard.up('KeyW'); await wait(250); g = await game(); ok(hero(g, 'p1').x > mid.x, 'letting go of W hands back to D');
await page.keyboard.up('KeyD');
// back down to the bottom shore: Left, then Down to land, and the box claims
await hold('ArrowDown', 900); await wait(800); g = await game();
ok(g.land > l0 && hero(g, 'p1').trail === 0 && !g.over, `stepping back onto land claims the sea it closed off (${g.land} cells)`);
await shot('6-claim');
await tap('KeyQ'); await wait(150); g = await game();
ok(hero(g, 'p1').id === 'enzo', 'Q hands the bucket to Enzo');
ok((await st()).save.lead === 'enzo', 'and remembers who pours');
await tap('KeyQ'); await wait(150); ok(hero(await game(), 'p1').id === 'dora', 'Q swaps back');

// ── pause
await tap('Escape'); await wait(200); ok((await st()).paused, 'Esc pauses');
const t0 = (await game()).t; await wait(400); ok((await game()).t === t0, 'the tide stops while paused');
ok(await page.locator('.tb-card [data-opt]').count() === 3, 'the pause card has its options');
await readable('pause'); await shot('7-pause');
await tap('Escape'); await wait(200); ok(!(await st()).paused, 'Esc resumes');
await tap('KeyP'); await wait(200); ok((await st()).paused, 'P pauses');
await tap('KeyP'); await wait(200); ok(!(await st()).paused, 'P resumes');

// ── player two, with Enzo pouring so the names follow whoever is player one
await tap('KeyQ'); await wait(150);
await quiet();
ok(hero(await game(), 'p1').id === 'enzo', 'Enzo pours');
await page.keyboard.down('ArrowRight'); await wait(150);
await tap('Enter'); await wait(150);
await page.keyboard.up('ArrowRight');
ok((await st()).twoP, 'Enter brings in player two'); g = await game();
const p2 = hero(g, 'p2'); ok(p2 && p2.id === 'dora' && p2.y === 0, 'Dora joins on the top shore when Enzo pours');
ok(await page.evaluate(() => window.__tambak().scene.hint.startsWith('Enzo: WASD')), 'the hint names Enzo as player one');
const held = hero(await game(), 'p1').x; await wait(400);
ok(hero(await game(), 'p1').x === held, 'an arrow held through the join does not stick');
await quiet();
g = await game(); const a0 = hero(g, 'p1'), b0 = hero(g, 'p2');
await hold('ArrowLeft', 300); g = await game();
ok(hero(g, 'p2').x < b0.x - 1 && hero(g, 'p1').x === a0.x, 'the arrows move player two only');
await hold('KeyD', 300); g = await game(); ok(hero(g, 'p1').x > a0.x + 1 && hero(g, 'p2').x < b0.x, 'D still moves player one');
let b1 = hero(g, 'p2'); await hold('ArrowRight', 300); g = await game(); ok(hero(g, 'p2').x > b1.x + 1, 'Right moves player two');
b1 = hero(g, 'p2'); await hold('ArrowDown', 300); g = await game(); ok(hero(g, 'p2').y > b1.y + 1 && hero(g, 'p2').trail > 0, 'Down pours for player two');
b1 = hero(g, 'p2'); await hold('ArrowLeft', 200); g = await game(); ok(hero(g, 'p2').x < b1.x, 'Left turns player two in the sea');
b1 = hero(g, 'p2'); await hold('ArrowUp', 800); g = await game(); ok(hero(g, 'p2').y < b1.y && hero(g, 'p2').trail === 0, 'Up takes player two home and claims');
const a1 = hero(g, 'p1'); await hold('KeyW', 300); g = await game(); ok(hero(g, 'p1').y < a1.y, 'W moves player one');
const a2 = hero(g, 'p1'); await hold('KeyA', 200); g = await game(); ok(hero(g, 'p1').x < a2.x, 'A moves player one');
await hold('KeyS', 800);
await tap('Escape'); await wait(150);
ok((await page.locator('.tb-card .keys').textContent()).startsWith('Enzo: WASD'), 'the pause card names the players right'); await tap('Escape');
await shot('8-two');

// ── restart and quit from pause
await tap('Escape'); await wait(150); await tap('KeyR'); await wait(400);
g = await game(); ok((await st()).screen === 'play' && !(await st()).paused && g.t < 1 && g.land === 0, 'R from pause starts the site again');
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
ok((await st()).screen === 'sites', 'Q from pause goes back to the sites');
if ((await st()).twoP) await tap('Digit2');
await wait(150); ok(!(await st()).twoP, 'back to one player');
await page.locator('[data-opt="lead"]').click(); await wait(100); ok((await st()).save.lead === 'dora', 'Dora pours again');

// ── win site 1 with real keys: in a calm sea, one line straight across the bay fills it all
await tap('Enter'); await wait(200); await tap('Enter'); await wait(500);
await empty();
await hold('KeyW', 4800);
ok(await until(async () => (await game()).over === 'win', 3000), 'a line poured across the bay with W wins the site');
await wait(600); await shot('9-win-field');
ok(await until(async () => (await st()).screen === 'results', 9000), 'a won site shows the results');
ok((await page.locator('.tb-card h2').textContent()).includes('is land'), 'the card says the site is land');
ok(await page.locator('.tb-card .stars').count() === 1, 'with its stars');
await page.waitForFunction(() => { const i = document.querySelector('.tb-preview'); return i && i.complete && i.naturalWidth > 0; });
await readable('results'); await noScroll('the results'); await shot('10-won');
const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('tambak-v1')));
ok(saved.v === 1 && saved.stars[0] > 0 && saved.best[0] > 0, 'the win is saved under tambak-v1');
await tap('Enter'); await wait(300);
ok((await st()).screen === 'brief' && (await st()).sel === 1, 'Enter goes on to the next site\'s brief');
await tap('Escape'); await wait(300);
ok(await page.locator('[data-site="1"].locked').count() === 0, 'site 2 is open now');
await shot('11-sites-after');

// ── lose site 2 to the creatures, then R
await tap('Enter'); await wait(200); await tap('Enter'); await wait(500);
ok((await game()).site === 1, 'site 2 starts');
await page.evaluate(() => { const g = window.__tambak().game; g.buckets = 1; g.heroes[0].blink = 0; });
// pour straight up into the bay and park a jellyfish on the line
await hold('KeyW', 500);
await page.evaluate(() => { const g = window.__tambak().game, h = g.heroes[0], c = h.trail[1]; const f = g.foes[0]; f.x = (c % 96) + 0.5; f.y = Math.floor(c / 96) + 0.5; });
ok(await until(async () => (await game()).over === 'lose', 3000), 'a creature on the line with the last bucket loses the site');
ok(await until(async () => (await st()).screen === 'results', 9000), 'a lost site shows the results');
ok((await page.locator('.tb-card h2').textContent()).includes('Out of sand buckets'), 'the card says why');
await readable('lost results'); await shot('12-lost');
await tap('KeyR'); await wait(400);
ok((await st()).screen === 'play' && (await game()).site === 1 && !(await game()).over, 'R pours the site again');

// ── the back link
await tap('Escape'); await wait(150); await tap('KeyQ'); await wait(300);
ok(await page.locator('.tb-back').getAttribute('href') === '/', 'the back link goes to the arcade');

ok(errors.length === 0, `no page errors: ${errors.slice(0, 3).join(' | ')}`);
console.log(`tambak e2e: ${checks} checks passed`);
await browser.close();
