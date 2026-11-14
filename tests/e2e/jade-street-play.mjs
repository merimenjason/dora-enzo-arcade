// Jade Street play-through for frame rate: a save with every district open, then minutes of play in each district,
// half of it in the rain with a busker's crowd gathered,
// at 1280×800 with real keys: running, dashing and hopping on foot, riding a scooter with boosts, a spell of five-lantern
// heat (wardens, roadblocks and the blimp) and a jump to fresh streets every few seconds. Logs the frame rate per
// district and fails when any district averages under 55 fps, or on a page error. Needs `npm run dev` (or BASE_URL)
// and Playwright. MINUTES=<n> sets the time per district (default 2); SHOTS=<dir> saves a few screenshots of each.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/jade-street';
const MS = (+(process.env.MINUTES ?? 2)) * 60000;
const SHOTS = process.env.SHOTS; // a screenshot of each district, on foot and riding, when set
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
// every job done but the last, so all five districts are open
await p.evaluate(() => localStorage.setItem('jade-street-v2', JSON.stringify({ v: 2, seed: 77, started: true, hero: 'dora', cash: 3000, done: Array.from({ length: 24 }, (_, i) => 'm' + (i + 1)), settings: { music: false } })));
await p.reload(); await p.waitForSelector('[data-testid="continue"]', { timeout: 120000 });
await p.click('[data-testid="continue"]');
await p.waitForFunction(() => !!window.__jade, null, { timeout: 30000 });
await p.waitForTimeout(1500);

const DISTRICTS = ['market', 'temple', 'canal', 'docks', 'arcade'];
const keys = ['w', 'a', 's', 'd'];
const rows = [];
for (const d of DISTRICTS) {
  const t0 = Date.now(); let k = 0, held = null, rode = false;
  await p.evaluate(() => { window.__jade.play.fpsLog.length = 0; });
  while (Date.now() - t0 < MS) {
    const phase = Math.floor((Date.now() - t0) / 6000);
    if (k % 12 === 0) {
      // a fresh open street in this district, on foot or on a scooter
      rode = phase % 2 === 1;
      await p.evaluate(([d, k, rode]) => {
        const w = window.__jade.world(); w.talk = null; w.ui = null; if (w.run) w.quitJob(); if (w.p.ride) w.exit();
        const spots = []; for (let ty = 1; ty < 91; ty++) for (let tx = 1; tx < 119; tx++) if (w.c.ground[ty * 120 + tx] === 2 && w.c.solid[ty * 120 + tx] === 0) spots.push([tx, ty]);
        const mine = spots.filter(([tx, ty]) => window.__jade.district(tx, ty) === d);
        const [tx, ty] = mine[(k * 7919) % mine.length];
        window.__jade.teleport(tx, ty);
        if (rode) { const r = w.addRide('scooter', tx * 64 + 32, ty * 64 + 32, 0, false, 0, true); w.p.act = null; w.p.ride = r; r.parked = false; }
        window.__jade.play.paused = false; window.__jade.play.bump();
      }, [d, k + DISTRICTS.indexOf(d) * 1000, rode]);
    }
    // rain half the time, and a street event drawing a crowd, so the busiest city is what gets timed
    if (k % 12 === 1) await p.evaluate(rain => { window.__jade.rain(rain ? 1 : null); window.__jade.event('busker', true); }, phase % 2 === 0);
    if (k % 30 === 10) await p.evaluate(() => window.__jade.heat(4.6));
    if (k % 30 === 25) await p.evaluate(() => { const w = window.__jade.world(); w.swapJacket(); w.p.act = null; });
    if (held) await p.keyboard.up(held);
    held = keys[(k * 3 + Math.floor(k / 4)) % 4]; await p.keyboard.down(held);
    await p.waitForTimeout(250);
    await p.keyboard.press(k % 3 === 0 ? ' ' : k % 3 === 1 ? 'q' : 'Shift');
    await p.waitForTimeout(250);
    if (SHOTS && (k === 8 || k === 20 || k === 33)) await p.screenshot({ path: `${SHOTS}/play-${d}-${k}.png` });
    k++;
  }
  if (held) await p.keyboard.up(held);
  const log = await p.evaluate(() => window.__jade.fpsLog());
  const s = log.slice(2); const avg = s.reduce((a, x) => a + x, 0) / Math.max(1, s.length); const lo = Math.min(...s);
  const sorted = [...s].sort((a, b) => a - b); const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? lo;
  rows.push({ d, avg, p5, lo, n: s.length });
  console.log(`${d.padEnd(7)} ${(MS / 60000).toFixed(1)} min  avg ${avg.toFixed(1)} fps  5th percentile ${p5.toFixed(1)}  lowest half-second ${lo.toFixed(1)}`);
}
await b.close();
const slow = rows.filter(r => r.avg < 55);
if (errs.length) console.log('page errors:', errs.slice(0, 5));
console.log(slow.length || errs.length ? 'jade street play-through: FAILED' : 'jade street play-through: ok');
if (slow.length || errs.length) process.exit(1);
