// Tambak: the renderer. Canvas 2D at a fixed 1536 x 864 design size, scaled to the canvas. The sea is a sand
// artist's lightbox (a Codex painting of pale sand ripples on glowing glass), and claimed land shows the site's
// Codex sand painting through a mask with crumbly sand edges, so each place appears piece by piece as you pour it.
// Trails are lines of coloured sand with a finger-drawn groove; creatures, heroes and pickups are Codex sand sprites.
// Drawing only: the rules are in lib/tambak-game.ts.
import { W, H, N, LAND, TRAIL0, SITES, FOES, type TambakGame, type Ev, type Hero, type Foe, type PickKind } from './tambak-game';
import { TAMBAK_ATLAS, TAMBAK_IMG, type FrameBox } from './tambak-art';

const HINT_FOR = 15;
export const VW = 1536, VH = 864, HUD = 64, CELL = 16, FW = W * CELL, FH = H * CELL;
const INK = '#f6ead0', INK2 = '#e6d5b0', WOOD = '#2a1c13';
/** each hero pours a different sand: Dora terracotta, Enzo ochre */
const SAND = [{ base: [205, 92, 46], dark: [120, 44, 20] }, { base: [196, 160, 40], dark: [104, 80, 16] }];

interface Float { x: number; y: number; text: string; t: number; color: string }
interface Fx { x: number; y: number; t: number; dur: number; frame: string; size: number; rot: number }
interface Grain { x: number; y: number; vx: number; vy: number; t: number; c: string }

