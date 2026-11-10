'use client';
// Salt & Dust: the page. The title, the game (a 1536×864 canvas scaled to fit, with an HTML HUD painted in woven cloth
// and stamped copper over it), the dialogue panel, the journey's choices, the fight's action bar and the ending card.
// Rules in lib/salt-dust-game.ts, drawing in lib/salt-dust-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SaltGame, freshSave, parseSave, SAVE_KEY, HEROES, WATER_MAX, MAPS, RULES, SKILL_NAME, PORTRAIT_INDEX, MAP_NODES,
  type HeroId, type PortraitId, type Unit,
} from '@/lib/salt-dust-game';
import { SaltScene, type SceneUi } from '@/lib/salt-dust-scene';
import { SaltSound } from './sound';
import './salt-dust.css';

type Screen = 'title' | 'game' | 'end';
type Settings = { help: boolean; sound: boolean; music: boolean };
const SETTINGS_KEY = 'salt-dust-v1-settings';
const DEFAULTS: Settings = { help: true, sound: true, music: true };
const ART = '/art/salt-dust/';

function loadSettings(): Settings {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'); return s && typeof s === 'object' ? { ...DEFAULTS, ...s } : DEFAULTS; } catch { return DEFAULTS; }
}
function readSave() { try { return parseSave(localStorage.getItem(SAVE_KEY)); } catch { return null; } }

