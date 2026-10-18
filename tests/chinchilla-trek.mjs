import assert from 'node:assert/strict';
import * as G from '../.checks/chinchilla-trek-game.js';

let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n${e.stack}`); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ---- the data ----

test('data: 18 skills and 4 evolutions', () => {
  assert.equal(G.SKILL_IDS.length, 18); assert.equal(Object.keys(G.SKILLS).length, 18);
  assert.deepEqual([...G.EVO_IDS], ['storm', 'fury', 'bramble', 'feast']);
  const used = new Set();
  for (const id of G.EVO_IDS) {
    const [a, b] = G.EVOS[id].from;
    assert.ok(G.SKILLS[a] && G.SKILLS[b] && a !== b, id);
    for (const s of [a, b]) { assert.ok(!used.has(s), `${s} is in two evolutions`); used.add(s); }
  }
  assert.deepEqual(G.EVOS.storm.from, ['combo', 'static']); assert.deepEqual(G.EVOS.fury.from, ['keen', 'grit']);
  assert.deepEqual(G.EVOS.bramble.from, ['shell', 'prickle']); assert.deepEqual(G.EVOS.feast.from, ['snack', 'nap']);
});

test('data: skill values match the spec', () => {
  const want = {
    combo: [0.2, 0.35, 0.5], counter: [0.2, 0.35, 0.5], sharp: [0.15, 0.25, 0.4], keen: [0.1, 0.2, 0.3], fluff: [0.2, 0.35, 0.5],
    shell: [0.15, 0.25, 0.4], dust: [0.08, 0.15, 0.22], static: [0.5, 0.8, 1.2], snack: [0.08, 0.14, 0.2], nap: [0.02, 0.04, 0.06],
    grit: [0.3, 0.5, 0.8], prickle: [0.15, 0.25, 0.4], pounce: [2.5, 4, 5.5], roll: [1.5, 2.5, 3.5], pepper: [0.1, 0.15, 0.2],
    frost: [0.12, 0.2, 0.28], lucky: [0.2, 0.4, 0.6], wind: [0.3, 0.5, 0.7],
  };
  assert.deepEqual(Object.keys(want), [...G.SKILL_IDS], 'spec order');
  for (const [id, v] of Object.entries(want)) { assert.deepEqual([...G.SKILLS[id].v], v, id); assert.equal(G.SKILLS[id].text.length, 3, id); }
  assert.equal(G.ZAP_CHANCE, 0.25);
});

test('data: 5 chapters, each with 4 foes, an elite and a boss of the right rank and chapter', () => {
  assert.deepEqual(G.CHAPTERS.map((c) => c.name), ['Clover Meadow', 'Bramble Wood', 'Willow River', 'Frosty Peak', 'Moon Hollow']);
  assert.equal(Object.keys(G.FOES).length, 30);
  G.CHAPTERS.forEach((ch, i) => {
    assert.equal(ch.no, i + 1); assert.equal(ch.foes.length, 4);
    for (const f of ch.foes) { assert.equal(G.FOES[f].rank, 'foe', f); assert.equal(G.FOES[f].chapter, ch.no, f); }
    assert.equal(G.FOES[ch.elite].rank, 'elite'); assert.equal(G.FOES[ch.boss].rank, 'boss');
    assert.equal(G.FOES[ch.elite].chapter, ch.no); assert.equal(G.FOES[ch.boss].chapter, ch.no);
  });
  assert.deepEqual(G.CHAPTERS.map((c) => c.boss), ['kingmole', 'badger', 'otter', 'foxqueen', 'hornedowl']);
  const base = { foe: [40, 6], elite: [90, 8], boss: [180, 11] };
  for (const f of Object.values(G.FOES)) {
    const [h, a] = base[f.rank];
    assert.ok(f.hp >= h * 0.8 - 1e-9 && f.hp <= h * 1.2 + 1e-9 && f.atk >= a * 0.8 - 1e-9 && f.atk <= a * 1.2 + 1e-9, `${f.id} within 20% of its rank`);
  }
});

test('data: elites and bosses all have traits', () => {
  const want = { hedgepig: 'shell', kingmole: 'rage', raccoon: 'double', badger: 'rage', turtle: 'shell', otter: 'double', pika: 'swift', foxqueen: 'chill', shadowcat: 'swift', hornedowl: 'regen', wasp: 'sting' };
  for (const [id, t] of Object.entries(want)) assert.equal(G.FOES[id].trait, t, id);
  for (const f of Object.values(G.FOES)) if (f.rank !== 'foe') assert.ok(f.trait, f.id);
});

test('data: scenes', () => {
  const rollable = G.SCENES.filter((s) => !s.followUp), ids = new Set(G.SCENES.map((s) => s.id));
  assert.equal(ids.size, G.SCENES.length, 'unique ids');
  assert.ok(rollable.length >= 20, `${rollable.length} rollable scenes`);
  for (const n of [1, 2, 3, 4, 5]) assert.ok(rollable.filter((s) => s.chapter === n).length >= 2, `chapter ${n}`);
  assert.ok(rollable.filter((s) => s.chapter === 0).length >= 8, 'general scenes');
  for (const s of G.SCENES) {
    assert.equal(s.choices.length, 2, s.id);
    for (const c of s.choices) {
      if (c.odds !== undefined) { assert.ok(c.odds > 0 && c.odds < 1 && c.lose && c.loseText, `${s.id} odds`); }
      for (const e of [...c.win, ...(c.lose ?? [])]) if (e.k === 'later') { const f = G.SCENES.find((x) => x.id === e.scene); assert.ok(f?.followUp, `${s.id} → ${e.scene}`); }
    }
    const words = JSON.stringify(s).toLowerCase();
    for (const bad of ['kill', ' die', 'dead', 'blood', 'steal']) assert.ok(!words.includes(bad), `${s.id} says ${bad}`);
  }
  for (const id of ['mushroom', 'bird', 'dustbath', 'pip']) assert.ok(ids.has(id), `the spec's ${id} scene`);
});

