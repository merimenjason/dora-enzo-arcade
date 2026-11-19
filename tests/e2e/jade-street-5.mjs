// Jade Street in the browser, the fifth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): Singapore. The hawker centre, the five-foot ways, choping a table and eating at it, the mama shop,
// Uncle Goh's chess, newspapers for Mr Ong, gum and the bin, feeding the pigeons, Uncle Teo's kopi counter (by clicks
// and by keys), a warden's ticket paid with E and another run from, the phone's fines list and kopi lingo, the
// otters and macaques (a banana, a gadget), the lion dance's ang pao, the lantern walk and the getai, a storm, a
// bumboat, a Hawker Tales side job and its jobs book tab, The Silver Koi's counter, larger text, colour-blind markers,
// key remapping and player 1's gamepad (the stick, A, Start, the d-pad and A in the pause menu). Every new action is
// pressed with a real key, click or (fake) pad button; each screen is checked for faint text and photographed.
export async function fifth(h) {
  const { p, W, press, exists, appear, look, check, until, wait, settle, name } = h;
  const key = async (k, ms = 140) => { await p.keyboard.press(k); await wait(ms); };
  const E = async () => { await until(() => !window.__jade.world().p.act, null, 3000); await key('e', 200); };
  const near = () => W(() => { const w = window.__jade.world(); w.findNear(); return w.near ? { kind: w.near.kind, id: w.near.id ?? '', label: w.near.label } : null; });
  const at = (x, y) => W(([x, y]) => { const w = window.__jade.world(); w.placePlayer(x, y); w.cars = []; w.findNear(); }, [x, y]);
  const sg = () => W(() => { const w = window.__jade.world(); const s = w.sg; return { chope: s.chope, junk: s.junk.length, gum: s.gum.length, bag: { ...w.s.bag }, cash: w.s.cash, fines: { ...w.s.fines }, once: [...s.once], anim: w.p.act?.n ?? w.p.anim }; });
  const seenActs = new Set();
  const watchActs = () => W(() => { window.__seen5 = new Set(); const f = () => { if (!window.__jade) return; const w = window.__jade.world(); if (w.p.act) window.__seen5.add(w.p.act.n); window.__seen5.add(w.p.anim); requestAnimationFrame(f); }; f(); });
  await W(() => { window.__jade.finishAll(); const w = window.__jade.world(); w.s.cash = 5000; w.s.story.ch = 5; w.s.story.ending = true; w.heat = 0; w.wardens = []; w.patrols = []; w.s.settings.diff = 'easy'; window.__jade.play.paused = false; });
  await settle(); await watchActs();

  // ── the hawker centre and the five-foot ways
  await W(() => window.__jade.teleportTo('hoon')); await wait(900);
  check(await W(() => !!window.__jade.world().c.sg && window.__jade.world().c.sg.tables.length === 6), `${name}: the hawker centre has six tables`);
  await look('hawker centre');
  const ff = await W(() => { const c = window.__jade.world().c.sg, CW = c.fivefoot.length / window.__jade.layout.NH; const L = window.__jade.layout, i = c.fivefoot.findIndex((v, k) => { if (!v) return false; const o = L.unmvT(k % CW, Math.floor(k / CW)); return !!o && o[0] < 44 && o[1] > 40; }); return [(i % CW) * 64 + 32, Math.floor(i / CW) * 64 + 32]; });
  await at(ff[0], ff[1]); await wait(300);
  check(await W(() => window.__jade.world().p.shade), `${name}: under a five-foot way you stand in the shade`);
  await look('five-foot way');

  // ── chope a table with E, then sit and makan at it
  const table = await W(() => { const w = window.__jade.world(); const i = w.sg.chope.findIndex(v => v === 0); const t = w.c.sg.tables[i]; return { i, x: t.x, y: t.y + 36 }; });
  await at(table.x, table.y); const n0 = await near();
  check(n0?.kind === 'sg' && n0.id === 'chope:' + table.i, `${name}: a free table offers "${n0?.label}"`);
  await E(); await wait(1400);
  check((await sg()).chope[table.i] === 1, `${name}: E chopes the table with a tissue packet`);
  await look('table choped');
  await at(table.x, table.y); await E(); await wait(500);
  check((await sg()).chope[table.i] === 0, `${name}: E again: sit and makan (the table is free again)`);
  await wait(2600);

  // ── the mama shop: open with E, buy each thing by clicking
  const mama = await W(() => { const c = window.__jade.world().c.sg; return [c.mama[0], c.mama[1] + 40]; });
  await at(mama[0], mama[1]); check((await near())?.id === 'mama', `${name}: the mama shop counter`);
  await E(); check(await appear('mama'), `${name}: E opens the mama shop`);
  const b0 = (await sg()).bag;
  for (const id of ['tissue', 'seed', 'banana']) await press(`mama-${id}`);
  const b1 = (await sg()).bag;
  check(b1.tissue === b0.tissue + 3 && b1.seed === b0.seed + 1 && b1.banana === b0.banana + 2, `${name}: tissues, seed and bananas bought`);
  await look('mama shop'); await press('close');

  // ── chess with Uncle Goh
  const chess = await W(() => { const c = window.__jade.world().c.sg; return [c.chess[0] - 50, c.chess[1] + 10]; });
  await at(chess[0], chess[1]); check((await near())?.id === 'chess', `${name}: Uncle Goh's chess table`);
  await E(); await wait(400); check((await sg()).anim === 'sit-chess', `${name}: E sits down to a game of chess`); await look('chess'); await wait(2600);

  // ── newspapers for Mr Ong
  const junk = await W(() => { const w = window.__jade.world(); const i = w.sg.junk[0]; const [x, y] = w.c.sg.junk[i]; return { i, x, y }; });
  await at(junk.x, junk.y); check((await near())?.id === 'junk:' + junk.i, `${name}: a bundle of old newspapers`);
  await E(); await wait(900); check((await sg()).bag.junk === 1, `${name}: E picks up the newspapers`);
  // beside Mr Ong, on whichever side a parked scooter is not nearer (he walks, and a kerb spot is a couple of tiles off his path)
  await W(() => { const w = window.__jade.world(); const o = w.sg.ong.b; for (const [dx, dy] of [[40, 0], [-40, 0], [0, -36], [0, 36]]) { w.placePlayer(o.x + dx, o.y + dy); w.findNear(); if (w.near?.id === 'ong') break; } });
  { const n = await near(); check(n?.id === 'ong', `${name}: Mr Ong will buy them`); if (n?.id !== 'ong') console.log('ONG', JSON.stringify(n), await W(() => { const w = window.__jade.world(); return JSON.stringify({ ong: [Math.round(w.sg.ong.b.x), Math.round(w.sg.ong.b.y)], p: [Math.round(w.p.x), Math.round(w.p.y)], run: !!w.run, talk: !!w.talk, ui: w.ui?.kind, ride: !!w.p.ride, act: w.p.act?.n, junk: w.s.bag?.junk, fest: !!w.festival, tut: w.tutor.cur, wp: w.waypoint, hide: w.p.hide, roof: w.p.roof }); })); }
  const c0 = (await sg()).cash; await E(); await wait(1100);
  check((await sg()).bag.junk === 0 && (await sg()).cash === c0 + 3, `${name}: E sells the newspapers (3 coins)`);
  await look('karang guni');

  // ── gum, the bin, the pigeons (on Easy the first slip of each kind is a warning)
  const gum = await W(() => { const w = window.__jade.world(); w.patrols.length = 0; w.ticket = null; w.fineCd.set('gum', w.time + 999); w.open = new Set(['market', 'temple', 'canal', 'docks', 'arcade']); const clear = ([x, y]) => !w.rides.some(r => r.parked && Math.hypot(r.b.x - x, r.b.y - y) < 130); /* (away from a parked scooter's prompt) */ let i = w.sg.gum.find(k => clear(w.c.sg.gum[k])); if (i === undefined) { i = w.c.sg.gum.findIndex(clear); if (i < 0) i = 0; w.sg.gum.push(i); } const [x, y] = w.c.sg.gum[i]; return { i, x, y }; });
  await at(gum.x, gum.y); check((await near())?.id === 'gum:' + gum.i, `${name}: a stick of gum on the pavement`);
  await E(); await wait(800); check((await sg()).bag.gum === 1, `${name}: E picks up the gum`);
  // (old newspapers lying by the bin would be picked up first: they are cleared off here)
  const bin = await W(() => { const w = window.__jade.world(), b = w.c.sg.bins.find(([x, y]) => !w.rides.some(r => r.parked && Math.hypot(r.b.x - x, r.b.y - y) < 130)) ?? w.c.sg.bins[0]; w.sg.junk = w.sg.junk.filter(i => Math.hypot(w.c.sg.junk[i][0] - b[0], w.c.sg.junk[i][1] - b[1]) > 140); return b; }); await at(bin[0], bin[1]);
  { const nb = await near(); check(nb?.id === 'bin', `${name}: a litter bin (${nb?.kind}:${nb?.id})`); } await E(); await wait(900);
  check((await sg()).bag.gum === 0, `${name}: E spits the gum in the bin`);
  await W(() => { window.__jade.world().fineCd.delete('gum'); });
  const pg = await W(() => window.__jade.world().c.sg.pigeons[0]); await at(pg[0], pg[1]);
  check((await near())?.id === 'feed', `${name}: the pigeons' square`); const s0 = (await sg()).bag.seed;
  await E(); await wait(1500); check((await sg()).bag.seed === s0 - 1, `${name}: E feeds the pigeons`); await look('pigeons');

  // ── Uncle Teo's kopi counter: one order by clicks, the next by keys
  const kopi = await W(() => { const c = window.__jade.world().c.sg; return [c.kopi[0], c.kopi[1] + 50]; });
  await at(kopi[0], kopi[1]); check((await near())?.id === 'kopi', `${name}: Uncle Teo's kopi counter`);
  await E(); check(await appear('mini-kopi'), `${name}: E opens the kopi counter`);
  const call = await p.locator('[data-testid="kopi-call"]').textContent(); check(/Kopi|Teh/.test(call), `${name}: Uncle Teo calls ${call}`);
  await press('kopi-help'); check(await exists('glossary'), `${name}: the kopi lingo opens beside the counter`); await look('kopi counter');
  const order = () => W(() => window.__jadeMini.g().order);
  let o = await order(); for (const k of ['base', 'milk', 'sugar', 'temp']) await press(`kopi-${k}-${o[k]}`);
  await press('kopi-serve'); check(await W(() => window.__jadeMini.g().served) === 1, `${name}: the first drink served by clicking`);
  o = await order();
  const FIELDS = { base: ['kopi', 'teh'], milk: ['condensed', 'none', 'evap'], sugar: ['normal', 'less', 'none', 'more'], temp: ['hot', 'iced'] };
  const ks = Object.keys(FIELDS);
  for (let r = 0; r < 4; r++) { await key(String(r + 1), 60); const want = FIELDS[ks[r]].indexOf(o[ks[r]]); for (let k = 0; k < want; k++) await key('ArrowRight', 60); }
  await key('Enter', 300);
  check(await until(() => !document.querySelector('[data-testid="mini-kopi"]'), null, 5000), `${name}: the second drink by keys (1-4, arrows, Enter) and the counter closes`);
  check(await W(() => window.__jade.world().s.stats.kopi) >= 1, `${name}: Uncle Teo pays for the kopi`);

  // ── the fine city on Normal: a warden sees you jaywalk, the ticket pops up, E pays it; the next one you run from
  await W(() => { const w = window.__jade.world(); w.s.settings.diff = 'normal'; w.s.settings.assist = false; w.warned.clear(); });
  const road = await W(() => { const w = window.__jade.world(); const z = w.c.decals.filter(d => d.sprite === 'd-zebra'); const L = window.__jade.layout; for (let oy = 44; oy < 52; oy++) for (let ox = 14; ox < 40; ox++) { const [tx, ty] = L.mvT(ox, oy), i = ty * (w.c.ground.length / L.NH) + tx; if (w.c.ground[i] === 2 && !z.some(d => Math.abs(d.x / 64 - tx) < 5 && Math.abs(d.y / 64 - ty) < 5)) return [tx * 64 + 32, ty * 64 + 32 - 128]; } return null; });
  check(!!road, `${name}: a stretch of road away from the zebras`);
  await at(road[0], road[1]); await W(() => { window.__jade.warden(160, 0); const w = window.__jade.world(); w.lastTile = -1; w.cars = []; window.__wd5 = { id: w.patrols[0].id, x: w.patrols[0].b.x, y: w.patrols[0].b.y }; });
  // (since the eighth pass a warden on foot sees little behind them and walks a beat, so this one is kept beside you, facing you)
  await p.keyboard.down('s'); await until(() => { const w = window.__jade.world(), o = window.__wd5, pt = w.patrols.find(q => q.id === o.id); if (pt && !w.ticket) { pt.b.x = w.p.x + 160; pt.b.y = w.p.y; pt.b.speed = 0; pt.b.h = Math.atan2(w.p.y - pt.b.y, w.p.x - pt.b.x); } return !!w.ticket; }, null, 3000); await p.keyboard.up('s');
  { const ok = await appear('ticket'); const why = ok ? '' : await W(() => { const w = window.__jade.world(), o = window.__wd5, pt = w.patrols.find(q => q.id === o.id) ?? w.patrols[0]; return JSON.stringify({ ours: !!w.patrols.find(q => q.id === o.id), moved: [Math.round(w.p.x - o.x + 160), Math.round(w.p.y - o.y)], tile: w.c.ground[Math.floor(w.p.y / 64) * (w.c.ground.length / 128) + Math.floor(w.p.x / 64)], tut: w.tutor.cur, wp: w.waypoint, paused: window.__jade.play.paused, focus: document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, n: w.patrols.length, d: pt && Math.round(Math.hypot(pt.b.x - w.p.x, pt.b.y - w.p.y)), mind: pt?.mind?.st, write: pt?.write, tk: !!w.ticket, talk: !!w.talk, ui: w.ui?.kind, failed: !!w.failed, cash: w.s.cash, cd: [...w.fineCd.entries()].map(([k, v]) => [k, +(v - w.time).toFixed(1)]), ride: !!w.p.ride, roof: w.p.roof, hide: w.p.hide, job: w.run?.cur?.t ?? null, diff: w.s.settings.diff, warned: [...(w.warned ?? [])] }); }); check(ok, `${name}: the warden writes a ticket for jaywalking ${why}`); }
  const tk = await p.locator('[data-testid="ticket"]').textContent(); check(/Jaywalking/.test(tk) && /20 coins/.test(tk), `${name}: the ticket says what and how much: "${tk.slice(0, 60)}"`);
  await look('ticket');
  const f0 = (await sg()).fines; await key('e', 600);
  check(!(await exists('ticket')) && (await sg()).fines.n === f0.n + 1 && (await sg()).fines.paid === f0.paid + 20, `${name}: E pays the fine`);
  check(await W(() => window.__seen5.has('pay-fine')), `${name}: the hero pays with her own pose`);
  await W(() => { const w = window.__jade.world(); w.fineCd.clear(); window.__jade.warden(100, 0); });
  await W(() => { const w = window.__jade.world(); window.__jade.play.w.step && 0; });
  await W(() => { const w = window.__jade.world(); const pt = w.patrols[0]; w.ticket = { kind: 'litter', amt: 30, t: 0, pid: pt.id, x: w.p.x, y: w.p.y }; });
  await W(() => window.__jade.teleport(...window.__jade.layout.mvT(80, 40))); await until(() => !window.__jade.world().ticket, null, 6000);
  check((await sg()).fines.fled === f0.fled + 1 && await W(() => window.__jade.world().heat >= 1), `${name}: running from a ticket starts a chase`);
  await W(() => { const w = window.__jade.world(); w.heat = 0; w.wardens = []; w.patrols = []; w.s.settings.diff = 'easy'; w.s.settings.assist = true; });

  // ── the phone: fines and kopi lingo
  await key('t', 300); check(await appear('jade-phone-msgs'), `${name}: T opens the phone`);
  await press('phone-fines'); check(await exists('fines-list'), `${name}: the phone lists the fines`);
  const fl = await p.locator('[data-testid="fines-list"]').textContent(); check(/Jaywalking/.test(fl), `${name}: the jaywalking fine is in the list`);
  await look('phone fines');
  await press('phone-lingo'); check(await exists('glossary'), `${name}: and the kopi lingo`); await look('phone lingo');
  await press('close');

  // ── the gangs: a banana for a macaque (E), a soap bubble for an otter (a gadget, clicked)
  await W(() => window.__jade.teleportTo('mk-market')); await wait(300);
  check(await W(() => window.__jade.gang('macaques')), `${name}: the Bukit Bunch snatch some bags`);
  await wait(400); await look('macaques');
  // (pass 14: the gang can turn up beside a property for sale, whose prompt would win; stand on whichever side of the macaque is clear of it)
  await W(() => { const w = window.__jade.world(); const m = w.gangs.ev.mobs[0]; for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60]]) { w.placePlayer(m.b.x + dx, m.b.y + dy); w.findNear(); if (w.near?.kind === 'gang') break; } });
  const nb = await near(); check(nb?.kind === 'gang', `${name}: "${nb?.label}"`);
  const ban = (await sg()).bag.banana; await E(); await wait(300);
  check((await sg()).bag.banana === ban - 1 && await W(() => window.__jade.world().gangs.ev.mobs.some(m => m.st === 'munch')), `${name}: E tosses a banana and the macaque sits down to munch`);
  check(await W(() => window.__seen5.has('toss')), `${name}: with the toss pose`);
  await W(() => { const w = window.__jade.world(); w.gangs.ev = null; });
  await W(() => window.__jade.teleport(...window.__jade.layout.mvT(60, 40))); await wait(200);
  check(await W(() => window.__jade.gang('otters')), `${name}: the Riverside Romp smuggle crates on the quay`);
  await W(() => { const w = window.__jade.world(); const g = w.s.gear; g.carry[w.p.who] = ['bubble']; g.slot[w.p.who] = 0; g.clip.bubble = 6; g.ammo.bubble = 20; if (!g.own.includes('bubble')) g.own.push('bubble'); const m = w.gangs.ev.mobs[0]; m.b.speed = 0; m.st = 'run'; w.placePlayer(m.b.x - 140, m.b.y); w.cars = []; });
  await wait(300);
  let played = false;
  for (let tr = 0; tr < 4 && !played; tr++) {
    if (tr) { await W(() => { const w = window.__jade.world(), m = w.gangs.ev?.mobs.find(q => q.has && q.st !== 'gone'); if (!m) return; m.st = 'run'; m.b.speed = 0; window.__otk = w.gangs.ev.mobs.indexOf(m); w.placePlayer(m.b.x - 140, m.b.y); w.s.gear.clip.bubble = 6; w.p.reloadT = 0; }); await wait(250); }
    const mxy = await W(() => { const J = window.__jade, w = J.world(), m = w.gangs.ev.mobs[window.__otk ?? 0], c = J.play.scene.cam, r = document.querySelector('[data-testid="world"]').getBoundingClientRect(); return [r.left + (m.b.x - (c.x - c.w / 2)) * c.k, r.top + (m.b.y - (c.y - c.h / 2)) * c.k]; });
  await p.mouse.move(mxy[0], mxy[1]); await wait(60); await p.mouse.click(mxy[0], mxy[1]);
  played = await until(() => window.__jade.world().gangs.ev?.mobs.some(m => m.st === 'play' || m.st === 'dizzy' || !m.has), null, 1800);
  }
  const why = played ? '' : await W(() => { const w = window.__jade.world(), g = w.s.gear; return JSON.stringify({ ev: !!w.gangs.ev, mobs: w.gangs.ev?.mobs.map(m => [m.st, m.has, Math.round(m.b.x - w.p.b.x), Math.round(m.b.y - w.p.b.y)]), two: w.two, ride: !!w.p.ride, who: w.p.who, carry: g.carry[w.p.who], slot: g.slot[w.p.who], clip: g.clip.bubble, rel: w.p.reloadT, shots: w.shots?.length, act: w.p.act, ui: window.__jade.play.ui ?? null, heat: w.s.heat ?? w.heat }); });
  check(played, `${name}: a clicked soap bubble stops an otter (it plays)${why}`);
  await look('otters');
  await W(() => { window.__jade.world().gangs.ev = null; });

  // ── festivals: the lion dance (an ang pao), the lantern walk, the getai
  await W(() => window.__jade.fest('lion', 260)); await wait(300);
  const lion = await W(() => { const L = window.__jade.world().sg.lion; return [L.x, L.y + 50]; });
  await at(lion[0], lion[1]); check((await near())?.id === 'angpao', `${name}: the lion dance passes`);
  await E(); await wait(900); check((await sg()).once.includes('angpao'), `${name}: E gives the lion an ang pao`); await look('lion dance');
  await W(() => window.__jade.fest('lantern')); await W(() => window.__jade.step(2));
  const kid = await W(() => { const k = window.__jade.world().sg.kids[0]; return [k.x, k.y]; });
  await at(kid[0], kid[1]); check((await near())?.id === 'lantern', `${name}: the lantern walk`);
  await E(); check(await W(() => window.__jade.world().p.carry === 'lantern'), `${name}: E joins it with a lantern`);
  await p.keyboard.down('d'); await wait(600); await p.keyboard.up('d');
  check(await W(() => window.__seen5.has('carry')), `${name}: walking with the lantern`); await look('lantern walk');
  await W(() => window.__jade.fest('getai')); await W(() => window.__jade.step(2));
  const getai = await W(() => { const c = window.__jade.world().c.sg; return [c.getai[0], c.getai[1] + 70]; });
  await at(getai[0], getai[1]); check((await near())?.id === 'getai', `${name}: the getai show in the docks`);
  await E(); await wait(500); check((await sg()).once.includes('getai'), `${name}: E cheers the getai`); await look('getai');
  await W(() => window.__jade.fest(null));

  // ── a storm's lightning, a bumboat
  await W(() => { const w = window.__jade.world(); w.sg.flash = 0.35; }); await wait(80); await look('lightning');
  check(await W(() => { const w = window.__jade.world(); const r = w.rides.find(q => q.kind === 'boat'); if (!r) return false; w.placePlayer(r.b.x, r.b.y); w.enter(r); return true; }), `${name}: a bumboat on the river`);
  await wait(800); await look('bumboat');
  await W(() => { const w = window.__jade.world(); if (w.p.ride) w.exit(); });

  // ── a Hawker Tales side job, its jobs book tab, and The Silver Koi's counter
  await settle();
  check(await W(() => window.__jade.job('k1')) !== null, `${name}: The Kopi Run starts`);
  await wait(400); const jt = await p.locator('.jade-job-title').first().textContent(); check(/Hawker Tales/.test(jt), `${name}: the job card says "${jt}"`);
  await look('side job');
  await W(() => window.__jade.world().quitJob());
  await W(() => { window.__jade.job('m20'); const w = window.__jade.world(); w.talk = null; for (let i = 0; i < 12 && w.run && w.run.cur.t !== 'chase'; i++) w.run.next(); });
  await wait(400);
  const prog = await W(() => window.__jade.world().run?.progress);
  check(prog === 'Bumps 0/2 · then net it', `${name}: The Silver Koi reads "${prog}" (bump twice, then net it)`);
  await W(() => window.__jade.world().quitJob()); await settle();
  await key('Escape', 300); await press('tab-jobs'); await press('jade-jobs-side');
  check(await exists('jade-job-k1'), `${name}: the jobs book has a Hawker Tales page`); await look('jobs book hawker tales');
  await press('close');

  // ── settings: larger text, colour-blind markers, a remapped key
  await press('tab-settings');
  await press('set-bigtext'); check(await W(() => document.querySelector('main').dataset.big === 'true'), `${name}: Larger text`);
  await press('set-cbmarks'); check(await W(() => document.querySelector('main').dataset.cb === 'true'), `${name}: Colour-blind-safe markers`);
  await press('key-dash'); await key('j', 200);
  check(await W(() => window.__jade.world().s.settings.keys.dash === 'j'), `${name}: dash remapped to J`);
  await look('settings remap');
  await press('close'); await press('resume'); await wait(200);
  check(await exists('heat-count'), `${name}: the heat shows as a number with colour-blind markers on`);
  await key('j', 30); check(await W(() => window.__jade.world().p.dashT > 0 || window.__jade.world().p.anim === 'dash'), `${name}: J dashes now`);
  await wait(500); await key(' ', 30); check(!(await W(() => window.__jade.world().p.dashT > 0)), `${name}: and Space no longer does`);
  await W(() => window.__jade.job('m3')); await wait(300); await W(() => { const w = window.__jade.world(); w.talk = null; w.run.next(); }); await wait(300); await look('big text and markers');
  await W(() => window.__jade.world().quitJob()); await settle();
  await W(() => { const st = window.__jade.world().s.settings; st.keys = {}; st.bigText = false; st.cbMarks = false; window.__jade.play.bump(); });

  // ── player 1's gamepad: the stick moves, A dashes, Start pauses, the d-pad and A work the pause menu, B closes
  const pad = (axes, buttons) => W(([a, b]) => window.__jade.fakePad({ axes: a, buttons: b }), [axes, buttons]);
  const B = i => Array.from({ length: 16 }, (_, k) => k === i);
  await W(() => window.__jade.teleportTo('safe-market')); await wait(300);
  const x0 = await W(() => window.__jade.world().p.x);
  await pad([1, 0, 0, 0], B(-1)); await wait(700); await pad([0, 0, 0, 0], B(-1));
  check((await W(() => window.__jade.world().p.x)) - x0 > 60 && !(await W(() => window.__jade.world().two)), `${name}: the pad's stick moves player 1`);
  await pad([0, 0, 0, 0], B(0)); await wait(60); check(await W(() => window.__jade.world().p.dashT > 0 || window.__jade.world().p.anim === 'dash'), `${name}: A dashes`); await pad([0, 0, 0, 0], B(-1)); await wait(400);
  await pad([0, 0, 0, 0], B(9)); await wait(150); await pad([0, 0, 0, 0], B(-1)); await wait(200);
  check(await exists('pause'), `${name}: Start pauses`);
  for (let i = 0; i < 3; i++) { await pad([0, 0, 0, 0], B(13)); await wait(80); await pad([0, 0, 0, 0], B(-1)); await wait(80); }
  const focus = await W(() => document.activeElement?.dataset?.testid ?? ''); check(focus === 'tab-jobs', `${name}: the d-pad moves through the pause menu (on ${focus})`);
  await pad([0, 0, 0, 0], B(0)); await wait(150); await pad([0, 0, 0, 0], B(-1)); await wait(200);
  check(await exists('jade-jobs'), `${name}: A opens the jobs book`); await look('pad menu');
  await pad([0, 0, 0, 0], B(1)); await wait(150); await pad([0, 0, 0, 0], B(-1)); await wait(250);
  check(!(await exists('pause')), `${name}: B closes the menu`);
  await pad([0, 0, 0, 0], B(8)); await wait(150); await pad([0, 0, 0, 0], B(-1)); await wait(150);
  check(await W(() => window.__jade.world().two), `${name}: Back brings in player 2 (the pad goes to them)`);
  await pad([0, 0, 0, 0], B(8)); await wait(150); await pad([0, 0, 0, 0], B(-1)); await wait(150);
  check(!(await W(() => window.__jade.world().two)), `${name}: Back again and player 2 leaves`);
  await W(() => window.__jade.fakePad(null));

  // ── every new pose was played
  const seen = await W(() => [...window.__seen5]);
  for (const a of ['chope', 'chope-done', 'eat', 'shiok', 'sit-chess', 'pick-litter', 'sell-junk', 'bin-litter', 'feed', 'pay-fine', 'toss', 'clap', 'serve']) check(seen.includes(a), `${name}: the ${a} pose played`);
  void seenActs;
  await settle();
}
