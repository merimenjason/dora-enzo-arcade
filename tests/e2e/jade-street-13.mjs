// Jade Street in the browser, the thirteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): polish from the second playtest. Escape in a pause sub-tab goes back one level; the Contracts tab puts
// the contract of the day first with a travel hint on each card; the MRT gates mark the station of a planned route;
// the switch-box jobs open the switch box (not the scooter) and Teh Tarik Time its own counter; the radio chip clears
// the phone button; the ferry chip; plane spotting counts down.
export async function thirteenth(h) {
  const { p, W, press, loc, exists, appear, look, check, wait, settle, name } = h;
  const key = async (k, ms = 200) => { await p.keyboard.press(k); await wait(ms); };
  const late = () => W(() => { const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll?.(); w.s.story.lights = true; w.s.story.ch = 8; w.s.cash = 5000; w.quitJob(); if (w.p.ride) w.exit(); w.p.ride = null; w.p.roof = false; w.p.hide = false; w.talk = null; w.ui = null; w.heat = 0; w.gangs.ev = null; w.emp.raid = null; J.play.bump(); });
  await late(); await settle();

  // ── P8: Escape in a pause sub-tab goes back to the menu, a second closes it
  await key('Escape'); check(await appear('pause'), `${name}: Escape pauses`);
  await press('tab-jobs'); await key('Escape');
  check(await exists('pause') && /Paused/.test(await loc('pause').innerText()), `${name}: Escape in the Jobs book goes back to the pause menu`);
  await key('Escape'); check(!(await exists('pause')), `${name}: a second Escape resumes`);

  // ── m9 + M1: the contract of the day first, every card with how far it is
  await W(() => { const w = window.__jade.world(); w.teleportTo?.('kee'); const pl = w.c.places.kee; w.placePlayer(pl.x, pl.y + 40); });
  await press('jade-phone'); await press('phone-con');
  check(await appear('con-tab'), `${name}: the Contracts tab`);
  const first = await p.locator('.jade-con-list > *').first().innerText().catch(() => '');
  check(/of the day/i.test(first), `${name}: the contract of the day is the first card`);
  check(await exists('con-tier'), `${name}: the tier line on its own`);
  const far = await p.locator('[data-testid^="con-far-"]').allInnerTexts();
  check(far.length >= 3 && far.every(t => /close by|about \d+ (s|min)/.test(t)), `${name}: each card says how far (${far.slice(0, 2).join(' | ')})`);
  await look('contracts tab'); await key('Escape');

  // ── M1: Route me to the far end of the island leads via the MRT, and the gates mark the stop
  const plan = await W(() => { const J = window.__jade, w = J.world(); const a = w.c.isle.stations.find(s => s.id === 'stn-chinatown'), z = w.c.isle.stations.find(s => s.d === 'changi');
    w.placePlayer(a.x, a.y + 128); w.waypoint = [z.x + 256, z.y + 128]; w.objective(); return w.travel ? { via: w.travel.via, to: w.travel.to.id, from: w.travel.from.id } : null; });
  check(plan?.via === 'mrt' && plan.from === 'stn-chinatown', `${name}: a Changi pin from Chinatown goes by MRT (${JSON.stringify(plan)})`);
  await wait(400);
  check(/Quicker by train|MRT/.test(await p.locator('.jade-shell').innerText()), `${name}: the route plaque says to take the train`);
  await W(from => { const w = window.__jade.world(); w.ui = { kind: 'mrt', from }; window.__jade.play.bump(); }, 'stn-chinatown');
  check(await appear('mrt'), `${name}: the MRT gates`);
  check(await exists(`mrt-${plan?.to}`) && (await loc(`mrt-${plan?.to}`).getAttribute('data-plan')) === 'true', `${name}: the gates mark the route's stop`);
  await look('mrt gates'); await settle(); await W(() => { const w = window.__jade.world(); w.waypoint = null; });

  // ── m3: the switch-box job opens the switch box; the scooter keeps its ignition
  for (const [id, want, bg] of [['m38', /switch box/i, 'bg-mg-switch'], ['m50', /switch box/i, 'bg-mg-switch']]) {
    const ok = await W(id => { const J = window.__jade, w = J.world(); J.job(id); const i = w.run.m.steps.findIndex(s => s.t === 'mini' && s.kind === 'wires'); if (i < 0) return false; J.enterStep(i); w.talk = null; w.ui = { kind: 'mini', mini: 'wires', level: 1, from: 'mission' }; J.play.bump(); return true; }, id);
    check(ok && await appear('mini-wires'), `${name}: ${id}'s wires`);
    const head = await loc('mini-wires').innerText().catch(() => '');
    check(want.test(head) && !/Jump-start/.test(head), `${name}: ${id} opens the switch box (${head.split('\n')[0]})`);
    if (id === 'm38') await look('switch box');
    await W(() => { const w = window.__jade.world(); w.ui = null; w.quitJob(); w.talk = null; window.__jade.play.bump(); });
    void bg;
  }
  // ── m4: Teh Tarik Time's counter is the teh tarik stall, not Uncle Teo's
  const k11 = await W(() => { const J = window.__jade, w = J.world(); J.job('k11'); const i = w.run.m.steps.findIndex(s => s.t === 'mini' && s.kind === 'kopi'); if (i < 0) return false; J.enterStep(i); w.talk = null; w.ui = { kind: 'mini', mini: 'kopi', level: 2, from: 'mission' }; J.play.bump(); return true; });
  check(k11 && await appear('mini-kopi'), `${name}: Teh Tarik Time's counter opens`);
  const kt = await loc('kopi-title').innerText().catch(() => '');
  check(/teh tarik/i.test(kt) && !/Uncle Teo/.test(kt), `${name}: it is the teh tarik stall (${kt})`);
  await look('teh tarik');
  await W(() => { const w = window.__jade.world(); w.ui = null; w.quitJob(); w.talk = null; window.__jade.play.bump(); });
  await settle(); await wait(300);

  // ── P5: the radio chip sits clear of the phone button
  await W(() => { const w = window.__jade.world(); const pl = w.c.places.kee; w.placePlayer(pl.x, pl.y + 200); w.p.ride = w.addRide('scooter', w.p.x, w.p.y, 0, false, 0, true); w.p.ride.parked = false; window.__jade.play.bump(); });
  check(await appear('jade-radio'), `${name}: the radio chip on a scooter`); await look('radio chip');
  const box = async tid => p.locator(`[data-testid="${tid}"]`).boundingBox({ timeout: 3000 }).catch(() => null);
  const [r, ph] = [await box('jade-radio'), await box('jade-phone')];
  const overlap = r && ph && !(r.x + r.width <= ph.x || ph.x + ph.width <= r.x || r.y + r.height <= ph.y || ph.y + ph.height <= r.y);
  check(r && ph && !overlap, `${name}: the radio chip clears the phone button`);
  await W(() => { const w = window.__jade.world(); w.exit?.(); w.p.ride = null; window.__jade.play.bump(); });

  // ── P6: plane spotting counts down to the next plane
  const pl = await W(() => { const w = window.__jade.world(), F = w.c.far; if (!F?.spots?.length) return null; const [x, y] = F.spots[0]; w.placePlayer(x, y); w.time = Math.floor(w.time / 24) * 24 + 12; window.__jade.play.bump(); return true; });
  await wait(400);
  const near = await W(() => window.__jade.world().near?.label ?? '');
  check(pl && /next in \d+ s|Wave at the plane/.test(near), `${name}: plane spotting says when the next one comes (${near})`);
  await settle();
}
