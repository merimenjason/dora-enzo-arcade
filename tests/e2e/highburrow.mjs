// Highburrow in the browser, with real clicks, taps and keys, at 1280×800, 390×844 (phone upright) and 844×390 (phone
// on its side): the title (Assist, New game, Continue), the tutorial ring and Skip, every unit action (Explore, Befriend
// greyed out with its reason, Rest, Found greyed out, Trail, Village, Join, Trade, Route, Edit route, Stop route), the
// village cut-away (queue and unqueue, tap a settler then a tile, drag a settler to a room, the unbuilt-room tag, the
// caravan's load and unload, a storehouse tooltip, Send out a settler, the wasted-goods button), tap-twice moves, Enzo's
// Other tip and Do it, Next, End Turn by button and by Enter, the summary's OK and Next, every keyboard shortcut, zoom,
// pan and the mini map, the market (Trade, the favour, Learn, Later, tapping a camp, ×), the llama route editor, both
// answers to a neighbour's request, the summit festival, Play again, the out-of-time card, Keep playing and a reload.
// Mid-game states are played in the page by the casual bot (seed 1002). Fails on any failed check, page error or
// sideways scroll. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves a screenshot of every screen.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/highburrow';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const results = []; const errs = [];

// real game states, played in the page by the casual bot (the same way the prototype's test/states.ts made them)
const STATES = `(() => {
  const { Game, advise, frostKnown } = window.__hbLib; const g = new Game(1002, true); const out = {};
  while (!g.s.over && g.s.turn <= 60) {
    const skip = new Set();
    for (let i = 0; i < 80; i++) {
      const a = advise(g, { skip });
      if (a.cmd.k === 'festival') { out.win = g.save(); return out; }
      if (a.cmd.k === 'end') break; g.apply(a.cmd); skip.add(a.key);
    }
    if (!out.mid && g.s.turn === 24) out.mid = g.save();
    g.apply({ k: 'end' });
    if (!out.decide && g.s.decision) out.decide = g.save();
    if (!out.frost && g.s.turn > 14 && g.s.frost && frostKnown(g.s) && g.s.villages.length >= 3) out.frost = g.save();
  }
  return out;
})()`;
let st = null;

