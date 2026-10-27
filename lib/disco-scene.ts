// Dust Disco's stage, drawn in Canvas 2D: the venue, a pebble disco ball and sweeping lights, Dora and Enzo dancing either side
// of the note lanes, a bobbing crowd, dust-bunny notes and their bursts. Drawing only: the rules live in disco-game.ts.
import { drawChinchilla, coatLike, type Coat } from './chinchilla-art';
import type { DiscoGame, DiscoEvent, Judge, Song } from './disco-game';

export const LANE_COLORS = ['#ff8fb1', '#ffc95c', '#7fe0b0', '#7cc6ff'];
export const LANE_KEYS = ['D', 'F', 'J', 'K'];
const JUDGE_COLORS: Record<Judge, string> = { perfect: '#fff2a8', great: '#9ff0c4', good: '#a8d4ff', miss: '#d9a0b0' };
const JUDGE_TEXT: Record<Judge, string> = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
/** Each venue's colours when its painting has not loaded: sky top, sky bottom, floor, and two light colours. */
const LOOKS: Record<string, [string, string, string, string, string]> = {
  burrow: ['#3a2130', '#7a4436', '#5b3a2a', '#ffb36b', '#ff7fa8'],
  hayloft: ['#5b2e3e', '#e98a4f', '#8a5a2b', '#ffd66b', '#ff9a5c'],
  pond: ['#0f1c3a', '#284c6a', '#1d3d4a', '#7fe0d0', '#b58cff'],
  market: ['#2a1238', '#6a2a5a', '#3a2430', '#ff8fd0', '#ffb35c'],
  summit: ['#0b1838', '#2e4f8a', '#dfe9f5', '#8af0c0', '#b48cff'],
  hall: ['#1c0f33', '#4a2a6e', '#2a1a3e', '#ffd86b', '#c08cff'],
};
// the crowd: friends in all sorts of coats
const CROWD: Coat[] = [
  coatLike('enzo', { fur: '#c9c2bb', back: '#a59d96', face: '#d8d2cb' }), coatLike('dora', { fur: '#f3e6d6', back: '#e2cdb6' }),
  coatLike('enzo', { fur: '#6d6862', back: '#55504b', face: '#8a847d' }), coatLike('dora', { fur: '#e8d2b0', back: '#d0b38a', face: '#f0dcc0' }),
  coatLike('enzo', { fur: '#9c948c', back: '#7f776f' }), coatLike('dora', { fur: '#fbf4ea', back: '#efe2d0' }),
  coatLike('enzo', { fur: '#b3a89a', back: '#958a7c', face: '#c6bcae' }), coatLike('enzo', { fur: '#4f4b48', back: '#3d3936', face: '#6b6662' }),
];

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; star: boolean };
type Pop = { text: string; sub: string; color: string; born: number };

