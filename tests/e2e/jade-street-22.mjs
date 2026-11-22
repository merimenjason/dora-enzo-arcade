// Jade Street in the browser, the twenty-second pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Bukit Timah, the Botanic Gardens and chapter fourteen. Chapter thirteen's finale opens the district
// (chapter fourteen's card); the plaque plans a trip there by the MRT; the district is walked (the trailhead shop, the
// bungalow safe house, the three properties); the small pleasures by E with their own poses (a macaque snatches the snack
// bag and is shooed off, a specimen sheet at the herbarium, a rest on a shelter's log, the summit marker); then every
// chapter-fourteen job, the three new Hawker Tales and the herbarium's side gig played the way a first-timer plays them:
// nothing is teleported once a job is on offer, the player follows the gold line, reads the on-screen hint and the E
// prompt, and presses only what they name. On a summit climb they read the breath on the hint: run while there is plenty,
// walk (Shift) once it is under half, and stand under a glowing rest shelter when it says they are out of breath. The
// hill poses and the macaques are checked drawn on the way. It ends on a hook: no ending.
export async function twentySecond(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id ?? null, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen22.has(n), n);
  await W(() => {
    window.__seen22 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen22.add(w.p.act.n); if (w.p.anim) window.__seen22.add(w.p.anim); if (w.p.ride) window.__seen22.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen22.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const FOURTEEN = ['m106', 'm107', 'm108', 'm109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115'], TALES = ['k42', 'k43', 'k44'];

  // ── chapter thirteen's finale opens Bukit Timah: chapter fourteen's card
  await W(LATER => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id) && id !== 'm105'); w.s.story.ch = 13; w.s.cash = 5000;
    w.open.delete('bukit'); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    J.start('m105'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    // (starting m105 replays the story up to it, which leaves the Hawker Tales undone: put back every earlier one)
    J.talesAll(); w.s.done = w.s.done.filter(id => !LATER.includes(id));
    for (const k of Object.keys(w.s.best)) if (k === 'gig:press-run') delete w.s.best[k];
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; w.s.settings.diff = 'normal';
  }, [...FOURTEEN, ...TALES]);
  check(await W(() => window.__jade.world().open.has('bukit')), `${name}: Raffles Lighthouse's finale opens Bukit Timah`);
  check(await appear('jade-chapter-card'), `${name}: chapter fourteen's card`);
  check(/Bukit Timah/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Bukit Timah`); await wait(400); await look('chapter fourteen');
  check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-14/.test(im.src); }), `${name}: the card's painting is chapter fourteen's`);
  await press('jade-story-skip'); await settle();
  check(await W(() => window.__jade.world().s.story.ch === 14), `${name}: chapter fourteen is under way`);
  check(await W(() => window.__jade.jobs().side) >= 44 && await W(() => window.__jade.jobs().story) >= 115, `${name}: 115 story jobs and 44 Hawker Tales (or more, from later passes), counted from the data`);

  // ── the plaque plans the trip: a pin on the summit from Chinatown goes by the MRT
  await at('safe-market', 0, 64);
  await W(() => { const w = window.__jade.world(), pl = w.c.places['bt-summit']; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/MRT|Beauty World|Botanic/i.test(tl), `${name}: from Chinatown a pin on the summit is planned by the MRT ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: chinatown to bukit timah');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── Bukit Timah: the trailhead shop, the safe house, the properties
  await at('stn-beauty', 0, 60); await settle(); await look('beauty world station');
  await at('stn-botanic', 0, 60); await settle(); await look('botanic gardens station');
  const nm = await at('mk-bukit'); check(nm?.kind === 'market', `${name}: the trailhead shop's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the trailhead shop`); await wait(300); await look('market: trailhead shop'); await press('close'); await free();
  const ns = await at('safe-bukit'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the bungalow safe house prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.bukit = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the bungalow safe house for sale`); await press('buy-safe'); await wait(300); }
  await free();
  for (const biz of ['beautyworld', 'orchidshop', 'railbikes']) {
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale in Bukit Timah: "${nb?.label}"`);
    if (biz !== 'orchidshop') continue;
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the orchid florist`); }
    await look('property: orchid garden florist'); if (await exists('close')) await press('close'); await free();
  }

  // ── the small pleasures: a macaque snatches the snack bag (walk past its haunt), shoo it (E), then the herbarium, a
  // shelter's log and the summit marker, each by E with its own pose
  const K = await W(() => { const c = window.__jade.world().c; return { haunt: c.bukit.haunts[0], summit: c.bukit.summit, shelter: c.bukit.shelters[0], herb: [c.places.herbarium.x, c.places.herbarium.y] }; });
  await stand(K.haunt[0] - 160, K.haunt[1]); await free();
  await p.keyboard.down('d'); await until(() => !!window.__jade.world().p.act, null, 3000); await p.keyboard.up('d');
  check(await until(() => window.__seen22.has('snatched'), null, 2000), `${name}: walking past a haunt, a macaque snatches the snack bag (its own pose)`); await wait(300); await look('a macaque snatches the snack');
  await until(() => !window.__jade.world().p.act, null, 3000); await wait(200);
  const nsh = await W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; });
  check(nsh?.kind === 'bukit' && nsh.id === 'shoo', `${name}: the shoo prompt: "${nsh?.label}"`);
  await E(); check(await until(() => window.__seen22.has('scare'), null, 2000), `${name}: shooing plays its own pose`); await wait(500); await look('shoo the macaque');
  await until(() => !window.__jade.world().p.act, null, 3000); check(await W(() => window.__jade.world().s.stats.shoos >= 1), `${name}: the shoo is counted`); await free();
  for (const [what, xy, id, pose, stat] of [['the herbarium', K.herb, 'specimen', 'specimen', 'specimens'], ['a rest shelter', K.shelter, 'rest:0', 'rest', 'rests'], ['the summit marker', K.summit, 'summit', 'summit', 'summits']]) {
    const nk = await stand(xy[0], xy[1] + (id === 'specimen' ? 40 : 0)); check(nk?.kind === 'bukit' && nk.id === id, `${name}: ${what}'s prompt: "${nk?.label}"`);
    await E(); check(await until(p => window.__seen22.has(p), pose, 2000), `${name}: ${what} plays its own pose (${pose})`); await wait(700); await look(what);
    await until(() => !window.__jade.world().p.act, null, 5000); check(await W(s => window.__jade.world().s.stats[s] >= 1, stat), `${name}: ${what} is counted`);
    await free();
  }

  // ── every chapter-fourteen job, the new Hawker Tales and the side gig, played as a first-timer
  const state = (id, gig) => W(([id, gig]) => {
    const J = window.__jade, w = J.world(), q = s => document.querySelector(`[data-testid="${s}"]`);
    const g = !w.run ? (gig ? w.gigs().find(b => b.id === id) : (w.cast || []).find(c => c.job === id)) : null;
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    // (the rest shelters: the roofs beside the summit trail, glowing gold during a climb)
    const shs = w.c.bukit?.shelters ?? [], shelter = shs.length ? shs.reduce((a, b) => Math.hypot(b[0] - w.p.x, b[1] - w.p.y) < Math.hypot(a[0] - w.p.x, a[1] - w.p.y) ? b : a) : null;
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), mrt: !!q('mrt'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null,
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act, boostCd: w.p.boostCd ?? 0, ferry: !!w.ferry,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null, shelter,
      won: gig ? !!w.s.best['gig:' + id] : w.s.done.includes(id),
      // (a macaque standing on one of the laid nets: what a person watching the nets sees)
      onNet: w.run?.cur?.t === 'trap' && !!w.run.js?.set?.some(i => !w.run.js.sprung.includes(i) && w.run.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - w.run.items[i].x, a.b.y - w.run.items[i].y) < 40)) };
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
  const lock = async () => {
    for (let tries = 0; tries < 20 && !(await W(() => !window.__jadeMini || window.__jadeMini.g().done)); tries++) {
      await p.keyboard.down(' '); await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000); await p.keyboard.up(' '); await wait(150);
    }
  };
  const only = process.env.ONLY22 ? process.env.ONLY22.split(',') : null;
  async function play(id, gig, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    const runId = gig ? 'gig-' + id : id;
    if (only && !only.includes(id)) { await W(([id, gig]) => { const w = window.__jade.world(); if (gig) w.s.best['gig:' + id] = 1; else w.s.done.push(id); }, [id, gig]); return { won: true, fails: 0, secs: 0, skipped: true }; }
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id, gig);
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE22) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { if (process.env.TRACE22 || process.env.WHY22) console.log(`    ${id} failed: step ${s.step} hint ${s.hint}`); fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      // (the MRT map: the station the hint names, Beauty World or Botanic Gardens)
      if (s.mrt) { await hold(new Set()); const want = /Botanic/.test(s.hint) ? 'stn-botanic' : 'stn-beauty'; const b = p.locator(`[data-testid="mrt"] [data-plan="true"]:not([disabled]), [data-testid="mrt-${want}"]:not([disabled])`).first(); if (await b.count()) await b.click(); else await key('Escape', 200); await wait(600); continue; }
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      if (s.run === runId) started = true;
      if (started && s.run !== runId && !s.won) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== runId) { await hold(new Set()); const won = (await state(id, gig)).won; return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      const want = /kayak/i.test(s.hint) ? 'kayak' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && (s.near.kind === 'fine' || (s.near.kind === 'mission' && s.near.id === id) || (s.near.kind === 'gig' && s.near.id === id && !started) || s.near.kind === 'job'
        || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'station' && s.step === 'train') || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      // (the crate swap: E when the hint says "Go!"; otherwise send the partner to distract the crab on watch (F) and swap)
      if (s.step === 'swap' && s.near?.kind === 'job' && ready) {
        if (/^Go!/.test(s.hint) || now - fAt < 3000) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
        if (now - fAt > 8000) { await hold(new Set()); await key('f', 200); fAt = Date.now(); lastKey = 0; continue; }
        await hold(new Set()); await wait(120); continue;
      }
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      // (the trap: keep back, and F the moment a macaque is on a net)
      if (s.step === 'trap' && /spring a net \(F\)/.test(s.hint) && s.onNet && ready) { await key('f', 200); lastKey = Date.now(); continue; }
      if (ready && /^F: /.test(s.hint)) { await key('f', 150); lastKey = Date.now(); }
      // (walking into a hedge, the HUD says "Q hops the hedge": so hop)
      if (ready && /^Q hops the hedge/.test(s.hint)) { await key('q', 120); lastKey = Date.now(); }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      if (s.step === 'chase' && /Space dashes/.test(s.hint) && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 110 && ready) { await key(' ', 60); lastKey = Date.now(); }
      if (s.step === 'tail' && s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      // (a summit climb, as the hint says: it shows the breath left. Run while there is plenty; under half, walk (hold
      // Shift); when it says "Out of breath" and a glowing shelter is close, stand under it while it says "Resting" until
      // the breath is nearly back; "Winded…" says stand still)
      if (s.step === 'summit') {
        const pc = /(\d+)%/.exec(s.hint), br = pc ? +pc[1] : 100, near = s.shelter && Math.hypot(s.shelter[0] - s.x, s.shelter[1] - s.y) < 320;
        if (/^Winded/.test(s.hint)) { await hold(new Set()); await wait(150); continue; }
        if (near && (/^Out of breath/.test(s.hint) || (/^Resting/.test(s.hint) && br < 90))) {
          if (Math.hypot(s.shelter[0] - s.x, s.shelter[1] - s.y) > 50) { s.to = s.shelter; await steer(s, ['Shift']); await wait(60); } else { await hold(new Set()); await wait(150); }
          continue;
        }
        await steer(s, br < 50 ? ['Shift'] : []); await wait(90); continue;
      }
      if (/^Wait for|^Here they come|wait for them|Hold the/i.test(s.hint) && !s.to) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs: (Date.now() - t0) / 1000 };
  }
  const arrive = async (x, y) => {
    await W(([x, y]) => { const w = window.__jade.world(); w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(x, y); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [x, y]);
    await wait(500); await free();
  };
  // (each job's place, from lib/jade-story.ts)
  const AT = { m106: 'camar', m107: 'tenggiling', m108: 'lotong', m109: 'lotong', m110: 'merbah', m111: 'merbah', m112: 'lotong', m113: 'lotong', m114: 'tenggiling', m115: 'merbah', k42: 'bandstand', k43: 'trailhead', k44: 'quarry' };
  const results = {};
  for (const id of [...FOURTEEN, ...TALES]) {
    const g = await W(p => { const pl = window.__jade.world().c.places[p]; return [pl.x, pl.y]; }, AT[id]);
    await arrive(g[0], g[1] + 70);
    const r = await play(id, false, id === 'm106' || id === 'm115' ? 420 : 300); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm107' && !r.skipped) check(await seen('hike'), `${name}: the summit climb plays its own hiking pose`);
    if (id === 'm108' && !r.skipped) check(await seen('skin:mac'), `${name}: the Bukit Bunch macaques raid`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  {
    const b = await W(() => { const g = window.__jade.world().gigs().find(g => g.id === 'press-run'); return g && [g.x, g.y]; });
    check(!!b, `${name}: the herbarium's plant-press flag is up`);
    if (b) {
      await arrive(b[0], b[1] + 70);
      const r = await play('press-run', true, 240); results['press-run'] = r;
      check(r.won, `${name}: a first-timer finishes the press-run gig from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
      await look('gig press-run done');
    }
  }
  // the chapter ends on a hook, not an ending: Dr Merbah's text about the locked drawer, and no finale card
  if (!only) check(await W(() => window.__jade.world().s.msgs.some(m => /drawer/i.test(m.text) && /Tenggiling/.test(m.text))), `${name}: Dr Merbah's text about the locked drawer (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after Bukit Timah`);
  if (!only) for (const n of ['hike', 'snatched', 'scare', 'specimen', 'rest', 'summit']) check(await seen(n), `${name}: ${n} was seen`);
  return results;
}
