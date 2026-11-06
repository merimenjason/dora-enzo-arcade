'use client';
// Rulebook FC: the page. The title, the team sheet before each match (the other captain, how they play and the law
// they bring, read out by the referee), the turn-based match (tap or click one of ours to see where they can go, tap a
// cell to move there; with the ball tap a team-mate to pass, an empty cell further off for a long ball, or their goal
// to shoot, each one previewed first and played with a second tap; when they have it, tap their carrier from beside
// him to tackle; Undo, Hint and End turn, with Enter, Z and H on a keyboard; hovering or holding anyone explains what
// they're about to do), the playback of each turn, Enzo's card table after a match (write one of three laws into the
// rulebook, or strike one of theirs out with Red Pen), the rulebook itself, results and the save. Rules in
// lib/rulebook-game.ts and lib/tactics-football.ts, drawing in lib/rulebook-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/rulebook-game';
import type { LawId, OurId, Run, Save, TheirId } from '@/lib/rulebook-game';
import type { Cell, Ev } from '@/lib/tactics-football';
import type { Overlay, Preview, RulebookScene } from '@/lib/rulebook-scene';
import { RulebookSound, type SongId } from './sound';
import './rulebook.css';

type Screen = 'title' | 'play' | 'rulebook' | 'result' | 'howto' | 'settings';
type Pending = { kind: Preview['kind']; key: string; go: () => boolean; preview: Preview; text: string };
const pic = (n: string) => `/art/rulebook/${n}.png`;
const kick = (n: string) => `/art/kickabout/${n}.png`;
const NAMES: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', pip: 'Pip', bram: 'Bram', keeper: 'Tuft' };
const ANIMAL: Record<string, string> = { rabbit: 'rabbit', frog: 'frog', mole: 'mole', otter: 'otter', hog: 'hedgehog', magpie: 'magpie', fox: 'fox', badger: 'badger', grumble: 'Grumble' };
const DOING: Record<string, string> = {
  press: 'is closing down', mark: 'is marking', lane: 'is standing in the passing lane to', hold: 'is holding their spot', keeper: 'is minding the goal', carry: 'is running with the ball', support: 'is pushing up for a pass',
};
const card = (id: LawId) => { const l = G.lawOf(id); return { ...l, ours: G.isOurs(id), icon: pic(`${G.isOurs(id) ? 'ours' : 'theirs'}-${l.icon}-big`) }; };

