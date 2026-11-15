// Jade Street drawing for the job steps (lib/jade-jobs.ts): the crows' security guards with their torch beams, the
// sweeping cameras (and painted-over ones), the gangs raiding a stand, lookouts and the crowd in a blend, witnesses,
// the gang walking into a trap, and the props: what you can photograph, the safe and the back door, the clothes rack,
// search piles, nets (laid, ready, sprung), bait and crates. All painted sprites; code adds only light, rings and
// shadow. The Assist hint ring of a detective step is a soft circle, never a pin.
import { spr } from './jade-scene.js';
import { sightRange } from './jade-jobs.js';
import type { Scene } from './jade-scene.js';
import type { World } from './jade-game.js';
import type { Actor, Run } from './jade-mission.js';

type X = CanvasRenderingContext2D;
const PROP: Record<string, string> = {
  'case-door': 'job-door', 'case-rota': 'job-rota', 'case-cam': 'job-cam', 'case-safe': 'job-safe',
  'safe-shut': 'job-safe', 'safe-open': 'job-safe-open', 'back-door': 'job-door', 'disguise-rack': 'job-rack', 'search-pile': 'job-pile',
  'trap-spot': 'job-net', 'trap-set': 'job-net', 'trap-ready': 'job-net', 'trap-sprung': 'job-net-sprung', bait: 'job-bait', 'crate-shut': 'job-crate', 'crate-fake': 'job-crate-fake',
};
const PROP_W: Record<string, number> = { 'job-door': 54, 'job-rota': 46, 'job-cam': 34, 'job-safe': 46, 'job-safe-open': 46, 'job-rack': 46, 'job-pile': 52, 'job-net': 50, 'job-net-sprung': 42, 'job-bait': 30, 'job-crate': 44, 'job-crate-fake': 44 };
const isJob = (t: string) => ['case', 'heist', 'defend', 'blend', 'detective', 'trap', 'swap'].includes(t);

/** the step's props on the ground (true: the generic item markers are not drawn) */
export function jobGround(sc: Scene, x: X, w: World, run: Run): boolean {
  const st = run.cur; if (!st || !isJob(st.t)) return false;
  const js = run.js, t = sc.t, pulse = 0.5 + Math.sin(t * 4) * 0.5;
  run.items.forEach((it, i) => {
    const f = PROP[it.sprite] ?? it.sprite, wd = PROP_W[f] ?? 34;
    if (st.t === 'trap' && it.sprite === 'trap-spot') { x.save(); x.globalAlpha = 0.35 + pulse * 0.3; spr(x, f, it.x, it.y + 12, { w: wd }); x.restore(); sc.glow(x, it.x, it.y, 40, 'rgba(255,220,120,.35)'); return; }
    if (st.t === 'trap' && (it.sprite === 'trap-set' || it.sprite === 'trap-ready')) {
      const r = run.assist ? 70 : 52; x.save(); x.strokeStyle = it.sprite === 'trap-ready' ? `rgba(120,255,160,${0.5 + pulse * 0.5})` : 'rgba(255,255,255,.35)'; x.lineWidth = it.sprite === 'trap-ready' ? 4 : 2; x.setLineDash([8, 6]);
      x.beginPath(); x.ellipse(it.x, it.y + 6, r, r * 0.6, 0, 0, Math.PI * 2); x.stroke(); x.restore();
    }
    if (st.t === 'case' && it.got) { spr(x, f, it.x, it.y + 12, { w: wd, alpha: 0.85 }); return; }
    if (st.t === 'detective' && js?.searched.includes(i)) { spr(x, 'job-mess', it.x, it.y + 10, { w: 44 }); return; }
    if (st.t === 'case' || (st.t === 'detective' && !it.got) || (st.t === 'swap' && !it.got) || (st.t === 'blend' && js?.ph === 0)) sc.glow(x, it.x, it.y, 46, 'rgba(255,200,80,.35)');
    if (st.t === 'heist' && it.sprite === 'back-door' && !run.intel.includes('door')) { spr(x, f, it.x, it.y + 12, { w: wd, alpha: 0.7 }); return; }
    if (it.got && st.t !== 'swap' && st.t !== 'heist') return;
    spr(x, f, it.x, it.y + 12, { w: wd });
    if (st.t === 'case' && !it.got) sc.cb(x, 'item', it.x + 24, it.y - 30);
  });
  // the stand you defend: a ring that reddens as it is raided
  if (st.t === 'defend' && js) { const [tx, ty] = run.spot(st.at); const hp = js.hp; x.save(); x.strokeStyle = `rgba(${Math.round(255 - hp * 135)},${Math.round(90 + hp * 165)},120,.7)`; x.lineWidth = 4; x.setLineDash([12, 8]); x.beginPath(); x.ellipse(tx, ty + 6, 64, 38, 0, 0, Math.PI * 2); x.stroke(); x.restore(); }
  // the blend's goal and the trap's waiting spot: soft rings, so you know where to stand
  if (st.t === 'blend' && js && js.ph === 1) { const [gx, gy] = run.spot(st.goal); sc.glow(x, gx, gy, 70, 'rgba(120,220,255,.3)'); }
  if (st.t === 'trap' && js && js.ph === 2) { const [wx, wy] = run.spot(st.wait); x.save(); x.strokeStyle = 'rgba(160,220,255,.5)'; x.lineWidth = 3; x.beginPath(); x.ellipse(wx, wy + 6, 50, 30, 0, 0, Math.PI * 2); x.stroke(); x.restore(); }
  if (st.t === 'heist' && js && js.mode === 'quiet' && !js.entered && js.entry) sc.glow(x, js.entry[0], js.entry[1], 60, 'rgba(120,220,255,.35)');
  // Assist: where the clues point, a ring that narrows (no pin)
  if (run.hint) { const h = run.hint; x.save(); x.strokeStyle = `rgba(255,230,140,${0.35 + pulse * 0.25})`; x.lineWidth = 5; x.setLineDash([14, 10]); x.beginPath(); x.arc(h.x, h.y, h.r, 0, Math.PI * 2); x.stroke(); x.restore(); }
  void w;
  return true;
}

