// Canvas 2D view of Dusty Hollow: a soft top-down village that follows the hero.
import { Hollow, W, H, BUILDINGS, FACE, BUGS, type Terrain, type Season } from './dusty-hollow-game';

export const TILE = 44;
export const VIEW_W = 960;
export const VIEW_H = 600;

const GRASS: Record<Season, [string, string]> = { spring: ['#86bb66', '#82b762'], summer: ['#78b356', '#74af52'], autumn: ['#b4a558', '#afa054'], winter: ['#e4eaed', '#e0e7ea'] };
const TREE: Record<Season, [string, string]> = { spring: ['#4f9a4a', '#3f8140'], summer: ['#3f8f43', '#357a39'], autumn: ['#d98a3c', '#b96a2c'], winter: ['#7c8b80', '#657468'] };
const FRUIT_COLOR: Record<string, string> = { apple: '#e04c3a', pear: '#c9d35a', peach: '#f2a36c', cherry: '#b8203a', orange: '#f09a2c' };
const FLOWER_COLOR: Record<string, string> = { red: '#e2413c', yellow: '#f2d54a', white: '#fbf8f0', orange: '#f28c2c', pink: '#f4a3c4', purple: '#9a6cd6', blue: '#5b8de6' };
const BUG_COLOR: Record<string, string> = { butterfly: '#f0c04a', swallowtail: '#3f3a4a', bee: '#f2b830', ladybug: '#e0392f', grasshopper: '#6fbf4a', cricket: '#5a4a3a', firefly: '#f6f08a', dragonfly: '#5fc1d9', cicada: '#8a6f4a', moth: '#cbbfa5', stag: '#2f2a2a', snail: '#b89c6a' };
const SPECIES_BODY: Record<string, string> = { dora: '#f2ede4', enzo: '#8e8f98', flamingo: '#f39ab5', fox: '#d9873c', viscacha: '#b7a58c', condor: '#4a4750' };

export type Camera = { x: number; y: number };

