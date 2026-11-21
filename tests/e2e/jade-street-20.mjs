// Jade Street in the browser, the twentieth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): side gigs past Chinatown and six more Hawker Tales. With the story done, every district past Chinatown
// has a gig flag of its own (seen on the minimap's big map); a giver texts about theirs and the text's Route me points
// the gold line at the flag. Then every new gig and tale is played on Normal, Assist off, the way a first-timer plays:
// nothing is teleported once the player has arrived near the flag or the giver; they walk up to it, press E on the
// prompt, follow the gold line, read the on-screen hint and the E prompt, and press only what those name. The rounds'
// own poses (serve, drape, hang) are checked drawn on the way. No ending.
export async function twentieth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const seen = n => W(n => window.__seen20.has(n), n);
  await W(() => {
    window.__seen20 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen20.add(w.p.act.n); if (w.p.ride) window.__seen20.add('ride:' + w.p.ride.kind); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const TALES = ['k33', 'k34', 'k35', 'k36', 'k37', 'k38'];
  const GIGS = await W(() => window.__jade.world().gigs().map(g => g.id));

  // ── the story done, every district open, Normal with Assist off; the new tales not yet played
  await W(TALES => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !TALES.includes(id)); w.s.cash = 5000;
    w.quitJob(); w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false;
    for (const k of Object.keys(w.s.best)) if (/^gigs?:/.test(k)) delete w.s.best[k];
    w.s.msgs = w.s.msgs.filter(m => !m.gig);
    w.s.settings.partner = 'tag'; w.s.settings.assist = false; w.s.settings.diff = 'normal'; w.assist = false; J.play.bump();
  }, TALES);
  await settle();
  check(await W(() => window.__jade.jobs().side) === 35 && await W(() => window.__jade.jobs().story) === 85, `${name}: 85 story jobs and 35 Hawker Tales, counted from the data`);
  const NEW = await W(() => { const w = window.__jade.world(), D = ['heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong', 'pulau', 'kallang']; return w.gigs().filter(g => D.includes(window.__jade.district(Math.floor(g.x / 64), Math.floor(g.y / 64)))).map(g => g.id); });
  check(NEW.length === 17, `${name}: seventeen gig flags past Chinatown (${NEW.length})`);

  // ── the map shows the flags
  await press('map-btn'); check(await appear('map'), `${name}: the map opens`); await wait(500);
  for (let i = 0; i < 8; i++) await press('jade-map-zoom-out'); await wait(400);
  const pins = await W(() => [...document.querySelectorAll('[data-testid="jade-map-pin"][data-kind="gig"]')].map(e => e.getAttribute('data-key')));
  check(NEW.every(id => pins.includes('gig-' + id)), `${name}: the map pins every gig flag past Chinatown (${NEW.filter(id => !pins.includes('gig-' + id)).join(', ') || 'all there'})`);
  await look('map: gig flags'); await press('close'); await free();

  // ── a giver texts about their gig; the text's Route me points the gold line at the flag
  await W(() => { const w = window.__jade.world(); w.s.night++; w.tick = 0; });
  check(await until(() => window.__jade.world().s.msgs.some(m => m.gig), null, 6000), `${name}: a giver texts about their side gig`);
  const gt = await W(() => { const m = window.__jade.world().s.msgs.filter(m => m.gig).pop(); return { gig: m.gig, from: m.from, text: m.text }; });
  await press('jade-phone'); await wait(300);
  check(await exists(`msg-route-gig-${gt.gig}`), `${name}: ${gt.from}'s text ("${gt.text}") has Route me`); await look('phone: a gig text');
  await press(`msg-route-gig-${gt.gig}`); await wait(500);
  check(await W(id => { const w = window.__jade.world(), b = w.gigs().find(g => g.id === id); return !!w.waypoint && !!b && Math.hypot(w.waypoint[0] - b.x, w.waypoint[1] - b.y) < 2; }, gt.gig), `${name}: Route me pins the ${gt.gig} flag`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── every new gig and tale, played as a first-timer on Normal
  const state = (id, gig) => W(([id, gig]) => {
    const J = window.__jade, w = J.world(), q = s => document.querySelector(`[data-testid="${s}"]`);
    const g = !w.run ? (gig ? w.gigs().find(b => b.id === id) : (w.cast || []).find(c => c.job === id)) : null;
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'),
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act, boostCd: w.p.boostCd ?? 0,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null,
      mark: w.run?.mark ?? null, rival: (() => { const a = (w.run?.actors ?? []).find(a => /^rival/.test(a.kind)); return a ? `${a.kind}:${a.wp ?? a.i ?? '?'}@${Math.round(a.b.x)},${Math.round(a.b.y)}` : null; })(),
      bird: (() => { const a = (w.run?.actors ?? []).find(a => a.kind === 'bagbird' && !a.gone); return a ? [a.b.x, a.b.y] : null; })(),
      won: gig ? !!w.s.best['gig:' + id] : w.s.done.includes(id) };
  }, [id, gig]);
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  let stuckAt = null, side = 0;
  const steer = async s => {
    const keys = new Set(); if (s.to) { const dx = s.to[0] - s.x, dy = s.to[1] - s.y, l = Math.hypot(dx, dy) || 1; if (l > 20) { if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w'); } }
    const now = Date.now();
    if (!keys.size || !stuckAt || Math.hypot(s.x - stuckAt.x, s.y - stuckAt.y) > 12) stuckAt = { x: s.x, y: s.y, t: now };
    else if (now - stuckAt.t > 1000 && now > side) side = now + 500;
    if (now < side) { const across = keys.has('a') || keys.has('d') ? ['w', 's'] : ['a', 'd']; keys.clear(); keys.add(across[Math.floor(side / 500) % 2]); if (now >= side - 40) stuckAt = null; }
    await hold(keys);
  };
  const only = process.env.ONLY20 ? process.env.ONLY20.split(',') : null;
  async function play(id, gig, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '';
    const runId = gig ? 'gig-' + id : id;
    if (only && !only.includes(id)) { await W(([id, gig]) => { const w = window.__jade.world(); if (gig) w.s.best['gig:' + id] = 1; else w.s.done.push(id); }, [id, gig]); return { won: true, fails: 0, secs: 0, skipped: true }; }
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id, gig);
      // (before it starts a person walks up to the flag or the giver, not along the gold line to wherever it last led)
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE20) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}|m${s.mark}|${s.rival ?? ''}|${Math.round(s.x / 64)},${Math.round(s.y / 64)}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { if (process.env.TRACE20 || process.env.WHY20) console.log(`    ${id} failed: ${await W(() => { const w = window.__jade.world(); return JSON.stringify({ why: w.failed?.reason, x: Math.round(w.p.x), y: Math.round(w.p.y), carry: w.p.carry, act: w.p.act?.n ?? null, mark: w.run?.mark ?? null }); })} | step ${s.step} hint ${s.hint}`); fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /dragon boat/i.test(s.hint) ? 'dragon' : /tuk-tuk/i.test(s.hint) ? 'tuktuk' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      // (a warden's ticket, say for jaywalking off a zebra on the way: the E prompt says to pay it, so pay it, as a player would)
      const ok = s.near && (s.near.kind === 'fine' || (s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job' || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      // (a thief in the air, as the hint says: keep near it while it circles; when "It's low", run into it and dash (Space))
      if (s.step === 'bag' && s.bird) {
        const d = Math.hypot(s.bird[0] - s.x, s.bird[1] - s.y);
        if (/low/i.test(s.hint)) { s.to = s.bird; if (d < 90 && ready) { await key(' ', 60); lastKey = Date.now(); } }
        else if (d < 200) { await hold(new Set()); await wait(90); continue; } else s.to = s.bird;
      }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs: (Date.now() - t0) / 1000 };
  }
  /** stand a few steps from a flag or a giver, as if just arrived (off any ride, nothing running) */
  const arrive = async (x, y) => {
    await W(([x, y]) => { const w = window.__jade.world(); w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(x, y); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [x, y]);
    await wait(500); await free();
  };
  const results = {};
  for (const id of NEW) {
    const b = await W(id => { const g = window.__jade.world().gigs().find(g => g.id === id); return g && [g.x, g.y]; }, id);
    await arrive(b[0], b[1] + 70);
    const r = await play(id, true, 220); results[id] = r;
    check(r.won, `${name}: a first-timer finishes the ${id} gig on Normal from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (!r.fails && !r.skipped) results[id].first = true;
    await look(`gig ${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); w.s.best['gig:' + id] = 1; }, id);
  }
  // (each tale's giver, from lib/jade-story.ts)
  const GIVER = { k33: 'seng', k34: 'seng', k35: 'rosie', k36: 'bala', k37: 'kamal', k38: 'vanda' };
  for (const id of TALES) {
    const g = await W(p => { const pl = window.__jade.world().c.places[p]; return [pl.x, pl.y]; }, GIVER[id]);
    await arrive(g[0], g[1] + 90);
    const r = await play(id, false, 260); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} on Normal from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  if (!only) for (const n of ['serve', 'drape', 'hang']) check(await seen(n), `${name}: the ${n} pose was seen`);
  check(!(await exists('jade-ending')), `${name}: no ending`);
  void loc; void appear; void until;
  const first = Object.entries(results).filter(([, r]) => !r.skipped), clean = first.filter(([, r]) => r.won && !r.fails);
  console.log(`  pass 20 first-timer: ${clean.length}/${first.length} first try on Normal; retries: ${first.filter(([, r]) => r.fails).map(([id, r]) => `${id} ${r.fails}`).join(', ') || 'none'}`);
  return results;
}

