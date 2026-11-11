'use client';
// Cloudsteel: the page. The story (walking the three areas, talking, the lantern, pickups, duels handed to the fight
// engine), the terrace duel from the title menu, input (keys, mouse, a touch stick and buttons), the fight HUD and
// the talk box, menus, results, the endings and the save. Rules in lib/cloudsteel-game.ts and lib/cloudsteel-world.ts,
// the story's content in lib/cloudsteel-story.ts, drawing in lib/cloudsteel-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/cloudsteel-game';
import type { Fight, FightEvent, Result, Save } from '@/lib/cloudsteel-game';
import { World, idleW, type WInput, type WorldEvent } from '@/lib/cloudsteel-world';
import { AREAS, ITEMS, NAMES, QUIPUS, type ItemId } from '@/lib/cloudsteel-story';
import type { AreaId } from '@/lib/cloudsteel-world';
import type { CloudsteelScene } from '@/lib/cloudsteel-scene';
import { CloudsteelSound } from './sound';
import './cloudsteel.css';

type Screen = 'title' | 'howto' | 'settings' | 'prologue' | 'story' | 'fight' | 'result' | 'ending' | 'finale';
type Tap = 'attack' | 'dodge' | 'tag' | 'swap' | 'act' | 'lantern' | 'yes' | 'no';
type Done = { result: Result; best: boolean; first: boolean };
type Talk = { who: string; text: string; choosing: boolean; yes: string; no: string } | null;

const art = (n: string) => `/art/cloudsteel/${n}.webp`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const RANK: Record<Result['rank'], { name: string; line: string }> = {
  gold: { name: 'Gold seal', line: 'Barely touched, and never down.' },
  silver: { name: 'Silver seal', line: 'A clean crossing. Take fewer hits, and never fall, for gold.' },
  bronze: { name: 'Bronze seal', line: 'You made it across. Guard at the gold glint to take less.' },
};
const FACE: Record<G.Look, string> = { atoq: 'portrait-atoq', kin: 'portrait-kin', mallku: 'portrait-mallku', titu: 'portrait-titu', ukhu: 'portrait-ukhu' };
const PORTRAIT: Record<string, string> = { dora: 'portrait-dora', enzo: 'portrait-enzo', qori: 'portrait-qori', tupa: 'portrait-tupa', atoq: 'portrait-atoq', kin: 'portrait-kin', mallku: 'portrait-mallku', titu: 'portrait-titu', ukhu: 'portrait-ukhu' };
const SWORD: ItemId[] = ['edge', 'feather', 'claw'], LANTERN_UPS: ItemId[] = ['wick', 'jade', 'flame'];

