'use client';
// Jade Street: the panels and HUD pieces of the job steps (lib/jade-jobs.ts). The heist's two approach cards (quiet or
// loud, with what your casing found out), a witness's three questions and their answer, and the clue notebook and
// intel badges beside the job box. Keys: 1 / 2 (or ← →, Enter) pick an approach; 1 / 2 / 3 ask; E, Space or Enter close.
import { useEffect } from 'react';
import type { Play } from './controller';
import { Panel } from './panels';
import { Sprite } from './ui';
import { INTEL } from '@/lib/jade-jobs';
import type { Intel } from '@/lib/jade-story';

const INTEL_ICON: Record<Intel, string> = { door: 'i-key', rota: 'ui-watch', cam: 'i-camera', safe: 'i-dial' };

export function HeistPanel({ play }: { play: Play }) {
  const w = play.w, run = w.run, st = run?.cur;
  const pick = (m: 'quiet' | 'loud') => { w.run?.heistPick(m); play.bump(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === 'ArrowLeft' || e.key === 'q') { e.preventDefault(); e.stopPropagation(); pick('quiet'); }
      else if (e.key === '2' || e.key === 'ArrowRight' || e.key === 'l') { e.preventDefault(); e.stopPropagation(); pick('loud'); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  if (!run || !st || st.t !== 'heist') return null;
  const has = (i: Intel) => run.intel.includes(i);
  const mate = w.mate.who === 'dora' ? 'Dora' : 'Enzo';
  return (
    <Panel title="How do we do it?" onClose={() => { w.ui = null; play.bump(); }} cls="heist" testid="heist">
      <div className="jade-heist-cards">
        <button type="button" className="jade-heist-card quiet" data-testid="heist-quiet" onClick={() => pick('quiet')}>
          <Sprite name="card-quiet" h={250} w={182} />
          <b>Quiet <kbd>1</kbd></b>
          <span>Sneak past the guards and cameras, crack the safe, slip out the way you came. No heat if nobody sees you.</span>
          <small>{has('door') ? 'The back door is open to you.' : 'In by the front: the back door is locked (not cased).'}{has('cam') ? ' Cameras off.' : ''}</small>
        </button>
        <button type="button" className="jade-heist-card loud" data-testid="heist-loud" onClick={() => pick('loud')}>
          <Sprite name="card-loud" h={250} w={182} />
          <b>Loud <kbd>2</kbd></b>
          <span>{mate} fires the confetti cannon at the front. The guards see stars: race to the safe before the timer runs out, then ride off with heat on your tail.</span>
          <small>{has('rota') ? 'You know their beats: they stay dazed longer.' : 'Quick: the daze wears off.'}</small>
        </button>
      </div>
      <IntelRow intel={run.intel} />
    </Panel>
  );
}

export function IntelRow({ intel }: { intel: Intel[] }) {
  return (
    <div className="jade-intel" data-testid="intel">
      {(Object.keys(INTEL) as Intel[]).map(i => (
        <span key={i} className={intel.includes(i) ? 'got' : ''} title={INTEL[i].gain}><Sprite name={INTEL_ICON[i]} h={24} w={24} />{INTEL[i].what}</span>
      ))}
    </div>
  );
}

export function AskPanel({ play }: { play: Play }) {
  const w = play.w, run = w.run, ui = w.ui, st = run?.cur;
  const close = () => { w.run?.askClose(); play.bump(); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!ui || ui.kind !== 'ask') return;
      if (!ui.said && /^[1-3]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); w.run?.askPick(+e.key - 1); play.bump(); }
      else if (ui.said && [' ', 'Enter', 'e', 'E'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  });
  if (!run || !st || st.t !== 'detective' || !ui || ui.kind !== 'ask') return null;
  const wi = st.witnesses[ui.i];
  return (
    <Panel title={`Ask the ${wi.name}`} onClose={close} cls="ask" testid="ask">
      <div className="jade-ask">
        <Sprite name={`folk-${wi.sp}-down`} h={96} w={70} />
        {!ui.said ? (
          <div className="jade-ask-q">
            <p className="small">Pick your question carefully: the wrong one wastes time.</p>
            {wi.ask.map((q, i) => <button key={i} type="button" className="jade-btn jade" data-testid={`ask-${i}`} onClick={() => { w.run?.askPick(i); play.bump(); }}><kbd>{i + 1}</kbd> {q}</button>)}
          </div>
        ) : (
          <div className="jade-ask-a" data-testid="ask-answer">
            <p className={ui.ok ? 'good' : 'bad'}>“{ui.said}”</p>
            {ui.ok ? <p className="small"><Sprite name="i-clue" h={22} w={22} /> Clue written in your notebook.</p> : <p className="small">Not much use. Try them again with a better question.</p>}
            <button type="button" className="jade-btn gold" data-testid="ask-ok" onClick={close}>Okay <kbd>E</kbd></button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** beside the job box: the clue notebook in a detective step, what casing found out in a heist */
export function JobNotes({ play }: { play: Play }) {
  const run = play.w.run, st = run?.cur;
  if (!run || !st) return null;
  if (st.t === 'detective' && run.notes.length) return (
    <div className="jade-notes" data-testid="notes"><b><Sprite name="i-clue" h={20} w={20} /> Notebook</b>{run.notes.map((n, i) => <span key={i}>{n}</span>)}</div>
  );
  if ((st.t === 'heist' || st.t === 'case') && run.intel.length) return <div className="jade-notes"><IntelRow intel={run.intel} /></div>;
  return null;
}
