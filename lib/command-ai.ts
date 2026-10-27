// Burrow Command's computer players. Each one keeps its gatherers busy, builds up its side's tech, trains a mix of units,
// scouts, defends its home, attacks in waves, pulls back when a fight goes badly, and uses its side's abilities. It thinks
// only through the same orders a person gives (World.exec) and draws on the match's seeded generator, so it replays exactly.
import {
  ABILITIES, BUILDINGS, NODE_SLOTS, SIDES, T, TICK_HZ, TUNNEL_REACH, UNITS, UPGRADES, dist, tiles,
  type Brain, type Building, type Difficulty, type Node, type Player, type SideId, type Unit, type World,
} from './command-game.js';

export type AiOpts = {
  /** Never sends waves (it still defends its home). */
  passive?: boolean;
  /** Never builds a second home. */
  noExpand?: boolean;
  /** Where to send waves when it knows of nothing better (world units). */
  target?: [number, number];
  /** Extra ticks before the first wave. */
  delay?: number;
  /** Caps its army (supply), e.g. for gentle missions. */
  armyCap?: number;
  /** Doesn't build anything (a camp that only holds what it has). */
  noBuild?: boolean;
  /** Leaves the army to someone else (a mission pilot) and only runs the economy. */
  noArmy?: boolean;
  /** Gatherers it keeps on glimmer, instead of its usual few. */
  glimmer?: number;
};

type Tune = { every: number; workers: number; firstWave: number; wave: number; waveGrow: number; prods: number; towers: number; retreat: boolean; abilities: boolean; upgrades: boolean; expandAt: number; glimmer: number; scout: boolean };
const min = (m: number) => Math.round(m * 60 * TICK_HZ);
export const TUNE: Record<Difficulty, Tune> = {
  easy: { every: 30, workers: 10, firstWave: min(7), wave: 8, waveGrow: 2, prods: 1, towers: 0, retreat: false, abilities: false, upgrades: false, expandAt: 0, glimmer: 2, scout: false },
  normal: { every: 15, workers: 16, firstWave: min(5), wave: 14, waveGrow: 3, prods: 2, towers: 1, retreat: true, abilities: true, upgrades: true, expandAt: min(9), glimmer: 3, scout: true },
  hard: { every: 8, workers: 21, firstWave: min(4.5), wave: 16, waveGrow: 4, prods: 3, towers: 1, retreat: true, abilities: true, upgrades: true, expandAt: min(6.5), glimmer: 4, scout: true },
};

/** Each side's build: its barracks, its tech building, its later producers and tower, and the army mix it aims for. */
const PLAN: Record<SideId, { barracks: string; tech: string; late: string[]; tower: string; mix: Record<string, number> }> = {
  colony: { barracks: 'pit', tech: 'library', late: ['den', 'perch'], tower: 'stump', mix: { slinger: 5, fluffguard: 2.5, puffer: 1.5, glider: 1, digger: 1 } },
  guild: { barracks: 'yard', tech: 'bench', late: ['workshop', 'loft'], tower: 'lantern', mix: { scrapper: 2.5, tosser: 5, trapper: 1.2, kite: 1.2, cart: 1 } },
  hive: { barracks: 'brood', tech: 'hall', late: ['forge', 'nest'], tower: 'coil', mix: { clicker: 2.5, squirt: 4.5, shellback: 2, buzzer: 1, rammer: 1, queen: 0.6 } },
};

const strength = (u: Unit) => (u.def.worker ? 0.15 : 1) * Math.sqrt(u.hp * (u.def.dmg / u.def.cd) * (u.def.splash ? 1.4 : 1));

