// Snow Day League in the browser: the title, Enzo's first note, a week's job (Rest) in the office, the draft (a tap
// shows a card in full, Ban strikes it, the rival coach answers on their own, a pick by number key, the Hint's button,
// Auto-draft), kick-off, a real match (the score bar with both forts and KOs, the clock running, a shout from the
// bench, speed), the result (the fort graph, explained stat columns), the replay of the deciding moment, back to the
// office for week two, the save across a reload, a corrupt save, the settings, and phones held sideways and upright,
// all with no page errors and no sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'snow-day-league-v1';
const browser = await chromium.launch();
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); }); page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__league(); return { screen: s.screen, save: s.save, draft: s.draft, match: s.match, replaying: s.replaying }; });
const until = async (page, fn, arg, timeout = 30000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) {
    const where = await page.evaluate(() => { const s = window.__league(); return JSON.stringify({ screen: s.screen, draft: s.draft && { step: s.draft.step, turn: s.draft.turn }, match: s.match }); });
    throw new Error(`${e.message}\n  game: ${where}`);
  }
};
const dbg = (page, fn, ...a) => page.evaluate(([f, args]) => window.__league().debug[f](...args), [fn, a]);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
let pass = 0;
const ok = (msg) => { pass++; console.log('PASS', msg); };

