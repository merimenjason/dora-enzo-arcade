'use client';
import { useEffect, useRef } from 'react';
import { drawChinchilla, type ChinId } from '../lib/chinchilla-art';

/** A still, side-on portrait of Dora or Enzo from the shared 2D drawing, sized by CSS width (5:4). */
export function ChinchillaPortrait({ id, face = 1, className }: { id: ChinId; face?: 1 | -1; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 300, 240);
    // The tail reaches further behind than the whiskers do in front, so sit the body off-centre.
    drawChinchilla(c, id, face === 1 ? 158 : 142, 222, { face, h: 150, time: 0 });
  }, [id, face]);
  return <canvas ref={ref} width={300} height={240} className={className} aria-hidden="true" />;
}
