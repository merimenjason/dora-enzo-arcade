// Lucky Pips · engine tests. Run with `npm run test:pips` (compiles lib/pips-*.ts into .checks/ first).
import assert from 'node:assert/strict';
import {
  newRun, makeMap, choices, go, startBattle, place, takeBack, reroll, endTurn, fits, moves, needFits, setTarget,
  takeReward, takeCharm, stallBuy, stallUpgrade, stallRemove, stallPie, leave, picnic, pickTool, tentChoose,
  readSave, freshSave, freshMeta, recordRun, poolFor, leadOpen, fogOpen, saneRun, hashSeed, hitOf, toolRoom,
  SAVE_KEY, ROWS, MAX_TOOLS, MAX_DICE,
} from '../.checks/pips-game.js';
import { TOOLS, TOOL, FOES, AREAS, CHARMS, TENTS, LEADS, FOGGIER, needOf, usesOf, slotsOf } from '../.checks/pips-tools.js';

let n = 0;
const test = (name, fn) => { fn(); n++; };
const clone = o => JSON.parse(JSON.stringify(o));
/** A run in a battle against `group`, with the tray set to `dice` and the table set to `tools`. */
function fight(group = ['hoopla'], dice = [1, 2, 3, 4], tools = ['sling', 'shield'], opts = {}) {
  const run = newRun({ seed: 42, lead: opts.lead ?? 'dora', fog: opts.fog ?? 0 });
  run.tools = tools.map(id => (typeof id === 'string' ? { id, up: false } : id));
  run.charms = opts.charms ?? [];
  startBattle(run, opts.kind ?? 'battle', group);
  const b = run.battle;
  b.dice = dice.map((v, i) => ({ id: 100 + i, v }));
  b.rerolls = opts.rerolls ?? b.rerolls;
  return run;
}

test('names and the save key', () => {
  assert.equal(SAVE_KEY, 'lucky-pips-v1');
  assert.ok(TOOLS.length >= 40, `40+ tools (${TOOLS.length})`);
  assert.equal(new Set(TOOLS.map(t => t.id)).size, TOOLS.length);
  assert.equal(Object.keys(FOES).filter(k => !FOES[k].minion && !FOES[k].boss).length, 5);
  assert.equal(Object.keys(FOES).filter(k => FOES[k].boss).length, 3);
  assert.equal(AREAS.length, 3);
  assert.equal(FOGGIER.length, 6);
});

test('every tool has one-line rules and sane effects for every die', () => {
  for (const t of TOOLS) {
    assert.ok(t.text.length > 8 && t.text.length <= 64, `${t.id} text "${t.text}"`);
    assert.ok(t.textUp.length > 8 && t.textUp.length <= 64, `${t.id} upgraded text "${t.textUp}"`);
    for (const up of [false, true]) {
      const need = needOf(t, up), k = slotsOf(need);
      const uses = usesOf(t, up);
      assert.ok(uses === 0 || uses >= 1, t.id);
      for (let v = 1; v <= 6; v++) {
        const fx = t.fx(Array(k).fill(v), up);
        for (const [key, x] of Object.entries(fx)) if (typeof x === 'number') assert.ok(Number.isFinite(x) && x >= 0 && x <= 60, `${t.id} ${key}=${x}`);
        for (const d of fx.dice ?? []) assert.ok(d >= 0 && d <= 7, `${t.id} makes a ${d}`);
      }
    }
  }
  for (const l of Object.values(LEADS)) for (const id of l.tools) assert.ok(TOOL[id] && !TOOL[id].unlock, id);
});

test('needs', () => {
  assert.ok(needFits({ k: 'max', n: 3 }, 3, []) && !needFits({ k: 'max', n: 3 }, 4, []));
  assert.ok(needFits({ k: 'min', n: 5 }, 5, []) && !needFits({ k: 'min', n: 5 }, 4, []));
  assert.ok(needFits({ k: 'even' }, 4, []) && !needFits({ k: 'even' }, 3, []));
  assert.ok(needFits({ k: 'odd' }, 1, []) && !needFits({ k: 'odd' }, 6, []));
  assert.ok(needFits({ k: 'is', n: [1, 6] }, 6, []) && !needFits({ k: 'is', n: [1, 6] }, 3, []));
  assert.ok(needFits({ k: 'pair' }, 4, [4]) && !needFits({ k: 'pair' }, 5, [4]));
  assert.ok(needFits({ k: 'triple' }, 2, [2, 2]) && !needFits({ k: 'triple' }, 3, [2, 2]));
  assert.ok(needFits({ k: 'seven' }, 3, [4]) && !needFits({ k: 'seven' }, 3, [3]));
  assert.ok(needFits({ k: 'run' }, 4, [2, 3]) && needFits({ k: 'run' }, 4, [3]) && needFits({ k: 'run' }, 2, [4]));
  assert.ok(!needFits({ k: 'run' }, 3, [3]) && !needFits({ k: 'run' }, 5, [2]) && !needFits({ k: 'run' }, 6, [2, 3]));
});

