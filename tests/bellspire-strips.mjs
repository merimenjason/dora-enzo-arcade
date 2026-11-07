// The Sunken Bellspire's art strips against their manifest (lib/bellspire-art.ts): each strip's image is exactly its
// frame count of cells wide, and every place the page or its CSS sizes a strip as a whole (in % or px) uses that same
// frame count. The murals were once squeezed live when murals.webp grew to 14 panels and the CSS still said 600%.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

/** A WebP's width and height, read from its header (VP8, VP8L or VP8X). */
export function webpSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF', `${file} is a RIFF file`);
  assert.equal(b.toString('ascii', 8, 12), 'WEBP', `${file} is a WebP`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: unknown WebP chunk ${kind}`);
}

/** The manifest, read from the source (so this runs without compiling the page's art module). */
export function manifest(root = '.') {
  const src = readFileSync(`${root}/lib/bellspire-art.ts`, 'utf8');
  const art = {};
  for (const m of src.matchAll(/'([\w@-]+)':\s*\[(\d+),\s*(\d+),\s*(\d+)\]/g)) art[m[1]] = [+m[2], +m[3], +m[4]];
  return art;
}

export default function strips(root = '.') {
  let checks = 0;
  const ok = (v, msg) => { assert.ok(v, msg); checks++; };
  const ART = manifest(root);
  ok(Object.keys(ART).length > 40, 'the art manifest lists the strips');

  // every strip's image holds exactly its frames, one row of cells
  for (const [name, [cw, ch, n]] of Object.entries(ART)) {
    const file = `${root}/public/art/bellspire/${name.split('@')[0]}.webp`;
    if (!existsSync(file)) continue;
    const { w, h } = webpSize(file);
    ok(w === cw * n && h === ch, `${name}.webp is ${n} frames of ${cw}×${ch} (${n * cw}×${ch}); it is ${w}×${h}`);
  }

  // the CSS: a strip sized in % must be (frames × 100)% wide
  const css = readFileSync(`${root}/app/bellspire/bellspire.css`, 'utf8');
  for (const m of css.matchAll(/url\('\/art\/bellspire\/([\w-]+)\.webp'\)[^;}]*?\/\s*(\d+)%/g)) {
    const [, name, pct] = m;
    ok(ART[name], `the CSS's ${name} strip is in the manifest`);
    ok(+pct === ART[name][2] * 100, `the CSS sizes ${name} at ${pct}%, its ${ART[name][2]} frames × 100%`);
  }

  // the page: every inline backgroundSize takes its frame count from the manifest, never a number typed in
  const page = readFileSync(`${root}/app/bellspire/page.tsx`, 'utf8');
  const sizes = [...page.matchAll(/backgroundSize:\s*`([^`]*)`/g)].map((m) => m[1]);
  ok(sizes.length >= 3, 'the page sizes the icon, portrait and mural strips');
  for (const s of sizes) ok(/\bART\.|\bn \*/.test(s) && !/\$\{\d+ \*/.test(s), `a strip's size comes from the manifest (${s})`);
  ok(/const \[w, h, n\] = ART\.icons/.test(page) && /const \[w, h, n\] = ART\.portraits/.test(page), 'the icon and portrait strips read their frames from ART');
  return checks;
}

if (process.argv[1]?.endsWith('bellspire-strips.mjs')) console.log(`bellspire strips: ${strips()} checks passed`);
