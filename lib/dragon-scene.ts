// Dragon Playground drawing: Canvas 2D, a side-on camera that runs with the dragon. Every sprite is a Codex mosaic
// painting cut into an atlas (lib/dragon-art.ts) and drawn 1:1, never stretched; props are drawn to fit their footprint
// in the course. The dragon is a cut-out rig: a head, three body segments that follow the head's path like a train,
// tail and four legs swinging from their hips. No rules here: it reads the game and draws it.
import { DRAGON_ATLAS, DRAGON_IMG, DRAGON_BG } from './dragon-art';
import { DragonGame, DRAGON_H, WATER_Y, type Fx, type Otter, type Crow, type HeroId } from './dragon-game';
import { RACES, SLIDE_W, SEESAW_W, SWING_W, POLE_W, BENCH_W, BENCH_H, VOID_CEIL, STALL_CEIL, STONE_H, type Race } from './dragon-levels';

export const VIEW_W = 1536, VIEW_H = 864;
const GROUND_Y = 700;                      // where world y = 0 sits on screen (before the camera lifts)
const ZOOM = 1.15;
/** the sky behind each race's backdrop, top and bottom, for when the camera lifts above the painting */
const SKY: [string, string][] = [['#8a77b8', '#f0a98a'], ['#7fb2dc', '#cfe4ee'], ['#5f6f86', '#9aa8b4'], ['#121a3c', '#2a2f5a'], ['#101a40', '#26346a']];
/** each race's sleeping playground at the finish; the last race lines up all four */
const MARKS: [string, string, string, number][] = [['dove', 'asleep', 'awake', 470], ['marks', 'pelican0', 'pelican1', 480], ['marks', 'melon0', 'melon1', 420], ['marks', 'mini0', 'mini1', 430]];                         // the world is drawn a little closer than the far backdrop
const INK = '#221d1b';                     // the grout outline
type Part = [number, number, number, number];

interface Particle { kind: 'sprite' | 'drop' | 'ring' | 'text'; x: number; y: number; vx: number; vy: number; t: number; life: number; part?: string; text?: string; col?: string; r?: number }

