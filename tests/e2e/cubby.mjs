// Cubby Valley in the browser: the menu and its three slots, a Story valley played with the real keyboard and mouse
// (walking, jumping, drag-look, holding to dig, right-click to place, the hotbar keys and wheel, the bag), the Burrow
// Workbench woven by clicks, Hazel's errand handed in, a burrow built and checked and a neighbour moving in, a night
// with every monster facing the chinchilla it chases and a real bonk-stick fight with drops, a knock-out waking by the
// bed, Cosy nights with no monsters, the save across a reload, a corrupt save, the summer fair ending, the framing at
// 1280×800 and 1920×1080 (Dora and Enzo a clear size with nothing covering them) and phones held either way, played
// by touch. Needs `npm run dev` on port 3000 and Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const shots = process.env.SHOTS ?? '';
const KEY = 'cubby-valley-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push('console: ' + m.text()); });
  page.setDefaultTimeout(60000);
  await page.goto(base + '/cubby');
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
  return page;
};
const st = (page) => page.evaluate(() => window.__cubby());
const g = async (page) => (await st(page)).game;
const doIt = (page, cmd, arg = {}) => page.evaluate(([c, a]) => window.__cubbyDo(c, a), [cmd, arg]);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const until = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const rect = (page, sel) => page.locator(sel).first().boundingBox();
const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const bx = (r) => r && { x: r.x, y: r.y, w: r.width, h: r.height };
/** Starts a new valley in the first empty slot from the menu. */
async function newValley(page, mode = 'story') {
  await page.getByRole('button', { name: 'New valley' }).first().click();
  await page.locator(`[data-mode="${mode}"]`).click();
  await until(page, () => window.__cubby().screen === 'play' && window.__cubby().game?.built >= 1, null, 120000);
  await page.waitForTimeout(600);
}
/** Puts the chinchilla somewhere flat in the meadow, looking along +x, day time, nothing about. */
async function meadow(page) {
  const s = (await g(page)).start;
  await doIt(page, 'clear'); await doIt(page, 'time', { phase: 0.2 });
  await doIt(page, 'teleport', { x: s.x + 0.5, y: s.y, z: s.z + 0.5, yaw: Math.PI, pitch: -0.1 });
  await page.waitForTimeout(300);
  return s;
}
/** Builds a 5×5 room with planks around the player's feet (for the burrow check), with a door, lantern, bed and item. */
async function room(page, x0, y0, z0, item) {
  for (let x = x0; x <= x0 + 4; x++) for (let z = z0; z <= z0 + 4; z++) for (let y = y0; y <= y0 + 2; y++) {
    const shell = x === x0 || x === x0 + 4 || z === z0 || z === z0 + 4 || y === y0 + 2 || y === y0 - 1;
    await doIt(page, 'set', { x, y, z, b: shell ? 'planks' : 'air' });
  }
  for (let x = x0; x <= x0 + 4; x++) for (let z = z0; z <= z0 + 4; z++) await doIt(page, 'set', { x, y: y0 - 1, z, b: 'planks' });
  await doIt(page, 'set', { x: x0 + 2, y: y0, z: z0, b: 'door' });
  await doIt(page, 'set', { x: x0 + 1, y: y0, z: z0 + 3, b: 'bed' });
  await doIt(page, 'set', { x: x0 + 3, y: y0, z: z0 + 3, b: 'lantern' });
  await doIt(page, 'set', { x: x0 + 3, y: y0 + 1, z: z0 + 1, b: 'lantern' });
  if (item) await doIt(page, 'set', { x: x0 + 1, y: y0, z: z0 + 1, b: item });
}

