import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch(),
  base = process.env.E2E_BASE_URL || 'http://localhost:3000';
try {
  const p = await browser.newPage({
    viewport: { width: 1366, height: 900 },
    reducedMotion: 'no-preference',
  });
  await p.goto(base + '/saga');
  await p.getByTestId('start').click();
  await p.evaluate(()=>window.__saga().art.loadAll());
  await p.waitForSelector('[data-art-ready="true"]');
  const decorations = await p.evaluate(() => window.__saga().art.decorations());
  assert.equal(decorations.length, 18);
  assert.ok(
    decorations.every((s) => s.loaded && s.pixels > 100 && !s.edge),
    'spell and reward sprites stay inside their crops',
  );
  assert.ok(
    decorations.filter((s) => s.name.startsWith('rewards:')).every(
      (s) => s.pixels / (s.width * s.height) > 0.4,
    ),
    'reward icons fill their framing without oversized empty sheet cells',
  );
  await p.evaluate(() => {
    const s = window.__saga();
    s.game.squad = ['dora', 'enzo', null, null, null];
    s.refresh();
  });
  await p.getByTestId('fight').click();
  await p.waitForFunction(() => window.__saga().game.battle.phase === 'fight');
  await p.evaluate(() => {
    const s = window.__saga(),
      b = s.game.battle;
    for (const h of b.heroes) h.cd = 100;
    for (const f of b.foes) f.cd = 100;
    b.heroes[0].energy = 20;
    b.heroes[0].hp = b.heroes[0].max * 0.2;
    s.refresh();
  });
  await p.getByTestId('skill-0').click();
  await p.getByTestId('skill-feedback').waitFor();
  assert.match(
    await p.getByTestId('skill-feedback').innerText(),
    /needs 80 more energy/,
  );
  assert.equal(await p.getByTestId('skill-0').getAttribute('data-low'), 'true');
  assert.ok(
    await p
      .getByRole('meter', { name: 'Dora health' })
      .evaluate((m) => Math.abs(m.value / m.max - 0.2) < 0.001),
  );
  assert.equal(
    await p.evaluate(() => window.__saga().game.battle.heroes[0].energy),
    20,
  );
  await p.evaluate(() => {
    const s = window.__saga(),
      g = s.game;
    g.leave();
    g.stars.fill(3);
    for (const id of ['clover', 'flint'])
      g.heroes[id] = { level: 1, stars: 1, shards: 0, gear: [0, 0, 0, 0] };
    g.squad = ['dora', 'enzo', 'clover', null, 'flint'];
    g.start(9);
    const b = g.battle;
    b.wave = 2;
    b.enemies = [];
    b.phase = 'march';
    b.marchT = 0;
    b.update(0.05);
    for (const h of b.heroes) {
      h.cd = 100;
      h.energy = 100;
    }
    for (const f of b.foes) {
      f.cd = 100;
      f.d = f.boss ? 0.2 : 0.8;
    }
    const boss = b.foes.find((f) => f.boss);
    boss.wind = boss.special.wind;
    boss.specialT = 100;
    s.field.reset();
    s.refresh();
  });
  await p.getByTestId('pause').click();
  await p.waitForFunction(
    () =>
      document.querySelector('[data-testid="skill-0"]').dataset.counter ===
      'true',
  );
  assert.equal(
    await p.getByTestId('skill-1').getAttribute('data-counter'),
    'false',
  );
  await p.evaluate(() => {
    const s = window.__saga(),
      b = s.game.battle;
    for (const f of b.foes) f.d = f.boss ? 1 : 0.2;
    s.refresh();
  });
  await p.waitForFunction(
    () =>
      document.querySelector('[data-testid="skill-0"]').dataset.counter ===
      'false',
  );
  assert.equal(
    await p.getByTestId('skill-2').getAttribute('data-counter'),
    'true',
  );
  assert.equal(
    await p.getByTestId('skill-4').getAttribute('data-counter'),
    'true',
  );
  await p.evaluate(() => {
    const s = window.__saga(),
      b = s.game.battle;
    for (const f of b.foes) f.d = f.boss ? 0.2 : 0.8;
    s.refresh();
  });
  await p.waitForFunction(
    () =>
      document.querySelector('[data-testid="skill-0"]').dataset.counter ===
      'true',
  );
  await p.getByTestId('resume').click();
  await p.keyboard.press('1');
  await p.waitForFunction(
    () =>
      document.querySelector('[data-testid="skill-0"]').dataset.ready ===
      'false',
  );
  await p.waitForFunction(
    () => window.__saga().game.battle.foes.find((f) => f.boss).exposed > 0,
  );
  await p.waitForFunction(
    () =>
      window.__saga().field.inspect(window.__saga().game.battle)
        .signaturesCreated > 0,
  );
  assert.equal(await p.getByTestId('skill-feedback').count(), 0);
  await p.getByTestId('skill-1').click();
  await p.waitForFunction(
    () => window.__saga().game.battle.heroes[1].shield > 0,
  );
  assert.equal(
    await p
      .getByTestId('skill-1')
      .getByText('Shielded', { exact: true })
      .count(),
    1,
  );
  await p.evaluate(() => {
    const s = window.__saga();
    s.game.battle.heroes[0].stun = 5;
    s.game.battle.heroes[0].energy = 100;
    s.refresh();
  });
  await p.keyboard.press('1');
  await p.getByTestId('skill-feedback').waitFor();
  assert.match(await p.getByTestId('skill-feedback').innerText(), /stunned/);
  await p.getByTestId('retreat').click();
  await p.evaluate(() => {
    const s = window.__saga();
    s.game.campAt = Date.now() - 2 * 3600000;
    s.refresh();
  });
  const gold = await p.evaluate(() => window.__saga().game.gold),
    closed = await p.locator('.sg-camp canvas').evaluate((c) => c.toDataURL());
  await p.getByTestId('camp-claim').click();
  assert.equal(await p.getByTestId('camp').getAttribute('data-opened'), 'true');
  await p.waitForTimeout(100);
  assert.notEqual(
    await p.locator('.sg-camp canvas').evaluate((c) => c.toDataURL()),
    closed,
  );
  assert.ok(await p.evaluate((gold) => window.__saga().game.gold > gold, gold));
  assert.ok(await p.getByTestId('camp-claim').isDisabled());
  assert.ok(await p.locator('.sg-chapter-art').count());
  await p.close();
  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  await reduced.goto(base + '/saga');
  await reduced.getByTestId('start').click();
  await reduced.getByTestId('fight').click();
  await reduced.waitForFunction(
    () => window.__saga().game.battle.phase === 'fight',
  );
  await reduced.evaluate(() => {
    const s = window.__saga();
    s.game.battle.heroes[0].energy = 100;
    s.refresh();
  });
  await reduced.getByTestId('skill-0').click();
  await reduced.waitForFunction(
    () => window.__saga().game.battle.heroes[0].energy < 100,
  );
  assert.equal(
    await reduced.evaluate(
      () => window.__saga().field.inspect(window.__saga().game.battle).signatures,
    ),
    0,
  );
  await reduced.close();
  console.log(
    'PASS Saga combat feedback: live health, energy/stun guidance, eligible interrupts, distinct special-move effects, shield status, banked camp rewards and reduced motion.',
  );
} finally {
  await browser.close();
}
