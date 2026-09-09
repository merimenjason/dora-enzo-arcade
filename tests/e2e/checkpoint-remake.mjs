import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const url = process.env.BASE_URL || 'http://localhost:3000';
const dir = process.env.JCODE_SCRATCH_DIR || '.checks';
await mkdir(dir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
p.setDefaultTimeout(20000);
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
try {
  // V3: follow the actual original-edition link and play one baseline case.
  const original = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  original.setDefaultTimeout(20000);
  original.on('pageerror', e => errors.push(e.message));
  await original.goto(url + '/checkpoint-remake');
  await original.getByRole('link', { name: 'ORIGINAL EDITION ↗' }).click();
  await original.waitForSelector('.cp-briefing');
  await original.getByRole('button', { name: /OPEN THE BOOTH/ }).click();
  await original.waitForFunction(() => !document.querySelector('.cp-loading'));
  assert.equal(await original.locator('.cp-view canvas').count(), 1);
  await original.locator('.cp-approve').click();
  await original.waitForSelector('.cp-verdict');
  await original.locator('.cp-actions .cp-primary').click();
  assert(
    (await original.locator('.cp-progress').textContent()).includes('1 / 5 processed'),
  );
  console.log(
    'PASS V3: original-edition navigation, baseline WebGL booth, judgment and next case remain playable.',
  );
  await original.close();
  await p.goto(url);
  assert.equal(
    await p.locator('.arcade-card').count(),
    11,
    'arcade has eleven cabinets',
  );
  assert(
    (await p.locator('.arcade-hero').textContent()).includes(
      'Eleven ways to play.',
    ),
  );
  assert.equal(await p.locator('a[href="/checkpoint-remake"]').count(), 1);
  assert.equal(await p.locator('a[href="/checkpoint"]').count(), 1);
  await p.locator('a[href="/checkpoint-remake"]').click();
  await p.waitForSelector('.rm-brief');
  await p.waitForFunction(() => !document.querySelector('.rm-fallback'));
  await p.screenshot({ path: dir + '/remake-booth.png', fullPage: true });
  await p.getByRole('button', { name: /OPEN THE BOOTH/ }).click();
  await p.waitForSelector('.rm-documents');
  assert(await p.locator('.rm-deny').isDisabled());
  const verdicts = new Set();
  for (let i = 0; i < 5; i++) {
    await p.waitForFunction(
      () => !document.querySelector('.rm-approve')?.disabled,
    );
    const data = await p.evaluate(() => {
      const docs = [...document.querySelectorAll('.rm-paper')].map((d) =>
        Object.fromEntries(
          [...d.querySelectorAll('.rm-field')].map((r) => [
            r.querySelector('span').textContent,
            r.querySelector('strong').textContent,
          ]),
        ),
      );
      return {
        card: docs[0],
        permit: docs[1],
        missing: !!document.querySelector('.rm-absent'),
      };
    });
    let reason = data.missing
      ? 'Missing permit'
      : data.card['Full name'] !== data.permit['Issued to']
        ? 'Identity mismatch'
        : data.card['Home region'] !== data.permit['Issuing region']
          ? 'Region discrepancy'
          : parseInt(data.permit['Valid through']?.replace('DAY ', '')) < 1001
            ? 'Expired permit'
            : null;
    if (reason) {
      await p.locator('.rm-chips button').filter({ hasText: reason }).click();
      await p.locator('.rm-deny').click();
      verdicts.add('denied');
    } else {
      await p.locator('.rm-approve').click();
      verdicts.add('approved');
    }
    await p.waitForSelector('.rm-verdict.good');
    assert(
      await p.locator('.rm-verdict button').isDisabled(),
      'cannot skip departure',
    );
    if (i === 0) {
      await p.waitForTimeout(3200);
      await p
        .locator('.rm-world')
        .screenshot({ path: dir + '/remake-passage.png' });
      await p.screenshot({
        path: dir + '/remake-inspection.png',
        fullPage: true,
      });
    }
    await p.waitForFunction(
      () => !document.querySelector('.rm-verdict button')?.disabled,
    );
    await p.locator('.rm-verdict button').click();
  }
  assert.equal(verdicts.size, 2, 'real UI exercises approval and denial');
  console.log('UI: first shift complete, both verdicts passed');
  await p.waitForSelector('.rm-meals');
  const beforeSupper=Number((await p.locator('.rm-status').textContent()).match(/(-?\d+) cr/)[1]);
  await p.getByRole('button', { name: /Warm supper/ }).click();
  assert.equal(Number((await p.locator('.rm-status').textContent()).match(/(-?\d+) cr/)[1]),beforeSupper-7);
  assert.equal(await p.locator('.rm-meals button:disabled').count(),2);
  assert((await p.locator('.rm-panel').textContent()).includes('Supper paid: 7 cr. Tomorrow’s time bonus: 20s.'));
  await p.getByRole('button', { name: /NEXT MORNING/ }).click();
  await p.waitForSelector('.rm-brief');
  await p.locator('input[type=checkbox]').check();
  await p.getByRole('button', { name: /OPEN THE BOOTH/ }).click();
  await p.waitForFunction(() =>
    document.querySelector('.rm-status').textContent.includes('REMAINING'),
  );
  assert(
    (await p.locator('.rm-status').textContent()).includes('169') ||
      (await p.locator('.rm-status').textContent()).includes('170'),
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: dir + '/remake-mobile.png', fullPage: true });
  assert(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'mobile has no horizontal overflow',
  );
  // Real WebGL species/route regression, using production scene and deterministic render steps.
  await p.goto(url + '/checkpoint-remake');
  await p.waitForFunction(() => !document.querySelector('.rm-fallback'));
  console.log(
    'UI: budget, timed second day, mobile passed. Checking WebGL routes.',
  );
  const speciesResults = await p.evaluate(async () => {
    const { RemakeScene } = await import('/lib/checkpoint-remake-scene.ts');
    const { Box3, Vector3 } =
      await import('/node_modules/three/build/three.module.js');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:1000px;height:500px';
    document.body.append(canvas);
    const s = new RemakeScene(canvas);
    const results = [];
    const counter = new Box3(
      new Vector3(-3, 0, 1.025),
      new Vector3(3, 1.14, 1.875),
    );
    const scale = new Box3(
      new Vector3(-2.95, 0, -0.7),
      new Vector3(-1.65, 0.88, 0.4),
    );
    const post = new Box3(
      new Vector3(4.39, 0, -0.56),
      new Vector3(4.61, 1.5, -0.34),
    );
    // V1: anatomy/staging assertions, sampled across idle animation phases.
    for (let phase = 0; phase < 8; phase++) {
      s.render(phase * 0.8, 0.1);
      s.scene.updateMatrixWorld(true);
      const a = new Box3().setFromObject(s.dora.root),
        b = new Box3().setFromObject(s.enzo.root);
      if (a.intersectsBox(b)) throw Error('Inspectors overlap');
      for (const ch of [s.dora, s.enzo]) {
        const bounds = new Box3().setFromObject(ch.root);
        if (bounds.max.y >= 3.13 || bounds.max.z >= 4.81)
          throw Error('Inspector intersects roof/back wall');
        const forward = new Vector3(1, 0, 0).transformDirection(
          ch.root.matrixWorld,
        );
        if (forward.z > -0.99) throw Error('Inspector not facing traveler');
        ch.root.traverse((o) => {
          if (o.isMesh && new Box3().setFromObject(o).intersectsBox(counter))
            throw Error('Inspector mesh intersects counter');
        });
      }
    }
    if (s.dora.root.parent.position.z !== s.enzo.root.parent.position.z)
      throw Error('Inspectors not side by side');
    if (!s.dora.root.userData.white || s.enzo.root.userData.white)
      throw Error('Dora/Enzo colors swapped');
    for (const species of ['chinchilla', 'viscacha', 'fox', 'owl', 'viper'])
      for (const approved of [true, false]) {
        s.arrive(species);
        for (let i = 0; i < 20; i++) s.render(i / 10, 1 / 10);
        s.judge(approved);
        for (let i = 0; i < 100; i++) {
          s.render(i / 10, 1 / 10);
          s.scene.updateMatrixWorld(true);
          const bounds = new Box3().setFromObject(s.visitor);
          for (const obstacle of [
            counter,
            scale,
            post,
            new Box3().setFromObject(s.gate),
          ]) {
            if (bounds.intersectsBox(obstacle))
              throw Error(`${species} intersects booth equipment or barrier`);
          }
          if (
            s.visitor.position.x > 0.4 &&
            (bounds.min.z < -2.5 || bounds.max.z > -0.55)
          )
            throw Error('Traveler extends outside exit lane');
          if (
            s.visitor.position.x > 4.2 &&
            s.visitor.position.x < 4.8 &&
            s.gate.rotation.x < 1.4
          )
            throw Error('Gate not clear');
        }
        results.push({
          species,
          approved,
          complete: s.complete,
          x: s.visitor.position.x,
          z: s.visitor.position.z,
        });
      }
    s.dispose();
    canvas.remove();
    return results;
  });
  assert.equal(speciesResults.length, 10);
  assert(speciesResults.every((r) => r.complete));
  assert(
    speciesResults.every((r) =>
      r.approved ? r.x === 8 && r.z === -1.5 : r.x === 0 && r.z === -6,
    ),
  );
  console.log(
    'PASS V1: inspector separation/facing/colors/counter/roof/back-wall bounds at 8 phases. PASS V2: all species stay clear of counter/scale/post/gate and finish at correct exits.',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: arcade links, full correct shift, approve/deny departures, budget, timed next day, mobile layout, all five species × both WebGL exit routes.',
  );
  console.log('Screenshots:', dir);
} finally {
  await b.close();
}