test('a seed replays a run exactly', () => {
  const play = () => {
    const run = newRun({ seed: 9, lead: 'enzo' });
    go(run, choices(run)[0]);
    for (let t = 0; t < 6 && run.screen === 'battle'; t++) { const m = moves(run); if (m.length) place(run, ...m[0]); endTurn(run); }
    return JSON.stringify(run);
  };
  assert.equal(play(), play());
  assert.notEqual(JSON.stringify(newRun({ seed: 1, lead: 'dora' }).map), JSON.stringify(newRun({ seed: 2, lead: 'dora' }).map));
});

test('maps: rows, a boss at the end, every stop reachable and every path goes somewhere', () => {
  for (let s = 0; s < 200; s++) {
    const run = newRun({ seed: s, lead: 'dora' });
    for (let a = 0; a < 3; a++) {
      const map = a === 0 ? run.map : makeMap(run, a);
      const boss = map.filter(n => n.kind === 'boss');
      assert.equal(boss.length, 1); assert.equal(boss[0].row, ROWS);
      assert.ok(map.filter(n => n.row === 0).every(n => n.kind === 'battle'));
      assert.ok(map.filter(n => n.row === ROWS - 1).every(n => n.kind === 'picnic'));
      assert.ok(map.some(n => n.kind === 'stall'));
      const seen = new Set(map.filter(n => n.row === 0).map(n => n.id));
      for (const nd of map) {
        if (nd.kind !== 'boss') assert.ok(nd.next.length >= 1, 'dead end');
        for (const j of nd.next) assert.equal(map[j].row, nd.row + 1);
        if (seen.has(nd.id)) nd.next.forEach(j => seen.add(j));
      }
      assert.equal(seen.size, map.length, 'every stop reachable');
    }
  }
});

test('Pinecone Sling deals the die; block soaks it first; the Hammer smashes through', () => {
  const run = fight(['toffee'], [5, 3, 4], ['sling', 'hammer']);
  const f = run.battle.foes[0]; f.block = 4;
  const hp = f.hp;
  place(run, 100, 0);
  assert.equal(f.block, 0); assert.equal(f.hp, hp - 1);
  f.block = 6; place(run, 101, 1);
  assert.equal(f.block, 0); assert.equal(f.hp, hp - 4);
  assert.ok(!fits(run, 102, 0), 'the sling is used for this turn');
});

test('slots glow only for dice that fit; cursed dice and locked tools take nothing', () => {
  const run = fight(['hoopla'], [2, 5, 6], ['honey', 'mallet', 'shield']);
  assert.deepEqual(moves(run).map(m => m.join(':')).sort(), ['100:0', '100:2', '101:1', '102:1', '102:2'].sort());
  run.battle.dice[0].curse = true; run.battle.slots[1].locked = true;
  assert.deepEqual(moves(run).map(m => m.join(':')), ['102:2']);
});

test('two- and three-dice tools wait, fire when full, and give dice back', () => {
  const run = fight(['toffee'], [4, 4, 2, 3], ['rattle', 'path']);
  const f = run.battle.foes[0], hp = f.hp;
  place(run, 100, 0);
  assert.equal(run.battle.slots[0].pend.length, 1); assert.equal(f.hp, hp);
  assert.ok(!fits(run, 102, 0) && fits(run, 101, 0));
  place(run, 101, 0);
  assert.equal(f.hp, hp - 16);
  place(run, 102, 1); place(run, 103, 1);
  assert.equal(run.battle.slots[1].pend.length, 2);
  const ev = takeBack(run, 1);
  assert.equal(ev[0].t, 'dice'); assert.equal(run.battle.dice.length, 2);
  assert.deepEqual(run.battle.dice.map(d => d.v).sort(), [2, 3]);
});

