'use client';
// Jade Street: the island's panels. The station's ticket gates (pick a stop on the MRT), the ride view while you
// travel (the painted carriage with the city's lights streaking past the window; any key skips it), the taxi's
// drop-off list, and the Grab taxi app on the phone. The rules live in lib/jade-mrt.ts and lib/jade-taxi.ts.
import { useEffect, useRef } from 'react';
import type { Play } from './controller';
import { Panel } from './panels';
import { Sprite, artUrl } from './ui';
import { destinations, mrtTo, FARE, RIDE_VIEW, routeToStation } from '@/lib/jade-mrt';
import { dropOffs, taxiGo, hail, cantHail, TAXI_APP } from '@/lib/jade-taxi';
import { DISTRICT_NAME, districtAt, T } from '@/lib/jade-city';
import { CABLE_VIEW, FARES, linksOf, routeToStop } from '@/lib/jade-cable';

export function MrtPanel({ play, from, onClose }: { play: Play; from: string; onClose: () => void }) {
  const w = play.w; const st = w.c.isle?.stations.find(s => s.id === from);
  if (!st) return null;
  const go = (id: string) => { w.ui = null; if (!mrtTo(w, id)) play.bump(); else play.bump(); };
  return (
    <Panel title={`${st.name} · the MRT`} onClose={onClose} cls="mrt" testid="mrt">
      <p className="small">Tap your card, pick a stop. {FARE} coins a ride, and your partner rides along. No durians on the train!</p>
      <div className="jade-mrt-line">
        {w.c.isle!.stations.map(s => {
          const here = s.id === from, open = w.open.has(s.d);
          return (
            <button key={s.id} type="button" className={'jade-btn ' + (here ? 'plain' : 'jade')} disabled={here || !open || w.s.cash < FARE} data-testid={`mrt-${s.id}`} onClick={() => go(s.id)}>
              <Sprite name="pin-train" h={28} w={28} /> {s.name}<small>{here ? 'you are here' : open ? DISTRICT_NAME[s.d] : 'under fog'}</small>
            </button>
          );
        })}
      </div>
      {!destinations(w, st).length && <p>No other stations are open yet.</p>}
    </Panel>
  );
}