try {
  const page = await open();
  await page.goto(`${base}/league`); await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.ok(await page.locator('.lg-title-menu h1', { hasText: 'Snow Day League' }).isVisible());
  assert.equal(await page.locator('a.lg-home').getAttribute('href'), '/');
  ok('the title, with the way home');

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await until(page, () => window.__league().screen === 'office');
  const note = page.locator('.lg-note'); assert.ok(await note.isVisible(), 'Enzo explains the office');
  await note.getByRole('button', { name: 'Got it' }).click(); await until(page, () => window.__league().save.tutorial >= 1);
  assert.equal(await page.locator('.lg-cards .lg-card').count(), 7, 'seven players on the board');
  await page.getByRole('button', { name: /Fixtures/ }).click(); assert.ok(await page.locator('.lg-fixtures li').count() >= 7);
  await page.getByRole('button', { name: /League table/ }).click(); assert.equal(await page.locator('.lg-table tbody tr').count(), 8);
  const morale = (await st(page)).save.squad.map((p) => p.morale);
  await page.locator('.lg-job', { hasText: 'Rest' }).click();
  await until(page, () => window.__league().save.acted === 'rest');
  const after = (await st(page)).save.squad.map((p) => p.morale); assert.ok(after.every((m, i) => m >= morale[i]));
  assert.ok(await page.locator('.lg-job', { hasText: 'Train' }).isDisabled(), 'one job a week');
  ok('the office: Enzo’s note, the squad, fixtures and table, and a week’s job');

  await page.locator('.lg-ticket').click();
  await until(page, () => window.__league().screen === 'draft');
  let s = await st(page);
  if (s.draft.turn.side === 1) await until(page, () => window.__league().draft.turn?.side === 0, null, 10000);
  await page.locator('.lg-note').getByRole('button', { name: 'Got it' }).click();
  // a tap shows a card in full (and changes nothing), a tap on a legal card then Ban strikes it
  const step0 = (await st(page)).draft.step;
  await page.locator('.lg-blue .lg-mini').first().click();
  assert.ok(await page.locator('.lg-inspect').isVisible(), 'a tapped card opens in full');
  assert.equal((await st(page)).draft.step, step0, 'a single tap only looks');
  await page.locator('.lg-inspect').getByRole('button', { name: /^Ban / }).click();
  await until(page, (n) => window.__league().draft.step > n, step0);
  assert.ok(await page.locator('.lg-mini.lg-banned').count() >= 1, 'the ban is stamped');
  assert.equal(await page.locator('.lg-inspect').count(), 0, 'the card closes after the ban');
  // the rival coach answers on their own, then a pick by number key
  await until(page, () => { const d = window.__league().draft; return d.turn?.side === 0 && d.turn.kind === 'pick'; }, null, 15000);
  const picks = (await st(page)).draft.picks[0].length;
  await page.keyboard.press('1');
  await until(page, (n) => window.__league().draft.picks[0].length > n, picks);
  // the Hint's own button acts at once
  await until(page, () => { const d = window.__league().draft; return d.turn?.side === 0; }, null, 15000);
  const step1 = (await st(page)).draft.step;
  await page.locator('.lg-hint').getByRole('button', { name: 'Do it' }).click();
  await until(page, (n) => window.__league().draft.step > n, step1);
  await page.getByRole('button', { name: 'Auto-draft' }).click();
  await until(page, () => window.__league().draft.done);
  s = await st(page);
  assert.equal(s.draft.picks[0].length, 5); assert.equal(s.draft.picks[1].length, 5);
  ok('the draft: tap to look, Ban to strike, the rival’s answer, a number-key pick, the Hint, Auto-draft');

  await page.getByRole('button', { name: 'Kick off!' }).click();
  await until(page, () => window.__league().screen === 'match');
  await until(page, () => window.__league().match.t > 60);
  assert.ok(await page.locator('.lg-mtop .lg-hfort').count() === 2 && await page.locator('.lg-mtop img[alt="KOs"]').count() === 2, 'the score bar shows both forts and KOs');
  await page.locator('.lg-note').getByRole('button', { name: 'Got it' }).click().catch(() => {});
  await page.getByRole('button', { name: 'All attack!' }).click();
  await until(page, () => window.__league().match.used[0][0]);
  await page.getByRole('button', { name: '4×' }).click();
  const t0 = (await st(page)).match.t; await page.waitForTimeout(600); assert.ok((await st(page)).match.t > t0 + 30, 'the clock runs fast at 4×');
  assert.ok(await page.locator('.lg-ticker p').count() >= 1, 'the ticker tells the story');
  await page.getByRole('button', { name: 'Skip' }).click();
  await until(page, () => window.__league().screen === 'post', null, 20000);
  assert.ok(await page.locator('.lg-post h2').isVisible());
  assert.ok(await page.locator('.lg-graph svg polyline').count() === 2, 'the fort graph');
  assert.ok(await page.locator('.lg-stats th[title]').count() >= 5, 'the stat columns explain themselves');
  ok('the match: the clock, a shout, 4×, the ticker, skip to the result');

  await page.getByRole('button', { name: 'Replay the deciding moment' }).click();
  await until(page, () => window.__league().replaying);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await until(page, () => window.__league().screen === 'post' && !window.__league().replaying);
  ok('the replay of the deciding moment');

  await page.getByRole('button', { name: 'Back to the office' }).click();
  await until(page, () => window.__league().screen === 'office' && window.__league().save.week === 1);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  assert.equal(saved.week, 1); assert.equal(saved.table.reduce((a, r) => a + r.p, 0), 8);
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: /Continue/ }).click();
  await until(page, () => window.__league().screen === 'office' && window.__league().save.week === 1);
  ok('week two, and the save survives a reload');
  // week two's job: Train, in the training sheet: pick a stat (nothing happens yet), then confirm
  await page.locator('.lg-note').getByRole('button', { name: 'Got it' }).click({ timeout: 1500 }).catch(() => {});
  const before = await page.evaluate(() => { const p = window.__league().save.squad[0]; return { id: p.id, aim: p.aim }; });
  await page.locator('.lg-job', { hasText: 'Train' }).click();
  const sheet = page.getByRole('dialog', { name: 'Training' }); assert.ok(await sheet.isVisible(), 'Train opens the training sheet');
  await sheet.locator('.lg-gym-list li').first().locator('.lg-gym-stat').first().click();
  assert.equal((await st(page)).save.acted, null, 'picking a stat waits for the confirm');
  await sheet.getByRole('button', { name: /^Train .*: aim/ }).click();
  await until(page, () => window.__league().save.acted === 'train');
  assert.equal(await sheet.count(), 0, 'the sheet closes');
  const trained = await page.evaluate((id) => window.__league().save.squad.find((p) => p.id === id).aim, before.id);
  assert.equal(trained, Math.min(10, before.aim + 1), 'training raises the stat');
  ok('training a player');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await until(page, () => window.__league().screen === 'settings');
  await page.getByLabel('Music').uncheck();
  assert.equal((await st(page)).save.settings.music, false);
  await page.getByRole('button', { name: 'Back', exact: true }).click(); await until(page, () => window.__league().screen === 'office');
  ok('settings, and back');

  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"squad":"nope"}'), KEY);
  await page.reload(); await ready(page);
  assert.equal((await st(page)).screen, 'title');
  assert.equal(await page.getByRole('button', { name: /Continue/ }).count(), 0, 'a corrupt save starts fresh');
  ok('a corrupt save starts fresh');

  // Enzo's notes sit in the flow of the page: none may cover a button or a card
  const noteCovers = (p) => p.evaluate(() => {
    const bad = [];
    for (const n of document.querySelectorAll('.lg-note')) {
      const a = n.getBoundingClientRect(); if (!a.width) continue;
      for (const b of document.querySelectorAll('button, [role=button], input, .lg-mini, .lg-card')) {
        if (n.contains(b) || b.contains(n)) continue;
        const r = b.getBoundingClientRect(); if (!r.width || getComputedStyle(b).visibility === 'hidden') continue;
        if (r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top) bad.push((b.textContent || b.className).trim().slice(0, 30));
      }
    }
    return bad;
  });
  for (const [name, viewport] of [['sideways', { width: 844, height: 390 }], ['upright', { width: 390, height: 844 }]]) {
    const p = await open(viewport, true);
    await p.goto(`${base}/league`); await ready(p);
    await dbg(p, 'newGame', 3); await until(p, () => window.__league().screen === 'office');
    assert.ok(await noSideScroll(p), `${name}: no sideways scroll in the office`);
    assert.deepEqual(await noteCovers(p), [], `${name}: Enzo's note covers nothing in the office`);
    await p.locator('.lg-note').getByRole('button', { name: 'Got it' }).tap();
    await p.locator('.lg-ticket').tap(); await until(p, () => window.__league().screen === 'draft');
    await p.getByRole('button', { name: 'Auto-draft' }).tap(); await until(p, () => window.__league().draft.done);
    assert.ok(await noSideScroll(p), `${name}: no sideways scroll in the draft`);
    await p.getByRole('button', { name: 'Kick off!' }).tap(); await until(p, () => window.__league().screen === 'match' && window.__league().match.t > 30);
    assert.ok(await p.locator('.lg-note').isVisible() && (await noteCovers(p)).length === 0, `${name}: Enzo's match note covers no control`);
    const box = await p.locator('.lg-canvas').boundingBox(); assert.ok(box.width > 300, `${name}: the pitch is big enough`);
    assert.ok(await p.getByRole('button', { name: 'Skip' }).isVisible(), `${name}: the controls are on screen`);
    await p.getByRole('button', { name: 'Skip' }).tap(); await until(p, () => window.__league().screen === 'post', null, 20000);
    assert.ok(await noSideScroll(p), `${name}: no sideways scroll after the match`);
    await p.context().close();
    ok(`a phone held ${name}`);
  }

  assert.deepEqual(errors, [], 'no page errors');
  ok('no page errors');
} finally { await browser.close(); }
console.log(`\n${pass} Snow Day League browser checks passed`);
