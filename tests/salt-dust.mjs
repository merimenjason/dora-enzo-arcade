// Salt & Dust engine tests: saves, walking and talking, every skill check and its consequence, the journey and its
// water, the fight (reach, odds, AP, turns, the Runners' moves, winning, losing, mending, drinking), the ending, a
// seed replaying exactly, and that every action has its own painted frames. Run after compiling the engine into
// .checks/ (npm test does).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  SaltGame, freshSave, parseSave, SAVE_KEY, TALK, NPCS, SPOTS, MAPS, HEROES, RULES, LEGS, EVENTS, WATER_MAX, FRAMES, LEG_TIME, FIND_TIME, dist,
} from '../.checks/salt-dust-game.js';
import { ART } from '../.checks/salt-dust-art.js';

let n = 0;
const test = (name, fn) => { fn(); n++; };
const run = (g, s = 30) => { for (let i = 0; i < s * 30; i++) g.tick(1 / 30); };
/** pick the reply whose text matches */
const say = (g, re) => {
  const o = g.options(); const i = o.findIndex((q) => re.test(q.text));
  assert.ok(i >= 0, `no reply ${re} in ${g.talk?.id}: ${o.map((q) => q.text).join(' | ')}`);
  return g.choose(i);
};
const talkTo = (g, id) => { assert.ok(g.clickNpc(id), `can walk to ${id}`); run(g, 12); assert.equal(g.mode, 'talk', `talking to ${id}`); };
const close = (g) => { let k = 0; while (g.mode === 'talk' && k++ < 10) { const o = g.options(); g.choose(o.length - 1); } };

test('a fresh save starts in Tunupa Well with 6 water and 4 silver, and round-trips', () => {
  const g = new SaltGame(freshSave(5));
  assert.equal(g.place, 'town'); assert.equal(g.water, 6); assert.equal(g.silver, 4); assert.equal(SAVE_KEY, 'salt-dust-v1');
  const s = parseSave(JSON.stringify(g.save()));
  assert.ok(s); assert.equal(s.water, 6);
  assert.equal(parseSave('nope'), null); assert.equal(parseSave(JSON.stringify({ v: 2 })), null); assert.equal(parseSave(null), null);
  assert.equal(parseSave(JSON.stringify({ ...g.save(), place: 'mars' })), null);
});

test('every place is walkable from the start, and every person and spot can be reached', () => {
  for (const place of ['town', 'yard']) {
    const g = new SaltGame(freshSave()); g.place = place; g.resetPositions();
    assert.ok(g.open(...MAPS[place].dora, true), `${place} start is open`);
    for (const npc of NPCS.filter((q) => q.place === place)) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => [npc.x + dx, npc.y + dy]);
      assert.ok(g.route(near), `${npc.id} reachable`);
    }
    for (const s of SPOTS.filter((q) => q.place === place)) assert.ok(g.route([s.at]), `${s.id} reachable`);
  }
});

test('clicking a tile walks there one tile at a time, Enzo following', () => {
  const g = new SaltGame(freshSave());
  assert.ok(g.clickTile(14, 14));
  run(g, 5);
  assert.deepEqual([g.party.dora.x, g.party.dora.y], [14, 14]);
  assert.ok(Math.max(Math.abs(g.party.enzo.x - 14), Math.abs(g.party.enzo.y - 14)) <= 1, 'Enzo is beside her');
  assert.equal(g.clickTile(0, 0), false, 'a wall is not a destination');
  assert.ok(g.step(0, -1)); run(g, 1); assert.deepEqual([g.party.dora.x, g.party.dora.y], [14, 13]);
});

test('Wayra: the errand, the tip about Parina’s pump, a Scout check on the Runners, and a rest', () => {
  const g = new SaltGame(freshSave());
  talkTo(g, 'wayra');
  assert.equal(g.options().some((o) => /Scout/.test(o.text)), false, 'no Scout question before the errand');
  say(g, /Coipa Yard/); assert.ok(g.f.quest); say(g, /find that spring/);
  const scout = g.options().find((o) => /Scout 5/.test(o.text));
  assert.ok(scout.pass); assert.equal(scout.check.who, 'dora'); assert.equal(scout.check.have, 6);
  say(g, /Scout 5/); assert.ok(g.f.tracks); assert.equal(g.talk.id, 'wayra.tracks'); assert.deepEqual(g.passed, ['wayra.hello:scout']);
  say(g, /Thank/); say(g, /haggle/); assert.ok(g.f.pumpTip);
  say(g, /remember/);
  g.hp.dora = 3; assert.ok(g.options().some((o) => /rest/.test(o.text))); say(g, /rest/); assert.equal(g.hp.dora, HEROES.dora.hp);
  close(g); assert.equal(g.mode, 'explore');
});

