'use client';
// Moth Hoop: the page. Title, the six kits on Ah Ma's table, the brief, the hoop, pause and results. Keys for one or
// two players on one keyboard (player 2 joins by pressing Enter), the fixed-step loop, the save (`moth-hoop-v1`)
// and the sound. Rules in lib/moth-game.ts, the stitch renderer in lib/moth-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MothGame, Bot, DT, W, HOOPS, SAVE_KEY, freshSave, parseSave, hoopOpen, record, type Input, type SaveData, type Stats } from '@/lib/moth-game';
import { MothScene } from '@/lib/moth-scene';
import { MOTH_PATTERNS } from '@/lib/moth-patterns';
import { MOTH_IMG } from '@/lib/moth-art';
import { MothSound } from './sound';
import './moth.css';

type Screen = 'loading' | 'title' | 'hoops' | 'brief' | 'play' | 'results';
const HINT_SOLO = 'A D or arrows move · Space, W or Up throws (hold it) · Q swaps who sews · Enter: player 2 joins · Esc pauses';
const HINT_DUO = 'Dora: A D move, W or Space throws · Enzo: arrows move, Up or Enter throws · Esc pauses';

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window */ } }

interface Pad { left: boolean; right: boolean; fire: boolean }
const freshPad = (): Pad => ({ left: false, right: false, fire: false });

