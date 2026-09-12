// Canvas 2D view of Dusty Hollow: a soft top-down village that follows the hero.
import { Hollow, W, H, BUILDINGS, BOARD, FACE, BUGS, NEIGHBOURS, type Terrain, type Season } from './dusty-hollow-game';

/** Every world pixel is drawn PIXEL screen pixels wide, so the village reads as pixel art. */
export const PIXEL = 3;
export const TILE = 45;
export const VIEW_W = 960;
export const VIEW_H = 600;
/** The low-resolution buffer the world is painted into before it is blown up. */
export const BUF_W = VIEW_W / PIXEL;
export const BUF_H = VIEW_H / PIXEL;

const GRASS: Record<Season, [string, string]> = { spring: ['#86bb66', '#82b762'], summer: ['#78b356', '#74af52'], autumn: ['#b4a558', '#afa054'], winter: ['#e4eaed', '#e0e7ea'] };
const TREE: Record<Season, [string, string]> = { spring: ['#4f9a4a', '#3f8140'], summer: ['#3f8f43', '#357a39'], autumn: ['#d98a3c', '#b96a2c'], winter: ['#7c8b80', '#657468'] };
const FRUIT_COLOR: Record<string, string> = { apple: '#e04c3a', pear: '#c9d35a', peach: '#f2a36c', cherry: '#b8203a', orange: '#f09a2c', golden: '#ffd94a' };
const FLOWER_COLOR: Record<string, string> = { red: '#e2413c', yellow: '#f2d54a', white: '#fbf8f0', orange: '#f28c2c', pink: '#f4a3c4', purple: '#9a6cd6', blue: '#5b8de6' };
const BUG_COLOR: Record<string, string> = { butterfly: '#f0c04a', swallowtail: '#3f3a4a', bee: '#f2b830', ladybug: '#e0392f', grasshopper: '#6fbf4a', cricket: '#5a4a3a', firefly: '#f6f08a', dragonfly: '#5fc1d9', cicada: '#8a6f4a', moth: '#cbbfa5', stag: '#2f2a2a', snail: '#b89c6a', wintermoth: '#e8e4d8', snowflea: '#3a3a44' };
const FLYING = ['butterfly', 'swallowtail', 'bee', 'firefly', 'dragonfly', 'moth', 'wintermoth'];
const SPECIES_BODY: Record<string, string> = { dora: '#f2ede4', enzo: '#8e8f98', flamingo: '#f39ab5', fox: '#d9873c', viscacha: '#b7a58c', condor: '#4a4750', llama: '#e8dcc2', cat: '#8a7f73' };
const EARED = ['dora', 'enzo', 'viscacha', 'cat', 'llama'];

export type Camera = { x: number; y: number };

type Label = { text: string; x: number; y: number; font: string; color: string; align: CanvasTextAlign };

