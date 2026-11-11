import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Brinelight · Dora & Enzo’s Arcade',
  description: 'A two-hero tag-team brawler on a harbour at festival night. Dora kicks what flies, Enzo cracks what wears a shell, and tagging between them mid-combo chains the damage. Dash, jump and attack for a special, fill the Festival meter for a double-team, and relight the lanterns of Lantern Quay and the Fish Market.',
};
export default function BrinelightLayout({ children }: { children: React.ReactNode }) { return children; }
