// Jade Street in the browser, the eighth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): guards who hear and think, the partner who helps on their own, the harder stall, clue markers and
// the branch cards. A dash by a guard makes it stop and wonder ("?"), walking into its torch makes it shout ("!") and
// chase, slipping away leaves it searching and then grumbling back; the partner points out a lookout, fires their own
// gadget at raiders, curls up when you hide and scoops dropped loot; the Partner setting (helps on their own / only
// when I press F / off) is changed in Settings; the branch cards are picked with the keys 1 and 2 and with the mouse
// (the commotion, the chase with Space, the kopi bribe with E); clue markers show at the spots a clue fits.
export async function eighth(h) {
  const { p, W, press, loc, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 160) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 220); };
  /** start a job at its step of kind `t` (talk skipped), with the cards left to pick unless o.pick names one */
  const step = (id, t, o = {}) => W(([id, t, o]) => {
    const J = window.__jade, w = J.world(); J.start(id); w.s.settings.diff = o.diff ?? 'easy'; w.s.settings.assist = o.assist ?? true; w.heat = 0; w.wardens = []; w.ticket = null;
    const r = w.run, i = r.m.steps.findIndex(s => s.t === t);
    w.p.act = null; w.mate.act = null; w.p.carry = null; w.p.hide = false; w.ui = null; r.snap = r.snapshot(i); r.enter(i); w.talk = null;
    if (o.pick && r.js) r.js.pick = o.pick; J.play.paused = false; J.play.bump(); return r.cur.t;
  }, [id, t, o]);
  const run = () => W(() => { const r = window.__jade.world().run; return r ? { t: r.cur?.t, label: r.label, progress: r.progress, meter: r.meter && { name: r.meter.name, v: r.meter.v }, js: r.js && { ph: r.js.ph, pick: r.js.pick, hp: r.js.hp, clues: r.js.clues.length, caught: r.js.caught } } : null; });
  const pal = () => W(() => ({ ...window.__jade.world().pal.n }));
  await W(() => {
    window.__seen8 = new Set(); window.__minds8 = new Set();
    const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen8.add(w.p.act.n); if (w.mate.act) window.__seen8.add(w.mate.act.n); if (w.mate.anim) window.__seen8.add(w.mate.anim); for (const a of w.run?.actors ?? []) if (a.mind) window.__minds8.add(a.mind.st); requestAnimationFrame(f); }; f();
  });
  await W(() => window.__jade.finishAll()); await settle(); await wait(200); await settle();

  // ── the Partner setting, in Settings: three choices, saved
  await press('pause-btn'); await press('tab-settings');
  const set = () => W(() => window.__jade.world().s.settings.partner);
  check(await set() === 'auto', `${name}: the partner helps on their own by default`);
  await loc('set-partner').selectOption('tag'); check(await set() === 'tag', `${name}: Partner: only when I press F`);
  await loc('set-partner').selectOption('off'); check(await set() === 'off', `${name}: Partner: off`); await look('settings: partner');
  await loc('set-partner').selectOption('auto'); check(await set() === 'auto', `${name}: Partner: helps on their own again`);
  check(await W(() => JSON.parse(localStorage.getItem('jade-street-v9') ?? '{}').settings?.partner === 'auto'), `${name}: the setting is saved (v9)`);
  await press('close'); if (await exists('resume')) await press('resume'); await W(() => { window.__jade.play.paused = false; }); await settle();

  // ── the Jade Line made easy to find: the hint and Mr Kamal's text when the island opens, the route to Chinatown
  // station, the station pins and their key on the map (a click routes there), the gate prompt, the phone's Jade Line tab
  const stnAt = id => W(id => { const s = window.__jade.world().c.isle.stations.find(s => s.id === id); return [s.x, s.y]; }, id);
  const wp = () => W(() => window.__jade.world().waypoint);
  const n0 = await W(() => {
    const w = window.__jade.world(); w.s.story.ch = 5; w.s.story.ending = true; w.s.learned = w.s.learned.filter(x => x !== 'mrt'); w.tutor.cur = null; w.waypoint = null; w.mrtGuide = false;
    w.s.done = w.s.done.filter(id => !/^m(2[5-9]|3\d)$/.test(id)); w.open.delete('heartland'); w.open.delete('bay');
    const n = w.s.msgs.length; window.__jade.start('m25'); w.talk = null; w.finishMission(w.run.m); w.run = null; w.talk = null; w.ui = null; window.__jade.play.paused = false; return n;
  });
  check(await W(() => window.__jade.world().open.has('heartland')), `${name}: the last Chinatown job opens the island`);
  check(await W(n => window.__jade.world().s.msgs.slice(n).some(m => m.from === 'kamal' && /Chinatown station/.test(m.text) && /press E/.test(m.text)), n0), `${name}: Mr Kamal texts how to ride the Jade Line`);
  // first chapter six's card (as in play), then the hint
  check(await appear('jade-chapter-card'), `${name}: chapter six's card`); await press('jade-story-skip'); await settle();
  // (finishAll above earns every trophy at once: their toasts would hold the hint back for half a minute, so they go)
  await W(() => { const n = window.__jade.play.notices; n.queue = []; n.shown = []; });
  check(await until(() => document.querySelector('[data-testid="jade-hint"][data-lesson="mrt"]'), null, 9000), `${name}: the Jade Line hint shows when chapter six opens`);
  check(/Chinatown station is in Boat Quay.*press E to ride \(2 coins\)/.test(await loc('jade-hint').innerText().then(t => t.replace(/\s+/g, ' '))), `${name}: the hint says where and how`);
  const ct = await stnAt('stn-chinatown');
  check(JSON.stringify(await wp()) === JSON.stringify(ct), `${name}: the gold route leads to Chinatown station while the hint shows`);
  check((await loc('route-label').innerText()).includes('To Chinatown station'), `${name}: the HUD says where the route goes`); await look('mrt: hint and route');
  await W(() => { window.__jade.world().banner = null; });
  // the map: a station pin for each stop, a key entry, and a click on one routes there
  await press('map-btn'); for (let i = 0; i < 6; i++) await press('jade-map-zoom-out');
  check(await p.locator('[data-testid="jade-map-pin"][data-kind="stn"]').count() === 4, `${name}: four Jade Line station pins on the map`);
  if (!(await loc('jade-map-legend').innerText()).includes('Jade Line')) await press('jade-map-legend-toggle');
  check((await loc('jade-map-legend').innerText()).includes('Jade Line station'), `${name}: the map key lists Jade Line stations`); await look('mrt: map pins and key');
  await p.locator('[data-testid="jade-map-pin"][data-key="stn-toapayoh"]').click({ force: true }); await wait(200);
  check(!(await exists('map')) && JSON.stringify(await wp()) === JSON.stringify(await stnAt('stn-toapayoh')), `${name}: a click on a station pin routes there and closes the map`);
  // the gates: "E Ride the Jade Line"
  await W(c => { window.__jade.world().placePlayer(c[0], c[1] + 30); }, ct); await wait(300);
  check(await until(() => /Ride the Jade Line/.test(document.querySelector('[data-testid="prompt"]')?.textContent ?? ''), null, 2000), `${name}: the gates prompt "E Ride the Jade Line"`); await look('mrt: gate prompt');
  // the phone's Jade Line tab: the stations, and Route me
  await press('jade-phone'); await press('phone-mrt'); check(await exists('mrt-tab'), `${name}: the phone's Jade Line tab`);
  check(await p.locator('[data-testid^="mrt-route-"]').count() === 4, `${name}: every station listed with Route me`); await look('mrt: phone tab');
  await press('mrt-route-stn-bayfront');
  check(!(await exists('jade-phone-msgs')) && JSON.stringify(await wp()) === JSON.stringify(await stnAt('stn-bayfront')), `${name}: Route me sets the route to Bayfront station`);
  // the Controls page lists the Jade Line and the taxi
  await press('pause-btn'); await press('tab-controls');
  const ctl = await loc('jade-controls').innerText(); check(/Jade Line/.test(ctl) && /taxi/i.test(ctl), `${name}: the Controls page has the Jade Line (E) and taxis (G)`);
  await press('close'); if (await exists('resume')) await press('resume');
  await W(() => { const w = window.__jade.world(); w.waypoint = null; w.route = []; window.__jade.finishAll(); w.s.learned.push('mrt'); w.tutor.cur = null; window.__jade.play.paused = false; }); await settle();

  // ── guards: a dash behind one makes it stop and wonder; its torch on you makes it shout and chase; out of sight, it searches
  check(await step('m17', 'case', { assist: false, diff: 'normal' }) === 'case', `${name}: Container Maze, casing the yard`);
  const g = await W(() => { const w = window.__jade.world(), r = w.run, a = r.actors.find(a => a.kind === 'guard'); window.__start8 = [w.p.x, w.p.y]; w.mate.ai = { ...w.mate.ai, mode: 'stay', at: [w.mate.x, w.mate.y] }; w.s.settings.partner = 'tag'; return { x: a.b.x, y: a.b.y, h: a.b.h }; });
  await W(g => { const w = window.__jade.world(); w.placePlayer(g.x - Math.cos(g.h) * 170, g.y - Math.sin(g.h) * 170); }, g); await wait(200);
  await p.keyboard.down('a'); await wait(40); await key('Space', 200); await p.keyboard.up('a');
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'guard' && (a.mind.st === 'sus' || a.mind.st === 'look')), null, 2500), `${name}: a dash behind a guard: it stops and wonders`);
  await wait(250); await look('guard: suspicious');
  await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'guard' && (a.mind.st === 'sus' || a.mind.st === 'look')) ?? w.run.actors.find(a => a.kind === 'guard'); w.placePlayer(a.b.x + Math.cos(a.b.h) * 150, a.b.y + Math.sin(a.b.h) * 150); });
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'guard' && a.mind.st === 'alert'), null, 5000), `${name}: in its torch: it shouts and gives chase`);
  // run for it: back to where the job started, out of its sight
  await W(() => { const w = window.__jade.world(); w.placePlayer(...window.__start8); w.run.meter && (w.run.meter.v = 0); }); await look('guard: alert');
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'guard' && a.mind.st === 'search'), null, 6000), `${name}: lost you: it searches round`);
  await look('guard: searching');
  check(await until(() => window.__jade.world().run.actors.every(a => a.kind !== 'guard' || a.mind.st === 'back' || a.mind.st === 'patrol'), null, 15000), `${name}: then gives up and goes back`);
  check(!(await W(() => window.__jade.world().failed)), `${name}: not caught: the getaway worked`);
  { const m = await W(() => [...window.__minds8]); for (const s of ['patrol', 'sus', 'alert', 'search', 'back']) check(m.includes(s), `${name}: the ${s} state was seen`); }

  // ── the partner on their own: points at a lookout, curls up when you hide
  await step('m17', 'case');
  await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'guard'); w.s.settings.partner = 'auto'; w.pal.warnCd = 0; w.pal.warned = []; w.placePlayer(a.b.x + 420, a.b.y); w.mate.b.x = w.p.x + 30; w.mate.b.y = w.p.y; w.mate.ai = { ...w.mate.ai, mode: 'follow', at: null }; });
  check(await until(() => window.__jade.world().pal.n.warn > 0, null, 4000), `${name}: the partner warns of a guard`);
  check(await W(() => !!window.__jade.world().pal.point), `${name}: their paw points at it`); await wait(150); await look('partner: warning');
  await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'guard'); w.p.hide = true; w.placePlayer(a.b.x + 520, a.b.y); w.p.hide = true; w.mate.b.x = a.b.x + 200; w.mate.b.y = a.b.y; });
  check(await until(() => window.__jade.world().pal.n.cower > 0, null, 2000), `${name}: you hide, they curl up`); await look('partner: hiding');
  await W(() => { window.__jade.world().p.hide = false; });
  // the partner's own gadget at the raiders, between waves they tidy up
  check(await step('k4', 'defend', { assist: false, diff: 'normal' }) === 'defend', `${name}: Monkey Business: the stall`);
  await W(() => { const w = window.__jade.world(), s = w.s, h = w.mate.who; if (!s.gear.own.includes('sling')) s.gear.own.push('sling'); s.gear.carry[h] = ['sling']; s.gear.slot[h] = 0; s.gear.clip.sling = 6; s.gear.ammo.sling = 30; const [x, y] = w.run.spot(w.run.cur.at); w.placePlayer(x, y + 40); });
  check(await until(() => window.__jade.world().pal.n.fire > 0, null, 15000), `${name}: the partner fires at a raider`); await look('partner: firing');
  check(await until(() => window.__jade.world().run.actors.filter(a => a.kind === 'pest' && a.extra !== 2).length >= 2, null, 8000), `${name}: more than one raider at a time`);
  await W(() => { const r = window.__jade.world().run; r.js.wave = r.cur.waves; r.js.spawned = 2; r.js.queue = 3; r.js.spawnT = 0; });
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'pest' && a.sneaky), null, 3000), `${name}: a sneaky raider under its box`);
  await wait(400); await look('defend: sneak');

  // ── the branch cards: 2 starts the commotion
  check(await step('m12', 'blend') === 'blend', `${name}: Dumpling Disguise`);
  check(await appear('branch'), `${name}: the cards ask which way`); await wait(250); await look('branch: blend');
  check(await exists('branch-disguise') && await exists('branch-commotion'), `${name}: disguise or commotion`);
  await key('2', 300); const b0 = await run(); check(b0.js.pick === 'commotion' && !(await exists('branch')), `${name}: 2 picks the commotion`);
  check(await until(() => window.__jade.world().mate.anim === 'gong', null, 2000), `${name}: the partner bangs a wok lid`);
  check(await W(() => window.__jade.world().run.actors.filter(a => a.kind === 'watcher').every(a => a.stare > 0)), `${name}: every lookout stares at the racket`);
  await look('blend: commotion');
  // the chase: a click on the card, then Space into an otter
  check(await step('k10', 'trap') === 'trap', `${name}: Otter Ambush`);
  check(await appear('branch'), `${name}: nets or chase`); await press('branch-chase');
  check((await run()).js.pick === 'chase' && !(await exists('branch')), `${name}: a click picks the chase`);
  check(await until(() => window.__jade.world().run.actors.some(a => a.kind === 'lured'), null, 6000), `${name}: here they come`);
  await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'lured'); a.speed = 0; w.placePlayer(a.b.x - 80, a.b.y); });
  await p.keyboard.down('d'); await wait(40); await key('Space', 300); await p.keyboard.up('d');
  check(await until(() => window.__jade.world().run.js.caught >= 1, null, 2000), `${name}: Space dashes into one and catches it`); await look('trap: chase');
  // the kopi bribe: 1 or 2 on the cards, then E hands over a kopi
  check(await step('k5', 'detective') === 'detective', `${name}: The Kueh Recipe`);
  check(await appear('branch'), `${name}: ask or bribe`); await look('branch: detective');
  await press('branch-bribe'); check((await run()).js.pick === 'bribe', `${name}: the bribe`);
  const cash = await W(() => { const w = window.__jade.world(), a = w.run.actors.find(a => a.kind === 'witness'); w.placePlayer(a.b.x, a.b.y + 50); return w.s.cash; }); await wait(250);
  await E(); check(await until(() => window.__jade.world().p.act?.n === 'bribe', null, 1500), `${name}: E hands over a kopi`); await look('detective: bribe');
  check(await until(() => window.__jade.world().run.js.clues.length === 1, null, 3000), `${name}: the clue straight away`);
  check(await W(c => window.__jade.world().s.cash < c, cash), `${name}: it cost coins`);
  await W(() => { const w = window.__jade.world(); if (w.ui?.kind === 'ask') w.run.askClose(); }); await until(() => window.__jade.world().run.items.some(it => it.marks?.length), null, 3000);
  // the clue markers at the spots it fits
  check(await W(() => { const r = window.__jade.world().run, tag = r.cur.witnesses[r.js.clues[0]].tag; return r.items.every((it, j) => (it.marks?.length > 0) === r.cur.spots[j].tags.includes(tag)); }), `${name}: clue markers at the spots that fit`);
  await W(() => { const w = window.__jade.world(), r = w.run, j = r.items.findIndex(it => it.marks?.length); w.placePlayer(r.items[j].x, r.items[j].y + 120); }); await wait(300); await look('detective: clue markers');

  // ── every new pose was played
  const seen = await W(() => [...window.__seen8]);
  for (const a of ['psst-side|psst-down', 'cower|peek', 'ready', 'gong', 'bribe']) check(a.split('|').some(x => seen.includes(x)), `${name}: the ${a} pose played`);
  await W(() => { const w = window.__jade.world(); w.quitJob(); w.ui = null; w.talk = null; w.s.settings.partner = 'auto'; window.__jade.play.paused = false; });
  await settle();
}
