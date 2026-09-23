// Canvas 2D drawing for Fluffball Cup: the stands and crowd, the pitch, the goals, the players (the shared
// side-on Dora and Enzo drawing in team vests), the ball with its height and shadow, and effects.
import { SoccerGame, GOAL_TOP, GOAL_BOTTOM, type Footballer, type Rival } from './soccer-game';
import { COATS, coatLike, drawChinchilla, type Coat } from './chinchilla-art';

/** Canvas size, and where pitch unit (0, 0) sits: 10 px per unit, with stands above and boards below. */
export const W = 1060, H = 740, PX = 30, PY = 100, U = 10;
export const toPitch = (cx: number, cy: number) => ({ x: (cx - PX) / U, y: (cy - PY) / U });

type Look = { name: string; bib: string; trim: string; coats: Coat[] };
/** Lighten (amt > 0) or darken a #rrggbb colour. */
const tone = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};
/** Four coats from one palette, each player a shade lighter or darker, so a team looks like cousins. */
const family = (base: 'dora' | 'enzo', p: Partial<Coat>, shifts: number[]) => shifts.map((d) => {
  const over: Partial<Coat> = {};
  for (const [k, v] of Object.entries(p)) (over as Record<string, unknown>)[k] = typeof v === 'string' && v.startsWith('#') ? tone(v, d) : v;
  return coatLike(base, over);
});
const blackEyes = { eye: '#16121a', pupil: '#000000', earGlow: false, eyeR: 1.75 };
const LOOKS: Record<'home' | Rival['id'], Look> = {
  home: { name: 'Sky Squad', bib: '#4f93c4', trim: '#eaf5fb', coats: [
    COATS.dora,
    coatLike('dora', { ...blackEyes, fur: '#f3e6d0', back: '#e3cfae', face: '#f8efe0', shade: '#d6c19f', texture: '#dccaa9', tail: '#efe0c8', tailInner: '#d3bd9a' }),
    coatLike('dora', { ...blackEyes, fur: '#eeeaf0', back: '#dad3df', face: '#f6f3f8', shade: '#ccc4d2', texture: '#d8d0dc', tail: '#ebe6ee', tailInner: '#cfc6d6' }),
    coatLike('dora', { ...blackEyes, fur: '#fffdf8', back: '#f2ede4' }),
  ] },
  ember: { name: 'Ember FC', bib: '#d9794f', trim: '#fff1e6', coats: [
    COATS.enzo,
    coatLike('enzo', { fur: '#8d8b93', back: '#66646c', face: '#a3a1aa', shade: '#75737b', texture: '#6a6870', tail: '#8a8892', tailOuter: '#67656e' }),
    coatLike('enzo', { fur: '#7a6556', back: '#4e3d33', face: '#937c6c', shade: '#5d4a3e', texture: '#54433a', ear: '#806c62', tail: '#6d5a4c', tailOuter: '#4a3a30', tailInner: '#9a8676' }),
    coatLike('enzo', { fur: '#4c4a52', back: '#2c2a30', face: '#66646c', shade: '#3a383f', texture: '#302e34', tail: '#3f3d44', tailOuter: '#29272c', tailInner: '#6a6870' }),
  ] },
  viscacha: { name: 'Viscacha United', bib: '#4c9a6a', trim: '#eaf6ee', coats: family('enzo', { fur: '#a8977f', back: '#7d6d58', face: '#bcae98', shade: '#8d7d67', texture: '#857560', ear: '#9c8a78', tail: '#8e7d66', tailOuter: '#6b5b47', tailInner: '#b8a890' }, [0, 0.1, -0.1, 0.18]) },
  degu: { name: 'Degu Dynamo', bib: '#8a5fb8', trim: '#f3ecfb', coats: family('enzo', { fur: '#9a7650', back: '#6e5234', face: '#b08d66', shade: '#7e603f', texture: '#735638', ear: '#8a6a4c', tail: '#5a432c', tailOuter: '#3f2e1e', tailInner: '#8a6a4c' }, [0, 0.1, -0.12, 0.16]) },
};
export const teamLook = (g: SoccerGame, team: 0 | 1) => (team === 0 ? LOOKS.home : LOOKS[g.rival.id]);
const KEEPER = { bib: '#e6c35a', trim: '#5a4516' };

