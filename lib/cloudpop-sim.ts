// Cloudpop: combat, one fixed step at a time. Puffs drift (slowed, frozen, chilled, burning, regrowing), towers
// pick targets by their priority and attack (shots with pierce, lobbed splashes, sound and frost pulses, beams,
// strikes, grabs), and damage pops puffs layer by layer into their children. Pure and deterministic.
import { PUFFS, canHurt, shellHp, REGROW_NEXT, RANK, REGROW_EVERY, BASE_SPEED, type DType } from './cloudpop-puffs.js';
import { roadAt, blocked } from './cloudpop-maps.js';
import { popCash, speedScale, bossScale } from './cloudpop-rounds.js';
import type { Game, Puff, Tower, Proj } from './cloudpop-game.js';
import type { Atk } from './cloudpop-towers.js';

const isBoss = (p: Puff) => PUFFS[p.kind].boss === true;

/** deal damage; returns the ids of any new sibling puffs born from the pop (so a shot doesn't hit them too) */
export function damage(g: Game, p: Puff, amt: number, dtype: DType, src: Tower | null, bossMult: number, brittleOk = true): number[] {
  if (p.dead || amt <= 0) return [];
  if (!canHurt(p.kind, dtype)) { g.emit({ t: 'clink', x: p.x, y: p.y }); return []; }
  if (isBoss(p)) amt *= bossMult;
  if (brittleOk && p.brittle > 0 && (p.frozenT > 0 || p.stunT > 0)) amt += p.brittle;
  p.lastHit = g.t;
  p.hp -= amt;
  if (src) src.dmg += amt;
  const born: number[] = [];
  let guard = 0;
  while (p.hp <= 1e-6 && !p.dead && guard++ < 40) {
    const over = -p.hp;
    // one layer popped
    const pc = popCash(g.round);
    g.cash += pc; g.stats.cashEarned += pc; g.stats.pops++;
    if (src) { src.pops++; const k = src.def; g.stats.towerXp[k] = (g.stats.towerXp[k] ?? 0) + 1; }
    if (g.cfg.hero && g.hero()) g.gainHeroXp(0.6 * g.perks.heroXpMul);
    const def = PUFFS[p.kind];
    if (def.boss) g.stats.bossPops++;
    g.emit({ t: 'pop', x: p.x, y: p.y, kind: p.kind, big: def.hp > 1 });
    const kids = def.children;
    if (!kids.length) { p.dead = true; break; }
    const bs = bossScale(g.round);
    for (let i = 1; i < kids.length; i++) {
      const c = g.spawnPuff(kids[i], p.road, Math.max(0, p.d - i * (def.boss ? 22 : 9)), p.night, p.fog, p.fort, p.fogTop);
      c.slowMul = p.slowMul; c.slowT = p.slowT * 0.5;
      c.hp -= def.boss ? 0 : over;
      born.push(c.id);
      if (c.hp <= 1e-6) damage(g, c, 0.000001, 'magic', src, 1, false);
    }
    p.kind = kids[0]; p.hp = shellHp(kids[0], p.fort, bs) - (def.boss ? 0 : over);
    p.frozenT = 0; p.stunT = Math.min(p.stunT, 0.2);
  }
  return born;
}

