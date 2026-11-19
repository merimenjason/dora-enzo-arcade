// Jade Street: a preload that swaps in the layout table's test shift (every block +7 tiles east, +3 south) before the
// game's modules load. Used as `node --import ./tests/jade-shift.mjs <suite>` by tests/jade-layout.mjs, and by hand to
// run any Jade suite in the shifted world (see lib/jade-layout.ts).
globalThis.__JADE_LAYOUT__ = 'shift';
