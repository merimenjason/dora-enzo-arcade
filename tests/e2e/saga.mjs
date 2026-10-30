import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/saga', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }, options = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view, hasTouch: true, ...options });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) {
    if (process.env.ONLY) console.error(e.message.slice(0, 900));
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const s = window.__saga?.(), b = s?.game?.battle; return s ? { view: document.querySelector('main')?.className, phase: b?.phase, wave: b?.wave, time: b?.time, paused: s.paused, cleared: s.game?.cleared, save: localStorage.getItem('saga-v1')?.slice(0, 160) } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
/** Runs a function against the running saga, then redraws the menus. */
const saga = (page, fn, arg) => page.evaluate(`new Promise((done) => { const s = window.__saga(), out = (${fn})(s.game, ${JSON.stringify(arg ?? null)}, s); s.refresh(); requestAnimationFrame(() => requestAnimationFrame(() => done(out))); })`);
const battle = (page, fn, arg) => page.evaluate(`(() => { const s = window.__saga(); return (${fn})(s.game.battle, ${JSON.stringify(arg ?? null)}, s); })()`);
const phase = (page, want) => page.waitForFunction((p) => window.__saga().game?.battle?.phase === p, want);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('saga-v1') || 'null'));
const fresh = async (page) => { await page.goto(`${base}/saga`); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.getByTestId('start').click(); await page.getByTestId('adventure-panel').waitFor(); };
/** A fresh saga with the three opening scrolls spent, so the squad is five strong. */
const squadUp = async (page) => { await fresh(page); await page.getByTestId('tab-summon').click(); await page.getByTestId('summon-10').click(); await page.getByTestId('pulled').waitFor(); await page.getByTestId('tab-adventure').click(); };
const startFight = async (page) => { await page.getByTestId('fight').click(); await phase(page, 'fight'); };
/** Makes the squad strong enough to end the fight in moments. */
const mighty = (page) => battle(page, '(b) => { for (const u of b.heroes) { u.atk *= 80; u.max *= 50; u.hp = u.max; } }');
/** Wins the fight in hand: every enemy that turns up is left with a sliver of health. */
const winNow = async (page) => {
  await mighty(page);
  await page.evaluate(() => { const id = setInterval(() => { const b = window.__saga().game?.battle; if (!b || b.phase === 'won' || b.phase === 'lost') return clearInterval(id); for (const u of b.foes) u.hp = Math.min(u.hp, 1); }, 30); });
  await page.waitForFunction(() => window.__saga().game.battle?.phase === 'won', null, { timeout: 60000 }); await page.getByTestId('won').waitFor();
};
/** Sweeps the first two waves aside and stops, harmless and unhurt, in front of the last one. */
const toLastWave = (page) => page.evaluate(() => new Promise((done) => { const id = setInterval(() => {
  const b = window.__saga().game.battle;
  if (b.wave < 2) { for (const u of b.foes) u.hp = Math.min(u.hp, 1); return; }
  if (b.phase !== 'fight') return;
  clearInterval(id); for (const u of b.heroes) { u.atk = 1; u.energy = 0; u.max *= 500; u.hp = u.max; } done();
}, 30); }));
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

await check('the arcade lists Whisker Saga as its thirty-second game', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 57);
  await page.locator('.arcade-card[href="/saga"]').click(); await page.waitForURL('**/saga');
  await page.getByTestId('start').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0, 'nothing to continue on a first visit');
});

