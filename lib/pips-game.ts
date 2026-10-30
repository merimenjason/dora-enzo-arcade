// Lucky Pips · the rules. A run is one plain JSON object (it is the save), every random thing comes from its own
// mulberry32 state `r`, and every action mutates the run and returns the events the page animates. No DOM, no clock.
import {
  TOOL, TOOLS, needOf, usesOf, slotsOf, LEADS, FOES, AREAS, TIER, CHARMS, TENTS,
  type Need, type Fx, type Intent, type LeadId,
} from './pips-tools.js';

export const SAVE_KEY = 'lucky-pips-v1';
export const ROWS = 7;               // map rows before each area's boss
export const MAX_TOOLS = 6;          // tools on the table (7 with the Tool Belt)
export const MAX_DICE = 12;          // the tray never holds more than this
export const MAX_FOES = 3;
export const MAX_TURNS = 40;         // a battle that runs this long is a stalemate the foes win (never happens in play)

export type NodeKind = 'battle' | 'elite' | 'stall' | 'picnic' | 'tent' | 'boss';
export type MapNode = { id: number; row: number; x: number; kind: NodeKind; next: number[] };
export type Die = { id: number; v: number; curse?: boolean };
export type ToolSlot = { used: number; pend: number[]; count: number; locked: boolean; spent: boolean };
export type Foe = {
  def: string; name: string; hp: number; max: number; block: number; poison: number; burn: number;
  stun: number; str: number; step: number; bag: number[]; intent: Intent; elite: boolean; atk: number;
};
export type Battle = {
  kind: 'battle' | 'elite' | 'boss'; foes: Foe[]; target: number; turn: number; dice: Die[]; slots: ToolSlot[];
  block: number; poison: number; burn: number; frost: number; thorns: number; rerolls: number;
  curseNext: number; lockNext: number; nid: number; done: '' | 'won' | 'lost';
};
export type Offer =
  | { kind: 'reward'; acorns: number; tools: string[]; upgraded: number; taken: boolean; boss: boolean }
  | { kind: 'stall'; tools: { id: string; price: number; sold: boolean }[]; up: number; rm: number; pie: number; usedUp: boolean; usedRm: boolean; usedPie: boolean }
  | { kind: 'picnic'; heal: number }
  | { kind: 'charm'; charms: string[] }
  | { kind: 'pick'; purpose: 'remove' | 'upgrade' };
export type Screen = 'map' | 'battle' | 'reward' | 'stall' | 'picnic' | 'tent' | 'charm' | 'pick' | 'won' | 'lost';
export type Owned = { id: string; up: boolean };
export type Stats = { turns: number; battles: number; elites: number; bosses: number; dmg: number; maxHit: number; healed: number; tools: number };
export type Run = {
  v: 1; seed: number; r: number; lead: LeadId; fog: number; daily: string;
  hp: number; max: number; acorns: number; tools: Owned[]; charms: string[]; pool: string[];
  area: number; map: MapNode[]; at: number; path: number[]; tentsSeen: string[]; tent: string; lastGroup: string;
  screen: Screen; battle: Battle | null; offer: Offer | null; note: string;
  stats: Stats; used: string[];
};
export type Ev =
  | { t: 'hit'; to: 'you' | number; n: number; blocked: number; tick?: 'poison' | 'burn'; thorns?: boolean }
  | { t: 'block'; to: 'you' | number; n: number }
  | { t: 'heal'; to: 'you' | number; n: number }
  | { t: 'status'; to: 'you' | number; s: 'poison' | 'burn' | 'frost' | 'stun' | 'curse' | 'lock' | 'buff' | 'thorns' | 'cleanse' | 'stunned'; n: number }
  | { t: 'dice'; ids: number[] }
  | { t: 'roll'; turn: number }
  | { t: 'fire'; tool: number }
  | { t: 'act'; i: number }
  | { t: 'summon'; i: number }
  | { t: 'down'; i: number }
  | { t: 'acorns'; n: number }
  | { t: 'win' } | { t: 'lose' };

