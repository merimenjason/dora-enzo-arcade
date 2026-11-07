// Overclock bots, driving the deterministic engine headless with human-paced reactions (12-15 ticks before reacting
// to a boss's wind-up or an incoming shot, with noise in timing and aim):
// - the route bot finishes every stage, from the start to the boss door;
// - casual (assist on) and pro (strict) bots fight every boss from its door, three attempts per seed: casual must win
//   within three in at least 85% of seeds and pro in at least 70%;
// - the full-run bot plays the whole game in a sensible order, revisiting cleared stages once the city has changed, and
//   collects every capsule: proof that each one is reachable and that the routing can't strand a player.
// `--quick` runs fewer seeds. Run after compiling the engine into .checks/ (npm test does).
import assert from 'node:assert/strict';
import {
  OverclockGame, NO_INPUT, STAGES, BOSS_STAGES, T, ROWS, HW, HH, WEAK, POWERS, powersOf, freshSave, CORE_BOSSES, reqMet, tankCount, bossBox, STAGE_OF,
} from '../.checks/overclock-game.js';

const QUICK = process.argv.includes('--quick');
const VERBOSE = process.argv.includes('--verbose');

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Bot {
  constructor(g, { seed = 1, delay = 13, skill = 1 } = {}) {
    this.g = g; this.r = rng(seed); this.delay = delay; this.skill = skill;
    this.ways = g.stage.route.map((w) => ({ ...w })); this.wi = 0;
    this.seen = []; // threats noticed, acted on after the reaction delay
    this.jumpHold = 0; this.charge = 0; this.wantLead = null; this.stuck = 0; this.lastX = 0; this.dashing = 0; this.airdashArmed = false;
    this.tapShoot = false;
  }
  /** add the side trips to items this save can reach */
  planDetours(save) {
    const st = this.g.stage, out = [];
    st.route.forEach((w, i) => {
      out.push({ ...w });
      for (const d of st.detours) if (d.at === i && !save.items.includes(d.item) && reqMet(save, d.req)) for (const x of d.ways) out.push({ ...x });
    });
    this.ways = out; this.wi = 0;
  }
  solid(c, r) { return this.g.solid(c, r); }
  standOn(c, r) { return this.g.solid(c, r) || this.g.oneway(c, r) || (this.g.riding >= 0 && this.g.water(c, r)); }
  /** columns of drop ahead: how many columns until there's ground within 3 rows below the feet */
  gapAhead(dir) {
    const b = this.g.body, fr = Math.floor((b.y + 1) / T);
    let n = 0;
    for (let i = 0; i < 12; i++) {
      const c = Math.floor((b.x + dir * (HW / 2 + 2 + i * T)) / T);
      let ground = false;
      for (let r = fr; r <= fr + 2 && !ground; r++) if (this.standOn(c, r)) ground = !this.liveHazard(c, r - 1) && !this.g.water(c, r);
      if (ground) return n;
      n++;
    }
    return n;
  }
  hazardNear(dir) { const b = this.g.body, r0 = Math.floor((b.y - 2) / T); for (let i = 0; i < 5; i++) for (let r = r0; r <= r0 + 2; r++) if (this.liveHazard(Math.floor((b.x + dir * i * T) / T), r)) return true; return false; }
  liveHazard(c, r) { const ch = this.g.tileAt(c, r); return ch === '^' || (ch === 'w' && !this.g.gate); }
  wallAhead(dir) {
    const b = this.g.body, c = Math.floor((b.x + dir * (HW / 2 + 5)) / T);
    let h = 0;
    for (let r = Math.floor((b.y - 1) / T); r > 0 && this.solid(c, r); r--) h++;
    return h;
  }
  threats() {
    const g = this.g, b = g.body, out = [];
    for (const s of g.shots) if (!s.friendly) {
      const dx = b.x - s.x, dy = b.y - 14 - s.y;
      const towards = Math.sign(s.vx || 0.0001) === Math.sign(dx) || Math.abs(dx) < 20;
      if (towards && Math.abs(dx) < 110 && Math.abs(dy) < 40 && s.kind !== 'beam') out.push(s.id);
    }
    return out;
  }
  /** Try a plan (a function of the tick giving an input) on a ghost copy of the hero's body; the game is
   *  deterministic, so this is the jump the hero will really make. */
  simulate(plan, n) {
    const g = this.g, ghost = Object.create(g);
    ghost.body = { ...g.body }; ghost.events = []; ghost.toastT = new Map(); ghost.stats = { ...g.stats };
    ghost.heroes = { dora: { ...g.heroes.dora }, enzo: { ...g.heroes.enzo } }; ghost.lastSafe = { ...g.lastSafe }; ghost.prev = { ...g.prev };
    let dead = false, air = false, landed = -1;
    ghost.fell = () => { dead = true; };
    for (let t = 0; t < n && !dead; t++) {
      const inp = plan(t, landed);
      ghost.stepBody(inp, (k) => inp[k] && !ghost.prev[k]); ghost.prev = inp;
      const b = ghost.body, c = Math.floor(b.x / T), r = Math.floor((b.y - 2) / T);
      if (this.liveHazard(c, r) || this.liveHazard(Math.floor((b.x - 5) / T), r) || this.liveHazard(Math.floor((b.x + 5) / T), r) || g.water(c, r)) dead = true;
      if (!b.ground) air = true; else if (air && landed < 0) landed = t;
      if (landed >= 0 && t > landed + 6) break;
    }
    const b = ghost.body;
    if (!b.ground && !b.cling && b.y > g.body.y + 40) dead = true;
    return { dead, x: b.x, y: b.y, ground: b.ground, landed };
  }
  plans(dir) {
    const mv = (inp, on) => { if (on) { if (dir > 0) inp.right = true; else inp.left = true; } return inp; };
    const out = [{ name: 'walk', k: 0, f: () => mv({ ...NO_INPUT }, true) }];
    for (const k of [0, 3, 6, 10, 15, 22, 30]) {
      // walk k ticks, take off, steer while airborne, and stop once landed
      out.push({ name: 'jump', k, f: (t, landed) => mv({ ...NO_INPUT, jump: t >= k && t < k + 26 }, landed < 0) });
      out.push({ name: 'hop', k, f: (t, landed) => mv({ ...NO_INPUT, jump: t >= k && t < k + 7 }, landed < 0) });
      out.push({ name: 'dashjump', k, f: (t, landed) => mv({ ...NO_INPUT, dash: t >= k && t < k + 24, jump: t >= k + 1 && t < k + 27 }, landed < 0) });
      out.push({ name: 'short', k, f: (t, landed) => mv({ ...NO_INPUT, jump: t >= k && t < k + 26 }, landed < 0 && t < k + 12) });
    }
    return out;
  }
  /** choose how to move toward the waypoint: walk unless walking falls, gets blocked, or a jump gets closer */
  choose(w, dir) {
    const g = this.g, b = g.body, n = g.stage.gravity < 1 ? 110 : 75;
    let best = null;
    for (const p of this.plans(dir)) {
      if (p.name === 'dashjump' && g.lead === 'enzo' && false) continue;
      const r = this.simulate(p.f, n);
      if (r.dead) continue;
      const close = Math.abs(r.x - w.x) < 80;
      let score = -Math.abs(r.x - w.x) - (close ? 1.2 : 0.15) * Math.abs(r.y - w.y) - (r.ground ? 0 : 40) - p.k * 4;
      if (p.name === 'walk') score += 10;
      if (p.name === 'wait') score -= 25;
      if (!best || score > best.score) best = { ...p, score, r };
    }
    return best;
  }
  /** pick the input for this tick */
  next() {
    const g = this.g, b = g.body, inp = { ...NO_INPUT };
    if (g.mode === 'in' || g.mode === 'fail' || g.mode === 'clear' || g.mode === 'out' || g.mode === 'done') return inp;
    // reactions: what was seen `delay` ticks ago (with a little noise) is acted on now
    const now = g.tick;
    for (const id of this.threats()) if (!this.seen.some((s) => s.id === id)) this.seen.push({ id, at: now + this.delay + Math.floor(this.r() * 3) });
    this.seen = this.seen.filter((s) => g.shots.some((x) => x.id === s.id) && now - s.at < 60);
    const react = this.seen.some((s) => s.at <= now);
    if (g.boss && g.boss.st !== 'calm') return this.fight(inp, react);
    if (g.miniOn) return this.fightMini(inp, react);
    let w = this.ways[this.wi];
    if (!w) { inp.right = true; return inp; }
    // reached?
    const dx = w.x - b.x, dy = w.y - b.y;
    const reached = w.act === 'item' ? g.taken.has(w.item) : w.act === 'charge' ? !this.crackNear(w) : (Math.abs(dx) < 10 && Math.abs(dy) < 20 && (b.ground || b.cling)) || (['run', 'jump', 'dashjump', 'drop'].includes(w.act) && dy > -12 && dy < 40 && b.ground && this.passed(w)) || (w.act === 'bike' && g.riding < 0 && b.x > w.x + 40);
    if (reached) { this.wi++; this.stuck = 0; w = this.ways[this.wi]; if (!w) { inp.right = true; return inp; } }
    // stuck: try a jump, then a tag
    if (Math.abs(b.x - this.lastX) < 0.2 && !g.riding) this.stuck++; else this.stuck = 0;
    this.lastX = b.x;
    if (this.stuck > 240) { this.wi++; this.stuck = 0; }
    const dir = Math.sign(w.x - b.x) || 1;
    // the hero this section needs
    if (w.act === 'climb' && g.lead !== 'dora') this.wantLead = 'dora';
    else if (w.act === 'charge' && g.lead !== 'enzo') this.wantLead = 'enzo';
    else if (w.act === 'airdash') this.wantLead = 'dora';
    else if (w.act === 'item') this.wantLead = null;
    if (this.wantLead && g.lead !== this.wantLead && g.tagCd === 0 && !g.heroes[this.wantLead].down && !g.prev.tag) { inp.tag = true; return inp; }
    if (this.wantLead === g.lead) this.wantLead = null;
    if (w.act === 'charge') return this.doCharge(inp, w);
    if (g.riding >= 0) return this.ride(inp);
    // shoot whatever is ahead
    this.shootAhead(inp);
    if (Math.abs(w.x - b.x) > 4 || !b.ground) { if (dir > 0) inp.right = true; else inp.left = true; }
    // jumping: held through the rise
    if (w.act === 'airdash' && !b.ground && b.vy > -1.5 && !b.airDashed) { inp.dash = !g.prev.dash; inp.jump = true; }
    if (this.plan) {
      const inpP = this.plan.f(this.planT++, this.planT > 4 && b.ground ? 0 : -1);
      if (this.planT > 4 && b.ground) this.plan = null;
      else { inp.left = inpP.left; inp.right = inpP.right; inp.jump = inpP.jump; inp.dash = inpP.dash; }
    }
    if (b.ground && !this.plan && w.act !== 'airdash') {
      const near = this.gapAhead(dir) > 0 || (this.wallAhead(dir) > 0 && this.wallAhead(dir) <= 4) || w.y < b.y - 8 || this.hazardNear(dir);
      if (near && (this.g.tick % 3 === 0 || this.lastNear !== true)) {
        const best = this.choose(w, dir);
        if (best && best.name !== 'walk' && best.k === 0) {
          // a human's timing is a little off: start a jump a tick or two late, sometimes
          this.plan = best; this.planT = 0;
          const inpP = best.f(this.planT++, -1);
          inp.left = inpP.left; inp.right = inpP.right; inp.jump = inpP.jump && !g.prev.jump; inp.dash = inpP.dash;
          if (inpP.jump && g.prev.jump) this.planT = 0;
        }
      }
      this.lastNear = near;
      if (!this.plan && react && !g.prev.jump && this.r() < 0.6 * this.skill && !near) { this.plan = { f: (t) => ({ ...NO_INPUT, jump: t < 10, right: dir > 0, left: dir < 0 }) }; this.planT = 0; inp.jump = true; }
    }
    if (w.act === 'airdash' && b.ground && Math.abs(dx) < 70 && b.y <= w.y + 2) {
      // a dash-jump off the edge, then the air-dash near the top of the jump
      this.plan = { f: (t) => ({ ...NO_INPUT, right: dir > 0, left: dir < 0, jump: t >= 1 && t < 60, dash: t < 12 || (t >= 24 && t < 40) }) }; this.planT = 0; inp.dash = true;
      if (dir > 0) inp.right = true; else inp.left = true;
    }
    // walls too high to jump: Dora climbs
    const wallH = this.wallAhead(dir);
    if (wallH > 3 || (b.cling && wallH > 0)) {
      if (g.lead === 'dora') { inp.up = true; if (dir > 0) inp.right = true; else inp.left = true; inp.left = dir < 0; inp.right = dir > 0; }
      else if (!g.heroes.dora.down) this.wantLead = 'dora';
      else if (this.shaft(dir)) return this.wallKick(inp, dir);
      else { inp.left = false; inp.right = false; inp.up = g.tick % 120 === 0; } // wait for Dora to rest
    }
    if (dy > 30 && b.ground && Math.abs(dx) < 20) { inp.down = true; if (!g.prev.jump) inp.jump = true; }
    return inp;
  }
  /** is there a wall behind as well (a shaft Enzo can wall-jump up)? */
  shaft(dir) { const b = this.g.body; for (let i = 1; i <= 4; i++) { const c = Math.floor((b.x - dir * i * T) / T); for (let r = Math.floor((b.y - 40) / T); r > Math.floor((b.y - 120) / T); r--) if (this.solid(c, r)) return true; } return false; }
  wallKick(inp, dir) {
    const g = this.g, b = g.body;
    inp.left = false; inp.right = false; inp.up = false;
    if (b.ground) { inp.jump = !g.prev.jump; this.kickDir = dir; this.kickT = 0; }
    else if (b.cling) { inp.jump = !g.prev.jump; if (inp.jump) { this.kickDir = -b.wall; this.kickT = 0; } }
    else { inp.jump = true; this.kickT = (this.kickT ?? 0) + 1; }
    const d = this.kickDir ?? dir;
    if (d > 0) inp.right = true; else inp.left = true;
    return inp;
  }
  passed(w) { const b = this.g.body, prev = this.ways[this.wi - 1]; const d = prev ? Math.sign(w.x - prev.x) || 1 : 1; return d > 0 ? b.x >= w.x : b.x <= w.x; }
  platAbove() { const b = this.g.body; for (let r = Math.floor(b.y / T) - 1; r > Math.floor(b.y / T) - 5; r--) for (const c of [Math.floor(b.x / T), Math.floor(b.x / T) + 1, Math.floor(b.x / T) - 1]) if (this.g.oneway(c, r)) return true; return false; }
  crackNear(w) { const c0 = Math.floor(w.x / T); for (let c = c0; c < c0 + 8; c++) for (let r = 0; r < ROWS; r++) if (this.g.tileAt(c, r) === '%') return true; return false; }
  doCharge(inp, w) {
    const g = this.g, b = g.body;
    if (g.lead !== 'enzo') return inp;
    if (g.power('enzo') !== 'cannon') { inp.next = !g.prev.next; return inp; }
    // a robot in the way: deal with it before charging at the crack
    const foe = g.foes.find((e) => e.alive && !e.hidden && Math.abs(e.x - b.x) < 64 && Math.abs(e.y - (b.y - 16)) < 40);
    if (foe && Math.sign(foe.x - b.x) === b.face && g.chargeLevel() >= 1) { inp.shoot = false; return inp; }
    if (Math.abs(w.x - b.x) > 6) { if (w.x > b.x) inp.right = true; else inp.left = true; return inp; }
    if (b.face < 0) { inp.right = true; return inp; }
    if (g.chargeLevel() < 3 || !g.prev.shoot) inp.shoot = true;
    return inp;
  }
  shootAhead(inp) {
    const g = this.g, b = g.body;
    const near = g.foes.some((e) => e.alive && !e.hidden && Math.sign(e.x - b.x) === b.face && Math.abs(e.x - b.x) < 200 && Math.abs(e.y - (b.y - 16)) < 30);
    if (!near) { if (g.lead === 'enzo' && g.chargeT > 0) inp.shoot = false; return; }
    if (g.lead === 'dora') inp.shoot = true;
    else { this.tapShoot = !this.tapShoot; inp.shoot = this.tapShoot; }
  }
  ride(inp) {
    const g = this.g, b = g.body;
    inp.right = true;
    const c = Math.floor((b.x + 30) / T);
    const barrier = this.solid(c, Math.floor((b.y - 2) / T)) || this.solid(c + 1, Math.floor((b.y - 2) / T));
    let gap = true;
    for (let r = Math.floor(b.y / T); r < Math.floor(b.y / T) + 3; r++) if (this.standOn(c + 1, r) || g.water(c + 1, r)) gap = false;
    // a low roof ahead (a tunnel at the waterline): stay low and ride through it
    let roof = false;
    for (let k = 0; k < 4; k++) for (let r = Math.floor((b.y - 60) / T); r <= Math.floor((b.y - 20) / T); r++) if (this.solid(Math.floor(b.x / T) + k, r)) roof = true;
    if (b.ground && (barrier || gap) && !roof && !g.prev.jump) inp.jump = true;
    this.shootAhead(inp);
    return inp;
  }
  /** pick the best power for the boss: its weakness if the save has it, else the base weapon */
  bossPower() {
    const g = this.g, bs = g.boss;
    if (!bs || !(bs.id in WEAK)) return null;
    const core = WEAK[bs.id];
    if (!g.save.beaten.includes(core)) return null;
    const p = POWERS.find((x) => x.hero === g.lead && x.core === core);
    return p && ['spark', 'magnet', 'toss', 'glob', 'prism', 'mine', 'strike', 'swarm'].includes(p.id) && g.heroes[g.lead].en >= p.cost ? p.id : null;
  }
  fight(inp, react) {
    const g = this.g, b = g.body, bs = g.boss;
    if (bs.st === 'intro') return inp;
    // the stronger shooter leads: Dora's rapid blaster is the steadier damage; swap out when hurt
    const lh = g.heroes[g.lead], oh = g.heroes[g.lead === 'dora' ? 'enzo' : 'dora'];
    if (lh.hp < 5 && !oh.down && oh.hp > lh.hp + 3 && g.tagCd === 0 && !g.prev.tag) { inp.tag = true; return inp; }
    if (lh.hp <= 4 && (oh.down || oh.hp <= 6) && g.save.tanks > 0 && g.tick - (this.tankT ?? -999) > 30) { this.tankT = g.tick; g.useTank(); }
    // select the weakness power if we have it, else the base weapon
    const want = this.bossPower() ?? (g.lead === 'dora' ? 'blaster' : 'cannon');
    if (g.power() !== want && !g.prev.next) { inp.next = true; return inp; }
    const box = bossBox(bs, g.tick), bx = box.x + box.w / 2, by = box.y + box.h / 2;
    const a = bs.arena, L = (a.c0 + 1) * T + 12, R = a.c1 * T - 12;
    // keep a fighting distance on the side with more room
    const ideal = bs.st === 'act' && ['scuttle', 'charge', 'drill', 'peck', 'roll', 'lunge', 'stab', 'sweep'].includes(bs.atk) ? 0 : 90;
    let tx = bx + (bx > (L + R) / 2 ? -ideal : ideal);
    tx = Math.max(L + 8, Math.min(R - 8, tx));
    const face = Math.sign(bx - b.x) || 1;
    if (Math.abs(tx - b.x) > 12) { if (tx > b.x) inp.right = true; else inp.left = true; }
    // shoot (face the boss first)
    const facing = b.face === face;
    if (!facing) { if (face > 0) { inp.right = true; inp.left = false; } else { inp.left = true; inp.right = false; } }
    if (!bs.hidden) {
      if (want === 'blaster') inp.shoot = true;
      else if (want === 'cannon') { if (g.chargeLevel() >= 2 && facing && Math.abs(by - (b.y - 20)) < 40) inp.shoot = false; else inp.shoot = true; }
      else inp.shoot = !g.prev.shoot;
    }
    // the magnet pulls: run against it. A burrowing boss: stay off its mark and jump as it bursts out
    if (bs.st === 'act' && bs.atk === 'pull') { inp.left = bx > b.x; inp.right = bx <= b.x; }
    if (bs.st === 'act' && bs.atk === 'burrow') {
      const away = bs.x > (L + R) / 2 ? -1 : 1;
      if (Math.abs(bs.x - b.x) < 70 || bs.t < 60) { inp.left = away < 0; inp.right = away > 0; }
      if (bs.t >= 74 + (this.r() < 0.5 ? 0 : 2) - Math.floor(4 * (1 - this.skill)) && bs.t <= 80 && b.ground && !g.prev.jump && this.r() < 0.9 * this.skill) { inp.jump = true; this.jumpHold = 20; }
    }
    // a boss up high: jump to shoot it (or stand on a ledge)
    if (box.y + box.h < b.y - 34 && b.ground && !g.prev.jump && facing && Math.abs(bx - b.x) < 160 && this.r() < 0.5) { inp.jump = true; this.jumpHold = 22; }
    // dodge: jump what's coming (after the reaction delay), and the big moves
    const dangerAct = bs.st === 'act' && (['slam', 'stomp', 'scuttle', 'charge', 'drill', 'peck', 'roll', 'sweep', 'hop', 'leap', 'jump', 'drop'].includes(bs.atk));
    const seenTell = bs.st === 'act' && bs.t >= this.delay - 2 && bs.t <= this.delay + 20;
    if (b.ground && !g.prev.jump && ((react && this.r() < 0.8 * this.skill) || (dangerAct && seenTell && this.r() < 0.5 * this.skill))) { inp.jump = true; this.jumpHold = 20; }
    if (this.jumpHold > 0) { this.jumpHold--; inp.jump = true; }
    // a dash out from under a big body
    if (dangerAct && seenTell && Math.abs(bx - b.x) < 60 && b.ground && this.r() < 0.4 * this.skill) { inp.dash = true; if (bx > b.x) { inp.left = true; inp.right = false; } else { inp.right = true; inp.left = false; } }
    // Enzo shields shots he sees coming
    if (g.lead === 'enzo' && react && g.shieldCd === 0 && this.r() < 0.3 * this.skill && b.ground) inp.shield = true;
    // the gallery and the beam: stay low
    return inp;
  }
  fightMini(inp, react) {
    const g = this.g, b = g.body;
    const e = g.foes.find((x) => x.mini && x.alive);
    if (!e) { inp.right = true; return inp; }
    const m = g.stage.mini, L = (m.c0 + 2) * T, R = (m.c1 - 1) * T;
    let tx = e.x + (e.x > (L + R) / 2 ? -100 : 100);
    tx = Math.max(L, Math.min(R, tx));
    if (Math.abs(tx - b.x) > 12) { if (tx > b.x) inp.right = true; else inp.left = true; }
    const face = Math.sign(e.x - b.x) || 1;
    if (b.face !== face && Math.abs(tx - b.x) <= 12) { if (face > 0) inp.right = true; else inp.left = true; }
    if (g.lead === 'dora') inp.shoot = true; else { this.tapShoot = !this.tapShoot; inp.shoot = this.tapShoot; }
    if (b.ground && !g.prev.jump && (react || (e.st === 'attack' && Math.abs(e.x - b.x) < 70)) && this.r() < 0.7 * this.skill) { inp.jump = true; this.jumpHold = 18; }
    if (this.jumpHold > 0) { this.jumpHold--; inp.jump = true; }
    return inp;
  }
}

