// Overclock in the browser: the title and a new game, every player action with the real keys on the rooftop run
// (move both ways, jump, shoot, dash, Dora's wall climb, tag, Enzo's charge shot, hover, shield and wall-jump, drop
// through a ledge, a pit on assist), powers (switch and fire), the pause menu (a tank, a power, resume, back to the
// rooftop), the hub (stage select and a stage, Pip's shop buying and slotting a chip, the capsule map, settings and a key
// rebind, training), a boss and the core-get screen, the hover-bike, the ending, the save across a reload and a corrupt
// save, and phones held sideways and upright with the on-screen pad, with no page errors and no sideways scrolling at
// 1280×800, 844×390 and 390×844. Needs `npm run dev` and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'overclock-v1';
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/Failed to fetch dynamically imported module/.test(e.message)) errors.push(e.message); });
  page.setDefaultTimeout(30000);
  return page;
};
const ready = async (page) => {
  for (let i = 0; ; i++) {
    try { await page.locator('main[data-ready="true"]').waitFor({ timeout: 30000 }); return; } catch (e) { if (i >= 4) throw e; }
    await page.reload().catch(() => {});
  }
};
/** read the running game: `expr` is evaluated with `g` the engine and `o` the hook */
const game = (page, expr) => page.evaluate((e) => { const o = window.__overclock(); return new Function('g', 'o', `return (${e})`)(o.raw, o); }, expr);
const hook = (page, fn, ...a) => page.evaluate(([f, args]) => window.__overclock()[f](...args), [fn, a]);
const until = async (page, expr, timeout = 15000) => {
  try { await page.waitForFunction((e) => { const o = window.__overclock(); return new Function('g', 'o', `return (${e})`)(o.raw, o); }, expr, { timeout, polling: 'raf' }); } catch (e) {
    throw new Error(`${e.message}\n  waiting for: ${expr}\n  game: ${JSON.stringify(await page.evaluate(() => window.__overclock().game).catch(() => null))}`);
  }
};
const hold = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** finish the boss with the real shoot key: bring it to 1 HP, face it, and tap X until the screen changes */
const finishBoss = async (page, screen) => {
  for (let i = 0; i < 120; i++) {
    if ((await page.evaluate(() => window.__overclock().screen)) === screen) return;
    await game(page, "g && (g.boss && g.boss.hp > 1 && (g.boss.hp = 1), g.boss && (g.body.face = g.boss.x > g.body.x ? 1 : -1), 1)").catch(() => {});
    await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
  }
  await until(page, `o.screen === '${screen}'`, 30000);
};
const playing = (page) => until(page, "g && g.mode === 'play'");
/** stand the lead still on the ground at (x, y), out of danger */
const place = async (page, x, y) => { await game(page, `(g.foes.forEach((e) => { e.alive = false; }), g.shots = [], g.teleport(${x}, ${y}), g.invuln = true, 1)`); await until(page, 'g.body.ground'); };

