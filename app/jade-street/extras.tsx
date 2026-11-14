'use client';
// Jade Street extras: the painted loading screen (every atlas and texture decoded before the world draws, with a
// retry), the lesson hints with the right key or button, the little phone with texts from contacts, the ride radio,
// the jobs book (all 25 jobs by chapter with medals, goals and replay) and the controls page.
import { useEffect, useState } from 'react';
import { loadArt } from '@/lib/jade-scene';
import { lesson } from '@/lib/jade-tutor';
import { unread, readAll } from '@/lib/jade-phone';
import { MISSIONS, CHAPTERS, PEOPLE } from '@/lib/jade-story';
import { MEDAL_NAME, MEDAL_SPRITE, goals, fmtTime } from '@/lib/jade-medals';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Btn, ART } from './ui';
import './extras.css';

// ── loading
export function Loader({ onReady }: { onReady: () => void }) {
  const [pct, setPct] = useState(0); const [err, setErr] = useState(''); const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true; setErr('');
    loadArt(ART, (d, n) => { if (live) setPct(n ? d / n : 1); }).then(() => { if (live) onReady(); }).catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [tries, onReady]);
  const lit = Math.round(pct * 10);
  return (
    <section className="jade-loading" data-testid="jade-loading" style={{ backgroundImage: `url(${ART}bg-loading.webp)` }}>
      <div className="jade-loading-card">
        <h1>Jade Street</h1>
        {!err && <>
          <div className="jade-loading-lanterns" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Loading the paintings">
            {Array.from({ length: 10 }, (_, i) => <img key={i} src={`${ART}ui-lantern-${i < lit ? 'on' : 'off'}.webp`} alt="" />)}
          </div>
          <p>Lighting the lanterns… {Math.round(pct * 100)}%</p>
        </>}
        {err && <div className="jade-loading-err" data-testid="jade-loading-error">
          <p>Some of the paintings did not arrive. Check your connection and try again.</p>
          <Btn kind="gold" testid="jade-loading-retry" onClick={() => setTries(t => t + 1)}>Try again</Btn>
        </div>}
      </div>
    </section>
  );
}

// ── a key cap or a touch button, for hints and the controls page
const KeyCap = ({ k }: { k: string }) => <span className="jade-cap"><Sprite name={k.length > 1 ? 'c-space' : 'c-key'} h={30} w={k.length > 1 ? 70 : 30} /><b>{k}</b></span>;
export function Hint({ play, touch }: { play: Play; touch: boolean }) {
  const w = play.w; const l = lesson(w.tutor.cur);
  if (!l || w.talk || w.ui || w.failed) return null;
  return (
    <div className="jade-hint" data-testid="jade-hint" data-lesson={l.id}>
      <span className="jade-hint-keys">
        {touch ? (l.touch ? <span className="jade-tbtn-mini">{l.touch === 'stick' ? <Sprite name="c-stick" h={34} w={34} /> : l.touch === 'map' ? <Sprite name="i-map" h={28} w={28} /> : l.touch}</span> : null)
          : l.keys.map(k => <KeyCap key={k} k={k} />)}
      </span>
      <span>{l.text}</span>
    </div>
  );
}

