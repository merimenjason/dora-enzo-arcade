'use client';
// Burrow Clinic: the page. The title poster, the campaign map (a 1950s travel poster of the Andes with six clinics on a
// dotted road), and the clinic itself: a top bar of pills (coins, reputation and cures against the goals, the day and
// the clock, pause and speed), the isometric floor on a canvas, a round-button toolbar (Build, Decor, Hire, Overview)
// and a side dock for every card (build cards, hiring, info cards, Enzo's tutorial notes, Dora's tips and emergencies).
// The dock and the toolbar sit beside the floor (below it on a phone held upright), never over it, so no words ever
// cover a face. Input: click or tap selects, drag pans (or drags a room out in build mode), the wheel or a pinch
// zooms, a staff member can be dragged into a room, right-click or Escape cancels, R rotates, Space pauses, 1/2/3 set
// the speed and B opens the build cards. Rules in lib/clinic-game.ts, drawing in lib/clinic-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/clinic-game';
import type { ClinicScene, Pick } from '@/lib/clinic-scene';
import { ClinicSound } from './sound';
import './clinic.css';

type Screen = 'title' | 'map' | 'clinic';
type Sheet = null | 'settings' | 'met' | 'failed' | 'bulletin';
type Panel = 'none' | 'build' | 'decor' | 'hire';
/** `turned`: the player has rotated a decoration's ghost, so moving it keeps that facing (otherwise it picks a sensible one) */
type GhostBox = { x: number; y: number; w: number; h: number; rot: number; rank: number; suggested: boolean; turned?: boolean };
type MetInfo = { stars: number; day: number; rep: number; clinic: string; next: string | null; first: boolean };
const ART = '/art/clinic/';
/** where each clinic stands on the map painting (fractions of its width and height) */
const PINS: Record<string, [number, number]> = { burrow: [0.2, 0.88], salt: [0.16, 0.57], lake: [0.21, 0.31], forest: [0.49, 0.25], springs: [0.84, 0.53], summit: [0.82, 0.26] };
const TUT_TEXT = [
  'Hello! Every patient checks in at a Reception first. Tap Build, pick Reception, then press the green tick to place it where the ghost glows.',
  'Lovely desk! Now someone to sit at it. Tap Hire and pick a receptionist.',
  'Next, a Check-up Room, where a vet works out what is wrong. Build one from the Build cards.',
  'A Check-up Room needs a vet. Hire one: more stars means quicker, surer check-ups.',
  'Our first patients have Static Fluff. Build a Fluff-Dryer to cure it.',
  'The doors are open and our first patient, a pudú, is here! Watch them check in, see the vet and sit under the dryer. Tap anyone to see how they feel.',
];
const STATE_TEXT: Record<G.StaffState, string> = { arrive: 'Arriving for work', idle: 'Waiting for something to do', go: 'On the way to a room', work: 'Working', to_rest: 'Off for a rest', rest: 'Resting with a cuppa', task: 'Busy with a job', leave: 'Heading home', gone: 'Gone home' };
/** how each ailment looks on a patient, for the clinic panel's legend */
const LOOK: Record<G.AilmentId, string> = {
  static: 'Frizzy fur crackling with blue sparks', hiccups: 'Little hops, and bubbles that pop twice', ears: 'Ears hanging upside down',
  sneezes: 'Sneezes out tiny snowballs', dust: 'A dusty cloud and a wriggle', tangle: 'A knot tied in the tail',
  glow: 'Whiskers glowing like night lights', puff: 'Puffed up as round as a ball', spots: 'Purple spots and drifting Zzz',
};
const WHY_ICON: Record<G.WhyId, string> = { thirst: 'thirsty', wait: 'grumpy', litter: 'meh', cold: 'meh', stand: 'meh', noroom: 'build', plants: 'happy', decor: 'happy', bench: 'happy', cheer: 'heart' };
const MOOD_TEXT = (m: number) => (m >= 70 ? 'Cheerful' : m >= 35 ? 'Content' : 'A bit glum: works a little slower');
const PHASE_TEXT: Record<G.Phase, string> = { arrive: 'Just arrived', wait: 'Waiting', to_slot: 'Walking in', in_slot: 'Being seen', drink: 'Getting a drink', cheer: 'Cured!', leave: 'Going home', gone: 'Gone home' };
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const unlockAt = (k: G.RoomKind) => G.CLINICS.find((c) => c.rooms.includes(k))?.name ?? 'a later clinic';
const decoAt = (k: G.DecoKind) => G.CLINICS.find((c) => c.decos.includes(k))?.name ?? 'a later clinic';
const randSeed = () => (Math.floor(Math.random() * 2 ** 31) || 7);

function Img({ n, alt = '', className = '' }: { n: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${ART}${n}.webp`} alt={alt} className={className} draggable={false} />;
}
function Stars({ n, of = 3, big = false }: { n: number; of?: number; big?: boolean }) {
  return (
    <span className={`hc-stars${big ? ' hc-stars-big' : ''}`} role="img" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={`hc-star${i < n ? ' hc-on' : ''}`} />)}
    </span>
  );
}
function Bar({ k, tone = 'teal' }: { k: number; tone?: string }) {
  return <span className={`hc-bar hc-bar-${tone}`}><span style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%` }} /></span>;
}

