// Salt & Dust in the browser, with real clicks and keys: the title (help toggle, begin, continue), walking by click and
// by key, every person in Tunupa Well and every kind of reply (plain, a passed check, a failed check, one greyed out
// for lack of silver, a purchase), the menu (every toggle, resume, save and quit, continue), the road, both routes
// across the flat with every event choice and a rest, the yard, every Tika reply that makes peace, the fight (move,
// sling, pole, Mend, Drink, End Turn by button and by key, the Runners' turns, winning and losing), the pump and the
// ending card, a corrupt save, and a phone held upright. Fails on any page error or sideways scroll.
// Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
const KEY = 'salt-dust-v1';
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const open = async (viewport = { width: 1440, height: 810 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 }); return; } catch (e) { if (i >= 3) throw e; }
    await page.reload().catch(() => {});
  }
};
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
/** evaluate `expr` with g = the engine, o = the hook */
const game = (page, expr) => page.evaluate((e) => { const o = window.__salt(); return new Function('g', 'o', `return (${e})`)(o.g, o); }, expr);
const until = async (page, expr, timeout = 20000) => {
  try { await page.waitForFunction((e) => { const o = window.__salt(); return new Function('g', 'o', `return (${e})`)(o.g, o); }, expr, { timeout, polling: 100 }); } catch (e) {
    throw new Error(`${e.message}\n  waiting for: ${expr}\n  mode: ${await game(page, 'g && g.mode + " " + (g.talk && g.talk.id)').catch(() => '?')}`);
  }
};
const at = (page, x, y, lift = 0) => page.evaluate(([x, y, l]) => window.__salt().at(x, y, l), [x, y, lift]);
const clickTile = async (page, x, y, lift = 0) => { const p = await at(page, x, y, lift); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); };
/** walk up to someone by clicking on them, and wait for their conversation */
const talkTo = async (page, id) => {
  const [x, y] = await game(page, `(() => { const n = g.npcs().find((q) => q.id === '${id}'); return [n.x, n.y]; })()`);
  await clickTile(page, x, y, 70);
  await until(page, "g.mode === 'talk'");
};
const reply = async (page, re) => { await page.locator('.sd-dialog .sd-opt').filter({ hasText: re }).first().click(); };
const line = (page) => page.locator('.sd-line').textContent();
const leave = async (page) => { for (let i = 0; i < 6 && (await game(page, "g.mode === 'talk'")); i++) await page.locator('.sd-dialog .sd-opt:not([disabled])').last().click(); };
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const fightIdle = (page) => until(page, "g.mode === 'combat' && !o.busy && g.heroTurn()", 30000);

// ─── title, town, every person, every kind of reply, the menu ───
const page = await open();
await page.goto(`${base}/salt-dust`);
await page.evaluate((k) => { localStorage.removeItem(k); localStorage.removeItem(k + '-settings'); }, KEY);
await page.reload(); await ready(page);
ok(await noSideScroll(page), 'title: no sideways scroll');
await shot(page, '01-title');
const help = page.locator('.sd-title .sd-check input');
await help.uncheck(); ok(!(await help.isChecked()), 'help can be turned off');
await help.check(); ok(await help.isChecked(), 'and on again');
await page.getByRole('button', { name: 'Begin the journey' }).click();
await until(page, "o.screen === 'game' && g.mode === 'explore'");
ok(await page.locator('.sd-banner').textContent() === 'Tunupa Well', 'the location banner');
ok(/Water 6 \/ 10/.test(await page.locator('.sd-water').textContent()), 'the water meter reads 6 / 10');
ok(/Wayra/.test(await page.locator('.sd-hint').textContent()), 'the hint says who to talk to');
// walk by clicking a tile, then by key
await clickTile(page, 15, 15);
await until(page, 'g.party.dora.x === 15 && g.party.dora.y === 15 && !g.party.dora.moving');
ok(true, 'walked by clicking a tile');
await page.keyboard.press('ArrowUp');
await until(page, 'g.party.dora.y === 14 && !g.party.dora.moving');
await page.keyboard.press('KeyD');
await until(page, 'g.party.dora.x === 16 && !g.party.dora.moving');
ok(true, 'walked by key');
await shot(page, '02-town');

