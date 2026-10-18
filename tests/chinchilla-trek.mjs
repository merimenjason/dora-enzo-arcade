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
    grit: [0.3, 0.5, 0.8], prickle: [0.15, 0.25, 0.4], pounce: [2, 3, 4], roll: [1, 1.5, 2], pepper: [0.1, 0.15, 0.2],
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
  assert.deepEqual(G.foeStats('crab', 3, 10), { hp: 191, atk: 22 });
});

test('a plain fight: hero first, alternating, a win gives the foe 0 hp', () => {
  const out = F();
  assert.equal(out.result, 'win'); assert.equal(out.events.at(-1).k, 'end');
  const firstHit = out.events.find((e) => e.k === 'hit'); assert.equal(firstHit.side, 1); assert.equal(firstHit.dmg, 10);
  assert.equal(hits(out, 1).at(-1).hp, 0); assert.equal(out.hp, 100 - 5 * hits(out, 0).length);
  assert.deepEqual([out.foeHp, out.foeAtk], [46, 5]);
});

test('pounce multiplies the first attack, by level', () => {
  assert.equal(hits(F({ kit: kit({ pounce: 2 }) }), 1)[0].dmg, 30);
  assert.equal(hits(F({ kit: kit({ pounce: 1 }) }), 1)[0].dmg, 20);
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
  assert.deepEqual(hits(F({ kit: kit({ roll: 1 }) }), 1)[0], { k: 'hit', side: 1, dmg: 10, hp: 36, crit: false, src: 'roll' });
  assert.equal(hits(F({ kit: kit({ roll: 3 }) }), 1)[0].dmg, 20);
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

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('PASS Chinchilla Trek engine');
