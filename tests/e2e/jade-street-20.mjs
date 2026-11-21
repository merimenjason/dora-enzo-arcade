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
  if (await exists('jade-map-btn') || await exists('map')) {
    await press(await exists('jade-map-btn') ? 'jade-map-btn' : 'map'); await wait(500);
    check(await W(ids => ids.every(id => !!document.querySelector(`[data-key="gig-${id}"]`)) || document.querySelectorAll('[data-kind="gig"]').length >= ids.length, NEW), `${name}: the map pins every gig flag`);
    await look('map: gig flags'); if (await exists('close')) await press('close'); await free();
  }

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
      if (process.env.TRACE20) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /dragon boat/i.test(s.hint) ? 'dragon' : /tuk-tuk/i.test(s.hint) ? 'tuktuk' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && ((s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job' || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
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
    await arrive(b[0], b[1] + 150);
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
  for (const n of ['serve', 'drape', 'hang']) check(await seen(n), `${name}: the ${n} pose was seen`);
  check(!(await exists('jade-ending')), `${name}: no ending`);
  void loc; void appear; void until;
  return results;
}