function inRange(o: { x: number; y: number }, p: Puff, r: number) {
  const dx = p.x - o.x, dy = p.y - o.y, rr = r + PUFFS[p.kind].r * 0.6;
  return dx * dx + dy * dy <= rr * rr;
}
function pick(g: Game, t: Tower, a: Atk, ox: number, oy: number, range: number, filter?: (p: Puff) => boolean): Puff | null {
  const sight = g.sees(t);
  let best: Puff | null = null, bv = -Infinity;
  for (const p of g.puffs) {
    if (p.dead || (p.night && !sight) || !inRange({ x: ox, y: oy }, p, range)) continue;
    if (filter && !filter(p)) continue;
    if (!a.arc && g.map.blockers.length && blocked(g.map, ox, oy, p.x, p.y)) continue;
    let v: number;
    switch (t.target) {
      case 'first': v = p.d; break;
      case 'last': v = -p.d; break;
      case 'strong': v = RANK[p.kind] * 1e5 + p.d; break;
      default: v = -Math.hypot(p.x - ox, p.y - oy);
    }
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}

function applyHit(g: Game, t: Tower, a: Atk, p: Puff, dmgAdd: number, bossAdd: number): number[] {
  if (p.dead) return [];
  const boss = isBoss(p);
  if (a.slow && (!boss || a.slowBoss) && !(PUFFS[p.kind].noChill && a.dtype === 'cold')) {
    p.slowMul = Math.min(p.slowMul < 1 && p.slowT > 0 ? p.slowMul : 1, a.slow[0]); p.slowT = Math.max(p.slowT, a.slow[1]); p.slowBoss = boss;
  }
  if (a.dot > 0 && (!boss || a.dotBoss)) { p.dot = Math.max(p.dot, a.dot); p.dotBy = t.id; p.dotBoss = a.dotBoss; if (!a.slow) p.slowT = Math.max(p.slowT, 3); }
  if (a.freeze > 0 && !PUFFS[p.kind].noChill) p.frozenT = Math.max(p.frozenT, boss ? a.freezeBoss : a.freeze);
  if (a.brittle) p.brittle = Math.max(p.brittle, a.brittle);
  if (a.stun > 0) p.stunT = Math.max(p.stunT, boss ? a.stunBoss : a.stun);
  if (a.burn && canHurt(p.kind, 'fire')) { p.burnDps = Math.max(p.burnDps, a.burn[0]); p.burnT = Math.max(p.burnT, a.burn[1]); p.burnBy = t.id; }
  if (a.stripNight) p.night = false;
  if (a.stripFog) p.fog = false;
  if (a.knock > 0) { const k = boss ? a.knock * a.knockBoss : (RANK[p.kind] >= 9 && a.knockBoss === 0 && a.knock < 100 ? a.knock * 0.5 : a.knock); p.d = Math.max(0, p.d - k); }
  let dmg = a.dmg > 0 ? a.dmg + dmgAdd : 0;
  if (dmg > 0 && p.fog && a.fogMult > 1) dmg *= a.fogMult;
  if (dmg <= 0) return [];
  return damage(g, p, dmg, a.dtype, t, a.bossMult + bossAdd);
}

function fireAtk(g: Game, t: Tower, ai: number, a: Atk, ox: number, oy: number, range: number, pierce: number, dmgAdd: number, bossAdd: number): boolean {
  const filt = a.kind === 'grab' ? (p: Puff) => (isBoss(p) ? a.grabBoss && RANK[p.kind] <= 12 : RANK[p.kind] <= a.grabRank) : undefined;
  const target = pick(g, t, a, ox, oy, range, filt);
  if (!target) return false;
  t.lastAtk = g.t; t.lastAtkId = a.id; t.aimX = target.x; t.aimY = target.y;
  g.emit({ t: 'atk', tower: t.id, atk: a.id, x: ox, y: oy, tx: target.x, ty: target.y, kind: a.kind });
  const sightAll = g.sees(t);
  switch (a.kind) {
    case 'pulse': {
      const hit = g.puffs.filter(p => !p.dead && inRange({ x: ox, y: oy }, p, range)).sort((p, q) => q.d - p.d).slice(0, pierce);
      for (const p of hit) applyHit(g, t, a, p, dmgAdd, bossAdd);
      break;
    }
    case 'beam': {
      const ang = Math.atan2(target.y - oy, target.x - ox), cx = Math.cos(ang), cy = Math.sin(ang);
      const hit = g.puffs.filter(p => {
        if (p.dead || (p.night && !sightAll)) return false;
        const px = p.x - ox, py = p.y - oy, along = px * cx + py * cy, side = Math.abs(-px * cy + py * cx);
        return along > -10 && along < range + 20 && side < 24 + PUFFS[p.kind].r * 0.6;
      }).sort((p, q) => q.d - p.d).slice(0, pierce);
      for (const p of hit) applyHit(g, t, a, p, dmgAdd, bossAdd);
      break;
    }
    case 'strike': {
      if (a.splash > 0) {
        const tx = target.x, ty = target.y;
        const hit = g.puffs.filter(p => !p.dead && Math.hypot(p.x - tx, p.y - ty) < a.splash + PUFFS[p.kind].r * 0.5).slice(0, pierce);
        for (const p of hit) applyHit(g, t, a, p, dmgAdd, bossAdd);
      } else applyHit(g, t, a, target, dmgAdd, bossAdd);
      break;
    }
    case 'grab': {
      const front = g.puffs.filter(p => !p.dead && (!p.night || sightAll) && inRange({ x: ox, y: oy }, p, range) && filt!(p)).sort((p, q) => RANK[q.kind] - RANK[p.kind] || q.d - p.d).slice(0, pierce);
      for (const p of front) { p.d = isBoss(p) ? Math.max(0, p.d - 900) : 0; p.stunT = Math.max(p.stunT, 0.8); g.emit({ t: 'ability', id: 'lift', x: p.x, y: p.y }); }
      break;
    }
    case 'shot': case 'lob': {
      const base = Math.atan2(target.y - oy, target.x - ox);
      for (let k = 0; k < a.count; k++) {
        const off = a.count > 1 ? (k / (a.count - 1) - 0.5) * a.spread : 0;
        const ang = base + off;
        const pr: Proj = {
          id: g.nextId++, kind: a.kind, x: ox, y: oy, vx: Math.cos(ang) * a.speed, vy: Math.sin(ang) * a.speed,
          life: a.kind === 'shot' ? (range * 1.35 + 40) / a.speed : 3, tower: t.id, atk: ai, pierce, bounce: a.bounce, hits: [], target: target.id,
          tx: target.x + Math.cos(ang) * 0, ty: target.y, sx: ox, sy: oy, t: 0, T: 0, art: '',
        };
        if (a.kind === 'lob') {
          const dist = Math.hypot(target.x - ox, target.y - oy);
          const lead = Math.min(60, PUFFS[target.kind].speed * BASE_SPEED * 0.25);
          const [lx, ly] = roadAt(g.roads[target.road], target.d + lead * 0.5);
          pr.tx = (a.count > 1 ? lx + Math.cos(ang) * 30 * off : lx); pr.ty = a.count > 1 ? ly + Math.sin(ang) * 30 * off : ly;
          pr.T = Math.max(0.15, dist / a.speed);
        }
        g.projs.push(pr);
      }
      break;
    }
  }
  return true;
}

// spatial grid for shot collisions
const CELL = 64;
let grid = new Map<number, Puff[]>();
function buildGrid(g: Game) {
  grid = new Map();
  for (const p of g.puffs) {
    if (p.dead || isBoss(p)) continue;
    const k = ((p.x / CELL) | 0) * 1000 + ((p.y / CELL) | 0);
    let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(p);
  }
}
function near(g: Game, x: number, y: number, out: Puff[]) {
  out.length = 0;
  const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = grid.get((cx + i) * 1000 + cy + j); if (a) for (const p of a) out.push(p); }
  for (const p of g.puffs) if (isBoss(p) && !p.dead) out.push(p);
  return out;
}
const tmp: Puff[] = [];

