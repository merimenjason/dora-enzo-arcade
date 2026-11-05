// Tetherball: the drawing. A 480 by 320 pixel canvas scaled up with nearest-neighbour: the painted pixel-art floor for
// the biome, the props, the enemies, Dora and Enzo (Codex-painted sprites from public/art/tether), the rope in pixels
// that heats from gold to red as the swing speeds up, the line a swung enemy will fly along if Dora lets go, speed
// trails, telegraphs, stars for the dazed, impact sparks, damage numbers, blasts, quakes and screen shake. Rules are in
// lib/tether-game.ts; this only reads them.
import { W, H, FLOOR, PLAYER_R, FOES, type Run, type Foe, type RunEvent, type BiomeId } from './tether-game';

const SPRITES = ['dora-stand', 'dora-run', 'dora-swing', 'enzo', 'slime', 'grumble', 'spitter', 'beetle', 'shellback', 'boar', 'golem', 'crate', 'spikes', 'pit', 'post', 'heart'] as const;
type SpriteId = (typeof SPRITES)[number];
const FLOORS: BiomeId[] = ['court', 'meadow', 'mine', 'keep'];
/** how each painted sprite faces: the sheet drew Enzo facing left, everything else facing right */
const FACES_LEFT: SpriteId[] = ['enzo'];

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; size: number; kind: 'spark' | 'dust' | 'num' | 'ring' | 'chip'; n?: number; r?: number };

export type FrameView = { run: Run; time: number; dt: number; reduced: boolean; mouse: { x: number; y: number } | null; target: { x: number; y: number } | null };

// a 3 by 5 pixel font for damage numbers
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

