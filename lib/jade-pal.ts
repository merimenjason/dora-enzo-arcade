// Jade Street: the partner thinking for themselves (Settings: "Partner helps on their own"). F still sends them on the
// tag moves (lib/jade-tag.ts); this is what they do unasked, each with its own painted pose:
//   - warn you of a lookout, guard, camera or warden coming into view: a crouched "Psst, crow at the corner!" and a gold
//     paw pointing at it for a few seconds;
//   - fire their own gadget (a wind-up, then the shot) at a raider at the stand, a crow swooping at the lion, a cargo
//     snatcher or a gang member running off with something, on a cooldown. Never at a warden or townsfolk: their shots
//     carry `auto` and pass straight through anyone who isn't fair game (lib/jade-gear.ts);
//   - scoop up dropped loot that lands near them and hand it to you;
//   - cower where they are when you hide and a guard is close;
//   - on a loud heist's getaway, run to the getaway scooter and beckon you over (they hop on when you do);
//   - on a defend job, tidy the stand between waves (and fire at raiders, from their guard post).
// "Only when I press F" turns all of this off (the pass 7 partner); "Off" also leaves defend and escort jobs to you (the
// partner waits instead of guarding), though F still sends them where a job needs two. With a second player the
// partner is a person, so none of this runs.
import { dist } from './jade-rng.js';
import { carried, fire, GADGETS, type Target } from './jade-gear.js';
import { bark } from './jade-sg.js';
import type { World, Player } from './jade-game.js';
import type { Actor } from './jade-mission.js';

export type PalState = {
  /** seconds until the next warning / shot may happen */
  warnCd: number; fireCd: number;
  /** actor ids (and warden ids, +1e6) already pointed out this job */
  warned: number[];
  /** the gold pointing paw: where it points, and for how long more */
  point: { x: number; y: number; t: number } | null;
  /** what the partner is doing on their own right now (for the drawing and the tests) */
  doing: '' | 'warn' | 'fire' | 'scoop' | 'cower' | 'getaway' | 'tidy';
  /** counts for the tests: warnings, shots, scoops, tidies */
  n: { warn: number; fire: number; scoop: number; tidy: number; cower: number; getaway: number };
  /** the job the warnings belong to */
  runRef: unknown;
};
export const newPal = (): PalState => ({ warnCd: 2, fireCd: 2, warned: [], point: null, doing: '', n: { warn: 0, fire: 0, scoop: 0, tidy: 0, cower: 0, getaway: 0 }, runRef: null });

export const palOn = (w: World) => w.s.settings.partner === 'auto' && !w.two;

const WARN: Record<string, string[]> = {
  lookout: ['Psst, crow at the corner!', 'Psst! Lookout ahead!', 'Psst, a crow with a torch, over there!'],
  guard: ['Psst, guard ahead!', 'Psst! Torch coming our way!', 'Psst, a guard on patrol!'],
  liz: ['Psst, lizard on watch!', 'Psst! A lizard guard, there!'],
  watcher: ['Psst, crow watching the plaza!', 'Psst! Lookout up there!'],
  cam: ['Psst, camera!', 'Psst! A camera on the wall!'],
  warden: ['Psst, warden!', 'Psst! Ticket warden, there!'],
};

/** what the partner may fire at: only the troublemakers coming for you or your stall, never a warden or townsfolk */
function foes(w: World): { x: number; y: number; ref: unknown }[] {
  const out: { x: number; y: number; ref: unknown }[] = [];
  const run = w.run;
  if (run) for (const a of run.actors) {
    if (a.gone || a.stun > 0) continue;
    if (a.kind === 'pest' && a.extra !== 2) out.push({ x: a.b.x, y: a.b.y, ref: a });
    if (a.kind === 'swoop' || a.kind === 'bagbird' || a.kind === 'raider') out.push({ x: a.b.x, y: a.b.y, ref: a });
  }
  for (const s of w.snatchers) if (!s.out) out.push({ x: s.x, y: s.y, ref: s });
  const ge = w.gangs.ev; if (ge && !ge.done) for (const m of ge.mobs) if ((m.st === 'run' || m.st === 'leap') && m.has) out.push({ x: m.b.x, y: m.b.y, ref: m });
  return out;
}
/** is this a target the partner's own shot may touch? (lib/jade-gear.ts asks, for shots marked `auto`) */
export function palFair(t: Target) { return t.fair && t.kind !== 'warden' && t.kind !== 'ped' && !(t.kind === 'actor' && ['guard', 'lookout', 'watcher', 'cam', 'pip', 'crowd', 'witness', 'lured', 'runner'].includes((t.ref as Actor).kind)); }

