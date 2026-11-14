'use client';
// Jade Street panels: the market stall (prices, cargo, tips and the haggle needle), the safe house (jacket swap,
// sleep, stash, wardrobe, switching heroes, buying the house), the garage (upgrades and paint), the full map with
// pins and a waypoint, and the pause menu with settings, trophies, stats, the daily event and a new-game confirm.
import { useEffect, useRef, useState } from 'react';
import { GOODS, GOOD, cargoCount, haggleZone, haggleResult, needle, bestRoute, type Good } from '@/lib/jade-trade';
import { DISTRICTS, DISTRICT_NAME, T, W, H, type District } from '@/lib/jade-city';
import { OUTFITS, PAINTS, UPGRADE_COST, SAFE_HOUSES, TROPHIES, buyUpgrade, buyPaint, buyOutfit, buySafe, safeOpen, available, DAILY_NEED, type Save } from '@/lib/jade-save';
import { VEHICLES } from '@/lib/jade-move';
import { MISSIONS, HEIRLOOMS, CHAPTERS } from '@/lib/jade-story';
import { lanterns } from '@/lib/jade-heat';
import type { Play } from './controller';
import { Sprite, Icon, Btn, fmt, GOOD_ICON, ART } from './ui';
import type { JadeSound } from './sound';

const dName = (d: District) => DISTRICT_NAME[d].replace(/^the /, 'The ');

function Panel({ title, onClose, children, cls = '', testid }: { title: string; onClose: () => void; children: React.ReactNode; cls?: string; testid?: string }) {
  return (
    <div className="jade-modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'jade-panel ' + cls} role="dialog" aria-label={title} data-testid={testid}>
        <div className="jade-panel-head"><h2>{title}</h2><button type="button" className="jade-x" aria-label="Close" data-testid="close" onClick={onClose}>×</button></div>
        <div className="jade-panel-body">{children}</div>
      </div>
    </div>
  );
}

