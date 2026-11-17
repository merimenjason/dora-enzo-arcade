// Jade Street memory soak: a save with every district open, then MINUTES (default 10) of play hopping between all
// thirteen districts every 20 seconds (walking, dashing, riding a scooter, street events, rain, gadgets fired), with a
// sample every 15 seconds of the browser's resident memory (every process of the Playwright browser, from `ps`), the
// JS heap (Chromium) and the game's own counts (window.__jade.art(): the paintings decoded and their decoded size, the
// ground chunks and their pixels, the recoloured frames). Fails on a page error or a crash, when the decoded paintings
// pass DECODED_MB (default 320: the game lets go down to 250 MB, ART_BUDGET in lib/jade-load.ts, every two seconds, and a spot's needs are decoded even over it, so it can sit a little above between checks; all of them come to about 360), the chunks pass 100 MB, the recoloured frames pass
// their cap, the glow sprites pass theirs (64), the DOM nodes (Chromium) keep piling up, or when the memory in the last third of the run is more than 30% above the middle third (a leak).
// PRESSURE=1 (Chromium): each sample also asks the browser to drop what it can (a simulated critical memory pressure)
// and reads the memory again (rssPressed). BROWSER=webkit runs it in WebKit. Needs `npm run dev` (or BASE_URL) and Playwright. LOG=<file> writes the samples as JSON.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire(process.cwd() + '/')('playwright'); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/jade-street';
const kind = process.env.BROWSER ?? 'chromium';
const MS = (+(process.env.MINUTES ?? 10)) * 60000;
const DECODED_MB = +(process.env.DECODED_MB ?? 320);
const b = await pw[kind].launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; let crashed = false;
p.on('pageerror', e => errs.push(e.message)); p.on('crash', () => { crashed = true; });
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

/** resident memory (MB) of this run's browser: every process under this script whose command line is Playwright's browser
 *  (so another browser running at the same time is not counted). WebKit's web content processes are started by the
 *  system rather than by the browser, so for WebKit it is every Playwright WebKit process (run one WebKit at a time) */
const rss = () => {
  const out = execSync('ps -A -o pid=,ppid=,rss=,command=', { encoding: 'utf8', maxBuffer: 1 << 24 });
  const rows = out.split('\n').map(l => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean).map(m => ({ pid: +m[1], ppid: +m[2], kb: +m[3], cmd: m[4] }));
  const mine = new Set([process.pid]); let grew = true;
  while (grew) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
  let kb = 0; for (const r of rows) if (r.cmd.includes('ms-playwright') && (kind === 'webkit' ? r.cmd.toLowerCase().includes('webkit') : mine.has(r.pid))) kb += r.kb;
  return Math.round(kb / 1024);
};
/** Chromium only: what is left once the browser has dropped what it can under memory pressure (its decoded-image and
 *  resource caches), which is what decides whether a tab survives on a small machine */
const cdp = kind === 'chromium' && process.env.PRESSURE ? await p.context().newCDPSession(p) : null;
/** Chromium only: the live DOM nodes, canvases made off screen included (a canvas made a frame and dropped shows here
 *  long before it shows in the memory) */
const dom = kind === 'chromium' ? await p.context().newCDPSession(p) : null;
const nodes = async () => dom ? (await dom.send('Memory.getDOMCounters').catch(() => ({ nodes: null }))).nodes : null;
/** pass 13 (playtest P10: the node count climbed from 245 to about 1,650 in ten minutes): the same count after a full
 *  garbage collection, so nodes only waiting for the collector are told apart from nodes something still holds */
const liveNodes = async () => { if (!dom) return null; await dom.send('HeapProfiler.collectGarbage').catch(() => undefined); return nodes(); };
const pressed = async () => {
  if (!cdp) return null;
  await cdp.send('Memory.simulatePressureNotification', { level: 'critical' }).catch(() => undefined);
  await p.waitForTimeout(1500);
  return rss();
};

await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 300000 });
await p.waitForSelector('main[data-ready="true"]', { timeout: 300000 });
await p.evaluate(() => localStorage.setItem('jade-street-v2', JSON.stringify({ v: 2, seed: 77, started: true, hero: 'dora', cash: 3000, done: Array.from({ length: 54 }, (_, i) => 'm' + (i + 1)), settings: { music: false } })));
await p.reload(); await p.waitForSelector('[data-testid="continue"]', { timeout: 300000 });
await p.click('[data-testid="continue"]');
await p.waitForFunction(() => !!window.__jade, null, { timeout: 300000 });
await p.evaluate(() => { const w = window.__jade.world(); w.talk = null; window.__jade.give(); const s = w.s; for (const g of s.gear.own) s.gear.ammo[g] = 999; window.__jade.play.paused = false; });

