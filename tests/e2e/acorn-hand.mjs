import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/acorn-hand', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }, options = {}) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view, hasTouch: true, ...options });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) {
    if (process.env.ONLY) console.error(e.message.slice(0, 900));
    console.error('  state at failure:', JSON.stringify(await page.evaluate(() => { const r = window.__acorn?.()?.run; return r ? { phase: r.phase, ante: r.ante, blind: r.blind, round: r.round && { score: r.round.score, target: r.round.target, plays: r.round.plays } } : null; }).catch(() => null)));
    failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);
  }
  finally { await page.close(); }
}
/** Changes the running run, then redraws. */
const run = (page, fn, arg) => page.evaluate(`(() => { const s = window.__acorn(), out = (${fn})(s.run, ${JSON.stringify(arg ?? null)}); s.refresh(); return out; })()`);
const fresh = async (page) => { await page.goto(`${base}/acorn-hand`); await page.evaluate(() => localStorage.clear()); await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); };
const deal = async (page) => { await page.getByTestId('new-run').click(); await page.getByTestId('pick').waitFor(); await page.getByTestId('start').click(); await page.getByTestId('hand').waitFor(); };
const settled = (page) => page.waitForFunction(() => !window.__acorn().anim);
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
const stored = (page, key = 'acorn-hand-run-v2') => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key);
/** A known hand: two kings, two fives and four low odd cards. */
const setHand = (page) => run(page, `(r) => { const want = [[13,0],[13,1],[5,2],[5,3],[2,0],[7,1],[9,2],[3,3]]; r.round.hand = want.map(([rank, suit]) => r.deck.find((c) => c.rank === rank && c.suit === suit).id); r.round.draw = r.round.draw.filter((id) => !r.round.hand.includes(id)); }`);

await check('the arcade lists Acorn Hand and opens it on a fresh record', async (page) => {
  await page.goto(base);
  assert.equal(await page.locator('.arcade-card').count(), 34);
  await page.getByRole('link', { name: /Acorn Hand/ }).click();
  await page.locator('main[data-ready="true"]').waitFor();
  assert.match(await page.getByTestId('record').innerText(), /Runs\s*0[\s\S]*Wins\s*0/);
  await page.getByTestId('how').click(); assert.match(await page.getByTestId('help').innerText(), /chips × mult|Chips × mult/);
});

await check('a round by mouse: pick cards, see the hand, count the score up, discard', async (page) => {
  await fresh(page); await deal(page); await setHand(page);
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 8);
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click();
  assert.match(await page.getByTestId('hand-name').innerText(), /Pair · lvl 1/);
  assert.equal(await page.getByTestId('chips').innerText(), '10'); assert.equal(await page.getByTestId('mult').innerText(), '2');
  await page.getByTestId('card-2').click(); await page.getByTestId('card-3').click();
  assert.match(await page.getByTestId('hand-name').innerText(), /Two pair/);
  await page.getByTestId('play').click();
  await page.getByTestId('pop').first().waitFor();
  await page.getByTestId('hand-total').waitFor();
  assert.equal((await page.getByTestId('hand-total').innerText()).trim(), String((20 + 10 + 10 + 5 + 5) * 2), 'two pair of kings and fives: (20 + 30) × 2');
  await settled(page);
  assert.equal(await page.getByTestId('score').innerText(), '100'); assert.match(await page.getByTestId('plays').innerText(), /3/);
  assert.equal(await page.locator('[data-testid^="card-"]').count(), 8, 'the hand refills');
  assert.equal((await stored(page)).round.score, 100, 'the play is saved before the count finishes');
  await page.getByTestId('card-7').click(); await page.getByTestId('discard').click();
  assert.match(await page.getByTestId('discards').innerText(), /2/); assert.equal(await page.locator('[data-testid^="card-"]').count(), 8);
});

await check('the keyboard plays a whole round', async (page) => {
  await fresh(page); await deal(page); await setHand(page);
  await page.keyboard.press('1'); await page.keyboard.press('2');
  assert.equal(await page.evaluate(() => window.__acorn().selected.length), 2);
  await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => window.__acorn().selected.length), 0, 'Esc clears');
  await page.keyboard.press('s'); assert.match(await page.getByTestId('sort').innerText(), /suit/);
  await page.keyboard.press('s'); assert.match(await page.getByTestId('sort').innerText(), /rank/);
  await page.keyboard.press('8'); await page.keyboard.press('d'); await page.waitForFunction(() => window.__acorn().run.round.discards === 2);
  await page.keyboard.press('1'); await page.keyboard.press('Enter'); await settled(page);
  assert.equal(await page.evaluate(() => window.__acorn().run.round.plays), 3);
  await page.keyboard.press('m'); assert.equal(await page.evaluate(() => localStorage.getItem('acorn-hand-sound-v1')), 'off');
  assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
});

