import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/cave', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`); if (process.env.TRACE) console.error(e.stack); }
  finally { await page.close(); }
}
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const fresh = async (page) => { await page.goto(`${base}/cave`); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); };
/** Runs `fn(w, arg)` in the page with `w = window.__cave()`. */
const cave = (page, fn, arg) => page.evaluate(`(() => { const w = window.__cave(); return (${fn})(w, ${JSON.stringify(arg ?? null)}); })()`);
const dive = (page) => cave(page, (w) => w.dive && { layer: w.dive.layer, phase: w.dive.phase, hx: w.dive.hx, hy: w.dive.hy, level: w.dive.level, xp: w.dive.xp, fluff: w.dive.fluff,
  weapons: w.dive.weapons.map((x) => ({ id: x.id, level: x.level })), passives: Object.keys(w.dive.passives).length, offer: w.dive.offer, rerolls: w.dive.rerolls, gold: w.dive.gold, pod: w.dive.pod });
const screen = (page, s) => page.locator(`main[data-screen="${s}"]`).waitFor();
/** A dive with a known seed and no spawning, on the dive screen. */
async function begin(page, { hero = 'enzo', hazard = 1, seed = 5, spawning = false } = {}) {
  await cave(page, (w, a) => { w.start(a.hero, a.hazard, a.seed); w.dive.spawning = a.spawning; }, { hero, hazard, seed, spawning });
  await screen(page, 'dive');
}
/** Puts the hero in the middle of a floor tile with `want` tiles to its right: floor for 'open', else that block. */
const placeBeside = (page, want) => cave(page, (w, want) => {
  const m = w.dive.map, at = (x, y) => m.tiles[y * m.w + x];
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 4; x++) {
    if (at(x, y) !== 'floor' || at(x, y - 1) !== 'floor' || at(x, y + 1) !== 'floor') continue;
    const ok = want === 'open' ? at(x + 1, y) === 'floor' && at(x + 2, y) === 'floor' && at(x + 3, y) === 'floor' && at(x + 1, y - 1) === 'floor' && at(x + 1, y + 1) === 'floor' : at(x + 1, y) === want;
    if (ok) { w.dive.placeHero(x + 0.5, y + 0.5); return { x, y }; }
  }
  return null;
}, want);
const hold = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };

await check('hydration: a fresh title has no Continue; camp shows hazard 1 only', async (page) => {
  await fresh(page);
  await screen(page, 'title');
  assert.equal(await page.getByTestId('continue').count(), 0);
  await page.screenshot({ path: '.checks/cave/title.png' });
  await page.getByTestId('camp').click(); await screen(page, 'camp');
  assert.equal(await page.getByTestId('hazard-1').isEnabled(), true);
  for (const n of [2, 3, 4, 5]) assert.equal(await page.getByTestId(`hazard-${n}`).isEnabled(), false, `hazard ${n} locked`);
  await page.screenshot({ path: '.checks/cave/camp.png' });
});

for (const [hero, weapon, name] of [['dora', 'pickaxe', 'Pickaxe'], ['enzo', 'sling', 'Sling']]) {
  await check(`each hero: ${hero} dives with the ${weapon} in slot 0`, async (page) => {
    await fresh(page);
    await page.getByTestId('camp').click(); await screen(page, 'camp');
    await page.getByTestId(`hero-${hero}`).click(); await page.getByTestId('dive').click();
    await screen(page, 'dive');
    const d = await dive(page);
    assert.deepEqual([d.layer, d.weapons[0].id, d.weapons.length], [1, weapon, 1]);
    assert.ok((await page.getByTestId('slot-0').textContent()).includes(name));
    assert.equal(await cave(page, (w) => w.dive.hero), hero);
    for (const id of ['fluff', 'timer', 'gold', 'job']) assert.ok((await page.getByTestId(id).textContent()).length > 0, `${id} shows`);
  });
}