export class HollowScene {
  /** The low-resolution world buffer everything but text is painted into. */
  c: CanvasRenderingContext2D;
  /** The visible canvas: the upscaled world, then crisp text on top. */
  out: CanvasRenderingContext2D;
  buffer: HTMLCanvasElement;
  cam: Camera = { x: 0, y: 0 };
  time = 0;
  /** World-space text, collected while painting and drawn at full resolution after the blit. */
  private labels: Label[] = [];
  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.out = canvas.getContext('2d')!;
    this.out.imageSmoothingEnabled = false;
    this.buffer = document.createElement('canvas');
    this.buffer.width = BUF_W;
    this.buffer.height = BUF_H;
    this.c = this.buffer.getContext('2d')!;
  }
  /** Queue world-space text; pixellating letters would only make them unreadable. */
  private label(text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
    this.labels.push({ text, x, y, font, color, align });
  }

  draw(g: Hollow, dt: number) {
    this.time += dt;
    const c = this.c;
    const tx = Math.max(0, Math.min(W * TILE - VIEW_W, g.x * TILE - VIEW_W / 2));
    const ty = Math.max(0, Math.min(H * TILE - VIEW_H, g.y * TILE - VIEW_H / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    // Snap the camera to whole screen pixels so the pixel grid never crawls.
    const camX = Math.round(this.cam.x / PIXEL) * PIXEL, camY = Math.round(this.cam.y / PIXEL) * PIXEL;
    this.labels.length = 0;
    c.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    c.translate(-camX, -camY);
    const x0 = Math.floor(this.cam.x / TILE), y0 = Math.floor(this.cam.y / TILE);
    const x1 = Math.min(W, x0 + Math.ceil(VIEW_W / TILE) + 1), y1 = Math.min(H, y0 + Math.ceil(VIEW_H / TILE) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.tile(g, x, y);
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
    for (const v of g.residents) if (g.out(v)) sprites.push({ y: v.y, draw: () => this.critter(v.x, v.y, SPECIES_BODY[v.species] ?? v.color, v.species, v.facing, false, v.name, g.requests.some((r) => r.villager === v.id && !r.done), undefined, g.isBirthday(v.id)) });
    sprites.push({ y: g.y, draw: () => this.critter(g.x, g.y, SPECIES_BODY[g.hero], g.hero, g.facing, g.moving, '', false, g.tool, false, g.sneaking) });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    for (const b of g.bugs) this.bug(b.x, b.y, b.id, b.fleeing);
    if (g.fishing) this.fishing(g);
    for (const e of g.effects) this.effect(e.kind, e.x, e.y, e.age, e.color);
    if (g.reaction) this.reaction(g.x, g.y, g.reaction.icon, g.reaction.age);
    if (g.balloon) this.balloon(g.balloon.x, g.balloon.y, g.balloonInReach);
    c.setTransform(1 / PIXEL, 0, 0, 1 / PIXEL, 0, 0);
    this.weather(g);
    this.light(g);
    if (g.star > 0) this.shootingStar(g.star);
    // Blow the world up with hard edges, then lay crisp text over it.
    const o = this.out;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, VIEW_W, VIEW_H);
    o.imageSmoothingEnabled = false;
    o.drawImage(this.buffer, 0, 0, BUF_W, BUF_H, 0, 0, VIEW_W, VIEW_H);
    o.save();
    o.translate(-camX, -camY);
    for (const l of this.labels) {
      o.font = l.font; o.textAlign = l.align; o.fillStyle = l.color;
      o.fillText(l.text, l.x, l.y);
    }
    o.restore();
    if (g.fishing?.phase === 'reel') this.reelBar(g.fishing.progress, g.fishing.tension);
    if (g.splash) this.titleCard(g.splash.text, g.splash.age);
  }
  /** A present under a balloon, drifting a few tiles above the ground; its shadow shows where it is. */
  private balloon(x: number, y: number, near: boolean) {
    const c = this.c, px = x * TILE, py = y * TILE - 70 + Math.sin(this.time * 1.5) * 4;
    c.fillStyle = '#00000018';
    c.beginPath(); c.ellipse(px, y * TILE + 14, 12, 4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a3a22'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(px - 6, py + 18); c.lineTo(px, py + 30); c.lineTo(px + 6, py + 18); c.stroke();
    c.fillStyle = '#f0cd6b';
    c.fillRect(px - 8, py + 30, 16, 14);
    c.fillStyle = '#e2413c';
    c.fillRect(px - 1.5, py + 30, 3, 14); c.fillRect(px - 8, py + 35, 16, 3);
    c.fillStyle = near ? '#f4a3c4' : '#e8748e';
    c.beginPath(); c.ellipse(px, py, 14, 17, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff66';
    c.beginPath(); c.ellipse(px - 5, py - 6, 4, 6, -0.4, 0, Math.PI * 2); c.fill();
    if (near) this.label('throw!', px, py - 24, 'bold 12px Arial', '#fff');
  }
  /** The season title card: a soft band across the middle that fades in and out. */
  private titleCard(text: string, left: number) {
    const c = this.out, a = Math.min(1, left, (4 - left) * 2);
    c.globalAlpha = a * 0.85;
    c.fillStyle = '#34302a';
    c.fillRect(0, VIEW_H / 2 - 44, VIEW_W, 88);
    c.globalAlpha = a;
    c.fillStyle = '#fffaf0';
    c.font = 'bold 40px Georgia, serif';
    c.textAlign = 'center';
    c.fillText(text, VIEW_W / 2, VIEW_H / 2 + 14);
    c.globalAlpha = 1;
  }

  private tile(g: Hollow, x: number, y: number) {
    const c = this.c, t: Terrain = g.tileAt(x, y), px = x * TILE, py = y * TILE, alt = (x + y) & 1;
    const s = g.season;
    if (t === 'grass') c.fillStyle = GRASS[s][alt];
    else if (t === 'path') c.fillStyle = alt ? '#d8c299' : '#d5bf95';
    else if (t === 'sand') c.fillStyle = alt ? '#ece0b4' : '#e6d9a9';
    else if (t === 'cliff') c.fillStyle = alt ? '#6f6a63' : '#666159';
    else if (t === 'bridge') c.fillStyle = '#a8763f';
    else c.fillStyle = alt ? '#5ba0cd' : '#589dca';
    c.fillRect(px, py, TILE, TILE);
    if (t === 'water') {
      const w = Math.sin(this.time * 2 + x * 1.3 + y * 0.7) * 3;
      c.fillStyle = '#ffffff33';
      c.fillRect(px + 8 + w, py + 14 + ((x * 7) % 12), 14, 2);
      c.fillRect(px + 24 - w, py + 30 - ((y * 5) % 10), 10, 2);
      if (y === H - 3) { c.fillStyle = '#ffffff66'; c.fillRect(px, py + 2 + Math.sin(this.time * 1.5 + x) * 2, TILE, 3); }
    } else if (t === 'bridge') {
      c.fillStyle = '#7d5429';
      for (let i = 0; i < 4; i++) c.fillRect(px, py + i * 11 + 4, TILE, 2);
    } else if (t === 'grass' && s !== 'winter' && (x * 31 + y * 17) % 5 === 0) {
      c.fillStyle = GRASS[s][1 - alt];
      c.fillRect(px + 10, py + 22, 3, 8);
      c.fillRect(px + 26, py + 12, 3, 8);
    } else if (t === 'cliff') {
      c.fillStyle = '#7f7a72';
      c.fillRect(px + 6, py + 8, 12, 5);
      c.fillRect(px + 24, py + 26, 12, 5);
    }
  }
  private building(g: Hollow, b: (typeof BUILDINGS)[number]) {
    const c = this.c, px = b.x * TILE, py = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
    const owner = NEIGHBOURS.find((v) => v.home === b.id);
    if (owner?.arrives && !g.arrived.includes(owner.id)) {
      c.fillStyle = '#c9b48a55';
      c.fillRect(px, py, w, h);
      c.strokeStyle = '#8f5a34'; c.lineWidth = 2; c.setLineDash([6, 6]); c.strokeRect(px + 2, py + 2, w - 4, h - 4); c.setLineDash([]);
      c.fillStyle = '#f6e6c8'; c.fillRect(px + w / 2 - 22, py + h / 2 - 10, 44, 18);
      c.fillStyle = '#7a4d2b'; c.fillRect(px + w / 2 - 2, py + h / 2 + 8, 4, 12);
      this.label('FOR SALE', px + w / 2, py + h / 2 + 3, 'bold 9px Arial', '#2b2118');
      return;
    }
    const palette: Record<string, [string, string, string]> = { home: ['#c98a5a', '#8f5a34', '#f6e6c8'], friend: ['#b98d64', '#7c5a3c', '#f4dcbb'], shop: ['#d76f5c', '#8b3d31', '#f7dfc8'], museum: ['#8d9aa8', '#4f5b68', '#e9eef2'] };
    const [wall, roof, trim] = palette[b.id] ?? ['#c9a37a', '#7f6446', '#f2e6d0'];
    c.fillStyle = '#00000022';
    c.fillRect(px + 4, py + h - 6, w - 4, 10);
    c.fillStyle = wall;
    c.fillRect(px, py + h * 0.35, w, h * 0.65);
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(px - 6, py + h * 0.4);
    c.lineTo(px + w / 2, py - 6);
    c.lineTo(px + w + 6, py + h * 0.4);
    c.closePath();
    c.fill();
    if (b.id === 'home' && g.homeLevel > 0) { c.fillStyle = trim; c.fillRect(px + 6, py + h * 0.42, w - 12, 4); }
    if (b.id === 'home' && g.homeLevel === 0) { c.fillStyle = '#e8c56d'; c.beginPath(); c.moveTo(px + 4, py + h); c.lineTo(px + w / 2, py + 6); c.lineTo(px + w - 4, py + h); c.closePath(); c.fill(); }
    if (b.id === 'home' && g.homeLevel >= 2) { c.fillStyle = '#7a4d2b'; c.fillRect(px + w - 22, py - 2, 8, 16); }
    const dx = b.door[0] * TILE + 8;
    c.fillStyle = '#5a3a22';
    c.fillRect(dx, py + h - 26, TILE - 16, 26);
    c.fillStyle = trim;
    c.fillRect(px + 8, py + h * 0.5, 12, 12);
    c.fillRect(px + w - 20, py + h * 0.5, 12, 12);
    const lit = g.isNight && (b.id === 'shop' ? g.shopOpen : true);
    if (lit) { c.fillStyle = '#ffd27a'; c.fillRect(px + 9, py + h * 0.5 + 1, 10, 10); c.fillRect(px + w - 19, py + h * 0.5 + 1, 10, 10); }
    if (owner && g.isBirthday(owner.id)) { c.fillStyle = '#f4a3c4'; c.beginPath(); c.arc(px + 6, py + h * 0.38, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5b8de6'; c.beginPath(); c.arc(px + w - 6, py + h * 0.38, 5, 0, Math.PI * 2); c.fill(); }
    this.label(b.id === 'home' ? g.houseName : b.name, px + w / 2, py + h * 0.35 + 14, 'bold 11px Arial', '#2b2118');
  }
  private board() {
    const c = this.c, px = BOARD.x * TILE + TILE / 2, py = BOARD.y * TILE + TILE / 2;
    c.fillStyle = '#7a4d2b';
    c.fillRect(px - 3, py - 2, 6, 20);
    c.fillStyle = '#b98d64';
    c.fillRect(px - 16, py - 20, 32, 22);
    c.fillStyle = '#fffaf0';
    c.fillRect(px - 12, py - 16, 10, 7); c.fillRect(px + 1, py - 15, 10, 9); c.fillRect(px - 11, py - 7, 12, 6);
  }
  private tree(g: Hollow, x: number, y: number, fruit: string, count: number, sapling: boolean, golden = false) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2, s = g.season;
    if (golden && !sapling) { c.fillStyle = '#ffd94a33'; c.beginPath(); c.arc(px, py - 6, 26 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#00000022';
    c.beginPath(); c.ellipse(px, py + 16, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a4d2b';
    c.fillRect(px - 4, py, 8, sapling ? 10 : 18);
    const r = sapling ? 9 : 18;
    c.fillStyle = golden && !sapling ? '#c9a227' : TREE[s][1];
    c.beginPath(); c.arc(px, py - 4, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = golden && !sapling ? '#e8c34a' : TREE[s][0];
    c.beginPath(); c.arc(px - 4, py - 9, r * 0.75, 0, Math.PI * 2); c.fill();
    if (s === 'winter' && !sapling) { c.fillStyle = '#ffffffaa'; c.beginPath(); c.arc(px - 2, py - 14, r * 0.6, Math.PI, 0); c.fill(); }
    if (!sapling && count > 0) {
      c.fillStyle = golden ? FRUIT_COLOR.golden : FRUIT_COLOR[fruit] ?? '#e04c3a';
      const spots = [[-9, -4], [6, -10], [8, 2]];
      for (let i = 0; i < count; i++) { c.beginPath(); c.arc(px + spots[i][0], py + spots[i][1], 3.5, 0, Math.PI * 2); c.fill(); }
    }
  }
  private rock(x: number, y: number, hits: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = '#00000022';
    c.beginPath(); c.ellipse(px, py + 12, 15, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = hits >= 4 ? '#8a857d' : '#9a948b';
    c.beginPath(); c.ellipse(px, py + 2, 15, 12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b3ada3';
    c.beginPath(); c.ellipse(px - 4, py - 3, 7, 5, 0, 0, Math.PI * 2); c.fill();
  }
  private snowball(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = '#00000018'; c.beginPath(); c.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fbfdff'; c.beginPath(); c.arc(px, py + 2, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#dbe6ee'; c.beginPath(); c.arc(px + 3, py + 5, 4, 0, Math.PI * 2); c.fill();
  }
  private snowman(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = '#00000022'; c.beginPath(); c.ellipse(px, py + 16, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fbfdff';
    c.beginPath(); c.arc(px, py + 4, 13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px, py - 14, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a2420';
    c.beginPath(); c.arc(px - 3, py - 16, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px + 3, py - 16, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f09a2c'; c.beginPath(); c.moveTo(px, py - 13); c.lineTo(px + 9, py - 11); c.lineTo(px, py - 10); c.fill();
    c.fillStyle = '#e04c3a'; c.fillRect(px - 8, py - 6, 16, 3);
  }
  private flower(x: number, y: number, color: string, watered: boolean) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = '#3f8140';
    c.fillRect(px - 1, py, 2, 12);
    c.fillStyle = FLOWER_COLOR[color];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + this.time * 0.3; c.beginPath(); c.arc(px + Math.cos(a) * 5, py - 2 + Math.sin(a) * 5, 3.5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#f7e06a';
    c.beginPath(); c.arc(px, py - 2, 2.5, 0, Math.PI * 2); c.fill();
    if (watered) { c.fillStyle = '#5da2cf88'; c.beginPath(); c.arc(px + 9, py + 10, 3, 0, Math.PI * 2); c.fill(); }
  }
  private fossil(x: number, y: number) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.strokeStyle = '#5a4a3a';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(px - 10, py - 4); c.lineTo(px - 2, py + 2); c.lineTo(px + 6, py - 6); c.moveTo(px - 2, py + 2); c.lineTo(px + 2, py + 10); c.stroke();
  }
  private shell(x: number, y: number, id: string) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
    c.fillStyle = id === 'conch' ? '#f2b8a0' : id === 'sanddollar' ? '#efe3c2' : '#fbf5e6';
    c.beginPath();
    if (id === 'sanddollar') c.arc(px, py, 6, 0, Math.PI * 2);
    else { c.moveTo(px - 7, py + 4); c.quadraticCurveTo(px, py - 10, px + 7, py + 4); c.closePath(); }
    c.fill();
    c.strokeStyle = '#c9a37a'; c.lineWidth = 1; c.stroke();
  }
  private bug(x: number, y: number, id: string, fleeing: boolean) {
    const c = this.c, px = x * TILE, py = y * TILE + Math.sin(this.time * 6 + x) * 2 - (fleeing ? 10 : 0);
    const flying = FLYING.includes(id) || fleeing;
    c.fillStyle = BUG_COLOR[id] ?? '#333';
    if (flying) {
      const f = Math.abs(Math.sin(this.time * 18)) * 3;
      c.beginPath(); c.ellipse(px - 4, py, 4, 2.5 + f, -0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + 4, py, 4, 2.5 + f, 0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2420';
      c.fillRect(px - 1, py - 3, 2, 6);
    } else {
      c.beginPath(); c.ellipse(px, py, 5, 3.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2420';
      c.beginPath(); c.arc(px + 4, py, 2, 0, Math.PI * 2); c.fill();
    }
    if (id === 'firefly') { c.fillStyle = '#f6f08a55'; c.beginPath(); c.arc(px, py, 9, 0, Math.PI * 2); c.fill(); }
    if (fleeing) return;
    this.label(BUGS.find((b) => b.id === id)?.name ?? id, px, py - 8, '9px Arial', '#ffffffdd');
  }
  private fishing(g: Hollow) {
    const f = g.fishing!;
    const c = this.c, px = f.x * TILE + TILE / 2, py = f.y * TILE + TILE / 2;
    const biting = f.phase === 'bite', nibbling = f.phase === 'nibble', reeling = f.phase === 'reel';
    // The shadow hints at the size of what is down there.
    const drift = reeling ? 0 : Math.sin(this.time * 1.2) * 6;
    c.fillStyle = '#1d3f5a66';
    c.beginPath(); c.ellipse(px + drift + (reeling ? 0 : 10), py + 8, 6 + f.size * 4, 3 + f.size * 1.5, 0.2, 0, Math.PI * 2); c.fill();
    const by = py + (biting ? 6 : nibbling ? 3 : Math.sin(this.time * 3) * 2);
    c.strokeStyle = '#ffffffaa';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(px, by, biting ? 14 : nibbling ? 11 : 9 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2); c.stroke();
    if (!reeling) {
      c.fillStyle = biting ? '#ffdd55' : '#e0392f';
      c.beginPath(); c.arc(px, by, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(px, by - 2, 2, 0, Math.PI * 2); c.fill();
    }
    if (biting) this.label('!', px, py - 16, 'bold 16px Arial', '#fff');
    // Line from the hero's rod tip.
    const [dx, dy] = FACE[g.facing];
    c.strokeStyle = '#ffffffcc';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(g.x * TILE + dx * 24, g.y * TILE - 12 + dy * 8); c.lineTo(px, by - 4); c.stroke();
  }
  private reelBar(progress: number, tension: number) {
    const c = this.out, w = 260, x = VIEW_W / 2 - w / 2, y = VIEW_H - 78;
    c.fillStyle = '#34302ae6';
    c.beginPath(); c.roundRect(x - 12, y - 12, w + 24, 62, 10); c.fill();
    c.fillStyle = '#fffaf0'; c.font = 'bold 11px Arial'; c.textAlign = 'left';
    c.fillText('REEL', x, y);
    c.fillText('LINE', x, y + 28);
    c.fillStyle = '#5a5550'; c.fillRect(x + 40, y - 9, w - 40, 10); c.fillRect(x + 40, y + 19, w - 40, 10);
    c.fillStyle = '#7fd0b8'; c.fillRect(x + 40, y - 9, (w - 40) * Math.min(1, progress), 10);
    c.fillStyle = tension > 0.75 ? '#e0392f' : tension > 0.5 ? '#f0cd6b' : '#8cc06a'; c.fillRect(x + 40, y + 19, (w - 40) * Math.min(1, tension), 10);
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
      c.fillRect(px - 7, py - 60 + t * 62, 14, 12);
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
    c.fillStyle = '#fffaf0'; c.beginPath(); c.roundRect(px - 12, py - 12, 24, 24, 8); c.fill();
    c.globalAlpha = 1;
    this.label(icon === '💦' ? '~' : icon, px, py + 5, 'bold 15px Arial', icon === '♥' ? '#e2413c' : icon === '★' ? '#f0cd6b' : icon === '💦' ? '#5da2cf' : '#34302a');
  }
  private shootingStar(left: number) {
    const c = this.c, t = 1 - left / 3;
    const x = VIEW_W * (0.15 + t * 0.7), y = 30 + t * 90;
    c.strokeStyle = '#fff8'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 60, y - 30); c.lineTo(x, y); c.stroke();
    c.fillStyle = '#fff';
    this.star4(x, y, 6);
  }
  /** A chinchilla, or one of the neighbours, drawn from a few soft shapes. */
  private critter(x: number, y: number, body: string, species: string, facing: number, moving: boolean, label: string, wants: boolean, tool?: string, birthday = false, sneaking = false) {
    const c = this.c, px = x * TILE, py = y * TILE + (sneaking ? 5 : 0), bob = moving ? Math.abs(Math.sin(this.time * (sneaking ? 6 : 12))) * (sneaking ? 1.5 : 3) : 0;
    c.fillStyle = '#00000022';
    c.beginPath(); c.ellipse(px, py + 14, 12, 4, 0, 0, Math.PI * 2); c.fill();
    const tall = species === 'flamingo' || species === 'condor' || species === 'llama';
    c.fillStyle = body;
    c.beginPath(); c.ellipse(px, py + 2 - bob, 12, tall ? 15 : 12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px, py - 10 - bob - (tall ? 6 : 0), 10, 0, Math.PI * 2); c.fill();
    const hy = py - 10 - bob - (tall ? 6 : 0);
    if (EARED.includes(species)) {
      const pointy = species === 'cat' || species === 'llama';
      if (pointy) {
        c.beginPath(); c.moveTo(px - 10, hy - 2); c.lineTo(px - 7, hy - 16); c.lineTo(px - 1, hy - 7); c.fill();
        c.beginPath(); c.moveTo(px + 10, hy - 2); c.lineTo(px + 7, hy - 16); c.lineTo(px + 1, hy - 7); c.fill();
      } else {
        c.beginPath(); c.ellipse(px - 8, hy - 8, 5, 7, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(px + 8, hy - 8, 5, 7, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f2b8c0';
        c.beginPath(); c.ellipse(px - 8, hy - 8, 2.5, 4, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(px + 8, hy - 8, 2.5, 4, 0.3, 0, Math.PI * 2); c.fill();
      }
    } else if (species === 'fox') {
      c.beginPath(); c.moveTo(px - 10, hy - 4); c.lineTo(px - 7, hy - 16); c.lineTo(px - 2, hy - 6); c.fill();
      c.beginPath(); c.moveTo(px + 10, hy - 4); c.lineTo(px + 7, hy - 16); c.lineTo(px + 2, hy - 6); c.fill();
    } else {
      c.fillStyle = species === 'flamingo' ? '#3a2a2a' : '#e8b04a';
      c.beginPath(); c.moveTo(px + (facing === 3 ? -8 : 8), hy + 1); c.lineTo(px + (facing === 3 ? -16 : 16), hy + 4); c.lineTo(px + (facing === 3 ? -8 : 8), hy + 5); c.fill();
    }
    if (species === 'cat') { c.fillStyle = '#5a5049'; c.fillRect(px - 9, hy + 2, 18, 2); }
    if (facing !== 0) {
      c.fillStyle = '#2a2420';
      const ex = facing === 1 ? 4 : facing === 3 ? -4 : 0;
      c.beginPath(); c.arc(px - 4 + ex, hy - 1, 1.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(px + 4 + ex, hy - 1, 1.8, 0, Math.PI * 2); c.fill();
    }
    if (tool && tool !== 'hands') {
      const [dx, dy] = FACE[facing];
      const hx = px + dx * 14, hyy = py + dy * 8 - bob;
      c.strokeStyle = '#5a3a22';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(px + dx * 6, py - bob); c.lineTo(hx + dx * 10, hyy - 10); c.stroke();
      c.fillStyle = tool === 'net' ? '#ffffff88' : tool === 'shovel' ? '#9a948b' : tool === 'can' ? '#5da2cf' : '#e0392f';
      c.beginPath(); c.arc(hx + dx * 10, hyy - 12, tool === 'net' ? 7 : 4, 0, Math.PI * 2); c.fill();
    }
    if (birthday) { c.fillStyle = '#f0cd6b'; c.beginPath(); c.moveTo(px - 7, hy - 8); c.lineTo(px, hy - 24); c.lineTo(px + 7, hy - 8); c.closePath(); c.fill(); }
    if (label) this.label(label, px, hy - (EARED.includes(species) || birthday ? 22 : 16), 'bold 10px Arial', '#ffffffdd');
    if (wants) this.label('…', px + 14, hy - 12, 'bold 14px Arial', '#ffd94a');
  }
  private weather(g: Hollow) {
    const c = this.c, w = g.weather;
    if (w === 'clear') return;
    c.fillStyle = w === 'rain' ? '#9fc4e6aa' : '#ffffffdd';
    for (let i = 0; i < 90; i++) {
      const sx = (i * 197 + this.time * (w === 'rain' ? 420 : 40)) % VIEW_W;
      const sy = (i * 131 + this.time * (w === 'rain' ? 780 : 90)) % VIEW_H;
      if (w === 'rain') c.fillRect(sx, sy, 1.5, 12); else { c.beginPath(); c.arc(sx, sy, 2.5, 0, Math.PI * 2); c.fill(); }
    }
    if (w === 'rain') { c.fillStyle = '#2a3a5011'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
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
}
