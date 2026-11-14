'use client';
// Jade Street story screens: the painted storybook that opens a new game, the chapter card between chapters, the
// ending at the Lantern Festival and the credits that lead into festival free roam. Every picture is a Codex painting
// (public/art/jade-street/bg-story-*, bg-chapter-*, bg-end-*); code only adds the slow pan and floating lantern light.
// Every screen can be skipped (Skip or Escape); a tap, click, Space or Enter turns the page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAPTERS, CHAPTER_OPENS, HEIRLOOMS, PEOPLE } from '@/lib/jade-story';
import { DISTRICT_NAME } from '@/lib/jade-city';
import './story.css';

const ART = '/art/jade-street/';
type Panel = { img: string; title: string; text: string; focus?: string };

const OPENING: Panel[] = [
  { img: 'bg-story-1', title: 'The night before the Lantern Festival', focus: '50% 40%',
    text: 'The Night Market glows red and gold. Every stall is hung with lanterns, and the whole quarter is getting ready for tomorrow’s Lantern Festival.' },
  { img: 'bg-story-2', title: 'The Magpie Crew strike', focus: '50% 35%',
    text: `While the city sleeps, Madame Glint and her Magpie Crew swoop into the temple and snatch the quarter’s five lucky heirlooms: the ${HEIRLOOMS.map(h => h.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}.` },
  { img: 'bg-story-3', title: 'An empty altar', focus: '50% 40%',
    text: 'By morning the altar is bare. No heirlooms, no festival, no luck for the year ahead. The neighbours gather, worried and whispering.' },
  { img: 'bg-story-4', title: 'Dora and Enzo take the case', focus: '50% 45%',
    text: `Two chinchillas with fast paws and a borrowed scooter. ${PEOPLE.kee.name} has a lead in the Night Market. Win back the heirlooms, one district at a time, before the lanterns rise.` },
];
const ENDING: Panel[] = [
  { img: 'bg-end-1', title: 'The heirlooms come home', focus: '50% 40%',
    text: 'All five heirlooms are back on the temple altar. Brother Heron rings the Golden Bell, and the whole quarter cheers.' },
  { img: 'bg-end-2', title: 'The Lantern Festival', focus: '50% 30%',
    text: 'At last the festival begins. Hundreds of sky lanterns drift up over the rooftops, carrying everyone’s wishes for the year ahead.' },
  { img: 'bg-end-3', title: 'Fireworks over Jade Street', focus: '50% 35%',
    text: 'Fireworks burst gold, red and violet over the harbour. Even the Magpie Crew get a front-row seat, on their best behaviour.' },
];

/** keyboard and timing for a run of painted panels */
function usePages(n: number, onDone: () => void) {
  const [i, setI] = useState(0);
  const done = useRef(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  const next = useCallback(() => setI(v => { if (v + 1 >= n) { finish(); return v; } return v + 1; }), [n, finish]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setI(v => Math.max(0, v - 1)); }
    };
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true);
  }, [next, finish]);
  return { i, next, finish };
}

/** floating lantern light (glow dots only, no drawn pictures) */
function Glow({ n = 14 }: { n?: number }) {
  return <div className="jade-story-glow" aria-hidden="true">{Array.from({ length: n }, (_, k) => (
    <i key={k} style={{ left: `${(k * 37) % 100}%`, animationDelay: `${-(k * 1.7) % 11}s`, animationDuration: `${9 + (k % 5) * 2}s`, width: 6 + (k % 4) * 3, height: 6 + (k % 4) * 3 }} />
  ))}</div>;
}