// ---------- randomness ----------
/** mulberry32 on the run's own state, so a saved run carries on with exactly the same luck. */
export function rnd(run: { r: number }): number {
  let t = (run.r = (run.r + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (run: { r: number }, n: number) => Math.floor(rnd(run) * n);
const pick = <T>(run: { r: number }, a: readonly T[]): T => a[ri(run, a.length)];
const d6 = (run: { r: number }) => 1 + ri(run, 6);
/** A date (yyyy-mm-dd) or any string, hashed to a seed. */
export function hashSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- meta progress ----------
export type Meta = {
  runs: number; wins: number; fogWon: number; bestArea: number; meadow: boolean; midway: boolean; won: boolean; foggy: boolean;
  ending: boolean; daily: Record<string, { won: boolean; area: number; turns: number }>;
};
export const freshMeta = (): Meta => ({ runs: 0, wins: 0, fogWon: -1, bestArea: 0, meadow: false, midway: false, won: false, foggy: false, ending: false, daily: {} });
/** The tools a new run can offer, given what has been unlocked. */
export function poolFor(meta: Meta | null): string[] {
  return TOOLS.filter(t => !t.unlock || (meta && meta[t.unlock === 'win' ? 'won' : t.unlock])).map(t => t.id);
}
export const leadOpen = (meta: Meta, lead: LeadId) => lead !== 'both' || meta.won;
export const fogOpen = (meta: Meta) => Math.min(5, meta.fogWon + 1);
/** Fold a finished run into the meta; returns what it unlocked, for the page to celebrate. */
export function recordRun(meta: Meta, run: Run): string[] {
  const won = run.screen === 'won', news: string[] = [];
  meta.runs++;
  const reached = won ? 3 : run.area;
  meta.bestArea = Math.max(meta.bestArea, reached);
  if (run.daily) {
    const old = meta.daily[run.daily];
    if (!old || (won && !old.won) || (won === old.won && reached > old.area)) meta.daily[run.daily] = { won, area: reached, turns: run.stats.turns };
    return news;
  }
  if (reached >= 1 && !meta.meadow) { meta.meadow = true; news.push('New tools at the fair: Big Firework and Caramel Apple.'); }
  if (reached >= 2 && !meta.midway) { meta.midway = true; news.push('New tools at the fair: Cobbler’s Anvil and Paper Kite.'); }
  if (won) {
    meta.wins++;
    if (!meta.won) { meta.won = true; news.push('Side by Side unlocked: Dora and Enzo lead together.', 'New tools at the fair: Little Carousel and Hot Cider.'); }
    if (run.fog > meta.fogWon) {
      meta.fogWon = run.fog;
      if (run.fog < 5) news.push(`Foggier ${run.fog + 1} unlocked.`);
      if (run.fog >= 1 && !meta.foggy) { meta.foggy = true; news.push('New tool at the fair: Ringmaster’s Hat.'); }
    }
  }
  return news;
}

// ---------- a new run ----------
export type RunOpts = { seed: number; lead: LeadId; fog?: number; daily?: string; pool?: string[] };
export function newRun(o: RunOpts): Run {
  const lead = LEADS[o.lead] ? o.lead : 'dora';
  const fog = Math.max(0, Math.min(5, Math.floor(o.fog ?? 0)));
  const max = LEADS[lead].hp - (fog >= 4 ? 4 : 0);
  const run: Run = {
    v: 1, seed: o.seed >>> 0, r: (o.seed >>> 0) ^ 0x5eed, lead, fog, daily: o.daily ?? '',
    hp: max, max, acorns: 20, tools: LEADS[lead].tools.map(id => ({ id, up: false })), charms: [],
    pool: (o.pool ?? poolFor(null)).filter(id => TOOL[id]),
    area: 0, map: [], at: -1, path: [], tentsSeen: [], tent: '', lastGroup: '',
    screen: 'map', battle: null, offer: null, note: '',
    stats: { turns: 0, battles: 0, elites: 0, bosses: 0, dmg: 0, maxHit: 0, healed: 0, tools: 0 }, used: [],
  };
  run.map = makeMap(run, 0);
  return run;
}

/** Seven rows of two or three stops each, then the boss. Paths only ever go to a neighbouring stop. */
export function makeMap(run: Run, area: number): MapNode[] {
  const nodes: MapNode[] = [];
  const rows: MapNode[][] = [];
  for (let row = 0; row < ROWS; row++) {
    const n = row === 0 ? 3 : 2 + ri(run, 2);
    const r: MapNode[] = [];
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1) + (rnd(run) - 0.5) * 0.06;
      let kind: NodeKind;
      if (row === 0) kind = 'battle';
      else if (row === ROWS - 1) kind = 'picnic';
      else if (row === 1) kind = rnd(run) < 0.7 ? 'battle' : 'tent';
      else {
        const p = rnd(run);
        kind = p < 0.42 ? 'battle' : p < 0.58 ? 'elite' : p < 0.73 ? 'tent' : p < 0.87 ? 'stall' : 'picnic';
        if (row === ROWS - 2 && kind === 'picnic') kind = 'stall';
      }
      const nd: MapNode = { id: nodes.length, row, x, kind, next: [] };
      nodes.push(nd); r.push(nd);
    }
    rows.push(r);
  }
  // every map has a stall in the middle rows, and no row is all elites
  if (!nodes.some(n => n.kind === 'stall')) rows[3 + ri(run, 2)][0].kind = 'stall';
  for (const r of rows) if (r.every(n => n.kind === 'elite')) r[r.length - 1].kind = 'battle';
  const boss: MapNode = { id: nodes.length, row: ROWS, x: 0.5, kind: 'boss', next: [] };
  nodes.push(boss);
  for (let row = 0; row < ROWS; row++) {
    const a = rows[row], b = rows[row + 1];
    if (!b) { for (const n of a) n.next = [boss.id]; continue; }
    // link each stop to the nearest one or two ahead, then make sure everything ahead is reachable
    for (const n of a) {
      const near = [...b].sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x));
      n.next = [near[0].id];
      if (near[1] && Math.abs(near[1].x - n.x) < 0.42 && rnd(run) < 0.6) n.next.push(near[1].id);
    }
    for (const m of b) if (!a.some(n => n.next.includes(m.id))) {
      const near = [...a].sort((p, q) => Math.abs(p.x - m.x) - Math.abs(q.x - m.x))[0];
      near.next.push(m.id);
    }
    for (const n of a) n.next.sort((p, q) => nodes[p].x - nodes[q].x);
  }
  void area;
  return nodes;
}
/** The stops the pair can walk to next. */
export function choices(run: Run): number[] {
  if (run.screen !== 'map') return [];
  if (run.at < 0) return run.map.filter(n => n.row === 0).map(n => n.id);
  return run.map[run.at]?.next ?? [];
}

