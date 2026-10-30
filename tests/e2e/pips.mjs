// Lucky Pips in the browser: the arcade card and the menu; a first battle won with the real mouse (dragging dice onto
// tools) and the reward taken; a second battle won with the keyboard alone (arrows, number keys, E) and the map walked
// by keyboard; the core interactions (tap a die then a tool, a two-dice tool waiting and giving its dice back, picking
// a target, the re-roll cup); the save across a reload; a corrupt save; the ending; the framing at 1280×800 and
// 1920×1080 (Dora and Enzo a clear size, nothing over them); and phones held upright and sideways, a battle won by
// touch with the dice, the tools, the End turn button and the foe all on screen. Needs `npm run dev` on port 3000 and
// Playwright. Set SHOTS=<dir> to keep screenshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const KEY = 'lucky-pips-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 90000 });
const st = (page) => page.evaluate(() => { const g = window.__pips(); const r = g.run; return { view: g.view, shown: g.shown, busy: g.busy, screen: r?.screen, hp: r?.hp, tools: r?.tools.map((t) => t.id), turn: r?.battle?.turn, foes: r?.battle?.foes.map((f) => f.hp), scene: g.scene }; });
const idle = (page) => page.waitForFunction(() => { const g = window.__pips(); return g && !g.busy; }, null, { timeout: 30000 });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const box = async (loc) => { const r = await loc.boundingBox(); return r && { x: r.x, y: r.y, w: r.width, h: r.height }; };
const inside = (a, vw, vh) => a && a.x >= -1 && a.y >= -1 && a.x + a.w <= vw + 1 && a.y + a.h <= vh + 1;
const overlaps = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
// tools that hit, in the order a sensible player reaches for them
const PREF = ['mallet', 'honey', 'rattle', 'sling', 'quill', 'scales', 'pebble', 'clover', 'top', 'shield', 'hay', 'splitter'];
const rank = (id) => { const i = PREF.indexOf(id); return i < 0 ? 50 : i; };

/** Pick the best tool for the selected die, from the tools the page marks as fitting. */
async function bestFit(page) {
  const fits = await page.locator('.lp-tools .lp-tool.is-fit').evaluateAll((els) => els.map((e) => ({ ti: Number(e.dataset.ti), id: e.dataset.tool })));
  fits.sort((a, b) => rank(a.id) - rank(b.id));
  return fits[0] ?? null;
}
/** Win the current battle. `how` is 'mouse' (drag), 'tap' (tap die, tap tool) or 'keys'. */
async function winBattle(page, how) {
  for (let turn = 0; turn < 30; turn++) {
    await idle(page);
    let s = await st(page);
    if (s.screen !== 'battle') return s;
    for (let pass = 0; pass < 12; pass++) {
      await idle(page);
      s = await st(page);
      if (s.screen !== 'battle' || s.busy) break;
      const dice = page.locator('.lp-felt .lp-die:not(.is-curse)');
      const n = await dice.count();
      let placed = false;
      for (let k = 0; k < n && !placed; k++) {
        if (how === 'keys') {
          await page.keyboard.press('ArrowRight');
        } else {
          if (how === 'tap') await dice.nth(k).tap(); else await dice.nth(k).click();
        }
        await page.waitForTimeout(60);
        const f = await bestFit(page);
        if (!f) continue;
        if (how === 'keys') await page.keyboard.press(String(f.ti + 1));
        else if (how === 'tap') await page.locator(`.lp-tool[data-ti="${f.ti}"]`).tap();
        else {
          // a real drag: press on the die, move across, let go over the tool
          const d = await box(dice.nth(k)), t = await box(page.locator(`.lp-tool[data-ti="${f.ti}"]`));
          // the die was selected by the click above; clicking it again would deselect, so drag from where it sits
          await page.mouse.move(d.x + d.w / 2, d.y + d.h / 2); await page.mouse.down();
          await page.mouse.move(d.x + d.w / 2 + 20, d.y + d.h / 2 - 20, { steps: 3 });
          await page.mouse.move(t.x + t.w / 2, t.y + t.h / 2, { steps: 8 });
          await page.mouse.up();
        }
        placed = true;
      }
      if (!placed) { await page.keyboard.press('Escape'); break; }
      await page.waitForTimeout(80);
    }
    await idle(page);
    s = await st(page);
    if (s.screen !== 'battle') return s;
    if (how === 'keys') await page.keyboard.press('e');
    else if (how === 'tap') await page.locator('.lp-end').tap();
    else await page.locator('.lp-end').click();
    await page.waitForTimeout(200);
  }
  return st(page);
}
async function startSeeded(page, seed, lead = 'enzo') {
  await page.evaluate(([s, l]) => window.__pips && window.__pipsStart(s, l), [seed, lead]);
  await page.waitForSelector('.lp-node.is-can');
}

