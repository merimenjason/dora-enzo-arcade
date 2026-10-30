'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  newRun, choices, go, place, takeBack, reroll, endTurn, fits, moves, setTarget, takeReward, takeCharm, stallBuy, stallUpgrade,
  stallRemove, stallPie, leave, picnic, pickTool, tentChoose, readSave, freshSave, recordRun, poolFor, leadOpen, fogOpen, hashSeed,
  hitOf, toolRoom, SAVE_KEY, ROWS, type Run, type Ev, type Save, type Battle,
} from '@/lib/pips-game';
import { TOOL, LEADS, FOES, AREAS, CHARM, TENT, FOGGIER, needOf, usesOf, slotsOf, type LeadId } from '@/lib/pips-tools';
import type { PipsScene, StageView } from '@/lib/pips-scene';
import { PipsSound, type SongId } from './sound';
import { Glyph, DieFace } from './glyphs';
import './pips.css';

type View = 'menu' | 'run' | 'help';
type Pending = { kind: 'reward' | 'stall'; i: number } | null;
const sceneModule = () => import('@/lib/pips-scene');
const NODE_LABEL: Record<string, string> = { battle: 'Battle', elite: 'Grand foe', stall: 'Trading stall', picnic: 'Picnic', tent: 'Mystery tent', boss: 'Boss' };
const NODE_GLYPH: Record<string, string> = { battle: 'sling', elite: 'hat', stall: 'piggy', picnic: 'basket', tent: 'kite', boss: 'firework' };
const DIE_PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
/** A stable little wobble for each die so the tumble is the same every time it is drawn. */
const jig = (id: number, k: number) => { const x = Math.sin(id * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

function fromRun(run: Run): StageView {
  const b = run.battle;
  return {
    area: run.area, lead: run.lead, target: b?.target ?? 0, won: run.screen === 'won' || b?.done === 'won', lost: run.screen === 'lost',
    you: { hp: run.hp, max: run.max, block: b?.block ?? 0, poison: b?.poison ?? 0, burn: b?.burn ?? 0, frost: b?.frost ?? 0, thorns: b?.thorns ?? 0 },
    foes: (b?.foes ?? []).map(f => ({
      def: f.def, art: FOES[f.def].art, name: f.name, hp: f.hp, max: f.max, block: f.block, poison: f.poison, burn: f.burn, stun: f.stun,
      intent: f.intent, hit: hitOf(f), elite: f.elite, boss: !!FOES[f.def].boss, minion: !!FOES[f.def].minion, down: f.hp <= 0,
    })),
  };
}
function Die({ v, curse, sel, id, onDown, roll }: { v: number; curse?: boolean; sel?: boolean; id: number; onDown?: (e: RPointerEvent<HTMLButtonElement>) => void; roll?: boolean }) {
  const style = roll ? ({ '--dx': `${Math.round(-140 - jig(id, 1) * 160)}px`, '--dy': `${Math.round(-60 + jig(id, 2) * 120)}px`, '--r': `${Math.round(360 + jig(id, 3) * 540)}deg`, animationDelay: `${Math.round(jig(id, 4) * 120)}ms` } as React.CSSProperties) : undefined;
  return (
    <button type="button" className={'lp-die' + (sel ? ' is-sel' : '') + (curse ? ' is-curse' : '') + (roll ? ' is-roll' : '')} data-die={id} data-v={v} style={style}
      aria-label={`Die showing ${v}${curse ? ', stuck in toffee' : ''}`} onPointerDown={onDown}>
      <span className="lp-pips">{Array.from({ length: 9 }, (_, i) => <i key={i} className={DIE_PIPS[v]?.includes(i) ? 'on' : ''} />)}</span>
    </button>
  );
}
/** A painting with a drawn stand-in underneath, which shows until (or unless) the painting loads. */
function Art({ src, paint, className }: { src: string; paint: 'title' | 'ending'; className?: string }) {
  const cv = useRef<HTMLCanvasElement>(null), [got, setGot] = useState(false), [hide, setHide] = useState(false), im = useRef<HTMLImageElement>(null);
  useEffect(() => { const i = im.current; if (i && i.complete) { if (i.naturalWidth > 0) setGot(true); else setHide(true); } }, [src]);
  useEffect(() => { let dead = false; sceneModule().then(m => { if (!dead && cv.current) (paint === 'title' ? m.paintTitle : m.paintEnding)(cv.current); }).catch(() => {}); return () => { dead = true; }; }, [paint]);
  return (
    <span className={'lp-art ' + (className ?? '')}>
      <canvas ref={cv} width={768} height={512} aria-hidden="true" style={got ? { visibility: 'hidden' } : undefined} />
      {!hide && <img ref={im} src={src} alt="" onLoad={() => setGot(true)} onError={() => setHide(true)} />}
    </span>
  );
}

export default function LuckyPips() {
  const save = useRef<Save>(freshSave());
  const [, setTick] = useState(0);
  const rerender = () => setTick(t => t + 1);
  const [view, setView] = useState<View>('menu');
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState('');
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Run['screen']>('map');   // what the run panel shows (lags the engine while events play)
  const [sel, setSel] = useState<number | null>(null);         // the selected die
  const [hover, setHover] = useState<number | null>(null);     // the tool under a dragged die
  const [rolling, setRolling] = useState<Set<number>>(new Set());
  const [trayHidden, setTrayHidden] = useState(false);
  const [pending, setPending] = useState<Pending>(null);       // a tool waiting for a swap or a choice of tool
  const [stallMode, setStallMode] = useState<'' | 'up' | 'rm'>('');
  const [news, setNews] = useState<string[]>([]);
  const [tip, setTip] = useState(0);
  const [mapSel, setMapSel] = useState(0);
  const [touch, setTouch] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), stageEl = useRef<HTMLDivElement>(null);
  const scene = useRef<PipsScene | null>(null), stage = useRef<StageView | null>(null);
  const sound = useRef<PipsSound | null>(null);
  const timers = useRef<number[]>([]);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; el: HTMLElement | null } | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const run = save.current.run;

  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } };
  const sfx = () => { const s = sound.current; if (s) s.unlock(); return s; };

  // ---------- events, played out one after another ----------
  const DUR: Partial<Record<Ev['t'], number>> = { hit: 300, act: 380, block: 160, heal: 200, status: 200, roll: 520, summon: 420, down: 380, win: 900, lose: 1100, fire: 120, dice: 60, acorns: 80 };
  function play(evs: Ev[], before: StageView, after: () => void) {
    const sv: StageView = JSON.parse(JSON.stringify(before));
    stage.current = sv;
    let t = 0;
    const fast = evs.every(e => e.t !== 'act');
    busyRef.current = true; setBusy(true);
    for (const e of evs) {
      const at = t;
      timers.current.push(window.setTimeout(() => show(e, sv), at));
      t += (DUR[e.t] ?? 100) * (fast && e.t === 'hit' ? 0.7 : 1);
    }
    timers.current.push(window.setTimeout(() => {
      busyRef.current = false; setBusy(false);
      const r = save.current.run;
      if (r) { stage.current = fromRun(r); if (r.battle?.done !== 'won' || r.screen !== 'battle') setShown(r.screen); }
      after(); rerender();
    }, t + 40));
  }
  function show(e: Ev, sv: StageView) {
    const sc = scene.current, s = sound.current, r = save.current.run;
    switch (e.t) {
      case 'hit':
        if (e.to === 'you') { sv.you.hp = Math.max(0, sv.you.hp - e.n); sv.you.block = Math.max(0, sv.you.block - e.blocked); if (e.n > 0) { sc?.hitYou(e.n); s?.hurt(e.n); } else { sc?.popYou('blocked', '#a8d8ff'); s?.blocked(); } }
        else { const f = sv.foes[e.to]; if (f) { f.hp = Math.max(0, f.hp - e.n); f.block = Math.max(0, f.block - e.blocked); } if (e.n > 0) { sc?.hitFoe(e.to, e.n); s?.hit(e.n); } else { sc?.popFoe(e.to, 'blocked', '#a8d8ff'); s?.blocked(); } if (e.tick === 'poison') s?.poison(); if (e.tick === 'burn') s?.burn(); }
        break;
      case 'block': if (e.to === 'you') { sv.you.block += e.n; sc?.popYou(`+${e.n}`, '#9ccaff'); } else { const f = sv.foes[e.to]; if (f) f.block += e.n; sc?.popFoe(e.to, `+${e.n}`, '#9ccaff'); } s?.block(); break;
      case 'heal': if (e.to === 'you') { sv.you.hp = Math.min(sv.you.max, sv.you.hp + e.n); if (e.n > 0) { sc?.popYou(`+${e.n}`, '#8ef0a0'); s?.heal(); } } else { const f = sv.foes[e.to]; if (f) f.hp = Math.min(f.max, f.hp + e.n); sc?.popFoe(e.to, `+${e.n}`, '#8ef0a0'); s?.heal(); } break;
      case 'status': {
        const word: Record<string, string> = { poison: 'poison', burn: 'burn', frost: 'frost', stun: 'stunned!', curse: 'sticky dice', lock: 'ring toss!', buff: 'stronger', thorns: 'prickly', cleanse: 'all clean', stunned: 'zzz…' };
        const col = e.s === 'poison' ? '#d4a8ff' : e.s === 'burn' ? '#ffb070' : e.s === 'frost' ? '#a8e4ff' : '#ffe58a';
        const txt = (e.n > 0 && !['stun', 'lock', 'cleanse', 'stunned'].includes(e.s) ? `+${e.n} ` : '') + word[e.s];
        if (e.to === 'you') { sc?.popYou(txt, col); if (e.s === 'poison') sv.you.poison += e.n; if (e.s === 'burn') sv.you.burn += e.n; if (e.s === 'frost') sv.you.frost += e.n; if (e.s === 'thorns') sv.you.thorns += e.n; }
        else { sc?.popFoe(e.to, txt, col); const f = sv.foes[e.to]; if (f) { if (e.s === 'poison') f.poison += e.n; if (e.s === 'burn') f.burn += e.n; if (e.s === 'stun') f.stun = 1; if (e.s === 'stunned') f.stun = 0; } }
        if (e.s === 'stun') s?.stun(); else if (e.s === 'poison') s?.poison(); else if (e.s === 'burn') s?.burn(); else if (e.s === 'curse' || e.s === 'lock') s?.curse(); else s?.block();
        break;
      }
      case 'fire': if (e.tool >= 0) { const t = r?.tools[e.tool]; const fx = t && TOOL[t.id].fx([3, 3, 3], t.up); if (fx && (fx.dmg || fx.dmgAll)) sc?.attack(); s?.fire(); flashTool(e.tool); } else s?.thunk(true); break;
      case 'act': {
        sc?.act(e.i); s?.foe();
        const f = sv.foes[e.i], live = r?.battle?.foes[e.i];
        if (f) { f.block = 0; if (live) { f.intent = live.intent; f.hit = hitOf(live); } }
        break;
      }
      case 'summon': if (r?.battle) { const real = fromRun(r); const f = real.foes[e.i]; if (f) { sv.foes[e.i] = f; } } s?.curse(); break;
      case 'down': { const f = sv.foes[e.i]; if (f) { f.down = true; f.hp = 0; } s?.down(); break; }
      case 'roll': if (r?.battle) { setTrayHidden(false); const b = r.battle; setRolling(new Set(b.dice.map(d => d.id))); s?.clatter(b.dice.length); const real = fromRun(r); sv.foes.forEach((f, i) => { const x = real.foes[i]; if (x) { f.intent = x.intent; f.hit = x.hit; f.stun = x.stun; } }); sv.you.block = real.you.block; sv.you.frost = real.you.frost; rerender(); } break;
      case 'dice': setRolling(new Set(e.ids)); s?.clatter(e.ids.length); rerender(); break;
      case 'acorns': s?.acorns(); break;
      case 'win': sc?.cheer(); sv.won = true; s?.win(); break;
      case 'lose': s?.lose(); break;
    }
  }
  const [flash, setFlash] = useState<number>(-1);
  const flashTool = (ti: number) => { setFlash(ti); timers.current.push(window.setTimeout(() => setFlash(-1), 380)); };

  /** Do something to the run, then play out what happened. */
  function act(fn: (r: Run) => Ev[] | boolean | void, after?: () => void) {
    const r = save.current.run; if (!r || busyRef.current) return;
    sfx();
    const had = !!r.battle;
    let before = fromRun(r);
    const out = fn(r);
    // a battle that has just begun starts from its own first look, not the map's
    if (!had && r.battle) before = { ...fromRun(r), you: { ...fromRun(r).you, block: 0 } };
    const evs = Array.isArray(out) ? out : [];
    if (r.screen === 'won' || r.screen === 'lost') finishRun(r);
    persist();
    if (evs.length) play(evs, before, () => { after?.(); arrive(); });
    else { stage.current = fromRun(r); setShown(r.screen); after?.(); arrive(); rerender(); }
  }
  /** Whenever the run lands somewhere new: music and the stage. */
  function arrive() {
    const r = save.current.run; if (!r) return;
    const s = sound.current;
    const song: SongId = r.screen === 'won' ? 'ending' : r.battle?.kind === 'boss' && r.screen === 'battle' ? 'boss' : (['meadow', 'midway', 'bigtop'] as SongId[])[r.area];
    s?.music(song);
    if (r.screen !== 'battle') scene.current?.ready();
  }
  function finishRun(r: Run) {
    if ((r as Run & { recorded?: boolean }).recorded) return;
    (r as Run & { recorded?: boolean }).recorded = true;
    const n = recordRun(save.current.meta, r);
    setNews(n);
  }

  // ---------- starting and leaving runs ----------
  function startRun(daily = false) {
    sfx()?.ui();
    const m = save.current.meta;
    let seed: number, lead = save.current.lead, fog = save.current.fog;
    if (daily) { seed = hashSeed('lucky-pips:' + today); lead = (['dora', 'enzo', 'both'] as LeadId[])[seed % 3]; fog = 0; }
    else seed = (Date.now() ^ (performance.now() * 1000)) >>> 0;
    if (!leadOpen(m, lead) && !daily) lead = 'dora';
    const r = newRun({ seed, lead, fog: daily ? 0 : Math.min(fog, fogOpen(m)), daily: daily ? today : '', pool: daily ? poolFor({ ...m, meadow: true, midway: true, won: true, foggy: true }) : poolFor(m) });
    save.current.run = r; persist();
    setNews([]); setShown('map'); setView('run'); setMapSel(0); stage.current = fromRun(r); arrive(); rerender();
  }
  function quitToMenu() { sfx()?.ui(); timers.current.forEach(clearTimeout); timers.current = []; busyRef.current = false; setBusy(false); setView('menu'); sound.current?.music('menu'); rerender(); }
  function abandon() {
    const r = save.current.run; if (!r) return;
    if (r.screen !== 'won' && r.screen !== 'lost') { r.screen = 'lost'; finishRun(r); }
    save.current.run = null; persist(); quitToMenu();
  }
  function closeRun() { save.current.run = null; persist(); quitToMenu(); }

  // ---------- battle input ----------
  const b: Battle | null = run?.battle ?? null;
  const inBattle = view === 'run' && !!run && (shown === 'battle' || busy) && !!b;
  function placeDie(id: number, ti: number) {
    const r = save.current.run; if (!r || busyRef.current) return;
    if (!fits(r, id, ti)) { sound.current?.thunk(false); return; }
    setSel(null);
    if (!save.current.taught && tip === 0) setTip(1);
    act(rr => place(rr, id, ti));
  }
  function doEnd() {
    const r = save.current.run; if (!r || busyRef.current || r.screen !== 'battle') return;
    setSel(null); setTrayHidden(true);
    if (!save.current.taught && tip >= 1) { save.current.taught = true; setTip(3); }
    act(rr => endTurn(rr));
  }
  function doReroll(id: number | null) {
    const r = save.current.run; if (!r || id == null || busyRef.current) return;
    act(rr => reroll(rr, id));
  }
  function onDieDown(e: RPointerEvent<HTMLButtonElement>, id: number) {
    if (busyRef.current) return;
    sfx()?.pick();
    if (e.pointerType === 'touch') setTouch(true);
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false, el: e.currentTarget };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7) { d.moved = true; setSel(d.id); }
      if (!d.moved) return;
      const g = ghost.current;
      if (g) { g.style.display = 'block'; g.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px) rotate(${(e.clientX - d.x) * 0.05}deg)`; }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ti],[data-reroll]') as HTMLElement | null;
      setHover(el?.dataset.ti != null ? Number(el.dataset.ti) : el?.dataset.reroll != null ? -2 : null);
    };
    const up = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      drag.current = null;
      if (ghost.current) ghost.current.style.display = 'none';
      setHover(null);
      if (!d.moved) { setSel(s => (s === d.id ? null : d.id)); return; }
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ti],[data-reroll]') as HTMLElement | null;
      if (el?.dataset.ti != null) placeDie(d.id, Number(el.dataset.ti));
      else if (el?.dataset.reroll != null) doReroll(d.id);
      else { setSel(null); sound.current?.thunk(false); }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });
  function clickTool(ti: number) {
    const r = save.current.run; if (!r || busyRef.current) return;
    if (sel != null) { placeDie(sel, ti); return; }
    // with no die chosen, a tool with dice waiting gives them back
    if (r.battle?.slots[ti]?.pend.length) act(rr => takeBack(rr, ti));
  }
  function clickStage(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = save.current.run, sc = scene.current; if (!r?.battle || !sc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = sc.foeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (i >= 0) { setTarget(r, i); sound.current?.ui(); stage.current = { ...(stage.current ?? fromRun(r)), target: i }; persist(); rerender(); }
  }

  // ---------- keys ----------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      sfx();
      const r = save.current.run;
      if (view === 'run' && r && !busyRef.current) {
        if (shown === 'battle' && r.battle) {
          const dice = r.battle.dice, idx = dice.findIndex(d => d.id === sel);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); if (dice.length) { const n = idx < 0 ? (e.key === 'ArrowRight' ? 0 : dice.length - 1) : (idx + (e.key === 'ArrowRight' ? 1 : dice.length - 1)) % dice.length; setSel(dice[n].id); sound.current?.pick(); } return; }
          if (/^[1-7]$/.test(e.key)) { const ti = Number(e.key) - 1; if (sel != null) placeDie(sel, ti); else clickTool(ti); return; }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const alive = r.battle.foes.map((f, i) => (f.hp > 0 ? i : -1)).filter(i => i >= 0); if (alive.length > 1) { const k = alive.indexOf(r.battle.target); setTarget(r, alive[(k + (e.key === 'ArrowDown' ? 1 : alive.length - 1)) % alive.length]); stage.current = { ...(stage.current ?? fromRun(r)), target: r.battle.target }; rerender(); } return; }
          if (e.key === 'r' || e.key === 'R') { doReroll(sel); return; }
          if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); doEnd(); return; }
          if (e.key === 'Escape') { setSel(null); return; }
        }
        if (shown === 'map') {
          const c = choices(r);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setMapSel(m => (m + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : c.length - 1)) % Math.max(1, c.length)); sound.current?.walk(); return; }
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const id = c[Math.min(mapSel, c.length - 1)]; if (id != null) walk(id); return; }
        }
      }
      if (e.key === 'Escape' && view === 'help') setView(save.current.run && save.current.run.screen !== 'won' && save.current.run.screen !== 'lost' ? 'run' : 'menu');
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  function walk(id: number) {
    sound.current?.walk();
    setMapSel(0); setTrayHidden(true);
    act(r => go(r, id));
  }

  // ---------- mount: the save, the scene, the loop ----------
  useEffect(() => {
    save.current = readSave((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    const s = save.current;
    sound.current = new PipsSound(s.sound, s.music);
    sound.current.music('menu');
    { const d = new Date(); setToday(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }
    setTouch(matchMedia('(pointer: coarse)').matches);
    if (s.run && s.run.screen !== 'won' && s.run.screen !== 'lost') { stage.current = fromRun(s.run); setShown(s.run.screen); }
    else if (s.run) { s.run = null; persist(); }
    setMounted(true);
    const w = window as unknown as Record<string, unknown>;
    w.__pips = () => ({ view: viewRef.current, shown: shownRef.current, busy: busyRef.current, run: save.current.run, save: save.current, scene: scene.current?.metrics() ?? null, sel: selRef.current });
    w.__pipsDebug = (fn: (r: Run, s: Save) => void) => { const r = save.current.run; if (r) { fn(r, save.current); persist(); stage.current = fromRun(r); setShown(r.screen); setTrayHidden(false); rerender(); } };
    w.__pipsStart = (seed: number, lead: LeadId = 'dora', fog = 0) => { const r = newRun({ seed, lead, fog, pool: poolFor(save.current.meta) }); save.current.run = r; persist(); setShown('map'); setView('run'); stage.current = fromRun(r); rerender(); };
    const vis = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); timers.current.forEach(clearTimeout); sound.current?.dispose(); };
  }, []);
  const viewRef = useRef(view); viewRef.current = view;
  const shownRef = useRef(shown); shownRef.current = shown;
  const selRef = useRef(sel); selRef.current = sel;

  // the stage canvas lives while a run is on screen
  const showStage = view === 'run' && !!run && (shown === 'battle' || shown === 'reward' || shown === 'charm' || busy);
  useEffect(() => {
    if (!showStage) return;
    let dead = false, raf = 0, last = performance.now();
    sceneModule().then(m => {
      if (dead || !canvas.current) return;
      const sc = new m.PipsScene(canvas.current); scene.current = sc;
      const fit = () => { const el = stageEl.current; if (el) sc.resize(el.clientWidth, el.clientHeight, window.devicePixelRatio || 1); };
      fit();
      const ro = new ResizeObserver(fit); if (stageEl.current) ro.observe(stageEl.current);
      const loop = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const r = save.current.run;
        if (!stage.current && r) stage.current = fromRun(r);
        if (stage.current) sc.setView(stage.current);
        sc.frame(dt);
        sound.current?.tick(true);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      (sc as unknown as { ro: ResizeObserver }).ro = ro;
    }).catch(() => {});
    return () => { dead = true; cancelAnimationFrame(raf); const sc = scene.current as unknown as { ro?: ResizeObserver } | null; sc?.ro?.disconnect(); scene.current = null; };
  }, [showStage]);
  // music keeps ticking on the other screens too
  useEffect(() => {
    if (showStage) return;
    const id = window.setInterval(() => sound.current?.tick(true), 120);
    return () => window.clearInterval(id);
  }, [showStage]);
  useEffect(() => { if (rolling.size) { const id = window.setTimeout(() => setRolling(new Set()), 700); return () => window.clearTimeout(id); } }, [rolling]);

  const toggle = (k: 'sound' | 'music') => { const s = save.current; s[k] = !s[k]; if (k === 'sound') sound.current?.setSound(s.sound); else sound.current?.setMusic(s.music); sfx()?.ui(); persist(); rerender(); };
  const settings = (
    <span className="lp-chips">
      <button type="button" className={'lp-chip' + (save.current.sound ? ' is-on' : '')} aria-pressed={save.current.sound} onClick={() => toggle('sound')}>Sound</button>
      <button type="button" className={'lp-chip' + (save.current.music ? ' is-on' : '')} aria-pressed={save.current.music} onClick={() => toggle('music')}>Music</button>
    </span>
  );

  // ---------- pieces ----------
  function ToolCard({ ti, mode }: { ti: number; mode: 'battle' | 'pick' | 'show' }) {
    const r = save.current.run!, t = r.tools[ti], def = TOOL[t.id], need = needOf(def, t.up), k = slotsOf(need), slot = r.battle?.slots[ti];
    const uses = usesOf(def, t.up);
    const live = mode === 'battle' && !!slot && !busy;
    const fitSel = live && sel != null && fits(r, sel, ti);
    const fitHover = live && hover === ti && sel != null && fits(r, sel, ti);
    const can = live && r.battle!.dice.some(d => fits(r, d.id, ti));
    const spent = !!slot && (slot.spent || (uses > 0 && slot.used >= uses));
    const left = uses === 99 ? '∞' : uses === 0 ? 'once a battle' : uses > 1 ? `${Math.max(0, uses - (slot?.used ?? 0))}/${uses} this turn` : '';
    return (
      <button key={ti} type="button" className={'lp-tool' + (t.up ? ' is-up' : '') + (fitSel ? ' is-fit' : '') + (fitHover ? ' is-hover' : '') + (can && sel == null ? ' is-can' : '') + (spent && mode === 'battle' ? ' is-spent' : '') + (slot?.locked ? ' is-locked' : '') + (flash === ti ? ' is-flash' : '') + (live && sel != null && !fitSel ? ' is-dim' : '')}
        data-ti={mode === 'battle' ? ti : undefined} data-tool={t.id} onClick={() => (mode === 'battle' ? clickTool(ti) : undefined)} disabled={mode === 'show'}>
        <span className="lp-tool-top"><Glyph k={def.glyph} size={30} /><b>{def.name}</b>{mode === 'battle' && <kbd className="lp-key">{ti + 1}</kbd>}</span>
        <span className="lp-rule">{t.up ? def.textUp : def.text}</span>
        <span className="lp-slots">
          {need.k === 'count' ? (
            <span className="lp-count"><i style={{ width: `${(100 * (need.n - (slot?.count ?? need.n))) / need.n}%` }} /><em>{slot ? slot.count : need.n} to go</em></span>
          ) : Array.from({ length: k }, (_, j) => <span key={j} className="lp-slot">{slot?.pend[j] != null ? <DieFace v={slot.pend[j]} size={22} /> : null}</span>)}
          {left && <small>{left}</small>}
        </span>
        {slot?.locked && <span className="lp-lockmark">ringed!</span>}
      </button>
    );
  }
  function MiniTool({ k, id, up, price, onClick, disabled, tag }: { k: string | number; id: string; up?: boolean; price?: number; onClick?: () => void; disabled?: boolean; tag?: string }) {
    const def = TOOL[id];
    return (
      <button key={k} type="button" className={'lp-tool lp-offer' + (up ? ' is-up' : '')} onClick={onClick} disabled={disabled} data-offer={id}>
        <span className="lp-tool-top"><Glyph k={def.glyph} size={34} /><b>{def.name}</b></span>
        <span className="lp-rule">{up ? def.textUp : def.text}</span>
        <span className="lp-who">{def.who === 'any' ? 'for anyone' : def.who === 'dora' ? "Dora's kind" : "Enzo's kind"}{tag ? ` · ${tag}` : ''}{price != null ? <b className="lp-price">{price} acorns</b> : null}</span>
      </button>
    );
  }
  function hud(r: Run) {
    return (
      <span className="lp-pills">
        <span className="lp-pill lp-hearts" title="Hearts"><b>{r.hp}</b>/{r.max}</span>
        <span className="lp-pill lp-acorns" title="Acorns"><b>{r.acorns}</b></span>
        {r.charms.map(c => <span key={c} className="lp-pill lp-charm" title={`${CHARM[c].name}: ${CHARM[c].text}`}><Glyph k={CHARM[c].glyph} size={18} /></span>)}
      </span>
    );
  }

  // ---------- screens ----------
  function Menu() {
    const s = save.current, m = s.meta, open = fogOpen(m), dailyDone = today ? m.daily[today] : undefined;
    const cont = s.run && s.run.screen !== 'won' && s.run.screen !== 'lost';
    return (
      <div className="lp-menu">
        <Art src="/art/pips/title.webp" paint="title" className="lp-menu-art" />
        <div className="lp-menu-card">
          <p className="lp-eyebrow">A DICE ROGUELITE AT THE HARVEST FAIR</p>
          <h1>Lucky Pips</h1>
          <p className="lp-lede">A mischief of fog has rolled over the harvest fair and grumpy fog-sprites have taken the stalls. Roll your carved dice, drop them into handmade tools, and set the fair right, stall by stall.</p>
          <div className="lp-leads" role="radiogroup" aria-label="Who leads">
            {(['dora', 'enzo', 'both'] as LeadId[]).map(l => {
              const ok = leadOpen(m, l);
              return (
                <button key={l} type="button" role="radio" aria-checked={s.lead === l} className={'lp-lead' + (s.lead === l ? ' is-on' : '')} disabled={!ok}
                  onClick={() => { s.lead = l; persist(); sfx()?.ui(); rerender(); }}>
                  <span className="lp-lead-pics">{l !== 'enzo' && <img src="/art/pips/dora-ready.webp" alt="" />}{l !== 'dora' && <img src="/art/pips/enzo-ready.webp" alt="" />}</span>
                  <b>{LEADS[l].name}</b>
                  <small>{ok ? `${LEADS[l].hp} hearts · ${LEADS[l].passive}` : 'Win a run to unlock'}</small>
                </button>
              );
            })}
          </div>
          {open > 0 && (
            <div className="lp-fog" aria-label="Foggier">
              <span>Foggier</span>
              {Array.from({ length: open + 1 }, (_, i) => <button key={i} type="button" className={'lp-chip' + (s.fog === i ? ' is-on' : '')} aria-pressed={s.fog === i} onClick={() => { s.fog = i; persist(); sfx()?.ui(); rerender(); }}>{i}</button>)}
              <small>{FOGGIER.slice(1, s.fog + 1).join(' ') || FOGGIER[0]}</small>
            </div>
          )}
          <div className="lp-menu-go">
            {cont && <button type="button" className="lp-big" onClick={() => { sfx()?.ui(); stage.current = fromRun(s.run!); setShown(s.run!.screen); setView('run'); arrive(); }}>Continue the run</button>}
            <button type="button" className={cont ? '' : 'lp-big'} onClick={() => { if (cont) save.current.run = null; startRun(false); }}>{cont ? 'New run' : 'Start a run'}</button>
            <button type="button" disabled={!today} onClick={() => { if (cont) save.current.run = null; startRun(true); }}>Daily Fair{today ? ` · ${today.slice(8)}/${today.slice(5, 7)}` : ''}{dailyDone ? (dailyDone.won ? ' · won' : ' · tried') : ''}</button>
            <button type="button" onClick={() => { sfx()?.ui(); setView('help'); }}>How to play</button>
          </div>
          <p className="lp-stats">{m.runs ? `${m.runs} run${m.runs === 1 ? '' : 's'} · ${m.wins} win${m.wins === 1 ? '' : 's'}${m.fogWon >= 1 ? ` · best Foggier ${m.fogWon}` : ''}` : 'Your first visit to the fair.'}{m.ending ? ' · the fair is saved' : ''}</p>
        </div>
      </div>
    );
  }
  function Help() {
    return (
      <div className="lp-help">
        <h2>How to play</h2>
        <ul>
          <li><b>Roll and place.</b> Each turn you roll your dice. Drag a die onto a tool (or tap the die, then the tool). A tool glows when the die fits its rule.</li>
          <li><b>Read the foes.</b> The bubble over each fog-sprite shows what it will do next turn: hit (and how hard), block, sticky toffee on your dice, a ring on a tool, or calling a friend.</li>
          <li><b>End the turn.</b> Unused dice are lost, then the foes act. Block soaks up hits until your next turn.</li>
          <li><b>Hearts are shared.</b> Dora and Enzo share one pool of hearts. Win battles for acorns and new tools; visit stalls, picnics and mystery tents on the map.</li>
          <li><b>Two- and three-dice tools</b> wait until they are full; tap them to take the dice back. <b>Countdown tools</b> eat pips over the whole battle.</li>
          <li><b>Statuses:</b> poison stings every turn and fades by one; burn stings and halves; frost takes a pip off every die; stun skips a foe's turn.</li>
          <li><b>Keys:</b> <kbd>←</kbd> <kbd>→</kbd> pick a die, <kbd>1</kbd>–<kbd>7</kbd> drop it in a tool, <kbd>R</kbd> re-roll it, <kbd>↑</kbd> <kbd>↓</kbd> pick a target, <kbd>E</kbd> end the turn.</li>
        </ul>
        <button type="button" className="lp-big" onClick={() => { sfx()?.ui(); setView(save.current.run && save.current.run.screen !== 'won' && save.current.run.screen !== 'lost' ? 'run' : 'menu'); }}>Back</button>
      </div>
    );
  }
  function MapScreen({ r }: { r: Run }) {
    const c = choices(r), area = AREAS[r.area];
    const sideways = typeof window !== 'undefined' && window.innerWidth > window.innerHeight * 1.15;
    const pos = (n: { row: number; x: number }) => (sideways ? { left: 6 + (n.row / ROWS) * 88, top: 8 + n.x * 84 } : { left: 6 + n.x * 88, top: 92 - (n.row / ROWS) * 84 });
    const focus = c[Math.min(mapSel, c.length - 1)];
    return (
      <div className="lp-mapwrap" data-area={r.area}>
        <div className="lp-map" style={{ backgroundImage: `url(/art/pips/${area.art}.webp)` }}>
          <svg className="lp-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {r.map.flatMap(n => n.next.map(j => { const a = pos(n), z = pos(r.map[j]); const walked = r.path.includes(n.id) && r.path.includes(j); return <line key={`${n.id}-${j}`} x1={a.left} y1={a.top} x2={z.left} y2={z.top} className={walked ? 'walked' : c.includes(j) && (r.at === n.id) ? 'next' : ''} />; }))}
          </svg>
          {r.map.map(n => {
            const p = pos(n), here = r.at === n.id, can = c.includes(n.id), done = r.path.includes(n.id);
            return (
              <button key={n.id} type="button" className={'lp-node k-' + n.kind + (here ? ' is-here' : '') + (can ? ' is-can' : '') + (done ? ' is-done' : '') + (n.id === focus ? ' is-focus' : '')}
                style={{ left: `${p.left}%`, top: `${p.top}%` }} disabled={!can || busy} onClick={() => walk(n.id)} aria-label={NODE_LABEL[n.kind]} data-node={n.id} data-kind={n.kind}>
                <Glyph k={NODE_GLYPH[n.kind]} size={n.kind === 'boss' ? 34 : 24} />
              </button>
            );
          })}
        </div>
        <aside className="lp-mapside">
          <p className="lp-eyebrow">{`AREA ${r.area + 1} OF 3${r.fog ? ` · FOGGIER ${r.fog}` : ''}${r.daily ? ' · DAILY FAIR' : ''}`}</p>
          <h2>{area.name}</h2>
          {r.note && <p className="lp-note">{r.note}</p>}
          <p className="lp-hint">{r.at < 0 ? 'Choose where to start. ' : ''}Pick a glowing stop. The boss of the area waits at the end: {FOES[area.boss].name}.</p>
          <ul className="lp-legend">{(['battle', 'elite', 'tent', 'stall', 'picnic'] as const).map(k => <li key={k}><span className={'lp-dot k-' + k}><Glyph k={NODE_GLYPH[k]} size={16} /></span>{NODE_LABEL[k]}</li>)}</ul>
          <p className="lp-eyebrow">YOUR SATCHEL · {r.tools.length}/{toolRoom(r)} TOOLS</p>
          <ul className="lp-satchel">{r.tools.map((t, i) => <li key={i} className={t.up ? 'is-up' : ''}><Glyph k={TOOL[t.id].glyph} size={24} /><span><b>{TOOL[t.id].name}</b><small>{t.up ? TOOL[t.id].textUp : TOOL[t.id].text}</small></span></li>)}</ul>
          {r.charms.length > 0 && <ul className="lp-satchel">{r.charms.map(c => <li key={c}><Glyph k={CHARM[c].glyph} size={24} /><span><b>{CHARM[c].name}</b><small>{CHARM[c].text}</small></span></li>)}</ul>}
          <button type="button" className="lp-abandon" onClick={abandon}>Give up this run</button>
        </aside>
      </div>
    );
  }
  function swapPicker(onPick: (i: number) => void, onCancel: () => void) {
    const r = save.current.run!;
    return (
      <div className="lp-swap">
        <p>Your table is full ({toolRoom(r)} tools). Give up which one?</p>
        <div className="lp-offers lp-small">{r.tools.map((t, i) => MiniTool({ k: i, id: t.id, up: t.up, onClick: () => onPick(i) }))}</div>
        <button type="button" onClick={onCancel}>Keep my tools</button>
      </div>
    );
  }
  function Panel({ r }: { r: Run }) {
    const o = r.offer;
    if (shown === 'reward' && o?.kind === 'reward') {
      const full = r.tools.length >= toolRoom(r);
      return (
        <div className="lp-panel lp-reward">
          {o.acorns > 0 ? <h2>The stall is free of fog!</h2> : <h2>A find!</h2>}
          {o.acorns > 0 && <p className="lp-gain">+{o.acorns} acorns{o.upgraded >= 0 ? ` · your ${TOOL[r.tools[o.upgraded].id].name} got a gold rim` : ''}</p>}
          {pending?.kind === 'reward' ? swapPicker(i => { act(rr => takeReward(rr, pending.i, i)); setPending(null); }, () => setPending(null)) : (
            <>
              <p>Pick a tool to take along{o.tools.length ? '' : ' (none left to find)'}:</p>
              <div className="lp-offers">{o.tools.map((id, i) => MiniTool({ k: id, id: id, onClick: () => { sfx()?.ui(); if (full) setPending({ kind: 'reward', i }); else act(rr => takeReward(rr, i)); } }))}</div>
              <button type="button" onClick={() => act(rr => takeReward(rr, -1))}>Skip it (+8 acorns)</button>
            </>
          )}
        </div>
      );
    }
    if (shown === 'charm' && o?.kind === 'charm') return (
      <div className="lp-panel">
        <h2>{AREAS[r.area].name} is clear!</h2>
        <p>The fair folk press a lucky charm into your paws. Choose one:</p>
        <div className="lp-offers">{o.charms.map((id, i) => <button key={id} type="button" className="lp-tool lp-offer lp-charmcard" onClick={() => act(rr => takeCharm(rr, i))}><span className="lp-tool-top"><Glyph k={CHARM[id].glyph} size={36} /><b>{CHARM[id].name}</b></span><span className="lp-rule">{CHARM[id].text}</span></button>)}</div>
      </div>
    );
    if (shown === 'stall' && o?.kind === 'stall') return (
      <div className="lp-panel lp-stall">
        <h2>The Trading Stall</h2>
        <p>A badger in a striped apron spreads her wares. You have <b>{r.acorns}</b> acorns.</p>
        {pending?.kind === 'stall' ? swapPicker(i => { act(rr => stallBuy(rr, pending.i, i)); setPending(null); }, () => setPending(null))
          : stallMode ? (
            <div className="lp-swap">
              <p>{stallMode === 'up' ? `Give which tool a gold rim (${o.up} acorns)?` : `Leave which tool behind (${o.rm} acorns)?`}</p>
              <div className="lp-offers lp-small">{r.tools.map((t, i) => MiniTool({ k: i, id: t.id, up: t.up, disabled: stallMode === 'up' && t.up, onClick: () => { act(rr => (stallMode === 'up' ? stallUpgrade(rr, i) : stallRemove(rr, i))); setStallMode(''); } }))}</div>
              <button type="button" onClick={() => setStallMode('')}>Never mind</button>
            </div>
          ) : (
            <>
              <div className="lp-offers">{o.tools.map((it, i) => MiniTool({ k: it.id, id: it.id, price: it.price, tag: it.sold ? 'sold' : undefined, disabled: it.sold || r.acorns < it.price, onClick: () => { sfx()?.acorns(); if (r.tools.length >= toolRoom(r)) setPending({ kind: 'stall', i }); else act(rr => stallBuy(rr, i)); } }))}</div>
              <div className="lp-row">
                <button type="button" disabled={o.usedUp || r.acorns < o.up || r.tools.every(t => t.up)} onClick={() => { sfx()?.ui(); setStallMode('up'); }}>Gold rim a tool · {o.up}</button>
                <button type="button" disabled={o.usedRm || r.acorns < o.rm || r.tools.length <= 2} onClick={() => { sfx()?.ui(); setStallMode('rm'); }}>Leave a tool · {o.rm}</button>
                <button type="button" disabled={o.usedPie || r.acorns < o.pie || r.hp >= r.max} onClick={() => act(rr => stallPie(rr))}>Pumpkin pie (+12 hearts) · {o.pie}</button>
                <button type="button" className="lp-big" onClick={() => act(rr => leave(rr))}>Back to the map</button>
              </div>
            </>
          )}
      </div>
    );
    if (shown === 'picnic' && o?.kind === 'picnic') return (
      <div className="lp-panel">
        <h2>A Picnic Under the Bunting</h2>
        <p>Dora unpacks the basket; Enzo spreads the blanket. Rest a while, or sharpen a tool?</p>
        {stallMode === 'up' ? (
          <div className="lp-swap"><p>Give which tool a gold rim?</p><div className="lp-offers lp-small">{r.tools.map((t, i) => MiniTool({ k: i, id: t.id, up: t.up, disabled: t.up, onClick: () => { act(rr => picnic(rr, i)); setStallMode(''); } }))}</div><button type="button" onClick={() => setStallMode('')}>Never mind</button></div>
        ) : (
          <div className="lp-row">
            <button type="button" className="lp-big" onClick={() => act(rr => picnic(rr))}>Rest: +{Math.min(o.heal, r.max - r.hp)} hearts</button>
            <button type="button" disabled={r.tools.every(t => t.up)} onClick={() => { sfx()?.ui(); setStallMode('up'); }}>Sharpen a tool (gold rim)</button>
          </div>
        )}
      </div>
    );
    if (shown === 'tent' && r.tent) { const t = TENT[r.tent]; return (
      <div className="lp-panel lp-tent">
        <p className="lp-eyebrow">MYSTERY TENT</p>
        <h2>{t.name}</h2>
        <p>{t.text}</p>
        <div className="lp-row">{t.choices.map(ch => <button key={ch.id} type="button" onClick={() => act(rr => tentChoose(rr, ch.id))}>{ch.label}</button>)}</div>
      </div>
    ); }
    if (shown === 'pick' && o?.kind === 'pick') return (
      <div className="lp-panel"><h2>{o.purpose === 'remove' ? 'Leave a tool behind' : 'Polish a tool'}</h2>
        <div className="lp-offers lp-small">{r.tools.map((t, i) => MiniTool({ k: i, id: t.id, up: t.up, onClick: () => act(rr => pickTool(rr, i)) }))}</div>
        <button type="button" onClick={() => act(rr => leave(rr))}>Never mind</button></div>
    );
    if (shown === 'won') return (
      <div className="lp-panel lp-end">
        <Art src="/art/pips/ending.webp" paint="ending" className="lp-end-art" />
        <div className="lp-end-text">
          <p className="lp-eyebrow">{r.daily ? `DAILY FAIR · ${r.daily}` : r.fog ? `FOGGIER ${r.fog}` : 'THE FAIR IS SAVED'}</p>
          <h2>The fog lifts!</h2>
          <p>The Fog Ringmaster tips his hat, sighs a long grey sigh and drifts off over the hills. The bunting snaps bright in the sun, the carousel tinkles back to life, and every stall-keeper wants to shake Dora and Enzo by the paw. Somebody pins a blue rosette on the hay bale. It says, in wobbly letters, LUCKIEST PAWS AT THE FAIR.</p>
          <p className="lp-gain">{r.stats.battles} battles · {r.stats.turns} turns · biggest hit {r.stats.maxHit} · {r.stats.healed} hearts mended</p>
          {news.map(n => <p key={n} className="lp-news">{n}</p>)}
          <button type="button" className="lp-big" onClick={() => { save.current.meta.ending = true; closeRun(); }}>Back to the fair gate</button>
        </div>
      </div>
    );
    if (shown === 'lost') return (
      <div className="lp-panel lp-end lp-lost">
        <div className="lp-end-text">
          <p className="lp-eyebrow">{AREAS[r.area].name.toUpperCase()}</p>
          <h2>Out of hearts</h2>
          <p>The fog swirls a little thicker, and Dora and Enzo trudge home for cocoa and a nap. The fair will still be there tomorrow, and so will your dice.</p>
          <p className="lp-gain">{r.stats.battles} battles won · {r.stats.turns} turns · biggest hit {r.stats.maxHit}</p>
          {news.map(n => <p key={n} className="lp-news">{n}</p>)}
          <button type="button" className="lp-big" onClick={closeRun}>Back to the fair gate</button>
        </div>
      </div>
    );
    return null;
  }
  function BattleDesk({ r }: { r: Run }) {
    const bt = r.battle!, dice = trayHidden ? [] : bt.dice;
    const anyMove = !busy && moves(r).length > 0;
    const tipText = !save.current.taught && view === 'run' ? (tip === 0 ? (touch ? 'Drag a die onto a tool, or tap the die and then the tool. Glowing tools fit.' : 'Drag a die onto a tool, or tap the die and then the tool. Glowing tools fit.') : tip === 1 ? 'The bubble over each foe shows what it will do next turn. When you are done, end the turn.' : '') : '';
    return (
      <div className="lp-desk">
        <div className="lp-tray" aria-label="Dice tray">
          <div className="lp-felt">
            {dice.map(d => <Die key={d.id} id={d.id} v={d.v} curse={d.curse} sel={sel === d.id} roll={rolling.has(d.id)} onDown={e => onDieDown(e, d.id)} />)}
            {!dice.length && <span className="lp-felt-empty">{busy ? 'The foes take their turn…' : 'No dice left'}</span>}
          </div>
          <div className="lp-tray-bar">
            {bt.rerolls > 0 && <button type="button" className={'lp-cup' + (hover === -2 ? ' is-hover' : '')} data-reroll="1" disabled={busy || sel == null} onClick={() => doReroll(sel)} title="Re-roll the chosen die (R)">Re-roll ×{bt.rerolls}</button>}
            <span className="lp-turn">TURN {bt.turn}</span>
            <button type="button" className={'lp-end' + (!anyMove && !busy ? ' is-ready' : '')} disabled={busy} onClick={doEnd}>End turn <kbd>E</kbd></button>
          </div>
          {tipText && <p className="lp-tip">{tipText}</p>}
        </div>
        <div className="lp-tools" data-n={r.tools.length}>{r.tools.map((_, i) => ToolCard({ ti: i, mode: 'battle' }))}</div>
      </div>
    );
  }

  const r = run;
  const screenNow = view === 'run' && r ? (busy ? 'battle' : shown) : view;
  const ready = mounted;
  const kind = r?.battle?.kind;
  return (
    <main className="lp-shell" data-ready={ready ? 'true' : undefined} data-view={view} data-screen={screenNow} data-area={r?.area ?? 0} data-touch={touch ? 'true' : undefined}>
      <header className="lp-bar">
        {view === 'run' && r ? <button type="button" className="lp-back" onClick={quitToMenu}>← FAIR GATE</button> : <a href="/" className="lp-back">← ARCADE</a>}
        <span className="lp-bar-mid">
          {view === 'run' && r ? <><b className="lp-name">{AREAS[r.area].name}</b><small>{inBattle ? (kind === 'boss' ? 'BOSS' : kind === 'elite' ? 'GRAND FOE' : 'BATTLE') : shown.toUpperCase()}</small></> : <b className="lp-name">Lucky Pips</b>}
        </span>
        {view === 'run' && r && hud(r)}
        {settings}
        {view === 'run' && <button type="button" className="lp-chip" onClick={() => { sfx()?.ui(); setView('help'); }} aria-label="How to play">?</button>}
      </header>
      {view === 'menu' && mounted && Menu()}
      {view === 'menu' && !mounted && <div className="lp-menu"><Art src="/art/pips/title.webp" paint="title" className="lp-menu-art" /></div>}
      {view === 'help' && Help()}
      {view === 'run' && r && (
        <div className={'lp-run' + (showStage ? ' has-stage' : '')}>
          {showStage && (
            <div className="lp-battle">
              <div className="lp-stage" ref={stageEl}><canvas ref={canvas} onPointerDown={clickStage} aria-label="The battle" /></div>
              {inBattle && r.battle && BattleDesk({ r })}
              {!busy && (shown === 'reward' || shown === 'charm') && <div className="lp-over">{Panel({ r })}</div>}
            </div>
          )}
          {!showStage && shown === 'map' && MapScreen({ r })}
          {!showStage && shown !== 'map' && (
            <div className="lp-scene" style={{ backgroundImage: `url(/art/pips/${AREAS[r.area].art}.webp)` }}>
              {shown !== 'won' && (() => { const pose = shown === 'lost' ? 'hurt' : shown === 'picnic' ? 'win' : 'ready'; return <span className="lp-pair" aria-hidden="true"><img src={`/art/pips/enzo-${pose}.webp`} alt="" /><img src={`/art/pips/dora-${pose}.webp`} alt="" /></span>; })()}
              {Panel({ r })}
            </div>
          )}
        </div>
      )}
      <div className="lp-ghost" ref={ghost} aria-hidden="true">{sel != null && b?.dice.find(d => d.id === sel) ? <DieFace v={b.dice.find(d => d.id === sel)!.v} size={56} /> : null}</div>
    </main>
  );
}