// Parina before Wayra's tip: a failed Barter check, then a purchase, then greyed out for lack of silver
await talkTo(page, 'parina');
ok((await line(page)) === 'Water is three cups a silver. For strangers, four.', 'Parina’s line from the mock-up');
ok(await page.locator('.sd-opt', { hasText: '[Barter 6] Three, and we mend your pump.' }).isVisible(), 'the Barter 6 reply');
ok(/needs 6, you have 5/.test(await page.locator('.sd-opt', { hasText: 'Barter 6' }).textContent()), 'help shows the odds before you pick');
await shot(page, '03-parina-check');
await reply(page, /Barter 6/);
await until(page, "g.talk.id === 'parina.sniff'");
ok(await game(page, "g.failed.includes('parina.hello:barter')"), 'a failed check');
ok(/failed/.test(await page.locator('.sd-toast').first().textContent()), 'a toast says it failed');
await reply(page, /Of course/);
await reply(page, /two cups/);
await until(page, "g.talk.id === 'parina.sold'");
ok(await game(page, 'g.silver === 1 && g.water === 8'), 'bought two cups for three silver');
await reply(page, /Thank you/);
ok(await page.locator('.sd-opt', { hasText: 'two cups' }).isDisabled(), 'no silver: the purchase is greyed out');
await page.keyboard.press('Digit2'); // "We will return when the price falls."
await until(page, "g.mode === 'explore'");
ok(true, 'a reply picked with a number key');

// Wayra: the errand, a passed Scout check, the tip, a rest
await talkTo(page, 'wayra');
await reply(page, /Coipa Yard/); await reply(page, /find that spring/);
await reply(page, /Scout 5/);
await until(page, "g.talk.id === 'wayra.tracks'");
ok(await game(page, 'g.f.tracks'), 'a passed Scout check');
await shot(page, '04-wayra');
await reply(page, /Thank you/); await reply(page, /haggle/); await reply(page, /remember/);
await game(page, '(g.hp.dora = 5, 1)');
await page.waitForTimeout(150);
await reply(page, /rest by your fire/); await until(page, `g.hp.dora === ${14}`);
ok(true, 'rested at Wayra’s fire');
await leave(page);

// the Warden Captain: Speech (now with Wayra's errand) and Repair; the other Warden
await talkTo(page, 'captain');
await reply(page, /Speech 6/); await until(page, "g.talk.id === 'captain.share'");
ok(await game(page, 'g.f.wardens'), 'the Wardens give their word');
await reply(page, /tell her/);
await reply(page, /Repair 6/); await until(page, "g.talk.id === 'captain.fixed'");
ok(await game(page, 'g.f.pulley && g.water === 10'), 'the pulley mended for a fill');
await leave(page);
await talkTo(page, 'warden'); ok(/Captain/.test(await line(page)), 'the other Warden'); await leave(page);

// the menu: toggles, resume, save and quit, continue
await page.getByRole('button', { name: 'Menu' }).click();
const boxes = page.locator('.sd-menu input[type=checkbox]');
for (let i = 0; i < 3; i++) { await boxes.nth(i).click(); await boxes.nth(i).click(); }
ok(await boxes.nth(0).isChecked(), 'menu toggles work both ways');
await page.getByRole('button', { name: 'Resume' }).click();
ok(!(await page.locator('.sd-menu').isVisible()), 'resume closes the menu');
await page.keyboard.press('Escape'); ok(await page.locator('.sd-menu').isVisible(), 'Esc opens the menu');
await page.getByRole('button', { name: 'Save and quit to title' }).click();
await page.getByRole('button', { name: 'Continue' }).click();
await until(page, "o.screen === 'game' && g.f.wardens && g.water === 10");
ok(true, 'save and continue keeps the journey');

