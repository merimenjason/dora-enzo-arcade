// Public UI acceptance tests for document-only fallback. No engine/state injection.
// Visibility and time are controlled explicitly only in the timer test below.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const url = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    if (String(kind).includes('webgl')) return null;
    return original.call(this, kind, ...args);
  };
});
const chip = (name) =>
  page.locator('.rm-chips button').filter({ hasText: name });
const balance = async () =>
  Number(
    (await page.locator('.rm-status').textContent()).match(/(-?\d+) cr/)[1],
  );
const caseData = () =>
  page.evaluate(() => {
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
      seal: document.querySelector('.rm-seal')?.textContent,
      scale: parseInt(document.querySelector('.rm-scale b').textContent),
      rules: document.querySelector('.rm-rules').textContent,
    };
  });
function reasonFor(d) {
  const { card: c, permit: p, rules: r } = d;
  if (d.missing) return 'Missing permit';
  if (c['Full name'] !== p['Issued to']) return 'Identity mismatch';
  const regions = r.match(/Open regions today: ([^.]+)\./)[1].split(', ');
  if (
    c['Home region'] !== p['Issuing region'] ||
    !regions.includes(c['Home region'])
  )
    return 'Region discrepancy';
  if (
    parseInt(p['Valid through'].replace('DAY ', '')) <
    Number(r.match(/expire before day (\d+)/)[1])
  )
    return 'Expired permit';
  if (
    r.includes('within 15 grams') &&
    Math.abs(parseInt(p['Declared weight']) - d.scale) > 15
  )
    return 'Weight discrepancy';
  if (r.includes('must carry') && d.seal.includes('ABSENT'))
    return 'Missing seal';
  if (r.includes(`Barred today: ${c.Species}.`)) return 'Species restriction';
  if (
    r.includes('Transit permits are suspended') &&
    c['Purpose of entry'] === 'transit'
  )
    return 'Purpose restriction';
  return null;
}
async function open() {
  await page.getByRole('button', { name: /OPEN THE BOOTH/ }).click();
  await page.waitForSelector('.rm-documents');
}
async function decide(reason, expected = 'good') {
  if (reason) {
    await chip(reason).click();
    await page.locator('.rm-deny').click();
  } else await page.locator('.rm-approve').click();
  await page.waitForSelector(`.rm-verdict.${expected}`);
  assert(
    await page.locator('.rm-verdict button').isEnabled(),
    'fallback has no unavailable-animation deadlock',
  );
  assert.equal(
    await page.locator('.rm-chips button:disabled').count(),
    8,
    'findings lock after judgment',
  );
  assert.equal(
    await page.locator('.rm-field:not(:disabled)').count(),
    0,
    'document fields lock after judgment',
  );
}
try {
  await page.goto(url + '/checkpoint-remake');
  await page.waitForSelector('.rm-fallback');
  await page.waitForFunction(() =>
    document.querySelector('.rm-fallback').textContent.includes('unavailable'),
  );
  assert(
    (await page.locator('.rm-fallback').textContent()).includes(
      'still inspect',
    ),
  );
  await open();
  const initial = await caseData();
  assert.equal(initial.card['Full name'], 'ROCO');
  assert.equal(await balance(), 24);
  // Every clickable document field has a concrete corresponding selection assertion.
  const fields = [
    ['Full name', 'Identity mismatch'],
    ['Home region', 'Region discrepancy'],
    ['Species', 'Species restriction'],
    ['Purpose of entry', 'Purpose restriction'],
    ['Issued to', 'Identity mismatch'],
    ['Issuing region', 'Region discrepancy'],
    ['Valid through', 'Expired permit'],
    ['Declared weight', 'Weight discrepancy'],
  ];
  for (const [label, reason] of fields) {
    const field = page.locator('.rm-field').filter({
      has: page.locator('span', { hasText: new RegExp(`^${label}$`) }),
    });
    await field.click();
    assert.equal(
      await chip(reason).getAttribute('aria-pressed'),
      'true',
      label + ' selects matching reason',
    );
    assert((await field.getAttribute('class')).includes('selected'));
    assert(await page.locator('.rm-deny').isEnabled());
    await chip(reason).click();
    assert.equal(await chip(reason).getAttribute('aria-pressed'), 'false');
    assert(!(await field.getAttribute('class')).includes('selected'));
    assert(await page.locator('.rm-deny').isDisabled());
  }
  await page.locator('.rm-seal').click();
  assert.equal(await chip('Missing seal').getAttribute('aria-pressed'), 'true');
  await page.locator('.rm-seal').click();
  assert.equal(
    await chip('Missing seal').getAttribute('aria-pressed'),
    'false',
  );
  await chip('Missing permit').click();
  await chip('Expired permit').click();
  assert((await page.locator('.rm-deny').textContent()).includes('2 REASONS'));
  await chip('Missing permit').click();
  await chip('Expired permit').click();
  console.log(
    'PASS B1: WebGL fallback playable; all 8 document fields, seal and multi-reason toggles synchronize with denial controls.',
  );
  // Full real document UI week, deliberately in the no-WebGL fallback. No scene animation claims.
  let expectedCredits = 24,
    total = 0,
    missingButtons = 0;
  const reasons = new Set(),
    species = new Set();
  for (let day = 1; day <= 7; day++) {
    if (day > 1) await open();
    const quota = Math.min(4 + day, 10);
    assert.equal(
      (await page.locator('.rm-day b').textContent()).trim(),
      `0${day}`,
    );
    assert(
      (await page.locator('.rm-rules').textContent()).includes(
        `DAY ${1000 + day}`,
      ),
    );
    for (let i = 0; i < quota; i++) {
      const d = await caseData();
      species.add(d.card.Species);
      const reason = reasonFor(d);
      if (reason) reasons.add(reason);
      if (d.missing) {
        await page.getByRole('button', { name: 'Flag missing permit' }).click();
        assert.equal(
          await chip('Missing permit').getAttribute('aria-pressed'),
          'true',
        );
        await chip('Missing permit').click();
        missingButtons++;
      }
      await decide(reason);
      expectedCredits += 6;
      total++;
      assert.equal(await balance(), expectedCredits);
      assert(
        (await page.locator('.rm-verdict').textContent()).includes('+6 cr'),
      );
      assert(
        (await page.locator('.rm-status').textContent()).includes(
          `${i + 1} / ${quota} TRAVELERS`,
        ),
      );
      await page.locator('.rm-verdict button').click();
    }
    await page.waitForSelector('.rm-ledger');
    expectedCredits -= 14 + day * 3;
    assert.equal(await balance(), expectedCredits);
    const ledger = await page.locator('.rm-ledger b').allTextContents();
    assert.deepEqual(ledger, [
      String(quota),
      '0',
      `−${14 + day * 3} cr`,
      `${expectedCredits} cr`,
    ]);
    assert(
      await page.locator('.rm-panel > .rm-primary').isDisabled(),
      'must settle supper',
    );
    await page.locator('summary').click();
    assert.equal(await page.locator('details li').count(), total);
    assert(
      (await page.locator('details li').last().textContent()).includes(
        '+6 credits',
      ),
    );
    await page.getByRole('button', { name: /Shared hay/ }).click();
    expectedCredits -= 3;
    assert.equal(await balance(), expectedCredits);
    assert.equal(await page.locator('.rm-meals button:disabled').count(), 2);
    assert(
      (await page.locator('.rm-panel').textContent()).includes(
        'Supper paid: 3 cr. Tomorrow’s time bonus: 0s.',
      ),
    );
    await page.locator('.rm-panel > .rm-primary').click();
    console.log(
      `PASS B2 day ${day}: ${total} UI decisions, ${expectedCredits} cr after rent and hay.`,
    );
  }
  assert.equal(total, 55);
  assert.equal(expectedCredits, 151);
  assert.equal(reasons.size, 8);
  assert.equal(species.size, 5);
  assert(missingButtons > 0);
  assert.equal(
    await page.locator('.rm-panel h2').textContent(),
    'A little further north.',
  );
  assert(
    (await page.locator('.rm-panel').textContent()).includes(
      '55 decisions · 100% accuracy · 151 credits saved',
    ),
  );
  assert(
    (await page.locator('.rm-panel').textContent()).includes(
      'Seven mornings, seven nights.',
    ),
  );
  // Restart must restore actual UI, account, queue and timing, not only change the heading.
  await page.getByRole('button', { name: /WORK ANOTHER WEEK/ }).click();
  await page.waitForSelector('.rm-brief');
  assert.equal(await balance(), 24);
  assert.equal(await page.locator('.rm-day b').textContent(), '01');
  assert(!(await page.locator('input[type=checkbox]').isChecked()));
  await open();
  assert.deepEqual(await caseData(), initial);
  console.log(
    'PASS B3: successful ending text/stats and deterministic restart reset verified.',
  );
  // Unsupported reason on a truly invalid file is still cited, then close the booth through normal UI.
  await decide('Identity mismatch', 'bad');
  assert.equal(await balance(), 21);
  assert(
    (await page.locator('.rm-verdict').textContent()).includes('Citation.'),
  );
  assert(
    (await page.locator('.rm-verdict').textContent()).includes(
      'Region is closed today.',
    ),
  );
  await page.locator('.rm-verdict button').click();
  for (let i = 1; i < 5; i++) {
    const d = await caseData();
    const actual = reasonFor(d);
    await decide(actual ? null : 'Identity mismatch', 'bad');
    await page.locator('.rm-verdict button').click();
  }
  assert.equal(await balance(), -8);
  assert.equal(await page.locator('.rm-meals button:disabled').count(), 2);
  assert(
    (await page.locator('.rm-panel').textContent()).includes(
      'not enough left for supper',
    ),
  );
  await page.getByRole('button', { name: /READ THE EPILOGUE/ }).click();
  assert.equal(
    await page.locator('.rm-panel h2').textContent(),
    'The lights go out.',
  );
  assert(
    (await page.locator('.rm-panel').textContent()).includes(
      '5 decisions · 0% accuracy · -8 credits saved',
    ),
  );
  assert(
    (await page.locator('.rm-panel').textContent()).includes(
      'Dora closes the ledger. Enzo packs the stamps.',
    ),
  );
  await page.getByRole('button', { name: /WORK ANOTHER WEEK/ }).click();
  await page.waitForSelector('.rm-brief');
  assert.equal(await balance(), 24);
  console.log(
    'PASS B4: citation text/pay, unaffordable meals, bankruptcy ending and restart.',
  );
  // Controlled browser timer path: document.hidden is an explicit synthetic visibility fixture.
  await page.clock.install();
  await page.reload();
  await page.waitForFunction(() =>
    document.querySelector('.rm-fallback')?.textContent.includes('unavailable'),
  );
  await page.locator('input[type=checkbox]').check();
  await open();
  const seconds = async () =>
    Number(
      (await page.locator('.rm-status').textContent()).match(
        /(\d+)s REMAINING/,
      )[1],
    );
  await page.evaluate(() =>
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    }),
  );
  const before = await seconds();
  await page.clock.runFor(5000);
  assert.equal(
    await seconds(),
    before,
    'hidden interval callbacks do not charge time',
  );
  await page.evaluate(() =>
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    }),
  );
  await page.clock.runFor(2000);
  assert(
    (await seconds()) <= before - 1 && (await seconds()) >= before - 3,
    'visible clock resumes without charging hidden interval',
  );
  await page.clock.runFor(151000);
  await page.waitForSelector('.rm-ledger');
  assert.equal(await balance(), 7, 'zero-case timed shift still pays rent');
  assert.equal((await page.locator('.rm-ledger b').allTextContents())[0], '0');
  await page.getByRole('button', { name: /Shared hay/ }).click();
  await page.locator('.rm-panel > .rm-primary').click();
  await open();
  assert.equal(await seconds(), 150);
  await decide(reasonFor(await caseData()));
  await page.clock.runFor(151000);
  assert.equal(await seconds(), 0);
  assert.equal(
    await page.locator('.rm-verdict').count(),
    1,
    'expired clock preserves readable verdict',
  );
  await page.locator('.rm-verdict button').click();
  await page.waitForSelector('.rm-ledger');
  console.log(
    'PASS B5: synthetic hidden/visible timer branch, timeout with and without outstanding verdict.',
  );
  // B6: failed scene-module download is a distinct public fallback from WebGL failure.
  const download = await browser.newPage();
  await download.route('**/lib/checkpoint-remake-scene.ts*', (route) =>
    route.abort(),
  );
  await download.goto(url + '/checkpoint-remake');
  await download.waitForFunction(() =>
    document
      .querySelector('.rm-fallback')
      ?.textContent.includes('Document inspection is still playable.'),
  );
  await download.getByRole('button', { name: /OPEN THE BOOTH/ }).click();
  await download.locator('.rm-approve').click();
  await download.waitForSelector('.rm-verdict.bad');
  assert(await download.locator('.rm-verdict button').isEnabled());
  await download.locator('.rm-verdict button').click();
  assert.equal(await download.locator('.rm-documents').count(), 1);
  await download.close();
  console.log(
    'PASS B6: scene download failure retains playable inspection and next-case controls.',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS extended behavior: full 55-case fallback UI week, all 8 reasons/5 species, exact ledger, both endings, restarts, field controls and controlled timer paths.',
  );
} finally {
  await browser.close();
}
