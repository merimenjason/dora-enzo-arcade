// Jade Street: the chase set pieces. Each heirloom chase has scripted moments that fire when the thief reaches a leg
// of its route, every one telegraphed before it can hurt: the Jade Dragon cart smashes through a fruit stall and
// leaves a heap of rubble on the road (red rings show where it will land); drums tumble off the temple steps across
// the road in lanes that glow first; the canal drawbridge rings its bell and swings down behind the magpie boat (get
// under it before it closes, or wait while the boat gets away); a dock crane swings a container back and forth over
// the road (its shadow shows where); and the yard gate's lamps flash before it rolls shut. A hit stops you for a
// moment (no damage): it costs ground, and the getaway meter does the rest. All timings are seeded and stepped at
// 1/60 s; the scene draws them (lib/jade-setdraw.ts). Telegraphs are longer on Assist and a little shorter on Hard.
import { T, W, S } from './jade-city.js';
import { dist } from './jade-rng.js';
import { nearestFree } from './jade-nav.js';
import type { SetDef } from './jade-story.js';
import type { Run } from './jade-mission.js';

export type Chunk = { x: number; y: number; r: number; hit: boolean; sprite: string; rot: number };
export type Drum = { x: number; y: number; vy: number; delay: number; hit: boolean; on: boolean };
export type SetState = {
  def: SetDef; x: number; y: number; ph: 'wait' | 'warn' | 'go' | 'done'; t: number;
  /** the stall's rubble, the drums, the crane's swing offset, the gate's span, the bridge's lowering (0 up, 1 down) */
  rubble: Chunk[]; drums: Drum[]; swing: number; span: [number, number]; down: number; cd: number; told: boolean;
};
export const SET_NAME: Record<SetDef['k'], string> = { stall: 'the smashed stall', drums: 'the tumbling drums', bridge: 'the drawbridge', crane: 'the swinging container', gate: 'the closing gate' };

/** how long a warning lasts before the hazard is live */
export function telegraph(run: Run, base: number) { return base * (run.w.assist ? 1.35 : 1) * (run.w.s.settings.diff === 'hard' ? 0.85 : 1); }

export function makeSets(run: Run, defs: SetDef[] | undefined): SetState[] {
  return (defs ?? []).map(def => {
    const x = def.at[0] * T + T / 2, y = def.at[1] * T + T / 2;
    const s: SetState = { def, x, y, ph: 'wait', t: 0, rubble: [], drums: [], swing: 0, span: [def.at[0], def.at[0]], down: 0, cd: 0, told: false };
    if (def.k === 'gate') {
      // the gate runs along its row across the open yard, from a wall or the water on one side up to six tiles each way
      const c = run.w.c; const row = def.at[1]; let a = def.at[0], b = def.at[0];
      while (a > def.at[0] - 6 && c.solid[row * W + a - 1] === S.OPEN) a--;
      while (b < def.at[0] + 6 && c.solid[row * W + b + 1] === S.OPEN) b++;
      s.span = [a, b];
    }
    if (def.k === 'crane') s.ph = 'go';
    return s;
  });
}
/** tiles the set pieces close right now (the lowered bridge to boats, the shut gate to everyone) */
export function closedTiles(sets: SetState[], out: Set<number>) {
  for (const s of sets) {
    if (s.def.k === 'bridge' && s.down > 0.6) for (const dy of [-1, 0]) for (let dx = -1; dx <= 1; dx++) out.add((s.def.at[1] + dy) * W + s.def.at[0] + dx);
    if (s.def.k === 'gate' && s.ph === 'go') for (let x = s.span[0]; x <= s.span[1]; x++) out.add(s.def.at[1] * W + x);
  }
}