const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const ellipse = (c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) => { c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); c.fill(); };

// The grass texture is the same every frame, so draw it once.
let turf: HTMLCanvasElement | null = null;
function grass() {
  if (turf) return turf;
  turf = document.createElement('canvas'); turf.width = 1000; turf.height = 600;
  const c = turf.getContext('2d')!;
  for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? '#4f8a5c' : '#5a9766'; c.fillRect(i * 100, 0, 100, 600); }
  for (let i = 0; i < 5200; i++) {
    const x = hash(i, 1) * 1000, y = hash(i, 2) * 600, v = hash(i, 3);
    c.strokeStyle = v < 0.5 ? 'rgba(30, 70, 40, 0.18)' : 'rgba(200, 235, 170, 0.14)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + (v - 0.5) * 3, y - 2 - v * 3); c.stroke();
  }
  for (let i = 0; i < 26; i++) ellipse(c, hash(i, 7) * 1000, hash(i, 8) * 600, 18 + hash(i, 9) * 30, 10 + hash(i, 10) * 16, 'rgba(40, 80, 45, 0.06)');
  const edge = c.createRadialGradient(500, 300, 250, 500, 300, 640);
  edge.addColorStop(0, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(10, 40, 30, 0.28)');
  c.fillStyle = edge; c.fillRect(0, 0, 1000, 600);
  return turf;
}

/** Rows of fans in the stand, bobbing, and jumping up when anyone scores. */
function crowd(c: CanvasRenderingContext2D, g: SoccerGame, t: number) {
  const sky = c.createLinearGradient(0, 0, 0, PY);
  sky.addColorStop(0, '#1b2f36'); sky.addColorStop(1, '#2c4650');
  c.fillStyle = sky; c.fillRect(0, 0, W, PY);
  const cheer = g.state === 'goal' ? 1 : g.golden ? 0.5 : 0.15;
  const home = LOOKS.home, away = teamLook(g, 1);
  for (let row = 0; row < 3; row++) {
    const y = 26 + row * 22;
    c.fillStyle = row % 2 ? '#34525c' : '#3b5c66'; c.fillRect(0, y + 6, W, 22);
    for (let i = 0; i < 48; i++) {
      const x = 12 + i * 22 + (row % 2) * 11, h = hash(i, row), left = x < W / 2;
      const jump = Math.max(0, Math.sin(t * (6 + h * 4) + h * 9)) * 6 * cheer;
      const fur = ['#f4efe4', '#8d8b93', '#a8977f', '#5c5a62', '#e8dcc6', '#9a7650'][Math.floor(h * 6)];
      const fy = y - jump;
      // Scarf in the colour of the end they sit behind.
      ellipse(c, x, fy + 12, 7, 4, left ? home.bib : away.bib);
      ellipse(c, x - 4, fy - 6, 3, 5, fur, -0.3); ellipse(c, x + 4, fy - 6, 3, 5, fur, 0.3);
      ellipse(c, x - 4, fy - 6, 1.6, 3, '#d9a79a', -0.3); ellipse(c, x + 4, fy - 6, 1.6, 3, '#d9a79a', 0.3);
      ellipse(c, x, fy + 2, 7, 7, fur);
      ellipse(c, x - 2.5, fy + 1, 1, 1.2, '#1a1418'); ellipse(c, x + 2.5, fy + 1, 1, 1.2, '#1a1418');
      if (cheer > 0.4 && h > 0.6) { c.strokeStyle = fur; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 6, fy + 6); c.lineTo(x - 9, fy - 4 - jump); c.moveTo(x + 6, fy + 6); c.lineTo(x + 9, fy - 4 - jump); c.stroke(); }
    }
  }
  // Team banners on the front of the stand.
  for (const [x, look] of [[PX + 120, home], [W - PX - 120, away]] as const) {
    c.fillStyle = look.bib; c.beginPath(); c.roundRect(x - 90, PY - 30, 180, 22, 5); c.fill();
    c.fillStyle = look.trim; c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(look.name.toUpperCase(), x, PY - 19);
  }
  c.fillStyle = '#20353c'; c.fillRect(0, PY - 6, W, 6);
}

