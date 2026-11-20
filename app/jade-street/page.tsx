'use client';
// Jade Street: the page. Holds the save (localStorage 'jade-street-v9', migrating v8 back to v1), the painted loading
// screen (the title waits for the eager paintings only: lib/jade-load.ts), the title screen with continue / new game (confirmed in
// the page) and the hero pick, the storybook opening, chapter cards, the ending and credits (./story.tsx), then the
// running game: the canvas (./controller.ts and lib/jade-scene.ts), the HUD (./hud.tsx), lesson hints, the phone and
// the radio (./extras.tsx), the panels (./panels.tsx), the painted map (./map.tsx) and the mini-games (./minis.tsx).
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSave, newSave, SAVE_KEY, OLD_KEYS, type Save, type Hero } from '@/lib/jade-save';
import { Play } from './controller';
import { JadeSound } from './sound';
import { TopHud, Toasts, Prompt, Dialogue, FailCard, TouchControls, KeyHelp } from './hud';
import { Market, SafeHouse, Garage, Pause } from './panels';
import { BizPanel } from './biz';
import { DuoBar, TagPrompt, GearHud, GearStall } from './duo';
import { PaintedMap } from './map';
import { Storybook, ChapterCard, Ending, Credits } from './story';
import { loadArt, artLoaded, streamArt, preloadPic, picReady, STORY_FIRST } from '@/lib/jade-scene';
import { filesOf } from '@/lib/jade-load';
import { Loader, ArtWait, Hint, PhoneHud, PhoneView, RadioHud, switchStation } from './extras';
import { chapterOf } from '@/lib/jade-save';
import { learn } from '@/lib/jade-tutor';
import { jobCounts } from '@/lib/jade-story';
import { MiniGame } from './minis';
import { TicketCard, MamaShop, KopiMini } from './sg';
import { MrtPanel, RideView, TaxiPanel } from './isle';
import { HeistPanel, BranchPanel, AskPanel } from './jobs';
import './jobs.css';
import './isle.css';
import './sg.css';
import { store, Sprite, artUrl } from './ui';
import './jade.css';
import './duo.css';

type Screen = 'loading' | 'title' | 'game';
type Story = null | 'intro' | 'chapter' | 'ending' | 'credits';

