'use client';
// Jade Street extras: the painted loading screen (every atlas and texture decoded before the world draws, with a
// retry), the lesson hints with the right key or button, the little phone with texts from contacts, the ride radio,
// the jobs book (every story job by chapter, and the Hawker Tales, with medals, goals and replay) and the controls page.
import { useEffect, useState } from 'react';
import { loadArt, preloadPic, picReady, STORY_FIRST } from '@/lib/jade-scene';
import { lesson } from '@/lib/jade-tutor';
import { tagOption } from '@/lib/jade-tag';
import { TaxiApp, JadeLineTab } from './isle';
import { EmpirePage } from './empire';
import { ContractsTab } from './contracts';
import { contractsOpen } from '@/lib/jade-contracts';
import { TAXI_APP } from '@/lib/jade-taxi';
import { unread, readAll } from '@/lib/jade-phone';
import { MISSIONS, MISSION, SIDE, CHAPTERS, PEOPLE, jobCounts } from '@/lib/jade-story';
import { offered } from '@/lib/jade-save';
import { T, streetAt, districtAt, DISTRICT_NAME } from '@/lib/jade-city';
/** where a job's giver is, as a street (or district) name */
export function placeName(w: Play['w'], at: string) { const pl = w.c.places[at]; if (!pl) return ''; const x = Math.floor(pl.x / T), y = Math.floor(pl.y / T); return pl.name && pl.kind !== 'contact' ? pl.name : streetAt(x, y) ?? DISTRICT_NAME[districtAt(x, y)].replace(/^the /, 'The '); }
import { FinesList, Glossary } from './sg';
import { MEDAL_NAME, MEDAL_SPRITE, goals, fmtTime } from '@/lib/jade-medals';
import type { Play } from './controller';
import type { JadeSound } from './sound';
import { Sprite, Btn, ART, artUrl } from './ui';
import './extras.css';