test('Parina: Barter 6 fails without Wayra’s tip (Enzo has 5)', () => {
  const g = new SaltGame(freshSave());
  talkTo(g, 'parina');
  assert.equal(g.line(), 'Water is three cups a silver. For strangers, four.');
  const b = g.options().find((o) => /Barter 6/.test(o.text));
  assert.equal(b.text, '[Barter 6] Three, and we mend your pump.');
  assert.equal(b.pass, false); assert.equal(b.check.have, 5);
  say(g, /Barter 6/); assert.equal(g.talk.id, 'parina.sniff'); assert.ok(!g.f.guild); assert.ok(g.f.barterTried);
  say(g, /Of course/);
  assert.equal(g.options().some((o) => /Barter/.test(o.text)), false, 'one try only');
  say(g, /two cups/); assert.equal(g.silver, 1); assert.equal(g.water, 8);
  say(g, /Thank/);
  assert.ok(g.options().find((o) => /two cups/.test(o.text)).blocked, 'no silver left for more');
});

test('Parina: with the tip, Barter passes: Enzo mends her pump, three cups, the Guild seal and the friends’ price', () => {
  const g = new SaltGame(freshSave());
  g.f.pumpTip = true;
  talkTo(g, 'parina');
  const b = g.options().find((o) => /Barter 6/.test(o.text));
  assert.ok(b.pass); assert.match(b.check.parts, /Enzo 5 \+ 1 Wayra/);
  say(g, /Barter 6/); assert.ok(g.f.guild); assert.equal(g.water, 9);
  say(g, /pleasure/i);
  say(g, /Three cups, please/); assert.equal(g.silver, 3); assert.equal(g.water, WATER_MAX);
});

test('the Warden Captain: tax, a Repair check on the pulley, and a Speech check that needs Wayra’s errand', () => {
  let g = new SaltGame(freshSave());
  talkTo(g, 'captain');
  let sp = g.options().find((o) => /Speech 6/.test(o.text)); assert.equal(sp.pass, false);
  say(g, /Speech 6/); assert.equal(g.talk.id, 'captain.noshare'); assert.ok(!g.f.wardens);
  say(g, /Fair/);
  say(g, /Repair 6/); assert.ok(g.f.pulley); assert.equal(g.water, 10); say(g, /Glad/);
  assert.equal(g.options().some((o) => /two silver/.test(o.text)), false, 'the fill is done');
  g = new SaltGame(freshSave()); g.f.quest = true;
  talkTo(g, 'captain');
  sp = g.options().find((o) => /Speech 6/.test(o.text)); assert.ok(sp.pass);
  say(g, /Speech 6/); assert.ok(g.f.wardens); assert.equal(g.water, 8); say(g, /tell her/);
  say(g, /two silver/); assert.equal(g.silver, 2); assert.equal(g.water, 10);
});

test('the road out needs the errand, then opens the journey', () => {
  const g = new SaltGame(freshSave());
  assert.ok(g.clickSpot('road')); run(g, 10); assert.equal(g.mode, 'talk');
  assert.equal(g.options().length, 1); close(g);
  g.f.quest = true; g.clickSpot('road'); run(g, 3);
  say(g, /Set out/); assert.equal(g.mode, 'travel'); assert.equal(g.at, 'tunupa');
  assert.equal(g.legs().length, 2);
  assert.ok(g.backToTown()); assert.equal(g.mode, 'explore');
});

test('the flat drains the canteen a cup at a time, and the island events pay off', () => {
  const g = new SaltGame(freshSave()); g.f.quest = true; g.startTravel();
  g.go(1); g.tick(LEG_TIME * 0.6); assert.equal(g.water, 5, 'a cup gone part-way');
  run(g, 3); assert.equal(g.at, 'isle1'); assert.equal(g.mode, 'talk'); assert.equal(g.talk.id, 'ev.cistern');
  say(g, /Repair 5/); assert.equal(g.water, 9); close(g); assert.equal(g.mode, 'travel');
  g.go(0); run(g, 3); assert.equal(g.talk.id, 'ev.caravan');
  say(g, /mend your wheel/); assert.ok(g.f.caravanTip); assert.equal(g.silver, 6); close(g);
  g.go(0); run(g, 3); assert.equal(g.mode, 'explore'); assert.equal(g.place, 'yard'); assert.equal(g.water, 7);
});

