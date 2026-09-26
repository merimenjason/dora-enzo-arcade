import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Hay Maze Defence · Dora & Enzo's Arcade",
  description:
    'An Emberward-style roguelite tower defence: draw hay-bale blocks as cards, lay them into a maze, stand elemental towers on top, and keep the Hearthlight burning through six levels.',
};
export default function HayMazeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
