import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const failures = [], errors = [];
mkdirSync('.checks/trek', { recursive: true });
async function check(name, fn, view = { width: 1280, height: 860 }) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  const page = await browser.newPage({ viewport: view });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try { await fn(page); console.log(`PASS ${name}`); }
  catch (e) { failures.push(name); console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`); if (process.env.TRACE) console.error(e.stack); }
  finally { await page.close(); }
}
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
const fresh = async (page) => { await page.goto(`${base}/trek`); await page.evaluate(() => localStorage.clear()); await page.reload(); await ready(page); };
/** Runs `fn(w, arg)` in the page with `w = window.__trek()`. */
const trek = (page, fn, arg) => page.evaluate(`(() => { const w = window.__trek(); return (${fn})(w, ${JSON.stringify(arg ?? null)}); })()`);
const state = (page) => trek(page, (w) => w.trek && JSON.parse(JSON.stringify(w.trek)));
const profile = (page) => trek(page, (w) => JSON.parse(JSON.stringify(w.profile)));
const screen = (page, s) => page.locator(`main[data-screen="${s}"]`).waitFor();
/** A trek with a known seed, auto-walk off unless asked, on the trek screen. */
async function begin(page, { hero = 'enzo', chapter = 1, seed = 3, auto = false } = {}) {
  await trek(page, (w, a) => { w.setProfile({ ...w.profile, ui: { fast: false, auto: a.auto } }); w.start(a.hero, a.chapter, a.seed); }, { hero, chapter, seed, auto });
  await screen(page, 'trek');
}
const replayDone = (page) => page.waitForFunction(() => { const r = window.__trek().replay; return !r || r.i >= r.out.events.length; });
/** Walks one day and waits for it to settle (a fight's replay skipped). */
async function walk(page) {
  await page.getByTestId('walk').click();
  await page.waitForFunction(() => window.__trek().trek.phase !== 'walk' || window.__trek().replay || window.__trek().walking === false);
  if (await trek(page, (w) => !!w.replay)) { await page.getByTestId('skip').click().catch(() => {}); await replayDone(page); }
}
const statusMatches = async (page) => {
  const t = await state(page), max = await trek(page, (w) => w.trek.stats().hp);
  assert.ok((await page.getByTestId('hp').textContent()).includes(`${t.hp}/${max}`), 'hp in the bar');
  assert.ok((await page.getByTestId('day').textContent()).includes(`${t.day}/30`), 'day in the bar');
  assert.ok((await page.getByTestId('acorns').textContent()).includes(String(t.acorns)), 'acorns in the bar');
};

await check('start: a fresh title has no Continue, camp shows chapter 1 only, Enzo sets off', async (page) => {
  await fresh(page);
  assert.equal(await page.getByTestId('continue').count(), 0);
  await page.getByTestId('camp').click(); await screen(page, 'camp');
  assert.equal(await page.getByTestId('chapter-1').isEnabled(), true);
  for (const n of [2, 3, 4, 5]) assert.equal(await page.getByTestId(`chapter-${n}`).isEnabled(), false, `chapter ${n} locked`);
  await page.getByTestId('hero-enzo').click(); await page.getByTestId('set-off').click();
  await screen(page, 'trek');
  const t = await state(page);
  assert.deepEqual([t.hero, t.chapter, t.day, t.phase], ['enzo', 1, 0, 'walk']);
  await page.screenshot({ path: '.checks/trek/walk-1.png' });
});

await check('the first fight plays back, skips, and the bar agrees', async (page) => {
  await fresh(page); await begin(page);
  await page.getByTestId('walk').click();
  await page.waitForFunction(() => !!window.__trek().replay);
  await page.waitForTimeout(700);
  await page.getByTestId('stage').screenshot({ path: '.checks/trek/fight.png' });
  await page.getByTestId('skip').click(); await replayDone(page);
  const t = await state(page);
  assert.equal(t.day, 1); assert.equal(t.today.k, 'fight');
  await statusMatches(page);
});

await check('a level-up offers cards; reroll works once; a card goes in the tray', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ xp: 40 }));
  await walk(page);
  await page.getByTestId('card-0').waitFor();
  await page.screenshot({ path: '.checks/trek/pick.png' });
  await page.getByTestId('reroll').click();
  assert.equal(await page.getByTestId('reroll').isEnabled(), false);
  const card = (await state(page)).offer[0];
  await page.getByTestId('card-0').click();
  const id = card.k === 'evo' ? card.id : card.id;
  await page.getByTestId(`tray-${id}`).waitFor();
});

await check('after a fight, a pick that raises max hp shows the new max in the bar', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ xp: 40 }));
  await walk(page);
  await page.getByTestId('card-0').waitFor();
  await trek(page, (w) => w.set({ kit: { ...w.trek.kit, skills: { ...w.trek.kit.skills, fluff: 3 } } }));
  await statusMatches(page);
});

await check('a story day: a choice shows its outcome', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ day: 3, today: { k: 'story', scene: 'mushroom' }, phase: 'event' }));
  await page.getByTestId('choice-1').waitFor();
  await page.screenshot({ path: '.checks/trek/story.png' });
  await page.getByTestId('choice-1').click();
  const note = await page.getByTestId('note').textContent();
  assert.ok(note.length > 5, note);
  assert.equal((await state(page)).phase, 'walk');
});

await check('the crossroads: the Fox lowers max hp and adds two skills', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ day: 14 }));
  await walk(page);
  assert.equal((await state(page)).today.k, 'crossroads');
  const max = await trek(page, (w) => w.trek.stats().hp), before = Object.keys((await state(page)).kit.skills).length;
  await page.getByTestId('choice-2').click();
  const t = await state(page);
  assert.equal(Object.keys(t.kit.skills).length, before + 2);
  assert.ok(t.kit.bonus.hp < 0 && (await trek(page, (w) => w.trek.stats().hp)) <= max);
  await statusMatches(page);
});

await check('the pedlar: a ware you can\'t afford is disabled; a buy spends acorns', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ day: 24, acorns: 0 }));
  await walk(page);
  assert.equal((await state(page)).today.k, 'pedlar');
  assert.equal(await page.getByTestId('ware-0').isEnabled(), false);
  await trek(page, (w) => w.set({ acorns: 500 }));
  await page.getByTestId('ware-2').click();
  assert.equal((await state(page)).acorns, 500 - 30);
  await statusMatches(page);
  await page.getByTestId('walk-on').click();
  assert.equal((await state(page)).phase, 'walk');
});

await check('a reload during a fight replay continues where the trek is, without replaying', async (page) => {
  await fresh(page); await begin(page);
  await page.getByTestId('walk').click();
  await page.waitForFunction(() => !!window.__trek().replay);
  const t = await state(page);
  await page.reload(); await ready(page);
  await page.getByTestId('continue').click(); await screen(page, 'trek');
  const u = await state(page);
  assert.deepEqual([u.day, u.hp], [t.day, t.hp]);
  assert.equal(await trek(page, (w) => w.replay), null);
});

await check('the end of a trek: the chest, acorns banked, Continue gone', async (page) => {
  await fresh(page); await begin(page);
  await trek(page, (w) => w.set({ hp: 1, acorns: 9 }));
  await walk(page);
  await page.getByTestId('walk').click().catch(() => {});
  await screen(page, 'over');
  await page.getByTestId('chest').waitFor();
  await page.screenshot({ path: '.checks/trek/end.png' });
  const p = await profile(page);
  assert.ok(p.acorns >= 9 && p.gear.length === 1, `banked ${p.acorns}`);
  await page.getByTestId('camp').click(); await screen(page, 'camp');
  await page.getByTestId('back').click(); await screen(page, 'title');
  assert.equal(await page.getByTestId('continue').count(), 0);
});

await check('camp: training spends acorns, three plain hats merge into a fine one, worn', async (page) => {
  await fresh(page);
  await trek(page, (w) => w.setProfile({ ...w.profile, acorns: 100, gear: [1, 2, 3].map((uid) => ({ uid, slot: 'hat', r: 0 })), worn: { hat: 1 }, next: 4 }));
  await page.getByTestId('camp').click(); await screen(page, 'camp');
  await page.getByTestId('train-atk').click();
  let p = await profile(page); assert.equal(p.acorns, 80); assert.equal(p.training.atk, 1);
  await page.getByTestId('merge-hat-0').click();
  p = await profile(page);
  assert.deepEqual(p.gear, [{ uid: 4, slot: 'hat', r: 1 }]); assert.equal(p.worn.hat, 4);
  await page.screenshot({ path: '.checks/trek/camp.png' });
  await page.reload(); await ready(page);
  assert.equal((await profile(page)).acorns, 80, 'saved');
});

await check('auto-walk: days go by without taps until a choice is needed', async (page) => {
  await fresh(page); await begin(page, { auto: true, seed: 11 });
  await page.getByTestId('speed').click();
  const waiting = () => page.waitForFunction(() => { const w = window.__trek(), t = w.trek; return t.day >= 1 && !w.replay && !w.walking && t.phase !== 'walk'; }, null, { timeout: 40000 });
  await waiting();
  const t = await state(page);
  assert.ok(t.phase === 'pick' || t.phase === 'event' || t.phase === 'over', t.phase);
  await page.waitForTimeout(1500);
  assert.equal((await state(page)).day, t.day, 'waits for the choice');
  if (t.phase === 'pick') {
    await page.getByTestId('card-0').click();
    await page.waitForFunction((d) => window.__trek().trek.day > d, t.day, { timeout: 40000 });
  }
});

await check('the journal lists 18 skills, 4 evolutions and 30 foes', async (page) => {
  await fresh(page);
  await page.getByTestId('journal').click(); await screen(page, 'journal');
  assert.equal(await page.locator('[data-testid^="journal-skill-"]').count(), 18);
  assert.equal(await page.locator('[data-testid^="journal-evo-"]').count(), 4);
  assert.equal(await page.locator('[data-testid^="journal-foe-"]').count(), 30);
});

for (const view of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
  await check(`fit at ${view.width}×${view.height}: no scroll; mute persists`, async (page) => {
    await fresh(page); await begin(page);
    await trek(page, (w) => w.set({ day: 3, today: { k: 'story', scene: 'picnic' }, phase: 'event' }));
    await page.getByTestId('choice-0').waitFor();
    const fit = await page.evaluate(() => { const s = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { sh: document.documentElement.scrollHeight, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth, bottom: s.bottom, right: s.right }; });
    assert.ok(fit.sh <= fit.h && fit.sw <= fit.w, `scroll ${JSON.stringify(fit)}`);
    assert.ok(fit.bottom <= fit.h && fit.right <= fit.w);
    for (const id of ['choice-0', 'choice-1']) { const b = await page.getByTestId(id).boundingBox(); assert.ok(b.y + b.height <= fit.h, `${id} on screen`); }
    await page.screenshot({ path: `.checks/trek/story-${view.width}.png` });
    await page.getByTestId('mute').click();
    await page.reload(); await ready(page);
    assert.equal(await page.getByTestId('mute').getAttribute('aria-pressed'), 'true');
  }, view);
}

await browser.close();
if (errors.length) { console.error('page errors:\n' + errors.join('\n')); failures.push('page errors'); }
if (failures.length) { console.error(`${failures.length} failed`); process.exit(1); }
console.log('PASS Chinchilla Trek in the browser');
