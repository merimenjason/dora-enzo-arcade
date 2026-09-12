// Canvas 2D view of Dusty Hollow: a soft storybook village that follows the hero.
//
// Art direction, so every sprite pulls the same way:
//   * one palette, defined below, rather than a colour picked per shape;
//   * one light, from the upper left, so every shadow falls down and right;
//   * a paper grain over the ground instead of a checkerboard, which is what
//     made the village read as a spreadsheet;
//   * a soft ink outline on anything that stands up, so it lifts off the grass;
//   * a warm grade and vignette over the finished frame.
import { Hollow, W, H, BUILDINGS, BOARD, FACE, BUGS, NEIGHBOURS, type Terrain, type Season } from './dusty-hollow-game';
import { piece } from './dusty-hollow-room';

export const TILE = 44;
export const VIEW_W = 960;
export const VIEW_H = 600;

/** The light comes from the upper left, so shadows are cast down and to the right. */
const LIGHT = { x: -0.55, y: -0.45 };
const INK = 'rgba(56,44,34,0.5)';
const INK_SOFT = 'rgba(56,44,34,0.22)';
/** Ground tones per season: [base, shade, highlight]. */
const GROUND: Record<Season, [string, string, string]> = {
  spring: ['#89b567', '#6f9b53', '#9dc478'],
  summer: ['#7fae57', '#679447', '#94bd68'],
  autumn: ['#b6a05c', '#9a854a', '#c7b471'],
  winter: ['#e2e8ea', '#c9d3d7', '#f1f5f6'],
};
const TERRAIN: Record<string, [string, string, string]> = {
  path: ['#dcc79d', '#c3ad84', '#e9d8b3'],
  sand: ['#ecdcb0', '#d6c396', '#f6ebc8'],
  cliff: ['#847a6c', '#6b6256', '#9c9284'],
  bridge: ['#ab7a44', '#8d6234', '#c2925a'],
  water: ['#5aa6cd', '#4a90b9', '#7cc0e0'],
};
const TREE: Record<Season, [string, string, string]> = {
  spring: ['#4f9a4a', '#3b7a3d', '#69b45c'],
  summer: ['#438f45', '#327436', '#5cab55'],
  autumn: ['#d1863c', '#a9652b', '#e5a556'],
  winter: ['#7f8d82', '#65736a', '#9aa79c'],
};
const FRUIT_COLOR: Record<string, string> = { apple: '#e04c3a', pear: '#c9d35a', peach: '#f2a36c', cherry: '#b8203a', orange: '#f09a2c', golden: '#ffd94a' };
const FLOWER_COLOR: Record<string, string> = { red: '#e2413c', yellow: '#f2d54a', white: '#fbf8f0', orange: '#f28c2c', pink: '#f4a3c4', purple: '#9a6cd6', blue: '#5b8de6' };
const BUG_COLOR: Record<string, string> = { butterfly: '#f0c04a', swallowtail: '#3f3a4a', bee: '#f2b830', ladybug: '#e0392f', grasshopper: '#6fbf4a', cricket: '#5a4a3a', firefly: '#f6f08a', dragonfly: '#5fc1d9', cicada: '#8a6f4a', moth: '#cbbfa5', stag: '#2f2a2a', snail: '#b89c6a', wintermoth: '#e8e4d8', snowflea: '#3a3a44', hercules: '#4a3a26' };
const FLYING = ['butterfly', 'swallowtail', 'bee', 'firefly', 'dragonfly', 'moth', 'wintermoth'];
const SPECIES_BODY: Record<string, string> = { dora: '#f2ede4', enzo: '#8e8f98', flamingo: '#f39ab5', fox: '#d9873c', viscacha: '#b7a58c', condor: '#4a4750', llama: '#e8dcc2', cat: '#8a7f73' };
const EARED = ['dora', 'enzo', 'viscacha', 'cat', 'llama'];
/** Walls, roof and trim for the four named buildings; neighbours' houses share the last. */
const HOUSE: Record<string, [string, string, string]> = {
  home: ['#cf9463', '#94603a', '#f7e8cc'],
  friend: ['#bf9269', '#805e40', '#f5dfc0'],
  shop: ['#d9755f', '#8f4033', '#f8e2cc'],
  museum: ['#95a1ae', '#54606d', '#eaeff3'],
};

export type Camera = { x: number; y: number };

type Label = { text: string; x: number; y: number; font: string; color: string; align: CanvasTextAlign };

