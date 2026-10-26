// Grumble Hunt's beast HUD: the Grump bar, quest line and zone map, and the entrance name card.
import { BEASTS, INTRO_CARD, MIGHTY_NAMES, QUESTS, VARIANT_COLORS, ZONE_NAMES, type Beast, type HuntGame } from '@/lib/grumble-hunt-game';
import { WEATHER_NAMES } from './ui';

/** The beast's name, Grump, any quest goal and the zone map. */
export function BeastHud({ g, b }: { g: HuntGame; b: Beast }) {
  return <section className="hunt-beast-hud" aria-label={`${BEASTS[b.id].name} Grump`}>
    <div><strong>{b.mighty ? 'Mighty ' : ''}{BEASTS[b.id].name}</strong><span>{b.state === 'rain' || b.state === 'fan' || b.state === 'spin' || b.state === 'windup' && b.mighty && (b.rush > 0 || ['rain', 'fan', 'spin'].includes(b.attack)) ? `${MIGHTY_NAMES[b.id]}! Watch the orange` : b.away ? `Gone to Zone ${b.zone + 1} · follow the path` : b.state === 'wander' ? 'Wandering off to the next zone' : b.state === 'nap' ? 'A sanctuary nap awaits' : b.state === 'roar' ? 'Roaring! Roll or guard' : b.state === 'turf' ? 'Squaring off · step out of the circle' : b.state === 'grabbed' ? 'Held by your vine' : b.state === 'yanked' ? 'Stumbling!' : b.state === 'trudge' ? 'Tired · trudging home to its nest' : b.state === 'snooze' ? 'Snoozing · a wake-up bonk is worth double' : b.state === 'dizzy' ? 'Dizzy! Big bonks welcome' : b.state === 'stuck' ? 'Stuck in sticky sap · bonk away' : g.hero.hidden > 0 ? 'Lost track of you' : b.state === 'rest' ? 'Resting · your opening' : b.grumpy ? 'Extra Grumpy · nearly nap time' : b.drowsy > 0 ? 'Drowsy · 30% slower' : b.id === 'frostmane' ? `Mood ${b.phase} of 3` : 'Gently calm this grumpy friend'}</span></div>
    <progress aria-label="Grump" data-testid="grump" max={b.maxGrump} value={b.grump} /><small>Grump {Math.ceil(b.grump)} / {b.maxGrump}{g.locked ? ' · Locked on' : ''}{g.stormy ? ` · ${WEATHER_NAMES[g.weather.kind]}` : ''}{b.soft > 0 ? ' · Softened' : ''}</small>
    {g.quest && (() => { const q = QUESTS.find((x) => x.id === g.quest!.id)!; return <small className="hunt-quest-line" data-testid="quest-status">★ {q.title}{q.beasts.length > 1 ? ` · nap ${g.quest!.step + 1} of ${q.beasts.length}` : ''}{q.limit ? g.quest!.failed ? ' · timer done, no rush' : ` · ${Math.max(0, Math.ceil(q.limit - g.huntTime))} s left` : ''}{q.goal ? ` · ${q.goal.text}` : ''}</small>; })()}
    {g.zones > 1 && <ol className="hunt-zones" data-testid="zones" aria-label={`Zone ${g.zone + 1} of ${g.zones}: ${g.zoneName}`}>{ZONE_NAMES[g.area].map((name, i) => <li key={name} className={`${i === g.zone ? 'here' : ''} ${i === b.zone ? 'beast' : ''}`} title={name}><span>{i + 1}</span>{i === g.zone && <em>{name}</em>}</li>)}</ol>}
</section>;
}
/** The name card shown when a beast first appears. */
export function IntroCard({ g, b }: { g: HuntGame; b: Beast }) {
  return <div className="hunt-intro-card" data-testid="intro-card" role="status" style={{ '--beast-color': g.variant ? VARIANT_COLORS[b.id] : BEASTS[b.id].color, opacity: Math.min(1, (INTRO_CARD - (g.huntTime - g.introAt)) / 0.5) } as React.CSSProperties}>
    <img src={`/art/hunt/ref-${b.id}.webp`} alt="" /><div><small>{b.mighty ? 'A Mighty friend appears' : g.variant ? 'An Extra Grumpy friend appears' : 'A grumpy friend appears'}</small><strong>{b.mighty ? 'Mighty ' : ''}{BEASTS[b.id].name}</strong><em>{BEASTS[b.id].title}</em></div>
</div>;
}
