// Tembusu: drawing only. The hill and the tree at 384 by 256 game pixels in Canvas 2D, scaled up nearest-neighbour by
// the page. Everything is a Codex-painted sprite from the atlas (public/art/tembusu/atlas.png, boxes in
// lib/tembusu-art.ts): the tree is assembled each frame from the shape the engine derives (trunk height and thickness,
// each branch at its tier, angle and side, leaf clumps at the tips, flowers, fruit, hollows, roots), so animals and
// events read the same structure the player sees. Motion here (leaves stepping in the wind, animals' two-frame idles,
// Dora pottering, Enzo writing) is driven by the wall clock only and never touches the engine.
import { ATLAS, GROUND } from './tembusu-art';
import { ANIMAL, dayPart, hourAt, hill, type AnimalId, type Branch, type Save, type TreeState } from './tembusu-game';

export const W = 384, H = 256;
/** where the tree stands */
export const TX = 176;
const HILLS = ['dawn', 'day', 'dusk', 'night', 'storm', 'dry'] as const;
type HillId = (typeof HILLS)[number];
const SLOTS = [16, 46, 290, 318, 346, 372];

export const groundY = (x: number) => GROUND[Math.max(0, Math.min(GROUND.length - 1, Math.round(x / 4)))];

export type Hit = { kind: 'bud'; i: number; x: number; y: number };
/** what the page tells the scene each frame */
export type View = {
  save: Save;
  tree: TreeState;
  /** wall-clock seconds, for idle motion */
  time: number;
  /** the effective now (the page's clock plus any skip) */
  now: number;
  journalOpen: boolean;
  hover: number;
  reduced: boolean;
};

