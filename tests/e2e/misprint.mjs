// Misprint in a real browser: every player action through the real buttons and keys (walk, climb, switch by button,
// key and tap, all four plate shifts, a refused shift, undo, restart, hint), finishing a page and going on to the next,
// the zine shelf and contact sheet with their locks explained, settings, the mute button, the save surviving a reload,
// a corrupt save, the reward print, and phone landscape and portrait without sideways scrolling or page errors.
// Needs `npm run dev` running and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const LABEL = { L: 'Walk left', R: 'Walk right', U: 'Climb up', D: 'Climb down', sU: /plate up$/, sD: /plate down$/, sL: /plate left$/, sR: /plate right$/, Q: /^Switch to/ };

async function open(viewport, save) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${viewport.width}x${viewport.height}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${viewport.width}x${viewport.height} console: ${m.text()}`); });
  if (save !== undefined) await page.addInitScript((s) => { if (!sessionStorage.getItem('mp-seeded')) { localStorage.setItem('misprint-v1', s); sessionStorage.setItem('mp-seeded', '1'); } }, save);
  await page.goto(`${base}/misprint`);
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 });
  return { ctx, page };
}
const mp = (page) => page.evaluate(() => { const m = window.__misprint(); return { ...m, debug: undefined }; });
const idle = (page) => page.waitForFunction(() => !window.__misprint().busy, null, { timeout: 8000 });
async function press(page, a) { await page.getByRole('button', { name: LABEL[a] }).click(); await idle(page); }
const state = async (page) => (await mp(page)).page.state;
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
async function openPage(page, id) { await page.evaluate((i) => window.__misprint().debug.open(i), id); await page.waitForFunction((i) => window.__misprint().page?.id === i && window.__misprint().screen === 'play', id); await idle(page); }
async function solveWithButtons(page) {
  const acts = await page.evaluate(() => window.__misprint().debug.solve());
  ok(acts && acts.length > 0, 'the page has a solution from here');
  for (const a of acts) await press(page, a);
  await page.getByRole('dialog', { name: 'Page printed' }).waitFor();
}

try {
  // ------------------------------------------------------------ desktop: a first visit, start to finish
  {
    const { ctx, page } = await open({ width: 1280, height: 800 });
    ok(await page.getByRole('heading', { name: /Misprint/ }).isVisible(), 'the title shows the logo');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('heading', { name: 'How to print' }).waitFor();
    ok(true, 'the first Play shows how to play');
    await page.getByRole('button', { name: 'Let’s print' }).click();
    await page.getByRole('heading', { name: 'The zine shelf' }).waitFor();
    // locked zines say when they open
    const flyer = page.getByRole('button', { name: /Night Market Flyer, locked/ });
    ok(await flyer.isDisabled(), 'the second zine starts locked');
    ok(/Opens when Burrow Gazette has 7 pages done \(7 to go\)/.test(await flyer.innerText()), 'and says when it opens');
    await page.getByRole('button', { name: 'Burrow Gazette' }).click();
    await page.getByRole('heading', { name: 'Burrow Gazette' }).waitFor();
    eq(await page.locator('.mp-thumb').count(), 10, 'ten pages on the contact sheet');
    eq(await page.locator('.mp-thumb img').count(), 10, 'each with a real thumbnail');
    ok(await page.locator('.mp-thumb img').first().evaluate((i) => i.naturalWidth > 50), 'thumbnails are drawn');
    const locked = page.getByRole('button', { name: /Page 4: .*locked/ });
    ok(await locked.isDisabled() && /Finish 1 more page here to open/.test(await locked.innerText()), 'a locked page says what opens it');
    await page.getByRole('button', { name: /Page 1: First Proof/ }).click();
    await page.waitForFunction(() => window.__misprint().screen === 'play');
    ok(await page.locator('.mp-caption').isVisible() && (await page.locator('.mp-caption').innerText()).length > 10, 'the margin caption is showing');
    ok(await page.locator('.mp-pad').first().isVisible(), 'the pad is showing');

    // walk by button and by key
    const s0 = await state(page);
    await press(page, 'R');
    eq((await state(page)).pos[0][0], s0.pos[0][0] + 1, 'Walk right moves Dora a cell');
    await page.keyboard.press('ArrowLeft'); await idle(page);
    eq((await state(page)).pos[0], s0.pos[0], 'the left arrow walks her back');
    await page.keyboard.press('d'); await idle(page);
    eq((await state(page)).pos[0][0], s0.pos[0][0] + 1, 'D walks right too');
    // a refused shift: the plates on page 1 are pinned by their marks
    await press(page, 'sU');
    ok(/can’t leave the paper/.test((await mp(page)).message), 'a refused shift says why');
    eq((await state(page)).off, s0.off, 'and nothing moved');
    eq((await mp(page)).page.moves, 3, 'and it cost nothing');
    await page.keyboard.press('Shift+ArrowLeft'); await idle(page);
    ok((await mp(page)).message.length > 0, 'the shift keys reach the same refusal');
    // undo, restart, hint
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await idle(page);
    eq((await state(page)).pos[0], s0.pos[0], 'Undo takes the walk back');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await idle(page);
    eq((await state(page)).pos[0][0], s0.pos[0][0] + 1, 'and the one before');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await idle(page);
    eq([(await state(page)).pos[0], (await mp(page)).page.moves], [s0.pos[0], 0], 'all the way back');
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await idle(page);
    ok(/Nothing to undo/.test((await mp(page)).message), 'Undo with nothing to undo says so');
    await press(page, 'R'); await press(page, 'R');
    await page.getByRole('button', { name: 'Restart', exact: true }).click(); await idle(page);
    eq([(await state(page)).pos[0], (await mp(page)).page.moves], [s0.pos[0], 0], 'Restart goes back to the start');
    await page.keyboard.press('z'); await idle(page);
    eq((await mp(page)).page.moves, 2, 'and Z (undo) brings the moves back');
    await page.keyboard.press('r'); await idle(page);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    const hinted = (await mp(page)).hint;
    ok(hinted && /^Hint:/.test((await mp(page)).message), 'Hint names the next move');
    eq(await page.locator('.mp-hinted').count(), 1, 'and lights up its button');
    ok(await page.locator('.mp-hintcount').isVisible(), 'hints are counted in the bar');
    await press(page, hinted);
    eq(await page.locator('.mp-hinted').count(), 0, 'the light goes out after a move');
    // finish the page with the buttons
    await solveWithButtons(page);
    const done = await page.getByRole('dialog', { name: 'Page printed' }).innerText();
    ok(/Printed!/i.test(done) && /Finished/.test(done), 'the page-done stamp shows');
    eq((await mp(page)).save.pages.g1?.hints, 1, 'the finish is saved with its hint');
    await page.getByRole('button', { name: 'Next page' }).click();
    await page.waitForFunction(() => window.__misprint().page?.id === 'g2');
    ok(true, 'Next page opens page 2');

    // switching: button, Tab, Q, and a tap on the other chinchilla
    eq((await state(page)).active, 0, 'Dora starts');
    await press(page, 'Q');
    eq((await state(page)).active, 1, 'the switch button hands over to Enzo');
    ok(/Enzo · switch/.test(await page.locator('.mp-switch').innerText()), 'the switch button shows who is active');
    ok(/Shift teal plate/.test(await page.locator('.mp-cross-label').innerText()), 'and the shift cross names the teal plate');
    await page.keyboard.press('Tab'); await idle(page);
    eq((await state(page)).active, 0, 'Tab switches back');
    await page.keyboard.press('q'); await idle(page);
    eq((await state(page)).active, 1, 'Q switches too');
    const other = (await state(page)).pos[0];
    const c = await page.evaluate(([x, y]) => window.__misprint().debug.cell(x, y), other);
    const box = await page.locator('.mp-canvas').boundingBox();
    await page.mouse.click(box.x + c.x + c.size / 2, box.y + c.y + c.size / 2); await idle(page);
    eq((await state(page)).active, 0, 'a tap on the other chinchilla switches to them');
    eq((await mp(page)).page.moves, 0, 'switching is free');

    // all four shifts, on the page that teaches them
    await openPage(page, 'g3');
    for (const [a, d] of [['sU', [0, -1]], ['sD', [0, 1]], ['sL', [-1, 0]], ['sR', [1, 0]]]) {
      const before = await state(page);
      await press(page, a);
      const after = await state(page);
      eq(after.off[0], [before.off[0][0] + d[0], before.off[0][1] + d[1]], `${a} slides the pink plate`);
      eq(after.pos[0], [before.pos[0][0] + d[0], before.pos[0][1] + d[1]], `${a} carries Dora with it`);
      ok(await page.evaluate(() => window.__misprint().page.moves) > 0, 'shifts count as moves');
    }
    await page.keyboard.press('Shift+KeyW'); await idle(page);
    eq((await state(page)).off[0], [0, -1], 'Shift+W shifts up');

    // ladders: the Climb buttons appear only on ladder pages and climb
    eq(await page.getByRole('button', { name: 'Climb up' }).count(), 0, 'no Climb buttons without ladders');
    await openPage(page, 's5');
    const ladder = await page.evaluate(() => { const m = window.__misprint(); return m.debug.solve(); });
    const firstU = ladder.indexOf('U');
    for (const a of ladder.slice(0, firstU)) await press(page, a);
    const y0 = (await state(page)).pos[(await state(page)).active][1];
    await press(page, 'U');
    eq((await state(page)).pos[(await state(page)).active][1], y0 - 1, 'Climb up climbs the ladder');
    await press(page, 'D');
    eq((await state(page)).pos[(await state(page)).active][1], y0, 'Climb down climbs back');
    await page.keyboard.press('w'); await idle(page);
    eq((await state(page)).pos[(await state(page)).active][1], y0 - 1, 'W climbs too');

    // settings from the play bar, then back to the page
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
    const music = page.getByLabel('Music');
    const was = await music.isChecked();
    await music.click();
    eq((await mp(page)).save.settings.music, !was, 'the Music toggle saves');
    await page.getByLabel('Animation and wobble').click();
    eq((await mp(page)).save.settings.motion, false, 'motion can be turned off');
    await page.getByLabel('Animation and wobble').click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.waitForFunction(() => window.__misprint().screen === 'play');
    ok(true, 'Done goes back to the page');
    // the mute button
    const mute = page.locator('.mp-mute');
    await mute.click();
    eq([(await mp(page)).save.settings.sound, (await mp(page)).save.settings.music], [false, false], 'mute turns sound and music off');
    eq(await mute.getAttribute('aria-pressed'), 'true', 'and shows it');
    await mute.click();
    eq([(await mp(page)).save.settings.sound, (await mp(page)).save.settings.music], [true, true], 'and back on');

    // the save survives a reload
    await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
    ok((await mp(page)).save.pages.g1, 'page 1 is still done after a reload');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('heading', { name: 'The zine shelf' }).waitFor();
    ok(/1\/10 pages/.test(await page.getByRole('button', { name: 'Burrow Gazette' }).innerText()), 'the shelf counts it');
    // peek ahead opens everything
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel(/Peek ahead/).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    ok(await page.getByRole('button', { name: 'Summit Poster' }).isEnabled(), 'peek ahead opens the last zine');
    await page.getByRole('button', { name: 'Summit Poster' }).click();
    ok(await page.getByRole('button', { name: /Page 10: The Summit/ }).isEnabled(), 'and its last page');
    await page.getByRole('button', { name: '← Shelf' }).click();
    await page.getByRole('button', { name: '← Title' }).click();
    await page.getByRole('link', { name: '← Arcade' }).waitFor();
    ok(true, 'back to the title, with a way home to the arcade');
    // reset progress asks first
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Reset progress…' }).click();
    await page.getByRole('button', { name: 'Keep it' }).click();
    ok((await mp(page)).save.pages.g1, 'Keep it keeps the save');
    await page.getByRole('button', { name: 'Reset progress…' }).click();
    await page.getByRole('button', { name: 'Yes, erase every page' }).click();
    eq(Object.keys((await mp(page)).save.pages).length, 0, 'the reset erases');
    await ctx.close();
  }

  // ------------------------------------------------------------ a corrupt save starts fresh
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, '{"v":1,"pages":{"g1":{"best":"lots"}},"settings":7');
    eq((await mp(page)).save.pages, {}, 'a corrupt save starts fresh');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    ok(await page.getByRole('heading', { name: /How to print|The zine shelf/ }).isVisible(), 'and the game still plays');
    await ctx.close();
  }

  // ------------------------------------------------------------ the last page of a zine shows the reward print
  {
    const pages = {}; for (let i = 1; i <= 9; i++) pages[`g${i}`] = { best: 30, drop: false, hints: 0 };
    const { ctx, page } = await open({ width: 1280, height: 800 }, JSON.stringify({ v: 1, pages, settings: { sound: false, music: false, peek: false, motion: true }, seenIntro: true, ended: [] }));
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    ok(await page.getByRole('button', { name: 'Night Market Flyer' }).isEnabled(), 'seven pages done opened the next zine');
    await page.getByRole('button', { name: 'Burrow Gazette' }).click();
    await page.getByRole('button', { name: /Page 10: Front Page/ }).click();
    await page.waitForFunction(() => window.__misprint().page?.id === 'g10');
    await solveWithButtons(page);
    await page.getByRole('button', { name: 'See the reward print' }).click();
    await page.getByRole('heading', { name: /Burrow Gazette: complete!/ }).waitFor();
    await page.waitForFunction(() => { const i = document.querySelector('.mp-reward-art'); return i && i.complete && i.naturalWidth > 100; });
    ok(true, 'the reward print is painted');
    await page.getByRole('button', { name: 'Open Night Market Flyer' }).click();
    await page.getByRole('heading', { name: 'Night Market Flyer' }).waitFor();
    ok(true, 'and leads on to the next zine');
    await ctx.close();
  }

  // ------------------------------------------------------------ phones, sideways and upright
  for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const { ctx, page } = await open(vp);
    const tag = `${vp.width}x${vp.height}`;
    ok(await noSideways(page), `${tag}: no sideways scroll on the title`);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Let’s print' }).click();
    ok(await noSideways(page), `${tag}: shelf`);
    await page.getByRole('button', { name: 'Burrow Gazette' }).click();
    ok(await noSideways(page), `${tag}: contact sheet`);
    await page.getByRole('button', { name: /Page 2: Two Inks/ }).click();
    await page.waitForFunction(() => window.__misprint().screen === 'play'); await idle(page);
    ok(await noSideways(page), `${tag}: play`);
    // every control is on screen, big enough to tap, and not covered
    for (const b of await page.locator('.mp-play button:visible').all()) {
      const r = await b.boundingBox();
      const name = (await b.getAttribute('aria-label')) || (await b.innerText());
      ok(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1, `${tag}: ${name} is on screen`);
      ok(r.height >= 28 && r.width >= 28, `${tag}: ${name} is big enough to tap (${Math.round(r.width)}x${Math.round(r.height)})`);
      const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button'), [r.x + r.width / 2, r.y + r.height / 2]);
      ok(top, `${tag}: ${name} is not covered`);
    }
    const canvas = await page.locator('.mp-canvas').boundingBox();
    ok(canvas.width > vp.width * 0.4 && canvas.height > 120, `${tag}: the page is a good size (${Math.round(canvas.width)}x${Math.round(canvas.height)})`);
    const s0 = await state(page);
    await press(page, 'R');
    ok((await state(page)).pos[0][0] > s0.pos[0][0], `${tag}: walking works`);
    await press(page, 'Q');
    eq((await state(page)).active, 1, `${tag}: switching works`);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    ok(/^Hint:/.test((await mp(page)).message), `${tag}: hint works`);
    ok(await page.locator('.mp-msg').isVisible(), `${tag}: the message is on screen`);
    await solveWithButtons(page);
    const dlg = await page.getByRole('dialog', { name: 'Page printed' }).boundingBox();
    ok(dlg.y >= 0 && dlg.y + dlg.height <= vp.height + 1, `${tag}: the page-done card fits`);
    ok(await page.getByRole('button', { name: 'Next page' }).isVisible(), `${tag}: Next page is reachable`);
    ok(await noSideways(page), `${tag}: no sideways scroll when done`);
    await ctx.close();
  }

  eq(errors, [], 'no page errors');
  console.log(`PASS Misprint e2e: ${checks} checks`);
} finally {
  await browser.close();
}
