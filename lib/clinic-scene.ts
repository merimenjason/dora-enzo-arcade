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
  ROOMS, DECOS, SIDE_D, OUTSIDE, hourOf, DAY, LAST_ARRIVAL, AILMENTS, AILMENT_ORDER,
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
  | { kind: 'deco'; deco: DecoKind; x: number; y: number; ok: boolean; suggested: boolean; rot: number };

interface Fx { type: 'shed' | 'burst' | 'coin' | 'puff' | 'bubble' | 'spark' | 'snow' | 'huff' | 'q' | 'dust' | 'heart' | 'medal' | 'spanner' | 'ring' | 'cloud'; x: number; y: number; z: number; vx: number; vy: number; vz: number; t0: number; life: number; n?: number; r?: number }

/** room floors (the corridors are big soft checker tiles), and how many tiles one copy of each texture covers */
const FLOOR_OF: Partial<Record<RoomKind, string>> = { reception: 'parquet', staff: 'parquet', checkup: 'lino', dust: 'lino', hammock: 'lino', ears: 'lino', lamp: 'lino' };
const TEX_TILES: Record<string, number> = { parquet: 4, lino: 5, terrazzo: 6, checker: 2, cobble: 3 };
/** each room kind's own floor wash, so rooms read apart at a glance (with its door sign) */
const TINT: Record<RoomKind, string> = {
  reception: '#f2c45a', checkup: '#7cc7c2', staff: '#e8a07a', fluff: '#f3a9b8', hiccup: '#9fd8b9', ears: '#c9b2e6', steam: '#a9d4f0',
  dust: '#e9cf8f', comb: '#f0b07a', dark: '#6c6fa8', hammock: '#b8dc8c', lamp: '#ffe07a',
};
/** what a role is called on the "needs" badge */
const NEEDS: Record<string, string> = { vet: 'Needs a vet', nurse: 'Needs a nurse', recep: 'Needs a receptionist' };

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
  /** what the mouse is over (patients show their badges on hover) */
  hoverPick: Pick = null;
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
      's-reception', 's-checkup', 's-staff', 's-fluff', 's-hiccup', 's-ears', 's-steam', 's-dust', 's-comb', 's-dark', 's-hammock', 's-lamp',
      'b-gift1', 'b-gift2', 'b-gift3', 'b-gift4', 'b-medal', 'b-cap', 'b-spanner',
      'd-bench-back', 'd-cooler-back', 'd-vending-back', 'd-heater-back',
      'x-halo', 'x-zap', 'x-bubbles', 'x-snowball', 'x-sneeze', 'x-dust', 'x-knot', 'x-glow',
      ...['pudu', 'guanaco', 'vizcacha', 'flamingo', 'alpaca', 'fox', 'armadillo', 'condor', 'owl'].flatMap((n) => ['ears', 'puff'].flatMap((a) => [`k-${a}-${n}-stand`, `k-${a}-${n}-sit`])),
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
    // never so far out that the characters shrink below about 40 pixels: then the camera frames the middle of the
    // floor and the player pans (clamped to the clinic) to see the rest
    // an upright phone has height to spare: zoom in until the floor fills it (up to twice too wide), so the
    // characters read, and the player pans sideways for the rest
    const fitW = ah > aw * 1.3 ? Math.min(aw * 2 / bw, ah * 0.92 / bh) : Math.min(aw / bw, ah / bh);
    const zoom = Math.max(this.minZoom, Math.min(1.6, fitW));
    const cx = (l + r) / 2 - (this.insets.left - this.insets.right) / 2 / zoom, cy = (top + b) / 2 - (this.insets.top - this.insets.bottom) / 2 / zoom;
    this.target = null;
    const c = this.clamped(cx, cy, zoom);
    if (now) { this.cam = { x: c[0], y: c[1], zoom }; this.userMoved = false; } else { this.target = { x: c[0], y: c[1], zoom }; this.userMoved = false; }
  }
  /** the smallest zoom: characters stay at least ~40 px tall (a little smaller allowed on a phone) */
  get minZoom() { return Math.min(this.w, this.h) < 500 ? 0.6 : 0.72; }
  get fitZoom() { const z = this.cam.zoom; const keep = { ...this.cam }; this.fit(true); const f = this.cam.zoom; this.cam = keep; this.cam.zoom = z; return f; }
  pan(dx: number, dy: number) { this.target = null; this.userMoved = true; this.cam.x -= dx / this.cam.zoom; this.cam.y -= dy / this.cam.zoom; this.clampCam(); }
  zoomAt(sx: number, sy: number, f: number) {
    this.target = null; this.userMoved = true;
    const [wx, wy] = [(sx - this.w / 2) / this.cam.zoom + this.cam.x, (sy - this.h / 2) / this.cam.zoom + this.cam.y];
    const z = Math.max(this.minZoom * 0.9, Math.min(2.6, this.cam.zoom * f));
    this.cam.zoom = z;
    this.cam.x = wx - (sx - this.w / 2) / z; this.cam.y = wy - (sy - this.h / 2) / z;
    this.clampCam();
  }
  /** glide to a tile at a zoom (the room close-up) */
  focus(x: number, y: number, zoom: number) {
    const [wx, wy] = this.iso(x, y);
    this.userMoved = true;
    const z = Math.max(this.minZoom * 0.9, Math.min(2.6, zoom));
    const c = this.clamped(wx - (this.insets.left - this.insets.right) / 2 / z, wy - 20 - (this.insets.top - this.insets.bottom) / 2 / z, z);
    this.target = { x: c[0], y: c[1], zoom: z };
  }
  /** keep the view on the clinic: when the floor is bigger than the view, its edges can reach the view's edges
   *  (plus a small margin) but no further; when it is smaller, it stays roughly centred */
  private clamped(x: number, y: number, z: number): [number, number] {
    const g = this.game; if (!g) return [x, y];
    const [l] = this.iso(-0.5, g.H + 0.5), [r] = this.iso(g.W - 0.5, -0.5), [, t] = this.iso(-0.5, -0.5), [, b] = this.iso(g.W - 0.5, g.H + 1.5);
    const m = 60 / z;
    const vw = (this.w - this.insets.left - this.insets.right) / z / 2, vh = (this.h - this.insets.top - this.insets.bottom) / z / 2;
    const ox = (this.insets.left - this.insets.right) / 2 / z, oy = (this.insets.top - this.insets.bottom) / 2 / z;
    const ax = (l - m + vw) - ox, bx = (r + m - vw) - ox, ay = (t - 70 - m + vh) - oy, by = (b + m - vh) - oy;
    const cxm = (l + r) / 2 - ox, cym = (t - 70 + b) / 2 - oy;
    return [ax <= bx ? Math.max(ax, Math.min(bx, x)) : Math.max(bx, Math.min(ax, Math.max(Math.min(x, cxm + 40), cxm - 40))), ay <= by ? Math.max(ay, Math.min(by, y)) : Math.max(by, Math.min(ay, Math.max(Math.min(y, cym + 40), cym - 40)))];
  }
  private clampCam() { const c = this.clamped(this.cam.x, this.cam.y, this.cam.zoom); this.cam.x = c[0]; this.cam.y = c[1]; }

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
    // still on the way up the road: the line outside is full
    if (p.held && !p.path.length) return true;
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
      // the ailment visibly leaves: its picture pops off the patient and floats away in a puff
      const p = g.s.patients.find((q) => q.id === e.id);
      if (p) { add({ type: 'shed', x: e.x, y: e.y, z: 46, vx: 0, vy: 0, vz: 0.05, life: 1100, r: AILMENT_ORDER.indexOf(p.ail) }); add({ type: 'puff', x: e.x, y: e.y, z: 40, vx: 0, vy: 0, vz: 0.02, life: 700 }); }
    } else if (e.t === 'coins' || (e.t === 'drink' && e.coins)) add({ type: 'coin', x: e.x, y: e.y, z: 50, vx: 0, vy: 0, vz: 0.04, life: 1100, n: e.coins });
    else if (e.t === 'grumpy') add({ type: 'huff', x: e.x, y: e.y, z: 60, vx: 0, vy: 0, vz: 0.02, life: 1100 });
    else if (e.t === 'wrong') add({ type: 'q', x: e.x, y: e.y, z: 64, vx: 0, vy: 0, vz: 0.02, life: 1400 });
    else if (e.t === 'build' || e.t === 'sell') for (let i = 0; i < (e.t === 'build' ? 16 : 10); i++) add({ type: 'dust', x: e.x + Math.cos(i * 0.63) * 0.6, y: e.y + Math.sin(i * 0.63) * 0.6, z: 4, vx: Math.cos(i * 0.63) * 0.001, vy: Math.sin(i * 0.63) * 0.001, vz: 0.03, life: 700 });
    else if (e.t === 'machine' && !this.reduced) {
      const kind = e.kind;
      const type: Fx['type'] = kind === 'steam' || kind === 'hammock' || kind === 'fluff' ? 'puff' : kind === 'hiccup' || kind === 'dust' ? 'bubble' : kind === 'ears' || kind === 'comb' || kind === 'lamp' ? 'spark' : 'puff';
      for (let i = 0; i < 3; i++) add({ type, x: e.x + (i - 1) * 0.2, y: e.y, z: 50 + i * 6, vx: 0, vy: 0, vz: 0.03 + i * 0.006, life: 1100 + i * 150, r: i });
    } else if (e.t === 'fixed') add({ type: 'spark', x: e.x, y: e.y, z: 40, vx: 0, vy: 0, vz: 0.03, life: 700 });
    else if (e.t === 'levelup') {
      add({ type: 'medal', x: e.x, y: e.y, z: 70, vx: 0, vy: 0, vz: 0.025, life: 1800, n: e.skill });
      add({ type: 'ring', x: e.x, y: e.y, z: 6, vx: 0, vy: 0, vz: 0, life: 700 });
      if (!this.reduced) for (let i = 0; i < 5; i++) add({ type: 'spark', x: e.x + Math.cos(i * 1.3) * 0.4, y: e.y + Math.sin(i * 1.3) * 0.4, z: 60 + i * 5, vx: 0, vy: 0, vz: 0.03, life: 900, r: i });
      this.bump.set(e.id, now);
    } else if (e.t === 'upgrade') {
      add({ type: 'spanner', x: e.x, y: e.y, z: 60, vx: 0, vy: 0, vz: 0.02, life: 1400 });
      add({ type: 'burst', x: e.x, y: e.y, z: 36, vx: 0, vy: 0, vz: 0, life: 800 });
      if (!this.reduced) for (let i = 0; i < 6; i++) add({ type: 'spark', x: e.x + Math.cos(i) * 0.6, y: e.y + Math.sin(i) * 0.6, z: 30 + i * 6, vx: 0, vy: 0, vz: 0.03, life: 1000, r: i });
      this.shine.set(e.id, now);
    } else if (e.t === 'huff') add({ type: 'cloud', x: e.x, y: e.y, z: 70, vx: 0, vy: 0, vz: 0.01, life: 1600 });
    if (e.t === 'build' && e.id) {
      this.drop.set(e.id, now);
      add({ type: 'ring', x: e.x, y: e.y, z: 2, vx: 0, vy: 0, vz: 0, life: 600 });
    }
  }
  /** when each room was built (the machines drop in with a thunk) and upgraded (a shine) */
  private drop = new Map<number, number>();
  private shine = new Map<number, number>();
  /** a gentle camera shake on a build thunk */
  private shake = 0;

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
    // world transform (with a tiny settle after a build thunk)
    const z = this.cam.zoom;
    let sh = 0;
    if (!this.reduced) for (const t of this.drop.values()) { const a = now - t - 260; if (a > 0 && a < 260) sh = Math.max(sh, Math.sin(a / 26) * 3 * (1 - a / 260)); }
    const wt = (): void => c.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (this.w / 2 - this.cam.x * z), this.dpr * (this.h / 2 - this.cam.y * z + sh));
    wt();
    this.ground(g);
    this.floors(g);
    if (this.build) this.grid(g);
    this.flats(g, now);
    this.selection(g, now, 'floor');
    this.things(g, now, alpha);
    this.overlays(g, now, alpha);
    this.signs(g, now);
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
    // on a wide screen the painting gets tall: never let its mountain tops leave the top of the screen
    const top = Math.max(backY + 30 * z - dh * 0.45, -dh * 0.04);
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
    for (let i = 0; i < OUTSIDE + 2; i++) {
      c.save(); c.globalAlpha = Math.min(1, 1.9 - i * 0.16);
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
      // the room's own colour wash (it also calms busy textures like terrazzo at a distance)
      c.save(); c.globalAlpha = fl === 'terrazzo' ? 0.42 : 0.3; c.fillStyle = TINT[r.kind]; c.fill(); c.restore();
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
    this.fxSeen.clear(); this.fxTiles.clear();
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
        const broken = !!q && q.broken;
        // working: a busy wobble; idle: a slow breathing bob, as if humming to itself
        const wob = this.reduced || broken ? 0 : busy ? Math.sin(t * 18) * 0.03 : Math.sin(t * 2.2 + mx + my) * 0.008;
        // a new room's machines drop in and land with a thunk
        const dt = this.drop.has(r.id) ? now - this.drop.get(r.id)! : 9999;
        const fall = dt < 260 && !this.reduced ? (1 - dt / 260) ** 2 * 70 : 0;
        const squash = dt >= 260 && dt < 520 && !this.reduced ? Math.sin((dt - 260) / 260 * Math.PI) * 0.12 : 0;
        const ctx = this.ctx;
        ctx.save();
        if (broken) ctx.filter = 'grayscale(0.7) brightness(0.92)';
        else if (r.level >= 2) ctx.filter = r.level >= 3 ? 'saturate(1.35) brightness(1.08)' : 'saturate(1.18) brightness(1.04)';
        ctx.translate(0, -fall);
        this.sprite('m-' + def.machine, mx, my, MACH * (def.machine === 'desk' ? 0.62 : def.machine === 'sofa' || def.machine === 'exam' ? 0.92 : 1), dt < 260 ? 0.4 + dt / 430 : 1, 12, flip, 1 + wob + squash, 1 - wob - squash);
        ctx.restore();
        // upgraded: a glint now and then, and the gold stars live on the door sign
        if (r.level >= 2 && !this.reduced && !broken) {
          const k = ((now / 2400 + mx * 0.37) % 1);
          if (k < 0.12) { const im = this.img.get('b-spark'); const [wx, wy] = this.iso(mx, my); if (im) { ctx.save(); ctx.globalAlpha = Math.sin(k / 0.12 * Math.PI); const s = 0.07; ctx.drawImage(im, wx + 14 - im.naturalWidth * s / 2, wy - 52 - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s); ctx.restore(); } }
        }
        const sh = this.shine.get(r.id);
        if (sh && now - sh < 900) { const [wx, wy] = this.iso(mx, my); ctx.save(); ctx.globalAlpha = 0.5 * (1 - (now - sh) / 900); ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(wx, wy - 30, 38, 0, 7); ctx.fill(); ctx.restore(); }
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
  /** the painting and mirror for a decoration's facing: fronts face +y, mirrored +x; backs face -x, mirrored -y */
  private decoFace(kind: DecoKind, rot: number): [string, boolean] {
    if (DECOS[kind].facings === 1) return ['d-' + kind, false];
    const back = rot === 2 || rot === 3, name = `d-${kind}${back ? '-back' : ''}`;
    return [this.img.get(name) ? name : 'd-' + kind, rot === 0 || rot === 3];
  }
  private decoDraw(d: Deco, now: number) {
    const def = DECOS[d.kind];
    const droop = d.kind === 'plant' && d.water <= 25;
    const sway = this.reduced ? 0 : Math.sin(now / 900 + d.id) * 0.015;
    const ctx = this.ctx;
    ctx.save();
    if (droop) ctx.filter = 'saturate(0.45) brightness(0.95)';
    const [nm, flip] = this.decoFace(d.kind, d.rot);
    this.sprite(nm, d.x, d.y, DEC * (d.kind === 'vending' || d.kind === 'heater' ? 0.9 : 1), 1, 8, flip, 1 + sway, droop ? 0.88 : 1 - sway);
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
    const sick = !p.cured && p.phase !== 'cheer' && p.phase !== 'gone';
    // Upside-Down Ears and Puff-Up are painted poses; without the painting a Puff-Up patient is drawn wider
    const pose = sick && (p.ail === 'ears' || p.ail === 'puff') ? p.ail : '';
    const puff = pose === 'puff' && !this.img.get(`k-puff-${p.sp}-stand`) ? 1.28 : 1;
    const breathe = this.reduced ? 0 : Math.sin(now / 420 + p.id) * 0.015;
    let frame: number, flip = false, lift = 0, sx = puff, sy = 1;
    const seated = p.phase === 'wait' && p.seat && !this.moving(p);
    if (p.phase === 'cheer') { frame = FRAMES.cheer; lift = this.reduced ? 0 : Math.abs(Math.sin(now / 120)) * 9; }
    else if (room) {
      const pose = ROOMS[room.kind].pose;
      if (room.kind === 'reception') { frame = 2; flip = room.door.side === 'S' || room.door.side === 'E' ? (room.door.side === 'E') : false; const d = room.door.side; frame = d === 'S' || d === 'E' ? 2 : 0; flip = d === 'E' || d === 'N'; }
      else { frame = pose === 'lie' ? FRAMES.lie : pose === 'sit' ? FRAMES.sit : 0; lift = pose === 'sit' ? 16 : pose === 'lie' ? 12 : 0; flip = room.door.side === 'E' || room.door.side === 'W'; }
    } else if (seated) {
      // two seats along the bench's length; sitting facing its front (a bench facing away shows their backs)
      frame = FRAMES.sit; const d = g.s.decos.find((q) => q.id === p.seat);
      if (d) {
        const i = d.seats.indexOf(p.id), o = i === 0 ? -0.2 : 0.2;
        if (d.rot === 1 || d.rot === 3) x += o; else y += o;
        flip = d.rot === 0 || d.rot === 3;
        if (d.rot === 2 || d.rot === 3) frame = FRAMES.walkB;
      }
    }
    else {
      const w = this.walkFrame(p, this.moving(p), now, p.id);
      frame = w.frame; flip = w.flip; lift = w.lift;
      if (!this.moving(p) && p.patience < 30 && p.phase === 'wait') frame = FRAMES.grumpy;
    }
    if (!this.moving(p)) { sy *= 1 + breathe; sx *= 1 - breathe; }
    // the ailment moves the body: a double hiccup hop, a sneeze jolt, a dusty wriggle, a sleepy nod
    if (sick && frame !== FRAMES.lie && !this.reduced) {
      const t = now / 1000 + p.id * 0.71;
      if (p.ail === 'hiccups') { const k = t % 1.8; lift += k < 0.22 ? Math.sin(k / 0.22 * Math.PI) * 7 : k > 0.34 && k < 0.5 ? Math.sin((k - 0.34) / 0.16 * Math.PI) * 3.5 : 0; }
      else if (p.ail === 'sneezes') { const k = t % 2.6; if (k > 2.2 && k < 2.36) { sy *= 0.9; sx *= 1.08; } else if (k > 2.0 && k <= 2.2) { sy *= 1.05; } }
      else if (p.ail === 'dust' && !this.moving(p)) { sx *= 1 + Math.sin(t * 14) * 0.05; sy *= 1 - Math.sin(t * 14) * 0.03; }
      else if (p.ail === 'spots') { sy *= 1 - Math.max(0, Math.sin(t * 1.6)) * 0.04; }
      else if (p.ail === 'static') { sx *= 1 + (Math.floor(t * 12) % 2) * 0.02; }
    }
    const bump = this.bump.get(p.id);
    if (bump && now - bump < 400) { const k = 1 - (now - bump) / 400; sy *= 1 + 0.12 * k; sx *= 1 - 0.08 * k; }
    // the ailment shows, behind the body and in front of it
    const lying = frame === FRAMES.lie;
    // one patient's effects per tile (someone walking past a line doesn't stack sparks on it), and a patient standing
    // in line keeps them calm: the busy effects are for patients on the move
    const tile = `${Math.round(x)},${Math.round(y)}`, fxOk = sick && !this.fxTiles.has(tile);
    if (fxOk) this.fxTiles.add(tile);
    const calm = p.phase === 'wait' && !this.moving(p);
    if (fxOk) this.ailmentFx(p, x, y, now, lying, lift, flip, true, calm);
    // a cured patient skips home with a hop in every step and a balloon, lollipop or pinwheel
    if (p.phase === 'leave' && p.happy && !this.reduced) lift += Math.abs(Math.sin(now / 110 + p.id)) * 4;
    const gift = p.cured && p.gift && (p.phase === 'leave' || p.phase === 'cheer') ? this.img.get('b-gift' + p.gift) : undefined;
    const ghgt = (this.cells.get(name)?.h ?? 140) * CHAR;
    if (gift && p.gift <= 2) this.giftDraw(gift, x, y, ghgt, lift, now, p.id, true);
    const painted = pose && !lying ? this.img.get(`k-${pose}-${p.sp}-${frame === FRAMES.sit ? 'sit' : 'stand'}`) : undefined;
    if (painted) this.still(painted, x, y, flip, { lift, sx, sy });
    else this.char(name, frame, x, y, flip, { lift, sx, sy });
    if (fxOk) this.ailmentFx(p, x, y, now, lying, lift, flip, false, calm);
    if (sick) this.fxSeen.set(p.id, `${p.ail}${painted ? ':painted' : ''}`);
    if (gift && p.gift > 2) this.giftDraw(gift, x, y, ghgt, lift, now, p.id, false);
    // a grumpy patient stomps out under a little storm cloud
    if (p.phase === 'leave' && !p.happy) { const st = this.img.get('b-steam'); if (st) { const c = this.ctx, [wx, wy] = this.iso(x, y); c.save(); c.filter = 'brightness(0.45) saturate(0.3)'; c.globalAlpha = 0.85; const s = 0.09, bob = this.reduced ? 0 : Math.sin(now / 140) * 2; c.drawImage(st, wx - st.naturalWidth * s / 2, wy - ghgt - 14 + bob - st.naturalHeight * s / 2, st.naturalWidth * s, st.naturalHeight * s); c.restore(); } }
  }
  /** a single painted pose (the sick variants), drawn with the same feet, shadow and scale as a sheet frame */
  private still(im: HTMLImageElement, x: number, y: number, flip: boolean, opts: { lift?: number; sx?: number; sy?: number }) {
    const c = this.ctx, [wx, wy] = this.iso(x, y);
    const w = im.naturalWidth * CHAR * (opts.sx ?? 1), h = im.naturalHeight * CHAR * (opts.sy ?? 1);
    c.save();
    c.fillStyle = 'rgba(59,42,42,0.18)'; c.beginPath(); c.ellipse(wx, wy + 5, 13 * (opts.sx ?? 1), 5, 0, 0, 7); c.fill();
    c.translate(wx, wy + 6 - (opts.lift ?? 0));
    if (flip) c.scale(-1, 1);
    c.drawImage(im, -w / 2, -h, w, h);
    c.restore();
  }
  /** which ailment each patient showed in the last frame (for the browser tests) */
  fxSeen = new Map<number, string>();
  private fxTiles = new Set<string>();
  private giftDraw(im: HTMLImageElement, x: number, y: number, hgt: number, lift: number, now: number, id: number, balloon: boolean) {
    const c = this.ctx, [wx, wy] = this.iso(x, y), sway = this.reduced ? 0 : Math.sin(now / 380 + id) * 3;
    const s = (balloon ? 34 : 24) / im.naturalHeight * (balloon ? 1.4 : 1);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    // a balloon floats up beside the head on its string; a lollipop or pinwheel is held at the side
    const bx = wx + 14 + sway, by = balloon ? wy - hgt - 4 - lift : wy - hgt * 0.45 - lift;
    c.drawImage(im, bx - w / 2, by - h / 2, w, h);
  }
  /** every ailment is visible on the patient until it is cured: `back` draws what sits behind the body (a static halo,
   *  a dust cloud, a whisker glow), the front pass the sparks, bubbles, sneezes, tail knot, spots and Zzz */
  private ailmentFx(p: Patient, x: number, y: number, now: number, lying: boolean, lift: number, flip: boolean, back: boolean, calm = false) {
    const c = this.ctx, [wx, wy0] = this.iso(x, y), wy = wy0 + 6 - lift, t = this.reduced ? 0.4 : now / 1000 + p.id * 0.71;
    const hgt = (this.cells.get('sp-' + p.sp)?.h ?? 140) * CHAR * (lying ? 0.55 : 1);
    const face = flip ? 1 : -1; // the painted fronts look to the left; flipped, to the right
    const head = wy - hgt * 0.78, mid = wy - hgt * 0.45;
    const draw = (name: string, fb: string, cx: number, cy: number, size: number, alpha = 1, rot = 0, mirror = false) => {
      const im = this.img.get(name) ?? this.img.get(fb); if (!im) return;
      const k = size / Math.max(im.naturalWidth, im.naturalHeight);
      c.save(); c.globalAlpha *= alpha; c.translate(cx, cy); if (rot) c.rotate(rot); if (mirror) c.scale(-1, 1);
      c.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); c.restore();
    };
    switch (p.ail) {
      case 'static':
        // a frizz of crackle around the fur: it flickers rather than glares, so a waiting room of static stays readable
        // in line: a light flicker, a faint frizz now and then and one spark; on the move, the full crackle
        if (back) { if (!calm || Math.floor(t * 3) % 3 === 0) draw('x-halo', 'b-spark', wx, mid - 2, hgt * (calm ? 0.7 : 0.8), calm ? 0.28 : 0.35 + 0.2 * Math.abs(Math.sin(t * 9)), Math.sin(t * 3) * 0.06); }
        else for (let i = 0; i < (calm ? 1 : 3); i++) {
          // sparks crackle on and off around the fur
          if ((Math.floor(t * 9) + i) % 3 === 0) continue;
          const a = i * 2.1 + Math.floor(t * 5) * 1.3;
          draw('x-zap', 'b-spark', wx + Math.cos(a) * hgt * 0.38, mid + Math.sin(a) * hgt * 0.34, 12, 1, a);
        }
        break;
      case 'hiccups':
        if (!back) {
          // each hiccup lets out a bubble, and its echo a smaller one, that float up and pop
          const k = t % 1.8;
          for (const [d, sz] of [[0, 18], [0.34, 12]] as const) {
            const q = (k - d) / 1.2; if (q < 0 || q > 1) continue;
            const px = wx + face * (10 + q * 8), py = head - 6 - q * 26;
            if (q < 0.85) draw('x-bubbles', 'b-bubble', px, py, sz, 1 - q * 0.6);
            else { c.save(); c.strokeStyle = '#7fd3d0'; c.lineWidth = 1.5; c.globalAlpha = (1 - q) * 6; for (let r = 0; r < 6; r++) { const a = r * 1.05; c.beginPath(); c.moveTo(px + Math.cos(a) * 4, py + Math.sin(a) * 4); c.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8); c.stroke(); } c.restore(); }
          }
          // a bubble always hangs by the mouth, so a still frame reads too
          if (k > 1.2) draw('x-bubbles', 'b-bubble', wx + face * hgt * 0.3, head + 2, 10, 0.9);
        }
        break;
      case 'sneezes':
        if (!back) {
          const k = t % 2.6;
          // a cold little snowball at the nose, then the sneeze: a white splat and a snowball flung away in an arc
          if (k < 2.2) draw('x-snowball', 'b-snow', wx + face * hgt * 0.3, head + 4, 9, 0.75);
          else {
            const q = (k - 2.2) / 0.4;
            draw('x-sneeze', 'b-steam', wx + face * (hgt * 0.32 + q * 6), head + 2, 18 + q * 10, 1 - q, 0, face > 0);
            draw('x-snowball', 'b-snow', wx + face * (hgt * 0.35 + q * 34), head - Math.sin(q * Math.PI) * 14 + q * 18, 11, 1 - q * 0.3, 0, face > 0);
          }
        }
        break;
      case 'dust':
        if (back) { const k = (t * 0.9) % 1; draw('x-dust', 'b-steam', wx - face * 6, wy - 10 - k * 4, hgt * 0.8 + k * 8, 0.8 - k * 0.35, Math.sin(t) * 0.1); }
        else for (let i = 0; i < 3; i++) { const k = (t * 0.7 + i / 3) % 1; c.save(); c.globalAlpha = 0.8 * (1 - k); c.fillStyle = '#b08850'; c.beginPath(); c.arc(wx + (i - 1) * 9 + Math.sin(k * 5 + i) * 3, wy - 6 - k * 22, 2.4, 0, 7); c.fill(); c.restore(); }
        break;
      case 'tangle':
        // the knot sits at the tail end of the body, with a little worried wiggle
        if (!back) draw('x-knot', 'i-tangle', wx - face * hgt * 0.3, wy - hgt * 0.22, 24, 1, Math.sin(t * 4) * 0.15);
        break;
      case 'glow': {
        const pulse = 0.75 + 0.25 * Math.sin(t * 4);
        if (back) { c.save(); c.globalCompositeOperation = 'lighter'; draw('x-glow', 'b-burst', wx + face * hgt * 0.2, head + 6, hgt * 0.75, 0.6 * pulse); c.restore(); }
        else {
          // glowing whiskers: bright lines either side of the nose
          c.save(); c.strokeStyle = '#fff07a'; c.lineCap = 'round'; c.shadowColor = '#ffd84a'; c.shadowBlur = 8; c.globalAlpha = pulse; c.lineWidth = 2;
          const nx = wx + face * hgt * 0.2, ny = head + 8;
          for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(nx, ny + i * 2); c.lineTo(nx + face * 14, ny + i * 5 - 1); c.stroke(); c.beginPath(); c.moveTo(nx - face * 4, ny + i * 2); c.lineTo(nx - face * 16, ny + i * 5 - 1); c.stroke(); }
          c.restore();
        }
        break;
      }
      case 'spots':
        if (!back) {
          c.save(); c.fillStyle = '#7c5bb0'; c.strokeStyle = PAL.ink; c.lineWidth = 0.8;
          for (const [dx, dy, r] of [[-0.18, 0.35, 3.2], [0.1, 0.45, 2.6], [-0.05, 0.6, 3], [0.2, 0.28, 2.2], [-0.24, 0.55, 2]] as const) { c.beginPath(); c.arc(wx + dx * hgt, wy - dy * hgt, r, 0, 7); c.fill(); c.stroke(); }
          // Zzz drift up from the head
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = PAL.cream; c.fillStyle = '#5a3f8c';
          for (let i = 0; i < 2; i++) { const k = (t * 0.45 + i * 0.5) % 1; c.globalAlpha = this.reduced ? 1 : Math.sin(k * Math.PI); const zx = wx - face * (8 + k * 10), zy = head - 10 - k * 22; c.font = `900 ${10 + k * 6}px Nunito, system-ui, sans-serif`; c.strokeText('z', zx, zy); c.fillText('z', zx, zy); }
          c.restore();
        }
        break;
      case 'ears': case 'puff':
        // the painted poses do the work; lying on a machine, a small cue keeps them readable
        if (!back && (lying || !this.img.get(`k-${p.ail}-${p.sp}-stand`))) draw('i-' + p.ail, 'i-' + p.ail, wx - face * 12, head - 4, 18, 0.95);
        break;
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
    if (s.state === 'rest' && this.game!.s.rooms.some((r) => r.train && r.kind === 'staff') && this.game!.teacher() && s.skill < 5) this.badge('b-cap', x, y, up, now, 0.95, 18);
    else if (s.energy < 30 && s.state !== 'rest') this.badge('i-sleepy', x, y, up, now, 0.9, 18);
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
      if (p.phase === 'gone' || p.phase === 'leave' || p.phase === 'cheer' || this.hidden(p)) continue;
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
      const hov = picked || (this.hoverPick?.type === 'patient' && this.hoverPick.id === p.id);
      // badges at full size only where they matter: hovered or picked, the front two of a line, a diagnosed patient
      // on the move. The rest of a crowd shows small faded ones, so a busy hall stays readable
      const full = hov || (p.qi >= 0 && p.qi < 2) || (!!p.dx && this.moving(p));
      // in a line a bubble over every head is noise: only thirst and real grumps show (and whoever is picked)
      if ((p.phase === 'wait' && !this.moving(p) && (icon === 'i-grumpy' || (icon === 'i-thirsty' && full))) || hov) this.badge(icon, x, y, h, now, 1);
      if (p.vip) this.badge('i-star', x + 0.3, y - 0.3, h + 6, now, 1, 16);
      // what they have: "?" until the check-up, then the sign of the room that cures them, so patients match rooms
      if (!p.cured) this.ailBadge(p, x, y, h - 18, full ? 1 : 0.55, full ? 1 : 0.5);
      // the picked patient's thought bubble says why they feel that way (above the head, never over the face)
      if (picked) { const w = g.whyOf(p); const top = w.find((q) => !q.good) ?? w[0]; if (top) this.thought(top.text, x, y, h + 26, top.good); }
    }
  }
  /** the "?" or cure-room sign beside a patient's head (to the side, never over the face) */
  private ailBadge(p: Patient, x: number, y: number, up: number, k = 1, alpha = 1) {
    const c = this.ctx, [wx0, wy] = this.iso(x, y), wx = wx0 + 17 * (0.6 + 0.4 * k), cy = wy - up + (1 - k) * 10, r = 9.5 * k;
    c.save(); c.globalAlpha *= alpha;
    if (!p.dx) {
      c.fillStyle = PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 1.3; c.beginPath(); c.arc(wx, cy, r, 0, 7); c.fill(); c.stroke();
      c.font = `900 ${Math.round(14 * k)}px Nunito, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = PAL.coral; c.fillText('?', wx, cy + 1);
    } else {
      const im = this.img.get('s-' + AILMENTS[p.dx].room);
      if (im) c.drawImage(im, wx - r * 1.25, cy - r * 1.25, r * 2.5, r * 2.5);
      else { c.fillStyle = PAL.cream; c.beginPath(); c.arc(wx, cy, r, 0, 7); c.fill(); }
    }
    c.restore();
  }
  /** a cloud-shaped thought bubble with a few words in it */
  private thought(text: string, x: number, y: number, up: number, good: boolean) {
    const c = this.ctx, [wx, wy] = this.iso(x, y), cy = wy - up;
    c.save();
    c.font = '800 12px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 20;
    c.fillStyle = good ? '#eafff1' : PAL.cream; c.strokeStyle = PAL.ink; c.lineWidth = 1.4;
    c.beginPath(); c.roundRect(wx - w / 2, cy - 12, w, 24, 12); c.fill(); c.stroke();
    for (const [dx, dy, r] of [[-6, 17, 3.5], [-10, 25, 2.2]] as const) { c.beginPath(); c.arc(wx + dx, cy + dy, r, 0, 7); c.fill(); c.stroke(); }
    c.fillStyle = PAL.ink; c.fillText(text, wx, cy + 0.5);
    c.restore();
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

  /** a 1950s hanging sign over every door, the line count beside it, gold stars for upgrades, and a clear badge on
   *  any room with nobody on the staff to run it */
  private signs(g: Game, now: number) {
    const c = this.ctx;
    const active = (role: string) => g.s.staff.some((x) => x.role === role && x.state !== 'leave' && x.state !== 'gone');
    const lines = new Map<number, number>();
    for (const p of g.s.patients) if ((p.phase === 'wait' || p.phase === 'arrive') && p.qr) lines.set(p.qr, (lines.get(p.qr) ?? 0) + 1);
    for (const r of g.s.rooms) {
      const [dx, dy] = SIDE_D[r.door.side];
      const back = r.door.side === 'N' || r.door.side === 'W';
      // back doors: the sign hangs high on the wall; front doors: it hangs just outside, over the corridor
      const [wx, wy] = this.iso(r.door.x + dx * (back ? 0.5 : 0.95), r.door.y + dy * (back ? 0.5 : 0.95));
      const cy = wy - (back ? 58 : 50) + (this.reduced ? 0 : Math.sin(now / 700 + r.id) * 1.2);
      const im = this.img.get('s-' + r.kind);
      c.save();
      // the chains
      const S = 40;
      c.strokeStyle = PAL.ink; c.lineWidth = 1.2; c.beginPath(); c.moveTo(wx - 8, cy - 30); c.lineTo(wx - 6, cy - 16); c.moveTo(wx + 8, cy - 30); c.lineTo(wx + 6, cy - 16); c.stroke();
      if (im) c.drawImage(im, wx - S / 2, cy - S / 2, S, S);
      // upgrades: a gold medal per level, hanging under the sign
      const medal = this.img.get('b-medal');
      for (let i = 0; i < r.level - 1; i++) if (medal) { const mw = 13, mh = mw * medal.naturalHeight / medal.naturalWidth; c.drawImage(medal, wx - (r.level - 2) * 8 + i * 16 - mw / 2, cy + S / 2 - 6, mw, mh); }
      // how many are waiting for this room
      const n = lines.get(r.id) ?? 0;
      if (n > 0 && r.kind !== 'staff') {
        const tx = wx + S / 2 + 4, ty = cy - 10, label = String(n);
        c.font = '900 11px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const w = Math.max(18, c.measureText(label).width + 10);
        c.fillStyle = n >= 6 ? PAL.coral : PAL.mustard; c.strokeStyle = PAL.ink; c.lineWidth = 1.2;
        c.beginPath(); c.roundRect(tx - w / 2, ty - 8, w, 16, 8); c.fill(); c.stroke();
        c.fillStyle = n >= 6 ? '#fff' : PAL.ink; c.fillText(label, tx, ty + 0.5);
      }
      // nobody to run it
      const role = ROOMS[r.kind].staff;
      if (role && !active(role)) {
        const label = NEEDS[role] ?? 'Needs staff', ty = cy - 42;
        c.font = '900 11px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        const w = c.measureText(label).width + 16, pulse = this.reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 260);
        c.globalAlpha = pulse; c.fillStyle = PAL.coral; c.strokeStyle = PAL.ink; c.lineWidth = 1.4;
        c.beginPath(); c.roundRect(wx - w / 2, ty - 9, w, 18, 9); c.fill(); c.stroke();
        c.fillStyle = '#fff'; c.fillText(label, wx, ty + 0.5);
      }
      c.restore();
    }
  }

  private ghostDraw(g: Game, now: number) {
    const gh = this.ghost, c = this.ctx; if (!gh) return;
    const pulse = 0.75 + 0.25 * Math.sin(now / 220);
    // deep, saturated colours with an ink edge: a pale green would vanish on the mint floors
    const col = gh.ok ? '#1d9a55' : '#d8432f';
    if (gh.kind === 'room') {
      c.save();
      this.polyTiles(gh.x, gh.y, gh.x + gh.w - 1, gh.y + gh.h - 1);
      c.globalAlpha = 0.45 * pulse; c.fillStyle = col; c.fill();
      c.globalAlpha = 1; c.lineWidth = 4.5; c.strokeStyle = PAL.ink; c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = gh.ok ? '#c9f5d8' : '#ffd2c8'; c.setLineDash(gh.suggested ? [7, 5] : []); c.stroke(); c.setLineDash([]);
      c.strokeStyle = col;
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
      c.globalAlpha = 0.5 * pulse; c.fillStyle = col; c.fill(); c.globalAlpha = 1; c.strokeStyle = PAL.ink; c.lineWidth = 3.5; c.stroke(); c.strokeStyle = gh.ok ? '#c9f5d8' : '#ffd2c8'; c.lineWidth = 1.8; c.stroke();
      const [nm, flip] = this.decoFace(gh.deco, gh.rot);
      this.sprite(nm, gh.x, gh.y, DEC, 0.7, 8, flip);
      // an arrow on the floor shows which way it will face
      if (DECOS[gh.deco].facings > 1) {
        const [dx, dy] = SIDE_D[(['E', 'S', 'W', 'N'] as const)[gh.rot]], [ax, ay] = this.iso(gh.x + dx * 0.55, gh.y + dy * 0.55), [bx, by] = this.iso(gh.x, gh.y);
        const ang = Math.atan2(ay - by, ax - bx);
        c.save(); c.translate(ax, ay + 8); c.rotate(ang); c.fillStyle = PAL.mustard; c.strokeStyle = PAL.ink; c.lineWidth = 2;
        c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -7); c.lineTo(-2, 0); c.lineTo(-5, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
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
      } else if (f.type === 'medal' || f.type === 'spanner') {
        const im = this.img.get('b-' + f.type); const pop = Math.min(1, age / 180);
        c.globalAlpha = k < 0.8 ? 1 : 1 - (k - 0.8) * 5;
        const S = 30 * (0.6 + 0.4 * pop) * (1 + 0.15 * Math.sin(Math.min(1, age / 300) * Math.PI));
        if (im) c.drawImage(im, wx - S / 2, wy - S / 2, S, S);
        if (f.type === 'medal') {
          c.font = '900 13px Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3.5; c.strokeStyle = PAL.ink; c.fillStyle = '#ffe07a';
          const t = `${'★'.repeat(f.n ?? 1)}`; c.strokeText(t, wx, wy - 24); c.fillText(t, wx, wy - 24);
        }
      } else if (f.type === 'ring') {
        c.globalAlpha = 0.7 * (1 - k); c.strokeStyle = '#fff6d0'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(wx, wy, 20 + k * 60, (20 + k * 60) / 2, 0, 0, 7); c.stroke();
      } else if (f.type === 'cloud') {
        const im = this.img.get('b-steam'); c.globalAlpha = 0.85 * (1 - k * k); c.filter = 'brightness(0.4) saturate(0.2)';
        const s = 0.1 + k * 0.03; if (im) c.drawImage(im, wx - im.naturalWidth * s / 2, wy - im.naturalHeight * s / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else if (f.type === 'shed') {
        const im = this.img.get('i-' + AILMENT_ORDER[f.r ?? 0]); const S = 26 * (1 + k * 0.3);
        c.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) * 2.5; c.translate(wx + Math.sin(k * 6) * 6, wy); c.rotate(k * 0.8);
        if (im) c.drawImage(im, -S / 2, -S / 2, S, S);
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
