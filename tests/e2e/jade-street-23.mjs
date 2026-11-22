// Jade Street in the browser, the twenty-third pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): second helpings. With the story done, the districts that had one side gig flag have a second (Little
// India two), each pinned on the big map; a giver texts about theirs once the first flags are played, and the text's
// Route me points the gold line at the flag. Then every new gig and the eight new Hawker Tales are played on Normal,
// Assist off, the way a first-timer plays: nothing is teleported once the player has arrived near the flag or the giver;
// they walk up to it, press E on the prompt, follow the gold line, read the on-screen hint and the E prompt, and press
// only what those name (Shift to creep when the torch trail's hint says so, Space when it says to dash or surge). The
// new acts' poses (the camera at a mural, planting a mangrove seedling) are checked drawn on the way. No ending.
export async function twentyThird(h) {
  const { p, W, press, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const seen = n => W(n => window.__seen23.has(n), n);
  await W(() => {
    window.__seen23 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen23.add(w.p.act.n); if (w.p.anim) window.__seen23.add(w.p.anim); if (w.p.ride) window.__seen23.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen23.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const TALES = ['k45', 'k46', 'k47', 'k48', 'k49', 'k50', 'k51', 'k52'];
  const NEW = ['lion-dash', 'jasmine-myna', 'tekka-sprint', 'photo-walk', 'siloso-run', 'stars-orchard', 'coast-ride', 'satay-quay', 'pagoda-run', 'mangroves', 'water-station', 'night-count', 'beach-clean'];

  // ── the story done, every district open, Normal with Assist off; the first flags played, the new ones and the tales not
  await W(([TALES, NEW]) => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !TALES.includes(id)); w.s.cash = 5000;
    w.quitJob(); w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false;
    for (const k of Object.keys(w.s.best)) if (/^gigs?:/.test(k)) delete w.s.best[k];
    for (const g of w.gigs()) if (!NEW.includes(g.id)) w.s.best['gig:' + g.id] = 1;
    w.s.msgs = w.s.msgs.filter(m => !m.gig);
    w.s.settings.partner = 'tag'; w.s.settings.assist = false; w.s.settings.diff = 'normal'; w.assist = false; J.play.bump();
  }, [TALES, NEW]);
  await settle();
  const ups = await W(() => window.__jade.world().gigs().map(g => g.id));
  check(NEW.every(id => ups.includes(id)), `${name}: every new gig flag is up (${NEW.filter(id => !ups.includes(id)).join(', ') || 'all'})`);
  const counts = await W(() => window.__jade.jobs());
  check(counts.side >= 52, `${name}: ${counts.side} Hawker Tales, counted from the data (eight new)`);

  // ── the map shows the new flags
  await press('map-btn'); check(await appear('map'), `${name}: the map opens`); await wait(500);
  for (let i = 0; i < 8; i++) await press('jade-map-zoom-out'); await wait(400);
  const pins = await W(() => [...document.querySelectorAll('[data-testid="jade-map-pin"][data-kind="gig"]')].map(e => e.getAttribute('data-key')));
  check(NEW.every(id => pins.includes('gig-' + id)), `${name}: the map pins every new gig flag (${NEW.filter(id => !pins.includes('gig-' + id)).join(', ') || 'all there'})`);
  await look('map: the new gig flags'); await press('close'); await free();

  // ── a second board's giver texts about it; Route me points the gold line at the flag
  await W(() => { const w = window.__jade.world(); w.s.night++; w.tick = 0; });
  check(await until(() => window.__jade.world().s.msgs.some(m => m.gig), null, 6000), `${name}: a giver texts about their new side gig`);
  const gt = await W(() => { const m = window.__jade.world().s.msgs.filter(m => m.gig).pop(); return { gig: m.gig, from: m.from, text: m.text }; });
  check(NEW.includes(gt.gig), `${name}: the text is about a new gig (${gt.gig})`);
  await press('jade-phone'); await wait(300);
  check(await exists(`msg-route-gig-${gt.gig}`), `${name}: ${gt.from}'s text ("${gt.text}") has Route me`); await look('phone: a new gig text');
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
      bird: (() => { const a = (w.run?.actors ?? []).find(a => a.kind === 'bagbird' && !a.gone); return a ? [a.b.x, a.b.y] : null; })(),
      won: gig ? !!w.s.best['gig:' + id] : w.s.done.includes(id) };
  }, [id, gig]);
  let held = new Set();
  const hold = async keys => { for (const k of held) if (!keys.has(k)) await p.keyboard.up(k); for (const k of keys) if (!held.has(k)) await p.keyboard.down(k); held = keys; };
  let stuckAt = null, side = 0;
  const steer = async (s, extra = []) => {
    const keys = new Set(); if (s.to) { const dx = s.to[0] - s.x, dy = s.to[1] - s.y, l = Math.hypot(dx, dy) || 1; if (l > 20) { if (dx / l > 0.38) keys.add('d'); if (dx / l < -0.38) keys.add('a'); if (dy / l > 0.38) keys.add('s'); if (dy / l < -0.38) keys.add('w'); } }
    const now = Date.now();
    if (!keys.size || !stuckAt || Math.hypot(s.x - stuckAt.x, s.y - stuckAt.y) > 12) stuckAt = { x: s.x, y: s.y, t: now };
    else if (now - stuckAt.t > 1000 && now > side) side = now + 500;
    if (now < side) { const across = keys.has('a') || keys.has('d') ? ['w', 's'] : ['a', 'd']; keys.clear(); keys.add(across[Math.floor(side / 500) % 2]); if (now >= side - 40) stuckAt = null; }
    for (const k of extra) keys.add(k);
    await hold(keys);
  };
  const only = process.env.ONLY23 ? process.env.ONLY23.split(',') : null;
  async function play(id, gig, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', lastTr = 0;
    const runId = gig ? 'gig-' + id : id;
    if (only && !only.includes(id)) { await W(([id, gig]) => { const w = window.__jade.world(); if (gig) w.s.best['gig:' + id] = 1; else w.s.done.push(id); }, [id, gig]); return { won: true, fails: 0, secs: 0, skipped: true }; }
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id, gig);
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE23) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last || (process.env.TRACE23 === '2' && Date.now() - lastTr > 3000)) { last = k; lastTr = Date.now(); console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)} obj ${s.obj ? s.obj.map(Math.round) : ''} to ${s.to ? s.to.map(Math.round) : ''}`); } }
      if (s.failed) { if (process.env.TRACE23 || process.env.WHY23) console.log(`    ${id} failed: step ${s.step} hint ${s.hint}`); fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /dragon boat/i.test(s.hint) ? 'dragon' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && (s.near.kind === 'fine' || (s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job' || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (ready && /^F: /.test(s.hint)) { await key('f', 150); lastKey = Date.now(); }
      if (ready && /^Q hops the hedge/.test(s.hint)) { await key('q', 120); lastKey = Date.now(); }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      // (a pounce: the hint says F sends your partner in, so press F when the one you chase is near, then dash)
      if (s.step === 'chase' && /F sends/.test(s.hint) && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 170 && ready) { await key('f', 150); lastKey = Date.now(); }
      // (a chase whose hint says "Space dashes": a dash when the one you chase is close)
      if (s.step === 'chase' && /Space dashes|dash/i.test(s.hint) && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 110 && ready) { await key(' ', 60); lastKey = Date.now(); }
      // (following someone: hang back when close, as the hint says to stay out of sight)
      if (s.step === 'tail' && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      // (a thief in the air: keep near it while it circles; when "It's low", run into it and dash (Space))
      if (s.step === 'bag' && s.bird) {
        const d = Math.hypot(s.bird[0] - s.x, s.bird[1] - s.y);
        if (/low/i.test(s.hint)) { s.to = s.bird; if (d < 90 && ready) { await key(' ', 60); lastKey = Date.now(); } }
        else if (d < 200) { await hold(new Set()); await wait(90); continue; } else s.to = s.bird;
      }
      // (a torch trail: "stirring" says stand still; a hint that names creeping or Shift says hold Shift and creep)
      if (s.step === 'torch' && /stirring/.test(s.hint)) { await hold(new Set()); await wait(400); continue; }
      if (s.step === 'torch' && /Shh|[Cc]reep|hold Shift|Hold Shift/.test(s.hint) && !/^Follow|^Walk|^Lead|^Take/.test(s.hint)) { await steer(s, ['Shift']); await wait(90); continue; }
      if (/^Wait for|wait for them/i.test(s.hint) && !s.to) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs: (Date.now() - t0) / 1000 };
  }
  const arrive = async (x, y) => {
    await W(([x, y]) => { const w = window.__jade.world(); w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(x, y); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [x, y]);
    await wait(500); await free();
  };
  const results = {};
  for (const id of NEW) {
    const b = await W(id => { const g = window.__jade.world().gigs().find(g => g.id === id); return g && [g.x, g.y]; }, id);
    await arrive(b[0], b[1] + 70);
    const r = await play(id, true, 240); results[id] = r;
    check(r.won, `${name}: a first-timer finishes the ${id} gig on Normal from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    await look(`gig ${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); w.s.best['gig:' + id] = 1; }, id);
  }
  const GIVER = { k45: 'gizmo', k46: 'heron', k47: 'raju', k48: 'kancil', k49: 'faiz', k50: 'musang', k51: 'bintu', k52: 'camar' };
  for (const id of TALES) {
    const g = await W(p => { const pl = window.__jade.world().c.places[p]; return [pl.x, pl.y]; }, GIVER[id]);
    await arrive(g[0], g[1] + 90);
    const r = await play(id, false, 300); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} on Normal from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  if (!only) for (const n of ['photo', 'plant', 'serve', 'torch', 'skin:mac', 'skin:otter', 'skin:myna']) check(await seen(n), `${name}: ${n} was seen`);
  check(!(await exists('jade-ending')), `${name}: no ending`);
  const first = Object.entries(results).filter(([, r]) => !r.skipped), clean = first.filter(([, r]) => r.won && !r.fails);
  console.log(`  pass 23 first-timer: ${clean.length}/${first.length} first try on Normal; retries: ${first.filter(([, r]) => r.fails).map(([id, r]) => `${id} ${r.fails}`).join(', ') || 'none'}; lost: ${first.filter(([, r]) => !r.won).map(([id]) => id).join(', ') || 'none'}`);
  return results;
}
