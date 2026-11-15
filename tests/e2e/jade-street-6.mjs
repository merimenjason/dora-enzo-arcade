// Jade Street in the browser, the sixth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): the island. The chapter-six card, Toa Payoh and Marina Bay on screen, the Jade Line (E at the gates,
// tap the card, pick a stop by click, the ride view with both heroes, a key skips it, a durian on the train is fined),
// a taxi hailed with G (it pulls up, you point, E gets in, a drop-off by click, E skips the ride) and one booked
// through the Tumpang! app on the phone, the slide at the playground, scooter wardens on the roads, the Longkang
// Lizards, the notice queue, a train-race job on the island, the island's ending and dancing on the Float-About Stage.
// Every new action is pressed with a real key or click; each screen is photographed.
export async function sixth(h) {
  const { p, W, press, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 220); };
  const near = () => W(() => { const w = window.__jade.world(); w.findNear(); return w.near ? { kind: w.near.kind, id: w.near.id ?? '', label: w.near.label } : null; });
  const st = () => W(() => { const w = window.__jade.world(); return { x: w.p.x / 64, y: w.p.y / 64, cash: w.s.cash, mrt: w.s.stats.mrt, taxi: w.s.stats.taxi, fines: w.s.fines.n, ui: w.ui?.kind ?? null, taxiSt: w.taxi?.st ?? null }; });
  await W(() => { window.__seen6 = new Set(); const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen6.add(w.p.act.n); if (w.mate.act) window.__seen6.add(w.mate.act.n); requestAnimationFrame(f); }; f(); });

  // ── the chapter-six card: five chapters done, the island opens
  await W(() => { const J = window.__jade, w = J.world(); J.finishAll(); w.s.done = w.s.done.filter(id => !/^m(2[6-9]|3[0-5])$/.test(id)); w.s.story.ch = 5; w.s.story.isle = false; w.s.cash = 5000; w.heat = 0; w.wardens = []; w.s.settings.diff = 'easy'; w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade', 'heartland', 'bay']); w.fieldCache.clear(); J.play.scene.map = null; w.talk = null; w.ui = null; w.quitJob(); J.play.paused = false; J.play.bump(); });
  check(await appear('jade-chapter-card'), `${name}: chapter six's card when the island opens`);
  check(/island/i.test(await p.locator('[data-testid="jade-chapter-card"]').innerText()), `${name}: the card names The Island`); await wait(300); await look('chapter six');
  await press('jade-story-skip'); await settle();

  // ── the island's districts on screen
  for (const [pl, what] of [['safe-heartland', 'Toa Payoh'], ['playground', 'the dragon playground'], ['raffles', 'Raffles Place'], ['promenade', 'the bay promenade'], ['stage', 'the Float-About Stage']]) {
    await W(pl => window.__jade.teleportTo(pl), pl); await wait(900);
    check(await W(() => window.__jade.world().c.isle && window.__jade.world().p.x > 120 * 64), `${name}: ${what} is on the island`); await look(what);
  }

  // (Madame Glint offers the first island job at the station: take it as read, so the gates answer E)
  await W(() => { const w = window.__jade.world(); if (!w.s.done.includes('m26')) w.s.done.push('m26'); });
  // ── the Jade Line: E at Chinatown station's gates, tap the card, pick Toa Payoh by click, ride with both heroes
  await W(() => window.__jade.teleportTo('stn-chinatown')); await wait(400);
  const n0 = await near(); check(n0?.kind === 'station', `${name}: the station gates offer "${n0?.label}"`);
  await E(); check(await appear('mrt'), `${name}: E opens the station's gates`); await look('station gates');
  const s0 = await st(); await press('mrt-stn-toapayoh');
  check(await appear('ride-view'), `${name}: the ride view plays`); await wait(500); await look('ride view');
  await until(() => !document.querySelector('[data-testid="ride-view"]'), null, 6000);
  const s1 = await st(); check(!(await exists('ride-view')) && s1.mrt === s0.mrt + 1 && s1.cash === s0.cash - 2, `${name}: the ride ends by itself, 2 coins paid`);
  check(Math.hypot(s1.x - 152, s1.y - 31) < 4, `${name}: out at Toa Payoh station (${s1.x.toFixed(0)},${s1.y.toFixed(0)})`); await look('toa payoh station');
  // a key skips the ride view; a durian on the train is a fine (Normal)
  await W(() => { const w = window.__jade.world(); w.s.settings.diff = 'normal'; w.p.carry = 'durian'; w.ticket = null; });
  await E(); await appear('mrt'); await press('mrt-stn-raffles'); check(await appear('ride-view'), `${name}: a second ride`);
  await key('Space', 300); check(!(await exists('ride-view')), `${name}: any key skips the ride view`);
  const s2 = await st(); check(s2.fines === s1.fines + 1, `${name}: a durian on the train is fined`);
  await W(() => { const w = window.__jade.world(); w.p.carry = null; w.s.settings.diff = 'easy'; w.ticket = null; w.heat = 0; w.wardens = []; });

  // ── a taxi: G hails, it pulls up and you point, E gets in, a drop-off by click, E skips the ride
  await W(() => window.__jade.teleportTo('safe-bay')); await wait(500);
  await key('g', 300); check(await W(() => !!window.__jade.world().taxi), `${name}: G hails a taxi`);
  await until(() => window.__jade.world().taxi?.st === 'wait', null, 30000);
  check((await st()).taxiSt === 'wait', `${name}: the taxi pulls up`); await look('taxi waiting');
  // (a parked ride can sit closer to the taxi than you: try each side of it)
  await W(() => { const w = window.__jade.world(); w.p.act = null; for (const [dx, dy] of [[0, 50], [0, -50], [50, 0], [-50, 0]]) { w.placePlayer(w.taxi.b.x + dx, w.taxi.b.y + dy); w.findNear(); if (w.near?.kind === 'taxi') break; } });
  const n1 = await near(); check(n1?.kind === 'taxi', `${name}: "${n1?.label}"`);
  await E(); check(await appear('taxi'), `${name}: E opens the drop-off list`); await look('taxi drop-offs');
  const to = await W(() => [...document.querySelectorAll('[data-testid^="taxi-"]')].map(b => b.dataset.testid).find(t => /safe-heartland|stn-toapayoh|mk-heartland/.test(t)) ?? [...document.querySelectorAll('[data-testid^="taxi-"]')].map(b => b.dataset.testid)[0]);
  const t0 = await st(); await press(to);
  check((await st()).taxiSt === 'ride', `${name}: a click on ${to} rides there`); await wait(1500); await look('taxi ride');
  // (late in the full run a line of dialogue can take the first E: press again while the ride is still on)
  for (let k = 0; k < 3 && (await st()).taxiSt === 'ride'; k++) { await W(() => { window.__jade.world().talk = null; }); await key('e', 400); }
  const t1 = await st();
  check(t1.taxi === t0.taxi + 1 && t1.cash < t0.cash && !t1.taxiSt?.match(/ride/), `${name}: E skips to the drop-off and pays`);
  // the Tumpang! app on the phone books one
  await W(() => { const w = window.__jade.world(); w.taxi = null; w.p.act = null; }); await wait(200);
  await key('t', 300); check(await appear('jade-phone-msgs'), `${name}: T opens the phone`);
  await press('phone-taxi'); check(await exists('taxi-app'), `${name}: the Tumpang! app`); await look('taxi app');
  await press('taxi-book'); check(await W(() => window.__jade.world().taxi?.st === 'come'), `${name}: the app books a taxi`);
  await W(() => { const w = window.__jade.world(); w.taxi = null; window.__jade.play.paused = false; }); await settle();

  // ── the slide at the dragon playground
  await W(() => window.__jade.teleportTo('playground')); await wait(300);
  await W(() => { const w = window.__jade.world(); const pr = w.c.props.find(q => q.sprite === 'playground' && q.x < 160 * 64); w.placePlayer(pr.x, pr.y + 40); });
  const n2 = await near(); check(n2?.label === 'Go down the slide', `${name}: the playground offers "${n2?.label}"`);
  await E(); await wait(300); check(await W(() => window.__jade.world().p.act?.n === 'slide'), `${name}: E goes down the slide`); await look('slide'); await wait(1400);

  // ── scooter wardens on the roads, the Longkang Lizards
  await W(() => { const w = window.__jade.world(); w.patrols = []; }); await until(() => window.__jade.world().patrols.some(q => q.ride), null, 20000);
  check(await W(() => window.__jade.world().patrols.some(q => q.ride)), `${name}: a warden on a scooter patrols the roads`);
  await W(() => window.__jade.teleportTo('lepak')); await wait(300);
  check(await W(() => window.__jade.gang('lizards')), `${name}: the Longkang Lizards come out`); await wait(1200); await look('lizards');
  await W(() => { window.__jade.world().gangs.ev = null; });

  // ── the notice queue: a pile of toasts shows two at a time, bad news first
  await W(() => { const P = window.__jade.play; for (const m of ['+5 coins', '+6 coins', '+7 coins']) P.toast(m, 'good'); P.toast('Fined! Testing the queue', 'bad'); P.bump(); }); await wait(200);
  const toasts = await W(() => [...document.querySelectorAll('.jade-toast')].map(t => t.textContent));
  check(toasts.length <= 2 && toasts.some(t => /Fined/.test(t)), `${name}: two toasts at a time, bad news first (${toasts.join(' / ')})`);
  check(!(await exists('jade-hint')), `${name}: the lesson hint steps aside`); await look('notice queue'); await wait(3600);

  // ── an island job: Next Stop, Toa Payoh (ride the Jade Line as a job step)
  check((await W(() => window.__jade.start('m26'))) === 'm26', `${name}: the first island job starts`);
  check((await W(() => window.__jade.enterStep(window.__jade.stepOf('train')))) === 'train', `${name}: on to the job's train step`);
  await W(() => { const w = window.__jade.world(); w.talk = null; window.__jade.teleportTo('stn-chinatown'); }); await wait(300);
  const n3 = await near(); check(n3?.kind === 'station' && /take the train/.test(n3.label), `${name}: the job's train step at the gates: "${n3?.label}"`);
  await E(); check(await appear('ride-view'), `${name}: E rides straight to the job's stop`); await key('Enter', 300);
  check(await W(() => window.__jade.world().run?.cur?.t !== 'train'), `${name}: the job moves on at Toa Payoh`); await look('job at toa payoh');
  await W(() => { window.__jade.world().quitJob(); }); await settle();

  // ── the island's ending, then a dance on the Float-About Stage
  await W(() => { const J = window.__jade, w = J.world(); w.s.done = w.s.done.filter(id => id !== 'm35'); w.s.story.isle = false; w.finishMission(J.mission('m35')); w.talk = null; J.play.bump(); });
  check(await p.waitForSelector('[data-testid="jade-ending"]', { timeout: 9000 }).then(() => true, () => false), `${name}: the island's ending plays`);
  check(/Island Night|island/i.test(await p.locator('[data-testid="jade-ending"]').innerText()), `${name}: it is the island's ending`); await look('island ending');
  await press('jade-story-skip'); if (await appear('jade-credits')) await press('jade-credits-done');
  check(await W(() => window.__jade.world().s.story.isle), `${name}: the island's ending is remembered`); await settle();
  await W(() => window.__jade.teleportTo('stage')); await wait(400);
  const n4 = await near(); check(n4?.label === 'Dance on the Float-About Stage', `${name}: the stage offers "${n4?.label}"`);
  await E(); await wait(500); check(await W(() => window.__jade.world().p.act?.n === 'isle-dance'), `${name}: E dances with your partner`); await look('island dance'); await wait(2600);

  // ── the job givers in person: walk up to one in each district and talk (they stand facing the street, solid)
  await W(() => { const w = window.__jade.world(); w.talk = null; w.ui = null; w.heat = 0; w.wardens = []; window.__jade.play.paused = false; });
  for (const [who, d] of [['kee', 'Smith Street'], ['heron', 'Temple Street'], ['kiri', 'Boat Quay'], ['bo', 'the docks'], ['gizmo', 'Clarke Quay'], ['kamal', 'Toa Payoh'], ['vanda', 'Marina Bay']]) {
    const g = await W(who => { const w = window.__jade.world(); w.refreshCast(); const c = w.cast.find(c => c.id === who && c.home); if (!c) return null; w.talk = null; w.ui = null; if (w.p.ride) w.exit(); w.p.act = null; w.mate.act = null; w.placePlayer(c.x, c.y + 150); return { x: c.x, y: c.y, job: c.job }; }, who);
    check(!!g, `${name}: ${who} stands in ${d}`); if (!g) continue;
    await wait(250); await p.keyboard.down('w');
    await until(who => { const w = window.__jade.world(); w.findNear(); return w.near?.id === who && w.near.kind === 'giver'; }, who, 3000);
    await p.keyboard.up('w'); await wait(120);
    const pos = await W(() => { const w = window.__jade.world(); return { x: w.p.x, y: w.p.y, r: w.p.b.r }; });
    check(Math.hypot(pos.x - g.x, pos.y - g.y) >= 18 + pos.r - 2, `${name}: you walk up to ${who}, not through them`);
    const n = await near(); const at = await W(() => { const w = window.__jade.world(); return `${(w.p.x / 64).toFixed(1)},${(w.p.y / 64).toFixed(1)} act ${w.p.act?.n ?? '-'} ride ${!!w.p.ride}`; });
    check(n?.kind === 'giver' && n.id === who, `${name}: "${n?.label}" in ${d} (you at ${at}, ${who} at ${(g.x / 64).toFixed(1)},${(g.y / 64).toFixed(1)})`);
    await E(); check(await appear('dialogue'), `${name}: ${who} talks`);
    check(await W(who => { const w = window.__jade.world(); const c = w.cast.find(c => c.id === who); return w.talk?.lines[w.talk.i][0] === who && !!c; }, who), `${name}: it is ${who} talking`);
    if (['kee', 'kamal', 'vanda'].includes(who)) { await wait(300); await look(`giver ${who}`); }
    await key('e', 200); await key('e', 300); await until(() => !window.__jade.world().talk, null, 3000);
  }
  // a giver with a job waves; the job marker bobs over their head
  await W(() => { const w = window.__jade.world(); w.refreshCast(); const c = w.cast.find(c => c.job); w.placePlayer(c.x - 40, c.y + 110); window.__w6 = c.id; }); await wait(600);
  check(await W(() => { const w = window.__jade.world(); const c = w.cast.find(c => c.id === window.__w6 && c.job); return !!c && Math.hypot(c.x - w.p.x, c.y - w.p.y) < 560; }), `${name}: a giver with a job for you, close by`); await look('giver with a job');
  // the counts in the jobs book come from the job lists
  await key('Escape', 300); await press('tab-jobs');
  const sum = await p.locator('.jade-book-sum').innerText(); const nj = await W(() => window.__jade.jobs());
  const mt = sum.match(/(\d+)\/(\d+) marks · (\d+)\/(\d+) jobs · (\d+)\/(\d+) Hawker Tales/);
  check(!!mt && +mt[2] === nj.story * 3 && +mt[4] === nj.story && +mt[6] === nj.side, `${name}: the jobs book counts every job (${sum})`);
  await press('jade-jobs-ch6'); check(await exists('jade-job-m26'), `${name}: chapter six has its own tab`);
  await press('jade-jobs-side'); check(await exists('jade-job-k1'), `${name}: the Hawker Tales have theirs`);
  await press('close');
  for (let k = 0; k < 3 && await p.locator('.jade-modal-back').count(); k++) await key('Escape', 300);
  await settle();

  // ── every new pose was played
  const seen = await W(() => [...window.__seen6]);
  for (const a of ['tap-card', 'hail', 'point', 'phone', 'slide', 'isle-dance']) check(seen.includes(a), `${name}: the ${a} pose played`);
  await settle();
}
