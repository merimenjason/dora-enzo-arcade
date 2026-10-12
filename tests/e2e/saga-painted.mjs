import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { HEROES, BOSSES } from '../../.checks/saga-game.js';
const browser = await chromium.launch(),
  base = process.env.E2E_BASE_URL || 'http://localhost:3000';
await mkdir('.checks/saga-painted', { recursive: true });
try {
  const p = await browser.newPage({ viewport: { width: 1536, height: 1024 } }),
    errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '/saga');
  await p.getByTestId('start').click();
  await p.waitForSelector('[data-art-ready="true"]');
  const stats = await p.evaluate(() => window.__saga().art.inspect());
  assert.equal(stats.length, 50);
  assert.ok(
    stats.every((s) => s.loaded && s.pixels > 1000 && !s.edge),
    'all effective figures have complete alpha gutters',
  );
  await p.evaluate(
    (ids) => {
      const s = window.__saga(),
        g = s.game;
      g.stars.fill(3);
      for (const id of ids)
        g.heroes[id] = { level: 1, stars: 1, shards: 0, gear: [0, 0, 0, 0] };
      g.squad = ['dora', 'enzo', 'pip', 'bramble', 'flint'];
      s.refresh();
    },
    HEROES.map((h) => h.id),
  );
  await p.getByTestId('tab-squad').click();
  await p.screenshot({
    path: '.checks/saga-painted/roster.png',
    fullPage: true,
  });
  await p.getByTestId('tab-adventure').click();
  await p.getByTestId('fight').click();
  for (let chapter = 0; chapter < 8; chapter++) {
    await p.evaluate((chapter) => {
      const s = window.__saga(),
        g = s.game;
      g.leave();
      g.start(chapter * 10 + 9);
      const b = g.battle;
      b.wave = 2;
      b.enemies = [];
      b.phase = 'march';
      b.marchT = 0.001;
      b.update(0.05);
      for (const h of b.heroes) {
        h.energy = h.slot === 0 || h.slot === 4 ? 100 : 45;
        h.atk = 0;
        h.hp = h.max;
      }
      for (const f of b.foes) {
        f.d = f.boss ? 5 : 3;
        f.atk = 0;
      }
      const boss = b.foes.find((f) => f.boss);
      boss.wind = boss.special.wind * 0.6;
      g.update = () => [];
      s.field.reset();
      s.refresh();
    }, chapter);
    await p.waitForTimeout(250);
    await p
      .getByRole('progressbar', { name: BOSSES[chapter] + ' health' })
      .waitFor();
    assert.equal(
      await p.getByRole('progressbar', { name: 'Boss wind-up' }).count(),
      1,
    );
    await p.screenshot({ path: `.checks/saga-painted/chapter-${chapter}.png` });
    const hp = await p
      .getByRole('progressbar', { name: BOSSES[chapter] + ' health' })
      .getAttribute('value');
    await p.evaluate(() => {
      const s = window.__saga(),
        boss = s.game.battle.foes.find((f) => f.boss);
      boss.hp /= 2;
      s.refresh();
    });
    await p.waitForTimeout(40);
    assert.equal(
      Number(
        await p
          .getByRole('progressbar', { name: BOSSES[chapter] + ' health' })
          .getAttribute('value'),
      ),
      Number(hp) / 2,
    );
  }
  assert.deepEqual(errors, []);
  await p.close();
  const retry = await browser.newPage();
  let blocked = true;
  await retry.route('**/art/saga/heroes-0.png', (r) =>
    blocked ? r.abort() : r.continue(),
  );
  await retry.goto(base + '/saga');
  await retry.getByTestId('start').click();
  await retry.getByRole('button', { name: 'Retry artwork' }).waitFor();
  await retry.getByTestId('fight').click();
  await retry.getByTestId('field').waitFor();
  blocked = false;
  await retry.getByRole('button', { name: 'Retry artwork' }).click();
  await retry.waitForSelector('[data-art-ready="true"]');
  assert.equal(
    await retry.getByRole('button', { name: 'Retry artwork' }).count(),
    0,
  );
  await retry.close();
  console.log(
    'PASS painted Saga: 50 complete figures, all 18 portraits, 8 chapter/boss scenes, live boss health/wind-up and playable artwork retry.',
  );
} finally {
  await browser.close();
}