/** the people of the job steps (true: drawn here) */
export function jobActor(sc: Scene, x: X, w: World, a: Actor): boolean {
  const b = a.b, fl = Math.floor(a.t * 5) % 2, cx = Math.cos(b.h), sy = Math.sin(b.h), side = Math.abs(cx) > Math.abs(sy);
  switch (a.kind) {
    case 'guard': {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 16, 7);
      const dazed = a.hits === 1 && (a.extra2 ?? 0) > 0, painted = (a.extra2 ?? 0) > 0 && !dazed;
      if (!dazed && !painted && !((a.stare ?? 0) > 0)) sc.beam(x, b.x, b.y - 20, b.h, sightRange(w.run!), w.assist ? 0.45 : 0.55);
      let f: string;
      if (a.skin === 'liz') { f = (a.stare ?? 0) > 0 ? 'liz-taunt' : b.speed < 5 ? (a.look > 0 ? 'liz-lepak' : 'liz-walk-down-0') : side ? `liz-run-${fl}` : `liz-walk-${sy > 0 ? 'down' : 'up'}-${fl}`; spr(x, f, b.x, b.y + 4, { flip: side && cx < 0, w: 56 }); if (painted) spr(x, 'sp-teal', b.x, b.y - 30, { w: 24 }); return true; }
      if (dazed) f = 'guard-dazed';
      else if (w.run?.js?.alarm && (a.stare ?? 0) > 0) f = 'guard-alarm';
      else if (b.speed < 5) f = side ? 'guard-side-0' : `guard-${sy > 0 ? 'down' : 'up'}-0`;
      else f = side ? `guard-side-${fl}` : `guard-${sy > 0 ? 'down' : 'up'}-${fl}`;
      spr(x, f, b.x, b.y + 4, { flip: side && cx < 0 });
      if (painted) spr(x, 'sp-teal', b.x, b.y - 34, { w: 26 });
      if (dazed) sc.stars(x, b.x, b.y - 46);
      if ((a.stare ?? 0) > 0 && !dazed) sc.cb(x, 'warn', b.x, b.y - 62, 10);
      return true;
    }
    case 'cam': {
      const off = (a.extra2 ?? 0) > 1e8;
      if (!off) { x.save(); const g = x.createRadialGradient(b.x, b.y, 8, b.x, b.y, w.assist ? 200 : 240); g.addColorStop(0, 'rgba(255,80,80,.32)'); g.addColorStop(1, 'rgba(255,80,80,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(b.x, b.y); x.arc(b.x, b.y, w.assist ? 200 : 240, b.h - 0.32, b.h + 0.32); x.closePath(); x.fill(); x.restore(); }
      spr(x, off ? 'job-cam-paint' : 'job-cam', b.x, b.y + 10, { w: 34, flip: Math.cos(b.h) < 0 });
      if (!off && Math.floor(sc.t * 2) % 2) sc.glow(x, b.x, b.y - 10, 14, 'rgba(255,60,60,.7)');
      return true;
    }
    case 'pest': case 'lured': {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 15, 6);
      const sk = a.skin ?? 'crow', netted = a.kind === 'lured' && a.extra === 1, fleeing = a.extra === 2;
      let f: string, flip = side && cx < 0;
      if (netted) { f = sk === 'liz' ? 'liz-netted' : sk === 'otter' ? 'otter-netted' : sk === 'mac' ? 'mac-netted' : 'crow-netted'; flip = false; }
      else if (a.kind === 'lured' && a.look > 0) f = sk === 'mac' ? 'mac-munch' : sk === 'liz' ? 'liz-taunt' : sk === 'otter' ? 'otter-taunt' : 'crow-taunt';
      else if (fleeing && a.kind === 'pest') f = sk === 'crow' ? `crow-fly-${fl}` : sk === 'mac' ? 'mac-startled' : `${sk}-run-${fl}`;
      else if (sk === 'crow' && a.b.cls === 'fly') f = `crow-fly-${fl}`;
      else if (side || fleeing) f = `${sk === 'crow' ? 'crow' : sk}-run-${fl}`;
      else f = `${sk === 'crow' ? 'crow' : sk}-walk-${sy > 0 ? 'down' : 'up'}-${fl}`;
      if (f.startsWith('crow-fly')) spr(x, f, b.x, b.y - 10, { anchor: 'center', rot: b.h + Math.PI / 2 });
      else spr(x, f, b.x, b.y + 4, { flip, w: sk === 'liz' ? 56 : undefined });
      if (a.kind === 'pest' && a.extra === 1) spr(x, 'handbag', b.x, b.y - 46, { w: 20 });
      if (netted) sc.sparkle(x, b.x + 14, b.y - 30);
      return true;
    }
    case 'watcher': {
      x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 14, 6);
      const blindNow = (a.extra2 ?? 0) > 0;
      if (!blindNow) sc.beam(x, b.x, b.y - 20, b.h, (w.assist ? 260 : 300) * w.diff.look, 0.95);
      spr(x, `crow-look-${Math.floor(a.t * 1.5) % 2}`, b.x, b.y + 4, { flip: Math.cos(b.h) < 0 });
      if (blindNow) spr(x, 'sp-teal', b.x, b.y - 34, { w: 24 });
      return true;
    }
    case 'crowd': case 'witness': {
      x.fillStyle = 'rgba(0,0,0,.25)'; sc.shadow(x, b.x, b.y + 2, 13, 6);
      const sp = a.skin as string | undefined;
      if (sp === 'intern') { const f = b.speed < 5 ? 'intern-down' : side ? `intern-side-${fl}` : 'intern-down'; spr(x, f, b.x, b.y + 4, { flip: side && cx < 0 }); return true; }
      const s = sp ?? 'rabbit';
      const f = a.kind === 'witness' || b.speed < 5 ? (a.kind === 'witness' && a.stun > 0 ? `folk-${s}-hop` : `folk-${s}-down`) : side ? `folk-${s}-side-${fl}` : `folk-${s}-${sy > 0 ? 'down' : 'up'}`;
      spr(x, f, b.x, b.y + 4, { flip: side && cx < 0 }) || spr(x, 'folk-rabbit-down', b.x, b.y + 4, {});
      if (a.kind === 'witness' && w.run?.js && !w.run.js.clues.includes(a.extra!)) spr(x, 'i-ask', b.x, b.y - 66 + Math.sin(sc.t * 3) * 3, { w: 26 });
      return true;
    }
  }
  return false;
}