// ---------- foes ----------
function makeFoe(run: Run, def: string, elite: boolean, boss: boolean): Foe {
  const d = FOES[def], tier = TIER[run.area] ?? TIER[2];
  let hp = d.hp * (d.boss ? 1 : tier.hp) * (elite ? 1.5 : 1) * (run.fog >= 1 ? 1.15 : 1) * (boss && run.fog >= 5 ? 1.2 : 1);
  hp = Math.max(1, Math.round(hp));
  const f: Foe = {
    def, name: (elite ? 'Grand ' : '') + d.name, hp, max: hp, block: boss && run.fog >= 5 ? 10 : 0, poison: 0, burn: 0, stun: 0, str: 0,
    step: 0, bag: [], intent: {}, elite, atk: (d.boss || d.minion ? 0 : tier.atk) + (elite ? 2 : 0) + (run.fog >= 2 ? 1 : 0),
  };
  nextIntent(run, f);
  return f;
}
function nextIntent(run: Run, f: Foe) {
  const d = FOES[f.def];
  if (d.order === 'cycle') { f.intent = { ...d.moves[f.step % d.moves.length] }; f.step++; return; }
  if (!f.bag.length) { f.bag = d.moves.map((_, i) => i); for (let i = f.bag.length - 1; i > 0; i--) { const j = ri(run, i + 1); [f.bag[i], f.bag[j]] = [f.bag[j], f.bag[i]]; } }
  f.intent = { ...d.moves[f.bag.shift()!] };
}
/** What one of this foe's hits will do right now (for the intent bubble and the attack itself). */
export const hitOf = (f: Foe) => (f.intent.atk ? Math.max(0, f.intent.atk + f.atk + f.str) : 0);
export const alive = (b: Battle) => b.foes.filter(f => f.hp > 0);

// ---------- battles ----------
const diceCount = (run: Run) => 4 + (run.charms.includes('die') ? 1 : 0);
export function startBattle(run: Run, kind: Battle['kind'], group: string[]): Ev[] {
  const b: Battle = {
    kind, foes: [], target: 0, turn: 0, dice: [], slots: run.tools.map(t => ({ used: 0, pend: [], count: countOf(t), locked: false, spent: false })),
    block: 0, poison: 0, burn: 0, frost: 0, thorns: 0, rerolls: 0, curseNext: 0, lockNext: 0, nid: 1, done: '',
  };
  run.battle = b; run.screen = 'battle'; run.offer = null;
  for (const def of group) b.foes.push(makeFoe(run, def, kind === 'elite', kind === 'boss'));
  const ev = startTurn(run);
  if (run.charms.includes('scarf')) { b.block += 8; ev.push({ t: 'block', to: 'you', n: 8 }); }
  return ev;
}
const countOf = (t: Owned) => { const n = needOf(TOOL[t.id], t.up); return n.k === 'count' ? n.n : 0; };

function startTurn(run: Run): Ev[] {
  const b = run.battle!, ev: Ev[] = [];
  b.turn++; run.stats.turns++;
  b.block = run.lead === 'enzo' ? 2 : 0; b.thorns = 0;
  if (b.block) ev.push({ t: 'block', to: 'you', n: b.block });
  // poison and burn sting at the start of your turn
  if (b.burn > 0) { const n = b.burn; run.hp -= n; ev.push({ t: 'hit', to: 'you', n, blocked: 0, tick: 'burn' }); b.burn = Math.floor(b.burn / 2); }
  if (b.poison > 0) { const n = b.poison; run.hp -= n; ev.push({ t: 'hit', to: 'you', n, blocked: 0, tick: 'poison' }); b.poison--; }
  if (run.hp <= 0) { run.hp = 0; lose(run); ev.push({ t: 'lose' }); return ev; }
  b.dice = [];
  const n = diceCount(run);
  for (let i = 0; i < n; i++) b.dice.push({ id: b.nid++, v: Math.max(1, d6(run) - (b.frost > 0 ? 1 : 0)) });
  if (b.frost > 0) b.frost--;
  for (let i = 0; i < Math.min(b.curseNext, b.dice.length); i++) b.dice[i].curse = true;
  b.curseNext = 0;
  for (const s of b.slots) { s.used = 0; s.pend = []; s.locked = false; }
  for (let i = 0; i < b.lockNext; i++) {
    const open = b.slots.map((s, j) => (s.locked ? -1 : j)).filter(j => j >= 0);
    if (open.length) b.slots[pick(run, open)].locked = true;
  }
  b.lockNext = 0;
  b.rerolls = (run.lead === 'dora' ? 1 : 0) + (run.charms.includes('locket') ? 1 : 0);
  ev.push({ t: 'roll', turn: b.turn });
  if (run.lead === 'dora') { const sixes = b.dice.filter(d => d.v === 6).length; if (sixes) healYou(run, sixes, ev); }
  if (run.lead === 'both') {
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    for (const d of b.dice) cnt[d.v]++;
    const pairs = cnt.reduce((a, c) => a + Math.floor(c / 2), 0);
    if (pairs) { b.block += 2 * pairs; ev.push({ t: 'block', to: 'you', n: 2 * pairs }); }
  }
  return ev;
}