function stepProjs(g: Game, dt: number) {
  buildGrid(g);
  const keep: Proj[] = [];
  const byId = new Map(g.towers.map(t => [t.id, t]));
  for (const pr of g.projs) {
    const t = byId.get(pr.tower);
    const a = t?.s.atks[pr.atk];
    if (!t || !a) continue;
    if (pr.kind === 'lob') {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.T);
      pr.x = pr.sx + (pr.tx - pr.sx) * k; pr.y = pr.sy + (pr.ty - pr.sy) * k;
      if (k >= 1) {
        const hit = g.puffs.filter(p => !p.dead && Math.hypot(p.x - pr.tx, p.y - pr.ty) < Math.max(a.splash, 14) + PUFFS[p.kind].r * 0.6).sort((p, q) => q.d - p.d).slice(0, pr.pierce);
        for (const p of hit) applyHit(g, t, a, p, t.buff.dmg, t.buff.boss);
        for (let s = 0; s < a.shards; s++) {
          const ang = s / a.shards * Math.PI * 2;
          g.projs.push({ id: g.nextId++, kind: 'shard', x: pr.tx, y: pr.ty, vx: Math.cos(ang) * 600, vy: Math.sin(ang) * 600, life: 0.22, tower: t.id, atk: pr.atk, pierce: 2, bounce: 0, hits: [], target: 0, tx: 0, ty: 0, sx: 0, sy: 0, t: 0, T: 0, art: 'shard' });
        }
        g.emit({ t: 'atk', tower: t.id, atk: 'land', x: pr.tx, y: pr.ty, tx: pr.tx, ty: pr.ty, kind: 'land' });
        continue;
      }
      keep.push(pr); continue;
    }
    // straight shots and shards
    if (a.homing && pr.kind === 'shot') {
      let tg = g.puffs.find(p => p.id === pr.target && !p.dead);
      if (!tg) { tg = pick(g, t, a, pr.x, pr.y, 260) ?? undefined; if (tg) pr.target = tg.id; }
      if (tg) {
        const sp = Math.hypot(pr.vx, pr.vy), ang = Math.atan2(pr.vy, pr.vx), want = Math.atan2(tg.y - pr.y, tg.x - pr.x);
        let da = want - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const na = ang + Math.max(-8 * dt, Math.min(8 * dt, da));
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(pr.vx, pr.vy) * dt / 14));
    let alive = true;
    for (let s = 0; s < steps && alive; s++) {
      pr.x += pr.vx * dt / steps; pr.y += pr.vy * dt / steps;
      if (pr.kind === 'shot' && !a.arc && g.map.blockers.length) {
        for (const [cx, cy, r] of g.map.blockers) if ((pr.x - cx) ** 2 + (pr.y - cy) ** 2 < r * r * 0.7) { alive = false; break; }
        if (!alive) break;
      }
      for (const p of near(g, pr.x, pr.y, tmp)) {
        if (p.dead || pr.hits.includes(p.id)) continue;
        if (p.night && !g.sees(t) && pr.kind === 'shot') continue;
        const rr = PUFFS[p.kind].r + 7;
        if ((p.x - pr.x) ** 2 + (p.y - pr.y) ** 2 > rr * rr) continue;
        pr.hits.push(p.id);
        const shardA = pr.kind === 'shard' ? { ...a, dmg: a.shardDmg, dtype: a.dtype === 'fire' ? 'fire' as const : 'light' as const, slow: null, burn: a.burn, knock: 0, stun: 0, freeze: 0, dot: 0 } : a;
        const born = applyHit(g, t, shardA, p, t.buff.dmg, t.buff.boss);
        pr.hits.push(...born);
        if (!p.dead) pr.hits.push(p.id);
        if (a.splash > 0 && pr.kind === 'shot') {
          for (const q of g.puffs) if (!q.dead && q !== p && !pr.hits.includes(q.id) && Math.hypot(q.x - p.x, q.y - p.y) < a.splash) { pr.hits.push(q.id); applyHit(g, t, a, q, t.buff.dmg, t.buff.boss); }
        }
        pr.pierce--;
        if (pr.pierce <= 0) { alive = false; break; }
        if (pr.bounce > 0) {
          pr.bounce--;
          let nb: Puff | null = null, nd = 170;
          for (const q of g.puffs) {
            if (q.dead || pr.hits.includes(q.id) || (q.night && !g.sees(t))) continue;
            const d = Math.hypot(q.x - pr.x, q.y - pr.y); if (d < nd) { nd = d; nb = q; }
          }
          if (nb) { const sp = Math.hypot(pr.vx, pr.vy), an = Math.atan2(nb.y - pr.y, nb.x - pr.x); pr.vx = Math.cos(an) * sp; pr.vy = Math.sin(an) * sp; pr.life = Math.max(pr.life, 0.4); }
        }
        break;
      }
    }
    pr.life -= dt;
    if (alive && pr.life > 0 && pr.x > -50 && pr.y > -50 && pr.x < 1600 && pr.y < 1080) keep.push(pr);
  }
  // shards pushed during the loop were visited by it too (for-of sees appended items)
  g.projs = keep;
}

