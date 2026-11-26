// Kopi Peng Brawl: drawing only. The painted stage panels side by side, every fighter, item, hawker and hazard
// sorted by depth, the comic effects (painted sound words, ink bursts, swipe smears, speed lines), each stage's twist
// made visible (the power cut's torch circles, the flood, the jets, the open train doors, the drum beat) and the HUD.
// Canvas 2D at a fixed 1536 x 864 internal size, scaled to fit the page.
import {
  type KopiGame, type Hero, type Foe, type Item, type Fx, type Sfx, type HeroId,
  VIEW_W, VIEW_H, FLOOR_Y, DEPTH, PANEL_W, MOVES, METER_MAX, SPECIAL_NAME, STAGES, FD, BD, type FoeKind, type BossKind,
} from './kopi-game';
import { KOPI_ATLAS } from './kopi-art';
import { drawHero, heroPose, HERO_S, type Pt } from './kopi-rig';
import { drawFoe, FOE_HEIGHT, type FoeView } from './kopi-foes';
/** puppets drawn larger than their painted size so foes and bosses hold their own next to the heroes */
const FOE_SCALE: Partial<Record<FoeView['kind'], number>> = { rat: 1.3, macaque: 1.12, mynah: 1.2, monitor: 1.25, roach: 1.2, python: 1.1, toad: 1.3, boar: 1.25, tank: 1.6, ssst: 1.2, tusker: 1.4, ong: 1.45, king: 1.3 };

const FONT = '"Arial Black", Impact, "Helvetica Neue", system-ui, sans-serif';
const ITEM_W: Record<string, number> = { tray: 84, stool: 78, wok: 96, durian: 58, pole: 210, satay: 70, kopibag: 52, fish: 86, ice: 54, plate: 64, kopi: 42, basin: 76, coconut: 48 };
const HERO_NAME: Record<HeroId, string> = { dora: 'DORA', enzo: 'ENZO' };
const INK = '#17110c';

interface Pop { kind: 'word' | 'burst' | 'smoke' | 'star' | 'speed'; x: number; y: number; t: number; life: number; name?: string; size: number; rot: number; vx?: number; vy?: number; big?: boolean }
interface Bubble { who: string; text: string; t: number }
interface Banner { text: string; sub?: string; t: number; life: number }

export class KopiScene {
  cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  imgs: Record<string, HTMLImageElement> = {};
  pops: Pop[] = []; bubbles: Bubble[] = []; banner: Banner | null = null;
  trails = new Map<HeroId, Pt[]>(); flash = 0; shakeT = 0; clock = 0; hint = ''; beatPulse = 0; lastBeat = 0;
  constructor(cv: HTMLCanvasElement) { this.cv = cv; this.ctx = cv.getContext('2d')!; }

  // ─────────────────────────────────────── loading
  load(names: string[]): Promise<void> {
    const want = names.filter((n) => !this.imgs[n]);
    return Promise.all(want.map((n) => new Promise<void>((res) => {
      const src = KOPI_ATLAS[n]?.src ?? `/art/kopi/${n}.webp`;
      const im = new Image(); im.onload = () => { this.imgs[n] = im; res(); }; im.onerror = () => res(); im.src = src;
    }))).then(() => undefined);
  }
  loadStage(si: number) {
    const bgs = STAGES[si].scenes.map((s) => s.bg);
    return this.load([...Object.keys(KOPI_ATLAS), ...bgs]);
  }
  img = (n: string): HTMLImageElement | null => this.imgs[n] ?? null;