/** Whether a value can go into a need, given the dice already waiting in it. */
export function needFits(n: Need, v: number, pend: number[]): boolean {
  switch (n.k) {
    case 'any': case 'count': return true;
    case 'max': return v <= n.n;
    case 'min': return v >= n.n;
    case 'even': return v % 2 === 0;
    case 'odd': return v % 2 === 1;
    case 'is': return n.n.includes(v);
    case 'pair': case 'triple': return pend.every(p => p === v);
    case 'seven': return pend.length ? pend[0] + v === 7 : true;
    case 'run': { if (pend.includes(v)) return false; const all = [...pend, v]; return Math.max(...all) - Math.min(...all) <= 2; }
  }
}
/** Can this die go in this tool right now? */
export function fits(run: Run, dieId: number, ti: number): boolean {
  const b = run.battle;
  if (!b || b.done || run.screen !== 'battle') return false;
  const d = b.dice.find(x => x.id === dieId), t = run.tools[ti], s = b.slots[ti];
  if (!d || d.curse || !t || !s || s.locked || s.spent) return false;
  const def = TOOL[t.id], uses = usesOf(def, t.up);
  if (uses > 0 && s.used >= uses) return false;
  return needFits(needOf(def, t.up), d.v, s.pend);
}
/** Every die-into-tool move open right now. */
export function moves(run: Run): [number, number][] {
  const b = run.battle, out: [number, number][] = [];
  if (!b) return out;
  for (const d of b.dice) for (let ti = 0; ti < run.tools.length; ti++) if (fits(run, d.id, ti)) out.push([d.id, ti]);
  return out;
}

/** Put a die into a tool. Fires the tool once its slots are full. */
export function place(run: Run, dieId: number, ti: number): Ev[] {
  if (!fits(run, dieId, ti)) return [];
  const b = run.battle!, t = run.tools[ti], s = b.slots[ti], def = TOOL[t.id], need = needOf(def, t.up);
  const di = b.dice.findIndex(x => x.id === dieId), v = b.dice[di].v;
  b.dice.splice(di, 1);
  if (need.k === 'count') {
    s.count -= v;
    if (s.count > 0) return [{ t: 'fire', tool: -1 - ti }];
    s.count = need.n;
    return fire(run, ti, [v]);
  }
  s.pend.push(v);
  if (s.pend.length < slotsOf(need)) return [{ t: 'fire', tool: -1 - ti }];
  const vals = s.pend; s.pend = [];
  return fire(run, ti, vals);
}
/** Take back the dice waiting in a two- or three-dice tool. */
export function takeBack(run: Run, ti: number): Ev[] {
  const b = run.battle; if (!b || b.done) return [];
  const s = b.slots[ti]; if (!s || !s.pend.length) return [];
  const ids: number[] = [];
  for (const v of s.pend) { const id = b.nid++; b.dice.push({ id, v }); ids.push(id); }
  s.pend = [];
  return [{ t: 'dice', ids }];
}
/** Lucky Paw / the locket: re-roll one die. */
export function reroll(run: Run, dieId: number): Ev[] {
  const b = run.battle; if (!b || b.done || b.rerolls <= 0) return [];
  const d = b.dice.find(x => x.id === dieId); if (!d || d.curse) return [];
  b.rerolls--; d.v = d6(run);
  return [{ t: 'dice', ids: [d.id] }];
}
export function setTarget(run: Run, i: number) { const b = run.battle; if (b && b.foes[i] && b.foes[i].hp > 0) b.target = i; }

