// Dust Disco in the browser: the arcade card, the song list, playing by keys and touch, pausing, results, saving and the phone layout.
// Needs `npm run dev` on port 3000 and Playwright. Headless audio here can stall frames, so timing checks are generous.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(60000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor();
/** A player inside the page that presses each note's key on time through real key events. */
const autoplay = (page) => page.evaluate(() => {
  const keys = ['d', 'f', 'j', 'k'], done = new Set(), up = [];
  const step = () => {
    const g = window.__disco(); if (!g) return;
    for (const n of g.chart.notes) {
      if (n.t > g.time + 0.015) break;
      if (done.has(n.id) || n.t < g.time - 0.08) continue;
      done.add(n.id); window.dispatchEvent(new KeyboardEvent('keydown', { key: keys[n.lane] })); up.push([n.t + (n.len || 0.05), n.lane]);
    }
    for (let i = up.length - 1; i >= 0; i--) if (up[i][0] <= g.time) { window.dispatchEvent(new KeyboardEvent('keyup', { key: keys[up[i][1]] })); up.splice(i, 1); }
    if (g.state === 'play') requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

{
  const page = await open();
  await page.goto(base); assert.equal(await page.locator('.arcade-card').count(), 55);
  await page.getByRole('link', { name: /Dust Disco/ }).click(); await page.waitForURL('**/disco'); await ready(page);
  console.log('PASS the arcade lists Dust Disco and its card opens the game');

  const songs = page.locator('.disco-song');
  assert.equal(await songs.count(), 12);
  assert.equal(await page.locator('.disco-song:disabled').count(), 11, 'only the first song is open');
  assert.match(await songs.first().textContent(), /Burrow Bop/);
  await page.getByRole('button', { name: /^Hard/ }).click();
  assert.equal(await page.getByRole('button', { name: /^Hard/ }).getAttribute('aria-pressed'), 'true');
  await page.locator('.disco-settings summary').click();
  await page.getByLabel(/Never fail/).check();
  await page.getByRole('button', { name: /^Easy/ }).click();
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('button', { name: /^Easy/ }).getAttribute('aria-pressed'), 'true', 'the difficulty is remembered');
  await page.locator('.disco-settings summary').click();
  assert.ok(await page.getByLabel(/Never fail/).isChecked(), 'settings are remembered');
  console.log('PASS the song list opens one song at a time, and difficulty and settings are saved');

  await page.getByRole('button', { name: /DANCE/ }).click();
  await page.waitForFunction(() => window.__disco()?.time > -2, null, { timeout: 60000 });
  await autoplay(page);
  await page.waitForFunction(() => window.__disco().time > 9, null, { timeout: 60000 });
  const mid = await page.evaluate(() => ({ ...window.__disco().counts, score: window.__disco().score }));
  assert.ok(mid.perfect + mid.great >= 6 && mid.score > 0, `on-time key presses score (${JSON.stringify(mid)})`);
  assert.equal(mid.stray, 0, 'on-time presses are never strays');
  console.log(`PASS playing by keys: ${mid.perfect} perfect, ${mid.great} great, ${mid.miss} missed in the first nine seconds`);

  await page.keyboard.press('p');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  const frozen = await page.evaluate(() => window.__disco().time); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.__disco().time), frozen, 'the song clock stops while paused');
  await page.getByRole('button', { name: 'Keep dancing' }).click();
  await page.waitForFunction((t) => window.__disco().time > t + 0.3, frozen);
  console.log('PASS pausing stops the song clock and resuming carries on');

  // skip to the end (never fail is on), then the results and the save
  await page.evaluate(() => { const g = window.__disco(); g.tick(g.chart.end + 0.1); });
  await page.getByRole('dialog', { name: 'Results' }).waitFor({ timeout: 15000 });
  assert.match(await page.locator('.disco-results').textContent(), /NEW SONG: HAY LOFT HOP/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dust-disco-v1')));
  assert.ok(saved.best['burrow:easy'].stars >= 1 && saved.noFail === true, 'the result is saved');
  await page.getByRole('button', { name: 'Song list' }).click();
  assert.equal(await page.locator('.disco-song:disabled').count(), 10, 'the second song is now open');
  console.log('PASS the results show, the save records the clear, and Hay Loft Hop opens');
  await page.close();
}

{
  const page = await open({ width: 390, height: 844 });
  await page.goto(base + '/disco'); await ready(page);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on a phone');
  await page.evaluate(() => window.__discoStart('burrow', 'easy'));
  await page.waitForFunction(() => window.__disco()?.time > -2, null, { timeout: 60000 });
  // tap the lane of the first note as it arrives
  const first = await page.evaluate(() => window.__disco().chart.notes[0]);
  await page.waitForFunction((t) => window.__disco().time > t - 0.03, first.t, { polling: 'raf' });
  const box = await page.locator('.disco-canvas').boundingBox(), lw = Math.min(390 - 24, 460) / 4, x0 = (390 - lw * 4) / 2;
  await page.mouse.click(x0 + lw * (first.lane + 0.5), box.height * 0.84);
  const judged = await page.evaluate(() => window.__disco().notes[0].judge);
  assert.ok(judged && judged !== 'miss', `a tap on the lane hits the note (${judged})`);
  console.log(`PASS the phone layout fits and tapping a lane plays (${judged})`);
  await page.close();
}

assert.deepEqual(errors, [], 'no page errors');
console.log('PASS no page errors');
await browser.close();
