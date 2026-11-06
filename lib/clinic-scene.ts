// Burrow Clinic: the floor, drawn on a Canvas 2D in a classic 2:1 isometric projection. Codex-painted floor textures
// are mapped onto the tiles, room walls are short slabs on the tile edges (the back walls a little taller, the front
// walls cut low so every room stays visible, and any wall fades when the pointer or the selection is just behind it),
// and everything that stands up (walls, machines, decorations, patients, staff) is depth-sorted by x + y. Characters
// are painted sprite strips (see FRAMES), mirrored for the other two facings, with a little bounce on every footstep.
// Juice: mood badges over heads, a starburst pop and a coin float on every cure, steam, sparks and bubbles from
// working machines, ailment effects, a gentle day/night tint, rain at the lake. Drawing only: the rules are in
// clinic-game.ts, input and the HUD in app/clinic/page.tsx.
import {
  type Game, type Room, type Patient, type Staff, type Walker, type Deco, type Ev, type Door, type RoomKind, type DecoKind,
  ROOMS, DECOS, SIDE_D, PORCH, hourOf, DAY, LAST_ARRIVAL,
} from './clinic-game';

const ART = '/art/clinic/';
/** half a tile, in world pixels */
const HW = 32, HH = 16;
const CHAR = 0.5, MACH = 0.46, DEC = 0.46;
/** strip frames: 0,1 walk towards the viewer (facing screen-left), 2,3 walk away (facing up-left), then the poses */
export const FRAMES = { walkF: 0, walkF2: 1, walkB: 2, walkB2: 3, sit: 4, grumpy: 5, cheer: 6, lie: 7, work: 4, tired: 5, rest: 6, staffCheer: 7 } as const;
const PAL = { ink: '#3b2a2a', cream: '#fbf1dc', mustard: '#e9b23a', teal: '#1f7a7a', coral: '#e8705a', mint: '#9fd8b9', wall: '#f4e3c0', wallSide: '#e2c99a', cap: '#e8705a', capDark: '#c85a48' };

export type Pick = { type: 'patient' | 'staff' | 'walker' | 'room' | 'deco'; id: number } | null;
export type Ghost =
  | { kind: 'room'; room: RoomKind; x: number; y: number; w: number; h: number; ok: boolean; door: Door | null; suggested: boolean }
  | { kind: 'deco'; deco: DecoKind; x: number; y: number; ok: boolean; suggested: boolean };

interface Fx { type: 'burst' | 'coin' | 'puff' | 'bubble' | 'spark' | 'snow' | 'huff' | 'q' | 'dust' | 'heart'; x: number; y: number; z: number; vx: number; vy: number; vz: number; t0: number; life: number; n?: number; r?: number }

/** room floors (the corridors are big soft checker tiles), and how many tiles one copy of each texture covers */
const FLOOR_OF: Partial<Record<RoomKind, string>> = { reception: 'parquet', staff: 'parquet', checkup: 'lino', dust: 'lino', hammock: 'lino', ears: 'lino', lamp: 'lino' };
const TEX_TILES: Record<string, number> = { parquet: 4, lino: 5, terrazzo: 5, checker: 2, cobble: 3 };

