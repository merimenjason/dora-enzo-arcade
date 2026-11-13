// Highburrow: the deterministic engine. No DOM. All randomness comes from a seeded generator kept in the state,
// and every player action is a `Cmd`, so a seed plus the list of commands replays a game exactly.
import {
  W, H, MAP, TERRAIN, BUILDS, INDOOR, GOODS, FOOD, NEIGHBOURS, NEIGHBOUR_IDS, UNIT_INFO, START, VILLAGE_NAMES, SUMMIT_NAME,
  FESTIVAL, POP_GOAL, LAST_TURN, EVENTS, CARAVAN_CAP, MAX_VILLAGES, GOOD_NAME, DECISIONS, EAT,
  idx, neighbours, hexDist, season,
  type Good, type BuildKind, type NeighbourId, type IndoorJob,
} from './highburrow-world.js';
import {
  emptyStore, preview, bestJob, jobFree, findPath, moveCost, maxMp, reveal, villageSight, sightOf, foundProblem, hearts,
  villageAt, isSummit, bandAt, reservedQuinoa, storeCap, walkable, caravanLoad, pop, frostKnown, HEART_NAME, parseTile, tileJob,
  type State, type Village, type Unit, type Fur, type ReportItem, type Store,
} from './highburrow-rules.js';

export * from './highburrow-world.js';
export * from './highburrow-rules.js';
export const SAVE_KEY = 'highburrow-v1';

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export type Src = { village: number } | { caravan: number };
export type Cmd =
  | { k: 'move'; unit: number; q: number; r: number }
  | { k: 'explore'; unit: number }
  | { k: 'rest'; unit: number }
  | { k: 'found'; unit: number }
  | { k: 'trail'; unit: number }
  | { k: 'join'; unit: number }
  | { k: 'befriend'; unit: number }
  | { k: 'load'; unit: number; good: Good; n: number }
  | { k: 'assign'; v: number; settler: number; job: string }
  | { k: 'queue'; v: number; b: BuildKind }
  | { k: 'unqueue'; v: number; i: number }
  | { k: 'send'; v: number }
  | { k: 'trade'; n: NeighbourId; src: Src; offer: number }
  | { k: 'deliver'; n: NeighbourId; src: Src }
  | { k: 'learn'; n: NeighbourId }
  | { k: 'festival'; v: number }
  | { k: 'route'; unit: number; a: number; b: number; carry: Good[] }
  | { k: 'unroute'; unit: number }
  | { k: 'decide'; choice: number }
  | { k: 'end' };
export interface Result { ok: boolean; msg: string; steps?: [number, number][] }

export function newState(seed = 1, assist = true): State {
  const s: State = {
    v: 1, seed, rng: seed >>> 0, turn: 1, assist, seen: new Array(W * H).fill(0), trail: new Array(W * H).fill(0), passes: false,
    villages: [], units: [], nextId: 1, frost: false, rains: 0, snowstorm: false, skills: [], report: [], notes: [], decision: null, decided: [], snap: 0, over: '', wonTurn: 0,
    nb: Object.fromEntries(NEIGHBOUR_IDS.map(n => [n, { met: false, fr: 0, befriendT: -9, found: false, quest: 'open', learned: false, traded: [] }])) as unknown as State['nb'],
    stats: { aid: 0, frosts: 0, trades: 0, built: 0, born: 0, coldTurns: 0, hungryTurns: 0 },
  };
  const [vq, vr] = START.village;
  const v = makeVillage(s, 'Quinoa Hollow', vq, vr);
  v.store = { ...emptyStore(), quinoa: 8, potatoes: 10, wool: 4, stone: 10, salt: 2 };
  v.warmth = 70; v.happy = 65;
  for (const fur of [0, 1, 2] as Fur[]) v.settlers.push({ id: s.nextId++, fur, job: '' });
  const add = (kind: Unit['kind'], [q, r]: [number, number], extra: Partial<Unit> = {}) => {
    const u: Unit = { id: s.nextId++, kind, q, r, mp: 0, path: [], ...extra }; u.mp = maxMp(s, u); s.units.push(u); reveal(s, q, r, sightOf(s, u)); return u;
  };
  add('dora', START.dora); add('enzo', START.enzo); add('caravan', START.caravan, { cargo: emptyStore() });
  // hand-picked first jobs: quinoa terraces, potato field, pasture
  v.settlers[0].job = tileJob(6, 10); v.settlers[1].job = tileJob(5, 9); v.settlers[2].job = 'builder';
  v.queue = ['kiln'];
  return s;
}
function makeVillage(s: State, name: string, q: number, r: number): Village {
  const v: Village = { id: s.nextId++, name, q, r, settlers: [], store: emptyStore(), warmth: 60, happy: 60, growth: 0, queue: [], work: 0, built: [], hungry: 0, aidCd: 0, founded: s.turn };
  s.villages.push(v); reveal(s, q, r, villageSight(v)); return v;
}