await check('setting out: two heroes, three scrolls, and a squad of five after summoning', async (page) => {
  await fresh(page);
  assert.match(await page.getByTestId('tip').innerText(), /3 summoning scrolls/);
  assert.equal((await page.getByTestId('gold').innerText()).trim(), '120'); assert.equal((await page.getByTestId('scrolls').innerText()).trim(), '3');
  assert.ok(await page.getByTestId('stage-1').isDisabled(), 'stage two is locked'); assert.ok(await page.getByTestId('chapter-next').isDisabled());
  assert.match(await page.getByTestId('brief').innerText(), /Clover Meadow 1[\s\S]*Captain[\s\S]*gold, a piece of gear, a summoning scroll/);
  await page.getByTestId('tip').getByRole('button').click();
  await page.getByTestId('summon-panel').waitFor();
  await page.getByTestId('summon-1').click();
  assert.equal(await page.getByTestId('pulled').locator('li').count(), 1); assert.match(await page.getByTestId('pulled').innerText(), /New hero!/);
  await page.getByTestId('summon-10').click();
  assert.equal(await page.getByTestId('pulled').locator('li').count(), 2, 'the big button spends what is left');
  assert.ok(await page.getByTestId('summon-1').isDisabled()); assert.equal((await page.getByTestId('scrolls').innerText()).trim(), '0');
  assert.equal((await page.getByTestId('summon-10').innerText()).trim(), 'Summon several', 'an empty batch button names no number');
  const save = await stored(page);
  assert.equal(Object.keys(save.heroes).length, 5, 'summons are saved at once'); assert.ok(save.squad.every(Boolean), 'and the new heroes fill the squad');
  await page.getByTestId('tab-squad').click();
  assert.equal(await page.locator('[data-testid^="hero-"][data-owned="true"]').count(), 5); assert.equal(await page.locator('[data-testid^="slot-"][data-filled="true"]').count(), 5);
  assert.match(await page.locator('.sg-roster h3').innerText(), /5 of 20 heroes/);
  await page.getByTestId('tab-adventure').click(); assert.equal(await page.getByTestId('tip').count(), 0, 'the nudge goes once the squad is full');
});

await check('a whole battle with the keyboard: charge, fire, interrupt a wind-up, win', async (page) => {
  await squadUp(page);
  await startFight(page);
  assert.equal(await page.getByTestId('auto').count(), 0, 'no auto on a stage not yet beaten');
  assert.match(await page.getByTestId('where').innerText(), /Clover Meadow 1[\s\S]*Wave 1\/3/);
  assert.equal(await page.getByTestId('skill-1').getAttribute('data-ready'), 'false');
  await page.keyboard.press('2');
  assert.equal(await battle(page, '(b) => b.heroes[1].energy > 0'), true, 'a skill that is not charged does not fire');
  // Dora's strike charges, glows, and fires on its key.
  await battle(page, '(b) => { b.heroes.find((u) => u.key === "dora").energy = 100; }');
  await page.waitForFunction(() => document.querySelector('[data-testid="skill-1"]').dataset.ready === 'true');
  assert.match(await page.getByTestId('hint').innerText(), /A skill is ready/);
  await page.keyboard.press('2');
  await page.waitForFunction(() => window.__saga().game.battle.heroes.find((u) => u.key === 'dora').energy < 50);
  assert.ok(await battle(page, '(b) => b.foes.some((u) => u.stun > 0) || b.foes.length < b.def.waves[b.wave].length'), 'Dandelion Dash stunned or felled its target');
  // A hurt squad with a shield sitting charged is told to use it.
  await battle(page, '(b) => { const d = b.heroes.find((u) => u.key === "dora"); d.hp = d.max * 0.3; b.heroes.find((u) => u.key === "enzo").energy = 100; }');
  await page.waitForFunction(() => /The squad is hurting\. Enzo can shield them\./.test(document.querySelector('[data-testid="hint"]').textContent));
  await battle(page, '(b) => { const d = b.heroes.find((u) => u.key === "dora"); d.hp = d.max; b.heroes.find((u) => u.key === "enzo").energy = 0; }');
  // Race to the captain, then hold still and let it wind up.
  await toLastWave(page);
  await page.waitForFunction(() => { const c = window.__saga().game.battle.foes.find((u) => u.key === 'captain'); return c && c.d <= c.reach; });
  await battle(page, '(b) => { b.foes.find((u) => u.key === "captain").specialT = 0.2; }');
  await page.waitForFunction(() => !!window.__saga().game.battle.winding);
  await page.waitForFunction(() => document.querySelector('main').dataset.winding === 'true');
  assert.match(await page.getByTestId('hint').innerText(), /Captain is winding up a slam/); assert.equal(await page.getByTestId('hint').getAttribute('data-alarm'), 'true');
  await battle(page, '(b) => { b.heroes.find((u) => u.key === "dora").energy = 100; }');
  await page.waitForFunction(() => /Stun it now/.test(document.querySelector('[data-testid="hint"]').textContent));
  await page.keyboard.press('2');
  await page.waitForFunction(() => !window.__saga().game.battle.winding);
  const cap = await battle(page, '(b) => { const c = b.foes.find((u) => u.key === "captain"); return { stun: c.stun, exposed: c.exposed }; }');
  assert.ok(cap.stun > 1.5 && cap.exposed > 2, 'the captain reels and is left open');
  assert.ok((await page.evaluate(() => window.__saga().field.inspect(window.__saga().game.battle))).fx > 0, 'and the field shows it');
  await winNow(page);
  assert.match(await page.getByTestId('won').innerText(), /Victory[\s\S]*Stage cleared[\s\S]*gold \(first clear\)[\s\S]*1 summoning scroll/);
  const save = await stored(page);
  assert.ok(save.stars[0] >= 1 && save.gold > 120 && save.scrolls === 1, 'the win is saved before the card is dismissed');
  await page.getByTestId('to-map').click();
  await page.getByTestId('adventure-panel').waitFor();
  assert.ok(await page.getByTestId('stage-1').isEnabled(), 'stage two opens'); assert.equal(await page.getByTestId('stage-1').getAttribute('aria-pressed'), 'true', 'a first clear points the map at the stage it opened');
  assert.match(await page.getByTestId('chapter-stars').innerText(), /^[123]\/30 stars/);
  assert.equal(await page.getByTestId('camp').count(), 1, 'the camp chest appears once a stage is cleared');
});

