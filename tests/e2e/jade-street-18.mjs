// Jade Street in the browser, the eighteenth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Kallang and chapter eleven, "Kallang Roar". Chapter ten's finale opens Kallang (a text from Uncle
// Kubung, chapter eleven's card); the plaque plans a trip there by MRT to Stadium; the district is walked (its market,
// safe house, a property, the match-night fans); both small pleasures by E with their own poses (the Kallang Wave at the
// fan zone, looking up from the old apron); then every chapter-eleven job and the three new Hawker Tales played the way
// a first-timer plays them: nothing is teleported once a job is on offer, the player follows the gold line, reads the
// on-screen hint and the E prompt, and presses only what they name. The new `crowd` step's squeeze and ticket poses are
// checked drawn on the way. Then a screenshot of each. It ends on a hook: no ending.
export async function eighteenth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.gangs.ev = null; w.emp.raid = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  const stand = async (x, y) => { await W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.p.act = null; window.__jade.play.bump(); }, [x, y]); await wait(300); return W(() => { const n = window.__jade.world().near; return n ? { kind: n.kind, id: n.id, label: n.label } : null; }); };
  const at = async (id, dx = 0, dy = 40) => { const [x, y] = await W(id => { const pl = window.__jade.world().c.places[id]; return [pl.x, pl.y]; }, id); return stand(x + dx, y + dy); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 300); };
  const seen = n => W(n => window.__seen18.has(n), n);
  await W(() => {
    window.__seen18 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen18.add(w.p.act.n); if (w.p.anim) window.__seen18.add(w.p.anim); if (w.p.ride) window.__seen18.add('ride:' + w.p.ride.kind); for (const a of w.run?.actors ?? []) if (a.skin) window.__seen18.add('skin:' + a.skin); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const TEN = ['m76', 'm77', 'm78', 'm79', 'm80', 'm81', 'm82', 'm83', 'm84', 'm85'], TALES = ['k27', 'k28', 'k29'];

  // ── chapter ten's finale opens Kallang: a text, chapter eleven's card
  const n0 = await W(TEN_TALES => {
    const J = window.__jade, w = J.world(); J.finishAll(); J.talesAll(); w.s.done = w.s.done.filter(id => !TEN_TALES.includes(id) && id !== 'm75'); w.s.story.ch = 10; w.s.story.lights = true; w.s.story.coast = true; w.s.story.lake = true; w.s.cash = 5000;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay', 'india', 'glam', 'resort', 'orchard', 'katong', 'changi', 'tiong', 'quay', 'jurong', 'pulau']); w.fieldCache.clear(); J.play.scene.dropMap(); w.quitJob(); w.talk = null; w.ui = null;
    const n = Math.max(0, ...w.s.msgs.map(m => m.id)); J.start('m75'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump();
    // (starting m75 replays the story up to it, which leaves the Hawker Tales undone: put back every earlier one)
    J.talesAll(); w.s.done = w.s.done.filter(id => !TEN_TALES.includes(id));
    w.s.settings.partner = 'tag'; w.s.settings.assist = true; return n;
  }, [...TEN, ...TALES]);
  check(await W(() => window.__jade.world().open.has('kallang')), `${name}: Kampong Spirit's finale opens Kallang`);
  check(await W(n => window.__jade.world().s.msgs.some(m => m.id > n && /Kallang Airport/.test(m.text) && /Stadium/.test(m.text)), n0), `${name}: Uncle Kubung texts that Kallang is open, by MRT to Stadium`);
  check(await appear('jade-chapter-card'), `${name}: chapter eleven's card`);
  check(/Kallang Roar/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Kallang Roar`); await wait(400); await look('chapter eleven');
  check(await W(() => { const im = document.querySelector('[data-testid="jade-chapter-card"] img'); return !!im && im.complete && im.naturalWidth > 0 && /bg-chapter-11/.test(im.src); }), `${name}: the card's painting is chapter eleven's`);
  await press('jade-story-skip'); await settle();
  check(await W(() => window.__jade.world().s.story.ch === 11), `${name}: chapter eleven is under way`);
  check(await W(() => window.__jade.jobs().side) === 29 && await W(() => window.__jade.jobs().story) === 85, `${name}: 85 story jobs and 29 Hawker Tales, counted from the data`);

  // ── the plaque plans the trip: a pin on the stadium from Chinatown goes by MRT to Stadium
  await at('safe-market', 0, 64);
  await W(() => { const w = window.__jade.world(), pl = w.c.places.stadium; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); window.__jade.play.bump(); }); await wait(900);
  const tl = await loc('travel-label').innerText().catch(() => '');
  check(/MRT|Stadium/i.test(tl), `${name}: from Chinatown a pin on the stadium is planned by MRT ("${tl.replace(/\n/g, ' ')}")`); await look('plaque: chinatown to kallang');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── Kallang: the fans, the market, the safe house, a property
  await at('stn-stadium', 0, 60); await settle(); await look('stadium station');
  check(await until(() => window.__jade.world().peds.some(q => window.__jade.district(Math.floor(q.x / 64), Math.floor(q.y / 64)) === 'kallang'), null, 6000), `${name}: match-night fans about in Kallang`);
  const nm = await at('mk-kallang'); check(nm?.kind === 'market', `${name}: the mall market's prompt: "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the Kallang Wave Mall market`); await wait(300); await look('market: kallang'); await press('close'); await free();
  const ns = await at('safe-kallang'); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the hangar safe house prompt: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await W(() => { window.__jade.world().s.rep.kallang = 40; }); await E(); check(await appear('safe') && await exists('buy-safe'), `${name}: E opens the hangar safe house for sale`); await press('buy-safe'); await wait(300); }
  await free();
  for (const biz of ['wavekiosk', 'hubsatay', 'rowcafe']) {
    const nb = await W(id => window.__jade.toBiz(id), biz); check(nb?.kind === 'biz', `${name}: a property for sale in Kallang: "${nb?.label}"`);
    if (biz !== 'wavekiosk') continue;
    await E(); check(await appear('biz-panel') || await exists('biz-buy'), `${name}: E opens the property panel`);
    if (await exists('biz-buy')) { await press('biz-buy'); await wait(250); check(await W(id => window.__jade.world().s.biz[id].lvl >= 1, biz), `${name}: Buy buys the scarf kiosk`); }
    await look('property: kallang wave scarf kiosk'); if (await exists('close')) await press('close'); await free();
  }

  // ── the small pleasures, each by E with its own pose
  const wv = await W(() => window.__jade.world().c.kallang.wave);
  let nk = await stand(wv[0], wv[1]); check(nk?.kind === 'kallang' && nk.id === 'wave', `${name}: the Kallang Wave prompt: "${nk?.label}"`);
  await E(); check(await until(() => window.__seen18.has('kwave'), null, 2000), `${name}: the wave plays its own pose`); await wait(500); await look('the kallang wave');
  await until(() => !window.__jade.world().p.act, null, 4000); check(await W(() => window.__jade.world().s.stats.waves >= 1), `${name}: the wave is counted`);
  await free();
  const tw = await W(() => window.__jade.world().c.kallang.tower);
  nk = await stand(tw[0], tw[1] + 24); check(nk?.kind === 'kallang' && nk.id === 'sky', `${name}: the apron prompt: "${nk?.label}"`);
  await E(); check(await until(() => window.__seen18.has('skyward'), null, 2000), `${name}: looking up plays its own pose`); await wait(900); await look('looking up from the old apron');
  await until(() => !window.__jade.world().p.act, null, 5000); check(await W(() => window.__jade.world().s.stats.skies >= 1), `${name}: the look-up is counted`);
  await free();

  // ── every chapter-eleven job and the new Hawker Tales, played as a first-timer
  const state = (id = null) => W(id => {
    const J = window.__jade, w = J.world(), g = id && !w.run ? (w.cast || []).find(c => c.job === id) : null, q = s => document.querySelector(`[data-testid="${s}"]`);
    const r = w.route, k = r.findIndex((q, i) => i > 0 && Math.hypot(q[0] - w.p.x, q[1] - w.p.y) > 60), o = w.objective();
    return { hint: q('objective')?.textContent ?? '', talk: !!q('dialogue'), failed: !!q('retry'), view: !!q('ride-view'), branch: !!q('branch'), mini: window.__jadeMini ? (q('mini-lock') ? 'lock' : 'other') : null,
      run: w.run?.m.id ?? null, step: w.run?.cur?.t ?? null, x: w.p.x, y: w.p.y, ride: w.p.ride?.kind ?? null, act: !!w.p.act,
      near: w.near ? { kind: w.near.kind, id: w.near.id ?? null, ride: w.near.ride?.kind ?? null } : null, ferry: !!w.ferry, to: k >= 0 ? r[k] : r.length ? r[r.length - 1] : o, obj: o, giver: g ? [g.x, g.y] : null, onNet: (() => { const R = w.run, js = R?.js; if (!R || R.cur?.t !== 'trap' || !js || js.ph !== 2) return false; return js.set.some(i => !js.sprung.includes(i) && R.actors.some(a => a.kind === 'lured' && a.extra === 0 && Math.hypot(a.b.x - R.items[i].x, a.b.y - R.items[i].y) < 50)); })(), boostCd: w.p.boostCd };
  }, id);
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
  /** the lock mini-game, as a person plays it: hold Space while the pin rises, let go when it glows */
  const lock = async () => {
    for (let tries = 0; tries < 20 && !(await W(() => !window.__jadeMini || window.__jadeMini.g().done)); tries++) {
      await p.keyboard.down(' '); await until(() => { const g = window.__jadeMini?.g(); return !g || g.glowing() || g.pins[g.sel].h > 0.97; }, null, 4000); await p.keyboard.up(' '); await wait(150);
    }
  };
  const only = process.env.ONLY18 ? process.env.ONLY18.split(',') : null;
  async function play(id, secs) {
    const t0 = Date.now(); let fails = 0, started = false, lastKey = 0, last = '', fAt = 0;
    if (only && !only.includes(id)) { await W(id => window.__jade.world().s.done.push(id), id); return { won: true, fails: 0, secs: 0, skipped: true }; }
    if (process.env.TRACE18) console.log(`  [${id}] tales done`, JSON.stringify(await W(() => window.__jade.world().s.done.filter(x => /^k/.test(x)))));
    if (process.env.TRACE18) console.log(`  [${id}] cast`, JSON.stringify(await W(() => { const w = window.__jade.world(); return { cast: (w.cast || []).filter(c => c.job).map(c => [c.id, c.job, Math.round(c.x), Math.round(c.y)]), ch: w.s.story.ch, run: w.run?.m.id ?? null }; })));
    while (Date.now() - t0 < secs * 1000) {
      const s = await state(id);
      // (before the job starts a person walks up to the giver waving it, not along the gold line to wherever it last led)
      if (s.giver && !started) s.to = s.giver;
      if (process.env.TRACE18) { const k = `${s.run}|${s.step}|${s.ride}|${s.hint}|${s.near?.kind ?? ''}:${s.near?.id ?? ''}`; if (k !== last) { last = k; console.log(`  [${id} ${((Date.now() - t0) / 1000).toFixed(0)}s] ${k} @${s.x.toFixed(0)},${s.y.toFixed(0)}`); } }
      if (s.failed) { fails++; await hold(new Set()); await p.locator('[data-testid="retry"]').click(); await wait(500); continue; }
      if (s.talk) { await hold(new Set()); await key('e', 160); continue; }
      // (the branch cards: the first, which is the way the label already describes, as nets on m74)
      if (s.branch) { await hold(new Set()); await p.locator('[data-testid^="branch-"]').first().click(); await wait(300); continue; }
      if (s.view) { await hold(new Set()); await key('e', 300); continue; }
      if (s.mini === 'lock') { await hold(new Set()); await lock(); continue; }
      if (s.run === id) started = true;
      // (a job that has just failed leaves the run a frame before its card shows: look again for the card's Retry)
      if (started && s.run !== id && !(await W(id => window.__jade.world().s.done.includes(id), id))) { await hold(new Set()); await wait(700); if (await exists('retry')) continue; }
      if (started && s.run !== id) { await hold(new Set()); const won = await W(id => window.__jade.world().s.done.includes(id), id); return { won, fails, secs: (Date.now() - t0) / 1000 }; }
      const now = Date.now(), ready = now - lastKey > 350 && !s.act;
      // (a ride: the one the hint names, as a person reading "step into a dragon boat" picks a dragon boat, not the sampan beside it)
      const want = /dragon boat/i.test(s.hint) ? 'dragon' : /tandem/i.test(s.hint) ? 'tandem' : /bike|bicycle/i.test(s.hint) ? 'bike' : /boat|sampan/i.test(s.hint) ? 'boat' : null;
      const ok = s.near && ((s.near.kind === 'mission' && s.near.id === id) || s.near.kind === 'job' || (s.near.kind === 'ferry' && s.step === 'cable' && !s.ferry) || (s.near.kind === 'ride' && !s.ride && want && s.near.ride === want));
      // (a net: spring it the moment a boar stands on one, as the label says)
      if (s.onNet && ready) { await hold(new Set()); await key('f', 150); lastKey = Date.now(); continue; }
      // (the sack swap: E when a guard is looking away ("Go!"); otherwise send the partner to distract them (F, the game's
      // own tip) and swap while they stare)
      if (s.step === 'swap' && s.near?.kind === 'job' && ready) {
        if (/^Go!/.test(s.hint) || now - fAt < 3000) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
        if (now - fAt > 8000) { await hold(new Set()); await key('f', 200); fAt = Date.now(); lastKey = 0; continue; }
        await hold(new Set()); await wait(120); continue;
      }
      if (ready && ok) { await hold(new Set()); await key('e', 300); lastKey = Date.now(); continue; }
      if (ready && s.ride && /Hop off \(E\)|hop off \(E\)/.test(s.hint)) { await hold(new Set()); await key('e', 400); lastKey = Date.now(); continue; }
      if (ready && /^F: /.test(s.hint)) { await key('f', 150); lastKey = Date.now(); }
      // ("pedal under each tree and press F": a person presses F once they are under the one the gold line points at)
      if (ready && s.ride && /press F/.test(s.hint) && s.to && Math.hypot(s.to[0] - s.x, s.to[1] - s.y) < 150) { await key('f', 150); lastKey = Date.now(); }
      if (/Space: /.test(s.hint) && s.boostCd <= 0) await key(' ', 60);
      // (a tail, as the label says: keep back from the one you follow, keep them in sight, and Tab when it says to)
      if (s.step === 'tail') {
        if (ready && /\(Tab\)/.test(s.hint) && /knows your face/.test(s.hint)) { await hold(new Set()); await key('Tab', 300); lastKey = Date.now(); continue; }
        if (s.obj && Math.hypot(s.obj[0] - s.x, s.obj[1] - s.y) < 280) { await hold(new Set()); await wait(120); continue; }
      }
      // (a crowd, as the hint says: stand still at the edge while it says "Wait", walk on when it says "Go!" or "Squeeze")
      if (s.step === 'crowd' && /^Wait at the edge/.test(s.hint)) { await hold(new Set()); await wait(60); continue; }
      if (/^Wait for|^Here they come|wait for them|Hold the stage/i.test(s.hint) && !s.to) { await hold(new Set()); await wait(150); continue; }
      await steer(s); await wait(90);
    }
    await hold(new Set());
    return { won: false, fails, secs };
  }
  /** stand a little way from a giver, as if just arrived, and play their job */
  const arrive = async (place, dx = 0) => {
    await W(([g, dx]) => { const w = window.__jade.world(), pl = w.c.places[g]; w.quitJob(); if (w.p.ride && !w.exit()) { const r = w.p.ride; r.parked = true; r.b.speed = 0; w.p.ride = null; } w.placePlayer(pl.x + dx, pl.y + (dx ? 80 : 56)); w.p.act = null; w.mate.ai.mode = 'follow'; w.mate.ai.story = false; window.__jade.play.bump(); }, [place, dx]);
    await wait(500); await free();
  };
  // (each job's giver, from lib/jade-story.ts)
  const GIVER = { m76: 'tenuk', m77: 'biru', m78: 'kubung', m79: 'kubung', m80: 'tenuk', m81: 'tenuk', m82: 'kubung', m83: 'biru', m84: 'tenuk', m85: 'biru', k27: 'fanzone', k28: 'club', k29: 'airport' };
  const results = {};
  for (const id of [...TEN, ...TALES]) {
    await arrive(GIVER[id]);
    const r = await play(id, id === 'm81' || id === 'm85' ? 360 : 260); results[id] = r;
    check(r.won, `${name}: a first-timer finishes ${id} from the hints alone (${r.secs.toFixed(0)} s, ${r.fails} retries)`);
    if (id === 'm76') check(await seen('squeeze'), `${name}: squeezing through the crowd plays its own pose`);
    if (id === 'm80') check(await seen('gate-ticket'), `${name}: the ticket at the turnstile plays its own pose`);
    await look(`${id} done`);
    if (!r.won) await W(id => { const w = window.__jade.world(); w.quitJob(); if (!w.s.done.includes(id)) w.s.done.push(id); }, id);
  }
  // the chapter ends on a hook, not an ending: Uncle Kubung's text about the seaplane's bearing, and no finale card
  check(await W(() => window.__jade.world().s.msgs.some(m => /flew south/.test(m.text))), `${name}: Uncle Kubung's text about the seaplane flying south (a hook)`);
  check(!(await exists('jade-ending')), `${name}: no ending after Kallang Roar`);
  for (const n of ['squeeze', 'gate-ticket', 'kwave', 'skyward', 'ride:dragon']) check(await seen(n), `${name}: ${n} was seen`);
  return results;
}
