'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HayloftGame, TwigShower, BUILDINGS, MANAGERS, UPGRADES, VALLEYS, STAR_TREE, MOON_SHOP, RESEARCH, TRIPS, KEEPSAKES, ACHIEVEMENTS, TEAM_NAMES, VISITORS,
  SAVE_KEY, GATE, N, CONSTELLATION_AT, ACH_BONUS, MAX_LEVEL, nextMilestone, milestoneMult, stardustShine, fmt, fmtTime, readSave, type AwaySummary, type GameEvent,
} from '@/lib/hayloft-game';
import type { HayloftScene } from '@/lib/hayloft-scene';
import { HayloftSound } from './sound';
import './hayloft.css';

type Tab = 'build' | 'helpers' | 'research' | 'trips' | 'stars' | 'more';

/** Something cheerful from the helper whose building earned the most while you were away. */
const AWAY_LINES = [
  (b: string) => `We kept the ${b} humming the whole time!`,
  (b: string) => `The ${b} never had a quiet minute. I only napped a little.`,
  (b: string) => `Everyone asked where you were. The ${b} missed you!`,
  (b: string) => `I counted every coin from the ${b} twice. It's all there!`,
  (b: string) => `The ${b} had its best stretch yet. Shall we build more?`,
];

/** The welcome-back card's middle: who earned what, a word from the top helper, and what you can buy now. */
function AwayDetails({ away, g }: { away: AwaySummary; g: HayloftGame }) {
  const total = away.by.reduce((a, b) => a + b, 0);
  const top = away.by.map((c, i) => ({ c, i })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 3);
  const shop = g.shopping(), lead = top[0], who = lead && g.s.managers[lead.i] ? MANAGERS[lead.i].name : null;
  const bits = [
    shop.levels.length && `${shop.levels.length} building${shop.levels.length > 1 ? 's' : ''} to level up`,
    shop.hires.length && `${shop.hires.length === 1 ? MANAGERS[shop.hires[0]].name : `${shop.hires.length} helpers`} to hire`,
    shop.upgrades.length && `${shop.upgrades.length} upgrade${shop.upgrades.length > 1 ? 's' : ''}`,
  ].filter(Boolean) as string[];
  return <>
    {total > 0 && top.length > 0 && (
      <ul className="hayloft-away-top" aria-label="Top earners while you were away">
        {top.map(({ c, i }) => (
          <li key={i}><span>{BUILDINGS[i].icon} {BUILDINGS[i].name}{g.s.managers[i] ? ` · ${MANAGERS[i].name}` : ''}</span><b>{fmt(c)}</b>
            <i style={{ width: `${Math.max(4, (c / total) * 100)}%`, background: BUILDINGS[i].color }} /></li>
        ))}
      </ul>
    )}
    {who && <p className="hayloft-away-says">“{AWAY_LINES[Math.floor(away.away / 60) % AWAY_LINES.length](BUILDINGS[lead.i].name)}” <small>· {who}</small></p>}
    {bits.length > 0 && <p className="hayloft-away-ready">🛒 Ready to buy: {bits.join(' · ')}</p>}
    {g.canMigrate() && <p className="hayloft-away-ready">🌄 The Great Migration is ready: +{fmt(g.pendingStardust())} Stardust</p>}
  </>;
}
const TABS: { id: Tab; icon: string; name: string }[] = [
  { id: 'build', icon: '🏡', name: 'Build' }, { id: 'helpers', icon: '🐭', name: 'Helpers' }, { id: 'research', icon: '📜', name: 'Research' },
  { id: 'trips', icon: '🎒', name: 'Trips' }, { id: 'stars', icon: '✨', name: 'Stars' }, { id: 'more', icon: '🎁', name: 'More' },
];
const KEY_BUILD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const BUY_MODES = [1, 10, 100, 0] as const;
/** The player's local calendar day, for the daily gift. */
const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
type Toast = { id: number; text: string; icon: string };

