// Jade Street play-through for frame rate: a save with every district open, then minutes of play in each district,
// half of it in the rain with a busker's crowd gathered, every business stall bought and fully upgraded, and the
// third pass's effects firing (hit-stop, shake, painted debris, the heirloom slow-mo and zoom punch), and the fourth's
// (the partner following and riding behind, a gadget fired twice a second with its shots, splats, bursts and puddles),
// and the fifth's (gangs on the run, a festival, ticket wardens, storm flashes, the chope rush, speech bubbles), and
// the sixth's (the island's two districts, its trains overhead, the lizards and scooter wardens), the eighth's (a
// casing job with 43 guards hearing, wondering, chasing and searching),
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
const b = await chromium.launch({ args: ['--mute-audio'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
await p.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
// every job done but the last, so all thirteen districts (Chinatown's five, the island's two and the ninth pass's three, the twelfth's three) are open
await p.evaluate(() => localStorage.setItem('jade-street-v2', JSON.stringify({ v: 2, seed: 77, started: true, hero: 'dora', cash: 3000, done: Array.from({ length: 54 }, (_, i) => 'm' + (i + 1)), settings: { music: false } })));
await p.reload(); await p.waitForSelector('[data-testid="continue"]', { timeout: 120000 });
await p.click('[data-testid="continue"]');
await p.waitForFunction(() => !!window.__jade, null, { timeout: 30000 });
await p.waitForTimeout(1500);
// every stall owned at level 3, so the grandest stalls are drawn
await p.evaluate(() => { const s = window.__jade.world().s; for (const id of Object.keys(s.biz)) s.biz[id] = { ...s.biz[id], lvl: 3, bank: 200 }; });
// every gadget, with deep satchels, so shots, splats, bursts and puddles are drawn while the partner follows
await p.evaluate(() => { window.__jade.give(); const s = window.__jade.world().s; for (const g of s.gear.own) { s.gear.ammo[g] = 999; s.gear.lvl[g] = 2; } });

// GUARDS_ONLY=1 skips the districts and times only the eighth pass's crowd of guards
const DISTRICTS = process.env.GUARDS_ONLY ? [] : ['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong'];
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
        const spots = []; const CH = window.__jade.layout.NH, CW = w.c.ground.length / CH; /* the city's height in rows (the layout table's); W grows with each pass */ for (let ty = 1; ty < CH - 1; ty++) for (let tx = 1; tx < CW - 1; tx++) if (w.c.ground[ty * CW + tx] === 2 && w.c.solid[ty * CW + tx] === 0) spots.push([tx, ty]);
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
    // the fifth pass's streets: a gang on the run, a festival, a ticket warden, a storm flash, the chope rush
    if (k % 15 === 3) await p.evaluate(k => { const J = window.__jade, w = J.world(); J.gang(['otters', 'macaques', 'lizards', 'mynahs'][k % 4]); w.s.night = k; J.fest(['lion', 'lantern', 'getai'][k % 3], 260); J.warden(200, 80); w.sg.flash = 0.35; w.sg.rushT = 0; }, k);
    if (k % 30 === 25) await p.evaluate(() => { const w = window.__jade.world(); w.swapJacket(); w.p.act = null; });
    // a crash, a smashed stall and an heirloom: debris, shake, hit-stop, slow-mo and the zoom punch
    if (k % 10 === 5) await p.evaluate(k => { const w = window.__jade.world(), x = w.p.x, y = w.p.y; w.fx.push({ t: 'impact', x, y, k: 1, kind: 'fruit' }, { t: 'smash', x: x + 40, y, k: 1 }); if (k % 20 === 5) w.fx.push({ t: 'loot', x, y, kind: 'heirloom' }); }, k);
    if (held) await p.keyboard.up(held);
    held = keys[(k * 3 + Math.floor(k / 4)) % 4]; await p.keyboard.down(held);
    await p.waitForTimeout(250);
    await p.keyboard.press(k % 3 === 0 ? ' ' : k % 3 === 1 ? 'q' : 'Shift');
    // fire a gadget toward a point ahead (the passenger fires when riding), swapping gadgets now and then
    await p.mouse.click(640 + ((k * 137) % 400) - 200, 400 + ((k * 71) % 300) - 150); if (k % 5 === 0) await p.keyboard.press(k % 10 ? '1' : '2');
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
// the eighth pass: a casing job with forty-odd extra guards on patrol, hearing the dashes and hops, turning, walking
// over to look, chasing and searching, their torches and bubbles all drawn, while the partner warns and fires
{
  const t0 = Date.now(), dur = Math.min(MS, 60000); let k = 0;
  await p.evaluate(() => {
    const J = window.__jade, w = J.world(); w.talk = null; w.ui = null; if (w.run) w.quitJob(); if (w.p.ride) w.exit();
    J.start('m17'); const r = w.run, i = r.m.steps.findIndex(s => s.t === 'case'); r.snap = r.snapshot(i); r.enter(i); w.talk = null; w.s.settings.assist = true;
    const g0 = r.actors.find(a => a.kind === 'guard');
    for (let n = 0; n < 40; n++) { const a = r.actor('guard', g0.b.x + ((n % 8) - 4) * 110, g0.b.y + (Math.floor(n / 8) - 2) * 110, 'fly', g0.route, 46); r.actors.push(a); }
    window.__g0 = [g0.b.x, g0.b.y]; w.placePlayer(g0.b.x + 520, g0.b.y);
    window.__jade.play.fpsLog.length = 0; window.__jade.play.paused = false; window.__jade.play.bump();
  });
  while (Date.now() - t0 < dur) {
    // stay out of the torches mostly (a failed job would end the test early), with a dash or a hop for them to hear
    await p.evaluate(k => { const w = window.__jade.world(); if (w.failed) { w.failed = null; w.ui = null; window.__jade.play.paused = false; } const r = w.run; if (r?.meter) r.meter.v = 0; for (const a of r?.actors ?? []) if (a.mind) a.mind.pinned = 0;
      // back to the edge of the crowd of guards every few seconds, so they keep hearing, looking, chasing and searching
      if (k % 8 === 0 && window.__g0) { const [x, y] = window.__g0; w.placePlayer(x + 380 + (k % 3) * 80, y + ((k % 5) - 2) * 90); }
      if (k % 6 === 3) { const c = {}; for (const a of r?.actors ?? []) if (a.mind) c[a.mind.st] = (c[a.mind.st] ?? 0) + 1; window.__mindLog = window.__mindLog ?? {}; for (const [st, v] of Object.entries(c)) window.__mindLog[st] = Math.max(window.__mindLog[st] ?? 0, v); } }, k);
    const kk = keys[k % 4]; await p.keyboard.down(kk); await p.waitForTimeout(200); await p.keyboard.press(k % 2 ? ' ' : 'q'); await p.waitForTimeout(200); await p.keyboard.up(kk);
    k++;
  }
  const log = await p.evaluate(() => window.__jade.fpsLog());
  const s = log.slice(2); const avg = s.reduce((a, x) => a + x, 0) / Math.max(1, s.length); const lo = Math.min(...s);
  const sorted = [...s].sort((a, b) => a - b); const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? lo;
  const minds = await p.evaluate(() => JSON.stringify(window.__mindLog ?? {}));
  rows.push({ d: 'guards', avg, p5, lo, n: s.length });
  console.log(`guards  ${(dur / 60000).toFixed(1)} min  avg ${avg.toFixed(1)} fps  5th percentile ${p5.toFixed(1)}  lowest half-second ${lo.toFixed(1)}  (most guards in each state at once: ${minds})`);
}
await b.close();
const slow = rows.filter(r => r.avg < 55);
if (errs.length) console.log('page errors:', errs.slice(0, 5));
console.log(slow.length || errs.length ? 'jade street play-through: FAILED' : 'jade street play-through: ok');
if (slow.length || errs.length) process.exit(1);
