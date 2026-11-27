'use client';
// Tambak: the page. Title, the six reclamation sites on the sand artist's table, the brief, the lightbox, pause and
// results. Keys for one or two players on one keyboard (player 2 joins by pressing Enter), the fixed-step loop, the
// save (`tambak-v1`) and the sound. Rules in lib/tambak-game.ts, the sand renderer in lib/tambak-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { TambakGame, Bot, DT, SITES, SAVE_KEY, freshSave, parseSave, siteOpen, record, type Dir, type HeroId, type SaveData, type Stats } from '@/lib/tambak-game';
import { TambakScene } from '@/lib/tambak-scene';
import { TAMBAK_IMG } from '@/lib/tambak-art';
import { TambakSound } from './sound';
import './tambak.css';

type Screen = 'loading' | 'title' | 'sites' | 'brief' | 'play' | 'results';
const HINT_SOLO = 'WASD or arrows walk · step into the sea to pour sand · Q swaps · Enter: player 2 · Esc pause';
const NAME: Record<HeroId, string> = { dora: 'Dora', enzo: 'Enzo' };
const other = (h: HeroId): HeroId => (h === 'dora' ? 'enzo' : 'dora');
/** the two-player keys, naming whoever is player one and player two */
const hintDuo = (p1: HeroId) => `${NAME[p1]}: WASD · ${NAME[other(p1)]}: arrows · Esc pause`;

function readSave(): SaveData { try { return parseSave(localStorage.getItem(SAVE_KEY)) ?? freshSave(); } catch { return freshSave(); } }
function writeSave(s: SaveData) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private window */ } }

/** held directions in the order they were pressed; the newest one held wins */
type Pad = Dir[];
const WASD: Record<string, Dir> = { KeyW: 1, KeyD: 2, KeyS: 3, KeyA: 4 };
const ARROWS: Record<string, Dir> = { ArrowUp: 1, ArrowRight: 2, ArrowDown: 3, ArrowLeft: 4 };
const top = (p: Pad): Dir => p[p.length - 1] ?? 0;