// ---------------------------------------------------------------- desktop
{
  const page = await open();
  // the menu: three slots, the arcade link, sound and music toggles
  await page.getByRole('heading', { name: 'Cubby Valley' }).waitFor();
  assert.equal(await page.locator('.cv-slot').count(), 3);
  assert.equal(await page.locator('a.cv-back').getAttribute('href'), '/');
  assert.equal(await page.getByRole('button', { name: 'New valley' }).count(), 3);
  await page.getByRole('button', { name: 'Music' }).click();
  assert.equal(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY)).settings.music, false);
  await page.getByRole('button', { name: 'Music' }).click();
  assert.ok(await noSideScroll(page));
  await shot(page, '01-menu');
  await page.getByRole('button', { name: 'New valley' }).first().click();
  for (const m of ['story', 'cosy', 'creative']) assert.ok(await page.locator(`[data-mode="${m}"]`).isVisible());
  await page.getByRole('button', { name: 'Cancel' }).click();
  await newValley(page, 'story');
  let s = await g(page);
  assert.equal(s.mode, 'story'); assert.equal(s.cosy, false); assert.equal(s.hp, 10);
  assert.equal(s.neighbour, 'hazel');
  assert.ok(await page.locator('.cv-quest').isVisible(), 'Hazel’s errand card');
  assert.equal(await page.locator('.cv-heart').count(), 5);

  // real keys: walk, jump
  await meadow(page);
  await page.locator('canvas.cv-canvas').click({ position: { x: 640, y: 400 } }); // focus the valley (and maybe lock the pointer)
  const p0 = (await g(page)).pos;
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await page.keyboard.up('KeyW');
  const p1 = (await g(page)).pos;
  assert.ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.2, `W walks (${JSON.stringify(p0)} → ${JSON.stringify(p1)})`);
  await page.keyboard.down('Space'); await page.waitForTimeout(160);
  const jy = (await g(page)).pos.y; await page.keyboard.up('Space');
  assert.ok(jy > p1.y + 0.2, 'Space jumps');
  await page.keyboard.press('Escape'); if ((await st(page)).overlay === 'pause') await page.keyboard.press('Escape');
  // drag-look (the pointer is not locked in a headless browser)
  if (!(await st(page)).locked) {
    const y0 = (await g(page)).yaw;
    await page.mouse.move(700, 400); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(800, 400, { steps: 6 }); await page.mouse.up({ button: 'middle' });
    assert.ok(Math.abs((await g(page)).yaw - y0) > 0.05, 'dragging looks around');
  }

  // hold the mouse to dig the turf in front, then right-click to place it back (unlocked: headless mouse presses jolt a locked view)
  await page.evaluate(() => document.exitPointerLock()); await page.waitForTimeout(200);
  await meadow(page);
  s = await g(page);
  const tx = Math.floor(s.pos.x), ty = Math.floor(s.pos.y) - 1, tz = Math.floor(s.pos.z) - 2;
  await page.mouse.move(640, 400); // first, so a locked pointer doesn't turn the view after aiming
  await doIt(page, 'look', { x: tx + 0.5, y: ty + 0.9, z: tz + 0.5 });
  await page.waitForTimeout(200);
  const aimed = (await g(page)).aim;
  assert.ok(aimed, 'looking at a block');
  await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  s = await g(page);
  assert.ok((s.inv.soil ?? 0) + (s.inv.hay ?? 0) + (s.inv.daisy ?? 0) + (s.inv.berries ?? 0) + (s.inv.twig ?? 0) >= 1 || s.stats.dug >= 1, `held mouse digs (${JSON.stringify(s.inv)})`);
  const dug = s.stats.dug;
  assert.ok(dug >= 1);
  await doIt(page, 'give', { soil: 5 });
  s = await g(page);
  const soilSlot = s.hot.indexOf('soil');
  assert.ok(soilSlot >= 0, 'soil went on the hotbar');
  await page.keyboard.press(`Digit${soilSlot + 1}`);
  assert.equal((await g(page)).sel, soilSlot, 'number keys pick the hotbar slot');
  await page.mouse.wheel(0, 120); await page.waitForTimeout(100);
  assert.equal((await g(page)).sel, (soilSlot + 1) % 9, 'the wheel moves along the hotbar');
  await page.keyboard.press(`Digit${soilSlot + 1}`);
  await doIt(page, 'look', { x: tx + 0.5, y: ty + 0.2, z: tz + 0.5 });
  const placed0 = (await g(page)).stats.placed;
  await page.mouse.click(640, 400, { button: 'right' }); await page.waitForTimeout(200);
  assert.equal((await g(page)).stats.placed, placed0 + 1, 'right-click places');
  await page.keyboard.press('KeyV'); await page.waitForTimeout(500);
  assert.equal((await st(page)).view, 'first');
  await shot(page, '03-building-first-person');
  await page.keyboard.press('KeyV');

  // the bag
  await page.keyboard.press('KeyE');
  assert.equal((await st(page)).overlay, 'bag');
  assert.ok(await page.locator('.cv-bagcard .cv-item').count() >= 2);
  await page.keyboard.press('Escape');
  assert.equal((await st(page)).overlay, null);

  // the Burrow Workbench: lay a log on the loom by clicks and weave planks
  s = await g(page);
  const bed = s.homeBed;
  await doIt(page, 'teleport', { x: bed.x + 0.5, y: bed.y, z: bed.z + 1.5 });
  await doIt(page, 'give', { log: 2, fluff: 3, hay: 3 });
  await page.keyboard.press('KeyF');
  await until(page, () => window.__cubby().overlay === 'loom');
  await page.locator('.cv-loom-bag .cv-item[title="Birch log"]').click();
  await page.locator('.cv-result[data-state="known"]').waitFor();
  const planks0 = (await g(page)).inv.planks ?? 0;
  await page.getByRole('button', { name: 'Weave' }).click();
  await until(page, (n) => (window.__cubby().game.inv.planks ?? 0) >= n + 4, planks0);
  await page.locator('.cv-pattern[data-recipe="cloth"]').click();
  await shot(page, '04-workbench');
  await page.getByRole('button', { name: 'Weave' }).click();
  await until(page, () => (window.__cubby().game.inv.cloth ?? 0) >= 1);
  await page.keyboard.press('Escape');

  // Hazel’s first errand, handed in by talking to her
  await doIt(page, 'give', { berries: 3 });
  const stump = (await g(page)).stump;
  await doIt(page, 'teleport', { x: stump.x + 0.5, y: stump.y, z: stump.z + 3.5 });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await until(page, () => window.__cubby().overlay === 'talk');
  await page.getByRole('button', { name: 'Give' }).click();
  await until(page, () => window.__cubby().game.quest.step === 1);
  assert.ok((await g(page)).known.includes('tart'), 'Hazel teaches the berry tart');
  await page.keyboard.press('Escape');

  // a burrow: built, checked with B, Hazel invited, and she walks in
  await doIt(page, 'quest', { i: 0, step: 2 });
  s = await g(page);
  const rx = Math.floor(s.start.x) + 8, rz = Math.floor(s.start.z) + 6, ry = Math.floor(s.start.y) + 3;
  await room(page, rx, ry, rz, 'oven');
  await doIt(page, 'teleport', { x: rx + 2.5, y: ry, z: rz + 2.5, yaw: 0, pitch: -0.2 });
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyB');
  await until(page, () => window.__cubby().overlay === 'burrow');
  assert.equal(await page.locator('.cv-checks li:not(.ok)').count(), 0, 'every burrow check passes');
  await page.getByRole('button', { name: 'Invite Hazel' }).click();
  await page.locator('.cv-welcome').waitFor();
  s = await g(page);
  assert.deepEqual(s.moved, ['hazel']); assert.equal(s.neighbour, 'morrow');
  await doIt(page, 'teleport', { x: rx + 2.5, y: ry, z: rz - 3.5, yaw: Math.PI, pitch: -0.25 });
  await page.waitForTimeout(900);
  await shot(page, '05-neighbour-moves-in');

  // night: every monster faces the chinchilla it is after, and a real bonk-stick fight
  await meadow(page);
  await doIt(page, 'time', { phase: 0.78 });
  await doIt(page, 'hp', { hp: 10 });
  for (const [kind, dx, dz, cd] of [['boar', 3, 9, 6], ['moth', -3, 6, 0.4], ['grumble', 2, 6, 0.4], ['bunny', -4, 4, 0.4], ['bunny', 3, 3, 0.4]]) await doIt(page, 'spawn', { kind, dx, dz, cd });
  await page.waitForTimeout(1200);
  // every monster that is after the chinchilla (approaching, snorting, charging, swooping, chasing, lunging) faces it
  const CHASE = { boar: ['roam', 'windup', 'charge', 'rest'], moth: ['swoop'], grumble: ['chase'], gnasher: ['lurk', 'lunge', 'chase'] };
  let facing = [];
  for (let k = 0; k < 20; k++) {
    const [boxes, crs] = await page.evaluate(() => [window.__cubbyScene().critters, window.__cubby().game.critters]);
    facing = boxes.map((b, i) => ({ ...b, st: crs[i]?.st })).filter((c) => CHASE[c.kind]?.includes(c.st));
    if (['boar', 'grumble'].every((k) => facing.some((c) => c.kind === k))) break;
    await page.waitForTimeout(150);
  }
  assert.ok(facing.some((c) => c.kind === 'boar') && facing.some((c) => c.kind === 'grumble'), 'a boar and a Grumblefluff are after the chinchilla');
  for (const c of facing) {
    const diff = Math.abs(Math.atan2(Math.sin(c.yaw - c.toPlayer), Math.cos(c.yaw - c.toPlayer)));
    assert.ok(diff < 0.9, `${c.kind} faces the chinchilla (off by ${diff.toFixed(2)})`);
    assert.ok(c.box.on && c.box.h > 8, `${c.kind} is on screen`);
  }
  await shot(page, '06-night-monsters');
  // bonk a Grumblefluff to a poof and pick up what it drops
  await doIt(page, 'clear');
  s = await g(page);
  const gid = await doIt(page, 'spawn', { kind: 'grumble', dx: 0, dz: -2, cd: 9 });
  await page.keyboard.press('Digit1'); // the bonk-stick
  let defeated0 = s.stats.defeated;
  for (let k = 0; k < 8 && (await g(page)).stats.defeated === defeated0; k++) {
    const c = (await g(page)).critters.find((c) => c.id === gid);
    if (c) {
      const me = (await g(page)).pos, d = Math.hypot(c.x - me.x, c.z - me.z);
      if (d > 2) await doIt(page, 'teleport', { x: c.x + (me.x - c.x) / d * 1.5, y: c.y, z: c.z + (me.z - c.z) / d * 1.5 }); // step back in after the knock-back
      await page.evaluate(() => document.exitPointerLock());
      await doIt(page, 'look', { x: c.x, y: c.y + 0.25, z: c.z });
    }
    await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(500);
  }
  s = await g(page);
  assert.equal(s.stats.defeated, defeated0 + 1, 'the bonk-stick poofs a Grumblefluff');
  await shot(page, '07-combat');
  await page.waitForTimeout(1200);
  // a knock-out wakes you by the bed, with half your things left where you fell
  await doIt(page, 'give', { stone: 8 });
  const before = (await g(page)).inv.stone;
  { const s0 = await g(page); await doIt(page, 'teleport', { x: s0.start.x - 5.5, y: s0.start.y + 3, z: s0.start.z + 10.5, yaw: Math.PI }); await page.waitForTimeout(1200); } // out of the cubby lantern's light
  await doIt(page, 'hp', { hp: 1 });
  await doIt(page, 'spawn', { kind: 'gnasher', dx: 0, dz: 2, cd: 0 }); await doIt(page, 'spawn', { kind: 'grumble', dx: 2, dz: 2, cd: 0 });
  await until(page, () => window.__cubby().game.stats.kos >= 1, null, 20000).catch(async (e) => { const x = await st(page); console.log('KO wait', JSON.stringify({ ov: x.overlay, screen: x.screen, hp: x.game.hp, phase: x.game.phase, pos: x.game.pos, critters: x.game.critters })); throw e; });
  s = await g(page);
  assert.equal(s.hp, 10); assert.equal(s.inv.stone, before - Math.floor(before / 2));
  assert.ok(Math.hypot(s.pos.x - s.homeBed.x - 0.5, s.pos.z - s.homeBed.z - 0.5) < 2.5, 'woke by the bed');
  await doIt(page, 'time', { phase: 0.2 }); await doIt(page, 'clear');

  // the save, across a reload
  const keep = await g(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save and leave' }).click();
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
  assert.match(await page.locator('.cv-slot').first().innerText(), /1\/6 neighbours/);
  await page.getByRole('button', { name: 'Play' }).first().click();
  await until(page, () => window.__cubby().game?.built >= 1, null, 120000);
  s = await g(page);
  assert.deepEqual(s.moved, keep.moved); assert.equal(s.inv.planks, keep.inv.planks); assert.equal(s.stats.placed, keep.stats.placed);
  assert.ok(Math.abs(s.pos.x - keep.pos.x) < 0.5 && Math.abs(s.pos.z - keep.pos.z) < 0.5, 'back where we were');
  // the built room came back too
  assert.equal(await doIt(page, 'get', { x: rx + 2, y: ry, z: rz }), 'door');
  assert.equal(await doIt(page, 'get', { x: rx + 1, y: ry, z: rz + 1 }), 'oven');

  // the summer fair ending
  await doIt(page, 'fair');
  await page.locator('.cv-ending').waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, '09-fair-ending');
  await page.getByRole('button', { name: 'Keep building' }).click();
  assert.equal((await st(page)).screen, 'play');
  await page.context().close();
}