function boards(c: CanvasRenderingContext2D) {
  const y = PY + 600 + 10;
  c.fillStyle = '#20353c'; c.fillRect(0, y - 4, W, H - y + 4);
  const ads = ['FLUFFBALL CUP', 'DUST BATH SPA', 'RAISIN & CO', 'ANDES HAY', 'FLUFFBALL CUP'];
  ads.forEach((ad, i) => {
    const x = PX + i * 200;
    c.fillStyle = i % 2 ? '#e9e1c8' : '#f5bb63'; c.fillRect(x + 4, y + 2, 192, 22);
    c.fillStyle = '#243b44'; c.font = 'bold 12px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ad, x + 100, y + 13.5);
  });
}

/** A goal: net hatching behind the line, posts and a hint of the bar's depth. Nets bulge after a goal. */
function goalFrame(c: CanvasRenderingContext2D, left: boolean, bulge: number) {
  const x = left ? -26 : 1000, top = GOAL_TOP * U, h = (GOAL_BOTTOM - GOAL_TOP) * U, back = left ? x : x + 26;
  c.fillStyle = 'rgba(230, 240, 235, 0.16)'; c.fillRect(x, top, 26, h);
  c.save(); c.beginPath(); c.rect(x, top, 26, h); c.clip();
  c.strokeStyle = 'rgba(240, 248, 240, 0.55)'; c.lineWidth = 1;
  const push = (left ? -1 : 1) * bulge * 8;
  c.beginPath();
  for (let i = -h; i < h + 26; i += 7) { c.moveTo(x + push, top + i); c.lineTo(x + 26 + push, top + i + 26); c.moveTo(x + 26 + push, top + i); c.lineTo(x + push, top + i + 26); }
  c.stroke(); c.restore();
  c.strokeStyle = '#f7f7f0'; c.lineWidth = 3; c.beginPath(); c.moveTo(back, top); c.lineTo(back, top + h); c.stroke();
  c.lineWidth = 4;
  const line = left ? 0 : 1000;
  c.beginPath(); c.moveTo(line, top); c.lineTo(back, top); c.moveTo(line, top + h); c.lineTo(back, top + h); c.stroke();
  for (const py of [top, top + h]) { ellipse(c, line, py + 3, 5, 2.5, 'rgba(0,0,0,0.25)'); ellipse(c, line, py, 4.5, 4.5, '#ffffff'); }
}

function cornerFlag(c: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  c.strokeStyle = '#f2efe2'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 22); c.stroke();
  const wave = Math.sin(t * 5 + x) * 2;
  c.fillStyle = color; c.beginPath(); c.moveTo(x, y - 22); c.quadraticCurveTo(x + 7, y - 20 + wave, x + 13, y - 18 + wave); c.lineTo(x, y - 13); c.fill();
}

