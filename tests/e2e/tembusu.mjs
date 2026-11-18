// Tembusu in the browser, at three desktop sizes, sound off (the save is seeded with sound off and Chromium is muted):
// the title and the first seed; time skipped through the whole 15-minute tutorial tree; a bud picked by clicking it on
// the branch, one by pressing 2 and one in the panel; the fall, the wordless recap, keeping three seeds and planting
// one; the journal by key and by button and Esc; the settings (sound, grow speed, back to the arcade); a clock set
// backwards; a week away; and screenshots of the play view at dawn, day, dusk and night, in a storm and a dry spell,
// at a fork, the recap, the seed pick and the journal (in .shots/tembusu/, not committed). No page errors, no
// sideways scrolling. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'tembusu-v1';
const SHOTS = '.shots/tembusu';
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio'] });
const errors = [];
let pass = 0;
const ok = (m) => { pass++; console.log('PASS', m); };
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

const open = async (viewport) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 3) throw e; }
    await page.reload().catch(() => {});
  }
};
const st = (page) => page.evaluate(() => { const s = window.__tembusu.state(); return { phase: s.tree.phase, n: s.tree.n, u: s.tree.u, fork: s.tree.fork, chosen: s.tree.chosen, decision: s.decision, scene: s.scene, buds: s.buds, overlay: s.overlay, save: s.save, weather: s.tree.weather, started: s.started }; });
const skip = (page, ms) => page.evaluate((m) => window.__tembusu.skip(m), ms);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** skip forward in small steps until the tree is waiting for something */
async function untilDecision(page, step = 20_000, max = 400) {
  for (let i = 0; i < max; i++) {
    const s = await st(page);
    if (s.decision) return s;
    await skip(page, step);
  }
  throw new Error('no decision came');
}
/** a seeded save, sound off, begun, built by the page's own engine */
async function seed(page, { hoursAgo = 0, hour = null, n = 3, treeSeed = 77, traits = [] } = {}) {
  await page.goto(`${base}/tembusu`); await ready(page);
  await page.evaluate(([k, ago, hr, n, sd, tr]) => {
    const G = window.__tembusu.engine;
    const now = Date.now(), start = now - ago * 3_600_000;
    const utcH = (now / 3_600_000) % 24;
    const tz = hr === null ? -new Date().getTimezoneOffset() : Math.round((((hr - utcH) % 24 + 24) % 24) * 60);
    const s = G.newSave(start, sd, tz);
    s.sound = false; s.begun = true;
    s.tree = G.newTree(n, sd, start, tz, 'normal', tr);
    s.journal.trees = Array.from({ length: n - 1 }, (_, i) => ({ n: i + 1, start: 0, fell: 0, cause: 'age', animals: [], traits: [] }));
    localStorage.setItem(k, JSON.stringify(s));
  }, [KEY, hoursAgo, hour, n, treeSeed, traits]);
  await page.reload(); await ready(page);
  await page.waitForTimeout(700);
}
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

