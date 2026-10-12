import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch(),
  base = process.env.E2E_BASE_URL || 'http://localhost:3000';
try {
  const p = await browser.newPage();
  let held = true;
  const release = [];
  await p.route('**/art/saga/**', async (r) => {
    if (held) await new Promise((resolve) => release.push(resolve));
    await r.continue();
  });
  await p.goto(base + '/saga', { waitUntil: 'domcontentloaded' });
  await p.getByTestId('start').waitFor({ timeout: 5000 });
  assert.equal(
    await p.getByRole('button', { name: 'Retry artwork' }).count(),
    0,
    'pending artwork is not a failure',
  );
  await p.getByTestId('start').click();
  await p.getByTestId('fight').click();
  await p.waitForFunction(() => window.__saga().game.battle.phase === 'fight');
  assert.equal(await p.getByTestId('field').count(), 1);
  const requested = await p.evaluate(
    () => window.__saga().art.status().requested,
  );
  assert.ok(
    !requested.some((k) => k === 'land-7' || k === 'boss-7'),
    'later chapters are not downloaded to begin stage one',
  );
  held = false;
  for (const finish of release) finish();
  await p.waitForSelector('[data-art-ready="true"]');
  assert.equal(
    await p.getByRole('button', { name: 'Retry artwork' }).count(),
    0,
  );
  await p.close();
  console.log(
    'PASS Saga progressive loading: play starts with all art held, pending art is not an error, later chapters stay lazy, and the scene updates when images arrive.',
  );
} finally {
  await browser.close();
}