export default function JadeStreetPage() {
  const [save, setSave] = useState<Save>(() => newSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [story, setStory] = useState<Story>(null); const storyRef = useRef<Story>(null); storyRef.current = story;
  const [phone, setPhone] = useState(false); const mapRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pick, setPick] = useState(false);
  const [, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mapOpen, setMapOpen] = useState(false); mapRef.current = mapOpen;
  const phoneRef = useRef(false); phoneRef.current = phone; const pausedRef = useRef(false); pausedRef.current = paused;
  const [coarse, setCoarse] = useState(false);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const playRef = useRef<Play | null>(null);
  const sndRef = useRef<JadeSound | null>(null);
  const saveRef = useRef(save); saveRef.current = save;

  useEffect(() => {
    let raw = store(SAVE_KEY);
    if (!raw) for (const k of OLD_KEYS) { raw = store(k); if (raw) break; }
    const s = loadSave(raw);
    setSave(s); setReady(true);
    // the title shows at once; the eager paintings (lib/jade-load.ts) load behind it, and starting before they are in
    // shows the painted loading screen until they are
    // (pass 13: the title's own painting first, so it does not arrive half-drawn behind the eager set; then the eager
    // set while the title is idle, and the opening storybook's paintings for a save that has not seen it)
    const title = Promise.race([preloadPic('bg-title'), new Promise(r => setTimeout(r, 1500))]);
    void title.then(() => loadArt()).then(() => {
      void preloadPic('bg-empire'); // (the phone's Empire tab: its banner was blank on first open)
      if (!s.story.intro) void preloadPic(STORY_FIRST).then(() => Promise.all(['bg-story-2', 'bg-story-3', 'bg-story-4'].map(n => preloadPic(n))));
      if (!playRef.current) streamArt(filesOf(['job']), []);
    }).catch(() => undefined);
    const snd = new JadeSound(); sndRef.current = snd; snd.sfxOn = s.settings.sound; snd.musicOn = s.settings.music;
    const first = () => { snd.start(); if (!playRef.current) snd.play('menu'); };
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true });
    const mq = window.matchMedia('(pointer: coarse)'); setCoarse(mq.matches);
    const onMq = () => setCoarse(mq.matches); mq.addEventListener?.('change', onMq);
    (window as unknown as Record<string, unknown>).__jadeSave = () => playRef.current?.w.s ?? saveRef.current;
    (window as unknown as Record<string, unknown>).__jadeRadio = () => snd.nowPlaying(); // (the browser tests: what the music is playing)
    return () => { snd.stop(); window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); mq.removeEventListener?.('change', onMq); };
  }, []);

  const persist = useCallback((s: Save) => { store(SAVE_KEY, JSON.stringify(s)); }, []);

  // the running game
  useEffect(() => {
    if (screen !== 'game' || !cvRef.current) return;
    const play = new Play(cvRef.current, saveRef.current, sndRef.current, () => setTick(t => (t + 1) % 1e6), persist);
    playRef.current = play;
    sndRef.current?.play('street');
    if (!saveRef.current.done.length && !saveRef.current.started) {
      const h = saveRef.current.hero;
      play.w.talk = { lines: [[h, 'The Kaypoh Crows stole all five lucky heirlooms, the night before the Lantern Festival!'], [h, 'Uncle Kee at the grocery will know what to do. Follow the gold line.']], i: 0 };
    }
    saveRef.current.started = true; persist(saveRef.current);
    if (!saveRef.current.story.intro) { play.paused = true; setStory('intro'); }
    play.onEnding = () => { play.paused = true; setPaused(false); setMapOpen(false); setStory('ending'); };
    play.onKey = (k: string) => {
      const w = play.w;
      if (storyRef.current) return true;
      // Escape closes the top-most thing first: the pause menu, then the map or the phone, then a panel
      if (k === 'Escape' && pausedRef.current) { setPaused(false); play.paused = !!(mapRef.current || phoneRef.current); return true; }
      if (k === 'Escape' && mapRef.current) { setMapOpen(false); play.paused = false; return true; }
      if (k === 'Escape' && phoneRef.current) { setPhone(false); play.paused = false; return true; }
      if (k === 'r' && w.p.ride && !w.ui) { switchStation(play, sndRef.current); return true; }
      if (k === 't' && !w.ui && !w.talk && !mapRef.current) { setPhone(v => { play.paused = !v; return !v; }); return true; }
      if (k === 'Escape' || k === 'p') {
        if (w.ui && w.ui.kind !== 'mini') { w.ui = null; play.bump(); return true; }
        if (w.ui) return false;
        setMapOpen(false); setPaused(p => { play.paused = !p; return !p; }); return true;
      }
      if (k === 'm' && !w.ui && !w.talk) { learn(w, 'map'); setMapOpen(m => { play.paused = !m; return !m; }); return true; }
      return false;
    };
    (window as unknown as Record<string, unknown>).__jadeUi = { pause: () => { play.paused = true; setPaused(true); }, map: () => { play.paused = true; setMapOpen(true); }, story: () => storyRef.current };
    return () => { play.destroy(); playRef.current = null; };
  }, [screen, persist]);

  // a chapter card when a new chapter starts (after the opening storybook)
  const pw = playRef.current?.w;
  useEffect(() => {
    const p = playRef.current; if (!p || story || screen !== 'game') return;
    const s = p.w.s, ch = chapterOf(s);
    if (s.story.intro && ch <= 9 && ch > s.story.ch && !p.w.run && !p.w.talk) { p.paused = true; setStory('chapter'); }
  });
  const storyDone = (next: Story = null) => {
    const p = playRef.current; if (!p) return;
    const s = p.w.s;
    if (story === 'intro') { s.story.intro = true; next = 'chapter'; }
    else if (story === 'chapter') s.story.ch = Math.max(s.story.ch, chapterOf(s));
    else if (story === 'credits') { if (p.endingKind === 'lake') { s.story.lake = true; if (!p.w.run) p.toast('Lights by the Lake: Tiong Bahru, Clarke Quay and Jurong are yours to roam!', 'gold'); } else if (p.endingKind === 'coast') { s.story.coast = true; if (!p.w.run) p.toast('Christmas Star: Orchard Road, Katong and Changi are yours to roam!', 'gold'); } else if (p.endingKind === 'lights') { s.story.lights = true; if (!p.w.run) p.toast('Island Lights: Little India, Kampong Glam and Sentosa are yours to roam!', 'gold'); } else if (p.endingKind === 'isle') { s.story.isle = true; if (!p.w.run) p.toast('Island Night goes on: the whole island is yours to roam!', 'gold'); } else { s.story.ending = true; if (!p.w.run) p.toast('The Lantern Festival goes on: free roam the quarter in festival dress!', 'gold'); } }
    persist(s); setStory(next);
    if (!next) { p.paused = false; sndRef.current?.play('street'); }
  };
  void pw;
  const begin = (s: Save) => { setSave(s); saveRef.current = s; setPaused(false); setMapOpen(false); setScreen(artLoaded() && (s.story.intro || picReady(STORY_FIRST)) ? 'game' : 'loading'); };
  const newGame = (hero: Hero) => {
    const old = saveRef.current; const s = newSave(Math.floor(Math.random() * 1e9) + 1);
    s.hero = hero; s.settings = { ...old.settings };
    persist(s); setConfirm(false); setPick(false); begin(s);
  };
  const toTitle = () => { const p = playRef.current; if (p) { persist(p.w.s); setSave(JSON.parse(JSON.stringify(p.w.s))); } setScreen('title'); setPaused(false); setMapOpen(false); sndRef.current?.play('menu'); };

  const play = playRef.current;
  const w = play?.w;
  const touch = save.settings.touch === 'on' || (save.settings.touch === 'auto' && coarse);
  const closeUi = () => { if (w) { w.ui = null; play!.bump(); } };
  const resume = () => { if (play) play.paused = false; setPaused(false); setMapOpen(false); setPhone(false); };
  const replay = (id: string) => { if (!w) return; const r = w.replay(id); if (r) play!.toast(r, 'bad'); else { resume(); play!.bump(); } };
  const ready2 = useCallback(() => setScreen('game'), []);

  return (
    <main className="jade-shell" data-ready={ready ? 'true' : 'false'} data-screen={screen} data-touch={touch ? 'true' : 'false'} data-big={(w?.s ?? save).settings.bigText ? 'true' : 'false'} data-cb={(w?.s ?? save).settings.cbMarks ? 'true' : 'false'}>
      {screen === 'loading' && <Loader onReady={ready2} story={!(w?.s ?? save).story.intro} />}
      {screen === 'title' && (
        <section className="jade-title" style={{ backgroundImage: `url(${artUrl('bg-title')})` }}>
          <div className="jade-title-card">
            <h1>Jade Street</h1>
            <p className="jade-tag">A night-time caper in Singapore’s Chinatown and out across the island. Win back five lucky heirlooms from the Kaypoh Crows, then stop Director Kaw on the bay front, and mind the fines.</p>
            {ready && !confirm && !pick && (
              <div className="jade-title-btns">
                {save.started && <button type="button" className="jade-btn jade big" data-testid="continue" onClick={() => begin(saveRef.current)}>Continue · night {save.night}, {jobCounts(save).done}/{jobCounts(save).all} jobs</button>}
                <button type="button" className={'jade-btn big ' + (save.started ? 'plain' : 'jade')} data-testid="new" onClick={() => save.started ? setConfirm(true) : setPick(true)}>New game</button>
              </div>
            )}
            {confirm && (
              <div className="jade-confirm" data-testid="confirm-new">
                <p>Start over? Your saved game ({save.done.length} jobs, {save.cats.length} lucky cats, {Math.floor(save.cash)} coins) will be replaced.</p>
                <div className="jade-card-btns"><button type="button" className="jade-btn red" data-testid="confirm-yes" onClick={() => { setConfirm(false); setPick(true); }}>Yes, start over</button><button type="button" className="jade-btn plain" data-testid="confirm-no" onClick={() => setConfirm(false)}>Keep my game</button></div>
              </div>
            )}
            {pick && (
              <div className="jade-pick" data-testid="pick-hero">
                <p>Who starts tonight? You can swap at any safe house.</p>
                <div className="jade-heroes">
                  <button type="button" className="jade-hero-pick" data-testid="pick-dora" onClick={() => newGame('dora')}><Sprite name="face-dora" h={96} w={96} /><span>Dora</span><small>Jade bomber, red eyes, cream fur</small></button>
                  <button type="button" className="jade-hero-pick" data-testid="pick-enzo" onClick={() => newGame('enzo')}><Sprite name="face-enzo" h={96} w={96} /><span>Enzo</span><small>Vermilion tracksuit, grey fur</small></button>
                </div>
                <button type="button" className="jade-link" onClick={() => setPick(false)}>Back</button>
              </div>
            )}
            <p className="jade-how">{coarse ? 'Drag on the left to move. Buttons on the right: Action, Dash, Hop and Sneak.' : 'WASD or arrows to move · Shift sneak · Space dash · Q hop · E action · Tab switch hero · F tag-team · click to fire · G hail a taxi · M map · Esc pause'}</p>
            <a className="jade-back" href="/">← Back to the arcade</a>
          </div>
        </section>
      )}
      {screen === 'game' && (
        <section className="jade-game">
          <div className="jade-stage"><canvas ref={cvRef} className="jade-cv" data-testid="world" /></div>
          {play && w && (
            <>
              <TopHud play={play} onMap={() => { play.paused = true; setMapOpen(true); }} onPause={() => { play.paused = true; setPaused(true); }} />
              <Toasts play={play} />
              {!touch && <KeyHelp />}
              <Hint play={play} touch={touch} />
              <PhoneHud play={play} onOpen={() => { play.paused = true; setPhone(true); }} />
              <RadioHud play={play} snd={sndRef.current} />
              <Prompt play={play} touch={touch} />
              {!touch && !w.talk && !w.ui && <><DuoBar play={play} /><TagPrompt play={play} /><GearHud play={play} />{w.two && <div className="jade-p2" data-testid="p2-badge">Player 2: arrows · / dash · . hop · , action · ; fire</div>}</>}
              {touch && !w.talk && !w.ui && !paused && !mapOpen && !w.failed && <TouchControls play={play} />}
              <Dialogue play={play} />
              <FailCard play={play} />
              {w.ui?.kind === 'market' && <Market play={play} d={w.ui.d} snd={sndRef.current} onClose={closeUi} />}
              {w.ui?.kind === 'safe' && <SafeHouse play={play} id={w.ui.id} snd={sndRef.current} onClose={closeUi} onSave={() => persist(w.s)} />}
              {w.ui?.kind === 'garage' && <Garage play={play} snd={sndRef.current} onClose={closeUi} onSave={() => persist(w.s)} />}
              {w.ui?.kind === 'gear' && <GearStall play={play} snd={sndRef.current} onClose={closeUi} onSave={() => persist(w.s)} />}
              {w.ui?.kind === 'biz' && <BizPanel play={play} id={w.ui.id} snd={sndRef.current} onClose={closeUi} onSave={() => persist(w.s)} />}
              {w.ui?.kind === 'mama' && <MamaShop play={play} snd={sndRef.current} onClose={closeUi} onSave={() => persist(w.s)} />}
              {w.ui?.kind === 'mrt' && <MrtPanel play={play} from={w.ui.from} onClose={closeUi} />}
              {w.ui?.kind === 'ride-view' && <RideView play={play} from={w.ui.from} to={w.ui.to} via={w.ui.via} onDone={closeUi} />}
              {w.ui?.kind === 'taxi' && <TaxiPanel play={play} onClose={closeUi} />}
              {w.ui?.kind === 'heist' && <HeistPanel play={play} />}
              {w.ui?.kind === 'branch' && <BranchPanel play={play} />}
              {w.ui?.kind === 'ask' && <AskPanel play={play} />}
              {!w.ui && !w.talk && <TicketCard play={play} />}
              {w.ui?.kind === 'mini' && w.ui.mini === 'kopi' && <KopiMini key={`kopi-${w.s.stats.minis}`} head={w.run && w.run.m.giver === 'raju' ? ['The teh tarik stall at Tekka', 'Make each teh the way Mr Raju’s cousin calls it, then serve.'] : undefined} level={w.ui.level} assist={w.assist} seed={w.s.seed + w.s.stats.minis * 7 + w.tick} snd={sndRef.current} onDone={ok => { w.miniDone(ok); persist(w.s); play.bump(); }} />}
              {w.ui?.kind === 'mini' && w.ui.mini !== 'kopi' && <MiniGame key={`${w.ui.mini}-${w.s.stats.minis}`} lights={w.ui.from === 'mission' && w.run?.cur?.t === 'mini' && /light/i.test(w.run.cur.label)} kind={w.ui.mini} level={w.ui.level} assist={w.assist} seed={w.s.seed + w.s.stats.minis * 7 + w.tick} snd={sndRef.current} onDone={ok => { w.miniDone(ok); persist(w.s); play.bump(); }} />}
              {mapOpen && <PaintedMap play={play} onClose={resume} />}
              {phone && <PhoneView play={play} onClose={resume} />}
              {paused && <Pause play={play} snd={sndRef.current} touch={touch} onReplay={replay} onClose={resume} onQuit={toTitle} onSave={() => persist(w.s)} onNew={() => { setPaused(false); setScreen('title'); setPick(true); }} />}
              {story === 'intro' && <Storybook onDone={() => storyDone()} />}
              {story === 'chapter' && <ChapterCard ch={Math.min(9, chapterOf(w.s))} onDone={() => storyDone()} />}
              {story === 'ending' && <Ending hero={w.s.hero} isle={play.endingKind === 'isle'} lights={play.endingKind === 'lights'} coast={play.endingKind === 'coast'} lake={play.endingKind === 'lake'} onDone={() => { sndRef.current?.fx([{ t: 'chapter' }]); setStory('credits'); }} />}
              {story === 'credits' && <Credits onDone={() => storyDone()} />}
              <ArtWait play={play} />
            </>
          )}
        </section>
      )}
    </main>
  );
}
