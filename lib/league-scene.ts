// Snow Day League: the match, drawn. A 480 by 270 pixel buffer scaled up with nearest-neighbour by the page. The
// Codex-painted forest clearing (trodden paths, drifts, rocks, a frozen puddle, fences and lanterns), the crowd along
// the top fence (little Andean fans who bob, jump on big moments and wave banners in both teams' colours: shapes
// only, no writing), and at each end a chunky snow-brick castle built cube by cube from the painted brick: two towers,
// a wall with crenels, a glowing gate with steps and lanterns, and the keep with the flag on top. Each of the engine's
// sixteen fort blocks owns a few of the castle's cubes, so the castle cracks, chips and loses cubes (they tumble off)
// as it is hit, rubble piles up at its foot, and the keep goes last with the flag. Then everyone sorted by depth with
// soft shadows, in their species' painted frames with the scarf recoloured to the team colour and their own look (a
// fur shade, a striped or dotted scarf), a health bar over every head, a glowing ring under anyone winding up a
// special, builders' brick barricades, snowballs in arcs with a trail. The bottom bar has our five portraits with
// their special cooldown rings; Dora and Enzo sit on the bench in the corner with a bubble for each shout. Weather
// draws over everything. The score (forts, KOs, momentum, clock) is the page's HTML bar above the canvas; nothing is
// ever written here, so nothing covers a face.
import { FW, FH, TICK, SPECIES, BLOCK_HP, lookOf } from './league-game';
import type { Ev, Match, Side, Unit, Weather } from './league-game';

export const W = 480, H = 270;
/** the field (engine units) sits here on the buffer: x one to one, y squashed a little for the three-quarter view */
export const OX = 40, OY = 82, KY = 0.9;
const ART = '/art/league/';
const FRAME = { idle: 0, run1: 1, run2: 2, throw: 3, special: 4, ko: 5, cheer: 6 } as const;
type Bit = { x: number; y: number; vx: number; vy: number; g: number; t: number; life: number; c: string; s: number; cube?: boolean };
type Pop = { x: number; y: number; t: number; kind: 'burst' | 'ko' | 'wall' | 'heal' | 'bury' };
/** one cube of a castle: its column (0–6, 3 is the middle), row up from the ground, layer (0 the front wall, 1 the keep behind) */
type Cube = { col: number; row: number; layer: number; block: number };

function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(rgb: number[], k: number) { return rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))); }

/** the castle, cube by cube, listed in the order the engine's blocks fall (crenels and tower tops first, the keep last) */
const CASTLE: Cube[] = (() => {
  const front: [number, number][] = [
    [1, 3], [5, 3], [3, 3],                 // the wall's crenels
    [0, 5], [6, 5], [0, 4], [6, 4],         // the tower tops
    [0, 3], [6, 3], [0, 2], [6, 2],         // the towers
    [1, 2], [5, 2], [2, 2], [4, 2], [3, 2], // the wall's top course, over the gate
    [1, 1], [5, 1], [0, 1], [6, 1],
    [1, 0], [5, 0], [0, 0], [6, 0],
  ];
  const cubes: Cube[] = [];
  // 24 front cubes over blocks 0–12
  front.forEach(([col, row], i) => cubes.push({ col, row, layer: 0, block: Math.min(12, Math.floor(i * 13 / front.length)) }));
  // the keep: blocks 13–15, its top first
  const keep: [number, number, number][] = [[2, 6, 13], [4, 6, 13], [2, 5, 13], [4, 5, 13], [3, 5, 14], [2, 4, 14], [3, 4, 14], [4, 4, 14], [2, 3, 15], [3, 3, 15], [4, 3, 15]];
  for (const [col, row, block] of keep) cubes.push({ col, row, layer: 1, block });
  return cubes;
})();
const PX = 11, PY = 8, BACK = 9;

