import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { wareModuleUrl } from '../whisker-ware-art.mjs';

// An isolated integration harness for Claude's upcoming game: serves the real loader and original PNGs.
// It deliberately adds no public game route or placeholder cabinet to the arcade.
const moduleUrl = await wareModuleUrl(), requests = new Map();
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;padding:16px;background:#17252c;color:#f5ecd8;font:16px system-ui}button{padding:12px;margin:4px;border:1px solid #b79859;border-radius:8px}h1{font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}.tile{min-width:0;border:1px solid #617177;padding:8px;border-radius:8px}.tile p{overflow-wrap:anywhere}canvas{display:block;width:100%;height:auto;background:#263a40}#status{overflow-wrap:anywhere}
</style></head><body><h1>Whisker Ware · loader verification</h1><button id="control">Independent control</button><button id="retry" hidden>Retry artwork</button><p id="status"></p><section id="gallery" class="grid"></section><script type="module">
const art=await import(${JSON.stringify(moduleUrl)});window.ware=art;let tiles=[],raf=0;window.actions=0;
document.querySelector('#control').onclick=()=>window.actions++;
document.querySelector('#retry').onclick=()=>art.retryWareArt();
function add(label,paint,w=240,h=200){const box=document.createElement('article');box.className='tile';const cv=document.createElement('canvas');cv.width=w;cv.height=h;const p=document.createElement('p');p.textContent=label;box.append(cv,p);document.querySelector('#gallery').append(box);tiles.push({cv,paint,label});}
function draw(){raf=0;for(const {cv,paint} of tiles){const c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);const done=paint(c,{x:0,y:0,w:cv.width,h:cv.height});cv.dataset.painted=String(done);if(!done){c.fillStyle='#c89b5b';c.fillRect(24,24,cv.width-48,cv.height-48);}}const state=art.wareArtStatus();document.querySelector('#retry').hidden=!state.failed.length;document.querySelector('#status').textContent=JSON.stringify(state);}
art.subscribeWareArt(()=>{if(!raf)raf=requestAnimationFrame(draw);});
add('Dora · presenting',(c,b)=>art.paintWareHost(c,'dora','presenting',b));
add('Title · complete transparent frame',art.paintWareTitle,480,320);art.prefetchWareMenu();draw();
window.renderAll=()=>{tiles=[];document.querySelector('#gallery').replaceChildren();for(const [key,frames] of Object.entries(art.WARE_CROPS)){frames.forEach((rect,i)=>{if(rect)add(key+' / '+i,(c,b)=>art.paintWareSprite(c,key,i,b));});}add('title',art.paintWareTitle,480,320);for(const key of art.WARE_ASSETS){if(key.startsWith('bg-')||key.startsWith('room-'))add(key,(c,b)=>art.paintWareBackdrop(c,key,b),480,320);}draw();};
window.ready=true;
</script></body></html>`;

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (!/^\/art\/whisker-ware\/[a-z0-9-]+\.png$/.test(path)) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(new URL(`../../public${path}`, import.meta.url));
    requests.set(path, (requests.get(path) ?? 0) + 1);
    res.setHeader('content-type', 'image/png'); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch(), errors = [];
await mkdir('.checks/whisker-ware', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  page.on('pageerror', error => errors.push(error.message));
  let unblock;
  const held = new Promise(resolve => { unblock = resolve; });
  await page.route('**/art/whisker-ware/hosts.png*', async route => { await held; await route.abort(); });
  await page.goto(base); await page.waitForFunction(() => window.ready);
  await page.getByRole('button', { name: 'Independent control' }).tap();
  assert.equal(await page.evaluate(() => window.actions), 1, 'pending art never gates unrelated controls');
  assert.equal(await page.locator('canvas').first().getAttribute('data-painted'), 'false');
  unblock();
  await page.getByRole('button', { name: 'Retry artwork' }).waitFor();
  const before = await page.locator('canvas').first().evaluate(c => c.toDataURL());
  await page.waitForFunction(() => window.ware.wareArtStatus().ready.includes('title'));
  assert.deepEqual(await page.evaluate(() => window.ware.wareArtStatus().ready), ['title']);
  assert.equal(requests.size, 1, 'menu does not preload the 28 background images');
  await page.unroute('**/art/whisker-ware/hosts.png*');
  await page.getByRole('button', { name: 'Retry artwork' }).tap();
  await page.waitForFunction(() => window.ware.wareArtStatus().ready.includes('hosts'));
  await page.waitForFunction(before => document.querySelector('canvas').toDataURL() !== before, before);
  assert.equal(await page.getByRole('button', { name: 'Retry artwork' }).isVisible(), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: '.checks/whisker-ware/loader-phone.png', fullPage: true });
  await page.evaluate(() => window.ware.prefetchWareGame('sneak'));
  await page.waitForFunction(() => window.ware.wareArtStatus().ready.length === 5);
  assert.deepEqual((await page.evaluate(() => window.ware.wareArtStatus().ready)).sort(), ['hosts', 'title', 'props-owl', 'room-owl', 'bg-sneak'].sort(), 'selecting a game preloads only its host and scene');
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.evaluate(() => window.renderAll());
  await page.waitForFunction(() => window.ware.wareArtStatus().ready.length === 34, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('canvas[data-painted="true"]').length === 88);
  const stats = await page.locator('canvas').evaluateAll(canvases => canvases.map(cv => {
    const p = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0, clear = 0; for (let i = 3; i < p.length; i += 4) { if (p[i] > 16) ink++; if (!p[i]) clear++; }
    return { name: cv.nextElementSibling.textContent, ink, clear, pixels: p.length / 4 };
  }));
  assert.equal(stats.length, 88);
  for (const s of stats) {
    assert.ok(s.ink > 20, `${s.name} paints visible artwork`);
    if (s.name.startsWith('bg-') || s.name.startsWith('room-')) assert.equal(s.ink, s.pixels, `${s.name} is full-bleed and opaque`);
    else assert.ok(s.clear > s.pixels * .1, `${s.name} retains real alpha without a painted box`);
  }
  assert.equal(requests.size, 34);
  assert.ok([...requests.values()].every(n => n === 1), 'rendering all 88 canvases still loads each image once');
  await page.screenshot({ path: '.checks/whisker-ware/loader-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.deepEqual(errors, []);
  console.log('Whisker Ware painted loader: pending fallback, native touch controls, failure/retry redraw, lazy priorities, all 34 PNGs/88 canvases, real alpha and phone/desktop layouts pass.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