function fire(run: Run, ti: number, vals: number[]): Ev[] {
  const b = run.battle!, t = run.tools[ti], s = b.slots[ti], def = TOOL[t.id];
  const fx: Fx = def.fx(vals, t.up), ev: Ev[] = [{ t: 'fire', tool: ti }];
  s.used++; if (def.uses === 0) s.spent = true;
  run.stats.tools++;
  if (!run.used.includes(t.id)) run.used.push(t.id);
  let tgt = b.foes[b.target];
  if (!tgt || tgt.hp <= 0) { const k = b.foes.findIndex(f => f.hp > 0); b.target = Math.max(0, k); tgt = b.foes[b.target]; }
  const ti2 = b.target;
  if (fx.dmg && tgt && tgt.hp > 0) hitFoe(run, ti2, fx.dmg, !!fx.pierce, ev);
  if (fx.dmgAll) b.foes.forEach((f, i) => { if (f.hp > 0) hitFoe(run, i, fx.dmgAll!, false, ev); });
  const burnMore = run.charms.includes('spark') ? 2 : 0;
  if (fx.burn) {
    const list = fx.dmgAll ? b.foes.map((_, i) => i) : [ti2];
    for (const i of list) { const f = b.foes[i]; if (f && f.hp > 0) { f.burn += fx.burn + burnMore; ev.push({ t: 'status', to: i, s: 'burn', n: fx.burn + burnMore }); } }
  }
  if (fx.poison && tgt && tgt.hp > 0) { tgt.poison += fx.poison; ev.push({ t: 'status', to: ti2, s: 'poison', n: fx.poison }); }
  if (fx.poisonAll) b.foes.forEach((f, i) => { if (f.hp > 0) { f.poison += fx.poisonAll!; ev.push({ t: 'status', to: i, s: 'poison', n: fx.poisonAll! }); } });
  if (fx.stun && tgt && tgt.hp > 0) { tgt.stun = 1; ev.push({ t: 'status', to: ti2, s: 'stun', n: 1 }); }
  if (fx.block) { b.block += fx.block; ev.push({ t: 'block', to: 'you', n: fx.block }); }
  if (fx.thorns) { b.thorns += fx.thorns; ev.push({ t: 'status', to: 'you', s: 'thorns', n: fx.thorns }); }
  if (fx.heal) healYou(run, fx.heal, ev);
  if (fx.cleanse) { b.poison = 0; b.burn = 0; b.frost = 0; ev.push({ t: 'status', to: 'you', s: 'cleanse', n: 0 }); }
  if (fx.unstick) {
    for (const d of b.dice) d.curse = false;
    for (const x of b.slots) x.locked = false;
    ev.push({ t: 'status', to: 'you', s: 'cleanse', n: 1 });
  }
  if (fx.selfDmg) { run.hp = Math.max(1, run.hp - fx.selfDmg); ev.push({ t: 'hit', to: 'you', n: fx.selfDmg, blocked: 0 }); }
  if (fx.acorns) { run.acorns += fx.acorns; ev.push({ t: 'acorns', n: fx.acorns }); }
  const fresh: number[] = [];
  for (const v of fx.dice ?? []) if (b.dice.length < MAX_DICE) { const id = b.nid++; b.dice.push({ id, v: Math.max(1, Math.min(6, v)) }); fresh.push(id); }
  for (let i = 0; i < (fx.roll ?? 0); i++) if (b.dice.length < MAX_DICE) { const id = b.nid++; b.dice.push({ id, v: d6(run) }); fresh.push(id); }
  if (fresh.length) ev.push({ t: 'dice', ids: fresh });
  checkWin(run, ev);
  return ev;
}
function healYou(run: Run, n: number, ev: Ev[]) {
  const h = Math.min(n, run.max - run.hp);
  if (h > 0) { run.hp += h; run.stats.healed += h; }
  ev.push({ t: 'heal', to: 'you', n: Math.max(0, h) });
}
function hitFoe(run: Run, i: number, n: number, pierce: boolean, ev: Ev[], tick?: 'poison' | 'burn', thorns?: boolean) {
  const f = run.battle!.foes[i];
  let blocked = 0;
  if (!pierce && !tick) { blocked = Math.min(f.block, n); f.block -= blocked; }
  else if (pierce) f.block = 0;
  const dealt = Math.min(f.hp, n - blocked);
  f.hp -= dealt;
  run.stats.dmg += dealt; run.stats.maxHit = Math.max(run.stats.maxHit, n);
  ev.push({ t: 'hit', to: i, n: n - blocked, blocked, tick, thorns });
  if (f.hp <= 0) { f.hp = 0; ev.push({ t: 'down', i }); }
}
function checkWin(run: Run, ev: Ev[]) {
  const b = run.battle!;
  if (b.done || b.foes.some(f => f.hp > 0)) return;
  b.done = 'won'; ev.push({ t: 'win' });
  winBattle(run, ev);
}

/** End your turn: waiting dice are lost, then every foe does what it showed, then you roll again. */
export function endTurn(run: Run): Ev[] {
  const b = run.battle; if (!b || b.done || run.screen !== 'battle') return [];
  const ev: Ev[] = [];
  for (const s of b.slots) s.pend = [];
  b.dice = [];
  for (let i = 0; i < b.foes.length && !b.done; i++) {
    const f = b.foes[i];
    if (f.hp <= 0) continue;
    ev.push({ t: 'act', i });
    f.block = 0;
    if (f.burn > 0) { hitFoe(run, i, f.burn, false, ev, 'burn'); f.burn = Math.floor(f.burn / 2); }
    if (f.hp > 0 && f.poison > 0) { hitFoe(run, i, f.poison, false, ev, 'poison'); f.poison--; }
    if (f.hp <= 0) { checkWin(run, ev); continue; }
    if (f.stun > 0) { f.stun--; ev.push({ t: 'status', to: i, s: 'stunned', n: 0 }); nextIntent(run, f); continue; }
    doIntent(run, i, ev);
    if (run.hp <= 0) { run.hp = 0; lose(run); ev.push({ t: 'lose' }); return ev; }
    nextIntent(run, f);
  }
  if (b.done) return ev;
  if (b.turn >= MAX_TURNS) { lose(run); ev.push({ t: 'lose' }); return ev; }
  return ev.concat(startTurn(run));
}
function doIntent(run: Run, i: number, ev: Ev[]) {
  const b = run.battle!, f = b.foes[i], it = f.intent, paws = run.charms.includes('paws');
  if (it.atk) {
    const hits = it.hits ?? 1, n = hitOf(f);
    for (let h = 0; h < hits && run.hp > 0 && f.hp > 0; h++) {
      const blocked = Math.min(b.block, n); b.block -= blocked;
      run.hp -= n - blocked;
      ev.push({ t: 'hit', to: 'you', n: n - blocked, blocked });
      if (b.thorns > 0) hitFoe(run, i, b.thorns, false, ev, undefined, true);
    }
    if (f.hp <= 0) { checkWin(run, ev); return; }
  }
  if (it.block) { f.block += it.block; ev.push({ t: 'block', to: i, n: it.block }); }
  if (it.heal) { const h = Math.min(it.heal, f.max - f.hp); f.hp += h; ev.push({ t: 'heal', to: i, n: h }); }
  if (it.buff) { f.str += it.buff; ev.push({ t: 'status', to: i, s: 'buff', n: it.buff }); }
  if (it.poison) { b.poison += it.poison; ev.push({ t: 'status', to: 'you', s: 'poison', n: it.poison }); }
  if (it.burn) { b.burn += it.burn; ev.push({ t: 'status', to: 'you', s: 'burn', n: it.burn }); }
  if (it.frost) { b.frost += it.frost; ev.push({ t: 'status', to: 'you', s: 'frost', n: it.frost }); }
  if (it.curse && !paws) { b.curseNext += it.curse; ev.push({ t: 'status', to: 'you', s: 'curse', n: it.curse }); }
  if (it.lock && !paws) { b.lockNext++; ev.push({ t: 'status', to: 'you', s: 'lock', n: 1 }); }
  if (it.summon && alive(b).length < MAX_FOES) {
    const m = makeFoe(run, it.summon, false, false);
    const slot = b.foes.findIndex(x => x.hp <= 0 && FOES[x.def].minion);
    if (slot >= 0) b.foes[slot] = m; else b.foes.push(m);
    ev.push({ t: 'summon', i: slot >= 0 ? slot : b.foes.length - 1 });
  }
}