await check('touch: tapping a hero or their button fires the skill', async (page) => {
  await squadUp(page); await startFight(page);
  await battle(page, '(b) => { for (const u of b.heroes) { u.energy = 100; u.max *= 50; u.hp = u.max; } }');
  await page.waitForFunction(() => document.querySelector('[data-testid="skill-0"]').dataset.ready === 'true');
  const box = await page.getByTestId('field').boundingBox(), at = await page.evaluate(() => { const f = window.__saga().field; return { p: f.heroAt(1), u: f.inspect(window.__saga().game.battle).unit }; });
  await page.touchscreen.tap(box.x + at.p.x, box.y + at.p.y - at.u * 0.5);
  await page.waitForFunction(() => window.__saga().game.battle.heroes[1].energy < 60);
  await page.getByTestId('skill-0').tap();
  await page.waitForFunction(() => window.__saga().game.battle.heroes[0].energy < 60);
  assert.ok(await battle(page, '(b) => b.alive.every((u) => u.shield > 0)'), 'Burrow Wall went up from the button');
  // A tap on empty ground does nothing.
  const before = await battle(page, '(b) => b.heroes.map((u) => u.energy >= 100)');
  await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * 0.2);
  await page.waitForTimeout(120);
  assert.deepEqual((await battle(page, '(b) => b.heroes.map((u) => u.energy >= 100)')).slice(2), before.slice(2));
});

await check('pause, a hidden tab, double speed and a retreat', async (page) => {
  await squadUp(page); await startFight(page);
  await battle(page, '(b) => { for (const u of b.heroes) { u.max *= 500; u.hp = u.max; u.atk = 1; } }');
  await page.keyboard.press('p'); await page.getByTestId('paused').waitFor();
  const t0 = await battle(page, '(b) => b.time'); await page.waitForTimeout(350);
  assert.equal(await battle(page, '(b) => b.time'), t0, 'time stands still while paused');
  await page.keyboard.press('1'); assert.equal(await page.evaluate(() => window.__saga().paused), true);
  await page.getByTestId('resume').click(); await page.waitForFunction((t) => window.__saga().game.battle.time > t, t0);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByTestId('paused').waitFor(); assert.equal(await page.evaluate(() => window.__saga().paused), true, 'a hidden tab pauses the fight');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__saga().paused);
  // Double speed runs the same battle twice as fast.
  const rate = async () => { const a = await battle(page, '(b) => b.time'), w = Date.now(); await page.waitForTimeout(600); return (await battle(page, '(b) => b.time') - a) / ((Date.now() - w) / 1000); };
  const slow = await rate(); await page.keyboard.press('f'); assert.equal(await page.getByTestId('speed').getAttribute('aria-pressed'), 'true');
  const quick = await rate(); assert.ok(quick > slow * 1.6, `double speed is about twice as fast (${slow.toFixed(2)} then ${quick.toFixed(2)})`);
  await page.getByTestId('speed').click();
  await page.getByTestId('mute').click(); assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true'); assert.equal(await page.evaluate(() => localStorage.getItem('saga-sound-v1')), 'off');
  const before = await stored(page);
  await page.getByTestId('retreat').click(); await page.getByTestId('adventure-panel').waitFor();
  const after = await stored(page);
  assert.deepEqual(after.stars, before.stars); assert.equal(after.gold, before.gold, 'a retreat costs nothing and wins nothing');
  assert.ok(await page.getByTestId('stage-1').isDisabled());
});

