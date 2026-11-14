// Jade Street in the browser, with real clicks, taps, touch drags and keys, at 1280×800, 390×844 (phone upright,
// touch) and 844×390 (phone on its side, touch): the title (New game, the hero pick, Continue, and both answers to the
// start-over check), the intro dialogue, moving with keys or the touch stick, run, sneak, dash and hop, talking to a
// contact and starting a job, the job HUD, the full map (drop a pin, clear it, M to open and close), pause (Story,
// Settings with every control, Trophies, Stats, Quit this job, Save and quit to title, New game with both answers),
// getting on a scooter, riding it, boost and honk, getting off, jump-starting a locked scooter through the wires
// mini-game, the lock, wok and dumpling mini-games played with mouse, touch or keys, Give up, the market (haggle,
// Buy, Max, Sell, All), the safe house (jacket swap, both heroes, an outfit, stash and take, sleep), the garage (every
// upgrade and a paint), and the failure card (Retry and Quit job). On every screen it checks for sideways scroll and
// for text that is too faint to read against its own backing. Fails on any failed check, page error or console
// error. Needs `npm run dev` (or BASE_URL) and Playwright. SHOTS=<dir> saves a screenshot of every screen.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(process.cwd() + '/')('playwright')); }

const base = (process.env.BASE_URL ?? 'http://localhost:3000') + '/jade-street';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const results = []; const errs = [];
const check = (ok, what) => { results.push([!!ok, what]); if (!ok) console.log('  FAIL', what); };

// text against the colour it actually sits on: walks up to the first opaque backing; text over a painting or the
// canvas (no knowable backing) is skipped
const CONTRAST = () => {
  const px = s => (s.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = el => {
    let acc = null;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = px(cs.backgroundColor), a = c.length === 4 ? c[3] : 1;
      if (a > 0.001) { const rgb = c.slice(0, 3); acc = acc ? { rgb: acc.rgb.map((v, i) => v * acc.a + rgb[i] * (1 - acc.a)), a: acc.a + a * (1 - acc.a) } : { rgb, a }; if (acc.a >= 0.9) return acc.rgb; }
      if (cs.backgroundImage !== 'none' || n.tagName === 'CANVAS') return null;
      if (n.classList.contains('jade-stage') || n.tagName === 'MAIN') return null;
    }
    return null;
  };
  const bad = []; let n = 0;
  for (const el of document.querySelectorAll('.jade-shell *')) {
    if (![...el.childNodes].some(t => t.nodeType === 3 && t.textContent.trim())) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || +cs.opacity < 0.2 || r.bottom < 0 || r.top > innerHeight) continue;
    if (el.closest('button:disabled, [aria-disabled="true"], .locked')) continue;
    const bg = bgOf(el); if (!bg) continue;
    const fg = px(cs.color); const k = ratio(fg.slice(0, 3), bg); n++;
    const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
    if (k < (large ? 3 : 4.5)) bad.push(`"${el.textContent.trim().slice(0, 30)}" ${k.toFixed(2)}:1`);
  }
  return { n, bad };
};