export class Game {
  s: State;
  log: Cmd[] = [];
  private r: () => number;
  constructor(seed = 1, assist = true, from?: State) {
    this.s = from ?? newState(seed, assist);
    this.r = rng(this.s.rng);
  }
  private rand() { const x = this.r(); this.s.rng = (this.s.rng + 0x6d2b79f5) >>> 0; return x; }
  static load(json: string): Game | null {
    try { const s = JSON.parse(json) as State; if (!s || s.v !== 1 || !Array.isArray(s.villages)) return null; const g = new Game(s.seed, s.assist, s); g.r = rng(s.rng); return g; } catch { return null; }
  }
  save() { return JSON.stringify(this.s); }
  unit(id: number) { return this.s.units.find(u => u.id === id); }
  village(id: number) { return this.s.villages.find(v => v.id === id); }
  goal() { return this.s.assist ? POP_GOAL.assist : POP_GOAL.normal; }
  pop() { return pop(this.s); }

  /** apply one player command; illegal ones do nothing and say why */
  apply(c: Cmd): Result {
    if (this.s.over && c.k !== 'end') return { ok: false, msg: 'The scenario is over.' };
    const res = this.run(c);
    if (res.ok) this.log.push(c);
    return res;
  }
  private run(c: Cmd): Result {
    const s = this.s;
    switch (c.k) {
      case 'move': {
        const u = this.unit(c.unit); if (!u) return no('No such unit.');
        if (u.q === c.q && u.r === c.r) { u.path = []; return yes('Already here.'); }
        const p = findPath(s, [u.q, u.r], [c.q, c.r]); if (!p) return no('No way there.');
        u.path = p; u.rest = false;
        return { ok: true, msg: '', steps: this.walk(u) };
      }
      case 'explore': {
        const u = this.unit(c.unit); if (!u) return no('No such unit.');
        const t = this.frontier(u); if (!t) return no('Nothing left to explore nearby.');
        return this.run({ k: 'move', unit: u.id, q: t[0], r: t[1] });
      }
      case 'rest': { const u = this.unit(c.unit); if (!u) return no('No such unit.'); u.rest = true; u.path = []; u.act = 'rest'; return yes('Resting.'); }
      case 'found': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'enzo') return no('Only Enzo can found a village.');
        const st = s.units.find(x => x.kind === 'settler' && x.q === u.q && x.r === u.r);
        if (!st) return no('Bring a settler to this tile first.');
        const why = foundProblem(s, u.q, u.r); if (why) return no(why);
        const summit = bandAt(u.q, u.r) >= 4 && !s.villages.some(v => v.name === SUMMIT_NAME);
        const name = summit ? SUMMIT_NAME : VILLAGE_NAMES.find(n => !s.villages.some(v => v.name === n)) ?? 'Burrow ' + s.villages.length;
        const v = makeVillage(s, name, u.q, u.r);
        v.store.potatoes = 6; v.store.stone = 3;
        s.units = s.units.filter(x => x !== st);
        v.settlers.push({ id: st.id, fur: st.fur ?? 0, job: '' });
        v.settlers[0].job = bestJob(s, v, v.settlers[0]);
        u.mp = 0; u.path = []; u.act = 'found';
        s.notes.push({ kind: 'good', text: `${name} is founded!`, v: v.id });
        return yes(`${name} is founded!`);
      }
      case 'trail': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'enzo') return no('Only Enzo lays trails.');
        if (s.trail[idx(u.q, u.r)]) return no('There is a trail here already.');
        if (u.mp < 2) return no('Enzo needs a full step of moves left.');
        s.trail[idx(u.q, u.r)] = 1; u.mp = 0; u.path = []; u.act = 'build';
        return yes('Trail laid: every unit crosses this tile for half a step.');
      }
      case 'join': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'settler') return no('Only settlers can join.');
        const v = villageAt(s, u.q, u.r); if (!v) return no('Walk into a village first.');
        if (v.settlers.length >= 9) return no(`${v.name} is full.`);
        s.units = s.units.filter(x => x !== u);
        const st = { id: u.id, fur: u.fur ?? 0, job: '' }; v.settlers.push(st); st.job = bestJob(s, v, st);
        return yes(`A settler joined ${v.name}.`);
      }
      case 'befriend': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'dora') return no('Dora is the one who makes friends.');
        const n = NEIGHBOUR_IDS.find(id => hexDist([u.q, u.r], [NEIGHBOURS[id].q, NEIGHBOURS[id].r]) <= 1);
        if (!n) return no('Walk Dora next to a neighbour’s camp.');
        const ns = s.nb[n];
        if (s.turn - ns.befriendT < 2) return no('Let them rest a turn before visiting again.');
        const before = hearts(ns.fr);
        if (!ns.met) { ns.met = true; s.notes.push({ kind: 'friend', text: `Dora met the ${NEIGHBOURS[n].name}.`, n }); }
        ns.fr = Math.min(100, ns.fr + (s.assist ? 15 : 12)); ns.befriendT = s.turn; u.mp = 0; u.path = []; u.act = 'befriend';
        this.checkFound(n);
        const after = hearts(ns.fr);
        return yes(after > before ? `${NEIGHBOURS[n].name}: now ${HEART_NAME[after]}!` : `${NEIGHBOURS[n].name} enjoyed the visit.`);
      }
      case 'load': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'caravan') return no('Only caravans carry goods.');
        const v = villageAt(s, u.q, u.r); if (!v) return no('The caravan must be in a village.');
        const cargo = u.cargo ??= emptyStore();
        let n = c.n;
        if (n > 0) n = Math.min(n, v.store[c.good], CARAVAN_CAP - caravanLoad(u));
        else n = -Math.min(-n, cargo[c.good]);
        if (!n) return no(c.n > 0 ? 'Nothing to load (or the caravan is full).' : 'Nothing to unload.');
        v.store[c.good] -= n; cargo[c.good] += n; u.act = 'trade';
        return yes(`${n > 0 ? 'Loaded' : 'Unloaded'} ${Math.abs(n)} ${GOOD_NAME[c.good].toLowerCase()}.`);
      }
      case 'assign': {
        const v = this.village(c.v); const st = v?.settlers.find(x => x.id === c.settler);
        if (!v || !st) return no('No such settler.');
        if (st.job === c.job) return yes('');
        if (!jobFree(s, v, c.job, st)) {
          // swapping onto an occupied tile or full building trades places
          const other = v.settlers.find(x => x.job === c.job);
          if (other && (parseTile(c.job) || other.job === c.job)) { other.job = st.job; st.job = c.job; return yes('Swapped jobs.'); }
          return no('That job is not available.');
        }
        st.job = c.job; return yes('');
      }
      case 'queue': {
        const v = this.village(c.v); if (!v) return no('No such village.');
        if (c.b !== 'caravan' && (v.built.includes(c.b) || v.queue.includes(c.b))) return no('Already built or queued.');
        if (v.queue.length >= 3) return no('The queue holds 3.');
        v.queue.push(c.b); return yes(`${BUILDS[c.b].name} queued.`);
      }
      case 'unqueue': {
        const v = this.village(c.v); if (!v || !v.queue[c.i]) return no('Nothing there.');
        v.queue.splice(c.i, 1); if (c.i === 0) v.work = 0; return yes('Removed.');
      }
      case 'send': {
        const v = this.village(c.v); if (!v) return no('No such village.');
        if (v.settlers.length < 2) return no('A village keeps at least one settler.');
        const st = [...v.settlers].sort((a, b) => rank(a.job) - rank(b.job))[0];
        v.settlers = v.settlers.filter(x => x !== st);
        const u: Unit = { id: st.id, kind: 'settler', q: v.q, r: v.r, mp: UNIT_INFO.settler.mp, path: [], fur: st.fur };
        s.units.push(u);
        return yes('A settler is ready to travel.');
      }
      case 'trade': case 'deliver': {
        const n = NEIGHBOURS[c.n], ns = s.nb[c.n];
        if (!ns.met) return no('Dora must meet them first.');
        const store = this.srcStore(c.src, c.n); if (!store) return no('Trade from a village within 3 tiles, or a caravan beside the camp. At 3 hearts, friends come to any village.');
        if (c.k === 'deliver') {
          const q = n.quest; if (q.kind !== 'deliver' || ns.quest === 'done') return no('Nothing to deliver.');
          if (store[q.good] < q.n) return no(`You need ${q.n} ${q.good}.`);
          store[q.good] -= q.n; this.questDone(c.n, store); return yes(q.done);
        }
        const o = n.offers[c.offer]; if (!o) return no('No such offer.');
        if (ns.traded.includes(c.offer)) return no('They will trade this again next turn.');
        if (store[o.give[0]] < o.give[1]) return no(`You need ${o.give[1]} ${o.give[0]}.`);
        const get = o.get[1] + (hearts(ns.fr) >= 4 ? 1 : 0);
        const room = 'caravan' in c.src ? CARAVAN_CAP - caravanLoad(this.unit(c.src.caravan)!) + o.give[1] : 999;
        if (get > room) return no('The caravan has no room for that.');
        store[o.give[0]] -= o.give[1]; store[o.get[0]] += get; ns.traded.push(c.offer);
        ns.fr = Math.min(100, ns.fr + 6); s.stats.trades++;
        if ('caravan' in c.src) this.unit(c.src.caravan)!.act = 'trade';
        return yes(`Traded ${o.give[1]} ${o.give[0]} for ${get} ${o.get[0]}.`);
      }
      case 'learn': {
        const ns = s.nb[c.n], n = NEIGHBOURS[c.n];
        if (ns.learned) return no('Already learned.');
        if (hearts(ns.fr) < 3) return no('They teach friends (3 hearts).');
        ns.learned = true; s.skills.push(n.skill.id);
        if (n.skill.id === 'passes') {
          s.passes = true;
          MAP.forEach((t, i) => { if (t === 'pass') { s.seen[i] = 1; for (const [a, b] of neighbours(i % W, Math.floor(i / W))) s.seen[idx(a, b)] = 1; } });
          const d = s.units.find(u => u.kind === 'dora'); if (d) d.mp += 2;
        }
        s.notes.push({ kind: 'friend', text: `Learned ${n.skill.name}: ${n.skill.line}.`, n: c.n });
        return yes(`Learned ${n.skill.name}!`);
      }
      case 'festival': {
        const v = this.village(c.v); if (!v) return no('No such village.');
        const why = this.festivalProblem(v); if (why) return no(why);
        for (const [g, n] of Object.entries(FESTIVAL) as [Good, number][]) v.store[g] -= n;
        s.over = 'won'; s.wonTurn = s.turn;
        s.report = [{ kind: 'win', text: `The summit festival at ${v.name}! The First Valley is a thriving league of villages.`, v: v.id }];
        return yes('The summit festival begins!');
      }
      case 'route': {
        const u = this.unit(c.unit); if (!u || u.kind !== 'caravan') return no('Only caravans run routes.');
        const A = this.village(c.a), B = this.village(c.b);
        if (!A || !B || A === B) return no('Pick two different villages.');
        if (!c.carry.length) return no('Pick at least one good to carry.');
        if (!findPath(s, [A.q, A.r], [B.q, B.r])) return no('There is no way between those villages yet.');
        u.route = { a: A.id, b: B.id, carry: [...c.carry], leg: 'a' }; u.rest = false;
        this.runRoute(u);
        const steps = this.walk(u);
        return { ok: true, msg: `Route set: ${A.name} → ${B.name}, carrying ${c.carry.join(', ')}.`, steps: steps.length ? steps : undefined };
      }
      case 'unroute': {
        const u = this.unit(c.unit); if (!u?.route) return no('That caravan has no route.');
        u.route = undefined; u.path = []; return yes('Route stopped.');
      }
      case 'decide': {
        const d = DECISIONS.find(x => x.id === s.decision); if (!d) return no('Nothing to decide.');
        const ch = d.choices[c.choice]; if (!ch) return no('No such choice.');
        const msg = this.decide(d.id, c.choice);
        s.decided.push(d.id); s.decision = null;
        return yes(msg);
      }
      case 'end': return this.endTurn();
    }
  }
  srcStore(src: Src, n: NeighbourId): Store | null {
    const c = NEIGHBOURS[n];
    if ('village' in src) { const v = this.village(src.village); return v && (hexDist([v.q, v.r], [c.q, c.r]) <= 3 || hearts(this.s.nb[n].fr) >= 3) ? v.store : null; }
    const u = this.unit(src.caravan); return u && u.kind === 'caravan' && hexDist([u.q, u.r], [c.q, c.r]) <= 1 ? u.cargo ?? null : null;
  }
  /** a route caravan at one end loads (or unloads) and sets off for the other end */
  runRoute(u: Unit) {
    const s = this.s, rt = u.route!; const A = this.village(rt.a), B = this.village(rt.b);
    if (!A || !B) { u.route = undefined; return; }
    const cargo = u.cargo ??= emptyStore();
    if (u.q === A.q && u.r === A.r) {
      for (const g of GOODS) if (!rt.carry.includes(g) && cargo[g] > 0) { A.store[g] += cargo[g]; cargo[g] = 0; }
      let got = 0;
      // scarce goods first, food last, so a load of quinoa never crowds out the silver
      for (const g of [...rt.carry].sort((x, y) => +FOOD.includes(x) - +FOOD.includes(y))) {
        const keep = FOOD.includes(g) ? A.settlers.length * EAT * 2 : 0;
        const n = Math.max(0, Math.min(CARAVAN_CAP - caravanLoad(u), A.store[g] - keep));
        A.store[g] -= n; cargo[g] += n; got += n;
      }
      rt.leg = 'b'; u.act = 'trade';
      void got;
    } else if (u.q === B.q && u.r === B.r) {
      const parts: string[] = [];
      for (const g of rt.carry) {
        const room = Math.max(0, storeCap(B, g) + (g === 'quinoa' ? reservedQuinoa(B) : 0) - B.store[g]);
        const n = Math.min(cargo[g], room);
        if (n > 0) { B.store[g] += n; cargo[g] -= n; parts.push(`${n} ${g}`); }
      }
      if (parts.length) s.notes.push({ kind: 'route', text: `A caravan brought ${parts.join(', ')} to ${B.name}.`, v: B.id });
      rt.leg = 'a'; u.act = 'trade';
    }
    const T = rt.leg === 'a' ? A : B;
    if (u.q !== T.q || u.r !== T.r) u.path = findPath(s, [u.q, u.r], [T.q, T.r]) ?? [];
  }
  private decide(id: string, choice: number): string {
    const s = this.s; const fr = (n: NeighbourId, d: number) => { s.nb[n].fr = Math.max(0, Math.min(100, s.nb[n].fr + d)); };
    if (id === 'herd') {
      if (choice === 0) {
        const v = [...s.villages].sort((a, b) => (b.store.quinoa - reservedQuinoa(b)) - (a.store.quinoa - reservedQuinoa(a)))[0];
        if (!v || v.store.quinoa - reservedQuinoa(v) < 8) { fr('herders', 10); return 'You only had a little to give, but they were touched. +10 friendship.'; }
        v.store.quinoa -= 8; v.store.wool += 6; fr('herders', 25); return `${v.name} shared 8 quinoa. The herders sent 6 wool back. +25 friendship.`;
      }
      fr('herders', -10); return 'The herders understand, but they are sad. −10 friendship.';
    }
    if (id === 'alpacas') {
      if (choice === 0) { s.skills.push('alpacas'); fr('herders', -15); return 'The alpacas stay: every pasture makes +1 wool. −15 friendship with the herders.'; }
      fr('herders', 25); return 'Dora walks the alpacas home. +25 friendship with the herders.';
    }
    if (id === 'coldsnap') {
      s.snap = 2;
      if (choice === 0) { const done = s.villages.filter(v => v.store.wool >= 3); for (const v of done) { v.store.wool -= 3; v.warmth = Math.min(100, v.warmth + 15); } return `${done.length} village${done.length === 1 ? '' : 's'} knitted blankets: +15 Warmth.`; }
      return 'Brace yourselves: two frost nights are coming.';
    }
    return '';
  }
  /** every place the player could trade with a neighbour from right now */
  sources(n: NeighbourId): Src[] {
    const out: Src[] = [];
    for (const v of this.s.villages) if (this.srcStore({ village: v.id }, n)) out.push({ village: v.id });
    for (const u of this.s.units) if (u.kind === 'caravan' && this.srcStore({ caravan: u.id }, n)) out.push({ caravan: u.id });
    return out;
  }
  festivalProblem(v: Village): string {
    if (!isSummit(v)) return 'The festival is held in a village on the snow line.';
    if (this.pop() < this.goal()) return `The league needs ${this.goal()} chinchillas (you have ${this.pop()}).`;
    const miss = (Object.entries(FESTIVAL) as [Good, number][]).filter(([g, n]) => v.store[g] < n).map(([g, n]) => `${n - v.store[g]} more ${GOOD_NAME[g].toLowerCase()}`);
    return miss.length ? `${v.name} needs ${miss.join(', ')}.` : '';
  }
  private questDone(n: NeighbourId, store?: Store) {
    const ns = this.s.nb[n], d = NEIGHBOURS[n];
    ns.quest = 'done'; ns.fr = Math.min(100, ns.fr + 30);
    if (d.reward) {
      const to = store ?? this.s.villages[0].store;
      to[d.reward[0]] += d.reward[1];
    }
    this.s.notes.push({ kind: 'friend', text: `${d.name}: "${d.quest.done}"`, n });
  }
  private checkFound(n: NeighbourId) {
    const ns = this.s.nb[n];
    if (ns.met && ns.found && ns.quest === 'open') this.questDone(n);
  }
  /** the nearest seen, walkable tile at the edge of the mist (most mist revealed per step) */
  frontier(u: Unit): [number, number] | null {
    const s = this.s; let best: [number, number] | null = null; let bs = -1;
    const R = sightOf(s, u);
    for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) {
      if (!s.seen[idx(q, r)] || !walkable(s, q, r)) continue;
      let hidden = 0;
      for (let rr = r - R; rr <= r + R; rr++) for (let qq = q - R - 1; qq <= q + R + 1; qq++)
        if (qq >= 0 && rr >= 0 && qq < W && rr < H && !s.seen[idx(qq, rr)] && hexDist([q, r], [qq, rr]) <= R) hidden++;
      if (!hidden) continue;
      const d = hexDist([u.q, u.r], [q, r]);
      const sc = hidden * 2 - d * 1.5;
      if (sc > bs && findPath(s, [u.q, u.r], [q, r])) { bs = sc; best = [q, r]; }
    }
    return best;
  }
  /** step a unit along its path as far as its moves allow; returns the tiles stepped onto */
  walk(u: Unit): [number, number][] {
    const s = this.s; const steps: [number, number][] = [];
    while (u.path.length) {
      const [q, r] = u.path[0];
      if (s.seen[idx(q, r)] && !walkable(s, q, r)) {
        const end = u.path[u.path.length - 1]; const p = findPath(s, [u.q, u.r], end);
        if (!p) { u.path = []; break; } u.path = p; continue;
      }
      const c = moveCost(s, q, r), full = u.mp >= maxMp(s, u);
      if (u.mp < c && !full) break;
      if (u.mp <= 0) break;
      u.mp = Math.max(0, u.mp - c); u.q = q; u.r = r; u.path.shift(); steps.push([q, r]);
      reveal(s, q, r, sightOf(s, u)); u.act = 'walk';
      this.arrive(u);
    }
    return steps;
  }
  private arrive(u: Unit) {
    if (u.kind !== 'dora') return;
    for (const n of NEIGHBOUR_IDS) {
      const q = NEIGHBOURS[n].quest;
      if (q.kind === 'visit' && q.q === u.q && q.r === u.r && !this.s.nb[n].found) {
        this.s.nb[n].found = true;
        this.s.notes.push({ kind: 'info', text: `Dora found the ${q.thing}.`, n });
        this.checkFound(n);
      }
    }
  }

  /** resolve the turn: villages, frost, events, aid, then start the next turn */
  endTurn(): Result {
    const s = this.s;
    if (s.over) return no('The scenario is over.');
    if (s.decision) return no('Answer the request first.');
    const rep: ReportItem[] = s.notes; s.notes = [];
    if (s.frost) { rep.push({ kind: 'frost', text: s.assist ? 'Frost night! (Assist: gentler frost.)' : 'Frost night!' }); s.stats.frosts++; }
    for (const v of s.villages) this.resolveVillage(v, rep);
    // units: fresh moves, then walk on along their paths
    s.rains = Math.max(0, s.rains - 1);
    const storm = s.snowstorm; s.snowstorm = false;
    for (const u of s.units) {
      u.mp = maxMp(s, u); u.rest = false; u.act = undefined;
      if (storm && bandAt(u.q, u.r) >= 3) u.mp = 0;
    }
    for (const n of NEIGHBOUR_IDS) s.nb[n].traded = [];
    s.turn++;
    for (const u of s.units) if (u.route) this.runRoute(u);
    for (const u of s.units) if (u.path.length) this.walk(u);
    for (const u of s.units) if (u.route && !u.path.length) { this.runRoute(u); this.walk(u); }
    for (const n of s.notes.splice(0)) rep.push(n);
    if (s.turn > 1 && (s.turn - 1) % 8 === 0) rep.push({ kind: 'season', text: season(s.turn) === 'dry' ? 'The dry season begins: clear days, cold nights, frost likely.' : 'The wet season begins: rain helps crops (+1 food on lower tiles).' });
    // weather for the coming turn
    if (s.turn > 5 && this.rand() < 0.2) this.event(rep);
    const fc = s.turn <= 5 ? 0 : season(s.turn) === 'dry' ? (s.assist ? 0.28 : 0.38) : 0.06;
    s.frost = this.rand() < fc;
    if (s.snap > 0) { s.frost = true; s.snap--; }
    // a neighbour asks for a decision (one at a time, mid-game)
    if (!s.decision && s.turn <= 36) {
      const d = DECISIONS.find(x => s.turn >= x.from && !s.decided.includes(x.id) && (!x.who || s.nb[x.who].met));
      if (d) { s.decision = d.id; rep.push({ kind: 'decision', text: `${d.title}: ${d.text}`, n: d.who ?? undefined }); }
    }
    if (s.frost && frostKnown(s)) rep.push({ kind: 'frost', text: 'Frost is coming tonight. Check each village’s Warmth.' });
    if (!s.over && s.turn > LAST_TURN && s.wonTurn !== -1) { s.over = 'late'; rep.push({ kind: 'bad', text: 'Turn 60 has passed. The festival will have to wait for next year.' }); }
    s.report = rep;
    return yes('');
  }
  private resolveVillage(v: Village, rep: ReportItem[]) {
    const s = this.s; const p = preview(s, v, true);
    for (const g of GOODS) v.store[g] = Math.max(0, v.store[g] + p.goods[g].n);
    // eat potatoes first, they keep worst
    let eat = p.food.eat;
    for (const g of FOOD) { const t = Math.min(eat, v.store[g] - (g === 'quinoa' ? reservedQuinoa(v) : 0)); if (t > 0) { v.store[g] -= t; eat -= t; } }
    for (const g of GOODS) v.store[g] = Math.min(v.store[g], storeCap(v, g) + (g === 'quinoa' ? reservedQuinoa(v) : 0));
    const wasted = (Object.entries(p.waste) as [Good, number][]).filter(([, n]) => n > 0);
    if (wasted.length) { s.stats.wasted = (s.stats.wasted ?? 0) + wasted.reduce((a, [, n]) => a + n, 0); rep.push({ kind: 'waste', text: `${v.name}'s storehouse is full: ${wasted.map(([g, n]) => `${n} ${g}`).join(', ')} wasted.`, v: v.id }); }
    if (p.spoil) { const sp = Math.min(p.spoil, v.store.potatoes); v.store.potatoes -= sp; if (sp) rep.push({ kind: 'frost', text: `Frost spoiled ${sp} potatoes in ${v.name}.`, v: v.id }); }
    if (eat > 0) { v.hungry++; s.stats.hungryTurns++; rep.push({ kind: 'bad', text: `${v.name} went hungry (short ${eat} food).`, v: v.id }); } else v.hungry = 0;
    const was = v.warmth; v.warmth = p.warmth.next; v.happy = p.happy.next;
    if (v.warmth < 30) s.stats.coldTurns++;
    if (v.warmth < 30 && was >= 30) rep.push({ kind: 'bad', text: `${v.name} is getting chilly (Warmth ${v.warmth}).`, v: v.id });
    if (v.warmth <= 0 && was > 0) rep.push({ kind: 'bad', text: `${v.name} is freezing! Work is halved.`, v: v.id });
    if (p.weave.idle && p.weave.weavers) rep.push({ kind: 'info', text: `${v.name}: a weaver had no wool.`, v: v.id });
    // growth
    v.growth += p.growth.n;
    if (v.growth >= p.growth.need) {
      v.growth = 0; s.stats.born++;
      const st = { id: s.nextId++, fur: Math.floor(this.rand() * 3) as Fur, job: '' }; v.settlers.push(st); st.job = bestJob(s, v, st);
      rep.push({ kind: 'grow', text: `A new settler was born in ${v.name}! (${v.settlers.length} now)`, v: v.id });
    }
    // building
    const b = v.queue[0];
    if (b) {
      const d = BUILDS[b];
      const work = b === 'bath' && neighbours(v.q, v.r).some(([q, r]) => MAP[idx(q, r)] === 'spring') ? d.work / 2 : d.work;
      v.work = Math.min(work, v.work + p.work.n);
      if (v.work >= work) {
        const miss = (Object.entries(d.cost) as [Good, number][]).filter(([g, n]) => v.store[g] < n);
        if (miss.length) rep.push({ kind: 'info', text: `${v.name}: ${d.name} is ready but needs ${miss.map(([g, n]) => `${n - v.store[g]} ${g}`).join(', ')}.`, v: v.id });
        else {
          for (const [g, n] of Object.entries(d.cost) as [Good, number][]) v.store[g] -= n;
          v.queue.shift(); v.work = 0; s.stats.built++;
          if (b === 'caravan') { const u: Unit = { id: s.nextId++, kind: 'caravan', q: v.q, r: v.r, mp: UNIT_INFO.caravan.mp, path: [], cargo: emptyStore() }; s.units.push(u); }
          else { v.built.push(b); if (b === 'lookout') reveal(s, v.q, v.r, villageSight(v)); }
          rep.push({ kind: 'build', text: `${v.name} finished the ${d.name}.`, v: v.id });
        }
      }
    }
    // no dead ends: friends (or lowland kin) send help to a hungry or freezing village
    v.aidCd = Math.max(0, v.aidCd - 1);
    if (!v.aidCd && (v.hungry >= 1 || v.warmth <= 10)) {
      const best = NEIGHBOUR_IDS.filter(n => s.nb[n].met && hearts(s.nb[n].fr) >= 1).sort((a, b) => s.nb[b].fr - s.nb[a].fr)[0];
      const who = best ? NEIGHBOURS[best].name : 'Lowland kin';
      const food = 4 * v.settlers.length, hungry = v.hungry > 0, cold = v.warmth <= 10;
      if (hungry) v.store.potatoes += food;
      if (cold) v.warmth = Math.min(100, v.warmth + 25);
      if (best) s.nb[best].fr = Math.max(0, s.nb[best].fr - 5);
      v.aidCd = s.assist ? 3 : 4; s.stats.aid++;
      rep.push({ kind: 'aid', text: `${who} sent help to ${v.name}: ${[hungry ? `${food} potatoes` : '', cold ? 'warm blankets (+25 Warmth)' : ''].filter(Boolean).join(' and ')}.`, v: v.id });
    }
  }
  private event(rep: ReportItem[]) {
    const s = this.s;
    const list = EVENTS.filter(e => !e.season || e.season === season(s.turn));
    const e = list[Math.floor(this.rand() * list.length)];
    let text = e.text;
    if (e.id === 'rains') s.rains = 1;
    if (e.id === 'warm') for (const v of s.villages) v.warmth = Math.min(100, v.warmth + 6);
    if (e.id === 'hail') { const v = s.villages[Math.floor(this.rand() * s.villages.length)]; v.store.quinoa = Math.max(0, v.store.quinoa - 3); text = `Hail flattened some quinoa in ${v.name}: −3 quinoa.`; }
    if (e.id === 'snowstorm') s.snowstorm = true;
    if (e.id === 'llama') { const v = s.villages[Math.floor(this.rand() * s.villages.length)]; v.store.wool += 3; text = `A friendly llama wandered into ${v.name} carrying 3 wool.`; }
    if (e.id === 'gift') {
      const best = NEIGHBOUR_IDS.filter(n => s.nb[n].met).sort((a, b) => s.nb[b].fr - s.nb[a].fr)[0];
      if (!best) return;
      const v = s.villages[0]; v.store.potatoes += 4; text = `The ${NEIGHBOURS[best].name} left a basket of 4 potatoes at ${v.name}.`;
    }
    rep.push({ kind: 'event', text: `${e.title}: ${text}` });
  }
}
const no = (msg: string): Result => ({ ok: false, msg });
const yes = (msg: string): Result => ({ ok: true, msg });
/** which settler leaves first when one is sent out: builders and spare hands before farmers */
const rank = (job: string) => (job === 'builder' ? 0 : job === 'hearth' ? 2 : job.startsWith('t:') ? 3 : 1);
export { INDOOR, type IndoorJob };
