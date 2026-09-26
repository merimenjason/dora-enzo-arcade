/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ClashGame, CARDS, CARD_IDS, DEFAULT_DECK, DECK_SIZE, HEROES, RIVALS, MAX_DUST, W, H,
  validDeck, averageCost, type CardId, type PlayResult,
} from '../../lib/chinchilla-clash-game';
import { drawClash, drawCardArt, rivalLeaderArt, heroesArt, VIEW_W, VIEW_H, type Ghost } from '../../lib/chinchilla-clash-scene';
import './clash.css';

const SAVE_KEY = 'chinchilla-clash-v1', DT = 1 / 60, SCALE = 2;
type Save = { beaten: number; deck: CardId[]; wins: number; threeCrowns: number };
const EMPTY: Save = { beaten: 0, deck: DEFAULT_DECK, wins: 0, threeCrowns: 0 };
const readSave = (): Save => {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '');
    return { beaten: Math.max(0, Math.min(RIVALS.length, Number(s.beaten) || 0)), deck: validDeck(s.deck) ? s.deck : DEFAULT_DECK, wins: Number(s.wins) || 0, threeCrowns: Number(s.threeCrowns) || 0 };
  } catch { return EMPTY; }
};
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: battles still play, progress just isn't kept */ } };

const REFUSED: Record<Exclude<PlayResult, 'ok'>, string> = {
  dust: 'Not enough dust yet.',
  zone: 'Troops go on your side of the river, or in a lane whose tower has fallen.',
  slot: '', state: '',
};

/** A card's picture, drawn once on a small canvas. */
function CardArt({ id, w = 64, h = 60 }: { id: CardId; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.clearRect(0, 0, w, h);
    drawCardArt(c, id, w, h, 0.5);
  }, [id, w, h]);
  return <canvas ref={ref} className="cc-art" width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden="true" />;
}

function Portrait({ draw, w, h }: { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.clearRect(0, 0, w, h);
    draw(c, w, h);
  }, [draw, w, h]);
  return <canvas ref={ref} width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden="true" />;
}

const Crowns = ({ n, side }: { n: number; side: 0 | 1 }) => (
  <span className={`cc-crowns side-${side}`} aria-label={`${n} crown${n === 1 ? '' : 's'}`}>
    {[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>♛</i>)}
  </span>
);