  /** take a step's events: sound words, bursts, banners and speech */
  ingest(fx: Fx[], g: KopiGame) {
    for (const f of fx) {
      if (f.k === 'hit') {
        const x = f.x - g.camX, y = FLOOR_Y + f.z - f.h;
        this.pops.push({ kind: 'burst', x, y, t: 0, life: 0.22, size: f.big ? 150 : 90, rot: (f.x * 7) % 6.28, name: f.beat ? 'burst1' : f.big ? 'burst1' : 'burst2' });
        if (f.sfx) this.pops.push({ kind: 'word', x: x + ((f.x * 13) % 40) - 20, y: y - 70, t: 0, life: f.sfx === 'KO' ? 1.3 : 0.75, name: f.sfx, size: f.sfx === 'KO' ? 320 : f.big ? 210 : 150, rot: (((f.x * 31) % 30) - 15) / 100 });
        if (f.big) this.pops.push({ kind: 'speed', x, y, t: 0, life: 0.18, size: 260, rot: 0 });
      } else if (f.k === 'ko') {
        for (let i = 0; i < 3; i++) this.pops.push({ kind: 'star', x: f.x - g.camX, y: FLOOR_Y + f.z - 120, t: 0, life: 0.9, size: 26, rot: i * 2.1, vx: (i - 1) * 120, vy: -260 });
      } else if (f.k === 'out') {
        this.pops.push({ kind: 'word', x: f.x - g.camX, y: FLOOR_Y + f.z - 160, t: 0, life: 1.1, name: 'DUSH', size: 230, rot: -0.1 });
        this.bubbles.push({ who: 'Dora', text: 'Mind the doors!', t: 2 });
      } else if (f.k === 'dust' || f.k === 'smoke') {
        const big = f.k === 'smoke';
        for (let i = 0; i < (big ? 5 : 3); i++) this.pops.push({ kind: 'smoke', x: f.x - g.camX + (i - 1) * (big ? 60 : 34), y: FLOOR_Y + f.z - (big ? 50 : 10), t: 0, life: big ? 2.6 : 0.6, name: `smoke${1 + (i % 3)}`, size: big ? 150 : 70, rot: 0, vx: (i - 1) * 20, vy: big ? -6 : -30, big });
      } else if (f.k === 'banner') this.banner = { text: f.text, sub: f.sub, t: 0, life: f.t };
      else if (f.k === 'say') { this.bubbles = this.bubbles.filter((b) => b.who !== f.who); this.bubbles.push({ who: f.who, text: f.text, t: 2.8 }); }
      else if (f.k === 'flash') this.flash = 0.35;
      else if (f.k === 'shake') this.shakeT = Math.max(this.shakeT, f.a);
    }
  }
  reset() { this.pops = []; this.bubbles = []; this.banner = null; this.trails.clear(); }