test('the straight way: two hot stages and the Runners’ carts; Dora’s Scout check keeps you unseen', () => {
  const g = new SaltGame(freshSave()); g.startTravel();
  g.go(0); run(g, 3); assert.equal(g.water, 4); assert.equal(g.talk.id, 'ev.runners');
  say(g, /Scout 6/); assert.ok(g.f.unseen); close(g);
  g.go(0); run(g, 3); assert.equal(g.water, 2); assert.equal(g.place, 'yard');
});

test('an empty canteen hurts but never kills, and resting costs a cup', () => {
  const g = new SaltGame(freshSave()); g.water = 1; g.startTravel();
  g.go(0); run(g, 3);
  assert.equal(g.water, 0); assert.equal(g.hp.dora, HEROES.dora.hp - 2);
  close(g);
  g.hp.dora = 2; g.hp.enzo = 2; g.go(0); run(g, 3); assert.equal(g.hp.dora, 1); assert.equal(g.hp.enzo, 1);
  const h = new SaltGame(freshSave()); h.startTravel(); h.hp.dora = 5; assert.ok(h.rest()); assert.equal(h.water, 5); assert.equal(h.hp.dora, HEROES.dora.hp);
  assert.equal(h.rest(), false, 'no rest when nobody is hurt');
});

const atYard = (flags = {}, water = 6) => { const g = new SaltGame(freshSave(3)); Object.assign(g.f, flags); g.water = water; g.arriveYard(); return g; };
test('Tika: Speech 6 passes only with the Wardens’ word; failing raises her toll', () => {
  let g = atYard();
  talkTo(g, 'tika');
  assert.equal(g.options().find((o) => /Speech 6/.test(o.text)).pass, false);
  say(g, /Speech 6/); assert.equal(g.talk.id, 'tika.wind'); assert.equal(g.toll(), 4); say(g, /Hm/);
  assert.ok(g.options().find((o) => /Take 4 water/.test(o.text)));
  g = atYard({ wardens: true });
  talkTo(g, 'tika'); say(g, /Speech 6/); assert.equal(g.f.peace, 'share'); close(g);
  assert.deepEqual([g.npcs().find((q) => q.id === 'tika').x, g.npcs().find((q) => q.id === 'tika').y], [18, 7], 'the Runners stand aside');
});

test('Tika: the cracked mast, the Guild seal and the toll each make peace', () => {
  let g = atYard();
  talkTo(g, 'tika');
  assert.equal(g.options().some((o) => /mast/.test(o.text)), false, 'no mast line without the herder’s tip');
  close(g);
  g = atYard({ caravanTip: true }); talkTo(g, 'tika'); say(g, /Scout 6/); assert.equal(g.f.peace, 'mast');
  g = atYard({ guild: true }); talkTo(g, 'tika'); say(g, /Guild/); assert.equal(g.f.peace, 'guild');
  g = atYard({}, 2); talkTo(g, 'tika'); assert.ok(g.options().find((o) => /toll/.test(o.text)).blocked);
  g = atYard({}, 5); talkTo(g, 'tika'); say(g, /toll/); assert.equal(g.water, 2); assert.equal(g.f.peace, 'toll');
});

test('the pump: Enzo cranks the gauge, the spring comes up, and the ending card names how you did it', () => {
  const g = atYard({ guild: true, wardens: true });
  g.clickSpot('pump'); run(g, 15); assert.equal(g.mode, 'talk');
  assert.equal(g.options().some((o) => /Crank/.test(o.text)), false, 'not while the Runners watch');
  close(g);
  talkTo(g, 'tika'); say(g, /Guild/); close(g);
  g.clickSpot('pump'); run(g, 15); say(g, /Crank/);
  assert.equal(g.mode, 'finding'); g.tick(FIND_TIME + 0.1); assert.equal(g.mode, 'end');
  const e = g.ending();
  assert.match(e.lines[0], /Guild/); assert.ok(e.lines.some((l) => /Wardens/.test(l))); assert.match(e.next, /What’s next/);
  assert.equal(parseSave(JSON.stringify(g.save())).mode, 'end');
});