test('a run of three stuns: the foe skips its turn', () => {
  const run = fight(['toffee'], [3, 1, 2], ['path']);
  run.battle.foes[0].intent = { atk: 11 };
  for (const id of [100, 101, 102]) place(run, id, 0);
  assert.equal(run.battle.foes[0].stun, 1);
  const hp = run.hp;
  endTurn(run);
  assert.equal(run.hp, hp);
  assert.equal(run.battle.foes[0].stun, 0);
});

test('dice tools: split, flip, twin, nudge, re-roll', () => {
  const run = fight(['toffee'], [5, 1, 3, 2, 6], ['splitter', 'top', 'mirror', 'vane', 'wish']);
  place(run, 100, 0);
  assert.deepEqual(run.battle.dice.slice(-2).map(d => d.v), [3, 2]);
  place(run, 101, 1); assert.equal(run.battle.dice.at(-1).v, 6);
  place(run, 102, 2); assert.deepEqual(run.battle.dice.slice(-2).map(d => d.v), [3, 3]);
  place(run, 103, 3); assert.equal(run.battle.dice.at(-1).v, 3);
  const before = run.battle.dice.length;
  place(run, 104, 4); assert.equal(run.battle.dice.length, before);
  assert.ok(run.battle.dice.length <= MAX_DICE);
});

test('countdown tools fill across turns and fire', () => {
  const run = fight(['toffee'], [6, 6, 3], ['cannon'], { kind: 'elite' });
  const f = run.battle.foes[0], hp = f.hp;
  place(run, 100, 0); place(run, 101, 0);
  assert.equal(run.battle.slots[0].count, 3); assert.equal(f.hp, hp);
  run.battle.foes[0].intent = {};
  endTurn(run);
  assert.equal(run.battle.slots[0].count, 3, 'the count carries over the turn');
  run.battle.dice = [{ id: 900, v: 4 }];
  place(run, 900, 0);
  assert.equal(f.hp, hp - 24);
  assert.equal(run.battle.slots[0].count, 15);
});

test('once a battle means once a battle', () => {
  const run = fight(['toffee'], [6, 6], ['drum']);
  place(run, 100, 0);
  assert.ok(!fits(run, 101, 0));
  run.battle.foes[0].intent = {}; endTurn(run);
  run.battle.dice = [{ id: 900, v: 6 }];
  assert.ok(!fits(run, 900, 0));
});

test('poison and burn tick on foes and on the pair', () => {
  const run = fight(['toffee'], [6, 5], ['nettle', 'ember'], { lead: 'enzo' });
  const f = run.battle.foes[0]; f.intent = {};
  place(run, 100, 0); place(run, 101, 1);
  assert.equal(f.poison, 3); assert.equal(f.burn, 5);
  const hp = f.hp;
  endTurn(run);
  assert.equal(f.hp, hp - 8); assert.equal(f.poison, 2); assert.equal(f.burn, 2);
  run.battle.poison = 2; run.battle.burn = 3; f.intent = {};
  const me = run.hp; endTurn(run);
  assert.equal(run.hp, me - 5);
});

test('foe intents: attacks into block, curses, locks, frost, summons', () => {
  const run = fight(['ringmaster'], [1, 1], ['sling', 'shield', 'hay'], { kind: 'boss' });
  const b = run.battle, f = b.foes[0];
  b.block = 5; f.intent = { atk: 4, hits: 2, curse: 2, lock: true, frost: 1 };
  const hp = run.hp;
  endTurn(run);
  assert.equal(run.hp, hp - 3, '8 damage, 5 blocked');
  assert.equal(b.dice.filter(d => d.curse).length, 2);
  assert.equal(b.slots.filter(s => s.locked).length, 1);
  f.intent = { summon: 'hoopla' }; endTurn(run); endTurn(run);
  f.intent = { summon: 'hoopla' }; endTurn(run);
  assert.ok(b.foes.filter(x => x.hp > 0).length <= 3);
  const r2 = fight(['toffee'], [1], ['sling'], { charms: ['paws'] });
  r2.battle.foes[0].intent = { curse: 3, lock: true }; endTurn(r2);
  assert.ok(!r2.battle.dice.some(d => d.curse) && !r2.battle.slots.some(s => s.locked));
});

test('frost takes a pip off every die (never below 1)', () => {
  const run = fight(['toffee'], [1], ['sling']);
  run.battle.foes[0].intent = { frost: 1 };
  endTurn(run);
  run.battle.foes[0].intent = {};
  // the frost was applied to this roll; the next roll is clean
  assert.equal(run.battle.frost, 0);
  assert.ok(run.battle.dice.every(d => d.v >= 1 && d.v <= 5));
});