export class LeagueScene {
  private ctx: CanvasRenderingContext2D;
  private img: Record<string, HTMLImageElement> = {};
  private tinted = new Map<string, HTMLCanvasElement>();
  m: Match | null = null;
  colours: [string, string] = ['#d8352a', '#2f74d8'];
  reduced = false;
  private bits: Bit[] = []; private pops: Pop[] = [];
  private shake = 0; private flash = 0; private hop = [0, 0]; private bubble: { side: Side; kind: string; t: number } | null = null;
  private trails = new Map<number, { x: number; y: number }[]>();
  private fallen: [number, number] = [-1, -1];
  /** each castle's cubes still standing last frame (to tumble the ones that just went) */
  private standing: [boolean[], boolean[]] = [[], []];
  private clock = 0;
  private flakes: { x: number; y: number; s: number }[] = [];
  confetti = false;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 90; i++) this.flakes.push({ x: Math.random() * W, y: Math.random() * H, s: 0.4 + Math.random() * 0.8 });
  }
  load() {
    const names = ['arena', 'brick-0', 'brick-1', 'brick-2', 'gate', 'steps', 'wlantern', 'rubble', 'bush', 'flag-red', 'flag-blue', 'ball', 'pile', 'bench',
      ...Array.from({ length: 8 }, (_, i) => `fan-${i}`), ...SPECIES, ...SPECIES.map((s) => `${s}-face`)];
    return Promise.all(names.map((n) => new Promise<void>((res) => { const im = new Image(); im.onload = () => { this.img[n] = im; res(); }; im.onerror = () => res(); im.src = `${ART}${n}.png`; })));
  }
  /**
   * a species strip or face with its marker scarf turned to a team colour, and a player's own look: 0 as painted,
   * 1 a cream-striped scarf, 2 darker fur, 3 lighter fur and a dotted scarf
   */
  tint(name: string, colour: string, look = 0) {
    const key = `${name}|${colour}|${look}`; let c = this.tinted.get(key); if (c) return c;
    const im = this.img[name]; c = document.createElement('canvas');
    if (!im) { c.width = c.height = 1; return c; }
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d')!; x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data, base = hexRgb(colour);
    const tones = [shade(base, 1.25), base, shade(base, 0.68)];
    const fur = look === 2 ? 0.84 : look === 3 ? 1.1 : 1;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) continue;
      const g = p[i + 1], b = p[i + 2];
      const k = p[i] !== 0 ? -1 : g === 255 && b === 255 ? 0 : g === 200 && b === 200 ? 1 : g === 140 && b === 140 ? 2 : -1;
      if (k >= 0) {
        const px = (i >> 2) % c.width, py = Math.floor((i >> 2) / c.width);
        const cream = (look === 1 && py % 3 === 0) || (look === 3 && (px + py * 2) % 5 === 0);
        const t = cream ? [250, 238, 214] : tones[k];
        p[i] = t[0]; p[i + 1] = t[1]; p[i + 2] = t[2];
      } else if (fur !== 1 && p[i] + g + b > 90) {
        p[i] = Math.min(255, Math.round(p[i] * fur)); p[i + 1] = Math.min(255, Math.round(g * fur)); p[i + 2] = Math.min(255, Math.round(b * fur));
      }
    }
    x.putImageData(d, 0, 0); this.tinted.set(key, c); return c;
  }
  /** a face for the page (a data URL) */
  faceUrl(species: string, colour: string) { return this.tint(`${species}-face`, colour).toDataURL(); }
  setMatch(m: Match | null, colours?: [string, string]) {
    this.m = m; if (colours) this.colours = colours;
    this.bits = []; this.pops = []; this.trails.clear(); this.fallen = [-1, -1]; this.bubble = null; this.shake = 0; this.confetti = false; this.conf = [];
    this.standing = [[], []];
    if (m) for (const side of [0, 1] as Side[]) this.standing[side] = CASTLE.map((q) => m.forts[side].blocks[q.block] > 0);
  }
  sx(x: number) { return OX + x; }
  sy(y: number) { return OY + y * KY; }
  /** the middle of the action on the buffer (for the page's camera on an upright phone) */
  focusX() {
    const m = this.m; if (!m) return W / 2;
    const live = m.units.filter((u) => u.ko === 0); if (!live.length) return W / 2;
    return live.reduce((a, u) => a + this.sx(u.x), 0) / live.length;
  }

  // ------------------------------------------------ effects from the engine's events
  feed(evs: Ev[]) {
    const m = this.m; if (!m) return;
    for (const e of evs) {
      if (e.k === 'hit') { this.burst(this.sx(e.x), this.sy(e.y) - 12, e.counter ? 12 : 7, e.counter ? '#ffe680' : '#ffffff'); this.pops.push({ x: this.sx(e.x), y: this.sy(e.y) - 12, t: 0, kind: 'burst' }); }
      else if (e.k === 'miss') this.burst(this.sx(e.x), this.sy(e.y), 4, '#e8f4ff');
      else if (e.k === 'wallhit') { this.burst(this.sx(e.x), this.sy(e.y) - 8, e.broke ? 14 : 6, '#dff0ff'); if (e.broke) this.pops.push({ x: this.sx(e.x), y: this.sy(e.y) - 8, t: 0, kind: 'wall' }); }
      else if (e.k === 'fort') { const p = this.blockAt(e.side, e.block); this.burst(p.x, p.y, e.knocked ? 10 : 5, e.knocked ? '#ffffff' : '#d8ecff'); if (e.knocked) { this.shake = Math.max(this.shake, 3); this.hop[1 - e.side] = 14; } }
      else if (e.k === 'ko') { const u = m.units[e.u]; this.burst(this.sx(u.x), this.sy(u.y) - 14, 22, '#ffffff'); this.pops.push({ x: this.sx(u.x), y: this.sy(u.y) - 18, t: 0, kind: 'ko' }); this.flash = 3; this.hop[1 - e.side] = 22; this.shake = Math.max(this.shake, 2); }
      else if (e.k === 'revive' || e.k === 'special' && e.role === 'medic') { const u = m.units[e.u]; this.pops.push({ x: this.sx(u.x), y: this.sy(u.y) - 20, t: 0, kind: 'heal' }); }
      else if (e.k === 'bury') { const u = m.units[e.u]; this.pops.push({ x: this.sx(u.x), y: this.sy(u.y), t: 0, kind: 'bury' }); this.burst(this.sx(u.x), this.sy(u.y) - 6, 14, '#ffffff'); }
      else if (e.k === 'shout') this.bubble = { side: e.side, kind: e.kind, t: 0 };
      else if (e.k === 'surge') this.hop[e.side] = 30;
      else if (e.k === 'flag') { this.fallen[e.side] = 0; this.shake = 10; this.hop = [30, 30]; const a = this.anchor(e.side); this.burst(a.x, a.y - 60, 40, '#ffffff'); }
      else if (e.k === 'end') { if (e.winner === 0) this.confetti = true; }
    }
  }
  private burst(x: number, y: number, n: number, c: string) {
    if (this.reduced) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 0.4 + Math.random() * 1.6; this.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.8, g: 0.08, t: 0, life: 18 + Math.random() * 14, c, s: Math.random() < 0.3 ? 2 : 1 }); }
  }

  // ------------------------------------------------ the castles
  /** the bottom middle of a side's castle on the buffer */
  private anchor(side: Side) { const f = this.m!.forts[side]; return { x: Math.round(this.sx(f.x) + (side === 0 ? -6 : 6)), y: Math.round(this.sy(f.y) + 30) }; }
  /** where a cube's sprite goes (top-left) */
  private cubeXY(side: Side, q: Cube) {
    const a = this.anchor(side), col = side === 0 ? q.col : 6 - q.col;
    return { x: a.x + (col - 3) * PX - 6, y: a.y - 12 - q.row * PY - q.layer * BACK };
  }
  /** the middle of the first standing cube of a block (for effects) */
  private blockAt(side: Side, block: number) {
    const q = CASTLE.find((c) => c.block === block) ?? CASTLE[0], p = this.cubeXY(side, q);
    return { x: p.x + 6, y: p.y + 5 };
  }
  private drawCastle(side: Side) {
    const m = this.m!, f = m.forts[side], c = this.ctx, a = this.anchor(side);
    const b0 = this.img['brick-0']; if (!b0) return;
    const was = this.standing[side];
    const knocked = CASTLE.filter((q) => f.blocks[q.block] <= 0).length;
    // the cubes that just went tumble off
    CASTLE.forEach((q, i) => {
      const up = f.blocks[q.block] > 0;
      if (was[i] && !up) {
        const p = this.cubeXY(side, q), dir = side === 0 ? 1 : -1;
        this.bits.push({ x: p.x, y: p.y, vx: dir * (0.6 + Math.random() * 1.2), vy: -1.2 - Math.random(), g: 0.14, t: 0, life: 26, c: '#ffffff', s: 1, cube: true });
      }
      was[i] = up;
    });
    // the shadow under it
    c.fillStyle = 'rgba(60,80,140,0.22)'; c.beginPath(); c.ellipse(a.x, a.y, 44, 9, 0, 0, Math.PI * 2); c.fill();
    const draw = (q: Cube) => {
      const hp = f.blocks[q.block]; if (hp <= 0) return;
      const k = hp / BLOCK_HP, im = this.img[k > 0.67 ? 'brick-0' : k > 0.34 ? 'brick-1' : 'brick-2'] ?? b0, p = this.cubeXY(side, q);
      const wob = k <= 0.34 && !this.reduced ? Math.round(Math.sin(this.clock * 0.5 + q.col * 2 + q.row) * 0.6) : 0;
      c.drawImage(im, p.x + wob, p.y);
    };
    // the keep behind, then the flag, then the front: towers and wall, top rows last so they sit over the ones below
    for (const q of CASTLE) if (q.layer === 1) draw(q);
    // banners in the team colour hanging on the keep (shapes only)
    const keepUp = CASTLE.filter((q) => q.layer === 1 && f.blocks[q.block] > 0);
    if (keepUp.length) {
      const col = this.colours[side];
      for (const cc of [2, 4]) { const q = keepUp.find((k) => k.col === cc && k.row === 4); if (!q) continue; const p = this.cubeXY(side, q); c.fillStyle = col; c.fillRect(p.x + 3, p.y + 4, 6, 9); c.beginPath(); c.moveTo(p.x + 3, p.y + 13); c.lineTo(p.x + 6, p.y + 10); c.lineTo(p.x + 9, p.y + 13); c.fill(); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(p.x + 4, p.y + 5, 4, 1); }
    }
    this.drawFlag(side, keepUp);
    for (const q of [...CASTLE].filter((q) => q.layer === 0).sort((p, r) => p.row - r.row)) draw(q);
    // the gate, its steps and lanterns
    const gate = this.img.gate, steps = this.img.steps, lan = this.img.wlantern;
    if (gate) c.drawImage(gate, a.x - Math.round(gate.width / 2), a.y - gate.height - 2);
    if (steps) c.drawImage(steps, a.x - Math.round(steps.width / 2), a.y - steps.height + 3);
    if (lan) for (const cc of [1, 5]) { const q = CASTLE.find((k) => k.layer === 0 && k.col === cc && k.row === 1)!; if (f.blocks[q.block] <= 0) continue; const p = this.cubeXY(side, q); c.drawImage(lan, p.x + 2, p.y - 2); if (this.clock % 40 < 30) { c.fillStyle = 'rgba(255,210,120,0.18)'; c.beginPath(); c.arc(p.x + 2 + lan.width / 2, p.y + 3, 6, 0, Math.PI * 2); c.fill(); } }
    // a berry bush at each corner of its foot
    const bush = this.img.bush;
    if (bush) for (const dx of [-42, 40]) c.drawImage(bush, a.x + (side === 0 ? dx : -dx) - (bush.width >> 1), a.y - bush.height + 4);
    // rubble piles up at its foot
    const rub = this.img.rubble;
    if (rub && knocked) {
      const spots = [[-26, 2], [24, 4], [-10, 6], [12, 7], [-34, 5], [32, 6]];
      const n = Math.min(spots.length, Math.ceil(knocked / 5));
      for (let i = 0; i < n; i++) { const [dx, dy] = spots[i]; c.drawImage(rub, a.x + (side === 0 ? dx : -dx) - Math.round(rub.width / 2), a.y + dy - rub.height); }
    }
  }
  private drawFlag(side: Side, keepUp: Cube[]) {
    const c = this.ctx, flag = this.img[side === 0 ? 'flag-red' : 'flag-blue']; if (!flag) return;
    const top = [...keepUp].sort((p, q) => q.row - p.row || Math.abs(p.col - 3) - Math.abs(q.col - 3))[0];
    const tp = top ? this.cubeXY(side, top) : { x: this.anchor(side).x - 6, y: this.anchor(side).y - 20 };
    const fx = tp.x + 4, fy = tp.y - flag.height + 3;
    if (this.fallen[side] < 0 && top) {
      const wave = !this.reduced && this.clock % 30 < 15 ? 1 : 0;
      c.save(); if (side === 1) { c.translate(fx * 2 + flag.width, 0); c.scale(-1, 1); }
      if (side === 1) this.tintFlag(flag, fx, fy - wave); else c.drawImage(flag, fx, fy - wave);
      c.restore();
    } else {
      // the flag topples and lies in the snow
      const k = Math.min(1, Math.max(0, this.fallen[side]) / 24);
      c.save(); c.translate(fx + 2, fy + flag.height); c.rotate((side === 0 ? -1 : 1) * k * Math.PI / 2 * 0.95);
      if (side === 1) { c.scale(-1, 1); c.translate(-flag.width + 4, 0); }
      c.drawImage(flag, -2, -flag.height); c.restore();
    }
  }
  /** their flag in their colour: the painted blue flag, tinted for teams that aren't blue */
  private tintFlag(flag: HTMLImageElement, x: number, y: number) {
    const key = `flag|${this.colours[1]}`; let cv = this.tinted.get(key);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = flag.width; cv.height = flag.height;
      const g = cv.getContext('2d')!; g.drawImage(flag, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height), p = d.data, base = hexRgb(this.colours[1]);
      for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; if (p[i + 2] > p[i] + 40 && p[i + 2] > p[i + 1] + 20) { const k = p[i + 2] / 210; const t = shade(base, k); p[i] = t[0]; p[i + 1] = t[1]; p[i + 2] = t[2]; } }
      g.putImageData(d, 0, 0); this.tinted.set(key, cv);
    }
    this.ctx.drawImage(cv, x, y);
  }

  // ------------------------------------------------ the crowd
  private drawCrowd() {
    const c = this.ctx, t = this.clock;
    for (let i = 0; i < 20; i++) {
      const fan = this.img[`fan-${i % 8}`]; if (!fan) continue;
      const x = 92 + i * 15 + (i % 2) * 3, side = x < W / 2 ? 0 : 1;
      const excite = this.hop[side] > 0 ? 1 : 0;
      const jump = excite ? Math.abs(Math.sin((t + i * 3) * 0.35)) * 4 : (Math.sin((t + i * 7) * 0.06) > 0.92 ? 1 : 0);
      const y = 30 + (i % 3) * 3 - jump;
      c.drawImage(fan, Math.round(x), Math.round(y));
      // every few fans hold a banner in their team's colour
      if (i % 4 === 1) {
        const col = this.colours[side], wave = Math.round(Math.sin(t * 0.15 + i) * 1);
        c.fillStyle = '#6b4a2a'; c.fillRect(Math.round(x) + 2, Math.round(y) - 8, 1, 10);
        c.fillStyle = col; c.beginPath(); c.moveTo(Math.round(x) + 3, Math.round(y) - 8); c.lineTo(Math.round(x) + 12, Math.round(y) - 6 + wave); c.lineTo(Math.round(x) + 3, Math.round(y) - 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(Math.round(x) + 4, Math.round(y) - 6, 3, 1);
      }
    }
  }

  // ------------------------------------------------ a unit
  private drawUnit(u: Unit, a: number) {
    const c = this.ctx, m = this.m!;
    const x = Math.round(this.sx(u.px + (u.x - u.px) * a)), y = Math.round(this.sy(u.py + (u.y - u.py) * a));
    const col = this.colours[u.side];
    const sheet = this.tint(u.p.species, col, lookOf(u.p)), cw = sheet.width / 7, ch = sheet.height;
    // a soft shadow, as wide as they are
    const sw = Math.max(7, Math.round(cw * 0.36));
    c.fillStyle = 'rgba(50,70,130,0.16)'; c.beginPath(); c.ellipse(x, y, sw + 2, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(50,70,130,0.18)'; c.beginPath(); c.ellipse(x, y, sw, 2.2, 0, 0, Math.PI * 2); c.fill();
    if (u.tunnel > 0) {
      // a mound of snow moving under the ground
      const pile = this.img.pile; if (pile) c.drawImage(pile, x - (pile.width >> 1), y - pile.height + Math.round(Math.sin(u.tunnel * 0.8)));
      if (this.clock % 3 === 0) this.bits.push({ x: x + (Math.random() - 0.5) * 10, y: y - 2, vx: (Math.random() - 0.5) * 0.6, vy: -0.6, g: 0.05, t: 0, life: 14, c: '#ffffff', s: 1 });
      return;
    }
    // the special's wind-up: a glowing ring
    if (u.tele > 0) {
      const k = 1 - u.tele / 20, r = 10 + k * 7;
      c.strokeStyle = `rgba(255,214,90,${0.5 + 0.5 * Math.sin(this.clock * 0.8)})`; c.lineWidth = 1;
      c.beginPath(); c.ellipse(x, y, r + 2, (r + 2) * 0.42, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#fff3b0'; c.beginPath(); c.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); c.stroke();
    }
    if (m.surge[u.side] > 0 && u.ko === 0) { c.fillStyle = `rgba(255,230,120,${0.25 + 0.15 * Math.sin(this.clock * 0.5)})`; c.beginPath(); c.ellipse(x, y, sw + 4, 5, 0, 0, Math.PI * 2); c.fill(); }
    let f: number = FRAME.idle;
    if (u.ko > 0 || u.anim === 'stun') f = FRAME.ko;
    else if (u.anim === 'throw' && u.animT < 9) f = FRAME.throw;
    else if (u.anim === 'special' || u.tele > 0) f = FRAME.special;
    else if (u.anim === 'cheer') f = FRAME.cheer;
    else if (u.anim === 'run') f = (Math.floor((u.animT + u.id * 3) / 6) % 2) ? FRAME.run1 : FRAME.run2;
    else if (u.anim === 'dig' || u.anim === 'build') f = (Math.floor(u.animT / 8) % 2) ? FRAME.throw : FRAME.idle;
    else if (u.anim === 'heal') f = FRAME.cheer;
    const bob = u.anim === 'idle' && !this.reduced ? (Math.floor((this.clock + u.id * 5) / 14) % 2) : 0;
    const flip = u.face < 0;
    const dx = x - Math.floor(cw / 2), dy = y - ch + 1 + bob;
    c.save();
    if (u.ko > 0) c.globalAlpha = u.ko < 30 && Math.floor(u.ko / 4) % 2 ? 0.4 : 0.8;
    if (flip) { c.translate(dx * 2 + cw, 0); c.scale(-1, 1); }
    c.drawImage(sheet, f * cw, 0, cw, ch, dx, dy, cw, ch);
    c.restore();
    // a pile of snow over anyone buried, and stars round a dizzy head
    if (u.anim === 'stun' && u.stun > 0) {
      const pile = this.img.pile; if (pile && u.stun > 20) c.drawImage(pile, x - (pile.width >> 1), y - pile.height + 2);
      for (let k = 0; k < 3; k++) { const ang = this.clock * 0.2 + k * 2.1; c.fillStyle = '#ffe14a'; c.fillRect(Math.round(x + Math.cos(ang) * 8), Math.round(y - ch + 2 + Math.sin(ang) * 2), 2, 2); }
    }
    if (u.anim === 'heal' && this.clock % 10 < 5) { c.fillStyle = '#ff6f8f'; c.fillRect(x - 1 + (u.id % 3), y - ch - 4, 3, 2); c.fillRect(x + (u.id % 3), y - ch - 3, 1, 2); }
    // the health bar, with a tick in the team colour
    if (u.ko === 0) {
      const bw = 16, hx = x - 8, hy = y - ch - 4, k = Math.max(0, u.hp / u.maxHp);
      c.fillStyle = '#1b1f2e'; c.fillRect(hx - 1, hy - 1, bw + 2, 4);
      c.fillStyle = k > 0.55 ? '#5fd855' : k > 0.28 ? '#f2c230' : '#ec4a3a'; c.fillRect(hx, hy, Math.max(1, Math.round(bw * k)), 2);
      c.fillStyle = col; c.fillRect(hx - 1, hy - 1, 2, 4);
    }
  }

  // ------------------------------------------------ builders' barricades: a short course of the same snow bricks
  private drawWalls() {
    const c = this.ctx, m = this.m!, b = this.img['brick-0'], b1 = this.img['brick-1'];
    if (!b) return;
    for (const w of m.walls) {
      const x = Math.round(this.sx(w.x)), y = Math.round(this.sy(w.y));
      const k = Math.max(0, w.hp / w.max), n = k > 0.66 ? 3 : k > 0.33 ? 2 : 1, im = k > 0.5 ? b : (b1 ?? b);
      c.save(); c.globalAlpha = Math.min(1, w.up * 1.2);
      c.fillStyle = 'rgba(50,70,130,0.18)'; c.beginPath(); c.ellipse(x, y + 1, 12, 3, 0, 0, Math.PI * 2); c.fill();
      // two cubes side by side (stacked into the line of fire), a third on top while it's strong
      const cubes = [[-6, 0], [5, 0], [-1, -8]].slice(0, n);
      for (const [dx, dy] of cubes) c.drawImage(im, x + dx - 6, y + dy - 11);
      c.fillStyle = this.colours[w.side]; c.fillRect(x - 11, y, 22, 1);
      c.restore();
    }
  }

  private drawBottom(faces: boolean) {
    const c = this.ctx, m = this.m!;
    // the bench, bottom left
    const bench = this.img.bench;
    if (bench) c.drawImage(bench, 2, H - bench.height - 1);
    if (this.bubble && this.bubble.side === 0 && this.bubble.t < 150 && bench) this.drawBubble(30, H - bench.height - 22, this.bubble.kind);
    if (this.bubble && this.bubble.side === 1 && this.bubble.t < 150) this.drawBubble(W - 52, 58, this.bubble.kind);
    if (!faces) return;
    // our five portraits with their special cooldown rings
    const ours = m.units.filter((u) => u.side === 0);
    const x0 = 112, y0 = H - 38;
    c.fillStyle = '#3a2416'; c.fillRect(x0 - 4, y0 - 4, ours.length * 46 + 6, 42); c.fillStyle = '#c8873a'; c.fillRect(x0 - 3, y0 - 3, ours.length * 46 + 4, 1);
    ours.forEach((u, i) => {
      const x = x0 + i * 46, face = this.tint(`${u.p.species}-face`, this.colours[0], lookOf(u.p));
      c.fillStyle = '#7a2a22'; c.fillRect(x, y0, 40, 34); c.fillStyle = '#5a1c16'; c.fillRect(x, y0 + 26, 40, 8);
      c.save(); c.beginPath(); c.rect(x, y0, 40, 34); c.clip();
      if (u.ko > 0) c.globalAlpha = 0.35;
      c.drawImage(face, x + 20 - Math.round(face.width / 2) - 4, y0 + 34 - face.height);
      c.restore();
      // the cooldown ring, bottom right, clear of the face
      const k = u.tele > 0 ? 1 : 1 - u.spec / u.specMax, rx = x + 33, ry = y0 + 27;
      c.lineWidth = 3; c.strokeStyle = '#2a1a10'; c.beginPath(); c.arc(rx, ry, 5, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = k >= 1 ? (this.clock % 12 < 6 ? '#fff3a0' : '#ffd23f') : '#e8b030'; c.beginPath(); c.arc(rx, ry, 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); c.stroke();
      // health strip
      const hk = u.ko > 0 ? 0 : u.hp / u.maxHp;
      c.fillStyle = '#1b1f2e'; c.fillRect(x + 2, y0 + 1, 24, 3); c.fillStyle = hk > 0.55 ? '#5fd855' : hk > 0.28 ? '#f2c230' : '#ec4a3a'; c.fillRect(x + 2, y0 + 1, Math.round(24 * hk), 3);
    });
  }
  private drawBubble(x: number, y: number, kind: string) {
    const c = this.ctx, k = this.bubble!.t;
    const pop = k < 6 ? k / 6 : 1;
    c.save(); c.translate(x + 14, y + 10); c.scale(pop, pop); c.translate(-14, -10);
    c.fillStyle = '#2a1a10'; c.fillRect(-1, -1, 30, 20); c.fillStyle = '#fbf3e0'; c.fillRect(0, 0, 28, 18);
    c.fillStyle = '#fbf3e0'; c.fillRect(6, 18, 4, 3); c.fillRect(7, 21, 2, 2);
    c.fillStyle = kind === 'attack' ? '#d8352a' : kind === 'hold' ? '#3a7ad8' : '#e0507a';
    if (kind === 'attack') { c.fillRect(5, 7, 12, 4); c.fillRect(15, 4, 3, 10); c.fillRect(18, 5, 2, 8); c.fillRect(20, 7, 2, 4); }
    else if (kind === 'hold') { c.fillRect(8, 3, 12, 8); c.fillRect(9, 11, 10, 2); c.fillRect(11, 13, 6, 2); c.fillRect(13, 15, 2, 1); c.fillStyle = '#fbf3e0'; c.fillRect(13, 5, 2, 6); }
    else { c.fillRect(8, 5, 5, 4); c.fillRect(15, 5, 5, 4); c.fillRect(7, 7, 14, 4); c.fillRect(9, 11, 10, 2); c.fillRect(11, 13, 6, 2); c.fillRect(13, 15, 2, 1); }
    c.restore();
  }

  // ------------------------------------------------ one frame
  /** a: how far between the last tick and the next (0–1); faces: draw the portrait bar */
  frame(a: number, steps: number, faces = true) {
    const c = this.ctx, m = this.m;
    this.clock++;
    c.save();
    if (this.shake > 0 && !this.reduced) { c.translate(Math.round((Math.random() - 0.5) * this.shake), Math.round((Math.random() - 0.5) * this.shake)); }
    if (this.img.arena) c.drawImage(this.img.arena, 0, 0); else { c.fillStyle = '#e6f0fa'; c.fillRect(0, 0, W, H); }
    if (!m) { c.restore(); return; }
    this.drawCrowd();
    for (const side of [0, 1] as Side[]) this.drawCastle(side);
    this.drawWalls();
    // everyone, back to front
    const order = [...m.units].sort((p, q) => p.y - q.y);
    for (const u of order) this.drawUnit(u, a);
    // snowballs in flight
    const ball = this.img.ball;
    for (const b of m.balls) {
      const k = Math.min(1, (b.t + a) / b.dur);
      const gx = b.x0 + (b.tx - b.x0) * k, gy = b.y0 + (b.ty - b.y0) * k;
      const d = Math.hypot(b.tx - b.x0, b.ty - b.y0), hgt = Math.sin(Math.PI * k) * Math.min(b.lob ? 52 : 28, d * (b.lob ? 0.32 : 0.16));
      const x = Math.round(this.sx(gx)), y = Math.round(this.sy(gy) - 12 - hgt);
      c.fillStyle = 'rgba(40,60,110,0.22)'; c.fillRect(Math.round(this.sx(gx)) - 1, Math.round(this.sy(gy)), 4, 1);
      const tr = this.trails.get(b.id) ?? []; tr.push({ x, y }); if (tr.length > 5) tr.shift(); this.trails.set(b.id, tr);
      tr.forEach((p, i) => { c.fillStyle = `rgba(255,255,255,${(i + 1) / tr.length * 0.6})`; c.fillRect(p.x, p.y + 1, 1, 1); });
      if (b.big) { c.fillStyle = '#ffffff'; c.fillRect(x - 3, y - 3, 7, 7); c.fillStyle = '#bcd8f0'; c.fillRect(x - 3, y + 2, 7, 2); c.fillStyle = '#2a3a5a'; c.fillRect(x - 4, y - 2, 1, 5); c.fillRect(x + 4, y - 2, 1, 5); c.fillRect(x - 2, y - 4, 5, 1); c.fillRect(x - 2, y + 4, 5, 1); }
      else if (ball) c.drawImage(ball, x - 2, y - 2);
    }
    if (this.trails.size > 60) { const live = new Set(m.balls.map((b) => b.id)); for (const k of this.trails.keys()) if (!live.has(k)) this.trails.delete(k); }
    // pops: bursts, KO stars, hearts
    for (const p of this.pops) {
      p.t += steps > 0 ? 1 : 0.5;
      if (p.kind === 'ko') { for (let i = 0; i < 5; i++) { const ang = p.t * 0.25 + i * 1.256; c.fillStyle = i % 2 ? '#ffe14a' : '#ffffff'; c.fillRect(Math.round(p.x + Math.cos(ang) * (4 + p.t * 0.6)), Math.round(p.y - p.t * 0.4 + Math.sin(ang) * 3), 2, 2); } }
      else if (p.kind === 'heal') { c.fillStyle = `rgba(255,120,150,${1 - p.t / 30})`; c.fillRect(Math.round(p.x) - 2, Math.round(p.y - p.t * 0.5), 2, 2); c.fillRect(Math.round(p.x) + 1, Math.round(p.y - p.t * 0.5), 2, 2); c.fillRect(Math.round(p.x) - 1, Math.round(p.y - p.t * 0.5) + 2, 3, 1); }
      else if (p.kind === 'burst' && p.t < 6) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(p.x) - 3, Math.round(p.y), 7, 1); c.fillRect(Math.round(p.x), Math.round(p.y) - 3, 1, 7); }
    }
    this.pops = this.pops.filter((p) => p.t < 30);
    const brick = this.img['brick-2'];
    for (const b of this.bits) {
      b.t++; b.x += b.vx; b.y += b.vy; b.vy += b.g;
      if (b.cube && brick) { c.save(); c.globalAlpha = Math.max(0, 1 - b.t / b.life); c.drawImage(brick, Math.round(b.x), Math.round(b.y)); c.restore(); }
      else { c.fillStyle = b.c; c.fillRect(Math.round(b.x), Math.round(b.y), b.s, b.s); }
    }
    this.bits = this.bits.filter((b) => b.t < b.life);
    // the weather
    this.drawWeather(m.weather, m.wind);
    this.drawBottom(faces);
    if (this.flash > 0 && !this.reduced) { c.fillStyle = `rgba(255,255,255,${this.flash * 0.06})`; c.fillRect(0, 0, W, H); this.flash--; }
    if (this.confetti) this.drawConfetti();
    c.restore();
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.4);
    for (const s of [0, 1]) if (this.hop[s] > 0) this.hop[s]--;
    if (this.bubble) this.bubble.t++;
    for (const s of [0, 1] as Side[]) if (this.fallen[s] >= 0) this.fallen[s]++;
  }
  private drawWeather(w: Weather, wind: number) {
    const c = this.ctx;
    if (w === 'snow' || w === 'wind') {
      c.fillStyle = 'rgba(255,255,255,0.9)';
      for (const f of this.flakes) {
        f.y += f.s * (w === 'wind' ? 0.6 : 0.8); f.x += w === 'wind' ? wind * f.s * 2.2 : Math.sin((f.y + f.s * 50) * 0.05) * 0.3;
        if (f.y > H) { f.y = -2; f.x = Math.random() * W; } if (f.x > W) f.x = 0; if (f.x < 0) f.x = W;
        if (w === 'snow' || f.s > 0.9) c.fillRect(Math.round(f.x), Math.round(f.y), f.s > 0.9 ? 2 : 1, f.s > 0.9 ? 2 : 1);
      }
      if (w === 'wind') { c.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 7; i++) { const y = 70 + i * 21, x = ((this.clock * 5 * wind + i * 97) % (W + 60) + W + 60) % (W + 60) - 30; c.fillRect(Math.round(x), y, 22, 1); c.fillRect(Math.round(x) + 6, y + 2, 12, 1); } }
    } else if (w === 'fog') {
      for (let i = 0; i < 4; i++) { const y = 60 + i * 42, x = ((this.clock * 0.3 + i * 140) % (W + 200)) - 200; c.fillStyle = 'rgba(235,240,248,0.22)'; c.fillRect(Math.round(x), y, 260, 26); c.fillRect(Math.round(x) + 30, y - 6, 180, 38); }
      c.fillStyle = 'rgba(230,236,246,0.12)'; c.fillRect(0, 0, W, H);
    }
  }
  private conf: { x: number; y: number; vy: number; vx: number; c: string }[] = [];
  private drawConfetti() {
    const c = this.ctx;
    if (this.conf.length < 140 && !this.reduced) for (let i = 0; i < 4; i++) this.conf.push({ x: Math.random() * W, y: -4, vy: 0.6 + Math.random() * 0.8, vx: (Math.random() - 0.5) * 0.6, c: ['#d8352a', '#ffd23f', '#ffffff', '#5fd855', '#5aa8ff', '#ff8ad8'][Math.floor(Math.random() * 6)] });
    for (const p of this.conf) { p.y += p.vy; p.x += p.vx + Math.sin(p.y * 0.1) * 0.3; c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), 2, (Math.floor(p.y / 4) % 2) + 1); }
    this.conf = this.conf.filter((p) => p.y < H);
  }
  /** where a unit is on the canvas (buffer pixels), for the page */
  unitAt(u: Unit) { return { x: this.sx(u.x), y: this.sy(u.y) }; }
  dispose() { this.tinted.clear(); }
}
export const TICK_MS = 1000 / TICK;
export { FW, FH };
