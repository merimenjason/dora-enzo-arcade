import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Burrow Barrage · Dora & Enzo's Arcade",
  description:
    'Turn-based artillery in the style of Gunbound: set the angle and the power, mind the wind, and dig the ground out from under the other pair. Four rides, six maps, a six-match ladder and pass-and-play for two. Local saves.',
};
export default function BurrowBarrageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