test('data: day weights sum to 100, fixed days per the spec', () => {
  assert.equal(Object.values(G.DAY_WEIGHTS).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(G.DAY_WEIGHTS, { fight: 40, story: 20, cache: 12, find: 10, rest: 8, wheel: 5, pedlar: 5 });
  assert.deepEqual({ ...G.FIXED_DAYS }, { 10: 'elite', 15: 'crossroads', 20: 'elite', 25: 'pedlar', 30: 'boss' });
});

test('data: gear and rarities', () => {
  assert.deepEqual([...G.RARITY], ['Plain', 'Fine', 'Rare', 'Grand', 'Legend']);
  assert.deepEqual(G.GEAR_STAT.hat, [10, 20, 35, 55, 80]); assert.deepEqual(G.GEAR_STAT.scarf, [1, 2, 4, 6, 9]);
  assert.ok(near(G.GEAR_STAT.charm[4], 0.12) && near(G.GEAR_STAT.boots[4], 0.08));
});

test('rand and mix are deterministic', () => {
  const a = new G.Rand(7), b = new G.Rand(7);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  assert.equal(G.mix(3, 4), G.mix(3, 4)); assert.notEqual(G.mix(3, 4), G.mix(4, 3));
});


// ---- stats and the fight ----

const kit = (skills = {}, evos = [], bonus = {}) => ({ skills, evos, bonus: { hp: 0, atk: 0, crit: 0, dodge: 0, ...bonus } });
const S = (atk = 10, hp = 100, crit = 0, dodge = 0) => ({ hp, atk, crit, dodge });
const F = (o = {}) => { const stats = o.stats ?? S(); return G.fight({ stats, hp: o.hp ?? stats.hp, kit: o.kit ?? kit(), foe: o.foe ?? 'beetle', chapter: o.chapter ?? 1, day: o.day ?? 0, seed: o.seed ?? 1, wind: o.wind ?? false }); };
const many = (o, n = 300) => Array.from({ length: n }, (_, i) => F({ ...o, seed: i + 1 }));
const hits = (out, side, src) => out.events.filter((e) => e.k === 'hit' && (side === undefined || e.side === side) && (src === undefined || e.src === src));
/** The events of each round, split on the round markers. */
const rounds = (out) => { const r = [[]]; for (const e of out.events) { if (e.k === 'round') r.push([]); else r.at(-1).push(e); } return r; };
const TANK = S(10, 100000);

test('stats: dora and enzo perks, sharp, fluff, keen, dust and caps', () => {
  assert.deepEqual(G.heroStats(G.BASE, 'dora', kit()), { hp: 110, atk: 10, crit: 0.05, dodge: 0 });
  assert.deepEqual(G.heroStats(G.BASE, 'enzo', kit()), { hp: 100, atk: 11, crit: 0.05, dodge: 0 });
  assert.equal(G.heroStats(G.BASE, 'enzo', kit({ sharp: 3 })).atk, 15);
  assert.equal(G.heroStats(G.BASE, 'dora', kit({ fluff: 2 })).hp, 149);
  const s = G.heroStats(G.BASE, 'enzo', kit({ keen: 3, dust: 3 }));
  assert.ok(near(s.crit, 0.35) && near(s.dodge, 0.22));
  const c = G.heroStats(G.BASE, 'enzo', kit({}, [], { crit: 2, dodge: 1, atk: 0.5, hp: -0.2 }));
  assert.ok(near(c.crit, 0.9) && near(c.dodge, 0.6)); assert.equal(c.atk, 17); assert.equal(c.hp, 80);
  assert.ok(near(G.heroStats(G.BASE, 'enzo', kit({}, ['fury'])).crit, 0.35), 'an evolution keeps its halves at level 3');
});

test('foe stats scale by chapter and day', () => {
  assert.deepEqual(G.foeStats('beetle', 1, 0), { hp: 46, atk: 5 });
  assert.deepEqual(G.foeStats('crab', 3, 10), { hp: 140, atk: 16 });
});

test('a plain fight: hero first, alternating, a win gives the foe 0 hp', () => {
  const out = F();
  assert.equal(out.result, 'win'); assert.equal(out.events.at(-1).k, 'end');
  const firstHit = out.events.find((e) => e.k === 'hit'); assert.equal(firstHit.side, 1); assert.equal(firstHit.dmg, 10);
  assert.equal(hits(out, 1).at(-1).hp, 0); assert.equal(out.hp, 100 - 5 * hits(out, 0).length);
  assert.deepEqual([out.foeHp, out.foeAtk], [46, 5]);
});

test('pounce multiplies the first attack, by level', () => {
  assert.equal(hits(F({ kit: kit({ pounce: 2 }) }), 1)[0].dmg, 40);
  assert.equal(hits(F({ kit: kit({ pounce: 1 }) }), 1)[0].dmg, 25);
  assert.equal(hits(F({ kit: kit({ pounce: 1 }) }), 1)[1].dmg, 10, 'only the first');
});

test('combo never attacks more than twice in a turn, and fires more at level 3', () => {
  const count = (lv) => { let extra = 0; for (const out of many({ stats: TANK, kit: kit({ combo: lv }), foe: 'vole', chapter: 2, day: 10 }, 100)) for (const r of rounds(out)) { const n = r.filter((e) => e.k === 'attack' && e.side === 0).length; assert.ok(n <= 2, `${n} attacks`); if (n === 2) extra++; } return extra; };
  const l1 = count(1), l3 = count(3); assert.ok(l1 > 0 && l3 > l1 * 1.5, `${l1} vs ${l3}`);
});

test('counter does not counter a counter, and never follows a dodge', () => {
  let seen = 0;
  for (const out of many({ stats: S(10, 100000, 0, 0.3), kit: kit({ counter: 3 }), foe: 'vole', chapter: 2, day: 10 }, 100)) {
    const ev = out.events;
    ev.forEach((e, i) => {
      if (e.k !== 'hit' || e.src !== 'counter') return;
      seen++;
      const prev = ev.slice(0, i).reverse().find((x) => x.k === 'hit' || x.k === 'dodge' || x.k === 'attack');
      assert.ok(prev.k === 'hit' && prev.side === 0 && prev.src === 'attack', 'a counter answers a landed foe attack');
      const next = ev.slice(i + 1).find((x) => x.k === 'attack' || (x.k === 'hit' && x.src === 'counter'));
      assert.ok(!next || next.k === 'attack', 'no counter of a counter');
    });
  }
  assert.ok(seen > 50);
});

test('shell absorbs before hp', () => {
  const out = F({ kit: kit({ shell: 1 }) });
  assert.deepEqual(out.events.find((e) => e.k === 'shield'), { k: 'shield', n: 15 });
  const first = out.events.findIndex((e) => e.k === 'attack' && e.side === 1);
  assert.deepEqual(out.events[first + 1], { k: 'shield', n: 10 }, 'the first foe hit only dents the shield');
  assert.deepEqual(hits(out, 0).map((h) => h.dmg), [5], 'three of the four foe hits only dent the shield');
});

test('dodge: dust cloud and swift foes dodge whole attacks', () => {
  const d = many({ stats: S(10, 100000, 0, 0.22), foe: 'vole', chapter: 2, day: 10 }, 50).flatMap((o) => o.events.filter((e) => e.k === 'dodge' && e.side === 0)).length;
  assert.ok(d > 20); assert.equal(many({ stats: TANK, foe: 'vole', chapter: 2, day: 10 }, 50).flatMap((o) => o.events.filter((e) => e.k === 'dodge')).length, 0);
  assert.ok(many({ foe: 'magpie' }, 50).some((o) => o.events.some((e) => e.k === 'dodge' && e.side === 1)), 'swift');
});

test('static fluff zaps a quarter of the time, by level', () => {
  const outs = many({ stats: TANK, kit: kit({ static: 3 }), foe: 'vole', chapter: 3, day: 20 }, 50);
  const zaps = outs.flatMap((o) => hits(o, 1, 'zap')), atks = outs.flatMap((o) => hits(o, 1, 'attack'));
  assert.ok(zaps.every((z) => z.dmg === 12) && zaps.length > atks.length * 0.15 && zaps.length < atks.length * 0.35, `${zaps.length}/${atks.length}`);
  assert.ok(many({ stats: TANK, kit: kit({ static: 1 }), foe: 'vole', chapter: 3 }, 20).flatMap((o) => hits(o, 1, 'zap')).every((z) => z.dmg === 5));
});

test('snack break and power nap heal, never above max', () => {
  const s = F({ hp: 50, kit: kit({ snack: 3 }) });
  assert.deepEqual(s.events[s.events.findIndex((e) => e.k === 'hit' && e.side === 1) + 1], { k: 'heal', side: 0, n: 2, hp: 52 });
  const n = F({ hp: 50, kit: kit({ nap: 1 }) });
  assert.ok(n.events.some((e) => e.k === 'heal' && e.side === 0 && e.n === 2));
  for (const out of many({ kit: kit({ nap: 3, snack: 3 }) }, 30)) for (const e of out.events) if (e.k === 'heal' && e.side === 0) assert.ok(e.hp <= 100 && e.n > 0);
});

test('grit adds attack below half hp', () => {
  assert.equal(hits(F({ hp: 40, kit: kit({ grit: 3 }) }), 1)[0].dmg, 18);
  assert.equal(hits(F({ hp: 60, kit: kit({ grit: 3 }) }), 1)[0].dmg, 10);
});

test('prickles reflects at least 1 and never twice', () => {
  assert.ok(hits(F({ kit: kit({ prickle: 1 }) }), 1, 'reflect').every((h) => h.dmg === 1));
  assert.ok(hits(F({ stats: S(1, 100), kit: kit({ prickle: 3 }) }), 1, 'reflect').every((h) => h.dmg === 2));
  for (const out of many({ stats: S(1, 1000), kit: kit({ prickle: 3 }) }, 20)) out.events.forEach((e, i) => { if (e.src === 'reflect') assert.notEqual(out.events[i + 1]?.src, 'reflect'); });
});

test('dust roll hits at the start, by level', () => {
  assert.deepEqual(hits(F({ kit: kit({ roll: 1 }) }), 1)[0], { k: 'hit', side: 1, dmg: 15, hp: 31, crit: false, src: 'roll' });
  assert.equal(hits(F({ kit: kit({ roll: 3 }) }), 1)[0].dmg, 35);
});

test('pepper stacks to 5', () => {
  for (const [lv, cap] of [[1, 5], [3, 10]]) {
    const burns = hits(F({ stats: TANK, kit: kit({ pepper: lv }), foe: 'vole', chapter: 5, day: 30 }), 1, 'burn').map((h) => h.dmg);
    assert.equal(Math.max(...burns), cap, `level ${lv}`); assert.ok(burns.every((d, i) => i === 0 || d >= burns[i - 1]));
  }
});

test('frost skips the foe\'s next turn', () => {
  let frozen = 0;
  for (const out of many({ stats: TANK, kit: kit({ frost: 3 }), foe: 'vole', chapter: 3, day: 20 }, 50)) {
    const rs = rounds(out);
    rs.forEach((r, i) => { if (r.some((e) => e.k === 'freeze' && e.side === 1) && rs[i + 1]?.length) { frozen++; const foeAttacks = r.slice(r.findIndex((e) => e.k === 'freeze')).filter((e) => e.k === 'attack' && e.side === 1); assert.equal(foeAttacks.length, 0); } });
  }
  assert.ok(frozen > 10);
});

test('second wind fires once', () => {
  const out = F({ stats: S(1, 100), hp: 3, kit: kit({ wind: 1 }), wind: true, foe: 'kingmole' });
  const w = out.events.filter((e) => e.k === 'wind');
  assert.deepEqual(w, [{ k: 'wind', hp: 30 }]); assert.equal(out.windUsed, true); assert.equal(out.result, 'loss');
  assert.equal(F({ stats: S(1, 100), hp: 3, kit: kit({ wind: 1 }), wind: false, foe: 'kingmole' }).events.filter((e) => e.k === 'wind').length, 0, 'already used');
});

test('evolution: thunder combo chains twice and every extra attack zaps', () => {
  let three = 0;
  for (const out of many({ stats: TANK, kit: kit({}, ['storm']), foe: 'vole', chapter: 3, day: 20 }, 60)) {
    rounds(out).slice(0, -1).forEach((r) => { // the last round may end on a combo knock-out, before its zap
      const n = r.filter((e) => e.k === 'attack' && e.side === 0).length; assert.ok(n <= 3); if (n === 3) three++;
      const combos = r.filter((e) => e.k === 'hit' && e.src === 'combo').length, zaps = r.filter((e) => e.k === 'hit' && e.src === 'zap').length;
      assert.ok(zaps >= combos, 'each combo hit zaps');
    });
  }
  assert.ok(three > 0);
});

test('evolution: fluffy fury crits for ×3, and more below half', () => {
  const crits = many({ stats: S(10, 100, 0.9), kit: kit({}, ['fury']) }, 20).flatMap((o) => hits(o, 1).filter((h) => h.crit && h.src === 'attack'));
  assert.ok(crits.length > 0 && crits.every((h) => h.dmg === 30 || h.dmg === 54), 'crits ×3 (grit at level 3 below half)');
});

test('evolution: bramble shell refills and reflects 60%', () => {
  const out = F({ stats: S(1, 100), kit: kit({}, ['bramble']) });
  assert.ok(hits(out, 1, 'reflect').every((h) => h.dmg === 3));
  const sh = out.events.filter((e) => e.k === 'shield').map((e) => e.n);
  assert.equal(sh[0], 40); assert.ok(sh.every((n) => n <= 40)); assert.ok(sh.some((n, i) => i > 0 && n > sh[i - 1]), 'it refills');
});

test('evolution: midnight feast heals 25% of damage dealt and 12% a round', () => {
  const out = F({ hp: 50, kit: kit({}, ['feast']) });
  assert.deepEqual(out.events[out.events.findIndex((e) => e.k === 'hit' && e.side === 1) + 1], { k: 'heal', side: 0, n: 3, hp: 53 });
  assert.ok(out.events.some((e) => e.k === 'heal' && e.n === 12));
});

test('traits: sting, shell, chill, double, regen, rage, swift', () => {
  const sting = F({ stats: TANK, foe: 'wasp' });
  const firstLanded = sting.events.findIndex((e) => e.k === 'hit' && e.side === 0);
  assert.ok(firstLanded >= 0 && hits(sting, 0, 'burn').length > 0 && hits(sting, 0, 'burn').every((h) => h.dmg === 1));
  assert.equal(hits(F({ foe: 'hedgepig' }), 1)[0].dmg, 5, 'shell halves the first hit');
  assert.equal(hits(F({ foe: 'hedgepig' }), 1)[1].dmg, 10);
  const chill = F({ stats: S(1, 100000), foe: 'imp', chapter: 4 }), fr = rounds(chill);
  assert.ok(fr[4].some((e) => e.k === 'freeze' && e.side === 0) && !fr[3].some((e) => e.k === 'freeze'), 'chill on the 4th foe turn');
  assert.equal(fr[5].filter((e) => e.k === 'attack' && e.side === 0).length, 0, 'a frozen hero skips a turn');
  const dbl = rounds(F({ stats: S(1, 100000), foe: 'mice' }));
  assert.equal(dbl[3].filter((e) => e.k === 'attack' && e.side === 1).length, 2); assert.equal(dbl[2].filter((e) => e.k === 'attack' && e.side === 1).length, 1);
  assert.ok(F({ stats: S(3, 100000), foe: 'toad' }).events.some((e) => e.k === 'heal' && e.side === 1 && e.n === 2), 'regen');
  const rage = F({ stats: S(10, 100000), foe: 'kingmole' }), foeHits = hits(rage, 0).map((h) => h.dmg);
  assert.equal(foeHits[0], 11); assert.equal(foeHits.at(-1), 17);
});

test('knock-outs are checked after every hit', () => {
  let counterKo = 0, burnKo = 0;
  for (const out of many({ stats: S(3, 1000), kit: kit({ counter: 3, pepper: 3 }), foe: 'beetle' }, 300)) {
    const last = out.events.at(-2);
    assert.equal(out.events.at(-1).k, 'end');
    if (last.k === 'hit' && last.src === 'counter') { counterKo++; assert.equal(out.result, 'win'); assert.equal(last.hp, 0); }
    if (last.k === 'hit' && last.src === 'burn' && last.side === 1) { burnKo++; assert.equal(out.result, 'win'); }
  }
  assert.ok(counterKo > 0 && burnKo > 0, `${counterKo} counter and ${burnKo} burn knock-outs`);
  for (const out of many({ stats: S(40, 1), hp: 1, kit: kit({ static: 1 }) }, 100)) {
    const zapped = rounds(out)[0].some((e) => e.k === 'hit' && e.src === 'zap');
    if (zapped) assert.equal(out.result, 'win', 'a zap knock-out wins before the foe swings');
  }
});

test('40 rounds is a stall', () => {
  const out = F({ stats: S(1, 100), kit: kit({}, ['feast']), foe: 'hornedowl' });
  assert.equal(out.result, 'stall'); assert.equal(out.rounds, 40);
});

test('same input, same events; the input is untouched', () => {
  const input = { stats: S(), hp: 80, kit: kit({ combo: 2, static: 1 }), foe: 'wasp', chapter: 1, day: 5, seed: 99, wind: false };
  const copy = JSON.parse(JSON.stringify(input));
  assert.deepEqual(G.fight(input), G.fight(input)); assert.deepEqual(input, copy);
});

test('1000 random fights end and the events agree with the result', () => {
  const r = new G.Rand(5);
  for (let i = 0; i < 1000; i++) {
    const skills = {}; for (const id of G.SKILL_IDS) if (r.next() < 0.3) skills[id] = 1 + r.int(3);
    const evos = G.EVO_IDS.filter(() => r.next() < 0.1);
    const ch = 1 + r.int(5), foe = r.pick(G.FOE_IDS), stats = S(5 + r.int(40), 50 + r.int(400), r.next() * 0.5, r.next() * 0.3);
    const out = G.fight({ stats, hp: stats.hp, kit: kit(skills, evos), foe, chapter: ch, day: r.int(31), seed: i, wind: r.next() < 0.5 });
    assert.equal(out.events.at(-1).k, 'end'); assert.equal(out.events.at(-1).result, out.result);
    assert.ok(out.rounds <= 40);
    const last = out.events.at(-2);
    if (out.result === 'win') assert.ok(last.k === 'hit' && last.side === 1 && last.hp === 0);
    if (out.result === 'loss') { assert.ok(last.k === 'hit' && last.side === 0 && last.hp === 0); assert.equal(out.hp, 0); }
    const mine = out.events.filter((e) => (e.k === 'hit' || e.k === 'heal') && e.side === 0 || e.k === 'wind');
    assert.equal(out.hp, mine.length ? mine.at(-1).hp : stats.hp);
    for (const e of out.events) if (e.k === 'hit') assert.ok(e.dmg >= 1 && e.hp >= 0);
  }
});


// ---- the trek ----

const STRONG = { hp: 5000, atk: 500, crit: 0, dodge: 0 }, WEAK = { hp: 1, atk: 1, crit: 0, dodge: 0 };
const trek = (seed = 1, hero = 'dora', chapter = 1, base = G.BASE) => new G.Trek(seed, hero, chapter, base);
/** Answers every pending choice the same plain way: first card, first choice, spin, leave the Pedlar. */
const plain = (t) => {
  if (t.phase === 'pick') return t.pickSkill(0);
  const k = t.today.k;
  return t.choose(k === 'pedlar' ? -1 : 0);
};
function walk(t, policy = plain, cap = 500) {
  for (let i = 0; i < cap && t.phase !== 'over' && t.phase !== 'cleared'; i++) assert.ok(t.phase === 'walk' ? t.next() : policy(t), `stuck in ${t.phase} on day ${t.day}`);
  return t;
}
const save = (t) => JSON.stringify(t);

test('a new trek', () => {
  const d = trek(1, 'dora'), e = trek(1, 'enzo');
  assert.deepEqual([d.day, d.level, d.xp, d.acorns, d.phase], [0, 1, 0, 0, 'walk']);
  assert.equal(d.hp, d.stats().hp); assert.equal(d.hp, 110);
  assert.deepEqual(d.kit.skills, { shell: 1 }); assert.deepEqual(e.kit.skills, { combo: 1 });
});

test('day 1 is a fight, and the fixed days fall on 10, 15, 20, 25 and 30', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const t = trek(seed, 'enzo', 1, STRONG), days = {};
    while (t.phase !== 'over' && t.phase !== 'cleared') {
      if (t.phase === 'walk') { const e = t.next(); days[t.day] = e.k === 'fight' ? `fight:${e.rank}` : e.k; } else plain(t);
    }
    assert.equal(t.phase, 'cleared'); assert.equal(t.day, 30);
    assert.equal(days[1], 'fight:foe'); assert.equal(days[10], 'fight:elite'); assert.equal(days[15], 'crossroads');
    assert.equal(days[20], 'fight:elite'); assert.equal(days[25], 'pedlar'); assert.equal(days[30], 'fight:boss');
  }
});