await check('a lost battle explains itself and loses nothing', async (page) => {
  await squadUp(page); await startFight(page);
  await battle(page, '(b) => { for (const u of b.heroes) { u.hp = 1; u.atk = 1; } }');
  await phase(page, 'lost'); await page.getByTestId('lost').waitFor();
  assert.match(await page.getByTestId('lost').innerText(), /The squad fell back[\s\S]*Nothing is lost/);
  assert.equal((await stored(page)).stars[0], 0);
  await page.getByTestId('retry').click(); await page.getByTestId('lost').waitFor({ state: 'detached' }); await phase(page, 'fight');
  assert.ok(await battle(page, '(b) => b.alive.length === 5 && b.time < 2'), 'a fresh fight with everyone back up');
  await battle(page, '(b) => { for (const u of b.heroes) { u.hp = 1; u.atk = 1; } }');
  await page.getByTestId('lost').waitFor(); await page.getByTestId('to-squad').click();
  await page.getByTestId('squad-panel').waitFor();
});

await check('the squad: levels, stars, gear, places and the faction bonus', async (page) => {
  await squadUp(page); await page.getByTestId('tab-squad').click();
  await page.getByTestId('hero-dora').click();
  assert.match(await page.getByTestId('detail').innerText(), /Dora[\s\S]*Epic · Meadow · Striker \(melee\)[\s\S]*Dandelion Dash\. Hits the nearest enemy/);
  assert.equal(await page.getByTestId('hero-level').innerText(), '1');
  await page.getByTestId('level-up').click();
  assert.equal(await page.getByTestId('hero-level').innerText(), '2'); assert.equal((await page.getByTestId('gold').innerText()).trim(), '80');
  assert.equal((await stored(page)).heroes.dora.level, 2, 'a level is saved at once');
  await page.getByTestId('level-squad').click();
  assert.match(await page.getByTestId('note').innerText(), /Bought 2 levels for the squad/); assert.ok(await page.getByTestId('level-up').isDisabled(), 'the gold is spent');
  await page.getByTestId('level-squad').click(); assert.match(await page.getByTestId('note').innerText(), /Not enough gold/);
  // Stars need shards.
  assert.ok(await page.getByTestId('star-up').isDisabled()); assert.match(await page.getByTestId('star-up').innerText(), /0\/10 shards/);
  await saga(page, '(g) => { g.heroes.dora.shards = 10; g.bag[0][2] = 1; g.bag[1][1] = 1; g.gold = 5000; }');
  await page.getByTestId('star-up').click();
  assert.match(await page.getByTestId('star-up').innerText(), /0\/20 shards/); assert.equal((await stored(page)).heroes.dora.stars, 2);
  // Gear from the bag.
  await page.getByTestId('equip-best').click();
  assert.match(await page.getByTestId('gear-0').innerText(), /\+16% attack/); assert.equal(await page.getByTestId('gear-0').getByRole('img').getAttribute('aria-label'), 'Weapon, tier 2'); assert.match(await page.getByTestId('gear-1').innerText(), /\+8% health/); assert.equal(await page.getByTestId('gear-1').getByRole('img').getAttribute('aria-label'), 'Armour, tier 1');
  await page.getByTestId('equip-best').click(); assert.match(await page.getByTestId('note').innerText(), /Nothing better in the bag/);
  // Places: Dora swaps with whoever is in Back 1, then rests, then comes back through an empty slot.
  const was = await saga(page, '(g) => [...g.squad]');
  await page.getByTestId('place-2').click();
  let now = await saga(page, '(g) => [...g.squad]');
  assert.equal(now[2], 'dora'); assert.equal(now[1], was[2], 'the two swap places'); assert.equal(await page.getByTestId('place-2').getAttribute('aria-pressed'), 'true');
  await page.getByTestId('bench').click();
  now = await saga(page, '(g) => [...g.squad]'); assert.equal(now[2], null); assert.equal(await page.getByTestId('slot-2').getAttribute('data-filled'), 'false');
  await page.getByTestId('slot-2').click();
  assert.equal((await saga(page, '(g) => [...g.squad]'))[2], 'dora', 'tapping an empty slot places the chosen hero');
  await page.getByTestId('slot-0').click(); assert.equal(await page.getByTestId('hero-name').innerText().then((t) => t.split(' ')[0]), heroName(now[0]));
  // Three of a faction switches the bonus on.
  await saga(page, '(g) => { for (const id of ["pip", "mossy", "clover", "willow"]) g.heroes[id] = { level: 1, stars: 1, shards: 0, gear: [0, 0, 0, 0] }; g.squad = ["mossy", "dora", "pip", "clover", "willow"]; }');
  assert.match(await page.getByTestId('bonus').innerText(), /Meadow 5[\s\S]*\+25% attack and health/);
  await saga(page, '(g) => { g.heroes.onyx = { level: 9, stars: 3, shards: 0, gear: [0, 0, 0, 0] }; }');
  await page.getByTestId('auto-squad').click();
  const best = await saga(page, '(g) => [...g.squad]'); assert.equal(new Set(best).size, 5);
  assert.ok(best.includes('onyx') && best.some((id) => ['pip', 'frost', 'ember'].includes(id)) && best.some((id) => ['enzo', 'mossy', 'pebble'].includes(id)), 'the best squad brings the strongest hero, a healer and a guard');
  assert.deepEqual((await stored(page)).squad, best);
});
function heroName(id) { return id[0].toUpperCase() + id.slice(1); }

