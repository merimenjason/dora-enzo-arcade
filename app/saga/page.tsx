/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Game, HEROES, heroById, skillText, stageDef, goldFor, ENEMIES, CHAPTERS, BOSSES, STAGES, PER_CHAPTER, FACTION_NAMES, ROLE_NAMES, RARITY_NAMES, GEAR, GEAR_NAMES, GEAR_TEXT, GEAR_STEP,
  MAX_TIER, MERGE, MAX_STARS, FIRST_CLEAR, ODDS, PITY, CHEST_STARS, CHEST_SCROLLS, CAMP_HOURS, ENERGY, PAR, SLOTS, ROLES, TOWER_EVERY, TOWER_SCROLLS,
  type EnemyKind, type Summoned,
} from '../../lib/saga-game';
import { Field, portrait } from '../../lib/saga-scene';
import { loadSagaArt, sagaPaintVersion, sagaPaintReady, sagaPaintStats, sagaDecoration, sagaDecorationStats, RARITY_COLOR, FACTION_COLOR } from '../../lib/saga-art';
import './saga.css';
import { sound } from './sound';

const SAVE_KEY = 'saga-v1';
const read = (): Game | null => { try { const s = localStorage.getItem(SAVE_KEY); return s ? Game.load(JSON.parse(s)) : null; } catch { return null; } };
const write = (g: Game) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(g.save())); } catch { /* private mode: the saga just isn't kept */ } };
const fresh = () => new Game((Math.random() * 0xffffffff) >>> 0, Date.now());

type Tab = 'adventure' | 'squad' | 'summon' | 'forge';
const TABS: [Tab, string][] = [['adventure', 'Adventure'], ['squad', 'Squad'], ['summon', 'Summon'], ['forge', 'Forge']];
const SLOT_NAMES = ['Front 1', 'Front 2', 'Back 1', 'Back 2', 'Back 3'];
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const stars = (n: number, of = 3) => '★'.repeat(n) + '☆'.repeat(of - n);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** Who is waiting in a stage, most dangerous first: "Thornback, 2 Scuttlers, Spitter". */
const lineUp = (n: number) => {
  const def = stageDef(n), count = new Map<EnemyKind, number>();
  for (const k of def.waves.flat()) count.set(k, (count.get(k) ?? 0) + 1);
  const order: EnemyKind[] = ['boss', 'captain', 'brute', 'hexer', 'sneak', 'slinger', 'grunt'];
  return order.filter((k) => count.has(k)).map((k) => { const c = count.get(k)!, name = k === 'boss' && !def.tower ? BOSSES[def.chapter] : ENEMIES[k].name; return c > 1 ? `${c} ${name}s` : name; }).join(', ');
};

function Face({ id, size = 56, known = true, card = false }: { id: string; size?: number; known?: boolean; card?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null), art = sagaPaintVersion();
  useEffect(() => { const c = ref.current?.getContext('2d'); if (!c) return; c.setTransform(2, 0, 0, 2, 0, 0); portrait(c, id, size, known, card); }, [id, size, known, art, card]);
  return <canvas ref={ref} className="sg-face" width={size * 2} height={size * 2} style={{ width: size, height: size }} aria-hidden="true" />;
}
function RewardArt({kind,size=58}:{kind:'chest'|'open-chest'|'coins'|'scroll';size?:number}){
 const ref=useRef<HTMLCanvasElement>(null),art=sagaPaintVersion();
 useEffect(()=>{const c=ref.current?.getContext('2d');if(!c)return;c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,size,size);sagaDecoration(c,'rewards',kind==='chest'?0:kind==='open-chest'?1:kind==='coins'?2:3,size/2,size/2,size);},[kind,size,art]);
 return <canvas className="sg-reward-art" ref={ref} width={size*2} height={size*2} style={{width:size,height:size}} aria-hidden="true"/>;
}
const Coin = () => <i className="sg-coin" aria-hidden="true" />;
const Scroll = () => <i className="sg-scroll" aria-hidden="true" />;