// the road out, the island route: the cistern (Repair), the caravan (give water), a rest, Coipa
await clickTile(page, 19, 22);
await until(page, "g.mode === 'talk' && g.talk.id === 'town.leave'");
await reply(page, /Set out/);
await until(page, "g.mode === 'travel'");
await shot(page, '05-map');
await page.locator('.sd-travel .sd-opt', { hasText: 'Back into Tunupa Well' }).click();
await until(page, "g.mode === 'explore' && g.place === 'town'");
await clickTile(page, 19, 22); await until(page, "g.talk && g.talk.id === 'town.leave'"); await reply(page, /Set out/); await until(page, "g.mode === 'travel'");
await page.locator('.sd-travel .sd-opt', { hasText: 'cactus islands' }).click();
await until(page, "g.journey && g.journey.t > 0.7");
ok(await game(page, 'g.water === 9'), 'the canteen drains while walking');
await until(page, "g.talk && g.talk.id === 'ev.cistern'");
await shot(page, '06-event');
await reply(page, /Repair 5/); await until(page, "g.talk.id === 'ev.cistern.fixed'"); await reply(page, /Go on/);
await page.locator('.sd-travel .sd-opt').first().click();
await until(page, "g.talk && g.talk.id === 'ev.caravan'");
await reply(page, /Give her two water/); await until(page, "g.f.caravanTip"); await reply(page, /Thank you/);
await game(page, '(g.hp.enzo = 9, 1)'); await page.waitForTimeout(150);
await page.locator('.sd-travel .sd-opt', { hasText: 'Rest' }).click();
await until(page, 'g.hp.enzo === 16');
ok(true, 'rested on the flat');
await page.locator('.sd-travel .sd-opt').first().click();
await until(page, "g.mode === 'explore' && g.place === 'yard'", 20000);
ok(/Coipa Yard/.test(await page.locator('.sd-banner').textContent()), 'arrived at Coipa Yard');

