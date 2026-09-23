import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Fluff Forge · Dora & Enzo's Arcade",
  description:
    'Build your own side-scrolling course from blocks, clouds, springs and critters, then run it as Dora or Enzo. Clear it to get a code friends can play. No accounts, local saves.',
};
export default function FluffForgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