export class DragonScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  camX = 0; camY = 0; t = 0;
  private trail: { x: number; y: number }[] = [];
  private parts: Particle[] = [];
  private runPhase = 0; private sandT = 0;
  private race: Race | null = null;
  woke = false;

  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.ctx = cv.getContext('2d')!; }

  load(): Promise<void> {
    const ids = [...Object.keys(DRAGON_ATLAS), ...DRAGON_BG, 'ground-path', 'ground-sand', 'ground-grass', 'ground-drain'];
    return Promise.all(ids.map((id) => new Promise<void>((res) => {
      if (this.img[id]) return res();
      const im = new Image(); im.onload = () => res(); im.onerror = () => res();
      im.src = DRAGON_ATLAS[id] ? DRAGON_ATLAS[id].src : DRAGON_IMG(id); this.img[id] = im;
    }))).then(() => undefined);
  }
  reset(g: DragonGame) { this.trail = []; this.parts = []; this.race = g.race; this.camX = g.dragon.x - 480; this.camY = 0; this.woke = false; }

  // ───────────────────────────────────────────── helpers
  private part(atlas: string, name: string): Part | null { return DRAGON_ATLAS[atlas]?.parts[name] ?? null; }
  private sx(x: number) { return x - this.camX; }
  private sy(y: number) { return GROUND_Y - y + this.camY; }
  /** draw an atlas part 1:1 with its bottom-centre at world (x, y), optionally rotated about (ox, oy) in part px */
  private spr(atlas: string, name: string, x: number, y: number, o: { rot?: number; ox?: number; oy?: number; alpha?: number; flip?: boolean; dark?: boolean } = {}) {
    const p = this.part(atlas, name), im = this.img[atlas]; if (!p || !im?.complete) return;
    const c = this.ctx; c.save();
    c.translate(this.sx(x), this.sy(y));
    if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    if (o.flip) c.scale(-1, 1);
    const ox = o.ox ?? p[2] / 2, oy = o.oy ?? p[3];
    if (o.rot) c.rotate(o.rot);
    if (o.dark) c.filter = 'brightness(0.72) saturate(0.85)';
    c.drawImage(im, p[0], p[1], p[2], p[3], -ox, -oy, p[2], p[3]);
    c.restore();
  }
  /** a prop drawn to fit `w` world px wide (keeping its proportions), standing on world y = `y` at its left edge x */
  private fit(atlas: string, name: string, x: number, w: number, y = 0, alpha = 1) {
    const p = this.part(atlas, name), im = this.img[atlas]; if (!p || !im?.complete) return 0;
    const h = p[3] * (w / p[2]); const c = this.ctx;
    if (alpha < 1) { c.save(); c.globalAlpha = alpha; }
    c.drawImage(im, p[0], p[1], p[2], p[3], this.sx(x), this.sy(y) - h, w, h);
    if (alpha < 1) c.restore();
    return h;
  }
  private trailY(x: number) {
    const tr = this.trail; if (!tr.length) return 0;
    if (x <= tr[0].x) return tr[0].y;
    let lo = 0, hi = tr.length - 1;
    if (x >= tr[hi].x) return tr[hi].y;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tr[m].x <= x) lo = m; else hi = m; }
    const a = tr[lo], b = tr[hi], k = (x - a.x) / Math.max(1e-6, b.x - a.x);
    return a.y + (b.y - a.y) * k;
  }

  // ───────────────────────────────────────────── effects from the engine
  ingest(fx: Fx[], g: DragonGame) {
    const d = g.dragon;
    for (const f of fx) {
      switch (f.k) {
        case 'land': case 'bonk': case 'stumble': this.burst('chips', f.x + 30, f.y + 10, 1); break;
        case 'swat': this.burst('chips', f.x + 80, f.y, 1); break;
        case 'toast': this.parts.push({ kind: 'text', x: f.x, y: f.y + 30, vx: 0, vy: 90, t: 0, life: 0.7, text: '+1', col: '#ffd34a' }); break;
        case 'splash': for (let i = 0; i < 18; i++) this.parts.push({ kind: 'drop', x: f.x + (i - 9) * 6, y: WATER_Y + 10, vx: (i - 9) * 30, vy: 380 + (i % 5) * 70, t: 0, life: 0.9, r: 5 + (i % 3) * 2, col: '#8fd0d8' }); break;
        case 'roar': this.parts.push({ kind: 'ring', x: d.x + 70, y: d.y + 100, vx: 0, vy: 0, t: 0, life: 0.7, col: '#ffd34a' }); break;
        case 'spring': case 'fling': this.burst('chips', f.x, f.y, 1); break;
        case 'otterdive': case 'otterpop': this.burst('sand', f.x, 0, 1); break;
        case 'steal': this.parts.push({ kind: 'text', x: f.x, y: f.y + 20, vx: 0, vy: 70, t: 0, life: 0.9, text: 'Caw!', col: '#fff6e6' }); break;
        case 'gulp': case 'seed': case 'twin': case 'flutter': this.parts.push({ kind: 'ring', x: d.x, y: d.y + 120, vx: 0, vy: 0, t: 0, life: 0.6, col: '#9fe3ff' }); break;
        case 'win': this.woke = true; break;
      }
    }
  }
  private burst(part: string, x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.parts.push({ kind: 'sprite', part, x, y, vx: 0, vy: 40, t: 0, life: 0.45 });
  }

  // ───────────────────────────────────────────── the frame
  draw(g: DragonGame, dt: number) {
    const c = this.ctx, cv = this.cv;
    this.t += dt;
    const d = g.dragon;
    // the head's path: segments follow it by x
    if (d.st !== 'splash') {
      const tr = this.trail;
      while (tr.length && tr[tr.length - 1].x > d.x - 0.5) tr.pop();
      tr.push({ x: d.x, y: d.y });
      if (tr.length > 1400) tr.splice(0, tr.length - 1400);
    } else this.trail = [];
    // camera: the dragon sits in the left third, the view lifts when it flies high
    const tx = d.x - 400, ty = Math.max(0, d.y - 280);
    this.camX += (tx - this.camX) * Math.min(1, dt * 6 + (Math.abs(tx - this.camX) > 900 ? 1 : 0));
    this.camY += (ty - this.camY) * Math.min(1, dt * 4);
    if (d.vx !== 0 && d.ground) this.runPhase += dt * 14 * (Math.abs(d.vx) / 360); else if (d.ground) this.runPhase *= 0.9;

    const s = Math.min(cv.width / VIEW_W, cv.height / VIEW_H);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#1f1a1f'; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(s, 0, 0, s, (cv.width - VIEW_W * s) / 2, (cv.height - VIEW_H * s) / 2);
    c.save(); c.beginPath(); c.rect(0, 0, VIEW_W, VIEW_H); c.clip();
    this.drawBack(g);
    c.translate(0, GROUND_Y); c.scale(ZOOM, ZOOM); c.translate(0, -GROUND_Y);
    this.drawCourseBack(g);
    this.drawGround(g);
    this.drawCourseFront(g);
    for (const t of g.toasts) if (!t.taken && Math.abs(t.x - this.camX - 700) < 1000) this.spr('crows', 'toast', t.x, t.y - 18 + Math.sin(this.t * 4 + t.x) * 5);
    for (const o of g.otters) this.drawOtter(g, o);
    this.drawDragon(g);
    for (const cr of g.crows) if (!cr.gone) this.drawCrow(cr);
    // sand kicked up when the dragon runs in a sandpit
    this.sandT -= dt;
    if (d.ground && d.y < 2 && g.groundKind(d.x) === 'sand' && d.vx !== 0 && this.sandT <= 0) { this.sandT = 0.12; this.burst('sand', d.x - 60, 0, 1); }
    this.drawParts(dt);
    c.setTransform(s, 0, 0, s, (cv.width - VIEW_W * s) / 2, (cv.height - VIEW_H * s) / 2);
    if (this.race?.night) { c.fillStyle = 'rgba(20,24,60,0.28)'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.race?.rain) {
      // monsoon streaks, slanted, drifting with the camera
      c.strokeStyle = 'rgba(220,232,245,0.42)'; c.lineWidth = 2; c.beginPath();
      for (let i = 0; i < 140; i++) { const rx = ((i * 211 + this.camX * 0.9 + this.t * 220) % (VIEW_W + 200)) - 100, ry = ((i * 97 + this.t * 1300) % (VIEW_H + 60)) - 30; c.moveTo(VIEW_W - rx, ry); c.lineTo(VIEW_W - rx - 10, ry + 34); }
      c.stroke(); c.fillStyle = 'rgba(70,90,120,0.14)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    c.restore();
  }

  private drawBack(g: DragonGame) {
    const n = this.raceNo(), c = this.ctx, bg = this.img[`bg${n}far`] ?? this.img['bg1far'];
    const [s0, s1] = SKY[n - 1] ?? SKY[0];
    const sky = c.createLinearGradient(0, 0, 0, VIEW_H); sky.addColorStop(0, s0); sky.addColorStop(1, s1);
    c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
    if (bg?.complete && bg.naturalWidth) {
      const off = -((this.camX * 0.25) % VIEW_W), y = GROUND_Y + 120 - VIEW_H + this.camY * 0.3;
      for (let k = -1; k < 2; k++) c.drawImage(bg, off + k * VIEW_W, y, VIEW_W, VIEW_H);
    }
    // mid-ground: trees, lamps, bicycles, placed by a hash of their slot so they never move between frames
    const names = ['tree', 'shrub', 'lamp', 'tree', 'bike', 'rail', 'palm', 'walkway', 'shrub', 'lamp'];
    const par = 0.6, slotW = 420, x0 = this.camX * par;
    for (let k = Math.floor(x0 / slotW) - 1; k < Math.floor((x0 + VIEW_W) / slotW) + 2; k++) {
      const h = Math.abs(Math.sin(k * 127.1 + 3.7) * 43758.5) % 1;
      if (h < 0.25) continue;
      const n = names[Math.floor(h * 977) % names.length], p = this.part('mid1', n); if (!p) continue;
      const sx = k * slotW + (h * 180) - x0, im = this.img['mid1'];
      const k2 = 0.72, w2 = p[2] * k2, h2 = p[3] * k2;
      if (im?.complete) { c.save(); c.globalAlpha = 0.92; if (this.race?.night) c.filter = 'brightness(0.62) saturate(0.8)'; else if (this.race?.rain) c.filter = 'brightness(0.85) saturate(0.75)'; c.drawImage(im, p[0], p[1], p[2], p[3], sx - w2 / 2, GROUND_Y + 10 - h2 + this.camY * 0.6, w2, h2); c.restore(); }
    }
  }

  private raceNo() { return Math.max(1, RACES.findIndex((r) => r.id === this.race?.id) + 1); }
  private visible(x0: number, x1: number) { return x1 > this.camX - 200 && x0 < this.camX + VIEW_W / ZOOM + 200; }

  private drawGround(g: DragonGame) {
    const c = this.ctx, C = g.course;
    // longkangs first: concrete drain walls and murky water
    for (const gp of C.gaps) {
      if (!this.visible(gp.x0, gp.x1)) continue;
      const x = this.sx(gp.x0), w = gp.x1 - gp.x0, top = this.sy(0), bot = VIEW_H + 10;
      if (gp.water) {
        // the Bishan Park river: open water just under the stepping stones, reeds at the banks
        const wy = this.sy(-14);
        c.fillStyle = '#1f3f6e'; c.fillRect(x, wy, w, bot - wy);
        c.fillStyle = '#2e5a92'; c.fillRect(x, wy, w, 26);
        c.fillStyle = 'rgba(200,225,250,0.55)';
        for (let i = 0; i < w; i += 38) c.fillRect(x + i + ((this.t * 30 + i * 7) % 26), wy + 8 + (i % 4) * 14, 16, 3);
        c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(x, top); c.lineTo(x, bot); c.moveTo(x + w, top); c.lineTo(x + w, bot); c.stroke();
        continue;
      }
      const im = this.img['ground-drain'];
      if (im?.complete) { c.save(); c.beginPath(); c.rect(x, top, w, bot - top); c.clip(); for (let k = 0; k * 1152 < w + 1152; k++) c.drawImage(im, x + k * 1152 - ((gp.x0 % 1152) + 1152) % 1152, top, 1152, 192); c.restore(); }
      else { c.fillStyle = '#4a4c50'; c.fillRect(x, top, w, bot - top); }
      const wy = this.sy(WATER_Y);
      c.fillStyle = gp.water ? 'rgba(52,96,150,0.86)' : 'rgba(60,110,110,0.78)'; c.fillRect(x, wy, w, bot - wy);
      c.fillStyle = 'rgba(190,230,225,0.7)';
      for (let i = 0; i < w; i += 46) c.fillRect(x + i + ((this.t * 40 + i) % 30), wy + 4 + (i % 3) * 5, 14, 4);
      c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(x, top); c.lineTo(x, bot); c.moveTo(x + w, top); c.lineTo(x + w, bot); c.stroke();
    }
    for (const gr of C.ground) {
      if (!this.visible(gr.x0, gr.x1)) continue;
      const im = this.img['ground-' + gr.g], x = this.sx(gr.x0), w = gr.x1 - gr.x0, top = this.sy(0);
      c.save(); c.beginPath(); c.rect(x, top, w, VIEW_H - top + 200); c.clip();
      if (im?.complete) for (let k = 0; k * 1152 < w + 1152; k++) c.drawImage(im, x + k * 1152 - ((gr.x0 % 1152) + 1152) % 1152, top - 4, 1152, 192);
      else { c.fillStyle = gr.g === 'sand' ? '#d8b98a' : gr.g === 'grass' ? '#6c8a4a' : '#bdb7ae'; c.fillRect(x, top, w, VIEW_H); }
      c.restore();
      c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(x, top); c.lineTo(x + w, top); c.stroke();
    }
    // the edges of each longkang over the ground
    c.strokeStyle = INK; c.lineWidth = 6;
    for (const gp of C.gaps) if (this.visible(gp.x0, gp.x1)) { c.beginPath(); c.moveTo(this.sx(gp.x0), this.sy(0) - 3); c.lineTo(this.sx(gp.x0), this.sy(-60)); c.moveTo(this.sx(gp.x1), this.sy(0) - 3); c.lineTo(this.sx(gp.x1), this.sy(-60)); c.stroke(); }
  }

  /** props behind the racers: slides, swings, bars, poles, the finish and the playground that wakes */
  private drawCourseBack(g: DragonGame) {
    const c = this.ctx;
    for (const p of g.course.props) {
      const w = p.w ?? 0;
      if (!this.visible(p.x - 400, p.x + Math.max(w, 400))) continue;
      switch (p.kind) {
        case 'slide': this.fit('props', 'slide', p.x, SLIDE_W); break;
        case 'swing': this.fit('props', 'swing', p.x, SWING_W); break;
        case 'bars': this.fit('props', 'bars', p.x, w); break;
        case 'pole': this.fit('props', 'pole', p.x, POLE_W); break;
        case 'mgr': {
          const used = g.course.pads.findIndex((q) => q.x0 === p.x);
          const spin = used >= 0 && g.dragon.padUsed.has(used) ? Math.sin(this.t * 18) * 3 : 0;
          this.fit('props', 'mgr', p.x + spin, w); break;
        }
        case 'finish': this.fit('props', 'finish', p.x - 207, 415); break;
        case 'landmark': {
          const awake = this.woke, n = this.raceNo();
          const list = n === 5 ? MARKS : [MARKS[n - 1]];
          let x = p.x - 120;
          for (const [atl, a0, a1, w] of list) {
            // on the last race every playground you woke is out at the finish to cheer you home
            const on = awake || n === 5;
            if (!on) { c.save(); c.filter = 'grayscale(0.7) brightness(0.8)'; }
            this.fit(atl, on ? a1 : a0, x, w);
            if (!on) c.restore();
            x += w + 40;
          }
          break;
        }
        case 'stall': {
          // the whole stall behind the racers, its awning's lower edge at the ceiling height, bulbs strung above
          const pr = this.part('props2', 'stall'), im = this.img['props2']; if (!pr || !im?.complete) break;
          const k = w / pr[2], h = pr[3] * k, top = this.sy(STALL_CEIL) - pr[3] * 0.3 * k;
          c.save(); c.beginPath(); c.rect(this.sx(p.x) - 10, 0, w + 20, this.sy(0)); c.clip();
          c.drawImage(im, pr[0], pr[1], pr[2], pr[3], this.sx(p.x), top, w, Math.max(h, this.sy(0) - top)); c.restore();
          this.fit('props2', 'bulbs', p.x - 40, w + 80, STALL_CEIL + 150);
          break;
        }
        case 'voiddeck': {
          // painted void-deck bays whose slab underside sits on the ceiling height
          const x = this.sx(p.x);
          const bays = Math.max(1, Math.round(w / 520)), bw = w / bays, pr = this.part('props2', 'voiddeck'), im = this.img['props2'];
          if (pr && im?.complete) for (let b = 0; b < bays; b++) c.drawImage(im, pr[0], pr[1], pr[2], pr[3], x + b * bw, this.sy(0) - (VOID_CEIL + 34), bw, VOID_CEIL + 38);
          break;
        }
      }
    }
  }
  /** props in front of or level with the racers: benches, see-saws, grates, stalls, stones */
  private drawCourseFront(g: DragonGame) {
    const c = this.ctx;
    for (const p of g.course.props) {
      const w = p.w ?? 0;
      if (!this.visible(p.x - 300, p.x + Math.max(w, 300))) continue;
      switch (p.kind) {
        case 'bench': this.fit('props', 'bench', p.x, BENCH_W); break;
        case 'planter': {
          const pr = this.part('props2', 'planter'), im = this.img['props2'];
          if (pr && im?.complete) this.fit('props2', 'planter', p.x, w);
          break;
        }
        case 'seesaw': {
          // the plank dips towards whichever end the dragon stands on
          const d = g.dragon, on = d.ground && d.x >= p.x && d.x <= p.x + SEESAW_W;
          const tilt = on ? ((d.x - (p.x + SEESAW_W / 2)) / SEESAW_W) * 0.18 : -0.06;
          const pr = this.part('props', 'seesaw'), im = this.img['props']; if (!pr || !im?.complete) break;
          const sc = SEESAW_W / pr[2], h = pr[3] * sc;
          c.save(); c.translate(this.sx(p.x + SEESAW_W / 2), this.sy(0) - h * 0.55); c.rotate(tilt);
          c.drawImage(im, pr[0], pr[1], pr[2], pr[3], -SEESAW_W / 2, -h * 0.45, SEESAW_W, h); c.restore();
          break;
        }
        case 'grate': {
          const pr = this.part('props', 'grate'), im = this.img['props']; if (!pr || !im?.complete) break;
          c.drawImage(im, pr[0], pr[1], pr[2], pr[3], this.sx(p.x) - 80, this.sy(0) - 6, 160, 160 * pr[3] / pr[2]);
          break;
        }
        case 'stall': {
          // the awning front, in front of the racers, so the dragon ducks under it
          const pr = this.part('props2', 'stall'), im = this.img['props2']; if (!pr || !im?.complete) break;
          const k = w / pr[2], aw = pr[3] * 0.3;
          c.drawImage(im, pr[0], pr[1], pr[2], aw, this.sx(p.x), this.sy(STALL_CEIL) - aw * k, w, aw * k);
          break;
        }
        case 'stone': {
          const pr = this.part('props2', 'stone'), im = this.img['props2'];
          if (pr && im?.complete) c.drawImage(im, pr[0], pr[1], pr[2], pr[3], this.sx(p.x) - 6, this.sy(STONE_H) - 8, w + 12, (w + 12) * pr[3] / pr[2]);
          break;
        }
      }
    }
  }

  // ───────────────────────────────────────────── the dragon and its riders
  private drawDragon(g: DragonGame) {
    const d = g.dragon;
    if (d.st === 'splash') {
      const k = Math.min(1, d.stT / 0.5);
      this.spr('dragon', 'headOpen', d.x, WATER_Y - 30 - k * 60, { alpha: 1 - k });
      return;
    }
    const low = d.st === 'belly' || d.st === 'slide';
    const air = !d.ground && !d.hang;
    const bob = d.ground && !low ? Math.abs(Math.sin(this.runPhase)) * 6 : 0;
    const bodyLift = low ? 40 : 82;                  // the bottom of the body segments above the feet
    // segment x along the path behind the head; y from where the head was at that x
    const segX = [d.x - 40, d.x - 140, d.x - 240], tailX = d.x - 330;
    // each joint follows the head's path, but a joint can't sit more than a little above or below the one in front, so
    // the body curls over a jump instead of tracing it
    const pts = [d.x, ...segX, tailX], jy: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const raw = d.hang ? d.y : this.trailY(pts[i]);
      jy.push(i === 0 ? raw : Math.max(jy[i - 1] - 38, Math.min(jy[i - 1] + 38, raw)));
    }
    const yAt = (x: number) => { const i = pts.findIndex((q) => Math.abs(q - x) < 30); if (i >= 0) return jy[i]; return jy[0] + (jy[jy.length - 1] - jy[0]) * Math.min(1, Math.max(0, (d.x - x) / 330)); };
    const legs: [number, number][] = [[segX[0] + 10, 0], [segX[2] + 10, 1]];
    const legRot = (i: number, far: boolean) => {
      if (d.hang) return (far ? 0.5 : 0.25) + Math.sin(this.t * 6 + i) * 0.1;
      if (air) return i === 0 ? -0.7 : 0.7;
      if (low) return i === 0 ? -1.2 : 1.2;
      return Math.sin(this.runPhase + (far ? Math.PI : 0) + i * Math.PI * 0.5) * 0.55;
    };
    // far legs, darker, behind the body
    for (const [lx, i] of legs) this.spr('dragon', air || low ? 'legB' : 'leg', lx - 14, yAt(lx) + bodyLift + 26 + bob, { rot: legRot(i, true), oy: 10, dark: true });
    // tail, swishing
    const ty = yAt(tailX) + bodyLift + 20 + bob;
    this.spr('dragon', 'tail', tailX - 40, ty, { rot: Math.sin(this.t * 5) * 0.12 + (air ? -0.2 : 0), ox: 140, oy: 60 });
    // body segments, back to front; the two with handles carry the heroes
    const names = ['segH', 'segH', 'seg'];
    for (let i = 2; i >= 0; i--) {
      const x = segX[i], y = yAt(x) + bodyLift + (i % 2 ? Math.sin(this.runPhase + 1) * 4 : bob);
      const nx = i === 0 ? d.x : segX[i - 1], rot = d.hang ? 0 : Math.atan2(yAt(x) - yAt(nx), nx - x) * -0.8;
      this.spr('dragon', i === 2 ? 'seg' : names[i], x, y - 6, { rot, oy: i === 2 ? 81 : 114 });
    }
    // the heroes: the driver on the front handle, the rider on the back one
    const drv = g.driver, rid: HeroId = g.riderId;
    const dPose = d.finished !== null ? (g.place === 1 ? 'cheer' : 'sit') : d.stumbleT > 0 ? 'wobble' : (d.tier || d.onSlide || low) ? 'lean' : 'sit';
    const R = g.rider;
    const rPose = R.act === 'sad' ? 'sit' : R.act;
    const seatY = (x: number) => yAt(x) + bodyLift + 70 + bob;
    if (d.hang) {
      // the rider hangs from the bars, the dragon dangling under them
      this.spr(rid, 'hang', segX[1] + 6, d.y + DRAGON_H + 95 - 112 + 6);
    } else this.spr(rid, rPose, segX[1] + 6, seatY(segX[1]) - (rPose === 'grab' || rPose === 'swat' ? 0 : 6));
    this.spr(drv, dPose, segX[0] + 6, seatY(segX[0]) - 6);
    // near legs and the head in front
    for (const [lx, i] of legs) this.spr('dragon', air || low ? 'legB' : 'leg', lx + 8, yAt(lx) + bodyLift + 26 + bob, { rot: legRot(i, false), oy: 10 });
    const open = d.tier === 'roar' || d.st === 'spring' || d.st === 'fling' || (d.st === 'jump' && d.stT < 0.25) || d.finished !== null && g.place === 1;
    const hy = yAt(d.x) + bodyLift + (low ? -6 : 20) + bob;
    this.spr('dragon', open ? 'headOpen' : 'head', d.x + 48, hy, { rot: air ? (d.vy > 0 ? -0.12 : 0.15) : 0, oy: 80 });
    // speed tiers show as streaks of loose chips behind the dragon
    if (d.tier) {
      const c = this.ctx; c.save(); c.globalAlpha = 0.55; c.fillStyle = d.tier === 'roar' ? '#ffd34a' : '#fff6e6';
      for (let i = 0; i < 6; i++) { const yy = this.sy(yAt(d.x) + 40 + i * 26), xx = this.sx(tailX - 60) - ((this.t * 900 + i * 97) % 260); c.fillRect(xx, yy, 70 + (i % 3) * 20, 6); }
      c.restore();
    }
  }

  private drawOtter(g: DragonGame, o: Otter) {
    const x = g.otterX(o);
    if (!this.visible(x - 200, x + 200)) return;
    if (o.st === 'hidden') {
      // bubbles along the drain where it swims underground
      const c = this.ctx; c.fillStyle = 'rgba(220,240,240,0.8)'; c.strokeStyle = INK; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const r = 5 + ((this.t * 3 + i) % 1) * 6; c.beginPath(); c.arc(this.sx(x - i * 26), this.sy(4) - ((this.t * 60 + i * 20) % 30), r, 0, 7); c.fill(); c.stroke(); }
      return;
    }
    let pose = 'run1';
    switch (o.st) {
      case 'run': pose = ['run1', 'run2', 'run3', 'run4'][Math.floor(o.runT * 10) % 4]; break;
      case 'jump': pose = o.vy > 0 ? 'jump' : 'run1'; break;
      case 'swim': this.spr('otters', 'pop', x, WATER_Y - 30 + Math.sin(this.t * 6 + o.i) * 4); return;
      case 'dive': pose = 'dive'; break;
      case 'pop': pose = 'pop'; break;
      case 'stumble': pose = 'stumble'; break;
      case 'barge': pose = 'barge'; break;
      case 'belly': pose = 'belly'; break;
      case 'cheer': pose = 'cheer'; break;
    }
    const lift = pose.startsWith('run') ? Math.abs(Math.sin(o.runT * 15)) * 6 : 0;
    this.spr('otters', pose, x, o.y + lift - 4, { rot: o.st === 'belly' ? 0.3 : 0 });
  }

  private drawCrow(cr: Crow) {
    let pose = 'fly1';
    if (cr.st === 'fly') pose = Math.floor(cr.t * 8) % 2 ? 'fly1' : 'fly2';
    else if (cr.st === 'swoop') pose = 'swoop';
    else if (cr.st === 'steal') pose = 'steal';
    else pose = 'knocked';
    this.spr('crows', pose, cr.x, cr.y - 60, { rot: cr.st === 'knocked' ? cr.t * 8 : 0, oy: 60, flip: cr.st === 'steal' });
  }

  private drawParts(dt: number) {
    const c = this.ctx;
    this.parts = this.parts.filter((p) => (p.t += dt) < p.life);
    for (const p of this.parts) {
      const k = p.t / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'drop') { p.vy -= 1400 * dt; c.fillStyle = p.col!; c.beginPath(); c.arc(this.sx(p.x), this.sy(p.y), p.r!, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); }
      else if (p.kind === 'sprite') this.spr('crows', p.part!, p.x, p.y, { alpha: 1 - k, rot: 0 });
      else if (p.kind === 'ring') { c.strokeStyle = p.col!; c.globalAlpha = 1 - k; c.lineWidth = 14 * (1 - k) + 2; c.beginPath(); c.arc(this.sx(p.x), this.sy(p.y), 60 + k * 420, 0, 7); c.stroke(); c.globalAlpha = 1; }
      else if (p.kind === 'text') {
        c.font = '900 34px system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 7; c.strokeStyle = INK; c.globalAlpha = 1 - k * k;
        c.strokeText(p.text!, this.sx(p.x), this.sy(p.y)); c.fillStyle = p.col!; c.fillText(p.text!, this.sx(p.x), this.sy(p.y)); c.globalAlpha = 1;
      }
    }
  }
}