// ---------- after a battle ----------
function rollTools(run: Run, n: number, rare: boolean): string[] {
  const owned = new Set(run.tools.map(t => t.id)), out: string[] = [];
  const lead = run.lead;
  for (let k = 0; k < n; k++) {
    const opts = run.pool.filter(id => !owned.has(id) && !out.includes(id));
    if (!opts.length) break;
    const w = opts.map(id => {
      const t = TOOL[id];
      let x = rare ? [0, 2, 4, 3][t.rarity] : [0, 6, 3, 1][t.rarity];
      if (lead !== 'both' && t.who !== 'any') x *= t.who === lead ? 1.6 : 0.6;
      return x;
    });
    let p = rnd(run) * w.reduce((a, c) => a + c, 0), j = 0;
    while (j < opts.length - 1 && p >= w[j]) { p -= w[j]; j++; }
    out.push(opts[j]);
  }
  return out;
}
function winBattle(run: Run, ev: Ev[]) {
  const b = run.battle!;
  run.stats.battles++;
  if (b.kind === 'elite') run.stats.elites++;
  if (b.kind === 'boss') run.stats.bosses++;
  if (run.charms.includes('basket')) healYou(run, 4, ev);
  const acorns = b.kind === 'boss' ? 40 + ri(run, 11) : b.kind === 'elite' ? 24 + ri(run, 9) : 10 + ri(run, 7);
  run.acorns += acorns;
  let upgraded = -1;
  if (b.kind === 'elite') {
    const can = run.tools.map((t, i) => (t.up ? -1 : i)).filter(i => i >= 0);
    if (can.length) { upgraded = pick(run, can); run.tools[upgraded].up = true; }
  }
  run.offer = { kind: 'reward', acorns, tools: rollTools(run, 3, b.kind !== 'battle'), upgraded, taken: false, boss: b.kind === 'boss' };
  run.screen = 'reward';
}
function lose(run: Run) { if (run.battle) run.battle.done = 'lost'; run.screen = 'lost'; run.offer = null; }
export const toolRoom = (run: Run) => MAX_TOOLS + (run.charms.includes('belt') ? 1 : 0);

/** Add a tool to the table; when it is full, `replace` names the tool to give up. */
function addTool(run: Run, id: string, replace?: number): boolean {
  if (!TOOL[id]) return false;
  if (run.tools.length >= toolRoom(run)) {
    if (replace == null || !run.tools[replace]) return false;
    run.tools[replace] = { id, up: false };
  } else run.tools.push({ id, up: false });
  return true;
}
/** Take one of the reward tools (or skip with -1 for a few acorns). */
export function takeReward(run: Run, i: number, replace?: number): boolean {
  const o = run.offer; if (run.screen !== 'reward' || !o || o.kind !== 'reward') return false;
  if (i >= 0) { if (!o.tools[i] || !addTool(run, o.tools[i], replace)) return false; }
  else run.acorns += 8;
  o.taken = true;
  afterReward(run, o.boss);
  return true;
}
function afterReward(run: Run, boss: boolean) {
  run.battle = null;
  if (boss) {
    const owned = new Set(run.charms);
    const opts = CHARMS.map(c => c.id).filter(id => !owned.has(id) && !(id === 'die' && diceCount(run) >= 6));
    const ch: string[] = [];
    while (ch.length < 3 && opts.length) ch.push(opts.splice(ri(run, opts.length), 1)[0]);
    run.offer = { kind: 'charm', charms: ch }; run.screen = 'charm';
  } else { run.offer = null; run.screen = 'map'; }
}
export function takeCharm(run: Run, i: number): boolean {
  const o = run.offer; if (run.screen !== 'charm' || !o || o.kind !== 'charm' || !o.charms[i]) return false;
  const id = o.charms[i];
  run.charms.push(id);
  if (id === 'acorn') { run.max += 10; run.hp = Math.min(run.max, run.hp + 10); }
  // between areas the pair rest: heal 40% of their hearts
  run.hp = Math.min(run.max, run.hp + Math.round(run.max * 0.4));
  run.offer = null; run.battle = null;
  if (run.area >= 2) { run.screen = 'won'; return true; }
  run.area++; run.at = -1; run.path = []; run.lastGroup = '';
  run.map = makeMap(run, run.area);
  run.screen = 'map';
  run.note = `On to ${AREAS[run.area].name}.`;
  return true;
}

