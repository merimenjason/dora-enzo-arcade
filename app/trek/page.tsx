/* oxlint-disable react/react-compiler -- The trek is a mutable engine object changed by the buttons and drawn by the loop, like the other arcade games. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation back to the menu. */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Trek, CHAPTERS, EVOS, EVO_IDS, FOES, FOE_IDS, GEAR_SLOTS, GEAR_STAT, RARITY, SCENES, SKILLS, SKILL_IDS, WHEEL, campStats, freshProfile, loadProfile, merge, price, record, skillLevel, train, trainCost, wear, xpNeed,
  type Card, type ChapterNo, type Chest, type DayEvent, type EvoId, type GearSlot, type Hero, type Profile, type Rarity, type SkillId,
} from '../../lib/chinchilla-trek-game';
import { STAGE, drawFight, drawFoe, drawPiece, drawTitle, drawWalk, replayState, stepReplay, type Replay } from '../../lib/chinchilla-trek-scene';
import { sound } from './sound';
import './trek.css';

const RUN_KEY = 'chinchilla-trek-run-v1', PROFILE_KEY = 'chinchilla-trek-v1';
type Screen = 'title' | 'camp' | 'trek' | 'over' | 'journal';
const WALK = 1.2, PAUSE = 0.5;
const SLOT_NAME: Record<GearSlot, string> = { hat: 'Hat', scarf: 'Scarf', charm: 'Charm', boots: 'Boots' };
const SLOT_STAT: Record<GearSlot, (n: number) => string> = { hat: (n) => `+${n} HP`, scarf: (n) => `+${n} attack`, charm: (n) => `+${Math.round(n * 100)}% crit`, boots: (n) => `+${Math.round(n * 100)}% dodge` };
const HERO_NAME: Record<Hero, string> = { dora: 'Dora', enzo: 'Enzo' };
const OTHER: Record<Hero, string> = { dora: 'Enzo', enzo: 'Dora' };
const pct = (n: number) => `${Math.round(n * 100)}%`;

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: nothing is kept */ } },
  drop: (k: string) => { try { localStorage.removeItem(k); } catch { /* nothing to remove */ } },
};

/** A canvas drawn once. */
function Still({ draw, w = 480, h = 320, className }: { draw: (c: CanvasRenderingContext2D) => void; w?: number; h?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current?.getContext('2d'); if (c) { c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, w, h); draw(c); } }, [draw, w, h]);
  return <canvas ref={ref} width={w * 2} height={h * 2} className={className} aria-hidden="true" />;
}

const cardName = (c: Card) => (c.k === 'rest' ? 'Rest' : c.k === 'evo' ? EVOS[c.id].name : SKILLS[c.id].name);
const cardText = (c: Card) => (c.k === 'rest' ? 'Nothing new to learn: heal 30%.' : c.k === 'evo' ? EVOS[c.id].text : SKILLS[c.id].text[c.level - 1]);
const say = (text: string, hero: Hero) => text.replaceAll('{other}', OTHER[hero]);