const fight = (flags = {}, seed = 3) => { const g = atYard(flags); g.r.state = seed; talkTo(g, 'tika'); say(g, /hard way/); return g; };
test('the fight: turn order, AP, movement range and the sling’s odds', () => {
  const g = fight();
  assert.equal(g.mode, 'combat'); assert.equal(g.current().id, 'dora');
  assert.deepEqual(g.combat.order, ['dora', 'runnerA', 'enzo', 'runnerB', 'tika']);
  const d = g.current(); assert.equal(d.ap, 7);
  const reach = g.reach(d);
  for (const p of reach.values()) assert.ok(p.length <= 7);
  assert.ok(reach.size > 20);
  const tika = g.unit('tika');
  const ch = g.hitChance(d, tika), dd = dist(d, tika);
  assert.equal(ch, dd > RULES.slingRange ? 0 : Math.max(40, 85 - 5 * Math.max(0, Math.ceil(dd) - 2)));
  // walk into range, then sling twice? 7 AP: two tiles and one stone, or one stone and four tiles
  const [k] = [...reach.entries()].filter(([, p]) => p.length === 3).sort((a, b) => dist({ x: +a[0].split(',')[0], y: +a[0].split(',')[1] }, tika) - dist({ x: +b[0].split(',')[0], y: +b[0].split(',')[1] }, tika))[0];
  const [x, y] = k.split(',').map(Number);
  assert.ok(g.move(x, y)); assert.equal(d.ap, 4);
  assert.ok(g.hitChance(d, tika) > 0);
  assert.ok(g.attack('tika')); assert.equal(d.ap, 1);
  assert.equal(g.attack('tika'), false, 'not enough AP');
  assert.equal(g.move(0, 0), false);
  g.endTurn(); assert.equal(g.current().id, 'runnerA');
  assert.equal(g.move(10, 10), false, 'not the heroes’ turn');
});

test('the Runners close in and jab; Enzo mends and can bring a friend back up; drinking costs water', () => {
  const g = fight();
  g.endTurn();
  const a = g.unit('runnerA'), before = Math.min(...['dora', 'enzo'].map((h) => Math.max(Math.abs(g.unit(h).x - a.x), Math.abs(g.unit(h).y - a.y))));
  g.foeTurn();
  const after = Math.min(...['dora', 'enzo'].map((h) => Math.max(Math.abs(g.unit(h).x - a.x), Math.abs(g.unit(h).y - a.y))));
  assert.ok(after < before, 'moved closer');
  assert.equal(g.current().id, 'enzo');
  const dora = g.unit('dora'), enzo = g.unit('enzo');
  dora.hp = 0; dora.down = true;
  enzo.x = dora.x + 1; enzo.y = dora.y; enzo.ap = 6;
  assert.ok(g.canMend(dora)); assert.ok(g.mend('dora')); assert.equal(dora.down, false); assert.equal(dora.hp, 5); assert.equal(g.combat.mends, 1);
  enzo.hp = 10; const w = g.water; assert.ok(g.drink()); assert.equal(g.water, w - 1); assert.equal(enzo.hp, 13);
});

test('winning: beat Tika and the rest give up; the yard is yours', () => {
  const g = fight();
  const t = g.unit('tika'); const d = g.current();
  t.x = d.x + 1; t.y = d.y; t.hp = 1;
  for (let i = 0; i < 20 && !g.combat.over; i++) { d.ap = 7; g.attack('tika'); }
  assert.equal(g.combat.over, 'won');
  assert.ok(g.events.some((e) => e.k === 'surrender'));
  g.syncFromCombat(); g.finishCombat();
  assert.equal(g.mode, 'talk'); assert.equal(g.talk.id, 'tika.beaten'); assert.equal(g.f.peace, 'fought');
  close(g); g.clickSpot('pump'); run(g, 15); assert.ok(g.options().some((o) => /Crank/.test(o.text)));
});

test('losing: Tika takes half the water and you wake at the edge of the yard to try again', () => {
  const g = fight({}, 9); g.water = 7;
  for (const h of ['dora', 'enzo']) { const u = g.unit(h); u.hp = 1; }
  g.unit('dora').down = true; g.unit('dora').hp = 0;
  const e = g.unit('enzo'); const a = g.unit('runnerA'); a.x = e.x + 1; a.y = e.y;
  g.endTurn();
  for (let i = 0; i < 40 && !g.combat.over; i++) { if (g.current().side === 'foe') g.foeTurn(); else g.endTurn(); }
  assert.equal(g.combat.over, 'lost');
  g.finishCombat();
  assert.equal(g.water, 3); assert.equal(g.talk.id, 'tika.won'); assert.equal(g.hp.dora, 7); assert.equal(g.f.peace, undefined);
  close(g); talkTo(g, 'tika'); assert.ok(g.options().some((o) => /hard way/.test(o.text)));
});