export default function HayloftTycoonPage() {
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<HayloftScene | null>(null), sound = useRef<HayloftSound | null>(null);
  const game = useRef<HayloftGame | null>(null), shower = useRef<TwigShower | null>(null), pausedRef = useRef(false);
  const [tab, setTab] = useState<Tab>('build'), [ready, setReady] = useState(false), [paused, setPaused] = useState(false), [muted, setMuted] = useState(false);
  const [away, setAway] = useState<AwaySummary | null>(null), [toasts, setToasts] = useState<Toast[]>([]), [confirm, setConfirm] = useState<'migrate' | 'constellate' | 'reset' | null>(null);
  const [error, setError] = useState(''), [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const toastId = useRef(0);

  const save = () => { const g = game.current; if (!g) return; try { localStorage.setItem(SAVE_KEY, g.save()); } catch { /* storage is optional */ } };
  const snd = () => { sound.current ??= new HayloftSound(); sound.current.unlock(); return sound.current; };
  const toast = (text: string, icon = '✨') => { const id = ++toastId.current; setToasts((t) => [...t.slice(-3), { id, text, icon }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600); };
  /** Do something to the game from a button: unlock sound, act, then redraw. */
  const act = (f: (g: HayloftGame) => unknown, sfx?: (s: HayloftSound) => void) => {
    const g = game.current; if (!g) return; const s = snd(); const r = f(g);
    if (r === false || r === null) s.nope(); else sfx?.(s);
    refresh(); save();
  };
  /** Bring the game up to the wall clock; shows the welcome-back card for a real absence. */
  const catchUp = (show: boolean) => {
    const g = game.current; if (!g) return;
    const sum = g.catchUp(Date.now());
    if (show && sum.away >= 60) setAway(sum);
    save();
  };
  function handle(events: GameEvent[], tapAt?: { x: number; y: number }) {
    const g = game.current, s = sound.current; if (!g || !events.length) return;
    scene.current?.feed(g, events, tapAt);
    for (const e of events) {
      if (e.kind === 'tap') s?.tap();
      else if (e.kind === 'cycle') s?.coin();
      else if (e.kind === 'buy' || e.kind === 'hire' || e.kind === 'upgrade') s?.buy();
      else if (e.kind === 'milestone' || e.kind === 'festival') s?.milestone();
      else if (e.kind === 'burst') s?.burst();
      else if (e.kind === 'caught') s?.catch();
      else if (e.kind === 'achievement') { const a = ACHIEVEMENTS.find((x) => x.id === e.id); if (a) toast(`${a.name}: ${a.says}. Everything +${Math.round(ACH_BONUS * 100)}%`, '🏆'); }
      else if (e.kind === 'research') toast(`Research done: ${RESEARCH.find((r) => r.id === e.id)?.name}`, '📜');
      else if (e.kind === 'shower') toast('Apple twigs are falling! Tap “Catch” to play.', '🍎');
      else if (e.kind === 'gift' || e.kind === 'item') toast(e.text, '🎁');
      else if (e.kind === 'migrate') { s?.migrate(); toast(`Welcome to ${game.current!.valleyDef.name}! +${fmt(e.stardust)} Stardust`, '🌄'); }
      else if (e.kind === 'constellation') { s?.migrate(); toast(`A new constellation shines! +${e.moonstones} Moonstones`, '🌌'); }
    }
  }
  function pause(on: boolean) {
    pausedRef.current = on; setPaused(on);
    if (!on) catchUp(true);
    save();
  }

  useEffect(() => {
    const raw = (() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })();
    const now = Date.now(), g = readSave(raw, (now ^ 0x5bd1e995) >>> 0, now);
    game.current = g;
    const sum = g.catchUp(now); if (raw && sum.away >= 60) setAway(sum);
    g.events.length = 0;
    sound.current = new HayloftSound(); setMuted(sound.current.muted());
    const w = window as unknown as { __hayloft: () => HayloftGame | null; __hayloftShower: () => TwigShower | null };
    w.__hayloft = () => game.current; w.__hayloftShower = () => shower.current;
    let dead = false, raf = 0, last = 0, ui = 0, saved = 0;
    const resize = () => scene.current?.resize();
    const hide = () => { if (document.visibilityState === 'hidden') save(); else if (!pausedRef.current) catchUp(true); };
    document.addEventListener('visibilitychange', hide); window.addEventListener('pagehide', save);
    import('@/lib/hayloft-scene').then(({ HayloftScene }) => {
      if (dead || !canvas.current) return;
      try { scene.current = new HayloftScene(canvas.current); } catch { setError('This browser cannot draw the valley.'); return; }
      window.addEventListener('resize', resize);
      setReady(true);
      const loop = (ms: number) => {
        const dt = last ? Math.min(0.25, (ms - last) / 1000) : 0; last = ms;
        const g = game.current!;
        if (!pausedRef.current) {
          // a throttled background tab: count the gap as time away
          if (Date.now() - g.s.wall > 2500) catchUp(Date.now() - g.s.wall > 120000);
          g.tick(dt);
          const sh = shower.current;
          if (sh) {
            sh.tick(dt);
            if (sh.done) { shower.current = null; const r = g.finishShower(sh.caught); toast(`${sh.caught} caught! Everything ×${r.mult.toFixed(1)} for ${fmtTime(r.seconds)}`, '🍎'); sound.current?.milestone(); save(); }
          }
          handle(g.events.splice(0));
        }
        scene.current!.draw(g, pausedRef.current ? 0 : dt, shower.current);
        if (ms - ui > 200) { ui = ms; refresh(); }
        if (ms - saved > 5000) { saved = ms; save(); }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => setError('The valley could not load. Please refresh.'));

    const keydown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), g = game.current; if (!g || (e.target as HTMLElement).tagName === 'INPUT') return;
      if (k === 'p' || k === 'escape') { e.preventDefault(); pause(!pausedRef.current); return; }
      if (pausedRef.current) return;
      if (k === ' ') { e.preventDefault(); if (!e.repeat) { snd(); g.tap(); } return; }
      if (k === 'm') { const s = snd(); s.setMuted(!s.muted()); setMuted(s.muted()); return; }
      if (k === 'b') { g.setBuy(BUY_MODES[(BUY_MODES.indexOf(g.s.buy) + 1) % BUY_MODES.length]); refresh(); return; }
      if (k === 'c') { snd(); g.catchVisitor(); return; }
      const i = KEY_BUILD.indexOf(k); if (i >= 0 && !e.repeat) { snd(); if (g.s.managers[i] || !g.run(i)) g.buy(i); refresh(); }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      dead = true; cancelAnimationFrame(raf); save(); sound.current?.dispose();
      window.removeEventListener('resize', resize); window.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pointers: a short press is a tap (on a visitor, a building, a twig or the valley); a drag scrolls the valley
  const press = useRef(new Map<number, { x: number; y: number; moved: boolean }>());
  const onDown = (e: React.PointerEvent) => { press.current.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false }); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); snd(); };
  const onMove = (e: React.PointerEvent) => {
    const p = press.current.get(e.pointerId); if (!p || shower.current) return;
    const dx = e.clientX - p.x; if (!p.moved && Math.abs(dx) > 9) p.moved = true;
    if (p.moved) { scene.current?.drag(dx); p.x = e.clientX; }
  };
  const onUp = (e: React.PointerEvent) => {
    const p = press.current.get(e.pointerId); press.current.delete(e.pointerId); scene.current?.release();
    const g = game.current, sc = scene.current; if (!p || p.moved || !g || !sc || pausedRef.current) return;
    const r = canvas.current!.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = sc.hit(g, x, y, shower.current);
    if (hit.kind === 'twig') { const t = shower.current?.tap(hit.x, hit.y); if (t) { sc.twigPop(t.x, shower.current!.y(t), t.gold); sound.current?.twig(t.gold); } return; }
    if (hit.kind === 'visitor') g.catchVisitor();
    else if (hit.kind === 'building' && !g.s.managers[hit.i] && g.run(hit.i)) sound.current?.tap();
    else g.tap();
    handle(g.events.splice(0), { x, y });
  };

  const g = game.current, s = g?.s, day = today();
  const todo = g ? g.todo(day) : { trips: false, research: false, gift: false, stars: false };
  const badge: Partial<Record<Tab, boolean>> = { trips: todo.trips, research: todo.research, more: todo.gift, stars: todo.stars };

  return (
    <main className="hayloft-shell" data-ready={ready ? 'true' : undefined}>
      <header className="hayloft-hud">
        <div className="hayloft-hud-row">
          <a href="/" className="hayloft-back">← ARCADE</a>
          <span className="hayloft-valley">{g ? `${g.valleyDef.name}${g.year > 1 ? ` · Year ${g.year}` : ''}` : ''}</span>
          <button className="hayloft-chip" aria-pressed={!muted} aria-label={muted ? 'Sound off' : 'Sound on'} onClick={() => { const so = snd(); so.setMuted(!so.muted()); setMuted(so.muted()); }}>{muted ? '🔇' : '🔊'}</button>
          <button className="hayloft-chip" aria-label="Pause" onClick={() => pause(true)}>❚❚</button>
        </div>
        {g && s && (
          <div className="hayloft-money">
            <div className="hayloft-coins"><b data-testid="coins">{fmt(s.coins)}</b><small>{fmt(g.rate())} a second</small></div>
            <div className="hayloft-items">
              <span title="Blueprints, for research">📜 {s.items.bp}</span>
              <button className="hayloft-item" disabled={s.items.berry < 1} title={`Sunberry: everything ×3 for 10 minutes`} onClick={() => act((x) => x.useBerry())}>🍓 {s.items.berry}</button>
              <button className="hayloft-item" disabled={s.items.clock < 1 || g.baseRate() <= 0} title="Clock acorn: an hour of production right now" onClick={() => act((x) => x.useClock())}>⏳ {s.items.clock}</button>
              {s.starsEver > 0 && <span title="Stardust">✨ {fmt(s.stardust)}</span>}
            </div>
          </div>
        )}
        {g && s && s.boosts.length > 0 && (
          <div className="hayloft-boosts" aria-label="Boosts">
            {s.boosts.filter((b) => b.until > s.t).map((b) => <span key={b.kind} className={'hayloft-boost b-' + b.kind}>{{ fluff: '☁️', acorn: '🌰', twig: '🍎', berry: '🍓' }[b.kind]} ×{+b.mult.toFixed(1)} · {fmtTime(b.until - s.t)}</span>)}
          </div>
        )}
      </header>

      <div className="hayloft-stage">
        <canvas ref={canvas} className="hayloft-canvas" tabIndex={0} aria-label="The valley. Tap anywhere to gather fluff and coins, tap a building marked TAP to run it, tap visitors to catch them, drag to look around. Space taps, 1 to 0 buy buildings, B changes the buy amount, C catches a visitor, P pauses."
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {g && s && s.shower && !shower.current && (
          <button className="hayloft-shower-offer" onClick={() => { const seed = game.current!.startShower(); if (seed !== null) { shower.current = new TwigShower(seed); snd().catch(); } refresh(); }}>
            🍎 Apple twigs are falling! <b>Catch</b> <small>{Math.ceil(s.shower.until - s.t)}s</small>
          </button>
        )}
        {g && s && !s.visitor && s.stats.taps < 12 && s.stats.migrations === 0 && !shower.current && <p className="hayloft-tap-hint">👆 Tap the valley to gather coins</p>}
        {g && s?.visitor && !shower.current && <p className="hayloft-visitor-hint" aria-live="polite">{VISITORS[s.visitor.kind].name}! Tap to catch</p>}
        {g && g.todo(day).gift && <button className="hayloft-gift" onClick={() => act((x) => x.claimDaily(day), (so) => so.gift())}>🎁 Daily gift</button>}
      </div>

      <section className="hayloft-panel" aria-label={TABS.find((t) => t.id === tab)!.name}>
        {g && s && tab === 'build' && <Build g={g} act={act} />}
        {g && s && tab === 'helpers' && <Helpers g={g} act={act} />}
        {g && s && tab === 'research' && <Research g={g} act={act} />}
        {g && s && tab === 'trips' && <Trips g={g} act={act} toast={toast} />}
        {g && s && tab === 'stars' && <Stars g={g} act={act} ask={setConfirm} />}
        {g && s && tab === 'more' && <More g={g} act={act} day={day} ask={setConfirm} />}
      </section>

      <nav className="hayloft-tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-on' : ''} aria-pressed={tab === t.id} onClick={() => { setTab(t.id); snd(); }}>
            <span aria-hidden="true">{t.icon}</span>{t.name}{badge[t.id] && <i className="hayloft-dot" aria-label="something new" />}
          </button>
        ))}
      </nav>

      {toasts.length > 0 && <div className="hayloft-toasts" aria-live="polite">{toasts.map((t) => <p key={t.id}><span>{t.icon}</span>{t.text}</p>)}</div>}

      {error && <div className="hayloft-modal"><div className="hayloft-card"><h2>One moment…</h2><p>{error}</p></div></div>}

      {away && !paused && (
        <div className="hayloft-modal" role="dialog" aria-label="Welcome back">
          <div className="hayloft-card">
            <p className="hayloft-eyebrow">WHILE YOU WERE AWAY · {fmtTime(away.away)}</p>
            <h2>Welcome back!</h2>
            <p className="hayloft-big">+{fmt(away.coins)} coins</p>
            <p>Your helpers kept the valley busy{away.capped ? ` for ${fmtTime(away.credited)}, as long as they could stay up. Long Naps and Comfy Naps let them keep going longer` : ''}.</p>
            {away.tripsReady > 0 && <p>🎒 {away.tripsReady} team{away.tripsReady > 1 ? 's are' : ' is'} home with finds to unpack.</p>}
            {g && <AwayDetails away={away} g={g} />}
            {away.research.map((r) => <p key={r}>📜 Research finished: <b>{RESEARCH.find((x) => x.id === r)?.name}</b></p>)}
            <button className="hayloft-go" onClick={() => { setAway(null); snd().gift(); setTab(away.tripsReady ? 'trips' : 'build'); }}>Lovely!</button>
          </div>
        </div>
      )}

      {paused && (
        <div className="hayloft-modal" role="dialog" aria-label="Paused">
          <div className="hayloft-card">
            <h2>Paused</h2>
            <p>The helpers keep working while you rest, just like when you close the game.</p>
            <button className="hayloft-go" onClick={() => pause(false)}>Back to the valley</button>
          </div>
        </div>
      )}

      {confirm && g && (
        <div className="hayloft-modal" role="dialog" aria-label="Are you sure?">
          <div className="hayloft-card">
            {confirm === 'migrate' && <><h2>The Great Migration</h2><p>Everyone boards the skyships for <b>{VALLEYS[(g.s.valley + 1) % VALLEYS.length].name}</b>. Coins, buildings, upgrades and most helpers stay behind; you keep Stardust, research, items, trips and achievements.</p><p className="hayloft-big">+{fmt(g.pendingStardust())} ✨</p></>}
            {confirm === 'constellate' && <><h2>Name a Constellation</h2><p>Your Stardust, the Star Tree and the valley start over in Meadowvale, and the stars you gathered become <b>{g.pendingMoonstones()} Moonstones</b> for good.</p></>}
            {confirm === 'reset' && <><h2>Start over?</h2><p>This clears the whole valley, every Stardust and every achievement. It cannot be undone.</p></>}
            <div className="hayloft-row">
              <button onClick={() => setConfirm(null)}>Not yet</button>
              <button className="hayloft-go" onClick={() => {
                const c = confirm; setConfirm(null);
                if (c === 'migrate') act((x) => x.migrate() > 0);
                else if (c === 'constellate') act((x) => x.constellate() > 0);
                else { game.current = HayloftGame.fresh((Date.now() ^ 0x5bd1e995) >>> 0, Date.now()); shower.current = null; save(); refresh(); }
              }}>{confirm === 'reset' ? 'Start over' : 'Let’s go!'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

type Act = (f: (g: HayloftGame) => unknown, sfx?: (s: HayloftSound) => void) => void;

function Build({ g, act }: { g: HayloftGame; act: Act }) {
  const s = g.s, gm = g.globalMult();
  return (
    <>
      <div className="hayloft-buyrow" role="group" aria-label="Buy amount">
        <span>Buy</span>
        {BUY_MODES.map((m) => <button key={m} className={s.buy === m ? 'is-on' : ''} aria-pressed={s.buy === m} onClick={() => act((x) => x.setBuy(m))}>{m ? `×${m}` : 'MAX'}</button>)}
      </div>
      <ul className="hayloft-list">
        {BUILDINGS.map((b, i) => {
          if (!g.unlocked(i)) return null;
          const lv = s.levels[i], n = g.buyCount(i), cost = g.buyCost(i, n), can = cost <= s.coins && lv < MAX_LEVEL, next = nextMilestone(lv);
          const per = lv ? g.cyclePay(i, gm) : 0, auto = s.managers[i];
          const len = g.cycleTime(i), p = auto ? 1 : s.cycles[i] >= 0 ? s.cycles[i] / len : 0;
          return (
            <li key={b.id} className="hayloft-row-b" style={{ '--c': b.color } as React.CSSProperties}>
              <span className="hayloft-icon" aria-hidden="true">{b.icon}</span>
              <div className="hayloft-b-body">
                <strong className="hayloft-b-name"><span>{b.name}</span><em>{lv ? `Lv ${lv}` : 'new'}</em></strong>
                <small>{lv ? (auto ? `${fmt(per / b.cycle)} a second · ${MANAGERS[i].name}` : `${fmt(per)} each run (${fmtTime(len)})`) : b.blurb}</small>
                {lv > 0 && next && <small className="hayloft-next">{next - lv} more to Lv {next}: ×{milestoneMult(next) / milestoneMult(lv)}</small>}
                {lv > 0 && <span className="hayloft-bar" aria-hidden="true"><i style={{ width: `${Math.round(p * 100)}%` }} className={auto ? 'auto' : ''} /></span>}
              </div>
              <div className="hayloft-b-acts">
                {lv > 0 && !auto && <button className="hayloft-run" disabled={s.cycles[i] >= 0} onClick={() => act((x) => x.run(i))}>{s.cycles[i] >= 0 ? '…' : 'Run'}</button>}
                <button className="hayloft-buy" disabled={!can} onClick={() => act((x) => x.buy(i, n))} aria-label={`Buy ${n} ${b.name} for ${fmt(cost)}`}><b>+{n}</b><small>{fmt(cost)}</small></button>
              </div>
            </li>
          );
        })}
      </ul>
      {s.levels[GATE] < 1 && <p className="hayloft-hint">Build the <b>{BUILDINGS[GATE].name}</b> to open the Great Migration to a new valley. ✨</p>}
    </>
  );
}

function Helpers({ g, act }: { g: HayloftGame; act: Act }) {
  const s = g.s, ups = UPGRADES.filter((u) => !s.upgrades.includes(u.id) && (u.target === 'all' || s.levels[u.target] > 0)).slice(0, 6);
  return (
    <>
      <h3>Helpers</h3>
      <p className="hayloft-note">A helper runs their building on their own, even while you are away, and brings a perk.</p>
      <ul className="hayloft-list">
        {MANAGERS.map((m, i) => {
          if (s.levels[i] < 1 && !s.managers[i]) return null;
          const cost = g.managerCost(i);
          return (
            <li key={m.name} className={'hayloft-row-m' + (s.managers[i] ? ' is-hired' : '')}>
              <span className="hayloft-icon" aria-hidden="true">{BUILDINGS[i].icon}</span>
              <div className="hayloft-b-body"><strong>{m.name}</strong><small>{BUILDINGS[i].name} · {m.says}</small></div>
              {s.managers[i] ? <span className="hayloft-done">✓ Working</span> : <button className="hayloft-buy" disabled={cost > s.coins} onClick={() => act((x) => x.hire(i))}><b>Hire</b><small>{fmt(cost)}</small></button>}
            </li>
          );
        })}
      </ul>
      <h3>Upgrades</h3>
      {ups.length === 0 ? <p className="hayloft-note">Every upgrade here is bought. What a valley!</p> : (
        <ul className="hayloft-list">
          {ups.map((u) => (
            <li key={u.id} className="hayloft-row-m">
              <span className="hayloft-icon" aria-hidden="true">{u.target === 'all' ? '🎉' : BUILDINGS[u.target].icon}</span>
              <div className="hayloft-b-body"><strong>{u.name}</strong><small>{u.target === 'all' ? 'Everything' : BUILDINGS[u.target].name} ×{u.x}</small></div>
              <button className="hayloft-buy" disabled={u.cost > s.coins} onClick={() => act((x) => x.upgrade(u.id))}><b>Buy</b><small>{fmt(u.cost)}</small></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Research({ g, act }: { g: HayloftGame; act: Act }) {
  const s = g.s, st = s.studying, cur = st && RESEARCH.find((r) => r.id === st.id);
  return (
    <>
      <h3>Research desk <span className="hayloft-count">📜 {s.items.bp} blueprints</span></h3>
      <p className="hayloft-note">Research keeps going while you are away and stays with you for good. Blueprints come from trips, owls and daily gifts.</p>
      {st && cur && (
        <div className="hayloft-current">
          <strong>Studying {cur.name}</strong><small>{cur.says} · {fmtTime((st.ends - s.wall) / 1000)} left</small>
          <span className="hayloft-bar"><i style={{ width: `${Math.round((1 - (st.ends - s.wall) / (cur.minutes * 60000)) * 100)}%` }} /></span>
          <button className="hayloft-chip" disabled={s.items.clock < 1} onClick={() => act((x) => x.rush('research'))}>⏳ Hurry by an hour</button>
        </div>
      )}
      <ul className="hayloft-list">
        {RESEARCH.map((r) => {
          const done = g.has(r.id), open = !r.needs || g.has(r.needs);
          return (
            <li key={r.id} className={'hayloft-row-m' + (done ? ' is-hired' : '') + (!open ? ' is-locked' : '')}>
              <span className="hayloft-icon" aria-hidden="true">{done ? '✅' : open ? '📜' : '🔒'}</span>
              <div className="hayloft-b-body"><strong>{r.name}</strong><small>{r.says}{!open ? ` · after ${RESEARCH.find((x) => x.id === r.needs)?.name}` : ''}</small></div>
              {done ? <span className="hayloft-done">✓ Learned</span> : <button className="hayloft-buy" disabled={!g.canResearch(r.id)} onClick={() => act((x) => x.study(r.id))}><b>📜 {r.bp}</b><small>{fmtTime(r.minutes * 60)}</small></button>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Trips({ g, act, toast }: { g: HayloftGame; act: Act; toast: (t: string, i?: string) => void }) {
  const s = g.s, slots = g.tripSlots();
  return (
    <>
      <h3>Trips</h3>
      <p className="hayloft-note">Send a team off for real minutes or hours. They come back with blueprints, sunberries, clock acorns, trail mix and, on long trips, keepsakes.</p>
      {Array.from({ length: slots }, (_, k) => {
        const tr = s.trips[k], d = tr && TRIPS.find((x) => x.id === tr.dest);
        return (
          <div key={k} className="hayloft-team">
            <strong>{TEAM_NAMES[k]}</strong>
            {!tr && <div className="hayloft-dests">{TRIPS.map((t) => <button key={t.id} onClick={() => act((x) => x.sendTrip(t.id, k))} title={t.blurb}><b>{t.name}</b><small>{fmtTime(t.minutes * 60 * g.tripMult())} · {t.finds}+ finds</small></button>)}</div>}
            {tr && d && s.wall < tr.ends && (
              <div className="hayloft-current">
                <small>Off to {d.name} · home in {fmtTime((tr.ends - s.wall) / 1000)}</small>
                <span className="hayloft-bar"><i style={{ width: `${Math.round(((s.wall - tr.start) / (tr.ends - tr.start)) * 100)}%` }} /></span>
                <button className="hayloft-chip" disabled={s.items.clock < 1} onClick={() => act((x) => x.rush(k))}>⏳ Hurry by an hour</button>
              </div>
            )}
            {tr && d && s.wall >= tr.ends && <button className="hayloft-go" onClick={() => act((x) => { const got = x.claimTrip(k); if (got) toast(`${TEAM_NAMES[k]} is home from ${d.name} with ${got.join(', ')}`, '🎒'); return got; }, (so) => so.gift())}>Welcome home! Unpack the finds</button>}
          </div>
        );
      })}
      <h3>Keepsake shelf <span className="hayloft-count">{s.keepsakes.filter((x) => x > 0).length} / {KEEPSAKES.length}</span></h3>
      <p className="hayloft-note">Each keepsake adds 10% to everything, for good.</p>
      <ul className="hayloft-shelf">{KEEPSAKES.map((k, i) => <li key={k} className={s.keepsakes[i] ? 'got' : ''}>{s.keepsakes[i] ? k : '???'}</li>)}</ul>
    </>
  );
}

function Stars({ g, act, ask }: { g: HayloftGame; act: Act; ask: (c: 'migrate' | 'constellate') => void }) {
  const s = g.s, next = VALLEYS[(s.valley + 1) % VALLEYS.length], pend = g.pendingStardust();
  return (
    <>
      <h3>The Great Migration</h3>
      <div className="hayloft-current">
        <strong>Now: {g.valleyDef.name}</strong><small>{g.valleyDef.twist}</small>
        <strong>Next: {next.name}</strong><small>{next.twist}</small>
        {s.levels[GATE] < 1
          ? <p className="hayloft-note">Build the <b>{BUILDINGS[GATE].name}</b> so the colony can fly over the mountains. This valley is worth <b>{fmt(pend)} ✨</b> so far.</p>
          : <p className="hayloft-note">This valley is worth <b>{fmt(pend)} Stardust</b>{s.starsEver > 0 ? `, on top of the ${fmt(s.starsEver)} you have gathered` : ''}. The more you earn here first, the more it gives.</p>}
        <button className="hayloft-go" disabled={!g.canMigrate()} onClick={() => ask('migrate')}>Migrate for +{fmt(pend)} ✨</button>
      </div>
      <h3>Star Tree <span className="hayloft-count">✨ {fmt(s.stardust)}</span></h3>
      <p className="hayloft-note">Every Stardust you have ever earned shines on the valley: everything ×{fmt(stardustShine(s.starsEver))}. Spend it here too; spending never dims the shine.</p>
      <ul className="hayloft-list">
        {STAR_TREE.map((d) => {
          const l = g.tree(d.id), cost = l < d.max ? d.cost(l) : 0;
          return (
            <li key={d.id} className={'hayloft-row-m' + (l >= d.max ? ' is-hired' : '')}>
              <span className="hayloft-pips" aria-label={`level ${l} of ${d.max}`}>{l}/{d.max}</span>
              <div className="hayloft-b-body"><strong>{d.name}</strong><small>{d.says}</small></div>
              {l >= d.max ? <span className="hayloft-done">✓ Full</span> : <button className="hayloft-buy" disabled={cost > s.stardust} onClick={() => act((x) => x.buyTree(d.id))}><b>✨ {fmt(cost)}</b></button>}
            </li>
          );
        })}
      </ul>
      {(s.starsEver >= CONSTELLATION_AT / 10 || s.constellations > 0) && (
        <>
          <h3>Constellations <span className="hayloft-count">🌙 {s.moonstones}</span></h3>
          <div className="hayloft-current">
            <p className="hayloft-note">When the colony has gathered {fmt(CONSTELLATION_AT)} Stardust, you can name a constellation after it: the Star Tree and Stardust start over, and you keep Moonstones forever. {s.constellations > 0 ? `${s.constellations} named so far.` : ''}</p>
            <button className="hayloft-go" disabled={!g.canConstellate()} onClick={() => ask('constellate')}>{g.canConstellate() ? `Name a Constellation for ${g.pendingMoonstones()} 🌙` : `${fmt(s.starsEver)} / ${fmt(CONSTELLATION_AT)} Stardust`}</button>
          </div>
          <ul className="hayloft-list">
            {MOON_SHOP.map((d) => {
              const l = g.moon(d.id), cost = l < d.max ? d.cost(l) : 0;
              return (
                <li key={d.id} className={'hayloft-row-m' + (l >= d.max ? ' is-hired' : '')}>
                  <span className="hayloft-pips">{l}/{d.max}</span>
                  <div className="hayloft-b-body"><strong>{d.name}</strong><small>{d.says}</small></div>
                  {l >= d.max ? <span className="hayloft-done">✓ Full</span> : <button className="hayloft-buy" disabled={cost > s.moonstones} onClick={() => act((x) => x.buyMoon(d.id))}><b>🌙 {cost}</b></button>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function More({ g, act, day, ask }: { g: HayloftGame; act: Act; day: number; ask: (c: 'reset') => void }) {
  const s = g.s, st = s.stats;
  return (
    <>
      <div className="hayloft-current">
        <strong>Daily gift</strong>
        <small>Day {g.dailyReady(day) ? (day === s.daily.last + 1 ? s.daily.streak + 1 : 1) : s.daily.streak} of a seven-day round: blueprints, sunberries, clock acorns and, on day seven, Stardust.</small>
        <button className="hayloft-go" disabled={!g.dailyReady(day)} onClick={() => act((x) => x.claimDaily(day), (so) => so.gift())}>{g.dailyReady(day) ? '🎁 Open today’s gift' : 'Come back tomorrow for the next one'}</button>
      </div>
      <h3>Achievements <span className="hayloft-count">{s.achieved.length} / {ACHIEVEMENTS.length} · everything +{Math.round(s.achieved.length * ACH_BONUS * 100)}%</span></h3>
      <ul className="hayloft-trophies">{ACHIEVEMENTS.map((a) => <li key={a.id} className={s.achieved.includes(a.id) ? 'got' : ''} title={a.says}><b>{s.achieved.includes(a.id) ? '🏆' : '·'}</b>{a.name}<small>{a.says}</small></li>)}</ul>
      <h3>Valley book</h3>
      <dl className="hayloft-stats">
        <div><dt>Coins ever</dt><dd>{fmt(st.earned)}</dd></div><div><dt>Migrations</dt><dd>{st.migrations}</dd></div>
        <div><dt>Stardust gathered</dt><dd>{fmt(s.starsEver)}</dd></div><div><dt>Constellations</dt><dd>{s.constellations}</dd></div>
        <div><dt>Taps</dt><dd>{fmt(st.taps)}</dd></div><div><dt>Fluff Bursts</dt><dd>{st.bursts}</dd></div>
        <div><dt>Visitors caught</dt><dd>{st.visitors}</dd></div><div><dt>Trips home</dt><dd>{st.trips}</dd></div>
        <div><dt>Twig Showers</dt><dd>{st.showers} (best {st.bestShower})</dd></div><div><dt>Time in the valley</dt><dd>{fmtTime(st.played)}</dd></div>
        <div><dt>Away time counts</dt><dd>up to {g.offlineCapHours()} h</dd></div><div><dt>Helpers hired</dt><dd>{s.managers.filter(Boolean).length} / {N}</dd></div>
      </dl>
      <h3>How to play</h3>
      <p className="hayloft-note">Tap the valley for coins and fluff: fifty taps make a Fluff Burst. Buy buildings, and reach levels 10, 25, 50, 100 and on for big multipliers. Buildings without a helper need a tap to run; hire helpers so they run on their own, even while you are away (for up to {g.offlineCapHours()} hours). Catch visitors as they fly past, play the Twig Shower when it comes, send trips and research before you put the phone down. When the {BUILDINGS[GATE].name} is built, migrate to a new valley for Stardust. Keys: Space taps, 1 to 0, - and = buy, B buy amount, C catch, M sound, P pause.</p>
      <button className="hayloft-chip hayloft-reset" onClick={() => ask('reset')}>Start a brand-new valley…</button>
    </>
  );
}
