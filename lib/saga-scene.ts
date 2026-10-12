// Whisker Saga's battlefield, drawn in Canvas 2D. Drawing only: it reads the battle and never changes it.
import { ENERGY, SPAWN, heroById, type Battle, type BattleEvent, type EnemyKind, type Unit } from './saga-game';
import { drawBackdrop, drawEnemy, drawHero, drawHeroPortrait, ENEMY_HEIGHT, FACTION_COLOR, RARITY_COLOR } from './saga-art';

type Look = { x: number; y: number; lunge: number; hurt: number; hp: number; cast: number };
type Ghost = { kind: EnemyKind; x: number; y: number; t: number };
type Fx = {
  kind: 'num' | 'shot' | 'slash' | 'ring' | 'word' | 'plus' | 'rain' | 'flake' | 'star' | 'puff' | 'up';
  x: number; y: number; tx?: number; ty?: number; t: number; life: number; text?: string; color: string; size?: number; seed?: number;
};
const LANES = [0.5, 0.18, 0.82, 0.02, 0.98];
const ease = (x: number) => 1 - (1 - x) * (1 - x);

export class Field {
  /** Off when the visitor asks for reduced motion: no shake, no drifting particles, no flashes. */
  motion = true;
  clock = 0; scroll = 0; shake = 0; flash = 0; flashColor = '#fff'; banner = ''; bannerT = 0; cheer = 0;
  private looks = new Map<number, Look>(); private ghosts: Ghost[] = []; private fx: Fx[] = [];
  private w = 1; private h = 1; private chapter = 0;

  private get unit() { return Math.max(30, Math.min(180, this.h * 0.31, this.w * 0.125)); }
  private get top() { return this.h * 0.56; }
  private get bottom() { return this.h * 0.86; }
  private lane(f: number) { return this.top + (this.bottom - this.top) * f; }
  private get backX() { return Math.max(this.w * 0.14, this.unit * 1.2); }
  private get frontX() { return Math.max(this.w * 0.4, this.backX + this.unit * 1.55); }
  /** Where a hero stands, by squad slot. */
  heroAt(slot: number) {
    // Two heroes in front of three: broad, readable silhouettes instead of one overlapping column.
    const front = slot < 2;
    return { x: front ? this.frontX - (1-slot)*this.w*.14 : this.w*(.12+(slot-2)*.145), y: this.h*(front?.83:.60) };
  }
  private enemyAt(u: Unit) {
    const step = (this.w - this.frontX - this.unit * 1.2) / (SPAWN + 0.6), f = LANES[u.slot % LANES.length];
    const margin=this.unit*(u.boss?1.5:u.key==='brute'||u.key==='captain'?1:.65)+10;
    return { x: Math.min(this.w-margin,this.frontX + this.unit * 0.95 + u.d * step + (f - 0.5) * this.w * 0.04), y: this.lane(f) };
  }
  private look(u: Unit) {
    let l = this.looks.get(u.uid);
    const at = u.hero ? this.heroAt(u.slot) : this.enemyAt(u);
    if (!l) { l = { x: at.x, y: at.y, lunge: 0, hurt: 0, hp: u.hp / u.max, cast: 0 }; this.looks.set(u.uid, l); }
    l.x = at.x; l.y = at.y;
    return l;
  }
  /** The slot of the hero under a point on the canvas, for firing a skill by tapping the hero. */
  slotAt(x: number, y: number) {
    for (let slot = 0; slot < 5; slot++) { const p = this.heroAt(slot); if (Math.abs(x - p.x) < this.unit * 0.55 && y < p.y + this.unit * 0.15 && y > p.y - this.unit * 1.15) return slot; }
    return -1;
  }
  reset() { this.looks.clear(); this.ghosts = []; this.fx = []; this.shake = 0; this.flash = 0; this.banner = ''; this.bannerT = 0; this.cheer = 0; this.scroll = 0; }

  private add(f: Fx) { if (this.fx.length < 220) this.fx.push(f); }
  private word(x: number, y: number, text: string, color: string, size = 1, life = 1.1) { this.add({ kind: 'word', x, y, t: 0, life, text, color, size }); }