export class Computer implements Brain {
  readonly diff: Difficulty; readonly tune: Tune; readonly opts: AiOpts;
  /** 'gather' builds up; 'attack' sends the wave; 'regroup' pulls back after a bad fight. */
  mode: 'gather' | 'attack' | 'regroup' = 'gather';
  waveSize: number; waves = 0; target: [number, number] | null = null; scout = 0; scouted = false;
  private home: [number, number] = [0, 0];
  private rally: [number, number] = [0, 0];
  private enemyHome: [number, number] = [0, 0];
  private regroupAt = 0;
  private sitesTried = new Set<number>();
  constructor(diff: Difficulty, opts: AiOpts = {}) {
    this.diff = diff; this.tune = TUNE[diff]; this.opts = opts; this.waveSize = this.tune.wave;
  }
  think(w: World, p: Player) {
    if ((w.tick + p.id * 5) % this.tune.every !== 0) return;
    const hqs = w.buildings.filter((b) => b.owner === p.id && b.def.hq);
    const main = hqs[0] ?? w.buildings.find((b) => b.owner === p.id);
    if (main) this.home = [main.x, main.y];
    this.guessEnemy(w, p);
    const dx = this.enemyHome[0] - this.home[0], dy = this.enemyHome[1] - this.home[1], d = Math.max(1, Math.hypot(dx, dy));
    this.rally = [Math.round(this.home[0] + (dx / d) * tiles(5.5)), Math.round(this.home[1] + (dy / d) * tiles(5.5))];
    const mine = w.units.filter((u) => u.owner === p.id && !w.frozen.has(u.id) && w.flags.get(u.id) !== 'kit');
    const workers = mine.filter((u) => u.def.worker), army = mine.filter((u) => !u.def.worker && u.type !== 'wagon' && u.def.dmg > 0);
    if (!this.opts.noBuild) { this.economy(w, p, workers, hqs); this.construct(w, p, workers, hqs, army); this.produce(w, p, workers, army); }
    if (!this.opts.noArmy) this.command(w, p, army, workers);
    if (this.tune.abilities) this.abilities(w, p, army);
  }

  // ---------------------------------------------------------------- where things are
  private guessEnemy(w: World, p: Player) {
    const mem = w.known.get(p.team)!;
    let best: [number, number] | null = null, bd = Infinity;
    for (const k of mem.values()) {
      const x = (k.tx + k.size / 2) * T, y = (k.ty + k.size / 2) * T, dd = dist(x, y, this.home[0], this.home[1]);
      if (dd < bd) { bd = dd; best = [x, y]; }
    }
    if (best) { this.enemyHome = best; return; }
    if (this.opts.target) { this.enemyHome = this.opts.target; return; }
    // the start furthest from home that has not been seen empty
    let far: [number, number] | null = null, fd = -1;
    const v = w.vis.get(p.team)!;
    for (const [sx, sy] of [...w.starts, ...w.sites]) {
      const x = (sx + 1.5) * T, y = (sy + 1.5) * T;
      const looked = v[(sy + 1) * w.W + sx + 1] > 0 && !w.buildings.some((b) => w.enemies(p.id, b.owner) && dist(b.x, b.y, x, y) < tiles(6));
      if (looked) continue;
      const dd = dist(x, y, this.home[0], this.home[1]);
      if (dd > fd && dd > tiles(10)) { fd = dd; far = [x, y]; }
    }
    this.enemyHome = far ?? [w.W * T / 2, w.H * T / 2];
  }

