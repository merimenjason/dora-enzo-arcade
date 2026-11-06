'use client';
// Snow Day League: the page. Paper cut-out screens in HTML over Codex paintings (the title, Dora and Enzo's office,
// the felt draft table, the season's end) and the pixel match on a canvas drawn by lib/league-scene.ts. The engine
// (lib/league-game.ts) holds the season, the draft and the match; this page wires the week's job, the draft turns
// (the rival coach's moves play out one at a time), the match loop at 1×, 2× or 4× (hit-stop on KOs, slow motion for
// the last moment), the coach's shouts, the replay of the deciding moment, the save, sound and Enzo's first-week notes.
// Mouse or touch for everything; number keys pick a card, Space speeds the match up, Enter confirms.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/league-game';
import type { LeagueScene } from '@/lib/league-scene';
import { LeagueSound, type SongId } from './sound';
import './league.css';

type Screen = 'title' | 'office' | 'draft' | 'match' | 'post' | 'season' | 'howto' | 'settings';
type Tab = 'squad' | 'fixtures' | 'table' | 'market' | 'photos';
type Job = null | 'train' | 'sign';
type Post = { won: boolean; drew: boolean; pay: number; changes: { id: string; name: string; d: number }[]; mvp: G.Player | null; m: G.Match; opp: G.TeamId; f: G.Fixture };
const ART = '/art/league/';
const por = (p: { species: G.Species; id: string }) => `${ART}por-${p.species}-${G.lookOf(p)}.webp`;
const coachPic = (id: G.TeamId) => id === 'snowcats' ? `${ART}por-dora.webp` : `${ART}coach-${id}.webp`;
const NOTES = [
  'Welcome to the office! Each week you do ONE job: train someone, scout the next rival, rest the squad or sign a free agent. Then it’s off to the draft.',
  'This is the draft. You each ban a card, then take turns picking five. The middle cards are village loans anyone can pick. The Hint (the glowing card) explains a good choice, or press Auto-draft.',
  'Now we watch! Throwers out-range diggers, builders’ walls stop throws, scouts lob over walls, diggers bury scouts. Shout once each half from the bench.',
];
const STAT_COLOUR: Record<G.Stat, string> = { aim: '#e0574a', speed: '#4caf50', grit: '#4a7ad8' };
/** a heart is 25 health: about a quarter of a full health bar */
const hearts = (u: G.Unit) => Math.round(u.stats.heal / 25);
const STAT_COLS: { key: string; label: string; icon: string; tip: string; val: (u: G.Unit) => number }[] = [
  { key: 'kos', label: 'KOs', icon: 'ko', tip: 'Rivals this player knocked out', val: (u) => u.stats.kos },
  { key: 'out', label: 'Outs', icon: 'ko', tip: 'Times this player was knocked out', val: (u) => u.stats.ko },
  { key: 'blocks', label: 'Blocks', icon: 'block', tip: 'Blocks of their fort this player knocked out (16 in a fort)', val: (u) => u.stats.blocks },
  { key: 'hearts', label: 'Hearts', icon: 'heart', tip: 'Health given back to teammates, in hearts (one heart is about a quarter of a health bar)', val: hearts },
  { key: 'saves', label: 'Saves', icon: 'save', tip: 'Snowballs stopped by this player’s snow wall', val: (u) => u.stats.blocked },
];
const statLine = (u: G.Unit) => [u.stats.kos && `${u.stats.kos} KO${u.stats.kos === 1 ? '' : 's'}`, u.stats.blocks && `${u.stats.blocks} block${u.stats.blocks === 1 ? '' : 's'} knocked out`, hearts(u) && `${hearts(u)} heart${hearts(u) === 1 ? '' : 's'} given`, u.stats.blocked && `${u.stats.blocked} save${u.stats.blocked === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || 'a quiet match';
/** both forts over the match, a line each, with a dot where the lead changed hands */
function FortGraph({ m, colour }: { m: G.Match; colour: string }) {
  const tr = m.trace; if (tr.length < 2) return null;
  const w = 300, h = 64, x = (i: number) => (i / (G.MATCH_TICKS / G.TICK)) * w, y = (v: number) => h - 4 - v / 100 * (h - 8);
  const line = (k: 0 | 1) => tr.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  return (
    <figure className="lg-graph" aria-label="How both forts held up over the match">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"><title>Fort health over the match: red is ours</title>
        <line x1="0" x2={w} y1={y(50)} y2={y(50)} className="mid" />
        <polyline points={line(1)} fill="none" stroke={colour} strokeWidth="2.5" />
        <polyline points={line(0)} fill="none" stroke="#d8352a" strokeWidth="2.5" />
      </svg>
      <figcaption><i style={{ background: '#d8352a' }} />Our fort <i style={{ background: colour }} />Theirs <span className="lg-dim">(over the {Math.round(m.t / G.TICK)} seconds)</span></figcaption>
    </figure>
  );
}

export default function LeaguePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<LeagueScene | null>(null);
  const soundRef = useRef<LeagueSound | null>(null);
  const [save, setSave] = useState<G.Save>(() => G.newSave(1));
  const saveRef = useRef<G.Save>(save);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const backRef = useRef<Screen>('title');
  const [ready, setReady] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [tab, setTab] = useState<Tab>('squad');
  const [job, setJob] = useState<Job>(null);
  const [releaseId, setReleaseId] = useState<string>('');
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [upright, setUpright] = useState(false);
  // the draft
  const draftRef = useRef<G.Draft | null>(null);
  const [tactic, setTactic] = useState<G.Tactic>('balanced');
  const [paw, setPaw] = useState<{ id: string; t: number } | null>(null);
  const [stamped, setStamped] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const selRef = useRef<string | null>(null); selRef.current = sel;
  const rivalTimer = useRef<number | null>(null);
  // the match
  const matchRef = useRef<G.Match | null>(null);
  const optsRef = useRef<G.MatchOpts | null>(null);
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const replayRef = useRef<{ until: number } | null>(null);
  const [replaying, setReplaying] = useState(false);
  type Hud = { t: number; lines: G.Line[]; canShout: boolean; hint: ReturnType<typeof G.shoutHint>; over: boolean; phase: G.Phase; blocks: [number, number]; fort: [number, number]; up: [number, number]; kos: [number, number]; mo: [number, number]; surge: [boolean, boolean] };
  const [hud, setHud] = useState<Hud | null>(null);
  const [protectOpen, setProtectOpen] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const hitStop = useRef(0);
  const pan = useRef(0);
  const gameRef = useRef<HTMLDivElement>(null);
  const fps = useRef(0);

  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: G.Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); if (s === 'howto' || s === 'settings') backRef.current = screenRef.current === 'howto' || screenRef.current === 'settings' ? backRef.current : screenRef.current; setScreen(s); };
  const speed_ = (n: number) => { speedRef.current = n; setSpeedState(n); };

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s: G.Save | null = null;
    try { const raw = localStorage.getItem(G.SAVE_KEY); if (raw) { s = G.parseSave(raw); setHasSave(s.started); } } catch {}
    if (!s) s = G.newSave((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    saveRef.current = s; setSave({ ...s });
    soundRef.current = new LeagueSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/league-scene').then((mod) => {
      if (gone || !canvasRef.current) return;
      const sc = new mod.LeagueScene(canvasRef.current); sceneRef.current = sc;
      sc.reduced = !s!.settings.motion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      void sc.load().then(() => { if (!gone) setReady(true); });
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); sceneRef.current?.dispose(); if (rivalTimer.current) clearTimeout(rivalTimer.current); };
  }, []);
  useEffect(() => {
    const on = () => setUpright(innerHeight > innerWidth * 1.05);
    on(); addEventListener('resize', on); return () => removeEventListener('resize', on);
  }, []);
  // the pitch takes all the height the score bar, ticker and controls leave (at 16:9; an upright phone crops to 4:3)
  useEffect(() => {
    if (screen !== 'match') return;
    const fit = () => {
      const g = gameRef.current; if (!g) return;
      if (upright) { g.style.removeProperty('--pw'); return; }
      // stacked (score bar, pitch, ticker, controls) or, on a short screen, the controls in a column beside the pitch
      const cs = getComputedStyle(g), gap = parseFloat(cs.rowGap) || 0, side = cs.display === 'grid' ? 210 + (parseFloat(cs.columnGap) || 0) : 0;
      let other = 0;
      for (const el of Array.from(g.children) as HTMLElement[]) {
        const ec = getComputedStyle(el);
        if (el.classList.contains('lg-stage') || ec.display === 'none' || ec.gridColumnStart === '2') continue;
        other += el.getBoundingClientRect().height + gap + (parseFloat(ec.marginTop) || 0) + (parseFloat(ec.marginBottom) || 0);
      }
      const h = g.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - other;
      const w = Math.floor(Math.max(240, Math.min(g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - side, h * 16 / 9)));
      const was = parseFloat(g.style.getPropertyValue('--pw')) || 0;
      if (Math.abs(was - w) > 1) g.style.setProperty('--pw', `${w}px`);
    };
    fit(); const id = setInterval(fit, 250); addEventListener('resize', fit);
    return () => { clearInterval(id); removeEventListener('resize', fit); };
  }, [screen, upright]);
  // the music for each screen
  useEffect(() => {
    const f = G.ourFixture(saveRef.current);
    const song: SongId | null = screen === 'match' ? (f?.kind === 'final' ? 'final' : 'match') : screen === 'draft' ? 'draft' : screen === 'season' ? (G.cupResult(saveRef.current) === 'cup' ? 'victory' : 'office') : screen === 'post' ? (post?.won ? 'victory' : 'office') : 'office';
    sfx()?.music(song);
  }, [screen, post]);

  // ---------------------------------------------------------------- the season
  const newGame = (seed?: number) => {
    const s = G.newSave(seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
    s.started = true; s.settings = { ...saveRef.current.settings };
    persist(s); setHasSave(true); setTab('squad'); setJob(null); setScreen('office');
  };
  const cont = () => { const s = saveRef.current; s.started = true; persist(s); setScreen(s.seasonOver ? 'season' : 'office'); };
  const doJob = (a: G.WeekAction) => {
    const s = saveRef.current; sfx()?.unlock();
    if (s.acted) { sfx()?.no(); return; }
    if (a === 'rest') { G.rest(s); sfx()?.pin(); persist(s); }
    else if (a === 'scout') { if (G.scout(s)) { sfx()?.pin(); persist(s); } else sfx()?.no(); }
    else if (a === 'train') { setJob('train'); setTab('squad'); sfx()?.button(); }
    else { setJob('sign'); setTab('market'); sfx()?.button(); }
  };
  const trainOne = (id: string, st: G.Stat) => { const s = saveRef.current; if (G.train(s, id, st)) { sfx()?.pin(); setJob(null); persist(s); } else sfx()?.no(); };
  const signOne = (id: string) => {
    const s = saveRef.current, full = s.squad.length >= G.SQUAD_MAX;
    if (full && !releaseId) { sfx()?.no(); return; }
    if (G.sign(s, id, full ? releaseId : undefined)) { sfx()?.coin(); setJob(null); setReleaseId(''); setTab('squad'); persist(s); } else sfx()?.no();
  };

  // ---------------------------------------------------------------- the draft
  const opp = G.opponentOf(save);
  const T = opp ? G.team(opp) : null;
  const toDraft = () => {
    const s = saveRef.current, f = G.ourFixture(s); if (!f) return;
    sfx()?.unlock(); sfx()?.flip();
    draftRef.current = G.makeDraft(s, f);
    setTactic('balanced'); setPaw(null); setStamped(null); setSel(null);
    setScreen('draft'); rerender();
    queueRival();
  };
  const rivalRng = useRef(G.rng(1));
  const queueRival = () => {
    const d = draftRef.current; if (!d) return;
    if (rivalTimer.current) clearTimeout(rivalTimer.current);
    const turn = G.draftTurn(d);
    if (!turn || turn.side !== 1) return;
    const s = saveRef.current, o = G.opponentOf(s)!;
    rivalRng.current = G.rng(G.hash(s.seed, s.season, s.week, d.step, 3));
    const a = G.advise(d, 1, 'habit', rivalRng.current, G.team(o).habit);
    if (!a) return;
    setPaw({ id: a.id, t: Date.now() });
    rivalTimer.current = window.setTimeout(() => {
      const dd = draftRef.current; if (!dd || dd !== d) return;
      const kind = G.draftTurn(dd)?.kind;
      if (G.act(dd, a.id)) { if (kind === 'ban') { sfx()?.stamp(); setStamped(a.id); } else sfx()?.flip(); }
      setPaw(null); rerender();
      if (G.draftDone(dd)) afterDraft(); else queueRival();
    }, 760);
  };
  const ourMove = (id: string) => {
    const d = draftRef.current; if (!d) return;
    const turn = G.draftTurn(d); if (!turn || turn.side !== 0) return;
    if (!G.legal(d, id)) { sfx()?.no(); return; }
    G.act(d, id); setSel(null);
    if (turn.kind === 'ban') { sfx()?.stamp(); setStamped(id); } else sfx()?.flip();
    rerender();
    if (G.draftDone(d)) afterDraft(); else queueRival();
  };
  const afterDraft = () => { const d = draftRef.current!; setTactic(G.suggestTactic(G.lineupOf(d, 0), G.lineupOf(d, 1)).tactic); rerender(); };
  const autoDraft = () => {
    const d = draftRef.current; if (!d) return;
    sfx()?.button();
    // our moves straight away (as the Hint would), the rival's by their habit
    const s = saveRef.current, o = G.opponentOf(s)!;
    if (rivalTimer.current) clearTimeout(rivalTimer.current); setPaw(null);
    G.autoDraft(d, ['hint', 'habit'], G.rng(G.hash(s.seed, s.season, s.week, 99)), [undefined, G.team(o).habit]); setSel(null);
    sfx()?.flip(); afterDraft();
  };
  const hint = (() => { const d = draftRef.current; if (!d || !save.settings.hint) return null; const t = G.draftTurn(d); return t && t.side === 0 ? G.advise(d, 0, 'hint') : null; })();

  // ---------------------------------------------------------------- the match
  const kickOff = () => {
    const s = saveRef.current, d = draftRef.current, f = G.ourFixture(s); if (!d || !f || !G.draftDone(d)) return;
    sfx()?.unlock(); sfx()?.whistle();
    const opts = G.ourMatchOpts(s, f, G.lineupOf(d, 0), G.lineupOf(d, 1), tactic);
    optsRef.current = opts;
    const m = new G.Match(opts);
    matchRef.current = m; replayRef.current = null; setReplaying(false);
    sceneRef.current?.setMatch(m, ['#d8352a', G.team(G.opponentOf(s, f)!).colour]);
    speed_(1); pausedRef.current = false; setPaused(false); setProtectOpen(false);
    if (s.tutorial < 3) { s.tutorial = Math.max(s.tutorial, 2); persist(s); }
    setScreen('match');
  };
  const finishMatch = () => {
    const s = saveRef.current, m = matchRef.current, d = draftRef.current, f = G.ourFixture(s);
    if (!m || !d || !f || replayRef.current) return;
    const o = G.opponentOf(s, f)!;
    const res = G.record(s, f, m, G.lineupOf(d, 0).filter((p) => !p.loan));
    persist(s);
    if (res) setPost({ ...res, m, opp: o, f });
    setScreen('post');
  };
  const nextWeek = () => {
    const s = saveRef.current; sfx()?.button();
    G.endWeek(s); persist(s); setPost(null); draftRef.current = null; matchRef.current = null; setJob(null);
    setScreen(s.seasonOver ? 'season' : 'office');
  };
  const startSeason = () => { const s = saveRef.current; G.newSeason(s); persist(s); sfx()?.whistle(); setTab('squad'); setScreen('office'); };
  /** replay the deciding moment: the same match from its seed and shouts, from a few seconds before */
  const replay = () => {
    const m = matchRef.current, o = optsRef.current; if (!m || !o) return;
    const at = Math.max(0, (m.decisiveAt >= 0 ? m.decisiveAt : m.t) - 5 * G.TICK);
    const r = new G.Match({ ...o, shouts: [...(m.applied ?? [])] });
    while (r.t < at && !r.over) r.step();
    replayRef.current = { until: Math.min(m.t, (m.decisiveAt >= 0 ? m.decisiveAt : m.t) + 2 * G.TICK) };
    sceneRef.current?.setMatch(r);
    (sceneRef as { current: LeagueScene | null }).current!.confetti = false;
    matchRef.current = r; speed_(0.5); setReplaying(true); setScreen('match'); sfx()?.whistle();
    replayDone.current = () => { matchRef.current = m; setReplaying(false); replayRef.current = null; setScreen('post'); };
  };
  const replayDone = useRef<() => void>(() => {});
  const shout = (kind: G.ShoutKind, target?: number) => {
    const m = matchRef.current; if (!m || replayRef.current) return;
    if (m.shout(0, kind, target)) { sfx()?.whistle(); setProtectOpen(false); } else sfx()?.no();
  };
  const skip = () => {
    const m = matchRef.current; if (!m || replayRef.current) return;
    sfx()?.button();
    while (!m.over) m.step();
    sceneRef.current?.feed(m.events);
    endAt.current = performance.now() + 600;
  };
  const endAt = useRef(0);

  // the event feed: sounds and the scene's effects
  const onEvents = (m: G.Match) => {
    const sd = sfx();
    for (const e of m.events) {
      if (e.k === 'throw') { if (Math.random() < 0.35 || e.big) sd?.whoosh(e.big); }
      else if (e.k === 'hit') { if (Math.random() < 0.5 || e.counter) sd?.thud(e.counter); }
      else if (e.k === 'ko') { sd?.pop(); hitStop.current = performance.now() + (sceneRef.current?.reduced ? 0 : 90); }
      else if (e.k === 'fort' && e.knocked) sd?.crumble();
      else if (e.k === 'surge') { sd?.surge(); if (e.side === 0) sd?.cheer(false); }
      else if (e.k === 'flag') sd?.flagFall();
      else if (e.k === 'end') { if (e.winner === 0) sd?.cheer(true); else sd?.groan(); if (!replayRef.current) endAt.current = performance.now() + 2600; }
    }
    sceneRef.current?.feed(m.events);
  };

  // ---------------------------------------------------------------- the loop
  useEffect(() => {
    let raf = 0, last = performance.now(), acc = 0, n = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame); fps.current++;
      sfx()?.pump();
      const sc = sceneRef.current, m = matchRef.current;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!sc || !m || screenRef.current !== 'match') return;
      let steps = 0;
      if (!pausedRef.current && now > hitStop.current) {
        // slow motion for the last moment: the final second, or a fort about to fall
        const tense = !m.over && (m.t > G.MATCH_TICKS - G.TICK || Math.min(m.fortShare(0), m.fortShare(1)) < 0.05);
        const k = replayRef.current ? speedRef.current : tense && speedRef.current <= 2 ? 0.35 : speedRef.current;
        acc += dt * k;
        while (acc >= 1 / G.TICK) {
          acc -= 1 / G.TICK;
          if (m.over) { acc = 0; break; }
          // the casual-friendly Hint can shout for us? No: shouts are the player's. Rival coaches shout in the engine.
          m.step(); onEvents(m); steps++;
          if (replayRef.current && m.t >= replayRef.current.until) { replayDone.current(); return; }
          if (now < hitStop.current) break;
        }
      }
      sc.frame(Math.min(1, acc * G.TICK), steps, !upright);
      if (++n % 6 === 0 || m.over) {
        const kos = (sd: G.Side) => m.units.filter((u) => u.side === sd).reduce((k, u) => k + u.stats.kos, 0);
        setHud({ t: m.t, lines: m.log.slice(-3).reverse(), canShout: m.canShout(0), hint: saveRef.current.settings.hint ? G.shoutHint(m, 0) : null, over: m.over, phase: m.phase,
          blocks: [m.blocksLeft(0), m.blocksLeft(1)], fort: [m.fortShare(0), m.fortShare(1)], up: [m.up(0), m.up(1)], kos: [kos(0), kos(1)], mo: [m.momentum[0], m.momentum[1]], surge: [m.surge[0] > 0, m.surge[1] > 0] });
      }
      // an upright phone: the pitch is cropped to 4:3 and the camera follows the action
      if (upright && canvasRef.current) {
        const cv = canvasRef.current, st = cv.parentElement!, sw = st.clientWidth, cw = st.clientHeight * 16 / 9;
        const want = Math.max(sw - cw, Math.min(0, sw / 2 - sc.focusX() / 480 * cw));
        pan.current += (want - pan.current) * 0.08;
        cv.style.transform = `translateX(${Math.round(pan.current)}px)`;
      } else if (canvasRef.current && canvasRef.current.style.transform) canvasRef.current.style.transform = '';
      if (m.over && endAt.current && now > endAt.current && screenRef.current === 'match' && !replayRef.current) { endAt.current = 0; finishMatch(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upright]);

  // ---------------------------------------------------------------- the keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const sc = screenRef.current;
      if (e.key === 'Escape' && sc === 'draft' && selRef.current) { setSel(null); return; }
      if (e.key === 'Escape') { if (sc === 'howto' || sc === 'settings') setScreen(backRef.current); else if (sc === 'match' && !replayRef.current) { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); } return; }
      if (sc === 'match') {
        if (e.key === ' ') { e.preventDefault(); speed_(speedRef.current >= 4 ? 1 : speedRef.current * 2); }
        return;
      }
      if (sc === 'draft') {
        const d = draftRef.current; if (!d) return;
        if (/^[1-9]$/.test(e.key)) {
          const t = G.draftTurn(d); if (!t || t.side !== 0) return;
          const list = t.kind === 'pick' ? G.pickable(d, 0) : G.bannable(d, 0);
          const p = list[Number(e.key) - 1]; if (p) ourMove(p.id);
        }
        if (e.key === 'Enter' && G.draftDone(d)) kickOff();
        else if (e.key === 'Enter' && selRef.current && G.legal(d, selRef.current) && G.draftTurn(d)?.side === 0) ourMove(selRef.current);
        return;
      }
      if (e.key === 'Enter') {
        if (sc === 'office') { if (G.ourFixture(saveRef.current)) toDraft(); }
        else if (sc === 'post') nextWeek();
        else if (sc === 'title') { if (hasSave) cont(); else newGame(); }
      }
    };
    addEventListener('keydown', down); return () => removeEventListener('keydown', down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSave]);

  // ---------------------------------------------------------------- the debug hook for the browser tests
  useEffect(() => {
    (window as unknown as { __league: () => unknown }).__league = () => {
      const m = matchRef.current, d = draftRef.current;
      return {
        screen: screenRef.current, ready, save: saveRef.current, frames: fps.current, replaying: !!replayRef.current,
        draft: d && { step: d.step, done: G.draftDone(d), turn: G.draftTurn(d), picks: d.picks, bans: d.bans },
        match: m && { t: m.t, over: m.over, winner: m.winner, how: m.how, fort: [m.fortShare(0), m.fortShare(1)], up: [m.up(0), m.up(1)], used: m.used, mode: m.mode.map((x) => x?.kind ?? null), weather: m.weather, decisiveAt: m.decisiveAt, log: m.log.length },
        debug: {
          newGame: (seed = 1) => newGame(seed),
          toDraft: () => toDraft(),
          autoDraft: () => autoDraft(),
          kickOff: () => kickOff(),
          skip: () => skip(),
          step: (n = 1) => { const mm = matchRef.current; if (!mm) return; for (let i = 0; i < n && !mm.over; i++) { mm.step(); onEvents(mm); } },
          pause: (p = true) => { pausedRef.current = p; setPaused(p); },
          nextWeek: () => nextWeek(),
          setSave: (o: Partial<G.Save>) => { const s = { ...saveRef.current, ...o }; persist(s); },
          endSeason: () => { const s = saveRef.current; while (!s.seasonOver) { const f = G.ourFixture(s); if (f) { const r = G.botMatch(s, 'pro', G.rng(s.week + 1)); void r; } G.endWeek(s); } persist(s); setScreen('season'); },
          scene: () => sceneRef.current,
        },
      };
    };
  });

  // ---------------------------------------------------------------- pieces
  const s = save;
  const fixture = G.ourFixture(s);
  const weather = G.weatherOf(s);
  const morale = Math.round(s.squad.reduce((a, p) => a + p.morale, 0) / Math.max(1, s.squad.length));
  const note = (i: number) => s.tutorial <= i && (i !== 0 || screen === 'office') ? (
    <aside className="lg-note" role="note">
      <img src={`${ART}por-enzo.webp`} alt="" />
      <p><b>Enzo:</b> {NOTES[i]}</p>
      <button onClick={() => { const ss = saveRef.current; ss.tutorial = i + 1; persist(ss); sfx()?.pin(); }}>Got it</button>
    </aside>
  ) : null;

  const Card = ({ p, colour, state, onClick, glow, small, extra, stamp, num }: { p: G.Player; colour: string; state?: 'banned' | 'ours' | 'theirs' | 'dim' | ''; onClick?: () => void; glow?: boolean; small?: boolean; extra?: React.ReactNode; stamp?: boolean; num?: number }) => {
    const sp = G.SPECIAL[p.role], beats = G.BEATS[p.role], by = G.counterOf(p.role);
    return (
      <button type="button" className={`lg-card${small ? ' lg-small' : ''}${state ? ` lg-${state}` : ''}${glow ? ' lg-glow' : ''}${stamp ? ' lg-stamped' : ''}${!onClick && extra ? ' lg-static' : ''}`} style={{ '--team': colour } as React.CSSProperties} onClick={onClick} disabled={!onClick && !extra}
        title={`${p.name} the ${G.SPECIES_NAME[p.species]}: ${G.ROLE_NAME[p.role]} (${G.ovr(p)}). Special: ${sp.name}, ${sp.what}. ${G.PERSONALITY[p.personality].name}: ${G.PERSONALITY[p.personality].what}.`}>
        {num ? <i className="lg-num">{num}</i> : null}
        <span className="lg-pic"><img src={por(p)} alt={`${p.name} the ${G.SPECIES_NAME[p.species]}`} loading="lazy" /></span>
        <span className="lg-band">
          <img className="lg-role" src={`${ART}icon-${p.role}.png`} alt={G.ROLE_NAME[p.role]} />
          <span className="lg-name"><b>{p.name}</b><small>{G.ROLE_NAME[p.role]} · {G.ovr(p)}{p.loan ? ' · loan' : ''}</small></span>
          <img className="lg-pers" src={`${ART}icon-${p.personality}.png`} alt={G.PERSONALITY[p.personality].name} />
        </span>
        {!small && <span className="lg-bars">{G.STATS.map((k) => <span key={k} className="lg-bar"><i style={{ width: `${p[k] * 10}%`, background: STAT_COLOUR[k] }} /><em>{k} {p[k]}</em></span>)}</span>}
        {!small && <span className="lg-wheel">{beats && <span title={`Beats ${G.ROLE_NAME[beats].toLowerCase()}s`}>beats <img src={`${ART}icon-${beats}.png`} alt={G.ROLE_NAME[beats]} /></span>}{by && <span title={`Weak to ${G.ROLE_NAME[by].toLowerCase()}s`}>weak to <img src={`${ART}icon-${by}.png`} alt={G.ROLE_NAME[by]} /></span>}{!beats && <span>neutral</span>}</span>}
        {!small && <span className="lg-meta">{sp.name} · {G.PERSONALITY[p.personality].name} · age {p.age} · morale {p.morale}</span>}
        {state === 'banned' && <img className="lg-cross" src={`${ART}cross.png`} alt="Banned" />}
        {extra}
      </button>
    );
  };

  // ---------------------------------------------------------------- the office
  /** the office's layers drift apart a little as the pointer moves: the painting far, the photos near */
  const parallax = (e: React.PointerEvent<HTMLElement>) => {
    if (!saveRef.current.settings.motion || e.pointerType !== 'mouse') return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const office = () => {
    const fx = [...s.fixtures].sort((a, b) => a.week - b.week);
    const table = G.sortedTable(s);
    const oc = opp ? G.occasion(s, opp) : null;
    const report = s.scouted && opp ? G.scoutReport(s, opp) : null;
    return (
      <section className={`lg-office${upright ? ' lg-up' : ''}`} onPointerMove={parallax}>
        <div className="lg-paint" style={{ backgroundImage: `url(${ART}office.webp)` }} aria-hidden="true">
          <span className="lg-window" style={{ backgroundImage: `url(${ART}window-${weather.weather}.webp)` }}>{weather.weather === 'snow' || weather.weather === 'wind' ? <i className={`lg-flurry ${weather.weather}`} /> : null}</span>
          <span className="lg-lamp" />
          <span className="lg-shelf">{s.trophies.slice(-6).map((t, i) => <img key={i} src={`${ART}icon-${t.kind === 'cup' ? 'trophy' : 'coins'}.png`} alt="" title={t.text} />)}</span>
          <span className="lg-near">{s.photos.slice(-3).map((ph, i) => <span key={i} className="lg-snap" style={{ '--r': `${[-6, 4, -2][i]}deg` } as React.CSSProperties}><img src={`${ART}por-${ph.species}-${ph.look}.webp`} alt="" /></span>)}</span>
        </div>
        <header className="lg-bar-top">
          <span className="lg-chip"><img src={`${ART}icon-coins.png`} alt="" /> {s.money} coins</span>
          <span className="lg-chip lg-heart" title="Squad morale">♥ <span className="lg-meter"><i style={{ width: `${morale}%` }} /></span> {morale}</span>
          <span className="lg-chip">Season {s.season} · {s.week < G.LEAGUE_WEEKS ? `Week ${s.week + 1} of 7` : s.week === 7 ? 'Semi-finals' : 'Cup final'}</span>
          <span className="lg-chip" title={G.WEATHER[weather.weather].what}>{G.WEATHER[weather.weather].name}</span>
          <span className="lg-grow" />
          <button className="lg-small-btn" onClick={() => go('howto')}>How to play</button>
          <button className="lg-small-btn" onClick={() => go('settings')}>Settings</button>
          <button className="lg-small-btn" onClick={() => go('title')}>Title</button>
        </header>
        <div className="lg-board">
          {note(0)}
          <nav className="lg-tabs">
            {(['squad', 'fixtures', 'table', 'market', 'photos'] as Tab[]).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); sfx()?.pin(); }}>{t === 'squad' ? `Squad (${s.squad.length})` : t === 'fixtures' ? 'Fixtures' : t === 'table' ? 'League table' : t === 'market' ? 'Free agents' : `Photos (${s.photos.length})`}</button>)}
          </nav>
          {job === 'train' && <p className="lg-ask">Pick a player and a stat to train (+1). <button className="lg-small-btn" onClick={() => setJob(null)}>Cancel</button></p>}
          {job === 'sign' && <p className="lg-ask">Pick a free agent to sign.{s.squad.length >= G.SQUAD_MAX && ' The squad is full: choose who leaves first.'} <button className="lg-small-btn" onClick={() => setJob(null)}>Cancel</button></p>}
          <div className="lg-cork">
            {tab === 'squad' && <div className="lg-cards">{s.squad.map((p, i) => <Card key={p.id} p={p} colour="#d8352a" num={i + 1} extra={job === 'train' ? <span className="lg-train">{G.STATS.map((k) => <span key={k} role="button" tabIndex={0} className={p[k] >= G.STAT_MAX ? 'off' : ''} onClick={(e) => { e.stopPropagation(); trainOne(p.id, k); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); trainOne(p.id, k); } }}>+{k}</span>)}</span> : job === 'sign' && s.squad.length >= G.SQUAD_MAX ? <span className="lg-train"><span role="button" tabIndex={0} className={releaseId === p.id ? 'on' : ''} onClick={(e) => { e.stopPropagation(); setReleaseId(p.id); setTab('market'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setReleaseId(p.id); setTab('market'); } }}>Let go</span></span> : null} />)}</div>}
            {tab === 'market' && (
              <div className="lg-cards">
                {s.free.map((p) => <Card key={p.id} p={p} colour="#c8a060" onClick={job === 'sign' ? () => signOne(p.id) : undefined} extra={<span className="lg-price"><img src={`${ART}icon-coins.png`} alt="" /> {G.price(p)}</span>} />)}
                {s.squad.length >= G.SQUAD_MAX && job === 'sign' && <p className="lg-ask">{releaseId ? `${s.squad.find((p) => p.id === releaseId)?.name} will leave.` : 'Pick “Let go” on a squad card first.'} <button className="lg-small-btn" onClick={() => setTab('squad')}>Choose</button></p>}
              </div>
            )}
            {tab === 'fixtures' && (
              <ol className="lg-fixtures">
                {fx.filter((f) => f.home === 'snowcats' || f.away === 'snowcats').map((f, i) => {
                  const o = f.home === 'snowcats' ? f.away : f.home;
                  return <li key={i} className={f.week === s.week && !f.done ? 'now' : ''}><img src={coachPic(o)} alt="" /><span><b>{f.kind === 'league' ? `Week ${f.week + 1}` : f.kind === 'semi' ? 'Semi-final' : 'Final'}</b> {f.home === 'snowcats' ? 'vs' : 'at'} {G.team(o).name}</span><em>{f.done ? (f.winner === 'snowcats' ? 'Won' : f.winner === 'draw' ? 'Drew' : 'Lost') : f.week === s.week ? 'Next' : ''}</em></li>;
                })}
              </ol>
            )}
            {tab === 'photos' && (s.photos.length ? (
              <div className="lg-photos">{[...s.photos].reverse().map((ph, i) => (
                <figure key={i} className="lg-polaroid" style={{ '--r': `${((i * 37) % 9) - 4}deg` } as React.CSSProperties}>
                  <img src={`${ART}por-${ph.species}-${ph.look}.webp`} alt={`${ph.name} the ${G.SPECIES_NAME[ph.species]}`} />
                  <figcaption>{ph.kind === 'cup' ? `Cup winners! ${ph.name} starred` : ph.kind === 'semi' ? `Into the final! ${ph.name} starred` : ph.kind === 'derby' ? `Derby day: ${ph.name} beat the Alpacas` : `${ph.name} beat the ${G.team(ph.opp).short}`}<small>Season {ph.season}, {ph.week < G.LEAGUE_WEEKS ? `week ${ph.week + 1}` : ph.week === G.LEAGUE_WEEKS ? 'semi-final' : 'final'} · {ph.ours}% to {ph.theirs}%</small></figcaption>
                </figure>
              ))}</div>
            ) : <p className="lg-ask">Win a match and the player of the match gets their photo pinned up here.</p>)}
            {tab === 'table' && (
              <table className="lg-table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th title="Fort damage: done minus taken">±</th><th>Pts</th></tr></thead>
                <tbody>{table.map((r, i) => <tr key={r.team} className={r.team === 'snowcats' ? 'us' : ''}><td>{i + 1}</td><td><i className="lg-dot" style={{ background: G.team(r.team).colour }} />{G.team(r.team).short}</td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.ff - r.fa}</td><td><b>{r.pts}</b></td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>
        <aside className="lg-side">
          {T && fixture && (
            <div className="lg-next">
              <img className="lg-coach" src={coachPic(T.id)} alt={T.coach} />
              <div>
                <b>{fixture.kind === 'final' ? 'Cup final' : fixture.kind === 'semi' ? 'Semi-final' : `Week ${s.week + 1}`}: {fixture.home === 'snowcats' ? 'home to' : 'away at'} the {T.name}</b>
                <p className="lg-quote">{T.coach}: “{T.taunt[(s.week + s.season) % T.taunt.length]}”</p>
                {oc?.kind && <p className="lg-occasion">{oc.text}</p>}
                {report ? <p className="lg-report"><b>Scout report:</b> {T.blurb} Likely ban: {report.bans.map((p) => p.name).join(', ') || 'anyone'}. Their best: {report.picks.map((p) => `${p.name} (${G.ROLE_NAME[p.role].toLowerCase()})`).join(', ')}. They like to play “{G.TACTIC_NAME[report.tactic]}”. Knowing their plan gives us a head start.</p> : <p className="lg-dim">Scout them to see their likely bans and picks.</p>}
              </div>
            </div>
          )}
          <ul className="lg-clips">{s.news.slice(0, 3).map((n, i) => <li key={i}>{n}</li>)}</ul>
        </aside>
        <footer className="lg-desk">
          <div className="lg-jobs" role="group" aria-label="This week’s job">
            {([['train', 'Train', 'A player +1 to a stat'], ['scout', 'Scout', 'Their plan, and a head start'], ['rest', 'Rest', 'Morale up for everyone'], ['sign', 'Sign', 'Buy a free agent']] as [G.WeekAction, string, string][]).map(([a, name, what]) => (
              <button key={a} className={`lg-job${s.acted === a ? ' done' : ''}${job === a ? ' on' : ''}`} disabled={!!s.acted || (a === 'scout' && !fixture)} onClick={() => doJob(a)}>
                <img src={`${ART}icon-${a === 'scout' ? 'scout-job' : a}.png`} alt="" /><b>{name}</b><small>{what}</small>
              </button>
            ))}
          </div>
          <button className="lg-go lg-ticket" disabled={!fixture} onClick={toDraft}>{s.acted ? 'To the draft →' : 'Skip the job: to the draft →'}</button>
        </footer>
      </section>
    );
  };

  // ---------------------------------------------------------------- the draft table
  /** a compact draft card: the portrait in the team's colour, the role badge, the rating and the name; tap to see it all */
  const Mini = ({ p, colour, state, glow, stamp, num, selected, onClick, paw: pw }: { p: G.Player; colour: string; state: '' | 'banned' | 'taken-us' | 'taken-them' | 'muted'; glow?: boolean; stamp?: boolean; num?: number; selected?: boolean; onClick: () => void; paw?: boolean }) => (
    <button type="button" className={`lg-mini${state ? ` lg-${state}` : ''}${glow ? ' lg-glow' : ''}${stamp ? ' lg-stamped' : ''}${selected ? ' lg-sel' : ''}`} style={{ '--team': colour } as React.CSSProperties} onClick={onClick}
      aria-label={`${p.name} the ${G.SPECIES_NAME[p.species]}, ${G.ROLE_NAME[p.role].toLowerCase()}, rating ${G.ovr(p)}${state === 'banned' ? ', banned' : state === 'taken-us' ? ', in our team' : state === 'taken-them' ? ', in their team' : ''}`}>
      <span className="lg-mpic"><img src={por(p)} alt="" loading="lazy" /></span>
      <img className="lg-mrole" src={`${ART}icon-${p.role}.png`} alt="" />
      <i className="lg-movr">{G.ovr(p)}</i>
      {num ? <i className="lg-num">{num}</i> : null}
      <span className="lg-mname">{p.name}</span>
      {state === 'banned' && <img className="lg-cross" src={`${ART}cross.png`} alt="" />}
      {(state === 'taken-us' || state === 'taken-them') && <span className="lg-ribbon">✓</span>}
      {pw && <img className="lg-paw" src={coachPic(T!.id)} alt="" />}
    </button>
  );
  const draft = () => {
    const d = draftRef.current; if (!d || !T) return null;
    const turn = G.draftTurn(d), done = G.draftDone(d);
    const ours = turn?.side === 0;
    const list = turn && ours ? (turn.kind === 'pick' ? G.pickable(d, 0) : G.bannable(d, 0)) : [];
    const allowed = new Set(list.map((p) => p.id));
    const numOf = (id: string) => { const i = list.findIndex((p) => p.id === id); return i >= 0 && i < 9 ? i + 1 : undefined; };
    const stateOf = (p: G.Player) => (d.bans[0].includes(p.id) || d.bans[1].includes(p.id) ? 'banned' : d.picks[0].includes(p.id) ? 'taken-us' : d.picks[1].includes(p.id) ? 'taken-them' : ours && !allowed.has(p.id) ? 'muted' : '') as '' | 'banned' | 'taken-us' | 'taken-them' | 'muted';
    const tap = (p: G.Player) => { sfx()?.unlock(); if (sel === p.id && allowed.has(p.id)) { ourMove(p.id); return; } setSel(p.id); sfx()?.pin(); };
    const row = (cards: G.Player[], colour: string) => cards.map((p) => <Mini key={p.id} p={p} colour={colour} state={stateOf(p)} glow={hint?.id === p.id} stamp={stamped === p.id} num={numOf(p.id)} selected={sel === p.id} onClick={() => tap(p)} paw={paw?.id === p.id} />);
    const slots = (side: G.Side) => Array.from({ length: G.LINEUP }, (_, i) => { const id = d.picks[side][i]; const p = id ? G.findCard(d, id) : null; return <span key={i} className={`lg-slot${p ? ' full' : ''}`}>{p ? <img src={por(p)} alt={p.name} title={`${p.name}: ${G.ROLE_NAME[p.role]}`} /> : null}{p && <img className="lg-slot-role" src={`${ART}icon-${p.role}.png`} alt="" />}</span>; });
    const sugg = done ? G.suggestTactic(G.lineupOf(d, 0), G.lineupOf(d, 1)) : null;
    const f = fixture!;
    const picked = sel ? G.findCard(d, sel) : null;
    const pickedSide = picked ? (d.squads[0].some((q) => q.id === picked.id) ? 0 : d.squads[1].some((q) => q.id === picked.id) ? 1 : -1) : -1;
    const verb = turn?.kind === 'ban' ? 'Ban' : 'Pick';
    return (
      <section className={`lg-draft${upright ? ' lg-up' : ''}${!done && !ours ? ' lg-waiting' : ''}`} style={{ backgroundImage: `url(${ART}${f.kind === 'final' ? 'final' : 'draft'}.webp)` }}>
        <header className="lg-dhead">
          <span className="lg-glass"><img src={`${ART}hourglass.png`} alt="" className={done ? '' : 'turning'} /></span>
          {!done && !ours && <img className="lg-dcoach" src={coachPic(T.id)} alt="" />}
          <b className="lg-turn">{done ? 'Draft done! Pick a plan and kick off.' : ours ? (turn!.kind === 'ban' ? `Your ban: tap one of ${d.bans[0].length ? 'their cards or a loan' : 'their cards'}, then Ban` : `Your pick, ${d.picks[0].length + 1} of 5: tap a card, then Pick`) : `${T.coach} is choosing…`}</b>
          <span className="lg-grow" />
          <label className="lg-toggle"><input type="checkbox" checked={save.settings.hint} onChange={(e) => { const ss = saveRef.current; ss.settings.hint = e.target.checked; persist(ss); }} /> Hint</label>
          {!done && <button onClick={autoDraft}>Auto-draft</button>}
        </header>
        {note(1)}
        <div className="lg-felt">
          <div className={`lg-half lg-red${ours ? ' lg-turnside' : ''}`}>
            <h3>Snowcats</h3>
            <div className="lg-slots">{slots(0)}</div>
            <div className="lg-row">{row(d.squads[0], '#d8352a')}</div>
          </div>
          <div className="lg-mid">
            <h3>Village loans</h3>
            <div className="lg-row">{row(d.pool, '#c8a060')}</div>
          </div>
          <div className={`lg-half lg-blue${!done && !ours ? ' lg-turnside' : ''}`} style={{ '--team': T.colour } as React.CSSProperties}>
            <h3>{T.short}</h3>
            <div className="lg-slots">{slots(1)}</div>
            <div className="lg-row">{row(d.squads[1], T.colour)}</div>
          </div>
        </div>
        <footer className="lg-dfoot">
          {hint && !done && <p className="lg-hint"><img src={`${ART}por-enzo.webp`} alt="" /><span><b>Hint:</b> {hint.why}</span><button onClick={() => ourMove(hint.id)}>Do it</button></p>}
          {!hint && !done && <p className="lg-hint lg-quiet"><img src={coachPic(T.id)} alt="" /><span>{T.coach}: “{T.taunt[(d.step + s.week) % T.taunt.length]}”</span></p>}
          {done && sugg && (
            <div className="lg-kick">
              <div className="lg-plans" role="radiogroup" aria-label="Tactic">
                {(['balanced', 'push', 'guard'] as G.Tactic[]).map((t) => <button key={t} role="radio" aria-checked={tactic === t} className={tactic === t ? 'on' : ''} onClick={() => { setTactic(t); sfx()?.button(); }}>{G.TACTIC_NAME[t]}{t === sugg.tactic && save.settings.hint ? ' ★' : ''}</button>)}
              </div>
              {save.settings.hint && <p className="lg-dim">★ {sugg.why} · {G.WEATHER[weather.weather].name}: {G.WEATHER[weather.weather].what}</p>}
              <button className="lg-go" onClick={kickOff}>Kick off!</button>
            </div>
          )}
        </footer>
        {picked && (
          <div className="lg-inspect" role="dialog" aria-label={`${picked.name}’s card`}>
            <Card p={picked} colour={pickedSide === 0 ? '#d8352a' : pickedSide === 1 ? T.colour : '#c8a060'} />
            <div className="lg-inspect-side">
              <p><b>{picked.name}</b> the {G.SPECIES_NAME[picked.species]}{picked.loan ? ', a village loan' : pickedSide === 1 ? `, of the ${T.short}` : ''}.</p>
              <p>{G.ROLE_WHY[picked.role]}</p>
              <p className="lg-dim">{G.SPECIAL[picked.role].name}: {G.SPECIAL[picked.role].what}. {G.PERSONALITY[picked.personality].name}: {G.PERSONALITY[picked.personality].what}.</p>
              {hint?.id === picked.id && <p className="lg-hintline"><b>Hint:</b> {hint.why}</p>}
              <div className="lg-rowb">
                {allowed.has(picked.id) && <button className={verb === 'Ban' ? 'lg-go' : 'lg-go'} onClick={() => ourMove(picked.id)}>{verb} {picked.name}</button>}
                {!allowed.has(picked.id) && !done && <span className="lg-dim">{stateOf(picked) === 'banned' ? 'Banned.' : stateOf(picked).startsWith('taken') ? 'Already picked.' : !ours ? 'Wait for your turn.' : turn?.kind === 'ban' ? 'You can only ban their cards or the loans.' : 'You can only pick your own cards or the loans.'}</span>}
                <button onClick={() => setSel(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  // ---------------------------------------------------------------- the match (canvas plus bars)
  const m = matchRef.current;
  const secs = hud ? Math.max(0, Math.ceil((G.MATCH_TICKS - hud.t) / G.TICK)) : 90;
  const ourUnits = m ? m.units.filter((u) => u.side === 0) : [];

  // ---------------------------------------------------------------- post-match
  const postView = () => {
    if (!post) return null;
    const { m: pm, opp: o } = post, OT = G.team(o);
    const mvp = pm.mvp(0), theirs = pm.mvp(1);
    const head = post.won ? (pm.how === 'flag' ? 'Their flag is down: we win!' : 'Time! Our fort stands taller: we win!') : post.drew ? 'A draw: honours even.' : pm.how === 'flag' ? 'Our flag fell… they win this one.' : 'Time! Their fort stands taller.';
    return (
      <section className="lg-post">
        <div className="lg-paper lg-wide">
          <h2>{head}</h2>
          <p className="lg-dim">Our fort: {pm.blocksLeft(0)} of 16 blocks left · theirs: {pm.blocksLeft(1)} · {Math.round(pm.t / G.TICK)} seconds · {pm.leadChanges === 0 ? 'the lead never changed hands' : `the lead changed hands ${pm.leadChanges === 1 ? 'once' : pm.leadChanges === 2 ? 'twice' : `${pm.leadChanges} times`}`}</p>
          <FortGraph m={pm} colour={OT.colour} />
          <div className="lg-post-grid">
            <div className="lg-mvp">
              <h3>Player of the match</h3>
              {mvp && <Card p={mvp.p} colour="#d8352a" small />}
              {mvp && <p>{statLine(mvp)}</p>}
              {theirs && <p className="lg-dim">Their best: {theirs.name} ({statLine(theirs)})</p>}
            </div>
            <table className="lg-table lg-stats"><thead><tr><th>Player</th>{STAT_COLS.map((c) => <th key={c.key} title={c.tip}><img src={`${ART}hud-${c.icon}.png`} alt="" />{c.label}</th>)}<th title="How their morale moved (it scales how well they play)">Morale</th></tr></thead>
              <tbody>{pm.units.filter((u) => u.side === 0).map((u) => { const ch = post.changes.find((c) => c.id === u.p.id); return <tr key={u.id}><td>{u.name}{u.p.loan ? ' (loan)' : ''}</td>{STAT_COLS.map((c) => <td key={c.key}>{c.val(u)}</td>)}<td>{ch ? (ch.d > 0 ? `+${ch.d}` : ch.d) : '–'}</td></tr>; })}</tbody>
            </table>
          </div>
          <div className="lg-shake">
            <img src={coachPic(o)} alt={OT.coach} />
            <p>{OT.coach}: “{post.won ? OT.shake[1] : OT.shake[0]}” <span className="lg-dim">(paws are shaken)</span></p>
          </div>
          <p>+{post.pay} coins. {post.changes.filter((c) => c.d < 0 && !pm.units.some((u) => u.side === 0 && u.p.id === c.id)).map((c) => c.name).join(', ') ? `On the bench and grumpy: ${post.changes.filter((c) => c.d < 0 && !pm.units.some((u) => u.side === 0 && u.p.id === c.id)).map((c) => c.name).join(', ')}.` : ''}</p>
          <div className="lg-rowb">
            <button onClick={replay}>Replay the deciding moment</button>
            <button className="lg-go" onClick={nextWeek} autoFocus>Back to the office</button>
          </div>
        </div>
      </section>
    );
  };

  // ---------------------------------------------------------------- the season's end
  const seasonView = () => {
    const res = G.cupResult(s), pl = G.place(s), fin = s.fixtures.find((f) => f.kind === 'final');
    const champ = fin?.winner && fin.winner !== 'draw' ? fin.winner : null;
    const best = [...s.squad].sort((a, b) => b.mvps - a.mvps || b.kos - a.kos)[0];
    return (
      <section className="lg-season">
        <img className="lg-season-art" src={`${ART}${res === 'cup' ? 'trophy' : 'season'}.webp`} alt={res === 'cup' ? 'Dora and Enzo lift the cup with the whole squad' : 'Dora, Enzo and the squad share cocoa by a campfire'} />
        <div className="lg-season-title"><h1>{res === 'cup' ? 'Champions!' : `Season ${s.season} is over`}</h1></div>
        <div className="lg-paper lg-season-card">
          <p><b>{G.ordinal(pl)}</b> in the league. {res === 'cup' ? 'The Snow Day Cup is ours!' : res === 'runner' ? 'Cup runners-up: so close!' : res === 'semi' ? 'Out in the semi-finals.' : 'We missed the cup this time.'}{champ && res !== 'cup' ? ` The ${G.team(champ).name} won the cup.` : ''}</p>
          {best && <p>Squad star: <b>{best.name}</b> the {G.SPECIES_NAME[best.species]} ({best.mvps} player-of-the-match awards).</p>}
          <p className="lg-dim">Next season everyone gets a year older: young players grow, veterans may slow down or retire, a rookie joins, and every rival signs a new star.</p>
          <div className="lg-shelf-row">{s.trophies.map((t, i) => <span key={i} title={t.text}><img src={`${ART}icon-${t.kind === 'cup' ? 'trophy' : 'coins'}.png`} alt="" />{t.text}</span>)}</div>
          <button className="lg-go" onClick={startSeason}>Start season {s.season + 1}</button>
        </div>
        {s.goodbye && <div className="lg-paper lg-goodbye"><img src={por(s.goodbye)} alt="" /><p>Goodbye, {s.goodbye.name}!</p></div>}
      </section>
    );
  };

  // ---------------------------------------------------------------- render
  return (
    <main className={`lg-shell lg-on-${screen}${upright ? ' lg-upright' : ''}`} data-ready={ready ? 'true' : 'false'}>
      <div className="lg-game" ref={gameRef} aria-hidden={screen !== 'match'}>
        <header className="lg-mtop">
          {([0, 1] as G.Side[]).map((sd) => {
            const name = sd === 0 ? 'Snowcats' : T?.short ?? '', colour = sd === 0 ? '#d8352a' : T?.colour ?? '#2f74d8';
            const blocks = hud?.blocks[sd] ?? 16, up = hud?.up[sd] ?? 5, mo = hud?.surge[sd] ? 100 : hud?.mo[sd] ?? 0;
            return (
              <div key={sd} className={`lg-hside${sd ? ' them' : ''}`} style={{ '--team': colour, order: sd ? 2 : 0 } as React.CSSProperties}>
                <span className="lg-mteam" title={name}><i /><span className="lg-tname">{name}</span><span className="lg-pips" title={`${up} of 5 players up`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < up ? 'on' : ''} />)}</span></span>
                <span className="lg-hstat lg-hfort" title={`${sd === 0 ? 'Our' : 'Their'} fort: ${blocks} of 16 blocks standing. Knock them all out and the flag falls.`}><img src={`${ART}hud-fort.png`} alt="Fort" /><span className="lg-hbar"><b style={{ width: `${(hud?.fort[sd] ?? 1) * 100}%` }} /></span><em>{blocks}</em></span>
                <span className="lg-hstat" title={`KOs by the ${name}`}><img src={`${ART}hud-ko.png`} alt="KOs" /><em>{hud?.kos[sd] ?? 0}</em></span>
                <span className={`lg-hstat lg-hmo${hud?.surge[sd] ? ' surge' : ''}`} title="Momentum: KOs and knocked blocks fill it; when it is full the team surges for six seconds"><img src={`${ART}hud-momentum.png`} alt="Momentum" /><span className="lg-hbar"><b style={{ width: `${mo}%` }} /></span></span>
              </div>
            );
          })}
          <b className="lg-clock" style={{ order: 1 }}>{replaying ? 'Replay' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</b>
        </header>
        {upright && !replaying && <p className="lg-sideways">Turn your phone sideways for a bigger view</p>}
        <div className="lg-stage"><canvas ref={canvasRef} className="lg-canvas" aria-label="The snowball match" /></div>
        {screen === 'match' && !replaying && note(2)}
        <div className="lg-ticker" aria-live="polite">{(hud?.lines ?? []).map((l, i) => <p key={`${l.t}-${i}`} className={l.side === 0 ? 'us' : l.side === 1 ? 'them' : 'neutral'}>{l.text}</p>)}</div>
        <footer className="lg-mbar">
          {!replaying && <div className="lg-shouts" role="group" aria-label="Shouts from the bench">
            <button className={hud?.hint?.kind === 'attack' ? 'lg-glow' : ''} disabled={!hud?.canShout} onClick={() => shout('attack')}>All attack!</button>
            <button className={hud?.hint?.kind === 'hold' ? 'lg-glow' : ''} disabled={!hud?.canShout} onClick={() => shout('hold')}>Hold the walls!</button>
            <span className="lg-protect">
              <button className={hud?.hint?.kind === 'protect' ? 'lg-glow' : ''} disabled={!hud?.canShout} onClick={() => setProtectOpen((o) => !o)}>Protect…</button>
              {protectOpen && hud?.canShout && <span className="lg-pmenu">{ourUnits.map((u) => <button key={u.id} onClick={() => shout('protect', u.id)}>{u.name}</button>)}</span>}
            </span>
          </div>}
          <div className="lg-speed" role="group" aria-label="Speed">
            {replaying ? <button onClick={() => replayDone.current()}>Done</button> : <>
              {[1, 2, 4].map((n) => <button key={n} className={speed === n ? 'on' : ''} onClick={() => speed_(n)}>{n}×</button>)}
              <button onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? 'Play' : 'Pause'}</button>
              <button onClick={skip}>Skip</button>
            </>}
          </div>
        </footer>
        <p className="lg-shout-hint">{!replaying && hud?.hint && hud.canShout ? `Hint: ${hud.hint.why}` : ''}</p>
      </div>

      {screen === 'title' && (
        <section className="lg-title">
          <img className="lg-title-art" src={`${ART}title.webp`} alt="Dora and Enzo coach their snowball team against the flamingos" />
          <div className="lg-title-menu">
            <h1>Snow Day League</h1>
            <p>Coach the Burrow Snowcats: draft, plan, then watch the snowballs fly.</p>
            <div className="lg-rowb">
              {hasSave && <button className="lg-go" onClick={cont}>Continue (season {save.season})</button>}
              <button className={hasSave ? '' : 'lg-go'} onClick={() => newGame()}>{hasSave ? 'New league' : 'Play'}</button>
              <button onClick={() => go('howto')}>How to play</button>
              <button onClick={() => go('settings')}>Settings</button>
            </div>
            <a className="lg-home" href="/">← Arcade</a>
          </div>
        </section>
      )}
      {screen === 'office' && office()}
      {screen === 'draft' && draft()}
      {screen === 'post' && postView()}
      {screen === 'season' && seasonView()}
      {screen === 'howto' && (
        <section className="lg-sheet">
          <div className="lg-paper lg-wide">
            <h2>How to play</h2>
            <p><b>Each week</b> do one job in the office: <b>Train</b> a player (+1 to a stat), <b>Scout</b> the next rival (their likely bans and picks, and a head start), <b>Rest</b> (morale up) or <b>Sign</b> a free agent. Then draft and watch.</p>
            <p><b>The draft:</b> each side bans one of the other’s cards, then you take turns picking five (the middle cards are village loans either side can take), with one more ban each halfway. The glowing card is the Hint; Auto-draft does it all for you.</p>
            <p><b>The counter wheel:</b> builders’ walls stop throwers, scouts lob over builders’ walls, diggers bury scouts in snow, throwers out-range diggers. Medics are neutral and keep everyone up.</p>
            <p><b>The match plays itself.</b> Knock every block out of their fort and their flag falls; at the end of the 90 seconds the fort with more left wins. Every KO knocks a block loose too. Shout once each half from the bench: All attack, Hold the walls or Protect a player. Space speeds up, Skip jumps to the result.</p>
            <p><b>The season:</b> seven league matches, then the top four play semis and a cup final. Morale goes up with wins; some players sulk on the bench. Between seasons players age and grow, a rookie arrives and the rivals sign stars.</p>
            <div className="lg-rowb"><button className="lg-go" onClick={() => setScreen(backRef.current)}>Back</button></div>
          </div>
        </section>
      )}
      {screen === 'settings' && (
        <section className="lg-sheet">
          <div className="lg-paper">
            <h2>Settings</h2>
            <label className="lg-toggle"><input type="checkbox" checked={save.settings.sound} onChange={(e) => { const ss = saveRef.current; ss.settings.sound = e.target.checked; sfx()?.setSound(e.target.checked); persist(ss); }} /> Sound</label>
            <label className="lg-toggle"><input type="checkbox" checked={save.settings.music} onChange={(e) => { const ss = saveRef.current; ss.settings.music = e.target.checked; sfx()?.setMusic(e.target.checked); persist(ss); }} /> Music</label>
            <label className="lg-toggle"><input type="checkbox" checked={save.settings.motion} onChange={(e) => { const ss = saveRef.current; ss.settings.motion = e.target.checked; if (sceneRef.current) sceneRef.current.reduced = !e.target.checked; persist(ss); }} /> Screen shake and flashes</label>
            <label className="lg-toggle"><input type="checkbox" checked={save.settings.hint} onChange={(e) => { const ss = saveRef.current; ss.settings.hint = e.target.checked; persist(ss); }} /> Hints (draft, tactic and shouts)</label>
            <label className="lg-toggle"><input type="checkbox" checked={save.tutorial < 3} onChange={(e) => { const ss = saveRef.current; ss.tutorial = e.target.checked ? 0 : 3; persist(ss); }} /> Enzo’s notes</label>
            <div className="lg-rowb"><button className="lg-go" onClick={() => setScreen(backRef.current)}>Back</button></div>
          </div>
        </section>
      )}
    </main>
  );
}