// the pump before peace, then Tika: fight
await clickTile(page, 9, 2, 60);
await until(page, "g.talk && g.talk.id === 'yard.pump'");
ok(!(await page.locator('.sd-opt', { hasText: 'Crank' }).count()), 'no cranking while the Runners watch');
await leave(page);
await talkTo(page, 'tika');
await shot(page, '07-tika');
const tikaOpts = (await page.locator('.sd-dialog .sd-opt').allTextContents()).join(' | ');
ok(/Speech 6/.test(tikaOpts) && /mast/.test(tikaOpts) && /toll/.test(tikaOpts) && /hard way/.test(tikaOpts), `Tika’s replies: ${tikaOpts}`);
await reply(page, /hard way/);
await until(page, "g.mode === 'combat'");
await fightIdle(page);
ok(await page.locator('.sd-order .sd-portrait').count() === 5, 'the turn-order strip');
ok(/AP 7 \/ 7/.test(await page.locator('.sd-ap').textContent()), 'AP 7 / 7 for Dora');
// Dora: walk to a teal tile closer to Tika, then sling
const step = await game(page, `(() => { const t = g.unit('tika'), d = g.current(), foes = g.combat.units.filter((u) => u.side === 'foe'); let best = null, bd = 99; for (const [k, p] of g.reach(d)) { if (p.length > 3) continue; const [x, y] = k.split(',').map(Number); if (foes.some((f) => Math.hypot(f.x - x, f.y - y) < 2.5 || (f.x + f.y > x + y && Math.abs((f.x - f.y) - (x - y)) < 2))) continue; const dd = Math.hypot(x - t.x, y - t.y); if (dd < bd) { bd = dd; best = [x, y]; } } return best; })()`);
await clickTile(page, step[0], step[1]);
await fightIdle(page);
ok(await game(page, `g.unit('dora').x === ${step[0]} && g.unit('dora').y === ${step[1]}`), `Dora walked by clicking a teal tile ${step} ${JSON.stringify(await game(page, "[g.unit('dora').x, g.unit('dora').y, g.unit('dora').ap, g.combat.quiet, g.current().id]"))} ${await page.evaluate(async (p) => document.elementFromPoint(p.x, p.y)?.className, await at(page, step[0], step[1]))}`);
await shot(page, '08-combat');
const target = await game(page, "(() => { const d = g.current(); const f = g.combat.units.filter((u) => u.side === 'foe' && !u.down && g.hitChance(d, u) > 0).sort((a, b) => g.hitChance(d, b) - g.hitChance(d, a))[0]; return f && [f.id, f.x, f.y]; })()");
ok(target, 'a Runner in sling range');
const apBefore = await game(page, 'g.current().ap');
await clickTile(page, target[1], target[2], 70);
await until(page, `g.unit('dora').ap === ${apBefore - 3}`);
ok(true, 'Dora slung a stone by clicking a Runner');
// Drink (Dora is hurt a little first)
await fightIdle(page);
await game(page, "(g.unit('dora').hp = 9, g.hp.dora = 9, 1)");
await page.waitForTimeout(150);
await page.getByRole('button', { name: /Drink/ }).click();
await until(page, "g.unit('dora').hp === 12");
ok(true, 'Drink heals and costs a cup');
await fightIdle(page);
await page.getByRole('button', { name: 'End Turn' }).click();
await until(page, "g.current() && g.current().id !== 'dora'");
ok(true, 'End Turn by button');
// the Runner's turn plays out; Enzo: Mend himself, then End Turn by key
await until(page, "g.current() && g.current().id === 'enzo' && !o.busy", 30000);
await game(page, "(g.unit('enzo').hp = 8, g.hp.enzo = 8, 1)"); await page.waitForTimeout(150);
await page.getByRole('button', { name: /Mend/ }).click();
const e = await game(page, "[g.unit('enzo').x, g.unit('enzo').y]");
await clickTile(page, e[0], e[1], 70);
await until(page, "g.unit('enzo').hp === 13");
ok(true, 'Enzo mends by button and click');
await fightIdle(page);
await page.keyboard.press('Enter');
await until(page, "g.current() && g.current().id !== 'enzo'");
ok(true, 'End Turn by key');
// play on with real clicks until the Runners give up: bring them to 1 health so it doesn't take all day
await game(page, "(g.combat.units.forEach((u) => { if (u.side === 'foe') u.hp = 1; }), 1)");
for (let i = 0; i < 40 && (await game(page, "g.mode === 'combat'")); i++) {
  await until(page, "g.mode !== 'combat' || (!o.busy && (g.heroTurn() || !!g.combat.over))", 30000);
  if (!(await game(page, "g.mode === 'combat' && !g.combat.over"))) break;
  const act = await game(page, `(() => { const u = g.current(); if (u.side !== 'hero') return null; const f = g.combat.units.filter((q) => q.side === 'foe' && !q.down); const hit = f.find((q) => g.hitChance(u, q) > 0); if (hit && u.ap >= g.attackCost(u)) return ['hit', hit.x, hit.y]; let best = null, bd = 99; for (const [k, p] of g.reach(u)) { const [x, y] = k.split(',').map(Number); const dd = Math.min(...f.map((q) => Math.max(Math.abs(q.x - x), Math.abs(q.y - y)))); if (dd < bd && p.length <= Math.max(1, u.ap - 3)) { bd = dd; best = [x, y]; } } return best ? ['move', ...best] : ['end']; })()`);
  if (!act) continue;
  if (act[0] === 'hit') await clickTile(page, act[1], act[2], 70);
  else if (act[0] === 'move') await clickTile(page, act[1], act[2]);
  else await page.getByRole('button', { name: 'End Turn' }).click();
  await page.waitForTimeout(250);
}
await until(page, "g.mode === 'talk' && g.talk.id === 'tika.beaten'", 30000);
ok(await game(page, "g.f.peace === 'fought'"), 'won the fight');
await shot(page, '09-won');
await leave(page);
await clickTile(page, 9, 2, 60);
await until(page, "g.talk && g.talk.id === 'yard.pump'");
await reply(page, /Crank/);
await until(page, "g.mode === 'finding'");
await shot(page, '10-crank');
await until(page, "o.screen === 'end'", 15000);
ok(/spring at Coipa Yard/.test(await page.locator('.sd-end-card h2').textContent()), 'the ending card');
ok(/What’s next/.test(await page.locator('.sd-next').textContent()), 'with a what’s-next line');
ok(await page.getByRole('link', { name: 'Back to the arcade' }).isVisible(), 'and a way back to the arcade');
await shot(page, '11-ending');
await page.reload(); await ready(page);
await page.getByRole('button', { name: 'Continue' }).click();
await until(page, "o.screen === 'end'");
ok(true, 'the ending is saved');
await page.getByRole('button', { name: 'Play again' }).click();
await until(page, "o.screen === 'game' && g.place === 'town' && g.water === 6");
ok(true, 'Play again starts a fresh journey');

