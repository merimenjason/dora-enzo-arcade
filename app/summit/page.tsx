/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Run, CARDS, POOL, TRINKETS, TRINKET_IDS, STATUS, FOES, ACTS, HEROES, HERO_IDS, ALTITUDES, NODE_NAMES, STOPS, ROWS, LANES, ENERGY,
  costOf, nameOf, describe, canUpgrade, type Card, type CardPick, type HeroId, type MapNode, type NodeType, type StatusId, type Statuses,
} from '../../lib/summit-shuffle-game';
import { Stage, drawCardArt, drawHeroIcon, drawFoeIcon } from '../../lib/summit-shuffle-scene';
import { cue, setMuted } from './sound';
import './summit.css';

const SAVE_KEY = 'summit-shuffle-v1';
type Record1 = { cleared: number; wins: number; runs: number; far: number };
type Save = { muted: boolean; speed: number; best: Record<HeroId, Record1>; cards: string[]; trinkets: string[]; hero: HeroId; run: string | null };
const blank = (): Save => ({ muted: false, speed: 1, best: { dora: { cleared: -1, wins: 0, runs: 0, far: 0 }, enzo: { cleared: -1, wins: 0, runs: 0, far: 0 } }, cards: [], trinkets: [], hero: 'dora', run: null });
function readSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}'), b = blank();
    const rec = (r: Partial<Record1> | undefined): Record1 => ({ cleared: Math.max(-1, Math.min(ALTITUDES.length - 1, Number(r?.cleared ?? -1))), wins: Number(r?.wins) || 0, runs: Number(r?.runs) || 0, far: Math.max(0, Math.min(STOPS, Number(r?.far) || 0)) });
    return {
      muted: !!raw.muted, speed: raw.speed === 2 || raw.speed === 3 ? raw.speed : 1, best: { dora: rec(raw.best?.dora), enzo: rec(raw.best?.enzo) },
      cards: Array.isArray(raw.cards) ? raw.cards.filter((id: string) => CARDS[id]) : b.cards, trinkets: Array.isArray(raw.trinkets) ? raw.trinkets.filter((id: string) => TRINKETS[id]) : b.trinkets,
      hero: raw.hero === 'enzo' ? 'enzo' : 'dora', run: typeof raw.run === 'string' ? raw.run : null,
    };
  } catch { return blank(); }
}
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };
/** The highest altitude a chinchilla may start at: one above the highest it has reached the summit on. */
const openLevel = (r: Record1) => Math.min(ALTITUDES.length - 1, r.cleared + 1);
const newSeed = () => (Date.now() % 1000000) + 1;
const NODE_ICON: Record<NodeType, string> = { fight: '🐾', alpha: '🔥', rest: '💤', stall: '🍎', event: '❓', stash: '🎁', boss: '👑' };
const TYPE_NAME = { attack: 'Attack', skill: 'Skill', power: 'Power', status: 'Status', curse: 'Curse' } as const;

const artCache = new Map<string, string>();
/** A card's picture as an image, drawn once per kind and shared by every copy on the page. */
function CardArt({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const d = CARDS[id], key = `${d.art}|${d.type}`;
    let url = artCache.get(key);
    if (!url) { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; const c = cv.getContext('2d'); if (c) { drawCardArt(c, d.art, d.type, 200, 120); url = cv.toDataURL(); artCache.set(key, url); } }
    setSrc(url ?? '');
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on a canvas, nothing for the image optimiser to do
  return src ? <img className="ss-art" src={src} alt="" /> : <span className="ss-art" />;
}
type CardProps = { card: { id: string; up: boolean }; text?: string; onClick?: () => void; disabled?: boolean; on?: boolean; dim?: boolean; tag?: string; testid?: string; index?: number };
function CardView({ card, text, onClick, disabled, on, dim, tag, testid, index }: CardProps) {
  const d = CARDS[card.id], cost = costOf(card), body = (
    <>
      <span className="ss-cost" aria-label={cost === -2 ? 'cannot be played' : cost === -1 ? 'costs all your energy' : `costs ${cost} energy`}>{cost === -2 ? '–' : cost === -1 ? 'X' : cost}</span>
      <strong>{nameOf(card)}</strong>
      <CardArt id={card.id} />
      <em>{TYPE_NAME[d.type]}{d.rarity === 'uncommon' || d.rarity === 'rare' ? <span> · {d.rarity}</span> : null}</em>
      <span className="ss-text">{text ?? describe(card)}</span>
      {tag && <span className="ss-tag">{tag}</span>}
      {index !== undefined && <kbd>{(index + 1) % 10}</kbd>}
    </>
  );
  const cls = `ss-card t-${d.type} r-${d.rarity}${card.up ? ' up' : ''}${on ? ' on' : ''}${dim ? ' dim' : ''}`;
  return onClick
    ? <button className={cls} data-testid={testid} data-card={card.id} aria-pressed={on} aria-disabled={disabled} onClick={onClick}>{body}</button>
    : <div className={cls} data-testid={testid} data-card={card.id}>{body}</div>;
}
function Portrait({ hero, size }: { hero: HeroId; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); drawHeroIcon(c, hero, size, size); }, [hero, size]);
  return <canvas ref={ref} width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
