// Cubby Valley bot: plays Story valleys with the night's monsters ON, start to summer fair, through the engine with
// real walking (paths, hops, swimming), held digging, the workbench, placing, and its own bonk-stick reflexes. It must
// welcome all six neighbours (every errand chain: bring, catch, plant, lanterns, monster drops, burrows) and survive
// the nights. `--quick` plays one valley (part of `npm test`); without it, two.
import assert from 'node:assert/strict';
import { CubbyGame, findPath, standable, solidTop, NO_INPUT, DAY, MAX_HP } from '../.checks/cubby-game.js';
import { BLOCKS, BLOCK_BY_KEY as BK, W, D, H, idx, WATER } from '../.checks/cubby-world.js';
import { RECIPE, NEIGHBOURS, CRITTERS } from '../.checks/cubby-content.js';

const quick = process.argv.includes('--quick');
const seeds = quick ? [11] : [11, 2024];
const DT = 1 / 15;

/** Where each raw thing comes from: blocks to dig (in order of preference) or creatures to bonk. */
const SOURCES = {
  berries: ['berrybush'], hay: ['tallgrass'], fluff: ['cotton'], log: ['log'], stone: ['stone'], clay: ['clay'], iron: ['ironstone'],
  crystal: ['crystal'], daisy: ['daisy'], bluebell: ['bluebell'], sapling: ['leaves'], soil: ['turf', 'soil'], pebbles: ['pebbles'],
  thorns: 'boar', shimmer: 'moth', pearl: 'gnasher',
};

class Bot {
  constructor(seed) {
    this.g = new CubbyGame(seed, { mode: 'story' });
    this.built = new Set(); this.sites = [];
    this.stats = { blinks: 0, repaths: 0, steps: 0, nightsSlept: 0, hits: 0, minHp: MAX_HP };
    const v = this.g.valley, w = this.g.world;
    this.bench = null;
    for (let y = v.homeBed.y - 1; y <= v.homeBed.y + 2 && !this.bench; y++) for (let z = v.homeBed.z - 8; z <= v.homeBed.z + 8; z++) for (let x = v.homeBed.x - 8; x <= v.homeBed.x + 8; x++) if (w.get(x, y, z) === BK.workbench) this.bench = { x, y, z };
    assert.ok(this.bench, 'the cubby has a workbench');
  }
  get me() { return this.g.me; }
  cell() { const b = this.me; return { x: Math.floor(b.x), y: Math.floor(b.y + 0.2), z: Math.floor(b.z) }; }
  hostiles(r) { const b = this.me; return this.g.critters.filter((c) => CRITTERS[c.kind].hostile && Math.hypot(c.body.x - b.x, c.body.z - b.z) < r && Math.abs(c.body.y - b.y) < 4); }

  /** One frame: input, the world ticks, and the bonk-stick reflex. */
  frame(inp = {}) {
    const g = this.g, b = this.me;
    const threat = this.hostiles(5).sort((a, c) => Math.hypot(a.body.x - b.x, a.body.z - b.z) - Math.hypot(c.body.x - b.x, c.body.z - b.z))[0];
    let side = inp.side ?? 0, fwd = inp.fwd ?? 0;
    // a boar winding up at us: step aside, across its line
    const boar = g.critters.find((c) => c.kind === 'boar' && c.st === 'windup' && Math.hypot(c.body.x - b.x, c.body.z - b.z) < 12);
    if (boar) { const a = Math.atan2(-(boar.body.x - b.x), -(boar.body.z - b.z)); g.me.yaw = a; side = 1; fwd = 0; }
    else if (threat) {
      g.sel = Math.max(0, g.hot.indexOf('bonk'));
      g.lookAt(threat.body.x, threat.body.y + threat.body.h / 2, threat.body.z);
      const d = Math.hypot(threat.body.x - b.x, threat.body.z - b.z);
      if (d < 2.6) { if (g.swing()) this.stats.hits++; }
      else if (!inp.keep && threat.st !== 'charge') { fwd = 1; side = 0; }
    }
    g.step(DT, { ...NO_INPUT, fwd, side, jump: !!inp.jump || b.water, yaw: g.me.yaw, pitch: g.me.pitch });
    this.stats.steps++; this.stats.minHp = Math.min(this.stats.minHp, g.hp);
    g.drain();
  }
  wait(s, inp) { for (let t = 0; t < s; t += DT) this.frame(inp); }

