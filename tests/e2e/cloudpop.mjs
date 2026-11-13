// Cloudpop in the browser, with real clicks, taps and keys, at 1280×800, 390×844 (phone upright, touch) and 844×390
// (phone on its side, touch): the title and every menu (Play, Daily, Burrow Lore and Learn, the Tower Lab and Unlock,
// Heroes with Choose and every look, Medals & trophies, Settings with every toggle, start speed and both answers to
// Reset), the map tiers and a locked map, run setup (each difficulty, each mode, the Single Kind picker, both heroes,
// Assist, Start); in a run: every tower and the hero bought from the shop and built by clicking (mouse) or tapping
// twice (touch) on the valley, a refused spot, Cancel, selecting a tower on the map, all three upgrade paths, a
// crosspath-locked path, every targeting button, a tower ability from the panel and from the quick bar, Sell, closing
// the panel, the next-round preview, Start round, 1×/2×/3×, pause, auto-start, the menu (sound, music and preview
// toggles, Resume, Restart, Leave), every keyboard shortcut, the win card with Keep going (freeplay), the loss card
// with Play again, Maps and Home, the daily challenge's Play and the link back to the arcade. Fails on any failed check, page error or sideways
// scroll. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves a screenshot of every screen.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/cloudpop';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const results = []; const errs = [];
const check = (ok, what) => { results.push([!!ok, what]); if (!ok) console.log('  FAIL', what); };

// a seasoned save: level 20 (every tower and map), Enzo, tower XP for the Lab, acorns for the Lore tree
const SEASONED = { v: 1, xp: 200000, acorns: 400, heroes: ['dora', 'enzo'], skins: ['moonlit'], towerXp: { hay: 9000, pebble: 2000 }, medals: ['meadow:easy:standard'], trophies: ['first-win', 'win-medium'], lore: [] };