function FoeIcon({ kind, size }: { kind: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); drawFoeIcon(c, kind, size * 1.4, size); }, [kind, size]);
  return <canvas ref={ref} width={size * 2.8} height={size * 2} style={{ width: size * 1.4, height: size }} aria-hidden="true" />;
}
const statusLine = (st: Statuses) => (Object.keys(st) as StatusId[]).filter((id) => st[id] && id !== 'rush').map((id) => `${STATUS[id].icon} ${STATUS[id].name}${id === 'den' ? '' : ` ${st[id]}`}: ${STATUS[id].text(st[id]!)}`);

/** A grid of cards to look through, or to choose one from. */
type Sheet = { title: string; note?: string; cards: Card[]; pick?: (c: Card) => void; show?: (c: Card) => { id: string; up: boolean } };

export default function SummitShuffle() {
  const [save, setSave] = useState<Save>(blank);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'run'>('home');
  const [level, setLevel] = useState(0);
  const [sel, setSel] = useState(-1);
  const [target, setTarget] = useState(-1);
  const [hover, setHover] = useState(-1);
  const [look, setLook] = useState(-2);
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [fightNo, setFightNo] = useState(0);
  const [, setTick] = useState(0);
  const run = useRef<Run | null>(null), stage = useRef<Stage | null>(null), canvas = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const saveRef = useRef(save), selRef = useRef(-1), targetRef = useRef(-1), hoverRef = useRef(-1), noteTimer = useRef(0), settled = useRef<Run | null>(null);
  saveRef.current = save;

  useEffect(() => { const s = readSave(); setSave(s); setMuted(s.muted); setLevel(openLevel(s.best[s.hero])); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => { (window as unknown as { __summit?: () => unknown }).__summit = () => ({ run: run.current, stage: stage.current }); }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2600); };
  const store = (next: Save) => { saveRef.current = next; setSave(next); writeSave(next); };
  const pick = (i: number, t = targetRef.current) => { selRef.current = i; targetRef.current = t; setSel(i); setTarget(t); };
  const speed = save.speed;

  /** After any engine call: play its events, keep the save up to date, and settle a climb that has just ended. */
  function commit() {
    const r = run.current;
    if (!r) return;
    const events = r.events.splice(0);
    if (stage.current && r.fight) stage.current.feed(events, r);
    const s = saveRef.current, over = r.phase === 'won' || r.phase === 'lost';
    const cards = [...new Set([...s.cards, ...r.found.cards])], trinkets = [...new Set([...s.trinkets, ...r.found.trinkets])];
    let best = s.best;
    if (over && settled.current !== r) {
      settled.current = r; cue(r.phase === 'won' ? 'win' : 'lose');
      const b = s.best[r.hero];
      best = { ...s.best, [r.hero]: { cleared: r.phase === 'won' ? Math.max(b.cleared, r.level) : b.cleared, wins: b.wins + (r.phase === 'won' ? 1 : 0), runs: b.runs + 1, far: Math.max(b.far, r.stats.stops) } };
    }
    store({ ...s, cards, trinkets, best, run: over ? null : r.save() });
    refresh();
  }
  function enter(r: Run) {
    run.current = r; stage.current = r.fight ? new Stage(r) : null;
    if (stage.current) { stage.current.sfx = cue; stage.current.speed = speed; stage.current.feed(r.events.splice(0), r); setFightNo((n) => n + 1); }
    r.events.length = 0; settled.current = null;
    pick(-1, -1); setLook(-2); setSheet(null); setScreen('run'); refresh();
  }
  function begin(hero: HeroId) {
    const r = Run.start({ seed: newSeed(), hero, level: Math.min(level, openLevel(save.best[hero])) });
    store({ ...saveRef.current, hero, run: r.save() });
    enter(r); commit();
  }
  function resume() { const r = save.run ? Run.load(save.run) : null; if (r) enter(r); else { store({ ...save, run: null }); say('That climb could not be picked up again.'); } }
  const abandon = () => { store({ ...save, run: null }); run.current = null; setScreen('home'); };
  const home = () => { setScreen('home'); setSheet(null); };
  const toggleMute = () => { const next = { ...save, muted: !save.muted }; store(next); setMuted(next.muted); };
  const cycleSpeed = () => { const n = speed === 1 ? 2 : speed === 3 ? 1 : 3; store({ ...save, speed: n }); if (stage.current) stage.current.speed = n; };
  const chooseHero = (h: HeroId) => { store({ ...save, hero: h }); setLevel(openLevel(save.best[h])); };

  // ---------- The trail and its stops ----------
  function go(id: number) {
    const r = run.current;
    if (!r) return;
    const why = r.go(id);
    if (why) { say(why); return; }
    cue(r.fight ? 'growl' : 'step');
    if (r.fight) { stage.current = new Stage(r); stage.current.sfx = cue; stage.current.speed = speed; setFightNo((n) => n + 1); pick(-1, -1); setLook(-2); }
    commit();
  }
  const act = (why: string, sound = 'select') => { if (why) say(why); else { cue(sound); commit(); } };
  /** Opens the deck to choose a card for something, and does it when one is chosen. */
  function choosing(kind: CardPick, title: string, done: (c: Card) => string) {
    const r = run.current;
    if (!r) return;
    const cards = r.pickable(kind);
    if (!cards.length) { say('There is no card that will do.'); return; }
    setSheet({ title, cards, show: kind === 'upgrade' ? (c) => ({ id: c.id, up: true }) : undefined, pick: (c) => { setSheet(null); act(done(c), kind === 'remove' ? 'out' : 'power'); } });
  }

  // ---------- The fight ----------
  const mine = () => { const r = run.current; return !!r && r.phase === 'fight' && !stage.current?.waiting; };
  /** The foe a card would go at if nothing else is chosen: the last one aimed at, or the first still standing. */
  const aimFor = (r: Run) => (r.fight!.foes[targetRef.current]?.alive ? targetRef.current : r.fight!.foes.findIndex((x) => x.alive));
  function playCard(i: number, t: number) {
    const r = run.current;
    if (!r || !mine()) return;
    const why = r.play(i, t);
    if (why) { say(why); cue('no'); return; }
    pick(-1, r.fight?.foes[t]?.alive ? t : -1);
    commit();
  }
  function tapCard(i: number) {
    const r = run.current, c = r?.fight?.hand[i];
    if (!r || !c || !mine()) return;
    const d = CARDS[c.id];
    setLook(-2);
    if (selRef.current === i) {
      // The second tap plays it.
      const blocked = r.cannot(i, d.target ? aimFor(r) : -1);
      if (blocked) { say(blocked); cue('no'); return; }
      playCard(i, d.target ? aimFor(r) : -1);
      return;
    }
    cue('select'); pick(i, d.target ? aimFor(r) : -1);
  }
  function tapFoe(t: number) {
    const r = run.current, f = r?.fight;
    if (!r || !f || !f.foes[t]?.alive) return;
    const c = f.hand[selRef.current];
    if (c && CARDS[c.id].target && mine()) { playCard(selRef.current, t); return; }
    setLook(t); pick(-1, t);
  }
  function endTurn() {
    const r = run.current;
    if (!r || !mine()) return;
    pick(-1); setLook(-2); r.endTurn(); commit();
  }
  const skipAhead = () => { const r = run.current, st = stage.current; if (r && st?.busy) { st.flush(r); refresh(); } };
  const boardPoint = (e: React.PointerEvent<HTMLCanvasElement>) => { const q = e.currentTarget.getBoundingClientRect(), r = run.current, st = stage.current; return r && st ? st.foeAt(e.clientX - q.left, e.clientY - q.top, q.width, q.height, r) : -1; };

  // The loop: animations and drawing, at whatever size the board is on this screen.
  useEffect(() => {
    if (screen !== 'run' || !fightNo) return;
    const cv = canvas.current, c = cv?.getContext('2d');
    if (!cv || !c) return;
    let raf = 0, last = 0, wasBusy = true, ui = 0;
    const loop = (now: number) => {
      const r = run.current, st = stage.current;
      if (!r || !st || !r.fight) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      st.update(dt);
      const card = r.fight.hand[selRef.current];
      st.draw(c, w, h, dpr, r, now / 1000, { target: card && CARDS[card.id].target ? targetRef.current : -1, hover: hoverRef.current, aiming: !!card && CARDS[card.id].target });
      if (st.busy !== wasBusy || (st.busy && now - ui > 150)) { wasBusy = st.busy; ui = now; refresh(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen, fightNo]);

  // Keyboard, in a fight: 1 to 9 and 0 choose a card (again to play it), left and right change the foe, Enter plays, E ends the turn.
  useEffect(() => {
    if (screen !== 'run') return;
    const down = (e: KeyboardEvent) => {
      const r = run.current;
      if (!r || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (sheet) setSheet(null); else pick(-1); return; }
      if (sheet) return;
      if (k === 'm') { toggleMute(); return; }
      if (k === 'f') { cycleSpeed(); return; }
      if (r.phase !== 'fight' && !stage.current?.busy) return;
      if (stage.current?.waiting) { if (k === 'enter' || k === ' ') { e.preventDefault(); skipAhead(); } return; }
      if (r.phase !== 'fight' || !r.fight) return;
      if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : Number(k) - 1; if (r.fight.hand[i]) tapCard(i); return; }
      if (k === 'e') { (document.activeElement as HTMLElement | null)?.blur?.(); endTurn(); return; }
      if (k === 'arrowleft' || k === 'arrowright') {
        e.preventDefault();
        const live = r.fight.foes.map((x, i) => (x.alive ? i : -1)).filter((i) => i >= 0), at = live.indexOf(targetRef.current);
        if (live.length) { const t = live[(at + (k === 'arrowright' ? 1 : live.length - 1) + live.length) % live.length]; pick(selRef.current, t); if (selRef.current < 0) setLook(t); }
        return;
      }
      if ((k === 'enter' || k === ' ') && selRef.current >= 0) { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur?.(); tapCard(selRef.current); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const r = run.current, st = stage.current;
  const header = (
    <header className="ss-header">
      <a className="ss-back" href="/">← MAIN ARCADE</a>
      <span className="ss-brand">SUMMIT SHUFFLE</span>
      <span className="ss-tools">
        <button onClick={toggleMute} aria-pressed={save.muted}>{save.muted ? 'Sound off' : 'Sound on'}</button>
        {screen === 'run' && <button onClick={cycleSpeed}>{speed}×</button>}
        {screen === 'run' && <button data-testid="menu" onClick={home}>Menu</button>}
      </span>
    </header>
  );
  const sheetView = sheet && (
    <div className="ss-sheet" role="dialog" aria-label={sheet.title}>
      <button className="ss-sheet-back" aria-label="Close" tabIndex={-1} onClick={() => setSheet(null)} />
      <div>
        <header><h2>{sheet.title}</h2><button data-testid="sheet-close" onClick={() => setSheet(null)}>Close</button></header>
        {sheet.note && <p>{sheet.note}</p>}
        <div className="ss-grid">
          {sheet.cards.map((c) => <CardView key={c.uid} card={sheet.show ? sheet.show(c) : c} testid={sheet.pick ? 'sheet-card' : undefined} onClick={sheet.pick ? () => sheet.pick!(c) : undefined} />)}
          {!sheet.cards.length && <p>Nothing here.</p>}
        </div>
      </div>
    </div>
  );

  // ---------- Home ----------
  if (screen === 'home' || !r) {
    const hero = save.hero, open = openLevel(save.best[hero]), lv = Math.min(level, open), saved = save.run ? Run.load(save.run) : null;
    const foundCards = POOL.filter((id) => save.cards.includes(id)).length, commonTrinkets = TRINKET_IDS.filter((t) => TRINKETS[t].tier !== 'start');
    return (
      <main className="ss-shell">
        {header}
        <section className="ss-intro">
          <div className="ss-intro-art"><Portrait hero="dora" size={96} /><Portrait hero="enzo" size={96} /></div>
          <div>
            <p className="ss-eyebrow">DECK-BUILDING CLIMB · THREE STRETCHES · SIX ALTITUDES</p>
            <h1>Summit Shuffle</h1>
            <p className="ss-lede">Climb the mountain one stop at a time with a deck of <b>ten plain cards</b>. Every predator shows what it will do next. Play your hand, add a card after every fight, and build a deck that can face the <b>Cougar of the Summit</b>.</p>
          </div>
        </section>
        {note && <output className="ss-note ss-note-home">{note}</output>}

        {saved && (
          <section className="ss-resume">
            <Portrait hero={saved.hero} size={56} />
            <div><strong>{HEROES[saved.hero].name} is on the mountain</strong><small>{ALTITUDES[saved.level].name} · {ACTS[saved.act].name} · stop {saved.stats.stops} of {STOPS} · {saved.hp}/{saved.maxHp} health</small></div>
            <button className="ss-go" data-testid="resume" onClick={resume}>Carry on →</button>
            <button data-testid="abandon" onClick={abandon}>Give up this climb</button>
          </section>
        )}

        <h2 className="ss-section">Who climbs <small>the same cards for both; each brings a trinket of their own</small></h2>
        <div className="ss-heroes">
          {HERO_IDS.map((h) => {
            const b = save.best[h], t = TRINKETS[HEROES[h].trinket];
            return (
              <button key={h} className={`ss-hero${hero === h ? ' on' : ''}`} aria-pressed={hero === h} data-testid={`hero-${h}`} onClick={() => chooseHero(h)}>
                <Portrait hero={h} size={84} />
                <span><strong>{HEROES[h].name}</strong><small>{HEROES[h].hp} health · {t.icon} {t.name}</small><em>{t.text}</em>
                  <i>{b.runs ? `${b.wins} of ${plural(b.runs, 'climb')} reached the summit · ${b.cleared >= 0 ? `highest: ${ALTITUDES[b.cleared].name}` : `furthest: stop ${b.far} of ${STOPS}`}` : 'Not climbed yet'}</i></span>
              </button>
            );
          })}
        </div>

        <h2 className="ss-section">How high <small>reach the summit to open the next altitude for that chinchilla</small></h2>
        <div className="ss-levels" role="group" aria-label="Altitude">
          {ALTITUDES.map((a, i) => (
            <button key={a.name} className={lv === i ? 'on' : ''} aria-pressed={lv === i} disabled={!loaded || i > open} data-testid={`level-${i}`} onClick={() => setLevel(i)}>
              <b>{i > open ? '🔒 ' : ''}{a.name}</b><small>{a.text}</small>
            </button>
          ))}
        </div>
        <p className="ss-start">
          <button className="ss-go ss-big" data-testid="start" disabled={!loaded} onClick={() => begin(hero)}>{saved ? 'Start a new climb' : 'Start the climb'} with {HEROES[hero].name} →</button>
          {saved && <small>Starting a new climb gives up the one in progress.</small>}
        </p>

        <ol className="ss-how">
          <li><b>Read the intents.</b> The badge over each predator shows its next move: ⚔️ is an attack and the number is the damage coming.</li>
          <li><b>Spend your energy.</b> You draw 5 cards and have {ENERGY} energy each turn. Attacks hurt, <b>Fluff</b> soaks up damage until your next turn.</li>
          <li><b>Pick your trail.</b> Fights give cards, alphas give trinkets, burrows heal or sharpen a card, stalls sell and take cards away.</li>
          <li><b>Keep the deck lean.</b> You may skip a card reward. A small deck draws its best cards more often.</li>
        </ol>

        <details className="ss-fold">
        <summary className="ss-section">The card book <small>{foundCards} of {POOL.length} seen on your climbs</small></summary>
        <div className="ss-grid ss-book">
          {POOL.map((id) => (save.cards.includes(id) ? <CardView key={id} card={{ id, up: false }} /> : <div key={id} className="ss-card ss-unknown" aria-label="A card you have not seen yet"><strong>?</strong><em>{CARDS[id].rarity}</em></div>))}
        </div>
        </details>
        <details className="ss-fold">
        <summary className="ss-section">Trinkets <small>{commonTrinkets.filter((t) => save.trinkets.includes(t)).length} of {commonTrinkets.length} found</small></summary>
        <div className="ss-relics">
          {TRINKET_IDS.map((id) => { const t = TRINKETS[id], seen = t.tier === 'start' || save.trinkets.includes(id); return <div key={id} className={`ss-relic${seen ? '' : ' dim'}`}><span aria-hidden="true">{seen ? t.icon : '❔'}</span><div><strong>{seen ? t.name : 'Not found yet'}</strong><p>{seen ? t.text : t.tier === 'boss' ? 'A guardian carries this.' : 'Alphas, stashes and stalls have this.'}</p></div></div>; })}
        </div>
        </details>
        <h2 className="ss-section">The mountain</h2>
        <div className="ss-acts">
          {ACTS.map((a, i) => <div key={a.name} className="ss-act"><FoeIcon kind={a.boss[0]} size={62} /><div><strong>{i + 1}. {a.name}</strong><p>{a.blurb} Guardian: <b>{FOES[a.boss[0]].name}</b>. {FOES[a.boss[0]].blurb}</p></div></div>)}
        </div>
      </main>
    );
  }

  // ---------- A climb ----------
  const f = r.fight, busy = !!st?.busy, inFight = !!f && (r.phase === 'fight' || busy);
  const phase = inFight ? 'fight' : r.phase;
  const topbar = (
    <section className="ss-top" data-testid="top" data-phase={r.phase} data-hp={r.hp} data-seeds={r.seeds} data-stop={r.stats.stops} data-act={r.act} data-deck={r.deck.length}>
      <Portrait hero={r.hero} size={40} />
      <span className="ss-stat ss-hp" title="Health"><b>♥ {inFight && st ? Math.max(0, st.hero.hp) : r.hp}</b>/{r.maxHp}</span>
      <span className="ss-stat" title="Seeds, for the treat stall">🌻 <b>{r.seeds}</b></span>
      <span className="ss-where"><strong>{ACTS[r.act].name}</strong><small>{ALTITUDES[r.level].name} · stop {r.stats.stops} of {STOPS}</small></span>
      <span className="ss-bag" aria-label="Trinkets">
        {r.trinkets.map((id) => <button key={id} title={`${TRINKETS[id].name}: ${TRINKETS[id].text}`} aria-label={TRINKETS[id].name} onClick={() => say(`${TRINKETS[id].name}: ${TRINKETS[id].text}`)}>{TRINKETS[id].icon}</button>)}
      </span>
      <button data-testid="deck" onClick={() => setSheet({ title: `Your deck · ${plural(r.deck.length, 'card')}`, cards: r.deck.slice().sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name)) })}>Deck {r.deck.length}</button>
    </section>
  );
  const toast = note && <output className="ss-note">{note}</output>;

  let body: React.ReactNode = null;
  if (phase === 'fight' && f && st) {
    const can = r.phase === 'fight' && !st.waiting, card = f.hand[sel], d = card ? CARDS[card.id] : null, aim = d?.target ? target : -1;
    const playable = can ? r.plays().length : 0, viewed = look >= 0 && f.foes[look]?.alive ? look : -2;
    let info: React.ReactNode;
    if (card && d) info = <><b>{nameOf(card)}</b> · {r.textOf(card, aim)} {d.target ? (aim >= 0 && f.foes[aim]?.alive ? <i>Aimed at {f.foes[aim].name}. Tap the card again to play it, or tap another foe.</i> : <i>Tap a foe to play it.</i>) : <i>Tap the card again to play it.</i>}</>;
    else if (viewed >= 0) { const x = f.foes[viewed], lines = statusLine(x.st); info = <><b>{x.name}</b> · {x.hp}/{x.maxHp} health{x.fluff ? `, ${x.fluff} Fluff` : ''}. {r.phase === 'fight' ? r.intentOf(viewed).text : ''} {lines.length ? <i>{lines.join(' ')}</i> : null}</>; }
    else if (look === -1) { const lines = statusLine(f.st); info = <><b>{HEROES[r.hero].name}</b> · {r.hp}/{r.maxHp} health{f.fluff ? `, ${f.fluff} Fluff` : ''}. {lines.length ? <i>{lines.join(' ')}</i> : 'Nothing is on you right now.'}</>; }
    else if (!can) info = r.phase === 'fight' ? <i>The predators are taking their turn… tap the board to skip ahead.</i> : <i>…</i>;
    else { const inc = r.incoming, short = Math.max(0, inc - f.fluff); info = inc ? <>The predators will hit for <b>{inc}</b> this turn. You have <b>{f.fluff}</b> Fluff{short ? <>, so <b>{short}</b> gets through.</> : ', which covers it.'}</> : <>No attack is coming this turn. A good time to hit hard or set up.</>; }
    body = (
      <>
        <div className="ss-board" ref={box}>
          <canvas
            ref={canvas} tabIndex={0} data-testid="board" data-turn={f.turn} data-busy={busy ? '1' : '0'} data-waiting={st.waiting ? '1' : '0'} data-foes={f.foes.filter((x) => x.alive).length}
            aria-label="The fight. Number keys choose a card, left and right choose a foe, Enter plays the card and E ends your turn."
            onPointerDown={(e) => { if (st.waiting) { skipAhead(); return; } const t = boardPoint(e); if (t >= 0) tapFoe(t); else { const q = e.currentTarget.getBoundingClientRect(); if (e.clientX - q.left < q.width * 0.32) { setLook(-1); pick(-1); } else { setLook(-2); pick(-1); } } }}
            onPointerMove={(e) => { const t = boardPoint(e); if (t !== hoverRef.current) { hoverRef.current = t; setHover(t); } }}
            onPointerLeave={() => { hoverRef.current = -1; setHover(-1); }}
            style={{ cursor: hover >= 0 ? 'pointer' : 'default' }}
          />
          {toast}
        </div>
        <p className="ss-info" data-testid="info">{info}</p>
        <div className="ss-bar">
          <span className="ss-energy" data-testid="energy" data-energy={f.energy} title="Energy">{f.energy}<small>energy</small></span>
          <button data-testid="pile-draw" onClick={() => setSheet({ title: `Draw pile · ${f.draw.length}`, note: 'In no particular order.', cards: f.draw.slice().sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name)) })}>Draw {f.draw.length}</button>
          <button data-testid="pile-discard" onClick={() => setSheet({ title: `Discard pile · ${f.discard.length}`, cards: f.discard })}>Discard {f.discard.length}</button>
          {f.gone.length > 0 && <button onClick={() => setSheet({ title: `Exhausted · ${f.gone.length}`, note: 'Gone until the fight is over.', cards: f.gone })}>Gone {f.gone.length}</button>}
          <span className="ss-spacer" />
          <button className={`ss-go${can && !playable ? ' ss-pulse' : ''}`} data-testid="end-turn" disabled={!can} onClick={endTurn}>End turn <kbd>E</kbd></button>
        </div>
        <div className={`ss-hand n${Math.min(10, f.hand.length)}`} data-testid="hand" data-count={f.hand.length}>
          {f.hand.map((c, i) => <CardView key={c.uid} card={c} index={i} testid={`hand-${i}`} text={r.textOf(c, sel === i ? aim : -1)} on={sel === i} dim={!can || !!r.cannot(i, CARDS[c.id].target ? aimFor(r) : -1)} onClick={() => tapCard(i)} />)}
          {!f.hand.length && r.phase === 'fight' && <p className="ss-empty">No cards left this turn. End your turn to draw a new hand.</p>}
        </div>
      </>
    );
  } else if (phase === 'map') {
    const paths = r.paths(), nodes = r.map, px = (n: MapNode) => 10 + (n.lane / (LANES - 1)) * 80, py = (n: MapNode) => 92 - (n.row / ROWS) * 84;
    body = (
      <>
        <p className="ss-map-title"><b>Stretch {r.act + 1} of {ACTS.length}: {ACTS[r.act].name}</b><span>{ACTS[r.act].blurb} {r.at < 0 ? 'Choose where to start.' : 'Choose where to go next.'}</span></p>
        <div className={`ss-map a${r.act}`} data-testid="map">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {nodes.flatMap((n) => n.next.map((m) => { const to = nodes[m], done = r.walked.includes(n.id) && r.walked.includes(m), next = n.id === r.at && paths.includes(m); return <line key={`${n.id}-${m}`} x1={px(n)} y1={py(n)} x2={px(to)} y2={py(to)} className={done ? 'done' : next ? 'next' : ''} />; }))}
          </svg>
          {nodes.map((n) => {
            const open = paths.includes(n.id), here = n.id === r.at, been = r.walked.includes(n.id);
            return (
              <button key={n.id} className={`ss-node k-${n.type}${open ? ' open' : ''}${here ? ' here' : ''}${been ? ' been' : ''}`} style={{ left: `${px(n)}%`, top: `${py(n)}%` }} disabled={!open} data-testid={`node-${n.id}`} data-type={n.type} data-open={open ? '1' : '0'} title={n.type === 'boss' ? `Guardian: ${FOES[ACTS[r.act].boss[0]].name}` : NODE_NAMES[n.type]} aria-label={`${n.type === 'boss' ? `Guardian: ${FOES[ACTS[r.act].boss[0]].name}` : NODE_NAMES[n.type]}${here ? ', you are here' : open ? ', open' : ''}`} onClick={() => go(n.id)}>
                <span aria-hidden="true">{NODE_ICON[n.type]}</span>
              </button>
            );
          })}
          {toast}
        </div>
        <ul className="ss-legend">{(['fight', 'alpha', 'event', 'rest', 'stall', 'stash', 'boss'] as NodeType[]).map((t) => <li key={t}><span aria-hidden="true">{NODE_ICON[t]}</span> {t === 'fight' ? 'Predators: a card' : t === 'alpha' ? 'Alpha: a trinket' : t === 'event' ? 'Something on the trail' : t === 'rest' ? 'Rest burrow' : t === 'stall' ? 'Treat stall' : t === 'stash' ? 'Hidden stash' : `Guardian: ${FOES[ACTS[r.act].boss[0]].name}`}</li>)}</ul>
      </>
    );
  } else if (phase === 'reward' && r.reward) {
    const w = r.reward, boss = r.node?.type === 'boss';
    body = (
      <section className="ss-panel" data-testid="reward">
        <p className="ss-eyebrow">{r.node?.type === 'stash' ? 'A HIDDEN STASH' : boss ? `${ACTS[r.act].name.toUpperCase()} · GUARDIAN BEATEN` : 'THE TRAIL IS CLEAR'}</p>
        <h2>{r.node?.type === 'stash' ? 'Somebody left this behind' : boss ? `${FOES[ACTS[r.act].boss[0]].name} is beaten!` : 'Pick your reward'}</h2>
        {w.note && <p>{w.note}</p>}
        <p className="ss-loot">{w.seeds > 0 && <span>🌻 <b>{w.seeds}</b> seeds</span>}{w.trinket && <span title={TRINKETS[w.trinket].text}>{TRINKETS[w.trinket].icon} <b>{TRINKETS[w.trinket].name}</b>: {TRINKETS[w.trinket].text}</span>}</p>
        {w.relics.length > 0 && <>
          <h3>{w.relicPicked ? 'Your trinket is packed' : 'Take one of the guardian’s trinkets'}</h3>
          <div className="ss-relics ss-choice">
            {w.relics.map((id, i) => <button key={id} className={`ss-relic${w.relicPicked && !r.has(id) ? ' dim' : ''}`} disabled={w.relicPicked} data-testid={`relic-${i}`} onClick={() => act(r.takeRelic(i), 'power')}><span aria-hidden="true">{TRINKETS[id].icon}</span><div><strong>{TRINKETS[id].name}</strong><p>{TRINKETS[id].text}</p></div></button>)}
          </div>
        </>}
        {w.cards.length > 0 && <>
          <h3>{w.picked ? 'Card chosen' : 'Add one card to your deck, or none'}</h3>
          <div className="ss-grid ss-choice">{w.cards.map((c, i) => <CardView key={c.uid} card={c} testid={`reward-${i}`} dim={w.picked && !r.deck.includes(c)} on={w.picked && r.deck.includes(c)} onClick={() => { if (!w.picked) act(r.takeCard(i), 'power'); }} />)}</div>
        </>}
        <p className="ss-row">
          <button className="ss-go" data-testid="continue" disabled={!w.relicPicked} onClick={() => act(r.leave(), 'step')}>{!w.picked && w.cards.length ? 'Skip the cards and carry on →' : boss ? 'On to the next stretch →' : 'Back to the trail →'}</button>
          {boss && <small>Beating a guardian mends {r.level >= 3 ? '70% of the health you have lost' : 'all your health'}.</small>}
        </p>
        {toast}
      </section>
    );
  } else if (phase === 'rest') {
    body = (
      <section className="ss-panel" data-testid="rest">
        <p className="ss-eyebrow">A REST BURROW</p>
        <h2>Warm, dry and out of the wind</h2>
        <p>You have time for one thing before moving on.</p>
        <div className="ss-options">
          <button data-testid="nap" disabled={!r.canNap} onClick={() => act(r.nap(), 'heal')}><b>💤 Nap</b><small>{r.canNap ? `Heal ${Math.min(r.napHeal, r.maxHp - r.hp)} health (you have ${r.hp} of ${r.maxHp}).` : 'Spring Water keeps you wide awake.'}</small></button>
          <button data-testid="groom" disabled={!r.upgradable().length} onClick={() => choosing('upgrade', 'Groom: choose a card to upgrade', (c) => r.groom(c.uid))}><b>✨ Groom</b><small>Upgrade one card for the rest of the climb.</small></button>
          {!r.canNap && !r.upgradable().length && <button onClick={() => act(r.skipRest(), 'step')}><b>Move on</b><small>There is nothing to do here.</small></button>}
        </div>
        {toast}
      </section>
    );
  } else if (phase === 'stall' && r.stall) {
    const s = r.stall;
    body = (
      <section className="ss-panel" data-testid="stall">
        <p className="ss-eyebrow">A TREAT STALL · YOU HAVE 🌻 {r.seeds}</p>
        <h2>“Seeds for treats, treats for seeds.”</h2>
        <div className="ss-grid ss-choice">{s.cards.map((x, i) => <CardView key={x.card.uid} card={x.card} testid={`buy-card-${i}`} tag={x.sold ? 'Sold' : `🌻 ${x.price}`} dim={x.sold || r.seeds < x.price} onClick={() => { if (!x.sold) act(r.buyCard(i), 'coin'); }} />)}</div>
        <div className="ss-relics ss-choice">
          {s.trinkets.map((x, i) => <button key={x.id} className={`ss-relic${x.sold || r.seeds < x.price ? ' dim' : ''}`} data-testid={`buy-trinket-${i}`} aria-disabled={x.sold} onClick={() => { if (!x.sold) act(r.buyTrinket(i), 'coin'); }}><span aria-hidden="true">{TRINKETS[x.id].icon}</span><div><strong>{TRINKETS[x.id].name} <i>{x.sold ? 'Sold' : `🌻 ${x.price}`}</i></strong><p>{TRINKETS[x.id].text}</p></div></button>)}
          <button className={`ss-relic${s.removed || r.seeds < r.removePrice ? ' dim' : ''}`} data-testid="buy-removal" aria-disabled={s.removed} onClick={() => { if (s.removed) say('The stall has already taken a card today.'); else if (r.seeds < r.removePrice) say('Not enough seeds.'); else choosing('remove', 'Choose a card to leave at the stall', (c) => r.buyRemoval(c.uid)); }}><span aria-hidden="true">🧺</span><div><strong>Leave a card behind <i>{s.removed ? 'Done' : `🌻 ${r.removePrice}`}</i></strong><p>Take one card out of your deck for good. The price goes up each time.</p></div></button>
        </div>
        <p className="ss-row"><button className="ss-go" data-testid="continue" onClick={() => act(r.leave(), 'step')}>Back to the trail →</button></p>
        {toast}
      </section>
    );
  } else if (phase === 'event') {
    const v = r.eventView();
    body = v && (
      <section className="ss-panel" data-testid="event">
        <p className="ss-eyebrow">SOMETHING ON THE TRAIL</p>
        <h2>{v.name}</h2>
        <p>{v.text}</p>
        {v.done ? <><p className="ss-result" data-testid="event-result">{v.done}</p><p className="ss-row"><button className="ss-go" data-testid="continue" onClick={() => act(r.leave(), 'step')}>Back to the trail →</button></p></> : (
          <div className="ss-options">
            {v.options.map((o, i) => <button key={o.label} disabled={!o.ok} data-testid={`option-${i}`} onClick={() => (o.pick ? choosing(o.pick, `${o.label}: choose a card`, (c) => r.choose(i, c.uid)) : act(r.choose(i)))}><b>{o.label}</b><small>{o.detail}</small></button>)}
          </div>
        )}
        {toast}
      </section>
    );
  } else {
    const won = r.phase === 'won', b = save.best[r.hero], opened = won && r.level === b.cleared && r.level + 1 < ALTITUDES.length;
    body = (
      <section className="ss-panel ss-end" data-testid="end" data-won={won ? '1' : '0'}>
        <p className="ss-eyebrow">{ALTITUDES[r.level].name.toUpperCase()} · {plural(r.stats.stops, 'STOP')} OF {STOPS}</p>
        <h2>{won ? `${HEROES[r.hero].name} stands on the summit!` : `${HEROES[r.hero].name} turns back at ${ACTS[r.act].name.toLowerCase()}.`}</h2>
        <p>{won ? 'The Cougar slinks off down the far side, and the whole of the Andes is spread out below.' : f ? `${f.foes.find((x) => x.alive)?.name ?? 'The mountain'} was too much this time. Every climb teaches the trail a little better.` : 'Every climb teaches the trail a little better.'}</p>
        {opened && <p className="ss-open">{ALTITUDES[r.level + 1].name} is open for {HEROES[r.hero].name}: {ALTITUDES[r.level + 1].text}</p>}
        {won && r.level === ALTITUDES.length - 1 && <p className="ss-open">That is the highest altitude there is. Nobody climbs better.</p>}
        <ul className="ss-stats">
          <li><b>{r.stats.fights}</b> fights won</li><li><b>{r.stats.foes}</b> predators seen off</li><li><b>{r.stats.turns}</b> turns</li><li><b>{r.stats.cards}</b> cards played</li><li><b>{r.stats.dealt}</b> damage dealt</li><li><b>{r.stats.taken}</b> health lost</li>
        </ul>
        <p className="ss-row">
          <button className="ss-go" data-testid="again" onClick={() => { setLevel(opened ? r.level + 1 : r.level); setScreen('home'); }}>{won ? 'Climb again →' : 'Try again →'}</button>
          <button onClick={() => setSheet({ title: `The deck you finished with · ${plural(r.deck.length, 'card')}`, cards: r.deck.slice().sort((a, c) => CARDS[a.id].name.localeCompare(CARDS[c.id].name)) })}>See the deck</button>
        </p>
        <p className="ss-loot">{r.trinkets.map((id) => <span key={id} title={TRINKETS[id].text}>{TRINKETS[id].icon} {TRINKETS[id].name}</span>)}</p>
      </section>
    );
  }
  void canUpgrade;

  return (
    <main className={`ss-shell ss-run p-${phase}`}>
      {header}
      {topbar}
      {body}
      {sheetView}
    </main>
  );
}
function plural(n: number, one: string) { return `${n} ${one}${n === 1 ? '' : one === one.toUpperCase() ? 'S' : 's'}`; }