test('no event repeats on consecutive days', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const t = trek(seed, 'enzo', 2, STRONG), seq = [];
    while (t.phase !== 'over' && t.phase !== 'cleared') { if (t.phase === 'walk') { const e = t.next(); if (!G.FIXED_DAYS[t.day] && !(e.k === 'story' && G.SCENES.find((x) => x.id === e.scene).followUp)) seq.push([t.day, e.k]); /* a due follow-up always comes first */ } else plain(t); }
    for (let i = 1; i < seq.length; i++) if (seq[i][0] === seq[i - 1][0] + 1) assert.notEqual(seq[i][1], seq[i - 1][1], `seed ${seed} day ${seq[i][0]}`);
  }
});

test('fights apply hp, experience and acorns once', () => {
  const t = trek(3, 'enzo'), e = t.next();
  assert.equal(e.k, 'fight'); assert.equal(t.last.out.result, 'win');
  const ups = t.level - 1; assert.equal(t.hp, Math.min(t.stats().hp, t.last.out.hp + ups * Math.round(t.stats().hp * 0.2)));
  assert.equal(t.xp + (ups ? G.xpNeed(1) : 0), G.FIGHT_XP.foe); assert.equal(t.acorns, G.FIGHT_ACORNS.foe);
  assert.ok(t.seen.foes.includes(e.foe));
  const again = G.Trek.load(save(t));
  assert.deepEqual([again.hp, again.xp, again.acorns], [t.hp, t.xp, t.acorns], 'loading does not apply it again');
});

