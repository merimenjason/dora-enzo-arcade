'use client';
// Combo Ball: the page. The title, the team sheet before each match (their captain, how they play, the target and the
// turns), the turn-based match (tap or click one of ours to see where they can go, tap a cell to move there; with the
// ball tap a team-mate to pass, an empty cell further off for a long ball, or their goal to shoot, each one previewed
// first and played with a second tap; when they have it, tap their carrier from beside them to tackle; Undo, Hint and
// End turn, with Enter, Z and H on a keyboard; hovering or holding anyone explains what they're about to do), the
// chain's chips × mult in the bar above the pitch with a pop-up for every pass, the playback of each turn, the transfer
// shop after a target is reached, results and the save. Rules in lib/combo-game.ts and lib/tactics-football.ts,
// drawing in lib/combo-scene.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as G from '@/lib/combo-game';
import type { Run, Save, TraitId } from '@/lib/combo-game';
import type { Cell, Ev } from '@/lib/tactics-football';
import type { ComboScene, Overlay, Preview } from '@/lib/combo-scene';
import { ComboSound, type SongId } from './sound';
import './combo.css';

type Screen = 'title' | 'play' | 'result' | 'howto' | 'settings';
type Pending = { kind: Preview['kind']; key: string; go: () => boolean; preview: Preview; text: string };
const pic = (n: string) => `/art/combo/${n}.png`;
const kick = (n: string) => `/art/kickabout/${n}.png`;
const NAMES: Record<string, string> = { dora: 'Dora', enzo: 'Enzo', pip: 'Pip', keeper: 'Tuft' };
const ANIMAL: Record<string, string> = { rabbit: 'rabbit', frog: 'frog', mole: 'mole', otter: 'otter', hog: 'hedgehog', magpie: 'magpie', fox: 'fox', badger: 'badger', grumble: 'Grumble' };
const DOING: Record<string, string> = {
  press: 'is closing down', mark: 'is marking', lane: 'is standing in the passing lane to', hold: 'is holding their spot', keeper: 'is minding the goal', carry: 'is running with the ball', support: 'is pushing up for a pass',
};

