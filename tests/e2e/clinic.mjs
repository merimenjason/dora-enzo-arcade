// Burrow Clinic in a real browser: every player action through the real buttons, keys and canvas. Covers:
// - the title, the map and its locks (a locked clinic and the Sandbox say why), and opening a clinic;
// - all six tutorial steps, building every room type in clinic 1, and drawing a room by dragging;
// - rotating (button and R), cancelling (button, right-click and Escape), a refused placement showing its reason;
// - placing a decoration, hiring and firing, and dragging a staff member into a room (plus the Pick up button and a
//   refused drop);
// - pausing and every speed (buttons and keys), and accepting and declining an emergency;
// - the patient, staff and room info cards, Look closer, Move door and selling;
// - meeting the goals (the debug hook fast-forwards), the stars, back to the map, and the next clinic unlocked;
// - settings and the mute button, the save surviving a reload (and Continue), and a corrupt save;
// - phone landscape and portrait with no sideways scroll, every button on screen, and no page errors.
// Needs `npm run dev` running and Playwright.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3000';
const KEY = 'burrow-clinic-v1';
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

async function open(viewport, save) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${viewport.width}x${viewport.height}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${viewport.width}x${viewport.height} console: ${m.text()}`); });
  if (save !== undefined) await page.addInitScript(([k, s]) => { if (!sessionStorage.getItem('hc-seeded')) { localStorage.setItem(k, s); sessionStorage.setItem('hc-seeded', '1'); } }, [KEY, save]);
  await page.goto(`${base}/clinic`);
  await page.locator('main[data-ready="true"]').waitFor({ timeout: 60000 });
  return { ctx, page };
}
/** the hook, without its functions */
const hc = (page) => page.evaluate(() => { const h = window.__clinic(); return JSON.parse(JSON.stringify({ ...h, debug: undefined })); });
const dbg = (page, name, ...args) => page.evaluate(([n, a]) => window.__clinic().debug[n](...a), [name, args]);
const until = async (page, fn, arg, timeout = 8000) => {
  try { await page.waitForFunction(fn, arg, { timeout }); }
  catch (e) { const h = await hc(page).catch(() => null); throw new Error(`waited in vain for ${fn.toString()} (screen ${h?.screen}, panel ${h?.panel}, build ${h?.build}, deco ${h?.deco}, ghost ${JSON.stringify(h?.ghost)}, news "${h?.news}")`, { cause: e }); }
};
const noSideways = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
const tutStep = (page, n) => until(page, (k) => window.__clinic().state?.tut === k, n);
async function buildByUi(page, kind) {
  const h = await hc(page);
  if (h.panel !== 'build') await page.click('[data-tool="build"]');
  await page.click(`[data-room="${kind}"]`);
  await until(page, (k) => window.__clinic().build === k && window.__clinic().ghost?.ok, kind);
  const n = (await hc(page)).state.rooms.length;
  await page.click('[data-act="place"]');
  await until(page, (m) => window.__clinic().state.rooms.length === m, n + 1);
}
async function hireByUi(page, role) {
  const h = await hc(page);
  if (h.panel !== 'hire') await page.click('[data-tool="hire"]');
  const n = (await hc(page)).state.staff.length;
  await page.locator(`.hc-cand[data-role="${role}"] [data-act="hire"]`).first().click();
  await until(page, (m) => window.__clinic().state.staff.length === m, n + 1);
  return (await hc(page)).state.staff.at(-1);
}
/** page coordinates where a click picks the wanted thing (searching around a tile) */
async function spotFor(page, want, x, y) {
  for (const up of [0, -12, -24, -36, -48, 8]) for (const side of [0, -10, 10]) {
    const p = await dbg(page, 'screenOf', x, y);
    const q = { x: p.x + side, y: p.y + up };
    const got = await dbg(page, 'pickAt', q.x, q.y);
    if (got && got.type === want.type && got.id === want.id) return q;
  }
  return null;
}
async function roomSpot(page, room) {
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) { const s = await spotFor(page, { type: 'room', id: room.id }, x, y); if (s) return s; }
  return null;
}

try {
  // ------------------------------------------------------------ desktop: a first visit, start to finish
  {
    const vp = { width: 1280, height: 800 };
    const { ctx, page } = await open(vp);
    ok(await page.getByRole('heading', { name: 'Burrow Clinic' }).isVisible(), 'the title shows the logo');
    eq((await hc(page)).screen, 'title', 'the title screen first');
    await page.click('[data-act="play"]');
    await page.getByRole('heading', { name: 'The Andes Road' }).waitFor();
    eq((await hc(page)).screen, 'map', 'Play opens the map');

    // locks explain themselves
    await page.click('[data-clinic="salt"]');
    ok(/Meet the goals at Burrow Clinic to open Salt Flat/.test(await page.locator('[data-lock="salt"]').innerText()), 'a locked clinic says why');
    await page.click('[data-act="start"]', { force: true });
    eq((await hc(page)).screen, 'map', 'and its Start button does not open it');
    await page.click('[data-act="sandbox"]');
    ok(/Sandbox opens once you meet the goals at Salt Flat/.test(await page.locator('[data-lock="sandbox"]').innerText()), 'the Sandbox lock says why');

    // open the first clinic
    await page.click('[data-clinic="burrow"]');
    await page.click('[data-act="start"]');
    await until(page, () => window.__clinic().screen === 'clinic');
    let h = await hc(page);
    eq([h.clinic, h.state.tut, h.state.open], ['burrow', 0, false], 'Burrow Clinic opens closed, at tutorial step 1');
    ok(await page.locator('[data-tut="0"]').isVisible(), 'Enzo’s first note shows');

    // ---- the tutorial, through the real buttons
    await page.locator('[data-tool="build"].hc-hl').waitFor({ timeout: 4000 }); ok(true, 'step 1 highlights Build');
    await page.click('[data-tool="build"]');
    await page.locator('[data-room="reception"].hc-hl').waitFor({ timeout: 4000 }); ok(true, 'then the Reception card');
    await page.click('[data-room="reception"]');
    await page.locator('[data-act="place"].hc-hl').waitFor({ timeout: 4000 }); ok(true, 'then the place button');
    ok(/Try here/.test(await page.locator('.hc-ghost-why').innerText()), 'the assist suggests a spot');
    await page.click('[data-act="place"]');
    await tutStep(page, 1);
    ok(true, 'step 1: Reception built');
    await page.locator('[data-tool="hire"].hc-hl').waitFor({ timeout: 4000 }); ok(true, 'step 2 highlights Hire');
    await hireByUi(page, 'recep');
    await tutStep(page, 2);
    ok(true, 'step 2: a receptionist hired');
    await buildByUi(page, 'checkup');
    await tutStep(page, 3);
    ok(true, 'step 3: a Check-up Room built');
    await hireByUi(page, 'vet');
    await tutStep(page, 4);
    ok(true, 'step 4: a vet hired');
    await buildByUi(page, 'fluff');
    await tutStep(page, 5);
    h = await hc(page);
    ok(h.state.open && h.state.patients.length >= 1 && h.state.patients[0].sp === 'pudu', 'step 5: a Fluff-Dryer, and the doors open for the first pudú');
    for (let i = 0; i < 10 && (await hc(page)).state.tut < 6; i++) await dbg(page, 'run', 300);
    await tutStep(page, 6);
    ok((await hc(page)).state.cures >= 1, 'step 6: the first patient is cured');

    // ---- every room type in clinic 1
    await buildByUi(page, 'staff');
    await buildByUi(page, 'hiccup');
    h = await hc(page);
    eq([...new Set(h.state.rooms.map((r) => r.kind))].sort(), ['checkup', 'fluff', 'hiccup', 'reception', 'staff'], 'every room type in Burrow Clinic built');
    await dbg(page, 'coins', 6000);

    // ---- rotate, cancel, a refused placement, drawing a room
    await page.click('[data-room="checkup"]');
    let g0 = (await hc(page)).ghost;
    await page.click('[data-act="rotate"]');
    let g1 = (await hc(page)).ghost;
    ok(g1.rot === (g0.rot + 1) % 4, 'the rotate button turns the ghost');
    await page.keyboard.press('r');
    ok((await hc(page)).ghost.rot === (g1.rot + 1) % 4, 'and so does R');
    await page.click('[data-act="cancel"]');
    eq((await hc(page)).build, null, 'the cancel button cancels');
    const rec = (await hc(page)).state.rooms.find((r) => r.kind === 'reception');
    await page.click('[data-room="checkup"]');
    const on = await dbg(page, 'screenOf', rec.x + 1, rec.y + 1);
    await page.mouse.click(on.x, on.y);
    g1 = (await hc(page)).ghost;
    ok(!g1.ok && /overlaps the Reception/.test(g1.reason), `the ghost turns red over another room (${g1.reason})`);
    ok(/Can’t go here: That overlaps the Reception/.test(await page.locator('.hc-ghost-why').innerText()), 'and the reason is on screen');
    const nRooms = (await hc(page)).state.rooms.length;
    await page.click('[data-act="place"]');
    ok(/overlaps the Reception/.test((await hc(page)).news), 'placing there says why not');
    eq((await hc(page)).state.rooms.length, nRooms, 'and builds nothing');
    const cv = await page.locator('.hc-canvas').boundingBox();
    await page.mouse.click(cv.x + cv.width / 2, cv.y + cv.height / 2, { button: 'right' });
    eq((await hc(page)).build, null, 'right-click cancels');
    // drag out a room
    await page.click('[data-room="checkup"]');
    const free = await page.evaluate(() => { const s = window.__clinic().state; return s; });
    void free;
    const a = await dbg(page, 'screenOf', 6, 5), b = await dbg(page, 'screenOf', 9, 7);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    g1 = (await hc(page)).ghost;
    eq([g1.x, g1.y, g1.w, g1.h], [6, 5, 4, 3], 'dragging on the floor draws the room');
    await page.keyboard.press('Escape');
    eq((await hc(page)).build, null, 'Escape cancels');

    // ---- a decoration
    await page.click('[data-tool="decor"]');
    await page.click('[data-deco="bench"]');
    await until(page, () => window.__clinic().ghost?.ok);
    await page.click('[data-act="place"]');
    await until(page, () => window.__clinic().state.decos.some((d) => d.kind === 'bench'));
    ok(true, 'a bench placed');
    await page.click('[data-deco="vending"]', { force: true });
    ok(/Drinks Carts arrive at Salt Flat/.test((await hc(page)).news), 'a locked decoration says where it arrives');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

    // ---- time: pause and every speed, by button and key
    await page.click('[data-act="pause"]');
    ok((await hc(page)).paused, 'pause');
    const t0 = (await hc(page)).state.t;
    await page.waitForTimeout(400);
    eq((await hc(page)).state.t, t0, 'and the clock stops');
    for (const n of [2, 3, 1]) {
      await page.click(`[data-speed="${n}"]`);
      h = await hc(page);
      ok(!h.paused && h.speed === n, `speed ${n}×`);
    }
    await page.waitForTimeout(400);
    ok((await hc(page)).state.t > t0, 'the clock runs again');
    await page.keyboard.press(' ');
    ok((await hc(page)).paused, 'Space pauses');
    await page.keyboard.press('2');
    h = await hc(page);
    ok(!h.paused && h.speed === 2, 'and 2 sets 2×');
    await page.keyboard.press('1');
    await page.keyboard.press('b');
    eq((await hc(page)).panel, 'build', 'B opens the build cards');
    await page.keyboard.press('b');
    eq((await hc(page)).panel, 'none', 'and closes them');

    // ---- hire and fire
    const cleaner = await hireByUi(page, 'cleaner');
    ok(cleaner.role === 'cleaner', 'a cleaner hired');
    await page.click(`[data-staff="${cleaner.id}"]`);
    await page.locator('[data-card="staff"]').waitFor();
    await page.click('[data-act="fire"]');
    await page.click('[data-act="fire-yes"]');
    ok(['leave', 'gone'].includes((await hc(page)).state.staff.find((x) => x.id === cleaner.id)?.state ?? 'gone'), 'and fired');

    // ---- info cards: a patient, a staff member and a room (paused, so nobody walks off)
    await dbg(page, 'run', 400);
    await dbg(page, 'fit');
    await page.click('[data-act="pause"]');
    if ((await hc(page)).state.offer) await page.click('[data-act="decline"]'), await page.click('[data-act="pause"]');
    h = await hc(page);
    let pat = null, spot = null;
    for (const p of h.state.patients.filter((q) => q.phase === 'wait' || q.phase === 'in_slot')) { spot = await spotFor(page, { type: 'patient', id: p.id }, p.x, p.y); if (spot) { pat = p; break; } }
    ok(pat, 'a patient to click on');
    await page.mouse.click(spot.x, spot.y);
    await page.locator('[data-card="patient"]').waitFor();
    ok((await page.locator('[data-card="patient"] h3').innerText()).includes(pat.name), 'clicking a patient shows their card');
    const vet = h.state.staff.find((x) => x.role === 'vet');
    spot = await spotFor(page, { type: 'staff', id: vet.id }, vet.x, vet.y);
    ok(spot, 'a vet to click on');
    await page.mouse.click(spot.x, spot.y);
    await page.locator('[data-card="staff"]').waitFor();
    ok((await page.locator('[data-card="staff"] h3').innerText()).includes(vet.name), 'clicking a staff member shows their card');

    // ---- drag a staff member into a room
    const hic = h.state.rooms.find((r) => r.kind === 'hiccup'), chk = h.state.rooms.find((r) => r.kind === 'checkup');
    const to = await dbg(page, 'screenOf', hic.x + 1, hic.y + 1);
    await page.mouse.move(spot.x, spot.y); await page.mouse.down();
    await page.mouse.move((spot.x + to.x) / 2, (spot.y + to.y) / 2, { steps: 5 });
    h = await hc(page);
    ok(h.state.staff.find((x) => x.id === vet.id).held, `dragging picks the vet up (drag ${h.drag}, paused ${h.paused}, at ${JSON.stringify(await dbg(page, 'pickAt', spot.x, spot.y))})`);
    await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up();
    eq((await hc(page)).state.staff.find((x) => x.id === vet.id).home, hic.id, 'and dropping them in the Hiccup Jar keeps them there');
    ok(/will work in the Hiccup Jar/.test((await hc(page)).news), 'with a note');
    // the Pick up button, and a refused drop
    const recep = h.state.staff.find((x) => x.role === 'recep');
    await dbg(page, 'select', 'staff', recep.id);
    await page.click('[data-act="pickup"]');
    eq((await hc(page)).carry, recep.id, 'Pick up carries them');
    await page.mouse.click(to.x, to.y);
    ok(/needs a vet/.test((await hc(page)).news), 'a receptionist dropped in the Hiccup Jar is refused with a reason');
    await dbg(page, 'select', 'staff', vet.id);
    await page.click('[data-act="pickup"]');
    const toChk = await dbg(page, 'screenOf', chk.x + 1, chk.y + 1);
    await page.mouse.click(toChk.x, toChk.y);
    eq((await hc(page)).state.staff.find((x) => x.id === vet.id).home, chk.id, 'Pick up and tap moves the vet to the Check-up Room');

    // ---- the room card: Look closer, Move door, Sell
    h = await hc(page);
    const hic2 = h.state.rooms.find((r) => r.kind === 'hiccup');
    spot = await roomSpot(page, hic2);
    ok(spot, 'a spot on the Hiccup Jar room');
    await page.mouse.click(spot.x, spot.y);
    await page.locator('[data-card="room"]').waitFor();
    ok(/Hiccup Jar/.test(await page.locator('[data-card="room"] h3').innerText()), 'clicking a room shows its card');
    ok(await page.locator('[data-card="room"] .hc-ring').isVisible(), 'with the cure progress ring');
    const z0 = (await hc(page)).scene.zoom;
    await page.click('[data-act="zoom"]');
    await until(page, (z) => window.__clinic().scene.zoom > z * 1.5, z0);
    ok(true, 'Look closer zooms in on the room');
    const d0 = JSON.stringify(hic2.door);
    await page.click('[data-act="door"]');
    const d1 = JSON.stringify((await hc(page)).state.rooms.find((r) => r.id === hic2.id).door);
    ok(d1 !== d0 || /treated|no other/.test((await hc(page)).news), 'Move door moves the door (or says why not)');
    const coins = (await hc(page)).state.coins;
    await page.click('[data-act="sell"]');
    await page.click('[data-act="sell-yes"]');
    h = await hc(page);
    ok(!h.state.rooms.some((r) => r.id === hic2.id), 'Sell sells the room');
    eq(h.state.coins, coins + Math.round(hic2.cost / 2), 'for half its price');
    await dbg(page, 'fit');

    // ---- emergencies: accept one, decline one
    await page.click('[data-act="pause"]');
    ok(await dbg(page, 'emergency', 'static'), 'an emergency arrives');
    await page.locator('[data-card="emergency"]').waitFor();
    ok((await hc(page)).paused, 'and pauses the clock');
    await page.click('[data-act="accept"]');
    h = await hc(page);
    ok(!h.state.offer && h.state.emergencies.length === 1 && !h.paused, 'accepting sends them and carries on');
    await page.evaluate(() => { for (const e of window.__clinic().state.emergencies) e.done = true; });
    ok(await dbg(page, 'emergency', null), 'another emergency');
    await page.click('[data-act="decline"]');
    h = await hc(page);
    ok(!h.state.offer && h.state.emergencies.length === 1, 'declining sends them elsewhere');

    // ---- the goals, the stars, the map
    await dbg(page, 'meet');
    await page.locator('[data-sheet="met"]').waitFor();
    eq(await page.locator('[data-sheet="met"] .hc-stars-big .hc-on').count(), 3, 'three stars');
    eq((await hc(page)).save.stars.burrow, 3, 'saved');
    ok(/Salt Flat is now open/.test(await page.locator('[data-sheet="met"]').innerText()), 'the next clinic is announced');
    await page.click('[data-sheet="met"] [data-act="to-map"]');
    await until(page, () => window.__clinic().screen === 'map');
    ok(await page.locator('[data-clinic="salt"]:not(.hc-locked)').count() === 1, 'Salt Flat is unlocked on the map');
    await page.click('[data-clinic="burrow"]');
    eq(await page.locator('[data-clinic="burrow"] .hc-star.hc-on').count(), 3, 'Burrow Clinic shows three stars');
    await page.click('[data-act="sandbox"]');
    ok(/opens once you meet the goals at Salt Flat/.test(await page.locator('[data-lock="sandbox"]').innerText()), 'the Sandbox is still locked, and says why');

    // ---- settings and mute
    await page.click('[data-act="settings"]');
    await page.locator('[data-sheet="settings"]').waitFor();
    await page.click('[data-setting="music"]');
    eq((await hc(page)).save.settings.music, false, 'music off');
    await page.click('[data-setting="motion"]');
    eq((await hc(page)).save.settings.motion, false, 'motion off');
    await page.click('[data-setting="sandbox"]');
    ok(await page.locator('[data-lock="sandbox"]').count() === 0, 'the Sandbox setting opens the Sandbox');
    await page.click('[data-setting="sandbox"]');
    await page.click('[data-setting="motion"]');
    await page.click('[data-act="close-settings"]');
    await page.click('[data-act="mute"]');
    h = await hc(page);
    ok(!h.save.settings.sound && !h.save.settings.music, 'mute silences everything');
    await page.click('[data-act="mute"]');
    h = await hc(page);
    ok(h.save.settings.sound && h.save.settings.music, 'and unmute brings it back');

    // ---- the next clinic, and the save surviving a reload
    await page.click('[data-clinic="salt"]');
    await page.click('[data-act="start"]');
    await until(page, () => window.__clinic().clinic === 'salt');
    eq((await hc(page)).state.tut, 6, 'Salt Flat opens without the tutorial');
    await buildByUi(page, 'reception');
    await page.reload();
    await page.locator('main[data-ready="true"]').waitFor();
    h = await hc(page);
    ok(h.save.current?.clinic === 'salt' && h.save.current.rooms.length === 1 && h.save.stars.burrow === 3, 'the save survives a reload');
    await page.click('[data-act="play"]');
    await page.click('[data-act="continue"]');
    await until(page, () => window.__clinic().clinic === 'salt');
    eq((await hc(page)).state.rooms.length, 1, 'Continue picks up where you left off');
    ok(await noSideways(page), 'desktop: no sideways scroll');
    await ctx.close();
  }

  // ------------------------------------------------------------ a corrupt save starts fresh
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, '{"v":1,"stars":');
    const h = await hc(page);
    eq([h.screen, h.save.stars, h.save.current], ['title', {}, null], 'a corrupt save starts fresh');
    await page.click('[data-act="play"]');
    ok(await page.locator('[data-clinic="burrow"]').isVisible(), 'and the map works');
    await ctx.close();
  }

  // ------------------------------------------------------------ phones: landscape (the main phone layout) and portrait
  for (const vp of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const { ctx, page } = await open(vp);
    ok(await noSideways(page), `${tag}: the title has no sideways scroll`);
    await page.click('[data-act="play"]');
    ok(await noSideways(page), `${tag}: the map has no sideways scroll`);
    await page.click('[data-act="start"]');
    await until(page, () => window.__clinic().screen === 'clinic');
    await buildByUi(page, 'reception');
    await hireByUi(page, 'recep');
    await page.click('[data-tool="hire"]');
    ok(await noSideways(page), `${tag}: the clinic has no sideways scroll`);
    for (const sel of ['[data-tool="build"]', '[data-tool="decor"]', '[data-tool="hire"]', '[data-tool="overview"]', '[data-act="pause"]', '[data-speed="1"]', '[data-speed="2"]', '[data-speed="3"]', '[data-act="map"]', '[data-act="settings"]']) {
      const r = await page.locator(sel).boundingBox();
      ok(r && r.x >= 0 && r.y >= 0 && r.x + r.width <= vp.width + 1 && r.y + r.height <= vp.height + 1, `${tag}: ${sel} is on screen (${JSON.stringify(r)})`);
      ok(r.height >= 36 && r.width >= 36, `${tag}: ${sel} is big enough to tap (${Math.round(r.width)}x${Math.round(r.height)})`);
      const top = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('button'), [r.x + r.width / 2, r.y + r.height / 2]);
      ok(top, `${tag}: ${sel} is not covered`);
    }
    const cv = await page.locator('.hc-canvas').boundingBox();
    ok(cv.width > vp.width * 0.5 && cv.height > 150, `${tag}: the floor is a good size (${Math.round(cv.width)}x${Math.round(cv.height)})`);
    // the canvas and the dock never overlap
    const dock = await page.locator('.hc-dock').boundingBox();
    ok(dock.x >= cv.x + cv.width - 1 || dock.y >= cv.y + cv.height - 1, `${tag}: the dock sits beside or below the floor, not over it`);
    // tap select on a phone: a tap on the canvas works
    await page.click('[data-tool="build"]');
    await page.click('[data-room="checkup"]');
    await page.click('[data-act="place"]');
    await until(page, () => window.__clinic().state.rooms.length === 2);
    ok(true, `${tag}: build works`);
    await dbg(page, 'emergency', null);
    // the clinic has no cure room yet, so no emergency is possible: build one and try again
    if (!(await hc(page)).state.offer) { await dbg(page, 'build', 'fluff'); await dbg(page, 'hire', 'vet'); await dbg(page, 'emergency', 'static'); }
    const card = await page.locator('[data-card="emergency"]').boundingBox();
    ok(card && card.y + 40 <= vp.height, `${tag}: the emergency card shows`);
    await page.locator('[data-act="accept"]').scrollIntoViewIfNeeded();
    await page.click('[data-act="accept"]');
    await dbg(page, 'meet');
    await page.locator('[data-sheet="met"]').waitFor();
    const met = await page.locator('[data-sheet="met"]').boundingBox();
    ok(met.y >= -1 && met.y + met.height <= vp.height + 1 && met.x >= -1 && met.x + met.width <= vp.width + 1, `${tag}: the goals-met card fits`);
    ok(await noSideways(page), `${tag}: no sideways scroll with the goals-met card`);
    await ctx.close();
  }

  eq(errors, [], 'no page errors');
  console.log(`PASS Burrow Clinic e2e: ${checks} checks`);
} finally {
  await browser.close();
}