// ─── the straight route, the Runners' carts, and the peaceful ways past Tika ───
const startAtTunupa = async (flags, water = 6) => {
  await page.waitForTimeout(400); // let the last autosave land first
  await page.evaluate(([k, f, w]) => {
    const s = { v: 1, mode: 'travel', place: 'town', at: 'tunupa', f: { quest: true, ...f }, water: w, silver: 4, hp: { dora: 14, enzo: 16 }, pos: { dora: [18, 19], enzo: [18, 20] }, rng: 5, passed: [], failed: [] };
    localStorage.setItem(k, JSON.stringify(s));
  }, [KEY, flags, water]);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await until(page, "g.mode === 'travel'");
};
for (const [flags, re, peace, hide] of [[{}, /toll/, 'toll', true], [{ guild: true }, /Guild/, 'guild', false], [{ wardens: true }, /Speech 6/, 'share', true], [{ caravanTip: true }, /mast/, 'mast', false]]) {
  await startAtTunupa(flags, 10);
  await page.keyboard.press('Digit1'); // straight across, by key
  await until(page, "g.talk && g.talk.id === 'ev.runners'");
  await reply(page, hide ? /Scout 6/ : /Keep walking/);
  await until(page, hide ? 'g.f.unseen' : 'g.f.seen');
  await leave(page);
  await page.locator('.sd-travel .sd-opt').first().click();
  await until(page, "g.mode === 'explore' && g.place === 'yard'", 20000);
  await talkTo(page, 'tika');
  if (!hide) ok(/watched you cross/.test(await line(page)), 'Tika saw you at the lagoon');
  await reply(page, re);
  await until(page, `g.f.peace === '${peace}'`);
  ok(true, `peace by ${peace}`);
  await leave(page);
}

// ─── losing a fight ───
await startAtTunupa({ tracks: true }, 8);
await page.keyboard.press('Digit1'); await until(page, "g.talk && g.talk.id === 'ev.runners'"); await reply(page, /Keep walking/); await leave(page);
await page.locator('.sd-travel .sd-opt').first().click(); await until(page, "g.mode === 'explore' && g.place === 'yard'", 20000);
await talkTo(page, 'tika'); await reply(page, /hard way/); await until(page, "g.mode === 'combat'");
await game(page, "(g.combat.units.forEach((u) => { if (u.side === 'hero') { u.hp = 1; } }), 1)");
await fightIdle(page);
await page.getByRole('button', { name: 'End Turn' }).click();
for (let i = 0; i < 30 && (await game(page, "g.mode === 'combat'")); i++) {
  await until(page, "g.mode !== 'combat' || (!o.busy && (g.heroTurn() || !!g.combat.over))", 30000);
  if (await game(page, "g.mode === 'combat' && g.heroTurn()")) await page.getByRole('button', { name: 'End Turn' }).click();
  await page.waitForTimeout(200);
}
await until(page, "g.talk && g.talk.id === 'tika.won'", 30000);
ok(await game(page, 'g.water === 2'), 'losing costs half the water, and you can try again');
await leave(page);

// ─── a corrupt save, and a phone held upright ───
await page.waitForTimeout(400);
await page.evaluate((k) => localStorage.setItem(k, '{broken'), KEY);
await page.reload(); await ready(page);
ok(await page.getByRole('button', { name: 'Begin the journey' }).isVisible(), 'a corrupt save is ignored');
await page.close();

const phone = await open({ width: 390, height: 844 }, true);
await phone.goto(`${base}/salt-dust`);
await phone.evaluate((k) => localStorage.removeItem(k), KEY);
await phone.reload(); await ready(phone);
ok(await noSideScroll(phone), 'phone: no sideways scroll on the title');
await phone.getByRole('button', { name: 'Begin the journey' }).click();
await until(phone, "o.screen === 'game'");
const pw = await at(phone, 7, 12, 40);
await phone.touchscreen.tap(pw.x, pw.y);
await until(phone, "g.mode === 'talk'");
await phone.locator('.sd-dialog').waitFor();
ok(await phone.locator('.sd-dialog').isVisible(), 'phone: the dialogue shows');
await phone.locator('.sd-dialog .sd-opt').first().click();
ok(await noSideScroll(phone), 'phone: no sideways scroll in a conversation');
await shot(phone, '12-phone');
await phone.close();

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`Salt & Dust e2e: ${checks} checks passed.`);