/** one step, after the partner's own (lib/jade-duo.ts mateStep) */
export function palStep(w: World, dt: number) {
  const pal = w.pal, m = w.mate, p = w.p;
  pal.warnCd = Math.max(0, pal.warnCd - dt); pal.fireCd = Math.max(0, pal.fireCd - dt);
  if (pal.point) { pal.point.t -= dt; if (pal.point.t <= 0) pal.point = null; }
  if (!palOn(w)) { if ((pal.doing === 'getaway' || pal.doing === 'scoop') && m.ai.mode === 'post' && !m.ai.story) m.ai = { ...m.ai, mode: 'follow', at: null }; pal.doing = ''; return; }
  const run = w.run;
  if (pal.runRef !== (run ?? null)) { pal.runRef = run ?? null; pal.warned = []; }
  // a one-shot move ends with its pose; the getaway, the scoop and hiding last until their own clean-up below
  if (pal.doing && !m.act && pal.doing !== 'getaway' && pal.doing !== 'scoop' && pal.doing !== 'cower') pal.doing = '';
  const st = run?.cur;
  const free = !m.act && !m.hide && !m.ride && m.stunT <= 0;

  // you hid with a guard close by: they freeze and curl up where they are (not run across the guard's torch to you)
  if (p.hide && !m.seat && !m.hide && m.ai.mode === 'follow' && run) {
    let gd = 1e9; for (const a of run.actors) if ((a.kind === 'guard' || a.kind === 'lookout') && !a.gone) gd = Math.min(gd, dist(a.b.x, a.b.y, m.x, m.y));
    if (gd < 420 && dist(m.x, m.y, p.x, p.y) > 40) {
      // curled up tight when a guard is close; peeking out over their paws when it is further off
      if (!m.act) { m.act = { n: gd < 260 ? 'cower' : 'peek', t: 0, dur: 0.4 }; m.b.speed = 0; if (pal.doing !== 'cower') pal.n.cower++; pal.doing = 'cower'; }
      return;
    }
  }
  if (pal.doing === 'cower') pal.doing = '';

  // the loud heist's getaway: off to the scooter, beckoning you over (follow mode boards it when you do)
  if (st?.t === 'heist' && run!.js?.mode === 'loud' && run!.js.ph === 3 && !p.ride && !m.seat) {
    const r = w.rides.filter(r => r.kind === 'scooter' && r.parked && !r.locked).sort((a, b) => dist(a.b.x, a.b.y, m.x, m.y) - dist(b.b.x, b.b.y, m.x, m.y))[0];
    if (r && dist(r.b.x, r.b.y, p.x, p.y) < 700) {
      if (m.ai.mode === 'follow' || (m.ai.mode === 'post' && pal.doing === 'getaway')) {
        if (pal.doing !== 'getaway') { pal.n.getaway++; bark(w, m.x, m.y - 50, ['To the scooter! Quick!', 'Over here! Let’s go!'], true); }
        pal.doing = 'getaway';
        const gx = r.b.x + 34, gy = r.b.y + 34;
        if (dist(m.x, m.y, gx, gy) > 48) m.ai = { ...m.ai, mode: 'post', at: [gx, gy], story: false };
        else { m.b.speed = 0; m.anim = 'beckon'; m.face = 'side'; m.flip = p.x < m.x; }
        return;
      }
    }
  }
  if (pal.doing === 'getaway' && (p.ride || st?.t !== 'heist')) { pal.doing = ''; if (m.ai.mode === 'post' && !m.ai.story) m.ai = { ...m.ai, mode: 'follow', at: null }; }

  // loot dropped near them: they scoop it up and hand it over
  if (st?.t === 'pickup' && run!.loot && free && !m.seat) {
    const L = run!.loot, d = dist(L.x, L.y, m.x, m.y);
    if (d < 260 && dist(L.x, L.y, p.x, p.y) > 60) {
      if (d < 34) {
        m.act = { n: 'scoop', t: 0, dur: 0.45, then: () => { if (run!.loot && run!.cur?.t === 'pickup') { m.act = { n: 'hold-bag', t: 0, dur: 0.6 }; run!.grabPickup(); pal.n.scoop++; bark(w, m.x, m.y - 50, ['Got it! Here you go.', 'Caught it!', 'Mine! I mean, yours.'], true); w.s.stats.palHelps = (w.s.stats.palHelps ?? 0) + 1; } } };
        pal.doing = 'scoop'; return;
      }
      if (m.ai.mode === 'follow') { m.ai = { ...m.ai, mode: 'post', at: [L.x, L.y], story: false }; pal.doing = 'scoop'; }
    }
  }
  if (pal.doing === 'scoop' && !m.act && (!run?.loot || st?.t !== 'pickup')) { pal.doing = ''; if (m.ai.mode === 'post' && !m.ai.story) m.ai = { ...m.ai, mode: 'follow', at: null }; }

  // defend: between waves, tidy the stand
  if (st?.t === 'defend' && run!.js && free && !m.seat) {
    const js = run!.js, [tx, ty] = run!.spot(st.at);
    const calm = !run!.actors.some(a => a.kind === 'pest' && a.extra !== 2);
    if (calm && js.hp < 0.95 && js.mendW !== js.wave && js.left > 3) {
      if (dist(m.x, m.y, tx, ty) < 70) {
        js.mendW = js.wave;
        m.act = { n: 'brace', t: 0, dur: 1.2, then: () => { js.hp = Math.min(1, js.hp + 0.1); pal.n.tidy++; w.fx.push({ t: 'job-mend', x: m.x, y: m.y }); w.s.stats.palHelps = (w.s.stats.palHelps ?? 0) + 1; } };
        pal.doing = 'tidy'; bark(w, m.x, m.y - 50, ['I’ll tidy up!', 'Quick, fix the stand!'], true); return;
      }
      if (m.ai.mode === 'guard') { m.ai = { ...m.ai, at: [tx, ty] }; }
    }
  }

  // their own shot at a troublemaker, on a cooldown (a wind-up first, so you can see it coming)
  const g = carried(w.s, m.who);
  if (g && pal.fireCd <= 0 && (free || m.seat) && w.s.gear.clip[g] > 0) {
    const range = GADGETS[g].range * 0.85;
    const f = foes(w).filter(o => dist(o.x, o.y, m.x, m.y) < range && dist(o.x, o.y, p.x, p.y) < 620).sort((a, b) => dist(a.x, a.y, m.x, m.y) - dist(b.x, b.y, m.x, m.y))[0];
    if (f) {
      pal.fireCd = w.assist ? 3 : 4;
      const shoot = () => { const ref = f.ref as { b?: { x: number; y: number }; x?: number; y?: number }; const x = ref.b ? ref.b.x : ref.x ?? f.x, y = ref.b ? ref.b.y : ref.y ?? f.y; const n = w.shots.length; if (fire(w, m, x, y) === null) { for (let i = n; i < w.shots.length; i++) w.shots[i].auto = true; pal.n.fire++; w.s.stats.palHelps = (w.s.stats.palHelps ?? 0) + 1; } };
      if (m.seat) shoot();
      else { m.act = { n: 'ready', t: 0, dur: 0.35, then: shoot }; m.face = 'side'; m.flip = f.x < m.x; m.b.speed = 0; pal.doing = 'fire'; }
      return;
    }
  }

  // a warning: a lookout, guard, camera or warden coming into view
  if (pal.warnCd <= 0 && free && !m.seat) {
    let best: { x: number; y: number; id: number; kind: string } | null = null, bd = 1e9;
    if (run) for (const a of run.actors) {
      if (a.gone || pal.warned.includes(a.id)) continue;
      const kind = a.kind === 'guard' ? (a.skin === 'liz' ? 'liz' : 'guard') : a.kind;
      if (!WARN[kind]) continue;
      const d = dist(a.b.x, a.b.y, p.x, p.y);
      if (d < 520 && d > 150 && d < bd) { bd = d; best = { x: a.b.x, y: a.b.y, id: a.id, kind }; }
    }
    if (!run || !best) for (const pt of w.patrols) {
      const id = 1e6 + pt.id; if (pal.warned.includes(id) || pt.ride) continue;
      const d = dist(pt.b.x, pt.b.y, p.x, p.y);
      if (d < 460 && d > 160 && d < bd && (p.ride || w.heat > 0)) { bd = d; best = { x: pt.b.x, y: pt.b.y, id, kind: 'warden' }; }
    }
    if (best) {
      pal.warned.push(best.id); pal.warnCd = best.kind === 'warden' ? 25 : 6; pal.n.warn++;
      pal.point = { x: best.x, y: best.y, t: 3 };
      const side = Math.abs(best.x - m.x) > Math.abs(best.y - m.y);
      m.act = { n: side ? 'psst-side' : 'psst-down', t: 0, dur: 1 }; m.face = side ? 'side' : 'down'; m.flip = best.x < m.x; m.b.speed = 0;
      pal.doing = 'warn';
      bark(w, m.x, m.y - 50, WARN[best.kind], true);
      w.fx.push({ t: 'pal-warn', x: best.x, y: best.y, kind: best.kind });
    }
  }
}