export class TetherScene {
  readonly c: CanvasRenderingContext2D;
  private img = new Map<string, HTMLImageElement>();
  private white = new Map<string, HTMLCanvasElement>();
  private parts: Particle[] = [];
  private trails = new Map<number, { x: number; y: number }[]>();
  private doraTrail: { x: number; y: number }[] = [];
  private shake = 0;
  ready = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W; canvas.height = H;
    this.c = canvas.getContext('2d')!; this.c.imageSmoothingEnabled = false;
  }

  /** load every picture; resolves when they are all in (a missing one is drawn as a plain shape) */
  load(base = '/art/tether/') {
    const names = [...SPRITES, ...FLOORS.map((f) => `floor-${f}`)];
    return Promise.all(names.map((n) => new Promise<void>((done) => {
      const im = new Image(); im.onload = () => { this.img.set(n, im); done(); }; im.onerror = () => done(); im.src = `${base}${n}.png`;
    }))).then(() => { this.ready = true; });
  }

  /** a white silhouette of a sprite, for hit flashes */
  private flashOf(id: string) {
    let w = this.white.get(id); if (w) return w;
    const im = this.img.get(id); if (!im) return null;
    w = document.createElement('canvas'); w.width = im.width; w.height = im.height;
    const g = w.getContext('2d')!; g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, w.width, w.height);
    this.white.set(id, w); return w;
  }

  /** draw a sprite standing with its feet at (x, y), facing right (1) or left (-1) */
  private sprite(id: SpriteId, x: number, y: number, face: 1 | -1 = 1, o: { flash?: boolean; alpha?: number; scale?: number; rot?: number } = {}) {
    const im = o.flash ? this.flashOf(id) : this.img.get(id);
    const c = this.c;
    if (!im) return false;
    const s = o.scale ?? 1, w = Math.round(im.width * s), h = Math.round(im.height * s);
    const flip = FACES_LEFT.includes(id) ? -face : face;
    c.save(); c.globalAlpha = o.alpha ?? 1;
    c.translate(Math.round(x), Math.round(y));
    if (o.rot) { c.translate(0, -h / 2); c.rotate(o.rot); c.translate(0, h / 2); }
    if (flip < 0) c.scale(-1, 1);
    c.drawImage(im, -Math.round(w / 2), -h, w, h);
    c.restore();
    return true;
  }

  private px(x: number, y: number, col: string, a = 1) { const c = this.c; c.globalAlpha = a; c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), 1, 1); c.globalAlpha = 1; }

  /** a one-pixel line, stepped like a pixel-art line rather than smoothed */
  private line(x0: number, y0: number, x1: number, y1: number, col: (i: number) => string | null, a = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, i = 0;
    for (;;) {
      const k = col(i++); if (k) this.px(x0, y0, k, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
      if (i > 2000) break;
    }
  }

  private ring(x: number, y: number, r: number, col: string, a = 1, dash = 0) {
    const n = Math.max(12, Math.round(r * 6.3));
    for (let i = 0; i < n; i++) { if (dash && Math.floor(i / dash) % 2) continue; const t = (i / n) * Math.PI * 2; this.px(x + Math.cos(t) * r, y + Math.sin(t) * r, col, a); }
  }

  private shadow(x: number, y: number, rx: number) {
    const c = this.c; c.globalAlpha = 0.28; c.fillStyle = '#1a1020';
    const ry = Math.max(1, Math.round(rx * 0.4));
    for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j * j) / (ry * ry + 0.01))); c.fillRect(Math.round(x - w), Math.round(y + j), w * 2, 1); }
    c.globalAlpha = 1;
  }

  private digits(n: number, x: number, y: number, col: string, a: number) {
    const s = String(n), w = s.length * 4 - 1; let ox = Math.round(x - w / 2);
    for (const ch of s) { const g = DIGITS[+ch]; for (let i = 0; i < 15; i++) if (g[i] === '1') { this.px(ox + (i % 3), y + Math.floor(i / 3), '#2a1418', a); this.px(ox + (i % 3), y - 1 + Math.floor(i / 3), col, a); } ox += 4; }
  }

  private burst(x: number, y: number, n: number, cols: string[], speed: number, kind: Particle['kind'] = 'spark', life = 0.35) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: cols[i % cols.length], size: kind === 'dust' ? 2 : 1, kind }); }
  }

  /** react to what just happened in the run */
  events(run: Run, evs: RunEvent[], reduced: boolean) {
    const k = reduced ? 0.4 : 1;
    for (const e of evs) {
      switch (e.k) {
        case 'hit':
          this.burst(e.x, e.y - 4, Math.round((4 + e.dmg * 2) * k), ['#fff6c8', '#ffd24a', '#ffffff'], 40 + e.speed * 0.35);
          this.parts.push({ x: e.x, y: e.y - 12, vx: 0, vy: -26, life: 0.7, max: 0.7, c: e.dmg >= 4 ? '#ff5a3c' : e.dmg >= 3 ? '#ffb02e' : '#fff6c8', size: 1, kind: 'num', n: e.dmg });
          if (!reduced) this.shake = Math.max(this.shake, Math.min(4, e.dmg * 0.9)); break;
        case 'tink': this.burst(e.x, e.y - 4, 4, ['#cfe3ff', '#ffffff'], 50, 'spark', 0.2); break;
        case 'kill': if (e.how !== 'fall') this.burst(e.x, e.y - 5, Math.round(10 * k), ['#e8e2d8', '#b8ada0', '#ffffff'], 46, 'dust', 0.5); break;
        case 'boom':
          this.parts.push({ x: e.x, y: e.y - 3, vx: 0, vy: 0, life: 0.35, max: 0.35, c: '#ffb02e', size: 1, kind: 'ring', r: 44 });
          this.burst(e.x, e.y - 3, Math.round(22 * k), ['#ffe066', '#ff8a2a', '#ff4a2a', '#5a4040'], 130, 'spark', 0.5);
          if (!reduced) this.shake = Math.max(this.shake, 5); break;
        case 'slam': this.burst(e.x, e.y - 3, Math.round(8 * k), ['#d8c8a8', '#ffffff'], 60, 'dust', 0.4); if (!reduced) this.shake = Math.max(this.shake, 2.5); break;
        case 'spike': this.burst(e.x, e.y - 4, Math.round(10 * k), ['#ff5a5a', '#ffffff', '#ffd24a'], 70); break;
        case 'crate': this.burst(e.x, e.y - 4, Math.round(12 * k), ['#9a6a3a', '#6a4424', '#c89a5a'], 70, 'chip', 0.6); break;
        case 'hurt': if (!reduced) this.shake = Math.max(this.shake, 3); this.burst(run.x, run.y - 10, 8, ['#ff4a5a', '#ffffff'], 60); break;
        case 'quake': if (!reduced) this.shake = Math.max(this.shake, 4); break;
        case 'heart': this.burst(run.x, run.y - 12, 8, ['#ff6a8a', '#ffffff'], 40); break;
        case 'dash': this.burst(run.x, run.y, 5, ['#e8dcc8'], 30, 'dust', 0.3); break;
        default: break;
      }
    }
  }

  render(v: FrameView) {
    const c = this.c, run = v.run, L = run.layout, t = v.time;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.fillStyle = '#1a1420'; c.fillRect(0, 0, W, H);
    if (this.shake > 0.2 && !v.reduced) { c.translate(Math.round((Math.random() - 0.5) * this.shake * 2), Math.round((Math.random() - 0.5) * this.shake * 2)); }
    this.shake = Math.max(0, this.shake - v.dt * 14);
    const floor = this.img.get(`floor-${L.biome}`);
    if (floor) c.drawImage(floor, 0, 0, W, H);
    else { c.fillStyle = '#6a5a48'; c.fillRect(0, 0, W, H); c.fillStyle = '#9a8a70'; c.fillRect(FLOOR.x0, FLOOR.y0, FLOOR.x1 - FLOOR.x0, FLOOR.y1 - FLOOR.y0); }

    // flat things: pits, then quake rings and the golem's warning circle
    for (const p of L.pits) if (!this.sprite('pit', p.x, p.y + 19)) { c.fillStyle = '#0a0608'; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); }
    for (const q of run.quakes) { this.ring(q.x, q.y, q.r, '#ffb070', 0.9); this.ring(q.x, q.y, q.r - 2, '#8a5030', 0.6); }
    for (const f of run.foes) if (!f.dead && f.kind === 'golem' && f.state === 'slam') this.ring(f.x, f.y, 110, '#ff5a3c', 0.35 + 0.35 * Math.sin(t * 20), 3);
    // the line a swung enemy will fly along if Dora lets go
    const r = run.rope, held = r && r.to.kind === 'foe' ? run.foe(r.to.id) : null;
    if (held) {
      const sp = Math.hypot(held.vx, held.vy);
      if (sp > 80) { const ux = held.vx / sp, uy = held.vy / sp, n = Math.min(70, 30 + sp * 0.18); for (let i = 6; i < n; i += 4) this.px(held.x + ux * i, held.y - 3 + uy * i, '#fff8e0', 0.55 * (1 - i / n) + 0.15); }
      if (run.shield) { const sh = run.shield; this.ring(run.x, run.y - 4, sh, '#fff8e0', 0.18 + 0.1 * Math.sin(t * 30)); }
    }

    // everything that stands, back to front
    const items: { y: number; draw: () => void }[] = [];
    for (const p of L.spikes) items.push({ y: p.y + 6, draw: () => { this.shadow(p.x, p.y + 5, 9); if (!this.sprite('spikes', p.x, p.y + 7)) { c.fillStyle = '#8a8a90'; c.fillRect(p.x - 6, p.y - 12, 12, 18); } } });
    for (const p of L.posts) items.push({ y: p.y + 4, draw: () => { this.shadow(p.x, p.y + 4, 6); if (!this.sprite('post', p.x, p.y + 5)) { c.fillStyle = '#7a7a80'; c.fillRect(p.x - 4, p.y - 14, 8, 18); } } });
    for (const p of L.crates) if (!p.broken) items.push({ y: p.y + 5, draw: () => { this.shadow(p.x, p.y + 5, 8); if (!this.sprite('crate', p.x, p.y + 7)) { c.fillStyle = '#9a6a3a'; c.fillRect(p.x - 8, p.y - 10, 16, 16); } } });
    for (const p of run.pickups) items.push({ y: p.y, draw: () => { this.shadow(p.x, p.y + 3, 4); this.sprite('heart', p.x, p.y - 2 + Math.round(Math.sin(t * 5) * 1.5)); } });
    const e = L.enzo;
    items.push({ y: e.y + 5, draw: () => {
      this.shadow(e.x, e.y + 6, 9);
      const face: 1 | -1 = e.x < W / 2 ? 1 : -1;
      const tug = r && r.to.kind === 'enzo' ? Math.round(Math.sin(t * 30)) : 0;
      if (!this.sprite('enzo', e.x + tug, e.y + 8, face)) { c.fillStyle = '#7a7a90'; c.fillRect(e.x - 6, e.y - 18, 12, 24); }
    } });
    for (const f of run.foes) items.push({ y: f.y + f.r * 0.5, draw: () => this.foe(f, run, t) });
    items.push({ y: run.y + PLAYER_R * 0.5, draw: () => this.dora(run, t) });
    items.sort((a, b) => a.y - b.y);
    // speed trails under everything that stands
    this.trailsFor(run);
    for (const it of items) it.draw();

    // the rope and the flying hook, over the bodies
    const hx = run.x + run.face * 3, hy = run.y - 12;
    if (run.hook) { this.rope(hx, hy, run.hook.x, run.hook.y, 0); this.px(run.hook.x, run.hook.y, '#ffffff'); this.px(run.hook.x + 1, run.hook.y, '#c8c8d0'); this.px(run.hook.x, run.hook.y + 1, '#c8c8d0'); }
    if (r) {
      const a = run.anchorAt(r.to);
      if (a) { const ty = r.to.kind === 'foe' ? a.y - (held?.r ?? 6) * 0.7 : r.to.kind === 'enzo' ? a.y - 8 : a.y - 14; this.rope(hx, hy, a.x, ty, run.swing); }
    }
    for (const s of run.shots) {
      if (s.kind === 'rock') { c.fillStyle = '#3a3438'; c.fillRect(Math.round(s.x) - 3, Math.round(s.y) - 7, 7, 6); c.fillStyle = '#8a8288'; c.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 7, 5, 4); this.shadow(s.x, s.y + 2, 3); }
      else { c.fillStyle = '#4a2a14'; c.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 6, 4, 4); c.fillStyle = '#c87a3a'; c.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 6, 2, 2); this.shadow(s.x, s.y + 1, 2); }
    }

    // aiming: a bracket on what the hook will go for, or a dotted line to the mouse
    if (!r && !run.hook && run.phase === 'fight') {
      if (v.mouse) {
        const dx = v.mouse.x - run.x, dy = v.mouse.y - run.y, d = Math.hypot(dx, dy) || 1, n = Math.min(d, run.ropeMax);
        for (let i = 10; i < n; i += 5) this.px(run.x + (dx / d) * i, run.y - 8 + (dy / d) * i, '#fff8e0', 0.45);
        const mx = Math.round(v.mouse.x), my = Math.round(v.mouse.y);
        for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, 0], [2, 0], [0, -2], [0, 2]]) this.px(mx + ox, my + oy, '#ffffff', 0.85);
      } else if (v.target) {
        const b = v.target, s = 9 + Math.round(Math.sin(t * 8)), by = b.y - 6;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { this.px(b.x + sx * s, by + sy * s, '#ffe066'); this.px(b.x + sx * (s - 1), by + sy * s, '#ffe066'); this.px(b.x + sx * s, by + sy * (s - 1), '#ffe066'); }
      }
    }

    // particles
    for (const p of this.parts) {
      p.life -= v.dt; p.x += p.vx * v.dt; p.y += p.vy * v.dt;
      const a = Math.max(0, p.life / p.max);
      if (p.kind === 'num') this.digits(p.n ?? 0, p.x, p.y, p.c, Math.min(1, a * 2));
      else if (p.kind === 'ring') this.ring(p.x, p.y, (p.r ?? 30) * (1 - a * 0.7), p.c, a);
      else { if (p.kind === 'dust') { p.vx *= 0.9; p.vy *= 0.9; } if (p.kind === 'chip') p.vy += 260 * v.dt; c.globalAlpha = a; c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); c.globalAlpha = 1; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  /** the rope: a twisted pixel line that heats from gold to red as the swing speeds up */
  private rope(x0: number, y0: number, x1: number, y1: number, speed: number) {
    const k = Math.min(1, speed / 240);
    const hot = k > 0.85 ? ['#fff0d0', '#ff6a3a'] : k > 0.55 ? ['#ffc46a', '#e0702a'] : ['#f2c14e', '#a8742a'];
    // a dark outline all round so it reads on every floor, then the twisted core
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, () => '#2a1608');
    this.line(x0, y0, x1, y1, (i) => hot[Math.floor(i / 2) % 2]);
  }

  private trailsFor(run: Run) {
    const live = new Set<number>();
    for (const f of run.foes) {
      live.add(f.id); const sp = Math.hypot(f.vx, f.vy); let tr = this.trails.get(f.id);
      if (!tr) { tr = []; this.trails.set(f.id, tr); }
      tr.push({ x: f.x, y: f.y - f.r * 0.6 }); if (tr.length > 9) tr.shift();
      if (sp > 110 && (f.flung > 0 || f.tumble > 0)) for (let i = 0; i < tr.length - 1; i++) { const a = (i / tr.length) * 0.5; this.line(tr[i].x, tr[i].y, tr[i + 1].x, tr[i + 1].y, () => '#ffffff', a); this.line(tr[i].x, tr[i].y - 3, tr[i + 1].x, tr[i + 1].y - 3, (j) => (j % 2 ? null : '#ffffff'), a * 0.6); }
    }
    for (const id of this.trails.keys()) if (!live.has(id)) this.trails.delete(id);
    this.doraTrail.push({ x: run.x, y: run.y - 8 }); if (this.doraTrail.length > 8) this.doraTrail.shift();
    if (Math.hypot(run.vx, run.vy) > 160) for (let i = 0; i < this.doraTrail.length - 1; i++) this.line(this.doraTrail[i].x, this.doraTrail[i].y, this.doraTrail[i + 1].x, this.doraTrail[i + 1].y, () => '#fff8e0', (i / this.doraTrail.length) * 0.5);
  }

  private foe(f: Foe, run: Run, t: number) {
    const c = this.c, def = FOES[f.kind], id = f.kind as SpriteId;
    const feet = f.y + f.r * 0.7;
    if (f.state === 'spawn') {
      const k = 1 - f.t / 0.7;
      this.ring(f.x, feet - 2, 4 + (1 - k) * 8, '#e8e0d0', 0.6 * (1 - k));
      this.sprite(id, f.x, feet, f.face, { alpha: k, scale: 0.6 + 0.4 * k });
      return;
    }
    if (f.dead && f.tumble <= 0) {
      // a fall into a pit shrinks away; anything else flashes out
      const fall = run.layout.pits.find((p) => Math.hypot(p.x - f.x, p.y - f.y) < p.r + 2);
      if (fall) { const k = Math.max(0, f.flash / 0.5); this.sprite(id, fall.x, fall.y + 4, f.face, { scale: k, alpha: k }); }
      else this.sprite(id, f.x, feet, f.face, { flash: true, alpha: Math.max(0, f.flash / 0.25) });
      return;
    }
    this.shadow(f.x, feet - 1, f.r);
    const caught = run.rope?.to.kind === 'foe' && run.rope.to.id === f.id;
    const spin = f.tumble > 0 ? t * 30 : caught && run.swing > 140 ? Math.sin(t * 40) * 0.3 : 0;
    const hop = f.kind === 'slime' ? -Math.max(0, Math.round(Math.hypot(f.vx, f.vy) / 30)) : 0;
    const telegraph = f.state === 'aim' || f.state === 'slam' || f.state === 'throw';
    const shakeX = telegraph && f.kind !== 'spitter' ? Math.round(Math.sin(t * 60)) : 0;
    const bob = f.state === 'walk' && !caught && f.flung <= 0 ? Math.round(Math.abs(Math.sin(t * 9 + f.id))) : 0;
    const flash = f.flash > 0 || (telegraph && Math.floor(t * 12) % 2 === 0);
    if (!this.sprite(id, f.x + shakeX, feet + hop - bob, f.face, { flash, rot: spin, alpha: f.tumble > 0 ? 0.85 : 1 })) {
      c.fillStyle = flash ? '#fff' : { slime: '#5ac85a', grumble: '#9a9aa0', spitter: '#a89080', beetle: '#2a2a30', shellback: '#7a8078', boar: '#8a5a30', golem: '#7a7268' }[f.kind];
      c.fillRect(Math.round(f.x - f.r), Math.round(feet - f.r * 2), f.r * 2, f.r * 2);
    }
    if (f.kind === 'beetle' && Math.floor(t * 10) % 2) this.px(f.x - f.face * 2, feet - 15, '#ffe066');
    // a warning mark over anything about to act
    if (telegraph) { const top = feet - (this.img.get(id)?.height ?? f.r * 2) - 6, col = f.kind === 'boar' || f.kind === 'golem' ? '#ff4a3a' : '#ffe066'; for (let i = 0; i < 4; i++) this.px(f.x, top + i, col); this.px(f.x, top + 5, col); }
    if (f.state === 'stun') { const top = feet - (this.img.get(id)?.height ?? f.r * 2) - 3; for (let i = 0; i < 3; i++) { const a = t * 6 + (i * Math.PI * 2) / 3; this.px(f.x + Math.cos(a) * 6, top + Math.sin(a) * 2, '#ffe066'); } }
    // a little health bar once it's been hurt (the golem's is on the page)
    if (f.hp < f.maxHp && f.kind !== 'golem') {
      const w = Math.max(8, Math.round(f.r * 1.6)), top = feet - (this.img.get(id)?.height ?? f.r * 2) - 3, x = Math.round(f.x - w / 2);
      c.fillStyle = '#2a1418'; c.fillRect(x - 1, top - 1, w + 2, 3); c.fillStyle = '#ff5a5a'; c.fillRect(x, top, Math.max(1, Math.round((w * f.hp) / def.hp)), 1);
    }
  }

  private dora(run: Run, t: number) {
    const sp = Math.hypot(run.vx, run.vy), feet = run.y + PLAYER_R;
    this.shadow(run.x, feet - 1, 7);
    if (run.inv > 0 && run.dashT <= 0 && Math.floor(t * 16) % 2 === 0) return;
    const pose: SpriteId = run.rope || run.hook ? 'dora-swing' : sp > 20 ? (Math.floor(t * 8) % 2 ? 'dora-run' : 'dora-stand') : 'dora-stand';
    const bob = pose === 'dora-stand' && sp > 20 ? -1 : 0;
    if (!this.sprite(pose, run.x, feet + bob, run.face, { alpha: run.dashT > 0 ? 0.6 : 1 })) { this.c.fillStyle = '#f0e6d8'; this.c.fillRect(run.x - 6, feet - 22, 12, 22); }
  }
}