// ---------- walking the map ----------
export function go(run: Run, nodeId: number): Ev[] {
  if (!choices(run).includes(nodeId)) return [];
  const n = run.map[nodeId], area = AREAS[run.area];
  run.at = nodeId; run.path.push(nodeId); run.note = '';
  switch (n.kind) {
    case 'battle': {
      const groups = area.foes.filter(g => g.join() !== run.lastGroup);
      const g = pick(run, groups); run.lastGroup = g.join();
      return startBattle(run, 'battle', [...g]);
    }
    case 'elite': return startBattle(run, 'elite', [pick(run, area.elites)]);
    case 'boss': return startBattle(run, 'boss', [area.boss]);
    case 'stall': {
      const tools = rollTools(run, 3, false).map(id => ({ id, price: [0, 38, 58, 82][TOOL[id].rarity] + ri(run, 9), sold: false }));
      run.offer = { kind: 'stall', tools, up: 45 + 10 * run.area, rm: 30, pie: 25, usedUp: false, usedRm: false, usedPie: false };
      run.screen = 'stall'; return [];
    }
    case 'picnic': run.offer = { kind: 'picnic', heal: Math.round(run.max * (run.fog >= 3 ? 0.2 : 1 / 3)) }; run.screen = 'picnic'; return [];
    case 'tent': {
      const left = TENTS.filter(t => !run.tentsSeen.includes(t.id));
      const t = pick(run, left.length ? left : TENTS);
      run.tentsSeen.push(t.id); run.tent = t.id; run.screen = 'tent'; return [];
    }
  }
}
export function stallBuy(run: Run, i: number, replace?: number): boolean {
  const o = run.offer; if (run.screen !== 'stall' || !o || o.kind !== 'stall') return false;
  const it = o.tools[i]; if (!it || it.sold || run.acorns < it.price) return false;
  if (!addTool(run, it.id, replace)) return false;
  run.acorns -= it.price; it.sold = true; return true;
}
export function stallUpgrade(run: Run, ti: number): boolean {
  const o = run.offer; if (run.screen !== 'stall' || !o || o.kind !== 'stall' || o.usedUp || run.acorns < o.up) return false;
  const t = run.tools[ti]; if (!t || t.up) return false;
  t.up = true; run.acorns -= o.up; o.usedUp = true; return true;
}
export function stallRemove(run: Run, ti: number): boolean {
  const o = run.offer; if (run.screen !== 'stall' || !o || o.kind !== 'stall' || o.usedRm || run.acorns < o.rm || run.tools.length <= 2 || !run.tools[ti]) return false;
  run.tools.splice(ti, 1); run.acorns -= o.rm; o.usedRm = true; return true;
}
export function stallPie(run: Run): boolean {
  const o = run.offer; if (run.screen !== 'stall' || !o || o.kind !== 'stall' || o.usedPie || run.acorns < o.pie || run.hp >= run.max) return false;
  run.acorns -= o.pie; o.usedPie = true; run.hp = Math.min(run.max, run.hp + 12); return true;
}
/** Leave a stall, a picnic, a tent's picker or a reward. */
export function leave(run: Run): boolean {
  if (run.screen === 'stall' || run.screen === 'pick') { run.offer = null; run.screen = 'map'; return true; }
  return false;
}
/** At a picnic: rest (heal) or sharpen a tool (upgrade it). */
export function picnic(run: Run, upgrade?: number): boolean {
  const o = run.offer; if (run.screen !== 'picnic' || !o || o.kind !== 'picnic') return false;
  if (upgrade != null) { const t = run.tools[upgrade]; if (!t || t.up) return false; t.up = true; run.note = `${TOOL[t.id].name} got a gold rim.`; }
  else { const h = Math.min(o.heal, run.max - run.hp); run.hp += h; run.stats.healed += h; run.note = `A picnic under the bunting: +${h} hearts.`; }
  run.offer = null; run.screen = 'map'; return true;
}
/** The tool picker some tents open (remove or upgrade one). */
export function pickTool(run: Run, ti: number): boolean {
  const o = run.offer; if (run.screen !== 'pick' || !o || o.kind !== 'pick') return false;
  const t = run.tools[ti]; if (!t) return false;
  if (o.purpose === 'remove') { if (run.tools.length <= 2) return false; run.tools.splice(ti, 1); run.note = `You left the ${TOOL[t.id].name} behind.`; }
  else { if (t.up) return false; t.up = true; run.note = `${TOOL[t.id].name} got a gold rim.`; }
  run.offer = null; run.screen = 'map'; return true;
}
function upgradeRandom(run: Run): string {
  const can = run.tools.map((t, i) => (t.up ? -1 : i)).filter(i => i >= 0);
  if (!can.length) return '';
  const t = run.tools[pick(run, can)]; t.up = true; return TOOL[t.id].name;
}
/** Choose at a mystery tent. */
export function tentChoose(run: Run, choice: string): Ev[] {
  if (run.screen !== 'tent') return [];
  const id = run.tent;
  run.screen = 'map'; run.note = '';
  const reward = (tools: string[]) => { run.offer = { kind: 'reward', acorns: 0, tools, upgraded: -1, taken: false, boss: false }; run.screen = 'reward'; };
  switch (`${id}:${choice}`) {
    case 'fortune:pay': { run.hp = Math.max(1, run.hp - 6); const n = upgradeRandom(run); run.note = n ? `The crystal ball glowed: ${n} got a gold rim.` : 'The crystal ball glowed, but every tool already shines.'; break; }
    case 'lost:tool': reward(rollTools(run, 2, false)); break;
    case 'lost:acorns': run.acorns += 25; run.note = '+25 acorns.'; break;
    case 'ferris:ride': { const h = Math.min(10, run.max - run.hp); run.hp += h; run.note = `A slow ride above the fog: +${h} hearts.`; break; }
    case 'ferris:fix': run.hp = Math.max(1, run.hp - 4); reward(rollTools(run, 3, false)); break;
    case 'pie:eat': run.max += 4; run.hp += 4; run.note = 'Pumpkin pie! +4 most hearts.'; break;
    case 'pie:judge': run.acorns += 30; run.note = 'Every pie wins a ribbon. +30 acorns.'; break;
    case 'mirror:remove': if (run.tools.length > 2) { run.offer = { kind: 'pick', purpose: 'remove' }; run.screen = 'pick'; } break;
    case 'coconut:throw': {
      const v = d6(run);
      if (v >= 4) { reward(rollTools(run, 3, true)); run.note = `You rolled a ${v}: a coconut tumbles down!`; }
      else { run.hp = Math.max(1, run.hp - 5); run.note = `You rolled a ${v}: the ball bonks back. −5 hearts.`; }
      break;
    }
    case 'smith:upgrade': if (run.acorns >= 30) { run.acorns -= 30; const n = upgradeRandom(run); run.note = n ? `The tinker polished your ${n}.` : 'Every tool already shines.'; } break;
    case 'ambush:fight': { const g = pick(run, AREAS[run.area].foes); return startBattle(run, 'battle', [...g]); }
    default: run.note = 'You leave the tent quietly.';
  }
  run.tent = '';
  return [];
}