async function viewport(name, w, h, touch) {
  console.log(`${name} ${w}×${h}${touch ? ' (touch)' : ''}`);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const cdp = touch ? await ctx.newCDPSession(p) : null;
  p.on('pageerror', e => { errs.push(`${name}: ${e.message}`); console.log('  PAGE ERROR', e.message); });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) { errs.push(`${name} console: ${m.text()}`); console.log('  CONSOLE ERROR', m.text()); } });
  const shot = async n => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}-${n}.png` }); };
  const look = async where => {
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1), `${name} ${where}: no sideways scroll`);
    const c = await p.evaluate(CONTRAST);
    check(!c.bad.length, `${name} ${where}: readable text (${c.n} checked)${c.bad.length ? ': ' + c.bad.slice(0, 4).join(', ') : ''}`);
    await shot(where.replace(/\W+/g, '-'));
  };
  const loc = tid => p.locator(`[data-testid="${tid}"]`).first();
  const appear = tid => p.waitForSelector(`[data-testid="${tid}"]`, { timeout: 3000 }).then(() => true, () => false);
  const exists = async tid => (await p.locator(`[data-testid="${tid}"]`).count()) > 0;
  // a press the way this player would: a tap on touch, a click with the mouse
  const press = async tid => { const l = loc(tid); await l.scrollIntoViewIfNeeded(); if (touch) await l.tap(); else await l.click(); await p.waitForTimeout(140); };
  const screen = () => p.evaluate(() => document.querySelector('main').dataset.screen);
  const st = () => p.evaluate(() => window.__jade.state());
  const W = (f, a) => p.evaluate(f, a);
  const wait = ms => p.waitForTimeout(ms);
  const until = (f, a, timeout = 8000) => p.waitForFunction(f, a, { timeout, polling: 'raf' }).then(() => true, () => false);
  // touch: a finger down, dragged, held and lifted (CDP), so the stick and held pins get real touch events
  let held = null; // the finger on the stick, while it is down
  const touchAt = (type, x, y) => { held = type === 'touchEnd' ? null : { x, y, id: 1 }; return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: held ? [held] : [] }); };
  // a second finger taps a button while the first stays on the stick (how you dash or honk while steering)
  const tapWithSecond = async tid => {
    const r = await loc(tid).boundingBox(); const f2 = { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: held ? [held, f2] : [f2] }); await wait(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: held ? [f2] : [] });
    await wait(60);
  };
  const drag = async (x0, y0, dx, dy, ms) => { await touchAt('touchStart', x0, y0); for (let i = 1; i <= 5; i++) { await touchAt('touchMove', x0 + dx * i / 5, y0 + dy * i / 5); await wait(16); } await wait(ms); await touchAt('touchEnd', 0, 0); };
  const tapAt = async (x, y) => { if (touch) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y); };
  // the act button: E on a keyboard, the Action button on touch
  const act = async () => { await until(() => !window.__jade.world().p.act, null, 3000); if (touch) await press('t-act'); else { await p.keyboard.press('e'); await wait(120); } };
  const settle = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; window.__jade.play.bump(); });
  const diag = () => W(() => { const w = window.__jade.world(); return JSON.stringify({ near: w.near?.kind, act: w.p.act?.n, ui: w.ui?.kind, ride: w.p.ride?.kind, talk: !!w.talk, paused: window.__jade.play.paused, x: Math.round(w.p.x / 64), y: Math.round(w.p.y / 64), anim: w.p.anim }); });
  const placeBy = (x, y) => W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.findNear(); }, [x, y]);
  // stand beside a parked ride that matches, out of the traffic, and look for the Get on prompt
  const byRide = (want) => W(want => {
    const J = window.__jade, w = J.world();
    const r = w.rides.find(r => r.parked && r.kind === want.kind && !!r.locked === want.locked && w.open.has(w.districtAt ? w.districtAt(r.b.x, r.b.y) : 'market') && r.b.x < 46 * 64 && r.b.y > 36 * 64);
    if (!r) return false; w.placePlayer(r.b.x + 34, r.b.y); w.cars = []; w.findNear(); return w.near?.kind === 'ride';
  }, want);

  await p.goto(base, { waitUntil: 'networkidle', timeout: 120000 });
  await p.waitForSelector('main[data-ready="true"]', { timeout: 60000 });
  await W(() => localStorage.removeItem('jade-street-v2')); await p.reload(); await p.waitForSelector('main[data-ready="true"]');

  // ── the title: a new player, the hero pick
  check(await screen() === 'title', `${name}: opens on the title`);
  check(!(await exists('continue')), `${name}: no Continue for a new player`);
  check((await p.locator('.jade-back').getAttribute('href')) === '/', `${name}: the title links back to the arcade`);
  await look('title');
  await press('new'); check(await exists('pick-hero'), `${name}: New game asks who starts`); await look('hero pick');
  await press('pick-enzo');
  check(await screen() === 'game', `${name}: picking a hero starts the game`);
  await until(() => window.__jade?.world().s.hero === 'enzo');
  check((await W(() => window.__jade.world().s.hero)) === 'enzo', `${name}: Enzo is out tonight`);
  check(await W(() => window.__jade.world().s.settings.assist), `${name}: Assist is on by default`);
  check(await exists('hud') && await exists('cash'), `${name}: the HUD shows`);
  check(await exists('dialogue'), `${name}: the intro dialogue opens`); await look('intro');
  // advance the dialogue: tap it, or Space
  for (let i = 0; i < 4 && await exists('dialogue'); i++) { if (touch) await press('dialogue'); else { await p.keyboard.press(' '); await wait(150); } }
  check(!(await exists('dialogue')), `${name}: the dialogue advances and closes`);
  check(await exists(touch ? 'stick' : 'hud'), `${name}: ${touch ? 'the touch stick shows' : 'the HUD stays'}`);
  await W(() => window.__jade.teleport(20, 47));
  await wait(200);

  // ── moving on foot
  const x0 = (await st()).x;
  if (touch) { const r = await loc('stick').boundingBox(); await drag(r.x + r.width * 0.3, r.y + r.height * 0.7, 70, 0, 600); }
  else { await p.keyboard.down('d'); await wait(600); await p.keyboard.up('d'); }
  check((await st()).x > x0 + 1.5, `${name}: ${touch ? 'the stick' : 'D'} moves the hero (${x0.toFixed(1)} → ${(await st()).x.toFixed(1)})`);
  const anims = new Set();
  const watch = async (ms) => { const t = Date.now(); while (Date.now() - t < ms) { anims.add(await W(() => window.__jade.world().p.anim)); await wait(20); } };
  if (touch) {
    const r = await loc('stick').boundingBox();
    await touchAt('touchStart', r.x + r.width * 0.3, r.y + r.height * 0.7); await touchAt('touchMove', r.x + r.width * 0.3 - 70, r.y + r.height * 0.7);
    await watch(300); await tapWithSecond('t-dash'); await watch(250); await tapWithSecond('t-hop'); await watch(300);
    await tapWithSecond('t-sneak'); await watch(400); await tapWithSecond('t-sneak');
    await touchAt('touchEnd', 0, 0);
  } else {
    await p.keyboard.down('a'); await watch(300); await p.keyboard.press(' '); await watch(250); await p.keyboard.press('q'); await watch(300);
    await p.keyboard.down('Shift'); await watch(400); await p.keyboard.up('Shift'); await p.keyboard.up('a');
  }
  for (const a of ['run', 'dash', 'hop', 'sneak']) check(anims.has(a), `${name}: ${a} on foot (${[...anims].join(' ')})`);
  await wait(300); check((await W(() => window.__jade.world().p.anim)) === 'idle', `${name}: idle when the stick is let go ${await diag()} ${JSON.stringify(await W(() => [window.__jade.play.stick, window.__jade.play.touchSneak]))}`);

  // ── a contact: talk, start the first job
  await W(() => window.__jade.teleportTo('kee')); await W(() => window.__jade.world().findNear());
  await wait(200);
  check(await appear('prompt'), `${name}: a prompt by Uncle Kee`); await look('prompt');
  await act();
  check(await appear('dialogue'), `${name}: talking to Uncle Kee`); await look('dialogue');
  for (let i = 0; i < 8 && await exists('dialogue'); i++) { if (touch) await press('dialogue'); else { await p.keyboard.press('e'); await wait(150); } }
  const run = (await st()).run;
  check(run && run.id === 'm1', `${name}: the first job starts (${JSON.stringify(run)})`);
  check(await exists('job') && await exists('objective'), `${name}: the job and objective show`); await look('job');

  // ── pause and every tab
  await press('pause-btn'); check(await exists('pause'), `${name}: pause opens`); await look('pause');
  await press('tab-story'); await look('pause story'); await press('close');
  await press('tab-settings'); await look('settings');
  const set = () => W(() => window.__jade.world().s.settings);
  await press('set-assist'); check((await set()).assist === false, `${name}: Assist off`); await press('set-assist'); check((await set()).assist === true, `${name}: Assist back on`);
  await loc('set-diff').selectOption('normal'); check((await set()).diff === 'normal', `${name}: Normal difficulty`); await loc('set-diff').selectOption('easy');
  await press('set-sound'); check((await set()).sound === false, `${name}: sound off`); await press('set-sound');
  await press('set-music'); check((await set()).music === false, `${name}: music off`); await press('set-music');
  await loc('set-touch').selectOption(touch ? 'off' : 'on'); await wait(150);
  check((await p.evaluate(() => document.querySelector('main').dataset.touch)) === (touch ? 'false' : 'true'), `${name}: the touch-controls setting switches them`);
  await loc('set-touch').selectOption('auto'); await press('close');
  await press('tab-trophies'); check(await exists('trophies'), `${name}: trophies`); await look('trophies'); await press('close');
  await press('tab-stats'); check(await exists('stats'), `${name}: stats`); await look('stats'); await press('close');
  await press('abandon'); check(!(await st()).run && !(await exists('pause')), `${name}: Quit this job`);
  if (!touch) { await p.keyboard.press('Escape'); check(await exists('pause'), `${name}: Esc pauses`); await p.keyboard.press('Escape'); check(!(await exists('pause')), `${name}: Esc resumes`); }
  else { await press('pause-btn'); await press('resume'); check(!(await exists('pause')), `${name}: Resume`); }

  // ── the map (a pin only off the job: on a job the map shows the job's route)
  await press('map-btn'); check(await exists('map'), `${name}: the map opens`);
  check(await W(() => window.__jade.play.paused), `${name}: the map pauses the city`);
  const mc = await loc('map-canvas').boundingBox();
  const ms = Math.min(mc.width / 120, mc.height / 92); // the city is 120×92 tiles, letterboxed in the canvas
  await tapAt(mc.x + (mc.width - 120 * ms) / 2 + 24 * ms, mc.y + (mc.height - 92 * ms) / 2 + 50 * ms); await wait(150);
  check(await W(() => !!window.__jade.world().waypoint), `${name}: a tap on the map drops a pin`); await look('map');
  await press('clear-pin'); check(await W(() => !window.__jade.world().waypoint), `${name}: Clear pin`);
  await press('close'); check(!(await exists('map')) && !(await W(() => window.__jade.play.paused)), `${name}: closing the map resumes`);
  if (!touch) { await p.keyboard.press('m'); check(await exists('map'), `${name}: M opens the map`); await p.keyboard.press('m'); check(!(await exists('map')), `${name}: M closes it`); }

  // ── a scooter: on, ride, boost, honk, off
  check(await byRide({ kind: 'scooter', locked: false }), `${name}: standing by a parked scooter`); await wait(150);
  await act(); await until(() => window.__jade.world().p.ride?.kind === 'scooter', null, 3000);
  check((await st()).ride === 'scooter', `${name}: get on the scooter`);
  const r0 = await st();
  if (touch) { const r = await loc('stick').boundingBox(); await touchAt('touchStart', r.x + r.width * 0.3, r.y + r.height * 0.7); await touchAt('touchMove', r.x + r.width * 0.3, r.y + r.height * 0.7 - 70); await wait(500); await tapWithSecond('t-dash'); await wait(120); }
  else { await p.keyboard.down('w'); await wait(500); await p.keyboard.press(' '); await wait(120); }
  check(await W(() => window.__jade.world().p.boostT > 0 || window.__jade.world().p.boostCd > 0), `${name}: boost`);
  await W(() => { const w = window.__jade.world(); w.honks = 0; const o = w.honk.bind(w); w.honk = () => { w.honks++; o(); }; });
  if (touch) await tapWithSecond('t-hop'); else await p.keyboard.press('q');
  await wait(100); check(await W(() => window.__jade.world().honks > 0), `${name}: honk`);
  await wait(300); await look('riding');
  if (touch) await touchAt('touchEnd', 0, 0); else await p.keyboard.up('w');
  const r1 = await st(); check(Math.hypot(r1.x - r0.x, r1.y - r0.y) > 2, `${name}: the scooter drives (${JSON.stringify([r0.x, r0.y, r1.x, r1.y])}) ${await diag()}`);
  await wait(900); await act(); await until(() => !window.__jade.world().p.ride, null, 3000);
  check(!(await st()).ride, `${name}: get off`);

  // ── a locked scooter: jump-start it in the wires mini-game
  const locked = await byRide({ kind: 'scooter', locked: true });
  if (!locked) await W(() => { const w = window.__jade.world(); const r = w.rides.find(r => r.parked && r.kind === 'scooter' && r.b.x < 46 * 64 && r.b.y > 36 * 64); r.locked = true; w.placePlayer(r.b.x + 34, r.b.y); w.findNear(); });
  await wait(150); await act(); await until(() => !!document.querySelector('[data-testid="mini-wires"]'), null, 2000);
  check(await exists('mini-wires'), `${name}: a locked scooter asks to be jump-started (${JSON.stringify(await W(() => { const w = window.__jade.world(); return [w.near?.kind, w.p.act?.n, w.ui?.kind, w.p.ride?.kind]; }))})`); await wait(500); await look('wires');
  if (touch || name === 'desktop') {
    const order = await W(() => window.__jadeMini.g().right);
    for (let l = 0; l < 4; l++) {
      const a = await W(([x, y]) => window.__jadeMini.at(x, y), [410, [277, 385, 495, 605][l]]);
      const z = await W(([x, y]) => window.__jadeMini.at(x, y), [882, [277, 385, 495, 605][order.indexOf(l)]]);
      if (name === 'desktop') { await p.keyboard.press(String(l + 1)); await p.keyboard.press(String(order.indexOf(l) + 1)); }
      else { await tapAt(a[0], a[1]); await tapAt(z[0], z[1]); }
      await wait(80);
    }
    check(await W(() => window.__jadeMini.g().links.every(x => x !== null)), `${name}: every wire joined ${name === 'desktop' ? 'with the number keys' : 'by tapping'}`);
    const k = await W(() => window.__jadeMini.at(640, 690));
    if (name === 'desktop') await p.keyboard.press('Enter'); else await tapAt(k[0], k[1]);
  }
  check(await until(() => window.__jade.world().p.ride?.kind === 'scooter', null, 6000), `${name}: the key turns and you ride off`);
  await W(() => { const w = window.__jade.world(); w.exit(); window.__jade.play.bump(); });

  // ── the lock: hold a pin until it glows gold, let go (mouse, touch, or Space)
  await W(() => { const w = window.__jade.world(); w.ui = { kind: 'mini', mini: 'lock', level: 1, from: 'test' }; window.__jade.play.bump(); });
  await until(() => !!window.__jadeMini); await wait(400); await look('lock');
  for (let tries = 0; tries < 14 && !(await W(() => window.__jadeMini?.g().done)); tries++) {
    const i = await W(() => window.__jadeMini.g().sel); const [x, y] = await W(([x, y]) => window.__jadeMini.at(x, y), [[455, 595, 735, 872][i], 400]);
    if (touch) await touchAt('touchStart', x, y); else if (name === 'desktop' && tries % 2) await p.keyboard.down(' '); else { await p.mouse.move(x, y); await p.mouse.down(); }
    await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000);
    if (touch) await touchAt('touchEnd', 0, 0); else if (name === 'desktop' && tries % 2) await p.keyboard.up(' '); else await p.mouse.up();
    await wait(150);
  }
  check(await until(() => !window.__jadeMini || window.__jadeMini.g().done, null, 3000), `${name}: the lock opens by ${touch ? 'touch' : 'mouse and Space'}`);
  await until(() => !document.querySelector('[data-testid="mini-lock"]'), null, 4000); await settle();

  // ── the wok: slide it, toss it
  await W(() => { const w = window.__jade.world(); w.ui = { kind: 'mini', mini: 'wok', level: 1, from: 'test' }; window.__jade.play.bump(); });
  await until(() => !!window.__jadeMini); await wait(400);
  const wx0 = await W(() => window.__jadeMini.g().x);
  if (touch) { const [x, y] = await W(() => window.__jadeMini.at(300, 650)); await drag(x, y, -40, 0, 100); }
  else if (name === 'desktop') { await p.keyboard.down('ArrowLeft'); await wait(400); await p.keyboard.up('ArrowLeft'); }
  check(Math.abs((await W(() => window.__jadeMini.g().x)) - wx0) > 0.05, `${name}: the wok slides by ${touch ? 'touch' : 'key'}`);
  await press('wok-toss'); check(await W(() => window.__jadeMini.g().tossT > 0), `${name}: Toss!`);
  if (!touch) { await wait(600); await p.keyboard.press(' '); check(await W(() => window.__jadeMini.g().tossT > 0), `${name}: Space tosses`); }
  await look('wok');
  await press('mini-quit'); check(await until(() => !document.querySelector('[data-testid="mini-wok"]'), null, 4000), `${name}: Give up leaves the mini-game`);
  await settle();

  // ── dumplings: drop the filling, pinch
  await W(() => { const w = window.__jade.world(); w.ui = { kind: 'mini', mini: 'dumpling', level: 1, from: 'test' }; window.__jade.play.bump(); });
  await until(() => !!window.__jadeMini); await wait(300);
  await press('fold'); check(await W(() => window.__jadeMini.g().phase === 'pleat'), `${name}: Pinch! drops the filling`);
  const pl0 = await W(() => window.__jadeMini.g().pleats + window.__jadeMini.g().bad);
  if (touch) { const [x, y] = await W(() => window.__jadeMini.at(640, 400)); await p.touchscreen.tap(x, y); } else await p.keyboard.press(' ');
  check((await W(() => window.__jadeMini.g().pleats + window.__jadeMini.g().bad)) > pl0 || (await W(() => window.__jadeMini.g().phase)) !== 'pleat', `${name}: ${touch ? 'a tap' : 'Space'} pinches`);
  await look('dumpling'); await press('mini-quit'); await settle();

  // ── the market
  await W(() => window.__jade.cash(2000));
  await W(() => window.__jade.teleportTo('mk-market')); await W(() => window.__jade.world().findNear()); await wait(150);
  await act(); check(await appear('market'), `${name}: the market opens ${await diag()}`); await look('market');
  const cash = () => W(() => window.__jade.world().s.cash), cargo = g => W(g => window.__jade.world().s.cargo[g], g);
  await press('haggle'); await wait(500); await press('haggle-stop'); check(await exists('haggle-grade'), `${name}: haggle`);
  let c0 = await cash(); await press('buy-tea'); check((await cargo('tea')) === 1 && (await cash()) < c0, `${name}: Buy`);
  await press('buymax-mango'); check((await cargo('mango')) >= 1, `${name}: Max`);
  c0 = await cash(); await press('sell-tea'); check((await cargo('tea')) === 0 && (await cash()) > c0, `${name}: Sell`);
  await press('sellall-mango'); check((await cargo('mango')) === 0, `${name}: All`);
  await press('buy-fan'); await press('close'); check(!(await exists('market')), `${name}: close the market`);

  // ── the safe house
  await W(() => window.__jade.teleportTo('safe-market')); await W(() => window.__jade.world().findNear()); await wait(150);
  await act(); check(await appear('safe'), `${name}: the safe house opens`); await look('safe house');
  await press('swap'); check(await until(() => window.__jade.world().p.act?.n === 'swap' || window.__jade.world().p.anim === 'swap', null, 2000), `${name}: swap jackets plays the swap`);
  check(!(await exists('safe')), `${name}: the swap closes the safe house so you see it`);
  await act(); check(await appear('safe'), `${name}: back into the safe house`);
  await press('hero-dora'); check((await W(() => window.__jade.world().s.hero)) === 'dora', `${name}: switch to Dora`);
  await press('hero-enzo'); check((await W(() => window.__jade.world().s.hero)) === 'enzo', `${name}: back to Enzo`);
  await W(() => { window.__jade.world().s.rep.market = 25; window.__jade.play.bump(); }); await wait(150);
  await press('outfit-midnight'); check((await W(() => window.__jade.world().s.outfit.enzo)) === 'midnight', `${name}: buy and wear an outfit`);
  await press('stash-fan'); check((await W(() => window.__jade.world().s.stash.fan)) === 1, `${name}: stash`);
  await press('take-fan'); check((await cargo('fan')) === 1, `${name}: take`);
  const night = await W(() => window.__jade.world().s.night); await press('sleep');
  check((await W(() => window.__jade.world().s.night)) === night + 1, `${name}: sleep till the next night`);
  await settle();

  // ── the garage
  await W(() => window.__jade.cash(5000));
  await W(() => window.__jade.teleportTo('garage-market')); await W(() => window.__jade.world().findNear()); await wait(150);
  await act(); check(await appear('garage'), `${name}: the garage opens`); await look('garage');
  for (const u of ['speed', 'grip', 'cargo']) { await press('up-' + u); check((await W(u => window.__jade.world().s.upgrades[u], u)) === 1, `${name}: upgrade ${u}`); }
  await press('paint-jade'); check((await W(() => window.__jade.world().s.paint)) === 'jade', `${name}: paint`);
  await press('close');

  // ── failing a job: Retry, then Quit job
  await W(() => window.__jade.jumpTo('m2')); await wait(200); await act();
  for (let i = 0; i < 8 && await exists('dialogue'); i++) { if (touch) await press('dialogue'); else { await p.keyboard.press(' '); await wait(120); } }
  await settle(); check(!!(await st()).run, `${name}: the second job starts`);
  await W(() => window.__jade.world().fail('A test failure.')); await wait(200);
  check(await appear('fail'), `${name}: the failure card`); await look('fail');
  await press('retry'); check(!(await exists('fail')) && !!(await st()).run, `${name}: Retry from the checkpoint`);
  await settle(); await W(() => window.__jade.world().fail('Again.')); await wait(200);
  await press('quit-job'); check(!(await st()).run, `${name}: Quit job`);

  // ── back to the title, Continue, and both answers to starting over
  await press('pause-btn'); await press('to-title'); check(await screen() === 'title', `${name}: Save and quit to title`);
  check(await exists('continue'), `${name}: Continue on the title`);
  await press('new'); check(await exists('confirm-new'), `${name}: New game asks first`); await look('confirm new');
  await press('confirm-no'); check(await exists('continue'), `${name}: Keep my game`);
  await press('continue'); check(await screen() === 'game' && (await W(() => window.__jade.world().s.night)) === night + 1, `${name}: Continue picks up the saved game`);
  await settle(); await press('pause-btn'); await press('new-game'); check(await exists('confirm-new'), `${name}: New game from pause asks first`);
  await press('confirm-no'); await press('new-game'); await press('confirm-yes'); check(await exists('pick-hero'), `${name}: Yes, start over goes to the hero pick`);
  await press('pick-dora'); await until(() => window.__jade?.world().s.hero === 'dora');
  check((await W(() => window.__jade.world().s.done.length)) === 0 && (await W(() => window.__jade.world().s.night)) === 1, `${name}: a fresh game`);
  await ctx.close();
}

await viewport('desktop', 1280, 800, false);
await viewport('phone', 390, 844, true);
await viewport('phone-wide', 844, 390, true);
await b.close();
const bad = results.filter(r => !r[0]);
console.log(`jade street e2e: ${results.length - bad.length}/${results.length} checks passed, ${errs.length} page errors`);
if (bad.length || errs.length) process.exit(1);