const DISTRICTS = ['market', 'heartland', 'india', 'temple', 'bay', 'resort', 'orchard', 'canal', 'glam', 'katong', 'docks', 'changi', 'arcade'];
const samples = []; const t0 = Date.now(); let k = 0, lastSample = -1e9, held = null;
const sample = async (d) => {
  const g = await p.evaluate(() => ({ art: window.__jade.art ? window.__jade.art() : { decodedMB: null, files: [], chunks: window.__jade.play.scene.chunks.size, chunkMB: null, recolored: null }, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, fps: Math.round(window.__jade.fps()) }));
  const s = { t: Math.round((Date.now() - t0) / 1000), d, rss: rss(), rssPressed: await pressed(), heap: g.heap, fps: g.fps, decodedMB: g.art.decodedMB, files: g.art.files.length, chunks: g.art.chunks, chunkMB: g.art.chunkMB, recolored: g.art.recolored, glows: g.art.glows ?? null, nodes: await nodes(), live: await liveNodes() };
  samples.push(s); console.log(JSON.stringify(s));
};
while (Date.now() - t0 < MS && !crashed) {
  const d = DISTRICTS[Math.floor((Date.now() - t0) / 20000) % DISTRICTS.length];
  if (k % 30 === 0) {
    const rode = (k / 30) % 2 === 1;
    await p.evaluate(([d, k, rode]) => {
      const J = window.__jade, w = J.world(); w.talk = null; w.ui = null; if (w.run) w.quitJob(); if (w.p.ride) w.exit();
      const CH = 128, CW = w.c.ground.length / CH, spots = [];
      for (let ty = 1; ty < CH - 1; ty++) for (let tx = 1; tx < CW - 1; tx++) if (w.c.ground[ty * CW + tx] === 2 && w.c.solid[ty * CW + tx] === 0 && J.district(tx, ty) === d) spots.push([tx, ty]);
      const [tx, ty] = spots[(k * 7919) % spots.length]; J.teleport(tx, ty);
      if (rode) { const r = w.addRide('scooter', tx * 64 + 32, ty * 64 + 32, 0, false, 0, true); w.p.act = null; w.p.ride = r; r.parked = false; }
      J.play.paused = false; J.play.bump();
    }, [d, k, rode]);
  }
  if (k % 30 === 7) await p.evaluate(k => { const J = window.__jade; J.rain(k % 60 === 7 ? 1 : null); J.event('busker', true); }, k);
  if (k % 10 === 5) await p.evaluate(() => { const w = window.__jade.world(); w.fx.push({ t: 'impact', x: w.p.x, y: w.p.y, k: 1, kind: 'fruit' }); });
  if (held) await p.keyboard.up(held);
  held = ['w', 'a', 's', 'd'][(k * 3 + Math.floor(k / 4)) % 4]; await p.keyboard.down(held);
  await p.waitForTimeout(300);
  await p.keyboard.press(k % 3 === 0 ? ' ' : 'q');
  await p.mouse.click(640 + ((k * 137) % 400) - 200, 400 + ((k * 71) % 300) - 150);
  await p.waitForTimeout(300);
  if (Date.now() - lastSample > 15000) { lastSample = Date.now(); await sample(d); }
  k++;
}
if (held) await p.keyboard.up(held);
if (!crashed) await sample('end');
await b.close();
if (process.env.LOG) writeFileSync(process.env.LOG, JSON.stringify(samples, null, 1));

const fails = [];
if (crashed) fails.push('the page crashed');
if (errs.length) fails.push('page errors: ' + errs.slice(0, 5).join(' | '));
const max = (f) => Math.max(0, ...samples.map(f).filter(v => v !== null));
if (max(s => s.decodedMB) > DECODED_MB) fails.push(`decoded paintings reached ${max(s => s.decodedMB)} MB (cap ${DECODED_MB})`);
if (max(s => s.chunkMB) > 100) fails.push(`ground chunks reached ${max(s => s.chunkMB)} MB`);
if (max(s => s.recolored) > 360) fails.push(`recoloured frames reached ${max(s => s.recolored)}`);
if (max(s => s.glows) > 64) fails.push(`glow sprites reached ${max(s => s.glows)}`);
// the nodes still held after a collection: these must stay flat (a few hundred for the page, plus the canvases in use)
{ const n = samples.map(s => s.live).filter(v => v !== null && v !== undefined), k = Math.floor(n.length / 3);
  if (n.length > 6 && Math.max(...n.slice(2 * k)) > 1.5 * Math.max(...n.slice(0, k)) + 300) fails.push(`DOM nodes still held after a collection kept growing: ${Math.max(...n.slice(0, k))} in the first third, ${Math.max(...n.slice(2 * k))} in the last`);
  if (n.length) console.log(`DOM nodes after a collection: ${n.join(' ')}`); }
{ const n = samples.map(s => s.nodes).filter(v => v !== null), k = Math.floor(n.length / 3);
  if (n.length > 6 && Math.max(...n.slice(2 * k)) > 3 * Math.max(...n.slice(0, k)) + 5000) fails.push(`DOM nodes kept growing: ${Math.max(...n.slice(0, k))} in the first third, ${Math.max(...n.slice(2 * k))} in the last`); }
const third = Math.floor(samples.length / 3), avg = a => a.reduce((x, s) => x + s.rss, 0) / Math.max(1, a.length);
const mid = avg(samples.slice(third, 2 * third)), last = avg(samples.slice(2 * third));
if (samples.length >= 9 && last > mid * 1.3) fails.push(`memory kept growing: ${Math.round(mid)} MB in the middle third, ${Math.round(last)} MB in the last`);
const pr = samples.map(s => s.rssPressed).filter(v => v !== null);
console.log(`${kind}: ${samples.length} samples over ${Math.round((Date.now() - t0) / 60000)} min; RSS ${Math.min(...samples.map(s => s.rss))}–${max(s => s.rss)} MB (middle third ${Math.round(mid)}, last ${Math.round(last)})${pr.length ? `; under pressure ${Math.min(...pr)}–${Math.max(...pr)} MB (mean ${Math.round(pr.reduce((a, v) => a + v, 0) / pr.length)})` : ''}; decoded paintings up to ${max(s => s.decodedMB)} MB; chunks up to ${max(s => s.chunkMB)} MB; JS heap up to ${max(s => s.heap ?? 0)} MB; glow sprites up to ${max(s => s.glows)}; DOM nodes up to ${max(s => s.nodes)}`);
if (fails.length) { console.log('FAIL\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('ok');
