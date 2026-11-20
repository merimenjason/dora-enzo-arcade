// Jade Street in the browser, the ninth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Little India and Kampong Glam over the Rochor River, Sentosa over the harbour, the Kecoh Mynahs and
// chapter seven. Chapter seven's card when the districts open and Mr Kamal's text; the new districts on screen (their
// markets with the painted stall, a safe house bought); the map's cable car and ferry pins (a click routes there) and
// landmarks; the phone's MRT tab with the cable car and ferry; E at HarbourFront rides the cable car with its
// ride view (a key skips it); E at the pier boards the ferry and E skips the crossing; the festivals by key (light a
// Deepavali lamp, buy a kuih at the bazaar, smell the spices, lie in a deck chair, build a sandcastle); the mynahs
// (shoo one with E, a paint shot with the mouse, ears covered when one sings); a job's cable step; a Hawker Tale in
// the new districts; the Island Lights ending; the Controls rows; and every new pose played.
export async function ninth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 220); };
  const near = () => W(() => { const w = window.__jade.world(); w.findNear(); return w.near ? { kind: w.near.kind, label: w.near.label, id: w.near.id ?? null } : null; });
  const st = () => W(() => { const w = window.__jade.world(); return { cash: w.s.cash, x: w.p.x, y: w.p.y, ...w.s.stats }; });
  const at = (x, y) => W(([x, y]) => { const w = window.__jade.world(); w.p.act = null; w.placePlayer(x, y); w.cars = []; w.findNear(); }, [x, y]);
  const free = () => W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.p.act = null; w.heat = 0; w.wardens = []; w.ticket = null; w.s.cash = Math.max(w.s.cash, 2000); w.gangs.ev = null; window.__jade.play.paused = false; window.__jade.play.bump(); });
  await W(() => {
    window.__seen9 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen9.add(w.p.act.n); if (w.mate.act) window.__seen9.add(w.mate.act.n); for (const m of w.gangs.ev?.mobs ?? []) window.__seen9.add('mob:' + m.st); requestAnimationFrame(f); }; f();
  });

  // ── chapter seven's card: the island's chapter done, the bridges over the Rochor River open
  const n0 = await W(() => {
    const J = window.__jade, w = J.world(); J.finishAll(); w.s.done = w.s.done.filter(id => !/^m(3[5-9]|4\d)$/.test(id)); w.s.story.ch = 6; w.s.story.lights = false;
    w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay']); w.fieldCache.clear(); J.play.scene.map = null; w.quitJob(); w.talk = null; w.ui = null;
    const n = w.s.msgs.length; J.start('m35'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; w.s.story.isle = true; w.fx = w.fx.filter(f => f.t !== 'finale'); J.play.endingT = 0; J.play.paused = false; J.play.bump(); return n;
  });
  check(await W(() => { const o = window.__jade.world().open; return o.has('india') && o.has('glam') && !o.has('resort'); }), `${name}: Island Night opens Little India and Kampong Glam (Sentosa later)`);
  check(await W(n => window.__jade.world().s.msgs.slice(n).some(m => m.from === 'kamal' && /Little India/.test(m.text)), n0), `${name}: Mr Kamal texts that the MRT runs on`);
  check(await appear('jade-chapter-card'), `${name}: chapter seven's card`);
  check(/Island Lights/.test(await loc('jade-chapter-card').innerText()), `${name}: the card names Island Lights`); await wait(300); await look('chapter seven');
  await press('jade-story-skip'); await settle();
  await W(() => { const n = window.__jade.play.notices; n.queue = []; n.shown = []; window.__jade.finishAll(); window.__jade.world().s.story.lights = true; window.__jade.world().s.story.ch = 7; }); await free();

  // ── the new districts on screen
  for (const [pl, what, d] of [['temple-li', 'the temple on Serangoon Road', 'india'], ['flowers', 'the flower stalls', 'india'], ['mosque', 'the golden-domed mosque', 'glam'], ['hajilane', 'Haji Lane', 'glam'], ['beach', 'Siloso Beach', 'resort'], ['fort', 'Fort Siloso', 'resort'], ['park', 'the theme park', 'resort']]) {
    await W(pl => window.__jade.teleportTo(pl), pl); await wait(700);
    check(await W(d => { const w = window.__jade.world(); return window.__jade.district(Math.floor(w.p.x / 64), Math.floor(w.p.y / 64)) === d; }, d), `${name}: ${what} is in ${d}`); await look(what);
  }
  // the districts' paintings arrived as the heroes went there (lib/jade-load.ts)
  check(await until(() => window.__jade.art().files.includes('atlas-resort') && !window.__jade.artWait(), null, 15000), `${name}: the new districts' paintings load as the heroes get there`);
  // a market with its own stall painting, and a safe house for sale
  await W(() => window.__jade.teleportTo('mk-india')); await wait(300);
  const nm = await near(); check(nm?.kind === 'market', `${name}: Tekka Market offers "${nm?.label}"`);
  await E(); check(await appear('market'), `${name}: E opens the market ${await W(() => { const w = window.__jade.world(); return JSON.stringify({ ui: w.ui, talk: !!w.talk, act: w.p.act?.n, paused: window.__jade.play.paused, near: w.near?.kind }); })}`);
  check((await p.locator('[data-testid="market"] img').getAttribute('src'))?.includes('bg-stall-india'), `${name}: Mr Raju's stall painting`); await wait(300); await look('market: Tekka');
  await press('close'); await free();
  await W(() => { const w = window.__jade.world(), s = w.s; s.dailyDone = s.dailyDone.filter(x => x !== 'house:safe-glam'); delete s.best['house:safe-glam']; s.trophies = s.trophies.filter(x => x !== 'safe:safe-glam'); s.cash = 2000; s.rep.glam = Math.max(s.rep.glam ?? 0, 20); window.__jade.teleportTo('safe-glam'); }); await wait(300);
  const ns = await near(); check(ns?.kind === 'buy-safe' || ns?.kind === 'safe', `${name}: the Kandahar Street safe house: "${ns?.label}"`);
  if (ns?.kind === 'buy-safe') { await E(); check(await appear('buy-safe'), `${name}: it is for sale`); await press('buy-safe'); await wait(200); check(await W(() => { const s = window.__jade.world().s; return s.dailyDone.includes('house:safe-glam') || s.best['house:safe-glam'] === 1; }), `${name}: bought`); await look('safe house: Kandahar Street'); }
  await free();

  // ── the map: the cable car and ferry pins (a click routes there) and the new landmarks
  await press('map-btn'); for (let i = 0; i < 6; i++) await press('jade-map-zoom-out');
  check(await p.locator('[data-testid="jade-map-pin"][data-kind="cable"]').count() === 2, `${name}: two cable car pins on the map`);
  check(await p.locator('[data-testid="jade-map-pin"][data-kind="ferry"]').count() === 2, `${name}: two ferry pins`);
  if (!(await loc('jade-map-legend').innerText()).includes('Cable car')) await press('jade-map-legend-toggle');
  check(/Cable car/.test(await loc('jade-map-legend').innerText()) && /Ferry/.test(await loc('jade-map-legend').innerText()), `${name}: the map key lists the cable car and the ferry`); await look('map: Sentosa links');
  await p.locator('[data-testid="jade-map-pin"][data-key="cable-harbour"]').click({ force: true }); await wait(200);
  const hb = await W(() => { const s = window.__jade.world().c.places['cable-harbour']; return [s.x, s.y]; });
  check(!(await exists('map')) && await W(hb => { const wp = window.__jade.world().waypoint; return !!wp && Math.hypot(wp[0] - hb[0], wp[1] - hb[1]) < 200; }, hb), `${name}: a click on the cable car pin routes there`);
  // the phone's MRT tab: the new stations, the cable car and the ferry with Route me
  await press('jade-phone'); await press('phone-mrt');
  check(await p.locator('[data-testid^="mrt-route-"]').count() === 13, `${name}: thirteen MRT stations on the phone`);
  check(await p.locator('[data-testid^="link-route-"]').count() === 4, `${name}: the cable car and ferry stops listed`); await look('phone: links');
  await press('link-route-ferry-bay'); check(!(await exists('jade-phone-msgs')) && await W(() => !!window.__jade.world().waypoint), `${name}: Route me to the ferry pier`);
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; }); await free();

  // ── the cable car: E at HarbourFront, the ride view, any key skips it
  await W(() => window.__jade.teleportTo('cable-harbour')); await wait(300);
  const nc = await near(); check(nc?.kind === 'cable' && /cable car/i.test(nc.label), `${name}: the station offers "${nc?.label}"`);
  const c0 = await st(); await E();
  check(await appear('ride-view'), `${name}: E rides the cable car with its ride view`); await wait(500);
  check(/Sentosa/.test(await loc('ride-view').innerText()), `${name}: the ride view names the stop`); await look('cable car ride');
  await key('Space', 300); check(!(await exists('ride-view')), `${name}: a key skips the ride view`);
  const c1 = await st(); check(c1.cable === c0.cable + 1 && c1.cash === c0.cash - 4, `${name}: one ride, 4 coins`);
  check(await W(() => { const w = window.__jade.world(); return window.__jade.district(Math.floor(w.p.x / 64), Math.floor(w.p.y / 64)) === 'resort'; }), `${name}: off at Sentosa`); await look('cable car: Sentosa station');
  await free();

  // ── the ferry: E at the Sentosa pier, the crossing, E skips to the pier
  await W(() => window.__jade.teleportTo('ferry-sentosa')); await wait(300);
  const nf = await near(); check(nf?.kind === 'ferry', `${name}: the pier offers "${nf?.label}"`);
  const f0 = await st(); await E();
  check(await until(() => !!window.__jade.world().ferry, null, 2000), `${name}: aboard the ferry`); await wait(1500); await look('ferry crossing');
  check(await W(f0 => window.__jade.world().p.x !== f0.x, f0), `${name}: the ferry carries you`);
  check((await near())?.label === 'Skip to the pier', `${name}: E skips the crossing`); await key('e', 300);
  check(await until(() => !window.__jade.world().ferry, null, 2000) && (await st()).ferry === f0.ferry + 1, `${name}: off at Marina Bay`); await free();

  // ── the festivals follow the calendar (the twelfth pass): a date in Deepavali's season, then one in the bazaar's
  await W(() => { const w = window.__jade.world(); w.today = '2026-11-01'; w.s.night = 2; window.__jade.step(2); });
  const lamp = await W(() => window.__jade.world().c.east.lamps[0]); await at(lamp[0], lamp[1] + 20); await wait(250);
  check(/Deepavali lamp/.test((await near())?.label ?? ''), `${name}: "Light a Deepavali lamp"`); await look('deepavali: lamps and arch');
  await E(); check(await until(() => window.__jade.world().p.act?.n === 'light-lamp', null, 1500), `${name}: E lights the lamp`); await wait(400); await look('deepavali: lighting');
  check(await until(() => window.__jade.world().east.lit.has(0), null, 3000), `${name}: the lamp is lit`);
  await W(() => { const w = window.__jade.world(); w.today = '2027-03-01'; w.s.night = 3; window.__jade.step(2); }); await free();
  const baz = await W(() => window.__jade.world().c.east.bazaar[0]); await at(baz[0], baz[1] + 70); await wait(250);
  check(/kuih/.test((await near())?.label ?? ''), `${name}: "Buy a kuih at the bazaar"`); await look('hari raya bazaar');
  const k0 = await st(); await E(); check(await until(() => window.__jade.world().p.act?.n === 'kuih', null, 1500), `${name}: E buys a kuih and eats it`); await wait(400); await look('bazaar: kuih');
  check((await st()).cash === k0.cash - 3, `${name}: 3 coins`);
  await W(() => window.__jade.teleportTo('spices')); await wait(300);
  check(/spices/.test((await near())?.label ?? ''), `${name}: "Smell the spices"`); await E();
  check(await until(() => window.__jade.world().p.act?.n === 'sniff', null, 1500), `${name}: the sniff`); await wait(400); await look('spices: sniff');
  const chair = await W(() => window.__jade.world().c.east.chairs[0]); await at(chair[0], chair[1]); await wait(250);
  check(/deck chair/.test((await near())?.label ?? ''), `${name}: "Lie back in the deck chair"`); await E();
  check(await until(() => window.__jade.world().p.act?.n === 'lounge', null, 1500), `${name}: lounging`); await wait(500); await look('beach: deck chair');
  const sand = await W(() => window.__jade.world().c.east.beach[1]); await at(sand[0], sand[1]); await wait(250);
  check(/sandcastle/.test((await near())?.label ?? ''), `${name}: "Build a sandcastle"`); await E();
  check(await until(() => window.__jade.world().p.act?.n === 'castle', null, 1500), `${name}: building`); await wait(2600); await look('beach: sandcastle');
  check(await W(() => [...window.__jade.world().east.once].some(id => id.startsWith('castle:'))), `${name}: the sandcastle stays`);
  await free();

  // ── the Kecoh Mynahs: E shoos one, a paint shot makes one preen, a singing one makes you cover your ears
  await W(() => { window.__jade.teleportTo('serangoon'); window.__jade.give(['paint']); const w = window.__jade.world(), s = w.s, h = w.p.who; s.gear.carry[h] = ['paint']; s.gear.slot[h] = 0; s.gear.clip.paint = 6; s.gear.ammo.paint = 30; });
  check(await W(() => window.__jade.gang('mynahs')), `${name}: the Kecoh Mynahs turn up on their turf`); await wait(500); await look('mynahs');
  const mob = await W(() => { const w = window.__jade.world(), m = w.gangs.ev.mobs.find(m => m.has && m.st === 'run' && m.fly === undefined); if (!m) return null; m.b.speed = 0; /* (beside it on a side where a parked van's prompt is not nearer) */ for (const [dx, dy] of [[0, 50], [0, -50], [50, 0], [-50, 0]]) { w.placePlayer(m.b.x + dx, m.b.y + dy); w.findNear(); if (/Shoo the mynah/.test(w.near?.label ?? '')) break; } return { id: m.id, near: w.near?.label ?? '', ride: w.p.ride?.kind ?? null }; });
  check(/Shoo the mynah/.test(mob?.near ?? ''), `${name}: "Shoo the mynah!" (${JSON.stringify(mob)})`); await key('e', 300);
  check(await until(() => window.__jade.world().p.act?.n === 'shoo', null, 1500), `${name}: E shoos it`); await wait(500);
  // a paint shot with the mouse
  // (pass 13: deterministic. A mynah within 220 of you hops into the air at random (and the camera was still easing
  // after the hero was placed), so the click could land where the bird had been. The target is now held on the
  // ground every frame, the hero stands 300 away, and the click waits for the camera to settle on the bird)
  // (20-11-2026: still about 1 in 5 missed. placePlayer puts you on the nearest free tile, up to 160 off the spot asked
  // for, and a shot stops at the first stall, building, passer-by or warden in its way, which Serangoon Road is full of.
  // The hero now stands where the line to the bird is clear of solid tiles, and nobody walks into that line)
  const tgt = await W(() => {
    // (any bird still about, set running with its loot: the shooed one may have been the only one running)
    const w = window.__jade.world(), m = w.gangs.ev?.mobs.find(m => m.has && m.st === 'run') ?? w.gangs.ev?.mobs.find(m => m.st !== 'gone'); if (!m) return null;
    m.st = 'run'; m.has = true; m.t = 0; window.__pin9m = m; m.fly = undefined; m.b.speed = 0; m.sing = undefined; const x = m.b.x, y = m.b.y; w.s.settings.assist = true;
    const NW = window.__jade.layout.NW, clear = (ax, ay) => { for (let k = 0.08; k < 0.95; k += 0.03) { const sx = ax + (x - ax) * k, sy = ay - 26 + (y - ay + 26) * k, so = w.c.solid[Math.floor(sy / 64) * NW + Math.floor(sx / 64)]; if (so === 1 || so === 3) return false; } return true; };
    let spot = null;
    for (const [dx, dy] of [[-300, 0], [300, 0], [0, 300], [0, -300], [-220, 200], [220, 200], [-220, -200], [220, -200], [-200, 0], [200, 0], [0, 200], [0, -200]]) { w.placePlayer(x + dx, y + dy); if (Math.hypot(w.p.x - x - dx, w.p.y - y - dy) < 24 && clear(w.p.x, w.p.y)) { spot = [w.p.x, w.p.y]; break; } }
    if (!spot) { w.placePlayer(x - 300, y); spot = [w.p.x, w.p.y]; }
    // (the line of fire, from the hero's hands (26 up) to the bird: passers-by, wardens and the other mynahs keep off it)
    const inLine = (px, py) => { const ax = spot[0], ay = spot[1] - 26, vx = x - ax, vy = y - ay, k = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - vx * k, py - ay - vy * k) < 48; };
    window.__pin9 = true; const hold = () => {
      if (!window.__pin9) return;
      if (m.st === 'run') { m.b.x = x; m.b.y = y; m.b.speed = 0; m.fly = undefined; }
      w.peds = w.peds.filter(pd => !inLine(pd.x, pd.y)); w.wardens = w.wardens.filter(wd => !inLine(wd.b.x, wd.b.y));
      for (const o of w.gangs.ev?.mobs ?? []) if (o !== m && o.st === 'run' && inLine(o.b.x, o.b.y)) o.b.x += 200;
      requestAnimationFrame(hold);
    }; hold();
    return true;
  });
  const steady = async () => { let a = null; for (let i = 0; i < 20; i++) { const b = await W(() => { const m = window.__pin9m; return m && m.st === 'run' ? window.__jade.screenOf(m.b.x / 64, m.b.y / 64).map(Math.round) : null; }); if (a && b && Math.abs(a[0] - b[0]) < 2 && Math.abs(a[1] - b[1]) < 2) return b; a = b; await wait(100); } return a; };
  for (let k = 0; tgt && k < 3 && !(await W(() => window.__seen9.has('mob:preen'))); k++) {
    const t2 = await steady();
    if (t2) { await p.mouse.move(t2[0], t2[1]); await p.mouse.down(); await wait(60); await p.mouse.up(); }
    await until(() => window.__seen9.has('mob:preen'), null, 1500);
  }
  check(await until(() => window.__seen9.has('mob:preen'), null, 2500), `${name}: a paint shot: the mynah stops to preen${tgt ? '' : ' (no mynah left to aim at)'}`); await look('mynah: preening');
  await W(() => { window.__pin9 = false; });
  // one sings nearby: paws over the ears
  // (a mynah sings now and then at random: keep the flock close by until one does)
  await W(() => { const w = window.__jade.world(); window.__jade.gang('mynahs'); w.p.act = null; const t0 = performance.now(); const hold = () => { const ev = w.gangs.ev; if (!ev || performance.now() - t0 > 8000 || window.__seen9.has('ears')) return; ev.mobs.forEach((m, i) => { if (m.st === 'run') { m.b.x = w.p.x + 110 + i * 20; m.b.y = w.p.y + 10; m.fly = undefined; } }); requestAnimationFrame(hold); }; hold(); });
  check(await until(() => window.__seen9.has('ears'), null, 8500), `${name}: a singing mynah: paws over the ears`); await look('mynah: singing');
  await free();

  // ── a job's cable step: Up the Cable Car rides it and goes on from Sentosa
  check(await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm42'); J.job('m42'); w.talk = null; return J.enterStep(J.stepOf('cable')); }) === 'cable', `${name}: Up the Cable Car: the cable step`);
  await W(() => { window.__jade.world().talk = null; window.__jade.teleportTo('cable-harbour'); }); await wait(300);
  const nj = await near(); check(nj?.kind === 'cable', `${name}: the job's cable step at the station: "${nj?.label}" (${await W(() => JSON.stringify([window.__jade.world().p.ride?.kind, window.__jade.world().run?.m.id, window.__jade.world().run?.cur?.t]))})`);
  await E(); check(await appear('ride-view'), `${name}: E rides the job's cable car`); await key('Enter', 300);
  check(await W(() => window.__jade.world().run?.cur?.t !== 'cable'), `${name}: the job goes on from Sentosa`); await look('job: after the cable car');
  await W(() => { window.__jade.world().quitJob(); }); await free();

  // ── a Hawker Tale in the new districts: Teh Tarik Time at Mr Raju's
  check(await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'k11'); return J.job('k11'); }) !== null, `${name}: Teh Tarik Time starts`);
  await wait(400); await look('hawker tale: teh tarik'); await W(() => { window.__jade.world().quitJob(); }); await free();

  // ── the Island Lights ending
  await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm45'); w.s.story.lights = false; w.finishMission(J.mission('m45')); w.talk = null; J.play.bump(); });
  check(await p.waitForSelector('[data-testid="jade-ending"]', { timeout: 9000 }).then(() => true, () => false), `${name}: the Island Lights ending plays`);
  check(/Island Lights|lights/i.test(await loc('jade-ending').innerText()), `${name}: it is the new ending`); await look('island lights ending');
  await press('jade-story-skip'); if (await appear('jade-credits')) await press('jade-credits-done');
  check(await W(() => window.__jade.world().s.story.lights), `${name}: the ending is remembered`); await settle();

  // ── the Controls page lists the cable car, the ferry and the festivals
  await press('pause-btn'); await press('tab-controls');
  const ctl = await loc('jade-controls').innerText(); check(/[Cc]able car/.test(ctl) && /[Ff]erry/.test(ctl) && /lamp|festival/i.test(ctl), `${name}: the Controls page has the cable car, ferry and festivals`);
  await press('close'); if (await exists('resume')) await press('resume');
  check(await W(() => !!(localStorage.getItem('jade-street-v13') ?? localStorage.getItem('jade-street-v12'))), `${name}: saved`);

  // ── playtest fixes: Esc closes the top-most panel (not Pause), the next-job plaque, Route me in the jobs book and on a job text
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; }); await settle();
  await press('jade-phone'); check(await appear('jade-phone-msgs'), `${name}: the phone opens`);
  await key('Escape', 300);
  check(!(await exists('jade-phone-msgs')) && !(await exists('resume')), `${name}: Esc closes the phone, not into Pause`);
  await press('map-btn'); check(await appear('map'), `${name}: the map opens`);
  await key('Escape', 300); check(!(await exists('map')) && !(await exists('resume')), `${name}: Esc closes the map`);
  await press('pause-btn'); check(await appear('resume'), `${name}: paused`); await key('Escape', 300); check(!(await exists('resume')), `${name}: Esc closes Pause`);
  // a job on offer: the plaque names it, the jobs book routes there, a job text has Route me
  const offer = await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm45' && id !== 'k13'); w.s.story.ending = false; w.waypoint = null; for (const id of ['k13', 'm45']) w.offered.delete(id); w.s.msgs = w.s.msgs.filter(m => m.job !== 'k13' && m.job !== 'm45'); return w.nextJob()?.id ?? null; });
  check(!!offer, `${name}: a job on offer (${offer})`);
  check(await appear('next-job'), `${name}: the next-job plaque in free roam`); await look('next job plaque');
  await press('pause-btn'); await press('tab-jobs');
  check(await exists(`jade-route-${offer}`), `${name}: the jobs book has Route me for ${offer}`);
  await press(`jade-route-${offer}`); check(await W(() => !!window.__jade.world().waypoint), `${name}: Route me sets the gold line`);
  if (await exists('close')) await press('close'); if (await exists('resume')) await press('resume');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; }); await wait(1200);
  await press('jade-phone');
  const rb = await W(() => [...document.querySelectorAll('[data-testid^="msg-route-"]')].map(e => e.dataset.testid));
  check(rb.length > 0, `${name}: a job text has Route me (${rb.join(', ')})`);
  if (rb.length) { await press(rb[0]); check(await W(() => !!window.__jade.world().waypoint) && !(await exists('jade-phone-msgs')), `${name}: Route me on a text sets the gold line and closes the phone`); }
  else await key('Escape', 300);
  await W(() => { const w = window.__jade.world(); w.s.done.push('k13', 'm45'); w.s.story.ending = true; w.waypoint = null; });

  // ── every new pose was played
  const seen = await W(() => [...window.__seen9]);
  for (const a of ['light-lamp', 'kuih', 'sniff', 'lounge', 'castle', 'ears', 'shoo']) check(seen.includes(a), `${name}: the ${a} pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; window.__jade.play.paused = false; });
  await settle();
}