const run = async (w, h, touch) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  p.on('pageerror', e => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errs.push(`${w}x${h} ${e.message}`); });
  const S = () => p.evaluate(() => window.__highburrow());
  const check = async (name, fn, pred) => {
    const before = await S();
    try { await fn(); await p.waitForTimeout(250); const after = await S(); const ok = await pred(before, after); results.push([`${w}x${h}`, name, ok ? 'ok' : 'FAIL']); }
    catch (e) { results.push([`${w}x${h}`, name, 'ERROR ' + e.message.split('\n')[0]]); }
  };
  const tag = w > h ? (h < 500 ? 'l' : 'd') : 'p';
  const shot = async (n) => {
    if (!SHOTS) return;
    await p.evaluate(() => document.querySelectorAll('.tip.on').forEach(t => t.classList.remove('on')));
    await p.waitForTimeout(400); await p.screenshot({ path: `${SHOTS}/${tag}-${n}.png` });
  };
  const noSideScroll = async (where) => {
    const sx = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    results.push([`${w}x${h}`, `no sideways scroll (${where})`, sx <= 1 ? 'ok' : `FAIL ${sx}px`]);
  };
  const tap = sel => touch ? p.tap(sel) : p.click(sel);
  const load = async (json, tut = '99') => {
    await p.goto(base);
    await p.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
    await p.evaluate(([j, t]) => { localStorage.clear(); if (j) localStorage.setItem('highburrow-v1', j); localStorage.setItem('highburrow-tut', t); }, [json, tut]);
    await p.reload(); await p.locator('main[data-ready="true"]').waitFor({ timeout: 60000 }); await p.waitForTimeout(500);
  };
  // title
  await load('', '0');
  if (!st) st = await p.evaluate(STATES);
  await shot('title'); await noSideScroll('title');
  await check('Assist checkbox toggles', () => tap('.title .assist input'), async () => !(await p.$eval('.title .assist input', e => e.checked)));
  await p.click('.title .assist input');
  await check('New game', () => tap('.title .wbtn.red'), (a, b) => b.modal === '' && b.turn === 1);
  await check('Tutorial ring shows', async () => {}, async () => p.$eval('.tut', e => e.classList.contains('on')));
  await shot('tutorial');
  // Dora
  await check('Explore (Dora)', () => tap('#unit [data-act="explore"]'), (a, b) => JSON.stringify(a.units[0]) !== JSON.stringify(b.units[0]));
  await p.waitForTimeout(1200);
  await check('Befriend disabled explains why', async () => {}, async () => (await p.$eval('#unit [data-act="befriend"]', e => e.disabled && e.dataset.tip.includes('neg'))));
  await check('Rest (Dora)', () => tap('#unit [data-act="rest"]'), (a, b) => b.units.find(u => u.kind === 'dora').rest === true);
  await check('Skip tutorial', () => tap('.tutskip'), async () => !(await p.$eval('.tut', e => e.classList.contains('on'))));
  // Enzo
  await p.evaluate(() => { const a = window.__hb; a.select(a.g.s.units.find(u => u.kind === 'enzo').id, false); });
  await check('Found disabled explains why', async () => {}, async () => p.$eval('#unit [data-act="found"]', e => e.disabled && /settler/i.test(e.dataset.tip)));
  await check('Trail (Enzo)', () => tap('#unit [data-act="trail"]'), (a, b) => b.trail.some(x => x) && !a.trail.some(x => x));
  await check('Village button opens village', () => tap('#unit [data-act="village"]'), (a, b) => b.modal === 'village');
  await shot('village'); await noSideScroll('village');
  if (w < 500) await check('Swipe hint on the phone cut-away', async () => {}, async () => p.$eval('.vswipe', e => e.offsetWidth > 0));
  // village screen
  await check('Queue a building', () => tap('.village .addb'), (a, b) => b.villages[0].queue.length > a.villages[0].queue.length);
  await check('Remove from queue', () => tap('.village .qrow .mini'), (a, b) => b.villages[0].queue.length < a.villages[0].queue.length);
  await check('Tap settler then tap tile', async () => {
    await tap('.village .fig'); const t = await p.$('.village .vtile.target:not(:has(.fig))') ?? await p.$('.village .vtile.target'); await t.click();
  }, (a, b) => JSON.stringify(a.villages[0].settlers.map(s => s.job)) !== JSON.stringify(b.villages[0].settlers.map(s => s.job)));
  if (!touch) await check('Drag settler to a room', async () => {
    const f = await p.$('.village .vtile .fig'); const r = await p.$('.village .room[data-job="hearth"]');
    const fb = await f.boundingBox(), rb = await r.boundingBox();
    await p.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await p.mouse.down(); await p.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2, { steps: 10 });
    await shot('village-drag'); await p.mouse.up();
  }, (a, b) => b.villages[0].settlers.some(s => s.job === 'hearth'));
  await check('Unbuilt room tag queues it', () => p.locator('.village .room.unbuilt .rtag', { hasText: 'tap to build' }).first().click(), (a, b) => b.villages[0].queue.length > a.villages[0].queue.length);
  await check('Caravan Load +2', () => tap('.village .crow .mini'), (a, b) => JSON.stringify(a.units) !== JSON.stringify(b.units));
  await check('Caravan Unload', () => p.click('.village .crow .mini:nth-of-type(3)'), (a, b) => JSON.stringify(a.units) !== JSON.stringify(b.units));
  await check('Storehouse number explains itself', async () => { await (touch ? p.tap('.village .grow') : p.hover('.village .grow')); }, async () => p.$eval('.tip', e => e.classList.contains('on') && e.textContent.length > 10));
  await check('Send out a settler', () => tap('.village .vpanel .wbtn.teal'), (a, b) => b.units.some(u => u.kind === 'settler') && b.modal === '');
  await check('Join (settler)', async () => { await p.evaluate(() => { const a = window.__hb; a.select(a.g.s.units.find(u => u.kind === 'settler').id, false); }); await tap('#unit [data-act="join"]'); }, (a, b) => !b.units.some(u => u.kind === 'settler'));
  // map moves: tap twice
  await check('Tap a tile twice to move', async () => {
    await p.evaluate(() => { const a = window.__hb; a.select(a.g.s.units.find(u => u.kind === 'caravan').id, false); });
    const pt = await p.evaluate(() => { const a = window.__hb; const u = a.g.unit(a.sel); const c = window.__hbHex(u.q + 1, u.r); const r = a.cv.getBoundingClientRect(); const s = a.scene.toScreen(c.x, c.y); return [s.x + r.left, s.y + r.top]; });
    await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(150); await p.mouse.click(pt[0], pt[1]);
  }, (a, b) => JSON.stringify(a.units.find(u => u.kind === 'caravan')) !== JSON.stringify(b.units.find(u => u.kind === 'caravan')));
  await check('Advisor Other tip', async () => { await p.waitForTimeout(1000); await tap('#advice .wbtn.teal'); }, (a, b) => a.advice !== b.advice);
  await check('Advisor Do it', () => tap('#advice .wbtn.red'), (a, b) => JSON.stringify(a.villages) + JSON.stringify(a.units) !== JSON.stringify(b.villages) + JSON.stringify(b.units) || a.turn !== b.turn);
  await check('Next button', () => tap('#next'), async () => true);
  if ((await S()).modal === 'village') await p.keyboard.press('Escape');
  await check('Minimap click pans', async () => { if (await p.$eval('#mini', e => e.offsetWidth > 0)) { const v0 = await p.evaluate(() => ({ ...window.__hb.scene.view })); await p.click('#mini', { position: { x: 30, y: 30 } }); const v1 = await p.evaluate(() => ({ ...window.__hb.scene.view })); if (v0.x === v1.x && v0.y === v1.y) throw new Error('no pan'); } }, async () => true);
  await check('End Turn', async () => { await p.waitForTimeout(1500); await tap('#end'); }, (a, b) => b.turn === a.turn + 1 && b.modal === 'summary');
  await shot('summary'); await noSideScroll('summary');
  await check('Summary OK', () => tap('.summary .wbtn.teal'), (a, b) => b.modal === '');
  await check('Enter ends turn', async () => { await p.waitForTimeout(1500); await p.keyboard.press('Enter'); }, (a, b) => b.turn === a.turn + 1);
  await check('Summary Next', () => tap('.summary .wbtn.red'), (a, b) => b.modal !== 'summary');
  if ((await S()).modal === 'village') await p.keyboard.press('Escape');
  // keyboard shortcuts
  await p.evaluate(() => { const a = window.__hb; a.select(a.g.s.units.find(u => u.kind === 'dora').id, false); });
  await check('Key E explores', async () => { await p.waitForTimeout(1300); await p.keyboard.press('e'); }, (a, b) => JSON.stringify(a.units.find(u => u.kind === 'dora')) !== JSON.stringify(b.units.find(u => u.kind === 'dora')));
  await check('Key Tab selects next unit', () => p.keyboard.press('Tab'), (a, b) => a.selected !== b.selected);
  await check('Key V opens a village', () => p.keyboard.press('v'), (a, b) => b.modal === 'village');
  await check('Esc closes', () => p.keyboard.press('Escape'), (a, b) => b.modal === '');
  await check('Key H asks Enzo', () => p.keyboard.press('h'), async () => p.$eval('#advice', e => e.textContent.includes('Enzo')));
  const zoom = () => p.evaluate(() => window.__hb.scene.view.z);
  await check('Key + zooms', async () => { const z = await zoom(); await p.keyboard.press('+'); if ((await zoom()) <= z) throw new Error('no zoom'); }, async () => true);
  await check('Key - zooms out', async () => { const z = await zoom(); await p.keyboard.press('-'); if ((await zoom()) >= z) throw new Error('no zoom'); }, async () => true);
  await check('Arrow keys pan', async () => { const v0 = await p.evaluate(() => window.__hb.scene.view.x); await p.keyboard.press('ArrowRight'); if ((await p.evaluate(() => window.__hb.scene.view.x)) === v0) throw new Error('no pan'); }, async () => true);
  if (!touch) await check('Wheel zooms', async () => { const z = await zoom(); await p.mouse.move(w / 2, h / 2); await p.mouse.wheel(0, -300); await p.waitForTimeout(100); if ((await zoom()) === z) throw new Error('no zoom'); }, async () => true);
  await check('Drag pans the map', async () => { await p.evaluate(() => { const a = window.__hb; a.scene.centerOn(9, 7, 1); }); const v0 = await p.evaluate(() => ({ ...window.__hb.scene.view })); await p.mouse.move(w / 2, h / 2); await p.mouse.down(); await p.mouse.move(w / 2 - 120, h / 2 - 60, { steps: 6 }); await p.mouse.up(); const v1 = await p.evaluate(() => ({ ...window.__hb.scene.view })); if (v0.x === v1.x) throw new Error('no pan'); }, async () => true);
  // trade: meet the herders, caravan beside the camp
  await p.evaluate(() => { const a = window.__hb; const s = a.g.s; s.nb.herders.met = true; s.nb.herders.fr = 64; const c = s.units.find(u => u.kind === 'caravan'); c.q = 10; c.r = 8; c.cargo.wool = 6; c.cargo.salt = 4; s.seen[7 * 18 + 10] = 1; a.select(c.id, false); a.refresh(); });
  await check('Caravan Trade button opens market', () => tap('#unit [data-act="trade"]'), (a, b) => b.modal === 'trade');
  await shot('trade'); await noSideScroll('trade');
  await check('Trade', () => tap('.trade .offer .wbtn'), (a, b) => b.nb.herders.fr > a.nb.herders.fr);
  await check('Give salt (favour)', () => tap('.trade .favour .wbtn'), (a, b) => b.nb.herders.quest === 'done');
  await check('Learn', () => tap('.trade .tbtns .wbtn.red'), (a, b) => b.skills.includes('weave'));
  await check('Later closes market', () => tap('.trade .tbtns .wbtn.teal'), (a, b) => b.modal === '');
  await check('Tap camp opens market', async () => { await p.evaluate(() => { const a = window.__hb; a.select(null, false); const c = window.__hbHex(10, 7); const s = a.scene.toScreen(c.x, c.y); a.tap(s.x, s.y); }); }, (a, b) => b.modal === 'trade');
  await check('Trade X closes', () => tap('.trade .xbtn'), (a, b) => b.modal === '');
  // llama routes: open the editor from the caravan panel, pick villages and goods, start, edit, stop
  await load(st.mid); await p.click('.title .wbtn.red');
  await p.evaluate(() => { const a = window.__hb; const v = a.g.s.villages[1]; a.scene.centerOn(v.q, v.r, innerWidth < 500 ? 0.62 : 0.85); a.select(a.g.s.units.find(u => u.kind === 'dora').id, false); });
  await shot('map'); await noSideScroll('map');
  await p.evaluate(() => { const a = window.__hb; for (const u of a.g.s.units) u.route = undefined; const c = a.g.s.units.find(u => u.kind === 'caravan'); const v = a.g.s.villages[0]; c.q = v.q; c.r = v.r; c.mp = 6; a.select(c.id, false); a.refresh(); });
  await check('Route button opens the editor', () => tap('#unit [data-act="route"]'), (a, b) => b.modal === 'route');
  await shot('route'); await noSideScroll('route');
  await check('Route: pick To village', () => tap('.routev .rrow.b .rchip:not(.on) >> nth=-1'), async () => p.$$eval('.routev .rchip.on', e => e.length === 2));
  await check('Route: pick From village', () => tap('.routev .rrow.a .rchip:not(.on) >> nth=0'), async () => p.$$eval('.routev .rrow.a .rchip.on', e => e.length === 1));
  await check('Route: toggle a good', () => tap('.routev .rgood:not(.on)'), async () => p.$$eval('.routev .rgood.on', e => e.length >= 1));
  if (await p.$('.routev .rtip .wbtn')) await check('Route: use Enzo’s suggestion', () => tap('.routev .rtip .wbtn'), async () => p.$$eval('.routev .rchip.on', e => e.length === 2));
  await check('Start route', () => tap('.routev .tbtns .wbtn.red'), (a, b) => b.modal === '' && b.units.some(u => u.route));
  await check('Caravan panel shows the route', async () => {}, async () => p.$eval('#unit .uroute', e => /→/.test(e.textContent)));
  await check('Edit route reopens with the route', () => tap('#unit [data-act="edit route"]'), (a, b) => b.modal === 'route');
  await check('Route X closes', () => tap('.routev .xbtn'), (a, b) => b.modal === '');
  await check('Stop route', () => tap('#unit [data-act="stop route"]'), (a, b) => !b.units.some(u => u.route));
  await check('Route key O', () => p.keyboard.press('o'), (a, b) => b.modal === 'route');
  await check('Route Esc closes', () => p.keyboard.press('Escape'), (a, b) => b.modal === '');
  await check('Key X stops a route', async () => { await p.evaluate(() => { const a = window.__hb; const c = a.g.s.units.find(u => u.kind === 'caravan'); a.act({ k: 'route', unit: c.id, a: a.g.s.villages[0].id, b: a.g.s.villages[1].id, carry: ['quinoa'] }); a.select(c.id, false); }); await p.keyboard.press('x'); }, (a, b) => !b.units.some(u => u.route));
  // waste: the storehouse button opens the route editor
  await p.evaluate(() => { const a = window.__hb; const v = a.g.s.villages[0]; v.store.potatoes = 80; v.store.quinoa = 80; a.refresh(); a.village.open(v.id); });
  await check('Storehouse shows waste', async () => {}, async () => p.$eval('.village .grow.waste', e => /wasted/i.test(e.textContent)));
  await check('Carry it uphill opens routes', () => tap('.village .psec .wbtn.teal.sm'), (a, b) => b.modal === 'route');
  await p.keyboard.press('Escape');
  // a frost night
  await load(st.frost); await p.click('.title .wbtn.red');
  await check('Frost banner on a frost night', async () => {}, async () => p.$eval('#frostbanner', e => e.classList.contains('on')));
  await shot('frost');
  // a neighbour's request: modal on load, End Turn waits, each choice answers
  for (const choice of [0, 1]) {
    await load(st.decide); await p.click('.title .wbtn.red'); await p.waitForTimeout(300);
    await check(`Decision modal shows (choice ${choice + 1})`, async () => {}, async () => (await S()).modal === 'decision');
    if (!choice) { await shot('decision'); await noSideScroll('decision'); }
    await check(`Decision choice ${choice + 1}`, () => tap(`.decision .dchoice:nth-child(${choice + 1})`), (a, b) => b.modal === '' && !b.decision && b.decided.length === a.decided.length + 1);
  }
  await load(st.decide); await p.click('.title .wbtn.red'); await p.waitForTimeout(300);
  await p.evaluate(() => window.__hb.closeModal());
  await check('End Turn asks the request first', async () => { await p.waitForTimeout(1200); await tap('#end'); }, (a, b) => b.modal === 'decision' && b.turn === a.turn);
  await check('Enzo Do it answers it', async () => { await p.evaluate(() => window.__hb.closeModal()); await tap('#advice .wbtn.red'); }, (a, b) => !b.decision);
  // festival
  await load(st.win); await p.click('.title .wbtn.red');
  await p.evaluate(() => { const a = window.__hb; a.village.open(a.g.s.villages.find(x => x.name === 'Highburrow').id); });
  await shot('festival-ready');
  await check('Hold the summit festival', () => tap('.village .wbtn.red'), (a, b) => b.over === 'won');
  await shot('win'); await noSideScroll('win');
  await check('Play again', () => tap('.endcard .wbtn.red'), (a, b) => b.turn === 1 && b.over === '');
  // out of time
  await p.evaluate(() => { const a = window.__hb; a.g.s.turn = 60; a.refresh(); });
  await check('Turn 60 shows the late card', () => p.evaluate(() => window.__hb.endTurn()), (a, b) => b.over === 'late');
  await check('Keep playing', () => tap('.endcard .wbtn.teal'), (a, b) => b.over === '');
  await check('Save survives reload', async () => { await p.reload(); await p.locator('main[data-ready="true"]').waitFor(); await p.waitForTimeout(500); }, async () => p.$eval('.title', e => /Continue \(turn 61\)/.test(e.textContent)));
  await check('Continue', () => tap('.title .wbtn.red'), (a, b) => b.modal === '' && b.turn === 61);
  // a corrupt save falls back to a fresh game
  await check('Corrupt save is ignored', async () => { await p.evaluate(() => localStorage.setItem('highburrow-v1', '{oops')); await p.reload(); await p.locator('main[data-ready="true"]').waitFor(); }, async () => p.$eval('.title', e => /New game/.test(e.textContent) && !/Continue/.test(e.textContent)));
  await ctx.close();
};
await run(1280, 800, false);
await run(390, 844, true);
await run(844, 390, true);
await b.close();
const fails = results.filter(r => r[2] !== 'ok');
console.log(`highburrow e2e: ${results.length - fails.length}/${results.length} ok`); fails.forEach(f => console.log(f.join(' | ')));
if (errs.length) console.log('page errors:', errs.slice(0, 5));
if (fails.length || errs.length) process.exit(1);
