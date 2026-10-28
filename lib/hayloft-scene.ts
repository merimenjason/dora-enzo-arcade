// Hayloft Tycoon's valley, drawn in Canvas 2D: a painted backdrop that scrolls sideways, the twelve buildings with their
// helpers and progress, Dora and Enzo at the front for taps, visitors drifting across the sky, floating coins and fluff, and
// the Twig Shower minigame. Drawing only: the rules live in hayloft-game.ts. Painted art loads from public/art/hayloft/ and
// the drawn stand-ins below show until it arrives (or if it never does).
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import { BUILDINGS, MANAGERS, MILESTONES, VALLEYS, N, fmt, type GameEvent, type HayloftGame, type TwigShower, type VisitorKind } from './hayloft-game';

const FONT = 'ui-rounded, "Trebuchet MS", system-ui, sans-serif';
const ART = '/art/hayloft/';
type Float = { x: number; y: number; text: string; color: string; born: number; big: boolean; world: boolean };
type Puff = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; star: boolean; world: boolean };
export type Hit = { kind: 'visitor' } | { kind: 'building'; i: number } | { kind: 'tap' } | { kind: 'twig'; x: number; y: number };

/** The painting for a helper: `helper-captain-wisp` for Captain Wisp. Dora and Enzo use their own paintings. */
const helperArt = (m: { name: string }) => 'helper-' + m.name.toLowerCase().replace(/ /g, '-');
const HELPER_COATS: Coat[] = MANAGERS.map((m) => coatLike(m.coat, { fur: m.fur, back: shade(m.fur, -18), face: shade(m.fur, 10) }));
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, v + amt));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class HayloftScene {
  private c: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private img = new Map<string, HTMLImageElement>();
  private floats: Float[] = [];
  private puffs: Puff[] = [];
  private wall = 0;
  /** Horizontal scroll of the valley in CSS pixels, its target and a fling speed. */
  private scroll = 0; private vel = 0; private dragging = false;
  private cheer = { dora: -9, enzo: -9 };
  private hops = new Array(N).fill(-9) as number[];
  private banner: { text: string; sub: string; born: number; color: string } | null = null;
  private flash = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    const names = ['dora', 'dora-cheer', 'enzo', 'enzo-cheer', 'twig', 'twig-gold', ...BUILDINGS.map((b) => `building-${b.id}`), ...['acorn', 'pedlar', 'owl', 'bat', 'breeze'].map((v) => `visitor-${v}`), ...MANAGERS.slice(2).map(helperArt)];
    for (const n of names) this.load(n);
  }
  private load(name: string) { if (this.img.has(name)) return; const i = new Image(); i.decoding = 'async'; i.src = `${ART}${name}.webp`; this.img.set(name, i); }
  private art(name: string) { this.load(name); const i = this.img.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(280, r.width); this.h = Math.max(200, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
  }
  // ---- layout
  private L() {
    const { w, h } = this, ground = h * 0.8, size = Math.max(96, Math.min(h * 0.46, 210)), slot = size * 1.12;
    const front = Math.min(h * 0.34, 120), home = Math.min(w * 0.42, front * 1.7);
    return { ground, size, slot, front, home, x0: home + slot * 0.55 };
  }
  private bx(i: number) { const L = this.L(); return L.x0 + i * L.slot - this.scroll; }
  private maxScroll(g: HayloftGame) {
    const L = this.L(); let last = 0; for (let i = 0; i < N; i++) if (g.unlocked(i)) last = i;
    return Math.max(0, L.x0 + last * L.slot + L.slot * 0.6 - this.w);
  }
  drag(dx: number) { this.dragging = true; this.scroll -= dx; this.vel = -dx * 60; }
  release() { this.dragging = false; }
  /** Glide so building i is in view. */
  focus(i: number) { const L = this.L(); this.target = L.x0 + i * L.slot - this.w * 0.55; }
  private target: number | null = null;

  /** What is under a tap at (x, y) in CSS pixels. */
  hit(g: HayloftGame, x: number, y: number, shower: TwigShower | null): Hit {
    if (shower) return { kind: 'twig', x: x / this.w, y: y / this.h };
    const v = g.s.visitor;
    if (v) { const p = this.visitorAt(g); if (p && Math.hypot(p.x - x, p.y - y) < Math.max(44, p.r * 1.3)) return { kind: 'visitor' }; }
    const L = this.L();
    for (let i = 0; i < N; i++) {
      if (g.s.levels[i] < 1) continue;
      const bx = this.bx(i);
      if (Math.abs(x - bx) < L.size * 0.45 && y > L.ground - L.size * 0.95 && y < L.ground + 26) return { kind: 'building', i };
    }
    return { kind: 'tap' };
  }
  private visitorAt(g: HayloftGame) {
    const v = g.s.visitor; if (!v) return null;
    const k = (g.s.t - v.at) / (v.until - v.at), span = this.w + 160, r = Math.max(28, Math.min(48, this.h * 0.09));
    const x = v.dir > 0 ? -80 + k * span : this.w + 80 - k * span;
    const y = this.h * v.y + Math.sin(g.s.t * 2.4) * 10;
    return { x, y, r };
  }
  // ---- events
  feed(g: HayloftGame, events: GameEvent[], tapAt?: { x: number; y: number }) {
    const L = this.L(), now = this.wall;
    for (const e of events) {
      if (e.kind === 'cycle') { if (this.floats.length < 40) this.float(this.bx(e.i) + this.scroll, L.ground - L.size * 0.95, '+' + fmt(e.coins), '#fff3b0', false, true); this.hops[e.i] = now; }
      else if (e.kind === 'tap') {
        const p = tapAt ?? { x: L.home * 0.5, y: L.ground - L.front * 0.6 };
        this.float(p.x, p.y - 18, '+' + fmt(e.coins), '#fff6d8', false, false); this.fluff(p.x, p.y, 5, false);
        if (Math.random() < 0.5) this.cheer.dora = now; else this.cheer.enzo = now;
      } else if (e.kind === 'burst') { this.banner = { text: 'FLUFF BURST!', sub: `×${g.burstMult()} for ${g.burstSeconds()} s`, born: now, color: '#ffd1e8' }; this.cheer = { dora: now, enzo: now + 0.1 }; for (let k = 0; k < 4; k++) this.fluff(this.w * (0.2 + k * 0.2), this.h * 0.5, 14, false); this.flash = 1; }
      else if (e.kind === 'caught') { const p = this.visitorAt(g) ?? { x: this.w / 2, y: this.h * 0.3 }; this.fluff(p.x, p.y, 18, false, '#ffe27a'); this.banner = { text: e.text, sub: '', born: now, color: '#ffe9a8' }; }
      else if (e.kind === 'milestone') { this.banner = { text: `${BUILDINGS[e.i].name} ×${e.x}!`, sub: `Level ${e.level} milestone`, born: now, color: '#c8f5b0' }; this.fluff(this.bx(e.i) + this.scroll, L.ground - L.size * 0.5, 20, true, '#fff2a8'); }
      else if (e.kind === 'festival') { this.banner = { text: 'VALLEY FESTIVAL!', sub: `Every building at ${e.level}: everything ×2`, born: now, color: '#ffd86b' }; this.flash = 1; }
      else if (e.kind === 'buy') { this.fluff(this.bx(e.i) + this.scroll, L.ground - 6, 6, true, '#f3e2c0'); this.hops[e.i] = now; if (g.s.levels[e.i] === e.n) this.focus(e.i); }
      else if (e.kind === 'hire') { this.hops[e.i] = now; this.fluff(this.bx(e.i) + this.scroll + L.size * 0.42, L.ground - 20, 12, true, '#ffffff'); this.banner = { text: `${MANAGERS[e.i].name} joins the team!`, sub: MANAGERS[e.i].says, born: now, color: '#d8f0ff' }; }
      else if (e.kind === 'achievement') { /* the page shows a toast */ }
      else if (e.kind === 'migrate' || e.kind === 'constellation') { this.scroll = 0; this.target = null; this.flash = 1; this.banner = { text: VALLEYS[g.s.valley % VALLEYS.length].name, sub: g.valleyDef.twist, born: now, color: '#ffffff' }; }
    }
  }
  private float(x: number, y: number, text: string, color: string, big: boolean, world: boolean) { this.floats.push({ x, y, text, color, born: this.wall, big, world }); if (this.floats.length > 60) this.floats.shift(); }
  private fluff(x: number, y: number, n: number, world: boolean, color = '#ffffff') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
      this.puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.6 + Math.random() * 0.6, color, size: 3 + Math.random() * 5, star: Math.random() < 0.25, world });
    }
    if (this.puffs.length > 300) this.puffs.splice(0, this.puffs.length - 300);
  }

  // ---- drawing
  draw(g: HayloftGame, dt: number, shower: TwigShower | null) {
    this.wall += dt;
    const c = this.c, { w, h } = this, L = this.L(), s = g.s, t = this.wall;
    // scroll physics: fling, glide to a target, keep inside the valley
    const max = this.maxScroll(g);
    if (!this.dragging) {
      if (this.target !== null) { this.scroll += (Math.max(0, Math.min(max, this.target)) - this.scroll) * Math.min(1, dt * 4); if (Math.abs(this.vel) > 5) this.target = null; }
      this.scroll += this.vel * dt; this.vel *= Math.pow(0.04, dt);
      if (this.scroll < 0) { this.scroll += (0 - this.scroll) * Math.min(1, dt * 10); this.vel = 0; }
      if (this.scroll > max) { this.scroll += (max - this.scroll) * Math.min(1, dt * 10); this.vel = 0; }
    }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop(g, L);
    // buildings, back to front
    for (let i = 0; i < N; i++) {
      const x = this.bx(i); if (x < -L.slot || x > w + L.slot) continue;
      if (s.levels[i] > 0) this.building(g, i, x, L);
      else if (g.unlocked(i)) this.ghost(g, i, x, L);
    }
    this.ambient(g, L, dt);
    this.visitor(g);
    this.pair(g, L);
    // floating coins and fluff
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k]; p.life += dt; if (p.life > p.max) { this.puffs.splice(k, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.vx *= 0.97;
      const x = p.world ? p.x - this.scroll : p.x, a = 1 - p.life / p.max;
      c.globalAlpha = a; c.fillStyle = p.color;
      if (p.star) this.star(x, p.y, p.size * 1.2, p.color); else { c.beginPath(); c.arc(x, p.y, p.size, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let k = this.floats.length - 1; k >= 0; k--) {
      const f = this.floats[k], age = t - f.born; if (age > 1.3) { this.floats.splice(k, 1); continue; }
      const x = f.world ? f.x - this.scroll : f.x, y = f.y - age * 46;
      c.globalAlpha = Math.min(1, 2.2 - age * 1.7); c.font = `900 ${f.big ? 22 : 15}px ${FONT}`;
      c.lineWidth = 4; c.strokeStyle = '#4a2e1acc'; c.strokeText(f.text, x, y); c.fillStyle = f.color; c.fillText(f.text, x, y);
    }
    c.globalAlpha = 1;
    // boost glow round the edges
    const boost = g.boostMult();
    if (boost > 1) {
      const a = Math.min(0.35, 0.08 + Math.log(boost) * 0.06) * (0.75 + 0.25 * Math.sin(t * 4));
      const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(1, `rgba(255,214,107,${a})`); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255,250,235,${this.flash * 0.45})`; c.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 2); }
    if (this.banner) {
      const age = t - this.banner.born; if (age > 2.6) this.banner = null;
      else {
        const a = Math.min(1, age * 5, (2.6 - age) * 2), y = h * 0.2 - Math.max(0, 0.2 - age) * 60;
        c.globalAlpha = a; c.font = `900 ${Math.min(26, w / 14)}px ${FONT}`; c.lineWidth = 6; c.strokeStyle = '#4a2e1acc';
        c.strokeText(this.banner.text, w / 2, y); c.fillStyle = this.banner.color; c.fillText(this.banner.text, w / 2, y);
        if (this.banner.sub) { c.font = `800 ${Math.min(13, w / 30)}px ${FONT}`; c.lineWidth = 4; c.strokeText(this.banner.sub, w / 2, y + 24, w - 24); c.fillStyle = '#fff'; c.fillText(this.banner.sub, w / 2, y + 24, w - 24); }
        c.globalAlpha = 1;
      }
    }
    if (shower) this.shower(shower);
  }
  private backdrop(g: HayloftGame, L: ReturnType<HayloftScene['L']>) {
    const c = this.c, { w, h } = this, v = g.valleyDef, t = this.wall;
    const sky = c.createLinearGradient(0, 0, 0, L.ground); sky.addColorStop(0, v.sky[0]); sky.addColorStop(1, v.sky[1]);
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    this.load(`valley-${v.id}`);
    const img = this.art(`valley-${v.id}`);
    if (img) {
      // cover the height, scroll at 40% of the valley's speed, mirror at each edge so it never runs out
      const sc = h / img.naturalHeight, iw = img.naturalWidth * sc, off = -((this.scroll * 0.4) % (iw * 2));
      for (let x = off; x < w; x += iw) {
        const k = Math.round((x - off) / iw);
        c.save(); if (k % 2) { c.translate(x + iw, 0); c.scale(-1, 1); c.drawImage(img, 0, 0, iw, h); } else c.drawImage(img, x, 0, iw, h); c.restore();
      }
    } else {
      // drawn stand-in: sun, clouds, two layers of hills and the ground band
      c.fillStyle = v.id === 'glowcap' ? '#f6e7ff' : '#fff6cf'; c.globalAlpha = 0.85; c.beginPath(); c.arc(w * 0.82, h * 0.16, Math.min(w, h) * 0.07, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
      c.fillStyle = v.id === 'glowcap' ? '#ffffff22' : '#ffffffcc';
      for (let k = 0; k < 5; k++) { const x = ((k * 260 - this.scroll * 0.15 + t * 6) % (w + 300) + w + 300) % (w + 300) - 150, y = h * (0.1 + (k % 3) * 0.08); this.cloud(x, y, 26 + (k % 2) * 12); }
      const hill = (par: number, base: number, amp: number, col: string, f: number) => {
        c.fillStyle = col; c.beginPath(); c.moveTo(0, h);
        for (let x = 0; x <= w + 20; x += 20) { const wx = x + this.scroll * par; c.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(wx * f) * Math.cos(wx * f * 0.37))); }
        c.lineTo(w, h); c.fill();
      };
      const far = v.id === 'snowdrift' ? '#cbd7ea' : v.id === 'glowcap' ? '#6a4f86' : v.id === 'cove' ? '#7cc4d8' : v.id === 'cloudreach' ? '#f2d4ea' : '#a9cf8a';
      const mid = v.id === 'snowdrift' ? '#dfe7f2' : v.id === 'glowcap' ? '#4f6a46' : v.id === 'cove' ? '#e7cf9b' : v.id === 'cloudreach' ? '#bfe3a0' : '#93c46f';
      hill(0.2, L.ground - h * 0.18, h * 0.16, far, 0.006);
      hill(0.5, L.ground - h * 0.05, h * 0.1, mid, 0.011);
      if (v.id === 'glowcap') for (let k = 0; k < 7; k++) { const x = ((k * 190 - this.scroll * 0.5) % (w + 200) + w + 200) % (w + 200) - 100; this.mushroom(x, L.ground - h * 0.04, 26 + (k % 3) * 12, ['#ff9ad0', '#7fe0d0', '#ffd86b'][k % 3]); }
      c.fillStyle = v.ground; c.fillRect(0, L.ground - 4, w, h - L.ground + 4);
      c.fillStyle = shade(v.ground, -16); c.fillRect(0, L.ground + 18, w, h - L.ground);
    }
    // the colony's constellations twinkle in the sky
    const n = Math.min(12, g.s.constellations);
    for (let k = 0; k < n; k++) {
      const cx = w * (0.12 + ((k * 0.29) % 0.78)), cy = h * (0.08 + (k % 3) * 0.06), pts = [[0, 0], [14, -6], [26, 2], [36, -8], [22, 12]];
      c.strokeStyle = '#ffffff66'; c.lineWidth = 1; c.beginPath(); pts.forEach(([x, y], j) => (j ? c.lineTo(cx + x, cy + y) : c.moveTo(cx + x, cy + y))); c.stroke();
      for (const [x, y] of pts) this.star(cx + x, cy + y, 2.5 + Math.sin(t * 3 + x) * 0.8, '#fff8d0');
    }
  }
  private cloud(x: number, y: number, r: number) { const c = this.c; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.arc(x + r * 0.9, y + 4, r * 0.75, 0, Math.PI * 2); c.arc(x - r * 0.9, y + 6, r * 0.65, 0, Math.PI * 2); c.fill(); }
  private mushroom(x: number, y: number, r: number, col: string) {
    const c = this.c; c.fillStyle = '#f3e8d8'; c.fillRect(x - r * 0.18, y - r * 1.1, r * 0.36, r * 1.1);
    c.save(); c.shadowColor = col; c.shadowBlur = 18; c.fillStyle = col; c.beginPath(); c.ellipse(x, y - r * 1.1, r * 0.8, r * 0.5, 0, Math.PI, 0); c.fill(); c.restore();
  }
  private star(x: number, y: number, r: number, col: string) {
    const c = this.c; c.fillStyle = col; c.beginPath();
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.fill();
  }
  private ambient(g: HayloftGame, L: ReturnType<HayloftScene['L']>, dt: number) {
    const c = this.c, { w, h } = this, t = this.wall, v = g.valleyDef.id;
    if (v === 'snowdrift') { c.fillStyle = '#ffffffcc'; for (let k = 0; k < 40; k++) { const x = ((k * 97 + t * 14 + Math.sin(t + k) * 20) % w + w) % w, y = ((k * 53 + t * (24 + (k % 5) * 6)) % h); c.beginPath(); c.arc(x, y, 1.4 + (k % 3), 0, Math.PI * 2); c.fill(); } }
    else if (v === 'glowcap') for (let k = 0; k < 18; k++) { const x = ((k * 131 + Math.sin(t * 0.7 + k) * 40) % w + w) % w, y = L.ground - 30 - ((k * 37 + t * 10) % (h * 0.6)); c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + k); this.star(x, y, 2.5, '#d8ffb0'); c.globalAlpha = 1; }
    else if (v === 'cove') { const tide = g.tide(), y = L.ground + 22 - (tide - 1) * 40; c.fillStyle = '#7fd0e6aa'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * 0.04 + t * 2) * 4); c.lineTo(w, h); c.fill(); }
    else if (v === 'cloudreach') { c.fillStyle = '#ffffffaa'; for (let k = 0; k < 3; k++) this.cloud(((k * 330 + t * 18) % (w + 300)) - 150, L.ground + 26 + k * 10, 30); }
    void dt;
  }
  private building(g: HayloftGame, i: number, x: number, L: ReturnType<HayloftScene['L']>) {
    const c = this.c, s = g.s, b = BUILDINGS[i], t = this.wall, size = L.size, gy = L.ground;
    // a payout bounce: a quick squash, a stretch up off the ground, then a wobble back to rest
    const since = t - this.hops[i], bounce = since < 0.55 ? Math.sin((since / 0.55) * Math.PI * 2) * Math.exp(-since * 5) : 0;
    const busy = s.managers[i] || s.cycles[i] >= 0;
    // idle, it breathes slowly; at work it bobs to the beat of its run
    const breathe = Math.sin(t * 1.7 + i * 1.3) * 0.012, work = busy ? Math.abs(Math.sin(t * 4.2 + i)) * 0.022 : 0;
    const squash = 1 + breathe + work - bounce * 0.09, lift = Math.max(0, bounce) * size * 0.05;
    const tilt = busy ? Math.sin(t * 2.1 + i) * 0.012 : Math.sin(t * 0.9 + i) * 0.006;
    // shadow
    c.fillStyle = 'rgba(40,30,20,.18)'; c.beginPath(); c.ellipse(x, gy + 2, size * 0.42, size * 0.07, 0, 0, Math.PI * 2); c.fill();
    // each milestone reached makes the building a touch bigger; each of its shop upgrades dresses it up
    const stars = MILESTONES.filter(([l]) => s.levels[i] >= l).length, grow = 1 + Math.min(stars, 10) * 0.008;
    const tier = [1, 2, 3].filter((k) => s.upgrades.includes(`${b.id}-${k}`)).length;
    c.save(); c.translate(x, gy - lift); c.rotate(tilt); c.scale((2 - squash) * grow, squash * grow);
    // the painted upgrade (upgrades 1-2, then 3) when it has loaded; otherwise the base painting dressed with drawn extras
    const painted = (tier >= 3 && this.art(`building-${b.id}-up2`)) || (tier >= 1 && this.art(`building-${b.id}-up1`)) || null;
    const img = painted ?? this.art(`building-${b.id}`);
    if (tier >= 2) this.glow(size, t, i);
    if (img) c.drawImage(img, -size / 2, -size, size, size); else this.drawnBuilding(i, size, t, g.s.managers[i]);
    if (!painted) {
      if (tier >= 1) this.bunting(size, t, i);
      if (tier >= 2) this.lanterns(size, t, i);
      if (tier >= 3) this.pennant(size, t, b.color);
    } else if (tier >= 3) this.twinkles(size, t, i);
    c.restore();
    if (busy) this.wisps(x, gy - size * grow * 0.86 - lift, size, t, i, b.color);
    if (stars) this.milestoneStars(x, gy, stars);
    // helper hopping beside it
    if (s.managers[i]) {
      // a cheer jump when the run pays out, little working hops in between, and breathing all the time
      const hx = x + size * 0.36, hh = Math.max(22, size * 0.24), who = i === 0 ? 'dora' : i === 1 ? 'enzo' : helperArt(MANAGERS[i]);
      const cheering = t - this.hops[i] < 0.9, cheer = Math.max(0, Math.sin(Math.min(1, (t - this.hops[i]) * 3) * Math.PI)) * hh * 0.5;
      const idle = this.art(who), work = this.art(`${who}-work`), carry = this.art(`${who}-carry`), joy = this.art(`${who}-cheer`);
      if (idle && work && carry && !cheering) this.helperRoutine(i, hx, x, gy, hh, t, idle, work, carry);
      else if (idle) {
        // without its frames (or while cheering a payout) the helper hops: a jump of joy, little working hops, breathing
        const beat = (t * 1.4 + i * 0.37) % 1, hopUp = cheering ? 0 : beat < 0.35 ? Math.sin((beat / 0.35) * Math.PI) * hh * 0.14 : 0, up = cheer + hopUp;
        const land = !cheering && beat >= 0.35 && beat < 0.5 ? Math.sin(((beat - 0.35) / 0.15) * Math.PI) * 0.08 : 0;
        this.critter(cheering && joy ? joy : idle, hx, gy + 6 - up, hh * 1.9, t * 1.1 + i * 2, land, Math.sin(t * 3 + i) * 0.05 + (cheer > 1 ? Math.sin(t * 18) * 0.06 : 0));
      }
      else drawChinchilla(c, i === 0 ? 'dora' : i === 1 ? 'enzo' : HELPER_COATS[i], hx, gy + 4 - cheer, { face: -1, h: hh, time: t + i, blink: Math.sin(t * 0.9 + i * 3) > 0.97 });
    }
    // progress bar and level badge
    const bw = size * 0.7, by = gy + 12;
    const len = g.cycleTime(i), p = s.managers[i] ? ((s.t % b.cycle) / b.cycle) : s.cycles[i] >= 0 ? s.cycles[i] / len : 0;
    c.fillStyle = '#3a2a1ab3'; this.round(x - bw / 2, by, bw, 9, 4.5); c.fill();
    const fast = s.managers[i] && b.cycle <= 1.5;
    c.fillStyle = b.color; this.round(x - bw / 2 + 1, by + 1, Math.max(7, (bw - 2) * (fast ? 1 : p)), 7, 3.5); c.fill();
    c.font = `900 12px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const label = `${s.levels[i]}`; const lw = c.measureText(label).width + 14;
    c.fillStyle = '#fff8e8'; this.round(x - size * 0.42 - lw / 2 + 10, gy - size * 0.92, lw, 20, 10); c.fill();
    c.fillStyle = '#5a3a1e'; c.fillText(label, x - size * 0.42 + 10, gy - size * 0.92 + 10.5);
    // a building with no helper and no cycle running asks for a tap
    if (!s.managers[i] && s.cycles[i] < 0) {
      const bob = Math.sin(t * 5 + i) * 3, yy = gy - size * 1.02 + bob;
      c.fillStyle = '#ffd86b'; this.round(x - 24, yy - 12, 48, 24, 12); c.fill();
      c.fillStyle = '#5a3a1e'; c.font = `900 13px ${FONT}`; c.fillText('TAP!', x, yy + 0.5);
    }
  }
  private ghost(g: HayloftGame, i: number, x: number, L: ReturnType<HayloftScene['L']>) {
    const c = this.c, size = L.size, gy = L.ground, b = BUILDINGS[i];
    c.save(); c.fillStyle = 'rgba(255,248,232,.28)'; this.round(x - size * 0.34, gy - size * 0.62, size * 0.68, size * 0.62, 14); c.fill();
    c.globalAlpha = 0.8; c.setLineDash([6, 6]); c.strokeStyle = '#fff8e8'; c.lineWidth = 2.5; c.stroke(); c.restore();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `${Math.round(size * 0.22)}px ${FONT}`; c.globalAlpha = 0.8; c.fillText(b.icon, x, gy - size * 0.38); c.globalAlpha = 1;
    // name and price sit on solid tags so they read over the busy grass
    const tag = (text: string, y: number, fill: string, ink: string, font: string) => {
      c.font = font; const tw = Math.min(c.measureText(text).width, size * 0.95) + 16;
      c.fillStyle = fill; this.round(x - tw / 2, y - 11, tw, 22, 11); c.fill();
      c.strokeStyle = 'rgba(58,36,16,.35)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = ink; c.fillText(text, x, y + 0.5, size * 0.95);
    };
    tag('NEXT: ' + b.name.toUpperCase(), gy - size * 0.12, 'rgba(255,248,232,.94)', '#3a2410', `900 12px ${FONT}`);
    tag('🪙 ' + fmt(g.buyCost(i, 1)), gy + 16, '#ffd86b', '#3a2410', `900 13px ${FONT}`);
  }
  /** The drawn stand-in for a building's painting, in a size×size box with the base at (0, 0). */
  /** A painted critter standing at (x, footY): it breathes (a slow squash at the feet), takes a landing squash and leans. */
  private critter(img: HTMLImageElement, x: number, footY: number, sz: number, phase: number, land: number, lean: number, flip = false) {
    const c = this.c, breathe = Math.sin(phase * 2.2) * 0.025, sy = 1 + breathe - land, sx = 1 - breathe * 0.6 + land * 0.7;
    c.save(); c.translate(x, footY); c.rotate(lean); c.scale(flip ? -sx : sx, sy); c.drawImage(img, -sz / 2, -sz, sz, sz); c.restore();
  }
  /**
   * A helper's day at its building, a loop of about nine seconds offset per helper: it works at its spot (the work frame,
   * with a rhythmic effort bob), carries the goods over to the door (the carry frame, walking, mirrored to face left),
   * hands them in, walks back (its own frame, bobbing) and takes a breather before starting again.
   */
  private helperRoutine(i: number, spot: number, door: number, gy: number, hh: number, t: number, idle: HTMLImageElement, work: HTMLImageElement, carry: HTMLImageElement) {
    const P = 9, u = ((t + i * 1.7) % P + P) % P, sz = hh * 1.9, at = door + hh * 0.35, foot = gy + 6;
    const walk = (from: number, to: number, a: number, b: number) => from + (to - from) * Math.min(1, Math.max(0, (u - a) / (b - a)));
    const stride = (rate: number) => Math.abs(Math.sin(t * rate + i)) * hh * 0.08;
    if (u < 4.2) {
      // working: a push-and-settle beat, squashing a little on each push
      const beat = (t * 1.6 + i * 0.3) % 1, push = Math.sin(beat * Math.PI * 2);
      this.critter(work, spot, foot - Math.max(0, push) * hh * 0.05, sz, t + i, Math.max(0, -push) * 0.05, push * 0.04);
    } else if (u < 5.8) this.mirrored(carry, walk(spot, at, 4.2, 5.8), foot - stride(10), sz, -1, Math.sin(t * 10 + i) * 0.05);
    else if (u < 6.4) this.critter(carry, at, foot, sz, t + i, Math.sin(((u - 5.8) / 0.6) * Math.PI) * 0.1, -0.12, true);
    else if (u < 8) this.critter(idle, walk(at, spot, 6.4, 8), foot - stride(10), sz, t + i, 0, Math.sin(t * 10 + i) * 0.05);
    else this.critter(idle, spot, foot, sz, t * 1.1 + i * 2, 0, Math.sin(t * 2 + i) * 0.04);
  }
  /** A walking frame painted facing right, drawn facing `dir`, leaning `lean`. */
  private mirrored(img: HTMLImageElement, x: number, footY: number, sz: number, dir: 1 | -1, lean: number) {
    const c = this.c; c.save(); c.translate(x, footY); c.scale(dir, 1); c.rotate(lean); c.drawImage(img, -sz / 2, -sz, sz, sz); c.restore();
  }
  /** Sparkles around a building at its grandest. */
  private twinkles(size: number, t: number, i: number) {
    const c = this.c;
    for (let k = 0; k < 4; k++) {
      const tw = Math.sin(t * 2.4 + k * 1.7 + i); if (tw < 0.3) continue;
      c.globalAlpha = tw; this.star(Math.sin(k * 2.3 + i) * size * 0.4, -size * (0.45 + ((k * 0.37) % 0.5)), size * 0.03, '#fff3b0');
    }
    c.globalAlpha = 1;
  }
  /** Soft puffs drifting up from the roof of a building at work, tinted with its colour. */
  private wisps(x: number, y: number, size: number, t: number, i: number, color: string) {
    const c = this.c, tint = shade(color, 90);
    for (let k = 0; k < 3; k++) {
      const u = (t * 0.45 + k / 3 + i * 0.13) % 1, r = size * (0.03 + u * 0.05);
      c.globalAlpha = Math.sin(u * Math.PI) * 0.35; c.fillStyle = tint;
      c.beginPath(); c.arc(x + size * 0.12 + Math.sin(u * 5 + k) * size * 0.05, y - u * size * 0.32, r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }
  // ---- upgrade dressing, drawn in the building's own frame: origin at the ground under its middle, `size` tall
  /** Upgrade 1: a string of bunting swung across the front. */
  private bunting(size: number, t: number, i: number) {
    const c = this.c, x0 = -size * 0.44, x1 = size * 0.44, y = -size * 0.58, sag = size * 0.09, n = 9;
    const at = (u: number) => [x0 + (x1 - x0) * u, y + Math.sin(u * Math.PI) * sag] as const;
    c.strokeStyle = '#6b4a2a'; c.lineWidth = Math.max(1.2, size * 0.012); c.beginPath();
    for (let k = 0; k <= 20; k++) { const [px, py] = at(k / 20); if (k) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke();
    const cols = ['#e8505b', '#ffd86b', '#5fb8e8', '#7ccf6a', '#f49ac1'];
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n, [px, py] = at(u), fw = size * 0.034, fh = size * 0.07, sway = Math.sin(t * 2.4 + k + i) * fw * 0.35;
      c.fillStyle = cols[(k + i) % cols.length]; c.beginPath(); c.moveTo(px - fw, py); c.lineTo(px + fw, py); c.lineTo(px + sway, py + fh); c.closePath(); c.fill();
    }
  }
  /** Upgrade 2, behind the painting: a warm glow, as if the place is busy and lit up. */
  private glow(size: number, t: number, i: number) {
    const c = this.c, r = size * (0.62 + Math.sin(t * 1.6 + i) * 0.02), cy = -size * 0.45;
    const gr = c.createRadialGradient(0, cy, size * 0.1, 0, cy, r);
    gr.addColorStop(0, 'rgba(255,214,120,.55)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, cy, r, 0, Math.PI * 2); c.fill();
  }
  /** Upgrade 2, in front: two paper lanterns on posts either side of the door. */
  private lanterns(size: number, t: number, i: number) {
    const c = this.c;
    for (const side of [-1, 1]) {
      const px = side * size * 0.47, top = -size * 0.36, lw = size * 0.06, lh = size * 0.085, swing = Math.sin(t * 2 + side + i) * 0.12;
      c.fillStyle = '#5a3a1e'; c.fillRect(px - size * 0.008, top, size * 0.016, -top);
      c.save(); c.translate(px, top); c.rotate(swing);
      const lit = 0.8 + Math.sin(t * 5 + side * 2 + i) * 0.2;
      c.fillStyle = `rgba(255,190,80,${0.35 * lit})`; c.beginPath(); c.arc(0, lh * 0.75, lh * 1.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8505b'; c.beginPath(); c.ellipse(0, lh * 0.75, lw, lh * 0.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = `rgba(255,230,150,${0.7 * lit})`; c.beginPath(); c.ellipse(0, lh * 0.75, lw * 0.5, lh * 0.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2a1a'; c.fillRect(-lw * 0.5, lh * 0.12, lw, lh * 0.12); c.fillRect(-lw * 0.5, lh * 1.28, lw, lh * 0.12);
      c.restore();
    }
  }
  /** Upgrade 3: a flag in the building's colour flying from a pole on top, with a twinkle. */
  private pennant(size: number, t: number, color: string) {
    const c = this.c, px = size * 0.06, base = -size * 0.86, top = -size * 1.12, fl = size * 0.2, fh = size * 0.11;
    c.fillStyle = '#5a3a1e'; c.fillRect(px - size * 0.008, top, size * 0.016, base - top);
    c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(px, top, size * 0.018, 0, Math.PI * 2); c.fill();
    // the flag ripples: its top and bottom edges follow the same travelling wave, more at the free end
    const wave = (u: number) => Math.sin(t * 6 - u * 4) * fh * 0.18 * u, y0 = top + size * 0.01;
    c.fillStyle = color; c.strokeStyle = shade(color, -60); c.lineWidth = Math.max(1, size * 0.008); c.beginPath(); c.moveTo(px, y0);
    for (let k = 1; k <= 8; k++) { const u = k / 8; c.lineTo(px + fl * u, y0 + fh * 0.25 * u + wave(u)); }
    for (let k = 8; k >= 0; k--) { const u = k / 8; c.lineTo(px + fl * u, top + fh * (1 - u * 0.5) + wave(u)); }
    c.closePath(); c.fill(); c.stroke();
    const tw = Math.max(0, Math.sin(t * 2.2)); if (tw > 0.2) { c.globalAlpha = tw; this.star(-size * 0.3, -size * 0.92, size * 0.035, '#fff3b0'); this.star(size * 0.36, -size * 0.7, size * 0.025, '#fff3b0'); c.globalAlpha = 1; }
  }
  /** One gold star per milestone reached, in a row under the progress bar (five, then a count). */
  private milestoneStars(x: number, gy: number, n: number) {
    const c = this.c, y = gy + 30, r = 5.5, gap = 13, shown = Math.min(n, 5), x0 = x - ((shown - 1) * gap) / 2 - (n > 5 ? 10 : 0);
    for (let k = 0; k < shown; k++) this.star(x0 + k * gap, y, r, '#ffd23f');
    if (n > 5) { c.font = `900 11px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff8e8'; c.fillText(`×${n}`, x0 + (shown - 1) * gap + 9, y + 0.5); }
  }
  private drawnBuilding(i: number, size: number, t: number, busy: boolean) {
    const c = this.c, b = BUILDINGS[i], u = size / 100, col = b.color, ink = '#5a3a1e';
    c.lineJoin = 'round'; c.lineWidth = 2.2 * u; c.strokeStyle = ink;
    const box = (x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.rect(x * u, y * u, w * u, h * u); c.fill(); c.stroke(); };
    const roof = (x: number, y: number, w: number, h: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.moveTo((x - 4) * u, y * u); c.lineTo((x + w / 2) * u, (y - h) * u); c.lineTo((x + w + 4) * u, y * u); c.closePath(); c.fill(); c.stroke(); };
    const circle = (x: number, y: number, r: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.arc(x * u, y * u, r * u, 0, Math.PI * 2); c.fill(); c.stroke(); };
    const spin = busy ? t * 2 : t * 0.5;
    switch (b.id) {
      case 'meadow': box(-30, -40, 60, 40, '#c99a5b'); roof(-30, -40, 60, 22, '#a8643a'); box(-18, -26, 16, 14, '#f2d27a'); box(2, -26, 16, 14, '#f2d27a'); for (let k = 0; k < 5; k++) { c.strokeStyle = '#7fae4a'; c.beginPath(); c.moveTo((34 + k * 3) * u, 0); c.lineTo((34 + k * 3 + Math.sin(t * 2 + k) * 3) * u, (-22 - k % 2 * 6) * u); c.stroke(); } break;
      case 'spa': box(-34, -30, 68, 30, '#e9d8b4'); c.fillStyle = col; c.beginPath(); c.arc(0, -30 * u, 34 * u, Math.PI, 0); c.fill(); c.stroke(); box(-10, -22, 20, 22, '#7a5a3a'); c.fillStyle = '#ffffffaa'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc((-8 + k * 8) * u, (-70 - ((t * 20 + k * 12) % 26)) * u, (4 + k) * u, 0, Math.PI * 2); c.fill(); } break;
      case 'pebble': box(-30, -44, 50, 44, '#b8c4cc'); roof(-30, -44, 50, 18, '#7a8fa3'); c.save(); c.translate(32 * u, -20 * u); c.rotate(spin); c.fillStyle = '#9b6b3e'; c.beginPath(); c.arc(0, 0, 16 * u, 0, Math.PI * 2); c.fill(); c.stroke(); for (let k = 0; k < 6; k++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(16 * u, 0); c.stroke(); } c.restore(); for (let k = 0; k < 4; k++) circle(-24 + k * 9, -4, 4, ['#9fb6c9', '#e7a7c8', '#c9c2bb', '#8fcf9a'][k]); break;
      case 'orchard': for (const ox of [-22, 18]) { box(ox - 3, -30, 6, 30, '#8a5a32'); circle(ox, -44, 20, '#8fbf5a'); for (let k = 0; k < 3; k++) circle(ox - 8 + k * 8, -42 + (k % 2) * 8, 3.5, '#e85a4a'); } box(-10, -12, 20, 12, '#c99a5b'); break;
      case 'cushion': box(-26, -50, 52, 50, '#f3e2d0'); roof(-26, -50, 52, 18, '#c97a8a'); c.save(); c.translate(0, -62 * u); c.rotate(spin); for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 2); c.fillStyle = k % 2 ? '#e7a7c8' : '#fff4f8'; c.beginPath(); c.moveTo(0, 0); c.lineTo(30 * u, -6 * u); c.lineTo(30 * u, 6 * u); c.closePath(); c.fill(); c.stroke(); } c.restore(); circle(0, -62, 4, ink); for (let k = 0; k < 3; k++) { c.fillStyle = ['#e7a7c8', '#a8d4ff', '#ffe08a'][k]; this.round((-40 + k * 8) * u, (-10 - k * 6) * u, 16 * u, 10 * u, 4 * u); c.fill(); c.stroke(); } break;
      case 'bakery': box(-32, -42, 64, 42, '#f0dcc0'); roof(-32, -42, 64, 20, '#a8643a'); c.fillStyle = '#d9583a'; for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#fff' : '#d9583a'; c.fillRect((-30 + k * 12) * u, -30 * u, 12 * u, 6 * u); } c.save(); c.shadowColor = '#ff9a3c'; c.shadowBlur = 14 * u * (0.6 + 0.4 * Math.sin(t * 5)); circle(14, -12, 9, '#ff9a3c'); c.restore(); box(-22, -18, 18, 18, '#7a5a3a'); break;
      case 'lantern': box(-30, -40, 60, 40, '#8a6a4a'); c.fillStyle = '#cfe8f0aa'; c.beginPath(); c.moveTo(-34 * u, -40 * u); c.lineTo(0, -62 * u); c.lineTo(34 * u, -40 * u); c.closePath(); c.fill(); c.stroke(); for (let k = 0; k < 4; k++) { const lx = -24 + k * 16, sw = Math.sin(t * 2 + k) * 3; c.save(); c.shadowColor = '#ffd86b'; c.shadowBlur = 16 * u; circle(lx + sw, -26 + (k % 2) * 8, 6, '#ffd86b'); c.restore(); } break;
      case 'observatory': box(-24, -50, 48, 50, '#d8d2c6'); c.fillStyle = '#c9d4f0'; c.beginPath(); c.arc(0, -50 * u, 26 * u, Math.PI, 0); c.fill(); c.stroke(); c.save(); c.translate(0, -60 * u); c.rotate(-0.6 + Math.sin(t * 0.4) * 0.2); c.fillStyle = '#c99a3c'; c.fillRect(0, -5 * u, 34 * u, 10 * u); c.strokeRect(0, -5 * u, 34 * u, 10 * u); c.restore(); box(-8, -20, 16, 20, '#5a4a6a'); break;
      case 'balloon': { box(-34, -12, 68, 12, '#a8743a'); const by = -70 + Math.sin(t * 1.3) * 4; c.beginPath(); c.moveTo(-10 * u, -12 * u); c.lineTo(-8 * u, (by + 24) * u); c.moveTo(10 * u, -12 * u); c.lineTo(8 * u, (by + 24) * u); c.stroke(); box(-10, by + 24, 20, 12, '#c99a5b'); c.fillStyle = col; c.beginPath(); c.ellipse(0, by * u, 26 * u, 30 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#ff9ab0'; c.beginPath(); c.ellipse(0, by * u, 10 * u, 30 * u, 0, 0, Math.PI * 2); c.fill(); c.stroke(); break; }
      case 'tea': for (let k = 0; k < 3; k++) circle(-30 + k * 14, -6, 8, '#6fae6a'); box(4, -34, 32, 34, '#f3e2c0'); c.fillStyle = '#4f8a5a'; c.beginPath(); c.moveTo(-2 * u, -34 * u); c.quadraticCurveTo(20 * u, -54 * u, 42 * u, -34 * u); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ffffff99'; c.beginPath(); c.arc(-14 * u, (-30 - ((t * 14) % 20)) * u, 4 * u, 0, Math.PI * 2); c.fill(); break;
      case 'bells': box(-14, -86, 28, 86, '#e8e0f0'); roof(-14, -86, 28, 18, '#8a6ac0'); for (let k = 0; k < 3; k++) { const sw = Math.sin(t * 3 + k) * 0.3; c.save(); c.translate(0, (-74 + k * 20) * u); c.rotate(sw); c.fillStyle = '#d8dce8'; c.beginPath(); c.moveTo(-6 * u, 0); c.lineTo(6 * u, 0); c.lineTo(9 * u, 12 * u); c.lineTo(-9 * u, 12 * u); c.closePath(); c.fill(); c.stroke(); c.restore(); } c.globalAlpha = 0.35; c.strokeStyle = ['#8af0c0', '#c08cff', '#ff9ad0'][Math.floor(t) % 3]; c.lineWidth = 6 * u; c.beginPath(); c.moveTo(-40 * u, -90 * u); c.quadraticCurveTo(0, (-110 + Math.sin(t) * 8) * u, 40 * u, -90 * u); c.stroke(); c.globalAlpha = 1; break;
      case 'skyship': { box(-8, -60, 8, 60, '#8a5a32'); box(-36, -8, 72, 8, '#a8743a'); const sy = -66 + Math.sin(t * 1.1) * 3; c.fillStyle = '#9b6b3e'; c.beginPath(); c.moveTo(-6 * u, sy * u); c.lineTo(44 * u, sy * u); c.quadraticCurveTo(40 * u, (sy + 16) * u, 10 * u, (sy + 16) * u); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f2d27a'; c.beginPath(); c.moveTo(18 * u, sy * u); c.lineTo(18 * u, (sy - 34) * u); c.lineTo(38 * u, (sy - 6) * u); c.closePath(); c.fill(); c.stroke(); c.strokeStyle = '#ff9a6a'; c.beginPath(); c.moveTo(18 * u, (sy - 34) * u); c.quadraticCurveTo(4 * u, (sy - 40 + Math.sin(t * 4) * 3) * u, -12 * u, (sy - 34) * u); c.stroke(); break; }
    }
  }
  private pair(g: HayloftGame, L: ReturnType<HayloftScene['L']>) {
    // the pair stands side by side in the home spot, sized so neither runs off the edge or into the other
    const c = this.c, t = this.wall, hgt = Math.min(L.front, L.home * 0.4), gy = this.h - 6;
    for (const id of ['dora', 'enzo'] as const) {
      const k = id === 'dora' ? 0 : 1, x = L.home * (k ? 0.8 : 0.36), age = t - this.cheer[id], up = age < 0.45 ? Math.sin((age / 0.45) * Math.PI) * hgt * 0.16 : 0;
      c.fillStyle = 'rgba(40,30,20,.2)'; c.beginPath(); c.ellipse(x, gy, hgt * 0.32, hgt * 0.06, 0, 0, Math.PI * 2); c.fill();
      const img = this.art(age < 0.45 ? `${id}-cheer` : id) ?? (age < 0.45 ? this.art(id) : null);
      // an idle hop now and then, out of step with each other
      const idle = (t * 0.17 + k * 0.45) % 1, skip = age >= 0.45 && idle < 0.06 ? Math.sin((idle / 0.06) * Math.PI) * hgt * 0.07 : 0;
      if (img) this.critter(img, x, gy - up - skip, hgt * 1.2, t + k * 1.7, 0, Math.sin(t * 0.8 + k * 2.5) * 0.035);
      else drawChinchilla(c, id, x, gy - up, { face: k ? -1 : 1, h: hgt * 0.75, time: t + k, air: up > 2, blink: Math.sin(t * 0.8 + k * 2) > 0.97 });
    }
    // the fluff meter as a little cloud ring over the pair
    const f = g.s.fluff / 50, burst = g.boost('fluff');
    if (f > 0.02 || burst) {
      const x = L.home * 0.49, y = gy - hgt * 1.12, r = Math.max(10, hgt * 0.14);
      c.lineWidth = 5; c.strokeStyle = '#ffffff55'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = burst ? `hsl(${(t * 200) % 360},90%,75%)` : '#ffd1e8'; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (burst ? 1 : f)); c.stroke();
    }
  }
  private visitor(g: HayloftGame) {
    const v = g.s.visitor, p = this.visitorAt(g); if (!v || !p) return;
    const c = this.c, img = this.art(`visitor-${v.kind}`), t = this.wall;
    // a soft glow so it reads as tappable
    c.save(); c.globalAlpha = 0.45 + 0.2 * Math.sin(t * 6); c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(p.x, p.y, p.r * 1.25, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(p.x, p.y); if (v.dir < 0) c.scale(-1, 1);
    if (img) c.drawImage(img, -p.r * 1.3, -p.r * 1.3, p.r * 2.6, p.r * 2.6); else this.drawnVisitor(v.kind, p.r, t);
    c.restore();
    if (Math.random() < 0.3) this.puffs.push({ x: p.x - v.dir * p.r, y: p.y, vx: -v.dir * 20, vy: 10, life: 0, max: 0.6, color: v.kind === 'acorn' ? '#ffe27a' : '#ffffff', size: 2.5, star: true, world: false });
  }
  private drawnVisitor(kind: VisitorKind, r: number, t: number) {
    const c = this.c, wing = Math.sin(t * 24) * 0.6, ink = '#5a3a1e';
    c.lineWidth = 2; c.strokeStyle = ink;
    const body = (col: string, rx: number, ry: number) => { c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };
    const eye = (x: number, y: number) => { c.fillStyle = '#2a1a10'; c.beginPath(); c.arc(x, y, Math.max(1.5, r * 0.07), 0, Math.PI * 2); c.fill(); };
    if (kind === 'acorn') {
      c.fillStyle = '#5ac08a'; c.save(); c.rotate(-wing); c.beginPath(); c.ellipse(-r * 0.1, -r * 0.4, r * 0.18, r * 0.5, -0.6, 0, Math.PI * 2); c.fill(); c.restore();
      body('#3fa878', r * 0.5, r * 0.32); eye(r * 0.28, -r * 0.08); c.beginPath(); c.moveTo(r * 0.45, 0); c.lineTo(r * 0.95, r * 0.05); c.stroke();
      c.save(); c.shadowColor = '#ffd86b'; c.shadowBlur = 16; c.fillStyle = '#ffcf4a'; c.beginPath(); c.ellipse(r * 0.05, r * 0.55, r * 0.22, r * 0.27, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
      c.fillStyle = '#a8743a'; c.beginPath(); c.ellipse(r * 0.05, r * 0.33, r * 0.25, r * 0.1, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (kind === 'pedlar') {
      c.strokeStyle = '#ffffffcc'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(0, -r * 0.4); c.lineTo(k * r * 0.25, -r * 1.05); c.stroke(); } c.strokeStyle = ink;
      body('#cfc2b0', r * 0.42, r * 0.38); eye(r * 0.18, -r * 0.08); c.fillStyle = '#c99a5b'; c.beginPath(); c.arc(-r * 0.35, r * 0.25, r * 0.25, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffd86b'; c.font = `900 ${Math.round(r * 0.3)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', -r * 0.35, r * 0.27);
    } else if (kind === 'owl') {
      c.fillStyle = '#a07a52'; c.save(); c.rotate(wing * 0.5); c.beginPath(); c.ellipse(-r * 0.4, 0, r * 0.4, r * 0.2, -0.3, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
      body('#b8905e', r * 0.45, r * 0.5); c.fillStyle = '#fff'; for (const x of [-0.16, 0.18]) { c.beginPath(); c.arc(x * r, -r * 0.12, r * 0.15, 0, Math.PI * 2); c.fill(); c.stroke(); eye(x * r, -r * 0.12); }
      c.fillStyle = '#a8d4ff'; c.fillRect(-r * 0.3, r * 0.42, r * 0.6, r * 0.18); c.strokeRect(-r * 0.3, r * 0.42, r * 0.6, r * 0.18);
    } else if (kind === 'bat') {
      c.fillStyle = '#7a5a8a'; for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.rotate(wing * 0.6); c.beginPath(); c.moveTo(r * 0.2, 0); c.quadraticCurveTo(r * 0.8, -r * 0.6, r * 0.95, r * 0.1); c.quadraticCurveTo(r * 0.6, 0, r * 0.2, r * 0.15); c.fill(); c.stroke(); c.restore(); }
      body('#9a7aa8', r * 0.32, r * 0.3); eye(-r * 0.1, -r * 0.05); eye(r * 0.1, -r * 0.05);
      c.save(); c.shadowColor = '#ff9a3c'; c.shadowBlur = 14; c.fillStyle = '#ff9a3c'; c.beginPath(); c.arc(0, r * 0.45, r * 0.16, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    } else {
      c.strokeStyle = '#ffffffdd'; c.lineWidth = 4; c.beginPath(); for (let a = 0; a < 12; a += 0.2) { const rr = r * 0.08 * a; c.lineTo(Math.cos(a + t * 4) * rr, Math.sin(a + t * 4) * rr * 0.7); } c.stroke();
      c.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { const a = t * 3 + k * 1.3; c.beginPath(); c.arc(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.5, r * 0.12, 0, Math.PI * 2); c.fill(); }
      eye(-r * 0.12, -r * 0.05); eye(r * 0.12, -r * 0.05);
    }
  }
  private shower(sh: TwigShower) {
    const c = this.c, { w, h } = this;
    c.fillStyle = 'rgba(40,24,12,.35)'; c.fillRect(0, 0, w, h);
    const tw = this.art('twig'), tg = this.art('twig-gold'), size = Math.max(40, Math.min(w, h) * 0.13);
    for (const t of sh.twigs) {
      if (t.gone || sh.time < t.born) continue;
      const x = t.x * w, y = sh.y(t) * h;
      if (t.caught) continue;
      c.save(); c.translate(x, y); c.rotate(Math.sin(sh.time * 3 + t.id) * 0.5);
      const img = t.gold ? tg : tw;
      if (img) c.drawImage(img, -size / 2, -size / 2, size, size);
      else {
        if (t.gold) { c.shadowColor = '#ffd86b'; c.shadowBlur = 18; }
        c.strokeStyle = t.gold ? '#ffcf4a' : '#8a5a32'; c.lineWidth = size * 0.12; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-size * 0.4, size * 0.3); c.lineTo(size * 0.4, -size * 0.3); c.moveTo(0, 0); c.lineTo(size * 0.1, -size * 0.32); c.stroke();
        c.fillStyle = t.gold ? '#fff2a8' : '#7fbf5a'; c.beginPath(); c.ellipse(size * 0.18, -size * 0.36, size * 0.14, size * 0.07, -0.6, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(-size * 0.12, -size * 0.02, size * 0.13, size * 0.06, 0.8, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    const left = Math.max(0, 10 - sh.time);
    c.fillStyle = '#3a2a1acc'; this.round(16, 14, w - 32, 12, 6); c.fill();
    c.fillStyle = '#ffd86b'; this.round(17, 15, Math.max(10, (w - 34) * (left / 10)), 10, 5); c.fill();
    c.font = `900 ${Math.min(26, w / 12)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 5; c.strokeStyle = '#4a2e1acc';
    const label = `${sh.caught} caught`; c.strokeText(label, w / 2, 50); c.fillStyle = '#fff6d8'; c.fillText(label, w / 2, 50);
  }
  /** A caught twig: sparkles where it was. */
  twigPop(x: number, y: number, gold: boolean) { this.fluff(x * this.w, y * this.h, gold ? 16 : 8, false, gold ? '#ffe27a' : '#c8f59c'); this.float(x * this.w, y * this.h, gold ? '+3' : '+1', gold ? '#ffe27a' : '#e8ffd0', gold, false); }
  private round(x: number, y: number, w: number, h: number, r: number) { const c = this.c; c.beginPath(); c.roundRect(x, y, w, h, r); }
}
