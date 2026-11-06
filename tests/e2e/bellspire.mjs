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
  assert.equal((await st(page)).lead, who);
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
  await until(page, () => !!document.querySelector('.bs-hint'));
  assert.match(await page.locator('.bs-hint').innerText(), /Rest and save/);
  await dbg(page, 'setHp', 'dora', 5);
  await page.keyboard.press('ArrowUp');
  await until(page, () => window.__bellspire().state.heroes.dora.hp > 30);
  assert.ok((await page.evaluate((k) => localStorage.getItem(k), KEY)) !== null, 'resting saves');
  ok('↑ at the candle shrine rests, heals and saves');
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

  // ─── ladders, ledges, doors, the dash ────────────────────────────────────
  await dbg(page, 'teleport', 'landing', 14, 14);
  await page.waitForTimeout(250);
  await page.keyboard.down('ArrowDown');
  await until(page, () => window.__bellspire().state.room === 'well');
  await page.keyboard.up('ArrowDown');
  ok('↓ climbs down a ladder');
  await page.keyboard.down('ArrowUp');
  await until(page, () => window.__bellspire().state.room === 'landing');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowUp');
  ok('↑ climbs up');
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
  ok('X on a water bell changes the water');
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