export default function SagaPage() {
  const canvas = useRef<HTMLCanvasElement>(null), game = useRef<Game | null>(null), field = useRef(new Field());
  const paused = useRef(false), casts = useRef<number[]>([]), speed = useRef(1), auto = useRef(false);
  const [loaded, setLoaded] = useState(false), [kept, setKept] = useState<Game | null>(null), [view, setView] = useState<'title' | 'hub' | 'battle'>('title');
  const [, setFrame] = useState(0), [tab, setTab] = useState<Tab>('adventure'), [chapter, setChapter] = useState(0), [stage, setStage] = useState(0), [picked, setPicked] = useState('dora');
  const [pulled, setPulled] = useState<Summoned[]>([]), [note, setNote] = useState(''), [isPaused, setIsPaused] = useState(false), [muted, setMuted] = useState(false), [sure, setSure] = useState(false);
  const [skillFeedback,setSkillFeedback]=useState<{text:string;at:number}|null>(null);
  const [campOpened,setCampOpened]=useState(false);
  useEffect(()=>{if(!skillFeedback)return;const timer=setTimeout(()=>setSkillFeedback(null),1800);return()=>clearTimeout(timer);},[skillFeedback]);
  useEffect(()=>{if(!campOpened)return;const timer=setTimeout(()=>setCampOpened(false),2400);return()=>clearTimeout(timer);},[campOpened]);
  const [artError,setArtError] = useState(false);
  const retryArt = () => { setArtError(false); void loadSagaArt().then(redraw).catch(()=>setArtError(true)); };
  const [fast, setFast] = useState(false), [isAuto, setIsAuto] = useState(false);
  const redraw = useCallback(() => setFrame((n) => n + 1), []);

  useEffect(() => { void loadSagaArt().catch(() => setArtError(true)).then(() => { setKept(read()); setMuted(sound.muted()); setLoaded(true); }); }, []);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), sync = () => { field.current.motion = !media.matches; }; sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);

  useEffect(() => { (window as unknown as { __saga?: () => unknown }).__saga = () => ({ game: game.current, field: field.current, paused: paused.current, speed: speed.current, auto: auto.current, refresh: redraw, art: {ready:sagaPaintReady(), inspect:sagaPaintStats, decorations:sagaDecorationStats} }); }, [redraw]);
  const store = useCallback(() => { if (game.current) write(game.current); }, []);
  const pause = useCallback((on: boolean) => { paused.current = on; setIsPaused(on); }, []);
  const mute = () => { const m = !sound.muted(); sound.setMuted(m); setMuted(m); };
  const begin = (g: Game) => {
    game.current = g; write(g);
    const next = Math.min(g.cleared, STAGES - 1);
    setChapter(Math.floor(next / PER_CHAPTER)); setStage(next); setPicked(g.squad.find(Boolean) ?? 'dora'); setTab('adventure'); setPulled([]); setNote(''); setView('hub'); sound.cue('wave');
  };
  const toTitle = () => { store(); setKept(read()); setSure(false); setView('title'); };
  /** Do something to the saga from the menus: save it, redraw, and say whether it worked. */
  const act = (did: unknown, cue: Parameters<typeof sound.cue>[0] = 'click') => { if (did) { store(); sound.cue(cue); } else sound.cue('nope'); redraw(); return !!did; };

  const fight = (n: number) => {
    const g = game.current!;
    if (!g.start(n)) { sound.cue('nope'); return; }
    setSkillFeedback(null); field.current.reset(); casts.current = []; auto.current = false; setIsAuto(false); pause(false); store(); setView('battle');
  };
  const leaveBattle = () => {
    const g = game.current!, n = g.stage;
    g.leave(); store(); pause(false);
    const next = Math.min(g.cleared, STAGES - 1), show = n >= STAGES ? next : Math.min(n, STAGES - 1);
    setChapter(Math.floor(show / PER_CHAPTER)); setStage(show); setView('hub');
  };
  const cast = useCallback((slot: number) => {
    const b=game.current?.battle;if(!b || paused.current || b.phase==='won' || b.phase==='lost')return;
    const hero=b.heroes.find(u=>u.slot===slot);if(!hero)return;
    if(b.ready(slot)){setSkillFeedback(null);casts.current.push(slot);}
    else{sound.cue('nope');const text=hero.dead?`${hero.name} has fallen.`:hero.stun>0?`${hero.name} is stunned. Wait for the stars to clear.`:b.phase==='march'?'Skills can be used when the next wave arrives.':`${hero.name} needs ${Math.max(0,Math.ceil(ENERGY-hero.energy))} more energy. Attacks charge the skill.`;setSkillFeedback({text,at:performance.now()});}
  }, []);
  const toggleAuto = useCallback(() => { const g = game.current; if (!g?.battle || !g.canAuto(g.stage)) return; auto.current = !auto.current; setIsAuto(auto.current); }, []);
  const toggleFast = useCallback(() => { speed.current = speed.current === 1 ? 2 : 1; setFast(speed.current === 2); }, []);

  // The loop: step the battle, bank a win on the frame it happens, draw.
  useEffect(() => {
    if (view !== 'battle') return;
    let raf = 0, last = performance.now(), shown = '';
    const loop = (now: number) => {
      const g = game.current, cv = canvas.current, b = g?.battle, dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (g && cv && b) {
        const blocked = paused.current || b.phase === 'won' || b.phase === 'lost';
        if (!blocked) {
          const events = g.update(dt * speed.current, { cast: casts.current.splice(0), auto: auto.current });
          if (events.length) {
            field.current.take(events, b);
            for (const e of events) {
              if (e.type === 'hit') sound.cue(b.heroes.some((u) => u.uid === e.to) ? 'hurt' : 'hit', 0, e.skill ? 1.4 : 1, 0.07);
              else if (e.type === 'die') sound.cue(e.hero ? 'fall' : 'die');
              else if (e.type !== 'wave' || e.wave > 0) sound.cue(e.type as Parameters<typeof sound.cue>[0]);
            }
            if (events.some((e) => e.type === 'won' || e.type === 'lost')) write(g);
          }
        }
        const box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(box.width), h = Math.round(box.height);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const c = cv.getContext('2d');
        if (c && w > 0 && h > 0) field.current.draw(c, w, h, dpr, b, paused.current ? 0 : dt * (b.phase === 'fight' || b.phase === 'march' ? speed.current : 1));
        // The HUD only re-renders when something it shows has changed.
        const key = `${b.phase}|${b.wave}|${Math.floor(b.time)}|${b.foes.filter(u=>u.boss).map(u=>`${Math.round(u.hp/u.max*100)}:${Math.round(u.wind*10)}`).join(',')}|${b.winding?.uid ?? ''}|${b.heroes.map((u) => `${u.dead ? 'x' : Math.floor(u.energy / 5)}:${Math.round(u.hp/u.max*100)}:${u.shield>0?'s':''}:${u.stun>0?'t':''}${b.ready(u.slot) ? 'r' : ''}`).join(',')}`;
        if (key !== shown) { shown = key; redraw(); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const away = () => { const b = game.current?.battle; if (b && (b.phase === 'fight' || b.phase === 'march')) pause(true); store(); };
    const hide = () => { if (document.hidden) away(); };
    window.addEventListener('blur', away); window.addEventListener('pagehide', store); document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', away); window.removeEventListener('pagehide', store); document.removeEventListener('visibilitychange', hide); };
  }, [view, pause, redraw, store]);

  // Keys.
  useEffect(() => {
    if (view === 'title') return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyM') { mute(); return; }
      if (view !== 'battle') return;
      const digit = /^(Digit|Numpad)([1-5])$/.exec(e.code);
      if (digit) { e.preventDefault(); cast(+digit[2] - 1); }
      else if (e.code === 'KeyP' || e.code === 'Escape') { const b = game.current?.battle; if (b && (b.phase === 'fight' || b.phase === 'march')) pause(!paused.current); }
      else if (e.code === 'KeyA') toggleAuto();
      else if (e.code === 'KeyF') toggleFast();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [view, cast, pause, toggleAuto, toggleFast]);

  const artworkStatus = artError ? <aside className="sg-art-status">Some artwork could not load. Your saga is still playable. <button onClick={retryArt}>Retry artwork</button></aside> : null;
  if (!loaded) return <main className="sg-shell"><p className="sg-loading">Gathering the squad…</p></main>;

  if (view === 'title') {
    return (
      <main className="sg-shell sg-title" data-art-ready={sagaPaintReady()}>
        {artworkStatus}
        <a className="sg-back" href="/">← MAIN ARCADE</a>
        <section className="sg-title-card">
          <p className="sg-eyebrow">A hero-squad adventure</p>
          <h1>Whisker Saga</h1>
          <p className="sg-lede">Lead five heroes down the road from Clover Meadow to Hollow Keep. They fight on their own; you choose who stands where and when each skill is fired. Eighteen heroes to find, eighty stages to clear.</p>
          <div className="sg-title-row" aria-hidden="true">{['enzo', 'dora', 'pip', 'onyx', 'zephyr', 'aurora'].map((id) => <Face key={id} id={id} size={64} />)}</div>
          {kept && <button className="sg-gold" data-testid="continue" onClick={() => begin(kept)}>Carry on · {kept.complete ? `tower floor ${kept.tower + 1}` : stageDef(kept.cleared).name}, {kept.owned.length}/{HEROES.length} heroes</button>}
          {!kept && <button className="sg-gold" data-testid="start" onClick={() => begin(fresh())}>Set out</button>}
          {kept && !sure && <button data-testid="new" onClick={() => setSure(true)}>Start a new saga</button>}
          {kept && sure && <div className="sg-sure"><p>This replaces your saga of {kept.owned.length} heroes and {kept.cleared} stages. It cannot be undone.</p><button data-testid="new-sure" onClick={() => begin(fresh())}>Yes, start again</button><button onClick={() => setSure(false)}>Keep my saga</button></div>}
          <p className="sg-keys">In battle, tap a hero or their button to fire a skill, or press <kbd>1</kbd> to <kbd>5</kbd>. <kbd>P</kbd> pause, <kbd>F</kbd> double speed, <kbd>A</kbd> auto on stages you have beaten, <kbd>M</kbd> sound.</p>
        </section>
      </main>
    );
  }

  const g = game.current!;

  if (view === 'battle' && g.battle) {
    const b = g.battle, def = b.def, boss = b.foes.find(u=>u.boss), over = b.phase === 'won' || b.phase === 'lost', loot = g.loot, winding = b.winding;
    const canStop = b.heroes.some((u) => b.ready(u.slot) && ['strike', 'snipe', 'freeze'].includes(u.skill!.kind));
    const hint = isPaused ? 'Paused.' : winding ? (winding.special!.kind === 'slam' ? `${winding.name} is winding up a slam. ${canStop ? 'Stun it now!' : 'Shield the squad if you can.'}` : `${winding.name} is about to heal. ${canStop ? 'Stun it to stop the spell.' : ''}`)
      : b.phase === 'march' ? 'The squad marches on.' : isAuto ? 'Auto: skills fire as soon as they charge.' : b.heroes.some((u) => b.ready(u.slot)) ? 'A skill is ready. Stuns are best saved for a wind-up.' : 'Skills charge as your heroes land hits.';
    const next = def.tower ? STAGES + g.tower : g.stage + 1, canNext = b.phase === 'won' && (def.tower ? true : next < STAGES && g.unlocked(next));
    const again = () => { const n = g.stage; g.leave(); fight(n); };
    const onward = () => { g.leave(); fight(next); };
    const tap = (e: React.PointerEvent<HTMLCanvasElement>) => { const box = e.currentTarget.getBoundingClientRect(), slot = field.current.slotAt(e.clientX - box.left, e.clientY - box.top); if (slot >= 0 && g.squad[slot]) cast(slot); };
    return (
      <main data-art-ready={sagaPaintReady()} className="sg-shell sg-battle" data-phase={b.phase} data-wave={b.wave} data-paused={isPaused} data-winding={!!winding}>
        <header className="sg-header">
          <div className="sg-battle-heading"><strong>Whisker Saga</strong><button className="sg-quiet" data-testid="retreat" onClick={leaveBattle}>{over ? '← Map' : '← Retreat'}</button></div>
          <div className="sg-where" data-testid="where"><strong>{def.name}</strong><span>Wave {Math.min(b.wave + 1, def.waves.length)}/{def.waves.length}</span><span className={b.time > PAR ? 'sg-late' : ''}>{clock(b.time)}</span></div>
          <div className="sg-top-buttons">
            {g.canAuto(g.stage) && <button data-testid="auto" aria-pressed={isAuto} onClick={toggleAuto}>Auto</button>}
            <button data-testid="speed" aria-pressed={fast} onClick={toggleFast}>×2</button>
            <button data-testid="pause" aria-pressed={isPaused} disabled={over} onClick={() => pause(!isPaused)}>{isPaused ? 'Resume' : 'Pause'}</button>
            <button data-testid="mute" aria-pressed={muted} onClick={mute}>{muted ? 'Sound off' : 'Sound on'}</button>
          </div>
        </header>
        {artworkStatus}
        <section className="sg-stage" aria-label="The battlefield">
          <canvas ref={canvas} data-testid="field" aria-label={`${def.name}. Your squad fights on its own. Press 1 to 5 to fire a hero's skill.`} onPointerDown={tap} onContextMenu={(e) => e.preventDefault()} />
          {boss && <section className="sg-boss-hud" aria-label={boss.name}><strong>{boss.name}</strong><progress max={boss.max} value={boss.hp} aria-label={`${boss.name} health`}/>{boss.wind>0 && boss.special && <><span>{boss.special.kind==='slam'?'Slam':'Healing'}</span><progress className="sg-wind-meter" max={boss.special.wind} value={boss.special.wind-boss.wind} aria-label="Boss wind-up"/></>}</section>}
          <output className="sg-hint" data-testid="hint" data-alarm={!!winding && !isPaused}>{hint}</output>
          {skillFeedback && !over && <output className="sg-skill-feedback" data-testid="skill-feedback">{skillFeedback.text}</output>}
          {isPaused && !over && <dialog open className="sg-card" data-testid="paused"><h2>Paused</h2><button className="sg-gold" data-testid="resume" onClick={() => pause(false)}>Resume</button><button onClick={leaveBattle}>Retreat to the map</button></dialog>}
          {b.phase === 'won' && loot && (
            <dialog open className="sg-card sg-result" data-testid="won">
              <p className="sg-eyebrow">{def.name}</p>
              <h2>Victory</h2><RewardArt kind="coins" size={72}/>
              <p className="sg-stars" data-testid="stars" aria-label={`${loot.stars} of 3 stars`}>{stars(loot.stars)}</p>
              <ul className="sg-star-list">
                <li data-got="true">Stage cleared</li><li data-got={b.fallen === 0}>Nobody fell</li><li data-got={b.time <= PAR}>Under {clock(PAR)} ({clock(b.time)})</li>
              </ul>
              <ul className="sg-loot" data-testid="loot">
                <li><Coin />{fmt(loot.gold)} gold{loot.first && !def.tower ? ' (first clear)' : ''}</li>
                {loot.scrolls > 0 && <li><Scroll />{loot.scrolls} summoning scroll{loot.scrolls > 1 ? 's' : ''}</li>}
                {loot.gear && <li><i className="sg-gear" data-tier={loot.gear.tier} aria-hidden="true">{loot.gear.tier}</i>{GEAR_NAMES[loot.gear.slot]}, tier {loot.gear.tier}</li>}
              </ul>
              {loot.joined && <p className="sg-joined" data-testid="joined"><Face id={loot.joined} size={52} /><span><strong>{heroById(loot.joined).name}</strong> joins the squad: {RARITY_NAMES[heroById(loot.joined).rarity].toLowerCase()} {FACTION_NAMES[heroById(loot.joined).faction]} {ROLE_NAMES[heroById(loot.joined).role].toLowerCase()}.</span></p>}
              {g.complete && g.stage === STAGES - 1 && loot.first && <p className="sg-joined">The Hollow King has fallen and the road is safe. The tower is now open on the map: one floor at a time, each harder than the last.</p>}
              <div className="sg-row">
                {canNext && <button className="sg-gold" data-testid="next" onClick={onward}>{def.tower ? `Floor ${g.tower + 1}` : 'Next stage'}</button>}
                {!def.tower && <button data-testid="again" onClick={again}>Fight again</button>}
                <button className={canNext ? '' : 'sg-gold'} data-testid="to-map" onClick={leaveBattle}>Back to the map</button>
              </div>
            </dialog>
          )}
          {b.phase === 'lost' && (
            <dialog open className="sg-card sg-result" data-testid="lost">
              <p className="sg-eyebrow">{def.name}</p>
              <h2>{b.time >= 150 ? 'Out of time' : 'The squad fell back'}</h2>
              <p>{b.time >= 150 ? 'The fight ran past two and a half minutes. More attack, or a hero who can reach the enemy back line, will end it sooner.' : 'Nothing is lost. Spend gold on levels, wear better gear, put a guard in front, or save a stun for the moment an enemy winds up.'}</p>
              <div className="sg-row">
                <button className="sg-gold" data-testid="retry" onClick={again}>Try again</button>
                <button data-testid="to-squad" onClick={() => { leaveBattle(); setTab('squad'); }}>Strengthen the squad</button>
                <button data-testid="to-map" onClick={leaveBattle}>Back to the map</button>
              </div>
            </dialog>
          )}
        </section>
        <div className="sg-skills">
          {Array.from({ length: SLOTS }, (_, slot) => {
            const u = b.heroes.find((x) => x.slot === slot);
            if (!u) return <span key={slot} className="sg-skill sg-empty"><strong>Empty slot</strong><small>Recruit in Summon</small></span>;
            const ready = b.ready(slot), hero = heroById(u.key), counter=!!winding && ready && ['strike','snipe','freeze'].includes(hero.skill.kind), health=Math.max(0,Math.round(u.hp/u.max*100));
            return (
              <button key={slot} className="sg-skill" data-testid={`skill-${slot}`} data-ready={ready} data-dead={u.dead} data-counter={counter} data-low={health<=25} disabled={u.dead || over} onClick={() => cast(slot)}
                aria-label={`${hero.name}: ${hero.skill.name}. ${u.dead ? 'Fallen.' : ready ? 'Ready.' : `${Math.floor(u.energy)}% charged.`} ${skillText(hero.skill)}`} title={skillText(hero.skill)}>
                <span className="sg-skill-portrait"><Face id={u.key} size={240} card /><span className="sg-health"><meter min={0} max={u.max} value={Math.max(0,u.hp)} low={u.max*.25} high={u.max*.5} optimum={u.max} aria-label={`${hero.name} health`}/><small>HP {health}%{u.shield>0 ? ' · Shielded' : ''}</small></span></span>
                <span className="sg-skill-text"><b>{hero.skill.name}</b><small>{hero.name}<span className="sg-key"> · <kbd>{slot + 1}</kbd></span></small></span>
                <i className="sg-meter" aria-hidden="true"><i style={{ width: `${u.dead ? 0 : (u.energy / ENERGY) * 100}%` }} /></i>
                <span className="sg-charge-label">{u.dead ? 'Fallen' : u.stun>0 ? 'Stunned' : counter ? 'Interrupt' : ready ? 'Ready' : `${Math.floor(u.energy)}%`}</span>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  const now = Date.now(), waiting = g.camp(now), sel = g.heroes[picked] ? heroById(picked) : heroById('dora'), own = g.heroes[sel.id], spec = g.spec(sel.id);
  const count = { meadow: 0, burrow: 0, summit: 0 };
  for (const id of g.squad) if (id) count[heroById(id).faction]++;
  const bonus = g.factionBonus, def = stageDef(stage), open = g.unlocked(stage);
  const pull = (times: number) => {
    const out: Summoned[] = [];
    for (let i = 0; i < times; i++) { const s = g.summon(); if (!s) break; out.push(s); }
    if (!act(out.length, 'summon')) return;
    const best = Math.max(...out.map((s) => heroById(s.id).rarity));
    if (best === 3) sound.cue('legend'); else if (best === 2) sound.cue('epic');
    setPulled(out);
    const first = out.find((s) => s.fresh); if (first) setPicked(first.id);
  };
  const hintFor = (id: string) => { const x = heroById(id); return x.from === 'story' ? `Joins when ${CHAPTERS[x.chapter!]} is cleared` : `${RARITY_NAMES[x.rarity]} summons`; };

  const slotButton = (slot: number) => {
    const id = g.squad[slot];
    return (
      <button key={slot} className="sg-slot" data-testid={`slot-${slot}`} data-filled={!!id} aria-pressed={!!id && id === sel.id} aria-label={`${SLOT_NAMES[slot]}: ${id ? heroById(id).name : 'empty'}`}
        onClick={() => { if (id) { sound.cue('click'); setPicked(id); } else act(g.place(sel.id, slot), 'equip'); }}>
        {id ? <><Face id={id} size={56} /><b>{heroById(id).name}</b><small>Lv {g.heroes[id].level}</small></> : <><i className="sg-plus" aria-hidden="true">+</i><small>{SLOT_NAMES[slot]}</small></>}
      </button>
    );
  };

  return (
    <main className="sg-shell sg-hub" data-tab={tab} data-art-ready={sagaPaintReady()}>
      {artworkStatus}
      <header className="sg-header">
        <a className="sg-back" href="/" onClick={store}>← ARCADE</a>
        <h1 className="sg-brand">Whisker Saga</h1>
        <div className="sg-purse">
          <span data-testid="gold" aria-label={`${fmt(g.gold)} gold`}><Coin />{fmt(g.gold)}</span>
          <span data-testid="scrolls" aria-label={`${g.scrolls} summoning scrolls`}><Scroll />{g.scrolls}</span>
        </div>
        <div className="sg-top-buttons">
          <button data-testid="mute" aria-pressed={muted} onClick={mute}>{muted ? 'Sound off' : 'Sound on'}</button>
          <button data-testid="menu" onClick={toTitle}>Save &amp; menu</button>
        </div>
      </header>
      <nav className="sg-tabs" aria-label="Saga">
        {TABS.map(([id, label]) => <button key={id} data-testid={`tab-${id}`} aria-pressed={tab === id} onClick={() => { sound.cue('click'); setTab(id); setNote(''); }}>{label}{id === 'summon' && g.scrolls > 0 ? <em>{g.scrolls}</em> : null}</button>)}
      </nav>

      {tab === 'adventure' && (
        <div className="sg-panel sg-adventure" data-testid="adventure-panel">
          {g.owned.length < SLOTS && g.scrolls > 0 && <p className="sg-tip" data-testid="tip">You have {g.scrolls} summoning scroll{g.scrolls > 1 ? 's' : ''} and room in the squad. <button onClick={() => setTab('summon')}>Summon heroes</button></p>}
          {g.cleared > 0 && (
            <p className="sg-camp" data-testid="camp" data-opened={campOpened}>
              <RewardArt kind={campOpened?'open-chest':'chest'}/>
              <span><strong>Camp chest</strong> fills for up to {CAMP_HOURS} hours while you are away.</span>
              <button className={waiting ? 'sg-gold' : ''} data-testid="camp-claim" disabled={!waiting} onClick={() => { const got = g.claimCamp(Date.now()); if (act(got, 'coin')) {setCampOpened(true);setNote(`Collected ${fmt(got)} gold from the camp chest.`);} }}><Coin />{waiting ? `Collect ${fmt(waiting)}` : 'Empty'}</button>
            </p>
          )}
          <section className="sg-chapter" aria-label="Chapter">
            <div className="sg-chapter-art" style={{backgroundImage:`url(/art/saga/land-${chapter}.png)`}} aria-hidden="true"><span>{CHAPTERS[chapter]}</span></div>
            <div className="sg-chapter-head">
              <button data-testid="chapter-prev" aria-label="Previous chapter" disabled={chapter === 0} onClick={() => { setChapter(chapter - 1); setStage((chapter - 1) * PER_CHAPTER); }}>◀</button>
              <h2 data-testid="chapter-name">Chapter {chapter + 1} · {CHAPTERS[chapter]}</h2>
              <button data-testid="chapter-next" aria-label="Next chapter" disabled={chapter === CHAPTERS.length - 1 || g.cleared < (chapter + 1) * PER_CHAPTER} onClick={() => { setChapter(chapter + 1); setStage((chapter + 1) * PER_CHAPTER); }}>▶</button>
            </div>
            <p className="sg-chest-line">
              <span data-testid="chapter-stars">{g.chapterStars(chapter)}/{PER_CHAPTER * 3} stars</span>
              {g.chests[chapter] < CHEST_STARS.length
                ? <button className={g.chestReady(chapter) ? 'sg-gold' : ''} data-testid="chest" disabled={!g.chestReady(chapter)} onClick={() => { const got = g.claimChest(chapter); if (act(got, 'coin')) setNote(`The chapter chest held ${got} summoning scroll${got > 1 ? 's' : ''}.`); }}>
                  <Scroll />{g.chestReady(chapter) ? `Open chest: ${CHEST_SCROLLS[g.chests[chapter]]} scroll${CHEST_SCROLLS[g.chests[chapter]] > 1 ? 's' : ''}` : `Chest at ${CHEST_STARS[g.chests[chapter]]} stars`}</button>
                : <span>All three chests opened</span>}
            </p>
            <ol className="sg-stages">
              {Array.from({ length: PER_CHAPTER }, (_, i) => {
                const n = chapter * PER_CHAPTER + i, ok = g.unlocked(n);
                return <li key={n}><button data-testid={`stage-${n}`} data-boss={i === PER_CHAPTER - 1} data-next={n === g.cleared} aria-pressed={stage === n} disabled={!ok} aria-label={`Stage ${i + 1}${i === PER_CHAPTER - 1 ? ', boss' : ''}${ok ? `, ${g.stars[n]} of 3 stars` : ', locked'}`} onClick={() => { sound.cue('click'); setStage(n); }}>
                  <b>{i === PER_CHAPTER - 1 ? '♛' : i + 1}</b><small>{ok ? stars(g.stars[n]) : 'locked'}</small></button></li>;
              })}
            </ol>
          </section>
          <section className="sg-brief" data-testid="brief" aria-label="Stage">
            <h3>{def.name}{def.boss ? ` · ${BOSSES[def.chapter]}` : ''}</h3>
            <p><b>Waiting:</b> {lineUp(stage)}.</p>
            <p><b>Reward:</b> <Coin />{fmt(goldFor(stage) * (g.stars[stage] ? 1 : FIRST_CLEAR))} gold{g.stars[stage] ? '' : `, a piece of gear${def.number % 2 ? ', a summoning scroll' : ''}${def.boss && HEROES.some((x) => x.chapter === def.chapter) ? `, and ${HEROES.find((x) => x.chapter === def.chapter)!.name} joins you` : ''}`}.</p>
            <p className="sg-dim">Squad power {fmt(g.squadPower)}.{g.stars[stage] ? ' Auto is allowed here.' : ''}</p>
            <button className="sg-gold sg-big" data-testid="fight" disabled={!open} onClick={() => fight(stage)}>{open ? (g.stars[stage] ? 'Fight again' : 'Fight') : 'Clear the stage before this first'}</button>
          </section>
          {g.complete && (
            <section className="sg-brief sg-tower" data-testid="tower" aria-label="The tower">
              <h3>The tower · floor {g.tower + 1}</h3>
              <p><b>Waiting:</b> {lineUp(STAGES + g.tower)}.</p>
              <p className="sg-dim">Every floor raises the level cap by one. Every {TOWER_EVERY}th floor is a boss and pays {TOWER_SCROLLS} scrolls. Best floor: {g.tower}.</p>
              <button className="sg-gold sg-big" data-testid="climb" onClick={() => fight(STAGES + g.tower)}>Climb</button>
            </section>
          )}
        </div>
      )}

      {tab === 'squad' && (
        <div className="sg-panel sg-squad" data-testid="squad-panel">
          <section className="sg-formation" aria-label="Formation">
            <div className="sg-rows">
              <fieldset><legend>Back row</legend>{[2, 3, 4].map(slotButton)}</fieldset>
              <fieldset><legend>Front row</legend>{[0, 1].map(slotButton)}</fieldset>
            </div>
            <p className="sg-bonus" data-testid="bonus" data-on={bonus > 0}>
              {(Object.keys(count) as (keyof typeof count)[]).map((f) => <span key={f} style={{ color: FACTION_COLOR[f] }}>{FACTION_NAMES[f]} {count[f]}</span>)}
              <b>{bonus ? `+${Math.round(bonus * 100)}% attack and health` : 'Three of one faction: +10%'}</b>
            </p>
            <p className="sg-dim sg-small">Enemies hit the front row first. Put the heroes who can take it there.
            </p>
            <div className="sg-row">
              <span className="sg-dim" data-testid="power">Squad power {fmt(g.squadPower)}</span>
              <button data-testid="auto-squad" onClick={() => { g.autoSquad(); act(true, 'equip'); }}>Best squad</button>
              <button data-testid="level-squad" onClick={() => { const n = g.levelSquad(); if (act(n, 'level')) setNote(`Bought ${n} level${n > 1 ? 's' : ''} for the squad.`); else setNote(g.squad.some((id) => id && g.heroes[id].level < g.cap) ? 'Not enough gold for another level.' : `The squad is at the level cap of ${g.cap}. Clear a stage to raise it.`); }}>Level up squad</button>
            </div>
          </section>
          <section className="sg-detail" data-testid="detail" aria-label={sel.name}>
            <div className="sg-detail-head">
              <Face id={sel.id} size={84} />
              <div>
                <h2 data-testid="hero-name">{sel.name} <span className="sg-rank" aria-label={`${own.stars} of ${MAX_STARS} stars`}>{stars(own.stars, MAX_STARS)}</span></h2>
                <p><span style={{ color: RARITY_COLOR[sel.rarity] }}>{RARITY_NAMES[sel.rarity]}</span> · <span style={{ color: FACTION_COLOR[sel.faction] }}>{FACTION_NAMES[sel.faction]}</span> · {ROLE_NAMES[sel.role]}{ROLES[sel.role].ranged ? ' (ranged)' : ' (melee)'}</p>
                <p data-testid="hero-stats">Level <b data-testid="hero-level">{own.level}</b>/{g.cap} · Health {fmt(spec.hp)} · Attack {fmt(spec.atk)} · Power {fmt(g.power(sel.id))}</p>
              </div>
            </div>
            <p className="sg-skill-line"><b>{sel.skill.name}.</b> {skillText(sel.skill)}</p>
            <div className="sg-row">
              <button className="sg-gold" data-testid="level-up" disabled={!g.canLevel(sel.id)} onClick={() => act(g.levelUp(sel.id), 'level')}>{own.level >= g.cap ? `Level cap ${g.cap}` : <>Level up · <Coin />{fmt(g.levelCost(sel.id))}</>}</button>
              <button data-testid="star-up" disabled={!g.canStar(sel.id)} onClick={() => act(g.starUp(sel.id), 'star')}>{own.stars >= MAX_STARS ? 'Five stars' : `Raise a star · ${own.shards}/${g.starCost(sel.id)} shards`}</button>
            </div>
            <fieldset className="sg-gear-row"><legend>Gear</legend>
              {GEAR.map((key, slot) => <span key={key} className="sg-gear-slot" data-testid={`gear-${slot}`} title={`+${Math.round(GEAR_STEP[slot] * 100)}% ${GEAR_TEXT[slot]} a tier`}><i className="sg-gear" data-tier={own.gear[slot]} aria-hidden="true">{own.gear[slot] || '–'}</i><small>{GEAR_NAMES[slot]}<br />{own.gear[slot] ? `+${Math.round(GEAR_STEP[slot] * own.gear[slot] * 100)}% ${GEAR_TEXT[slot]}` : 'empty'}</small></span>)}
              <button data-testid="equip-best" onClick={() => { const n = g.equipBest(sel.id); if (!act(n, 'equip')) setNote('Nothing better in the bag. Stages drop gear, and the forge makes three pieces into a better one.'); }}>Wear the best</button>
            </fieldset>
            <fieldset className="sg-place"><legend>Stand in</legend>
              {SLOT_NAMES.map((name, slot) => <button key={slot} data-testid={`place-${slot}`} aria-pressed={g.squad[slot] === sel.id} onClick={() => act(g.place(sel.id, slot), 'equip')}>{name}</button>)}
              <button data-testid="bench" disabled={!g.squad.includes(sel.id) || g.squad.filter(Boolean).length <= 1} onClick={() => act(g.bench(g.squad.indexOf(sel.id)), 'click')}>Rest</button>
            </fieldset>
          </section>
          <section className="sg-roster" aria-label="Heroes">
            <h3>{g.owned.length} of {HEROES.length} heroes</h3>
            <ul>
              {HEROES.map((x) => {
                const o = g.heroes[x.id];
                return <li key={x.id}><button data-testid={`hero-${x.id}`} data-owned={!!o} data-fielded={g.squad.includes(x.id)} aria-pressed={sel.id === x.id} disabled={!o} onClick={() => { sound.cue('click'); setPicked(x.id); }}
                  aria-label={o ? `${x.name}, level ${o.level}, ${o.stars} stars${g.squad.includes(x.id) ? ', in the squad' : ''}` : `Unknown hero. ${hintFor(x.id)}`}>
                  <Face id={x.id} size={52} known={!!o} /><b>{o ? x.name : '???'}</b><small>{o ? `Lv ${o.level} · ${'★'.repeat(o.stars)}` : hintFor(x.id)}</small>{o && g.canStar(x.id) && <em aria-hidden="true">★</em>}</button></li>;
              })}
            </ul>
          </section>
        </div>
      )}

      {tab === 'summon' && (
        <div className="sg-panel sg-summon" data-testid="summon-panel">
          <section className="sg-brief">
            <h2>The summoning stone</h2><RewardArt kind="scroll" size={72}/>
            <p>Each scroll calls one hero. A hero you already have comes back as shards, which raise their stars. Scrolls are won in battle and from chapter chests, never bought.</p>
            <p className="sg-dim">Rare {Math.round(ODDS[1] * 100)}% · Epic {Math.round(ODDS[2] * 100)}% · Legendary {Math.round(ODDS[3] * 100)}%. <span data-testid="pity">A legendary is certain within {PITY - g.pity} summons.</span></p>
            <div className="sg-row">
              <button className="sg-gold sg-big" data-testid="summon-1" disabled={g.scrolls < 1} onClick={() => pull(1)}><Scroll />Summon</button>
              <button className="sg-big" data-testid="summon-10" disabled={g.scrolls < 2} onClick={() => pull(10)}><Scroll />Summon {Math.min(10, Math.max(2, g.scrolls))}</button>
            </div>
          </section>
          {pulled.length > 0 && (
            <ul className="sg-pulled" data-testid="pulled">
              {pulled.map((s, i) => { const x = heroById(s.id); return <li key={i} data-rarity={x.rarity} data-fresh={s.fresh} style={{ animationDelay: `${i * 70}ms`, borderColor: RARITY_COLOR[x.rarity] }}><Face id={s.id} size={64} /><b>{x.name}</b><small>{s.fresh ? 'New hero!' : `+${s.shards} shards`}</small></li>; })}
            </ul>
          )}
        </div>
      )}

      {tab === 'forge' && (
        <div className="sg-panel sg-forge" data-testid="forge-panel">
          <section className="sg-brief">
            <h2>The forge</h2>
            <p>Stages drop gear. {MERGE} spare pieces of one tier forge into one of the next, up to tier {MAX_TIER}. Wear gear from a hero&rsquo;s page in Squad.</p>
          </section>
          <table>
            <thead><tr><th scope="col">Gear</th>{Array.from({ length: MAX_TIER }, (_, i) => <th key={i} scope="col">Tier {i + 1}</th>)}</tr></thead>
            <tbody>
              {GEAR.map((key, slot) => (
                <tr key={key}>
                  <th scope="row">{GEAR_NAMES[slot]}<small>+{Math.round(GEAR_STEP[slot] * 100)}% {GEAR_TEXT[slot]} a tier</small></th>
                  {Array.from({ length: MAX_TIER }, (_, i) => {
                    const tier = i + 1, have = g.bag[slot][tier];
                    return <td key={tier} data-testid={`bag-${slot}-${tier}`} data-have={have > 0}><i className="sg-gear" data-tier={tier} aria-hidden="true">{tier}</i><b>×{have}</b>
                      {tier < MAX_TIER && <button data-testid={`forge-${slot}-${tier}`} disabled={have < MERGE} aria-label={`Forge ${MERGE} tier ${tier} ${GEAR_NAMES[slot].toLowerCase()} into one of tier ${tier + 1}`} onClick={() => act(g.merge(slot, tier), 'forge')}>Forge</button>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <output className="sg-note" data-testid="note">{note}</output>
    </main>
  );

}