test('stacked level-ups and an empty pool', () => {
  const t = trek(3, 'enzo'); t.xp = G.xpNeed(1) + G.xpNeed(2) - 2;
  t.next();
  const max = t.stats().hp, healed = Math.min(max, Math.min(max, t.last.out.hp + Math.round(max * 0.2)) + Math.round(max * 0.2));
  assert.equal(t.level, 3); assert.equal(t.picks, 2); assert.equal(t.phase, 'pick'); assert.equal(t.hp, healed);
  assert.equal(t.offer.length, 3); assert.equal(new Set(t.offer.map((c) => c.id)).size, 3);
  assert.ok(t.pickSkill(0)); assert.equal(t.phase, 'pick'); assert.equal(t.offer.length, 3);
  assert.ok(t.pickSkill(1)); assert.equal(t.phase, 'walk'); assert.equal(t.offer, null);
  const u = trek(4, 'enzo'); u.kit.evos = [...G.EVO_IDS]; u.kit.skills = {};
  for (const id of G.SKILL_IDS) if (G.skillLevel(u.kit, id) < 3) u.kit.skills[id] = 3;
  assert.deepEqual(u.deal(), [{ k: 'rest' }]);
  u.kit.skills.lucky = 2; assert.deepEqual(u.deal(), [{ k: 'skill', id: 'lucky', level: 3 }], 'fewer cards when fewer can be drawn');
  u.picks = 1; u.offer = [{ k: 'rest' }]; u.phase = 'pick'; u.hp = 10;
  assert.ok(u.pickSkill(0)); assert.equal(u.hp, 10 + Math.round(u.stats().hp * 0.3));
});