await check('a phone plays by tapping', async (page) => {
  await fresh(page); await page.getByTestId('new-run').tap(); await page.getByTestId('start').tap(); await setHand(page);
  await page.getByTestId('card-0').tap(); await page.getByTestId('card-1').tap(); await page.getByTestId('play').tap(); await settled(page);
  assert.equal(await page.evaluate(() => window.__acorn().run.round.score), (10 + 20) * 2);
  assert.ok(await fits(page), 'no sideways scrolling');
}, { width: 390, height: 844 }, { isMobile: true });

await check('winning a round pays out, and the shop buys, sells, rerolls and uses', async (page) => {
  await fresh(page); await deal(page);
  await run(page, '(r) => { r.round.target = 1; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  await page.getByTestId('cashout').waitFor();
  assert.match(await page.getByTestId('cashout').innerText(), /Small round\s*\+3/);
  const nuts = await run(page, '(r) => r.nuts');
  await page.getByTestId('collect').click(); await page.getByTestId('shop').waitFor();
  assert.ok(await run(page, '(r) => r.nuts') > nuts);
  await run(page, '(r) => { r.nuts = 60; r.shop.items = [{ kind: "almanac", id: "pair" }, { kind: "treat", id: "tea" }]; }');
  const offered = await run(page, '(r) => r.shop.charms[0]');
  await page.getByTestId('buy-charm-0').click();
  assert.equal(await run(page, '(r) => r.charms[0].id'), offered); assert.equal(await page.locator('[data-testid^="charm-"]').count(), 1);
  await page.getByTestId('reroll').click(); assert.match(await page.getByTestId('reroll').innerText(), /6/, 'a reroll costs one more next time');
  await page.getByTestId('buy-item-0').click(); await page.getByTestId('use-0').click();
  assert.equal(await run(page, '(r) => r.levels.pair'), 2, 'an almanac page levels its hand');
  await page.getByTestId('sell-0').click(); assert.equal(await run(page, '(r) => r.charms.length'), 0);
  assert.equal((await stored(page)).levels.pair, 2, 'and the shop is saved');
  await page.getByTestId('leave').click(); await page.getByTestId('pick').waitFor();
  await page.getByTestId('skip').click(); assert.equal(await run(page, '(r) => r.blind'), 2, 'skipping the big round leads to the boss');
  assert.match(await page.getByTestId('note').innerText(), /Skipped/);
});

await check('vouchers and packs: buy a voucher, open every kind of pack, and a reload comes back inside one', async (page) => {
  await fresh(page); await deal(page);
  await run(page, '(r) => { r.round.target = 1; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  await page.getByTestId('collect').click(); await page.getByTestId('shop').waitFor();
  await run(page, '(r) => { r.nuts = 200; r.offer = "shelf"; }');
  await page.getByTestId('buy-voucher').click();
  assert.deepEqual(await run(page, '(r) => r.vouchers'), ['shelf']);
  assert.equal(await page.locator('[data-testid="charms"] > *').count(), 6, 'Wider Shelf shows a sixth slot');
  assert.match(await page.getByTestId('vouchers').innerText(), /Wider Shelf/);
  // A charm pack, by mouse.
  await run(page, '(r) => { r.shop.packs = ["charm", "almanac-big"]; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
  const want = await run(page, '(r) => r.pack.options[1]');
  await page.getByTestId('take-1').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.charms[0].id'), want);
  // A big almanac pack, two picks by keyboard.
  await page.getByTestId('open-pack-1').click(); await page.getByTestId('pack').waitFor();
  const [a, b] = await run(page, '(r) => r.pack.options.slice(0, 2)');
  await page.keyboard.press('1'); await page.keyboard.press('2'); await page.getByTestId('shop').waitFor();
  assert.deepEqual(await run(page, `(r) => [r.levels["${a}"], r.levels["${b}"]]`), [2, 2], 'both pages are used as they are taken');
  // A treat pack: a digit with nothing selected explains itself, then honey on two dealt cards.
  await run(page, '(r) => { r.shop.packs = ["treat", "card"]; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('dealt').waitFor();
  await run(page, '(r) => { r.pack.options = ["honey", "tea", "mirror"]; }');
  await page.keyboard.press('1'); assert.match(await page.getByTestId('note').innerText(), /Select/); assert.equal(await run(page, '(r) => r.phase'), 'pack');
  const ids = await run(page, '(r) => r.pack.dealt.slice(0, 2)');
  await page.getByTestId('dealt-0').click(); await page.getByTestId('dealt-1').click(); await page.getByTestId('take-0').click();
  await page.getByTestId('shop').waitFor();
  assert.deepEqual(await run(page, `(r) => ${JSON.stringify(ids)}.map((id) => r.card(id).gloss)`), ['honey', 'honey']);
  // A card pack joins the deck.
  const deck = await run(page, '(r) => r.deck.length');
  await page.getByTestId('open-pack-1').click(); await page.getByTestId('pack').waitFor(); await page.getByTestId('take-0').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.deck.length'), deck + 1);
  // A reload inside a pack comes back to it; Skip leaves it.
  await run(page, '(r) => { r.leave(); r.phase = "shop"; r.shop = { charms: [null, null], items: [null, null], packs: ["card-big", null], rerolls: 0 }; }');
  await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
  assert.equal((await stored(page)).phase, 'pack', 'the open pack is saved');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); await page.getByTestId('continue').click(); await page.getByTestId('pack').waitFor();
  assert.equal(await run(page, '(r) => r.pack.id'), 'card-big');
  await page.getByTestId('skip-pack').click(); await page.getByTestId('shop').waitFor();
  assert.equal(await run(page, '(r) => r.pack'), null);
});

await check('a boss rule is shown and enforced', async (page) => {
  await fresh(page); await page.getByTestId('new-run').click(); await page.getByTestId('pick').waitFor();
  await run(page, '(r) => { r.bosses[0] = "five"; r.blind = 2; }');
  assert.match(await page.getByTestId('blind-2').innerText(), /The Badger[\s\S]*exactly five cards/);
  await page.getByTestId('start').click();
  assert.match(await page.getByTestId('boss-rule').innerText(), /The Badger/);
  assert.equal(await page.getByTestId('rival').getAttribute('data-rival'), 'badger', 'the boss sits at the table');
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click();
  assert.match(await page.getByTestId('hand-name').innerText(), /exactly five/);
  await page.getByTestId('play').click(); assert.equal(await run(page, '(r) => r.round.plays'), 4, 'two cards cannot be played');
  for (const i of [2, 3, 4]) await page.getByTestId(`card-${i}`).click();
  await page.getByTestId('play').click(); await settled(page); assert.equal(await run(page, '(r) => r.round.plays'), 3);
});

await check('a rival sits across the table every round, says hello, and stays after a reload', async (page) => {
  await fresh(page); await deal(page);
  const rival = page.getByTestId('rival'); await rival.waitFor();
  const small = await rival.getAttribute('data-rival'); assert.ok(small);
  assert.ok((await page.getByTestId('rival-say').innerText()).trim().length > 0, 'a greeting on entering');
  assert.equal(await page.getByTestId('nut-pile').getAttribute('data-left'), '10');
  await setHand(page); await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click(); await settled(page);
  assert.ok(Number(await page.getByTestId('nut-pile').getAttribute('data-left')) < 10, 'nuts leave the pile as the score grows');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); await page.getByTestId('continue').click();
  assert.equal(await page.getByTestId('rival').getAttribute('data-rival'), small, 'the same rival after a reload');
  await run(page, '(r) => { r.round.target = 1; }'); await page.getByTestId('card-0').click(); await page.getByTestId('play').click();
  assert.equal(await page.getByTestId('table').count(), 1, 'the winning hand counts on the table');
  await settled(page); await page.getByTestId('cashout').waitFor();
  await page.getByTestId('collect').click(); await page.getByTestId('leave').click(); await page.getByTestId('start').click();
  const big = await page.getByTestId('rival').getAttribute('data-rival'); assert.notEqual(big, small, 'a new rival for the big round');
  const boss = await run(page, '(r) => r.bossFor(r.ante).rival'); assert.notEqual(big, boss);
});

await check('running out of plays ends the run and records it', async (page) => {
  await fresh(page); await deal(page);
  await run(page, '(r) => { r.round.target = 10 ** 9; }');
  for (let i = 0; i < 4; i++) { await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page); }
  await page.getByTestId('over').waitFor();
  assert.equal(await stored(page), null, 'a lost run is not offered again');
  assert.equal((await stored(page, 'acorn-hand-v1')).runs, 1);
  await page.getByTestId('again').click(); await page.getByTestId('pick').waitFor();
});

await check('a reload comes back to the same round, and broken saves are ignored', async (page) => {
  await fresh(page); await deal(page); await setHand(page);
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click(); await settled(page);
  const before = await run(page, '(r) => ({ hand: r.round.hand, score: r.round.score })');
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor(); await page.getByTestId('continue').click(); await page.getByTestId('hand').waitFor();
  assert.deepEqual(await run(page, '(r) => ({ hand: r.round.hand, score: r.round.score })'), before);
  await page.evaluate(() => localStorage.setItem('acorn-hand-run-v2', '{"v":1,"seed":"nope"}')); await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0);
  await page.evaluate(() => localStorage.setItem('acorn-hand-run-v2', 'not json')); await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0);
  await page.evaluate(() => { localStorage.removeItem('acorn-hand-run-v2'); localStorage.setItem('acorn-hand-run-v1', JSON.stringify({ v: 1, seed: 5, rand: 5, ante: 2, blind: 0, phase: 'pick' })); });
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  assert.equal(await page.getByTestId('continue').count(), 0, 'a run from before vouchers is not offered');
});

