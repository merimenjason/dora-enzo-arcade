'use client';

import { useEffect, useRef, useState } from 'react';
import {
  World, MAPS, SIDES, SIDE_IDS, UNITS, BUILDINGS, UPGRADES, ABILITIES, T, TICK_HZ, DIFFICULTIES, buildingsOf,
  type Unit, type Building, type Cmd, type SideId, type Difficulty, type AbilityId,
} from '@/lib/command-game';
import { attachBrains, skirmish } from '@/lib/command-ai';
import {
  MISSIONS, SPEAKERS, SAVE_KEY, startMission, readProfile, recordMission, recordSkirmish, unlocked, totalStars,
  type Mission, type MissionScript, type Profile, type Line, type Speed,
} from '@/lib/command-campaign';
import type { CommandScene, Overlay } from '@/lib/command-scene';
import { CommandSound, type Cue } from './sound';
import './command.css';

type Screen = 'title' | 'skirmish' | 'campaign' | 'brief' | 'play' | 'end';
type Mode = { k: 'move' | 'amove' | 'patrol' | 'rally' | 'tunnel' } | { k: 'ability'; ab: AbilityId } | { k: 'build'; type: string } | null;
type Btn = { key: string; label: string; icon?: string; pic?: { kind: 'unit' | 'bld'; side: string; type: string }; cost?: [number, number]; tip: string; off?: string; on?: boolean; run: () => void };
type EndInfo = { won: boolean; why: string; stars: [boolean, boolean, boolean] | null; secs: number; stats: World['players'][number]['stats']; news: string };
type Toast = { id: number; text: string; at: number; tone: 'info' | 'warn' | 'good' };

const ART = '/art/command/';
const DIFF_NAME: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
const DIFF_BLURB: Record<Difficulty, string> = { easy: 'Slow to build, sends small groups.', normal: 'A fair match for most commanders.', hard: 'Quick, greedy and always pushing.' };
const UP_ICON: Record<string, string> = { dmg: '✦', armor: '◈', speed: '➶', wind: '⚙', regen: '✚' };
const ORDER_ICON: Record<string, string> = { move: '➜', stop: '■', hold: '⛉', attack: '✸', patrol: '⇄', build: '⌂', return: '⤺', tunnel: '◎', rally: '⚑', cancel: '✕', back: '↩' };
const STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
const STEP = 1 / TICK_HZ;

/** A drawn stand-in for a missing painting, made once and kept as a data URL. */
const drawnPics = new Map<string, string>();