export class ClinicScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img = new Map<string, HTMLImageElement>();
  private pat = new Map<string, CanvasPattern>();
  private cells = new Map<string, { w: number; h: number }>();
  game: Game | null = null;
  w = 1; h = 1; dpr = 1;
  cam = { x: 0, y: 200, zoom: 1 };
  private target: { x: number; y: number; zoom: number } | null = null;
  ghost: Ghost | null = null;
  build = false;
  selected: Pick = null;
  hover: [number, number] | null = null;
  held: { id: number; sx: number; sy: number } | null = null;
  reduced = false;
  /** world-space margin the HUD covers at the top and bottom, so fit() keeps the clinic clear of it */
  insets = { top: 0, bottom: 0, left: 0, right: 0 };
  private fx: Fx[] = [];
  private last = 0;
  private bump = new Map<number, number>();
  private wallTall = new Uint8Array(0);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  load(): Promise<void> {
    const names = [
      'sp-pudu', 'sp-guanaco', 'sp-vizcacha', 'sp-flamingo', 'sp-alpaca', 'sp-fox', 'sp-armadillo', 'sp-condor', 'sp-owl', 'dora', 'enzo',
      'st-vet-a', 'st-vet-b', 'st-nurse-a', 'st-nurse-b', 'st-clean-a', 'st-clean-b', 'st-recep-a', 'st-recep-b',
      'm-dryer', 'm-jar', 'm-flipper', 'm-steam', 'm-tub', 'm-comb', 'm-booth', 'm-hammock', 'm-sunlamp', 'm-desk', 'm-exam', 'm-sofa', 'm-coffee', 'm-cabinet',
      'd-cactus', 'd-plant', 'd-cooler', 'd-bench', 'd-lamp', 'd-bin', 'd-table', 'd-rug', 'd-heater', 'd-vending',
      'i-happy', 'i-meh', 'i-grumpy', 'i-thirsty', 'i-sleepy', 'i-repair', 'i-coin', 'i-heart', 'i-star',
      'i-static', 'i-hiccups', 'i-ears', 'i-sneezes', 'i-dust', 'i-tangle', 'i-glow', 'i-puff', 'i-spots', 'i-bell',
      't-checker', 't-terrazzo', 't-parquet', 't-lino', 't-grass', 't-cobble', 't-salt', 't-pebbles', 't-moss', 't-sand', 't-snow', 't-wall',
      'b-litter0', 'b-litter1', 'b-litter2', 'b-burst', 'b-steam', 'b-bubble', 'b-spark', 'b-snow',
      'bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6',
    ];
    return Promise.all(names.map((n) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => { this.img.set(n, im); if (/^(sp-|st-|dora|enzo)/.test(n)) this.cells.set(n, { w: im.naturalWidth / 8, h: im.naturalHeight }); res(); };
      im.onerror = () => res();
      im.src = `${ART}${n}.webp`;
    }))).then(() => {
      for (const [n, im] of this.img) if (n.startsWith('t-')) { const p = this.ctx.createPattern(im, 'repeat'); if (p) this.pat.set(n, p); }
    });
  }
  /** how many of the paintings arrived (for the tests) */
  get loaded() { return this.img.size; }

  setGame(g: Game | null) { this.game = g; this.fx = []; this.selected = null; this.ghost = null; this.held = null; if (g) this.fit(true); }

  resize(w: number, h: number) {
    this.dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr);
    if (this.game && !this.userMoved) this.fit(true);
  }
  userMoved = false;

  // ------------------------------------------------------------------------------------------------ camera
  iso(x: number, y: number): [number, number] { return [(x - y) * HW, (x + y) * HH]; }
  toScreen(wx: number, wy: number): [number, number] { return [(wx - this.cam.x) * this.cam.zoom + this.w / 2, (wy - this.cam.y) * this.cam.zoom + this.h / 2]; }
  tileToScreen(x: number, y: number): [number, number] { const [wx, wy] = this.iso(x, y); return this.toScreen(wx, wy); }
  screenToTile(sx: number, sy: number): [number, number] {
    const wx = (sx - this.w / 2) / this.cam.zoom + this.cam.x, wy = (sy - this.h / 2) / this.cam.zoom + this.cam.y;
    return [(wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2];
  }
  tileAt(sx: number, sy: number): [number, number] { const [x, y] = this.screenToTile(sx, sy); return [Math.round(x), Math.round(y)]; }
  /** frame the whole clinic */
  fit(now = false) {
    const g = this.game; if (!g) return;
    const W = g.W, H = g.H + 1;
    const [l] = this.iso(-0.5, H - 0.5), [r] = this.iso(W - 0.5, -0.5), [, t] = this.iso(-0.5, -0.5), [, b] = this.iso(W - 0.5, H - 0.5);
    const top = t - 60, bw = r - l + 40, bh = b - top + 30;
    const aw = Math.max(80, this.w - this.insets.left - this.insets.right), ah = Math.max(80, this.h - this.insets.top - this.insets.bottom);
    const zoom = Math.max(0.3, Math.min(1.6, Math.min(aw / bw, ah / bh)));
    const cx = (l + r) / 2 - (this.insets.left - this.insets.right) / 2 / zoom, cy = (top + b) / 2 - (this.insets.top - this.insets.bottom) / 2 / zoom;
    this.target = null;
    if (now) { this.cam = { x: cx, y: cy, zoom }; this.userMoved = false; } else { this.target = { x: cx, y: cy, zoom }; this.userMoved = false; }
  }
  get fitZoom() { const z = this.cam.zoom; const keep = { ...this.cam }; this.fit(true); const f = this.cam.zoom; this.cam = keep; this.cam.zoom = z; return f; }
  pan(dx: number, dy: number) { this.target = null; this.userMoved = true; this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom; this.clampCam(); }
  zoomAt(sx: number, sy: number, f: number) {
    this.target = null; this.userMoved = true;
    const [wx, wy] = [(sx - this.w / 2) / this.cam.zoom + this.cam.x, (sy - this.h / 2) / this.cam.zoom + this.cam.y];
    const z = Math.max(0.3, Math.min(2.6, this.cam.zoom * f));
    this.cam.zoom = z;
    this.cam.x = wx - (sx - this.w / 2) / z; this.cam.y = wy - (sy - this.h / 2) / z;
    this.clampCam();
  }
  /** glide to a tile at a zoom (the room close-up) */
  focus(x: number, y: number, zoom: number) {
    const [wx, wy] = this.iso(x, y);
    this.userMoved = true;
    const z = Math.max(0.3, Math.min(2.6, zoom));
    this.target = { x: wx - (this.insets.left - this.insets.right) / 2 / z, y: wy - 20 - (this.insets.top - this.insets.bottom) / 2 / z, zoom: z };
  }
  private clampCam() {
    const g = this.game; if (!g) return;
    const [l] = this.iso(-2, g.H + 2), [r] = this.iso(g.W + 2, -2), [, t] = this.iso(-2, -2), [, b] = this.iso(g.W + 2, g.H + 4);
    this.cam.x = Math.max(l, Math.min(r, this.cam.x)); this.cam.y = Math.max(t, Math.min(b, this.cam.y));
  }

  // ------------------------------------------------------------------------------------------------ picking
  pick(sx: number, sy: number): Pick {
    const g = this.game; if (!g) return null;
    // characters first, front-most first
    const hits: { p: Pick; d: number }[] = [];
    const test = (type: 'patient' | 'staff' | 'walker', id: number, x: number, y: number, name: string, scaleX = 1) => {
      const c = this.cells.get(name); if (!c) return;
      const [px, py] = this.tileToScreen(x, y);
      const hgt = c.h * CHAR * this.cam.zoom, wid = c.w * CHAR * this.cam.zoom * 0.7 * scaleX;
      if (sx >= px - wid / 2 && sx <= px + wid / 2 && sy >= py - hgt + 4 && sy <= py + 8) hits.push({ p: { type, id }, d: x + y });
    };
    for (const p of g.s.patients) if (p.phase !== 'gone' && !this.hidden(p)) test('patient', p.id, p.x, p.y, 'sp-' + p.sp, p.ail === 'puff' && !p.cured ? 1.3 : 1);
    for (const s of g.s.staff) if (s.state !== 'gone') test('staff', s.id, s.x, s.y, 'st-' + s.look);
    for (const w of g.s.walkers) test('walker', w.id, w.x, w.y, w.who === 'inspector' ? 'sp-owl' : w.who);
    if (hits.length) { hits.sort((a, b) => b.d - a.d); return hits[0].p; }
    const [tx, ty] = this.tileAt(sx, sy);
    if (tx < 0 || ty < 0 || tx >= g.W || ty >= g.H) return null;
    const did = g.decoAt[ty * g.W + tx]; if (did) return { type: 'deco', id: did };
    const rid = g.roomAt[ty * g.W + tx]; if (rid) return { type: 'room', id: rid };
    return null;
  }
  private hidden(p: Patient) {
    if (p.phase !== 'in_slot') return false;
    const r = this.game!.roomById(p.room); return !!r && (r.kind === 'steam' || r.kind === 'dark');
  }

  // ------------------------------------------------------------------------------------------------ effects from engine events
  event(e: Ev, now: number) {
    const g = this.game; if (!g) return;
    const add = (f: Omit<Fx, 't0'>) => { if (this.fx.length < 260) this.fx.push({ ...f, t0: now }); };
    if (e.t === 'cure') {
      add({ type: 'burst', x: e.x, y: e.y, z: 40, vx: 0, vy: 0, vz: 0, life: 900 });
      add({ type: 'coin', x: e.x, y: e.y, z: 70, vx: 0, vy: 0, vz: 0.04, life: 1300, n: e.coins });
      if (!this.reduced) for (let i = 0; i < 6; i++) add({ type: 'heart', x: e.x, y: e.y, z: 40, vx: Math.cos(i) * 0.0015, vy: Math.sin(i) * 0.0015, vz: 0.05, life: 900, r: i });
      this.bump.set(e.id, now);
    } else if (e.t === 'coins' || (e.t === 'drink' && e.coins)) add({ type: 'coin', x: e.x, y: e.y, z: 50, vx: 0, vy: 0, vz: 0.04, life: 1100, n: e.coins });
    else if (e.t === 'grumpy') add({ type: 'huff', x: e.x, y: e.y, z: 60, vx: 0, vy: 0, vz: 0.02, life: 1100 });
    else if (e.t === 'wrong') add({ type: 'q', x: e.x, y: e.y, z: 64, vx: 0, vy: 0, vz: 0.02, life: 1400 });
    else if (e.t === 'build' || e.t === 'sell') for (let i = 0; i < 10; i++) add({ type: 'dust', x: e.x + Math.cos(i * 0.63) * 0.6, y: e.y + Math.sin(i * 0.63) * 0.6, z: 4, vx: Math.cos(i * 0.63) * 0.001, vy: Math.sin(i * 0.63) * 0.001, vz: 0.03, life: 700 });
    else if (e.t === 'machine' && !this.reduced) {
      const kind = e.kind;
      const type: Fx['type'] = kind === 'steam' || kind === 'hammock' || kind === 'fluff' ? 'puff' : kind === 'hiccup' || kind === 'dust' ? 'bubble' : kind === 'ears' || kind === 'comb' || kind === 'lamp' ? 'spark' : 'puff';
      for (let i = 0; i < 3; i++) add({ type, x: e.x + (i - 1) * 0.2, y: e.y, z: 50 + i * 6, vx: 0, vy: 0, vz: 0.03 + i * 0.006, life: 1100 + i * 150, r: i });
    } else if (e.t === 'fixed') add({ type: 'spark', x: e.x, y: e.y, z: 40, vx: 0, vy: 0, vz: 0.03, life: 700 });
  }

  // ------------------------------------------------------------------------------------------------ drawing
  /** draw one frame; alpha interpolates between the last two sim ticks */
  frame(now: number, alpha = 1) {
    const g = this.game, c = this.ctx;
    const dt = Math.min(100, now - (this.last || now)); this.last = now;
    if (this.target) {
      const k = this.reduced ? 1 : 1 - Math.pow(0.002, dt / 1000);
      this.cam.x += (this.target.x - this.cam.x) * k; this.cam.y += (this.target.y - this.cam.y) * k; this.cam.zoom += (this.target.zoom - this.cam.zoom) * k;
      if (Math.abs(this.target.x - this.cam.x) < 0.3 && Math.abs(this.target.zoom - this.cam.zoom) < 0.002) { this.cam = { ...this.target }; this.target = null; }
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (!g) { c.fillStyle = PAL.cream; c.fillRect(0, 0, this.w, this.h); return; }
    this.backdrop(g);
    // world transform
    const z = this.cam.zoom;
    const wt = (): void => c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.w / 2 - this.cam.x * z), this.dpr * (this.h / 2 - this.cam.y * z));
    wt();
    this.ground(g);
    this.floors(g);
    if (this.build) this.grid(g);
    this.flats(g, now);
    this.selection(g, now, 'floor');
    this.things(g, now, alpha);
    this.overlays(g, now, alpha);
    this.ghostDraw(g, now);
    this.selection(g, now, 'top');
    this.effects(now);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.tint(g, now);
    if (this.held) this.heldDraw(g, now);
  }

  private tones = new Map<string, [string, string]>();
  /** the sky colour at the painting's top and the flat ground colour at its bottom */
  private tonesOf(name: string, im: HTMLImageElement): [string, string] {
    let t = this.tones.get(name);
    if (!t) {
      const cv = document.createElement('canvas'); cv.width = 8; cv.height = 32;
      const cx = cv.getContext('2d')!; cx.drawImage(im, 0, 0, 8, 32);
      const px = (y: number) => { const d = cx.getImageData(0, y, 8, 1).data; let r = 0, g2 = 0, b = 0; for (let i = 0; i < 32; i += 4) { r += d[i]; g2 += d[i + 1]; b += d[i + 2]; } return `rgb(${r >> 3},${g2 >> 3},${b >> 3})`; };
      t = [px(0), px(31)]; this.tones.set(name, t);
    }
    return t;
  }
  private backdrop(g: Game) {
    const c = this.ctx, im = this.img.get(g.def.backdrop);
    if (!im) { c.fillStyle = '#9fd0c4'; c.fillRect(0, 0, this.w, this.h); return; }
    const [sky, ground] = this.tonesOf(g.def.backdrop, im);
    // the painting's top 45% is the scenery: its horizon sits just behind the clinic's back corner, and its flat
    // ground runs on under the clinic to the bottom of the screen
    const z = this.cam.zoom;
    const [, backY] = this.toScreen(0, this.iso(-0.5, -0.5)[1]);
    const dw = Math.max(this.w * 1.15, 1100 * Math.min(1.6, Math.max(0.6, z))), s = dw / im.naturalWidth, dh = im.naturalHeight * s;
    const top = backY + 30 * z - dh * 0.45;
    const left = (this.w - dw) / 2 - ((this.cam.x * 0.05) % (this.w * 0.07));
    c.fillStyle = sky; c.fillRect(0, 0, this.w, Math.max(0, top + 2));
    c.fillStyle = ground; c.fillRect(0, top + dh - 2, this.w, this.h);
    c.drawImage(im, left, top, dw, dh);
  }

  private polyTiles(x0: number, y0: number, x1: number, y1: number) {
    // the iso parallelogram covering tiles x0..x1, y0..y1 (inclusive), in world coordinates
    const c = this.ctx;
    const a = this.iso(x0 - 0.5, y0 - 0.5), b = this.iso(x1 + 0.5, y0 - 0.5), d = this.iso(x1 + 0.5, y1 + 0.5), e = this.iso(x0 - 0.5, y1 + 0.5);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
  }
  /** fill the current path with a painted texture laid flat on the tiles (`tiles` tiles per texture) */
  private texFill(name: string, tiles: number, fallback: string) {
    const c = this.ctx, p = this.pat.get('t-' + name), im = this.img.get('t-' + name);
    if (!p || !im) { c.fillStyle = fallback; c.fill(); return; }
    const S = im.naturalWidth / tiles;
    p.setTransform(new DOMMatrix([HW / S, HH / S, -HW / S, HH / S, 0, -HH]));
    c.fillStyle = p; c.fill();
  }
  private ground(g: Game) {
    // the porch path out of the front door, fading into the painted ground
    const c = this.ctx;
    for (let i = 0; i < PORCH + 4; i++) {
      c.save(); c.globalAlpha = Math.min(1, 1.6 - i * 0.22);
      this.polyTiles(g.def.door, g.H + i, g.def.door, g.H + i);
      this.texFill('cobble', TEX_TILES.cobble, '#bdb3a2');
      c.restore();
    }
  }
  private floors(g: Game) {
    const c = this.ctx;
    // the building's footprint, with a soft shadow on the ground
    c.save(); c.globalAlpha = 0.22; c.fillStyle = PAL.ink; c.translate(6, 8); this.polyTiles(0, 0, g.W - 1, g.H - 1); c.fill(); c.restore();
    this.polyTiles(0, 0, g.W - 1, g.H - 1);
    this.texFill('checker', TEX_TILES.checker, PAL.mint);
    // soften the corridor checker towards cream
    c.save(); c.globalAlpha = 0.55; c.fillStyle = PAL.cream; c.fill(); c.restore();
    for (const r of g.s.rooms) {
      this.polyTiles(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
      const fl = FLOOR_OF[r.kind] ?? 'terrazzo';
      this.texFill(fl, TEX_TILES[fl] ?? 4, PAL.mint);
      // a soft inner border so rooms read as rooms
      c.save(); c.globalAlpha = 0.25; c.strokeStyle = PAL.ink; c.lineWidth = 1.2; this.polyTiles(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1); c.stroke(); c.restore();
    }
  }
  private grid(g: Game) {
    const c = this.ctx;
    c.save(); c.strokeStyle = 'rgba(31,122,122,0.35)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= g.W; x++) { const a = this.iso(x - 0.5, -0.5), b = this.iso(x - 0.5, g.H - 0.5); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    for (let y = 0; y <= g.H; y++) { const a = this.iso(-0.5, y - 0.5), b = this.iso(g.W - 0.5, y - 0.5); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    c.stroke();
    // a blueprint wash over the corridors (where rooms can go)
    c.globalAlpha = 0.12; c.fillStyle = '#2aa3b8';
    for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) if (!g.roomAt[y * g.W + x]) { this.polyTiles(x, y, x, y); c.fill(); }
    c.restore();
  }
  /** things lying flat on the floor: rugs and litter */
  private flats(g: Game, now: number) {
    const c = this.ctx;
    for (const d of g.s.decos) if (d.kind === 'rug') this.sprite('d-rug', d.x, d.y, DEC, 1, 10);
    for (const l of g.s.litter) {
      const im = this.img.get('b-litter' + (l.id % 3));
      const [wx, wy] = this.iso(l.x + ((l.id * 37) % 7 - 3) / 12, l.y + ((l.id * 53) % 7 - 3) / 12);
      if (im) { const s = 0.16; c.drawImage(im, wx - im.naturalWidth * s / 2, wy - im.naturalHeight * s / 2 - 2, im.naturalWidth * s, im.naturalHeight * s); }
      else { c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.beginPath(); c.ellipse(wx, wy - 2, 4, 3, 0, 0, 7); c.fill(); c.stroke(); }
    }
    void now;
  }

  /** draw an image anchored bottom-centre on a tile; returns its world rect */
  private sprite(name: string, x: number, y: number, scale: number, alpha = 1, down = 8, flip = false, sx = 1, sy = 1) {
    const im = this.img.get(name); if (!im) return;
    const c = this.ctx, [wx, wy] = this.iso(x, y);
    const w = im.naturalWidth * scale * sx, h = im.naturalHeight * scale * sy;
    c.save(); c.globalAlpha *= alpha;
    c.translate(wx, wy + down);
    if (flip) c.scale(-1, 1);
    c.drawImage(im, -w / 2, -h, w, h);
    c.restore();
  }
  /** draw one frame of a character strip */
  private char(name: string, frame: number, x: number, y: number, flip: boolean, opts: { lift?: number; sx?: number; sy?: number; alpha?: number; tint?: string } = {}) {
    const im = this.img.get(name), cell = this.cells.get(name); if (!im || !cell) return;
    const c = this.ctx, [wx, wy] = this.iso(x, y);
    const w = cell.w * CHAR * (opts.sx ?? 1), h = cell.h * CHAR * (opts.sy ?? 1);
    c.save();
    if (opts.alpha !== undefined) c.globalAlpha *= opts.alpha;
    // a soft shadow at the feet
    c.fillStyle = 'rgba(59,42,42,0.18)'; c.beginPath(); c.ellipse(wx, wy + 5, 12 * (opts.sx ?? 1), 5, 0, 0, 7); c.fill();
    c.translate(wx, wy + 6 - (opts.lift ?? 0));
    if (flip) c.scale(-1, 1);
    c.drawImage(im, frame * cell.w, 0, cell.w, cell.h, -w / 2, -h, w, h);
    c.restore();
  }

  private things(g: Game, now: number, alpha: number) {
    const c = this.ctx;
    type D = { d: number; f: () => void };
    const list: D[] = [];
    // ---- walls: every unit edge is its own slab so depth sorting stays right
    const W = g.W, H = g.H, gr = g.grid;
    const near = this.fadeSpots(g);
    const tall = (x: number, y: number, horiz: boolean) => {
      // the north and west walls of a room (and of the building) stand taller; south and east walls are cut low
      if (horiz) { if (y === -1) return 38; const below = y + 1 < H ? g.roomAt[(y + 1) * W + x] : 0, above = y >= 0 ? g.roomAt[y * W + x] : 0; return below && below !== above ? 24 : 9; }
      if (x === -1) return 38; const right = x + 1 < W ? g.roomAt[y * W + x + 1] : 0, left = x >= 0 ? g.roomAt[y * W + x] : 0; return right && right !== left ? 24 : 9;
    };
    for (let y = -1; y < H; y++) for (let x = 0; x < W; x++) {
      const has = y === -1 || gr.wallS[y * W + x] === 1;
      if (!has) continue;
      const hgt = tall(x, y, true);
      list.push({ d: x + y + 0.5, f: () => this.wall(x - 0.5, y + 0.5, x + 0.5, y + 0.5, hgt, true, this.fade(near, x, y + 0.5, hgt)) });
    }
    for (let y = 0; y < H; y++) for (let x = -1; x < W; x++) {
      const has = x === -1 || x === W - 1 || gr.wallE[y * W + x] === 1;
      if (!has) continue;
      const hgt = x === W - 1 ? 9 : tall(x, y, false);
      list.push({ d: x + y + 0.5, f: () => this.wall(x + 0.5, y - 0.5, x + 0.5, y + 0.5, hgt, false, this.fade(near, x + 0.5, y, hgt)) });
    }
    // door frames
    for (const r of g.s.rooms) {
      const [dx, dy] = SIDE_D[r.door.side];
      const ex = r.door.x + dx / 2, ey = r.door.y + dy / 2;
      list.push({ d: ex + ey + 0.01, f: () => this.doorFrame(ex, ey, r.door.side === 'N' || r.door.side === 'S', r.door.side === 'N' || r.door.side === 'W' ? 24 : 12) });
    }
    // ---- machines
    for (const r of g.s.rooms) this.roomThings(g, r, now, list);
    // ---- decorations
    for (const d of g.s.decos) if (d.kind !== 'rug') list.push({ d: d.x + d.y, f: () => this.decoDraw(d, now) });
    // ---- people
    const lerp = (m: { x: number; y: number; px: number; py: number }) => [m.px + (m.x - m.px) * alpha, m.py + (m.y - m.py) * alpha];
    for (const p of g.s.patients) {
      if (p.phase === 'gone' || this.hidden(p)) continue;
      const [x, y] = lerp(p);
      const room = p.phase === 'in_slot' ? g.roomById(p.room) : undefined;
      const stand = room && ROOMS[room.kind].pose === 'stand' && room.kind !== 'reception';
      list.push({ d: x + y + (room ? (stand ? -0.02 : 0.02) : 0), f: () => this.patientDraw(g, p, x, y, now, room) });
    }
    for (const s of g.s.staff) {
      if (s.state === 'gone' || (this.held && this.held.id === s.id)) continue;
      const [x, y] = lerp(s);
      list.push({ d: x + y, f: () => this.staffDraw(s, x, y, now) });
    }
    for (const w of g.s.walkers) { const [x, y] = lerp(w); list.push({ d: x + y, f: () => this.walkerDraw(w, x, y, now) }); }
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.f();
    void c;
  }
  private fadeSpots(g: Game): [number, number][] {
    const out: [number, number][] = [];
    if (this.hover) out.push(this.hover);
    const s = this.selected;
    if (s && (s.type === 'patient' || s.type === 'staff' || s.type === 'walker')) {
      const m = s.type === 'patient' ? g.patientById(s.id) : s.type === 'staff' ? g.staffById(s.id) : g.s.walkers.find((w) => w.id === s.id);
      if (m) out.push([m.x, m.y]);
    }
    return out;
  }
  private fade(spots: [number, number][], ex: number, ey: number, hgt: number) {
    if (hgt < 15) return 1;
    for (const [x, y] of spots) if (x + y < ex + ey && Math.abs(x - ex) + Math.abs(y - ey) < 2.2) return 0.35;
    return 1;
  }
  /** one wall slab from (x1,y1) to (x2,y2) on the floor, hgt tall; `horiz` walls run along x and face the viewer's left */
  private wall(x1: number, y1: number, x2: number, y2: number, hgt: number, horiz: boolean, alpha: number) {
    const c = this.ctx, t = 0.07;
    const off = horiz ? [0, t] : [t, 0];
    const a = this.iso(x1 + off[0], y1 + off[1]), b = this.iso(x2 + off[0], y2 + off[1]);
    const a2 = this.iso(x1 - off[0], y1 - off[1]), b2 = this.iso(x2 - off[0], y2 - off[1]);
    c.save(); c.globalAlpha = alpha;
    // the face towards the viewer: wallpaper on the tall ones
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(b[0], b[1] - hgt); c.lineTo(a[0], a[1] - hgt); c.closePath();
    const wp = this.pat.get('t-wall'), wim = this.img.get('t-wall');
    if (hgt > 15 && wp && wim) {
      const S = wim.naturalWidth / 1.4;
      const ux = (b[0] - a[0]), uy = (b[1] - a[1]);
      wp.setTransform(new DOMMatrix([ux / S, uy / S, 0, 64 / S, a[0], a[1] - hgt]));
      c.fillStyle = wp; c.fill();
      c.fillStyle = horiz ? 'rgba(255,240,210,0.15)' : 'rgba(120,80,40,0.12)'; c.fill();
    } else { c.fillStyle = horiz ? PAL.wall : PAL.wallSide; c.fill(); }
    c.strokeStyle = PAL.ink; c.lineWidth = 1.1; c.stroke();
    // the cap
    c.beginPath(); c.moveTo(a[0], a[1] - hgt); c.lineTo(b[0], b[1] - hgt); c.lineTo(b2[0], b2[1] - hgt); c.lineTo(a2[0], a2[1] - hgt); c.closePath();
    c.fillStyle = PAL.cap; c.fill(); c.stroke();
    c.restore();
  }
  private doorFrame(ex: number, ey: number, horiz: boolean, hgt: number) {
    const c = this.ctx;
    const a = horiz ? this.iso(ex - 0.5, ey) : this.iso(ex, ey - 0.5), b = horiz ? this.iso(ex + 0.5, ey) : this.iso(ex, ey + 0.5);
    c.save(); c.strokeStyle = PAL.ink; c.lineWidth = 1.2;
    for (const p of [a, b]) { c.fillStyle = PAL.teal; c.fillRect(p[0] - 2.5, p[1] - hgt - 4, 5, hgt + 4); c.strokeRect(p[0] - 2.5, p[1] - hgt - 4, 5, hgt + 4); }
    if (hgt > 15) { c.beginPath(); c.moveTo(a[0], a[1] - hgt - 4); c.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - hgt - 14, b[0], b[1] - hgt - 4); c.lineWidth = 4; c.strokeStyle = PAL.teal; c.stroke(); c.lineWidth = 1.2; c.strokeStyle = PAL.ink; c.stroke(); }
    c.restore();
  }

  private roomThings(g: Game, r: Room, now: number, list: { d: number; f: () => void }[]) {
    const def = ROOMS[r.kind], st = r.staff ? g.staffById(r.staff) : undefined;
    const working = !!st && st.state === 'work' && st.room === r.id;
    const flip = r.door.side === 'E' || r.door.side === 'W';
    r.slots.forEach((q, i) => void i);
    for (let i = 0; i < r.mach.length; i++) {
      const [mx, my] = r.mach[i];
      const q = r.slots.find((s) => s.x === mx && s.y === my);
      const busy = !!q && !!q.patient && working && !q.broken && q.progress > 0;
      list.push({ d: mx + my, f: () => {
        const t = now / 1000;
        const wob = busy && !this.reduced ? Math.sin(t * 18) * 0.025 : 0;
        const broken = !!q && q.broken;
        const ctx = this.ctx;
        ctx.save();
        if (broken) ctx.filter = 'grayscale(0.7) brightness(0.92)';
        this.sprite('m-' + def.machine, mx, my, MACH * (def.machine === 'desk' ? 0.78 : def.machine === 'sofa' || def.machine === 'exam' ? 0.92 : 1), 1, 12, flip, 1 + wob, 1 - wob);
        ctx.restore();
        if (r.kind === 'dark' && busy) { const [wx, wy] = this.iso(mx, my); ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4); ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(wx, wy - 40, 22, 0, 7); ctx.fill(); ctx.restore(); }
        if (r.kind === 'lamp' && busy) { const [wx, wy] = this.iso(mx, my); ctx.save(); ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6); ctx.fillStyle = '#fff1a8'; ctx.beginPath(); ctx.arc(wx, wy - 30, 34, 0, 7); ctx.fill(); ctx.restore(); }
        if (broken) this.badge('i-repair', mx, my, 70, now, 0.8);
        else if (q && q.wear >= 75) this.badge('i-repair', mx, my, 70, now, 0.45);
      } });
    }
    if (r.kind === 'staff' && r.rest.length) {
      const [cx, cy] = r.rest[r.rest.length - 1];
      list.push({ d: cx + cy - 0.1, f: () => this.sprite('m-coffee', cx, cy, MACH * 0.85, 1, 10) });
    }
  }
  private decoDraw(d: Deco, now: number) {
    const def = DECOS[d.kind];
    const droop = d.kind === 'plant' && d.water <= 25;
    const sway = this.reduced ? 0 : Math.sin(now / 900 + d.id) * 0.015;
    const ctx = this.ctx;
    ctx.save();
    if (droop) ctx.filter = 'saturate(0.45) brightness(0.95)';
    this.sprite('d-' + d.kind, d.x, d.y, DEC * (d.kind === 'vending' || d.kind === 'heater' ? 0.9 : 1), 1, 8, false, 1 + sway, droop ? 0.88 : 1 - sway);
    ctx.restore();
    if (droop) this.badge('i-thirsty', d.x, d.y, 56, now, 0.85);
    void def;
  }

  /** a mood badge over a head: a cream bubble with an icon */
  private badge(icon: string, x: number, y: number, up: number, now: number, alpha = 1, size = 20) {
    const im = this.img.get(icon); if (!im) return;
    const c = this.ctx, [wx, wy] = this.iso(x, y);
    const bob = this.reduced ? 0 : Math.sin(now / 300 + x * 3 + y) * 1.5;
    const cy = wy - up + bob;
    c.save(); c.globalAlpha *= alpha;
    c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 1.3;
    c.beginPath(); c.arc(wx, cy, size * 0.62, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(wx - 3, cy + size * 0.55); c.lineTo(wx, cy + size * 0.85); c.lineTo(wx + 3, cy + size * 0.55); c.fill();
    const k = size / Math.max(im.naturalWidth, im.naturalHeight);
    c.drawImage(im, wx - im.naturalWidth * k / 2, cy - im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k);
    c.restore();
  }

  private walkFrame(m: { dir: number }, moving: boolean, now: number, id: number): { frame: number; flip: boolean; lift: number } {
    const front = m.dir === 0 || m.dir === 1;
    const flip = m.dir === 0 || m.dir === 3;
    if (!moving) return { frame: front ? 0 : 2, flip, lift: 0 };
    const t = now / 150 + id * 0.37;
    const k = Math.floor(t) % 2;
    return { frame: (front ? 0 : 2) + k, flip, lift: this.reduced ? 0 : Math.abs(Math.sin(t * Math.PI)) * 3 };
  }
  private moving(m: { x: number; y: number; px: number; py: number; path: unknown[] }) { return m.path.length > 0 || Math.abs(m.x - m.px) + Math.abs(m.y - m.py) > 0.001; }

  private patientDraw(g: Game, p: Patient, x: number, y: number, now: number, room?: Room) {
    const name = 'sp-' + p.sp;
    const puff = p.ail === 'puff' && !p.cured ? 1.28 : 1;
    const breathe = this.reduced ? 0 : Math.sin(now / 420 + p.id) * 0.015;
    let frame: number, flip = false, lift = 0, sx = puff, sy = 1;
    const seated = p.phase === 'wait' && p.seat && !this.moving(p);
    if (p.phase === 'cheer') { frame = FRAMES.cheer; lift = this.reduced ? 0 : Math.abs(Math.sin(now / 120)) * 7; }
    else if (room) {
      const pose = ROOMS[room.kind].pose;
      if (room.kind === 'reception') { frame = 2; flip = room.door.side === 'S' || room.door.side === 'E' ? (room.door.side === 'E') : false; const d = room.door.side; frame = d === 'S' || d === 'E' ? 2 : 0; flip = d === 'E' || d === 'N'; }
      else { frame = pose === 'lie' ? FRAMES.lie : pose === 'sit' ? FRAMES.sit : 0; lift = pose === 'sit' ? 16 : pose === 'lie' ? 12 : 0; flip = room.door.side === 'E' || room.door.side === 'W'; }
    } else if (seated) { frame = FRAMES.sit; const d = g.s.decos.find((q) => q.id === p.seat); if (d) { const i = d.seats.indexOf(p.id); x += i === 0 ? -0.18 : 0.18; y += i === 0 ? 0.18 : -0.18; } }
    else {
      const w = this.walkFrame(p, this.moving(p), now, p.id);
      frame = w.frame; flip = w.flip; lift = w.lift;
      if (!this.moving(p) && p.patience < 30 && p.phase === 'wait') frame = FRAMES.grumpy;
    }
    if (!this.moving(p)) { sy *= 1 + breathe; sx *= 1 - breathe; }
    const bump = this.bump.get(p.id);
    if (bump && now - bump < 400) { const k = 1 - (now - bump) / 400; sy *= 1 + 0.12 * k; sx *= 1 - 0.08 * k; }
    // the ailment shows
    if (!p.cured) this.ailmentFx(p, x, y, now, frame === FRAMES.lie);
    this.char(name, frame, x, y, flip, { lift, sx, sy });
    if (p.ail === 'glow' && !p.cured) { const c = this.ctx, [wx, wy] = this.iso(x, y); c.save(); c.globalAlpha = 0.28 + 0.12 * Math.sin(now / 200); c.fillStyle = '#fff3a0'; c.beginPath(); c.arc(wx, wy - 30, 14, 0, 7); c.fill(); c.restore(); }
    if (p.ail === 'spots' && !p.cured) { const c = this.ctx, [wx, wy] = this.iso(x, y); c.save(); c.fillStyle = '#8c6bb8'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(wx - 8 + i * 5, wy - 20 - (i % 2) * 7 - lift, 2.2, 0, 7); c.fill(); } c.restore(); }
  }
  private ailmentFx(p: Patient, x: number, y: number, now: number, lying: boolean) {
    if (this.reduced) return;
    const c = this.ctx, [wx, wy] = this.iso(x, y), t = now / 1000 + p.id;
    const top = lying ? 18 : 40;
    if (p.ail === 'static') {
      const im = this.img.get('b-spark');
      if (Math.floor(t * 5) % 3 !== 0) return;
      for (let i = 0; i < 2; i++) {
        const a = t * 7 + i * 3, px = wx + Math.cos(a) * 12, py = wy - top * 0.6 + Math.sin(a * 1.3) * 10;
        if (im) { const s = 0.09; c.drawImage(im, px - im.naturalWidth * s / 2, py - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); }
        else { c.strokeStyle = '#4fb4ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(px + 3, py + 4); c.lineTo(px - 1, py + 6); c.stroke(); }
      }
    } else if (p.ail === 'hiccups') {
      const im = this.img.get('b-bubble');
      for (let i = 0; i < 2; i++) {
        const k = ((t * 0.6 + i * 0.5) % 1), px = wx + 6 + Math.sin(k * 6 + i) * 4, py = wy - top - k * 22;
        c.save(); c.globalAlpha = 1 - k;
        if (im) { const s = 0.06 + i * 0.02; c.drawImage(im, px - im.naturalWidth * s / 2, py - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); }
        c.restore();
      }
    } else if (p.ail === 'sneezes') {
      const im = this.img.get('b-snow'); const k = (t * 0.5) % 1;
      if (k < 0.5 && im) { c.save(); c.globalAlpha = 1 - k * 2; const s = 0.07; c.drawImage(im, wx - 16 - k * 20 - im.naturalWidth * s / 2, wy - top + 6 - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); c.restore(); }
    } else if (p.ail === 'dust') {
      const im = this.img.get('b-steam'); const k = (t * 0.8) % 1;
      if (im) { c.save(); c.globalAlpha = 0.5 * (1 - k); c.filter = 'sepia(0.8)'; const s = 0.07 + k * 0.05; c.drawImage(im, wx - 10 - im.naturalWidth * s / 2, wy + 2 - k * 6 - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); c.restore(); }
    } else if (p.ail === 'ears' || p.ail === 'tangle') {
      // small ailment glyph by the ears / the tail
      const im = this.img.get('i-' + p.ail);
      if (im) { const s = 0.15; c.drawImage(im, wx + (p.ail === 'ears' ? -16 : 10) - im.naturalWidth * s / 2, wy - (p.ail === 'ears' ? top + 6 : 12) - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); }
    }
  }
  private staffDraw(s: Staff, x: number, y: number, now: number) {
    const name = 'st-' + s.look;
    let frame: number, flip = false, lift = 0;
    const mv = this.moving(s);
    if (s.state === 'rest' && !mv) frame = FRAMES.rest;
    else if ((s.state === 'work' || (s.state === 'task' && !mv)) && !mv) {
      frame = FRAMES.work;
      const g = this.game!, r = g.roomById(s.room);
      if (r && r.mach[0]) flip = r.mach[0][0] - s.x + (r.mach[0][1] - s.y) * -1 > 0 ? false : true;
    } else if (!mv && s.energy < 30) frame = FRAMES.tired;
    else { const w = this.walkFrame(s, mv, now, s.id); frame = w.frame; flip = w.flip; lift = w.lift; }
    const breathe = !mv && !this.reduced ? Math.sin(now / 400 + s.id) * 0.015 : 0;
    this.char(name, frame, x, y, flip, { lift, sx: 1 - breathe, sy: 1 + breathe });
    const up = (this.cells.get(name)?.h ?? 148) * CHAR + 12;
    if (s.energy < 30 && s.state !== 'rest') this.badge('i-sleepy', x, y, up, now, 0.9, 18);
    else if (s.state === 'task' && s.task?.type === 'fix' && !mv) this.badge('i-repair', x, y, up, now, 0.9, 18);
  }
  private walkerDraw(w: Walker, x: number, y: number, now: number) {
    const name = w.who === 'inspector' ? 'sp-owl' : w.who;
    const mv = this.moving(w);
    const f = this.walkFrame(w, mv, now, w.id);
    let frame = f.frame;
    if (!mv && w.who !== 'inspector') { const k = Math.floor(now / 2600 + w.id) % 3; frame = k === 0 ? 4 : 0; }
    const breathe = !mv && !this.reduced ? Math.sin(now / 400 + w.id) * 0.015 : 0;
    this.char(name, frame, x, y, f.flip, { lift: f.lift, sx: 1 - breathe, sy: 1 + breathe });
  }

  private overlays(g: Game, now: number, alpha: number) {
    for (const p of g.s.patients) {
      if (p.phase === 'gone' || p.phase === 'leave' || p.phase === 'cheer') continue;
      const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
      const h = (this.cells.get('sp-' + p.sp)?.h ?? 140) * CHAR + 14;
      if (p.phase === 'in_slot') {
        const r = g.roomById(p.room), q = r?.slots[p.slot];
        if (r && q && q.progress > 0) this.ring(x, y, h - 4, q.progress / ROOMS[r.kind].work, p.patience);
        continue;
      }
      if (p.fail > 0) { this.badge('i-meh', x, y, h, now, 1); continue; }
      const icon = p.thirst > 75 ? 'i-thirsty' : p.patience >= 60 ? 'i-happy' : p.patience >= 30 ? 'i-meh' : 'i-grumpy';
      const picked = this.selected?.type === 'patient' && this.selected.id === p.id;
      if ((p.phase === 'wait' && !this.moving(p) && icon !== 'i-happy') || picked) this.badge(icon, x, y, h, now, 1);
      if (p.vip) this.badge('i-star', x + 0.3, y - 0.3, h + 6, now, 1, 16);
    }
  }
  /** the cure progress ring with the mood face in the middle */
  private ring(x: number, y: number, up: number, k: number, patience: number) {
    const c = this.ctx, [wx, wy] = this.iso(x, y), cy = wy - up;
    c.save();
    c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 1.3;
    c.beginPath(); c.arc(wx, cy, 12, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = PAL.teal; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath(); c.arc(wx, cy, 9.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); c.stroke();
    const im = this.img.get(patience >= 60 ? 'i-happy' : patience >= 30 ? 'i-meh' : 'i-grumpy');
    if (im) { const s = 12 / Math.max(im.naturalWidth, im.naturalHeight); c.drawImage(im, wx - im.naturalWidth * s / 2, cy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); }
    c.restore();
  }

  private selection(g: Game, now: number, layer: 'floor' | 'top') {
    const s = this.selected, c = this.ctx; if (!s) return;
    const pulse = 0.6 + 0.4 * Math.sin(now / 250);
    if (s.type === 'room' && layer === 'floor') {
      const r = g.roomById(s.id); if (!r) return;
      c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.globalAlpha = 0.7 * pulse; this.polyTiles(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1); c.stroke();
      c.strokeStyle = PAL.teal; c.lineWidth = 2; c.globalAlpha = 1; c.stroke(); c.restore();
    } else if (s.type === 'deco' && layer === 'floor') {
      const d = g.s.decos.find((q) => q.id === s.id); if (!d) return;
      c.save(); c.strokeStyle = PAL.teal; c.lineWidth = 2.5; c.globalAlpha = pulse; this.polyTiles(d.x, d.y, d.x, d.y); c.stroke(); c.restore();
    } else if (layer === 'floor' && (s.type === 'patient' || s.type === 'staff' || s.type === 'walker')) {
      const m = s.type === 'patient' ? g.patientById(s.id) : s.type === 'staff' ? g.staffById(s.id) : g.s.walkers.find((w) => w.id === s.id);
      if (!m) return;
      const [wx, wy] = this.iso(m.x, m.y);
      c.save(); c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.globalAlpha = pulse; c.beginPath(); c.ellipse(wx, wy + 5, 17, 8.5, 0, 0, 7); c.stroke();
      c.strokeStyle = PAL.teal; c.lineWidth = 1.6; c.globalAlpha = 1; c.stroke(); c.restore();
    }
  }

  private ghostDraw(g: Game, now: number) {
    const gh = this.ghost, c = this.ctx; if (!gh) return;
    const pulse = 0.75 + 0.25 * Math.sin(now / 220);
    const col = gh.ok ? '#3fcf6a' : '#e8574a';
    if (gh.kind === 'room') {
      c.save();
      this.polyTiles(gh.x, gh.y, gh.x + gh.w - 1, gh.y + gh.h - 1);
      c.globalAlpha = 0.32 * pulse; c.fillStyle = col; c.fill();
      c.globalAlpha = 1; c.lineWidth = 2.5; c.strokeStyle = col; c.setLineDash(gh.suggested ? [7, 5] : []); c.stroke(); c.setLineDash([]);
      // glowing box edges, like the blueprint mock
      const corners = [this.iso(gh.x - 0.5, gh.y - 0.5), this.iso(gh.x + gh.w - 0.5, gh.y - 0.5), this.iso(gh.x + gh.w - 0.5, gh.y + gh.h - 0.5), this.iso(gh.x - 0.5, gh.y + gh.h - 0.5)];
      c.globalAlpha = 0.5; c.lineWidth = 1.5;
      for (const [cx, cy] of corners) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - 34); c.stroke(); }
      c.beginPath(); corners.forEach(([cx, cy], i) => (i ? c.lineTo(cx, cy - 34) : c.moveTo(cx, cy - 34))); c.closePath(); c.stroke();
      c.globalAlpha = 1; c.fillStyle = PAL.cream;
      for (const [cx, cy] of corners) { c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill(); c.stroke(); }
      // the machine where it would go
      const def = ROOMS[gh.room];
      if (gh.door) {
        if (gh.ok) {
          const lay = g.layoutRoom(gh.room, gh.x, gh.y, gh.w, gh.h, gh.door);
          for (const [mx, my] of lay.mach) this.sprite('m-' + def.machine, mx, my, MACH, 0.6, 12, gh.door.side === 'E' || gh.door.side === 'W');
        }
        // the door: an arrow pointing out
        const [dx, dy] = SIDE_D[gh.door.side];
        const a = this.iso(gh.door.x + dx * 0.35, gh.door.y + dy * 0.35), b = this.iso(gh.door.x + dx * 0.95, gh.door.y + dy * 0.95);
        c.strokeStyle = PAL.ink; c.lineWidth = 5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        c.strokeStyle = PAL.mustard; c.lineWidth = 3; c.stroke();
        c.fillStyle = PAL.mustard; c.beginPath(); c.arc(b[0], b[1], 4, 0, 7); c.fill(); c.strokeStyle = PAL.ink; c.lineWidth = 1.2; c.stroke();
      }
      c.restore();
    } else {
      c.save();
      this.polyTiles(gh.x, gh.y, gh.x, gh.y);
      c.globalAlpha = 0.4 * pulse; c.fillStyle = col; c.fill(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = 2; c.stroke();
      this.sprite('d-' + gh.deco, gh.x, gh.y, DEC, 0.7, 8);
      c.restore();
    }
  }

  private effects(now: number) {
    const c = this.ctx;
    this.fx = this.fx.filter((f) => now - f.t0 < f.life);
    for (const f of this.fx) {
      const age = now - f.t0, k = age / f.life;
      const x = f.x + f.vx * age, y = f.y + f.vy * age, z = f.z + f.vz * age;
      const [wx, wy0] = this.iso(x, y), wy = wy0 - z;
      c.save();
      if (f.type === 'burst') {
        const im = this.img.get('b-burst'), s = (0.1 + k * 0.32) * (this.reduced ? 0.7 : 1);
        c.globalAlpha = 1 - k * k;
        c.translate(wx, wy); c.rotate(k * 1.2);
        if (im) c.drawImage(im, -im.naturalWidth * s / 2, -im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
        else { c.fillStyle = PAL.mustard; c.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 10 + k * 20 : 24 + k * 40; c.lineTo(Math.cos(i * Math.PI / 8) * r, Math.sin(i * Math.PI / 8) * r); } c.fill(); }
      } else if (f.type === 'coin') {
        const im = this.img.get('i-coin');
        c.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) * 4;
        if (im) c.drawImage(im, wx - 20, wy - 9, 18, 18);
        c.font = '900 15px Nunito, system-ui, sans-serif'; c.textBaseline = 'middle'; c.lineWidth = 3.5; c.strokeStyle = PAL.ink; c.fillStyle = '#ffe07a';
        c.strokeText(`+${f.n}`, wx + 1, wy); c.fillText(`+${f.n}`, wx + 1, wy);
      } else if (f.type === 'heart') {
        const im = this.img.get('i-heart'); c.globalAlpha = 1 - k; const s = 12 * (1 - k * 0.4);
        if (im) c.drawImage(im, wx - s / 2, wy - s / 2, s, s);
      } else if (f.type === 'puff' || f.type === 'dust') {
        const im = this.img.get('b-steam'); c.globalAlpha = (f.type === 'dust' ? 0.6 : 0.85) * (1 - k); const s = (f.type === 'dust' ? 0.05 : 0.07) + k * 0.07;
        if (f.type === 'dust') c.filter = 'sepia(0.6)';
        if (im) c.drawImage(im, wx - im.naturalWidth * s / 2, wy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else if (f.type === 'bubble' || f.type === 'spark' || f.type === 'snow') {
        const im = this.img.get('b-' + f.type); c.globalAlpha = 1 - k; const s = 0.06 + (f.r ?? 0) * 0.01;
        if (im) c.drawImage(im, wx + Math.sin(age / 120 + (f.r ?? 0)) * 6 - im.naturalWidth * s / 2, wy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else if (f.type === 'huff') {
        const im = this.img.get('i-grumpy'); c.globalAlpha = 1 - k; if (im) c.drawImage(im, wx - 11, wy - 11, 22, 22);
        const st = this.img.get('b-steam'); if (st) { c.globalAlpha = 0.5 * (1 - k); const s = 0.05 + k * 0.04; c.drawImage(st, wx + 10, wy - 4, st.naturalWidth * s, st.naturalHeight * s); }
      } else if (f.type === 'q') {
        c.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) * 5;
        c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 1.3; c.beginPath(); c.arc(wx, wy, 10, 0, 7); c.fill(); c.stroke();
        c.font = '900 15px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PAL.coral; c.fillText('?', wx, wy + 1);
      }
      c.restore();
    }
  }

  private tint(g: Game, now: number) {
    const c = this.ctx;
    if (g.s.open) {
      const h = hourOf(g.s);
      // morning gold, clear midday, a golden late afternoon, then a violet dusk
      let col = '', a = 0;
      if (h < 9.5) { col = '255,214,140'; a = 0.12 * (9.5 - h) / 1.5; }
      else if (h >= 16 && h < 18) { col = '255,170,90'; a = 0.1 * (h - 16) / 2; }
      else if (h >= 18) { col = '70,60,140'; a = 0.1 + 0.14 * (h - 18) / 2; }
      if (a > 0) { c.fillStyle = `rgba(${col},${a.toFixed(3)})`; c.fillRect(0, 0, this.w, this.h); }
      void DAY; void LAST_ARRIVAL;
    }
    // rain at the lake
    const rain = g.s.rain;
    if (rain && g.s.t >= rain.from && g.s.t < rain.to && !this.reduced) {
      c.save(); c.strokeStyle = 'rgba(210,235,255,0.55)'; c.lineWidth = 1.4; c.beginPath();
      for (let i = 0; i < 70; i++) {
        const x = ((i * 97.13 + now * 0.25) % (this.w + 40)) - 20, y = ((i * 53.7 + now * 0.7) % (this.h + 40)) - 20;
        c.moveTo(x, y); c.lineTo(x - 5, y + 13);
      }
      c.stroke(); c.fillStyle = 'rgba(60,80,110,0.12)'; c.fillRect(0, 0, this.w, this.h); c.restore();
    }
  }

  private heldDraw(g: Game, now: number) {
    const h = this.held!, s = g.staffById(h.id); if (!s) return;
    const im = this.img.get('st-' + s.look), cell = this.cells.get('st-' + s.look); if (!im || !cell) return;
    const c = this.ctx, k = CHAR * this.cam.zoom * 1.1;
    const sway = this.reduced ? 0 : Math.sin(now / 160) * 0.12;
    c.save(); c.translate(h.sx, h.sy + 10); c.rotate(sway);
    c.drawImage(im, 7 * cell.w, 0, cell.w, cell.h, -cell.w * k / 2, -cell.h * k * 0.15, cell.w * k, cell.h * k);
    c.restore();
  }
}