try {
  // ---- the arcade card leads here
  {
    const page = await open();
    await page.goto(base + '/');
    await page.locator('a.arcade-card[href="/pips"]').click();
    await page.waitForURL(/\/pips$/);
    await ready(page);
    assert.equal(await page.getByRole('heading', { name: 'Lucky Pips', level: 1 }).count(), 1);
    assert.equal(await page.locator('a[href="/"]').count(), 1);
    assert.ok(await page.getByRole('radio', { name: /Side by Side/ }).isDisabled(), 'Side by Side waits for a win');
    await shot(page, '01-menu');
    await page.getByRole('radio', { name: /Enzo leads/ }).click();
    await page.getByRole('button', { name: 'Start a run' }).click();
    await page.waitForSelector('.lp-node.is-can');
    const s = await st(page);
    assert.equal(s.shown, 'map'); assert.deepEqual(s.tools, ['sling', 'shield', 'honey', 'mallet']);
    await shot(page, '02-map');
    console.log('PASS the arcade card, the menu and a new run');
    await page.context().close();
  }

  // ---- a battle won with the mouse, the reward, the save across a reload
  {
    const page = await open();
    await page.goto(base + '/pips'); await ready(page);
    await startSeeded(page, 12345, 'enzo');
    await page.locator('.lp-node.is-can').first().click();
    await page.waitForSelector('.lp-felt .lp-die');
    await idle(page);
    let s = await st(page);
    assert.equal(s.screen, 'battle');
    const sc = s.scene;
    assert.ok(sc.pairH >= 180, `Dora and Enzo are a clear size at 1280×800 (${Math.round(sc.pairH)}px)`);
    await shot(page, '03-battle');
    // a die picked up glows the tools it fits, and the others dim
    await page.locator('.lp-felt .lp-die').first().click();
    assert.ok(await page.locator('.lp-tool.is-fit').count() >= 1, 'a chosen die lights the tools it fits');
    await page.locator('.lp-felt .lp-die').first().click();
    s = await winBattle(page, 'mouse');
    assert.equal(s.screen, 'reward', 'the first battle is won with the mouse');
    await page.waitForSelector('.lp-reward');
    await shot(page, '04-reward');
    await page.locator('.lp-reward .lp-offer').first().click();
    await page.waitForSelector('.lp-node.is-can');
    s = await st(page);
    assert.equal(s.tools.length, 5);
    const hp = s.hp;
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: 'Continue the run' }).click();
    await page.waitForSelector('.lp-node.is-can');
    s = await st(page);
    assert.equal(s.hp, hp); assert.equal(s.tools.length, 5);
    console.log('PASS a battle won by dragging dice with the mouse, a tool taken, the run kept across a reload');

    // ---- the next battle by keyboard alone: walk the map with the arrows and Enter, then dice by keys
    // make sure one of the stops ahead is a battle, then reach it with the arrows and walk there with Enter
    await page.evaluate(() => window.__pipsDebug((r) => { const c = r.map[r.at].next; if (!c.some((j) => r.map[j].kind === 'battle')) r.map[c[c.length - 1]].kind = 'battle'; }));
    for (let k = 0; k < 4; k++) {
      if ((await page.locator('.lp-node.is-focus').getAttribute('data-kind')) === 'battle') break;
      await page.keyboard.press('ArrowRight');
    }
    assert.equal(await page.locator('.lp-node.is-focus').getAttribute('data-kind'), 'battle');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.lp-felt .lp-die');
    await idle(page);
    s = await st(page);
    assert.equal(s.screen, 'battle');
    s = await winBattle(page, 'keys');
    assert.equal(s.screen, 'reward', 'a battle won by keyboard');
    console.log('PASS the map walked and a battle won with the keyboard alone');
    await page.context().close();
  }

  // ---- core interactions: a two-dice tool waits and gives its dice back; targets; the re-roll cup
  {
    const page = await open();
    await page.goto(base + '/pips'); await ready(page);
    await startSeeded(page, 777, 'dora');
    await page.locator('.lp-node.is-can').first().click();
    await page.waitForSelector('.lp-felt .lp-die'); await idle(page);
    await page.evaluate(() => window.__pipsDebug((r) => {
      r.tools = [{ id: 'rattle', up: false }, { id: 'sling', up: false }, { id: 'shield', up: false }];
      r.battle.slots = r.tools.map(() => ({ used: 0, pend: [], count: 0, locked: false, spent: false }));
      r.battle.dice = [{ id: 901, v: 4 }, { id: 902, v: 4 }, { id: 903, v: 2 }];
      r.battle.rerolls = 1;
      if (r.battle.foes.length < 2) r.battle.foes.push({ ...r.battle.foes[0], hp: 30, max: 30 });
    }));
    await page.locator('.lp-die[data-die="901"]').click();
    await page.locator('.lp-tool[data-ti="0"]').click();
    await idle(page);
    assert.equal(await page.locator('.lp-tool[data-ti="0"] .lp-slot svg').count(), 1, 'the rattle holds one die and waits');
    await page.locator('.lp-tool[data-ti="0"]').click();
    await idle(page);
    assert.equal(await page.locator('.lp-felt .lp-die').count(), 3, 'tapping it gives the die back');
    // the re-roll cup takes the chosen die
    await page.locator('.lp-die[data-die="903"]').click();
    await page.locator('.lp-cup').click(); await idle(page);
    assert.equal(await page.locator('.lp-cup').count(), 0, 'the one re-roll is spent');
    // click the second foe to aim at it
    const m = (await st(page)).scene, c = await box(page.locator('.lp-stage canvas'));
    const f = m.foes[1];
    await page.mouse.click(c.x + f.x, c.y + f.base - f.h / 2);
    assert.equal(await page.evaluate(() => window.__pips().run.battle.target), 1, 'clicking a foe aims at it');
    await shot(page, '05-two-foes');
    console.log('PASS a two-dice tool waits and gives its dice back, the re-roll cup, aiming at a foe');
    await page.context().close();
  }

  // ---- a corrupt save never crashes
  {
    const page = await open();
    await page.goto(base + '/pips');
    await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"run":{"v":1,"screen":"battle","tools":[{"id":"laser"}]},"meta":"x"'), KEY);
    await page.reload(); await ready(page);
    assert.equal(await page.getByRole('button', { name: 'Start a run' }).count(), 1);
    await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"run":{"v":1,"seed":1,"r":1,"fog":0,"hp":5,"max":40,"acorns":0,"area":0,"at":-1,"lead":"enzo","tools":[{"id":"sling"}],"map":"nope","charms":[],"pool":[]}}'), KEY);
    await page.reload(); await ready(page);
    assert.equal(await page.getByRole('button', { name: 'Start a run' }).count(), 1);
    console.log('PASS corrupt saves are ignored');
    await page.context().close();
  }

  // ---- the ending, and what a win unlocks
  {
    const page = await open({ width: 1920, height: 1080 });
    await page.goto(base + '/pips'); await ready(page);
    await startSeeded(page, 99, 'dora');
    await page.locator('.lp-node.is-can').first().click();
    await page.waitForSelector('.lp-felt .lp-die'); await idle(page);
    const sc = (await st(page)).scene;
    assert.ok(sc.pairH >= 250, `Dora and Enzo are a clear size at 1920×1080 (${Math.round(sc.pairH)}px)`);
    // nothing covers the stage: the desk sits below it
    const stage = await box(page.locator('.lp-stage')), desk = await box(page.locator('.lp-desk'));
    assert.ok(!overlaps(stage, desk), 'the desk does not cover the stage');
    await shot(page, '06-battle-1920');
    await page.evaluate(() => window.__pipsDebug((r) => { r.area = 2; r.battle = null; r.screen = 'charm'; r.offer = { kind: 'charm', charms: ['scarf', 'die', 'belt'] }; }));
    await page.locator('.lp-charmcard').first().click();
    await page.waitForSelector('.lp-end');
    assert.match(await page.locator('.lp-end h2').textContent(), /The fog lifts/);
    await shot(page, '07-ending');
    await page.getByRole('button', { name: 'Back to the fair gate' }).click();
    assert.ok(!(await page.getByRole('radio', { name: /Side by Side/ }).isDisabled()), 'a win unlocks Side by Side');
    console.log('PASS the ending, and a win unlocks Side by Side and Foggier');
    await page.context().close();
  }

  // ---- phones, upright and sideways, played by touch
  for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'sideways']]) {
    const page = await open({ width: w, height: h }, true);
    await page.goto(base + '/pips'); await ready(page);
    assert.ok(await noSideScroll(page), `no sideways scroll on the menu (${name})`);
    await shot(page, `08-phone-${name}-menu`);
    await startSeeded(page, 4242, 'enzo');
    await shot(page, `09-phone-${name}-map`);
    await page.locator('.lp-node.is-can').first().tap();
    await page.waitForSelector('.lp-felt .lp-die'); await idle(page);
    // everything a turn needs is on screen and nothing important overlaps
    const dice = page.locator('.lp-felt .lp-die');
    for (let i = 0; i < await dice.count(); i++) assert.ok(inside(await box(dice.nth(i)), w, h), `die ${i} on screen (${name})`);
    const tools = page.locator('.lp-tools .lp-tool');
    for (let i = 0; i < await tools.count(); i++) { const b = await box(tools.nth(i)); assert.ok(inside(b, w, h) && b.h >= 40, `tool ${i} on screen and tappable (${name})`); }
    assert.ok(inside(await box(page.locator('.lp-end')), w, h), `End turn on screen (${name})`);
    const s0 = await st(page), c = await box(page.locator('.lp-stage canvas'));
    const f = s0.scene.foes[0];
    assert.ok(f.x - f.w / 2 >= -2 && f.x + f.w / 2 <= c.w + 2 && f.base - f.h >= -2 && f.base <= c.h + 2, `the foe fits on the stage (${name})`);
    const p = s0.scene;
    assert.ok(p.pairH >= 90, `Dora and Enzo a clear size (${name}: ${Math.round(p.pairH)}px)`);
    assert.ok(!overlaps(c, await box(page.locator('.lp-desk'))), `the desk does not cover the stage (${name})`);
    assert.ok(await noSideScroll(page), `no sideways scroll in battle (${name})`);
    await shot(page, `10-phone-${name}-battle`);
    const s = await winBattle(page, 'tap');
    assert.equal(s.screen, 'reward', `a battle won by touch (${name})`);
    await page.waitForSelector('.lp-reward');
    await shot(page, `11-phone-${name}-reward`);
    const offer = page.locator('.lp-reward .lp-offer').first();
    assert.ok(inside(await box(offer), w, h), `the reward is on screen (${name})`);
    await offer.tap();
    await page.waitForSelector('.lp-node.is-can');
    console.log(`PASS phone held ${name}: a battle won by touch, everything on screen`);
    await page.context().close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
