'use client';
// Jade Street HUD: the hero plaque (portrait, coins, heat lanterns, night clock, district), the job plaque (objective,
// timer, progress, meter), the action prompt, toasts and banners, the dialogue box with portraits, the failure card,
// and the touch controls (a floating stick on the left, Action / Dash / Hop / Sneak on the right). React draws only
// this layer; the city is on the canvas underneath.
import { useEffect, useRef } from 'react';
import { districtAt, DISTRICT_NAME, T } from '@/lib/jade-city';
import { lanterns } from '@/lib/jade-heat';
import { cargoCount } from '@/lib/jade-trade';
import { PEOPLE, MISSION } from '@/lib/jade-story';
import { goals } from '@/lib/jade-medals';
import type { Play } from './controller';
import { Sprite, Icon, fmt, GOOD_ICON } from './ui';
import { GOODS } from '@/lib/jade-trade';

export const clockText = (c: number) => { const m = Math.floor(c) + 19 * 60; const h = Math.floor(m / 60) % 24, mm = m % 60; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const face = (who: string, hero: string) => who === 'dora' || who === 'enzo' ? `face-${who}` : PEOPLE[who]?.face ?? `face-${hero}`;
const nameOf = (who: string) => who === 'dora' ? 'Dora' : who === 'enzo' ? 'Enzo' : PEOPLE[who]?.name ?? who;

export function TopHud({ play, onMap, onPause }: { play: Play; onMap: () => void; onPause: () => void }) {
  const w = play.w, s = w.s, L = lanterns(w);
  const tx = Math.floor(w.p.x / T), ty = Math.floor(w.p.y / T);
  const run = w.run;
  const cargo = cargoCount(s.cargo), cap = w.cap();
  return (
    <>
      <div className="jade-hud-left" data-testid="hud">
        <div className="jade-hero-plaque">
          <span className="jade-face-ring"><Sprite name={`face-${s.hero}`} h={46} w={46} /></span>
          <div className="jade-hero-stats">
            <div className="jade-cash" data-testid="cash"><Icon name="ui-coin" size={20} /> {fmt(s.cash)}</div>
            <div className="jade-lanterns" aria-label={`Heat: ${L} of 5 lanterns`} data-heat={L}>
              {[0, 1, 2, 3, 4].map(i => <Sprite key={i} name={i < L ? 'ui-lantern-on' : 'ui-lantern-off'} h={20} cls={i < L ? 'lit' : ''} />)}
            </div>
          </div>
        </div>
        <div className="jade-where">Night {s.night} · {clockText(s.clock)} · {DISTRICT_NAME[districtAt(tx, ty)].replace(/^the /, '')}</div>
        {cargo > 0 && <div className="jade-cargo" data-testid="cargo">{GOODS.filter(g => s.cargo[g] > 0).map(g => <span key={g}><Icon name={GOOD_ICON[g]} size={18} />{s.cargo[g]}</span>)}<b className={cargo > cap ? 'over' : ''}>{cargo}/{cap}</b></div>}
      </div>
      <div className="jade-hud-right">
        <button type="button" className="jade-round" onClick={onMap} aria-label="Map" data-testid="map-btn"><Icon name="i-map" size={28} /></button>
        <button type="button" className="jade-round" onClick={onPause} aria-label="Pause" data-testid="pause-btn"><span className="jade-pause-glyph" /></button>
      </div>
      {run && (
        <div className="jade-job" data-testid="job">
          <div className="jade-job-title">{run.gig ? 'Side gig' : `Chapter ${run.m.ch}`} · {run.m.title}</div>
          <div className="jade-job-label" data-testid="objective">{run.label || 'Listen'}</div>
          <div className="jade-job-row">
            {run.timer !== null && <span className={'jade-timer' + (run.timer < 10 ? ' low' : '')} data-testid="timer">{Math.ceil(run.timer)}s</span>}
            {run.progress && <span className="jade-progress">{run.progress}</span>}
            {run.meter && <span className={'jade-meter' + (run.meter.bad ? ' bad' : '')}><i>{run.meter.name}</i><b style={{ width: `${Math.round(run.meter.v * 100)}%` }} /></span>}
          </div>
        </div>
      )}
      {!run && w.waypoint && <div className="jade-job small"><div className="jade-job-label">Following your map pin</div></div>}
    </>
  );
}

export function Toasts({ play }: { play: Play }) {
  const w = play.w;
  return (
    <div className="jade-toasts" aria-live="polite">
      {w.banner && !w.failed && !w.ui && <div className="jade-banner" key={w.banner.text}><b>{w.banner.text}</b><span>{w.banner.sub}</span></div>}
      {play.toasts.map(t => <div key={t.id} className={'jade-toast ' + t.kind}>{t.msg}</div>)}
    </div>
  );
}

export function Prompt({ play, touch }: { play: Play; touch: boolean }) {
  const w = play.w, n = w.near;
  if (!n || w.talk || w.ui || w.failed || w.p.act) return null;
  return (
    <button type="button" className={'jade-prompt' + (touch ? ' touch' : '')} data-testid="prompt" onClick={() => play.press('act')}>
      {!touch && <kbd>E</kbd>}<span>{n.label}</span>
      {n.kind === 'mission' && n.id && MISSION[n.id] && <span className="jade-prompt-goals" data-testid="prompt-goals">{goals(MISSION[n.id]).map((g, i) => <em key={g} className={w.s.medals[n.id!] && w.s.medals[n.id!].m > i ? 'got' : ''}>{g}</em>)}</span>}
    </button>
  );
}

export function Dialogue({ play }: { play: Play }) {
  const w = play.w, t = w.talk; if (!t) return null;
  const [who, text] = t.lines[t.i] ?? ['', ''];
  const hero = who === w.s.hero;
  return (
    <div className="jade-talk-wrap" onClick={() => play.advance()} data-testid="dialogue">
      <div className={'jade-talk' + (hero ? ' hero' : '')}>
        <span className="jade-talk-face"><Sprite name={face(who, w.s.hero)} h={96} w={96} /></span>
        <div className="jade-talk-body">
          <div className="jade-talk-name">{nameOf(who)}</div>
          <p>{text}</p>
          <div className="jade-talk-next">{t.i + 1}/{t.lines.length} · tap, Space or E to continue</div>
        </div>
      </div>
    </div>
  );
}

export function FailCard({ play }: { play: Play }) {
  const w = play.w; if (!w.failed) return null;
  return (
    <div className="jade-modal-back">
      <div className="jade-card fail" role="dialog" aria-label="Job failed" data-testid="fail">
        <h2>Not this time</h2>
        <p>{w.failed.reason}</p>
        <div className="jade-card-btns">
          <button type="button" className="jade-btn jade" data-testid="retry" onClick={() => { w.retry(); play.bump(); }}>Retry from checkpoint</button>
          <button type="button" className="jade-btn plain" data-testid="quit-job" onClick={() => { w.quitJob(); play.bump(); }}>Quit the job</button>
        </div>
      </div>
    </div>
  );
}

/** a floating stick on the left half and four buttons on the right */
export function TouchControls({ play }: { play: Play }) {
  const zone = useRef<HTMLDivElement>(null), base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const z = zone.current; if (!z) return;
    let id: number | null = null, ox = 0, oy = 0;
    const R = 56;
    const show = (x: number, y: number, kx: number, ky: number, on: boolean) => {
      const b = base.current, k = knob.current; if (!b || !k) return;
      b.style.opacity = on ? '1' : '0.45'; b.style.left = `${x}px`; b.style.top = `${y}px`;
      k.style.transform = `translate(${kx}px, ${ky}px)`;
    };
    const rest = () => { const r = z.getBoundingClientRect(); show(Math.min(110, r.width * 0.3), r.height - 110, 0, 0, false); };
    rest();
    const down = (e: PointerEvent) => { if (id !== null) return; id = e.pointerId; z.setPointerCapture(e.pointerId); const r = z.getBoundingClientRect(); ox = e.clientX - r.left; oy = e.clientY - r.top; show(ox, oy, 0, 0, true); play.stick.on = true; play.stick.x = play.stick.y = 0; e.preventDefault(); };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return; const r = z.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      const m = Math.min(1, l / R); const n = l > 4 ? [dx / Math.max(1, Math.hypot(dx, dy)), dy / Math.max(1, Math.hypot(dx, dy))] : [0, 0];
      play.stick.x = n[0] * (m < 0.2 ? 0 : m > 0.85 ? 1 : m); play.stick.y = n[1] * (m < 0.2 ? 0 : m > 0.85 ? 1 : m);
      show(ox, oy, dx, dy, true); e.preventDefault();
    };
    const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = null; play.stick.on = false; play.stick.x = play.stick.y = 0; rest(); };
    z.addEventListener('pointerdown', down); z.addEventListener('pointermove', move); z.addEventListener('pointerup', up); z.addEventListener('pointercancel', up); z.addEventListener('lostpointercapture', up);
    window.addEventListener('resize', rest);
    return () => { z.removeEventListener('pointerdown', down); z.removeEventListener('pointermove', move); z.removeEventListener('pointerup', up); z.removeEventListener('pointercancel', up); z.removeEventListener('lostpointercapture', up); window.removeEventListener('resize', rest); };
  }, [play]);
  const w = play.w, riding = !!w.p.ride;
  const btn = (k: 'dash' | 'hop' | 'act', label: string, cls: string, testid: string) => (
    <button type="button" className={'jade-tbtn ' + cls} data-testid={testid} aria-label={label}
      onPointerDown={e => { e.preventDefault(); play.press(k); }} onContextMenu={e => e.preventDefault()}>
      <span>{label}</span>
    </button>
  );
  return (
    <>
      <div className="jade-stick-zone" ref={zone} data-testid="stick"><div className="jade-stick" ref={base}><div className="jade-knob" ref={knob} /></div></div>
      <div className="jade-tbtns">
        {btn('act', w.near ? (w.near.kind === 'exit' ? 'Get off' : w.near.kind === 'ride' ? 'Ride' : 'Action') : 'Action', 'act' + (w.near ? ' ready' : ''), 't-act')}
        {btn('dash', riding ? 'Boost' : 'Dash', 'dash', 't-dash')}
        {btn('hop', riding ? 'Honk' : 'Hop', 'hop', 't-hop')}
        {!riding && <button type="button" className={'jade-tbtn sneak' + (play.touchSneak ? ' on' : '')} data-testid="t-sneak" aria-pressed={play.touchSneak} onPointerDown={e => { e.preventDefault(); play.touchSneak = !play.touchSneak; play.bump(); }}><span>Sneak</span></button>}
      </div>
    </>
  );
}

export function KeyHelp() {
  return <div className="jade-keys" aria-hidden>WASD move · Shift sneak · Space dash/boost · Q hop/honk · E action · M map · Esc pause</div>;
}