// ---------------------------------------------------------------- Cosy nights and creative
{
  const page = await open();
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await page.locator('main[data-ready="true"]').waitFor();
  await newValley(page, 'cosy');
  let s = await g(page);
  assert.equal(s.cosy, true);
  await meadow(page); await doIt(page, 'time', { phase: 0.75 });
  await page.waitForTimeout(9000);
  s = await g(page);
  assert.ok(!s.critters.some((c) => c.kind !== 'bunny'), 'Cosy nights: only dust-bunnies');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Save and leave' }).click();
  await newValley(page, 'creative');
  s = await g(page);
  assert.equal(s.mode, 'creative');
  assert.equal(await page.locator('.cv-heart').count(), 0, 'no hearts in creative');
  await page.locator('canvas.cv-canvas').click({ position: { x: 640, y: 400 } });
  await page.keyboard.press('Space'); await page.waitForTimeout(120); await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  assert.equal((await g(page)).fly, true, 'double-jump flies in creative');
  await page.context().close();
}

// ---------------------------------------------------------------- a corrupt save
{
  const page = await open();
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"slots":[{"seed":"x","diff":42}],"settings":7'), KEY);
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole('button', { name: 'New valley' }).count(), 3, 'a corrupt save is ignored');
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, slots: [{ seed: 5, mode: 'story', diff: '!!!', time: 'x' }, null, null], last: 9, settings: { sound: 'yes' } })), KEY);
  await page.reload(); await page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
  assert.ok(await page.getByRole('button', { name: 'New valley' }).count() >= 2);
  await page.context().close();
}

