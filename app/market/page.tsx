'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/market-game';
import type { Customer, GameState, ItemId, Persona, Reply, Save, Species } from '@/lib/market-game';
import { drawScene, drawWare, stepFlies, type Layout, type Pose, type SceneState, type Sprites } from '@/lib/market-scene';
import { MarketSound, type SongId } from './sound';
import './market.css';

type Screen = 'menu' | 'book' | 'dusk' | 'night' | 'dawn' | 'end';
type Beat = 'visitor' | 'arrive' | 'look' | 'haggle' | 'react' | 'leave' | 'closed';
const SPRITES = ['backdrop', 'dora-greet', 'dora-think', 'dora-joy', 'dora-count', 'enzo-greet', 'enzo-think', 'enzo-joy', 'enzo-count', 'badger', 'tanuki', 'crane', 'rabbit', 'otter', 'heron', 'fox'];
const art = (n: string) => `/art/market/${n}.webp`;
const TELL_TEXT = {
  posture: { 'lean-in': 'Leaning in', upright: 'Standing straight', 'lean-back': 'Leaning back' },
  ears: { pricked: 'Ears pricked up', soft: 'Ears relaxed', flat: 'Ears flat' },
  tail: { flick: 'Tail flicking', still: 'Tail still' },
  purse: { heavy: 'A heavy purse', light: 'A light purse' },
} as const;
const GAZE = ['', 'A quick glance', 'A good look', 'A long look', 'Can’t stop looking'];
const warmth = (v: string) => (['lean-in', 'pricked', 'flick', 'heavy'].includes(v) ? 'warm' : ['lean-back', 'flat', 'light'].includes(v) ? 'cool' : 'even');
const coin = (n: number) => `${n} mon`;