  /** Turn what just happened in the battle into things to see. */
  take(events: BattleEvent[], b: Battle) {
    const find = (uid: number) => b.heroes.find((u) => u.uid === uid) ?? b.enemies.find((u) => u.uid === uid);
    const u = this.unit;
    for (const e of events) {
      if (e.type === 'hit') {
        const from = find(e.from), to = find(e.to);
        if (!from || !to) continue;
        const a = this.look(from), z = this.look(to), tall = to.hero ? u : u * ENEMY_HEIGHT[to.key as EnemyKind];
        a.lunge = 1; z.hurt = 1;
        this.add({ kind: 'num', x: z.x + (Math.random() - 0.5) * u * 0.4, y: z.y - tall * 0.9, t: 0, life: 0.8, text: String(e.amount), color: e.skill ? '#ffd24a' : to.hero ? '#ff7d6e' : '#ffffff', size: e.skill ? 1.35 : 1 });
        if (e.ranged && !e.skill) this.add({ kind: 'shot', x: a.x + (from.hero ? u * 0.4 : -u * 0.3), y: a.y - u * 0.45, tx: z.x, ty: z.y - tall * 0.45, t: 0, life: 0.14, color: from.hero ? '#fff6c8' : '#d6f08a' });
        else this.add({ kind: 'slash', x: z.x, y: z.y - tall * 0.45, t: 0, life: 0.2, color: e.skill ? '#ffd24a' : '#ffffff', size: e.skill ? 1.6 : 1, seed: from.hero ? 1 : -1 });
      } else if (e.type === 'heal') {
        const to = find(e.to); if (!to) continue;
        const z = this.look(to);
        this.add({ kind: 'num', x: z.x, y: z.y - u * 1.05, t: 0, life: 0.9, text: `+${e.amount}`, color: '#8ff08a' });
        if (this.motion) for (let i = 0; i < 3; i++) this.add({ kind: 'plus', x: z.x + (i - 1) * u * 0.25, y: z.y - u * 0.4, t: -i * 0.08, life: 0.8, color: '#8ff08a' });
      } else if (e.type === 'shield') {
        const to = find(e.to); if (to) { const z = this.look(to); this.add({ kind: 'ring', x: z.x, y: z.y - u * 0.45, t: 0, life: 0.5, color: '#8fd0ff', size: u * 0.7 }); }
      } else if (e.type === 'skill') {
        const from = find(e.from); if (!from) continue;
        const a = this.look(from), tint = FACTION_COLOR[heroById(from.key).faction];
        a.cast = 1;
        this.word(a.x, a.y - u * 1.45, e.name, '#fff7d6', 1.05, 1.2);
        this.add({ kind: 'ring', x: a.x, y: a.y - u * 0.45, t: 0, life: 0.45, color: tint, size: u * 0.9 });
        if (!this.motion) continue;
        const foes = b.foes.map((f) => this.look(f));
        if (e.kind === 'volley') for (const f of foes) for (let i = 0; i < 4; i++) this.add({ kind: 'rain', x: f.x + (Math.random() - 0.5) * u, y: f.y - u * 0.3, t: -Math.random() * 0.2, life: 0.3, color: tint });
        if (e.kind === 'freeze') { this.flash = 0.35; this.flashColor = '#bfe6ff'; for (const f of foes) for (let i = 0; i < 5; i++) this.add({ kind: 'flake', x: f.x + (Math.random() - 0.5) * u, y: f.y - Math.random() * u, t: 0, life: 0.9, color: '#e8f7ff', seed: Math.random() * 6 }); }
        if (e.kind === 'rally') for (const hh of b.alive) { const z = this.look(hh); for (let i = 0; i < 3; i++) this.add({ kind: 'up', x: z.x + (i - 1) * u * 0.22, y: z.y - u * 0.2, t: -i * 0.07, life: 0.7, color: '#ffb04a' }); }
      } else if (e.type === 'windup') {
        const from = find(e.from); if (from) { const a = this.look(from); this.word(a.x, a.y - u * ENEMY_HEIGHT[from.key as EnemyKind] - u * 0.5, e.kind === 'slam' ? 'Winding up!' : 'Healing…', e.kind === 'slam' ? '#ff8a6e' : '#b8f0a8', 1, 1.4); }
      } else if (e.type === 'interrupt') {
        const from = find(e.from); if (!from) continue;
        const a = this.look(from), y = a.y - u * ENEMY_HEIGHT[from.key as EnemyKind] * 0.6;
        this.word(a.x, y - u * 0.7, 'Interrupted!', '#ffe46b', 1.45, 1.3);
        this.shake = Math.max(this.shake, 0.25);
        if (this.motion) for (let i = 0; i < 10; i++) this.add({ kind: 'star', x: a.x, y, t: 0, life: 0.6, color: '#ffe46b', seed: i });
      } else if (e.type === 'slam') {
        const from = find(e.from); if (!from) continue;
        const a = this.look(from);
        this.shake = 0.6; this.flash = 0.4; this.flashColor = '#ff6a50';
        this.add({ kind: 'ring', x: a.x, y: a.y - u * 0.2, t: 0, life: 0.55, color: '#ff8a6e', size: this.w * 0.7 });
      } else if (e.type === 'call') {
        const from = find(e.from); if (from) { const a = this.look(from); this.word(a.x, a.y - u * 2.6, 'Calls for help!', '#ffd9a8', 1.1, 1.4); }
      } else if (e.type === 'die') {
        const who = find(e.uid); if (!who) continue;
        const a = this.look(who);
        if (!who.hero) { this.ghosts.push({ kind: who.key as EnemyKind, x: a.x, y: a.y, t: 0 }); this.looks.delete(who.uid); }
        if (this.motion) for (let i = 0; i < 7; i++) this.add({ kind: 'puff', x: a.x, y: a.y - u * 0.35, t: 0, life: 0.5, color: who.hero ? '#ffffff' : '#e9e2d2', seed: i });
      } else if (e.type === 'wave') {
        this.banner = e.wave === b.def.waves.length - 1 ? (b.def.boss ? 'Boss!' : 'Last wave') : `Wave ${e.wave + 1} of ${b.def.waves.length}`; this.bannerT = 1.6;
      } else if (e.type === 'won') { this.cheer = 1; this.banner = ''; }
    }
  }