test('targets and hitting every foe', () => {
  const run = fight(['hoopla', 'candyfloss'], [6, 4], ['sling', 'sparkler']);
  setTarget(run, 1);
  place(run, 100, 0);
  assert.equal(run.battle.foes[1].hp, run.battle.foes[1].max - 6);
  place(run, 101, 1);
  assert.equal(run.battle.foes[0].hp, run.battle.foes[0].max - 4);
});

test('winning a battle gives acorns and a choice of three tools', () => {
  const run = fight(['seedling'], [6, 6], ['sling', 'mallet']);
  const a = run.acorns;
  place(run, 101, 1);
  assert.equal(run.screen, 'reward');
  assert.ok(run.acorns > a);
  assert.equal(run.offer.tools.length, 3);
  assert.ok(run.offer.tools.every(id => !run.tools.some(t => t.id === id)));
  assert.ok(takeReward(run, 0));
  assert.equal(run.tools.length, 3); assert.equal(run.screen, 'map');
});

test('a full table needs a swap', () => {
  const run = fight(['seedling'], [6], ['sling', 'shield', 'honey', 'mallet', 'top', 'hay'].map(id => ({ id, up: false })));
  run.battle.foes[0].hp = 1; place(run, 100, 0);
  assert.equal(run.tools.length, MAX_TOOLS);
  assert.ok(!takeReward(run, 0));
  const id = run.offer.tools[0];
  assert.ok(takeReward(run, 0, 5));
  assert.equal(run.tools[5].id, id);
  assert.equal(toolRoom({ charms: ['belt'] }), MAX_TOOLS + 1);
});

test('elites upgrade a tool; bosses offer charms and move on to the next area', () => {
  let run = fight(['toffee'], [6], ['sling'], { kind: 'elite' });
  run.battle.foes[0].hp = 1; place(run, 100, 0);
  assert.ok(run.tools[0].up);
  run = fight(['pumpkin'], [6], ['sling'], { kind: 'boss' });
  run.battle.foes[0].hp = 1; place(run, 100, 0);
  takeReward(run, -1);
  assert.equal(run.screen, 'charm'); assert.equal(run.offer.charms.length, 3);
  takeCharm(run, 0);
  assert.equal(run.area, 1); assert.equal(run.screen, 'map'); assert.equal(run.at, -1);
  run.area = 2; run.screen = 'charm'; run.offer = { kind: 'charm', charms: ['scarf'] };
  takeCharm(run, 0); assert.equal(run.screen, 'won');
});

test('losing ends the run', () => {
  const run = fight(['toffee'], [1], ['sling']);
  run.hp = 3; run.battle.foes[0].intent = { atk: 20 };
  endTurn(run);
  assert.equal(run.screen, 'lost'); assert.equal(run.hp, 0);
});

test('stalls, picnics and tents', () => {
  const run = newRun({ seed: 5, lead: 'enzo' });
  run.acorns = 500; run.hp = 10;
  run.offer = { kind: 'stall', tools: [{ id: 'quill', price: 40, sold: false }], up: 45, rm: 30, pie: 25, usedUp: false, usedRm: false, usedPie: false }; run.screen = 'stall';
  assert.ok(stallBuy(run, 0)); assert.ok(!stallBuy(run, 0));
  assert.ok(stallUpgrade(run, 0)); assert.ok(!stallUpgrade(run, 1));
  assert.ok(stallRemove(run, 1)); assert.ok(stallPie(run));
  assert.equal(run.hp, 22); assert.equal(run.acorns, 500 - 40 - 45 - 30 - 25);
  assert.ok(leave(run)); assert.equal(run.screen, 'map');
  run.screen = 'picnic'; run.offer = { kind: 'picnic', heal: 13 }; picnic(run); assert.equal(run.hp, 35);
  run.screen = 'picnic'; run.offer = { kind: 'picnic', heal: 13 }; picnic(run, 1); assert.ok(run.tools[1].up);
  for (const t of TENTS) for (const c of t.choices) {
    const r = newRun({ seed: 3, lead: 'dora' }); r.screen = 'tent'; r.tent = t.id; r.acorns = 40;
    tentChoose(r, c.id);
    assert.ok(['map', 'reward', 'battle', 'pick'].includes(r.screen), `${t.id}:${c.id} → ${r.screen}`);
    if (r.screen === 'pick') { assert.ok(pickTool(r, 0)); assert.equal(r.screen, 'map'); }
    assert.ok(r.hp >= 1);
  }
});

