// Jade Street: a preload that swaps in the layout table's identity (the world built in the old frame and left there,
// every district where it was first laid out) before the game's modules load. Used as `node --import
// ./tests/jade-zero.mjs <suite>` by tests/jade-layout.mjs, and by hand to run any Jade suite in the old frame.
globalThis.__JADE_LAYOUT__ = 'zero';
