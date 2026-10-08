import { COLORS, TYPES, MAPS, WIDTH, HEIGHT, CAPACITY, GRACE, type Game, type Kind, type Station } from './burrow-express-game';
type C = CanvasRenderingContext2D;
type Point = { x: number; y: number };
type Crop = { image: HTMLImageElement; x: number; y: number; w: number; h: number };
export type Graphic = 'empty' | 'dora' | 'enzo' | 'duo' | 'drill' | 'rocks';
const images = new Map<string, HTMLImageElement>(), sprites = new Map<string, Crop>();
let loading: Promise<void> | null = null;
const oval = (c: C, x: number, y: number, rx: number, ry: number, fill: string) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
const box = (c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1.5; c.stroke(); } };
const text = (c: C, s: string, x: number, y: number, size: number, fill = '#fff6df') => { c.font = `700 ${size}px Trebuchet MS, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = fill; c.fillText(s, x, y); };

/** Trim only the transparent padding at draw time. The authored PNGs remain intact. */
function atlas(image: HTMLImageElement, names: string[]) {
  const cv = document.createElement('canvas'); cv.width = image.width; cv.height = image.height;
  const c = cv.getContext('2d', { willReadFrequently: true })!; c.drawImage(image, 0, 0);
  const alpha = c.getImageData(0, 0, cv.width, cv.height).data, cw = cv.width / 3, ch = cv.height / 2;
  names.forEach((name, i) => {
    const left = Math.round(i % 3 * cw), top = Math.round(Math.floor(i / 3) * ch), right = Math.round(left + cw), bottom = Math.round(top + ch);
    let x0 = right, y0 = bottom, x1 = left, y1 = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (alpha[(y * cv.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < x0 || y1 < y0) throw new Error('The warren sprite artwork is empty.');
    const pad = 2; x0 = Math.max(left, x0 - pad); y0 = Math.max(top, y0 - pad); x1 = Math.min(right - 1, x1 + pad); y1 = Math.min(bottom - 1, y1 + pad);
    sprites.set(name, { image, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  });
}
export function loadArt(): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(['terrain', 'stations', 'carts', 'duo'].map((key) => new Promise<void>((resolve, reject) => {
    const image = new Image(); image.onload = () => { images.set(key, image); resolve(); }; image.onerror = () => reject(new Error('The warren artwork could not load.')); image.src = `/art/express/${key}.png`;
  }))).then(() => {
    atlas(images.get('stations')!, ['home', 'hay', 'dust', 'retreat', 'mushroom', 'root']);
    atlas(images.get('carts')!, ['empty', 'dora', 'enzo', 'duo', 'drill', 'rocks']);
  });
  return loading;
}
/** Fit authored sprites without stretching their perspective or cutting off ears and foliage. */
function sprite(c: C, key: string, x: number, y: number, w: number, h: number) {
  const s = sprites.get(key); if (!s) return;
  const k = Math.min(w / s.w, h / s.h), dw = s.w * k, dh = s.h * k;
  c.drawImage(s.image, s.x, s.y, s.w, s.h, x + (w - dw) / 2, y + h - dh, dw, dh);
}
export function graphic(c: C, id: Graphic, w: number, h: number) { c.clearRect(0, 0, w, h); sprite(c, id, 1, 1, w - 2, h - 2); }
export function symbol(c: C, kind: Kind, x: number, y: number, size: number) {
  c.save(); c.translate(x, y); c.fillStyle = TYPES[kind].color; c.strokeStyle = '#352735'; c.lineWidth = 1.5; c.beginPath();
  if (kind === 'home') c.arc(0, 0, size, 0, Math.PI * 2);
  else if (kind === 'hay') c.rect(-size, -size, size * 2, size * 2);
  else if (kind === 'dust') { c.moveTo(0, -size * 1.3); c.lineTo(size * 1.2, 0); c.lineTo(0, size * 1.3); c.lineTo(-size * 1.2, 0); c.closePath(); }
  else { c.moveTo(0, -size * 1.3); c.lineTo(size * 1.2, size); c.lineTo(-size * 1.2, size); c.closePath(); }
  c.fill(); c.stroke(); c.restore();
}
function building(c: C, s: Station, now: number) {
  const key = s.kind === 'home' && s.id === 4 ? 'mushroom' : s.kind === 'hay' && s.id === 5 ? 'root' : s.kind;
  const w = s.kind === 'retreat' ? 155 : s.kind === 'dust' ? 136 : 148, h = Math.min(s.y + 13, s.kind === 'dust' ? 94 : s.kind === 'retreat' ? 125 : 118);
  sprite(c, key, s.x - w / 2, Math.max(3, s.y - h + 16), w, h);
  if (s.kind === 'dust') for (let i = 0; i < 3; i++) { const t = (now * 0.2 + i / 3) % 1; oval(c, s.x - 14 + i * 14, s.y - 48 - t * 24, 7 + t * 7, 4 + t * 4, `rgba(244,232,221,${0.24 * (1 - t)})`); }
  const badge = s.kind === 'dust' ? 47 : 52; box(c, s.x + badge - 10, s.y - 49, 22, 25, 4, '#293d38', '#bfbd83'); symbol(c, s.kind, s.x + badge + 1, s.y - 36, 6);
}
function curve(a: Point, b: Point): Point[] {
  const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y), mid = horizontal ? (a.x + b.x) / 2 : (a.y + b.y) / 2;
  const p = horizontal ? { x: mid, y: a.y } : { x: a.x, y: mid }, q = horizontal ? { x: mid, y: b.y } : { x: b.x, y: mid };
  return Array.from({ length: 49 }, (_, i) => { const t = i / 48, u = 1 - t; return { x: u ** 3 * a.x + 3 * u * u * t * p.x + 3 * u * t * t * q.x + t ** 3 * b.x, y: u ** 3 * a.y + 3 * u * u * t * p.y + 3 * u * t * t * q.y + t ** 3 * b.y }; });
}
type Track = { points: Point[]; lengths: number[]; total: number };
const tracks = new Map<string, Track>();
function track(a: Point, b: Point, cached = true): Track {
  const key = `${a.x},${a.y}:${b.x},${b.y}`, found = cached ? tracks.get(key) : null; if (found) return found;
  const points = curve(a, b), lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const result = { points, lengths, total: lengths.at(-1)! }; if (cached) tracks.set(key, result); return result;
}
function along(t: Track, fraction: number) {
  const d = Math.max(0, Math.min(1, fraction)) * t.total;
  let i = 1; while (i < t.lengths.length - 1 && t.lengths[i] < d) i++;
  const a = t.points[i - 1], b = t.points[i], f = (d - t.lengths[i - 1]) / Math.max(0.01, t.lengths[i] - t.lengths[i - 1]);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: b.x - a.x, dy: b.y - a.y };
}
function path(c: C, t: Track) { c.beginPath(); t.points.forEach((p, i) => { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); }
export class Stage {
  private backdrop: HTMLCanvasElement | null = null; private map = -1;
  pick(g: Game, x: number, y: number, pixelWidth: number): number | null {
    const radius = Math.max(34, WIDTH / pixelWidth * 20);
    const s = g.active.map((s) => ({ s, d: Math.hypot(s.x - x, s.y - y) })).filter(({ s, d }) => d <= radius || Math.abs(s.x - x) <= 70 && y >= Math.max(3, s.y - (s.kind === 'dust' ? 70 : 103)) && y <= s.y + 18 || pixelWidth >= 640 && Math.abs(s.x - x) <= 78 && y - s.y >= 55 && y - s.y <= 81).sort((a, b) => a.d - b.d)[0];
    return s?.s.id ?? null;
  }
  private ground(g: Game) {
    if (this.backdrop && this.map === g.map) return this.backdrop;
    const cv = document.createElement('canvas'); cv.width = WIDTH * 2; cv.height = HEIGHT * 2; const c = cv.getContext('2d')!; c.scale(2, 2);
    c.drawImage(images.get('terrain')!, 0, 0, WIDTH, HEIGHT);
    if (g.map === 1) { c.fillStyle = 'rgba(21,74,70,.16)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
    if (g.map === 2) { c.fillStyle = 'rgba(29,34,75,.34)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
    for (const r of MAPS[g.map].rocks) sprite(c, 'rocks', r.x - r.r * 1.35, r.y - r.r * 0.9, r.r * 2.7, r.r * 1.8);
    this.backdrop = cv; this.map = g.map; return cv;
  }
  draw(c: C, w: number, h: number, dpr: number, g: Game, now: number, o: { line: number; hover: number | null; cursor: number | null; drag: Point | null }) {
    c.setTransform(dpr * w / WIDTH, 0, 0, dpr * h / HEIGHT, 0, 0); c.clearRect(0, 0, WIDTH, HEIGHT);
    if (!images.has('terrain') || sprites.size < 12) return;
    c.drawImage(this.ground(g), 0, 0, WIDTH, HEIGHT);
    for (const l of g.lines) {
      const stops = l.loop ? [...l.stops, l.stops[0]] : l.stops;
      for (let i = 1; i < stops.length; i++) {
        const t = track(g.stations[stops[i - 1]], g.stations[stops[i]]);
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#27261acc'; c.shadowBlur = 5; c.shadowOffsetY = 3;
        path(c, t); c.strokeStyle = '#37402d'; c.lineWidth = 23; c.stroke(); c.shadowBlur = 0; c.shadowOffsetY = 0;
        path(c, t); c.strokeStyle = '#ebdba3'; c.lineWidth = 18; c.stroke(); path(c, t); c.strokeStyle = COLORS[l.id]; c.lineWidth = 14; c.stroke();
        path(c, t); c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 3; c.stroke(); c.restore();
        if (g.bored.includes(`${Math.min(stops[i - 1], stops[i])}:${Math.max(stops[i - 1], stops[i])}`)) { const p = along(t, .5); oval(c, p.x, p.y, 11, 9, '#4c5041'); oval(c, p.x, p.y - 1, 7, 5, COLORS[l.id]); }
      }
    }
    const last = g.lines[o.line]?.stops.at(-1) ?? (o.drag ? o.cursor ?? undefined : undefined), aim = o.drag ?? (o.hover !== null ? g.stations[o.hover] : null);
    if (last !== undefined && aim && g.state === 'running') { path(c, track(g.stations[last], aim, false)); c.setLineDash([7, 8]); c.strokeStyle = '#fff5d9'; c.lineWidth = 3; c.stroke(); c.setLineDash([]); }
    if (g.block) { const p = along(track(g.stations[g.block.a], g.stations[g.block.b]), .5); oval(c, p.x, p.y, 22, 22, '#412b36'); text(c, '×', p.x, p.y, 32, '#ffb399'); }
    const open = [...g.active].sort((a, b) => a.y - b.y);
    for (const s of open) {
      if (o.hover === s.id || o.cursor === s.id) { c.strokeStyle = '#f9df9a'; c.lineWidth = 3; c.beginPath(); c.ellipse(s.x, s.y + 3, 67, 25, 0, 0, Math.PI * 2); c.stroke(); }
      building(c, s, now);
    }
    for (const cart of g.carts) {
      const a = g.stations[cart.at], b = g.stations[cart.to] ?? a, p = cart.to < 0 ? { ...a, dx: cart.dir, dy: 0 } : along(track(a, b), cart.progress);
      const id = cart.pax.length >= 2 ? 'duo' : cart.pax.length ? cart.pax[0].id % 2 ? 'dora' : 'enzo' : 'empty';
      c.save(); c.translate(p.x, p.y + 8); if (p.dx < 0) c.scale(-1, 1);
      sprite(c, id, -38, -67, 76, 80); c.restore();
      if (cart.pax.length) { box(c, p.x + 18, p.y - 47, 24, 20, 7, '#33263c', '#ad8d86'); text(c, String(cart.pax.length), p.x + 30, p.y - 37, 12); }
      box(c, p.x - 17, p.y + 10, 34, 4, 2, COLORS[cart.line]);
    }
    for (const s of open) {
      if (w >= 640) { box(c, s.x - 78, s.y + 55, 156, 25, 6, '#173334', '#c2ba86'); text(c, s.name, s.x, s.y + 67, 13); }
      const y = s.y + (w >= 640 ? 88 : 33), count = Math.min(s.queue.length, CAPACITY);
      if (count) box(c, s.x - 40, y - 10, 80, s.queue.length > 4 ? 33 : 20, 9, 'rgba(35,30,29,.8)');
      for (let i = 0; i < count; i++) symbol(c, s.queue[i].dest, s.x + (i % 4 - 1.5) * 17, y + Math.floor(i / 4) * 13, 5.5);
      if (s.queue.length >= CAPACITY) { box(c, s.x + 42, y - 10, 44, 24, 8, '#efbc50', '#a77238'); text(c, `${s.queue.length}/${CAPACITY}`, s.x + 64, y + 2, 12, '#372334'); }
      if (s.crowd > 0) { c.beginPath(); c.arc(s.x, s.y, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.crowd / GRACE); c.strokeStyle = '#ffbd60'; c.lineWidth = 5; c.stroke(); }
    }
  }
}