  // ---------------------------------------------------------------- gatherers
  private economy(w: World, p: Player, workers: Unit[], hqs: Building[]) {
    const homes = hqs.filter((b) => b.done);
    if (!homes.length) return;
    const near = (n: Node) => homes.some((h) => dist(n.x, n.y, h.x, h.y) < tiles(10));
    const nodes = w.nodes.filter(near);
    const load = new Map<number, number>();
    let onGlimmer = 0;
    for (const u of workers) {
      const o = u.order;
      const n = o?.k === 'gather' ? o.n : o?.k === 'return' ? o.resume : 0;
      if (n > 0) load.set(n, (load.get(n) ?? 0) + 1);
      const e = n > 0 ? w.get(n) : null;
      if ((e && e.kind === 'node' && e.res === 'glimmer') || (o?.k === 'return' && u.carryRes === 'glimmer')) onGlimmer++;
    }
    const wantGlimmer = this.opts.glimmer ?? (w.buildings.some((b) => b.owner === p.id && b.def.trains.length && !b.def.hq) ? this.tune.glimmer * Math.max(1, homes.length) : 0);
    for (const u of workers) {
      if (u.order || u.queue.length || u.id === this.scout) continue;
      const res = onGlimmer < wantGlimmer && nodes.some((n) => n.res === 'glimmer') ? 'glimmer' : 'hay';
      let best: Node | null = null, bs = Infinity;
      for (const n of nodes) {
        if (n.res !== res) continue;
        const s = (load.get(n.id) ?? 0) * tiles(6) + dist(u.x, u.y, n.x, n.y);
        if (s < bs) { bs = s; best = n; }
      }
      best ??= w.nearestNode(u, 'hay', u, 40, false);
      if (best) { w.exec({ p: p.id, k: 'gather', ids: [u.id], n: best.id }); load.set(best.id, (load.get(best.id) ?? 0) + 1); if (best.res === 'glimmer') onGlimmer++; }
    }
    // even the load out: workers queueing at a crowded meadow move to a quiet one
    for (const n of nodes) {
      if ((load.get(n.id) ?? 0) <= NODE_SLOTS[n.res] + 1) continue;
      const quiet = nodes.find((m) => m.res === n.res && (load.get(m.id) ?? 0) < NODE_SLOTS[m.res]);
      const u = workers.find((x) => x.order?.k === 'gather' && x.order.n === n.id && !x.carry);
      if (quiet && u) { w.exec({ p: p.id, k: 'gather', ids: [u.id], n: quiet.id }); load.set(quiet.id, (load.get(quiet.id) ?? 0) + 1); load.set(n.id, load.get(n.id)! - 1); }
    }
    // a scout
    if (this.tune.scout && !this.scouted && w.tick > 40 * TICK_HZ && workers.length > 6) {
      const s = workers.find((u) => u.order?.k === 'gather' && !u.carry);
      if (s) { this.scout = s.id; this.scouted = true; w.exec({ p: p.id, k: 'move', ids: [s.id], x: this.enemyHome[0], y: this.enemyHome[1] }); }
    }
    if (this.scout) {
      const s = w.unit(this.scout);
      if (!s) this.scout = 0;
      else if (!s.order || dist(s.x, s.y, this.enemyHome[0], this.enemyHome[1]) < tiles(5)) { this.scout = 0; w.exec({ p: p.id, k: 'stop', ids: [s.id] }); }
    }
  }

