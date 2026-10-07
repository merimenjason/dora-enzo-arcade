// Fitting a drawing into a box. The chinchillas and the predators are drawn by hand in a 24-unit frame with their feet
// at (0, 0), and none of them is the same width, so anything that places one by a fixed offset ends up with tails
// cut off and noses in each other's faces. This paints the drawing once off screen, measures what was really
// painted, and remembers it.
type C2D = CanvasRenderingContext2D;
/** How far a drawing reaches from its feet, in its own units: left, right, up and down. */
export type Span = { x0: number; x1: number; top: number; bot: number };

const SPANS = new Map<string, Span>();
// Room for a drawing up to 225 units either side of its feet, 240 above them and 80 below, measured to half a unit.
const K = 2, OX = 450, OY = 480, CW = 900, CH = 640;

/** Measure `paint`, which draws with its feet at the origin, at any size it likes. `key` names the drawing; each is measured once. */
export function span(key: string, paint: (c: C2D) => void): Span {
  const had = SPANS.get(key);
  if (had) return had;
  let out: Span = { x0: -14, x1: 14, top: 26, bot: 1 };
  if (typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const c = cv.getContext('2d', { willReadFrequently: true });
    if (c) {
      c.translate(OX, OY); c.scale(K, K); c.lineJoin = 'round'; paint(c);
      const d = c.getImageData(0, 0, CW, CH).data;
      let x0 = CW, x1 = 0, y0 = CH, y1 = 0;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (d[(y * CW + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 > x0) out = { x0: (x0 - OX) / K, x1: (x1 + 1 - OX) / K, top: (OY - y0) / K, bot: Math.max(0, (y1 + 1 - OY) / K) };
    }
  }
  SPANS.set(key, out);
  return out;
}

/**
 * Where to stand a drawing so all of it sits inside a w by h box with `pad` to spare: the scale to draw it at, and
 * where its feet go. `face` is 1 for facing right, -1 for mirrored.
 */
export function fit(sp: Span, w: number, h: number, pad = 0, face = 1) {
  const k = Math.min((w - pad * 2) / (sp.x1 - sp.x0), (h - pad * 2) / (sp.top + sp.bot));
  return { k, x: w / 2 - face * k * (sp.x0 + sp.x1) / 2, y: h - pad - k * sp.bot };
}

/**
 * Draw `paint` so that all of it sits inside the box, standing on the bottom of it and centred. `paint` draws with
 * its feet at the origin, facing right; `face` -1 mirrors it. Use one box per animal and they cannot overlap.
 */
export function fitDraw(c: C2D, key: string, x: number, y: number, w: number, h: number, paint: (c: C2D) => void, face = 1) {
  const at = fit(span(key, paint), w, h, 0, face);
  c.save(); c.translate(x + at.x, y + at.y); c.scale(face * at.k, at.k); c.lineJoin = 'round'; paint(c); c.restore();
}
