import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Dragon Playground · Dora & Enzo’s Arcade',
  description: 'A side-on race across Singapore’s old mosaic playgrounds. The Toa Payoh dragon wakes up at dusk; Dora and Enzo ride it from playground to playground against the Bishan otters, sliding, swinging and see-sawing for speed, swatting crows off their kaya toast.',
};
export default function DragonLayout({ children }: { children: React.ReactNode }) { return children; }
