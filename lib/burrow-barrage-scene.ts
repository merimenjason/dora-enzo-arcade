// Burrow Barrage, drawing only. The Stage plays the engine's events back in order (shots, blasts, falls) and keeps its
// own copy of the ground, so a crater appears when its shot lands on screen and not the moment the engine works it out.
import { W, H, UNIT_UP, MAX_WIND, PATH_RATE, type Match, type Event, type RideId } from './burrow-barrage-game';
import { coatLike, drawChinchilla, type Coat } from './chinchilla-art';

export const CELL = 2, VIEW_W = W * CELL, VIEW_H = H * CELL;
type C2D = CanvasRenderingContext2D;
type RGB = [number, number, number];

const fur = (base: 'dora' | 'enzo', f: string, back: string, face: string, shade: string, over: Partial<Coat> = {}): Coat =>
  coatLike(base, { fur: f, back, face, shade, texture: shade, tail: f, tailOuter: back, tailInner: face, ...over });
const dark = { eye: '#0e0c12', pupil: '#000000', eyeR: 1.7 };
/** Dora and Enzo, then the six rival pairs of the ladder. */
const COAT: Record<string, Coat | 'dora' | 'enzo'> = {
  dora: 'dora', enzo: 'enzo',
  pip: fur('dora', '#eeeaf0', '#dad3df', '#f6f3f8', '#ccc4d2', dark),
  mora: fur('enzo', '#a9a7b0', '#8a8891', '#c4c2ca', '#96949d', { bands: false }),
  tumble: fur('dora', '#ecd6b3', '#d8bc90', '#f4e4cb', '#caa97e', dark),
  sprout: fur('enzo', '#8f9a6c', '#6c7650', '#a9b388', '#78825a', { bands: false }),
  ash: fur('enzo', '#5b5a63', '#3c3b43', '#75747d', '#48474f'),
  cinder: fur('dora', '#e9b08c', '#d18f68', '#f3c8ab', '#c98562', dark),
  gust: fur('dora', '#cfe2ee', '#abc6d8', '#e4f0f7', '#9fbccf', dark),
  breeze: fur('enzo', '#7f93a8', '#5d7187', '#9cafc2', '#687c92', { bands: false }),
  flint: fur('enzo', '#9a6a48', '#74492e', '#b58560', '#80553a', { belly: '#f1dfc8', line: '#2e1c14', bands: false }),
  slate: fur('enzo', '#62707a', '#44515a', '#7e8c96', '#4f5c66'),
  onyx: fur('enzo', '#34323a', '#1f1e24', '#4b4952', '#29282e', { belly: '#c9c5cc' }),
  opal: fur('dora', '#f1e6f4', '#dccbe3', '#f9f2fb', '#cdb9d6', { eye: '#3a5fa8', pupil: '#101c3a', eyeR: 1.7 }),
};
const TEAM = ['#ffcf5a', '#ff7a66'];
const RIDE_COLOR: Record<RideId, [string, string]> = { catapult: ['#c98a3c', '#7a4c1c'], spitter: ['#6fbf73', '#2f6b3c'], digger: ['#9aa3b5', '#4d5568'], cannon: ['#d9c7a8', '#8a7352'] };

type Theme = { sky: [string, string]; far: string; grass: string; under: string; soil: string; deep: string; mote: string };
/** One look per map, in the order of MAPS. */
const THEMES: Theme[] = [
  { sky: ['#7cc6f2', '#e8f6df'], far: '#a9d7a0', grass: '#86d15f', under: '#4f9a3d', soil: '#9a6b42', deep: '#7d5433', mote: '#ffffff' },
  { sky: ['#8fd0cb', '#eef5d6'], far: '#8fbf9a', grass: '#64b56f', under: '#3b8050', soil: '#6d5a44', deep: '#57463a', mote: '#f2ffe6' },
  { sky: ['#f3a877', '#fdebc9'], far: '#e0b47c', grass: '#d2bb5c', under: '#a08b3c', soil: '#a56c3f', deep: '#86532f', mote: '#fff3d6' },
  { sky: ['#7fb0ec', '#e2edf8'], far: '#b9c7da', grass: '#d8ad72', under: '#a97b45', soil: '#8b8f98', deep: '#6f737c', mote: '#ffffff' },
  { sky: ['#5f97e4', '#dcedff'], far: '#c6dcf5', grass: '#93dc8c', under: '#5cae62', soil: '#b08c6a', deep: '#8f6f52', mote: '#ffffff' },
  { sky: ['#565aa4', '#ebb9a6'], far: '#8d83b4', grass: '#e6e9f2', under: '#a9afc0', soil: '#5d6072', deep: '#4a4c5c', mote: '#ffe9df' },
];
const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

