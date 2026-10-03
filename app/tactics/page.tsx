/* oxlint-disable react/react-compiler -- The deterministic engine is intentionally mutable and read on each animation-driven render. */
/* oxlint-disable next/no-html-link-for-pages -- Match the arcade's hard navigation so leaving always tears down the game loop. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Battle, Run, MISSIONS, HEROES, PREDATORS, PRED_IDS, HERO_IDS, ABILITIES, RELICS, REGIONS, CLASSES, DIFFICULTY, DIFFICULTY_IDS, RUN_STAGES, RUN_UNLOCK, CHAPTER_TWO, SIZE,
  missionBattle, stars, bonusMet, unlockedHeroes, rewardText, goalText, hint, bestStep, type HeroId, type PredId, type AbilityId, type Tile, type Forecast, type Difficulty, type Mission,
} from '../../lib/burrow-tactics-game';
import { Stage, VIEW_W, VIEW_H, drawHeroIcon, drawPredIcon, type Overlay } from '../../lib/burrow-tactics-scene';
import { cue, setMuted } from './sound';
import './tactics.css';

const SAVE_KEY = 'burrow-tactics-v1', RUN_KEY = 'burrow-tactics-run-v2', SCALE = 2;
/** `best` is the most battles of a run ever won (RUN_STAGES means a run was finished); `dawn` lists the difficulties a run was finished on. */
type Save = { stars: number[]; muted: boolean; best: number; difficulty: Difficulty; dawn: Difficulty[] };
const blank = (): Save => ({ stars: MISSIONS.map(() => 0), muted: false, best: 0, difficulty: 'standard', dawn: [] });
function readSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}');
    return { stars: MISSIONS.map((_, i) => Math.max(0, Math.min(3, Number(raw.stars?.[i]) || 0))), muted: !!raw.muted, best: Math.max(0, Math.min(RUN_STAGES, Number(raw.best) || 0)), difficulty: DIFFICULTY_IDS.includes(raw.difficulty) ? raw.difficulty : 'standard', dawn: DIFFICULTY_IDS.filter((d) => Array.isArray(raw.dawn) && raw.dawn.includes(d)) };
  } catch { return blank(); }
}
const writeSave = (s: Save) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode: the game still plays, progress just isn't kept */ } };
function readRun(): Run | null {
  try { const raw = localStorage.getItem(RUN_KEY); return raw ? Run.restore(JSON.parse(raw)) : null; } catch { return null; }
}
const writeRun = (r: Run | null) => { try { if (r && (r.phase === 'battle' || r.phase === 'reward')) localStorage.setItem(RUN_KEY, JSON.stringify(r.snapshot())); else localStorage.removeItem(RUN_KEY); } catch { /* see writeSave */ } };
/** How many missions in a row have been won, from the first. */
const clearedOf = (s: Save) => { const i = s.stars.findIndex((n) => n === 0); return i < 0 ? s.stars.length : i; };

const DIR_NAME = ['up and right', 'down and right', 'down and left', 'up and left'];
const WHY: Record<string, string> = {
  cloud: 'Nobody can attack from inside a dust cloud. Move out, or groom.',
  soaked: 'Soaked through: no attacking while standing in water. Move out, or groom.',
};