await check('the forge, chapter chests and the camp chest', async (page) => {
  await squadUp(page);
  await saga(page, '(g) => { g.bag[0][1] = 3; g.bag[3][4] = 2; for (let i = 0; i < 10; i++) g.stars[i] = 2; g.campAt = Date.now() - 2 * 3600000; }');
  await page.getByTestId('tab-forge').click();
  assert.match(await page.getByTestId('bag-0-1').innerText(), /×3/); assert.ok(await page.getByTestId('forge-3-4').isDisabled(), 'two pieces are not enough');
  await page.getByTestId('forge-0-1').click();
  assert.match(await page.getByTestId('bag-0-1').innerText(), /×0/); assert.match(await page.getByTestId('bag-0-2').innerText(), /×1/);
  assert.equal(await page.getByTestId('forge-0-6').count(), 0, 'the top tier has no forge button');
  assert.equal((await stored(page)).bag[0][2], 1);
  await page.getByTestId('tab-adventure').click();
  assert.match(await page.getByTestId('chapter-stars').innerText(), /20\/30 stars/);
  await page.getByTestId('chest').click(); assert.match(await page.getByTestId('note').innerText(), /held 1 summoning scroll/);
  await page.getByTestId('chest').click(); assert.match(await page.getByTestId('note').innerText(), /held 2 summoning scrolls/);
  assert.ok(await page.getByTestId('chest').isDisabled()); assert.match(await page.getByTestId('chest').innerText(), /Chest at 30 stars/);
  assert.equal((await page.getByTestId('scrolls').innerText()).trim(), '3');
  const gold = await saga(page, '(g) => g.gold');
  assert.match(await page.getByTestId('camp-claim').innerText(), /Collect/);
  await page.getByTestId('camp-claim').click();
  assert.match(await page.getByTestId('note').innerText(), /Collected [\d,]+ gold from the camp chest/);
  assert.ok(await saga(page, '(g) => g.gold') > gold); assert.ok(await page.getByTestId('camp-claim').isDisabled(), 'and it is empty until it fills again');
  // The second chapter is open to look at.
  await page.getByTestId('chapter-next').click();
  assert.match(await page.getByTestId('chapter-name').innerText(), /Chapter 2 · Bramble Wood/); assert.ok(await page.getByTestId('stage-10').isEnabled()); assert.ok(await page.getByTestId('stage-11').isDisabled());
});