export default function ChinchillaTrek() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('title');
  const [profile, setProfile] = useState<Profile>(() => freshProfile());
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(false);
  const [hero, setHero] = useState<Hero>('dora');
  const [chapter, setChapter] = useState<ChapterNo>(1);
  const [chest, setChest] = useState<Chest | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const trekRef = useRef<Trek | null>(null);
  const replayRef = useRef<Replay | null>(null);
  const walkRef = useRef<number | null>(null); // seconds into today's walk, while walking
  const idleRef = useRef(0); // seconds since the trek last needed nothing, for auto-walk
  const profileRef = useRef(profile);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<Screen>('title');
  const calmRef = useRef(false);
  profileRef.current = profile; screenRef.current = screen;
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const saveProfile = useCallback((p: Profile) => { profileRef.current = p; setProfile(p); store.set(PROFILE_KEY, JSON.stringify(p)); }, []);
  /** Saves the trek after every change; a finished one is banked into the profile and its save removed. */
  const persist = useCallback(() => {
    const t = trekRef.current;
    if (!t) return;
    if (t.phase !== 'over' && t.phase !== 'cleared') { store.set(RUN_KEY, JSON.stringify(t)); setSaved(true); return; }
    const out = record(profileRef.current, t);
    if (out.chest) { saveProfile(out.profile); setChest(out.chest); }
    store.drop(RUN_KEY); setSaved(false);
  }, [saveProfile]);

  const go = useCallback((s: Screen) => { setTip(null); setScreen(s); }, []);
  const start = useCallback((h: Hero, ch: ChapterNo = 1, seed = (Math.random() * 2 ** 31) | 0) => {
    trekRef.current = new Trek(seed, h, ch, campStats(profileRef.current));
    replayRef.current = null; walkRef.current = null; idleRef.current = 0; setChest(null);
    persist(); go('trek');
  }, [persist, go]);
  const resume = useCallback(() => {
    const t = Trek.load(store.get(RUN_KEY));
    if (!t || t.phase === 'over' || t.phase === 'cleared') { store.drop(RUN_KEY); setSaved(false); return; }
    trekRef.current = t; replayRef.current = null; walkRef.current = null; idleRef.current = 0;
    go('trek');
  }, [go]);

  /** After any action: save, and leave for the end card once the trek is over and nothing is playing. */
  const after = useCallback((ok: boolean, cue?: Parameters<typeof sound.cue>[0]) => {
    if (!ok) return false;
    if (cue) sound.cue(cue);
    idleRef.current = 0; persist(); refresh();
    return true;
  }, [persist, refresh]);

  /** Today's walk is over: the day happens. A fight's replay plays from the save made here. */
  const arrive = useCallback(() => {
    const t = trekRef.current;
    walkRef.current = null;
    if (!t) return;
    const hp0 = t.hp, max = t.stats().hp, level = t.level, e = t.next();
    if (!e) return;
    if (e.k === 'fight' && t.last?.day === t.day) replayRef.current = { foe: e.foe, out: t.last.out, i: 0, t: 0, speed: profileRef.current.ui.fast ? 2 : 1, hp0, max };
    else if (t.level > level) sound.cue('level');
    after(true);
  }, [after]);
  /** Continue: walk to the next day, or, once the trek has ended, see the end card. */
  const walk = useCallback(() => {
    const t = trekRef.current, r = replayRef.current;
    if (!t || walkRef.current !== null || (r && r.i < r.out.events.length)) return;
    if (r) { replayRef.current = null; if (t.level > 1 && t.phase === 'pick') sound.cue('level'); }
    if (t.phase === 'over' || t.phase === 'cleared') { sound.cue('chest'); go('over'); return; }
    if (t.phase !== 'walk') { refresh(); return; }
    walkRef.current = 0; idleRef.current = 0; refresh();
  }, [go, refresh]);
  const skip = useCallback(() => { const r = replayRef.current; if (r && r.i < r.out.events.length) { r.i = r.out.events.length; r.t = 0; refresh(); } }, [refresh]);
  const choose = useCallback((i: number) => after(!!trekRef.current?.choose(i), i < 0 ? undefined : 'pick'), [after]);
  const pick = useCallback((i: number) => after(!!trekRef.current?.pickSkill(i), 'pick'), [after]);
  const reroll = useCallback(() => after(!!trekRef.current?.reroll(), 'pick'), [after]);
  const buy = useCallback((i: number) => after(!!trekRef.current?.buy(i), 'pick'), [after]);
  const setUi = useCallback((ui: Partial<Profile['ui']>) => {
    saveProfile({ ...profileRef.current, ui: { ...profileRef.current.ui, ...ui } });
    if (replayRef.current && ui.fast !== undefined) replayRef.current.speed = ui.fast ? 2 : 1;
  }, [saveProfile]);

  useEffect(() => {
    const p = loadProfile(store.get(PROFILE_KEY));
    profileRef.current = p; setProfile(p);
    setChapter(p.unlocked);
    const t = Trek.load(store.get(RUN_KEY));
    setSaved(!!t && t.phase !== 'over' && t.phase !== 'cleared');
    setMuted(sound.muted());
    setReady(true);
  }, []);

  // Reduced motion: no bobbing walk, small lunges, nothing moves while nothing is happening.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-reduced-motion: reduce)'), on = () => { calmRef.current = q.matches; };
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    (window as unknown as { __trek?: () => unknown }).__trek = () => ({
      trek: trekRef.current, profile: profileRef.current, replay: replayRef.current, walking: walkRef.current !== null, start,
      set: (patch: Partial<Pick<Trek, 'hp' | 'day' | 'acorns' | 'kit' | 'xp' | 'level' | 'today' | 'phase'>>) => {
        const t = trekRef.current;
        if (!t) return;
        Object.assign(t, patch);
        persist(); refresh();
      },
      setProfile: (p: Profile) => { saveProfile(p); refresh(); },
    });
  });

  // The canvas fills the largest 3:2 box the panel leaves, at the screen's pixel density.
  useEffect(() => {
    if (screen !== 'trek') return;
    const fit = () => {
      const canvas = canvasRef.current, holder = canvas?.parentElement?.parentElement, frame = canvas?.parentElement;
      if (!canvas || !holder || !frame) return;
      const room = holder.getBoundingClientRect(), w = Math.max(120, Math.min(room.width - 16, ((room.height - 8) * 3) / 2)), h = (w * 2) / 3, dpr = window.devicePixelRatio || 1;
      frame.style.width = `${w}px`; frame.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    const holder = canvasRef.current?.parentElement?.parentElement;
    if (ro && holder) ro.observe(holder);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.removeEventListener('resize', fit); };
  }, [screen]);

  // The loop: walks, plays fights back with their sounds, and walks on by itself when auto-walk is on.
  useEffect(() => {
    if (screen !== 'trek') return;
    let raf = 0, last = performance.now(), heard = 0, playing: Replay | null = null, stepped = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const t = trekRef.current, canvas = canvasRef.current;
      if (!t || !canvas || document.hidden) return;
      const c = canvas.getContext('2d')!, calm = calmRef.current, fast = profileRef.current.ui.fast;
      c.setTransform(canvas.width / STAGE.w, 0, 0, canvas.height / STAGE.h, 0, 0);
      const r = replayRef.current;
      if (r) {
        if (r !== playing) { playing = r; heard = 0; }
        const was = r.i < r.out.events.length;
        stepReplay(r, dt);
        for (; heard < r.i; heard++) {
          const e = r.out.events[heard];
          if (r.i - heard > 3) continue;
          if (e.k === 'hit') sound.cue(e.src === 'zap' ? 'zap' : e.crit ? 'crit' : e.hp === 0 ? 'ko' : 'hit');
          else if (e.k === 'dodge') sound.cue('dodge');
          else if (e.k === 'end') sound.cue(e.result === 'win' ? 'win' : e.result === 'loss' ? 'lose' : 'dodge');
        }
        if (was && r.i >= r.out.events.length) { idleRef.current = 0; refresh(); }
        drawFight(c, r, t, now, calm);
        if (r.i >= r.out.events.length && profileRef.current.ui.auto) { idleRef.current += dt; if (idleRef.current > PAUSE * 2) walk(); }
        return;
      }
      if (walkRef.current !== null) {
        walkRef.current += dt;
        const len = fast ? WALK / 2 : WALK;
        if (Math.floor(walkRef.current / 0.3) > stepped) { stepped = Math.floor(walkRef.current / 0.3); sound.cue('step'); }
        drawWalk(c, t, Math.min(1, walkRef.current / len), now, calm);
        if (walkRef.current >= len) { stepped = 0; arrive(); }
        return;
      }
      drawWalk(c, t, 1, now, calm);
      if (t.phase === 'walk' && profileRef.current.ui.auto) { idleRef.current += dt; if (idleRef.current > PAUSE) walk(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [screen, refresh, walk, arrive]);

  // Keys: 1–3 choose or pick, Space continues (or skips a fight), R rerolls, Escape walks on.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || screenRef.current !== 'trek') return;
      const t = trekRef.current, r = replayRef.current;
      if (!t) return;
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (e.code === 'Space') { e.preventDefault(); if (r && r.i < r.out.events.length) skip(); else walk(); }
      else if (r && r.i < r.out.events.length) return;
      else if (n >= 0 && t.phase === 'pick') pick(n);
      else if (n >= 0 && t.phase === 'event') { if (t.today?.k === 'pedlar') buy(n); else choose(n); }
      else if (e.code === 'KeyR' && t.phase === 'pick') reroll();
      else if (e.code === 'Escape' && t.phase === 'event') choose(-1);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [skip, walk, pick, choose, buy, reroll]);

  const t = trekRef.current, replay = replayRef.current;
  const playing = !!replay && replay.i < replay.out.events.length, walking = walkRef.current !== null;
  const toggleMute = () => { const m = !muted; sound.setMuted(m); setMuted(m); };
  const stats = campStats(profile);
  const busy = playing || walking;

  return (
    <main className="ct-shell" data-ready={ready} data-screen={screen}>
      <header className="ct-top">
        <a className="ct-back" href="/">← Arcade</a>
        <h1>Chinchilla Trek</h1>
        <button data-testid="mute" aria-pressed={muted} onClick={toggleMute}>{muted ? 'Sound off' : 'Sound on'}</button>
        {screen === 'trek' && <button data-testid="menu" onClick={() => { persist(); go('title'); }}>Menu</button>}
      </header>

      {screen === 'title' && (
        <section className="ct-menu">
          <div className="ct-title"><Still draw={drawTitle} /></div>
          <p className="ct-small">Walk thirty days with Dora or Enzo. Fights play out by themselves: you pick the skills, make the choices on the path, and grow stronger at camp between treks.</p>
          <div className="ct-row">
            {saved && <button className="ct-gold" data-testid="continue" onClick={resume}>Continue</button>}
            <button className={saved ? '' : 'ct-gold'} data-testid="camp" onClick={() => go('camp')}>Camp</button>
            <button data-testid="journal" onClick={() => go('journal')}>Journal</button>
          </div>
        </section>
      )}

      {screen === 'camp' && (
        <section className="ct-camp">
          <div className="ct-row ct-left"><button data-testid="back" onClick={() => go('title')}>← Back</button><span className="ct-acorns">🌰 {profile.acorns}</span></div>
          <div className="ct-panel">
            <h2>Who walks?</h2>
            <div className="ct-row">
              {(['dora', 'enzo'] as Hero[]).map((h) => (
                <button key={h} data-testid={`hero-${h}`} aria-pressed={hero === h} onClick={() => setHero(h)}>
                  {HERO_NAME[h]} · {h === 'dora' ? '+10% HP, starts with Shell' : '+10% attack, starts with Combo'}
                </button>
              ))}
            </div>
            <h2>Where to?</h2>
            <div className="ct-row">
              {CHAPTERS.map((ch) => (
                <button key={ch.no} data-testid={`chapter-${ch.no}`} aria-pressed={chapter === ch.no} disabled={ch.no > profile.unlocked} onClick={() => setChapter(ch.no)}>
                  {ch.no}. {ch.name}{profile.best[ch.no - 1] > 30 ? ' ★' : profile.best[ch.no - 1] ? ` · day ${profile.best[ch.no - 1]}` : ''}
                </button>
              ))}
            </div>
            <button className="ct-gold ct-wide" data-testid="set-off" onClick={() => start(hero, Math.min(chapter, profile.unlocked) as ChapterNo)}>Set off</button>
          </div>
          <div className="ct-panel">
            <h2>Training</h2>
            <p className="ct-small">HP {stats.hp} · attack {stats.atk} · crit {pct(stats.crit)} · dodge {pct(stats.dodge)}</p>
            <div className="ct-row">
              <button data-testid="train-atk" disabled={profile.acorns < trainCost(profile.training.atk)} onClick={() => { const p = train(profile, 'atk'); if (p) { saveProfile(p); sound.cue('level'); } }}>+1 attack · 🌰 {trainCost(profile.training.atk)}</button>
              <button data-testid="train-hp" disabled={profile.acorns < trainCost(profile.training.hp)} onClick={() => { const p = train(profile, 'hp'); if (p) { saveProfile(p); sound.cue('level'); } }}>+10 HP · 🌰 {trainCost(profile.training.hp)}</button>
            </div>
          </div>
          <div className="ct-panel">
            <h2>Gear</h2>
            <p className="ct-small">Three of a kind merge into one of the next rarity. Tap a piece to wear it.</p>
            {GEAR_SLOTS.map((slot) => {
              const mine = profile.gear.filter((x) => x.slot === slot).sort((a, b) => b.r - a.r);
              return (
                <div key={slot} className="ct-slot">
                  <b>{SLOT_NAME[slot]}</b>
                  <div className="ct-pieces">
                    {mine.length === 0 && <span className="ct-small">none yet</span>}
                    {mine.map((x) => (
                      <button key={x.uid} data-testid={`wear-${x.uid}`} className="ct-piece" aria-pressed={profile.worn[slot] === x.uid} title={`${RARITY[x.r]} ${SLOT_NAME[slot]} · ${SLOT_STAT[slot](GEAR_STAT[slot][x.r])}`}
                        onClick={() => { const p = wear(profile, x.uid); if (p) saveProfile(p); }}>
                        <Still w={48} h={40} draw={(c) => drawPiece(c, slot, x.r, 24, 22, 0.9)} />
                        <span>{RARITY[x.r]}</span>
                      </button>
                    ))}
                  </div>
                  {([0, 1, 2, 3] as Rarity[]).filter((r) => mine.filter((x) => x.r === r).length >= 3).map((r) => (
                    <button key={r} data-testid={`merge-${slot}-${r}`} onClick={() => { const p = merge(profile, slot, r); if (p) { saveProfile(p); sound.cue('chest'); } }}>Merge 3 {RARITY[r]} → {RARITY[r + 1]}</button>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {screen === 'journal' && (
        <section className="ct-journal">
          <div className="ct-row ct-left"><button data-testid="back" onClick={() => go('title')}>← Back</button><span className="ct-small">Skills you have learned and foes you have met are filled in.</span></div>
          <h2>Skills</h2>
          <div className="ct-grid">
            {SKILL_IDS.map((id) => (
              <div key={id} className="ct-entry" data-testid={`journal-skill-${id}`} data-seen={profile.seen.skills.includes(id)}>
                <b>{SKILLS[id].name}</b><span className="ct-small">{SKILLS[id].text.join(' / ')}</span>
              </div>
            ))}
          </div>
          <h2>Evolutions</h2>
          <div className="ct-grid">
            {EVO_IDS.map((id) => (
              <div key={id} className="ct-entry" data-testid={`journal-evo-${id}`} data-seen={profile.seen.skills.includes(id)}>
                <b>{EVOS[id].name}</b><span className="ct-small">{SKILLS[EVOS[id].from[0]].name} + {SKILLS[EVOS[id].from[1]].name}: {EVOS[id].text}</span>
              </div>
            ))}
          </div>
          <h2>Foes</h2>
          <div className="ct-grid ct-foes">
            {FOE_IDS.map((id) => {
              const seen = profile.seen.foes.includes(id);
              return (
                <div key={id} className="ct-entry" data-testid={`journal-foe-${id}`} data-seen={seen}>
                  <Still w={120} h={90} className={seen ? '' : 'ct-unseen'} draw={(c) => drawFoe(c, id, { x: 20, y: 0, w: 80, h: 84 }, -1)} />
                  <b>{seen ? FOES[id].name : '???'}</b>
                  <span className="ct-small">{CHAPTERS[FOES[id].chapter - 1].name}{FOES[id].rank === 'foe' ? '' : ` · ${FOES[id].rank}`}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {screen === 'trek' && t && (
        <>
          <section className="ct-play">
            <div className="ct-frame">
              <canvas ref={canvasRef} className="ct-stage" data-testid="stage" aria-label="Chinchilla Trek stage" />
              {t.phase === 'pick' && !busy && t.offer && (
                <div className="ct-cards">
                  <p>{t.picks > 1 ? `Pick a skill (${t.picks} to go)` : 'Pick a skill'}</p>
                  <div className="ct-cardrow">
                    {t.offer.map((c, i) => (
                      <button key={i} className={`ct-card ${c.k === 'evo' ? 'ct-evo' : ''}`} data-testid={`card-${i}`} onClick={() => pick(i)}>
                        <b>{cardName(c)}</b>
                        {c.k === 'skill' && <span className="ct-pips">{[1, 2, 3].map((n) => <i key={n} className={n <= c.level ? 'on' : ''} />)}</span>}
                        {c.k === 'evo' && <span className="ct-pips">evolution</span>}
                        <span>{cardText(c)}</span>
                      </button>
                    ))}
                  </div>
                  <button data-testid="reroll" disabled={t.rerolled} onClick={reroll}>Reroll · once a trek</button>
                </div>
              )}
            </div>
          </section>
          <Status t={t} replay={replay} />
          <div className="ct-tray">
            {[...(Object.keys(t.kit.skills) as SkillId[]), ...t.kit.evos].map((id) => {
              const evo = id in EVOS, lv = evo ? 3 : skillLevel(t.kit, id as SkillId);
              const text = evo ? `${EVOS[id as EvoId].name}: ${EVOS[id as EvoId].text}` : `${SKILLS[id as SkillId].name} ${lv}: ${SKILLS[id as SkillId].text[lv - 1]}`;
              return (
                <button key={id} data-testid={`tray-${id}`} className={`ct-chip ${evo ? 'ct-evo' : ''}`} onClick={() => setTip(tip === text ? null : text)}>
                  {(evo ? EVOS[id as EvoId].name : SKILLS[id as SkillId].name).split(' ').map((w) => w[0]).join('')}
                  {!evo && <span className="ct-pips">{[1, 2, 3].map((n) => <i key={n} className={n <= lv ? 'on' : ''} />)}</span>}
                </button>
              );
            })}
          </div>
          {tip && <p className="ct-tip">{tip}</p>}
          <div className="ct-event">
            {busy ? <p className="ct-small">{playing ? `A ${FOES[replay!.foe].name} blocks the path!` : `Walking to day ${t.day + 1}…`}</p>
              : <Day t={t} choose={choose} buy={buy} />}
            <div className="ct-bar">
              <button data-testid="speed" aria-pressed={profile.ui.fast} onClick={() => setUi({ fast: !profile.ui.fast })}>×2</button>
              <button data-testid="auto" aria-pressed={profile.ui.auto} onClick={() => setUi({ auto: !profile.ui.auto })}>Auto-walk</button>
              {replay && <button data-testid="skip" onClick={skip} disabled={!playing}>Skip</button>}
              {(t.phase === 'walk' || t.phase === 'over' || t.phase === 'cleared' || (replay && !playing)) && (
                <button className="ct-gold" data-testid="walk" onClick={walk} disabled={busy}>
                  {t.phase === 'over' || t.phase === 'cleared' ? 'See how it went' : t.phase === 'walk' ? 'Walk on' : 'Continue'}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {screen === 'over' && t && (
        <section className="ct-end">
          <h2>{t.phase === 'cleared' ? `${CHAPTERS[t.chapter - 1].name} cleared!` : 'Too tired to go on'}</h2>
          <p>{t.phase === 'cleared' ? `${HERO_NAME[t.hero]} made it all thirty days, at level ${t.level}.` : `${HERO_NAME[t.hero]} reached day ${t.day} at level ${t.level}, and heads back to camp for a nap.`}</p>
          {chest && (
            <div className="ct-chest" data-testid="chest">
              <b>Chest</b>
              <span>🌰 {t.acorns} found + {chest.acorns} in the chest</span>
              <div className="ct-row">
                {chest.pieces.map((x) => (
                  <div key={x.uid} className="ct-piece">
                    <Still w={48} h={40} draw={(c) => drawPiece(c, x.slot, x.r, 24, 22, 0.9)} />
                    <span>{RARITY[x.r]} {SLOT_NAME[x.slot]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="ct-row">
            <button className="ct-gold" data-testid="camp" onClick={() => go('camp')}>Back to camp</button>
          </div>
        </section>
      )}
    </main>
  );
}

/** The status bar: the day, HP (as the fight replay shows it while one plays), level and experience, and acorns. */
function Status({ t, replay }: { t: Trek; replay: Replay | null }) {
  const max = replay?.max ?? t.stats().hp, hp = replay && replay.i < replay.out.events.length ? replayState(replay, replay.i).hp : t.hp;
  const need = xpNeed(t.level);
  return (
    <div className="ct-status">
      <span data-testid="day">Day {t.day}/30</span>
      <span data-testid="hp" className="ct-meter"><i style={{ width: `${(100 * hp) / max}%`, background: hp < max * 0.3 ? '#ff6a5a' : '#6ad06a' }} /><em>HP {hp}/{max}</em></span>
      <span className="ct-meter ct-xp"><i style={{ width: `${(100 * t.xp) / need}%` }} /><em>Lv {t.level}</em></span>
      <span data-testid="acorns">🌰 {t.acorns}</span>
    </div>
  );
}

/** Today's card: what happened, or the choice waiting. */
function Day({ t, choose, buy }: { t: Trek; choose: (i: number) => void; buy: (i: number) => void }) {
  const e: DayEvent | null = t.today;
  if (t.phase === 'pick') return <p className="ct-small">Level up! Pick a skill on the card above.</p>;
  if (t.phase === 'over') return <p data-testid="note">{t.last?.out.result === 'stall' ? `${FOES[t.last.foe].name} wouldn't budge, and the day ran out.` : 'Too tired to go on…'}</p>;
  if (t.phase === 'cleared') return <p data-testid="note">The boss tumbles away. The chapter is clear!</p>;
  if (t.phase === 'walk') {
    const text = t.note || (t.day === 0 ? 'The path starts here.' : e?.k === 'fight' && t.last ? `${t.last.out.result === 'win' ? 'You beat' : 'You waved goodbye to'} the ${FOES[t.last.foe].name}.` : '');
    return <p data-testid="note">{text}</p>;
  }
  if (!e) return null;
  if (e.k === 'story') {
    const s = SCENES.find((x) => x.id === e.scene)!;
    return (
      <>
        <p>{say(s.text, t.hero)}</p>
        <div className="ct-row">{s.choices.map((c, i) => <button key={i} data-testid={`choice-${i}`} onClick={() => choose(i)}>{say(c.label, t.hero)}{c.odds !== undefined ? ` · ${pct(c.odds)}` : ''}</button>)}</div>
      </>
    );
  }
  if (e.k === 'wheel') return (
    <>
      <p>A lucky wheel by the path: {WHEEL.join(', ')}.</p>
      <div className="ct-row"><button data-testid="choice-0" onClick={() => choose(0)}>Spin</button><button data-testid="walk-on" onClick={() => choose(-1)}>Walk on</button></div>
    </>
  );
  if (e.k === 'crossroads') return (
    <>
      <p>The Owl and the Fox wait at the crossroads.</p>
      <div className="ct-row">
        <button data-testid="choice-0" onClick={() => choose(0)}>Owl: heal to full</button>
        <button data-testid="choice-1" onClick={() => choose(1)}>Owl: +1 level to a skill</button>
        <button data-testid="choice-2" onClick={() => choose(2)}>Fox: two skills at level 2 for 20% max HP</button>
      </div>
      <button data-testid="walk-on" onClick={() => choose(-1)}>Walk on</button>
    </>
  );
  if (e.k === 'visit') return (
    <>
      <p>{e.who === 'owl' ? 'The Owl drops by with a cup of tea.' : 'The Fox has a deal for you.'}</p>
      <div className="ct-row">
        <button data-testid="choice-0" onClick={() => choose(0)}>{e.who === 'owl' ? 'Heal 50%' : 'A skill at level 2 for 10% max HP'}</button>
        <button data-testid="walk-on" onClick={() => choose(-1)}>Walk on</button>
      </div>
    </>
  );
  if (e.k === 'pedlar') return (
    <>
      <p>The Pedlar&apos;s cart. You have 🌰 {t.acorns}.</p>
      <div className="ct-row">
        {e.stock.map((w, i) => (
          <button key={i} data-testid={`ware-${i}`} disabled={e.sold[i] || t.acorns < price(w, t.chapter)} onClick={() => buy(i)}>
            {w.k === 'snack' ? 'Snack: heal 40%' : w.k === 'card' ? 'A skill card' : `Charm: ${w.stat === 'atk' ? '+8% attack' : w.stat === 'hp' ? '+10% HP' : '+5% crit'}`} · 🌰 {price(w, t.chapter)}{e.sold[i] ? ' · sold' : ''}
          </button>
        ))}
      </div>
      <button data-testid="walk-on" onClick={() => choose(-1)}>Leave</button>
    </>
  );
  return null;
}