test('the quiet approach: Runners doze through the first round and the heroes start closer', () => {
  const g = fight({ tracks: true });
  assert.ok(g.combat.quiet);
  g.endTurn(); assert.equal(g.current().id, 'enzo', 'runnerA naps');
  g.endTurn(); assert.equal(g.current().id, 'dora', 'both Runners and Tika nap');
  g.endTurn(); assert.equal(g.current().id, 'runnerA');
});

test('help on: the Runners aim a little worse', () => {
  const g = fight(); const a = g.unit('runnerA'), d = g.unit('dora'); a.x = d.x + 1; a.y = d.y;
  g.help = true; assert.equal(g.hitChance(a, d), RULES.spearHitHelp);
  g.help = false; assert.equal(g.hitChance(a, d), RULES.spearHit);
});

test('a seed replays a fight exactly', () => {
  const play = () => {
    const g = fight({}, 77); const out = [];
    for (let i = 0; i < 200 && !g.combat.over; i++) {
      const u = g.current();
      if (u.side === 'foe') g.foeTurn();
      else {
        const foe = g.combat.units.filter((f) => f.side === 'foe' && !f.down)[0];
        if (g.hitChance(u, foe) > 0 && u.ap >= g.attackCost(u)) g.attack(foe.id);
        else { const r = [...g.reach(u).entries()].sort((p, q) => dist({ x: +p[0].split(',')[0], y: +p[0].split(',')[1] }, foe) - dist({ x: +q[0].split(',')[0], y: +q[0].split(',')[1] }, foe))[0]; if (r && u.ap > 0) { const [x, y] = r[0].split(',').map(Number); if (!g.move(x, y)) g.endTurn(); } else g.endTurn(); }
      }
      out.push(JSON.stringify(g.events.splice(0)));
    }
    return out.join('|');
  };
  assert.equal(play(), play());
});

test('every conversation node exists, and every journey leg and event is wired', () => {
  for (const npc of NPCS) if (npc.talk) assert.ok(TALK[npc.talk], npc.talk);
  for (const s of SPOTS) assert.ok(TALK[s.talk], s.talk);
  for (const ev of Object.values(EVENTS)) assert.ok(TALK[ev], ev);
  for (const legs of Object.values(LEGS)) for (const l of legs) assert.ok(l.to in LEGS);
  for (const [id, node] of Object.entries(TALK)) { assert.ok(node.opts.length > 0, id); if (node.art) assert.ok(existsSync(new URL(`../public/art/salt-dust/${node.art}.webp`, import.meta.url)), node.art); }
});

test('every action has its own painted frames, and every frame exists in its strip', () => {
  for (const [sp, acts] of Object.entries(FRAMES)) {
    assert.ok(ART[sp], `${sp} is painted`);
    assert.ok(existsSync(new URL(`../public/art/salt-dust/${sp}.webp`, import.meta.url)));
    const seen = new Map();
    for (const [act, fr] of Object.entries(acts)) {
      for (const f of fr) assert.ok(f >= 0 && f < ART[sp][2], `${sp}.${act} frame ${f}`);
      const key = fr.join(',');
      if (act !== 'backIdle' && act !== 'backWalk') { assert.ok(!seen.has(key), `${sp}.${act} reuses ${seen.get(key)}`); seen.set(key, act); }
    }
  }
  for (const h of ['dora', 'enzo']) for (const act of ['idle', 'walk', 'attack', 'hit', 'down', 'talk', 'backIdle', 'backWalk', 'drink', 'cheer']) assert.ok(FRAMES[h][act], `${h}.${act}`);
  for (const act of ['crank', 'mend']) assert.ok(FRAMES.enzo[act]);
  for (const name of ['portraits', 'bg-town', 'bg-yard', 'bg-map', 'ending', 'title', 'ui-panel', 'ui-plaque', 'tile-move', 'tile-attack', 'tile-grid']) assert.ok(ART[name], name);
});

console.log(`Salt & Dust: ${n} engine tests passed.`);
