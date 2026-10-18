// Plays whole Chinchilla Treks through the real engine: 300 fresh chapter-1 treks with the policy and with a random
// player, then 40 campaigns from a fresh profile to a chapter 5 clear, banking each trek and spending at camp.
// It keeps the balance honest: the gates below fail `npm test` when a tuning change breaks the pace.
import assert from 'node:assert/strict';
import { Trek, Rand, decide, record, campStep, campStats, freshProfile, SKILL_IDS, EVO_IDS } from '../.checks/chinchilla-trek-game.js';

const started = Date.now();
const act = (t, a) => a.k === 'next' ? t.next() !== null : a.k === 'choose' ? t.choose(a.i) : a.k === 'pick' ? t.pickSkill(a.i) : a.k === 'reroll' ? t.reroll() : t.buy(a.i);

/** Every action that might be legal now; the trek refuses the ones that aren't. */
function options(t) {
  if (t.phase === 'walk') return [{ k: 'next' }];
  if (t.phase === 'pick') return [...t.offer.map((_, i) => ({ k: 'pick', i })), { k: 'reroll' }];
  return [-1, 0, 1, 2].map((i) => ({ k: 'choose', i })).concat([0, 1, 2].map((i) => ({ k: 'buy', i })));
}
const randomPolicy = (r) => (t) => r.shuffle(options(t)).find((a) => tryOn(t, a));
/** Whether `a` is legal, worked out on a copy so the real trek is untouched. */
const tryOn = (t, a) => act(Trek.load(JSON.stringify(t)), a);

const picked = Object.fromEntries([...SKILL_IDS, ...EVO_IDS].map((id) => [id, 0])), evo = Object.fromEntries(EVO_IDS.map((id) => [id, 0]));
let treks = 0, clears = 0, fights = 0, stalls = 0;

/** Plays `t` to its end, counting picks, fights and stalls. */
function play(t, policy) {
  const mine = new Set();
  for (let i = 0; i < 500 && t.phase !== 'over' && t.phase !== 'cleared'; i++) {
    const a = policy(t);
    if (a.k === 'pick') { const c = t.offer[a.i]; if (c.k !== 'rest') mine.add(c.id); }
    assert.ok(act(t, a), `${JSON.stringify(a)} refused in ${t.phase}`);
    if (a.k === 'next' && t.today?.k === 'fight') { fights++; if (t.last.out.result === 'stall') stalls++; }
  }
  assert.ok(t.phase === 'over' || t.phase === 'cleared', 'the trek ends');
  return mine;
}

// ---- fresh treks ----
let won = 0, randomWon = 0;
const base = campStats(freshProfile());
for (let seed = 1; seed <= 300; seed++) {
  const hero = seed % 2 ? 'dora' : 'enzo';
  const t = new Trek(seed, hero, 1, base), mine = play(t, decide);
  treks++; for (const id of mine) picked[id]++;
  if (t.phase === 'cleared') { won++; clears++; for (const id of t.kit.evos) evo[id]++; }
  const u = new Trek(seed, hero, 1, base), r = new Rand(seed * 7919);
  play(u, randomPolicy(r));
  if (u.phase === 'cleared') randomWon++;
}
const clear = won / 300, randomClear = randomWon / 300;

// ---- campaigns ----
const lengths = [], perChapter = [[], [], [], [], []], levels = [[], [], [], [], []];
for (let c = 0; c < 40; c++) {
  let p = freshProfile(), n = 0, since = 0;
  while (p.best[4] < 31 && n < 200) {
    const ch = p.unlocked, t = new Trek(100000 + c * 1000 + n, n % 2 ? 'dora' : 'enzo', ch, campStats(p));
    const mine = play(t, decide);
    treks++; n++; since++; for (const id of mine) picked[id]++;
    if (t.phase === 'cleared') { clears++; for (const id of t.kit.evos) evo[id]++; perChapter[ch - 1].push(since); levels[ch - 1].push(t.level - 1); since = 0; }
    p = campStep(record(p, t).profile);
  }
  lengths.push(n);
}
lengths.sort((a, b) => a - b);
const median = lengths[20], worst = lengths.at(-1);
const mean = (xs) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : '-';

console.log(`policy clears chapter 1: ${(clear * 100).toFixed(1)}%   random: ${(randomClear * 100).toFixed(1)}%`);
console.log(`campaigns: median ${median} treks, longest ${worst}`);
console.log(`treks per chapter: ${perChapter.map(mean).join(' / ')}   level-ups in clears: ${levels.map(mean).join(' / ')}`);
console.log(`fights ${fights}, stalled ${stalls}`);
console.log('picked in % of treks: ' + [...SKILL_IDS, ...EVO_IDS].map((id) => `${id} ${((picked[id] / treks) * 100).toFixed(0)}`).join(', '));
console.log('evolutions in % of clears: ' + EVO_IDS.map((id) => `${id} ${((evo[id] / clears) * 100).toFixed(0)}`).join(', '));
console.log(`${((Date.now() - started) / 1000).toFixed(1)} s`);

assert.ok(clear >= 0.25 && clear <= 0.55, `policy clears chapter 1 in ${clear}`);
assert.ok(clear - randomClear >= 0.20, `random clears ${randomClear}`);
assert.ok(median >= 15 && median <= 45, `median campaign ${median} treks`);
assert.ok(worst <= 90, `longest campaign ${worst} treks`);
for (const id of SKILL_IDS) assert.ok(picked[id] / treks >= 0.02, `${id} picked in ${picked[id]} treks`);
for (const id of EVO_IDS) assert.ok(evo[id] / clears >= 0.05, `${id} in ${evo[id]} of ${clears} clears`);
assert.ok(stalls / fights < 0.02, `${stalls} of ${fights} fights stalled`);
console.log('PASS Chinchilla Trek bot');