export default function BurrowCommandPage() {
  const canvas = useRef<HTMLCanvasElement>(null), mini = useRef<HTMLCanvasElement>(null), hudEl = useRef<HTMLElement>(null);
  const scene = useRef<CommandScene | null>(null), sound = useRef<CommandSound | null>(null);
  const world = useRef<World | null>(null), script = useRef<MissionScript | null>(null), mission = useRef<Mission | null>(null);
  const profile = useRef<Profile>(readProfile(null));
  const screenRef = useRef<Screen>('title'), pausedRef = useRef(false);
  const sel = useRef(new Set<number>()), groups = useRef(new Map<number, number[]>()), mode = useRef<Mode>(null), buildMenu = useRef(false);
  const overlay = useRef<Overlay>({ me: 0, sel: sel.current, hover: 0, box: null, ghost: null, marks: [], aim: null });
  const mouse = useRef({ x: -1, y: -1, inside: false }), keys = useRef(new Set<string>());
  const dialog = useRef<{ line: Line; until: number }[]>([]), toasts = useRef<Toast[]>([]), lastAlert = useRef<[number, number] | null>(null);
  const selectMode = useRef(false), endAt = useRef(0), lastGroup = useRef({ n: -1, at: 0 }), lastClick = useRef({ id: 0, at: 0 });
  const [screen, setScreenState] = useState<Screen>('title');
  const [paused, setPaused] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState('');
  const [missionId, setMissionId] = useState(MISSIONS[0].id), [end, setEnd] = useState<EndInfo | null>(null), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const setScreen = (s: Screen) => { screenRef.current = s; setScreenState(s); };
  const P = profile.current, S = P.settings;

  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile.current)); } catch { /* storage is optional */ } };
  const audio = () => { sound.current ??= new CommandSound(profile.current.settings.mute); sound.current.unlock(); return sound.current; };
  const cue = (c: Cue, side?: string) => sound.current?.play(c, side ?? world.current?.players[0].side);
  const toast = (text: string, tone: Toast['tone'] = 'info') => {
    const now = performance.now();
    if (toasts.current.some((t) => t.text === text && now - t.at < 2500)) return;
    toasts.current = [...toasts.current.slice(-3), { id: now, text, at: now, tone }];
  };
  const setting = <K extends keyof Profile['settings']>(k: K, v: Profile['settings'][K]) => {
    profile.current = { ...profile.current, settings: { ...profile.current.settings, [k]: v } }; save();
    if (k === 'mute') audio().setMuted(v as boolean);
    refresh();
  };

  // ---------------------------------------------------------------- starting and ending
  function begin(w: World, m: Mission | null, sc: MissionScript | null) {
    world.current = w; mission.current = m; script.current = sc;
    sel.current.clear(); groups.current.clear(); mode.current = null; buildMenu.current = false;
    overlay.current.marks = []; overlay.current.box = null; overlay.current.ghost = null; overlay.current.aim = null;
    dialog.current = []; toasts.current = []; lastAlert.current = null; endAt.current = 0;
    pausedRef.current = false; setPaused(false); setEnd(null);
    const s = scene.current;
    if (s) {
      s.preload(w); s.cam.z = window.innerWidth < 700 ? 0.8 : 1;
      s.padTop = 44; s.padBottom = hudEl.current?.offsetHeight ?? (window.innerWidth < 760 ? 200 : 174);
      const hq = w.buildings.find((b) => b.owner === 0 && b.def.hq), u = w.units.find((x) => x.owner === 0 && !w.frozen.has(x.id));
      const at = hq ?? u; if (at) s.look(w, at.x, at.y + T * 2);
    }
    setScreen('play'); canvas.current?.focus();
  }
  function startSkirmish() {
    audio(); cue('click');
    const s = profile.current.settings, map = MAPS.find((m) => m.id === s.map) ?? MAPS[0];
    const seed = (Date.now() % 1000003) + 1;
    const w = attachBrains(new World(skirmish({ map, seed, sides: [s.side, s.foe], ai: [null, s.diff] })));
    w.players[0].name = 'You'; w.players[1].name = `${SIDES[s.foe].short} (${DIFF_NAME[s.diff]})`;
    begin(w, null, null);
    if (s.hints) toast('Drag to pick units, right-click to send them. Select a gatherer and press B to build.');
  }
  function startMissionPlay(m: Mission) {
    audio(); cue('click');
    const { w, script: sc } = startMission(m, (Date.now() % 1000003) + 1);
    begin(w, m, sc);
  }
  function brief(id: string) { audio(); cue('click'); setMissionId(id); setScreen('brief'); }
  function finish() {
    const w = world.current; if (!w || !w.result) return;
    const me = w.players[0], sc = script.current, m = mission.current;
    let won = w.result.winner === me.team, why = '', stars: EndInfo['stars'] = null, news = '';
    if (m && sc?.outcome) {
      won = sc.outcome.win; why = sc.outcome.why; stars = sc.outcome.stars;
      const before = profile.current.stars[m.id] ?? 0;
      profile.current = recordMission(profile.current, m.id, sc.outcome.stars, sc.outcome.secs);
      const after = profile.current.stars[m.id] ?? 0;
      if (won && after > before) news = before ? `New best: ${STARS(after)}` : m.n < MISSIONS.length ? `Mission ${m.n + 1} is open!` : 'The whole campaign is won!';
    } else {
      why = won ? (w.result.reason === 'time' ? 'Time ran out and your side had the most to show for it.' : 'Every rival building has been tidied away.') : (w.result.reason === 'time' ? 'Time ran out and the other side had more to show for it.' : 'Your last building was tidied away.');
      profile.current = recordSkirmish(profile.current, me.side, won);
    }
    save();
    setEnd({ won, why, stars, secs: Math.round(w.tick / TICK_HZ), stats: { ...me.stats }, news });
    setScreen('end'); cue(won ? 'win' : 'lose');
  }
  function quit() { world.current = null; script.current = null; pausedRef.current = false; setPaused(false); setScreen(mission.current ? 'campaign' : 'title'); }
  function restart() { const m = mission.current; if (m) startMissionPlay(m); else startSkirmish(); }
  function pause(on: boolean) {
    if (screenRef.current !== 'play') return;
    pausedRef.current = on; setPaused(on); keys.current.clear();
    if (!on) canvas.current?.focus();
  }

  // ---------------------------------------------------------------- the selection
  const W = () => world.current!;
  const mine = (id: number) => { const w = world.current, e = w?.get(id); return !!e && e.kind !== 'node' && e.owner === 0 && !w!.frozen.has(id); };
  function selected() {
    const w = world.current; if (!w) return { units: [] as Unit[], blds: [] as Building[], other: null as Unit | Building | null };
    const units: Unit[] = [], blds: Building[] = []; let other: Unit | Building | null = null;
    for (const id of sel.current) {
      const e = w.get(id);
      if (!e || e.kind === 'node' || (e.kind === 'unit' && e.under && e.owner !== 0)) { sel.current.delete(id); continue; }
      if (e.owner !== 0 || w.frozen.has(id)) { other = e; continue; }
      if (e.kind === 'unit') units.push(e); else blds.push(e);
    }
    return { units, blds, other };
  }
  function choose(ids: number[], add = false) {
    if (!add) sel.current.clear();
    for (const id of ids) sel.current.add(id);
    mode.current = null; buildMenu.current = false;
    const w = world.current, first = ids.map((id) => w?.get(id)).find(Boolean);
    if (first && first.kind !== 'node') cue('select', first.def.side);
    refresh();
  }
  function clickSelect(px: number, py: number, add: boolean) {
    const w = world.current, s = scene.current; if (!w || !s) return;
    const e = w.pick(s.wx(px), s.wy(py), 0);
    if (!e || e.kind === 'node') { if (!add) { sel.current.clear(); refresh(); } return; }
    const now = performance.now(), dbl = lastClick.current.id === e.id && now - lastClick.current.at < 350;
    lastClick.current = { id: e.id, at: now };
    if (e.owner !== 0 || w.frozen.has(e.id)) { choose([e.id]); return; }
    if (dbl) { choose(onScreen().filter((x) => x.type === e.type).map((x) => x.id)); return; }
    if (add && sel.current.has(e.id)) { sel.current.delete(e.id); refresh(); return; }
    if (add && [...sel.current].some((id) => !mine(id))) sel.current.clear();
    choose([e.id], add);
  }
  /** Own pieces whose feet are on the screen. */
  function onScreen() {
    const w = W(), s = scene.current!;
    const list: (Unit | Building)[] = [];
    for (const u of w.units) if (u.owner === 0 && !u.under && !w.frozen.has(u.id)) { const x = s.sx(u.x), y = s.sy(u.y); if (x > 0 && y > 0 && x < s.w && y < s.h) list.push(u); }
    for (const b of w.buildings) if (b.owner === 0) { const x = s.sx(b.x), y = s.sy(b.y); if (x > 0 && y > 0 && x < s.w && y < s.h) list.push(b); }
    return list;
  }
  function boxSelect(ax: number, ay: number, bx: number, by: number, add: boolean) {
    const w = W(), s = scene.current!;
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const units = w.units.filter((u) => u.owner === 0 && !u.under && !w.frozen.has(u.id) && (() => { const x = s.sx(u.x), y = s.sy(u.y) - (u.def.air ? s.tp * 0.9 : 0); return x >= x0 && x <= x1 && y >= y0 && y <= y1; })());
    if (units.length) {
      // an army in the box leaves the gatherers alone
      const army = units.filter((u) => !u.def.worker);
      choose((army.length ? army : units).map((u) => u.id), add);
      return;
    }
    const blds = w.buildings.filter((b) => b.owner === 0 && (() => { const x = s.sx(b.x), y = s.sy(b.y); return x >= x0 && x <= x1 && y >= y0 && y <= y1; })());
    if (blds.length) choose(blds.filter((b) => b.type === blds[0].type).map((b) => b.id), add);
    else if (!add) { sel.current.clear(); refresh(); }
  }

  // ---------------------------------------------------------------- orders
  function issue(c: Cmd, x?: number, y?: number, color = '#bff5c4') {
    const w = world.current; if (!w) return;
    w.issue(c);
    if (x !== undefined && y !== undefined) overlay.current.marks.push({ x, y, t: 0, color });
  }
  const unitIds = () => selected().units.map((u) => u.id);
  /** A right-click (or a tap) on the field: the usual order for what is under it. */
  function smartAt(px: number, py: number, queue: boolean) {
    const w = world.current, s = scene.current; if (!w || !s) return;
    const x = s.wx(px), y = s.wy(py), { units, blds } = selected();
    if (units.length) {
      const c = w.smart(0, units.map((u) => u.id), x, y, queue);
      issue(c, x, y, c.k === 'attack' ? '#ff9a8a' : c.k === 'gather' ? '#ffe08a' : '#bff5c4');
      cue('order', units[0].def.side);
      return;
    }
    if (blds.length && blds.some((b) => b.def.trains.length)) { issue({ p: 0, k: 'rally', bids: blds.map((b) => b.id), x, y }, x, y, '#ffffff'); cue('order'); }
  }
  /** A left-click while an order waits for its spot. */
  function applyMode(px: number, py: number, queue: boolean) {
    const w = world.current, s = scene.current, m = mode.current; if (!w || !s || !m) return;
    const x = s.wx(px), y = s.wy(py), ids = unitIds();
    if (m.k === 'build') {
      const d = BUILDINGS[m.type], tx = Math.floor(x / T - d.size / 2 + 0.5), ty = Math.floor(y / T - d.size / 2 + 0.5), p = w.players[0];
      if (!w.canPlace(0, m.type, tx, ty, true)) { toast('That spot is not clear (or not explored yet).', 'warn'); cue('error'); return; }
      if (p.hay < d.hay || p.glimmer < d.glimmer) { toast(p.hay < d.hay ? 'Not enough hay.' : 'Not enough glimmer.', 'warn'); cue('error'); return; }
      const workers = selected().units.filter((u) => u.def.worker).map((u) => u.id);
      issue({ p: 0, k: 'build', ids: workers, b: m.type, tx, ty, q: queue }, x, y, '#ffe08a'); cue('place');
      if (!queue) { mode.current = null; buildMenu.current = false; }
      refresh(); return;
    }
    if (m.k === 'rally') { issue({ p: 0, k: 'rally', bids: selected().blds.map((b) => b.id), x, y }, x, y, '#ffffff'); cue('order'); }
    else if (m.k === 'tunnel') {
      const t = w.pick(x, y, 0);
      if (!t || t.kind !== 'building' || t.owner !== 0 || !t.def.tunnel || !t.done) { toast('Pick a finished Tunnel Mound or the Great Burrow.', 'warn'); cue('error'); return; }
      issue({ p: 0, k: 'tunnel', ids, t: t.id, q: queue }, t.x, t.y, '#d8b07a'); cue('order');
    } else if (m.k === 'ability') {
      const casters = selected().units.filter((u) => u.def.ability === m.ab);
      issue({ p: 0, k: 'ability', ids: casters.map((u) => u.id), ab: m.ab, x, y, q: queue }, x, y, '#ffe9a8'); cue('order');
    } else if (m.k === 'amove') {
      const t = w.pick(x, y, 0);
      if (t && t.kind !== 'node' && w.enemies(0, t.owner)) issue({ p: 0, k: 'attack', ids, t: t.id, q: queue }, x, y, '#ff9a8a');
      else issue({ p: 0, k: 'amove', ids, x, y, q: queue }, x, y, '#ff9a8a');
      cue('order');
    } else { issue({ p: 0, k: m.k, ids, x, y, q: queue }, x, y, m.k === 'patrol' ? '#9fd2ff' : '#bff5c4'); cue('order'); }
    if (!queue) mode.current = null;
    refresh();
  }
  function train(blds: Building[], u: string) {
    const w = W(), p = w.players[0], d = UNITS[u];
    if (p.hay < d.hay) { toast('Not enough hay.', 'warn'); cue('error'); return; }
    if (p.glimmer < d.glimmer) { toast('Not enough glimmer.', 'warn'); cue('error'); return; }
    if (d.limit && w.countOf(0, u) >= d.limit) { toast(`Only ${d.limit} ${d.name} at a time.`, 'warn'); cue('error'); return; }
    const b = [...blds].filter((x) => x.done && x.def.trains.includes(u) && x.queue.length < 5).sort((a, c) => a.queue.length - c.queue.length)[0];
    if (!b) { toast('The queue is full (five at most).', 'warn'); cue('error'); return; }
    // spend now in the HUD so a burst of clicks cannot overspend before the next tick
    issue({ p: 0, k: 'train', bid: b.id, u }); cue('click');
  }
  function research(b: Building, up: string) {
    const w = W(), p = w.players[0], d = UPGRADES[up];
    if (p.ups[up] !== undefined) return;
    if (p.hay < d.hay || p.glimmer < d.glimmer) { toast(p.hay < d.hay ? 'Not enough hay.' : 'Not enough glimmer.', 'warn'); cue('error'); return; }
    issue({ p: 0, k: 'research', bid: b.id, up }); cue('click');
  }
  function setMode(m: Mode) { mode.current = m; buildMenu.current = m?.k === 'build' ? buildMenu.current : false; cue('click'); refresh(); }

  /** The command card for what is selected. */
  function commands(): Btn[] {
    const w = world.current; if (!w) return [];
    const { units, blds } = selected(), p = w.players[0], side = p.side;
    const out: Btn[] = [];
    if (units.length) {
      const workers = units.filter((u) => u.def.worker);
      if (buildMenu.current && workers.length) {
        for (const d of buildingsOf(side)) {
          const need = d.req.filter((r) => !w.has(p, r)).map((r) => BUILDINGS[r].name);
          out.push({ key: d.key, label: d.name, pic: { kind: 'bld', side, type: d.id }, cost: [d.hay, d.glimmer], tip: d.blurb, off: need.length ? `Needs a ${need.join(' and ')}` : undefined, on: mode.current?.k === 'build' && mode.current.type === d.id, run: () => setMode({ k: 'build', type: d.id }) });
        }
        out.push({ key: 'Escape', label: 'Back', icon: ORDER_ICON.back, tip: 'Back to the orders.', run: () => { buildMenu.current = false; mode.current = null; refresh(); } });
        return out;
      }
      const ids = units.map((u) => u.id);
      out.push({ key: 'M', label: 'Move', icon: ORDER_ICON.move, tip: 'Walk to a spot, ignoring grumpy units on the way.', on: mode.current?.k === 'move', run: () => setMode({ k: 'move' }) });
      out.push({ key: 'S', label: 'Stop', icon: ORDER_ICON.stop, tip: 'Stop and stand ready.', run: () => { issue({ p: 0, k: 'stop', ids }); cue('order'); } });
      out.push({ key: 'H', label: 'Hold', icon: ORDER_ICON.hold, tip: 'Hold this ground: bump anyone in reach but never chase.', run: () => { issue({ p: 0, k: 'hold', ids }); cue('order'); } });
      if (units.some((u) => u.def.dmg > 0)) {
        out.push({ key: 'A', label: 'Attack', icon: ORDER_ICON.attack, tip: 'Click a rival to bump it, or the ground to march there bumping anything on the way.', on: mode.current?.k === 'amove', run: () => setMode({ k: 'amove' }) });
        out.push({ key: 'P', label: 'Patrol', icon: ORDER_ICON.patrol, tip: 'Walk back and forth between here and a spot, bumping anyone who comes by.', on: mode.current?.k === 'patrol', run: () => setMode({ k: 'patrol' }) });
      }
      if (workers.length) {
        out.push({ key: 'B', label: 'Build', icon: ORDER_ICON.build, tip: 'Choose a building to put down.', run: () => { buildMenu.current = true; cue('click'); refresh(); } });
        if (workers.some((u) => u.carry > 0)) out.push({ key: 'R', label: 'Return', icon: ORDER_ICON.return, tip: 'Carry what you hold home.', run: () => { issue({ p: 0, k: 'return', ids }); cue('order'); } });
      }
      const abs = [...new Set(units.map((u) => u.def.ability).filter((a): a is AbilityId => !!a))];
      const abKeys = ['F', 'G', 'V'];
      abs.slice(0, 3).forEach((ab, i) => {
        const A = ABILITIES[ab], casters = units.filter((u) => u.def.ability === ab), ready = casters.some((u) => u.abCd <= 0), wait = Math.min(...casters.map((u) => u.abCd));
        out.push({
          key: abKeys[i], label: A.name, icon: ab === 'unpack' ? '⌂' : '✧', tip: A.blurb, off: ready ? undefined : `Ready in ${Math.ceil(wait / TICK_HZ)} s`, on: mode.current?.k === 'ability' && mode.current.ab === ab,
          run: () => {
            if (A.range > 0) { setMode({ k: 'ability', ab }); return; }
            issue({ p: 0, k: 'ability', ids: casters.map((u) => u.id), ab }); cue('ability');
          },
        });
      });
      if (side === 'colony' && units.some((u) => !u.def.air) && w.buildings.some((b) => b.owner === 0 && b.def.tunnel && b.done)) out.push({ key: 'T', label: 'Tunnel', icon: ORDER_ICON.tunnel, tip: ABILITIES.tunnel.blurb, on: mode.current?.k === 'tunnel', run: () => setMode({ k: 'tunnel' }) });
      return out;
    }
    if (blds.length) {
      const b = blds[0], d = b.def;
      if (!b.done) { out.push({ key: 'X', label: 'Cancel', icon: ORDER_ICON.cancel, tip: 'Stop building and get 75% back.', run: () => { issue({ p: 0, k: 'cancel', bid: b.id }); cue('click'); } }); return out; }
      for (const u of d.trains) {
        const ud = UNITS[u];
        out.push({ key: ud.key, label: ud.name, pic: { kind: 'unit', side: ud.side, type: u }, cost: [ud.hay, ud.glimmer], tip: `${ud.blurb} (${ud.supply} room)`, run: () => train(blds, u) });
      }
      for (const up of d.research) {
        const ud = UPGRADES[up], state = p.ups[up];
        out.push({ key: ud.key, label: ud.name, icon: UP_ICON[Object.keys(ud.effect)[0]] ?? '✦', cost: [ud.hay, ud.glimmer], tip: ud.blurb, off: state === true ? 'Done' : state === false ? 'Being studied' : undefined, run: () => research(b, up) });
      }
      if (d.ability) {
        const A = ABILITIES[d.ability], wait = b.abCd;
        out.push({ key: 'F', label: A.name, icon: '✧', tip: A.blurb, off: wait > 0 ? `Ready in ${Math.ceil(wait / TICK_HZ)} s` : d.ability === 'pack' && b.queue.length ? 'Finish the queue first' : undefined, run: () => { issue({ p: 0, k: 'ability', ids: blds.map((x) => x.id), ab: d.ability! }); cue('ability'); } });
      }
      if (d.trains.length) out.push({ key: 'Y', label: 'Rally', icon: ORDER_ICON.rally, tip: 'Where new units walk to (or right-click). Rally on a meadow to send gatherers straight to work.', on: mode.current?.k === 'rally', run: () => setMode({ k: 'rally' }) });
      if (b.queue.length) out.push({ key: 'X', label: 'Cancel last', icon: ORDER_ICON.cancel, tip: 'Take the last thing off the queue, with a full refund.', run: () => { issue({ p: 0, k: 'cancel', bid: b.id }); cue('click'); } });
    }
    return out;
  }

  // ---------------------------------------------------------------- the loop
  function handleEvents(w: World) {
    const team = w.players[0].team, side = w.players[0].side;
    for (const e of w.events) {
      switch (e.k) {
        case 'say': dialog.current.push({ line: { who: e.who as Line['who'], text: e.text }, until: 0 }); break;
        case 'alert': if (e.owner === 0) { lastAlert.current = [e.x, e.y]; toast('We are being bumped! (Space to look)', 'warn'); cue('alert'); } break;
        case 'msg': if (e.owner === 0) { toast(e.text, 'warn'); cue('error'); } break;
        case 'built': if (e.owner === 0) { toast(`${BUILDINGS[e.type].name} is ready.`, 'good'); cue('built'); } break;
        case 'trained': if (e.owner === 0) cue('trained', side); break;
        case 'research': if (e.owner === 0) { toast(`${UPGRADES[e.up].name} learned!`, 'good'); cue('research'); } break;
        case 'poof': if (w.seen(team, e.x, e.y)) cue('poof'); break;
        case 'tidy': if (w.seen(team, e.x, e.y)) cue('tidy'); if (e.owner === 0) toast(`Our ${BUILDINGS[e.type].name} was tidied away.`, 'warn'); break;
        case 'hit': if (w.seen(team, e.x, e.y)) cue('hit'); break;
        case 'ability': if (w.seen(team, e.x, e.y)) cue('ability'); break;
        case 'tunnel': if (e.owner === 0) cue('tunnel'); break;
        case 'trap': if (w.seen(team, e.x, e.y)) cue('trap'); break;
        case 'out': if (e.owner !== 0) toast(`${w.players[e.owner].name} has gone home.`, 'good'); break;
      }
    }
    scene.current?.feed(w, w.events, 0);
  }

  useEffect(() => {
    profile.current = readProfile((() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })());
    sound.current = new CommandSound(profile.current.settings.mute);
    const hook = window as unknown as { __command: () => World | null; __commandStart: (kind: 'skirmish' | 'mission', id?: string) => void };
    hook.__command = () => world.current;
    // for the browser tests: where a world point is on the screen
    (window as unknown as { __commandAt: (x: number, y: number) => [number, number] }).__commandAt = (x, y) => [scene.current?.sx(x) ?? 0, scene.current?.sy(y) ?? 0];
    hook.__commandStart = (kind, id) => { if (kind === 'mission') startMissionPlay(MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]); else startSkirmish(); };
    refresh();
    let dead = false, raf = 0, last = 0, ui = 0, acc = 0;
    const resize = () => { scene.current?.resize(); if (world.current) scene.current?.clamp(world.current); };
    import('@/lib/command-scene').then(({ CommandScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new CommandScene(canvas.current); } catch { setError('This browser cannot draw the battlefield.'); return; }
      window.addEventListener('resize', resize);
      for (const n of ['title', 'brief-meadow', 'portrait-dora', 'portrait-enzo']) scene.current.img(n);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.1, (ms - last) / 1000) : 0; last = ms;
        const sc = scene.current!, w = world.current, scr = screenRef.current;
        if (w && (scr === 'play' || scr === 'end')) {
          if (scr === 'play' && !pausedRef.current) {
            // camera: arrow keys and the screen's edges
            const k = keys.current, sp = 900 * dt;
            let dx = (k.has('arrowright') ? 1 : 0) - (k.has('arrowleft') ? 1 : 0), dy = (k.has('arrowdown') ? 1 : 0) - (k.has('arrowup') ? 1 : 0);
            const m = mouse.current;
            if (profile.current.settings.edge && m.inside && !overlay.current.box) {
              if (m.x < 12) dx = -1; else if (m.x > sc.w - 12) dx = 1;
              if (m.y < 12) dy = -1; else if (m.y > sc.h - 12) dy = 1;
            }
            if (dx || dy) sc.pan(w, dx * sp, dy * sp);
            sc.padTop = 44; sc.padBottom = hudEl.current?.offsetHeight ?? 0;
            // the simulation runs in fixed 1/20 s ticks
            if (!w.result) {
              acc += dt * profile.current.settings.speed;
              let n = 0;
              while (acc >= STEP && n < 6) { acc -= STEP; n++; w.step(); handleEvents(w); if (w.result) break; }
              if (n === 6) acc = 0;
            }
            if (w.result && !endAt.current) endAt.current = ms + 1800;
            if (endAt.current && ms >= endAt.current) { endAt.current = 0; finish(); }
            // the dialogue box: each line stays long enough to read
            const d = dialog.current[0];
            if (d) { if (!d.until) { d.until = ms + Math.max(3500, d.line.text.length * 55); cue('say'); } else if (ms > d.until) dialog.current.shift(); }
            toasts.current = toasts.current.filter((t) => ms - t.at < 4200);
          }
          // the ghost of a building being placed, and the reach of an aimed ability
          const md = mode.current, o = overlay.current, m = mouse.current;
          o.ghost = null; o.aim = null;
          if (md && m.inside && scr === 'play') {
            const x = sc.wx(m.x), y = sc.wy(m.y);
            if (md.k === 'build') { const d = BUILDINGS[md.type], tx = Math.floor(x / T - d.size / 2 + 0.5), ty = Math.floor(y / T - d.size / 2 + 0.5); o.ghost = { type: md.type, tx, ty, ok: w.canPlace(0, md.type, tx, ty, true) }; }
            else if (md.k === 'ability' && ABILITIES[md.ab].radius) o.aim = { x, y, r: ABILITIES[md.ab].radius * T };
          }
          for (const mk of o.marks) mk.t += dt;
          o.marks = o.marks.filter((mk) => mk.t < 0.7);
          for (const id of [...sel.current]) if (!w.get(id)) sel.current.delete(id);
          sc.draw(w, 0, o, pausedRef.current ? 0 : dt);
          if (mini.current) sc.minimap(mini.current, w, 0);
        } else sc.draw(menuWorld(), 0, { me: 0, sel: new Set(), hover: 0, box: null, ghost: null, marks: [], aim: null }, dt);
        if (ms - ui > 120) { ui = ms; refresh(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The battlefield could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      audio();
      const k = e.key.toLowerCase(), scr = screenRef.current;
      if (scr !== 'play') { if (k === 'escape' && (scr === 'skirmish' || scr === 'campaign')) setScreen('title'); else if (k === 'escape' && scr === 'brief') setScreen('campaign'); return; }
      if (k.startsWith('arrow')) { e.preventDefault(); keys.current.add(k); return; }
      if (k === 'escape') {
        if (mode.current) { mode.current = null; refresh(); return; }
        if (buildMenu.current) { buildMenu.current = false; refresh(); return; }
        pause(!pausedRef.current); return;
      }
      if (pausedRef.current || e.repeat) return;
      const digit = /^Digit([0-9])$/.exec(e.code);
      if (digit) {
        const n = +digit[1];
        if (e.ctrlKey || e.metaKey || e.altKey) { e.preventDefault(); const ids = [...sel.current].filter(mine); groups.current.set(n, ids); toast(`Group ${n} set (${ids.length}).`); cue('click'); return; }
        const ids = (groups.current.get(n) ?? []).filter((id) => world.current?.get(id));
        if (!ids.length) return;
        if (e.shiftKey) { choose(ids, true); return; }
        const now = performance.now();
        if (lastGroup.current.n === n && now - lastGroup.current.at < 400) { const f = world.current!.get(ids[0]); if (f && f.kind !== 'node') scene.current?.look(W(), f.x, f.y); }
        lastGroup.current = { n, at: now };
        choose(ids); return;
      }
      if (k === ' ') { e.preventDefault(); const a = lastAlert.current; if (a) scene.current?.look(W(), a[0], a[1]); return; }
      if (k === '.') { idleWorker(); return; }
      if (k === 'backspace' || k === 'home') { e.preventDefault(); const hq = W().buildings.find((b) => b.owner === 0 && b.def.hq); if (hq) { scene.current?.look(W(), hq.x, hq.y); choose([hq.id]); } return; }
      if (k === '+' || k === '=') { scene.current?.zoom(W(), 1.15); return; }
      if (k === '-') { scene.current?.zoom(W(), 1 / 1.15); return; }
      const btn = commands().find((b) => b.key.toLowerCase() === k);
      if (btn) { e.preventDefault(); if (btn.off) { toast(btn.off, 'warn'); cue('error'); } else btn.run(); refresh(); }
    };
    const keyup = (e: KeyboardEvent) => { keys.current.delete(e.key.toLowerCase()); };
    const blur = () => { keys.current.clear(); mouse.current.inside = false; if (screenRef.current === 'play') pause(true); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => {
      dead = true; cancelAnimationFrame(raf); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A quiet match drawn behind the menus: the first map, two computer sides building up. */
  const menuW = useRef<World | null>(null), menuAt = useRef(0);
  function menuWorld() {
    let w = menuW.current;
    if (!w || w.result || w.tick > 20 * 60 * 6) {
      w = attachBrains(new World(skirmish({ map: MAPS[0], seed: 7, sides: ['colony', 'hive'], ai: ['normal', 'normal'], fog: false })));
      menuW.current = w; scene.current?.preload(w);
      scene.current!.cam.z = 1; scene.current!.look(w, (w.W / 2) * T, (w.H / 2) * T);
    }
    const now = performance.now();
    if (now - menuAt.current > 50) { menuAt.current = now; w.step(); }
    const s = scene.current!; s.padTop = 0; s.padBottom = 0; s.pan(w, 0.25, 0.12);
    return w;
  }
  function idleWorker() {
    const w = world.current; if (!w) return;
    const idle = w.units.filter((u) => u.owner === 0 && u.def.worker && !u.order && !u.under && !w.frozen.has(u.id));
    if (!idle.length) { toast('Every gatherer is busy.'); return; }
    const cur = [...sel.current][0], i = idle.findIndex((u) => u.id === cur), u = idle[(i + 1) % idle.length];
    choose([u.id]); scene.current?.look(w, u.x, u.y);
  }

  // ---------------------------------------------------------------- pointer input
  type Ptr = { x: number; y: number; sx: number; sy: number; touch: boolean; button: number; moved: boolean };
  const ptrs = useRef(new Map<number, Ptr>()), pinch = useRef<{ d: number; cx: number; cy: number } | null>(null), pinched = useRef(false);
  const local = (e: React.PointerEvent | React.WheelEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || pausedRef.current || !world.current) return;
    audio(); e.preventDefault();
    const [x, y] = local(e), touch = e.pointerType === 'touch';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x, y, sx: x, sy: y, touch, button: e.button, moved: false });
    if (touch) {
      if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; pinched.current = true; overlay.current.box = null; }
      else if (ptrs.current.size === 1) pinched.current = false;
      return;
    }
    if (e.button === 2) { if (mode.current) { mode.current = null; refresh(); } else smartAt(x, y, e.shiftKey); return; }
    if (e.button === 0) { if (mode.current) applyMode(x, y, e.shiftKey); else overlay.current.box = [x, y, x, y]; }
  };
  const onMove = (e: React.PointerEvent) => {
    const [x, y] = local(e), w = world.current, s = scene.current;
    if (e.pointerType === 'mouse') { mouse.current = { x, y, inside: true }; if (w && s && screenRef.current === 'play') { const h = w.pick(s.wx(x), s.wy(y), 0); overlay.current.hover = h && h.kind !== 'node' ? h.id : 0; } }
    const p = ptrs.current.get(e.pointerId); if (!p || !w || !s) return;
    const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
    if (Math.hypot(x - p.sx, y - p.sy) > 9) p.moved = true;
    if (p.touch) {
      if (ptrs.current.size >= 2 && pinch.current) {
        const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        s.pan(w, pinch.current.cx - cx, pinch.current.cy - cy); if (pinch.current.d > 20) s.zoom(w, d / pinch.current.d, cx, cy);
        pinch.current = { d, cx, cy }; return;
      }
      if (!p.moved || pinched.current) return;
      if (selectMode.current || mode.current) overlay.current.box = [p.sx, p.sy, x, y];
      else s.pan(w, -dx, -dy);
      return;
    }
    if (p.button === 1) { s.pan(w, -dx, -dy); return; }
    if (p.button === 0 && overlay.current.box) overlay.current.box = [p.sx, p.sy, x, y];
  };
  const onUp = (e: React.PointerEvent) => {
    const p = ptrs.current.get(e.pointerId); ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (!p || !world.current || screenRef.current !== 'play' || pausedRef.current) { overlay.current.box = null; return; }
    const [x, y] = local(e), box = overlay.current.box; overlay.current.box = null;
    if (p.touch) {
      if (pinched.current) { if (!ptrs.current.size) pinched.current = false; return; }
      if (box && p.moved && Math.abs(box[2] - box[0]) + Math.abs(box[3] - box[1]) > 12) { boxSelect(box[0], box[1], box[2], box[3], false); return; }
      if (p.moved) return;
      tap(x, y); return;
    }
    if (p.button !== 0 || !box) return;
    if (Math.abs(box[2] - box[0]) + Math.abs(box[3] - box[1]) > 8) boxSelect(box[0], box[1], box[2], box[3], e.shiftKey);
    else clickSelect(x, y, e.shiftKey || e.ctrlKey);
  };
  /** A finger tap: orders for the selection, or a new selection. */
  function tap(x: number, y: number) {
    const w = W(), s = scene.current!;
    if (mode.current) { applyMode(x, y, false); return; }
    const e = w.pick(s.wx(x), s.wy(y), 0), { units, blds } = selected();
    const own = e && e.kind !== 'node' && e.owner === 0 && !w.frozen.has(e.id);
    const helps = own && e.kind === 'building' && !e.done && units.some((u) => u.def.worker);
    if ((units.length || blds.length) && (!own || helps)) { smartAt(x, y, false); return; }
    if (e && e.kind !== 'node') clickSelect(x, y, false);
    else { sel.current.clear(); refresh(); }
  }
  const onWheel = (e: React.WheelEvent) => { const w = world.current; if (!w || screenRef.current !== 'play') return; const [x, y] = local(e); scene.current?.zoom(w, e.deltaY < 0 ? 1.1 : 1 / 1.1, x, y); };
  // the minimap: drag to look, right-click to send the selection
  const miniDrag = useRef(false);
  const miniAt = (e: React.PointerEvent) => { const r = mini.current!.getBoundingClientRect(); return scene.current!.miniToWorld(mini.current!, W(), e.clientX - r.left, e.clientY - r.top); };
  const onMiniDown = (e: React.PointerEvent) => {
    if (!world.current || !scene.current || pausedRef.current) return;
    e.preventDefault(); audio();
    const [x, y] = miniAt(e);
    if (e.button === 2 || (e.pointerType === 'touch' && sel.current.size && mode.current)) {
      const ids = unitIds(); if (ids.length) { issue(e.button === 2 ? W().smart(0, ids, x, y, e.shiftKey) : { p: 0, k: 'move', ids, x, y }, x, y); cue('order'); }
      return;
    }
    miniDrag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); scene.current.look(W(), x, y);
  };
  const onMiniMove = (e: React.PointerEvent) => { if (miniDrag.current && world.current) { const [x, y] = miniAt(e); scene.current?.look(W(), x, y); } };
  const onMiniUp = () => { miniDrag.current = false; };

  // ---------------------------------------------------------------- pictures for the HUD
  function pic(kind: 'unit' | 'bld', side: string, type: string) {
    const src = kind === 'unit' && type !== 'wagon' ? `${ART}unit-${side}-${type}.webp` : `${ART}bld-${side}-${type === 'wagon' ? 'workshop' : type}.webp`;
    const s = scene.current, im = s?.img(src.slice(ART.length, -5));
    if (im) return src;
    const key = `${kind}:${type}`;
    let url = drawnPics.get(key);
    if (!url && s && typeof document !== 'undefined') {
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const c = cv.getContext('2d')!;
      if (kind === 'unit') { c.translate(48, 84); s.paintUnit(c, type, side, 54, 1, 0); }
      else s.buildingArt(BUILDINGS[type], 8, 4, 80, '#fff', true, 1);
      url = cv.toDataURL(); drawnPics.set(key, url);
    }
    return url ?? '';
  }
  const Pic = ({ kind, side, type, size = 44 }: { kind: 'unit' | 'bld'; side: string; type: string; size?: number }) => {
    const src = pic(kind, side, type);
    return src ? <img className="cmd-pic" src={src} alt="" width={size} height={size} draggable={false} /> : <span className="cmd-pic" style={{ width: size, height: size }} />;
  };
  const Portrait = ({ who, size = 64 }: { who: Line['who']; size?: number }) => {
    const has = who === 'dora' || who === 'enzo' || who === 'marlo' || who === 'queen';
    const im = has ? scene.current?.img(`portrait-${who}`) : null;
    return im ? <img className="cmd-portrait" src={`${ART}portrait-${who}.webp`} alt="" width={size} height={size} />
      : <span className="cmd-portrait cmd-portrait-drawn" style={{ width: size, height: size, background: SPEAKERS[who].color }}>{SPEAKERS[who].name.replace('The ', '')[0]}</span>;
  };

  // ---------------------------------------------------------------- the screens
  const w = world.current, me = w?.players[0];
  const sm = MISSIONS.find((m) => m.id === missionId) ?? MISSIONS[0];
  const backdrop = (b: string) => (scene.current?.img(`brief-${b}`) ? { backgroundImage: `url(${ART}brief-${b}.webp)` } : undefined);
  const titleArt = scene.current?.img('title') ? { backgroundImage: `url(${ART}title.webp)` } : undefined;

  const hud = () => {
    if (!w || !me) return null;
    const { units, blds, other } = selected(), cmds = commands();
    const one = units.length + blds.length === 1 ? (units[0] ?? blds[0]) : other;
    const idle = w.units.filter((u) => u.owner === 0 && u.def.worker && !u.order && !u.under && !w.frozen.has(u.id)).length;
    const talk = dialog.current[0];
    const m = mission.current;
    return (
      <>
        <header className="cmd-top">
          <button className="cmd-chip" onClick={() => pause(true)} aria-label="Pause">❚❚</button>
          <span className="cmd-res cmd-hay" title="Hay"><i />{me.hay}</span>
          <span className="cmd-res cmd-glim" title="Glimmer"><i />{me.glimmer}</span>
          <span className={`cmd-res cmd-sup${me.used >= me.cap ? ' is-full' : ''}`} title="Room: units out of room for them"><i />{me.used}/{me.cap}</span>
          <span className="cmd-clock">{clock(w.tick / TICK_HZ)}</span>
          {idle > 0 && <button className="cmd-chip cmd-idle" onClick={idleWorker} title="Idle gatherers (.)">💤 {idle}</button>}
          {m && <span className="cmd-goal" title={m.goal}>{m.goal}</span>}
        </header>
        <div className="cmd-toasts" aria-live="polite">{toasts.current.map((t) => <p key={t.id} className={`cmd-toast is-${t.tone}`}>{t.text}</p>)}</div>
        {talk && (
          <div className="cmd-talk" style={{ ['--who' as string]: SPEAKERS[talk.line.who].color }} onClick={() => dialog.current.shift()}>
            {Portrait({ who: talk.line.who, size: 56 })}
            <p><b>{SPEAKERS[talk.line.who].name}</b>{talk.line.text}</p>
          </div>
        )}
        <button className={`cmd-chip cmd-selmode${selectMode.current ? ' is-on' : ''}`} onClick={() => { selectMode.current = !selectMode.current; refresh(); }} aria-pressed={selectMode.current}>▢ {selectMode.current ? 'Drag selects' : 'Drag moves'}</button>
        <footer className="cmd-hud" ref={hudEl}>
          <div className="cmd-mini"><canvas ref={mini} onPointerDown={onMiniDown} onPointerMove={onMiniMove} onPointerUp={onMiniUp} onContextMenu={(e) => e.preventDefault()} aria-label="Minimap" /></div>
          <div className="cmd-sel">
            {one ? card(one) : units.length > 1 ? (
              <div className="cmd-many">
                {units.slice(0, 24).map((u) => (
                  <button key={u.id} className="cmd-many-u" title={u.def.name} onClick={(e) => { if (e.shiftKey) { sel.current.delete(u.id); refresh(); } else choose([u.id]); }}>
                    {Pic({ kind: 'unit', side: u.def.side, type: u.type, size: 34 })}
                    <i style={{ width: `${(u.hp / u.maxHp) * 100}%`, background: u.hp * 3 < u.maxHp ? '#ffcf5a' : '#7fe08a' }} />
                  </button>
                ))}
                {units.length > 24 && <span className="cmd-more">+{units.length - 24}</span>}
              </div>
            ) : blds.length > 1 ? card(blds[0], blds.length) : <p className="cmd-hint">{S.hints ? 'Drag to pick units · right-click (or tap) to send them · B builds · A marches ready to bump.' : 'Nothing picked.'}</p>}
          </div>
          <div className="cmd-cmds">
            {cmds.map((b) => (
              <button key={b.label} className={`cmd-btn${b.on ? ' is-on' : ''}${b.off ? ' is-off' : ''}`} aria-disabled={!!b.off} title={`${b.label} (${b.key === 'Escape' ? 'Esc' : b.key}): ${b.tip}${b.off ? ` — ${b.off}` : ''}`}
                onClick={() => { audio(); if (b.off) { toast(b.off, 'warn'); return; } b.run(); }}>
                {b.pic ? Pic({ kind: b.pic.kind, side: b.pic.side, type: b.pic.type, size: 30 }) : <span className="cmd-ico">{b.icon}</span>}
                <span className="cmd-lab">{b.label}</span>
                {b.cost && <span className="cmd-cost">{b.cost[0] > 0 && <em className="h">{b.cost[0]}</em>}{b.cost[1] > 0 && <em className="g">{b.cost[1]}</em>}</span>}
                <kbd>{b.key === 'Escape' ? 'Esc' : b.key}</kbd>
              </button>
            ))}
          </div>
        </footer>
      </>
    );
  };
  function card(e: Unit | Building, count = 1) {
    const w2 = world.current!, mineE = e.owner === 0 && !w2.frozen.has(e.id), owner = w2.players[e.owner];
    if (e.kind === 'unit') {
      const d = e.def, armor = w2.armorOf(e), dmg = w2.dmgOf(e.owner, d.dmg);
      const status = [e.carry ? `carrying ${e.carry} ${e.carryRes}` : '', w2.woundDown(e) ? 'wound down: half pace' : '', e.stun > 0 ? 'dazzled' : '', e.root > 0 ? 'stuck in a snare' : '', e.firm > 0 ? 'standing firm' : '', e.haste > 0 ? 'quickened' : '', w2.frozen.has(e.id) ? 'waiting to be found' : ''].filter(Boolean).join(' · ');
      return (
        <div className="cmd-card">
          {Pic({ kind: 'unit', side: d.side, type: e.type, size: 64 })}
          <div>
            <h3 style={{ color: mineE ? undefined : owner.color }}>{d.name}{!mineE && <small> · {owner.name}</small>}</h3>
            <div className="cmd-hp"><i style={{ width: `${(e.hp / e.maxHp) * 100}%` }} /><span>{e.hp} / {e.maxHp}</span></div>
            <p className="cmd-stats">{d.dmg > 0 && <>Bump {dmg}{d.siege ? ` (×${d.siege} on buildings)` : ''} · Reach {d.range < 1 ? 'close' : d.range} · </>}Armour {armor}{d.air ? ' · Flies' : ''}</p>
            <p className="cmd-blurb">{status || d.blurb}</p>
          </div>
        </div>
      );
    }
    const d = e.def, prog = e.done ? 0 : e.progress / Math.round(d.time * TICK_HZ);
    return (
      <div className="cmd-card">
        {Pic({ kind: 'bld', side: d.side, type: e.type, size: 64 })}
        <div>
          <h3 style={{ color: mineE ? undefined : owner.color }}>{d.name}{count > 1 && ` ×${count}`}{!mineE && <small> · {owner.name}</small>}</h3>
          <div className="cmd-hp"><i style={{ width: `${(e.hp / e.maxHp) * 100}%` }} /><span>{e.hp} / {e.maxHp}</span></div>
          {!e.done ? <p className="cmd-blurb">Going up… {Math.round(prog * 100)}%</p>
            : mineE && e.queue.length ? (
              <div className="cmd-queue">
                {e.queue.map((q, i) => (
                  <span key={i} className="cmd-q" title={q.k === 'unit' ? UNITS[q.id].name : UPGRADES[q.id].name}>
                    {q.k === 'unit' ? Pic({ kind: 'unit', side: UNITS[q.id].side, type: q.id, size: 28 }) : <b>{UP_ICON[Object.keys(UPGRADES[q.id].effect)[0]] ?? '✦'}</b>}
                    {i === 0 && <i style={{ width: `${(1 - q.left / q.total) * 100}%` }} />}
                  </span>
                ))}
              </div>
            ) : <p className="cmd-blurb">{d.blurb}{d.supply ? ` Room for ${d.supply}.` : ''}</p>}
        </div>
      </div>
    );
  }

  const sideCard = (side: SideId, pickIt: (s: SideId) => void, on: SideId) => (
    <button key={side} className={`cmd-side${on === side ? ' is-on' : ''}`} aria-pressed={on === side} style={{ ['--side' as string]: SIDES[side].color }} onClick={() => { audio(); cue('select', side); pickIt(side); }}>
      {Pic({ kind: 'unit', side: side, type: SIDES[side].worker === 'gatherer' ? 'slinger' : side === 'guild' ? 'scrapper' : 'clicker', size: 56 })}
      <span><strong>{SIDES[side].name}</strong><small>{SIDES[side].blurb}</small></span>
    </button>
  );

  return (
    <main className="cmd-shell" data-ready={ready ? 'true' : undefined} data-screen={screen} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvas} className={`cmd-canvas${mode.current ? ` is-${mode.current.k}` : ''}`} tabIndex={0}
        aria-label="Burrow Command battlefield. Drag to select units, right-click to order them, arrow keys to look around."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') mouse.current.inside = false; }} />
      {error && <div className="cmd-panel cmd-error"><h2>One moment…</h2><p>{error}</p></div>}

      {screen === 'title' && (
        <section className="cmd-menu cmd-title-screen">
          <header className="cmd-head"><a href="/" className="cmd-back">← ARCADE</a><button className="cmd-chip" onClick={() => setting('mute', !S.mute)}>{S.mute ? '🔇 Sound off' : '🔊 Sound on'}</button></header>
          <div className="cmd-title" style={titleArt}>
            <div>
              <p className="cmd-eyebrow">DORA &amp; ENZO PRESENT</p>
              <h1>Burrow <em>Command</em></h1>
              <p className="cmd-tagline">Gather hay and glimmer, build your burrow, and poof the rivals home dizzy.</p>
            </div>
          </div>
          <div className="cmd-modes">
            <button className="cmd-mode" onClick={() => { audio(); cue('click'); setScreen('campaign'); }}>
              <strong>Story campaign</strong><small>Ten missions with Dora, Enzo, Marlo and the Queen · {totalStars(P)} / {MISSIONS.length * 3} ★</small>
            </button>
            <button className="cmd-mode" onClick={() => { audio(); cue('click'); setScreen('skirmish'); }}>
              <strong>Skirmish</strong><small>Any side against the computer on five maps · won {P.skirmish.won} of {P.skirmish.played}</small>
            </button>
          </div>
          <details className="cmd-how">
            <summary>How to command</summary>
            <ul>
              <li><b>Pick:</b> drag a box, or click. Double-click picks every one of that kind on screen. Shift adds.</li>
              <li><b>Send:</b> right-click the ground to walk, a meadow to gather, a rival to bump. Shift queues orders.</li>
              <li><b>Keys:</b> A attack-move · P patrol · H hold · S stop · M move · B build · F ability · T tunnel · . idle gatherer · Space last alert · Backspace home.</li>
              <li><b>Groups:</b> Ctrl+1–9 (or Alt) to set, 1–9 to pick, twice to look.</li>
              <li><b>Look around:</b> arrow keys, the screen&apos;s edges, the minimap or the middle button; the wheel zooms.</li>
              <li><b>Touch:</b> tap to pick, tap the ground to send. Drag looks around; switch the ▢ button to drag a box. Pinch zooms.</li>
              <li>Nobody gets hurt: a bumped-out unit is <b>poofed</b> home, dizzy, and a broken building is <b>tidied away</b>.</li>
            </ul>
          </details>
        </section>
      )}

      {screen === 'skirmish' && (
        <section className="cmd-menu">
          <header className="cmd-head"><button className="cmd-back" onClick={() => setScreen('title')}>← BACK</button><h2>Skirmish</h2></header>
          <div className="cmd-setup">
            <div className="cmd-col">
              <h3>Your side</h3>
              {SIDE_IDS.map((s) => sideCard(s, (x) => setting('side', x), S.side))}
            </div>
            <div className="cmd-col">
              <h3>Your rival</h3>
              <div className="cmd-row">{SIDE_IDS.map((s) => <button key={s} className={`cmd-chip${S.foe === s ? ' is-on' : ''}`} aria-pressed={S.foe === s} style={{ ['--side' as string]: SIDES[s].color }} onClick={() => setting('foe', s)}>{SIDES[s].short}</button>)}</div>
              <h3>Difficulty</h3>
              <div className="cmd-row">{DIFFICULTIES.map((d) => <button key={d} className={`cmd-chip${S.diff === d ? ' is-on' : ''}`} aria-pressed={S.diff === d} onClick={() => setting('diff', d)} title={DIFF_BLURB[d]}>{DIFF_NAME[d]}</button>)}</div>
              <p className="cmd-note">{DIFF_BLURB[S.diff]}</p>
              <h3>Map</h3>
              <ul className="cmd-maps">
                {MAPS.map((m) => (
                  <li key={m.id}><button className={`cmd-map${S.map === m.id ? ' is-on' : ''}`} aria-pressed={S.map === m.id} onClick={() => setting('map', m.id)}><strong>{m.name}</strong><small>{m.blurb || `${m.w}×${m.h}`}</small></button></li>
                ))}
              </ul>
              <button className="cmd-go" onClick={startSkirmish}>Start the match ▸</button>
            </div>
          </div>
        </section>
      )}

      {screen === 'campaign' && (
        <section className="cmd-menu">
          <header className="cmd-head"><button className="cmd-back" onClick={() => setScreen('title')}>← BACK</button><h2>The Glimmer Spring Story</h2><span className="cmd-total">{totalStars(P)} / {MISSIONS.length * 3} ★</span></header>
          <ol className="cmd-missions">
            {MISSIONS.map((m, i) => {
              const open = unlocked(P, i), st = P.stars[m.id] ?? 0;
              return (
                <li key={m.id}>
                  <button className="cmd-mission" disabled={!open} onClick={() => brief(m.id)} style={open ? backdrop(m.backdrop) : undefined}>
                    <b>{m.n}</b>
                    <span><strong>{open ? m.title : 'Locked'}</strong><small>{open ? m.blurb : `Win mission ${m.n - 1} to open.`}</small></span>
                    <em>{open ? STARS(st) : '🔒'}{P.best[m.id] ? <small> {clock(P.best[m.id])}</small> : null}</em>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {screen === 'brief' && (
        <section className="cmd-menu cmd-brief" style={backdrop(sm.backdrop)}>
          <header className="cmd-head"><button className="cmd-back" onClick={() => setScreen('campaign')}>← MISSIONS</button></header>
          <div className="cmd-brief-body">
            <p className="cmd-eyebrow">MISSION {sm.n}</p>
            <h2>{sm.title}</h2>
            <div className="cmd-lines">
              {sm.brief.map((l, i) => (
                <div key={i} className="cmd-line" style={{ ['--who' as string]: SPEAKERS[l.who].color }}>
                  {Portrait({ who: l.who, size: 52 })}<p><b>{SPEAKERS[l.who].name}</b>{l.text}</p>
                </div>
              ))}
            </div>
            <p className="cmd-goal-big"><b>Goal:</b> {sm.goal}</p>
            <ul className="cmd-starlist">{sm.stars.map((s, i) => <li key={i} className={(P.stars[sm.id] ?? 0) > i ? 'got' : ''}>★ {s}</li>)}</ul>
            <button className="cmd-go" onClick={() => startMissionPlay(sm)}>Begin ▸</button>
          </div>
        </section>
      )}

      {(screen === 'play' || screen === 'end') && hud()}

      {screen === 'play' && paused && (
        <div className="cmd-overlay">
          <div className="cmd-panel">
            <h2>Paused</h2>
            {mission.current && <p className="cmd-note"><b>Goal:</b> {mission.current.goal}</p>}
            <div className="cmd-col">
              <button className="cmd-go" onClick={() => pause(false)}>Carry on ▸</button>
              <button onClick={restart}>Start again</button>
              <button onClick={quit}>Leave the match</button>
            </div>
            <h3>Settings</h3>
            <div className="cmd-row">
              <span>Speed</span>{([0.75, 1, 1.5] as Speed[]).map((v) => <button key={v} className={`cmd-chip${S.speed === v ? ' is-on' : ''}`} aria-pressed={S.speed === v} onClick={() => setting('speed', v)}>{v === 0.75 ? 'Gentle' : v === 1 ? 'Normal' : 'Brisk'}</button>)}
            </div>
            <div className="cmd-row">
              <button className="cmd-chip" onClick={() => setting('mute', !S.mute)}>{S.mute ? '🔇 Sound off' : '🔊 Sound on'}</button>
              <button className="cmd-chip" onClick={() => setting('edge', !S.edge)}>{S.edge ? 'Edge scrolling on' : 'Edge scrolling off'}</button>
              <button className="cmd-chip" onClick={() => setting('hints', !S.hints)}>{S.hints ? 'Hints on' : 'Hints off'}</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'end' && end && (
        <div className="cmd-overlay">
          <div className={`cmd-panel cmd-end${end.won ? ' is-won' : ''}`}>
            <h2>{end.won ? (mission.current ? 'Mission won!' : 'Victory!') : 'Not this time'}</h2>
            <p>{end.why}</p>
            {end.stars && <p className="cmd-end-stars">{STARS(end.stars.filter(Boolean).length)}</p>}
            {end.stars && mission.current && <ul className="cmd-starlist">{mission.current.stars.map((s, i) => <li key={i} className={end.stars![i] ? 'got' : ''}>★ {s}</li>)}</ul>}
            {end.news && <p className="cmd-news">{end.news}</p>}
            {end.won && mission.current && (
              <div className="cmd-lines">
                {mission.current.outro.map((l, i) => <div key={i} className="cmd-line" style={{ ['--who' as string]: SPEAKERS[l.who].color }}>{Portrait({ who: l.who, size: 44 })}<p><b>{SPEAKERS[l.who].name}</b>{l.text}</p></div>)}
              </div>
            )}
            <dl className="cmd-tally">
              <div><dt>Time</dt><dd>{clock(end.secs)}</dd></div>
              <div><dt>Hay</dt><dd>{end.stats.hay}</dd></div>
              <div><dt>Glimmer</dt><dd>{end.stats.glimmer}</dd></div>
              <div><dt>Trained</dt><dd>{end.stats.trained}</dd></div>
              <div><dt>Poofed home</dt><dd>{end.stats.poofed}</dd></div>
              <div><dt>Ours poofed</dt><dd>{end.stats.lost}</dd></div>
            </dl>
            <div className="cmd-row">
              {end.won && mission.current && mission.current.n < MISSIONS.length && <button className="cmd-go" onClick={() => brief(MISSIONS[mission.current!.n].id)}>Next mission ▸</button>}
              <button onClick={restart}>{end.won ? 'Play again' : 'Try again'}</button>
              <button onClick={quit}>{mission.current ? 'Missions' : 'Menu'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
