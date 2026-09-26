import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Hay Maze Defence · Dora & Enzo's Arcade",
  description:
    'A maze-building tower defence: predators take the shortest way to Dora and Enzo’s raisin stash, so every tower you build bends their path. Slow them with dust, send them to sleep with a bell, and hold twenty waves on three maps.',
};
export default function HayMazeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