// ── the phone
export function PhoneHud({ play, onOpen }: { play: Play; onOpen: () => void }) {
  const w = play.w; const n = unread(w); const last = w.s.msgs[w.s.msgs.length - 1];
  const fresh = last && !last.read && w.phoneT > 0;
  return (
    <>
      <button type="button" className="jade-phone-btn" data-testid="jade-phone" aria-label={`Phone, ${n} unread`} onClick={onOpen}>
        <Sprite name="ui-phone" h={40} w={40} />{n > 0 && <b className="jade-badge">{n}</b>}
      </button>
      {fresh && <div className="jade-phone-pop" data-testid="jade-phone-pop"><Sprite name={PEOPLE[last.from]?.face ?? 'face-kee'} h={34} w={34} /><span><b>{PEOPLE[last.from]?.name ?? last.from}</b> {last.text.length > 90 ? last.text.slice(0, 88) + '…' : last.text}</span></div>}
    </>
  );
}
export function PhoneView({ play, onClose }: { play: Play; onClose: () => void }) {
  const w = play.w;
  useEffect(() => { readAll(w); play.bump(); }, [w, play]);
  const msgs = w.s.msgs.slice().reverse();
  return (
    <div className="jade-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jade-panel phone" role="dialog" aria-label="Messages" data-testid="jade-phone-msgs">
        <div className="jade-panel-head"><h2>Messages</h2><button type="button" className="jade-x" aria-label="Close" data-testid="close" onClick={onClose}>×</button></div>
        <div className="jade-panel-body">
          {!msgs.length && <p>No texts yet. Your contacts text job offers, market tips and calls for help.</p>}
          {msgs.map(m => (
            <div key={m.id} className="jade-text-msg"><Sprite name={PEOPLE[m.from]?.face ?? 'face-kee'} h={40} w={40} /><p><b>{PEOPLE[m.from]?.name ?? m.from}</b> <small>night {m.night}</small><br />{m.text}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── the ride radio
export function RadioHud({ play, snd }: { play: Play; snd: JadeSound | null }) {
  const w = play.w; const kind = w.p.ride?.kind ?? null;
  if (!kind || !snd) return null;
  const name = snd.stationName(kind, w.s.radio);
  return (
    <button type="button" className="jade-radio" data-testid="jade-radio" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); switchStation(play, snd); }} title="Change station (R)">
      <Sprite name="ui-radio" h={32} w={32} /><span>{name}</span>
    </button>
  );
}
export function switchStation(play: Play, snd: JadeSound | null) {
  if (!snd || !play.w.p.ride) return;
  const n = snd.stations(play.w.p.ride.kind).length;
  play.w.s.radio = (play.w.s.radio + 1) % n;
  const name = snd.station(play.w.s.radio);
  play.toast(`Radio: ${name}`, ''); play.bump();
}

// ── the jobs book
export function JobsBook({ play, onReplay }: { play: Play; onReplay: (id: string) => void }) {
  const s = play.w.s; const [ch, setCh] = useState(() => Math.max(1, Math.min(5, MISSIONS.find(m => !s.done.includes(m.id))?.ch ?? 5)));
  const total = MISSIONS.reduce((a, m) => a + (s.medals[m.id]?.m ?? 0), 0);
  return (
    <div className="jade-book" data-testid="jade-jobs">
      <p className="jade-book-sum"><Sprite name="ui-medal-gold" h={24} w={24} /> {MISSIONS.filter(m => s.medals[m.id]?.m === 3).length} gold · {total}/75 marks · {s.done.length}/25 jobs</p>
      <div className="jade-book-tabs" role="tablist">
        {CHAPTERS.map((c, i) => <button key={c} type="button" role="tab" aria-selected={ch === i + 1} className={'jade-tab' + (ch === i + 1 ? ' on' : '')} data-testid={`jade-jobs-ch${i + 1}`} onClick={() => setCh(i + 1)}>{i + 1}. {c}</button>)}
      </div>
      <ol className="jade-book-list">
        {MISSIONS.filter(m => m.ch === ch).map(m => {
          const md = s.medals[m.id], done = s.done.includes(m.id), p = PEOPLE[m.giver];
          return (
            <li key={m.id} data-testid={`jade-job-${m.id}`} className={done ? 'done' : ''}>
              <Sprite name={done ? MEDAL_SPRITE[md?.m ?? 0] : 'ui-medal-none'} h={44} w={44} title={done ? MEDAL_NAME[md?.m ?? 0] : 'Not done yet'} />
              <div className="jade-book-job">
                <b>{done || s.done.length >= MISSIONS.indexOf(m) ? m.title : '???'}</b>
                <small>{p?.name ?? m.giver}{md?.t ? ` · best ${fmtTime(md.t)}` : ''}{md ? ` · played ${md.plays}×` : ''}</small>
                <span className="jade-goals">{goals(m).map(g => <em key={g}>{g}</em>)}</span>
              </div>
              {done && <Btn kind="jade" testid={`jade-replay-${m.id}`} disabled={!!play.w.run} onClick={() => onReplay(m.id)}>Replay</Btn>}
            </li>
          );
        })}
      </ol>
      <p className="small">Each mark is a medal step: one for bronze, two for silver, all three for gold. A replay pays a quarter of the reward and keeps your best medal.</p>
    </div>
  );
}

// ── the controls page
export function Controls({ touch }: { touch: boolean }) {
  const rows: [string, string[], string, string][] = [
    ['Move', ['W', 'A', 'S', 'D'], 'c-stick', 'Drag on the left side'],
    ['Run', ['W', 'A', 'S', 'D'], 'c-stick', 'Drag all the way'],
    ['Sneak', ['Shift'], 'c-hide', 'Sneak button'],
    ['Dash · boost when riding', ['Space'], 'c-boost', 'Dash button'],
    ['Hop · honk when riding', ['Q'], 'c-horn', 'Hop button'],
    ['Action: talk, ride, trade, hide', ['E'], 'c-tap', 'Action button'],
    ['Change radio station', ['R'], 'ui-radio', 'Tap the radio'],
    ['Map', ['M'], 'i-map', 'Map button, top right'],
    ['Phone messages', ['T'], 'ui-phone', 'Phone button'],
    ['Pause, jobs book, settings', ['Esc'], 'c-heat', 'Pause button'],
  ];
  return (
    <div className="jade-controls" data-testid="jade-controls">
      <table className="jade-goods"><thead><tr><th>Do</th><th>{touch ? 'Touch' : 'Keyboard'}</th><th>{touch ? 'Keyboard' : 'Touch'}</th></tr></thead>
        <tbody>{rows.map(([what, keys, ico, t]) => {
          const kb = <span className="jade-caps">{keys.map(k => <KeyCap key={k} k={k} />)}</span>;
          const tc = <span className="jade-caps"><Sprite name={ico} h={30} w={30} /> {t}</span>;
          return <tr key={what}><td>{what}</td><td>{touch ? tc : kb}</td><td>{touch ? kb : tc}</td></tr>;
        })}</tbody>
      </table>
      <p className="small">Arrow keys move too. Heat: when lanterns light up, the wardens are after you. Break their line of sight, hide in a bead curtain or swap jackets at a safe house. On Normal and Hard, a warden also notices a ride that runs a red light.</p>
    </div>
  );
}
