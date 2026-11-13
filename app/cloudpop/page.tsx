'use client';
// Cloudpop: the page. Holds the save (localStorage 'cloudpop-v1'), switches between the menus and a run, and banks
// each finished run into the save. The run itself lives in ./controller.ts (loop, input, sound) drawing through
// lib/cloudpop-scene.ts; its HUD is ./play.tsx; menus in ./menus.tsx; progression in ./meta.tsx.
import { useEffect, useRef, useState, useCallback } from 'react';
import { loadSave, newSave, SAVE_KEY, finishRun, buyLore, labUnlock, runConfig, daily, dailyConfig, dayKey, type Save, type RunReward, type RunSummary } from '@/lib/cloudpop-meta';
import type { Diff, Mode, Game } from '@/lib/cloudpop-game';
import type { TowerId } from '@/lib/cloudpop-towers';
import { Play } from './controller';
import { PopSound } from './sound';
import { TopBar, Shop, TowerPanel, GoButton, QuickAbilities, Preview, PauseMenu } from './play';
import { Title, Maps, Setup, Heroes, Settings, EndCard, type Screen } from './menus';
import { Lore, Lab, Trophies, Daily } from './meta';
import { store } from './ui';
import './cloudpop.css';

export default function CloudpopPage() {
  const [save, setSaveState] = useState<Save>(() => newSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [map, setMap] = useState('meadow');
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [end, setEnd] = useState<{ r: RunSummary; reward: RunReward | null } | null>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const playRef = useRef<Play | null>(null);
  const sndRef = useRef<PopSound | null>(null);
  const lastRun = useRef<{ diff: Diff; mode: Mode; kind?: TowerId; daily?: boolean }>({ diff: 'easy', mode: 'standard' });
  const saveRef = useRef(save); saveRef.current = save;

  useEffect(() => {
    const s = loadSave(store(SAVE_KEY));
    setSaveState(s); setReady(true);
    const snd = new PopSound(); sndRef.current = snd; snd.sfxOn = s.settings.sound; snd.musicOn = s.settings.music;
    const w = window as unknown as Record<string, unknown>;
    w.__cloudpopSave = () => saveRef.current;
    const first = () => { snd.start(); snd.play(playRef.current ? 'valley' : 'menu'); };
    window.addEventListener('pointerdown', first, { once: true });
    return () => { snd.stop(); window.removeEventListener('pointerdown', first); };
  }, []);

  const setSave = useCallback((f: (s: Save) => void) => {
    setSaveState(prev => {
      const next: Save = JSON.parse(JSON.stringify(prev)); f(next);
      store(SAVE_KEY, JSON.stringify(next));
      if (sndRef.current) { sndRef.current.sfxOn = next.settings.sound; sndRef.current.setMusic(next.settings.music); }
      return next;
    });
  }, []);

  const go = (sc: Screen) => { sndRef.current?.click(); setScreen(sc); if (sc !== 'play') sndRef.current?.play('menu'); };

  const onEnd = useCallback((r: RunSummary) => {
    const next: Save = JSON.parse(JSON.stringify(saveRef.current));
    const reward = finishRun(next, r);
    store(SAVE_KEY, JSON.stringify(next)); saveRef.current = next; setSaveState(next);
    setEnd({ r, reward });
  }, []);

  const startRun = useCallback((cfgMaker: () => ReturnType<typeof runConfig>) => {
    setEnd(null); setMenu(false); setScreen('play');
    requestAnimationFrame(() => {
      const cv = cvRef.current; if (!cv || !sndRef.current) return;
      playRef.current?.destroy();
      const p = new Play(cv, () => setTick(t => (t + 1) % 1e9), sndRef.current, (r: RunSummary, _g: Game) => onEnd(r));
      playRef.current = p;
      void p.start(cfgMaker(), { auto: saveRef.current.settings.auto, speed: saveRef.current.settings.speed });
    });
  }, [onEnd]);

  const startNormal = (diff: Diff, mode: Mode, kind?: TowerId) => {
    lastRun.current = { diff, mode, kind };
    startRun(() => runConfig(saveRef.current, map, diff, mode, (Date.now() % 1e6) + 1, kind));
  };
  const startDaily = () => {
    lastRun.current = { diff: 'easy', mode: 'daily', daily: true };
    const d = daily(dayKey(new Date()));
    setMap(d.map);
    startRun(() => dailyConfig(d, saveRef.current));
  };
  const leave = (to: Screen) => {
    const p = playRef.current;
    if (p && !p.ended && p.g && p.g.stats.roundsWon > 0) { p.ended = true; onEnd(p.summary()); }
    p?.destroy(); playRef.current = null; setMenu(false); setEnd(null); go(to);
  };
  useEffect(() => () => playRef.current?.destroy(), []);

  const p = playRef.current;
  const s = save;
  return (
    <main className={'cpop-shell' + (screen === 'play' ? ' playing' : '')} data-ready={ready ? 'true' : 'false'} data-screen={screen}>
      <canvas ref={cvRef} className="cpop-canvas" style={{ display: screen === 'play' ? 'block' : 'none' }} aria-label="Cloudpop valley" />
      {screen === 'play' && p?.ready && p.g && <>
        <TopBar p={p} onMenu={() => { p.paused = true; setMenu(true); }} />
        <div className="cpop-side">
          {p.sel != null ? <TowerPanel p={p} /> : <Shop p={p} />}
        </div>
        <GoButton p={p} />
        <QuickAbilities p={p} />
        {s.settings.tips && <Preview p={p} />}
        {p.place && <div className="cpop-placing" data-testid="placing">Placing: tap the map{' '}<button className="cbtn plain" data-testid="cancel-place" onClick={() => p.cancel()}>Cancel</button></div>}
        <div className={'cpop-toast' + (p.toast.msg ? ' on ' + p.toast.kind : '')} role="status">{p.toast.msg}</div>
        {menu && <PauseMenu p={p} settings={s.settings} setSetting={(k, v) => setSave(x => { x.settings[k] = v; })}
          onClose={() => { setMenu(false); p.paused = false; }} onRestart={() => { setMenu(false); if (lastRun.current.daily) startDaily(); else startNormal(lastRun.current.diff, lastRun.current.mode, lastRun.current.kind); }}
          onQuit={() => leave('maps')} />}
        {end && <EndCard won={end.r.won} r={end.r} reward={end.reward} canFreeplay={!lastRun.current.daily && end.r.won && p.g.over === 'won'}
          onFreeplay={() => { setEnd(null); p.continueFreeplay(); }} onRetry={() => { if (lastRun.current.daily) startDaily(); else startNormal(lastRun.current.diff, lastRun.current.mode, lastRun.current.kind); }}
          onMaps={() => leave('maps')} onHome={() => leave('title')} />}
      </>}
      {screen === 'play' && !p?.ready && <div className="cpop-loading">Cloudpop…</div>}
      {screen === 'title' && <Title s={s} go={go} />}
      {screen === 'maps' && <Maps s={s} go={go} onPick={m => { setMap(m); go('setup'); }} />}
      {screen === 'setup' && <Setup s={s} map={map} setSave={setSave} onBack={() => go('maps')} onStart={startNormal} />}
      {screen === 'heroes' && <Heroes s={s} setSave={setSave} go={go} />}
      {screen === 'settings' && <Settings s={s} setSave={setSave} go={go} reset={() => { const n = newSave(); store(SAVE_KEY, JSON.stringify(n)); setSaveState(n); }} />}
      {screen === 'lore' && <Lore s={s} go={go} buy={id => { sndRef.current?.upgrade(); setSave(x => { buyLore(x, id); }); }} />}
      {screen === 'lab' && <Lab s={s} go={go} unlock={(id, path) => { sndRef.current?.upgrade(); setSave(x => { labUnlock(x, id, path); }); }} />}
      {screen === 'trophies' && <Trophies s={s} go={go} />}
      {screen === 'daily' && <Daily s={s} go={go} play={startDaily} />}
    </main>
  );
}