function Portrait({ who, lit = false, dim = false, size }: { who: PortraitId; lit?: boolean; dim?: boolean; size?: string }) {
  if (who === 'none') return null;
  return (
    <span className={`sd-portrait${dim ? ' sd-dim' : ''}`} style={size ? { width: size, height: size } : undefined}>
      <span className="sd-face" style={{ backgroundPosition: `${(PORTRAIT_INDEX[who] / 7) * 100}% 0` }} />
      <img className="sd-frame" src={`${ART}${lit ? 'ui-frame-lit' : 'ui-frame'}.webp`} alt="" />
    </span>
  );
}
function Water({ g }: { g: SaltGame }) {
  return (
    <div className="sd-water" aria-label={`Water ${g.water} of ${WATER_MAX}`}>
      <img className="sd-canteen" src={`${ART}ui-canteen.webp`} alt="" />
      <span className="sd-water-text">Water {g.water} / {WATER_MAX}</span>
      <span className="sd-drops">{Array.from({ length: WATER_MAX }, (_, i) => <img key={i} src={`${ART}${i < g.water ? 'ui-drop' : 'ui-drop-empty'}.webp`} alt="" />)}</span>
      <span className="sd-silver">Silver {g.silver}</span>
    </div>
  );
}
function Party({ g }: { g: SaltGame }) {
  return (
    <div className="sd-party">
      {(['dora', 'enzo'] as HeroId[]).map((h) => {
        const hp = g.combat ? g.unit(h)!.hp : g.hp[h], max = HEROES[h].hp;
        return (
          <div key={h} className="sd-member">
            <Portrait who={h} lit={g.current()?.id === h} />
            <div className="sd-member-info">
              <b>{HEROES[h].name}</b>
              <span className="sd-bar"><span style={{ width: `${(Math.max(0, hp) / max) * 100}%` }} /><img src={`${ART}ui-bar.webp`} alt="" /></span>
              <small>{hp} / {max} health</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SaltDustPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<SaltGame | null>(null);
  const sceneRef = useRef<SaltScene | null>(null);
  const soundRef = useRef<SaltSound | null>(null);
  const uiRef = useRef<SceneUi>({ hover: null, px: -1, py: -1, help: true, aim: 'act' });
  const [screen, setScreen] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef(settings);
  const [hasSave, setHasSave] = useState(false);
  const [menu, setMenu] = useState(false);
  const [aim, setAim] = useState<'act' | 'mend'>('act');
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const foeWait = useRef(0);
  const lastMode = useRef('');

  const g = gameRef.current;
  const rerender = useCallback(() => setTick((t) => (t + 1) % 1e9), []);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { settingsRef.current = settings; uiRef.current.help = settings.help; if (gameRef.current) gameRef.current.help = settings.help; if (soundRef.current) soundRef.current.on = settings.sound; }, [settings]);
  useEffect(() => { uiRef.current.aim = aim; }, [aim]);

  const persist = useCallback(() => {
    const game = gameRef.current; if (!game) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.save())); } catch { /* private mode */ }
  }, []);
  const sfx = useCallback((id: string) => { if (settingsRef.current.sound) soundRef.current?.play(id); }, []);
  const changeSettings = (s: Settings) => {
    setSettings(s); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
    soundRef.current?.musicOn(s.music && s.sound && screenRef.current === 'game');
  };

  // first load: settings, the save, the art
  useEffect(() => {
    const s = loadSettings(); setSettings(s);
    setHasSave(!!readSave());
    soundRef.current = new SaltSound();
    const canvas = canvasRef.current!;
    const scene = new SaltScene(canvas); sceneRef.current = scene;
    scene.onSound = (id) => sfx(id);
    scene.load().then(() => setReady(true));
  }, [sfx]);

  const begin = useCallback((fresh: boolean) => {
    const save = fresh ? freshSave((Date.now() % 100000) + 1) : readSave() ?? freshSave();
    const game = new SaltGame(save); game.help = settingsRef.current.help;
    gameRef.current = game; sceneRef.current?.resetFight();
    setAim('act'); setMenu(false);
    soundRef.current?.start(); soundRef.current?.musicOn(settingsRef.current.music && settingsRef.current.sound);
    if (fresh) persist();
    setScreen(game.mode === 'end' ? 'end' : 'game');
  }, [persist]);

  // the loop
  useEffect(() => {
    let raf = 0, last = performance.now(), hud = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const game = gameRef.current, scene = sceneRef.current;
      if (!game || !scene || screenRef.current !== 'game') return;
      const before = game.mode;
      if (!menuRef.current) game.tick(dt);
      if (game.mode === 'combat') {
        if (game.events.length) scene.feed(game.events.splice(0));
        if (!scene.busy()) {
          const c = game.combat!;
          if (c.over) { game.syncFromCombat(); game.finishCombat(); scene.resetFight(); setAim('act'); persist(); }
          else {
            const u = game.current();
            if (u && u.side === 'foe') { foeWait.current += dt; if (foeWait.current > 0.45) { foeWait.current = 0; game.foeTurn(); } }
          }
        }
      }
      if (game.mode === 'finding' && before !== 'finding') { sfx('crank'); sfx('spring'); }
      if (game.mode !== lastMode.current) {
        if (lastMode.current === 'travel' && game.mode === 'explore') sfx('step');
        lastMode.current = game.mode;
        if (game.mode !== 'combat') persist();
        if (game.mode === 'end') { persist(); setScreen('end'); soundRef.current?.musicOn(false); }
      }
      if (game.journey && Math.random() < dt * 5) sfx('step');
      if (game.note) { setToast(game.note); game.note = null; window.setTimeout(() => setToast(null), 3200); }
      scene.draw(game, dt, uiRef.current);
      hud += dt; if (hud > 0.1) { hud = 0; rerender(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [persist, rerender, sfx]);
  const menuRef = useRef(false);
  useEffect(() => { menuRef.current = menu; }, [menu]);

  // pointer on the canvas
  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { px: ((e.clientX - r.left) / r.width) * 1536, py: ((e.clientY - r.top) / r.height) * 864 };
  };
  const onMove = (e: React.PointerEvent) => {
    const game = gameRef.current, scene = sceneRef.current; if (!game || !scene) return;
    const { px, py } = toCanvas(e);
    const p = scene.pick(game, px, py);
    uiRef.current.px = px; uiRef.current.py = py;
    uiRef.current.hover = game.mode === 'combat' ? scene.tileAt(game, px, py) : p && p.kind === 'tile' ? [p.x, p.y] : null;
  };
  const onClick = (e: React.PointerEvent) => {
    const game = gameRef.current, scene = sceneRef.current; if (!game || !scene || menu) return;
    soundRef.current?.start();
    const { px, py } = toCanvas(e);
    const p = scene.pick(game, px, py); if (!p) return;
    let did = false;
    if (game.mode === 'explore') {
      did = p.kind === 'npc' ? game.clickNpc(p.id) : p.kind === 'spot' ? game.clickSpot(p.id) : game.clickTile(p.x, p.y);
    } else if (game.mode === 'combat' && game.heroTurn() && !scene.busy()) {
      if (aim === 'mend') {
        if (p.kind === 'unit') did = game.mend(p.id);
        setAim('act');
      } else if (p.kind === 'unit' && game.unit(p.id)?.side === 'foe' && game.hitChance(game.current()!, game.unit(p.id)!) > 0) did = game.attack(p.id);
      else {
        // anything else under the pointer: the floor tile there
        const [tx, ty] = scene.tileAt(game, px, py);
        did = game.move(tx, ty);
      }
    }
    if (did) sfx('click');
    rerender();
  };

  const choose = useCallback((i: number) => {
    const game = gameRef.current; if (!game || game.mode !== 'talk') return;
    const o = game.options()[i]; if (!o || o.blocked) return;
    game.choose(i);
    sfx(o.check ? (o.pass ? 'pass' : 'fail') : 'click');
    persist(); rerender();
  }, [persist, rerender, sfx]);
  const endTurn = useCallback(() => {
    const game = gameRef.current, scene = sceneRef.current;
    if (!game || !scene || !game.heroTurn() || scene.busy()) return;
    game.endTurn(); setAim('act'); sfx('turn'); rerender();
  }, [rerender, sfx]);
  const drink = useCallback(() => { const game = gameRef.current; if (game && !sceneRef.current?.busy() && game.drink()) rerender(); }, [rerender]);
  const mendAim = useCallback(() => {
    const game = gameRef.current; if (!game || sceneRef.current?.busy()) return;
    const u = game.current(); if (!u || u.id !== 'enzo') return;
    setAim((a) => (a === 'mend' ? 'act' : 'mend'));
  }, []);

  // keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (screenRef.current !== 'game' || !game) return;
      if (e.key === 'Escape') { setMenu((m) => !m); return; }
      if (menuRef.current) return;
      if (game.mode === 'talk' && /^[1-9]$/.test(e.key)) { choose(Number(e.key) - 1); return; }
      if (game.mode === 'travel' && !game.journey && /^[1-9]$/.test(e.key)) {
        const legs = game.legs(), n = Number(e.key) - 1;
        if (n < legs.length) game.go(n); else if (n === legs.length && game.canRest()) game.rest(); else if (n === legs.length + (game.canRest() ? 1 : 0) && game.at === 'tunupa') game.backToTown();
        rerender(); return;
      }
      if (game.mode === 'explore') {
        const k = e.key.toLowerCase();
        const step: Record<string, [number, number]> = { arrowup: [0, -1], w: [0, -1], arrowright: [1, 0], d: [1, 0], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0] };
        if (step[k]) { e.preventDefault(); game.step(...step[k]); }
      }
      if (game.mode === 'combat') {
        if (e.key === 'Enter' || e.key.toLowerCase() === 'e') endTurn();
        if (e.key.toLowerCase() === 'm') mendAim();
        if (e.key.toLowerCase() === 'q') drink();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [choose, endTurn, mendAim, drink, rerender]);

  // the test hook
  useEffect(() => {
    (window as unknown as { __salt: () => unknown }).__salt = () => {
      const game = gameRef.current, scene = sceneRef.current, canvas = canvasRef.current;
      /** a tile's middle (or a figure's chest) in page pixels, for clicking */
      const at = (x: number, y: number, lift = 0) => {
        const m = MAPS[game?.mode === 'combat' ? 'yard' : game?.place ?? 'town'];
        const r = canvas!.getBoundingClientRect(), s = r.width / 1536;
        return { x: r.left + (m.ox + (x - y) * 48) * s, y: r.top + (m.oy + (x + y) * 24 + 24 - lift) * s };
      };
      return { g: game, scene, screen: screenRef.current, at, busy: (scene?.busy() ?? false) || (game?.events.length ?? 0) > 0 };
    };
  }, []);

  const ui = settings;
  const node = g?.node();
  const opts = g && g.mode === 'talk' ? g.options() : [];
  const cur = g?.current() ?? null;
  const c = g?.combat ?? null;

  return (
    <main className="sd-shell" data-ready={ready ? 'true' : 'false'} data-screen={screen} data-mode={g?.mode ?? ''}>
      <div className="sd-stage">
        <canvas ref={canvasRef} className="sd-canvas" onPointerMove={onMove} onPointerDown={onClick} aria-label="The game view" style={{ visibility: screen === 'game' ? 'visible' : 'hidden' }} />

        {screen === 'title' && (
          <section className="sd-title" style={{ backgroundImage: `url(${ART}title.webp)` }}>
            <h1 className="sd-sr">Salt &amp; Dust</h1>
            <div className="sd-title-panel">
              <p>The rains stopped long ago. Tunupa&rsquo;s well is failing, and Enzo&rsquo;s divining gauge is humming. Cross the salt flat, talk your way past Wardens, merchants and raiders, and find the water.</p>
              <div className="sd-row">
                {hasSave && <button className="sd-btn" disabled={!ready} onClick={() => begin(false)}>Continue</button>}
                <button className="sd-btn" disabled={!ready} onClick={() => begin(true)}>{hasSave ? 'New journey' : 'Begin the journey'}</button>
              </div>
              <label className="sd-check"><input type="checkbox" checked={ui.help} onChange={(e) => changeSettings({ ...ui, help: e.target.checked })} /> Help: hints, ranges and odds (recommended)</label>
              <p className="sd-small">A first playable chapter. Mouse or touch: click to walk, talk and act. <a href="/">Back to the arcade</a></p>
            </div>
          </section>
        )}

        {screen === 'end' && g && (() => {
          const e = g.ending();
          return (
            <section className="sd-end" style={{ backgroundImage: `url(${ART}ending.webp)` }}>
              <div className="sd-end-card sd-panel">
                <h2>{e.title}</h2>
                {e.lines.map((l, i) => <p key={i}>{l}</p>)}
                <p className="sd-next">{e.next}</p>
                <p className="sd-small">End of the first chapter of Salt &amp; Dust. Thank you for playing.</p>
                <div className="sd-row">
                  <button className="sd-btn" onClick={() => { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } setHasSave(false); begin(true); }}>Play again</button>
                  <a className="sd-btn" href="/">Back to the arcade</a>
                </div>
              </div>
            </section>
          );
        })()}

        {screen === 'game' && g && (
          <>
            {g.mode !== 'travel' && !(g.mode === 'talk' && g.talk?.back === 'travel') && (
              <div className="sd-banner"><img src={`${ART}ui-banner.webp`} alt="" /><span>{g.mode === 'combat' ? 'Coipa Yard: fight' : MAPS[g.place].name}</span></div>
            )}
            {(g.mode === 'travel' || (g.mode === 'talk' && g.talk?.back === 'travel')) && (
              <div className="sd-banner"><img src={`${ART}ui-banner.webp`} alt="" /><span>{g.journey ? 'On the salt flat' : MAP_NODES[g.at].name}</span></div>
            )}
            <img className="sd-compass" src={`${ART}ui-compass.webp`} alt="" />
            <button className="sd-btn sd-menu-btn" onClick={() => setMenu(true)} aria-label="Menu">Menu</button>
            {ui.help && g.mode !== 'talk' && g.hint() && <div className="sd-hint" role="status">{g.hint()}</div>}
            {toast && <div className="sd-toast" role="status">{toast}</div>}
            {g.mode !== 'combat' && <Party g={g} />}
            {g.mode !== 'combat' && <Water g={g} />}

            {g.mode === 'travel' && !g.journey && (
              <div className="sd-travel sd-panel">
                <h2>{MAP_NODES[g.at].name}</h2>
                <p>Where next? Every stage drinks from the canteen.</p>
                <ol className="sd-opts">
                  {g.legs().map((l, i) => (
                    <li key={l.to}><button className="sd-opt" onClick={() => { g.go(i); sfx('click'); rerender(); }} disabled={false}><span className="sd-num">{i + 1}.</span> {l.label}{g.water < l.water ? ' (not enough water: the heat will hurt)' : ''}</button></li>
                  ))}
                  {g.canRest() && <li><button className="sd-opt" onClick={() => { g.rest(); sfx('pour'); rerender(); }}><span className="sd-num">{g.legs().length + 1}.</span> Rest and drink a cup (1 water, heals you both)</button></li>}
                  {g.at === 'tunupa' && <li><button className="sd-opt" onClick={() => { g.backToTown(); rerender(); }}><span className="sd-num">{g.legs().length + (g.canRest() ? 2 : 1)}.</span> Back into Tunupa Well</button></li>}
                </ol>
              </div>
            )}

            {g.mode === 'talk' && node && (
              <div className={`sd-dialog sd-panel${node.who === 'none' ? ' sd-noface' : ''}`}>
                {node.who !== 'none' && <Portrait who={node.who} size="var(--face)" />}
                <div className="sd-dialog-body">
                  <h2>{node.name}</h2>
                  <p className="sd-line">{g.line()}</p>
                  <ol className="sd-opts">
                    {opts.map((o, i) => (
                      <li key={i}>
                        <button className={`sd-opt${o.check ? ' sd-checkopt' : ''}${o.check && !o.pass ? ' sd-short' : ''}`} disabled={!!o.blocked} onClick={() => choose(i)}>
                          {o.check && <img className="sd-knot" src={`${ART}ui-knot.webp`} alt="Skill check" />}
                          <span className="sd-num">{i + 1}.</span> {o.text}
                          {o.check && ui.help && <em className={o.pass ? 'sd-pass' : 'sd-fail'}> ({o.check.parts}: {o.pass ? 'you will succeed' : `needs ${o.check.n}, you have ${o.check.have}`})</em>}
                          {o.blocked && <em className="sd-fail"> ({o.blocked})</em>}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {g.mode === 'combat' && c && (
              <>
                <div className="sd-order" aria-label="Turn order">
                  {c.order.map((id) => { const u = g.unit(id)!; return <Portrait key={id} who={u.portrait} lit={cur?.id === id} dim={u.down} />; })}
                </div>
                <Party g={g} />
                <div className="sd-actbar">
                  {cur && cur.side === 'hero' ? (
                    <>
                      <div className="sd-ap"><span>AP {cur.ap} / {cur.maxAp}</span>{Array.from({ length: cur.maxAp }, (_, i) => <img key={i} src={`${ART}${i < cur.ap ? 'ui-pip' : 'ui-pip-empty'}.webp`} alt="" />)}</div>
                      <div className="sd-row sd-acts">
                        <span className="sd-who">{cur.name}: {cur.id === 'dora' ? `sling ${RULES.slingAp} AP, reach ${RULES.slingRange}` : `pole ${RULES.poleAp} AP, next to a foe`} · move 1 AP a tile</span>
                        {cur.id === 'enzo' && <button className={`sd-btn sd-small-btn${aim === 'mend' ? ' sd-on' : ''}`} disabled={c.mends <= 0 || cur.ap < RULES.mendAp} onClick={mendAim}>Mend ({RULES.mendAp} AP, {c.mends} left)</button>}
                        <button className="sd-btn sd-small-btn" disabled={!g.canDrink()} onClick={drink}>Drink ({RULES.drinkAp} AP, 1 water)</button>
                      </div>
                    </>
                  ) : <div className="sd-ap"><span>{cur ? `${cur.name} is moving…` : '…'}</span></div>}
                </div>
                <Water g={g} />
                <button className="sd-btn sd-endturn" disabled={!g.heroTurn() || !!sceneRef.current?.busy()} onClick={endTurn}>End Turn</button>
                {c.log.length > 0 && c.round === 1 && <div className="sd-toast sd-log">{c.log[c.log.length - 1]}</div>}
              </>
            )}

            {menu && (
              <div className="sd-menu sd-panel" role="dialog" aria-label="Menu">
                <h2>Paused</h2>
                <label className="sd-check"><input type="checkbox" checked={ui.help} onChange={(e) => changeSettings({ ...ui, help: e.target.checked })} /> Help: hints, ranges and odds</label>
                <label className="sd-check"><input type="checkbox" checked={ui.sound} onChange={(e) => changeSettings({ ...ui, sound: e.target.checked })} /> Sound</label>
                <label className="sd-check"><input type="checkbox" checked={ui.music} onChange={(e) => changeSettings({ ...ui, music: e.target.checked })} /> Music</label>
                <p className="sd-small">Your journey saves itself as you go. Keys: 1-9 pick a reply; arrows or WASD step; Enter ends a turn in a fight, M mends, Q drinks; Esc opens this menu.</p>
                <div className="sd-row">
                  <button className="sd-btn" onClick={() => setMenu(false)}>Resume</button>
                  <button className="sd-btn" onClick={() => { persist(); setMenu(false); setHasSave(true); setScreen('title'); soundRef.current?.musicOn(false); }}>Save and quit to title</button>
                  <a className="sd-btn" href="/">Back to the arcade</a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
export type { Unit };