test('evolutions are offered only when both halves are at level 3, and replace them', () => {
  const t = trek(5, 'enzo'); t.kit.skills = { combo: 3, static: 2 };
  for (let i = 0; i < 40; i++) assert.ok(!t.deal().some((c) => c.k === 'evo'));
  t.kit.skills.static = 3;
  let found = null; for (let i = 0; i < 40 && !found; i++) found = t.deal().find((c) => c.k === 'evo');
  assert.deepEqual(found, { k: 'evo', id: 'storm' });
  t.offer = [found]; t.picks = 1; t.phase = 'pick';
  assert.ok(t.pickSkill(0));
  assert.deepEqual(t.kit.skills, {}); assert.deepEqual(t.kit.evos, ['storm']); assert.equal(G.skillLevel(t.kit, 'combo'), 3);
  assert.ok(t.seen.skills.includes('storm'));
});

test('one reroll per trek', () => {
  const t = trek(6, 'enzo'); t.xp = G.xpNeed(1) * 3; t.next();
  assert.equal(t.phase, 'pick');
  assert.ok(t.reroll()); assert.equal(t.rerolled, true);
  const before = save(t); assert.equal(t.reroll(), false); assert.equal(save(t), before);
});

const toDay = (t, day) => { t.day = day - 1; return t.next(); };

test('crossroads: the owl heals or levels a skill', () => {
  const t = trek(7, 'enzo'); assert.equal(toDay(t, 15).k, 'crossroads'); assert.equal(t.phase, 'event');
  t.hp = 10; assert.ok(t.choose(0)); assert.equal(t.hp, t.stats().hp); assert.equal(t.phase, 'walk');
  const u = trek(7, 'enzo'); toDay(u, 15); assert.ok(u.choose(1)); assert.deepEqual(u.kit.skills, { combo: 2 });
});