export default function MothHoop() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MothGame | null>(null);
  const demoRef = useRef<{ g: MothGame; bot: Bot } | null>(null);
  const sceneRef = useRef<MothScene | null>(null);
  const soundRef = useRef<MothSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [twoP, setTwoP] = useState(false);
  const [thumbs, setThumbs] = useState<{ todo: string; done: string }[]>([]);
  const [result, setResult] = useState<{ hoop: number; stats: Stats; won: boolean; why: string | null; best: boolean } | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, twoP: false, save: freshSave(), sel: 0, overT: 0 });
  S.current = { ...S.current, screen, paused, twoP, save, sel };
  const pads = useRef<{ p1: Pad; p2: Pad }>({ p1: freshPad(), p2: freshPad() });

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); S.current.save = s; }, []);

  // ─────────────────────────────── setup
  useEffect(() => {
    const s = readSave(); setSave(s); S.current.save = s;
    const cv = cvRef.current!; const scene = new MothScene(cv); sceneRef.current = scene;
    const snd = new MothSound(); snd.musicOn = s.music; snd.sfxOn = s.sound; soundRef.current = snd;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(320, Math.round(r.width * d)); cv.height = Math.round(cv.width * 9 / 16); };
    fit(); window.addEventListener('resize', fit);
    void scene.load().then(() => {
      setThumbs(HOOPS.map((h) => ({ todo: scene.thumb(MOTH_PATTERNS[h.pattern], false, 4).toDataURL(), done: scene.thumb(MOTH_PATTERNS[h.pattern], true, 6).toDataURL() })));
      // the attract mode behind the title: a bot sewing the first kit
      demoRef.current = { g: new MothGame({ hoop: 0, seed: 17 }), bot: new Bot(17, 0.8) };
      setScreen('title');
    });
    (window as unknown as { __moth: () => unknown }).__moth = () => ({ game: gameRef.current, screen: S.current.screen, paused: S.current.paused, twoP: S.current.twoP, save: S.current.save, sel: S.current.sel });
    return () => { window.removeEventListener('resize', fit); snd.stop(); };
  }, []);

  // the stitched title lettering
  useEffect(() => {
    if (screen !== 'title' || !titleRef.current) return;
    const c = titleRef.current; c.width = 1100; c.height = 170;
    const sc = new MothScene(c); void sc.load().then(() => { sc.ctx.clearRect(0, 0, c.width, c.height); sc.stitchText('MOTH HOOP', 550, 18, 18, '#8a2a1e', 'center', true); });
  }, [screen]);

  const begin = useCallback((hi: number) => {
    const scene = sceneRef.current!; scene.reset();
    const g = new MothGame({ hoop: hi, seed: (Date.now() & 0xffff) + hi * 977, assist: S.current.save.assist, twoP: S.current.twoP, sewer: S.current.save.sewer });
    gameRef.current = g; S.current.overT = 0;
    scene.hint = S.current.twoP ? HINT_DUO : HINT_SOLO;
    scene.say(HOOPS[hi].name, HOOPS[hi].place, 2.4);
    pads.current = { p1: freshPad(), p2: freshPad() };
    setPaused(false); setScreen('play'); S.current.screen = 'play';
    soundRef.current?.music(HOOPS[hi].queen ? 'queen' : 'hoop');
  }, []);
  const toHoops = useCallback(() => { setPaused(false); setScreen('hoops'); S.current.screen = 'hoops'; soundRef.current?.music('title'); }, []);
  const brief = (hi: number) => { if (!hoopOpen(S.current.save, hi)) return; setSel(hi); setScreen('brief'); soundRef.current?.play('click'); };

  // ─────────────────────────────── keys
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      soundRef.current?.start();
      const scr = S.current.screen, code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (scr === 'title') { if (code === 'Enter' || code === 'Space') { toHoops(); soundRef.current?.play('click'); } return; }
      if (scr === 'hoops') {
        const n = HOOPS.length;
        if (code === 'ArrowRight' || code === 'KeyD') setSel((v) => Math.min(n - 1, v + 1));
        if (code === 'ArrowLeft' || code === 'KeyA') setSel((v) => Math.max(0, v - 1));
        if (code === 'ArrowDown' || code === 'KeyS') setSel((v) => Math.min(n - 1, v + 3));
        if (code === 'ArrowUp' || code === 'KeyW') setSel((v) => Math.max(0, v - 3));
        if (code === 'Enter' || code === 'Space') brief(S.current.sel);
        if (code === 'Digit2') setTwoP((v) => !v);
        if (code === 'Escape') { setScreen('title'); }
        return;
      }
      if (scr === 'brief') { if (code === 'Enter' || code === 'Space') begin(S.current.sel); if (code === 'Escape') toHoops(); return; }
      if (scr === 'results') {
        const r = resRef.current; if (!r) return;
        if (code === 'Enter' || code === 'Space') { if (r.won && r.hoop + 1 < HOOPS.length) { setSel(r.hoop + 1); setScreen('brief'); } else toHoops(); }
        if (code === 'KeyR') begin(r.hoop);
        if (code === 'Escape') toHoops();
        return;
      }
      if (scr !== 'play') return;
      const g = gameRef.current;
      if (code === 'Escape' || code === 'KeyP') { if (!g?.over) setPaused((p) => !p); return; }
      if (S.current.paused) { if (code === 'KeyQ') toHoops(); if (code === 'KeyR' && g) begin(g.hoop); return; }
      if (!g || g.over) return;
      const two = S.current.twoP;
      if (!two && (code === 'Enter' || code === 'NumpadEnter')) {
        g.join(); setTwoP(true); S.current.twoP = true;
        sceneRef.current!.hint = HINT_DUO; sceneRef.current!.say('Player 2 joins!', 'Enzo takes his own reel: arrows move, Up throws', 2.4);
        return;
      }
      if (code === 'KeyQ' && !two) { g.swap(); persist({ ...S.current.save, sewer: g.heroes.find((h) => h.ctrl === 'p1')!.id }); return; }
      const p1 = pads.current.p1, p2 = pads.current.p2;
      const P1M: Record<string, keyof Pad> = { KeyA: 'left', KeyD: 'right', KeyW: 'fire', Space: 'fire', KeyK: 'fire' };
      const ARR: Record<string, keyof Pad> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'fire', Enter: 'fire', Numpad0: 'fire', NumpadEnter: 'fire' };
      if (P1M[code]) p1[P1M[code]] = true;
      if (ARR[code]) (two ? p2 : p1)[ARR[code]] = true;
    };
    const ku = (e: KeyboardEvent) => {
      const P1M: Record<string, keyof Pad> = { KeyA: 'left', KeyD: 'right', KeyW: 'fire', Space: 'fire', KeyK: 'fire' };
      const ARR: Record<string, keyof Pad> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'fire', Enter: 'fire', Numpad0: 'fire', NumpadEnter: 'fire' };
      const p1 = pads.current.p1, p2 = pads.current.p2, two = S.current.twoP;
      if (P1M[e.code]) p1[P1M[e.code]] = false;
      if (ARR[e.code]) (two ? p2 : p1)[ARR[e.code]] = false;
    };
    const blur = () => { pads.current = { p1: freshPad(), p2: freshPad() }; if (S.current.screen === 'play' && !gameRef.current?.over) setPaused(true); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, [begin, toHoops, persist]);

  const resRef = useRef(result); resRef.current = result;

  // ─────────────────────────────── the loop
  useEffect(() => {
    let raf = 0, acc = 0, last = performance.now();
    const sounds = (g: MothGame) => {
      const snd = soundRef.current; if (!snd) return;
      for (const e of g.events) switch (e.k) {
        case 'stitch': snd.stitch(e.cells.map((i) => Math.floor(i / W))); break;
        case 'pin': snd.play(e.dead ? (e.foe === 'silk' ? 'silk' : e.foe === 'queen' ? 'queen' : 'pin') : 'tick'); break;
        case 'hurt': snd.play(e.blocked ? 'block' : 'hurt'); break;
        case 'win': snd.play('win'); break;
        case 'lose': snd.play('lose'); break;
        case 'throw': case 'darn': case 'chew': case 'hole': case 'shiver': case 'dive': case 'drop': case 'power': case 'row': case 'hatch': case 'egg': snd.play(e.k); break;
      }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const scene = sceneRef.current; if (!scene || !scene.ready) return;
      const scr = S.current.screen;
      if (scr !== 'play') {
        // attract mode: the bot sews the kopi kit behind the menus, and starts over when it finishes
        const d = demoRef.current; if (!d) return;
        acc += dt;
        while (acc >= DT) { acc -= DT; const h = d.g.heroes[0]; d.g.step(d.bot.input(d.g, h)); scene.ingest(d.g.events, d.g); }
        if (d.g.over) { S.current.overT += dt; if (S.current.overT > 4) { S.current.overT = 0; scene.reset(); demoRef.current = { g: new MothGame({ hoop: 0, seed: (Date.now() & 0xffff) }), bot: new Bot(now | 0, 0.8) }; } }
        scene.hint = ''; scene.draw(d.g, dt);
        return;
      }
      const g = gameRef.current; if (!g) return;
      if (!S.current.paused) {
        if (scene.hitStop > 0) { scene.hitStop -= dt; acc = 0; }
        else {
          acc += dt;
          while (acc >= DT) {
            acc -= DT;
            const p1 = pads.current.p1, p2 = pads.current.p2;
            g.step({ ...p1 }, { ...p2 });
            scene.ingest(g.events, g); sounds(g);
            if (g.over) break;
          }
        }
        if (g.over) { S.current.overT += dt; if (S.current.overT > 2.6 && S.current.screen === 'play') finish(g); }
      } else acc = 0;
      scene.draw(g, S.current.paused ? 0 : dt);
    };
    const finish = (g: MothGame) => {
      const st = g.stats(), prev = S.current.save.best[g.hoop];
      const s = record(S.current.save, g.hoop, st); persist(s);
      setResult({ hoop: g.hoop, stats: st, won: g.over === 'win', why: g.why, best: st.stars > 0 && st.score > prev });
      setScreen('results'); S.current.screen = 'results'; S.current.overT = 0;
      soundRef.current?.music('title');
      if (g.over === 'win' && g.hoop + 1 < HOOPS.length) setSel(g.hoop + 1);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [persist]);

  const toggle = (k: 'assist' | 'music' | 'sound') => {
    const s = { ...save, [k]: !save[k] }; persist(s);
    if (k === 'music') soundRef.current?.setMusic(s.music);
    if (k === 'sound' && soundRef.current) soundRef.current.sfxOn = s.sound;
    if (k === 'assist' && gameRef.current) gameRef.current.assist = s.assist;
  };
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const menu = screen === 'title' || screen === 'hoops' || screen === 'brief' || screen === 'results';

  return (
    <main className="mh" data-ready={screen !== 'loading' ? 'true' : 'false'} data-screen={screen}>
      <div className="mh-stage">
        <canvas ref={cvRef} className={`mh-cv${menu ? ' dim' : ''}`} />
        {screen === 'loading' && <div className="mh-load"><p>Threading the needle…</p></div>}
        {screen === 'title' && (
          <div className="mh-title" onClick={() => { soundRef.current?.start(); toHoops(); }}>
            <img src={MOTH_IMG('title')} alt="Dora and Enzo stitched into an embroidery hoop, riding a cotton reel and throwing a needle at the moths" />
            <canvas ref={titleRef} className="mh-logo" aria-label="Moth Hoop" />
            <div className="mh-press">Press Enter or Space</div>
            <a href="/" className="mh-back" onClick={(e) => e.stopPropagation()}>← Arcade</a>
          </div>
        )}
        {screen === 'hoops' && (
          <div className="mh-menu">
            <div className="mh-card mh-wide">
              <h1>Ah Ma&rsquo;s kits</h1>
              <p className="lede">Ah Ma left six cross-stitch kits half-done on her table in Tiong Bahru, and the moths found them. Throw needles up into each printed picture to stitch it, and pin the moths before they chew it into holes.</p>
              <div className="mh-hoops">
                {HOOPS.map((h, i) => {
                  const open = hoopOpen(save, i), st = save.stars[i];
                  return (
                    <button key={h.id} data-hoop={i} className={`mh-hoop${sel === i ? ' sel' : ''}${open ? '' : ' locked'}`}
                      onClick={() => { soundRef.current?.start(); setSel(i); if (open) brief(i); }} aria-disabled={!open}>
                      <span className="frame">{thumbs[i] && <img src={st > 0 ? thumbs[i].done : thumbs[i].todo} alt="" />}</span>
                      <b>{i + 1}. {h.name}</b>
                      <i>{h.place}</i>
                      <em>{open ? (st > 0 ? `${stars(st)} · best ${save.best[i]}` : 'Not stitched yet') : `Finish ${HOOPS[i - 1].name} to open`}</em>
                    </button>
                  );
                })}
              </div>
              <div className="mh-opts">
                <button data-opt="players" onClick={() => setTwoP((v) => !v)}>Players: {twoP ? 'two' : 'one'}</button>
                <button data-opt="sewer" onClick={() => persist({ ...save, sewer: save.sewer === 'dora' ? 'enzo' : 'dora' })}>Sewing: {save.sewer === 'dora' ? 'Dora' : 'Enzo'}</button>
                <button data-opt="assist" onClick={() => toggle('assist')}>Gentle moths: {save.assist ? 'on' : 'off'}</button>
                <button data-opt="music" onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button data-opt="sound" onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">Arrows or WASD pick a kit · Enter opens it · 2 switches players · Esc goes back</p>
            </div>
            <a href="/" className="mh-back">← Arcade</a>
          </div>
        )}
        {screen === 'brief' && (
          <div className="mh-menu" onClick={() => begin(sel)}>
            <div className="mh-card">
              <span className="tag">Kit {sel + 1} of {HOOPS.length} · {HOOPS[sel].place}</span>
              <h2>{HOOPS[sel].name}</h2>
              {thumbs[sel] && <img className="mh-preview" src={thumbs[sel].todo} alt={`The printed kit: ${HOOPS[sel].place}`} />}
              <p>{HOOPS[sel].blurb}</p>
              <ul>
                <li>Your needle flies straight up. It <b>stitches</b> the first unstitched part of the picture it meets, or <b>pins</b> the first moth in its way.</li>
                <li>A moth on your stitches chews them into <b>holes</b> (watch the red ring). A hole takes one needle to darn before it can be stitched.</li>
                <li>Finish every stitch to win. Too many holes and the cloth <b>tears</b>; three hits from diving moths and you&rsquo;re out of <b>spools</b>.</li>
              </ul>
              <p className="keys">{twoP ? HINT_DUO : HINT_SOLO}</p>
              <div className="mh-press">Press Enter or Space to start</div>
            </div>
          </div>
        )}
        {screen === 'play' && paused && (
          <div className="mh-menu">
            <div className="mh-card">
              <h2>Paused</h2>
              <p>Esc or P to sew on · R to start the kit again · Q to put it down and go back to the kits</p>
              <div className="mh-opts">
                <button onClick={() => toggle('assist')}>Gentle moths: {save.assist ? 'on' : 'off'}</button>
                <button onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">{twoP ? HINT_DUO : HINT_SOLO}</p>
            </div>
          </div>
        )}
        {screen === 'results' && result && (
          <div className="mh-menu">
            <div className="mh-card">
              <span className="tag">Kit {result.hoop + 1} · {HOOPS[result.hoop].name}</span>
              <h2>{result.won ? 'Finished!' : result.why === 'tear' ? 'The cloth tore' : 'Out of spools'}</h2>
              {result.won && thumbs[result.hoop] && <img className="mh-preview framed" src={thumbs[result.hoop].done} alt={`The finished cross stitch: ${HOOPS[result.hoop].place}`} />}
              {result.won && <p className="stars" aria-label={`${result.stats.stars} of 3 stars`}>{stars(result.stats.stars)}</p>}
              {!result.won && <p>{result.why === 'tear' ? 'The moths chewed too many holes. Pin the ones with a red ring first: they are the ones eating your stitches.' : 'The gold moths knocked the reels over. When one shivers, a dotted line shows where it will dive: step out of it.'}</p>}
              <table><tbody>
                <tr><td>Score</td><td>{result.stats.score}{result.best ? ' · best!' : ''}</td></tr>
                <tr><td>Time</td><td>{mmss(result.stats.time)} (par {mmss(HOOPS[result.hoop].par)})</td></tr>
                <tr><td>Stitches sewn</td><td>{result.stats.stitched}</td></tr>
                <tr><td>Moths pinned</td><td>{result.stats.pinned}</td></tr>
                <tr><td>Holes darned</td><td>{result.stats.darned}</td></tr>
                <tr><td>Spools lost</td><td>{result.stats.spoolsLost}</td></tr>
              </tbody></table>
              {result.won && <p className="small">Stars: one for finishing, one for keeping every spool, one for beating par.</p>}
              <p className="mh-press">{result.won && result.hoop + 1 < HOOPS.length ? `Enter: on to ${HOOPS[result.hoop + 1].name}` : result.won ? 'Every kit is finished. Ah Ma will be so pleased. Enter: back to the kits' : 'Enter: back to the kits'} · R: sew it again</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