try {
  for (const [i, viewport] of [{ width: 1280, height: 800 }, { width: 1536, height: 864 }, { width: 1920, height: 1080 }].entries()) {
    const tag = `${viewport.width}`;
    const page = await open(viewport);
    // ---- the title: a fresh save, sound off, not yet begun
    await page.goto(`${base}/tembusu`); await ready(page);
    await page.evaluate((k) => { const G = window.__tembusu.engine; const s = G.newSave(Date.now(), 4242 + 0, 480); s.sound = false; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await page.reload(); await ready(page);
    assert.equal((await st(page)).started, false);
    assert.equal(await page.locator('.tb-title a.tb-home').getAttribute('href'), '/');
    if (i === 0) await shot(page, 'title');
    await page.getByRole('button', { name: 'Plant the first seed' }).click();
    let s = await st(page);
    assert.equal(s.started, true); assert.equal(s.n, 1); assert.equal(s.save.sound, false); assert.equal(s.save.begun, true);
    await assert.doesNotReject(page.getByText('Tree 1').waitFor());
    assert.ok(await noSideScroll(page));
    ok(`${tag}: title, the first seed planted, sound off`);

    // ---- fork 1: click a bud on the branch itself
    s = await untilDecision(page);
    assert.equal(s.decision.kind, 'bud');
    await page.waitForFunction(() => window.__tembusu.state().scene?.buds === 3);
    s = await st(page);
    await page.locator('[data-testid="buds"]').waitFor();
    if (i === 0) await shot(page, 'fork');
    const box = await page.locator('canvas').boundingBox();
    const b = s.buds[2];
    await page.mouse.click(box.x + (b.x / 384) * box.width, box.y + (b.y / 256) * box.height);
    s = await st(page);
    assert.equal(s.chosen.length, 1); assert.equal(s.chosen[0].assist, false); assert.equal(s.phase, 'growing');
    ok(`${tag}: a bud clicked on the branch`);

    // ---- fork 2: press 2
    s = await untilDecision(page);
    const offer2 = s.decision.offer;
    await page.keyboard.press('2');
    s = await st(page);
    assert.equal(s.chosen.length, 2); assert.equal(s.chosen[1].bud, offer2[1]);
    ok(`${tag}: a bud picked with the 2 key`);

    // ---- the other forks: the panel buttons; the backwards clock never rewinds
    s = await untilDecision(page);
    await page.locator('.tb-bud').first().click();
    const before = (await st(page)).u;
    await skip(page, -3 * HOUR);
    assert.ok((await st(page)).u >= before, 'a clock set backwards never rewinds the tree');
    await skip(page, 3 * HOUR);
    for (;;) {
      s = await untilDecision(page, 30_000);
      if (s.decision.kind !== 'bud') break;
      await page.locator('.tb-bud').nth(0).click();
    }
    assert.equal(s.phase, 'fallen');
    assert.equal(s.chosen.length, 5);
    ok(`${tag}: the whole tutorial tree skipped through, five forks, a clock set backwards`);

    // ---- the fall: the recap, then keep three seeds, then plant one
    await page.locator('[data-testid="recap"]').waitFor();
    assert.ok(await page.locator('[data-testid="recap"] .tb-spr').count() >= 5);
    if (i === 0) await shot(page, 'recap');
    await page.getByRole('button', { name: 'Go on to the seeds' }).click();
    await page.locator('[data-testid="keep"]').waitFor();
    const seeds = page.locator('[data-testid="keep"] .tb-seed');
    assert.ok(await seeds.count() >= 4);
    for (let k = 0; k < 4; k++) await seeds.nth(k).click();
    assert.equal(await page.locator('[data-testid="keep"] .tb-seed.on').count(), 3, 'at most three seeds');
    if (i === 0) await shot(page, 'seed-pick');
    await page.locator('[data-testid="keep"] .tb-go').click();
    await page.locator('[data-testid="plant"]').waitFor();
    if (i === 0) await shot(page, 'plant');
    await page.locator('[data-testid="plant"] .tb-seed').nth(1).click();
    s = await st(page);
    assert.equal(s.n, 2); assert.equal(s.phase, 'growing'); assert.equal(s.save.journal.seeds.length, 2); assert.equal(s.save.tree.hours, 12);
    ok(`${tag}: the fall, the recap, three seeds kept, one planted, two in the journal`);

    // ---- the journal: J, Esc, the button, the close button
    await page.keyboard.press('j');
    await page.locator('[data-testid="journal"]').waitFor();
    assert.ok(await page.locator('.tb-animal:not(.unseen)').count() >= 1);
    if (i === 0) await shot(page, 'journal');
    await page.keyboard.press('Escape');
    assert.equal((await st(page)).overlay, null);
    await page.getByRole('button', { name: 'Enzo’s journal (J)' }).click();
    await page.locator('[data-testid="journal"]').waitFor();
    await page.getByRole('button', { name: 'Close the journal (Esc)' }).click();
    assert.equal((await st(page)).overlay, null);
    ok(`${tag}: the journal by key and button, closed by Esc and by its button`);

    // ---- settings: sound, grow speed, close, the way home
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('[data-testid="settings"]').waitFor();
    await page.getByRole('button', { name: /Sound: off/ }).click();
    assert.equal((await st(page)).save.sound, true);
    await page.getByRole('button', { name: /Sound: on/ }).click();
    assert.equal((await st(page)).save.sound, false);
    await page.getByRole('button', { name: /Grow speed: normal/ }).click();
    assert.equal((await st(page)).save.speed, 'slow');
    await page.getByRole('button', { name: /Grow speed: slow/ }).click();
    assert.equal((await st(page)).save.speed, 'normal');
    assert.equal(await page.locator('[data-testid="settings"] a.tb-home').getAttribute('href'), '/');
    await page.keyboard.press('Escape');
    assert.equal((await st(page)).overlay, null);
    // the save survives a reload, sound still off
    await page.reload(); await ready(page);
    s = await st(page);
    assert.equal(s.n, 2); assert.equal(s.save.sound, false); assert.equal(s.started, true);
    ok(`${tag}: settings for sound and grow speed, and the save kept across a reload`);

    // ---- a week away: the fallen tree waits for the seed pick
    await seed(page, { hoursAgo: 7 * 24, n: 3, treeSeed: 9 + i });
    s = await st(page);
    assert.equal(s.phase, 'fallen'); assert.equal(s.decision.kind, 'keep');
    await page.locator('[data-testid="recap"]').waitFor();
    ok(`${tag}: a week away resolves at once to a fallen tree and its recap`);

    // ---- the play view through the day and the weather
    if (i === 0) {
      for (const [name, hour] of [['dawn', 6.5], ['day', 12], ['dusk', 18.5], ['night', 23]]) {
        await seed(page, { hoursAgo: 8, hour, n: 4, treeSeed: 5 });
        await page.waitForFunction(() => window.__tembusu.state().scene?.hill);
        s = await st(page);
        assert.equal(s.scene.hill, s.weather ?? name);
        assert.equal(await page.locator('[data-testid="buds"]').count(), s.decision ? 1 : 0, 'the decision panel only when there is a decision');
        await shot(page, `play-${name}`);
      }
      for (const weather of ['storm', 'dry']) {
        // find a moment in some tree's life when this weather is passing, using the page's own engine
        const at = await page.evaluate((w) => {
          const G = window.__tembusu.engine;
          for (let sd = 1; sd < 200; sd++) {
            const tin = G.newTree(3, sd, 0, 480, 'normal', []);
            for (let t = 0; t < 14 * 3_600_000; t += 600_000) { const tr = G.derive(tin, t); if (tr.weather === w && tr.phase === 'growing' && tr.u > 0.4) return { sd, hours: t / 3_600_000 }; }
          }
          return null;
        }, weather);
        assert.ok(at, `no ${weather} found`);
        await seed(page, { hoursAgo: at.hours, hour: 13, n: 3, treeSeed: at.sd });
        s = await st(page);
        assert.equal(s.weather, weather); assert.equal(s.scene.hill, weather);
        await shot(page, `play-${weather}`);
      }
      ok(`${tag}: dawn, day, dusk, night, storm and dry spell drawn`);
      // watch mode: things move gently with the tab left open, and nothing ticks
      const a = await page.locator('canvas').screenshot(); await page.waitForTimeout(2500); const b2 = await page.locator('canvas').screenshot();
      assert.notDeepEqual(a, b2, 'the hill moves gently in watch mode');
      ok(`${tag}: watch mode moves`);
    }
    assert.ok(await noSideScroll(page));
    await page.context().close();
  }
  assert.deepEqual(errors, []);
  console.log(`tembusu e2e: ${pass} passed`);
} finally {
  await browser.close();
}
