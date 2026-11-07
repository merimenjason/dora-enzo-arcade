// Overclock: the drawing. A 384×216 Canvas 2D view (the page scales it up by whole pixels, unsmoothed): the area's
// painted sky and city layers in parallax, the 16-pixel tiles, the props, foes, bosses, shots and the heroes from the
// pixel strips made by scripts/overclock-art.py, plus the juice (screen shake, hit flash, muzzle flashes, the three
// charge colours, dash afterimages, sparks, reboot sparkles, rain, neon flicker, the dark plant's torchlight). The
// debug overlay outlines every hitbox. No rules here: everything comes from lib/overclock-game.ts.
import {
  VIEW_W, VIEW_H, T, ROWS, CORE_BOSSES, BOSSES, FOES, foeBox, bossBox, foeFrame, miniFrame, bossFrame, POWER,
  type OverclockGame, type GameEvent, type HeroPose, type Foe, type Shot, type Boss,
} from './overclock-game';
import type { Area } from './overclock-world';
import { ART, HAVE, PAINTED } from './overclock-art';
import { heroFrame } from './overclock-anim';

const BASE = '/art/overclock/';
const FOE_ORDER = ['drone', 'sentry', 'bat', 'hopper', 'claw', 'riot', 'gecko', 'grub', 'holo', 'jelly', 'cube', 'dish', 'firefly', 'sweeper'];
/** areas still waiting for their paintings borrow a painted one */
const AREA_ART: Record<Area, Area> = { roof: 'roof', port: 'port', signs: 'signs', depot: 'depot', arcade: 'arcade', highway: 'highway', scrap: 'scrap', observatory: 'observatory', plant: 'plant', tower: 'tower' };
/** each area's neon: the colour of its glow, rain and ui accents */
export const AREA_GLOW: Record<Area, string> = { roof: '#40e8ff', port: '#ff9a3c', signs: '#ff40c8', depot: '#ffd040', arcade: '#b060ff', highway: '#60a0ff', scrap: '#ff7040', observatory: '#c0a0ff', plant: '#a0ff40', tower: '#ff4080' };
const CHARGE_COL = ['', '#a0ff60', '#40e0ff', '#ff60e0'];
const SHOT_COL: Record<string, string> = {
  pellet: '#fff6a0', c1: '#a0ff60', c2: '#40e0ff', c3: '#ff60e0', magnet: '#ff5050', spark: '#ffe040', toss: '#c08040', fly: '#d8ff40', glob: '#60ff90',
  mine: '#ff9040', prism: '#ff80ff', wave: '#ffb040', foe: '#ff4060', blob: '#ff40c0', beam: '#ffffff', ring: '#ff80e0', rock: '#a08060', scrap: '#c0c0c0',
  bolt: '#ffe080', reflect: '#a0ffff', light: '#fff0a0', feather: '#d0b0ff',
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; g: number };
type Ghost = { x: number; y: number; frame: number; face: number; id: string; life: number };

export class OverclockScene {
  view: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img = new Map<string, HTMLImageElement>();
  camX = 0; camY = 0; shake = 0; shakeOn = true; flash = { color: '', t: 0 };
  debug = false;
  particles: Particle[] = []; ghosts: Ghost[] = [];
  /** the key names shown on the intro's prompts (set by the page from the current key map) */
  keys: Record<string, string> = { move: '< >', jump: 'Z', shoot: 'X', dash: 'C', climb: '↑', tag: 'Shift', charge: 'X' };
  touch = false;
  t = 0;

  constructor() {
    this.view = document.createElement('canvas');
    this.view.width = VIEW_W; this.view.height = VIEW_H;
    this.ctx = this.view.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }
  /** start loading every strip; resolves when all have loaded (or failed: drawing falls back to shapes) */
  load(): Promise<void> {
    return Promise.all(HAVE.map((n) => new Promise<void>((res) => {
      const im = new Image(); im.onload = () => { this.img.set(n, im); res(); }; im.onerror = () => res(); im.src = `${BASE}${n}.webp`;
    }))).then(() => undefined);
  }
  has(n: string) { return this.img.has(n); }
  /** draw frame `i` of strip `n` with its anchor at (x, y); flip mirrors it; scale for big foes */
  frame(n: string, i: number, x: number, y: number, ax: number, ay: number, flip = false, scale = 1, alpha = 1) {
    const im = this.img.get(n), m = ART[n];
    if (!im || !m) return false;
    const [cw, ch] = m, c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.translate(Math.round(x), Math.round(y));
    if (flip) c.scale(-1, 1);
    c.drawImage(im, i * cw, 0, cw, ch, Math.round(-ax * scale), Math.round(-ay * scale), Math.round(cw * scale), Math.round(ch * scale));
    c.restore();
    return true;
  }
  icon(strip: string, i: number, x: number, y: number) { const m = ART[strip]; if (!m) return false; return this.frame(strip, i, x, y, m[0] / 2, m[1] / 2); }

