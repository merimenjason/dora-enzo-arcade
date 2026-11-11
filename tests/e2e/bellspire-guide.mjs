// The Sunken Bellspire in a browser: finding each expansion. For each finished area (Hollow Bell, Last Tollkeeper,
// Mother of Grafts calm, the next door not used yet) the title's save card has a "Next:" line, Continue shows the
// unlock dialog once, "Show me on the map" opens the map with the door's gold star in the key, "Got it" closes it,
// and a reload never asks again. Run against a build: BASE_URL=http://localhost:3123 node tests/e2e/bellspire-guide.mjs
// (GUIDE_SHOTS=<folder> saves screenshots).
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ABILITY_ORDER, ALL_BOSSES, SALT_GUARDIANS, ORCHARD_GUARDIANS, GLACIER_GUARDIANS, ROOMS, freshSave, isOrchardRoom } from '../../.checks/bellspire-game.js';

const base = process.env.BASE_URL ?? 'http://localhost:3109';
const shots = process.env.GUIDE_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };

const before = (a) => ABILITY_ORDER.slice(0, ABILITY_ORDER.indexOf(a));
function saveAt(stage) {
  const s = freshSave();
  s.abilities = { foundry: before('ballast'), salt: before('bloom'), orchard: before('sunmirror') }[stage];
  const bosses = ALL_BOSSES.filter((b) => ![...SALT_GUARDIANS, ...ORCHARD_GUARDIANS, ...GLACIER_GUARDIANS].includes(b));
  if (stage !== 'foundry') bosses.push(...SALT_GUARDIANS);
  if (stage === 'orchard') bosses.push(...ORCHARD_GUARDIANS);
  s.flags.push('script:intro', 'script:firstDark', 'script:belfryCall', 'script:trials', 'script:foundryCall', 'keeper', 'epilogue', 'epilogue2', 'epilogue3',
    ...bosses.map((b) => `boss:${b}`));
  if (stage !== 'foundry') s.flags.push('salt:visited');
  if (stage === 'orchard') s.flags.push('orchard:visited');
  s.shrine = { foundry: 'fgate', salt: 'salt-toll-road', orchard: 'orchard-wicket' }[stage];
  // the rooms explored so far, so the map looks as it would in play
  for (const r of ROOMS) {
    if (r.glacier || (isOrchardRoom(r) && stage !== 'orchard') || (r.salt && stage === 'foundry')) continue;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) s.seen.push(`${r.gx + x},${r.gy + y}`);
  }
  for (const h of Object.values(s.heroes)) { h.level = 30; h.hp = 200; h.mp = 100; }
  return s;
}

const cases = [
  ['foundry', 'The Salt Road is open', 'supply door', 'The Salt Road is open: the old supply door at the Foundry Gate Candle'],
  ['salt', 'The Night Orchard is open', 'Salt Tollhouse', 'The Night Orchard is open: the orchard wicket in the Salt Tollhouse'],
  ['orchard', 'The Glacier Stair is open', 'Mother of Grafts', 'The Glacier Stair is open: the root lift in the Mother of Grafts’ chamber'],
];
for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  for (const [stage, title, where, next] of cases) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const save = saveAt(stage);
    await page.goto(`${base}/bellspire`);
    await page.evaluate((save) => {
      localStorage.setItem('bellspire-v1', JSON.stringify(save));
      localStorage.setItem('bellspire-v1-settings', JSON.stringify({ sound: false, music: false, shake: false }));
    }, save);
    await page.reload();
    await page.locator('main[data-ready="true"]').waitFor();
    const nextLine = page.locator('.bs-next');
    await nextLine.waitFor();
    ok((await nextLine.textContent()) === `Next: ${next}`, `${stage}: the title's "Next:" line: ${await nextLine.textContent()}`);
    const tag = `${viewport.width}-${stage}`;
    if (shots) await page.screenshot({ path: join(shots, `guide-title-${tag}.png`) });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await dialog.waitFor({ timeout: 5000 });
    ok((await dialog.textContent()).includes(where), `${stage}: the unlock dialog says where: ${await dialog.textContent()}`);
    ok(await page.evaluate(() => window.__bellspire().unlock !== null), `${stage}: the game is paused under the dialog`);
    if (shots) await page.screenshot({ path: join(shots, `guide-unlock-${tag}.png`) });
    if (stage === 'salt') {
      await dialog.getByRole('button', { name: 'Got it' }).click();
      await dialog.waitFor({ state: 'detached' });
      ok(await page.evaluate(() => window.__bellspire().menu === null), `${stage}: Got it returns to play`);
      await page.keyboard.press('Escape');
    } else {
      await dialog.getByRole('button', { name: 'Show me on the map' }).click();
      await dialog.waitFor({ state: 'detached' });
    }
    await page.waitForFunction(() => window.__bellspire().menu === 'map');
    const key = page.locator('.bs-legend li').filter({ hasText: 'not used yet' });
    ok((await key.count()) === 1 && (await key.textContent()).startsWith(title), `${stage}: the map key names the open door`);
    // the gold star on the door: sample the canvas at the door for the marker's colour
    const star = await page.evaluate(() => {
      const g = window.__bellspire().game, d = g.newDoors()[0], cv = document.querySelector('canvas.bs-map');
      const x = Math.round(8 + (d.x / 480) * 26), y = Math.round(8 + ((d.y - 8) / 272) * 16);
      const p = cv.getContext('2d').getImageData(x, y, 1, 1).data;
      return [p[0], p[1], p[2]];
    });
    ok(star[0] > 200 && star[1] > 180 && star[2] < 170, `${stage}: a gold star is drawn on the door: rgb(${star})`);
    if (shots) await page.screenshot({ path: join(shots, `guide-map-${tag}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__bellspire().menu === null);
    await page.waitForTimeout(600);
    ok(await page.evaluate(() => window.__bellspire().unlock === null), `${stage}: no second dialog`);
    // the save remembers it: back at the title and Continue again, no dialog
    await page.reload();
    await page.locator('main[data-ready="true"]').waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForTimeout(1200);
    ok((await page.getByRole('dialog', { name: title }).count()) === 0, `${stage}: not asked again after a reload`);
    ok(errors.length === 0, `${stage}: no page errors: ${errors.join(' | ')}`);
    await page.close();
  }
}
await browser.close();
console.log(`bellspire guide e2e: ${checks} checks passed`);
