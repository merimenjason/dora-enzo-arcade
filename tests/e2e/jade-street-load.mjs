// Jade Street load time: a fresh visit (empty cache) and a repeat visit, each timed to the title screen (New game
// showing) and to playable (the hero pick made, the game screen up with no loading screen over it), with the bytes
// that came over the wire before each. In Chromium the network is throttled through CDP (MBPS, default "10,3": a
// run per speed, 40 ms latency); WebKit has no throttling, so BROWSER=webkit times it unthrottled. Needs a server
// (BASE_URL, default http://localhost:3000; a production build with `npm run build && npm start` is what to time) and
// Playwright. Fails when a page error happens or the title or game never shows.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire(process.cwd() + '/')('playwright'); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/jade-street';
const kind = process.env.BROWSER ?? 'chromium';
const speeds = kind === 'chromium' ? (process.env.MBPS ?? '10,3').split(',').map(Number) : [0];
const LIMIT = +(process.env.LIMIT_S ?? 600) * 1000;
const b = await pw[kind].launch();
let failed = false;
const fmtMB = n => (n / 1048576).toFixed(1) + ' MB';

async function visit(ctx, mbps, label) {
  const p = await ctx.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let bytes = 0;
  if (kind === 'chromium') {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable');
    cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; });
    if (mbps) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: mbps * 125000, uploadThroughput: mbps * 125000 / 4 });
  } else p.on('requestfinished', async r => { try { const s = await r.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; } catch { /* gone */ } });
  const t0 = Date.now();
  await p.goto(base, { waitUntil: 'domcontentloaded', timeout: LIMIT });
  await p.waitForSelector('[data-testid="new"]', { timeout: LIMIT });
  const title = Date.now() - t0, titleBytes = bytes;
  await p.click('[data-testid="new"]');
  if (await p.$('[data-testid="confirm-yes"]')) await p.click('[data-testid="confirm-yes"]');
  await p.click('[data-testid="pick-dora"]');
  await p.waitForFunction(() => !!window.__jade && !document.querySelector('[data-testid="jade-loading"]'), null, { timeout: LIMIT, polling: 100 });
  const play = Date.now() - t0, playBytes = bytes;
  // the world drawn with the hero: a few frames on
  await p.waitForTimeout(1500);
  const mem = kind === 'chromium' ? await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null) : null;
  console.log(`${kind} ${label} ${mbps ? mbps + ' Mbps' : 'unthrottled'}: title ${(title / 1000).toFixed(1)} s (${fmtMB(titleBytes)}), playable ${(play / 1000).toFixed(1)} s (${fmtMB(playBytes)})${mem !== null ? `, JS heap ${mem} MB` : ''}`);
  if (errs.length) { failed = true; console.log('  page errors:', errs.slice(0, 5)); }
  await p.close();
}

for (const mbps of speeds) {
  const ctx = await b.newContext();
  await visit(ctx, mbps, 'first visit');
  await visit(ctx, mbps, 'repeat visit');
  await ctx.close();
}
await b.close();
process.exit(failed ? 1 : 0);