export class TambakScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  img: Record<string, HTMLImageElement> = {};
  ready = false; demo = false; hitStop = 0; time = 0;
  /** the key hint along an edge of the field; setting it shows it afresh for HINT_FOR seconds of play */
  private hintText = ''; private hintAge = 0;
  get hint() { return this.hintText; }
  set hint(v: string) { if (v !== this.hintText) this.hintAge = 0; this.hintText = v; }
  private pic = ''; private picData: ImageData | null = null;
  private land: HTMLCanvasElement; private landCtx: CanvasRenderingContext2D;
  private small: HTMLCanvasElement; private smallCtx: CanvasRenderingContext2D;
  private big: HTMLCanvasElement; private bigCtx: CanvasRenderingContext2D;
  private noise = new Float32Array(FW * FH);
  private seen = new Uint8Array(N); private revAt = new Float32Array(N);
  private animUntil = 0; private dirty = true; private box = [0, 0, W, H];
  private tiles: HTMLCanvasElement[][] = [];
  private floats: Float[] = []; private fx: Fx[] = []; private grains: Grain[] = [];
  private banner: { title: string; sub: string; t: number; dur: number } | null = null;
  private shake = 0; private disp = new Map<number, { x: number; y: number }>();

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv; this.ctx = cv.getContext('2d')!;
    const mk = (w: number, h: number, rf = false) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: rf })!] as const; };
    [this.land, this.landCtx] = mk(FW, FH, true);
    [this.small, this.smallCtx] = mk(W, H);
    [this.big, this.bigCtx] = mk(FW, FH, true);
    // fixed grain noise for the crumbly edge of the land: a threshold per pixel, clumped a little like sand
    let s = 12345; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < this.noise.length; i++) this.noise[i] = 0.3 + 0.4 * rnd();
    for (let pass = 0; pass < 1; pass++) for (let i = FW + 1; i < this.noise.length - FW - 1; i++) this.noise[i] = (this.noise[i] * 2 + this.noise[i - 1] + this.noise[i + FW]) / 4;
    for (let k = 0; k < 2; k++) { const row: HTMLCanvasElement[] = []; for (let v = 0; v < 4; v++) row.push(this.grainTile(k, v)); this.tiles.push(row); }
  }

  async load(): Promise<void> {
    const ids = ['dora', 'enzo', 'foes', 'boss', 'items', 'sea', ...SITES.map((s) => s.pic)];
    await Promise.all(ids.map((id) => new Promise<void>((res) => { const im = new Image(); im.onload = () => res(); im.onerror = () => res(); im.src = TAMBAK_IMG(id); this.img[id] = im; })));
    this.ready = true;
  }

  /** a 20 px tile of poured sand in one hero's colour, grains jittered so neighbouring cells don't repeat */
  private grainTile(k: number, v: number) {
    const c = document.createElement('canvas'); c.width = 20; c.height = 20; const x = c.getContext('2d')!;
    let s = 99 + k * 31 + v * 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const { base, dark } = SAND[k];
    for (let i = 0; i < 150; i++) {
      const px = 2 + rnd() * 16, py = 2 + rnd() * 16, m = rnd();
      const col = m < 0.18 ? dark : m < 0.3 ? [250, 236, 200] : base.map((q) => Math.min(255, q + (rnd() - 0.5) * 40));
      x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      x.fillRect(px, py, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
    }
    return c;
  }

  /** a new game: forget the land, the effects and the displayed positions */
  reset() {
    this.seen.fill(0); this.revAt.fill(0); this.dirty = true; this.box = [0, 0, W, H];
    this.floats = []; this.fx = []; this.grains = []; this.banner = null; this.shake = 0; this.hitStop = 0; this.disp.clear();
    this.landCtx.clearRect(0, 0, FW, FH); this.hintAge = 0;
  }

  say(title: string, sub: string, dur = 2.2) { this.banner = { title, sub, t: 0, dur }; }

  /** the site's painting, cropped to the field, read once into pixels for the land mask */
  private usePic(name: string) {
    if (this.pic === name) return;
    this.pic = name; const im = this.img[name];
    const c = document.createElement('canvas'); c.width = FW; c.height = FH; const x = c.getContext('2d')!;
    if (im?.naturalWidth) { const sw = im.naturalWidth, sh = im.naturalHeight, ch = sw * FH / FW; x.drawImage(im, 0, (sh - ch) / 2, sw, ch, 0, 0, FW, FH); }
    else { x.fillStyle = '#c9a36a'; x.fillRect(0, 0, FW, FH); }
    this.picData = x.getImageData(0, 0, FW, FH);
    this.seen.fill(0); this.dirty = true; this.box = [0, 0, W, H]; this.landCtx.clearRect(0, 0, FW, FH);
  }

  // ─────────────────────────────── events
  ingest(evs: Ev[], g: TambakGame) {
    for (const e of evs) {
      switch (e.k) {
        case 'claim': {
          // sand pours outward from the trail: each claimed cell appears a moment after its neighbour nearer the trail
          const set = new Set(e.cells), depth = new Map<number, number>(), q: number[] = [];
          for (const c of e.cells.slice(0, e.trail)) { depth.set(c, 0); q.push(c); }
          for (let i = 0; i < q.length; i++) { const c = q[i], x = c % W; for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) if (set.has(n) && !depth.has(n)) { depth.set(n, depth.get(c)! + 1); q.push(n); } }
          const maxD = Math.max(1, ...depth.values());
          const span = Math.min(0.9, 0.15 + e.cells.length / 2500);
          for (const c of e.cells) { this.seen[c] = 1; this.revAt[c] = this.time + ((depth.get(c) ?? maxD) / maxD) * span; this.grow(c); }
          this.animUntil = Math.max(this.animUntil, this.time + span + 0.3);
          // a few sand bursts and the score
          let sx = 0, sy = 0; for (const c of e.cells) { sx += c % W; sy += (c / W) | 0; }
          const cx = (sx / e.cells.length + 0.5) * CELL, cy = (sy / e.cells.length + 0.5) * CELL + HUD;
          for (let i = 0; i < Math.min(5, 1 + (e.cells.length / 120) | 0); i++) { const c = e.cells[(i * 7919) % e.cells.length]; this.fx.push({ x: (c % W + 0.5) * CELL, y: (((c / W) | 0) + 0.5) * CELL + HUD, t: -i * 0.07, dur: 0.6, frame: 'burst', size: 70 + Math.min(80, e.cells.length / 20), rot: i }); }
          const pts = e.cells.length * 10 + (e.cells.length > 150 ? (e.cells.length - 150) * 5 : 0);
          this.float(cx, cy, `+${pts}`, e.cells.length > 300 ? '#ffe28a' : INK);
          break;
        }
        case 'pour': { const x = (e.cell % W + 0.5) * CELL, y = (((e.cell / W) | 0) + 0.5) * CELL + HUD; for (let i = 0; i < 3; i++) this.grain(x, y, e.hero); break; }
        case 'hurt': {
          const step = Math.max(1, Math.floor(e.cells.length / 6));
          for (let i = 0; i < e.cells.length; i += step) { const c = e.cells[i]; this.fx.push({ x: (c % W + 0.5) * CELL, y: (((c / W) | 0) + 0.5) * CELL + HUD, t: -i * 0.01, dur: 0.75, frame: 'splash', size: 64, rot: 0 }); }
          this.fx.push({ x: (e.x + 0.5) * CELL, y: (e.y + 0.5) * CELL + HUD, t: 0, dur: 0.8, frame: 'splash', size: 96, rot: 0 });
          this.shake = 0.3; this.hitStop = 0.08;
          const who = g.heroes[e.hero]?.id === 'enzo' ? 'Enzo' : 'Dora';
          const by = { jelly: 'a jellyfish', croc: 'a crocodile', puffer: 'a pufferfish', crab: 'the horseshoe crab', boss: 'Captain Bakau' }[e.foe];
          if (!this.demo) this.say('Splash!', `${by} washed ${who}’s sand away. One bucket gone.`, 1.8);
          break;
        }
        case 'pick': { const x = (e.cell % W + 0.5) * CELL, y = (((e.cell / W) | 0) + 0.5) * CELL + HUD; this.float(x, y - 20, { kopi: 'Kopi! Faster feet', net: 'Net! Creatures slowed', bucket: 'A spare bucket' }[e.kind], '#ffe28a'); break; }
        case 'crab': if (!this.demo) this.say('A horseshoe crab climbs out', 'It wanders your new land. Keep out of its way.', 2.4); break;
        case 'tide': if (!this.demo) this.say(e.left > 10 ? 'The tide is turning' : 'Ten seconds of tide!', `${e.left} seconds left to claim ${g.target}%`, 1.8); break;
        case 'join': if (!this.demo) this.say('Player 2 joins!', `${g.heroes[1].id === 'enzo' ? 'Enzo' : 'Dora'} walks the arrows, on the top shore`, 2.4); break;
        case 'win': if (!this.demo) this.say(`${SITES[g.site].name} is land!`, `${Math.round(g.pct)}% of the sea poured`, 2.6); break;
        case 'lose': if (!this.demo) this.say(e.why === 'tide' ? 'The tide came in' : 'Out of sand buckets', e.why === 'tide' ? `${Math.round(g.pct)}% poured of ${g.target}%` : 'The creatures washed it all away', 2.6); break;
      }
    }
  }
  private grow(c: number) { const x = c % W, y = (c / W) | 0, b = this.box; if (!this.dirty) { this.box = [x, y, x + 1, y + 1]; this.dirty = true; return; } b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x + 1); b[3] = Math.max(b[3], y + 1); }
  private grain(x: number, y: number, k: number) {
    const c = SAND[k % 2].base; this.grains.push({ x: x + (Math.random() - 0.5) * 6, y: y - 14 - Math.random() * 10, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, t: 0.35 + Math.random() * 0.2, c: `rgb(${c[0]},${c[1]},${c[2]})` });
  }
  private float(x: number, y: number, text: string, color: string) {
    // never stack two numbers on the same spot: lift the new one above any recent neighbour
    for (const f of this.floats) if (f.t < 0.6 && Math.abs(f.x - x) < 120 && Math.abs(f.y - y) < 30) y = f.y - 32;
    this.floats.push({ x, y, text, t: 0, color });
  }

  // ─────────────────────────────── the land
  /** rebuild the revealed painting inside the changed box: smooth the cell mask up to pixels, then cut it against
   *  the grain noise so the edge crumbles like poured sand, with a darker damp-sand rim */
  private buildLand() {
    const now = this.time;
    const sd = this.smallCtx.createImageData(W, H);
    let anim = false;
    for (let i = 0; i < N; i++) {
      if (!this.seen[i]) continue;
      const v = Math.max(0, Math.min(1, (now - this.revAt[i]) / 0.22));
      if (v < 1) anim = true;
      sd.data[i * 4 + 3] = v * 255;
    }
    this.smallCtx.putImageData(sd, 0, 0);
    const bc = this.bigCtx; bc.clearRect(0, 0, FW, FH); bc.imageSmoothingEnabled = true; bc.imageSmoothingQuality = 'high';
    bc.drawImage(this.small, 0, 0, FW, FH);
    const [bx0, by0, bx1, by1] = this.box;
    const x0 = Math.max(0, (bx0 - 2) * CELL), y0 = Math.max(0, (by0 - 2) * CELL), x1 = Math.min(FW, (bx1 + 2) * CELL), y1 = Math.min(FH, (by1 + 2) * CELL);
    const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return anim;
    const m = bc.getImageData(x0, y0, w, h).data, out = this.landCtx.createImageData(w, h), o = out.data, p = this.picData!.data;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const k = (yy * w + xx) * 4, gp = (y0 + yy) * FW + x0 + xx, pp = gp * 4;
      const a = m[k + 3] / 255, n = this.noise[gp];
      if (a > n) { o[k] = p[pp]; o[k + 1] = p[pp + 1]; o[k + 2] = p[pp + 2]; o[k + 3] = 255; }
      else if (a > n - 0.1) { o[k] = p[pp] * 0.42 + 40; o[k + 1] = p[pp + 1] * 0.36 + 26; o[k + 2] = p[pp + 2] * 0.3 + 14; o[k + 3] = 235; }
    }
    this.landCtx.putImageData(out, x0, y0);
    return anim;
  }

  // ─────────────────────────────── frames
  private frame(sheet: string, name: string): FrameBox { return TAMBAK_ATLAS[sheet].f[name]; }
  /** draw a frame scaled to height hpx with its foot point at (x, y) */
  private sprite(sheet: string, name: string, x: number, y: number, hpx: number, flip = false, alpha = 1) {
    const im = this.img[sheet], b = this.frame(sheet, name); if (!im?.naturalWidth || !b) return;
    const ref = this.frame(sheet, sheet === 'dora' || sheet === 'enzo' ? 'idle' : name), s = hpx / ref[3];
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(im, b[0], b[1], b[2], b[3], (b[0] - b[4]) * s, (b[1] - b[5]) * s, b[2] * s, b[3] * s);
    ctx.restore();
  }
  /** draw a frame centred at (x, y), its longer side `size` px, turned by rot */
  private centred(sheet: string, name: string, x: number, y: number, size: number, rot = 0, alpha = 1) {
    const im = this.img[sheet], b = this.frame(sheet, name); if (!im?.naturalWidth || !b) return;
    const s = size / Math.max(b[2], b[3]), ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(im, b[0], b[1], b[2], b[3], -b[2] * s / 2, -b[3] * s / 2, b[2] * s, b[3] * s);
    ctx.restore();
  }

  // ─────────────────────────────── draw
  draw(g: TambakGame, dt: number) {
    if (!this.ready) return;
    this.time += dt;
    this.usePic(g.cfg.pic);
    const ctx = this.ctx, s = this.cv.width / VW;
    // any land the events did not announce (the starting rim) appears at once
    for (let i = 0; i < N; i++) if (g.grid[i] === LAND && !this.seen[i]) { this.seen[i] = 1; this.revAt[i] = -9; this.grow(i); }
    if (this.dirty || this.time < this.animUntil) { if (!this.buildLand() && this.time >= this.animUntil) this.dirty = false; }

    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = true;
    let ox = 0, oy = 0;
    if (this.shake > 0) { this.shake -= dt; ox = (Math.random() - 0.5) * 10 * this.shake / 0.3; oy = (Math.random() - 0.5) * 8 * this.shake / 0.3; }
    // the lightbox: sand ripples on glowing glass, the light breathing slowly
    const sea = this.img.sea;
    ctx.fillStyle = '#efe6c8'; ctx.fillRect(0, HUD, VW, FH);
    if (sea?.naturalWidth) ctx.drawImage(sea, 0, (sea.naturalHeight - sea.naturalWidth * FH / FW) / 2, sea.naturalWidth, sea.naturalWidth * FH / FW, ox, HUD + oy, FW, FH);
    const glow = ctx.createRadialGradient(VW / 2 + Math.sin(this.time * 0.3) * 200, HUD + FH / 2, 60, VW / 2, HUD + FH / 2, 900);
    glow.addColorStop(0, `rgba(255,250,225,${0.22 + 0.06 * Math.sin(this.time * 0.8)})`); glow.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, HUD, VW, FH);
    ctx.drawImage(this.land, ox, HUD + oy);

    ctx.save(); ctx.translate(ox, oy);
    this.drawTrails(g);
    this.drawPicks(g);
    for (const f of g.foes) this.drawFoe(g, f);
    ctx.restore();
    // the HUD goes down before the chinchillas, so one standing on the top shore is drawn over it, not hidden under it
    if (!this.demo) this.drawHud(g);
    ctx.save(); ctx.translate(ox, oy);
    for (const h of g.heroes) this.drawHero(g, h, dt);
    this.drawFx(dt);
    ctx.restore();

    if (!this.demo) { this.drawBanner(dt); if (this.hint) this.drawHint(g, dt); }
  }

  private drawTrails(g: TambakGame) {
    const ctx = this.ctx;
    for (const h of g.heroes) {
      if (!h.trail.length) continue;
      const k = h.id === 'enzo' ? 1 : 0;
      for (const c of h.trail) { const x = c % W, y = (c / W) | 0; ctx.drawImage(this.tiles[k][(x * 7 + y * 3) & 3], x * CELL - 2, HUD + y * CELL - 2); }
      // the groove a fingertip leaves along the middle of the poured line
      const d = SAND[k].dark; ctx.strokeStyle = `rgba(${d[0]},${d[1]},${d[2]},0.75)`; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const st = h.start; ctx.moveTo((st % W + 0.5) * CELL, HUD + (((st / W) | 0) + 0.5) * CELL);
      for (const c of h.trail) ctx.lineTo((c % W + 0.5) * CELL, HUD + (((c / W) | 0) + 0.5) * CELL);
      ctx.stroke();
    }
  }

  private drawPicks(g: TambakGame) {
    for (const p of g.picks) {
      const x = (p.cell % W + 0.5) * CELL, y = (((p.cell / W) | 0) + 0.5) * CELL + HUD + Math.sin(this.time * 3 + p.id) * 3;
      if (p.t < 4 && Math.floor(this.time * 6) % 2) continue;
      const ctx = this.ctx; ctx.save(); ctx.strokeStyle = 'rgba(160,110,40,0.55)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      this.centred('items', p.kind, x, y, 38, Math.sin(this.time * 2 + p.id) * 0.12);
    }
  }

  private drawFoe(g: TambakGame, f: Foe) {
    const x = f.x * CELL, y = f.y * CELL + HUD, ctx = this.ctx;
    const ang = Math.atan2(f.vy, f.vx) + Math.PI / 2, tick = Math.floor(this.time * 4 + f.id) % 2;
    ctx.save(); ctx.fillStyle = 'rgba(60,40,20,0.16)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 6, f.r * CELL * 1.3, f.r * CELL, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    switch (f.kind) {
      case 'jelly': this.centred('foes', tick ? 'jellyA' : 'jellyB', x, y, 46 + Math.sin(this.time * 4 + f.id) * 3); break;
      case 'croc': this.centred('foes', f.snap > 0 ? 'crocSnap' : tick ? 'crocA' : 'crocB', x, y, 70, ang); break;
      case 'puffer': this.centred('foes', f.puff < 0.3 ? 'puffS' : f.puff < 0.85 ? 'puffM' : 'puffL', x, y, (f.r * 2 + 0.8) * CELL * 1.15, ang); break;
      case 'crab': {
        // the crab walks the painted land, so it gets the lightbox halo the chinchillas have and a red warning ring
        const halo = ctx.createRadialGradient(x, y, 4, x, y, 34);
        halo.addColorStop(0, 'rgba(255,250,228,0.85)'); halo.addColorStop(0.65, 'rgba(255,250,228,0.5)'); halo.addColorStop(1, 'rgba(255,250,228,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.strokeStyle = 'rgba(176,40,20,0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -this.time * 12;
        ctx.beginPath(); ctx.arc(x, y, 27, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        this.centred('foes', tick ? 'crabA' : 'crabB', x, y, 50, ang); break;
      }
      case 'boss': this.centred('boss', g.netT > 0 ? 'dizzy' : f.snap > 0 || f.puff > 0.6 ? 'lunge' : tick ? 'swimA' : 'swimB', x, y, 104, ang); break;
    }
    if (f.kind === 'puffer' && f.puff > 0 && f.puff < 1) { ctx.save(); ctx.strokeStyle = 'rgba(190,60,30,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, (FOES.puffer.r + 0.9) * CELL, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }

  private drawHero(g: TambakGame, h: Hero, dt: number) {
    // ease the drawn position toward the cell, so a cell-by-cell walk looks smooth; jump after a teleport
    const tx = (h.x + 0.5) * CELL, ty = (h.y + 0.5) * CELL + HUD;
    let d = this.disp.get(h.idx); if (!d || Math.hypot(d.x - tx, d.y - ty) > 3 * CELL) { d = { x: tx, y: ty }; this.disp.set(h.idx, d); }
    const k = Math.min(1, dt * 24); d.x += (tx - d.x) * k; d.y += (ty - d.y) * k;
    const sheet = h.id, t = this.time, step = Math.floor(t * 8) % 2;
    let name = 'idle', flip = false;
    if (g.over === 'win') name = Math.floor(t * 2) % 2 ? 'cheer' : 'wave';
    else if (g.over === 'lose') name = 'sad';
    else if (h.hurtT > 0.6) name = 'hurt';
    else if (h.hurtT > 0) name = 'dizzy';
    else if (h.flagT > 0) name = 'flag';
    else if (h.trail.length) { name = step ? 'pourA' : 'pourB'; flip = h.face === 4; }
    else if (h.moving) {
      if (h.face === 1) name = step ? 'upA' : 'upB';
      else if (h.face === 3) name = step ? 'downA' : 'downB';
      else { name = step ? 'rightA' : 'rightB'; flip = h.face === 4; }
    } else if (t % 3.3 < 0.15) name = 'blink';
    const ctx = this.ctx;
    // the lightbox shining through round the chinchilla, so it reads on the busiest painted land
    ctx.save();
    const halo = ctx.createRadialGradient(d.x, d.y - 20, 6, d.x, d.y - 20, 46);
    halo.addColorStop(0, 'rgba(255,250,228,0.7)'); halo.addColorStop(0.6, 'rgba(255,250,228,0.35)'); halo.addColorStop(1, 'rgba(255,250,228,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(d.x, d.y - 20, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(50,30,15,0.3)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 7, 15, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const alpha = h.blink > 0 && g.over === null ? (Math.floor(t * 12) % 2 ? 0.35 : 1) : 1;
    this.sprite(sheet, name, d.x, Math.min(VH - 1, d.y + 9), 62, flip, alpha);
    // a little marker over each player in two-player, in their sand colour
    if (g.heroes.length > 1) {
      const c = SAND[h.id === 'enzo' ? 1 : 0].base; ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath(); ctx.moveTo(d.x - 7, d.y - 62); ctx.lineTo(d.x + 7, d.y - 62); ctx.lineTo(d.x, d.y - 53); ctx.closePath(); ctx.fill();
    }
  }

  private drawFx(dt: number) {
    const ctx = this.ctx;
    for (const e of this.fx) { e.t += dt; if (e.t < 0) continue; const p = e.t / e.dur; this.centred('foes', e.frame, e.x, e.y, e.size * (0.6 + 0.5 * p), e.rot, Math.max(0, 1 - p * p)); }
    this.fx = this.fx.filter((e) => e.t < e.dur);
    for (const gr of this.grains) { gr.t -= dt; gr.x += gr.vx * dt; gr.y += gr.vy * dt; gr.vy += 200 * dt; ctx.fillStyle = gr.c; ctx.fillRect(gr.x, gr.y, 2.2, 2.2); }
    this.grains = this.grains.filter((g) => g.t > 0);
    ctx.font = '700 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const f of this.floats) {
      f.t += dt; const a = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.5), y = f.y - f.t * 26;
      ctx.globalAlpha = a; ctx.lineWidth = 6; ctx.strokeStyle = WOOD; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1; this.floats = this.floats.filter((f) => f.t < 1.4);
  }

  private drawHud(g: TambakGame) {
    const ctx = this.ctx;
    ctx.fillStyle = WOOD; ctx.fillRect(0, 0, VW, HUD);
    ctx.fillStyle = 'rgba(255,230,180,0.06)'; for (let i = 0; i < 9; i++) ctx.fillRect(0, 6 + i * 7, VW, 1);
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(0, HUD - 3, VW, 3);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = INK; ctx.font = '700 23px Georgia, serif'; ctx.fillText(g.cfg.name, 20, 22);
    ctx.fillStyle = INK2; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillText(g.cfg.place, 20, 46);
    // the land bar: how much of the sea is poured, with the target marked
    const bx = 380, bw = 470, by = 18, bh = 22;
    ctx.fillStyle = '#4a3322'; ctx.fillRect(bx, by, bw, bh);
    const pct = Math.min(100, g.pct), fill = (bw * pct) / 100;
    const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#c9762e'); gr.addColorStop(1, '#e9b54a');
    ctx.fillStyle = gr; ctx.fillRect(bx, by, fill, bh);
    const tx = bx + (bw * g.target) / 100; ctx.fillStyle = INK; ctx.fillRect(tx - 1.5, by - 5, 3, bh + 10);
    ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = INK; ctx.fillText(`Land ${Math.floor(pct)}% · need ${g.target}%`, bx, by + bh + 13);
    // the tide clock
    const tide = Math.max(0, g.tide), low = tide <= 30 && !g.over;
    const mm = `${Math.floor(tide / 60)}:${String(Math.floor(tide % 60)).padStart(2, '0')}`;
    ctx.font = '700 24px Georgia, serif'; ctx.fillStyle = low ? (Math.floor(this.time * 3) % 2 ? '#ffb39a' : INK) : INK;
    ctx.fillText(`Tide ${mm}`, 900, 26);
    ctx.font = '600 14px system-ui, sans-serif'; ctx.fillStyle = INK2; ctx.fillText(low ? 'the tide is turning!' : 'until the tide comes in', 900, 49);
    // buckets
    ctx.fillStyle = INK2; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillText('Buckets', 1100, 49);
    for (let i = 0; i < Math.max(g.buckets, 0); i++) this.centred('items', 'bucket', 1112 + i * 30, 22, 28);
    // powers
    let px = 1280;
    for (const [k, t] of [['kopi', g.kopiT], ['net', g.netT]] as [PickKind, number][]) {
      if (t <= 0) continue;
      this.centred('items', k, px, 24, 30); ctx.fillStyle = INK; ctx.font = '700 14px system-ui, sans-serif'; ctx.fillText(`${Math.ceil(t)}s`, px + 18, 28); px += 64;
    }
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = '700 24px Georgia, serif'; ctx.fillText(String(g.score), VW - 20, 26);
    ctx.fillStyle = INK2; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillText('score', VW - 20, 49);
    ctx.textAlign = 'left';
  }

  private drawBanner(dt: number) {
    const b = this.banner; if (!b) return;
    b.t += dt; if (b.t > b.dur) { this.banner = null; return; }
    const a = Math.min(1, b.t / 0.2, (b.dur - b.t) / 0.4), ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = '700 34px Georgia, serif'; const w1 = ctx.measureText(b.title).width; ctx.font = '600 18px system-ui, sans-serif'; const w2 = ctx.measureText(b.sub).width;
    const w = Math.max(w1, w2) + 60, x = VW / 2 - w / 2, y = HUD + 70;
    ctx.fillStyle = 'rgba(42,28,19,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, 92, 14); ctx.fill();
    ctx.strokeStyle = '#c9762e'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, 80, 10); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = INK; ctx.font = '700 34px Georgia, serif'; ctx.fillText(b.title, VW / 2, y + 34);
    ctx.fillStyle = INK2; ctx.font = '600 18px system-ui, sans-serif'; ctx.fillText(b.sub, VW / 2, y + 68);
    ctx.restore();
  }

  /** the keys, for the first seconds of a site: along the bottom shore, or the top one while a chinchilla stands near
   *  the bottom, and not at all while both shores are busy, so it never covers a player */
  private drawHint(g: TambakGame, dt: number) {
    this.hintAge += dt;
    const a = Math.min(1, (HINT_FOR - this.hintAge) / 0.6); if (a <= 0) return;
    const nearBottom = g.heroes.some((h) => h.y >= H - 7), nearTop = g.heroes.some((h) => h.y <= 6);
    if (nearBottom && nearTop) return;
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = a; ctx.font = '600 15px system-ui, sans-serif';
    const w = ctx.measureText(this.hint).width + 28, y = nearBottom ? HUD + 6 : VH - 30;
    ctx.fillStyle = 'rgba(42,28,19,0.9)'; ctx.beginPath(); ctx.roundRect(VW / 2 - w / 2, y, w, 26, 8); ctx.fill();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.hint, VW / 2, y + 13);
    ctx.restore();
  }

  /** the title lettering, poured as coloured sand: the word is sampled into grains, a dark rim first, then the fill */
  sandText(text: string, cx: number, cy: number, size: number) {
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height; const x = c.getContext('2d', { willReadFrequently: true })!;
    x.font = `900 ${size}px Georgia, "Times New Roman", serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000'; x.fillText(text, cx, cy);
    const d = x.getImageData(0, 0, c.width, c.height).data, ctx = this.ctx;
    let s = 4242; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const cols = [[214, 96, 44], [233, 170, 64], [190, 70, 36], [245, 214, 150], [160, 52, 28]];
    const inside = (px: number, py: number) => px >= 0 && py >= 0 && px < c.width && py < c.height && d[(py * c.width + px) * 4 + 3] > 128;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let pass = 0; pass < 2; pass++) for (let py = 0; py < c.height; py += 2) for (let px = 0; px < c.width; px += 2) {
      if (pass === 0) {
        // the dark rim: any pixel within 5 px of the letters
        if (inside(px, py) || !(inside(px + 5, py) || inside(px - 5, py) || inside(px, py + 5) || inside(px, py - 5))) continue;
        ctx.fillStyle = `rgba(52,28,14,${0.7 + rnd() * 0.3})`; ctx.fillRect(px + (rnd() - 0.5) * 2, py + (rnd() - 0.5) * 2, 2.5, 2.5);
      } else if (inside(px, py)) {
        const q = cols[(rnd() * cols.length) | 0], l = (rnd() - 0.5) * 30;
        ctx.fillStyle = `rgb(${q[0] + l | 0},${q[1] + l | 0},${q[2] + l | 0})`; ctx.fillRect(px + (rnd() - 0.5) * 1.5, py + (rnd() - 0.5) * 1.5, 2.4, 2.4);
      }
    }
  }
}