export default function Tambak() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TambakGame | null>(null);
  const demoRef = useRef<{ g: TambakGame; bot: Bot } | null>(null);
  const sceneRef = useRef<TambakScene | null>(null);
  const soundRef = useRef<TambakSound | null>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [save, setSave] = useState<SaveData>(freshSave);
  const [sel, setSel] = useState(0);
  const [paused, setPaused] = useState(false);
  const [twoP, setTwoP] = useState(false);
  const [result, setResult] = useState<{ site: number; stats: Stats; won: boolean; why: string | null; best: boolean } | null>(null);
  const S = useRef({ screen: 'loading' as Screen, paused: false, twoP: false, save: freshSave(), sel: 0, overT: 0 });
  S.current = { ...S.current, screen, paused, twoP, save, sel };
  const pads = useRef<{ p1: Pad; p2: Pad }>({ p1: [], p2: [] });
  const resRef = useRef(result); resRef.current = result;

  const persist = useCallback((s: SaveData) => { setSave(s); writeSave(s); S.current.save = s; }, []);

  // ─────────────────────────────── setup
  useEffect(() => {
    const s = readSave(); setSave(s); S.current.save = s;
    const cv = cvRef.current!; const scene = new TambakScene(cv); sceneRef.current = scene;
    const snd = new TambakSound(); snd.musicOn = s.music; snd.sfxOn = s.sound; soundRef.current = snd;
    const fit = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(320, Math.round(r.width * d)); cv.height = Math.round(cv.width * 9 / 16); };
    fit(); window.addEventListener('resize', fit);
    void scene.load().then(() => {
      // the attract mode behind the menus: a bot pouring East Coast Park
      demoRef.current = { g: new TambakGame({ site: 0, seed: 17 }), bot: new Bot(17, 0.8) };
      setScreen('title');
    });
    (window as unknown as { __tambak: () => unknown }).__tambak = () => ({ game: gameRef.current, demo: demoRef.current?.g, scene: sceneRef.current, screen: S.current.screen, paused: S.current.paused, twoP: S.current.twoP, save: S.current.save, sel: S.current.sel, pads: pads.current });
    return () => { window.removeEventListener('resize', fit); snd.stop(); };
  }, []);

  // the poured-sand title lettering
  useEffect(() => {
    if (screen !== 'title' || !titleRef.current) return;
    const c = titleRef.current; c.width = 1000; c.height = 230;
    const sc = new TambakScene(c); sc.ctx.clearRect(0, 0, c.width, c.height); sc.sandText('TAMBAK', 500, 120, 190);
  }, [screen]);

  const begin = useCallback((si: number) => {
    const scene = sceneRef.current!; scene.reset();
    const g = new TambakGame({ site: si, seed: (Date.now() & 0xffff) + si * 977, assist: S.current.save.assist, twoP: S.current.twoP, lead: S.current.save.lead });
    gameRef.current = g; S.current.overT = 0;
    scene.hint = S.current.twoP ? hintDuo(S.current.save.lead) : HINT_SOLO;
    scene.say(SITES[si].name, `Pour ${g.target}% of the sea into land before the tide comes in`, 2.6);
    pads.current = { p1: [], p2: [] };
    setPaused(false); setScreen('play'); S.current.screen = 'play';
    soundRef.current?.music(SITES[si].foes.includes('boss') ? 'boss' : 'site');
  }, []);
  const toSites = useCallback(() => { setPaused(false); setScreen('sites'); S.current.screen = 'sites'; soundRef.current?.music('title'); }, []);
  const brief = (si: number) => { if (!siteOpen(S.current.save, si)) return; setSel(si); setScreen('brief'); soundRef.current?.play('click'); };

  // ─────────────────────────────── keys
  useEffect(() => {
    const press = (p: Pad, d: Dir) => { const i = p.indexOf(d); if (i >= 0) p.splice(i, 1); p.push(d); };
    const lift = (p: Pad, d: Dir) => { const i = p.indexOf(d); if (i >= 0) p.splice(i, 1); };
    const kd = (e: KeyboardEvent) => {
      soundRef.current?.start();
      const scr = S.current.screen, code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      // held keys auto-repeat; the pads already hold the state, so a repeat must never act again
      if (e.repeat) return;
      if (scr === 'title') { if (code === 'Enter' || code === 'Space') { toSites(); soundRef.current?.play('click'); } return; }
      if (scr === 'sites') {
        const n = SITES.length;
        if (code === 'ArrowRight' || code === 'KeyD') setSel((v) => Math.min(n - 1, v + 1));
        if (code === 'ArrowLeft' || code === 'KeyA') setSel((v) => Math.max(0, v - 1));
        if (code === 'ArrowDown' || code === 'KeyS') setSel((v) => Math.min(n - 1, v + 3));
        if (code === 'ArrowUp' || code === 'KeyW') setSel((v) => Math.max(0, v - 3));
        if (code === 'Enter' || code === 'Space') brief(S.current.sel);
        if (code === 'Digit2') setTwoP((v) => !v);
        if (code === 'Escape') setScreen('title');
        return;
      }
      if (scr === 'brief') { if (code === 'Enter' || code === 'Space') begin(S.current.sel); if (code === 'Escape') toSites(); return; }
      if (scr === 'results') {
        const r = resRef.current; if (!r) return;
        if (code === 'Enter' || code === 'Space') { if (r.won && r.site + 1 < SITES.length) { setSel(r.site + 1); setScreen('brief'); } else toSites(); }
        if (code === 'KeyR') begin(r.site);
        if (code === 'Escape') toSites();
        return;
      }
      if (scr !== 'play') return;
      const g = gameRef.current;
      if (code === 'Escape' || code === 'KeyP') { if (!g?.over) { setPaused((p) => !p); pads.current = { p1: [], p2: [] }; } return; }
      if (S.current.paused) { if (code === 'KeyQ') toSites(); if (code === 'KeyR' && g) begin(g.site); return; }
      if (!g || g.over) return;
      const two = S.current.twoP;
      if (!two && (code === 'Enter' || code === 'NumpadEnter')) {
        g.join(); setTwoP(true); S.current.twoP = true;
        // the arrows change owner now: drop whatever either pad held so nothing sticks down
        pads.current = { p1: [], p2: [] };
        sceneRef.current!.hint = hintDuo(g.heroes[0].id); soundRef.current?.play('join');
        return;
      }
      if (code === 'KeyQ' && !two) { g.swap(); persist({ ...S.current.save, lead: g.heroes[0].id }); soundRef.current?.play('click'); return; }
      if (WASD[code]) press(pads.current.p1, WASD[code]);
      if (ARROWS[code]) press(two ? pads.current.p2 : pads.current.p1, ARROWS[code]);
    };
    const ku = (e: KeyboardEvent) => {
      const two = S.current.twoP;
      if (WASD[e.code]) lift(pads.current.p1, WASD[e.code]);
      if (ARROWS[e.code]) lift(two ? pads.current.p2 : pads.current.p1, ARROWS[e.code]);
    };
    const blur = () => { pads.current = { p1: [], p2: [] }; if (S.current.screen === 'play' && !gameRef.current?.over) setPaused(true); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }, [begin, toSites, persist]);

  // ─────────────────────────────── the loop
  useEffect(() => {
    let raf = 0, acc = 0, last = performance.now();
    const sounds = (g: TambakGame) => {
      const snd = soundRef.current; if (!snd) return;
      for (const e of g.events) switch (e.k) {
        case 'pour': snd.pour(g.heroes[e.hero]?.trail.length ?? 0); break;
        case 'claim': snd.claim(e.cells.length); if (e.picks.length) snd.play('pick'); break;
        case 'hurt': snd.play('hurt'); break;
        case 'win': case 'lose': case 'snap': case 'puff': case 'bump': case 'spawn': case 'crab': case 'tide': snd.play(e.k); break;
      }
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const scene = sceneRef.current; if (!scene || !scene.ready) return;
      const scr = S.current.screen;
      if (scr !== 'play') {
        // attract mode: a bot pours East Coast Park behind the menus, and starts over when it finishes
        const d = demoRef.current; if (!d) return;
        scene.demo = true; acc += dt;
        while (acc >= DT) { acc -= DT; d.g.step(d.bot.input(d.g, d.g.heroes[0])); scene.ingest(d.g.events, d.g); }
        if (d.g.over) { S.current.overT += dt; if (S.current.overT > 4) { S.current.overT = 0; scene.reset(); demoRef.current = { g: new TambakGame({ site: 0, seed: (Date.now() & 0xffff) }), bot: new Bot(now | 0, 0.8) }; } }
        scene.hint = ''; scene.draw(d.g, dt);
        return;
      }
      const g = gameRef.current; if (!g) return;
      scene.demo = false;
      if (!S.current.paused) {
        if (scene.hitStop > 0) { scene.hitStop -= dt; acc = 0; }
        else {
          acc += dt;
          while (acc >= DT) {
            acc -= DT;
            g.step(top(pads.current.p1), top(pads.current.p2));
            scene.ingest(g.events, g); sounds(g);
            if (g.over) break;
          }
        }
        if (g.over) { S.current.overT += dt; if (S.current.overT > 2.8 && S.current.screen === 'play') finish(g); }
      } else acc = 0;
      scene.draw(g, S.current.paused ? 0 : dt);
    };
    const finish = (g: TambakGame) => {
      const st = g.stats(), prev = S.current.save.best[g.site];
      const s = record(S.current.save, g.site, st); persist(s);
      setResult({ site: g.site, stats: st, won: g.over === 'win', why: g.why, best: st.stars > 0 && st.score > prev });
      setScreen('results'); S.current.screen = 'results'; S.current.overT = 0;
      sceneRef.current?.reset();
      soundRef.current?.music('title');
      if (g.over === 'win' && g.site + 1 < SITES.length) setSel(g.site + 1);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [persist]);

  const toggle = (k: 'assist' | 'music' | 'sound') => {
    const s = { ...save, [k]: !save[k] }; persist(s);
    if (k === 'music') soundRef.current?.setMusic(s.music);
    if (k === 'sound' && soundRef.current) soundRef.current.sfxOn = s.sound;
  };
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const menu = screen === 'title' || screen === 'sites' || screen === 'brief' || screen === 'results';
  const keys = twoP ? hintDuo(save.lead) : HINT_SOLO;

  return (
    <main className="tb" data-ready={screen !== 'loading' ? 'true' : 'false'} data-screen={screen}>
      <div className="tb-stage">
        <canvas ref={cvRef} className={`tb-cv${menu ? ' dim' : ''}`} />
        {screen === 'loading' && <div className="tb-load"><p>Sifting the sand…</p></div>}
        {screen === 'title' && (
          <div className="tb-title" onClick={() => { soundRef.current?.start(); toSites(); }}>
            <img src={TAMBAK_IMG('title')} alt="Dora and Enzo in hi-vis vests and safety helmets pouring sand into the sea off Singapore, with a crocodile, a jellyfish and a pufferfish swimming round them, all in coloured sand" />
            <canvas ref={titleRef} className="tb-logo" aria-label="Tambak" />
            <div className="tb-press">Press Enter or Space</div>
            <a href="/" className="tb-back" onClick={(e) => e.stopPropagation()}>← Arcade</a>
          </div>
        )}
        {screen === 'sites' && (
          <div className="tb-menu tb-table">
            <div className="tb-card tb-wide">
              <h1>Six shores to fill</h1>
              <p className="lede">A quarter of Singapore stands on land poured into the sea. Walk the shore, step out into the water to pour a line of sand, and come back to land to fill in every patch of sea the creatures aren&rsquo;t swimming in. Each place appears in sand as you pour it.</p>
              <div className="tb-sites">
                {SITES.map((st, i) => {
                  const open = siteOpen(save, i), n = save.stars[i];
                  return (
                    <button key={st.id} data-site={i} className={`tb-site${sel === i ? ' sel' : ''}${open ? '' : ' locked'}${n > 0 ? ' done' : ''}`}
                      onClick={() => { soundRef.current?.start(); setSel(i); if (open) brief(i); }} aria-disabled={!open}>
                      <span className="frame"><img src={TAMBAK_IMG(st.pic)} alt="" /></span>
                      <b>{i + 1}. {st.name}</b>
                      <i>{st.place}</i>
                      <em>{open ? (n > 0 ? `${stars(n)} · best ${save.best[i]}` : 'Still sea') : `Fill ${SITES[i - 1].name} to open`}</em>
                    </button>
                  );
                })}
              </div>
              <div className="tb-opts">
                <button data-opt="players" onClick={() => setTwoP((v) => !v)}>Players: {twoP ? 'two' : 'one'}</button>
                <button data-opt="lead" onClick={() => persist({ ...save, lead: other(save.lead) })}>Pouring: {NAME[save.lead]}</button>
                <button data-opt="assist" onClick={() => toggle('assist')}>Gentle tides: {save.assist ? 'on' : 'off'}</button>
                <button data-opt="music" onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button data-opt="sound" onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">Arrows or WASD pick a shore · Enter opens it · 2 switches players · Esc goes back</p>
            </div>
            <a href="/" className="tb-back">← Arcade</a>
          </div>
        )}
        {screen === 'brief' && (
          <div className="tb-menu tb-table" onClick={() => begin(sel)}>
            <div className="tb-card">
              <span className="tag">Shore {sel + 1} of {SITES.length} · {SITES[sel].place}</span>
              <h2>{SITES[sel].name}</h2>
              <img className="tb-preview" src={TAMBAK_IMG(SITES[sel].pic)} alt={`The sand picture you will uncover: ${SITES[sel].name}`} />
              <p>{SITES[sel].blurb}</p>
              <ul>
                <li>Walk the land freely. Step into the <b>sea</b> and you pour a line of sand behind you; step back onto land and the line turns to land, along with every patch of sea that has <b>no creature in it</b>.</li>
                <li>A creature that touches your line <b>washes it away</b> and costs a sand <b>bucket</b>. Your own line is a wall: you can&rsquo;t walk back over it.</li>
                <li>Fill <b>{save.assist ? 70 : SITES[sel].target}%</b> of the sea before the <b>tide</b> comes in ({mmss(SITES[sel].tide * (save.assist ? 1.25 : 1))}). Claim the floating kopi, net or bucket by filling the water around it.</li>
              </ul>
              <p className="keys">{keys}</p>
              <div className="tb-press">Press Enter or Space to start</div>
            </div>
          </div>
        )}
        {screen === 'play' && paused && (
          <div className="tb-menu">
            <div className="tb-card">
              <h2>Paused</h2>
              <p>Esc or P to pour on · R to start this shore again · Q to go back to the shores</p>
              <div className="tb-opts">
                <button data-opt="assist" onClick={() => toggle('assist')}>Gentle tides: {save.assist ? 'on' : 'off'} (from the next start)</button>
                <button data-opt="music" onClick={() => toggle('music')}>Music: {save.music ? 'on' : 'off'}</button>
                <button data-opt="sound" onClick={() => toggle('sound')}>Sound: {save.sound ? 'on' : 'off'}</button>
              </div>
              <p className="keys">{keys}</p>
            </div>
          </div>
        )}
        {screen === 'results' && result && (
          <div className="tb-menu tb-table">
            <div className="tb-card">
              <span className="tag">Shore {result.site + 1} · {SITES[result.site].name}</span>
              <h2>{result.won ? `${SITES[result.site].name} is land!` : result.why === 'tide' ? 'The tide came in' : 'Out of sand buckets'}</h2>
              {result.won && <img className="tb-preview" src={TAMBAK_IMG(SITES[result.site].pic)} alt={`The finished sand picture: ${SITES[result.site].name}`} />}
              {result.won && <p className="stars" aria-label={`${result.stats.stars} of 3 stars`}>{stars(result.stats.stars)}</p>}
              {!result.won && <p>{result.why === 'tide' ? 'Long lines straight across the water fill the most: when every creature is on one side, the whole other side turns to land at once.' : 'Head for land the moment a creature turns toward your line. The crocodiles are quick, and the pufferfish grows when it puffs.'}</p>}
              <table><tbody>
                <tr><td>Score</td><td>{result.stats.score}{result.best ? ' · best!' : ''}</td></tr>
                <tr><td>Time</td><td>{mmss(result.stats.time)} (par {mmss(SITES[result.site].par)})</td></tr>
                <tr><td>Sea filled</td><td>{result.stats.claimed}%</td></tr>
                <tr><td>Biggest single fill</td><td>{result.stats.biggest} squares</td></tr>
                <tr><td>Pickups claimed</td><td>{result.stats.picks}</td></tr>
                <tr><td>Buckets lost</td><td>{result.stats.bucketsLost}</td></tr>
              </tbody></table>
              {result.won && <p className="small">Stars: one for filling it, one for keeping every bucket, one for beating par.</p>}
              <p className="tb-press">{result.won && result.site + 1 < SITES.length ? `Enter: on to ${SITES[result.site + 1].name}` : result.won ? 'Every shore is land. Enter: back to the shores' : 'Enter: back to the shores'} · R: pour it again</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