function WareIcon({ id, size = 44 }: { id: ItemId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const d = Math.min(2, window.devicePixelRatio || 1); c.width = size * d; c.height = size * d;
    const g = c.getContext('2d'); if (!g) return;
    g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, size, size);
    drawWare(g, id, size / 2, size * 0.9, size * 0.82);
  }, [id, size]);
  return <canvas ref={ref} className="nm-ware" style={{ width: size, height: size }} aria-hidden="true" />;
}
function Seal({ children, small }: { children: React.ReactNode; small?: boolean }) { return <span className={small ? 'nm-seal nm-seal-s' : 'nm-seal'}>{children}</span>; }
function Lanterns({ n, of = 3 }: { n: number; of?: number }) {
  return <span className="nm-lans" aria-label={`${n} of ${of} lanterns`}>{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}
function Moon({ night }: { night: number }) {
  const p = G.moonPhase(night), k = Math.cos(p * Math.PI * 2);
  return <svg className="nm-moon" viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" fill="#2a3358" /><path d={`M0 -9 A9 9 0 0 ${p < 0.5 ? 1 : 0} 0 9 A${Math.abs(k) * 9} 9 0 0 ${(p < 0.5) === (k > 0) ? 0 : 1} 0 -9`} fill="#f6e7b8" /></svg>;
}

export default function MarketPage() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  const save = useRef<Save>(G.blankSave());
  const run = useRef<GameState | null>(null);
  const [beat, setBeatState] = useState<Beat>('closed');
  const beatRef = useRef<Beat>('closed'); const beatT = useRef(0);
  const setBeat = (b: Beat) => { beatRef.current = b; beatT.current = 0; setBeatState(b); };
  const [price, setPriceState] = useState(10);
  const priceRef = useRef(10);
  const setPrice = (v: number) => { priceRef.current = v; setPriceState(v); };
  const [reply, setReply] = useState<Reply | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dawn, setDawn] = useState<G.Dawn | null>(null);
  const [seedText, setSeedText] = useState('');
  const [visitors, setVisitors] = useState<{ species: Species; line: string }[]>([]);
  const [settings, setSettings] = useState({ sound: true, music: true });
  const [tip, setTip] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const sprites = useRef<Sprites>({});
  const sound = useRef<MarketSound | null>(null);
  const lay = useRef<Layout | null>(null);
  const speed = useRef(1);
  const scene = useRef<SceneState>({ t: 0, night: 1, event: null, lanterns: 0, festival: false, front: [], back: [], dora: 'greet', enzo: 'greet', customer: null, visitor: null, walk: 0, leaving: false, carry: null, looking: 0, showTells: false, bubble: null, bubbleT: 0, flies: [], shake: 0 });
  const poseT = useRef(0);
  const [touch, setTouch] = useState(false);

  const persist = useCallback(() => { save.current.run = run.current && run.current.phase !== 'end' ? run.current : null; try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(save.current)); } catch { /* storage is optional */ } }, []);
  const snd = () => sound.current;
  const unlock = () => { snd()?.unlock(); };

  // ---- the scene state follows the game state
  const syncScene = () => {
    const s = run.current, sc = scene.current; if (!s) return;
    sc.night = s.night; sc.event = s.market.event; sc.lanterns = s.lanterns; sc.festival = s.market.event === 'festival';
    sc.front = G.frontItems(s);
    const counts = new Map<ItemId, number>();
    for (const u of s.stock) if (!u.front) counts.set(u.item, (counts.get(u.item) ?? 0) + 1);
    sc.back = [...counts].map(([item, n]) => ({ item, n }));
  };
  const say = (line: string | null) => { scene.current.bubble = line; scene.current.bubbleT = 0; };
  const pose = (d: Pose, e: Pose = d, hold = 0) => { scene.current.dora = d; scene.current.enzo = e; poseT.current = hold; };

  const music = (id: SongId | null) => snd()?.music(id);
  const toMenu = () => { setScreen('menu'); music('menu'); persist(); };
  const startDusk = () => {
    const s = run.current; if (!s) return;
    setScreen('dusk'); syncScene(); pose('count', 'greet'); music('dusk'); persist();
    if (s.mode === 'moon' && s.night === 1 && !save.current.tutorial) setTip('Buy a few wares with +, tap your best three to put them at the front, then open the stall. The rumours tell you what will sell.');
  };
  const newRun = (seed: number, mode: G.Mode) => { run.current = G.newGame(seed, mode); setDawn(null); startDusk(); };

  // ---- the night: visitors, customers and the haggle
  const callNext = () => {
    const s = run.current; if (!s) return;
    const c = G.nextCustomer(s);
    const sc = scene.current;
    sc.leaving = false; sc.carry = null; sc.looking = 0; sc.showTells = false; say(null);
    setReply(null); setToast(null);
    if (!c) {
      setBeat('closed'); sc.customer = null;
      const d = G.closeStall(s);
      if (d) { setDawn(d); if (d.ended) G.recordEnd(save.current, s); }
      persist(); pose('count');
      setTimeout(() => { setScreen(s.phase === 'end' ? 'end' : 'dawn'); music(s.phase === 'end' ? 'ending' : 'dusk'); if (s.phase === 'end') snd()?.fanfare(); }, 400 / speed.current);
      return;
    }
    sc.customer = { species: c.species, want: c.want, name: c.name, tells: c.tells };
    sc.walk = 0; setPrice(c.value); setBeat('arrive'); pose('greet'); snd()?.arrive();
    persist(); bump();
  };
  const openStall = () => {
    const s = run.current; if (!s || !G.openStall(s)) return;
    unlock(); snd()?.lantern();
    setScreen('night'); syncScene(); music(s.market.event === 'festival' ? 'festival' : 'night');
    const v: { species: Species; line: string }[] = [];
    if (s.market.event === 'tax') v.push({ species: 'heron', line: `Market fee, by the ledger: ${coin(s.tonight.tax)}.${s.rep >= 60 ? ' Halved, for a stall in good standing.' : ' Good standing would have halved it.'} No haggling.` });
    if (s.mode === 'moon' && s.night === 8) v.push({ species: 'fox', line: 'Kiko, from the new stall over the lane! May the best stall win. Mind your prices, chinchillas!' });
    if (s.mode === 'moon' && s.night === 22) v.push({ species: 'fox', line: 'Truce for festival week? I’ll send you my overflow. Friends?' });
    if (s.market.event === 'poets') v.push({ species: 'rabbit', line: 'Poets’ night! We pay in verses, and we tip a fair seller.' });
    persist();
    if (v.length) { setVisitors(v); showVisitor(v[0]); return; }
    callNext();
  };
  const showVisitor = (v: { species: Species; line: string }) => {
    const sc = scene.current; sc.customer = null; sc.visitor = v.species; sc.walk = 0; sc.leaving = false; say(null);
    setBeat('visitor'); snd()?.arrive();
    setTimeout(() => { say(v.line); snd()?.speak(); if (v.species === 'heron') snd()?.stamp(); }, 700 / speed.current);
  };
  const nextVisitor = () => {
    unlock(); snd()?.clack();
    const rest = visitors.slice(1); setVisitors(rest);
    scene.current.leaving = true; say(null);
    setTimeout(() => { scene.current.visitor = null; scene.current.leaving = false; if (rest.length) showVisitor(rest[0]); else callNext(); }, 650 / speed.current);
  };
  const respond = (r: Reply) => {
    const s = run.current, sc = scene.current; if (!s) return;
    setReply(r);
    if (r.kind === 'none') return;
    say(r.line); snd()?.speak(r.kind === 'sold');
    if (r.kind === 'counter') { setBeat('haggle'); snd()?.counter(); setPrice(Math.max(r.offer + 1, Math.round((priceRef.current + r.offer) / 2))); pose('think'); persist(); bump(); return; }
    setBeat('react'); sc.looking = 0;
    if (r.kind === 'sold') {
      pose('joy', 'joy', 1.6); snd()?.sale(); if (r.set) setTimeout(() => snd()?.chime(), 300);
      sc.carry = sc.customer?.want ?? null;
      const L = lay.current;
      if (L) for (let i = 0; i < Math.min(14, 3 + Math.round(r.price / 3)); i++) sc.flies.push({ x: L.customer.x + L.customer.w * 0.3, y: L.customer.y + L.customer.h * 0.6, vx: -160 - (i * 37) % 200, vy: -380 - (i * 53) % 260, t: 0, life: 1.1, kind: i % 5 === 4 && r.verse ? 'verse' : 'coin' });
      const bits = [r.fair ? 'A fair deal: the riverbank will hear of it.' : r.pushed ? 'A hard bargain. Regulars remember that.' : 'Sold.'];
      if (r.set) bits.push(`They took the ${G.ITEMS[r.set.item].name.toLowerCase()} too: a matching set! +${coin(r.set.price)}`);
      if (r.verse) bits.push(r.tip ? `Paid ${coin(r.coins)}, a verse and a ${coin(r.tip)} tip.` : `Paid ${coin(r.coins)} and a verse.`);
      setToast(bits.filter(Boolean).join(' '));
    } else {
      pose('think', 'think', 1.2); snd()?.walk(); sc.shake = 0.6;
      setToast(r.back ? 'They walked off… but they keep glancing back at it.' : 'They walked off. Reputation down a little.');
    }
    syncScene(); persist(); bump();
    setTimeout(() => { sc.leaving = true; setBeat('leave'); }, 1100 / speed.current);
  };
  const doAsk = () => {
    const s = run.current; if (!s || !s.customer || beatRef.current !== 'haggle') return;
    unlock(); snd()?.clack();
    if (!save.current.tutorial) { save.current.tutorial = true; setTip(null); }
    respond(G.ask(s, priceRef.current));
  };
  const doTake = () => { const s = run.current; if (!s || !s.customer || s.customer.offer === null || beatRef.current !== 'haggle') return; unlock(); snd()?.clack(); respond(G.takeOffer(s)); };
  const doLetGo = () => {
    const s = run.current; if (!s || !s.customer || beatRef.current !== 'haggle') return;
    unlock(); snd()?.clack(); G.letGo(s); scene.current.looking = 0; say('“Another time, then.”'); setToast('You let them go, no hard feelings.');
    setBeat('react'); persist();
    setTimeout(() => { scene.current.leaving = true; setBeat('leave'); }, 600 / speed.current);
  };
  const nudge = (d: number) => {
    const c = run.current?.customer; if (!c) return;
    const [lo, hi] = G.askRange(c); const v = Math.max(lo, Math.min(hi, priceRef.current + d));
    if (v !== priceRef.current) { setPrice(v); snd()?.tick(); }
  };

  // ---- the loop
  useEffect(() => {
    if (!mounted) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000) * speed.current; last = now;
      const sc = scene.current; sc.t += dt; sc.bubbleT += dt; sc.shake = Math.max(0, sc.shake - dt * 2);
      stepFlies(sc.flies, dt);
      if (poseT.current > 0) { poseT.current -= dt; if (poseT.current <= 0) pose(beatRef.current === 'haggle' ? 'think' : 'greet'); }
      beatT.current += dt;
      const b = beatRef.current, c = run.current?.customer;
      if (b === 'arrive' || b === 'visitor') { sc.walk = Math.min(1, sc.walk + dt / 0.85); if (b === 'arrive' && sc.walk >= 1) { sc.showTells = true; setBeat('look'); } }
      else if (b === 'look' && c) {
        sc.looking = Math.min(1, sc.looking + dt / (0.45 * c.tells.gaze + 0.3));
        if (sc.looking >= 1) { say(`“${G.ITEMS[c.want].name}… how much?”`); snd()?.speak(); pose('think'); setBeat('haggle'); }
      } else if (b === 'leave') {
        sc.walk = Math.max(0, sc.walk - dt / 0.8);
        if (sc.walk <= 0) { sc.customer = null; sc.leaving = false; setBeat('closed'); callNext(); }
      }
      snd()?.pump();
      const cv = canvas.current, g = cv?.getContext('2d');
      if (cv && g && (screenRef.current === 'night')) {
        const d = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
        g.setTransform(d, 0, 0, d, 0, 0);
        if (w > 0 && h > 0) lay.current = drawScene(g, w, h, sc, sprites.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);
  const screenRef = useRef<Screen>('menu');
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // ---- mount: the save, art, sound, the browser-test hooks
  useEffect(() => {
    save.current = G.readSave((() => { try { return localStorage.getItem(G.SAVE_KEY); } catch { return null; } })());
    run.current = save.current.run;
    setSettings({ ...save.current.settings });
    sound.current = new MarketSound(save.current.settings.sound, save.current.settings.music);
    setTouch(window.matchMedia('(pointer: coarse)').matches);
    for (const n of SPRITES) { const im = new Image(); im.decoding = 'async'; im.src = art(n); sprites.current[n] = im; }
    const w = window as unknown as Record<string, unknown>;
    w.__market = () => {
      const s = run.current, c = s?.customer;
      return {
        screen: screenRef.current, beat: beatRef.current, price: priceRef.current, save: save.current,
        run: s ? { mode: s.mode, night: s.night, phase: s.phase, purse: s.purse, rep: s.rep, cart: s.cart, lanterns: s.lanterns, stock: s.stock.length, front: G.frontItems(s), queue: s.queue, open: s.market.open, event: s.market.event, weeks: s.weeks, boat: s.boat, seed: s.seed } : null,
        customer: c ? { persona: c.persona, species: c.species, want: c.want, value: c.value, offer: c.offer, round: c.round, tells: c.tells, hunch: G.hunch(c), range: G.askRange(c) } : null,
      };
    };
    w.__marketNew = (seed: number, mode: G.Mode = 'moon') => { newRun(seed, mode); return true; };
    w.__marketSpeed = (n: number) => { speed.current = Math.max(0.1, Math.min(40, n)); return speed.current; };
    w.__marketSetPrice = (v: number) => { const c = run.current?.customer; if (!c) return false; const [lo, hi] = G.askRange(c); setPrice(Math.max(lo, Math.min(hi, Math.round(v)))); return true; };
    // plays whole nights without the animation (buys sensibly, asks Dora's hunch, takes fair counters), for the browser tests
    w.__marketAutoplay = (nights: number) => {
      const s = run.current; if (!s) return null;
      for (let k = 0; k < nights && s.phase !== 'end'; k++) {
        if (s.phase === 'dawn') G.nextDusk(s);
        if (s.phase === 'dusk') {
          for (let guard = 0; guard < 30; guard++) {
            const id = G.ITEM_IDS.filter((i) => G.canBuy(s, i) && s.purse - s.market.cost[i] >= 6).sort((a, b) => (G.goingRate(s, b) - s.market.cost[b]) / (1 + s.stock.filter((u) => u.item === b).length) - (G.goingRate(s, a) - s.market.cost[a]) / (1 + s.stock.filter((u) => u.item === a).length))[0];
            if (!id) break; G.buy(s, id);
          }
          G.openStall(s);
        }
        for (let c = s.customer ?? G.nextCustomer(s); c; c = G.nextCustomer(s)) { const r = G.ask(s, G.hunch(c)); if (r.kind === 'counter') G.takeOffer(s); }
        const d = G.closeStall(s); if (d) { setDawn(d); if (d.ended) G.recordEnd(save.current, s); }
      }
      scene.current.customer = null; scene.current.visitor = null; setBeat('closed');
      if (s.phase === 'dawn') { G.nextDusk(s); startDusk(); } else if (s.phase === 'end') { setScreen('end'); music('ending'); }
      persist(); bump();
      return { night: s.night, phase: s.phase, purse: s.purse };
    };
    w.__marketLayout = () => {
      const L = lay.current, cv = canvas.current; if (!L || !cv) return null;
      const b = cv.getBoundingClientRect(), off = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + b.left, y: r.y + b.top, w: r.w, h: r.h });
      return { canvas: { x: b.left, y: b.top, w: b.width, h: b.height }, u: L.u, stall: off(L.stall), dora: off(L.dora), enzo: off(L.enzo), customer: off(L.customer), face: off(L.face) };
    };
    const onVis = () => { if (document.hidden) sound.current?.suspend(); else sound.current?.resume(); };
    document.addEventListener('visibilitychange', onVis);
    setMounted(true);
    sound.current.music('menu');
    return () => { document.removeEventListener('visibilitychange', onVis); sound.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      unlock();
      if (screenRef.current === 'night') {
        if (beatRef.current === 'visitor' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); nextVisitor(); return; }
        if (beatRef.current !== 'haggle') return;
        const big = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+' || e.key === '=') { e.preventDefault(); nudge(big); }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') { e.preventDefault(); nudge(-big); }
        else if (e.key === 'PageUp') { e.preventDefault(); nudge(5); } else if (e.key === 'PageDown') { e.preventDefault(); nudge(-5); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doAsk(); }
        else if (e.key === 't' || e.key === 'T') { e.preventDefault(); doTake(); }
        else if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') { e.preventDefault(); doLetGo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggle = (k: 'sound' | 'music') => {
    unlock();
    const v = !settings[k]; const n = { ...settings, [k]: v }; setSettings(n); save.current.settings = n; persist();
    if (k === 'sound') snd()?.setSound(v); else snd()?.setMusic(v);
  };

  const s = run.current;
  const c: Customer | null = s?.customer ?? null;
  const ready = mounted;

  // ---- the top bar
  const bar = s && screen !== 'menu' && screen !== 'book' ? (
    <header className="nm-bar">
      <a className="nm-home" href="/" aria-label="Back to the arcade">← Arcade</a>
      <button className="nm-chip" onClick={() => { unlock(); toMenu(); }}>Menu</button>
      <span className="nm-night"><Moon night={s.night} /> Night {s.night}<small>/{s.nights}</small>{s.market.event ? <Seal small>{s.market.event === 'tax' ? '税' : s.market.event === 'rain' ? '雨' : s.market.event === 'poets' ? '詩' : '祭'}</Seal> : null}</span>
      <span className="nm-purse" data-testid="purse"><i className="nm-coin" />{coin(s.purse)}</span>
      <span className="nm-rep" title="Reputation"><Seal small>評</Seal><span className="nm-meter"><b style={{ width: `${s.rep}%` }} /></span>{s.rep}</span>
      {s.mode === 'moon' ? <span className="nm-boat" title="Savings toward the lantern boat"><span className="nm-meter nm-meter-boat"><b style={{ width: `${Math.min(100, (s.purse / G.BOAT) * 100)}%` }} /></span><small>boat {Math.min(100, Math.round((s.purse / G.BOAT) * 100))}%</small></span> : <span className="nm-boat"><small>Free market · seed {s.seed}</small></span>}
      <span className="nm-toggles"><button className={'nm-chip' + (settings.sound ? ' on' : '')} onClick={() => toggle('sound')} aria-pressed={settings.sound}>Sound</button><button className={'nm-chip' + (settings.music ? ' on' : '')} onClick={() => toggle('music')} aria-pressed={settings.music}>Music</button></span>
    </header>
  ) : null;

  // ---- the menu
  const menu = (
    <section className="nm-menu">
      <div className="nm-hero"><img src={art('title')} alt="" width={1536} height={1024} /></div>
      <div className="nm-corner"><a className="nm-home" href="/">← Arcade</a><span className="nm-toggles"><button className={'nm-chip' + (settings.sound ? ' on' : '')} onClick={() => toggle('sound')} aria-pressed={settings.sound}>Sound</button><button className={'nm-chip' + (settings.music ? ' on' : '')} onClick={() => toggle('music')} aria-pressed={settings.music}>Music</button></span></div>
      <div className="nm-menu-in">
        <div className="nm-titleblock">
          <span className="nm-eyebrow">Dora &amp; Enzo’s Arcade</span>
          <h1>Night Market <Seal>夜市</Seal></h1>
          <p className="nm-sub">Buy at dusk, sell by lantern light, read your customers and haggle your way to a festival lantern boat.</p>
        </div>
        <div className="nm-cards">
          <article className="nm-card nm-card-main">
            <span className="nm-eyebrow">The moon month</span>
            <h2>28 nights by the river</h2>
            <p>Four weeks, an event each week, up to three lanterns a week. Save {coin(G.BOAT)} for the lantern boat by the festival.</p>
            {s && s.mode === 'moon' ? <p className="nm-note">In progress: night {s.night}, {coin(s.purse)} saved.</p> : null}
            <div className="nm-row">
              {s && s.mode === 'moon' ? <button className="nm-go" onClick={() => { unlock(); snd()?.clack(); if (s.phase === 'night') { setScreen('night'); syncScene(); music('night'); if (s.customer) { scene.current.customer = { species: s.customer.species, want: s.customer.want, name: s.customer.name, tells: s.customer.tells }; scene.current.walk = 1; scene.current.showTells = true; scene.current.looking = 1; setPrice(s.customer.offer ?? s.customer.value); setBeat('haggle'); } else callNext(); } else if (s.phase === 'dawn') { setScreen('dawn'); } else startDusk(); }}>Continue</button> : null}
              <button className={s && s.mode === 'moon' ? 'nm-btn' : 'nm-go'} onClick={() => { unlock(); snd()?.stamp(); newRun((Date.now() % 100000) + 1, 'moon'); }}>{s && s.mode === 'moon' ? 'New month' : 'Open the stall'}</button>
            </div>
            <p className="nm-note">Best: <Lanterns n={Math.min(12, save.current.best.lanterns)} of={12} /> {save.current.best.boat ? '· the boat sailed' : ''}</p>
          </article>
          <article className="nm-card">
            <span className="nm-eyebrow">Free market</span>
            <h2>One week, your seed</h2>
            <p>Seven nights, a random event and the festival on the last night. No boat to save for: how much can the stall take?</p>
            <div className="nm-row">
              <input className="nm-input" inputMode="numeric" placeholder="Seed" aria-label="Seed" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/\D/g, '').slice(0, 7))} />
              <button className="nm-go" onClick={() => { unlock(); snd()?.stamp(); newRun(Number(seedText) || ((Date.now() % 9999) + 1), 'free'); }}>Open</button>
            </div>
            <p className="nm-note">Best takings: {coin(save.current.best.free)}</p>
          </article>
          <article className="nm-card">
            <span className="nm-eyebrow">Customer book</span>
            <h2>Know your customers</h2>
            <p>Every kind haggles its own way. Learn their tells and their habits.</p>
            <div className="nm-faces">{(['badger', 'tanuki', 'crane', 'rabbit', 'otter'] as Species[]).map((sp) => <img key={sp} src={art(sp)} alt="" />)}</div>
            <button className="nm-btn" onClick={() => { unlock(); snd()?.clack(); setScreen('book'); }}>Open the book</button>
          </article>
        </div>

      </div>
    </section>
  );

  const book = (
    <section className="nm-menu nm-book">
      <div className="nm-hero nm-hero-dim"><img src={art('backdrop')} alt="" /></div>
      <div className="nm-menu-in">
        <div className="nm-titleblock"><span className="nm-eyebrow">Customer book</span><h1>Know your customers <Seal>客</Seal></h1>
          <p className="nm-sub">Warm tells (leaning in, ears up, a long look, a heavy purse, coming back) mean they’ll pay more. But each kind bends the rules its own way.</p></div>
        <div className="nm-cards nm-cards-book">
          {(G.PERSONA_IDS as Persona[]).map((p) => {
            const d = G.PERSONAS[p], seen = save.current.run?.seen.includes(p) || save.current.best.months > 0;
            return <article key={p} className="nm-card nm-persona"><img src={art(d.species)} alt="" /><div><h3>{d.label}</h3><p>{d.note}</p>{!seen ? <p className="nm-note">Not met yet this month.</p> : null}</div></article>;
          })}
        </div>
        <footer className="nm-foot"><button className="nm-go" onClick={() => { unlock(); snd()?.clack(); setScreen('menu'); }}>Back</button></footer>
      </div>
    </section>
  );

  // ---- dusk: the suppliers and the stall
  const dusk = s ? (() => {
    const front = G.frontItems(s);
    const counts = new Map<ItemId, number>(); for (const u of s.stock) counts.set(u.item, (counts.get(u.item) ?? 0) + 1);
    const rq = G.requestProgress(s), [g1, g2] = G.goalsFor(s);
    const sets = Object.values(G.SETS).filter((st) => st.items.every((i) => front.includes(i)));
    return (
      <section className="nm-dusk">
        <div className="nm-hero nm-hero-dusk"><img src={art('backdrop')} alt="" /></div>
        <div className="nm-dusk-in">
          <div className="nm-scroll nm-news">
            <div><span className="nm-eyebrow">Dusk · night {s.night}{s.mode === 'moon' ? ` · week ${G.weekOf(s.night) + 1}` : ''}</span>
              <h2>{s.market.event ? G.EVENTS[s.market.event].name : 'The market rows'}</h2></div>
            <p><Seal small>噂</Seal> {s.market.rumour}</p>
            {s.market.event ? <p><Seal small>!</Seal> {G.EVENTS[s.market.event].text}</p> : null}
            {s.market.rival ? <p className="nm-note">Kiko the fox is selling {G.ITEMS[s.market.rival].plural} across the lane tonight.</p> : null}
            {s.market.story ? <p className="nm-story">{s.market.story}</p> : null}
            {s.night > 1 && s.mode === 'moon' && !s.market.story ? <p className="nm-note">{G.seasonHint(s)}</p> : null}
          </div>
          <div className="nm-sup-grid">
            {s.market.open.map((sp) => {
              const d = G.SUPPLIERS[sp];
              return (
                <article key={sp} className="nm-card nm-sup" data-supplier={sp}>
                  <header><h3>{d.name}</h3><span className="nm-note">{d.who.split(',')[0]} · “{d.hello}”</span></header>
                  {d.items.map((id) => {
                    const hot = s.market.hot.includes(id), cheap = s.market.tip.kind === 'glut' && s.market.tip.item === id;
                    return (
                      <div key={id} className="nm-wrow" data-item={id}>
                        <WareIcon id={id} size={48} />
                        <div className="nm-wname"><b>{G.ITEMS[id].name}</b>{hot ? <Seal small>売</Seal> : null}{cheap ? <Seal small>安</Seal> : null}
                          <small>pay {coin(s.market.cost[id])} · sells ~{G.goingRate(s, id)}</small></div>
                        <div className="nm-qty">
                          <button className="nm-step" aria-label={`Put back a ${G.ITEMS[id].name}`} disabled={!s.stock.some((u) => u.item === id && u.bought === s.night)} onClick={() => { unlock(); if (G.unbuy(s, id)) { snd()?.clack(); syncScene(); bump(); } }}>−</button>
                          <span>{counts.get(id) ?? 0}</span>
                          <button className="nm-step nm-buy" aria-label={`Buy a ${G.ITEMS[id].name}`} disabled={!G.canBuy(s, id)} onClick={() => { unlock(); if (G.buy(s, id)) { snd()?.buy(); syncScene(); bump(); } }}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </article>
              );
            })}
            {s.market.open.length % 2 ? (
              <article className="nm-card nm-sup nm-closed">
                <header><h3>Shuttered tonight</h3><span className="nm-note">Back another dusk</span></header>
                {G.SUPPLIER_IDS.filter((sp) => !s.market.open.includes(sp)).map((sp) => <div key={sp} className="nm-wrow"><span className="nm-shut" aria-hidden="true" /><div className="nm-wname"><b>{G.SUPPLIERS[sp].name}</b><small>{G.SUPPLIERS[sp].items.map((i) => G.ITEMS[i].name).join(' · ')}</small></div></div>)}
              </article>
            ) : null}
          </div>
          <aside className="nm-card nm-stallcard">
            <header><h3>Your stall</h3><span className="nm-note">Cart {s.stock.length}/{s.cart}</span></header>
            {tip ? <div className="nm-tip-dusk"><p>{tip}</p><button className="nm-chip" onClick={() => setTip(null)}>Got it</button></div> : null}
            {!tip ? <p className="nm-note">Tap wares to set the front three. A matching set there sells together.</p> : null}
            <div className="nm-stock">
              {[...counts].map(([id, n]) => (
                <button key={id} className={'nm-stockitem' + (front.includes(id) ? ' front' : '')} aria-pressed={front.includes(id)} onClick={() => { unlock(); if (G.setFront(s, id, !front.includes(id))) { snd()?.clack(); syncScene(); bump(); } }}>
                  <WareIcon id={id} size={40} /><span>{G.ITEMS[id].name}</span><small>×{n}</small>{front.includes(id) ? <Seal small>前</Seal> : null}
                </button>
              ))}
              {!counts.size ? <p className="nm-note">The stall is empty. Buy something!</p> : null}
            </div>
            {sets.length ? <p className="nm-setline">{sets.map((st) => st.name).join(', ')} at the front ✓</p> : null}
            <div className="nm-lanternpick">
              <span>Lanterns</span>
              {[1, 2, 3].map((k) => <button key={k} className={'nm-lanbtn' + (s.lanterns >= k ? ' on' : '')} aria-label={`${k} lanterns`} aria-pressed={s.lanterns >= k} onClick={() => { unlock(); G.setLanterns(s, s.lanterns === k ? k - 1 : k); snd()?.lantern(); syncScene(); bump(); }}><i /></button>)}
              <small>{s.lanterns ? `${coin(s.lanterns * G.OIL)} of oil` : 'unlit'} · about {G.crowd(s)} customers</small>
            </div>
            <div className="nm-goals">
              <p><Seal small>願</Seal> {rq.who}: {rq.text} <b>{rq.have}/{rq.need}</b></p>
              <p className="nm-note">This week’s profit {coin(s.week.profit)} · lanterns at {g1} and {g2}</p>
            </div>
            <button className="nm-go nm-open" onClick={() => { snd()?.stamp(); openStall(); }}>Open the stall</button>
          </aside>
        </div>
      </section>
    );
  })() : null;

  // ---- night: the haggle panel
  const dial = c ? (() => {
    const [lo, hi] = G.askRange(c);
    const ang = (v: number) => Math.PI * (1 - (v - lo) / (hi - lo));
    const pt = (v: number, r: number) => [100 + Math.cos(ang(v)) * r, 100 - Math.sin(ang(v)) * r];
    const showHunch = s!.mode === 'moon' && s!.night <= 3;
    const fromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
      const b = e.currentTarget.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width * 200 - 100, y = 100 - (e.clientY - b.top) / b.height * 120;
      const a = Math.atan2(Math.max(0, y), x); const v = Math.round(lo + (1 - a / Math.PI) * (hi - lo));
      if (v !== priceRef.current) { setPrice(Math.max(lo, Math.min(hi, v))); snd()?.tick(); }
    };
    const tick = (v: number, cls: string, label: string) => { const [x1, y1] = pt(v, 70), [x2, y2] = pt(v, 92); return <g className={cls}><line x1={x1} y1={y1} x2={x2} y2={y2} /><text x={pt(v, 104)[0]} y={pt(v, 104)[1]}>{label}</text></g>; };
    const [nx, ny] = pt(price, 78);
    return (
      <div className="nm-dial">
        <svg viewBox="-12 -12 224 128" className="nm-dialsvg" role="slider" aria-label="Your price" aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={price} tabIndex={0}
          onPointerDown={(e) => { if (beatRef.current !== 'haggle') return; unlock(); e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
          onPointerMove={(e) => { if (e.buttons && beatRef.current === 'haggle') fromPointer(e); }}>
          <path d="M8 100 A92 92 0 0 1 192 100" className="nm-arc" />
          <path d={`M8 100 A92 92 0 0 1 ${pt(price, 92)[0]} ${pt(price, 92)[1]}`} className="nm-arc-fill" />
          {tick(c.value, 'nm-t-rate', 'going')}
          {showHunch ? tick(G.hunch(c), 'nm-t-hunch', 'hunch') : null}
          {c.offer !== null ? tick(c.offer, 'nm-t-offer', 'offer') : null}
          <line x1="100" y1="100" x2={nx} y2={ny} className="nm-needle" />
          <circle cx="100" cy="100" r="9" className="nm-hub" />
          <text x="100" y="80" className="nm-price">{price}</text>
        </svg>
        <div className="nm-dialbtns">
          <button className="nm-step" onClick={() => nudge(-5)} aria-label="Five less">−5</button>
          <button className="nm-step" onClick={() => nudge(-1)} aria-label="One less">−</button>
          <button className="nm-step" onClick={() => nudge(1)} aria-label="One more">+</button>
          <button className="nm-step" onClick={() => nudge(5)} aria-label="Five more">+5</button>
        </div>
      </div>
    );
  })() : null;

  const tells = c ? (
    <ul className="nm-tells">
      <li className={warmth(c.tells.posture)}><i>⟋</i>{TELL_TEXT.posture[c.tells.posture]}</li>
      <li className={warmth(c.tells.ears)}><i>⌃</i>{TELL_TEXT.ears[c.tells.ears]}</li>
      <li className={c.persona === 'hurry' ? 'even' : warmth(c.tells.tail)}><i>∿</i>{TELL_TEXT.tail[c.tells.tail]}{c.persona === 'hurry' ? ' (in a hurry)' : ''}</li>
      <li className={c.tells.gaze >= 3 ? 'warm' : c.tells.gaze === 1 ? 'cool' : 'even'}><i>◉</i>{GAZE[c.tells.gaze]}</li>
      <li className={warmth(c.tells.purse)}><i>◍</i>{TELL_TEXT.purse[c.tells.purse]}</li>
      {c.tells.returning ? <li className="warm"><i>再</i>Came back for it</li> : null}
    </ul>
  ) : null;

  const night = s ? (
    <section className="nm-night-screen" data-beat={beat}>
      <div className="nm-stage" ref={wrap}><canvas ref={canvas} className="nm-canvas" aria-label="The stall by lantern light" />
        {!save.current.tutorial && beat === 'haggle' ? <p className="nm-tip">Read the tells: warm ones mean they’d pay more. Turn the dial and ask. If they counter, take it or try again.</p> : null}
      </div>
      <div className="nm-panel" ref={panel}>
        {beat === 'visitor' ? (
          <div className="nm-visitor"><p>{visitors[0]?.species === 'heron' ? 'The tax heron' : visitors[0]?.species === 'fox' ? 'Kiko the fox' : 'A rabbit poet'} stops by the stall.</p><button className="nm-go" onClick={nextVisitor}>Continue</button></div>
        ) : c && (beat === 'look' || beat === 'haggle' || beat === 'arrive') ? (
          <>
            <div className="nm-who">
              <span className="nm-eyebrow">{G.PERSONAS[c.persona].label}{c.persona === 'regular' ? ` · ${s.friends[c.regular] > 0 ? 'a friend' : s.friends[c.regular] < 0 ? 'a bit sore' : 'knows you'}` : ''}</span>
              <h3>{c.name} <span className="nm-wants">wants the <WareIcon id={c.want} size={30} />{G.ITEMS[c.want].name.toLowerCase()}</span></h3>
              <p className="nm-note">Going rate ~{c.value}{s.mode === 'moon' && s.night <= 3 ? ` · Enzo’s hunch: about ${G.hunch(c)}` : ''}{c.offer !== null ? ` · their offer ${c.offer}` : ''}</p>
              {beat === 'arrive' ? <p className="nm-note">Here comes someone…</p> : tells}
            </div>
            {dial}
            <div className="nm-actions">
              <button className="nm-go nm-ask" disabled={beat !== 'haggle'} onClick={doAsk}>Ask {coin(price)}</button>
              <button className="nm-btn nm-take" disabled={beat !== 'haggle' || c.offer === null} onClick={doTake}>{c.offer !== null ? `Take ${coin(c.offer)}` : 'Take offer'}</button>
              <button className="nm-chip nm-letgo" disabled={beat !== 'haggle'} onClick={doLetGo}>Let them go</button>
              {!touch ? <p className="nm-keys"><kbd>←</kbd><kbd>→</kbd> price · <kbd>Enter</kbd> ask · <kbd>T</kbd> take · <kbd>Esc</kbd> let go</p> : null}
            </div>
          </>
        ) : (
          <div className="nm-visitor">{reply && reply.kind === 'sold' ? <p className="nm-big">+{coin(reply.coins + reply.tip + (reply.set?.price ?? 0))}</p> : null}<div className="nm-between"><p className="nm-toast">{toast ?? (s.queue > 0 ? 'Waiting for the next customer…' : 'The lanterns burn low…')}</p>
            <p className="nm-note">Tonight: {s.tonight.sold} sold · {coin(s.tonight.takings)} · {s.tonight.fair} fair · {s.queue > 0 ? `${s.queue} more on the way` : 'the last of the crowd'}</p></div></div>
        )}
      </div>
    </section>
  ) : null;

  // ---- dawn and the end
  const dn: G.Dawn | null = dawn ?? (s && (s.phase === 'dawn' || s.phase === 'end') ? { night: s.tonight, week: (s.mode === 'free' || s.night % 7 === 0) ? s.weeks[s.weeks.length - 1] ?? null : null, rep: s.rep, ended: s.phase === 'end' } : null);
  const dawnCard = s && dn ? (
    <section className="nm-dawn">
      <div className="nm-hero nm-hero-dawn"><img src={art('backdrop')} alt="" /></div>
      <img className="nm-puppet nm-puppet-l" src={art('dora-count')} alt="" />
      <img className="nm-puppet nm-puppet-r" src={art('enzo-joy')} alt="" />
      <div className="nm-card nm-dawncard">
        <span className="nm-eyebrow">Dawn after night {s.phase === 'end' ? s.night : s.night}</span>
        <h2>{dn.night.sold ? `Sold ${dn.night.sold} ware${dn.night.sold > 1 ? 's' : ''}` : 'A quiet night'}</h2>
        <dl className="nm-tally">
          <dt>Takings</dt><dd>{coin(dn.night.takings)}</dd>
          <dt>Profit</dt><dd>{coin(dn.night.profit)}</dd>
          <dt>Fair deals</dt><dd>{dn.night.fair}</dd>
          <dt>Walked off</dt><dd>{dn.night.walked}</dd>
          {dn.night.sets ? <><dt>Matching sets</dt><dd>{dn.night.sets}</dd></> : null}
          {dn.night.tips ? <><dt>Poets’ tips</dt><dd>{coin(dn.night.tips)}</dd></> : null}
          {dn.night.tax ? <><dt>Market fee</dt><dd>−{coin(dn.night.tax)}</dd></> : null}
          {dn.night.oil ? <><dt>Lantern oil</dt><dd>−{coin(dn.night.oil)}</dd></> : null}
          {dn.night.missed ? <><dt>Wanted what you didn’t have</dt><dd>{dn.night.missed}</dd></> : null}
          <dt>Reputation</dt><dd>{dn.night.repStart} → {dn.rep}</dd>
        </dl>
        {dn.week ? (
          <div className="nm-weekres">
            <h3>{s.mode === 'moon' ? `Week ${dn.week.week + 1}` : 'The week'}: <Lanterns n={dn.week.lanterns} /></h3>
            <p className="nm-note">Profit {coin(dn.week.profit)} · request {dn.week.request ? 'done' : 'missed'}</p>
          </div>
        ) : null}
        <button className="nm-go" onClick={() => { unlock(); snd()?.clack(); if (s.phase === 'end') { setScreen('end'); return; } G.nextDusk(s); startDusk(); }}>{s.phase === 'end' ? 'To the festival' : 'Next dusk'}</button>
      </div>
    </section>
  ) : null;

  const end = s ? (
    <section className="nm-end">
      <div className="nm-hero nm-hero-end"><img src={art(s.mode === 'moon' ? 'ending' : 'title')} alt="" onError={(e) => { const i = e.currentTarget; if (!i.src.includes('backdrop')) i.src = art('backdrop'); else i.style.visibility = 'hidden'; }} /></div>
      <div className="nm-card nm-endcard">
        <span className="nm-eyebrow">{s.mode === 'moon' ? 'The lantern festival' : 'Free market closes'}</span>
        <h2>{s.mode === 'moon' ? (s.boat ? 'The lantern boat sails!' : 'Kiko shares her boat') : `Takings: ${coin(s.purse)}`}</h2>
        <p>{s.mode === 'moon' ? (s.boat ? `With ${coin(s.purse)} saved, Dora and Enzo buy their own lantern boat and sail it among a thousand lanterns.` : `${coin(s.purse)} saved: not quite the ${coin(G.BOAT)} for a boat of your own. Kiko waves you aboard hers. Next moon, surely!`) : `Seed ${s.seed}. Best ever: ${coin(save.current.best.free)}.`}</p>
        <p><Lanterns n={G.totalLanterns(s)} of={s.mode === 'moon' ? 12 : 3} /></p>
        <div className="nm-row"><button className="nm-go" onClick={() => { unlock(); snd()?.clack(); run.current = null; persist(); toMenu(); }}>Back to the menu</button></div>
      </div>
    </section>
  ) : null;

  return (
    <main className="nm-shell" data-ready={ready ? 'true' : undefined} data-screen={screen} data-touch={touch ? 'true' : undefined}
      onPointerDown={() => unlock()}>
      {bar}
      {screen === 'menu' ? menu : screen === 'book' ? book : screen === 'dusk' ? dusk : screen === 'night' ? night : screen === 'dawn' ? dawnCard : end}
    </main>
  );
}