test('crossroads: the fox gives two level-2 skills for 20% max hp', () => {
  const t = trek(8, 'enzo'); toDay(t, 15);
  const max = t.stats().hp; assert.ok(t.choose(2));
  const added = Object.entries(t.kit.skills).filter(([id]) => id !== 'combo');
  assert.equal(added.length, 2); assert.ok(added.every(([, lv]) => lv === 2));
  assert.ok(near(t.kit.bonus.hp, -0.2)); assert.ok(t.stats().hp < max || added.some(([id]) => id === 'fluff'));
  assert.ok(t.hp <= t.stats().hp);
});

test('the fox cannot knock you out', () => {
  for (const hp of [1, 5, 100]) { const t = trek(9, 'enzo'); toDay(t, 15); t.hp = hp; t.choose(2); assert.ok(t.hp >= 1 && t.hp <= t.stats().hp, `${hp} → ${t.hp}`); }
});

test('an elite win brings a visit after the picks', () => {
  const t = trek(10, 'enzo', 1, STRONG); t.xp = G.xpNeed(1) - 1;
  const e = toDay(t, 10); assert.equal(e.rank, 'elite'); assert.equal(t.last.out.result, 'win');
  assert.equal(t.phase, 'pick'); assert.ok(t.after?.k === 'visit');
  while (t.phase === 'pick') t.pickSkill(0);
  assert.equal(t.phase, 'event'); assert.equal(t.today.k, 'visit'); assert.equal(t.after, null);
  const who = t.today.who, max = t.stats().hp; t.hp = 10; assert.ok(t.choose(0));
  if (who === 'owl') assert.equal(t.hp, Math.min(max, 10 + Math.round(max * 0.5)));
  else assert.ok(near(t.kit.bonus.hp, -0.1));
  assert.equal(t.phase, 'walk');
});

test('story: odds, effects, follow-ups', () => {
  const t = trek(11, 'dora'); t.later.push({ day: 3, scene: 'bird' }); t.day = 2;
  assert.deepEqual(t.next(), { k: 'story', scene: 'bird' }); assert.equal(t.phase, 'event');
  assert.ok(t.choose(0)); assert.deepEqual(t.later, [{ day: 6, scene: 'birdback' }]); assert.ok(t.note.length > 0);
  t.day = 5; assert.deepEqual(t.next(), { k: 'story', scene: 'birdback' });
  const a = t.acorns; assert.ok(t.choose(0)); assert.equal(t.acorns, a + 15);
  const u = trek(12, 'dora'); u.later.push({ day: 7, scene: 'bird' }); u.day = 6; u.next(); u.choose(0);
  assert.deepEqual(u.later, [{ day: 11, scene: 'birdback' }], 'a follow-up due on a fixed day comes the day after');
  let up = 0, down = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const m = trek(seed, 'enzo'); m.later.push({ day: 2, scene: 'mushroom' }); m.day = 1; m.next();
    const hp = m.hp; m.choose(0);
    if (near(m.kit.bonus.atk, 0.1)) up++; else { down++; assert.equal(m.hp, Math.max(1, hp - Math.round(m.stats().hp * 0.1))); }
  }
  assert.ok(up > 10 && down > 10, `${up} / ${down}`);
  const p = trek(13, 'enzo'); p.later.push({ day: 2, scene: 'picnic' }); p.day = 1; p.next(); p.choose(1);
  assert.ok(p.note.includes('Dora') && !p.note.includes('{other}'));
  const c = trek(14, 'enzo'); c.later.push({ day: 2, scene: 'oldstump' }); c.day = 1; c.next(); c.choose(0);
  assert.equal(c.phase, 'pick', 'a cache opens a pick');
});

test('wheel segments, and lucky paw turns the hp segment into acorns', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    for (const lucky of [false, true]) {
      const t = trek(seed, 'enzo', 2); if (lucky) t.kit.skills.lucky = 1;
      t.today = { k: 'wheel' }; t.phase = 'event'; t.hp = 50;
      const a = t.acorns, hp = t.hp; assert.ok(t.choose(0));
      const prize = t.today.prize; seen.add(prize);
      const gain = (n) => Math.round(n * 2 * (lucky ? 1.2 : 1));
      if (prize <= 2) assert.equal(t.acorns, a + gain(3));
      if (prize === 3) assert.equal(t.acorns, a + gain(12));
      if (prize === 4) assert.equal(t.hp, hp + Math.round(t.stats().hp * 0.25));
      if (prize === 5) assert.equal(t.phase, 'pick');
      if (prize === 6) assert.ok(near(t.kit.bonus.atk, 0.05));
      if (prize === 7) { if (lucky) { assert.equal(t.acorns, a + gain(12)); assert.equal(t.hp, hp); } else assert.equal(t.hp, hp - Math.round(t.stats().hp * 0.1)); }
    }
  }
  assert.equal(seen.size, 8);
  const w = trek(1); w.today = { k: 'wheel' }; w.phase = 'event'; assert.ok(w.choose(-1)); assert.equal(w.phase, 'walk');
});

test('pedlar: buying, prices by chapter, one of each', () => {
  const t = trek(15, 'enzo', 2); const e = toDay(t, 25);
  assert.equal(e.k, 'pedlar'); assert.deepEqual(e.stock.map((w) => w.k), ['snack', 'card', 'charm']);
  assert.deepEqual(G.price(e.stock[0], 2), 30); assert.deepEqual(G.price(e.stock[2], 2), 60);
  const before = save(t); assert.equal(t.buy(0), false); assert.equal(save(t), before);
  t.acorns = 200; t.hp = 10;
  assert.ok(t.buy(0)); assert.equal(t.acorns, 170); assert.equal(t.hp, 10 + Math.round(t.stats().hp * 0.4));
  assert.equal(t.buy(0), false, 'sold out');
  assert.ok(t.buy(1)); assert.equal(t.phase, 'pick'); t.pickSkill(0); assert.equal(t.phase, 'event'); assert.equal(t.today.k, 'pedlar', 'back to the stall');
  const stat = e.stock[2].stat, b = { ...t.kit.bonus };
  assert.ok(t.buy(2)); assert.ok(near(t.kit.bonus[stat] - b[stat], { atk: 0.08, hp: 0.1, crit: 0.05 }[stat]));
  assert.equal(t.acorns, 200 - 30 - 50 - 60); assert.ok(t.choose(-1)); assert.equal(t.phase, 'walk');
});

test('a lost fight ends the trek; the boss clears it', () => {
  const t = trek(16, 'dora', 1, WEAK); t.next(); assert.equal(t.phase, 'over'); assert.equal(t.hp, 0);
  const u = trek(17, 'dora', 1, STRONG); u.xp = 50; const e = toDay(u, 30);
  assert.equal(e.rank, 'boss'); assert.equal(u.phase, 'cleared'); assert.equal(u.picks, 0); assert.equal(u.offer, null);
});