await check('beating the eighth boss wins, and endless carries on', async (page) => {
  await fresh(page); await page.getByTestId('new-run').click(); await page.getByTestId('pick').waitFor();
  await run(page, '(r) => { r.ante = 8; r.blind = 2; r.bossFor(8); }');
  await page.getByTestId('start').click(); await run(page, '(r) => { r.round.target = 1; }');
  await page.getByTestId('card-0').click(); await page.getByTestId('play').click(); await settled(page);
  await page.getByTestId('collect').click(); await page.getByTestId('victory').waitFor();
  assert.equal((await stored(page, 'acorn-hand-v1')).wins, 1);
  await page.getByTestId('endless').click(); await page.getByTestId('shop').waitFor();
  assert.ok(await run(page, '(r) => r.endless'));
});

await check('reduced motion scores at once', async (page) => {
  await fresh(page); await deal(page); await setHand(page);
  await page.getByTestId('card-0').click(); await page.getByTestId('card-1').click(); await page.getByTestId('play').click();
  assert.equal(await page.evaluate(() => window.__acorn().anim), null); assert.equal(await page.getByTestId('hand-total').count(), 0);
  assert.equal(await page.getByTestId('score').innerText(), '60');
}, { width: 1280, height: 860 }, { reducedMotion: 'reduce' });