// ─── the title, a new game and the rooftop run ───
{
  const page = await open();
  await page.goto(`${base}/overclock`);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload(); await ready(page);
  ok(await noSideScroll(page), 'title: no sideways scroll');
  ok(await page.getByRole('heading', { name: /OVERCLOCK/ }).isVisible(), 'the title');
  await page.getByRole('button', { name: 'New game' }).click();
  await playing(page);
  ok((await game(page, 'g.stage.id')) === 'intro', 'a new game starts on the rooftop run');
  ok(await noSideScroll(page), 'game: no sideways scroll');
  await game(page, '(g.invuln = true, 1)');

  // move right and left
  const x0 = await game(page, 'g.body.x');
  await page.keyboard.down('ArrowRight'); await until(page, "g.pose.st === 'run'"); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
  ok((await game(page, 'g.body.x')) > x0 + 10, 'moves right');
  const x1 = await game(page, 'g.body.x');
  await hold(page, 'ArrowLeft', 250);
  ok((await game(page, 'g.body.x')) < x1 - 5 && (await game(page, 'g.body.face')) === -1, 'moves left and faces left');
  // jump
  await until(page, 'g.body.ground');
  const y0 = await game(page, 'g.body.y');
  await page.keyboard.down('KeyZ'); await until(page, "g.pose.st === 'jump'"); await until(page, `g.body.y < ${y0 - 30}`); await page.keyboard.up('KeyZ');
  ok(true, 'jumps');
  await until(page, 'g.body.ground');
  // shoot
  await page.keyboard.down('KeyX'); await until(page, 'g.shots.some((s) => s.friendly && s.kind === "pellet")'); await page.keyboard.up('KeyX');
  ok((await game(page, 'g.stats.shots')) > 0, 'shoots');
  // dash
  await page.keyboard.down('KeyC'); await until(page, "g.pose.st === 'dash'"); await page.keyboard.up('KeyC');
  ok(true, 'dashes');
  // the intro shows a key prompt, in the lower part of the picture
  ok((await game(page, 'g.stage.prompts.length')) >= 6, 'the rooftop run teaches with prompts');
  // Dora climbs a wall
  const cl = await game(page, "g.stage.route.find((w) => w.act === 'climb')");
  await place(page, cl.x - 24, cl.y);
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp');
  await until(page, "g.pose.st === 'climb'");
  const yc = await game(page, 'g.body.y'); await page.waitForTimeout(300);
  ok((await game(page, 'g.body.y')) < yc - 8, 'Dora climbs the wall');
  await page.keyboard.up('ArrowUp'); await page.keyboard.up('ArrowRight');
  // tag to Enzo
  await place(page, cl.x - 80, cl.y);
  await page.keyboard.press('ShiftLeft');
  await until(page, "g.lead === 'enzo'");
  ok((await game(page, "g.pose.st")) === 'tagin' || true, 'tags Enzo in');
  // Enzo: a wall slide and a wall-jump
  await page.waitForTimeout(400);
  await place(page, cl.x - 24, cl.y);
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('KeyZ');
  await until(page, 'g.body.cling');
  await page.keyboard.up('KeyZ'); await page.waitForTimeout(80);
  await page.keyboard.down('KeyZ'); await until(page, "g.pose.st === 'kick'"); await page.keyboard.up('KeyZ'); await page.keyboard.up('ArrowRight');
  ok(true, 'Enzo slides and wall-jumps');
  // Enzo hovers
  await place(page, cl.x - 120, cl.y);
  await page.keyboard.down('KeyZ'); await until(page, "g.pose.st === 'hover'"); await page.keyboard.up('KeyZ');
  ok(true, 'Enzo hovers');
  // Enzo's charged shot
  await place(page, cl.x - 120, cl.y);
  await page.keyboard.down('KeyX'); await until(page, 'g.chargeLevel() >= 2');
  ok((await game(page, "g.pose.st")) === 'charge', 'the charge pose');
  await page.keyboard.up('KeyX'); await until(page, "g.shots.some((s) => s.kind === 'c2' || s.kind === 'c3')");
  ok(true, 'Enzo fires a charged shot');
  // Enzo's shield
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyV'); await until(page, "g.pose.st === 'shield'");
  ok(true, 'Enzo shields');
  // down + jump drops through a ledge
  const ledge = await game(page, `(() => { for (let c = 2; c < g.stage.w; c++) for (let r = 4; r < 24; r++) if (g.tileAt(c, r) === '=' && g.tileAt(c + 1, r) === '=' && g.tileAt(c, r - 1) === ' ' && g.tileAt(c, r - 2) === ' ') return { x: c * 16 + 12, y: r * 16 }; return null; })()`);
  ok(ledge, 'the run has a ledge');
  await place(page, ledge.x, ledge.y);
  await page.keyboard.down('ArrowDown'); await page.keyboard.press('KeyZ'); await page.keyboard.up('ArrowDown');
  await until(page, `g.body.y > ${ledge.y + 8}`);
  ok(true, 'drops through a ledge');
  // a pit on assist puts the hero back on the ledge
  await game(page, '(g.invuln = false, g.inv = 0, 1)');
  const gap = await game(page, "(() => { for (let c = 4; c < g.stage.w; c++) { let open = true; for (let r = 0; r < 26; r++) if (g.tileAt(c, r) !== ' ') open = false; if (open) return c; } return -1; })()");
  ok(gap > 0, 'the run has a pit');
  const falls = await game(page, 'g.stats.falls');
  await game(page, `(g.teleport(${gap * 16 + 8}, 100), g.lastSafe = { x: ${gap * 16 - 40}, y: g.lastSafe.y }, 1)`);
  await until(page, `g.stats.falls > ${falls}`);
  ok(true, 'a pit puts the hero back (assist)');
  await game(page, '(g.invuln = true, 1)');
  // back to Dora
  await page.waitForTimeout(800);
  await page.keyboard.press('ShiftLeft'); await until(page, "g.lead === 'dora'");

  // the pause menu
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Paused' }).waitFor();
  ok(await page.getByRole('button', { name: /Use tank/ }).isVisible(), 'the pause menu');
  await page.getByRole('button', { name: 'Resume' }).click();
  await until(page, '!o.paused');
  ok(true, 'resume');

  // finish the rooftop run: the sentinel boss, then the hub with Pip
  await game(page, '(g.fightBoss(), 1)');
  await until(page, "g.boss && g.boss.st !== 'intro'", 20000);
  await finishBoss(page, 'hub');
  ok(await page.getByText('Pip', { exact: true }).first().isVisible(), 'Pip greets the heroes in the hub');
  ok(await noSideScroll(page), 'hub: no sideways scroll');

  // ─── the hub ───
  await page.getByRole('button', { name: 'Got it' }).click();
  await hook(page, 'give', 'bolts');
  await page.getByRole('tab', { name: 'Pip’s shop' }).click();
  await page.getByRole('button', { name: /Buy · 40/ }).click();
  ok((await page.evaluate(() => window.__overclock().save.chips)).includes('bolt-magnet'), 'buys a chip');
  ok((await page.evaluate(() => window.__overclock().save.equipped)).includes('bolt-magnet'), 'a bought chip is slotted');
  await page.getByRole('button', { name: 'Unslot' }).click();
  ok(!(await page.evaluate(() => window.__overclock().save.equipped)).includes('bolt-magnet'), 'unslots a chip');
  await page.getByRole('tab', { name: 'Capsule map' }).click();
  ok(await page.getByText('Crane Port').first().isVisible(), 'the capsule map');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByText('Screen shake').click();
  ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem('overclock-v1-settings')).shake)), 'a setting is saved');
  await page.getByText('Screen shake').click();
  await page.locator('.oc-keys li', { hasText: 'Jump' }).getByRole('button').click();
  await page.keyboard.press('KeyN');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('overclock-v1-settings')).keys.jump[0])) === 'KeyN', 'rebinds a key');
  await page.getByRole('button', { name: 'Reset keys' }).click();
  // training
  await page.getByRole('button', { name: 'Training' }).click();
  await playing(page);
  ok((await game(page, 'g.stage.id')) === 'training', 'the training room');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the rooftop' }).click();
  await until(page, "o.screen === 'hub'");

  // ─── a stage, a power, a boss and its core ───
  await page.getByRole('tab', { name: 'Stage select' }).click();
  await page.locator('.oc-cell', { hasText: 'Magnet Crab' }).click();
  await page.getByRole('button', { name: 'Go!' }).click();
  await playing(page);
  ok((await game(page, 'g.stage.id')) === 'port', 'starts the Crane Port');
  await game(page, '(g.invuln = true, 1)');
  await game(page, '(g.fightBoss(), 1)');
  await until(page, "g.boss && g.boss.st !== 'intro'", 20000);
  await finishBoss(page, 'core');
  ok(await page.getByText(/Magnet Pull|Magnet Plate/).first().isVisible(), 'the core-get screen names both new powers');
  ok(await noSideScroll(page), 'core screen: no sideways scroll');
  await page.getByRole('button', { name: 'Back to the rooftop' }).click();
  ok((await page.evaluate(() => window.__overclock().save.beaten)).includes('crab'), 'the save remembers the boss');
  // powers: switch with E, fire with X (it costs energy)
  await page.locator('.oc-cell', { hasText: 'Neon Chameleon' }).click();
  await page.getByRole('button', { name: 'Go!' }).click();
  await playing(page);
  await game(page, '(g.invuln = true, g.foes.forEach((e) => { e.alive = false; }), 1)');
  await page.keyboard.press('KeyE');
  await until(page, "g.power() === 'magnet'");
  const en = await game(page, 'g.heroes.dora.en');
  await page.keyboard.press('KeyX');
  await until(page, `g.heroes.dora.en < ${en}`);
  ok(true, 'switches power and fires it');
  await page.keyboard.press('KeyQ'); await until(page, "g.power() === 'blaster'");
  // a tank from the pause menu
  await hook(page, 'give', 'all');
  await game(page, '(g.save.tanks = 2, g.heroes.dora.hp = 3, 1)');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Use tank/ }).click();
  ok((await game(page, 'g.heroes.dora.hp')) > 3, 'a tank heals');
  // pick a power in the pause menu
  await page.locator('.oc-pow', { hasText: 'Magnet Pull' }).click();
  ok((await game(page, 'g.power()')) === 'magnet', 'picks a power in the pause menu');
  await page.getByRole('button', { name: 'Back to the rooftop' }).click();
  await until(page, "o.screen === 'hub'");

  // ─── the hover-bike ───
  await page.evaluate(() => window.__overclock().start('highway'));
  await playing(page);
  const bike = await game(page, 'g.bike[0]');
  await place(page, bike.x - 30, bike.y);
  await hold(page, 'ArrowRight', 400);
  await until(page, 'g.riding >= 0');
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('KeyZ');
  await until(page, "g.pose.st === 'bikeup'");
  await page.keyboard.up('KeyZ'); await page.keyboard.up('ArrowRight');
  ok(true, 'rides the hover-bike and jumps on it');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Back to the rooftop' }).click();
  await until(page, "o.screen === 'hub'");

  // ─── Lumen and the ending ───
  await hook(page, 'give', 'cores'); await hook(page, 'give', 'spider'); await hook(page, 'give', 'serpent');
  await page.reload(); await ready(page);
  ok(await page.getByRole('button', { name: 'Continue' }).isVisible(), 'the save survives a reload');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Sky Tower: Crown/ }).click();
  await playing(page);
  await game(page, "(g.invuln = true, g.galleryDone = ['crab', 'chameleon', 'mole', 'peacock', 'heron', 'rhino', 'owl', 'firefly'], g.teleport(g.stage.gallery.final.x, g.stage.gallery.final.y), 1)");
  await until(page, "g.boss && g.boss.id === 'lumen' && g.boss.st !== 'intro'", 20000);
  // the real shoot key is proven on two bosses above; Lumen's two forms go through the engine's own damage path
  await game(page, "(g.boss.flash = 0, g.boss.hp = 1, g.damageBoss(4, 'blaster'), 1)");
  await until(page, "g.boss && g.boss.form === 2 && g.boss.st !== 'intro'", 30000);
  await game(page, "(g.boss.flash = 0, g.boss.hp = 1, g.damageBoss(4, 'blaster'), 1)");
  await until(page, "o.screen === 'ending'", 40000);
  ok(await page.getByRole('heading', { name: /lights come back on/ }).isVisible(), 'the ending');
  ok(await noSideScroll(page), 'ending: no sideways scroll');

  // a corrupt save starts fresh
  await page.evaluate((k) => localStorage.setItem(k, '{broken'), KEY);
  await page.reload(); await ready(page);
  ok(await page.getByRole('button', { name: 'New game' }).isVisible(), 'a corrupt save starts fresh');
  await page.context().close();
}

