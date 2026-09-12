// The inside of the burrow, drawn in the same storybook hand as the village:
// one palette, one light from the upper left, ink outlines, warm grade.
//
// The page lays a grid of transparent buttons over this canvas for the clicking,
// so ROOM and tileRect() are the single source of truth for where a tile is.
import { Hollow, FURNITURE, HERO_NAMES, NEIGHBOURS, type Placed } from './dusty-hollow-game';

export const ROOM = { w: 640, h: 400, wall: 158, x: 26, y: 168, gw: 588, gh: 214, gap: 8 };

/** Where a floor tile sits on the canvas, in canvas pixels. */
export function tileRect(cols: number, rows: number, x: number, y: number) {
  const w = (ROOM.gw - (cols - 1) * ROOM.gap) / cols;
  const h = (ROOM.gh - (rows - 1) * ROOM.gap) / rows;
  return { x: ROOM.x + x * (w + ROOM.gap), y: ROOM.y + y * (h + ROOM.gap), w, h };
}

const INK = 'rgba(56,44,34,0.5)';
const WOOD = ['#c9a273', '#b28c5f', '#dcb98a'];
const SPECIES_BODY: Record<string, string> = { dora: '#f2ede4', enzo: '#8e8f98', flamingo: '#f39ab5', fox: '#d9873c', viscacha: '#b7a58c', condor: '#4a4750', llama: '#e8dcc2', cat: '#8a7f73' };

function shade(hex: string, t: number, toward = '#000000') {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toward.slice(1), 16);
  const mix = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return `rgb(${mix(16)},${mix(8)},${mix(0)})`;
}