/** the order the weaknesses suggest: each boss's core is the next one's weakness (the hub hints at it) */
export const ORDER = ['crab', 'mole', 'chameleon', 'peacock', 'firefly', 'owl', 'rhino', 'heron'];
const STAGE_BOSS = Object.fromEntries(BOSS_STAGES.map((id) => [id, STAGES[id].boss]));
/** the save a player brings to a stage's boss, playing in that order and opening the capsules they can reach */
export function progressSave(stage) {
  const s = freshSave(); s.intro = true; s.beaten.push('sentinel');
  const k = STAGE_BOSS[stage] ? ORDER.indexOf(STAGE_BOSS[stage]) : ORDER.length;
  for (const b of ORDER.slice(0, k)) s.beaten.push(b);
  if (k >= ORDER.length) s.beaten.push(...['spider', 'serpent'].slice(0, stage === 'tower2' ? 1 : stage === 'tower3' ? 2 : 0));
  // the capsules in the stages already cleared whose locks are open
  for (const b of ORDER.slice(0, k)) for (const it of STAGES[STAGE_OF[b]].items) if (reqMet(s, it.req ?? {})) s.items.push(it.id);
  s.tanks = tankCount(s);
  return s;
}

/** play a stage to its boss door (route) or through the boss (full) */
export function playStage(save, stage, { seed = 1, assist = true, delay = 13, skill = 1, maxTicks = 60 * 60 * 8, until = 'clear', detours = false } = {}) {
  const g = new OverclockGame(save, stage, { assist }, seed);
  const bot = new Bot(g, { seed, delay, skill });
  if (detours) bot.planDetours(save);
  for (let i = 0; i < maxTicks; i++) {
    if (until === 'door' && (g.boss || g.mode === 'boss' || (g.stage.gallery && g.body.x >= g.stage.gallery.pads[0].x - 20))) return { ok: true, g, ticks: i };
    if (g.mode === 'done') return { ok: true, g, ticks: i };
    g.step(bot.next());
    g.drainEvents();
  }
  return { ok: false, g, ticks: maxTicks, at: { x: Math.round(g.body.x), y: Math.round(g.body.y), wi: bot.wi, w: bot.ways[bot.wi], lead: g.lead, mode: g.mode } };
}

