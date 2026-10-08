// Burrow Express: deterministic transport rules. Coordinates are in a 960 × 600 meadow; no DOM or drawing here.
export const WIDTH = 960, HEIGHT = 600, STEP = 0.05, DAY = 45, LAST_DAY = 8, CAPACITY = 8, GRACE = 18;
export type Kind = 'home' | 'hay' | 'dust' | 'retreat';
export const KINDS: Kind[] = ['home', 'hay', 'dust', 'retreat'];
export const TYPES: Record<Kind, { name: string; color: string; icon: string }> = {
  home: { name: 'Home Burrow', color: '#94d9eb', icon: '●' }, hay: { name: 'Hay Market', color: '#f4cc65', icon: '■' },
  dust: { name: 'Dust Baths', color: '#ef9aac', icon: '◆' }, retreat: { name: 'Mountain Retreat', color: '#aca4e8', icon: '▲' },
};
export const COLORS = ['#79d5b6', '#ff9588', '#f6cf69', '#a9a0ee', '#80c9ec'];
export const LINE_NAMES = ['Meadow Loop', 'Dust Express', 'Hay Run', 'Moonlight Line', 'Sky Shuttle'];
export type Passenger = { id: number; dest: Kind; born: number };
export type Station = { id: number; kind: Kind; x: number; y: number; opens: number; name: string; active: boolean; queue: Passenger[]; crowd: number };
export type Line = { id: number; stops: number[]; loop: boolean };
export type Cart = { id: number; line: number; at: number; to: number; progress: number; dir: number; dwell: number; pax: Passenger[] };
export type Rock = { x: number; y: number; r: number };
export type MapDef = { name: string; text: string; goal: number; tint: string; stream: number; rocks: Rock[]; stations: [Kind, number, number, string][] };
export const MAPS: MapDef[] = [
  { name: 'Clover Meadow', text: 'A gentle valley. Short journeys and room to learn.', goal: 100, tint: '#607e45', stream: 270,
    rocks: [{ x: 510, y: 285, r: 55 }], stations: [
      ['home', 130, 130, 'Home Burrow'], ['hay', 440, 115, 'Hay Market'], ['dust', 750, 215, 'Dust Baths'], ['retreat', 160, 440, 'Mountain Retreat'],
      ['home', 790, 465, 'Mushroom Hollow'], ['hay', 475, 470, 'Root Pantry'], ['dust', 155, 285, 'Clover Spa'], ['retreat', 745, 75, 'Cloud Lodge'], ['home', 615, 370, 'Fern Den'], ['hay', 365, 295, 'Willow Stall'],
    ] },
  { name: 'Mossy Gorge', text: 'Longer crossings. Share stations to make good transfers.', goal: 115, tint: '#476e61', stream: 495,
    rocks: [{ x: 390, y: 275, r: 58 }, { x: 665, y: 350, r: 52 }], stations: [
      ['home', 140, 160, 'Moss Burrow'], ['hay', 760, 115, 'Sunseed Market'], ['dust', 735, 475, 'Mist Baths'], ['retreat', 200, 470, 'Gorge Retreat'],
      ['home', 500, 75, 'Bridge End'], ['hay', 420, 430, 'Fern Pantry'], ['dust', 180, 295, 'Pebble Spa'], ['retreat', 825, 290, 'Waterfall Lodge'], ['home', 555, 295, 'Root Den'], ['hay', 355, 145, 'Moss Market'],
    ] },
  { name: 'Starlit Summit', text: 'A wide mountain warren. Watch the distant platforms.', goal: 130, tint: '#555f83', stream: 330,
    rocks: [{ x: 485, y: 175, r: 64 }, { x: 640, y: 365, r: 62 }, { x: 240, y: 350, r: 45 }], stations: [
      ['home', 120, 135, 'Moon Burrow'], ['hay', 770, 105, 'Summit Market'], ['dust', 790, 475, 'Starlight Baths'], ['retreat', 140, 475, 'Peak Retreat'],
      ['home', 485, 475, 'Snowbell Hollow'], ['hay', 435, 305, 'Moon Pantry'], ['dust', 750, 270, 'Silver Spa'], ['retreat', 320, 120, 'Sky Lodge'], ['home', 585, 70, 'Star Den'], ['hay', 320, 475, 'Pine Stall'],
    ] },
];
export type Upgrade = 'cart' | 'capacity' | 'drill' | 'line' | 'speed' | 'hay';
export const UPGRADES: Record<Upgrade, { name: string; icon: string; text: string }> = {
  cart: { name: 'Extra cart', icon: '▰', text: 'One more cart to assign to any line.' },
  capacity: { name: 'Bigger carts', icon: '♧', text: 'Every cart carries one more passenger.' },
  drill: { name: 'Rock drill', icon: '⚒', text: 'Two more tunnels through rocky ground.' },
  line: { name: 'New line', icon: '↗', text: 'A new coloured line and one extra cart.' },
  speed: { name: 'Quick wheels', icon: '»', text: 'All carts travel 15% faster, up to 240.' },
  hay: { name: 'Hay hamper', icon: '✦', text: '40 hay for a busy network, up to the store limit.' },
};
export type Ev = { t: 'build' | 'deliver' | 'station' | 'upgrade' | 'warning' | 'won' | 'lost'; station?: number; n?: number };
export type State = 'running' | 'upgrade' | 'won' | 'lost';
export type Mode = 'challenge' | 'endless' | 'tutorial';
const edgeKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const integer = (x: unknown, lo: number, hi: number): x is number => finite(x, lo, hi) && Number.isInteger(x);

