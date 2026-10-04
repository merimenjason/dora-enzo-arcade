/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Match, MAPS, LADDER, RIDES, RIDE_IDS, ITEMS, ITEM_IDS, AI_LEVELS, CHARGE_FULL, DUSK_TURN, MIN_ANGLE, MAX_ANGLE, UNIT_UP,
  ladderMatch, stars, type RideId, type ItemId,
} from '../../lib/burrow-barrage-game';
import { Stage, VIEW_W, VIEW_H, CELL, drawRideIcon } from '../../lib/burrow-barrage-scene';
import { cue, setMuted } from './sound';
import './barrage.css';

const SAVE_KEY = 'burrow-barrage-v1', SCALE = 2, WALK_RATE = 30, CHARGE_RATE = 55, THINK = 0.6;
type Save = { stars: number[]; muted: boolean; rides: [RideId, RideId] };
const blank = (): Save => ({ stars: LADDER.map(() => 0), muted: false, rides: ['catapult', 'spitter'] });
const isRide = (r: unknown): r is RideId => RIDE_IDS.includes(r as RideId);
function readSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');
    return { stars: LADDER.map((_, i) => Math.max(0, Math.min(3, Number(raw.stars?.[i]) || 0))), muted: !!raw.muted, rides: [isRide(raw.rides?.[0]) ? raw.rides[0] : 'catapult', isRide(raw.rides?.[1]) ? raw.rides[1] : 'spitter'] };
  } catch { return blank(); }
}
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };
/** How many ladder matches in a row have been won, from the first. */
const clearedOf = (s: Save) => { const i = s.stars.findIndex((n) => n === 0); return i < 0 ? s.stars.length : i; };
const newSeed = () => (Date.now() % 100000) + 1;

function Icon({ coat, ride, team, size }: { coat: string; ride: RideId; team: number; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawRideIcon(c, coat, ride, team, size, size);
  }, [coat, ride, team, size]);
  return <canvas ref={ref} width={size * SCALE} height={size * SCALE} style={{ width: size, height: size }} aria-hidden="true" />;
}
const Stars = ({ n }: { n: number }) => <span className="bb-stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>;

/** A ladder match against the computer, or two players sharing the device. */
type Mode = { kind: 'ladder'; index: number } | { kind: 'duel'; map: number };