/** A stable value in [0, 1) for a tile, so the same tree is always the same shape. */
function hash(x: number, y: number, salt = 0) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Mix a colour toward another by t, for cheap shading without a colour library. */
function shade(hex: string, t: number, toward = '#000000') {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toward.slice(1), 16);
  const mix = (s: number) => Math.round((((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t));
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

export class HollowScene {
  c: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0 };
  time = 0;
  /** World-space text, collected while painting and drawn last so night never dims it. */
  private labels: Label[] = [];
  /** A tile of paper grain, laid over the ground to break up the flat fills. */
  private grain: CanvasPattern | null = null;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.c = canvas.getContext('2d')!;
    this.grain = this.makeGrain();
  }
  /** Nothing to free: the 2D view owns no GPU resources. Kept so the page can swap views blindly. */
  dispose() { /* no-op */ }

  private makeGrain(): CanvasPattern | null {
    const size = 128;
    const g = document.createElement('canvas');
    g.width = size; g.height = size;
    const gc = g.getContext('2d');
    if (!gc) return null;
    for (let i = 0; i < 2600; i++) {
      const x = hash(i, 1) * size, y = hash(i, 2) * size, r = 0.5 + hash(i, 3) * 1.4;
      const dark = hash(i, 4) < 0.55;
      gc.fillStyle = dark ? 'rgba(60,48,34,0.055)' : 'rgba(255,250,235,0.06)';
      gc.beginPath(); gc.arc(x, y, r, 0, Math.PI * 2); gc.fill();
    }
    return this.c.createPattern(g, 'repeat');
  }
  private label(text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
    this.labels.push({ text, x, y, font, color, align });
  }
  /** The one shadow shape everything standing on the ground uses. */
  private drop(px: number, py: number, rx: number, ry: number, alpha = 0.16) {
    const c = this.c;
    c.fillStyle = `rgba(48,38,28,${alpha})`;
    c.beginPath();
    c.ellipse(px - LIGHT.x * rx * 0.4, py - LIGHT.y * ry * 0.5, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
  private stroke(width = 1.4, color = INK) {
    const c = this.c;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.stroke();
  }

  draw(g: Hollow, dt: number) {
    this.time += dt;
    const c = this.c;
    const tx = Math.max(0, Math.min(W * TILE - VIEW_W, g.x * TILE - VIEW_W / 2));
    const ty = Math.max(0, Math.min(H * TILE - VIEW_H, g.y * TILE - VIEW_H / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    const camX = Math.round(this.cam.x), camY = Math.round(this.cam.y);
    this.labels.length = 0;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    c.save();
    c.translate(-camX, -camY);
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    const x1 = Math.min(W, x0 + Math.ceil(VIEW_W / TILE) + 1), y1 = Math.min(H, y0 + Math.ceil(VIEW_H / TILE) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.tile(g, x, y);
    // One pass of grain over the whole ground, so no tile edge shows through it.
    if (this.grain) {
      c.save();
      c.fillStyle = this.grain;
      c.fillRect(x0 * TILE, y0 * TILE, (x1 - x0) * TILE, (y1 - y0) * TILE);
      c.restore();
    }
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.seam(g, x, y);
    for (const f of g.fossils) this.fossil(f.x, f.y);
    for (const s of g.shells) this.shell(s.x, s.y, s.id);
    for (const f of g.flowers) this.flower(f.x, f.y, f.color, f.watered);
    for (const s of g.snowballs) this.snowball(s.x, s.y);
    for (const b of BUILDINGS) this.building(g, b);
    this.board();
    const sprites: { y: number; draw: () => void }[] = [];
    for (const t of g.trees) sprites.push({ y: t.y + 0.5, draw: () => this.tree(g, t.x, t.y, t.fruit, t.count, t.grown > 0, !!t.golden) });
    for (const r of g.rocks) sprites.push({ y: r.y + 0.4, draw: () => this.rock(r.x, r.y, r.hits) });
    for (const s of g.snowmen) sprites.push({ y: s.y + 0.5, draw: () => this.snowman(s.x, s.y) });
    for (const p of g.outdoor) sprites.push({ y: p.y + 0.5, draw: () => this.outdoorPiece(p.id, p.x, p.y) });
    for (const v of g.residents) if (g.out(v)) sprites.push({ y: v.y, draw: () => this.critter(v.x, v.y, SPECIES_BODY[v.species] ?? v.color, v.species, v.facing, false, v.name, g.requests.some((r) => r.villager === v.id && !r.done), undefined, g.isBirthday(v.id)) });
    sprites.push({ y: g.y, draw: () => this.critter(g.x, g.y, SPECIES_BODY[g.hero], g.hero, g.facing, g.moving, `${g.heroName} (you)`, false, g.tool, false, g.sneaking) });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    for (const b of g.bugs) this.bug(b.x, b.y, b.id, b.fleeing);
    if (g.fishing) this.fishing(g);
    for (const e of g.effects) this.effect(e.kind, e.x, e.y, e.age, e.color);
    if (g.reaction) this.reaction(g.x, g.y, g.reaction.icon, g.reaction.age);
    if (g.balloon) this.balloon(g.balloon.x, g.balloon.y, g.balloonInReach);
    c.restore();
    if (g.ceremony || (g.ended && g.isNight)) this.lanterns();
    this.weather(g);
    this.light(g);
    if (g.star > 0) this.shootingStar(g.star);
    this.grade();
    // Labels last, so the night tint and the grade never eat the text.
    c.save();
    c.translate(-camX, -camY);
    for (const l of this.labels) {
      c.font = l.font; c.textAlign = l.align;
      c.lineWidth = 3; c.strokeStyle = 'rgba(40,32,24,0.55)'; c.lineJoin = 'round';
      c.strokeText(l.text, l.x, l.y);
      c.fillStyle = l.color;
      c.fillText(l.text, l.x, l.y);
    }
    c.restore();
    if (g.fishing?.phase === 'reel') this.reelBar(g.fishing.progress, g.fishing.tension);
    if (g.splash) this.titleCard(g.splash.text, g.splash.age);
  }

  // ---- ground -------------------------------------------------------------
  private tones(g: Hollow, t: Terrain): [string, string, string] { return t === 'grass' ? GROUND[g.season] : TERRAIN[t] ?? GROUND[g.season]; }
  private tile(g: Hollow, x: number, y: number) {
    const c = this.c, t: Terrain = g.tileAt(x, y), px = x * TILE, py = y * TILE;
    const [base, dark, light] = this.tones(g, t);
    // A whisper of variation per tile: enough to break the flat fill, never a grid.
    const v = hash(x, y, 5);
    let fill = v > 0.78 ? shade(base, 0.05, light) : v < 0.22 ? shade(base, 0.05, dark) : base;
    // The sea shelves away from the sand, so the shallows read lighter than the deep.
    if (t === 'water' && y >= H - 3) fill = shade(base, 0.34 - (y - (H - 3)) * 0.17, light);
    c.fillStyle = fill;
    c.fillRect(px, py, TILE, TILE);
    if (t === 'water') {
      // Soft moving glints rather than hard white bars.
      c.fillStyle = 'rgba(255,255,255,0.16)';
      for (let i = 0; i < 2; i++) {
        const drift = Math.sin(this.time * 0.9 + x * 1.1 + y * 0.6 + i * 2.2) * 7;
        c.beginPath();
        c.ellipse(px + 14 + i * 16 + drift, py + 12 + i * 18, 8 - i * 2, 2.2, -0.3, 0, Math.PI * 2);
        c.fill();
      }
      if (y === H - 3) {
        // The line where the sea meets the sand, breathing in and out.
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath();
        c.ellipse(px + TILE / 2, py + 4 + Math.sin(this.time * 1.2 + x * 0.7) * 2.5, TILE * 0.6, 3, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else if (t === 'bridge') {
      c.fillStyle = shade(base, 0.28);
      for (let i = 0; i < 4; i++) c.fillRect(px, py + i * 11 + 5, TILE, 1.8);
      c.fillStyle = shade(base, 0.3, light);
      c.fillRect(px, py + 2, TILE, 1.4);
    } else if (t === 'cliff') {
      c.fillStyle = shade(base, 0.35, light);
      c.beginPath(); c.ellipse(px + 13, py + 14, 7, 4, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(base, 0.3);
      c.beginPath(); c.ellipse(px + 30, py + 30, 8, 5, -0.2, 0, Math.PI * 2); c.fill();
    } else if (t === 'grass' && g.season !== 'winter') {
      // A few tufts, placed from the tile hash so they never march in step.
      c.strokeStyle = shade(base, 0.22, dark);
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const gx = px + 6 + hash(x, y, 10 + i) * (TILE - 12), gy = py + 8 + hash(x, y, 20 + i) * (TILE - 14);
        const lean = (hash(x, y, 30 + i) - 0.5) * 4;
        c.beginPath(); c.moveTo(gx, gy + 5); c.quadraticCurveTo(gx + lean, gy + 1, gx + lean * 1.6, gy - 4); c.stroke();
      }
      c.lineCap = 'butt';
    }
  }
  /** Feather the join between two terrains, so the tile grid stops being a grid. */
  private seam(g: Hollow, x: number, y: number) {
    const c = this.c, here = g.tileAt(x, y), px = x * TILE, py = y * TILE;
    for (const [dx, dy] of FACE) {
      const there = g.tileAt(x + dx, y + dy);
      if (there === here) continue;
      const [base] = this.tones(g, there);
      // One narrow step of the neighbour's colour. Anything wider reads as a pale
      // rectangle around every path, which is the tile grid all over again.
      c.globalAlpha = 0.3;
      c.fillStyle = base;
      if (dx) c.fillRect(dx > 0 ? px + TILE - 5 : px, py, 5, TILE);
      else c.fillRect(px, dy > 0 ? py + TILE - 5 : py, TILE, 5);
      c.globalAlpha = 1;
      // A darker lip where land meets water, which reads as a bank.
      if (there === 'water' && here !== 'water') {
        c.fillStyle = 'rgba(60,72,64,0.22)';
        if (dx) c.fillRect(dx > 0 ? px + TILE - 3 : px, py, 3, TILE);
        else c.fillRect(px, dy > 0 ? py + TILE - 3 : py, TILE, 3);
      }
    }
  }

  // ---- buildings ----------------------------------------------------------
  private building(g: Hollow, b: (typeof BUILDINGS)[number]) {
    const c = this.c, px = b.x * TILE, py = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    const owner = NEIGHBOURS.find((v) => v.home === b.id);
    if (owner?.arrives && !g.arrived.includes(owner.id)) {
      c.fillStyle = 'rgba(201,180,138,0.3)';
      c.fillRect(px, py, w, h);
      c.setLineDash([7, 7]);
      c.beginPath(); c.rect(px + 3, py + 3, w - 6, h - 6);
      this.stroke(2, 'rgba(143,90,52,0.7)');
      c.setLineDash([]);
      this.drop(px + w / 2, py + h / 2 + 16, 20, 5);
      c.fillStyle = '#7a4d2b';
      c.fillRect(px + w / 2 - 2, py + h / 2 + 6, 4, 14);
      c.fillStyle = '#f6e6c8';
      c.beginPath(); c.roundRect(px + w / 2 - 24, py + h / 2 - 12, 48, 20, 3); c.fill();
      this.stroke(1.2);
      this.label('FOR SALE', px + w / 2, py + h / 2 + 2, 'bold 9px Arial', '#2b2118');
      return;
    }
    const [wall, roof, trim] = HOUSE[b.id] ?? ['#c9a37a', '#7f6446', '#f3e7d2'];
    const wallTop = py + h * 0.36;
    this.drop(px + w / 2, py + h + 3, w * 0.5, 8, 0.2);
    // Front wall, lighter where the light lands.
    const grad = c.createLinearGradient(px, wallTop, px + w, py + h);
    grad.addColorStop(0, shade(wall, 0.14, '#ffffff'));
    grad.addColorStop(1, shade(wall, 0.16));
    c.fillStyle = grad;
    c.beginPath(); c.rect(px, wallTop, w, h - h * 0.36);
    c.fill();
    this.stroke(1.4);
    // Roof: a lit left face, a shaded right one, and a ridge highlight.
    const apex = py - 8, eave = wallTop + 3;
    c.fillStyle = shade(roof, 0.12, '#ffffff');
    c.beginPath(); c.moveTo(px - 7, eave); c.lineTo(px + w / 2, apex); c.lineTo(px + w / 2, eave); c.closePath(); c.fill();
    c.fillStyle = shade(roof, 0.12);
    c.beginPath(); c.moveTo(px + w / 2, apex); c.lineTo(px + w + 7, eave); c.lineTo(px + w / 2, eave); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(px - 7, eave); c.lineTo(px + w / 2, apex); c.lineTo(px + w + 7, eave); c.closePath();
    this.stroke(1.5);
    c.strokeStyle = 'rgba(255,248,235,0.35)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(px + w / 2, apex + 2); c.lineTo(px - 4, eave - 1); c.stroke();
    // The eave throws a shadow down the wall.
    const eaveShade = c.createLinearGradient(0, wallTop, 0, wallTop + 12);
    eaveShade.addColorStop(0, 'rgba(50,38,28,0.3)');
    eaveShade.addColorStop(1, 'rgba(50,38,28,0)');
    c.fillStyle = eaveShade;
    c.fillRect(px, wallTop, w, 12);
    if (b.id === 'home' && g.homeLevel === 0) {
      c.fillStyle = '#e8c56d';
      c.beginPath(); c.moveTo(px + 5, py + h); c.lineTo(px + w / 2, py + 4); c.lineTo(px + w - 5, py + h); c.closePath(); c.fill();
      this.stroke(1.4);
    }
    // What you put in the burrow shows from the street: the stove earns a smoking
    // chimney, the paper lamp a warmer window.
    const stove = b.id === 'home' && g.furniture.some((p) => p.id === 'stove');
    const lamp = b.id === 'home' && g.furniture.some((p) => p.id === 'lamp');
    if (b.id === 'home' && (g.homeLevel >= 2 || stove)) {
      c.fillStyle = shade(roof, 0.2);
      c.beginPath(); c.roundRect(px + w - 24, py - 4, 9, 18, 2); c.fill();
      this.stroke(1.2);
      if (stove) for (let i = 0; i < 4; i++) {
        const t = ((this.time * 0.32 + i * 0.25) % 1);
        c.fillStyle = `rgba(236,230,220,${0.42 * (1 - t)})`;
        c.beginPath();
        c.arc(px + w - 19.5 + Math.sin(t * 5 + i) * 7, py - 6 - t * 40, 3.5 + t * 8, 0, Math.PI * 2);
        c.fill();
      }
    }
    const dx = b.door[0] * TILE + 8;
    c.fillStyle = '#5a3a22';
    c.beginPath(); c.roundRect(dx, py + h - 27, TILE - 16, 27, [6, 6, 0, 0]); c.fill();
    this.stroke(1.4);
    c.fillStyle = '#c9a06a';
    c.beginPath(); c.arc(dx + TILE - 22, py + h - 13, 1.8, 0, Math.PI * 2); c.fill();
    const lit = g.isNight && (b.id === 'shop' ? g.shopOpen : true);
    for (const wx of [px + 9, px + w - 22]) {
      c.fillStyle = lit ? (lamp ? '#ffe0a0' : '#ffd27a') : trim;
      c.beginPath(); c.roundRect(wx, py + h * 0.52, 13, 13, 2); c.fill();
      this.stroke(1.2);
      if (lit) {
        c.fillStyle = lamp ? 'rgba(255,222,150,0.34)' : 'rgba(255,210,122,0.22)';
        c.beginPath(); c.arc(wx + 6, py + h * 0.52 + 6, lamp ? 26 : 16, 0, Math.PI * 2); c.fill();
      }
    }
    if (owner && g.isBirthday(owner.id)) for (const [bx, col] of [[px + 7, '#f4a3c4'], [px + w - 7, '#5b8de6']] as const) {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(bx, py + h * 0.34, 5, 6, 0, 0, Math.PI * 2); c.fill();
      this.stroke(1);
    }
    this.label(b.id === 'home' ? g.houseName : b.name, px + w / 2, wallTop + 17, 'bold 11px Arial', '#fff4e0');
  }
  /** A piece of furniture standing out in the hollow, drawn by the burrow's own hand. */
  private outdoorPiece(id: string, x: number, y: number) {
    const px = x * TILE + TILE / 2, base = y * TILE + TILE * 0.86;
    this.drop(px, base + 2, 15, 5, 0.2);
    piece(this.c, id, px, base, TILE * 0.92, (w, col) => this.stroke(w, col), this.time);
  }
  /** Paper lanterns going up over the hollow while the village says goodnight. */
  private lanterns() {
    const c = this.c;
    for (let i = 0; i < 22; i++) {
      const t = ((this.time * 0.055 + i * 0.137) % 1);
      const lx = ((i * 149) % VIEW_W) + Math.sin(this.time * 0.6 + i) * 16;
      const ly = VIEW_H - t * (VIEW_H + 80) + 40;
      const a = Math.min(1, t * 5) * (1 - t * 0.65);
      c.globalAlpha = a * 0.34;
      c.fillStyle = '#ffca70';
      c.beginPath(); c.arc(lx, ly, 17, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a;
      c.fillStyle = '#ffdd97';
      c.beginPath(); c.roundRect(lx - 5, ly - 7, 10, 14, 3); c.fill();
      c.fillStyle = '#e2954a';
      c.fillRect(lx - 5, ly + 5, 10, 2);
      c.globalAlpha = 1;
    }
  }
  private board() {
    const c = this.c, px = BOARD.x * TILE + TILE / 2, py = BOARD.y * TILE + TILE / 2;
    this.drop(px, py + 19, 12, 4);
    c.fillStyle = '#7a4d2b';
    c.fillRect(px - 3, py - 2, 6, 20);
    c.fillStyle = '#c0946a';
    c.beginPath(); c.roundRect(px - 17, py - 22, 34, 24, 3); c.fill();
    this.stroke(1.4);
    c.fillStyle = '#fffaf0';
    for (const [nx, ny, nw, nh] of [[-12, -18, 10, 7], [1, -17, 10, 9], [-11, -9, 12, 6]]) {
      c.beginPath(); c.roundRect(px + nx, py + ny, nw, nh, 1); c.fill();
    }
  }

  // ---- growing things -----------------------------------------------------
  private tree(g: Hollow, x: number, y: number, fruit: string, count: number, sapling: boolean, golden = false) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    const [base, dark, light] = golden && !sapling ? ['#cfa62f', '#a8811f', '#eccb56'] : TREE[g.season];
    if (golden && !sapling) {
      c.fillStyle = 'rgba(255,217,74,0.18)';
      c.beginPath(); c.arc(px, py - 8, 28 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2); c.fill();
    }
    this.drop(px, py + 16, sapling ? 8 : 15, sapling ? 3 : 5, 0.18);
    c.fillStyle = '#7d5030';
    c.beginPath();
    c.moveTo(px - 4.5, py + (sapling ? 10 : 18));
    c.lineTo(px - 2.8, py - 2);
    c.lineTo(px + 2.8, py - 2);
    c.lineTo(px + 4.5, py + (sapling ? 10 : 18));
    c.closePath(); c.fill();
    this.stroke(1.3);
    // The canopy is four overlapping lobes, jittered per tree so no two match.
    const r = sapling ? 9 : 17;
    const lobes: [number, number, number][] = sapling
      ? [[0, -4, r]]
      : [[0, -3, r], [-r * 0.62, -r * 0.5, r * 0.7], [r * 0.6, -r * 0.42, r * 0.66], [0, -r * 0.95, r * 0.68]];
    c.beginPath();
    lobes.forEach(([ox, oy, rr], i) => {
      const jx = (hash(x, y, i) - 0.5) * (sapling ? 2 : 5), jy = (hash(x, y, i + 40) - 0.5) * (sapling ? 2 : 5);
      c.moveTo(px + ox + jx + rr, py + oy + jy);
      c.arc(px + ox + jx, py + oy + jy, rr, 0, Math.PI * 2);
    });
    c.fillStyle = base;
    c.fill();
    this.stroke(1.5);
    // Shade the underside, then catch the light on the top left.
    c.save();
    c.clip();
    c.fillStyle = shade(dark, 0.15);
    c.beginPath(); c.ellipse(px + r * 0.45, py + r * 0.2, r, r * 0.8, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(light, 0.1, '#ffffff');
    c.beginPath(); c.ellipse(px - r * 0.45, py - r * 0.75, r * 0.62, r * 0.44, -0.5, 0, Math.PI * 2); c.fill();
    if (g.season === 'winter' && !sapling) {
      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.beginPath(); c.ellipse(px - 2, py - r * 1.1, r * 0.9, r * 0.5, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    if (!sapling && count > 0) {
      const spots = [[-9, -3], [7, -11], [8, 3]];
      for (let i = 0; i < count; i++) {
        c.fillStyle = golden ? FRUIT_COLOR.golden : FRUIT_COLOR[fruit] ?? '#e04c3a';
        c.beginPath(); c.arc(px + spots[i][0], py + spots[i][1], 4, 0, Math.PI * 2); c.fill();
        this.stroke(1.1);
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath(); c.arc(px + spots[i][0] - 1.4, py + spots[i][1] - 1.6, 1.2, 0, Math.PI * 2); c.fill();
      }
    }
  }
  private rock(x: number, y: number, hits: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    this.drop(px, py + 12, 15, 5);
    const base = hits >= 4 ? '#8f897f' : '#a09a90';
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(px - 15, py + 10);
    c.lineTo(px - 11, py - 7);
    c.lineTo(px - 2, py - 12);
    c.lineTo(px + 10, py - 8);
    c.lineTo(px + 15, py + 5);
    c.lineTo(px + 9, py + 11);
    c.closePath();
    c.fill();
    this.stroke(1.5);
    c.save(); c.clip();
    c.fillStyle = shade(base, 0.2);
    c.beginPath(); c.moveTo(px + 2, py - 14); c.lineTo(px + 18, py + 2); c.lineTo(px + 12, py + 14); c.lineTo(px + 1, py + 6); c.closePath(); c.fill();
    c.fillStyle = shade(base, 0.28, '#ffffff');
    c.beginPath(); c.ellipse(px - 5, py - 4, 6, 4, -0.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  private snowball(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    this.drop(px, py + 10, 10, 4);
    c.fillStyle = '#fbfdff';
    c.beginPath(); c.arc(px, py + 2, 9, 0, Math.PI * 2); c.fill();
    this.stroke(1.3, INK_SOFT);
    c.fillStyle = '#dce7ef';
    c.beginPath(); c.ellipse(px + 3.5, py + 5, 4.5, 3.2, 0.3, 0, Math.PI * 2); c.fill();
  }
  private snowman(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    this.drop(px, py + 16, 14, 5);
    c.fillStyle = '#fbfdff';
    c.beginPath(); c.arc(px, py + 4, 13, 0, Math.PI * 2); c.fill();
    this.stroke(1.4, INK_SOFT);
    c.beginPath(); c.arc(px, py - 14, 9, 0, Math.PI * 2); c.fill();
    this.stroke(1.4, INK_SOFT);
    c.fillStyle = '#dce7ef';
    c.beginPath(); c.ellipse(px + 5, py + 7, 6, 4.5, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2420';
    c.beginPath(); c.arc(px - 3, py - 16, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px + 3, py - 16, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f09a2c';
    c.beginPath(); c.moveTo(px, py - 13); c.lineTo(px + 10, py - 11); c.lineTo(px, py - 9.5); c.closePath(); c.fill();
    c.fillStyle = '#d8453a';
    c.beginPath(); c.roundRect(px - 9, py - 7, 18, 4, 2); c.fill();
  }
  private flower(x: number, y: number, color: string, watered: boolean) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    this.drop(px, py + 11, 5, 2, 0.13);
    c.strokeStyle = '#43873f'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(px, py + 11); c.quadraticCurveTo(px - 1.5, py + 4, px, py - 1); c.stroke();
    c.lineCap = 'butt';
    const petal = FLOWER_COLOR[color] ?? '#fff';
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + this.time * 0.18;
      c.moveTo(px + Math.cos(a) * 5 + 3.4, py - 2 + Math.sin(a) * 5);
      c.arc(px + Math.cos(a) * 5, py - 2 + Math.sin(a) * 5, 3.4, 0, Math.PI * 2);
    }
    c.fillStyle = petal;
    c.fill();
    this.stroke(1.1, INK_SOFT);
    c.fillStyle = '#f7e06a';
    c.beginPath(); c.arc(px, py - 2, 2.4, 0, Math.PI * 2); c.fill();
    if (watered) {
      c.fillStyle = 'rgba(93,162,207,0.4)';
      c.beginPath(); c.ellipse(px, py + 11, 9, 3.5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  private fossil(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = 'rgba(90,74,58,0.18)';
    c.beginPath(); c.ellipse(px, py + 1, 13, 9, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#6b5842';
    c.lineWidth = 2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px - 10, py - 4); c.lineTo(px - 2, py + 2); c.lineTo(px + 6, py - 6);
    c.moveTo(px - 2, py + 2); c.lineTo(px + 2, py + 10);
    c.stroke();
    c.lineCap = 'butt';
  }
  private shell(x: number, y: number, id: string) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    this.drop(px, py + 5, 7, 2.5, 0.14);
    c.fillStyle = id === 'conch' ? '#f6c0a6' : id === 'sanddollar' ? '#f2e7c9' : '#fdf7ea';
    c.beginPath();
    if (id === 'sanddollar') c.arc(px, py, 6.5, 0, Math.PI * 2);
    else { c.moveTo(px - 7.5, py + 4); c.quadraticCurveTo(px, py - 11, px + 7.5, py + 4); c.closePath(); }
    c.fill();
    this.stroke(1.2, 'rgba(150,110,74,0.55)');
    if (id !== 'sanddollar') {
      c.strokeStyle = 'rgba(150,110,74,0.35)'; c.lineWidth = 0.9;
      for (const o of [-3, 0, 3]) { c.beginPath(); c.moveTo(px + o * 0.7, py + 4); c.quadraticCurveTo(px + o, py - 4, px + o * 0.3, py - 7); c.stroke(); }
    }
  }

  // ---- creatures ----------------------------------------------------------
  private bug(x: number, y: number, id: string, fleeing: boolean) {
    const c = this.c, px = x * TILE, py = y * TILE + Math.sin(this.time * 6 + x) * 2 - (fleeing ? 10 : 0);
    const flying = FLYING.includes(id) || fleeing;
    if (flying) this.drop(px, y * TILE + 10, 5, 2, 0.12);
    c.fillStyle = BUG_COLOR[id] ?? '#333';
    if (flying) {
      const f = Math.abs(Math.sin(this.time * 18)) * 3;
      c.beginPath(); c.ellipse(px - 4, py, 4, 2.5 + f, -0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + 4, py, 4, 2.5 + f, 0.5, 0, Math.PI * 2); c.fill();
      this.stroke(0.9, INK_SOFT);
      c.fillStyle = '#2a2420';
      c.beginPath(); c.roundRect(px - 1, py - 3.5, 2, 7, 1); c.fill();
    } else {
      c.beginPath(); c.ellipse(px, py, 5.2, 3.6, 0, 0, Math.PI * 2); c.fill();
      this.stroke(1, INK_SOFT);
      c.fillStyle = '#2a2420';
      c.beginPath(); c.arc(px + 4, py, 2, 0, Math.PI * 2); c.fill();
    }
    if (id === 'firefly') { c.fillStyle = 'rgba(246,240,138,0.38)'; c.beginPath(); c.arc(px, py, 10, 0, Math.PI * 2); c.fill(); }
    if (fleeing) return;
    this.label(BUGS.find((b) => b.id === id)?.name ?? id, px, py - 9, '9px Arial', '#fff6e2');
  }
  /** A chinchilla, or one of the neighbours, drawn from a few soft shapes. */
  private critter(x: number, y: number, body: string, species: string, facing: number, moving: boolean, label: string, wants: boolean, tool?: string, birthday = false, sneaking = false) {
    const c = this.c, px = x * TILE, py = y * TILE + (sneaking ? 5 : 0), bob = moving ? Math.abs(Math.sin(this.time * (sneaking ? 6 : 12))) * (sneaking ? 1.5 : 3) : 0;
    this.drop(px, py + 14, 12, 4.5, 0.2);
    const tall = species === 'flamingo' || species === 'condor' || species === 'llama';
    const hy = py - 10 - bob - (tall ? 6 : 0);
    c.fillStyle = body;
    c.beginPath(); c.ellipse(px, py + 2 - bob, 12, tall ? 15 : 12, 0, 0, Math.PI * 2); c.fill();
    this.stroke(1.5);
    // A paler belly and a lit shoulder give the blob some roundness.
    c.save(); c.clip();
    c.fillStyle = shade(body, 0.16, '#ffffff');
    c.beginPath(); c.ellipse(px - 4, py - 3 - bob, 8, tall ? 9 : 7, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(body, 0.14);
    c.beginPath(); c.ellipse(px + 8, py + 8 - bob, 8, 8, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = body;
    c.beginPath(); c.arc(px, hy, 10, 0, Math.PI * 2); c.fill();
    this.stroke(1.5);
    if (EARED.includes(species)) {
      const pointy = species === 'cat' || species === 'llama';
      c.fillStyle = body;
      c.beginPath();
      if (pointy) {
        c.moveTo(px - 10, hy - 2); c.lineTo(px - 7, hy - 16); c.lineTo(px - 1, hy - 7);
        c.moveTo(px + 10, hy - 2); c.lineTo(px + 7, hy - 16); c.lineTo(px + 1, hy - 7);
      } else {
        c.moveTo(px - 3, hy - 8); c.ellipse(px - 8, hy - 8, 5, 7.5, -0.3, 0, Math.PI * 2);
        c.moveTo(px + 13, hy - 8); c.ellipse(px + 8, hy - 8, 5, 7.5, 0.3, 0, Math.PI * 2);
      }
      c.fill();
      this.stroke(1.4);
      if (!pointy) {
        c.fillStyle = '#f2b8c0';
        c.beginPath(); c.ellipse(px - 8, hy - 8, 2.5, 4.2, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(px + 8, hy - 8, 2.5, 4.2, 0.3, 0, Math.PI * 2); c.fill();
      }
    } else if (species === 'fox') {
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(px - 10, hy - 4); c.lineTo(px - 7, hy - 16); c.lineTo(px - 2, hy - 6);
      c.moveTo(px + 10, hy - 4); c.lineTo(px + 7, hy - 16); c.lineTo(px + 2, hy - 6);
      c.fill();
      this.stroke(1.4);
    } else {
      c.fillStyle = species === 'flamingo' ? '#3a2a2a' : '#e8b04a';
      const bx = facing === 3 ? -1 : 1;
      c.beginPath(); c.moveTo(px + bx * 8, hy + 1); c.lineTo(px + bx * 17, hy + 4); c.lineTo(px + bx * 8, hy + 5.5); c.closePath(); c.fill();
      this.stroke(1.1);
    }
    if (species === 'cat') { c.fillStyle = 'rgba(90,80,73,0.8)'; c.beginPath(); c.roundRect(px - 9, hy + 2, 18, 2.4, 1); c.fill(); }
    if (facing !== 0) {
      const ex = facing === 1 ? 4 : facing === 3 ? -4 : 0;
      c.fillStyle = '#2a2420';
      c.beginPath(); c.ellipse(px - 4 + ex, hy - 1, 1.9, 2.2, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + 4 + ex, hy - 1, 1.9, 2.2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath(); c.arc(px - 4.7 + ex, hy - 1.9, 0.7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(px + 3.3 + ex, hy - 1.9, 0.7, 0, Math.PI * 2); c.fill();
    }
    if (tool && tool !== 'hands') {
      const [dx, dy] = FACE[facing];
      const hx = px + dx * 14, hyy = py + dy * 8 - bob;
      c.strokeStyle = '#6a4527';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(px + dx * 6, py - bob); c.lineTo(hx + dx * 10, hyy - 10); c.stroke();
      c.lineCap = 'butt';
      c.fillStyle = tool === 'net' ? 'rgba(255,255,255,0.6)' : tool === 'shovel' ? '#a8a29a' : tool === 'can' ? '#5da2cf' : '#e0392f';
      c.beginPath(); c.arc(hx + dx * 10, hyy - 12, tool === 'net' ? 7 : 4, 0, Math.PI * 2); c.fill();
      this.stroke(1.2);
    }
    if (birthday) {
      c.fillStyle = '#f0cd6b';
      c.beginPath(); c.moveTo(px - 7, hy - 8); c.lineTo(px, hy - 24); c.lineTo(px + 7, hy - 8); c.closePath(); c.fill();
      this.stroke(1.2);
    }
    if (label) this.label(label, px, hy - (EARED.includes(species) || birthday ? 22 : 16), 'bold 10px Arial', label.endsWith('(you)') ? '#ffe08a' : '#fff6e2');
    if (wants) this.label('…', px + 15, hy - 12, 'bold 14px Arial', '#ffd94a');
  }

  // ---- fishing, effects, sky ----------------------------------------------
  private fishing(g: Hollow) {
    const f = g.fishing!;
    const c = this.c, px = f.x * TILE + TILE / 2, py = f.y * TILE + TILE / 2;
    const biting = f.phase === 'bite', nibbling = f.phase === 'nibble', reeling = f.phase === 'reel';
    const drift = reeling ? 0 : Math.sin(this.time * 1.2) * 6;
    c.fillStyle = 'rgba(29,63,90,0.35)';
    c.beginPath(); c.ellipse(px + drift + (reeling ? 0 : 10), py + 8, 6 + f.size * 4, 3 + f.size * 1.5, 0.2, 0, Math.PI * 2); c.fill();
    const by = py + (biting ? 6 : nibbling ? 3 : Math.sin(this.time * 3) * 2);
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(px, by, biting ? 14 : nibbling ? 11 : 9 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2); c.stroke();
    if (!reeling) {
      c.fillStyle = biting ? '#ffdd55' : '#e0392f';
      c.beginPath(); c.arc(px, by, 5, 0, Math.PI * 2); c.fill();
      this.stroke(1.2);
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(px - 1.4, by - 2, 1.8, 0, Math.PI * 2); c.fill();
    }
    if (biting) this.label('!', px, py - 16, 'bold 16px Arial', '#fff3c4');
    const [dx, dy] = FACE[g.facing];
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(g.x * TILE + dx * 24, g.y * TILE - 12 + dy * 8); c.lineTo(px, by - 4); c.stroke();
  }
  private balloon(x: number, y: number, near: boolean) {
    const c = this.c, px = x * TILE, py = y * TILE - 70 + Math.sin(this.time * 1.5) * 4;
    this.drop(px, y * TILE + 14, 12, 4, 0.13);
    c.strokeStyle = '#6a4527'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(px - 6, py + 18); c.lineTo(px, py + 30); c.lineTo(px + 6, py + 18); c.stroke();
    c.fillStyle = '#f0cd6b';
    c.beginPath(); c.roundRect(px - 8, py + 30, 16, 14, 2); c.fill();
    this.stroke(1.2);
    c.fillStyle = '#e2413c';
    c.fillRect(px - 1.5, py + 30, 3, 14); c.fillRect(px - 8, py + 35, 16, 3);
    c.fillStyle = near ? '#f4a3c4' : '#e8748e';
    c.beginPath(); c.ellipse(px, py, 14, 17, 0, 0, Math.PI * 2); c.fill();
    this.stroke(1.4);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.beginPath(); c.ellipse(px - 5, py - 6, 4, 6.5, -0.4, 0, Math.PI * 2); c.fill();
    if (near) this.label('throw!', px, py - 24, 'bold 12px Arial', '#fff3c4');
  }
  private titleCard(text: string, left: number) {
    const c = this.c, a = Math.min(1, left, (4 - left) * 2);
    const band = c.createLinearGradient(0, VIEW_H / 2 - 46, 0, VIEW_H / 2 + 46);
    band.addColorStop(0, 'rgba(52,48,42,0)');
    band.addColorStop(0.5, 'rgba(52,48,42,0.88)');
    band.addColorStop(1, 'rgba(52,48,42,0)');
    c.globalAlpha = a;
    c.fillStyle = band;
    c.fillRect(0, VIEW_H / 2 - 46, VIEW_W, 92);
    c.fillStyle = '#fff5e2';
    c.font = 'italic 40px Georgia, serif';
    c.textAlign = 'center';
    c.fillText(text, VIEW_W / 2, VIEW_H / 2 + 14);
    c.globalAlpha = 1;
  }
  private reelBar(progress: number, tension: number) {
    const c = this.c, w = 260, x = VIEW_W / 2 - w / 2, y = VIEW_H - 78;
    c.fillStyle = 'rgba(52,48,42,0.9)';
    c.beginPath(); c.roundRect(x - 12, y - 12, w + 24, 62, 10); c.fill();
    c.fillStyle = '#fffaf0'; c.font = 'bold 11px Arial'; c.textAlign = 'left';
    c.fillText('REEL', x, y);
    c.fillText('LINE', x, y + 28);
    c.fillStyle = '#5a5550';
    c.beginPath(); c.roundRect(x + 40, y - 9, w - 40, 10, 5); c.fill();
    c.beginPath(); c.roundRect(x + 40, y + 19, w - 40, 10, 5); c.fill();
    c.fillStyle = '#7fd0b8';
    c.beginPath(); c.roundRect(x + 40, y - 9, Math.max(4, (w - 40) * Math.min(1, progress)), 10, 5); c.fill();
    c.fillStyle = tension > 0.75 ? '#e0392f' : tension > 0.5 ? '#f0cd6b' : '#8cc06a';
    c.beginPath(); c.roundRect(x + 40, y + 19, Math.max(4, (w - 40) * Math.min(1, tension)), 10, 5); c.fill();
    c.fillStyle = '#fffaf0'; c.font = '10px Arial'; c.textAlign = 'center';
    c.fillText(tension > 0.75 ? 'Let go!' : 'Hold to reel', x + w / 2 + 20, y + 44);
  }
  private effect(kind: string, x: number, y: number, age: number, color: string) {
    const c = this.c, px = x * TILE, py = y * TILE, t = age / 0.9;
    c.globalAlpha = 1 - t;
    if (kind === 'fruit') {
      c.fillStyle = FRUIT_COLOR[color] ?? color;
      for (let i = 0; i < 3; i++) { const ox = (i - 1) * 14, oy = -10 + t * 34 + Math.abs(Math.sin(t * Math.PI * 2 + i)) * -8; c.beginPath(); c.arc(px + ox, py + oy, 4, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'leaf') {
      c.fillStyle = color;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.beginPath(); c.ellipse(px + Math.cos(a) * (10 + t * 22), py - 10 + Math.sin(a) * (6 + t * 14) + t * 10, 4, 2, a, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'dirt') {
      c.fillStyle = color;
      for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.2 + (i / 7) * 0.6); const d = t * 26; c.beginPath(); c.arc(px + Math.cos(a) * d, py + Math.sin(a) * d + t * t * 30, 3, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'splash') {
      c.strokeStyle = color; c.lineWidth = 2;
      c.beginPath(); c.ellipse(px, py, 4 + t * 20, 2 + t * 9, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = color;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; c.beginPath(); c.arc(px + Math.cos(a) * 10 * t, py - 12 * Math.sin(t * Math.PI) + Math.sin(a) * 5 * t, 2, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'puff' || kind === 'snow') {
      c.fillStyle = color;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.4; c.beginPath(); c.arc(px + Math.cos(a) * (6 + t * 18), py + Math.sin(a) * (6 + t * 18), 5 * (1 - t) + 1, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'present') {
      c.fillStyle = color;
      c.beginPath(); c.roundRect(px - 7, py - 60 + t * 62, 14, 12, 2); c.fill();
      c.fillStyle = '#e2413c';
      c.fillRect(px - 1.5, py - 60 + t * 62, 3, 12);
    } else if (kind === 'sparkle') {
      c.fillStyle = color;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + t * 3; const d = 8 + t * 16; this.star4(px + Math.cos(a) * d, py - t * 12 + Math.sin(a) * d * 0.5, 4 * (1 - t) + 1); }
    }
    c.globalAlpha = 1;
  }
  private star4(x: number, y: number, r: number) {
    const c = this.c;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r, y); c.lineTo(x + r * 0.3, y + r * 0.3); c.lineTo(x, y + r); c.lineTo(x - r * 0.3, y + r * 0.3); c.lineTo(x - r, y); c.lineTo(x - r * 0.3, y - r * 0.3); c.closePath(); c.fill();
  }
  private reaction(x: number, y: number, icon: string, age: number) {
    const c = this.c, px = x * TILE + 16, py = y * TILE - 40 - Math.min(1, age * 3) * 8;
    c.globalAlpha = age < 0.9 ? 1 : 1 - (age - 0.9) / 0.3;
    c.fillStyle = '#fffaf0';
    c.beginPath(); c.roundRect(px - 13, py - 13, 26, 26, 9); c.fill();
    this.stroke(1.3, INK_SOFT);
    c.beginPath(); c.moveTo(px - 5, py + 11); c.lineTo(px - 1, py + 18); c.lineTo(px + 3, py + 11); c.closePath(); c.fill();
    c.globalAlpha = 1;
    this.label(icon === '💦' ? '~' : icon, px, py + 5, 'bold 15px Arial', icon === '♥' ? '#e2413c' : icon === '★' ? '#f0cd6b' : icon === '💦' ? '#5da2cf' : '#34302a');
  }
  private shootingStar(left: number) {
    const c = this.c, t = 1 - left / 3;
    const x = VIEW_W * (0.15 + t * 0.7), y = 30 + t * 90;
    const tail = c.createLinearGradient(x - 70, y - 35, x, y);
    tail.addColorStop(0, 'rgba(255,255,255,0)');
    tail.addColorStop(1, 'rgba(255,255,255,0.75)');
    c.strokeStyle = tail; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - 70, y - 35); c.lineTo(x, y); c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = '#fff';
    this.star4(x, y, 6);
  }
  private weather(g: Hollow) {
    const c = this.c, w = g.weather;
    if (w === 'clear') return;
    if (w === 'rain') {
      c.strokeStyle = 'rgba(190,215,240,0.55)';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 110; i++) {
        const sx = (i * 197 + this.time * 420) % VIEW_W, sy = (i * 131 + this.time * 780) % VIEW_H;
        c.moveTo(sx, sy); c.lineTo(sx - 3, sy + 13);
      }
      c.stroke();
      c.lineCap = 'butt';
      c.fillStyle = 'rgba(42,58,80,0.1)';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 90; i++) {
        const sx = (i * 197 + this.time * 40 + Math.sin(this.time + i) * 14) % VIEW_W, sy = (i * 131 + this.time * 90) % VIEW_H;
        c.beginPath(); c.arc(sx, sy, 1.6 + (i % 3), 0, Math.PI * 2); c.fill();
      }
    }
  }
  private light(g: Hollow) {
    const h = g.hour;
    let a = 0, tint = '#101a3a';
    if (h < 5) a = 0.55; else if (h < 7) a = 0.55 * (1 - (h - 5) / 2); else if (h >= 17 && h < 19) { a = 0.25 * ((h - 17) / 2); tint = '#7a3a2a'; } else if (h >= 19 && h < 21) a = 0.25 + 0.3 * ((h - 19) / 2); else if (h >= 21) a = 0.55;
    if (a <= 0) return;
    this.c.fillStyle = tint;
    this.c.globalAlpha = a;
    this.c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.c.globalAlpha = 1;
  }
  /** A warm wash and a soft vignette, so the frame reads as one picture. */
  private grade() {
    const c = this.c;
    c.globalCompositeOperation = 'overlay';
    c.fillStyle = 'rgba(255,214,150,0.09)';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.globalCompositeOperation = 'source-over';
    const v = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.55, VIEW_W / 2, VIEW_H / 2, VIEW_H * 1.05);
    v.addColorStop(0, 'rgba(30,22,14,0)');
    v.addColorStop(1, 'rgba(30,22,14,0.19)');
    c.fillStyle = v;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