await check('a beaten stage offers auto, a boss brings a story hero, and the next stage follows on', async (page) => {
  await squadUp(page);
  await saga(page, '(g) => { for (let i = 0; i < 9; i++) g.stars[i] = 3; }');
  await page.getByTestId('stage-0').click(); await startFight(page);
  await page.getByTestId('auto').click(); assert.equal(await page.getByTestId('auto').getAttribute('aria-pressed'), 'true');
  await battle(page, '(b) => { for (const u of b.heroes) { u.energy = 100; u.max *= 50; u.hp = u.max; } }');
  await page.waitForFunction(() => window.__saga().game.battle.heroes.every((u) => u.energy < 100));
  await page.waitForFunction(() => /Auto: skills fire/.test(document.querySelector('[data-testid="hint"]').textContent));
  await page.keyboard.press('a'); assert.equal(await page.getByTestId('auto').getAttribute('aria-pressed'), 'false');
  await winNow(page);
  assert.doesNotMatch(await page.getByTestId('won').innerText(), /first clear/); assert.equal(await page.getByTestId('joined').count(), 0);
  await page.getByTestId('to-map').click();
  await page.getByTestId('adventure-panel').waitFor(); assert.equal(await page.getByTestId('stage-0').getAttribute('aria-pressed'), 'true', 'a replay keeps its stage selected');
  // The chapter boss.
  await page.getByTestId('stage-9').click();
  assert.match(await page.getByTestId('brief').innerText(), /Clover Meadow 10 · Thornback[\s\S]*Thornback[\s\S]*and Pip joins you/);
  await startFight(page);
  await page.waitForFunction(() => window.__saga().field.inspect(window.__saga().game.battle).banner.length > 0);
  await winNow(page);
  assert.match(await page.getByTestId('joined').innerText(), /Pip joins the squad: rare Meadow healer/);
  assert.ok((await stored(page)).heroes.pip, 'Pip is saved');
  await page.getByTestId('next').click(); await phase(page, 'march');
  await page.waitForFunction(() => /Bramble Wood 1/.test(document.querySelector('[data-testid="where"]').textContent));
  await page.getByTestId('retreat').click();
  assert.match(await page.getByTestId('chapter-name').innerText(), /Chapter 2 · Bramble Wood/);
});

await check('leaving and coming back, a new saga, the tower, and a broken save', async (page) => {
  await squadUp(page); await startFight(page); await winNow(page);
  await page.reload();
  assert.match(await page.getByTestId('continue').innerText(), /Carry on · Clover Meadow 2, 5\/20 heroes/);
  await page.getByTestId('continue').click(); await page.getByTestId('adventure-panel').waitFor();
  assert.equal(await page.getByTestId('stage-1').getAttribute('aria-pressed'), 'true', 'the map opens on the next stage');
  await page.getByTestId('menu').click();
  await page.getByTestId('new').click(); assert.match(await page.locator('.sg-sure').innerText(), /replaces your saga of 5 heroes and 1 stages/);
  await page.getByTestId('new-sure').click(); await page.getByTestId('adventure-panel').waitFor();
  assert.equal((await stored(page)).scrolls, 3); assert.ok(await page.getByTestId('stage-1').isDisabled());
  // With the campaign done, the tower stands on the map.
  assert.equal(await page.getByTestId('tower').count(), 0);
  await saga(page, '(g) => { g.stars.fill(3); for (const id of g.squad) if (id) g.heroes[id].level = 80; }');
  assert.match(await page.getByTestId('tower').innerText(), /The tower · floor 1/);
  await page.getByTestId('climb').click(); await phase(page, 'fight');
  await page.waitForFunction(() => /Tower floor 1/.test(document.querySelector('[data-testid="where"]').textContent)); assert.equal(await page.getByTestId('auto').count(), 0);
  await winNow(page);
  assert.equal((await stored(page)).tower, 1); assert.match(await page.getByTestId('next').innerText(), /Floor 2/);
  await page.getByTestId('to-map').click(); assert.match(await page.getByTestId('tower').innerText(), /floor 2[\s\S]*Best floor: 1/);
  // A save that makes no sense is ignored, not half-read.
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('saga-v1')); s.stars[40] = 0; localStorage.setItem('saga-v1', JSON.stringify(s)); });
  await page.reload(); await page.getByTestId('start').waitFor(); assert.equal(await page.getByTestId('continue').count(), 0);
  await page.evaluate(() => localStorage.setItem('saga-v1', '{not json'));
  await page.reload(); await page.getByTestId('start').waitFor();
});