// ── market
export function Market({ play, d, snd, onClose }: { play: Play; d: District; snd: JadeSound | null; onClose: () => void }) {
  const w = play.w, s = w.s;
  const [haggle, setHaggle] = useState<{ mult: number; grade: string } | null>(null);
  const [swing, setSwing] = useState(false);
  const [msg, setMsg] = useState('');
  const [, force] = useState(0);
  const pos = useRef(0); const bar = useRef<HTMLDivElement>(null);
  const zone = haggleZone(s.rep[d], w.assist);
  useEffect(() => {
    if (!swing) return; let raf = 0; const t0 = performance.now();
    const f = (now: number) => { pos.current = needle((now - t0) / 1000, w.assist ? 0.75 : 1); if (bar.current) bar.current.style.left = `${pos.current * 100}%`; raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [swing, w.assist]);
  const stop = () => { const r = haggleResult(pos.current, zone); setHaggle(r); setSwing(false); snd?.[r.grade === 'great' || r.grade === 'good' ? 'good' : 'bad'](); setMsg(r.grade === 'great' ? 'A great deal! Prices tilt your way this visit.' : r.grade === 'good' ? 'A fair-and-a-bit deal.' : r.grade === 'fair' ? 'No change. Maybe next time.' : 'Oof, the stall-keeper is sour now.'); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (swing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); stop(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const mult = haggle?.mult ?? 1;
  const act = (r: string | null) => { if (r) { setMsg(r); snd?.bad(); } else setMsg(''); force(x => x + 1); play.bump(); };
  const cap = w.cap(), have = cargoCount(s.cargo);
  const tips = s.tips.filter(t => t.night === s.night);
  const hint = w.assist ? bestRoute(s.seed, s.night, [...w.open], s.tips, w.event) : null;
  const ev = w.event;
  return (
    <Panel title={`${dName(d)} market`} onClose={onClose} cls="market" testid="market">
      <div className="jade-market-hero" style={{ backgroundImage: `url(${ART}bg-mg-haggle.webp)` }}>
        <div className="jade-haggle">
          {!haggle && !swing && <Btn kind="gold" testid="haggle" onClick={() => { setSwing(true); setMsg('Stop the needle in the green!'); }}>Haggle</Btn>}
          {swing && <div className="jade-needle" onClick={stop} data-testid="haggle-bar"><div className="zone" style={{ left: `${(0.5 - zone) * 100}%`, width: `${zone * 200}%` }} /><div className="zone great" style={{ left: `${(0.5 - zone * 0.35) * 100}%`, width: `${zone * 70}%` }} /><div className="pin" ref={bar} /></div>}
          {swing && <Btn kind="red" testid="haggle-stop" onClick={stop}>Stop!</Btn>}
          {haggle && <span className={'jade-grade ' + haggle.grade} data-testid="haggle-grade">{haggle.grade === 'great' ? 'Great deal' : haggle.grade === 'good' ? 'Good deal' : haggle.grade === 'fair' ? 'Fair' : 'Sour'}</span>}
        </div>
      </div>
      <div className="jade-market-info">
        <span><Icon name="ui-coin" size={18} /> {fmt(s.cash)}</span>
        <span>Carrying {have}/{cap}{w.p.ride ? ` in the ${VEHICLES[w.p.ride.kind].name.toLowerCase()}` : ' on foot'}</span>
        <span>Rep {Math.floor(s.rep[d])}</span>
      </div>
      {msg && <p className="jade-msg" data-testid="market-msg">{msg}</p>}
      <table className="jade-goods">
        <thead><tr><th>Goods</th><th>Buy</th><th>Sell</th><th>You have</th><th /></tr></thead>
        <tbody>
          {GOODS.map(g => {
            const p = w.price(d, g, mult);
            const tip = tips.find(t => t.market === d && t.good === g);
            return (
              <tr key={g} data-good={g}>
                <td><Icon name={GOOD_ICON[g]} size={30} /> {GOOD[g].name}{tip && <em className="tip"> tip!</em>}</td>
                <td>{p.buy}</td><td>{p.sell}</td><td>{s.cargo[g]}</td>
                <td className="btns">
                  <Btn kind="jade" testid={`buy-${g}`} onClick={() => act(w.buy(d, g, 1, mult))}>Buy</Btn>
                  <Btn kind="jade" testid={`buymax-${g}`} onClick={() => act(w.buy(d, g, 99, mult))}>Max</Btn>
                  <Btn kind="red" testid={`sell-${g}`} disabled={!s.cargo[g]} onClick={() => act(w.sell(d, g, 1, mult))}>Sell</Btn>
                  <Btn kind="red" testid={`sellall-${g}`} disabled={!s.cargo[g]} onClick={() => act(w.sell(d, g, 99, mult))}>All</Btn>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="jade-tips">
        {tips.map((t, i) => <p key={i}><b>{t.from}:</b> {GOOD[t.good].name} at {dName(t.market)} {t.mult > 1 ? 'pays well' : 'is cheap'} tonight.</p>)}
        {ev && <p><b>Daily event · {ev.name}:</b> {ev.desc} ({ev.task}{s.dailyDone.includes('day:' + ev.day) ? ', done!' : ''})</p>}
        {hint && hint.gain > 0.15 && <p className="hint"><b>Assist tip:</b> {GOOD[hint.good].name} are cheap at {dName(hint.from)} and pay at {dName(hint.to)}.</p>}
        <p className="small">Prices change every night. Magpies swoop at riders carrying valuable cargo: dash or boost to dodge.</p>
      </div>
    </Panel>
  );
}

// ── safe house
export function SafeHouse({ play, id, snd, onClose, onSave }: { play: Play; id: string; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const w = play.w, s = w.s; const [, force] = useState(0); const [msg, setMsg] = useState('');
  const pl = w.c.places[id]; const owned = safeOpen(s, id); const h = SAFE_HOUSES.find(x => x.id === id)!;
  const done = (r: string | null, ok = '') => { if (r) { setMsg(r); snd?.bad(); } else { setMsg(ok); snd?.good(); onSave(); } force(x => x + 1); play.bump(); };
  if (!owned) return (
    <Panel title={pl.name ?? 'Safe house'} onClose={onClose} testid="safe">
      <p>This little flat is for sale: {h.price} coins, once you have {h.need} reputation in {dName(h.d)} (you have {Math.floor(s.rep[h.d])}).</p>
      <p>A safe house is somewhere to swap jackets and shake the wardens, rest till the next night, keep a stash, and change outfits.</p>
      {msg && <p className="jade-msg">{msg}</p>}
      <Btn kind="gold" testid="buy-safe" onClick={() => done(buySafe(s, id), 'It’s yours! The kettle is already on.')}>Buy for {h.price} coins</Btn>
    </Panel>
  );
  const L = lanterns(w);
  const stashCap = 60 + s.upgrades.cargo * 20;
  return (
    <Panel title={pl.name ?? 'Safe house'} onClose={onClose} cls="safe" testid="safe">
      {msg && <p className="jade-msg" data-testid="safe-msg">{msg}</p>}
      <div className="jade-safe-grid">
        <section>
          <h3>Lie low</h3>
          <Btn kind="jade" testid="swap" onClick={() => { w.swapJacket(); done(null, L ? 'New jacket, new you. The wardens lose the trail.' : 'Fresh jacket on. You were not in trouble anyway!'); onClose(); }}><Icon name="i-jacket" size={22} /> Swap jackets{L ? ` (clear ${L} lantern${L > 1 ? 's' : ''})` : ''}</Btn>
          <Btn kind="plain" testid="sleep" disabled={!!w.run} onClick={() => { w.sleep(); done(null, `Good morning! It is night ${s.night} and the markets have new prices.`); onClose(); }}>Sleep till next night</Btn>
          <p className="small">Saved: your progress saves on its own whenever you finish a job, and every few seconds.</p>
        </section>
        <section>
          <h3>Who’s out tonight</h3>
          <div className="jade-heroes">
            {(['dora', 'enzo'] as const).map(hh => (
              <button type="button" key={hh} data-testid={`hero-${hh}`} className={'jade-hero-pick' + (s.hero === hh ? ' on' : '')} onClick={() => { w.setHero(hh); done(null, hh === 'dora' ? 'Dora takes the next shift.' : 'Enzo takes the next shift.'); }}>
                <Sprite name={`face-${hh}`} h={64} w={64} /><span>{hh === 'dora' ? 'Dora' : 'Enzo'}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="wide">
          <h3>Wardrobe · {s.hero === 'dora' ? 'Dora' : 'Enzo'}</h3>
          <div className="jade-outfits">
            {OUTFITS.map(o => {
              const own = s.outfits[s.hero].includes(o.id), on = s.outfit[s.hero] === o.id;
              return (
                <button type="button" key={o.id} data-testid={`outfit-${o.id}`} className={'jade-outfit' + (on ? ' on' : '') + (own ? ' own' : '')} onClick={() => done(buyOutfit(s, s.hero, o.id), own ? `Wearing ${o.name}.` : `Bought ${o.name}!`)}>
                  <span className={`jade-swatch h${o.hue}`} /><b>{o.name}</b>
                  <small>{own ? (on ? 'Wearing' : 'Wear') : `${o.price} coins${o.need ? ` · ${o.need.rep} rep ${dName(o.need.d)}` : ''}`}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section className="wide">
          <h3>Stash ({cargoCount(s.stash)}/{stashCap})</h3>
          <table className="jade-goods small">
            <tbody>{GOODS.map(g => (
              <tr key={g}><td><Icon name={GOOD_ICON[g]} size={24} /> {GOOD[g].name}</td><td>Carrying {s.cargo[g]}</td><td>Stashed {s.stash[g]}</td>
                <td className="btns"><Btn kind="plain" testid={`stash-${g}`} disabled={!s.cargo[g]} onClick={() => done(w.stash(g, 99, true), 'Stashed.')}>Stash all</Btn><Btn kind="plain" testid={`take-${g}`} disabled={!s.stash[g]} onClick={() => done(w.stash(g, 99, false), 'Taken.')}>Take</Btn></td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>
    </Panel>
  );
}

// ── garage
export function Garage({ play, snd, onClose, onSave }: { play: Play; snd: JadeSound | null; onClose: () => void; onSave: () => void }) {
  const s = play.w.s; const [, force] = useState(0); const [msg, setMsg] = useState('');
  const done = (r: string | null, ok: string) => { if (r) { setMsg(r); snd?.bad(); } else { setMsg(ok); snd?.coins(); onSave(); } force(x => x + 1); play.bump(); };
  const UP: { k: 'speed' | 'grip' | 'cargo'; name: string; desc: string }[] = [
    { k: 'speed', name: 'Engine', desc: '+7% top speed for every ride per level' },
    { k: 'grip', name: 'Tyres', desc: '+10% steering for every ride per level' },
    { k: 'cargo', name: 'Racks', desc: 'more cargo in every ride and a bigger stash' },
  ];
  return (
    <Panel title="Garage" onClose={onClose} cls="garage" testid="garage">
      <p className="small">Upgrades fit every ride you take. Paint shows on whatever you are riding. <Icon name="ui-coin" size={16} /> {fmt(s.cash)}</p>
      {msg && <p className="jade-msg" data-testid="garage-msg">{msg}</p>}
      <div className="jade-ups">
        {UP.map((u, i) => {
          const lvl = s.upgrades[u.k]; const cost = lvl < 3 ? UPGRADE_COST[i][lvl] : null;
          return (
            <div className="jade-up" key={u.k}>
              <b>{u.name}</b><span className="lv">{[0, 1, 2].map(j => <i key={j} className={j < lvl ? 'on' : ''} />)}</span>
              <small>{u.desc}</small>
              <Btn kind="gold" testid={`up-${u.k}`} disabled={cost === null} onClick={() => done(buyUpgrade(s, u.k), `${u.name} upgraded!`)}>{cost === null ? 'Maxed' : `${cost} coins`}</Btn>
            </div>
          );
        })}
      </div>
      <h3>Paint</h3>
      <div className="jade-paints">
        {PAINTS.map(p => (
          <button type="button" key={p.id} data-testid={`paint-${p.id}`} className={'jade-paint' + (s.paint === p.id ? ' on' : '')} onClick={() => done(buyPaint(s, p.id), `Painted ${p.name}!`)}>
            <span className={`jade-swatch p-${p.id}`} /><b>{p.name}</b><small>{s.paint === p.id ? 'On your rides' : p.price ? `${p.price} coins` : 'Free'}</small>
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ── full map
export function MapView({ play, onClose }: { play: Play; onClose: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null); const w = play.w; const [, force] = useState(0);
  const view = useRef({ s: 1, ox: 0, oy: 0 });
  useEffect(() => {
    const c = cv.current!; const x = c.getContext('2d')!;
    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const r = c.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
      const map = play.scene.buildMap();
      const s = Math.min(c.width / map.width, c.height / map.height); const ox = (c.width - map.width * s) / 2, oy = (c.height - map.height * s) / 2;
      view.current = { s: s * play.scene.mapK / T / dpr, ox: ox / dpr, oy: oy / dpr };
      x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#0d1530'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(map, ox, oy, map.width * s, map.height * s);
      const k = s * play.scene.mapK / T; const P = (wx: number, wy: number): [number, number] => [ox + wx * k, oy + wy * k];
      const fog: [District, number, number, number, number][] = [['temple', 0, 0, 46, 30], ['canal', 46, 0, 29, 62], ['arcade', 75, 0, 45, 62], ['docks', 46, 62, 74, 30]];
      for (const [d, rx, ry, rw, rh] of fog) if (!w.open.has(d)) { const [a, b] = P(rx * T, ry * T); x.fillStyle = 'rgba(40,30,70,.85)'; x.fillRect(a, b, rw * T * k, rh * T * k); x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `${Math.round(14 * dpr)}px system-ui`; x.textAlign = 'center'; const mw = rw * T * k * 0.92; x.fillText(dName(d), a + rw * T * k / 2, b + rh * T * k / 2, mw); x.fillText('in the fog', a + rw * T * k / 2, b + rh * T * k / 2 + 18 * dpr, mw); }
      const t = now / 1000;
      const pin = (wx: number, wy: number, col: string, r: number) => { const [a, b] = P(wx, wy); x.fillStyle = col; x.beginPath(); x.arc(a, b, r * dpr, 0, Math.PI * 2); x.fill(); x.lineWidth = 2 * dpr; x.strokeStyle = 'rgba(0,0,0,.7)'; x.stroke(); };
      for (const pl of Object.values(w.c.places)) { if (!w.open.has(pl.d)) continue; if (pl.kind === 'market') pin(pl.x, pl.y, '#ffd25a', 5); else if (pl.kind === 'safe') pin(pl.x, pl.y, '#3ed6a4', 5); else if (pl.kind === 'garage') pin(pl.x, pl.y, '#8fb4ff', 5); }
      for (const g of w.gigs()) pin(g.x, g.y, '#ff9ad5', 4);
      if (!w.run) for (const m of available(w.s)) { const pl = w.c.places[m.at]; if (pl) pin(pl.x, pl.y, '#ffb020', 8 + Math.sin(t * 4) * 1.5); }
      if (w.route.length > 1) { x.strokeStyle = 'rgba(255,230,120,.95)'; x.lineWidth = 3 * dpr; x.beginPath(); const [a0, b0] = P(w.p.x, w.p.y); x.moveTo(a0, b0); for (const [rx, ry] of w.route.slice(1)) { const [a, b] = P(rx, ry); x.lineTo(a, b); } x.stroke(); }
      const o = w.objective(); if (o) pin(o[0], o[1], '#fff27a', 7);
      const [px, py] = P(w.p.x, w.p.y); x.save(); x.translate(px, py); x.rotate((w.p.ride ? w.p.ride.b.h : w.p.b.h) + Math.PI / 2); x.scale(dpr * 1.4, dpr * 1.4); x.fillStyle = '#fff'; x.strokeStyle = '#c0392b'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(7, 7); x.lineTo(0, 3); x.lineTo(-7, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, [play, w]);
  const click = (e: React.MouseEvent) => {
    if (w.run) return;
    const r = cv.current!.getBoundingClientRect(); const v = view.current;
    const wx = (e.clientX - r.left - v.ox) / v.s, wy = (e.clientY - r.top - v.oy) / v.s;
    if (wx < 0 || wy < 0 || wx > W * T || wy > H * T) return;
    w.waypoint = [wx, wy]; w.routeT = 0; w.updateRoute(); force(n => n + 1); play.bump();
  };
  return (
    <Panel title="Map" onClose={onClose} cls="map" testid="map">
      <canvas ref={cv} className="jade-map-cv" onClick={click} data-testid="map-canvas" />
      <div className="jade-map-legend">
        <span><i style={{ background: '#ffb020' }} />Job</span><span><i style={{ background: '#ffd25a' }} />Market</span><span><i style={{ background: '#3ed6a4' }} />Safe house</span><span><i style={{ background: '#8fb4ff' }} />Garage</span><span><i style={{ background: '#ff9ad5' }} />Side gig</span>
        {w.run ? <span>Your job’s route is shown.</span> : <span>Tap the map to drop a pin.{w.waypoint && <button type="button" className="jade-link" data-testid="clear-pin" onClick={() => { w.waypoint = null; w.route = []; force(n => n + 1); }}>Clear pin</button>}</span>}
      </div>
    </Panel>
  );
}

// ── pause menu
type Tab = 'menu' | 'settings' | 'trophies' | 'stats' | 'story';
export function Pause({ play, onClose, onQuit, onNew, onSave, snd }: { play: Play; onClose: () => void; onQuit: () => void; onNew: () => void; onSave: () => void; snd: JadeSound | null }) {
  const [tab, setTab] = useState<Tab>('menu'); const [confirm, setConfirm] = useState(false); const [, force] = useState(0);
  const s = play.w.s;
  const set = (f: (x: Save['settings']) => void) => { f(s.settings); if (snd) { snd.sfxOn = s.settings.sound; snd.setMusic(s.settings.music); } onSave(); force(n => n + 1); play.bump(); };
  const st = s.stats;
  return (
    <Panel title={tab === 'menu' ? 'Paused' : tab[0].toUpperCase() + tab.slice(1)} onClose={tab === 'menu' ? onClose : () => setTab('menu')} cls="pause" testid="pause">
      {tab === 'menu' && !confirm && (
        <div className="jade-menu">
          <Btn kind="jade" testid="resume" onClick={onClose}>Resume</Btn>
          <Btn kind="plain" testid="tab-story" onClick={() => setTab('story')}>Story</Btn>
          <Btn kind="plain" testid="tab-settings" onClick={() => setTab('settings')}>Settings</Btn>
          <Btn kind="plain" testid="tab-trophies" onClick={() => setTab('trophies')}>Trophies ({s.trophies.length}/{TROPHIES.length})</Btn>
          <Btn kind="plain" testid="tab-stats" onClick={() => setTab('stats')}>Stats</Btn>
          {play.w.run && <Btn kind="plain" testid="abandon" onClick={() => { play.w.quitJob(); onClose(); }}>Quit this job</Btn>}
          <Btn kind="plain" testid="to-title" onClick={onQuit}>Save and quit to title</Btn>
          <Btn kind="red" testid="new-game" onClick={() => setConfirm(true)}>New game</Btn>
        </div>
      )}
      {confirm && (
        <div className="jade-confirm" data-testid="confirm-new">
          <p>Start a brand new game? Your coins, jobs, cats and trophies will be wiped.</p>
          <div className="jade-card-btns"><Btn kind="red" testid="confirm-yes" onClick={onNew}>Yes, start over</Btn><Btn kind="plain" testid="confirm-no" onClick={() => setConfirm(false)}>Keep my game</Btn></div>
        </div>
      )}
      {tab === 'settings' && (
        <div className="jade-settings">
          <label><input type="checkbox" data-testid="set-assist" checked={s.settings.assist} onChange={e => set(x => { x.assist = e.target.checked; })} /> Assist: route line, aim help, gentler timers and lookouts</label>
          <label>Difficulty <select data-testid="set-diff" value={s.settings.diff} onChange={e => set(x => { x.diff = e.target.value as 'easy' | 'normal'; })}><option value="easy">Easy</option><option value="normal">Normal</option></select></label>
          <label><input type="checkbox" data-testid="set-sound" checked={s.settings.sound} onChange={e => set(x => { x.sound = e.target.checked; })} /> Sound effects</label>
          <label><input type="checkbox" data-testid="set-music" checked={s.settings.music} onChange={e => set(x => { x.music = e.target.checked; })} /> Music</label>
          <label><input type="checkbox" checked={s.settings.shake} onChange={e => set(x => { x.shake = e.target.checked; })} /> Screen shake</label>
          <label>Touch controls <select data-testid="set-touch" value={s.settings.touch} onChange={e => set(x => { x.touch = e.target.value as 'auto' | 'on' | 'off'; })}><option value="auto">Automatic</option><option value="on">Always</option><option value="off">Never</option></select></label>
          <p className="small">Keys: WASD or arrows move · Shift sneak · Space dash (boost on a ride) · Q hop (honk on a ride) · E action · M map · Esc pause.</p>
        </div>
      )}
      {tab === 'trophies' && (
        <div className="jade-trophies" data-testid="trophies">
          {TROPHIES.map(t => <div key={t.id} className={'jade-trophy' + (s.trophies.includes(t.id) ? ' got' : '')}><Icon name="i-trophy" size={30} /><b>{t.name}</b><small>{t.desc}</small></div>)}
        </div>
      )}
      {tab === 'stats' && (
        <dl className="jade-stats" data-testid="stats">
          <dt>Jobs done</dt><dd>{st.missions} of {MISSIONS.length}</dd><dt>Side gigs</dt><dd>{st.gigs}</dd>
          <dt>Lucky cats</dt><dd>{s.cats.length} of 50</dd><dt>Murals restored</dt><dd>{s.murals.length} of {play.w.c.murals.length}</dd>
          <dt>Trading profit</dt><dd>{fmt(st.profit)} coins</dd><dt>Trades</dt><dd>{st.trades}</dd>
          <dt>Walked</dt><dd>{(st.walked / T * 2 / 1000).toFixed(1)} km</dd><dt>Ridden</dt><dd>{(st.driven / T * 2 / 1000).toFixed(1)} km</dd><dt>Boated</dt><dd>{(st.boated / T * 2 / 1000).toFixed(1)} km</dd>
          <dt>Times caught</dt><dd>{st.caught}</dd><dt>Escapes</dt><dd>{st.escapes}</dd><dt>Most lanterns</dt><dd>{st.maxHeat}</dd>
          <dt>Mini-games</dt><dd>{st.minis}</dd><dt>Nights</dt><dd>{s.night}</dd><dt>Play time</dt><dd>{Math.floor(st.playTime / 60)} min</dd>
          <dt>Reputation</dt><dd>{DISTRICTS.map(d => `${dName(d)} ${Math.floor(s.rep[d])}`).join(' · ')}</dd>
        </dl>
      )}
      {tab === 'story' && (
        <div className="jade-story" data-testid="story">
          <p>The Magpie Crew stole the quarter’s five lucky heirlooms the night before the Lantern Festival. Win them back, chapter by chapter, and the fog over each district lifts.</p>
          <div className="jade-heirlooms">{HEIRLOOMS.map((h, i) => <div key={h.id} className={s.done.includes(`m${(i + 1) * 5}`) ? 'got' : ''}><Sprite name={h.sprite} h={56} w={56} /><b>{h.name}</b><small>{CHAPTERS[i]}</small></div>)}</div>
          <p className="small">{s.done.length} of {MISSIONS.length} jobs done. Side gigs, lucky cats and murals are waiting in every open district.</p>
        </div>
      )}
    </Panel>
  );
}
void DAILY_NEED;
