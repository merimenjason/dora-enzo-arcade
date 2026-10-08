/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Run, CARDS, POOL, TRINKETS, TRINKET_IDS, STATUS, FOES, ACTS, HEROES, HERO_IDS, ALTITUDES, NODE_NAMES, STOPS, ROWS, LANES, ENERGY,
  costOf, nameOf, describe, canUpgrade, glossFor, type Gloss, type Card, type CardPick, type HeroId, type MapNode, type NodeType, type StatusId, type Statuses,
} from '../../lib/summit-shuffle-game';
import { Stage, drawCardArt, drawHeroIcon, drawFoeIcon, drawTrail } from '../../lib/summit-shuffle-scene';
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
const STOP_TEXT: Record<NodeType, string> = {
  fight: 'A fight with the predators of this stretch. Win it to choose a new card and pick up some seeds.',
  alpha: 'A harder fight. Win it for a trinket as well as a card.',
  rest: 'Nap to get health back, or groom a card to upgrade it.',
  stall: 'Spend seeds on cards and trinkets, or pay to leave a card behind.',
  event: 'A chance meeting. It might help, and it might cost you.',
  stash: 'A trinket somebody hid, or seeds if there are none left to find. No fight.',
  boss: '',
};
/** The picture on a stop of the trail. */
function StopIcon({ type }: { type: NodeType }) {
  const ink = '#2c2430', line = { stroke: ink, strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {type === 'fight' && <g {...line} fill="#6b4a3a"><ellipse cx="12" cy="15.6" rx="5.2" ry="4.2" /><ellipse cx="5.4" cy="10.4" rx="2.1" ry="2.7" /><ellipse cx="9.6" cy="6.4" rx="2.2" ry="2.9" /><ellipse cx="14.4" cy="6.4" rx="2.2" ry="2.9" /><ellipse cx="18.6" cy="10.4" rx="2.1" ry="2.7" /></g>}
      {type === 'alpha' && <g {...line}><path d="M12 2.2c1.2 3.4 5.8 5.4 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-2.6 1.5-3.6 2.4-6 .9 1.5 1.9 1.8 3.4-4.6z" fill="#ff7a3c" /><path d="M12 10.5c.7 1.7 2.6 2.5 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.5 1-2 1.4-3 .4.6.7.4 1.2-1.6z" fill="#ffd45a" stroke="none" /></g>}
      {type === 'rest' && <g {...line}><path d="M2.5 20.5C3.5 11 8 6.5 12 6.5s8.5 4.5 9.5 14z" fill="#a8793f" /><path d="M8 20.5c.3-5 2-7.5 4-7.5s3.7 2.5 4 7.500z" fill="#2a1c2e" /><path d="M15.5 2.500h3.500l-3.5 3.600h3.5" fill="none" stroke="#3a4f8a" strokeWidth="1.5" /></g>}
      {type === 'stall' && <g {...line}><path d="M12 7.2c-2.2-1.7-6.7-.6-6.7 4.6 0 4.8 3.6 8.7 5.2 8.7.7 0 1-.4 1.5-.4s.8.4 1.5.400c1.6 0 5.2-3.9 5.2-8.7 0-5.2-4.5-6.3-6.7-4.600z" fill="#e8483c" /><path d="M12 7.200c0-2 .7-3.5 2-4.6" fill="none" /><path d="M13.2 5.200c1.2-1.8 3-2.2 4.6-1.7-.5 1.8-2.2 2.9-4.6 1.700z" fill="#6fbf4a" /><ellipse cx="8.6" cy="11.4" rx="1.3" ry="2.2" fill="#ffb3a8" stroke="none" transform="rotate(20 8.6 11.4)" /></g>}
      {type === 'event' && <text x="12" y="18.6" textAnchor="middle" fontSize="19" fontWeight="900" fill="#b23a52" stroke={ink} strokeWidth="0.9" paintOrder="stroke" fontFamily="ui-rounded, system-ui, sans-serif">?</text>}
      {type === 'stash' && <g {...line}><path d="M3.5 11.500h17v8.300a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" fill="#b5742f" /><path d="M3.5 11.500c0-4 2.5-6.5 5-6.500h7c2.5 0 5 2.5 5 6.500z" fill="#d9963f" /><path d="M9 5v15.800M15 5v15.8" stroke="#7a4a1a" strokeWidth="1.1" /><rect x="10.3" y="9.8" width="3.4" height="4.4" rx="0.9" fill="#ffd45a" /></g>}
      {type === 'boss' && <g {...line}><path d="M3.5 18.5 2.3 7.200l5.2 4 4.5-7 4.5 7 5.2-4-1.2 11.300z" fill="#ffd13d" /><rect x="3.5" y="18.5" width="17" height="2.8" rx="1" fill="#f0a020" /><circle cx="12" cy="13.6" r="1.7" fill="#e8483c" /><circle cx="7.2" cy="15" r="1.1" fill="#4aa3e8" /><circle cx="16.8" cy="15" r="1.1" fill="#4aa3e8" /></g>}
    </svg>
  );
}
/** The mountain a stretch's trail is drawn on, painted to fit whatever size the map is. */
function TrailArt({ act }: { act: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const paint = () => {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1), c = cv.getContext('2d');
      if (!c || !w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0); drawTrail(c, w, h, act);
    };
    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(cv);
    return () => watch.disconnect();
  }, [act]);
  return <canvas ref={ref} className="ss-map-art" aria-hidden="true" />;
}