/** the ride view: a painted carriage with streaks of city light outside; closes itself, or any key / click skips */
export function RideView({ play, from, to, via, onDone }: { play: Play; from: string; to: string; via?: 'cable'; onDone: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  // the page re-renders ten times a second: keep the timer running from the first frame
  const done = useRef(onDone); done.current = onDone;
  void play;
  useEffect(() => {
    let raf = 0; const t0 = performance.now(); let fin = false;
    const end = () => { if (!fin) { fin = true; done.current(); } };
    const f = (now: number) => {
      const t = (now - t0) / 1000; const c = cv.current;
      if (c) {
        const x = c.getContext('2d')!; const W = c.width = c.clientWidth, H = c.height = c.clientHeight;
        x.clearRect(0, 0, W, H); x.globalCompositeOperation = 'lighter';
        // lights streaking past the window (the cable car drifts: the harbour lights slide slowly by)
        if (via !== 'cable') for (let i = 0; i < 26; i++) {
          const y = (i * 37 % 100) / 100 * H * 0.5 + H * 0.06, sp = 900 + (i * 53 % 7) * 220;
          const px = W - ((t * sp + i * 173) % (W + 400));
          const g = x.createLinearGradient(px, 0, px + 220, 0); const hue = [45, 330, 160, 200][i % 4];
          g.addColorStop(0, `hsla(${hue},100%,70%,0)`); g.addColorStop(1, `hsla(${hue},100%,70%,.55)`);
          x.fillStyle = g; x.fillRect(px, y, 220, 3);
        }
        if (via === 'cable') for (let i = 0; i < 40; i++) {
          const y = H * (0.55 + (i * 29 % 40) / 100), px = W - ((t * (60 + (i % 5) * 18) + i * 97) % (W + 40));
          x.fillStyle = `hsla(${[45, 200, 330][i % 3]},100%,75%,.5)`; x.beginPath(); x.arc(px, y, 2 + (i % 3), 0, Math.PI * 2); x.fill();
        }
      }
      if (t > (via === 'cable' ? CABLE_VIEW : RIDE_VIEW)) end(); else raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    const k = (e: KeyboardEvent) => { e.preventDefault(); end(); };
    window.addEventListener('keydown', k);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', k); };
  }, []);
  return (
    <div className="jade-ride-view" data-testid="ride-view" onClick={onDone}>
      <img src={artUrl(`bg-${via === 'cable' ? 'cable' : 'mrt'}-ride`)} alt="" draggable={false} />
      <canvas ref={cv} className="jade-ride-streaks" />
      <div className="jade-ride-sign"><Sprite name={via === 'cable' ? 'i-cable' : 'i-mrt'} h={40} w={40} /><span>{from} <b>›</b> {to}</span><small>Press any key to skip</small></div>
    </div>
  );
}

export function TaxiPanel({ play, onClose }: { play: Play; onClose: () => void }) {
  const w = play.w; const list = dropOffs(w);
  return (
    <Panel title={`${TAXI_APP} · where to?`} onClose={onClose} cls="taxi" testid="taxi">
      <p className="small">The taxi drives you there (E skips the ride). You have {Math.floor(w.s.cash)} coins.</p>
      <div className="jade-taxi-list">
        {list.map(d => <button key={d.id} type="button" className="jade-btn jade" disabled={w.s.cash < d.fare} data-testid={`taxi-${d.id}`} onClick={() => { taxiGo(w, d.id); play.bump(); }}>{d.name}<small>{d.fare} coins</small></button>)}
      </div>
    </Panel>
  );
}

/** the taxi app on the phone: book a taxi to where you stand */
/** the phone's MRT tab: every station, where it is, and a button that draws the gold route line to it */
export function JadeLineTab({ play, onClose }: { play: Play; onClose: () => void }) {
  const w = play.w; const sts = w.c.isle?.stations ?? [];
  const near = sts.filter(s => w.open.has(s.d)).sort((a, b) => Math.hypot(a.x - w.p.x, a.y - w.p.y) - Math.hypot(b.x - w.p.x, b.y - w.p.y))[0];
  return (
    <div className="jade-line-tab" data-testid="mrt-tab">
      <p className="small"><Sprite name="i-mrt" h={28} w={28} /> The MRT runs Beach (Sentosa), Chinatown, Raffles Place, Bayfront, Bugis, Little India and Toa Payoh. Walk up to a station’s gates and press E: {FARE} coins a ride.{near ? ` Nearest: ${near.name}.` : ''}</p>
      <ul className="jade-line-list">{sts.map(s => {
        const open = w.open.has(s.d);
        return (
          <li key={s.id}>
            <Sprite name="pin-train" h={32} w={32} />
            <span><b>{s.name}</b><small>{open ? DISTRICT_NAME[s.d] : 'under fog: follow the story'}</small></span>
            <button type="button" className="jade-btn jade" disabled={!open || !!w.run} data-testid={`mrt-route-${s.id}`} onClick={() => { if (routeToStation(w, s.id)) { onClose(); play.bump(); } }}>Route me</button>
          </li>
        );
      })}</ul>
      {w.c.east && <>
        <p className="small"><Sprite name="i-cable" h={28} w={28} /> Over the water to Sentosa: the cable car from HarbourFront ({FARES.cable} coins), the ferry from Marina Bay ({FARES.ferry} coins), or walk the boardwalk.</p>
        <ul className="jade-line-list">{linksOf(w).flatMap(l => l.stops.map(s => {
          const open = w.open.has(districtAt(Math.floor(s.x / T), Math.floor(s.y / T)));
          return (
            <li key={s.id}>
              <Sprite name={l.id === 'cable' ? 'pin-cable' : 'pin-ferry'} h={32} w={32} />
              <span><b>{s.name}</b><small>{open ? (l.id === 'cable' ? 'cable car' : 'ferry pier') : 'under fog: follow the story'}</small></span>
              <button type="button" className="jade-btn jade" disabled={!open || !!w.run} data-testid={`link-route-${s.id}`} onClick={() => { if (routeToStop(w, s.id)) { onClose(); play.bump(); } }}>Route me</button>
            </li>
          );
        }))}</ul>
      </>}
      {w.run && <p className="small">Finish the job first: the route line is busy with it.</p>}
    </div>
  );
}

export function TaxiApp({ play, onClose }: { play: Play; onClose: () => void }) {
  const w = play.w; const why = cantHail(w);
  return (
    <div className="jade-taxi-app" data-testid="taxi-app">
      <Sprite name="i-taxiapp" h={56} w={56} />
      <div><b>{TAXI_APP}</b><p className="small">{why ?? 'A taxi comes to you, then drives you anywhere in the open districts.'}</p></div>
      <button type="button" className="jade-btn jade" disabled={!!why} data-testid="taxi-book" onClick={() => { if (hail(w, true)) onClose(); play.bump(); }}>Book a taxi</button>
    </div>
  );
}