type Sprite = { id: number; x: number; y: number; hp: number; alive: boolean; fade: number; flash: number; fx: number; fy: number; tx: number; ty: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Float = { x: number; y: number; text: string; life: number; color: string };
/** What the page adds on top: the aiming guide for the unit whose turn it is, and how full the power bar is while charging. */
export type Overlay = { guide: number[] | null; charging: number };

function rideBody(c: C2D, ride: RideId, x: number, feet: number, team: number) {
  const [body, edge] = RIDE_COLOR[ride];
  c.lineWidth = 1.5; c.strokeStyle = edge; c.fillStyle = body;
  c.beginPath(); c.roundRect(x - 12, feet - 10, 24, 7, 3); c.fill(); c.stroke();
  c.fillStyle = TEAM[team]; c.fillRect(x - 10, feet - 9, 20, 2);
  for (const dx of [-7, 7]) { c.fillStyle = '#3a2f2a'; c.beginPath(); c.arc(x + dx, feet - 3, 3.2, 0, 7); c.fill(); c.fillStyle = '#c9b9a0'; c.beginPath(); c.arc(x + dx, feet - 3, 1.2, 0, 7); c.fill(); }
}
/** The weapon, swung to the aiming angle. */
function rideArm(c: C2D, ride: RideId, x: number, y: number, angle: number) {
  const [body, edge] = RIDE_COLOR[ride];
  c.save(); c.translate(x, y); c.rotate((-angle * Math.PI) / 180);
  c.strokeStyle = edge; c.fillStyle = body; c.lineWidth = 1.5; c.lineCap = 'round';
  if (ride === 'catapult') { c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(13, 0); c.stroke(); c.fillStyle = '#f0d46a'; c.fillRect(11, -3.5, 6, 7); c.strokeRect(11, -3.5, 6, 7); }
  else if (ride === 'spitter') { c.beginPath(); c.roundRect(0, -2.5, 16, 5, 2); c.fill(); c.stroke(); c.fillStyle = edge; c.fillRect(13, -3.5, 3, 7); }
  else if (ride === 'digger') { c.beginPath(); c.moveTo(0, -4); c.lineTo(9, -4); c.lineTo(18, 0); c.lineTo(9, 4); c.lineTo(0, 4); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(9, -4); c.lineTo(9, 4); c.stroke(); }
  else { c.beginPath(); c.moveTo(0, -3); c.lineTo(11, -3); c.lineTo(17, -6.5); c.lineTo(17, 6.5); c.lineTo(11, 3); c.lineTo(0, 3); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function drawUnit(c: C2D, coat: string, ride: RideId, team: number, x: number, feet: number, angle: number, time: number, o: { dizzy?: boolean; moving?: boolean } = {}) {
  const face = angle <= 90 ? 1 : -1;
  drawChinchilla(c, COAT[coat] ?? 'dora', x - face * 2, feet - 8, { face, h: 21, time, blink: time % 4 < 0.14, dizzy: o.dizzy });
  rideBody(c, ride, x, feet, team);
  rideArm(c, ride, x + face * 3, feet - 13, angle);
}
/** A chinchilla on its ride, for the menu. */
export function drawRideIcon(c: C2D, coat: string, ride: RideId, team: number, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h * 0.9); c.scale(w / 44, w / 44);
  drawUnit(c, coat, ride, team, 0, 0, team === 0 ? 40 : 140, 0.4);
  c.restore();
}
function drawBall(c: C2D, ride: RideId, shot: number, marker: boolean, x: number, y: number, spin: number) {
  c.save(); c.translate(x, y);
  if (marker) { c.fillStyle = '#ff8fc0'; c.strokeStyle = '#8a2a58'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 3.5, 0, 7); c.fill(); c.stroke(); c.restore(); return; }
  const big = shot === 1 || (ride === 'digger' && shot === 2) ? 1.25 : 1;
  c.scale(big, big); c.lineWidth = 1.2;
  if (ride === 'catapult') { c.rotate(spin * 6); c.fillStyle = '#f0d46a'; c.strokeStyle = '#9a7420'; c.fillRect(-4, -4, 8, 8); c.strokeRect(-4, -4, 8, 8); c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.stroke(); }
  else if (ride === 'spitter') { c.rotate(spin * 9); c.fillStyle = '#7a4c22'; c.beginPath(); c.ellipse(0, 0, 3.4, 2, 0, 0, 7); c.fill(); c.fillStyle = '#c99a5c'; c.beginPath(); c.ellipse(-0.6, -0.5, 1.4, 0.7, 0, 0, 7); c.fill(); }
  else if (ride === 'digger') { c.rotate(spin * 14); c.fillStyle = '#8b93a6'; c.strokeStyle = '#3c4354'; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -3.5); c.lineTo(-3, 3.5); c.closePath(); c.fill(); c.stroke(); }
  else { c.fillStyle = 'rgba(240, 228, 205, 0.9)'; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.arc(3, -2, 3, 0, 7); c.arc(-3, 1.5, 3, 0, 7); c.fill(); }
  c.restore();
}