function Icon({ draw, w, h, id }: { draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; w: number; h: number; id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    draw(c, w, h);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps -- `id` names what is drawn
  return <canvas ref={ref} width={w * SCALE} height={h * SCALE} style={{ width: w, height: h }} aria-hidden="true" />;
}
const heroIcon = (kind: HeroId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawHeroIcon(c, kind, w, h);
const predIcon = (kind: PredId) => (c: CanvasRenderingContext2D, w: number, h: number) => drawPredIcon(c, kind, w, h);
const Stars = ({ n }: { n: number }) => <span className="bt-stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <i key={i} className={i < n ? 'on' : ''}>★</i>)}</span>;

type Mode = { kind: 'mission'; index: number } | { kind: 'run' };
/** One step of the guided first mission: what to say, and the button or tile to point at. */
type Coach = { text: string; button?: string; point?: Tile };

export default function BurrowTactics() {
  const [save, setSave] = useState<Save>(blank);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<'home' | 'battle'>('home');
  const [selected, setSelected] = useState(0);
  const [armed, setArmed] = useState<AbilityId | null>(null);
  const [note, setNote] = useState('');
  const [advice, setAdvice] = useState('');
  const [infoTile, setInfoTile] = useState<Tile | null>(null);
  const [squad, setSquad] = useState<HeroId[]>(['dora', 'enzo']);
  const [hasRun, setHasRun] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, setTick] = useState(0);
  const battle = useRef<Battle | null>(null), stage = useRef<Stage | null>(null), run = useRef<Run | null>(null), mode = useRef<Mode>({ kind: 'mission', index: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const selRef = useRef(0), armRef = useRef<AbilityId | null>(null), hover = useRef<Tile | null>(null), cursor = useRef<Tile | null>(null), pending = useRef<Tile | null>(null);
  const version = useRef(0), recorded = useRef<Battle | null>(null), noteTimer = useRef(0), result = useRef(0);
  const tipRef = useRef<Overlay['hint']>(null), coachRef = useRef<Coach | null>(null), guided = useRef(false);
  const memo = useRef<{ key: string; overlay: Overlay }>({ key: '', overlay: { selected: 0, moves: [], targets: [], aim: null, hover: null, cursor: null, preview: null, forecast: null } });

  useEffect(() => { const s = readSave(); setSave(s); setMuted(s.muted); setHasRun(!!readRun()); setSquad(unlockedHeroes(clearedOf(s)).slice(0, 3)); setLoaded(true); }, []);
  // The browser test reads and drives the running game through this.
  useEffect(() => { (window as unknown as { __tactics?: () => unknown }).__tactics = () => ({ battle: battle.current, stage: stage.current, run: run.current, plan: () => (battle.current ? hint(battle.current) : null) }); }, []);

  const refresh = () => setTick((t) => t + 1);
  /** The tiles a click could do something with right now, so the board can favour them over a creature standing in front. */
  const wanted = (): Tile[] => { const b = battle.current, u = b?.unit(selRef.current), a = armRef.current; return !b || !u ? [] : b.state === 'deploy' ? b.zone() : a ? b.targets(u.id, a) : b.moves(u.id); };
  const say = (text: string) => { if (!text) return; setNote(text); window.clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 2400); };
  const choose = (id: number) => { selRef.current = id; setSelected(id); };
  const arm = (a: AbilityId | null) => { armRef.current = a; pending.current = null; setArmed(a); version.current++; };
  const cleared = clearedOf(save), unlocked = unlockedHeroes(cleared);

  function open(b: Battle) {
    battle.current = b; stage.current = new Stage(b); stage.current.sfx = cue; stage.current.speed = speed;
    recorded.current = null; result.current = 0; hover.current = null; cursor.current = null; tipRef.current = null; coachRef.current = null; setAdvice('');
    choose(b.heroes[0]?.id ?? 0); arm(null); setInfoTile(null); setScreen('battle'); refresh();
  }
  const startMission = (i: number) => { mode.current = { kind: 'mission', index: i }; run.current = null; guided.current = i === 0 && save.stars[0] === 0; open(missionBattle(i)); };
  function startRun() {
    const r = Run.start((Date.now() % 100000) + 1, squad, save.difficulty);
    mode.current = { kind: 'run' }; run.current = r; writeRun(r); setHasRun(true); open(r.battle!);
  }
  function continueRun() {
    const r = readRun();
    if (!r || !r.battle) return;
    mode.current = { kind: 'run' }; run.current = r; open(r.battle);
  }
  const home = () => { setScreen('home'); setHasRun(!!readRun()); };

  /** After any engine call: play its events and keep the run saved. */
  function commit() {
    const b = battle.current, st = stage.current;
    if (!b || !st) return;
    st.feed(b.events.splice(0), b);
    version.current++; tipRef.current = null; setAdvice('');
    if (run.current) writeRun(run.current);
    refresh();
  }
  /** Arms the main action if it has anything to aim at. */
  function autoArm(id: number) {
    const b = battle.current, u = b?.unit(id);
    if (!b || !u || u.hp <= 0 || u.acted) { arm(null); return; }
    const main = HEROES[u.kind as HeroId].ability;
    arm(b.targets(id, main).length ? main : null);
  }
  function select(id: number) {
    const b = battle.current, u = b?.unit(id);
    if (!b || !u || u.hp <= 0) return;
    choose(id); cue('select');
    if (u.moved && !u.acted) autoArm(id); else arm(null);
  }
  /** Moves on to a chinchilla that can still do something. */
  function nextHero() {
    const b = battle.current;
    if (!b) return;
    const list = b.heroes, at = list.findIndex((u) => u.id === selRef.current);
    for (let i = 1; i <= list.length; i++) { const u = list[(at + i) % list.length]; if (u && !u.acted) { select(u.id); return; } }
    arm(null);
  }
  /** After an action: on to the next chinchilla, with a word if this one is a Scout that can still move. */
  function afterAct(id: number) {
    const b = battle.current, u = b?.unit(id);
    nextHero();
    if (b && u && u.hp > 0 && b.state === 'player' && !u.moved && b.moves(id).length) say(`${HEROES[u.kind as HeroId].name} can still move this turn.`);
  }
  /** Points at what the planner would do next. */
  function showHint() {
    const b = battle.current;
    if (!b || stage.current?.busy || b.state !== 'player') return;
    const s = hint(b);
    arm(null);
    if (!s) { tipRef.current = null; version.current++; setAdvice('Nothing better left to do this turn: end the turn.'); return; }
    const u = b.unit(s.id)!, name = HEROES[u.kind as HeroId].name;
    choose(s.id);
    tipRef.current = { id: s.id, move: s.move, target: s.act && s.act.ability !== 'groom' && ABILITIES[s.act.ability].aim !== 'self' ? [s.act.x, s.act.y] : null, then: s.then };
    version.current++;
    const parts = [s.move ? 'move to the tile marked “move”' : '', s.act ? (s.act.ability === 'groom' ? 'groom' : ABILITIES[s.act.ability].aim === 'self' ? `use ${ABILITIES[s.act.ability].name}` : `use ${ABILITIES[s.act.ability].name} on the tile marked “aim”`) : '', s.then ? 'move to the tile marked “then move”' : ''].filter(Boolean);
    setAdvice(`${name} should ${parts.join(', then ')}.`);
    cue('select');
  }
  /** The guided first mission: the next thing to do on turn 1, worked out from where the battle stands. */
  function guide(b: Battle, a: AbilityId | null): Coach | null {
    if (!guided.current || mode.current.kind !== 'mission' || b.state !== 'player') return null;
    if (b.turn > 1) return b.turn === 2 ? { text: 'The foxes moved and aimed again. Same steps: read the red, push, check the forecast. Stuck? Press Hint.' } : null;
    const d = b.heroes.find((u) => u.kind === 'dora'), e = b.heroes.find((u) => u.kind === 'enzo');
    const fox = (id: number, ab: AbilityId) => b.targets(id, ab).find(([x, y]) => b.unitAt(x, y)?.side === 'pred') ?? null;
    if (d && !d.acted) {
      const t = fox(d.id, 'seed');
      if (!t) return { text: 'Move Dora onto a blue tile in line with a fox, so she has a shot.' };
      return a === 'seed' ? { text: 'Now hover over the fox: the board shows it pushed back and its red bite tile moving with it. Click the fox to shoot.', point: t } : { text: 'Red tiles are where the foxes will bite when the turn ends. Dora has the gold ring: press Seed Shot.', button: 'ability' };
    }
    if (e && !e.acted) {
      const t = fox(e.id, 'whack');
      if (t) return a === 'whack' ? { text: 'Click the fox: Tail Whack does 2 and shoves it away.', point: t } : { text: 'Enzo is next to a fox. Press Tail Whack.', button: 'ability' };
      const s = bestStep(b, e.id);
      return s.move && !e.moved ? { text: 'Now Enzo. He hits hard but only up close: click the marked blue tile to walk up to the other fox.', point: s.move } : { text: 'Enzo has nothing in reach. Press End turn.', button: 'end-turn' };
    }
    return { text: 'Everyone has acted. The forecast above the board says what ending the turn will cost. Press End turn.', button: 'end-turn' };
  }
  function fire(a: AbilityId) {
    const b = battle.current, u = b?.unit(selRef.current);
    if (!b || !u || stage.current?.busy || b.state !== 'player' || u.acted) return;
    if (a === 'groom') { if (b.act(u.id, 'groom', u.x, u.y) === 'ok') { commit(); afterAct(u.id); } return; }
    if (armRef.current === a) { arm(null); return; }
    if (b.cloud[u.y * SIZE + u.x] > 0) { say(WHY.cloud); return; }
    if (b.soaked(u)) { say(WHY.soaked); return; }
    if (!b.targets(u.id, a).length) { say(`Nothing for ${ABILITIES[a].name} to aim at from here.`); return; }
    arm(a);
    // An action aimed at the chinchilla itself shows its result at once and waits for a confirming click.
    if (ABILITIES[a].aim === 'self') { pending.current = [u.x, u.y]; version.current++; say(`Click ${HEROES[u.kind as HeroId].name}, or press Enter, to confirm.`); }
  }
  function clickTile(t: Tile, touch: boolean) {
    const b = battle.current, st = stage.current;
    if (!b || !st) return;
    if (st.busy) { st.flush(); refresh(); return; }
    const [x, y] = t, there = b.unitAt(x, y), sel = b.unit(selRef.current), a = armRef.current;
    if (b.state === 'deploy') {
      if (there?.side === 'hero' && there.kind !== 'kit') { select(there.id); return; }
      if (sel && b.place(sel.id, x, y) === 'ok') { cue('step'); commit(); } else say('Pick a green tile.');
      return;
    }
    if (b.state !== 'player') return;
    if (sel && sel.hp > 0 && a) {
      const aim = b.aimAt(sel.id, a, x, y);
      if (aim) {
        const p = pending.current;
        if (touch && !(p && p[0] === aim[0] && p[1] === aim[1])) { pending.current = aim; version.current++; say('Tap again to confirm.'); return; }
        b.act(sel.id, a, aim[0], aim[1]); arm(null); commit(); afterAct(sel.id); return;
      }
      if (there?.side === 'hero' && there.id !== sel.id) { select(there.id); return; }
      arm(null); return;
    }
    if (sel && sel.hp > 0 && !sel.moved && b.moves(sel.id).some((m) => m[0] === x && m[1] === y)) { b.moveHero(sel.id, x, y); commit(); if (sel.acted) nextHero(); else autoArm(sel.id); return; }
    if (there?.side === 'hero') { select(there.id); return; }
    if (sel && sel.hp > 0 && !sel.acted) {
      const main = HEROES[sel.kind as HeroId].ability, aim = b.aimAt(sel.id, main, x, y);
      if (aim) { arm(main); pending.current = aim; version.current++; say(touch ? 'Tap again to confirm.' : 'Click again to confirm.'); }
    }
  }
  function endTurn() {
    const b = battle.current;
    if (!b || stage.current?.busy) return;
    if (b.state === 'deploy') { b.ready(); arm(null); commit(); choose(b.heroes[0]?.id ?? 0); return; }
    if (b.state !== 'player') return;
    b.endTurn(); arm(null); commit();
    choose(b.heroes[0]?.id ?? 0);
  }
  function undo() {
    const b = battle.current;
    if (!b || stage.current?.busy) return;
    if (armRef.current) { arm(null); return; }
    if (b.undoMove(selRef.current) === 'ok') commit(); else say('Nothing to undo.');
  }
  function resetTurn() {
    const b = battle.current;
    if (!b || stage.current?.busy) return;
    if (b.resetTurn() === 'ok') { arm(null); commit(); choose(b.heroes[0]?.id ?? 0); say('The turn starts over. That was your one reset.'); } else say('The reset has already been used this battle.');
  }
  const cycleSpeed = () => { const s = speed === 1 ? 2 : speed === 2 ? 3 : 1; setSpeed(s); if (stage.current) stage.current.speed = s; };
  const toggleMute = () => { const next = { ...save, muted: !save.muted }; setSave(next); writeSave(next); setMuted(next.muted); };
  /** Records a finished battle once its last animation has played. */
  function settle() {
    const b = battle.current;
    if (!b || b.state === 'player' || b.state === 'deploy' || recorded.current === b) return;
    recorded.current = b;
    cue(b.state === 'won' ? 'win' : 'lose');
    if (mode.current.kind === 'mission') {
      const i = mode.current.index, n = stars(b, MISSIONS[i]);
      result.current = n;
      if (n > save.stars[i]) { const next = { ...save, stars: save.stars.map((v, j) => (j === i ? n : v)) }; setSave(next); writeSave(next); }
    } else if (run.current) {
      const r = run.current;
      r.finish(); writeRun(r); setHasRun(r.phase === 'reward');
      const held = r.stage + (b.state === 'won' ? 1 : 0), dawn = r.phase === 'won' && !save.dawn.includes(r.difficulty);
      if (held > save.best || dawn) { const next = { ...save, best: Math.max(save.best, held), dawn: dawn ? [...save.dawn, r.difficulty] : save.dawn }; setSave(next); writeSave(next); }
    }
    refresh();
  }
  /** One line about whatever is on a tile. */
  function describe(t: Tile | null) {
    const b = battle.current;
    if (!b || !t) return '';
    const [x, y] = t, i = y * SIZE + x, u = b.unitAt(x, y), mark = b.marks.find((m) => m.x === x && m.y === y), f = b.feature[i];
    const ground = b.cloud[i] > 0 ? ' In a cloud: cannot attack.' : b.fire[i] > 0 ? ' Standing in fire.' : b.terrain[i] === 'bramble' ? ' Standing in brambles.' : b.terrain[i] === 'hill' ? ' On high ground: hits 1 harder.' : '';
    if (u?.kind === 'kit') return `The kit · ${u.hp}/${u.maxHp} health · moves ${u.move}. Too small to fight: walk it to the den flag.${ground}`;
    if (u?.side === 'hero') { const d = HEROES[u.kind as HeroId], ab = ABILITIES[d.ability], cls = d.cls ? CLASSES[d.cls] : null; return `${d.name}${cls ? `, ${cls.name}` : ''} · ${u.hp}/${u.maxHp} health · moves ${u.move}. ${ab.name}: ${ab.blurb}${u.skill && d.second ? ` Also knows ${ABILITIES[d.second].name}.` : ''}${cls ? ` ${cls.perk}: ${cls.blurb}` : ''}${ground}`; }
    if (u) { const d = PREDATORS[u.kind as PredId]; return `${u.alpha ? 'Alpha ' : ''}${d.name} · ${u.hp}/${u.maxHp} health. ${d.attack}: ${d.blurb}${u.alpha ? ' Alphas do 1 more.' : ''}${u.mark ? (b.goal === 'hunt' ? ' Marked: knock it out to win.' : ' Marked: knock it out and the raid ends.') : ''}${u.dir >= 0 && u.kind !== 'cougar' ? ` Aiming ${DIR_NAME[u.dir]}.` : b.state === 'player' && u.dir < 0 ? ' Not attacking this turn.' : ''}${ground}`; }
    if (mark) return `Rustling grass: ${mark.alpha ? 'an alpha ' : 'a '}${PREDATORS[mark.kind].name.toLowerCase()} comes up here after the predators attack. Stand on it to block it (costs the blocker 1).`;
    if (i === b.exit) return 'The den. Walk the kit onto this tile to win.';
    if (f === 'burrow' && i === b.key) return `The nursery. If it collapses the battle is lost.${b.armor[i] > 0 ? ' Braced: it survives the next hit.' : ''}`;
    if (f === 'burrow') return `A burrow. If it is hit it collapses and the warren loses 1.${b.armor[i] > 0 ? ' Braced: it survives the next hit.' : ''}`;
    if (f === 'rubble') return 'A collapsed burrow. Nothing left to protect here.';
    if (f === 'bale') return 'A hay bale. Blocks the way and takes one hit before it breaks.';
    if (f === 'rock') return 'A rock. Blocks the way and cannot be broken.';
    if (b.cloud[i] > 0) return 'A cloud. Whoever stands in it cannot attack.';
    if (b.fire[i] > 0) return 'Fire. Stopping here costs 1, and so does standing here when the predators’ turn ends. It spreads to brambles and hay next to it.';
    if (b.terrain[i] === 'ice') return 'Ice. Anything pushed onto it keeps sliding until it leaves the ice or hits something.';
    if (b.terrain[i] === 'hill') return 'High ground. Whoever stands here hits 1 harder.';
    if (b.terrain[i] === 'water') return 'Water. Ground predators pushed in are gone; a chinchilla is soaked and cannot attack until it walks out.';
    if (b.terrain[i] === 'bramble') return 'Brambles. Stopping here, or being pushed in, costs 1 health.';
    return '';
  }

  // The loop: play queued animations and draw.
  useEffect(() => {
    if (screen !== 'battle') return;
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    let raf = 0, last = 0, ui = 0, wasBusy = false;
    const loop = (now: number) => {
      const b = battle.current, st = stage.current;
      if (!b || !st) return;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
      st.update(dt);
      if (!st.busy) {
        const sel = b.unit(selRef.current), a = armRef.current, focus = pending.current ?? hover.current ?? cursor.current;
        const key = `${version.current}|${selRef.current}|${a}|${focus}|${pending.current}`;
        if (memo.current.key !== key) {
          const live = b.state === 'player' && sel && sel.hp > 0;
          const aim = live && a && focus ? b.aimAt(sel.id, a, focus[0], focus[1]) : null;
          const preview = aim && a ? b.preview(sel!.id, a, aim[0], aim[1]) : null;
          let forecast: Forecast | null = null;
          if (b.state === 'player') forecast = (preview && preview.state === 'player' ? preview : b).forecast();
          coachRef.current = guide(b, a);
          memo.current = { key, overlay: { selected: selRef.current, moves: live && !a ? b.moves(sel.id) : [], targets: live && a ? b.targets(sel.id, a) : [], aim, hover: null, cursor: null, preview, forecast, zone: b.state === 'deploy' ? b.zone() : undefined, hint: tipRef.current, point: coachRef.current?.point ?? null } };
          refresh();
        }
        if ((b.state === 'won' || b.state === 'lost') && recorded.current !== b) settle();
      }
      c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      st.draw(c, b, now / 1000, { ...memo.current.overlay, hover: hover.current, cursor: cursor.current });
      if (st.busy !== wasBusy || (st.busy && now - ui > 120)) { wasBusy = st.busy; ui = now; refresh(); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps -- the loop reads refs

  // Keyboard: Tab next chinchilla, 1 and 2 the actions, G groom, H hint, arrows and Enter for the board, U undo, R reset, E end turn, F speed, M sound.
  useEffect(() => {
    if (screen !== 'battle') return;
    const down = (e: KeyboardEvent) => {
      const b = battle.current;
      if (!b || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase(), onButton = !!(e.target as HTMLElement).closest('button,a');
      if (k === 'f') { cycleSpeed(); return; }
      if (k === 'm') { toggleMute(); return; }
      if (stage.current?.busy) { if (k === ' ' || k === 'enter') { e.preventDefault(); stage.current.flush(); refresh(); } return; }
      if (b.state === 'deploy' && k === 'e') { endTurn(); return; }
      if (b.state !== 'player' && b.state !== 'deploy') return;
      const sel = b.unit(selRef.current), acts = sel ? b.abilities(sel).filter((id) => id !== 'groom') : [];
      if (k === 'tab') { e.preventDefault(); const list = b.heroes, at = list.findIndex((u) => u.id === selRef.current); const u = list[(at + (e.shiftKey ? list.length - 1 : 1)) % list.length]; if (u) { select(u.id); cursor.current = [u.x, u.y]; } return; }
      if (k === 'escape') { if (armRef.current) arm(null); else cursor.current = null; return; }
      if (k === '1' && acts[0]) { fire(acts[0]); return; }
      if (k === '2') { fire(acts[1] ?? 'groom'); return; }
      if (k === '3' || k === 'g') { fire('groom'); return; }
      if (k === 'h') { showHint(); return; }
      if (k === 'u') { undo(); return; }
      if (k === 'r') { resetTurn(); return; }
      if (k === 'e') { endTurn(); return; }
      const step: Record<string, Tile> = { arrowup: [0, -1], arrowright: [1, 0], arrowdown: [0, 1], arrowleft: [-1, 0] };
      if (step[k]) {
        e.preventDefault();
        const from = cursor.current ?? (sel ? [sel.x, sel.y] : [3, 3]);
        cursor.current = [Math.max(0, Math.min(SIZE - 1, from[0] + step[k][0])), Math.max(0, Math.min(SIZE - 1, from[1] + step[k][1]))];
        setInfoTile(cursor.current); return;
      }
      const at = cursor.current ?? pending.current;
      if ((k === 'enter' || k === ' ') && at && (!onButton || pending.current)) { e.preventDefault(); clickTile(at, false); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const header = (
    <header className="bt-header">
      <a className="bt-back" href="/">← MAIN ARCADE</a>
      <span className="bt-brand">BURROW TACTICS</span>
      <span />
    </header>
  );
  const b = battle.current, st = stage.current;

  if (screen === 'home' || !b || !st) {
    const total = save.stars.reduce((s, n) => s + n, 0), runOpen = cleared > RUN_UNLOCK, diff = DIFFICULTY[save.difficulty];
    const setDifficulty = (d: Difficulty) => { const next = { ...save, difficulty: d }; setSave(next); writeSave(next); };
    const card = (m: Mission, i: number) => {
      const openNow = i <= cleared, extra = m.goal === 'escort' ? ' · escort' : m.goal === 'hunt' ? ' · hunt' : m.key ? ' · nursery' : m.boss ? ' · boss' : '';
      return (
        <button key={m.name} className={`bt-mission${save.stars[i] ? ' done' : ''}`} data-testid={`mission-${i + 1}`} disabled={!openNow || !loaded} onClick={() => startMission(i)}>
          <em>{i + 1}</em>
          <strong>{m.name}</strong>
          <small>{m.squad.map((h) => HEROES[h].name).join(', ')} · {m.turns} turns · {REGIONS[m.region]}{extra}</small>
          <span>{openNow ? <Stars n={save.stars[i]} /> : '🔒'}{m.unlock ? ` · unlocks ${HEROES[m.unlock].name}` : ''}{m.teaches ? ` · teaches ${ABILITIES[HEROES[m.teaches].second!].name}` : ''}{i === RUN_UNLOCK ? ' · opens The Long Night' : ''}</span>
        </button>
      );
    };
    const toggle = (id: HeroId) => setSquad((s) => (s.includes(id) ? s.filter((h) => h !== id) : s.length < 3 ? [...s, id] : s));
    return (
      <main className="bt-shell">
        {header}
        <section className="bt-intro">
          <div className="bt-intro-art">
            <Icon draw={heroIcon('enzo')} w={84} h={84} id="enzo" /><Icon draw={heroIcon('dora')} w={84} h={84} id="dora" /><Icon draw={predIcon('fox')} w={84} h={84} id="fox" />
          </div>
          <div>
            <p className="bt-eyebrow">TURN-BASED TACTICS · EIGHTEEN MISSIONS · THE LONG NIGHT</p>
            <h1>Burrow Tactics</h1>
            <p className="bt-lede">Predators are raiding the warren, and every one of them <b>shows what it is about to hit</b>. Each turn your chinchillas move once and act once. Almost everything you do <b>pushes</b> something: into the stream, into brambles, into another predator’s teeth. Hold out until the raid is over.</p>
          </div>
        </section>

        <ol className="bt-how">
          <li><b>Read the red.</b> Red tiles and arrows are what each predator will hit when you end the turn, in the order numbered on them.</li>
          <li><b>Move, then act.</b> Each chinchilla moves once and acts once. Blue tiles are moves; orange tiles are targets. A Scout may act first and move after.</li>
          <li><b>Push, don’t just punch.</b> A pushed predator’s attack moves with it. Water drowns it, brambles and bumps hurt it.</li>
          <li><b>Check the forecast.</b> The line above the board says what ending the turn now would cost. Make it say “Nothing gets through.”</li>
        </ol>

        <h2 className="bt-section">Campaign <small>{total} of {MISSIONS.length * 3} stars · win a mission to open the next</small></h2>
        <div className="bt-missions">{MISSIONS.slice(0, CHAPTER_TWO).map(card)}</div>
        <h2 className="bt-section">Chapter two <small>choose where your squad starts · new ground, new predators, a second action each</small></h2>
        <div className="bt-missions">{MISSIONS.slice(CHAPTER_TWO).map((m, i) => card(m, i + CHAPTER_TWO))}</div>

        <h2 className="bt-section">The Long Night <small>{RUN_STAGES} battles on new ground every time · warren of {diff.warren} · a reward after each{save.best ? ` · best: ${save.best >= RUN_STAGES ? 'made it to dawn' : `${save.best} of ${RUN_STAGES} nights held`}` : ''}</small></h2>
        <div className={`bt-run${runOpen ? '' : ' locked'}`}>
          {!runOpen ? <p>Win mission {RUN_UNLOCK + 1}, <b>{MISSIONS[RUN_UNLOCK].name}</b>, to open the run.</p> : <>
            <p>Pick three chinchillas and how hard the night should be. Each battle is drawn from the run’s seed, and you choose where the squad starts. A knocked-out chinchilla comes back with 1 less health, the warren only mends when you choose it as a reward, and second actions are learned along the way.</p>
            <div className="bt-diff" role="group" aria-label="Difficulty">
              {DIFFICULTY_IDS.map((d) => <button key={d} className={save.difficulty === d ? 'on' : ''} aria-pressed={save.difficulty === d} data-testid={`diff-${d}`} onClick={() => setDifficulty(d)}><b>{DIFFICULTY[d].name}{save.dawn.includes(d) ? ' ★' : ''}</b><small>{DIFFICULTY[d].blurb}</small></button>)}
            </div>
            <div className="bt-pick">
              {unlocked.map((id) => (
                <button key={id} className={squad.includes(id) ? 'on' : ''} aria-pressed={squad.includes(id)} data-testid={`pick-${id}`} onClick={() => toggle(id)}>
                  <Icon draw={heroIcon(id)} w={52} h={52} id={id} /><b>{HEROES[id].name}</b><small>{CLASSES[HEROES[id].cls!].name} · {ABILITIES[HEROES[id].ability].name}</small>
                </button>
              ))}
            </div>
            <div className="bt-run-go">
              <button className="bt-go" data-testid="start-run" disabled={squad.length !== 3} onClick={startRun}>{squad.length === 3 ? 'Start a new run →' : `Pick ${3 - squad.length} more`}</button>
              {hasRun && <button data-testid="continue-run" onClick={continueRun}>Continue the saved run</button>}
            </div>
          </>}
        </div>

        <h2 className="bt-section">The chinchillas</h2>
        <div className="bt-roster">
          {HERO_IDS.map((id) => {
            const d = HEROES[id], have = unlocked.includes(id), ab = ABILITIES[d.ability], cls = CLASSES[d.cls!], second = ABILITIES[d.second!];
            return (
              <div key={id} className={`bt-card${have ? '' : ' locked'}`}>
                <Icon draw={heroIcon(id)} w={60} h={60} id={id} />
                <div>
                  <strong>{d.name} <span>♥ {d.hp} · moves {d.move} · {cls.name}</span></strong>
                  <small>{have ? ab.name : `Unlocked by mission ${MISSIONS.findIndex((m) => m.unlock === id) + 1}`}</small>
                  <p>{have ? ab.blurb : d.blurb}</p>
                  {have && <p><b>{second.name}</b> (second action, learned in chapter two or on a run). {second.blurb}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <h2 className="bt-section">The classes</h2>
        <div className="bt-roster">
          {Object.values(CLASSES).map((c) => (
            <div key={c.id} className="bt-card"><div><strong>{c.name} <span>{HERO_IDS.filter((id) => HEROES[id].cls === c.id).map((id) => HEROES[id].name).join(' and ')}</span></strong><small>{c.perk}</small><p>{c.blurb}</p></div></div>
          ))}
        </div>
        <h2 className="bt-section">The predators</h2>
        <div className="bt-roster">
          {PRED_IDS.map((id) => {
            const d = PREDATORS[id];
            return (
              <div key={id} className="bt-card">
                <Icon draw={predIcon(id)} w={60} h={60} id={id} />
                <div><strong>{d.name} <span>♥ {d.hp} · moves {d.move}</span></strong><small>{d.attack}</small><p>{d.blurb}</p></div>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  const busy = st.busy, m = mode.current.kind === 'mission' ? MISSIONS[mode.current.index] : null, r = run.current;
  const sel = b.unit(selected), f = memo.current.overlay.forecast, previewing = !!memo.current.overlay.preview;
  const waiting = b.heroes.filter((u) => !u.acted).length, coach = busy ? null : coachRef.current, acts = sel && sel.side === 'hero' ? b.abilities(sel).filter((id) => id !== 'groom') : [];
  const lostWhy = b.warren <= 0 ? 'The warren has fallen.' : b.key >= 0 && b.feature[b.key] !== 'burrow' ? 'The nursery has fallen.' : b.goal === 'escort' && !b.kit ? 'The kit was knocked out.' : !b.heroes.some((u) => u.kind !== 'kit') ? 'Everyone is knocked out.' : b.goal === 'escort' ? 'The kit did not get home in time.' : 'The marked predator got away.';
  let forecastText = '', safe = false;
  if (f && b.state === 'player' && !busy) {
    const parts = [f.warren ? `warren −${f.warren}` : '', b.key >= 0 && f.burrows.some(([x, y]) => y * SIZE + x === b.key) ? 'the nursery falls' : '', ...Object.entries(f.heroes).map(([id, n]) => `${HEROES[b.unit(Number(id))!.kind as HeroId].name} ${f.downs.includes(Number(id)) ? 'knocked out' : `−${n}`}`)].filter(Boolean);
    safe = parts.length === 0;
    forecastText = safe ? 'Nothing gets through.' : parts.join(' · ');
  }
  const done = (b.state === 'won' || b.state === 'lost') && !busy && recorded.current === b;
  let overlay: React.ReactNode = null;
  if (done && m && mode.current.kind === 'mission') {
    const i = mode.current.index, n = result.current, won = b.state === 'won';
    overlay = won ? <>
      <p className="bt-eyebrow">MISSION {i + 1} · {m.name.toUpperCase()}</p>
      <h2>{b.goal === 'escort' ? 'The kit is home!' : b.goal === 'hunt' ? 'The hunt is over!' : 'The burrows are safe!'}</h2>
      <div className="bt-result-stars"><Stars n={n} /></div>
      <ul className="bt-checks">
        <li className="yes">{goalText(b)}</li>
        <li className={b.stats.lost === 0 ? 'yes' : 'no'}>Lose no burrow</li>
        <li className={bonusMet(b, m.bonus) ? 'yes' : 'no'}>{m.bonus.text}</li>
      </ul>
      {m.unlock && <div className="bt-unlock"><Icon draw={heroIcon(m.unlock)} w={64} h={64} id={m.unlock} /><div><strong>{HEROES[m.unlock].name} joins the warren</strong><small>{ABILITIES[HEROES[m.unlock].ability].name}: {ABILITIES[HEROES[m.unlock].ability].blurb}</small></div></div>}
      {i === RUN_UNLOCK && <p className="bt-open">The Long Night is now open on the menu.</p>}
      {i === CHAPTER_TWO - 1 && <p className="bt-open">Chapter two is open: new ground, new predators, and a second action for everyone.</p>}
      {i + 1 < MISSIONS.length && <button className="bt-go" data-testid="next-mission" onClick={() => startMission(i + 1)}>{`Mission ${i + 2}: ${MISSIONS[i + 1].name} →`}</button>}
      <button onClick={() => startMission(i)}>Play it again</button><button onClick={home}>Missions</button>
    </> : <>
      <p className="bt-eyebrow">MISSION {i + 1} · {m.name.toUpperCase()}</p>
      <h2>{lostWhy}</h2>
      <p>{m.tip}</p>
      <button className="bt-go" data-testid="retry" onClick={() => startMission(i)}>Try again →</button><button onClick={home}>Missions</button>
    </>;
  } else if (done && r) {
    if (r.phase === 'reward') overlay = <>
      <p className="bt-eyebrow">NIGHT {r.stage + 1} OF {RUN_STAGES} HELD · WARREN {r.warren}/{r.maxWarren}</p>
      <h2>Choose one</h2>
      <div className="bt-rewards">
        {r.choices.map((w, i) => { const t = rewardText(w); return <button key={t.title} data-testid={`reward-${i}`} onClick={() => { r.pick(i); writeRun(r); open(r.battle!); }}><strong>{t.title}</strong><small>{t.blurb}</small></button>; })}
      </div>
    </>;
    else overlay = <>
      <p className="bt-eyebrow">THE LONG NIGHT · {r.kills} PREDATORS SEEN OFF</p>
      <h2>{r.phase === 'won' ? 'Dawn! The warren made it through.' : b.warren <= 0 ? `The warren fell on night ${r.stage + 1}.` : `${lostWhy.slice(0, -1)} on night ${r.stage + 1}.`}</h2>
      <p>{r.phase === 'won' ? `You finished a ${DIFFICULTY[r.difficulty].name.toLowerCase()} night with ${r.warren} of ${r.maxWarren} warren and ${r.relics.length} relic${r.relics.length === 1 ? '' : 's'}.` : 'Every run is different. Protect the burrows first; a predator that hits nothing is as good as a predator knocked out.'}</p>
      <button className="bt-go" onClick={home}>Back to the menu →</button>
    </>;
  }
  const canAct = !!sel && sel.hp > 0 && !sel.acted && b.state === 'player' && !busy;
  const tip = b.state === 'deploy' ? 'Choose where to start: click a chinchilla, then a green tile. The predators pick their attacks once you start the battle.' : armed ? `${ABILITIES[armed].name}: pick an orange tile. The board shows what will happen before you confirm.` : sel && canAct && !sel.moved ? `${HEROES[sel.kind as HeroId].name} is ready: pick a blue tile to move, or use an action.` : sel && sel.hp > 0 && sel.acted && !sel.moved && b.state === 'player' ? `${HEROES[sel.kind as HeroId].name} has acted but can still move: pick a blue tile.` : m ? `Tip: ${m.tip}` : 'Protect the burrows. A predator that hits nothing is as good as one knocked out.';

  return (
    <main className="bt-shell bt-play">
      {header}
      <section className="bt-top">
        <div className="bt-title"><strong>{m ? `Mission ${mode.current.kind === 'mission' ? mode.current.index + 1 : 0}: ${m.name}` : b.name}</strong><small data-testid="goal">{r ? `Night ${r.stage + 1} of ${RUN_STAGES} · ${DIFFICULTY[r.difficulty].name} · ${goalText(b)}${r.relics.length ? ` · ${r.relics.map((id) => RELICS[id].name).join(', ')}` : ''}` : m ? `${goalText(b)} · Bonus: ${m.bonus.text}` : ''}</small></div>
        <div className="bt-stat" data-testid="turn"><small>TURN</small><b>{st.turn} / {b.turns}</b></div>
        <div className="bt-stat" data-testid="warren" aria-label={`Warren ${st.warren} of ${b.maxWarren}`}><small>WARREN</small><b className="bt-warren">{Array.from({ length: b.maxWarren }, (_, i) => <i key={i} className={i < st.warren ? 'on' : ''} />)}</b></div>
        <div className={`bt-forecast${safe ? ' safe' : ''}${previewing ? ' preview' : ''}`} data-testid="forecast"><small>{b.state === 'deploy' ? 'BEFORE THE RAID' : previewing ? 'AFTER THIS ACTION' : 'IF YOU END THE TURN NOW'}</small><b title={forecastText}>{b.state === 'deploy' ? 'Place your squad on the green tiles.' : forecastText || '…'}</b></div>
      </section>
      <div className="bt-layout">
        <aside className="bt-squad" aria-label="Your chinchillas">
          {b.units.filter((u) => u.side === 'hero').map((u) => {
            const d = HEROES[u.kind as HeroId], sp = st.sprites.get(u.id), hp = sp ? sp.hp : 0;
            const status = hp <= 0 ? 'Knocked out' : b.state === 'deploy' ? 'Placing' : u.acted ? (u.moved ? 'Done' : 'Can still move') : b.soaked(u) ? 'Soaked' : b.cloud[u.y * SIZE + u.x] > 0 ? 'In dust' : u.moved ? 'Moved' : 'Ready';
            return (
              <button key={u.id} title={d.cls ? `${CLASSES[d.cls].name} · ${CLASSES[d.cls].perk}: ${CLASSES[d.cls].blurb}` : d.blurb} className={`bt-hero${selected === u.id ? ' on' : ''}${hp <= 0 || (u.acted && u.moved) ? ' dim' : ''}`} data-testid={`hero-${u.kind}`} data-status={status} disabled={hp <= 0} onClick={() => select(u.id)}>
                <Icon draw={heroIcon(u.kind as HeroId)} w={46} h={46} id={u.kind} />
                <span><strong>{d.name}</strong><span className="bt-pips">{Array.from({ length: u.maxHp }, (_, i) => <i key={i} className={i < hp ? 'on' : ''} />)}</span><small>{d.cls ? `${CLASSES[d.cls].name} · ` : ''}{status}</small></span>
              </button>
            );
          })}
        </aside>
        <div className="bt-board">
          <canvas
            ref={canvas} width={VIEW_W * SCALE} height={VIEW_H * SCALE} tabIndex={0}
            data-testid="board" data-state={b.state} data-turn={b.turn} data-warren={b.warren} data-busy={busy ? '1' : '0'}
            aria-label="The battlefield. Tab picks a chinchilla, the arrow keys move the cursor, Enter confirms, 1 and 2 use the actions, G grooms, H gives a hint, E ends the turn."
            onPointerMove={(e) => { const q = e.currentTarget.getBoundingClientRect(), t = st.pick(((e.clientX - q.left) / q.width) * VIEW_W, ((e.clientY - q.top) / q.height) * VIEW_H, wanted()); if (String(t) !== String(hover.current)) { hover.current = e.pointerType === 'touch' ? null : t; setInfoTile(t); } }}
            onPointerLeave={() => { hover.current = null; }}
            onPointerDown={(e) => {
              const q = e.currentTarget.getBoundingClientRect(), t = st.pick(((e.clientX - q.left) / q.width) * VIEW_W, ((e.clientY - q.top) / q.height) * VIEW_H, wanted());
              if (e.button === 2) { undo(); return; }
              cursor.current = null;
              if (t) { setInfoTile(t); clickTile(t, e.pointerType === 'touch'); } else if (st.busy) { st.flush(); refresh(); }
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {(coach || (advice && !busy)) && !overlay && <div className="bt-bars">
            {coach && <p className="bt-coach" data-testid="coach"><b>GUIDE</b> {coach.text}</p>}
            {advice && !busy && <p className="bt-coach bt-advice" data-testid="advice"><b>HINT</b> {advice}</p>}
          </div>}
          {note && <output className="bt-note">{note}</output>}
          {overlay && <div className="bt-overlay"><div>{overlay}</div></div>}
        </div>
      </div>
      <div className="bt-actions">
        {acts.map((id, n) => <button key={id} className={`bt-act${armed === id ? ' on' : ''}${n === 0 && coach?.button === 'ability' ? ' pulse' : ''}`} data-testid={n === 0 ? 'ability' : 'ability-2'} disabled={!canAct} aria-pressed={armed === id} title={ABILITIES[id].blurb} onClick={() => fire(id)}><b>{ABILITIES[id].name}</b><small>{n + 1}</small></button>)}
        <button className="bt-act" data-testid="groom" disabled={!canAct} title={ABILITIES.groom.blurb} onClick={() => fire('groom')}><b>Groom +1</b><small>G</small></button>
        <button data-testid="undo" disabled={busy || !sel || !(armed || (sel.moved && sel.canUndo))} onClick={undo}>Undo · U</button>
        <button data-testid="reset" disabled={busy || b.resetLeft <= 0 || b.state !== 'player'} onClick={resetTurn}>Reset turn · R</button>
        <button data-testid="hint" disabled={busy || b.state !== 'player'} onClick={showHint}>Hint · H</button>
        <span className="bt-spacer" />
        <button onClick={toggleMute} aria-pressed={save.muted}>{save.muted ? 'Sound off' : 'Sound on'} · M</button>
        <button onClick={cycleSpeed}>{speed}× · F</button>
        <button onClick={home}>Menu</button>
        {b.state === 'deploy'
          ? <button className="bt-go" data-testid="deploy-ready" disabled={busy} onClick={endTurn}>Start the battle · E</button>
          : <button className={`bt-go${coach?.button === 'end-turn' ? ' pulse' : ''}`} data-testid="end-turn" disabled={busy || b.state !== 'player'} onClick={endTurn}>End turn{waiting ? ` (${waiting} still ready)` : ''} · E</button>}
      </div>
      <p className="bt-info" data-testid="info">{describe(infoTile) || tip}</p>
    </main>
  );
}