function player(c: CanvasRenderingContext2D, g: SoccerGame, p: Footballer, t: number) {
  const x = p.x * U, y = p.y * U, look = teamLook(g, p.team), active = p.id === g.active && p.team === 0;
  const moving = p.speed > 1.2, bib = p.keeper ? KEEPER : look;
  ellipse(c, x, y + 1, 15, 5, 'rgba(15, 45, 35, 0.3)');
  if (active) {
    c.strokeStyle = '#ffe1a3'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(x, y + 1, 20, 8, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#ffe1a3'; c.beginPath(); c.moveTo(x - 6, y - 50); c.lineTo(x + 6, y - 50); c.lineTo(x, y - 42); c.fill();
  }
  if (p.dash > 0) {
    // Ember Dash: sparks and speed lines streaming off behind.
    for (let i = 0; i < 5; i++) {
      const sx = x - p.face * (16 + i * 7), sy = y - 8 - i * 3 + Math.sin(t * 30 + i) * 2;
      c.strokeStyle = i % 2 ? '#ffb070' : '#ffe0a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - p.face * 10, sy); c.stroke();
    }
  }
  c.save();
  if (p.dive > 0) { c.translate(x, y - 6); c.rotate((p.vy > 0 ? 1 : -1) * p.face * 0.9); c.translate(-x, -(y - 6)); }
  drawChinchilla(c, look.coats[p.id % 4], x, y + 2, {
    face: p.face, h: 36, time: t + p.id, run: t * p.speed * 5, moving, air: p.dive > 0,
    bib: { color: bib.bib, trim: bib.trim, label: p.keeper ? 'G' : String(p.id % 4 + 1) },
  });
  c.restore();
  c.font = 'bold 11px Arial'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.lineWidth = 3; c.strokeStyle = 'rgba(20, 50, 45, 0.7)'; c.strokeText(p.name, x, y + 18);
  c.fillStyle = active ? '#ffe7af' : '#eff3df'; c.fillText(p.name, x, y + 18);
}

function ball(c: CanvasRenderingContext2D, g: SoccerGame) {
  const b = g.ball, x = b.x * U, y = b.y * U, lift = b.z * 9, r = 6 + b.z * 0.5;
  ellipse(c, x, y + 4, 6 - Math.min(3, b.z * 0.6), 3 - Math.min(1.5, b.z * 0.3), `rgba(20, 50, 40, ${0.45 - Math.min(0.3, b.z * 0.05)})`);
  const by = y - lift;
  const shine = c.createRadialGradient(x - r * 0.4, by - r * 0.4, 1, x, by, r);
  shine.addColorStop(0, '#ffffff'); shine.addColorStop(1, '#e6ddc6');
  c.fillStyle = shine; c.beginPath(); c.arc(x, by, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(x, by, r, 0, Math.PI * 2); c.clip();
  for (let i = 0; i < 3; i++) {
    const a = b.spin + i * 2.1, px = x + Math.cos(a) * r * 0.55, py = by + Math.sin(a) * r * 0.35;
    c.fillStyle = '#37464c'; c.beginPath();
    for (let k = 0; k < 5; k++) { const q = (k / 5) * Math.PI * 2 + a; c.lineTo(px + Math.cos(q) * r * 0.32, py + Math.sin(q) * r * 0.32); }
    c.fill();
  }
  c.restore();
  c.strokeStyle = 'rgba(40, 50, 55, 0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(x, by, r, 0, Math.PI * 2); c.stroke();
}

function effects(c: CanvasRenderingContext2D, g: SoccerGame) {
  for (const f of g.fx) {
    const x = f.x * U, y = f.y * U, k = f.age / 0.6;
    c.globalAlpha = 1 - k;
    if (f.kind === 'tackle') {
      for (let i = 0; i < 5; i++) { const a = i * 1.26; ellipse(c, x + Math.cos(a) * (6 + k * 14), y - 8 + Math.sin(a) * (4 + k * 8), 2.2, 2.2, '#ffe7a8'); }
    } else {
      for (let i = 0; i < 4; i++) ellipse(c, x - 6 + i * 4 + (i - 1.5) * k * 8, y + 2 - k * 6, 3 + k * 4, 2 + k * 2, f.kind === 'chip' ? '#ffffff' : '#c9dfb4');
    }
    c.globalAlpha = 1;
  }
}

/** Confetti in the scoring team's colours while the goal celebration runs. */
function confetti(c: CanvasRenderingContext2D, g: SoccerGame) {
  const k = 2 - g.goalTime, look = teamLook(g, g.kickoff === 1 ? 0 : 1);
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 21) * 1000, y = -20 + ((hash(i, 22) * 600 + k * (120 + hash(i, 23) * 160)) % 640), a = k * 6 + i;
    c.save(); c.translate(x + Math.sin(a) * 8, y); c.rotate(a);
    c.fillStyle = [look.bib, look.trim, '#ffd46a'][i % 3]; c.fillRect(-3, -1.5, 6, 3);
    c.restore();
  }
}