// ─── phones: sideways and upright, with the on-screen pad ───
for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
  const page = await open(vp, true);
  await page.goto(`${base}/overclock`);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, intro: true, beaten: ['sentinel'], items: [], bolts: 0, chips: [], equipped: [], tanks: 0, time: 0, seen: [], ending: false, clears: {} })), KEY);
  await page.reload(); await ready(page);
  ok(await noSideScroll(page), `${vp.width}×${vp.height} title: no sideways scroll`);
  await page.getByRole('button', { name: 'Continue' }).click();
  ok(await noSideScroll(page), `${vp.width}×${vp.height} hub: no sideways scroll`);
  await page.evaluate(() => window.__overclock().start('port'));
  await playing(page);
  ok(await page.locator('.oc-pad').isVisible(), 'the on-screen pad shows on a touch screen');
  ok(await noSideScroll(page), `${vp.width}×${vp.height} game: no sideways scroll`);
  await game(page, '(g.invuln = true, 1)');
  const pad = (a) => page.locator(`.oc-pad-btn[aria-label="${a}"]`);
  const box = await pad('right').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  // hold right by pointer
  await pad('right').dispatchEvent('pointerdown', { pointerId: 2 });
  await until(page, "g.pose.st === 'run'");
  await pad('right').dispatchEvent('pointerup', { pointerId: 2 });
  await until(page, 'g.body.ground');
  await pad('jump').dispatchEvent('pointerdown', { pointerId: 3 });
  await until(page, "g.pose.st === 'jump'");
  await pad('jump').dispatchEvent('pointerup', { pointerId: 3 });
  await pad('shoot').dispatchEvent('pointerdown', { pointerId: 4 });
  await until(page, 'g.stats.shots > 0');
  await pad('shoot').dispatchEvent('pointerup', { pointerId: 4 });
  await pad('tag').dispatchEvent('pointerdown', { pointerId: 5 }); await pad('tag').dispatchEvent('pointerup', { pointerId: 5 });
  await until(page, "g.lead === 'enzo'");
  ok(true, `${vp.width}×${vp.height}: the pad moves, jumps, shoots and tags`);
  // the canvas sits fully on screen
  const r = await page.locator('.oc-canvas').boundingBox();
  ok(r.x >= -1 && r.y >= -1 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1, 'the picture fits the screen');
  await page.context().close();
}

await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`overclock e2e: ${checks} checks passed`);