  /** Walks to a cell (or within `near` of it) along a path; re-paths when stuck, and as a last resort blinks there. */
  goto(to, near = 0, budget = 90, chase = false) {
    let why = '';
    const g = this.g;
    for (let attempt = 0; attempt < 4; attempt++) {
      const c = this.cell();
      if (near ? Math.abs(c.x - to.x) + Math.abs(c.z - to.z) <= near && Math.abs(c.y - to.y) <= 1 : c.x === to.x && c.z === to.z && Math.abs(c.y - to.y) <= 1) return true;
      let path = findPath(g.world, c, to, 150000, near);
      for (let k = 0; !path && k < 5 && this.reach(2000).size < 400 && this.pillar(); k++) path = findPath(g.world, this.cell(), to, 60000, near);
      if (!path) break;
      let i = 1, best = 1e9, still = 0;
      for (let t = 0; t < budget && i < path.length; t += DT) {
        const p = path[i], b = this.me, dx = p.x + 0.5 - b.x, dz = p.z + 0.5 - b.z, d = Math.hypot(dx, dz);
        if (d < 0.32 && Math.abs(p.y - b.y) < 1.2) { i++; best = 1e9; still = 0; continue; }
        g.me.yaw = Math.atan2(-dx, -dz); g.me.pitch = -0.2;
        this.frame({ fwd: Math.min(1, d * 2 + 0.3), jump: p.y > b.y + 0.4 });
        if (d < best - 0.05) { best = d; still = 0; } else if ((still += DT) > 2.5) break;
      }
      if (i >= path.length) return true;
      this.stats.repaths++;
    }
    if (chase) return false; // a creature somewhere out of reach: let it go
    // stuck for good: blink to the target (counted, and kept rare by the checks below)
    const from = this.cell(); why = findPath(this.g.world, from, to, 150000, near) ? 'path' : 'nopath';
    const t = near ? this.nearStand(to, near) ?? to : to;
    const b = this.me; b.x = t.x + 0.5; b.y = t.y; b.z = t.z + 0.5; b.vx = b.vy = b.vz = 0;
    this.stats.blinks++; (this.stats.why ??= []).push(`goto ${why} ${this.task ?? ''} ${JSON.stringify(from)}→${JSON.stringify(to)} n${near}`);
    return true;
  }
  /** Out of a pit the way a player climbs out: jump and drop a block underfoot. */
  land() { for (let t = 0; t < 3 && !this.me.ground && !this.me.water; t += DT) this.frame({ keep: true }); }
  pillar() {
    const g = this.g, b = this.me;
    this.land();
    const k = ['soil', 'stone', 'chalk', 'sand', 'clay', 'planks'].find((x) => g.count(x) > 0);
    if (!k || (!b.ground && !b.water)) return false;
    const c = this.cell(), y0 = c.y;
    if (BLOCKS[g.world.get(c.x, y0 + 2, c.z)].solid) return false;
    for (let t = 0; t < 2; t += DT) {
      this.frame({ jump: true, keep: true });
      if (b.y >= y0 + 1.02) { const ok = g.placeAt(k, c.x, y0, c.z); this.wait(0.4); return ok; }
    }
    return false;
  }
  nearStand(to, r) {
    for (let d = r ? 1 : 0; d <= r + 2; d++) for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) for (const dy of [0, 1, -1, 2, -2]) if (standable(this.g.world, to.x + dx, to.y + dy, to.z + dz)) return { x: to.x + dx, y: to.y + dy, z: to.z + dz };
    return null;
  }

  // ---- digging
  /** Holds dig on a block until it breaks; digs through whatever is in the way (never our own building). */
  digBlock(x, y, z) {
    const g = this.g;
    for (let tries = 0; tries < 4; tries++) {
      if (g.world.get(x, y, z) === BK.air) return true;
      g.sel = 0; // the bonk-stick is no shovel, but held digging works with anything in paw
      g.lookAt(x + 0.5, y + 0.5, z + 0.5);
      const h = g.aim();
      if (!h) return false;
      if (this.built.has(idx(h.x, h.y, h.z)) || BLOCKS[h.b].hard < 0 || BLOCKS[h.b].key === 'stump') return false;
      for (let t = 0; t < 6; t += DT) {
        g.lookAt(h.x + 0.5, h.y + 0.5, h.z + 0.5);
        const p = g.dig(DT, true);
        this.frame({ keep: true });
        if (p === 1 || g.world.get(h.x, h.y, h.z) !== h.b) break;
        if (p < 0) break;
      }
      if (h.x === x && h.y === y && h.z === z) return g.world.get(x, y, z) !== h.b;
    }
    return g.world.get(x, y, z) === BK.air;
  }
  exposed(x, y, z) {
    const w = this.g.world;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) { const b = BLOCKS[w.get(x + dx, y + dy, z + dz)]; if (!b.solid || b.shape === 'cross') return true; }
    return false;
  }
  forbidden(x, y, z) {
    const v = this.g.valley;
    if (this.built.has(idx(x, y, z))) return true;
    if (Math.hypot(x - v.homeBed.x, z - v.homeBed.z) < 7 || Math.hypot(x - v.stump.x, z - v.stump.z) < 3) return true;
    return this.sites.some((s) => x >= s.x - 2 && x <= s.x + 6 && z >= s.z - 2 && z <= s.z + 6);
  }
  /** Digs the nearest blocks of these kinds until `want()` says enough. */
  gather(keys, want) {
    this.task = 'gather ' + keys;
    const g = this.g, w = g.world, ids = new Set(keys.map((k) => BK[k]));
    const bad = new Set();
    for (let round = 0; round < 80 && want(); round++) {
      this.land();
      const reach = this.reach(), cands = [];
      for (let y = 1; y < H - 1; y++) for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) {
        const id = w.blocks[idx(x, y, z)] & 63;
        if (!ids.has(id) || bad.has(idx(x, y, z)) || this.forbidden(x, y, z)) continue;
        if (id !== BK.crystal && !this.exposed(x, y, z)) continue;
        if ((id === BK.turf || id === BK.soil) && w.get(x, y + 1, z) !== BK.air) continue;
        const st = this.standFor({ x, y, z }, reach); if (!st) continue;
        cands.push({ x, y, z, st, d: st.d });
      }
      if (!cands.length) { if (reach.size < 400 && round < 6 && this.pillar()) continue; return false; }
      cands.sort((a, c) => a.d - c.d);
      const c = cands[0];
      this.goto(c.st, 0, 160);
      if (this.digBlock(c.x, c.y, c.z)) this.collect(4); else bad.add(idx(c.x, c.y, c.z));
      this.task = 'gather ' + keys;
    }
    return !want();
  }
  /** Every cell the bot can walk to from here (the same moves as findPath), with its walking distance. */
  reach(max = 90000) {
    const w = this.g.world, s = this.cell(), dist = new Map([[idx(s.x, s.y, s.z), 0]]), q = [s];
    for (let h = 0; h < q.length && dist.size < max; h++) {
      const c = q[h], d0 = dist.get(idx(c.x, c.y, c.z));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, nz = c.z + dz;
        const swim = w.get(c.x, c.y, c.z) === WATER || w.get(c.x, c.y - 1, c.z) === WATER;
        for (const dy of swim ? [0, 1, 2, -1, -2, -3, -4, -5] : [0, 1, -1, -2, -3, -4, -5]) {
          const ny = c.y + dy;
          if (dy >= 1 && solidTop(w, c.x, c.y + 1, c.z, false)) continue;
          if (dy === 2 && solidTop(w, c.x, c.y + 2, c.z, false)) continue;
          if (!standable(w, nx, ny, nz)) { if (dy < 0 && solidTop(w, nx, c.y, nz, false)) break; continue; }
          if (dy < 0) { let ok = true; for (let y = c.y; y > ny; y--) if (solidTop(w, nx, y, nz, false)) ok = false; if (!ok) continue; }
          const k = idx(nx, ny, nz); if (dist.has(k)) break;
          dist.set(k, d0 + 1); q.push({ x: nx, y: ny, z: nz }); break;
        }
      }
    }
    return dist;
  }
  /** A walkable cell within reach of a block: the nearest by walking. */
  standFor(c, reach) {
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = c.x + dx, y = c.y + dy, z = c.z + dz;
      if ((dx === 0 && dz === 0 && dy >= 0 && dy <= 1) || Math.hypot(dx, dy + 0.2, dz) > 3.4) continue;
      const d = reach.get(idx(x, y, z)); if (d === undefined) continue;
      if (d < bd) { bd = d; best = { x, y, z, d }; }
    }
    return best;
  }
  /** A standable cell within reach of a block, nearest the player. */
  standNear(c) {
    const w = this.g.world, b = this.me; let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = c.x + dx, y = c.y + dy, z = c.z + dz;
      if (!standable(w, x, y, z) || (dx === 0 && dz === 0 && dy >= 0 && dy <= 1)) continue;
      if (Math.hypot(dx, dy + 0.7 - 0.5, dz) > 3.6) continue;
      const d = Math.hypot(x - b.x, z - b.z) + Math.abs(dy) * 0.5;
      if (d < bd) { bd = d; best = { x, y, z }; }
    }
    return best;
  }
  /** Walks over to pick-ups lying nearby (creature drops, things dropped at a knock-out). */
  collect(r = 30) {
    this.task = 'collect';
    this.skip ??= new Set();
    for (let k = 0; k < 8; k++) {
      const b = this.me, p = this.g.pickups.filter((q) => q.t > 0.5 && !this.skip.has(q.id) && Math.hypot(q.x - b.x, q.z - b.z) < r).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
      if (!p) return;
      this.goto({ x: Math.floor(p.x), y: Math.floor(p.y - 0.2), z: Math.floor(p.z) }, 1, 40, true);
      this.wait(0.6);
      if (this.g.pickups.includes(p)) this.skip.add(p.id); // out of reach: leave it, as a player would
    }
  }

  // ---- having things
  /** Makes sure the bag holds n of an item: digs it, weaves it, or bonks the creature that drops it. */
  have(k, n) {
    const g = this.g;
    for (let guard = 0; guard < 40 && g.count(k) < n; guard++) {
      const r = RECIPE[k];
      if (r && g.known.has(k) && !(k === 'twig' && false)) {
        const times = Math.ceil((n - g.count(k)) / r.n);
        for (const [ik, ic] of Object.entries(g.ins(r))) this.have(ik, ic * times + (ik === k ? 0 : 0));
        this.toBench();
        assert.ok(g.weave(k, times), `weave ${times}× ${k} (have ${JSON.stringify(g.inv)})`);
        continue;
      }
      const src = SOURCES[k];
      assert.ok(src, `no way to get ${k}`);
      if (typeof src === 'string') { this.hunt(src, () => g.count(k) < n); continue; }
      let ok = this.gather(src, () => g.count(k) < n);
      if (!ok && k === 'fluff') { this.hunt('bunny', () => g.count(k) < n); ok = true; } // the cotton is gone: dust-bunnies bring fluff every night
      assert.ok(ok || g.count(k) >= n, `could not gather ${k}`);
    }
    assert.ok(g.count(k) >= n, `have ${n} ${k}`);
  }
  toBench() { if (!this.g.nearBench()) this.goto(this.bench, 2); if (!this.g.nearBench()) this.goto(this.bench, 1); }

  // ---- nights
  /** Night: go home and sleep (bonking anything that follows), unless a job needs the dark. */
  nightCheck() {
    const g = this.g;
    if (g.phase < 0.66) return;
    this.sleep();
  }
  sleep() {
    const g = this.g, bed = g.respawn;
    // wait for the evening, then the bed
    while (g.phase < 0.6) this.wait(2);
    for (let k = 0; k < 20; k++) {
      const s = g.besideBed(bed);
      this.goto(s, 0, 60);
      g.lookAt(bed.x + 0.5, bed.y + 0.3, bed.z + 0.5);
      const r = g.use();
      if (r === 'sleep') { this.stats.nightsSlept++; return; }
      if (r === 'talk') { this.me.x += 0; }
      this.wait(1.5);
      if (!g.night && g.phase < 0.6) return;
    }
  }
  /** Waits out in the dark for a creature of this kind and bonks it until `more()` says enough. */
  hunt(kind, more) {
    this.task = 'hunt ' + kind;
    const g = this.g, v = g.valley;
    for (let tries = 0; tries < 30 && more(); tries++) {
      if (kind === 'gnasher') {
        const c = g.crystals.slice().sort((a, b) => Math.hypot(a.x - this.me.x, a.z - this.me.z) - Math.hypot(b.x - this.me.x, b.z - this.me.z))[0];
        const s = this.standNear(c) ?? this.nearStand(c, 3);
        this.goto(s, 1, 120);
      } else {
        if (!g.night) { while (g.phase < 0.7 || g.phase > 0.93) this.wait(2); }
        // the open meadow a little way out from home
        const s = this.nearStand({ x: v.start.x + 6, y: v.start.y, z: v.start.z + 6 }, 4);
        this.goto(s, 1, 60);
      }
      for (let t = 0; t < 40 && more(); t += 0.5) {
        const b = this.me, prey = g.critters.filter((c) => c.kind === kind).sort((a, c) => Math.hypot(a.body.x - b.x, a.body.z - b.z) - Math.hypot(c.body.x - b.x, c.body.z - b.z))[0];
        if (prey && Math.hypot(prey.body.x - b.x, prey.body.z - b.z) > 3) {
          if (!this.goto({ x: Math.floor(prey.body.x), y: Math.floor(prey.body.y + 0.2), z: Math.floor(prey.body.z) }, 2, 4, true)) this.wait(0.5);
        } else this.wait(0.5);
        this.collect(12);
      }
      this.collect(20);
    }
  }
  catchBunnies(n) {
    this.task = 'bunnies';
    const g = this.g, v = g.valley;
    while (g.quest.count < n) {
      while (!g.night) this.wait(2);
      const s = this.nearStand({ x: v.start.x + 6, y: v.start.y, z: v.start.z + 6 }, 4);
      this.goto(s, 1, 60);
      for (let t = 0; t < 120 && g.quest.count < n && g.night; t += 0.5) {
        const b = this.me, bun = g.critters.filter((c) => c.kind === 'bunny').sort((a, c) => Math.hypot(a.body.x - b.x, a.body.z - b.z) - Math.hypot(c.body.x - b.x, c.body.z - b.z))[0];
        if (bun) {
          if (!this.goto({ x: Math.floor(bun.body.x), y: Math.floor(bun.body.y + 0.2), z: Math.floor(bun.body.z) }, 1, 3, true)) this.wait(0.5);
          if (Math.hypot(bun.body.x - b.x, bun.body.z - b.z) < 2.4 && g.critters.includes(bun)) { g.sel = 0; g.lookAt(bun.body.x, bun.body.y + 0.2, bun.body.z); g.swing(); this.frame({ keep: true }); }
        } else this.wait(0.5);
      }
    }
  }

  // ---- neighbours
  toVisitor() {
    const g = this.g;
    for (let k = 0; k < 6 && !g.nearVisitor(); k++) {
      const v = g.visiting; if (!v) { this.wait(1); continue; }
      this.goto({ x: Math.floor(v.body.x), y: Math.floor(v.body.y + 0.2), z: Math.floor(v.body.z) }, 2, 60);
    }
    assert.ok(g.nearVisitor(), 'reached the visitor');
  }
  handIn() {
    const g = this.g, st = g.stepNow;
    for (let k = 0; k < 5; k++) {
      if (st.kind === 'bring') for (const [it, c] of Object.entries(g.needs(st.items))) this.have(it, c); // a Grumblefluff may have nibbled
      this.toVisitor();
      if (g.handIn()) return;
      this.collect(20);
    }
    assert.fail(`hand in ${g.neighbour?.id} step ${g.quest.step}: ready ${g.ready()} near ${!!g.nearVisitor()} ${JSON.stringify(g.inv)}`);
  }

  /** Finds a flat 5×5 patch near home with room above, away from the cubby and other burrows. */
  findSite() {
    const g = this.g, w = g.world, v = g.valley;
    const ok = (x0, y, z0) => {
      for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) {
        const x = x0 + dx, z = z0 + dz;
        if (!BLOCKS[w.get(x, y - 1, z)].solid || BLOCKS[w.get(x, y - 1, z)].shape !== 'cube') return false;
        for (let yy = y; yy < y + 3; yy++) { const b = w.get(x, yy, z); if (b !== BK.air && BLOCKS[b].shape !== 'cross') return false; }
        if (this.forbidden(x, y, z) && !this.sites.length && false) return false;
      }
      return !this.sites.some((s) => Math.abs(s.x - x0) < 8 && Math.abs(s.z - z0) < 8) && Math.hypot(x0 + 2 - v.homeBed.x, z0 + 2 - v.homeBed.z) > 8 && Math.hypot(x0 + 2 - v.stump.x, z0 + 2 - v.stump.z) > 5;
    };
    for (let r = 8; r < 40; r++) for (let a = 0; a < 32; a++) {
      const x0 = Math.round(v.start.x + Math.cos((a / 32) * Math.PI * 2) * r) - 2, z0 = Math.round(v.start.z + Math.sin((a / 32) * Math.PI * 2) * r) - 2;
      if (x0 < 3 || z0 < 3 || x0 > W - 8 || z0 > D - 8) continue;
      const y = Math.round(g.groundAt(x0 + 2.5, z0 + 2.5, H - 3));
      if (ok(x0, y, z0)) return { x: x0, y, z: z0 };
    }
    throw new Error('no burrow site');
  }
  place(k, x, y, z, face) {
    this.have(k, 1);
    const ok = this.g.placeAt(k, x, y, z, face);
    if (ok) this.built.add(idx(x, y, z));
    return ok;
  }
  /** Builds a 5×5 burrow: soil walls, a door, a roof, and inside a bed, a lantern and the neighbour's item. */
  buildBurrow(item) {
    const g = this.g, s = this.findSite(), y = s.y;
    this.sites.push(s);
    const walls = 15 + 9;
    this.have('soil', walls); this.have('bed', 1); this.have('lantern', 1); this.have(item, 1);
    this.goto({ x: s.x + 2, y, z: s.z + 2 }, 2, 120);
    // clear any plants inside
    for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) for (let yy = y; yy < y + 2; yy++) { const b = g.world.get(s.x + dx, yy, s.z + dz); if (b !== BK.air && BLOCKS[b].shape === 'cross') g.breakBlock(s.x + dx, yy, s.z + dz); }
    const door = { x: s.x + 2, z: s.z };
    // stand in the middle while the walls go up around
    this.goto({ x: s.x + 2, y, z: s.z + 2 }, 0, 30);
    for (let dz = 0; dz < 5; dz++) for (let dx = 0; dx < 5; dx++) {
      if (dx > 0 && dx < 4 && dz > 0 && dz < 4) continue;
      const x = s.x + dx, z = s.z + dz;
      if (x === door.x && z === door.z) assert.ok(this.place('door', x, y, z, 0), 'door');
      else assert.ok(this.place('soil', x, y, z), `wall ${dx},${dz}`);
      this.frame();
    }
    assert.ok(this.place('bed', s.x + 1, y, s.z + 3), 'bed');
    assert.ok(this.place('lantern', s.x + 3, y, s.z + 3), 'lantern');
    assert.ok(this.place(item, s.x + 3, y, s.z + 1), item);
    for (let dz = 1; dz < 4; dz++) for (let dx = 1; dx < 4; dx++) { assert.ok(this.place('soil', s.x + dx, y + 1, s.z + dz), 'roof'); this.frame(); }
    // walk out through the door and back in, then check
    this.goto({ x: door.x, y, z: door.z - 1 }, 0, 30);
    this.goto({ x: s.x + 2, y, z: s.z + 2 }, 0, 30);
    const c = g.checkHere();
    assert.ok(c.ok, `burrow for ${g.neighbour?.id}: ${c.reason}`);
    assert.ok(g.moveIn(), 'move in');
    this.wait(8);
  }

  play() {
    const g = this.g;
    for (let guard = 0; guard < 40 && g.neighbour; guard++) {
      const n = g.neighbour, st = g.stepNow, label = `${n.id}:${g.quest.step}`;
      if (!g.visiting) this.wait(8);
      if (g.night) this.sleep();
      if (st.kind === 'bring') {
        for (const [k, c] of Object.entries(g.needs(st.items))) this.have(k, c);
        if (g.night) this.sleep();
        this.handIn();
      } else if (st.kind === 'count') {
        if (st.what === 'catch') this.catchBunnies(st.n);
        if (st.what === 'plant') {
          for (let k = 0; g.quest.count < st.n && k < 30; k++) {
            this.have('sapling', 1);
            const b = this.me; let done = false;
            for (let r = 2; r < 12 && !done; r++) for (let a = 0; a < 16 && !done; a++) {
              const x = Math.floor(b.x + Math.cos(a / 16 * 6.283) * r * 1.0), z = Math.floor(b.z + Math.sin(a / 16 * 6.283) * r);
              const y = Math.round(g.groundAt(x + 0.5, z + 0.5, b.y + 2));
              if (!this.forbidden(x, y, z) && g.world.get(x, y - 1, z) === BK.turf && g.world.get(x, y, z) === BK.air) done = g.placeAt('sapling', x, y, z);
            }
          }
        }
        if (st.what === 'lantern') {
          for (let k = 0; g.quest.count < st.n && k < 30; k++) {
            this.have('lantern', 1);
            const b = this.me; let done = false;
            for (let r = 2; r < 12 && !done; r++) for (let a = 0; a < 16 && !done; a++) {
              const x = Math.floor(b.x + Math.cos(a / 16 * 6.283) * r), z = Math.floor(b.z + Math.sin(a / 16 * 6.283) * r);
              const y = Math.round(g.groundAt(x + 0.5, z + 0.5, b.y + 2));
              if (!this.forbidden(x, y, z) && g.world.get(x, y, z) === BK.air && BLOCKS[g.world.get(x, y - 1, z)].shape === 'cube' && g.openSky(x, y, z)) done = this.place('lantern', x, y, z);
            }
          }
        }
        assert.ok(g.ready(), `${label} ready`);
        this.handIn();
      } else {
        if (g.night) this.sleep();
        this.buildBurrow(n.item);
      }
      this.collect(25);
    }
  }
}