async function viewport(name, w, h, touch) {
  console.log(`${name} ${w}×${h}${touch ? ' (touch)' : ''}`);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => { errs.push(`${name}: ${e.message}`); console.log('  PAGE ERROR', e.message); });
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}-${n}.png` }); };
  const noSideways = async where => check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1), `${name} ${where}: no sideways scroll`);
  const click = async (tid, where = '') => { const l = p.locator(`[data-testid="${tid}"]`).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(120); if (where) await noSideways(where); };
  const exists = async tid => (await p.locator(`[data-testid="${tid}"]`).count()) > 0;
  const screen = () => p.evaluate(() => document.querySelector('main').dataset.screen);
  const st = () => p.evaluate(() => window.__cloudpop());
  const setSave = async s => { await p.evaluate(s => localStorage.setItem('cloudpop-v1', JSON.stringify(s)), s); await p.reload(); await p.waitForSelector('main[data-ready="true"]'); };

  await p.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
  await p.evaluate(() => localStorage.removeItem('cloudpop-v1')); await p.reload(); await p.waitForSelector('main[data-ready="true"]');

  // ── a new player: title, maps (beginner open, later tiers locked), the default setup
  check(await screen() === 'title', `${name}: opens on the title`);
  check((await p.locator('[data-testid="to-arcade"]').getAttribute('href')) === '/', `${name}: the title links back to the arcade`); await noSideways('title'); await shot('title');
  await click('play', 'maps'); check(await screen() === 'maps', `${name}: Play opens the maps`);
  check(await p.locator('[data-testid="map-meadow"]').isEnabled(), `${name}: Terrace Meadow is open to a new player`);
  await click('tier-expert'); check(!(await p.locator('[data-testid="map-summit"]').isEnabled()), `${name}: expert maps are locked for a new player`);
  for (const t of ['intermediate', 'advanced', 'beginner']) await click('tier-' + t);
  await click('map-meadow', 'setup'); check(await screen() === 'setup', `${name}: a map opens its setup`);
  check(await p.locator('[data-testid="assist"]').isChecked(), `${name}: Assist is on by default`);
  check(!(await p.locator('[data-testid="hero-enzo"]').isEnabled()), `${name}: Enzo starts locked`);
  await click('back'); await click('back'); check(await screen() === 'title', `${name}: Back returns to the title`);

  // ── a seasoned save: every menu and its buttons
  await setSave(SEASONED);
  await click('lore', 'lore'); await shot('lore');
  check(await p.locator('[data-testid="lore-buy"]').isEnabled(), `${name}: the first lore node can be learned`);
  const acorns0 = +(await p.locator('[data-testid="acorns"]').innerText()).replace(/\D/g, '');
  await click('lore-buy');
  const acorns1 = +(await p.locator('[data-testid="acorns"]').innerText()).replace(/\D/g, '');
  check(acorns1 < acorns0, `${name}: Learn spends acorns (${acorns0} → ${acorns1})`);
  await click('lore-c2'); await click('lore-w1'); await click('back');
  await click('lab', 'lab'); await shot('lab');
  await click('lab-hay'); await click('lab-unlock-0');
  check((await p.evaluate(() => window.__cloudpopSave().tiers.hay?.[0])) === 4, `${name}: the Tower Lab unlocks Hay-Bale Cannon tier 4`);
  for (const t of ['pebble', 'busker', 'ember', 'ice', 'llama', 'condor', 'boat', 'windmill', 'lantern', 'quinoa']) await click('lab-' + t);
  await click('back');
  await click('heroes', 'heroes'); await shot('heroes');
  await click('choose-enzo'); check((await p.evaluate(() => window.__cloudpopSave().hero)) === 'enzo', `${name}: Choose picks Enzo`);
  await click('skin-dora-moonlit'); check((await p.evaluate(() => window.__cloudpopSave().skin.dora)) === 'moonlit', `${name}: Dora's Moonlit look`);
  check(!(await p.locator('[data-testid="skin-enzo-harvest"]').isEnabled()), `${name}: an unearned look stays locked`);
  await click('skin-dora-base'); await click('choose-dora'); await click('back');
  await click('trophies', 'trophies'); await shot('trophies');
  check(await p.locator('.tr.got').count() >= 2, `${name}: earned trophies shine`); await click('back');
  await click('settings', 'settings'); await shot('settings');
  for (const k of ['tips', 'auto', 'sound', 'music', 'assist']) { await click('opt-' + k); await click('opt-' + k); }
  await click('start-speed-2'); check((await p.evaluate(() => window.__cloudpopSave().settings.speed)) === 2, `${name}: start speed 2×`); await click('start-speed-1');
  await click('reset'); await click('reset-no'); check((await p.evaluate(() => window.__cloudpopSave().xp)) > 0, `${name}: Keep it keeps progress`);
  await click('back');
  await click('daily', 'daily'); await shot('daily'); await click('back');

  // ── setup: every difficulty, mode, the one-kind picker, both heroes
  await click('play'); await click('tier-expert'); check(await p.locator('[data-testid="map-summit"]').isEnabled(), `${name}: level 20 opens the expert maps`);
  await click('tier-beginner'); await click('map-meadow');
  for (const d of ['medium', 'hard', 'easy']) {
    await click('diff-' + d);
    const modes = await p.locator('[data-testid^="mode-"]').evaluateAll(es => es.map(e => e.dataset.testid));
    for (const m of modes) await click(m);
    check(modes.length >= 3, `${name}: ${d} has ${modes.length} modes`);
  }
  await click('mode-onekind'); check(await exists('kind-hay'), `${name}: Single Kind shows the tower picker`); await click('kind-hay'); await click('kind-pebble');
  await click('mode-standard'); await click('hero-enzo'); await click('hero-dora'); await click('assist'); await click('assist');
  await shot('setup'); await noSideways('setup');
  await click('start');
  await p.waitForFunction(() => window.__cp?.ready, null, { timeout: 30000 });
  await p.waitForTimeout(300);
  check(await screen() === 'play', `${name}: Start begins a run`); await noSideways('play'); await shot('play');

  // build helpers: find an open spot whose screen point is the bare canvas, then click or tap it like a player
  const spotFor = def => p.evaluate(def => {
    const cp = window.__cp, g = cp.g, v = cp.v, cv = document.querySelector('canvas'), r = cv.getBoundingClientRect();
    const scr = (x, y) => v.rot ? [r.left + v.x + (1024 - y) * v.k, r.top + v.y + x * v.k] : [r.left + v.x + x * v.k, r.top + v.y + y * v.k];
    const roads = g.roads;
    const near = (x, y) => { let best = 1e9; for (const rd of roads) for (let i = 0; i < rd.n; i += 6) best = Math.min(best, Math.hypot(rd.pts[i * 2] - x, rd.pts[i * 2 + 1] - y)); return best; };
    let pick = null;
    for (let y = 60; y < 980 && !pick; y += 26) for (let x = 60; x < 1480 && !pick; x += 26) {
      if (g.placeReason(def, x, y) || near(x, y) > (def === 'boat' ? 420 : 150)) continue;
      const [sx, sy] = scr(x, y);
      if (document.elementFromPoint(sx, sy) !== cv) continue;
      const [ax, ay] = scr(x, y - 18); if (document.elementFromPoint(ax, ay) !== cv) continue;
      pick = { x, y, sx, sy };
    }
    return pick;
  }, def);
  const build = async def => {
    const spot = await spotFor(def);
    if (!spot) { check(false, `${name}: found room for ${def}`); return null; }
    const n0 = (await st()).towers.length;
    if (touch) { await p.touchscreen.tap(spot.sx, spot.sy); await p.waitForTimeout(150); await p.touchscreen.tap(spot.sx, spot.sy); }
    else await p.mouse.click(spot.sx, spot.sy);
    await p.waitForTimeout(150);
    const s = await st();
    check(s.towers.length === n0 + 1, `${name}: ${def} built by ${touch ? 'two taps' : 'a click'}`);
    return s.towers[s.towers.length - 1];
  };
  const tapWorld = async (x, y) => {
    const [sx, sy] = await p.evaluate(([x, y]) => { const v = window.__cp.v, r = document.querySelector('canvas').getBoundingClientRect(); return v.rot ? [r.left + v.x + (1024 - y) * v.k, r.top + v.y + x * v.k] : [r.left + v.x + x * v.k, r.top + v.y + y * v.k]; }, [x, y]);
    if (touch) await p.touchscreen.tap(sx, sy); else await p.mouse.click(sx, sy);
    await p.waitForTimeout(150);
  };

  // the preview, then the first round by button
  check(await exists('preview'), `${name}: the next-round preview shows`);
  await p.evaluate(() => { window.__cp.g.cash = 400000; });
  // a refused spot and Cancel
  await click('buy-pebble'); check((await st()).place === 'pebble', `${name}: the shop picks a tower to place`);
  const road = await p.evaluate(() => { const r = window.__cp.g.roads[0]; const i = Math.floor(r.n / 2); return [r.pts[i * 2], r.pts[i * 2 + 1]]; });
  await tapWorld(road[0], road[1]);
  check((await st()).towers.length === 0, `${name}: the road is refused`);
  await click('cancel-place'); check((await st()).place === null, `${name}: Cancel drops the tower`);
  // every tower and the hero
  const built = {};
  for (const t of ['hero', 'pebble', 'busker', 'ember', 'ice', 'llama', 'hay', 'condor', 'boat', 'windmill', 'lantern', 'quinoa']) {
    await click('buy-' + t);
    const tw = await build(t); if (tw) built[t] = tw;
    if (await exists('close-panel')) await click('close-panel');
  }
  await shot('built');
  // select a tower on the map, upgrade all three paths and meet the crosspath rule
  const hay = built.hay;
  if (hay) {
    if (await exists('close-panel')) await click('close-panel');
    await tapWorld(hay.x, hay.y - 6);
    check((await st()).sel === hay.id, `${name}: tapping a tower on the map selects it`);
    await noSideways('tower panel'); await shot('panel');
    for (const pth of [0, 0, 0, 1, 1]) await click(`up-${pth}`);
    let tiers = (await st()).towers.find(t => t.id === hay.id).tiers;
    check(tiers[0] === 3 && tiers[1] === 2, `${name}: upgrades bought (${tiers.join('-')})`);
    await click('up-0'); tiers = (await st()).towers.find(t => t.id === hay.id).tiers;
    check(tiers[0] === 4, `${name}: the Lab-unlocked tier 4 is bought`);
    await click('up-2'); tiers = (await st()).towers.find(t => t.id === hay.id).tiers;
    check(tiers[2] === 0, `${name}: the third path stays shut (crosspath)`);
    for (const tg of ['last', 'strong', 'close', 'first']) { await click('target-' + tg); check((await st()).towers.find(t => t.id === hay.id).target === tg, `${name}: target ${tg}`); }
    await click('close-panel'); check((await st()).sel === null, `${name}: × closes the panel`);
  }
  // a tower with an ability (pebble path 1 to tier 5 by the engine), used from the panel and the quick bar
  const ab = await p.evaluate(() => {
    const cp = window.__cp, g = cp.g; g.cfg.unlocked = undefined; g.cash = 400000;
    for (const t of g.towers) { if (t.def === 'hero') continue; for (let pth = 0; pth < 3; pth++) {
      const saved = [...t.tiers]; let ok = true;
      while (t.tiers[pth] < 5 && ok) ok = !g.upgrade(t.id, pth);
      if (g.abilities(t).length) { t.abilityCd = t.abilityCd.map(() => 0); cp.sel = t.id; return { id: t.id, ab: g.abilities(t)[0].id }; }
      void saved;
    } }
    return null;
  });
  check(ab, `${name}: some tower reaches a tier-5 ability`);
  await click('go'); check((await st()).active, `${name}: Start round`);
  await p.waitForTimeout(400);
  if (ab) {
    await p.evaluate(id => { window.__cp.sel = id; }, ab.id); await p.waitForTimeout(200);
    await click(`ability-${ab.ab}`);
    check(await p.evaluate(() => window.__cp.g.stats.abilities) >= 1, `${name}: the panel's ability fires`);
    await p.evaluate(() => { for (const t of window.__cp.g.towers) t.abilityCd = t.abilityCd.map(() => 0); });
    await p.waitForTimeout(150);
    await click(`quick-${ab.ab}`);
    check(await p.evaluate(() => window.__cp.g.stats.abilities) >= 2, `${name}: the quick bar's ability fires`);
  }
  // sell from the panel
  if (built.quinoa) { await p.evaluate(id => { window.__cp.sel = id; }, built.quinoa.id); await p.waitForTimeout(150); const n0 = (await st()).towers.length; await click('sell'); check((await st()).towers.length === n0 - 1, `${name}: Sell`); }
  // speed, pause, auto
  if (!touch || name === 'phone-wide') for (const s of [2, 3, 1]) { await click('speed' + s); check((await st()).speed === s, `${name}: ${s}× speed`); }
  else for (const s of [2, 3, 1]) { await p.locator('.sp.on').click(); check((await st()).speed === s, `${name}: the speed button cycles to ${s}×`); }
  await click('pause'); check((await st()).paused, `${name}: pause`); await click('pause'); check(!(await st()).paused, `${name}: unpause`);
  const auto0 = (await st()).auto; await click('auto'); check((await st()).auto !== auto0, `${name}: auto-start toggles`); await click('auto');
  // the menu
  await click('menu'); check(await exists('pause-menu'), `${name}: the menu opens`); await shot('menu');
  for (const k of ['sound', 'music', 'tips']) { await click('set-' + k); await click('set-' + k); }
  await click('resume'); check(!(await exists('pause-menu')) && !(await st()).paused, `${name}: Resume`);
  // keys (desktop only: phones have no keyboard)
  if (!touch) {
    const k = async (key, test, what) => { await p.keyboard.press(key); await p.waitForTimeout(120); check(await test(), `${name}: key ${key} ${what}`); };
    await k('p', async () => (await st()).paused, 'pauses'); await k('p', async () => !(await st()).paused, 'resumes');
    await k('a', async () => (await st()).auto !== auto0, 'toggles auto'); await p.keyboard.press('a');
    await k('2', async () => (await st()).place === 'busker', 'picks the second tower'); await k('Escape', async () => (await st()).place === null, 'cancels');
    await k('0', async () => (await st()).place === 'lantern', 'picks the tenth'); await k('-', async () => (await st()).place === 'quinoa', 'picks the eleventh'); await p.keyboard.press('Escape');
    await k('h', async () => true, 'is safe with the hero out');
    const pid = await p.evaluate(() => window.__cp.g.towers.find(t => t.def !== 'hero' && t.tiers.every(v => v === 0))?.id);
    if (pid) {
      await p.evaluate(id => { window.__cp.sel = id; window.__cp.g.cash = 400000; }, pid);
      const tiers0 = (await st()).towers.find(t => t.id === pid).tiers.join('');
      await k('z', async () => (await st()).towers.find(t => t.id === pid).tiers.join('') !== tiers0, 'upgrades path 1');
      await k('x', async () => true, 'tries path 2'); await k('c', async () => true, 'tries path 3');
      const tg = (await st()).towers.find(t => t.id === pid).target;
      await k('t', async () => (await st()).towers.find(t => t.id === pid).target !== tg, 'cycles targeting');
      await k('q', async () => true, 'is safe without an ability');
      await k('Backspace', async () => !(await st()).towers.some(t => t.id === pid), 'sells');
    }
    await k(' ', async () => true, 'starts or speeds up');
  }
  // the win card and freeplay
  await p.evaluate(() => { const g = window.__cp.g; g.lives = 9999; g.spawns = []; g.puffs = []; g.round = g.lastRound; g.active = true; window.__cp.paused = false; });
  await p.waitForSelector('[data-testid="end-card"]', { timeout: 10000 }).catch(() => {});
  check(await exists('end-card'), `${name}: winning shows the end card`); await shot('win'); await noSideways('win');
  check(/saved/i.test(await p.locator('[data-testid="end-card"] h2').innerText()), `${name}: the win card says the festival is saved`);
  await click('freeplay'); check(!(await exists('end-card')) && (await st()).over === '', `${name}: Keep going continues in freeplay`);
  // the loss card: Play again, Maps, Home
  const lose = () => p.evaluate(() => { const g = window.__cp.g; g.secondChances = 0; g.lives = 1; const pf = g.spawnPuff('thunderhead', 0, g.roads[0].len - 2, false, false, false, 'thunderhead'); g.active = true; window.__cp.paused = false; void pf; });
  await lose(); await p.waitForSelector('[data-testid="end-card"]', { timeout: 10000 }).catch(() => {});
  check(/freeplay over/i.test(await p.locator('[data-testid="end-card"] h2').innerText().catch(() => '')), `${name}: losing in freeplay shows Freeplay over`);
  await click('retry'); await p.waitForFunction(() => window.__cp?.ready && window.__cp.g.round === 1, null, { timeout: 20000 });
  check(!(await exists('end-card')), `${name}: Play again starts fresh`);
  await click('menu'); await click('restart'); await p.waitForFunction(() => window.__cp?.ready && window.__cp.g.towers.length === 0, null, { timeout: 20000 });
  check(true, `${name}: Restart`);
  await lose(); await p.waitForSelector('[data-testid="end-card"]', { timeout: 10000 }).catch(() => {});
  check(/rained out/i.test(await p.locator('[data-testid="end-card"] h2').innerText().catch(() => '')), `${name}: losing shows Rained out`); await shot('lose'); await noSideways('lose');
  await click('to-maps'); check(await screen() === 'maps', `${name}: Maps from the end card`);
  await click('map-loop'); await click('start'); await p.waitForFunction(() => window.__cp?.ready && window.__cp.g.map.id === 'loop', null, { timeout: 20000 });
  await lose(); await p.waitForSelector('[data-testid="end-card"]', { timeout: 10000 }).catch(() => {});
  await click('to-home'); check(await screen() === 'title', `${name}: Home from the end card`);
  // leaving a run from the menu, then the daily challenge
  await click('play'); await click('map-meadow'); await click('start'); await p.waitForFunction(() => window.__cp?.ready, null, { timeout: 20000 });
  await click('menu'); await click('quit'); check(await screen() === 'maps', `${name}: Leave the run`);
  await click('back'); await click('daily'); await click('daily-play');
  await p.waitForFunction(() => window.__cp?.ready && window.__cp.g.cfg.mode === 'daily', null, { timeout: 20000 });
  check((await st()).round > 1, `${name}: the daily starts mid-valley (round ${(await st()).round})`);
  check(await p.evaluate(() => [...document.querySelectorAll('[data-testid^="buy-"]:not([data-testid="buy-hero"])')].filter(e => !e.disabled).length) <= 6, `${name}: the daily limits the towers`);
  await shot('daily-run'); await noSideways('daily run');
  // reset with Yes
  await click('menu'); await click('quit'); await click('back'); await click('settings'); await click('reset'); await click('reset-yes');
  check((await p.evaluate(() => window.__cloudpopSave().xp)) === 0, `${name}: Yes, start over resets progress`);
  await ctx.close();
}

await viewport('desktop', 1280, 800, false);
await viewport('phone', 390, 844, true);
await viewport('phone-wide', 844, 390, true);
await b.close();
const bad = results.filter(r => !r[0]);
console.log(`cloudpop e2e: ${results.length - bad.length}/${results.length} checks passed, ${errs.length} page errors`);
if (bad.length || errs.length) process.exit(1);
