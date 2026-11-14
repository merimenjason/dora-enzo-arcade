// Jade Street: player 1's remappable keys and the gamepad layout. A remap is saved in settings.keys as
// { action: key } (a lower-case letter or digit, or a named key such as Space, Shift, Tab, Enter); the page turns a
// pressed key into the default key of the action it is bound to, so the rest of the controls never need to know.
// The gamepad (standard layout): left stick or d-pad moves, A dash, B hop, X action, Y tag-team, RB or RT fire, LB
// gadget, LT sneak, right stick aims, d-pad up map, down phone, left reload, right (or L3/R3) switches hero, Back
// (Select) brings player 2 in or out, Start pauses. In a panel the d-pad moves between buttons, A presses, B closes.
export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'dash' | 'hop' | 'act' | 'sneak' | 'tag' | 'swap' | 'reload' | 'map' | 'phone';
export const KEY_ACTIONS: { id: KeyAction; name: string; def: string }[] = [
  { id: 'up', name: 'Move up', def: 'w' }, { id: 'down', name: 'Move down', def: 's' }, { id: 'left', name: 'Move left', def: 'a' }, { id: 'right', name: 'Move right', def: 'd' },
  { id: 'dash', name: 'Dash (boost on a ride)', def: 'Space' }, { id: 'hop', name: 'Hop (honk on a ride)', def: 'q' }, { id: 'act', name: 'Action / pay a fine', def: 'e' },
  { id: 'sneak', name: 'Sneak', def: 'Shift' }, { id: 'tag', name: 'Tag-team move', def: 'f' }, { id: 'swap', name: 'Switch hero', def: 'Tab' },
  { id: 'reload', name: 'Reload gadget', def: 'x' }, { id: 'map', name: 'Map', def: 'm' }, { id: 'phone', name: 'Phone', def: 't' },
];
/** a KeyboardEvent key (lower-cased when it is one letter) as a saved name, and back */
export const keyName = (k: string) => k === ' ' ? 'Space' : k;
export const keyOf = (n: string) => n === 'Space' ? ' ' : n;
/** keys that can't be bound (they belong to pause, the second player and the gadgets) */
export const RESERVED = new Set(['Escape', 'p', '1', '2', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '/', '.', ',', ';', "'", 'l', 'r', 'h']);
export const canBind = (n: string) => /^([a-z0-9]|Space|Shift|Tab|Enter|Control|Alt)$/.test(n) && !RESERVED.has(n);
/** turn a pressed key into the default key for its action ('' when the key's own action was moved elsewhere) */
export function translate(keys: Record<string, string>, k: string): string {
  const n = keyName(k);
  for (const a of KEY_ACTIONS) if (keys[a.id] && keys[a.id] === n) return keyOf(a.def);
  for (const a of KEY_ACTIONS) if (keys[a.id] && keys[a.id] !== a.def && a.def === n) return '';
  return k;
}
/** bind an action to a key; a key already used by another action swaps with it */
export function bind(keys: Record<string, string>, id: KeyAction, n: string): string | null {
  if (!canBind(n)) return `${n === ' ' ? 'Space' : n} is kept for something else`;
  const cur = (a: { id: KeyAction; def: string }) => keys[a.id] ?? a.def;
  const me = KEY_ACTIONS.find(a => a.id === id)!; const other = KEY_ACTIONS.find(a => a.id !== id && cur(a) === n);
  if (other) keys[other.id] = cur(me);
  keys[id] = n;
  for (const a of KEY_ACTIONS) if (keys[a.id] === a.def) delete keys[a.id];
  return null;
}
export const boundTo = (keys: Record<string, string>, id: KeyAction) => keys[id] ?? KEY_ACTIONS.find(a => a.id === id)!.def;
/** the standard gamepad buttons */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const;