  /** What the scene is showing, for the browser tests. */
  inspect(b: Battle) {
    return {
      heroes: b.heroes.map((u) => ({ slot: u.slot, ...this.heroAt(u.slot) })), enemies: b.foes.map((u) => ({ uid: u.uid, ...this.enemyAt(u) })),
      fx: this.fx.length, ghosts: this.ghosts.length, shake: this.shake, flash: this.flash, banner: this.bannerT > 0 ? this.banner : '', scroll: this.scroll, cheer: this.cheer, unit: this.unit,
    };
  }

  draw(c: CanvasRenderingContext2D, w: number, h: number, dpr: number, b: Battle, dt: number) {
    this.w = w; this.h = h; this.chapter = b.def.chapter;
    this.clock += dt;
    const t = this.clock, u = this.unit, marching = b.phase === 'march';
    if (marching && this.motion) this.scroll += dt * w * 0.3;
    this.shake = Math.max(0, this.shake - dt * 1.6); this.flash = Math.max(0, this.flash - dt * 1.4); this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.cheer) this.cheer += dt;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.save();
    if (this.motion && this.shake > 0) c.translate(Math.sin(t * 61) * this.shake * 9, Math.cos(t * 53) * this.shake * 6);
    drawBackdrop(c, this.chapter, w, h, this.scroll, t, h * 0.46);

