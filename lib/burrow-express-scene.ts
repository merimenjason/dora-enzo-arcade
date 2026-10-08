import { COLORS, TYPES, MAPS, WIDTH, HEIGHT, CAPACITY, GRACE, type Game, type Kind, type Station } from './burrow-express-game';
import { drawChinchilla, type ChinId } from './chinchilla-art';
import { fitDraw } from './art-fit';
type C = CanvasRenderingContext2D;
const oval = (c: C, x: number, y: number, rx: number, ry: number, fill: string) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
const box = (c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } };
const text = (c: C, s: string, x: number, y: number, size: number, fill = '#fff9e9') => { c.font = `700 ${size}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fill; c.fillText(s, x, y); };
function tree(c: C, x: number, y: number, h: number, shade: string) {
  c.fillStyle = '#554337'; c.fillRect(x - 3, y - 10, 6, 16);
  for (let i = 0; i < 3; i++) { const top = y - h + i * h * 0.24; c.beginPath(); c.moveTo(x, top); c.lineTo(x + h * (0.2 + i * 0.06), top + h * 0.55); c.lineTo(x - h * (0.2 + i * 0.06), top + h * 0.55); c.closePath(); c.fillStyle = shade; c.fill(); }
}
/** The four destination symbols also appear on every waiting passenger. */
export function symbol(c: C, kind: Kind, x: number, y: number, size: number) {
  c.save(); c.translate(x, y); c.fillStyle = TYPES[kind].color; c.strokeStyle = '#332a3d'; c.lineWidth = 1.5;
  c.beginPath();
  if (kind === 'home') c.arc(0, 0, size, 0, Math.PI * 2);
  else if (kind === 'hay') c.rect(-size, -size, size * 2, size * 2);
  else if (kind === 'dust') { c.moveTo(0, -size * 1.3); c.lineTo(size * 1.2, 0); c.lineTo(0, size * 1.3); c.lineTo(-size * 1.2, 0); c.closePath(); }
  else { c.moveTo(0, -size * 1.3); c.lineTo(size * 1.2, size); c.lineTo(-size * 1.2, size); c.closePath(); }
  c.fill(); c.stroke(); c.restore();
}
function building(c: C, s: Station, time: number) {
  const { x, y, kind } = s;
  oval(c, x, y + 15, 40, 11, 'rgba(22,24,17,.25)');
  if (kind === 'dust') {
    oval(c, x, y, 35, 24, '#594849'); oval(c, x, y - 3, 30, 20, '#bcb4c2'); oval(c, x, y - 8, 24, 11, '#ded5cc');
    for (let i = 0; i < 3; i++) { const t = (time * 0.3 + i * 0.33) % 1; oval(c, x - 12 + i * 12, y - 20 - t * 24, 9 + t * 7, 5 + t * 4, `rgba(241,231,228,${0.5 * (1 - t)})`); }
  } else {
    const w = kind === 'retreat' ? 64 : 58;
    box(c, x - w / 2, y - 28, w, 44, 10, kind === 'hay' ? '#a0763a' : '#806246', '#4e4039');
    c.beginPath(); c.moveTo(x - w / 2 - 8, y - 18); c.lineTo(x, y - 54); c.lineTo(x + w / 2 + 8, y - 18); c.closePath(); c.fillStyle = kind === 'hay' ? '#d9b365' : kind === 'retreat' ? '#b5c6d4' : '#8a9970'; c.fill(); c.strokeStyle = '#4e4039'; c.lineWidth = 3; c.stroke();
    box(c, x - 10, y - 12, 20, 29, 9, '#352c31', '#a5824e');
    for (const dx of [-21, 21]) { box(c, x + dx - 5, y - 19, 10, 11, 3, '#ffe6a0', '#664331'); c.strokeStyle = '#80613e'; c.beginPath(); c.moveTo(x + dx, y - 19); c.lineTo(x + dx, y - 8); c.stroke(); }
    if (kind === 'hay') { for (const dx of [-34, 30]) { box(c, x + dx - 9, y - 2, 18, 15, 4, '#dab56b', '#93753e'); c.strokeStyle = '#b58942'; c.beginPath(); c.moveTo(x + dx - 6, y); c.lineTo(x + dx + 5, y + 10); c.stroke(); } }
  }
  symbol(c, kind, x + 37, y - 28, 8);
}
export function portrait(c: C, w: number, h: number) {
  c.clearRect(0, 0, w, h);
  const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#90bfd0'); sky.addColorStop(1, '#d7ddba'); c.fillStyle = sky; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) tree(c, w * (i / 3), h * 0.72, h * (0.3 + (i % 2) * 0.18), '#5b7c69');
  for (const [i, id] of (['dora', 'enzo'] as ChinId[]).entries()) fitDraw(c, `express-portrait-${id}`, w * (0.06 + i * 0.46), h * 0.18, w * 0.43, h * 0.77, (q) => drawChinchilla(q, id, 0, 0, { face: 1, h: 48, time: 0.4 }));
}
export class Stage {
  private backdrop: HTMLCanvasElement | null = null; private map = -1;
  pick(g: Game, x: number, y: number, pixelWidth: number): number | null {
    const r = Math.max(40, WIDTH / pixelWidth * 20);
    const s = g.active.map((s) => ({ s, d: Math.hypot(s.x - x, s.y - y) })).filter((a) => a.d <= r || pixelWidth >= 640 && Math.abs(a.s.x - x) <= 65 && y - a.s.y >= 55 && y - a.s.y <= 80).sort((a, b) => a.d - b.d)[0];
    return s?.s.id ?? null;
  }
  private ground(g: Game) {
    if (this.backdrop && this.map === g.map) return this.backdrop;
    const cv = document.createElement('canvas'); cv.width = WIDTH; cv.height = HEIGHT; const c = cv.getContext('2d')!;
    const m = MAPS[g.map], gradient = c.createLinearGradient(0, 0, WIDTH, HEIGHT); gradient.addColorStop(0, m.tint); gradient.addColorStop(0.55, '#8c9860'); gradient.addColorStop(1, g.map === 2 ? '#69728c' : '#536c4c'); c.fillStyle = gradient; c.fillRect(0, 0, WIDTH, HEIGHT);
    let seed = g.map + 71; const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
    // Small painted patches and loose grass; the static picture is cached, never redrawn by the engine.
    for (let i = 0; i < 1200; i++) { const x = random() * WIDTH, y = random() * HEIGHT; oval(c, x, y, 2 + random() * 13, 1 + random() * 6, i % 4 ? 'rgba(217,213,154,.08)' : 'rgba(34,53,37,.12)'); }
    const river = () => { c.beginPath(); c.moveTo(m.stream - 60, -30); c.bezierCurveTo(m.stream + 100, 130, m.stream - 100, 360, m.stream + 20, HEIGHT + 30); };
    river(); c.strokeStyle = '#51634d'; c.lineWidth = 56; c.stroke(); river(); c.strokeStyle = '#aac5c5'; c.lineWidth = 36; c.stroke(); river(); c.strokeStyle = '#79acb9'; c.lineWidth = 21; c.stroke();
    for (let i = 0; i < 65; i++) {
      const x = random() * WIDTH, y = random() * HEIGHT;
      if (g.stations.some((s) => Math.hypot(s.x - x, s.y - y) < 64)) continue;
      tree(c, x, y, 25 + random() * 37, i % 3 ? '#426953' : '#638457');
    }
    for (const r of m.rocks) {
      oval(c, r.x, r.y + 13, r.r + 6, r.r * 0.72, 'rgba(25,26,25,.25)');
      for (let i = 0; i < 6; i++) { const a = i * 2.4, x = r.x + Math.cos(a) * r.r * 0.5, y = r.y + Math.sin(a) * r.r * 0.35; oval(c, x, y, r.r * 0.52, r.r * 0.42, ['#7e7c73', '#9d9a89', '#666b66'][i % 3]); c.strokeStyle = '#b4b19c'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, y - 8); c.lineTo(x + 6, y - 16); c.lineTo(x + 13, y - 9); c.stroke(); }
    }
    this.backdrop = cv; this.map = g.map; return cv;
  }
  draw(c: C, w: number, h: number, dpr: number, g: Game, now: number, o: { line: number; hover: number | null; cursor: number | null; drag: { x: number; y: number } | null }) {
    c.setTransform(dpr * w / WIDTH, 0, 0, dpr * h / HEIGHT, 0, 0); c.clearRect(0, 0, WIDTH, HEIGHT); c.drawImage(this.ground(g), 0, 0);
    for (const l of g.lines) {
      if (l.stops.length < 2) continue;
      const stops = l.loop ? [...l.stops, l.stops[0]] : l.stops;
      c.lineCap = 'round'; c.lineJoin = 'round';
      const path = () => { c.beginPath(); for (const [i, id] of stops.entries()) { const s = g.stations[id]; if (i) c.lineTo(s.x, s.y); else c.moveTo(s.x, s.y); } };
      path(); c.strokeStyle = '#3e4240'; c.lineWidth = 19; c.stroke(); path(); c.strokeStyle = COLORS[l.id]; c.lineWidth = 12; c.stroke();
      path(); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 3; c.stroke();
    }
    const last = g.lines[o.line]?.stops.at(-1) ?? (o.drag ? o.cursor ?? undefined : undefined), aim = o.drag ?? (o.hover !== null ? g.stations[o.hover] : null);
    if (last !== undefined && aim && g.state === 'running') { c.beginPath(); c.moveTo(g.stations[last].x, g.stations[last].y); c.lineTo(aim.x, aim.y); c.setLineDash([8, 9]); c.strokeStyle = COLORS[o.line]; c.lineWidth = 4; c.stroke(); c.setLineDash([]); }
    if (g.block) { const a = g.stations[g.block.a], b = g.stations[g.block.b], x = (a.x + b.x) / 2, y = (a.y + b.y) / 2; oval(c, x, y, 22, 22, '#412b36'); text(c, '×', x, y, 32, '#ffb399'); }
    for (const s of g.active) {
      const picked = o.hover === s.id || o.cursor === s.id;
      if (picked) { oval(c, s.x, s.y, 48, 37, 'rgba(255,244,196,.28)'); c.strokeStyle = '#fff1ba'; c.lineWidth = 3; c.beginPath(); c.ellipse(s.x, s.y, 49, 38, 0, 0, Math.PI * 2); c.stroke(); }
      building(c, s, now);
      // Queues show destination shapes, not generic dots: a transfer decision is readable at a glance.
      const count = Math.min(s.queue.length, CAPACITY);
      for (let i = 0; i < count; i++) symbol(c, s.queue[i].dest, s.x + (i % 4 - 1.5) * 14, s.y + 32 + Math.floor(i / 4) * 14, 4.5);
      if (s.queue.length > CAPACITY) { box(c, s.x + 22, s.y + 23, 32, 24, 8, '#d36d62'); text(c, `+${s.queue.length - CAPACITY}`, s.x + 38, s.y + 35, 13); }
      if (s.crowd > 0) { c.beginPath(); c.arc(s.x, s.y, 47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.crowd / GRACE); c.strokeStyle = '#ffbd60'; c.lineWidth = 6; c.stroke(); }
      if (w >= 640) { box(c, s.x - 65, s.y + 56, 130, 23, 7, '#273d3c', '#718b71'); text(c, s.name, s.x, s.y + 67, 12); }
    }
    for (const cart of g.carts) {
      const p = g.position(cart), a = g.stations[cart.at], b = g.stations[cart.to] ?? a, face: 1 | -1 = b.x < a.x ? -1 : 1;
      c.save(); c.translate(p.x, p.y);
      oval(c, 0, 10, 26, 7, 'rgba(21,25,19,.32)');
      if (cart.pax.length) for (let i = 0; i < Math.min(2, cart.pax.length); i++) drawChinchilla(c, cart.pax[i].id % 2 ? 'dora' : 'enzo', -8 + i * 17, 1, { h: 22, face, time: now });
      box(c, -24, -3, 48, 18, 5, '#9c713e', '#523d30'); box(c, -21, -1, 42, 5, 2, COLORS[cart.line]);
      for (const x of [-16, 16]) { oval(c, x, 15, 6, 6, '#413330'); oval(c, x, 15, 2.5, 2.5, '#c7a976'); }
      if (cart.pax.length) { box(c, 13, -21, 24, 18, 6, '#30273d'); text(c, String(cart.pax.length), 25, -12, 12); }
      c.restore();
    }
    // A soft edge vignette keeps the map framed against the dark interface.
    const rim = c.createLinearGradient(0, 0, 0, HEIGHT); rim.addColorStop(0, 'rgba(28,25,33,.18)'); rim.addColorStop(0.2, 'rgba(28,25,33,0)'); rim.addColorStop(0.8, 'rgba(28,25,33,0)'); rim.addColorStop(1, 'rgba(28,25,33,.2)'); c.fillStyle = rim; c.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
