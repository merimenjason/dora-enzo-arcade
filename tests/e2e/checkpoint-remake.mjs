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
  await p.goto(url);
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
  await p.getByRole('button', { name: /Warm supper/ }).click();
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
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:1000px;height:500px';
    document.body.append(canvas);
    const s = new RemakeScene(canvas);
    const results = [];
    for (const species of ['chinchilla', 'viscacha', 'fox', 'owl', 'viper'])
      for (const approved of [true, false]) {
        s.arrive(species);
        for (let i = 0; i < 20; i++) s.render(i / 10, 1 / 10);
        s.judge(approved);
        for (let i = 0; i < 100; i++) {
          s.render(i / 10, 1 / 10);
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
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: arcade links, full correct shift, approve/deny departures, budget, timed next day, mobile layout, all five species × both WebGL exit routes.',
  );
  console.log('Screenshots:', dir);
} finally {
  await b.close();
}
