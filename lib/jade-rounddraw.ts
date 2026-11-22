// Jade Street drawing for the twentieth pass's `rounds` step (lib/jade-rounds.ts): who waits at each stop (a townsfolk
// standing there with what they want in a bubble), or for a hook, a doorway or a shrine a soft ring with the thing
// ghosted in it; once handed over, a hung cage or lantern and a draped garland stay where they were put. All painted
// sprites; code adds only light and rings. (The twenty-third pass: a stop's `sights`, say a mural, stand there all along;
// a photo leaves nothing behind.)
import { spr, itemSprite } from './jade-scene.js';
import type { Scene } from './jade-scene.js';
import type { World } from './jade-game.js';
import type { Run } from './jade-mission.js';

type X = CanvasRenderingContext2D;
/** the stops on the ground (true: the generic item markers are not drawn) */
export function roundsGround(sc: Scene, x: X, w: World, run: Run): boolean {
  const st = run.cur; if (!st || st.t !== 'rounds') return false;
  const f = itemSprite(st.item), pulse = 0.5 + Math.sin(sc.t * 4) * 0.5;
  for (const [i, it] of run.items.entries()) {
    const sp = it.marks?.[0];
    // (the twenty-third pass) what stands at the stop, painted, all along: a mural on the wall above it
    const sight = st.sights?.[i % st.sights.length];
    if (sight) spr(x, sight, it.x, it.y - 34, { w: 112, anchor: 'center' });
    if (it.got) { if (!sp && st.act !== 'photo') spr(x, f, it.x, it.y + (st.act === 'hang' ? -30 : 8), { w: 30 }); continue; }
    sc.glow(x, it.x, it.y, 44 + pulse * 8, 'rgba(255,210,110,.45)');
    if (sp) {
      spr(x, `folk-${sp}-down`, it.x, it.y + 4, {});
      spr(x, 'ui-bubble', it.x + 20, it.y - 74, { w: 40, anchor: 'center' });
      spr(x, f, it.x + 20, it.y - 76, { w: 24, anchor: 'center' });
    } else {
      x.save(); x.strokeStyle = `rgba(255,230,150,${0.45 + pulse * 0.4})`; x.lineWidth = 3; x.setLineDash([8, 6]);
      x.beginPath(); x.ellipse(it.x, it.y + 6, 40, 24, 0, 0, Math.PI * 2); x.stroke(); x.restore();
      spr(x, f, it.x, it.y + (st.act === 'hang' ? -30 : 8), { w: 30, alpha: 0.5 + pulse * 0.25 });
    }
  }
  return true;
}