export class Stage {
  ground: Uint8Array;
  sprites: Sprite[];
  wind = 0; activeId = 0; turn = 1;
  busy = false; speed = 1;
  sfx: (name: string) => void = () => {};
  private theme: Theme; private tones: RGB[];
  private land: HTMLCanvasElement; private img: ImageData;
  private queue: Event[] = []; private cur: Event | null = null; private t = 0; private dur = 0;
  private sparks: Spark[] = []; private floats: Float[] = [];
  private shake = 0; private banner = ''; private bannerLife = 0; private dusk = 0;

  constructor(m: Match) {
    this.theme = THEMES[m.map % THEMES.length];
    this.tones = [rgb(this.theme.grass), rgb(this.theme.under), rgb(this.theme.soil), rgb(this.theme.deep)];
    this.ground = m.terrain.slice();
    this.land = document.createElement('canvas'); this.land.width = W; this.land.height = H;
    this.img = new ImageData(W, H);
    this.paint(0, 0, W - 1, H - 1);
    this.sprites = m.units.map((u) => ({ id: u.id, x: u.x, y: u.y, hp: u.hp, alive: u.alive, fade: u.alive ? 0 : 1, flash: 0, fx: u.x, fy: u.y, tx: u.x, ty: u.y }));
    this.sync(m);
  }