export default function ComboPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ComboScene | null>(null);
  const soundRef = useRef<ComboSound | null>(null);
  const runRef = useRef<Run | null>(null);
  const [ready, setReady] = useState(false);
  const [screen, setScreenState] = useState<Screen>('title');
  const screenRef = useRef<Screen>('title');
  const backRef = useRef<Screen>('title');
  const [save, setSave] = useState<Save>(G.newSave);
  const saveRef = useRef<Save>(save);
  const [, setTick] = useState(0);
  const [, setSelState] = useState(-1);
  const selRef = useRef(-1);
  const pendRef = useRef<Pending | null>(null);
  const hintRef = useRef<Cell[]>([]);
  const hoverRef = useRef(-1);
  const [info, setInfo] = useState('');
  const [banner, setBanner] = useState<{ text: string; sub?: string; mood: 'good' | 'bad' | ''; key: number } | null>(null);
  const [pop, setPop] = useState<{ text: string; bad?: boolean; key: number } | null>(null);
  const [replacing, setReplacing] = useState<TraitId | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [upright, setUpright] = useState(false);
  const reduced = useRef(false);
  const hold = useRef<number | null>(null);

  const redraw = () => setTick((x) => x + 1);
  const sfx = () => soundRef.current;
  const setScreen = useCallback((s: Screen) => { screenRef.current = s; setScreenState(s); }, []);
  const persist = useCallback((s: Save) => { saveRef.current = s; setSave({ ...s }); try { localStorage.setItem(G.SAVE_KEY, G.serialise(s)); } catch {} }, []);
  const go = (s: Screen) => { sfx()?.unlock(); sfx()?.button(); if (s === 'howto' || s === 'settings') backRef.current = screenRef.current === 'play' ? 'play' : 'title'; setScreen(s); };
  const shout = useCallback((text: string, mood: 'good' | 'bad' | '' = '', sub?: string) => setBanner({ text, sub, mood, key: Math.random() }), []);
  const select = useCallback((id: number) => { selRef.current = id; setSelState(id); pendRef.current = null; hintRef.current = []; }, []);

  // ---------------------------------------------------------------- set-up
  useEffect(() => {
    let s = G.newSave();
    try { s = G.parseSave(localStorage.getItem(G.SAVE_KEY)); } catch {}
    saveRef.current = s; setSave(s);
    reduced.current = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    soundRef.current = new ComboSound(s.settings.sound, s.settings.music);
    let gone = false;
    void import('@/lib/combo-scene').then((m) => {
      if (gone || !canvasRef.current) return;
      const sc = new m.ComboScene(canvasRef.current); sceneRef.current = sc;
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
    const r = runRef.current, s = r?.game.s;
    const song: SongId | null = screen === 'play' ? (r?.phase === 'shop' ? 'shop' : s && s.turn >= s.maxTurns - 3 ? 'late' : 'match') : screen === 'result' ? (r?.phase === 'won' ? 'ending' : null) : 'title';
    sfx()?.music(song);
  });

  // fit the board: an upright phone turns it so we attack upward, with the bars above and below
  useEffect(() => {
    const fit = () => {
      const st = stageRef.current; if (!st) return;
      const up = innerHeight > innerWidth * 1.15;
      setUpright(up); sceneRef.current?.setUpright(up);
      const bw = up ? 256 : 384, bh = up ? 384 : 256;
      const aw = innerWidth - 8, ah = innerHeight - (up ? 236 : 176);
      let s = Math.min(aw / bw, ah / bh); if (s >= 2 && Math.floor(s) / s > 0.85) s = Math.floor(s);
      st.style.width = `${Math.floor(bw * s)}px`; st.style.height = `${Math.floor(bh * s)}px`; st.parentElement?.style.setProperty('--w', `${Math.max(Math.floor(bw * s), up ? 0 : 600)}px`);
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
  const begin = useCallback((r: Run) => { runRef.current = r; select(-1); setReplacing(null); setPop(null); setInfo(''); setScreen('play'); redraw(); }, [select, setScreen]);
  const startRun = useCallback(() => { sfx()?.unlock(); sfx()?.pick(); begin(new G.Run((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)); }, [begin]);
  const kickoff = () => { const r = runRef.current; if (!r) return; r.ready(); sfx()?.whistle(); setInfo(''); select(-1); redraw(); };

  /** a call into the run, played back by the scene; the chain's pop-up comes from what it gained (or lost) */
  const act = useCallback((fn: () => boolean) => {
    const r = runRef.current, sc = sceneRef.current;
    if (!r || !sc || sc.busy) return false;
    const g = r.game, before = g.s.units.map((u) => ({ id: u.id, c: u.c, r: u.r })), b = g.ballCell(), holder = g.s.ball.holder;
    const was = r.chain, goals = g.s.goals[0];
    const ok = fn();
    if (!ok) { sfx()?.no(); return false; }
    const now = r.game === g ? r.chain : was, scored = g.s.goals[0] > goals;
    if (!scored && now.gains.length > was.gains.length) {
      const gain = now.gains[now.gains.length - 1], bits = [gain.chips ? `+${gain.chips} chips` : '', gain.mult ? `+${gain.mult} mult` : ''].filter(Boolean);
      setPop({ text: `${gain.text === 'PASS' || gain.text === 'BONUS' ? '' : `${gain.text} `}${bits.join(' ')}`.trim(), key: Math.random() });
      sfx()?.gain(now.passes, (gain.mult ?? 0) > 0);
    } else if (!scored && was.passes > 0 && now.passes === 0) { setPop({ text: 'Chain wiped!', bad: true, key: Math.random() }); sfx()?.wipe(); }
    const evs = r.game === g ? g.events.slice() : [];
    pendRef.current = null; hintRef.current = [];
    if (evs.length && !(evs.length === 1 && evs[0].k === 'move' && evs[0].holder !== evs[0].id && r.phase === 'play')) {
      sc.play(evs, before, b, holder, reduced.current); busyRef.current = true; setBusy(true);
    } else { for (const e of evs) onEvent(e); afterPlay(); }
    redraw(); return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** after a turn has played out: the next turn, the shop, or the end of the run */
  const afterPlay = () => {
    const r = runRef.current; if (!r) return;
    if (r.phase === 'won' || r.phase === 'lost') { const s = saveRef.current; G.bank(s, r); persist(s); sfx()?.stinger(r.phase === 'won'); setScreen('result'); }
    else if (r.phase === 'shop') { sfx()?.whistle(true); sfx()?.target(); }
    if (selRef.current >= 0 && r.phase === 'play') { const u = r.game.unit(selRef.current); if (!u || !r.game.canMove(u) && !r.game.canAct(u)) select(-1); }
    redraw();
  };
  function onEvent(e: Ev) {
    const r = runRef.current, x = sfx(); if (!r) return;
    if (e.k === 'move') x?.tread();
    else if (e.k === 'pass') x?.kick(e.lofted);
    else if (e.k === 'shot') { x?.shot(1); if (e.result === 'saved') { x?.save(); setInfo(r.has('ricochet') && e.holder >= 0 && r.game.unit(e.holder)?.team === 0 ? 'Saved, but it ricochets back to us: the chain lives on, +10 chips!' : 'Saved by the keeper.'); } else if (e.result === 'post') x?.post(); else if (e.result === 'blocked') setInfo('The shot’s blocked.'); }
    else if (e.k === 'tackle' && e.won) { x?.tackle(); setInfo(e.by >= 0 && r.game.unit(e.by)?.team === 0 ? 'Tackled! The ball’s ours.' : 'They’ve tackled us.'); }
    else if (e.k === 'intercept') { x?.steal(); setInfo(r.game.unit(e.by)?.team === 0 ? 'Cut out! The ball’s ours.' : 'They’ve cut the pass out.'); }
    else if (e.k === 'goal') {
      if (e.team === 0) { x?.goal(); shout(`GOAL! +${e.value}`, 'good', e.notes.join(' · ')); }
      else { x?.concede(); shout('They score.', 'bad', `The target goes up to ${r.target}.`); }
    }
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
      if (g.s.ball.holder === id && g.canAct(u)) return `${name(id)} has the ball: tap a team-mate to pass, an empty cell 3 to 7 away for a long ball, or their goal to shoot.${u.got !== '' && !u.started ? ' Pass it on first time for +1 mult!' : ''}`;
      return g.canMove(u) ? `${name(id)} can move ${g.rangeOf(u)} cell${g.rangeOf(u) > 1 ? 's' : ''} this turn.` : `${name(id)} has moved this turn.`;
    }
    const i = g.s.intents.find((t) => t.id === id);
    if (!i) return `${name(id)} stays put.`;
    const tgt = i.target >= 0 && g.unit(i.target) ? ` ${name(i.target)}` : '';
    let t = `${name(id)} ${i.tunnel ? 'tunnels to the end of the dotted arrow' : DOING[i.kind] ?? 'moves'}${i.kind === 'press' || i.kind === 'mark' || i.kind === 'lane' ? tgt : ''}.`;
    if (i.zone.length && i.kind !== 'support') t += ' They’ll tackle anyone in the red cells.';
    if (i.kind === 'support') t += ' We can’t step into the orange cells beside them.';
    if (g.s.ball.holder === id && g.s.bi) {
      const bi = g.s.bi;
      t += bi.k === 'shot' ? ' Then they shoot: block the yellow lines or put Tuft in the way.' : bi.k === 'pass' ? ` Then they pass to ${name(bi.to)}${bi.shoot !== undefined ? ', who shoots' : ''}: stand on the yellow line to cut it out.` : bi.k === 'loft' ? ` Then a long ball to ${name(bi.to)}: stand next to where it lands to win it.` : bi.k === 'dribble' ? ' They dribble: tackle them from beside them.' : '';
    }
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const guide = () => {
    const r = runRef.current; if (!r || r.phase !== 'play') return '';
    const g = r.game;
    if (g.poss === 1) return 'Their ball: each of ours moves 1 cell. Get in the way of the yellow route, or stand beside their carrier and tap them to tackle.';
    if (r.chain.passes === 0) return 'Our ball: every pass adds chips, and a first-time pass adds mult. Build a chain, then shoot: the goal is worth chips × mult.';
    return `Chain of ${r.chain.passes}: keep it going or cash it in with a shot. If they touch the ball, the chain’s gone.`;
  };
  const tap = (cell: Cell) => {
    const r = runRef.current, sc = sceneRef.current; if (!r || !sc || r.phase !== 'play') return;
    if (sc.busy) { sc.skip(); return; }
    sfx()?.unlock();
    const g = r.game, at = g.at(cell.c, cell.r), id = selRef.current, me = id >= 0 ? g.unit(id) : null;
    const confirm = (p: Pending) => {
      if (pendRef.current?.key === p.key) { if (p.preview.ok || p.kind === 'shot') { if (act(p.go)) setInfo(''); } else sfx()?.no(); return; }
      pendRef.current = p; hintRef.current = []; setInfo(p.text); redraw();
    };
    // with the ball: pass, shoot or a long ball
    if (me && g.canAct(me)) {
      if (cell.c === G.COLS) {
        const [lo, hi] = g.mouth(1), row = Math.max(lo - 1, Math.min(hi + 1, cell.r));
        const p = g.shotPreview(id, row), good = p.result === 'goal' || p.result === 'deflected';
        const why: Record<string, string> = { goal: 'it goes in', saved: 'the keeper has it covered (the blue cells)', blocked: `it’s blocked by ${p.blocker >= 0 ? name(p.blocker) : 'a defender'}`, post: 'it hits the post', far: 'it’s too far out to beat the keeper', deflected: 'it goes in off a defender' };
        return confirm({ kind: 'shot', key: `s${id}:${row}`, go: () => r.shoot(id, row), preview: { kind: 'shot', ok: good, cells: p.cells, to: { c: G.COLS, r: row }, covered: p.covered }, text: `Shoot: ${why[p.result]}${good ? `, worth ${p.value} (${p.notes.join(', ')})` : ''}. Tap the goal again to shoot.` });
      }
      if (at && at.team === 0 && at.id !== id) {
        const p = g.passPreview(id, at.id), last = g.s.chain[g.s.chain.length - 1];
        const pong = last && last.team === 0 && last.to === id && last.from === at.id;
        return confirm({ kind: 'pass', key: `p${id}:${at.id}`, go: () => r.pass(id, at.id), preview: { kind: 'pass', ok: p.ok, cells: p.cells, to: { c: at.c, r: at.r } }, text: p.ok ? `Pass to ${name(at.id)}${pong ? ': straight back, so it adds nothing to the chain' : ''}. Tap them again to pass.` : `Pass to ${name(at.id)}: ${p.by >= 0 ? `${name(p.by)} cuts it out, and the chain’s gone` : p.reason}.` });
      }
      if (!at && g.inside(cell.c, cell.r) && !reachOf().some((q) => q.c === cell.c && q.r === cell.r)) {
        const p = g.loftPreview(id, cell.c, cell.r);
        if (p.ok || p.reason) return confirm({ kind: 'loft', key: `l${id}:${cell.c},${cell.r}`, go: () => r.loft(id, cell.c, cell.r), preview: { kind: 'loft', ok: p.ok, cells: [], to: p.land ?? cell }, text: p.ok ? `Long ball${p.catcher >= 0 ? ` to ${name(p.catcher)}` : ''} (+5 chips for a lofted pass). Tap again to play it.` : `Long ball: ${p.by >= 0 ? `${name(p.by)} wins it` : p.reason}.` });
      }
    }
    // a tackle
    if (me && at && at.team === 1 && g.s.ball.holder === at.id) {
      const p = g.tacklePreview(id);
      return confirm({ kind: 'tackle', key: `t${id}`, go: () => r.tackle(id), preview: { kind: 'tackle', ok: p.ok, cells: [], to: { c: at.c, r: at.r } }, text: `Tackle: ${p.reason}.${p.ok ? ' Tap them again to go in.' : ''}` });
    }
    // a move
    if (me && reachOf().some((q) => q.c === cell.c && q.r === cell.r)) { act(() => r.move(id, cell.c, cell.r)); setInfo(''); return; }
    if (at) { select(at.id === id ? -1 : at.id); setInfo(at.id === id ? '' : explain(at.id)); sfx()?.button(); redraw(); return; }
    select(-1); setInfo(''); redraw();
  };
  const hint = () => {
    const r = runRef.current; if (!r || r.phase !== 'play' || sceneRef.current?.busy) return;
    const h = r.hint(), g = r.game;
    if (!h) { setInfo('Nothing more to do with the ball: move into space, or press End turn.'); return; }
    const u = g.unit(h.id); select(h.id);
    if (h.k === 'shoot') { hintRef.current = [{ c: u.c, r: u.r }, { c: G.COLS, r: h.row }]; setInfo(`Hint: ${name(h.id)} can cash the chain in for ${g.shotPreview(h.id, h.row).value}. Tap the glowing goal cell.`); }
    else if (h.k === 'pass') { const q = g.unit(h.to); hintRef.current = [{ c: u.c, r: u.r }, { c: q.c, r: q.r }]; setInfo(`Hint: a safe pass from ${name(h.id)} to ${name(h.to)}.`); }
    else if (h.k === 'move') { hintRef.current = [{ c: u.c, r: u.r }, { c: h.c, r: h.r }]; setInfo(`Hint: move ${name(h.id)} to the glowing cell.`); }
    else { const c = g.carrier!; hintRef.current = [{ c: u.c, r: u.r }, { c: c.c, r: c.r }]; setInfo(`Hint: ${name(h.id)} can tackle them now.`); }
    sfx()?.button(); redraw();
  };
  const undo = () => { const r = runRef.current; if (r && !sceneRef.current?.busy && r.undo()) { pendRef.current = null; hintRef.current = []; setPop(null); sfx()?.button(); setInfo(''); redraw(); } };
  const endTurn = () => { const r = runRef.current; if (!r || r.phase !== 'play') return; if (sceneRef.current?.busy) { sceneRef.current.skip(); return; } select(-1); setInfo(''); act(() => r.endTurn()); };
  const pickTrait = (id?: TraitId, drop?: TraitId) => {
    const r = runRef.current; if (!r || r.phase !== 'shop') return;
    if (id && !drop && r.traits.length >= G.SLOTS) { setReplacing(id); sfx()?.button(); return; }
    if (r.pick(id, drop)) { if (id) sfx()?.pick(); else sfx()?.button(); setReplacing(null); select(-1); setInfo(''); setPop(null); redraw(); }
  };

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
      if (r.phase === 'sheet' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); kickoff(); return; }
      if (r.phase === 'shop') {
        const n = Number(e.key);
        if (replacing) { if (n >= 1 && n <= r.traits.length) pickTrait(replacing, r.traits[n - 1]); else if (e.key === 'Escape') setReplacing(null); }
        else if (n >= 1 && n <= r.offer.length) pickTrait(r.offer[n - 1]);
        return;
      }
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
    (window as unknown as { __combo: () => unknown }).__combo = () => {
      const r = runRef.current;
      return {
        screen: screenRef.current, save: saveRef.current, sel: selRef.current, busy: busyRef.current, info,
        run: r && { phase: r.phase, match: r.match, target: r.target, points: r.points, traits: r.traits.slice(), offer: r.offer.slice(), chain: r.chain, turn: r.game.s.turn, poss: r.game.poss, units: r.game.s.units.map((u) => ({ id: u.id, team: u.team, c: u.c, r: u.r, moved: u.moved, keeper: u.keeper })), holder: r.game.s.ball.holder },
        debug: {
          start: (seed: number) => begin(new G.Run(seed)),
          win: () => { const x = runRef.current; if (!x || x.phase !== 'play') return false; x.game.s.score[0] = x.target; x.endMatch(); afterPlay(); return true; },
          traits: (ids: TraitId[]) => { const x = runRef.current; if (x) { x.traits = ids.slice(); redraw(); } },
          screenOf: (c: number, r2: number) => { const cv = canvasRef.current!, b = cv.getBoundingClientRect(), p = sceneRef.current!.screenOf(c, r2); return { x: b.left + (p.x * b.width) / cv.width, y: b.top + (p.y * b.height) / cv.height }; },
          reach: (id: number) => runRef.current?.game.reach(id).map((q) => ({ c: q.c, r: q.r })) ?? [],
          canPass: (from: number, to: number) => !!runRef.current?.game.passPreview(from, to).ok,
          skip: () => sceneRef.current?.skip(),
        },
      };
    };
  });

  // ---------------------------------------------------------------- the screens
  const r = runRef.current, g = r?.game, foe = r?.foe;
  const traitCard = (id: TraitId, extra?: { onClick?: () => void; n?: number; drop?: boolean }) => {
    const t = G.trait(id), Tag = extra?.onClick ? 'button' : 'div';
    return (
      <Tag key={id} className={`cb-trait${extra?.drop ? ' cb-drop' : ''}`} onClick={extra?.onClick} data-trait={extra?.drop ? undefined : id} data-drop={extra?.drop ? id : undefined}>
        {extra?.n ? <kbd className="cb-n">{extra.n}</kbd> : null}
        <h3>{extra?.drop ? `Drop ${t.name}` : t.name}</h3>
        <p>{t.text}</p>
      </Tag>
    );
  };
  const panel = () => {
    if (!r || !g || !foe || busy) return null;
    if (r.phase === 'sheet') {
      return (
        <div className="cb-over"><div className="cb-panel cb-sheet">
          <p className="cb-small">{r.league.name} · match {r.match + 1} of {G.MATCHES}</p>
          <div className="cb-captain">
            <img src={kick(`${foe.sprite}-big`)} alt={`${foe.name} captain`} className="cb-big" />
            <div><h2 style={{ color: foe.kit === '#24345a' ? '#8aa8ff' : foe.kit }}>{foe.name}</h2><p>{foe.style}</p></div>
          </div>
          <p className="cb-target">Score <b>{r.target}</b> points in <b>{g.s.maxTurns}</b> turns.</p>
          <p className="cb-small">Each goal they score puts the target up by {Math.round(G.TARGETS[r.match] * G.CREEP)}.{r.traits.length ? ` Traits: ${r.traits.map((t) => G.trait(t).name).join(', ')}.` : ''}</p>
          <div className="cb-row"><button className="cb-go" onClick={kickoff} autoFocus>Kick off</button><button onClick={() => go('howto')}>How to play</button></div>
        </div></div>
      );
    }
    if (r.phase === 'shop') {
      const next = G.team(r.match + 1);
      return (
        <div className="cb-over"><div className="cb-panel cb-shop">
          <h2>Target reached! The transfer shop</h2>
          <div className="cb-enzo">
            <img src={kick('enzo-big')} alt="Enzo" className="cb-enzopic" />
            <p>{replacing ? `All ${G.SLOTS} slots are full. Which trait makes way for ${G.trait(replacing).name}?` : `${r.points} points against ${foe.name}. Next: ${next.name}, target ${G.TARGETS[r.match + 1]}. Pick one trait to sign:`}</p>
          </div>
          <div className="cb-cards">{replacing ? r.traits.map((id, i) => traitCard(id, { onClick: () => pickTrait(replacing, id), n: i + 1, drop: true })) : r.offer.map((id, i) => traitCard(id, { onClick: () => pickTrait(id), n: i + 1 }))}</div>
          {r.traits.length > 0 && !replacing && <p className="cb-small">Your traits ({r.traits.length}/{G.SLOTS}): {r.traits.map((t) => G.trait(t).name).join(', ')}</p>}
          <div className="cb-row"><button onClick={() => replacing ? setReplacing(null) : pickTrait(undefined)}>{replacing ? 'Back' : 'Skip'}</button></div>
        </div></div>
      );
    }
    return null;
  };

  const s0 = g?.s, ch = r?.chain, live = !!ch && ch.passes > 0;
  return (
    <main className={`cb-shell cb-on-${screen}${upright ? ' cb-upright' : ''}`} data-ready={ready ? 'true' : 'false'}>
      <div className="cb-game">
        <header className="cb-top">
          {s0 && foe && r && ch && (<>
            <span className="cb-points" title="Points and the target"><b>{r.points}</b><i>/</i><span>{r.target}</span></span>
            <span className="cb-chain" data-on={live ? '1' : '0'} title="The chain: a goal now is worth (10 + chips) × mult">
              <b className="cb-chips">{10 + ch.chips}</b><i>×</i><b className="cb-mult">{ch.mult}</b>
              <span className="cb-worth">= {(10 + ch.chips) * ch.mult}</span>
              <span className="cb-passes">{ch.passes} pass{ch.passes === 1 ? '' : 'es'}{r.pressure ? ` · press +${r.pressure}` : ''}</span>
              {pop && <span key={pop.key} className={`cb-pop${pop.bad ? ' cb-bad' : ''}`} onAnimationEnd={() => setPop(null)}>{pop.text}</span>}
            </span>
            <span className="cb-clock">Turn {Math.min(s0.turn + 1, s0.maxTurns)}/{s0.maxTurns}</span>
          </>)}
          {banner && <span key={banner.key} className={`cb-banner cb-${banner.mood || 'note'}`} onAnimationEnd={() => setBanner(null)}><b>{banner.text}</b>{banner.sub && <small>{banner.sub}</small>}</span>}
        </header>
        <div className="cb-stage" ref={stageRef}>
          <canvas ref={canvasRef} className="cb-canvas" onPointerDown={onDown} onPointerUp={onUp} onPointerMove={onMove} onPointerLeave={() => { hoverRef.current = -1; }} onContextMenu={(e) => e.preventDefault()} aria-label="The pitch" />
        </div>
        <footer className="cb-bottom">
          <p className="cb-info" aria-live="polite">{busy ? 'Tap the pitch to skip.' : info || guide()}</p>
          <div className="cb-buttons">
            <button onClick={undo} disabled={!g?.canUndo || busy || r?.phase !== 'play'} title="Undo (Z)">Undo</button>
            <button onClick={hint} disabled={busy || r?.phase !== 'play'} title="Hint (H)">Hint</button>
            <button className="cb-go" onClick={endTurn} disabled={r?.phase !== 'play'} title="End turn (Enter)">{busy ? 'Skip' : 'End turn'}</button>
          </div>
        </footer>
        {r && r.traits.length > 0 && r.phase === 'play' && <p className="cb-traits">{r.traits.map((t) => <span key={t} title={G.trait(t).text}>{G.trait(t).name}</span>)}</p>}
        {screen === 'play' && panel()}
      </div>

      {screen === 'title' && (
        <section className="cb-title">
          <div className="cb-bg"><img src={pic('title')} alt="Dora volleys a golden ball at goal at the end of a zig-zag of golden passes from Enzo" /></div>
          <div className="cb-title-col">
            <h1 className="cb-logo">Combo Ball</h1>
            <p className="cb-tag">Turn-based football where a goal is worth the passing move that made it: chain passes for chips and mult, then cash the chain in.</p>
            <div className="cb-menu">
              <button className="cb-go" onClick={() => { if (!saveRef.current.intro) go('howto'); else startRun(); }} autoFocus>{save.stats.runs ? 'New run' : 'Kick off'}</button>
              <button onClick={() => go('howto')}>How to play</button>
              <button onClick={() => go('settings')}>Settings</button>
            </div>
            {save.stats.runs > 0 && <p className="cb-small">Best: {save.best.matches} of {G.MATCHES} matches · biggest goal {save.best.goal} · longest chain {save.best.chain}{save.stats.wins ? ` · ${save.stats.wins} ${save.stats.wins === 1 ? 'title' : 'titles'}` : ''}</p>}
            <a className="cb-home" href="/">‹ Arcade</a>
          </div>
        </section>
      )}

      {screen === 'howto' && (
        <section className="cb-page">
          <div className="cb-panel cb-text">
            <h2>How to play</h2>
            <p>Nine matches against the animal league, with the Grumble Galacticos in the final. Each match is {G.TURNS} turns on a 15 by 9 pitch, three-a-side plus keepers, and has a <b>points target</b>: reach it and you’re through, miss it at full time and the run’s over.</p>
            <p><b>A goal is worth (10 + chips) × mult</b> from the passing move that made it. Every completed pass is 10 chips: a long one (5 cells or more) +10, a lofted one +5, a switch across the pitch +10. A <b>first-time pass</b>, played on by someone who got the ball this turn before they move, is +1 mult. Straight back to whoever passed adds nothing. The chain carries over from turn to turn, but the moment they touch the ball it’s gone.</p>
            <p>The longer your chain, the harder they press: one more of them closes down for every {G.PRESSURE} passes. Each goal they score puts your target up.</p>
            <p><b>Our ball:</b> tap a player, then a cell to move them (2 cells). With the ball, tap a team-mate to pass, an empty cell 3 to 7 away for a long ball, or their goal to shoot. Each one shows first (green works, red doesn’t); tap again to play it. Four passes a turn.</p>
            <p><b>Their ball:</b> we move 1 cell. Their next move is always showing: red arrows and red tackle cells, yellow lines for the ball. Stand on a yellow line to cut it out, or beside their carrier to tackle.</p>
            <p>Undo anything until you press <b>End turn</b> (Enter). <b>Hint</b> (H) shows a good move.</p>
            <p><b>The transfer shop:</b> after each target, sign one of three traits that bend the scoring. Five slots.</p>
            <div className="cb-row"><button className="cb-go" autoFocus onClick={() => { if (!saveRef.current.intro) { const s = saveRef.current; s.intro = true; persist(s); startRun(); } else setScreen(backRef.current); }}>{save.intro ? 'Back' : 'Let’s go'}</button></div>
          </div>
        </section>
      )}

      {screen === 'settings' && (
        <section className="cb-page">
          <div className="cb-panel cb-text">
            <h2>Settings</h2>
            <label className="cb-toggle"><input type="checkbox" checked={save.settings.sound} onChange={(e) => { const s = saveRef.current; s.settings.sound = e.target.checked; sfx()?.setSound(e.target.checked); persist(s); }} /> Sound</label>
            <label className="cb-toggle"><input type="checkbox" checked={save.settings.music} onChange={(e) => { const s = saveRef.current; s.settings.music = e.target.checked; sfx()?.setMusic(e.target.checked); persist(s); }} /> Music</label>
            <div className="cb-row"><button className="cb-go" onClick={() => setScreen(backRef.current)} autoFocus>Back</button></div>
          </div>
        </section>
      )}

      {screen === 'result' && r && (
        <section className="cb-page cb-result">
          {r.phase === 'won' && <img src={pic('ending')} alt="Dora and Enzo lift a golden trophy together at sunset while coins and confetti rain down" className="cb-endpic" />}
          <div className="cb-panel cb-text">
            <h2>{r.phase === 'won' ? 'Champions of the Summit League!' : 'Full time: the target got away'}</h2>
            <p>{r.phase === 'won' ? 'Nine matches, nine targets. The Grumbles shake paws, grudgingly, and Pip wants to know when the next season starts.' : `${r.points} of ${r.target} points against ${r.foe.name}. Dora, Enzo and Pip won ${r.stats.won} of ${G.MATCHES} matches.`}</p>
            <ul className="cb-stats">
              <li><b>{r.stats.won}</b><span>matches won</span></li><li><b>{r.stats.goals}</b><span>goals</span></li><li><b>{r.stats.best}</b><span>biggest goal</span></li><li><b>{r.stats.longest}</b><span>longest chain</span></li><li><b>{r.stats.passes}</b><span>passes</span></li>
            </ul>
            <div className="cb-row"><button className="cb-go" onClick={startRun} autoFocus>Play again</button><button onClick={() => setScreen('title')}>Title</button></div>
          </div>
        </section>
      )}
    </main>
  );
}