  // ─────────────────────────────────────── the frame
  draw(g: KopiGame, dt: number) {
    const { cv, ctx } = this; this.clock += dt;
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#120d0a'; ctx.fillRect(0, 0, W, H);
    const k = Math.min(W / VIEW_W, H / VIEW_H), ox = (W - VIEW_W * k) / 2, oy = (H - VIEW_H * k) / 2;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();
    const sh = g.shake + (g.jet > 0 ? 8 : 0);
    if (sh > 0) ctx.translate(Math.sin(this.clock * 61) * sh, Math.cos(this.clock * 53) * sh * 0.6);
    if (g.curve !== 0) { ctx.translate(VIEW_W / 2, VIEW_H); ctx.rotate(g.curve * 0.012); ctx.translate(-VIEW_W / 2, -VIEW_H); }
    this.drawBackdrop(g);
    this.drawWorld(g, dt);
    this.drawWeather(g);
    this.drawPops(dt);
    ctx.restore();
    this.drawHud(g, dt);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,245,${this.flash * 1.6})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); this.flash -= dt; }
    if (g.lightning > 0) { ctx.fillStyle = `rgba(230,240,255,${g.lightning})`; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  drawBackdrop(g: KopiGame) {
    const { ctx } = this;
    const i0 = Math.floor(g.camX / PANEL_W);
    for (let i = i0; i <= i0 + 1; i++) {
      const sc = g.stage.scenes[i]; if (!sc) continue;
      const im = this.img(sc.bg), x = i * PANEL_W - g.camX;
      if (im) ctx.drawImage(im, 0, 0, im.width, im.height, x, 0, PANEL_W, VIEW_H);
      else { ctx.fillStyle = '#3a2a22'; ctx.fillRect(x, 0, PANEL_W, VIEW_H); ctx.fillStyle = '#6b5440'; ctx.fillRect(x, FLOOR_Y - 40, PANEL_W, VIEW_H); }
    }
    // the open train doors glow, and a station board says which
    if (g.stage.twist === 'train' && g.doors > 0) {
      const a = Math.min(1, g.doors, (6 - g.doors) * 3);
      for (const dx of g.doorXs()) {
        const x = g.lockX + dx - g.camX;
        ctx.fillStyle = `rgba(255,240,190,${0.35 * a})`; ctx.fillRect(x - 110, FLOOR_Y - 330, 220, 330);
        this.label('DOORS OPEN', x, FLOOR_Y - 350, 26, '#ffe14a', a);
      }
    }
  }

  // ─────────────────────────────────────── the world, back to front
  drawWorld(g: KopiGame, dt: number) {
    const { ctx } = this;
    type D = { z: number; f: () => void };
    const list: D[] = [];
    const sx = (x: number) => x - g.camX, sy = (z: number, h = 0) => FLOOR_Y + z - h;
    // hawkers at the back of the floor
    for (const hk of g.hawkers) list.push({ z: -30, f: () => this.drawHawker(hk.k, hk.act, sx(hk.x), sy(-6)) });
    for (const tb of g.tables) list.push({ z: tb.z, f: () => { this.shadow(sx(tb.x), sy(tb.z), 70); this.sprite('props', tb.broken ? 'tablebroken' : 'table', sx(tb.x), sy(tb.z) + 6, 170, 'bottom'); } });
    for (const it of g.items) if (!it.held || it.flying) list.push({ z: it.z, f: () => this.drawItem(g, it) });
    for (const s of g.shots) list.push({ z: s.z, f: () => { const x = sx(s.x), y = sy(s.z, s.h); ctx.save(); ctx.translate(x, y); ctx.scale(Math.sign(s.vx) || 1, 1); this.sprite('weapons', 'satay', 0, 0, 74); ctx.restore(); this.speedStreak(x, y, -Math.sign(s.vx)); } });
    for (const z of g.hazards) list.push({ z: z.z, f: () => this.drawHazard(g, z) });
    for (const s of g.smoke) list.push({ z: s.z + 1, f: () => { ctx.save(); ctx.globalAlpha = Math.min(0.45, s.t / 1.5); for (let i = 0; i < 4; i++) this.sprite('sfx', `smoke${1 + (i % 3)}`, sx(s.x) + Math.cos(i * 1.7 + this.clock * 0.6) * 70, sy(s.z) - 40 - i * 18, 150); ctx.restore(); } });
    for (const f of g.foes) list.push({ z: f.z + (f.st === 'ride' ? 0.5 : 0) + (f.st === 'carried' ? 2 : 0), f: () => this.drawFoeAt(g, f) });
    for (const h of g.heroes) list.push({ z: h.z + 0.25, f: () => this.drawHeroAt(g, h, dt) });
    list.sort((a, b) => a.z - b.z);
    for (const d of list) d.f();
  }
  depthK(z: number) { return 0.9 + 0.18 * (z / DEPTH); }
  shadow(x: number, y: number, r: number, a = 0.32) { const { ctx } = this; ctx.fillStyle = `rgba(20,10,5,${a})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.26, 0, 0, Math.PI * 2); ctx.fill(); }

  drawHeroAt(g: KopiGame, h: Hero, dt: number) {
    const { ctx } = this;
    const k = this.depthK(h.z), x = h.x - g.camX, ground = FLOOR_Y + h.z, y = ground - h.h;
    this.shadow(x, ground, 44 * k * Math.max(0.5, 1 - h.h / 400));
    const mv = h.move ? MOVES[h.move] : null;
    let anim = h.anim, at = Math.max(0, h.t);
    if (h.st === 'out') { anim = 'down'; at = 9; }
    if (h.st === 'down' && h.t > 0.5 && h.h <= 0) at = 0.4;
    const pose = heroPose(anim, this.clock + (h.id === 'enzo' ? 0.31 : 0), at, h.st === 'atk' ? mv?.dur : undefined);
    if (h.move === 'dora-special') pose.ua = 0.05;
    ctx.save();
    if (h.st === 'out') ctx.globalAlpha = 0.55;
    else if (h.inv > 0 && h.st !== 'atk' && Math.floor(this.clock * 20) % 2) ctx.globalAlpha = 0.55;
    const S = HERO_S[h.id] * k;
    const held = h.hold ? h.hold.kind : h.move === 'dora-special' ? 'tray' : h.move === 'enzo-special' ? 'stool' : null;
    const res = drawHero(ctx, this.img, h.id, pose, x, y, h.face, k, held ? (c, hand, ang) => {
      c.save(); c.translate(hand[0], hand[1]); c.rotate(ang); c.scale(1 / S, 1 / S);
      const w = ITEM_W[held] ?? 70;
      if (held === 'pole') { c.rotate(-0.2); this.sprite('weapons', held, 50, 0, w); } else this.sprite('weapons', held, w * 0.25, 0, w);
      c.restore();
    } : undefined);
    ctx.restore();
    // swipe smear: a white comic arc through the last few hand positions
    const tr = this.trails.get(h.id) ?? []; this.trails.set(h.id, tr);
    if (pose.smear || (h.move === 'dora-special' && h.st === 'atk')) { tr.push(res.hand); if (tr.length > 5) tr.shift(); } else tr.length = 0;
    if (tr.length >= 2) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const [w, col] of [[30, INK], [22, '#fffbe8']] as const) { ctx.strokeStyle = col; ctx.lineWidth = w * k; ctx.globalAlpha = col === INK ? 0.5 : 0.9; ctx.beginPath(); tr.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
      ctx.restore();
    }
    if (h.move === 'dora-special' && h.st === 'atk') { ctx.save(); ctx.strokeStyle = 'rgba(255,250,230,0.8)'; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y - 110, 120 + i * 18, 30 + i * 6, 0, this.clock * 14 + i, this.clock * 14 + i + 2.4); ctx.stroke(); } ctx.restore(); }
    // a carried foe rides overhead; a wrapped hero gets the coils (drawn by the python itself)
    if (h.st === 'wrapped' && h.ctrl !== 'bot') this.label('MASH ATTACK!', x, y - 270, 24, '#ffe14a', 0.6 + 0.4 * Math.sin(this.clock * 12));
    if (h.st === 'out') this.label(`${Math.ceil(h.outT)}`, x, y - 120, 40, '#fff', 0.9);
    if (h.st === 'stun') for (let i = 0; i < 3; i++) { const a = this.clock * 5 + i * 2.1; this.starAt(x + Math.cos(a) * 40, y - 245 + Math.sin(a) * 10, 12); }
    // who is who
    const tag = h.ctrl === 'p1' ? 'P1' : h.ctrl === 'p2' ? 'P2' : 'CPU';
    this.label(tag, x, y - 262 * k - (h.st === 'down' || h.st === 'out' ? -150 : 0), 18, h.ctrl === 'bot' ? '#d8d2c4' : h.id === 'dora' ? '#ff5a4a' : '#5ab8ff', 0.95);
  }

  drawFoeAt(g: KopiGame, f: Foe) {
    const { ctx } = this;
    const boss = f.boss, kind = f.kind as FoeView['kind'];
    const k = this.depthK(f.z) * (FOE_SCALE[kind] ?? 1), x = f.x - g.camX, ground = FLOOR_Y + f.z, y = ground - f.h;
    if (f.kind !== 'python' || f.h < 60) this.shadow(x, ground, (boss ? BD[f.kind as BossKind].rad * 1.4 : FD[f.kind as FoeKind].rad * 1.5) * this.depthK(f.z), f.h > 80 ? 0.16 : 0.3);
    ctx.save();
    if (f.dead) { ctx.globalAlpha = Math.max(0, 1 - f.fade / (boss ? 2.4 : 1.3)); }
    if (f.enrage > 0) { ctx.shadowColor = 'rgba(255,60,30,0.9)'; ctx.shadowBlur = 18; }
    const anim = f.dead ? (f.h > 0 ? 'air' : 'down') : f.anim;
    const res = drawFoe(ctx, this.img, { kind, anim, t: f.animT, face: f.face < 0 ? -1 : 1, flash: f.flash, dead: f.dead, hold: f.arm?.kind ?? null }, x, y, k);
    ctx.restore();
    // a held weapon (the mynah carries it in its feet)
    if (f.arm && f.kind === 'mynah') this.sprite('weapons', f.arm.kind, x, y + 30, (ITEM_W[f.arm.kind] ?? 70) * 0.8);
    else if (f.arm && !res) this.sprite('weapons', f.arm.kind, x + f.face * 40, y - 90, ITEM_W[f.arm.kind] ?? 70);
    // the wind-up tell: a red flash of "!" over a foe about to strike
    if (!f.dead && (f.st === 'wind' || (boss && ['charge', 'tongue', 'roar', 'wrap'].includes(f.pat) && f.t < 0.6))) {
      const hgt = (FOE_HEIGHT[kind] ?? 120) * k;
      this.label('!', x, y - hgt - 26, 44, '#ff3b2a', 0.6 + 0.4 * Math.sin(this.clock * 30));
    }
    if (f.st === 'cough') this.label('cough!', x, y - (FOE_HEIGHT[kind] ?? 100) * k - 10, 18, '#fff', 0.8);
    if (f.st === 'stun' || f.pat === 'stunned') for (let i = 0; i < 3; i++) { const a = this.clock * 5 + i * 2.1; this.starAt(x + Math.cos(a) * 34, y - (FOE_HEIGHT[kind] ?? 100) * k - 10 + Math.sin(a) * 8, 10); }
    // the python's coils around a wrapped hero
    // small foes' health
    if (!boss && !f.dead && f.hp < f.maxHp && f.kind !== 'roach') {
      const w = 70, bx = x - w / 2, by = y - (FOE_HEIGHT[kind] ?? 100) * k - 14;
      ctx.fillStyle = INK; ctx.fillRect(bx - 2, by - 2, w + 4, 9); ctx.fillStyle = '#ffcf3a'; ctx.fillRect(bx, by, w * Math.max(0, f.hp / f.maxHp), 5);
    }
  }
  drawItem(g: KopiGame, it: Item) {
    const { ctx } = this; const x = it.x - g.camX, ground = FLOOR_Y + it.z, y = ground - it.h;
    this.shadow(x, ground, (ITEM_W[it.kind] ?? 60) * 0.4, 0.25);
    ctx.save(); ctx.translate(x, y - 16);
    if (it.flying && !it.slide) ctx.rotate(this.clock * (it.spin || 12));
    const bob = !it.flying && (it.kind === 'kopi' || it.kind === 'plate') ? Math.sin(this.clock * 4) * 3 : 0;
    this.sprite('weapons', it.kind, 0, bob, ITEM_W[it.kind] ?? 60);
    ctx.restore();
    if (!it.flying && it.h <= 0 && (it.kind === 'kopi' || it.kind === 'plate')) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.clock * 5); ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, ground, 36, 10, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  }
  drawHazard(g: KopiGame, z: KopiGame['hazards'][number]) {
    const { ctx } = this; const ground = FLOOR_Y + z.z;
    if (z.tell > 0) { // a warning at the edge it comes from, in its lane
      const ex = z.dir > 0 ? 70 : VIEW_W - 70;
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.clock * 20);
      ctx.fillStyle = 'rgba(255,60,40,0.25)'; ctx.fillRect(0, ground - 26, VIEW_W, 52);
      ctx.restore(); this.label(z.kind === 'lion' ? '◀ LION! ▶' : z.kind === 'durian' ? 'DURIANS!' : 'TROLLEY!', ex, ground - 60, 28, '#ffe14a', 1);
      return;
    }
    const x = z.x - g.camX;
    this.shadow(x, ground, z.kind === 'lion' ? 140 : 80);
    ctx.save(); ctx.translate(x, ground); ctx.scale(z.kind === 'lion' ? z.dir : -z.dir, 1);
    if (z.kind === 'trolley') this.sprite('props', 'trolley', 0, Math.sin(this.clock * 30) * 2, 220, 'bottom');
    else if (z.kind === 'lion') this.sprite('props', Math.floor(this.clock * 4) % 2 ? 'lionup' : 'lion', 0, 0, 340, 'bottom');
    else { ctx.translate(0, -30); ctx.rotate(this.clock * 9 * z.dir); this.sprite('weapons', 'durian', 0, 0, 64); }
    ctx.restore();
    this.speedStreak(x, ground - 40, -z.dir);
  }
  drawHawker(k: string, act: string, x: number, y: number) {
    const pose = k === 'satay' ? (act === 'fan' ? 'satay-fan' : 'satay-stand') : k === 'drinks' ? (act === 'throw' ? 'drinks-throw' : act === 'slide' ? 'drinks-slide' : 'drinks-stand') : act === 'bang' ? 'noodle-bang' : 'noodle-stand';
    const bob = Math.sin(this.clock * (act === 'stand' ? 2 : 14)) * (act === 'stand' ? 2 : 4);
    this.shadow(x, y, 50, 0.25);
    this.sprite('hawkers', pose, x, y + bob, 190, 'bottom', true);
  }

  // ─────────────────────────────────────── weather and twists
  drawWeather(g: KopiGame) {
    const { ctx } = this;
    if (g.stage.twist === 'monsoon' && g.water > 0) {
      const top = FLOOR_Y - 10 + (1 - g.water) * 60;
      ctx.save(); ctx.globalAlpha = 0.18 + g.water * 0.25; ctx.fillStyle = '#3d7fa6'; ctx.fillRect(0, top, VIEW_W, VIEW_H - top); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#d8f2ff'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const x = ((i * 173 + this.clock * 40) % (VIEW_W + 200)) - 100, y = top + 20 + ((i * 59) % (VIEW_H - top - 30)); ctx.beginPath(); ctx.ellipse(x, y, 30 + (i % 3) * 10, 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
      // ripples round anything wading
      ctx.save(); ctx.strokeStyle = 'rgba(230,248,255,0.7)'; ctx.lineWidth = 2;
      for (const e of [...g.heroes, ...g.foes]) if (e.h < 10) { const r = 30 + 6 * Math.sin(this.clock * 6 + e.x); ctx.beginPath(); ctx.ellipse(e.x - g.camX, FLOOR_Y + e.z, r, r * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    if (g.stage.twist === 'monsoon' || g.slip > 0) {
      ctx.save(); ctx.strokeStyle = 'rgba(210,230,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 90; i++) { const x = ((i * 97 + this.clock * 900) % (VIEW_W + 300)) - 150, y = ((i * 211 + this.clock * 1500) % (VIEW_H + 100)) - 50; ctx.moveTo(x, y); ctx.lineTo(x - 14, y + 34); }
      ctx.stroke(); ctx.restore();
    }
    // jets: the shadow sweeps in during the tell, then the plane roars over
    if (g.stage.twist === 'jets' && (g.jetTell > 0 || g.jet > 0)) {
      const u = g.jetTell > 0 ? 1 - g.jetTell / 1.6 : 1 + (0.6 - g.jet) / 0.6;
      const px = VIEW_W + 300 - u * (VIEW_W + 600) * 0.55;
      ctx.save(); ctx.globalAlpha = 0.25 * Math.min(1, u * 2); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(px, FLOOR_Y + 110, 420, 70, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      this.sprite('props', 'jet', px, 120 - u * 30, 760);
      if (g.jetTell > 0) this.label('JUMP!', VIEW_W / 2, 200, 64, '#ffe14a', 0.6 + 0.4 * Math.sin(this.clock * 18));
      if (g.jet > 0) { this.pops.push({ kind: 'speed', x: VIEW_W / 2, y: VIEW_H / 2, t: 0, life: 0.1, size: 700, rot: 0 }); }
    }
    // the power cut: darkness with a torch circle round each hero
    if (g.dark > 0) {
      const a = Math.min(0.82, g.dark * 0.8);
      ctx.save(); ctx.fillStyle = `rgba(4,4,12,${a})`; ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H);
      for (const h of g.heroes) if (h.st !== 'out') { const x = h.x - g.camX, y = FLOOR_Y + h.z - h.h - 100; ctx.moveTo(x + 190, y); ctx.arc(x, y, 190, 0, Math.PI * 2, true); }
      ctx.fill('evenodd'); ctx.restore();
      for (const f of g.liveFoes()) if (f.kind !== 'roach') { const x = f.x - g.camX, y = FLOOR_Y + f.z - f.h - (FOE_HEIGHT[f.kind as FoeView['kind']] ?? 100) * 0.7; ctx.fillStyle = '#fff36a'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 9 + f.face * 6, y, 4, 0, Math.PI * 2); ctx.fill(); } }
    }
  }
  speedStreak(x: number, y: number, dir: number) {
    const { ctx } = this; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const yy = y - 30 + i * 18, l = 60 + ((i * 37) % 40); ctx.beginPath(); ctx.moveTo(x + dir * 40, yy); ctx.lineTo(x + dir * (40 + l), yy); ctx.stroke(); }
    ctx.restore();
  }

  // ─────────────────────────────────────── comic pops
  drawPops(dt: number) {
    const { ctx } = this;
    for (const p of this.pops) {
      p.t += dt; const u = p.t / p.life; if (u >= 1) continue;
      if (p.vx !== undefined) { p.x += p.vx * dt; p.y += (p.vy ?? 0) * dt; if (p.kind === 'star') p.vy = (p.vy ?? 0) + 900 * dt; }
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.kind === 'word') {
        const s = u < 0.12 ? 0.4 + (u / 0.12) * 0.8 : u < 0.2 ? 1.2 - (u - 0.12) / 0.08 * 0.2 : 1;
        ctx.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1; ctx.rotate(p.rot); ctx.scale(s, s); ctx.translate(0, -u * 30);
        if (!this.sprite('sfx', p.name!, 0, 0, p.size)) this.label(p.name + '!', 0, 0, p.size / 4, '#ffe14a', 1);
      } else if (p.kind === 'burst') { ctx.rotate(p.rot); const s = 0.5 + u * 0.8; ctx.scale(s, s); ctx.globalAlpha = 1 - u * u; this.sprite('sfx', p.name!, 0, 0, p.size); }
      else if (p.kind === 'smoke') { ctx.globalAlpha = (1 - u) * (p.big ? 0.42 : 0.8); // big smoke stays see-through: the fight must show through it
        const s = 0.6 + u * 0.7; ctx.scale(s, s); this.sprite('sfx', p.name!, 0, 0, p.size); }
      else if (p.kind === 'star') this.starAt(0, 0, p.size);
      else if (p.kind === 'speed') { ctx.globalAlpha = 1 - u; ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i < 16; i++) { const a = i * 0.3927 + p.x; const r0 = p.size * 0.5, r1 = p.size * (0.85 + (i % 3) * 0.1); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.7); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.7); ctx.stroke(); } }
      ctx.restore();
    }
    this.pops = this.pops.filter((p) => p.t < p.life);
  }
  starAt(x: number, y: number, r: number) {
    const { ctx } = this; ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // ─────────────────────────────────────── HUD
  drawHud(g: KopiGame, dt: number) {
    const { ctx } = this;
    this.heroPanel(g, g.hero('dora'), 18, 16, 1);
    this.heroPanel(g, g.hero('enzo'), VIEW_W - 18, 16, -1);
    // score and the stage strip
    this.label(String(g.stats.score).padStart(6, '0'), VIEW_W / 2, 34, 34, '#fff6d8', 1);
    this.label(`${g.stage.place.toUpperCase()} · ${g.scene.title}`, VIEW_W / 2, 66, 16, '#ffe9b0', 0.9);
    const prog = g.progress(); ctx.fillStyle = INK; ctx.fillRect(VIEW_W / 2 - 122, 80, 244, 10); ctx.fillStyle = '#ffcf3a'; ctx.fillRect(VIEW_W / 2 - 120, 82, 240 * prog, 6);
    // the drum beat in Chinatown
    if (g.stage.twist === 'liondance') {
      if (g.beat !== this.lastBeat) { this.lastBeat = g.beat; this.beatPulse = 1; }
      this.beatPulse = Math.max(0, this.beatPulse - dt * 5);
      const r = 28 + this.beatPulse * 14; ctx.save(); ctx.translate(VIEW_W / 2, 128);
      ctx.fillStyle = this.beatPulse > 0.5 ? '#ffcf3a' : '#b8262a'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore(); this.label('BONG', VIEW_W / 2, 128, 14, '#fff', 0.9);
      this.label('hit on the drum beat', VIEW_W / 2, 172, 14, '#ffe9b0', 0.8);
    }
    // boss bar
    const b = g.boss;
    if (b && !b.dead) {
      const w = 760, x = VIEW_W / 2 - w / 2, y = VIEW_H - 54;
      ctx.fillStyle = INK; ctx.fillRect(x - 4, y - 4, w + 8, 26); ctx.fillStyle = '#5b0f0f'; ctx.fillRect(x, y, w, 18);
      ctx.fillStyle = '#e8322a'; ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), 18);
      for (const m of [1 / 3, 2 / 3]) { ctx.fillStyle = INK; ctx.fillRect(x + w * m - 2, y, 4, 18); }
      this.label(g.bossName.toUpperCase(), VIEW_W / 2, y - 22, 26, '#ffe14a', 1);
    }
    // GO →
    if (!g.locked && g.mode === 'play' && Math.floor(this.clock * 3) % 2 === 0) { if (!this.sprite('sfx', 'GO', VIEW_W - 170, VIEW_H / 2 - 60, 220)) this.label('GO ▶', VIEW_W - 140, VIEW_H / 2, 60, '#ffe14a', 1); }
    // speech
    this.bubbles = this.bubbles.filter((s) => (s.t -= dt) > 0);
    this.bubbles.slice(-2).forEach((s, i) => this.bubble(g, s, i));
    // banner
    if (this.banner) {
      const bn = this.banner; bn.t += dt; const u = bn.t / bn.life;
      if (u >= 1 && bn.life < 8) this.banner = null;
      else {
        const s = bn.t < 0.18 ? 0.5 + bn.t / 0.18 * 0.5 : 1, a = u > 0.8 && bn.life < 8 ? (1 - u) / 0.2 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(VIEW_W / 2, 300); ctx.scale(s, s); ctx.rotate(-0.03);
        this.label(bn.text.toUpperCase(), 0, 0, 72, '#ffe14a', 1, '#c4221c');
        if (bn.sub) this.label(bn.sub, 0, 64, 26, '#fff6d8', 1);
        ctx.restore();
      }
    }
    if (this.hint && g.stageT < 9 && g.stageIdx === 0) this.label(this.hint, VIEW_W / 2, VIEW_H - 30, 18, '#fff6d8', Math.min(1, (9 - g.stageT) / 2));
  }
  heroPanel(g: KopiGame, h: Hero, x: number, y: number, side: number) {
    const { ctx } = this; const w = 360, x0 = side > 0 ? x : x - w;
    ctx.save(); ctx.fillStyle = 'rgba(23,17,12,0.78)'; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x0, y, w, 92, 10); ctx.fill(); ctx.stroke();
    // portrait: the painted head
    const px = side > 0 ? x0 + 46 : x0 + w - 46, py = y + 46;
    ctx.save(); ctx.beginPath(); ctx.arc(px, py, 38, 0, Math.PI * 2); ctx.fillStyle = h.id === 'dora' ? '#ffb4a2' : '#a8d4ff'; ctx.fill(); ctx.clip();
    const A = KOPI_ATLAS[h.id], im = this.img(h.id), r = A?.parts.head;
    if (A && im && r) { const s = 76 / Math.max(r[2], r[3]); ctx.translate(px, py + 6); ctx.scale(side > 0 ? 1 : -1, 1); ctx.drawImage(im, r[0], r[1], r[2], r[3], -r[2] * s / 2, -r[3] * s / 2, r[2] * s, r[3] * s); }
    ctx.restore();
    if (h.st === 'out') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(px, py, 38, 0, Math.PI * 2); ctx.fill(); }
    const bx = side > 0 ? x0 + 96 : x0 + 18, bw = w - 116;
    ctx.restore();
    const tag = h.ctrl === 'p1' ? 'P1' : h.ctrl === 'p2' ? 'P2' : 'CPU';
    this.label(`${HERO_NAME[h.id]}  ${tag}`, bx + (side > 0 ? 0 : bw), y + 20, 18, '#fff6d8', 1, undefined, side > 0 ? 'left' : 'right');
    ctx.fillStyle = INK; ctx.fillRect(bx - 2, y + 34, bw + 4, 20); ctx.fillStyle = '#3a1410'; ctx.fillRect(bx, y + 36, bw, 16);
    const hp = Math.max(0, h.hp / h.maxHp); ctx.fillStyle = hp < 0.3 ? '#ff7a2a' : '#e8322a';
    if (side > 0) ctx.fillRect(bx, y + 36, bw * hp, 16); else ctx.fillRect(bx + bw * (1 - hp), y + 36, bw * hp, 16);
    // the special meter: two bars
    for (let i = 0; i < 2; i++) {
      const v = Math.max(0, Math.min(1, (h.meter - i * 100) / 100)), sx = bx + i * (bw / 2 + 3), sw = bw / 2 - 3;
      ctx.fillStyle = INK; ctx.fillRect(sx - 1, y + 62, sw + 2, 14); ctx.fillStyle = '#3b3216'; ctx.fillRect(sx, y + 63, sw, 12);
      ctx.fillStyle = v >= 1 ? (Math.floor(this.clock * 6) % 2 ? '#fff36a' : '#ffcf3a') : '#c79a1e'; ctx.fillRect(sx, y + 63, sw * v, 12);
    }
    if (h.meter >= 100) this.label(SPECIAL_NAME[h.id].toUpperCase() + ' READY', bx + bw / 2, y + 100, 13, '#ffe14a', 0.85);
    void METER_MAX;
  }
  bubble(g: KopiGame, s: Bubble, i: number) {
    const { ctx } = this;
    const hero = s.who === 'Dora' ? g.hero('dora') : s.who === 'Enzo' ? g.hero('enzo') : null;
    const hk = g.hawkers.find((k) => s.who.startsWith(k.k === 'satay' ? 'Satay' : k.k === 'drinks' ? 'Drinks' : 'Noodle'));
    const bossSpeak = g.boss && s.who === g.bossName ? g.boss : null;
    let ax = VIEW_W / 2, ay = 230 + i * 70;
    if (hero) { ax = hero.x - g.camX; ay = FLOOR_Y + hero.z - hero.h - 270; }
    else if (hk) { ax = hk.x - g.camX; ay = FLOOR_Y - 230; }
    else if (bossSpeak) { ax = bossSpeak.x - g.camX; ay = FLOOR_Y + bossSpeak.z - 330; }
    ctx.font = `700 20px ${FONT}`;
    const tw = Math.min(460, ctx.measureText(s.text).width) + 34;
    const bx = Math.max(10, Math.min(VIEW_W - tw - 10, ax - tw / 2)), by = Math.max(110, ay - 54 - i * 8);
    ctx.save(); ctx.globalAlpha = Math.min(1, s.t * 4);
    ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(bx, by, tw, 50, 18); ctx.moveTo(ax - 10, by + 49); ctx.lineTo(ax, by + 68); ctx.lineTo(ax + 12, by + 49); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffdf2'; ctx.fillRect(ax - 9, by + 46, 20, 5);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.text, bx + tw / 2, by + 26, tw - 20);
    if (!hero) { ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#b8262a'; ctx.fillText(s.who.toUpperCase(), bx + tw / 2, by - 9); }
    ctx.restore();
  }

  // ─────────────────────────────────────── helpers
  /** draw an atlas part centred at (x, y) (or standing on y) at width w; false when the art is missing */
  sprite(atlas: string, part: string, x: number, y: number, w: number, anchor: 'center' | 'bottom' = 'center', flip = false): boolean {
    const A = KOPI_ATLAS[atlas], im = this.img(atlas), r = A?.parts[part];
    if (!A || !im || !r) return false;
    const h = w * r[3] / r[2];
    const { ctx } = this;
    if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(im, r[0], r[1], r[2], r[3], -w / 2, anchor === 'bottom' ? -h : -h / 2, w, h); ctx.restore(); }
    else ctx.drawImage(im, r[0], r[1], r[2], r[3], x - w / 2, anchor === 'bottom' ? y - h : y - h / 2, w, h);
    return true;
  }
  label(text: string, x: number, y: number, px: number, fill: string, a = 1, stroke = INK, align: CanvasTextAlign = 'center') {
    const { ctx } = this; ctx.save(); ctx.globalAlpha *= a; ctx.font = `900 ${px}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y); ctx.restore();
  }
}