/** fight one boss from its door: up to `tries` attempts (a failed attempt reboots at the door checkpoint) */
export function fightBoss(save, stage, { seed = 1, assist = true, tries = 3, delay = 13, skill = 1 } = {}) {
  const g = new OverclockGame(save, stage, { assist }, seed);
  const bot = new Bot(g, { seed, delay: delay + Math.floor(rng(seed)() * 3), skill });
  const cps = g.checks();
  g.toCheckpoint(cps.length - 1);
  if (g.stage.gallery) { g.galleryDone = [...CORE_BOSSES]; g.teleport(g.stage.gallery.final.x - 30, g.stage.gallery.final.y); }
  else g.fightBoss();
  let attempts = 1, fails = 0;
  for (let i = 0; i < 60 * 60 * 6; i++) {
    if (g.mode === 'fail' && g.modeT === 1) { fails++; attempts++; if (attempts > tries) return { won: false, attempts: tries, g }; }
    if (g.mode === 'in' && fails > 0 && !g.boss) { if (g.stage.gallery) { g.galleryDone = [...CORE_BOSSES]; g.teleport(g.stage.gallery.final.x - 30, g.stage.gallery.final.y); } else g.fightBoss(); }
    if (g.mode === 'clear' || g.mode === 'out' || g.mode === 'done') return { won: true, attempts, g };
    let inp = bot.next();
    if (g.mode === 'play' && !g.boss) { inp = { ...NO_INPUT, right: !g.stage.gallery || g.body.x < g.stage.gallery.final.x, left: !!g.stage.gallery && g.body.x > g.stage.gallery.final.x + 4 }; }
    g.step(inp);
    g.drainEvents();
  }
  return { won: false, attempts, g, timeout: true };
}

