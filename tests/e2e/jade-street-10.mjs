// Jade Street in the browser, the tenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): the Chinatown empire. A property for sale says its price at the door; E opens it, Buy and both
// Upgrades are clicked; the map's property pins and key, and a click on one routes there; the phone's Empire tab (the
// rank, the ledger, Route me); a rank-up card; a raid: the toast, the HUD clock, the red map pin, Route me from the raid
// card, arriving starts the raid job, giving it up loses the night's takings; a second raid sent to the partner; the
// partner's round of the tills; a damaged property repaired; Pak Duri hired as jaga; a big till counted; an empire job
// taken from the property panel; the pause menu's Empire tab; the Controls rows; saved as v11; every new pose played.
export async function tenth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 220); };
  const near = () => W(() => { const w = window.__jade.world(); w.findNear(); return w.near ? { kind: w.near.kind, label: w.near.label, id: w.near.id ?? null } : null; });
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const toBiz = id => W(id => window.__jade.toBiz(id), id);
  const steps = (n, inp) => W(([n, inp]) => window.__jade.step(n, inp), [n, inp]);
  await W(() => {
    window.__seen10 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen10.add(w.p.act.n); if (w.mate.act) window.__seen10.add(w.mate.act.n); requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const J = window.__jade, w = J.world(); J.finishAll(); w.s.story.lights = true; w.s.story.isle = true; w.s.story.ch = 7; w.quitJob(); w.talk = null; w.ui = null;
    for (const d of Object.keys(w.s.rep)) w.s.rep[d] = Math.max(w.s.rep[d], 60);
    for (const b of Object.keys(w.s.biz)) Object.assign(w.s.biz[b], { lvl: 0, bank: 0, dmg: 0, jaga: false, boost: 0, boostK: 1 });
    w.s.empire.rank = 0; w.s.cash = 60000; w.emp.raid = null; w.emp.round = null; w.s.settings.partner = 'tag';
  });
  await free();

  // ── a property for sale: its price at the door, E opens it, Buy and both upgrades
  const n0 = await toBiz('kopitiam'); check(n0?.kind === 'biz' && /for sale: 1,200 coins/.test(n0.label), `${name}: the kopitiam says its price at the door: "${n0?.label}"`); await look('empire: for sale');
  await E(); check(await appear('biz'), `${name}: E opens the property`);
  await press('biz-buy'); check(await W(() => window.__jade.world().s.biz.kopitiam.lvl === 1), `${name}: Buy`);
  await press('biz-up'); await press('biz-up'); check(await W(() => window.__jade.world().s.biz.kopitiam.lvl === 3), `${name}: both upgrades`); await look('empire: kopitiam level 3');
  check(/level 3 of 3/.test(await loc('biz-level').innerText()), `${name}: the panel shows level 3`);
  await press('close'); await free();
  check(await W(() => window.__jade.world().s.empire.rank >= 1), `${name}: Street Stall on the first property`);

  // ── the map: properties for sale, yours, the key, a click routes there
  await press('map-btn'); for (let i = 0; i < 6; i++) await press('jade-map-zoom-out');
  check(await p.locator('[data-testid="jade-map-pin"][data-kind="prop"]').count() >= 20, `${name}: the properties for sale on the map`);
  check(await p.locator('[data-testid="jade-map-pin"][data-kind="own"]').count() === 1, `${name}: your property on the map`);
  if (!(await loc('jade-map-legend').innerText()).includes('Property')) await press('jade-map-legend-toggle');
  check(/Property for sale/.test(await loc('jade-map-legend').innerText()) && /Your property/.test(await loc('jade-map-legend').innerText()), `${name}: the map key lists properties`); await look('map: properties');
  await p.locator('[data-testid="jade-map-pin"][data-key="prop-taxi"]').click({ force: true }); check(await appear('jade-map-popup'), `${name}: a property pin's popup`);
  check(/For sale: 2,600/.test(await loc('jade-map-popup').innerText()), `${name}: the popup has the price`);
  await press('jade-map-route'); check(!(await exists('map')) && await W(() => !!window.__jade.world().waypoint), `${name}: Route here to the taxi company`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── the phone's Empire tab: rank, ledger, Route me
  await press('jade-phone'); await press('phone-empire'); check(await appear('emp-page'), `${name}: the phone's Empire tab`);
  check(/Street Stall/.test(await loc('emp-rank-name').innerText()), `${name}: the rank`); check(/own\s*1\s*of 32/.test(await loc('emp-ledger').innerText()), `${name}: the ledger`); await look('phone: empire');
  await press('emp-route-prata'); check(!(await exists('jade-phone-msgs')) && await W(() => !!window.__jade.world().waypoint), `${name}: Route me from the Empire tab`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── a rank-up: buy into the heart of Chinatown until Kopi Boss
  await W(() => { const J = window.__jade, w = J.world(); for (const id of ['noodle', 'cake', 'tea', 'fan', 'jade']) { w.buyBiz(id); w.upgradeBiz(id); } w.p.act = null; });
  await steps(2); check(await W(() => window.__jade.world().s.empire.rank === 2 && /Kopi Boss/.test(window.__jade.world().banner?.text ?? '')), `${name}: the Kopi Boss rank-up card`); await look('rank up: Kopi Boss');
  await free();

  // ── a raid: the toast, the HUD's clock, the red map pin, Route me, arriving starts the job, giving up loses the night
  await W(() => { const J = window.__jade; J.setBiz('noodle', { bank: 300 }); J.toBiz('kopitiam'); J.raidAlert('noodle', 'defend'); J.world().s.biz.noodle.tonight = 120; });
  check(await appear('hud-raid'), `${name}: the HUD's raid clock`); check(/Raid on the/.test(await loc('hud-raid').innerText()), `${name}: it names the place`); await look('raid: alert');
  await press('map-btn'); check(await p.locator('[data-testid="jade-map-pin"][data-kind="raid"]').count() === 1, `${name}: the raid's red pin on the map`); await look('map: raid'); await press('close'); await free();
  await press('jade-phone'); check(await appear('emp-raid'), `${name}: the phone opens on the Empire tab with the raid`); await look('phone: raid');
  await press('emp-raid-route'); check(await W(() => !!window.__jade.world().waypoint), `${name}: Route me to the raid`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; }); await toBiz('noodle'); await steps(2);
  check(await W(() => window.__jade.world().run?.m.id === 'raid-noodle'), `${name}: arriving starts the raid job`); await W(() => { window.__jade.world().talk = null; }); await wait(400); await look('raid: the stand');
  const bank = await W(() => window.__jade.world().s.biz.noodle.bank);
  await press('pause-btn'); await press('abandon'); await free();
  check(await W(b => { const st = window.__jade.world().s.biz.noodle; return (st.bank < b || st.dmg === 1) && window.__jade.world().s.stats.raidsMissed === 1; }, bank), `${name}: giving up loses the night's takings (or the shop is smashed)`);

  // ── a raid sent to the partner
  await W(() => { const J = window.__jade; J.setBiz('cake', { bank: 300 }); J.toBiz('kopitiam'); J.raidAlert('cake', 'defend'); });
  await press('jade-phone'); await press('emp-raid-send'); await wait(200);
  check(await W(() => window.__jade.empire().raid?.sent && window.__jade.empire().round?.kind === 'defend'), `${name}: Send my partner`); await press('close'); await free();
  check(await appear('hud-raid') && /seeing off/.test(await loc('hud-raid').innerText()), `${name}: the HUD shows the partner out`);
  await W(() => { const J = window.__jade; for (let i = 0; i < 200 && J.world().emp.round; i++) J.step(60); });
  check(await W(() => !window.__jade.world().emp.raid && !window.__jade.world().emp.round), `${name}: the partner deals with it and comes back`);

  // ── the partner's round of the tills
  await W(() => { const J = window.__jade; for (const id of ['noodle', 'cake', 'tea']) J.setBiz(id, { bank: 80 }); J.world().s.clock = 10; });
  await press('jade-phone'); await press('phone-empire'); await press('emp-round');
  check(await W(() => window.__jade.empire().round?.kind === 'collect'), `${name}: Send partner round the tills`); await press('close'); await free();
  const c0 = await W(() => window.__jade.world().s.stats.bizCoins); // (not cash: a warden's fine could land meanwhile)
  await W(() => { const J = window.__jade; for (let i = 0; i < 300 && J.world().emp.round; i++) { J.world().s.clock = 10; J.step(60); } J.step(90); }); // (held before the raid hours: a night raid could empty a till mid-round)
  check(await W(c0 => window.__jade.world().s.stats.bizCoins >= c0 + 240, c0), `${name}: the partner hands over the takings (${await W(c0 => window.__jade.world().s.stats.bizCoins - c0, c0)} coins)`);

  // ── a damaged property repaired
  await W(() => window.__jade.setBiz('tea', { dmg: 1 })); await toBiz('tea'); await E(); check(await appear('biz-dmg'), `${name}: the panel says it was smashed up`); await look('empire: damaged');
  await press('biz-repair'); check(await W(() => window.__jade.world().s.biz.tea.dmg === 0 && window.__jade.world().s.stats.repairs === 1), `${name}: Repair`); await press('close'); await wait(500); await look('empire: repairing'); await free();

  // ── Pak Duri hired as jaga (Shophouse Tycoon)
  await W(() => window.__jade.rank(3)); await toBiz('fan'); await E(); await press('biz-jaga');
  check(await W(() => window.__jade.world().s.biz.fan.jaga) && await exists('biz-jaga-on'), `${name}: Hire Pak Duri`); await press('close'); await wait(400); await free();

  // ── a big till counted
  await W(() => window.__jade.setBiz('jade', { bank: 320 })); await toBiz('jade'); await E(); await press('biz-collect'); await press('close'); await wait(300);
  check(await W(() => window.__seen10.has('count')), `${name}: a big till is counted`); await free();

  // ── an empire job taken from the property panel
  await toBiz('kopitiam'); await E(); check(await appear('emp-jobs'), `${name}: empire jobs on offer at the kopitiam`); await look('empire: jobs');
  await press('emp-job-supplier'); check(await W(() => window.__jade.world().run?.gig?.key === 'emp:supplier:kopitiam'), `${name}: Supplier Deal starts`);
  await W(() => { window.__jade.world().talk = null; }); await wait(400); await look('empire job: supplier'); await W(() => window.__jade.world().quitJob()); await free();

  // ── the pause menu's Empire tab and the Controls page
  await press('pause-btn'); await press('tab-biz'); check(await appear('emp-page') && await exists('emp-row-noodle'), `${name}: the pause menu's Empire tab`); await look('pause: empire');
  await press('close'); await press('tab-controls'); check(/empire/i.test(await loc('jade-controls').innerText()), `${name}: the Controls page has the empire`);
  await press('close'); if (await exists('resume')) await press('resume');
  check(await W(() => { const k = ['jade-street-v13', 'jade-street-v12', 'jade-street-v11'].find(x => localStorage.getItem(x)); return !!k && JSON.parse(localStorage.getItem(k)).v >= 11; }), `${name}: saved (v11 or later)`);

  // ── every new pose
  const seen = await W(() => [...window.__seen10]);
  for (const a of ['deal', 'mend', 'repair', 'shake', 'send', 'bag', 'count']) check(seen.includes(a), `${name}: the ${a} pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; w.emp.raid = null; w.emp.round = null; window.__jade.play.paused = false; });
  await settle();
}