export class TembusuScene {
  private c: CanvasRenderingContext2D;
  private atlas = new Image();
  private hills: Partial<Record<HillId, HTMLImageElement>> = {};
  ready = false;
  /** the colour of the sky now, for the page round the picture */
  skyColor = '#f8b493';
  private skies: Partial<Record<HillId, string>> = {};
  /** the bud spots of a waiting fork, in game pixels, for clicks */
  buds: Hit[] = [];
  /** for tests: what was drawn last frame */
  last: { trunk: number; branches: number; leaves: number; animals: AnimalId[]; dora: string; enzo: string; hill: string; buds: number } = { trunk: 0, branches: 0, leaves: 0, animals: [], dora: '', enzo: '', hill: '', buds: 0 };

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W; canvas.height = H;
    this.c = canvas.getContext('2d')!;
    this.c.imageSmoothingEnabled = false;
  }

  async load(base = '/art/tembusu') {
    const img = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const [a, ...hs] = await Promise.all([img(`${base}/atlas.png`), ...HILLS.map((h) => img(`${base}/hill-${h}.png`))]);
    this.atlas = a; HILLS.forEach((h, i) => { this.hills[h] = hs[i]; });
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const x = cv.getContext('2d')!;
    for (const h of HILLS) { x.drawImage(this.hills[h]!, 120, 40, 1, 1, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; this.skies[h] = `rgb(${d[0]},${d[1]},${d[2]})`; }
    this.ready = true;
  }

  /** draw sprite `n` with its anchor at (x, y); flip mirrors it round the anchor */
  private spr(n: string, x: number, y: number, flip = false, alpha = 1, cropTop = 0) {
    const b = ATLAS[n]; if (!b) return;
    const [sx, sy, w, h, ax, ay] = b;
    const c = this.c;
    if (alpha !== 1) c.globalAlpha = alpha;
    const ch = h - cropTop;
    if (flip) {
      c.save(); c.translate(Math.round(x), 0); c.scale(-1, 1);
      c.drawImage(this.atlas, sx, sy + cropTop, w, ch, -ax, Math.round(y) - ay + cropTop, w, ch);
      c.restore();
    } else c.drawImage(this.atlas, sx, sy + cropTop, w, ch, Math.round(x) - ax, Math.round(y) - ay + cropTop, w, ch);
    if (alpha !== 1) c.globalAlpha = 1;
  }

  /** the hill's light: blends between the time-of-day paintings, with storm or dry spell weather over them */
  private sky(v: View) {
    const c = this.c;
    const h = hourAt(v.save.tree, v.now);
    // the next part of the day fades in over the half hour before it starts
    const part = dayPart(h);
    let next = part, d = 0.5;
    for (let k = 1; k <= 10; k++) { const p = dayPart((h + k * 0.05) % 24); if (p !== part) { next = p; d = k * 0.05; break; } }
    c.globalAlpha = 1; c.drawImage(this.hills[part]!, 0, 0);
    if (next !== part) { c.globalAlpha = 1 - d / 0.5; c.drawImage(this.hills[next]!, 0, 0); c.globalAlpha = 1; }
    let hillId: string = part;
    if (v.tree.weather) {
      c.globalAlpha = part === 'night' ? 0.7 : 0.92; c.drawImage(this.hills[v.tree.weather]!, 0, 0); c.globalAlpha = 1;
      hillId = v.tree.weather;
    }
    this.last.hill = hillId;
    this.skyColor = this.skies[hillId as HillId] ?? this.skyColor;
    return part;
  }

  /** the earlier trees on the hill */
  private grove(v: View) {
    for (const s of hill(v.save)) {
      const x = SLOTS[s.slot];
      const n = s.stage === 'stump' ? 'stump' : s.stage === 'sapling' ? 'sapling' : 'young';
      this.spr(n, x, groundY(x) + 2, s.n % 2 === 0);
    }
  }

  /** the tree from its shape */
  private tree(v: View) {
    const t = v.tree, time = v.time;
    const gy = groundY(TX) + 3;
    this.buds = [];
    if (t.phase === 'fallen') {
      this.spr('log', TX + 20, gy + 1);
      this.last = { ...this.last, trunk: 0, branches: 0, leaves: 0, buds: 0 };
      return;
    }
    const f = Math.min(1, t.u / 0.9);
    const ease = 1 - Math.pow(1 - f, 1.6);
    // trunk: thickness from age and bark, height from age and tall leaders
    const thick = Math.min(2, (f > 0.55 ? 2 : f > 0.22 ? 1 : 0) + (t.bark >= 2 ? 1 : 0) + (t.bark >= 1 && f > 0.35 ? 1 : 0));
    const trunkName = `trunk-${thick}`;
    const tb = ATLAS[trunkName];
    const height = Math.min(tb[3] - 6, Math.round(14 + 108 * ease + t.tall * 14));
    // a fresh seedling is just two leaves
    if (height < 22 && t.forksDone === 0) {
      this.spr(t.u < 0.03 ? 'seed' : 'seedling', TX, gy);
      this.last = { ...this.last, trunk: 0, branches: 0, leaves: 0 };
      this.forkBuds(v, TX, gy - 14, null, time);
      return;
    }
    if (t.roots > 0) { this.spr('roots', TX, gy - 4 + 17); if (t.roots > 1) this.spr('roots', TX + 6, gy - 2 + 17, true); }
    this.spr(trunkName, TX, gy, false, 1, tb[3] - height);
    const halfAt = (yy: number) => this.halfWidth(trunkName, gy - yy);
    const topY = gy - height;
    let leaves = 0, branches = 0;
    // hollows on the trunk
    for (const h of t.hollows) {
      const y = gy - Math.round(h.tier * height * 0.8) - 8;
      if (y < topY + 10) continue;
      this.spr('hollow', TX + h.side * Math.max(0, halfAt(gy - y) - 12), y, h.side < 0);
    }
    // branches, back to front: angle-0 (low, wide) last so they read in front
    const live = [...t.branches].sort((a, b) => b.angle - a.angle);
    const tips: { b: Branch; x: number; y: number }[] = [];
    for (const b of live) {
      const { x, y } = this.attach(b, gy, height, halfAt);
      if (y < topY + 6) continue;
      if (b.broken) { this.spr('stub', x, y, b.side < 0); continue; }
      const age = t.u - b.born;
      const long = (age > 0.12 || f > 0.8) && (b.tier < 0.62 || b.angle === 0);
      const name = `br-${b.angle === 2 && b.tier > 0.7 ? 1 : b.angle}${long ? 'L' : 'S'}`;
      this.spr(name, x, y, b.side < 0);
      const [, , , , ax, ay, tx, ty] = ATLAS[name];
      tips.push({ b, x: x + b.side * (tx - ax), y: y + (ty - ay) });
      branches++;
    }
    // the crown on top of the trunk, growing with the tree; leaves step a pixel in the wind now and then
    const sway = (k: number) => (v.reduced ? 0 : Math.round(Math.sin(time * 0.7 + k * 1.7) * 0.6));
    const crown = f < 0.2 ? ['leaf-S1'] : f < 0.45 ? ['leaf-M1', 'leaf-S2'] : ['leaf-L1', 'leaf-M2', 'leaf-M1'];
    const cx = TX;
    crown.forEach((n, i) => {
      const off = i === 0 ? [0, 0] : i === 1 ? [-28, 10] : [30, 12];
      this.spr(n, cx + off[0] * (f < 0.45 ? 0.6 : 1) + sway(i), topY + 4 + off[1] * (f < 0.45 ? 0.6 : 1)); leaves++;
    });
    for (const { b, x, y } of tips) {
      const age = t.u - b.born;
      const n = age < 0.05 ? (b.id % 2 ? 'leaf-S2' : 'leaf-S1') : b.angle === 0 || age > 0.25 ? (b.id % 2 ? 'leaf-M2' : 'leaf-M1') : (b.id % 2 ? 'leaf-S1' : 'leaf-S2');
      this.spr(n, x + sway(b.id + 3), y + 4); leaves++;
      if (b.flower) this.spr('flower', x - b.side * 6, y + 6, b.side < 0);
      if (b.fruit > 0) this.spr('fruit', x + b.side * 4, y + 14, b.side < 0);
    }
    this.last = { ...this.last, trunk: height, branches, leaves };
    this.tipCache = tips;
    this.topY = topY; this.gy = gy; this.height = height; this.halfAt = halfAt;
    // a waiting fork: the new branch shows faintly, and three buds glow at its tip
    if (t.fork) {
      const nb = t.fork.branch;
      const { x, y } = this.attach(nb, gy, height, halfAt);
      const name = `br-${nb.angle}S`;
      this.spr(name, x, Math.max(topY + 8, y), nb.side < 0, 0.55);
      const [, , , , ax, ay, tx, ty] = ATLAS[name];
      this.forkBuds(v, x + nb.side * (tx - ax), Math.max(topY + 8, y) + (ty - ay), nb.side, time);
    } else this.last.buds = 0;
  }
  private tipCache: { b: Branch; x: number; y: number }[] = [];
  private topY = 0; private gy = 0; private height = 0; private halfAt: (y: number) => number = () => 10;

  private forkBuds(v: View, x: number, y: number, side: number | null, time: number) {
    if (!v.tree.fork) { this.last.buds = 0; return; }
    const spots = [[-11, 3], [0, -6], [11, 3]];
    spots.forEach(([dx, dy], i) => {
      const bx = x + dx * (side ?? 1), by = y + dy;
      const glow = v.reduced ? 1 : 0.75 + 0.25 * Math.sin(time * 2 + i);
      const c = this.c;
      c.globalAlpha = (v.hover === i ? 0.55 : 0.3) * glow;
      c.fillStyle = '#ffe9a0';
      c.fillRect(Math.round(bx) - 5, Math.round(by) - 14, 10, 14);
      c.globalAlpha = 1;
      this.spr('bud', bx, by - 6);
      this.buds.push({ kind: 'bud', i, x: bx, y: by - 10 });
    });
    this.last.buds = 3;
  }

  /** half the trunk's painted width at a height above its base */
  private widthCache = new Map<string, number[]>();
  private halfWidth(trunk: string, yUp: number) {
    let rows = this.widthCache.get(trunk);
    if (!rows) {
      rows = [];
      const [sx, sy, w, h] = ATLAS[trunk];
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d')!; x.drawImage(this.atlas, sx, sy, w, h, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data;
      for (let y = 0; y < h; y++) {
        let l = w, r = 0;
        for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 0) { l = Math.min(l, i); r = Math.max(r, i); }
        rows.push(r >= l ? (r - l) / 2 : 0);
      }
      this.widthCache.set(trunk, rows);
    }
    const h = rows.length;
    return rows[Math.max(0, Math.min(h - 1, h - 1 - Math.round(yUp)))] || 8;
  }

  private attach(b: Branch, gy: number, height: number, halfAt: (y: number) => number) {
    const y = gy - Math.round(14 + b.tier * (height - 22));
    const x = TX + b.side * Math.max(2, halfAt(gy - y) - 3);
    return { x, y };
  }

  /** the animals living in the tree, each on its own branch, two frames of idle */
  private animals(v: View) {
    const t = v.tree, time = v.time;
    const drawn: AnimalId[] = [];
    t.animals.forEach((a, i) => {
      const tip = this.tipCache.find((q) => q.b.id === a.branch) ?? this.tipCache[i % Math.max(1, this.tipCache.length)];
      const frame = v.reduced ? 0 : Math.floor(time / (1.3 + (i % 3) * 0.4) + i) % 2;
      const n = `${a.id}-${frame}`;
      if (!ATLAS[n]) return;
      let x: number, y: number, flip = false;
      const def = ANIMAL[a.id];
      if (a.id === 'colugo' || a.id === 'monitor') {
        // on the trunk itself
        y = this.gy - (a.id === 'colugo' ? this.height * 0.7 : this.height * 0.3);
        x = TX + (i % 2 ? 1 : -1) * (this.halfAt(this.gy - y) + 2); flip = i % 2 === 0;
        y += ATLAS[n][3] / 2;
      } else if (a.id === 'bat' || a.id === 'bees') {
        if (!tip) return;
        x = tip.x - tip.b.side * 18; y = tip.y + 20 + ATLAS[n][3];
      } else if (a.id === 'birdwing' || a.id === 'sunbird') {
        if (!tip) return;
        x = tip.x + Math.round(Math.sin(time * 0.5 + i) * 6); y = tip.y - 2 + Math.round(Math.cos(time * 0.4 + i) * 3);
      } else {
        if (!tip) return;
        x = tip.x - tip.b.side * 16; y = tip.y + 8; flip = tip.b.side < 0;
      }
      void def;
      this.spr(n, x, y, flip);
      drawn.push(a.id);
    });
    this.last.animals = drawn;
  }

  /** Dora's home and what she is doing; Enzo at the roots */
  private dora(v: View) {
    const t = v.tree, time = v.time;
    const live = this.tipCache.filter((q) => !q.b.broken);
    // her home sits on the lowest strong branch once the tree has one, and moves if that branch breaks
    const homeB = [...live].sort((a, b) => b.b.side - a.b.side || a.b.tier - b.b.tier || a.b.id - b.b.id)[0];
    const recent = (kinds: string[], ms: number) => t.log.some((e) => kinds.includes(e.kind) && v.now - e.at < ms && v.now >= e.at);
    let action = 'idle', dx = 0, dy = 0, flip = false;
    let base: { x: number; y: number };
    if (t.phase === 'fallen' || !homeB || this.height < 92) {
      // no home yet: she tends the young tree from the ground
      base = { x: TX + 54, y: groundY(TX + 54) + 3 };
      flip = true;
    } else {
      const hx = TX + homeB.b.side * 30, hy = this.attach(homeB.b, this.gy, this.height, this.halfAt).y + 2;
      this.spr('ladder', hx - homeB.b.side * 10, hy + ATLAS.ladder[3] - 6);
      this.spr('home', hx, hy, homeB.b.side < 0);
      base = { x: hx + homeB.b.side * 26, y: hy - 9 };
      flip = homeB.b.side < 0;
      // when the home has just moved (a branch broke), she carries a plank about
      if (recent(['break', 'snap'], 4 * 60_000)) action = 'carry';
    }
    if (t.phase === 'fork') { action = 'water'; }
    else if (t.weather === 'storm') action = 'brace';
    else if (recent(['arrive'], 3 * 60_000)) action = 'wave';
    else if (action === 'idle' && t.phase !== 'fallen') {
      // pottering: idle most of the time, watering now and then, a climb down the ladder and back
      const k = Math.floor(time / 9) % 6;
      action = k === 2 ? 'water' : k === 4 && homeB && t.forksDone >= 2 ? 'climb' : 'idle';
    }
    if (action === 'carry') dx = Math.round(Math.sin(time * 0.6) * 10);
    if (action === 'climb' && homeB) { dx = -homeB.b.side * 36; dy = 10 + Math.round(Math.abs(Math.sin(time * 0.35)) * 26); }
    const frame = v.reduced ? 0 : Math.floor(time / (action === 'idle' ? 1.6 : 0.5)) % 2;
    this.spr(`dora-${action}-${frame}`, base.x + dx, base.y + dy, flip);
    this.last.dora = action;
    // Enzo: plants the seed, writes when something happens, reads when the journal is open, else sits
    let e = 'sit';
    if (t.u * t.ms < 60_000 && t.phase !== 'fallen') e = 'plant';
    else if (v.journalOpen) e = 'read';
    else if (t.log.length && v.now - t.log[t.log.length - 1].at < 90_000) e = 'write';
    else if (t.phase === 'fallen') e = 'read';
    const ef = v.reduced ? 0 : Math.floor(time / (e === 'sit' ? 2.2 : 0.7)) % 2;
    const ex = TX - 66;
    this.spr(`enzo-${e}-${ef}`, ex, groundY(ex) + 6);
    this.last.enzo = e;
  }

  draw(v: View) {
    if (!this.ready) return;
    const c = this.c;
    c.clearRect(0, 0, W, H);
    const part = this.sky(v);
    this.grove(v);
    this.tree(v);
    if (v.tree.phase !== 'fallen') this.animals(v); else this.last.animals = [];
    this.dora(v);
    // night and dusk dim the tree and the characters a little, like the painted hills
    const dim = part === 'night' ? 'rgba(40,52,110,0.42)' : part === 'dusk' ? 'rgba(150,90,120,0.14)' : part === 'dawn' ? 'rgba(255,170,140,0.06)' : v.tree.weather === 'storm' ? 'rgba(60,70,90,0.3)' : null;
    if (dim) {
      c.globalCompositeOperation = 'multiply'; c.fillStyle = dim; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    }
  }

  /** the bud under a game-pixel point, if any */
  budAt(x: number, y: number) {
    let best = -1, bd = 12;
    for (const b of this.buds) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b.i; } }
    return best;
  }
}