test('a stalled boss fight ends the trek', () => {
  const t = trek(20, 'dora', 5, { ...G.BASE, hp: 5000, atk: 1 }); t.kit.evos = ['feast'];
  const e = toDay(t, 30); assert.equal(e.rank, 'boss'); assert.equal(t.last.out.result, 'stall');
  assert.equal(t.phase, 'over'); assert.ok(t.hp > 0); assert.equal(t.next(), null);
});

test('illegal actions change nothing', () => {
  const t = trek(18, 'enzo');
  const same = (fn, why) => { const b = save(t); const r = fn(); assert.ok(r === false || r === null, why); assert.equal(save(t), b, why); };
  same(() => t.pickSkill(0), 'pick while walking'); same(() => t.reroll(), 'reroll while walking'); same(() => t.choose(0), 'choose while walking'); same(() => t.buy(0), 'buy while walking');
  toDay(t, 15);
  same(() => t.choose(7), 'choose(7)'); same(() => t.next(), 'next during an event'); same(() => t.pickSkill(0), 'pick during an event');
  t.choose(-1); t.xp = 99; t.next();
  if (t.phase === 'pick') { same(() => t.next(), 'next during a pick'); same(() => t.pickSkill(5), 'a card that is not there'); t.reroll(); same(() => t.reroll(), 'a second reroll'); }
  const o = trek(19, 'dora', 1, WEAK); o.next(); assert.equal(o.phase, 'over');
  const b = save(o); assert.equal(o.next(), null); assert.equal(o.choose(0), false); assert.equal(o.pickSkill(0), false); assert.equal(save(o), b);
});

test('same seed and choices, same trek', () => {
  assert.equal(save(walk(trek(21, 'enzo', 2))), save(walk(trek(21, 'enzo', 2))));
  assert.notEqual(save(walk(trek(21, 'enzo', 2))), save(walk(trek(22, 'enzo', 2))));
});

test('save round-trips', () => {
  const at = (stop) => { const t = trek(23, 'enzo', 1, { ...G.BASE, hp: 400, atk: 30 }); for (let i = 0; i < 200 && !stop(t) && t.phase !== 'over' && t.phase !== 'cleared'; i++) { if (t.phase === 'walk') t.next(); else plain(t); } return t; };
  for (const stop of [(t) => t.day === 0, (t) => t.phase === 'pick', (t) => t.phase === 'event']) {
    const t = at(stop), copy = G.Trek.load(save(t));
    assert.ok(copy, 'loads'); assert.equal(save(copy), save(t));
    assert.equal(save(walk(copy)), save(walk(t)));
  }
});

test('malformed saves load as null', () => {
  const good = JSON.parse(save(trek(24)));
  assert.ok(G.Trek.load(JSON.stringify(good)));
  const bad = [null, 'x', '{"v":2}', { ...good, kit: { ...good.kit, skills: { nope: 1 } } }, { ...good, day: 31 }, { ...good, hp: 9999 }, { ...good, picks: -1 }, { ...good, phase: 'pick', offer: null }, { ...good, hero: 'pip' }, { ...good, chapter: 6 }, { ...good, phase: 'event', today: null }];
  for (const b of bad) assert.equal(G.Trek.load(typeof b === 'string' || b === null ? b : JSON.stringify(b)), null, JSON.stringify(b)?.slice(0, 60));
});


// ---- camp, the profile and the policy ----

const ended = (seed, chapter, base, hero = 'enzo') => G.playTrek(new G.Trek(seed, hero, chapter, base));
const rarities = (pieces) => pieces.map((x) => x.r);

test('camp: a fresh profile', () => {
  const p = G.freshProfile();
  assert.deepEqual([p.v, p.acorns, p.unlocked, p.gear.length, Object.keys(p.worn).length], [1, 0, 1, 0, 0]);
  assert.deepEqual(G.campStats(p), G.BASE);
});

test('camp: training costs rise and need acorns', () => {
  let p = { ...G.freshProfile(), acorns: 55 };
  assert.equal(G.train({ ...p, acorns: 19 }, 'atk'), null);
  p = G.train(p, 'atk'); assert.equal(p.acorns, 35); assert.equal(p.training.atk, 1); assert.equal(G.campStats(p).atk, 11);
  p = G.train(p, 'atk'); assert.equal(p.acorns, 5); assert.equal(G.train(p, 'hp'), null);
  p = G.train({ ...p, acorns: 20 }, 'hp'); assert.equal(G.campStats(p).hp, 110);
});

test('camp: three pieces merge into one of the next rarity, and it is worn if better', () => {
  const p = { ...G.freshProfile(), gear: [{ uid: 1, slot: 'hat', r: 0 }, { uid: 2, slot: 'hat', r: 0 }, { uid: 3, slot: 'hat', r: 0 }, { uid: 4, slot: 'scarf', r: 0 }], worn: { hat: 1 }, next: 5 };
  const before = JSON.stringify(p), m = G.merge(p, 'hat', 0);
  assert.equal(JSON.stringify(p), before, 'pure');
  assert.deepEqual(m.gear, [{ uid: 4, slot: 'scarf', r: 0 }, { uid: 5, slot: 'hat', r: 1 }]);
  assert.equal(m.worn.hat, 5); assert.equal(m.next, 6); assert.equal(G.campStats(m).hp, 120);
  assert.equal(G.wear(m, 4).worn.scarf, 4); assert.equal(G.wear(m, 99), null);
});

test('camp: legend pieces don\'t merge, two pieces don\'t merge', () => {
  const legends = { ...G.freshProfile(), gear: [1, 2, 3].map((uid) => ({ uid, slot: 'boots', r: 4 })), next: 4 };
  assert.equal(G.merge(legends, 'boots', 4), null);
  const two = { ...G.freshProfile(), gear: [1, 2].map((uid) => ({ uid, slot: 'boots', r: 0 })), next: 3 };
  assert.equal(G.merge(two, 'boots', 0), null);
});

