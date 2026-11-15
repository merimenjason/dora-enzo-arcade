// Jade Street in the browser, the eleventh pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): procedural contracts. Locked before the Phoenix Drum; the phone's Contracts tab with three offers and
// the contract of the day (stars, modifier chips, pay); Route me (the route label names the giver); the next-contract
// plaque; the giver's E prompt starts it (the opening lines, the job plaque says Contract); winning it (the banner, the
// celebrate pose, a fresh offer, the count); modifiers in play (no rides refused, the storm, the graveyard shift, partner
// busy); a fail with the giver's bark, Retry and Quit job; the contract of the day's best time; the rivals' pushback
// (the tab's retake label, the contest line, the retake card, winning it back); the jobs book's count; the Controls row;
// saved as v12.
export async function eleventh(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 260); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const C = () => W(() => window.__jade.contracts());
  await W(() => {
    window.__seen11 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen11.add(w.p.act.n); requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const J = window.__jade, w = J.world(); w.quitJob(); w.talk = null; w.ui = null;
    // before the first ending: locked
    w.s.done = w.s.done.filter(id => id !== 'm25');
  });
  await free();
  await press('jade-phone'); await press('phone-con'); check(await appear('con-locked'), `${name}: contracts are locked before the Phoenix Drum`); await press('close'); await free();

  await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.story.lights = true; w.s.story.isle = true; w.s.story.ch = 7; w.quitJob(); w.talk = null; w.ui = null;
    for (const d of Object.keys(w.s.rep)) w.s.rep[d] = Math.max(w.s.rep[d], 60);
    w.s.cash = 5000; w.s.settings.partner = 'tag'; w.waypoint = null; w.route = [];
  });
  await free();

  // ── the phone's Contracts tab: three offers and the contract of the day
  await press('jade-phone'); await press('phone-con'); check(await appear('con-tab'), `${name}: the phone's Contracts tab`);
  for (const k of ['o0', 'o1', 'o2', 'day']) check(await exists(`con-${k}`), `${name}: the ${k} card`);
  const c0 = await C(); check(c0.list.filter(l => l.tag === 'offer').length === 3, `${name}: three offers`);
  check(/★/.test(await loc('con-o2').innerText()) && /coins/.test(await loc('con-o2').innerText()), `${name}: a card has stars and pay`);
  await look('phone: contracts');
  // Route me: the phone closes, the route label names the giver
  await press('con-route-o1'); check(!(await exists('con-tab')) && await W(() => !!window.__jade.world().waypoint), `${name}: Route me to a contract's giver`);
  const g1 = c0.list.find(l => l.which === 'o1');
  check(await appear('route-label') && (await loc('route-label').innerText()).includes(g1.title), `${name}: the route label names the contract`); await look('contract: routed');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; window.__jade.play.bump(); }); await wait(200);
  check(await appear('next-contract'), `${name}: the next-contract plaque between jobs`); await look('contract: plaque');

  // ── the giver's prompt starts it: the opening lines, the job plaque
  const near = await W(w => window.__jade.toGiver(w), 'o0');
  check(near?.kind === 'contract' && near.id === 'o0', `${name}: the giver offers it in person: "${near?.label}"`); await look('contract: at the giver');
  await E(); check(await W(() => window.__jade.world().run?.m.id.startsWith('con-')), `${name}: E starts the contract`);
  check(await appear('dialogue'), `${name}: the giver's opening lines`); await look('contract: opening lines');
  for (let i = 0; i < 12 && await exists('dialogue'); i++) { await key(' ', 140); }
  await free(); check(/Contract/i.test(await loc('job').innerText()), `${name}: the job plaque says Contract`); await look('contract: under way');
  const before = await C();
  await W(() => window.__jade.conWin()); await wait(300);
  const after = await C();
  check(after.done === 1 && after.list.find(l => l.which === 'o0').id !== before.list.find(l => l.which === 'o0').id, `${name}: winning counts it and deals a fresh offer`);
  check(await W(() => /Contract done/.test(window.__jade.world().banner?.text ?? '')), `${name}: the Contract done banner`); await look('contract: done');
  await until(() => window.__seen11.has('celebrate'), null, 2000); await free();

  // ── modifiers in play: no rides, a storm, the graveyard shift, the partner busy
  await W(() => window.__jade.conMods(['foot', 'rain', 'night', 'solo'])); await free(); await wait(300);
  check(await W(() => { const w = window.__jade.world(); return w.dark && w.rainForce === 0.9; }), `${name}: the storm and the graveyard shift`);
  check(/No rides/i.test(await loc('job').innerText()), `${name}: the job plaque lists the modifiers`); await look('contract: storm at night');
  check(await W(() => window.__jade.world().mate.ai?.mode === 'stay'), `${name}: the partner stays with the giver`);
  const refused = await W(() => { const w = window.__jade.world(); const r = w.rides.find(x => x.parked && !x.broken && !x.locked); if (!r) return null; w.placePlayer(r.b.x + 30, r.b.y); w.drain(); w.enter(r); return { act: w.p.act?.n ?? null, msg: w.drain().filter(f => f.t === 'toast').map(f => f.msg).join() }; });
  check(refused && !refused.act && /No rides/.test(refused.msg), `${name}: no climbing on a scooter on a no-rides contract`);
  // a fail: the giver has a word, then Retry and Quit job
  await W(() => window.__jade.world().fail('A test failure.')); await wait(200);
  check(await appear('fail'), `${name}: the failure card`); await look('contract: failed');
  await press('retry'); check(!(await exists('fail')) && await W(() => !!window.__jade.world().run && window.__jade.world().dark), `${name}: Retry keeps the modifiers`);
  await settle(); await W(() => window.__jade.world().fail('Again.')); await wait(200);
  await press('quit-job'); check(await W(() => { const w = window.__jade.world(); return !w.run && !w.dark && w.rainForce === null; }), `${name}: Quit job ends the storm and the dark`);
  await free();

  // ── the contract of the day: its best time
  await W(() => window.__jade.conStart('day')); await free(); await W(() => { window.__jade.world().run.time = 95; window.__jade.conWin(); }); await wait(200); await free();
  const cd = await C(); check(cd.dayBest === 95 && cd.dayRuns === 1, `${name}: the contract of the day keeps the best time`);
  await press('jade-phone'); await press('phone-con'); check(/today’s best 1:35/.test(await loc('con-day').innerText()), `${name}: the card shows today's best`); await look('phone: contract of the day'); await press('close'); await free();

  // ── the rivals push back: a contested district, the retake card, winning it back
  await W(() => { const J = window.__jade, w = J.world(); w.buyBiz('noodle'); w.p.act = null; });
  const d = await W(() => window.__jade.contest()); check(!!d, `${name}: a rival gang contests a district`);
  await press('jade-phone');
  check(/retake/.test(await loc('phone-con').innerText()), `${name}: the tab says there is a retake`); await press('phone-con');
  check(await exists('con-contest') && await exists('con-push'), `${name}: the contest line and the retake card`); await look('phone: retake');
  await press('con-route-push'); check(await W(() => window.__jade.world().s.contracts.pin === 'push'), `${name}: Route me to the retake`); await free();
  await W(() => window.__jade.conStart('push')); await free(); await W(() => window.__jade.conWin()); await wait(200);
  const cp = await C(); check(!cp.contest && cp.retaken === 1, `${name}: winning the retake clears the contest`); await look('contract: retaken'); await free();

  // ── the jobs book, the Controls row, the save
  await press('pause-btn'); await press('tab-jobs'); check(await appear('jade-jobs-con') && /contracts?/.test(await loc('jade-jobs-con').innerText()), `${name}: the jobs book counts contracts`); await look('jobs book: contracts');
  await press('close'); await press('tab-controls'); check(/Contracts/.test(await loc('jade-controls').innerText()), `${name}: the Controls page has contracts`);
  await press('close'); if (await exists('resume')) await press('resume');
  await W(() => window.__jade.play.persist(window.__jade.world().s));
  check(await until(() => !!localStorage.getItem('jade-street-v12') && JSON.parse(localStorage.getItem('jade-street-v12')).v === 12, null, 6000), `${name}: saved as v12`);
  check(await W(() => window.__seen11.has('celebrate')), `${name}: the celebrate pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; });
  await settle();
}
