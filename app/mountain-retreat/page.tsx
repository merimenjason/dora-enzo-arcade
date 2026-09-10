'use client';
/* Imperative deterministic engine, explicitly repainted after each tick/action. */
/* oxlint-disable react-compiler */
import { useEffect, useRef, useState } from 'react';
import {
  advanceRetreat,
  freshRetreat,
  restoreRetreat,
  ROOMS,
  roomCost,
  SAVE_KEY,
  startActivity,
  upgradeRoom,
  type RetreatState,
} from '@/lib/mountain-retreat-game';
import './retreat.css';
function Chin({
  name,
  small = false,
}: {
  name: 'Dora' | 'Enzo';
  small?: boolean;
}) {
  return (
    // CSS pixel artwork is one accessible image, not an external asset.
    <span
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label={`${name}, ${name === 'Dora' ? 'white' : 'grey'} chinchilla`}
      className={`mr-chin ${name.toLowerCase()} ${small ? 'small' : ''}`}
    >
      <i className="ear left" />
      <i className="ear right" />
      <i className="tail" />
      <i className="body" />
      <i className="face" />
      <i className="eyes" />
      <i className="nose" />
      <i className="apron" />
    </span>
  );
}
export default function MountainRetreat() {
  const game = useRef<RetreatState>(freshRetreat());
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mountain-retreat-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system')
        setTheme(saved);
    } catch {
      /* Theme switching still works without storage. */
    }
  }, []);
  const changeTheme = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    try {
      localStorage.setItem('mountain-retreat-theme', value);
    } catch {
      /* Optional preference. */
    }
  };
  const [, render] = useState(0);
  const [notice, setNotice] = useState('A little lodge. A very big welcome.');
  const [storage, setStorage] = useState('Loading local journal…');
  const [guide, setGuide] = useState(false);
  const persist = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(game.current));
      setStorage('Journal saved on this device');
    } catch {
      setStorage('Storage unavailable · progress lasts this visit only');
    }
  };
  useEffect(() => {
    const now = Date.now();
    try {
      const restored = restoreRetreat(localStorage.getItem(SAVE_KEY), now);
      game.current = restored.state;
      if (restored.invalid)
        setNotice('Unreadable journal. A fresh lodge is ready for you.');
      else if (restored.seconds >= 30)
        setNotice(
          `Welcome home! ${Math.floor(restored.seconds / 60)} minutes away · +${restored.earned} tips. Offline work is capped at 8 hours.`,
        );
    } catch {
      game.current = freshRetreat(now);
    }
    setReady(true);
    persist();
    render((n) => n + 1);
    const sync = () => {
      const current = Date.now();
      const seconds = Math.max(
        0,
        Math.floor((current - game.current.savedAt) / 1000),
      );
      if (seconds) {
        const was = game.current.activity?.kind;
        advanceRetreat(game.current, seconds);
        game.current.savedAt =
          current -
          (seconds < 28800 ? (current - game.current.savedAt) % 1000 : 0);
        if (was && !game.current.activity)
          setNotice(
            was === 'festival'
              ? 'Lanterns, laughter, full hearts! +110 tips and +24 hearts.'
              : 'Back from the trail! +48 supplies and +35 tips.',
          );
        persist();
        render((n) => n + 1);
      }
    };
    const timer = setInterval(sync, 1000);
    window.addEventListener('pagehide', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  const s = game.current;
  const act = (fn: () => void) => {
    fn();
    persist();
    render((n) => n + 1);
  };
  const busy = !!s.activity;
  const open = s.rooms.filter(Boolean).length;
  return (
    <main className="mr-shell" data-theme={theme}>
      <header className="mr-top">
        {/* Full navigation disposes this standalone simulation, matching arcade conventions. */}
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a href="/">← MAIN ARCADE</a>
        <span>THE ANDES · 2,840 M</span>
        <label className="mr-theme">
          Theme
          <select
            aria-label="Color theme"
            value={theme}
            onChange={(e) =>
              changeTheme(e.target.value as 'light' | 'dark' | 'system')
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <button onClick={() => setGuide(!guide)} aria-expanded={guide}>
          Field guide {guide ? '−' : '+'}
        </button>
      </header>
      <section className="mr-heading">
        <div>
          <p className="mr-kicker">DORA & ENZO’S</p>
          <h1>
            Mountain Retreat<span>A soft place to land.</span>
          </h1>
        </div>
        <p className="mr-intro">
          Make tea. Make friends. Make a little home
          <br />
          above the clouds.
        </p>
      </section>
      {guide && (
        <aside className="mr-guide">
          <h2>Your first 5–10 minutes</h2>
          <p>
            Enzo produces supplies. Dora uses one supply per open room to
            welcome guests, earning hearts and tips automatically. Spend tips to
            open rooms and improve them to level 3. Try comfort for festival
            hearts, or crafted supplies for bigger tips, but watch your stock.
          </p>
          <p>
            Both hosts stop ALL normal work on 45-second expeditions and
            60-second festivals. Rewards arrive on return. The lodge keeps
            working while you are away, up to 8 hours. There are no accounts or
            purchases. Your journal stays in this browser. A second open tab has
            its own simulation, so play in one tab.
          </p>
        </aside>
      )}
      <section className="mr-wallet" aria-label="Lodge resources">
        <div>
          <span>✦ TIPS</span>
          <strong data-testid="tips">{s.coins}</strong>
          <small>For little improvements</small>
        </div>
        <div>
          <span>♥ GUEST HEARTS</span>
          <strong data-testid="hearts">{s.hearts}</strong>
          <small>A welcome worth remembering</small>
        </div>
        <div>
          <span>▧ SUPPLIES</span>
          <strong data-testid="supplies">
            {s.supplies}
            <small> / 120</small>
          </strong>
          <small>Gathered with care</small>
        </div>
        <div>
          <span>⌂ YOUR LODGE</span>
          <strong>
            {open}
            <small> / 4 rooms</small>
          </strong>
          <small>{s.served} happy guest visits</small>
        </div>
      </section>
      <div className="mr-columns">
        <section
          className="mr-scene-panel"
          aria-label="Animated cutaway mountain lodge"
        >
          <div className="mr-scene-caption">
            <span>01 / JUNIPER LODGE</span>
            <span>{busy ? '◌ BOTH HOSTS AWAY' : '● THE KETTLE IS ON'}</span>
          </div>
          <div className={`mr-landscape ${busy ? 'away' : ''}`}>
            <div className="mr-sun" />
            <div className="mr-cloud c1" />
            <div className="mr-cloud c2" />
            <div className="mr-mountain m1" />
            <div className="mr-mountain m2" />
            <div className="mr-pine p1" />
            <div className="mr-pine p2" />
            <div className="mr-lodge">
              <div className="mr-roof">
                <span>JUNIPER</span>
                <i className="mr-smoke" />
              </div>
              <div className="mr-rooms">
                {[2, 3, 0, 1].map((i) => (
                  <div
                    key={i}
                    className={`mr-room room-${i} ${s.rooms[i] ? 'unlocked' : 'locked'}`}
                    data-testid={`room-${i}`}
                  >
                    <span className="mr-room-label">
                      {s.rooms[i] ? ROOMS[i].name : '✧ A room to grow into'}
                    </span>
                    {s.rooms[i] ? (
                      <>
                        <div className="mr-window" />
                        <div className={`mr-furniture furniture-${i}`}>
                          <i />
                          <b />
                          {i === 0 ? '♨' : i === 1 ? '▥' : i === 2 ? '✦' : '≈'}
                        </div>
                        {s.rooms[i] > 1 && (
                          <div className="mr-decor">
                            ✿ {s.rooms[i] === 3 ? '✦' : ''}
                          </div>
                        )}
                        <span className="mr-level">
                          {'★'.repeat(s.rooms[i])}
                        </span>
                        {!busy && i === 0 && (
                          <div className="mr-host dora-host">
                            <Chin name="Dora" small />
                            <span>Dora · {s.dora}</span>
                          </div>
                        )}
                        {!busy && i === (s.rooms[1] ? 1 : 0) && (
                          <div className="mr-host enzo-host">
                            <Chin name="Enzo" small />
                            <span>Enzo · {s.enzo}</span>
                          </div>
                        )}
                        {!busy && <span className="mr-guest">♥</span>}
                      </>
                    ) : (
                      <>
                        <span className="mr-blueprint">
                          {i === 2 ? '☾' : i === 3 ? '≈' : '♨'}
                        </span>
                        <small>
                          {ROOMS[i].name}
                          <br />
                          {ROOMS[i].cost} tips to open
                        </small>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mr-foundation">
                EST. TODAY · STAY A LITTLE LONGER
              </div>
            </div>
            <div className="mr-path" />
            {busy && (
              <div className="mr-trail-hosts">
                <Chin name="Dora" small />
                <Chin name="Enzo" small />
                <span>
                  {s.activity?.kind === 'festival'
                    ? 'Hosting the lantern festival'
                    : 'Exploring Juniper trail'}
                </span>
              </div>
            )}
          </div>
          <div className="mr-scene-foot">
            <span>Two friends. One shared dream.</span>
            <span>
              ✦ {s.festivals} festivals · {s.expeditions} trails
            </span>
          </div>
        </section>
        <aside className="mr-host-panel">
          <div className="mr-section-title">
            <span>THE HEART OF THE HOUSE</span>
            <h2>Better, together.</h2>
          </div>
          <article className="mr-host-card">
            <Chin name="Dora" />
            <div>
              <h3>
                Dora <span>HOSPITALITY</span>
              </h3>
              <p>“Every guest deserves a warm hello.”</p>
            </div>
            <fieldset disabled={!ready || busy}>
              <legend>Dora’s attention</legend>
              <button
                aria-pressed={s.dora === 'welcome'}
                onClick={() =>
                  act(() => {
                    s.dora = 'welcome';
                  })
                }
              >
                Welcome<small>Guests every 6s · 1 ♥ / room</small>
              </button>
              <button
                aria-pressed={s.dora === 'comfort'}
                onClick={() =>
                  act(() => {
                    s.dora = 'comfort';
                  })
                }
              >
                Extra comfort<small>Guests every 10s · 3 ♥ / room</small>
              </button>
            </fieldset>
          </article>
          <article className="mr-host-card">
            <Chin name="Enzo" />
            <div>
              <h3>
                Enzo <span>SUPPLIES</span>
              </h3>
              <p>“I brought a little extra. Just in case.”</p>
            </div>
            <fieldset disabled={!ready || busy}>
              <legend>Enzo’s attention</legend>
              <button
                aria-pressed={s.enzo === 'gather'}
                onClick={() =>
                  act(() => {
                    s.enzo = 'gather';
                  })
                }
              >
                Gather<small>+2 supplies / 3s · 2 tips / level</small>
              </button>
              <button
                aria-pressed={s.enzo === 'craft'}
                onClick={() =>
                  act(() => {
                    s.enzo = 'craft';
                  })
                }
              >
                Craft with care<small>+1 supply / 6s · 3 tips / level</small>
              </button>
            </fieldset>
          </article>
          <p className="mr-stock-note">
            {busy
              ? 'Both friends are making memories. Room production is paused.'
              : s.supplies < open
                ? 'Low supplies. Let Enzo gather, or bring supplies back from a trail.'
                : 'A balanced lodge is a happy lodge. Crafting pays more, but uses up your stock.'}
          </p>
        </aside>
      </div>
      <output className="mr-notice">✉ {notice}</output>
      <section className="mr-improvements">
        <div className="mr-section-title">
          <span>SMALL CHANGES, WARMER STAYS</span>
          <h2>Room to grow.</h2>
          <p>Open rooms in order. Each level adds tips to every guest visit.</p>
        </div>
        <div className="mr-upgrades">
          {ROOMS.map((room, i) => (
            <article key={room.name}>
              <span className="mr-card-number">
                0{i + 1}{' '}
                <span>
                  {s.rooms[i] ? `LEVEL ${s.rooms[i]} / 3` : 'NOT YET OPEN'}
                </span>
              </span>
              <h3>{room.name}</h3>
              <p>{room.detail}</p>
              <button
                disabled={
                  !ready ||
                  busy ||
                  s.rooms[i] >= 3 ||
                  s.coins < roomCost(s, i) ||
                  (i > 0 && !s.rooms[i - 1])
                }
                onClick={() =>
                  act(() => {
                    if (upgradeRoom(s, i))
                      setNotice(
                        `${room.name} ${s.rooms[i] === 1 ? 'is open. Come on in!' : 'feels even cozier.'}`,
                      );
                  })
                }
              >
                {s.rooms[i] >= 3
                  ? 'Lovely as can be ✓'
                  : `${s.rooms[i] ? 'Improve' : 'Open room'} · ${roomCost(s, i)} tips`}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="mr-outings">
        <div className="mr-section-title">
          <span>STEP OUT OF THE EVERYDAY</span>
          <h2>Memories are made outside.</h2>
          <p>Both hosts go together. Normal work pauses until they return.</p>
        </div>
        <div className="mr-outing-grid">
          <article>
            <span className="mr-outing-art">↟</span>
            <div>
              <h3>The Juniper trail</h3>
              <p>
                45 seconds · costs 12 supplies
                <br />
                Bring home 48 supplies + 35 tips.
              </p>
              <button
                disabled={!ready || busy || s.supplies < 12}
                onClick={() =>
                  act(() => {
                    if (startActivity(s, 'expedition'))
                      setNotice(
                        'Dora packs the tea. Enzo takes the map. See you in 45 seconds!',
                      );
                  })
                }
              >
                Take an expedition ↗
              </button>
            </div>
          </article>
          <article>
            <span className="mr-outing-art lantern">✧</span>
            <div>
              <h3>A thousand little lanterns</h3>
              <p>
                60 seconds · costs 12 hearts + 20 supplies
                <br />
                Celebrate for 110 tips + 24 hearts.
              </p>
              <button
                disabled={!ready || busy || s.hearts < 12 || s.supplies < 20}
                onClick={() =>
                  act(() => {
                    if (startActivity(s, 'festival'))
                      setNotice(
                        'The whole mountain is invited. Your lantern festival has begun!',
                      );
                  })
                }
              >
                Host a festival ↗
              </button>
            </div>
          </article>
        </div>
        {s.activity && (
          <output className="mr-activity">
            <strong>
              {s.activity.kind === 'festival'
                ? 'Lantern festival'
                : 'Juniper expedition'}{' '}
              · {s.activity.remaining}s remaining
            </strong>
            <progress
              aria-label="Activity progress"
              max={s.activity.kind === 'festival' ? 60 : 45}
              value={
                (s.activity.kind === 'festival' ? 60 : 45) -
                s.activity.remaining
              }
            />
            <span>Hospitality & supplies paused · reward on return</span>
          </output>
        )}
      </section>
      <footer className="mr-footer">
        <span>{storage}</span>
        <span>5–10 minute visits · 8-hour offline cap · no accounts</span>
      </footer>
    </main>
  );
}