export function drawSoccer(c: CanvasRenderingContext2D, g: SoccerGame, t: number) {
  c.clearRect(0, 0, W, H);
  c.fillStyle = '#243b44'; c.fillRect(0, 0, W, H);
  crowd(c, g, t);
  boards(c);
  c.save(); c.translate(PX, PY);
  c.drawImage(grass(), 0, 0);
  if (g.golden) { c.strokeStyle = `rgba(255, 212, 106, ${0.45 + Math.sin(t * 5) * 0.25})`; c.lineWidth = 6; c.strokeRect(-3, -3, 1006, 606); }
  // Lines: touchlines, halfway, centre circle, boxes, spots and corner arcs.
  c.strokeStyle = '#e8f1d4'; c.lineWidth = 2.5;
  c.strokeRect(4, 4, 992, 592);
  c.beginPath(); c.moveTo(500, 4); c.lineTo(500, 596); c.moveTo(580, 300); c.arc(500, 300, 80, 0, Math.PI * 2); c.stroke();
  for (const x of [4, 846]) c.strokeRect(x, 160, 150, 280);
  for (const x of [4, 946]) c.strokeRect(x, 230, 50, 140);
  c.beginPath(); c.arc(154, 300, 45, -0.9, 0.9); c.moveTo(846 + 45 * Math.cos(Math.PI - 0.9), 300 + 45 * Math.sin(Math.PI - 0.9)); c.arc(846, 300, 45, Math.PI - 0.9, Math.PI + 0.9, true); c.stroke();
  for (const [cx, cy, a] of [[4, 4, 0], [996, 4, Math.PI / 2], [996, 596, Math.PI], [4, 596, -Math.PI / 2]] as const) { c.beginPath(); c.arc(cx, cy, 10, a, a + Math.PI / 2); c.stroke(); }
  for (const x of [500, 110, 890]) ellipse(c, x, 300, 3, 3, '#e8f1d4');
  const bulge = g.state === 'goal' ? Math.max(0, g.goalTime - 1.2) : 0;
  goalFrame(c, true, g.kickoff === 0 ? bulge : 0);
  goalFrame(c, false, g.kickoff === 1 ? bulge : 0);
  const home = LOOKS.home.bib, away = teamLook(g, 1).bib;
  cornerFlag(c, 4, 4, home, t); cornerFlag(c, 4, 596, home, t); cornerFlag(c, 996, 4, away, t); cornerFlag(c, 996, 596, away, t);

  // Aim guide while you have the ball: a straight line, plus the Cloud Chip's arc when the meter is full.
  if (g.owner === g.active && g.state === 'playing') {
    const p = g.players[g.active], dx = g.aim.x - p.x, dy = g.aim.y - p.y, d = Math.hypot(dx, dy) || 1;
    c.save(); c.setLineDash([5, 8]); c.strokeStyle = '#ffe1a188'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(p.x * U, p.y * U); c.lineTo((p.x + (dx / d) * 12) * U, (p.y + (dy / d) * 12) * U); c.stroke();
    if (g.meter >= 1) {
      c.strokeStyle = 'rgba(255, 255, 255, 0.75)'; c.beginPath();
      for (let i = 0; i <= 20; i++) { const u = i / 20, lx = p.x + dx * u, ly = p.y + dy * u; c.lineTo(lx * U, ly * U - Math.sin(u * Math.PI) * Math.min(90, d * 2.4)); }
      c.stroke();
    }
    c.restore();
  }
  effects(c, g);
  // Nearer players (lower on screen) overlap farther ones; the ball is always drawn on top so you never lose it.
  for (const p of g.players.slice().sort((a, b) => a.y - b.y)) player(c, g, p, t);
  ball(c, g);
  if (g.state === 'goal') confetti(c, g);
  c.restore();
}