export default function ChinchillaClash() {
  const [save, setSave] = useState<Save>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'battle'>('home');
  const [deck, setDeck] = useState<CardId[]>(DEFAULT_DECK);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [, setTick] = useState(0);
  const game = useRef<ClashGame | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const cursor = useRef<{ x: number; y: number; shown: boolean }>({ x: W / 2, y: 24, shown: false });
  const selectedRef = useRef<number | null>(null);
  const drag = useRef<{ slot: number; over: boolean } | null>(null);
  /** A touch drag ends on the card it started from, which would also count as a click on it. */
  const swallowClick = useRef(false);
  const recorded = useRef<ClashGame | null>(null);
  const noteTimer = useRef(0);

  useEffect(() => { const s = readSave(); setSave(s); setDeck(s.deck); setLoaded(true); }, []);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  // The browser test reads and fast-forwards the running battle through this.
  useEffect(() => { (window as unknown as { __clash?: () => ClashGame | null }).__clash = () => game.current; }, []);

  const say = (text: string) => { setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 1800); };
  const choose = (slot: number | null) => { selectedRef.current = slot; setSelected(slot); };

  function begin(round: number) {
    game.current = new ClashGame({ rival: round, deck, seed: (Date.now() % 100000) + round });
    recorded.current = null;
    choose(null);
    cursor.current = { x: W / 2, y: 24, shown: false };
    setScreen('battle');
    setTick((t) => t + 1);
  }

  function deploy(slot: number, x: number, y: number) {
    const g = game.current;
    if (!g) return false;
    const result = g.play(0, slot, x, y);
    if (result === 'ok') { choose(null); setTick((t) => t + 1); return true; }
    if (REFUSED[result]) say(REFUSED[result]);
    return false;
  }

  const toArena = (clientX: number, clientY: number) => {
    const r = canvas.current?.getBoundingClientRect();
    if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  };

  // The game loop: fixed steps for the rules, a draw every frame, and a HUD refresh a few times a second.
  useEffect(() => {
    if (screen !== 'battle') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, acc = 0, ui = 0;
    const loop = (now: number) => {
      const g = game.current;
      if (!g) return;
      acc += last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      while (acc >= DT) { g.step(DT); acc -= DT; }
      g.events.splice(0);
      const slot = selectedRef.current, card = slot === null ? null : g.hands[0][slot];
      const ghost: Ghost = card && cursor.current.shown ? { card, x: cursor.current.x, y: cursor.current.y, ok: g.canPlace(0, card, cursor.current.x, cursor.current.y) && g.dust[0] >= CARDS[card].cost } : null;
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      drawClash(c, g, now / 1000, ghost);
      if (now - ui > 100) { setTick((t) => t + 1); ui = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const blur = () => { if (game.current?.state === 'playing') { game.current.pause(); setTick((t) => t + 1); } };
    window.addEventListener('blur', blur);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('blur', blur); };
  }, [screen]);

  // Keyboard: 1–4 pick a card, arrows or WASD move the drop point, Enter or Space drops it, Escape or P pauses.
  useEffect(() => {
    if (screen !== 'battle') return;
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (!g || (e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'p' || (k === 'escape' && selectedRef.current === null)) { e.preventDefault(); if (g.state !== 'over') { g.pause(); setTick((t) => t + 1); } return; }
      if (g.state !== 'playing') return;
      if (k === 'escape') { choose(null); return; }
      if (['1', '2', '3', '4'].includes(k)) {
        const slot = Number(k) - 1, at = cursor.current;
        choose(selectedRef.current === slot ? null : slot);
        // Start the drop point somewhere the card can go, in front of the king tower.
        cursor.current = g.canPlace(0, g.hands[0][slot], at.x, at.y) ? { ...at, shown: true } : { x: W / 2 + 0.5, y: 21.5, shown: true };
        return;
      }
      const moves: Record<string, [number, number]> = { arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0], arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1] };
      if (moves[k] && selectedRef.current !== null) {
        e.preventDefault();
        cursor.current = { x: Math.max(0.5, Math.min(W - 0.5, Math.floor(cursor.current.x) + 0.5 + moves[k][0])), y: Math.max(0.5, Math.min(H - 0.5, Math.floor(cursor.current.y) + 0.5 + moves[k][1])), shown: true };
        return;
      }
      // Enter and Space drop the card, even with a hand card focused (it would otherwise just click it again).
      const focus = e.target as HTMLElement;
      if ((k === 'enter' || k === ' ') && selectedRef.current !== null && (!focus.closest('button,a') || focus.closest('.cc-card'))) {
        e.preventDefault(); deploy(selectedRef.current, cursor.current.x, cursor.current.y);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  // Dragging a card onto the arena drops it where the pointer is let go.
  useEffect(() => {
    if (screen !== 'battle') return;
    const move = (e: PointerEvent) => {
      const at = toArena(e.clientX, e.clientY);
      if (at) cursor.current = { ...at, shown: true };
      else if (drag.current) cursor.current.shown = false;
      if (drag.current && at) drag.current.over = true;
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || !d.over) return;
      swallowClick.current = true;
      window.setTimeout(() => { swallowClick.current = false; }, 0);
      const at = toArena(e.clientX, e.clientY);
      if (at) deploy(d.slot, at.x, at.y);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  });

  const g = game.current;
  // Record the result once per finished battle.
  if (g && g.state === 'over' && recorded.current !== g) {
    recorded.current = g;
    if (g.winner === 0) {
      const next = { ...save, beaten: Math.max(save.beaten, g.round + 1), wins: save.wins + 1, threeCrowns: save.threeCrowns + (g.crowns[0] === 3 ? 1 : 0), deck };
      setSave(next); writeSave(next);
    }
  }

  function toggleCard(id: CardId) {
    const next = deck.includes(id) ? deck.filter((d) => d !== id) : deck.length < DECK_SIZE ? [...deck, id] : deck;
    if (next === deck && !deck.includes(id)) { say('Your deck is full. Take a card out first.'); return; }
    setDeck(next);
    if (validDeck(next)) { const s = { ...save, deck: next }; setSave(s); writeSave(s); }
  }

  const header = (
    <header className="cc-header">
      <a className="cc-back" href="/">← MAIN ARCADE</a>
      <span className="cc-brand">CHINCHILLA CLASH</span>
      {screen === 'battle' && g ? (
        <button onClick={() => { g.pause(); setTick((t) => t + 1); }} disabled={g.state === 'over'}>{g.state === 'paused' ? 'Resume' : 'Pause'} · P</button>
      ) : <span />}
    </header>
  );

  if (screen === 'home' || !g) {
    const ready = validDeck(deck), missing = DECK_SIZE - deck.length;
    return (
      <main className="cc-shell">
        {header}
        <section className="cc-intro">
          <Portrait draw={heroesArt} w={170} h={110} />
          <div>
            <p className="cc-eyebrow">A CARD BATTLER · TWO LANES · THREE TOWERS</p>
            <h1>Chinchilla Clash</h1>
            <p className="cc-lede">Dora and Enzo hold the <b>Dust Palace</b>. Play cards with bath dust to send kits, gliders, grandpas and a capybara over the river. Knock down the rival clan’s towers for crowns; topple their king for all three.</p>
          </div>
        </section>

        <h2 className="cc-section">Trophy road <small>{save.wins ? `${save.wins} win${save.wins === 1 ? '' : 's'} · ${save.threeCrowns} three-crown` : 'beat each clan to open the next arena'}</small></h2>
        <div className="cc-road">
          {RIVALS.map((r, i) => {
            const open = i <= save.beaten, beaten = i < save.beaten;
            return (
              <article key={r.id} className={`cc-arena${open ? '' : ' locked'}${beaten ? ' beaten' : ''}`}>
                <Portrait draw={(c, w, h) => rivalLeaderArt(c, r.id, w, h)} w={96} h={80} />
                <div>
                  <p className="cc-eyebrow">ARENA {i + 1} · {r.arena.toUpperCase()}</p>
                  <strong>{r.name}</strong>
                  <small>{r.blurb}</small>
                  <em>{beaten ? '✓ Beaten' : open ? 'Open' : `🔒 Beat ${RIVALS[i - 1].leader} to open`}</em>
                </div>
                <button className="cc-go" data-testid={`battle-${r.id}`} disabled={!open || !ready || !loaded} onClick={() => begin(i)}>{beaten ? 'REMATCH' : 'BATTLE'}</button>
              </article>
            );
          })}
        </div>

        <h2 className="cc-section">Your deck <small>{deck.length}/{DECK_SIZE} cards{deck.length ? ` · average ${averageCost(deck).toFixed(1)} dust` : ''}</small></h2>
        <p className="cc-hint">Pick eight cards. Your deck cycles: play a card and the next one in line takes its place. {!ready && <b className="cc-warn">Choose {missing > 0 ? `${missing} more` : 'eight'} to battle.</b>} {note && <b className="cc-warn">{note}</b>}</p>
        <section className="cc-deck" aria-label="Deck builder">
          {CARD_IDS.map((id) => {
            const card = CARDS[id], on = deck.includes(id);
            return (
              <button key={id} className={`cc-pick${on ? ' on' : ''}`} aria-pressed={on} data-testid={`card-${id}`} onClick={() => toggleCard(id)}>
                <span className="cc-cost">{card.cost}</span>
                <CardArt id={id} w={96} h={72} />
                <strong>{card.name}</strong>
                <small>{card.kind === 'spell' ? 'Spell' : card.kind === 'building' ? 'Building' : `${card.count && card.count > 1 ? `${card.count} × ` : ''}${card.stats!.air ? 'Flying troop' : 'Troop'}${HEROES.includes(id) ? ' · Hero' : ''}`}</small>
                <span className="cc-blurb">{card.blurb}</span>
              </button>
            );
          })}
        </section>
        <div className="cc-row"><button onClick={() => { setDeck(DEFAULT_DECK); const s = { ...save, deck: DEFAULT_DECK }; setSave(s); writeSave(s); }}>Reset to the starter deck</button></div>

        <section className="cc-help">
          <p><b>Spend dust.</b> Dust fills by one every 2.8 seconds, up to ten. Each card costs dust. In the last minute it fills twice as fast.</p>
          <p><b>Push a lane.</b> Troops walk to the nearest bridge, fight whatever they meet, then go for towers. Grandpa Pebble, the Dust Dasher and the Hay Balloon only hit buildings.</p>
          <p><b>Win crowns.</b> Each princess tower is a crown; the king tower is all three. Most crowns after three minutes wins. Level? Overtime, where the next crown wins.</p>
        </section>
      </main>
    );
  }

  const hand = g.hands[0], next = g.next(0), dust = g.dust[0];
  const clock = Math.max(0, g.clock), mm = Math.floor(clock / 60), ss = Math.floor(clock % 60);
  let overlay: React.ReactNode = null;
  if (g.state === 'paused') overlay = <><p className="cc-eyebrow">PAUSED</p><h2>Take a dust bath.</h2><p>The clock is stopped.</p><button className="cc-go" onClick={() => { g.pause(); setTick((t) => t + 1); }}>Back to battle →</button><button onClick={() => setScreen('home')}>Leave for the trophy road</button></>;
  else if (g.state === 'over') {
    const won = g.winner === 0, nextArena = won && g.round + 1 < RIVALS.length;
    const why = g.reason === 'king' ? (won ? 'You toppled the king tower!' : 'Your king tower fell.') : g.reason === 'tiebreak' ? 'Level after overtime, so the weakest tower decided it.' : g.reason === 'overtime' ? 'Decided by a crown in overtime.' : g.reason === 'draw' ? 'Level after overtime, towers and all.' : 'Most crowns at full time.';
    overlay = <>
      <p className="cc-eyebrow">{won ? 'VICTORY' : g.winner === null ? 'DRAW' : 'DEFEAT'}</p>
      <h2>{won ? (g.round === RIVALS.length - 1 ? 'Dora and Enzo rule the mountain!' : `${g.rival.leader} is beaten!`) : g.winner === null ? 'Honours even.' : `${g.rival.leader} wins this one.`}</h2>
      <div className="cc-result"><Crowns n={g.crowns[0]} side={0} /><span>–</span><Crowns n={g.crowns[1]} side={1} /></div>
      <p>{why} You played {g.played[0]} cards and spent {g.spent[0]} dust.</p>
      {nextArena && <button className="cc-go" data-testid="next-arena" onClick={() => begin(g.round + 1)}>{`On to ${RIVALS[g.round + 1].arena} →`}</button>}
      <button className={nextArena ? '' : 'cc-go'} onClick={() => begin(g.round)}>Rematch</button>
      <button onClick={() => setScreen('home')}>Trophy road</button>
    </>;
  }

  return (
    <main className="cc-shell cc-battle">
      {header}
      <div className="cc-stage">
        <div className="cc-bar top">
          <span className="cc-who"><b>{g.rival.leader.toUpperCase()}</b><small>{g.rival.arena}</small></span>
          <Crowns n={g.crowns[1]} side={1} />
          <time className={g.overtime ? 'ot' : g.double ? 'double' : ''}>{g.overtime ? 'OVERTIME ' : ''}{mm}:{String(ss).padStart(2, '0')}{g.double && !g.overtime ? <small>×2 DUST</small> : null}</time>
        </div>
        <div className="cc-board">
          <canvas
            ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
            data-testid="arena" data-state={g.state} data-dust={Math.floor(dust)} data-crowns={`${g.crowns[0]}-${g.crowns[1]}`} data-troops={g.units.filter((u) => u.side === 0 && u.role === 'troop').length}
            aria-label="The arena. Pick a card with 1 to 4, move the drop point with the arrow keys and press Enter, or tap a card then tap the arena."
            onPointerDown={(e) => { const at = toArena(e.clientX, e.clientY); if (!at) return; cursor.current = { ...at, shown: true }; if (selectedRef.current !== null) deploy(selectedRef.current, at.x, at.y); }}
            onPointerLeave={() => { if (!drag.current) cursor.current.shown = false; }}
          />
          {g.messageTime > 0 && g.state === 'playing' && <div className="cc-banner">{g.message}</div>}
          {note && <output className="cc-note">{note}</output>}
          {overlay && <div className="cc-overlay"><div>{overlay}</div></div>}
        </div>
        <div className="cc-bar bottom">
          <span className="cc-who"><b>DORA &amp; ENZO</b><small>Dust Palace</small></span>
          <Crowns n={g.crowns[0]} side={0} />
        </div>
        <section className="cc-hand" aria-label="Your hand">
          <div className="cc-next" aria-label={`Next card: ${CARDS[next].name}`}><small>NEXT</small><CardArt id={next} w={40} h={38} /></div>
          {hand.map((id, slot) => {
            const card = CARDS[id], afford = dust >= card.cost;
            return (
              <button
                key={`${slot}-${id}`} className={`cc-card${selected === slot ? ' on' : ''}${afford ? '' : ' poor'}`} data-testid={`hand-${slot}`} data-card={id}
                aria-pressed={selected === slot} aria-label={`${slot + 1}: ${card.name}, ${card.cost} dust`}
                onPointerDown={(e) => { if (e.button !== 0 || g.state !== 'playing') return; drag.current = { slot, over: false }; }}
                onClick={() => { if (swallowClick.current) { swallowClick.current = false; return; } if (g.state === 'playing') choose(selected === slot ? null : slot); }}
              >
                <CardArt id={id} w={64} h={58} />
                <span className="cc-cost">{card.cost}</span>
                <small>{slot + 1} · {card.name.split(',')[0]}</small>
              </button>
            );
          })}
        </section>
        <div className="cc-dust" aria-label={`Dust ${Math.floor(dust)} of ${MAX_DUST}`}>
          <b>{Math.floor(dust)}</b>
          <div>{Array.from({ length: MAX_DUST }, (_, i) => <i key={i}><em style={{ width: `${Math.max(0, Math.min(1, dust - i)) * 100}%` }} /></i>)}</div>
        </div>
        <p className="cc-keys">Tap or drag a card onto your half · 1–4 pick · arrows move · Enter drops · P pauses</p>
      </div>
    </main>
  );
}
