'use client';
import { useEffect, useRef } from 'react';
import { drawChinchilla, type ChinId } from '../lib/chinchilla-art';
import { fitDraw } from '../lib/art-fit';

/** A still, side-on portrait of Dora or Enzo from the shared 2D drawing, sized by CSS width (5:4). */
export function ChinchillaPortrait({ id, face = 1, className }: { id: ChinId; face?: 1 | -1; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 300, 240);
    // The tail reaches further behind than the whiskers do in front, so the animal is measured and fitted whole.
    fitDraw(c, `chin-${id}`, 16, 12, 268, 214, (q) => drawChinchilla(q, id, 0, 0, { face: 1, h: 40, time: 0 }), face);
  }, [id, face]);
  return <canvas ref={ref} width={300} height={240} className={className} aria-hidden="true" />;
}
