// Jade Street, the tenth pass: drawing the empire in the world. Every object is a Codex painting (atlas-set and the
// raid sheets): the for-sale board in front of a property you don't own, the boarded-up planks and knocked-over crates
// on a damaged one (and the bamboo scaffold while it is being repaired), Pak Duri's stool and thermos outside a place he
// watches, the gang raiding a property before you get there (two of them carrying off the till and kicking crates,
// under a pulsing red raid pin), the empire job's giver waiting at the property, and Pak Duri himself in a stand (his
// walk, his whistle and his shoo, with the guards' mind bubbles). Code adds only light: the raid's red glow and a gold
// glow round a property the route line leads to. The rules are in lib/jade-empire.ts.
import { BIZ, BIZ_OF, bizPos } from './jade-biz.js';
import { EMPIRE_JOB } from './jade-empjobs.js';
import { spr } from './jade-scene.js';
import { mindBubble } from './jade-jobdraw.js';
import type { Mind } from './jade-aware.js';
import type { World } from './jade-game.js';
import type { Scene } from './jade-scene.js';
import type { Actor } from './jade-mission.js';

type X = CanvasRenderingContext2D;
type List = [number, () => void][];

/** the standing things round the properties, into the scene's y-sorted list */
export function empSorted(sc: Scene, x: X, w: World, list: List, vis: (px: number, py: number, m?: number) => boolean) {
  const t = sc.t, s = w.s, rd = w.emp.raid;
  for (const b of BIZ) {
    if (!w.open.has(b.d)) continue; const [bx, by] = bizPos(b); if (!vis(bx, by, 220)) continue;
    const st = s.biz[b.id]; if (!st) continue;
    if (!st.lvl) { list.push([by + 46, () => spr(x, 'emp-forsale', bx - 58, by + 58, { w: 42 })]); continue; }
    if (st.dmg) {
      const mending = w.p.act?.n === 'repair' && Math.hypot(w.p.x - bx, w.p.y - by) < 200;
      list.push([by + 44, () => { spr(x, mending ? 'emp-scaffold' : 'emp-boards', bx, by + 30, { w: 110 }); if (!mending) spr(x, 'emp-mess', bx + 46, by + 56, { w: 64 }); }]);
    }
    if (st.jaga) list.push([by + 50, () => spr(x, 'emp-stool', bx + 70, by + 58, { w: 40 })]);
  }
  // a raid before you get there: two of the gang at it, under the red raid pin
  if (rd && !w.run) {
    const b = BIZ_OF[rd.id], [bx, by] = bizPos(b);
    if (vis(bx, by, 320)) {
      const g = rd.gang, f = Math.floor(t * 6) % 2;
      list.push([by + 60, () => spr(x, `${g}-till-${f}`, bx + 50 + Math.sin(t * 2) * 24, by + 70, { w: g === 'liz' ? 70 : 56, flip: Math.cos(t * 2) < 0 })]);
      list.push([by + 58, () => spr(x, Math.floor(t * 1.5) % 2 ? `${g}-kick` : `${g}-gloat`, bx - 46, by + 66, { w: g === 'liz' ? 70 : 56 })]);
    }
  }
  // an empire job's giver waits at the property while the job runs (Ah Huat, Inspector Siew, Towkay Hoot)
  const id = w.run?.gig?.key.startsWith('emp:') ? w.run.gig.key.split(':') : null;
  if (id) {
    const j = EMPIRE_JOB[id[1]], b = BIZ_OF[id[2]];
    if (j && b && ['huat', 'siew', 'hoot'].includes(j.giver)) { const [bx, by] = bizPos(b); if (vis(bx, by, 200)) list.push([by + 62, () => spr(x, `npc-${j.giver}-idle-${Math.floor(t * 1.6) % 2}`, bx - 74, by + 70, { w: 54 })]); }
  }
}

/** above everything: the raid's pulsing glow and pin, and the gold glow round the property you're routed to */
export function empOver(sc: Scene, x: X, w: World) {
  const rd = w.emp.raid; if (!rd || w.run) return;
  const [bx, by] = bizPos(BIZ_OF[rd.id]); const p = 0.5 + 0.5 * Math.sin(sc.t * 6);
  sc.glow(x, bx, by, 120 + p * 30, `rgba(255,60,50,${0.25 + p * 0.2})`);
  spr(x, 'pin-raid', bx, by - 110 - p * 8, { w: 46, anchor: 'center' });
}

/** Pak Duri in a stand at the shop he watches: his beat, his whistle, his shoo */
export function jagaActor(sc: Scene, x: X, a: Actor): boolean {
  if (a.kind !== 'jaga') return false;
  const b = a.b, m = a.mind as Mind | undefined, fl = Math.floor(sc.t * 6) % 2;
  x.fillStyle = 'rgba(0,0,0,.3)'; sc.shadow(x, b.x, b.y + 2, 16, 6);
  const f = m?.st === 'alert' && b.speed < 30 ? 'duri-alert' : m?.st === 'alert' ? 'duri-shoo' : b.speed > 8 ? `duri-walk-${fl}` : m?.st === 'sus' ? 'duri-alert' : 'duri-walk-0';
  spr(x, f, b.x, b.y + 4, { w: 58, flip: Math.cos(b.h) < 0 });
  mindBubble(sc, x, m, b.x, b.y - 70);
  return true;
}