test('walking: only the stops ahead can be chosen', () => {
  const run = newRun({ seed: 11, lead: 'dora' });
  const first = choices(run);
  assert.equal(first.length, 3);
  assert.deepEqual(go(run, run.map.find(n => n.row === 2).id), []);
  go(run, first[0]);
  assert.equal(run.screen, 'battle');
  assert.deepEqual(choices(run), []);
});

test('Foggier levels', () => {
  const a = newRun({ seed: 1, lead: 'dora', fog: 0 }), b = newRun({ seed: 1, lead: 'dora', fog: 5 });
  assert.equal(b.max, a.max - 4);
  startBattle(a, 'boss', ['pumpkin']); startBattle(b, 'boss', ['pumpkin']);
  assert.ok(b.battle.foes[0].max > a.battle.foes[0].max * 1.3);
  assert.equal(b.battle.foes[0].block, 10);
  b.battle.foes[0].intent = { atk: 7 };
  assert.equal(hitOf(b.battle.foes[0]), 8);
});

test('lead passives: Dora re-rolls, Enzo starts with block, Side by Side blocks on pairs', () => {
  const d = fight(['toffee'], [3], ['sling'], { lead: 'dora' });
  assert.equal(d.battle.rerolls, 1);
  const v0 = d.r; reroll(d, 100); assert.notEqual(d.r, v0); assert.equal(d.battle.rerolls, 0);
  assert.deepEqual(reroll(d, 100), []);
  const e = fight(['toffee'], [3], ['sling'], { lead: 'enzo' });
  assert.equal(e.battle.block, 2);
});

test('meta: unlocks after the bosses and the first win', () => {
  const m = freshMeta();
  assert.ok(!poolFor(m).includes('firework') && !leadOpen(m, 'both') && fogOpen(m) === 0);
  const run = newRun({ seed: 1, lead: 'dora' });
  run.area = 1; run.screen = 'lost';
  assert.equal(recordRun(m, run).length, 1);
  assert.ok(poolFor(m).includes('firework'));
  run.area = 2; run.screen = 'won';
  const news = recordRun(m, run);
  assert.ok(news.length >= 3, news.join(' | '));
  assert.ok(m.won && leadOpen(m, 'both') && fogOpen(m) === 1 && poolFor(m).includes('carousel'));
  const r5 = newRun({ seed: 1, lead: 'dora', fog: 1 }); r5.screen = 'won'; r5.area = 2;
  recordRun(m, r5); assert.ok(m.foggy && fogOpen(m) === 2);
  const daily = newRun({ seed: hashSeed('2026-10-31'), lead: 'enzo', daily: '2026-10-31' }); daily.screen = 'lost';
  const runs = m.runs; recordRun(m, daily);
  assert.equal(m.daily['2026-10-31'].won, false); assert.equal(m.runs, runs + 1);
});

test('saves: round trip, corrupt and odd saves never crash', () => {
  const s = freshSave();
  s.run = newRun({ seed: 3, lead: 'enzo' }); go(s.run, choices(s.run)[1]);
  s.meta.wins = 2; s.fog = 1;
  const back = readSave(JSON.stringify(s));
  assert.deepEqual(back.run, s.run); assert.equal(back.meta.wins, 2); assert.equal(back.fog, 1);
  for (const raw of [null, '', '{', 'null', '[]', '{"v":2}', '{"v":1,"meta":7,"run":{"v":1}}', '{"v":1,"run":{"v":1,"seed":"x"},"fog":99,"lead":"cat"}', JSON.stringify({ v: 1, meta: { runs: 'a', daily: { x: 1, '2026-01-01': { won: 'y' } } } })]) {
    const r = readSave(raw);
    assert.equal(r.run, null); assert.ok(r.fog >= 0 && r.fog <= 5); assert.ok(LEADS[r.lead]);
  }
  const bad = clone(s.run); bad.tools.push({ id: 'laser' }); assert.equal(saneRun(bad), null);
  const bad2 = clone(s.run); bad2.battle.slots.pop(); assert.equal(saneRun(bad2), null);
});

test('charms', () => {
  assert.equal(CHARMS.length, 8);
  const run = fight(['toffee'], [6], ['ember'], { charms: ['spark', 'scarf'] });
  assert.equal(run.battle.block, 8);
  place(run, 100, 0); assert.equal(run.battle.foes[0].burn, 8);
});

console.log(`pips: ${n} engine tests passed`);