await check('keys: holding ArrowRight moves the hero, and pushing into dirt digs it', async (page) => {
  await fresh(page); await begin(page, { hero: 'enzo' });
  const open = await placeBeside(page, 'open');
  assert.ok(open, 'an open run of floor');
  const x0 = (await dive(page)).hx;
  await hold(page, 'ArrowRight', 500);
  const x1 = (await dive(page)).hx;
  assert.ok(x1 > x0 + 0.5, `moved right ${x0} → ${x1}`);
  const at = await placeBeside(page, 'dirt');
  assert.ok(at, 'floor beside dirt');
  await hold(page, 'ArrowRight', 1500);
  assert.equal(await cave(page, (w, a) => w.dive.map.tiles[a.y * w.dive.map.w + a.x + 1], at), 'floor', 'the dirt is dug');
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/dig.png' });
});

await check('a card and a reroll: the threshold opens a pick, Reroll works once, card-0 adds a card', async (page) => {
  await fresh(page); await begin(page);
  await cave(page, (w) => w.set({ xp: w.xpNeed(w.dive.level) }));
  await screen(page, 'pick');
  await page.getByTestId('card-0').waitFor();
  await page.screenshot({ path: '.checks/cave/pick.png' });
  assert.equal(await page.getByTestId('reroll').isEnabled(), true);
  await page.getByTestId('reroll').click();
  assert.equal(await page.getByTestId('reroll').isEnabled(), false);
  const before = await dive(page), card = before.offer[0];
  await page.getByTestId('card-0').click();
  await screen(page, 'dive');
  const after = await dive(page);
  assert.equal(after.level, before.level);
  if (card.k === 'weapon') {
    const was = before.weapons.find((x) => x.id === card.id), now = after.weapons.find((x) => x.id === card.id);
    assert.ok(now && (!was || now.level === was.level + 1), `weapon ${card.id}`);
  } else assert.equal(after.passives, before.passives + 1, `passive ${card.id}`);
});

await check('the pod: it lands, reaching it banks the gold, Descend starts layer 2, and Continue after a reload', async (page) => {
  await fresh(page); await begin(page, { spawning: true });
  await cave(page, (w) => { w.dive.gold.layer = 17; w.set({ timer: 0.1, fluff: 999 }); });
  await page.waitForFunction(() => !!window.__cave().dive.pod);
  await page.waitForTimeout(600);
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/pod-run.png' });
  await cave(page, (w) => { const p = w.dive.pod; w.dive.placeHero(p.x, p.y); });
  await screen(page, 'pod');
  assert.ok((await page.getByTestId('summary').textContent()).includes('17'), 'gold banked shows');
  await page.screenshot({ path: '.checks/cave/pod-summary.png' });
  await page.reload(); await ready(page);
  await page.getByTestId('continue').click();
  await screen(page, 'dive');
  assert.equal((await dive(page)).layer, 2, 'Continue starts the next layer');
  assert.equal((await dive(page)).gold.banked, 17);
});

await check('the pod: Descend starts layer 2', async (page) => {
  await fresh(page); await begin(page);
  await cave(page, (w) => w.set({ timer: 0.1 }));
  await page.waitForFunction(() => !!window.__cave().dive.pod);
  await cave(page, (w) => { const p = w.dive.pod; w.dive.placeHero(p.x, p.y); });
  await screen(page, 'pod');
  await page.getByTestId('descend').click();
  await screen(page, 'dive');
  const d = await dive(page);
  assert.deepEqual([d.layer, d.phase], [2, 'play']);
  assert.ok((await page.getByTestId('timer').textContent()).includes('2'), 'layer 2 in the HUD');
});

await check('a reload mid-layer: Continue restarts the layer with the build it began with', async (page) => {
  await fresh(page); await begin(page);
  await page.waitForTimeout(300);
  await cave(page, (w) => { w.dive.gold.layer = 30; w.dive.xp = 3; w.dive.placeHero(w.dive.hx + 0.2, w.dive.hy); });
  await page.reload(); await ready(page);
  await page.getByTestId('continue').click(); await screen(page, 'dive');
  const d = await dive(page);
  assert.deepEqual([d.layer, d.gold.layer, d.gold.banked, d.xp, d.level], [1, 0, 0, 0, 1]);
});