await check('reduced motion: the battle plays without shake or drifting effects', async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await squadUp(page); await startFight(page);
  assert.equal(await page.evaluate(() => window.__saga().field.motion), false);
  await toLastWave(page);
  await page.waitForFunction(() => { const c = window.__saga().game.battle.foes.find((u) => u.key === 'captain'); return c && c.d <= c.reach; });
  await battle(page, '(b) => { b.foes.find((u) => u.key === "captain").specialT = 0.1; }');
  await page.waitForFunction(() => window.__saga().game.battle.time > 0 && !window.__saga().game.battle.winding && window.__saga().game.battle.foes.find((u) => u.key === 'captain')?.specialT > 5);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="skill-0"]')).animationName), 'none');
  await winNow(page);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="won"]')).animationName), 'none');
});

for (const [width, height] of [[360, 640], [390, 844], [844, 390], [768, 1024], [1280, 720], [1920, 1080]]) {
  await check(`layout ${width}×${height}: every screen fits, and the battle shows the field and all five skills`, async (page) => {
    await squadUp(page);
    assert.ok(await fits(page), 'the map fits');
    for (const tab of ['squad', 'summon', 'forge', 'adventure']) { await page.getByTestId(`tab-${tab}`).click(); assert.ok(await fits(page), `${tab} fits`); }
    await page.getByTestId('tab-squad').click(); await page.screenshot({ path: `.checks/saga/squad-${width}x${height}.png` }); await page.getByTestId('tab-adventure').click();
    await page.getByTestId('fight').scrollIntoViewIfNeeded(); await startFight(page);
    assert.ok(await fits(page), 'the battle fits'); assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), 'and does not scroll');
    const field = await page.getByTestId('field').boundingBox();
    assert.ok(field.height >= 150 && field.width >= 300 && field.y + field.height <= height + 1, `the field is on screen (${Math.round(field.width)}×${Math.round(field.height)})`);
    for (let slot = 0; slot < 5; slot++) { const b = await page.getByTestId(`skill-${slot}`).boundingBox(); assert.ok(b && b.x >= 0 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1 && b.height >= 38, `skill ${slot + 1} is on screen`); }
    for (const id of ['retreat', 'pause', 'speed', 'mute']) { const b = await page.getByTestId(id).boundingBox(); assert.ok(b && b.x >= 0 && b.x + b.width <= width + 1, `${id} fits`); }
    const seen = await page.evaluate(() => { const s = window.__saga(), v = s.field.inspect(s.game.battle), c = document.querySelector('[data-testid="field"]').getBoundingClientRect(); return { heroes: v.heroes, w: c.width, h: c.height, unit: v.unit }; });
    for (const p of seen.heroes) assert.ok(p.x - p.size * 0.9 >= 0 && p.x < seen.w * 0.7 && p.y <= seen.h && p.y - p.size >= 0, `the hero in slot ${p.slot} stands inside the field`);
    await page.waitForTimeout(1500); await page.screenshot({ path: `.checks/saga/battle-${width}x${height}.png` });
    await winNow(page);
    const card = await page.getByTestId('won').boundingBox();
    assert.ok(card.x >= 0 && card.x + card.width <= width + 1 && card.y >= 0, 'the victory card is on screen');
    const map = await page.getByTestId('to-map').boundingBox(); assert.ok(map.y + map.height <= height + 1 || await page.getByTestId('won').evaluate((el) => el.scrollHeight > el.clientHeight), 'its buttons can be reached');
  }, { width, height });
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
if (failures.length) { console.error(`\n${failures.length} Whisker Saga check(s) failed`); process.exit(1); }
console.log('PASS Whisker Saga: menu entry, summons, a keyboard battle with an interrupt, touch, pause and hidden tab, double speed, a loss, the squad screen, forge, chests, camp, auto, a story hero, reloads, the tower, broken saves, reduced motion and six layouts.');