// ---------- Notes that pop up beside whatever the pointer is on, or under a finger held down ----------
type Tip =
  | { kind: 'card'; card: { id: string; up: boolean }; text: string; aimed?: string }
  | { kind: 'note'; icon?: string; title: string; sub?: string; body?: string; notes?: Gloss[]; foot?: string };
type Place = 'side' | 'above';
type Box = { x: number; y: number; w: number; h: number };
/** What is showing: where it hangs from, and how to make it. It is made afresh on every render, so its numbers stay true. */
type Shown = { at: Box; place: Place; make: () => Tip | null };
/** The page fills these in; anything on it may call them. */
const peek: { show: (at: Box, make: () => Tip | null, place?: Place) => void; hide: () => void } = { show: () => {}, hide: () => {} };
const press = { timer: 0, held: false, x: 0, y: 0 };
const boxOf = (el: Element): Box => { const q = el.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
/** Handlers that show a note while the mouse is over something, or while a finger is held on it. */
function tipOn(make: () => Tip | null, place: Place = 'side') {
  type E = React.PointerEvent<HTMLElement>;
  const lift = () => { window.clearTimeout(press.timer); if (press.held) peek.hide(); };
  return {
    onPointerEnter: (e: E) => { if (e.pointerType === 'mouse') peek.show(boxOf(e.currentTarget), make, place); },
    onPointerLeave: (e: E) => { if (e.pointerType === 'mouse') peek.hide(); },
    onPointerDown: (e: E) => {
      if (e.pointerType === 'mouse') return;
      const el = e.currentTarget;
      press.held = false; press.x = e.clientX; press.y = e.clientY;
      window.clearTimeout(press.timer);
      press.timer = window.setTimeout(() => { press.held = true; peek.show(boxOf(el), make, place); }, 380);
    },
    onPointerMove: (e: E) => { if (e.pointerType !== 'mouse' && !press.held && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) window.clearTimeout(press.timer); },
    onPointerUp: lift, onPointerCancel: lift,
    // Letting go after a long look is not a tap.
    onClickCapture: (e: React.MouseEvent) => { if (press.held) { press.held = false; e.preventDefault(); e.stopPropagation(); } },
    onContextMenu: (e: React.MouseEvent) => { if (press.held) e.preventDefault(); },
  };
}
/** Rules text with any number that differs from the printed one picked out: more in green, less in red. */
function Rules({ text, base }: { text: string; base?: string }) {
  const now = text.split(/(\d+)/), was = base?.split(/(\d+)/);
  if (!was || was.length !== now.length) return <>{text}</>;
  return <>{now.map((part, i) => (i % 2 && part !== was[i] ? <b key={i} className={Number(part) > Number(was[i]) ? 'more' : 'less'}>{part}</b> : part))}</>;
}
const TYPE_NAME = { attack: 'Attack', skill: 'Skill', power: 'Power', status: 'Status', curse: 'Curse' } as const;

const artCache = new Map<string, string>();
/** A card's picture as an image, drawn once per kind and shared by every copy on the page. */
function CardArt({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const d = CARDS[id], key = `${d.art}|${d.type}`;
    let url = artCache.get(key);
    if (!url) { const cv = document.createElement('canvas'); cv.width = 400; cv.height = 240; const c = cv.getContext('2d'); if (c) { drawCardArt(c, d.art, d.type, 400, 240); url = cv.toDataURL(); artCache.set(key, url); } }
    setSrc(url ?? '');
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on a canvas, nothing for the image optimiser to do
  return src ? <img className="ss-art" src={src} alt="" /> : <span className="ss-art" />;
}
type CardProps = {
  card: { id: string; up: boolean }; text?: string; onClick?: () => void; disabled?: boolean; on?: boolean; dim?: boolean; tag?: string; testid?: string; index?: number;
  /** In a fight: the text and the foe it is worked out against, read again whenever the note is drawn. */
  live?: () => { text: string; aimed?: string } | null;
  /** Where the big copy hangs, and `plain` for a card that shows none (the big copy itself). */
  place?: Place; plain?: boolean; style?: React.CSSProperties;
};
function CardView({ card, text, onClick, disabled, on, dim, tag, testid, index, live, place, plain, style }: CardProps) {
  const d = CARDS[card.id], cost = costOf(card), printed = describe(card), body = (
    <>
      <span className="ss-cost" aria-label={cost === -2 ? 'cannot be played' : cost === -1 ? 'costs all your energy' : `costs ${cost} energy`}>{cost === -2 ? '–' : cost === -1 ? 'X' : cost}</span>
      <strong>{nameOf(card)}</strong>
      <CardArt id={card.id} />
      <em>{TYPE_NAME[d.type]}{d.rarity === 'uncommon' || d.rarity === 'rare' ? <span> · {d.rarity}</span> : null}</em>
      <span className="ss-text"><Rules text={text ?? printed} base={printed} /></span>
      {tag && <span className="ss-tag">{tag}</span>}
      {index !== undefined && <kbd>{(index + 1) % 10}</kbd>}
    </>
  );
  const cls = `ss-card t-${d.type} r-${d.rarity}${card.up ? ' up' : ''}${on ? ' on' : ''}${dim ? ' dim' : ''}`;
  const tips = plain ? {} : tipOn(() => { const now = live ? live() : { text: text ?? printed }; return now && { kind: 'card', card: { id: card.id, up: card.up }, ...now }; }, place);
  return onClick
    ? <button className={cls} style={style} data-testid={testid} data-card={card.id} aria-pressed={on} aria-disabled={disabled} onClick={onClick} {...tips}>{body}</button>
    : <div className={cls} style={style} data-testid={testid} data-card={card.id} {...tips}>{body}</div>;
}
/** The note itself: a big copy of a card with its words explained, or a few lines about something else. */
function Peek({ shown }: { shown: Shown | null }) {
  const ref = useRef<HTMLDivElement>(null), tip = shown ? shown.make() : null;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !shown) return;
    const vw = window.innerWidth, vh = window.innerHeight, w = el.offsetWidth, h = el.offsetHeight, a = shown.at, gap = shown.place === 'above' ? 34 : 12, edge = 8;
    let x = a.x + a.w / 2 - w / 2, y = a.y - h - gap;
    if (shown.place === 'side' && vw >= 620) {
      x = a.x + a.w + gap; y = a.y + a.h / 2 - h / 2;
      if (x + w > vw - edge) x = a.x - w - gap;
      if (x < edge) { x = a.x + a.w / 2 - w / 2; y = a.y - h - gap; }
    }
    if (y < edge && a.y + a.h + gap + h <= vh - edge) y = a.y + a.h + gap;
    el.style.left = `${Math.max(edge, Math.min(vw - w - edge, x))}px`; el.style.top = `${Math.max(edge, Math.min(vh - h - edge, y))}px`;
    el.style.visibility = 'visible';
  });
  if (!shown || !tip) return null;
  const line = (g: Gloss) => <p key={g.name}><span aria-hidden="true">{g.icon}</span><b>{g.name}</b> {g.text}</p>;
  if (tip.kind === 'card') {
    const d = CARDS[tip.card.id], notes = glossFor(`${tip.text} ${d.exhaust ? 'Exhaust' : ''}`, d.name), better = canUpgrade(tip.card) ? { id: tip.card.id, up: true } : null;
    return (
      <div className="ss-peek k-card" ref={ref} role="tooltip" data-testid="peek" data-card={tip.card.id}>
        <CardView card={tip.card} text={tip.text} plain />
        {(notes.length > 0 || better || tip.aimed) && (
          <div className="ss-peek-notes">
            {tip.aimed && <p className="ss-peek-aim">Numbers as they stand against <b>{tip.aimed}</b>.</p>}
            {notes.map(line)}
            {CARDS[tip.card.id].who && <p className="ss-peek-who">Only {HEROES[CARDS[tip.card.id].who!].name} finds this card on a climb.</p>}
            {better && <p className="ss-peek-up"><span aria-hidden="true">✨</span><b>Upgraded</b> {costOf(better) !== costOf(tip.card) ? `Costs ${costOf(better)}. ` : ''}{describe(better)}</p>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="ss-peek k-note" ref={ref} role="tooltip" data-testid="peek">
      <header>{tip.icon && <span aria-hidden="true">{tip.icon}</span>}<div><strong>{tip.title}</strong>{tip.sub && <small>{tip.sub}</small>}</div></header>
      {tip.body && <p className="ss-peek-body">{tip.body}</p>}
      {tip.notes && tip.notes.length > 0 && <div className="ss-peek-notes">{tip.notes.map(line)}</div>}
      {tip.foot && <p className="ss-peek-foot">{tip.foot}</p>}
    </div>
  );
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
/** What is on a creature, one note each, with its count in the name. */
const statusNotes = (st: Statuses): Gloss[] => (Object.keys(st) as StatusId[]).filter((id) => st[id] && id !== 'rush').map((id) => ({ name: `${STATUS[id].name}${id === 'den' ? '' : ` ${st[id]}`}`, icon: STATUS[id].icon, text: STATUS[id].text(st[id]!) }));
/** The glossary for a line of text, less anything a status note already covers. */
const wordsFor = (text: string, st: Statuses) => glossFor(text).filter((g) => !(Object.keys(st) as StatusId[]).some((id) => st[id] && STATUS[id].name === g.name));
type Ghost = { key: number; card: { id: string; up: boolean }; from: Box; dx: number; dy: number };
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
  const [shown, setShown] = useState<Shown | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [, setTick] = useState(0);
  const run = useRef<Run | null>(null), stage = useRef<Stage | null>(null), canvas = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null);
  const saveRef = useRef(save), selRef = useRef(-1), targetRef = useRef(-1), hoverRef = useRef(-1), overRef = useRef(-2), ghostNo = useRef(0), noteTimer = useRef(0), settled = useRef<Run | null>(null);
  saveRef.current = save;

  useEffect(() => { const s = readSave(); setSave(s); setMuted(s.muted); setLevel(openLevel(s.best[s.hero])); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => { (window as unknown as { __summit?: () => unknown }).__summit = () => ({ run: run.current, stage: stage.current }); }, []);

  // The pop-up notes: anything on the page shows one through `peek`, and any press, scroll or key puts it away.
  useEffect(() => {
    peek.show = (at, make, place = 'side') => setShown({ at, make, place });
    peek.hide = () => setShown(null);
    const away = () => { overRef.current = -2; setShown(null); };
    window.addEventListener('pointerdown', away, true); window.addEventListener('scroll', away, true); window.addEventListener('keydown', away, true); window.addEventListener('blur', away);
    return () => { peek.show = () => {}; peek.hide = () => {}; window.removeEventListener('pointerdown', away, true); window.removeEventListener('scroll', away, true); window.removeEventListener('keydown', away, true); window.removeEventListener('blur', away); };
  }, []);

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
    const el = document.querySelector(`[data-testid="hand-${i}"]`), from = el ? boxOf(el) : null, c = r.fight?.hand[i];
    const why = r.play(i, t);
    if (why) { say(why); cue('no'); return; }
    // A copy of the card flies from the hand to whoever it was played on.
    const cv = canvas.current, st = stage.current;
    if (from && c && cv && st) {
      const q = cv.getBoundingClientRect(), d = CARDS[c.id], b = d.target || d.type !== 'attack' ? st.boxOf(d.target ? t : -1, q.width, q.height, r) : null;
      const tx = q.left + (b ? b.x + b.w / 2 : q.width * 0.7), ty = q.top + (b ? b.y + b.h / 2 : q.height * 0.5), key = ++ghostNo.current;
      setGhosts((g) => [...g.slice(-5), { key, card: { id: c.id, up: c.up }, from, dx: tx - (from.x + from.w / 2), dy: ty - (from.y + from.h / 2) }]);
      window.setTimeout(() => setGhosts((g) => g.filter((x) => x.key !== key)), 700);
    }
    setShown(null);
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
    setShown(null); pick(-1); setLook(-2); r.endTurn(); commit();
  }
  const skipAhead = () => { const r = run.current, st = stage.current; if (r && st?.busy) { st.flush(r); refresh(); } };
  const boardPoint = (e: React.PointerEvent<HTMLCanvasElement>) => { const q = e.currentTarget.getBoundingClientRect(), r = run.current, st = stage.current; return r && st ? st.foeAt(e.clientX - q.left, e.clientY - q.top, q.width, q.height, r) : -1; };
  /** The note for the chinchilla (-1) or a foe: health, Fluff, what it will do next, and everything that is on it. */
  const creatureTip = (who: number) => (): Tip | null => {
    const r = run.current, f = r?.fight;
    if (!r || !f) return null;
    if (who === -1) {
      const inc = r.phase === 'fight' ? r.incoming : 0, short = Math.max(0, inc - f.fluff);
      return { kind: 'note', title: HEROES[r.hero].name, sub: `${Math.max(0, r.hp)}/${r.maxHp} health${f.fluff ? ` · ${f.fluff} Fluff` : ''}`, body: inc ? `The predators will hit for ${inc} this turn${short ? `, and ${short} of it gets through.` : ', and your Fluff covers it.'}` : 'No attack is coming this turn.', notes: [...statusNotes(f.st), ...(f.fluff ? wordsFor('Fluff', f.st) : [])] };
    }
    const x = f.foes[who];
    if (!x?.alive) return null;
    const next = r.phase === 'fight' && !stage.current?.waiting ? r.intentOf(who).text : '';
    return { kind: 'note', title: x.name, sub: `${x.hp}/${x.maxHp} health${x.fluff ? ` · ${x.fluff} Fluff` : ''}`, body: next ? `Next: ${next}` : undefined, notes: [...statusNotes(x.st), ...wordsFor(`${next}${x.fluff ? ' Fluff' : ''}`, x.st)], foot: FOES[x.kind].blurb };
  };
  /** Hangs that note beside the creature on the board. */
  function showCreature(who: number) {
    const cv = canvas.current, r = run.current, b = cv && r && stage.current?.boxOf(who, cv.clientWidth, cv.clientHeight, r);
    if (!cv || !b) return;
    const q = cv.getBoundingClientRect();
    peek.show({ x: q.left + b.x, y: q.top + b.y, w: b.w, h: b.h }, creatureTip(who));
  }
  const noteTip = (icon: string, title: string, body: string, foot?: string) => (): Tip => ({ kind: 'note', icon, title, body, notes: glossFor(body), foot });

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

        <h2 className="ss-section">Who climbs <small>shared cards and cards of their own; each brings a different trinket</small></h2>
        <div className="ss-heroes">
          {HERO_IDS.map((h) => {
            const b = save.best[h], t = TRINKETS[HEROES[h].trinket];
            return (
              <button key={h} className={`ss-hero${hero === h ? ' on' : ''}`} aria-pressed={hero === h} data-testid={`hero-${h}`} onClick={() => chooseHero(h)}>
                <Portrait hero={h} size={84} />
                <span><strong>{HEROES[h].name}</strong><small>{HEROES[h].hp} health · {t.icon} {t.name}</small><em>{t.text}</em><em>{HEROES[h].cards}</em>
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
        {([undefined, ...HERO_IDS] as const).map((who) => { const ids = POOL.filter((id) => CARDS[id].who === who); return (
          <div key={who ?? 'both'} data-testid={`book-${who ?? 'both'}`}>
            <h3 className="ss-book-head">{who ? `${HEROES[who].name}’s own` : 'Found by both'} <small>{ids.filter((id) => save.cards.includes(id)).length} of {ids.length}</small></h3>
            <div className="ss-grid ss-book">
              {ids.map((id) => (save.cards.includes(id) ? <CardView key={id} card={{ id, up: false }} /> : <div key={id} className="ss-card ss-unknown" aria-label="A card you have not seen yet"><strong>?</strong><em>{CARDS[id].rarity}</em></div>))}
            </div>
          </div>
        ); })}
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
        <Peek shown={shown} />
      </main>
    );
  }

  // ---------- A climb ----------
  const f = r.fight, busy = !!st?.busy, inFight = !!f && (r.phase === 'fight' || busy);
  const phase = inFight ? 'fight' : r.phase;
  const topbar = (
    <section className="ss-top" data-testid="top" data-phase={r.phase} data-hp={r.hp} data-seeds={r.seeds} data-stop={r.stats.stops} data-act={r.act} data-deck={r.deck.length}>
      <Portrait hero={r.hero} size={40} />
      <span className="ss-stat ss-hp" {...tipOn(noteTip('♥', 'Health', 'When it runs out, the climb is over. Rest burrows, some cards and beating a guardian give it back.'))}><b>♥ {inFight && st ? Math.max(0, st.hero.hp) : r.hp}</b>/{r.maxHp}</span>
      <span className="ss-stat" {...tipOn(noteTip('🌻', 'Seeds', 'Won in fights and spent at treat stalls, on cards, on trinkets and on leaving a card behind.'))}>🌻 <b>{r.seeds}</b></span>
      <span className="ss-where"><strong>{ACTS[r.act].name}</strong><small>{ALTITUDES[r.level].name} · stop {r.stats.stops} of {STOPS}</small></span>
      <span className="ss-bag" aria-label="Trinkets">
        {r.trinkets.map((id) => { const make = noteTip(TRINKETS[id].icon, TRINKETS[id].name, TRINKETS[id].text, TRINKETS[id].tier === 'start' ? `${HEROES[r.hero].name}’s own trinket.` : TRINKETS[id].tier === 'boss' ? 'Taken from a guardian.' : undefined); return <button key={id} data-testid={`trinket-${id}`} aria-label={`${TRINKETS[id].name}: ${TRINKETS[id].text}`} {...tipOn(make)} onClick={(e) => peek.show(boxOf(e.currentTarget), make)}>{TRINKETS[id].icon}</button>; })}
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
            onPointerDown={(e) => {
              if (st.waiting) { skipAhead(); return; }
              const t = boardPoint(e), q = e.currentTarget.getBoundingClientRect(), aiming = !!f.hand[selRef.current] && CARDS[f.hand[selRef.current].id].target && mine();
              if (t >= 0) { tapFoe(t); if (!aiming) { overRef.current = t; showCreature(t); } }
              else if (st.heroAt(e.clientX - q.left, e.clientY - q.top, q.width, q.height, r) || e.clientX - q.left < q.width * 0.32) { setLook(-1); pick(-1); overRef.current = -1; showCreature(-1); }
              else { setLook(-2); pick(-1); }
            }}
            onPointerMove={(e) => {
              const t = boardPoint(e), q = e.currentTarget.getBoundingClientRect();
              if (t !== hoverRef.current) { hoverRef.current = t; setHover(t); }
              if (e.pointerType !== 'mouse') return;
              const over = t >= 0 ? t : st.heroAt(e.clientX - q.left, e.clientY - q.top, q.width, q.height, r) ? -1 : -2;
              if (over !== overRef.current) { overRef.current = over; if (over === -2) peek.hide(); else showCreature(over); }
            }}
            onPointerLeave={(e) => { hoverRef.current = -1; setHover(-1); if (e.pointerType === 'mouse') { overRef.current = -2; peek.hide(); } }}
            style={{ cursor: hover >= 0 ? 'pointer' : 'default' }}
          />
          {toast}
        </div>
        <p className="ss-info" data-testid="info">{info}</p>
        <div className="ss-bar">
          <span className="ss-energy" data-testid="energy" data-energy={f.energy} {...tipOn(noteTip('⚡', 'Energy', `Cards cost energy to play. You start every turn with ${ENERGY}, and none is kept from the turn before.`))}>{f.energy}<small>energy</small></span>
          <button data-testid="pile-draw" onClick={() => setSheet({ title: `Draw pile · ${f.draw.length}`, note: 'In no particular order.', cards: f.draw.slice().sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name)) })}>Draw {f.draw.length}</button>
          <button data-testid="pile-discard" onClick={() => setSheet({ title: `Discard pile · ${f.discard.length}`, cards: f.discard })}>Discard {f.discard.length}</button>
          {f.gone.length > 0 && <button onClick={() => setSheet({ title: `Exhausted · ${f.gone.length}`, note: 'Gone until the fight is over.', cards: f.gone })}>Gone {f.gone.length}</button>}
          <span className="ss-spacer" />
          <button className={`ss-go${can && !playable ? ' ss-pulse' : ''}`} data-testid="end-turn" disabled={!can} onClick={endTurn}>End turn <kbd>E</kbd></button>
        </div>
        <div className="ss-hand" data-testid="hand" data-count={f.hand.length} style={{ '--lap': `${[6, 6, 6, 6, 6, 6, -6, -16, -28, -38, -48][Math.min(10, f.hand.length)]}px` } as React.CSSProperties}>
          {f.hand.map((c, i) => {
            const off = i - (f.hand.length - 1) / 2, wide = f.hand.length > 6;
            /** For the big copy: the numbers against the foe the card would go at, and that foe's name. */
            const live = () => { const now = run.current, at = now?.fight?.hand.indexOf(c) ?? -1; if (!now?.fight || at < 0) return null; const t = CARDS[c.id].target && now.phase === 'fight' ? aimFor(now) : -1; return { text: now.textOf(c, t), aimed: t >= 0 ? now.fight.foes[t].name : undefined }; };
            return <CardView key={c.uid} card={c} index={i} testid={`hand-${i}`} text={r.textOf(c, sel === i ? aim : -1)} on={sel === i} dim={!can || !!r.cannot(i, CARDS[c.id].target ? aimFor(r) : -1)} onClick={() => tapCard(i)} live={live} place="above" style={{ '--rot': `${off * (wide ? 2 : 2.8)}deg`, '--dy': `${off * off * (wide ? 1.3 : 2.2)}px`, '--i': i } as React.CSSProperties} />;
          })}
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
          <TrailArt act={r.act} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {nodes.flatMap((n) => n.next.map((m) => {
              const to = nodes[m], done = r.walked.includes(n.id) && r.walked.includes(m), next = n.id === r.at && paths.includes(m), mid = (py(n) + py(to)) / 2, d = `M${px(n)} ${py(n)} C${px(n)} ${mid} ${px(to)} ${mid} ${px(to)} ${py(to)}`;
              return <g key={`${n.id}-${m}`} className={done ? 'done' : next ? 'next' : ''}><path className="bed" d={d} /><path d={d} /></g>;
            }))}
          </svg>
          {nodes.map((n) => {
            const open = paths.includes(n.id), here = n.id === r.at, been = r.walked.includes(n.id), name = n.type === 'boss' ? `Guardian: ${FOES[ACTS[r.act].boss[0]].name}` : NODE_NAMES[n.type];
            const make = (): Tip => ({ kind: 'note', title: name, body: n.type === 'boss' ? `${FOES[ACTS[r.act].boss[0]].blurb} Beat it to finish this stretch.` : STOP_TEXT[n.type], foot: here ? 'You are here.' : open ? 'One of your next stops.' : been ? 'You have been here.' : 'Not in reach from where you are.' });
            return (
              <span key={n.id} className={`ss-stop${n.type === 'boss' ? ' big' : ''}`} style={{ left: `${px(n)}%`, top: `${py(n)}%` }} {...tipOn(make)}>
                <button className={`ss-node k-${n.type}${open ? ' open' : ''}${here ? ' here' : ''}${been ? ' been' : ''}`} disabled={!open} data-testid={`node-${n.id}`} data-type={n.type} data-open={open ? '1' : '0'} aria-label={`${name}${here ? ', you are here' : open ? ', open' : ''}`} onClick={() => go(n.id)}>
                  <StopIcon type={n.type} />
                </button>
                {here && <i className="ss-marker" aria-hidden="true"><Portrait hero={r.hero} size={38} /></i>}
              </span>
            );
          })}
          {toast}
        </div>
        <ul className="ss-legend">{(['fight', 'alpha', 'event', 'rest', 'stall', 'stash', 'boss'] as NodeType[]).map((t) => <li key={t}><StopIcon type={t} /> {t === 'fight' ? 'Predators: a card' : t === 'alpha' ? 'Alpha: a trinket' : t === 'event' ? 'Something on the trail' : t === 'rest' ? 'Rest burrow' : t === 'stall' ? 'Treat stall' : t === 'stash' ? 'Hidden stash' : `Guardian: ${FOES[ACTS[r.act].boss[0]].name}`}</li>)}</ul>
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

  return (
    <main className={`ss-shell ss-run p-${phase}`}>
      {header}
      {topbar}
      {body}
      {sheetView}
      {ghosts.map((g) => <div key={g.key} className={`ss-ghost${g.from.w < 100 ? ' mini' : ''}`} aria-hidden="true" style={{ left: g.from.x, top: g.from.y, '--cw': `${g.from.w}px`, '--gh': `${g.from.h}px`, '--dx': `${g.dx}px`, '--dy': `${g.dy}px` } as React.CSSProperties}><CardView card={g.card} plain /></div>)}
      <Peek shown={shown} />
    </main>
  );
}
function plural(n: number, one: string) { return `${n} ${one}${n === 1 ? '' : one === one.toUpperCase() ? 'S' : 's'}`; }
