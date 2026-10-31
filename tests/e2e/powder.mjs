// Powder Paws in the browser: the menu fits; the first freeride run played with the real keyboard (carve both ways,
// tuck, snowplough) and the real mouse (the skier steers toward the pointer); a ramp jump with a spin; a postcard
// from a cabin; the storm catching up and the cocoa scene, with the run saved and kept across a reload; a corrupt
// save; the slalom courses with a gate run, Big Air, the wardrobe and the postcard album; the ending; the framing at
// 1280×800 and 1920×1080 (Dora and Enzo a clear size, below the bar, nothing over them); phones held upright and
// sideways steering with a held finger and the touch pads; and no page errors. Needs `npm run dev` on port 3000 (or
// BASE_URL) and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const KEY = 'powder-paws-v1';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const open = async (viewport = { width: 1280, height: 800 }, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(30000);
  return page;
};
const ready = (page) => page.locator('main[data-ready="true"]').waitFor({ timeout: 120000 });
const state = (page) => page.evaluate(() => window.__powder());
const hold = async (page, keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
const inView = async (page, loc) => { const b = await loc.boundingBox(), v = page.viewportSize(); return b && b.x >= -1 && b.y >= -1 && b.x + b.width <= v.width + 1 && b.y + b.height <= v.height + 1; };
async function startRun(page, name) {
  await page.getByRole('button', { name }).click();
  const tip = page.getByRole('button', { name: /Let’s ski/ });
  if (await tip.isVisible().catch(() => false)) await tip.click();
  await page.waitForFunction(() => window.__powder().screen === 'play' && !window.__powder().blocked);
}
/** The skier and partner on screen (page px), the bar, and the scale. */
async function framing(page) {
  return page.evaluate(() => {
    const s = window.__powder(), c = document.querySelector('.pp-canvas').getBoundingClientRect(), bar = document.querySelector('.pp-hud')?.getBoundingClientRect();
    const dpr = 1, px = s.scale / dpr;
    return { skier: { x: c.left + s.skier.x, y: c.top + s.skier.y }, partner: s.partner && { x: c.left + s.partner.x, y: c.top + s.partner.y }, size: 26 * px, barBottom: bar?.bottom ?? 0, w: innerWidth, h: innerHeight };
  });
}

// ---- desktop: menu, the first run with keyboard and mouse
{
  const page = await open();
  await page.goto(base + '/powder'); await ready(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.ok(await page.getByRole('heading', { name: 'Powder Paws' }).isVisible());
  assert.ok(await noScroll(page), 'the menu fits without scrolling');
  for (const n of [/^Freeride/, /^Daily Mountain/, /^Slalom/, /^Big Air/, /Wardrobe/, /Postcards 0\/10/]) assert.ok(await page.getByRole('button', { name: n }).isVisible(), `menu has ${n}`);
  await page.getByRole('button', { name: /^Enzo/ }).click();
  assert.equal((await state(page)).save.who, 'enzo', 'pick Enzo');
  await page.getByRole('button', { name: /^Dora/ }).click();
  await page.getByRole('button', { name: /^Freeride/ }).click();
  assert.ok(await page.getByRole('dialog', { name: 'Down Whiskerpeak!' }).isVisible(), 'the first run explains the controls');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  let s = await state(page);
  assert.ok(s.y > 60 && s.s > 50 && s.state === 'ride', `the skier sets off downhill (${s.y}, ${s.s})`);
  await hold(page, ['ArrowRight'], 350); s = await state(page); assert.ok(s.a > 0.4, 'right arrow carves right');
  await hold(page, ['ArrowLeft'], 700); s = await state(page); assert.ok(s.a < -0.3, 'left arrow carves left');
  await hold(page, ['ArrowRight'], 220);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  const fast = (await state(page)).s; await hold(page, ['ArrowDown'], 700); s = await state(page);
  assert.ok(s.s < fast * 0.6 || s.state !== 'ride', `the snowplough brakes (${fast.toFixed(0)} -> ${s.s.toFixed(0)})`);
  // the mouse: the skier turns toward the pointer
  const f = await framing(page);
  await page.mouse.move(f.skier.x - 260, f.skier.y + 90); await page.waitForTimeout(500);
  s = await state(page); assert.ok(s.a < -0.6 || s.state !== 'ride', 'the skier steers toward the pointer on the left');
  await page.mouse.move(f.skier.x + 200, f.skier.y + 200); await page.waitForTimeout(500);
  s = await state(page); assert.ok(s.a > 0.3 || s.state !== 'ride', 'and on the right');
  await page.mouse.move(f.skier.x, f.skier.y + 300);
  // framing at 1280×800
  const fr = await framing(page);
  assert.ok(fr.size >= 60, `the skier is a clear size (${fr.size}px)`);
  assert.ok(fr.skier.y - fr.size > fr.barBottom, 'the bar is clear of the skier');
  assert.ok(fr.skier.y > fr.h * 0.2 && fr.skier.y < fr.h * 0.55, 'the skier sits in the upper middle with the slope ahead in view');
  // a jump with a spin
  await page.evaluate(() => window.__powderRamp());
  await page.waitForFunction(() => window.__powder().state === 'air', null, { timeout: 5000 });
  await hold(page, ['ArrowRight'], 640);
  await page.waitForFunction(() => window.__powder().state !== 'air', null, { timeout: 6000 });
  s = await state(page);
  assert.ok(s.tricks > 0 || s.crashes > 0, 'the jump ends in a scored trick or a tumble');
  // the partner follows on the line, below the bar
  await page.waitForTimeout(1200);
  const p = await framing(page);
  assert.ok(p.partner && p.partner.y - p.size > p.barBottom - 10 && Math.abs(p.partner.y - p.skier.y) < 260, 'the partner follows close behind, in view');
  // a postcard
  await page.evaluate(() => window.__powderCabin());
  await page.waitForFunction(() => window.__powder().cards.length === 1, null, { timeout: 8000 });
  assert.ok(await page.locator('.pp-toast').isVisible(), 'a postcard toast shows');
  // pause and resume
  await page.keyboard.press('Escape'); assert.ok(await page.getByRole('dialog', { name: 'Paused' }).isVisible());
  const st = (await state(page)).steps; await page.waitForTimeout(400); assert.equal((await state(page)).steps, st, 'pause stops the clock');
  await page.getByRole('button', { name: 'Keep skiing' }).click();
  // the storm catches up: cocoa, and the run is saved
  await page.evaluate(() => window.__powderStorm(30));
  await page.getByRole('dialog', { name: 'Caught by the storm' }).waitFor({ timeout: 8000 });
  const card = await page.locator('.pp-cocoa-card').boundingBox();
  assert.ok(card.x + card.width < 1280 * 0.5, 'the cocoa card stands on the left, clear of the pair by the fire');
  assert.ok(await inView(page, page.locator('.pp-cocoa-card')), 'the cocoa card is fully in view');
  s = await state(page);
  assert.ok(s.save.best.free > 0 && s.save.cards.includes(s.over.cards[0]), 'the distance and postcard are saved');
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /Postcards 1\/10/ }).isVisible() && await page.getByRole('button', { name: /^Freeride.*Best/ }).isVisible(), 'progress is kept across a reload');
  // slalom
  await page.getByRole('button', { name: /^Slalom/ }).click();
  assert.equal(await page.locator('.pp-course').count(), 6, 'six slalom courses');
  await page.locator('.pp-course').first().click();
  await page.getByRole('button', { name: /Let’s ski/ }).click();
  await page.waitForTimeout(4000);
  s = await state(page); assert.ok(s.mode === 'slalom' && s.gatesOk + s.missed >= 1, 'gates are counted');
  assert.ok(await page.locator('.pp-hud').getByText('gates').isVisible());
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Quit' }).click();
  assert.ok(await page.locator('.pp-course').first().isVisible(), 'quitting a slalom goes back to the courses');
  await page.getByRole('button', { name: '← MENU' }).click();
  // Big Air
  await startRun(page, /^Big Air/);
  await page.waitForTimeout(800);
  assert.equal((await state(page)).mode, 'air');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Quit' }).click();
  // wardrobe
  await page.getByRole('button', { name: 'Wardrobe' }).click();
  assert.ok(await page.getByRole('button', { name: /Rainbow|Find all 10/ }).isDisabled(), 'locked gear is locked');
  await page.getByRole('button', { name: 'Blueberry scarf' }).click();
  assert.equal((await state(page)).save.gear.dora.scarf, 'scarf-blue', 'gear is worn and saved');
  assert.ok(await noScroll(page));
  await page.getByRole('button', { name: '← MENU' }).click();
  // album
  await page.getByRole('button', { name: /Postcards/ }).click();
  assert.equal(await page.locator('.pp-postcard').count(), 10);
  assert.equal(await page.locator('.pp-postcard.is-found').count(), 1, 'one postcard found');
  await page.getByRole('button', { name: '← MENU' }).click();
  // the ending
  await page.evaluate(() => window.__powderEnding());
  assert.ok(await page.getByRole('heading', { name: 'The lodge party' }).isVisible() && await inView(page, page.locator('.pp-ending-card')));
  // corrupt save
  await page.evaluate((k) => localStorage.setItem(k, '{"v":1,"cards":[99,"x"],"best":{"free":-5},"gear":{"dora":{"scarf":"lava"}}'), KEY);
  await page.reload(); await ready(page);
  s = await state(page); assert.equal(s.save.cards.length, 0); assert.equal(s.save.best.free, 0, 'a corrupt save is ignored');
  await page.evaluate((k) => localStorage.setItem(k, 'not json at all'), KEY);
  await page.reload(); await ready(page);
  assert.ok(await page.getByRole('button', { name: /^Freeride/ }).isVisible(), 'junk in the save still loads the menu');
  await page.context().close();
}
// ---- 1920×1080
{
  const page = await open({ width: 1920, height: 1080 });
  await page.goto(base + '/powder'); await ready(page);
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, tips: ['free', 'slalom', 'air'] })), KEY); await page.reload(); await ready(page);
  assert.ok(await noScroll(page));
  await startRun(page, /^Freeride/);
  await page.waitForTimeout(2000);
  const f = await framing(page);
  assert.ok(f.size >= 80, `big screens show big skiers (${f.size}px)`);
  assert.ok(f.skier.y - f.size > f.barBottom && f.partner && f.partner.y - f.size > f.barBottom - 10, 'both chinchillas clear of the bar');
  await page.context().close();
}
// ---- phones
for (const [w, h, name] of [[390, 844, 'upright'], [844, 390, 'sideways']]) {
  const page = await open({ width: w, height: h }, true);
  await page.goto(base + '/powder'); await ready(page);
  await page.evaluate((k) => localStorage.removeItem(k), KEY); await page.reload(); await ready(page);
  assert.ok(await noScroll(page), `${name}: the menu fits`);
  for (const n of [/^Freeride/, /^Big Air/, /Wardrobe/, /Postcards/]) assert.ok(await inView(page, page.getByRole('button', { name: n })), `${name}: ${n} is on screen`);
  await page.getByRole('button', { name: /^Freeride/ }).tap();
  await page.getByRole('button', { name: /Let’s ski/ }).tap();
  await page.waitForTimeout(1200);
  const f = await framing(page);
  assert.ok(f.size >= 40, `${name}: the skier is a clear size (${f.size}px)`);
  assert.ok(f.skier.y - f.size > f.barBottom, `${name}: the bar is clear of the skier`);
  const pads = page.locator('.pp-pad');
  assert.equal(await pads.count(), 2, `${name}: touch pads`);
  const pb = await pads.first().boundingBox();
  assert.ok(pb.y > f.skier.y + 40, `${name}: the pads sit well below the skier`);
  // hold a finger to the left and below: the skier turns that way
  const c = page.locator('.pp-canvas');
  await c.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: f.skier.x - w * 0.35, clientY: f.skier.y + 60, button: 0 });
  await page.waitForTimeout(500);
  let s = await state(page); assert.ok(s.a < -0.4 || s.state !== 'ride', `${name}: a held finger steers (${s.a.toFixed(2)})`);
  await c.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: f.skier.x - w * 0.35, clientY: f.skier.y + 60, button: 0 });
  const v0 = (await state(page)).s;
  await pads.first().dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8, isPrimary: true });
  await page.waitForTimeout(600);
  s = await state(page); assert.ok(s.s < Math.max(30, v0 * 0.7) || s.state !== 'ride', `${name}: the brake pad brakes`);
  await pads.first().dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 8, isPrimary: true });
  await page.evaluate(() => window.__powderStorm(30));
  await page.getByRole('dialog', { name: 'Caught by the storm' }).waitFor({ timeout: 8000 });
  assert.ok(await inView(page, page.locator('.pp-cocoa-card')), `${name}: the cocoa card fits`);
  assert.ok(await inView(page, page.getByRole('button', { name: 'Ski again' })), `${name}: and its buttons`);
  await page.getByRole('button', { name: 'Menu' }).tap();
  await page.getByRole('button', { name: /^Slalom/ }).tap();
  assert.ok(await noScroll(page), `${name}: the course list scrolls inside, not the page`);
  await page.context().close();
}
assert.deepEqual(errors, [], 'no page errors');
await browser.close();
console.log('powder e2e ok');
