'use client';
// Highburrow, The First Valley: the page. A full-window canvas map of the hex valley (lib/highburrow-scene.ts) under
// a woven HUD: goods and Warmth along the top, the selected unit's actions bottom left, Enzo's tip, Next, End Turn
// and the mini map bottom right. The village cut-away, the market, the llama route editor, a neighbour's request,
// the turn summary and the title and end cards open over it. Rules in lib/highburrow-game.ts; the controller in
// ./controller.ts handles gestures, keys, turns and saving.
import { useEffect, useRef, useState } from 'react';
import { loadArt } from '@/lib/highburrow-scene';
import { Game, SAVE_KEY, frostKnown } from '@/lib/highburrow-game';
import { attention } from '@/lib/highburrow-advisor';
import { initTips, refreshTip, store, ART } from './dom';
import { Highburrow } from './controller';
import { Top, UnitPanel, AdviceBox, Summary, Decision, EndCard, Title } from './hud';
import { VillageView } from './village';
import { TradeView, RouteView } from './trade';
import './highburrow.css';

function readSave() { try { const j = store(SAVE_KEY); return j ? Game.load(j) : null; } catch { return null; } }

export default function HighburrowPage() {
  const mapRef = useRef<HTMLCanvasElement>(null), miniRef = useRef<HTMLCanvasElement>(null), tipRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Highburrow | null>(null);
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<Game | null>(null);
  const [assist, setAssist] = useState(true);
  const lastToast = useRef('');
  useEffect(() => {
    let dead = false;
    const offTips = initTips(tipRef.current!);
    const app = new Highburrow(mapRef.current!, miniRef.current!, () => { if (!dead) setTick(t => (t + 1) % 1e9); });
    appRef.current = app;
    loadArt(ART).then(() => {
      if (dead) return;
      const g = readSave();
      app.start(g ?? new Game(7, true)); app.modal = 'title';
      setSaved(g); setAssist(g ? g.s.assist : true); setReady(true); app.refresh();
    });
    return () => { dead = true; app.destroy(); offTips(); appRef.current = null; };
  }, []);
  useEffect(() => { refreshTip(); appRef.current?.tut.place(); });
  const app = appRef.current, g = ready ? app?.g : undefined;
  const need = g ? attention(g).length : 0;
  if (app?.toast.msg) lastToast.current = app.toast.msg;
  return (
    <main className="hb-shell" data-ready={ready ? 'true' : 'false'} data-modal={app?.modal ?? ''}>
      <canvas id="map" ref={mapRef} aria-label="Valley map" />
      {app && g ? <Top app={app} /> : <div id="top" className="woven" style={{ display: 'none' }} />}
      <div id="frostbanner" className={g && g.s.frost && frostKnown(g.s) ? 'on' : ''}>Frost tonight</div>
      {app && g ? <UnitPanel app={app} /> : <div id="unit" className="woven" />}
      <div id="side" style={g ? undefined : { display: 'none' }}>
        {app && g ? <AdviceBox app={app} /> : <div id="advice" className="woven" />}
        <div className="srow">
          <button id="next" className="wbtn teal" title="Next thing needing attention (N)" onClick={() => app?.next()}>Next{need ? <> <b>{need}</b></> : null}</button>
          <button id="end" className={g && !need ? 'ready' : ''} title="End turn (Enter)" onClick={() => app?.endTurn()}><span>End<br />Turn</span></button>
        </div>
        <canvas id="mini" ref={miniRef} width={200} height={150} title="Mini map: click to jump" onClick={e => app?.miniClick(e)} />
      </div>
      {app && g && app.modal === 'village' && <VillageView app={app} />}
      {app && g && app.modal === 'trade' && <TradeView app={app} />}
      {app && g && app.modal === 'route' && <RouteView app={app} />}
      {app && g && app.modal === 'summary' && <Summary app={app} />}
      {app && g && app.modal === 'decision' && <Decision app={app} />}
      {app && g && app.modal === 'end' && <EndCard app={app} />}
      {app && g && app.modal === 'title' && <Title app={app} saved={saved} assist={assist} setAssist={setAssist} />}
      {!ready && <div className="hb-loading">Highburrow…</div>}
      <div className="tut"><div className="paw" /></div>
      <div className="tutlab" />
      <button className="tutskip" onClick={() => app?.tut.skipAll()}>Skip tutorial</button>
      <div className="tip" role="tooltip" ref={tipRef} />
      <div id="toast" className={app?.toast.msg ? 'on ' + app.toast.kind : ''}>{app?.toast.msg || lastToast.current}</div>
    </main>
  );
}