await check('an overclock offer: a level-4 sling and a level-up offer exactly its two overclocks, with no Reroll', async (page) => {
  await fresh(page); await begin(page, { hero: 'enzo' });
  await cave(page, (w) => { w.set({ weapons: [{ id: 'sling', level: 4 }] }); w.set({ xp: w.xpNeed(w.dive.level) }); });
  await screen(page, 'pick');
  const d = await dive(page);
  assert.deepEqual(d.offer.map((c) => c.id).sort(), ['sling.heavy', 'sling.twin']);
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 2);
  assert.equal(await page.getByTestId('reroll').isEnabled(), false);
  await page.getByTestId('card-1').click();
  await screen(page, 'dive');
  assert.ok((await page.getByTestId('slot-0').textContent()).includes('5'), 'the sling shows level 5');
});

await check('a camp upgrade: buy-fluffier spends the gold and the level shows', async (page) => {
  await fresh(page);
  await cave(page, (w) => w.setProfile({ ...w.profile, gold: 100 }));
  await page.getByTestId('camp').click(); await screen(page, 'camp');
  await page.getByTestId('buy-fluffier').click();
  const p = await cave(page, (w) => w.profile);
  assert.deepEqual([p.gold, p.upgrades.fluffier], [60, 1]);
  assert.ok((await page.getByTestId('buy-fluffier').textContent()).includes('1/5'));
  await page.reload(); await ready(page);
  assert.equal((await cave(page, (w) => w.profile)).upgrades.fluffier, 1, 'kept');
});

await check('screenshots: layer 1 at 2:00, a 300-critter swarm, and the wyrm', async (page) => {
  await fresh(page); await begin(page, { hero: 'dora', spawning: true, seed: 11 });
  await cave(page, (w) => { w.set({ fluff: 9999 }); w.dive.t = 120; w.dive.timer = 180; });
  await page.waitForTimeout(2500);
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/layer1-2min.png' });
  await cave(page, (w) => {
    const d = w.dive;
    for (let i = 0; d.critters.length < 300 && i < 5000; i++) {
      const a = i * 2.39996, r = 2 + (i % 40) * 0.25, x = d.hx + Math.cos(a) * r, y = d.hy + Math.sin(a) * r * 1.4;
      const t = d.map.tiles[Math.floor(y) * d.map.w + Math.floor(x)];
      if (t === 'floor') d.spawn(['soot', 'mite', 'beetle'][i % 3], x, y, i % 50 === 0);
    }
  });
  await page.waitForTimeout(300);
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/swarm-300.png' });
  await cave(page, (w) => { w.set({ layer: 5, fluff: 9999 }); w.dive.critters.length = 0; w.dive.t = 179.5; w.dive.timer = 0.5; });
  if (await page.locator('main[data-screen="pick"]').count()) await page.getByTestId('card-0').click();
  // With 300 critters still on the stage a software-drawn frame is slow, so the wyrm can take a while to surface.
  await page.waitForFunction(() => { const y = window.__cave().dive.wyrm; return y && y.under === 0; }, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/wyrm.png' });
  assert.ok((await page.getByTestId('timer').textContent()).includes('Wyrm'), 'the wyrm bar shows');
});

// ---- painted art ----

const SHEETS = ['enzo', 'enzodig', 'dora', 'critters', 'fx', 'environment', 'floor', 'wyrm', 'wyrmheads'];
const art = (page) => cave(page, (w) => ({ ...w.art(), hero: w.heroPainted() }));
const clock = (page) => cave(page, (w) => w.dive.t);

await check('art: a dive asks for every sheet, hash-versioned, and paints the hero from its sheet', async (page) => {
  await fresh(page); await begin(page, { hero: 'dora' });
  await page.waitForFunction((want) => { const a = window.__cave().art(); return want.every((s) => a.ready.includes(s)); }, SHEETS);
  await page.waitForFunction(() => window.__cave().heroPainted());
  const asked = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name)).filter((u) => u.pathname.startsWith('/art/cave/')).map((u) => u.pathname + u.search));
  for (const u of asked) assert.match(u, /^\/art\/cave\/[a-z]+\.webp\?v=[0-9a-f]{12}$/);
  await page.waitForTimeout(400);
  await page.getByTestId('stage').screenshot({ path: '.checks/cave/painted.png' });
});

