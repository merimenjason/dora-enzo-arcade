// The Sunken Bellspire: the Echo Trials and New Game+. The trials' rules (when they open, where they start, the run's
// clock and trial bells, the Guardian Rush with one heal between guardians, medals and best times, and that nothing a
// trial does is kept but its time), then New Game+ (what carries over, its own save, the tougher guardians and each
// one's new attack with its own warning).
// Run from tests/bellspire.mjs (after compiling the engine into .checks/).
import assert from 'node:assert/strict';
import {
  BellspireGame, freshSave, parseSave, ROOMS, INFO, COLS, ROWS, TILE, BOSSES, NO_INPUT, AREAS, SHRINE_NAMES, ABILITY_ORDER, ALL_BOSSES, SCRIPTS,
  SAVE_KEY, NGP_SAVE_KEY, TRIALS, RUSH, GRAND_RUSH, RUSH_HEAL, TRIAL_FOOD, MEDALS, NGP_HP, NGP_HIT, medalFor, trialById, trialSecs, ngpReady, newGamePlusSave,
  roomById, isOrchardRoom,
} from '../.checks/bellspire-game.js';

export default function trials() {
  let checks = 0;
  const ok = (c, m) => { assert.ok(c, m); checks++; };
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
  const I = (o = {}) => ({ ...NO_INPUT, ...o });
  const run = (g, n, inp = {}) => { for (let i = 0; i < n; i++) g.step(I(inp)); };
  const events = (g) => g.drainEvents();
  const shrines = ROOMS.filter((r) => INFO.get(r.id).things.some((t) => t.ch === 'S')).map((r) => r.id);
  /** A finished save: every guardian calm, every ability, every shrine lit, standing at `shrine`. */
  const finished = (shrine = 'landing') => {
    const s = freshSave();
    s.abilities = [...ABILITY_ORDER];
    s.spells = ['whirl', 'bolt', 'ember', 'chime', 'frost', 'gale'];
    s.gear.push('moonsteel', 'star-lamp');
    s.equip.dora.weapon = 'moonsteel';
    for (const h of ['dora', 'enzo']) { s.heroes[h].level = 12; s.heroes[h].xp = 40; }
    s.hearts = 5; s.drops = 2; s.coins = 321; s.time = 3600 * 5;
    for (const id of ALL_BOSSES) s.flags.push(`boss:${id}`, `script:boss:${id}`);
    s.flags.push('keeper', 'belfry:visited', 'ending', 'belfry:ending', ...Object.keys(SCRIPTS).map((k) => `script:${k}`), ...shrines.map((id) => `shrine:${id}`));
    s.shrine = shrine; s.medals = {};
    return s;
  };
  /** A game on a finished save, settled at its shrine. */
  const atShrine = (shrine = 'landing', seed = 1, settings = {}) => { const g = new BellspireGame(finished(shrine), settings, seed); g.dialog = null; run(g, 4); events(g); return g; };
  /** Stand the lead on a trial bell's spot. */
  const toBell = (g, goal) => { g.teleport(goal.room, goal.c, goal.r); g.enemies = []; };

  // ─── the trials themselves ───────────────────────────────────────────────
  eq(TRIALS.filter((t) => t.kind === 'rush').map((t) => t.id), ['rush', 'rush:grand'], 'the Guardian Rush, and the Grand Rush once the foundry is calm');
  eq(new Set(TRIALS.filter((t) => t.kind === 'run').map((t) => t.area)), new Set(ROOMS.filter((r) => !r.salt && !isOrchardRoom(r) && !r.glacier).map((r) => r.area)), 'and a run in each of the original through-Foundry areas');
  eq(RUSH, ALL_BOSSES.slice(0, 8), 'the rush meets the first eight guardians in story order');
  eq(GRAND_RUSH, ALL_BOSSES, 'the Grand Rush all eleven');
  for (const t of TRIALS) {
    ok(t.medals[0] < t.medals[1] && t.medals[1] < t.medals[2], `${t.name}: gold is quicker than silver, silver than bronze`);
    ok(t.text.length > 10 && !/\b(he|she|his|her)\b/i.test(t.text), `${t.name} says what to do, with no he or she`);
    if (t.kind !== 'run') continue;
    ok(shrines.includes(t.from) && roomById(t.from).area === t.area, `${t.name} starts at a shrine in its own area (${t.from})`);
    ok(t.goals.length >= 2, `${t.name} has at least two trial bells`);
    for (const goal of t.goals) {
      const rm = roomById(goal.room);
      ok(rm.area === t.area, `${t.name}: the bell in ${goal.room} is in the area`);
      // a hero set down on the bell's spot stands there (on the floor, a ledge or a float, not in a wall or the air)
      // (in Strict, so a spot under a bell hook isn't caught by the helping hand's rope on the way down)
      const g = new BellspireGame(finished(), { assist: false, strict: true }, 1); g.dialog = null;
      g.save.water = freshSave().water; g.save.wind = { ...(t.wind ?? freshSave().wind) };
      g.teleport(goal.room, goal.c, goal.r); g.enemies = [];
      for (let i = 0; i < 20; i++) g.step(I());
      const p = g.trialBellAt(goal);
      ok(g.body.ground && Math.abs(g.body.y - p.y) < 3 && Math.abs(g.body.x - p.x) < 10, `${t.name}: the bell in ${goal.room} stands on something the heroes can stand on`);
    }
  }
  eq(medalFor(trialById('rush'), trialById('rush').medals[0]), 'gold', 'a time on the gold line is gold');
  eq(medalFor(trialById('rush'), trialById('rush').medals[0] + 0.1), 'silver', 'a tenth over is silver');
  eq(medalFor(trialById('rush'), trialById('rush').medals[2] + 1), null, 'slower than bronze earns nothing');
  eq(medalFor(trialById('rush'), undefined), null, 'and no time no medal');
  eq(trialSecs(61), 1, 'times are in seconds to a tenth');
  eq([...MEDALS], ['gold', 'silver', 'bronze'], 'three medals');

  // ─── locked until the Out-of-Tune Bell is calm, and only at a lit shrine ───
  {
    const g = new BellspireGame(null, {}, 1); g.dialog = null; run(g, 4);
    ok(/Out-of-Tune Bell/.test(g.trialsLocked()), 'before the Bell is calm, the trials say why they are shut');
    eq(g.whyNotTrial('rush'), g.trialsLocked(), 'and every trial gives that reason');
    eq(g.startTrial('run:hub'), g.trialsLocked(), 'and won’t start');
    ok(g.trial === null, 'nothing started');
    const s = finished(); s.flags = s.flags.filter((f) => f !== 'boss:tune');
    const g2 = new BellspireGame(s, {}, 1); g2.dialog = null; run(g2, 4);
    ok(g2.trialsLocked() !== null, 'even a save with everything else done waits for the Bell');
    const g3 = atShrine();
    eq(g3.trialsLocked(), null, 'once the Bell is calm they are open');
    eq(g3.whyNotTrial('rush'), null, 'at a lit shrine the rush can start');
    eq(g3.whyNotTrial('nope'), 'There is no such trial.', 'an unknown trial says so');
    g3.teleport('gallery', 5, 14); run(g3, 3);
    ok(/lit candle shrine/.test(g3.whyNotTrial('rush')), 'away from a shrine: stand at one');
    const s4 = finished(); s4.flags = s4.flags.filter((f) => f !== 'shrine:cliffoot');
    const g4 = new BellspireGame(s4, {}, 1); g4.dialog = null; run(g4, 4);
    eq(g4.whyNotTrial('run:cloud'), `Light the ${SHRINE_NAMES.cliffoot} first: this run starts there.`, 'a run from an unlit shrine says which shrine to light');
    eq(g4.whyNotTrial('run:halls'), null, 'while the others can start');
    // the Trials script plays the first time the heroes rest after the Bell
    const s5 = finished(); s5.flags = s5.flags.filter((f) => f !== 'script:trials');
    const g5 = new BellspireGame(s5, {}, 1); g5.dialog = null; run(g5, 4);
    g5.rest(); ok(g5.dialog?.lines === SCRIPTS.trials, 'resting after the Bell, Enzo and Dora tell you about the trials');
    ok(SCRIPTS.trials.every((l) => !/\b(he|she)\b/i.test(l.text)), 'in their own words, with no he or she');
  }

  // ─── an area run: the clock, the bells, the medal, and nothing else kept ──
  {
    const g = atShrine('chapel');
    const before = g.snapshot();
    g.save.food = { cake: 7, tea: 4 };
    const kept = g.snapshot();
    eq(g.startTrial('run:hub'), null, 'a run starts from any lit shrine');
    const ev = events(g);
    ok(ev.some((e) => e.k === 'trialStart' && e.id === 'run:hub'), 'and says so');
    eq(g.room.id, 'landing', 'it takes the heroes to the run’s own shrine');
    eq(g.save.food, TRIAL_FOOD, 'with the trial pantry');
    eq(g.snapshot(), kept, 'saving during a trial saves the game as it was before');
    ok(g.travel('chapel') !== null && !g.canOpenTravel(), 'no travelling during a trial');
    ok(g.whyNotTrial('rush') !== null, 'and no second trial');
    run(g, 30);
    eq(g.trial.t, 0, 'the clock waits for the first move');
    run(g, 30, { right: true });
    ok(g.trial.started && g.trial.t >= 29 && g.trial.t <= 30, 'and runs from it');
    // things done in a trial don't stick
    g.save.coins += 500; g.save.heroes.dora.xp += 999; g.setFlag('chest:landing:0');
    const def = trialById('run:hub');
    toBell(g, def.goals[1]); run(g, 2);
    eq(g.trial.i, 0, 'the bells go in order: the second does nothing first');
    toBell(g, def.goals[0]); run(g, 2);
    const e1 = events(g).find((e) => e.k === 'trialBell');
    ok(e1 && e1.n === 1 && e1.of === 2, 'touching the first bell rings it');
    const t0 = g.trial.t;
    toBell(g, def.goals[1]); run(g, 2);
    const done = events(g).find((e) => e.k === 'trial');
    ok(done && done.won && done.newBest, 'the last bell ends the run with a first best time');
    eq(done.secs, trialSecs(t0 + 2), 'timed from the first move to the last bell');
    eq(g.trial, null, 'the trial is over');
    eq(g.save.medals['run:hub'], done.secs, 'the best time is saved');
    eq(done.medal, medalFor(def, done.secs), 'with its medal');
    eq(g.save.coins, before.coins, 'the coins come back as they were');
    eq(g.save.food, { cake: 7, tea: 4 }, 'and the food');
    eq(g.save.heroes.dora.xp, before.heroes.dora.xp, 'and the XP');
    ok(!g.flag('chest:landing:0'), 'and what was opened is shut again');
    eq(g.room.id, 'chapel', 'the heroes stand at the shrine they started from');
    eq(g.whyNotTrial('run:hub'), null, 'where it can start again straight away');
    const saved = parseSave(JSON.stringify(g.snapshot()));
    eq(saved.medals['run:hub'], done.secs, 'the best time survives saving and loading');
    // a slower time is not a new best
    g.startTrial('run:hub'); events(g); run(g, 5, { left: true }); g.trial.t = (def.medals[2] + 5) * 60;
    toBell(g, def.goals[0]); run(g, 2); toBell(g, def.goals[1]); run(g, 2);
    const slow = events(g).find((e) => e.k === 'trial');
    ok(slow.won && !slow.newBest && slow.medal === null, 'a slow run counts, but earns no medal and no new best');
    eq(g.save.medals['run:hub'], done.secs, 'and the best time stays');
    // the run's wind and the water are set for it, and come back after
    const g2 = atShrine('cliffoot');
    g2.save.wind.cloud = 1; g2.save.water.docks = 1;
    g2.startTrial('run:cloud');
    eq(g2.save.wind.cloud, -1, 'the Cloudstair run starts with the wind at the heroes’ backs');
    eq(g2.save.water.docks, 0, 'and the water as it first was');
    g2.quitTrial();
    const quit = events(g2).find((e) => e.k === 'trial');
    ok(quit && !quit.won && quit.best === null, 'giving up ends the trial with no time');
    eq([g2.save.wind.cloud, g2.save.water.docks], [1, 1], 'and the wind and water come back');
    eq(g2.save.medals['run:cloud'], undefined, 'no time is saved');
  }

  // ─── knocked out in a trial ──────────────────────────────────────────────
  {
    const g = atShrine('mill');
    const coins = g.save.coins;
    g.startTrial('run:docks'); events(g); run(g, 3, { right: true });
    g.setHp('enzo', 0); g.setHp('dora', 0); run(g, 200);
    const e = events(g).find((x) => x.k === 'trial');
    ok(e && !e.won, 'both heroes knocked out ends the trial');
    eq(g.trial, null, 'it is over');
    eq([g.save.coins, g.save.drop], [coins, null], 'no coins are dropped');
    ok(!g.save.heroes.dora.down && !g.save.heroes.enzo.down, 'both heroes are up again');
    eq(g.room.id, 'mill', 'back at the shrine');
  }

  // ─── the Guardian Rush ───────────────────────────────────────────────────
  {
    const g = atShrine('gears');
    const before = g.snapshot();
    eq(g.startTrial('rush'), null, 'the rush starts');
    events(g);
    ok(g.trial.started, 'its clock runs from the start');
    const seen = [], heals = [];
    let ended = 0, endings = 0;
    for (let k = 0; k < RUSH.length; k++) {
      for (let i = 0; i < 300 && (!g.boss || g.boss.id !== RUSH[k]); i++) { run(g, 1); }
      ok(g.boss?.id === RUSH[k], `guardian ${k + 1} is ${BOSSES[RUSH[k]].name}`);
      seen.push(g.boss.id);
      if (k === 0) eq(g.boss.max, BOSSES.frog.hp, 'with its usual HP outside New Game+');
      // both hurt (Enzo knocked out) before the guardian goes calm
      const low = Math.round(g.stats('dora').maxHp * 0.4);
      g.save.heroes.dora.hp = low; g.save.heroes.enzo.hp = 0; g.save.heroes.enzo.down = true; g.lead = 'dora';
      const b = g.boss; b.st = 'calm'; b.calm = true; b.t = 0;
      const lv = g.save.heroes.dora.level, xp = g.save.heroes.dora.xp;
      for (let i = 0; i < 300 && g.boss === b; i++) { run(g, 1); if (g.boss === b) g.save.heroes.dora.hp = low; }
      for (const e of events(g)) { if (e.k === 'trial') ended++; if (e.k === 'ending') endings++; }
      eq([g.save.heroes.dora.level, g.save.heroes.dora.xp], [lv, xp], `${BOSSES[RUSH[k]].name} gives no XP in the rush`);
      if (k < RUSH.length - 1) heals.push([g.save.heroes.dora.hp, g.save.heroes.enzo.hp, g.save.heroes.enzo.down]);
    }
    eq(seen, RUSH, 'all eight, in order');
    const st = g.stats('dora');
    ok(heals.every(([d, e, down]) => d === Math.min(st.maxHp, Math.round(st.maxHp * 0.4) + Math.round(st.maxHp * RUSH_HEAL)) && e === Math.round(g.stats('enzo').maxHp * RUSH_HEAL) && !down), 'one heal between guardians: half of each hero’s HP back, and a knocked-out hero wakes with it');
    eq(ended, 1, 'the rush ends once, after the eighth');
    eq(endings, 0, 'the Lake Mother and the Bell don’t play their endings in the rush');
    ok(!g.ended, 'and the game goes on');
    ok(g.save.medals.rush > 0, 'its time is saved');
    eq({ ...g.snapshot(), medals: {} }, { ...before, medals: {} }, 'everything else is as it was before the rush');
    eq(g.room.id, 'gears', 'back at the shrine it started from');
    // a wipe in the rush ends it (the boss door is not a checkpoint here)
    g.startTrial('rush'); events(g);
    for (let i = 0; i < 400 && g.boss?.st === 'wait'; i++) run(g, 1, { left: true });
    ok(g.boss && g.boss.st !== 'wait', 'the frog wakes');
    g.setHp('enzo', 0); g.setHp('dora', 0); run(g, 200);
    const e = events(g).find((x) => x.k === 'trial');
    ok(e && !e.won && g.trial === null && !g.boss, 'a wipe in the rush ends it');
  }

  // ─── New Game+ ───────────────────────────────────────────────────────────
  {
    ok(SAVE_KEY !== NGP_SAVE_KEY && NGP_SAVE_KEY.startsWith(SAVE_KEY), 'New Game+ has its own save key');
    ok(!ngpReady(null) && !ngpReady(freshSave()) && ngpReady(finished()), 'New Game+ opens once the Bell is calm');
    const end = finished(); end.medals = { 'run:hub': 17.5 };
    const n = newGamePlusSave(end);
    eq(n.ngp, 1, 'the first New Game+ is round 1');
    eq([n.heroes.dora.level, n.heroes.enzo.level, n.heroes.dora.xp], [12, 12, 40], 'the heroes keep their levels and XP');
    eq(new Set(n.gear), new Set(end.gear), 'and every piece of gear');
    eq(n.equip, end.equip, 'worn as it was');
    eq(new Set(n.spells), new Set(end.spells.filter((sp) => sp !== 'chime')), 'and their spells (bar the Bell Chime, which opens doors and comes back with its pedestal)');
    eq(n.abilities, [], 'but no abilities');
    eq([n.hearts, n.drops, n.coins, n.shrine, n.time], [0, 0, 0, 'landing', 0], 'the Bell Hearts and Moon Drops, coins, shrines and clock start again');
    ok(!n.flags.some((f) => f.startsWith('boss:') || f.startsWith('chest:') || f === 'keeper'), 'and so does the story');
    eq(n.medals, end.medals, 'the trials’ best times carry over');
    eq(end.ngp, 0, 'the finished save itself is untouched');
    const back = parseSave(JSON.stringify(n));
    eq(back.ngp, 1, 'the round survives saving and loading');
    const g = new BellspireGame(back, {}, 1);
    ok(g.dialog?.lines[0].who === 'sign' && /New Game\+/.test(g.dialog.lines[0].text) && /keep their levels, gear and spells/.test(g.dialog.lines[0].text), 'New Game+ opens by saying what carries over');
    ok(g.save.heroes.dora.hp === g.stats('dora').maxHp && g.save.heroes.enzo.mp === g.stats('enzo').maxMp, 'with both heroes full');
    const n2 = newGamePlusSave({ ...finished(), ngp: 1 });
    eq(n2.ngp, 2, 'finishing New Game+ opens round 2');
    ok(/New Game\+ 2/.test(new BellspireGame(n2, {}, 1).dialog.lines[0].text), 'which says its number');
  }

  // NG+ guardians: +40% HP, and each a new attack with its own warning (not in a first game)
  {
    const NEW = { frog: 'flop', hydra: 'rain', puma: 'twin', warden: 'chorus', mother: 'spout', condor: 'icicles', clappers: 'double', tune: 'crack' };
    const sees = (id, ngp) => {
      const s = finished(); s.ngp = ngp; s.abilities = [...ABILITY_ORDER];
      const g = new BellspireGame(s, {}, 3); g.dialog = null; g.fightBoss(id); g.dialog = null;
      const max = g.boss.max, heads = g.boss.heads.map((h) => h.max ?? 0);
      const states = []; let danger = 0, warned = 0;
      const east = ['frog', 'clappers', 'tune'].includes(id);
      for (let t = 0; t < 7000 && g.boss; t++) {
        const walk = g.boss.st === 'wait';
        g.step(I({ right: walk && !east, left: walk && east }));
        g.dialog = null;
        const b = g.boss;
        if (!b) break;
        const st = id === 'clappers' ? b.heads.map((h) => h.st).join('|') + '|' + b.st : b.st;
        if (states.at(-1)?.st !== st) states.push({ st, tell: b.tellT > 0 });
        // the new attack really throws something: a harm box, a hostile shot or ring while it runs; and its wind-up
        // marks the floor (the frog's shadow, the hydra's sprouts, the warden's and condor's aims, the mother's swirls)
        const now = st.split('|').some((p) => p === NEW[id] || p.startsWith(NEW[id]) && !p.endsWith('Tell')) || (id === 'clappers' && st.split('|').filter((p) => p === 'slam').length === 2);
        if (now && (b.harm.length || g.shots.some((x) => !x.friendly) || g.rings.some((r) => !r.friendly))) danger++;
        if (st.split('|').some((p) => p.startsWith(NEW[id])) && g.markers.length) warned++;
        for (const h of ['dora', 'enzo']) { g.save.heroes[h].down = false; g.save.heroes[h].hp = 9999; g.clampHero(h); }
        if (t === 2400) { b.hp = b.max * 0.5; b.phase = 2; } if (t === 4600) { b.hp = b.max * 0.25; b.phase = 3; }
        events(g);
      }
      return { max, heads, states, danger, warned };
    };
    for (const id of RUSH) {
      const plain = sees(id, 0), plus = sees(id, 1);
      eq(plus.max, Math.round(BOSSES[id].hp * NGP_HP) + (id === 'clappers' ? (Math.round(BOSSES[id].hp * NGP_HP / 2) * 2 - Math.round(BOSSES[id].hp * NGP_HP)) : 0), `${BOSSES[id].name} has 40% more HP in New Game+`);
      eq(plain.max, id === 'clappers' ? Math.round(BOSSES[id].hp / 2) * 2 : BOSSES[id].hp, `and its usual HP in a first game`);
      // (the clappers' double is both clappers slamming at once)
      const isNew = (st) => id === 'clappers' ? st.split('|').filter((p) => p === 'slam').length === 2 : st.split('|').some((p) => p.startsWith(NEW[id]) && !p.endsWith('Tell'));
      const hit = (r) => r.states.findIndex((x) => isNew(x.st));
      ok(hit(plus) >= 0, `${BOSSES[id].name} uses its New Game+ attack (${NEW[id]})`);
      ok(hit(plain) < 0, `but never in a first game`);
      const tell = id === 'clappers' ? plus.states.slice(0, hit(plus)).reverse().find((x) => x.st.split('|').filter((p) => p === 'slamTell').length === 2) : plus.states.slice(0, hit(plus)).reverse().find((x) => x.st.split('|').some((p) => p.startsWith(NEW[id]) || p.endsWith('Tell')));
      ok(tell && tell.st.includes('Tell'), `and it is warned of first (${tell?.st})`);
      ok(plus.danger > 0, `and it can hurt (${plus.danger} steps with something dangerous out)`);
      if (['frog', 'hydra', 'warden', 'mother', 'condor'].includes(id)) ok(plus.warned > 0, `and marks where it will land`);
    }
    // the Bell Warden's falling bells and the Lake Mother's lilies (once dead: their wind-up skipped its first step and
    // placed nothing): each marks the floor during its wind-up, then drops on the marks and can hurt, in both games
    for (const [id, tellSt, kind] of [['warden', 'bellsTell', 'bell'], ['mother', 'liliesTell', 'lily']]) for (const ngp of [0, 1]) {
      const s = finished(); s.ngp = ngp;
      const g = new BellspireGame(s, {}, 2); g.dialog = null; g.fightBoss(id); g.dialog = null;
      let marks = 0, drops = 0, hurt = 0, seen = 0;
      for (let t = 0; t < 9000 && g.boss; t++) {
        const b = g.boss;
        if (t === 300) { b.hp = b.max * 0.2; b.phase = 3; }
        const lead = g.lead, hp = g.save.heroes[lead].hp;
        g.step(I({ right: t < 60 })); g.dialog = null;
        if (!g.boss) break;
        if (g.boss.st === tellSt) { seen++; marks = Math.max(marks, g.markers.filter((m) => m.kind === kind).length); }
        drops = Math.max(drops, g.shots.filter((x) => x.kind === kind && !x.friendly).length);
        if (g.save.heroes[lead].hp < hp && g.shots.some((x) => x.kind === kind)) hurt++;
        for (const h of ['dora', 'enzo']) { g.save.heroes[h].down = false; g.save.heroes[h].hp = 9999; g.clampHero(h); }
      }
      const name = `${BOSSES[id].name}${ngp ? ' (New Game+)' : ''}`;
      ok(seen > 0, `${name} winds up its ${kind === 'bell' ? 'falling bells' : 'lilies'}`);
      ok(marks >= 3, `${name}: its wind-up marks ${marks} spots on the floor`);
      ok(drops >= 3, `${name}: then ${drops} ${kind === 'bell' ? 'bells' : 'lilies'} fall on them`);
      ok(hurt > 0, `${name}: and they can hurt`);
    }
    // NG+ blows land at least NGP_HIT before defence
    const s = finished(); s.ngp = 1;
    const g = new BellspireGame(s, {}, 1); g.dialog = null; g.fightBoss('frog'); g.dialog = null;
    g.boss.st = 'idle'; g.boss.dur = 999;
    const hp0 = g.leadSave.hp; g.hurtLead(BOSSES.frog.atk, g.body.x + 10);
    eq(hp0 - g.leadSave.hp, Math.max(1, Math.round(NGP_HIT * g.assistMul - g.stats(g.lead).def * 0.5)), 'a New Game+ frog hits as hard as NGP_HIT');
    const p = new BellspireGame(finished(), {}, 1); p.dialog = null; p.fightBoss('frog'); p.dialog = null; p.boss.st = 'idle';
    const hp1 = p.leadSave.hp; p.hurtLead(BOSSES.frog.atk, p.body.x + 10);
    ok(hp1 - p.leadSave.hp < hp0 - g.leadSave.hp, 'harder than in a first game');
    void TILE;
  }
  return checks;
}
