// Pebble Pop's field, drawn in Canvas 2D: the painted place behind, the wall of blocks, the boss, Dora and Enzo on
// their hay bale, pebbles with trails, falling acorns, sparks, dust puffs, screen shake and floating words.
// Drawing only: the rules live in pebble-game.ts. Every painting has a drawn stand-in shown until (or unless) it loads.
import { drawChinchilla, type ChinId } from './chinchilla-art';
import { W, H, PADDLE_Y, PADDLE_H, BLOCKS, MAX_ANGLE, SPIN, type PebbleGame, type PebbleEvent, type BlockType, type Place, type Wall, type Ball } from './pebble-game';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** The drawn stand-in for each place: sky top, sky bottom, far hills, near ground, accent. */
const LOOKS: Record<Place, [string, string, string, string, string]> = {
  meadow: ['#8fd0f0', '#dff3e8', '#9fcf7a', '#6fae55', '#ffd86b'],
  creek: ['#7cc4d8', '#d6efe8', '#8cc0a0', '#5c9c86', '#bfe6ff'],
  frosty: ['#9fb8e0', '#eef4fb', '#c8d8ec', '#e9f0f8', '#9fd8ff'],
  barn: ['#f0a86a', '#fbe0b8', '#b97a4a', '#8a5532', '#ffcf7a'],
};
/** Each block's colours when its painting has not loaded: face, shade, edge, detail. */
const BLOCK_LOOK: Record<BlockType, [string, string, string, string]> = {
  crate: ['#d9a35f', '#b07a3c', '#6e4520', '#f0c88a'],
  stout: ['#b98049', '#8a5a2d', '#4f3016', '#d9a868'],
  acorn: ['#c98a45', '#9a6128', '#5a3514', '#7a5a2a'],
  ice: ['#bfe8ff', '#8cc8ee', '#4f8fbf', '#ffffff'],
  dust: ['#f1e6da', '#d8c8b8', '#b5a290', '#ffffff'],
  moss: ['#7fbf5a', '#5a9a3c', '#2f5e1f', '#b6e08a'],
  chain: ['#a9b4c4', '#7c879a', '#3e4757', '#ffd86b'],
  slide: ['#e6b46b', '#bd8642', '#6e4520', '#fff0c8'],
};
const PIECE: Record<BlockType, string> = { crate: '#c48a4a', stout: '#9a6a38', acorn: '#a86b2c', ice: '#d8f2ff', dust: '#f4ebe0', moss: '#7fbf5a', chain: '#b8c2d0', slide: '#e0a85c' };

type Bit = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'chip' | 'puff' | 'star' | 'acorn' | 'ring'; spin: number };
type Word = { x: number; y: number; text: string; color: string; born: number; size: number };
type Zap = { x1: number; y1: number; x2: number; y2: number; born: number };

export type DrawOpts = { dt: number; shake: boolean; paused: boolean };