    // A slam on its way: the ground under the squad reddens as the wind-up fills.
    const winding = b.winding;
    if (winding?.special?.kind === 'slam') {
      const p = 1 - winding.wind / winding.special.wind;
      c.fillStyle = `rgba(255,70,50,${0.1 + p * 0.3})`; c.beginPath(); c.roundRect(w * 0.04, this.top - u * 0.1, this.frontX + u * 0.5 - w * 0.04, this.bottom - this.top + u * 0.22, 16); c.fill();
      c.strokeStyle = `rgba(255,220,200,${0.5 + p * 0.5})`; c.lineWidth = 2; c.setLineDash([8, 6]); c.lineDashOffset = -t * 30; c.stroke(); c.setLineDash([]);
    }

    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const g of this.ghosts) {
      g.t += dt;
      items.push({ y: g.y, draw: () => { c.save(); c.globalAlpha = Math.max(0, 1 - g.t / 0.45); c.translate(g.x, g.y); c.scale(1 + g.t * 0.5, Math.max(0.05, 1 - g.t * 1.8)); drawEnemy(c, g.kind, this.chapter, 0, 0, u * 0.82, t); c.restore(); } });
    }
    this.ghosts = this.ghosts.filter((g) => g.t < 0.45);
    for (const hero of b.heroes) {
      const l = this.look(hero); this.settle(l, hero, dt);
      items.push({ y: l.y, draw: () => this.hero(c, hero, l, b, t, marching) });
    }
    for (const foe of b.foes) {
      const l = this.look(foe); this.settle(l, foe, dt);
      items.push({ y: l.y, draw: () => this.enemy(c, foe, l, t) });
    }
    items.sort((a, z) => a.y - z.y);
    for (const it of items) it.draw();
    this.effects(c, dt, u);
    c.restore();

    if (this.flash > 0 && this.motion) { c.fillStyle = this.flashColor; c.globalAlpha = this.flash * 0.45; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
    if (this.bannerT > 0) {
      const a = Math.min(1, this.bannerT * 3, (1.6 - this.bannerT) * 5 + 0.2), size = Math.max(20, Math.min(46, w * 0.06)), at = Math.max(h * 0.22, 60 + size * 0.6);
      c.save(); c.globalAlpha = a; c.font = `900 ${size}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = size * 0.22; c.strokeStyle = 'rgba(30,22,44,.85)'; c.lineJoin = 'round'; c.strokeText(this.banner, w / 2, at);
      c.fillStyle = this.banner === 'Boss!' ? '#ff8a6e' : '#fff7d6'; c.fillText(this.banner, w / 2, at); c.restore();
    }
  }

  private settle(l: Look, u: Unit, dt: number) {
    l.lunge = Math.max(0, l.lunge - dt * 5); l.hurt = Math.max(0, l.hurt - dt * 4); l.cast = Math.max(0, l.cast - dt * 1.6);
    const hp = u.hp / u.max;
    l.hp += (hp - l.hp) * Math.min(1, dt * 9);
  }

  private bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, f: number, color: string, back = 'rgba(30,22,44,.75)') {
    c.fillStyle = back; c.beginPath(); c.roundRect(x - w / 2 - 1, y - 1, w + 2, hgt + 2, hgt / 2 + 1); c.fill();
    if (f > 0) { c.fillStyle = color; c.beginPath(); c.roundRect(x - w / 2, y, Math.max(hgt, w * Math.min(1, f)), hgt, hgt / 2); c.fill(); }
  }

  private hero(c: CanvasRenderingContext2D, hero: Unit, l: Look, b: Battle, t: number, marching: boolean) {
    const u = this.unit, ready = b.ready(hero.slot), hop = this.cheer && !hero.dead ? Math.abs(Math.sin(this.cheer * 7 + hero.slot)) * u * 0.18 : 0;
    const x = l.x + (this.motion ? ease(l.lunge) * u * 0.16 - l.hurt * u * 0.06 : 0), y = l.y - (this.motion ? hop : 0);
    c.save();
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(l.x, l.y, u * 0.36, u * 0.07, 0, 0, Math.PI * 2); c.fill();
    if (ready) {
      const pulse = this.motion ? 0.5 + Math.sin(t * 7) * 0.5 : 1;
      c.strokeStyle = `rgba(255,214,74,${0.55 + pulse * 0.45})`; c.lineWidth = 3; c.beginPath(); c.ellipse(l.x, l.y, u * (0.44 + pulse * 0.05), u * (0.1 + pulse * 0.015), 0, 0, Math.PI * 2); c.stroke();
    }
    if (hero.dead) c.globalAlpha = 0.4;
    drawHero(c, hero.key, x, y, u, t + hero.slot, { moving: marching && !hero.dead && this.motion, run: t * 22, swing: Math.max(l.lunge, l.cast), glow: hero.energy / ENERGY, dizzy: hero.dead, motion: this.motion });
    c.globalAlpha = 1;
    if (hero.shield > 0 && !hero.dead) { c.strokeStyle = 'rgba(143,208,255,.9)'; c.fillStyle = 'rgba(143,208,255,.18)'; c.lineWidth = 2; c.beginPath(); c.ellipse(l.x + u * 0.04, y - u * 0.45, u * 0.5, u * 0.56, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
    if (hero.haste > 0 && !hero.dead) { c.fillStyle = '#ffb04a'; c.font = `900 ${u * 0.22}px system-ui, sans-serif`; c.textAlign = 'center'; c.fillText('»', l.x - u * 0.42, y - u * 0.5); }
    if (!hero.dead) {
      const top = l.y - u * 1.16, bw = u * 0.78;
      this.bar(c, l.x, top, bw, 5, l.hp, l.hp > 0.5 ? '#6fdc6a' : l.hp > 0.25 ? '#f0c040' : '#f0604a');
      if (hero.shield > 0) this.bar(c, l.x, top - 5, bw, 3, hero.shield / hero.max * 3, '#8fd0ff');
      this.bar(c, l.x, top + 8, bw, 3, hero.energy / ENERGY, ready ? '#ffd64a' : '#c9a23a');
    }
    c.restore();
  }

  private enemy(c: CanvasRenderingContext2D, foe: Unit, l: Look, t: number) {
    const u = this.unit, kind = foe.key as EnemyKind, tall = u * ENEMY_HEIGHT[kind], size = u * 0.82;
    const wind = foe.wind > 0 && foe.special ? 1 - foe.wind / foe.special.wind : 0, moving = foe.d > foe.reach && foe.stun <= 0;
    const x = l.x - (this.motion ? ease(l.lunge) * u * 0.16 - l.hurt * u * 0.07 : 0);
    c.save();
    if (foe.exposed > 0) { c.shadowColor = '#ffe46b'; c.shadowBlur = 14; }
    drawEnemy(c, kind, this.chapter, x, l.y, size, t + foe.uid, { wind, step: moving && this.motion ? t * 6 + foe.uid : 0, motion: this.motion });
    c.shadowBlur = 0;
    const top = l.y - tall - 12, bw = foe.boss ? u * 1.5 : kind === 'captain' || kind === 'brute' ? u * 0.95 : u * 0.66;
    if(!foe.boss)this.bar(c, l.x, top, bw, 5, l.hp, '#f0604a');
    if (foe.wind > 0 && foe.special) {
      const slam = foe.special.kind === 'slam';
      if(!foe.boss)this.bar(c, l.x, top - 10, bw, 6, wind, slam ? '#ffb04a' : '#8ff08a');
      if(!foe.boss){c.font = `900 ${u * 0.3}px system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(30,22,44,.9)'; c.fillStyle = slam ? '#ff8a6e' : '#b8f0a8';
      const bounce = this.motion ? Math.abs(Math.sin(t * 9)) * 4 : 0;
      c.strokeText('!', l.x + bw / 2 + 10, top - 2 - bounce); c.fillText('!', l.x + bw / 2 + 10, top - 2 - bounce);}
    }
    if (foe.stun > 0) {
      c.fillStyle = '#ffe46b'; c.strokeStyle = 'rgba(30,22,44,.8)'; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) { const a = (this.motion ? t * 5 : 0) + i * 2.094, sx = l.x + Math.cos(a) * u * 0.26, sy = top - 12 + Math.sin(a) * u * 0.07; this.star(c, sx, sy, u * 0.07); }
    }
    c.restore();
  }

  private star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
    c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    c.closePath(); c.fill(); c.stroke();
  }

  private effects(c: CanvasRenderingContext2D, dt: number, u: number) {
    for (const f of this.fx) {
      f.t += dt;
      if (f.t < 0) continue;
      const p = Math.min(1, f.t / f.life), fade = 1 - p * p;
      c.save(); c.globalAlpha = Math.max(0, fade);
      if (f.kind === 'num' || f.kind === 'word') {
        const size = (f.kind === 'num' ? u * 0.26 : u * 0.24) * (f.size ?? 1) * (f.kind === 'word' && this.motion ? 1 + Math.max(0, 0.25 - f.t) * 1.6 : 1);
        c.font = `900 ${Math.max(11, size)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const y = f.y - (this.motion ? ease(p) * u * 0.45 : 0), x = Math.max(size * 2.2, Math.min(this.w - size * 2.2, f.x));
        c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = 'rgba(30,22,44,.9)'; c.lineJoin = 'round'; c.strokeText(f.text!, x, y); c.fillStyle = f.color; c.fillText(f.text!, x, y);
      } else if (f.kind === 'shot') {
        const x = f.x + (f.tx! - f.x) * p, y = f.y + (f.ty! - f.y) * p - Math.sin(p * Math.PI) * u * 0.15;
        c.globalAlpha = 1; c.fillStyle = f.color; c.strokeStyle = 'rgba(30,22,44,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, u * 0.06, 0, Math.PI * 2); c.fill(); c.stroke();
      } else if (f.kind === 'slash') {
        const r = u * 0.34 * (f.size ?? 1), dir = f.seed ?? 1;
        c.strokeStyle = f.color; c.lineWidth = u * 0.07 * (1 - p); c.lineCap = 'round'; c.beginPath(); c.arc(f.x - dir * r * 0.4, f.y, r, dir > 0 ? -1 + p : Math.PI - 1 + p, dir > 0 ? 0.4 + p : Math.PI + 0.4 + p); c.stroke();
      } else if (f.kind === 'ring') {
        c.strokeStyle = f.color; c.lineWidth = 4 * (1 - p) + 1; c.beginPath(); c.ellipse(f.x, f.y, (f.size ?? u) * ease(p), (f.size ?? u) * ease(p) * 0.55, 0, 0, Math.PI * 2); c.stroke();
      } else if (f.kind === 'plus' || f.kind === 'up') {
        const y = f.y - ease(p) * u * 0.7, s = u * 0.08;
        c.fillStyle = f.color; c.strokeStyle = 'rgba(30,22,44,.6)'; c.lineWidth = 1;
        if (f.kind === 'plus') { c.fillRect(f.x - s, y - s / 3, s * 2, s / 1.5); c.fillRect(f.x - s / 3, y - s, s / 1.5, s * 2); }
        else { c.beginPath(); c.moveTo(f.x, y - s * 1.3); c.lineTo(f.x + s, y); c.lineTo(f.x - s, y); c.closePath(); c.fill(); c.stroke(); }
      } else if (f.kind === 'rain') {
        const y = f.y - u * 1.4 * (1 - p);
        c.strokeStyle = f.color; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(f.x + u * 0.12, y - u * 0.3); c.lineTo(f.x, y); c.stroke();
      } else if (f.kind === 'flake') {
        c.fillStyle = f.color; c.beginPath(); c.arc(f.x + Math.sin(f.t * 5 + (f.seed ?? 0)) * 6, f.y + p * u * 0.3, u * 0.035, 0, Math.PI * 2); c.fill();
      } else if (f.kind === 'star' || f.kind === 'puff') {
        const a = (f.seed ?? 0) * (Math.PI * 2 / (f.kind === 'star' ? 10 : 7)), d = ease(p) * u * (f.kind === 'star' ? 0.9 : 0.5);
        c.fillStyle = f.color; c.strokeStyle = 'rgba(30,22,44,.5)'; c.lineWidth = 1;
        if (f.kind === 'star') this.star(c, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.7, u * 0.08 * (1 - p * 0.5));
        else { c.beginPath(); c.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d * 0.6, u * 0.1 * (1 - p * 0.6), 0, Math.PI * 2); c.fill(); }
      }
      c.restore();
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
  }
}

/** A hero's portrait for the roster, the squad slots and the skill buttons. */
export function portrait(c: CanvasRenderingContext2D, id: string, size: number, known = true, card = false) {
  const hero = heroById(id);
  c.clearRect(0, 0, size, size);
  if(known && card && drawHeroPortrait(c,id,size))return;
  c.save();
  c.beginPath(); c.roundRect(0, 0, size, size, size * 0.2); c.clip();
  const g = c.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, known ? '#daceaa' : '#4a4460'); g.addColorStop(1, known ? '#536044' : '#2c2840');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  if (!known || !drawHeroPortrait(c,id,size)) drawHero(c, id, size * 0.43, size * 0.97, size * 0.92, 0.6, { silhouette: !known });
  c.restore();
  if (known) { c.strokeStyle = RARITY_COLOR[hero.rarity]; c.lineWidth = Math.max(1, size * 0.012); c.beginPath(); c.roundRect(c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth, size * 0.18); c.stroke(); }
}