export default function RulebookPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RulebookScene | null>(null);
  const soundRef = useRef<RulebookSound | null>(null);
  const runRef = useRef<Run | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const backRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const [, setTick] = useState(0);
  const [sel, setSelState] = useState(-1);
  const selRef = useRef(-1);
  const pendRef = useRef<Pending | null>(null);
  const hintRef = useRef<Cell[]>([]);
  const hoverRef = useRef(-1);
  const [info, setInfo] = useState('');
  const [banner, setBanner] = useState<{ text: string; mood: 'good' | 'bad' | ''; key: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [upright, setUpright] = useState(false);
  const reduced = useRef(false);
  const hold = useRef<number | null>(null);

  const redraw = () => setTick((x) => x + 1);
  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); if (s === 'rulebook' || s === 'howto' || s === 'settings') backRef.current = screenRef.current === 'play' ? 'play' : 'title'; setScreen(s); };
  const shout = useCallback((text: string, mood: 'good' | 'bad' | '' = '') => setBanner({ text, mood, key: Math.random() }), []);
  const select = useCallback((id: number) => { selRef.current = id; setSelState(id); pendRef.current = null; hintRef.current = []; }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new RulebookSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/rulebook-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.RulebookScene(canvasRef.current); sceneRef.current = sc;
      sc.onStep = (e) => onEvent(e);
      void sc.load().then(() => { if (!gone) redraw(); }); setReady(true);
    });
    const vis = () => { if (document.hidden) soundRef.current?.suspend(); else soundRef.current?.resume(); };
    document.addEventListener('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener('visibilitychange', vis); soundRef.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the drawing loop: the scene plays back a turn, then the page catches up
  useEffect(() => {
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      sfx()?.pump();
      const sc = sceneRef.current, r = runRef.current;
      if (!sc || !r || screenRef.current === 'title') return;
      sc.draw(r, { sel: selRef.current, reach: reachOf(), preview: pendRef.current?.preview ?? null, hint: hintRef.current, hover: hoverRef.current, intents: r.phase === 'play' }, t);
      if (busyRef.current && !sc.busy) { busyRef.current = false; setBusy(false); afterPlay(); }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the music
  useEffect(() => {
    const r = runRef.current;
    const song: SongId | null = screen === 'play' ? (r && (r.phase === 'pick' || r.phase === 'redpen' || r.phase === 'law') ? 'cards' : 'match') : screen === 'result' ? (r?.phase === 'won' ? 'ending' : null) : 'title';
    sfx()?.music(song);
  });

  // fit the board: an upright phone turns it so we attack upward, with the bars above and below
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const up = innerHeight > innerWidth * 1.15;
      setUpright(up); sceneRef.current?.setUpright(up);
      const bw = up ? 216 : 384, bh = up ? 384 : 216;
      const aw = innerWidth - 8, ah = innerHeight - (up ? 214 : 128);
      let s = Math.min(aw / bw, ah / bh); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(bw * s)}px`; st.style.height = `${Math.floor(bh * s)}px`; st.parentElement?.style.setProperty('--w', `${Math.max(Math.floor(bw * s), up ? 0 : 560)}px`);
    };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [screen, ready]);

  // ---------------------------------------------------------------- the run
  const reachOf = (): Cell[] => {
    const r = runRef.current, id = selRef.current;
    if (!r || id < 0 || r.phase !== 'play' || sceneRef.current?.busy) return [];
    const u = r.game.unit(id);
    return u && u.team === 0 && r.game.canMove(u) ? r.game.reach(id) : [];
  };
  const startRun = useCallback(() => {
    sfx()?.unlock();
    const r = new G.Run((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    runRef.current = r; select(-1);
    const s = saveRef.current; G.discover(s, r); persist(s);
    setScreen('play'); sfx()?.card(); redraw();
  }, [persist, select, setScreen]);
  const kickoff = () => { const r = runRef.current; if (!r) return; r.ready(); sfx()?.whistle(); setInfo(''); select(-1); redraw(); };

  /** a call into the run, played back by the scene */
  const act = useCallback((fn: () => boolean) => {
    const r = runRef.current, sc = sceneRef.current;
    if (!r || !sc || sc.busy) return false;
    const g = r.game, before = g.s.units.map((u) => ({ id: u.id, c: u.c, r: u.r })), b = g.ballCell(), holder = g.s.ball.holder;
    const ok = fn();
    if (!ok) { sfx()?.no(); return false; }
    const evs = r.game === g ? g.events.slice() : [];
    pendRef.current = null; hintRef.current = [];
    if (evs.length && !(evs.length === 1 && evs[0].k === 'move' && evs[0].holder !== evs[0].id && r.phase === 'play')) {
      sc.play(evs, before, b, holder, reduced.current); busyRef.current = true; setBusy(true);
    } else { for (const e of evs) onEvent(e); afterPlay(); }
    redraw(); return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** after a turn has played out: the next turn, or the end of the match */
  const afterPlay = () => {
    const r = runRef.current; if (!r) return;
    const s = saveRef.current; G.discover(s, r); persist(s);
    if (r.phase === 'won' || r.phase === 'lost') { G.bank(s, r); persist(s); sfx()?.stinger(r.phase === 'won'); setScreen('result'); }
    else if (r.phase === 'pick') { sfx()?.whistle(true); sfx()?.card(); }
    if (selRef.current >= 0) { const u = r.game.unit(selRef.current); if (!u || !r.game.canMove(u) && !r.game.canAct(u)) select(-1); }
    redraw();
  };
  function onEvent(e: Ev) {
    const r = runRef.current, x = sfx(); if (!r) return;
    if (e.k === 'move') x?.tread();
    else if (e.k === 'pass') x?.kick(e.lofted);
    else if (e.k === 'shot') { x?.shot(); if (e.result === 'saved') { x?.save(); setInfo('Saved by the keeper.'); } else if (e.result === 'post') x?.post(); else if (e.result === 'blocked') setInfo('The shot’s blocked.'); }
    else if (e.k === 'tackle' && e.won) { x?.tackle(); setInfo(e.by >= 0 && r.game.unit(e.by)?.team === 0 ? 'Tackled! The ball’s ours.' : 'They’ve tackled us.'); }
    else if (e.k === 'intercept') { x?.steal(); setInfo(r.game.unit(e.by)?.team === 0 ? 'Cut out! The ball’s ours.' : 'They’ve cut the pass out.'); }
    else if (e.k === 'goal') {
      if (e.team === 0) { x?.goal(); shout(`GOAL! ${e.value > 1 ? `Worth ${e.value}` : ''} ${e.notes.join(' · ')}`.trim(), 'good'); }
      else { x?.concede(); shout(`They score${e.value > 1 ? ` (worth ${e.value})` : ''}. ${e.notes.join(' · ')}`.trim(), 'bad'); }
    }
    else if (e.k === 'golden') { x?.whistle(); shout('Level at full time: a golden turn. Next goal wins!'); }
    else if (e.k === 'full') x?.whistle(true);
    else if (e.k === 'whistle') x?.whistle();
  }

  // ---------------------------------------------------------------- the person's turn
  const name = (id: number) => {
    const r = runRef.current!, u = r.game.unit(id);
    if (u.team === 0) return NAMES[u.who] ?? 'Tuft';
    return u.keeper ? 'their keeper' : `the ${ANIMAL[u.who] ?? u.who}`;
  };
  const explain = (id: number) => {
    const r = runRef.current; if (!r || id < 0) return '';
    const g = r.game, u = g.unit(id);
    if (u.team === 0) {
      if (g.s.ball.holder === id && g.canAct(u)) return `${name(id)} has the ball: tap a team-mate to pass, an empty cell 3 to 7 away for a long ball, or their goal to shoot.`;
      return g.canMove(u) ? `${name(id)} can move ${g.rangeOf(u)} cell${g.rangeOf(u) > 1 ? 's' : ''} this turn.` : `${name(id)} has moved this turn.`;
    }
    if (!r.visible(id)) return `${name(id)} is lost in the fog.`;
    const i = g.s.intents.find((t) => t.id === id);
    if (!i) return `${name(id)} stays put.`;
    const tgt = i.target >= 0 && g.unit(i.target) ? ` ${name(i.target)}` : '';
    let t = `${name(id)} ${i.tunnel ? 'tunnels to the end of the dotted arrow' : DOING[i.kind] ?? 'moves'}${i.kind === 'press' || i.kind === 'mark' || i.kind === 'lane' ? tgt : ''}.`;
    if (i.zone.length && i.kind !== 'support') t += ' He’ll tackle anyone in the red cells.';
    if (i.kind === 'support') t += ' We can’t step into the orange cells beside them.';
    if (g.s.ball.holder === id && g.s.bi) {
      const bi = g.s.bi;
      t += bi.k === 'shot' ? ' Then they shoot: block the yellow lines or put Tuft in the way.' : bi.k === 'pass' ? ` Then they pass to ${name(bi.to)}${bi.shoot !== undefined ? ', who shoots' : ''}: stand on the yellow line to cut it out.` : bi.k === 'loft' ? ` Then he hits a long ball to ${name(bi.to)}: stand next to where it lands to win it.` : bi.k === 'dribble' ? ' He dribbles: tackle him from beside him.' : '';
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const guide = () => {
    const r = runRef.current; if (!r || r.phase !== 'play') return '';
    const g = r.game;
    if (g.poss === 1) return 'Their ball: each of ours moves 1 cell. Get in the way of the yellow route, or stand beside their carrier and tap them to tackle. Hover or hold anyone to see what they’ll do.';
    return 'Our ball: tap a player to see where they can go (2 cells). The red cells are where they’ll tackle at End turn. Hover or hold anyone to see what they’ll do.';
  };
  const tap = (cell: Cell) => {
    const r = runRef.current, sc = sceneRef.current; if (!r || !sc || r.phase !== 'play') return;
    if (sc.busy) { sc.skip(); return; }
    sfx()?.unlock();
    const g = r.game, at = g.at(cell.c, cell.r), id = selRef.current, me = id >= 0 ? g.unit(id) : null;
    const confirm = (p: Pending) => {
      if (pendRef.current?.key === p.key) { if (p.preview.ok || p.kind === 'shot') act(p.go); else sfx()?.no(); return; }
      pendRef.current = p; hintRef.current = []; setInfo(p.text); redraw();
    };
    // with the ball: pass, shoot or a long ball
    if (me && g.canAct(me)) {
      if (cell.c === G.COLS) {
        const [lo, hi] = g.mouth(1), row = Math.max(lo - 1, Math.min(hi + 1, cell.r));
        const p = g.shotPreview(id, row), good = p.result === 'goal' || p.result === 'deflected' || p.value > 0;
        const why: Record<string, string> = { goal: 'it goes in', saved: 'the keeper has it covered (the blue cells)', blocked: `it’s blocked by ${p.blocker >= 0 ? name(p.blocker) : 'a defender'}`, post: 'it hits the post', far: 'it’s too far out to beat the keeper', deflected: 'it goes in off a defender' };
        return confirm({ kind: 'shot', key: `s${id}:${row}`, go: () => r.shoot(id, row), preview: { kind: 'shot', ok: good, cells: p.cells, to: { c: G.COLS, r: row }, covered: p.covered }, text: `Shoot: ${why[p.result]}${p.value > 1 ? ` (worth ${p.value}${p.notes.length ? `: ${p.notes.join(', ')}` : ''})` : ''}. Tap the goal again to shoot.` });
      }
      if (at && at.team === 0 && at.id !== id) {
        const p = g.passPreview(id, at.id);
        return confirm({ kind: 'pass', key: `p${id}:${at.id}`, go: () => r.pass(id, at.id), preview: { kind: 'pass', ok: p.ok, cells: p.cells, to: { c: at.c, r: at.r } }, text: p.ok ? `Pass to ${name(at.id)}${p.turnover ? ': a back-pass, and No Back-passes hands them the ball!' : '.'} Tap him again to pass.` : `Pass to ${name(at.id)}: ${p.by >= 0 ? `${name(p.by)} cuts it out` : p.reason}.` });
      }
      if (!at && g.inside(cell.c, cell.r) && !reachOf().some((q) => q.c === cell.c && q.r === cell.r)) {
        const p = g.loftPreview(id, cell.c, cell.r);
        if (p.ok || p.reason) return confirm({ kind: 'loft', key: `l${id}:${cell.c},${cell.r}`, go: () => r.loft(id, cell.c, cell.r), preview: { kind: 'loft', ok: p.ok, cells: [], to: p.land ?? cell }, text: p.ok ? `Long ball${p.catcher >= 0 ? ` to ${name(p.catcher)}` : ''}. Tap again to play it.` : `Long ball: ${p.by >= 0 ? `${name(p.by)} wins it` : p.reason}.` });
      }
    }
    // a tackle
    if (me && at && at.team === 1 && g.s.ball.holder === at.id) {
      const p = g.tacklePreview(id);
      return confirm({ kind: 'tackle', key: `t${id}`, go: () => r.tackle(id), preview: { kind: 'tackle', ok: p.ok, cells: [], to: { c: at.c, r: at.r } }, text: `Tackle: ${p.reason}.${p.ok ? ' Tap him again to go in.' : ''}` });
    }
    // a move
    if (me && reachOf().some((q) => q.c === cell.c && q.r === cell.r)) { act(() => r.move(id, cell.c, cell.r)); setInfo(''); return; }
    if (at) { select(at.id === id ? -1 : at.id); setInfo(at.id === id ? '' : explain(at.id)); sfx()?.button(); redraw(); return; }
    select(-1); setInfo(''); redraw();
  };
  const hint = () => {
    const r = runRef.current; if (!r || r.phase !== 'play' || sceneRef.current?.busy) return;
    const h = r.game.hint(), g = r.game;
    if (!h) { setInfo('Nothing to do with the ball: move into space, or press End turn.'); return; }
    const u = g.unit(h.id); select(h.id);
    if (h.k === 'shoot') { hintRef.current = [{ c: u.c, r: u.r }, { c: G.COLS, r: h.row }]; setInfo(`Hint: ${name(h.id)} can score. Tap the glowing goal cell.`); }
    else if (h.k === 'pass') { const q = g.unit(h.to); hintRef.current = [{ c: u.c, r: u.r }, { c: q.c, r: q.r }]; setInfo(`Hint: a safe pass from ${name(h.id)} to ${name(h.to)}.`); }
    else if (h.k === 'move') { hintRef.current = [{ c: u.c, r: u.r }, { c: h.c, r: h.r }]; setInfo(`Hint: move ${name(h.id)} to the glowing cell.`); }
    else { const c = g.carrier!; hintRef.current = [{ c: u.c, r: u.r }, { c: c.c, r: c.r }]; setInfo(`Hint: ${name(h.id)} can tackle them now.`); }
    sfx()?.button(); redraw();
  };
  const undo = () => { const r = runRef.current; if (r && !sceneRef.current?.busy && r.undo()) { pendRef.current = null; hintRef.current = []; sfx()?.button(); setInfo(''); redraw(); } };
  const endTurn = () => { const r = runRef.current; if (!r || r.phase !== 'play') return; if (sceneRef.current?.busy) { sceneRef.current.skip(); return; } select(-1); setInfo(''); act(() => r.endTurn()); };
  const pick = (id?: OurId) => { const r = runRef.current; if (!r) return; if (r.pick(id)) { if (id === 'redpen') sfx()?.strike(); else if (id) sfx()?.write(); else sfx()?.button(); afterPlay(); select(-1); setInfo(''); } };
  const strike = (id: TheirId) => { const r = runRef.current; if (r?.strike(id)) { sfx()?.strike(); afterPlay(); select(-1); } };

  // the pointer: a tap or click acts; hovering (or holding on a phone) explains
  const cellAt = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current, sc = sceneRef.current; if (!cv || !sc) return null;
    const b = cv.getBoundingClientRect();
    return sc.toCell(((e.clientX - b.left) * cv.width) / b.width, ((e.clientY - b.top) * cv.height) / b.height);
  };
  const onDown = (e: React.PointerEvent) => {
    const c = cellAt(e); if (!c) return;
    if (e.pointerType !== 'mouse') hold.current = window.setTimeout(() => { hold.current = -1; const u = runRef.current?.game.at(c.c, c.r); if (u) { hoverRef.current = u.id; setInfo(explain(u.id)); } }, 450);
  };
  const onUp = (e: React.PointerEvent) => {
    if (hold.current === -1) { hold.current = null; hoverRef.current = -1; return; }
    if (hold.current) clearTimeout(hold.current); hold.current = null;
    const c = cellAt(e); if (c) tap(c);
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const c = cellAt(e), u = c ? runRef.current?.game.at(c.c, c.r) : null, id = u ? u.id : -1;
    if (id !== hoverRef.current) { hoverRef.current = id; if (!pendRef.current) setInfo(id >= 0 ? explain(id) : selRef.current >= 0 ? explain(selRef.current) : ''); }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const r = runRef.current;
      if (screenRef.current !== 'play' || !r) { if (e.key === 'Escape' && screenRef.current !== 'title') setScreen(backRef.current); return; }
      if (e.key === 'r' || e.key === 'R') { go('rulebook'); return; }
      if (r.phase === 'law' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); kickoff(); return; }
      if (r.phase === 'pick') { const n = Number(e.key); if (n >= 1 && n <= r.offer.length) pick(r.offer[n - 1]); else if (!r.offer.length && e.key === 'Enter') pick(); return; }
      if (r.phase !== 'play') return;
      if (e.key === 'Enter') { e.preventDefault(); endTurn(); }
      else if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') undo();
      else if (e.key === 'h' || e.key === 'H') hint();
      else if (e.key === 'Escape') { select(-1); setInfo(''); }
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  });

  // the debug hook for the browser tests
  useEffect(() => {
    (window as unknown as { __rulebook: () => unknown }).__rulebook = () => {
      const r = runRef.current;
      return {
        screen: screenRef.current, save: saveRef.current, sel: selRef.current, busy: busyRef.current, info,
        run: r && { phase: r.phase, match: r.match, strikes: r.strikes, offer: r.offer.slice(), book: JSON.parse(JSON.stringify(r.book)), turn: r.game.s.turn, score: r.game.s.score.slice(), poss: r.game.poss, units: r.game.s.units.map((u) => ({ id: u.id, team: u.team, c: u.c, r: u.r, moved: u.moved })), holder: r.game.s.ball.holder },
        debug: {
          start: (seed: number) => { const n = new G.Run(seed); runRef.current = n; G.discover(saveRef.current, n); setScreen('play'); redraw(); },
          finish: (us: number, them: number) => { const x = runRef.current; if (!x || x.phase !== 'play') return false; x.game.s.score = [us, them]; x.game.s.over = true; x.endMatch(); afterPlay(); return true; },
          screenOf: (c: number, r2: number) => { const cv = canvasRef.current!, b = cv.getBoundingClientRect(), p = sceneRef.current!.screenOf(c, r2); return { x: b.left + (p.x * b.width) / cv.width, y: b.top + (p.y * b.height) / cv.height }; },
          reach: (id: number) => runRef.current?.game.reach(id).map((q) => ({ c: q.c, r: q.r })) ?? [],
          skip: () => sceneRef.current?.skip(),
        },
      };
    };
  });

  // ---------------------------------------------------------------- the screens
  const r = runRef.current, g = r?.game, foe = r?.foe;
  const lawCard = (id: LawId, extra?: { onClick?: () => void; n?: number; struck?: boolean }) => {
    const l = card(id), links = G.linksOf(id).filter(([a, b]) => r && r.has(a === id ? b : a));
    const Tag = extra?.onClick ? 'button' : 'div';
    return (
      <Tag key={id} className={`rb-law ${l.ours ? 'rb-gold' : 'rb-purple'}${extra?.struck ? ' rb-struck' : ''}`} onClick={extra?.onClick} data-law={id}>
        {extra?.n ? <kbd className="rb-n">{extra.n}</kbd> : null}
        <img src={l.icon} alt="" className="rb-icon" />
        <h3>{l.name}</h3>
        <p>{l.text}</p>
        {links.map(([, , t]) => <p key={t} className="rb-link">🔗 {t}</p>)}
      </Tag>
    );
  };
  const panel = () => {
    if (!r || !g || !foe || busy) return null;
    if (r.phase === 'law') {
      const law = r.law;
      return (
        <div className="rb-over"><div className="rb-panel rb-sheet">
          <p className="rb-small">Match {r.match + 1} of {G.MATCHES}{r.match === G.MATCHES - 1 ? ' · the rematch' : ''} · {r.results.filter((x) => x === 'won').length} won · strikes {r.strikes} of {G.STRIKES}</p>
          <div className="rb-captain">
            <img src={kick(`${foe.sprite}-big`)} alt={`${foe.name} captain`} className="rb-big" />
            <div><h2 style={{ color: foe.kit === '#24345a' ? '#8aa8ff' : foe.kit }}>{foe.name}</h2><p>{foe.style}</p></div>
          </div>
          {law && (
            <div className="rb-ref">
              <img src={pic('ref')} alt="The referee" className="rb-refpic" />
              <div><p className="rb-small">The referee reads out their law. It stays in the rulebook for the rest of the season:</p>{lawCard(law)}</div>
            </div>
          )}
          <div className="rb-row"><button className="rb-go" onClick={kickoff} autoFocus>Kick off</button><button onClick={() => go('rulebook')}>Rulebook ({r.book.ours.length + r.book.theirs.length})</button></div>
        </div></div>
      );
    }
    if (r.phase === 'pick') {
      const res = r.last, [a, b] = g.s.score;
      return (
        <div className="rb-over"><div className="rb-panel rb-pick">
          <h2>{res === 'won' ? 'Won' : res === 'drawn' ? 'Drawn' : 'Lost'} {a}–{b} against {foe.name}</h2>
          <div className="rb-enzo">
            <img src={pic('enzo-card')} alt="Enzo" className="rb-enzopic" />
            <p>{res === 'lost' ? `That’s a strike: ${r.strikes} of ${G.STRIKES}. No new law this time, but we go again!` : `${res === 'won' ? 'A win! Pick one of three laws' : 'A draw: pick one of two laws'} to write into our rulebook. It counts for the rest of the season.`}</p>
          </div>
          <div className="rb-cards">{r.offer.map((id, i) => lawCard(id, { onClick: () => pick(id), n: i + 1 }))}</div>
          <div className="rb-row">{!r.offer.length && <button className="rb-go" onClick={() => pick()} autoFocus>Next match</button>}<button onClick={() => go('rulebook')}>Rulebook</button></div>
        </div></div>
      );
    }
    if (r.phase === 'redpen') {
      return (
        <div className="rb-over"><div className="rb-panel rb-pick">
          <h2>Red Pen: strike out one of their laws</h2>
          <div className="rb-cards">{r.book.theirs.map((id) => lawCard(id, { onClick: () => strike(id) }))}</div>
        </div></div>
      );
    }
    return null;
  };

  const s0 = g?.s;
  return (
    <main className={`rb-shell rb-on-${screen}${upright ? ' rb-upright' : ''}`} data-ready={ready ? 'true' : 'false'}>
      <div className="rb-game">
        <header className="rb-top">
          {s0 && foe && (<>
            <span className="rb-score"><b>{s0.score[0]}</b><i>–</i><b>{s0.score[1]}</b><span className="rb-foe">{foe.name}</span></span>
            <span className="rb-clock">{s0.golden ? 'Golden turn' : `Turn ${Math.min(s0.turn + 1, s0.maxTurns)} of ${s0.maxTurns}`}</span>
            <span className="rb-match">Match {r!.match + 1}/{G.MATCHES} · ✗{r!.strikes}</span>
          </>)}
          {banner && <span key={banner.key} className={`rb-banner rb-${banner.mood || 'note'}`} onAnimationEnd={() => setBanner(null)}>{banner.text}</span>}
        </header>
        <div className="rb-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="rb-canvas" onPointerDown={onDown} onPointerUp={onUp} onPointerMove={onMove} onPointerLeave={() => { hoverRef.current = -1; }} onContextMenu={(e) => e.preventDefault()} aria-label="The pitch" />
        </div>
        <footer className="rb-bottom">
          <p className="rb-info" aria-live="polite">{busy ? 'Tap the pitch to skip.' : info || guide()}</p>
          <div className="rb-buttons">
            <button onClick={undo} disabled={!g?.canUndo || busy || r?.phase !== 'play'} title="Undo (Z)">Undo</button>
            <button onClick={hint} disabled={busy || r?.phase !== 'play'} title="Hint (H)">Hint</button>
            <button onClick={() => go('rulebook')} title="The rulebook (R)">📜</button>
            <button className="rb-go" onClick={endTurn} disabled={r?.phase !== 'play'} title="End turn (Enter)">{busy ? 'Skip' : 'End turn'}</button>
          </div>
        </footer>
        {screen === 'play' && panel()}
      </div>

      {screen === 'title' && (
        <section className="rb-title">
          <img src={pic('title')} alt="" className="rb-titlepic" />
          <div className="rb-menu">
            <h1>Rulebook<span>FC</span></h1>
            <p className="rb-tag">Turn-based football where you rewrite the laws of the game.</p>
            <button className="rb-go" onClick={() => { if (!saveRef.current.intro) go('howto'); else startRun(); }} autoFocus>Kick off</button>
            <button onClick={() => go('rulebook')}>Rulebook</button>
            <button onClick={() => go('howto')}>How to play</button>
            <button onClick={() => go('settings')}>Settings</button>
            <p className="rb-small">Best: match {save.best.match} · seasons won {save.stats.seasons}</p>
            <a className="rb-home" href="/">← Arcade</a>
          </div>
        </section>
      )}

      {screen === 'rulebook' && (
        <section className="rb-page">
          <div className="rb-panel rb-book">
            <h2>The rulebook</h2>
            {r && r.phase !== 'won' && r.phase !== 'lost' ? (<>
              <p className="rb-small">Our laws (gold) and theirs (purple), for the rest of this season.</p>
              <div className="rb-cards">{[...r.book.ours, ...r.book.theirs].map((id) => lawCard(id))}{r.book.struck.map((id) => lawCard(id, { struck: true }))}</div>
              {!r.book.ours.length && !r.book.theirs.length && <p>Nothing written yet.</p>}
            </>) : (<>
              <p className="rb-small">Every law you’ve met: {save.seen.length} of {G.ALL_LAWS.length}.</p>
              <div className="rb-cards">{G.ALL_LAWS.map((id) => save.seen.includes(id) ? lawCard(id) : <div key={id} className={`rb-law rb-back ${G.isOurs(id) ? 'rb-gold' : 'rb-purple'}`}><img src={pic(G.isOurs(id) ? 'theirs-o-big' : 'theirs-p-big')} alt="" className="rb-icon" /><h3>?</h3></div>)}</div>
            </>)}
            <div className="rb-row"><button className="rb-go" onClick={() => setScreen(backRef.current)} autoFocus>Back</button></div>
          </div>
        </section>
      )}

      {screen === 'howto' && (
        <section className="rb-page">
          <div className="rb-panel rb-text">
            <h2>How to play</h2>
            <p>Ten matches against the animal league, and the Grumbles at the end. Each match is {g?.s.maxTurns ?? 16} turns on a 15 by 9 pitch.</p>
            <p><b>Their next move is always showing.</b> Red arrows show where each of them will go, red cells are where they’ll tackle, yellow lines are where their ball will go. Hover or hold anyone to have it explained.</p>
            <p><b>Our ball:</b> tap a player, then a cell to move them (2 cells). With the ball, tap a team-mate to pass, an empty cell 3 to 7 away for a long ball, or their goal to shoot. Each one shows first (green works, red doesn’t); tap again to play it. Four passes a turn.</p>
            <p><b>Their ball:</b> we move 1 cell. Stand on their yellow line to cut it out, or stand beside the carrier and tap them to tackle.</p>
            <p>Undo anything until you press <b>End turn</b> (Enter). <b>Hint</b> (H) shows a good move.</p>
            <p><b>The rulebook:</b> win and Enzo lets you write one of three new laws of football into it; draw and you choose from two. Every team brings a law of its own, and that stays too. Three defeats end the season.</p>
            <div className="rb-row"><button className="rb-go" autoFocus onClick={() => { if (!saveRef.current.intro) { const s = saveRef.current; s.intro = true; persist(s); startRun(); } else setScreen(backRef.current); }}>{save.intro ? 'Back' : 'Let’s go'}</button></div>
          </div>
        </section>
      )}

      {screen === 'settings' && (
        <section className="rb-page">
          <div className="rb-panel rb-text">
            <h2>Settings</h2>
            <label className="rb-toggle"><input type="checkbox" checked={save.settings.sound} onChange={(e) => { const s = saveRef.current; s.settings.sound = e.target.checked; sfx()?.setSound(e.target.checked); persist(s); }} /> Sound</label>
            <label className="rb-toggle"><input type="checkbox" checked={save.settings.music} onChange={(e) => { const s = saveRef.current; s.settings.music = e.target.checked; sfx()?.setMusic(e.target.checked); persist(s); }} /> Music</label>
            <div className="rb-row"><button className="rb-go" onClick={() => setScreen(backRef.current)} autoFocus>Back</button></div>
          </div>
        </section>
      )}

      {screen === 'result' && r && (
        <section className="rb-page rb-result">
          {r.phase === 'won' && <img src={pic('ending')} alt="" className="rb-endpic" />}
          <div className="rb-panel rb-text">
            <h2>{r.phase === 'won' ? 'Season complete!' : 'Three strikes: the season’s over'}</h2>
            <p>{r.stats.won} won, {r.stats.drawn} drawn, {r.stats.lost} lost from {r.stats.played} matches. {r.stats.goals} goals for, {r.stats.conceded} against{r.stats.best > 1 ? `, and the best goal was worth ${r.stats.best}` : ''}.</p>
            <p className="rb-small">Laws in the book: {r.book.ours.map((id) => G.lawOf(id).name).join(', ') || 'none of ours'}.</p>
            <div className="rb-row"><button className="rb-go" onClick={startRun} autoFocus>Play again</button><button onClick={() => setScreen('title')}>Title</button></div>
          </div>
        </section>
      )}
    </main>
  );
}