// The vehicle perks (lib/jade-fleet.ts), clicked through the real UI: for each of the five vehicle businesses, the buy
// panel shows its perk before buying; Buy; the phone's taxi app gets a button to call its ride; the click brings it to
// your side (the wave pose plays); a short walk and E climbs in (the cab with its own step-in pose) and the hero is drawn
// driving or paddling it. Upgrading to levels 2 and 3 through the panel repaints the ride and makes it quicker. Calls are
// refused on a job, with heat and with a ticket, the button greyed with the reason. Owning the depot makes Grab free.
export async function fleetPerks(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const offRide = async () => { for (let i = 0; i < 6 && await W(() => !!window.__jade.world().p.ride); i++) { await key('e', 500); } };
  await W(() => {
    const J = window.__jade, w = J.world(); if (!w.s.done.includes('m1')) J.finishAll(); w.quitJob(); w.s.cash = 60000;
    for (const id of ['taxi', 'bumboat', 'kayak', 'ubinbikes', 'icekacang']) w.s.biz[id].lvl = 0;
    for (const d of Object.keys(w.s.rep)) w.s.rep[d] = Math.max(w.s.rep[d], 100); // (the keepers' reputation, as after the story)
    window.__seenF = new Set(); const f = () => { const w = window.__jade.world(); if (w.p.act) window.__seenF.add(w.p.act.n); requestAnimationFrame(f); }; requestAnimationFrame(f);
  });
  await offRide(); await free();
  const DRAWN = { taxi: /-ride-cab-[01]$/, bumboat: /-ride-pole-[01]$/, kayak: /-ride-kayak-[01]$/, ubinbikes: /-ride-bike-[01]$/, icekacang: /-ride-(moto|bell)-[01]$/ };
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  /** call the business's ride from the phone (the real buttons) and climb in: walk to it, E */
  const callAndBoard = async (id, label) => {
    check(await W(id => window.__jade.toFleet(id), id), `${name}: ${label}: somewhere by the ${id} business to call it from`);
    await press('jade-phone'); await press('phone-taxi');
    check(await appear(`fleet-call-${id}`), `${name}: ${label}: the phone's taxi app has the call button`);
    check(!(await loc(`fleet-call-${id}`).isDisabled()), `${name}: ${label}: the button is live (${await loc(`fleet-why-${id}`).innerText()})`);
    await press(`fleet-call-${id}`); await wait(300);
    const r = await W(id => { const w = window.__jade.world(), r = w.rides.find(r => r.own === id); return r ? { x: r.b.x, y: r.b.y, d: Math.hypot(r.b.x - w.p.x, r.b.y - w.p.y) } : null; }, id);
    check(!!r && r.d < 6 * 64, `${name}: ${label}: the ride comes to your side (${r ? Math.round(r.d) : 'none'} px)`);
    check(await W(() => window.__seenF.has('call-ride')), `${name}: ${label}: the wave-it-over pose plays`);
    await wait(900);
    // walk to it until E offers it
    const t0 = Date.now(); let near = false;
    while (Date.now() - t0 < 8000) {
      const s = await W(id => { const w = window.__jade.world(), r = w.rides.find(r => r.own === id); return { x: w.p.x, y: w.p.y, rx: r.b.x, ry: r.b.y, near: w.near?.ride === r }; }, id);
      if (s.near) { near = true; break; }
      const dx = s.rx - s.x, dy = s.ry - s.y, l = Math.hypot(dx, dy) || 1, keys = new Set();
      if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w');
      await hold(keys); await wait(60);
    }
    await hold(new Set());
    check(near, `${name}: ${label}: a short walk and the E prompt offers the ride`);
    await key('e', 900);
    check(await W(id => window.__jade.world().p.ride?.own === id, id), `${name}: ${label}: E climbs in`);
    // a short drive (a bump into a kerb shows the bump pose for a moment, so the frames are sampled along the way)
    const frames = new Set(); const sample = async ms => { const t1 = Date.now(); while (Date.now() - t1 < ms) { frames.add((await W(() => window.__jade.rideDrawn())).driver); await wait(80); } };
    await sample(400); await hold(new Set(['w'])); await sample(700); await hold(new Set(['s'])); await sample(500); await hold(new Set()); await sample(300);
    check([...frames].some(f => DRAWN[id].test(f)), `${name}: ${label}: the hero is drawn riding it (${[...frames].join(', ') || 'nothing'})`);
    return W(() => window.__jade.ownRide());
  };
  const LABEL = { taxi: 'the taxi depot’s cab', bumboat: 'the bumboat', kayak: 'the Siloso kayak', ubinbikes: 'the Ubin bike', icekacang: 'the ice-cream motorbike' };
  for (const id of ['taxi', 'bumboat', 'kayak', 'ubinbikes', 'icekacang']) {
    const label = LABEL[id];
    await offRide(); await free();
    await W(id => window.__jade.toBiz(id), id); await key('e', 400);
    check(await appear('biz'), `${name}: ${label}: E opens the business`);
    check(/^Perk: /.test(await loc('biz-perk').innerText()), `${name}: ${label}: the perk is on the panel before buying ("${await loc('biz-perk').innerText()}")`);
    await press('biz-buy'); check(await W(id => window.__jade.world().s.biz[id].lvl === 1, id), `${name}: ${label}: Buy`);
    await press('close'); await free();
    const one = await callAndBoard(id, label);
    if (id === 'taxi') check(await W(() => window.__seenF.has('cab-in')), `${name}: ${label}: the step-into-the-cab pose plays`);
    await look(`perk: ${id} level 1`);
    // levels 2 and 3, bought on the panel: a new paint job and a quicker ride
    await offRide(); await free();
    await W(id => window.__jade.toBiz(id), id); await key('e', 400); await appear('biz');
    await press('biz-up'); await press('biz-up'); check(await W(id => window.__jade.world().s.biz[id].lvl === 3, id), `${name}: ${label}: upgraded to level 3 on the panel`);
    await press('close'); await free();
    const three = await callAndBoard(id, `${label} at level 3`);
    check(three.boost > one.boost && (three.sprite !== one.sprite || three.hue !== one.hue), `${name}: ${label}: level 3 is quicker (${one.boost} → ${three.boost}) with new paint (${one.sprite ?? one.hue} → ${three.sprite ?? three.hue})`);
    await look(`perk: ${id} level 3`);
  }
  // refusals: with heat, a ticket or on a job the button is greyed with the reason
  await offRide(); await free(); await W(() => window.__jade.toFleet('taxi'));
  for (const [why, set] of [['heat', 'w.heat = 1'], ['a ticket', "w.ticket = { kind: 'litter', amt: 10 }"]]) {
    await W(set => { const w = window.__jade.world(); new Function('w', set)(w); window.__jade.play.bump(); }, set);
    await press('jade-phone'); await press('phone-taxi'); await appear('fleet-call-taxi');
    check(await loc('fleet-call-taxi').isDisabled(), `${name}: no cab with ${why} (${await loc('fleet-why-taxi').innerText()})`);
    await press('close'); await free();
  }
  await W(() => window.__jade.start('k33'));
  check(await W(() => !!window.__jade.world().run), `${name}: a job is running`);
  {
    await press('jade-phone'); await press('phone-taxi'); await appear('fleet-call-taxi');
    check(await loc('fleet-call-taxi').isDisabled(), `${name}: no cab on a job (${await loc('fleet-why-taxi').innerText()})`);
    await press('close'); await W(() => window.__jade.world().quitJob()); await free();
  }
  // the depot makes Grab free
  await press('jade-phone'); await press('phone-taxi'); await appear('taxi-book');
  check(/free/.test(await loc('taxi-book').innerText()), `${name}: with the depot, the Grab button says it is free ("${await loc('taxi-book').innerText()}")`);
  await press('close'); await free();
  void exists; void until;
}