for (const [width, height] of [[360, 640], [390, 844], [844, 390], [768, 1024], [1280, 720], [1920, 1080]]) {
  await check(`layout ${width}×${height}: title, rounds, the table and the shop fit`, async (page) => {
    await fresh(page); assert.ok(await fits(page), 'title');
    await page.getByTestId('new-run').click(); await page.getByTestId('pick').waitFor(); assert.ok(await fits(page), 'pick');
    await page.getByTestId('start').click(); await page.getByTestId('card-0').click(); assert.ok(await fits(page), 'table');
    const play = await page.getByTestId('play').boundingBox(); assert.ok(play.x >= 0 && play.x + play.width <= width + 1, 'the play button is on screen');
    await page.screenshot({ path: `.checks/acorn-hand/table-${width}x${height}.png` });
    await run(page, '(r) => { r.round.target = 1; }'); await page.getByTestId('play').click(); await settled(page);
    await page.getByTestId('collect').click(); await page.getByTestId('shop').waitFor(); assert.ok(await fits(page), 'shop');
    await page.screenshot({ path: `.checks/acorn-hand/shop-${width}x${height}.png`, fullPage: true });
    await run(page, '(r) => { r.nuts = 50; r.shop.packs[0] = "treat-big"; }'); await page.getByTestId('open-pack-0').click(); await page.getByTestId('pack').waitFor();
    assert.ok(await fits(page), 'pack');
    await page.screenshot({ path: `.checks/acorn-hand/pack-${width}x${height}.png`, fullPage: true });
  }, { width, height });
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
if (failures.length) { console.error(`\n${failures.length} Acorn Hand check(s) failed`); process.exit(1); }
console.log('PASS Acorn Hand: menu entry, a mouse round with the score counted up, keyboard and touch play, the payout and shop, a boss rule, a lost run, reloads and broken saves, the win and endless, reduced motion and six layouts.');
