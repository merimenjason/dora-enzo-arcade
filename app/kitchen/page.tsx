/* Mutable engine ticks are mirrored into React; saved preferences hydrate after mount. */
/* eslint-disable react/react-compiler */
/* Canvas illustrations retain descriptive accessible names. */
/* eslint-disable jsx-a11y/prefer-tag-over-role */
'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Kitchen,
  CREW,
  RECIPES,
  SHIFTS,
  SAVE_KEY,
  freshProfile,
  parseProfile,
  buyUpgrade,
  upgradeCost,
  settle,
  type Profile,
} from '@/lib/kitchen-game';
import { HEROES } from '@/lib/saga-game';
import {
  sagaPortrait,
  loadSagaPainting,
  subscribeSagaPainting,
} from '@/lib/saga-paint';
import { makeSound } from '@/lib/cue-sound';
import './kitchen.css';
const sound = makeSound('kitchen-sound', {
  arrive: [{ f: 440, d: 0.15, v: 0.025 }],
  done: [{ f: 660, d: 0.12, v: 0.04 }],
  serve: [
    { f: 523, d: 0.12 },
    { f: 784, d: 0.3, at: 0.1 },
  ],
  miss: [{ f: 220, to: 170, d: 0.2, v: 0.025 }],
  bell: [{ f: 1047, d: 0.5, v: 0.04 }],
  end: [
    { f: 523, d: 0.2 },
    { f: 659, d: 0.2, at: 0.15 },
    { f: 784, d: 0.4, at: 0.3 },
  ],
});
const names = HEROES.map((h) => h.name);
function Customer({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current?.getContext('2d');
      if (c) {
        c.clearRect(0, 0, 80, 80);
        sagaPortrait(c, index, 80);
      }
    };
    const stop = subscribeSagaPainting(draw);
    void loadSagaPainting([
      index >= 18 ? 'heroes-3' : 'portraits-' + Math.floor(index / 6),
    ])
      .then(draw)
      .catch(() => {});
    draw();
    return stop;
  }, [index]);
  return (
    <canvas
      ref={ref}
      width={80}
      height={80}
      className="k-customer"
      aria-hidden="true"
    />
  );
}
// The source atlas remains unchanged; each cell is isolated before fitting its whole silhouette.
function Art({
  kind,
  index,
  className = '',
}: {
  kind: 'chefs' | 'food';
  index: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image();
    let active = true;
    image.onload = () => {
      if (!active || !ref.current) return;
      const c = ref.current.getContext('2d');
      if (!c) return;
      const crops =
        kind === 'chefs'
          ? [
              [151, 12, 487, 487],
              [776, 14, 612, 486],
              [144, 505, 531, 501],
              [773, 507, 653, 495],
            ]
          : [
              [70, 109, 420, 379],
              [548, 105, 443, 376],
              [1060, 59, 439, 420],
              [39, 588, 473, 362],
              [529, 585, 477, 326],
              [1027, 515, 473, 441],
            ];
      const [x, y, w, h] = crops[index];
      c.clearRect(0, 0, 300, 300);
      const scale = Math.min(284 / w, 284 / h);
      c.drawImage(
        image,
        x,
        y,
        w,
        h,
        (300 - w * scale) / 2,
        (300 - h * scale) / 2,
        w * scale,
        h * scale,
      );
    };
    image.src = '/art/kitchen/' + kind + '.png';
    return () => {
      active = false;
    };
  }, [kind, index]);
  return (
    <canvas
      ref={ref}
      width={300}
      height={300}
      className={'k-art ' + className}
      role="img"
      aria-label={
        kind === 'chefs'
          ? CREW[index].name
          : (RECIPES[index]?.name ?? 'Pantry basket')
      }
    />
  );
}
export default function KitchenPage() {
  const [profile, setProfile] = useState<Profile>(freshProfile),
    [game, setGame] = useState<Kitchen | null>(null),
    [paused, setPaused] = useState(false),
    [selected, setSelected] = useState(-1),
    [muted, setMuted] = useState(false),
    [note, setNote] = useState(
      'Choose a shift or take your time in Cozy kitchen.',
    ),
    [loaded, setLoaded] = useState(false);
  const [, render] = useState(0);
  const gameRef = useRef<Kitchen | null>(null),
    pauseRef = useRef(false),
    saved = useRef<Kitchen | null>(null);
  useEffect(() => {
    gameRef.current = game;
    pauseRef.current = paused;
  }, [game, paused]);
  function store(p: Profile) {
    setProfile(p);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(p));
    } catch {
      setNote('Storage is unavailable. This session still works.');
    }
  }
  function start(shift: number, cozy = false) {
    const g = new Kitchen(shift, cozy, profile.upgrades, Date.now());
    saved.current = null;
    setGame(g);
    setSelected(-1);
    setPaused(false);
    setNote(
      'Click an order: prepare → oven → serve. Auto crew chooses a free specialist.',
    );
  }
  function advance(id: number) {
    if (!game || paused) return;
    const message = game.advance(id, selected);
    setNote(message || 'Chef assigned. Keep the other paws busy!');
    render((n) => n + 1);
  }
  function ring() {
    if (game && !paused && game.bell()) {
      sound.cue('bell');
      setNote('Bell rush! Five seconds of faster teamwork.');
      render((n) => n + 1);
    }
  }
  useEffect(() => {
    try {
      setProfile(parseProfile(localStorage.getItem(SAVE_KEY)));
    } catch {}
    setMuted(sound.muted());
    setLoaded(true);
  }, []);
  useEffect(() => {
    let last = performance.now(),
      frame: number;
    function loop(now: number) {
      const g = gameRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (g && !pauseRef.current && !g.ended) {
        g.tick(dt);
        g.events.splice(0).forEach((e) => sound.cue(e));
        if (g.ended && saved.current !== g) {
          saved.current = g;
          setProfile((p) => {
            const next = settle(p, g);
            try {
              localStorage.setItem(SAVE_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
        }
        render((n) => n + 1);
      }
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    const hidden = () => {
      if (document.hidden && gameRef.current && !gameRef.current.ended)
        setPaused(true);
    };
    const blur = () => {
      if (gameRef.current && !gameRef.current.ended) setPaused(true);
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const k = e.key.toLowerCase();
      if (k === 'p' || k === 'escape') {
        if (game && !game.ended) setPaused((v) => !v);
        e.preventDefault();
      } else if (k === 'm') {
        const m = !sound.muted();
        sound.setMuted(m);
        setMuted(m);
      } else if (game && !paused && !game.ended) {
        if ('01234'.includes(k) && k.length === 1) setSelected(Number(k) - 1);
        else if (k === ' ') {
          e.preventDefault();
          ring();
        } else if ('qwer'.includes(k) && k.length === 1) {
          e.preventDefault();
          const o = game.orders['qwer'.indexOf(k)];
          if (o) advance(o.id);
        }
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const modal = paused || game?.ended;
  return (
    <main className="kitchen">
      <header className="k-head">
        <Link href="/">← Arcade</Link>
        <div>
          <span>EMBER &amp; CLOVER</span>
          <h1>Midnight Kitchen</h1>
        </div>
        <div className="k-head-actions">
          <b>{profile.coins} gold</b>
          <button
            onClick={() => {
              const m = !muted;
              sound.setMuted(m);
              setMuted(m);
            }}
          >
            {muted ? 'Sound off' : 'Sound on'}
          </button>
          {game && !game.ended && (
            <button onClick={() => setPaused(true)}>Pause</button>
          )}
        </div>
      </header>
      {!game ? (
        <>
          <section className="k-welcome">
            <div className="k-welcome-copy">
              <p className="k-eyebrow">
                A LITTLE BAKERY. A LONG, LOVELY NIGHT.
              </p>
              <h2>
                Heroes by day.
                <br />
                Bakers by moonlight.
              </h2>
              <p>
                Whisk, bake and serve with Dora, Enzo, Pip and Ember. Keep four
                pairs of paws busy, ring the rush bell, and feed the woodland
                one warm treat at a time.
              </p>
              <button
                className="k-gold"
                disabled={!loaded}
                onClick={() => start(profile.unlocked - 1)}
              >
                Open shift {profile.unlocked} →
              </button>
              <button onClick={() => start(11, true)}>
                Cozy kitchen · no clock
              </button>
              <p className="k-caption">
                No waiting to recruit. All four chefs are yours from the first
                night.
              </p>
            </div>
            <div className="k-welcome-chefs">
              {CREW.map((c, i) => (
                <Art key={c.name} kind="chefs" index={i} />
              ))}
            </div>
          </section>
          <section className="k-campaign">
            <div className="k-section-heading">
              <h2>Twelve lantern-lit shifts</h2>
              <p>Earn gold, unlock recipes, and grow your kitchen.</p>
            </div>
            <div className="k-shifts">
              {SHIFTS.map((s, i) => (
                <button
                  disabled={i >= profile.unlocked}
                  key={s}
                  onClick={() => start(i)}
                >
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <strong>{s}</strong>
                  <small>
                    {i >= profile.unlocked
                      ? 'Locked'
                      : profile.stars[i]
                        ? '★'.repeat(profile.stars[i])
                        : 'Open for supper'}
                  </small>
                </button>
              ))}
            </div>
            <h2>The upgrade bench</h2>
            <div className="k-upgrades">
              {['Prep table', 'Oven rack', 'Serving hatch'].map((s, i) => (
                <button
                  key={s}
                  disabled={
                    profile.upgrades[i] >= 3 ||
                    profile.coins < upgradeCost(profile, i)
                  }
                  onClick={() => store(buyUpgrade(profile, i))}
                >
                  <strong>{s}</strong>
                  <span>
                    {'◆'.repeat(profile.upgrades[i]) || 'Base kitchen'}
                  </span>
                  <small>
                    {i === 1
                      ? '10% faster per level; second rack at level 2'
                      : i === 2
                        ? '10% faster service and +4s patience per level'
                        : '10% faster preparation per level'}
                  </small>
                  <b>
                    {profile.upgrades[i] === 3
                      ? 'Fully upgraded'
                      : upgradeCost(profile, i) + ' gold'}
                  </b>
                </button>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="k-hud" aria-label="Shift progress">
            <div>
              <small>
                {game.cozy
                  ? 'UNTIMED COZY KITCHEN'
                  : 'SHIFT ' + (game.shift + 1)}
              </small>
              <strong>{SHIFTS[game.shift]}</strong>
            </div>
            <div>
              <small>{game.cozy ? 'TAKE YOUR TIME' : 'TIME LEFT'}</small>
              <strong>
                {game.cozy
                  ? '∞'
                  : Math.max(0, Math.ceil(game.duration - game.time)) + 's'}
              </strong>
            </div>
            <div>
              <small>SERVED</small>
              <strong>
                {game.served}
                {!game.cozy && ' / ' + game.goal}
              </strong>
            </div>
            <div>
              <small>COMBO · SCORE</small>
              <strong>
                ×{game.combo} · {game.score}
              </strong>
            </div>
            <button
              className={game.time < game.bellUntil ? 'k-gold k-rushing' : ''}
              disabled={paused || game.time < game.bellReady || game.ended}
              onClick={ring}
            >
              {game.time < game.bellUntil
                ? 'Bell rush!'
                : game.time < game.bellReady
                  ? 'Bell · ' + Math.ceil(game.bellReady - game.time) + 's'
                  : 'Ring rush bell'}
              <small>Space · faster paws for 5s</small>
            </button>
            <button
              disabled={!game.cozy && game.served < game.goal}
              onClick={() => {
                game.finish();
                render((n) => n + 1);
                if (saved.current !== game) {
                  saved.current = game;
                  store(settle(profile, game));
                }
              }}
            >
              {game.cozy ? 'Close kitchen' : 'Finish shift'}
            </button>
          </section>
          <section className="k-orders" aria-label="Customer orders">
            {game.orders.map((o, i) => {
              const j = game.jobs.find((x) => x.order === o.id),
                action =
                  o.stage === 'new'
                    ? 'Prepare'
                    : o.stage === 'prepared'
                      ? 'To the oven'
                      : o.stage === 'ready'
                        ? 'Serve'
                        : o.stage === 'preparing'
                          ? 'Preparing'
                          : o.stage === 'baking'
                            ? 'In the oven'
                            : 'On the way';
              return (
                <article
                  className={
                    'k-order ' + (o.stage === 'ready' ? 'k-ready' : '')
                  }
                  key={o.id}
                >
                  <div className="k-order-top">
                    <Customer index={o.customer} />
                    <span>
                      ORDER {String(o.id).padStart(2, '0')} ·{' '}
                      {names[o.customer]}
                    </span>
                    <kbd>{'QWER'[i]}</kbd>
                  </div>
                  <div className="k-dish">
                    <Art kind="food" index={o.recipe} />
                    <div>
                      <h2>{RECIPES[o.recipe].name}</h2>
                      <p>
                        {j
                          ? CREW[j.crew].name + ' is working'
                          : o.stage === 'prepared'
                            ? 'Prepared and ready to bake'
                            : o.stage === 'ready'
                              ? 'Warm and ready to serve'
                              : 'A fresh order for your crew'}
                      </p>
                    </div>
                  </div>
                  <progress
                    aria-label="Customer patience"
                    value={game.cozy ? 1 : o.patience / o.maxPatience}
                    max={1}
                  />
                  <button
                    disabled={paused || !game.canAdvance(o)}
                    onClick={() => advance(o.id)}
                  >
                    {action}
                    {j && ' · ' + Math.ceil(j.remaining) + 's'}
                  </button>
                  {j && (
                    <progress
                      className="k-work-progress"
                      aria-label="Task progress"
                      value={1 - j.remaining / j.duration}
                      max={1}
                    />
                  )}
                </article>
              );
            })}
          </section>
          <section
            className={
              'k-stage ' +
              (game.time < game.bellUntil ? 'k-rush ' : '') +
              (game.jobs.some((j) => j.kind === 1) ? 'k-oven-active' : '')
            }
            aria-label="Painted kitchen"
          >
            <div className="k-station-signs">
              <span>Pantry &amp; prep</span>
              <span>Golden hearth</span>
              <span>Moonlit service</span>
            </div>
            <div className="k-chefs">
              {CREW.map((c, i) => {
                const j = game.jobs.find((x) => x.crew === i);
                return (
                  <div
                    key={c.name}
                    className={'k-chef ' + (j ? 'k-working' : '')}
                  >
                    <Art kind="chefs" index={i} />
                    <div className="k-chef-tag">
                      <strong>{c.name}</strong>
                      <span>
                        {j
                          ? ['Whisking', 'Baking', 'Serving'][j.kind]
                          : 'Ready to help'}
                      </span>
                      {j && (
                        <progress
                          aria-label={c.name + ' task'}
                          value={1 - j.remaining / j.duration}
                          max={1}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="k-crew" aria-label="Choose a chef">
            <button
              aria-pressed={selected === -1}
              className={selected === -1 ? 'k-selected' : ''}
              onClick={() => setSelected(-1)}
            >
              <strong>Auto crew</strong>
              <small>0 · free specialist</small>
            </button>
            {CREW.map((c, i) => (
              <button
                aria-pressed={selected === i}
                className={selected === i ? 'k-selected' : ''}
                key={c.name}
                onClick={() => setSelected(i)}
              >
                <strong>
                  {c.name} {game.jobs.some((j) => j.crew === i) ? '· busy' : ''}
                </strong>
                <small>
                  {i + 1} · {c.perk}
                </small>
              </button>
            ))}
          </section>
        </>
      )}
      <output className="k-note">{note}</output>
      <details className="k-help">
        <summary>How to run the kitchen</summary>
        <p>
          Click an order three times as each stage completes: Prepare → To the
          oven → Serve. One chef handles each task; use Auto crew or select a
          chef with 1–4 (0 returns to Auto). The oven holds one order, or two
          after its second upgrade. Orders leave when their patience runs out.
          Serve within ten seconds of the previous order to build a combo.
        </p>
        <p>
          Q / W / E / R advance the four orders from left to right. Space rings
          the bell: five seconds of faster tasks and a little patience boost,
          once every 22 seconds. P / Escape pauses, M changes sound. Your
          kitchen pauses when you leave the tab. Campaign stars: meet the goal,
          miss no orders, serve two above the goal. Cozy mode has no deadlines
          or campaign rewards. Progress saves between shifts; leaving mid-shift
          returns you to the menu.
        </p>
      </details>
      {modal && game && (
        <div className="k-overlay">
          <dialog
            ref={(el) => {
              if (el && !el.open) el.showModal();
            }}
            onCancel={(e) => {
              e.preventDefault();
              if (paused) setPaused(false);
            }}
            className="k-modal"
            aria-label={paused ? 'Kitchen paused' : 'Shift results'}
          >
            <p className="k-eyebrow">
              {paused ? 'THE LANTERNS CAN WAIT' : SHIFTS[game.shift]}
            </p>
            <h2>
              {paused
                ? 'A little breather'
                : game.cozy
                  ? 'A lovely night’s work'
                  : game.result?.won
                    ? 'Supper is served!'
                    : 'Tomorrow is another night'}
            </h2>
            {paused ? (
              <p>Your chefs and customers are waiting right here.</p>
            ) : (
              <>
                <div className="k-stars">
                  {game.cozy
                    ? '☾'
                    : '★'.repeat(game.result?.stars ?? 0) || '☆ ☆ ☆'}
                </div>
                <p>
                  {game.served} happy guests · {game.missed} missed orders ·{' '}
                  {game.score} points
                </p>
                <p>
                  {game.cozy
                    ? 'No clock, no pressure. Just a warm kitchen.'
                    : 'Earned ' +
                      game.result?.coins +
                      ' gold for the upgrade bench.'}
                </p>
              </>
            )}
            <div className="k-modal-actions">
              {paused ? (
                <button
                  className="k-gold"
                  autoFocus
                  onClick={() => setPaused(false)}
                >
                  Back to the kitchen
                </button>
              ) : (
                <button
                  className="k-gold"
                  autoFocus
                  onClick={() =>
                    start(
                      game.result?.won
                        ? Math.min(11, game.shift + 1)
                        : game.shift,
                      game.cozy,
                    )
                  }
                >
                  {game.result?.won && game.shift < 11
                    ? 'Next shift'
                    : 'Open again'}
                </button>
              )}
              <button
                onClick={() => {
                  setGame(null);
                  setPaused(false);
                  setNote('Choose your next shift, or improve the kitchen.');
                }}
              >
                Kitchen menu
              </button>
            </div>
          </dialog>
        </div>
      )}
    </main>
  );
}