export default function ClinicPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ClinicScene | null>(null);
  const soundRef = useRef<ClinicSound | null>(null);
  const gameRef = useRef<G.Game | null>(null);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [sheet, setSheetState] = useState<Sheet>(null);
  const sheetRef = useRef<Sheet>(null);
  const [save, setSave] = useState<G.Save>(G.newSave);
  const saveRef = useRef<G.Save>(save);
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);
  const [panel, setPanelState] = useState<Panel>('none');
  const panelRef = useRef<Panel>('none');
  const [buildKind, setBuildKindState] = useState<G.RoomKind | null>(null);
  const buildRef = useRef<G.RoomKind | null>(null);
  const [decoKind, setDecoKindState] = useState<G.DecoKind | null>(null);
  const decoRef = useRef<G.DecoKind | null>(null);
  const ghostRef = useRef<GhostBox>({ x: 0, y: 0, w: 3, h: 3, rot: 0, rank: 0, suggested: false });
  const [sel, setSelState] = useState<Pick>(null);
  const selRef = useRef<Pick>(null);
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [carry, setCarryState] = useState<number | null>(null);
  const carryRef = useRef<number | null>(null);
  const [news, setNews] = useState<{ text: string; bad: boolean; key: number } | null>(null);
  const [mapSel, setMapSel] = useState('burrow');
  const [met, setMet] = useState<MetInfo | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [hireRole, setHireRole] = useState<G.Role | null>(null);
  const [tipHidden, setTipHidden] = useState('');
  /** on an upright phone the dock folds down to a slim bar so the floor gets the screen */
  const [dockUp, setDockUp] = useState(false);

  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const setSheet = (s: Sheet) => { sheetRef.current = s; setSheetState(s); };
  const setPanel = (p: Panel) => { panelRef.current = p; setPanelState(p); };
  const setBuildKind = (k: G.RoomKind | null) => { buildRef.current = k; setBuildKindState(k); };
  const setDecoKind = (k: G.DecoKind | null) => { decoRef.current = k; setDecoKindState(k); };
  const setSel = (p: Pick) => { selRef.current = p; setSelState(p); if (sceneRef.current) sceneRef.current.selected = p; setConfirm(null); };
  const setPaused = (p: boolean) => { pausedRef.current = p; setPausedState(p); };
  const setCarry = (id: number | null) => { carryRef.current = id; setCarryState(id); };
  const say = (text: string, bad = false) => setNews({ text, bad, key: Math.random() });
  const refresh = () => setTick((t) => t + 1);

  const persist = useCallback((s: G.Save) => {
    saveRef.current = s;
    setSave({ ...s, stars: { ...s.stars }, best: { ...s.best }, settings: { ...s.settings } });
    try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {}
  }, []);
  /** write the clinic in play into the save */
  const saveGame = useCallback(() => {
    const g = gameRef.current, s = saveRef.current;
    if (g) s.current = JSON.parse(JSON.stringify(g.s)) as G.State;
    persist(s);
  }, [persist]);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    if (s.current) setMapSel(s.current.clinic);
    soundRef.current = new ClinicSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/clinic-scene').then(async (mod) => {
      if (gone || !canvasRef.current) return;
      const sc = new mod.ClinicScene(canvasRef.current);
      sc.reduced = !s.settings.motion;
      sceneRef.current = sc;
      await sc.load();
      if (!gone) setReady(true);
    });
    const hide = () => { if (document.visibilityState === 'hidden') { if (screenRef.current === 'clinic') saveGame(); sfx()?.suspend(); } else sfx()?.resume(); };
    const leave = () => { if (screenRef.current === 'clinic') saveGame(); };
    document.addEventListener('visibilitychange', hide);
    addEventListener('pagehide', leave);
    return () => { gone = true; document.removeEventListener('visibilitychange', hide); removeEventListener('pagehide', leave); soundRef.current?.dispose(); };
  }, [saveGame]);

  // the canvas follows its box
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); sceneRef.current?.resize(Math.max(1, r.width), Math.max(1, r.height)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // music follows the screen and the time of day
  useEffect(() => {
    const t = setInterval(() => {
      const g = gameRef.current;
      if (screenRef.current === 'clinic') { refresh(); sfx()?.setTrack(g && g.s.open && G.isEvening(g.s) ? 'evening' : 'day'); }
      else sfx()?.setTrack(screenRef.current === 'map' ? 'map' : 'off');
    }, 200);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------------- the loop: a fixed 10 ticks a second, times the speed
  const onEvents = useCallback((g: G.Game, now: number) => {
    const sc = sceneRef.current, s = sfx();
    for (const e of g.events) {
      sc?.event(e, now);
      switch (e.t) {
        case 'cure': s?.tada(); s?.coin(); s?.squeak(); break;
        case 'levelup': s?.levelup(); break;
        case 'raise': s?.knock(); break;
        case 'upgrade': s?.ratchet(); break;
        case 'huff': s?.huff(); break;
        case 'bulletin':
          if (saveRef.current.settings.bulletins && g.s.bulletin) { s?.paper(); setSel(null); setSheet('bulletin'); }
          else g.dismissBulletin();
          break;
        case 'coins': case 'drink': if (e.coins) s?.coin(); break;
        case 'grumpy': s?.huff(); break;
        case 'checkin': s?.bell(); break;
        case 'machine': s?.machine(G.ROOMS[e.kind].sound); break;
        case 'arrive': s?.chime(); break;
        case 'open': s?.chime(); break;
        case 'step': s?.stepSound(); break;
        case 'fixed': s?.thunk(); break;
        case 'offer': s?.siren(); setPaused(true); setSel(null); break;
        case 'emergency': say(e.ok ? `Emergency handled! A bonus of ${fmt(e.bonus)} coins.` : 'The emergency ran out of time: no bonus this time.', !e.ok); break;
        case 'inspector': say(e.text, !e.ok); break;
        case 'day': saveGame(); say(`Day ${e.day} begins. ${e.wages ? `Wages paid: ${fmt(e.wages)} coins.` : ''}`); break;
        case 'note': say(e.text); break;
        case 'tut': s?.click(); break;
        case 'met': {
          const sv = saveRef.current, def = g.def, first = !(sv.stars[def.id] > 0);
          G.record(sv, def.id, g.s.met!);
          const nxt = G.CLINICS[def.index + 1];
          saveGame();
          setMet({ stars: e.stars, day: g.s.met!.day, rep: g.s.met!.rep, clinic: def.id, next: nxt ? nxt.id : null, first });
          s?.goal(); setTimeout(() => sfx()?.stamp(), 650); setPaused(true); setSheet('met');
          break;
        }
        case 'failed': s?.no(); setPaused(true); setSheet('failed'); saveGame(); break;
        default: break;
      }
    }
    g.events.length = 0;
  }, [saveGame]);

  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const g = gameRef.current, sc = sceneRef.current;
      const dt = Math.min(250, now - last); last = now;
      if (screenRef.current !== 'clinic' || !g || !sc) return;
      const running = !pausedRef.current && !sheetRef.current && g.s.result !== 'failed';
      if (running) acc += (dt / 1000) * G.TICKS_PER_SEC * saveRef.current.settings.speed;
      let n = 0;
      while (acc >= 1 && n < 40) { g.tick(); acc -= 1; n++; }
      if (n === 40) acc = 0;
      if (g.events.length) onEvents(g, now);
      sc.frame(now, running ? Math.min(1, acc) : 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onEvents]);

  // ---------------------------------------------------------------- opening a clinic
  const openClinic = (id: string, fresh: boolean) => {
    const sv = saveRef.current;
    let g: G.Game | null = null;
    if (!fresh && sv.current && sv.current.clinic === id) { try { g = G.Game.load(sv.current); } catch { g = null; } }
    if (!g) g = new G.Game(id, randSeed(), { strict: sv.settings.strict, assist: sv.settings.assist });
    g.s.assist = sv.settings.assist;
    gameRef.current = g;
    sceneRef.current?.setGame(g);
    sv.current = JSON.parse(JSON.stringify(g.s)); persist(sv);
    setPanel('none'); setBuildKind(null); setDecoKind(null); setSel(null); setCarry(null); setMet(null); setSheet(null); setNews(null); setTipHidden('');
    if (sceneRef.current) { sceneRef.current.ghost = null; sceneRef.current.build = false; }
    setPaused(false);
    setScreen('clinic');
    sfx()?.unlock(); sfx()?.chime();
    requestAnimationFrame(() => { const r = wrapRef.current?.getBoundingClientRect(); if (r && sceneRef.current) { sceneRef.current.resize(r.width, r.height); sceneRef.current.fit(true); } });
  };
  const toMap = () => {
    if (screenRef.current === 'clinic') saveGame();
    const g = gameRef.current; if (g) { setMapSel(g.def.id === 'sandbox' ? mapSel : g.def.id); }
    setSheet(null); setScreen('map'); sfx()?.unlock(); sfx()?.click();
  };

  // ---------------------------------------------------------------- build mode
  const syncGhost = useCallback(() => {
    const sc = sceneRef.current, g = gameRef.current; if (!sc || !g) return;
    const gb = ghostRef.current;
    if (buildRef.current) {
      const k = buildRef.current, c = g.canBuild(k, gb.x, gb.y, gb.w, gb.h, gb.rot);
      sc.ghost = { kind: 'room', room: k, x: gb.x, y: gb.y, w: gb.w, h: gb.h, ok: c.ok, door: c.ok ? c.door : null, suggested: gb.suggested };
      sc.build = true;
    } else if (decoRef.current) {
      const c = g.canPlace(decoRef.current, gb.x, gb.y);
      if (!gb.turned) gb.rot = g.facingFor(decoRef.current, gb.x, gb.y);
      sc.ghost = { kind: 'deco', deco: decoRef.current, x: gb.x, y: gb.y, ok: c.ok, suggested: gb.suggested, rot: gb.rot };
      sc.build = true;
    } else { sc.ghost = null; sc.build = panelRef.current === 'build' || panelRef.current === 'decor'; }
  }, []);
  useEffect(() => { syncGhost(); });

  const ghostAtSuggestion = (k: G.RoomKind, rank: number) => {
    const g = gameRef.current!; const d = G.ROOMS[k];
    const s = g.s.assist ? g.suggest(k, { rank }) : null;
    if (s) ghostRef.current = { x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, rank, suggested: true };
    else ghostRef.current = { x: Math.max(0, Math.floor(g.W / 2) - 1), y: 1, w: d.minW, h: d.minH, rot: 0, rank, suggested: false };
    const sc = sceneRef.current; const gb = ghostRef.current;
    if (sc && (sc.userMoved || sc.cam.zoom > sc.fitZoom * 1.3)) sc.focus(gb.x + gb.w / 2 - 0.5, gb.y + gb.h / 2 - 0.5, sc.cam.zoom);
  };
  const decoAtSuggestion = (k: G.DecoKind, rank: number) => {
    const g = gameRef.current!;
    const p = g.s.assist ? g.suggestDeco(k, rank) : null;
    if (p) ghostRef.current = { x: p[0], y: p[1], w: 1, h: 1, rot: 0, rank, suggested: true };
    else ghostRef.current = { x: g.def.door, y: g.H - 3, w: 1, h: 1, rot: 0, rank, suggested: false };
  };
  const pickRoom = (k: G.RoomKind) => {
    const g = gameRef.current; if (!g) return;
    sfx()?.unlock(); sfx()?.click();
    if (!g.def.rooms.includes(k)) { say(`${G.ROOMS[k].name}s open up at ${unlockAt(k)}.`, true); return; }
    setDecoKind(null); setBuildKind(k); setSel(null);
    ghostAtSuggestion(k, 0); syncGhost(); refresh();
  };
  const pickDeco = (k: G.DecoKind) => {
    const g = gameRef.current; if (!g) return;
    sfx()?.unlock(); sfx()?.click();
    if (!g.def.decos.includes(k)) { say(`${G.DECOS[k].name}s arrive at ${decoAt(k)}.`, true); return; }
    setBuildKind(null); setDecoKind(k); setSel(null);
    decoAtSuggestion(k, 0); syncGhost(); refresh();
  };
  const rotate = () => {
    const gb = ghostRef.current;
    if (buildRef.current) { ghostRef.current = { ...gb, w: gb.h, h: gb.w, rot: (gb.rot + 1) % 4, suggested: false }; sfx()?.click(); syncGhost(); refresh(); }
    else if (decoRef.current) {
      const d = G.DECOS[decoRef.current];
      if (d.facings === 1) { say(`A ${d.name} looks the same from every side.`); return; }
      ghostRef.current = { ...gb, rot: (gb.rot + 1) % 4, turned: true }; sfx()?.click(); syncGhost(); refresh();
    }
  };
  /** turn a placed decoration (free) */
  const rotateDeco = (d: G.Deco) => {
    const g = gameRef.current; if (!g) return;
    const r = g.rotateDeco(d.id);
    if (!r.ok) { say(r.reason, true); return; }
    sfx()?.click(); saveGame(); refresh();
  };
  const anotherSpot = () => {
    const gb = ghostRef.current;
    if (buildRef.current) ghostAtSuggestion(buildRef.current, gb.rank + 1);
    else if (decoRef.current) decoAtSuggestion(decoRef.current, gb.rank + 1);
    sfx()?.click(); syncGhost(); refresh();
  };
  const cancelBuild = () => { setBuildKind(null); setDecoKind(null); syncGhost(); sfx()?.click(); refresh(); };
  const place = () => {
    const g = gameRef.current; if (!g) return;
    const gb = ghostRef.current;
    sfx()?.unlock();
    if (buildRef.current) {
      const k = buildRef.current, r = g.build(k, gb.x, gb.y, gb.w, gb.h, gb.rot);
      if (!r.ok) { sfx()?.no(); say(r.reason, true); return; }
      sfx()?.thunk(); say(`Built a ${G.ROOMS[k].name}.`);
      setBuildKind(null); saveGame();
      sceneRef.current?.fit();
      const need = G.ROOMS[k].staff;
      if (need && g.s.assist && !g.s.staff.some((x) => x.role === need && x.state !== 'leave' && x.state !== 'gone')) setHireRole(need);
    } else if (decoRef.current) {
      const k = decoRef.current, r = g.place(k, gb.x, gb.y, gb.rot);
      if (!r.ok) { sfx()?.no(); say(r.reason, true); return; }
      sfx()?.thunk(); say(`Placed a ${G.DECOS[k].name}.`);
      decoAtSuggestion(k, 0); saveGame();
    }
    syncGhost(); refresh();
  };
  const togglePanel = (p: Panel) => {
    sfx()?.unlock(); sfx()?.click();
    const next = panelRef.current === p ? 'none' : p;
    setPanel(next);
    if (next !== 'build') setBuildKind(null);
    if (next !== 'decor') setDecoKind(null);
    if (next !== 'none') setSel(null);
    if (next !== 'hire') setHireRole(null);
    syncGhost(); refresh();
  };

  // ---------------------------------------------------------------- staff
  const hire = (c: G.Candidate) => {
    const g = gameRef.current; if (!g) return;
    sfx()?.unlock();
    const r = g.hire(c.id);
    if (!r.ok) { sfx()?.no(); say(r.reason, true); return; }
    sfx()?.coin(); say(`${c.name} the ${G.ROLES[c.role].name.toLowerCase()} is on the way in.`);
    setHireRole(null); saveGame(); refresh();
  };
  const fire = (st: G.Staff) => {
    const g = gameRef.current; if (!g) return;
    const r = g.fire(st.id);
    if (!r.ok) { say(r.reason, true); return; }
    sfx()?.sell(); say(`${st.name} has been let go and is heading home.`); setSel(null); saveGame();
  };
  const dropStaff = (id: number, tx: number, ty: number) => {
    const g = gameRef.current; if (!g) return;
    const st = g.staffById(id); if (!st) return;
    const inside = tx >= 0 && ty >= 0 && tx < g.W && ty < g.H;
    const rid = inside ? g.roomAt[ty * g.W + tx] : 0;
    const r = g.assign(id, rid);
    sfx()?.drop();
    if (!r.ok) { say(r.reason, true); sfx()?.no(); }
    else if (rid) { const room = g.roomById(rid)!; say(room.kind === 'staff' ? `${st.name} is off for a rest.` : `${st.name} will work in the ${G.ROOMS[room.kind].name}.`); }
    else say(`${st.name} will go wherever they are needed.`);
    if (sceneRef.current) sceneRef.current.held = null;
    setCarry(null); setSel({ type: 'staff', id }); refresh();
  };
  const pickUp = (st: G.Staff) => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || !sc) return;
    g.hold(st.id, true); setCarry(st.id); sfx()?.pick();
    sc.held = { id: st.id, sx: sc.w / 2, sy: sc.h / 2 };
    say(`Tap a room to drop ${st.name} in, or the corridor to let them roam.`);
  };
  const cancelCarry = () => {
    const g = gameRef.current, id = carryRef.current;
    if (g && id != null) g.hold(id, false);
    if (sceneRef.current) sceneRef.current.held = null;
    setCarry(null);
  };
  const sendRest = (st: G.Staff) => {
    const g = gameRef.current; if (!g) return;
    const sr = g.roomsOf('staff')[0];
    if (!sr) { say('Build a Staff Room first: that is where staff rest.', true); sfx()?.no(); return; }
    g.assign(st.id, sr.id); sfx()?.click(); say(`${st.name} is off for a rest.`); refresh();
  };

  // ---------------------------------------------------------------- rooms
  const sellRoom = (r: G.Room) => {
    const g = gameRef.current; if (!g) return;
    const res = g.sell(r.id);
    if (!res.ok) { say(res.reason, true); sfx()?.no(); return; }
    sfx()?.sell(); say(`Sold the ${G.ROOMS[r.kind].name} for ${fmt(r.cost / 2)} coins.`); setSel(null); saveGame();
  };
  const sellDeco = (d: G.Deco) => {
    const g = gameRef.current; if (!g) return;
    const res = g.sellDeco(d.id);
    if (!res.ok) { say(res.reason, true); return; }
    sfx()?.sell(); say(`Sold the ${G.DECOS[d.kind].name}.`); setSel(null); saveGame();
  };
  const moveDoor = (r: G.Room) => {
    const g = gameRef.current; if (!g) return;
    const ring: G.Door[] = [];
    for (let x = r.x; x < r.x + r.w; x++) ring.push({ x, y: r.y, side: 'N' });
    for (let y = r.y; y < r.y + r.h; y++) ring.push({ x: r.x + r.w - 1, y, side: 'E' });
    for (let x = r.x + r.w - 1; x >= r.x; x--) ring.push({ x, y: r.y + r.h - 1, side: 'S' });
    for (let y = r.y + r.h - 1; y >= r.y; y--) ring.push({ x: r.x, y, side: 'W' });
    const at = ring.findIndex((d) => d.x === r.door.x && d.y === r.door.y && d.side === r.door.side);
    let last = 'There is no other place for a door here.';
    for (let i = 1; i < ring.length; i++) {
      const d = ring[(at + i) % ring.length];
      const res = g.setDoor(r.id, d);
      if (res.ok) { sfx()?.thunk(); say(`Moved the ${G.ROOMS[r.kind].name}’s door.`); refresh(); return; }
      last = res.reason;
      if (/treated/.test(res.reason)) break;
    }
    sfx()?.no(); say(last, true);
  };

  // ---------------------------------------------------------------- events
  const respond = (accept: boolean) => {
    const g = gameRef.current; if (!g || !g.s.offer) return;
    const r = g.respond(g.s.offer.id, accept);
    sfx()?.unlock(); sfx()?.click();
    if (!r.ok) say(r.reason, true);
    onEvents(g, performance.now());
    setPaused(false); refresh();
  };

  const answerRaise = (yes: boolean) => {
    const g = gameRef.current; if (!g || !g.s.raise) return;
    const r = g.answerRaise(g.s.raise.id, yes);
    sfx()?.unlock(); if (yes) sfx()?.coin(); else sfx()?.click();
    if (!r.ok) say(r.reason, true);
    onEvents(g, performance.now()); saveGame(); refresh();
  };
  const upgradeRoom = (r: G.Room) => {
    const g = gameRef.current; if (!g) return;
    const res = g.upgrade(r.id);
    sfx()?.unlock();
    if (!res.ok) { sfx()?.no(); say(res.reason, true); return; }
    onEvents(g, performance.now()); saveGame(); refresh();
  };
  const setTraining = (r: G.Room, on: boolean) => {
    const g = gameRef.current; if (!g) return;
    const res = g.setTraining(r.id, on);
    sfx()?.unlock();
    if (!res.ok) { sfx()?.no(); say(res.reason, true); return; }
    sfx()?.click(); say(on ? `Training is on: ${g.teacher()?.name} teaches everyone who rests here (${G.TRAIN_COST} coins a day).` : 'Training is off.'); refresh();
  };
  const closeBulletin = () => { gameRef.current?.dismissBulletin(); setSheet(null); sfx()?.click(); refresh(); };
  /** glide to where a complaint is, and pick the patient there */
  const showComplaint = (c: { id: G.WhyId; at: [number, number] }) => {
    const g = gameRef.current, sc = sceneRef.current; if (!g || !sc) return;
    const p = g.s.patients.filter((q) => g.whyOf(q).some((w) => w.id === c.id)).sort((a, b) => Math.abs(a.x - c.at[0]) + Math.abs(a.y - c.at[1]) - (Math.abs(b.x - c.at[0]) + Math.abs(b.y - c.at[1])))[0];
    const [x, y] = p ? [p.x, p.y] : c.at;
    sc.focus(x, y, Math.max(sc.cam.zoom, sc.fitZoom * 1.6));
    if (p) setSel({ type: 'patient', id: p.id });
    sfx()?.click(); refresh();
  };

  // ---------------------------------------------------------------- time
  const setSpeed = (n: 1 | 2 | 3) => { const s = saveRef.current; s.settings.speed = n; persist(s); setPaused(false); sfx()?.unlock(); sfx()?.click(); };
  const togglePause = () => { setPaused(!pausedRef.current); sfx()?.unlock(); sfx()?.click(); };

  // ---------------------------------------------------------------- the canvas: select, pan, zoom, draw rooms, drag staff
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<null | { mode: 'pan' | 'maybeHold' | 'hold' | 'draw' | 'moveGhost' | 'deco' | 'pinch' | 'carry'; x0: number; y0: number; lx: number; ly: number; tx0: number; ty0: number; ox: number; oy: number; moved: boolean; id: number; d0: number }>(null);
  const local = (e: { clientX: number; clientY: number }) => { const r = canvasRef.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const cancelAll = () => {
    if (carryRef.current != null) { cancelCarry(); return true; }
    if (buildRef.current || decoRef.current) { cancelBuild(); return true; }
    if (panelRef.current !== 'none') { setPanel('none'); syncGhost(); return true; }
    if (selRef.current) { setSel(null); return true; }
    return false;
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sc = sceneRef.current, g = gameRef.current; if (!sc || !g) return;
    sfx()?.unlock();
    if (e.button === 2) { cancelAll(); refresh(); return; }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    ptrs.current.set(e.pointerId, { x, y });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      if (drag.current?.mode === 'hold') return;
      drag.current = { mode: 'pinch', x0: (a.x + b.x) / 2, y0: (a.y + b.y) / 2, lx: (a.x + b.x) / 2, ly: (a.y + b.y) / 2, tx0: 0, ty0: 0, ox: 0, oy: 0, moved: true, id: 0, d0: Math.hypot(a.x - b.x, a.y - b.y) };
      return;
    }
    if (ptrs.current.size > 2) return;
    const [tx, ty] = sc.tileAt(x, y), gb = ghostRef.current;
    const base = { x0: x, y0: y, lx: x, ly: y, tx0: tx, ty0: ty, ox: 0, oy: 0, moved: false, id: 0, d0: 0 };
    if (carryRef.current != null) drag.current = { ...base, mode: 'carry' };
    else if (buildRef.current) {
      const inside = tx >= gb.x && tx < gb.x + gb.w && ty >= gb.y && ty < gb.y + gb.h;
      drag.current = inside ? { ...base, mode: 'moveGhost', ox: tx - gb.x, oy: ty - gb.y } : { ...base, mode: 'draw' };
    } else if (decoRef.current) drag.current = { ...base, mode: 'deco' };
    else {
      const p = sc.pick(x, y);
      drag.current = p && p.type === 'staff' ? { ...base, mode: 'maybeHold', id: p.id } : { ...base, mode: 'pan' };
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sc = sceneRef.current, g = gameRef.current; if (!sc || !g) return;
    const [x, y] = local(e);
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x, y });
    const d = drag.current;
    if (carryRef.current != null && sc.held) { sc.held.sx = x; sc.held.sy = y; }
    if (!d) { sc.hover = e.pointerType === 'mouse' ? sc.screenToTile(x, y) : null; sc.hoverPick = e.pointerType === 'mouse' ? sc.pick(x, y) : null; return; }
    if (d.mode === 'pinch') {
      if (ptrs.current.size < 2) return;
      const [a, b] = [...ptrs.current.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dist = Math.hypot(a.x - b.x, a.y - b.y);
      sc.pan(mx - d.lx, my - d.ly); d.lx = mx; d.ly = my;
      if (d.d0 > 10) { sc.zoomAt(mx, my, dist / d.d0); d.d0 = dist; }
      return;
    }
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) > 7) d.moved = true;
    if (!d.moved) return;
    const [tx, ty] = sc.tileAt(x, y);
    if (d.mode === 'pan') { sc.pan(x - d.lx, y - d.ly); }
    else if (d.mode === 'maybeHold') {
      const st = g.staffById(d.id);
      if (st && st.state !== 'leave' && st.state !== 'gone') { d.mode = 'hold'; g.hold(d.id, true); sc.held = { id: d.id, sx: x, sy: y }; sfx()?.pick(); }
      else d.mode = 'pan';
    } else if (d.mode === 'hold') { if (sc.held) { sc.held.sx = x; sc.held.sy = y; } sc.hover = [tx, ty]; }
    else if (d.mode === 'draw') {
      const x0 = Math.min(d.tx0, tx), y0 = Math.min(d.ty0, ty);
      const w = Math.min(8, Math.abs(tx - d.tx0) + 1), h = Math.min(8, Math.abs(ty - d.ty0) + 1);
      ghostRef.current = { ...ghostRef.current, x: x0, y: y0, w, h, suggested: false };
      syncGhost();
    } else if (d.mode === 'moveGhost') { ghostRef.current = { ...ghostRef.current, x: tx - d.ox, y: ty - d.oy, suggested: false }; syncGhost(); }
    else if (d.mode === 'deco') { ghostRef.current = { ...ghostRef.current, x: tx, y: ty, suggested: false }; syncGhost(); }
    d.lx = x; d.ly = y;
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const sc = sceneRef.current, g = gameRef.current;
    ptrs.current.delete(e.pointerId);
    const d = drag.current; if (!sc || !g || !d) { drag.current = null; return; }
    if (d.mode === 'pinch') { if (ptrs.current.size === 0) drag.current = null; return; }
    drag.current = null;
    const [x, y] = local(e), [tx, ty] = sc.tileAt(x, y);
    if (d.mode === 'carry' && carryRef.current != null) { dropStaff(carryRef.current, tx, ty); return; }
    if (d.mode === 'hold') { dropStaff(d.id, tx, ty); return; }
    if (d.moved) { refresh(); return; }
    // a tap
    if (buildRef.current) { const gb = ghostRef.current; ghostRef.current = { ...gb, x: tx - Math.floor(gb.w / 2), y: ty - Math.floor(gb.h / 2), suggested: false }; syncGhost(); refresh(); return; }
    if (decoRef.current) { ghostRef.current = { ...ghostRef.current, x: tx, y: ty, suggested: false }; syncGhost(); refresh(); return; }
    const p = sc.pick(x, y);
    if (p) { sfx()?.click(); setPanel('none'); }
    setSel(p); refresh();
  };
  const onCancelPtr = (e: React.PointerEvent<HTMLCanvasElement>) => {
    ptrs.current.delete(e.pointerId);
    const d = drag.current;
    if (d && d.mode === 'hold') { gameRef.current?.hold(d.id, false); if (sceneRef.current) sceneRef.current.held = null; }
    drag.current = null;
  };
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); const sc = sceneRef.current; if (!sc) return; const r = c.getBoundingClientRect(); sc.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)); };
    c.addEventListener('wheel', wheel, { passive: false });
    return () => c.removeEventListener('wheel', wheel);
  }, [ready]);

  // ---------------------------------------------------------------- keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (sheetRef.current === 'settings') { setSheet(null); return; }
        if (sheetRef.current === 'bulletin') { closeBulletin(); return; }
        if (screenRef.current === 'clinic') { if (cancelAll()) { refresh(); e.preventDefault(); } }
        return;
      }
      if (screenRef.current !== 'clinic' || sheetRef.current) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); togglePause(); }
      else if (k === '1' || k === '2' || k === '3') setSpeed(Number(k) as 1 | 2 | 3);
      else if (k === 'r') rotate();
      else if (k === 'b') togglePanel('build');
      else if (k === 'enter' && (buildRef.current || decoRef.current)) place();
      refresh();
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
  });

  // ---------------------------------------------------------------- settings
  const setSetting = (k: Exclude<keyof G.Settings, 'speed'>, v: boolean) => {
    const s = saveRef.current; s.settings[k] = v; persist(s);
    if (k === 'sound') sfx()?.setSound(v);
    if (k === 'music') sfx()?.setMusic(v);
    if (k === 'motion' && sceneRef.current) sceneRef.current.reduced = !v;
    const g = gameRef.current;
    if (g && k === 'assist') g.s.assist = v;
    if (g && k === 'strict') g.s.strict = v;
    sfx()?.unlock(); sfx()?.click();
  };
  const muted = !save.settings.sound && !save.settings.music;
  const toggleMute = () => {
    const s = saveRef.current, on = !s.settings.sound && !s.settings.music;
    s.settings.sound = on; s.settings.music = on; persist(s); sfx()?.setSound(on); sfx()?.setMusic(on);
    sfx()?.unlock(); if (on) sfx()?.click();
  };
  const resetAll = () => {
    const s = G.newSave(); s.settings = { ...saveRef.current.settings, sandbox: false };
    gameRef.current = null; sceneRef.current?.setGame(null); persist(s); setConfirm(null); setMapSel('burrow'); setSheet(null); setScreen('title');
  };

  // ---------------------------------------------------------------- the debug hook for the browser tests
  useEffect(() => {
    (window as unknown as { __clinic: () => unknown }).__clinic = () => {
      const g = gameRef.current, sc = sceneRef.current;
      const gb = ghostRef.current;
      const why = g && buildRef.current ? g.canBuild(buildRef.current, gb.x, gb.y, gb.w, gb.h, gb.rot) : g && decoRef.current ? g.canPlace(decoRef.current, gb.x, gb.y) : null;
      return {
        screen: screenRef.current, ready, sheet: sheetRef.current, panel: panelRef.current, paused: pausedRef.current, speed: saveRef.current.settings.speed,
        selected: selRef.current, carry: carryRef.current, drag: drag.current?.mode ?? null, news: news?.text ?? '', build: buildRef.current, deco: decoRef.current,
        ghost: why ? { ...gb, ok: why.ok, reason: why.ok ? '' : (why as { reason: string }).reason } : null,
        dockUp,
        save: saveRef.current, state: g?.s ?? null, clinic: g?.def.id ?? null, H: g?.H ?? 0, advice: g ? g.advice() : [], met,
        scene: sc ? { loaded: sc.loaded, zoom: sc.cam.zoom, w: sc.w, h: sc.h } : null, sound: soundRef.current?.unlocked ?? false,
        debug: {
          open: (id: string, fresh = true) => openClinic(id, fresh),
          run: (n: number) => { if (!g) return; for (let i = 0; i < n; i++) g.tick(); onEvents(g, performance.now()); refresh(); },
          build: (kind: G.RoomKind) => { if (!g) return null; const s = g.suggest(kind); if (!s) return null; const r = g.build(kind, s.x, s.y, s.w, s.h, s.rot); refresh(); return r; },
          place: (kind: G.DecoKind) => { if (!g) return null; const p = g.suggestDeco(kind); if (!p) return null; const r = g.place(kind, p[0], p[1]); refresh(); return r; },
          hire: (role: G.Role) => { if (!g) return null; const c = g.s.cands.find((q) => q.role === role); if (!c) return null; g.s.coins += c.wage; const r = g.hire(c.id); refresh(); return r; },
          emergency: (ail: G.AilmentId | null = null) => { if (!g) return false; const ok = g.trigger('emergency', ail); onEvents(g, performance.now()); refresh(); return ok; },
          meet: () => { if (!g) return; g.s.tut = G.TUT_STEPS; g.s.open = true; g.s.cures = Math.max(g.s.cures, g.def.goals.cures); g.s.rep = Math.max(g.s.rep, Math.max(g.def.goals.rep, g.def.starRep)); g.s.coins = Math.max(g.s.coins, g.def.goals.coins + 10); g.tick(); onEvents(g, performance.now()); refresh(); },
          coins: (n: number) => { if (g) { g.s.coins = n; refresh(); } },
          /** page coordinates of a tile's centre */
          screenOf: (x: number, y: number) => { const c = canvasRef.current; if (!c || !sc) return null; const r = c.getBoundingClientRect(); const [sx, sy] = sc.tileToScreen(x, y); return { x: r.left + sx, y: r.top + sy }; },
          fit: () => sc?.fit(true),
          /** what a click at these page coordinates would pick */
          pickAt: (px: number, py: number) => { const c = canvasRef.current; if (!c || !sc) return null; const r = c.getBoundingClientRect(); return sc.pick(px - r.left, py - r.top); },
          select: (type: 'patient' | 'staff' | 'room' | 'deco' | 'walker', id: number) => { setPanel('none'); setSel({ type, id }); refresh(); },
          /** jump to the last tick of the day: wages, the Bulletin and any raise request follow */
          endDay: () => { if (!g) return; g.s.open = true; g.s.tut = G.TUT_STEPS; g.s.t = Math.ceil((g.s.t + 1) / G.DAY) * G.DAY - 1; g.tick(); onEvents(g, performance.now()); refresh(); },
          /** a staff member asks for a raise right now */
          raise: (id?: number) => { if (!g) return null; const st = id ? g.staffById(id) : g.s.staff[0]; if (!st) return null; g.s.raise = { id: 9000 + g.s.t, staff: st.id, amount: 20, expires: g.s.t + G.DAY }; g.events.push({ t: 'raise', id: st.id }); onEvents(g, performance.now()); refresh(); return st.id; },
          /** almost enough experience for a new star */
          nearStar: (id: number) => { if (!g) return; const st = g.staffById(id); if (st) { st.skill = Math.min(st.skill, 4); st.xp = G.XP_FOR(st.skill) - 0.5; } },
          scenePick: () => sc ? { zoom: sc.cam.zoom, min: sc.minZoom, cam: { ...sc.cam } } : null,
          /** which ailment each patient visibly showed in the last drawn frame */
          ailFx: () => sc ? Object.fromEntries(sc.fxSeen) : {},
          /** a new patient with this ailment walks in (optionally already diagnosed) */
          patient: (ail: G.AilmentId, sp?: G.SpeciesId, diagnosed = false) => { if (!g) return null; g.s.open = true; const p = g.spawnPatient(ail, sp); if (diagnosed) { p.dx = ail; p.sure = true; } refresh(); return p.id; },
        },
      };
    };
  });

  // ================================================================ views
  const g = gameRef.current;
  const def = g?.def;
  const s = g?.s;
  const sandbox = def?.twist === 'sandbox';
  const tut = s && s.tut < G.TUT_STEPS ? s.tut : -1;
  const advice = g && s && s.assist && tut < 0 ? g.advice() : [];
  const tip = advice.find((a) => a.id !== tipHidden) ?? null;
  const tipRole = tip?.act?.hire ?? null;
  /** the tutorial highlight: which button to press next */
  const hl = (() => {
    if (tut < 0 || tut === 5 || !g) return '';
    const room = (['reception', null, 'checkup', null, 'fluff'] as (G.RoomKind | null)[])[tut];
    if (room) return panel !== 'build' ? 'tool-build' : buildKind !== room ? `card-${room}` : 'place';
    const role = tut === 1 ? 'recep' : 'vet';
    return panel !== 'hire' ? 'tool-hire' : `hire-${role}`;
  })();
  const H = (id: string) => (hl === id ? ' hc-hl' : '');
  const icon = (n: string) => <Img n={`i-${n}`} className="hc-ico" />;

  // ---- title
  const titleView = (
    <section className="hc-title">
      <Img n="title" alt="Dora and Enzo outside their burrow clinic, waving to a queue of Andean animal patients" className="hc-title-art" />
      <div className="hc-title-box">
        <p className="hc-kicker">Dora &amp; Enzo’s</p>
        <h1 className="hc-logo">Burrow Clinic</h1>
        <p className="hc-sub">Build a cosy clinic, hire chinchilla vets and cure the silliest ailments in the Andes.</p>
        <div className="hc-title-btns">
          <button className="hc-btn hc-btn-big hc-btn-go" data-act="play" onClick={() => { sfx()?.unlock(); sfx()?.click(); setScreen('map'); }}>Play</button>
          <button className="hc-btn" data-act="settings" onClick={() => { sfx()?.unlock(); sfx()?.click(); setSheet('settings'); }}>Settings</button>
          <a className="hc-btn hc-btn-ghost" href="/">Arcade</a>
        </div>
      </div>
    </section>
  );

  // ---- map
  const selDef = G.ALL_CLINICS.find((c) => c.id === mapSel) ?? G.CLINICS[0];
  const selOpen = selDef.id === 'sandbox' ? G.sandboxOpen(save) : G.clinicOpen(save, selDef.index);
  const cur = save.current;
  const lockText = (c: G.ClinicDef) => c.id === 'sandbox' ? `The Sandbox opens once you meet the goals at ${G.CLINICS[1].name}, or turn it on in Settings.` : `Meet the goals at ${G.CLINICS[c.index - 1].name} to open ${c.name}.`;
  const mapView = (
    <section className="hc-map">
      <header className="hc-map-top">
        <button className="hc-round" aria-label="Back to the title" data-act="title" onClick={() => { sfx()?.click(); setScreen('title'); }}>{icon('home')}</button>
        <h2 className="hc-h2">The Andes Road</h2>
        <span className="hc-pill hc-pill-stars">{icon('star')}<b>{G.totalStars(save)}</b>/18</span>
        <button className="hc-round" aria-label={muted ? 'Sound on' : 'Mute'} data-act="mute" onClick={toggleMute}>{icon(muted ? 'no' : 'bell')}</button>
        <button className="hc-round" aria-label="Settings" data-act="settings" onClick={() => { sfx()?.click(); setSheet('settings'); }}>{icon('gear')}</button>
      </header>
      <div className="hc-map-body">
        <div className="hc-map-frame">
          <div className="hc-map-art">
            <Img n="map" alt="A travel poster of the Andes: six clinics joined by a dotted road, with Dora and Enzo riding a red scooter" />
            {G.CLINICS.map((c) => {
              const open = G.clinicOpen(save, c.index), [px, py] = PINS[c.id];
              return (
                <button key={c.id} className={`hc-pin${open ? '' : ' hc-locked'}${mapSel === c.id ? ' hc-sel' : ''}`} style={{ left: `${px * 100}%`, top: `${py * 100}%` }}
                  data-clinic={c.id} aria-label={`${c.name}${open ? '' : ' (locked)'}`} onClick={() => { sfx()?.unlock(); sfx()?.click(); setMapSel(c.id); }}>
                  <span className="hc-pin-n">{c.index + 1}</span>
                  <span className="hc-pin-name">{c.name}</span>
                  {open ? <Stars n={save.stars[c.id] ?? 0} /> : <span className="hc-pin-lock">Locked</span>}
                </button>
              );
            })}
          </div>
        </div>
        <aside className="hc-map-card hc-card">
          <div className="hc-card-head">
            <span className="hc-badge">{selDef.id === 'sandbox' ? '★' : selDef.index + 1}</span>
            <div><h3>{selDef.name}</h3><p className="hc-dim">{selDef.place}</p></div>
            {selDef.id !== 'sandbox' && selOpen && <Stars n={save.stars[selDef.id] ?? 0} />}
          </div>
          <p>{selDef.blurb}</p>
          <p className="hc-twist"><b>Twist:</b> {selDef.twistText}</p>
          {selDef.id !== 'sandbox' && <p className="hc-goals-line"><b>Goals:</b> cure {selDef.goals.cures}, reach {selDef.goals.rep}% reputation and {fmt(selDef.goals.coins)} coins within {selDef.days} days. <span className="hc-dim">Two stars by day {selDef.fastDay}; three with {selDef.starRep}% reputation too.</span></p>}
          {save.best[selDef.id] ? <p className="hc-dim">Best: goals met on day {save.best[selDef.id]}.</p> : null}
          {!selOpen && <p className="hc-lock-why" data-lock={selDef.id}>{lockText(selDef)}</p>}
          <div className="hc-card-btns">
            {selOpen && cur && cur.clinic === selDef.id && <button className="hc-btn hc-btn-go" data-act="continue" onClick={() => openClinic(selDef.id, false)}>Continue (day {cur.day})</button>}
            <button className={`hc-btn${cur && cur.clinic === selDef.id ? '' : ' hc-btn-go'}`} data-act="start" aria-disabled={!selOpen}
              onClick={() => { if (!selOpen) { sfx()?.unlock(); sfx()?.no(); return; } openClinic(selDef.id, true); }}>
              {cur && cur.clinic === selDef.id ? 'Start again' : 'Open the clinic'}
            </button>
          </div>
          {selOpen && cur && cur.clinic !== selDef.id && <p className="hc-dim hc-small">Opening this clinic sets aside your {G.clinicById(cur.clinic).name} in progress (its stars stay yours).</p>}
          <button className={`hc-btn hc-btn-sandbox${G.sandboxOpen(save) ? '' : ' hc-locked'}${mapSel === 'sandbox' ? ' hc-sel' : ''}`} data-act="sandbox" onClick={() => { sfx()?.unlock(); sfx()?.click(); setMapSel('sandbox'); }}>
            Sandbox{G.sandboxOpen(save) ? '' : ' (locked)'}
          </button>
        </aside>
      </div>
    </section>
  );

  // ---- clinic: the top bar
  const goalsList = g ? g.goals() : [];
  const pill = (id: string, ic: string, label: string, have: number, need: number, text: string, pop = 0) => (
    <span className={`hc-pill hc-pill-${id}`} title={label} data-pill={id}>
      <span key={pop} className={pop ? 'hc-pop' : ''}>{icon(ic)}</span>
      <span className="hc-pill-body"><span className="hc-pill-text"><b>{text}</b>{!sandbox && need > 0 && <span className="hc-dim">/{fmt(need)}{id === 'rep' ? '%' : ''}</span>}</span>
        {!sandbox && need > 0 && <Bar k={have / need} tone={have >= need ? 'mint' : id === 'rep' ? 'coral' : id === 'coins' ? 'mustard' : 'teal'} />}</span>
    </span>
  );
  const topBar = g && s && def && (
    <header className="hc-top">
      <button className="hc-round" aria-label="Back to the map" data-act="map" onClick={toMap}>{icon('home')}</button>
      <div className="hc-pills">
        {pill('coins', 'coin', 'Coins', s.coins, goalsList[2]?.need ?? 0, fmt(s.coins), Math.round(s.earned))}
        {pill('rep', 'heart', 'Reputation', s.rep, goalsList[1]?.need ?? 0, `${Math.round(s.rep)}%`)}
        {pill('cures', 'star', 'Cures', s.cures, goalsList[0]?.need ?? 0, fmt(s.cures), s.cures)}
      </div>
      <div className="hc-time">
        <span className="hc-pill hc-pill-day" data-pill="day">{icon('calendar')}<b>Day {s.day}</b>{!sandbox && <span className="hc-dim">/{def.days}</span>}<span className="hc-clock">{s.open ? G.clockText(s) : 'Closed'}</span></span>
        <button className={`hc-round${paused ? ' hc-on' : ''}`} aria-label={paused ? 'Play' : 'Pause'} data-act="pause" onClick={togglePause}>{icon(paused ? 'play' : 'pause')}</button>
        {([1, 2, 3] as const).map((n) => <button key={n} className={`hc-speed${!paused && save.settings.speed === n ? ' hc-on' : ''}`} data-speed={n} aria-label={`Speed ${n}×`} onClick={() => setSpeed(n)}>{n}×</button>)}
        <button className="hc-round" aria-label={muted ? 'Sound on' : 'Mute'} data-act="mute" onClick={toggleMute}>{icon(muted ? 'no' : 'bell')}</button>
        <button className="hc-round" aria-label="Settings" data-act="settings" onClick={() => { sfx()?.click(); setSheet('settings'); }}>{icon('gear')}</button>
      </div>
    </header>
  );

  // ---- the toolbar
  const tools = g && (
    <nav className="hc-tools" aria-label="Clinic tools">
      <button className={`hc-tool${panel === 'build' ? ' hc-on' : ''}${H('tool-build')}`} data-tool="build" onClick={() => togglePanel('build')}>{icon('build')}<span>Build</span></button>
      <button className={`hc-tool${panel === 'decor' ? ' hc-on' : ''}`} data-tool="decor" onClick={() => togglePanel('decor')}><Img n="d-plant" className="hc-ico" /><span>Decor</span></button>
      <button className={`hc-tool${panel === 'hire' ? ' hc-on' : ''}${H('tool-hire')}`} data-tool="hire" onClick={() => togglePanel('hire')}>{icon('staff')}<span>Hire</span></button>
      <button className={`hc-tool${panel === 'none' && !sel ? ' hc-on' : ''}`} data-tool="overview" onClick={() => { sfx()?.click(); setPanel('none'); setSel(null); setBuildKind(null); setDecoKind(null); }}>{icon('calendar')}<span>Clinic</span></button>
      <button className="hc-tool" data-tool="fit" onClick={() => { sfx()?.click(); sceneRef.current?.fit(); }}>{icon('move')}<span>View</span></button>
    </nav>
  );

  // ---- dock: notes
  const enzoNote = tut >= 0 && (
    <div className="hc-note hc-note-enzo" data-tut={tut}>
      <Img n="p-enzo" alt="Enzo" className="hc-note-face" />
      <div><p className="hc-note-who">Enzo · step {tut + 1} of {G.TUT_STEPS}</p><p>{TUT_TEXT[tut]}</p></div>
    </div>
  );
  const tipNote = tip && !s?.offer && (
    <div className="hc-note hc-note-dora" data-tip={tip.id}>
      <Img n="p-dora" alt="Dora" className="hc-note-face" />
      <div>
        <p className="hc-note-who">Dora’s tip</p><p>{tip.text}</p>
        <div className="hc-note-btns">
          {tip.act && <button className="hc-btn hc-btn-small hc-btn-go" data-act="tip" onClick={() => {
            const a = tip.act!;
            if (a.hire) { setPanel('hire'); setHireRole(a.hire); setSel(null); setBuildKind(null); setDecoKind(null); sfx()?.click(); }
            else if (a.build) { setPanel('build'); pickRoom(a.build); }
            else if (a.place) { setPanel('decor'); pickDeco(a.place); }
          }}>Show me</button>}
          <button className="hc-btn hc-btn-small hc-btn-ghost" data-act="tip-hide" onClick={() => { setTipHidden(tip.id); sfx()?.click(); }}>Later</button>
        </div>
      </div>
    </div>
  );
  const offer = s?.offer;
  const offerCard = offer && (
    <div className="hc-card hc-emerg" data-card="emergency">
      <div className="hc-burst-badge">!</div>
      <Img n={`face-${offer.sp}`} alt="" className="hc-emerg-face" />
      <div>
        <h3>Emergency!</h3>
        <p>{offer.count} {G.SPECIES[offer.sp].plural} with <b>{G.AILMENTS[offer.ail].name}</b> need help. Cure them all within {offer.hours} hours for a bonus of <b>{fmt(offer.bonus)} coins</b>.</p>
        <p className="hc-dim hc-small">Saying no costs nothing. The clock is paused while you decide.</p>
        <div className="hc-card-btns">
          <button className="hc-btn hc-btn-go" data-act="accept" onClick={() => respond(true)}>{icon('ok')}Yes, send them</button>
          <button className="hc-btn" data-act="decline" onClick={() => respond(false)}>{icon('no')}Not today</button>
        </div>
      </div>
    </div>
  );
  const raise = s?.raise;
  const raiseSt = raise && g ? g.staffById(raise.staff) : null;
  const raiseCard = raise && raiseSt && (
    <div className="hc-card hc-raise" data-card="raise">
      <Img n={`p-${raiseSt.look}`} alt="" className="hc-emerg-face" />
      <div>
        <h3>{raiseSt.name} would like a raise</h3>
        <p>{raiseSt.name} has grown to <b>{raiseSt.skill} stars</b> and asks for <b>{raise.amount} more coins a day</b> ({raiseSt.wage} now, {raiseSt.wage + raise.amount} after).</p>
        <p className="hc-dim hc-small">Saying no is fine: they will feel a little glum for a while, but nobody quits over it.</p>
        <div className="hc-card-btns">
          <button className="hc-btn hc-btn-go" data-act="raise-yes" onClick={() => answerRaise(true)}>{icon('ok')}Yes, well earned</button>
          <button className="hc-btn" data-act="raise-no" onClick={() => answerRaise(false)}>{icon('no')}Not now</button>
        </div>
      </div>
    </div>
  );
  const newsLine = news && <p key={news.key} className={`hc-news${news.bad ? ' hc-bad' : ''}`} role="status" data-news>{news.text}</p>;

  // ---- dock: build cards
  const ghostWhy = (() => {
    if (!g) return null;
    const gb = ghostRef.current;
    if (buildKind) return g.canBuild(buildKind, gb.x, gb.y, gb.w, gb.h, gb.rot);
    if (decoKind) return g.canPlace(decoKind, gb.x, gb.y);
    return null;
  })();
  const buildBar = (buildKind || decoKind) && ghostWhy && (
    <div className={`hc-ghostbar${ghostWhy.ok ? ' hc-ok' : ' hc-bad'}`} data-ghost={ghostWhy.ok ? 'ok' : 'bad'}>
      <p className="hc-ghost-why">
        {ghostWhy.ok
          ? buildKind ? `${ghostRef.current.suggested ? 'Try here! ' : 'Fits here. '}${G.ROOMS[buildKind].name}, ${ghostRef.current.w}×${ghostRef.current.h}: ${fmt((ghostWhy as { cost: number }).cost)} coins.` : `${ghostRef.current.suggested ? 'Try here! ' : 'Fits here. '}${G.DECOS[decoKind!].name}: ${G.DECOS[decoKind!].cost} coins.`
          : `Can’t go here: ${(ghostWhy as { reason: string }).reason}`}
      </p>
      <p className="hc-dim hc-small">{buildKind ? 'Drag on the floor to draw the room, drag the ghost to move it, or tap to move it there.' : 'Tap or drag on the floor to move it.'}</p>
      <div className="hc-ghost-btns">
        <button className="hc-round hc-big" aria-label="Another spot" title="Another spot" data-act="another" onClick={anotherSpot}>{icon('move')}</button>
        {(buildKind || (decoKind && G.DECOS[decoKind].facings > 1)) && <button className="hc-round hc-big" aria-label="Rotate (R)" title="Rotate (R)" data-act="rotate" onClick={rotate}>{icon('rotate')}</button>}
        <button className={`hc-round hc-big hc-go${H('place')}`} aria-label="Place it" title="Place it (Enter)" data-act="place" onClick={place}>{icon('ok')}</button>
        <button className="hc-round hc-big hc-stop" aria-label="Cancel" title="Cancel (Esc)" data-act="cancel" onClick={cancelBuild}>{icon('no')}</button>
      </div>
    </div>
  );
  const buildCards = g && def && (
    <div className="hc-cards" data-panel="build">
      <h3 className="hc-panel-h">Build a room</h3>
      {G.ROOM_ORDER.filter((k) => def.rooms.includes(k) || G.CLINICS.some((c) => c.rooms.includes(k))).map((k) => {
        const d = G.ROOMS[k], open = def.rooms.includes(k), afford = (s?.coins ?? 0) >= d.cost;
        return (
          <button key={k} className={`hc-bcard${buildKind === k ? ' hc-on' : ''}${open ? '' : ' hc-locked'}${H(`card-${k}`)}`} data-room={k} onClick={() => pickRoom(k)} aria-disabled={!open}>
            <Img n={`m-${d.machine}`} className="hc-bcard-art" />
            <span className="hc-bcard-txt"><b>{d.name}</b>
              <span className="hc-small">{open ? <>{icon('coin')}{fmt(d.cost)} · {d.minW}×{d.minH}{d.staff ? ` · ${G.ROLES[d.staff].name.toLowerCase()}` : ''}{!afford && <em className="hc-need"> need {fmt(d.cost)}</em>}</> : `Opens at ${unlockAt(k)}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
  const decoCards = g && def && (
    <div className="hc-cards" data-panel="decor">
      <h3 className="hc-panel-h">Decorations</h3>
      {G.DECO_ORDER.map((k) => {
        const d = G.DECOS[k], open = def.decos.includes(k);
        return (
          <button key={k} className={`hc-bcard${decoKind === k ? ' hc-on' : ''}${open ? '' : ' hc-locked'}`} data-deco={k} onClick={() => pickDeco(k)} aria-disabled={!open} title={d.blurb}>
            <Img n={`d-${k}`} className="hc-bcard-art" />
            <span className="hc-bcard-txt"><b>{d.name}</b><span className="hc-small">{open ? <>{icon('coin')}{d.cost} · {d.blurb}</> : `Arrives at ${decoAt(k)}`}</span></span>
          </button>
        );
      })}
    </div>
  );

  // ---- dock: hiring
  const roles = g ? G.ROLE_ORDER.filter((r) => g.s.cands.some((c) => c.role === r)) : [];
  const wantRole = hireRole ?? tipRole ?? (tut === 1 ? 'recep' : tut === 3 ? 'vet' : null);
  const suggestId = g && wantRole ? g.suggestHire(wantRole)?.id ?? -1 : -1;
  const team = s ? s.staff.filter((x) => x.state !== 'gone' && x.state !== 'leave') : [];
  const hirePanel = g && s && (
    <div className="hc-hire" data-panel="hire">
      <h3 className="hc-panel-h">Hire staff <span className="hc-dim hc-small">a day’s wage up front, then wages each evening</span></h3>
      {roles.map((r) => {
        const cands = s.cands.filter((c) => c.role === r);
        return (
          <section key={r} className={`hc-role${wantRole === r ? ' hc-want' : ''}`}>
            <h4>{G.ROLES[r].plural} <span className="hc-dim hc-small">{G.ROLES[r].blurb}</span></h4>
            {cands.map((c, i) => {
              const short = s.coins < c.wage;
              const first = i === 0 && hl === `hire-${r}`;
              return (
                <div key={c.id} className={`hc-cand${c.id === suggestId ? ' hc-sugg' : ''}`} data-cand={c.id} data-role={r}>
                  <Img n={`p-${c.look}`} alt="" className="hc-cand-face" />
                  <div className="hc-cand-txt">
                    <b>{c.name}</b> <Stars n={c.skill} of={5} />
                    <span className="hc-small"><span className="hc-trait" title={G.TRAITS[c.trait].blurb}>{G.TRAITS[c.trait].name}</span> {G.TRAITS[c.trait].blurb}</span>
                  </div>
                  <button className={`hc-btn hc-btn-small${c.id === suggestId || first ? ' hc-btn-go' : ''}${first ? ' hc-hl' : ''}`} data-act="hire" aria-disabled={short}
                    onClick={() => hire(c)}>{icon('coin')}{c.wage}{short ? <em className="hc-need"> too dear</em> : null}</button>
                </div>
              );
            })}
          </section>
        );
      })}
      {team.length > 0 && (
        <section className="hc-role">
          <h4>Your team <span className="hc-dim hc-small">tap to see, or drag them into a room on the floor</span></h4>
          <div className="hc-team">
            {team.map((x) => (
              <button key={x.id} className="hc-mate" data-staff={x.id} onClick={() => { setPanel('none'); setSel({ type: 'staff', id: x.id }); const sc = sceneRef.current; if (sc) sc.focus(x.x, x.y, Math.max(sc.cam.zoom, sc.fitZoom * 1.4)); sfx()?.click(); }}>
                <Img n={`p-${x.look}`} alt="" /><span>{x.name}</span><Bar k={x.energy / 100} tone={x.energy < 30 ? 'coral' : 'mint'} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // ---- dock: info cards
  const info = (() => {
    if (!g || !s || !sel) return null;
    if (sel.type === 'patient') {
      const p = g.patientById(sel.id); if (!p || p.phase === 'gone') return null;
      const mood = p.patience >= 60 ? 'happy' : p.patience >= 30 ? 'meh' : 'grumpy';
      return (
        <div className="hc-card hc-info" data-card="patient">
          <div className="hc-card-head"><Img n={`face-${p.sp}`} alt="" className="hc-info-face" /><div><h3>{p.name}{p.vip && <span className="hc-tag">VIP</span>}{p.emerg ? <span className="hc-tag hc-tag-coral">Emergency</span> : null}</h3><p className="hc-dim">{/^[aeiou]/.test(G.SPECIES[p.sp].name) ? 'an' : 'a'} {G.SPECIES[p.sp].name} · {PHASE_TEXT[p.phase]}</p></div><Img n={`i-${mood}`} alt={mood} className="hc-info-mood" /></div>
          <p>{p.cured ? 'All better!' : p.dx ? <><b>{G.AILMENTS[p.dx].name}</b>{p.dx === p.ail || !p.wrongs.length ? '' : ''}: {G.AILMENTS[p.dx].blurb}</> : 'Not diagnosed yet: a vet will find out what is wrong at a check-up.'}</p>
          {!p.cured && <p className="hc-dim">Next stop: {G.ROOMS[p.need].name}{!g.hasRoom(p.need) ? ' (not built yet!)' : ''}</p>}
          <div className="hc-meters"><span>Patience</span><Bar k={p.patience / 100} tone={p.patience < 30 ? 'coral' : 'mint'} /><span>Thirst</span><Bar k={p.thirst / 100} tone={p.thirst > 75 ? 'coral' : 'teal'} /></div>
          {(() => {
            const why = g.whyOf(p);
            return why.length > 0 && (
              <div className="hc-why" data-why={why.map((w) => w.id).join(' ')}>
                <span className="hc-dim hc-small">Feeling this way because:</span>
                <ul>{why.map((w) => <li key={w.id} className={w.good ? 'hc-good' : 'hc-badw'}>{icon(WHY_ICON[w.id])}{w.text}</li>)}</ul>
              </div>
            );
          })()}
          {p.cured && p.gift > 0 && <p className="hc-dim hc-gift">{<Img n={`b-gift${p.gift}`} className="hc-ico" />}Going home with a {p.gift <= 2 ? 'balloon' : p.gift === 3 ? 'lollipop' : 'pinwheel'}.</p>}
        </div>
      );
    }
    if (sel.type === 'staff') {
      const x = g.staffById(sel.id); if (!x || x.state === 'gone') return null;
      const home = x.home ? g.roomById(x.home) : null;
      const sr = g.roomsOf('staff')[0];
      return (
        <div className="hc-card hc-info" data-card="staff">
          <div className="hc-card-head"><Img n={`p-${x.look}`} alt="" className="hc-info-face" /><div><h3>{x.name}</h3><p className="hc-dim">{G.ROLES[x.role].name} · {STATE_TEXT[x.state]}</p></div><Stars n={x.skill} of={5} /></div>
          <p><span className="hc-trait">{G.TRAITS[x.trait].name}</span> {G.TRAITS[x.trait].blurb} Wage {x.wage} a day.</p>
          <p className="hc-dim">{home ? `Works in the ${G.ROOMS[home.kind].name}.` : x.role === 'cleaner' ? 'Roams the clinic fixing, sweeping and watering.' : 'Goes wherever they are needed.'}</p>
          <div className="hc-meters" data-growth={x.id}>
            <span>Energy</span><Bar k={x.energy / 100} tone={x.energy < 30 ? 'coral' : 'mint'} />
            <span>{x.skill >= 5 ? 'Top marks' : 'Next star'}</span><Bar k={x.skill >= 5 ? 1 : x.xp / G.XP_FOR(x.skill)} tone="mustard" />
            <span>Mood</span><Bar k={x.mood / 100} tone={x.mood < 35 ? 'coral' : 'teal'} />
          </div>
          <p className="hc-dim hc-small">{x.jobs} jobs done, {x.today} today. {MOOD_TEXT(x.mood)}.{g.teacher() === x ? ' Can teach in the Staff Room.' : ''}</p>
          {x.state !== 'leave' && (
            <div className="hc-card-btns">
              <button className="hc-btn hc-btn-small" data-act="pickup" onClick={() => pickUp(x)}>{icon('move')}Pick up</button>
              <button className="hc-btn hc-btn-small" data-act="rest" aria-disabled={!sr} onClick={() => sendRest(x)}>{icon('sleepy')}Rest</button>
              {confirm === `fire-${x.id}`
                ? <><button className="hc-btn hc-btn-small hc-btn-stop" data-act="fire-yes" onClick={() => fire(x)}>Let {x.name} go</button><button className="hc-btn hc-btn-small hc-btn-ghost" data-act="fire-no" onClick={() => setConfirm(null)}>Keep</button></>
                : <button className="hc-btn hc-btn-small hc-btn-ghost" data-act="fire" onClick={() => { setConfirm(`fire-${x.id}`); sfx()?.click(); }}>Fire</button>}
            </div>
          )}
        </div>
      );
    }
    if (sel.type === 'room') {
      const r = g.roomById(sel.id); if (!r) return null;
      const d = G.ROOMS[r.kind], st = r.staff ? g.staffById(r.staff) : null;
      const q = r.slots.find((x) => x.patient) ?? r.slots[0];
      const p = q && q.patient ? g.patientById(q.patient) : null;
      const k = p && d.work ? Math.min(1, q.progress / d.work) : 0;
      const queue = s.patients.filter((x) => x.phase === 'wait' && x.need === r.kind).length;
      const wear = Math.max(0, ...r.slots.map((x) => x.wear));
      const broken = r.slots.some((x) => x.broken);
      const mood = p ? (p.patience >= 60 ? 'happy' : p.patience >= 30 ? 'meh' : 'grumpy') : 'happy';
      const C = 2 * Math.PI * 26;
      return (
        <div className="hc-card hc-info" data-card="room">
          <div className="hc-card-head">
            <svg className="hc-ring" viewBox="0 0 64 64" aria-label={p ? `Treatment ${Math.round(k * 100)}% done` : 'Nobody inside'}>
              <circle cx="32" cy="32" r="30" className="hc-ring-bg" /><circle cx="32" cy="32" r="26" className="hc-ring-track" />
              <circle cx="32" cy="32" r="26" className="hc-ring-fill" strokeDasharray={`${C * k} ${C}`} transform="rotate(-90 32 32)" />
              <image href={`${ART}i-${p ? mood : 'happy'}.webp`} x="18" y="18" width="28" height="28" opacity={p ? 1 : 0.35} />
            </svg>
            <div><h3>{d.name}</h3><p className="hc-dim">{r.w}×{r.h} · {r.kind === 'staff' ? `${s.staff.filter((x) => x.state === 'rest').length} resting` : p ? `Seeing ${p.name}` : 'Nobody inside'}</p></div>
          </div>
          <p>{d.blurb}</p>
          {d.staff && <p className="hc-dim">{st ? `${st.name} is on duty.` : `No ${G.ROLES[d.staff].name.toLowerCase()} here right now.`} {queue ? `${queue} waiting.` : ''}</p>}
          {d.staff && r.kind !== 'reception' && <div className="hc-meters"><span>Wear</span><Bar k={wear / 100} tone={wear >= 75 ? 'coral' : 'mustard'} /></div>}
          {broken && <p className="hc-bad-text">Broken down: a cleaner will fix it.</p>}
          {G.canUpgrade(r.kind) && (
            <div className="hc-upgrade" data-level={r.level}>
              <span className="hc-small"><b>Machine level {r.level}</b> <Stars n={r.level} of={3} /> {r.level >= 3 ? 'As shiny as it gets.' : `Level ${r.level + 1}: cures ${Math.round((G.UPGRADE_SPEED[r.level + 1] - 1) * 100)}% quicker, wears out ${Math.round((1 - G.UPGRADE_WEAR[r.level + 1]) * 100)}% slower.`}</span>
              {r.level < 3 && <button className="hc-btn hc-btn-small hc-btn-go" data-act="upgrade" aria-disabled={s.coins < g.upgradeCost(r)} onClick={() => upgradeRoom(r)}><Img n="b-spanner" className="hc-ico" />{fmt(g.upgradeCost(r))}</button>}
            </div>
          )}
          {r.kind === 'staff' && (() => {
            const t = g.teacher();
            return (
              <label className="hc-toggle hc-train" data-setting="train">
                <input type="checkbox" data-act="train" checked={r.train} onChange={(e) => setTraining(r, e.target.checked)} />
                <span className="hc-switch" aria-hidden="true" />
                <span><b>Training</b><span className="hc-dim hc-small">{t ? `${t.name} (${t.skill} stars) teaches everyone who rests here: they slowly earn stars. ${G.TRAIN_COST} coins a day.` : 'Needs a vet with three stars or more to teach.'}</span></span>
              </label>
            );
          })()}
          <div className="hc-card-btns">
            <button className="hc-btn hc-btn-small" data-act="zoom" onClick={() => { const sc = sceneRef.current; if (sc) sc.focus(r.x + r.w / 2 - 0.5, r.y + r.h / 2 - 0.5, sc.fitZoom * 2.4); sfx()?.click(); }}>{icon('move')}Look closer</button>
            <button className="hc-btn hc-btn-small" data-act="door" onClick={() => moveDoor(r)}>{icon('rotate')}Move door</button>
            {confirm === `sell-${r.id}`
              ? <><button className="hc-btn hc-btn-small hc-btn-stop" data-act="sell-yes" onClick={() => sellRoom(r)}>Sell for {fmt(r.cost / 2)}</button><button className="hc-btn hc-btn-small hc-btn-ghost" data-act="sell-no" onClick={() => setConfirm(null)}>Keep</button></>
              : <button className="hc-btn hc-btn-small" data-act="sell" onClick={() => { setConfirm(`sell-${r.id}`); sfx()?.click(); }}>{icon('sell')}Sell</button>}
          </div>
        </div>
      );
    }
    if (sel.type === 'deco') {
      const dd = s.decos.find((x) => x.id === sel.id); if (!dd) return null;
      const d = G.DECOS[dd.kind];
      return (
        <div className="hc-card hc-info" data-card="deco">
          <div className="hc-card-head"><Img n={`d-${dd.kind}`} alt="" className="hc-info-face" /><div><h3>{d.name}</h3><p className="hc-dim">{d.blurb}</p></div></div>
          {dd.kind === 'plant' && <div className="hc-meters"><span>Water</span><Bar k={dd.water / 100} tone={dd.water <= 25 ? 'coral' : 'teal'} /></div>}
          {d.facings > 1 && <p className="hc-dim hc-small" data-facing={dd.rot}>{d.seats ? 'Patients sit facing the way it faces.' : d.id === 'cooler' || d.id === 'vending' ? 'Thirsty patients drink at its front.' : 'Turn it to face the corridor.'}</p>}
          <div className="hc-card-btns">
            {d.facings > 1 && <button className="hc-btn hc-btn-small" data-act="rotate-deco" onClick={() => rotateDeco(dd)}>{icon('rotate')}Rotate</button>}
            <button className="hc-btn hc-btn-small" data-act="sell-deco" onClick={() => sellDeco(dd)}>{icon('sell')}Sell for {Math.round(dd.cost / 2)}</button>
          </div>
        </div>
      );
    }
    if (sel.type === 'walker') {
      const w = s.walkers.find((x) => x.id === sel.id); if (!w) return null;
      const who = w.who === 'inspector' ? 'The inspector' : w.who === 'dora' ? 'Dora' : 'Enzo';
      const text = w.who === 'inspector' ? 'A health inspector, visiting a few rooms. Clean floors and smiling patients make for a good report.' : `${who} runs this clinic and wanders the floor cheering up anyone who is waiting.`;
      return (
        <div className="hc-card hc-info" data-card="walker">
          <div className="hc-card-head"><Img n={`p-${w.who === 'inspector' ? 'owl' : w.who}`} alt="" className="hc-info-face" /><div><h3>{who}</h3><p className="hc-dim">{w.who === 'inspector' ? 'Visiting' : 'Owner'}</p></div></div>
          <p>{text}</p>
        </div>
      );
    }
    return null;
  })();
  if (sel && !info && g) queueMicrotask(() => { if (selRef.current === sel) setSel(null); });

  // ---- dock: overview
  const emerg = s?.emergencies.filter((e) => !e.done) ?? [];
  const overview = g && s && def && (
    <div className="hc-card hc-over" data-panel="overview">
      <h3>{def.name}</h3>
      {sandbox ? <p>No goals here: build whatever you like.</p> : (
        <>
          <ul className="hc-goals">
            {goalsList.map((x) => (
              <li key={x.id} className={x.done ? 'hc-done' : ''} data-goal={x.id}>
                {icon(x.id === 'cures' ? 'star' : x.id === 'rep' ? 'heart' : 'coin')}<span>{x.label}</span><b>{fmt(x.have)}{x.id === 'rep' ? '%' : ''} / {fmt(x.need)}{x.id === 'rep' ? '%' : ''}</b><Bar k={x.have / x.need} tone={x.done ? 'mint' : 'teal'} />
              </li>
            ))}
          </ul>
          <p className="hc-dim hc-small">Day {s.day} of {def.days}. Meet every goal by day {def.fastDay} for a second star, with {def.starRep}% reputation for the third.{s.day > def.days ? ' The day limit has passed: you can still meet the goals for one star.' : ''}</p>
        </>
      )}
      {(() => {
        const cs = g.complaints();
        return (
          <div className="hc-complaints" data-complaints={cs.length}>
            <h4>Mood: top complaints</h4>
            {cs.length ? <ul>{cs.map((c) => (
              <li key={c.id} data-complaint={c.id}>{icon(WHY_ICON[c.id])}<span>{c.text} <span className="hc-dim">×{c.count}</span></span>
                <button className="hc-btn hc-btn-small" data-act="show-me" onClick={() => showComplaint(c)}>Show me</button></li>
            ))}</ul> : <p className="hc-dim hc-small">No complaints right now. Everyone waiting is content.</p>}
          </div>
        );
      })()}
      <details className="hc-legend" open data-legend={def.ailments.length}>
        <summary>Who has what?</summary>
        <p className="hc-dim hc-small"><span className="hc-qmark" aria-hidden="true">?</span> means not seen yet: a Check-up finds out. Then a sign by their head shows the room that cures them.</p>
        <ul>{def.ailments.map(([a, day]) => {
          const ad = G.AILMENTS[a], soon = day > s.day;
          return (
            <li key={a} data-ail={a} className={soon ? 'hc-soon' : ''}>
              <Img n={`i-${a}`} alt="" className="hc-legend-ail" />
              <span><b>{ad.name}</b><span className="hc-dim hc-small">{LOOK[a]}{soon ? `. From day ${day}.` : '.'}</span></span>
              <span className="hc-legend-room"><Img n={`s-${ad.room}`} alt="" className="hc-legend-sign" /><span className="hc-small">{G.ROOMS[ad.room].name}</span></span>
            </li>
          );
        })}</ul>
      </details>
      {emerg.map((e) => <p key={e.id} className="hc-emerg-line">{icon('bell')}Emergency: {e.cured} of {e.count} {G.SPECIES[e.sp].plural} cured, {Math.max(0, Math.ceil((e.deadline - s.t) / G.HOUR))} hours left.</p>)}
      <p className="hc-dim hc-small hc-twist-line">{def.twistText}</p>
      <ul className="hc-log">{s.log.slice(-5).reverse().filter((l) => l.text !== news?.text).slice(0, 4).map((l, i) => <li key={`${l.t}-${i}`}>{l.text}</li>)}</ul>
    </div>
  );

  const dockBody = carry != null && g ? (
    <div className="hc-card" data-card="carry"><p>Carrying <b>{g.staffById(carry)?.name}</b>. Tap a room on the floor to drop them in, or the corridor to let them roam.</p><button className="hc-btn hc-btn-small" data-act="carry-cancel" onClick={cancelCarry}>Put them back</button></div>
  ) : panel === 'build' ? <>{buildBar}{buildCards}</> : panel === 'decor' ? <>{buildBar}{decoCards}</> : panel === 'hire' ? hirePanel : info ?? overview;

  const clinicView = (
    <section className={`hc-clinic${panel !== 'none' || sel || offer || raise || tut >= 0 || carry != null ? ' hc-dock-open' : dockUp ? ' hc-dock-up' : ' hc-dock-min'}`}>
      {topBar}
      {tools}
      <div className="hc-stage" ref={wrapRef}>
        <canvas ref={canvasRef} className="hc-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancelPtr}
          onPointerLeave={() => { if (sceneRef.current && !drag.current) sceneRef.current.hover = null; }} aria-label="The clinic floor" />
        {paused && !sheet && !offer && <button className="hc-paused" data-act="resume" onClick={togglePause}>Paused · tap to carry on</button>}
      </div>
      <aside className="hc-dock" aria-label="Clinic cards">
        {s && def && (
          <div className="hc-slim">
            <span className="hc-slim-txt">{news ? news.text : `${s.patients.filter((p) => p.phase === 'wait').length} waiting · ${s.staff.filter((x) => x.state !== 'gone').length} staff`}</span>
            <button className="hc-btn hc-btn-small" data-act="dock" aria-expanded={dockUp} onClick={() => { setDockUp(!dockUp); sfx()?.click(); }}>{dockUp ? 'Less' : 'More'}</button>
          </div>
        )}
        {offerCard}
        {raiseCard}
        {enzoNote}
        {!offer && !enzoNote && panel === 'none' && !sel && tipNote}
        {newsLine}
        {dockBody}
      </aside>
    </section>
  );

  // ---- sheets
  const settingsSheet = sheet === 'settings' && (
    <div className="hc-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
      <div className="hc-sheet hc-card" role="dialog" aria-label="Settings" data-sheet="settings">
        <h3>Settings</h3>
        {([
          ['sound', 'Sound effects', 'Bells, boings and ka-chings.'],
          ['music', 'Music', 'The lounge tunes.'],
          ['assist', 'Helping hand', 'Dora’s tips, “try here” spots, hiring suggestions and a nudge before money runs low.'],
          ['strict', 'Strict day limit', 'Off: the day limit is soft (keep playing for one star). On: missing it ends the clinic.'],
          ['motion', 'Motion', 'Bounces, bubbles and rain. Turn off for a calmer floor.'],
          ['bulletins', 'Show the Burrow Bulletin', 'A little newspaper at the end of every day.'],
          ['sandbox', 'Open the Sandbox', 'Unlock the Sandbox now instead of after Salt Flat.'],
        ] as [Exclude<keyof G.Settings, 'speed'>, string, string][]).map(([k, label, blurb]) => (
          <label key={k} className="hc-toggle" data-setting={k}>
            <input type="checkbox" checked={save.settings[k]} onChange={(e) => setSetting(k, e.target.checked)} />
            <span className="hc-switch" aria-hidden="true" />
            <span><b>{label}</b><span className="hc-dim hc-small">{blurb}</span></span>
          </label>
        ))}
        <div className="hc-card-btns">
          <button className="hc-btn hc-btn-go" data-act="close-settings" onClick={() => { sfx()?.click(); setSheet(null); }}>Done</button>
          {confirm === 'reset'
            ? <><button className="hc-btn hc-btn-stop" data-act="reset-yes" onClick={resetAll}>Erase all progress</button><button className="hc-btn hc-btn-ghost" onClick={() => setConfirm(null)}>Keep it</button></>
            : <button className="hc-btn hc-btn-ghost" data-act="reset" onClick={() => setConfirm('reset')}>Start over…</button>}
        </div>
      </div>
    </div>
  );
  const metDef = met ? G.clinicById(met.clinic) : null;
  const nextDef = met?.next ? G.clinicById(met.next) : null;
  const metSheet = sheet === 'met' && met && metDef && (
    <div className="hc-sheet-wrap">
      <div className="hc-sheet hc-win hc-card" role="dialog" aria-label="Goals met" data-sheet="met">
        <div className="hc-cert">
          <Img n="cert" alt="An award certificate with Dora and Enzo cheering beside a red wax seal" className="hc-cert-art" />
          <p className="hc-cert-kicker">Certificate of Excellent Care</p>
          <div className="hc-cert-text">
            <h3>{metDef.name}</h3>
            <p className="hc-cert-line">Every goal met on day {met.day}, with {met.rep}% reputation.</p>
            <Stars n={met.stars} big />
          </div>
        </div>
        <div className="hc-win-body">
          <ul className="hc-win-why">
            <li className="hc-on">Every goal met</li>
            <li className={met.day <= metDef.fastDay ? 'hc-on' : ''}>By day {metDef.fastDay} (you: day {met.day})</li>
            <li className={met.stars >= 3 || (met.rep >= metDef.starRep && met.day <= metDef.days) ? 'hc-on' : ''}>{metDef.starRep}% reputation (you: {met.rep}%)</li>
          </ul>
          {nextDef && <p>{met.first ? <><b>{nextDef.name}</b> is now open on the map!</> : <>Next up: <b>{nextDef.name}</b>.</>}</p>}
          {!nextDef && <p>That is every clinic in the Andes. Bravo!</p>}
          <div className="hc-card-btns">
            {nextDef && <button className="hc-btn hc-btn-go" data-act="next" onClick={() => { setMapSel(nextDef.id); openClinic(nextDef.id, true); }}>On to {nextDef.name}</button>}
            <button className="hc-btn" data-act="keep" onClick={() => { setSheet(null); setPaused(false); sfx()?.click(); }}>Keep playing here</button>
            <button className="hc-btn hc-btn-ghost" data-act="to-map" onClick={() => { if (nextDef) setMapSel(nextDef.id); toMap(); }}>Back to the map</button>
          </div>
        </div>
      </div>
    </div>
  );
  const bl = s?.bulletin;
  const bulletinSheet = sheet === 'bulletin' && bl && def && (
    <div className="hc-sheet-wrap" onClick={closeBulletin}>
      <div className="hc-sheet hc-paper" role="dialog" aria-label="The Burrow Bulletin" data-sheet="bulletin">
        <p className="hc-paper-mast"><span>The Burrow Bulletin</span><span className="hc-dim hc-small">{def.name} · end of day {bl.day}</span></p>
        <h3 className="hc-paper-head" data-headline>{bl.headline}</h3>
        <p className="hc-paper-sub">{bl.sub}</p>
        <div className="hc-paper-cols">
          <ul className="hc-paper-nums">
            <li>{icon('star')}<b>{bl.cures}</b> cured</li>
            <li>{icon('coin')}<span><b>{fmt(bl.earned)}</b> earned · <b>{fmt(bl.spent)}</b> spent</span></li>
            <li>{icon('heart')}<b>{bl.rep >= 0 ? '+' : ''}{bl.rep}%</b> reputation</li>
          </ul>
          {bl.star && (
            <div className="hc-paper-star" data-star>
              <Img n={`p-${bl.star.look}`} alt="" className="hc-paper-face" />
              <p><span className="hc-dim hc-small">Staff member of the day</span><b>{bl.star.name}</b> the {G.ROLES[bl.star.role].name.toLowerCase()}, {bl.star.jobs} jobs</p>
            </div>
          )}
          {bl.quote && (
            <blockquote className="hc-paper-quote" data-quote>
              <Img n={`face-${bl.quote.sp}`} alt="" className="hc-paper-face" />
              <p>“{bl.quote.text}”<span className="hc-dim hc-small">{bl.quote.name} the {G.SPECIES[bl.quote.sp].name}</span></p>
            </blockquote>
          )}
        </div>
        <div className="hc-paper-end">
          <p className="hc-paper-tip"><b>Tip:</b> {bl.tip}</p>
          <button className="hc-btn hc-btn-go" data-act="bulletin-close" onClick={closeBulletin}>On to day {bl.day + 1}</button>
        </div>
        <p className="hc-dim hc-small hc-paper-foot">Tap anywhere to fold the paper. Turn the Bulletin off in Settings.</p>
      </div>
    </div>
  );
  const failSheet = sheet === 'failed' && def && (
    <div className="hc-sheet-wrap">
      <div className="hc-sheet hc-card" role="dialog" aria-label="Day limit passed" data-sheet="failed">
        <h3>The day limit has passed</h3>
        <p>Strict mode is on, so {def.name} closes here. Have another go: everything you learned still counts. (Turn Strict off in Settings to keep playing past the limit.)</p>
        <div className="hc-card-btns">
          <button className="hc-btn hc-btn-go" data-act="retry" onClick={() => openClinic(def.id, true)}>Try again</button>
          <button className="hc-btn hc-btn-ghost" data-act="to-map" onClick={toMap}>Map</button>
        </div>
      </div>
    </div>
  );

  return (
    <main className={`hc-shell hc-on-${screen}`} data-ready={ready ? 'true' : 'false'} onContextMenu={(e) => e.preventDefault()}>
      {screen === 'title' && titleView}
      {screen === 'map' && mapView}
      <div className="hc-clinic-host" hidden={screen !== 'clinic'}>{clinicView}</div>
      {settingsSheet}
      {metSheet}
      {bulletinSheet}
      {failSheet}
    </main>
  );
}