export class PebbleScene {
  private c: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  /** The field's place on screen: its scale and top-left corner, in CSS pixels. */
  private s = 1; private ox = 0; private oy = 0;
  private art = new Map<string, HTMLImageElement>();
  private cache = new Map<string, HTMLCanvasElement>();
  private bits: Bit[] = [];
  private words: Word[] = [];
  private zaps: Zap[] = [];
  private trails = new Map<number, { x: number; y: number }[]>();
  private time = 0;
  private shakeAmp = 0;
  private flash = 0;
  private hop = -9;
  private cheer = -9;
  private wobble = -9;
  private bossOuch = -9;
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
    const names = ['bale', 'hold-dora', 'hold-enzo', 'pebble', 'acorn', 'crow-peek', 'badger-peek', 'boss-captain-caw', 'boss-frostwhisker', 'boss-big-bramble',
      ...Object.keys(BLOCKS).map((t) => 'block-' + t), 'block-ice-cracked', 'block-stout-cracked'];
    for (const n of names) this.load(n);
  }
  private load(name: string) {
    if (this.art.has(name)) return;
    const img = new Image(); img.decoding = 'async'; img.src = `/art/pebble/${name}.webp`; this.art.set(name, img);
  }
  private img(name: string) { const i = this.art.get(name); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** Starts loading a place's painting; the drawn place stands in until it arrives. */
  place(p: Place) { this.load('place-' + p); }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(300, r.width); this.h = Math.max(300, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    const top = this.w < 640 ? 58 : 66, bottom = this.w < 640 ? 76 : 14;
    this.s = Math.min((this.w - 16) / W, (this.h - top - bottom) / H);
    // on a phone the field sits near the top, leaving room below for a thumb to steer; elsewhere it is centred
    const spare = this.h - top - bottom - H * this.s;
    this.ox = (this.w - W * this.s) / 2; this.oy = top + (this.w < 640 ? Math.min(12, spare / 2) : spare / 2);
    this.cache.clear();
  }
  /** A screen x (CSS pixels from the canvas's left) in field units. */
  toField(x: number) { return (x - this.ox) / this.s; }
  /** Feeds the game's events in as they happen; returns how long to hold the action still (hit-stop), in seconds. */
  feed(events: PebbleEvent[], g: PebbleGame): number {
    let stop = 0;
    for (const e of events) {
      switch (e.k) {
        case 'hit': {
          const col = PIECE[e.type];
          if (e.popped) {
            this.burst(e.x, e.y, col, e.type === 'dust' ? 0 : 9, e.type === 'dust' ? 'puff' : 'chip');
            if (e.type === 'dust' || e.type === 'moss') this.burst(e.x, e.y, e.type === 'moss' ? '#b6e08a' : '#fff8ee', 6, 'puff');
            if (e.type === 'ice') this.burst(e.x, e.y, '#ffffff', 6, 'star');
            stop = Math.max(stop, e.type === 'stout' || e.type === 'ice' ? 0.045 : e.cause === 'pebble' ? 0.025 : 0);
          } else { this.burst(e.x, e.y, col, 4, 'chip'); stop = Math.max(stop, 0.02); }
          if (e.cause === 'pebble' && e.combo >= 5 && e.combo % 5 === 0) this.word(e.x, e.y - 8, `${e.combo} combo!`, e.combo >= 20 ? '#ff8fb1' : '#ffd86b', 14 + Math.min(10, e.combo / 3));
          break;
        }
        case 'crack': this.burst(e.x, e.y, '#ffffff', 5, 'star'); break;
        case 'chain': this.burst(e.x, e.y, '#ffd86b', 10, 'star'); this.burst(e.x, e.y, '#ffffff', 1, 'ring'); this.shake(5); stop = Math.max(stop, 0.05); break;
        case 'paddle': this.burst(e.x, PADDLE_Y, '#f3d27a', 5, 'chip'); this.hop = this.time; if (e.spin >= SPIN.min) { this.burst(e.x, PADDLE_Y, '#9fe0ff', 8, 'star'); this.word(e.x, PADDLE_Y - 18, 'SPIN!', '#9fe0ff', 15); } break;
        case 'bounce': break;
        case 'dust': this.burst(e.x, e.y, '#fff3e6', 8, 'puff'); break;
        case 'drop': for (let i = 0; i < 4; i++) this.burst(e.x, e.y, '#ffd86b', 1, 'star'); break;
        case 'acorn': this.word(e.x, e.y - 20, `+${e.n} 🌰`, '#ffe28a', 15); this.burst(e.x, e.y, '#ffd86b', 6, 'star'); break;
        case 'spark': this.zaps.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, born: this.time }); break;
        case 'burst': this.burst(e.x, e.y, '#8fcf6a', 14, 'chip'); this.burst(e.x, e.y, '#ffffff', 1, 'ring'); this.shake(6); stop = Math.max(stop, 0.06); break;
        case 'shield': this.burst(e.x, H - 4, '#fff3e6', 14, 'puff'); this.word(e.x, H - 30, 'Dust Up!', '#fff3e6', 16); this.shake(4); break;
        case 'lost': this.wobble = this.time; this.shake(8); this.flash = 0.35; this.word(W / 2, PADDLE_Y - 60, e.lives > 0 ? 'Oops! It rolled away' : 'Out of pebbles', '#ffd2c8', 18); break;
        case 'serve': this.trails.clear(); break;
        case 'launch': if (e.n > 1) this.word(W / 2, PADDLE_Y - 40, `${e.n} pebbles!`, '#ffffff', 16); break;
        case 'catch': this.burst(e.x, PADDLE_Y, '#ffcf6b', 6, 'puff'); break;
        case 'combo': this.cheer = this.time; this.word(W / 2, 200, `Combo ${e.n}! +${e.acorns} 🌰`, '#ffd86b', 22); this.shake(3); break;
        case 'boss': this.bossOuch = this.time; this.burst(e.x, e.y + 20, '#ffffff', 10, 'star'); this.shake(6); stop = Math.max(stop, 0.07); this.word(e.x, e.y - 30, e.hp > 0 ? 'Hmph!' : 'Fine, fine…', '#ffffff', 16); break;
        case 'rebuild': this.word(W / 2, 30, 'Grumble… rebuilding!', '#ffe0b8', 14); break;
        case 'regrow': this.burst(e.x, e.y, '#b6e08a', 6, 'puff'); break;
        case 'whisper': this.word(W / 2, 300, g.char === 'dora' ? 'Dora: “Nudge it to the last ones!”' : 'Enzo: “Over there, little pebble!”', '#ffffff', 14); break;
        case 'clear': this.cheer = this.time; this.hop = this.time; this.shake(e.boss ? 10 : 5); stop = Math.max(stop, 0.12); this.word(W / 2, 240, e.boss ? 'Calmed down!' : 'Wall cleared!', '#ffffff', 28); this.word(W / 2, 274, `+${e.acorns} 🌰`, '#ffe28a', 20); for (let i = 0; i < 6; i++) this.burst(40 + i * 56, 260, ['#ff8fb1', '#ffd86b', '#7fe0b0', '#7cc6ff'][i % 4], 8, 'star'); break;
      }
    }
    return stop;
  }
  private shake(n: number) { this.shakeAmp = Math.max(this.shakeAmp, n); }
  private word(x: number, y: number, text: string, color: string, size: number) { this.words.push({ x, y, text, color, size, born: this.time }); if (this.words.length > 12) this.words.shift(); }
  private burst(x: number, y: number, color: string, n: number, kind: Bit['kind']) {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.sin(x * 0.37 + i * 2.1 + this.time) * 0.6, sp = kind === 'puff' ? 25 + (i % 3) * 14 : 60 + ((i * 37) % 5) * 28;
      this.bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'chip' ? 50 : 10), life: 0, max: kind === 'puff' ? 0.6 : kind === 'ring' ? 0.35 : 0.5 + (i % 3) * 0.12, color, size: kind === 'puff' ? 5 + (i % 3) * 2 : kind === 'chip' ? 2 + (i % 3) : 2.5, kind, spin: (i % 2 ? 1 : -1) * (3 + i % 4) });
    }
    if (this.bits.length > 500) this.bits.splice(0, this.bits.length - 500);
  }

  // ---------------------------------------------------------------- drawing
  draw(g: PebbleGame | null, place: Place, o: DrawOpts) {
    const c = this.c, dt = o.paused ? 0 : o.dt; this.time += dt;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.backdrop(place);
    const w = g?.wall ?? null;
    // shake
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 40); this.flash = Math.max(0, this.flash - dt);
    const sk = o.shake ? this.shakeAmp : 0, sx = sk ? Math.sin(this.time * 91) * sk : 0, sy = sk ? Math.cos(this.time * 77) * sk : 0;
    c.setTransform(this.dpr * this.s, 0, 0, this.dpr * this.s, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));
    this.frame(place);
    c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
    if (w && g) {
      this.peekers(w);
      if (w.boss) this.boss(w);
      for (const k of w.blocks) if (k.alive) this.block(k.type, k.x, k.y, k.w, k.h, k.hp, k.max, w.clock - k.hitAt);
      // moss about to grow back shows as a faint sprout
      for (const k of w.blocks) if (!k.alive && k.type === 'moss' && k.regrowAt && k.regrowAt - w.clock < 2) { c.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 8); this.block('moss', k.x, k.y, k.w, k.h, 1, 1, 9); c.globalAlpha = 1; }
      this.zapsDraw();
      for (const d of w.drops) this.acorn(d.x, d.y, 7, this.time * 6 + d.x);
      if (w.shield > 0) this.shieldLine(w.shield);
      this.aimGuide(g, w);
      for (const b of w.balls) this.pebble(b, g);
      this.bale(g, w);
    }
    this.bitsDraw(dt);
    this.wordsDraw();
    c.restore();
    if (this.flash > 0) { c.fillStyle = `rgba(255,190,170,${this.flash * 0.5})`; c.fillRect(0, 0, W, H); }
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** The place behind the field: its painting, or a drawn sky, hills and ground. */
  private backdrop(place: Place) {
    const c = this.c, img = this.img('place-' + place);
    if (img) {
      const k = Math.max(this.w / img.naturalWidth, this.h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
      c.drawImage(img, (this.w - iw) / 2, (this.h - ih) / 2, iw, ih); c.fillStyle = 'rgba(30,20,30,.18)'; c.fillRect(0, 0, this.w, this.h); return;
    }
    const key = 'bg-' + place; let cv = this.cache.get(key);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = Math.round(this.w * this.dpr); cv.height = Math.round(this.h * this.dpr);
      const x = cv.getContext('2d')!; x.scale(this.dpr, this.dpr); const [t, b, far, near, acc] = LOOKS[place], w = this.w, h = this.h;
      const sky = x.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, t); sky.addColorStop(1, b); x.fillStyle = sky; x.fillRect(0, 0, w, h);
      // a soft sun or moon
      x.fillStyle = acc; x.globalAlpha = 0.5; x.beginPath(); x.arc(w * 0.82, h * 0.16, Math.min(w, h) * 0.08, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
      // clouds
      x.fillStyle = 'rgba(255,255,255,.7)';
      for (let i = 0; i < 6; i++) { const cx = ((i * 0.23 + 0.07) % 1) * w, cy = h * (0.08 + (i % 3) * 0.07); for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(cx + j * 22, cy + (j % 2) * 5, 26, 14, 0, 0, Math.PI * 2); x.fill(); } }
      const hills = (base: number, amp: number, col: string, f: number) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let px = 0; px <= w; px += 8) x.lineTo(px, base + Math.sin(px * f + base) * amp + Math.sin(px * f * 2.7) * amp * 0.4); x.lineTo(w, h); x.fill(); };
      if (place === 'frosty') {
        x.fillStyle = '#b8c9e2'; for (let i = 0; i < 5; i++) { const px = (i / 4) * w; x.beginPath(); x.moveTo(px - 160, h * 0.7); x.lineTo(px, h * (0.3 + (i % 2) * 0.08)); x.lineTo(px + 160, h * 0.7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(px - 40, h * (0.4 + (i % 2) * 0.08)); x.lineTo(px, h * (0.3 + (i % 2) * 0.08)); x.lineTo(px + 40, h * (0.4 + (i % 2) * 0.08)); x.fill(); x.fillStyle = '#b8c9e2'; }
      }
      hills(h * 0.62, 18, far, 0.01);
      if (place === 'creek') { x.fillStyle = '#6ab8d0'; x.fillRect(0, h * 0.78, w, h * 0.1); x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { const px = (i * 97) % w; x.beginPath(); x.moveTo(px, h * 0.81 + (i % 3) * 8); x.lineTo(px + 30, h * 0.81 + (i % 3) * 8); x.stroke(); } }
      if (place === 'barn') {
        x.fillStyle = '#b4513a'; x.fillRect(w * 0.08, h * 0.42, w * 0.3, h * 0.3); x.fillStyle = '#8a3a2a'; x.beginPath(); x.moveTo(w * 0.06, h * 0.43); x.lineTo(w * 0.23, h * 0.3); x.lineTo(w * 0.4, h * 0.43); x.fill();
        x.strokeStyle = '#f3e0c0'; x.lineWidth = 4; x.strokeRect(w * 0.18, h * 0.55, w * 0.1, h * 0.17); x.beginPath(); x.moveTo(w * 0.18, h * 0.55); x.lineTo(w * 0.28, h * 0.72); x.moveTo(w * 0.28, h * 0.55); x.lineTo(w * 0.18, h * 0.72); x.stroke();
      }
      hills(h * 0.82, 10, near, 0.017);
      if (place === 'meadow') for (let i = 0; i < 40; i++) { x.fillStyle = ['#ffffff', '#ffd86b', '#ff9ec0'][i % 3]; x.beginPath(); x.arc((i * 137) % w, h * 0.86 + ((i * 53) % 100) / 100 * h * 0.12, 2.5, 0, Math.PI * 2); x.fill(); }
      if (place === 'frosty') for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.arc((i * 173) % w, (i * 89) % h, 1.5 + (i % 3), 0, Math.PI * 2); x.fill(); }
      this.cache.set(key, cv);
    }
    c.drawImage(cv, 0, 0, this.w, this.h);
  }
  /** The field: a soft panel with a wooden rim, so the blocks read clearly against any painting. */
  private frame(place: Place) {
    const c = this.c;
    c.save();
    c.shadowColor = 'rgba(40,20,10,.35)'; c.shadowBlur = 18; c.fillStyle = place === 'frosty' ? 'rgba(236,244,252,.72)' : place === 'barn' ? 'rgba(255,240,215,.66)' : 'rgba(250,250,238,.62)';
    round(c, -4, -4, W + 8, H + 8, 14); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = '#7a5230'; c.lineWidth = 4; c.stroke();
    c.strokeStyle = 'rgba(255,230,180,.6)'; c.lineWidth = 1.5; round(c, -1, -1, W + 2, H + 2, 12); c.stroke();
    // a soft floor below the bale
    const g = c.createLinearGradient(0, PADDLE_Y + PADDLE_H, 0, H); g.addColorStop(0, 'rgba(120,80,40,0)'); g.addColorStop(1, 'rgba(120,80,40,.22)'); c.fillStyle = g; c.fillRect(0, PADDLE_Y, W, H - PADDLE_Y);
    c.restore();
  }
  /** One block: its painting, or a drawn crate, acorn pile, ice, dust cloud, moss, chain block or sliding crate. */
  private block(type: BlockType, x: number, y: number, w: number, h: number, hp: number, max: number, since: number) {
    const c = this.c, cracked = hp < max, name = 'block-' + type + (cracked && (type === 'ice' || type === 'stout') ? '-cracked' : ''), img = this.img(name);
    const squash = since < 0.12 ? 1 - Math.sin((since / 0.12) * Math.PI) * 0.12 : 1, wob = type === 'dust' ? Math.sin(this.time * 3 + x) * 0.6 : 0;
    c.save(); c.translate(x + w / 2, y + h / 2 + wob); c.scale(2 - squash, squash);
    if (img) c.drawImage(img, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    else c.drawImage(this.blockSprite(type, cracked, w, h), -w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    if (since < 0.1) { c.fillStyle = `rgba(255,255,255,${0.6 * (1 - since / 0.1)})`; round(c, -w / 2, -h / 2, w, h, 3); c.fill(); }
    c.restore();
  }
  private blockSprite(type: BlockType, cracked: boolean, w: number, h: number) {
    const key = `b-${type}-${cracked}-${Math.round(this.s * this.dpr * 10)}`; let cv = this.cache.get(key); if (cv) return cv;
    const k = this.s * this.dpr; cv = document.createElement('canvas'); cv.width = Math.ceil((w + 4) * k); cv.height = Math.ceil((h + 4) * k);
    const x = cv.getContext('2d')!; x.scale(k, k); x.translate(2, 2);
    const [face, shadeC, edge, det] = BLOCK_LOOK[type];
    const body = () => { round(x, 0, 0, w, h, type === 'dust' || type === 'moss' ? 6 : 3); };
    if (type === 'dust') {
      x.fillStyle = shadeC; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(4 + i * 4.6, h / 2 + (i % 2 ? 2 : -1), 5 + (i % 3), 0, Math.PI * 2); x.fill(); }
      x.fillStyle = face; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(4 + i * 4.6, h / 2 - 1 + (i % 2 ? 1 : -2), 4.5 + (i % 3), 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#5a4a40'; x.beginPath(); x.arc(w / 2 - 4, h / 2, 1.2, 0, Math.PI * 2); x.arc(w / 2 + 4, h / 2, 1.2, 0, Math.PI * 2); x.fill();
    } else if (type === 'moss') {
      x.fillStyle = shadeC; body(); x.fill();
      x.fillStyle = face; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(2 + i * 4.3, 4 + (i % 2) * 2, 4, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = det; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(5 + i * 5.5, 3 + (i % 2), 1.3, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = edge; x.lineWidth = 0.8; body(); x.stroke();
    } else {
      const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, face); gr.addColorStop(1, shadeC); x.fillStyle = gr; body(); x.fill();
      x.strokeStyle = edge; x.lineWidth = 1; body(); x.stroke();
      if (type === 'crate' || type === 'stout' || type === 'slide') {
        x.strokeStyle = edge; x.globalAlpha = 0.55; x.lineWidth = 0.8; x.beginPath(); x.moveTo(1, h / 2); x.lineTo(w - 1, h / 2); x.stroke();
        x.beginPath(); x.moveTo(3, 2); x.lineTo(w - 3, h - 2); x.stroke(); x.globalAlpha = 1;
        x.fillStyle = det; x.fillRect(2, 1.5, w - 4, 1.2);
        if (type === 'stout') { x.fillStyle = '#5a5a62'; for (const px of [3, w - 5]) for (const py of [2.5, h - 4.5]) x.fillRect(px, py, 2, 2); }
        if (type === 'slide') { x.fillStyle = edge; x.font = `bold 8px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('◂ ▸', w / 2, h / 2 + 0.5); }
      }
      if (type === 'acorn') for (let i = 0; i < 4; i++) { const ax = 5 + i * 6.5, ay = h / 2 + (i % 2 ? 1 : -1); x.fillStyle = '#8a5a26'; x.beginPath(); x.ellipse(ax, ay + 1.5, 3, 3.6, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#5e3a17'; x.beginPath(); x.ellipse(ax, ay - 1.8, 3.4, 1.8, 0, 0, Math.PI * 2); x.fill(); }
      if (type === 'ice') { x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.moveTo(3, 2); x.lineTo(12, 2); x.lineTo(5, h - 3); x.closePath(); x.fill(); }
      if (type === 'chain') { x.strokeStyle = det; x.lineWidth = 1.6; for (const px of [w / 2 - 5, w / 2 + 5]) { x.beginPath(); x.ellipse(px, h / 2, 4.5, 3, 0, 0, Math.PI * 2); x.stroke(); } x.fillStyle = det; x.beginPath(); x.arc(w / 2, h / 2, 1.6, 0, Math.PI * 2); x.fill(); }
      if (cracked) { x.strokeStyle = type === 'ice' ? '#ffffff' : edge; x.lineWidth = 1; x.beginPath(); x.moveTo(w * 0.45, 0); x.lineTo(w * 0.52, h * 0.4); x.lineTo(w * 0.4, h * 0.6); x.lineTo(w * 0.5, h); x.moveTo(w * 0.52, h * 0.4); x.lineTo(w * 0.7, h * 0.55); x.stroke(); }
    }
    this.cache.set(key, cv); return cv;
  }
  /** Grumpy crows and badgers peeking from the sides and perching on elite walls. Just for looks. */
  private peekers(w: Wall) {
    if (w.boss) return;
    const c = this.c, t = w.clock, cycle = 9, ph = (t % cycle) / cycle, n = Math.floor(t / cycle);
    const who = (n + w.step) % 3 === 0 ? 'badger' : 'crow', left = (n + w.step) % 2 === 0;
    if (ph > 0.55 && ph < 0.9) {
      const k = Math.sin(((ph - 0.55) / 0.35) * Math.PI), y = 140 + ((n * 47) % 120);
      c.save(); c.translate(left ? -18 + k * 22 : W + 18 - k * 22, y); if (!left) c.scale(-1, 1); this.critter(who, 16, false); c.restore();
    }
    if (w.kind === 'elite') for (const px of [40, W - 40]) { c.save(); c.translate(px, 26 + Math.sin(this.time * 2 + px) * 1.5); if (px > W / 2) c.scale(-1, 1); this.critter('crow', 14, true); c.restore(); }
  }
  private critter(who: 'crow' | 'badger', size: number, perched: boolean) {
    const c = this.c, img = this.img(who + '-peek');
    if (img) { c.drawImage(img, -size * 1.4, -size * 1.4, size * 2.8, size * 2.8); return; }
    if (who === 'crow') {
      c.fillStyle = '#2f2c3a'; c.beginPath(); c.ellipse(0, 0, size * 0.9, size * 0.75, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0a040'; c.beginPath(); c.moveTo(size * 0.7, -size * 0.1); c.lineTo(size * 1.3, size * 0.05); c.lineTo(size * 0.7, size * 0.2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(size * 0.35, -size * 0.2, size * 0.18, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(size * 0.4, -size * 0.18, size * 0.09, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(size * 0.12, -size * 0.45); c.lineTo(size * 0.55, -size * 0.32); c.stroke();
      if (perched) { c.strokeStyle = '#f0a040'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-2, size * 0.7); c.lineTo(-2, size); c.moveTo(3, size * 0.7); c.lineTo(3, size); c.stroke(); }
    } else {
      c.fillStyle = '#6a6460'; c.beginPath(); c.ellipse(0, 0, size, size * 0.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f4f0ea'; c.beginPath(); c.ellipse(size * 0.35, -size * 0.05, size * 0.55, size * 0.32, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2624'; c.beginPath(); c.ellipse(size * 0.3, -size * 0.05, size * 0.5, size * 0.1, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#111'; c.beginPath(); c.arc(size * 0.85, size * 0.02, size * 0.12, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(size * 0.25, -size * 0.38); c.lineTo(size * 0.6, -size * 0.25); c.stroke();
    }
  }
  /** The boss: a grumpy crow or badger carrying its stack of blocks, with a calm-down meter. */
  private boss(w: Wall) {
    const c = this.c, B = w.boss!; if (B.hp <= 0) return;
    const ouch = this.time - this.bossOuch < 0.3, cx = B.x + B.w / 2, cy = B.y + B.h / 2;
    const img = this.img('boss-' + B.name.toLowerCase().replace(/\s+/g, '-'));
    c.save(); c.translate(cx, cy + Math.sin(this.time * 3) * 1.5); if (ouch) c.rotate(Math.sin(this.time * 60) * 0.05);
    if (img) c.drawImage(img, -B.w / 2 - 20, -B.h / 2 - 22, B.w + 40, B.h + 34);
    else if (B.who === 'crow') {
      const flap = Math.sin(this.time * 9) * 0.5;
      c.fillStyle = '#2f2c3a';
      for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.rotate(-0.3 + flap); c.beginPath(); c.ellipse(B.w * 0.36, -4, 28, 11, -0.4, 0, Math.PI * 2); c.fill(); c.restore(); }
      c.beginPath(); c.ellipse(0, 0, 34, 26, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f0a040'; c.beginPath(); c.moveTo(-7, 2); c.lineTo(0, 16); c.lineTo(7, 2); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 11, -6, 6, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(s * 10, ouch ? -6 : -4, 3, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 3; c.beginPath(); c.moveTo(s * 4, -14); c.lineTo(s * 18, -10); c.stroke(); }
      // a little captain's hat
      c.fillStyle = '#3a5a9a'; c.beginPath(); c.ellipse(0, -24, 18, 6, 0, 0, Math.PI * 2); c.fill(); c.fillRect(-10, -36, 20, 12); c.fillStyle = '#ffd86b'; c.fillRect(-10, -28, 20, 3);
    } else {
      const frosty = B.name === 'Frostwhisker';
      c.fillStyle = frosty ? '#8a8e9a' : '#6a6460'; c.beginPath(); c.ellipse(0, 4, 52, 24, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f4f0ea'; c.beginPath(); c.ellipse(0, -2, 26, 18, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a2624'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 11, -4, 6, 16, s * 0.2, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#111'; c.beginPath(); c.ellipse(0, 12, 6, 4, 0, 0, Math.PI * 2); c.fill();
      for (const s of [-1, 1]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 11, -2, 3.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(s * 11, ouch ? -2 : -1, 1.8, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(s * 5, -10); c.lineTo(s * 17, -7); c.stroke(); }
      // paws holding up the stack below
      c.fillStyle = frosty ? '#6e727e' : '#4e4844'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 36, 26, 9, 6, 0, 0, Math.PI * 2); c.fill(); }
      if (frosty) { c.fillStyle = '#e9f4ff'; c.beginPath(); c.ellipse(0, -20, 22, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7fb8e8'; c.fillRect(-4, -30, 8, 10); }
      else { c.fillStyle = '#c84a3a'; c.beginPath(); c.moveTo(-20, -18); c.quadraticCurveTo(0, -34, 20, -18); c.fill(); }
    }
    c.restore();
    // calm-down meter
    const bw = 120, bx = W / 2 - bw / 2, by = 8;
    c.fillStyle = 'rgba(40,30,40,.55)'; round(c, bx - 2, by - 2, bw + 4, 10, 5); c.fill();
    c.fillStyle = '#ff8fb1'; round(c, bx, by, bw * (B.hp / B.max), 6, 3); c.fill();
    c.fillStyle = '#fff'; c.font = `bold 8px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(B.name, W / 2, by + 9);
  }
  private zapsDraw() {
    const c = this.c; this.zaps = this.zaps.filter((z) => this.time - z.born < 0.25);
    for (const z of this.zaps) {
      const a = 1 - (this.time - z.born) / 0.25; c.strokeStyle = `rgba(255,236,140,${a})`; c.lineWidth = 2; c.beginPath(); c.moveTo(z.x1, z.y1);
      for (let i = 1; i < 6; i++) { const t = i / 6; c.lineTo(z.x1 + (z.x2 - z.x1) * t + Math.sin(i * 7 + z.born * 50) * 5, z.y1 + (z.y2 - z.y1) * t + Math.cos(i * 5 + z.born * 40) * 5); }
      c.lineTo(z.x2, z.y2); c.stroke();
    }
  }
  private acorn(x: number, y: number, r: number, spin: number) {
    const c = this.c, img = this.img('acorn');
    c.save(); c.translate(x, y); c.rotate(Math.sin(spin) * 0.4);
    if (img) c.drawImage(img, -r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    else { c.fillStyle = '#a8692c'; c.beginPath(); c.ellipse(0, 1.5, r * 0.7, r * 0.85, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#5e3a17'; c.beginPath(); c.ellipse(0, -r * 0.35, r * 0.8, r * 0.42, 0, 0, Math.PI * 2); c.fill(); c.fillRect(-0.8, -r * 0.95, 1.6, 2.5); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.25, r * 0.2, r * 0.15, r * 0.3, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  private shieldLine(n: number) {
    const c = this.c, y = H - 3;
    c.save(); c.globalAlpha = 0.7 + Math.sin(this.time * 4) * 0.15;
    for (let i = 0; i < 24; i++) { c.fillStyle = i % 2 ? '#fff3e6' : '#f0dcc6'; c.beginPath(); c.arc(i * 15.6 + 7, y + Math.sin(this.time * 3 + i) * 1.5, 6, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#7a5230'; c.font = `bold 9px ${FONT}`; c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText('🛡'.repeat(Math.min(n, 3)), W - 4, y - 4);
    c.restore();
  }
  /** While a pebble sits on the bale, a dotted line shows where it will go. */
  private aimGuide(g: PebbleGame, w: Wall) {
    const held = w.balls.find((b) => b.held); if (!held) return;
    const c = this.c, P = w.paddle, off = held.heldFor === 0 && held.hold === 0 ? (P.vx < -1 ? -0.18 : 0.18) : Math.max(-1, Math.min(1, held.hold / (P.w / 2))), a = off * MAX_ANGLE;
    c.save(); c.setLineDash([3, 6]); c.lineDashOffset = -this.time * 30; c.strokeStyle = 'rgba(90,60,30,.55)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(held.x, held.y); c.lineTo(held.x + Math.sin(a) * 110, held.y - Math.cos(a) * 110); c.stroke(); c.restore();
    if (held.heldFor === 0) {
      c.fillStyle = 'rgba(60,40,20,.75)'; c.font = `bold 12px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(g.char === 'enzo' ? 'Space or tap to launch · hold to charge spin' : 'Space or tap to launch', W / 2, PADDLE_Y - 70);
    }
  }
  private pebble(b: Ball, g: PebbleGame) {
    const c = this.c; let tr = this.trails.get(b.id);
    if (!tr) { tr = []; this.trails.set(b.id, tr); }
    if (!b.held) { tr.push({ x: b.x, y: b.y }); if (tr.length > 9) tr.shift(); } else tr.length = 0;
    const spin = Math.abs(b.spin) * Math.exp(-b.spinAge / SPIN.fade) > 0.3, comet = g.has('comet') && g.wall!.combo >= 5;
    tr.forEach((p, i) => { const a = (i + 1) / tr.length; c.fillStyle = spin ? `rgba(140,210,255,${a * 0.4})` : comet ? `rgba(255,190,90,${a * 0.45})` : `rgba(120,100,90,${a * 0.22})`; c.beginPath(); c.arc(p.x, p.y, b.r * (0.4 + a * 0.6), 0, Math.PI * 2); c.fill(); });
    const img = this.img('pebble');
    c.save(); c.translate(b.x, b.y); c.rotate((b.x + b.y) * 0.05);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(1.5, 2.5, b.r, b.r * 0.8, 0, 0, Math.PI * 2); c.fill();
    if (b.snow > 0) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#c8dcef'; c.lineWidth = 1; c.stroke(); }
    if (img) c.drawImage(img, -R0(b), -R0(b), R0(b) * 2, R0(b) * 2);
    else {
      const r = R0(b), gr = c.createRadialGradient(-r * 0.4, -r * 0.4, r * 0.1, 0, 0, r); gr.addColorStop(0, '#d8d2ca'); gr.addColorStop(1, '#7a716a');
      c.fillStyle = gr; c.beginPath(); c.ellipse(0, 0, r, r * 0.9, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#4e4640'; c.lineWidth = 0.8; c.stroke();
    }
    if (spin) { c.strokeStyle = '#9fe0ff'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, b.r + 2.5, this.time * 12, this.time * 12 + 4); c.stroke(); }
    if (b.pierce > 0) { c.fillStyle = '#7a5a2a'; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.fillRect(Math.cos(a) * (b.r + 1) - 0.7, Math.sin(a) * (b.r + 1) - 0.7, 1.4, 1.4); } }
    c.restore();
  }
  /** The hay bale, with Dora and Enzo holding it up at either end. */
  private bale(g: PebbleGame, w: Wall) {
    const c = this.c, P = w.paddle, x0 = P.x - P.w / 2, y = PADDLE_Y, hopK = Math.max(0, 1 - (this.time - this.hop) / 0.18), dip = hopK * 2.5;
    const img = this.img('bale');
    if (w.charge >= SPIN.min) { c.save(); c.shadowColor = '#9fe0ff'; c.shadowBlur = 10 + w.charge * 10; c.fillStyle = `rgba(159,224,255,${0.25 + w.charge * 0.35})`; round(c, x0 - 3, y - 3 + dip, P.w + 6, PADDLE_H + 6, 8); c.fill(); c.restore(); }
    if (img) {
      // three slices: the two rounded ends stay their shape, the middle stretches
      const cap = img.naturalHeight * 0.75, capW = Math.min(P.w / 2, PADDLE_H * 0.75), iw = img.naturalWidth, ih = img.naturalHeight;
      c.drawImage(img, 0, 0, cap, ih, x0, y + dip, capW, PADDLE_H);
      c.drawImage(img, cap, 0, iw - cap * 2, ih, x0 + capW, y + dip, P.w - capW * 2, PADDLE_H);
      c.drawImage(img, iw - cap, 0, cap, ih, x0 + P.w - capW, y + dip, capW, PADDLE_H);
    } else {
      const gr = c.createLinearGradient(0, y, 0, y + PADDLE_H); gr.addColorStop(0, '#f6d77e'); gr.addColorStop(1, '#c99a3e');
      c.fillStyle = gr; round(c, x0, y + dip, P.w, PADDLE_H, 6); c.fill(); c.strokeStyle = '#8a6420'; c.lineWidth = 1.2; c.stroke();
      c.strokeStyle = 'rgba(138,100,32,.55)'; c.lineWidth = 0.8;
      for (let i = 4; i < P.w - 2; i += 4) { c.beginPath(); c.moveTo(x0 + i, y + dip + 2); c.lineTo(x0 + i - 2, y + dip + PADDLE_H - 2); c.stroke(); }
      c.strokeStyle = '#a0522d'; c.lineWidth = 1.6; for (const f of [0.28, 0.72]) { c.beginPath(); c.moveTo(x0 + P.w * f, y + dip); c.lineTo(x0 + P.w * f, y + dip + PADDLE_H); c.stroke(); }
    }
    // the two friends, one at each end; whoever's run it is stands on the side the bale is heading
    const lead: ChinId = g.char, other: ChinId = lead === 'dora' ? 'enzo' : 'dora', cheer = this.time - this.cheer < 0.8, sad = this.time - this.wobble < 1;
    const ends: [ChinId, number, 1 | -1][] = [[lead, x0 + 2, -1], [other, x0 + P.w - 2, 1]];
    for (const [id, ex, side] of ends) {
      const h = id === g.char ? 24 : 21, airK = cheer ? Math.abs(Math.sin((this.time - this.cheer) * 12)) * 5 : hopK * 2;
      const img2 = this.img('hold-' + id);
      if (img2) { c.save(); c.translate(ex, y + dip + 4 - airK); c.scale(-side, 1); c.drawImage(img2, -h * 0.8, -h * 1.2, h * 1.6, h * 1.6); c.restore(); }
      else drawChinchilla(c, id, ex, y + dip + 3 - airK, { face: side === -1 ? 1 : -1, h, time: this.time, moving: Math.abs(P.vx) > 20, run: Math.abs(P.vx) / 300, air: airK > 1, dizzy: sad, blink: Math.sin(this.time * 1.7 + (id === 'dora' ? 0 : 2)) > 0.97 });
    }
  }
  private bitsDraw(dt: number) {
    const c = this.c;
    for (const b of this.bits) { b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.kind === 'chip' || b.kind === 'acorn') b.vy += 420 * dt; else { b.vx *= 0.94; b.vy *= 0.94; } }
    this.bits = this.bits.filter((b) => b.life < b.max);
    for (const b of this.bits) {
      const a = 1 - b.life / b.max;
      if (b.kind === 'puff') { c.fillStyle = b.color; c.globalAlpha = a * 0.7; c.beginPath(); c.arc(b.x, b.y, b.size * (1 + b.life * 2), 0, Math.PI * 2); c.fill(); }
      else if (b.kind === 'ring') { c.strokeStyle = b.color; c.globalAlpha = a; c.lineWidth = 2.5 * a; c.beginPath(); c.arc(b.x, b.y, 8 + b.life * 140, 0, Math.PI * 2); c.stroke(); }
      else if (b.kind === 'star') { c.fillStyle = b.color; c.globalAlpha = a; star(c, b.x, b.y, b.size * (0.6 + a * 0.6), b.life * b.spin); }
      else { c.save(); c.translate(b.x, b.y); c.rotate(b.life * b.spin); c.fillStyle = b.color; c.globalAlpha = Math.min(1, a * 1.5); c.fillRect(-b.size, -b.size * 0.6, b.size * 2, b.size * 1.2); c.restore(); }
    }
    c.globalAlpha = 1;
  }
  private wordsDraw() {
    const c = this.c; this.words = this.words.filter((w) => this.time - w.born < 1.1);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const w of this.words) {
      const t = this.time - w.born, a = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.3, pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.5 : 1.1 - Math.min(0.1, (t - 0.12));
      c.save(); c.translate(Math.max(60, Math.min(W - 60, w.x)), w.y - t * 18); c.scale(pop, pop); c.globalAlpha = Math.max(0, a);
      c.font = `900 ${w.size}px ${FONT}`; c.lineWidth = 4; c.strokeStyle = 'rgba(60,35,20,.85)'; c.strokeText(w.text, 0, 0); c.fillStyle = w.color; c.fillText(w.text, 0, 0); c.restore();
    }
  }
}

/** The pebble inside: its own size, or a little stone peeking out of a snowball. */
const R0 = (b: Ball) => (b.snow > 0 ? 4 : b.r);
function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.beginPath(); for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.4 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill();
}