export function simTick(g: Game, dt: number) {
  // timers
  if (g.floodT > 0) g.floodT -= dt;
  if (g.rallyAllT > 0) g.rallyAllT -= dt;
  const spd = speedScale(g.round);
  // chill fields
  const chillers = g.towers.filter(t => t.s.chill);
  // move puffs
  for (const p of g.puffs) {
    if (p.dead) continue;
    const def = PUFFS[p.kind], boss = def.boss === true;
    if (p.frozenT > 0) p.frozenT -= dt;
    if (p.stunT > 0) p.stunT -= dt;
    if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) { p.slowMul = 1; p.dot = 0; } }
    let m = 1;
    if (p.slowT > 0 && (!boss || p.slowBoss)) m = Math.min(m, p.slowMul);
    if (g.floodT > 0) m = Math.min(m, g.floodMul);
    for (const c of chillers) {
      const [cm, cr] = c.s.chill!;
      if (def.noChill && !c.s.chillFrost) continue;
      if ((p.x - c.x) ** 2 + (p.y - c.y) ** 2 > cr * cr) continue;
      m = Math.min(m, boss ? Math.max(cm, c.s.chillBoss) : cm);
    }
    if (p.frozenT > 0 || p.stunT > 0) m = 0;
    p.d += BASE_SPEED * def.speed * spd * m * dt;
    const road = g.roads[p.road];
    if (p.d >= road.len) { p.dead = true; g.leak(p); continue; }
    const [x, y] = roadAt(road, p.d); p.x = x; p.y = y;
    // damage over time
    if (p.burnT > 0) {
      p.burnT -= dt; p.acc += p.burnDps * dt;
      if (p.acc >= 1) { const n = Math.floor(p.acc); p.acc -= n; damage(g, p, n, 'fire', g.towers.find(t => t.id === p.burnBy) ?? null, 1, false); }
    }
    if (p.dot > 0 && p.slowT > 0 && !p.dead) {
      p.acc += p.dot * dt;
      if (p.acc >= 1) { const n = Math.floor(p.acc); p.acc -= n; damage(g, p, n, 'magic', g.towers.find(t => t.id === p.dotBy) ?? null, 1, false); }
    }
    if (g.floodDot > 0 && g.floodT > 0 && !p.dead && Math.floor((g.t) * 2) !== Math.floor((g.t - dt) * 2)) damage(g, p, g.floodDot, 'magic', null, 1, false);
    // fog regrows
    if (p.fog && !p.dead && g.t - p.lastHit > REGROW_EVERY) {
      const nx = REGROW_NEXT[p.kind];
      if (nx && RANK[nx] <= RANK[p.fogTop]) { p.kind = nx; p.hp = shellHp(nx, p.fort); }
      p.lastHit = g.t;
    }
  }
  g.puffs = g.puffs.filter(p => !p.dead);
  // towers
  for (const t of g.towers) {
    if (t.frenzyT > 0) t.frenzyT -= dt;
    if (t.rallyT > 0) t.rallyT -= dt;
    for (let i = 0; i < t.abilityCd.length; i++) if (t.abilityCd[i] > 0 && g.active) t.abilityCd[i] -= dt;
    // fliers patrol
    let ox = t.x, oy = t.y;
    if (t.s.patrol > 0) {
      t.fa += dt * 1.1;
      let cx = t.x, cy = t.y;
      if (t.s.hunt) {
        const front = g.puffs.reduce<Puff | null>((b, p) => (!p.dead && Math.hypot(p.x - t.x, p.y - t.y) < t.s.patrol * 3 + 120 && (!b || p.d > b.d) ? p : b), null);
        if (front) { cx = front.x; cy = front.y; }
      }
      const tx = cx + Math.cos(t.fa) * t.s.patrol * (t.s.hunt ? 0.5 : 1), ty = cy + Math.sin(t.fa) * t.s.patrol * (t.s.hunt ? 0.35 : 0.7);
      const dx = tx - t.fx, dy = ty - t.fy, dl = Math.hypot(dx, dy), mv = Math.min(dl, 260 * dt);
      if (dl > 0.1) { t.fx += dx / dl * mv; t.fy += dy / dl * mv; }
      ox = t.fx; oy = t.fy;
    }
    const rateMul = t.buff.rate * (t.frenzyT > 0 ? t.frenzyMul : 1) * (t.rallyT > 0 ? t.rallyMul : 1) * (g.rallyAllT > 0 ? g.rallyAllMul : 1);
    for (let i = 0; i < t.s.atks.length; i++) {
      const a = t.s.atks[i];
      if (t.cd[i] > 0) t.cd[i] -= dt;
      if (t.cd[i] > 0) continue;
      const range = a.range * t.buff.range;
      const fired = fireAtk(g, t, i, a, a.kind === 'strike' && a.id === 'dive' ? ox : ox, oy, range, a.pierce + t.buff.pierce, t.buff.dmg, t.buff.boss);
      if (fired) t.cd[i] += a.rate * rateMul; else t.cd[i] = 0;
    }
  }
  stepProjs(g, dt);
}