export default function CloudsteelPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<CloudsteelScene | null>(null);
  const soundRef = useRef<CloudsteelSound | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [backend, setBackend] = useState('');
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const fightRef = useRef<Fight | null>(null);
  const worldRef = useRef<World | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [fallen, setFallen] = useState(false);
  const [touch, setTouch] = useState(false);
  const [fromFight, setFromFight] = useState<'' | 'fight' | 'story'>('');
  const [talk, setTalk] = useState<Talk>(null);
  const [choice, setChoice] = useState(1);
  const choiceRef = useRef(1);
  const [toast, setToast] = useState<ItemId | null>(null);
  const [inDuel, setInDuel] = useState(false);
  const [areaName, setAreaName] = useState('');
  const keys = useRef(new Set<string>());
  /** presses since the last tick, so a tap quicker than a frame still counts */
  const taps = useRef(new Set<Tap>());
  const sent = useRef<G.Input>(G.idleInput());
  const sentW = useRef<WInput>(idleW());
  const stick = useRef({ x: 0, y: 0, id: -1, ox: 0, oy: 0 });
  const drag = useRef({ id: -1, x: 0, moved: 0, button: -1 });
  const held = useRef({ guard: false, mouseGuard: false });
  const reduced = useRef(false);
  const slow = useRef(0);
  const duelEnd = useRef(0);
  const savedAt = useRef(0);
  const hud = useRef<Record<string, HTMLElement | null>>({});
  const H = (k: string) => (el: HTMLElement | null) => { hud.current[k] = el; };
  const last = useRef({ hp: -1, post: -1, fhp: -1, fpost: -1, foe: -2, combo: -1, tag: -1, prompt: '', broken: false, near: '' });

  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setPaused = useCallback((p: boolean) => { pausedRef.current = p; setPausedState(p); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const saveStory = useCallback(() => { const w = worldRef.current; if (!w) return; savedAt.current = performance.now(); persist({ ...saveRef.current, story: w.toSave() as unknown as Record<string, unknown> }); }, [persist]);
  const sfx = () => soundRef.current;
  const resetHud = () => { last.current = { hp: -1, post: -1, fhp: -1, fpost: -1, foe: -2, combo: -1, tag: -1, prompt: '', broken: false, near: '' }; };

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    setTouch(coarse || 'ontouchstart' in window);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new CloudsteelSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/cloudsteel-scene').then((m) => m.CloudsteelScene.create(canvasRef.current!, s.settings.fx)).then((sc) => {
      if (gone) { sc.dispose(); return; }
      sceneRef.current = sc; setBackend(sc.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'); setReady(true);
    }).catch(() => setFailed(true));
    const vis = () => { if (document.hidden) { soundRef.current?.suspend(); if (screenRef.current === 'fight' || screenRef.current === 'story') setPaused(true); } else soundRef.current?.resume(); };
    const rs = () => sceneRef.current?.resize();
    document.addEventListener('visibilitychange', vis); window.addEventListener('resize', rs);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); window.removeEventListener('resize', rs); sceneRef.current?.dispose(); sceneRef.current = null; soundRef.current?.dispose(); };
  }, [setPaused]);

  const playing = screen === 'fight' || screen === 'story';
  useEffect(() => {
    const g = fightRef.current, w = worldRef.current;
    const song = screen === 'fight' && g ? (g.round === 2 ? 'boss' : 'fight') : screen === 'story' && w ? (inDuel ? (w.duel?.id === 'ukhu' ? 'boss' : 'fight') : 'explore') : screen === 'ending' || screen === 'finale' ? 'ending' : 'menu';
    sfx()?.music(song); sfx()?.ambience(screen === 'fight' || screen === 'story');
    if (screen === 'fight' || screen === 'story') requestAnimationFrame(() => sceneRef.current?.resize());
  }, [screen, inDuel]);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); setScreen(s); };

  // ---------------------------------------------------------------- the terrace duel
  const startFight = useCallback(() => {
    sfx()?.unlock(); sfx()?.button();
    const s = saveRef.current;
    if (!s.seenHow) { persist({ ...s, seenHow: true }); setFromFight('fight'); setScreen('howto'); return; }
    worldRef.current = null;
    fightRef.current = new G.Fight((Math.random() * 2 ** 31) | 0, s.settings.assist);
    persist({ ...s, fights: s.fights + 1 });
    taps.current.clear(); sent.current = G.idleInput(); slow.current = 0; setFallen(false); setPaused(false); setDone(null); resetHud();
    setScreen('fight');
  }, [persist, setPaused, setScreen]);

  // ---------------------------------------------------------------- the story
  const beginStory = useCallback((fresh: boolean) => {
    sfx()?.unlock(); sfx()?.button();
    const s = saveRef.current;
    if (!s.seenHow) { persist({ ...s, seenHow: true }); setFromFight(fresh ? 'story' : 'story'); setScreen('howto'); return; }
    const old = !fresh && s.story ? World.fromSave(s.story) : null;
    if (old && !old.done) { worldRef.current = old; enterStory(); return; }
    worldRef.current = new World(); persist({ ...s, story: worldRef.current.toSave() as unknown as Record<string, unknown> }); setScreen('prologue');
  }, [persist, setScreen]);
  const enterStory = useCallback(() => {
    fightRef.current = null; taps.current.clear(); sentW.current = idleW(); sent.current = G.idleInput(); slow.current = 0; duelEnd.current = 0;
    setFallen(false); setPaused(false); setTalk(null); setToast(null); setInDuel(false); resetHud();
    const w = worldRef.current; if (w) setAreaName(AREAS[w.area].name);
    setScreen('story');
  }, [setPaused, setScreen]);

  const banner = (text: string, kind: string) => {
    const el = hud.current.banner; if (!el) return;
    el.textContent = text; el.dataset.kind = kind; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  };
  const onEvents = useCallback((g: Fight, evs: FightEvent[]) => {
    const snd = sfx(), sc = sceneRef.current, story = !!worldRef.current;
    for (const e of evs) {
      sc?.event(e, g, reduced.current);
      switch (e.t) {
        case 'round': banner(story ? g.rounds[0].title : `Round ${e.n + 1} · ${G.ROUNDS[e.n].title}`, 'round'); snd?.round(); if (!story) snd?.music(e.n === 2 ? 'boss' : 'fight'); break;
        case 'swing': snd?.swing(e.n); break;
        case 'hit': snd?.hit(e.heavy); break;
        case 'deflect': snd?.deflect(); banner('Deflect', 'gold'); if (!reduced.current) slow.current = 0.16; break;
        case 'block': snd?.block(); break;
        case 'parried': snd?.parried(); banner('Turned aside', 'steel'); break;
        case 'hurt': snd?.hurt(); break;
        case 'dodge': snd?.dodge(); break;
        case 'windup': snd?.tell(e.jade); break;
        case 'broken': snd?.broken(); banner('Posture broken', 'gold'); break;
        case 'guardBroken': snd?.broken(); banner('Guard broken', 'jade'); break;
        case 'finisher': snd?.finisher(); break;
        case 'finisherHit': banner('Cloudsteel', 'gold'); if (!reduced.current) slow.current = 0.22; break;
        case 'tagReady': snd?.tagReady(); break;
        case 'tag': snd?.tag(); banner('Enzo!', 'gold'); break;
        case 'tagHit': snd?.hit(true); break;
        case 'clear': snd?.clear(); banner(story ? 'Won' : e.n + 1 < G.ROUNDS.length ? 'Round cleared' : 'The bridge is yours', 'gold'); break;
        case 'lost': snd?.lost(); setFallen(true); break;
        case 'won': snd?.won(); break;
      }
    }
  }, []);
  const onWorld = useCallback((w: World, evs: WorldEvent[]) => {
    const snd = sfx(), sc = sceneRef.current;
    for (const e of evs) {
      sc?.worldEvent(e, w);
      switch (e.t) {
        case 'line': { const l = w.line!; setTalk({ who: l.who, text: l.text, choosing: w.choosing, yes: w.talk?.def.choice?.yes ?? '', no: w.talk?.def.choice?.no ?? '' }); choiceRef.current = 1; setChoice(1); snd?.talk(l.who === 'dora' ? 0 : l.who === 'enzo' ? 1 : 2); break; }
        case 'endTalk': setTalk(null); saveStory(); break;
        case 'lantern': snd?.lantern(); break;
        case 'plank': snd?.plank(); break;
        case 'stone': snd?.stone(); break;
        case 'stonesReset': snd?.lost(); banner('The stones go dark', 'jade'); break;
        case 'gate': snd?.gate(); banner('The way opens', 'gold'); saveStory(); break;
        case 'pickup': snd?.dodge(); break;
        case 'got': snd?.got(ITEMS[e.id].kind !== 'quipu'); setToast(e.id); saveStory(); break;
        case 'cold': snd?.cold(); break;
        case 'step': snd?.footstep(); break;
        case 'travel': setAreaName(AREAS[e.to].name); banner(AREAS[e.to].name, 'round'); snd?.round(); saveStory(); break;
        case 'duel': {
          const d = w.duel!, s = saveRef.current;
          fightRef.current = new G.Fight((Math.random() * 2 ** 31) | 0, s.settings.assist, { rounds: [{ title: d.title, foes: d.foes }], ups: w.ups });
          sent.current = G.idleInput(); slow.current = 0; duelEnd.current = 0; setFallen(false); setInDuel(true); resetHud();
          break;
        }
        case 'end': {
          snd?.won(); const s = saveRef.current;
          persist({ ...s, climbs: s.climbs + 1, story: w.toSave() as unknown as Record<string, unknown> });
          window.setTimeout(() => { if (screenRef.current === 'story' && worldRef.current === w) setScreen('finale'); }, 6500);
          break;
        }
      }
    }
  }, [persist, saveStory, setScreen]);
  /** the duel is over: the world takes the result back */
  const endDuel = useCallback((won: boolean) => {
    const w = worldRef.current, g = fightRef.current; if (!w || !g) return;
    const s = { ticks: g.stats.ticks, deflects: g.stats.deflects, falls: g.stats.falls, finishers: g.stats.finishers, damage: g.stats.damage };
    // the world has not ticked since the duel began, so its last events (the duel's start among them) are stale
    w.events.length = 0;
    if (won) w.placeFromFight(g.x, g.z, g.face, g.enzo.x, g.enzo.z);
    w.endDuel(won, s); fightRef.current = null; setInDuel(false); setFallen(false); resetHud();
    onWorld(w, w.events); w.events.length = 0; saveStory();
  }, [onWorld, saveStory]);
  const finish = useCallback(() => {
    const g = fightRef.current; if (!g) return;
    const result = g.result(), s = saveRef.current, best = G.better(result, s.best), first = s.wins === 0;
    persist({ ...s, wins: s.wins + 1, best: best ? result : s.best });
    setDone({ result, best, first }); setScreen('result');
  }, [persist, setScreen]);
  const retry = () => { sfx()?.button(); fightRef.current?.retryRound(); setFallen(false); };
  const stepBack = () => { sfx()?.button(); endDuel(false); };
  const quit = () => { sfx()?.button(); if (worldRef.current) saveStory(); fightRef.current = null; worldRef.current = null; setPaused(false); setFallen(false); setTalk(null); setInDuel(false); setScreen('title'); };

  const move = useCallback(() => {
    const k = keys.current, st = stick.current;
    let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
    if (st.id >= 0) { x = Math.abs(st.x) < 0.18 ? 0 : st.x; y = Math.abs(st.y) < 0.18 ? 0 : st.y; }
    // forward on the stick is away from the camera; right is the camera's right
    const yaw = sceneRef.current?.camYaw ?? Math.PI, f = -y;
    return { x: Math.sin(yaw) * f - Math.cos(yaw) * x, z: Math.cos(yaw) * f + Math.sin(yaw) * x };
  }, []);
  const readInput = useCallback((): G.Input => {
    const k = keys.current, m = move();
    return { x: m.x, z: m.z, attack: false, dodge: false, tag: false, swap: false, guard: k.has('KeyK') || k.has('ShiftLeft') || k.has('ShiftRight') || held.current.guard || held.current.mouseGuard };
  }, [move]);

  useEffect(() => {
    let raf = 0, prev = performance.now(), acc = 0, endT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const real = Math.min(0.1, (now - prev) / 1000); prev = now;
      const snd = sfx(); snd?.pump();
      const sc = sceneRef.current, scr = screenRef.current;
      if (!sc || (scr !== 'fight' && scr !== 'story')) return;
      const w = scr === 'story' ? worldRef.current : null, g = fightRef.current;
      if (scr === 'story' && !w) return;
      if (scr === 'fight' && !g) return;
      const duel = !!w && w.mode === 'duel' && !!g;
      // a deflect or a finisher slows time for a moment
      let dt = real; if (slow.current > 0) { slow.current -= real; dt = real * 0.22; }
      if (pausedRef.current) dt = 0;
      const k = keys.current; sc.turn = pausedRef.current ? 0 : ((k.has('KeyC') ? 1 : 0) - (k.has('KeyZ') ? 1 : 0)) * 1.8;
      if (dt > 0) {
        acc += dt; let n = 0;
        if (scr === 'fight' || duel) {
          const inp = readInput();
          while (acc >= G.DT && n < 8) {
            const ti = { ...inp };
            for (const b of ['attack', 'dodge', 'tag', 'swap'] as const) if (taps.current.has(b) && !sent.current[b]) { ti[b] = true; taps.current.delete(b); }
            g!.tick(ti); sent.current = ti;
            if (g!.events.length) onEvents(g!, g!.events);
            acc -= G.DT; n++;
          }
          for (const b of ['act', 'lantern', 'yes', 'no'] as const) taps.current.delete(b);
        } else if (w) {
          const m = move();
          while (acc >= G.DT && n < 8) {
            const ti: WInput = { x: m.x, z: m.z, act: false, lantern: false, choose: 0 };
            if (taps.current.has('act') && !sentW.current.act) { ti.act = true; taps.current.delete('act'); }
            if (taps.current.has('lantern') && !sentW.current.lantern) { ti.lantern = true; taps.current.delete('lantern'); }
            if (taps.current.has('yes')) { ti.choose = 1; taps.current.delete('yes'); } else if (taps.current.has('no')) { ti.choose = 2; taps.current.delete('no'); }
            w.tick(ti); sentW.current = ti;
            if (w.events.length) onWorld(w, w.events);
            acc -= G.DT; n++;
          }
          for (const b of ['attack', 'dodge', 'tag', 'swap'] as const) taps.current.delete(b);
          if (w.mode !== 'end' && now - savedAt.current > 15000) saveStory();
        }
      } else acc = 0;
      if (scr === 'fight' && g) { if (g.phase === 'won') { endT += real; if (endT > 3.2) { endT = 0; finish(); return; } } else endT = 0; }
      if (duel && g && g.phase === 'won') { duelEnd.current += real; if (duelEnd.current > 2.4) { endDuel(true); return; } }
      sc.render(w ? { kind: 'story', world: w, fight: duel ? g : null } : { kind: 'arena', fight: g! }, dt, reduced.current);
      // the HUD, straight to the DOM
      const h = hud.current, L = last.current;
      if (w && !duel) {
        const near = w.mode === 'walk' ? w.near() : null, label = near ? near.label : '';
        if (h.near && L.near !== label) { L.near = label; h.near.dataset.on = label ? '1' : '0'; const t = h.near.querySelector('b'); if (t) t.textContent = label; }
        return;
      }
      if (!g) return;
      const tg = g.targetFoe;
      const hp = Math.round(g.hp); if (h.hp && L.hp !== hp) { L.hp = hp; h.hp.style.transform = `scaleX(${g.hp / g.maxHp})`; h.hp.parentElement!.dataset.low = g.hp < 30 ? '1' : '0'; }
      const post = Math.round(g.posture); if (h.post && L.post !== post) { L.post = post; h.post.style.transform = `scaleX(${g.posture / 100})`; }
      const fid = tg ? tg.id : -1;
      if (h.foe && L.foe !== fid) { L.foe = fid; h.foe.dataset.on = tg ? '1' : '0'; if (tg) { if (h.fname) h.fname.textContent = tg.name; const im = h.fface as HTMLImageElement | null; if (im) im.src = art(FACE[tg.look]); } L.fhp = -1; L.fpost = -1; }
      if (tg) {
        const fhp = Math.round(tg.hp); if (h.fhp && L.fhp !== fhp) { L.fhp = fhp; h.fhp.style.transform = `scaleX(${tg.hp / tg.maxHp})`; }
        const fp = Math.round(tg.posture), br = tg.state === 'broken';
        if (h.fpost && (L.fpost !== fp || L.broken !== br)) { L.fpost = fp; L.broken = br; h.fpost.style.transform = `scaleX(${br ? 1 : tg.posture / tg.maxPosture})`; h.foe!.dataset.broken = br ? '1' : '0'; }
      }
      if (h.combo && L.combo !== g.combo) { L.combo = g.combo; h.combo.dataset.on = g.combo >= 2 ? '1' : '0'; if (h.cnum) { h.cnum.textContent = `x${g.combo}`; h.cnum.classList.remove('pop'); void h.cnum.offsetWidth; h.cnum.classList.add('pop'); } }
      const tag = Math.round(g.tag); if (h.tag && L.tag !== tag) { L.tag = tag; h.tag.style.transform = `scaleX(${g.tag / G.TAG_FULL})`; h.tagbox!.dataset.full = g.tag >= G.TAG_FULL ? '1' : '0'; }
      // what to do next, when help is on
      let prompt = '';
      if (g.assist && g.phase === 'fight' && g.state !== 'dead') {
        const threat = g.foes.find((f) => f.state === 'windup' && f.atk), open = g.living.find((f) => f.state === 'broken');
        if (threat?.atk) prompt = threat.atk.jade ? 'dodge' : 'guard'; else if (open) prompt = 'finish'; else if (g.tag >= G.TAG_FULL) prompt = 'tag';
      }
      if (h.prompt && L.prompt !== prompt) { L.prompt = prompt; h.prompt.dataset.kind = prompt; h.prompt.dataset.on = prompt ? '1' : '0'; }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [endDuel, finish, move, onEvents, onWorld, readInput, saveStory]);

  // ---------------------------------------------------------------- keyboard, mouse and touch
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx()?.unlock();
      const scr = screenRef.current;
      if (scr !== 'fight' && scr !== 'story') return;
      if (/^(Arrow|Space|Tab)/.test(e.code)) e.preventDefault();
      const w = scr === 'story' ? worldRef.current : null, duel = !w || w.mode === 'duel';
      if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat && !(duel && fightRef.current?.phase === 'lost')) setPaused(!pausedRef.current); return; }
      keys.current.add(e.code);
      if (e.repeat || pausedRef.current) return;
      if (duel) {
        if (e.code === 'KeyJ') taps.current.add('attack');
        if (e.code === 'Space') taps.current.add('dodge');
        if (e.code === 'KeyE') taps.current.add('tag');
        if (e.code === 'KeyQ' || e.code === 'Tab') taps.current.add('swap');
        return;
      }
      if (w?.choosing) {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyA' || e.code === 'KeyD') { choiceRef.current = choiceRef.current === 1 ? 2 : 1; setChoice(choiceRef.current); return; }
        if (e.code === 'Digit1' || e.code === 'KeyY') { taps.current.add('yes'); return; }
        if (e.code === 'Digit2' || e.code === 'KeyN') { taps.current.add('no'); return; }
        if (['KeyE', 'Enter', 'Space', 'KeyJ'].includes(e.code)) { taps.current.add(choiceRef.current === 1 ? 'yes' : 'no'); return; }
      }
      if (['KeyE', 'Enter', 'Space', 'KeyJ'].includes(e.code)) taps.current.add('act');
      if (e.code === 'KeyF' || e.code === 'KeyL') taps.current.add('lantern');
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); held.current.mouseGuard = false; };
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', blur);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', blur); };
  }, [setPaused]);
  const exploring = () => { const w = worldRef.current; return screenRef.current === 'story' && !!w && w.mode !== 'duel'; };
  const mouseDown = (e: React.PointerEvent) => {
    const scr = screenRef.current; if (scr !== 'fight' && scr !== 'story') return;
    sfx()?.unlock();
    if (exploring()) { drag.current = { id: e.pointerId, x: e.clientX, moved: 0, button: e.button }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); return; }
    if (e.pointerType !== 'mouse') return;
    if (e.button === 0) taps.current.add('attack'); else if (e.button === 2) held.current.mouseGuard = true;
  };
  const mouseMove = (e: React.PointerEvent) => {
    const d = drag.current; if (d.id !== e.pointerId || !exploring()) return;
    const dx = e.clientX - d.x; d.x = e.clientX; d.moved += Math.abs(dx);
    // dragging turns the camera
    if (d.moved > 4) sceneRef.current?.turnBy(-dx * 0.006);
  };
  const mouseUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button === 2) held.current.mouseGuard = false;
    const d = drag.current; if (d.id !== e.pointerId) return;
    // a click (not a drag) talks, picks up or reads on
    if (d.moved <= 6 && exploring() && d.button === 0 && e.pointerType === 'mouse') taps.current.add('act');
    drag.current = { id: -1, x: 0, moved: 0, button: -1 };
  };
  const stickDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); stick.current = { x: 0, y: 0, id: e.pointerId, ox: r.left + r.width / 2, oy: r.top + r.height / 2 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); stickMove(e); };
  const stickMove = (e: React.PointerEvent) => {
    const st = stick.current; if (st.id !== e.pointerId) return;
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, R = 46, Ln = Math.hypot(dx, dy), k = Ln > R ? R / Ln : 1;
    st.x = (dx * k) / R; st.y = (dy * k) / R;
    const knob = hud.current.knob; if (knob) knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const stickUp = (e: React.PointerEvent) => { if (stick.current.id !== e.pointerId) return; stick.current = { x: 0, y: 0, id: -1, ox: 0, oy: 0 }; const knob = hud.current.knob; if (knob) knob.style.transform = ''; };
  const tb = (k: Tap) => ({ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); taps.current.add(k); sfx()?.unlock(); } });
  const guardBtn = { onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); held.current.guard = true; sfx()?.unlock(); }, onPointerUp: () => { held.current.guard = false; }, onPointerCancel: () => { held.current.guard = false; }, onPointerLeave: () => { held.current.guard = false; } };

  // ---------------------------------------------------------------- menus
  const setSetting = (k: 'assist' | 'sound' | 'music' | 'fx', v: boolean) => {
    const s = { ...saveRef.current, settings: { ...saveRef.current.settings, [k]: v } }; persist(s);
    if (k === 'sound') sfx()?.setSound(v); if (k === 'music') sfx()?.setMusic(v);
    sfx()?.unlock(); sfx()?.button();
  };
  const leaveHow = () => { const f = fromFight; setFromFight(''); if (f === 'fight') startFight(); else if (f === 'story') beginStory(false); else go('title'); };

  // for the browser tests
  useEffect(() => {
    (window as unknown as { __cloudsteel?: () => unknown }).__cloudsteel = () => {
      const g = fightRef.current, w = worldRef.current, scr = screenRef.current;
      return {
        screen: scr, paused: pausedRef.current, scene: sceneRef.current, save: saveRef.current, done, backend,
        fight: g && (scr === 'fight' || scr === 'story') ? { phase: g.phase, round: g.round, state: g.state, x: g.x, z: g.z, hp: g.hp, posture: g.posture, tag: g.tag, combo: g.combo, target: g.target, face: g.face, stats: { ...g.stats }, enzo: g.enzo.state,
          foes: g.foes.map((f) => ({ id: f.id, kind: f.kind, look: f.look, state: f.state, hp: f.hp, posture: f.posture, x: f.x, z: f.z })) } : null,
        story: w && scr === 'story' ? { area: w.area, mode: w.mode, t: w.t, tick: w.tick_, talkI: w.talk?.i ?? -1, x: w.x, z: w.z, face: w.face, flags: [...w.flags], got: [...w.gotItems], lit: [...w.lit], won: [...w.wonDuels], near: w.near(), line: w.line, choosing: w.choosing, duel: w.duel?.id ?? null, done: w.done, enzo: { ...w.enzo }, camYaw: sceneRef.current?.camYaw ?? 0 } : null,
        debug: {
          tag: (v: number) => { if (g) g.tag = v; },
          foeHp: (v: number) => { if (g) for (const f of g.living) f.hp = v; },
          foePosture: (v: number) => { if (g) for (const f of g.living) f.posture = v; },
          hp: (v: number) => { if (g) g.hp = v; },
          place: (x: number, z: number) => { if (g) { g.x = x; g.z = z; } },
          /** moves Dora in the story (and Enzo beside her) */
          go: (x: number, z: number, face?: number) => { if (w) { w.x = x; w.z = z; if (face !== undefined) { w.face = face; const sc = sceneRef.current; if (sc) sc.turnBy(face - sc.camYaw); } w.enzo.x = x - Math.sin(w.face) * 1.2; w.enzo.z = z - Math.cos(w.face) * 1.2; } },
          /** jumps to another area */
          area: (id: AreaId, x: number, z: number, face = Math.PI) => { if (w) { (w as unknown as { enter(a: AreaId, x: number, z: number, f: number): void }).enter(id, x, z, face); onWorld(w, [{ t: 'travel', to: id }]); const sc = sceneRef.current; if (sc) sc.turnBy(face - sc.camYaw); } },
          flag: (f: string) => { w?.flags.add(f); },
          give: (i: ItemId) => { w?.gotItems.add(i); },
          win: (d: string) => { w?.wonDuels.add(d); },
        },
      };
    };
  });

  // ---------------------------------------------------------------- views
  const s = save, w = worldRef.current, story = screen === 'story';
  const storyLive = s.story && !(s.story as { done?: boolean }).done;
  const ups = (list: ItemId[]) => list.filter((i) => w?.got(i));
  const fightHud = screen === 'fight' || (story && inDuel);
  return <main className={`cs-shell cs-on-${screen}${touch ? ' cs-touch' : ''}${playing ? ' cs-playing' : ''}`} data-ready={ready ? 'true' : undefined} data-screen={screen}>
    <canvas ref={canvasRef} className="cs-canvas" aria-label="Cloudsteel: the cloud fortress" onPointerDown={mouseDown} onPointerMove={mouseMove} onPointerUp={mouseUp} onPointerCancel={mouseUp} onContextMenu={(e) => e.preventDefault()} />

    {screen === 'title' && <section className="cs-title">
      <div className="cs-bg"><img src={art('title')} alt="Dora and Enzo back to back on a rain-soaked terrace under the moon" /></div>
      <div className="cs-title-col">
        <h1 className="cs-logo">Cloudsteel</h1>
        <p className="cs-tag">The Sun Lamp of the cloud fortress has gone dark. Climb to the Condor Gate with a sword and the last ember.</p>
        <div className="cs-menu">
          <button className="cs-go" disabled={!ready} onClick={() => beginStory(false)}>{failed ? 'This browser cannot draw the citadel' : !ready ? 'Loading…' : storyLive ? 'Continue the climb' : s.climbs ? 'Climb again' : 'Begin the climb'}</button>
          {storyLive && <button disabled={!ready} onClick={() => { if (window.confirm('Start the climb again from the bottom? Your place on the mountain will be lost.')) beginStory(true); }}>New climb</button>}
          <button disabled={!ready} onClick={startFight}>Terrace duel</button>
          <button onClick={() => go('howto')}>How to play</button>
          <button onClick={() => go('settings')}>Settings</button>
          {(s.wins > 0 || s.climbs > 0) && <button onClick={() => go(s.climbs ? 'finale' : 'ending')}>The Condor Gate</button>}
        </div>
        {s.best && <p className="cs-best" data-rank={s.best.rank}><i />Duel best: {RANK[s.best.rank].name} · {clock(s.best.seconds)} · {s.best.deflects} deflects</p>}
        <a className="cs-home" href="/">‹ Arcade</a>
      </div>
    </section>}

    {screen === 'prologue' && <section className="cs-page cs-prologue">
      <div className="cs-card cs-pro">
        <p className="cs-eyebrow">Phuyu Pukara, the cloud fortress</p>
        <h2>The Sun Lamp has gone dark</h2>
        <p>For three hundred years the Sun Lamp on the Condor Gate has burned through the mist, so the condors can find their way home. Nine nights ago it went out, and the mist has climbed higher every night since.</p>
        <p>Enzo carries the last ember of the Lamp in his lantern. Dora carries the sword. Somebody does not want them to reach the top.</p>
        <button className="cs-go" onClick={() => { sfx()?.button(); enterStory(); }}>Start the climb ›</button>
      </div>
    </section>}

    {playing && <section className="cs-hud">
      {fightHud && <>
        <div className="cs-foe" ref={H('foe')} data-on="0" data-broken="0">
          <span className="cs-face small"><img ref={H('fface') as (el: HTMLImageElement | null) => void} src={art('portrait-atoq')} alt="" /></span>
          <div className="cs-foe-bars">
            <b ref={H('fname')} />
            <span className="cs-bar foe"><i ref={H('fhp')} /></span>
            <span className="cs-bar posture"><i ref={H('fpost')} /></span>
            <em>Posture broken</em>
          </div>
        </div>
        <div className="cs-combo" ref={H('combo')} data-on="0"><b ref={H('cnum')}>x0</b><span>Hits</span></div>
        <div className="cs-prompt" ref={H('prompt')} data-on="0" data-kind="">
          <span data-p="guard"><img src={art('icon-guard')} alt="" />Guard now<kbd>{touch ? 'GUARD' : 'K'}</kbd></span>
          <span data-p="dodge"><img src={art('icon-dodge')} alt="" />Dodge away<kbd>{touch ? 'DODGE' : 'Space'}</kbd></span>
          <span data-p="finish"><img src={art('icon-cut')} alt="" />Finish it<kbd>{touch ? 'CUT' : 'J'}</kbd></span>
          <span data-p="tag"><img src={art('icon-tag')} alt="" />Call Enzo<kbd>{touch ? 'ENZO' : 'E'}</kbd></span>
        </div>
        <div className="cs-hero">
          <span className="cs-face"><img src={art('portrait-dora')} alt="" /></span>
          <div className="cs-hero-bars">
            <b>Dora</b>
            <span className="cs-bar hp" data-low="0"><i ref={H('hp')} /></span>
            <span className="cs-bar guard"><i ref={H('post')} /></span>
          </div>
        </div>
        <div className="cs-tagbox" ref={H('tagbox')} data-full="0">
          <span className="cs-face"><img src={art('portrait-enzo')} alt="" /></span>
          <div><b>Enzo</b><span className="cs-bar tag"><i ref={H('tag')} /></span><em>{touch ? 'Tap ENZO' : 'Press E'}</em></div>
        </div>
        {!touch && <p className="cs-keys"><b>WASD</b> move · <b>J</b> or click: cut · hold <b>K</b> or right-click: guard · <b>Space</b> dodge · <b>E</b> Enzo · <b>Q</b> next foe · Esc pause</p>}
        {touch && <div className="cs-touchpad">
          <div className="cs-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
          <div className="cs-tbtns">
            <button className="t-tag" {...tb('tag')}>ENZO</button><button className="t-dodge" {...tb('dodge')}>DODGE</button>
            <button className="t-guard" {...guardBtn}>GUARD</button><button className="t-cut" {...tb('attack')}>CUT</button>
          </div>
        </div>}
      </>}
      <div className="cs-banner" ref={H('banner')} />
      {story && !inDuel && <>
        <div className="cs-area"><b>{areaName}</b><span>{w ? `${w.quipus}/${QUIPUS} quipus` : ''}</span></div>
        <div className="cs-near" ref={H('near')} data-on="0"><kbd>{touch ? 'ACT' : 'E'}</kbd><b /></div>
        {!talk && !touch && <p className="cs-keys"><b>WASD</b> walk · <b>E</b> or click: talk, pick up, read · <b>F</b> Enzo&apos;s lantern · <b>Z</b>/<b>C</b> or drag: turn the camera · Esc pause</p>}
        {touch && !talk && <div className="cs-touchpad">
          <div className="cs-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}><i ref={H('knob')} /></div>
          <div className="cs-tbtns">
            <button className="t-lantern" {...tb('lantern')}>LANTERN</button><button className="t-act" {...tb('act')}>ACT</button>
          </div>
        </div>}
        {talk && <div className={`cs-talk${talk.who === 'stone' ? ' cs-narrate' : ''}`} onPointerDown={(e) => { e.stopPropagation(); if (!talk.choosing) taps.current.add('act'); }}>
          {talk.who !== 'stone' && <span className="cs-face"><img src={art(PORTRAIT[talk.who])} alt="" /></span>}
          <div>
            {talk.who !== 'stone' && <b className="cs-who">{NAMES[talk.who]}</b>}
            <p key={talk.text}>{talk.text}</p>
            {talk.choosing ? <div className="cs-choice">
              <button className={choice === 1 ? 'cs-go' : ''} onPointerDown={(e) => e.stopPropagation()} onClick={() => taps.current.add('yes')}>{talk.yes}</button>
              <button className={choice === 2 ? 'cs-go' : ''} onPointerDown={(e) => e.stopPropagation()} onClick={() => taps.current.add('no')}>{talk.no}</button>
            </div> : <em className="cs-more">{touch ? 'Tap' : 'E'} ›</em>}
          </div>
        </div>}
        {toast && !talk && <div className="cs-veil cs-toast-veil"><div className={`cs-card cs-toast cs-k-${ITEMS[toast].kind}`}>
          <p className="cs-eyebrow">{ITEMS[toast].kind === 'quipu' ? `Quipu ${w?.quipus ?? 0} of ${QUIPUS}` : ITEMS[toast].kind === 'sword' ? 'For Dora\'s sword' : 'For Enzo\'s lantern'}</p>
          <h3>{ITEMS[toast].kind === 'quipu' ? 'A knotted cord' : ITEMS[toast].name.replace(/^the /, 'The ')}</h3>
          <p>{ITEMS[toast].text}</p>
          <button className="cs-go" autoFocus onClick={() => { sfx()?.button(); setToast(null); }}>Carry on</button>
        </div></div>}
      </>}
      <button className="cs-pausebtn" onClick={() => setPaused(true)} aria-label="Pause">❚❚</button>
      {fallen && <div className="cs-veil"><div className="cs-card">
        <h2>Dora is down</h2>
        <p>Catch your breath. The {story ? 'duel' : 'round'} starts again on full health, and what you learned stays with you.</p>
        <button className="cs-go" onClick={retry}>Stand up and try the {story ? 'duel' : 'round'} again</button>
        {story ? <button onClick={stepBack}>Step back down the path</button> : <button onClick={quit}>Leave the terrace</button>}
      </div></div>}
      {paused && !fallen && <div className="cs-veil"><div className="cs-card">
        <h2>Paused</h2>
        {story && w && <div className="cs-pack">
          <p><b>{AREAS[w.area].name}</b> · {clock((w.stats.ticks + w.stats.fightTicks) / 60)} on the mountain</p>
          <p>Sword: {ups(SWORD).length ? ups(SWORD).map((i) => ITEMS[i].name.replace(/^the /, '')).join(', ') : 'no upgrades yet'}</p>
          <p>Lantern: {ups(LANTERN_UPS).length ? ups(LANTERN_UPS).map((i) => ITEMS[i].name.replace(/^the /, '')).join(', ') : 'no upgrades yet'}</p>
          <p>Quipus: {w.quipus} of {QUIPUS} · Duels won: {w.wonDuels.size} of 6</p>
        </div>}
        <button className="cs-go" onClick={() => setPaused(false)}>{story && !inDuel ? 'Back to the climb' : 'Back to the fight'}</button>
        <button onClick={() => setSetting('assist', !s.settings.assist)}>Help: {s.settings.assist ? 'on (applies from the next fight)' : 'off (applies from the next fight)'}</button>
        <button onClick={quit}>{story ? 'Save and leave' : 'Leave the terrace (nothing saved)'}</button>
      </div></div>}
    </section>}

    {screen === 'result' && done && <section className="cs-page">
      <div className="cs-card cs-result" data-rank={done.result.rank}>
        <p className="cs-eyebrow">The bridge is yours</p>
        <h2><i className="cs-seal" />{RANK[done.result.rank].name}{done.best && <em> New best</em>}</h2>
        <p>{RANK[done.result.rank].line}</p>
        <dl className="cs-stats">
          <div><dt>Time</dt><dd>{clock(done.result.seconds)}</dd></div>
          <div><dt>Deflects</dt><dd>{done.result.deflects}</dd></div>
          <div><dt>Longest chain</dt><dd>{done.result.bestCombo} hits</dd></div>
          <div><dt>Damage taken</dt><dd>{done.result.damage}</dd></div>
          <div><dt>Falls</dt><dd>{done.result.falls}</dd></div>
          <div><dt>Score</dt><dd>{done.result.score.toLocaleString('en-GB')}</dd></div>
        </dl>
        <div className="cs-row">
          <button className="cs-go" onClick={() => go('ending')}>{done.first ? 'Cross the bridge ›' : 'The Condor Gate ›'}</button>
          <button onClick={startFight}>Fight again</button>
          <button onClick={() => go('title')}>Title</button>
        </div>
      </div>
    </section>}

    {screen === 'ending' && <section className="cs-ending">
      <div className="cs-bg"><img src={art('ending')} alt="At dawn Ukhu bows Dora and Enzo onto the rope bridge towards the Condor Gate" /></div>
      <div className="cs-ending-text">
        <h2>The Condor Gate</h2>
        <p>Ukhu sets down his glaive. “Three hundred winters I have kept this bridge,” he rumbles, “and nobody has turned my blade twice.” He bows them through. Enzo lifts the lantern, Dora wipes the rain from her sword, and the first light finds the gate across the gorge.</p>
        <p className="cs-small">{s.best ? `Your best duel: ${RANK[s.best.rank].name}, ${clock(s.best.seconds)}. ` : ''}The whole road to the gate is the climb: start it from the title.</p>
        <div className="cs-row"><button className="cs-go" onClick={startFight}>Fight again</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'finale' && <section className="cs-ending cs-finale">
      <div className="cs-bg"><img src={art('ending-lamp')} alt="At dawn the Sun Lamp blazes on the Condor Gate and condors circle home while Dora, Enzo and their friends watch" /></div>
      <div className="cs-ending-text">
        <h2>The Sun Lamp burns</h2>
        <p>The ember catches, and the Lamp on the Condor Gate blazes gold through the mist. One by one the condors come home. Far below, Qori puts down her bell.</p>
        {(() => { const st = (s.story ?? {}) as { stats?: { ticks: number; fightTicks: number; deflects: number; falls: number }; got?: string[]; won?: string[] }, got = st.got ?? [], q = got.filter((i) => i.startsWith('q')).length; return <dl className="cs-stats">
          <div><dt>Time on the mountain</dt><dd>{clock(((st.stats?.ticks ?? 0) + (st.stats?.fightTicks ?? 0)) / 60)}</dd></div>
          <div><dt>Duels won</dt><dd>{(st.won ?? []).length} of 6</dd></div>
          <div><dt>Quipus</dt><dd>{q} of {QUIPUS}</dd></div>
          <div><dt>Upgrades</dt><dd>{got.filter((i) => !i.startsWith('q')).length} of 6</dd></div>
          <div><dt>Deflects</dt><dd>{st.stats?.deflects ?? 0}</dd></div>
          <div><dt>Falls</dt><dd>{st.stats?.falls ?? 0}</dd></div>
        </dl>; })()}
        <div className="cs-row"><button className="cs-go" onClick={() => beginStory(true)}>Climb again</button><button onClick={startFight}>Terrace duel</button><button onClick={() => go('title')}>Title</button></div>
      </div>
    </section>}

    {screen === 'howto' && <section className="cs-page">
      <header className="cs-head"><button className="cs-back" onClick={leaveHow}>{fromFight ? 'Start ›' : '‹ Title'}</button><h2>How to play</h2></header>
      <div className="cs-cols">
        <div className="cs-card"><img className="cs-ico" src={art('icon-tag')} alt="" /><h3>Explore</h3><p>{touch ? 'The stick walks; drag the scene to turn the camera.' : <><b>WASD</b> walks; <b>Z</b> and <b>C</b> or a drag turn the camera.</>} <b>{touch ? 'ACT' : 'E or click'}</b> talks to people, picks things up and reads carvings. <b>{touch ? 'LANTERN' : 'F'}</b> has Enzo lift his lantern: it wakes sleeping bridges, sun-stones and jade seals.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-cut')} alt="" /><h3>Cut</h3><p><b>{touch ? 'CUT' : 'J or click'}</b>. Press again for a chain of three; the third is heavy. Dora steps in to the foe she is locked on to. After three cuts a foe turns the next one aside and answers, so be ready to guard.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-guard')} alt="" /><h3>Guard and deflect</h3><p>Hold <b>{touch ? 'GUARD' : 'K or right-click'}</b> to block steel. Press it just as a blow lands, at the <b className="cs-gold">gold glint</b>, to <b>deflect</b>: no harm to you, and the foe’s posture bar fills. Blocking late fills your own guard bar instead.</p></div>
        <div className="cs-card"><img className="cs-ico" src={art('icon-dodge')} alt="" /><h3>Dodge, break, call Enzo</h3><p><b>{touch ? 'DODGE' : 'Space'}</b> rolls. A <b className="cs-jade">jade ring</b> means the blow cannot be guarded: get out or roll through. A full posture bar breaks a foe open: cut then for the finisher. <b>{touch ? 'ENZO' : 'E'}</b> calls Enzo in when his meter is full{touch ? '' : <>; <b>Q</b> switches foe</>}.</p></div>
      </div>
      <p className="cs-small cs-centre">Help is on: foes wind up more slowly, the deflect moment is wider, and a prompt tells you when to guard, dodge or finish. Turn it off in Settings for the full duel.</p>
    </section>}

    {screen === 'settings' && <section className="cs-page">
      <header className="cs-head"><button className="cs-back" onClick={() => go('title')}>‹ Title</button><h2>Settings</h2></header>
      <div className="cs-card cs-settings">
        {([['assist', 'Help', 'Slower wind-ups, a wider deflect moment, less damage, prompts'], ['sound', 'Sound', ''], ['music', 'Music', ''], ['fx', 'Effects', 'Wet-floor reflections and lantern glow. Turn off on a slow device (reloads the page)']] as const).map(([k, name, note]) =>
          <div className="cs-set" key={k}><span><b>{name}</b>{note && <small>{note}</small>}</span><span className="cs-seg">{[true, false].map((v) => <button key={String(v)} className={s.settings[k] === v ? 'on' : ''} aria-pressed={s.settings[k] === v} onClick={() => { setSetting(k, v); if (k === 'fx' && v !== s.settings.fx) location.reload(); }}>{v ? 'On' : 'Off'}</button>)}</span></div>)}
        <p className="cs-small">{s.climbs} climbs · {s.fights} duels · {s.wins} crossings{backend ? ` · drawn with ${backend}` : ''}</p>
        <button className="cs-danger" onClick={() => { if (window.confirm('Clear your Cloudsteel record and your place on the mountain, and start again?')) { const n = G.newSave(); n.settings = s.settings; n.seenHow = s.seenHow; persist(n); } }}>Clear my record</button>
      </div>
    </section>}
  </main>;
}
