// The Sunken Bellspire in the browser: the title (settings, the way home), a new game and the intro, every player
// action with the real keys (move, jump, drop through a ledge, climb, attack, the Whirl Slash, tag, the Lantern Bolt,
// dash, the lantern, the Bell Chime, the Ember Ring, use), each locked action saying why, the shrine, Wayra's shop,
// a mural, the pause menu (map and travel, gear, items, guide, settings and a key rebind), a water bell, a lantern
// hatch, a boss fight, the ending, the save across a reload and a corrupt save, and phones held sideways and upright
// with the on-screen pad, all with no page errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
const scr = (page) => page.evaluate(() => window.__bellspire().screen);
const until = async (page, fn, arg, timeout = 15000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 50 }); } catch (e) {
    throw new Error(`${e.message}\n  game: ${JSON.stringify(await st(page).catch(() => null))}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__bellspire()[f](...args), [fn, a]);
const game = (page, expr) => page.evaluate((e) => { const g = window.__bellspire().game; return new Function('g', `return (${e})`)(g); }, expr);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const hold = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
// hold V long enough for a charged spell (counted in game ticks, so a slow frame rate can't cut it short)
const charge = async (page) => { await page.waitForTimeout(150); await page.keyboard.down('KeyV'); await until(page, () => window.__bellspire().game.leadRt.castHold >= 30); await page.keyboard.up('KeyV'); };
const chord = async (page, a, b, ms = 120) => { await page.keyboard.down(a); await page.waitForTimeout(40); await page.keyboard.down(b); await page.waitForTimeout(ms); await page.keyboard.up(b); await page.keyboard.up(a); };
const toast = async (page, re) => { await until(page, (r) => { const t = window.__bellspire().state?.toast; return t && new RegExp(r).test(t); }, re.source); return (await st(page)).toast; };
// Shift until the wanted hero leads (a first visit to a room can open a talk, which takes the key instead)
const tagTo = async (page, who) => {
  for (let i = 0; i < 10 && (await st(page)).lead !== who; i++) {
    if ((await st(page)).dialog) await dbg(page, 'skipDialog');
    await page.keyboard.press('ShiftLeft'); await page.waitForTimeout(250);
  }
  assert.equal((await st(page)).lead, who, JSON.stringify(await page.evaluate(() => { const g = window.__bellspire().game; return { s: window.__bellspire().state, cd: g.tagCd, menu: window.__bellspire().menu, boss: !!g.boss }; })));
};
// read through the boss's opening lines (Z), then calm it at once
const calmBoss = async (page) => {
  for (let i = 0; i < 80 && ['wait', 'intro'].includes((await st(page)).boss?.st); i++) {
    if ((await st(page)).dialog) await page.keyboard.press('KeyZ');
    await page.waitForTimeout(100);
  }
  await game(page, 'g.damageBoss(99999, g.boss.x, g.boss.y)');
  assert.ok((await game(page, 'g.boss.calm')), 'the boss calms');
};
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/bellspire`); await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.equal(await scr(page), 'title');
  assert.ok(await page.locator('.bs-logo').isVisible());
  assert.equal(await page.locator('a', { hasText: 'Arcade' }).getAttribute('href'), '/');
  assert.equal(await page.locator('button', { hasText: 'Continue' }).count(), 0, 'no Continue without a save');
  ok('the title, with the way home and no Continue');
  await page.getByRole('button', { name: 'Settings' }).click();
  assert.ok(await page.locator('.bs-settings').isVisible());
  await page.getByRole('button', { name: 'Done' }).click();
  ok('settings open from the title');

  // ─── a new game ──────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'New game' }).click();
  await ready(page);
  await until(page, () => window.__bellspire().screen === 'game' && window.__bellspire().state?.dialog);
  assert.ok(await page.locator('.bs-dialog').isVisible(), 'the intro talks');
  for (let i = 0; i < 20 && (await st(page)).dialog; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(60); }
  assert.ok(!(await st(page)).dialog, 'Z moves the talk along to the end');
  ok('a new game opens with the intro, read through with Z');
  await dbg(page, 'skipDialog');
  {
    const fb = await page.locator('canvas.bs-canvas').boundingBox();
    assert.ok(fb.width >= 1280 * 0.95 && fb.height >= 800 * 0.95, `the picture fills the screen (${fb.width}×${fb.height})`);
    const px = await page.evaluate(() => { const c = document.querySelector('canvas.bs-canvas'); return c.getBoundingClientRect().width / c.width; });
    assert.equal(px, Math.round(px), 'with whole-number pixels');
  }
  ok('the picture fills a 1280×800 screen at a whole-number scale');
  const s0 = await st(page);
  await hold(page, 'ArrowRight', 500);
  assert.ok((await st(page)).x > s0.x + 30, 'right arrow runs');
  await hold(page, 'ArrowLeft', 300);
  ok('arrows move');
  await page.waitForTimeout(300);
  const y0 = (await st(page)).y;
  await page.keyboard.down('KeyZ');
  await until(page, (y) => window.__bellspire().state.y < y - 30, y0);
  await page.keyboard.up('KeyZ');
  ok('Z jumps');
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyX');
  await until(page, () => !!window.__bellspire().game.leadRt.act);
  ok('X swings');
  await page.keyboard.press('KeyC');
  assert.match(await toast(page, /Reed Dash/), /hasn’t found the Reed Dash/);
  ok('C without the dash says why');
  const mp0 = (await st(page)).heroes.dora.mp;
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyV');
  await until(page, (m) => window.__bellspire().state.heroes.dora.mp < m, mp0);
  ok('V as Dora: the Whirl Slash, for MP');
  await page.waitForTimeout(600);
  await page.keyboard.press('ShiftLeft');
  await until(page, () => window.__bellspire().state.lead === 'enzo');
  await page.locator('.bs-hero-lead', { hasText: 'Enzo' }).waitFor({ timeout: 3000 }); // the HUD shows who leads
  ok('Shift tags Enzo in');
  const emp = (await st(page)).heroes.enzo.mp;
  await page.keyboard.press('KeyV');
  await until(page, (m) => window.__bellspire().state.heroes.enzo.mp < m, emp);
  ok('V as Enzo: a Lantern Bolt');
  await page.waitForTimeout(300);
  await chord(page, 'ArrowDown', 'KeyV');
  assert.match(await toast(page, /Moonwick/), /needs the Moonwick/);
  ok('↓ + V before the Moonwick says why');
  await page.waitForTimeout(300);
  await chord(page, 'ArrowUp', 'KeyV');
  assert.match(await toast(page, /Bell Chime/), /hasn’t learned the Bell Chime/);
  ok('↑ + V before the Bell Chime says why');
  await dbg(page, 'setHp', 'enzo', 34);
  await game(page, 'g.save.heroes.enzo.mp = 20');
  await charge(page);
  assert.match(await toast(page, /Ember Ring/), /hasn’t learned the Ember Ring/);
  ok('holding V before the Ember Ring says why (and casts a bolt instead)');
  await page.waitForTimeout(900);
  await page.keyboard.press('ShiftLeft');
  await until(page, () => window.__bellspire().state.lead === 'dora');

  // ─── the shrine, Wayra and a mural ───────────────────────────────────────
  await dbg(page, 'teleport', 'landing', 5, 14);
  await page.waitForTimeout(200);
  await until(page, () => !!document.querySelector('.bs-shrine-prompt'));
  assert.match(await page.locator('.bs-shrine-prompt').innerText(), /Rest/);
  await dbg(page, 'setHp', 'dora', 5);
  await page.keyboard.press('ArrowUp');
  await until(page, () => window.__bellspire().state.heroes.dora.hp > 30);
  assert.ok((await page.evaluate((k) => localStorage.getItem(k), KEY)) !== null, 'resting saves');
  ok('↑ at the candle shrine rests, heals and saves');

  // ─── shrine travel: ↑ rests, X opens travel ──────────────────────────────
  await dbg(page, 'teleport', 'landing', 4, 14); await page.waitForTimeout(250);
  assert.match(await page.locator('.bs-shrine-prompt').innerText(), /↑ Rest · X Travel/);
  ok('at a lit shrine a prompt says “↑ Rest · X Travel”, with the real keys');
  {
    const pr = await page.locator('.bs-shrine-prompt').boundingBox(), cv = await page.locator('canvas.bs-canvas').boundingBox();
    const k = cv.width / (await page.evaluate(() => window.__bellspire().scene.vw));
    const face = await page.evaluate(() => { const { game: g, scene: s } = window.__bellspire(); return { x: g.body.x - s.cam.x, y: g.body.y - 38 - s.cam.y }; });
    assert.ok(pr.y + pr.height <= cv.y + face.y * k + 2, 'the prompt sits above the heroes’ heads');
  }
  ok('the shrine prompt never covers a face');
  await page.keyboard.press('KeyX');
  await until(page, () => window.__bellspire().menu === 'map');
  assert.match(await page.locator('.bs-travel-note').innerText(), /Light another shrine to travel/);
  assert.equal(await game(page, '!!g.leadRt.act'), false, 'X opened the map instead of swinging');
  await page.keyboard.press('Escape');
  await until(page, () => window.__bellspire().menu === null);
  ok('with one shrine lit, X at it opens the map, which says to light another; Esc cancels');
  await dbg(page, 'teleport', 'chapel', 16, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(300);
  await until(page, () => window.__bellspire().game.atShrine());
  assert.match(await page.locator('.bs-shrine-prompt').innerText(), /Rest to light/);
  await dbg(page, 'setHp', 'dora', 5);
  await page.keyboard.press('ArrowUp');
  assert.match(await toast(page, /Shrines are linked/), /Shrines are linked: ↑ to rest, X to travel\./);
  assert.equal((await st(page)).heroes.dora.hp, await game(page, 'g.stats("dora").maxHp'), 'resting fills HP');
  assert.equal(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).shrine, 'chapel', 'and saves at this shrine');
  ok('↑ at an unlit shrine rests, lights it and saves, and the tip says how to travel');
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyX');
  await until(page, () => window.__bellspire().menu === 'map');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  assert.match(await page.locator('.bs-shrine-pick').innerText(), /Landing Candle/);
  await page.keyboard.press('KeyZ');
  await until(page, () => window.__bellspire().menu === null && window.__bellspire().state.room === 'landing');
  assert.match(await toast(page, /Arrived/), /Arrived at the Landing Candle/);
  await page.waitForTimeout(900);
  await page.screenshot({ path: '.shots/bellspire/17-travel-arrive.png' });
  assert.ok((await st(page)).heroes.dora.hp > 0);
  ok('X at a lit shrine opens travel; → then Z travels, with the shrine’s name on arrival');
  // from the map in assist mode: tap a candle, then Travel here
  await dbg(page, 'teleport', 'gate', 10, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await until(page, () => window.__bellspire().menu === 'map');
  const icon = await page.evaluate(() => {
    const g = window.__bellspire().game, cv = document.querySelector('canvas.bs-map'), r = cv.getBoundingClientRect(), k = r.width / cv.width;
    void g;
    const t = window.__bellspire().shrineIcon('chapel');
    return { x: r.left + t.x * k, y: r.top + t.y * k };
  });
  await page.mouse.click(icon.x, icon.y);
  await page.locator('.bs-shrine-pick', { hasText: 'Chapel Candle' }).getByRole('button', { name: 'Travel here' }).click();
  await until(page, () => window.__bellspire().state.room === 'chapel');
  ok('tapping a lit candle on the map and Travel here travels (from anywhere, with the helping hand)');
  // a fight at a shrine still swings: an awake frog close by
  await dbg(page, 'teleport', 'gate', 20, 14); await dbg(page, 'skipDialog');
  await page.evaluate(() => { window.__frog = window.__bellspire().game.enemies.find((e) => e.kind === 'frog'); });
  await dbg(page, 'teleport', 'landing', 4, 14); await page.waitForTimeout(250);
  await page.evaluate(() => { const g = window.__bellspire().game; g.enemies.push(Object.assign(window.__frog, { st: 'idle', x: g.body.x + 40, y: g.body.y, alive: true })); });
  await page.evaluate(() => { const h = window.__bellspire(); h.state; window.__swung = false; const g = h.game; const id = setInterval(() => { if (g.leadRt.act?.kind === 'swing') { window.__swung = true; clearInterval(id); } }, 5); });
  for (let i = 0; i < 5 && !(await page.evaluate(() => window.__swung)); i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(250); }
  assert.ok(await page.evaluate(() => window.__swung), 'Dora swung');
  assert.equal(await page.evaluate(() => window.__bellspire().menu), null, 'the map stayed shut');
  await game(page, '(g.enemies = g.enemies.filter((e) => e.kind !== "frog"), true)');
  ok('X at a shrine with an awake foe close by swings instead of opening travel');
  const shopAt = 22; // Wayra's stall in the landing
  await dbg(page, 'teleport', 'landing', shopAt, 14);
  await page.waitForTimeout(200);
  await until(page, () => /Wayra/.test(document.querySelector('.bs-hint')?.textContent ?? ''));
  await page.keyboard.press('ArrowUp');
  await until(page, () => window.__bellspire().state.dialog);
  for (let i = 0; i < 20 && (await st(page)).dialog; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(60); }
  await until(page, () => window.__bellspire().shop);
  assert.ok(await page.locator('.bs-shop').isVisible());
  ok('↑ beside Wayra: a hello, then the shop');
  await dbg(page, 'coins', 5);
  await page.waitForTimeout(250);
  const ring = page.locator('.bs-shop li', { hasText: 'Lucky Reed Ring' });
  assert.ok(await ring.locator('button').isDisabled(), 'too dear: the button is off');
  assert.match(await ring.locator('.bs-why').innerText(), /Needs \d+ more coins/);
  ok('a buy you can’t afford says how many coins it needs');
  await dbg(page, 'coins', 200);
  await page.waitForTimeout(250);
  await page.locator('.bs-shop li', { hasText: 'Quinoa' }).locator('button').click();
  await until(page, () => window.__bellspire().state.coins < 200);
  assert.match(await page.locator('.bs-msg').innerText(), /Bought/);
  await ring.locator('button').click();
  await until(page, () => window.__bellspire().game.save.gear.includes('reed-ring'));
  assert.ok(await ring.locator('button', { hasText: 'Owned' }).isDisabled(), 'gear is bought once');
  ok('buying food and gear');
  await page.getByRole('button', { name: 'Goodbye' }).click();
  await until(page, () => !window.__bellspire().shop);
  await dbg(page, 'teleport', 'landing', 30, 14);
  await page.waitForTimeout(200);
  await until(page, () => /mural/.test(document.querySelector('.bs-hint')?.textContent ?? ''));
  await page.keyboard.press('ArrowUp');
  await until(page, () => window.__bellspire().mural !== null);
  assert.ok(await page.locator('.bs-mural p').isVisible());
  await page.keyboard.press('Escape');
  await until(page, () => window.__bellspire().mural === null);
  ok('↑ at a mural shows its painting and story; Esc closes it');

  // ─── the menu ────────────────────────────────────────────────────────────
  await page.keyboard.press('Escape');
  await until(page, () => window.__bellspire().menu === 'map');
  assert.ok(await page.locator('canvas.bs-map').isVisible());
  assert.match(await page.locator('.bs-pct').innerText(), /% explored/);
  const travel = page.locator('.bs-travel li', { hasText: 'Unlit shrine' }).first();
  assert.ok(await travel.locator('button').isDisabled());
  assert.match(await travel.locator('.bs-why').innerText(), /Rest at it once/);
  ok('Esc opens the map, with unlit shrines saying how to light them');
  await page.getByRole('tab', { name: 'Gear' }).click();
  await page.locator('.bs-slot', { hasText: 'Ring' }).first().click();
  await page.locator('.bs-gear-pick li', { hasText: 'Lucky Reed Ring' }).getByRole('button', { name: 'Equip' }).click();
  await until(page, () => window.__bellspire().game.save.equip.dora.ring === 'reed-ring');
  ok('Gear: equip a ring on Dora');
  await page.locator('.bs-gear-hero').nth(1).locator('.bs-slot', { hasText: 'Weapon' }).click();
  const sword = page.locator('.bs-gear-pick li', { hasText: 'Bronze Sword' });
  assert.ok(await sword.locator('button').isDisabled());
  assert.match(await sword.locator('.bs-why').innerText(), /Only Dora/);
  ok('Gear: Enzo can’t take Dora’s sword, and it says so');
  await page.getByRole('tab', { name: 'Items' }).click();
  await dbg(page, 'setHp', 'dora', 5);
  await page.waitForTimeout(150);
  await page.locator('.bs-items li', { hasText: 'Quinoa' }).getByRole('button', { name: 'Use' }).click();
  await until(page, () => window.__bellspire().state.heroes.dora.hp > 5);
  assert.ok(await page.locator('.bs-items li.bs-locked').first().isVisible(), 'abilities not found yet show as ???');
  ok('Items: eat a quinoa cake; unfound abilities are hidden');
  await page.getByRole('tab', { name: 'Guide' }).click();
  assert.match(await page.locator('.bs-guide').innerText(), /Bell Chime/);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.locator('.bs-key', { hasText: 'Jump' }).click();
  await page.keyboard.press('KeyQ');
  await until(page, () => /Q/.test([...document.querySelectorAll('.bs-key')].find((b) => /Jump/.test(b.textContent)).textContent));
  ok('Guide, and Settings: rebind Jump to Q');
  await page.locator('.bs-toggle', { hasText: 'Music' }).locator('input').uncheck();
  assert.equal(await page.locator('.bs-toggle', { hasText: 'Music' }).locator('input').isChecked(), false);
  await page.keyboard.press('Escape');
  await until(page, () => window.__bellspire().menu === null);
  await page.waitForTimeout(500);
  const yq = (await st(page)).y;
  await page.keyboard.down('KeyQ');
  await until(page, (y) => window.__bellspire().state.y < y - 20, yq);
  await page.keyboard.up('KeyQ');
  ok('the new Jump key works');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Reset keys' }).click();
  await page.keyboard.press('Escape');

  // ─── gear you can see ────────────────────────────────────────────────────
  {
    // one swing at a frog right in front of Dora: how much it takes
    const swingAt = async () => {
      await dbg(page, 'teleport', 'gate', 18, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(250);
      await tagTo(page, 'dora');
      await game(page, '(() => { const f = g.enemies.find((e) => e.kind === "frog"); g.enemies = [f]; f.hp = 999; f.alive = true; f.x = g.body.x + 20; f.y = g.body.y; f.st = "idle"; g.body.face = 1; g.leadRt.inv = 999; return true; })()');
      await page.keyboard.press('KeyX');
      await page.waitForTimeout(400);
      return game(page, '999 - g.enemies[0].hp');
    };
    const before = await swingAt();
    await game(page, '(g.save.gear.push("reed-cutter", "snail-coat"), true)');
    await page.keyboard.press('Escape');
    await until(page, () => window.__bellspire().menu === 'map');
    await page.getByRole('tab', { name: 'Gear' }).click();
    const doraGear = page.locator('.bs-gear-hero').first();
    await doraGear.locator('.bs-slot', { hasText: 'Weapon' }).click();
    const cutter = page.locator('.bs-gear-pick li', { hasText: 'Reed-Cutter' });
    await cutter.click();
    assert.match(await cutter.locator('.bs-compare').innerText(), /ATK \d+ → \d+/);
    assert.match(await cutter.locator('.bs-compare').innerText(), /Swings come round faster/);
    assert.equal(await cutter.locator('canvas.bs-preview').getAttribute('data-weapon'), 'reed-cutter', 'the preview wears it before it is equipped');
    await page.screenshot({ path: '.shots/bellspire/29-gear-menu.png' });
    await cutter.getByRole('button', { name: 'Equip' }).click();
    await doraGear.locator('.bs-slot', { hasText: 'Coat' }).click();
    await page.locator('.bs-gear-pick li', { hasText: 'Snail-Shell Coat' }).getByRole('button', { name: 'Equip' }).click();
    assert.equal(await doraGear.locator('canvas.bs-preview').first().getAttribute('data-coat'), 'snail-coat', 'the hero’s own preview changes');
    ok('Gear: picking an item shows what it changes and a preview; equipping a blade and a coat');
    await page.getByRole('button', { name: 'Close menu' }).click();
    await until(page, () => window.__bellspire().menu === null);
    assert.match(await toast(page, /Reed-Cutter/), /Dora equipped the Reed-Cutter and the Snail-Shell Coat\./);
    await until(page, () => { const w = window.__bellspire().scene.worn.dora; return w.weapon === 'reed-cutter' && w.coat === 'snail-coat'; });
    assert.ok(await page.evaluate(() => window.__bellspire().scene.shineT.dora > 0), 'a shine on Dora');
    await page.waitForTimeout(200);
    await page.screenshot({ path: '.shots/bellspire/29-gear-in-game.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
    const after = await swingAt();
    assert.ok(after > before, `the Reed-Cutter hits harder (${before} → ${after})`);
    ok('closing the menu: a toast and a shine, Dora is drawn in the Reed-Cutter and the Snail-Shell Coat, and hits harder');
    // the lantern never takes a coat's colour, and every weapon stands off every coat
    const leaks = await page.evaluate(() => window.__bellspire().lanternCheck());
    assert.ok(Object.values(leaks).every((n) => n === 0), `no lantern pixel changes with the coat (${JSON.stringify(leaks)})`);
    // the check isn't blind: label one frame's lantern as coat (the leak it is there to catch) and it must see it
    const control = await page.evaluate(() => window.__bellspire().lanternCheckControl(8));
    assert.ok(control > 10, `the lantern check catches a lantern labelled coat (${control} pixels)`);
    // contrast in the worst frame of all 80, so a pose can't hide behind the idle frames
    const cmp = await page.evaluate(() => window.__bellspire().gearContrast());
    const weak = Object.entries(cmp).filter(([, v]) => v.dE < 30 || v.dL < 15);
    assert.deepEqual(weak, [], 'every weapon reads against every coat in every frame (ΔE ≥ 30, ΔL ≥ 15)');
    ok(`Enzo's lantern keeps its colour in every coat in every frame (${Object.keys(leaks).length} pairs; the check sees a planted leak of ${control} pixels); every weapon and coat pair has ΔE ≥ 30 and ΔL ≥ 15 in its worst frame (lowest ΔE ${Math.min(...Object.values(cmp).map((v) => v.dE))}, ΔL ${Math.min(...Object.values(cmp).map((v) => v.dL))})`);
    // back into the starting gear for the rest of the run
    await game(page, '(g.equip("dora", "weapon", "bronze-sword"), g.equip("dora", "coat", "teal-coat"), true)');
  }

  // ─── doorways on the maps ───────────────────────────────────────────────
  {
    await dbg(page, 'teleport', 'landing', 15, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(400);
    const mm = await page.locator('.bs-minimap').boundingBox();
    const clip = { x: mm.x - 4, y: mm.y - 4, width: mm.width + 8, height: mm.height + 8 };
    await page.evaluate(() => window.__bellspire().exitLayer(false)); await page.waitForTimeout(150);
    await page.screenshot({ path: '.shots/bellspire/31-minimap-exits-before-1280x800.png', clip });
    await page.evaluate(() => window.__bellspire().exitLayer(true)); await page.waitForTimeout(150);
    await page.screenshot({ path: '.shots/bellspire/31-minimap-exits-after-1280x800.png', clip });
    const drawn = await page.evaluate(() => window.__bellspire().drawnExits('mini').filter((d) => d.from === 'landing'));
    const ex = await page.evaluate(() => window.__bellspire().exits('landing'));
    ok(ex.some((e) => e.cross && e.toArea === 'halls') && ex.some((e) => e.door === 'd' && e.toArea === 'docks'), 'the landing knows its ways into the Flooded Halls and (behind the dash door) the Reed Docks');
    assert.ok(drawn.some((d) => d.kind === 'area' && d.toArea === 'halls'), `the minimap marks the way into the Flooded Halls (${JSON.stringify(drawn)})`);
    const lock = drawn.find((d) => d.to === 'dgate');
    assert.equal(lock?.kind, (await st(page)).abilities.includes('dash') ? 'area' : 'lock', 'the door to the docks is a lock until it opens');
    await page.keyboard.press('Escape');
    await until(page, () => window.__bellspire().menu === 'map');
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.__bellspire().drawnExits('map').some((d) => d.kind === 'area')), 'and the pause map too');
    assert.match(await page.locator('.bs-legend').innerText(), /another area/);
    // the stats line says its numbers plainly
    const c = await page.evaluate(() => window.__bellspire().state.completion);
    const line = await page.locator('.bs-stats-line').innerText();
    assert.ok(line.includes(`Guardians ${c.bosses} of 5`) && line.includes(`Rooms ${c.cells} of`) && line.includes(`Murals ${c.murals} of 10`), `the stats line reads clearly (“${line}”)`);
    await page.screenshot({ path: '.shots/bellspire/31-map-exits.png' });
    await page.getByRole('button', { name: 'Close menu' }).click();
    await until(page, () => window.__bellspire().menu === null);
    // the digits at UI size, for a look at 5/S, 8/B, 0/O, 1/l, 2/Z: a line in the HUD's own font at 16 px and 13 px
    await page.evaluate(() => {
      const d = document.createElement('div'); d.id = 'digit-check';
      d.style.cssText = 'position:fixed;left:20px;top:120px;z-index:99;background:#16121e;padding:8px 10px;font-family:var(--pix);color:#f4e6c8;line-height:1.5';
      d.innerHTML = '<div style="font-size:16px">0123456789 · 5S 8B 0O 1l 2Z · Guardians 2 of 5 · 57% explored · 2/5</div><div style="font-size:13px">0123456789 · 5S 8B 0O 1l 2Z · Rooms 39 of 64 · 108 coins</div>';
      document.querySelector('main').appendChild(d);
    });
    await page.waitForTimeout(300);
    await page.locator('#digit-check').screenshot({ path: '.shots/bellspire/32-digits.png' });
    await page.evaluate(() => document.getElementById('digit-check').remove());
    ok('the maps draw doorways, area entrances and locks; the stats line and its numbers read plainly');
  }

  // ─── the throne's four seals ─────────────────────────────────────────────
  {
    // every ability, but the Reed Hydra skipped
    const was = await game(page, 'JSON.stringify({ a: g.save.abilities, f: g.save.flags })');
    await game(page, '(g.save.abilities = ["dash", "lantern", "double", "wallkick", "chime", "glide", "deep"], g.setFlag("boss:frog"), g.setFlag("boss:puma"), g.setFlag("boss:warden"), true)');
    // Ukumari's room, right beside the keeper
    await dbg(page, 'teleport', 'keeper', 16, 14);
    await dbg(page, 'skipDialog'); await page.waitForTimeout(300);
    assert.equal(await game(page, 'g.nearby()?.ch'), 'U', 'next to Ukumari');
    await page.keyboard.press('ArrowUp');
    await until(page, () => window.__bellspire().state.dialog);
    const said = [];
    for (let i = 0; i < 20 && (await st(page)).dialog; i++) { said.push(await page.evaluate(() => { const d = window.__bellspire().game.dialog; return d ? d.lines[d.i].text : ''; })); await page.keyboard.press('KeyZ'); await page.waitForTimeout(250); }
    const all = said.join(' ');
    assert.match(all, /the Reed Hydra in the Reed Docks/);
    assert.doesNotMatch(all, /Puma of the Murals in|Bell Warden in|Frog Idol in/);
    assert.equal(await game(page, 'g.flag("keeper")'), false, 'Ukumari keeps the door shut');
    ok('the hydra skipped: Ukumari names the Reed Hydra in the Reed Docks and the throne stays shut');
    await game(page, `(() => { const w = ${was}; g.save.abilities = w.a; g.save.flags = w.f; return true; })()`);
  }

  // ─── the guiding wisp ────────────────────────────────────────────────────
  {
    await dbg(page, 'teleport', 'landing', 15, 14); await dbg(page, 'skipDialog');
    await until(page, () => window.__bellspire().game.wisp.on);
    await page.keyboard.press('Escape');
    await until(page, () => window.__bellspire().menu === 'map');
    await page.getByRole('tab', { name: 'Settings' }).click();
    const box = page.getByRole('checkbox', { name: /^Guiding wisp/ });
    await box.uncheck();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await until(page, () => window.__bellspire().menu === null);
    await until(page, () => !window.__bellspire().game.wisp.on);
    await page.keyboard.press('Escape');
    await until(page, () => window.__bellspire().menu === 'map');
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByRole('checkbox', { name: /^Helping hand/ }).uncheck();
    assert.ok(await box.isDisabled(), 'the wisp setting is off while the helping hand is off');
    assert.match(await page.locator('label.bs-toggle', { hasText: /^Guiding wisp/ }).innerText(), /Needs the helping hand/);
    await page.getByRole('checkbox', { name: /^Helping hand/ }).check();
    await box.check();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await until(page, () => window.__bellspire().game.wisp.on);
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.shots/bellspire/33-wisp.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
    ok('the Guiding wisp setting hides and shows the wisp, and needs the helping hand');
  }

  // ─── ladders, ledges, doors, the dash ────────────────────────────────────
  await dbg(page, 'teleport', 'landing', 14, 14);
  await page.waitForTimeout(250);
  // the climb has its own back-view frames, which move only while the hero climbs
  await page.keyboard.down('ArrowDown');
  await until(page, () => window.__bellspire().scene.heroAnim[window.__bellspire().game.lead]?.state === 'climb');
  await page.waitForTimeout(250);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(120);
  const climbFrame = () => page.evaluate(() => { const a = window.__bellspire().scene.heroAnim[window.__bellspire().game.lead]; return { st: a.state, f: a.frame }; });
  const c0 = await climbFrame();
  assert.equal(c0.st, 'climb'); assert.ok(c0.f >= 16 && c0.f <= 19, `a climbing frame (${c0.f})`);
  await page.screenshot({ path: '.shots/bellspire/16-climb.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  await page.waitForTimeout(400);
  assert.deepEqual(await climbFrame(), c0, 'holding still on the ladder holds the frame');
  ok('on a ladder: the back-view climb frame, held while the hero holds still');
  await page.keyboard.down('ArrowDown');
  await until(page, () => window.__bellspire().state.room === 'well');
  await page.keyboard.up('ArrowDown');
  ok('↓ climbs down a ladder');
  await page.keyboard.down('ArrowUp');
  await until(page, () => window.__bellspire().state.room === 'landing');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  ok('↑ climbs up');
  // a ladder inside one room, climbed with ↑ held all the way: the hero ends standing on the top, and stays there
  await dbg(page, 'teleport', 'boathouse', 6, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(300);
  const ladderTop = await game(page, '(g.room.gy * 17 + 9) * 16');
  await page.keyboard.down('ArrowUp');
  await until(page, (t) => { const s = window.__bellspire().state; return s.ground && s.y === t; }, ladderTop);
  await page.waitForTimeout(1200);
  const onTop = await st(page);
  await page.keyboard.up('ArrowUp');
  assert.ok(onTop.ground && onTop.y === ladderTop, `still standing on the ladder top after holding ↑ (y ${onTop.y}, top ${ladderTop})`);
  await page.screenshot({ path: '.shots/bellspire/25-ladder-top.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  ok('holding ↑ climbs a ladder all the way and stands on its top');
  await dbg(page, 'teleport', 'landing', 32, 8);
  await until(page, () => window.__bellspire().state.ground);
  const ly = (await st(page)).y;
  await chord(page, 'ArrowDown', 'KeyZ');
  await until(page, (y) => window.__bellspire().state.y > y + 20, ly);
  ok('↓ + Z drops through a ledge');
  await dbg(page, 'teleport', 'landing', 54, 14);
  await page.waitForTimeout(150);
  await page.keyboard.down('ArrowRight');
  assert.match(await toast(page, /Dash/), /Needs Dora’s Reed Dash/);
  await page.keyboard.up('ArrowRight');
  ok('a blue door without the dash says what it needs');
  await dbg(page, 'give', 'dash');
  await until(page, () => window.__bellspire().scene.opening.size > 0, null, 3000);
  await page.waitForTimeout(250);
  await page.screenshot({ path: '.shots/bellspire/16-door-opening.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  ok('a door that can now open slides open');
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__bellspire().state.room === 'dgate');
  await page.keyboard.up('ArrowRight');
  ok('with the Reed Dash it opens');
  await dbg(page, 'teleport', 'landing', 8, 14);
  await dbg(page, 'skipDialog');
  await page.waitForTimeout(300);
  const dx0 = (await st(page)).x;
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(40); await page.keyboard.press('KeyC');
  await until(page, () => window.__bellspire().game.body.dashT > 0, null, 3000);
  await page.waitForTimeout(160); await page.keyboard.up('ArrowRight');
  const dx1 = (await st(page)).x;
  assert.ok(dx1 > dx0 + 50, `dashed ${dx1 - dx0}px`);
  ok('C dashes');
  await page.keyboard.press('ShiftLeft');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyC');
  assert.match(await toast(page, /Only Dora/), /Only Dora can dash/);
  ok('C as Enzo says only Dora can dash');

  // ─── a water bell, the lantern, a hatch, the chime ───────────────────────
  await dbg(page, 'teleport', 'nave', 1, 14);
  const nave = await page.evaluate(() => { const room = window.__bellspire().game.room; for (let y = 0; y < room.rows.length; y++) { const x = room.rows[y].indexOf('B'); if (x >= 0) return { c: x, r: y }; } return null; });
  await dbg(page, 'teleport', 'nave', nave.c - 1, nave.r);
  await tagTo(page, 'dora');
  const w0 = (await st(page)).water.halls;
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(30); await page.keyboard.up('ArrowRight');
  for (let i = 0; i < 6 && (await st(page)).water.halls === w0; i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(350); }
  assert.notEqual((await st(page)).water.halls, w0);
  assert.ok(await page.evaluate(() => [...window.__bellspire().scene.bellSwing.values()].some((v) => v > 0)), 'the bell swings');
  await page.screenshot({ path: '.shots/bellspire/16-bell-ring.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  ok('X on a water bell changes the water, and the bell swings with a ring');
  // a chest: ↑ lifts the lid
  await dbg(page, 'teleport', 'well', 22, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowUp');
  await until(page, () => [...window.__bellspire().scene.chestT.values()].some((v) => v < 99), null, 5000);
  await page.waitForTimeout(150);
  await page.screenshot({ path: '.shots/bellspire/16-chest.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  ok('↑ at a chest: the lid opens and the treasure bursts out');
  // numbers off a hit
  await dbg(page, 'teleport', 'gate', 18, 14); await dbg(page, 'skipDialog'); await page.waitForTimeout(250);
  await tagTo(page, 'dora');
  // the frog right in front of Dora
  await game(page, '(() => { const f = g.enemies.find((e) => e.kind === "frog"); f.x = g.body.x + 22; f.y = g.body.y; g.body.face = 1; return true; })()');
  await page.evaluate(() => { window.__nums = []; const s = window.__bellspire().scene, seen = new Set(s.nums); const id = setInterval(() => { for (const n of s.nums) if (!seen.has(n)) { seen.add(n); window.__nums.push(n.kind); } if (window.__nums.some((k) => k === 'hit' || k === 'big')) clearInterval(id); }, 10); });
  for (let i = 0; i < 8 && !(await page.evaluate(() => window.__nums.some((k) => k === 'hit' || k === 'big'))); i++) { await page.keyboard.press('KeyX'); await page.waitForTimeout(120); }
  assert.ok(await page.evaluate(() => window.__nums.some((k) => k === 'hit' || k === 'big')), `a damage number pops (${await page.evaluate(() => window.__nums.join())})`);
  await page.screenshot({ path: '.shots/bellspire/18-damage-numbers.png', clip: await page.locator('canvas.bs-canvas').boundingBox() });
  ok('a hit pops its damage in pixel numbers');
  // the minimap: shows, follows the room, and opens the map when tapped
  assert.ok(await page.locator('.bs-minimap').isVisible());
  assert.equal(await page.locator('.bs-minimap').getAttribute('data-room'), 'gate');
  await dbg(page, 'teleport', 'landing', 8, 14); await page.waitForTimeout(300);
  await until(page, () => document.querySelector('.bs-minimap')?.getAttribute('data-room') === 'landing');
  await page.screenshot({ path: '.shots/bellspire/19-minimap-1280x800.png' });
  await page.locator('.bs-minimap').click();
  await until(page, () => window.__bellspire().menu === 'map');
  await page.keyboard.press('Escape');
  ok('the minimap shows, follows the room, and a tap opens the map');
  await dbg(page, 'give', 'lantern');
  await dbg(page, 'teleport', 'well', 14, 15);
  await page.waitForTimeout(200);
  await tagTo(page, 'enzo');
  await chord(page, 'ArrowDown', 'KeyV');
  await until(page, () => window.__bellspire().state.lantern);
  ok('↓ + V raises the lantern');
  await page.keyboard.down('ArrowUp');
  await until(page, () => window.__bellspire().state.room !== 'well', null, 20000);
  await page.keyboard.up('ArrowUp');
  ok('the raised lantern opens the hatch and Enzo climbs through');
  await dbg(page, 'give', 'chime');
  await dbg(page, 'teleport', 'landing', 8, 14);
  await until(page, () => window.__bellspire().state.ground);
  await page.waitForTimeout(200);
  await chord(page, 'ArrowUp', 'KeyV');
  await until(page, () => window.__bellspire().game.rings.some((r) => r.kind === 'chime'));
  ok('↑ + V rings the Bell Chime');
  await game(page, `g.save.spells.push('ember')`);
  await game(page, 'g.save.heroes.enzo.mp = 20');
  await charge(page);
  await until(page, () => !!window.__bellspire().game.embers);
  ok('holding V and letting go: the Ember Ring');

  // ─── a boss and the ending ───────────────────────────────────────────────
  await dbg(page, 'fightBoss', 'frog');
  await page.keyboard.press('ShiftLeft');
  await page.keyboard.down('ArrowLeft');
  await until(page, () => window.__bellspire().state.boss?.st !== 'wait');
  await page.keyboard.up('ArrowLeft');
  for (let i = 0; i < 20 && (await st(page)).dialog; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(60); }
  await until(page, () => !!document.querySelector('.bs-boss'));
  assert.match(await page.locator('.bs-boss').innerText(), /Frog Idol/);
  ok('walking into the idol room starts the frog fight, with its health bar');
  await calmBoss(page);
  await until(page, () => window.__bellspire().state.dialog || window.__bellspire().game.flag('boss:frog'), null, 20000);
  for (let i = 0; i < 30 && !(await game(page, `g.flag('boss:frog')`)); i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(100); }
  assert.ok(await game(page, `g.flag('boss:frog')`));
  ok('the calmed frog gives its reward');
  await dbg(page, 'fightBoss', 'mother');
  await page.keyboard.down('ArrowRight');
  await until(page, () => window.__bellspire().state.boss?.st !== 'wait');
  await page.keyboard.up('ArrowRight');
  await calmBoss(page);
  for (let i = 0; i < 60 && (await scr(page)) !== 'ending'; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(120); }
  assert.equal(await scr(page), 'ending');
  assert.ok(await page.getByText('The bells ring again').isVisible());
  ok('calming the Lake Mother shows the ending');
  // under 100%: the ending says how the epilogue comes; keep exploring, find the rest, and it plays then
  assert.match(await page.locator('.bs-end-panel').innerText(), /the epilogue plays the moment you do/);
  await page.getByRole('button', { name: 'Keep exploring' }).click();
  await until(page, () => window.__bellspire().screen === 'game' && window.__bellspire().state);
  await dbg(page, 'skipDialog');
  assert.equal(await page.evaluate(() => window.__bellspire().findAll()), 100);
  for (let i = 0; i < 80 && (await scr(page)) !== 'ending'; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(120); }
  assert.equal(await scr(page), 'ending');
  assert.ok(await page.locator('.bs-end-full').count(), 'the epilogue picture');
  assert.match(await page.locator('.bs-end-panel').innerText(), /Everything found/);
  await page.screenshot({ path: '.shots/bellspire/34-epilogue.png' });
  await page.getByRole('button', { name: 'Title' }).click();
  await until(page, () => window.__bellspire().screen === 'title');
  await page.getByRole('button', { name: 'See the epilogue' }).click();
  await until(page, () => window.__bellspire().screen === 'ending');
  assert.ok(await page.locator('.bs-end-full').count(), 'the epilogue again from the title');
  ok('after the ending, finding the rest plays the epilogue; the title can show it again');
  await page.getByRole('button', { name: 'Title' }).click();
  await until(page, () => window.__bellspire().screen === 'title');
  assert.ok(await page.getByRole('button', { name: 'Continue' }).isVisible());
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await until(page, () => window.__bellspire().screen === 'game' && window.__bellspire().state);
  assert.ok((await st(page)).abilities.includes('dash'), 'the save comes back after a reload');
  ok('Continue after a reload picks the save back up');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Save and quit to title' }).click();
  await until(page, () => window.__bellspire().screen === 'title');
  ok('save and quit to the title');
  await page.getByRole('button', { name: 'New game' }).click();
  assert.ok(await page.locator('.bs-confirm').isVisible());
  await page.getByRole('button', { name: 'Keep my save' }).click();
  ok('New game over a save asks first');
  await page.evaluate((k) => localStorage.setItem(k, '{broken'), KEY);
  await page.reload(); await ready(page);
  assert.equal(await page.locator('button', { hasText: 'Continue' }).count(), 0);
  ok('a corrupt save is ignored');
  assert.ok(await noSideScroll(page));
  await page.context().close();

  // ─── phones ──────────────────────────────────────────────────────────────
  for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const p = await open(vp, true);
    await p.goto(`${base}/bellspire`); await p.evaluate((k) => localStorage.removeItem(k), KEY); await p.reload(); await ready(p);
    assert.ok(await noSideScroll(p), 'title fits');
    await p.getByRole('button', { name: 'New game' }).tap();
    await until(p, () => window.__bellspire().screen === 'game' && window.__bellspire().state);
    await dbg(p, 'skipDialog');
    assert.ok(await p.locator('.bs-pad').isVisible(), 'the on-screen pad shows on a touch screen');
    const box = await p.locator('canvas.bs-canvas').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= vp.width + 1, 'the picture fits');
    if (vp.width > vp.height) assert.ok(box.width >= vp.width * 0.95, `held sideways, the picture fills the width (${box.width})`);
    else assert.ok(box.width >= vp.width * 0.95 && box.y < 40, 'held upright, the picture spans the width at the top');
    await p.waitForTimeout(300);
    const py = (await st(p)).y;
    const jump = p.getByRole('button', { name: 'Jump' });
    const jb = await jump.boundingBox();
    await p.touchscreen.tap(jb.x + jb.width / 2, jb.y + jb.height / 2);
    await until(p, (y) => window.__bellspire().state.y < y - 4, py);
    const px = (await st(p)).x;
    await p.dispatchEvent('button[aria-label="▶"]', 'pointerdown', { pointerId: 2 });
    await p.waitForTimeout(400);
    await p.dispatchEvent('button[aria-label="▶"]', 'pointerup', { pointerId: 2 });
    assert.ok((await st(p)).x > px + 10, 'the pad moves the hero');
    {
      const mm = await p.locator('.bs-minimap').boundingBox();
      assert.ok(mm && mm.x >= 0 && mm.x + mm.width <= vp.width + 1 && mm.y >= 0, 'the minimap is on screen');
      const over = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const el of await p.locator('.bs-hero, .bs-pad-dir button, .bs-pad-act button').all()) assert.ok(!over(mm, await el.boundingBox()), 'the minimap covers no bar or pad button');
      await p.screenshot({ path: `.shots/bellspire/19-minimap-${vp.width}x${vp.height}.png` });
      // the doorways, before and after
      const clip = { x: Math.max(0, mm.x - 4), y: Math.max(0, mm.y - 4), width: mm.width + 8, height: mm.height + 8 };
      await p.evaluate(() => window.__bellspire().exitLayer(false)); await p.waitForTimeout(150);
      await p.screenshot({ path: `.shots/bellspire/31-minimap-exits-before-${vp.width}x${vp.height}.png`, clip });
      await p.evaluate(() => window.__bellspire().exitLayer(true)); await p.waitForTimeout(150);
      await p.screenshot({ path: `.shots/bellspire/31-minimap-exits-after-${vp.width}x${vp.height}.png`, clip });
      assert.ok(await p.evaluate(() => window.__bellspire().drawnExits('mini').some((d) => d.kind === 'area')), 'an area entrance on the phone minimap');
    }
    await p.getByRole('button', { name: 'Menu' }).tap();
    await until(p, () => window.__bellspire().menu === 'map');
    assert.ok(await noSideScroll(p), 'the menu fits');
    ok(`phone ${vp.width}×${vp.height}: the pad jumps and moves, the menu opens, nothing scrolls sideways`);
    await p.context().close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
  console.log(`bellspire e2e: ${pass} passed`);
} finally {
  await browser.close();
}