function Pages({ panels, onDone, testid, last }: { panels: Panel[]; onDone: () => void; testid: string; last: string }) {
  const { i, next, finish } = usePages(panels.length, onDone);
  const p = panels[i];
  return (
    <div className="jade-sbook" data-testid={testid} data-page={i} onClick={next} role="dialog" aria-label={p.title}>
      {panels.map((q, k) => (
        <div key={q.img} className={'jade-story-art' + (k === i ? ' on' : '')} aria-hidden={k !== i}>
          <img src={`${ART}${q.img}.webp`} alt="" style={{ objectPosition: q.focus }} draggable={false} />
        </div>
      ))}
      <Glow />
      <button type="button" className="jade-btn plain jade-story-skip" data-testid="jade-story-skip" onClick={e => { e.stopPropagation(); finish(); }}>Skip ›</button>
      <div className="jade-story-cap" onClick={e => e.stopPropagation()}>
        <h2>{p.title}</h2>
        <p>{p.text}</p>
        <div className="jade-story-foot">
          <div className="jade-story-dots" aria-label={`Page ${i + 1} of ${panels.length}`}>{panels.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</div>
          <button type="button" className="jade-btn jade" data-testid="jade-story-next" onClick={next} autoFocus>{i + 1 < panels.length ? 'Next ›' : last}</button>
        </div>
      </div>
    </div>
  );
}

/** the opening storybook for a new game */
export function Storybook({ onDone }: { onDone: () => void }) {
  return <Pages panels={OPENING} onDone={onDone} testid="jade-storybook" last="Begin" />;
}

/** a card between chapters: ch is 1..5 */
export function ChapterCard({ ch, onDone }: { ch: number; onDone: () => void }) {
  const c = Math.max(1, Math.min(5, Math.round(ch)));
  const done = useRef(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  useEffect(() => {
    const t = window.setTimeout(finish, 5200);
    const k = (e: KeyboardEvent) => { if ([' ', 'Enter', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); finish(); } };
    window.addEventListener('keydown', k, true);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', k, true); };
  }, [finish]);
  const opened = c >= 2 ? CHAPTER_OPENS[c - 2] : null;
  const heir = HEIRLOOMS.find(h => h.ch === c);
  return (
    <div className="jade-sbook jade-chapter" data-testid="jade-chapter-card" onClick={finish} role="dialog" aria-label={`Chapter ${c}`}>
      <div className="jade-story-art on"><img src={`${ART}bg-chapter-${c}.webp`} alt="" draggable={false} /></div>
      <Glow n={10} />
      <div className="jade-chapter-cap">
        <div className="jade-chapter-n">Chapter {c}</div>
        <h2>{CHAPTERS[c - 1]}</h2>
        {opened && <p>{DISTRICT_NAME[opened].replace(/^the /, 'The ')} is open.</p>}
        {heir && <p>Find the {heir.name}.</p>}
        <div className="jade-chapter-bar"><span /></div>
      </div>
      <button type="button" className="jade-btn plain jade-story-skip" data-testid="jade-story-skip" onClick={e => { e.stopPropagation(); finish(); }}>Skip ›</button>
    </div>
  );
}

/** the ending panels; hero picks who is named first */
export function Ending({ hero, onDone }: { hero: 'dora' | 'enzo'; onDone: () => void }) {
  const a = hero === 'enzo' ? 'Enzo' : 'Dora', b = hero === 'enzo' ? 'Dora' : 'Enzo';
  const panels = ENDING.map((p, k) => k === 0 ? { ...p, text: `${a} and ${b} did it. ` + p.text } : p);
  return <Pages panels={panels} onDone={onDone} testid="jade-ending" last="Credits ›" />;
}

const CAST = Object.entries(PEOPLE).filter(([id]) => id !== 'dora' && id !== 'enzo');

/** scrolling credits, ending in festival free roam */
export function Credits({ onDone }: { onDone: () => void }) {
  const done = useRef(false);
  const [end, setEnd] = useState(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  useEffect(() => {
    const t = window.setTimeout(() => setEnd(true), 26000);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' || (e.key === 'Enter')) { e.preventDefault(); e.stopPropagation(); finish(); } else if (e.key === ' ') { e.preventDefault(); setEnd(true); } };
    window.addEventListener('keydown', k, true);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', k, true); };
  }, [finish]);
  return (
    <div className="jade-sbook jade-credits" data-testid="jade-credits" role="dialog" aria-label="Credits" onClick={() => setEnd(true)}>
      <div className="jade-story-art on dark"><img src={`${ART}bg-end-2.webp`} alt="" draggable={false} /></div>
      <Glow n={18} />
      <div className={'jade-credits-roll' + (end ? ' end' : '')}>
        <div className="jade-credits-inner">
          <h1>Jade Street</h1>
          <p className="role">Starring</p>
          <p><b>Dora</b>, a cream-white chinchilla</p>
          <p><b>Enzo</b>, a grey chinchilla</p>
          <p className="role">With</p>
          {CAST.map(([id, p]) => <p key={id}><b>{p.name}</b>, {p.who}</p>)}
          <p className="role">Paintings</p><p>Codex</p>
          <p className="role">Code, design and music</p><p>Claude</p>
          <p className="role">Made for</p><p>Dora &amp; Enzo’s Arcade</p>
          <p className="last">The festival goes on. Free roam the city in festival dress.</p>
        </div>
      </div>
      <div className="jade-credits-btns" onClick={e => e.stopPropagation()}>
        <button type="button" className="jade-btn jade big" data-testid="jade-credits-done" onClick={finish}>Continue</button>
      </div>
      <button type="button" className="jade-btn plain jade-story-skip" data-testid="jade-story-skip" onClick={e => { e.stopPropagation(); finish(); }}>Skip ›</button>
    </div>
  );
}