export class HollowScene {
  c: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0 };
  time = 0;
  constructor(canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.c = canvas.getContext('2d')!;
  }

  draw(g: Hollow, dt: number) {
    this.time += dt;
    const c = this.c;
    const tx = Math.max(0, Math.min(W * TILE - VIEW_W, g.x * TILE - VIEW_W / 2));
    const ty = Math.max(0, Math.min(H * TILE - VIEW_H, g.y * TILE - VIEW_H / 2));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, VIEW_W, VIEW_H);
    c.translate(-Math.round(this.cam.x), -Math.round(this.cam.y));
    const x0 = Math.floor(this.cam.x / TILE), y0 = Math.floor(this.cam.y / TILE);
    const x1 = Math.min(W, x0 + Math.ceil(VIEW_W / TILE) + 1), y1 = Math.min(H, y0 + Math.ceil(VIEW_H / TILE) + 1);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.tile(g, x, y);
    for (const f of g.fossils) this.fossil(f.x, f.y);
    for (const f of g.flowers) this.flower(f.x, f.y, f.color, f.watered);
    for (const b of BUILDINGS) this.building(g, b);
    const sprites: { y: number; draw: () => void }[] = [];
    for (const t of g.trees) sprites.push({ y: t.y + 0.5, draw: () => this.tree(g, t.x, t.y, t.fruit, t.count, t.grown > 0) });
    for (const r of g.rocks) sprites.push({ y: r.y + 0.4, draw: () => this.rock(r.x, r.y, r.hits) });
    if (g.villagersOut) for (const v of g.villagers) sprites.push({ y: v.y, draw: () => this.critter(v.x, v.y, SPECIES_BODY[v.species] ?? v.color, v.species, v.facing, false, v.name, g.requests.some((r) => r.villager === v.id && !r.done)) });
    sprites.push({ y: g.y, draw: () => this.critter(g.x, g.y, SPECIES_BODY[g.hero], g.hero, g.facing, g.moving, '', false, g.tool) });
    sprites.sort((a, b) => a.y - b.y).forEach((s) => s.draw());
    for (const b of g.bugs) this.bug(b.x, b.y, b.id);
    if (g.fishing) this.bobber(g.fishing.x, g.fishing.y, g.fishing.bite > 0);
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.weather(g);
    this.light(g);
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
    // door and windows
    const dx = b.door[0] * TILE + 8;
    c.fillStyle = '#5a3a22';
    c.fillRect(dx, py + h - 26, TILE - 16, 26);
    c.fillStyle = trim;
    c.fillRect(px + 8, py + h * 0.5, 12, 12);
    c.fillRect(px + w - 20, py + h * 0.5, 12, 12);
    const lit = g.isNight && (b.id === 'shop' ? g.shopOpen : true);
    if (lit) { c.fillStyle = '#ffd27a'; c.fillRect(px + 9, py + h * 0.5 + 1, 10, 10); c.fillRect(px + w - 19, py + h * 0.5 + 1, 10, 10); }
    c.fillStyle = '#2b2118';
    c.font = 'bold 11px Arial';
    c.textAlign = 'center';
    c.fillText(b.id === 'home' ? `${g.heroName}’s ${g.homeName}` : b.name, px + w / 2, py + h * 0.35 + 14);
  }
  private tree(g: Hollow, x: number, y: number, fruit: string, count: number, sapling: boolean) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2, s = g.season;
    c.fillStyle = '#00000022';
    c.beginPath(); c.ellipse(px, py + 16, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a4d2b';
    c.fillRect(px - 4, py, 8, sapling ? 10 : 18);
    const r = sapling ? 9 : 18;
    c.fillStyle = TREE[s][1];
    c.beginPath(); c.arc(px, py - 4, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = TREE[s][0];
    c.beginPath(); c.arc(px - 4, py - 9, r * 0.75, 0, Math.PI * 2); c.fill();
    if (!sapling && count > 0) {
      c.fillStyle = FRUIT_COLOR[fruit] ?? '#e04c3a';
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
  private bug(x: number, y: number, id: string) {
    const c = this.c, px = x * TILE, py = y * TILE + Math.sin(this.time * 6 + x) * 2;
    const flying = ['butterfly', 'swallowtail', 'bee', 'firefly', 'dragonfly', 'moth'].includes(id);
    c.fillStyle = BUG_COLOR[id] ?? '#333';
    if (flying) {
      const f = Math.sin(this.time * 18) * 3;
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
    const name = BUGS.find((b) => b.id === id)?.name ?? id;
    c.fillStyle = '#ffffffcc';
    c.font = '9px Arial';
    c.textAlign = 'center';
    c.fillText(name, px, py - 8);
  }
  private bobber(x: number, y: number, biting: boolean) {
    const c = this.c, px = x * TILE + TILE / 2, py = y * TILE + TILE / 2 + (biting ? 5 : Math.sin(this.time * 3) * 2);
    c.strokeStyle = '#ffffffaa';
    c.beginPath(); c.arc(px, py, biting ? 14 : 9 + Math.sin(this.time * 2) * 2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = biting ? '#ffdd55' : '#e0392f';
    c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(px, py - 2, 2, 0, Math.PI * 2); c.fill();
    if (biting) { c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.textAlign = 'center'; c.fillText('!', px, py - 14); }
  }
  /** A chinchilla, or one of the neighbours, drawn from a few soft shapes. */
  private critter(x: number, y: number, body: string, species: string, facing: number, moving: boolean, label: string, wants: boolean, tool?: string) {
    const c = this.c, px = x * TILE, py = y * TILE, bob = moving ? Math.abs(Math.sin(this.time * 12)) * 3 : 0;
    c.fillStyle = '#00000022';
    c.beginPath(); c.ellipse(px, py + 14, 12, 4, 0, 0, Math.PI * 2); c.fill();
    const tall = species === 'flamingo' || species === 'condor';
    c.fillStyle = body;
    c.beginPath(); c.ellipse(px, py + 2 - bob, 12, tall ? 15 : 12, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(px, py - 10 - bob - (tall ? 6 : 0), 10, 0, Math.PI * 2); c.fill();
    const hy = py - 10 - bob - (tall ? 6 : 0);
    if (species === 'dora' || species === 'enzo' || species === 'viscacha') {
      c.beginPath(); c.ellipse(px - 8, hy - 8, 5, 7, -0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + 8, hy - 8, 5, 7, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2b8c0';
      c.beginPath(); c.ellipse(px - 8, hy - 8, 2.5, 4, -0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(px + 8, hy - 8, 2.5, 4, 0.3, 0, Math.PI * 2); c.fill();
    } else if (species === 'fox') {
      c.beginPath(); c.moveTo(px - 10, hy - 4); c.lineTo(px - 7, hy - 16); c.lineTo(px - 2, hy - 6); c.fill();
      c.beginPath(); c.moveTo(px + 10, hy - 4); c.lineTo(px + 7, hy - 16); c.lineTo(px + 2, hy - 6); c.fill();
    } else {
      c.fillStyle = species === 'flamingo' ? '#3a2a2a' : '#e8b04a';
      c.beginPath(); c.moveTo(px + (facing === 3 ? -8 : 8), hy + 1); c.lineTo(px + (facing === 3 ? -16 : 16), hy + 4); c.lineTo(px + (facing === 3 ? -8 : 8), hy + 5); c.fill();
    }
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
    if (label) {
      c.fillStyle = '#ffffffdd';
      c.font = 'bold 10px Arial';
      c.textAlign = 'center';
      c.fillText(label, px, hy - (species === 'dora' || species === 'enzo' || species === 'viscacha' ? 20 : 16));
    }
    if (wants) { c.fillStyle = '#ffd94a'; c.font = 'bold 14px Arial'; c.textAlign = 'center'; c.fillText('…', px + 14, hy - 12); }
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