/** Draw the burrow interior. `picked` is whatever the player is currently holding. */
export function drawRoom(canvas: HTMLCanvasElement, g: Hollow, picked: { pocket?: number; placed?: Placed } | null, time: number) {
  if (canvas.width !== ROOM.w) { canvas.width = ROOM.w; canvas.height = ROOM.h; }
  const c = canvas.getContext('2d');
  if (!c) return;
  const [cols, rows] = g.roomSize;
  const stroke = (width = 1.4, color = INK) => { c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); };
  const drop = (px: number, py: number, rx: number, ry: number, a = 0.18) => {
    c.fillStyle = `rgba(48,38,28,${a})`;
    c.beginPath(); c.ellipse(px + rx * 0.22, py, rx, ry, 0, 0, Math.PI * 2); c.fill();
  };

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, ROOM.w, ROOM.h);

  // ---- the shell: wall, window, door, floor -------------------------------
  const plaster = c.createLinearGradient(0, 0, 0, ROOM.wall);
  plaster.addColorStop(0, '#e7d6bb');
  plaster.addColorStop(1, '#d6c2a3');
  c.fillStyle = plaster;
  c.fillRect(0, 0, ROOM.w, ROOM.wall);
  // A tent has canvas walls; a burrow has plaster and a beam.
  if (g.homeLevel === 0) {
    c.fillStyle = '#e8c982';
    c.fillRect(0, 0, ROOM.w, ROOM.wall);
    c.strokeStyle = 'rgba(150,110,60,0.35)';
    c.lineWidth = 2;
    for (let i = -ROOM.wall; i < ROOM.w; i += 34) { c.beginPath(); c.moveTo(i, ROOM.wall); c.lineTo(i + ROOM.wall * 0.6, 0); c.stroke(); }
  } else {
    c.fillStyle = shade('#a97f52', 0.1);
    c.fillRect(0, ROOM.wall - 16, ROOM.w, 10);
  }
  // The window looks out on the same sky the village is under.
  const sky = g.isNight ? '#26314f' : g.weather === 'clear' ? '#9fd0ea' : g.weather === 'rain' ? '#8fa3b4' : '#cdd8de';
  c.fillStyle = sky;
  c.beginPath(); c.roundRect(62, 34, 132, 86, 6); c.fill();
  if (g.isNight) {
    c.fillStyle = 'rgba(255,248,214,0.9)';
    for (const [sx, sy, r] of [[92, 58, 1.6], [140, 48, 1.2], [168, 80, 1.4], [110, 92, 1]] as const) { c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,250,224,0.95)';
    c.beginPath(); c.arc(160, 62, 11, 0, Math.PI * 2); c.fill();
  } else {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(110, 66, 26, 12, -0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(154, 88, 20, 9, 0.1, 0, Math.PI * 2); c.fill();
  }
  if (g.weather === 'rain') {
    c.strokeStyle = 'rgba(230,240,250,0.6)'; c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 22; i++) { const rx = 66 + ((i * 53 + time * 120) % 124), ry = 36 + ((i * 37 + time * 220) % 80); c.moveTo(rx, ry); c.lineTo(rx - 2, ry + 9); }
    c.stroke();
  }
  c.fillStyle = '#8f6540';
  c.fillRect(122, 34, 6, 86); c.fillRect(62, 72, 132, 6);
  c.beginPath(); c.roundRect(62, 34, 132, 86, 6); stroke(2.4, 'rgba(90,64,40,0.85)');
  // The door back to the hollow.
  c.fillStyle = '#7c5334';
  c.beginPath(); c.roundRect(ROOM.w - 150, 40, 96, ROOM.wall - 40, [8, 8, 0, 0]); c.fill();
  stroke(2, 'rgba(70,48,30,0.8)');
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.beginPath(); c.roundRect(ROOM.w - 140, 52, 76, 42, 4); c.fill();
  c.fillStyle = '#e8c26a';
  c.beginPath(); c.arc(ROOM.w - 66, 112, 4.5, 0, Math.PI * 2); c.fill();

  // Floorboards run left to right, lighter toward the window.
  const floor = c.createLinearGradient(0, ROOM.wall, ROOM.w, ROOM.h);
  floor.addColorStop(0, WOOD[2]);
  floor.addColorStop(1, WOOD[1]);
  c.fillStyle = floor;
  c.fillRect(0, ROOM.wall, ROOM.w, ROOM.h - ROOM.wall);
  c.strokeStyle = 'rgba(110,78,46,0.28)';
  c.lineWidth = 1.4;
  c.beginPath();
  for (let y = ROOM.wall + 18; y < ROOM.h; y += 22) { c.moveTo(0, y); c.lineTo(ROOM.w, y); }
  c.stroke();
  c.strokeStyle = 'rgba(110,78,46,0.16)';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 14; i++) { const bx = ((i * 137) % ROOM.w), band = Math.floor(i / 3) * 22; c.moveTo(bx, ROOM.wall + 18 + band); c.lineTo(bx, ROOM.wall + 40 + band); }
  c.stroke();
  // The wall throws a shadow onto the first foot of floor.
  const skirt = c.createLinearGradient(0, ROOM.wall, 0, ROOM.wall + 26);
  skirt.addColorStop(0, 'rgba(60,42,26,0.32)');
  skirt.addColorStop(1, 'rgba(60,42,26,0)');
  c.fillStyle = skirt;
  c.fillRect(0, ROOM.wall, ROOM.w, 26);

  // ---- the tile grid ------------------------------------------------------
  const holding = !!picked;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const r = tileRect(cols, rows, x, y), here = g.furnitureAt(x, y);
    c.beginPath();
    c.roundRect(r.x, r.y, r.w, r.h, 6);
    if (!here && holding) {
      c.fillStyle = 'rgba(255,250,240,0.22)';
      c.fill();
      c.setLineDash([6, 5]);
      stroke(1.6, 'rgba(95,138,74,0.85)');
      c.setLineDash([]);
    } else {
      c.fillStyle = 'rgba(90,62,36,0.06)';
      c.fill();
      stroke(1, 'rgba(110,78,46,0.18)');
    }
  }

  // ---- light pools, under the furniture so they read as light on the floor --
  const lamp = g.furniture.find((p) => p.id === 'lamp');
  const stove = g.furniture.find((p) => p.id === 'stove');
  if (lamp) {
    const r = tileRect(cols, rows, lamp.x, lamp.y);
    const pool = c.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.6, 4, r.x + r.w / 2, r.y + r.h * 0.6, r.w * 1.5);
    pool.addColorStop(0, `rgba(255,214,130,${g.isNight ? 0.5 : 0.26})`);
    pool.addColorStop(1, 'rgba(255,214,130,0)');
    c.fillStyle = pool;
    c.fillRect(r.x - r.w * 1.6, r.y - r.h * 1.6, r.w * 3.4, r.h * 3.4);
  }
  if (stove) {
    const r = tileRect(cols, rows, stove.x, stove.y);
    const flicker = 0.26 + Math.sin(time * 7) * 0.05 + Math.sin(time * 3.3) * 0.03;
    const pool = c.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.7, 3, r.x + r.w / 2, r.y + r.h * 0.7, r.w * 1.25);
    pool.addColorStop(0, `rgba(255,150,70,${flicker})`);
    pool.addColorStop(1, 'rgba(255,150,70,0)');
    c.fillStyle = pool;
    c.fillRect(r.x - r.w * 1.4, r.y - r.h * 1.4, r.w * 3, r.h * 3);
  }

  // ---- the furniture, back row first --------------------------------------
  for (const p of [...g.furniture].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = tileRect(cols, rows, p.x, p.y);
    const cx = r.x + r.w / 2, base = r.y + r.h - 5;
    const lifted = picked?.placed === p;
    c.save();
    if (lifted) { c.globalAlpha = 0.55; c.translate(0, -7); }
    drop(cx, base + 2, r.w * 0.34, r.h * 0.12);
    piece(c, p.id, cx, base, Math.min(r.w, r.h * 1.6), stroke, time);
    c.restore();
    if (lifted) {
      c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 6);
      stroke(2.4, '#8a4b7a');
    }
  }

  // ---- grade, then the caption -------------------------------------------
  c.globalCompositeOperation = 'overlay';
  c.fillStyle = 'rgba(255,214,150,0.08)';
  c.fillRect(0, 0, ROOM.w, ROOM.h);
  c.globalCompositeOperation = 'source-over';
  if (g.isNight && !lamp && !stove) { c.fillStyle = 'rgba(16,26,58,0.3)'; c.fillRect(0, 0, ROOM.w, ROOM.h); }
  const v = c.createRadialGradient(ROOM.w / 2, ROOM.h / 2, ROOM.h * 0.5, ROOM.w / 2, ROOM.h / 2, ROOM.h * 1.05);
  v.addColorStop(0, 'rgba(30,22,14,0)');
  v.addColorStop(1, 'rgba(30,22,14,0.22)');
  c.fillStyle = v;
  c.fillRect(0, 0, ROOM.w, ROOM.h);
  const sets = g.completeSets;
  if (sets.length) {
    const named = sets.length > 1 ? `${sets.slice(0, -1).join(', ')} and ${sets[sets.length - 1]}` : sets[0];
    const text = `${named} set${sets.length > 1 ? 's' : ''} complete`;
    c.font = 'italic 17px Georgia, serif';
    c.textAlign = 'center';
    const w = c.measureText(text).width + 28;
    c.fillStyle = 'rgba(52,48,42,0.82)';
    c.beginPath(); c.roundRect(ROOM.w / 2 - w / 2, ROOM.h - 34, w, 24, 12); c.fill();
    c.fillStyle = '#ffe6a8';
    c.fillText(text, ROOM.w / 2, ROOM.h - 17);
  }
}