  /** Repaints the ground picture inside a box of cells. */
  private paint(x0: number, y0: number, x1: number, y1: number) {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    if (x1 < x0 || y1 < y0) return;
    const d = this.img.data, g = this.ground;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = (y * W + x) * 4;
      if (!g[y * W + x]) { d[i + 3] = 0; continue; }
      const open = (k: number) => y - k < 0 || !g[(y - k) * W + x];
      const tone = open(1) ? 0 : open(2) || open(3) ? 1 : ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 11 < 2 ? 3 : 2, [r, gr, b] = this.tones[tone];
      const shade = tone >= 2 ? 1 - Math.min(0.22, (y / H) * 0.22) : 1;
      d[i] = r * shade; d[i + 1] = gr * shade; d[i + 2] = b * shade; d[i + 3] = 255;
    }
    this.land.getContext('2d')!.putImageData(this.img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
  private dig(circles: number[]) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let n = 0; n < circles.length; n += 3) {
      const cx = circles[n], cy = circles[n + 1], r = circles[n + 2];
      const ax = Math.max(0, Math.floor(cx - r)), bx = Math.min(W - 1, Math.ceil(cx + r)), ay = Math.max(0, Math.floor(cy - r)), by = Math.min(H - 1, Math.ceil(cy + r));
      for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.ground[y * W + x] = 0;
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
    // The grass line sits on the top three cells of any column, so repaint a little below the hole as well.
    this.paint(x0, y0, x1, y1 + 4);
  }
  private burst(x: number, y: number, n: number, colors: string[], power: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * power, life = 0.35 + Math.random() * 0.45;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.5, life, max: life, color: colors[i % colors.length], size: 1.5 + Math.random() * 2.5 });
    }
  }

  feed(events: Event[]) { this.queue.push(...events); if (this.queue.length) this.busy = true; }
  /** Copies where everything stands from the engine. Only safe when nothing is playing. */
  sync(m: Match) {
    for (const s of this.sprites) { const u = m.units[s.id]; s.x = s.fx = s.tx = u.x; s.y = s.fy = s.ty = u.y; s.hp = u.hp; s.alive = u.alive; if (!u.alive) s.fade = 1; }
    this.wind = m.wind; this.activeId = m.activeId; this.turn = m.turn;
  }
  /** Skips to the end of whatever is playing. */
  flush(m: Match) {
    this.queue.length = 0; this.cur = null; this.busy = false;
    this.ground = m.terrain.slice(); this.paint(0, 0, W - 1, H - 1);
    this.sync(m);
    // The banner may still name whoever's turn was skipped past.
    if (m.state === 'aim') { this.banner = `${m.active.name}’s turn`; this.bannerLife = 1.3; } else this.bannerLife = 0;
  }

  private begin(e: Event, m: Match) {
    this.cur = e; this.t = 0; this.dur = 0;
    const s = 'id' in e ? this.sprites[e.id] : null;
    if (e.type === 'turn') {
      this.activeId = e.id; this.wind = e.wind; this.turn = e.turn;
      this.banner = `${m.units[e.id].name}’s turn`; this.bannerLife = 1.3; this.dur = 0.45; this.sfx('turn');
    } else if (e.type === 'shot') {
      this.dur = e.path.length / 2 / PATH_RATE; this.sfx(e.marker ? 'hop' : `launch-${e.ride}`);
    } else if (e.type === 'boom') {
      this.dig(e.circles);
      const x = e.x * CELL, y = e.y * CELL;
      this.burst(x, y, 10 + e.crater * 2, [this.theme.soil, this.theme.deep, this.theme.grass, '#fff2c4'], 60 + e.crater * 6);
      this.shake = Math.min(9, 2 + e.crater * 0.35); this.dur = 0.26; this.sfx(e.crater >= 14 ? 'boom-big' : 'boom');
    } else if (e.type === 'hurt' && s) {
      s.hp = e.hp; s.flash = 0.3; this.dur = 0.04;
      this.floats.push({ x: s.x * CELL, y: (s.y - 20) * CELL, text: `−${e.amount}`, life: 1.1, color: '#ff8a76' }); this.sfx('hurt');
    } else if (e.type === 'shift' && s) {
      s.fx = s.x; s.fy = s.y; s.tx = e.x; s.ty = e.y;
      this.dur = Math.max(0.12, Math.min(0.6, Math.hypot(e.x - s.x, e.y - s.y) / 150));
      if (e.y - s.y > 12) this.sfx('fall');
    } else if (e.type === 'out' && s) {
      s.alive = false; this.dur = 0.5; this.sfx(e.why === 'fell' ? 'fell' : 'out');
      if (e.why === 'ko') this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 14, ['#ffffff', '#ffe9a8', '#d8d2c8'], 70);
      this.banner = e.why === 'fell' ? `${m.units[e.id].name} fell!` : `${m.units[e.id].name} is out!`; this.bannerLife = 1.3;
    } else if (e.type === 'heal' && s) {
      s.hp = e.hp; this.dur = 0.45; this.sfx('heal');
      this.floats.push({ x: s.x * CELL, y: (s.y - 20) * CELL, text: `+${e.amount}`, life: 1.1, color: '#8fe08a' });
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 10, ['#ffe46b', '#8fe08a'], 40);
    } else if (e.type === 'hop' && s) {
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 12, ['#ff8fc0', '#ffffff'], 60);
      s.x = s.fx = s.tx = e.x; s.y = s.fy = s.ty = e.y;
      this.burst(s.x * CELL, (s.y - UNIT_UP) * CELL, 12, ['#ff8fc0', '#ffffff'], 60); this.dur = 0.35; this.sfx('hop');
    } else if (e.type === 'dusk') {
      this.dusk = 1; this.banner = 'Dusk: everyone tires'; this.bannerLife = 1.2; this.dur = 0.3;
    }
  }
  private end(e: Event) {
    if (e.type === 'shift') { const s = this.sprites[e.id]; s.x = e.x; s.y = e.y; }
  }
  update(dt: number, m: Match) {
    dt = Math.min(dt, 0.1);
    for (const p of this.sparks) { p.life -= dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= 22 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 22); this.bannerLife = Math.max(0, this.bannerLife - dt);
    for (const s of this.sprites) { s.flash = Math.max(0, s.flash - dt); if (!s.alive) s.fade = Math.min(1, s.fade + dt * 2.2); }
    let left = dt * this.speed;
    // Several quick events (a row of hurts, say) can finish inside one frame.
    for (let guard = 0; guard < 40 && left > 0; guard++) {
      if (!this.cur) { const e = this.queue.shift(); if (!e) break; this.begin(e, m); }
      const e = this.cur!, room = this.dur - this.t, used = Math.min(room, left);
      this.t += used; left -= used;
      if (e.type === 'shift') { const s = this.sprites[e.id], k = this.dur ? this.t / this.dur : 1; s.x = s.fx + (s.tx - s.fx) * k; s.y = s.fy + (s.ty - s.fy) * k * k; }
      if (e.type === 'shot' && e.path.length) {
        const [x, y] = this.ball(e), boring = e.boreAt >= 0 && this.t * PATH_RATE >= e.boreAt;
        // A fading trail in the air, and thrown-up soil while a shot tunnels.
        if (boring) { if (Math.random() < 0.6) this.burst(x, y, 1, [this.theme.soil, this.theme.deep], 40); }
        else this.sparks.push({ x, y, vx: 0, vy: -40, life: 0.35, max: 0.35, color: e.marker ? '#ff8fc0' : '#ffffff', size: 2 });
      }
      if (this.t >= this.dur) { this.end(e); this.cur = null; } else break;
    }
    this.busy = !!this.cur || this.queue.length > 0;
    if (!this.busy) this.sync(m);
  }
  /** Where the projectile of a shot event is right now, in view pixels. */
  private ball(e: Extract<Event, { type: 'shot' }>): [number, number] {
    const n = e.path.length / 2, f = Math.min(n - 1, this.t * PATH_RATE), i = Math.floor(f), k = f - i, j = Math.min(n - 1, i + 1);
    return [(e.path[i * 2] + (e.path[j * 2] - e.path[i * 2]) * k) * CELL, (e.path[i * 2 + 1] + (e.path[j * 2 + 1] - e.path[i * 2 + 1]) * k) * CELL];
  }

  draw(c: C2D, m: Match, time: number, o: Overlay) {
    const th = this.theme;
    c.save();
    const sky = c.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.75, th.sky[1]); sky.addColorStop(1, th.sky[1]);
    c.fillStyle = sky; c.fillRect(0, 0, VIEW_W, VIEW_H);
    c.fillStyle = 'rgba(255, 250, 220, 0.85)'; c.beginPath(); c.arc(VIEW_W * 0.82, 62, 26, 0, 7); c.fill();
    c.fillStyle = th.far; c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 16) c.lineTo(x, 250 + 38 * Math.sin(x / 97 + m.map) + 22 * Math.sin(x / 41 + m.map * 2));
    c.lineTo(VIEW_W, VIEW_H); c.fill(); c.globalAlpha = 1;
    // Clouds drift with the wind, so the sky itself says which way a shot will bend.
    c.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 4; i++) {
      const x = (((i * 233 + time * this.wind * 5) % (VIEW_W + 160)) + VIEW_W + 160) % (VIEW_W + 160) - 80, y = 40 + i * 31;
      c.beginPath(); c.ellipse(x, y, 34, 9, 0, 0, 7); c.ellipse(x + 20, y - 6, 20, 9, 0, 0, 7); c.fill();
    }
    // The drop under the map.
    const pit = c.createLinearGradient(0, VIEW_H - 46, 0, VIEW_H);
    pit.addColorStop(0, 'rgba(20, 24, 44, 0)'); pit.addColorStop(1, 'rgba(20, 24, 44, 0.55)');
    c.fillStyle = pit; c.fillRect(0, VIEW_H - 46, VIEW_W, 46);

    if (this.shake > 0) c.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    c.imageSmoothingEnabled = false;
    c.drawImage(this.land, 0, 0, VIEW_W, VIEW_H);
    c.imageSmoothingEnabled = true;

    for (const s of this.sprites) {
      if (s.fade >= 1) continue;
      const u = m.units[s.id], x = (s.x + 0.5) * CELL, feet = (s.y + 1) * CELL, active = s.id === this.activeId && !this.busy && m.state === 'aim';
      c.save();
      c.globalAlpha = 1 - s.fade;
      if (s.flash > 0) c.translate((Math.random() - 0.5) * 3, 0);
      drawUnit(c, u.coat, u.ride, u.team, x, feet + s.fade * 10, u.angle, time + s.id, { dizzy: !s.alive });
      c.restore();
      if (!s.alive) continue;
      const bw = 30, by = feet - 42, k = Math.max(0, s.hp / u.maxHp);
      c.fillStyle = 'rgba(18, 14, 26, 0.75)'; c.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
      c.fillStyle = k > 0.5 ? '#7be07a' : k > 0.25 ? '#ffcf5a' : '#ff7a66'; c.fillRect(x - bw / 2, by, bw * k, 4);
      c.font = '700 10px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(18, 14, 26, 0.8)'; c.strokeText(u.name, x, by - 4);
      c.fillStyle = TEAM[u.team]; c.fillText(u.name, x, by - 4);
      if (active) { const b = Math.sin(time * 6) * 3; c.fillStyle = TEAM[u.team]; c.beginPath(); c.moveTo(x, by - 16 + b); c.lineTo(x - 6, by - 26 + b); c.lineTo(x + 6, by - 26 + b); c.closePath(); c.fill(); }
    }

    if (o.guide && !this.busy) {
      c.fillStyle = 'rgba(255, 255, 255, 0.9)';
      for (let i = 2; i < o.guide.length; i += 4) { c.globalAlpha = 1 - i / o.guide.length; c.beginPath(); c.arc(o.guide[i] * CELL, o.guide[i + 1] * CELL, 2, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    }
    const e = this.cur;
    if (e?.type === 'shot' && e.path.length) { const [x, y] = this.ball(e); drawBall(c, e.ride, e.shot, e.marker, x, y, this.t); }
    if (e?.type === 'boom') {
      const k = this.dur ? this.t / this.dur : 1;
      c.globalAlpha = 1 - k; c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(e.x * CELL, e.y * CELL, (e.crater + (e.blast - e.crater) * k * 0.6) * CELL, 0, 7); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(e.x * CELL, e.y * CELL, (e.crater + e.blast * k) * CELL, 0, 7); c.stroke(); c.globalAlpha = 1;
    }
    for (const p of this.sparks) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
    c.globalAlpha = 1;
    c.font = '900 15px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
    for (const f of this.floats) { c.globalAlpha = Math.min(1, f.life * 2); c.lineWidth = 3; c.strokeStyle = 'rgba(18, 14, 26, 0.85)'; c.strokeText(f.text, f.x, f.y); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); }
    c.globalAlpha = 1;
    c.restore();

    if (this.dusk) { c.fillStyle = 'rgba(40, 24, 70, 0.22)'; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    // Wind gauge: the arrow's length is the wind's strength.
    const gx = VIEW_W / 2, gy = 26, len = 10 + (Math.abs(this.wind) / MAX_WIND) * 70, dir = Math.sign(this.wind);
    c.fillStyle = 'rgba(18, 14, 26, 0.72)'; c.beginPath(); c.roundRect(gx - 60, gy - 18, 120, 38, 10); c.fill();
    c.textAlign = 'center'; c.fillStyle = '#ffffff'; c.font = '900 13px ui-sans-serif, system-ui, sans-serif';
    c.fillText(this.wind === 0 ? 'WIND calm' : `WIND ${Math.abs(this.wind)}`, gx, gy - 3);
    if (dir) {
      c.strokeStyle = '#7fd4ff'; c.fillStyle = '#7fd4ff'; c.lineWidth = 3; c.lineCap = 'round';
      const x0 = gx - (dir * len) / 2, x1 = gx + (dir * len) / 2;
      c.beginPath(); c.moveTo(x0, gy + 9); c.lineTo(x1 - dir * 4, gy + 9); c.stroke();
      c.beginPath(); c.moveTo(x1 + dir * 3, gy + 9); c.lineTo(x1 - dir * 4, gy + 4); c.lineTo(x1 - dir * 4, gy + 14); c.closePath(); c.fill();
    }
    if (this.bannerLife > 0) {
      c.globalAlpha = Math.min(1, this.bannerLife * 2.5);
      c.font = '900 22px ui-sans-serif, system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 5; c.strokeStyle = 'rgba(18, 14, 26, 0.85)'; c.strokeText(this.banner, VIEW_W / 2, 78);
      c.fillStyle = '#fff6d8'; c.fillText(this.banner, VIEW_W / 2, 78); c.globalAlpha = 1;
    }
    if (o.charging >= 0) {
      const u = m.active, x = (u.x + 0.5) * CELL, y = (u.y - 28) * CELL;
      c.fillStyle = 'rgba(18, 14, 26, 0.8)'; c.fillRect(x - 26, y, 52, 7);
      c.fillStyle = '#ffcf5a'; c.fillRect(x - 25, y + 1, 50 * (o.charging / 100), 5);
    }
  }
}
