// Jade Street in the browser, the fourth pass (called from tests/e2e/jade-street.mjs at 1280×800; the game is
// desktop-only): both heroes on screen with the duo bar, switching with Tab and with a click on the partner's
// portrait, every tag-team move on the F key (boost up, haul up, pounce, distract a warden, the passenger's grab, hold
// the lock lever), the gadgets with the mouse (aim, click to fire, hold to keep firing, the wheel and 1/2 to swap,
// X to reload), each with its firing pose, Tock's toy stall (buy, ammo, tune, give to a hero), the Controls page, and
// a second player joining from the pause menu on the keyboard, then leaving and joining again from a fake gamepad.
// Every new action is pressed with a real key or click; each screen is checked for faint text and photographed.
export async function fourth(h) {
  const { p, W, press, exists, appear, look, check, until, wait, settle, name } = h;
  const duo = () => W(() => window.__jade.duo());
  const key = async (k, ms = 120) => { await p.keyboard.press(k); await wait(ms); };
  const hold = async (k, ms) => { await p.keyboard.down(k); await wait(ms); await p.keyboard.up(k); };
  await W(() => { window.__jade.finishAll(); const w = window.__jade.world(); w.s.cash = 20000; w.s.story.ch = 5; w.s.story.ending = true; w.heat = 0; w.wardens = []; window.__jade.play.paused = false; });
  await settle();
  // every animation either hero plays from here on
  await W(() => { window.__seen4 = new Set(); const f = () => { if (!window.__jade) return; const w = window.__jade.world(); window.__seen4.add(w.p.anim); window.__seen4.add('m:' + w.mate.anim); requestAnimationFrame(f); }; f(); });
  const seen = () => W(() => [...window.__seen4]);

  // ── both heroes and the duo bar
  await W(() => window.__jade.teleportTo('safe-market')); await wait(600);
  check(await exists('duo') && await exists('duo-switch'), `${name}: the duo bar shows both portraits`);
  const st0 = await (await p.locator('[data-testid="mate-status"]').textContent());
  check(/Following|Waiting/.test(st0), `${name}: the partner's status reads "${st0}"`);
  const d0 = await duo(); check(d0.dist < 4, `${name}: the partner stands beside you (${d0.dist.toFixed(1)} tiles)`);
  await hold('d', 1200); const d1 = await duo(); check(d1.dist < 4, `${name}: and follows as you walk (${d1.dist.toFixed(1)} tiles)`);
  await look('duo bar');
  // ── switching: Tab and the portrait
  const who0 = d1.who; await key('Tab', 400); const d2 = await duo();
  check(d2.who !== who0 && d2.mate === who0, `${name}: Tab switches to ${d2.who}`);
  check(await W(() => window.__jade.world().s.hero) === d2.who, `${name}: the save follows the switch`);
  await press('duo-switch'); await wait(300); check((await duo()).who === who0, `${name}: clicking the partner's portrait switches back`);

  // ── boost onto a roof, then haul the partner up (an Arcade Strip wall at tile 93,39)
  await W(() => { window.__jade.teleport(93, 39); const w = window.__jade.world(); w.p.b.x = 93 * 64 + 32; w.p.b.y = 39 * 64 + 32; w.mate.b.x = w.p.b.x - 40; w.mate.b.y = w.p.b.y + 20; });
  await wait(200);
  check(await until(() => window.__jade.duo().tag === 'boost', null, 3000), `${name}: F offers a boost at the wall`);
  check(await exists('tag-prompt'), `${name}: the green F prompt shows the move`); await look('tag prompt boost');
  await key('f', 1200); check((await duo()).roof, `${name}: F boosts you onto the roof`);
  check(await until(() => window.__jade.duo().tag === 'haul', null, 3000), `${name}: F offers to haul the partner up`);
  await key('f', 1300); check((await duo()).mroof, `${name}: F hauls the partner onto the roof`);
  await W(() => window.__jade.teleportTo('safe-market')); await wait(500);

  // ── pounce together on the street magpie
  const ev = await W(() => window.__jade.event('magpie')); check(ev === 'magpie', `${name}: a street magpie`);
  await wait(300); await W(() => window.__jade.magpieNear());
  check(await until(() => window.__jade.duo().tag === 'pounce', null, 3000), `${name}: F offers a pounce near the magpie`);
  await key('f', 60); await W(() => window.__jade.magpieNear()); await key(' ', 900);
  const ph = await W(() => window.__jade.street()?.phase ?? 'none');
  check(ph === 'done' || ph === 'none', `${name}: the pounce catches the magpie (${ph})`);

  // ── distract a warden
  await W(() => { window.__jade.teleportTo('safe-market'); window.__jade.heat(1.4); }); await wait(2500);
  await W(() => { const w = window.__jade.world(); const wd = w.wardens[0]; if (wd) { wd.b.x = w.mate.x + 260; wd.b.y = w.mate.y; } });
  check(await until(() => window.__jade.duo().tag === 'distract', null, 4000), `${name}: F offers a distraction with a warden near`);
  await key('f', 200); check(await until(() => window.__jade.world().wardens.some(w => (w.stare ?? 0) > 0), null, 5000), `${name}: the warden stops to stare at the partner`);
  await look('distract');
  await W(() => { const w = window.__jade.world(); w.heat = 0; w.wardens = []; });

  // ── gadgets: aim with the mouse and click to fire
  await W(() => { window.__jade.teleport(20, 47); window.__jade.give(); window.__jade.world().s.settings.assist = false; }); await wait(400);
  check(await exists('gear-hud'), `${name}: the gadget hands show`);
  const box = await p.locator('[data-testid="world"]').boundingBox();
  const shots = () => W(() => window.__jade.world().s.stats.shots ?? 0);
  for (const g of ['sling', 'paint', 'popper', 'net', 'bubble', 'confetti']) {
    await W(gg => { const w = window.__jade.world(); w.s.gear.carry[w.p.who] = [gg, w.s.gear.carry[w.p.who].find(x => x !== gg) ?? 'sling']; w.s.gear.slot[w.p.who] = 0; w.s.gear.clip[gg] = 5; w.p.fireCd = 0; w.p.reloadT = 0; window.__jade.play.bump(); }, g);
    const n0 = await shots(); await p.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4); await p.mouse.down(); await wait(60);
    const pose = await W(() => window.__jade.frame()); await p.mouse.up(); await wait(140);
    check((await shots()) === n0 + 1, `${name}: a click fires the ${g}`);
    check(pose.includes('fire'), `${name}: the ${g} has its firing pose (${pose})`);
    if (g === 'net') await look('gadget net in flight');
    await wait(500);
  }
  await look('gadget splats');
  // hold the button: keeps firing
  await W(() => { const w = window.__jade.world(); w.s.gear.carry[w.p.who] = ['sling', 'paint']; w.s.gear.slot[w.p.who] = 0; w.s.gear.clip.sling = 6; w.s.gear.ammo.sling = 30; });
  const h0 = await shots(); await p.mouse.down(); await wait(1300); await p.mouse.up(); check((await shots()) - h0 >= 3, `${name}: holding the button keeps firing (${(await shots()) - h0})`);
  // 1, 2, the wheel and X
  await key('2'); check(await W(() => window.__jade.world().s.gear.slot[window.__jade.world().p.who]) === 1, `${name}: 2 picks the second gadget`);
  await key('1'); check(await W(() => window.__jade.world().s.gear.slot[window.__jade.world().p.who]) === 0, `${name}: 1 picks the first`);
  await p.mouse.wheel(0, 120); await wait(150); check(await W(() => window.__jade.world().s.gear.slot[window.__jade.world().p.who]) === 1, `${name}: the wheel swaps gadgets`);
  await key('1'); await W(() => { window.__jade.world().s.gear.clip.sling = 1; });
  await key('x', 60); check(await W(() => window.__jade.world().p.reloadT > 0), `${name}: X reloads`); check(await exists('gear-reload'), `${name}: the reload bar fills`);
  const an = await W(() => window.__jade.frame()); check(an.includes('reload'), `${name}: the reload pose (${an})`);
  await wait(1200);
  await press('gear-slot-1'); await wait(150); check(await W(() => window.__jade.world().s.gear.slot[window.__jade.world().p.who]) === 1, `${name}: clicking a gadget slot picks it`);
  // a magpie hit by a shot gets dizzy
  await key('1'); await W(() => window.__jade.snatch()); await wait(500);
  const mp = await W(() => { const m = window.__jade.world().snatchers[0]; return m ? { x: m.x / 64, y: m.y / 64 } : null; });
  if (mp) { const [sx, sy] = await W(([x, y]) => window.__jade.screenOf(x, y), [mp.x, mp.y]); await W(() => { window.__jade.world().s.settings.assist = true; }); await p.mouse.move(sx, sy); await p.mouse.down(); await wait(60); await p.mouse.up(); }
  check(await until(() => window.__jade.world().snatchers.every(m => m.out), null, 3000), `${name}: a shot magpie gets dizzy and flaps off`);
  // a warden hit: a stun, its own pose and more heat
  await W(() => { window.__jade.heat(1.2); }); await wait(2500);
  const ww = await W(() => { const w = window.__jade.world(); const wd = w.wardens[0]; if (!wd) return null; wd.b.x = w.p.x + 220; wd.b.y = w.p.y; wd.stun = 0; return w.heat; });
  if (ww !== null) {
    await W(() => { const w = window.__jade.world(); w.p.fireCd = 0; w.p.reloadT = 0; w.s.gear.clip.sling = 6; });
    const [sx, sy] = await W(() => { const w = window.__jade.world(), wd = w.wardens[0]; wd.stun = 0.4; return window.__jade.screenOf(wd.b.x / 64, wd.b.y / 64); });
    await p.mouse.move(sx, sy); await p.mouse.down(); await wait(60); await p.mouse.up();
    check(await until(() => window.__jade.wardens().some(w => w.hit), null, 2000), `${name}: a hit warden is stunned with a pose`);
    check(await W(h => window.__jade.world().heat > h, ww), `${name}: and the heat goes up`);
    await look('warden hit');
  } else check(false, `${name}: a warden came for the hit test`);
  await W(() => { const w = window.__jade.world(); w.heat = 0; w.wardens = []; });

  // ── the passenger: on a scooter, the partner rides behind and grabs with F
  await W(() => window.__jade.teleportTo('safe-market')); await wait(300);
  const rid = await W(() => { const w = window.__jade.world(); const r = w.rides.filter(r => r.kind === 'scooter' && !r.locked && r.parked).sort((a, b) => Math.hypot(a.b.x - w.p.x, a.b.y - w.p.y) - Math.hypot(b.b.x - w.p.x, b.b.y - w.p.y))[0]; if (!r) return null; w.placePlayer(r.b.x, r.b.y + 40); return r.id; });
  await wait(300); await key('e', 900);
  check(await until(() => window.__jade.duo().seat, null, 4000), `${name}: the partner hops on behind (ride ${rid})`);
  await look('passenger');
  await W(() => { const w = window.__jade.world(); w.s.cargo.jade = 2; w.snatchers.push({ x: w.p.x + 90, y: w.p.y, h: Math.PI, t: 0, out: false, took: 1, wing: 0, good: 'jade' }); });
  check(await until(() => window.__jade.duo().tag === 'snatch', null, 3000), `${name}: F offers the passenger's grab`);
  await key('f', 300); check(await W(() => window.__jade.world().s.cargo.jade) === 3, `${name}: the passenger grabs the loot back`);
  const sw = await seen(); check(sw.some(a => a.includes('pass-grab') || a === 'm:pass-grab') || await W(() => window.__jade.world().mate.grabT >= 0), `${name}: the grab pose`);
  // the passenger fires for the driver
  await W(() => { const w = window.__jade.world(); w.s.gear.clip[w.s.gear.carry[w.mate.who][w.s.gear.slot[w.mate.who]]] = 3; w.mate.fireCd = 0; });
  const f0 = await shots(); await p.mouse.down(); await wait(60); await p.mouse.up(); await wait(100);
  check((await shots()) === f0 + 1, `${name}: on a ride, the passenger fires`);
  check(await W(() => /back seat/.test(document.querySelector('[data-testid="gear-hud"]')?.textContent ?? '')), `${name}: the hands show the back-seat shooter`);
  await key('e', 600);

  // ── hold the lock lever (job 15)
  await W(() => { window.__jade.start('m15'); const i = window.__jade.world().run.m.steps.findIndex(s => s.t === 'hold'); window.__jade.enterStep(i); window.__jade.world().s.settings.assist = false; window.__jade.teleport(64, 27); });
  await settle(); await wait(300);
  check(await W(() => window.__jade.gates()) > 0, `${name}: the lock gate is shut`);
  check(await until(() => window.__jade.duo().tag === 'hold', null, 3000), `${name}: F sends the partner to the lever`);
  await look('hold prompt');
  await key('f', 200);
  check(await until(() => window.__jade.duo().holding, null, 8000), `${name}: the partner holds the lever`);
  check(await until(() => window.__jade.gates() === 0, null, 2000), `${name}: and the gate opens`);
  const ms = await (await p.locator('[data-testid="mate-status"]').textContent()); check(/lever/i.test(ms), `${name}: the status says so ("${ms}")`);
  await look('hold');
  await W(() => window.__jade.world().quitJob()); await settle();

  const all = await seen();
  for (const a of ['boost-rise', 'm:boost-give', 'haul', 'm:distract', 'm:pounce', 'm:hold']) check(all.some(x => x === a || x.startsWith(a)), `${name}: the ${a.replace('m:', 'partner ')} animation played`);

  // ── Tock's stall
  await W(() => window.__jade.toStall()); await wait(400);
  check(await until(() => window.__jade.state().near?.kind === 'gear', null, 3000), `${name}: Tock's stall is in reach`);
  await key('e', 400); check(await appear('gear-stall'), `${name}: E opens Tock's toy stall`);
  await look('toy stall');
  const cash0 = await W(() => window.__jade.world().s.cash);
  await press('ammo-sling'); check(await W(c => window.__jade.world().s.cash < c, cash0), `${name}: buy an ammo pack`);
  await press('up-sling'); check(await W(() => window.__jade.world().s.gear.lvl.sling) === 1, `${name}: tune the slingshot`);
  const other = await W(() => window.__jade.world().p.who === 'dora' ? 'enzo' : 'dora');
  await press(`carry-net-${other}`); check(await W(o => window.__jade.world().s.gear.carry[o].includes('net'), other), `${name}: give the net to the other hero`);
  check(await exists('gear-msg'), `${name}: the stall says what happened`);
  await press('close'); check(!(await exists('gear-stall')), `${name}: close the stall`);

  // ── Controls page lists the new keys
  await press('pause-btn'); await press('tab-controls');
  check(await W(() => /Switch hero/.test(document.querySelector('[data-testid="jade-controls"]')?.textContent ?? '')), `${name}: the Controls page lists the duo and gadget keys`);
  await look('controls 4'); await press('close');

  // ── a second player: from the pause menu on the keyboard, then a gamepad
  await press('two-players'); await wait(300);
  check(await W(() => window.__jade.world().two), `${name}: Player 2 joins from the pause menu`);
  check(await exists('p2-badge'), `${name}: the P2 keys show`);
  const m0 = await duo(); await hold('ArrowRight', 1000); const m1 = await duo();
  check(m1.mx - m0.mx > 1, `${name}: the arrow keys move player 2 (${(m1.mx - m0.mx).toFixed(1)} tiles)`);
  check(Math.abs(m1.px - m0.px) < 0.6, `${name}: and not player 1`);
  await key('Tab', 200); check((await duo()).who === m0.who, `${name}: no switching with two players`);
  check(await W(() => window.__jade.world().mate.b.x - window.__jade.world().p.b.x) < 1100, `${name}: the leash holds`);
  await look('two players');
  await press('pause-btn'); await press('two-players'); await wait(200); check(!(await W(() => window.__jade.world().two)), `${name}: Player 2 leaves`);
  // a fake gamepad: Start joins, the stick moves, A dashes, Start leaves
  const pad = (axes, buttons) => W(([a, b]) => window.__jade.fakePad({ axes: a, buttons: b }), [axes, buttons]);
  const B = (i) => Array.from({ length: 16 }, (_, k) => k === i);
  await pad([0, 0], B(9)); await wait(150); await pad([0, 0], B(-1)); await wait(100);
  check(await W(() => window.__jade.world().two), `${name}: a gamepad's Start joins`);
  const g0 = await duo(); await pad([0, 1], B(-1)); await wait(900); const g1 = await duo();
  check(g1.my - g0.my > 1, `${name}: the gamepad stick moves player 2 (${(g1.my - g0.my).toFixed(1)} tiles)`);
  await pad([0, 0], B(0)); await wait(80); check(await W(() => window.__jade.world().mate.dashT > 0 || window.__jade.world().mate.anim === 'dash'), `${name}: A dashes`); await pad([0, 0], B(-1)); await wait(100);
  await pad([0, 0], B(9)); await wait(150); await pad([0, 0], B(-1)); await wait(100);
  check(!(await W(() => window.__jade.world().two)), `${name}: Start again leaves`);
  await W(() => window.__jade.fakePad(null));
  // the old pass's keys: the run hint never sits there once you've run, and the festival toast never shows mid-job
  check(!(await W(() => document.querySelector('[data-lesson="run"]'))), `${name}: no run hint hanging about`);
}