  // ─── events from the engine ───
  handle(events: GameEvent[]) {
    for (const e of events) {
      if (e.k === 'shake') this.shake = Math.max(this.shake, e.n);
      else if (e.k === 'flash') this.flash = { color: e.color, t: 8 };
      else if (e.k === 'hit') this.burst(e.x, e.y, e.big ? 12 : 5, e.big ? '#ffffff' : '#fff0a0', e.big ? 2.4 : 1.6);
      else if (e.k === 'reboot') { for (let i = 0; i < (e.big ? 40 : 14); i++) this.part(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 1.2, -Math.random() * 1.6 - 0.3, 60, Math.random() < 0.5 ? '#80ffe0' : '#fff8a0', 2, -0.01); }
      else if (e.k === 'spark') this.burst(e.x, e.y, 4, '#ffe080', 1.4);
      else if (e.k === 'debris') this.burst(e.x, e.y, 3, '#806048', 1.6, 0.15);
      else if (e.k === 'muzzle') this.burst(e.x, e.y, 2, e.color, 0.8);
      else if (e.k === 'item') this.flash = { color: '#ffffff', t: 6 };
      else if (e.k === 'down') this.shake = Math.max(this.shake, 4);
    }
  }
  bikeMix = 0;
  part(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 1, g = 0.05) { this.particles.push({ x, y, vx, vy, life, max: life, color, size, g }); }
  burst(x: number, y: number, n: number, color: string, sp: number, g = 0.03) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random()); this.part(x, y, Math.cos(a) * v, Math.sin(a) * v, 14 + Math.random() * 10, color, Math.random() < 0.3 ? 2 : 1, g); } }

  // ─── the frame ───
  draw(g: OverclockGame) {
    const c = this.ctx, st = g.stage;
    this.t++;
    // an area uses its own paintings once they exist, a stand-in until then
    const area = st.area, art = HAVE.includes(`bg-${area}`) && HAVE.includes(`tiles-${area}`) ? area : AREA_ART[area];
    // camera: follow the lead (a little ahead of them), locked to the arena in a boss fight
    const b = g.body, W = st.w * T, H = ROWS * T;
    let tx = b.x - VIEW_W / 2 + b.face * 28, ty = b.y - VIEW_H * 0.62;
    const ar = g.boss ? g.boss.arena : null;
    if (ar) { tx = ((ar.c0 + ar.c1 + 1) * T) / 2 - VIEW_W / 2; ty = (ar.r1 + 1) * T - VIEW_H + 24; }
    tx = Math.max(0, Math.min(W - VIEW_W, tx)); ty = Math.max(0, Math.min(H - VIEW_H, ty));
    if (this.t === 1 || Math.abs(tx - this.camX) > 300) { this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * 0.18; this.camY += (ty - this.camY) * 0.12;
    let sx = 0, sy = 0;
    if (this.shake > 0 && this.shakeOn) { sx = Math.round((Math.random() - 0.5) * this.shake); sy = Math.round((Math.random() - 0.5) * this.shake); }
    this.shake = Math.max(0, this.shake - 0.5);
    const cx = Math.round(this.camX) - sx, cy = Math.round(this.camY) - sy;

    // the sky and the city
    c.fillStyle = '#0a0820'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    const bg = this.img.get(`bg-${art}`);
    if (bg) { const off = Math.round(cx * 0.12) % bg.width; c.drawImage(bg, -off, Math.round(-cy * 0.06) - 20); c.drawImage(bg, bg.width - off, Math.round(-cy * 0.06) - 20); }
    // over the hover-bike's open water, the waterfront sky fades in (once it is painted)
    const bikeBg = this.img.get('bg-bike');
    if (bikeBg) {
      const mx = cx + VIEW_W / 2, near = st.bikes.some((bk) => mx > bk.x - 60 && mx < bk.x1 + 60);
      this.bikeMix = Math.max(0, Math.min(1, this.bikeMix + (near ? 0.04 : -0.04)));
      if (this.bikeMix > 0) { c.globalAlpha = this.bikeMix; const off = Math.round(cx * 0.12) % bikeBg.width; c.drawImage(bikeBg, -off, Math.round(-cy * 0.06) - 20); c.drawImage(bikeBg, bikeBg.width - off, Math.round(-cy * 0.06) - 20); c.globalAlpha = 1; }
    }
    const mid = this.img.get(`mid-${art}`);
    if (mid) {
      const off = Math.round(cx * 0.4) % mid.width, my = Math.round(VIEW_H - mid.height + 50 - (cy - (H - VIEW_H)) * 0.25);
      // neon flicker: now and then a sign stutters
      c.globalAlpha = (this.t % 173 < 4 || this.t % 311 < 3) ? 0.75 : 1;
      c.drawImage(mid, -off, my); c.drawImage(mid, mid.width - off, my);
      c.globalAlpha = 1;
    }
    if (area !== art) { c.fillStyle = AREA_GLOW[area]; c.globalAlpha = 0.12; c.fillRect(0, 0, VIEW_W, VIEW_H); c.globalAlpha = 1; }

    c.save();
    c.translate(-cx, -cy);
    this.drawTiles(g, cx, cy, art);
    this.drawProps(g);
    for (const p of g.pickups) this.drawPickup(p.kind, p.x, p.y + Math.sin((this.t + p.id * 9) / 8) * 1.5);
    for (const e of g.effects) this.drawEffect(g, e);
    for (const e of g.foes) if (e.alive) this.drawFoe(e);
    if (g.boss) this.drawBoss(g, g.boss);
    // the heroes: the partner behind, then the lead
    const f = g.follower();
    if (f && g.mode !== 'in' && g.mode !== 'out') this.drawHero(f, 0.85, false);
    this.ghosts = this.ghosts.filter((gh) => --gh.life > 0);
    for (const gh of this.ghosts) this.frame(gh.id, gh.frame, gh.x, gh.y, ART[gh.id][0] / 2, ART[gh.id][1] - 2, gh.face < 0, 1, gh.life / 24);
    if (g.pose.st === 'dash' && this.t % 3 === 0) this.ghosts.push({ x: g.pose.x, y: g.pose.y, frame: heroFrame(g.pose), face: g.pose.face, id: g.pose.id, life: 12 });
    this.drawHero(g.pose, 1, true);
    for (const s of g.shots) this.drawShot(s);
    // particles
    this.particles = this.particles.filter((p) => --p.life > 0);
    for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; c.globalAlpha = Math.min(1, (p.life / p.max) * 1.5); c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
    c.globalAlpha = 1;
    if (this.debug) this.drawDebug(g);
    c.restore();

    // weather and light
    if (st.rain) this.drawRain(cx);
    if (st.dark && !g.boss) this.drawDark(g, cx, cy);
    if (this.flash.t > 0) { c.globalAlpha = this.flash.t / 10; c.fillStyle = this.flash.color; c.fillRect(0, 0, VIEW_W, VIEW_H); c.globalAlpha = 1; this.flash.t--; }
    // teleport in and out: a column of light
    if (g.mode === 'in' || g.mode === 'out') {
      const k = g.mode === 'in' ? Math.max(0, 1 - g.modeT / 40) : Math.min(1, g.modeT / 40);
      const hx = Math.round(b.x - cx), hy = Math.round(b.y - cy);
      c.fillStyle = g.lead === 'dora' ? '#ff8070' : '#a0ff60';
      c.globalAlpha = 0.25 + 0.5 * k; c.fillRect(hx - 3, 0, 6, hy); c.globalAlpha = 1;
    }
    if (st.id === 'intro') this.drawPrompts(g, cx);
  }

  drawTiles(g: OverclockGame, cx: number, cy: number, art: Area) {
    const c = this.ctx, ts = this.img.get(`tiles-${art}`);
    const c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(g.stage.w - 1, Math.floor((cx + VIEW_W) / T) + 1);
    const r0 = Math.max(0, Math.floor(cy / T)), r1 = Math.min(ROWS - 1, Math.floor((cy + VIEW_H) / T) + 1);
    const put = (i: number, x: number, y: number) => { if (ts) c.drawImage(ts, i * 16, 0, 16, 16, x, y, 16, 16); else { c.fillStyle = ['#504070', '#382c58', '#3c3060', '#7060a0', '#ff4060', '#706090', '#201838', '#605080', '#40e0ff'][i]; c.fillRect(x, y, 16, i === 3 ? 4 : 16); } };
    const gate = g.gate;
    for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
      const ch = g.tileAt(col, r), x = col * T, y = r * T;
      if (ch === '#') { const top = g.tileAt(col, r - 1); put(top !== '#' && top !== '%' ? 0 : (col * 7 + r * 3) % 5 === 0 ? 2 : 1, x, y); }
      else if (ch === '%') { put(5, x, y); if (this.t % 50 < 25) { c.fillStyle = '#ffffff30'; c.fillRect(x + 2, y + 2, 12, 12); } }
      else if (ch === '=') put(3, x, y);
      else if (ch === '^') put(4, x, y);
      else if (ch === 'o' || ch === 'O') { if (ch === 'o' ? gate : g.gate2) put(3, x, y); else { c.strokeStyle = '#ffffff30'; c.setLineDash([2, 2]); c.strokeRect(x + 0.5, y + 0.5, 15, 3); c.setLineDash([]); } }
      else if (ch === 'x') { if (!gate) { c.fillStyle = (this.t >> 2) % 2 ? '#ff3060' : '#ff6090'; c.fillRect(x + 6, y, 4, 16); c.fillStyle = '#ff306040'; c.fillRect(x + 2, y, 12, 16); } }
      else if (ch === 'w') { c.fillStyle = gate ? '#2a5070' : '#183050'; c.fillRect(x, y + 6, 16, 10); if (!gate) { c.strokeStyle = (this.t + col * 5) % 12 < 6 ? '#80f0ff' : '#ffff80'; c.beginPath(); c.moveTo(x, y + 9); c.lineTo(x + 5, y + 7); c.lineTo(x + 9, y + 11); c.lineTo(x + 16, y + 8); c.stroke(); } }
      else if (ch === '~') this.drawWater(g, col, r, x, y);
    }
    // the boss door and the mini-boss walls
    const d = g.stage.door;
    if (d && d.c >= c0 - 3 && d.c <= c1 + 3) {
      if (!this.frame('props', g.doorShut ? 0 : 1, d.c * T + 8, (d.r1 + 1) * T, 24, 47)) { c.fillStyle = g.doorShut ? '#706080' : '#302840'; c.fillRect(d.c * T, (d.r1 - 2) * T, 16, 48); }
    }
    const m = g.stage.mini;
    if (m && g.miniOn) for (const col of [m.c0, m.c1]) { c.fillStyle = (this.t >> 2) % 2 ? '#ff306090' : '#ff6090a0'; c.fillRect(col * T + 5, m.r0 * T, 6, (m.r1 - m.r0 + 1) * T); }
  }

  /** deep water, drawn in code until it is painted: a rolling surface with a bright crest, depth bands, drifting
   *  caustic glints and neon reflections from the signs above */
  drawWater(g: OverclockGame, col: number, r: number, x: number, y: number) {
    const c = this.ctx, t = this.t;
    let depth = 0;
    while (depth < 6 && g.tileAt(col, r - depth - 1) === '~') depth++;
    // painted water: four surface frames rolling along, then three depths
    if (ART.water && this.frame('water', depth === 0 ? ((t >> 3) + col) % 4 : 3 + Math.min(3, depth), x + 8, y + 16, 8, 16)) return;
    const body = ['#1f4f96', '#173f80', '#12326a', '#0f2858', '#0c2049', '#0a1a3c', '#08152f'][depth];
    if (depth === 0) {
      // the surface: each pixel column rises and falls with two waves
      for (let i = 0; i < 16; i += 1) {
        const wx = x + i;
        const h = Math.round(1.6 * Math.sin((wx + t * 1.1) / 9) + 0.9 * Math.sin((wx - t * 0.7) / 4.5));
        const top = y + 4 + h;
        c.fillStyle = '#2f78c0'; c.fillRect(wx, top, 1, 6);
        c.fillStyle = body; c.fillRect(wx, top + 6, 1, y + 16 - top - 6);
        c.fillStyle = h <= -1 ? '#d8fbff' : '#8fd8ff'; c.fillRect(wx, top, 1, 1);
      }
      // foam flecks that drift along the crest
      const f = ((t >> 1) + col * 7) % 24;
      if (f < 16) { c.fillStyle = '#ffffff'; c.fillRect(x + f, y + 3 + Math.round(1.6 * Math.sin((x + f + t * 1.1) / 9)), 2, 1); }
    } else {
      c.fillStyle = body; c.fillRect(x, y, 16, 16);
      // a band line every other row of tiles, so the depth reads
      if (depth % 2 === 0) { c.fillStyle = '#ffffff10'; c.fillRect(x, y, 16, 1); }
    }
    // caustic glints and neon reflections, hashed per tile so they shimmer without flicker
    const hsh = (col * 73856093) ^ (r * 19349663);
    if (depth < 4) {
      const k = (hsh >>> 0) % 5, ph = ((t >> 3) + (hsh & 7)) % 8;
      if (ph < 5) { c.fillStyle = k < 2 ? '#ff60c060' : k < 4 ? '#40f0ff50' : '#ffe06040'; c.fillRect(x + ((hsh >>> 3) % 12), y + 8 + ((hsh >>> 7) % 6) - (depth ? 6 : 0), 3 + ph % 3, 1); }
    }
  }
  drawProps(g: OverclockGame) {
    const c = this.ctx;
    // checkpoints
    g.checks().forEach((ck, i) => { if (!this.frame('parts', i <= g.checkpoint ? 5 : 4, ck.x, ck.y, 12, 23)) { c.fillStyle = i <= g.checkpoint ? '#40ffa0' : '#606080'; c.fillRect(ck.x - 2, ck.y - 20, 4, 20); } });
    // low bike tunnels at the waterline: hazard stripes under the roof, a glow inside, and blinking arrows at the mouth
    for (const it of g.stage.items) {
      if (!it.req.bike) continue;
      const x0 = it.x - 8 - 4 * T, roof = it.y - 16, water = it.y + 16, on = (this.t >> 4) % 2 === 0;
      c.fillStyle = '#40f0ff18'; c.fillRect(x0, roof, 8 * T, water - roof);
      for (let i = 0; i < 8 * T; i += 8) { c.fillStyle = ((i >> 3) + (this.t >> 3)) % 2 ? '#ffd040' : '#201830'; c.fillRect(x0 + i, roof, 8, 3); }
      for (let k = 0; k < 3; k++) { c.globalAlpha = on === (k % 2 === 0) ? 1 : 0.35; c.fillStyle = '#ffd040'; const ax = x0 - 34 + k * 9, ay = roof + 8; c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + 6, ay + 6); c.lineTo(ax, ay + 12); c.lineTo(ax + 2, ay + 6); c.closePath(); c.fill(); }
      c.globalAlpha = 1;
    }
    // capsules: the pod with the upgrade turning inside it
    for (const it of g.stage.items) {
      if (g.taken.has(it.id)) continue;
      const bob = Math.sin(this.t / 10) * 2;
      this.frame('parts', 6, it.x, it.y, 12, 23);
      const k = it.kind;
      const ix = k === 'heart' ? ['icons', 4] : k === 'tank' ? ['icons', 5] : ['parts', ['helmet', 'legs', 'body', 'arm'].indexOf(k)];
      if (!this.icon(ix[0] as string, ix[1] as number, it.x, it.y - 32 + bob)) { c.fillStyle = '#ff60a0'; c.fillRect(it.x - 5, it.y - 36 + bob, 10, 10); }
      if (this.t % 40 < 20) { c.fillStyle = '#ffffff'; c.fillRect(it.x + 6, it.y - 40 + bob, 1, 1); }
    }
    // parked hover-bikes
    g.bike.forEach((bk, i) => { if (g.riding !== i) { if (!this.frame('props', 6, bk.x, bk.y + 4, 24, 47)) { c.fillStyle = '#ff6060'; c.fillRect(bk.x - 14, bk.y - 10, 28, 8); } } });
    // the refight gallery's teleporters
    const gal = g.stage.gallery;
    if (gal) {
      for (const p of gal.pads) {
        const done = g.galleryDone.includes(p.boss);
        this.frame('parts', 7, p.x, p.y, 12, 23, false, 1, done ? 0.4 : 1);
        if (!done) this.icon('cores', CORE_BOSSES.indexOf(p.boss), p.x, p.y - 30 + Math.sin((this.t + p.x) / 12) * 2);
      }
      const open = g.galleryDone.length >= 8;
      this.frame('parts', 7, gal.final.x, gal.final.y, 12, 23, false, 1.5, open ? 1 : 0.35);
      if (open && this.t % 20 < 10) { c.fillStyle = '#ffffff'; c.fillRect(gal.final.x - 1, gal.final.y - 40, 2, 30); }
    }
  }

  drawPickup(kind: 'bolt' | 'hp' | 'en', x: number, y: number) {
    const i = kind === 'bolt' ? 3 : kind === 'hp' ? 0 : 2;
    if (!this.icon('icons', i, x, y - 4)) { this.ctx.fillStyle = kind === 'bolt' ? '#ffe080' : kind === 'hp' ? '#ff6080' : '#60e0ff'; this.ctx.fillRect(x - 3, y - 7, 6, 6); }
  }

  drawFoe(e: Foe) {
    const c = this.ctx, k = FOE_ORDER.indexOf(e.kind), fr = foeFrame(e);
    if (e.hidden) { c.fillStyle = '#ffffff40'; c.fillRect(Math.round(e.x) - 6, Math.round(e.y) - 1, 12, 2); return; }
    const m = ART.foes;
    const blink = e.flash > 0 && e.flash % 4 < 2;
    const mm = e.big ? ART[`mini-${e.kind}`] : undefined;
    const ok = mm ? this.frame(`mini-${e.kind}`, miniFrame(e), e.x, e.y, mm[0] / 2, mm[3], e.face > 0) : m && this.frame('foes', k * 4 + fr, e.x, e.y, m[0] / 2, m[1] / 2, e.face > 0, e.big ? 2 : 1, 1);
    if (!ok) { const r = foeBox(e); c.fillStyle = '#c04080'; c.fillRect(r.x, r.y, r.w, r.h); }
    if (blink && ok) {
      c.globalCompositeOperation = 'lighter';
      if (mm) this.frame(`mini-${e.kind}`, miniFrame(e), e.x, e.y, mm[0] / 2, mm[3], e.face > 0, 1, 0.6);
      else this.frame('foes', k * 4 + fr, e.x, e.y, m[0] / 2, m[1] / 2, e.face > 0, e.big ? 2 : 1, 0.6);
      c.globalCompositeOperation = 'source-over';
    }
    if (e.frozen > 0) { const r = foeBox(e); c.strokeStyle = '#c0f0ff'; c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1); }
    if (e.shield && e.kind === 'riot') { c.fillStyle = '#80c0ff80'; c.fillRect(e.x + (e.face > 0 ? 8 : -12), e.y - 12, 4, 24); }
    // a mini-boss's health bar sits under it (never over a face)
    if (e.mini) { const w = 30, by = (() => { const r = foeBox(e); return r.y + r.h + 4; })(); c.fillStyle = '#000000a0'; c.fillRect(e.x - w / 2, by, w, 3); c.fillStyle = '#ff6080'; c.fillRect(e.x - w / 2, by, (w * Math.max(0, e.hp)) / e.max, 3); }
    void FOES;
  }

  drawBoss(g: OverclockGame, bs: Boss) {
    const c = this.ctx, info = BOSSES[bs.id], floor = (bs.arena.r1 + 1) * T, L = (bs.arena.c0 + 1) * T, R = bs.arena.c1 * T;
    // tells first, under the boss: marked spots and aim lines
    if (bs.st === 'tell' || bs.st === 'act') {
      for (const x of bs.marks) {
        const on = (this.t >> 2) % 2;
        c.fillStyle = on ? '#ff4060' : '#ffd040'; c.fillRect(x - 8, floor - 2, 16, 2);
        c.globalAlpha = 0.18; c.fillRect(x - 6, bs.arena.r0 * T, 12, floor - bs.arena.r0 * T); c.globalAlpha = 1;
      }
      if (bs.st === 'tell' && bs.atk === 'beam' && bs.id !== 'lumen') { c.strokeStyle = (this.t >> 1) % 2 ? '#ff60ff' : '#ffffff'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(bs.x, bs.y - 30); c.lineTo(bs.tx, bs.ty); c.stroke(); c.setLineDash([]); }
      if (bs.id === 'lumen' && bs.atk === 'beam' && bs.st === 'act' && bs.t < 40) { c.fillStyle = bs.t < 6 ? '#ffffff60' : '#80f0ff'; c.fillRect(L, bs.ty - (bs.t < 6 ? 1 : 6), bs.x - L - 30, bs.t < 6 ? 2 : 12); }
      if (bs.atk === 'beam' && bs.st === 'act' && bs.id !== 'lumen' && bs.t >= 6 && bs.t < 30) { c.strokeStyle = '#ff80ff'; c.lineWidth = 6; c.beginPath(); c.moveTo(bs.x, bs.y - 30); const dx = bs.tx - bs.x, dy = bs.ty - (bs.y - 30), d = Math.hypot(dx, dy) || 1; c.lineTo(bs.x + (dx / d) * 420, bs.y - 30 + (dy / d) * 420); c.stroke(); c.lineWidth = 1; }
      if (bs.atk === 'tongue' && bs.st === 'act') { c.fillStyle = '#ff60a0'; c.fillRect(bs.face > 0 ? bs.x + 20 : bs.x - 20 - bs.tx, bs.y - 22, bs.tx, 6); }
      if (bs.atk === 'sweep' && bs.st === 'act') { c.fillStyle = '#80f0ff'; c.fillRect(Math.min(bs.tx, R) - 2, bs.arena.r0 * T, 4, floor - bs.arena.r0 * T); }
    }
    if (bs.hidden) {
      if (bs.id === 'mole') { c.fillStyle = '#80604080'; c.fillRect(bs.x - 10, floor - 3, 20, 3); }
      else if (this.t % 6 < 2) { c.globalAlpha = 0.15; this.frame(`boss-${bs.id}`, 0, bs.x, bs.y, ART[`boss-${bs.id}`]?.[0] / 2, ART[`boss-${bs.id}`]?.[3] ?? 0, bs.face > 0, 1, 0.12); c.globalAlpha = 1; }
      return;
    }
    if (bs.id === 'serpent') { for (let i = bs.segs.length - 1; i >= 1; i--) { const s = bs.segs[i]; c.fillStyle = i % 2 ? '#3c4870' : '#ff40a0'; c.beginPath(); c.arc(s.x, s.y, Math.max(2, 8 - i * 0.4), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#140e22'; c.stroke(); } }
    const key = bs.id === 'lumen' ? (bs.form === 2 ? 'lumen-b' : 'lumen-a') : bs.id === 'sentinel' && !ART['boss-sentinel'] ? '' : bs.id;
    const fr = bossFrame(bs, g.tick);
    let ok = false;
    if (key) { const m = ART[`boss-${key}`]; if (m) ok = this.frame(`boss-${key}`, fr, bs.x, bs.y, m[0] / 2, m[3], bs.face > 0); }
    else ok = this.frame('foes', FOE_ORDER.indexOf('sentry') * 4 + Math.min(3, fr % 4), bs.x, bs.y - 32, ART.foes[0] / 2, ART.foes[1] / 2, bs.face > 0, 2.4);
    if (!ok) { c.fillStyle = '#e04070'; c.fillRect(bs.x - info.w / 2, bs.y - info.h, info.w, info.h); }
    // a hit flash: the sprite itself lights up (drawn again, added on top), not a box
    if (bs.flash > 0 && bs.flash % 4 < 2 && bs.st !== 'calm') {
      c.globalCompositeOperation = 'lighter';
      const m = key ? ART[`boss-${key}`] : null;
      if (m) this.frame(`boss-${key}`, fr, bs.x, bs.y, m[0] / 2, m[3], bs.face > 0, 1, 0.6);
      else this.frame('foes', FOE_ORDER.indexOf('sentry') * 4 + Math.min(3, fr % 4), bs.x, bs.y - 32, ART.foes[0] / 2, ART.foes[1] / 2, bs.face > 0, 2.4, 0.6);
      c.globalCompositeOperation = 'source-over';
    }
    if (bs.st === 'tell' && this.t % 8 < 4) { const r = bossBox(bs, g.tick); c.strokeStyle = '#ffe040'; c.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3); }
    if (bs.st === 'calm' && this.t % 8 === 0) this.part(bs.x + (Math.random() - 0.5) * 40, bs.y - Math.random() * info.h, 0, -0.6, 40, '#80ffe0', 1, 0);
    void POWER;
  }

  drawHero(p: HeroPose, alpha: number, lead: boolean) {
    const c = this.ctx, m = ART[p.id];
    if (lead && p.inv > 0 && p.inv % 6 < 3 && p.st !== 'hurt') return;
    const a = p.ghost ? 0.45 : alpha;
    const fr = heroFrame(p);
    // the charge glow, under the hero, in the level's colour
    if (lead && p.charge > 0) { const col = CHARGE_COL[p.charge]; c.globalAlpha = 0.35 + 0.25 * Math.sin(this.t / 2); c.fillStyle = col; c.beginPath(); c.ellipse(p.x, p.y - 16, 14 + p.charge * 2, 20 + p.charge * 2, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; if (this.t % 3 === 0) this.part(p.x + (Math.random() - 0.5) * 24, p.y - Math.random() * 30, 0, -0.8, 14, col, 1, 0); }
    // until the hover-bike poses are painted, the rider sits on the parked-bike prop
    const onBike = p.st === 'bike' || p.st === 'bikeup';
    if (onBike && !PAINTED[p.id]?.includes('c')) this.frame('props', 6, p.x, p.y + 6, 24, 47, p.face < 0, 1, a);
    if (onBike && lead && this.t % 2 === 0) { for (let i = 0; i < 2; i++) this.part(p.x - 16 - Math.random() * 6, p.y + 2, -1.2 - Math.random() * 1.4, -1 - Math.random() * 1.6, 16, Math.random() < 0.5 ? '#d8fbff' : '#8fd8ff', 1, 0.15); }
    if (!m || !this.frame(p.id, fr, p.x, p.y - (onBike && !PAINTED[p.id]?.includes('c') ? 8 : 0), m[0] / 2, m[1] - 2, p.face < 0, 1, a)) {
      c.globalAlpha = a; c.fillStyle = p.id === 'dora' ? '#ff7060' : '#707888'; c.fillRect(p.x - 6, p.y - 28, 12, 28); c.globalAlpha = 1;
    }
    if (lead && p.st === 'hurt') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.fillStyle = '#ffffff'; c.fillRect(p.x - 10, p.y - 40, 20, 40); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; }
    // Enzo's shield: a hex of light ahead of him
    if (p.st === 'shield') { c.globalAlpha = 0.6; c.fillStyle = '#a0ff60'; c.fillRect(p.x + p.face * 14 - 2, p.y - 36, 4, 34); c.globalAlpha = 0.25; c.fillRect(p.x + p.face * 14 - 6, p.y - 36, 12, 34); c.globalAlpha = 1; }
    // a muzzle flash for a moment after each shot
    if (lead && p.shoot > 4 && p.st !== 'shield') { const mx = p.x + p.face * (p.id === 'enzo' ? 18 : 16), my = p.y - (p.id === 'enzo' ? 26 : 18); c.fillStyle = '#ffffff'; c.fillRect(mx - 2, my - 2, 4, 4); c.fillStyle = p.id === 'enzo' ? '#a0ff60' : '#60f0ff'; c.fillRect(mx - 3 + p.face * 2, my - 1, 3, 2); }
  }

  drawShot(s: Shot) {
    const c = this.ctx, col = SHOT_COL[s.kind] ?? '#ffffff', x = Math.round(s.x), y = Math.round(s.y);
    c.fillStyle = col;
    switch (s.kind) {
      case 'pellet': c.fillRect(x - 3, y - 2, 6, 4); c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 1, 3, 2); break;
      case 'c1': case 'c2': case 'c3': { const r = s.kind === 'c1' ? 4 : s.kind === 'c2' ? 7 : 10; c.globalAlpha = 0.5; c.beginPath(); c.arc(x, y, r + 2, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r / 2, 0, Math.PI * 2); c.fill(); if (this.t % 2 === 0) this.part(x - Math.sign(s.vx) * r, y + (Math.random() - 0.5) * r, -s.vx * 0.2, 0, 10, col, 1, 0); break; }
      case 'beam': c.globalAlpha = Math.min(1, s.life / 10); c.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h); c.fillStyle = '#ffffff'; c.fillRect(s.x - s.w / 6, s.y - s.h / 2, s.w / 3, s.h); c.globalAlpha = 1; break;
      case 'wave': c.fillRect(x - s.w / 2, y - s.h / 2, s.w, s.h); c.fillStyle = '#ffffff'; c.fillRect(x - 2, y - s.h / 2, 4, s.h); break;
      case 'ring': case 'blob': case 'glob': case 'fly': case 'light': c.beginPath(); c.arc(x, y, s.w / 2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 1, 2, 2); break;
      case 'mine': c.fillRect(x - 4, y - 3, 8, 6); if (this.t % 20 < 10) { c.fillStyle = '#ff2020'; c.fillRect(x - 1, y - 4, 2, 2); } break;
      case 'spark': c.fillRect(x - 3, y - 3, 6, 6); c.fillStyle = '#ffffff'; c.fillRect(x - 1, y - 4, 2, 8); break;
      case 'prism': c.save(); c.translate(x, y); c.rotate(this.t / 6); c.fillRect(-4, -4, 8, 8); c.restore(); break;
      default: c.fillRect(x - s.w / 2, y - s.h / 2, s.w, s.h); c.fillStyle = '#14102280'; c.fillRect(x - s.w / 2, y + s.h / 2 - 1, s.w, 1);
    }
  }

  drawEffect(g: OverclockGame, e: { kind: string; x: number; y: number; t: number; life: number; hp: number }) {
    const c = this.ctx;
    if (e.kind === 'plate') { if (!this.frame('props', 4, e.x, e.y + 8, 24, 30)) { c.fillStyle = '#c04040'; c.fillRect(e.x - 16, e.y, 32, 6); } }
    else if (e.kind === 'decoy') { const p: HeroPose = { ...g.pose, x: e.x, y: e.y, st: 'idle', shoot: 0, charge: 0, inv: 0, id: 'dora' }; c.globalAlpha = 0.55 + 0.2 * Math.sin(this.t / 3); this.drawHero(p, 0.6, false); c.globalAlpha = 1; }
    else if (e.kind === 'cloud') { c.fillStyle = '#5a6a90'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(e.x - 16 + i * 8, e.y + Math.sin((this.t + i * 20) / 10) * 2, 9, 0, Math.PI * 2); c.fill(); } if (this.t % 10 < 3) { c.fillStyle = '#ffff80'; c.fillRect(e.x - 1, e.y + 8, 2, 8); } }
    else if (e.kind === 'strike') { const live = e.t > 40; c.fillStyle = live ? '#e0a0ff' : (this.t >> 2) % 2 ? '#c070ff' : '#ffffff'; if (live) { c.globalAlpha = 0.8; c.fillRect(e.x - 8, e.y - 220, 16, 220); c.globalAlpha = 1; } else c.fillRect(e.x - 8, e.y - 2, 16, 2); }
    else if (e.kind === 'zap') { const tx = Math.floor(e.hp / 10000), ty = e.hp % 10000; c.strokeStyle = '#ffff80'; c.beginPath(); c.moveTo(e.x, e.y); const mx = (e.x + tx) / 2 + (Math.random() - 0.5) * 12, my = (e.y + ty) / 2 + (Math.random() - 0.5) * 12; c.lineTo(mx, my); c.lineTo(tx, ty); c.stroke(); }
  }

  drawRain(cx: number) {
    const c = this.ctx;
    c.strokeStyle = '#a0c8ff60';
    c.beginPath();
    for (let i = 0; i < 70; i++) { const x = ((i * 53 + this.t * 3 - cx * 0.6) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20, y = (i * 97 + this.t * 7) % VIEW_H; c.moveTo(x, y); c.lineTo(x - 2, y + 7); }
    c.stroke();
  }
  drawDark(g: OverclockGame, cx: number, cy: number) {
    // the power plant is dark: a pool of light around the lead (and a dim one round the partner)
    const c = this.ctx, x = g.body.x - cx, y = g.body.y - 18 - cy;
    const grd = c.createRadialGradient(x, y, 30, x, y, 120);
    grd.addColorStop(0, 'rgba(4,6,16,0)'); grd.addColorStop(1, 'rgba(4,6,16,0.82)');
    c.fillStyle = grd; c.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  /** the intro's prompts: a key glyph and a little picture of the move, low on the screen, never over a face */
  drawPrompts(g: OverclockGame, cx: number) {
    const p = g.stage.prompts.find((q) => g.body.x >= q.x0 && g.body.x < q.x1);
    if (!p || g.mode !== 'play') return;
    const c = this.ctx, key = this.touch ? ({ move: '◀ ▶', jump: 'A', shoot: 'B', dash: 'D', climb: '▲', tag: '⇄', charge: 'B' } as Record<string, string>)[p.action] : this.keys[p.action];
    const word: Record<string, string> = { move: 'MOVE', jump: 'JUMP', shoot: 'SHOOT', dash: 'DASH', climb: 'CLIMB', tag: 'TAG', charge: 'CHARGE' };
    const text = `${key}  ${word[p.action] ?? ''}`;
    c.font = '8px monospace';
    const w = Math.ceil(c.measureText(text).width) + 12, x = Math.round(VIEW_W / 2 - w / 2), y = VIEW_H - 18;
    const bx = g.body.x - cx;
    // keep clear of the hero: move to the side they aren't on
    const px = Math.abs(bx - VIEW_W / 2) < w ? (bx < VIEW_W / 2 ? VIEW_W - w - 8 : 8) : x;
    c.fillStyle = '#0a0820d0'; c.fillRect(px, y, w, 13);
    c.strokeStyle = this.t % 40 < 20 ? '#40e8ff' : '#ff60c0'; c.strokeRect(px + 0.5, y + 0.5, w - 1, 12);
    c.fillStyle = '#ffffff'; c.fillText(text, px + 6, y + 9);
    void cx;
  }

  drawDebug(g: OverclockGame) {
    const c = this.ctx, box = (r: { x: number; y: number; w: number; h: number }, col: string) => { c.strokeStyle = col; c.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, Math.round(r.w) - 1, Math.round(r.h) - 1); };
    box(g.heroRect(), '#00ff00'); box(g.bodyRect(), '#00ff0060');
    for (const e of g.foes) if (e.alive && !e.hidden) box(foeBox(e), '#ff0040');
    if (g.boss && !g.boss.hidden) box(bossBox(g.boss, g.tick), '#ff8000');
    for (const s of g.shots) box({ x: s.x - s.w / 2, y: s.y - s.h / 2, w: s.w, h: s.h }, s.friendly ? '#00ffff' : '#ffff00');
    c.fillStyle = '#ffffff'; c.font = '7px monospace'; c.fillText(`${Math.round(g.body.x)},${Math.round(g.body.y)} ${g.pose.st}`, g.body.x - 20, g.body.y + 10);
  }
}