let fails = 0;
for (const seed of seeds) {
  const t0 = Date.now();
  const bot = new Bot(seed), g = bot.g;
  try { bot.play(); } catch (e) { fails++; console.error(`seed ${seed}: FAILED at ${g.neighbour?.id}:${g.quest.step} day ${Math.floor(g.time / DAY) + 1}`, e.message); continue; }
  const s = bot.stats;
  console.log(`seed ${seed}: all ${g.moved.length} neighbours moved in, fair ${g.fair ? 'held' : 'NOT held'} on day ${Math.floor(g.time / DAY) + 1}; ${g.stats.defeated} monsters bonked, ${g.stats.caught} bunnies caught, ${g.stats.kos} knock-outs, lowest hearts ${s.minHp / 2}, ${s.nightsSlept} nights slept; ${s.repaths} re-paths, ${s.blinks} blinks; ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  assert.equal(g.moved.length, NEIGHBOURS.length);
  assert.ok(g.fair, 'the fair started');
  assert.ok(g.stats.defeated >= 4, 'monsters were fought');
  if (s.why && s.blinks > 6) console.log(s.why.join('\n'));
  assert.ok(s.blinks <= 6, `the bot walked (blinks ${s.blinks})`);
}
if (fails) { console.error(`cubby bot: ${fails} of ${seeds.length} valleys failed`); process.exit(1); }
console.log(`cubby bot: ${seeds.length} valley${seeds.length > 1 ? 's' : ''} completed with monsters on`);