// ─── run ────────────────────────────────────────────────────────────────────
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const t0 = Date.now();
  let checks = 0;
  // 1. the route bot finishes every stage
  const all = ['intro', ...BOSS_STAGES, 'tower1', 'tower2', 'tower3'];
  const routeSave = freshSave(); routeSave.intro = true;
  for (const id of all) {
    const seeds = QUICK ? [1] : [1, 2, 3];
    for (const seed of seeds) {
      const r = playStage(routeSave, id, { seed, until: 'door' });
      assert.ok(r.ok, `route bot finishes ${id} (seed ${seed}): stuck at ${JSON.stringify(r.at)}`);
      checks++;
      if (VERBOSE) console.log(`  route ${id} seed ${seed}: ${(r.ticks / 60).toFixed(0)} s, hurt ${r.g.stats.hurt}, falls ${r.g.stats.falls}`);
    }
  }
  console.log(`route bot: all ${all.length} stages finished`);
  // 2. bosses: casual (assist) and pro (strict), three attempts each, each with the save a player brings to it
  //    playing in the order the weakness hints suggest
  const seeds = QUICK ? 8 : 20;
  const table = [];
  for (const id of ['intro', ...BOSS_STAGES, 'tower1', 'tower2', 'tower3']) {
    const row = { id };
    for (const [mode, assist, skill, need] of [['casual', true, 0.85, 0.85], ['pro', false, 1, 0.7]]) {
      let wins = 0, tries = 0;
      for (let s = 1; s <= seeds; s++) {
        const r = fightBoss(progressSave(id), id, { seed: s * 7 + 1, assist, skill, delay: 12 + (s % 4) });
        if (r.won) { wins++; tries += r.attempts; }
      }
      row[mode] = wins / seeds; row[mode + 'Tries'] = wins ? +(tries / wins).toFixed(2) : 0;
      assert.ok(wins / seeds >= need, `${mode} beats ${id} within 3 attempts in ${Math.round((wins / seeds) * 100)}% of seeds (needs ${need * 100}%)`);
      checks++;
    }
    table.push(row);
  }
  for (const r of table) console.log(`  ${r.id.padEnd(12)} casual ${(r.casual * 100).toFixed(0).padStart(3)}% (avg ${r.casualTries} tries)   pro ${(r.pro * 100).toFixed(0).padStart(3)}% (avg ${r.proTries} tries)`);
  // 2b. any boss can be picked first: every district boss must be fair with the starting kit (no cores, no capsules)
  const bare = freshSave(); bare.intro = true; bare.beaten = ['sentinel'];
  const bareTable = [];
  for (const id of BOSS_STAGES) {
    const row = { id };
    for (const [mode, assist, skill, need] of [['casual', true, 0.85, 0.85], ['pro', false, 1, 0.5]]) {
      let wins = 0, tries = 0;
      for (let s = 1; s <= seeds; s++) {
        const r = fightBoss(bare, id, { seed: s * 7 + 1, assist, skill, delay: 12 + (s % 4) });
        if (r.won) { wins++; tries += r.attempts; }
      }
      row[mode] = wins / seeds; row[mode + 'Tries'] = wins ? +(tries / wins).toFixed(2) : 0;
      assert.ok(wins / seeds >= need, `${mode} beats ${id} with no cores within 3 attempts in ${Math.round((wins / seeds) * 100)}% of seeds (needs ${need * 100}%)`);
      checks++;
    }
    bareTable.push(row);
  }
  console.log('no cores (any boss first):');
  for (const r of bareTable) console.log(`  ${r.id.padEnd(12)} casual ${(r.casual * 100).toFixed(0).padStart(3)}% (avg ${r.casualTries} tries)   pro ${(r.pro * 100).toFixed(0).padStart(3)}% (avg ${r.proTries} tries)`);
  // 3. the full run: every capsule, in a sensible order, revisiting cleared stages
  let save = freshSave();
  const order = ['intro', ...ORDER.map((b) => STAGE_OF[b])];
  const playFull = (id) => {
    const r = playStage(save, id, { seed: 5, detours: true, maxTicks: 60 * 60 * 15 });
    assert.ok(r.ok, `full-run bot clears ${id}: ${JSON.stringify(r.at)}`);
    save = r.g.save; checks++;
  };
  for (const id of order) playFull(id);
  // revisit: each stage whose city change has come, until nothing more can be found
  for (let pass = 0; pass < 3; pass++) for (const id of BOSS_STAGES) {
    const left = STAGES[id].items.filter((i) => !save.items.includes(i.id) && reqMet(save, i.req));
    if (left.length) playFull(id);
  }
  const missing = BOSS_STAGES.flatMap((id) => STAGES[id].items.filter((i) => !save.items.includes(i.id)).map((i) => i.id));
  assert.deepEqual(missing, [], 'the full run finds every capsule');
  for (const id of ['tower1', 'tower2', 'tower3']) playFull(id);
  assert.ok(save.ending, 'the full run reaches the ending');
  console.log(`full run: all ${BOSS_STAGES.flatMap((id) => STAGES[id].items).length} capsules found, ending reached (${tankCount(save)} tanks, ${save.bolts} bolts)`);
  console.log(`overclock bot: ${checks} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
