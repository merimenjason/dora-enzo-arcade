import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ABILITY_ORDER, ALL_BOSSES, freshSave } from '../../.checks/bellspire-game.js';

const browser = await chromium.launch();
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const save = freshSave();
save.shrine = 'fgate';
save.abilities = ABILITY_ORDER.filter((a) => a !== 'ballast' && a !== 'catch');
save.flags.push('unlock:salt', 'unlock:orchard', 'unlock:glacier', 'script:intro', 'script:firstDark', 'script:belfryCall', 'epilogue', 'epilogue2', 'epilogue3', ...ALL_BOSSES.map((id) => `boss:${id}`));

try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((s) => localStorage.setItem('bellspire-v1', JSON.stringify(s)), save);
    await page.goto(`${base}/bellspire`);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('main[data-ready="true"]').waitFor();
    const wait = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 14000 });
    const walk = async (x) => {
      const cur = await page.evaluate(() => window.__bellspire().game.body.x);
      const dir = cur < x ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(dir);
      try {
        // hop the salt-crystal spikes on the way, the way a player would
        for (let i = 0; i < 400; i++) {
          const st = await page.evaluate(([x, dir]) => {
            const g = window.__bellspire().game, b = g.body, d = dir === 'ArrowRight' ? 1 : -1;
            const at = (px) => g.room.rows[Math.floor((b.y - 1) / 16) - g.room.gy * 17]?.[Math.floor(px / 16) - g.room.gx * 30];
            return { done: d > 0 ? b.x >= x : b.x <= x, spike: b.ground && (at(b.x + d * 22) === '^' || at(b.x + d * 30) === '^') };
          }, [x, dir]);
          if (st.done) break;
          if (st.spike) { await page.keyboard.down('KeyZ'); await page.waitForTimeout(220); await page.keyboard.up('KeyZ'); }
          else await page.waitForTimeout(16);
        }
        await wait(([x, dir]) => dir === 'ArrowRight' ? window.__bellspire().game.body.x >= x : window.__bellspire().game.body.x <= x, [x, dir]);
      }
      finally { await page.keyboard.up(dir); }
    };
    await walk(26 * 16 + 7);
    await page.keyboard.press('ArrowUp');
    await wait(() => window.__bellspire().game.room.id === 'salt-gate');
    await walk(20 * 16 + 10);
    await wait(() => window.__bellspire().game.has('ballast'));
    await walk(960 + 10 * 16 + 12);
    await wait(() => window.__bellspire().game.has('catch'));
    const station = await page.evaluate(() => window.__bellspire().game.saltLift.plan.station);
    await walk(960 + station);
    await page.getByText(/Move the ballast one notch/).waitFor();
    await page.keyboard.press('ArrowUp');
    await wait(() => window.__bellspire().game.saltLift.phase === 'catch');
    await page.keyboard.press('ShiftLeft');
    await wait(() => window.__bellspire().game.lead === 'enzo');
    await page.keyboard.press('ArrowUp');
    await wait(() => window.__bellspire().game.saltLift.phase === 'boarding');
    await walk(960 + 376);
    await wait(() => window.__bellspire().game.saltPrompt()?.text === 'Ride to the upper landing');
    await page.keyboard.press('ArrowUp');
    await wait(() => window.__bellspire().game.saltLift.phase === 'arrived');
    await walk(960 + 488);
    await wait(() => window.__bellspire().game.flag('salt:crossed:salt-school'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(`Salt Road entry, two abilities and lift passed at ${viewport.width}×${viewport.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