export class DiscoScene {
  private c: CanvasRenderingContext2D;
  private w = 0; private h = 0; private dpr = 1;
  private art = new Map<string, HTMLImageElement>();
  private sparks: Spark[] = [];
  private pop: Pop | null = null;
  private flash = [0, 0, 0, 0];
  private hop = { dora: -9, enzo: -9 };
  private dizzy = -9;
  private wall = 0;
  private bunny = new Map<string, HTMLCanvasElement>();
  constructor(private canvas: HTMLCanvasElement) {
    const c = canvas.getContext('2d'); if (!c) throw new Error('no 2d');
    this.c = c; this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(320, r.width); this.h = Math.max(320, r.height);
    this.canvas.width = Math.round(this.w * this.dpr); this.canvas.height = Math.round(this.h * this.dpr);
    this.bunny.clear();
  }
  /** Loads a venue's painting; until it arrives (or if it never does) the drawn venue is used. */
  venue(place: string) {
    if (this.art.has(place)) return;
    const img = new Image(); img.decoding = 'async'; img.src = `/art/disco/venue-${place}.webp`;
    this.art.set(place, img);
  }
  private painted(place: string) { const i = this.art.get(place); return i && i.complete && i.naturalWidth > 0 ? i : null; }
  /** Where things sit, recomputed from the canvas size. */
  private layout() {
    const { w, h } = this, hw = w < 700 ? Math.min(w - 24, 460) : Math.min(w * 0.5, 460, h * 0.62), x0 = (w - hw) / 2;
    return { hw, x0, lw: hw / 4, hitY: h * 0.84, top: h * 0.03, side: x0 };
  }
  /** Which lane a touch at `x` (CSS pixels) means: the lane under it, or the nearest quarter of the screen beside the lanes. */
  laneAt(x: number) {
    const L = this.layout();
    if (x >= L.x0 && x <= L.x0 + L.hw) return Math.min(3, Math.floor((x - L.x0) / L.lw));
    return Math.min(3, Math.max(0, Math.floor((x / this.w) * 4)));
  }
  /** Feed the game's events in as they happen: bursts, pops, hops. */
  feed(events: DiscoEvent[]) {
    const L = this.layout(), now = this.wall;
    for (const e of events) {
      if (e.kind === 'judge') {
        const x = L.x0 + L.lw * (e.lane + 0.5);
        if (e.judge !== 'miss') {
          this.burst(x, L.hitY, LANE_COLORS[e.lane], e.judge === 'perfect' ? 16 : 9, e.judge === 'perfect');
          this.flash[e.lane] = 1;
          if (e.judge === 'perfect' && e.combo % 8 === 0) this.hop[e.combo % 16 === 0 ? 'enzo' : 'dora'] = now;
        } else this.dizzy = now;
        const sub = e.judge === 'great' || e.judge === 'good' ? (e.offset < 0 ? 'EARLY' : 'LATE') : '';
        this.pop = { text: JUDGE_TEXT[e.judge], sub, color: JUDGE_COLORS[e.judge], born: now };
      } else if (e.kind === 'hold') {
        this.burst(L.x0 + L.lw * (e.lane + 0.5), L.hitY, '#fff6c8', 12, true);
      } else if (e.kind === 'drop') { this.dizzy = now; this.pop = { text: 'DROPPED', sub: '', color: JUDGE_COLORS.miss, born: now }; }
      else if (e.kind === 'dustup') { this.hop.dora = now; this.hop.enzo = now; for (let k = 0; k < 4; k++) this.burst(L.x0 + L.lw * (k + 0.5), L.hitY, LANE_COLORS[k], 14, true); }
      else if (e.kind === 'milestone') { this.pop = { text: `${e.combo} COMBO!`, sub: '', color: '#ffd86b', born: now }; this.hop.dora = now; this.hop.enzo = now + 0.12; }
      else if (e.kind === 'clear') { this.hop.dora = now; this.hop.enzo = now; }
    }
  }
  private burst(x: number, y: number, color: string, n: number, star: boolean) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * ((i + 0.5) / n)) + (Math.sin(i * 12.9898 + x) * 0.25), sp = 90 + ((i * 37) % 7) * 35;
      this.sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.45 + (i % 3) * 0.12, color, size: 3 + (i % 4), star: star && i % 3 === 0 });
    }
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
  }
  /** A cached dust bunny for a lane at the current size: a fluffy puff with two eyes. */
  private sprite(lane: number, r: number) {
    const key = lane + ':' + Math.round(r);
    let s = this.bunny.get(key); if (s) return s;
    s = document.createElement('canvas'); const px = Math.ceil(r * 2.6 * this.dpr); s.width = px; s.height = px;
    const c = s.getContext('2d')!; c.scale(this.dpr, this.dpr); const m = r * 1.3, col = LANE_COLORS[lane];
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(m, m + r * 0.55, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); c.fill();
    // fluff around the edge
    for (let k = 0; k < 11; k++) { const a = (k / 11) * Math.PI * 2; c.fillStyle = col; c.beginPath(); c.arc(m + Math.cos(a) * r * 0.78, m + Math.sin(a) * r * 0.7, r * 0.34, 0, Math.PI * 2); c.fill(); }
    const g = c.createRadialGradient(m - r * 0.3, m - r * 0.35, r * 0.1, m, m, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, shade(col, -0.25));
    c.fillStyle = g; c.beginPath(); c.ellipse(m, m, r * 0.86, r * 0.78, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(col, -0.45); c.lineWidth = Math.max(1, r * 0.07); c.stroke();
    // eyes and a blush
    c.fillStyle = '#2b1d26'; for (const dx of [-0.28, 0.28]) { c.beginPath(); c.ellipse(m + dx * r, m - r * 0.04, r * 0.11, r * 0.15, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; for (const dx of [-0.25, 0.31]) { c.beginPath(); c.arc(m + dx * r, m - r * 0.1, r * 0.045, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,120,150,.45)'; for (const dx of [-0.48, 0.48]) { c.beginPath(); c.ellipse(m + dx * r, m + r * 0.18, r * 0.12, r * 0.07, 0, 0, Math.PI * 2); c.fill(); }
    this.bunny.set(key, s);
    return s;
  }

  /**
   * Draws a frame. `t` is the song time (the menu passes its own clock), `song` gives the beat and venue, `game` is null on
   * menus. `speed` 1..10 sets how fast notes fall, `down` which lanes are held.
   */
  draw(song: Song, t: number, game: DiscoGame | null, opts: { speed: number; down: boolean[]; dt: number; lanes: boolean }) {
    const { c, w, h, dpr } = this, L = this.layout(), spb = 60 / song.bpm, beat = t / spb, pulse = Math.pow(1 - (((beat % 1) + 1) % 1), 3);
    const look = LOOKS[song.place] ?? LOOKS.burrow, dust = !!game?.dustUp, failed = game?.state === 'fail';
    this.wall += opts.dt;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ---- the venue
    const art = this.painted(song.place);
    if (art) {
      const k = Math.max(w / art.naturalWidth, h / art.naturalHeight), iw = art.naturalWidth * k, ih = art.naturalHeight * k;
      c.drawImage(art, (w - iw) / 2, (h - ih) / 2, iw, ih);
      c.fillStyle = `rgba(14,8,24,${0.28 - pulse * 0.06})`; c.fillRect(0, 0, w, h);
    } else {
      const g = c.createLinearGradient(0, 0, 0, h * 0.7); g.addColorStop(0, look[0]); g.addColorStop(1, look[1]);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      this.drawnVenue(song.place, look, beat);
      const f = c.createLinearGradient(0, h * 0.68, 0, h); f.addColorStop(0, shade(look[2], -0.1)); f.addColorStop(1, shade(look[2], -0.5));
      c.fillStyle = f; c.fillRect(0, h * 0.68, w, h * 0.32);
    }
    // ---- lights: beams sweeping on the beat, brighter in Dust Up
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      const fromX = k < 2 ? w * 0.04 : w * 0.96, sway = Math.sin(beat * Math.PI * 0.5 + k * 1.7) * 0.45, ang = Math.PI / 2 + (k < 2 ? -0.45 : 0.45) + sway;
      const len = h * 1.2, spread = 0.13, col = dust ? LANE_COLORS[wrap(k + Math.floor(beat))] : look[3 + (k % 2)];
      const g = c.createLinearGradient(fromX, 0, fromX + Math.cos(ang) * len, Math.sin(ang) * len);
      g.addColorStop(0, hexA(col, (dust ? 0.32 : 0.16) + pulse * 0.08)); g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g; c.beginPath(); c.moveTo(fromX, -10);
      c.lineTo(fromX + Math.cos(ang - spread) * len, Math.sin(ang - spread) * len); c.lineTo(fromX + Math.cos(ang + spread) * len, Math.sin(ang + spread) * len); c.closePath(); c.fill();
    }
    c.restore();
    // the burrow and the hall have one painted already
    if (!art || song.place === 'hayloft' || song.place === 'market') this.discoBall(w / 2, Math.max(34, h * 0.075), Math.max(18, Math.min(w, h) * 0.05), t, dust);
    // ---- dancers either side, on a lit floor
    const room = L.side > 130, dh = room ? Math.min(h * 0.22, L.side * 0.5, 150) : Math.min(h * 0.12, 70);
    const dx = room ? L.side * 0.5 : L.side * 0.45 + 6, dy = room ? h * 0.8 : h * 0.97;
    this.floor(dx, dy, dh, beat, dust, look[3]); this.floor(w - dx, dy, dh, beat, dust, look[4]);
    this.dancer('dora', dx, dy, dh, t, beat, dust, failed);
    this.dancer('enzo', w - dx, dy, dh, t, beat, dust, failed);
    if (opts.lanes) this.lanes(L, song, t, game, opts, pulse, dust);
    // ---- the crowd at the front
    this.crowd(beat, dust, opts.lanes ? L : null);
    // ---- sparks
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      s.life += opts.dt; s.x += s.vx * opts.dt; s.y += s.vy * opts.dt; s.vy += 260 * opts.dt;
      const a = Math.max(0, 1 - s.life / s.max); if (a <= 0) continue;
      c.fillStyle = hexA(s.color, a);
      if (s.star) star(c, s.x, s.y, s.size * 1.6, this.wall * 6 + s.x); else { c.beginPath(); c.arc(s.x, s.y, s.size * a + 1, 0, Math.PI * 2); c.fill(); }
    }
    c.restore();
    this.sparks = this.sparks.filter((s) => s.life < s.max);
  }

  private lanes(L: ReturnType<DiscoScene['layout']>, song: Song, t: number, game: DiscoGame | null, opts: { speed: number; down: boolean[]; dt: number }, pulse: number, dust: boolean) {
    const { c, h } = this, { x0, hw, lw, hitY, top } = L, pps = h * (0.42 + opts.speed * 0.13);
    // the panel
    c.save();
    const panel = c.createLinearGradient(0, top, 0, h);
    panel.addColorStop(0, 'rgba(20,12,34,0)'); panel.addColorStop(0.18, 'rgba(20,12,34,.62)'); panel.addColorStop(1, 'rgba(20,12,34,.86)');
    c.fillStyle = panel; roundRect(c, x0, top, hw, h - top + 20, 18); c.fill();
    if (dust) { c.strokeStyle = hexA(LANE_COLORS[Math.floor(this.wall * 8) % 4], 0.9); c.lineWidth = 3; c.stroke(); }
    for (let k = 0; k < 4; k++) {
      const lx = x0 + lw * k;
      // a lane lights up from the bottom while it is held or just hit
      this.flash[k] = Math.max(opts.down[k] ? 0.55 : 0, this.flash[k] - opts.dt * 3);
      if (this.flash[k] > 0) { const g = c.createLinearGradient(0, hitY, 0, hitY - h * 0.45); g.addColorStop(0, hexA(LANE_COLORS[k], 0.42 * this.flash[k])); g.addColorStop(1, hexA(LANE_COLORS[k], 0)); c.fillStyle = g; c.fillRect(lx + 2, hitY - h * 0.45, lw - 4, h * 0.45); }
      if (k) { c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(lx - 0.5, top + 20, 1, h); }
    }
    // beat lines rolling down
    if (game) {
      const spb = 60 / song.bpm, first = Math.ceil((t - 0.2) / spb);
      for (let b = first; ; b++) {
        const y = hitY - (b * spb - t) * pps; if (y < top + 10) break;
        const bar = b % song.meter === 0; c.fillStyle = bar ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.06)'; c.fillRect(x0 + 6, y - (bar ? 1 : 0.5), hw - 12, bar ? 2 : 1);
      }
    }
    // the hit pads
    const r = Math.min(lw * 0.34, 30);
    for (let k = 0; k < 4; k++) {
      const x = x0 + lw * (k + 0.5), on = opts.down[k];
      c.beginPath(); c.arc(x, hitY, r * (1 + pulse * 0.06), 0, Math.PI * 2);
      c.fillStyle = on ? hexA(LANE_COLORS[k], 0.55) : 'rgba(255,255,255,.08)'; c.fill();
      c.lineWidth = 3; c.strokeStyle = hexA(LANE_COLORS[k], on ? 1 : 0.75); c.stroke();
      c.fillStyle = on ? '#2b1d26' : 'rgba(255,255,255,.75)'; c.font = `800 ${Math.round(r * 0.62)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(LANE_KEYS[k], x, hitY + 1);
    }
    if (game) {
      // notes, far ones first
      const notes = game.chart.notes, ahead = (hitY - top) / pps + 0.1;
      const visible: number[] = [];
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i]; if (n.t - t > ahead) break;
        const st = game.notes[i];
        if (n.t + n.len < t - 0.3) continue;
        if (st.judge && st.judge !== 'miss' && (!n.len || st.tail)) continue;
        if (st.tail === 'ok') continue;
        visible.push(i);
      }
      // chord links
      for (const i of visible) {
        const n = notes[i]; if (!n.chord || game.notes[i].judge) continue;
        const other = visible.find((j) => j !== i && notes[j].chord && Math.abs(notes[j].t - n.t) < 1e-6 && notes[j].lane > n.lane);
        if (other === undefined) continue;
        const y = hitY - (n.t - t) * pps; c.fillStyle = 'rgba(255,240,200,.35)'; roundRect(c, x0 + lw * (n.lane + 0.5), y - 3, lw * (notes[other].lane - n.lane), 6, 3); c.fill();
      }
      for (let v = visible.length - 1; v >= 0; v--) {
        const i = visible[v], n = notes[i], st = game.notes[i], x = x0 + lw * (n.lane + 0.5);
        const held = game.holding(i), missed = st.judge === 'miss' || st.tail === 'drop';
        let y = hitY - (n.t - t) * pps;
        if (n.len) {
          const endY = hitY - (n.t + n.len - t) * pps, startY = held ? hitY : y, tw = lw * 0.36;
          if (startY > endY) {
            const g = c.createLinearGradient(0, endY, 0, startY);
            g.addColorStop(0, hexA(LANE_COLORS[n.lane], missed ? 0.15 : 0.35)); g.addColorStop(1, hexA(LANE_COLORS[n.lane], missed ? 0.25 : held ? 0.95 : 0.7));
            c.fillStyle = g; roundRect(c, x - tw / 2, endY, tw, startY - endY, tw / 2); c.fill();
            if (held) { c.save(); c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 5; k++) { const sy = startY - ((this.wall * 160 + k * 37) % Math.max(1, startY - endY)); c.fillStyle = 'rgba(255,250,220,.7)'; star(c, x + Math.sin(k * 3 + this.wall * 4) * tw * 0.3, sy, 3, this.wall * 5 + k); } c.restore(); }
            c.fillStyle = hexA('#ffffff', missed ? 0.2 : 0.8); c.beginPath(); c.arc(x, endY + tw / 2, tw / 2.2, 0, Math.PI * 2); c.fill();
          }
          if (held) y = hitY;
        }
        if (held) { this.flash[n.lane] = Math.max(this.flash[n.lane], 0.8); }
        const spr = this.sprite(n.lane, r * 0.95), size = spr.width / this.dpr;
        c.globalAlpha = missed ? 0.35 : 1;
        const wob = Math.sin(this.wall * 9 + i) * 0.06;
        c.save(); c.translate(x, y); c.scale(1 + wob, 1 - wob);
        if (dust && !missed) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = hexA(LANE_COLORS[n.lane], 0.35); c.beginPath(); c.arc(0, 0, r * 1.25, 0, Math.PI * 2); c.fill(); c.restore(); }
        c.drawImage(spr, -size / 2, -size / 2, size, size); c.restore();
        c.globalAlpha = 1;
      }
      // judgement and combo
      const p = this.pop, cx = x0 + hw / 2;
      if (p) {
        const age = this.wall - p.born; if (age < 0.6) {
          const s = 1 + Math.max(0, 0.25 - age) * 1.2; c.save(); c.translate(cx, h * 0.6); c.scale(s, s); c.globalAlpha = Math.min(1, (0.6 - age) * 4);
          c.font = `900 ${Math.round(Math.min(40, hw * 0.1))}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.lineWidth = 6; c.strokeStyle = 'rgba(30,14,40,.85)'; c.strokeText(p.text, 0, 0); c.fillStyle = p.color; c.fillText(p.text, 0, 0);
          if (p.sub) { c.font = `800 ${Math.round(Math.min(15, hw * 0.04))}px ${FONT}`; c.lineWidth = 4; c.strokeText(p.sub, 0, 26); c.fillStyle = '#f5ecff'; c.fillText(p.sub, 0, 26); }
          c.restore();
        }
      }
      if (game.combo >= 5) {
        c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.globalAlpha = 0.92;
        c.font = `900 ${Math.round(Math.min(64, hw * 0.15))}px ${FONT}`; c.lineWidth = 7; c.strokeStyle = 'rgba(30,14,40,.8)';
        c.strokeText(String(game.combo), cx, h * 0.4); c.fillStyle = dust ? LANE_COLORS[Math.floor(this.wall * 6) % 4] : '#fff6e0'; c.fillText(String(game.combo), cx, h * 0.4);
        c.font = `800 ${Math.round(Math.min(14, hw * 0.035))}px ${FONT}`; c.fillStyle = '#ffd86b'; c.fillText('COMBO', cx, h * 0.4 + Math.min(40, hw * 0.1));
        c.restore();
      }
      // progress along the top
      c.fillStyle = 'rgba(255,255,255,.12)'; roundRect(c, x0 + 14, top + 8, hw - 28, 5, 3); c.fill();
      c.fillStyle = song.color; roundRect(c, x0 + 14, top + 8, (hw - 28) * game.progress, 5, 3); c.fill();
    }
    c.restore();
  }

  private discoBall(x: number, y: number, r: number, t: number, dust: boolean) {
    const c = this.c;
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, y - r); c.stroke();
    c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
    const base = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); base.addColorStop(0, '#f4f0ff'); base.addColorStop(1, '#6d6688');
    c.fillStyle = base; c.fillRect(x - r, y - r, r * 2, r * 2);
    // pebble facets turning
    const rows = 7, spin = t * 0.6;
    for (let i = 0; i < rows; i++) {
      const lat = -Math.PI / 2 + ((i + 0.5) / rows) * Math.PI, ry = y + Math.sin(lat) * r, ring = Math.cos(lat) * r, cols = Math.max(4, Math.round(12 * Math.cos(lat)));
      for (let j = 0; j < cols; j++) {
        const lon = ((j / cols) * Math.PI * 2 + spin) % (Math.PI * 2), front = Math.cos(lon); if (front < 0) continue;
        const fx = x + Math.sin(lon) * ring, glint = 0.35 + 0.65 * Math.abs(Math.sin(j * 1.7 + i * 2.3 + t * 3));
        c.fillStyle = `rgba(${dust ? 255 : 230},${Math.round(220 + 35 * glint)},255,${0.25 + 0.6 * glint * front})`;
        c.fillRect(fx - (r / cols) * 2.2 * front, ry - r / rows * 0.8, (r / cols) * 4 * front, (r / rows) * 1.6);
      }
    }
    c.restore();
    c.strokeStyle = 'rgba(40,30,60,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const a = t * 1.3 + k * 2.1; c.fillStyle = 'rgba(255,255,240,.8)'; star(c, x + Math.cos(a) * r * 0.6, y + Math.sin(a * 1.3) * r * 0.5, 3 + Math.sin(t * 7 + k) * 1.5, t * 2 + k); }
    c.restore();
  }
  private floor(x: number, y: number, h: number, beat: number, dust: boolean, col: string) {
    const c = this.c, rx = h * 0.62, ry = h * 0.15;
    c.save(); c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.clip();
    const tiles = 5;
    for (let i = 0; i < tiles; i++) for (let j = 0; j < 2; j++) {
      const on = wrap(i + j + Math.floor(beat)) % 2 === 0;
      c.fillStyle = on ? hexA(dust ? LANE_COLORS[wrap(i + j + Math.floor(beat))] : col, 0.55) : 'rgba(20,10,30,.35)';
      c.fillRect(x - rx + (i * 2 * rx) / tiles, y - ry + j * ry, (2 * rx) / tiles + 1, ry + 1);
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke();
  }
  private dancer(id: 'dora' | 'enzo', x: number, base: number, h: number, t: number, beat: number, dust: boolean, failed: boolean) {
    const c = this.c, phase = ((beat % 1) + 1) % 1, side = id === 'dora' ? 1 : -1;
    const hopAge = this.wall - this.hop[id], hopping = hopAge >= 0 && hopAge < 0.45;
    const bounce = Math.abs(Math.sin(Math.PI * beat)) * h * 0.07 + (hopping ? Math.sin((hopAge / 0.45) * Math.PI) * h * 0.35 : 0);
    // a step left and right every bar, and they turn to face each other or the crowd
    const step = Math.sin((beat * Math.PI) / 2) * h * 0.12, turn = Math.floor(beat / 2) % 2 === 0 ? side : -side;
    const squash = 1 - Math.max(0, 0.08 - phase * 0.3);
    const dizzy = failed || this.wall - this.dizzy < 0.5;
    c.save(); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + step, base, h * 0.32 * (1 - bounce / h), h * 0.07, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.save(); c.translate(x + step, base - bounce);
    if (dust) { const spin = Math.cos(beat * Math.PI); c.scale(Math.abs(spin) < 0.15 ? 0.15 * Math.sign(spin || 1) : spin, 1); }
    c.scale(1 / squash, squash);
    drawChinchilla(c, id, 0, 0, { face: turn as 1 | -1, h, time: t, moving: !dizzy, run: 0.6, air: hopping || bounce > h * 0.12, dizzy, blink: phase > 0.92 });
    c.restore();
  }
  private crowd(beat: number, dust: boolean, L: ReturnType<DiscoScene['layout']> | null) {
    const { c, w, h } = this, n = Math.max(5, Math.min(11, Math.round(w / 110))), hh = Math.min(h * 0.12, 70);
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w, beside = L && x > L.x0 - hh * 0.4 && x < L.x0 + L.hw + hh * 0.4;
      if (beside) continue;
      const lift = Math.abs(Math.sin(Math.PI * (beat + i * 0.13))) * hh * (dust ? 0.3 : 0.12);
      drawChinchilla(c, CROWD[i % CROWD.length], x, h - 30 + hh * 0.25 - lift, { face: x < w / 2 ? 1 : -1, h: hh, time: beat * 0.5 + i, moving: false, air: dust && lift > hh * 0.2 });
    }
  }
  /** Simple shapes for each venue when its painting is not there. */
  private drawnVenue(place: string, look: string[], beat: number) {
    const { c, w, h } = this;
    c.save();
    if (place === 'pond' || place === 'summit') {
      for (let i = 0; i < 70; i++) { const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * w, y = (Math.sin(i * 45.3) * 0.5 + 0.5) * h * 0.55; c.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(beat * 0.5 + i))})`; c.fillRect(x, y, 2, 2); }
      c.fillStyle = 'rgba(255,250,225,.85)'; c.beginPath(); c.arc(w * 0.82, h * 0.18, Math.min(w, h) * 0.06, 0, Math.PI * 2); c.fill();
    }
    if (place === 'summit') { c.fillStyle = '#c6d6ee'; c.beginPath(); c.moveTo(0, h * 0.7); c.lineTo(w * 0.18, h * 0.38); c.lineTo(w * 0.34, h * 0.7); c.moveTo(w * 0.62, h * 0.7); c.lineTo(w * 0.84, h * 0.34); c.lineTo(w, h * 0.6); c.lineTo(w, h * 0.7); c.fill(); }
    if (place === 'market' || place === 'hayloft' || place === 'burrow') {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) {
        const x = (i + 0.5) * (w / 9), y = h * (0.12 + row * 0.1) + Math.sin(i * 0.7) * h * 0.03;
        c.fillStyle = hexA(i % 2 ? look[3] : look[4], 0.25 + 0.2 * Math.abs(Math.sin(beat * Math.PI + i))); c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill();
        c.fillStyle = i % 2 ? look[3] : look[4]; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
      }
    }
    if (place === 'hall') { for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(180,140,240,.18)'; c.beginPath(); c.moveTo(i * w / 6, h * 0.7); c.lineTo(i * w / 6 + w / 12, h * 0.1); c.lineTo((i + 1) * w / 6, h * 0.7); c.fill(); } }
    c.restore();
  }
}

const wrap = (n: number) => ((n % 4) + 4) % 4;
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + (i * Math.PI) / 4, rr = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