// ---------- saves ----------
export type Save = { v: 1; meta: Meta; run: Run | null; sound: boolean; music: boolean; lead: LeadId; fog: number };
export const freshSave = (): Save => ({ v: 1, meta: freshMeta(), run: null, sound: true, music: true, lead: 'dora', fog: 0 });
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
/** A run from storage, or null when anything about it is off. */
export function saneRun(x: unknown): Run | null {
  const r = x as Run;
  if (!r || typeof r !== 'object' || r.v !== 1) return null;
  const okNums = ['seed', 'r', 'fog', 'hp', 'max', 'acorns', 'area', 'at'].every(k => Number.isFinite((r as unknown as Record<string, unknown>)[k]));
  if (!okNums || !LEADS[r.lead] || !Array.isArray(r.tools) || !Array.isArray(r.map) || !Array.isArray(r.charms) || !Array.isArray(r.pool)) return null;
  if (!r.tools.every(t => t && TOOL[t.id]) || !r.pool.every(id => TOOL[id]) || r.area < 0 || r.area > 2 || r.hp < 0 || r.max <= 0) return null;
  if (!r.map.every(n => n && Array.isArray(n.next) && typeof n.kind === 'string') || r.at >= r.map.length) return null;
  const screens: Screen[] = ['map', 'battle', 'reward', 'stall', 'picnic', 'tent', 'charm', 'pick', 'won', 'lost'];
  if (!screens.includes(r.screen) || (r.screen === 'battle' && (!r.battle || !Array.isArray(r.battle.foes) || !Array.isArray(r.battle.dice) || r.battle.slots?.length !== r.tools.length))) return null;
  if (['reward', 'stall', 'picnic', 'charm', 'pick'].includes(r.screen) && !r.offer) return null;
  if (r.screen === 'battle' && !r.battle!.foes.every(f => f && FOES[f.def])) return null;
  if (!r.stats || !Array.isArray(r.used) || !Array.isArray(r.path) || !Array.isArray(r.tentsSeen)) return null;
  return r;
}
export function readSave(raw: string | null): Save {
  const s = freshSave();
  if (!raw) return s;
  let o: Partial<Save>;
  try { o = JSON.parse(raw); } catch { return s; }
  if (!o || typeof o !== 'object' || o.v !== 1) return s;
  const m = o.meta as Partial<Meta> | undefined;
  if (m && typeof m === 'object') {
    s.meta.runs = Math.max(0, num(m.runs, 0)); s.meta.wins = Math.max(0, num(m.wins, 0));
    s.meta.fogWon = Math.max(-1, Math.min(5, num(m.fogWon, -1))); s.meta.bestArea = Math.max(0, Math.min(3, num(m.bestArea, 0)));
    for (const k of ['meadow', 'midway', 'won', 'foggy', 'ending'] as const) s.meta[k] = m[k] === true;
    if (m.daily && typeof m.daily === 'object') for (const [d, v] of Object.entries(m.daily)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && v && typeof v === 'object') s.meta.daily[d] = { won: v.won === true, area: num(v.area, 0), turns: num(v.turns, 0) };
  }
  s.run = saneRun(o.run);
  s.sound = o.sound !== false; s.music = o.music !== false;
  s.lead = o.lead && LEADS[o.lead] ? o.lead : 'dora';
  s.fog = Math.max(0, Math.min(5, Math.floor(num(o.fog, 0))));
  return s;
}
export const describeNeed = (n: Need) => n.k;
