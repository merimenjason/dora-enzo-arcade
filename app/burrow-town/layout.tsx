import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: "Burrow Town · Dora & Enzo's Arcade",
  description:
    'A cozy 3D valley builder. Lay roads, dig burrows, plant hay and dust baths, and keep both Dora and Enzo happy across five Andean valleys. No accounts, local saves.',
};
export default function BurrowTownLayout({ children }: { children: React.ReactNode }) {
  return children;
}