export function stepSets(run: Run, dt: number) {
  const w = run.w, a = run.actors[0]; if (!a) return;
  const p = w.p, pb = p.ride ? p.ride.b : p.b;
  const near = (s: SetState, tiles: number) => a.wp >= s.def.wp && dist(a.b.x, a.b.y, s.x, s.y) < tiles * T;
  for (const s of run.sets) {
    s.t += dt; s.cd = Math.max(0, s.cd - dt);
    switch (s.def.k) {
      case 'stall': {
        if (s.ph === 'wait' && near(s, 6)) {
          s.ph = 'warn'; s.t = 0;
          // the rubble lands on the road beside the stall, spread along the way the cart is going
          const [rx, ry] = nearestFree(w.c, 'small', s.x, s.y - T * 2, w.open, 3);
          const fx = Math.cos(a.b.h), fy = Math.sin(a.b.h);
          s.rubble = [[-40, -18], [10, 20], [60, -10], [110, 18], [150, -20]].map(([along, side], i) => ({ x: rx + fx * along - fy * side, y: ry + fy * along + fx * side, r: 24, hit: false, sprite: ['db-plank', 'db-orange', 'db-shard', 'db-melon', 'db-plank'][i], rot: i * 1.3 }));
          run.warn('The cart is heading for the fruit stall! Steer round the red rings!');
        } else if (s.ph === 'warn' && s.t > telegraph(run, 1.1)) { s.ph = 'go'; s.t = 0; w.fx.push({ t: 'smash', x: s.x, y: s.y, k: 1, kind: 'fruit' }); }
        else if (s.ph === 'go') {
          if (!p.roof) for (const c of s.rubble) if (!c.hit && dist(c.x, c.y, pb.x, pb.y) < c.r + pb.r) { c.hit = true; w.knock(c.x, c.y, 0.6, 'fruit', p.ride ? 0.35 : 0.2, 0.3); }
          if (s.t > 9) s.ph = 'done';
        }
        break;
      }
      case 'drums': {
        if (s.ph === 'wait' && near(s, 3.5)) {
          s.ph = 'warn'; s.t = 0;
          s.drums = [-2, 0, 2].map((k, i) => ({ x: s.x + k * T, y: s.y - 2.2 * T, vy: 300, delay: i * 0.3, hit: false, on: false }));
          run.warn('Pip kicked the temple drums loose! Steer between the glowing lanes!');
          w.fx.push({ t: 'rumble', x: s.x, y: s.y });
        } else if (s.ph === 'warn' && s.t > telegraph(run, 1.4)) { s.ph = 'go'; s.t = 0; }
        else if (s.ph === 'go') {
          for (const d of s.drums) {
            if (s.t < d.delay) continue; d.on = true; d.y += d.vy * dt;
            if (!d.hit && !p.roof && dist(d.x, d.y, pb.x, pb.y) < 22 + pb.r) { d.hit = true; w.knock(d.x, d.y, 0.8, 'drum', 0.55, 0.15); }
          }
          if (s.drums.every(d => d.y > s.y + 6 * T)) s.ph = 'done';
        }
        break;
      }
      case 'bridge': {
        // up (open to boats) until the magpie boat has gone under; then the bell, the lowering, a closed spell, the lift
        if (s.ph === 'wait' && a.wp >= s.def.wp && a.b.y > s.y + 1.2 * T) { s.ph = 'warn'; s.t = 0; run.warn('Clang! The drawbridge is coming down. Get under it before it closes!'); w.fx.push({ t: 'bell', x: s.x, y: s.y }); }
        else if (s.ph === 'warn') { if (s.t > telegraph(run, 2.2)) { s.ph = 'go'; s.t = 0; } else if (Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2)) w.fx.push({ t: 'bell', x: s.x, y: s.y }); }
        else if (s.ph === 'go') {
          const lower = 2.4, shut = w.assist ? 4 : 5.5, lift = 1.6;
          s.down = s.t < lower ? s.t / lower : s.t < lower + shut ? 1 : Math.max(0, 1 - (s.t - lower - shut) / lift);
          if (s.t > lower + shut + lift) { s.ph = 'done'; s.down = 0; }
          if (s.down > 0.6 && p.ride?.kind === 'boat' && Math.abs(pb.y - s.y) < 1.5 * T && Math.abs(pb.x - s.x) < 2 * T && s.cd <= 0) { s.cd = 1.5; run.warn('Blocked! Wait for the bridge to lift.'); }
        }
        break;
      }
      case 'crane': {
        // a pendulum across the road: the shadow on the ground shows where the container will swing through
        const period = w.assist ? 3.8 : 3.2;
        s.swing = Math.sin(s.t * Math.PI * 2 / period) * 2.4 * T;
        const cx = s.x + s.swing, cy = s.y;
        if (!s.told && dist(cx, cy, pb.x, pb.y) < 9 * T) { s.told = true; run.warn('Mind the swinging container: watch its shadow!'); w.fx.push({ t: 'creak', x: s.x, y: s.y }); }
        if (!p.roof && s.cd <= 0 && dist(cx, cy, pb.x, pb.y) < 40 + pb.r) { s.cd = 1.4; w.knock(cx, cy, 0.9, 'spark', 0.7, 0.1); }
        break;
      }
      case 'gate': {
        if (s.ph === 'wait' && a.wp >= s.def.wp && a.b.y > s.y + T) { s.ph = 'warn'; s.t = 0; run.warn('The yard gate is closing! Get through before it shuts!'); w.fx.push({ t: 'alarm', x: s.x, y: s.y }); }
        else if (s.ph === 'warn' && s.t > telegraph(run, 2.4)) {
          s.ph = 'go'; s.t = 0; w.fx.push({ t: 'clang', x: s.x, y: s.y });
          // anyone standing in the gateway is nudged to the side they were heading from
          if (Math.abs(pb.y - s.y) < T * 0.9 && pb.x >= s.span[0] * T - T && pb.x <= (s.span[1] + 1) * T + T) pb.y = s.y + (pb.y < s.y ? -T * 0.9 : T * 0.9);
        } else if (s.ph === 'go' && s.t > (w.assist ? 5 : 7)) { s.ph = 'done'; w.fx.push({ t: 'clang', x: s.x, y: s.y }); }
        break;
      }
    }
  }
}
