// The Arcade After Dark in the browser, with real keys and real touches, at 1280×800, a phone held upright (390×844)
// and a phone on its side (844×390): the title (Assist, Sound and Music toggles, Play by Enter or by a tap), then every
// action by key (walk with the arrows and with WASD, jump with Space and with Up, Shift to swap, E into the castle
// cabinet and the dive into it, J for Enzo's ping, K for the gust, M to mute, Esc and P to pause, the pause card's
// Resume, Title and Start over, the top-right pause pill) and the same by touch (the floating stick both ways, JUMP,
// SWAP, ACT into a cabinet and ACT as the smart ability, GUST once earned), the save under after-dark-v1, Continue
// from the hub, and the end card starting a new run. Fails on any page error or sideways scroll.
// Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves screenshots.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS;
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const ad = (page, expr) => page.evaluate((e) => { const o = window.__afterdark(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr);
const until = async (page, expr, timeout = 10000) => {
  try { await page.waitForFunction((e) => { const o = window.__afterdark(); return new Function('g', 'o', `return (${e})`)(o.game, o); }, expr, { timeout, polling: 50 }); }
  catch (e) { throw new Error(`${e.message}\n  waiting for: ${expr}\n  state: ${await ad(page, 'JSON.stringify({w: g.world, lead: g.lead, x: Math.round(g.heroes[g.lead].x), y: Math.round(g.heroes[g.lead].y), cut: g.cut && g.cut.kind, trans: g.trans && g.trans.kind, screen: o.screen, paused: o.paused})').catch(() => '?')}`); }
};
const hold = async (page, key, ms) => { await page.keyboard.down(key); await wait(ms); await page.keyboard.up(key); };
const noSideScroll = async (page, tag) => ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: no sideways scroll`);
/** a quiet spot: a fresh run, the heroes warped and settled, the camera snapped */
const place = async (page, setup, wid, x, y) => {
  await ad(page, `(${setup ? `(() => { ${setup} })(), ` : ''}o.warp(${JSON.stringify(wid)}, ${x ?? 'undefined'}, ${y ?? 'undefined'}), true)`);
  await until(page, '!g.cut && !g.trans');
  await wait(150);
};

// real touches through the DevTools protocol, so the page sees pointer events of type touch
async function touchApi(page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
  return {
    async tap(x, y, ms = 90) { await send('touchStart', [[x, y, 1]]); await wait(ms); await send('touchEnd', []); await wait(60); },
    async drag(x0, y0, dx, ms) {
      await send('touchStart', [[x0, y0, 2]]);
      for (let i = 1; i <= 4; i++) { await send('touchMove', [[x0 + dx * i / 4, y0, 2]]); await wait(16); }
      await wait(ms); await send('touchEnd', []); await wait(60);
    },
  };
}
const btn = (page, k) => ad(page, `(() => { const T = o.scene.touchLayout(); return T[${JSON.stringify(k)}] && [T[${JSON.stringify(k)}].x, T[${JSON.stringify(k)}].y]; })()`);

async function title(page, tag, touch) {
  await page.goto(`${base}/after-dark`);
  await page.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => { try { localStorage.removeItem('after-dark-v1'); } catch { /* */ } });
  await page.reload(); await page.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
  ok(await page.isVisible('text=The Arcade After Dark'), `${tag}: the title`);
  await shot(page, `${tag}-title`);
  await noSideScroll(page, tag);
  for (const [name, key] of [['Assist', 'assist'], ['Sound', 'sound'], ['Music', 'music']]) {
    await page.click(`button:has-text("${name}:")`);
    ok((await ad(page, `o.save.${key}`)) === false, `${tag}: ${name} toggles off`);
    await page.click(`button:has-text("${name}:")`);
    ok((await ad(page, `o.save.${key}`)) === true, `${tag}: and back on`);
  }
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('after-dark-v1')).v === 1), `${tag}: saved under after-dark-v1`);
  if (touch) { const b = await page.$('button[aria-label="Play"]'); const bb = await b.boundingBox(); const T = await touchApi(page); await T.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
  else await page.keyboard.press('Enter');
  await until(page, 'o.screen === "play" && g.world === "hub"');
  ok(true, `${tag}: Play starts in the hub`);
}

async function keys(page, tag) {
  // walking, both key sets
  await place(page, '', 'hub', 300, 640);
  let x0 = await ad(page, 'g.heroes[g.lead].x');
  await hold(page, 'ArrowRight', 400); ok((await ad(page, 'g.heroes[g.lead].x')) > x0 + 40, `${tag}: → walks right`);
  x0 = await ad(page, 'g.heroes[g.lead].x');
  await hold(page, 'a', 400); ok((await ad(page, 'g.heroes[g.lead].x')) < x0 - 40, `${tag}: A walks left`);
  ok((await ad(page, 'o.scheme')) === 'wasd', `${tag}: the prompts switch to WASD`);
  await hold(page, 'd', 200); ok((await ad(page, 'o.scheme')) === 'wasd', `${tag}: D walks too`);
  // jumping, Space and Up
  for (const k of ['Space', 'ArrowUp']) {
    await until(page, 'g.heroes[g.lead].ground');
    await page.keyboard.down(k); await until(page, '!g.heroes[g.lead].ground && g.heroes[g.lead].y < 600', 2000); await page.keyboard.up(k);
    ok(true, `${tag}: ${k} jumps`);
  }
  await until(page, 'g.heroes[g.lead].ground');
  // swap
  const was = await ad(page, 'g.lead');
  await page.keyboard.press('Shift'); await until(page, `g.lead !== ${JSON.stringify(was)}`, 2000); ok(true, `${tag}: Shift swaps`);
  // E into the castle cabinet: the dive
  await place(page, '', 'hub', 480, 640);
  await page.keyboard.press('e'); await until(page, 'g.trans && g.trans.kind === "dive"', 2000); ok(true, `${tag}: E dives into a cabinet`);
  await wait(500); await shot(page, `${tag}-dive`);
  await until(page, 'g.world === "castle" && !g.trans', 8000); ok(true, `${tag}: into the castle`);
  await shot(page, `${tag}-castle`);
  // J: Enzo's ping (assist swaps to him)
  await place(page, 'g.abil.ping = true; g.lead = "dora";', 'castle', 3600, 640);
  const p0 = await ad(page, 'g.stats.pings');
  await page.keyboard.press('j'); await until(page, `g.stats.pings > ${p0}`, 2000); ok(await ad(page, 'g.lead === "enzo"'), `${tag}: J pings, as Enzo`);
  await until(page, 'g.W.castle.wall.open', 4000); ok(true, `${tag}: the ping opens the hidden door`);
  // K: the gust
  await place(page, 'g.abil.ping = g.abil.sweep = g.abil.gust = true; g.W.cloud.shrine.taken = true;', 'cloud', 2950, 380);
  const k0 = await ad(page, 'g.stats.gusts');
  await page.keyboard.press('k'); await until(page, `g.stats.gusts > ${k0}`, 2000); ok(true, `${tag}: K gusts`);
  await shot(page, `${tag}-gust`);
  // M mutes, Esc and P pause
  await page.keyboard.press('m'); ok((await ad(page, 'o.save.sound')) === false, `${tag}: M mutes`);
  await page.keyboard.press('m'); ok((await ad(page, 'o.save.sound')) === true, `${tag}: M unmutes`);
  await page.keyboard.press('Escape'); await until(page, 'o.paused'); ok(await page.isVisible('text=Paused'), `${tag}: Esc pauses`);
  await shot(page, `${tag}-pause`);
  const t0 = await ad(page, 'g.time'); await wait(300); ok((await ad(page, 'g.time')) === t0, `${tag}: the game stops while paused`);
  await page.keyboard.press('Escape'); await until(page, '!o.paused'); ok(true, `${tag}: Esc resumes`);
  await page.keyboard.press('p'); await until(page, 'o.paused'); await page.click('button:has-text("Resume")'); await until(page, '!o.paused'); ok(true, `${tag}: P pauses, Resume resumes`);
}

async function pauseCard(page, tag, touch) {
  await page.click('button[aria-label="Pause"]'); await until(page, 'o.paused'); ok(true, `${tag}: the pause pill pauses`);
  await page.click('button:has-text("Title")'); await until(page, 'o.screen === "title"'); ok(true, `${tag}: Title goes back to the title`);
  // progress saved in the hub: Continue
  await ad(page, '(o.start("new", 3), true)'); await place(page, 'g.abil.ping = true; g.flags.conch = true;', 'hub', 300, 640);
  await until(page, 'o.save.progress && o.save.progress.abil.ping');
  await page.click('button[aria-label="Pause"]'); await page.click('button:has-text("Title")');
  ok(await page.isVisible('button:has-text("Continue")'), `${tag}: Continue is offered`);
  await page.click('button:has-text("Continue")'); await until(page, 'o.screen === "play" && g.abil.ping'); ok(true, `${tag}: Continue keeps the ping`);
  await page.click('button[aria-label="Pause"]'); await page.click('button:has-text("Start over")');
  await until(page, '!o.paused && !g.abil.ping'); ok(true, `${tag}: Start over`);
  // the end card, then any button starts again
  await ad(page, '(g.mode = "end", g.endT = 0, true)'); await wait(500); await shot(page, `${tag}-end`);
  await until(page, 'g.endT > 2.6', 6000);
  if (touch) { const T = await touchApi(page); const [x, y] = await btn(page, 'jump'); await T.tap(x, y); }
  else await page.keyboard.press('Enter');
  await until(page, 'g.mode === "play" && g.playT < 2'); ok(true, `${tag}: the end card starts a new run`);
}

async function touches(page, tag) {
  const T = await touchApi(page);
  await place(page, '', 'hub', 300, 640);
  const [bx, by] = await btn(page, 'base');
  let x0 = await ad(page, 'g.heroes[g.lead].x');
  await T.drag(bx, by, 60, 400); ok((await ad(page, 'g.heroes[g.lead].x')) > x0 + 40, `${tag}: the stick walks right`);
  ok((await ad(page, 'o.scheme')) === 'touch', `${tag}: touch scheme`);
  x0 = await ad(page, 'g.heroes[g.lead].x');
  await T.drag(bx, by, -60, 400); ok((await ad(page, 'g.heroes[g.lead].x')) < x0 - 40, `${tag}: and left`);
  await until(page, 'g.heroes[g.lead].ground');
  let [x, y] = await btn(page, 'jump'); await T.tap(x, y, 150); await until(page, '!g.heroes[g.lead].ground', 2000); ok(true, `${tag}: JUMP`);
  await until(page, 'g.heroes[g.lead].ground');
  const was = await ad(page, 'g.lead');
  [x, y] = await btn(page, 'swap'); await T.tap(x, y); await until(page, `g.lead !== ${JSON.stringify(was)}`, 2000); ok(true, `${tag}: SWAP`);
  await place(page, '', 'hub', 480, 640);
  [x, y] = await btn(page, 'act'); await T.tap(x, y); await until(page, 'g.trans && g.trans.kind === "dive"', 2000); ok(true, `${tag}: ACT dives into a cabinet`);
  await until(page, 'g.world === "castle" && !g.trans', 8000);
  await shot(page, `${tag}-castle`);
  await place(page, 'g.abil.ping = true; g.lead = "dora";', 'castle', 3600, 640);
  [x, y] = await btn(page, 'act'); await T.tap(x, y); await until(page, 'g.stats.pings > 0', 2000); ok(true, `${tag}: ACT is the smart ability (Enzo pings)`);
  ok((await btn(page, 'gust')) === undefined, `${tag}: no GUST button before the gust`);
  await place(page, 'g.abil.ping = g.abil.sweep = g.abil.gust = true; g.W.cloud.shrine.taken = true;', 'cloud', 2950, 380);
  await wait(100);
  const gb = await btn(page, 'gust'); ok(gb, `${tag}: the GUST button appears`);
  const k0 = await ad(page, 'g.stats.gusts'); await T.tap(gb[0], gb[1]); await until(page, `g.stats.gusts > ${k0}`, 2000); ok(true, `${tag}: GUST`);
  await shot(page, `${tag}-cloud`);
  await noSideScroll(page, tag);
}

for (const [tag, W, H, touch] of [['desktop', 1280, 800, false], ['portrait', 390, 844, true], ['landscape', 844, 390, true]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await title(page, tag, touch);
  if (touch) await touches(page, tag);
  await keys(page, tag);
  await pauseCard(page, tag, touch);
  await page.close();
}
await browser.close();
assert.deepEqual(errors, [], 'no page errors');
console.log(`afterdark e2e: ${checks} checks ok`);
