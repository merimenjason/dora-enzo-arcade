import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const key = 'paw-buster-x-v1';
const browser = await chromium.launch();
const errors = [];
const open = async (options) => {
  const page = await browser.newPage(options);
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/paw-buster`);
  await page.getByTestId('stage-snowcap').waitFor();
  return page;
};
const board = (p) => p.getByTestId('board');
const attr = async (p, name) => board(p).getAttribute(`data-${name}`);
const waitState = (p, state) => p.waitForSelector(`[data-testid="board"][data-state="${state}"]`);
try {
  await mkdir('.checks/paw-buster', { recursive: true });

  // The arcade lists the new cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 18);
  assert.match(await menu.locator('a.arcade-card[href="/paw-buster"]').textContent(), /Paw Buster X/);
  await menu.close();

  const page = await open({ viewport: { width: 1280, height: 720 } });
  assert.equal(await page.locator('.pb-stage').count(), 7);
  // Stage buttons enable once the page is interactive; only the citadel stays locked.
  await page.waitForFunction(() => !document.querySelector('[data-testid="stage-snowcap"]').disabled);
  assert.ok(await page.getByTestId('stage-citadel').isDisabled(), 'citadel starts locked');
  assert.match(await page.getByTestId('summary').textContent(), /Heart tanks 0\/6 · Sub-tanks 0\/4 · Armour 0\/5 · Max health 16 · Weapons: Paw Buster$/);
  await page.screenshot({ path: '.checks/paw-buster/select.png' });

  await page.getByTestId('stage-snowcap').click();
  await waitState(page, 'play');
  assert.match(await page.getByTestId('status').textContent(), /Snowcap Ridge · Dora in play · Dora 16\/16 · Enzo 16\/16 · Paw Buster/);
  // The canvas is painted, not blank.
  const colours = await page.evaluate(() => {
    const c = document.querySelector('.pb-canvas-wrap canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  });
  assert.ok(colours > 20, `canvas shows ${colours} colours`);

  const x0 = Number(await attr(page, 'x'));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  assert.ok(Number(await attr(page, 'x')) > x0 + 60, 'ArrowRight moves Dora');
  await page.keyboard.press('Space');
  await page.keyboard.press('KeyT');
  await page.keyboard.press('KeyY');
  await page.keyboard.press('KeyU');
  await page.waitForTimeout(200);
  assert.equal(await attr(page, 'hero'), 'enzo', 'U tags Enzo in');
  await page.screenshot({ path: '.checks/paw-buster/stage.png' });

  await page.keyboard.press('KeyP');
  await waitState(page, 'paused');
  assert.equal(await page.getByRole('heading', { name: 'Take a breather.' }).count(), 1);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await waitState(page, 'play');
  await page.getByRole('button', { name: 'Stage select' }).first().click();
  await page.getByTestId('stage-snowcap').waitFor();

  // Six cleared mavericks open the citadel and fill the arsenal.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 1, cleared: ['snowcap', 'cloud', 'caldera', 'mines', 'salt', 'lake'], tanks: ['snowcap', 'cloud'], best: { snowcap: 83.4 } })), key);
  await page.reload();
  await page.getByTestId('stage-snowcap').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="stage-citadel"]').disabled);
  assert.match(await page.getByTestId('summary').textContent(), /Heart tanks 2\/6 · Sub-tanks 0\/4 · Armour 0\/5 · Max health 20 · Weapons: Paw Buster, Frost Shard, Gale Feather, Ember Coil, Quartz Orbit, Volt Spark, Bubble Burst/);
  assert.match(await page.getByTestId('stage-snowcap').textContent(), /Cleared · best 1:23\.4 · ♥ tank · Frost Shard/);
  await page.screenshot({ path: '.checks/paw-buster/select-all.png' });
  await page.getByTestId('stage-citadel').click();
  await waitState(page, 'play');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  assert.equal(await attr(page, 'weapon'), 'frost', 'E selects the next weapon');
  assert.match(await page.getByTestId('status').textContent(), /Cougar Citadel · Sector 1 · Dora in play · Dora 20\/20/);
  await page.getByRole('button', { name: 'Stage select' }).first().click();
  // Each new stage starts and draws its maverick's room.
  for (const [id, name] of [['mines', 'Crystal Mines'], ['salt', 'Salt Flats'], ['lake', 'Titicaca Falls']]) {
    await page.getByTestId(`stage-${id}`).click();
    await waitState(page, 'play');
    assert.match(await page.getByTestId('status').textContent(), new RegExp(`^${name} · Dora in play`));
    await page.screenshot({ path: `.checks/paw-buster/${id}.png` });
    await page.getByRole('button', { name: 'Stage select' }).first().click();
    await page.getByTestId(`stage-${id}`).waitFor();
  }
  // Remap fire to F, then play two-player co-op: player 2 moves Enzo with the arrow keys.
  await page.getByText('Customise keys').click();
  await page.getByTestId('bind-fire').click();
  await page.keyboard.press('KeyF');
  assert.equal(await page.getByTestId('keys-fire').textContent(), 'F');
  await page.getByTestId('opt-coop').check();
  await page.reload();
  await page.getByTestId('stage-snowcap').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="stage-snowcap"]').disabled);
  assert.ok(await page.getByTestId('opt-coop').isChecked(), 'options are saved');
  await page.getByText('Customise keys').click();
  assert.equal(await page.getByTestId('keys-fire').textContent(), 'F', 'key bindings are saved');
  await page.getByTestId('stage-snowcap').click();
  await waitState(page, 'play');
  assert.match(await page.getByTestId('status').textContent(), /^Snowcap Ridge · Co-op · Dora 20\/20 · Enzo 20\/20/);
  const cx = Number(await attr(page, 'x'));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  assert.equal(await attr(page, 'hero'), 'enzo', 'Enzo runs ahead and leads');
  assert.ok(Number(await attr(page, 'x')) > cx + 60, 'player 2 moves Enzo');
  await page.screenshot({ path: '.checks/paw-buster/coop.png' });
  await page.keyboard.press('KeyP');
  await waitState(page, 'paused');
  await page.screenshot({ path: '.checks/paw-buster/pause.png' });
  await page.getByRole('button', { name: 'Stage select' }).first().click();
  await page.getByTestId('opt-coop').uncheck();

  // Hard mode waits for the citadel; save slots and save codes are on the saves panel.
  assert.ok(await page.getByTestId('opt-hard').isDisabled(), 'hard mode is locked until the citadel falls');
  await page.getByText('Saves and records').click();
  const saveCode = await page.getByTestId('save-code').inputValue();
  assert.match(saveCode, /^PBX3-/);
  assert.match(await page.getByTestId('stats').textContent(), /Slot 1 · 6\/7 stages cleared/);
  await page.getByTestId('slot-2').click();
  assert.match(await page.getByTestId('summary').textContent(), /Heart tanks 0\/6/, 'slot 2 starts empty');
  await page.getByTestId('load-code').fill(saveCode);
  await page.getByRole('button', { name: 'Load' }).click();
  assert.match(await page.getByTestId('summary').textContent(), /Heart tanks 2\/6/, 'the save code loads into slot 2');
  await page.getByTestId('slot-1').click();

  // The boss gallery refights one boss on its own.
  await page.getByText('Boss gallery').click();
  await page.getByTestId('gallery-snowcap').click();
  await waitState(page, 'boss');
  assert.match(await page.getByTestId('status').textContent(), /Snowcap Ridge · Boss gallery/);
  await page.screenshot({ path: '.checks/paw-buster/gallery.png' });
  await page.getByRole('button', { name: 'Stage select' }).first().click();

  // A recorded ghost replays alongside the run.
  await page.evaluate(() => localStorage.setItem('paw-buster-x-ghosts', JSON.stringify({ snowcap: { time: 99, difficulty: 'normal', progress: {}, run: '2.zz' } })));
  await page.reload();
  await page.getByTestId('stage-snowcap').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="stage-snowcap"]').disabled);
  assert.match(await page.getByTestId('stage-snowcap').textContent(), /👻 ghost/);
  await page.getByTestId('stage-snowcap').click();
  await waitState(page, 'play');
  const ghost0 = Number(await attr(page, 'ghost'));
  await page.waitForTimeout(900);
  assert.ok(Number(await attr(page, 'ghost')) > ghost0 + 60, 'the ghost runs its recorded route');
  await page.getByRole('button', { name: 'Stage select' }).first().click();

  // A gamepad drives the hero and Start pauses.
  const pad = await browser.newPage();
  await pad.addInitScript(() => {
    window.__pad = { id: 'test', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0], buttons: [...Array(17)].map(() => ({ pressed: false, touched: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
  });
  await pad.goto(`${base}/paw-buster`);
  await pad.getByTestId('stage-snowcap').waitFor();
  await pad.waitForFunction(() => !document.querySelector('[data-testid="stage-snowcap"]').disabled);
  await pad.getByTestId('stage-snowcap').click();
  await waitState(pad, 'play');
  const gx = Number(await attr(pad, 'x'));
  await pad.evaluate(() => { window.__pad.buttons[15].pressed = true; });
  await pad.waitForTimeout(700);
  await pad.evaluate(() => { window.__pad.buttons[15].pressed = false; });
  await pad.waitForTimeout(200);
  assert.ok(Number(await attr(pad, 'x')) > gx + 60, 'the d-pad moves Dora');
  await pad.evaluate(() => { window.__pad.buttons[9].pressed = true; });
  await waitState(pad, 'paused');
  await pad.close();
  await page.close();

  // Phones get the touch pad and no sideways scrolling.
  const phone = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow on the stage select');
  await phone.getByTestId('stage-snowcap').click();
  await waitState(phone, 'play');
  assert.ok(await phone.locator('.pb-pad').isVisible());
  const px = Number(await attr(phone, 'x'));
  const right = phone.getByRole('button', { name: 'Move right' });
  await right.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await phone.waitForTimeout(600);
  await right.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
  await phone.waitForTimeout(200);
  assert.ok(Number(await attr(phone, 'x')) > px + 40, 'the touch pad moves Dora');
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow in play');
  await phone.screenshot({ path: '.checks/paw-buster/phone.png', fullPage: true });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('Paw Buster X: arcade card, stage select, six mavericks, lock, play, movement, tag, pause, saved progress, citadel, weapon switch, key remap, co-op, saved options, hard-mode lock, save slots and save codes, boss gallery, ghost replay, gamepad, touch pad, phone layout.');
} finally {
  await browser.close();
}