export default function BurrowBarrage() {
  const [save, setSave] = useState<Save>(blank);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'match'>('home');
  const [shot, setShot] = useState(0);
  const [item, setItem] = useState<ItemId | null>(null);
  const [note, setNote] = useState('');
  const [speed, setSpeed] = useState(1);
  const [duelMap, setDuelMap] = useState(0);
  const [guests, setGuests] = useState<[RideId, RideId]>(['digger', 'cannon']);
  const [, setTick] = useState(0);
  const match = useRef<Match | null>(null), stage = useRef<Stage | null>(null), mode = useRef<Mode>({ kind: 'ladder', index: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const shotRef = useRef(0), itemRef = useRef<ItemId | null>(null), held = useRef(new Set<string>()), charge = useRef(-1), dragging = useRef(false);
  const recorded = useRef<Match | null>(null), result = useRef(0), noteTimer = useRef(0), tired = useRef(0);

  useEffect(() => { const s = readSave(); setSave(s); setMuted(s.muted); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => { (window as unknown as { __barrage?: () => unknown }).__barrage = () => ({ match: match.current, stage: stage.current, plan: () => match.current?.plan(2, true) ?? null }); }, []);

  const refresh = () => setTick((t) => t + 1);
  const say = (text: string) => { setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2400); };
  const pickShot = (n: number) => { shotRef.current = n; setShot(n); };
  const pickItem = (i: ItemId | null) => { itemRef.current = i; setItem(i); };
  /** The computer's level for a team, or -1 when a person plays it. */
  const levelOf = (team: number) => (mode.current.kind === 'ladder' && team === 1 ? LADDER[mode.current.index].level : -1);
  /** Whether a person may give orders right now. */
  const mine = () => { const m = match.current; return !!m && m.state === 'aim' && !stage.current?.busy && levelOf(m.active.team) < 0; };

  function open(m: Match) {
    match.current = m; stage.current = new Stage(m); stage.current.sfx = cue; stage.current.speed = speed;
    stage.current.feed(m.events.splice(0));
    recorded.current = null; result.current = 0; charge.current = -1; held.current.clear();
    pickShot(0); pickItem(null); setScreen('match'); refresh();
  }
  const startLadder = (i: number) => { mode.current = { kind: 'ladder', index: i }; open(ladderMatch(i, save.rides, newSeed())); };
  const startDuel = () => { mode.current = { kind: 'duel', map: duelMap }; open(Match.start({ map: duelMap, seed: newSeed(), rides: [save.rides, guests], names: [['Dora', 'Enzo'], ['Pip', 'Mora']], coats: [['dora', 'enzo'], ['pip', 'mora']] })); };
  const replay = () => (mode.current.kind === 'ladder' ? startLadder(mode.current.index) : startDuel());
  const home = () => setScreen('home');
  const setRide = (slot: number, ride: RideId) => { const rides: [RideId, RideId] = slot === 0 ? [ride, save.rides[1]] : [save.rides[0], ride]; const next = { ...save, rides }; setSave(next); writeSave(next); };

  /** After any engine call: play its events. */
  function commit() {
    const m = match.current, st = stage.current;
    if (!m || !st) return;
    st.feed(m.events.splice(0));
    refresh();
  }
  function aim(angle: number, power: number) { const m = match.current; if (!m || !mine()) return; m.aim(angle, power); refresh(); }
  /** One cell along the ground. Walking the other way turns the chinchilla round first. */
  function walk(dir: number) {
    const m = match.current;
    if (!m || !mine()) return;
    const u = m.active;
    if ((u.angle <= 90 ? 1 : -1) !== dir) m.aim(180 - u.angle, u.power);
    const r = m.walk(dir);
    if (r === 'ok') { if (u.moved % 4 === 0) cue('step'); } else if (r === 'tired' && tired.current !== m.turn) { tired.current = m.turn; say('No steps left this turn.'); }
    refresh();
  }
  function fire() {
    const m = match.current;
    charge.current = -1;
    if (!m || !mine()) return;
    const why = m.cannot(shotRef.current, itemRef.current);
    if (why) { say(why); return; }
    m.fire(shotRef.current, itemRef.current);
    pickShot(0); pickItem(null); commit();
  }
  function skip() { const m = match.current; if (!m || !mine()) return; m.skip(); pickShot(0); pickItem(null); commit(); }
  function chooseShot(n: number) {
    const m = match.current;
    if (!m || !mine()) return;
    if (n === 2 && !m.charged(m.active)) { say(m.cannot(2, null)); return; }
    pickShot(n); cue('select');
  }
  function chooseItem(i: ItemId) {
    const m = match.current;
    if (!m || !mine()) return;
    if (!m.active.items.includes(i)) { say(`${ITEMS[i].name} has been used.`); return; }
    pickItem(itemRef.current === i ? null : i); cue('select');
  }
  const cycleSpeed = () => { const s = speed === 1 ? 2 : speed === 2 ? 3 : 1; setSpeed(s); if (stage.current) stage.current.speed = s; };
  const toggleMute = () => { const next = { ...save, muted: !save.muted }; setSave(next); writeSave(next); setMuted(next.muted); };
  /** Records a finished match once its last animation has played. */
  function settle() {
    const m = match.current;
    if (!m || recorded.current === m) return;
    recorded.current = m;
    const duel = mode.current.kind === 'duel';
    cue(duel || m.winner === 0 ? 'win' : 'lose');
    if (mode.current.kind === 'ladder') {
      const i = mode.current.index, n = stars(m);
      result.current = n;
      if (n > save.stars[i]) { const next = { ...save, stars: save.stars.map((v, j) => (j === i ? n : v)) }; setSave(next); writeSave(next); }
    }
    refresh();
  }
  /** Points the active chinchilla at a spot on the board: the direction is the angle and the distance is the power. */
  function aimAt(e: React.PointerEvent<HTMLCanvasElement>) {
    const m = match.current;
    if (!m || !mine()) return;
    const q = e.currentTarget.getBoundingClientRect(), u = m.active;
    const dx = ((e.clientX - q.left) / q.width) * VIEW_W - (u.x + 0.5) * CELL, dy = (u.y - UNIT_UP) * CELL - ((e.clientY - q.top) / q.height) * VIEW_H;
    const angle = dy <= 0 ? (dx >= 0 ? MIN_ANGLE : MAX_ANGLE) : (Math.atan2(dy, dx) * 180) / Math.PI;
    aim(angle, Math.hypot(dx, dy) / 2.6);
  }

  // The loop: walking, charging, the computer's turns, animations and drawing.
  useEffect(() => {
    if (screen !== 'match') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, ui = 0, wasBusy = true, steps = 0, think = 0, guideKey = '', guide: number[] | null = null;
    const loop = (now: number) => {
      const m = match.current, st = stage.current;
      if (!m || !st) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      st.update(dt, m);
      if (!st.busy && m.state === 'aim') {
        const level = levelOf(m.active.team);
        if (level >= 0) {
          think += dt;
          if (think >= THINK / st.speed) { think = 0; m.aiTurn(level); commit(); }
        } else {
          think = 0;
          const dir = (held.current.has('arrowright') ? 1 : 0) - (held.current.has('arrowleft') ? 1 : 0);
          if (dir) { steps += dt * WALK_RATE; while (steps >= 1) { steps -= 1; walk(dir); } } else steps = 0;
          if (charge.current >= 0) {
            charge.current = Math.min(100, charge.current + dt * CHARGE_RATE);
            m.aim(m.active.angle, charge.current);
            if (charge.current >= 100) fire(); else refresh();
          }
        }
      }
      if (!st.busy && m.state === 'over' && recorded.current !== m) settle();
      const u = m.active, human = !st.busy && m.state === 'aim' && levelOf(u.team) < 0, key = human ? `${m.turn}|${u.x}|${u.y}|${u.angle}|${u.power}|${m.wind}` : '';
      if (key !== guideKey) { guideKey = key; guide = human ? m.guide() : null; }
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      st.draw(c, m, now / 1000, { guide, charging: human ? charge.current : -1 });
      if (st.busy !== wasBusy || (st.busy && now - ui > 120)) { wasBusy = st.busy; ui = now; refresh(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps -- the loop reads refs

  // Keyboard: ← → walk, ↑ ↓ angle, hold Space to charge and let go to fire, 1 2 3 shots, Q W E items, F speed, M sound.
  useEffect(() => {
    if (screen !== 'match') return;
    const down = (e: KeyboardEvent) => {
      const m = match.current;
      if (!m || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'f') { cycleSpeed(); return; }
      if (k === 'm') { toggleMute(); return; }
      if (stage.current?.busy) { if (k === 'enter') { e.preventDefault(); stage.current.flush(m); refresh(); } return; }
      if (!mine()) return;
      const u = m.active;
      if (k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); if (!held.current.has(k)) { held.current.add(k); walk(k === 'arrowleft' ? -1 : 1); } return; }
      // Up always raises the barrel and down always lowers it, whichever way the chinchilla faces.
      if (k === 'arrowup' || k === 'arrowdown') { e.preventDefault(); const up = k === 'arrowup' ? 1 : -1; aim(u.angle + (u.angle <= 90 ? up : -up), u.power); return; }
      if (k === ' ') {
        e.preventDefault();
        // A focused button would fire again when the key comes back up.
        (document.activeElement as HTMLElement | null)?.blur?.();
        if (!e.repeat && charge.current < 0) { charge.current = 0; cue('select'); }
        return;
      }
      if (k === '1' || k === '2' || k === '3') { chooseShot(Number(k) - 1); return; }
      const it = ({ q: 'dual', w: 'heal', e: 'hop' } as Record<string, ItemId>)[k];
      if (it) chooseItem(it);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      held.current.delete(k);
      if (k === ' ' && charge.current >= 0) { e.preventDefault(); fire(); }
    };
    const blur = () => { held.current.clear(); charge.current = -1; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  });

  const m = match.current, st = stage.current, playing = screen === 'match' && !!m && !!st;
  const header = (
    <header className="bb-header">
      <a className="bb-back" href="/">← MAIN ARCADE</a>
      <span className="bb-brand">BURROW BARRAGE</span>
      <span className="bb-tools">
        <button onClick={toggleMute} aria-pressed={save.muted}>{save.muted ? 'Sound off' : 'Sound on'}{playing ? ' · M' : ''}</button>
        {playing && <button onClick={cycleSpeed}>{speed}× · F</button>}
        {playing && <button data-testid="menu" onClick={home}>Menu</button>}
      </span>
    </header>
  );

  if (screen === 'home' || !m || !st) {
    const cleared = clearedOf(save), total = save.stars.reduce((s, n) => s + n, 0);
    const picker = (label: string, coat: string, team: number, value: RideId, set: (r: RideId) => void, id: string) => (
      <div className="bb-pick" role="group" aria-label={`${label}’s ride`}>
        <strong>{label}</strong>
        {RIDE_IDS.map((r) => (
          <button key={r} className={value === r ? 'on' : ''} aria-pressed={value === r} data-testid={`${id}-${r}`} onClick={() => set(r)}>
            <Icon coat={coat} ride={r} team={team} size={52} /><b>{RIDES[r].name}</b><small>♥ {RIDES[r].hp} · walks {RIDES[r].move}</small>
          </button>
        ))}
      </div>
    );
    return (
      <main className="bb-shell">
        {header}
        <section className="bb-intro">
          <div className="bb-intro-art"><Icon coat="dora" ride={save.rides[0]} team={0} size={92} /><Icon coat="enzo" ride={save.rides[1]} team={0} size={92} /></div>
          <div>
            <p className="bb-eyebrow">TURN-BASED ARTILLERY · SIX-MATCH LADDER · PASS AND PLAY</p>
            <h1>Burrow Barrage</h1>
            <p className="bb-lede">Two against two, one shot at a time. Set the <b>angle</b>, set the <b>power</b>, mind the <b>wind</b>, and let fly. Every shot digs the ground away, and a chinchilla with nothing left to stand on is out.</p>
          </div>
        </section>

        <ol className="bb-how">
          <li><b>Aim.</b> Drag on the board, or use the sliders: the direction is the angle and the distance is the power. The dots show where the shot starts out.</li>
          <li><b>Read the wind.</b> The gauge at the top and the clouds show it. It bends every shot and changes a little each turn.</li>
          <li><b>Pick the shot.</b> Each ride has two shots and a big one that takes {CHARGE_FULL} turns to charge. Bigger shots mean a longer wait for your next turn.</li>
          <li><b>Dig them out.</b> Blasts hurt less the further away they land, but craters stay. Knock a rival off a ledge and it is out at once.</li>
        </ol>

        <h2 className="bb-section">Your rides <small>each chinchilla brings one into every match</small></h2>
        <div className="bb-picks">
          {picker('Dora', 'dora', 0, save.rides[0], (r) => setRide(0, r), 'dora')}
          {picker('Enzo', 'enzo', 0, save.rides[1], (r) => setRide(1, r), 'enzo')}
        </div>

        <h2 className="bb-section">The ladder <small>{total} of {LADDER.length * 3} stars · win a match to open the next</small></h2>
        <div className="bb-rungs">
          {LADDER.map((r, i) => {
            const openNow = i <= cleared;
            return (
              <button key={i} className={`bb-rung${save.stars[i] ? ' done' : ''}`} data-testid={`ladder-${i + 1}`} disabled={!openNow || !loaded} onClick={() => startLadder(i)}>
                <em>{i + 1}</em>
                <strong>{r.rivals[0]} and {r.rivals[1]}</strong>
                <small>{MAPS[r.map].name} · {RIDES[r.rides[0]].name} and {RIDES[r.rides[1]].name} · {AI_LEVELS[r.level].name} aim</small>
                <span>{openNow ? <Stars n={save.stars[i]} /> : '🔒'}</span>
              </button>
            );
          })}
        </div>

        <h2 className="bb-section">Pass and play <small>two players, one device, taking turns</small></h2>
        <div className="bb-duel">
          <div className="bb-maps" role="group" aria-label="Map">
            {MAPS.map((d, i) => <button key={d.name} className={duelMap === i ? 'on' : ''} aria-pressed={duelMap === i} data-testid={`map-${i + 1}`} onClick={() => setDuelMap(i)}><b>{d.name}</b><small>{d.blurb}</small></button>)}
          </div>
          <div className="bb-picks">
            {picker('Pip', 'pip', 1, guests[0], (r) => setGuests([r, guests[1]]), 'pip')}
            {picker('Mora', 'mora', 1, guests[1], (r) => setGuests([guests[0], r]), 'mora')}
          </div>
          <button className="bb-go" data-testid="start-duel" disabled={!loaded} onClick={startDuel}>Dora and Enzo against Pip and Mora →</button>
        </div>

        <h2 className="bb-section">The rides</h2>
        <div className="bb-roster">
          {RIDE_IDS.map((r) => (
            <div key={r} className="bb-card">
              <Icon coat="dora" ride={r} team={0} size={64} />
              <div>
                <strong>{RIDES[r].name} <span>♥ {RIDES[r].hp} · walks {RIDES[r].move} a turn</span></strong>
                <p>{RIDES[r].blurb}</p>
                {RIDES[r].shots.map((s, n) => <p key={s.name}><b>{s.name}</b>{n === 2 ? ' (big shot)' : ''}. {s.blurb} <i>Wait {s.delay}.</i></p>)}
              </div>
            </div>
          ))}
        </div>
        <h2 className="bb-section">The items <small>every chinchilla carries one of each, once a match</small></h2>
        <div className="bb-roster">
          {ITEM_IDS.map((i) => <div key={i} className="bb-card"><div><strong>{ITEMS[i].name}</strong><p>{ITEMS[i].blurb} <i>Adds {ITEMS[i].delay} to the wait.</i></p></div></div>)}
        </div>
      </main>
    );
  }

  // While a shot is still playing the engine has already moved on, so the controls keep showing whoever fired.
  const busy = st.busy, u = busy ? m.units[st.activeId] : m.active, ride = RIDES[u.ride], rung = mode.current.kind === 'ladder' ? LADDER[mode.current.index] : null;
  const level = levelOf(u.team), can = m.state === 'aim' && !busy && level < 0, done = m.state === 'over' && !busy && recorded.current === m;
  const def = ride.shots[shot], replaced = item === 'heal' || item === 'hop';
  let overlay: React.ReactNode = null;
  if (done && rung && mode.current.kind === 'ladder') {
    const i = mode.current.index, n = result.current;
    overlay = m.winner === 0 ? <>
      <p className="bb-eyebrow">MATCH {i + 1} · {MAPS[rung.map].name.toUpperCase()}</p>
      <h2>{rung.rivals[0]} and {rung.rivals[1]} are out!</h2>
      <div className="bb-result-stars"><Stars n={n} /></div>
      <ul className="bb-checks">
        <li className="yes">Win the match</li>
        <li className={n >= 2 ? 'yes' : 'no'}>Keep both Dora and Enzo in</li>
        <li className={n >= 3 ? 'yes' : 'no'}>Finish with half the pair’s health left</li>
      </ul>
      {i + 1 < LADDER.length ? <button className="bb-go" data-testid="next-match" onClick={() => startLadder(i + 1)}>{`Match ${i + 2}: ${LADDER[i + 1].rivals.join(' and ')} →`}</button> : <p className="bb-open">That is the whole ladder. Dora and Enzo are the champions.</p>}
      <button onClick={replay}>Play it again</button><button onClick={home}>Menu</button>
    </> : <>
      <p className="bb-eyebrow">MATCH {i + 1} · {MAPS[rung.map].name.toUpperCase()}</p>
      <h2>{m.winner < 0 ? 'Nobody is left standing.' : `${rung.rivals[0]} and ${rung.rivals[1]} win this one.`}</h2>
      <p>Try a different pair of rides, and watch the wind: a shot fired with it carries much further.</p>
      <button className="bb-go" data-testid="retry" onClick={replay}>Try again →</button><button onClick={home}>Menu</button>
    </>;
  } else if (done) {
    overlay = <>
      <p className="bb-eyebrow">PASS AND PLAY · {MAPS[m.map].name.toUpperCase()}</p>
      <h2>{m.winner < 0 ? 'A draw: nobody is left standing.' : m.winner === 0 ? 'Dora and Enzo win!' : 'Pip and Mora win!'}</h2>
      <button className="bb-go" data-testid="retry" onClick={replay}>Play again →</button><button onClick={home}>Menu</button>
    </>;
  }
  const tip = m.state === 'over' ? '' : busy ? '…' : level >= 0 ? `${u.name} is taking aim…`
    : item ? `${ITEMS[item].name}: ${ITEMS[item].blurb} Adds ${ITEMS[item].delay} to the wait.`
      : `${def.name}: ${def.blurb} Wait ${def.delay}. Drag on the board to aim, then press Fire, or hold Space to charge and let go.`;
  const toDusk = DUSK_TURN - m.turn;

  return (
    <main className="bb-shell bb-play">
      {header}
      <section className="bb-top">
        <div className="bb-title">
          <strong>{rung && mode.current.kind === 'ladder' ? `Match ${mode.current.index + 1}: ${rung.rivals.join(' and ')}` : 'Pass and play'}</strong>
          <small>{MAPS[m.map].name} · turn {st.turn}{toDusk < 0 ? ' · dusk: everyone loses health each turn' : toDusk <= 8 ? ` · dusk in ${toDusk + 1} turns` : ''}{rung ? ` · ${AI_LEVELS[rung.level].name} aim` : ''}</small>
        </div>
        {m.state === 'aim' && <div className="bb-order" data-testid="order" aria-label="Who goes next">
          <small>NEXT UP</small>
          <span>{m.order(6).map((id, n) => <i key={n} className={`t${m.units[id].team}${n === 0 ? ' now' : ''}`}>{m.units[id].name}</i>)}</span>
        </div>}
      </section>
      <div className="bb-teams">
        {m.units.map((v) => {
          const sp = st.sprites[v.id], hp = sp.alive ? sp.hp : 0;
          return (
            <div key={v.id} className={`bb-unit t${v.team}${v.id === st.activeId && m.state === 'aim' ? ' on' : ''}${hp <= 0 ? ' out' : ''}`} data-testid={`unit-${v.id}`} data-hp={hp}>
              <Icon coat={v.coat} ride={v.ride} team={v.team} size={40} />
              <span><strong>{v.name}</strong><small>{hp > 0 ? `${RIDES[v.ride].name} · ${hp}/${v.maxHp}` : 'Out'}</small><span className="bb-bar"><i style={{ width: `${(hp / v.maxHp) * 100}%` }} /></span></span>
            </div>
          );
        })}
      </div>
      <div className="bb-board">
        <canvas
          ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
          data-testid="board" data-state={m.state} data-turn={m.turn} data-active={m.activeId} data-busy={busy ? '1' : '0'} data-winner={m.winner}
          aria-label="The battlefield. Left and right walk, up and down change the angle, hold Space to charge a shot and let go to fire, 1 to 3 pick the shot, Q W E pick an item."
          onPointerDown={(e) => { if (st.busy) { st.flush(m); refresh(); return; } dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); aimAt(e); }}
          onPointerMove={(e) => { if (dragging.current) aimAt(e); }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
        />
        {note && <output className="bb-note">{note}</output>}
        {overlay && <div className="bb-overlay"><div>{overlay}</div></div>}
      </div>
      <div className="bb-controls">
        <div className="bb-walk">
          <button data-testid="walk-left" disabled={!can} aria-label="Walk left" onPointerDown={() => { held.current.add('arrowleft'); walk(-1); }} onPointerUp={() => held.current.delete('arrowleft')} onPointerLeave={() => held.current.delete('arrowleft')}>◀</button>
          <small>{Math.max(0, ride.move - u.moved)} steps</small>
          <button data-testid="walk-right" disabled={!can} aria-label="Walk right" onPointerDown={() => { held.current.add('arrowright'); walk(1); }} onPointerUp={() => held.current.delete('arrowright')} onPointerLeave={() => held.current.delete('arrowright')}>▶</button>
        </div>
        <label className="bb-slider">
          <span>Angle <b>{u.angle <= 90 ? u.angle : 180 - u.angle}° {u.angle <= 90 ? '→' : '←'}</b></span>
          {/* Laid out right to left, so sliding left aims left. */}
          <input type="range" dir="rtl" min={MIN_ANGLE} max={MAX_ANGLE} value={u.angle} disabled={!can} data-testid="angle" onChange={(e) => aim(Number(e.target.value), u.power)} />
        </label>
        <label className="bb-slider bb-power">
          <span>Power <b>{u.power}</b>{u.lastPower >= 0 ? <small> · last shot {u.lastPower}</small> : null}</span>
          <span className="bb-track">
            <input type="range" min={0} max={100} value={u.power} disabled={!can} data-testid="power" onChange={(e) => aim(u.angle, Number(e.target.value))} />
            {u.lastPower >= 0 && <i style={{ left: `${u.lastPower}%` }} aria-hidden="true" />}
          </span>
        </label>
        <button className="bb-go bb-fire" data-testid="fire" disabled={!can} onClick={fire}>{item === 'heal' ? 'Eat' : item === 'hop' ? 'Hop' : 'Fire'}<small>Space</small></button>
      </div>
      <div className="bb-actions">
        {ride.shots.map((s, n) => (
          <button key={s.name} className={`bb-act${shot === n && !replaced ? ' on' : ''}`} data-testid={`shot-${n + 1}`} disabled={!can || replaced} aria-pressed={shot === n} title={s.blurb} onClick={() => chooseShot(n)}>
            <b>{s.name}</b>
            {n === 2 && <span className="bb-pips" aria-label={`${u.charge} of ${CHARGE_FULL} charged`}>{Array.from({ length: CHARGE_FULL }, (_, k) => <i key={k} className={k < u.charge ? 'on' : ''} />)}</span>}
            <small>{n + 1}</small>
          </button>
        ))}
        {ITEM_IDS.map((i, n) => (
          <button key={i} className={`bb-act bb-item${item === i ? ' on' : ''}`} data-testid={`item-${i}`} disabled={!can || !u.items.includes(i)} aria-pressed={item === i} title={ITEMS[i].blurb} onClick={() => chooseItem(i)}>
            <b>{ITEMS[i].name}</b><small>{'QWE'[n]}</small>
          </button>
        ))}
        <span className="bb-spacer" />
        <button data-testid="skip" disabled={!can} onClick={skip}>Skip turn</button>
      </div>
      <p className="bb-info" data-testid="info">{tip}</p>
    </main>
  );
}