await check('art: while it is slow the dive plays on in code drawings, then paints itself', async (page) => {
  let release; const held = new Promise((r) => { release = r; });
  await page.route('**/art/cave/**', async (route) => { await held; await route.continue(); });
  await fresh(page); await begin(page, { hero: 'enzo' });
  const t0 = await clock(page); await page.waitForTimeout(600);
  assert.ok((await clock(page)) > t0, 'the dive runs while the art is out');
  assert.equal((await art(page)).hero, false, 'the hero is code-drawn meanwhile');
  release();
  await page.waitForFunction(() => window.__cave().heroPainted());
});

await check('art: a failed sheet leaves the dive playable, and Retry brings it back', async (page) => {
  let fail = true;
  await page.route('**/art/cave/critters.webp*', (route) => (fail ? route.abort() : route.continue()));
  await fresh(page); await begin(page, { hero: 'enzo', spawning: true });
  await page.getByTestId('retry-art').waitFor();
  const t0 = await clock(page); await page.waitForTimeout(500);
  assert.ok((await clock(page)) > t0, 'the dive runs without the critters sheet');
  assert.ok((await art(page)).failed.includes('critters'));
  fail = false;
  await page.getByTestId('retry-art').click();
  await page.getByTestId('retry-art').waitFor({ state: 'detached' });
  assert.ok((await art(page)).ready.includes('critters'));
});

for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
  await check(`fit at ${view.width}×${view.height}: no scroll, the HUD on screen; mute persists`, async (page) => {
    await fresh(page); await begin(page);
    const fit = await page.evaluate(() => {
      const s = document.querySelector('[data-testid="stage"]').getBoundingClientRect();
      return { sh: document.documentElement.scrollHeight, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth, sw0: s.width, sh0: s.height, bottom: s.bottom, right: s.right };
    });
    assert.ok(fit.sh <= fit.h && fit.sw <= fit.w, `scroll ${JSON.stringify(fit)}`);
    assert.ok(fit.bottom <= fit.h + 0.5 && fit.right <= fit.w + 0.5 && fit.sw0 >= fit.w - 1 && fit.sh0 >= fit.h - 1, `stage fills ${JSON.stringify(fit)}`);
    for (const id of ['fluff', 'timer', 'gold', 'job', 'pause', 'mute', 'slot-0', 'slot-3']) {
      const b = await page.getByTestId(id).boundingBox();
      assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= fit.w + 0.5 && b.y + b.height <= fit.h + 0.5, `${id} on screen ${JSON.stringify(b)}`);
    }
    const v = await cave(page, (w) => w.dive.view);
    assert.ok(Math.abs(Math.min(v.w, v.h * 0.8) - 11) < 0.01, `the spawn window is the stage in tiles, 11 across the short side: ${JSON.stringify(v)}`);
    const dpr = await page.evaluate(() => { const c = document.querySelector('[data-testid="stage"]'); return c.width / c.getBoundingClientRect().width; });
    assert.ok(Math.abs(dpr - (await page.evaluate(() => devicePixelRatio))) < 0.05, 'backing store × devicePixelRatio');
    await page.screenshot({ path: `.checks/cave/dive-${view.width}.png` });
    await page.getByTestId('pause').click();
    const t0 = (await dive(page)).hx;
    await hold(page, 'ArrowRight', 300);
    assert.equal((await dive(page)).hx, t0, 'paused: nothing moves');
    await page.getByTestId('pause').click();
    await page.getByTestId('mute').click();
    await page.reload(); await ready(page);
    assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  }, view);
}

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log('PASS Glimmer Cave in the browser');