  // ---------------------------------------------------------------- building
  private pending(w: World, p: Player, type: string) {
    let n = 0;
    for (const b of w.buildings) if (b.owner === p.id && b.type === type) n++;
    for (const u of w.units) if (u.owner === p.id) for (const o of [u.order, ...u.queue]) if (o?.k === 'build' && !o.site && o.b === type) n++;
    return n;
  }
  private building(w: World, p: Player) {
    return w.units.some((u) => u.owner === p.id && ((u.order?.k === 'build' && !u.order.site) || u.queue.some((o) => o.k === 'build')));
  }
  private construct(w: World, p: Player, workers: Unit[], hqs: Building[], army: Unit[]) {
    const side = SIDES[p.side], plan = PLAN[p.side], t = this.tune;
    if (!hqs.length) {
      // lost every home: rebuild one if it can
      if (workers.length && p.hay >= BUILDINGS[side.hq].hay && !this.pending(w, p, side.hq)) this.place(w, p, workers, side.hq, this.siteFor(w, p, true));
      return;
    }
    if (this.building(w, p)) return;
    const count = (type: string) => this.pending(w, p, type);
    const houses = w.buildings.filter((b) => b.owner === p.id && b.type === side.house && !b.done).length;
    const prodCount = w.buildings.filter((b) => b.owner === p.id && b.def.trains.length && !b.def.hq).length;
    // room first
    if (p.cap < 60 && p.cap - p.used <= 3 + prodCount * 2 && houses === 0 && w.tick > 8 * TICK_HZ) { this.build(w, p, workers, side.house); return; }
    const wk = workers.length, has = (type: string) => w.has(p, type);
    if (count(plan.barracks) === 0 && (wk >= 8 || w.tick > min(1))) { this.build(w, p, workers, plan.barracks); return; }
    if (!has(plan.barracks)) return;
    if (count(plan.tech) === 0 && wk >= (this.diff === 'easy' ? 9 : 12)) { this.build(w, p, workers, plan.tech); return; }
    if (count(plan.barracks) < Math.min(2, t.prods) && wk >= 14) { this.build(w, p, workers, plan.barracks); return; }
    if (p.side === 'hive' && count('spring') === 0 && wk >= 12) { this.build(w, p, workers, 'spring', this.rally); return; }
    if (has(plan.tech)) {
      const lateWanted = Math.max(0, t.prods - 1);
      for (let i = 0; i < Math.min(lateWanted, plan.late.length); i++) if (count(plan.late[i]) === 0) { this.build(w, p, workers, plan.late[i]); return; }
    }
    // plenty of hay and nowhere to spend it: another barracks
    if (p.hay > 450 && count(plan.barracks) < t.prods + 1 + Math.floor(p.hay / 700) && count(plan.barracks) < 6 && wk >= 12) { this.build(w, p, workers, plan.barracks); return; }
    if (t.towers && count(plan.tower) < t.towers && w.tick > min(3)) { this.build(w, p, workers, plan.tower, this.rally); return; }
    // a second home
    if (!this.opts.noExpand && t.expandAt && w.tick > t.expandAt && hqs.length < 2 && wk >= 12) {
      const site = this.siteFor(w, p, false);
      if (site) { this.place(w, p, workers, side.hq, site); return; }
    }
    // the hive keeps a spring near its wave's road
    if (p.side === 'hive' && this.mode === 'attack' && army.length && count('spring') < 4 && w.tick % (this.tune.every * 6) < this.tune.every) {
      const c = this.centre(army);
      if (!w.buildings.some((b) => b.owner === p.id && b.def.spring && dist(b.x, b.y, c[0], c[1]) < tiles(9))) this.build(w, p, workers, 'spring', c, 4);
    }
  }
  /** A free spot for a second (or new) home beside unclaimed meadows. */
  private siteFor(w: World, p: Player, any: boolean): [number, number] | null {
    let best: [number, number] | null = null, bd = Infinity;
    for (const [sx, sy] of [...w.starts, ...w.sites]) {
      const key = sy * 1000 + sx; if (this.sitesTried.has(key) && !any) continue;
      const x = (sx + 1.5) * T, y = (sy + 1.5) * T;
      if (w.buildings.some((b) => dist(b.x, b.y, x, y) < tiles(7))) continue;
      if (!w.nodes.some((n) => dist(n.x, n.y, x, y) < tiles(8))) continue;
      if (!w.canPlace(p.id, SIDES[p.side].hq, sx, sy, false)) continue;
      const d = dist(x, y, this.home[0], this.home[1]) + (any ? 0 : dist(x, y, this.enemyHome[0], this.enemyHome[1]) < dist(x, y, this.home[0], this.home[1]) ? tiles(40) : 0);
      if (d < bd) { bd = d; best = [sx, sy]; }
    }
    if (best) this.sitesTried.add(best[1] * 1000 + best[0]);
    return best ? [best[0], best[1]] : null;
  }
  private build(w: World, p: Player, workers: Unit[], type: string, near?: [number, number], reach = 3) {
    const def = BUILDINGS[type];
    if (p.hay < def.hay || p.glimmer < def.glimmer || !w.reqMet(p, def)) return;
    const spot = this.spot(w, p, type, near, reach);
    if (spot) this.place(w, p, workers, type, spot);
  }
  private place(w: World, p: Player, workers: Unit[], type: string, at: [number, number] | null) {
    if (!at) return;
    const ready = workers.filter((u) => u.id !== this.scout && (!u.order || u.order.k === 'gather' || u.order.k === 'return'));
    if (!ready.length) return;
    const cx = (at[0] + 1) * T, cy = (at[1] + 1) * T;
    let best = ready[0], bd = Infinity;
    for (const u of ready) { const d = dist(u.x, u.y, cx, cy) + (u.carry ? tiles(3) : 0); if (d < bd) { bd = d; best = u; } }
    w.exec({ p: p.id, k: 'build', ids: [best.id], b: type, tx: at[0], ty: at[1] });
  }
  /** A tidy spot round home (or `near`), clear of meadows and with a lane left round it. */
  private spot(w: World, p: Player, type: string, near?: [number, number], reach = 3): [number, number] | null {
    const s = BUILDINGS[type].size;
    const cx = Math.floor((near ? near[0] : this.home[0]) / T), cy = Math.floor((near ? near[1] : this.home[1]) / T);
    const roll = Math.floor(w.rand() * 8);
    for (let r = near ? 0 : reach; r <= 14; r++) {
      const ring: [number, number][] = [];
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.max(Math.abs(i), Math.abs(j)) === r) ring.push([cx + i - (s >> 1), cy + j - (s >> 1)]);
      for (let k = 0; k < ring.length; k++) {
        const [tx, ty] = ring[(k + roll * Math.max(1, r)) % ring.length];
        if (!w.canPlace(p.id, type, tx, ty, false)) continue;
        if (!this.roomy(w, tx, ty, s)) continue;
        return [tx, ty];
      }
    }
    return null;
  }
  private roomy(w: World, tx: number, ty: number, s: number) {
    for (let j = ty - 1; j <= ty + s; j++) for (let i = tx - 1; i <= tx + s; i++) {
      if (i < 0 || j < 0 || i >= w.W || j >= w.H) return false;
      const k = j * w.W + i; if (w.occ[k]) return false;
    }
    for (const n of w.nodes) if (Math.max(n.tx - (tx + s - 1), tx - (n.tx + 1), 0) < 3 && Math.max(n.ty - (ty + s - 1), ty - (n.ty + 1), 0) < 3) return false;
    // keep the way between a home and its meadows open
    for (const b of w.buildings) if (b.def.hq) {
      for (const n of w.nodes) {
        if (dist(n.x, n.y, b.x, b.y) > tiles(9)) continue;
        const mx = (n.x + b.x) / 2 / T, my = (n.y + b.y) / 2 / T;
        if (mx > tx - 1.5 && mx < tx + s + 1.5 && my > ty - 1.5 && my < ty + s + 1.5) return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- training
  private produce(w: World, p: Player, workers: Unit[], army: Unit[]) {
    const side = SIDES[p.side], plan = PLAN[p.side];
    const mine = w.buildings.filter((b) => b.owner === p.id && b.done);
    const armySupply = army.reduce((s, u) => s + u.def.supply, 0);
    // gatherers
    const wantWorkers = Math.min(this.tune.workers * Math.max(1, mine.filter((b) => b.def.hq).length > 1 ? 1.4 : 1), 30);
    const queuedWorkers = mine.reduce((s, b) => s + b.queue.filter((q) => q.id === side.worker).length, 0);
    for (const b of mine) if (b.def.hq && b.queue.length === 0 && workers.length + queuedWorkers < wantWorkers && p.used < p.cap) { if (w.exec({ p: p.id, k: 'train', bid: b.id, u: side.worker })) break; }
    // upgrades when the bank is healthy
    if (this.tune.upgrades && armySupply >= 8) for (const b of mine) for (const up of b.def.research) {
      const U = UPGRADES[up];
      if (p.ups[up] === undefined && b.queue.length === 0 && p.hay >= U.hay + 100 && p.glimmer >= U.glimmer) { w.exec({ p: p.id, k: 'research', bid: b.id, up }); break; }
    }
    if (this.opts.armyCap !== undefined && armySupply >= this.opts.armyCap) return;
    // the army: whichever kind is furthest below its share of the mix
    const have: Record<string, number> = {};
    for (const u of army) have[u.type] = (have[u.type] ?? 0) + 1;
    for (const b of mine) for (const q of b.queue) if (q.k === 'unit') have[q.id] = (have[q.id] ?? 0) + 1;
    const total = Object.values(have).reduce((s, n) => s + n, 0) + 1;
    for (const b of mine) {
      if (!b.def.trains.length || b.def.hq || b.queue.length > (p.hay > 300 ? 1 : 0)) continue;
      const opts = b.def.trains.filter((id) => plan.mix[id] !== undefined && (!UNITS[id].limit || w.countOf(p.id, id) < UNITS[id].limit!));
      if (!opts.length) continue;
      const weight = Object.entries(plan.mix).filter(([id]) => this.canMake(w, p, id)).reduce((s, [, v]) => s + v, 0);
      opts.sort((a, c) => (have[a] ?? 0) / total - plan.mix[a] / weight - ((have[c] ?? 0) / total - plan.mix[c] / weight));
      for (const id of opts) {
        const d = UNITS[id];
        // save up for the dear ones rather than spend the glimmer elsewhere
        if (p.hay < d.hay || p.glimmer < d.glimmer) { if (d.glimmer > 0 && p.glimmer < d.glimmer) continue; break; }
        if (p.used + d.supply > p.cap) break;
        if (w.exec({ p: p.id, k: 'train', bid: b.id, u: id })) break;
      }
    }
    // rally points: everyone meets in front of home
    for (const b of mine) if (b.def.trains.length && !b.def.hq && (!b.rally || this.waves === 0 && w.tick % 600 === 0)) w.exec({ p: p.id, k: 'rally', bids: [b.id], x: this.rally[0], y: this.rally[1] });
  }
  private canMake(w: World, p: Player, id: string) { return w.buildings.some((b) => b.owner === p.id && b.done && b.def.trains.includes(id)); }

  // ---------------------------------------------------------------- the army
  private centre(us: Unit[]): [number, number] {
    let x = 0, y = 0; for (const u of us) { x += u.x; y += u.y; }
    return [Math.round(x / us.length), Math.round(y / us.length)];
  }
  private command(w: World, p: Player, army: Unit[], workers: Unit[]) {
    if (!army.length) { this.mode = 'gather'; return; }
    const ids = (us: Unit[]) => us.map((u) => u.id);
    const team = p.team;
    // ---- trouble at home?
    const mineB = w.buildings.filter((b) => b.owner === p.id);
    let threat: Unit | null = null;
    for (const e of w.units) {
      if (!w.enemies(p.id, e.owner) || e.under || !w.seen(team, e.x, e.y)) continue;
      if (mineB.some((b) => dist(b.x, b.y, e.x, e.y) < tiles(9))) { threat = e; break; }
    }
    if (threat && this.mode !== 'attack') {
      const t = threat;
      // tunnel the far-off ones home
      if (p.side === 'colony') {
        const mouths = w.buildings.filter((b) => b.owner === p.id && b.done && b.def.tunnel);
        const nearT = mouths.sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y))[0];
        const far = army.filter((u) => !u.def.air && dist(u.x, u.y, t.x, t.y) > tiles(20) && mouths.some((m) => m !== nearT && w.gap(u, m) < tiles(TUNNEL_REACH)));
        if (nearT && far.length) w.exec({ p: p.id, k: 'tunnel', ids: ids(far), t: nearT.id });
      }
      const free = army.filter((u) => !u.target && u.order?.k !== 'tunnel');
      if (free.length) w.exec({ p: p.id, k: 'amove', ids: ids(free), x: t.x, y: t.y });
      // gatherers next to the trouble bump back when it is just a scout
      const visitors = w.units.filter((e) => w.enemies(p.id, e.owner) && dist(e.x, e.y, t.x, t.y) < tiles(6)).length;
      if (visitors <= 2 && army.length < 3) { const near = workers.filter((u) => dist(u.x, u.y, t.x, t.y) < tiles(6)).slice(0, 4); if (near.length) w.exec({ p: p.id, k: 'attack', ids: ids(near), t: t.id }); }
      return;
    }
    const supply = army.reduce((s, u) => s + u.def.supply, 0);
    // waves are judged by what the army is worth, so cheap swarms and dear tanks set off at the same strength
    const worth = army.reduce((s, u) => s + u.def.hay + u.def.glimmer * 2, 0) / 60;
    if (this.mode === 'regroup') {
      if (w.tick - this.regroupAt > 30 * TICK_HZ) this.mode = 'gather';
      else return;
    }
    if (this.mode === 'gather') {
      const idle = army.filter((u) => !u.order && !u.target && dist(u.x, u.y, this.rally[0], this.rally[1]) > tiles(5));
      if (idle.length) w.exec({ p: p.id, k: 'amove', ids: ids(idle), x: this.rally[0], y: this.rally[1] });
      const ready = w.tick >= this.tune.firstWave + (this.opts.delay ?? 0) || worth >= this.waveSize * 2;
      if (!this.opts.passive && ready && (worth >= this.waveSize || p.used >= p.cap - 1 && p.cap >= 56)) {
        this.mode = 'attack'; this.waves++; this.waveSize += this.tune.waveGrow;
        this.target = this.enemyHome;
        w.exec({ p: p.id, k: 'amove', ids: ids(army), x: this.target[0], y: this.target[1] });
      }
      return;
    }
    // ---- attacking
    const c = this.centre(army);
    if (this.tune.retreat) {
      let ours = 0, theirs = 0;
      for (const u of army) if (dist(u.x, u.y, c[0], c[1]) < tiles(10)) ours += strength(u);
      for (const e of w.units) if (w.enemies(p.id, e.owner) && !e.under && w.seen(team, e.x, e.y) && dist(e.x, e.y, c[0], c[1]) < tiles(11)) theirs += strength(e);
      for (const b of w.buildings) if (b.def.tower && b.done && w.enemies(p.id, b.owner) && dist(b.x, b.y, c[0], c[1]) < tiles(11)) theirs += Math.sqrt(b.hp * b.def.tower.dmg / b.def.tower.cd);
      if (theirs > ours * (this.diff === 'hard' ? 1.35 : 1.6) && ours > 0) {
        this.mode = 'regroup'; this.regroupAt = w.tick;
        w.exec({ p: p.id, k: 'move', ids: ids(army), x: this.rally[0], y: this.rally[1] });
        return;
      }
    }
    // whittled down to nothing much: go home and build up again
    if (worth < Math.max(4, this.waveSize / 4) && !this.opts.passive) {
      this.mode = 'gather';
      w.exec({ p: p.id, k: 'move', ids: ids(army), x: this.rally[0], y: this.rally[1] });
      return;
    }
    const tgt = this.target ?? this.enemyHome;
    if (dist(c[0], c[1], tgt[0], tgt[1]) < tiles(5) || !this.target) this.target = this.enemyHome;
    const idle = army.filter((u) => !u.order && !u.target);
    if (idle.length) w.exec({ p: p.id, k: 'amove', ids: ids(idle), x: this.target[0], y: this.target[1] });
    // new arrivals join in
    const late = army.filter((u) => u.order?.k === 'amove' && dist(u.order.x, u.order.y, this.rally[0], this.rally[1]) < tiles(2));
    if (late.length) w.exec({ p: p.id, k: 'amove', ids: ids(late), x: this.target[0], y: this.target[1] });
  }

  // ---------------------------------------------------------------- abilities
  private abilities(w: World, p: Player, army: Unit[]) {
    const foes = (x: number, y: number, r: number) => w.units.filter((e) => w.enemies(p.id, e.owner) && !e.under && w.seen(p.team, e.x, e.y) && dist(e.x, e.y, x, y) <= r);
    for (const u of army) {
      if (u.abCd > 0 || !u.def.ability) continue;
      const A = ABILITIES[u.def.ability];
      if (u.def.ability === 'cloud' || u.def.ability === 'shiny') {
        const near = foes(u.x, u.y, tiles(A.range + 1)).filter((e) => !e.def.air);
        const c = near.length >= 3 ? this.centre(near) : null;
        if (c && !w.clouds.some((k) => k.owner === p.id && dist(k.x, k.y, c[0], c[1]) < tiles(4))) { w.exec({ p: p.id, k: 'ability', ids: [u.id], ab: u.def.ability, x: c[0], y: c[1] }); }
      } else if (u.def.ability === 'snare') {
        const near = foes(u.x, u.y, tiles(5)).filter((e) => !e.def.air);
        if (near.length) {
          const e = near[0], d = Math.max(1, dist(u.x, u.y, e.x, e.y)), k = Math.min(tiles(A.range) - T / 2, d);
          w.exec({ p: p.id, k: 'ability', ids: [u.id], ab: 'snare', x: Math.round(u.x + ((e.x - u.x) * k) / d), y: Math.round(u.y + ((e.y - u.y) * k) / d) });
        } else if (!u.order && dist(u.x, u.y, this.rally[0], this.rally[1]) < tiles(4) && w.traps.filter((t) => t.owner === p.id).length < 4) {
          const a = w.rand() * Math.PI * 2;
          w.exec({ p: p.id, k: 'ability', ids: [u.id], ab: 'snare', x: Math.round(u.x + Math.cos(a) * tiles(2)), y: Math.round(u.y + Math.sin(a) * tiles(2)) });
        }
      } else if (u.def.ability === 'song' || u.def.ability === 'firm') {
        if (foes(u.x, u.y, tiles(6)).length >= 2) w.exec({ p: p.id, k: 'ability', ids: [u.id], ab: u.def.ability });
      } else if (u.def.ability === 'brood') {
        if (foes(u.x, u.y, tiles(8)).length >= 2 && p.used + 2 <= p.cap) w.exec({ p: p.id, k: 'ability', ids: [u.id], ab: 'brood' });
      }
    }
    if (p.side === 'hive') for (const b of w.buildings) {
      if (b.owner !== p.id || b.def.ability !== 'overwind' || !b.done || b.abCd > 0) continue;
      const friends = army.filter((u) => dist(u.x, u.y, b.x, b.y) <= tiles(7));
      if (friends.length >= 5 && foes(b.x, b.y, tiles(12)).length >= 3) w.exec({ p: p.id, k: 'ability', ids: [b.id], ab: 'overwind' });
    }
  }
}

/** A skirmish: you (or a computer) against a computer on one of the maps. */
export function skirmish(opts: { map: import('./command-game.js').MapDef; seed: number; sides: [SideId, SideId]; ai: [Difficulty | null, Difficulty | null]; fog?: boolean; limit?: number }) {
  return { map: opts.map, seed: opts.seed, fog: opts.fog, limit: opts.limit, slots: opts.sides.map((side, i) => ({ side, team: i, ai: opts.ai[i] })) };
}
export function attachBrains(w: World, opts: AiOpts[] = []) {
  w.players.forEach((p, i) => { if (p.ai) w.brains[i] = new Computer(p.ai, opts[i] ?? {}); });
  return w;
}