export class Game {
  v = 1; map = 0; mode: Mode = 'challenge'; seed = 1; time = 0; day = 1; state: State = 'running'; paused = false;
  stations: Station[] = []; lines: Line[] = []; carts: Cart[] = []; bored: string[] = [];
  block: { a: number; b: number; until: number } | null = null;
  fleet = 3; seats = 4; drills = 2; hay = 62; speed = 72; delivered = 0; spawned = 0; transfers = 0;
  tutorial = 0; reason = ''; events: Ev[] = []; private acc = 0; private arrivals = 0; private nextPassenger = 1; private nextCart = 1;

  static start(map = 0, mode: Mode = 'challenge', seed = 1) {
    const g = new Game();
    g.map = Math.max(0, Math.min(MAPS.length - 1, Math.floor(map))); g.mode = mode; g.seed = seed >>> 0 || 1;
    g.lines = COLORS.slice(0, 3).map((_, id) => ({ id, stops: [], loop: false }));
    g.stations = MAPS[g.map].stations.map(([kind, x, y, name], id) => ({ id, kind, x, y, name, opens: id < 4 ? 1 : id - 2, active: id < 4, queue: [], crowd: 0 }));
    if (mode === 'tutorial') {
      g.stations = g.stations.slice(0, 4); g.drills = 10;
      for (const dest of ['hay', 'dust', 'retreat', 'hay', 'dust'] as Kind[]) g.passenger(0, dest);
    }
    return g;
  }
  private rand() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  get active() { return this.stations.filter((s) => s.active); }
  get goal() { return this.mode === 'tutorial' ? 5 : MAPS[this.map].goal; }
  get available() { return this.fleet - this.carts.length; }
  get dayLeft() { return Math.max(0, DAY - this.time % DAY); }
  pause(on: boolean) { this.paused = on; }
  position(c: Cart) { const a = this.stations[c.at], b = this.stations[c.to] ?? a; return { x: a.x + (b.x - a.x) * c.progress, y: a.y + (b.y - a.y) * c.progress }; }
  private emit(t: Ev['t'], station?: number, n?: number) { this.events.push({ t, station, n }); }
  /** A drill is needed where the straight tunnel crosses a rock outcrop. Already dug tunnels are shared. */
  needsDrill(a: number, b: number) {
    if (this.mode === 'tutorial' || this.bored.includes(edgeKey(a, b))) return false;
    const p = this.stations[a], q = this.stations[b];
    if (!p || !q || a === b) return false;
    return MAPS[this.map].rocks.some((r) => {
      const dx = q.x - p.x, dy = q.y - p.y, t = Math.max(0, Math.min(1, ((r.x - p.x) * dx + (r.y - p.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(p.x + t * dx - r.x, p.y + t * dy - r.y) < r.r;
    });
  }
  append(lineId: number, stationId: number): string {
    const l = this.lines[lineId], s = this.stations[stationId];
    if (!l || !s?.active || this.state !== 'running') return 'That station is not open.';
    if (l.stops.includes(stationId)) return l.stops.at(-1) === stationId ? '' : 'That station is already on this line. Use Loop to join the ends.';
    if (l.loop) return 'Open the loop before adding a stop.';
    const from = l.stops.at(-1), drill = from !== undefined && this.needsDrill(from, stationId);
    if (drill && this.drills === 0) return 'Rocky ground: choose a Rock drill upgrade, or connect around the rocks.';
    if (drill) { this.drills--; this.bored.push(edgeKey(from!, stationId)); }
    l.stops.push(stationId);
    if (l.stops.length === 2 && !this.carts.some((c) => c.line === lineId) && this.available > 0) this.addCart(lineId);
    this.emit('build', stationId); this.lesson(); return '';
  }
  /** Return every passenger to the nearest end of its current segment before editing a route. */
  private park(lineId: number) {
    for (const c of this.carts.filter((x) => x.line === lineId)) {
      const at = c.to >= 0 && c.progress >= 0.5 ? c.to : c.at;
      this.returnPassengers(c, at); this.stations[at].queue.sort((a, b) => a.born - b.born || a.id - b.id);
      c.pax = []; c.at = this.lines[lineId].stops[0] ?? at; c.to = -1; c.progress = 0; c.dir = 1; c.dwell = 0.6;
    }
  }
  removeLast(lineId: number): string {
    const l = this.lines[lineId];
    if (!l || !l.stops.length || this.state !== 'running') return 'No stop to remove.';
    this.park(lineId); l.loop = false; l.stops.pop();
    if (l.stops.length < 2) this.carts = this.carts.filter((c) => c.line !== lineId);
    this.emit('build'); return '';
  }
  loop(lineId: number): string {
    const l = this.lines[lineId];
    if (!l || l.stops.length < 3 || this.state !== 'running') return 'A loop needs at least three stops.';
    const a = l.stops[0], b = l.stops.at(-1)!;
    if (!l.loop && this.needsDrill(a, b)) {
      if (!this.drills) return 'The closing tunnel needs a rock drill.';
      this.drills--; this.bored.push(edgeKey(a, b));
    }
    this.park(lineId); l.loop = !l.loop; this.emit('build'); return '';
  }
  addCart(lineId: number): string {
    const l = this.lines[lineId];
    if (!l || l.stops.length < 2 || this.state !== 'running') return 'Connect at least two stations first.';
    if (this.available <= 0) return 'Every cart is assigned. Choose an Extra cart upgrade, or move one from another line.';
    const n = this.carts.filter((c) => c.line === lineId).length, at = l.stops[n % l.stops.length];
    this.carts.push({ id: this.nextCart++, line: lineId, at, to: -1, progress: 0, dir: n % 2 ? -1 : 1, dwell: 0.6, pax: [] });
    this.emit('build'); return '';
  }
  releaseCart(lineId: number): string {
    const c = this.carts.filter((x) => x.line === lineId).at(-1);
    if (!c || this.state !== 'running') return 'No cart on this line.';
    const at = c.to >= 0 && c.progress >= 0.5 ? c.to : c.at;
    this.returnPassengers(c, at); this.carts = this.carts.filter((x) => x.id !== c.id); this.emit('build'); return '';
  }
  private returnPassengers(c: Cart, at: number) {
    for (const p of c.pax) {
      if (p.dest === this.stations[at].kind) { this.delivered++; this.hay = Math.min(120, this.hay + (p.dest === 'hay' ? 3 : 0.5)); this.emit('deliver', at); }
      else this.stations[at].queue.push(p);
    }
  }
  blocked(a: number, b: number) { return !!this.block && edgeKey(a, b) === edgeKey(this.block.a, this.block.b) && this.time < this.block.until; }
  repair(): string {
    if (this.state !== 'running' || !this.block) return 'There is no cave-in to clear.';
    if (!this.drills) return 'Clearing a cave-in needs one rock drill.';
    this.drills--; this.block = null; this.emit('build'); return '';
  }
  edges(): [number, number][] {
    const pairs: [number, number][] = [];
    for (const l of this.lines) { if (!this.carts.some((c) => c.line === l.id)) continue; for (let i = 1; i < l.stops.length; i++) pairs.push([l.stops[i - 1], l.stops[i]]); if (l.loop) pairs.push([l.stops.at(-1)!, l.stops[0]]); }
    return pairs.filter(([a, b]) => !this.blocked(a, b));
  }
  /** Dijkstra over all lines. A passenger's next hop may require changing carts at a shared station. */
  path(from: number, dest: Kind): number[] | null {
    const start = this.stations[from];
    if (!start?.active) return null;
    const costs = this.stations.map(() => Infinity), prev = this.stations.map(() => -1), todo = new Set(this.active.map((s) => s.id)), edges = this.edges();
    costs[from] = 0;
    while (todo.size) {
      const a = [...todo].sort((x, y) => costs[x] - costs[y] || x - y)[0];
      if (!Number.isFinite(costs[a])) break;
      todo.delete(a);
      if (this.stations[a].kind === dest) { const out = [a]; while (out[0] !== from) out.unshift(prev[out[0]]); return out; }
      for (const [x, y] of edges) {
        const b = x === a ? y : y === a ? x : -1;
        if (b < 0 || !todo.has(b)) continue;
        const cost = costs[a] + distance(this.stations[a], this.stations[b]);
        if (cost < costs[b]) { costs[b] = cost; prev[b] = a; }
      }
    }
    return null;
  }
  passenger(stationId: number, dest: Kind) {
    const s = this.stations[stationId];
    if (!s?.active || s.kind === dest || !KINDS.includes(dest)) return;
    s.queue.push({ id: this.nextPassenger++, dest, born: this.time }); this.spawned++;
  }
  private next(c: Cart): number {
    const l = this.lines[c.line], i = l.stops.indexOf(c.at);
    if (l.loop) return l.stops[(i + c.dir + l.stops.length) % l.stops.length];
    if (i + c.dir < 0 || i + c.dir >= l.stops.length) c.dir *= -1;
    return l.stops[i + c.dir];
  }
  private service(c: Cart) {
    const s = this.stations[c.at], next = this.next(c), keep: Passenger[] = [];
    for (const p of c.pax) {
      if (p.dest === s.kind) { this.delivered++; this.hay = Math.min(120, this.hay + (p.dest === 'hay' ? 3 : 0.5)); this.emit('deliver', s.id); }
      else if (this.path(s.id, p.dest)?.[1] === next) keep.push(p);
      else { s.queue.push(p); this.transfers++; }
    }
    c.pax = keep; s.queue.sort((a, b) => a.born - b.born || a.id - b.id);
    s.queue = s.queue.filter((p) => { if (c.pax.length < this.seats && this.path(s.id, p.dest)?.[1] === next) { c.pax.push(p); return false; } return true; });
    c.to = next; c.progress = 0;
  }
  offers(): Upgrade[] {
    const a: Upgrade = this.fleet < 9 ? 'cart' : this.speed < 240 ? 'speed' : 'hay', b: Upgrade = this.seats < 8 ? 'capacity' : 'drill';
    const c: Upgrade = this.day % 2 === 0 && this.lines.length < 5 ? 'line' : 'drill';
    return [...new Set<Upgrade>([a, b, c, 'hay', ...(this.speed < 240 ? ['speed' as const] : [])])].slice(0, 3);
  }
  upgrade(kind: Upgrade): string {
    if (this.state !== 'upgrade' || !this.offers().includes(kind)) return 'Choose one of the upgrades shown.';
    if (kind === 'cart') this.fleet++; else if (kind === 'capacity') this.seats++; else if (kind === 'drill') this.drills += 2;
    else if (kind === 'speed') this.speed = Math.min(240, this.speed * 1.15); else if (kind === 'hay') this.hay = Math.min(120, this.hay + 40); else { this.lines.push({ id: this.lines.length, stops: [], loop: false }); this.fleet++; }
    this.state = 'running'; this.emit('upgrade');
    if (this.mode === 'tutorial') { this.tutorial = 4; this.state = 'won'; this.emit('won'); }
    return '';
  }
  private lesson() {
    if (this.mode !== 'tutorial') return;
    if (this.tutorial === 0 && this.lines.some((l) => l.stops.length >= 2)) this.tutorial = 1;
    if (this.tutorial === 1 && this.active.every((s) => KINDS.every((k) => k === s.kind || !!this.path(s.id, k)))) this.tutorial = 2;
  }
  update(dt: number) {
    if (!finite(dt, 0, 2) || this.paused || this.state !== 'running' || this.mode === 'tutorial' && this.tutorial < 2) return;
    this.acc += dt;
    while (this.acc + 1e-9 >= STEP && this.state === 'running') { this.acc = Math.max(0, this.acc - STEP); this.tick(); }
  }
  private tick() {
    this.time += STEP; this.hay = Math.min(120, this.hay + STEP * 0.15);
    if (this.block && this.time >= this.block.until) this.block = null;
    if (this.mode !== 'tutorial') {
      this.arrivals += STEP * Math.min(1.65, 0.32 + (this.day - 1) * 0.075 + this.map * 0.025);
      while (this.arrivals >= 1) {
        this.arrivals--;
        const open = this.active, s = open[Math.floor(this.rand() * open.length)], kinds = KINDS.filter((k) => k !== s.kind);
        this.passenger(s.id, kinds[Math.floor(this.rand() * kinds.length)]);
      }
    }
    for (const c of this.carts) {
      if (this.lines[c.line].stops.length < 2) continue;
      if (c.dwell > 0) { c.dwell = Math.max(0, c.dwell - STEP); continue; }
      if (c.to < 0) { if (this.hay >= 1 && !this.blocked(c.at, this.next(c))) { this.hay--; this.service(c); } continue; }
      c.progress += this.speed * STEP / Math.max(1, distance(this.stations[c.at], this.stations[c.to]));
      if (c.progress >= 1) {
        c.at = c.to; c.to = -1; c.progress = 0; c.dwell = 0.6;
        // Deliver immediately on arrival, even when there is not enough hay to depart again.
        c.pax = c.pax.filter((p) => { if (p.dest !== this.stations[c.at].kind) return true; this.delivered++; this.hay = Math.min(120, this.hay + (p.dest === 'hay' ? 3 : 0.5)); this.emit('deliver', c.at); return false; });
      }
    }
    for (const s of this.active) {
      const was = s.crowd;
      s.crowd = s.queue.length > CAPACITY ? s.crowd + STEP : Math.max(0, s.crowd - STEP * 2);
      if (was === 0 && s.crowd > 0) this.emit('warning', s.id);
      if (s.crowd >= GRACE) { this.state = 'lost'; this.reason = `${s.name} stayed overcrowded for ${GRACE} seconds.`; this.emit('lost', s.id); return; }
    }
    if (this.mode === 'tutorial') {
      if (this.delivered >= 5) { this.tutorial = 3; this.state = 'upgrade'; this.emit('upgrade'); }
      return;
    }
    if (this.time + 1e-7 >= this.day * DAY) {
      if (this.mode === 'challenge' && this.day === LAST_DAY) {
        this.state = this.delivered >= this.goal ? 'won' : 'lost'; this.reason = this.state === 'won' ? 'The whole warren is moving!' : `The eight-day shift needed ${this.goal} deliveries. Try shorter lines and more transfers.`; this.emit(this.state); return;
      }
      this.day++; this.state = 'upgrade'; this.emit('upgrade');
      for (const s of this.stations) if (!s.active && s.opens <= this.day) { s.active = true; this.emit('station', s.id); }
      if (this.day % 3 === 1) { const edges = this.edges(); if (edges.length) { const [a, b] = edges[Math.floor(this.rand() * edges.length)]; this.block = { a, b, until: this.time + 20 }; this.emit('warning', a); } }
    }
  }
  save(): string { const { events: _e, ...data } = this; return JSON.stringify(data); }
  /** Refuse malformed saves before they can reach either the route finder or the renderer. */
  static load(text: string): Game | null {
    try {
      const d = JSON.parse(text), g = new Game();
      if (!d || d.v !== 1 || !integer(d.map, 0, MAPS.length - 1) || !['challenge', 'endless', 'tutorial'].includes(d.mode) || !['running', 'upgrade', 'won', 'lost'].includes(d.state) || typeof d.paused !== 'boolean' || typeof d.reason !== 'string') return null;
      const scalar: [string, number, number][] = [['time', 0, 1e8], ['hay', 0, 120], ['speed', 1, 1e8], ['acc', 0, 2], ['arrivals', 0, 1]];
      if (scalar.some(([k, lo, hi]) => !finite(d[k], lo, hi))) return null;
      const ints: [string, number, number][] = [['seed', 0, 0xffffffff], ['day', 1, 1e7], ['fleet', 1, 11], ['seats', 1, 8], ['drills', 0, 1e7], ['delivered', 0, 1e9], ['spawned', 0, 1e9], ['transfers', 0, 1e9], ['tutorial', 0, 4], ['nextPassenger', 1, 1e9], ['nextCart', 1, 1e9]];
      if (ints.some(([k, lo, hi]) => !integer(d[k], lo, hi))) return null;
      if (d.speed > 240 || d.mode !== 'tutorial' && (d.time < (d.day - 1) * DAY - 1e-5 || d.time > d.day * DAY + 1e-5)) return null;
      if (d.mode === 'challenge' && (d.day > LAST_DAY || d.state === 'won' && (d.day !== LAST_DAY || d.delivered < MAPS[d.map].goal))) return null;
      if (d.mode === 'tutorial' && d.state === 'won' && (d.tutorial !== 4 || d.delivered < 5)) return null;
      if (!Array.isArray(d.stations) || d.stations.length !== (d.mode === 'tutorial' ? 4 : MAPS[d.map].stations.length) || !Array.isArray(d.lines) || d.lines.length < 3 || d.lines.length > 5 || !Array.isArray(d.carts) || d.carts.length > d.fleet || !Array.isArray(d.bored)) return null;
      const ids = new Set<number>(), pax = (p: Passenger) => p && integer(p.id, 1, d.nextPassenger - 1) && !ids.has(p.id) && KINDS.includes(p.dest) && finite(p.born, 0, d.time) && !!ids.add(p.id);
      for (const [i, s] of d.stations.entries()) {
        const [kind, x, y, name] = MAPS[d.map].stations[i];
        if (!s || s.id !== i || s.kind !== kind || s.x !== x || s.y !== y || s.name !== name || s.opens !== (i < 4 ? 1 : i - 2) || typeof s.active !== 'boolean' || s.active !== (s.opens <= d.day) || !finite(s.crowd, 0, GRACE + STEP + 1e-6) || !Array.isArray(s.queue) || s.queue.length > 1000 || s.queue.some((p: Passenger) => !pax(p) || p.dest === s.kind)) return null;
      }
      const station = (id: number) => integer(id, 0, d.stations.length - 1) && d.stations[id].active;
      if (d.block !== null && (!d.block || !station(d.block.a) || !station(d.block.b) || d.block.a === d.block.b || !finite(d.block.until, d.time, d.time + 20.000001))) return null;
      for (const [i, l] of d.lines.entries()) if (!l || l.id !== i || typeof l.loop !== 'boolean' || !Array.isArray(l.stops) || l.stops.some((id: number) => !station(id)) || new Set(l.stops).size !== l.stops.length || l.loop && l.stops.length < 3) return null;
      const cartIds = new Set<number>();
      for (const c of d.carts) {
        if (!c || !integer(c.id, 1, d.nextCart - 1) || cartIds.has(c.id) || !integer(c.line, 0, d.lines.length - 1) || !station(c.at) || !integer(c.to, -1, d.stations.length - 1) || !finite(c.progress, 0, 1) || ![-1, 1].includes(c.dir) || !finite(c.dwell, 0, 0.6) || !Array.isArray(c.pax) || c.pax.length > d.seats || c.pax.some((p: Passenger) => !pax(p))) return null;
        const l = d.lines[c.line];
        if (l.stops.length < 2 || !l.stops.includes(c.at) || c.to >= 0 && (!station(c.to) || c.to === c.at || !l.stops.includes(c.to)) || c.to < 0 && c.progress !== 0) return null;
        if (c.to >= 0) { const a = l.stops.indexOf(c.at), b = l.stops.indexOf(c.to); if (Math.abs(a - b) !== 1 && !(l.loop && Math.abs(a - b) === l.stops.length - 1)) return null; }
        cartIds.add(c.id);
      }
      if (ids.size + d.delivered !== d.spawned || d.bored.length > 45 || new Set(d.bored).size !== d.bored.length || d.bored.some((k: string) => typeof k !== 'string' || !/^\d+:\d+$/.test(k) || !k.split(':').map(Number).every(station) || Number(k.split(':')[0]) >= Number(k.split(':')[1]))) return null;
      for (const k of Object.keys(g)) if (k !== 'events') (g as unknown as Record<string, unknown>)[k] = d[k];
      g.events = []; return g;
    } catch { return null; }
  }
}