// ── loading: the eager paintings before the title (lib/jade-load.ts), then the same lanterns over the street whenever
// the world waits for a district's paintings (a ride across the island, a job, a mini-game)
function LoaderCard({ pct, err, onRetry, testid = 'jade-loading', over }: { pct: number; err?: string; onRetry?: () => void; testid?: string; over?: boolean }) {
  const lit = Math.round(pct * 10);
  return (
    <section className={'jade-loading' + (over ? ' over' : '')} data-testid={testid} style={{ backgroundImage: `url(${artUrl('bg-loading')})` }}>
      <div className="jade-loading-card">
        <h1>Jade Street</h1>
        {!err && <>
          <div className="jade-loading-lanterns" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Loading the paintings">
            {Array.from({ length: 10 }, (_, i) => <img key={i} src={artUrl(`ui-lantern-${i < lit ? 'on' : 'off'}`)} alt="" />)}
          </div>
          <p>Lighting the lanterns… {Math.round(pct * 100)}%</p>
        </>}
        {err && <div className="jade-loading-err" data-testid="jade-loading-error">
          <p>Some of the paintings did not arrive. Check your connection and try again.</p>
          <Btn kind="gold" testid="jade-loading-retry" onClick={onRetry}>Try again</Btn>
        </div>}
      </div>
    </section>
  );
}
export function Loader({ onReady, story = false }: { onReady: () => void; story?: boolean }) {
  const [pct, setPct] = useState(0); const [err, setErr] = useState(''); const [tries, setTries] = useState(0);
  useEffect(() => {
    let live = true; setErr('');
    // a new game also waits for the opening storybook's first painting (pass 13: it showed black for seconds)
    let pic = !story || picReady(STORY_FIRST), dn = 0, nn = 1;
    const show = () => { if (live) setPct((dn + (pic ? 1 : 0)) / (nn + 1)); };
    const first = story ? preloadPic(STORY_FIRST).then(ok => { pic = true; show(); if (!ok) throw new Error('Could not load: ' + STORY_FIRST); }) : Promise.resolve();
    Promise.all([loadArt(ART, (d, n) => { dn = d; nn = n || 1; show(); }), first]).then(() => { if (live) onReady(); }).catch((e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [tries, onReady, story]);
  return <LoaderCard pct={pct} err={err} onRetry={() => setTries(t => t + 1)} />;
}
/** the street waiting for a district's paintings: the lanterns over it after a quarter of a second */
export function ArtWait({ play }: { play: Play }) {
  const a = play.artWait; if (!a || a.t < 0.25) return null;
  return <LoaderCard pct={a.total ? a.done / a.total : 1} testid="jade-art-wait" over />;
}

// ── a key cap or a touch button, for hints and the controls page
const KeyCap = ({ k }: { k: string }) => <span className="jade-cap"><Sprite name={k.length > 1 ? 'c-space' : 'c-key'} h={30} w={k.length > 1 ? 70 : 30} /><b>{k}</b></span>;
export function Hint({ play, touch }: { play: Play; touch: boolean }) {
  const w = play.w; const l = lesson(w.tutor.cur);
  // the lesson hint steps aside while a banner or an important toast is up (lib/jade-notice.ts)
  if (!l || w.talk || w.ui || w.failed || play.notices.busy || w.banner) return null;
  // and for the E prompt it is about (the gates, a cable car station, a pier, a job's giver), so it never covers it
  if (w.near && ['station', 'cable', 'ferry', 'mission'].includes(w.near.kind)) return null;
  // and for a job's own F move
  if (w.run) { const o = tagOption(w); if (o && o.kind !== 'wait' && o.kind !== 'call') return null; }
  return (
    <div className="jade-hint" data-testid="jade-hint" data-lesson={l.id}>
      <span className="jade-hint-keys">
        {touch ? (l.touch ? <span className="jade-tbtn-mini">{l.touch === 'stick' ? <Sprite name="c-stick" h={34} w={34} /> : l.touch === 'map' ? <Sprite name="i-map" h={28} w={28} /> : l.touch}</span> : null)
          : l.keys.map(k => <KeyCap key={k} k={k} />)}
      </span>
      <span>{touch ? l.text : l.kbText ?? l.text}</span>
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
  const [tab, setTab] = useState<'msgs' | 'fines' | 'lingo' | 'taxi' | 'mrt' | 'empire' | 'con'>(w.emp.raid ? 'empire' : 'msgs');
  const TABS: [typeof tab, string][] = [['msgs', 'Messages'], ['con', !contractsOpen(w.s) ? 'Contracts' : w.s.contracts.contest ? 'Contracts (retake!)' : 'Contracts (3)'], ['fines', `Fines (${w.s.fines.n})`], ['empire', w.emp.raid ? 'Empire (raid!)' : 'Empire'], ['lingo', 'Kopi lingo'], ...(w.c.isle ? [['mrt', 'MRT'] as [typeof tab, string]] : []), ['taxi', TAXI_APP]];
  return (
    <div className="jade-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="jade-panel phone" role="dialog" aria-label="Phone" data-testid="jade-phone-msgs">
        <div className="jade-panel-head"><h2>Phone</h2><button type="button" className="jade-x" aria-label="Close" data-testid="close" onClick={onClose}>×</button></div>
        <div className="jade-book-tabs" role="tablist">{TABS.map(([k, n]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={'jade-tab' + (tab === k ? ' on' : '')} data-testid={`phone-${k}`} onClick={() => setTab(k)}>{n}</button>)}</div>
        <div className="jade-panel-body">
          {tab === 'msgs' && !msgs.length && <p>No texts yet. Your contacts text job offers, market tips and calls for help.</p>}
          {tab === 'msgs' && msgs.map(m => (
            <div key={m.id} className="jade-text-msg"><Sprite name={PEOPLE[m.from]?.face ?? 'face-kee'} h={40} w={40} /><p><b>{PEOPLE[m.from]?.name ?? m.from}</b> <small>night {m.night}</small><br />{m.text}</p>
              {m.job && offered(w.s).some(x => x.id === m.job) && !w.run && <Btn kind="gold" testid={`msg-route-${m.job}`} onClick={() => { const pl = w.c.places[MISSION[m.job!].at]; if (pl) { w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); play.bump(); onClose(); } }}>Route me</Btn>}</div>
          ))}
          {tab === 'fines' && <FinesList play={play} />}
          {tab === 'empire' && <EmpirePage play={play} onClose={onClose} />}
          {tab === 'con' && <ContractsTab play={play} onClose={onClose} />}
          {tab === 'taxi' && <TaxiApp play={play} onClose={onClose} />}
          {tab === 'mrt' && <JadeLineTab play={play} onClose={onClose} />}
          {tab === 'lingo' && <><p className="small">Order like a local. Uncle Teo calls the drinks this way at his kopi counter.</p><Glossary /></>}
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
export function JobsBook({ play, onReplay, onRoute }: { play: Play; onReplay: (id: string) => void; onRoute?: () => void }) {
  const s = play.w.s, w = play.w, on = offered(s).map(m => m.id);
  const route = (id: string) => { const pl = w.c.places[MISSION[id].at]; if (!pl) return; w.waypoint = [pl.x, pl.y]; w.routeT = 0; w.updateRoute(); play.bump(); onRoute?.(); }; // ch 0 is the Hawker Tales tab; 1 to CHAPTERS.length are the chapters
  const [ch, setCh] = useState(() => Math.max(1, Math.min(CHAPTERS.length, MISSIONS.find(m => !s.done.includes(m.id))?.ch ?? CHAPTERS.length)));
  const n = jobCounts(s);
  const list = ch === 0 ? SIDE : MISSIONS.filter(m => m.ch === ch);
  return (
    <div className="jade-book" data-testid="jade-jobs">
      <p className="jade-book-sum"><Sprite name="ui-medal-gold" h={24} w={24} /> {n.gold} gold · {n.marks}/{n.marksAll} marks · {n.story}/{n.storyAll} jobs · {n.tales}/{n.talesAll} Hawker Tales{n.contracts ? <> · <span data-testid="jade-jobs-con">{n.contracts} contract{n.contracts === 1 ? '' : 's'} ({n.contractKinds} kinds{n.retaken ? `, ${n.retaken} retake${n.retaken === 1 ? '' : 's'}` : ''})</span></> : null}</p>
      <div className="jade-book-tabs" role="tablist">
        {CHAPTERS.map((c, i) => <button key={c} type="button" role="tab" aria-selected={ch === i + 1} className={'jade-tab' + (ch === i + 1 ? ' on' : '')} data-testid={`jade-jobs-ch${i + 1}`} onClick={() => setCh(i + 1)}>{i + 1}. {c}</button>)}
        <button type="button" role="tab" aria-selected={ch === 0} className={'jade-tab' + (ch === 0 ? ' on' : '')} data-testid="jade-jobs-side" onClick={() => setCh(0)}>Hawker Tales</button>
      </div>
      <ol className="jade-book-list">
        {list.map(m => {
          const md = s.medals[m.id], done = s.done.includes(m.id), p = PEOPLE[m.giver];
          return (
            <li key={m.id} data-testid={`jade-job-${m.id}`} className={done ? 'done' : ''}>
              <Sprite name={done ? MEDAL_SPRITE[md?.m ?? 0] : 'ui-medal-none'} h={44} w={44} title={done ? MEDAL_NAME[md?.m ?? 0] : 'Not done yet'} />
              <div className="jade-book-job">
                <b>{done || on.includes(m.id) || (m.side ? s.done.includes(m.side) : n.story >= MISSIONS.indexOf(m)) ? m.title : '???'}</b>
                {on.includes(m.id) && !done && <small className="jade-book-where">On offer now · {p?.name ?? m.giver}, {placeName(w, m.at)}</small>}
                {m.side && !done && !s.done.includes(m.side) && <small>Opens after “{MISSIONS.find(x => x.id === m.side)?.title}”</small>}
                <small>{p?.name ?? m.giver}{md?.t ? ` · best ${fmtTime(md.t)}` : ''}{md ? ` · played ${md.plays}×` : ''}</small>
                <span className="jade-goals">{goals(m).map(g => <em key={g}>{g}</em>)}</span>
              </div>
              {done && <Btn kind="jade" testid={`jade-replay-${m.id}`} disabled={!!play.w.run} onClick={() => onReplay(m.id)}>Replay</Btn>}
              {!done && on.includes(m.id) && <Btn kind="gold" testid={`jade-route-${m.id}`} disabled={!!play.w.run} onClick={() => route(m.id)}>Route me</Btn>}
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
    ['Phone messages, the MRT tab, the taxi app', ['T'], 'ui-phone', 'Phone button'],
    ['Ride the MRT: walk up to a station’s gates (the green train pin)', ['E'], 'i-mrt', 'Action button'],
    ['Hail a taxi at the kerb, then get in', ['G', 'E'], 'pin-taxi', 'The taxi app on the phone'],
    ['Ride the cable car or the ferry to Sentosa: walk up to the station or the pier', ['E'], 'i-cable', 'Action button'],
    ['Festivals and the beach: light a lamp, buy a kuih, shoo a mynah, a deck chair, a sandcastle', ['E'], 'i-festival', 'Action button'],
    ['Katong, Changi and Orchard Road: hire a bike at East Coast Park, slurp a laksa, hang a bauble, fly a kite, wave at a plane', ['E'], 'i-bike', 'Action button'],
    ['West of Chinatown: chwee kueh and the bird corner in Tiong Bahru, the Slingshot at Clarke Quay, the koi, the telescope and a lantern walk in Jurong', ['E'], 'i-rabbit', 'Action button'],
    ['Your empire: buy, upgrade and repair properties, hire a jaga, take an empire job (walk up to one)', ['E'], 'i-empire', 'Action button'],
    ['The Empire tab: rank, ledger, raids, send your partner round the tills', ['T'], 'i-ledger', 'Phone button'],
    ['Contracts (after chapter six): the Contracts tab, Route me, then talk to the giver', ['T', 'E'], 'pin-job', 'Phone button'],
    ['Switch hero (Dora or Enzo)', ['Tab'], 'face-dora', 'Tap the partner’s portrait'],
    ['Tag-team move: boost, grab, pounce, hold, distract', ['F'], 'c-tap', 'Tap the green prompt'],
    ['Aim and fire a gadget', ['Mouse', 'Click'], 'g-sling', 'Desktop only'],
    ['Change gadget · reload', ['1', '2', 'X'], 'satchel', 'Tap a gadget slot'],
    ['Player 2 (from the pause menu)', ['←↑↓→', '/', '.', ',', ';'], 'face-enzo', 'A gamepad works too'],
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