type Stroke = (width?: number, color?: string) => void;

/** One piece of furniture, standing on (cx, base), scaled to fit a tile of size s. */
function piece(c: CanvasRenderingContext2D, id: string, cx: number, base: number, s: number, stroke: Stroke, time: number) {
  const u = s / 100; // every measurement below is in hundredths of a tile
  const box = (x: number, y: number, w: number, h: number, fill: string, radius = 3 * u) => {
    c.fillStyle = fill;
    c.beginPath(); c.roundRect(cx + x * u, base + y * u, w * u, h * u, radius); c.fill();
    stroke(1.3);
  };
  if (id.startsWith('photo-')) {
    const who = NEIGHBOURS.find((v) => `photo-${v.id}` === id);
    box(-26, -62, 52, 62, '#d9b27a', 4 * u);
    box(-20, -56, 40, 44, '#f6efe0', 2 * u);
    c.fillStyle = SPECIES_BODY[who?.species ?? 'viscacha'] ?? '#b7a58c';
    c.beginPath(); c.ellipse(cx, base - 26 * u, 12 * u, 13 * u, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx, base - 40 * u, 9 * u, 0, Math.PI * 2); c.fill();
    stroke(1.1);
    c.fillStyle = '#2a2420';
    c.beginPath(); c.arc(cx - 3.4 * u, base - 41 * u, 1.5 * u, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 3.4 * u, base - 41 * u, 1.5 * u, 0, Math.PI * 2); c.fill();
    return;
  }
  if (id.startsWith('plaque-')) {
    box(-28, -54, 56, 54, '#8a6a44', 4 * u);
    box(-22, -48, 44, 36, '#f3e6cc', 2 * u);
    c.fillStyle = id === 'plaque-fish' ? '#5fa8cf' : id === 'plaque-bug' ? '#7fbf5a' : '#c29a5e';
    c.beginPath(); c.arc(cx, base - 30 * u, 11 * u, 0, Math.PI * 2); c.fill();
    stroke(1.2);
    c.fillStyle = '#fffaf0';
    c.font = `bold ${13 * u}px Arial`;
    c.textAlign = 'center';
    c.fillText(id === 'plaque-fish' ? '🐟' : id === 'plaque-bug' ? '🐛' : '🦴', cx, base - 25 * u);
    return;
  }
  switch (id) {
    case 'bed': {
      box(-40, -30, 80, 30, '#b5854f', 4 * u);
      box(-40, -46, 26, 20, '#a2763f', 4 * u);       // headboard
      box(-30, -42, 62, 18, '#f3e7cf', 6 * u);       // hay mattress
      box(-26, -44, 22, 14, '#fffaf0', 5 * u);       // pillow
      c.fillStyle = 'rgba(160,120,70,0.5)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(cx + (-16 + i * 12) * u, base - 32 * u, 5 * u, 2 * u, 0.3, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'tub': {
      box(-34, -34, 68, 34, '#b9c8d2', 10 * u);
      c.fillStyle = '#e8dcc0';
      c.beginPath(); c.ellipse(cx, base - 30 * u, 28 * u, 8 * u, 0, 0, Math.PI * 2); c.fill();
      stroke(1.2);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      for (const [dx, dy, r] of [[-12, -34, 4], [4, -37, 5], [15, -33, 3]] as const) { c.beginPath(); c.arc(cx + dx * u, base + dy * u, r * u, 0, Math.PI * 2); c.fill(); }
      break;
    }
    case 'table': {
      box(-36, -8, 8, 8, '#8f6134', 1 * u);
      box(28, -8, 8, 8, '#8f6134', 1 * u);
      box(-38, -36, 76, 10, '#c2915a', 3 * u);
      box(-30, -30, 60, 24, '#a97c48', 2 * u);
      c.fillStyle = '#e2413c';
      c.beginPath(); c.arc(cx + 12 * u, base - 42 * u, 5 * u, 0, Math.PI * 2); c.fill();
      stroke(1.1);
      break;
    }
    case 'rug': {
      c.fillStyle = '#c9705f';
      c.beginPath(); c.ellipse(cx, base - 10 * u, 44 * u, 16 * u, 0, 0, Math.PI * 2); c.fill();
      stroke(1.4);
      c.fillStyle = '#f0d6a8';
      c.beginPath(); c.ellipse(cx, base - 10 * u, 30 * u, 10 * u, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a4b5a';
      c.beginPath(); c.ellipse(cx, base - 10 * u, 14 * u, 5 * u, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'shelf': {
      box(-34, -70, 68, 70, '#a97c4c', 3 * u);
      c.fillStyle = 'rgba(70,48,28,0.35)';
      for (const y of [-48, -26]) c.fillRect(cx - 30 * u, base + y * u, 60 * u, 3 * u);
      const books = ['#c2453c', '#4f8ac0', '#e0a94a', '#6aa85c', '#9a6cd6'];
      for (let i = 0; i < 5; i++) {
        c.fillStyle = books[i];
        const bh = (16 + (i % 3) * 4) * u;
        c.fillRect(cx + (-27 + i * 11) * u, base - 48 * u - bh, 8 * u, bh);
      }
      for (let i = 0; i < 3; i++) {
        c.fillStyle = books[(i + 2) % 5];
        c.fillRect(cx + (-25 + i * 11) * u, base - 26 * u - 14 * u, 8 * u, 14 * u);
      }
      break;
    }
    case 'lamp': {
      box(-8, -12, 16, 12, '#8f6134', 2 * u);
      c.fillStyle = '#8f6134';
      c.fillRect(cx - 2 * u, base - 46 * u, 4 * u, 36 * u);
      const glow = c.createRadialGradient(cx, base - 56 * u, 2, cx, base - 56 * u, 34 * u);
      glow.addColorStop(0, 'rgba(255,220,150,0.85)');
      glow.addColorStop(1, 'rgba(255,220,150,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(cx, base - 56 * u, 34 * u, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fbe6b4';
      c.beginPath();
      c.moveTo(cx - 20 * u, base - 44 * u); c.lineTo(cx - 13 * u, base - 68 * u);
      c.lineTo(cx + 13 * u, base - 68 * u); c.lineTo(cx + 20 * u, base - 44 * u);
      c.closePath(); c.fill();
      stroke(1.3);
      break;
    }
    case 'stove': {
      box(-30, -50, 60, 50, '#8e8983', 4 * u);
      c.fillStyle = '#6f6a64';
      c.fillRect(cx + 8 * u, base - 78 * u, 12 * u, 30 * u);          // flue
      stroke(1.2);
      const fire = 0.7 + Math.sin(time * 9) * 0.2;
      c.fillStyle = '#3a3430';
      c.beginPath(); c.roundRect(cx - 18 * u, base - 38 * u, 30 * u, 22 * u, 3 * u); c.fill();
      c.fillStyle = `rgba(255,150,60,${fire})`;
      c.beginPath();
      c.moveTo(cx - 12 * u, base - 18 * u);
      c.quadraticCurveTo(cx - 6 * u, base - 34 * u, cx - 1 * u, base - 20 * u);
      c.quadraticCurveTo(cx + 3 * u, base - 36 * u, cx + 7 * u, base - 18 * u);
      c.closePath(); c.fill();
      c.fillStyle = `rgba(255,232,150,${fire * 0.8})`;
      c.beginPath(); c.ellipse(cx - 3 * u, base - 21 * u, 4 * u, 6 * u, 0, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'cactus': {
      box(-18, -20, 36, 20, '#c08350', 3 * u);
      c.fillStyle = '#5fa05a';
      c.beginPath(); c.roundRect(cx - 8 * u, base - 62 * u, 16 * u, 46 * u, 8 * u); c.fill();
      stroke(1.3);
      c.beginPath(); c.roundRect(cx - 22 * u, base - 50 * u, 12 * u, 22 * u, 6 * u); c.fill();
      stroke(1.3);
      c.fillStyle = '#f4a3c4';
      c.beginPath(); c.arc(cx, base - 64 * u, 5 * u, 0, Math.PI * 2); c.fill();
      stroke(1.1);
      break;
    }
    case 'hammock': {
      box(-42, -64, 8, 64, '#8f6134', 2 * u);
      box(34, -64, 8, 64, '#8f6134', 2 * u);
      c.fillStyle = '#e6d3a8';
      c.beginPath();
      c.moveTo(cx - 36 * u, base - 54 * u);
      c.quadraticCurveTo(cx, base - 14 * u, cx + 36 * u, base - 54 * u);
      c.quadraticCurveTo(cx, base - 32 * u, cx - 36 * u, base - 54 * u);
      c.closePath(); c.fill();
      stroke(1.4);
      c.strokeStyle = 'rgba(150,110,70,0.5)'; c.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        c.beginPath();
        c.moveTo(cx + (-36 + 72 * t) * u, base - 54 * u);
        c.lineTo(cx + (-36 + 72 * t) * u, base - (54 - 34 * Math.sin(Math.PI * t)) * u);
        c.stroke();
      }
      break;
    }
    case 'chart': {
      box(-36, -58, 72, 58, '#8a6a44', 3 * u);
      box(-30, -52, 60, 46, '#efe0bd', 2 * u);
      c.strokeStyle = 'rgba(90,120,150,0.75)'; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(cx - 24 * u, base - 20 * u);
      c.quadraticCurveTo(cx - 6 * u, base - 34 * u, cx + 8 * u, base - 18 * u);
      c.quadraticCurveTo(cx + 18 * u, base - 10 * u, cx + 24 * u, base - 22 * u);
      c.stroke();
      c.fillStyle = '#c2453c';
      c.beginPath(); c.moveTo(cx + 6 * u, base - 40 * u); c.lineTo(cx + 12 * u, base - 34 * u); c.lineTo(cx + 6 * u, base - 28 * u); c.closePath(); c.fill();
      break;
    }
    case 'poncho': {
      box(-4, -70, 8, 70, '#8f6134', 2 * u);
      c.fillStyle = '#c9553f';
      c.beginPath();
      c.moveTo(cx - 30 * u, base - 62 * u); c.lineTo(cx + 30 * u, base - 62 * u);
      c.lineTo(cx + 22 * u, base - 8 * u); c.lineTo(cx - 22 * u, base - 8 * u);
      c.closePath(); c.fill();
      stroke(1.4);
      for (const [y, col] of [[-48, '#f0d6a8'], [-36, '#4f8ac0'], [-24, '#e0a94a']] as const) {
        c.fillStyle = col;
        c.fillRect(cx - 27 * u, base + y * u, 54 * u, 5 * u);
      }
      break;
    }
    case 'quena': {
      box(-20, -12, 40, 12, '#8f6134', 2 * u);
      c.fillStyle = '#c2915a';
      c.fillRect(cx - 3 * u, base - 64 * u, 6 * u, 54 * u);
      stroke(1.2);
      c.fillStyle = '#5a3f26';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(cx, base - (52 - i * 8) * u, 1.4 * u, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(138,75,122,0.8)';
      c.font = `${14 * u}px Arial`;
      c.textAlign = 'center';
      c.fillText('♪', cx + 16 * u, base - (56 + Math.sin(time * 2) * 4) * u);
      break;
    }
    case 'trophy': {
      box(-20, -14, 40, 14, '#7a5a34', 3 * u);
      c.fillStyle = '#e8c463';
      c.beginPath();
      c.moveTo(cx - 18 * u, base - 56 * u);
      c.quadraticCurveTo(cx, base - 22 * u, cx + 18 * u, base - 56 * u);
      c.closePath(); c.fill();
      stroke(1.4);
      c.fillRect(cx - 3 * u, base - 24 * u, 6 * u, 12 * u);
      c.beginPath(); c.arc(cx - 22 * u, base - 48 * u, 7 * u, 0, Math.PI * 2); stroke(2, '#e8c463');
      c.beginPath(); c.arc(cx + 22 * u, base - 48 * u, 7 * u, 0, Math.PI * 2); stroke(2, '#e8c463');
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(cx - 6 * u, base - 46 * u, 3 * u, 7 * u, -0.3, 0, Math.PI * 2); c.fill();
      break;
    }
    default: {
      box(-26, -40, 52, 40, '#bba078', 4 * u);
      break;
    }
  }
}

/** Short line under the room describing what the burrow is worth and why. */
export function roomCaption(g: Hollow) {
  const [cols, rows] = g.roomSize;
  const filled = g.furniture.length;
  if (!filled) return `Bare boards. ${HERO_NAMES[g.hero]} could fit ${cols * rows} pieces in here.`;
  const best = FURNITURE.filter((f) => g.furniture.some((p) => p.id === f.id)).sort((a, b) => b.price - a.price)[0];
  return `${filled} of ${cols * rows} tiles furnished. The ${best.name.toLowerCase()} is the piece that carries the room.`;
}