// ---------------------------------------------------------------- framing on desktops
for (const vp of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
  const page = await open(vp);
  await newValley(page, 'story');
  await meadow(page);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => window.__cubbyScene());
  for (const who of ['dora', 'enzo']) {
    const r = b[who];
    assert.ok(r.on && r.h > vp.height * 0.12, `${vp.width}: ${who} a clear size (${Math.round(r.h)}px)`);
    assert.ok(r.x > 0 && r.x + r.w < vp.width && r.y > 0 && r.y + r.h < vp.height, `${vp.width}: ${who} fully in view`);
    for (const sel of ['.cv-hotbar', '.cv-quest', '.cv-status', '.cv-tools']) assert.ok(!overlap(r, bx(await rect(page, sel))), `${vp.width}: ${sel} covers ${who}`);
  }
  assert.ok(await noSideScroll(page));
  await shot(page, vp.width === 1920 ? '10-desktop-1920' : '02-building-third-person');
  await page.context().close();
}

// ---------------------------------------------------------------- phones, by touch
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  const page = await open(vp, true);
  const tag = vp.width < vp.height ? 'upright' : 'sideways';
  assert.ok(await noSideScroll(page), `${tag}: menu fits`);
  const card = await rect(page, '.cv-menu-card');
  assert.ok(card.y >= 0 && card.y + card.height <= vp.height + 1, `${tag}: menu card on screen`);
  await shot(page, `11-phone-${tag}-menu`);
  await page.getByRole('button', { name: 'New valley' }).first().tap();
  await page.locator('[data-mode="story"]').tap();
  await until(page, () => window.__cubby().game?.built >= 1, null, 120000);
  await meadow(page);
  await page.waitForTimeout(600);
  // the controls are all on screen and don't sit on each other
  const ids = ['.cv-pad', '.cv-tb-dig', '.cv-tb-place', '.cv-tb-jump', '.cv-tb-use', '.cv-hotbar'];
  const rs = [];
  for (const id of ids) { const r = bx(await rect(page, id)); assert.ok(r && r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1, `${tag}: ${id} on screen`); rs.push([id, r]); }
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (!(rs[i][0] === '.cv-hotbar' || rs[j][0] === '.cv-hotbar') || tag === 'upright') assert.ok(!overlap(rs[i][1], rs[j][1]), `${tag}: ${rs[i][0]} overlaps ${rs[j][0]}`);
  const b = await page.evaluate(() => window.__cubbyScene());
  assert.ok(b.dora.on && b.dora.h > vp.height * 0.08, `${tag}: Dora visible (${Math.round(b.dora.h)}px)`);
  for (const id of ['.cv-pad', '.cv-btns', '.cv-hotbar']) {
    const r = bx(await rect(page, id === '.cv-btns' ? '.cv-tb-dig' : id));
    assert.ok(!overlap(b.dora, r), `${tag}: ${id} covers Dora`);
  }
  // walk with the thumb pad (real touch events)
  const cdp = await page.context().newCDPSession(page);
  const pad = await rect(page, '.cv-pad'), cx = pad.x + pad.width / 2, cy = pad.y + pad.height / 2;
  const p0 = (await g(page)).pos;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - i * 9, id: 1 }] });
  await page.waitForTimeout(900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = (await g(page)).pos;
  assert.ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, `${tag}: the pad walks`);
  // look by dragging on the valley
  const y0 = (await g(page)).yaw, mx = vp.width / 2, my = vp.height * 0.35;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mx, y: my, id: 2 }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mx + i * 12, y: my, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(Math.abs((await g(page)).yaw - y0) > 0.1, `${tag}: dragging looks`);
  // dig by holding the Dig button at the turf ahead
  const s = await g(page);
  await doIt(page, 'look', { x: Math.floor(s.pos.x) + 0.5, y: Math.floor(s.pos.y) - 0.1, z: Math.floor(s.pos.z) - 1.5 });
  const dug = s.stats.dug, dig = await rect(page, '.cv-tb-dig');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dig.x + dig.width / 2, y: dig.y + dig.height / 2, id: 3 }] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok((await g(page)).stats.dug > dug, `${tag}: Dig digs`);
  // Jump
  const jb = await rect(page, '.cv-tb-jump'), gy = (await g(page)).pos.y;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jb.x + jb.width / 2, y: jb.y + jb.height / 2, id: 4 }] });
  await page.waitForTimeout(150);
  const jy = (await g(page)).pos.y;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(jy > gy + 0.15, `${tag}: Jump jumps`);
  // the bag and the workbench fit the screen
  await page.locator('.cv-bag').tap();
  const bag = bx(await rect(page, '.cv-bagcard'));
  assert.ok(bag.x >= 0 && bag.x + bag.w <= vp.width + 1 && bag.y >= 0 && bag.y + bag.h <= vp.height + 1, `${tag}: the bag fits`);
  await page.getByRole('button', { name: 'Close' }).tap();
  await doIt(page, 'teleport', { x: s.homeBed.x + 0.5, y: s.homeBed.y, z: s.homeBed.z + 1.5 });
  await page.locator('.cv-tb-use').tap();
  await until(page, () => window.__cubby().overlay === 'loom');
  const loom = bx(await rect(page, '.cv-loom'));
  assert.ok(loom.x >= 0 && loom.x + loom.w <= vp.width + 1 && loom.y >= 0 && loom.y + loom.h <= vp.height + 1, `${tag}: the workbench fits`);
  await page.getByRole('button', { name: 'Close' }).tap();
  await meadow(page); await page.waitForTimeout(500);
  assert.ok(await noSideScroll(page));
  await shot(page, `12-phone-${tag}`);
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log('cubby e2e: menu, keyboard and mouse play, workbench, errands, burrow and move-in, night monsters and combat, knock-out, Cosy nights, creative, saves, corrupt save, ending, desktop framing and phones all pass');
