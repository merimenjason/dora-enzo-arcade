// The Sunken Bellspire's Foundry Below in the browser, with the real keys: the seal under the Pearl Throne Candle,
// Tupa's forge (the recast panel, every button), the Frost Fan on molten bronze, the forge heat gauge, the Bell
// Hammer's slam (cracked glass, a bounce plate), Resonance (a crystal bridge, a prism's beam), the four foes, the
// three guardians and the foundry's ending and third epilogue, the map grown to take in the foundry (and fitting its
// box, never scrolling), no "undefined" or "NaN" anywhere, and phones held sideways and upright. Every hero pose the
// foundry adds is seen on screen. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { INFO, COLS, ROWS, ROOMS, RECAST_PERKS, roomById } from '../../.checks/bellspire-game.js';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'bellspire-v1';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => window.__bellspire().state);
const until = async (page, fn, arg, timeout = 15000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    throw new Error(`${e.message}\n  game: ${JSON.stringify(await st(page).catch(() => null))}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__bellspire()[f](...args), [fn, a]);
const game = (page, expr) => page.evaluate((e) => { const g = window.__bellspire().game; return new Function('g', `return (${e})`)(g); }, expr);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const bad = async (page, where) => { const t = await page.evaluate(() => document.body.innerText); const m = t.match(/.{0,40}\b(undefined|NaN|null|\[object Object\])\b.{0,40}/); assert.ok(!m, `${where}: “${m?.[0]}”`); };
const tagTo = async (page, who) => {
  for (let i = 0; i < 10 && (await st(page)).lead !== who; i++) {
    if ((await st(page)).dialog) await dbg(page, 'skipDialog');
    await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(250);
  }
  assert.equal((await st(page)).lead, who);
};
const calmBoss = async (page) => {
  for (let i = 0; i < 80 && ['wait', 'intro'].includes((await st(page)).boss?.st); i++) {
    if ((await st(page)).dialog) await page.keyboard.press('KeyZ');
    await page.waitForTimeout(100);
  }
  // (each guardian's own rule: a spell singes the Founder; the Choir gives while stunned)
  await game(page, '(g.boss.id === "choir" && (g.boss.st = "stun", g.boss.t = 0, g.boss.dur = 200), g.damageBoss(99999, g.boss.x, g.boss.y, g.boss.id === "founder"), true)');
  assert.ok(await game(page, 'g.boss.calm'), 'the boss calms');
};
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };
/** A new game made into one that has finished the Windward Belfry (the Out-of-Tune Bell calm: the seal cracks). */
const finishedBelfry = async (page, extra = '') => {
  await page.goto(`${base}/bellspire`); await page.evaluate((k) => { localStorage.removeItem(k); localStorage.removeItem(`${k}-ngp`); }, KEY); await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await until(page, () => window.__bellspire().screen === 'game' && window.__bellspire().state);
  await game(page, `(g.save.abilities = ['dash','lantern','double','wallkick','chime','glide','deep','rope','echo'${extra}], g.save.spells.push('ember','chime','frost','gale'),
    g.save.flags.push('script:intro','script:firstDark','script:wayra','script:bell','keeper','belfry:visited','script:belfryCall','script:cliff','script:wind','script:echo','script:rope','ending','belfry:ending',
      ...['frog','hydra','puma','warden','mother','condor','clappers','tune'].map((b) => 'boss:' + b), 'script:foundryCall','script:fgate','script:crystal'),
    g.save.heroes.dora.level = g.save.heroes.enzo.level = 14, g.save.coins = 900, g.dialog = null, true)`);
};

try {
  const page = await open();
  await finishedBelfry(page);
  await page.evaluate(() => { window.__poses = new Set(); const loop = () => { const a = window.__bellspire().scene?.heroAnim ?? {}; for (const h of ['dora', 'enzo']) if (a[h]) window.__poses.add(`${h}:${a[h].state}`); requestAnimationFrame(loop); }; loop(); });
  const posed = (k) => page.evaluate((k) => window.__poses.has(k), k);
  const at = async (room, c, r) => { await dbg(page, 'teleport', room, c, r); await dbg(page, 'skipDialog'); await page.waitForTimeout(300); await dbg(page, 'skipDialog'); await game(page, '(g.enemies = [], true)'); };
  const shot = (name) => page.locator('canvas.bs-canvas').screenshot({ path: `.shots/bellspire/${name}.png` });

  // ─── the seal, and the map grows ──────────────────────────────────────────
  await at('tshrine', 21, 14);
  const seal = INFO.get('tshrine').doors.find((d) => d.ch === '9');
  assert.ok(await game(page, `g.doorOpen(${JSON.stringify(seal)})`), 'the seal under the Pearl Throne Candle is open once the Out-of-Tune Bell is calm');
  await at('fgate', 4, 14);
  await page.keyboard.press('Escape'); await until(page, () => window.__bellspire().menu === 'map');
  const after = await page.locator('canvas.bs-map').evaluate((c) => c.height);
  const before = Math.max(...ROOMS.filter((r) => !r.fd && !r.salt).map((r) => r.gy + r.h)) * 16 + 16;
  assert.equal(after, Math.max(...ROOMS.filter((r) => !r.salt).map((r) => r.gy + r.h)) * 16 + 16, 'the map shows the foundry while the Salt Road is locked');
  assert.ok(after > before, `the map grows down to take in the foundry (${before} → ${after} px)`);
  const fit = await page.locator('.bs-map-box').evaluate((b) => ({ sw: b.scrollWidth, cw: b.clientWidth, sh: b.scrollHeight, ch: b.clientHeight, cv: b.querySelector('canvas').getBoundingClientRect(), w: b.querySelector('canvas').width, h: b.querySelector('canvas').height }));
  assert.ok(fit.sw <= fit.cw + 1 && fit.sh <= fit.ch + 1, `the whole map fits its box with no scrolling (${fit.sw}×${fit.sh} in ${fit.cw}×${fit.ch})`);
  assert.ok(fit.cv.width / fit.w <= 1.29 + 0.01 && Math.abs(fit.cv.width / fit.cv.height - fit.w / fit.h) < 0.02, `drawn at up to 1.29×, unsqueezed (${(fit.cv.width / fit.w).toFixed(2)}×)`);
  const gd = await dbg(page, 'mapGuide');
  assert.ok(gd.foundry && gd.foundry.labels?.length >= 2, `the map guide names the Casting Halls and the Glasswork Caves (${JSON.stringify(gd.foundry?.labels)})`);
  await page.getByText('A mural not read yet').waitFor({ timeout: 3000 });
  await page.locator('.bs-map-box').screenshot({ path: '.shots/bellspire/80-foundry-map-1280x800.png' });
  await bad(page, 'the map with the foundry');
  await page.keyboard.press('Escape'); await until(page, () => !window.__bellspire().menu);
  ok(`the seal is open, and the map grows to the foundry (${after}px) and fits its box at ${(fit.cv.width / fit.w).toFixed(2)}×; its legend marks murals not read yet`);

  // ─── Tupa's forge: every button ───────────────────────────────────────────
  {
    const tupa = INFO.get('fgate').things.find((t) => t.ch === 'N'), fr = roomById('fgate');
    await at('fgate', tupa.c - fr.gx * COLS - 1, tupa.r - fr.gy * ROWS);
    await until(page, () => /Tupa|forge/i.test(window.__bellspire().game.nearbyLabel() ?? ''));
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 20 && !(await page.evaluate(() => window.__bellspire().forge)); i++) { if ((await st(page)).dialog) await page.keyboard.press('KeyZ'); await page.waitForTimeout(150); }
    await page.locator('.bs-forge').waitFor();
    await page.screenshot({ path: '.shots/bellspire/81-forge-1280x800.png' });
    await bad(page, 'Tupa’s forge');
    const coins = await game(page, 'g.save.coins');
    const rows = await page.locator('.bs-forge .bs-list li').count();
    assert.ok(rows >= 2, `Tupa offers every piece of gear (${rows})`);
    await page.locator('.bs-forge .bs-list li').first().getByRole('button', { name: 'Recast' }).click();
    const perks = page.locator('.bs-forge .bs-perks button');
    assert.equal(await perks.count(), RECAST_PERKS.length, `${RECAST_PERKS.length} perks to choose from`);
    let open0 = -1;
    for (let i = 0; i < RECAST_PERKS.length; i++) if (!(await perks.nth(i).isDisabled()) && open0 < 0) open0 = i;
    assert.ok(open0 >= 0, 'a perk can be bought');
    await perks.nth(open0).click();
    await until(page, (c) => window.__bellspire().game.save.coins < c, coins);
    await page.locator('.bs-forge .bs-msg').waitFor();
    assert.match(await page.locator('.bs-forge .bs-msg').innerText(), /Recast/);
    assert.ok(await page.locator('.bs-forge .bs-recast').first().isVisible(), 'the piece shows its recast');
    // the same perk again is refused, with a reason shown
    assert.ok(await perks.nth(open0).isDisabled(), 'the same recast again is refused');
    assert.ok(await page.locator('.bs-forge .bs-why').first().isVisible(), 'and says why');
    await page.locator('.bs-forge .bs-list li').first().getByRole('button', { name: 'Close' }).click();
    assert.equal(await perks.count(), 0, 'Close folds the perks away');
    await page.getByRole('button', { name: 'Goodbye' }).click();
    await until(page, () => !window.__bellspire().forge);
    // Escape closes it too
    await page.keyboard.press('ArrowUp');
    await page.locator('.bs-forge').waitFor();
    await page.keyboard.press('Escape');
    await until(page, () => !window.__bellspire().forge);
    assert.ok(await posed('dora:forge') || await posed('enzo:forge'), 'a hero shows the forge pose at Tupa’s');
    ok(`Tupa's forge: a first-time talk, every gear row, Recast, every perk, a recast bought (${coins} → ${await game(page, 'g.save.coins')} coins), refused again with a reason, Close, Goodbye and Escape`);
  }

  // ─── the Frost Fan on molten bronze ───────────────────────────────────────
  {
    await tagTo(page, 'enzo');
    await at('channel', 5, 14);
    // walk toward the first channel until Enzo is close enough to cool it
    await page.keyboard.down('ArrowRight');
    await until(page, () => !!window.__bellspire().game.hotChannelNear(4 * 16));
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(150);
    await page.getByText('V frost the bronze').waitFor({ timeout: 3000 });
    await shot('81-frost-prompt-1280x800');
    await page.keyboard.press('KeyV');
    await until(page, () => window.__bellspire().game.frozen.size > 0);
    await page.waitForTimeout(250);
    await shot('82-frost-channel-1280x800');
    assert.ok(await posed('enzo:frostLow'), 'Enzo sweeps the Frost Fan low across the floor');
    // across on the crust, unhurt
    const hp = await game(page, 'g.leadSave.hp'), x0 = (await st(page)).x;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1600); await page.keyboard.up('ArrowRight');
    assert.ok((await st(page)).x > x0 + 120 && (await game(page, 'g.leadSave.hp')) >= hp, 'and walks across the crust unhurt');
    ok('a “V frost the bronze” prompt by hot bronze; V on the ground by molten bronze: the Frost Fan sweeps low, cools it to a crust, and Enzo walks over it');
  }

  // ─── the vents' tunnel: the prompt follows the puffs, and the jumps are fair ───
  {
    await at('vents', 5, 31);
    await page.getByText(/Wait for the vents to puff|Mist! Hop across the slag/).first().waitFor({ timeout: 3000 });
    await until(page, () => window.__bellspire().game.ventHint()?.ask === 'wait', undefined, 8000);
    await page.getByText('Wait for the vents to puff').waitFor({ timeout: 3000 });
    await until(page, () => window.__bellspire().game.ventHint()?.ask === 'go', undefined, 8000);
    await page.getByText('Mist! Hop across the slag').waitFor({ timeout: 3000 });
    await shot('83-vent-prompt-1280x800');
    ok('by the vents’ slag: “Wait for the vents to puff”, then “Mist! Hop across the slag”');
  }

  // ─── the forge heat ───────────────────────────────────────────────────────
  {
    await at('crucible', 10, 14);
    await until(page, () => window.__bellspire().game.heat > 15, undefined, 30000);
    await page.locator('.bs-heat').waitFor();
    const v = await page.locator('.bs-heat').getAttribute('aria-valuenow');
    assert.ok(Number(v) > 10, `the heat gauge shows (${v})`);
    await bad(page, 'the heat gauge');
    await game(page, '(g.heat = 99, true)');
    await until(page, () => document.querySelector('.bs-heat-full, .bs-heat-high'));
    await page.screenshot({ path: '.shots/bellspire/83-heat-1280x800.png' });
    await until(page, () => window.__poses.has('dora:browWipe') || window.__poses.has('enzo:browWipe') || window.__poses.has('dora:hotHop') || window.__poses.has('enzo:hotHop'), undefined, 20000);
    // with the helping hand (on by default), full heat never knocks a hero out
    await game(page, `(g.setHp(g.lead, 2), true)`);
    await page.waitForTimeout(3000);
    assert.ok(!(await game(page, 'g.save.heroes[g.lead].down')), 'full heat, with the helping hand: never knocked out');
    // a vent's mist cools at once
    await at('crucible', 35, 14);
    await until(page, () => window.__bellspire().game.heat === 0, undefined, 20000);
    ok('the crucible fills the heat gauge, the heroes wipe their brows, full heat never knocks them out with the helping hand, and a vent’s mist cools them');
  }

  // ─── the Bell Hammer ──────────────────────────────────────────────────────
  {
    await game(page, `(g.save.abilities.push('hammer'), true)`);
    await tagTo(page, 'dora');
    await at('crucible', 49, 14);
    await page.keyboard.down('KeyZ'); await page.waitForTimeout(200);
    await page.keyboard.down('ArrowDown'); await page.keyboard.press('KeyX'); await page.keyboard.up('KeyZ');
    await until(page, () => window.__bellspire().game.hero.dora.act?.kind === 'slam');
    await page.waitForTimeout(80); await shot('84-slam-1280x800');
    const glass = INFO.get('crucible').doors.find((d) => d.ch === '8');
    await until(page, (d) => window.__bellspire().game.doorOpen(d), glass);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(300);
    for (const p of ['slamWind', 'slamDive', 'slamLand']) assert.ok(await posed(`dora:${p}`), `Dora shows ${p}`);
    ok('Z then ↓ + X in the air: the Bell Hammer slam, and the cracked glass shatters under her');
    // a bounce plate: a slam on it springs her high
    await game(page, '(g.boss = null, g.dialog = null, g.setHp("enzo", 99), true)');
    await at('anvilhall', 21, 14);
    const y0 = (await st(page)).y;
    await page.keyboard.down('KeyZ');
    await until(page, (y) => window.__bellspire().game.body.y < y - 12, y0);
    await page.keyboard.down('ArrowDown'); await page.keyboard.press('KeyX');
    await until(page, () => window.__bellspire().game.hero.dora.act?.kind === 'slam');
    await page.keyboard.up('ArrowDown');
    let top = y0;
    for (let i = 0; i < 40; i++) { top = Math.min(top, (await st(page)).y); await page.waitForTimeout(40); }
    await page.keyboard.up('KeyZ');
    assert.ok(y0 - top > 7 * 16, `a slam on the bounce plate springs her ${Math.round((y0 - top) / 16)} tiles up`);
    assert.ok(await posed('dora:bounce'), 'Dora shows the bounce');
    ok(`a slam on the anvil hall's bounce plate springs Dora ${Math.round((y0 - top) / 16)} tiles high`);
  }

  // ─── Resonance ────────────────────────────────────────────────────────────
  {
    await game(page, `(g.save.abilities.push('resonance'), g.save.flags.push('boss:founder'), true)`);
    await tagTo(page, 'enzo');
    await at('prism', 2, 14);
    await game(page, '(g.save.heroes.enzo.mp = 99, true)');
    await page.keyboard.down('ArrowUp'); await page.keyboard.press('KeyV');
    await until(page, () => window.__bellspire().game.notes.some((n) => n.key.startsWith('prism:x')));
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(400); await shot('85-crystal-bridge-1280x800');
    assert.ok(await posed('enzo:resWind') || await posed('enzo:resRing'), 'Enzo rings out with Resonance');
    ok('↑ + V by a humming crystal: Resonance lays the crystal bridge over the lava');
    await at('caveshrine', 4, 14);
    const beam = INFO.get('crucible').doors.find((d) => d.ch === '&');
    assert.ok(!(await game(page, `g.doorOpen(${JSON.stringify(beam)})`)), 'the crucible’s beam door is shut');
    await game(page, '(g.save.heroes.enzo.mp = 99, true)');
    await page.keyboard.down('ArrowUp'); await page.keyboard.press('KeyV');
    await until(page, (d) => window.__bellspire().game.doorOpen(d), beam);
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(300); await shot('86-prism-beam-1280x800');
    await page.waitForTimeout(500);
    assert.ok(await posed('enzo:resBeam'), `Enzo holds the beam pose (${JSON.stringify(await page.evaluate(() => [...window.__poses].filter((p) => p.startsWith('enzo'))))})`);
    ok('↑ + V by a prism: its beam opens the beam door, and Enzo holds the beam pose');
  }

  // ─── the four foes ────────────────────────────────────────────────────────
  {
    const seen = new Set();
    for (const [room, c] of [['channel', 15], ['vents', 14], ['prism', 20], ['snails', 20], ['glassstair', 10], ['anvilhall', 10]]) {
      await dbg(page, 'teleport', room, c, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(400);
      for (const k of await game(page, 'g.enemies.map((e) => e.kind)')) seen.add(k);
    }
    for (const k of ['ingot', 'ember', 'cbat', 'gsnail']) assert.ok(seen.has(k), `a ${k} lives in the foundry (${[...seen]})`);
    ok(`the four new foes are out in the foundry (${['ingot', 'ember', 'cbat', 'gsnail'].join(', ')})`);
  }

  // ─── the guardians, and the endings ───────────────────────────────────────
  {
    for (const id of ['founder', 'choir', 'hollow']) {
      await dbg(page, 'fightBoss', id);
      await until(page, () => !!window.__bellspire().game.boss);
      for (let i = 0; i < 60 && ['wait', 'intro'].includes((await st(page)).boss?.st); i++) { if ((await st(page)).dialog) await page.keyboard.press('KeyZ'); await page.waitForTimeout(100); }
      await page.waitForTimeout(1500);
      if (id === 'founder') {
        await page.getByText(/V frost the Founder|tag to Enzo to frost it/).first().waitFor({ timeout: 3000 });
        ok('the Founder fight shows the helping hand’s frost prompt');
      }
      await page.screenshot({ path: `.shots/bellspire/87-foundry-${id}.png` });
      await bad(page, `the ${id} fight`);
      if (id === 'hollow') break;
      await calmBoss(page);
      for (let i = 0; i < 60 && (await st(page)).dialog; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(80); }
      ok(`the ${id} fight draws, and calms`);
    }
    await calmBoss(page);
    for (let i = 0; i < 80 && (await page.evaluate(() => window.__bellspire().screen)) !== 'ending'; i++) { if ((await st(page)).dialog) await page.keyboard.press('KeyZ'); await page.waitForTimeout(100); }
    await page.getByRole('heading', { name: 'The Hollow Bell is whole' }).waitFor();
    await page.screenshot({ path: '.shots/bellspire/88-foundry-ending.png' });
    await bad(page, 'the foundry ending');
    ok('calming the Hollow Bell plays the foundry’s ending page');
    // Keep exploring, find everything: the third epilogue
    await page.getByRole('button', { name: /Keep exploring/ }).click();
    await until(page, () => window.__bellspire().screen === 'game');
    await dbg(page, 'findAll');
    for (let i = 0; i < 80 && (await page.evaluate(() => window.__bellspire().screen)) !== 'ending'; i++) { if ((await st(page)).dialog) await page.keyboard.press('KeyZ'); await page.waitForTimeout(120); }
    await page.getByRole('heading', { name: 'The Hollow Bell is whole' }).waitFor();
    assert.ok(await page.locator('.bs-end-full3').isVisible(), 'the third epilogue’s picture');
    await page.screenshot({ path: '.shots/bellspire/89-foundry-epilogue.png' });
    ok('with everything found, the third epilogue plays');
  }
  assert.deepEqual(errors, [], 'no page errors in the foundry');
  await page.context().close();

  // ─── no "undefined" or "NaN": every tab with the foundry's gear, perks and trials ─────
  {
    const p = await open();
    await finishedBelfry(p, ",'hammer','resonance'");
    await dbg(p, 'skipDialog'); await dbg(p, 'findAll');
    await p.evaluate(() => { const g = window.__bellspire().game; for (const id of ['obsidian-edge', 'ladle-staff', 'forge-apron', 'ash-smock', 'cinder-charm']) if (!g.save.gear.includes(id)) g.save.gear.push(id); g.save.recast = { 'bronze-sword': 'keen' }; });
    await p.keyboard.press('Escape'); await until(p, () => !!window.__bellspire().menu);
    for (const t of ['Map', 'Gear', 'Items', 'Trials', 'Guide', 'Settings']) {
      await p.getByRole('tab', { name: t }).click(); await p.waitForTimeout(80);
      await bad(p, `the ${t} tab`);
      if (t === 'Gear') for (let i = 0; i < await p.locator('.bs-slot').count(); i++) {
        await p.locator('.bs-slot').nth(i).click(); await p.waitForTimeout(40);
        for (let j = 0; j < await p.locator('.bs-gear-pick li').count(); j++) { await p.locator('.bs-gear-pick li').nth(j).hover(); await bad(p, `gear slot ${i}, item ${j}`); }
      }
      if (t === 'Trials') for (const name of ['Forge Sprint', 'Glass Echo', 'Grand Guardian Rush']) assert.ok(await p.getByText(name).first().isVisible(), `the Trials list ${name}`);
    }
    ok('no “undefined” or “NaN” in any tab, the foundry’s gear and its recast perk, and the three new trials listed');
    await p.context().close();
  }

  // ─── phones ──────────────────────────────────────────────────────────────
  for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const p = await open(vp, true);
    await finishedBelfry(p, ",'hammer','resonance'");
    await dbg(p, 'skipDialog');
    await game(p, '(g.lead = "dora", g.save.lead = "dora", true)');
    await dbg(p, 'teleport', 'crucible', 49, 14); await dbg(p, 'skipDialog'); await p.waitForTimeout(300); await game(p, '(g.enemies = [], true)');
    const down = (l, id = 2) => p.dispatchEvent(`button[aria-label="${l}"]`, 'pointerdown', { pointerId: id });
    const up = (l, id = 2) => p.dispatchEvent(`button[aria-label="${l}"]`, 'pointerup', { pointerId: id });
    // the slam on the pad: Jump, then ▼ + Hit
    await down('Jump', 3); await p.waitForTimeout(200);
    await down('▼', 4); await down('Hit', 5); await p.waitForTimeout(60); await up('Hit', 5); await up('Jump', 3);
    await until(p, (d) => window.__bellspire().game.doorOpen(d), INFO.get('crucible').doors.find((d) => d.ch === '8'));
    await up('▼', 4);
    await p.waitForTimeout(300); await dbg(p, 'skipDialog'); await game(p, '(g.boss = null, true)');
    await bad(p, 'the foundry on a phone');
    assert.ok(await noSideScroll(p), 'nothing scrolls sideways');
    await p.screenshot({ path: `.shots/bellspire/90-foundry-${vp.width}x${vp.height}.png` });
    // the heat gauge fits the HUD
    await dbg(p, 'teleport', 'crucible', 10, 14); await dbg(p, 'skipDialog');
    await until(p, () => window.__bellspire().game.heat > 10, undefined, 30000);
    const hb = await p.locator('.bs-heat').boundingBox();
    assert.ok(hb && hb.x >= 0 && hb.x + hb.width <= vp.width + 1 && hb.y >= 0, 'the heat gauge is on screen');
    // the forge panel and the map fit
    await game(p, '(window.__bellspire().game.drainEvents(), true)');
    await p.getByRole('button', { name: 'Menu' }).tap();
    await until(p, () => window.__bellspire().menu === 'map');
    assert.ok(await noSideScroll(p), 'the map menu fits');
    await bad(p, 'the map on a phone');
    await p.screenshot({ path: `.shots/bellspire/91-foundry-map-${vp.width}x${vp.height}.png` });
    ok(`phone ${vp.width}×${vp.height}: the slam on the pad, the heat gauge on screen, the map menu fits, nothing scrolls sideways`);
    await p.context().close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
  console.log(`bellspire foundry e2e: ${pass} passed`);
} finally {
  await browser.close();
}
