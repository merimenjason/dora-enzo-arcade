import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const errors = [];
const game = (p, fn) => p.evaluate(`(${fn})(window.__barrage())`);
const idle = (p) => p.waitForSelector('[data-testid="board"][data-busy="0"]');
const active = (p) => game(p, 't => { const u = t.match.active; return { id: u.id, team: u.team, x: u.x, y: u.y, angle: u.angle, power: u.power, moved: u.moved, hp: u.hp, charge: u.charge, items: u.items }; }');
const state = (p) => game(p, 't => ({ state: t.match.state, turn: t.match.turn, winner: t.match.winner, hp: t.match.units.map((u) => (u.alive ? u.hp : 0)), ground: t.match.terrain.reduce((s, v) => s + v, 0) })');
/** Sets the sliders, picks the shot and fires, then skips the animation. */
async function shoot(p, angle, power, shot = 0) {
  await p.getByTestId('angle').fill(String(angle));
  await p.getByTestId('power').fill(String(power));
  await p.getByTestId(`shot-${shot + 1}`).click();
  await p.getByTestId('fire').click();
  await p.keyboard.press('Enter');
}
/** Takes the turn the computer would: walks if its plan says to, then fires its exact shot. */
async function planned(p) {
  let plan = await game(p, 't => t.plan()');
  if (plan.walk) {
    const key = plan.walk > 0 ? 'ArrowRight' : 'ArrowLeft', want = Math.abs(plan.walk);
    await p.keyboard.down(key);
    await p.waitForFunction((n) => window.__barrage().match.active.moved >= n, want, { timeout: 4000 }).catch(() => {});
    await p.keyboard.up(key);
    plan = await game(p, 't => t.plan()');
  }
  await shoot(p, plan.angle, plan.power, plan.shot);
}
/** Plays the match out with the computer's plan for every turn a person has, skipping animations. */
async function playOut(p) {
  for (let guard = 0; guard < 160; guard++) {
    await idle(p);
    const s = await state(p);
    if (s.state === 'over') return s;
    if ((await p.getByTestId('fire').isEnabled())) await planned(p); else await p.waitForTimeout(120);
  }
  throw new Error('the match did not end');
}
try {
  await mkdir('.checks/burrow-barrage', { recursive: true });

  // The arcade lists the cabinet.
  const menu = await browser.newPage();
  await menu.goto(base);
  assert.equal(await menu.locator('.arcade-card').count(), 23);
  assert.match(await menu.locator('a.arcade-card[href="/barrage"]').textContent(), /Burrow Barrage/);
  await menu.close();

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/barrage`);
  await page.evaluate(() => localStorage.removeItem('burrow-barrage-v1'));
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="ladder-1"]').disabled);
  assert.equal(await page.locator('.bb-rung').count(), 6);
  assert.ok(await page.getByTestId('ladder-2').isDisabled(), 'match 2 is locked until match 1 is won');
  assert.equal(await page.getByTestId('dora-catapult').getAttribute('aria-pressed'), 'true');

  // A ride choice is kept.
  await page.getByTestId('dora-digger').click();
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('[data-testid="ladder-1"]').disabled);
  assert.equal(await page.getByTestId('dora-digger').getAttribute('aria-pressed'), 'true', 'the ride is saved');
  await page.getByTestId('dora-catapult').click();
  await page.screenshot({ path: '.checks/burrow-barrage/home.png', fullPage: true });

  // Match 1: Dora goes first.
  await page.getByTestId('ladder-1').click();
  await idle(page);
  assert.equal(await page.getByTestId('board').getAttribute('data-state'), 'aim');
  let u = await active(page);
  assert.equal(u.id, 0);
  assert.equal(await page.locator('.bb-unit').count(), 4);
  assert.equal(await page.locator('[data-testid="order"] i').count(), 6);
  assert.match(await page.getByTestId('unit-0').textContent(), /Dora.*Hay Catapult · 125\/125/);
  assert.ok(await page.getByTestId('fire').isEnabled());
  assert.equal(await page.getByTestId('board').getAttribute('data-zoom'), '1', 'a wide screen shows the whole map');
  assert.equal(await page.getByTestId('zoom').count(), 0);

  // The sliders set the aim.
  await page.getByTestId('angle').fill('70');
  await page.getByTestId('power').fill('40');
  u = await active(page);
  assert.deepEqual([u.angle, u.power], [70, 40]);
  // So does dragging on the board: the direction is the angle and the distance is the power.
  const box = await page.getByTestId('board').boundingBox();
  const at = (cx, cy) => [box.x + (((cx + 0.5) * 2) / 800) * box.width, box.y + ((cy * 2) / 450) * box.height];
  await page.mouse.move(...at(u.x + 60, u.y - 7 - 60));
  await page.mouse.down();
  await page.mouse.move(...at(u.x + 80, u.y - 7 - 80));
  await page.mouse.up();
  u = await active(page);
  assert.ok(Math.abs(u.angle - 45) <= 2, `dragging up and right aims at 45° (got ${u.angle})`);
  assert.ok(u.power > 70 && u.power < 100, `and the distance sets the power (got ${u.power})`);

  // Walking: the keys, then the button, which also turns the chinchilla round.
  const x0 = u.x;
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__barrage().match.active.moved >= 5);
  await page.keyboard.up('ArrowRight');
  u = await active(page);
  assert.ok(u.x >= x0 + 5 && u.angle <= 90);
  const walked = u.moved;
  await page.getByTestId('walk-left').dispatchEvent('pointerdown');
  await page.getByTestId('walk-left').dispatchEvent('pointerup');
  u = await active(page);
  assert.ok(u.moved > walked && u.angle > 90, 'walking left turns the chinchilla to face left');
  await page.keyboard.press('ArrowUp');
  assert.equal((await active(page)).angle, u.angle - 1, 'up raises the barrel whichever way it faces');

  // The big shot is not charged yet, and an item changes what the button does.
  await page.getByTestId('shot-3').click();
  assert.match(await page.locator('.bb-note').textContent(), /needs 3 more turns/);
  await page.keyboard.press('w');
  assert.match(await page.getByTestId('fire').textContent(), /Eat/);
  assert.match(await page.getByTestId('info').textContent(), /Dandelion/);
  await page.keyboard.press('w');
  assert.match(await page.getByTestId('fire').textContent(), /Fire/);
  assert.match(await page.getByTestId('info').textContent(), /Hay Bale/);
  await page.screenshot({ path: '.checks/burrow-barrage/aiming.png' });

  // Fire the computer's own shot: it lands, the ground changes, and the rivals take their turn.
  const before = await state(page);
  const plan = await game(page, 't => t.plan()');
  await page.getByTestId('angle').fill(String(plan.angle));
  await page.getByTestId('power').fill(String(plan.power));
  await page.getByTestId('fire').click();
  await page.waitForSelector('[data-testid="board"][data-busy="1"]');
  await page.screenshot({ path: '.checks/burrow-barrage/flight.png' });
  await idle(page);
  let now = await state(page);
  assert.equal(now.turn, 2);
  assert.ok(now.ground < before.ground || now.hp[2] + now.hp[3] < before.hp[2] + before.hp[3], 'the shot dug or hurt');
  assert.equal((await active(page)).team, 1, 'a rival is up');
  assert.ok(await page.getByTestId('fire').isDisabled(), 'and the controls wait');
  await page.waitForFunction(() => window.__barrage().match.turn >= 3);
  await idle(page);
  assert.equal((await game(page, 't => t.match.units[0].lastPower')), plan.power, 'the last shot is remembered for the mark on the power bar');

  // Space charges the power from nothing; letting go fires.
  await page.waitForFunction(() => { const m = window.__barrage().match; return m.state === 'over' || m.active.team === 0; });
  await idle(page);
  if ((await state(page)).state === 'aim') {
    const who = (await active(page)).id, turn = (await state(page)).turn;
    await page.keyboard.down(' ');
    await page.waitForFunction((id) => window.__barrage().match.units[id].power >= 20, who);
    await page.keyboard.up(' ');
    await page.waitForFunction((t) => window.__barrage().match.turn > t || window.__barrage().match.state === 'over', turn);
    const fired = await game(page, `t => t.match.units[${who}].lastPower`);
    assert.ok(fired >= 20 && fired < 100, `the shot fired at the charged power (got ${fired})`);
  }

  // Play the match out. Sleepy rivals lose to exact aim; try again if the wind disagrees.
  await page.keyboard.press('f'); await page.keyboard.press('f');
  let end = await playOut(page);
  for (let tries = 0; end.winner !== 0 && tries < 3; tries++) { await page.getByTestId('retry').click(); end = await playOut(page); }
  assert.equal(end.winner, 0, 'Dora and Enzo win match 1');
  await page.waitForSelector('[data-testid="next-match"]');
  assert.match(await page.locator('.bb-overlay').textContent(), /Pip and Mora are out!/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('burrow-barrage-v1')));
  assert.ok(saved.stars[0] >= 1 && saved.stars[0] <= 3, 'the stars are saved');
  assert.deepEqual(saved.rides, ['catapult', 'spitter']);
  await page.screenshot({ path: '.checks/burrow-barrage/won.png' });
  await page.getByTestId('menu').click();
  assert.ok(await page.getByTestId('ladder-2').isEnabled(), 'match 2 opens');
  assert.equal(await page.locator('.bb-rung.done').count(), 1);

  // Pass and play: both pairs are played by people.
  await page.getByTestId('map-4').click();
  await page.getByTestId('pip-cannon').click();
  await page.getByTestId('start-duel').click();
  await idle(page);
  assert.equal(await game(page, 't => t.match.map'), 3);
  assert.equal(await game(page, 't => t.match.units[2].ride'), 'cannon');
  await shoot(page, 60, 50);
  await idle(page);
  u = await active(page);
  assert.equal(u.team, 1);
  assert.ok(await page.getByTestId('fire').isEnabled(), 'the second player takes the rivals’ turn');
  await page.keyboard.press('e');
  assert.match(await page.getByTestId('fire').textContent(), /Hop/);
  const from = u.x;
  await page.getByTestId('angle').fill('120');
  await page.getByTestId('power').fill('30');
  await page.getByTestId('fire').click();
  await page.keyboard.press('Enter');
  await idle(page);
  const hopped = await game(page, `t => t.match.units[${u.id}]`);
  assert.ok(hopped.x < from - 10 && !hopped.items.includes('hop'), 'Burrow Hop moved the chinchilla and is used up');
  await page.screenshot({ path: '.checks/burrow-barrage/duel.png' });
  await page.close();

  // A phone-sized screen: the board fits and the controls are there.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.goto(`${base}/barrage`);
  await phone.waitForFunction(() => !document.querySelector('[data-testid="ladder-1"]').disabled);
  await phone.getByTestId('ladder-1').click();
  await idle(phone);
  const small = await phone.getByTestId('board').boundingBox();
  assert.ok(small.width <= 390 && small.width >= 340, `the board fits a phone (got ${Math.round(small.width)})`);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'nothing spills sideways');
  assert.ok(await phone.getByTestId('fire').isVisible());
  // The camera closes in on whoever's turn it is, and dragging still aims where the finger points.
  await phone.waitForSelector('[data-testid="board"][data-zoom="2"]');
  await phone.waitForTimeout(600);
  const who = await active(phone), cam = await game(phone, 't => t.stage.toWorld(400, 225)');
  // Half the map's width is on screen, so near the left edge the view stops at 200.
  assert.ok(Math.abs(cam[0] - Math.max(200, (who.x + 0.5) * 2)) < 4, `the view is on the chinchilla whose turn it is (got ${cam[0]})`);
  const spot = (wx, wy) => [small.x + (((wx - cam[0]) * 2 + 400) / 800) * small.width, small.y + (((wy - cam[1]) * 2 + 225) / 450) * small.height];
  const cx = (who.x + 0.5) * 2, cy = (who.y - 7) * 2;
  await phone.mouse.move(...spot(cx + 40, cy - 40));
  await phone.mouse.down();
  await phone.mouse.move(...spot(cx + 70, cy - 70));
  await phone.mouse.up();
  const aimed = await active(phone);
  assert.ok(Math.abs(aimed.angle - 45) <= 2, `dragging aims through the camera (got ${aimed.angle})`);
  assert.ok(Math.abs(aimed.power - Math.round(Math.hypot(70, 70) / 2.6)) <= 2, `and sets the power by distance on the map (got ${aimed.power})`);
  // A long shot is followed in the air.
  await phone.getByTestId('power').fill('90');
  await phone.getByTestId('fire').click();
  await phone.waitForSelector('[data-testid="board"][data-busy="1"]');
  await phone.waitForTimeout(500);
  const chase = await game(phone, 't => t.stage.toWorld(400, 225)');
  assert.ok(chase[0] > cam[0] + 10, 'the camera follows the shot');
  await phone.screenshot({ path: '.checks/burrow-barrage/phone-flight.png' });
  await phone.keyboard.press('Enter');
  await idle(phone);
  // The whole map is one tap away.
  await phone.getByTestId('zoom').click();
  assert.equal(await phone.getByTestId('board').getAttribute('data-zoom'), '1');
  assert.match(await phone.getByTestId('zoom').textContent(), /Zoom in/);
  await phone.screenshot({ path: '.checks/burrow-barrage/phone.png' });
  await phone.close();

  assert.deepEqual(errors, []);
  console.log('PASS Burrow Barrage: menu, rides, aiming, walking, shots, items, a won match, pass and play, phone');
} finally {
  await browser.close();
}