test('record: acorns kept after a loss, pedlar spending excluded', () => {
  const t = new G.Trek(31, 'dora', 1, WEAK); t.next(); assert.equal(t.phase, 'over');
  t.acorns = 7;
  const { profile, chest } = G.record(G.freshProfile(), t);
  assert.equal(chest.acorns, 2 * 1 * t.day); assert.equal(profile.acorns, 7 + chest.acorns);
  assert.equal(chest.pieces.length, 1); assert.equal(profile.gear.length, 1); assert.equal(profile.worn[chest.pieces[0].slot], chest.pieces[0].uid);
  assert.equal(profile.best[0], 1); assert.equal(profile.unlocked, 1); assert.equal(profile.last, 31);
  assert.ok(profile.seen.skills.includes('shell'));
  const live = new G.Trek(32, 'dora', 1, G.BASE);
  assert.deepEqual(G.record(G.freshProfile(), live), { profile: G.freshProfile(), chest: null }, 'nothing while the trek is on');
});

test('record: a clear unlocks the next chapter, gives two pieces, and the first clear gives a rare', () => {
  for (let seed = 40; seed < 60; seed++) {
    const t = ended(seed, 1, STRONG); assert.equal(t.phase, 'cleared');
    const { profile, chest } = G.record(G.freshProfile(), t);
    assert.equal(chest.pieces.length, 2); assert.equal(profile.unlocked, 2); assert.equal(profile.best[0], 31);
    assert.ok(chest.pieces.some((x) => x.r >= 2), `seed ${seed}: ${rarities(chest.pieces)}`);
  }
  const again = G.record({ ...G.freshProfile(), unlocked: 2, best: [31, 0, 0, 0, 0] }, ended(41, 1, STRONG));
  assert.equal(again.profile.unlocked, 2);
});

test('record: counts a trek once', () => {
  const t = ended(61, 1, STRONG), once = G.record(G.freshProfile(), t).profile;
  const twice = G.record(once, t);
  assert.equal(twice.chest, null); assert.deepEqual(twice.profile, once);
});

test('chest odds improve by chapter and day', () => {
  const mean = (chapter, day) => { let sum = 0, legend = 0; for (let i = 0; i < 2000; i++) { for (const r of G.chestRarities(chapter, day, new G.Rand(i + 1), 1)) { sum += r; if (r === 4) legend++; } } return { m: sum / 2000, legend }; };
  const lo = mean(1, 5), hi = mean(3, 30), top = mean(5, 30);
  assert.ok(hi.m > lo.m + 0.3, `${lo.m} → ${hi.m}`);
  assert.equal(lo.legend + hi.legend, 0, 'no legend before chapter 4');
  assert.ok(top.legend > 0);
});

test('profile: the ui settings default and round-trip', () => {
  assert.deepEqual(G.freshProfile().ui, { fast: false, auto: true });
  const p = { ...G.freshProfile(), ui: { fast: true, auto: false } };
  assert.deepEqual(G.loadProfile(JSON.stringify(p)).ui, { fast: true, auto: false });
  const { ui: _ui, ...old } = p; assert.deepEqual(G.loadProfile(JSON.stringify(old)).ui, { fast: false, auto: true }, 'older saves get the defaults');
  assert.deepEqual(G.loadProfile(JSON.stringify({ ...p, ui: { fast: 'yes' } })).ui, { fast: false, auto: true });
});

test('profile: malformed saves load fresh', () => {
  const good = { ...G.freshProfile(), acorns: 10, gear: [{ uid: 1, slot: 'hat', r: 2 }], worn: { hat: 1 }, next: 2 };
  assert.deepEqual(G.loadProfile(JSON.stringify(good)), good);
  for (const b of [null, 'x', '{"v":2}', JSON.stringify({ ...good, acorns: -1 }), JSON.stringify({ ...good, unlocked: 6 })]) assert.deepEqual(G.loadProfile(b), G.freshProfile(), String(b).slice(0, 40));
  const dropped = G.loadProfile(JSON.stringify({ ...good, gear: [...good.gear, { uid: 2, slot: 'hat', r: 7 }, { uid: 3, slot: 'cape', r: 0 }], worn: { hat: 1, boots: 9 }, seen: { skills: ['combo', 'nope'], foes: ['vole', 'dragon'] } }));
  assert.deepEqual(dropped.gear, good.gear); assert.deepEqual(dropped.worn, { hat: 1 }); assert.deepEqual(dropped.seen, { skills: ['combo'], foes: ['vole'] });
});

test('the policy only takes legal actions', () => {
  let cleared = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const t = new G.Trek(seed, seed % 2 ? 'dora' : 'enzo', 1 + (seed % 3), { ...G.BASE, hp: 200, atk: 18 });
    const strict = (x) => { const a = G.decide(x); const ok = a.k === 'next' ? x.next() !== null : a.k === 'choose' ? x.choose(a.i) : a.k === 'pick' ? x.pickSkill(a.i) : a.k === 'reroll' ? x.reroll() : x.buy(a.i); assert.ok(ok, `${JSON.stringify(a)} in ${x.phase} on day ${x.day}`); return { k: 'noop' }; };
    let steps = 0; while (t.phase !== 'over' && t.phase !== 'cleared') { strict(t); assert.ok(++steps < 500, 'step cap'); }
    if (t.phase === 'cleared') cleared++;
  }
  assert.ok(cleared > 0);
  assert.equal(G.playTrek(new G.Trek(5, 'dora', 1, G.BASE)).phase === 'walk', false);
});

test('the policy picks evolutions and keeps a low hero safe', () => {
  const t = new G.Trek(70, 'enzo', 1, G.BASE); t.phase = 'pick'; t.picks = 1;
  t.offer = [{ k: 'skill', id: 'lucky', level: 1 }, { k: 'evo', id: 'storm' }, { k: 'skill', id: 'sharp', level: 1 }];
  assert.deepEqual(G.decide(t), { k: 'pick', i: 1 });
  const c = new G.Trek(71, 'enzo', 1, G.BASE); c.day = 14; c.next(); assert.equal(c.today.k, 'crossroads');
  c.hp = 10; assert.deepEqual(G.decide(c), { k: 'choose', i: 0 });
  c.hp = c.stats().hp; assert.deepEqual(G.decide(c), { k: 'choose', i: 2 });
});

test('campStep never overspends', () => {
  for (const acorns of [0, 19, 20, 100, 1000, 12345]) {
    const p = G.campStep({ ...G.freshProfile(), acorns, gear: [1, 2, 3, 4].map((uid) => ({ uid, slot: 'scarf', r: 0 })), next: 5 });
    assert.ok(p.acorns >= 0 && p.acorns < G.trainCost(Math.min(p.training.atk, p.training.hp)), `${acorns} → ${p.acorns}`);
    assert.ok(p.gear.some((x) => x.r === 1), 'merges what it can');
  }
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Chinchilla Trek engine');
