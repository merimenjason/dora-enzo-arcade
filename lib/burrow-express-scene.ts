import { COLORS, TYPES, MAPS, WIDTH, HEIGHT, CAPACITY, GRACE, type Game, type Kind, type Station, type Passenger, type Ev, type TransitEv } from './burrow-express-game';
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
function atlas(image: HTMLImageElement, names: string[], cols = 3, rows = 2, regions?: [number, number, number, number][]) {
  const cv = document.createElement('canvas'); cv.width = image.width; cv.height = image.height;
  const c = cv.getContext('2d', { willReadFrequently: true })!; c.drawImage(image, 0, 0);
  const alpha = c.getImageData(0, 0, cv.width, cv.height).data, cw = cv.width / cols, ch = cv.height / rows;
  names.forEach((name, i) => {
    const region = regions?.[i], left = region?.[0] ?? Math.round(i % cols * cw), top = region?.[1] ?? Math.round(Math.floor(i / cols) * ch), right = region ? left + region[2] : Math.round(left + cw), bottom = region ? top + region[3] : Math.round(top + ch);
    let x0 = right, y0 = bottom, x1 = left, y1 = top;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) if (alpha[(y * cv.width + x) * 4 + 3] > 24) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < x0 || y1 < y0) throw new Error('The warren sprite artwork is empty.');
    const pad = 2; x0 = Math.max(left, x0 - pad); y0 = Math.max(top, y0 - pad); x1 = Math.min(right - 1, x1 + pad); y1 = Math.min(bottom - 1, y1 + pad);
    sprites.set(name, { image, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  });
}
export function loadArt(): Promise<void> {
  if (loading) return loading;
  loading = Promise.all(['terrain', 'stations-empty', 'carts', 'duo', 'passengers', 'rail-props'].map((key) => new Promise<void>((resolve, reject) => {
    const image = new Image(); image.onload = () => { images.set(key, image); resolve(); }; image.onerror = () => reject(new Error('The warren artwork could not load.')); image.src = `/art/express/${key}.png`;
  }))).then(() => {
    atlas(images.get('stations-empty')!, ['home', 'hay', 'dust', 'retreat', 'mushroom', 'root']);
    atlas(images.get('carts')!, ['empty', 'dora', 'enzo', 'duo', 'drill', 'rocks']);
    atlas(images.get('passengers')!, ['dora0', 'dora1', 'dora2', 'dora3', 'enzo0', 'enzo1', 'enzo2', 'enzo3'], 4, 2);
    atlas(images.get('rail-props')!, ['platform', 'lantern', 'bridge', 'sleeper'], 2, 2, [[0, 0, 1060, 540], [1060, 0, 476, 540], [0, 540, 880, 484], [880, 540, 656, 484]]);
    const bridge = sprites.get('bridge')!; sprites.set('bridge-deck', { ...bridge, h: Math.round(bridge.h * .48) });
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
  // Dry grains of bathing powder, never water or steam.
  if (s.kind === 'dust') for (let i = 0; i < 10; i++) { const t = (now * .35 + i / 10) % 1; oval(c, s.x + Math.sin(i * 2.3) * (12 + t * 13), s.y - 23 - t * 14, .7, .55, `rgba(213,203,187,${.5 * (1 - t)})`); }
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
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const slotPoint = (s: Point, i: number): Point => ({ x: s.x + 43 + Math.min(i, 7) % 4 * 18, y: s.y + 32 + Math.floor(Math.min(i, 7) / 4) * 17 });
function cartPoint(g: Game, c: { at: number; to: number; progress: number; dir?: number }) { const a = g.stations[c.at], b = g.stations[c.to] ?? a; return c.to < 0 ? { ...a, dx: c.dir ?? 1, dy: 0 } : along(track(a, b), c.progress); }
function person(c: C, p: Passenger, at: Point, clock: number, frame: number, size = 32, alpha = 1, animate = true) {
  c.save(); c.globalAlpha = alpha; c.translate(at.x, at.y);
  const breath = animate && frame === 0 ? Math.sin(clock * 2.4 + p.id) * .016 : 0;
  c.scale(1 - breath * .25, 1 + breath);
  sprite(c, `${p.id % 2 ? 'dora' : 'enzo'}${frame}`, -size * .48, -size, size * .96, size);
  c.restore();
}
const river: Point[] = [{ x: -20, y: 175 }, { x: 80, y: 215 }, { x: 160, y: 280 }, { x: 266, y: 375 }, { x: 315, y: 480 }, { x: 305, y: 630 }];
function overRiver(p: Point) { return river.slice(1).some((b, i) => { const a = river[i], dx = b.x - a.x, dy = b.y - a.y, f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(p.x - a.x - f * dx, p.y - a.y - f * dy) < 24; }); }
function offsetPath(c: C, t: Track, offset: number) { c.beginPath(); t.points.forEach((p, i) => { const a = t.points[Math.max(0, i - 1)], b = t.points[Math.min(t.points.length - 1, i + 1)], k = Math.max(.01, Math.hypot(b.x - a.x, b.y - a.y)), x = p.x - (b.y - a.y) / k * offset, y = p.y + (b.x - a.x) / k * offset; if (i) c.lineTo(x, y); else c.moveTo(x, y); }); }
function rails(c: C, t: Track, lines: number[]) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#30251b99'; c.shadowBlur = 3; c.shadowOffsetY = 2;
  path(c, t); c.strokeStyle = '#5c5547'; c.lineWidth = 27; c.stroke(); c.shadowBlur = 0; c.shadowOffsetY = 0;
  for (let d = 4; d < t.total; d += 10) {
    const p = along(t, d / t.total), k = Math.max(.01, Math.hypot(p.dx, p.dy)), nx = -p.dy / k, ny = p.dx / k, bridge = overRiver(p), half = bridge ? 20 : 13;
    c.beginPath(); c.moveTo(p.x - nx * half, p.y - ny * half); c.lineTo(p.x + nx * half, p.y + ny * half);
    c.strokeStyle = bridge ? '#bd9054' : Math.floor(d / 10) % 2 ? '#997346' : '#805f3f'; c.lineWidth = bridge ? 7 : 5; c.stroke();
    c.save(); c.translate(p.x, p.y); c.rotate(Math.atan2(p.dy, p.dx) + (bridge ? 0 : Math.PI / 2));
    sprite(c, bridge ? 'bridge-deck' : 'sleeper', bridge ? -7 : -14, bridge ? -22 : -4, bridge ? 14 : 28, bridge ? 44 : 8); c.restore();
    c.beginPath(); c.moveTo(p.x - nx * half, p.y - ny * half - 1); c.lineTo(p.x + nx * half, p.y + ny * half - 1); c.strokeStyle = '#d6b47d77'; c.lineWidth = 1; c.stroke();
    if (bridge && Math.floor(d / 10) % 3 === 0) for (const side of [-1, 1]) { const x = p.x + nx * 19 * side, y = p.y + ny * 19 * side; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 14); c.strokeStyle = '#684830'; c.lineWidth = 3; c.stroke(); }
  }
  lines.forEach((id, i) => { offsetPath(c, t, (i - (lines.length - 1) / 2) * 8 / lines.length); c.strokeStyle = COLORS[id]; c.lineWidth = 8 / lines.length; c.stroke(); });
  for (const side of [-1, 1]) { offsetPath(c, t, side * 8); c.strokeStyle = '#403934'; c.lineWidth = 4; c.stroke(); offsetPath(c, t, side * 8 - .5); c.strokeStyle = '#d2ccc1'; c.lineWidth = 1.8; c.stroke(); }
  c.restore();
}
type Move = { event: TransitEv; start: number; from: Point; to: Point };
type QueuePose = { at: Point; target: Point; start: number; station: number };
export class Stage {
  private backdrop: HTMLCanvasElement | null = null; private map = -1;
  private railLayer: HTMLCanvasElement | null = null; private railKey = '';
  private moves = new Map<number, Move>(); private poses = new Map<number, QueuePose>(); private dust = new Map<number, number>();
  clock = 0;
  motion = typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  waiting: Record<number, { count: number; visible: number; overflow: number }> = {};
  feed(events: Ev[], g: Game) {
    if (!this.motion || g.paused || g.state !== 'running') { this.moves.clear(); return; }
    for (const e of events) if (e.t === 'board' || e.t === 'alight') {
      const previous = this.moves.get(e.passenger.id), pose = this.poses.get(e.passenger.id);
      const from = previous ? this.movePoint(previous, g) : e.t === 'board' ? pose?.at ?? slotPoint(g.stations[e.station], e.slot) : cartPoint(g, e.from);
      const to = e.t === 'board' ? cartPoint(g, g.carts.find((c) => c.id === e.cart) ?? e.from) : e.delivered ? { x: g.stations[e.station].x, y: g.stations[e.station].y - (g.stations[e.station].kind === 'dust' ? 26 : 15) } : slotPoint(g.stations[e.station], e.slot);
      this.moves.set(e.passenger.id, { event: e, start: this.clock, from, to });
      if (e.delivered && g.stations[e.station].kind === 'dust') this.dust.set(e.station, this.clock);
    }
    // Fast-forward or editing cannot grow presentation state without bound.
    if (this.moves.size > 96) this.moves = new Map([...this.moves].slice(-96));
  }
  private movePoint(m: Move, g: Game) {
    const t = Math.min(1, Math.max(0, (this.clock - m.start) / .65));
    const cart = m.event.t === 'board' ? g.carts.find((c) => c.id === m.event.cart) : null, slot = g.stations[m.event.station].queue.findIndex((p) => p.id === m.event.passenger.id);
    const to = cart ? cartPoint(g, cart) : m.event.t === 'alight' && !m.event.delivered && slot >= 0 ? slotPoint(g.stations[m.event.station], slot) : m.to;
    const p = mix(m.from, to, ease(t)); return { x: p.x, y: p.y - Math.sin(t * Math.PI) * (m.event.t === 'board' ? 14 : 7) };
  }
  update(dt: number, g: Game) {
    if (!this.motion) this.dust.clear();
    const moving = this.motion && !g.paused && g.state === 'running';
    if (moving && Number.isFinite(dt) && dt >= 0) this.clock += Math.min(.1, dt);
    else if (!moving) this.moves.clear();
    for (const [id, m] of this.moves) if (this.clock - m.start >= .65) this.moves.delete(id);
    const live = new Set<number>(); this.waiting = {};
    for (const s of g.active) {
      this.waiting[s.id] = { count: s.queue.length, visible: Math.min(CAPACITY, s.queue.length), overflow: Math.max(0, s.queue.length - CAPACITY) };
      s.queue.slice(0, CAPACITY).forEach((p, i) => {
        live.add(p.id); const target = slotPoint(s, i), old = this.poses.get(p.id);
        if (!old || old.station !== s.id) this.poses.set(p.id, { at: target, target, start: this.clock, station: s.id });
        else { if (old.target.x !== target.x || old.target.y !== target.y) { old.target = target; old.start = this.clock; } old.at = moving ? mix(old.at, target, Math.min(1, dt * 12)) : target; }
      });
    }
    for (const id of this.poses.keys()) if (!live.has(id) && !this.moves.has(id)) this.poses.delete(id);
    for (const [id, at] of this.dust) if (this.clock - at > 1.3) this.dust.delete(id);
  }
  inspect() { return { clock: this.clock, motion: this.motion, waiting: this.waiting, transits: [...this.moves].map(([id, m]) => ({ id, type: m.event.t, station: m.event.station, progress: Math.min(1, (this.clock - m.start) / .65) })), poses: this.poses.size, dustBursts: this.dust.size }; }
  pick(g: Game, x: number, y: number, pixelWidth: number): number | null {
    const radius = Math.max(34, WIDTH / pixelWidth * 20);
    const s = g.active.map((s) => ({ s, d: Math.hypot(s.x - x, s.y - y) })).filter(({ s, d }) => d <= radius || Math.abs(s.x - x) <= 70 && y >= Math.max(3, s.y - (s.kind === 'dust' ? 70 : 103)) && y <= s.y + 51 || pixelWidth >= 640 && Math.abs(s.x - x) <= 78 && y - s.y >= 55 && y - s.y <= 106).sort((a, b) => a.d - b.d)[0];
    return s?.s.id ?? null;
  }
  private ground(g: Game) {
    if (this.backdrop && this.map === g.map) return this.backdrop;
    const cv = document.createElement('canvas'); cv.width = WIDTH * 2; cv.height = HEIGHT * 2; const c = cv.getContext('2d')!; c.scale(2, 2);
    c.drawImage(images.get('terrain')!, 0, 0, WIDTH, HEIGHT);
    if (g.map === 1) { c.fillStyle = 'rgba(21,74,70,.16)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
    if (g.map === 2) { c.fillStyle = 'rgba(29,34,75,.34)'; c.fillRect(0, 0, WIDTH, HEIGHT); }
    for (const r of MAPS[g.map].rocks) sprite(c, 'rocks', r.x - r.r * 1.35, r.y - r.r * .9, r.r * 2.7, r.r * 1.8);
    this.backdrop = cv; this.map = g.map; return cv;
  }
  private routes(g: Game) {
    const key = `${g.map}|${g.lines.map((l) => `${l.stops.join(',')}:${l.loop}`).join('|')}|${g.bored.join('|')}`;
    if (key === this.railKey && this.railLayer) return this.railLayer;
    const cv = document.createElement('canvas'); cv.width = WIDTH * 2; cv.height = HEIGHT * 2; const c = cv.getContext('2d')!; c.scale(2, 2);
    const edges = new Map<string, { a: number; b: number; ids: number[] }>();
    for (const l of g.lines) { const stops = l.loop ? [...l.stops, l.stops[0]] : l.stops; for (let i = 1; i < stops.length; i++) { const a = Math.min(stops[i - 1], stops[i]), b = Math.max(stops[i - 1], stops[i]), k = `${a}:${b}`, e = edges.get(k) ?? { a, b, ids: [] }; if (!e.ids.includes(l.id)) e.ids.push(l.id); edges.set(k, e); } }
    for (const [k, e] of edges) {
      const t = track(g.stations[e.a], g.stations[e.b]); rails(c, t, e.ids);
      if (g.bored.includes(k)) { const p = along(t, .5); oval(c, p.x, p.y, 11, 9, '#4c5041'); oval(c, p.x, p.y - 1, 7, 5, COLORS[e.ids[0]]); }
    }
    this.railKey = key; this.railLayer = cv; return cv;
  }
  private wheels(c: C, key: string, angle: number) {
    const s = sprites.get(key); if (!s) return;
    const k = Math.min(76 / s.w, 80 / s.h), dx = -38 + (76 - s.w * k) / 2, dy = 13 - s.h * k;
    const coords: Record<string, [number, number][]> = { empty: [[126, 349], [322, 407]], dora: [[638, 389], [827, 407]], enzo: [[1160, 389], [1350, 417]], duo: [[119, 902], [303, 930]] };
    for (const [x, y] of coords[key] ?? []) {
      c.save(); c.translate(dx + (x - s.x) * k, dy + (y - s.y) * k); c.rotate(angle);
      c.strokeStyle = '#edc587bb'; c.lineWidth = .75; for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-4.3, 0); c.lineTo(4.3, 0); c.stroke(); } oval(c, 0, 0, 1.3, 1.3, '#a97b3d'); c.restore();
    }
  }
  draw(c: C, w: number, h: number, dpr: number, g: Game, _now: number, o: { line: number; hover: number | null; cursor: number | null; drag: Point | null }) {
    c.setTransform(dpr * w / WIDTH, 0, 0, dpr * h / HEIGHT, 0, 0); c.clearRect(0, 0, WIDTH, HEIGHT);
    if (!images.has('terrain') || sprites.size < 24) return;
    c.drawImage(this.ground(g), 0, 0, WIDTH, HEIGHT); c.drawImage(this.routes(g), 0, 0, WIDTH, HEIGHT);
    const activeMotion = this.motion && !g.paused && g.state === 'running', clock = this.clock;
    const last = g.lines[o.line]?.stops.at(-1) ?? (o.drag ? o.cursor ?? undefined : undefined), aim = o.drag ?? (o.hover !== null ? g.stations[o.hover] : null);
    if (last !== undefined && aim && g.state === 'running') { path(c, track(g.stations[last], aim, false)); c.setLineDash([7, 8]); c.strokeStyle = '#fff5d9'; c.lineWidth = 3; c.stroke(); c.setLineDash([]); }
    if (g.block) { const p = along(track(g.stations[g.block.a], g.stations[g.block.b]), .5); oval(c, p.x, p.y, 22, 22, '#412b36'); text(c, '×', p.x, p.y, 32, '#ffb399'); }
    const open = [...g.active].sort((a, b) => a.y - b.y);
    for (const s of open) {
      if (o.hover === s.id || o.cursor === s.id) { c.strokeStyle = '#f9df9a'; c.lineWidth = 3; c.beginPath(); c.ellipse(s.x, s.y + 3, 67, 25, 0, 0, Math.PI * 2); c.stroke(); }
      building(c, s, clock);
      sprite(c, 'lantern', s.x - 61, s.y - 24, 14, 25);
      const glow = c.createRadialGradient(s.x - 54, s.y - 10, 1, s.x - 54, s.y - 10, 13); glow.addColorStop(0, `rgba(255,205,103,${.16 + (this.motion ? Math.sin(clock * 2 + s.id) * .025 : 0)})`); glow.addColorStop(1, 'rgba(255,205,103,0)'); c.fillStyle = glow; c.fillRect(s.x - 67, s.y - 23, 26, 26);
      sprite(c, 'platform', s.x + 29, s.y + 12, 92, 44);
      s.queue.slice(0, CAPACITY).forEach((p, i) => {
        if (this.moves.get(p.id)?.event.t === 'alight') return;
        const pose = this.poses.get(p.id), at = pose?.at ?? slotPoint(s, i), phase = (clock + p.id * .39) % 5;
        const shifting = !!pose && Math.hypot(at.x - pose.target.x, at.y - pose.target.y) > .5;
        person(c, p, at, clock, this.motion ? shifting ? 2 : phase < .23 ? 1 : phase > 4.55 && phase < 4.8 ? 2 : 0 : 0, 32, 1, this.motion);
        symbol(c, p.dest, at.x + 9, at.y - 33, 3.4);
      });
    }
    for (const cart of g.carts) {
      const a = g.stations[cart.at], b = g.stations[cart.to] ?? a, p = cartPoint(g, cart);
      const cargo = cart.pax.filter((x) => this.moves.get(x.id)?.event.t !== 'board');
      const id = cargo.length >= 2 ? 'duo' : cargo.length ? cargo[0].id % 2 ? 'dora' : 'enzo' : 'empty';
      if (cart.to >= 0) {
        const t = track(a, b), f = Math.max(.01, cart.progress - .075), q = along(t, f), angle = Math.atan2(q.dy, q.dx);
        c.save(); c.translate(q.x, q.y); c.rotate(angle); c.strokeStyle = '#fff4c3'; c.lineWidth = 1.8; c.shadowColor = COLORS[cart.line]; c.shadowBlur = activeMotion ? 7 : 0;
        for (let n = 0; n < 2; n++) { c.beginPath(); c.moveTo(-5 - n * 7, -3); c.lineTo(-1 - n * 7, 0); c.lineTo(-5 - n * 7, 3); c.stroke(); } c.restore();
      }
      c.save(); c.translate(p.x, p.y + 8 + (this.motion && cart.to >= 0 ? Math.sin(clock * 12 + cart.id) * .65 : 0)); if (p.dx < 0) c.scale(-1, 1);
      sprite(c, id, -38, -67, 76, 80); this.wheels(c, id, this.motion && cart.to >= 0 ? clock * 9 * (p.dx < 0 ? -1 : 1) : 0); c.restore();
      if (cart.pax.length) { box(c, p.x + 18, p.y - 47, 24, 20, 7, '#33263c', '#ad8d86'); text(c, String(cart.pax.length), p.x + 30, p.y - 37, 12); }
    }
    for (const m of this.moves.values()) {
      const t = Math.max(0, Math.min(1, (clock - m.start) / .65)), p = this.movePoint(m, g);
      person(c, m.event.passenger, p, clock, m.event.t === 'board' ? 3 : 2, 30, m.event.delivered && t > .75 ? (1 - t) * 4 : 1, false);
    }
    for (const [id, start] of this.dust) { const s = g.stations[id], age = clock - start; for (let i = 0; i < 14; i++) { const r = age * (12 + i), a = i * 2.4; oval(c, s.x + Math.cos(a) * r, s.y - 27 + Math.sin(a) * r * .35 - age * 8, 1.2, .8, `rgba(221,210,191,${Math.max(0, 1 - age / 1.3) * .7})`); } }
    for (const s of open) {
      if (w >= 640) { box(c, s.x - 78, s.y + 55, 156, 25, 6, '#173334', '#c2ba86'); text(c, s.name, s.x, s.y + 67, 13); box(c, s.x - 51, s.y + 82, 102, 22, 6, s.queue.length > CAPACITY ? '#c09043' : '#203a36', '#77866a'); text(c, `${s.queue.length} waiting`, s.x, s.y + 93, 12); if (s.queue.length > CAPACITY) { box(c, Math.min(WIDTH - 36, s.x + 112), s.y + 24, 35, 23, 8, '#f1c45b', '#a77238'); text(c, `+${s.queue.length - CAPACITY}`, Math.min(WIDTH - 19, s.x + 129), s.y + 36, 12, '#372334'); } }
      else { const k = WIDTH / w, bw = Math.max(27, 22 * k), bh = Math.max(18, 15 * k); box(c, s.x + 38, s.y - 28, bw, bh, 6, s.queue.length > CAPACITY ? '#b98638' : '#263933', '#d1bc86'); text(c, String(s.queue.length), s.x + 38 + bw / 2, s.y - 28 + bh / 2, Math.max(12, 10 * k)); }
      if (s.crowd > 0) { const pulse = this.motion ? .7 + Math.sin(clock * 5) * .2 : .85; c.globalAlpha = pulse; c.beginPath(); c.arc(s.x, s.y, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.crowd / GRACE); c.strokeStyle = '#ffbd60'; c.lineWidth = 5; c.stroke(); c.globalAlpha = 1; }
    }
  }
}
